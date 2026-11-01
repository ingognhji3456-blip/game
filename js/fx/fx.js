'use strict';

/* =========================================================
 * 시각 효과 — 캔버스 파티클, 베기 궤적, 투사체, 떠오르는 숫자, 배너, 화면 흔들림
 * ========================================================= */
CB.fx = (() => {
  let canvas = null;
  let ctx = null;
  let layer = null;
  let W = 0;
  let H = 0;
  let dpr = 1;
  let running = false;
  let lastT = 0;
  const particles = [];
  const effects = [];
  const opts = { shake: true, speed: 1 };
  let shakeMag = 0;
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  function init() {
    if (canvas) return;
    canvas = document.createElement('canvas');
    canvas.id = 'fx-canvas';
    layer = document.createElement('div');
    layer.id = 'fx-layer';
    document.body.appendChild(canvas);
    document.body.appendChild(layer);
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
  }

  function resize() {
    if (!canvas) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function setOptions(o) {
    Object.assign(opts, o || {});
    opts.speed = opts.speed >= 2 ? 2 : 1;
  }
  const speed = () => opts.speed || 1;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms / speed()));

  function centerOf(el) {
    if (!el) return { x: W / 2, y: H / 2 };
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  function start() {
    if (running || !ctx) return;
    running = true;
    lastT = performance.now();
    requestAnimationFrame(loop);
  }

  /* ---------------- 파티클 ---------------- */
  function spawn(p) {
    if (particles.length > 900) particles.shift();
    particles.push({
      x: 0, y: 0, vx: 0, vy: 0, life: 30, max: 30, size: 3, color: '#fff', gravity: 0, drag: 0.98,
      shape: 'circle', additive: false, rot: 0, vr: 0, grow: 0, alpha: 1, ...p,
    });
  }

  const PRESETS = {
    hit(x, y, o) {
      const n = o.count || 16;
      for (let i = 0; i < n; i++) {
        const a = rand(0, Math.PI * 2);
        const s = rand(3, 9) * (o.power || 1);
        spawn({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1, life: rand(18, 34), size: rand(1.5, 3.5), color: pick(['#fff', '#ffe08a', '#ffb24a', '#ff7a4a']), gravity: 0.22, shape: 'spark', additive: true });
      }
      ring(x, y, '#ffd28a', 34 * (o.power || 1), 14);
    },
    crit(x, y, o) {
      PRESETS.hit(x, y, { count: 30, power: 1.4, ...o });
      ring(x, y, '#ffffff', 70, 18);
    },
    block(x, y) {
      for (let i = 0; i < 12; i++) {
        const a = rand(-Math.PI, 0);
        const s = rand(2, 6);
        spawn({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(20, 32), size: rand(3, 6), color: pick(['#cfe6ff', '#7ab8ff', '#ffffff']), gravity: 0.18, shape: 'shard', rot: rand(0, 6), vr: rand(-0.3, 0.3) });
      }
      ring(x, y, '#7ab8ff', 46, 16);
    },
    shatter(x, y) {
      for (let i = 0; i < 20; i++) {
        const a = rand(0, Math.PI * 2);
        const s = rand(3, 8);
        spawn({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 2, life: rand(26, 42), size: rand(4, 8), color: pick(['#9ec9ff', '#e8f2ff', '#5a8ad8']), gravity: 0.3, shape: 'shard', rot: rand(0, 6), vr: rand(-0.4, 0.4) });
      }
    },
    heal(x, y) {
      for (let i = 0; i < 18; i++) {
        spawn({ x: x + rand(-40, 40), y: y + rand(-10, 40), vx: rand(-0.4, 0.4), vy: rand(-2.6, -0.8), life: rand(30, 55), size: rand(2, 4.5), color: pick(['#9dffb0', '#55efc4', '#eaffea']), gravity: -0.01, shape: 'plus', additive: true });
      }
    },
    poison(x, y) {
      for (let i = 0; i < 16; i++) {
        spawn({ x: x + rand(-34, 34), y: y + rand(-10, 30), vx: rand(-0.5, 0.5), vy: rand(-1.8, -0.4), life: rand(30, 50), size: rand(3, 7), color: pick(['#8aff5a', '#5ad62a', '#c8ff9a']), gravity: -0.02, shape: 'bubble' });
      }
    },
    fire(x, y) {
      for (let i = 0; i < 26; i++) {
        spawn({ x: x + rand(-20, 20), y: y + rand(-10, 20), vx: rand(-1.5, 1.5), vy: rand(-4, -1), life: rand(18, 34), size: rand(5, 11), grow: -0.25, color: pick(['#fff3a0', '#ffb030', '#ff6a1a', '#e8401c']), gravity: -0.05, additive: true });
      }
    },
    buff(x, y) {
      for (let i = 0; i < 16; i++) {
        spawn({ x: x + rand(-36, 36), y: y + rand(0, 40), vx: rand(-0.3, 0.3), vy: rand(-3, -1.2), life: rand(26, 44), size: rand(2, 4), color: pick(['#ffe680', '#ffc94a', '#fff']), gravity: -0.02, shape: 'spark', additive: true });
      }
      ring(x, y, '#ffd25a', 50, 20);
    },
    debuff(x, y) {
      for (let i = 0; i < 16; i++) {
        spawn({ x: x + rand(-36, 36), y: y + rand(-40, 0), vx: rand(-0.3, 0.3), vy: rand(0.8, 2.4), life: rand(26, 44), size: rand(2.5, 5), color: pick(['#c88aff', '#8a4ad8', '#5a2a9a']), gravity: 0.02 });
      }
    },
    gold(x, y) {
      for (let i = 0; i < 14; i++) {
        const a = rand(-Math.PI * 0.9, -Math.PI * 0.1);
        const s = rand(3, 7);
        spawn({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(30, 46), size: rand(4, 6), color: '#ffd25a', gravity: 0.28, shape: 'coin', rot: rand(0, 6), vr: 0.3 });
      }
    },
    magic(x, y) {
      for (let i = 0; i < 22; i++) {
        const a = rand(0, Math.PI * 2);
        const s = rand(1, 4);
        spawn({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(24, 44), size: rand(2, 4), color: pick(['#8af6ff', '#c88aff', '#ffffff']), drag: 0.94, additive: true });
      }
      ring(x, y, '#c88aff', 56, 18);
    },
    death(x, y) {
      for (let i = 0; i < 34; i++) {
        spawn({ x: x + rand(-40, 40), y: y + rand(-50, 40), vx: rand(-0.8, 0.8), vy: rand(-1.6, -0.2), life: rand(40, 70), size: rand(8, 18), grow: 0.25, alpha: 0.55, color: pick(['#2a1a3a', '#4a2a5a', '#1a1022']), gravity: -0.01 });
      }
      for (let i = 0; i < 16; i++) {
        spawn({ x: x + rand(-30, 30), y: y + rand(-40, 30), vx: rand(-1, 1), vy: rand(-2.5, -0.5), life: rand(30, 50), size: rand(1.5, 3), color: '#d8b0ff', additive: true });
      }
    },
  };

  function burst(x, y, kind = 'hit', o = {}) {
    if (!ctx) return;
    (PRESETS[kind] || PRESETS.hit)(x, y, o);
    start();
  }

  /* ---------------- 효과 객체 ---------------- */
  function ring(x, y, color, radius, life) {
    effects.push({ type: 'ring', x, y, color, radius, life, max: life });
  }

  function slash(x, y, o = {}) {
    if (!ctx) return;
    const angle = o.angle != null ? o.angle : rand(-0.9, -0.5);
    const len = o.heavy ? 230 : 170;
    effects.push({ type: 'slash', x, y, angle, len, life: 15, max: 15, heavy: !!o.heavy, color: o.color || '#ffe9b0' });
    start();
  }

  function projectile(from, to, kind = 'fire') {
    if (!ctx) return Promise.resolve();
    return new Promise((resolve) => {
      const colors = {
        fire: ['#fff3a0', '#ff8a2a'], poison: ['#d6ff9a', '#5ad62a'], magic: ['#ffffff', '#8af6ff'],
        dark: ['#e8c8ff', '#7a2ad8'], ice: ['#ffffff', '#7ac8ff'],
      }[kind] || ['#fff', '#ffd25a'];
      const mx = (from.x + to.x) / 2;
      const my = Math.min(from.y, to.y) - 90;
      effects.push({ type: 'proj', from, to, cx: mx, cy: my, t: 0, dur: 24, colors, kind, resolve });
      start();
    });
  }

  /* ---------------- 루프 ---------------- */
  function loop(now) {
    const dt = Math.min(3, (now - lastT) / 16.67) * speed();
    lastT = now;
    ctx.clearRect(0, 0, W, H);

    // 파티클
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.vy += p.gravity * dt;
      p.vx *= Math.pow(p.drag, dt);
      p.vy *= Math.pow(p.drag, dt);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      p.size = Math.max(0.2, p.size + p.grow * dt);
      p.life -= dt;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      drawParticle(p);
    }
    // 효과
    for (let i = effects.length - 1; i >= 0; i--) {
      const e = effects[i];
      if (e.type === 'proj') {
        e.t += dt / e.dur;
        const t = Math.min(1, e.t);
        const x = (1 - t) * (1 - t) * e.from.x + 2 * (1 - t) * t * e.cx + t * t * e.to.x;
        const y = (1 - t) * (1 - t) * e.from.y + 2 * (1 - t) * t * e.cy + t * t * e.to.y;
        for (let k = 0; k < 2; k++) {
          spawn({ x: x + rand(-3, 3), y: y + rand(-3, 3), vx: rand(-0.6, 0.6), vy: rand(-0.6, 0.6), life: rand(12, 22), size: rand(3, 6), grow: -0.2, color: pick(e.colors), additive: true });
        }
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const grd = ctx.createRadialGradient(x, y, 0, x, y, 16);
        grd.addColorStop(0, e.colors[0]);
        grd.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grd;
        ctx.beginPath(); ctx.arc(x, y, 16, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        if (t >= 1) {
          effects.splice(i, 1);
          burst(e.to.x, e.to.y, e.kind === 'poison' ? 'poison' : e.kind === 'fire' ? 'fire' : 'magic');
          e.resolve();
        }
        continue;
      }
      e.life -= dt;
      if (e.life <= 0) { effects.splice(i, 1); continue; }
      const k = 1 - e.life / e.max;
      if (e.type === 'ring') {
        ctx.save();
        ctx.globalAlpha = (1 - k) * 0.8;
        ctx.strokeStyle = e.color;
        ctx.lineWidth = 3 * (1 - k) + 1;
        ctx.beginPath(); ctx.arc(e.x, e.y, e.radius * (0.3 + k), 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      } else if (e.type === 'slash') {
        drawSlash(e, k);
      }
    }
    // 화면 흔들림
    const app = document.getElementById('app');
    if (app) {
      if (shakeMag > 0.3) {
        app.style.transform = `translate(${rand(-shakeMag, shakeMag).toFixed(1)}px, ${rand(-shakeMag, shakeMag).toFixed(1)}px)`;
        shakeMag *= Math.pow(0.86, dt);
      } else if (shakeMag !== 0) {
        shakeMag = 0;
        app.style.transform = '';
      }
    }

    if (particles.length || effects.length || shakeMag > 0) requestAnimationFrame(loop);
    else { running = false; ctx.clearRect(0, 0, W, H); }
  }

  function drawParticle(p) {
    const a = Math.max(0, Math.min(1, p.life / p.max)) * p.alpha;
    ctx.save();
    ctx.globalAlpha = a;
    if (p.additive) ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = p.color;
    ctx.strokeStyle = p.color;
    switch (p.shape) {
      case 'spark': {
        ctx.lineWidth = p.size;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 2.2, p.y - p.vy * 2.2);
        ctx.stroke();
        break;
      }
      case 'shard': {
        ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.beginPath(); ctx.moveTo(0, -p.size); ctx.lineTo(p.size * 0.6, 0); ctx.lineTo(0, p.size); ctx.lineTo(-p.size * 0.6, 0); ctx.closePath(); ctx.fill();
        break;
      }
      case 'coin': {
        ctx.translate(p.x, p.y);
        ctx.scale(Math.abs(Math.cos(p.rot)) + 0.2, 1);
        ctx.beginPath(); ctx.arc(0, 0, p.size, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#a8701a'; ctx.lineWidth = 1.5; ctx.stroke();
        break;
      }
      case 'bubble': {
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = a * 0.3; ctx.fill();
        break;
      }
      case 'plus': {
        const s = p.size;
        ctx.fillRect(p.x - s / 3, p.y - s, (s * 2) / 3, s * 2);
        ctx.fillRect(p.x - s, p.y - s / 3, s * 2, (s * 2) / 3);
        break;
      }
      default:
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function drawSlash(e, k) {
    const grow = Math.min(1, k * 2.4);
    const fade = k < 0.4 ? 1 : 1 - (k - 0.4) / 0.6;
    const dx = Math.cos(e.angle);
    const dy = Math.sin(e.angle);
    const half = (e.len / 2) * grow;
    const x1 = e.x - dx * half;
    const y1 = e.y - dy * half;
    const x2 = e.x + dx * half;
    const y2 = e.y + dy * half;
    const nx = -dy * 26;
    const ny = dx * 26;
    const w = e.heavy ? 16 : 10;
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.globalCompositeOperation = 'lighter';
    ctx.shadowColor = e.color;
    ctx.shadowBlur = 24;
    ctx.fillStyle = e.color;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo(e.x + nx, e.y + ny - w, x2, y2);
    ctx.quadraticCurveTo(e.x + nx, e.y + ny + w, x1, y1);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo(e.x + nx, e.y + ny - w * 0.3, x2, y2);
    ctx.quadraticCurveTo(e.x + nx, e.y + ny + w * 0.3, x1, y1);
    ctx.fill();
    ctx.restore();
  }

  /* ---------------- 화면 효과 ---------------- */
  function shake(intensity = 1) {
    if (!opts.shake) return;
    const mag = (reduced ? 2 : 7) * intensity;
    shakeMag = Math.max(shakeMag, mag);
    start();
  }

  function flash(el, color = '#ffffff') {
    if (!el) return;
    el.style.setProperty('--flash-color', color);
    el.classList.remove('fx-flash');
    void el.offsetWidth;
    el.classList.add('fx-flash');
    setTimeout(() => el.classList.remove('fx-flash'), 320 / speed());
  }

  function screenFlash(color = 'rgba(255,255,255,.5)') {
    if (!layer) return;
    const d = document.createElement('div');
    d.className = 'fx-screen-flash';
    d.style.background = color;
    d.style.animationDuration = `${450 / speed()}ms`;
    layer.appendChild(d);
    setTimeout(() => d.remove(), 500 / speed());
  }

  function floatText(x, y, text, kind = 'info') {
    if (!layer) return;
    const d = document.createElement('div');
    d.className = `fx-float fx-${kind}`;
    d.textContent = text;
    d.style.left = `${x + rand(-14, 14)}px`;
    d.style.top = `${y + rand(-8, 8)}px`;
    d.style.animationDuration = `${1000 / speed()}ms`;
    layer.appendChild(d);
    setTimeout(() => d.remove(), 1050 / speed());
  }

  function banner(text, o = {}) {
    if (!layer) return Promise.resolve();
    const d = document.createElement('div');
    d.className = `fx-banner fx-banner-${o.kind || 'info'}`;
    const total = (o.duration || 1150) / speed();
    d.style.animationDuration = `${total}ms`;
    const main = document.createElement('div');
    main.className = 'fx-banner-text';
    main.textContent = text;
    d.appendChild(main);
    if (o.sub) {
      const sub = document.createElement('div');
      sub.className = 'fx-banner-sub';
      sub.textContent = o.sub;
      d.appendChild(sub);
    }
    layer.appendChild(d);
    return new Promise((resolve) => setTimeout(() => { d.remove(); resolve(); }, total));
  }

  return { init, setOptions, wait, centerOf, burst, floatText, slash, projectile, shake, flash, screenFlash, banner, speed };
})();
