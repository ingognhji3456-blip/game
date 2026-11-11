'use strict';

/* =========================================================
 * 탑 그림 — ✨ 빛의 등대 `lighthouse` (2차 탑, 2026-11-11). 설계: docs/design/towers.md L4
 *  폭풍 해안의 흰 등대: 흰 돌·붉은 띠 원통 탑, 꼭대기에 유리 등실과 회전 렌즈. 빛줄기는 렌더러가 그림.
 *  idle: 등실이 따뜻하게 빛남 · aim: 등실 빛이 밝아지며 빛이 모임 · fire: 렌즈가 번쩍(빛 고리·짧은 빛살)
 *  4A 프리즘 등대: 꼭대기 큰 삼각 프리즘 수정 · 4B 수색 등대: 거대한 놋쇠 탐조등을 단 굵은 탑
 * ========================================================= */
(() => {
  const { f, M, STONE, fine, poly, cyl, frus, ring, band, aura, spark, plat, masonry, masonryCyl, metalBand, gem, orb } = RG.art._tw;
  const A = RG.art._tw.A;
  const { footShade, motion, beam, planks, tileCone, litWindow, bandI, OP, rnd } = A;
  const T = RG.art._tw.T;
  const WHITE = '#efe9dc';
  const RED = '#c8402e';
  const BRASS = '#d9a441';
  const LAMP = '#ffe48a';

  /* ---------- 부품 ---------- */
  /** 등실: 유리 원통 + 창살 + 안의 등불·렌즈 — 가운데 x, 아래 yb, 높이 ht, 반지름 r */
  function lampRoom(c, x, yb, ht, r, pose, o = {}) {
    const h = c.h;
    const lit = pose === 'idle' ? 0.6 : 1;
    let s = aura(c, x, yb - ht / 2, r * (pose === 'fire' ? 4 : pose === 'aim' ? 3.2 : 2.4), ht * (pose === 'fire' ? 2.4 : 1.8), LAMP, 0.35 + lit * 0.45);
    /* 유리 */
    s += cyl(c, x, yb - ht, yb, r, r * 0.3, c.vg(h.mix('#fff6c8', LAMP, 0.4), 0.3, -0.15), null, 2.4);
    /* 렌즈(가운데 동심원) + 불꽃 */
    s += c.e(x, yb - ht * 0.5, r * 0.62, ht * 0.4, pose === 'idle' ? c.sg(LAMP) : pose === 'aim' ? c.vg('#fff2b0', 0.4, 0.1) : '#fffdf0', 1.4, c.ink(BRASS));
    s += c.e(x, yb - ht * 0.5, r * 0.36, ht * 0.24, 'none', 0, ` stroke="${h.shade(BRASS, -0.2)}" stroke-width="${c.sw(1)}" opacity="0.7"`);
    s += c.ci(x, yb - ht * 0.5, r * 0.18, '#ffffff', 0);
    /* 창살 */
    s += c.ln(`M${f(x - r * 0.5)} ${f(yb - ht + 0.6)}V${f(yb - 0.6)}M${f(x + r * 0.5)} ${f(yb - ht + 0.6)}V${f(yb - 0.6)}M${f(x)} ${f(yb - ht + 0.8)}V${f(yb - ht * 0.75)}M${f(x)} ${f(yb - ht * 0.25)}V${f(yb - 0.4)}`, o.bar || '#3a3040', 1.4, 0.9);
    s += c.ln(`M${f(x - r * 0.8)} ${f(yb - ht + 2)}V${f(yb - 2)}`, '#ffffff', 1.4, 0.6);
    if (pose === 'aim') s += [0, 60, 120, 180, 240, 300].map((d) => { const a = d * Math.PI / 180; return c.ln(`M${f(x + Math.cos(a) * r * 2.4)} ${f(yb - ht / 2 + Math.sin(a) * ht * 1.1)}L${f(x + Math.cos(a) * r * 1.4)} ${f(yb - ht / 2 + Math.sin(a) * ht * 0.7)}`, '#fff6d0', 1.6, 0.8); }).join('');
    if (pose === 'fire') {
      s += c.e(x, yb - ht / 2, r * 2.6, ht * 1.2, 'none', 0, ` stroke="#fffbe6" stroke-width="${c.sw(2.2)}" opacity="0.85"`);
      s += c.p(`M${f(x + r)} ${f(yb - ht * 0.7)}L${f(x + r + 16)} ${f(yb - ht * 0.95)}L${f(x + r + 16)} ${f(yb - ht * 0.05)}L${f(x + r)} ${f(yb - ht * 0.3)}Z`, c.ag('#fff6d0', 0.8), 0);
      s += c.p(`M${f(x - r)} ${f(yb - ht * 0.7)}L${f(x - r - 12)} ${f(yb - ht * 0.9)}L${f(x - r - 12)} ${f(yb - ht * 0.1)}L${f(x - r)} ${f(yb - ht * 0.3)}Z`, c.ag('#fff6d0', 0.6), 0);
      s += c.e(x, yb - ht / 2, r * 1.6, ht * 0.9, c.ag('#ffffff', 0.9), 0) + spark(c, x, yb - ht / 2, r * 1.5, '#ffffff', 0);
    }
    return s;
  }
  /** 난간 두른 발코니 — 가운데 x, 높이 y, 반지름 r */
  function gallery(c, x, y, r, col, rail) {
    const h = c.h;
    let s = cyl(c, x, y - 2.4, y, r, r * 0.3, c.cg(col), c.vg(h.shade(col, 0.25), 0.2, -0.05), 2.4);
    /* 난간: 앞 기둥 + 위 띠 */
    let d = '';
    for (let k = -3; k <= 3; k++) { const a = k * 0.42; d += `M${f(x + Math.sin(a) * r * 0.96)} ${f(y - 2.4 + Math.cos(a) * r * 0.29)}V${f(y - 7.4 + Math.cos(a) * r * 0.29)}`; }
    s += c.ln(d, rail, 1.4);
    s += c.ln(ring(x, y - 7.4, r * 0.97, r * 0.29), '#1c1426', 3.4) + c.ln(ring(x, y - 7.4, r * 0.97, r * 0.29), rail, 1.6);
    return s;
  }
  /** 흰 몸통에 붉은 띠 — 원뿔대 옆면 (masonry) */
  function stripedTower(c, x, yt, yb, rt, rb, bands, seed) {
    const h = c.h;
    let s = masonry(c, x, yt, yb, rt, rb, 0.3, WHITE, { ch: 7, bw: 9, seed });
    const rAt = (y) => rt + (rb - rt) * ((y - yt) / (yb - yt));
    for (const [y1, y2] of bands) {
      const r1 = rAt(y1);
      const r2 = rAt(y2);
      s += c.p(`M${f(x - r1)} ${f(y1)}A${f(r1)} ${f(r1 * 0.3)} 0 0 0 ${f(x + r1)} ${f(y1)}L${f(x + r2)} ${f(y2)}A${f(r2)} ${f(r2 * 0.3)} 0 0 1 ${f(x - r2)} ${f(y2)}Z`, c.cg(RED), 2);
    }
    return s;
  }

  /* ---------- 단계별 ---------- */
  function lv1(c, pose) {
    const h = c.h;
    let o = plat(c, 1);
    o += footShade(c, 50, 103, 18, 5);
    /* 흰 칠 나무 등대(널 원뿔대) */
    o += frus(c, 50, 58, 104, 9.5, 15, c.cg(WHITE), null, 2.8, 0.3);
    o += c.ln('M44 60L39 102M50 59V104M56 60L61 102', h.shade(WHITE, -0.3), 1.2, 0.8);
    o += c.p('M39.6 78Q50 81.4 60.4 78L61.4 85Q50 88.6 38.6 85Z', c.cg(RED), 2);
    o += c.p('M46 104V95Q50 90.5 54 95V104Z', c.vg('#6a4a30', 0.2, -0.3), 2);
    o += gallery(c, 50, 58, 13, M.wood, M.woodD);
    o += lampRoom(c, 50, 51, 12, 7.4, pose);
    o += tileCone(c, 50, 39, 20, 12, RED, { rows: 2, scallops: 7 });
    o += c.ol('M50 27V23', M.iron, 1.4) + c.ci(50, 22, 1.8, c.sg(M.gold), 1.2);
    return o;
  }

  function lv23(c, pose, L3) {
    const h = c.h;
    let o = plat(c, L3 ? 3 : 2, { stone: STONE.light, trim: BRASS });
    o += footShade(c, 50, 103, 20, 6);
    const top = L3 ? 50 : 56;
    o += stripedTower(c, 50, top, 104, L3 ? 9 : 9.5, 15, L3 ? [[66, 72], [86, 92]] : [[72, 79]], L3 ? 511 : 509);
    o += c.p('M46 104V95Q50 90 54 95V104Z', c.vg('#5a4a40', 0.2, -0.3), 2.2);
    o += litWindow(c, 50, L3 ? 80 : 86, 4.6, 6.4, LAMP, { frame: '#9a8a7a' });
    if (L3) o += litWindow(c, 50, 62, 4, 5.6, LAMP, { frame: '#9a8a7a' });
    o += gallery(c, 50, top, L3 ? 13 : 12, h.shade(STONE.light, -0.1), L3 ? BRASS : M.iron);
    const lh = L3 ? 12 : 11;
    o += lampRoom(c, 50, top - 7, lh, L3 ? 7.4 : 7, pose, { bar: L3 ? h.shade(BRASS, -0.35) : '#3a3040' });
    /* 둥근 지붕 */
    const ry = top - 7 - lh;
    o += c.p(`M${50 - (L3 ? 9 : 8.5)} ${ry}Q${50 - (L3 ? 8 : 7.5)} ${ry - (L3 ? 10 : 9)} 50 ${ry - (L3 ? 11 : 10)}Q${50 + (L3 ? 8 : 7.5)} ${ry - (L3 ? 10 : 9)} ${50 + (L3 ? 9 : 8.5)} ${ry}Q50 ${ry + 3} ${50 - (L3 ? 9 : 8.5)} ${ry}Z`, c.cg(RED), 2.6);
    o += c.ln(`M${50 - 4} ${ry - 7}Q50 ${ry - 9} ${50 + 3} ${ry - 8}`, h.shade(RED, 0.45), 1.2, 0.8);
    o += c.ol(`M50 ${ry - 11}V${ry - 15}`, L3 ? M.gold : M.iron, 1.4) + c.ci(50, ry - 16, L3 ? 2.2 : 1.6, c.sg(L3 ? M.gold : M.ironL), 1.2);
    if (L3) o += c.p(`M50 ${ry - 18}L53 ${ry - 21}L50 ${ry - 24}L47 ${ry - 21}Z`, c.vg(M.gold, 0.4, -0.2), 1.4);
    return o;
  }

  /* 4A 프리즘 등대: 발코니 위 큰 삼각 프리즘 수정 — 빛이 셋으로 갈라짐 */
  function prism(c, pose) {
    const h = c.h;
    let o = plat(c, 4, { stone: '#d8d0bc', trim: LAMP });
    o += footShade(c, 50, 99, 22, 6);
    o += stripedTower(c, 50, 54, 99, 10, 16, [[64, 70], [82, 88]], 521);
    o += c.p('M46 99V90Q50 85 54 90V99Z', c.vg('#5a4a40', 0.2, -0.3), 2.2);
    o += gallery(c, 50, 54, 14, h.shade(STONE.light, -0.1), BRASS);
    /* 프리즘 (앞면 두 면 + 윗면) */
    const lit = pose === 'idle' ? 0.55 : 1;
    o += aura(c, 50, 32, 26 * (pose === 'fire' ? 1.3 : 1), 22, LAMP, 0.35 + lit * 0.4);
    const pk = [50, 10];
    const l = [36, 48];
    const r = [64, 48];
    const f0 = [50, 52];
    o += c.p(poly([pk, l, f0]), c.vg('#e8f6ff', 0.4, -0.1), 2.6) + c.p(poly([pk, f0, r]), c.vg('#c8d8f0', 0.2, -0.2), 2.6);
    /* 무지갯빛 모서리 */
    o += c.ln('M38 46L49 14', '#ff9a8a', 1.4, 0.8) + c.ln('M40 47L50 16', '#ffe48a', 1.2, 0.8) + c.ln('M62 46L51 14', '#8ad8ff', 1.4, 0.8) + c.ln('M60 47L50 16', '#b48aff', 1.2, 0.8);
    o += c.ci(50, 34, pose === 'idle' ? 3 : 4.4, '#ffffff', 0, ' opacity="0.9"');
    o += c.ln('M44 40L48 22', '#ffffff', 1.6, 0.85);
    if (pose === 'aim') o += [[24, 24], [76, 22], [50, 2], [22, 44], [78, 44]].map(([x, y]) => spark(c, x, y, 2.4, '#fff6d0', 0)).join('');
    if (pose === 'fire') {
      const ray = (ang, col) => { const a = ang * Math.PI / 180; return c.p(`M50 34L${f(50 + Math.cos(a - 0.12) * 40)} ${f(34 + Math.sin(a - 0.12) * 30)}L${f(50 + Math.cos(a + 0.12) * 40)} ${f(34 + Math.sin(a + 0.12) * 30)}Z`, c.ag(col, 0.75), 0); };
      o += ray(-20, '#ffd8a8') + ray(200, '#b8e4ff') + ray(90, '#f0d8ff');
      o += c.ci(50, 34, 12, c.ag('#ffffff', 0.9), 0) + spark(c, 50, 34, 10, '#ffffff', 0);
    }
    return o;
  }

  /* 4B 수색 등대: 굵은 흰 탑 + 멍에에 단 거대한 놋쇠 탐조등(원판 렌즈가 앞오른쪽을 봄) */
  function searchlight(c, pose) {
    const h = c.h;
    let o = plat(c, 4, { stone: '#d8d0bc', trim: LAMP });
    o += footShade(c, 50, 99, 26, 7);
    o += stripedTower(c, 50, 58, 99, 15, 18, [[64, 70]], 531);
    o += c.p('M45.5 99V92Q50 87 54.5 92V99Z', c.vg('#5a4a40', 0.2, -0.3), 2.2);
    o += litWindow(c, 50, 82, 4.8, 6.4, LAMP, { frame: '#9a8a7a' });
    o += gallery(c, 50, 58, 18, h.shade(STONE.light, -0.1), BRASS);
    /* 멍에 + 탐조등 통 */
    const tilt = pose === 'aim' ? -6 : pose === 'fire' ? 4 : 0;
    o += c.ol('M38 52L40 36M62 52L60 36', h.shade(BRASS, -0.15), 3);
    let lamp = '';
    lamp += cyl(c, 50, 22, 44, 12, 3.6, c.cg(BRASS), null, 2.6); // 통 (세운 원통처럼 보이게 앞면 렌즈)
    lamp += bandI(c, 50, 26, 28.5, 12, 3.6, h.shade(BRASS, -0.2)) + bandI(c, 50, 38, 40.5, 12, 3.6, h.shade(BRASS, -0.2));
    /* 앞 렌즈 원판 */
    const lit = pose === 'idle' ? 0.6 : 1;
    lamp += aura(c, 60, 33, 16, 16, LAMP, 0.3 + lit * 0.5);
    lamp += c.e(58, 33, 7, 10.5, c.vg('#7a5a2a', 0.2, -0.3), 2.6) + c.e(59, 33, 5.6, 9, c.sg(pose === 'idle' ? LAMP : '#fffbe6'), 1.6, c.ink(BRASS));
    lamp += c.e(59, 33, 3.4, 5.6, 'none', 0, ` stroke="${h.shade(BRASS, -0.15)}" stroke-width="${c.sw(1)}" opacity="0.7"`) + c.ci(59, 33, 1.6, '#ffffff', 0);
    lamp += c.ci(40, 30, 2, c.sg(M.ironL), 1.4) + c.ci(60, 30, 0.1, 'none', 0);
    o += `<g transform="rotate(${tilt} 50 33)">${lamp}</g>`;
    o += c.ci(39.5, 36, 2.2, c.sg(M.ironL), 1.4) + c.ci(60.5, 36, 2.2, c.sg(M.ironL), 1.4);
    if (pose === 'aim') o += c.ln('M70 24L76 20M72 33H80M70 42L76 46', '#fff6d0', 1.8, 0.8);
    if (pose === 'fire') o += c.p('M64 27L94 18L94 48L64 39Z', c.ag('#fff6d0', 0.75), 0) + c.ci(60, 33, 10, c.ag('#ffffff', 0.9), 0) + spark(c, 60, 33, 8, '#ffffff', 0);
    return o;
  }

  T.lighthouse = {
    /* 등실(렌즈) 가운데 — 빛줄기가 여기서 나감 */
    muzzle: [[50, 45], [50, 43], [50, 37], [50, 34], [59, 33]],
    draw(c, v, pose = 'idle') {
      c = fine(c);
      if (v === 1) return lv1(c, pose);
      if (v === 2) return lv23(c, pose, false);
      if (v === 3) return lv23(c, pose, true);
      if (v === 'A') return prism(c, pose);
      return searchlight(c, pose);
    },
  };
})();
