'use strict';

/* =========================================================
 * 탑 그림 — ⚡ 뇌운 탑 `thunder_cloud` (2차 탑, 2026-11-11). 설계: docs/design/towers.md S4
 *  붉은 협곡 꼭대기의 구리 피뢰 탑: 첨탑 꼭대기에 검은 뇌운이 돌고, 첨탑을 따라 전선이 감김. 사람 없음.
 *  idle: 뇌운 속이 은은하게 빛남 · aim: 뇌운이 번쩍이며 첨탑 끝에 전기가 모임
 *  fire: 뇌운과 첨탑 사이로 번개가 내리꽂히고 첨탑이 하얗게 빛남 (적에게 떨어지는 번개는 효과가 그림)
 *  4A 천둥신 제단: 구리 제단 + 뿔 모양 피뢰침 둘 사이의 번개 공 · 4B 폭풍 전선: 피뢰침 넷이 받친 넓은 뇌운
 * ========================================================= */
(() => {
  const { f, M, STONE, fine, poly, cyl, frus, ring, aura, spark, plat, masonryCyl, metalBand, gem, orb } = RG.art._tw;
  const A = RG.art._tw.A;
  const { footShade, motion, beam, lash, coilWind, zapArc, rodTip, insulator, COPPER, stoneRect } = A;
  const T = RG.art._tw.T;

  /* ---------- 부품 ---------- */
  /** 뇌운 — 아랫선 가운데 (x,y), 너비 w, 높이 ht, 속빛 glow(0~1) */
  function stormCloud(c, x, y, w, ht, glow = 0) {
    const h = c.h;
    const E = c.E;
    const P = (u, v) => `${f(x + u * w)} ${f(y - v * ht)}`;
    const d = `M${P(-0.48, 0.08)}C${P(-0.62, 0.14)} ${P(-0.6, 0.52)} ${P(-0.38, 0.5)}C${P(-0.42, 0.88)} ${P(-0.12, 0.96)} ${P(-0.04, 0.78)}C${P(0.04, 1.12)} ${P(0.36, 1.1)} ${P(0.32, 0.78)}C${P(0.5, 0.84)} ${P(0.58, 0.58)} ${P(0.44, 0.48)}C${P(0.64, 0.44)} ${P(0.6, 0.08)} ${P(0.48, 0.08)}Q${P(0, -0.12)} ${P(-0.48, 0.08)}Z`;
    const top = h.mix('#6a6488', E.light, glow * 0.35);
    const gid = c.def(`sc${top}`, (id) => c.lgc(id, [[0, h.shade(top, 0.25)], [0.5, top], [1, '#2a2440']]));
    let s = '';
    if (glow > 0) s += aura(c, x, y - ht * 0.45, w * 0.75, ht, E.color, 0.35 + glow * 0.5);
    s += c.p(d, gid, 2.8);
    /* 속빛(번쩍임) */
    if (glow > 0) s += c.e(x - w * 0.05, y - ht * 0.45, w * 0.28, ht * 0.3, c.ag(E.light, 0.6 + glow * 0.4), 0);
    s += c.ln(`M${P(-0.36, 0.62)}Q${P(-0.24, 0.84)} ${P(-0.04, 0.76)}M${P(0.06, 0.94)}Q${P(0.2, 1.02)} ${P(0.3, 0.84)}`, h.shade(top, 0.55), 1.5, 0.8);
    s += c.p(`M${P(-0.46, 0.1)}Q${P(0, -0.08)} ${P(0.46, 0.1)}Q${P(0.3, 0.24)} ${P(0, 0.2)}Q${P(-0.3, 0.24)} ${P(-0.46, 0.1)}Z`, '#1c1830', 0, ' opacity="0.55"');
    return s;
  }
  /** 자세별 뇌운 + 첨탑 끝 전기 */
  function crown(c, pose, cx, cy, w, ht, tip, r = 3.2) {
    const E = c.E;
    const glow = pose === 'idle' ? 0.25 : pose === 'aim' ? 0.8 : 1;
    let s = stormCloud(c, cx, cy, w, ht, glow);
    if (pose === 'aim') s += zapArc(c, cx - w * 0.2, cy + 1, tip[0] - 1, tip[1] - r, { n: 4, j: 2.4, w: 1.4, seed: 11 }) + zapArc(c, cx + w * 0.22, cy + 2, tip[0] + 1, tip[1] - r, { n: 4, j: 2.4, w: 1.4, seed: 13 });
    if (pose === 'fire') s += zapArc(c, cx, cy + 1, tip[0], tip[1] - r, { n: 5, j: 3, w: 3, seed: 17, branch: [-8, 6] }) + aura(c, tip[0], tip[1], 14, 12, '#ffffff', 0.8) + spark(c, cx + w * 0.25, cy - ht * 0.6, 4, '#ffffff', 1.4);
    s += rodTip(c, tip[0], tip[1], r, pose === 'fire' ? 'fire' : pose === 'aim' ? 'aim' : 'idle', { col: COPPER });
    return s;
  }
  /** 구리 막대(외곽선 + 빛 줄) */
  const rod = (c, x, y1, y2, w = 2.6) => c.ol(`M${x} ${y1}V${y2}`, COPPER, w) + c.ln(`M${x - 0.6} ${y1 + 1}V${y2 - 1}`, c.h.shade(COPPER, 0.5), 1, 0.8);

  /* ---------- 단계별 ---------- */
  function lv1(c, pose) {
    const h = c.h;
    let o = plat(c, 1);
    o += footShade(c, 50, 103, 24, 6);
    /* 나무 망대: 두 다리 + 가로대 + 작은 마루 */
    o += beam(c, 38, 106, 44, 74, 3.4, M.wood) + beam(c, 62, 106, 56, 74, 3.4, h.shade(M.wood, -0.1));
    o += beam(c, 40, 92, 60, 92, 2.6, M.woodD, { light: false });
    o += lash(c, 41, 92, 5, 3.4) + lash(c, 59, 92, 5, 3.4);
    o += c.p('M36 76L64 76L62 72L38 72Z', c.vg(M.plank, 0.25, -0.25), 2.4);
    /* 구리 막대 + 절연체 */
    o += rod(c, 50, 72, 42);
    o += insulator(c, 50, 62, 8);
    /* 망대 아래 나무 축전 상자(손잡이) + 상자에서 막대로 이어지는 전선 */
    o += c.p('M58 104V90H76V104Z', c.vg(M.plank, 0.25, -0.25), 2.4) + c.p('M58 90L62 86H80L76 90Z', c.vg(h.shade(M.plank, 0.2), 0.2, -0.2), 2.2) + c.p('M76 104V90L80 86V100Z', c.vg(h.shade(M.plank, -0.25), 0.1, -0.2), 2.2);
    o += c.ln('M60 96H74M60 100H74', h.shade(M.plank, -0.4), 1.2, 0.8) + c.ci(67, 95, 2.2, c.sg(COPPER), 1.4);
    o += c.ol('M78 92L84 88L86 92', M.iron, 1.4) + c.ci(86, 92, 1.6, c.sg('#c8462c'), 1.2);
    o += c.ln('M66 88Q60 70 50 62', '#3a2a24', 1.3, 0.9);
    if (pose !== 'idle') o += zapArc(c, 66, 88, 52, 64, { n: 4, j: 2, w: 1.2, seed: 9 });
    o += crown(c, pose, 50, 32, 40, 18, [50, 40], 3.2);
    return o;
  }

  function lv23(c, pose, L3) {
    const h = c.h;
    const st = STONE.storm;
    let o = plat(c, L3 ? 3 : 2, { stone: st, trim: L3 ? M.gold : undefined });
    o += footShade(c, 50, 103, 20, 6);
    const yt = L3 ? 64 : 70;
    o += masonryCyl(c, 50, yt, 104, 10, 3, st, { ch: 7, bw: 8, seed: L3 ? 411 : 409 });
    if (L3) o += metalBand(c, 50, 78, 81.5, 10, 3, M.gold);
    o += cyl(c, 50, yt - 3, yt, 12, 3.6, c.cg(h.shade(st, 0.12)), c.vg(h.shade(st, 0.3), 0.2, -0.05), 2.4);
    /* 구리 첨탑 + 코일 */
    const top = L3 ? 30 : 38;
    o += frus(c, 50, top + 8, yt - 3, 2.2, 5, c.cg(COPPER), null, 2.4);
    o += coilWind(c, 50, yt - 22, yt - 6, 6.5, 5, pose === 'aim' ? 1 : pose === 'fire' ? 0.6 : 0);
    o += insulator(c, 50, yt - 26, 9);
    if (L3) {
      o += insulator(c, 50, top + 14, 8);
      /* 곁 막대 둘 + 전선 */
      o += rod(c, 36, yt - 1, yt - 16, 2) + rod(c, 64, yt - 1, yt - 16, 2) + c.ci(36, yt - 17, 2, c.sg(COPPER), 1.4) + c.ci(64, yt - 17, 2, c.sg(COPPER), 1.4);
      o += c.ln(`M36 ${yt - 16}Q43 ${yt - 10} 47 ${yt - 18}M64 ${yt - 16}Q57 ${yt - 10} 53 ${yt - 18}`, '#3a2a24', 1.2, 0.9);
    }
    o += rod(c, 50, top + 8, top);
    o += crown(c, pose, 50, top - 9, L3 ? 46 : 40, L3 ? 20 : 17, [50, top], L3 ? 3.6 : 3.2);
    return o;
  }

  /* 4A 천둥신 제단: 계단식 구리 제단 + 뿔처럼 휜 피뢰침 둘 + 그 사이에 떠 있는 번개 공 */
  function altar(c, pose) {
    const h = c.h;
    const E = c.E;
    let o = plat(c, 4, { stone: '#8e88a6', trim: E.color });
    o += footShade(c, 50, 99, 30, 8);
    /* 제단(두 단) */
    o += stoneRect(c, 28, 80, 44, 19, STONE.storm, { ch: 6, bw: 9, seed: 421 });
    o += c.r(26, 77, 48, 4, c.vg(COPPER, 0.4, -0.25), 1, 2.4);
    o += stoneRect(c, 34, 62, 32, 16, h.shade(STONE.storm, 0.06), { ch: 6, bw: 8, seed: 423 });
    o += c.r(32, 59, 36, 4, c.vg(COPPER, 0.4, -0.25), 1, 2.4);
    o += gem(c, 50, 70, 3.4, 4.4, E.light, pose !== 'idle');
    /* 뿔 피뢰침 (아래 굵고 위로 휘며 가늘어짐) */
    const horn = (dir) => {
      const x0 = 50 + dir * 12;
      const d = `M${x0 - 3} 60C${x0 - 3 + dir * 10} 46 ${x0 + dir * 12} 30 ${x0 + dir * 2} 16L${x0 + dir * 0.4} 17C${x0 + dir * 8} 30 ${x0 + dir * 5} 46 ${x0 + 3} 60Z`;
      return c.p(d, c.cg(COPPER), 2.6) + c.ln(`M${x0 - dir * 0.5} 56C${x0 + dir * 6} 44 ${x0 + dir * 7} 30 ${x0 + dir * 2} 20`, h.shade(COPPER, 0.5), 1.2, 0.8)
        + insulator(c, x0 + dir * 4.2, 42, 7) + c.ci(x0 + dir * 1.2, 16, 2.2, c.sg(COPPER), 1.4);
    };
    o += horn(-1) + horn(1);
    /* 번개 공 + 뿔 끝 사이 전기 */
    const ball = [50, 28 + (pose === 'aim' ? -2 : 0)];
    const br = pose === 'fire' ? 8 : pose === 'aim' ? 7 : 6;
    o += aura(c, ball[0], ball[1], br * 2.6, br * 2.4, pose === 'fire' ? '#ffffff' : E.color, pose === 'idle' ? 0.55 : 0.9);
    o += zapArc(c, 39, 17, ball[0] - br * 0.8, ball[1] - 1, { n: 3, j: 2, w: pose === 'idle' ? 1.2 : 2, seed: 21 }) + zapArc(c, 61, 17, ball[0] + br * 0.8, ball[1] - 1, { n: 3, j: 2, w: pose === 'idle' ? 1.2 : 2, seed: 23 });
    o += orb(c, ball[0], ball[1], br, pose === 'idle' ? E.color : E.light, 2.4);
    o += zapArc(c, ball[0] - br * 0.5, ball[1] + 1, ball[0] + br * 0.4, ball[1] - br * 0.3, { n: 3, j: 1.5, w: 1.2, seed: 25 });
    if (pose === 'fire') o += zapArc(c, ball[0], ball[1] - br, ball[0] + 6, 0, { n: 5, j: 3, w: 3, seed: 27, branch: [-8, -2] }) + spark(c, ball[0], ball[1], br * 1.6, '#ffffff', 1.4);
    if (pose === 'aim') o += [[30, 30], [70, 26], [24, 48], [76, 46]].map(([x, y]) => spark(c, x, y, 2.4, E.light, 0)).join('');
    return o;
  }

  /* 4B 폭풍 전선: 넓은 마루 네 귀퉁이 피뢰침이 받친 넓고 낮은 뇌운 */
  function front(c, pose) {
    const h = c.h;
    const E = c.E;
    let o = plat(c, 4, { stone: '#8e88a6', trim: E.color });
    o += footShade(c, 50, 99, 36, 9);
    /* 마루 */
    o += cyl(c, 50, 84, 99, 32, 9.6, c.cg(h.shade(STONE.storm, 0.05)), c.vg(h.shade(STONE.storm, 0.25), 0.2, -0.05), 2.6);
    o += metalBand(c, 50, 88, 92, 32, 9.6, COPPER);
    /* 피뢰침 넷 (뒤 둘 먼저) */
    const tips = [[30, 40], [70, 40], [22, 46], [78, 46]];
    const bases = [[32, 80], [68, 80], [24, 88], [76, 88]];
    for (let i = 0; i < 4; i++) {
      o += c.ol(`M${bases[i][0]} ${bases[i][1]}L${tips[i][0]} ${tips[i][1]}`, i < 2 ? h.shade(COPPER, -0.2) : COPPER, 2.4);
      o += insulator(c, (bases[i][0] + tips[i][0]) / 2, (bases[i][1] + tips[i][1]) / 2, 6);
    }
    /* 가운데 코일 기둥 */
    o += frus(c, 50, 52, 84, 3, 7, c.cg(COPPER), null, 2.4);
    o += coilWind(c, 50, 58, 78, 7.5, 5, pose === 'aim' ? 1 : pose === 'fire' ? 0.6 : 0);
    /* 넓은 뇌운 (조각 셋) */
    const glow = pose === 'idle' ? 0.25 : pose === 'aim' ? 0.8 : 1;
    o += stormCloud(c, 28, 34, 34, 14, glow) + stormCloud(c, 72, 34, 34, 14, glow) + stormCloud(c, 50, 30, 46, 20, glow);
    o += tips.map(([x, y]) => c.ci(x, y, 2.2, c.sg(COPPER), 1.4)).join('');
    if (pose === 'aim') o += tips.slice(0, 2).map(([x, y], i) => zapArc(c, x, y - 2, x + (i ? -6 : 6), 24, { n: 3, j: 2, w: 1.4, seed: 31 + i })).join('');
    if (pose === 'fire') {
      o += [[22, 46], [78, 46], [50, 50]].map(([x, y], i) => zapArc(c, x + (i === 2 ? 0 : (i ? -4 : 4)), 30, x, y, { n: 4, j: 2.6, w: 2.4, seed: 41 + i })).join('');
      o += aura(c, 50, 30, 44, 16, '#ffffff', 0.6) + spark(c, 40, 22, 4, '#ffffff', 1.4) + spark(c, 62, 20, 3.4, '#ffffff', 1.4);
    }
    return o;
  }

  T.thunder_cloud = {
    /* 첨탑 끝 / 뇌운 (적에게는 하늘에서 바로 떨어짐 — 효과가 그림) */
    muzzle: [[50, 40], [50, 38], [50, 30], [50, 28], [50, 30]],
    draw(c, v, pose = 'idle') {
      c = fine(c);
      if (v === 1) return lv1(c, pose);
      if (v === 2) return lv23(c, pose, false);
      if (v === 3) return lv23(c, pose, true);
      if (v === 'A') return altar(c, pose);
      return front(c, pose);
    },
  };
})();
