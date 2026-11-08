'use strict';

/*
 * 지구 시뮬레이션
 *
 * 1) 기후: "실제 역사" 기준값(data/climate.js) + 당신의 개입이 만든 변화
 *    - 이산화탄소 변화는 시간이 지나며 줄어듭니다(암석 풍화).
 *    - 기온 = 기준 기온 + 4°C × log2(CO₂ 배수)  (지질학적 기후 민감도)
 *    - 기온이 너무 내려가면 얼음-반사 되먹임으로 "눈덩이 지구"가 되고,
 *      화산의 이산화탄소가 쌓여야 녹습니다.
 * 2) 생명: "진화 시계"(E)로 다음 단계까지 걸리는 시간을 셉니다. 실제 역사에서는 E = 시간.
 *    - 큰 멸종은 생명을 뒤로 되돌리거나(시계 되감기), 지배 생물을 바꿉니다
 *      (단궁류 → 지배파충류·공룡 → 포유류). 빈자리가 생겨야 다음 무리가 지배합니다.
 *    - 인류는 포유류가 지배한 뒤 약 6570만 년 만에 나타납니다.
 *    - 환경이 너무 뜨겁거나 이산화탄소가 너무 적으면 복잡한 생명이 살 수 없습니다.
 * 같은 개입이면 언제나 같은 결과가 나오는 결정적 시뮬레이션입니다.
 */
(function () {
  const EC = (window.EC = window.EC || {});
  const U = EC.util;
  const D = EC.data;
  const C = D.climate;

  const T_START = D.T_START;
  const T_END = D.T_END;
  const CLIMATE_SENS = 4; // °C / CO₂ 두 배

  const STAGES = [
    { id: 'none', name: '생명 없음', E: -Infinity },
    { id: 'microbe', name: '단세포 미생물', E: -3800 },
    { id: 'photo', name: '광합성 세균', E: -3000 },
    { id: 'eukaryote', name: '진핵생물', E: -1800 },
    { id: 'multicell', name: '다세포 생물', E: -1050 },
    { id: 'ediacaran', name: '에디아카라 생물', E: -575 },
    { id: 'animals', name: '바다 동물', E: -538.8 },
    { id: 'landPlants', name: '육상 식물', E: -470 },
    { id: 'forests', name: '숲', E: -385 },
    { id: 'tetrapods', name: '육상 척추동물', E: -375 },
  ];
  const S = {};
  STAGES.forEach((s, i) => { S[s.id] = i; });

  const DYNASTIES = {
    synapsid: { name: '양서류·단궁류', ready: -Infinity },
    archosaur: { name: '지배파충류·공룡', ready: -260 },
    mammal: { name: '포유류', ready: -190 },
  };
  const VACANCY = 0.6; // 이 이상 사라지면 지배 생물이 바뀔 수 있음

  const MINOR = [
    { id: 'dinosaurs', E: -231, need: (st) => st.dynasty === 'archosaur' },
    { id: 'mammalsOrigin', E: -225, need: (st) => st.stage >= S.tetrapods },
    { id: 'birds', E: -150, need: (st) => st.dynasty === 'archosaur' || st.flags.birdsLine },
    { id: 'flowers', E: -130, need: (st) => st.stage >= S.landPlants },
  ];
  const HUMAN_STEPS = [
    { id: 'hominin', dE: 59 },
    { id: 'humans', dE: 65.7 },
    { id: 'civ', dE: 65.988 },
  ];
  const STERILE_RECOVERY = 150; // 모든 생명이 사라진 뒤 다시 나타날 때까지 (백만 년)

  /* ---------------- 기준 기후 ---------------- */

  function glacialIndex(t) {
    const TERMS = C.TERMINATIONS;
    if (t >= TERMS[0]) return 0;
    for (let i = 0; i < TERMS.length - 1; i++) {
      const young = TERMS[i];
      const old = TERMS[i + 1];
      if (t < young && t >= old) {
        const x = (t - old) / (young - old);
        if (x > 0.92) return (1 - x) / 0.08;
        const g = U.smoothstep(0.06, 0.92, x);
        return U.clamp(g * (0.86 + 0.14 * Math.sin((2 * Math.PI * t) / 0.023)), 0, 1);
      }
    }
    const amp = U.smoothstep(-2.8, -2.4, t);
    return amp * (0.45 + 0.35 * Math.sin((2 * Math.PI * t) / 0.041));
  }

  function baseT(t) {
    const tab = U.interp(C.T_BASE, t);
    if (t >= -2.9 && t < -0.0117) {
      const g = glacialIndex(t);
      const tIg = U.interp([[-2.9, 16.2], [-1.0, 14.5], [-0.0117, 14.0]], t);
      const dT = U.interp([[-2.9, 3.0], [-1.0, 4.5], [-0.5, 5.8], [0, 5.8]], t);
      const q = tIg - g * dT;
      return U.lerp(tab, q, U.smoothstep(-2.9, -2.5, t));
    }
    return tab;
  }

  function baseCO2(t) {
    const tab = U.interpLog(C.CO2_BASE, t);
    if (t >= -2.9 && t < -0.0117) {
      const q = 280 - glacialIndex(t) * 95;
      return Math.exp(U.lerp(Math.log(tab), Math.log(q), U.smoothstep(-2.9, -2.5, t)));
    }
    return tab;
  }

  const oceanAmount = (t) => U.interp(C.OCEAN, t);

  /* 태양 밝기 (현재 = 1): 주계열은 Gough(1981) 식, 그 뒤는 표 */
  function sunLuminosity(t) {
    if (t <= 5000) {
      const age = 4570 + t;
      return 1 / (1 + 0.4 * (1 - age / 4570));
    }
    return U.interpLog(C.SUN_LATE_LUM, t);
  }

  /* ---------------- 설정(개입 목록) → 펄스와 충격 ---------------- */

  function buildConfig(interventions, disabled) {
    const co2Pulses = [];
    const tPulses = [];
    const shocks = [];
    for (const c of D.catastrophes) {
      if (disabled && disabled.has(c.id)) {
        if (c.anomaly) {
          if (c.anomaly.co2) co2Pulses.push({ t0: c.t, ln: -Math.log(c.anomaly.co2), tau: c.anomaly.tau });
          if (c.anomaly.dT) tPulses.push({ t0: c.t, dT: -c.anomaly.dT, tau: c.anomaly.tau });
        }
      } else {
        shocks.push({ t: c.t, s: c.severity, source: c.id, kind: 'catastrophe' });
      }
    }
    for (const iv of interventions || []) {
      const tool = D.tools[iv.type];
      if (!tool || iv.t < T_START || iv.t > T_END) continue;
      let sClim = 0;
      if (tool.co2) {
        co2Pulses.push({ t0: iv.t, ln: Math.log(tool.co2), tau: tool.tau });
        const dT = CLIMATE_SENS * Math.log2(tool.co2);
        sClim = U.clamp((Math.abs(dT) - 3) / 10, 0, 0.6);
      }
      const s = 1 - (1 - (tool.severity || 0)) * (1 - sClim);
      shocks.push({ t: iv.t, s, source: iv.id, kind: 'intervention', sterilize: !!tool.sterilize });
    }
    shocks.sort((a, b) => a.t - b.t);
    return { co2Pulses, tPulses, shocks };
  }

  function buildGrid(cfg) {
    const pts = [];
    const add = (from, to, step) => { for (let t = from; t < to - 1e-9; t += step) pts.push(t); };
    add(-4540, -4400, 2);
    add(-4400, -541, 5);
    add(-541, -66, 0.5);
    add(-66, -2.6, 0.25);
    add(-2.6, 0, 0.005);
    add(0, 1, 0.01);
    add(1, T_END, 5);
    pts.push(T_END);
    for (const tab of [C.T_BASE, C.CO2_BASE, C.OCEAN]) for (const [t] of tab) pts.push(t);
    for (const s of cfg.shocks) pts.push(s.t);
    const refine = [0.02, 0.05, 0.1, 0.2, 0.35, 0.5, 0.75, 1, 1.5, 2, 3, 4, 6, 9];
    for (const p of cfg.co2Pulses.concat(cfg.tPulses)) for (const f of refine) pts.push(p.t0 + p.tau * f);
    const sorted = pts.filter((t) => t >= T_START && t <= T_END).sort((a, b) => a - b);
    const out = [];
    for (const t of sorted) if (!out.length || t - out[out.length - 1] > 1e-7) out.push(t);
    return out;
  }

  /* ---------------- 환경 ---------------- */

  function env(t, snow, snowLog, cfg) {
    const Tb = baseT(t);
    const Cb = baseCO2(t);
    let ln = snowLog || 0;
    for (const p of cfg.co2Pulses) {
      if (t >= p.t0) { const k = (t - p.t0) / p.tau; if (k < 14) ln += p.ln * Math.exp(-k); }
    }
    let dTo = 0;
    for (const p of cfg.tPulses) {
      if (t >= p.t0) { const k = (t - p.t0) / p.tau; if (k < 14) dTo += p.dT * Math.exp(-k); }
    }
    const Tun = Tb + (CLIMATE_SENS * ln) / Math.LN2 + dTo;
    return { Tb, Cb, co2: Cb * Math.exp(ln), Tun, T: snow ? Math.min(Tun, -40) : Tun, ocean: oceanAmount(t) };
  }

  function capFor(e, O2) {
    if (e.ocean < 0.03 || e.T >= 145) return 0;
    if (e.T >= 70) return S.microbe;
    if (e.T >= 60) return S.photo;
    if (e.T >= 48 || e.co2 < 10) return S.eukaryote;
    if (O2 < 1) return S.multicell;
    return STAGES.length - 1;
  }

  /* ---------------- 실행 ---------------- */

  function initState() {
    return {
      alive: false, lifeReadyT: -3800, again: false, E: 0, stage: 0, dynasty: null, dynStartE: 0,
      flags: {}, B: 0, O2: 0, snow: false, snowLog: 0, goe: false, plantsDeclined: false,
    };
  }

  function snapshot(st) {
    return {
      alive: st.alive, stage: st.stage, dynasty: st.dynasty, snow: st.snow,
      hominin: !!st.flags.hominin, humans: !!st.flags.humans, civ: !!st.flags.civ, civT: st.flags.civT,
    };
  }

  function run(interventions, disabled) {
    const cfg = buildConfig(interventions, disabled);
    const grid = buildGrid(cfg);
    const st = initState();
    const samples = [];
    const events = [];
    const emit = (id, t, data) => events.push({ id, t, kind: 'life', data: data || null, snap: snapshot(st) });
    const record = (t) => samples.push({ t, B: st.B, O2: st.O2, snowLog: st.snowLog });

    function resetLineage() {
      st.dynasty = null;
      st.flags = {};
    }

    function applyExtinction(s, t, source, sterilize) {
      if (!st.alive) return;
      st.B *= 1 - s;
      if (sterilize || s >= 0.995) {
        st.alive = false;
        st.stage = 0;
        resetLineage();
        st.lifeReadyT = t + STERILE_RECOVERY;
        st.again = true;
        st.plantsDeclined = false;
        st.B = 0;
        emit('sterilized', t, { source });
        return;
      }
      if (s >= 0.96 && st.stage > S.multicell) {
        st.stage = S.multicell;
        st.E = Math.min(st.E, STAGES[S.multicell].E);
        resetLineage();
        emit('complexWiped', t, { source });
        return;
      }
      if (s >= VACANCY && st.dynasty) {
        if (st.dynasty === 'synapsid' && st.E >= DYNASTIES.archosaur.ready) {
          st.dynasty = 'archosaur';
          st.dynStartE = st.E;
          emit('dynArchosaur', t, { source });
        } else if (st.dynasty === 'archosaur' && st.E >= DYNASTIES.mammal.ready) {
          st.dynasty = 'mammal';
          st.dynStartE = st.E;
          emit('dynMammal', t, { source });
        } else if (st.dynasty === 'mammal') {
          const hadHumans = st.flags.hominin;
          delete st.flags.hominin; delete st.flags.humans; delete st.flags.civ; delete st.flags.civT;
          st.dynStartE = st.E;
          if (hadHumans) emit('humansLost', t, { source });
        }
      }
    }

    function evolve(ta, tb) {
      const eB = env(tb, st.snow, st.snowLog, cfg);
      const cap = capFor(eB, st.O2);
      const E0 = st.E;
      let E1 = E0 + (tb - ta);
      const nextCapped = cap + 1 < STAGES.length ? STAGES[cap + 1].E : Infinity;
      if (E1 >= nextCapped) E1 = Math.max(E0, nextCapped - 1e-6);
      const timeOf = (E) => U.clamp(ta + (E - E0), ta, tb);

      for (let k = st.stage + 1; k <= cap && k < STAGES.length; k++) {
        if (STAGES[k].E > E1) break;
        st.stage = k;
        if (k === S.tetrapods) { st.dynasty = 'synapsid'; st.dynStartE = STAGES[k].E; }
        emit(STAGES[k].id, timeOf(STAGES[k].E));
      }
      for (const m of MINOR) {
        if (!st.flags[m.id] && E1 >= m.E && cap >= S.tetrapods && m.need(st)) {
          st.flags[m.id] = true;
          if (m.id === 'birds') st.flags.birdsLine = true;
          emit(m.id, timeOf(m.E));
        }
      }
      if (st.dynasty === 'mammal' && cap >= S.tetrapods) {
        for (const h of HUMAN_STEPS) {
          if (!st.flags[h.id] && E1 - st.dynStartE >= h.dE) {
            st.flags[h.id] = true;
            const tt = timeOf(st.dynStartE + h.dE);
            if (h.id === 'civ') st.flags.civT = tt;
            emit(h.id, tt);
          }
        }
      }
      st.E = E1;

      if (cap < st.stage) {
        const prev = st.stage;
        st.stage = cap;
        if (cap > 0) st.E = Math.min(st.E, STAGES[cap].E);
        if (cap < S.tetrapods) resetLineage();
        if (cap === 0) {
          st.alive = false;
          st.lifeReadyT = tb + STERILE_RECOVERY;
          st.again = true;
          st.B = 0;
          emit('lifeEnd', tb);
        } else if (prev >= S.landPlants && cap < S.ediacaran) {
          emit('complexEnd', tb, { cause: eB.co2 < 10 ? 'co2' : eB.T >= 48 ? 'heat' : 'oxygen' });
        } else {
          emit('regress', tb);
        }
      }

      if (!st.plantsDeclined && st.stage >= S.landPlants && eB.co2 < 150 && eB.Tb > 4) {
        st.plantsDeclined = true;
        const eA = env(ta, st.snow, st.snowLog, cfg);
        let tt = tb;
        if (eA.co2 > 150) tt = ta + (tb - ta) * (Math.log(eA.co2 / 150) / Math.log(eA.co2 / eB.co2));
        emit('plantsDecline', tt);
      }
    }

    function stepLife(ta, tb) {
      if (!st.alive) {
        if (tb >= st.lifeReadyT) {
          const t0 = Math.max(ta, st.lifeReadyT);
          const e0 = env(t0, st.snow, st.snowLog, cfg);
          if (e0.ocean > 0.5 && e0.T < 100) {
            st.alive = true;
            st.stage = S.microbe;
            st.E = STAGES[S.microbe].E;
            st.B = 0.2;
            emit(st.again ? 'lifeAgain' : 'life', t0);
            evolve(t0, tb);
          }
        }
      } else {
        evolve(ta, tb);
      }
    }

    function stepClimate(ta, tb) {
      const dt = tb - ta;
      if (st.snow) {
        st.snowLog += 0.35 * dt;
        const e = env(tb, false, st.snowLog, cfg);
        if (e.Tun > 25) { st.snow = false; emit('snowballEnd', tb); }
      } else {
        const e = env(tb, false, st.snowLog, cfg);
        if (e.Tun < 4 && e.Tb > 4) {
          st.snow = true;
          emit('snowball', tb);
          applyExtinction(0.7, tb, 'snowball');
        } else if (st.snowLog > 0) {
          st.snowLog *= Math.exp(-dt / 2);
          if (st.snowLog < 1e-3) st.snowLog = 0;
        }
      }
    }

    function stepContinuous(ta, tb) {
      const dt = tb - ta;
      const e = env(tb, st.snow, st.snowLog, cfg);
      const cap = capFor(e, st.O2);
      let target = 0;
      if (st.alive && st.stage >= S.photo && cap >= S.photo) {
        target = U.interp(C.O2_BY_E, Math.min(st.E, 0)) * (e.co2 >= 10 ? 1 : Math.max(0, e.co2) / 10);
      }
      const tauO = target > st.O2 ? 2 : 20;
      st.O2 += (target - st.O2) * (1 - Math.exp(-dt / tauO));
      if (!st.goe && st.O2 >= 0.3) { st.goe = true; emit('goe', tb); }
      if (st.goe && st.O2 < 0.05) st.goe = false;

      let K = st.alive ? U.interp(C.K_BY_E, Math.min(st.E, 0)) : 0;
      if (st.alive && st.stage < S.ediacaran) K = Math.min(K, 4);
      if (st.stage >= S.landPlants && e.co2 < 150) K *= 0.35 + 0.65 * U.clamp(Math.log(e.co2 / 10) / Math.log(15), 0, 1);
      if (st.snow) K *= 0.35;
      const rate = K > st.B ? 0.12 : 0.5;
      st.B += (K - st.B) * (1 - Math.exp(-rate * dt));
    }

    let si = 0;
    record(grid[0]);
    for (let k = 0; k < grid.length - 1; k++) {
      const ta0 = grid[k];
      const tb0 = grid[k + 1];
      const n = st.snow ? Math.max(1, Math.ceil((tb0 - ta0) / 0.5)) : 1;
      for (let j = 0; j < n; j++) {
        const ta = ta0 + ((tb0 - ta0) * j) / n;
        const tb = ta0 + ((tb0 - ta0) * (j + 1)) / n;
        stepClimate(ta, tb);
        stepLife(ta, tb);
        stepContinuous(ta, tb);
      }
      let shocked = false;
      while (si < cfg.shocks.length && cfg.shocks[si].t <= tb0 + 1e-9) {
        const sh = cfg.shocks[si++];
        if (sh.t < ta0 - 1e-9) continue;
        if (!shocked) { record(tb0); shocked = true; }
        applyExtinction(sh.s, tb0, sh.source, sh.sterilize);
      }
      record(tb0);
    }
    events.sort((a, b) => a.t - b.t);
    return { cfg, samples, events, interventions: interventions || [], disabled: new Set(disabled || []) };
  }

  /* ---------------- 조회 ---------------- */

  const INIT_SNAP = snapshot(initState());

  function snapAt(result, t) {
    const ev = result.events;
    const i = U.bisectRight(ev, t, (e) => e.t);
    return i >= 0 ? ev[i].snap : INIT_SNAP;
  }

  function sampleAt(result, t) {
    const sm = result.samples;
    const i = U.bisectRight(sm, t, (s) => s.t);
    if (i < 0) return sm[0];
    if (i >= sm.length - 1) return sm[sm.length - 1];
    const a = sm[i];
    const b = sm[i + 1];
    if (b.t === a.t) return b;
    const f = (t - a.t) / (b.t - a.t);
    return { t, B: U.lerp(a.B, b.B, f), O2: U.lerp(a.O2, b.O2, f), snowLog: U.lerp(a.snowLog, b.snowLog, f) };
  }

  function seaLevel(t, T) {
    let s = U.interp(C.SEA_TECTONIC, t);
    if (T < 13.5) s -= 120 * U.clamp((13.5 - T) / 5.3, 0, 1);
    else if (T > 15.5) s += 70 * U.clamp((T - 15.5) / 7, 0, 1);
    return s;
  }

  /* t 시점의 모든 상태 (화면과 패널이 씁니다) */
  function stateAt(result, t) {
    t = U.clamp(t, T_START, T_END);
    const snap = snapAt(result, t);
    const sm = sampleAt(result, t);
    const e = env(t, snap.snow, sm.snowLog, result.cfg);
    const baseSnow = e.Tb <= -30;
    const iceLat = snap.snow || baseSnow ? 0 : U.interp(C.ICE_LAT, e.T);
    const moonKm = t < -4510 ? 0 : U.interp(C.MOON_KM, t);
    const stage = STAGES[snap.stage];
    return {
      t,
      T: e.T,
      Tbase: e.Tb,
      co2: e.co2,
      co2Base: e.Cb,
      O2: sm.O2,
      B: snap.alive ? sm.B : 0,
      alive: snap.alive,
      stage: snap.stage,
      stageId: stage.id,
      stageName: stage.name,
      dynasty: snap.dynasty,
      dynastyName: snap.dynasty ? DYNASTIES[snap.dynasty].name : null,
      humans: snap.humans,
      civ: snap.civ,
      civT: snap.civT,
      snow: snap.snow || baseSnow,
      userSnow: snap.snow,
      iceLat,
      iceFrac: 1 - Math.sin((iceLat * Math.PI) / 180),
      seaLevel: seaLevel(t, e.T),
      ocean: e.ocean,
      lava: U.interp(C.LAVA, t),
      crustShrink: U.interp(C.CRUST_SHRINK, t),
      dayHours: U.interp(C.DAY_HOURS, t),
      moonKm,
      sunLum: sunLuminosity(t),
      sunRadius: U.interp(C.SUN_RADIUS, t),
    };
  }

  /* 사건 목록: 고정 사건 + 대멸종 + 이 실행이 만든 생명 사건 + 개입 */
  function timeline(result) {
    const list = [];
    for (const e of D.staticEvents) list.push(Object.assign({ source: 'static' }, e));
    for (const c of D.catastrophes) {
      list.push({
        id: c.id, t: c.t, kind: 'extinction', major: true, title: c.title, text: c.text, loc: c.loc, cause: c.cause,
        source: 'catastrophe', prevented: result.disabled.has(c.id),
      });
    }
    for (const e of result.events) {
      const tpl = D.lifeEvents[e.id];
      if (!tpl) continue;
      list.push({ id: e.id, t: e.t, kind: 'life', major: !!tpl.major, title: tpl.title, text: tpl.text, data: e.data, source: 'life' });
    }
    for (const iv of result.interventions) {
      const tool = D.tools[iv.type];
      list.push({ id: iv.id, t: iv.t, kind: 'intervention', major: true, title: tool.name, text: tool.desc, tool: iv.type, iv, source: 'intervention' });
    }
    list.sort((a, b) => a.t - b.t);
    return list;
  }

  /* 실제 역사와 비교한 주요 이정표 */
  const MILESTONES = ['life', 'goe', 'eukaryote', 'animals', 'landPlants', 'tetrapods', 'dinosaurs', 'dynMammal', 'humans', 'civ', 'plantsDecline', 'complexEnd', 'lifeEnd'];
  function firstTimes(result) {
    const m = {};
    for (const e of result.events) if (m[e.id] === undefined) m[e.id] = e.t;
    return m;
  }

  EC.sim = {
    STAGES, S, DYNASTIES, MILESTONES, CLIMATE_SENS,
    run, stateAt, timeline, firstTimes, baseT, baseCO2, sunLuminosity, glacialIndex, env, buildConfig,
  };
})();
