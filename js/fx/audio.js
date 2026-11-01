'use strict';

/* =========================================================
 * 사운드 — WebAudio 로 효과음과 배경음악을 실시간 합성합니다. (외부 파일 없음)
 * ========================================================= */
CB.audio = (() => {
  let ctx = null;
  let master = null;
  let sfxBus = null;
  let musicBus = null;
  let noiseBuf = null;
  const vol = { master: 0.8, sfx: 0.8, music: 0.5 };
  let muted = false;
  const lastPlay = {};
  let wantedTrack = 'none';

  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const rand = (a, b) => a + Math.random() * (b - a);

  function init() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      ctx = new AC();
    } catch (e) {
      ctx = null;
      return;
    }
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 10;
    comp.ratio.value = 5;
    comp.attack.value = 0.004;
    comp.release.value = 0.2;
    master = ctx.createGain();
    sfxBus = ctx.createGain();
    musicBus = ctx.createGain();
    sfxBus.connect(master);
    musicBus.connect(master);
    master.connect(comp);
    comp.connect(ctx.destination);

    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    applyVolume();
    document.addEventListener('visibilitychange', () => {
      if (!ctx) return;
      if (document.hidden) ctx.suspend();
      else ctx.resume();
    });
    if (wantedTrack !== 'none') {
      const t = wantedTrack;
      wantedTrack = 'none';
      music(t);
    }
  }

  function applyVolume() {
    if (!ctx) return;
    const now = ctx.currentTime;
    master.gain.setTargetAtTime(muted ? 0 : vol.master, now, 0.05);
    sfxBus.gain.setTargetAtTime(vol.sfx, now, 0.05);
    musicBus.gain.setTargetAtTime(vol.music * 0.55, now, 0.05);
  }

  function setVolume(v = {}) {
    for (const k of ['master', 'sfx', 'music']) if (typeof v[k] === 'number') vol[k] = Math.max(0, Math.min(1, v[k]));
    applyVolume();
  }
  function setMuted(m) { muted = !!m; applyVolume(); }
  const isMuted = () => muted;

  /* ---------------- 합성 도우미 ---------------- */
  function tone(o) {
    const t = (o.t != null ? o.t : ctx.currentTime) + (o.delay || 0);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.freq, t);
    if (o.freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.freqEnd), t + (o.slide || o.dur));
    if (o.detune) osc.detune.value = o.detune;
    const peak = o.vol != null ? o.vol : 0.3;
    const a = o.attack != null ? o.attack : 0.005;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    let node = osc;
    if (o.filter) {
      const f = ctx.createBiquadFilter();
      f.type = o.filter;
      f.frequency.setValueAtTime(o.ffreq || 1200, t);
      if (o.ffreqEnd) f.frequency.exponentialRampToValueAtTime(o.ffreqEnd, t + o.dur);
      f.Q.value = o.q || 1;
      osc.connect(f);
      node = f;
    }
    node.connect(g);
    g.connect(o.dest || sfxBus);
    osc.start(t);
    osc.stop(t + o.dur + 0.05);
  }

  function noise(o) {
    const t = (o.t != null ? o.t : ctx.currentTime) + (o.delay || 0);
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = o.filter || 'bandpass';
    f.frequency.setValueAtTime(o.freq || 1000, t);
    if (o.freqEnd) f.frequency.exponentialRampToValueAtTime(Math.max(20, o.freqEnd), t + o.dur);
    f.Q.value = o.q || 1;
    const g = ctx.createGain();
    const peak = o.vol != null ? o.vol : 0.3;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + (o.attack || 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    src.connect(f);
    f.connect(g);
    g.connect(o.dest || sfxBus);
    src.start(t, Math.random() * 0.5);
    src.stop(t + o.dur + 0.05);
  }

  /* ---------------- 효과음 ---------------- */
  const SFX = {
    click: (p) => { tone({ type: 'triangle', freq: 880 * p, freqEnd: 660 * p, dur: 0.06, vol: 0.18 }); },
    hover: (p) => { tone({ type: 'sine', freq: 1320 * p, dur: 0.04, vol: 0.05 }); },
    select: (p) => { tone({ type: 'triangle', freq: 660 * p, dur: 0.08, vol: 0.16 }); tone({ type: 'triangle', freq: 990 * p, dur: 0.1, vol: 0.14, delay: 0.05 }); },
    error: () => { tone({ type: 'square', freq: 180, freqEnd: 120, dur: 0.16, vol: 0.12, filter: 'lowpass', ffreq: 900 }); },
    cardDraw: (p) => { noise({ filter: 'highpass', freq: 3000 * p, dur: 0.07, vol: 0.12 }); },
    cardPlay: (p) => { noise({ filter: 'bandpass', freq: 1400 * p, freqEnd: 4000, q: 0.8, dur: 0.16, vol: 0.22 }); tone({ type: 'sine', freq: 520 * p, freqEnd: 780 * p, dur: 0.12, vol: 0.08 }); },
    shuffle: () => { for (let i = 0; i < 6; i++) noise({ filter: 'highpass', freq: 2500 + i * 200, dur: 0.05, vol: 0.1, delay: i * 0.045 }); },
    attack: (p) => {
      noise({ filter: 'bandpass', freq: 900 * p, freqEnd: 5000, q: 1.2, dur: 0.14, vol: 0.32 });
      tone({ type: 'sine', freq: 160 * p, freqEnd: 50, dur: 0.18, vol: 0.5, delay: 0.06 });
      noise({ filter: 'lowpass', freq: 1800, dur: 0.1, vol: 0.25, delay: 0.06 });
    },
    heavyAttack: (p) => {
      noise({ filter: 'bandpass', freq: 600 * p, freqEnd: 3500, q: 1, dur: 0.2, vol: 0.35 });
      tone({ type: 'sine', freq: 110 * p, freqEnd: 32, dur: 0.38, vol: 0.7, delay: 0.08 });
      tone({ type: 'square', freq: 80, freqEnd: 40, dur: 0.2, vol: 0.14, delay: 0.08, filter: 'lowpass', ffreq: 500 });
      noise({ filter: 'lowpass', freq: 1200, freqEnd: 200, dur: 0.35, vol: 0.4, delay: 0.08 });
    },
    enemyAttack: (p) => {
      noise({ filter: 'bandpass', freq: 500 * p, freqEnd: 2200, q: 1.5, dur: 0.18, vol: 0.28 });
      tone({ type: 'sawtooth', freq: 140 * p, freqEnd: 60, dur: 0.22, vol: 0.18, filter: 'lowpass', ffreq: 700, delay: 0.05 });
      tone({ type: 'sine', freq: 120, freqEnd: 40, dur: 0.25, vol: 0.45, delay: 0.07 });
    },
    block: (p) => {
      tone({ type: 'square', freq: 520 * p, dur: 0.25, vol: 0.1, filter: 'bandpass', ffreq: 2400, q: 8 });
      tone({ type: 'sine', freq: 1560 * p, dur: 0.35, vol: 0.12 });
      tone({ type: 'sine', freq: 2340 * p, dur: 0.22, vol: 0.06 });
    },
    blockHit: (p) => {
      tone({ type: 'triangle', freq: 300 * p, freqEnd: 200, dur: 0.18, vol: 0.25 });
      tone({ type: 'sine', freq: 1900 * p, dur: 0.25, vol: 0.1 });
      noise({ filter: 'highpass', freq: 4000, dur: 0.12, vol: 0.18 });
    },
    heal: (p) => { [0, 4, 7, 12].forEach((s, i) => tone({ type: 'sine', freq: mtof(72 + s) * p, dur: 0.4, vol: 0.12, delay: i * 0.06 })); },
    poison: (p) => { for (let i = 0; i < 4; i++) tone({ type: 'sine', freq: rand(300, 600) * p, freqEnd: rand(700, 1100), dur: 0.09, vol: 0.1, delay: i * 0.05 }); },
    buff: (p) => { tone({ type: 'triangle', freq: 440 * p, freqEnd: 880 * p, dur: 0.3, vol: 0.18 }); tone({ type: 'sine', freq: 660 * p, freqEnd: 1320 * p, dur: 0.3, vol: 0.1, delay: 0.05 }); },
    debuff: (p) => { tone({ type: 'sawtooth', freq: 500 * p, freqEnd: 180, dur: 0.35, vol: 0.12, filter: 'lowpass', ffreq: 1400 }); },
    energy: (p) => { tone({ type: 'square', freq: 660 * p, freqEnd: 1320 * p, dur: 0.14, vol: 0.08, filter: 'lowpass', ffreq: 3000 }); },
    death: () => {
      tone({ type: 'sawtooth', freq: 400, freqEnd: 50, dur: 0.9, vol: 0.18, filter: 'lowpass', ffreq: 1600, ffreqEnd: 200 });
      noise({ filter: 'lowpass', freq: 2000, freqEnd: 100, dur: 0.9, vol: 0.25 });
    },
    victory: () => { [60, 64, 67, 72, 76].forEach((m, i) => tone({ type: 'triangle', freq: mtof(m), dur: 0.5, vol: 0.16, delay: i * 0.09 })); tone({ type: 'sine', freq: mtof(84), dur: 0.9, vol: 0.1, delay: 0.45 }); },
    defeat: () => { [64, 60, 57, 52].forEach((m, i) => tone({ type: 'triangle', freq: mtof(m), dur: 0.6, vol: 0.16, delay: i * 0.22 })); },
    gold: (p) => { [0, 0.07, 0.13].forEach((d, i) => { tone({ type: 'sine', freq: (1800 + i * 300) * p, dur: 0.18, vol: 0.1, delay: d }); tone({ type: 'square', freq: (3600 + i * 600) * p, dur: 0.06, vol: 0.03, delay: d }); }); },
    relic: () => { [72, 76, 79, 84, 88].forEach((m, i) => tone({ type: 'sine', freq: mtof(m), dur: 0.6, vol: 0.1, delay: i * 0.07 })); noise({ filter: 'highpass', freq: 6000, dur: 0.5, vol: 0.06 }); },
    potion: (p) => { for (let i = 0; i < 5; i++) tone({ type: 'sine', freq: rand(400, 900) * p, freqEnd: rand(900, 1600), dur: 0.08, vol: 0.12, delay: i * 0.04 }); },
    turnStart: () => { tone({ type: 'triangle', freq: mtof(67), dur: 0.2, vol: 0.12 }); tone({ type: 'triangle', freq: mtof(74), dur: 0.3, vol: 0.12, delay: 0.1 }); },
    mapStep: (p) => { tone({ type: 'sine', freq: 220 * p, freqEnd: 160, dur: 0.12, vol: 0.2 }); noise({ filter: 'lowpass', freq: 800, dur: 0.08, vol: 0.12 }); },
    shopBuy: () => { SFX.gold(1); tone({ type: 'triangle', freq: mtof(79), dur: 0.25, vol: 0.1, delay: 0.15 }); },
    upgrade: () => { [0, 4, 7, 11, 14, 19].forEach((s, i) => tone({ type: 'triangle', freq: mtof(67 + s), dur: 0.3, vol: 0.1, delay: i * 0.05 })); noise({ filter: 'highpass', freq: 5000, dur: 0.4, vol: 0.05, delay: 0.2 }); },
    bossRoar: () => {
      tone({ type: 'sawtooth', freq: 90, freqEnd: 55, dur: 1.4, vol: 0.3, filter: 'lowpass', ffreq: 600, ffreqEnd: 200, attack: 0.15 });
      tone({ type: 'sawtooth', freq: 93, freqEnd: 52, dur: 1.4, vol: 0.2, filter: 'lowpass', ffreq: 500, attack: 0.2 });
      noise({ filter: 'bandpass', freq: 400, freqEnd: 150, q: 2, dur: 1.3, vol: 0.3, attack: 0.15 });
    },
    exhaust: (p) => { noise({ filter: 'bandpass', freq: 1200 * p, freqEnd: 300, q: 2, dur: 0.4, vol: 0.18 }); tone({ type: 'sine', freq: 600, freqEnd: 200, dur: 0.35, vol: 0.06 }); },
  };

  function play(name) {
    if (!ctx || muted || ctx.state !== 'running') return;
    const fn = SFX[name];
    if (!fn) return;
    const now = performance.now();
    if (lastPlay[name] && now - lastPlay[name] < 30) return;
    lastPlay[name] = now;
    try {
      fn(1 + (Math.random() - 0.5) * 0.08);
    } catch (e) {
      /* 무시 */
    }
  }

  /* =========================================================
   * 배경음악 — 간단한 시퀀서
   * ========================================================= */
  // 코드 진행: 마디마다 코드(미디 번호). 악기/리듬은 트랙마다 다름.
  const C = (root, type = 'm') => {
    const iv = { M: [0, 4, 7], m: [0, 3, 7], m7: [0, 3, 7, 10], M7: [0, 4, 7, 11], d7: [0, 4, 7, 10], sus: [0, 5, 7] }[type];
    return iv.map((i) => root + i);
  };
  const TRACKS = {
    title: { bpm: 68, prog: [C(57), C(53, 'M'), C(48, 'M'), C(55, 'M')], pad: true, arp: [0, 1, 2, 1, 0, 1, 2, 3], arpInst: 'bell', arpEvery: 2, lead: [0, null, null, null, 2, null, null, null, 1, null, null, null, null, null, null, null], leadInst: 'bell', leadOct: 12 },
    map: { bpm: 92, prog: [C(50), C(48, 'M'), C(46, 'M'), C(48, 'M')], bass: [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0], arp: [0, 1, 2, 1], arpInst: 'pluck', arpEvery: 2, hat: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0], lead: [2, null, null, 1, null, null, 0, null, null, null, 1, null, 2, null, null, null], leadInst: 'flute', leadOct: 12 },
    battle: { bpm: 134, prog: [C(52), C(48, 'M'), C(50, 'M'), C(47, 'M')], bass: [1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1], kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0], snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0], hat: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], arp: [0, 2, 1, 2], arpInst: 'pluck', arpEvery: 2, lead: [0, null, 1, null, 2, null, null, 1, 0, null, null, null, 2, 1, 0, null], leadInst: 'lead', leadOct: 12, leadEvery: 2 },
    elite: { bpm: 142, prog: [C(48), C(44, 'M'), C(46, 'M'), C(43, 'M')], bass: [1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1], kick: [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0], snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1], hat: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0], arp: [0, 1, 2, 3], arpInst: 'lead', arpEvery: 1, arpOct: 12, pad: true },
    boss: { bpm: 152, prog: [C(50), C(46, 'M'), C(43), C(45, 'd7')], bass: [1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 1], kick: [1, 0, 1, 0, 1, 0, 0, 1, 1, 0, 1, 0, 1, 0, 1, 1], snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0], hat: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], pad: true, lead: [0, null, null, 2, null, null, 1, null, 0, null, 3, null, 2, null, 1, null], leadInst: 'brass', leadOct: 12 },
    shop: { bpm: 112, prog: [C(53, 'M'), C(50), C(55), C(48, 'M')], bass: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], arp: [0, null, 2, null, 1, null, 2, null], arpInst: 'marimba', arpEvery: 1, arpOct: 12, hat: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 1] },
    rest: { bpm: 64, prog: [C(48, 'M'), C(45), C(41, 'M'), C(43, 'M')], pad: true, arp: [0, 1, 2, 1, 3, 1, 2, 1], arpInst: 'pluck', arpEvery: 2, crackle: true },
    event: { bpm: 84, prog: [C(57), C(52), C(53, 'M'), C(52, 'M')], pad: true, arp: [2, 1, 0, 1], arpInst: 'bell', arpEvery: 2, arpOct: 12 },
    victory: { bpm: 120, stinger: [[60, 0, 0.5], [64, 0.25, 0.5], [67, 0.5, 0.5], [72, 0.75, 1.6], [76, 0.75, 1.6], [79, 0.75, 1.6]], next: 'map' },
    defeat: { bpm: 70, stinger: [[64, 0, 0.8], [62, 0.6, 0.8], [60, 1.2, 0.8], [57, 1.8, 2.2], [52, 1.8, 2.2]], next: 'none' },
  };

  let seq = null; // { name, track, bus, step, nextTime, timer }

  function instrument(inst, midi, t, dur, v, dest) {
    const f = mtof(midi);
    switch (inst) {
      case 'bell':
        tone({ t, type: 'sine', freq: f, dur: dur * 2.2, vol: v * 0.7, attack: 0.004, dest });
        tone({ t, type: 'sine', freq: f * 2.76, dur: dur * 0.8, vol: v * 0.15, attack: 0.002, dest });
        break;
      case 'pluck':
        tone({ t, type: 'triangle', freq: f, dur: dur * 1.2, vol: v * 0.7, attack: 0.003, dest });
        tone({ t, type: 'square', freq: f, dur: dur * 0.4, vol: v * 0.08, filter: 'lowpass', ffreq: 1800, attack: 0.003, dest });
        break;
      case 'marimba':
        tone({ t, type: 'sine', freq: f, dur: 0.28, vol: v * 0.8, attack: 0.002, dest });
        tone({ t, type: 'sine', freq: f * 4, dur: 0.06, vol: v * 0.12, attack: 0.001, dest });
        break;
      case 'flute':
        tone({ t, type: 'sine', freq: f, dur, vol: v * 0.5, attack: 0.06, dest });
        tone({ t, type: 'triangle', freq: f * 2, dur, vol: v * 0.06, attack: 0.08, dest });
        break;
      case 'lead':
        tone({ t, type: 'square', freq: f, dur, vol: v * 0.22, filter: 'lowpass', ffreq: 2400, ffreqEnd: 900, attack: 0.01, dest });
        break;
      case 'brass':
        tone({ t, type: 'sawtooth', freq: f, dur, vol: v * 0.22, filter: 'lowpass', ffreq: 600, ffreqEnd: 2200, attack: 0.04, dest });
        tone({ t, type: 'sawtooth', freq: f, detune: 8, dur, vol: v * 0.16, filter: 'lowpass', ffreq: 900, attack: 0.05, dest });
        break;
      case 'bass':
        tone({ t, type: 'sawtooth', freq: f, dur, vol: v * 0.32, filter: 'lowpass', ffreq: 520, attack: 0.005, dest });
        tone({ t, type: 'sine', freq: f, dur, vol: v * 0.4, attack: 0.005, dest });
        break;
      case 'pad':
        tone({ t, type: 'sawtooth', freq: f, dur, vol: v * 0.09, filter: 'lowpass', ffreq: 900, attack: dur * 0.35, dest });
        tone({ t, type: 'triangle', freq: f, detune: -7, dur, vol: v * 0.14, attack: dur * 0.3, dest });
        break;
      default:
        tone({ t, type: 'triangle', freq: f, dur, vol: v * 0.4, dest });
    }
  }

  function drum(kind, t, dest) {
    if (kind === 'kick') {
      tone({ t, type: 'sine', freq: 140, freqEnd: 42, slide: 0.12, dur: 0.24, vol: 0.75, attack: 0.002, dest });
    } else if (kind === 'snare') {
      noise({ t, filter: 'bandpass', freq: 1800, q: 0.7, dur: 0.16, vol: 0.35, dest });
      tone({ t, type: 'triangle', freq: 190, freqEnd: 140, dur: 0.1, vol: 0.25, dest });
    } else if (kind === 'hat') {
      noise({ t, filter: 'highpass', freq: 7500, dur: 0.035, vol: 0.12, dest });
    } else if (kind === 'crackle') {
      noise({ t: t + Math.random() * 0.1, filter: 'highpass', freq: 3000 + Math.random() * 3000, dur: 0.015, vol: 0.06 + Math.random() * 0.06, dest });
    }
  }

  function scheduleStep(s, t) {
    const tr = s.track;
    const stepDur = 60 / tr.bpm / 4;
    const step = s.step % 16;
    const bar = Math.floor(s.step / 16) % tr.prog.length;
    const chord = tr.prog[bar];
    const dest = s.bus;
    if (step === 0 && tr.pad) chord.forEach((m) => instrument('pad', m + 12, t, stepDur * 16, 0.5, dest));
    if (tr.bass && tr.bass[step]) instrument('bass', chord[0] - 12, t, stepDur * 0.9, 0.6, dest);
    if (tr.kick && tr.kick[step]) drum('kick', t, dest);
    if (tr.snare && tr.snare[step]) drum('snare', t, dest);
    if (tr.hat && tr.hat[step]) drum('hat', t, dest);
    if (tr.crackle && Math.random() < 0.35) drum('crackle', t, dest);
    if (tr.arp && step % (tr.arpEvery || 1) === 0) {
      const idx = tr.arp[(step / (tr.arpEvery || 1)) % tr.arp.length];
      if (idx != null) instrument(tr.arpInst || 'pluck', chord[idx % chord.length] + (tr.arpOct || 0) + (idx >= chord.length ? 12 : 0), t, stepDur * (tr.arpEvery || 1), 0.35, dest);
    }
    if (tr.lead && (!tr.leadEvery || Math.floor(s.step / 16) % tr.leadEvery === 1)) {
      const idx = tr.lead[step];
      if (idx != null) instrument(tr.leadInst || 'lead', chord[idx % chord.length] + 12 + (tr.leadOct || 0) - 12 + (idx >= chord.length ? 12 : 0), t, stepDur * 3, 0.42, dest);
    }
  }

  function startSeq(name) {
    const track = TRACKS[name];
    const bus = ctx.createGain();
    bus.gain.setValueAtTime(0.0001, ctx.currentTime);
    bus.gain.exponentialRampToValueAtTime(1, ctx.currentTime + 1.2);
    bus.connect(musicBus);
    const s = { name, track, bus, step: 0, nextTime: ctx.currentTime + 0.1, timer: null };
    if (track.stinger) {
      const beat = 60 / track.bpm;
      for (const [m, at, len] of track.stinger) instrument('brass', m, s.nextTime + at * beat * 2, len * beat * 2, 0.6, bus);
      for (const [m, at, len] of track.stinger) instrument('bell', m + 12, s.nextTime + at * beat * 2, len * beat * 2, 0.4, bus);
      return s;
    }
    s.timer = setInterval(() => {
      if (!ctx || ctx.state !== 'running') return;
      while (s.nextTime < ctx.currentTime + 0.15) {
        scheduleStep(s, s.nextTime);
        s.nextTime += 60 / track.bpm / 4;
        s.step += 1;
      }
    }, 30);
    return s;
  }

  function stopSeq(s) {
    if (!s) return;
    if (s.timer) clearInterval(s.timer);
    const now = ctx.currentTime;
    s.bus.gain.cancelScheduledValues(now);
    s.bus.gain.setValueAtTime(Math.max(0.0001, s.bus.gain.value), now);
    s.bus.gain.exponentialRampToValueAtTime(0.0001, now + 1);
    setTimeout(() => { try { s.bus.disconnect(); } catch (e) { /* 무시 */ } }, 1200);
  }

  function music(name) {
    if (!TRACKS[name] && name !== 'none') name = 'none';
    if (!ctx) { wantedTrack = name; return; }
    if (seq && seq.name === name) return;
    if (!seq && name === 'none') return;
    stopSeq(seq);
    seq = null;
    if (name === 'none') return;
    seq = startSeq(name);
  }

  const currentTrack = () => (seq ? seq.name : wantedTrack);

  return { init, play, music, setVolume, setMuted, isMuted, currentTrack, SOUNDS: Object.keys(SFX), TRACKS: Object.keys(TRACKS) };
})();
