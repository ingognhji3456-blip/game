'use strict';

/* =========================================================
 * 탑 그림 — 🌍 거인의 바위 `titan_boulder` (전설, 2026-11-11). 설계: docs/design/towers.md E5
 *  솔빛 들판 언덕의 돌 거인 작업장. 거인의 돌 팔이 바위를 들어 길로 굴려 보냄. 바위는 렌더러가 따로 굴림.
 *  idle: 바위를 쥐고 쉼 · aim: 팔을 높이 들어 올림 · fire: 팔을 내려 바위를 놓음(바위는 사라지고 먼지·움직임 줄)
 *  4A 산사태: 바위가 잔뜩 쌓인 절벽 성채 · 4B 거인의 철구: 쇠사슬에 매단 거대한 철구
 * ========================================================= */
(() => {
  const { f, M, fine, poly, cyl, ring, aura, spark, masonry, metalBand, gem } = RG.art._tw;
  const A = RG.art._tw.A;
  const { footShade, litWindow, planks, motion, smoke, G, rotP } = A;
  const { GOLD, legendPlat } = RG.art._tw.L;
  const T = RG.art._tw.T;
  const ROCK = '#a89a84';
  const EARTHSTONE = '#9a9478';

  /* ---------- 부품 ---------- */
  /** 모난 바위 — 가운데 (x,y), 반지름 r */
  function rock(c, x, y, r, col = ROCK, seed = 0) {
    const h = c.h;
    const pts = [];
    for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2 + seed; const rr = r * (0.86 + 0.14 * Math.sin(i * 2.3 + seed * 3)); pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.92]); }
    let s = c.p(poly(pts), c.vg(col, 0.28, -0.35), 2.4);
    s += c.p(poly([pts[5], pts[6], pts[7], [x, y - r * 0.1]]), h.shade(col, 0.3), 0, ' opacity="0.7"');
    s += c.ln(`M${f(x - r * 0.2)} ${f(y - r * 0.3)}L${f(x + r * 0.1)} ${f(y + r * 0.2)}L${f(x + r * 0.5)} ${f(y + r * 0.1)}M${f(x + r * 0.1)} ${f(y + r * 0.2)}L${f(x - r * 0.1)} ${f(y + r * 0.6)}`, h.shade(col, -0.45), 1.4, 0.85);
    return s;
  }
  /** 거인의 돌 팔: 어깨 (sx,sy)에서 각 ang(도, 0=오른쪽 위로 뻗음 기준)으로 뻗어 손에 물건을 쥠 */
  function arm(c, sx, sy, ang, L, held) {
    const h = c.h;
    const a = (ang * Math.PI) / 180;
    const ex = sx + Math.cos(a) * L * 0.5;
    const ey = sy - Math.sin(a) * L * 0.5;
    const a2 = a + 0.35; // 팔뚝은 조금 더 위로 꺾임
    const hx = ex + Math.cos(a2) * L * 0.45;
    const hy = ey - Math.sin(a2) * L * 0.45;
    const seg = (x1, y1, x2, y2, w) => { const dx = x2 - x1; const dy = y2 - y1; const l = Math.hypot(dx, dy) || 1; const px = (-dy / l) * w; const py = (dx / l) * w; return c.p(`M${f(x1 + px)} ${f(y1 + py)}L${f(x2 + px * 0.85)} ${f(y2 + py * 0.85)}L${f(x2 - px * 0.85)} ${f(y2 - py * 0.85)}L${f(x1 - px)} ${f(y1 - py)}Z`, c.vg(EARTHSTONE, 0.25, -0.3), 2.6); };
    let s = c.ci(sx, sy, 6.4, c.sg(h.shade(EARTHSTONE, -0.05)), 2.4); // 어깨
    s += seg(sx, sy, ex, ey, 6.6);
    s += c.ci(ex, ey, 5.6, c.sg(h.shade(EARTHSTONE, -0.05)), 2.4); // 팔꿈치
    s += seg(ex, ey, hx, hy, 5.8);
    s += c.ln(`M${f(sx + (ex - sx) * 0.45 - 2)} ${f(sy + (ey - sy) * 0.45 - 2)}l3 4M${f(ex + (hx - ex) * 0.5 - 2)} ${f(ey + (hy - ey) * 0.5 - 2)}l3 4`, h.shade(EARTHSTONE, -0.45), 1.3, 0.8);
    // 손바닥 → 쥔 것 → 앞 손가락 둘(쥔 것을 감쌈)
    const rx = hx + Math.cos(a2) * 8;
    const ry = hy - Math.sin(a2) * 8;
    s += c.p(`M${f(hx - 6)} ${f(hy + 2)}Q${f(hx - 4)} ${f(hy - 7)} ${f(hx + 4)} ${f(hy - 6)}Q${f(hx + 8)} ${f(hy)} ${f(hx + 3)} ${f(hy + 6)}Q${f(hx - 3)} ${f(hy + 7)} ${f(hx - 6)} ${f(hy + 2)}Z`, c.vg(h.shade(EARTHSTONE, 0.08), 0.25, -0.3), 2.4);
    if (held) {
      s += held(rx, ry);
      s += c.ol(`M${f(hx + 2)} ${f(hy + 3)}Q${f(rx + 6)} ${f(ry + 9)} ${f(rx + 9)} ${f(ry + 1)}M${f(hx - 1)} ${f(hy + 5)}Q${f(rx)} ${f(ry + 12)} ${f(rx + 5)} ${f(ry + 8)}`, h.shade(EARTHSTONE, 0.05), 3.2);
    }
    return { s, hand: [rx, ry] };
  }
  const POSE_ANG = { idle: 30, aim: 58, fire: -8 };

  /* ---------- 단계별 ---------- */
  /* Lv1: 나무 비탈대 위 바위 + 받침 쐐기 */
  function lv1(c, pose) {
    const h = c.h;
    let o = legendPlat(c, 1);
    o += footShade(c, 50, 103, 18, 5);
    o += c.ol('M36 104L36 80M64 104L64 66', M.woodD, 3);
    o += c.p('M30 84L70 64L72 70L32 90Z', c.vg(M.plank, 0.2, -0.3), 2.4);
    o += c.ln('M40 79L42 84M50 74L52 79M60 69L62 74', h.shade(M.plank, -0.35), 1.2, 0.8);
    o += c.p('M38 82L42 76L44 80Z', c.vg(M.woodD, 0.1, -0.2), 1.6); // 쐐기
    if (pose !== 'fire') o += rock(c, pose === 'aim' ? 60 : 54, pose === 'aim' ? 60 : 64, 9, ROCK, 0.4);
    else o += motion(c, 'M24 92H36M22 97H32', '#ffffff', 1.8, 0.8) + smoke(c, 30, 92, 4, '#d8d0c0', 0.8);
    return o;
  }

  /* Lv2·3: 돌 비탈 성채. Lv3는 탑 위 돌 거인 팔이 바위를 듦 */
  function lv23(c, pose, L3) {
    const h = c.h;
    let o = legendPlat(c, L3 ? 3 : 2, { stone: '#c0b89c', trim: GOLD });
    o += footShade(c, 50, 103, 20, 6);
    const top = L3 ? 66 : 74;
    o += masonry(c, 50, top, 104, L3 ? 12 : 12.5, 15.5, 0.3, EARTHSTONE, { ch: 7, bw: 9, seed: L3 ? 131 : 129 });
    o += litWindow(c, 50, L3 ? 92 : 95, 4.4, 6, '#ffc65a', { frame: '#7a7258' });
    o += c.p('M46 104V98Q50 94 54 98V104Z', c.vg('#3a3426', 0.1, -0.2), 2.2);
    if (L3) o += metalBand(c, 50, 78, 80.6, 13, 3.9, GOLD);
    o += cyl(c, 50, top - 3, top, L3 ? 13.5 : 14, 4, c.cg('#b0a888'), c.vg('#c8c0a4', 0.1, -0.1), 2.4);
    if (!L3) {
      // 쌓인 바위 + 앞으로 기운 돌 비탈
      o += rock(c, 42, top - 8, 6, ROCK, 1.1) + rock(c, 57, top - 9, 7, h.shade(ROCK, -0.08), 2.2);
      o += c.p(`M58 ${top - 2}L78 ${top + 14}L76 ${top + 18}L56 ${top + 3}Z`, c.vg('#b0a888', 0.2, -0.3), 2.2);
      if (pose !== 'fire') o += rock(c, pose === 'aim' ? 50 : 51, top - (pose === 'aim' ? 21 : 17), 8, ROCK, 0.5);
      else o += motion(c, `M66 ${top + 10}L78 ${top + 18}M62 ${top + 14}L72 ${top + 21}`, '#ffffff', 1.8, 0.8) + smoke(c, 76, top + 18, 4.5, '#d8d0c0', 0.85);
      return o;
    }
    o += rock(c, 40, top - 7, 5.5, ROCK, 1.7);
    const held = pose === 'fire' ? null : (x, y) => rock(c, x, y, 10, ROCK, 0.3);
    const a = arm(c, 54, top - 6, POSE_ANG[pose], 26, held);
    o += a.s;
    if (pose === 'fire') o += motion(c, `M${f(a.hand[0] + 6)} ${f(a.hand[1] + 10)}l10 8M${f(a.hand[0] + 2)} ${f(a.hand[1] + 14)}l8 7`, '#ffffff', 1.8, 0.8) + smoke(c, a.hand[0] + 14, a.hand[1] + 18, 4.5, '#d8d0c0', 0.85);
    o += gem(c, 54, top - 2, 2.4, 3, '#b8d86a', true);
    return o;
  }

  /* 4A 산사태: 절벽 성채 + 위에 쌓인 바위 무더기, 팔이 그 위에 */
  function landslide(c, pose) {
    const h = c.h;
    let o = legendPlat(c, 'A', { stone: '#c8c0a4', trim: GOLD, glow: '#b8d86a' });
    o += footShade(c, 50, 99, 26, 7);
    o += c.p('M26 99L30 70L42 62L60 60L72 68L76 99Z', c.vg(EARTHSTONE, 0.2, -0.3), 2.6);
    o += c.ln('M32 80L40 74L46 82M58 72L66 78L70 90M40 90L48 86', h.shade(EARTHSTONE, -0.4), 1.4, 0.8);
    o += metalBand(c, 51, 84, 86.6, 24, 4, GOLD);
    o += c.p('M45 99V91Q50 86 55 91V99Z', c.vg('#3a3426', 0.1, -0.2), 2.2);
    o += rock(c, 34, 62, 7, ROCK, 0.9) + rock(c, 46, 58, 8, h.shade(ROCK, -0.06), 2.1) + rock(c, 60, 58, 7.5, ROCK, 3.3) + rock(c, 40, 50, 6.5, h.shade(ROCK, 0.06), 1.5) + rock(c, 54, 48, 7, ROCK, 2.7);
    const held = pose === 'fire' ? null : (x, y) => rock(c, x, y, 11, ROCK, 0.3);
    const a = arm(c, 62, 58, POSE_ANG[pose] + 6, 28, held);
    o += a.s;
    if (pose === 'fire') o += motion(c, `M${f(a.hand[0] + 6)} ${f(a.hand[1] + 10)}l10 8M${f(a.hand[0] + 2)} ${f(a.hand[1] + 14)}l8 7`, '#ffffff', 1.8, 0.8) + smoke(c, a.hand[0] + 14, a.hand[1] + 18, 5, '#d8d0c0', 0.85);
    o += gem(c, 51, 70, 2.8, 3.4, '#b8d86a', true);
    return o;
  }

  /* 4B 거인의 철구: 돌 교수대 팔 끝에 쇠사슬로 매단 가시 철구 */
  function ironBall(c, pose) {
    const h = c.h;
    let o = legendPlat(c, 'B', { stone: '#c8c0a4', trim: GOLD, glow: '#b8d86a' });
    o += footShade(c, 50, 99, 22, 7);
    o += masonry(c, 44, 60, 99, 10, 13, 0.3, EARTHSTONE, { ch: 7, bw: 9, seed: 141 });
    o += metalBand(c, 44, 72, 74.6, 10.6, 3.2, M.iron) + metalBand(c, 44, 86, 88.6, 12, 3.6, GOLD);
    o += c.p('M40 99V92Q44 88 48 92V99Z', c.vg('#3a3426', 0.1, -0.2), 2.2);
    // 들보 (탑 → 오른쪽)
    o += c.p('M40 58L80 50L82 56L42 64Z', c.vg('#7a7058', 0.2, -0.3), 2.4);
    o += c.ln('M50 58L52 62M62 56L64 60M72 54L74 58', '#4a4232', 1.2, 0.8);
    // 쇠사슬 + 철구 (aim: 뒤로 흔듦, fire: 철구가 떨어져 없음)
    const sw = pose === 'aim' ? -10 : 0;
    const bx = 76 + sw * 0.6;
    const by = 82;
    if (pose !== 'fire') {
      let ch = '';
      for (let i = 0; i < 6; i++) { const t = i / 6; const x = 78 + (bx - 78) * t; const y = 54 + (by - 14 - 54) * t; ch += `M${f(x - 1.6)} ${f(y)}a1.6 2.4 0 1 0 3.2 0a1.6 2.4 0 1 0 -3.2 0`; }
      o += c.ln(ch, '#1c1426', 2.6) + c.ln(ch, M.ironL, 1.3);
      let spikes = '';
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; spikes += `M${f(bx + Math.cos(a) * 9 - Math.sin(a) * 2)} ${f(by + Math.sin(a) * 9 + Math.cos(a) * 2)}L${f(bx + Math.cos(a) * 14)} ${f(by + Math.sin(a) * 14)}L${f(bx + Math.cos(a) * 9 + Math.sin(a) * 2)} ${f(by + Math.sin(a) * 9 - Math.cos(a) * 2)}Z`; }
      o += c.p(spikes, c.vg(M.ironL, 0.3, -0.2), 1.6);
      o += c.ci(bx, by, 10.5, c.sg('#5c6370'), 2.6);
      o += c.p(`M${f(bx - 10)} ${f(by)}Q${f(bx)} ${f(by + 4)} ${f(bx + 10)} ${f(by)}`, 'none', 0, ` stroke="#3a4048" stroke-width="${c.sw(2)}"`);
      o += c.e(bx - 3.5, by - 4, 3, 2, '#ffffff', 0, ' opacity="0.35"');
    } else {
      o += c.ln('M78 54L79 66', '#1c1426', 2.6) + c.ln('M78 54L79 66', M.ironL, 1.3);
      o += motion(c, 'M70 88L84 96M66 92L78 99', '#ffffff', 1.8, 0.8) + smoke(c, 80, 94, 5, '#d8d0c0', 0.85);
    }
    o += gem(c, 44, 64, 2.6, 3.2, '#b8d86a', true);
    return o;
  }

  T.titan_boulder = {
    /* 바위를 쥔 손(던지는 곳) */
    muzzle: [[54, 64], [51, 57], [66, 44], [70, 40], [76, 82]],
    draw(c, v, pose = 'idle') {
      c = fine(c);
      if (v === 1) return lv1(c, pose);
      if (v === 2) return lv23(c, pose, false);
      if (v === 3) return lv23(c, pose, true);
      if (v === 'A') return landslide(c, pose);
      return ironBall(c, pose);
    },
  };
})();
