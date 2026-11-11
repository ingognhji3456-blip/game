'use strict';

/* =========================================================
 * 탑 그림 — 🌑 영혼 수확자 `soul_reaper` (전설, 2026-11-11). 설계: docs/design/towers.md D5
 *  검보라 돌 묘탑과 거대한 낫, 영혼 등불. Lv3부터 두건 쓴 석상(얼굴 없이 어둠과 눈빛 — 사람 아님)이 낫을 듦.
 *  idle: 등불·눈빛이 은은함 · aim: 낫날·등불이 밝아짐 · fire: 영혼 화살이 번쩍(보랏빛 섬광)
 *  4A 죽음의 낫: 낫 두 자루를 엇갈려 든 석상 · 4B 영혼 군단: 영혼 등불 여럿이 감도는 묘탑
 *  모은 영혼 수는 렌더러가 탑 위에 점으로 그림.
 * ========================================================= */
(() => {
  const { f, M, STONE, fine, poly, cyl, ring, aura, spark, masonry, metalBand, gem } = RG.art._tw;
  const A = RG.art._tw.A;
  const { footShade, litWindow, stoneRect, smoke, OP } = A;
  const { GOLD, legendPlat } = RG.art._tw.L;
  const T = RG.art._tw.T;
  const ROCK = STONE.dark;
  const SOUL = '#b8f0d8';
  const GLOW = '#c890ff';

  /* ---------- 부품 ---------- */
  /** 낫 — 자루 아래 (x,y), 자루 끝 (x2,y2), 날 방향 d(1=오른쪽) */
  function scythe(c, x, y, x2, y2, d, lit, k = 1) {
    const h = c.h;
    let s = c.ol(`M${f(x)} ${f(y)}L${f(x2)} ${f(y2)}`, '#4a3a48', 2.2 * k);
    const P = (u, v) => `${f(x2 + d * u * k)} ${f(y2 + v * k)}`;
    if (lit > 0.7) s += aura(c, x2 + d * 10 * k, y2 + 4 * k, 14 * k, 8 * k, GLOW, 0.5);
    s += c.p(`M${P(-1, -1)}Q${P(14, -6)} ${P(24, 8)}Q${P(14, 2)} ${P(1, 4)}Z`, c.vg('#d8d4e8', 0.4, -0.25), 2);
    s += c.ln(`M${P(2, 0)}Q${P(13, -3)} ${P(21, 6)}`, lit > 0.7 ? '#f0e0ff' : '#ffffff', 1.1, 0.85);
    return s;
  }
  /** 영혼 등불 — 고리 (x,y)에 매달림 */
  function soulLantern(c, x, y, k, lit) {
    let s = aura(c, x, y + 7 * k, 9 * k, 9 * k, SOUL, 0.3 + 0.35 * lit);
    s += c.p(`M${f(x - 3.6 * k)} ${f(y + 2.6 * k)}L${f(x + 3.6 * k)} ${f(y + 2.6 * k)}L${f(x + 2.8 * k)} ${f(y + 11 * k)}L${f(x - 2.8 * k)} ${f(y + 11 * k)}Z`, c.vg('#d8fff0', 0.35, -0.1), 1.8);
    s += c.e(x, y + 7 * k, 1.4 * k, 2.4 * k, '#7affc8', 0, ` opacity="${0.6 + 0.4 * lit}"`);
    s += c.p(`M${f(x - 4.6 * k)} ${f(y + 3 * k)}L${f(x)} ${f(y - 0.6 * k)}L${f(x + 4.6 * k)} ${f(y + 3 * k)}Z`, c.vg('#4a3a58', 0.3, -0.2), 1.6);
    s += c.r(x - 3.2 * k, y + 10.6 * k, 6.4 * k, 1.8 * k, '#4a3a58', 0.5, 1.2);
    return s;
  }
  /** 두건 석상: 어깨 가운데 x, 발 y, 높이 ht — 얼굴 자리는 어둠 + 눈빛 */
  function hooded(c, x, y, ht, lit) {
    const h = c.h;
    const w = ht * 0.42;
    let s = c.p(`M${f(x - w)} ${f(y)}Q${f(x - w * 0.9)} ${f(y - ht * 0.55)} ${f(x - w * 0.5)} ${f(y - ht * 0.78)}Q${f(x - w * 0.45)} ${f(y - ht * 1.02)} ${f(x)} ${f(y - ht * 1.04)}Q${f(x + w * 0.45)} ${f(y - ht * 1.02)} ${f(x + w * 0.5)} ${f(y - ht * 0.78)}Q${f(x + w * 0.9)} ${f(y - ht * 0.55)} ${f(x + w)} ${f(y)}Z`, c.vg('#5a4a6e', 0.25, -0.3), 2.6);
    s += c.ln(`M${f(x - w * 0.5)} ${f(y - ht * 0.1)}Q${f(x - w * 0.42)} ${f(y - ht * 0.5)} ${f(x - w * 0.3)} ${f(y - ht * 0.72)}M${f(x + w * 0.4)} ${f(y - ht * 0.08)}Q${f(x + w * 0.36)} ${f(y - ht * 0.45)} ${f(x + w * 0.28)} ${f(y - ht * 0.7)}`, '#3a2e48', 1.4, 0.8);
    s += c.e(x, y - ht * 0.8, w * 0.36, ht * 0.14, '#140c1c', 1.6);
    s += c.ci(x - w * 0.14, y - ht * 0.8, Math.max(1, ht * 0.03), GLOW, 0, ` opacity="${0.6 + 0.4 * lit}"`) + c.ci(x + w * 0.14, y - ht * 0.8, Math.max(1, ht * 0.03), GLOW, 0, ` opacity="${0.6 + 0.4 * lit}"`);
    return s;
  }
  /** 떠도는 영혼 하나 */
  const wisp = (c, x, y, k, a = 0.7) => OP(c.p(`M${f(x - 2.4 * k)} ${f(y)}Q${f(x - 3.4 * k)} ${f(y - 4 * k)} ${f(x)} ${f(y - 7 * k)}Q${f(x + 3.4 * k)} ${f(y - 4 * k)} ${f(x + 2.4 * k)} ${f(y)}Q${f(x)} ${f(y + 2 * k)} ${f(x - 2.4 * k)} ${f(y)}Z`, c.vg(SOUL, 0.3, -0.1), 0) + c.ci(x - 0.8 * k, y - 2.6 * k, 0.6 * k, '#1c1426', 0) + c.ci(x + 0.8 * k, y - 2.6 * k, 0.6 * k, '#1c1426', 0), a);
  const flash = (c, x, y, r) => aura(c, x, y, r * 2, r * 2, GLOW, 0.8) + spark(c, x, y, r, '#f0e0ff', 0);

  /* ---------- 단계별 ---------- */
  /* Lv1: 낡은 묘비 + 기댄 낫 + 영혼 한 줄기 */
  function lv1(c, pose) {
    const lit = pose === 'idle' ? 0.5 : 1;
    let o = legendPlat(c, 1, { stone: ROCK });
    o += footShade(c, 50, 103, 16, 5);
    o += c.p('M40 104V78Q40 68 50 68Q60 68 60 78V104Z', c.vg('#7a6a88', 0.25, -0.3), 2.4);
    o += c.ln('M45 80H55M50 75V88', '#3a2e48', 1.6, 0.9);
    o += c.ln('M42 98L46 92L44 86', '#3a2e48', 1.1, 0.7);
    o += scythe(c, 60, 104, 63, 64, 1, lit, 0.9);
    o += wisp(c, 34, 76, 1.2, 0.5 + 0.3 * lit);
    if (pose === 'fire') o += flash(c, 58, 70, 5);
    return o;
  }

  /* Lv2·3: 검보라 묘탑 + 영혼 등불. Lv3는 꼭대기에 낫을 든 두건 석상 */
  function lv23(c, pose, L3) {
    const lit = pose === 'idle' ? 0.5 : 1;
    let o = legendPlat(c, L3 ? 3 : 2, { stone: '#7a6a88', trim: GOLD });
    o += footShade(c, 50, 103, 20, 6);
    const top = L3 ? 70 : 72;
    o += c.p(`M67 ${top}L72 ${top - 3}V101L67 104Z`, c.vg('#3a2e48', 0.1, -0.3), 2.4);
    o += stoneRect(c, 33, top, 34, 104 - top, ROCK, { seed: L3 ? 61 : 57, ch: 7, bw: 10 });
    o += aura(c, 50, 98, 8, 6, GLOW, 0.4 + 0.2 * lit);
    o += c.p('M45 104V96Q50 89.5 55 96V104Z', c.vg('#1e1428', 0.1, -0.1), 2.2);
    o += c.r(30, top - 4, 40, 4.6, c.vg('#6a5a7a', 0.25, -0.3), 0.8, 2.4);
    if (L3) o += c.r(30, top - 1.6, 40, 2, c.vg(GOLD, 0.3, -0.2), 0.4, 1.4);
    // 등불 걸이
    o += c.ol(`M66 ${top - 4}L66 ${top - 16}L74 ${top - 16}`, '#4a3a48', 1.8);
    o += soulLantern(c, 74, top - 16, 1, lit);
    if (L3) {
      o += hooded(c, 48, top - 4, 30, lit);
      o += scythe(c, 38, top - 2, 34, top - 40, 1, lit, 1.15);
      o += wisp(c, 26, top - 20, 1.2, 0.5 + 0.3 * lit) + wisp(c, 72, top - 34, 1, 0.45 + 0.3 * lit);
      if (pose === 'fire') o += flash(c, 52, top - 36, 7);
    } else {
      o += c.p(`M38 ${top - 4}L50 ${top - 18}L62 ${top - 4}Z`, c.vg('#3c3050', 0.2, -0.3), 2.4);
      o += scythe(c, 44, top - 4, 40, top - 34, 1, lit, 1);
      o += wisp(c, 28, top - 18, 1.1, 0.5 + 0.3 * lit);
      if (pose === 'fire') o += flash(c, 48, top - 30, 6);
    }
    return o;
  }

  /* 4A 죽음의 낫: 큰 석상이 낫 두 자루를 엇갈려 듦 */
  function deathScythe(c, pose) {
    const lit = pose === 'idle' ? 0.5 : 1;
    let o = legendPlat(c, 'A', { stone: '#7a6a88', trim: GOLD, glow: GLOW });
    o += footShade(c, 50, 99, 24, 7);
    o += stoneRect(c, 32, 70, 36, 29, ROCK, { seed: 71, ch: 7, bw: 10 });
    o += c.p('M45 99V92Q50 86 55 92V99Z', c.vg('#1e1428', 0.1, -0.1), 2.2);
    o += c.r(29, 66, 42, 5, c.vg('#6a5a7a', 0.25, -0.3), 0.8, 2.4) + c.r(29, 69, 42, 2, c.vg(GOLD, 0.3, -0.2), 0.4, 1.4);
    o += aura(c, 50, 40, 26, 26, GLOW, 0.2 + 0.25 * lit);
    o += scythe(c, 30, 70, 38, 14, -1, lit, 1.2);
    o += scythe(c, 70, 70, 62, 14, 1, lit, 1.2);
    o += hooded(c, 50, 66, 40, lit);
    o += wisp(c, 18, 56, 1.4, 0.5 + 0.3 * lit) + wisp(c, 82, 50, 1.3, 0.5 + 0.3 * lit);
    if (pose === 'fire') o += flash(c, 50, 30, 9);
    return o;
  }

  /* 4B 영혼 군단: 높은 묘탑 + 둘레를 도는 영혼 등불 넷 + 영혼들 */
  function legion(c, pose) {
    const lit = pose === 'idle' ? 0.5 : 1;
    let o = legendPlat(c, 'B', { stone: '#7a6a88', trim: GOLD, glow: SOUL });
    o += footShade(c, 50, 99, 22, 7);
    o += masonry(c, 50, 52, 99, 10, 14, 0.3, ROCK, { ch: 7, bw: 9, seed: 81 });
    o += metalBand(c, 50, 66, 68.6, 10.8, 3.2, GOLD) + metalBand(c, 50, 84, 86.6, 12.8, 3.8, GOLD);
    o += litWindow(c, 50, 80, 4.4, 6, SOUL, { frame: '#5a4a6e' });
    o += c.p('M46 99V92Q50 88 54 92V99Z', c.vg('#1e1428', 0.1, -0.1), 2.2);
    o += c.p('M38 52L50 30L62 52Q50 55 38 52Z', c.cg('#3c3050'), 2.6);
    o += c.ci(50, 28, 3, c.sg(GLOW), 1.6);
    const ph = pose === 'aim' ? 0.5 : pose === 'fire' ? 1 : 0;
    for (let i = 0; i < 4; i++) {
      const a = ph + i * 1.5708;
      const x = 50 + Math.cos(a) * 26;
      const y = 58 + Math.sin(a) * 8;
      o += soulLantern(c, x, y - 8, 0.95, lit);
    }
    o += wisp(c, 22, 40, 1.2, 0.5 + 0.3 * lit) + wisp(c, 78, 36, 1.2, 0.5 + 0.3 * lit) + wisp(c, 66, 22, 1, 0.45 + 0.3 * lit);
    if (pose === 'fire') o += flash(c, 50, 28, 8);
    return o;
  }

  T.soul_reaper = {
    /* 낫날·석상 앞 (영혼 화살이 나가는 곳) */
    muzzle: [[58, 70], [48, 42], [52, 34], [50, 30], [50, 28]],
    draw(c, v, pose = 'idle') {
      c = fine(c);
      if (v === 1) return lv1(c, pose);
      if (v === 2) return lv23(c, pose, false);
      if (v === 3) return lv23(c, pose, true);
      if (v === 'A') return deathScythe(c, pose);
      return legion(c, pose);
    },
  };
})();
