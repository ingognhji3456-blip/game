'use strict';

/* 그래프: 기온·CO₂·산소·생물 다양성을 전체 시간에 걸쳐 그립니다. 당신의 역사(실선)와 실제 역사(점선) */
(function () {
  const EC = (window.EC = window.EC || {});
  const U = EC.util;

  const N = 420;
  const METRICS = {
    T: { unit: '°C', min: -50, max: 100, ticks: [-40, 0, 20, 50, 100], get: (s) => s.T, fmt: (v) => `${v}°` },
    co2: { log: true, min: 100, max: 1e8, ticks: [100, 1e3, 1e4, 1e5, 1e6, 1e7], get: (s) => s.co2, fmt: (v) => (v >= 1e6 ? `${v / 1e6}기압` : v >= 1e4 ? `${v / 1e4}만` : `${v}`) },
    O2: { unit: '%', min: 0, max: 35, ticks: [0, 10, 21, 30], get: (s) => s.O2, fmt: (v) => `${v}%` },
    B: { min: 0, max: 110, ticks: [0, 50, 100], get: (s) => s.B, fmt: (v) => `${v}` },
  };

  const cache = new WeakMap();

  function series(run) {
    let c = cache.get(run);
    if (c) return c;
    c = { T: new Float32Array(N), co2: new Float32Array(N), O2: new Float32Array(N), B: new Float32Array(N) };
    for (let i = 0; i < N; i++) {
      const t = EC.time.fromS(i / (N - 1));
      const s = EC.sim.stateAt(run, t);
      for (const k in METRICS) c[k][i] = METRICS[k].get(s);
    }
    cache.set(run, c);
    return c;
  }

  function draw(canvas, metric, runYou, runBase, t) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = canvas.getBoundingClientRect();
    if (!r.width) return;
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
    const c = canvas.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const W = r.width;
    const H = r.height;
    const L = 46;
    const R = 6;
    const T0 = 6;
    const B0 = 16;
    const m = METRICS[metric];
    const yOf = (v) => {
      let k;
      if (m.log) k = (Math.log10(U.clamp(v, m.min, m.max)) - Math.log10(m.min)) / (Math.log10(m.max) - Math.log10(m.min));
      else k = (U.clamp(v, m.min, m.max) - m.min) / (m.max - m.min);
      return T0 + (1 - k) * (H - T0 - B0);
    };
    const xOf = (s) => L + s * (W - L - R);

    c.clearRect(0, 0, W, H);
    for (const e of EC.data.eons) {
      const x0 = xOf(EC.time.toS(e.from));
      const x1 = xOf(EC.time.toS(e.to));
      c.fillStyle = e.color;
      c.globalAlpha = 0.08;
      c.fillRect(x0, T0, x1 - x0, H - T0 - B0);
      c.globalAlpha = 0.7;
      c.fillRect(x0, H - B0 + 3, x1 - x0 - 1, 3);
    }
    c.globalAlpha = 1;
    c.font = '10px sans-serif';
    c.fillStyle = 'rgba(200,210,235,0.6)';
    c.strokeStyle = 'rgba(160,190,255,0.12)';
    c.lineWidth = 1;
    for (const v of m.ticks) {
      const y = yOf(v);
      c.beginPath();
      c.moveTo(L, y);
      c.lineTo(W - R, y);
      c.stroke();
      const label = m.fmt(v);
      c.fillText(label, L - 6 - c.measureText(label).width, y + 3);
    }

    const plot = (data, dashed, color, width) => {
      c.save();
      c.strokeStyle = color;
      c.lineWidth = width;
      if (dashed) c.setLineDash([4, 4]);
      c.beginPath();
      for (let i = 0; i < N; i++) {
        const x = xOf(i / (N - 1));
        const y = yOf(data[i]);
        if (i === 0) c.moveTo(x, y);
        else c.lineTo(x, y);
      }
      c.stroke();
      c.restore();
    };
    const base = series(runBase)[metric];
    plot(base, true, 'rgba(160,170,195,0.8)', 1.4);
    if (runYou !== runBase) plot(series(runYou)[metric], false, '#7cc4ff', 2);
    else plot(base, false, '#7cc4ff', 2);

    const px = xOf(EC.time.toS(t));
    c.strokeStyle = 'rgba(255,255,255,0.85)';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(px, T0);
    c.lineTo(px, H - B0);
    c.stroke();
  }

  EC.ui = EC.ui || {};
  EC.ui.chart = { draw, METRICS };
})();
