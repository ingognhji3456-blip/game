'use strict';

/* =========================================================
 * 픽셀 그림 — 효과 (폭발 · 불꽃 · 연기)
 * ========================================================= */

(() => {
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const bay = (x, y) => (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;

  /** 폭발 한 장: u = 0(시작) → 1(끝) */
  function boom(P, size, u) {
    const c = (size - 1) / 2;
    const R = size * 0.48;
    const r = R * (0.35 + Math.min(1, u * 1.8) * 0.65);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const d = Math.hypot(x - c, y - c) / r;
        if (d > 1) continue;
        const noise = bay(x, y);
        if (u < 0.12) { P.set(x, y, d < 0.7 ? '#ffffff' : '#fff4a8'); continue; }
        if (u > 0.5 && noise < (u - 0.5) * 2.2 + d * 0.25) continue; // 흩어지며 사라짐
        let col;
        const heat = 1 - d - u * 0.9 + noise * 0.25;
        if (u > 0.62) col = heat > 0.05 ? '#ff5a1a' : d > 0.6 ? '#3a2e3e' : '#5a4a5a';
        else if (heat > 0.55) col = '#ffffff';
        else if (heat > 0.32) col = '#fff4a8';
        else if (heat > 0.1) col = '#ffd84a';
        else if (heat > -0.15) col = '#ff8a2a';
        else col = '#c42a1a';
        P.set(x, y, col);
      }
    }
  }
  SH.pix.paint('boom', 16, 16, 6, (P, f) => boom(P, 16, f / 6));
  SH.pix.paint('boomBig', 32, 32, 8, (P, f) => {
    boom(P, 32, f / 8);
    // 파편
    if (f >= 1 && f <= 5) {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + 0.4;
        const d = 9 + f * 2.2;
        const x = 15.5 + Math.cos(a) * d, y = 15.5 + Math.sin(a) * d;
        P.set(x, y, f < 4 ? '#fff4a8' : '#ff8a2a');
        P.set(x - Math.cos(a), y - Math.sin(a), '#ff8a2a');
      }
    }
  });

  SH.pix.sprite('hitSpark', {
    palette: { w: '#ffffff', y: '#fff4a8', o: '#ffd84a' },
    frames: [[
      '...w...',
      '...w...',
      '..yww..',
      'wwwwwww',
      '..wwy..',
      '...w...',
      '...w...',
    ], [
      '.o...o.',
      '..y.y..',
      '...w...',
      '..ywy..',
      '...w...',
      '..y.y..',
      '.o...o.',
    ], [
      '.......',
      '.......',
      '...y...',
      '..ywy..',
      '...y...',
      '.......',
      '.......',
    ]],
  });

  SH.pix.sprite('pop', {
    palette: { w: '#ffffff', c: '#e0f7ff' },
    frames: [[
      '..www..',
      '.w...w.',
      'w.....w',
      'w.....w',
      'w.....w',
      '.w...w.',
      '..www..',
    ], [
      '.......',
      '..ccc..',
      '.c...c.',
      '.c...c.',
      '.c...c.',
      '..ccc..',
      '.......',
    ], [
      '.......',
      '.......',
      '..c.c..',
      '.......',
      '..c.c..',
      '.......',
      '.......',
    ]],
  });

  SH.pix.paint('puff', 10, 10, 4, (P, f) => {
    const r = 4.6 - f * 0.6;
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 10; x++) {
        const d = Math.hypot(x - 4.5, y - 4.5);
        if (d > r) continue;
        if (bay(x, y) < f * 0.24) continue;
        P.set(x, y, x + y < 8 ? '#9a96b8' : '#5a5680');
      }
    }
  });

})();
