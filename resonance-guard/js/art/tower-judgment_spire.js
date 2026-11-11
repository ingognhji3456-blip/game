'use strict';

/* =========================================================
 * 탑 그림 — ✨ 심판의 첨탑 `judgment_spire` (전설, 2026-11-11). 설계: docs/design/towers.md L5
 *  하얀 대리석 첨탑과 금빛 저울·날개·후광. 빛기둥은 효과가 그림(하늘에서 적에게).
 *  idle: 후광이 은은함 · aim: 저울·후광이 밝아짐 · fire: 꼭대기에서 하늘로 빛이 솟음
 *  4A 신의 심판: 거대한 빛의 검을 든 날개 첨탑 · 4B 빛의 비: 세 갈래 빛 첨탑
 * ========================================================= */
(() => {
  const { f, M, fine, poly, cyl, ring, aura, spark, masonry, metalBand, gem, orb } = RG.art._tw;
  const A = RG.art._tw.A;
  const { footShade, litWindow, burstRing } = A;
  const { GOLD, legendPlat } = RG.art._tw.L;
  const T = RG.art._tw.T;
  const MARBLE = '#ece6da';
  const LIGHT = '#fff1a8';

  /* ---------- 부품 ---------- */
  /** 후광 고리 — 가운데 (x,y), 반지름 r */
  function halo(c, x, y, r, pose) {
    const lit = pose === 'idle' ? 0.55 : 1;
    let s = aura(c, x, y, r * 1.8, r * 1.2, LIGHT, 0.3 + 0.35 * lit);
    s += c.e(x, y, r, r * 0.34, 'none', 0, ` stroke="#1c1426" stroke-width="${c.sw(4.6)}"`);
    s += c.e(x, y, r, r * 0.34, 'none', 0, ` stroke="${GOLD}" stroke-width="${c.sw(2.6)}"`);
    s += c.e(x, y, r, r * 0.34, 'none', 0, ` stroke="#fff6c8" stroke-width="${c.sw(1)}" opacity="0.9"`);
    return s;
  }
  /** 금빛 저울 — 기둥 위 (x,y), 크기 k, 기울기 tilt */
  function scales(c, x, y, k, tilt = 0) {
    const t = tilt * k;
    let s = c.ol(`M${f(x)} ${f(y)}V${f(y - 10 * k)}`, GOLD, 1.8);
    s += c.ol(`M${f(x - 10 * k)} ${f(y - 9 * k + t)}L${f(x + 10 * k)} ${f(y - 9 * k - t)}`, GOLD, 1.6);
    for (const [px, py] of [[x - 10 * k, y - 9 * k + t], [x + 10 * k, y - 9 * k - t]]) {
      s += c.ln(`M${f(px)} ${f(py)}L${f(px - 3 * k)} ${f(py + 6 * k)}M${f(px)} ${f(py)}L${f(px + 3 * k)} ${f(py + 6 * k)}`, '#8a6a20', 0.9, 0.9);
      s += c.p(`M${f(px - 4 * k)} ${f(py + 6 * k)}Q${f(px)} ${f(py + 9.5 * k)} ${f(px + 4 * k)} ${f(py + 6 * k)}Z`, c.vg(GOLD, 0.35, -0.2), 1.6);
    }
    s += c.ci(x, y - 10.5 * k, 1.8 * k, c.sg(GOLD), 1.4);
    return s;
  }
  /** 돌 날개 한 쌍 — 몸 가운데 x, 뿌리 높이 y, 크기 k */
  function wings(c, x, y, k, col = MARBLE) {
    const h = c.h;
    let s = '';
    for (const d of [-1, 1]) {
      const P = (u, v) => `${f(x + d * u * k)} ${f(y + v * k)}`;
      s += c.p(`M${P(3, 2)}Q${P(14, -12)} ${P(24, -16)}Q${P(22, -8)} ${P(26, -6)}Q${P(20, -1)} ${P(23, 3)}Q${P(15, 3)} ${P(16, 8)}Q${P(9, 6)} ${P(3, 8)}Z`, c.vg(col, 0.25, -0.25), 2.2);
      s += c.ln(`M${P(6, 2)}Q${P(14, -6)} ${P(21, -10)}M${P(6, 5)}Q${P(13, 1)} ${P(19, -1)}`, h.shade(col, -0.3), 1.1, 0.8);
    }
    return s;
  }
  /** 하늘로 솟는 빛 (fire) */
  const skyBeam = (c, x, y, w) => c.p(`M${f(x - w)} ${f(y)}L${f(x - w * 0.6)} 0L${f(x + w * 0.6)} 0L${f(x + w)} ${f(y)}Z`, c.ag('#fff6c8', 0.85), 0) + c.r(x - w * 0.25, 0, w * 0.5, y, '#ffffff', 0, 0, ' opacity="0.8"');

  /* ---------- 단계별 ---------- */
  /* Lv1: 흰 돌 제단 + 작은 저울 + 옅은 후광 */
  function lv1(c, pose) {
    let o = legendPlat(c, 1);
    o += footShade(c, 50, 103, 16, 5);
    o += c.p('M38 104L40 96H60L62 104Q50 106 38 104Z', c.vg(MARBLE, 0.25, -0.3), 2.2);
    o += c.p('M42 96L44 76H56L58 96Z', c.vg(MARBLE, 0.3, -0.25), 2.4);
    o += c.r(41, 72, 18, 4.6, c.vg(MARBLE, 0.35, -0.2), 1, 2.2);
    o += c.ln('M46 92V80M54 92V80', '#c8bca8', 1.2, 0.7);
    if (pose === 'fire') o += skyBeam(c, 50, 64, 4);
    o += scales(c, 50, 72, 0.9, pose === 'aim' ? 2 : 0);
    o += halo(c, 50, 56, 9, pose);
    return o;
  }

  /* Lv2·3: 대리석 첨탑 + 돌 날개 + 저울·후광. Lv3는 높고 금띠 */
  function lv23(c, pose, L3) {
    let o = legendPlat(c, L3 ? 3 : 2, { stone: '#e0dac8', trim: GOLD });
    o += footShade(c, 50, 103, 18, 6);
    const top = L3 ? 54 : 62;
    o += masonry(c, 50, top, 104, L3 ? 6.5 : 7, 12, 0.3, MARBLE, { ch: 7, bw: 8, seed: L3 ? 151 : 149 });
    o += c.p('M46.5 104V97Q50 93 53.5 97V104Z', c.vg('#5a4a40', 0.1, -0.2), 2);
    o += litWindow(c, 50, L3 ? 88 : 91, 3.6, 5.4, LIGHT, { frame: '#b8a888' });
    if (L3) o += metalBand(c, 50, 72, 74.4, 8.4, 2.5, GOLD) + metalBand(c, 50, 90, 92.4, 10.4, 3.1, GOLD);
    o += wings(c, 50, top + 12, L3 ? 1.05 : 0.9);
    o += c.p(`M${50 - (L3 ? 7.5 : 8)} ${top}L50 ${top - (L3 ? 12 : 10)}L${50 + (L3 ? 7.5 : 8)} ${top}Z`, c.vg(GOLD, 0.4, -0.2), 2.2);
    if (pose === 'fire') o += skyBeam(c, 50, top - 10, 5);
    o += scales(c, 50, top - 10, L3 ? 1.1 : 1, pose === 'aim' ? 2 : 0);
    o += halo(c, 50, top - (L3 ? 27 : 24), L3 ? 11 : 10, pose);
    if (pose === 'fire') o += burstRing(c, 50, top - (L3 ? 27 : 24), 16, 6, '#fff6c8', 2, 0.8);
    return o;
  }

  /* 4A 신의 심판: 큰 날개 첨탑 위에 아래를 향한 빛의 검 */
  function verdict(c, pose) {
    let o = legendPlat(c, 'A', { stone: '#e8e2d0', trim: GOLD, glow: LIGHT });
    o += footShade(c, 50, 99, 22, 6);
    o += masonry(c, 50, 58, 99, 8, 14, 0.3, MARBLE, { ch: 7, bw: 9, seed: 161 });
    o += metalBand(c, 50, 70, 72.6, 9.4, 2.8, GOLD) + metalBand(c, 50, 86, 88.6, 12, 3.6, GOLD);
    o += c.p('M46 99V92Q50 88 54 92V99Z', c.vg('#5a4a40', 0.1, -0.2), 2.2);
    o += wings(c, 50, 70, 1.35);
    o += c.p('M41 58L50 48L59 58Z', c.vg(GOLD, 0.4, -0.2), 2.2);
    const lit = pose === 'idle' ? 0.6 : 1;
    const sy = pose === 'aim' ? -3 : pose === 'fire' ? 3 : 0;
    // 빛의 검 (칼끝이 아래) — 첨탑 끝 바로 위에 떠 있음
    o += aura(c, 50, 30 + sy, 14, 24, LIGHT, 0.3 + 0.35 * lit);
    o += c.p(`M46 ${18 + sy}H54L53 ${40 + sy}L50 ${46 + sy}L47 ${40 + sy}Z`, c.vg('#fffbe6', 0.3, -0.1), 2.2);
    o += c.ln(`M50 ${20 + sy}V${42 + sy}`, '#ffe9a0', 1.2, 0.9);
    o += c.r(40, 14 + sy, 20, 4, c.vg(GOLD, 0.35, -0.25), 1.2, 2.2);
    o += c.r(48, 7 + sy, 4, 7.5, c.vg('#c8a040', 0.2, -0.2), 1, 1.8);
    o += c.ci(50, 6 + sy, 2.6, c.sg(GOLD), 1.6);
    o += halo(c, 50, 16 + sy, 13, pose);
    if (pose === 'fire') o += burstRing(c, 50, 48, 18, 6, '#fff6c8', 2.4, 0.9) + spark(c, 50, 47, 8, '#ffffff', 0);
    return o;
  }

  /* 4B 빛의 비: 세 갈래 첨탑, 끝마다 빛 구슬 */
  function rain(c, pose) {
    let o = legendPlat(c, 'B', { stone: '#e8e2d0', trim: GOLD, glow: LIGHT });
    o += footShade(c, 50, 99, 22, 6);
    o += masonry(c, 50, 64, 99, 9, 14, 0.3, MARBLE, { ch: 7, bw: 9, seed: 171 });
    o += metalBand(c, 50, 74, 76.6, 10, 3, GOLD);
    o += c.p('M46 99V92Q50 88 54 92V99Z', c.vg('#5a4a40', 0.1, -0.2), 2.2);
    o += wings(c, 50, 78, 1.0);
    const lit = pose === 'idle' ? 0.6 : 1;
    for (const [x, y, k] of [[34, 34, 0.8], [66, 34, 0.8], [50, 22, 1]]) {
      o += c.ol(`M50 64Q${(50 + x) / 2} ${(64 + y) / 2 + 6} ${x} ${y + 8}`, MARBLE, 4);
      o += c.p(`M${x - 4} ${y + 9}L${x} ${y + 2}L${x + 4} ${y + 9}Z`, c.vg(GOLD, 0.4, -0.2), 1.8);
      o += aura(c, x, y - 2, 9 * k, 9 * k, LIGHT, 0.3 + 0.35 * lit);
      o += orb(c, x, y - 2, 4.6 * k, pose === 'idle' ? '#ffe9a0' : '#fff6d0', 2);
      if (pose === 'fire') o += skyBeam(c, x, y - 6, 3.2);
    }
    o += halo(c, 50, 58, 12, pose);
    return o;
  }

  T.judgment_spire = {
    /* 후광 가운데 (빛이 솟는 곳) */
    muzzle: [[50, 56], [50, 38], [50, 27], [50, 16], [50, 20]],
    draw(c, v, pose = 'idle') {
      c = fine(c);
      if (v === 1) return lv1(c, pose);
      if (v === 2) return lv23(c, pose, false);
      if (v === 3) return lv23(c, pose, true);
      if (v === 'A') return verdict(c, pose);
      return rain(c, pose);
    },
  };
})();
