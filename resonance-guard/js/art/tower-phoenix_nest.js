'use strict';

/* =========================================================
 * 탑 그림 — 🔥 불사조 둥지 `phoenix_nest` (전설, 2026-11-11). 설계: docs/design/towers.md F5
 *  붉은 협곡 꼭대기의 둥지 탑. 불사조 자체는 렌더러가 따로 그림(탑 둘레를 날아다님) — 여기엔 둥지·불씨 알·불꽃 깃털.
 *  idle: 둥지 불꽃이 잔잔함 · aim: 불꽃이 커지며 알이 빛남 · fire: 불꽃이 솟구치고 불씨가 튐
 *  4A 태양 불사조: 둥지 위에 작은 태양 · 4B 쌍둥이 불사조: 쌍둥이 기둥 위 둥지 둘
 *
 *  전설·신화 공용 장식도 여기서 정의(RG.art._tw.L) — 다음 탑 파일들이 씀.
 * ========================================================= */
(() => {
  const { f, M, fine, poly, cyl, frus, ring, band, aura, spark, plat, masonry, masonryCyl, metalBand, gem, flame } = RG.art._tw;
  const A = RG.art._tw.A;
  const { footShade, litWindow, bandI, embers, G, OP } = A;
  const T = RG.art._tw.T;

  /* ---------- 전설·신화 공용 ---------- */
  const GOLD = '#f2c14e';
  /** 등급 받침: 기본 받침 + (Lv2↑) 금테 고리 + (Lv4) 등급 빛 고리. mythic이면 별빛 */
  function legendPlat(c, v, o = {}) {
    const lv = v === 'A' || v === 'B' ? 4 : v;
    let s = plat(c, lv, { stone: o.stone, trim: o.trim || GOLD, rough: o.rough, top: o.top });
    const glow = o.glow || c.E.light;
    if (lv >= 2) {
      const y = lv === 4 ? 98 : 104;
      const rx = lv === 4 ? 30 : 34.5;
      s += c.e(50, y, rx, rx * 0.285, 'none', 0, ` stroke="${GOLD}" stroke-width="${c.sw(1.6)}" opacity="0.85"`);
    }
    if (lv === 4) {
      s += c.e(50, 104.5, 41, 12.4, 'none', 0, ` stroke="${glow}" stroke-width="${c.sw(2.4)}" opacity="0.55"`);
      if (o.mythic) {
        s += [[14, 100], [86, 101], [24, 116], [76, 117], [50, 121]].map(([x, y], i) => spark(c, x, y, i === 4 ? 2.6 : 2, i % 2 ? '#bfe8ff' : '#ffd8f4', 0)).join('');
      } else {
        s += [[16, 101], [84, 101]].map(([x, y]) => spark(c, x, y, 2.2, '#ffe6a8', 0)).join('');
      }
    }
    return s;
  }
  /** 날카로운 불꽃 깃털 하나 — 뿌리 (x,y), 길이 L, 각 ang(도, 0=위) */
  function feather(c, x, y, L, ang, col = '#ff7a2a') {
    const h = c.h;
    const a = ((ang - 90) * Math.PI) / 180;
    const ux = Math.cos(a);
    const uy = Math.sin(a);
    const px = -uy;
    const py = ux;
    const P = (t, w) => `${f(x + ux * L * t + px * w)} ${f(y + uy * L * t + py * w)}`;
    const w = L * 0.16;
    let s = c.p(`M${P(0, 0)}Q${P(0.35, w * 1.4)} ${P(0.7, w)}Q${P(0.9, w * 0.4)} ${P(1, 0)}Q${P(0.85, -w * 0.6)} ${P(0.62, -w * 1.1)}Q${P(0.3, -w * 1.2)} ${P(0, 0)}Z`, c.vg(h.shade(col, 0.25), 0.35, -0.2), 1.8);
    s += c.ln(`M${P(0.05, 0)}Q${P(0.5, w * 0.2)} ${P(0.92, 0)}`, '#fff1a8', 1.1, 0.85);
    return s;
  }
  RG.art._tw.L = { GOLD, legendPlat, feather };

  /* ---------- 부품 ---------- */
  /** 둥지: 엮은 나뭇가지 그릇 + 불씨 알 + 불꽃 — 가운데 (x, y=둥지 윗선), 너비 w */
  function nest(c, x, y, w, pose, o = {}) {
    const h = c.h;
    const big = pose === 'fire' ? 1.45 : pose === 'aim' ? 1.2 : 1;
    let s = aura(c, x, y - w * 0.25, w * (0.9 + 0.3 * big), w * (0.7 + 0.35 * big), '#ff9a3d', 0.35 + 0.15 * big);
    // 뒤쪽 테
    s += c.e(x, y, w / 2, w * 0.16, c.vg(o.rim ? h.shade(o.rim, -0.3) : '#4a2c18', 0, -0.2), 2.2);
    // 불꽃(알 뒤)
    s += flame(c, x - w * 0.12, y + 1, w * 0.42 * big, w * 0.72 * big);
    s += flame(c, x + w * 0.16, y + 1, w * 0.36 * big, w * 0.58 * big);
    // 불씨 알
    s += c.e(x, y - w * 0.06, w * 0.17, w * 0.22, c.sg(pose === 'idle' ? '#ff9a4a' : '#ffd27a'), 1.8);
    s += c.ln(`M${f(x - w * 0.05)} ${f(y - w * 0.22)}L${f(x + w * 0.02)} ${f(y - w * 0.12)}L${f(x - w * 0.04)} ${f(y - w * 0.03)}`, '#fff6c8', 1.2, 0.9);
    // 앞쪽 그릇(엮은 가지)
    const rim = o.rim || '#7a4a26';
    s += c.p(`M${f(x - w / 2)} ${f(y)}Q${f(x - w * 0.46)} ${f(y + w * 0.34)} ${f(x)} ${f(y + w * 0.38)}Q${f(x + w * 0.46)} ${f(y + w * 0.34)} ${f(x + w / 2)} ${f(y)}A${f(w / 2)} ${f(w * 0.16)} 0 0 1 ${f(x - w / 2)} ${f(y)}Z`, c.vg(rim, 0.25, -0.3), 2.4);
    let d = '';
    for (let i = 0; i < 5; i++) {
      const k = (i + 0.5) / 5;
      d += `M${f(x - w * 0.48 + w * 0.96 * k - w * 0.1)} ${f(y + w * 0.08 + Math.sin(k * Math.PI) * w * 0.12)}L${f(x - w * 0.48 + w * 0.96 * k + w * 0.12)} ${f(y + w * 0.02 + Math.sin(k * Math.PI) * w * 0.16)}`;
    }
    s += c.ln(d, h.shade(rim, -0.4), 1.3, 0.8);
    s += c.ln(`M${f(x - w * 0.46)} ${f(y + w * 0.1)}Q${f(x)} ${f(y + w * 0.32)} ${f(x + w * 0.46)} ${f(y + w * 0.1)}`, h.shade(rim, 0.35), 1.2, 0.7);
    if (o.gold) s += c.ln(`M${f(x - w * 0.5)} ${f(y + 0.4)}A${f(w / 2)} ${f(w * 0.16)} 0 0 0 ${f(x + w / 2)} ${f(y + 0.4)}`, GOLD, 2, 0.95);
    if (pose === 'fire') s += embers(c, [[x - w * 0.5, y - w * 0.7, 2.4], [x + w * 0.45, y - w * 0.85, 2.2], [x + w * 0.05, y - w * 1.1, 2.8]], '#ffd27a');
    if (pose === 'aim') s += embers(c, [[x - w * 0.35, y - w * 0.55, 1.8], [x + w * 0.35, y - w * 0.6, 1.8]], '#ffb347');
    return s;
  }
  const REDSTONE = '#b0685a';

  /* ---------- 단계별 ---------- */
  /* Lv1: 나무 횃대(엇갈린 가지) 위 둥지 */
  function lv1(c, pose) {
    const h = c.h;
    let o = legendPlat(c, 1);
    o += footShade(c, 50, 103, 18, 5);
    o += c.ol('M40 104L50 68M60 104L50 68', M.woodD, 3.4);
    o += c.ol('M37 92L63 92', M.wood, 2.6);
    o += c.ol('M50 104V64', M.wood, 3.6);
    o += c.ol('M50 76L41 66M50 80L60 70', M.woodD, 1.8);
    o += feather(c, 41, 66, 9, -40, '#ff6a2a') + feather(c, 60, 70, 8, 35, '#ffa040');
    o += nest(c, 50, 62, 26, pose);
    return o;
  }

  /* Lv2·3: 붉은 돌 탑 위 금테 둥지 (Lv3는 높고 금띠·불꽃 깃털 볏) */
  function lv23(c, pose, L3) {
    const h = c.h;
    let o = legendPlat(c, L3 ? 3 : 2, { stone: '#c8a08a', trim: GOLD });
    o += footShade(c, 50, 103, 20, 6);
    const top = L3 ? 60 : 68;
    o += masonry(c, 50, top, 104, L3 ? 10 : 11, 15, 0.3, REDSTONE, { ch: 7, bw: 9, seed: L3 ? 61 : 59 });
    if (L3) o += metalBand(c, 50, 74, 77, 11.4, 3.4, GOLD) + metalBand(c, 50, 90, 93, 13.2, 4, GOLD);
    o += litWindow(c, 50, L3 ? 88 : 92, 4.6, 6.4, '#ffb347', { frame: '#8a5a4a' });
    // 둥지 받침(돌 그릇)
    o += cyl(c, 50, top - 4, top, L3 ? 14 : 13, (L3 ? 14 : 13) * 0.3, c.cg('#8a4a3a'), c.vg('#5a2a20', 0, -0.2), 2.4);
    if (L3) {
      o += feather(c, 37, top - 8, 14, -55, '#ff5a2a') + feather(c, 63, top - 8, 14, 55, '#ff5a2a');
      o += feather(c, 41, top - 12, 15, -25, '#ff8a3a') + feather(c, 59, top - 12, 15, 25, '#ff8a3a');
    } else {
      o += feather(c, 39, top - 6, 11, -50, '#ff6a2a') + feather(c, 61, top - 6, 11, 50, '#ff6a2a');
    }
    o += nest(c, 50, top - 6, L3 ? 30 : 27, pose, { gold: true, rim: '#8a5a2a' });
    if (L3) o += gem(c, 50, top + 1.5, 2.6, 3.2, '#ff7a3a', true);
    return o;
  }

  /* 4A 태양 불사조: 높은 탑 + 둥지 위로 떠 있는 작은 태양(빛살 고리) */
  function sun(c, pose) {
    const h = c.h;
    let o = legendPlat(c, 'A', { stone: '#d8b8a0', trim: GOLD, glow: '#ffb347' });
    o += footShade(c, 50, 99, 22, 6);
    o += masonry(c, 50, 64, 99, 11, 16, 0.3, REDSTONE, { ch: 7, bw: 9, seed: 71 });
    o += metalBand(c, 50, 76, 79, 12.6, 3.8, GOLD) + metalBand(c, 50, 88, 91, 14, 4.2, GOLD);
    o += litWindow(c, 50, 86, 4.6, 6.4, '#ffd27a', { frame: '#8a5a4a' });
    o += cyl(c, 50, 60, 64, 16, 4.8, c.cg('#8a4a3a'), c.vg('#5a2a20', 0, -0.2), 2.4);
    o += feather(c, 34, 56, 16, -60, '#ff5a2a') + feather(c, 66, 56, 16, 60, '#ff5a2a') + feather(c, 39, 52, 17, -30, '#ff8a3a') + feather(c, 61, 52, 17, 30, '#ff8a3a');
    o += nest(c, 50, 58, 32, pose, { gold: true, rim: '#8a5a2a' });
    // 태양
    const lit = pose === 'idle' ? 0.6 : 1;
    const sy = pose === 'fire' ? 24 : 27;
    o += aura(c, 50, sy, 22 + 6 * lit, 20 + 6 * lit, '#ffd27a', 0.4 + 0.3 * lit);
    let rays = '';
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2 + (pose === 'aim' ? 0.13 : 0); const r1 = 10.5; const r2 = i % 2 ? 15 : 18.5; rays += `M${f(50 + Math.cos(a) * r1)} ${f(sy + Math.sin(a) * r1)}L${f(50 + Math.cos(a) * r2)} ${f(sy + Math.sin(a) * r2)}`; }
    o += c.ln(rays, '#ffb347', 2.6, 0.9) + c.ln(rays, '#fff1a8', 1.2, 0.95);
    o += c.ci(50, sy, 9.5, c.sg('#ffd040'), 2.4);
    o += c.ci(48, sy - 2, 3.4, '#fffbe0', 0, ' opacity="0.8"');
    if (pose === 'fire') o += c.e(50, sy, 22, 20, 'none', 0, ` stroke="#fff1a8" stroke-width="${c.sw(2)}" opacity="0.8"`);
    return o;
  }

  /* 4B 쌍둥이 불사조: 쌍둥이 붉은 돌 기둥 + 금빛 아치, 기둥마다 둥지 */
  function twin(c, pose) {
    const h = c.h;
    let o = legendPlat(c, 'B', { stone: '#d8b8a0', trim: GOLD, glow: '#ffb347' });
    o += footShade(c, 50, 99, 26, 7);
    for (const x of [33, 67]) {
      o += masonry(c, x, 64, 99, 7.5, 10, 0.3, REDSTONE, { ch: 7, bw: 8, seed: x });
      o += metalBand(c, x, 80, 82.6, 8.8, 2.6, GOLD);
    }
    // 아치
    o += c.p('M30 66Q50 44 70 66L66 68Q50 52 34 68Z', c.vg(GOLD, 0.35, -0.25), 2.4);
    o += gem(c, 50, 55, 3, 3.8, '#ff7a3a', true);
    o += c.p('M44 99V88Q50 82 56 88V99Z', c.vg('#4a2c20', 0.1, -0.2), 2.2);
    for (const [x, d] of [[33, -1], [67, 1]]) {
      o += cyl(c, x, 60, 64, 11, 3.3, c.cg('#8a4a3a'), c.vg('#5a2a20', 0, -0.2), 2.2);
      o += feather(c, x + d * 9, 56, 12, d * 55, '#ff5a2a');
      o += nest(c, x, 59, 22, pose, { gold: true, rim: '#8a5a2a' });
    }
    return o;
  }

  T.phoenix_nest = {
    /* 둥지 불꽃 가운데 */
    muzzle: [[50, 56], [50, 58], [50, 50], [50, 50], [33, 52]],
    draw(c, v, pose = 'idle') {
      c = fine(c);
      if (v === 1) return lv1(c, pose);
      if (v === 2) return lv23(c, pose, false);
      if (v === 3) return lv23(c, pose, true);
      if (v === 'A') return sun(c, pose);
      return twin(c, pose);
    },
  };
})();
