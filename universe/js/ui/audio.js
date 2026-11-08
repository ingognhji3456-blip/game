'use strict';

/* 소리: 파일 없이 Web Audio 로 합성합니다. 우주 배경음(시대마다 달라짐), 사건 알림음 */
(function () {
  const UC = (window.UC = window.UC || {});
  const U = UC.util;

  let ctx = null;
  let master = null;
  let drone = null;
  let muted = false;

  function noiseBuffer(c, seconds) {
    const buf = c.createBuffer(1, Math.floor(c.sampleRate * seconds), c.sampleRate);
    const d = buf.getChannelData(0);
    let b = 0;
    for (let i = 0; i < d.length; i++) {
      b = 0.97 * b + 0.03 * (Math.random() * 2 - 1);
      d[i] = b * 3;
    }
    return buf;
  }

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      ctx = new AC();
    } catch (e) {
      ctx = null;
      return;
    }
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.7;
    master.connect(ctx.destination);

    const g = ctx.createGain();
    g.gain.value = 0;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 600;
    lp.Q.value = 0.7;
    lp.connect(g);
    g.connect(master);
    const o1 = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    const o3 = ctx.createOscillator();
    o1.type = 'sine';
    o2.type = 'triangle';
    o3.type = 'sine';
    o1.frequency.value = 55;
    o2.frequency.value = 82.6;
    o3.frequency.value = 110.4;
    const g1 = ctx.createGain(); g1.gain.value = 0.35;
    const g2 = ctx.createGain(); g2.gain.value = 0.12;
    const g3 = ctx.createGain(); g3.gain.value = 0.08;
    o1.connect(g1).connect(lp);
    o2.connect(g2).connect(lp);
    o3.connect(g3).connect(lp);
    const nz = ctx.createBufferSource();
    nz.buffer = noiseBuffer(ctx, 4);
    nz.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 400;
    bp.Q.value = 0.6;
    const gn = ctx.createGain();
    gn.gain.value = 0.05;
    nz.connect(bp).connect(gn).connect(lp);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoG = ctx.createGain();
    lfoG.gain.value = 180;
    lfo.connect(lfoG).connect(lp.frequency);
    [o1, o2, o3, nz, lfo].forEach((n) => n.start());
    g.gain.setTargetAtTime(0.22, ctx.currentTime, 2.5);
    drone = { g, lp, o1, o2, o3, gn, bp };
  }

  /* 시대에 맞춰 배경음 조절: 뜨거운 초기 우주는 거칠게 울리고, 암흑 시대는 낮고 고요하게,
     별과 은하가 빛나면 맑게, 먼 미래에는 점점 비어 가게 */
  function setMood(m) {
    if (!drone || !ctx) return;
    const now = ctx.currentTime;
    const heat = U.clamp(m.heat, 0, 1);
    const stars = U.clamp(m.stars, 0, 1);
    const empty = U.clamp(m.empty, 0, 1);
    drone.lp.frequency.setTargetAtTime(260 + stars * 900 + heat * 700 - empty * 180, now, 1.2);
    drone.gn.gain.setTargetAtTime(0.02 + heat * 0.16 + stars * 0.02, now, 1.2);
    drone.bp.frequency.setTargetAtTime(200 + heat * 1400 + stars * 500, now, 1.2);
    const base = 55 * (1 - empty * 0.25) * (1 + heat * 0.06);
    drone.o1.frequency.setTargetAtTime(base, now, 2);
    drone.o2.frequency.setTargetAtTime(base * (stars > 0.4 ? 1.5 : 1.498), now, 2);
    drone.o3.frequency.setTargetAtTime(base * (stars > 0.6 ? 2.52 : 2.0), now, 2);
    drone.g.gain.setTargetAtTime(0.22 * (1 - empty * 0.6), now, 2);
  }

  function impact(size) {
    if (!ctx || muted) return;
    const now = ctx.currentTime;
    const s = U.clamp(size, 0.3, 4);
    const nz = ctx.createBufferSource();
    nz.buffer = noiseBuffer(ctx, 3);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(2500, now);
    lp.frequency.exponentialRampToValueAtTime(90, now + 2.5);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.5 + s * 0.12, now + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 1.5 + s * 0.6);
    nz.connect(lp).connect(g).connect(master);
    nz.start(now);
    nz.stop(now + 3);
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(70, now);
    o.frequency.exponentialRampToValueAtTime(26, now + 1.8);
    const go = ctx.createGain();
    go.gain.setValueAtTime(0.0001, now);
    go.gain.exponentialRampToValueAtTime(0.6, now + 0.02);
    go.gain.exponentialRampToValueAtTime(0.0001, now + 2);
    o.connect(go).connect(master);
    o.start(now);
    o.stop(now + 2.1);
  }

  function whoosh() {
    if (!ctx || muted) return;
    const now = ctx.currentTime;
    const nz = ctx.createBufferSource();
    nz.buffer = noiseBuffer(ctx, 1.6);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(300, now);
    bp.frequency.exponentialRampToValueAtTime(2200, now + 1.3);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.18, now + 1.2);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 1.45);
    nz.connect(bp).connect(g).connect(master);
    nz.start(now);
    nz.stop(now + 1.6);
  }

  function chime(kind) {
    if (!ctx || muted) return;
    const now = ctx.currentTime;
    const base = kind === 'end' ? 392 : kind === 'earth' ? 659.3 : kind === 'intervention' ? 330 : kind === 'physics' ? 440 : 523.3;
    [1, 1.5, 2.01].forEach((m, i) => {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = base * m;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, now + i * 0.06);
      g.gain.exponentialRampToValueAtTime(0.09 / (i + 1), now + i * 0.06 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.06 + 1.6);
      o.connect(g).connect(master);
      o.start(now + i * 0.06);
      o.stop(now + i * 0.06 + 1.7);
    });
  }

  function setMuted(m) {
    muted = m;
    if (master && ctx) master.gain.setTargetAtTime(m ? 0 : 0.7, ctx.currentTime, 0.1);
  }

  UC.audio = { init, setMood, impact, whoosh, chime, setMuted, isMuted: () => muted };
})();
