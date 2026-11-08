'use strict';

/*
 * 은하 문명: 우리 은하의 "생명이 살 만한 영역"에 별 640개를 고르고, 그 별들의 행성에서
 * 문명이 태어나고, 기술이 자라고, 이주선을 보내 영역을 넓히고, 이웃을 만나 전쟁하거나 평화롭게 지내고,
 * 갈라지고, 멸망하고, 초월하는 이야기를 계산합니다.
 *
 * 같은 시작점과 같은 개입이면 언제나 같은 역사가 나옵니다(결정적). 개입하면 그 순간부터 역사가 갈라집니다.
 * 시간 단위: 이 모드를 시작한 순간부터 흐른 햇수. 거리: 광년.
 *
 * 외계 문명은 아직 하나도 발견되지 않았습니다. 이 모드는 "만약 은하에 문명이 많다면?"을 상상해 보는 놀이입니다.
 */
(function () {
  const UC = (window.UC = window.UC || {});
  const U = UC.util;

  const DURATION = 40e6; // 4천만 년
  const DT = 20000; // 한 걸음 2만 년
  const STEPS = Math.round(DURATION / DT);
  const N_SYS = 640;
  const TECH_EVERY = 10; // 기술 기록 간격(걸음)

  const SPECIES = [
    { id: 'reptile', icon: '🦎', name: '파충류형', text: '비늘 피부를 가진 냉혈 종족. 따뜻한 바다 행성에서 진화했습니다.' },
    { id: 'insect', icon: '🐜', name: '곤충형', text: '여왕을 중심으로 수십억 개체가 하나처럼 움직이는 종족입니다.' },
    { id: 'ocean', icon: '🐙', name: '수중 생명', text: '얼음 위성의 두꺼운 얼음 밑 바다에서 진화한 촉수 종족입니다.' },
    { id: 'crystal', icon: '💎', name: '결정 생명', text: '규소 결정으로 된 몸을 가졌고 한 개체가 수천 년을 삽니다.' },
    { id: 'gas', icon: '☁️', name: '가스 생명', text: '거대 가스 행성의 대기 속을 떠다니며 사는 존재입니다.' },
    { id: 'fungus', icon: '🍄', name: '균류 집합체', text: '행성 전체를 덮은 하나의 거대한 균사 네트워크가 생각합니다.' },
    { id: 'machine', icon: '🤖', name: '기계 지성', text: '창조자를 넘어서 스스로 진화하는 인공 지능 문명입니다.' },
    { id: 'avian', icon: '🦅', name: '조류형', text: '날개를 가진 종족. 높은 산꼭대기에 도시를 짓습니다.' },
    { id: 'mammal', icon: '🐒', name: '포유류형', text: '털로 덮인, 무리를 지어 사는 사회적 종족입니다.' },
  ];
  const HUMAN = { id: 'human', icon: '🧑', name: '인류', text: '지구에서 태어난 우리. 30만 년 전에 나타나, 막 우주로 나가기 시작했습니다.' };

  const STAGES = [
    { min: 0, name: '행성 문명', k: '카르다쇼프 0~1형', text: '아직 자기 행성을 벗어나지 못했습니다.' },
    { min: 1.5, name: '항성계 문명', k: '카르다쇼프 1~2형', text: '이웃 별로 이주선을 보내기 시작했습니다.' },
    { min: 3, name: '성간 문명', k: '카르다쇼프 2형', text: '여러 항성계를 다스리며 별의 에너지를 씁니다.' },
    { min: 6, name: '은하 문명', k: '카르다쇼프 2~3형', text: '은하의 넓은 영역에 퍼져 있습니다.' },
    { min: 9, name: '초월 직전', k: '카르다쇼프 3형', text: '물질의 한계를 넘어서려 하고 있습니다.' },
  ];
  const stageOf = (tech) => STAGES.filter((s) => tech >= s.min).pop();

  const SYL = ['카', '르', '시', '아', '노', '벨', '타', '린', '오', '스', '미', '라', '네', '온', '드', '우', '엘', '하', '제', '토', '베', '니', '쿠', '리', '모', '사', '펠', '안', '케', '로', '바', '주', '틴', '솔', '그', '무', '레', '디', '헬', '보'];
  function makeName(r, n) {
    let s = '';
    const k = n || 2 + Math.floor(r() * 2);
    for (let i = 0; i < k; i++) s += SYL[Math.floor(r() * SYL.length)];
    return s;
  }

  function hsl(h, s, l) {
    const f = (n) => {
      const k = (n + h * 12) % 12;
      const a = s * Math.min(l, 1 - l);
      return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    };
    return [f(0), f(8), f(4)];
  }

  /* ---------- 별 (항성계) ---------- */
  let SYSTEMS = null;
  function systems() {
    if (SYSTEMS) return SYSTEMS;
    const G = UC.galaxy;
    G.init();
    const mw = G.mw;
    const r = U.rng(4242);
    const out = [{ id: 0, pos: G.SUN0.slice(), name: '태양계', star: 'G', T: 5772, earth: true, hab: 1 }];
    const cell = 700;
    const grid = new Map();
    const key = (x, z) => `${Math.floor(x / cell)},${Math.floor(z / cell)}`;
    const tooClose = (p) => {
      const cx = Math.floor(p[0] / cell), cz = Math.floor(p[2] / cell);
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
        for (const q of grid.get(`${cx + dx},${cz + dz}`) || []) if (Math.hypot(q[0] - p[0], q[2] - p[2]) < 650) return true;
      }
      return false;
    };
    const addGrid = (p) => { const k = key(p[0], p[2]); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(p); };
    addGrid(out[0].pos);
    const STARS = [['M', 3300, 0.5], ['K', 4500, 0.25], ['G', 5800, 0.18], ['F', 6700, 0.07]];
    const used = new Set();
    let tries = 0;
    while (out.length < N_SYS && tries < 200000) {
      tries++;
      const i = Math.floor(r() * mw.stars);
      if (used.has(i)) continue;
      const o = i * G.STRIDE;
      const type = mw.data[o + 3];
      if (type !== G.TYPE.THIN && type !== G.TYPE.YOUNG && type !== G.TYPE.THICK) continue;
      const p = [mw.data[o], mw.data[o + 1], mw.data[o + 2]];
      const rad = Math.hypot(p[0], p[2]);
      if (rad < 7000 || rad > 47000) continue;
      /* 은하의 생명 가능 지대: 중심은 초신성과 감마선이 잦고, 바깥은 무거운 원소가 모자람 */
      const hab = Math.exp(-Math.pow((rad - 25000) / 11000, 2));
      if (r() > 0.25 + 0.75 * hab) continue;
      if (tooClose(p)) continue;
      used.add(i);
      addGrid(p);
      let u = r();
      let st = STARS[0];
      for (const s of STARS) { if (u < s[2]) { st = s; break; } u -= s[2]; }
      out.push({ id: out.length, pos: p, name: makeName(r), star: st[0], T: st[1] + (r() - 0.5) * 300, hab });
    }
    SYSTEMS = out;
    return out;
  }

  /* 별마다 가까운 별 목록 (거리순, 1만 광년 안). 한 번만 만들어 둠 */
  let NEIGH = null;
  function neighbors(sys) {
    if (NEIGH) return NEIGH;
    const R = 10000;
    NEIGH = sys.map((a) => {
      const list = [];
      for (const b of sys) {
        if (b.id === a.id) continue;
        const d = Math.hypot(a.pos[0] - b.pos[0], (a.pos[1] - b.pos[1]) * 0.5, a.pos[2] - b.pos[2]);
        if (d <= R) list.push([b.id, d]);
      }
      list.sort((x, y) => x[1] - y[1]);
      return { ids: Int16Array.from(list.map((x) => x[0])), d: Float32Array.from(list.map((x) => x[1])) };
    });
    return NEIGH;
  }

  /* 받침에 맞는 조사: josa('인류', '이', '가') → '인류가' */
  function josa(word, withB, withoutB) {
    const c = word.charCodeAt(word.length - 1);
    const has = c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 !== 0;
    return word + (has ? withB : withoutB);
  }

  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

  /*
   * 역사 계산. opts: { tau0: 우주 나이, interventions: [{ t, type, sys?, civ? }], humans: bool }
   * 개입 종류: seed(sys) · gift(civ) · peace(civ) · war(civ) · supernova(sys)
   */
  function simulate(opts) {
    const sys = systems();
    const S = sys.length;
    const NB = neighbors(sys);
    /* s 둘레 R 광년 안의 별: [[id, 거리], ...] (자신 포함) */
    const idx = {
      near(s0, R) {
        const out = [[s0, 0]];
        const nb = NB[s0];
        for (let k = 0; k < nb.ids.length && nb.d[k] <= R; k++) out.push([nb.ids[k], nb.d[k]]);
        return out;
      },
      count(s0, R, id) {
        let n = owner[s0] === id ? 1 : 0;
        const nb = NB[s0];
        for (let k = 0; k < nb.ids.length && nb.d[k] <= R; k++) if (owner[nb.ids[k]] === id) n++;
        return n;
      },
    };
    const seed = Math.floor((opts.tau0 / 1e6) % 100000) * 7 + 13;
    const r = U.rng(seed);
    const ivs = (opts.interventions || []).slice().sort((a, b) => a.t - b.t);
    let ivi = 0;

    const owner = new Int16Array(S).fill(-1);
    const ruin = new Uint8Array(S);
    const claimed = new Int16Array(S).fill(-1); // 이주선이 향하는 중
    const civs = [];
    const events = [];
    const ships = [];
    const pending = [];
    const battles = [];
    const owners = new Array(STEPS + 1);
    const techLog = [];
    const rel = new Map(); // "a,b" → { state: 'peace'|'war', since }
    const relKey = (a, b) => (a < b ? `${a},${b}` : `${b},${a}`);
    const usedNames = new Set();
    let hueN = 0;

    const ev = (t, type, civ, extra, major) => events.push(Object.assign({ t, type, civ, major: !!major }, extra || {}));

    function newCiv(t, home, o) {
      const id = civs.length;
      const sp = o && o.species ? o.species : o && o.human ? HUMAN : SPECIES[Math.floor(r() * SPECIES.length)];
      const agg = o && o.agg !== undefined ? o.agg : Math.pow(r(), 1.3);
      let base = o && o.name;
      if (!base) {
        do base = makeName(r); while (usedNames.has(base));
      }
      usedNames.add(base);
      const form = o && o.human ? '' : sp.id === 'human' ? (agg > 0.6 ? '제국' : '연방') : sp.id === 'insect' ? '군락' : sp.id === 'fungus' ? '집합체' : sp.id === 'machine' ? '연산체' : agg > 0.6 ? (r() < 0.5 ? '제국' : '왕국') : agg < 0.3 ? (r() < 0.5 ? '연방' : '공화국') : '연합';
      const hue = o && o.human ? 0.56 : (0.07 + hueN++ * 0.61803) % 1;
      const c = {
        id,
        name: form ? `${base} ${form}` : base,
        species: sp,
        color: hsl(hue, o && o.human ? 0.85 : 0.75, 0.6),
        home,
        capital: home,
        born: t,
        agg,
        expand: 0.6 + r() * 1.0,
        growth: o && o.growth !== undefined ? o.growth : 0.06 + r() * 0.2,
        tech: o && o.tech !== undefined ? o.tech : 1 + r() * 0.4,
        human: !!(o && o.human),
        seeded: !!(o && o.seeded),
        parent: o && o.parent !== undefined ? o.parent : null,
        alive: true,
        end: null,
        endType: null,
        n: 0,
        nextShip: t + 2e5 * r(),
        peak: 0,
        active: 0,
      };
      civs.push(c);
      claim(home, id, t, true);
      return c;
    }

    function claim(s, id, t, quiet) {
      const prev = owner[s];
      if (prev >= 0) civs[prev].n--;
      owner[s] = id;
      claimed[s] = -1;
      ruin[s] = 0;
      if (id >= 0) {
        civs[id].n++;
        civs[id].peak = Math.max(civs[id].peak, civs[id].n);
      }
      if (prev >= 0 && civs[prev].n <= 0 && civs[prev].alive) {
        endCiv(prev, t, 'extinct', id);
      } else if (prev >= 0 && civs[prev].capital === s) {
        /* 수도를 잃으면 다른 곳으로 옮김 */
        let best = -1;
        let bd = Infinity;
        for (let k = 0; k < S; k++) if (owner[k] === prev) { const d = dist(sys[k].pos, sys[s].pos); if (d < bd) { bd = d; best = k; } }
        if (best >= 0) civs[prev].capital = best;
      }
      return quiet;
    }

    function endCiv(id, t, type, by) {
      const c = civs[id];
      if (!c.alive) return;
      c.alive = false;
      c.end = t;
      c.endType = type;
      for (let k = 0; k < S; k++) {
        if (owner[k] === id) { owner[k] = -1; ruin[k] = 1; }
        if (claimed[k] === id) claimed[k] = -1;
      }
      c.n = 0;
      for (const [k, v] of rel) {
        const [a, b] = k.split(',').map(Number);
        if ((a === id || b === id) && v.state === 'war') v.state = 'over';
      }
      const big = c.peak >= 8 || c.human;
      if (type === 'extinct') ev(t, 'extinct', id, { by, sys: c.home }, big);
      else if (type === 'transcend') ev(t, 'transcend', id, { sys: c.capital }, true);
      else if (type === 'selfdestroy') ev(t, 'selfdestroy', id, { sys: c.home }, c.human);
    }

    const alive = () => civs.filter((c) => c.alive);
    const ownedBy = (id) => {
      const out = [];
      for (let k = 0; k < S; k++) if (owner[k] === id) out.push(k);
      return out;
    };

    function supernova(t, s, R, natural) {
      const hit = idx.near(s, R);
      const victims = new Set();
      for (const [k] of hit) {
        if (owner[k] >= 0) victims.add(owner[k]);
        const o = owner[k];
        if (o >= 0) {
          civs[o].n--;
          owner[k] = -1;
          ruin[k] = 1;
          if (civs[o].n <= 0) endCiv(o, t, 'extinct', -2);
        }
      }
      ev(t, 'supernova', -1, { sys: s, natural, victims: [...victims], R }, !natural || victims.size > 0);
    }

    function applyIv(iv, t) {
      if (iv.type === 'seed' && owner[iv.sys] < 0) {
        const c = newCiv(t, iv.sys, { seeded: true, tech: 1.1, growth: 0.16 });
        ev(t, 'born', c.id, { sys: iv.sys, seeded: true, iv: iv.id }, true);
      } else if (iv.type === 'gift' && civs[iv.civ] && civs[iv.civ].alive) {
        civs[iv.civ].tech += 3;
        ev(t, 'gift', iv.civ, { iv: iv.id }, true);
      } else if (iv.type === 'peace' && civs[iv.civ] && civs[iv.civ].alive) {
        civs[iv.civ].agg = 0.03;
        for (const [k, v] of rel) {
          const [a, b] = k.split(',').map(Number);
          if ((a === iv.civ || b === iv.civ) && v.state === 'war') { v.state = 'peace'; v.since = t; ev(t, 'peace', a, { other: b }, true); }
        }
        ev(t, 'calm', iv.civ, { iv: iv.id }, true);
      } else if (iv.type === 'war' && civs[iv.civ] && civs[iv.civ].alive) {
        civs[iv.civ].agg = 1;
        for (const [k, v] of rel) {
          const [a, b] = k.split(',').map(Number);
          if ((a === iv.civ || b === iv.civ) && v.state === 'peace' && civs[a].alive && civs[b].alive) { v.state = 'war'; v.since = t; ev(t, 'war', iv.civ, { other: a === iv.civ ? b : a }, true); }
        }
        ev(t, 'rage', iv.civ, { iv: iv.id }, true);
      } else if (iv.type === 'supernova') {
        supernova(t, iv.sys, 700, false);
      }
    }

    /* ---------- 처음 은하 ---------- */
    const habPick = () => {
      for (let k = 0; k < 50; k++) {
        const s = 1 + Math.floor(r() * (S - 1));
        if (owner[s] < 0 && claimed[s] < 0 && r() < sys[s].hab) return s;
      }
      return -1;
    };
    if (opts.humans) {
      const h = newCiv(0, 0, { human: true, name: '인류', tech: 1.4, growth: 0.2, agg: 0.45 });
      ev(0, 'born', h.id, { sys: 0, human: true }, false);
    }
    const K0 = 7;
    for (let k = 0; k < K0; k++) {
      const s = habPick();
      if (s < 0) continue;
      const tech = 1 + Math.pow(r(), 1.5) * 3.2;
      const c = newCiv(0, s, { tech });
      /* 오래된 문명은 이미 이웃 별로 퍼져 있음 */
      const extra = Math.floor((tech - 1.3) * 3);
      if (extra > 0) {
        const near = idx.near(s, 1500 + 600 * tech).filter(([q]) => owner[q] < 0).slice(0, extra);
        for (const [q] of near) claim(q, c.id, 0, true);
      }
    }

    /* ---------- 한 걸음씩 ---------- */
    for (let step = 0; step <= STEPS; step++) {
      const t = step * DT;
      while (ivi < ivs.length && ivs[ivi].t <= t + 1e-6) applyIv(ivs[ivi++], t);

      /* 새 문명 */
      if (r() < DT / 2.2e6) {
        const s = habPick();
        if (s >= 0) {
          const c = newCiv(t, s);
          ev(t, 'born', c.id, { sys: s }, false);
        }
      }
      /* 자연 초신성 */
      if (r() < DT / 6e6) {
        const s = Math.floor(r() * S);
        supernova(t, s, 350, true);
      }

      const live = alive();
      for (const c of live) {
        const n = Math.max(c.n, 1);
        c.tech += c.growth * (DT / 1e6) * (0.6 + 0.15 * Math.log2(1 + n));
        /* 초월 */
        if (c.tech >= 10 && r() < 0.004) { endCiv(c.id, t, 'transcend'); continue; }
        /* 스스로 무너짐 (젊은 문명의 위험) */
        if (c.tech < 2.2 && !c.seeded && r() < (c.human ? 1.5e-4 : 3e-4)) { endCiv(c.id, t, 'selfdestroy'); continue; }
        /* 내전으로 갈라짐 */
        if (c.n >= 14 && r() < 1.2e-4 * (1 + c.n / 50)) {
          const own = ownedBy(c.id);
          const cap = sys[c.capital].pos;
          own.sort((a, b) => dist(sys[b].pos, cap) - dist(sys[a].pos, cap));
          const part = own.slice(0, Math.floor(own.length * (0.3 + r() * 0.2)));
          if (part.length >= 3) {
            const nc = newCiv(t, part[0], { tech: c.tech * 0.95, growth: c.growth, agg: Math.min(1, c.agg + 0.2), parent: c.id, species: c.species });
            for (const q of part.slice(1)) claim(q, nc.id, t, true);
            rel.set(relKey(c.id, nc.id), { state: 'war', since: t });
            ev(t, 'split', nc.id, { other: c.id, sys: part[0] }, c.n + nc.n >= 15 || c.human);
          }
        }
        /* 이주선 */
        if (c.tech >= 1.5 && t >= c.nextShip) {
          if (c.active < 2 + Math.floor(c.tech)) {
            const own = ownedBy(c.id);
            const range = 1300 + 800 * c.tech;
            let best = null;
            for (let tries = 0; tries < 4 && !best; tries++) {
              const from = own[Math.floor(r() * own.length)];
              const cand = idx.near(from, range).filter(([q, d]) => owner[q] < 0 && claimed[q] < 0 && d > 1);
              if (cand.length) {
                cand.sort((a, b) => a[1] - b[1] - (sys[b[0]].hab - sys[a[0]].hab) * 400);
                const pickI = Math.min(cand.length - 1, Math.floor(Math.pow(r(), 2) * 3));
                best = { from, to: cand[pickI][0], d: cand[pickI][1] };
              }
            }
            if (best) {
              const v = 0.004 + 0.003 * c.tech;
              const sh = { civ: c.id, from: best.from, to: best.to, t0: t, t1: t + best.d / v };
              ships.push(sh);
              pending.push(sh);
              c.active++;
              claimed[best.to] = c.id;
            }
          }
          c.nextShip = t + 4e5 / c.expand / (0.4 + c.tech * 0.25) * (0.6 + 0.8 * r());
        }
      }
      /* 도착한 이주선 */
      for (let k = pending.length - 1; k >= 0; k--) {
        const sh = pending[k];
        if (sh.t1 > t) continue;
        pending.splice(k, 1);
        const c = civs[sh.civ];
        c.active--;
        if (claimed[sh.to] === sh.civ) claimed[sh.to] = -1;
        if (!c.alive) { sh.fate = 'lost'; continue; }
        if (owner[sh.to] < 0) { claim(sh.to, sh.civ, t); sh.fate = 'settled'; }
        else sh.fate = 'blocked';
      }

      /* 만남과 관계 (5걸음 = 10만 년마다) */
      if (step % 5 === 0) {
        const touch = new Map();
        for (let k = 0; k < S; k++) {
          const a = owner[k];
          if (a < 0) continue;
          const Ra = 1100 + 450 * civs[a].tech;
          const nb = NB[k];
          for (let m = 0; m < nb.ids.length && nb.d[m] <= Ra; m++) {
            const q = nb.ids[m];
            const d = nb.d[m];
            const b = owner[q];
            if (b < 0 || b === a) continue;
            const key = relKey(a, b);
            const cur = touch.get(key);
            if (!cur || d < cur.d) touch.set(key, { d, sa: a === Math.min(a, b) ? k : q, sb: a === Math.min(a, b) ? q : k });
          }
        }
        for (const [key, tc] of touch) {
          const [a, b] = key.split(',').map(Number);
          const A = civs[a];
          const B = civs[b];
          if (!A.alive || !B.alive) continue;
          let R = rel.get(key);
          if (!R) {
            R = { state: 'peace', since: t };
            rel.set(key, R);
            ev(t, 'contact', a, { other: b, sys: tc.sa }, A.human || B.human);
          }
          R.front = tc;
          if (R.state === 'peace' || R.state === 'over') {
            const pWar = 0.012 * (A.agg + B.agg) * (A.agg + B.agg) * (R.state === 'over' ? 0.5 : 1);
            if (t - R.since > 4e5 && r() < pWar) {
              R.state = 'war';
              R.since = t;
              const aggressor = A.agg >= B.agg ? a : b;
              ev(t, 'war', aggressor, { other: aggressor === a ? b : a, sys: tc.sa }, A.human || B.human || A.n + B.n >= 12);
            }
          } else if (R.state === 'war') {
            const years = (t - R.since) / 1e6;
            const pPeace = 0.02 + 0.04 * years * (1.2 - Math.max(A.agg, B.agg));
            if (r() < pPeace) {
              R.state = 'peace';
              R.since = t;
              ev(t, 'peace', a, { other: b, sys: tc.sa }, A.human || B.human || A.n + B.n >= 12);
            }
          }
        }
      }

      /* 전투 */
      for (const [key, R] of rel) {
        if (R.state !== 'war' || !R.front) continue;
        const [a, b] = key.split(',').map(Number);
        const A = civs[a];
        const B = civs[b];
        if (!A.alive || !B.alive) { R.state = 'over'; continue; }
        if (r() > DT / 1.2e5) continue;
        const sa = R.front.sa;
        const sb = R.front.sb;
        if (owner[sa] !== a || owner[sb] !== b) { R.front = null; continue; }
        const local = (id, s0) => idx.count(s0, 4000, id);
        /* 더 호전적인 쪽이 더 자주 공격 */
        const atk = r() < 0.5 + 0.35 * (A.agg - B.agg) ? a : b;
        const def = atk === a ? b : a;
        const from = atk === a ? sa : sb;
        const target = atk === a ? sb : sa;
        const pAtk = Math.pow(civs[atk].tech, 1.6) * (1 + 0.35 * local(atk, from));
        const pDef = Math.pow(civs[def].tech, 1.6) * (1 + 0.35 * local(def, target)) * (civs[def].capital === target ? 1.5 : 1.15);
        const won = r() < pAtk / (pAtk + pDef);
        battles.push({ t, sys: target, from, atk, def, won });
        if (won) {
          const wasLast = civs[def].n <= 1;
          claim(target, atk, t);
          if (!wasLast && civs[def].home === target && civs[def].alive) ev(t, 'homefall', def, { by: atk, sys: target }, civs[def].human || civs[def].peak >= 10);
        }
        R.front = null;
      }

      owners[step] = Int16Array.from(owner);
      if (step % TECH_EVERY === 0) techLog.push(Float32Array.from(civs.map((c) => c.tech)));
    }

    /* 은하의 주인 */
    let leader = -1;
    for (let step = 0; step <= STEPS; step += 25) {
      const cnt = new Map();
      for (const o of owners[step]) if (o >= 0) cnt.set(o, (cnt.get(o) || 0) + 1);
      for (const [id, n] of cnt) {
        if (n > S * 0.4 && leader !== id) {
          leader = id;
          ev(step * DT, 'dominant', id, {}, true);
        }
      }
    }
    events.sort((x, y) => x.t - y.t);
    return { tau0: opts.tau0, humans: !!opts.humans, civs, events, ships, battles, owners, techLog, rel, systems: sys, interventions: ivs };
  }

  /* ---------- 묻기 ---------- */
  const stepOf = (t) => U.clamp(Math.floor(t / DT), 0, STEPS);
  function ownerAt(h, t) { return h.owners[stepOf(t)]; }
  function techAt(h, id, t) {
    const i = U.clamp(t / (DT * TECH_EVERY), 0, h.techLog.length - 1);
    const a = Math.floor(i);
    const b = Math.min(a + 1, h.techLog.length - 1);
    const va = id < h.techLog[a].length ? h.techLog[a][id] : null;
    const vb = id < h.techLog[b].length ? h.techLog[b][id] : va;
    if (va === null) return vb === null ? h.civs[id].tech : vb;
    return U.lerp(va, vb, i - a);
  }
  function countAt(h, t) {
    const cnt = new Map();
    for (const o of ownerAt(h, t)) if (o >= 0) cnt.set(o, (cnt.get(o) || 0) + 1);
    return cnt;
  }
  function shipsAt(h, t) {
    return h.ships.filter((s) => s.t0 <= t && s.t1 > t);
  }
  function battlesAt(h, t, win) {
    return h.battles.filter((b) => b.t <= t && b.t > t - win);
  }
  /* 문명 하나의 그때 상태 */
  function statusAt(h, id, t) {
    const c = h.civs[id];
    if (t < c.born) return '아직 없음';
    if (c.end !== null && t >= c.end) return c.endType === 'transcend' ? '초월함' : '멸망함';
    if (relationsAt(h, id, t).war.length) return '전쟁 중';
    return '번성';
  }
  function relationsAt(h, id, t) {
    const state = new Map();
    for (const e of h.events) {
      if (e.t > t) break;
      if (!['contact', 'war', 'peace', 'split'].includes(e.type)) continue;
      const a = e.civ;
      const b = e.other;
      if (a !== id && b !== id) continue;
      const o = a === id ? b : a;
      if (e.type === 'contact') state.set(o, state.get(o) || 'peace');
      else if (e.type === 'war' || e.type === 'split') state.set(o, 'war');
      else if (e.type === 'peace') state.set(o, 'peace');
    }
    const war = [];
    const peace = [];
    for (const [o, s] of state) {
      const oc = h.civs[o];
      if (oc.end !== null && t >= oc.end) continue;
      if (s === 'war') war.push(o);
      else peace.push(o);
    }
    return { war, peace };
  }

  /* 사건 문장 */
  function eventText(h, e) {
    const C = (id) => (id >= 0 && h.civs[id] ? h.civs[id].name : '');
    const S = (s) => (s >= 0 && h.systems[s] ? h.systems[s].name : '');
    const ga = (w) => josa(w, '이', '가');
    const wa = (w) => josa(w, '과', '와');
    const reul = (w) => josa(w, '을', '를');
    const ui = (w) => `${w}의`;
    switch (e.type) {
      case 'born': return e.human ? '인류가 지구에서 우주를 바라보고 있습니다.' : e.seeded ? `당신이 ${S(e.sys)}에 생명의 씨앗을 뿌려 ${ga(C(e.civ))} 태어났습니다.` : `${S(e.sys)}에서 ${ga(C(e.civ))} 태어났습니다.`;
      case 'contact': return `${wa(C(e.civ))} ${ga(C(e.other))} 처음 만났습니다.`;
      case 'war': return `${ga(C(e.civ))} ${C(e.other)}에 전쟁을 선포했습니다.`;
      case 'peace': return `${wa(C(e.civ))} ${ga(C(e.other))} 평화 조약을 맺었습니다.`;
      case 'split': return `${C(e.other)}에서 내전이 일어나 ${ga(C(e.civ))} 갈라져 나왔습니다.`;
      case 'homefall': return `${ui(C(e.civ))} 고향 행성 ${ga(S(e.sys))} ${C(e.by)}에 함락되었습니다.`;
      case 'extinct': return e.by === -2 ? `${ga(C(e.civ))} 초신성 폭발로 사라졌습니다.` : e.by >= 0 ? `${ga(C(e.civ))} ${C(e.by)}에 의해 멸망했습니다.` : `${ga(C(e.civ))} 멸망했습니다.`;
      case 'selfdestroy': return `${ga(C(e.civ))} 우주로 나가기 전에 스스로 무너졌습니다.`;
      case 'transcend': return `${ga(C(e.civ))} 물질의 한계를 넘어 초월했습니다. 그들의 별에는 빈 도시만 남았습니다.`;
      case 'supernova': {
        const v = (e.victims || []).map(C).filter(Boolean);
        if (e.natural) return `${S(e.sys)} 근처에서 초신성이 터졌습니다.${v.length ? ` ${v.join(', ')}의 행성들이 휩쓸렸습니다.` : ''}`;
        return `당신이 ${S(e.sys)} 근처의 별을 초신성으로 터뜨렸습니다.${v.length ? ` ${ga(v.join(', '))} 피해를 입었습니다.` : ''}`;
      }
      case 'gift': return `당신이 ${C(e.civ)}에게 앞선 기술을 선물했습니다.`;
      case 'calm': return `당신이 ${reul(C(e.civ))} 평화를 사랑하는 문명으로 바꾸었습니다.`;
      case 'rage': return `당신이 ${reul(C(e.civ))} 호전적인 문명으로 바꾸었습니다.`;
      case 'dominant': return `${ga(C(e.civ))} 은하의 별 40% 이상을 차지했습니다.`;
      default: return '';
    }
  }
  const EVENT_ICON = { born: '🌱', contact: '🤝', war: '⚔️', peace: '🕊️', split: '💔', homefall: '🏚️', extinct: '💀', selfdestroy: '☢️', transcend: '✨', supernova: '💥', gift: '💡', calm: '🕊️', rage: '🔥', dominant: '👑' };

  UC.civ = {
    DURATION, DT, STEPS, SPECIES, HUMAN, STAGES, stageOf, systems, simulate,
    ownerAt, techAt, countAt, shipsAt, battlesAt, statusAt, relationsAt, eventText, EVENT_ICON, josa,
  };
})();
