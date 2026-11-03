'use strict';

/* =========================================================
 * 픽셀 그림 — 기계 보스 "강철 요새 타이탄"
 *  titan       : 몸통. 프레임 = 모습×2 + 깜빡임 (모습 0 장갑 · 1 코어 열림 · 2 부서짐 · 3 폭주)
 *  turret      : 돌아가는 포탑 (프레임 = 포신 방향, 오른쪽 아래 → 왼쪽 아래)
 *  turretWreck : 부서진 포탑
 *  emissile    : 쫓아오는 적 미사일 (프레임 i = 위에서 시계 방향 i×45°)
 * ========================================================= */

(() => {
  const k = '#0e1220';
  const M = '#010203';
  const STEEL = ['#1e2638', '#3a4660', '#5e6e8c', '#8e9ebc'];
  const STEEL_HI = '#c8d4e8';

  function shade(P, cx, cy, rx, ry, cols) {
    for (let y = 0; y < P.h; y++) {
      for (let x = 0; x < P.w; x++) {
        if (P.get(x, y) !== M) continue;
        const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
        const v = -(nx * 0.55 + ny * 0.8) * 0.7 + (1 - Math.min(1, nx * nx + ny * ny)) * 0.35;
        P.set(x, y, v > 0.45 ? cols[3] : v > 0 ? cols[2] : v > -0.42 ? cols[1] : cols[0]);
      }
    }
  }
  const ring = (P, cx, cy, r0, r1, c) => {
    for (let y = Math.floor(cy - r1 - 1); y <= cy + r1 + 1; y++) {
      for (let x = Math.floor(cx - r1 - 1); x <= cx + r1 + 1; x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        if (d >= r0 && d <= r1) P.set(x, y, c);
      }
    }
  };

  /* =========================================================
   * 몸통
   * ========================================================= */
  SH.pix.paint('titan', 156, 96, 8, (P, f) => {
    const look = f >> 1, blink = f & 1;
    const red = look === 3;
    const CX = 78, CY = 52;

    // 뒤쪽 엔진 불꽃 (위)
    for (const ex of [50, 78, 106]) {
      const len = 5 + blink * 3 + (ex === 78 ? 2 : 0);
      for (let i = 0; i < len; i++) {
        const w = i < 2 ? 3 : i < len - 2 ? 2 : 1;
        P.rect(ex - Math.floor(w / 2), 11 - i, w, 1, red ? (i < 2 ? '#fff4a8' : i < 5 ? '#ff8a2a' : '#e8384f') : i < 2 ? '#ffffff' : i < 5 ? '#8fd4ff' : '#3a86f0');
      }
    }
    // 날개 (포탑을 단 양옆)
    for (const s of [-1, 1]) {
      const X = (x) => CX + s * x;
      P.poly([X(30), 30, X(66), 44, X(76), 58, X(70), 72, X(52), 76, X(32), 70], M);
    }
    shade(P, CX, 44, 78, 40, STEEL);
    // 본체
    P.poly([CX - 40, 18, CX - 18, 10, CX + 18, 10, CX + 40, 18, CX + 48, 40, CX + 44, 66, CX + 28, 82, CX, 90, CX - 28, 82, CX - 44, 66, CX - 48, 40], M);
    shade(P, CX, 42, 50, 46, STEEL);
    // 엔진 받침
    for (const ex of [50, 78, 106]) { P.rect(ex - 3, 11, 7, 5, '#2a3248'); P.rect(ex - 2, 12, 5, 1, '#5e6e8c'); }
    // 판 이음새
    for (const [x0, y0, x1, y1] of [[CX - 40, 18, CX - 30, 60], [CX + 40, 18, CX + 30, 60], [CX - 30, 60, CX, 74], [CX + 30, 60, CX, 74], [CX - 48, 40, CX - 30, 40], [CX + 48, 40, CX + 30, 40]]) P.line(x0, y0, x1, y1, STEEL[0]);
    for (const s of [-1, 1]) {
      P.line(CX + s * 32, 36, CX + s * 64, 50, STEEL[0]);
      P.line(CX + s * 40, 66, CX + s * 62, 70, STEEL[0]);
      // 리벳
      for (const [rx, ry] of [[36, 24], [44, 30], [24, 78], [56, 64], [70, 60], [40, 56]]) P.set(CX + s * rx, ry, STEEL_HI);
    }
    // 앞쪽 경고 줄무늬
    for (let x = CX - 26; x <= CX + 26; x++) {
      const y = 82 + Math.round(Math.abs(x - CX) * -0.28) + 4;
      const c = Math.floor((x + 200) / 3) % 2 ? '#ffd84a' : '#1b1230';
      P.set(x, y, c);
      P.set(x, y - 1, c);
    }
    // 함교 (위 가운데)
    P.rect(CX - 10, 20, 21, 12, '#2a3248');
    P.rect(CX - 9, 21, 19, 2, '#5e6e8c');
    for (let i = 0; i < 4; i++) P.rect(CX - 8 + i * 5, 25, 3, 3, (i + blink) % 4 === 0 ? '#fff4a8' : red ? '#ff5a5a' : '#8fd4ff');
    // 옆 발사구 (sides)
    for (const s of [-1, 1]) {
      const vx = CX + s * 24, vy = 69;
      P.rect(vx - 3, vy - 3, 7, 7, '#1e2638');
      P.rect(vx - 2, vy - 2, 5, 5, red ? (blink ? '#ff5a3a' : '#c4202e') : blink ? '#ffd84a' : '#ff8a2a');
      P.rect(vx - 1, vy - 1, 3, 3, red ? '#ffb0a0' : '#fff4a8');
    }
    // 포탑 자리
    for (const s of [-1, 1]) {
      ring(P, CX + s * 48, 61, 9.5, 12.5, '#1e2638');
      P.circle(CX + s * 48, 61, 9.5, '#2a3248');
    }
    // 코어
    ring(P, CX, CY, 15, 19, '#1e2638');
    ring(P, CX, CY, 17.5, 19, '#5e6e8c');
    if (look === 0) {
      // 닫힌 방어 덮개
      P.circle(CX, CY, 15, '#3a4660');
      for (let y = CY - 15; y <= CY + 15; y++) for (let x = CX - 15; x <= CX + 15; x++) {
        if (P.get(x, y) !== '#3a4660') continue;
        if (Math.abs(x - CX) <= 1) P.set(x, y, '#1e2638');
        else if (((x - y + 400) >> 2) % 2 === 0 && Math.hypot(x - CX, y - CY) > 11) P.set(x, y, '#ffd84a');
        else if (x < CX && y < CY) P.set(x, y, '#5e6e8c');
      }
      P.rect(CX - 3, CY - 2, 7, 5, '#1e2638');
      P.rect(CX - 2, CY - 1, 5, 3, blink ? '#e8384f' : '#8e1c3a');
    } else {
      const cols = look === 1 ? ['#1c3f9a', '#3a86f0', '#8fd4ff', '#ffffff'] : look === 2 ? ['#b8501c', '#ff8a2a', '#ffd84a', '#ffffff'] : ['#8e1c3a', '#e8384f', '#ff9a8a', '#ffffff'];
      const r = 14 + (blink ? 1 : 0);
      P.circle(CX, CY, r, cols[0]);
      P.circle(CX - 1, CY - 1, r - 3, cols[1]);
      P.circle(CX - 2, CY - 2, r - 7, cols[2]);
      P.circle(CX - 3, CY - 3, 2.5, cols[3]);
      // 열린 덮개 조각
      for (const s of [-1, 1]) P.rect(CX + s * 19 - (s < 0 ? 4 : 0), CY - 6, 5, 12, '#3a4660');
    }
    // 부서진 모습
    if (look >= 2) {
      for (const [hx, hy, r] of [[CX - 34, 30, 4], [CX + 28, 26, 3], [CX + 40, 50, 3.5], [CX - 20, 74, 3], [CX + 58, 66, 2.6], [CX - 62, 56, 3]]) {
        P.circle(hx, hy, r, '#0e1220');
        P.circle(hx - 0.5, hy - 0.5, r - 1.6, red ? '#e8384f' : '#ff6a1a');
        P.set(hx + r - 1, hy - r + 1, STEEL_HI);
      }
      for (const [x0, y0, x1, y1] of [[CX - 38, 34, CX - 30, 42], [CX + 26, 30, CX + 34, 22]]) P.line(x0, y0, x1, y1, '#0e1220');
      if (blink) for (const [sx, sy] of [[CX - 33, 26], [CX + 41, 46], [CX - 18, 70]]) { P.set(sx, sy, '#ffffff'); P.set(sx + 1, sy - 1, '#fff4a8'); }
    }
    // 폭주 경고등
    if (red) {
      for (const [lx, ly] of [[CX - 44, 42], [CX + 44, 42], [CX - 26, 16], [CX + 26, 16], [CX, 88]]) {
        P.rect(lx - 1, ly - 1, 3, 3, blink ? '#ff3030' : '#6a0a14');
        if (blink) P.set(lx, ly, '#ffffff');
      }
    } else {
      P.set(CX - 46, 42, blink ? '#45c44a' : '#23703a');
      P.set(CX + 46, 42, blink ? '#e8384f' : '#8e1c3a');
    }
    P.outline(k);
  });

  /* =========================================================
   * 포탑 (프레임 0 = 오른쪽 아래 끝 … 8 = 왼쪽 아래 끝)
   * ========================================================= */
  SH.TURRET_FRAMES = 9;
  SH.turretFrame = (ang) => Math.max(0, Math.min(8, Math.round(((ang - 0.25) / (Math.PI - 0.5)) * 8)));
  SH.pix.paint('turret', 30, 30, 9, (P, f) => {
    const ang = 0.25 + (f / 8) * (Math.PI - 0.5);
    const cx = 15, cy = 14;
    const ux = Math.cos(ang), uy = Math.sin(ang);
    // 포신 (굵게)
    const px = -uy, py = ux;
    P.poly([cx + px * 3, cy + py * 3, cx + ux * 13 + px * 3, cy + uy * 13 + py * 3, cx + ux * 13 - px * 3, cy + uy * 13 - py * 3, cx - px * 3, cy - py * 3], '#3a4660');
    P.poly([cx + px * 3, cy + py * 3, cx + ux * 13 + px * 3, cy + uy * 13 + py * 3, cx + ux * 13 + px * 1, cy + uy * 13 + py * 1, cx + px * 1, cy + py * 1], '#8e9ebc');
    P.poly([cx + ux * 12 + px * 4, cy + uy * 12 + py * 4, cx + ux * 15.5 + px * 4, cy + uy * 15.5 + py * 4, cx + ux * 15.5 - px * 4, cy + uy * 15.5 - py * 4, cx + ux * 12 - px * 4, cy + uy * 12 - py * 4], '#1e2638');
    P.set(cx + ux * 14, cy + uy * 14, '#ff8a2a');
    // 받침 (돔)
    P.circle(cx, cy, 8.6, M);
    shade(P, cx, cy, 8.6, 8.6, STEEL);
    P.circle(cx, cy, 3.4, '#1e2638');
    P.circle(cx - 0.5, cy - 0.5, 2, '#e8384f');
    P.set(cx - 1, cy - 1, '#ffb0a0');
    P.set(cx - 5, cy - 4, STEEL_HI); P.set(cx - 4, cy - 5, STEEL_HI);
    P.outline(k);
  });

  SH.pix.paint('turretWreck', 30, 30, 2, (P, f) => {
    const cx = 15, cy = 14;
    P.poly([cx - 8, cy + 2, cx - 6, cy - 5, cx - 1, cy - 8, cx + 4, cy - 6, cx + 8, cy - 1, cx + 6, cy + 6, cx, cy + 8, cx - 6, cy + 6], '#2a3248');
    P.poly([cx - 6, cy - 5, cx - 1, cy - 8, cx + 1, cy - 3, cx - 4, cy], '#3a4660');
    P.circle(cx, cy, 3, '#0e1220');
    P.set(cx, cy, f ? '#ff8a2a' : '#c4471a');
    P.set(cx + 1, cy - 1, f ? '#ffd84a' : '#ff8a2a');
    P.line(cx + 4, cy + 2, cx + 9, cy + 6, '#5e6e8c');
    P.outline(k);
  });

  /* =========================================================
   * 적 미사일
   * ========================================================= */
  const rot90 = (rows) => {
    const n = rows.length, m = rows[0].length, out = [];
    for (let x = 0; x < m; x++) { let s = ''; for (let y = n - 1; y >= 0; y--) s += rows[y][x]; out.push(s); }
    return out;
  };
  const up = [
    '....k....',
    '...krk...',
    '...kwk...',
    '...kgk...',
    '...kgk...',
    '..kdgdk..',
    '..kdkdk..',
    '...kyk...',
    '....o....',
  ];
  const ur = [
    '.......k.',
    '......krk',
    '.....kwk.',
    '....kgk..',
    '..kkgk...',
    '.kdgk....',
    '..kdk....',
    '.yk......',
    'o........',
  ];
  const u1 = rot90(up), u2 = rot90(u1), u3 = rot90(u2);
  const d1 = rot90(ur), d2 = rot90(d1), d3 = rot90(d2);
  SH.pix.sprite('emissile', {
    palette: { k: '#1b1230', r: '#e8384f', w: '#ffffff', g: '#d8d4ec', d: '#8e1c3a', y: '#ffd84a', o: '#ff8a2a' },
    frames: [up, ur, u1, d1, u2, d2, u3, d3],
  });
})();
