'use strict';
window.AZ = window.AZ || {};

/* =========================================================
 * ASTRA : ZERO PROTOCOL — 오디오 (js/audio/audio.js)
 * 효과음과 배경음악을 WebAudio 로 실시간 합성합니다. 외부 파일 없음.
 * AudioContext 가 없거나(Node 테스트) 만들 수 없으면 모든 함수는 조용히 아무것도 하지 않습니다.
 * AudioContext 는 init()(첫 사용자 입력) 때 처음 만듭니다.
 *
 * 신호 흐름
 *   효과음 보이스 → (팬) → sfx 버스 ─┬────────────────→ master → 컴프레서 → 리미터 → out → 스피커
 *                     └→ 효과음 리버브 ┘
 *   음악 세션(트랙) → musicIn → ZERO FRAME 저역통과 → duck → music 볼륨 → master
 *        └→ 세션 딜레이/음악 리버브 → musicIn
 * ========================================================= */
window.AZ.audio = (() => {
  const W = window;

  /* ---------------- 설정 ---------------- */
  const LOOKAHEAD = 0.12; // 음악: 미리 예약하는 시간(초)
  const TICK_MS = 25; // 음악: 스케줄러 주기(ms)
  const XFADE = 1.0; // 음악 크로스페이드(초)
  const MAX_VOICES = 24; // 동시에 울리는 효과음 수 한도
  const RATE_DEFAULT = 0.03; // 같은 효과음 최소 간격(초)
  const SFX_LEVEL = 0.9;
  const ZF_CUTOFF = 600; // ZERO FRAME 중 음악 저역통과 주파수
  const ZF_DETUNE = -50; // ZERO FRAME 중 음악 피치(센트)
  const ZF_TEMPO = 0.86; // ZERO FRAME 중 음악 템포 배율

  // 효과음별 최소 간격(초) — 긴 소리는 더 길게
  const RATE = {
    bigExplosion: 0.08, explosion: 0.045, roar: 0.25, alarm: 0.4, victory: 0.6, defeat: 0.6, levelup: 0.3,
    timeStop: 0.35, ult: 0.35, zeroFrame: 0.2, beam: 0.07, charge: 0.1, summon: 0.2, teleport: 0.06, text: 0.028,
  };
  // 효과음별 무작위 피치 흔들림(비율)
  const JITTER = {
    ui: 0, uiConfirm: 0, uiBack: 0, perfect: 0, levelup: 0, victory: 0, defeat: 0, heal: 0, alarm: 0, warn: 0,
    timeStop: 0, ult: 0, zeroFrame: 0, text: 0.08, hit: 0.045, hitWeak: 0.05, slash: 0.04, swing: 0.05, shot: 0.05,
    laser: 0.04, clang: 0.04,
  };

  /* ---------------- 상태 ---------------- */
  let ctx = null;
  let N = null; // 고정 노드 모음
  let whiteBuf = null;
  let brownBuf = null;
  let nyq = 20000;
  const vol = { master: 0.8, music: 0.5, sfx: 0.8 };
  let muted = false;
  let zfOn = false;
  let autoSuspended = false;
  let visBound = false;
  let wantTrack = 'none';
  let cur = null; // 현재 음악 세션
  const lastPlay = Object.create(null);
  let voiceEnds = [];

  /* ---------------- 도우미 ---------------- */
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const fq = (f) => clamp(f, 10, nyq);
  function safe(fn) {
    try {
      fn();
    } catch (e) {
      /* 무시 */
    }
  }
  function gainNode(v) {
    const g = ctx.createGain();
    g.gain.value = v;
    return g;
  }
  // 현재 값을 붙잡고 이후 예약을 지웁니다(새 램프를 시작하기 전).
  function holdNow(p, now) {
    if (typeof p.cancelAndHoldAtTime === 'function') {
      p.cancelAndHoldAtTime(now);
    } else {
      const v = p.value;
      p.cancelScheduledValues(now);
      p.setValueAtTime(v, now);
    }
  }

  /* =========================================================
   * 초기화
   * ========================================================= */
  function resumeCtx() {
    if (!ctx || ctx.state !== 'suspended') return;
    try {
      const p = ctx.resume();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch (e) {
      /* 무시 */
    }
  }

  function makeBuffers() {
    const sr = ctx.sampleRate;
    const len = Math.floor(sr * 2);
    whiteBuf = ctx.createBuffer(1, len, sr);
    const w = whiteBuf.getChannelData(0);
    for (let i = 0; i < len; i++) w[i] = Math.random() * 2 - 1;
    brownBuf = ctx.createBuffer(1, len, sr);
    const b = brownBuf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      b[i] = last * 3.5;
    }
    // 반복 이음매에서 '툭' 소리가 나지 않게 양 끝 값을 맞춤
    const diff = b[len - 1] - b[0];
    for (let i = 0; i < len; i++) b[i] -= (diff * i) / (len - 1);
  }

  // 잔향용 임펄스 응답(시간이 갈수록 어두워지는 감쇠 잡음)
  function impulse(secs, decay, bright) {
    const sr = ctx.sampleRate;
    const len = Math.max(64, Math.floor(sr * secs));
    const pre = Math.floor(sr * 0.012);
    const buf = ctx.createBuffer(2, len, sr);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        if (i < pre) {
          d[i] = 0;
          continue;
        }
        const x = (i - pre) / (len - pre);
        const k = bright * (1 - x) + 0.04;
        lp += (Math.random() * 2 - 1 - lp) * k;
        d[i] = lp * Math.pow(1 - x, decay);
      }
    }
    return buf;
  }

  function build() {
    nyq = Math.min(20000, ctx.sampleRate / 2 - 200);
    const n = {};
    n.out = gainNode(1);
    n.comp = ctx.createDynamicsCompressor();
    n.comp.threshold.value = -14;
    n.comp.knee.value = 10;
    n.comp.ratio.value = 4;
    n.comp.attack.value = 0.004;
    n.comp.release.value = 0.22;
    n.lim = ctx.createDynamicsCompressor();
    n.lim.threshold.value = -2.5;
    n.lim.knee.value = 0;
    n.lim.ratio.value = 20;
    n.lim.attack.value = 0.001;
    n.lim.release.value = 0.09;
    n.master = gainNode(muted ? 0 : vol.master);
    n.master.connect(n.comp);
    n.comp.connect(n.lim);
    n.lim.connect(n.out);
    n.out.connect(ctx.destination);

    // 효과음 버스 + 짧은 잔향
    n.sfx = gainNode(vol.sfx);
    n.sfx.connect(n.master);
    n.sfxVerbIn = gainNode(1);
    n.sfxVerb = ctx.createConvolver();
    n.sfxVerb.buffer = impulse(1.6, 3.2, 0.7);
    n.sfxVerbOut = gainNode(0.55);
    n.sfxVerbIn.connect(n.sfxVerb);
    n.sfxVerb.connect(n.sfxVerbOut);
    n.sfxVerbOut.connect(n.sfx);

    // 음악 버스: musicIn → zf(저역통과) → duck → musicVol → master
    n.musicVol = gainNode(vol.music);
    n.musicVol.connect(n.master);
    n.duck = gainNode(1);
    n.duck.connect(n.musicVol);
    n.zf = ctx.createBiquadFilter();
    n.zf.type = 'lowpass';
    n.zf.frequency.value = zfOn ? ZF_CUTOFF : nyq;
    n.zf.Q.value = zfOn ? 2 : 0.7;
    n.zf.connect(n.duck);
    n.musicIn = gainNode(1);
    n.musicIn.connect(n.zf);
    n.musicVerbIn = gainNode(1);
    n.musicVerb = ctx.createConvolver();
    n.musicVerb.buffer = impulse(2.8, 2.6, 0.55);
    n.musicVerbOut = gainNode(0.7);
    n.musicVerbIn.connect(n.musicVerb);
    n.musicVerb.connect(n.musicVerbOut);
    n.musicVerbOut.connect(n.musicIn);

    // ZERO FRAME 피치: 모든 음악 오실레이터의 detune 에 연결되는 상수 신호
    if (typeof ctx.createConstantSource === 'function') {
      n.zfDet = ctx.createConstantSource();
      n.zfDet.offset.value = zfOn ? ZF_DETUNE : 0;
      n.zfDet.start();
    }
    N = n;
    makeBuffers();
  }

  function bindVisibility() {
    if (visBound || typeof document === 'undefined' || !document || typeof document.addEventListener !== 'function') return;
    visBound = true;
    document.addEventListener('visibilitychange', () => {
      if (!ctx) return;
      try {
        if (document.hidden) {
          if (ctx.state === 'running') {
            autoSuspended = true;
            const p = ctx.suspend();
            if (p && typeof p.catch === 'function') p.catch(() => {});
          }
        } else if (autoSuspended) {
          autoSuspended = false;
          resumeCtx();
        }
      } catch (e) {
        /* 무시 */
      }
    });
  }

  function init() {
    try {
      if (ctx) {
        autoSuspended = false;
        resumeCtx();
        return;
      }
      const AC = W.AudioContext || W.webkitAudioContext;
      if (typeof AC !== 'function') return;
      try {
        ctx = new AC({ latencyHint: 'interactive' });
      } catch (e) {
        ctx = new AC();
      }
      build();
      resumeCtx();
      bindVisibility();
      if (wantTrack !== 'none') cur = startSession(wantTrack);
    } catch (e) {
      // 실패하면 소리 없이 계속 진행
      if (ctx) safe(() => ctx.close());
      ctx = null;
      N = null;
      cur = null;
    }
  }

  const isReady = () => !!(ctx && N && ctx.state === 'running');

  /* =========================================================
   * 합성 기본 단위
   * ========================================================= */
  // 엔벨로프: 어택 → 유지 → 지수 감쇠(end 에서 무음)
  function envAD(p, t, peak, a, hold, end, swell) {
    if (swell) {
      p.setValueAtTime(0.0001, t);
      p.exponentialRampToValueAtTime(peak, t + a);
    } else {
      p.setValueAtTime(0, t);
      p.linearRampToValueAtTime(peak, t + a);
    }
    if (hold > 0) p.setValueAtTime(peak, t + a + hold);
    p.exponentialRampToValueAtTime(0.0001, end);
    p.setValueAtTime(0, end + 0.002);
  }

  // 주파수 스윕(지수): f → f2 (d2 초) → f3 (d3 초)
  function sweep(p, t, f, f2, d2, f3, d3, k) {
    p.setValueAtTime(fq(f * k), t);
    if (f2) p.exponentialRampToValueAtTime(fq(f2 * k), t + Math.max(0.005, d2));
    if (f2 && f3) p.exponentialRampToValueAtTime(fq(f3 * k), t + Math.max(0.005, d2) + Math.max(0.005, d3));
  }

  function linkZF(os) {
    if (N && N.zfDet) {
      try {
        N.zfDet.connect(os.detune);
        return true;
      } catch (e) {
        return false;
      }
    }
    if (zfOn) os.detune.value += ZF_DETUNE;
    return false;
  }
  function unlinkZF(os) {
    if (N && N.zfDet) safe(() => N.zfDet.disconnect(os.detune));
  }

  function addTrem(head, tr, parts, extra) {
    const depth = clamp(tr.depth, 0, 1);
    const tg = gainNode(1 - depth / 2);
    const l = ctx.createOscillator();
    l.type = tr.type || 'sine';
    l.frequency.value = tr.rate;
    const lg = gainNode(depth / 2);
    l.connect(lg);
    lg.connect(tg.gain);
    head.connect(tg);
    parts.push(tg, l, lg);
    extra.push(l);
    return tg;
  }

  function addVib(src, v, t, end, parts, extra) {
    const l = ctx.createOscillator();
    l.frequency.value = v.rate;
    const lg = ctx.createGain();
    if (v.delay) {
      lg.gain.setValueAtTime(0, t);
      lg.gain.setValueAtTime(0, t + v.delay);
      lg.gain.linearRampToValueAtTime(v.depth, Math.min(end, t + v.delay + 0.25));
    } else {
      lg.gain.value = v.depth;
    }
    l.connect(lg);
    lg.connect(src.detune);
    parts.push(l, lg);
    extra.push(l);
  }

  function addFM(src, fm, f, t, end, parts, extra) {
    const m = ctx.createOscillator();
    m.frequency.value = fq(f * fm.ratio);
    const mg = ctx.createGain();
    const depth = Math.max(1, f * fm.index);
    mg.gain.setValueAtTime(depth, t);
    mg.gain.exponentialRampToValueAtTime(Math.max(0.5, depth * 0.04), t + Math.max(0.02, (end - t) * (fm.decay || 0.3)));
    m.connect(mg);
    mg.connect(src.frequency);
    parts.push(m, mg);
    extra.push(m);
  }

  /* 오실레이터 한 음.
   * o: t, type, f, f2, slide, f3, slide2, dur, vol, a, hold, swell, filter, ff, ff2, fslide, ff3, fslide2, q,
   *    detune, lfo{rate,depth,delay}, trem{rate,depth}, fm{ratio,index,decay}, k(피치 배율), dests[], zf */
  function synth(o) {
    const k = o.k || 1;
    const t = o.t;
    const a = Math.max(0.001, o.a != null ? o.a : 0.004);
    const hold = o.hold || 0;
    const end = Math.max(t + (o.dur || 0.1), t + a + hold + 0.02);
    const src = ctx.createOscillator();
    src.type = o.type || 'sine';
    const sl = o.slide || end - t;
    sweep(src.frequency, t, o.f, o.f2, sl, o.f3, o.slide2 || sl, k);
    if (o.detune) src.detune.setValueAtTime(o.detune, t);
    const g = ctx.createGain();
    const parts = [src, g];
    const extra = [];
    let head = src;
    if (o.filter) {
      const f = ctx.createBiquadFilter();
      f.type = o.filter;
      const fs = o.fslide || end - t;
      sweep(f.frequency, t, o.ff || 1000, o.ff2, fs, o.ff3, o.fslide2 || fs, k);
      f.Q.value = o.q != null ? o.q : 0.8;
      head.connect(f);
      head = f;
      parts.push(f);
    }
    if (o.trem) head = addTrem(head, o.trem, parts, extra);
    head.connect(g);
    envAD(g.gain, t, Math.max(0.0002, o.vol), a, hold, end, o.swell);
    const ds = o.dests;
    for (let i = 0; i < ds.length; i++) if (ds[i]) g.connect(ds[i]);
    if (o.lfo) addVib(src, o.lfo, t, end, parts, extra);
    if (o.fm) addFM(src, o.fm, o.f * k, t, end, parts, extra);
    const zl = o.zf ? linkZF(src) : false;
    src.start(t);
    src.stop(end + 0.02);
    for (let i = 0; i < extra.length; i++) {
      extra[i].start(t);
      extra[i].stop(end + 0.02);
    }
    src.onended = () => {
      if (zl) unlinkZF(src);
      for (let i = 0; i < parts.length; i++) safe(() => parts[i].disconnect());
    };
    return { end, src };
  }

  /* 잡음 한 덩어리. o: t, buf('white'|'brown'), filter, f, f2, slide, f3, slide2, q, dur, vol, a, hold, swell, trem, k, dests */
  function noise(o) {
    const k = o.k || 1;
    const t = o.t;
    const a = Math.max(0.001, o.a != null ? o.a : 0.003);
    const hold = o.hold || 0;
    const end = Math.max(t + (o.dur || 0.1), t + a + hold + 0.02);
    const src = ctx.createBufferSource();
    src.buffer = o.buf === 'brown' ? brownBuf : whiteBuf;
    src.loop = true;
    const g = ctx.createGain();
    const parts = [src, g];
    const extra = [];
    let head = src;
    if (o.filter) {
      const f = ctx.createBiquadFilter();
      f.type = o.filter;
      const sl = o.slide || end - t;
      sweep(f.frequency, t, o.f || 1000, o.f2, sl, o.f3, o.slide2 || sl, k);
      f.Q.value = o.q != null ? o.q : 0.9;
      head.connect(f);
      head = f;
      parts.push(f);
    }
    if (o.trem) head = addTrem(head, o.trem, parts, extra);
    head.connect(g);
    envAD(g.gain, t, Math.max(0.0002, o.vol), a, hold, end, o.swell);
    const ds = o.dests;
    for (let i = 0; i < ds.length; i++) if (ds[i]) g.connect(ds[i]);
    src.start(t, Math.random() * 1.5);
    src.stop(end + 0.02);
    for (let i = 0; i < extra.length; i++) {
      extra[i].start(t);
      extra[i].stop(end + 0.02);
    }
    src.onended = () => {
      for (let i = 0; i < parts.length; i++) safe(() => parts[i].disconnect());
    };
    return { end, src };
  }

  /* =========================================================
   * 효과음
   * ========================================================= */
  function track(V, r) {
    if (r.end > V.end) {
      V.end = r.end;
      V.src = r.src;
    }
  }
  function T(V, o) {
    o.t = V.t + (o.delay || 0);
    o.k = V.p;
    o.dests = V.d;
    track(V, synth(o));
  }
  function Nz(V, o) {
    o.t = V.t + (o.delay || 0);
    o.k = V.p;
    o.dests = V.d;
    track(V, noise(o));
  }
  // 이 보이스를 효과음 잔향으로도 보냄
  function wet(V, amt) {
    if (V.send) return;
    V.send = gainNode(amt);
    V.last.connect(V.send);
    V.send.connect(N.sfxVerbIn);
  }
  function brassHit(V, m, delay, dur, v) {
    T(V, { type: 'sawtooth', f: mtof(m), dur, a: 0.02, hold: dur * 0.55, vol: v, filter: 'lowpass', ff: 700, ff2: 3200, fslide: 0.06, ff3: 1800, fslide2: 0.3, q: 1.2, delay, detune: -6 });
    T(V, { type: 'sawtooth', f: mtof(m), dur, a: 0.025, hold: dur * 0.55, vol: v * 0.8, filter: 'lowpass', ff: 900, ff2: 2600, fslide: 0.08, delay, detune: 7 });
  }

  const SFX = {
    /* --- 근접 공격 --- */
    slash(V) {
      wet(V, 0.12);
      Nz(V, { filter: 'bandpass', f: 1400, f2: 6500, q: 1.4, dur: 0.14, vol: 0.5, a: 0.006 });
      T(V, { type: 'sawtooth', f: 1600, f2: 420, dur: 0.12, vol: 0.12, filter: 'bandpass', ff: 2600, ff2: 900, q: 5, a: 0.003 });
      T(V, { type: 'sine', f: 3400, f2: 2500, dur: 0.09, vol: 0.06, a: 0.002 });
      T(V, { type: 'sawtooth', f: 260, f2: 140, dur: 0.13, vol: 0.12, filter: 'lowpass', ff: 1400, a: 0.004 });
    },
    slashHeavy(V) {
      wet(V, 0.22);
      Nz(V, { filter: 'bandpass', f: 500, f2: 4200, q: 1.1, dur: 0.27, vol: 0.5, a: 0.02 });
      T(V, { type: 'sawtooth', f: 180, f2: 70, dur: 0.34, vol: 0.2, filter: 'lowpass', ff: 1800, ff2: 300, q: 4, a: 0.01 });
      T(V, { type: 'sawtooth', f: 183, f2: 72, dur: 0.34, vol: 0.15, filter: 'lowpass', ff: 1400, ff2: 300, a: 0.012 });
      T(V, { type: 'sine', f: 130, f2: 42, dur: 0.32, vol: 0.55, a: 0.004, delay: 0.06 });
      T(V, { type: 'square', f: 2200, f2: 700, dur: 0.15, vol: 0.05, filter: 'bandpass', ff: 3000, q: 6 });
    },
    swing(V) {
      Nz(V, { filter: 'bandpass', f: 450, f2: 2200, q: 1.2, dur: 0.2, vol: 0.32, a: 0.05 });
      Nz(V, { filter: 'highpass', f: 3200, dur: 0.12, vol: 0.07, a: 0.04 });
    },
    hit(V) {
      wet(V, 0.08);
      T(V, { type: 'sine', f: 190, f2: 48, slide: 0.12, dur: 0.18, vol: 0.75, a: 0.002 });
      Nz(V, { filter: 'lowpass', f: 4500, f2: 700, dur: 0.09, vol: 0.45, a: 0.001 });
      T(V, { type: 'square', f: 420, f2: 110, dur: 0.06, vol: 0.11, filter: 'lowpass', ff: 2200, a: 0.001 });
      Nz(V, { filter: 'highpass', f: 6000, dur: 0.025, vol: 0.18, a: 0.001 });
    },
    hitWeak(V) {
      T(V, { type: 'sine', f: 260, f2: 90, dur: 0.09, vol: 0.4, a: 0.002 });
      Nz(V, { filter: 'bandpass', f: 2800, q: 1, dur: 0.05, vol: 0.22, a: 0.001 });
    },
    crit(V) {
      wet(V, 0.22);
      T(V, { type: 'sine', f: 170, f2: 40, slide: 0.15, dur: 0.26, vol: 0.85, a: 0.002 });
      Nz(V, { filter: 'lowpass', f: 6000, f2: 600, dur: 0.14, vol: 0.5, a: 0.001 });
      T(V, { type: 'sawtooth', f: 90, f2: 38, dur: 0.22, vol: 0.16, filter: 'lowpass', ff: 600, a: 0.002 });
      T(V, { type: 'sine', f: 1760, dur: 0.4, vol: 0.1, a: 0.002, delay: 0.01 });
      T(V, { type: 'sine', f: 2637, dur: 0.3, vol: 0.07, a: 0.002, delay: 0.01 });
      Nz(V, { filter: 'highpass', f: 7000, dur: 0.18, vol: 0.14, a: 0.002 });
    },
    counter(V) {
      wet(V, 0.3);
      T(V, { type: 'sine', f: 2093, dur: 0.5, vol: 0.12, a: 0.001, fm: { ratio: 1.47, index: 2.5, decay: 0.2 } });
      T(V, { type: 'square', f: 3520, dur: 0.06, vol: 0.04, filter: 'highpass', ff: 3000 });
      Nz(V, { filter: 'highpass', f: 5000, dur: 0.06, vol: 0.35, a: 0.001 });
      Nz(V, { filter: 'bandpass', f: 1500, f2: 7000, q: 1.5, dur: 0.12, vol: 0.35, a: 0.005, delay: 0.06 });
      T(V, { type: 'sine', f: 180, f2: 45, dur: 0.18, vol: 0.6, a: 0.002, delay: 0.08 });
    },
    clang(V) {
      wet(V, 0.2);
      const partials = [523, 1327, 2210, 3412];
      for (let i = 0; i < partials.length; i++) {
        T(V, { type: 'sine', f: partials[i], dur: 0.45 - i * 0.08, vol: 0.1 - i * 0.018, a: 0.001 });
      }
      T(V, { type: 'square', f: 260, f2: 180, dur: 0.08, vol: 0.08, filter: 'lowpass', ff: 1500, a: 0.001 });
      Nz(V, { filter: 'bandpass', f: 3000, q: 1.5, dur: 0.05, vol: 0.3, a: 0.001 });
    },

    /* --- 회피 / 시간 --- */
    dodge(V) {
      Nz(V, { filter: 'bandpass', f: 3800, f2: 900, q: 1.5, dur: 0.17, vol: 0.26, a: 0.02 });
      T(V, { type: 'sine', f: 1100, f2: 500, dur: 0.12, vol: 0.05, a: 0.01 });
    },
    perfect(V) {
      wet(V, 0.45);
      T(V, { type: 'sine', f: 1318.5, dur: 0.75, vol: 0.17, a: 0.002, fm: { ratio: 2, index: 1.2, decay: 0.15 } });
      T(V, { type: 'sine', f: 1975.5, dur: 0.65, vol: 0.12, a: 0.002, delay: 0.035, fm: { ratio: 3.01, index: 0.8, decay: 0.12 } });
      T(V, { type: 'sine', f: 3951, dur: 0.3, vol: 0.05, a: 0.001, delay: 0.035 });
      Nz(V, { filter: 'highpass', f: 8000, dur: 0.12, vol: 0.12, a: 0.001 });
      T(V, { type: 'triangle', f: 2637, f2: 5274, dur: 0.08, vol: 0.05, a: 0.001 });
    },
    zeroFrame(V) {
      wet(V, 0.5);
      Nz(V, { filter: 'bandpass', f: 5000, f2: 250, q: 2.5, dur: 1.15, vol: 0.4, a: 0.08 });
      T(V, { type: 'sawtooth', f: 900, f2: 70, slide: 0.9, dur: 1.0, vol: 0.1, filter: 'lowpass', ff: 3000, ff2: 300, a: 0.01 });
      T(V, { type: 'sine', f: 110, f2: 35, dur: 0.9, vol: 0.5, a: 0.01 });
      T(V, { type: 'sine', f: 1568, f2: 784, dur: 1.05, vol: 0.06, a: 0.005, lfo: { rate: 6, depth: 30 } });
      T(V, { type: 'sine', f: 2349, f2: 1174, dur: 0.95, vol: 0.04, a: 0.005 });
    },
    timeStop(V) {
      wet(V, 0.6);
      Nz(V, { filter: 'highpass', f: 1500, f2: 5000, dur: 0.52, vol: 0.3, a: 0.48, swell: true });
      T(V, { type: 'sawtooth', f: 400, f2: 1600, slide: 0.5, dur: 0.52, vol: 0.06, filter: 'lowpass', ff: 3000, a: 0.46, swell: true });
      T(V, { type: 'sine', f: 55, dur: 2.2, vol: 0.5, a: 0.004, delay: 0.5, fm: { ratio: 1.41, index: 3, decay: 0.5 } });
      T(V, { type: 'sine', f: 110.7, dur: 1.8, vol: 0.16, a: 0.004, delay: 0.5, fm: { ratio: 2.76, index: 1.5, decay: 0.4 } });
      T(V, { type: 'sine', f: 2093, dur: 1.5, vol: 0.05, a: 0.01, delay: 0.5, lfo: { rate: 3, depth: 10 } });
      const ticks = [0.66, 0.98, 1.3];
      for (let i = 0; i < ticks.length; i++) {
        T(V, { type: 'square', f: i % 2 ? 1800 : 2400, dur: 0.025, vol: 0.07, filter: 'bandpass', ff: 2500, q: 4, a: 0.001, delay: ticks[i] });
      }
    },
    blink(V) {
      T(V, { type: 'sine', f: 300, f2: 2600, slide: 0.07, dur: 0.1, vol: 0.18, a: 0.002 });
      Nz(V, { filter: 'highpass', f: 2500, f2: 6000, dur: 0.1, vol: 0.16, a: 0.01 });
      T(V, { type: 'square', f: 1800, f2: 3600, dur: 0.05, vol: 0.03, delay: 0.05 });
    },
    teleport(V) {
      wet(V, 0.4);
      T(V, { type: 'sine', f: 1600, f2: 200, slide: 0.22, f3: 2400, slide2: 0.24, dur: 0.5, vol: 0.14, a: 0.01, fm: { ratio: 0.5, index: 3, decay: 1 } });
      Nz(V, { filter: 'bandpass', f: 4000, f2: 500, q: 4, dur: 0.3, vol: 0.16, a: 0.02 });
      Nz(V, { filter: 'bandpass', f: 500, f2: 5000, q: 4, dur: 0.3, vol: 0.16, a: 0.1, delay: 0.22 });
      T(V, { type: 'square', f: 100, f2: 50, dur: 0.2, vol: 0.05, filter: 'lowpass', ff: 600 });
    },

    /* --- 스킬 / 연계 --- */
    break(V) {
      wet(V, 0.35);
      T(V, { type: 'sine', f: 100, f2: 38, dur: 0.35, vol: 0.7, a: 0.002 });
      Nz(V, { filter: 'bandpass', f: 1500, q: 0.8, dur: 0.08, vol: 0.5, a: 0.001 });
      Nz(V, { filter: 'highpass', f: 4500, f2: 2500, dur: 0.45, vol: 0.3, a: 0.002 });
      for (let i = 0; i < 12; i++) {
        T(V, { type: i % 2 ? 'triangle' : 'sine', f: rnd(2200, 7500), dur: rnd(0.06, 0.22), vol: rnd(0.04, 0.09), a: 0.001, delay: Math.pow(Math.random(), 1.6) * 0.28 });
      }
    },
    skill(V) {
      wet(V, 0.3);
      T(V, { type: 'sawtooth', f: 220, f2: 1320, slide: 0.25, dur: 0.38, vol: 0.12, filter: 'lowpass', ff: 600, ff2: 5000, fslide: 0.25, q: 6, a: 0.01 });
      T(V, { type: 'square', f: 110, f2: 660, slide: 0.25, dur: 0.32, vol: 0.05, filter: 'lowpass', ff: 1500 });
      Nz(V, { filter: 'bandpass', f: 800, f2: 6000, q: 2, dur: 0.3, vol: 0.18, a: 0.12 });
      const ch = [0, 4, 7];
      for (let i = 0; i < ch.length; i++) T(V, { type: 'triangle', f: mtof(81 + ch[i]), dur: 0.4, vol: 0.06, a: 0.005, delay: 0.22 + i * 0.02 });
    },
    chain(V) {
      wet(V, 0.3);
      T(V, { type: 'triangle', f: 1046, f2: 1568, slide: 0.05, dur: 0.16, vol: 0.12, a: 0.002 });
      T(V, { type: 'triangle', f: 1568, f2: 2349, slide: 0.05, dur: 0.22, vol: 0.12, a: 0.002, delay: 0.07 });
      T(V, { type: 'sine', f: 3136, dur: 0.3, vol: 0.06, a: 0.002, delay: 0.07, fm: { ratio: 2.5, index: 1, decay: 0.3 } });
      Nz(V, { filter: 'bandpass', f: 4000, f2: 8000, q: 2, dur: 0.12, vol: 0.15, a: 0.005 });
      T(V, { type: 'sawtooth', f: 200, f2: 800, dur: 0.12, vol: 0.06, filter: 'lowpass', ff: 3000 });
    },
    ult(V) {
      wet(V, 0.5);
      Nz(V, { filter: 'bandpass', f: 300, f2: 6000, q: 2, dur: 0.64, vol: 0.3, a: 0.6, swell: true });
      T(V, { type: 'sawtooth', f: 110, f2: 880, slide: 0.6, dur: 0.64, vol: 0.12, filter: 'lowpass', ff: 500, ff2: 5000, fslide: 0.6, q: 5, a: 0.58, swell: true });
      T(V, { type: 'sine', f: 120, f2: 28, slide: 0.6, dur: 1.2, vol: 0.9, a: 0.002, delay: 0.62 });
      Nz(V, { buf: 'brown', filter: 'lowpass', f: 3000, f2: 100, dur: 1.4, vol: 0.8, a: 0.002, delay: 0.62 });
      const st = [57, 64, 69, 72, 76];
      for (let i = 0; i < st.length; i++) {
        T(V, { type: 'sawtooth', f: mtof(st[i]), dur: 1.2, vol: 0.045, filter: 'lowpass', ff: 3500, ff2: 800, a: 0.005, delay: 0.62, detune: rnd(-8, 8) });
      }
      Nz(V, { filter: 'highpass', f: 6000, dur: 0.8, vol: 0.15, a: 0.002, delay: 0.62 });
    },
    summon(V) {
      wet(V, 0.5);
      T(V, { type: 'sawtooth', f: 55, f2: 110, slide: 0.8, dur: 1.0, vol: 0.16, filter: 'lowpass', ff: 200, ff2: 1600, q: 4, a: 0.3, hold: 0.4, lfo: { rate: 4, depth: 20 } });
      T(V, { type: 'sawtooth', f: 58.3, f2: 116.5, slide: 0.8, dur: 1.0, vol: 0.12, filter: 'lowpass', ff: 300, ff2: 1200, a: 0.3, hold: 0.4 });
      const bells = [74, 75, 81];
      for (let i = 0; i < bells.length; i++) {
        T(V, { type: 'sine', f: mtof(bells[i]), dur: 0.9, vol: 0.05, a: 0.003, delay: 0.3 + i * 0.12, fm: { ratio: 3.5, index: 1.5, decay: 0.4 } });
      }
      Nz(V, { filter: 'bandpass', f: 300, f2: 2000, q: 3, dur: 0.9, vol: 0.15, a: 0.4 });
    },

    /* --- 원거리 / 무기 --- */
    wave(V) {
      wet(V, 0.3);
      T(V, { type: 'sine', f: 95, f2: 38, dur: 0.6, vol: 0.6, a: 0.005 });
      Nz(V, { buf: 'brown', filter: 'lowpass', f: 3000, f2: 180, dur: 0.6, vol: 0.55, a: 0.01 });
      T(V, { type: 'sawtooth', f: 260, f2: 60, dur: 0.45, vol: 0.11, filter: 'bandpass', ff: 800, ff2: 200, q: 3 });
      Nz(V, { filter: 'bandpass', f: 600, f2: 3000, q: 3, dur: 0.4, vol: 0.12, a: 0.05 });
    },
    beam(V) {
      wet(V, 0.25);
      T(V, { type: 'sawtooth', f: 110, dur: 0.95, vol: 0.13, a: 0.05, hold: 0.55, filter: 'bandpass', ff: 900, ff2: 1600, q: 2, trem: { rate: 32, depth: 0.5 } });
      T(V, { type: 'sawtooth', f: 165.5, dur: 0.95, vol: 0.09, a: 0.05, hold: 0.55, filter: 'lowpass', ff: 2200 });
      T(V, { type: 'sine', f: 880, f2: 840, dur: 0.95, vol: 0.05, a: 0.04, hold: 0.5, lfo: { rate: 9, depth: 40 } });
      Nz(V, { filter: 'highpass', f: 5000, dur: 0.95, vol: 0.06, a: 0.04, hold: 0.55 });
      T(V, { type: 'sine', f: 60, f2: 50, dur: 0.95, vol: 0.25, a: 0.03, hold: 0.5 });
    },
    shot(V) {
      T(V, { type: 'square', f: 1500, f2: 320, dur: 0.1, vol: 0.11, filter: 'lowpass', ff: 4000, ff2: 1000, a: 0.001 });
      T(V, { type: 'sine', f: 900, f2: 200, dur: 0.08, vol: 0.18, a: 0.001 });
      Nz(V, { filter: 'bandpass', f: 3000, q: 1, dur: 0.03, vol: 0.2, a: 0.001 });
    },
    railgun(V) {
      wet(V, 0.35);
      Nz(V, { filter: 'highpass', f: 1800, dur: 0.06, vol: 0.55, a: 0.001 });
      T(V, { type: 'sawtooth', f: 3200, f2: 90, slide: 0.3, dur: 0.4, vol: 0.16, filter: 'lowpass', ff: 8000, ff2: 400, a: 0.001 });
      T(V, { type: 'sine', f: 150, f2: 38, dur: 0.38, vol: 0.65, a: 0.002 });
      T(V, { type: 'sine', f: 2950, dur: 0.5, vol: 0.05, a: 0.002, lfo: { rate: 18, depth: 25 } });
      Nz(V, { filter: 'bandpass', f: 2500, f2: 400, q: 2, dur: 0.5, vol: 0.2, a: 0.003 });
    },
    charge(V) {
      wet(V, 0.2);
      T(V, { type: 'sawtooth', f: 140, f2: 1100, slide: 0.7, dur: 0.78, vol: 0.11, filter: 'lowpass', ff: 400, ff2: 4000, fslide: 0.7, q: 5, a: 0.05, hold: 0.6, trem: { rate: 14, depth: 0.35 } });
      T(V, { type: 'sawtooth', f: 142, f2: 1110, slide: 0.7, dur: 0.78, vol: 0.07, filter: 'lowpass', ff: 600, ff2: 3500, fslide: 0.7, a: 0.05, hold: 0.6 });
      Nz(V, { filter: 'bandpass', f: 500, f2: 5000, q: 3, dur: 0.75, vol: 0.14, a: 0.6, swell: true });
      T(V, { type: 'sine', f: 2200, dur: 0.14, vol: 0.08, a: 0.002, delay: 0.7 });
    },
    laser(V) {
      wet(V, 0.15);
      T(V, { type: 'sawtooth', f: 2600, f2: 180, slide: 0.18, dur: 0.22, vol: 0.12, filter: 'bandpass', ff: 3000, ff2: 400, q: 7, a: 0.001 });
      T(V, { type: 'square', f: 1300, f2: 90, slide: 0.18, dur: 0.2, vol: 0.05, filter: 'lowpass', ff: 3000 });
      T(V, { type: 'sine', f: 1800, f2: 300, dur: 0.15, vol: 0.12, a: 0.001 });
    },
    missile(V) {
      wet(V, 0.25);
      T(V, { type: 'sine', f: 120, f2: 50, dur: 0.15, vol: 0.45, a: 0.002 });
      Nz(V, { filter: 'bandpass', f: 700, f2: 2800, q: 1.4, dur: 0.75, vol: 0.32, a: 0.04, hold: 0.3 });
      T(V, { type: 'sawtooth', f: 300, f2: 900, slide: 0.6, dur: 0.7, vol: 0.06, filter: 'lowpass', ff: 1800, a: 0.05, hold: 0.3, lfo: { rate: 20, depth: 15 } });
      Nz(V, { buf: 'brown', filter: 'lowpass', f: 500, dur: 0.6, vol: 0.35, a: 0.02 });
    },
    explosion(V) {
      wet(V, 0.35);
      Nz(V, { buf: 'brown', filter: 'lowpass', f: 1600, f2: 120, dur: 0.85, vol: 0.9, a: 0.003 });
      T(V, { type: 'sine', f: 110, f2: 32, slide: 0.5, dur: 0.6, vol: 0.7, a: 0.002 });
      Nz(V, { filter: 'bandpass', f: 2500, f2: 500, q: 0.7, dur: 0.25, vol: 0.35, a: 0.001 });
      for (let i = 0; i < 4; i++) Nz(V, { filter: 'highpass', f: rnd(2500, 5000), dur: 0.03, vol: rnd(0.08, 0.16), a: 0.001, delay: 0.1 + Math.random() * 0.4 });
    },
    bigExplosion(V) {
      wet(V, 0.5);
      Nz(V, { buf: 'brown', filter: 'lowpass', f: 2400, f2: 70, dur: 1.9, vol: 1.0, a: 0.004, q: 1.5 });
      T(V, { type: 'sine', f: 80, f2: 24, slide: 1.2, dur: 1.5, vol: 0.8, a: 0.003 });
      T(V, { type: 'sawtooth', f: 60, f2: 28, dur: 0.9, vol: 0.12, filter: 'lowpass', ff: 300, a: 0.003 });
      Nz(V, { filter: 'bandpass', f: 3000, f2: 300, q: 0.6, dur: 0.6, vol: 0.4, a: 0.001 });
      Nz(V, { buf: 'brown', filter: 'lowpass', f: 900, f2: 100, dur: 1.4, vol: 0.5, a: 0.002, delay: 0.18 });
      for (let i = 0; i < 7; i++) Nz(V, { filter: 'highpass', f: rnd(2000, 5000), dur: rnd(0.02, 0.05), vol: rnd(0.06, 0.14), a: 0.001, delay: 0.1 + Math.random() * 1.1 });
    },

    /* --- 보스 / 위험 --- */
    warn(V) {
      for (let i = 0; i < 2; i++) {
        const d = i * 0.15;
        T(V, { type: 'square', f: 1046, dur: 0.11, vol: 0.08, filter: 'lowpass', ff: 3500, a: 0.002, hold: 0.05, delay: d });
        T(V, { type: 'sawtooth', f: 1108, dur: 0.11, vol: 0.05, filter: 'lowpass', ff: 3000, a: 0.002, hold: 0.05, delay: d });
        T(V, { type: 'sine', f: 523, dur: 0.12, vol: 0.1, a: 0.002, hold: 0.05, delay: d });
      }
    },
    alarm(V) {
      wet(V, 0.2);
      for (let i = 0; i < 4; i++) {
        T(V, { type: 'sawtooth', f: 620, f2: 940, slide: 0.25, dur: 0.3, vol: 0.12, filter: 'lowpass', ff: 2400, a: 0.01, hold: 0.2, delay: i * 0.32 });
        T(V, { type: 'square', f: 310, f2: 470, slide: 0.25, dur: 0.3, vol: 0.06, filter: 'lowpass', ff: 1500, a: 0.01, hold: 0.2, delay: i * 0.32 });
      }
    },
    roar(V) {
      wet(V, 0.35);
      T(V, { type: 'sawtooth', f: 85, f2: 58, dur: 1.4, vol: 0.26, a: 0.12, hold: 0.6, filter: 'lowpass', ff: 900, ff2: 300, q: 3, trem: { rate: 27, depth: 0.6 } });
      T(V, { type: 'sawtooth', f: 88, f2: 55, dur: 1.4, vol: 0.18, a: 0.15, hold: 0.6, filter: 'lowpass', ff: 700, lfo: { rate: 5, depth: 30 } });
      T(V, { type: 'square', f: 43, f2: 30, dur: 1.3, vol: 0.11, a: 0.1, hold: 0.5, filter: 'lowpass', ff: 300 });
      Nz(V, { filter: 'bandpass', f: 600, f2: 250, q: 2.5, dur: 1.3, vol: 0.35, a: 0.12, hold: 0.5, trem: { rate: 23, depth: 0.5 } });
    },
    stomp(V) {
      wet(V, 0.25);
      T(V, { type: 'sine', f: 75, f2: 26, slide: 0.35, dur: 0.6, vol: 1.0, a: 0.002 });
      T(V, { type: 'triangle', f: 120, f2: 45, dur: 0.25, vol: 0.3, a: 0.002 });
      Nz(V, { buf: 'brown', filter: 'lowpass', f: 600, f2: 70, dur: 0.55, vol: 0.75, a: 0.002 });
      Nz(V, { filter: 'bandpass', f: 1200, q: 1, dur: 0.04, vol: 0.25, a: 0.001 });
      Nz(V, { filter: 'highpass', f: 2500, dur: 0.15, vol: 0.06, a: 0.01, delay: 0.12 });
    },
    glitch(V) {
      wet(V, 0.1);
      let d = 0;
      for (let i = 0; i < 8; i++) {
        const len = rnd(0.015, 0.04);
        T(V, { type: Math.random() < 0.5 ? 'square' : 'sawtooth', f: rnd(150, 2400), dur: len, vol: rnd(0.06, 0.12), a: 0.001, delay: d, filter: 'lowpass', ff: 5000 });
        if (Math.random() < 0.5) Nz(V, { filter: 'bandpass', f: rnd(1000, 6000), q: 3, dur: len, vol: 0.18, a: 0.001, delay: d });
        d += len + rnd(0, 0.02);
      }
    },

    /* --- 플레이어 상태 --- */
    hurt(V) {
      wet(V, 0.1);
      T(V, { type: 'sawtooth', f: 340, f2: 85, dur: 0.24, vol: 0.16, filter: 'lowpass', ff: 2200, ff2: 400, a: 0.002 });
      T(V, { type: 'sine', f: 160, f2: 50, dur: 0.2, vol: 0.5, a: 0.002 });
      Nz(V, { filter: 'lowpass', f: 3000, f2: 500, dur: 0.12, vol: 0.35, a: 0.001 });
      T(V, { type: 'square', f: 1200, dur: 0.03, vol: 0.045, a: 0.001, delay: 0.05 });
      T(V, { type: 'square', f: 700, dur: 0.03, vol: 0.045, a: 0.001, delay: 0.09 });
    },
    heal(V) {
      wet(V, 0.4);
      const up = [0, 4, 7, 12, 16];
      for (let i = 0; i < up.length; i++) T(V, { type: 'sine', f: mtof(72 + up[i]), dur: 0.45, vol: 0.1, a: 0.01, delay: i * 0.055 });
      T(V, { type: 'triangle', f: 523, f2: 1046, dur: 0.5, vol: 0.05, a: 0.1 });
      Nz(V, { filter: 'highpass', f: 6000, dur: 0.5, vol: 0.05, a: 0.15 });
    },
    shield(V) {
      wet(V, 0.3);
      T(V, { type: 'sine', f: 180, f2: 360, slide: 0.15, dur: 0.55, vol: 0.28, a: 0.01, trem: { rate: 18, depth: 0.4 } });
      T(V, { type: 'triangle', f: 720, f2: 1080, slide: 0.15, dur: 0.5, vol: 0.08, a: 0.02, lfo: { rate: 7, depth: 20 } });
      T(V, { type: 'sine', f: 1440, dur: 0.4, vol: 0.05, a: 0.003, delay: 0.05, fm: { ratio: 1.5, index: 2, decay: 0.3 } });
      Nz(V, { filter: 'bandpass', f: 1200, f2: 3000, q: 4, dur: 0.3, vol: 0.12, a: 0.02 });
    },
    levelup(V) {
      wet(V, 0.4);
      const run = [60, 64, 67, 72, 76, 79, 84];
      for (let i = 0; i < run.length; i++) {
        T(V, { type: 'square', f: mtof(run[i]), dur: 0.14, vol: 0.05, filter: 'lowpass', ff: 3000, a: 0.002, delay: i * 0.055 });
        T(V, { type: 'triangle', f: mtof(run[i]), dur: 0.2, vol: 0.1, a: 0.002, delay: i * 0.055 });
      }
      const ch = [72, 76, 79, 84];
      for (let i = 0; i < ch.length; i++) T(V, { type: 'sawtooth', f: mtof(ch[i]), dur: 0.9, vol: 0.045, filter: 'lowpass', ff: 2500, a: 0.02, delay: 0.4 });
      T(V, { type: 'sine', f: mtof(96), dur: 0.8, vol: 0.05, a: 0.002, delay: 0.4, fm: { ratio: 3.5, index: 1, decay: 0.3 } });
    },
    pickup(V) {
      wet(V, 0.2);
      T(V, { type: 'sine', f: 1568, dur: 0.1, vol: 0.14, a: 0.001 });
      T(V, { type: 'sine', f: 2093, dur: 0.22, vol: 0.13, a: 0.001, delay: 0.06 });
      T(V, { type: 'triangle', f: 4186, dur: 0.06, vol: 0.03, a: 0.001, delay: 0.06 });
    },

    /* --- 결과 --- */
    victory(V) {
      wet(V, 0.4);
      const mel = [[67, 0, 0.14], [72, 0.12, 0.14], [76, 0.24, 0.16], [79, 0.38, 0.5], [77, 0.9, 0.16], [79, 1.04, 0.16], [84, 1.2, 1.1]];
      for (let i = 0; i < mel.length; i++) brassHit(V, mel[i][0], mel[i][1], mel[i][2], 0.07);
      const ch = [60, 64, 67, 72];
      for (let i = 0; i < ch.length; i++) T(V, { type: 'triangle', f: mtof(ch[i]), dur: 1.2, vol: 0.06, a: 0.02, hold: 0.4, delay: 1.2 });
      T(V, { type: 'sine', f: mtof(96), dur: 1.0, vol: 0.04, a: 0.002, delay: 1.2, fm: { ratio: 3.5, index: 1, decay: 0.3 } });
      Nz(V, { filter: 'highpass', f: 5000, dur: 1.3, vol: 0.08, a: 0.002, delay: 1.2 });
      T(V, { type: 'sine', f: 65.4, dur: 1.2, vol: 0.25, a: 0.01, hold: 0.3, delay: 1.2 });
    },
    defeat(V) {
      wet(V, 0.5);
      T(V, { type: 'sawtooth', f: 400, f2: 60, dur: 0.6, vol: 0.08, filter: 'lowpass', ff: 1500, ff2: 200, a: 0.005 });
      const mel = [[69, 0.1], [67, 0.55], [65, 1.0], [64, 1.45]];
      for (let i = 0; i < mel.length; i++) {
        const last = i === mel.length - 1;
        T(V, { type: 'triangle', f: mtof(mel[i][0]), dur: last ? 1.5 : 0.55, vol: 0.12, a: 0.01, hold: last ? 0.5 : 0.2, delay: mel[i][1] });
        T(V, { type: 'sine', f: mtof(mel[i][0] - 12), dur: last ? 1.5 : 0.55, vol: 0.08, a: 0.02, hold: last ? 0.5 : 0.2, delay: mel[i][1] });
      }
      T(V, { type: 'sine', f: 55, dur: 2.6, vol: 0.18, a: 0.3, hold: 1.2 });
      const ch = [52, 57, 60];
      for (let i = 0; i < ch.length; i++) T(V, { type: 'sawtooth', f: mtof(ch[i]), dur: 1.6, vol: 0.03, filter: 'lowpass', ff: 900, a: 0.2, hold: 0.6, delay: 1.45 });
    },

    /* --- UI --- */
    ui(V) {
      T(V, { type: 'triangle', f: 1250, dur: 0.045, vol: 0.12, a: 0.001 });
      T(V, { type: 'sine', f: 2500, dur: 0.02, vol: 0.025, a: 0.001 });
    },
    uiConfirm(V) {
      T(V, { type: 'triangle', f: 880, dur: 0.08, vol: 0.13, a: 0.001 });
      T(V, { type: 'triangle', f: 1320, dur: 0.15, vol: 0.12, a: 0.001, delay: 0.06 });
      T(V, { type: 'sine', f: 2640, dur: 0.1, vol: 0.035, a: 0.001, delay: 0.06 });
    },
    uiBack(V) {
      T(V, { type: 'triangle', f: 990, dur: 0.07, vol: 0.12, a: 0.001 });
      T(V, { type: 'triangle', f: 660, dur: 0.11, vol: 0.12, a: 0.001, delay: 0.055 });
    },
    text(V) {
      T(V, { type: 'triangle', f: rnd(1750, 2050), dur: 0.022, vol: 0.04, a: 0.001 });
    },
  };

  function releaseVoice(V) {
    safe(() => V.out.disconnect());
    if (V.pan) safe(() => V.pan.disconnect());
    if (V.send) safe(() => V.send.disconnect());
  }

  function sfx(name, opts) {
    try {
      if (!ctx || !N || muted || typeof name !== 'string' || !has(SFX, name)) return;
      if (ctx.state === 'closed') return;
      if (ctx.state !== 'running') {
        if (autoSuspended) return;
        resumeCtx();
      }
      const now = ctx.currentTime;
      const lp = lastPlay[name];
      if (lp != null && now >= lp && now - lp < (RATE[name] || RATE_DEFAULT)) return;
      if (voiceEnds.length) voiceEnds = voiceEnds.filter((e) => e > now);
      if (voiceEnds.length >= MAX_VOICES) return;
      const o = opts && typeof opts === 'object' ? opts : {};
      const v = clamp(num(o.vol, 1), 0, 1);
      if (v < 0.001) return;
      let p = clamp(num(o.pitch, 1), 0.25, 4);
      const j = has(JITTER, name) ? JITTER[name] : 0.02;
      if (j) p *= 1 + (Math.random() * 2 - 1) * j;
      lastPlay[name] = now;

      const V = { t: now + 0.004, p, end: now, src: null, out: gainNode(v * SFX_LEVEL), pan: null, send: null, last: null, d: null };
      const pan = clamp(num(o.pan, 0), -1, 1);
      if (pan && typeof ctx.createStereoPanner === 'function') {
        V.pan = ctx.createStereoPanner();
        V.pan.pan.value = pan;
        V.out.connect(V.pan);
        V.last = V.pan;
      } else {
        V.last = V.out;
      }
      V.last.connect(N.sfx);
      V.d = [V.out];
      SFX[name](V);
      voiceEnds.push(V.end);
      if (V.src) {
        const prev = V.src.onended;
        V.src.onended = () => {
          if (prev) prev();
          releaseVoice(V);
        };
      } else {
        releaseVoice(V);
      }
    } catch (e) {
      /* 효과음 실패는 게임을 멈추지 않음 */
    }
  }

  /* =========================================================
   * 음악 — 악기
   * ========================================================= */
  const outs = (s, echo, verb) => (echo && verb ? [s.bus, s.echo, s.verb] : echo ? [s.bus, s.echo] : verb ? [s.bus, s.verb] : [s.bus]);
  function ms(o) {
    o.zf = true;
    return synth(o);
  }

  // 화음 하나(공유 필터 + 공유 엔벨로프)
  function chordV(s, notes, t, d, o) {
    const rel = o.rel || 0.5;
    const a = Math.max(0.005, Math.min(o.a || 0.01, d));
    const end = t + d + rel;
    const waves = o.waves;
    const det = o.det || [];
    const octs = o.octs || [];
    const nodes = [];
    const env = ctx.createGain();
    nodes.push(env);
    const peak = (o.vol || 0.2) / Math.sqrt(notes.length * waves.length);
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(peak, t + a);
    if (d > a) env.gain.setValueAtTime(peak, t + d);
    env.gain.linearRampToValueAtTime(0, end);
    let input;
    if (o.formants) {
      input = ctx.createGain();
      nodes.push(input);
      for (let i = 0; i < o.formants.length; i++) {
        const fm = o.formants[i];
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = fm[0];
        bp.Q.value = fm[1];
        const fg = gainNode(fm[2]);
        input.connect(bp);
        bp.connect(fg);
        fg.connect(env);
        nodes.push(bp, fg);
      }
    } else {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.Q.value = o.q || 0.7;
      f.frequency.setValueAtTime(o.ff || 1200, t);
      if (o.ff2) f.frequency.linearRampToValueAtTime(o.ff2, t + Math.max(a, d * (o.fpos || 0.6)));
      if (o.ff2 && o.ff3) f.frequency.linearRampToValueAtTime(o.ff3, end);
      f.connect(env);
      input = f;
      nodes.push(f);
    }
    for (let i = 0; i < o.dests.length; i++) env.connect(o.dests[i]);
    let lg = null;
    if (o.vib) {
      const lfo = ctx.createOscillator();
      lfo.frequency.value = o.vib.rate;
      lg = gainNode(o.vib.depth);
      lfo.connect(lg);
      nodes.push(lfo, lg);
      lfo.start(t);
      lfo.stop(end + 0.05);
    }
    const oscs = [];
    for (let n = 0; n < notes.length; n++) {
      for (let w = 0; w < waves.length; w++) {
        const os = ctx.createOscillator();
        os.type = waves[w];
        os.frequency.value = mtof(notes[n] + (octs[w] || 0));
        os.detune.value = (det[w] || 0) + (Math.random() - 0.5) * 4;
        if (lg) lg.connect(os.detune);
        linkZF(os);
        os.connect(input);
        os.start(t);
        os.stop(end + 0.05);
        oscs.push(os);
      }
    }
    oscs[0].onended = () => {
      for (let i = 0; i < oscs.length; i++) {
        unlinkZF(oscs[i]);
        safe(() => oscs[i].disconnect());
      }
      for (let i = 0; i < nodes.length; i++) safe(() => nodes[i].disconnect());
    };
  }

  const INST = {
    /* 화음 악기: (s, notes[], t, dur, vel) */
    pad(s, ns, t, d, v) {
      chordV(s, ns, t, d, { waves: ['sawtooth', 'sawtooth'], det: [-9, 9], ff: 900, ff2: 2400, q: 0.7, a: Math.min(1.2, d * 0.3), rel: 0.9, vol: 0.2 * v, dests: outs(s, 0, 1) });
    },
    darkpad(s, ns, t, d, v) {
      chordV(s, ns, t, d, { waves: ['sawtooth', 'sawtooth', 'triangle'], det: [-10, 10, 0], octs: [0, 0, -12], ff: 600, ff2: 1500, q: 1.2, a: Math.min(1.0, d * 0.3), rel: 0.8, vol: 0.22 * v, dests: outs(s, 0, 1) });
    },
    strings(s, ns, t, d, v) {
      chordV(s, ns, t, d, { waves: ['sawtooth', 'sawtooth'], det: [-6, 7], ff: 1600, ff2: 3200, q: 0.5, a: Math.min(0.8, d * 0.25), rel: 0.8, vol: 0.17 * v, vib: { rate: 5.5, depth: 7 }, dests: outs(s, 0, 1) });
    },
    glass(s, ns, t, d, v) {
      chordV(s, ns, t, d, { waves: ['sine', 'triangle'], det: [0, 5], octs: [0, 12], ff: 4000, a: Math.min(1.5, d * 0.45), rel: 1.3, vol: 0.2 * v, dests: outs(s, 1, 1) });
    },
    choir(s, ns, t, d, v) {
      chordV(s, ns, t, d, { waves: ['sawtooth', 'sawtooth'], det: [-12, 12], formants: [[730, 7, 1], [1090, 9, 0.7], [2440, 12, 0.3]], vib: { rate: 5, depth: 10 }, a: Math.min(1.1, d * 0.35), rel: 1.1, vol: 0.95 * v, dests: outs(s, 0, 1) });
    },
    stab(s, ns, t, d, v) {
      chordV(s, ns, t, 0.12, { waves: ['sawtooth', 'sawtooth'], det: [-8, 8], ff: 3200, ff2: 700, fpos: 1, q: 1.5, a: 0.004, rel: 0.12, vol: 0.24 * v, dests: outs(s, 1, 1) });
    },

    /* 단음 악기: (s, midi, t, dur, vel) */
    sub(s, m, t, d, v) {
      const f = mtof(m);
      ms({ t, type: 'sine', f, dur: d + 0.15, a: 0.02, hold: Math.max(0, d - 0.04), vol: 0.3 * v, dests: [s.bus] });
      ms({ t, type: 'triangle', f: f * 2, dur: d + 0.1, a: 0.02, hold: Math.max(0, d - 0.06), vol: 0.07 * v, dests: [s.bus] });
    },
    bass(s, m, t, d, v) {
      const f = mtof(m);
      ms({ t, type: 'sawtooth', f, dur: d + 0.06, a: 0.004, hold: d * 0.5, vol: 0.22 * v, filter: 'lowpass', ff: 1400, ff2: 260, fslide: 0.18, q: 3, dests: [s.bus] });
      ms({ t, type: 'sine', f, dur: d + 0.06, a: 0.004, hold: d * 0.6, vol: 0.2 * v, dests: [s.bus] });
    },
    growl(s, m, t, d, v) {
      const f = mtof(m);
      ms({ t, type: 'square', f, dur: d + 0.05, a: 0.004, hold: d * 0.6, vol: 0.12 * v, filter: 'lowpass', ff: 2000, ff2: 260, fslide: Math.max(0.08, d), q: 7, dests: [s.bus] });
      ms({ t, type: 'sawtooth', f, detune: 9, dur: d + 0.05, a: 0.004, hold: d * 0.6, vol: 0.1 * v, filter: 'lowpass', ff: 1600, ff2: 300, fslide: Math.max(0.08, d), q: 3, dests: [s.bus] });
      ms({ t, type: 'sine', f, dur: d + 0.05, a: 0.004, hold: d * 0.6, vol: 0.2 * v, dests: [s.bus] });
    },
    reese(s, m, t, d, v) {
      const f = mtof(m);
      ms({ t, type: 'sawtooth', f, detune: -16, dur: d + 0.06, a: 0.006, hold: d * 0.8, vol: 0.12 * v, filter: 'lowpass', ff: 800, q: 2, dests: [s.bus] });
      ms({ t, type: 'sawtooth', f, detune: 16, dur: d + 0.06, a: 0.006, hold: d * 0.8, vol: 0.12 * v, filter: 'lowpass', ff: 700, q: 2, dests: [s.bus] });
      ms({ t, type: 'sine', f, dur: d + 0.06, a: 0.006, hold: d * 0.8, vol: 0.2 * v, dests: [s.bus] });
    },
    pluck(s, m, t, d, v) {
      ms({ t, type: 'sawtooth', f: mtof(m), dur: 0.32, a: 0.002, vol: 0.15 * v, filter: 'lowpass', ff: 3400, ff2: 380, fslide: 0.16, q: 4, dests: outs(s, 1, 0) });
    },
    pluckSq(s, m, t, d, v) {
      ms({ t, type: 'square', f: mtof(m), dur: 0.26, a: 0.002, vol: 0.1 * v, filter: 'lowpass', ff: 2800, ff2: 300, fslide: 0.14, q: 3, dests: outs(s, 1, 0) });
    },
    pluckSoft(s, m, t, d, v) {
      const f = mtof(m);
      ms({ t, type: 'triangle', f, dur: 0.6, a: 0.003, vol: 0.2 * v, filter: 'lowpass', ff: 2500, ff2: 600, fslide: 0.4, dests: outs(s, 1, 1) });
      ms({ t, type: 'sine', f: f * 2, dur: 0.25, a: 0.002, vol: 0.04 * v, dests: [s.bus] });
    },
    bell(s, m, t, d, v) {
      const f = mtof(m);
      ms({ t, type: 'sine', f, dur: Math.max(1.1, d * 1.5), a: 0.003, vol: 0.13 * v, fm: { ratio: 3.5, index: 2.2, decay: 0.25 }, dests: outs(s, 1, 1) });
      ms({ t, type: 'sine', f: f * 2, dur: 0.4, a: 0.002, vol: 0.035 * v, dests: [s.bus] });
    },
    piano(s, m, t, d, v) {
      const f = mtof(m);
      const L = Math.max(1.4, d * 1.6);
      ms({ t, type: 'triangle', f, dur: L, a: 0.003, vol: 0.2 * v, filter: 'lowpass', ff: 3200, ff2: 700, fslide: L * 0.7, dests: outs(s, 0, 1) });
      ms({ t, type: 'sine', f: f * 2.003, dur: L * 0.45, a: 0.002, vol: 0.05 * v, dests: [s.bus] });
      ms({ t, type: 'sine', f, detune: 4, dur: L * 0.8, a: 0.003, vol: 0.08 * v, dests: [s.bus] });
    },
    lead(s, m, t, d, v) {
      const f = mtof(m);
      const vib = { rate: 5.5, depth: 12, delay: 0.18 };
      ms({ t, type: 'sawtooth', f, dur: d + 0.12, a: 0.012, hold: Math.max(0, d - 0.012), vol: 0.09 * v, filter: 'lowpass', ff: 3000, ff2: 1700, fslide: 0.25, q: 1.5, lfo: vib, dests: outs(s, 1, 1) });
      ms({ t, type: 'square', f, detune: 7, dur: d + 0.12, a: 0.012, hold: Math.max(0, d - 0.012), vol: 0.06 * v, filter: 'lowpass', ff: 2600, q: 1, lfo: vib, dests: [s.bus] });
    },
    sync(s, m, t, d, v) {
      const f = mtof(m);
      ms({ t, type: 'square', f: f * 0.94, f2: f, slide: 0.04, dur: d + 0.1, a: 0.008, hold: Math.max(0, d - 0.01), vol: 0.08 * v, filter: 'lowpass', ff: 3500, ff2: 1400, fslide: 0.2, q: 6, lfo: { rate: 6, depth: 10, delay: 0.2 }, dests: outs(s, 1, 1) });
      ms({ t, type: 'sawtooth', f, detune: -5, dur: d + 0.1, a: 0.008, hold: Math.max(0, d - 0.01), vol: 0.07 * v, filter: 'lowpass', ff: 2800, dests: [s.bus] });
    },
    brass(s, m, t, d, v) {
      const f = mtof(m);
      const h = Math.max(0, d - 0.035);
      ms({ t, type: 'sawtooth', f, detune: -7, dur: d + 0.15, a: 0.035, hold: h, vol: 0.1 * v, filter: 'lowpass', ff: 500, ff2: 2600, fslide: 0.09, ff3: 1500, fslide2: 0.4, q: 1.2, lfo: { rate: 5, depth: 8, delay: 0.3 }, dests: outs(s, 1, 1) });
      ms({ t, type: 'sawtooth', f, detune: 7, dur: d + 0.15, a: 0.04, hold: h, vol: 0.09 * v, filter: 'lowpass', ff: 600, ff2: 2200, fslide: 0.1, ff3: 1300, fslide2: 0.4, dests: [s.bus] });
    },
    flute(s, m, t, d, v) {
      const f = mtof(m);
      ms({ t, type: 'sine', f, dur: d + 0.15, a: 0.06, hold: Math.max(0, d - 0.06), vol: 0.2 * v, lfo: { rate: 5, depth: 10, delay: 0.12 }, dests: outs(s, 1, 1) });
      ms({ t, type: 'triangle', f: f * 2, dur: d + 0.1, a: 0.08, hold: Math.max(0, d - 0.08), vol: 0.03 * v, dests: [s.bus] });
    },
  };

  /* 드럼: (s, t, vel) */
  const DR = {
    kick(s, t, v) {
      synth({ t, type: 'sine', f: 155, f2: 46, slide: 0.09, dur: 0.34, a: 0.002, vol: 0.75 * v, dests: [s.bus] });
      noise({ t, filter: 'highpass', f: 2500, dur: 0.015, a: 0.001, vol: 0.2 * v, dests: [s.bus] });
    },
    hkick(s, t, v) {
      synth({ t, type: 'sine', f: 130, f2: 38, slide: 0.12, dur: 0.5, a: 0.002, vol: 0.78 * v, dests: [s.bus] });
      synth({ t, type: 'triangle', f: 75, f2: 45, dur: 0.25, a: 0.002, vol: 0.25 * v, dests: [s.bus] });
      noise({ t, buf: 'brown', filter: 'lowpass', f: 1500, dur: 0.08, a: 0.001, vol: 0.3 * v, dests: [s.bus] });
      noise({ t, filter: 'highpass', f: 3000, dur: 0.012, a: 0.001, vol: 0.14 * v, dests: [s.bus] });
    },
    snare(s, t, v) {
      noise({ t, filter: 'bandpass', f: 1900, q: 0.8, dur: 0.19, a: 0.001, vol: 0.42 * v, dests: [s.bus, s.verb] });
      synth({ t, type: 'triangle', f: 220, f2: 150, dur: 0.11, a: 0.001, vol: 0.26 * v, dests: [s.bus] });
    },
    clap(s, t, v) {
      for (let i = 0; i < 3; i++) {
        noise({ t: t + i * 0.011, filter: 'bandpass', f: 1500, q: 1.2, dur: i === 2 ? 0.16 : 0.012, a: 0.001, vol: 0.3 * v, dests: [s.bus, s.verb] });
      }
    },
    hat(s, t, v) {
      noise({ t, filter: 'highpass', f: 8000, dur: 0.035, a: 0.001, vol: 0.13 * v, dests: [s.bus] });
    },
    ohat(s, t, v) {
      noise({ t, filter: 'highpass', f: 6500, dur: 0.24, a: 0.002, vol: 0.1 * v, dests: [s.bus] });
    },
    rim(s, t, v) {
      synth({ t, type: 'triangle', f: 1000, dur: 0.035, a: 0.001, vol: 0.11 * v, dests: [s.bus, s.echo] });
      noise({ t, filter: 'bandpass', f: 3000, q: 2, dur: 0.02, a: 0.001, vol: 0.1 * v, dests: [s.bus] });
    },
    tom(s, t, v) {
      synth({ t, type: 'sine', f: 150, f2: 85, dur: 0.32, a: 0.002, vol: 0.5 * v, dests: [s.bus, s.verb] });
      noise({ t, filter: 'lowpass', f: 900, dur: 0.06, a: 0.001, vol: 0.15 * v, dests: [s.bus] });
    },
    taiko(s, t, v) {
      synth({ t, type: 'sine', f: 95, f2: 52, slide: 0.18, dur: 0.65, a: 0.002, vol: 0.72 * v, dests: [s.bus, s.verb] });
      synth({ t, type: 'triangle', f: 190, f2: 100, dur: 0.12, a: 0.002, vol: 0.16 * v, dests: [s.bus] });
      noise({ t, filter: 'lowpass', f: 500, dur: 0.14, a: 0.001, vol: 0.32 * v, dests: [s.bus, s.verb] });
    },
    crash(s, t, v) {
      noise({ t, filter: 'highpass', f: 4200, dur: 1.8, a: 0.002, vol: 0.13 * v, dests: [s.bus, s.verb] });
      noise({ t, filter: 'bandpass', f: 7000, q: 0.6, dur: 0.9, a: 0.002, vol: 0.06 * v, dests: [s.bus] });
    },
    riser(s, t, len, v) {
      noise({ t, filter: 'bandpass', f: 400, f2: 7000, q: 1.6, dur: len, a: len * 0.92, swell: true, vol: 0.15 * v, dests: [s.bus, s.verb] });
    },
  };

  /* =========================================================
   * 음악 — 트랙 정의
   *  chords: 마디마다 화음 ('Dm9', 'BbM7', 'A/C#' ...)
   *  bass:   r=근음 o=옥타브 위 f=5도 t=3도 s=7도 l=옥타브 아래  -=이음 .=쉼
   *  arp:    화음 구성음 번호(0~9)  -=이음 .=쉼
   *  lead/lead2: 16분음표 하나마다 토큰 ('A4', 'C#5', '-' 이음, '.' 쉼)
   *  드럼:   x=보통 X=강하게 g=약하게 (hat 의 o=오픈 하이햇)
   *  패턴이 16칸보다 길면 여러 마디에 걸쳐 진행합니다.
   *  like: 다른 섹션을 물려받고 일부만 바꿈.  dbl: lead 를 lead2 악기로 n 반음 위에서 겹침.
   *  fillSnare/fillTom: 섹션 마지막 마디에서 쓰는 필인.  riser: 마지막 마디 상승음.  crash: 섹션 첫 박 심벌.
   * ========================================================= */
  const TRACKS = {
    // 타이틀 — 신비롭고 장대하게 (D 단조)
    title: {
      bpm: 76, echo: 0.75, fb: 0.42, echoMix: 0.32, verbMix: 0.75, gain: 1.0,
      inst: { pad: 'pad', choir: 'choir', arp: 'bell', lead: 'brass', lead2: 'bell', bass: 'sub' },
      kit: { kick: 'hkick' },
      mix: { pad: 1.0, choir: 0.85, arp: 0.9, lead: 1.0, lead2: 0.6, bass: 0.5, kick: 0.75, snare: 0.8, taiko: 0.75, hat: 0.5 },
      order: ['A', 'B', 'C', 'D'],
      sections: {
        A: { chords: ['Dm9', 'BbM7', 'Gm9', 'Asus4'], pad: 1, arp: '0.2.4.3.1.3.2.4.', bass: 'r---------------' },
        B: { like: 'A', chords: ['Dm9', 'BbM7', 'Gm9', 'A'], bass: 'r-------r-------', taiko: 'x.......x..x....', riser: 1 },
        C: {
          chords: ['Bb', 'F', 'C', 'A'], pad: 1, choir: 1, crash: 1,
          arp: '0.1.2.1.0.1.2.1.', bass: 'r-------r---r---',
          kick: 'x.......x.x.....', snare: '........x.......', taiko: '..x...x.....x.x.', hat: '..x...x...x...x.',
          lead: 'D5 - - - - - - - F5 - - - E5 - D5 - |' +
                'C5 - - - - - - - A4 - - - C5 - - - |' +
                'D5 - - - - - - - E5 - F5 - G5 - E5 - |' +
                'E5 - - - - - - - - - - - C#5 - - - ',
        },
        D: {
          like: 'C', dbl: 12, fillSnare: '........x...xxXX',
          lead: 'F5 - - - - - - - A5 - - - G5 - F5 - |' +
                'E5 - - - - - - - C5 - - - F5 - - - |' +
                'G5 - - - - - - - A5 - Bb5 - A5 - G5 - |' +
                'A5 - - - - - - - - - - - - - - - ',
        },
      },
    },

    // 작전 터미널 — 잔잔한 SF 앰비언트 (E 장조)
    hub: {
      bpm: 84, swing: 0.1, echo: 0.75, fb: 0.45, echoMix: 0.38, verbMix: 0.6, gain: 0.78,
      inst: { pad: 'glass', arp: 'pluckSoft', lead: 'flute', lead2: 'bell', bass: 'sub' },
      mix: { pad: 1.0, arp: 0.8, lead: 0.95, lead2: 0.55, bass: 0.45, kick: 0.4, rim: 0.65, hat: 0.4 },
      order: ['A', 'B', 'A2', 'B2'],
      sections: {
        A: {
          chords: ['EM7', 'C#m7', 'AM7', 'Bsus4'], pad: 1, arp: '0..2..1..3..2.4.', bass: 'r-------r-----f-',
          kick: 'x.........x.....', rim: '....x.......x...', hat: '..x...x...x...xg',
        },
        B: {
          like: 'A', chords: ['AM7', 'G#m7', 'F#m7', 'B'],
          lead: 'E5 - - - - - F#5 - G#5 - - - - - - - |' +
                'B5 - - - - - - - G#5 - - - F#5 - - - |' +
                'A5 - - - - - - - F#5 - - - C#5 - - - |' +
                'D#5 - - - - - - - - - - - F#5 - - - ',
        },
        A2: {
          like: 'A', arp: '0.1.2.3.4.3.2.1.',
          lead2: '. . . . . . . . B5 - - - G#5 - - - |' +
                 '. . . . . . . . E5 - - - G#5 - - - |' +
                 '. . . . . . . . C#6 - - - B5 - - - |' +
                 '. . . . . . . . F#5 - - - E5 - - - ',
        },
        B2: { like: 'B', dbl: 12 },
      },
    },

    // 스테이지 — 질주하는 사이버펑크 액션 (E 단조)
    stage: {
      bpm: 132, echo: 0.75, fb: 0.3, echoMix: 0.22, verbMix: 0.28, gain: 1.2,
      inst: { pad: 'pad', arp: 'pluck', lead: 'lead', lead2: 'bell', bass: 'bass', stab: 'stab' },
      mix: { pad: 0.7, arp: 0.85, lead: 1.0, lead2: 0.65, bass: 0.65, kick: 0.8, snare: 0.9, clap: 0.6, hat: 0.75 },
      ghost: 0.06,
      order: ['A', 'B', 'C', 'B2'],
      sections: {
        A: {
          chords: ['Em', 'C', 'G', 'D'], pad: 1, crash: 1,
          bass: 'r.rr.rr.r.rr.ror', arp: '0123432101234321',
          kick: 'x...x...x...x...', snare: '....x.......x...', hat: 'xgXgxgXgxgXgxgXo',
        },
        B: {
          like: 'A', chords: ['Am', 'Em', 'C', 'B'], clap: '....x.......x...', arp: '0..1..2..1..0.2.',
          fillSnare: '....x.......xxxx',
          lead: 'E5 - - - D5 - C5 - - - D5 - E5 - - - |' +
                'B4 - - - - - - - G4 - A4 - B4 - - - |' +
                'C5 - - - D5 - E5 - - - G5 - E5 - D5 - |' +
                'D#5 - - - - - - - F#5 - - - B5 - - - ',
        },
        C: {
          chords: ['C', 'D', 'Em', 'Em'], pad: 1, riser: 1, arp: '0123432101234321',
          bass: 'r-------r-------|r-------r-------|r.rr.rr.r.rr.ror|r.rr.rr.r.rr.ror',
          kick: '................|................|x...x...x...x...|x...x...x...x.x.',
          snare: '................|................|........x.......|....x...x.x.xxxx',
          hat: '................|..x...x...x...x.|xgxgxgxgxgxgxgxg|xxxxxxxxxxxxxxxx',
          lead2: 'G5 - - - - - E5 - - - D5 - - - - - |' +
                 'F#5 - - - - - D5 - - - A4 - - - - - |' +
                 'B4 - - - - - - - - - - - - - - - |' +
                 '. . . . . . . . . . . . . . . . ',
        },
        B2: { like: 'B', dbl: 12 },
      },
    },

    // 후반 스테이지 — 어둡고 거친 브레이크비트 (F 단조)
    stage2: {
      bpm: 140, echo: 0.5, fb: 0.33, echoMix: 0.22, verbMix: 0.25, gain: 1.1,
      inst: { pad: 'darkpad', arp: 'pluckSq', lead: 'sync', lead2: 'lead', bass: 'growl', stab: 'stab' },
      mix: { pad: 0.75, arp: 0.85, lead: 1.0, lead2: 0.6, bass: 0.75, kick: 0.9, snare: 0.95, hat: 0.7, tom: 0.8, stab: 0.7 },
      ghost: 0.08,
      order: ['A', 'B', 'C', 'B2'],
      sections: {
        A: {
          chords: ['Fm', 'Db', 'Ab', 'Eb'], pad: 1, crash: 1,
          bass: 'r..r..r.r..r..o.', arp: '01.20.12.01.2.10',
          kick: 'x..x......x..x..', snare: '....x.......x...', hat: 'x.xxx.xxx.xxx.xx',
        },
        B: {
          like: 'A', chords: ['Bbm', 'Db', 'Fm', 'C'], stab: '......x.......x.', fillSnare: '....x.....x.xxxx',
          lead: 'F5 - - - Db5 - - - Bb4 - - - C5 - Db5 - |' +
                'Eb5 - - - - - Db5 - C5 - - - Ab4 - - - |' +
                'C5 - - - - - - - - - Ab4 - G4 - F4 - |' +
                'E4 - - - G4 - - - Bb4 - - - E5 - - - ',
        },
        C: {
          chords: ['DbM7', 'Eb', 'Csus4', 'C'], pad: 1, riser: 1, arp: '0123012301230123',
          bass: 'r-------r-------|r-------r-------|r..r..r.r..r..o.|r..r..r.r..r..o.',
          kick: 'x...............|x...............|x..x......x..x..|x..x......x.....',
          snare: '........x.......|........x.......|....x.......x...|....x.......x...',
          tom: '................|................|x..x..x.........|x..x..x.x.x.xxxx',
          hat: '..x...x...x...x.|..x...x...x...x.|x.xxx.xxx.xxx.xx|xxxxxxxxxxxxxxxx',
          lead2: 'F5 - - - - - Eb5 - C5 - - - - - Ab4 - |' +
                 'G5 - - - - - Bb5 - G5 - - - Eb5 - - - |' +
                 'F5 - - - - - - - - - - - G5 - - - |' +
                 'E5 - - - - - - - - - - - . . . . ',
        },
        B2: { like: 'B', dbl: 12 },
      },
    },

    // 보스 — 긴박하고 강렬하게 (D 단조, 프리지안 색채)
    boss: {
      bpm: 156, echo: 0.75, fb: 0.25, echoMix: 0.16, verbMix: 0.3, gain: 0.9,
      inst: { pad: 'darkpad', arp: 'pluck', lead: 'brass', lead2: 'lead', bass: 'bass', stab: 'stab' },
      kit: { kick: 'hkick' },
      mix: { pad: 0.75, arp: 0.8, lead: 1.1, lead2: 0.55, bass: 0.75, kick: 0.85, snare: 0.95, hat: 0.65, stab: 0.85, tom: 0.85 },
      ghost: 0.05,
      order: ['A', 'B', 'C', 'B2'],
      sections: {
        A: {
          chords: ['Dm', 'Eb', 'Dm', 'C'], pad: 1, crash: 1,
          bass: 'r.o.r.o.r.o.r.oo', arp: '0102010201020102',
          kick: 'x...x..xx...x...', snare: '....x.......x...', hat: 'xxXxxxXxxxXxxxXx', stab: 'x..x..x.....x...',
        },
        B: {
          like: 'A', chords: ['Bb', 'Gm', 'Eb', 'A'], stab: 'x.......x.......', fillSnare: '....x.......xxXX',
          lead: 'D5 - - - - - D5 - F5 - - - E5 - D5 - |' +
                'D5 - - - - - - - Bb4 - - - A4 - G4 - |' +
                'G4 - - - Bb4 - - - Eb5 - - - D5 - - Eb5 |' +
                'C#5 - - - - - - - E5 - - - A5 - - - ',
        },
        C: {
          chords: ['Dm', 'Dm', 'Bb', 'A'], pad: 1, riser: 1, arp: '0123012301230123',
          bass: 'r.r.r.r.r.r.r.r.',
          kick: 'x.......x.......|x.......x.......|x...x...x...x...|x.x.x.x.x.x.xxxx',
          snare: '........x.......|........x.......|....x.......x...|....x.......x...',
          tom: '................|................|................|x.x.x.x.xxxxXXXX',
          hat: 'x.x.x.x.x.x.x.x.',
          lead2: 'A5 - G5 - F5 - E5 - F5 - - - D5 - - - |' +
                 'A5 - G5 - F5 - E5 - F5 - G5 - A5 - - - |' +
                 'Bb5 - A5 - G5 - F5 - G5 - - - D5 - - - |' +
                 'E5 - - - - - - - C#5 - - - E5 - - - ',
        },
        B2: { like: 'B', dbl: 12, crash: 1 },
      },
    },

    // 라이벌(제로) — 빠르고 공격적인 단조 + 영웅적 동기 (B 단조)
    rival: {
      bpm: 172, echo: 0.75, fb: 0.25, echoMix: 0.18, verbMix: 0.25, gain: 1.07,
      inst: { pad: 'pad', arp: 'pluckSq', lead: 'lead', lead2: 'brass', bass: 'reese', stab: 'stab' },
      mix: { pad: 0.7, arp: 0.85, lead: 1.05, lead2: 0.7, bass: 0.7, kick: 0.9, snare: 0.95, hat: 0.7, stab: 0.7 },
      ghost: 0.1,
      order: ['A', 'B', 'C', 'B2'],
      sections: {
        A: {
          chords: ['Bm', 'G', 'A', 'F#'], pad: 1, crash: 1,
          bass: 'r-----r---r---o-', arp: '0121012101210121',
          kick: 'x.........x.....', snare: '....x.......x...', hat: 'xgxgxgxgxgxgxgxo',
        },
        B: {
          like: 'A', chords: ['Bm', 'D', 'G', 'F#'], stab: '......x.......x.', fillSnare: '....x.....x.xxXX',
          lead: 'F#5 - - - - - B4 - - - C#5 - D5 - E5 - |' +
                'F#5 - - - - - A5 - - - F#5 - - - D5 - |' +
                'G5 - - - - - F#5 - E5 - - - D5 - E5 - |' +
                'F#5 - - - - - - - E5 - D5 - C#5 - A#4 - ',
        },
        C: {
          chords: ['G', 'A', 'Bm', 'Bm'], pad: 1, riser: 1, arp: '0121012101210121',
          bass: 'r-------r-------|r-------r-------|r-----r---r---o-|r-----r---r---o-',
          kick: 'x.......x.......|x.......x.......|x.........x.....|x.........x.x.x.',
          snare: '........x.......|........x.......|....x.......x...|x.x.x.x.xxxxXXXX',
          hat: 'x...x...x...x...|x...x...x...x...|xgxgxgxgxgxgxgxg|xxxxxxxxxxxxxxxx',
          lead2: 'D5 - - - - - - - B4 - - - D5 - - - |' +
                 'E5 - - - - - - - C#5 - - - E5 - - - |' +
                 'F#5 - - - - - - - - - - - - - - - |' +
                 '- - - - - - - - D6 - - - C#6 - - - ',
        },
        B2: { like: 'B', dbl: -12, crash: 1 },
      },
    },

    // 최종 보스(9~10장) — 합창 패드 + 무거운 북 (C 단조)
    final: {
      bpm: 120, echo: 0.75, fb: 0.3, echoMix: 0.18, verbMix: 0.6, gain: 0.86,
      inst: { pad: 'strings', choir: 'choir', arp: 'pluck', lead: 'brass', lead2: 'bell', bass: 'sub' },
      kit: { kick: 'hkick' },
      mix: { pad: 0.75, choir: 1.0, arp: 0.75, lead: 1.1, lead2: 0.65, bass: 0.5, kick: 0.85, snare: 0.95, taiko: 0.85, hat: 0.6, tom: 0.9 },
      order: ['A', 'B', 'A2', 'C'],
      sections: {
        A: {
          chords: ['Cm', 'Ab', 'Eb', 'Bb'], choir: 1, pad: 1, crash: 1,
          arp: '0012001200120012', bass: 'r-------r---r---',
          kick: 'x.....x.x.......', snare: '........x.......', taiko: '..x.......x.x...',
        },
        B: {
          like: 'A', chords: ['Fm', 'Ab', 'G', 'G'], hat: 'x.x.x.x.x.x.x.x.', taiko: '..x...x...x.x.x.',
          fillTom: 'x.x.x.x.xxxxXXXX',
          lead: 'C5 - - - - - - - Ab4 - - - C5 - - - |' +
                'Eb5 - - - - - - - F5 - - - Eb5 - - - |' +
                'D5 - - - - - - - G5 - - - F5 - - - |' +
                'D5 - - - - - - - B4 - - - D5 - - - ',
        },
        A2: {
          like: 'A', hat: 'xgxgxgxgxgxgxgxg',
          lead2: 'G5 - - - - - - - Eb5 - - - - - - - |' +
                 'C6 - - - - - - - Ab5 - - - - - - - |' +
                 'Bb5 - - - - - - - G5 - - - - - - - |' +
                 'F5 - - - - - - - D5 - - - - - - - ',
        },
        C: {
          chords: ['Ab', 'Bb', 'Cm', 'Cm'], choir: 1, pad: 1, riser: 1,
          arp: '0012001200120012', bass: 'r-------r---r---',
          kick: 'x.....x.x.....x.', snare: '........x.......', taiko: 'x.x...x...x.x.x.', hat: 'x.x.x.x.x.x.x.x.',
          fillSnare: '....x...x.x.xxxx',
          lead: 'C5 - - - Eb5 - - - Ab5 - - - G5 - - - |' +
                'F5 - - - - - - - D5 - - - Bb4 - - - |' +
                'C5 - - - - - - - - - - - - - - - |' +
                '- - - - - - - - . . . . . . . . ',
        },
      },
    },

    // 회상 — 슬픈 피아노 (A 단조)
    memory: {
      bpm: 72, echo: 0.5, fb: 0.35, echoMix: 0.26, verbMix: 0.7, gain: 1.23,
      inst: { pad: 'strings', arp: 'piano', lead: 'piano', bass: 'sub' },
      mix: { pad: 0.55, arp: 0.8, lead: 1.15, bass: 0.3 },
      order: ['A', 'A2', 'B', 'A2'],
      sections: {
        A: { chords: ['Am', 'FM7', 'C', 'G'], pad: 1, arp: '0.1.2.3.4.3.2.1.', bass: 'r---------------' },
        A2: {
          like: 'A',
          lead: 'E5 - - - - - - - D5 - C5 - - - B4 - |' +
                'C5 - - - - - - - A4 - - - - - - - |' +
                'G4 - - - - - - - C5 - - - E5 - - - |' +
                'D5 - - - - - - - - - - - - - - - ',
        },
        B: {
          like: 'A', chords: ['Dm7', 'Am', 'FM7', 'E'],
          lead: 'F5 - - - - - E5 - D5 - - - C5 - - - |' +
                'E5 - - - - - - - A4 - - - - - - - |' +
                'A5 - - - - - G5 - F5 - - - E5 - - - |' +
                'G#4 - - - - - - - B4 - - - D5 - - - ',
        },
      },
    },

    // 엔딩 — 희망적이면서 아련하게 (D 장조)
    ending: {
      bpm: 88, swing: 0.06, echo: 0.75, fb: 0.35, echoMix: 0.3, verbMix: 0.6, gain: 1.03,
      inst: { pad: 'pad', arp: 'piano', lead: 'flute', lead2: 'bell', bass: 'sub' },
      mix: { pad: 0.85, arp: 0.75, lead: 1.0, lead2: 0.55, bass: 0.4, kick: 0.45, rim: 0.65, hat: 0.4 },
      order: ['A', 'A2', 'B', 'C'],
      sections: {
        A: { chords: ['D', 'A/C#', 'Bm', 'G'], pad: 1, arp: '0.1.2.3.2.1.2.3.', bass: 'r-------r---f---' },
        A2: {
          like: 'A',
          lead: 'F#5 - - - - - E5 - D5 - - - A4 - - - |' +
                'E5 - - - - - - - C#5 - - - A4 - - - |' +
                'D5 - - - - - - - F#5 - - - B5 - - - |' +
                'A5 - - - - - - - G5 - - - F#5 - E5 - ',
        },
        B: {
          like: 'A', chords: ['Em7', 'G', 'D/F#', 'A'], crash: 1,
          kick: 'x.......x.......', rim: '....x.......x...', hat: '..x...x...x...x.',
          lead: 'G5 - - - - - F#5 - E5 - - - D5 - - - |' +
                'B4 - - - - - - - D5 - - - G5 - - - |' +
                'F#5 - - - - - - - A5 - - - D6 - - - |' +
                'C#6 - - - - - - - B5 - - - A5 - - - ',
        },
        C: {
          like: 'B', chords: ['G', 'A', 'F#m', 'Bm'], dbl: 12, crash: 0,
          lead: 'B5 - - - - - A5 - G5 - - - D5 - - - |' +
                'E5 - - - - - - - C#5 - - - E5 - - - |' +
                'A5 - - - - - - - F#5 - - - C#5 - - - |' +
                'D5 - - - - - - - - - - - - - - - ',
        },
      },
    },
  };

  const MIX_DEFAULT = {
    pad: 0.8, choir: 0.8, arp: 0.7, lead: 0.8, lead2: 0.6, bass: 0.85, stab: 0.7,
    kick: 1, snare: 0.85, clap: 0.6, hat: 0.6, tom: 0.8, taiko: 0.9, rim: 0.6, crash: 0.8, riser: 0.9,
  };
  const DRUM_LANES = ['kick', 'snare', 'clap', 'hat', 'tom', 'taiko', 'rim'];
  const STR_LANES = ['bass', 'arp', 'stab', 'fillSnare', 'fillTom'].concat(DRUM_LANES);
  const MEL_LANES = ['lead', 'lead2'];

  /* ---------------- 트랙 해석(처음 쓸 때 한 번) ---------------- */
  const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const QUAL = {
    '': [0, 4, 7], m: [0, 3, 7], 7: [0, 4, 7, 10], m7: [0, 3, 7, 10], M7: [0, 4, 7, 11], m9: [0, 3, 7, 10, 14],
    M9: [0, 4, 7, 11, 14], add9: [0, 4, 7, 14], madd9: [0, 3, 7, 14], sus2: [0, 2, 7], sus4: [0, 5, 7],
    '7sus4': [0, 5, 7, 10], dim: [0, 3, 6], aug: [0, 4, 8], 5: [0, 7, 12], 6: [0, 4, 7, 9], m6: [0, 3, 7, 9],
  };
  function pcOf(letter, acc) {
    return (PC[letter] + (acc === '#' ? 1 : acc === 'b' ? -1 : 0) + 12) % 12;
  }
  function noteNum(tok) {
    const m = /^([A-G])([#b]?)(-?\d)$/.exec(tok);
    if (!m) return null;
    return PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (parseInt(m[3], 10) + 1) * 12;
  }
  function parseChord(str) {
    const parts = String(str).split('/');
    const m = /^([A-G])([#b]?)(.*)$/.exec(parts[0]);
    if (!m) return null;
    const pc = pcOf(m[1], m[2]);
    const iv = has(QUAL, m[3]) ? QUAL[m[3]] : QUAL[''];
    let base = 48 + pc;
    if (base < 53) base += 12;
    const tones = iv.map((i) => base + i);
    let rb = 36 + pc;
    if (rb > 43) rb -= 12;
    let bass = rb;
    if (parts[1]) {
      const sm = /^([A-G])([#b]?)$/.exec(parts[1]);
      if (sm) {
        bass = 36 + pcOf(sm[1], sm[2]);
        if (bass > 43) bass -= 12;
      }
    }
    const third = iv[1];
    const sev = iv.indexOf(11) >= 0 ? 11 : 10;
    return { tones, bass, rb, third, sev };
  }
  const strip = (s) => String(s).replace(/[\s|]/g, '');
  function parseMel(s) {
    return String(s)
      .split(/[\s|]+/)
      .filter(Boolean)
      .map((tok) => (tok === '.' ? null : tok === '-' ? '-' : noteNum(tok)));
  }
  function resolveSec(def, name, depth) {
    const S = def.sections[name];
    if (!S) return {};
    if (S.like && depth < 6) return Object.assign({}, resolveSec(def, S.like, depth + 1), S);
    return Object.assign({}, S);
  }
  const compiled = Object.create(null);
  function getTrack(id) {
    if (compiled[id]) return compiled[id];
    const def = TRACKS[id];
    const secs = {};
    for (const name of Object.keys(def.sections)) {
      const P = resolveSec(def, name, 0);
      P.chordObjs = P.chords.map(parseChord).filter(Boolean);
      P.bars = P.chordObjs.length;
      for (const l of STR_LANES) P[l] = P[l] ? strip(P[l]) : '';
      for (const l of MEL_LANES) P[l] = P[l] ? parseMel(P[l]) : null;
      secs[name] = P;
    }
    const arr = [];
    for (const name of def.order) {
      const P = secs[name];
      for (let b = 0; b < P.bars; b++) arr.push({ P, b });
    }
    const tr = Object.assign({}, def, { secs, arr, mix: Object.assign({}, MIX_DEFAULT, def.mix || {}), kit: def.kit || {} });
    compiled[id] = tr;
    return tr;
  }

  /* ---------------- 시퀀서 ---------------- */
  // 이음표(-) 개수를 세어 길이(스텝 수)를 구함
  function tieLen(lane, i) {
    let n = 1;
    const L = lane.length;
    while (n < L && lane[(i + n) % L] === '-') n++;
    return n;
  }
  function arpTone(ch, i) {
    const tn = ch.tones;
    return tn[i % tn.length] + 12 * Math.floor(i / tn.length);
  }
  function bassNote(ch, c) {
    switch (c) {
      case 'r': return ch.bass;
      case 'o': return ch.bass + 12;
      case 'f': return ch.rb + 7;
      case 't': return ch.rb + ch.third;
      case 's': return ch.rb + ch.sev;
      case 'l': return ch.bass - 12 >= 28 ? ch.bass - 12 : ch.bass;
      default: return null;
    }
  }
  const velOf = (c) => (c === 'X' ? 1.25 : c === 'g' ? 0.45 : 1);
  const shift = (arr, n) => (n ? arr.map((m) => m + n) : arr);

  function playStep(s, t, sd) {
    const tr = s.tr;
    const st = s.step % 16;
    const barAbs = Math.floor(s.step / 16);
    const slot = tr.arr[barAbs % tr.arr.length];
    const P = slot.P;
    const b = slot.b;
    const ch = P.chordObjs[b];
    const idx = b * 16 + st;
    const M = tr.mix;
    const tt = st & 1 ? t + (tr.swing || 0) * sd : t;
    const lastBar = b === P.bars - 1;
    const barLen = sd * 16;

    if (st === 0) {
      if (P.pad) INST[tr.inst.pad || 'pad'](s, shift(ch.tones, tr.padOct || 0), t, barLen, M.pad);
      if (P.choir) INST[tr.inst.choir || 'choir'](s, shift(ch.tones, tr.choirOct || 0), t, barLen, M.choir);
      if (P.crash && b === 0) DR.crash(s, t, M.crash);
      if (P.riser && lastBar) DR.riser(s, t, barLen, M.riser);
    }

    // 베이스
    if (P.bass) {
      const c = P.bass[idx % P.bass.length];
      const m = bassNote(ch, c);
      if (m != null) INST[tr.inst.bass || 'bass'](s, m + (tr.bassOct || 0), tt, tieLen(P.bass, idx % P.bass.length) * sd * 0.95, M.bass);
    }

    // 아르페지오
    if (P.arp) {
      const c = P.arp[idx % P.arp.length];
      if (c >= '0' && c <= '9') {
        const up = tr.arpUp && s.pass % 2 === 1 ? 12 : 0;
        INST[tr.inst.arp || 'pluck'](s, arpTone(ch, c.charCodeAt(0) - 48) + (tr.arpOct || 0) + up, tt, tieLen(P.arp, idx % P.arp.length) * sd, M.arp);
      }
    }

    // 리드 멜로디
    for (let li = 0; li < MEL_LANES.length; li++) {
      const lane = P[MEL_LANES[li]];
      if (!lane) continue;
      const i = idx % lane.length;
      const m = lane[i];
      if (typeof m !== 'number') continue;
      const d = tieLen(lane, i) * sd;
      if (li === 0) {
        INST[tr.inst.lead || 'lead'](s, m, tt, d, M.lead);
        if (P.dbl) INST[tr.inst.lead2 || 'bell'](s, m + P.dbl, tt, d, M.lead2);
      } else {
        INST[tr.inst.lead2 || 'bell'](s, m, tt, d, M.lead2);
      }
    }

    // 화음 스탭
    if (P.stab) {
      const c = P.stab[idx % P.stab.length];
      if (c !== '.' && c !== '-') INST[tr.inst.stab || 'stab'](s, shift(ch.tones, tr.padOct || 0), tt, sd, M.stab * velOf(c));
    }

    // 드럼
    for (let di = 0; di < DRUM_LANES.length; di++) {
      const lane = DRUM_LANES[di];
      let pat = P[lane];
      let pi = idx;
      if (lastBar && lane === 'snare' && P.fillSnare) {
        pat = P.fillSnare;
        pi = st;
      } else if (lastBar && lane === 'tom' && P.fillTom) {
        pat = P.fillTom;
        pi = st;
      }
      if (!pat) {
        continue;
      }
      const c = pat[pi % pat.length];
      if (c === '.' || c === '-') {
        if (lane === 'snare' && tr.ghost && st % 2 === 1 && Math.random() < tr.ghost) DR.snare(s, tt, 0.25 * M.snare);
        continue;
      }
      if (lane === 'hat') {
        if (c === 'o') DR.ohat(s, tt, M.hat);
        else DR.hat(s, tt, M.hat * velOf(c) * rnd(0.78, 1.05));
        continue;
      }
      const fn = DR[tr.kit[lane] || lane];
      if (fn) fn(s, tt, (M[lane] != null ? M[lane] : 1) * velOf(c));
    }
  }

  function tick(s) {
    if (!s.alive) return;
    if (ctx && ctx.state === 'running') {
      const now = ctx.currentTime;
      if (s.next < now - 0.15) s.next = now + 0.03; // 많이 밀렸으면 건너뜀
      let guard = 0;
      while (s.next < now + LOOKAHEAD && guard++ < 48) {
        const target = zfOn ? ZF_TEMPO : 1;
        s.tempo += (target - s.tempo) * 0.25;
        if (Math.abs(target - s.tempo) < 0.002) s.tempo = target;
        const sd = 60 / s.tr.bpm / 4 / s.tempo;
        if (!s.stopAt || s.next < s.stopAt) {
          try {
            s.pass = Math.floor(Math.floor(s.step / 16) / s.tr.arr.length);
            playStep(s, s.next, sd);
          } catch (e) {
            /* 한 스텝이 실패해도 음악은 계속 */
          }
        }
        s.next += sd;
        s.step++;
      }
    }
    s.timer = setTimeout(() => tick(s), TICK_MS);
  }

  function startSession(id) {
    const tr = getTrack(id);
    const now = ctx.currentTime;
    const t0 = now + 0.06;
    const s = { id, tr, step: 0, pass: 0, next: t0, tempo: zfOn ? ZF_TEMPO : 1, alive: true, timer: null, stopAt: 0 };
    s.bus = gainNode(0);
    s.bus.gain.setValueAtTime(0, now);
    s.bus.gain.linearRampToValueAtTime(tr.gain || 1, now + XFADE);
    s.bus.connect(N.musicIn);
    s.verb = gainNode(0);
    s.verb.gain.setValueAtTime(0, now);
    s.verb.gain.linearRampToValueAtTime(tr.verbMix != null ? tr.verbMix : 0.4, now + XFADE);
    s.verb.connect(N.musicVerbIn);
    // 템포에 맞춘 피드백 딜레이
    s.echo = gainNode(tr.echoMix != null ? tr.echoMix : 0.2);
    s.dly = ctx.createDelay(2);
    s.dly.delayTime.value = Math.min(1.9, (60 / tr.bpm) * (tr.echo || 0.75));
    s.fb = gainNode(tr.fb != null ? tr.fb : 0.3);
    s.dlp = ctx.createBiquadFilter();
    s.dlp.type = 'lowpass';
    s.dlp.frequency.value = 2600;
    s.echo.connect(s.dly);
    s.dly.connect(s.dlp);
    s.dlp.connect(s.fb);
    s.fb.connect(s.dly);
    s.dlp.connect(s.bus);
    tick(s);
    return s;
  }

  function killSession(s) {
    s.alive = false;
    if (s.timer) clearTimeout(s.timer);
    for (const k of ['bus', 'verb', 'echo', 'dly', 'fb', 'dlp']) if (s[k]) safe(() => s[k].disconnect());
  }

  function fadeOutSession(s) {
    if (!s) return;
    const now = ctx.currentTime;
    for (const p of [s.bus.gain, s.verb.gain]) {
      holdNow(p, now);
      p.linearRampToValueAtTime(0, now + XFADE);
    }
    s.stopAt = now + XFADE;
    setTimeout(() => killSession(s), (XFADE + 0.4) * 1000);
  }

  function music(trackId) {
    try {
      const id = trackId === 'none' || trackId == null ? 'none' : String(trackId);
      if (id !== 'none' && !has(TRACKS, id)) return; // 모르는 트랙은 무시
      if (id === wantTrack) return; // 같은 트랙이면 그대로
      wantTrack = id;
      if (!ctx || !N) return; // init() 때 시작
      const old = cur;
      cur = null;
      if (old) fadeOutSession(old);
      if (id !== 'none') cur = startSession(id);
    } catch (e) {
      /* 무시 */
    }
  }

  /* =========================================================
   * 볼륨 / 연출
   * ========================================================= */
  function applyVolumes() {
    if (!ctx || !N) return;
    const now = ctx.currentTime;
    N.master.gain.setTargetAtTime(muted ? 0 : vol.master, now, 0.04);
    N.sfx.gain.setTargetAtTime(vol.sfx, now, 0.04);
    N.musicVol.gain.setTargetAtTime(vol.music, now, 0.04);
  }

  function setVolumes(v) {
    try {
      if (!v || typeof v !== 'object') return;
      for (const k of ['master', 'music', 'sfx']) {
        if (typeof v[k] === 'number' && isFinite(v[k])) vol[k] = clamp(v[k], 0, 1);
      }
      applyVolumes();
    } catch (e) {
      /* 무시 */
    }
  }

  function setMuted(m) {
    try {
      muted = !!m;
      applyVolumes();
    } catch (e) {
      /* 무시 */
    }
  }

  // ZERO FRAME: 음악에 저역 통과(→600Hz) + 살짝 낮은 피치 + 느린 템포. 끄면 원래대로.
  function zeroFrame(on) {
    try {
      const want = !!on;
      if (want === zfOn) return;
      zfOn = want;
      if (!ctx || !N) return;
      const now = ctx.currentTime;
      const fr = N.zf.frequency;
      holdNow(fr, now);
      fr.exponentialRampToValueAtTime(want ? ZF_CUTOFF : nyq, now + (want ? 0.45 : 0.6));
      holdNow(N.zf.Q, now);
      N.zf.Q.setTargetAtTime(want ? 2 : 0.7, now, 0.15);
      if (N.zfDet) {
        holdNow(N.zfDet.offset, now);
        N.zfDet.offset.setTargetAtTime(want ? ZF_DETUNE : 0, now, want ? 0.15 : 0.22);
      }
    } catch (e) {
      /* 무시 */
    }
  }

  // 잠시 음악 줄이기: amount(0..1) 만큼 줄였다가 seconds 뒤에 돌아옴
  function duck(amount, seconds) {
    try {
      if (!ctx || !N) return;
      const a = clamp(num(amount, 0.5), 0, 1);
      const d = clamp(num(seconds, 1), 0.05, 60);
      const now = ctx.currentTime;
      const p = N.duck.gain;
      holdNow(p, now);
      p.setTargetAtTime(Math.max(0.0001, 1 - a), now, 0.06);
      p.setTargetAtTime(1, now + d, 0.3);
    } catch (e) {
      /* 무시 */
    }
  }

  /* ---------------- 디버그(테스트용, 해 없음) ---------------- */
  const _debugNode = () => (N ? N.out : null);
  const _info = () => ({
    sfx: Object.keys(SFX),
    tracks: Object.keys(TRACKS),
    track: wantTrack,
    voices: ctx ? voiceEnds.filter((e) => e > ctx.currentTime).length : 0,
    state: ctx ? ctx.state : 'none',
    zeroFrame: zfOn,
    muted,
    volumes: Object.assign({}, vol),
  });

  return { init, sfx, music, setVolumes, setMuted, zeroFrame, duck, isReady, _debugNode, _info };
})();
