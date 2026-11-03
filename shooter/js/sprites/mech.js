'use strict';

/* =========================================================
 * 픽셀 그림 — 기계 보스 "강철 요새 타이탄"
 *  titan       : 몸통. 프레임 = 모습×2 + 깜빡임
 *                모습 0 완전 무장 · 1 장갑 붕괴(앞 장갑이 떨어지고 주포 칸이 드러남)
 *                     2 내부 노출(왼쪽 날개 끝이 뜯기고 구멍·배관, 등 뒤 격납고 열림) · 3 폭주(뼈대만 남고 코어가 녹아내림)
 *  turret      : 1단계 포탑 (프레임 = 포신 방향)      turretWreck : 부서진 포탑
 *  cannon      : 2단계부터 나오는 주포 (프레임 = 포신 방향)
 *  pod         : 3단계부터 나오는 미사일 포드 (프레임 = 뚜껑 열림 정도)
 *  wallgun     : 벽에서 나오는 레이저포 (프레임 i = 오른쪽에서 시계 방향 i×22.5°)
 *  emissile    : 쫓아오는 적 미사일 (프레임 i = 위에서 시계 방향 i×45°)
 *  scrap       : 떨어져 나가는 쇳조각
 * 무기 자리(픽셀, 그림 가운데 기준): 코어 (0,0) · 주포 (0,26) · 포탑 (±50,12) · 발사구 (±28,22) · 배기구 (±40,-10) · 포드 (±18,-24) · 신호기 (0,-35)
 * ========================================================= */

(() => {
  const k = '#0e1220';
  const M = '#010203';
  const STEEL = ['#1e2638', '#3a4660', '#5e6e8c', '#8e9ebc'];
  const HI = '#c8d4e8';
  const DARK = '#141826';
  const RIB = '#3a4660';
  const TAU = Math.PI * 2;

  function shade(P, cx, cy, rx, ry, cols, marker) {
    const mk = marker || M;
    for (let y = 0; y < P.h; y++) {
      for (let x = 0; x < P.w; x++) {
        if (P.get(x, y) !== mk) continue;
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
  /** 다각형 모양으로 지우기 (뜯겨 나간 자리) */
  const cut = (P, pts) => P.poly(pts, '#ff00fe');
  const finishCut = (P) => P.replace('#ff00fe', null);
  /** 쇳조각 들쭉날쭉한 구멍 */
  function hole(P, cx, cy, r, seed, fire, f) {
    for (let a = 0; a < 18; a++) {
      const ang = (a / 18) * TAU;
      const rr = r * (0.75 + 0.35 * Math.abs(Math.sin(seed * 3.7 + a * 1.9)));
      P.line(cx, cy, cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr, DARK);
    }
    P.line(cx - r * 0.6, cy - r * 0.2, cx + r * 0.6, cy + r * 0.3, '#c88a1a');
    P.line(cx - r * 0.3, cy + r * 0.5, cx + r * 0.4, cy - r * 0.5, seed % 2 ? '#e8384f' : '#3a86f0');
    if (fire) {
      const fl = f ? ['#ffd84a', '#ff8a2a'] : ['#ff8a2a', '#e8384f'];
      P.set(cx, cy - 1, fl[0]); P.set(cx + 1, cy - 2 - f, fl[1]); P.set(cx - 1, cy - 1 - f, fl[1]);
    }
  }
  /** 뼈대 (철골) */
  function girders(P, x0, y0, x1, y1) {
    for (let x = x0; x <= x1; x += 8) P.line(x, y0, x, y1, RIB);
    P.line(x0, y0, x1, y0, RIB);
    P.line(x0, y1, x1, y1, RIB);
    for (let x = x0; x + 8 <= x1; x += 8) { P.line(x, y0, x + 8, y1, '#2a3248'); }
  }

  /* =========================================================
   * 몸통
   * ========================================================= */
  SH.pix.paint('titan', 156, 96, 8, (P, f) => {
    const look = f >> 1, blink = f & 1;
    const CX = 78, CY = 48;
    const fireCols = blink ? ['#fff4a8', '#ffd84a', '#ff8a2a'] : ['#ffd84a', '#ff8a2a', '#e8384f'];

    // 뒤 엔진 불꽃 (위쪽)
    const red = look === 3;
    for (const [ex, on] of [[CX - 26, look < 3], [CX, true], [CX + 26, look < 2]]) {
      if (!on) continue;
      const len = 4 + blink * 3;
      for (let i = 0; i < len; i++) {
        const w = i < 2 ? 3 : i < len - 2 ? 2 : 1;
        P.rect(ex - Math.floor(w / 2), 7 - i, w, 1, red ? (i < 2 ? '#fff4a8' : '#ff8a2a') : i < 2 ? '#ffffff' : i < 4 ? '#8fd4ff' : '#3a86f0');
      }
    }

    // ---- 겉모양 (날개 + 본체) ----
    for (const s of [-1, 1]) {
      const X = (x) => CX + s * x;
      P.poly([X(30), 26, X(66), 40, X(76), 54, X(70), 68, X(52), 72, X(32), 66], M);
    }
    P.poly([CX - 40, 14, CX - 18, 6, CX + 18, 6, CX + 40, 14, CX + 48, 36, CX + 44, 62, CX + 28, 78, CX, 86, CX - 28, 78, CX - 44, 62, CX - 48, 36], M);
    // 뜯겨 나간 날개
    if (look >= 2) cut(P, [CX - 80, 30, CX - 58, 40, CX - 62, 50, CX - 56, 58, CX - 68, 72, CX - 80, 72]);
    if (look >= 3) cut(P, [CX + 80, 50, CX + 66, 56, CX + 70, 62, CX + 60, 74, CX + 80, 74]);
    finishCut(P);
    shade(P, CX, 40, 78, 44, STEEL);

    // 엔진 받침
    for (const ex of [CX - 26, CX, CX + 26]) { P.rect(ex - 3, 7, 7, 5, '#2a3248'); P.rect(ex - 2, 8, 5, 1, '#5e6e8c'); }
    // 판 이음새 · 리벳
    for (const [x0, y0, x1, y1] of [[CX - 40, 14, CX - 30, 56], [CX + 40, 14, CX + 30, 56], [CX - 48, 36, CX - 30, 36], [CX + 48, 36, CX + 30, 36]]) P.line(x0, y0, x1, y1, STEEL[0]);
    for (const s of [-1, 1]) {
      P.line(CX + s * 32, 32, CX + s * 64, 46, STEEL[0]);
      for (const [rx, ry] of [[36, 20], [44, 26], [56, 60], [70, 56], [40, 52]]) if (P.get(CX + s * rx, ry)) P.set(CX + s * rx, ry, HI);
    }

    // ---- 앞 장갑 / 주포 칸 ----
    if (look === 0) {
      // 앞 장갑판 + 닫힌 주포 덮개
      P.poly([CX - 26, 64, CX + 26, 64, CX + 22, 80, CX, 86, CX - 22, 80], '#3a4660');
      P.poly([CX - 26, 64, CX + 26, 64, CX + 24, 68, CX - 24, 68], '#5e6e8c');
      P.rect(CX - 9, 70, 19, 9, '#1e2638');
      for (let x = CX - 8; x <= CX + 9; x++) P.set(x, 74, Math.floor((x + 300) / 2) % 2 ? '#ffd84a' : '#1e2638');
      P.rect(CX - 1, 70, 2, 9, '#5e6e8c');
      // 경고 줄무늬
      for (let x = CX - 22; x <= CX + 22; x++) {
        const y = 80 + Math.round(-Math.abs(x - CX) * 0.25) + 2;
        const c = Math.floor((x + 300) / 3) % 2 ? '#ffd84a' : '#1b1230';
        P.set(x, y, c); P.set(x, y - 1, c);
      }
    } else {
      // 앞 장갑이 떨어져 나가 들쭉날쭉한 가장자리 + 안쪽 뼈대 + 주포 칸
      const edge = [CX - 30, 60, CX - 24, 66, CX - 27, 72, CX - 18, 76, CX - 20, 82, CX - 8, 84, CX, 88, CX + 9, 83, CX + 19, 84, CX + 18, 76, CX + 27, 71, CX + 24, 65, CX + 30, 60];
      P.poly(edge, DARK);
      girders(P, CX - 22, 64, CX + 22, 80);
      P.rect(CX - 10, 68, 21, 14, '#0a0d18');
      ring(P, CX, 74, 7, 9, '#2a3248');
      // 떨어진 장갑 잔해 자국
      for (const [x, y] of [[CX - 30, 60], [CX + 30, 60], [CX - 20, 82], [CX + 19, 84]]) { P.set(x, y, HI); P.set(x + 1, y + 1, '#5e6e8c'); }
      // 그을음
      for (const [x, y] of [[CX - 34, 58], [CX + 33, 57], [CX - 12, 60], [CX + 14, 61]]) if (P.get(x, y)) { P.set(x, y, STEEL[0]); P.set(x + 1, y, STEEL[0]); }
    }

    // ---- 함교 · 신호기 ----
    P.rect(CX - 10, 16, 21, 10, '#2a3248');
    P.rect(CX - 9, 17, 19, 2, '#5e6e8c');
    for (let i = 0; i < 4; i++) P.rect(CX - 8 + i * 5, 20, 3, 3, (i + blink) % 4 === 0 ? '#fff4a8' : red ? '#ff5a5a' : '#8fd4ff');
    P.rect(CX - 1, 9, 3, 8, '#5e6e8c');
    P.rect(CX - 3, 11, 7, 2, '#3a4660');

    // ---- 포탑 자리 ----
    for (const s of [-1, 1]) {
      const tx = CX + s * 50, ty = 60;
      if (look === 0) {
        ring(P, tx, ty, 9.5, 12.5, '#1e2638');
        P.circle(tx, ty, 9.5, '#2a3248');
      } else if (!(look >= 2 && s < 0)) {
        hole(P, tx, ty, 8, s + 3, true, blink);
        P.line(tx - 9, ty - 4, tx - 4, ty - 9, HI);
        P.line(tx + 6, ty + 5, tx + 10, ty + 2, '#5e6e8c');
      }
    }

    // ---- 플라스마 발사구 / 배기구 ----
    for (const s of [-1, 1]) {
      const ex = CX + s * 28, ey = 70;
      const vx = CX + s * 40, vy = 38;
      if (look <= 1) {
        P.circle(ex, ey, 5, '#1e2638');
        P.circle(ex, ey, 3.6, blink ? '#c9a8ff' : '#8850e0');
        P.set(ex - 1, ey - 1, '#ffffff');
        P.rect(vx - 5, vy - 3, 11, 7, '#1e2638');
        for (let i = 0; i < 4; i++) P.rect(vx - 4, vy - 2 + i * 2 - (i > 1 ? 1 : 0), 9, 1, '#5e6e8c');
      } else {
        if (!(look >= 2 && s < 0 && ex < CX - 56)) hole(P, ex, ey, 5, s + 7, true, blink);
        hole(P, vx, vy, 5, s + 11, look >= 3, blink);
      }
    }

    // ---- 등 뒤 격납고 (미사일 포드 자리) ----
    for (const s of [-1, 1]) {
      const px = CX + s * 18, py = 24;
      if (look <= 1) {
        P.rect(px - 7, py - 5, 15, 11, '#3a4660');
        P.rect(px - 7, py - 5, 15, 1, '#5e6e8c');
        P.line(px - 7, py, px + 7, py, '#1e2638');
      } else {
        P.rect(px - 8, py - 6, 17, 13, DARK);
        P.rect(px - 9, py - 7, 3, 2, '#5e6e8c'); // 날아간 뚜껑 경첩
        P.rect(px + 7, py - 7, 3, 2, '#5e6e8c');
      }
    }

    // ---- 내부 노출 · 폭주: 구멍, 배관, 뼈대 ----
    if (look >= 2) {
      for (const [hx, hy, r, sd] of [[CX - 36, 28, 5, 1], [CX + 30, 22, 4, 2], [CX + 42, 50, 5, 3], [CX - 14, 54, 3.5, 4]]) hole(P, hx, hy, r, sd, true, blink);
      // 뜯긴 날개 끝의 철골
      girders(P, CX - 60, 42, CX - 50, 60);
      P.line(CX - 58, 40, CX - 66, 46, HI);
    }
    if (look >= 3) {
      // 넓게 벗겨진 판 → 철골 사이로 바닥이 보임
      for (const [x0, y0, x1, y1] of [[CX - 44, 30, CX - 30, 46], [CX + 28, 28, CX + 44, 44], [CX - 24, 34, CX - 14, 44]]) {
        P.rect(x0, y0, x1 - x0, y1 - y0, '#ff00fe');
        finishCut(P);
        girders(P, x0, y0, x1, y1);
      }
      girders(P, CX + 56, 54, CX + 64, 66);
      for (const [x, y] of [[CX - 40, 44], [CX + 36, 30], [CX + 60, 52], [CX - 20, 70]]) {
        P.set(x, y, fireCols[0]); P.set(x, y - 1, fireCols[1]); P.set(x + 1, y - 2 - blink, fireCols[2]);
      }
    }

    // ---- 코어 ----
    ring(P, CX, CY, 14, 18, '#1e2638');
    ring(P, CX, CY, 16.5, 18, '#5e6e8c');
    if (look === 0) {
      P.circle(CX, CY, 14, '#3a4660');
      for (let y = CY - 14; y <= CY + 14; y++) for (let x = CX - 14; x <= CX + 14; x++) {
        if (P.get(x, y) !== '#3a4660') continue;
        if (Math.abs(x - CX) <= 1) P.set(x, y, '#1e2638');
        else if (((x - y + 400) >> 2) % 2 === 0 && Math.hypot(x - CX, y - CY) > 10) P.set(x, y, '#ffd84a');
        else if (x < CX && y < CY) P.set(x, y, '#5e6e8c');
      }
      P.rect(CX - 3, CY - 2, 7, 5, '#1e2638');
      P.rect(CX - 2, CY - 1, 5, 3, blink ? '#e8384f' : '#8e1c3a');
    } else {
      const cols = look === 1 ? ['#1c3f9a', '#3a86f0', '#8fd4ff', '#ffffff'] : look === 2 ? ['#b8501c', '#ff8a2a', '#ffd84a', '#ffffff'] : ['#8e1c3a', '#e8384f', '#ff9a8a', '#ffffff'];
      const r = 13 + blink;
      P.circle(CX, CY, r, cols[0]);
      P.circle(CX - 1, CY - 1, r - 3, cols[1]);
      P.circle(CX - 2, CY - 2, r - 7, cols[2]);
      P.circle(CX - 3, CY - 3, 2.4, cols[3]);
      if (look === 3) {
        // 코어에서 뻗어 나가는 붉은 금
        for (let a = 0; a < 6; a++) {
          const ang = (a / 6) * TAU + 0.4;
          P.line(CX + Math.cos(ang) * 17, CY + Math.sin(ang) * 17, CX + Math.cos(ang) * (24 + (a % 2) * 6), CY + Math.sin(ang) * (24 + (a % 2) * 6), blink ? '#ff5a3a' : '#c4202e');
        }
      }
    }

    // ---- 불빛 ----
    if (red) {
      for (const [lx, ly] of [[CX - 44, 38], [CX + 44, 38], [CX - 26, 12], [CX + 26, 12]]) {
        if (!P.get(lx, ly)) continue;
        P.rect(lx - 1, ly - 1, 3, 3, blink ? '#ff3030' : '#6a0a14');
        if (blink) P.set(lx, ly, '#ffffff');
      }
    } else {
      if (P.get(CX - 46, 38)) P.set(CX - 46, 38, blink ? '#45c44a' : '#23703a');
      P.set(CX + 46, 38, blink ? '#e8384f' : '#8e1c3a');
    }
    P.outline(k);
  });

  /* =========================================================
   * 포탑 (프레임 0 = 오른쪽 아래 끝 … 8 = 왼쪽 아래 끝)
   * ========================================================= */
  const angFrame = (ang, lo, hi, n) => Math.max(0, Math.min(n - 1, Math.round(((ang - lo) / (hi - lo)) * (n - 1))));
  SH.turretFrame = (ang) => angFrame(ang, 0.25, Math.PI - 0.25, 9);
  SH.cannonFrame = (ang) => angFrame(ang, 0.2, Math.PI - 0.2, 13);
  SH.wallgunFrame = (ang) => ((Math.round(ang / (TAU / 16)) % 16) + 16) % 16;

  function barrel(P, cx, cy, ang, len, half, cols) {
    const ux = Math.cos(ang), uy = Math.sin(ang), px = -uy, py = ux;
    P.poly([cx + px * half, cy + py * half, cx + ux * len + px * half, cy + uy * len + py * half, cx + ux * len - px * half, cy + uy * len - py * half, cx - px * half, cy - py * half], cols[0]);
    P.poly([cx + px * half, cy + py * half, cx + ux * len + px * half, cy + uy * len + py * half, cx + ux * len + px * (half - 2), cy + uy * len + py * (half - 2), cx + px * (half - 2), cy + py * (half - 2)], cols[1]);
    const m = half + 1;
    P.poly([cx + ux * (len - 3) + px * m, cy + uy * (len - 3) + py * m, cx + ux * (len + 1) + px * m, cy + uy * (len + 1) + py * m, cx + ux * (len + 1) - px * m, cy + uy * (len + 1) - py * m, cx + ux * (len - 3) - px * m, cy + uy * (len - 3) - py * m], cols[2]);
  }

  SH.pix.paint('turret', 30, 30, 9, (P, f) => {
    const ang = 0.25 + (f / 8) * (Math.PI - 0.5);
    const cx = 15, cy = 14;
    barrel(P, cx, cy, ang, 13, 3, ['#3a4660', '#8e9ebc', '#1e2638']);
    P.set(cx + Math.cos(ang) * 14, cy + Math.sin(ang) * 14, '#ff8a2a');
    P.circle(cx, cy, 8.6, M);
    shade(P, cx, cy, 8.6, 8.6, STEEL);
    P.circle(cx, cy, 3.4, '#1e2638');
    P.circle(cx - 0.5, cy - 0.5, 2, '#e8384f');
    P.set(cx - 1, cy - 1, '#ffb0a0');
    P.set(cx - 5, cy - 4, HI); P.set(cx - 4, cy - 5, HI);
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

  /* ---------------- 주포 ---------------- */
  SH.pix.paint('cannon', 40, 40, 13, (P, f) => {
    const ang = 0.2 + (f / 12) * (Math.PI - 0.4);
    const cx = 20, cy = 17;
    barrel(P, cx, cy, ang, 17, 4, ['#3a4660', '#8e9ebc', '#1e2638']);
    // 코일 줄무늬 (충전 장치)
    for (const t of [7, 10, 13]) {
      const x = cx + Math.cos(ang) * t, y = cy + Math.sin(ang) * t;
      P.line(x - Math.sin(ang) * 4, y + Math.cos(ang) * 4, x + Math.sin(ang) * 4, y - Math.cos(ang) * 4, '#c88a1a');
    }
    P.circle(cx + Math.cos(ang) * 17.5, cy + Math.sin(ang) * 17.5, 2, '#0a0d18');
    // 받침
    P.poly([cx - 9, cy - 4, cx - 4, cy - 9, cx + 4, cy - 9, cx + 9, cy - 4, cx + 9, cy + 4, cx + 4, cy + 9, cx - 4, cy + 9, cx - 9, cy + 4], M);
    shade(P, cx, cy, 9, 9, STEEL);
    P.circle(cx, cy, 4, '#1e2638');
    P.circle(cx - 0.5, cy - 0.5, 2.6, '#3a86f0');
    P.set(cx - 1, cy - 1, '#e0f7ff');
    P.outline(k);
  });

  /* ---------------- 미사일 포드 (뚜껑 열림 0~3) ---------------- */
  SH.pix.paint('pod', 22, 18, 4, (P, f) => {
    P.rect(2, 2, 18, 14, '#2a3248');
    P.rect(3, 3, 16, 12, '#141826');
    // 발사관 4개
    for (const [x, y] of [[5, 5], [12, 5], [5, 10], [12, 10]]) {
      P.rect(x, y, 5, 4, '#3a4660');
      P.rect(x + 1, y + 1, 3, 2, f >= 2 ? '#e8384f' : '#5a1020');
      if (f >= 3) P.set(x + 2, y + 1, '#ffffff');
    }
    // 미닫이 뚜껑
    const gap = [0, 3, 6, 8][f];
    if (gap < 8) {
      P.rect(2, 2, 9 - gap, 14, '#5e6e8c');
      P.rect(11 + gap, 2, 9 - gap, 14, '#5e6e8c');
      P.rect(2, 2, 9 - gap, 1, '#8e9ebc');
      P.rect(11 + gap, 2, 9 - gap, 1, '#8e9ebc');
      if (gap === 0) for (let y = 3; y < 16; y += 3) P.set(10, y, '#ffd84a');
    }
    P.outline(k);
  });

  /* ---------------- 벽 레이저포 (16방향) ---------------- */
  SH.pix.paint('wallgun', 32, 32, 16, (P, f) => {
    const ang = (f / 16) * TAU;
    const cx = 16, cy = 16;
    barrel(P, cx, cy, ang, 13, 3, ['#4a3a60', '#c9a8ff', '#1e2638']);
    P.set(cx + Math.cos(ang) * 14, cy + Math.sin(ang) * 14, '#ff3b4e');
    // 몸체 (육각 덩어리)
    P.poly([cx - 7, cy - 3, cx - 3, cy - 7, cx + 3, cy - 7, cx + 7, cy - 3, cx + 7, cy + 3, cx + 3, cy + 7, cx - 3, cy + 7, cx - 7, cy + 3], M);
    shade(P, cx, cy, 7, 7, ['#2a1a40', '#44257e', '#6a4aa0', '#9a86c8']);
    P.circle(cx, cy, 2.6, '#1e1030');
    P.set(cx, cy, '#ff3b4e');
    P.set(cx - 4, cy - 4, '#d8c8ff');
    P.outline(k);
  });

  /* ---------------- 쇳조각 ---------------- */
  SH.pix.sprite('scrap', {
    palette: { k, a: '#8e9ebc', b: '#5e6e8c', c: '#3a4660' },
    frames: [
      ['.kkk..', 'kaabk.', 'kabbck', '.kbcck', '..kkk.', '......'],
      ['..kk..', '.kabk.', 'kaabck', 'kbbcck', '.kcck.', '..kk..'],
      ['......', '.kkk..', 'kcbaak', 'kcbbak', '.kkcbk', '...kk.'],
      ['..kk..', '.kcck.', 'kcbbak', 'kbaabk', '.kbak.', '..kk..'],
    ],
  });

  /* ---------------- 적 미사일 ---------------- */
  const rot90 = (rows) => {
    const n = rows.length, m = rows[0].length, out = [];
    for (let x = 0; x < m; x++) { let s = ''; for (let y = n - 1; y >= 0; y--) s += rows[y][x]; out.push(s); }
    return out;
  };
  const up = ['....k....', '...krk...', '...kwk...', '...kgk...', '...kgk...', '..kdgdk..', '..kdkdk..', '...kyk...', '....o....'];
  const ur = ['.......k.', '......krk', '.....kwk.', '....kgk..', '..kkgk...', '.kdgk....', '..kdk....', '.yk......', 'o........'];
  const u1 = rot90(up), u2 = rot90(u1), u3 = rot90(u2);
  const d1 = rot90(ur), d2 = rot90(d1), d3 = rot90(d2);
  SH.pix.sprite('emissile', {
    palette: { k: '#1b1230', r: '#e8384f', w: '#ffffff', g: '#d8d4ec', d: '#8e1c3a', y: '#ffd84a', o: '#ff8a2a' },
    frames: [up, ur, u1, d1, u2, d2, u3, d3],
  });
})();
