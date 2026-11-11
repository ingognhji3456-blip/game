'use strict';

/* =========================================================
 * 탑 그림 — ⚡ 폭풍의 눈 `storm_eye` (전설, 2026-11-11). 설계: docs/design/towers.md S5
 *  폭풍 해안 절벽의 바람 신전. 꼭대기 고리 안에 푸른 소용돌이 '폭풍의 눈'.
 *  idle: 눈이 천천히 돎 · aim: 눈이 빨리 돌며 밝아짐(바람 줄) · fire: 바람 고리가 터짐
 *  4A 태풍: 거대한 소용돌이 고리 · 4B 번개 회오리: 번개가 감긴 구리 피뢰 신전
 * ========================================================= */
(() => {
  const { f, M, fine, poly, cyl, ring, aura, spark, masonry, metalBand, gem } = RG.art._tw;
  const A = RG.art._tw.A;
  const { footShade, litWindow, burstRing, motion, zapArc, COPPER, rodTip } = A;
  const { GOLD, legendPlat } = RG.art._tw.L;
  const T = RG.art._tw.T;
  const SILVER = '#a8b0c4';

  /* ---------- 부품 ---------- */
  /** 소용돌이 눈: 푸른 구슬 안에 나선 — 가운데 (x,y), 반지름 r, 회전 rot(라디안) */
  function eye(c, x, y, r, pose, o = {}) {
    const rot = pose === 'aim' ? 0.9 : pose === 'fire' ? 1.7 : 0;
    const lit = pose === 'idle' ? 0.55 : 1;
    let s = aura(c, x, y, r * (1.8 + 0.5 * lit), r * (1.7 + 0.5 * lit), o.glow || '#8ad8ff', 0.35 + 0.35 * lit);
    s += c.ci(x, y, r, c.sg(o.col || '#5ab0e8'), 2.6);
    // 나선 세 갈래
    let d = '';
    for (let k = 0; k < 3; k++) {
      const a0 = rot + (k * Math.PI * 2) / 3;
      let p = '';
      for (let i = 0; i <= 10; i++) {
        const t = i / 10;
        const a = a0 + t * 3.2;
        const rr = r * (0.12 + 0.78 * t);
        p += `${i ? 'L' : 'M'}${f(x + Math.cos(a) * rr)} ${f(y + Math.sin(a) * rr)}`;
      }
      d += p;
    }
    s += c.ln(d, '#e8f8ff', Math.max(1.2, r * 0.16), 0.9);
    s += c.ci(x, y, r * 0.18, '#ffffff', 0);
    if (pose === 'aim') s += motion(c, `M${f(x - r * 2.2)} ${f(y - r * 0.6)}Q${f(x - r * 1.5)} ${f(y - r * 1.3)} ${f(x - r * 0.6)} ${f(y - r * 1.5)}M${f(x + r * 2.2)} ${f(y + r * 0.6)}Q${f(x + r * 1.5)} ${f(y + r * 1.3)} ${f(x + r * 0.6)} ${f(y + r * 1.5)}`, '#e8f8ff', 1.8, 0.8);
    if (pose === 'fire') s += burstRing(c, x, y, r * 2.4, r * 1.3, '#e8f8ff', 2.4, 0.85) + burstRing(c, x, y, r * 3.2, r * 1.7, '#9fd8ff', 1.8, 0.55);
    return s;
  }
  /** 고리 틀 (은빛 + 금 보석) — 눈을 감싸는 앞쪽 반 고리 */
  function frame(c, x, y, r, col = SILVER) {
    let s = c.ln(`M${f(x - r)} ${f(y)}A${f(r)} ${f(r)} 0 0 1 ${f(x + r)} ${f(y)}`, '#1c1426', 5.4) + c.ln(`M${f(x - r)} ${f(y)}A${f(r)} ${f(r)} 0 0 1 ${f(x + r)} ${f(y)}`, col, 3);
    s += c.ln(`M${f(x - r)} ${f(y)}A${f(r)} ${f(r)} 0 0 0 ${f(x + r)} ${f(y)}`, '#1c1426', 5.4) + c.ln(`M${f(x - r)} ${f(y)}A${f(r)} ${f(r)} 0 0 0 ${f(x + r)} ${f(y)}`, col, 3);
    s += gem(c, x, y - r, 2.4, 3, '#8ad8ff', true) + gem(c, x - r, y, 2, 2.6, GOLD, false) + gem(c, x + r, y, 2, 2.6, GOLD, false);
    return s;
  }
  /** 돌기둥에 새긴 나선 바람 무늬 */
  function windCarve(c, x, y1, y2, r) {
    let d = '';
    for (let y = y1 + 4; y < y2 - 2; y += 7) d += `M${f(x - r * 0.8)} ${f(y + 2)}Q${f(x)} ${f(y - 3)} ${f(x + r * 0.8)} ${f(y + 2)}`;
    return c.ln(d, '#5a6480', 1.4, 0.7) + c.ln(d.replace(/(\d+\.?\d*) (\d+\.?\d*)/g, (m, a, b) => `${a} ${(+b + 1).toFixed(1)}`), '#dfe6f4', 0.9, 0.5);
  }

  /* ---------- 단계별 ---------- */
  /* Lv1: 나무 기둥 + 바람개비(천 날개 넷) + 작은 소용돌이 */
  function lv1(c, pose) {
    const h = c.h;
    let o = legendPlat(c, 1);
    o += footShade(c, 50, 103, 16, 5);
    o += c.ol('M50 104V58', M.wood, 3.6);
    o += c.ol('M42 104L50 84L58 104', M.woodD, 2.2);
    const rot = pose === 'aim' ? 25 : pose === 'fire' ? 50 : 0;
    let sails = '';
    for (let i = 0; i < 4; i++) {
      const a = ((rot + i * 90) * Math.PI) / 180;
      const ux = Math.cos(a); const uy = Math.sin(a);
      const P = (t, w) => `${f(50 + ux * t - uy * w)} ${f(58 + uy * t + ux * w)}`;
      sails += `M${P(2, 0)}L${P(19, 0)}L${P(19, 7)}L${P(4, 5)}Z`;
    }
    o += c.p(sails, c.vg('#e8eef8', 0.2, -0.2), 2.2);
    o += c.ln(sails.replace(/Z/g, ''), '#9aa8c0', 0.8, 0.5);
    o += c.ci(50, 58, 2.6, c.sg(GOLD), 1.6);
    o += eye(c, 50, 36, 7, pose);
    return o;
  }

  /* Lv2·3: 은빛 돌기둥(나선 무늬) + 고리 속 폭풍의 눈. Lv3는 높고 작은 구름 둘 */
  function lv23(c, pose, L3) {
    let o = legendPlat(c, L3 ? 3 : 2, { stone: '#c8cede', trim: GOLD });
    o += footShade(c, 50, 103, 19, 6);
    const top = L3 ? 66 : 72;
    o += masonry(c, 50, top, 104, L3 ? 9 : 9.5, 14, 0.3, SILVER, { ch: 7, bw: 9, seed: L3 ? 101 : 99 });
    o += windCarve(c, 50, top, 104, L3 ? 11 : 11.5);
    if (L3) o += metalBand(c, 50, top + 4, top + 6.4, 9.8, 3, GOLD);
    o += c.p('M46 104V97Q50 93 54 97V104Z', c.vg('#3a4060', 0.1, -0.2), 2.2);
    o += cyl(c, 50, top - 3, top, L3 ? 11 : 10, 3.2, c.cg('#c8cede'), c.vg('#e8ecf4', 0.1, -0.1), 2.4);
    const ey = top - (L3 ? 18 : 15);
    const er = L3 ? 9 : 8;
    o += c.ol(`M${50 - er - 3} ${top - 2}L${50 - er - 1} ${ey}M${50 + er + 3} ${top - 2}L${50 + er + 1} ${ey}`, SILVER, 2.6);
    o += eye(c, 50, ey, er, pose);
    o += frame(c, 50, ey, er + 3);
    if (L3) {
      const cloud = (x, y, k) => c.p(`M${f(x - 7 * k)} ${f(y)}Q${f(x - 8 * k)} ${f(y - 5 * k)} ${f(x - 3 * k)} ${f(y - 5 * k)}Q${f(x)} ${f(y - 9 * k)} ${f(x + 4 * k)} ${f(y - 5 * k)}Q${f(x + 9 * k)} ${f(y - 5 * k)} ${f(x + 7 * k)} ${f(y)}Z`, c.vg('#e8eef8', 0.1, -0.2), 2);
      o += cloud(26, ey + 4, 0.8) + cloud(74, ey - 2, 0.8);
    }
    return o;
  }

  /* 4A 태풍: 넓은 신전 + 거대한 소용돌이 고리(겹친 바람 띠) */
  function typhoon(c, pose) {
    let o = legendPlat(c, 'A', { stone: '#d0d6e4', trim: GOLD, glow: '#8ad8ff' });
    o += footShade(c, 50, 99, 24, 7);
    for (const x of [36, 64]) o += masonry(c, x, 66, 99, 5, 6.5, 0.3, SILVER, { ch: 6, bw: 6, seed: x }) + metalBand(c, x, 70, 72.4, 5.4, 1.6, GOLD);
    o += c.p('M30 68Q50 60 70 68L70 64Q50 56 30 64Z', c.vg('#c8cede', 0.2, -0.2), 2.4);
    o += masonry(c, 50, 72, 99, 9, 11, 0.3, SILVER, { ch: 7, bw: 8, seed: 111 });
    o += windCarve(c, 50, 72, 99, 10);
    // 소용돌이 띠 셋 (뒤 → 앞)
    const rot = pose === 'aim' ? 0.4 : pose === 'fire' ? 0.8 : 0;
    for (let i = 0; i < 3; i++) {
      const ry = 34 - i * 2;
      const rx = 30 - i * 6;
      const a = rot + i * 1.1;
      o += c.e(50, ry, rx, rx * 0.32, 'none', 0, ` stroke="#9fd8ff" stroke-width="${c.sw(4)}" opacity="0.45"`);
      o += c.p(`M${f(50 + Math.cos(a) * rx)} ${f(ry + Math.sin(a) * rx * 0.32)}A${f(rx)} ${f(rx * 0.32)} 0 0 1 ${f(50 + Math.cos(a + 2.2) * rx)} ${f(ry + Math.sin(a + 2.2) * rx * 0.32)}`, 'none', 0, ` stroke="#ffffff" stroke-width="${c.sw(2)}" opacity="0.8"`);
    }
    o += eye(c, 50, 30, 10, pose);
    o += frame(c, 50, 30, 13);
    o += c.ol('M37 64L39 41M63 64L61 41', SILVER, 2.6);
    return o;
  }

  /* 4B 번개 회오리: 구리 피뢰 신전 + 번개가 감긴 눈 */
  function twister(c, pose) {
    let o = legendPlat(c, 'B', { stone: '#d0d6e4', trim: COPPER, glow: '#c9b8ff' });
    o += footShade(c, 50, 99, 22, 7);
    o += masonry(c, 50, 64, 99, 10, 14, 0.3, SILVER, { ch: 7, bw: 9, seed: 121 });
    o += metalBand(c, 50, 70, 72.6, 10.6, 3.2, COPPER) + metalBand(c, 50, 86, 88.6, 12.6, 3.8, COPPER);
    o += litWindow(c, 50, 84, 4.4, 6, '#c9b8ff', { frame: '#6a6a88' });
    o += cyl(c, 50, 61, 64, 12, 3.6, c.cg(COPPER), c.vg('#e8a870', 0.2, -0.1), 2.4);
    // 피뢰침 둘
    for (const x of [33, 67]) {
      o += c.ol(`M${x} 64L${x + (x < 50 ? 3 : -3)} 28`, COPPER, 2.6);
      o += rodTip(c, x + (x < 50 ? 3 : -3), 28, 2.6, pose);
    }
    o += eye(c, 50, 38, 10, pose, { col: '#6a8ae8', glow: '#c9b8ff' });
    o += frame(c, 50, 38, 13, COPPER);
    const zap = pose === 'idle' ? 0.5 : 1;
    o += c.ln('M36 30L42 36L38 40L46 44M64 30L58 35L62 40L54 45', '#c9b8ff', 2.6, 0.6 * zap) + c.ln('M36 30L42 36L38 40L46 44M64 30L58 35L62 40L54 45', '#ffffff', 1.1, 0.9 * zap);
    return o;
  }

  T.storm_eye = {
    /* 폭풍의 눈 가운데 */
    muzzle: [[50, 36], [50, 57], [50, 48], [50, 30], [50, 38]],
    draw(c, v, pose = 'idle') {
      c = fine(c);
      if (v === 1) return lv1(c, pose);
      if (v === 2) return lv23(c, pose, false);
      if (v === 3) return lv23(c, pose, true);
      if (v === 'A') return typhoon(c, pose);
      return twister(c, pose);
    },
  };
})();
