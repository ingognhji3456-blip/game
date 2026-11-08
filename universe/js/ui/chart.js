'use strict';

/* 그래프: 우주의 크기·온도·팽창 속도를 전체 시간에 걸쳐 (로그 눈금). 당신의 우주(실선)와 실제 우주(점선) */
(function () {
  const UC = (window.UC = window.UC || {});
  const U = UC.util;
  const C = UC.cosmo;

  const N = 360;
  const METRICS = {
    size: { get: (s) => (s.ended && s.endType === 'rip' ? 40 : U.clamp(s.log10a, -40, 40)), min: -32, max: 6, ticks: [-30, -20, -10, 0, 5], fmt: (v) => (v === 0 ? '지금' : `10${U.sup(v)}`) },
    temp: { get: (s) => U.clamp(Math.log10(Math.max(s.T, 1e-40)), -40, 40), min: -12, max: 32, ticks: [-10, 0, 3.43, 10, 20, 30], fmt: (v) => (Math.abs(v - 3.43) < 0.01 ? '3천K' : `10${U.sup(Math.round(v))}`) },
    hubble: { get: (s) => (s.ended ? NaN : U.clamp(Math.log10(Math.max(Math.abs(s.Hkms), 1e-30)), -10, 45) * (s.contracting ? -1 : 1)), min: -45, max: 45, ticks: [-40, -20, 0, 1.83, 20, 40], fmt: (v) => (Math.abs(v - 1.83) < 0.01 ? '지금' : v < 0 ? `-10${U.sup(-v)}` : v === 0 ? '0' : `10${U.sup(v)}`) },
  };

  const cache = new Map();
  function series(run, scale) {
    const key = run;
    let c = cache.get(key);
    if (c && c.scale === scale) return c;
    c = { scale };
    for (const k in METRICS) c[k] = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const t = scale.fromS(i / (N - 1));
      const s = C.stateAt(run, t);
      for (const k in METRICS) c[k][i] = METRICS[k].get(s);
    }
    if (cache.size > 6) cache.clear();
    cache.set(key, c);
    return c;
  }

  function draw(canvas, metric, run, scale, t) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = canvas.getBoundingClientRect();
    if (!r.width) return;
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
    const c = canvas.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const W = r.width;
    const H = r.height;
    const L = 44;
    const R = 6;
    const T0 = 6;
    const B0 = 16;
    const m = METRICS[metric];
    const yOf = (v) => T0 + (1 - (U.clamp(v, m.min, m.max) - m.min) / (m.max - m.min)) * (H - T0 - B0);
    const xOf = (s) => L + s * (W - L - R);
    c.clearRect(0, 0, W, H);
    for (const e of UC.data.AGES) {
      if (e.from >= scale.tEnd) continue;
      const x0 = xOf(scale.toS(Math.max(e.from, scale.tStart)));
      const x1 = xOf(scale.toS(Math.min(e.to, scale.tEnd)));
      c.fillStyle = e.color;
      c.globalAlpha = 0.08;
      c.fillRect(x0, T0, x1 - x0, H - T0 - B0);
      c.globalAlpha = 0.7;
      c.fillRect(x0, H - B0 + 3, Math.max(1, x1 - x0 - 1), 3);
    }
    c.globalAlpha = 1;
    c.font = '10px sans-serif';
    c.fillStyle = 'rgba(200,210,235,0.6)';
    c.strokeStyle = 'rgba(160,190,255,0.12)';
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
      let pen = false;
      for (let i = 0; i < N; i++) {
        const v = data[i];
        if (!Number.isFinite(v)) { pen = false; continue; }
        const x = xOf(i / (N - 1));
        const y = yOf(v);
        if (!pen) { c.moveTo(x, y); pen = true; } else c.lineTo(x, y);
      }
      c.stroke();
      c.restore();
    };
    plot(series(C.BASE, scale)[metric], true, 'rgba(160,170,195,0.8)', 1.4);
    plot(series(run, scale)[metric], false, '#7cc4ff', 2);
    const px = xOf(scale.toS(t));
    c.strokeStyle = 'rgba(255,255,255,0.85)';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(px, T0);
    c.lineTo(px, H - B0);
    c.stroke();
  }

  UC.ui = UC.ui || {};
  UC.ui.chart = { draw, METRICS };
})();
