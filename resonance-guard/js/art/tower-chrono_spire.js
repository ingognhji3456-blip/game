'use strict';

/* =========================================================
 * 탑 그림 — ⏳ 시간의 탑 `chrono_spire` (신화, 2026-11-11). 설계: docs/design/towers.md L6
 *  금빛 톱니와 큰 시계판의 탑, 떠 있는 별빛 모래시계. 신화 — 받침에 별빛.
 *  idle: 바늘이 제자리 · aim: 바늘이 돌며 빛남 · fire: 시계 고리가 퍼짐
 *  4A 멈춘 세계: 시계판 고리가 여러 겹 도는 탑 · 4B 가속 시계: 바늘이 빙글빙글 도는 쌍 시계판
 * ========================================================= */
(() => {
  const { f, M, fine, poly, cyl, ring, aura, spark, masonry, metalBand, gem } = RG.art._tw;
  const A = RG.art._tw.A;
  const { footShade, litWindow, burstRing, motion, tileCone } = A;
  const { GOLD, legendPlat } = RG.art._tw.L;
  const T = RG.art._tw.T;
  const IVORY = '#efe6d2';
  const BRASS = '#d9a441';
  const STAR = '#bfe8ff';

  /* ---------- 부품 ---------- */
  /** 톱니바퀴 — 가운데 (x,y), 반지름 r, 이빨 n, 돌림 rot(라디안) */
  function gear(c, x, y, r, n, col, rot = 0) {
    const pts = [];
    for (let i = 0; i < n * 2; i++) {
      const a = rot + (i / (n * 2)) * Math.PI * 2;
      const rr = i % 2 ? r : r * 1.22;
      const a1 = a - Math.PI / (n * 4);
      const a2 = a + Math.PI / (n * 4);
      pts.push([x + Math.cos(a1) * rr, y + Math.sin(a1) * rr], [x + Math.cos(a2) * rr, y + Math.sin(a2) * rr]);
    }
    let s = c.p(poly(pts), c.vg(col, 0.3, -0.25), 2);
    s += c.ci(x, y, r * 0.45, c.h.shade(col, -0.3), 1.4) + c.ci(x, y, r * 0.18, c.h.shade(col, 0.4), 0);
    return s;
  }
  /** 시계판 — 가운데 (x,y), 반지름 r, 바늘 각(시·분, 도) */
  function dial(c, x, y, r, hA, mA, lit) {
    let s = aura(c, x, y, r * 1.6, r * 1.6, '#fff1a8', 0.2 + 0.35 * lit);
    s += c.ci(x, y, r + 2, c.vg(GOLD, 0.35, -0.25), 2.4);
    s += c.ci(x, y, r, c.sg(IVORY), 1.6);
    let tk = '';
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; const r1 = r * (i % 3 ? 0.8 : 0.7); tk += `M${f(x + Math.cos(a) * r1)} ${f(y + Math.sin(a) * r1)}L${f(x + Math.cos(a) * r * 0.92)} ${f(y + Math.sin(a) * r * 0.92)}`; }
    s += c.ln(tk, '#6a5030', Math.max(0.8, r * 0.08), 0.9);
    const hand = (ang, L, w, col) => { const a = ((ang - 90) * Math.PI) / 180; return c.ln(`M${f(x)} ${f(y)}L${f(x + Math.cos(a) * L)} ${f(y + Math.sin(a) * L)}`, col, w); };
    s += hand(hA, r * 0.5, Math.max(1.4, r * 0.16), '#3a2a18') + hand(mA, r * 0.78, Math.max(1, r * 0.1), lit > 0.7 ? '#c84a2a' : '#3a2a18');
    s += c.ci(x, y, Math.max(1, r * 0.12), c.sg(GOLD), 0);
    return s;
  }
  /** 떠 있는 모래시계 — 가운데 (x,y), 크기 k */
  function hourglass(c, x, y, k, lit, flip = 0) {
    let s = aura(c, x, y, 9 * k, 11 * k, STAR, 0.25 + 0.35 * lit);
    const P = (u, v) => `${f(x + u * k)} ${f(y + v * k)}`;
    s += c.r(x - 6 * k, y - 10 * k, 12 * k, 2.2 * k, c.vg(BRASS, 0.3, -0.2), 0.8, 1.6) + c.r(x - 6 * k, y + 7.8 * k, 12 * k, 2.2 * k, c.vg(BRASS, 0.3, -0.2), 0.8, 1.6);
    s += c.p(`M${P(-4.6, -7.8)}L${P(4.6, -7.8)}L${P(0.8, 0)}L${P(4.6, 7.8)}L${P(-4.6, 7.8)}L${P(-0.8, 0)}Z`, c.vg('#e8f8ff', 0.3, -0.1), 1.6);
    const top = flip ? 0.25 : 0.7;
    s += c.p(`M${P(-3.6 * top, -6.8 + 6 * (1 - top))}L${P(3.6 * top, -6.8 + 6 * (1 - top))}L${P(0.5, -0.6)}L${P(-0.5, -0.6)}Z`, '#ffd27a', 0);
    s += c.p(`M${P(-3.8, 7)}Q${P(0, 7 - 5 * (1 - top))} ${P(3.8, 7)}Z`, '#ffd27a', 0);
    s += c.ln(`M${P(0, -0.4)}V${P(0, 6).split(' ')[1]}`, '#ffd27a', 0.8, 0.9);
    s += spark(c, x + 9 * k, y - 8 * k, 2 * k, '#ffffff', 0) + spark(c, x - 9 * k, y + 6 * k, 1.6 * k, STAR, 0);
    return s;
  }
  const HANDS = { idle: [300, 60], aim: [330, 150], fire: [0, 240] };
  const ringBurst = (c, x, y, r) => burstRing(c, x, y, r, r * 0.45, '#fff1a8', 2.4, 0.85) + burstRing(c, x, y, r * 1.4, r * 0.62, STAR, 1.8, 0.6);

  /* ---------- 단계별 ---------- */
  /* Lv1: 돌기둥 위 작은 시계판 + 떠 있는 모래시계 */
  function lv1(c, pose) {
    const lit = pose === 'idle' ? 0.5 : 1;
    let o = legendPlat(c, 1);
    o += footShade(c, 50, 103, 15, 5);
    o += c.p('M42 104L44 74H56L58 104Z', c.vg('#d8d0bc', 0.3, -0.25), 2.4);
    o += c.ln('M47 100V78M53 100V78', '#b8ac98', 1.1, 0.7);
    o += gear(c, 44, 88, 4, 7, BRASS, pose === 'aim' ? 0.3 : 0);
    const [hA, mA] = HANDS[pose];
    o += dial(c, 50, 66, 9, hA, mA, lit);
    o += hourglass(c, 50, 42, 0.8, lit, pose === 'fire');
    if (pose === 'fire') o += ringBurst(c, 50, 66, 16);
    return o;
  }

  /* Lv2·3: 시계탑 — 앞면 큰 시계판, 옆 톱니, 뾰족 지붕. Lv3는 금빛·모래시계 */
  function lv23(c, pose, L3) {
    const lit = pose === 'idle' ? 0.5 : 1;
    let o = legendPlat(c, L3 ? 3 : 2, { stone: '#e0d8c4', trim: GOLD });
    o += footShade(c, 50, 103, 19, 6);
    const top = L3 ? 58 : 64;
    o += masonry(c, 50, top, 104, L3 ? 12 : 11.5, 15, 0.3, IVORY, { ch: 7, bw: 9, seed: L3 ? 181 : 179 });
    o += c.p('M46 104V97Q50 93 54 97V104Z', c.vg('#5a4a30', 0.1, -0.2), 2.2);
    if (L3) o += metalBand(c, 50, 90, 92.4, 14, 4.2, GOLD);
    const rot = pose === 'aim' ? 0.35 : pose === 'fire' ? 0.7 : 0;
    o += gear(c, 36, top + 22, L3 ? 6 : 5, 8, BRASS, rot) + gear(c, 64, top + 26, L3 ? 5 : 4.4, 7, BRASS, -rot);
    const [hA, mA] = HANDS[pose];
    o += dial(c, 50, top + 12, L3 ? 10 : 9, hA, mA, lit);
    o += tileCone(c, 50, top, L3 ? 28 : 26, L3 ? 18 : 15, L3 ? '#c89a3a' : '#8a6a4a', { rows: 3, scallops: 7 });
    o += c.ol(`M50 ${top - (L3 ? 18 : 15)}V${top - (L3 ? 24 : 20)}`, GOLD, 1.4);
    if (L3) o += hourglass(c, 50, top - 34, 0.95, lit, pose === 'fire');
    else o += c.ci(50, top - 21, 2.2, c.sg(GOLD), 1.2);
    if (pose === 'fire') o += ringBurst(c, 50, top + 12, 18);
    return o;
  }

  /* 4A 멈춘 세계: 시계탑 + 둘레를 도는 시계판 고리 세 겹(천문 고리처럼) */
  function frozen(c, pose) {
    const lit = pose === 'idle' ? 0.55 : 1;
    let o = legendPlat(c, 'A', { stone: '#e8e0cc', trim: GOLD, glow: STAR, mythic: true });
    o += footShade(c, 50, 99, 22, 6);
    o += masonry(c, 50, 58, 99, 12, 16, 0.3, IVORY, { ch: 7, bw: 9, seed: 191 });
    o += metalBand(c, 50, 86, 88.6, 15, 4.5, GOLD);
    o += c.p('M46 99V92Q50 88 54 92V99Z', c.vg('#5a4a30', 0.1, -0.2), 2.2);
    const [hA, mA] = HANDS[pose];
    o += dial(c, 50, 72, 10, hA, mA, lit);
    o += tileCone(c, 50, 58, 28, 16, '#c89a3a', { rows: 3, scallops: 7 });
    // 고리 세 겹 (기울기를 달리해 도는 천문 고리)
    const ph = pose === 'aim' ? 12 : pose === 'fire' ? 24 : 0;
    const cy = 30;
    for (const [rx, ry, rot, col] of [[30, 9, -14 + ph, GOLD], [24, 7, 20 - ph, BRASS], [18, 14, 70 + ph, '#e8c86a']]) {
      o += `<g transform="rotate(${rot} 50 ${cy})">` + c.e(50, cy, rx, ry, 'none', 0, ` stroke="#1c1426" stroke-width="${c.sw(4.4)}"`) + c.e(50, cy, rx, ry, 'none', 0, ` stroke="${col}" stroke-width="${c.sw(2.4)}"`) + c.ci(50 + rx, cy, 1.8, '#ffffff', 0) + '</g>';
    }
    o += hourglass(c, 50, cy, 1.15, lit, pose === 'fire');
    if (pose === 'fire') o += ringBurst(c, 50, cy, 26);
    return o;
  }

  /* 4B 가속 시계: 쌍 시계판(바늘이 빙글빙글) + 가운데 큰 톱니 */
  function haste(c, pose) {
    const lit = pose === 'idle' ? 0.55 : 1;
    let o = legendPlat(c, 'B', { stone: '#e8e0cc', trim: GOLD, glow: STAR, mythic: true });
    o += footShade(c, 50, 99, 24, 7);
    o += masonry(c, 50, 60, 99, 13, 17, 0.3, IVORY, { ch: 7, bw: 9, seed: 201 });
    o += metalBand(c, 50, 84, 86.6, 15.6, 4.6, GOLD);
    o += c.p('M46 99V92Q50 88 54 92V99Z', c.vg('#5a4a30', 0.1, -0.2), 2.2);
    const rot = pose === 'aim' ? 0.5 : pose === 'fire' ? 1 : 0;
    o += gear(c, 50, 50, 12, 10, BRASS, rot);
    o += c.ol('M38 50L30 38M62 50L70 38', GOLD, 2.4);
    const spin = { idle: 0, aim: 120, fire: 240 }[pose];
    o += dial(c, 28, 32, 10, 300 + spin, 60 + spin * 2, lit) + dial(c, 72, 32, 10, 60 - spin, 300 - spin * 2, lit);
    if (pose !== 'idle') o += motion(c, 'M15 22Q12 32 15 42M41 22Q44 32 41 42M59 22Q56 32 59 42M85 22Q88 32 85 42', '#fff1a8', 1.8, 0.8);
    o += hourglass(c, 50, 18, 0.85, lit, pose === 'fire');
    if (pose === 'fire') o += ringBurst(c, 28, 32, 14) + ringBurst(c, 72, 32, 14);
    return o;
  }

  T.chrono_spire = {
    /* 시계판 가운데 (빛 화살이 나가는 곳) */
    muzzle: [[50, 66], [50, 76], [50, 70], [50, 72], [28, 32]],
    draw(c, v, pose = 'idle') {
      c = fine(c);
      if (v === 1) return lv1(c, pose);
      if (v === 2) return lv23(c, pose, false);
      if (v === 3) return lv23(c, pose, true);
      if (v === 'A') return frozen(c, pose);
      return haste(c, pose);
    },
  };
})();
