'use strict';

/* =========================================================
 * 탑 그림 — ❄️ 눈보라 성채 `blizzard_keep` (전설, 2026-11-11). 설계: docs/design/towers.md I5
 *  서리 고개의 얼음 성채. 꼭대기에 눈보라 수정이 떠 있고, 둘레에 눈이 돎.
 *  idle: 수정이 은은히 빛남 · aim: 수정에 눈이 모임(모이는 빛살) · fire: 수정에서 눈보라가 뿜어짐(고리·눈송이)
 *  4A 영원한 겨울: 얼음 가시 왕관을 쓴 넓은 성채 · 4B 얼음 폭풍: 쌍둥이 얼음 첨탑
 * ========================================================= */
(() => {
  const { f, M, fine, poly, cyl, frus, ring, aura, spark, masonry, masonryCyl, metalBand, gem, crystal } = RG.art._tw;
  const A = RG.art._tw.A;
  const { footShade, litWindow, stoneRect, gather, frostMotes, burstRing, tileCone } = A;
  const { GOLD, legendPlat } = RG.art._tw.L;
  const T = RG.art._tw.T;
  const ICE = '#cfe8f6';
  const ICED = '#8fbcd8';
  const BLUESTONE = '#8aa6c4';

  /* ---------- 부품 ---------- */
  /** 떠 있는 눈보라 수정 + 둘레 눈송이 — 가운데 (x,y), 크기 k */
  function stormCrystal(c, x, y, k, pose) {
    const lit = pose === 'idle' ? 0.55 : 1;
    const dy = pose === 'aim' ? -2.5 : pose === 'fire' ? 1 : 0;
    const cy = y + dy;
    let s = aura(c, x, cy, 14 * k * (0.9 + 0.3 * lit), 13 * k * (0.9 + 0.3 * lit), '#bfeaff', 0.35 + 0.35 * lit);
    if (pose === 'aim') s += gather(c, x, cy, 7 * k, 17 * k, '#dff6ff', 8, 20);
    s += crystal(c, x, cy, 10 * k, 18 * k, '#bfe8ff', 2.6);
    s += c.ln(`M${f(x)} ${f(cy - 7 * k)}V${f(cy + 7 * k)}M${f(x - 5 * k)} ${f(cy - 3 * k)}L${f(x + 5 * k)} ${f(cy + 3 * k)}M${f(x + 5 * k)} ${f(cy - 3 * k)}L${f(x - 5 * k)} ${f(cy + 3 * k)}`, '#ffffff', 1.2, 0.8);
    // 도는 눈송이
    const ph = pose === 'aim' ? 0.4 : pose === 'fire' ? 0.8 : 0;
    s += frostMotes(c, [0, 1, 2, 3, 4].map((i) => { const a = ph + i * 1.256; return [x + Math.cos(a) * 13 * k, cy + Math.sin(a) * 5 * k, (i % 2 ? 1.8 : 2.4) * k]; }));
    if (pose === 'fire') {
      s += burstRing(c, x, cy, 16 * k, 8 * k, '#ffffff', 2.4, 0.85) + burstRing(c, x, cy, 23 * k, 11 * k, '#bfeaff', 1.8, 0.6);
      s += frostMotes(c, [[x - 22 * k, cy - 8 * k, 2.6 * k], [x + 23 * k, cy - 4 * k, 2.6 * k], [x - 16 * k, cy + 9 * k, 2.2 * k], [x + 18 * k, cy + 10 * k, 2.2 * k], [x, cy - 16 * k, 2.4 * k]]);
    }
    return s;
  }
  /** 얼음 성가퀴(앞면) — 가운데 x, 윗선 y, 반지름 r */
  function battlement(c, x, y, r, col) {
    let s = '';
    for (const d of [-64, -32, 0, 32, 64]) {
      const a = (d * Math.PI) / 180;
      const bx = x + r * Math.sin(a);
      const by = y + r * 0.3 * Math.cos(a);
      s += stoneRect(c, bx - 3.4, by - 6, 6.8, 6.4, col, { ch: 3.2, bw: 4, seed: d + 7, ow: 2 });
    }
    return s;
  }
  /** 고드름 줄 (처마 아래) */
  function icicles(c, x1, x2, y, n, L) {
    let d = '';
    const step = (x2 - x1) / n;
    for (let i = 0; i < n; i++) { const a = x1 + i * step + step * 0.15; const l = L * (i % 2 ? 0.6 : 1); d += `M${f(a)} ${f(y)}L${f(a + step * 0.35)} ${f(y + l)}L${f(a + step * 0.7)} ${f(y)}Z`; }
    return c.p(d, c.vg('#e8f8ff', 0.3, -0.15), 1.6);
  }

  /* ---------- 단계별 ---------- */
  /* Lv1: 얼음 덩이를 쌓은 작은 망루 + 눈 덮개 + 수정 */
  function lv1(c, pose) {
    let o = legendPlat(c, 1);
    o += footShade(c, 50, 103, 17, 5);
    o += stoneRect(c, 40, 74, 20, 30, ICE, { ch: 7.5, bw: 9, seed: 4, mortar: ICED });
    o += c.p('M46 104V96Q50 92 54 96V104Z', c.vg('#5a7a9a', 0.1, -0.2), 2);
    o += c.r(37, 70, 26, 5, c.vg('#e8f8ff', 0.2, -0.15), 1, 2.4);
    o += icicles(c, 38, 62, 75, 6, 4.5);
    o += battlement(c, 50, 69, 12, ICE);
    o += stormCrystal(c, 50, 50, 0.85, pose);
    return o;
  }

  /* Lv2·3: 푸른 돌 성탑 + 얼음 지붕(Lv2) / 성가퀴 성채(Lv3) */
  function lv23(c, pose, L3) {
    let o = legendPlat(c, L3 ? 3 : 2, { stone: '#b8c8d8', trim: GOLD });
    o += footShade(c, 50, 103, 20, 6);
    const top = L3 ? 64 : 70;
    o += masonry(c, 50, top, 104, L3 ? 12.5 : 11.5, 15, 0.3, BLUESTONE, { ch: 7, bw: 9, seed: L3 ? 81 : 79 });
    o += litWindow(c, 50, L3 ? 90 : 94, 4.6, 6.4, '#9fe4ff', { frame: '#6a8aa8' });
    o += c.p('M45 104V97Q50 92 55 97V104Z', c.vg('#3a4a6a', 0.1, -0.2), 2.2);
    if (L3) {
      o += metalBand(c, 50, 78, 80.6, 13.6, 4, GOLD);
      o += cyl(c, 50, top - 3, top, 15, 4.5, c.cg('#c8e4f4'), c.vg('#e8f8ff', 0.1, -0.1), 2.4);
      o += icicles(c, 36, 64, top + 1, 7, 5);
      o += battlement(c, 50, top - 3, 15, ICE);
      o += stormCrystal(c, 50, top - 22, 1.05, pose);
    } else {
      o += icicles(c, 38, 62, top + 0.5, 6, 4.5);
      o += tileCone(c, 50, top, 28, 16, '#bfe0f4', { rows: 3, scallops: 7 });
      o += stormCrystal(c, 50, top - 28, 0.95, pose);
    }
    return o;
  }

  /* 4A 영원한 겨울: 넓은 성채 + 얼음 가시 왕관 + 큰 수정 */
  function winter(c, pose) {
    let o = legendPlat(c, 'A', { stone: '#c8d8e8', trim: GOLD, glow: '#bfeaff' });
    o += footShade(c, 50, 99, 26, 7);
    o += masonry(c, 50, 62, 99, 17, 20, 0.3, BLUESTONE, { ch: 7, bw: 10, seed: 91 });
    o += metalBand(c, 50, 76, 79, 18, 5.4, GOLD) + metalBand(c, 50, 89, 92, 19.4, 5.8, GOLD);
    o += litWindow(c, 41, 87, 4, 5.6, '#9fe4ff', { frame: '#6a8aa8' }) + litWindow(c, 59, 87, 4, 5.6, '#9fe4ff', { frame: '#6a8aa8' });
    o += c.p('M45 99V91Q50 86 55 91V99Z', c.vg('#3a4a6a', 0.1, -0.2), 2.2);
    o += cyl(c, 50, 58, 62, 20, 6, c.cg('#c8e4f4'), c.vg('#e8f8ff', 0.1, -0.1), 2.4);
    o += icicles(c, 31, 69, 63, 9, 6);
    // 얼음 가시 왕관
    let spikes = '';
    for (const [x, hgt] of [[33, 13], [41, 19], [50, 24], [59, 19], [67, 13]]) spikes += `M${x - 4} 60L${x} ${60 - hgt}L${x + 4} 60Z`;
    o += c.p(spikes, c.vg('#e8f8ff', 0.4, -0.2), 2.2);
    o += c.ln('M40 58L41 44M49 58L50 39M58 58L59 44', '#ffffff', 1.2, 0.8);
    o += gem(c, 50, 54, 2.8, 3.4, '#9fe4ff', true);
    o += stormCrystal(c, 50, 22, 1.25, pose);
    return o;
  }

  /* 4B 얼음 폭풍: 쌍둥이 얼음 첨탑, 꼭대기마다 수정 */
  function twinSpire(c, pose) {
    let o = legendPlat(c, 'B', { stone: '#c8d8e8', trim: GOLD, glow: '#bfeaff' });
    o += footShade(c, 50, 99, 26, 7);
    o += c.p('M30 99V84Q50 74 70 84V99Z', c.vg(BLUESTONE, 0.15, -0.25), 2.4);
    o += c.p('M44 99V90Q50 85 56 90V99Z', c.vg('#3a4a6a', 0.1, -0.2), 2.2);
    for (const [x, ht] of [[34, 50], [66, 46]]) {
      o += masonry(c, x, 99 - ht + 12, 99, 6.5, 9, 0.3, BLUESTONE, { ch: 6, bw: 7, seed: x });
      o += c.p(`M${x - 8} ${99 - ht + 12}L${x} ${99 - ht - 12}L${x + 8} ${99 - ht + 12}Q${x} ${99 - ht + 15} ${x - 8} ${99 - ht + 12}Z`, c.vg('#d8f0ff', 0.35, -0.2), 2.4);
      o += c.ln(`M${x - 3} ${99 - ht + 10}L${x} ${99 - ht - 8}`, '#ffffff', 1.3, 0.8);
      o += metalBand(c, x, 99 - ht + 22, 99 - ht + 24.4, 7.4, 2.2, GOLD);
      o += stormCrystal(c, x, 99 - ht - 22, 0.8, pose);
    }
    return o;
  }

  T.blizzard_keep = {
    /* 수정 가운데 — 눈보라가 여기서 뿜어짐 */
    muzzle: [[50, 50], [50, 42], [50, 42], [50, 22], [34, 27]],
    draw(c, v, pose = 'idle') {
      c = fine(c);
      if (v === 1) return lv1(c, pose);
      if (v === 2) return lv23(c, pose, false);
      if (v === 3) return lv23(c, pose, true);
      if (v === 'A') return winter(c, pose);
      return twinSpire(c, pose);
    },
  };
})();
