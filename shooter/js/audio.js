'use strict';

/* =========================================================
 * 하늘 사냥꾼 — 소리 (WebAudio 로 효과음과 배경음악을 실시간 합성. 소리 파일 없음)
 *   SH.audio.unlock()     첫 터치/키 입력 때 불러 소리를 켬
 *   SH.audio.sfx(name)    효과음
 *   SH.audio.music(name)  배경음악 ('title' 'stage1' 'stage2' 'stage3' 'boss' 'ending' 'none')
 * ========================================================= */

SH.audio = (() => {
  let ctx = null, master = null, sfxBus = null, musicBus = null, noiseBuf = null;
  const vol = { sfx: 0.8, music: 0.6 };
  let muted = false;
  const last = {};
  let wanted = 'none';
  let track = null; // { name, gain, step, next, def, mel }
  let timer = null;

  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  function unlock() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { ctx = new AC(); } catch (e) { ctx = null; return; }
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 10;
    comp.ratio.value = 5;
    comp.attack.value = 0.003;
    comp.release.value = 0.2;
    master = ctx.createGain();
    sfxBus = ctx.createGain();
    musicBus = ctx.createGain();
    sfxBus.connect(master);
    musicBus.connect(master);
    master.connect(comp);
    comp.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    apply();
    document.addEventListener('visibilitychange', () => {
      if (!ctx) return;
      if (document.hidden) ctx.suspend(); else ctx.resume();
    });
    timer = setInterval(schedule, 25);
    const w = wanted;
    wanted = 'none';
    music(w);
  }

  function apply() {
    if (!ctx) return;
    const now = ctx.currentTime;
    master.gain.setTargetAtTime(muted ? 0 : 0.9, now, 0.05);
    sfxBus.gain.setTargetAtTime(vol.sfx, now, 0.05);
    musicBus.gain.setTargetAtTime(vol.music * 0.5, now, 0.05);
  }
  function setVolume(v) {
    if (typeof v.sfx === 'number') vol.sfx = Math.max(0, Math.min(1, v.sfx));
    if (typeof v.music === 'number') vol.music = Math.max(0, Math.min(1, v.music));
    apply();
  }
  function setMuted(m) { muted = !!m; apply(); }

  /* ---------------- 합성 도우미 ---------------- */
  function tone(o) {
    const t = (o.t != null ? o.t : ctx.currentTime) + (o.delay || 0);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(o.f, t);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f2), t + (o.slide || o.dur));
    const peak = o.v != null ? o.v : 0.2;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + (o.a || 0.004));
    if (o.hold) g.gain.setValueAtTime(peak, t + o.hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    let node = osc;
    if (o.lp) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = o.lp;
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
    src.playbackRate.value = o.rate || 1;
    const f = ctx.createBiquadFilter();
    f.type = o.ft || 'lowpass';
    f.frequency.setValueAtTime(o.f || 1200, t);
    if (o.f2) f.frequency.exponentialRampToValueAtTime(Math.max(30, o.f2), t + o.dur);
    f.Q.value = o.q || 0.8;
    const g = ctx.createGain();
    const peak = o.v != null ? o.v : 0.2;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + (o.a || 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    src.connect(f);
    f.connect(g);
    g.connect(o.dest || sfxBus);
    src.start(t, Math.random() * 0.5);
    src.stop(t + o.dur + 0.05);
  }
  function throttle(name, gap) {
    const now = ctx.currentTime;
    if (last[name] && now - last[name] < gap) return false;
    last[name] = now;
    return true;
  }

  /* ---------------- 효과음 ---------------- */
  const SFX = {
    shoot_spread() { if (throttle('shot', 0.085)) tone({ f: 1250, f2: 520, dur: 0.05, v: 0.028, type: 'square', lp: 3200 }); },
    shoot_laser() { if (throttle('shot', 0.085)) tone({ f: 1900, f2: 1100, dur: 0.05, v: 0.024, type: 'sawtooth', lp: 4200 }); },
    shoot_homing() { if (throttle('shot', 0.085)) tone({ f: 1050, f2: 600, dur: 0.05, v: 0.026, type: 'triangle' }); },
    missile() { if (throttle('missile', 0.2)) noise({ ft: 'bandpass', f: 2400, f2: 900, dur: 0.12, v: 0.05, q: 2 }); },
    hit() { if (throttle('hit', 0.05)) noise({ ft: 'bandpass', f: 3200, dur: 0.03, v: 0.04, q: 3 }); },
    kill() {
      if (!throttle('kill', 0.03)) return;
      noise({ f: 2200, f2: 160, dur: 0.28, v: 0.22 });
      tone({ f: 240, f2: 60, dur: 0.14, v: 0.08, type: 'square', lp: 900 });
    },
    heavy() {
      noise({ f: 1600, f2: 90, dur: 0.6, v: 0.32 });
      tone({ f: 120, f2: 35, dur: 0.4, v: 0.25, type: 'sine' });
    },
    bossBoom() { if (throttle('bb', 0.08)) noise({ f: 1500, f2: 120, dur: 0.35, v: 0.22 }); },
    bossDie() {
      noise({ f: 2400, f2: 60, dur: 1.8, v: 0.45, a: 0.01 });
      tone({ f: 90, f2: 28, dur: 1.4, v: 0.4, type: 'sine' });
      tone({ f: 180, f2: 40, dur: 0.9, v: 0.12, type: 'square', lp: 700 });
    },
    playerDie() {
      tone({ f: 700, f2: 70, dur: 0.7, v: 0.16, type: 'sawtooth', lp: 2200 });
      noise({ f: 1800, f2: 100, dur: 0.8, v: 0.3 });
    },
    bomb() {
      noise({ f: 400, f2: 4000, dur: 0.35, v: 0.2, a: 0.25 });
      noise({ f: 3000, f2: 80, dur: 1.4, v: 0.4, delay: 0.25 });
      tone({ f: 110, f2: 30, dur: 1.2, v: 0.35, type: 'sine', delay: 0.25 });
    },
    power() { [0, 4, 7, 12, 16].forEach((n, i) => tone({ f: mtof(72 + n), dur: 0.09, v: 0.07, delay: i * 0.045, type: 'square', lp: 4000 })); },
    item() { [0, 7].forEach((n, i) => tone({ f: mtof(79 + n), dur: 0.08, v: 0.07, delay: i * 0.06, type: 'triangle' })); },
    extend() { [0, 4, 7, 12, 7, 12, 16].forEach((n, i) => tone({ f: mtof(76 + n), dur: 0.1, v: 0.08, delay: i * 0.07, type: 'square', lp: 5000 })); },
    gem() { if (throttle('gem', 0.04)) tone({ f: 1700 + Math.random() * 500, dur: 0.05, v: 0.03, type: 'sine' }); },
    spark() { if (throttle('spark', 0.035)) tone({ f: 2300 + Math.random() * 600, dur: 0.03, v: 0.018, type: 'sine' }); },
    shield() {
      noise({ ft: 'highpass', f: 3000, dur: 0.3, v: 0.12 });
      tone({ f: 1500, f2: 400, dur: 0.3, v: 0.06, type: 'triangle' });
    },
    warning() {
      for (let i = 0; i < 4; i++) {
        tone({ f: 880, dur: 0.26, v: 0.09, delay: i * 0.6, type: 'square', lp: 2500, hold: 0.2 });
        tone({ f: 660, dur: 0.26, v: 0.09, delay: i * 0.6 + 0.3, type: 'square', lp: 2500, hold: 0.2 });
      }
    },
    phase() {
      noise({ f: 300, f2: 3000, dur: 0.5, v: 0.15, a: 0.3 });
      tone({ f: 200, f2: 800, dur: 0.5, v: 0.06, type: 'sawtooth', lp: 1800 });
    },
    clear() {
      const seq = [[72, 0], [76, 0.12], [79, 0.24], [84, 0.36], [79, 0.6], [84, 0.72]];
      seq.forEach(([n, d]) => {
        tone({ f: mtof(n), dur: 0.2, v: 0.08, delay: d, type: 'square', lp: 4000 });
        tone({ f: mtof(n - 12), dur: 0.2, v: 0.06, delay: d, type: 'triangle' });
      });
    },
    gameOver() { [67, 63, 60, 55].forEach((n, i) => tone({ f: mtof(n), dur: 0.38, v: 0.08, delay: i * 0.32, type: 'triangle', hold: 0.25 })); },
    click() { tone({ f: 880, f2: 1300, dur: 0.06, v: 0.06, type: 'triangle' }); },
    armor() { if (throttle('armor', 0.07)) tone({ f: 2600, f2: 1800, dur: 0.04, v: 0.03, type: 'square', lp: 5000 }); },
    laserWarn() {
      tone({ f: 300, f2: 1400, dur: 0.9, v: 0.06, type: 'sawtooth', lp: 2400, a: 0.4 });
      for (let i = 0; i < 4; i++) tone({ f: 1200, dur: 0.06, v: 0.05, delay: i * 0.22, type: 'square' });
    },
    laserFire() {
      noise({ ft: 'bandpass', f: 900, dur: 1.2, v: 0.22, q: 0.6, a: 0.02 });
      tone({ f: 110, f2: 70, dur: 1.2, v: 0.2, type: 'sawtooth', lp: 900 });
    },
    enemyMissile() { if (throttle('em', 0.25)) noise({ ft: 'bandpass', f: 1400, f2: 500, dur: 0.25, v: 0.07, q: 1.5 }); },
    missileDown() { if (throttle('md', 0.04)) { noise({ f: 2400, f2: 300, dur: 0.18, v: 0.12 }); tone({ f: 900, f2: 300, dur: 0.1, v: 0.04, type: 'square' }); } },
    part() {
      noise({ f: 2000, f2: 80, dur: 1.0, v: 0.38 });
      tone({ f: 140, f2: 30, dur: 0.8, v: 0.3, type: 'sine' });
    },
  };

  function sfx(name) {
    if (!ctx || muted || ctx.state !== 'running') return;
    const f = SFX[name];
    if (f) f();
  }

  /* ---------------- 배경음악 (간단한 칩튠 시퀀서) ----------------
   * chords: [근음 midi, 'M'|'m'] 한 마디씩. bass/kick/snare/hat: 16칸 패턴 */
  const TRACKS = {
    title: { bpm: 100, chords: [[60, 'M'], [57, 'm'], [53, 'M'], [55, 'M']], bass: '1...5...1...5...', kick: 'x.......x.......', snare: '................', hat: '..x...x...x...x.', lead: 0.55, seed: 3, arpOct: 1 },
    stage1: { bpm: 132, chords: [[53, 'M'], [60, 'M'], [62, 'm'], [58, 'M']], bass: '1.1.5.1.1.1.5.8.', kick: 'x...x...x...x...', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', lead: 0.75, seed: 11, arpOct: 1 },
    stage2: { bpm: 140, chords: [[50, 'm'], [58, 'M'], [53, 'M'], [60, 'M']], bass: '1..11..15..51..8', kick: 'x..x..x...x..x..', snare: '....x.......x...', hat: 'xxx.xxx.xxx.xxx.', lead: 0.7, seed: 23, arpOct: 1 },
    stage3: { bpm: 150, chords: [[52, 'm'], [53, 'M'], [52, 'm'], [50, 'M']], bass: '1.1.1.1.1.1.5.5.', kick: 'x...x...x...x.x.', snare: '....x.......x...', hat: 'x.xxx.xxx.xxx.xx', lead: 0.8, seed: 37, arpOct: 1 },
    boss: { bpm: 162, chords: [[57, 'm'], [53, 'M'], [55, 'M'], [52, 'm']], bass: '1111111155558888', kick: 'x.x.x.x.x.x.x.x.', snare: '....x.......x..x', hat: 'xxxxxxxxxxxxxxxx', lead: 0.85, seed: 51, arpOct: 1 },
    ending: { bpm: 96, chords: [[60, 'M'], [53, 'M'], [55, 'M'], [60, 'M']], bass: '1.......5.......', kick: 'x.......x.......', snare: '........x.......', hat: '....x.......x...', lead: 0.5, seed: 7, arpOct: 2 },
  };

  function makeMelody(def) {
    const rng = SH.rng(def.seed);
    const bars = [];
    for (let v = 0; v < 2; v++) {
      for (const [root, q] of def.chords) {
        const tones = q === 'M' ? [0, 4, 7, 12] : [0, 3, 7, 12];
        const scale = q === 'M' ? [0, 2, 4, 5, 7, 9, 11, 12] : [0, 2, 3, 5, 7, 8, 10, 12];
        const bar = [];
        for (let s = 0; s < 8; s++) {
          const strong = s % 2 === 0;
          if (rng() > def.lead && !strong) { bar.push(null); continue; }
          if (s > 0 && rng() < 0.22) { bar.push('-'); continue; } // 이어서 길게
          const pool = strong ? tones : scale;
          bar.push(root + 12 + pool[Math.floor(rng() * pool.length)]);
        }
        bars.push(bar);
      }
    }
    return bars;
  }

  function music(name) {
    if (wanted === name && (track || name === 'none')) return;
    wanted = name;
    if (!ctx) return;
    if (track) {
      const g = track.gain;
      g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.15);
      setTimeout(() => g.disconnect(), 800);
      track = null;
    }
    const def = TRACKS[name];
    if (!def) return;
    const gain = ctx.createGain();
    gain.gain.value = 1;
    gain.connect(musicBus);
    track = { name, def, gain, step: 0, next: ctx.currentTime + 0.08, mel: def.mel || (def.mel = makeMelody(def)) };
  }

  function schedule() {
    if (!ctx || !track || ctx.state !== 'running') return;
    const T = track, d = T.def;
    const stepDur = 60 / d.bpm / 4;
    while (T.next < ctx.currentTime + 0.14) {
      playStep(T, T.step, T.next, stepDur);
      T.next += stepDur;
      T.step += 1;
    }
  }

  function playStep(T, step, t, sd) {
    const d = T.def;
    const s16 = step % 16;
    const bar = Math.floor(step / 16);
    const [root, q] = d.chords[bar % d.chords.length];
    const dest = T.gain;
    const third = q === 'M' ? 4 : 3;
    // 드럼
    if (d.kick[s16] === 'x') {
      tone({ t, f: 150, f2: 40, slide: 0.12, dur: 0.18, v: 0.5, type: 'sine', dest });
    }
    if (d.snare[s16] === 'x') {
      noise({ t, ft: 'bandpass', f: 1800, dur: 0.14, v: 0.22, q: 0.7, dest });
      tone({ t, f: 220, f2: 140, dur: 0.08, v: 0.08, type: 'triangle', dest });
    }
    if (d.hat[s16] === 'x') noise({ t, ft: 'highpass', f: 7000, dur: 0.035, v: s16 % 4 === 0 ? 0.08 : 0.05, dest });
    // 베이스
    const bc = d.bass[s16];
    if (bc !== '.') {
      const n = root - 24 + (bc === '5' ? 7 : bc === '8' ? 12 : 0);
      tone({ t, f: mtof(n), dur: sd * 1.8, v: 0.2, type: 'sawtooth', lp: 600, dest });
    }
    // 아르페지오
    const arp = [0, third, 7, 12, 7, third, 0, 7][s16 % 8];
    tone({ t, f: mtof(root + 12 * d.arpOct + arp), dur: sd * 0.9, v: 0.035, type: 'square', lp: 2600, dest });
    // 멜로디 (8분음표)
    if (s16 % 2 === 0) {
      const mbar = T.mel[bar % T.mel.length];
      const i = s16 / 2;
      const n = mbar[i];
      if (typeof n === 'number') {
        let len = 1;
        while (i + len < 8 && mbar[i + len] === '-') len++;
        tone({ t, f: mtof(n), dur: sd * 2 * len * 0.95, v: 0.07, type: 'square', lp: 3400, a: 0.01, hold: sd * 2 * len * 0.6, dest });
        tone({ t, f: mtof(n) * 1.004, dur: sd * 2 * len * 0.95, v: 0.03, type: 'triangle', dest });
      }
    }
  }

  return { unlock, sfx, music, setVolume, setMuted, get muted() { return muted; } };
})();
