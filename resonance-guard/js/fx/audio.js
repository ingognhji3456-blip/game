'use strict';

/* =========================================================
 * 공명 수호대 — 사운드 (RG.audio)
 * 효과음과 배경음악을 WebAudio로 실시간 합성합니다. 외부 소리 파일 없음.
 * WebAudio가 없으면(Node 등) 모든 공개 함수는 아무 일도 하지 않습니다.
 *
 * 신호 흐름
 *   효과음: 음원 → 목소리(voice) 게인 → (팬) → sfx 버스 ─┐
 *   음악:   음원 → 트랙 버스 ───────────────→ music 버스 ┼→ master → 완만한 압축기 → 리미터 → 소프트 클리퍼 → 출력
 *   잔향:   목소리·트랙 버스 → 보내기 → (sfx/music 잔향 버스) → 합성 잔향(Convolver) ┘
 *
 * 과부하 방지: 같은 효과음은 40ms 간격 이하로 다시 나지 않고, 이름마다 동시 6개,
 * 전체 동시 48개, 25ms마다 새 목소리 14개까지만 울립니다(중요 효과음 pri는 전체·순간 제한을 넘어도 울림).
 * 탭이 숨겨지면 오디오 컨텍스트를 멈추고, 돌아오면 다시 켭니다.
 * ========================================================= */
RG.audio = (() => {
  const W = typeof window !== 'undefined' ? window : {};
  const AC = W.AudioContext || W.webkitAudioContext || null;
  const OAC = W.OfflineAudioContext || W.webkitOfflineAudioContext || null;
  const noop = () => {};
  const rnd = Math.random;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const M = mtof;

  const MAX_VOICES = 48;
  const MAX_PER_NAME = 6;
  const MIN_GAP = 0.04;      // 같은 효과음 최소 간격(초)
  const BURST_WIN = 0.025;   // 이 시간 안에 새로 만드는 목소리는
  const BURST_MAX = 14;      // 이 수까지만(한 프레임에 노드를 몰아 만들어 끊기지 않게)
  const LOOKAHEAD = 0.3;     // 음악 미리 예약 구간(초)
  const FADE_IN = 0.8;
  const FADE_OUT = 1.2;

  const vol = { master: 0.8, sfx: 0.8, music: 0.6 };
  let muted = false;
  let E = null;              // 실제 출력 엔진 { ctx, master, sBus, mBus, ... }
  let seq = null;            // 지금 울리는 음악 시퀀서
  let wanted = 'none';       // 요청된 트랙(초기화 전에도 기억)
  let timer = null;
  let CURVE = null;
  const lastAt = Object.create(null);
  const perName = Object.create(null);
  let active = [];
  let burstAt = -1;
  let burstN = 0;

  // 합성 도우미가 쓰는 "현재" 상태 (자바스크립트는 단일 스레드라 안전)
  let X = null;              // 엔진
  let D = null;              // 출력 노드
  let T0 = 0;                // 기준 시각
  let END = 0;               // 지금 만드는 소리의 끝 시각

  const safe = (fn) => { try { const r = fn(); if (r && r.catch) r.catch(noop); } catch (err) { /* 무시 */ } };

  /* =========================================================
   * 엔진 구성
   * ========================================================= */
  function makeCurve() {
    // |x|<0.7 은 그대로, 그 위는 부드럽게 눌러 최대 0.92 를 넘지 않음
    const n = 2048;
    const c = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      const a = Math.abs(x);
      c[i] = Math.sign(x) * (a < 0.7 ? a : 0.7 + 0.22 * Math.tanh((a - 0.7) / 0.22));
    }
    return c;
  }

  function makeNoise(ctx, crackle) {
    const n = ctx.sampleRate * 2;
    const b = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = b.getChannelData(0);
    if (!crackle) {
      for (let i = 0; i < n; i++) d[i] = rnd() * 2 - 1;
      return b;
    }
    // 타닥거림: 드문드문 짧게 터지는 잡음 알갱이
    for (let i = 0; i < n; i++) {
      if (rnd() < 0.0016) {
        const amp = 0.35 + rnd() * 0.65;
        const len = 20 + ((rnd() * 70) | 0);
        for (let k = 0; k < len && i + k < n; k++) d[i + k] = amp * Math.exp(-k / (len * 0.3)) * (rnd() * 2 - 1);
        i += len;
      }
    }
    return b;
  }

  function makeIR(ctx, sec) {
    const sr = ctx.sampleRate;
    const n = (sr * sec) | 0;
    const pre = (sr * 0.012) | 0;
    const b = ctx.createBuffer(2, n, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      let lp = 0;
      for (let i = pre; i < n; i++) {
        const x = i / n;
        const k = 0.25 + 0.65 * x; // 꼬리로 갈수록 어두워짐
        lp = lp * k + (rnd() * 2 - 1) * (1 - k);
        d[i] = lp * Math.pow(1 - x, 2.4);
      }
    }
    return b;
  }

  function build(ctx) {
    const e = { ctx };
    const g = () => ctx.createGain();
    e.master = g(); e.sBus = g(); e.mBus = g(); e.sRev = g(); e.mRev = g(); e.revIn = g();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -20; comp.knee.value = 12; comp.ratio.value = 2.5;
    comp.attack.value = 0.006; comp.release.value = 0.25;
    const lim = ctx.createDynamicsCompressor();
    lim.threshold.value = -6; lim.knee.value = 2; lim.ratio.value = 20;
    lim.attack.value = 0.001; lim.release.value = 0.12;
    const clip = ctx.createWaveShaper();
    clip.curve = CURVE || (CURVE = makeCurve());
    e.sBus.connect(e.master); e.mBus.connect(e.master);
    e.sRev.connect(e.revIn); e.mRev.connect(e.revIn);
    e.revIn.gain.value = 0.55;
    try {
      const rv = ctx.createConvolver();
      rv.buffer = makeIR(ctx, 2.6);
      e.revIn.connect(rv); rv.connect(e.master);
    } catch (err) { /* 잔향 없이 진행 */ }
    e.master.connect(comp); comp.connect(lim); lim.connect(clip); clip.connect(ctx.destination);
    e.noise = makeNoise(ctx, false);
    e.crackle = makeNoise(ctx, true);
    return e;
  }

  function applyVol(e, instant) {
    if (!e) return;
    const now = e.ctx.currentTime;
    const set = (p, v) => { if (instant) p.value = v; else { p.cancelScheduledValues(now); p.setTargetAtTime(v, now, 0.04); } };
    set(e.master.gain, muted ? 0 : vol.master * 0.5);
    set(e.sBus.gain, vol.sfx); set(e.sRev.gain, vol.sfx);
    set(e.mBus.gain, vol.music * 0.62); set(e.mRev.gain, vol.music * 0.62);
  }

  /* =========================================================
   * 합성 도우미: tone(발진기) · noise(잡음) · fm(종소리)
   * 공통 옵션: t(절대 시각) at(T0 기준 지연) v(크기) a(어택) d(길이) r(있으면 지속음, 릴리스 길이)
   *           fl/ff/ffa/ff2/fa/q(필터 종류·시작·어택 목표·끝·필터 어택·Q) pan
   * ========================================================= */
  function env(p, t, v, a, d, r) {
    p.setValueAtTime(0, t);
    p.linearRampToValueAtTime(v, t + a);
    if (r && d - r > a) p.setValueAtTime(v, t + d - r);
    p.exponentialRampToValueAtTime(0.0001, t + d);
  }

  function filt(o, t, d) {
    const b = X.ctx.createBiquadFilter();
    b.type = o.fl;
    b.Q.value = o.q != null ? o.q : 0.7;
    b.frequency.setValueAtTime(o.ff, t);
    if (o.ffa) b.frequency.exponentialRampToValueAtTime(o.ffa, t + (o.fa || o.a || 0.01));
    if (o.ff2) b.frequency.exponentialRampToValueAtTime(o.ff2, t + d);
    return b;
  }

  function route(g, pan) {
    if (pan && X.ctx.createStereoPanner) {
      const p = X.ctx.createStereoPanner();
      p.pan.value = clamp(pan, -1, 1);
      g.connect(p); p.connect(D);
    } else g.connect(D);
  }

  function tone(o) {
    const c = X.ctx;
    const t = (o.t != null ? o.t : T0) + (o.at || 0);
    const a = o.a || 0.004;
    const d = Math.max(o.d, a + 0.01);
    const f = Math.max(8, o.f);
    const stop = t + d + 0.02;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(f, t);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(Math.max(8, o.f2), t + (o.slide || d));
    if (o.det) osc.detune.value = o.det;
    if (o.vib) { // 비브라토: 살짝 늦게 들어오게
      const l = c.createOscillator();
      const lg = c.createGain();
      l.frequency.value = o.vibr || 5.2;
      lg.gain.setValueAtTime(0, t);
      lg.gain.linearRampToValueAtTime(f * o.vib, t + Math.min(0.3, d * 0.5));
      l.connect(lg); lg.connect(osc.frequency);
      l.start(t); l.stop(stop);
    }
    env(g.gain, t, Math.max(1e-4, o.v), a, d, o.r);
    let n = osc;
    if (o.fl) { const b = filt(o, t, d); osc.connect(b); n = b; }
    n.connect(g);
    route(g, o.pan);
    osc.start(t); osc.stop(stop);
    if (stop > END) END = stop;
  }

  function noise(o) {
    const c = X.ctx;
    const t = (o.t != null ? o.t : T0) + (o.at || 0);
    const a = o.a || 0.003;
    const d = Math.max(o.d, a + 0.01);
    const stop = t + d + 0.02;
    const s = c.createBufferSource();
    const g = c.createGain();
    s.buffer = o.buf === 'c' ? X.crackle : X.noise;
    s.loop = true;
    env(g.gain, t, Math.max(1e-4, o.v), a, d, o.r);
    let n = s;
    if (o.fl) { const b = filt(o, t, d); s.connect(b); n = b; }
    n.connect(g);
    route(g, o.pan);
    s.start(t, rnd() * 1.5); s.stop(stop);
    if (stop > END) END = stop;
  }

  function fm(o) {
    const c = X.ctx;
    const t = (o.t != null ? o.t : T0) + (o.at || 0);
    const d = o.d;
    const f = o.f;
    const stop = t + d + 0.02;
    const car = c.createOscillator();
    const mod = c.createOscillator();
    const mg = c.createGain();
    const g = c.createGain();
    car.frequency.setValueAtTime(f, t);
    mod.frequency.setValueAtTime(f * o.ratio, t);
    if (o.f2) {
      car.frequency.exponentialRampToValueAtTime(o.f2, t + d);
      mod.frequency.exponentialRampToValueAtTime(o.f2 * o.ratio, t + d);
    }
    const idx = f * (o.idx || 1);
    mg.gain.setValueAtTime(idx, t);
    mg.gain.exponentialRampToValueAtTime(Math.max(1, idx * 0.08), t + d * 0.7);
    mod.connect(mg); mg.connect(car.frequency);
    env(g.gain, t, Math.max(1e-4, o.v), o.a || 0.002, d);
    car.connect(g);
    route(g, o.pan);
    car.start(t); mod.start(t); car.stop(stop); mod.stop(stop);
    if (stop > END) END = stop;
  }

  /* =========================================================
   * 악기 (f: 주파수, t: 시각, d: 음 길이(초), v: 세기)
   * ========================================================= */
  const TOLL = [[0.5, 0.6, 5], [1, 1, 3.6], [1.19, 0.4, 2.2], [1.5, 0.3, 1.8], [2, 0.5, 1.6], [2.66, 0.2, 0.9], [3.02, 0.15, 0.7]];
  const INST = {
    flute(f, t, d, v) {
      tone({ t, f, v: v * 0.4, a: 0.06, d: d + 0.15, r: 0.15, vib: 0.006 });
      tone({ t, f: f * 2, v: v * 0.06, a: 0.08, d: d + 0.1, r: 0.1 });
      noise({ t, fl: 'bandpass', ff: Math.min(f * 3, 9000), q: 1.5, v: v * 0.05, a: 0.02, d: 0.12 });
    },
    recorder(f, t, d, v) {
      tone({ t, f, type: 'triangle', v: v * 0.38, a: 0.03, d: d + 0.08, r: 0.08, vib: 0.003 });
      noise({ t, fl: 'bandpass', ff: Math.min(f * 2.5, 9000), q: 2, v: v * 0.04, a: 0.01, d: 0.06 });
    },
    ocarina(f, t, d, v) {
      tone({ t, f, v: v * 0.42, a: 0.08, d: d + 0.25, r: 0.25, vib: 0.004 });
      tone({ t, f: f * 3, v: v * 0.025, a: 0.1, d: d + 0.1, r: 0.1 });
    },
    reed(f, t, d, v) {
      tone({ t, f, type: 'square', v: v * 0.15, a: 0.04, d: d + 0.1, r: 0.1, fl: 'lowpass', ff: Math.min(f * 3.2, 3200), q: 0.6, vib: 0.003 });
    },
    oboe(f, t, d, v) {
      tone({ t, f, type: 'sawtooth', v: v * 0.14, a: 0.035, d: d + 0.08, r: 0.08, fl: 'lowpass', ff: Math.min(f * 3, 2400), q: 4, vib: 0.005 });
    },
    horn(f, t, d, v) {
      tone({ t, f, type: 'sawtooth', v: v * 0.18, a: 0.07, d: d + 0.15, r: 0.15, fl: 'lowpass', ff: f * 1.2, ffa: f * 3.5, ff2: f * 2, q: 0.8, vib: 0.003 });
      tone({ t, f, type: 'triangle', v: v * 0.2, a: 0.06, d: d + 0.15, r: 0.15 });
    },
    brass(f, t, d, v) {
      for (const det of [-7, 7]) {
        tone({ t, f, det, type: 'sawtooth', v: v * 0.12, a: 0.025, d: d + 0.08, r: 0.08, fl: 'lowpass', ff: 400, ffa: Math.min(f * 7, 5000), ff2: Math.min(f * 3, 2600), fa: 0.05, q: 1 });
      }
    },
    strings(f, t, d, v) {
      for (const det of [-9, 9]) {
        tone({ t, f, det, type: 'sawtooth', v: v * 0.09, a: 0.2, d: d + 0.35, r: 0.35, fl: 'lowpass', ff: Math.min(f * 4, 2400), q: 0.5 });
      }
    },
    cello(f, t, d, v) {
      tone({ t, f, type: 'sawtooth', v: v * 0.18, a: 0.09, d: d + 0.18, r: 0.18, fl: 'lowpass', ff: Math.min(f * 5, 1800), q: 0.7, vib: 0.006 });
      tone({ t, f, v: v * 0.14, a: 0.08, d: d + 0.18, r: 0.18 });
    },
    stacc(f, t, d, v) {
      tone({ t, f, type: 'sawtooth', v: v * 0.18, a: 0.006, d: Math.min(d, 0.22) + 0.06, fl: 'lowpass', ff: Math.min(f * 6, 3000), ff2: Math.min(f * 2, 900), q: 0.8 });
    },
    pad(f, t, d, v) {
      tone({ t, f, det: -8, type: 'triangle', v: v * 0.15, a: Math.min(0.5, d * 0.4), d: d + 0.5, r: 0.5 });
      tone({ t, f, det: 8, type: 'sawtooth', v: v * 0.05, a: Math.min(0.6, d * 0.4), d: d + 0.5, r: 0.5, fl: 'lowpass', ff: 900 });
    },
    wide(f, t, d, v) {
      tone({ t, f, det: -12, type: 'sawtooth', v: v * 0.07, a: 0.9, d: d + 1, r: 1, fl: 'lowpass', ff: 1300, pan: -0.6 });
      tone({ t, f, det: 12, type: 'sawtooth', v: v * 0.07, a: 0.9, d: d + 1, r: 1, fl: 'lowpass', ff: 1300, pan: 0.6 });
    },
    choir(f, t, d, v) {
      tone({ t, f, type: 'sawtooth', v: v * 0.12, a: 0.4, d: d + 0.5, r: 0.5, fl: 'bandpass', ff: 800, q: 0.9, vib: 0.005 });
      tone({ t, f, det: 6, type: 'triangle', v: v * 0.11, a: 0.35, d: d + 0.5, r: 0.5 });
    },
    harp(f, t, d, v) {
      tone({ t, f, type: 'triangle', v: v * 0.38, a: 0.003, d: 1.5 });
      tone({ t, f: f * 2, v: v * 0.09, a: 0.003, d: 0.4 });
    },
    lute(f, t, d, v) {
      tone({ t, f, type: 'sawtooth', v: v * 0.18, a: 0.003, d: 0.7, fl: 'lowpass', ff: Math.min(f * 8, 6000), ff2: f * 1.5, q: 1.5 });
      tone({ t, f, type: 'triangle', v: v * 0.18, a: 0.003, d: 0.5 });
    },
    pizz(f, t, d, v) {
      tone({ t, f, type: 'triangle', v: v * 0.52, a: 0.003, d: 0.32 });
      tone({ t, f, type: 'sawtooth', v: v * 0.1, a: 0.003, d: 0.12, fl: 'lowpass', ff: 1200 });
    },
    bell(f, t, d, v) {
      fm({ t, f, ratio: 3.5, idx: 2, v: v * 0.28, d: 2.8 });
      tone({ t, f: f * 2, v: v * 0.045, d: 0.9 });
    },
    celesta(f, t, d, v) { fm({ t, f, ratio: 4, idx: 0.9, v: v * 0.28, d: 1.2 }); },
    glock(f, t, d, v) {
      tone({ t, f, v: v * 0.33, d: 1.1 });
      tone({ t, f: f * 2.76, v: v * 0.09, d: 0.25 });
    },
    toll(f, t, d, v) { for (const [r, a, dd] of TOLL) tone({ t, f: f * r, v: v * a * 0.2, a: 0.004, d: dd }); },
    marimba(f, t, d, v) {
      tone({ t, f, v: v * 0.42, d: 0.4 });
      tone({ t, f: f * 4, v: v * 0.09, d: 0.06 });
    },
    bass(f, t, d, v) {
      tone({ t, f, v: v * 0.42, a: 0.01, d: d + 0.06, r: 0.06 });
      tone({ t, f, type: 'sawtooth', v: v * 0.15, a: 0.01, d: d + 0.06, r: 0.06, fl: 'lowpass', ff: 600 });
    },
    sbass(f, t, d, v) {
      tone({ t, f, type: 'sawtooth', v: v * 0.2, a: 0.005, d: d + 0.04, fl: 'lowpass', ff: 1400, ff2: 260, q: 2 });
      tone({ t, f: f / 2, v: v * 0.32, a: 0.005, d: d + 0.04 });
    },
    sub(f, t, d, v) { tone({ t, f, v: v * 0.48, a: 0.06, d: d + 0.4, r: 0.4 }); },
  };

  /* 타악기 (t, v, m: 화음 근음 음이름 0~11 — 팀파니가 씀) */
  const fit = (pc, low) => low + ((((pc - low) % 12) + 12) % 12); // low 이상에서 그 음이름의 가장 낮은 음
  const DRUM = {
    kick(t, v) { tone({ t, f: 150, f2: 45, slide: 0.12, v: v * 0.75, d: 0.32 }); noise({ t, fl: 'lowpass', ff: 3000, v: v * 0.1, d: 0.015 }); },
    snare(t, v) { noise({ t, fl: 'bandpass', ff: 1900, q: 0.8, v: v * 0.42, d: 0.18 }); tone({ t, f: 210, f2: 150, type: 'triangle', v: v * 0.28, d: 0.09 }); },
    msnare(t, v) { noise({ t, fl: 'highpass', ff: 1600, v: v * 0.3, d: 0.13 }); tone({ t, f: 250, f2: 190, type: 'triangle', v: v * 0.18, d: 0.06 }); },
    hat(t, v) { noise({ t, fl: 'highpass', ff: 7500, v: v * 0.15, d: 0.045 }); },
    shaker(t, v) { noise({ t, fl: 'bandpass', ff: 6500, q: 1.2, v: v * 0.14, a: 0.012, d: 0.07 }); },
    rim(t, v) { tone({ t, f: 1150, f2: 1000, v: v * 0.2, d: 0.05 }); noise({ t, fl: 'bandpass', ff: 2600, q: 2, v: v * 0.14, d: 0.02 }); },
    tomH(t, v) { tone({ t, f: 230, f2: 150, v: v * 0.45, d: 0.25 }); noise({ t, fl: 'lowpass', ff: 1500, v: v * 0.1, d: 0.05 }); },
    tomL(t, v) { tone({ t, f: 140, f2: 85, v: v * 0.55, d: 0.35 }); noise({ t, fl: 'lowpass', ff: 1000, v: v * 0.11, d: 0.06 }); },
    taiko(t, v) {
      tone({ t, f: 95, f2: 48, slide: 0.3, v: v * 0.8, d: 0.6 });
      noise({ t, fl: 'lowpass', ff: 700, v: v * 0.28, d: 0.25 });
      tone({ t, f: 190, f2: 100, type: 'triangle', v: v * 0.14, d: 0.07 });
    },
    frame(t, v) { tone({ t, f: 115, f2: 80, v: v * 0.42, d: 0.3 }); noise({ t, fl: 'bandpass', ff: 1300, q: 1, v: v * 0.13, d: 0.05 }); },
    timp(t, v, m) {
      const f = M(fit(m == null ? 7 : m, 40));
      tone({ t, f: f * 1.02, f2: f, slide: 0.08, v: v * 0.48, a: 0.005, d: 1.4 });
      tone({ t, f: f * 1.5, v: v * 0.1, d: 0.6 });
      noise({ t, fl: 'lowpass', ff: 500, v: v * 0.18, d: 0.12 });
    },
    ting(t, v) { tone({ t, f: 4186, v: v * 0.06, d: 1.0 }); tone({ t, f: 6620, v: v * 0.025, d: 0.6 }); },
    wave(t, v) { // 밀려왔다 빠지는 파도
      noise({ t, fl: 'lowpass', ff: 250, ffa: 1600, ff2: 220, q: 0.4, a: 1.6, d: 4.4, v: v * 0.2, pan: (rnd() - 0.5) * 0.6 });
      noise({ t: t + 1.2, fl: 'bandpass', ff: 2500, ffa: 4200, ff2: 2000, q: 0.7, a: 0.6, d: 2.4, v: v * 0.04, pan: (rnd() - 0.5) * 0.8 });
    },
    wind(t, v) { noise({ t, fl: 'bandpass', ff: 600, ffa: 1400, ff2: 500, q: 4, a: 1.8, d: 4.5, v: v * 0.12, pan: (rnd() - 0.5) * 0.8 }); },
    swell(t, v) { noise({ t, fl: 'highpass', ff: 3000, ffa: 6000, a: 1.2, d: 1.35, v: v * 0.09 }); },
    crash(t, v) { noise({ t, fl: 'highpass', ff: 4000, v: v * 0.15, d: 1.5 }); },
  };

  /* =========================================================
   * 효과음
   * fn(p): p = 음높이 배율.  pri: 1 이상이면 전체 동시 제한을 넘어도 울림.
   * jit: 무작위 음높이 흔들림 폭(기본 0.05).  rev: 잔향 보내기 양.  v: 기본 크기 배율.
   * ========================================================= */
  const FX = {
    // ---- 화면·조작 ----
    click: { jit: 0, pri: 1, fn: (p) => { tone({ type: 'triangle', f: 1250 * p, f2: 880 * p, d: 0.05, v: 0.15 }); noise({ fl: 'highpass', ff: 5000, d: 0.012, v: 0.04 }); } },
    hover: { jit: 0, fn: (p) => { tone({ f: 1900 * p, d: 0.035, v: 0.04 }); } },
    error: { jit: 0, pri: 1, fn: () => {
      tone({ type: 'square', f: 196, f2: 175, d: 0.1, v: 0.08, fl: 'lowpass', ff: 1000 });
      tone({ type: 'square', f: 165, f2: 147, at: 0.12, d: 0.16, v: 0.08, fl: 'lowpass', ff: 900 });
    } },
    dialog: { jit: 0.08, fn: (p) => { tone({ type: 'triangle', f: 640 * p, d: 0.035, a: 0.004, v: 0.045, fl: 'lowpass', ff: 2000 }); } },
    countdown: { jit: 0, pri: 1, fn: (p) => { tone({ f: 1480 * p, d: 0.08, v: 0.12 }); noise({ fl: 'bandpass', ff: 2400, q: 3, d: 0.02, v: 0.1 }); } },

    // ---- 건설·강화·판매 ----
    build: { pri: 1, fn: (p) => {
      tone({ f: 170 * p, f2: 70 * p, d: 0.24, v: 0.38 });
      noise({ fl: 'lowpass', ff: 1500, ff2: 300, d: 0.2, v: 0.2 });
      noise({ fl: 'bandpass', ff: 900, q: 3, at: 0.07, d: 0.04, v: 0.12 });
      tone({ type: 'triangle', f: M(79) * p, at: 0.09, d: 0.2, v: 0.1 });
      tone({ type: 'triangle', f: M(86) * p, at: 0.16, d: 0.35, v: 0.1 });
    } },
    upgrade: { pri: 1, rev: 0.25, fn: (p) => {
      tone({ f: 160 * p, f2: 100 * p, d: 0.16, v: 0.24 });
      [0, 4, 7, 12].forEach((s, i) => fm({ f: M(72 + s) * p, ratio: 4, idx: 0.8, at: 0.03 + i * 0.055, d: 0.6, v: 0.1 }));
      noise({ fl: 'highpass', ff: 6000, at: 0.1, a: 0.1, d: 0.45, v: 0.035 });
    } },
    branch: { pri: 1, rev: 0.35, fn: (p) => {
      tone({ type: 'sawtooth', f: M(43) * p, d: 0.9, a: 0.3, v: 0.1, fl: 'lowpass', ff: 200, ff2: 1600 });
      [0, 4, 7, 11, 14, 18].forEach((s, i) => fm({ f: M(67 + s) * p, ratio: 3.5, idx: 1.1, at: i * 0.06, d: 1.0, v: 0.08 }));
      noise({ fl: 'highpass', ff: 5000, a: 0.3, d: 0.8, v: 0.04 });
      tone({ f: 130 * p, f2: 50 * p, at: 0.36, d: 0.4, v: 0.36 });
      noise({ fl: 'lowpass', ff: 900, ff2: 150, at: 0.36, d: 0.3, v: 0.14 });
    } },
    sell: { pri: 1, fn: (p) => {
      [88, 84, 79].forEach((m, i) => {
        tone({ f: M(m) * p, at: i * 0.06, d: 0.18, v: 0.09 });
        tone({ type: 'square', f: M(m + 12) * p, at: i * 0.06, d: 0.04, v: 0.015 });
      });
      noise({ fl: 'bandpass', ff: 3200, ff2: 700, q: 1.2, d: 0.28, v: 0.08 });
    } },

    // ---- 진행 ----
    wave: { pri: 2, rev: 0.3, fn: (p) => {
      DRUM.taiko(T0, 0.8); DRUM.taiko(T0 + 0.3, 0.6);
      INST.horn(M(55) * p, T0, 0.24, 1);
      INST.horn(M(62) * p, T0 + 0.3, 0.7, 1.1);
      INST.horn(M(55) * p, T0 + 0.3, 0.7, 0.6);
    } },
    leak: { pri: 2, rev: 0.2, fn: (p) => {
      noise({ fl: 'lowpass', ff: 3000, ff2: 180, d: 0.5, v: 0.24 });
      tone({ type: 'triangle', f: M(73) * p, d: 0.22, v: 0.15 });
      tone({ type: 'triangle', f: M(67) * p, at: 0.13, d: 0.55, v: 0.15 });
      tone({ f: 120, f2: 50, d: 0.4, v: 0.3 });
    } },
    win: { pri: 2, rev: 0.35, fn: (p) => {
      [72, 76, 79, 84].forEach((m, i) => INST.harp(M(m) * p, T0 + i * 0.07, 1, 0.6));
      fm({ f: M(88) * p, ratio: 4, idx: 0.7, at: 0.28, d: 1.2, v: 0.1 });
      INST.brass(M(60) * p, T0 + 0.28, 0.7, 0.6);
      INST.brass(M(67) * p, T0 + 0.28, 0.7, 0.5);
    } },
    lose: { pri: 2, rev: 0.3, fn: (p) => {
      tone({ type: 'sawtooth', f: M(55) * p, f2: M(43) * p, d: 1.0, v: 0.13, fl: 'lowpass', ff: 1400, ff2: 250 });
      tone({ type: 'sawtooth', f: M(58) * p, f2: M(46) * p, det: 8, d: 1.0, v: 0.1, fl: 'lowpass', ff: 1200, ff2: 250 });
      tone({ f: 90, f2: 35, d: 0.9, v: 0.38 });
      noise({ fl: 'lowpass', ff: 800, ff2: 100, d: 0.8, v: 0.18 });
    } },
    star: { pri: 1, rev: 0.35, jit: 0, fn: (p) => {
      fm({ f: M(88) * p, ratio: 4, idx: 0.6, d: 0.7, v: 0.13 });
      tone({ f: M(95) * p, at: 0.04, d: 0.4, v: 0.05 });
      noise({ fl: 'highpass', ff: 7000, d: 0.3, v: 0.04 });
    } },
    unlock: { pri: 2, rev: 0.4, fn: (p) => {
      tone({ f: 400 * p, f2: 1600 * p, d: 0.35, a: 0.05, v: 0.08 });
      [84, 88, 91, 96].forEach((m, i) => fm({ f: M(m) * p, ratio: 4, idx: 0.7, at: 0.25 + i * 0.04, d: 1.0, v: 0.08 }));
      noise({ fl: 'highpass', ff: 5000, a: 0.2, d: 0.9, v: 0.05 });
    } },
    taskDone: { pri: 2, rev: 0.35, fn: (p) => {
      [76, 80, 83, 88].forEach((m, i) => fm({ f: M(m) * p, ratio: 4, idx: 0.6, at: i * 0.075, d: 0.7, v: 0.09 }));
    } },
    resonance: { pri: 1, rev: 0.4, fn: (p) => { // 연결이 이어지는 두 음(완전5도)
      fm({ f: M(79) * p, ratio: 4, idx: 0.7, d: 0.9, v: 0.11 });
      fm({ f: M(86) * p, ratio: 4, idx: 0.5, at: 0.09, d: 1.1, v: 0.11 });
      tone({ f: M(98) * p, at: 0.09, d: 0.5, v: 0.02 });
    } },
    gold: { fn: (p) => {
      tone({ f: 1976 * p, d: 0.12, v: 0.07 });
      tone({ f: 2637 * p, at: 0.05, d: 0.22, v: 0.07 });
      tone({ type: 'square', f: 5274 * p, at: 0.05, d: 0.04, v: 0.012 });
    } },

    // ---- 영웅 ----
    heroDown: { pri: 2, rev: 0.2, fn: (p) => {
      [67, 63, 60].forEach((m, i) => tone({ type: 'triangle', f: M(m) * p, at: i * 0.13, d: 0.4 + i * 0.15, v: 0.14 }));
      tone({ f: 110, f2: 45, at: 0.05, d: 0.45, v: 0.28 });
      noise({ fl: 'lowpass', ff: 1200, ff2: 200, d: 0.4, v: 0.13 });
    } },
    heroRevive: { pri: 2, rev: 0.4, fn: (p) => {
      [60, 67, 72, 76].forEach((m, i) => fm({ f: M(m) * p, ratio: 2, idx: 0.6, at: i * 0.08, d: 0.8, v: 0.1 }));
      noise({ fl: 'highpass', ff: 4000, a: 0.35, d: 0.6, v: 0.05 });
      tone({ f: 200 * p, f2: 600 * p, d: 0.4, a: 0.2, v: 0.06 });
    } },
    heroLevel: { pri: 2, rev: 0.3, fn: (p) => {
      [67, 72, 76].forEach((m, i) => INST.brass(M(m) * p, T0 + i * 0.08, 0.1, 0.8));
      INST.brass(M(79) * p, T0 + 0.24, 0.5, 0.9);
      INST.brass(M(72) * p, T0 + 0.24, 0.5, 0.6);
      [84, 88, 91].forEach((m, i) => fm({ f: M(m) * p, ratio: 4, idx: 0.5, at: 0.3 + i * 0.05, d: 0.5, v: 0.05 }));
    } },
    heroSkill: { pri: 1, rev: 0.25, fn: (p) => {
      noise({ fl: 'bandpass', ff: 400, ff2: 3500, q: 1.5, d: 0.35, a: 0.15, v: 0.17 });
      for (const det of [-10, 10]) tone({ type: 'sawtooth', f: M(64) * p, det, at: 0.12, d: 0.45, a: 0.05, v: 0.075, fl: 'lowpass', ff: 500, ffa: 4000, ff2: 900 });
      tone({ f: M(76) * p, at: 0.12, d: 0.5, v: 0.08 });
    } },
    heroAttack: { fn: (p) => {
      noise({ fl: 'bandpass', ff: 1000 * p, ff2: 3600 * p, q: 1.3, d: 0.1, v: 0.12 });
      tone({ f: 170 * p, f2: 80 * p, at: 0.04, d: 0.09, v: 0.17 });
    } },

    // ---- 보스·위험 ----
    bossAppear: { pri: 2, rev: 0.4, fn: (p) => {
      tone({ type: 'sawtooth', f: 55 * p, d: 2.8, a: 0.5, v: 0.17, fl: 'lowpass', ff: 150, ffa: 500, ff2: 120 });
      tone({ type: 'sawtooth', f: 58.3 * p, d: 2.8, a: 0.6, v: 0.12, fl: 'lowpass', ff: 150, ffa: 450, ff2: 120 });
      noise({ fl: 'lowpass', ff: 250, d: 2.4, a: 0.4, v: 0.24 });
      INST.toll(65.4 * p, T0 + 0.05, 3, 0.9);
      DRUM.taiko(T0, 1);
    } },
    bossPhase: { pri: 2, rev: 0.35, fn: (p) => {
      tone({ type: 'sawtooth', f: 220 * p, f2: 55 * p, d: 0.9, v: 0.15, fl: 'lowpass', ff: 1800, ff2: 300 });
      tone({ type: 'sawtooth', f: 233 * p, f2: 52 * p, d: 0.9, v: 0.11, fl: 'lowpass', ff: 1500, ff2: 300 });
      DRUM.crash(T0, 0.9); DRUM.taiko(T0, 1);
      INST.toll(98 * p, T0, 2, 0.6);
    } },
    bossWarn: { pri: 2, jit: 0, fn: () => {
      for (const at of [0, 0.28]) {
        tone({ type: 'square', f: 466, at, d: 0.24, a: 0.02, fa: 0.1, v: 0.075, fl: 'lowpass', ff: 400, ffa: 2400, ff2: 500, q: 4 });
        tone({ type: 'square', f: 440, at, d: 0.24, a: 0.02, fa: 0.1, v: 0.055, fl: 'lowpass', ff: 400, ffa: 2000, ff2: 500, q: 4 });
      }
    } },
    towerDisabled: { fn: (p) => {
      tone({ type: 'square', f: 900 * p, f2: 110 * p, d: 0.35, v: 0.06, fl: 'lowpass', ff: 2200 });
      noise({ buf: 'c', fl: 'highpass', ff: 2000, d: 0.35, v: 0.32 });
    } },
    shieldBreak: { rev: 0.2, fn: (p) => {
      for (let i = 0; i < 7; i++) tone({ f: (2400 + rnd() * 3600) * p, at: rnd() * 0.06, d: 0.08 + rnd() * 0.2, v: 0.04 });
      noise({ fl: 'highpass', ff: 3500, d: 0.25, v: 0.15 });
      tone({ type: 'triangle', f: 500 * p, f2: 250 * p, d: 0.12, v: 0.1 });
    } },
    kill: { fn: (p) => { noise({ fl: 'bandpass', ff: 1300 * p, q: 1.2, d: 0.06, v: 0.1 }); tone({ f: 520 * p, f2: 240 * p, d: 0.08, v: 0.09 }); } },
    killBig: { fn: (p) => {
      tone({ f: 120 * p, f2: 42 * p, d: 0.4, v: 0.4 });
      noise({ fl: 'lowpass', ff: 2200, ff2: 180, d: 0.45, v: 0.24 });
      tone({ f: 1760 * p, at: 0.05, d: 0.25, v: 0.04 });
    } },
    enemyShot: { fn: (p) => {
      noise({ fl: 'bandpass', ff: 900 * p, q: 1.5, d: 0.08, v: 0.1 });
      tone({ type: 'square', f: 310 * p, f2: 200 * p, d: 0.06, v: 0.035, fl: 'lowpass', ff: 900 });
    } },

    // ---- 탑 공격 ----
    arrow: { fn: (p) => {
      tone({ type: 'triangle', f: 720 * p, f2: 430 * p, d: 0.05, v: 0.08 });
      noise({ fl: 'bandpass', ff: 2200 * p, ff2: 5200 * p, q: 1.4, d: 0.09, v: 0.07 });
    } },
    mortar: { fn: (p) => { tone({ f: 130 * p, f2: 55 * p, d: 0.2, v: 0.28 }); noise({ fl: 'lowpass', ff: 900, ff2: 250, d: 0.15, v: 0.15 }); } },
    explosion: { rev: 0.15, fn: (p) => {
      noise({ fl: 'lowpass', ff: 1800 * p, ff2: 110, d: 0.65, v: 0.36 });
      tone({ f: 90 * p, f2: 32 * p, d: 0.5, v: 0.4 });
      noise({ buf: 'c', fl: 'highpass', ff: 1500, at: 0.04, d: 0.5, v: 0.28 });
    } },
    bolt: { fn: (p) => { fm({ f: 1300 * p, f2: 650 * p, ratio: 2, idx: 1, d: 0.13, v: 0.08 }); noise({ fl: 'highpass', ff: 4500, d: 0.05, v: 0.03 }); } },
    ballista: { fn: (p) => {
      tone({ type: 'sawtooth', f: 160 * p, f2: 105 * p, d: 0.15, v: 0.15, fl: 'lowpass', ff: 1000 });
      noise({ fl: 'bandpass', ff: 1800, q: 2, d: 0.03, v: 0.13 });
      noise({ fl: 'bandpass', ff: 800, ff2: 2600, q: 1.3, at: 0.03, d: 0.16, v: 0.08 });
    } },
    bell: { rev: 0.35, fn: (p) => {
      fm({ f: 1319 * p, ratio: 3.5, idx: 1.5, d: 1.1, v: 0.1 });
      fm({ f: 1976 * p, ratio: 4, idx: 0.5, d: 0.7, v: 0.045 });
      noise({ fl: 'highpass', ff: 7000, d: 0.3, a: 0.02, v: 0.03 });
    } },
    chain: { fn: (p) => {
      for (let i = 0; i < 3; i++) tone({ type: 'sawtooth', f: (1500 + rnd() * 1500) * p, f2: (300 + rnd() * 300) * p, at: i * 0.035, d: 0.045, v: 0.05, fl: 'highpass', ff: 600 });
      noise({ buf: 'c', fl: 'highpass', ff: 3000, d: 0.2, v: 0.32 });
      noise({ fl: 'highpass', ff: 3500, d: 0.16, v: 0.07 });
    } },
    gust: { fn: (p) => { noise({ fl: 'bandpass', ff: 400 * p, ffa: 2400 * p, ff2: 700 * p, q: 1.6, a: 0.08, d: 0.38, v: 0.16 }); } },
    slam: { rev: 0.1, fn: (p) => {
      tone({ f: 95 * p, f2: 38 * p, d: 0.45, v: 0.48 });
      noise({ fl: 'lowpass', ff: 1000, ff2: 120, d: 0.4, v: 0.26 });
      tone({ type: 'triangle', f: 62 * p, d: 0.32, v: 0.12 });
      noise({ fl: 'bandpass', ff: 400, q: 1, at: 0.03, d: 0.25, v: 0.08 });
    } },
    beam: { jit: 0.02, fn: (p) => { // 부드럽게 시작·끝나서 연달아 울려도 이어지는 웅웅거림
      tone({ f: 1047 * p, a: 0.06, d: 0.24, v: 0.05 });
      tone({ f: 1568 * p, det: 6, a: 0.06, d: 0.22, v: 0.03 });
      noise({ fl: 'bandpass', ff: 5000, q: 3, a: 0.06, d: 0.22, v: 0.02 });
    } },
    flash: { rev: 0.3, fn: (p) => {
      for (const m of [84, 88, 91]) tone({ f: M(m) * p, a: 0.01, d: 0.45, v: 0.05 });
      tone({ f: 400 * p, f2: 1600 * p, d: 0.16, v: 0.06 });
      noise({ fl: 'highpass', ff: 6000, d: 0.22, v: 0.07 });
    } },
    hex: { fn: (p) => {
      tone({ type: 'sawtooth', f: 110 * p, a: 0.06, fa: 0.15, d: 0.45, v: 0.1, fl: 'lowpass', ff: 250, ffa: 900, ff2: 200 });
      tone({ type: 'sawtooth', f: 116.5 * p, a: 0.06, fa: 0.15, d: 0.45, v: 0.08, fl: 'lowpass', ff: 250, ffa: 800, ff2: 200 });
      tone({ f: 220 * p, f2: 140 * p, d: 0.4, v: 0.08 });
    } },
    orb: { fn: (p) => { tone({ f: 240 * p, f2: 120 * p, d: 0.42, v: 0.15, vib: 0.06, vibr: 13 }); noise({ fl: 'lowpass', ff: 450, d: 0.3, v: 0.07 }); } },
    trap: { fn: (p) => {
      noise({ fl: 'bandpass', ff: 2000, q: 2, d: 0.03, v: 0.2 });
      tone({ type: 'triangle', f: 300 * p, f2: 90 * p, d: 0.15, v: 0.19 });
      tone({ type: 'sawtooth', f: 70 * p, d: 0.3, v: 0.08, fl: 'lowpass', ff: 260 });
    } },

    // ---- 원소별 명중 ----
    hit_fire: { fn: (p) => { noise({ buf: 'c', fl: 'highpass', ff: 1400, d: 0.2, v: 0.36 }); noise({ fl: 'bandpass', ff: 900 * p, ff2: 300, q: 0.8, d: 0.16, v: 0.08 }); } },
    hit_frost: { fn: (p) => {
      tone({ f: 3100 * p, d: 0.13, v: 0.055 });
      tone({ f: 4650 * p, d: 0.08, v: 0.035 });
      tone({ f: 2170 * p, d: 0.06, v: 0.03 });
      noise({ fl: 'highpass', ff: 6500, d: 0.02, v: 0.05 });
    } },
    hit_storm: { fn: (p) => {
      tone({ type: 'square', f: 1800 * p, f2: 500 * p, d: 0.06, v: 0.04, fl: 'lowpass', ff: 4000 });
      noise({ fl: 'highpass', ff: 2500, d: 0.07, v: 0.08 });
      noise({ buf: 'c', fl: 'highpass', ff: 3000, d: 0.06, v: 0.24 });
    } },
    hit_earth: { fn: (p) => { tone({ f: 130 * p, f2: 60 * p, d: 0.13, v: 0.27 }); noise({ fl: 'lowpass', ff: 700, d: 0.08, v: 0.13 }); } },
    hit_light: { fn: (p) => { tone({ f: 1760 * p, d: 0.26, v: 0.055 }); tone({ f: 2637 * p, d: 0.18, v: 0.032 }); } },
    hit_dark: { fn: (p) => {
      tone({ f: 88 * p, a: 0.015, d: 0.24, v: 0.14 });
      tone({ type: 'sawtooth', f: 92 * p, a: 0.015, d: 0.22, v: 0.07, fl: 'lowpass', ff: 260 });
    } },
  };

  /* =========================================================
   * 음악 — 모두 이 게임을 위해 새로 쓴 곡입니다.
   * 표기: 선율은 한 칸에 한 토큰(음이름+옥타브, '-' 앞 음 늘임, '.' 쉼, '|' 마디 구분은 무시).
   *       ch는 마디마다 화음 하나('G,A'처럼 쉼표로 마디를 반씩 나눔).
   * parts: mel(선율) · pad(화음 지속) · hold(화음 한 음 지속) · bass · chord(화음 찍기) · arp(분산화음) · drum
   *   pat 문자: bass r=근음(분수화음이면 베이스음) 5=5도 o=옥타브 3=3도 / chord c / arp 0~5=화음 음 번호
   *            drum x=세게 o=중간 g=여리게.  pat 배열은 마디마다 돌아가며 씀.  only: 해당 구간에서만.
   * ========================================================= */
  const TR = {
    // 타이틀 — D장조, 4/4, 80bpm. 호른 선율 + 하프 분산화음 + 현악 패드, 후반에 글로켄슈필이 겹침.
    title: {
      bpm: 80, beats: 4, sub: 2, rev: 0.35, vol: 0.93,
      sec: {
        A: { ch: 'D A/C# Bm F#m G D/F# Em7 Asus4,A',
          mel: 'f#4 - - - a4 - d5 - | e5 - - - - - c#5 - | d5 - - - c#5 b4 a4 b4 | c#5 - - - - - . . | b4 - - - d5 - g5 - | f#5 - - - e5 - d5 - | e5 - - - d5 - b4 - | d5 - - - c#5 - - -' },
        B: { ch: 'G A F#m Bm Em7 F#m G Asus4,A',
          mel: 'b4 - d5 - g5 - - - | c#5 - - - e5 - a5 - | a5 - - - - - f#5 - | f#5 - - - d5 - b4 - | g5 - - - f#5 - e5 - | c#5 - - - a4 - c#5 - | d5 - - - e5 - g5 - | e5 - d5 - c#5 - - -' },
      },
      form: 'AB',
      parts: [
        { t: 'mel', inst: 'horn', v: 0.75 },
        { t: 'mel', inst: 'glock', oct: 12, v: 0.3, only: 'B' },
        { t: 'arp', inst: 'harp', low: 50, pat: ['01234321'], v: 0.32 },
        { t: 'pad', inst: 'strings', low: 50, v: 0.3 },
        { t: 'bass', inst: 'bass', low: 38, pat: ['r.......'], v: 0.5 },
        { t: 'drum', k: 'timp', pat: ['x.......', '........', '........', '....o...'], v: 0.6 },
      ],
    },

    // 월드 지도 — G 믹솔리디안, 6/8(점4분 66bpm). 리코더 선율 + 류트 분산화음 + 피치카토 베이스 + 프레임 드럼.
    worldmap: {
      bpm: 66, beats: 2, sub: 3, rev: 0.22, vol: 1.15,
      sec: {
        A: { ch: 'G F C G Em Am F G',
          mel: 'd5 - b4 d5 - g5 | f5 - - c5 - a4 | c5 - e5 g5 - e5 | d5 - - - - . | b4 - e5 g5 - e5 | e5 - c5 a4 - c5 | f5 - e5 d5 - c5 | g4 - b4 d5 - -' },
        B: { ch: 'C Em F G Am Em Dm F',
          mel: 'e5 - - g5 - e5 | b4 - - e5 - g5 | a5 - g5 f5 - c5 | d5 - - b4 - - | c5 - e5 a5 - e5 | g5 - - e5 - b4 | f5 - - d5 - a4 | a4 - c5 f5 - e5' },
      },
      form: 'ABA',
      parts: [
        { t: 'mel', inst: 'recorder', v: 0.8 },
        { t: 'arp', inst: 'lute', low: 55, pat: ['012121', '012132'], v: 0.3 },
        { t: 'bass', inst: 'pizz', low: 40, pat: ['r..5..'], v: 0.65 },
        { t: 'drum', k: 'frame', pat: ['x....o', 'x..o..'], v: 0.65 },
        { t: 'drum', k: 'shaker', pat: ['xooxoo'], v: 0.45 },
      ],
    },

    // 1지역 들판 — F장조 왈츠, 3/4, 160bpm. 플루트 선율 + 클라리넷 대선율 + 쿵짝짝(피치카토·하프) + 셰이커.
    meadow: {
      bpm: 160, beats: 3, sub: 2, rev: 0.25, vol: 0.86,
      sec: {
        A: { ch: 'F F C/E C Dm Bb C7 F',
          mel: 'c5 - f5 - a5 - | c6 - - - a5 - | g5 - e5 - c5 - | g5 - - - f5 e5 | d5 - f5 - a5 - | bb5 - a5 - g5 - | g5 - - - e5 - | f5 - - - - .' },
        C: { ch: 'F F C/E C Dm Bb C7 F',
          mel: 'c5 - f5 - a5 - | c6 - d6 c6 a5 - | g5 - e5 - c5 - | g5 - - - - . | d5 - f5 - a5 - | d6 - c6 - bb5 - | g5 - bb5 - e5 - | f5 - - - - .' },
        B: { ch: 'Bb F/A Gm C Bb F/A G7 C7',
          mel: 'f5 - - - bb5 - | a5 - - - f5 - | g5 - bb5 - d6 - | c6 - - - - - | d6 - c6 - bb5 - | c6 - a5 - f5 - | g5 - b5 - d6 - | c6 - bb5 - g5 -' },
      },
      form: 'ACBA',
      parts: [
        { t: 'mel', inst: 'flute', v: 0.9 },
        { t: 'hold', inst: 'reed', low: 57, idx: 1, v: 0.38, only: 'CB' },
        { t: 'bass', inst: 'pizz', low: 40, pat: ['r.....', '5.....'], v: 0.75 },
        { t: 'chord', inst: 'harp', low: 57, n: 3, pat: ['..c.c.'], v: 0.28 },
        { t: 'drum', k: 'shaker', pat: ['..o.o.'], v: 0.6 },
        { t: 'drum', k: 'ting', pat: ['x.....', '......', '......', '......'], v: 0.5 },
      ],
    },

    // 2지역 고개 — A 리디안, 느린 3/4, 76bpm. 맑은 종(FM) 선율 + 첼레스타 분산화음 + 현악 패드 + 바람.
    frost: {
      bpm: 76, beats: 3, sub: 2, rev: 0.5, vol: 1.1,
      sec: {
        A: { ch: 'Amaj7 B/A Amaj7 B/A F#m7 C#m7 Bsus4 B',
          mel: 'e5 - - - a5 - | d#6 - - - c#6 b5 | c#6 - - - - - | . . f#5 - b5 - | a5 - c#6 - e6 - | d#6 - - - b5 - | e5 - f#5 - b5 - | d#6 - - - - -' },
        B: { ch: 'F#m7 G#m7 Amaj7 B C#m7 G#m7 B/A Amaj7',
          mel: 'c#6 - - - a5 - | d#6 - - - b5 - | c#6 - - - e6 - | f#6 - - - d#6 - | e6 - d#6 c#6 b5 - | b5 - - - g#5 - | f#5 - b5 - d#6 - | g#5 - - - - -' },
      },
      form: 'AB',
      parts: [
        { t: 'mel', inst: 'bell', v: 0.85 },
        { t: 'arp', inst: 'celesta', low: 57, pat: ['0.1.2.', '3.2.1.'], v: 0.3 },
        { t: 'pad', inst: 'strings', low: 52, n: 4, v: 0.26 },
        { t: 'bass', inst: 'sub', low: 37, pat: ['r.....'], v: 0.55 },
        { t: 'drum', k: 'wind', pat: ['x.....', '......', '......', '......'], v: 0.8 },
        { t: 'drum', k: 'ting', pat: ['......', '...o..'], v: 0.35 },
      ],
    },

    // 3지역 협곡 — D 도리안, 4/4, 112bpm. 타이코·톰·셰이커 + 낮은 현 오스티나토, 첼로 선율 → 오보에 선율, 마림바.
    canyon: {
      bpm: 112, beats: 4, sub: 2, rev: 0.18, vol: 1.5,
      sec: {
        I: { ch: 'Dm Dm C Dm' },
        A: { ch: 'Dm G Dm C F G Em Am',
          mel: 'd4 - - - a3 - d4 e4 | f4 - - - e4 - d4 - | a4 - - - g4 f4 e4 f4 | e4 - - - - - . . | c4 - f4 - a4 - g4 f4 | g4 - - - b4 - a4 g4 | e4 - - - b3 - e4 g4 | a4 - - - - - . .' },
        B: { ch: 'G Am F C G Am Csus4 C',
          mel2: 'b4 - - - d5 - b4 - | c5 - - - a4 - e5 - | f5 - - - e5 - d5 c5 | e5 - - - c5 - - - | d5 - - - b4 - d5 - | e5 - a5 - g5 - e5 - | f5 - - - - - e5 - | e5 - - - - - d5 -' },
      },
      form: 'IAB',
      parts: [
        { t: 'mel', inst: 'cello', v: 0.85 },
        { t: 'mel', line: 'mel2', inst: 'oboe', v: 0.6 },
        { t: 'bass', inst: 'stacc', low: 38, pat: ['r.r5r.ro'], len: 0.5, v: 0.55 },
        { t: 'pad', inst: 'strings', low: 45, v: 0.18, only: 'AB' },
        { t: 'arp', inst: 'marimba', low: 62, pat: ['0.2.1.2.', '0.2.1.23'], v: 0.26, only: 'IB' },
        { t: 'drum', k: 'taiko', pat: ['x..x..x.', 'x..x.xx.'], v: 0.75 },
        { t: 'drum', k: 'tomH', pat: ['..o...o.', '..o..o.o'], v: 0.5 },
        { t: 'drum', k: 'shaker', pat: ['xoxoxoxo'], v: 0.5 },
        { t: 'drum', k: 'rim', pat: ['....x...'], v: 0.6 },
      ],
    },

    // 4지역 해안 — E♭장조, 6/8(점4분 52bpm). 넓게 펼친 화음 패드 + 파도 소리, 하프가 파도처럼 오르내리고 오카리나 선율.
    coast: {
      bpm: 52, beats: 2, sub: 3, rev: 0.45, vol: 0.72,
      sec: {
        A: { ch: 'Ebadd9 Bb/D Cm7 Abmaj7 Ebadd9 Bbsus4 Abmaj7 Bb',
          mel: 'bb4 - - eb5 - f5 | g5 - - - - - | eb5 - - g5 - bb5 | c6 - - bb5 - g5 | bb5 - - - - g5 | eb5 - - f5 - - | eb5 - - c5 - eb5 | d5 - - - - -' },
        B: { ch: 'Abmaj7 Bb/Ab Gm7 Cm7 Fm7 Gm7 Abmaj7 Bbsus4',
          mel: 'c5 - - eb5 - g5 | f5 - - d5 - bb4 | bb4 - - d5 - f5 | g5 - - - - - | ab5 - - c6 - ab5 | bb5 - - - g5 - | eb5 - - c5 - eb5 | f5 - - - - -' },
      },
      form: 'AB',
      parts: [
        { t: 'mel', inst: 'ocarina', v: 0.8 },
        { t: 'pad', inst: 'wide', low: 39, spread: 1, v: 0.4 },
        { t: 'arp', inst: 'harp', low: 51, spread: 1, pat: ['012321', '012323'], v: 0.3 },
        { t: 'bass', inst: 'sub', low: 34, pat: ['r.....'], v: 0.55 },
        { t: 'drum', k: 'wave', pat: ['x.....', '......'], v: 1 },
      ],
    },

    // 5지역 대종 — C단조 느린 행진, 4/4, 76bpm. 큰 종 타종 + 행진 베이스 + 팀파니·행진 스네어, 호른 선율, 합창 패드.
    bell: {
      bpm: 76, beats: 4, sub: 2, rev: 0.4, vol: 0.86,
      sec: {
        A: { ch: 'Cm Ab Eb Bb Fm Cm Dm7b5 G',
          mel: 'c5 - - - g4 - eb4 - | ab4 - - - c5 - eb5 - | eb5 - - - d5 - eb5 - | bb4 - - - - - . . | c5 - - - ab4 - f4 - | g4 - - - c5 - eb5 - | f5 - - - eb5 - d5 - | d5 - - - b4 - - -' },
        B: { ch: 'Ab Eb Fm Cm Ab Bb Gsus4 G',
          mel: 'eb5 - - - c5 - ab4 - | g4 - - - bb4 - eb5 - | f5 - - - c5 - ab4 - | g4 - - - - - . . | ab4 - - - c5 - eb5 - | d5 - - - f5 - d5 - | c5 - - - - - - - | b4 - - - d5 - . .' },
      },
      form: 'AB',
      parts: [
        { t: 'mel', inst: 'horn', v: 0.75 },
        { t: 'bass', inst: 'toll', low: 43, pat: ['r.......'], v: 0.75 },
        { t: 'bass', inst: 'bass', low: 36, pat: ['r.r.5.r.'], len: 0.7, v: 0.6 },
        { t: 'pad', inst: 'choir', low: 55, v: 0.24 },
        { t: 'arp', inst: 'bell', low: 72, pat: ['0...2...', '1...2...'], v: 0.2, only: 'B' },
        { t: 'drum', k: 'timp', pat: ['x...o...'], v: 0.65 },
        { t: 'drum', k: 'msnare', pat: ['g...x.gg', 'g...x.g.'], v: 0.5 },
      ],
    },

    // 보스 — B단조(프리지안 ♭II 섞음), 4/4, 150bpm. 8분음표 신스 베이스, 스타카토 현, 금관 선율, 킥·스네어·톰, 합창.
    boss: {
      bpm: 150, beats: 4, sub: 2, rev: 0.2, vol: 1.45,
      sec: {
        I: { ch: 'Bm C Bm C' },
        A: { ch: 'Bm C Bm A G C F# F#',
          mel: 'b4 - - - f#4 - - - | g4 - - - e4 - - - | f#4 - - - b4 - d5 - | c#5 - - - - - . . | d5 - - - b4 - g4 - | c5 - - - g4 - e4 - | a#4 - - - c#5 - - - | f#4 - - - - - . .' },
        B: { ch: 'G A Bm Bm G A C F#7',
          mel: 'd5 - - - b4 - d5 - | e5 - - - c#5 - e5 - | f#5 - - - - - e5 d5 | b4 - - - - - . . | b4 - - - d5 - g5 - | e5 - - - c#5 - a4 - | e5 - - - c5 - g4 - | a#4 - - - c#5 - e5 -' },
      },
      form: 'IAB',
      parts: [
        { t: 'mel', inst: 'brass', v: 0.75 },
        { t: 'bass', inst: 'sbass', low: 42, pat: ['rrorr5ro'], len: 0.6, v: 0.55 },
        { t: 'arp', inst: 'stacc', low: 59, pat: ['01210121', '02120212'], v: 0.22 },
        { t: 'pad', inst: 'choir', low: 54, v: 0.2, only: 'AB' },
        { t: 'chord', inst: 'brass', low: 59, n: 3, pat: ['c..c..c.', 'c.......'], len: 0.5, v: 0.4, only: 'I' },
        { t: 'drum', k: 'kick', pat: ['x..x..x.', 'x..x.xx.'], v: 0.8 },
        { t: 'drum', k: 'snare', pat: ['..x...x.', '..x...xg'], v: 0.55 },
        { t: 'drum', k: 'hat', pat: ['oxoxoxox'], v: 0.5 },
        { t: 'drum', k: 'tomL', pat: ['........', '........', '........', '....x.xx'], v: 0.6 },
        { t: 'drum', k: 'timp', pat: ['x.......', '........'], v: 0.55 },
      ],
    },

    // 승리 — C장조 금관 팡파르(약 4초, 반복 없음). [박, 음(공백으로 화음), 길이(박), 악기, 세기]
    victory: {
      bpm: 132, rev: 0.35, vol: 1,
      once: [
        [0, 'g4', 0.3, 'brass', 0.7], [0.33, 'c5', 0.3, 'brass', 0.7], [0.67, 'e5', 0.3, 'brass', 0.7],
        [1, 'c5 e5 g5', 1.7, 'brass', 0.55], [1, 'c3', 1.7, 'bass', 0.7], [1, 'g5', 1.5, 'glock', 0.45], [1, 'c', 0, 'timp', 0.8],
        [3, 'f4 a4 c5', 0.45, 'brass', 0.5], [3, 'f2', 0.45, 'bass', 0.65],
        [3.5, 'g4 b4 d5', 0.45, 'brass', 0.55], [3.5, 'g2', 0.45, 'bass', 0.65], [3.5, 'g', 0, 'timp', 0.6],
        [4, 'c5 e5 g5 c6', 3, 'brass', 0.5], [4, 'c2 c3', 3, 'bass', 0.6], [4, 'c', 0, 'timp', 1], [4, '-', 0, 'crash', 0.6],
        [4, 'c6', 1, 'harp', 0.4], [4.12, 'e6', 1, 'harp', 0.4], [4.25, 'g6', 1, 'harp', 0.4], [4.37, 'c7', 1, 'harp', 0.4], [4, 'c6', 2.5, 'glock', 0.4],
      ],
    },

    // 패배 — D단조, 느리게 내려앉는 리드 + 현(약 6초, 반복 없음).
    defeat: {
      bpm: 76, rev: 0.4, vol: 1,
      once: [
        [0, 'a4', 0.9, 'reed', 0.7], [0, 'd3 f3 a3', 2.9, 'strings', 0.6], [0, 'd2', 2.9, 'bass', 0.55],
        [1, 'f4', 0.9, 'reed', 0.7], [2, 'd4', 0.9, 'reed', 0.7],
        [3, 'c#4', 1.4, 'reed', 0.7], [3, 'a2 c#3 e3 g3', 1.4, 'strings', 0.55], [3, 'a1', 1.4, 'bass', 0.55], [3, 'a', 0, 'timp', 0.5],
        [4.5, 'd4', 3, 'reed', 0.6], [4.5, 'd3 f3 a3', 3, 'strings', 0.55], [4.5, 'd2', 3, 'bass', 0.55], [4.5, 'd', 0, 'timp', 0.7], [4.5, 'd5', 2, 'bell', 0.3],
      ],
    },
  };

  /* ---------------- 악보 해석 ---------------- */
  const PC = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
  function note(s) { // 'c#5' → 73, 'bb' → 10(옥타브 없으면 음이름만)
    const m = /^([a-g])(#|b)?(\d)?$/.exec(s);
    if (!m) return null;
    const pc = PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
    return m[3] == null ? (pc + 12) % 12 : 12 * (+m[3] + 1) + pc;
  }
  const QUAL = {
    '': [0, 4, 7], m: [0, 3, 7], 7: [0, 4, 7, 10], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], sus4: [0, 5, 7], sus2: [0, 2, 7],
    add9: [0, 4, 7, 14], m9: [0, 3, 7, 10, 14], dim: [0, 3, 6], m7b5: [0, 3, 6, 10], 6: [0, 4, 7, 9],
  };
  function chord(sym) {
    const m = /^([A-G])([#b]?)([^/]*)(?:\/([A-G][#b]?))?$/.exec(sym) || [];
    const root = note((m[1] || 'C').toLowerCase() + (m[2] || ''));
    return { sym, root, iv: QUAL[m[3] || ''] || QUAL[''], bass: m[4] ? note(m[4].toLowerCase()) : root, bad: !m[1] || !QUAL[m[3] || ''] };
  }
  function voicing(ch, low, n, spread) {
    if (spread) { // 넓게: 근음, 5도, 한 옥타브 위 3도, 7도/9도
      const r = fit(ch.root, low);
      const iv = ch.iv;
      const v = [r, r + iv[2], r + iv[1] + 12, r + (iv[3] != null ? iv[3] + 12 : 24)];
      while (v.length < n) v.push(v[v.length - 4] + 24);
      return v.slice(0, n);
    }
    const pcs = ch.iv.map((i) => (ch.root + i) % 12);
    const v = [];
    for (let m = low; v.length < n; m++) if (pcs.indexOf(m % 12) >= 0) v.push(m);
    return v;
  }

  function compile(tr) {
    if (tr._c) return tr._c;
    const warn = [];
    if (tr.once) {
      const beat = 60 / tr.bpm;
      const list = tr.once.map(([b, ns, len, inst, v]) => ({ t: b * beat, ms: ns.split(' ').map(note), d: len * beat, inst, v }));
      return (tr._c = { once: true, list, warn });
    }
    const sd = 60 / tr.bpm / tr.sub;
    const spb = tr.beats * tr.sub;
    const ok = (p, id) => !p.only || p.only.indexOf(id) >= 0;
    const bars = [];
    const segs = [];
    for (const id of tr.form) {
      tr.sec[id].ch.split(/\s+/).filter(Boolean).forEach((c) => {
        const ps = c.split(',');
        const l = Math.floor(spb / ps.length);
        const b = { id, segs: ps.map((s, k) => ({ s: k * l, l: k === ps.length - 1 ? spb - k * l : l, ch: chord(s) })) };
        b.segs.forEach((sg) => { if (sg.ch.bad) warn.push('화음 ' + sg.ch.sym); segs.push({ at: bars.length * spb + sg.s, l: sg.l, ch: sg.ch, id }); });
        bars.push(b);
      });
    }
    const total = bars.length * spb;
    const ev = [];
    for (let i = 0; i < total; i++) ev.push([]);
    const push = (step, e) => ev[step % total].push(e);
    // 선율
    let off = 0;
    for (const id of tr.form) {
      const s = tr.sec[id];
      const nb = s.ch.split(/\s+/).filter(Boolean).length;
      for (const p of tr.parts) {
        const line = p.t === 'mel' && ok(p, id) && s[p.line || 'mel'];
        if (!line) continue;
        const tk = line.split(/\s+/).filter((x) => x && x !== '|');
        if (tk.length !== nb * spb) warn.push(id + '.' + (p.line || 'mel') + ' 칸 수 ' + tk.length + ' ≠ ' + nb * spb);
        tk.forEach((x, i) => {
          if (x === '-' || x === '.') return;
          let len = 1;
          while (tk[i + len] === '-') len++;
          const m = note(x);
          if (m == null || m < 12) { warn.push(id + ' 음 ' + x); return; }
          push(off * spb + i, { i: p.inst, m: [m + (p.oct || 0)], d: len * sd, v: p.v });
        });
      }
      off += nb;
    }
    // 반주
    for (const p of tr.parts) {
      if (p.t === 'pad' || p.t === 'hold') {
        for (let i = 0; i < segs.length; i++) {
          const sg = segs[i];
          if (!ok(p, sg.id)) continue;
          let l = sg.l;
          while (i + 1 < segs.length && segs[i + 1].ch.sym === sg.ch.sym && ok(p, segs[i + 1].id)) l += segs[++i].l;
          const vs = voicing(sg.ch, p.low, p.t === 'hold' ? (p.idx || 0) + 1 : p.n || (p.spread ? 4 : 3), p.spread);
          push(sg.at, { i: p.inst, m: p.t === 'hold' ? [vs[vs.length - 1]] : vs, d: l * sd, v: p.v });
        }
      } else if (p.t !== 'mel') {
        bars.forEach((b, bi) => {
          if (!ok(p, b.id)) return;
          const pat = p.pat[bi % p.pat.length];
          for (let j = 0; j < spb; j++) {
            const c = pat[j];
            if (!c || c === '.') continue;
            let n = 1;
            while (j + n < spb && (pat[j + n] || '.') === '.') n++;
            let ch = b.segs[0].ch;
            for (const sg of b.segs) if (sg.s <= j) ch = sg.ch;
            const at = bi * spb + j;
            const d = n * sd * (p.len || 1);
            if (p.t === 'drum') push(at, { dr: p.k, m: ch.root, v: p.v * (c === 'x' ? 1 : c === 'o' ? 0.6 : 0.32) });
            else if (p.t === 'bass') {
              const b0 = fit(ch.bass, p.low);
              const m = c === 'o' ? b0 + 12 : c === '5' ? fit(ch.root + 7, b0 + 1) : c === '3' ? fit(ch.root + ch.iv[1], b0 + 1) : b0;
              push(at, { i: p.inst, m: [m], d, v: p.v });
            } else if (p.t === 'chord') push(at, { i: p.inst, m: voicing(ch, p.low, p.n || 3), d, v: p.v });
            else if (p.t === 'arp') push(at, { i: p.inst, m: [voicing(ch, p.low, 6, p.spread)[+c] || p.low], d, v: p.v });
          }
        });
      }
    }
    return (tr._c = { ev, sd, total, warn });
  }

  /* ---------------- 시퀀서 ---------------- */
  function playStep(c, i, t) {
    for (const e of c.ev[i]) {
      if (e.dr) { const fn = DRUM[e.dr]; if (fn) fn(t, e.v, e.m); continue; }
      const fn = INST[e.i];
      if (fn) for (const m of e.m) fn(mtof(m), t, e.d, e.v);
    }
  }

  function makeSeq(e, name, t0) {
    const tr = TR[name];
    const c = compile(tr);
    const ctx = e.ctx;
    const bus = ctx.createGain();
    const send = ctx.createGain();
    const level = tr.vol || 1;
    bus.gain.setValueAtTime(0, ctx.currentTime);
    bus.gain.linearRampToValueAtTime(level, t0 + (c.once ? 0.02 : FADE_IN));
    send.gain.value = tr.rev || 0.25;
    bus.connect(e.mBus); bus.connect(send); send.connect(e.mRev);
    const s = { name, e, c, bus, step: 0, next: t0, once: !!c.once, end: t0 };
    if (s.once && !(e === E && muted)) {
      X = e; D = bus; END = t0;
      for (const ev of c.list) {
        const t = t0 + ev.t;
        if (DRUM[ev.inst]) DRUM[ev.inst](t, ev.v, ev.ms[0]);
        else if (INST[ev.inst]) for (const m of ev.ms) if (m != null && m >= 12) INST[ev.inst](mtof(m), t, ev.d, ev.v);
      }
      s.end = END;
    }
    return s;
  }

  function pump(s, until) {
    const c = s.c;
    const now = s.e.ctx.currentTime;
    if (s.next < now) { // 메인 스레드가 멈췄다 돌아오면 밀린 칸은 건너뜀(몰아서 울리지 않게)
      const k = Math.ceil((now - s.next) / c.sd);
      s.step += k; s.next += k * c.sd;
    }
    X = s.e; D = s.bus;
    const quiet = s.e === E && (muted || vol.master <= 0 || vol.music <= 0);
    while (s.next < until) {
      if (!quiet) playStep(c, s.step % c.total, s.next);
      s.step++; s.next += c.sd;
    }
  }

  function stopSeq(s) {
    if (!s) return;
    const now = s.e.ctx.currentTime;
    const gp = s.bus.gain;
    try {
      if (gp.cancelAndHoldAtTime) gp.cancelAndHoldAtTime(now);
      else { gp.cancelScheduledValues(now); gp.setValueAtTime(gp.value, now); }
      gp.linearRampToValueAtTime(0, now + FADE_OUT);
    } catch (err) { /* 무시 */ }
    setTimeout(() => { try { s.bus.disconnect(); } catch (err) { /* 무시 */ } }, (FADE_OUT + 0.4) * 1000);
  }

  function tick() {
    if (!E || !seq || seq.once || E.ctx.state !== 'running') return;
    pump(seq, E.ctx.currentTime + LOOKAHEAD);
  }

  /* =========================================================
   * 효과음 재생
   * ========================================================= */
  function voice(e, def, t, o, v) {
    const ctx = e.ctx;
    const g = ctx.createGain();
    g.gain.value = v * (def.v || 1);
    let out = g;
    const pan = clamp(+o.pan || 0, -1, 1);
    if (pan && ctx.createStereoPanner) { const pn = ctx.createStereoPanner(); pn.pan.value = pan; g.connect(pn); out = pn; }
    out.connect(e.sBus);
    if (def.rev) { const s = ctx.createGain(); s.gain.value = def.rev; out.connect(s); s.connect(e.sRev); }
    const p = Math.pow(2, clamp(+o.pitch || 0, -36, 36) / 12) * (1 + (rnd() - 0.5) * (def.jit != null ? def.jit : 0.05));
    X = e; D = g; T0 = t; END = t;
    try { def.fn(p); } catch (err) { /* 소리 하나가 실패해도 게임은 계속 */ }
    return END;
  }

  /* =========================================================
   * 공개 함수
   * ========================================================= */
  function onVisibility() {
    if (!E || typeof document === 'undefined') return;
    if (document.hidden) safe(() => E.ctx.suspend());
    else safe(() => E.ctx.resume());
  }

  function init() {
    if (!AC) return;
    if (E) {
      if (E.ctx.state !== 'running' && !(typeof document !== 'undefined' && document.hidden)) safe(() => E.ctx.resume());
      return;
    }
    try {
      E = build(new AC());
    } catch (err) {
      E = null;
      return;
    }
    applyVol(E, true);
    if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('visibilitychange', onVisibility);
    timer = setInterval(tick, 25);
    if (E.ctx.state !== 'running') safe(() => E.ctx.resume());
    if (wanted !== 'none') { const w = wanted; wanted = 'none'; music(w); }
  }

  function play(name, opts) {
    if (!E || muted) return;
    const def = FX[name];
    if (!def) return;
    const ctx = E.ctx;
    if (ctx.state !== 'running' || vol.master <= 0 || vol.sfx <= 0) return;
    const o = opts || {};
    const v = o.vol == null ? 1 : clamp(+o.vol || 0, 0, 1);
    if (v <= 0) return;
    const now = ctx.currentTime;
    if (lastAt[name] != null && now - lastAt[name] < MIN_GAP) return;
    const mine = (perName[name] || []).filter((x) => x > now);
    perName[name] = mine;
    if (mine.length >= MAX_PER_NAME) return;
    if (now - burstAt >= BURST_WIN) { burstAt = now; burstN = 0; }
    if (burstN >= BURST_MAX && !def.pri) return;
    if (active.length >= MAX_VOICES) active = active.filter((x) => x > now);
    if (active.length >= MAX_VOICES && !def.pri) return;
    lastAt[name] = now;
    burstN++;
    // 같은 소리가 겹쳐 있을수록 조금씩 작게
    const end = voice(E, def, now + 0.005, o, v / (1 + 0.3 * mine.length));
    mine.push(end);
    active.push(end);
  }

  function music(track) {
    const name = track == null ? 'none' : String(track);
    if (name !== 'none' && !TR[name]) return;
    if (!E) { wanted = name; return; }
    const same = seq && seq.name === name;
    wanted = name;
    if (same && !(seq.once && E.ctx.currentTime > seq.end)) return;
    if (!seq && name === 'none') return;
    stopSeq(seq);
    seq = null;
    if (name === 'none') return;
    seq = makeSeq(E, name, E.ctx.currentTime + 0.06);
    if (!seq.once && E.ctx.state === 'running') pump(seq, E.ctx.currentTime + LOOKAHEAD);
  }

  function setVolume(v) {
    const o = v || {};
    for (const k of ['master', 'sfx', 'music']) {
      if (typeof o[k] === 'number' && isFinite(o[k])) vol[k] = clamp(o[k], 0, 1);
    }
    applyVol(E, false);
  }

  function setMuted(m) {
    muted = !!m;
    applyVol(E, false);
  }

  /* 점검용(게임에서는 쓰지 않음): 악보 검사, 오프라인 렌더링 */
  function _lint() {
    const out = { warnings: [], seconds: {} };
    for (const k of Object.keys(TR)) {
      const c = compile(TR[k]);
      c.warn.forEach((w) => out.warnings.push(k + ': ' + w));
      out.seconds[k] = c.once ? null : c.total * c.sd;
    }
    return out;
  }

  function _render(spec) {
    const sp = spec || {};
    if (!OAC) return Promise.resolve(null);
    const sec = sp.seconds || 4;
    const sr = sp.rate || 44100;
    const ctx = new OAC(2, Math.ceil(sec * sr), sr);
    const e = build(ctx);
    applyVol(e, true);
    e.master.gain.value = vol.master * 0.5; // 음소거와 무관하게 렌더링
    if (sp.track && TR[sp.track]) {
      const s = makeSeq(e, sp.track, sp.at || 0.02);
      if (!s.once) pump(s, sec);
    }
    for (const it of sp.sfx || []) {
      const [n, at, o] = Array.isArray(it) ? it : [it, 0, null];
      const def = FX[n];
      if (def) voice(e, def, at || 0, o || {}, o && o.vol != null ? o.vol : 1);
    }
    return ctx.startRendering();
  }

  return {
    init,
    play,
    music,
    setVolume,
    setMuted,
    isMuted: () => muted,
    currentTrack: () => wanted,
    SFX: Object.keys(FX),
    TRACKS: Object.keys(TR),
    _lint,
    _render,
  };
})();
