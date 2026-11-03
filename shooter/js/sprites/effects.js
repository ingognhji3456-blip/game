'use strict';

/* =========================================================
 * 픽셀 그림 — 효과(폭발·불꽃·연기)와 배경 소품(구름·섬·바위)
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

  /* =========================================================
   * 배경 소품 (대비를 낮게)
   * ========================================================= */
  function cloud(P, puffs) {
    // 그림자 → 몸 → 밝은 윗부분
    for (const [x, y, r] of puffs) P.circle(x, y + 1.5, r, '#b4d2ee');
    for (const [x, y, r] of puffs) P.circle(x, y, r, '#e8f4fe');
    for (const [x, y, r] of puffs) P.circle(x - r * 0.25, y - r * 0.3, r * 0.62, '#ffffff');
    P.outline('#a4c6e8');
  }
  SH.pix.paint('cloud0', 64, 26, 1, (P) => cloud(P, [[12, 15, 8], [24, 11, 10], [38, 10, 11], [50, 14, 8], [30, 17, 7], [57, 18, 5], [6, 19, 4]]));
  SH.pix.paint('cloud1', 48, 22, 1, (P) => cloud(P, [[10, 13, 7], [21, 9, 8], [33, 10, 8], [41, 15, 5], [24, 15, 6]]));
  SH.pix.paint('cloud2', 80, 30, 1, (P) => cloud(P, [[10, 19, 7], [22, 14, 10], [37, 11, 12], [52, 13, 11], [65, 17, 8], [73, 21, 5], [44, 20, 8], [28, 21, 7]]));
  SH.pix.paint('cloud3', 36, 16, 1, (P) => cloud(P, [[8, 9, 5], [16, 6, 6], [25, 7, 6], [31, 10, 3.6], [18, 10, 4]]));

  SH.pix.paint('island', 72, 54, 1, (P) => {
    // 아랫면 바위
    P.poly([5, 22, 67, 22, 56, 36, 44, 47, 36, 53, 28, 46, 15, 35], '#9a7e6a');
    P.poly([36, 22, 67, 22, 56, 36, 44, 47, 36, 53], '#7a6252');
    for (let y = 24; y < 52; y += 4) for (let x = 12; x < 62; x += 7) if (P.get(x + (y % 8), y) !== null) P.set(x + (y % 8), y, '#5e4a3e');
    // 윗면 풀
    P.ellipse(36, 19, 33, 14, '#6cbf58');
    P.ellipse(32, 16, 26, 10, '#86d46a');
    P.ellipse(26, 13, 14, 5, '#a2e284');
    // 나무
    for (const [x, y, r] of [[14, 16, 5], [21, 10, 6], [52, 14, 6], [59, 20, 4], [45, 24, 4]]) {
      P.circle(x + 1, y + 2, r, '#3f8a42');
      P.circle(x, y, r, '#58a852');
      P.circle(x - r * 0.3, y - r * 0.35, r * 0.5, '#7cc86a');
    }
    // 작은 집
    P.rect(31, 17, 9, 6, '#f4ead8');
    P.rect(38, 17, 2, 6, '#d8c8b0');
    P.poly([29.5, 17.5, 35.5, 11, 41.5, 17.5], '#d45a48');
    P.poly([35.5, 11, 41.5, 17.5, 37, 17.5], '#b04238');
    P.rect(34, 19, 2, 4, '#8a6a52');
    P.outline('#4e6e5a');
  });

  SH.pix.paint('rock', 44, 30, 1, (P) => {
    // 거품
    P.ellipse(22, 19, 21, 9.5, '#d8f2ff');
    for (let y = 9; y < 30; y++) for (let x = 0; x < 44; x++) if (P.get(x, y) === '#d8f2ff' && bay(x, y) < 0.35) P.set(x, y, '#9ccced');
    P.ellipse(22, 18, 17, 7, '#2a5a8a');
    // 바위
    P.poly([6, 18, 10, 9, 18, 4, 28, 5, 36, 11, 38, 18, 30, 22, 14, 22], '#6a6e86');
    P.poly([10, 9, 18, 4, 28, 5, 24, 10, 14, 12], '#9a9eb4');
    P.poly([28, 5, 36, 11, 38, 18, 30, 22, 26, 14], '#4e5068');
    P.set(17, 6, '#c8ccdc'); P.set(18, 6, '#c8ccdc');
    P.outline('#26304a');
  });

})();
