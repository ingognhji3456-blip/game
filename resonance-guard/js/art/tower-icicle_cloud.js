'use strict';

/* =========================================================
 * 탑 그림 — ❄ 고드름 구름 `icicle_cloud` (2차 탑, 2026-11-11). 설계: docs/design/towers.md I4
 *  서리 고개 기상술사의 탑: 기둥 위에 늘 작은 눈구름이 떠 있고 구름 아래 고드름이 매달림.
 *  idle: 구름이 둥실, 짧은 고드름 · aim: 구름이 부풀고 아랫배가 짙어지며 고드름이 길어짐
 *  fire: 고드름이 떨어져 나가고 구름이 번쩍 (실제 낙하는 효과가 그림)
 *  4A 우박 폭풍: 크고 시커먼 우박 구름 · 4B 빙하 창: 구름 대신 하늘을 향한 거대한 얼음 창
 * ========================================================= */
(() => {
  const { f, M, STONE, fine, poly, cyl, ring, crystal, aura, spark, plat, masonryCyl, metalBand, gem, shard } = RG.art._tw;
  const A = RG.art._tw.A;
  const { footShade, motion, beam, lash, frostMotes, icicleRow, OP, rnd, litWindow, snowCap } = A;
  const T = RG.art._tw.T;
  const ICE = '#9fe4ff';
  const SILVER = M.silver;

  /* ---------- 부품 ---------- */
  /** 눈구름 — 가운데 (x,y)(아랫선 높이), 너비 w, 높이 ht. dark 0~1: 아랫배 짙기 */
  function cloud(c, x, y, w, ht, dark = 0, o = {}) {
    const h = c.h;
    const top = o.col || '#f4fbff';
    const belly = h.mix('#c8dcec', '#5a6a8a', dark);
    const P = (u, v) => `${f(x + u * w)} ${f(y - v * ht)}`;
    const d = `M${P(-0.48, 0.08)}C${P(-0.62, 0.12)} ${P(-0.62, 0.5)} ${P(-0.4, 0.5)}C${P(-0.44, 0.86)} ${P(-0.16, 0.94)} ${P(-0.06, 0.8)}C${P(0, 1.14)} ${P(0.34, 1.12)} ${P(0.3, 0.8)}C${P(0.48, 0.86)} ${P(0.56, 0.6)} ${P(0.44, 0.5)}C${P(0.64, 0.46)} ${P(0.62, 0.08)} ${P(0.48, 0.08)}Q${P(0, -0.1)} ${P(-0.48, 0.08)}Z`;
    const gid = c.def(`cl${top}${belly}`, (id) => c.lgc(id, [[0, '#ffffff'], [0.55, top], [1, belly]]));
    let s = c.p(d, gid, 2.8);
    /* 아랫배 그늘 띠 + 윗면 빛 */
    s += c.p(`M${P(-0.48, 0.1)}Q${P(0, -0.08)} ${P(0.48, 0.1)}Q${P(0.3, 0.26)} ${P(0, 0.2)}Q${P(-0.3, 0.26)} ${P(-0.48, 0.1)}Z`, belly, 0, ' opacity="0.7"');
    s += c.ln(`M${P(-0.34, 0.62)}Q${P(-0.24, 0.84)} ${P(-0.06, 0.8)}M${P(0.08, 0.92)}Q${P(0.2, 1.0)} ${P(0.26, 0.82)}`, '#ffffff', 1.6, 0.9);
    if (dark > 0.5) s += c.ln(`M${P(-0.3, 0.3)}Q${P(0, 0.4)} ${P(0.32, 0.3)}`, h.mix(belly, '#2a3448', 0.4), 1.4, 0.6);
    return s;
  }
  /** 구름 아래 고드름들 (길이 L) */
  function hang(c, x, y, w, n, L, col = ICE) {
    let d = '';
    for (let i = 0; i < n; i++) {
      const cx = x - w / 2 + (w * (i + 0.5)) / n;
      const len = L * (i % 2 ? 0.7 : 1) * (0.85 + rnd(i + 3) * 0.3);
      d += `M${f(cx - 2)} ${f(y)}L${f(cx)} ${f(y + len)}L${f(cx + 2)} ${f(y)}Z`;
    }
    return c.p(d, c.vg(col, 0.45, -0.1), 1.6) + c.ln(d.replace(/L[^L]*L/g, (m) => m), '#ffffff', 0.8, 0);
  }
  /** 떨어지는 고드름(구름에서 떨어져 나가는 중) */
  function drops(c, list) {
    return list.map(([x, y, L]) => c.p(`M${f(x - 2.2)} ${f(y)}L${f(x)} ${f(y + L)}L${f(x + 2.2)} ${f(y)}Z`, c.vg(ICE, 0.5, -0.1), 1.6) + motion(c, `M${f(x)} ${f(y - 3)}V${f(y - 10)}`, '#ffffff', 1.4, 0.7)).join('');
  }
  /** 눈송이(여섯 갈래) */
  function flake(c, x, y, r, col = '#ffffff') {
    let d = '';
    for (let k = 0; k < 3; k++) {
      const a = (k * 60) * Math.PI / 180;
      d += `M${f(x - Math.cos(a) * r)} ${f(y - Math.sin(a) * r)}L${f(x + Math.cos(a) * r)} ${f(y + Math.sin(a) * r)}`;
    }
    return c.ln(d, '#1c2a48', 2.6, 0.6) + c.ln(d, col, 1.3);
  }
  /** 자세별 구름 + 고드름 묶음 */
  function cloudSet(c, pose, x, y, w, ht, n, L) {
    const E = c.E;
    const dark = pose === 'aim' ? 0.55 : pose === 'fire' ? 0.25 : 0.15;
    const k = pose === 'aim' ? 1.08 : 1;
    const bob = pose === 'aim' ? -1.5 : 0;
    let s = aura(c, x, y - ht * 0.4 + bob, w * 0.7, ht * 0.9, pose === 'fire' ? '#ffffff' : E.light, pose === 'idle' ? 0.35 : 0.7);
    if (pose !== 'fire') s += hang(c, x, y + bob - 1.5, w * 0.78, n, pose === 'aim' ? L * 1.5 : L);
    s += cloud(c, x, y + bob, w * k, ht * k, dark);
    if (pose === 'aim') s += frostMotes(c, [[x - w * 0.6, y - ht * 0.2, 2.2], [x + w * 0.62, y - ht * 0.5, 2.4], [x - w * 0.3, y - ht * 1.1, 2]]);
    if (pose === 'fire') {
      s += drops(c, Array.from({ length: n }, (_, i) => [x - w * 0.35 + (w * 0.7 * (i + 0.5)) / n, y + 8 + (i % 2) * 6, L * 1.2]));
      s += spark(c, x + w * 0.2, y - ht * 0.7, w * 0.16, '#ffffff', 1.4) + flake(c, x - w * 0.62, y - ht * 0.2, 3) + flake(c, x + w * 0.64, y - ht * 0.1, 3);
    }
    return s;
  }

  /* ---------- 단계별 ---------- */
  function lv1(c, pose) {
    const h = c.h;
    let o = plat(c, 1);
    o += footShade(c, 50, 103, 24, 6);
    /* 나무 세발 받침 */
    o += beam(c, 36, 106, 46, 78, 3.2, M.wood) + beam(c, 64, 106, 54, 78, 3.2, h.shade(M.wood, -0.1)) + beam(c, 50, 108, 50, 80, 3, M.woodD, { light: false });
    o += lash(c, 50, 80, 9, 3.4);
    /* 얼음 항아리 */
    o += c.p('M40 78Q38 66 44 62H56Q62 66 60 78Q50 82 40 78Z', c.cg('#5a8ab8'), 2.8);
    o += c.ln('M41 72Q50 75 59 72', h.shade('#5a8ab8', 0.5), 1.4, 0.8) + c.p('M43 62H57L56 59H44Z', c.vg('#7aa8d0', 0.3, -0.2), 2);
    o += c.e(50, 59.5, 6, 1.6, '#dff6ff', 1.6);
    /* 김(항아리 → 구름) */
    o += frostMotes(c, [[46, 54, 1.8], [54, 51, 1.6], [49, 48, 1.4]]);
    o += cloudSet(c, pose, 50, 44, 42, 20, 4, 10);
    return o;
  }

  function lv23(c, pose, L3) {
    const h = c.h;
    const st = STONE.frost;
    let o = plat(c, L3 ? 3 : 2, { stone: st, trim: SILVER });
    o += footShade(c, 50, 103, 22, 6);
    const yt = L3 ? 56 : 62;
    o += masonryCyl(c, 50, yt, 104, L3 ? 11 : 10, 3.2, st, { ch: 7, bw: 8, seed: L3 ? 311 : 309 });
    if (L3) o += metalBand(c, 50, 70, 73.5, 11, 3.2, SILVER) + metalBand(c, 50, 92, 95.5, 11, 3.2, SILVER);
    /* 기둥 머리(넓은 판 + 얼음 그릇) */
    o += cyl(c, 50, yt - 4, yt, L3 ? 15 : 13, 4, c.cg(h.shade(st, 0.12)), c.vg(h.shade(st, 0.3), 0.2, -0.05), 2.6);
    o += c.p(`M${L3 ? 38 : 40} ${yt - 4}Q50 ${yt + 2} ${L3 ? 62 : 60} ${yt - 4}L${L3 ? 58 : 57} ${yt - 9}H${L3 ? 42 : 43}Z`, c.vg('#7aa8d0', 0.3, -0.2), 2.2);
    o += c.e(50, yt - 9, L3 ? 8 : 7, 2, '#dff6ff', 1.6);
    if (L3) {
      /* 결정 장식 둘 + 고드름 처마 */
      o += crystal(c, 36, yt - 10, 6, 11, ICE, 2) + crystal(c, 64, yt - 10, 6, 11, ICE, 2);
      o += icicleRow(c, 36, 64, yt, 6, 5, '#ffffff');
    }
    o += litWindow(c, 50, L3 ? 88 : 90, 6, 9, '#8fd8ff', { frame: h.shade(st, -0.3) });
    o += frostMotes(c, [[46, yt - 13, 1.8], [54, yt - 16, 1.6]]);
    const cy = yt - 20;
    o += cloudSet(c, pose, 50, cy, L3 ? 56 : 50, L3 ? 26 : 22, L3 ? 6 : 5, L3 ? 12 : 10);
    if (L3) o += flake(c, 24, cy - 12, 3.4) + flake(c, 77, cy - 6, 3);
    return o;
  }

  /* 4A 우박 폭풍: 굵은 기둥 + 넓고 시커먼 우박 구름, 얼음 알갱이가 쏟아짐 */
  function hail(c, pose) {
    const h = c.h;
    const st = '#93a6ba';
    let o = plat(c, 4, { stone: st, trim: ICE });
    o += footShade(c, 50, 99, 30, 8);
    o += masonryCyl(c, 50, 58, 99, 14, 4.2, STONE.frost, { ch: 7, bw: 9, seed: 321 });
    o += metalBand(c, 50, 66, 70, 14, 4.2, SILVER) + metalBand(c, 50, 86, 90, 14, 4.2, SILVER);
    o += cyl(c, 50, 52, 58, 18, 5.4, c.cg(h.shade(STONE.frost, 0.1)), c.vg(h.shade(STONE.frost, 0.3), 0.2, -0.05), 2.6);
    o += icicleRow(c, 33, 67, 58, 7, 6, '#ffffff');
    o += litWindow(c, 50, 82, 7, 10, '#8fd8ff', { frame: h.shade(STONE.frost, -0.3) });
    /* 구름 */
    const dark = pose === 'aim' ? 0.95 : 0.7;
    const bob = pose === 'aim' ? -2 : 0;
    o += aura(c, 50, 30 + bob, 46, 22, pose === 'fire' ? '#ffffff' : '#7a9ac0', pose === 'idle' ? 0.4 : 0.75);
    o += cloud(c, 34, 40 + bob, 34, 16, dark, { col: '#d8e4f0' }) + cloud(c, 66, 40 + bob, 34, 16, dark, { col: '#d8e4f0' }) + cloud(c, 50, 36 + bob, 44, 22, dark, { col: '#e8f0f8' });
    /* 구름 속 번쩍임(aim) */
    if (pose === 'aim') o += c.ln('M44 30L48 34L45 36L50 40', '#ffffff', 1.6, 0.9) + frostMotes(c, [[18, 34, 2.4], [82, 30, 2.4]]);
    /* 우박 */
    const pellets = pose === 'fire' ? [[30, 50], [42, 56], [56, 52], [68, 58], [36, 66], [62, 70], [48, 74], [24, 62], [76, 64]] : [[38, 48], [62, 50]];
    o += pellets.map(([x, y], i) => (pose === 'fire' ? motion(c, `M${x - 1.2} ${y - 3}L${x - 3.6} ${y - 9}`, '#dff6ff', 1.6, 0.45) : '') + c.ci(x, y + (pose === 'fire' ? 0 : bob), 2 + (i % 3) * 0.5, c.sg('#f4fbff'), 1.4)).join('');
    if (pose === 'fire') o += spark(c, 50, 24, 6, '#ffffff', 1.4);
    return o;
  }

  /* 4B 빙하 창: 얼음 조각 받침 위에 하늘을 향해 떠 있는 거대한 얼음 창 */
  function spear(c, pose) {
    const h = c.h;
    const E = c.E;
    let o = plat(c, 4, { stone: '#93a6ba', trim: ICE });
    o += footShade(c, 50, 99, 26, 7);
    /* 받침: 둥근 얼음 제단 + 둘레 얼음 조각 */
    o += shard(c, 26, 70, 98, 10, ICE) + shard(c, 74, 72, 98, 10, ICE);
    o += cyl(c, 50, 84, 99, 16, 4.8, c.cg('#7aa8d0'), c.vg('#dff6ff', 0.2, -0.05), 2.6);
    o += c.e(50, 84, 10, 3, c.ag(E.light, 0.9), 0);
    o += shard(c, 36, 78, 96, 8, '#c8eeff') + shard(c, 64, 80, 96, 8, '#c8eeff');
    /* 창: aim 은 빛나며 살짝 내려앉고, fire 는 위로 솟구쳐 일부만 보임 */
    const dy = pose === 'aim' ? 3 : pose === 'fire' ? -26 : 0;
    o += aura(c, 50, 50 + dy, 16, 40, pose === 'idle' ? E.color : '#ffffff', pose === 'idle' ? 0.45 : 0.85);
    const sp = (yTop, yBot, w) => {
      const mid = yTop + (yBot - yTop) * 0.28;
      return c.p(poly([[50, yTop], [50 + w / 2, mid], [50 + w * 0.3, yBot], [50, yBot + 4], [50 - w * 0.3, yBot], [50 - w / 2, mid]]), c.vg(ICE, 0.55, -0.15), 2.6)
        + c.p(poly([[50, yTop], [50 + w / 2, mid], [50 + w * 0.3, yBot], [50, yBot + 4]]), h.shade(ICE, -0.22), 0, ' opacity="0.7"')
        + c.ln(`M${50 - w * 0.18} ${mid + 4}L49 ${yTop + 8}M${50 - w * 0.12} ${yBot - 6}L${50 - w * 0.22} ${mid + 8}`, '#ffffff', 1.6, 0.85);
    };
    if (pose === 'fire') {
      o += motion(c, 'M44 80V30M50 82V26M56 80V30', '#ffffff', 2, 0.8);
      o += sp(-6, 28, 13);
      o += frostMotes(c, [[30, 60, 2.6], [70, 56, 2.6], [40, 40, 2.2], [62, 44, 2.2]]) + spark(c, 50, 82, 8, '#ffffff', 1.4);
    } else {
      o += sp(14 + dy, 72 + dy, 15);
      /* 손잡이 쪽 고리 */
      o += c.e(50, 62 + dy, 9, 2.6, 'none', 0, ` stroke="${SILVER}" stroke-width="${c.sw(2)}" opacity="0.9"`);
      if (pose === 'aim') o += frostMotes(c, [[34, 30, 2.4], [66, 34, 2.4], [30, 56, 2], [70, 60, 2]]) + c.ln('M36 40Q50 30 64 40', '#ffffff', 1.8, 0.7);
    }
    return o;
  }

  T.icicle_cloud = {
    /* 구름 가운데 (고드름은 적 머리 위 하늘에서 떨어짐 — 효과가 그림) */
    muzzle: [[50, 40], [50, 33], [50, 26], [50, 30], [50, 30]],
    draw(c, v, pose = 'idle') {
      c = fine(c);
      if (v === 1) return lv1(c, pose);
      if (v === 2) return lv23(c, pose, false);
      if (v === 3) return lv23(c, pose, true);
      if (v === 'A') return hail(c, pose);
      return spear(c, pose);
    },
  };
})();
