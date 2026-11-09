'use strict';

/* 탑 그림 — 🪨 대지 · ✨ 빛 · 🌑 어둠 (공용 도구: towers.js) */
(() => {
  const { OL, SC, VKEYS, f, M, STONE, ELEM, Ctx, poly, cyl, frus, ring, band, vseam, flame, crystal, orb, aura, spark, bolt, flag, cone, person, bow, plat, house, shard } = RG.art._tw;
  const T = RG.art._tw.T;

  /* ---------- 🪨 바위 병영 ---------- */
  const MOSS = '#6fae3e';
  /* 돔: 바닥 중심 (x,yb), 반지름 rx, 높이 ht */
  const dome = (c, x, yb, rx, ht, fill, w = 3) => c.p(`M${f(x - rx)} ${f(yb)}A${f(rx)} ${f(ht)} 0 0 1 ${f(x + rx)} ${f(yb)}A${f(rx)} ${f(rx * 0.3)} 0 0 1 ${f(x - rx)} ${f(yb)}Z`, fill, w);
  /* 이끼 모자: 돔 꼭대기 */
  function mossCap(c, x, yt, w, ht) {
    const y = yt;
    return c.p(`M${f(x - w * 0.5)} ${f(y + ht * 0.7)}C${f(x - w * 0.45)} ${f(y + ht * 0.1)} ${f(x - w * 0.2)} ${f(y - ht * 0.15)} ${f(x)} ${f(y - ht * 0.15)}C${f(x + w * 0.2)} ${f(y - ht * 0.15)} ${f(x + w * 0.45)} ${f(y + ht * 0.1)} ${f(x + w * 0.5)} ${f(y + ht * 0.7)}Q${f(x + w * 0.4)} ${f(y + ht * 1.1)} ${f(x + w * 0.3)} ${f(y + ht * 0.8)}Q${f(x + w * 0.18)} ${f(y + ht * 1.3)} ${f(x + w * 0.05)} ${f(y + ht * 0.9)}Q${f(x - w * 0.1)} ${f(y + ht * 1.2)} ${f(x - w * 0.22)} ${f(y + ht * 0.85)}Q${f(x - w * 0.38)} ${f(y + ht * 1.15)} ${f(x - w * 0.5)} ${f(y + ht * 0.7)}Z`, c.vg(MOSS, 0.3, -0.2), 2.4);
  }
  /* 아치 문 */
  const archDoor = (c, x, yb, w, ht, col) => c.p(`M${f(x - w / 2)} ${f(yb)}V${f(yb - ht + w / 2)}A${f(w / 2)} ${f(w / 2)} 0 0 1 ${f(x + w / 2)} ${f(yb - ht + w / 2)}V${f(yb)}Z`, c.vg(col, 0.15, -0.3), 2.6);
  /* 작은 돌 골렘 — 발 (x,y), 크기 k */
  function golem(c, x, y, k, eye) {
    return c.e(x, y - 9 * k, 9 * k, 9 * k, c.sg(M.rough), 2.4) + c.ci(x, y - 21 * k, 6 * k, c.sg(M.rough), 2.4) +
      c.p(`M${f(x - 6 * k)} ${f(y - 24 * k)}Q${f(x)} ${f(y - 30 * k)} ${f(x + 6 * k)} ${f(y - 24 * k)}Q${f(x)} ${f(y - 26 * k)} ${f(x - 6 * k)} ${f(y - 24 * k)}Z`, MOSS, 1.6) +
      c.ci(x - 2.2 * k, y - 21 * k, 1.4 * k, eye, 0) + c.ci(x + 2.2 * k, y - 21 * k, 1.4 * k, eye, 0);
  }
  T.stone_barracks = {
    muzzle: [[50, 60], [50, 50], [50, 44], [50, 36], [50, 40]],
    draw(c, v) {
      const h = c.h;
      const E = c.E;
      const st = STONE.earth;
      if (v === 1) {
        let o = plat(c, 1);
        o += dome(c, 50, 104, 34, 48, c.sg(M.rough));
        o += c.ln('M26 86Q34 80 30 70M70 88Q66 78 72 70M40 66L46 72', h.shade(M.rough, -0.4), 1.6);
        o += mossCap(c, 50, 58, 44, 14);
        o += archDoor(c, 50, 106, 18, 24, M.wood) + c.ln('M47 88V106M53 88V106', M.woodD, 1.4);
        o += c.ci(30, 104, 5, c.sg(M.rough), 2.2) + c.ci(72, 106, 4, c.sg(M.rough), 2);
        return o;
      }
      if (v === 2 || v === 3) {
        const L3 = v === 3;
        let o = plat(c, v, { stone: st });
        if (L3) o += aura(c, 50, 70, 20, 18, E.color, 0.55);
        if (!L3) o += flag(c, 64, 58, 26, E.color, 1, 14);
        o += cyl(c, 50, 92, 104, 37, 11, c.cg(h.shade(st, -0.1)), null);
        o += c.ln(`${vseam(50, 92, 104, 37, 11, -60)}${vseam(50, 92, 104, 37, 11, -20)}${vseam(50, 92, 104, 37, 11, 20)}${vseam(50, 92, 104, 37, 11, 60)}`, h.shade(st, -0.45), 1.5);
        o += dome(c, 50, 94, 34, 44, c.sg(st));
        o += c.ln('M18 80Q50 90 82 80M24 66Q50 74 76 66M34 54Q50 58 66 54M36 66V82M64 66V82M28 82V92M72 82V92M48 56V66', h.shade(st, -0.38), 1.5);
        o += mossCap(c, 50, 50, 46, 14);
        o += archDoor(c, 50, 106, 24, 32, h.shade(st, 0.25)) + archDoor(c, 50, 106, 16, 26, M.wood) + c.ln('M48 84V106M52 84V106', M.woodD, 1.4);
        if (L3) {
          o += c.ln('M42 92H58M42 99H58', M.gold, 2);
          o += crystal(c, 50, 70, 10, 15, E.color, 2.2);
          o += flag(c, 70, 52, 30, E.color, 1, 14);
          o += golem(c, 22, 112, 0.9, '#d4ff8a');
        }
        return o;
      }
      if (v === 'A') {
        // 화강암 수호병 — 두 망루가 있는 성채, 큰 방패
        const gs = '#a3a08c';
        let o = plat(c, 4, { stone: '#8f8e78' });
        o += c.p('M22 100V46H78V100Q50 108 22 100Z', c.cg(gs), 3);
        o += c.p('M20 48V38H28V43H36V38H44V43H56V38H64V43H72V38H80V48Z', c.cg(h.shade(gs, 0.08)), 2.8);
        o += c.ln('M22 62H78M22 78H78M22 92H78M34 46V62M66 46V62M28 62V78M72 62V78M40 78V92M60 78V92', h.shade(gs, -0.38), 1.5);
        [20, 80].forEach((x) => {
          o += cyl(c, x, 34, 100, 11, 3.3, c.cg(gs), null);
          o += c.ln(`${ring(x, 54, 11, 3.3)}${ring(x, 76, 11, 3.3)}`, h.shade(gs, -0.38), 1.5);
          o += c.p(`M${x - 13} 36V24H${x - 7}V29H${x - 3}V24H${x + 3}V29H${x + 7}V24H${x + 13}V36Z`, c.cg(h.shade(gs, 0.1)), 2.6);
          o += c.e(x, 36, 13, 3.6, 'none', 2.4);
        });
        o += archDoor(c, 50, 104, 18, 20, M.woodD);
        o += c.p('M50 50C58 53 64 53 66 52V66C66 76 58 82 50 86C42 82 34 76 34 66V52C36 53 42 53 50 50Z', c.vg(MOSS, 0.3, -0.25), 3);
        o += c.p('M40 74L47 62L51 68L54 64L60 74Z', c.vg(E.light, 0.2, -0.1), 2);
        o += flag(c, 80, 26, 18, E.color, 1, 14);
        return o;
      }
      // 'B' 흑요석 검사 — 날카로운 흑요석 가시 막사, 엇갈린 칼
      const ob = '#3e3a46';
      let o = plat(c, 4, { stone: '#55524a', trim: E.color });
      o += aura(c, 50, 50, 40, 40, E.color, 0.35);
      const sp = (x, yt, yb, w) => shard(c, x, yt, yb, w, '#4d4858', 2.6);
      o += sp(22, 30, 80, 14) + sp(78, 26, 80, 15) + sp(36, 14, 70, 14) + sp(64, 12, 70, 14);
      o += c.p('M16 100L20 70L34 54L50 48L66 54L80 70L84 100Q50 110 16 100Z', c.vg(ob, 0.25, -0.2), 3);
      o += c.ln('M20 70L36 72L50 62L64 72L80 70M36 72L34 100M64 72L66 100M50 62V48', E.color, 1.8, 0.8);
      o += sp(50, 4, 56, 16);
      o += archDoor(c, 50, 104, 18, 24, '#1e1a24') + c.ci(46, 90, 1.8, E.light, 0) + c.ci(54, 90, 1.8, E.light, 0);
      o += c.ol('M34 64L66 92M66 64L34 92', M.silver, 2.6) + c.ol('M38 68L32 62M62 68L68 62', M.gold, 2.6);
      return o;
    },
  };

  /* ---------- 🪨 대지 망치 ---------- */
  /* 물레바퀴 */
  function wheel(c, x, y, R, col, hub, n = 8) {
    let d = '';
    let pad = '';
    for (let i = 0; i < n; i++) {
      const a = (i * Math.PI * 2) / n;
      d += `M${f(x)} ${f(y)}L${f(x + Math.cos(a) * R)} ${f(y + Math.sin(a) * R)}`;
      const px = x + Math.cos(a) * R;
      const py = y + Math.sin(a) * R;
      pad += `M${f(px)} ${f(py)}L${f(px + Math.cos(a + 1.2) * R * 0.28)} ${f(py + Math.sin(a + 1.2) * R * 0.28)}`;
    }
    return c.ci(x, y, R, 'none', 0, ` stroke="${OL}" stroke-width="${c.sw(7)}"`) + c.ci(x, y, R, 'none', 0, ` stroke="${col}" stroke-width="${c.sw(4)}"`) +
      c.ol(d, c.h.shade(col, -0.15), 2.4) + c.ol(pad, col, 3) + c.ci(x, y, R * 0.2, c.sg(hub), 2.4);
  }
  /* 망치 머리(회전) — 중심 (x,y), 각 ang */
  function hammerHead(c, x, y, w, ht, ang, col, o = {}) {
    let b = c.r(x - w / 2, y - ht / 2, w, ht, c.vg(col, 0.3, -0.3), 3, 3);
    if (o.bands) b += c.r(x - w / 2 - 1, y - ht / 2 - 1, 6, ht + 2, c.vg(o.bands, 0.35, -0.3), 1.5, 2.4) + c.r(x + w / 2 - 5, y - ht / 2 - 1, 6, ht + 2, c.vg(o.bands, 0.35, -0.3), 1.5, 2.4);
    if (o.moss) b += c.p(`M${f(x - w * 0.3)} ${f(y - ht / 2)}Q${f(x)} ${f(y - ht / 2 - 4)} ${f(x + w * 0.3)} ${f(y - ht / 2)}Q${f(x + w * 0.1)} ${f(y - ht * 0.15)} ${f(x - w * 0.05)} ${f(y - ht / 2 + 3)}Q${f(x - w * 0.2)} ${f(y - ht * 0.2)} ${f(x - w * 0.3)} ${f(y - ht / 2)}Z`, MOSS, 1.8);
    if (o.rune) b += c.ln(`M${f(x - 4)} ${f(y + 3)}L${f(x)} ${f(y - 4)}L${f(x + 4)} ${f(y + 3)}M${f(x - 2)} ${f(y)}H${f(x + 2)}`, o.rune, 2);
    return `<g transform="rotate(${f(ang)} ${f(x)} ${f(y)})">${b}</g>`;
  }
  T.quake_hammer = {
    muzzle: [[76, 104], [78, 104], [78, 104], [50, 104], [76, 104]],
    draw(c, v) {
      const h = c.h;
      const E = c.E;
      const st = STONE.earth;
      if (v === 1 || v === 2 || v === 3) {
        const L = v;
        let o = plat(c, v, { stone: st });
        if (L === 3) o += aura(c, 76, 34, 22, 20, E.color, 0.5);
        o += c.e(76, 102, 12, 4, c.vg(h.shade(st, -0.1)), 2.4);
        o += wheel(c, 38, 58, L === 1 ? 20 : L === 2 ? 23 : 25, M.wood, L === 3 ? E.color : M.iron);
        o += c.ol('M38 58L76 34', L === 1 ? M.wood : M.iron, 5);
        if (L === 1) o += c.ol('M22 106L38 56L54 106', M.wood, 5) + c.ol('M28 90H48', M.wood, 3.4);
        else {
          o += c.r(20, 60, 11, 46, c.cg(st), 2, 3) + c.r(45, 60, 11, 46, c.cg(st), 2, 3) + c.r(18, 52, 40, 9, c.vg(h.shade(st, 0.1)), 2, 3);
          o += c.ln('M20 76H31M45 76H56M20 92H31M45 92H56', h.shade(st, -0.38), 1.5);
          if (L === 3) o += c.r(18, 82, 15, 4, c.vg(M.gold, 0.35, -0.3), 1, 2) + c.r(43, 82, 15, 4, c.vg(M.gold, 0.35, -0.3), 1, 2);
        }
        o += c.ci(38, 58, 4, c.sg(L === 3 ? E.color : M.ironL), 2.2);
        o += hammerHead(c, 78, 32, L === 1 ? 26 : 30, L === 1 ? 18 : 20, -32, L === 1 ? M.rough : st, { moss: true, bands: L >= 2 ? (L === 3 ? M.gold : M.iron) : null, rune: L === 3 ? E.light : null });
        if (L === 3) o += flag(c, 22, 52, 24, E.color, -1, 12);
        return o;
      }
      if (v === 'A') {
        // 지진 망치 — 높이 치켜든 거대한 쌍머리 망치
        let o = plat(c, 4, { stone: '#8f8e78' });
        o += aura(c, 50, 22, 40, 22, E.color, 0.45);
        o += wheel(c, 50, 72, 24, M.wood, E.color);
        o += c.r(16, 50, 12, 52, c.cg(STONE.earth), 2, 3) + c.r(72, 50, 12, 52, c.cg(STONE.earth), 2, 3);
        o += c.r(14, 44, 16, 8, c.vg(M.gold, 0.35, -0.3), 2, 2.6) + c.r(70, 44, 16, 8, c.vg(M.gold, 0.35, -0.3), 2, 2.6);
        o += c.ol('M28 70H72', M.iron, 4);
        o += c.r(45, 24, 10, 50, c.cg(M.iron), 2, 3);
        o += hammerHead(c, 50, 22, 72, 26, 0, '#8a8670', { bands: M.gold });
        o += c.ln('M30 14L36 22L32 30M64 12L68 20L64 28M48 12L52 20', E.color, 2.4);
        o += c.ci(50, 72, 5, c.sg(E.color), 2.4);
        return o;
      }
      // 'B' 가시 대지 — 가시 철퇴 + 받침을 둘러싼 가시덤불
      let o = plat(c, 4, { stone: '#8f8e78' });
      o += wheel(c, 38, 60, 22, M.wood, M.iron);
      o += c.ol('M38 60L70 40', M.woodD, 5.5);
      o += c.r(22, 62, 11, 40, c.cg(STONE.earth), 2, 3) + c.r(43, 62, 11, 40, c.cg(STONE.earth), 2, 3) + c.r(20, 54, 36, 9, c.vg(STONE.earth), 2, 3);
      o += c.ci(38, 60, 4, c.sg(M.ironL), 2.2);
      // 철퇴 머리
      let sp = '';
      for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4 + 0.3; sp += `M${f(72 + Math.cos(a - 0.25) * 12)} ${f(36 + Math.sin(a - 0.25) * 12)}L${f(72 + Math.cos(a) * 20)} ${f(36 + Math.sin(a) * 20)}L${f(72 + Math.cos(a + 0.25) * 12)} ${f(36 + Math.sin(a + 0.25) * 12)}Z`; }
      o += c.p(sp, c.vg('#d8d0b0', 0.2, -0.2), 2.2) + c.ci(72, 36, 14, c.sg('#8a8670'), 3) + c.p('M64 30Q72 24 80 30Q74 34 72 32Q68 36 64 30Z', MOSS, 1.8);
      // 가시덤불(앞)
      const th = (x, y, k) => c.p(`M${f(x - 7 * k)} ${f(y)}L${f(x - 2 * k)} ${f(y - 16 * k)}L${f(x + 1 * k)} ${f(y - 4 * k)}L${f(x + 5 * k)} ${f(y - 12 * k)}L${f(x + 8 * k)} ${f(y)}Z`, c.vg('#7a9a3a', 0.25, -0.3), 2.2);
      o += th(10, 102, 1) + th(22, 110, 1.1) + th(40, 114, 1) + th(60, 114, 1.05) + th(78, 110, 1.1) + th(90, 102, 1);
      o += c.ln('M6 100Q30 116 50 112Q70 116 94 100', '#5a7a2a', 3, 0.9);
      return o;
    },
  };

  /* ---------- 🪨 수정 광산 ---------- */
  /* 기운 결정 */
  const tcrys = (c, x, y, w, ht, ang, col, w0 = 2.6) => `<g transform="rotate(${ang} ${x} ${y + ht / 2})">${crystal(c, x, y, w, ht, col, w0)}</g>`;
  /* 돌무더기 */
  const mound = (c, x1, x2, yb, ht, col) => {
    const w = x2 - x1;
    return c.p(`M${x1} ${yb}C${f(x1 - 2)} ${f(yb - ht * 0.6)} ${f(x1 + w * 0.15)} ${f(yb - ht)} ${f(x1 + w * 0.35)} ${f(yb - ht * 0.95)}C${f(x1 + w * 0.5)} ${f(yb - ht * 1.1)} ${f(x1 + w * 0.75)} ${f(yb - ht * 1.05)} ${f(x1 + w * 0.85)} ${f(yb - ht * 0.7)}C${f(x2 + 2)} ${f(yb - ht * 0.5)} ${f(x2 + 2)} ${f(yb - ht * 0.2)} ${x2} ${yb}Q${f(x1 + w / 2)} ${f(yb + 7)} ${x1} ${yb}Z`, c.sg(col), 3);
  };
  function cart(c, x, y, col) {
    return tcrys(c, x - 4, y - 18, 7, 12, -15, col, 2) + tcrys(c, x + 4, y - 19, 8, 13, 12, col, 2) +
      c.p(`M${x - 12} ${y - 14}H${x + 12}L${x + 9} ${y - 2}H${x - 9}Z`, c.vg(M.wood, 0.3, -0.25), 2.4) + c.ln(`M${x - 11} ${y - 9}H${x + 11}`, M.woodD, 1.4) +
      c.ci(x - 6, y, 3.6, c.sg(M.iron), 2) + c.ci(x + 6, y, 3.6, c.sg(M.iron), 2);
  }
  T.crystal_mine = {
    muzzle: [[50, 52], [52, 40], [52, 30], [50, 16], [56, 16]],
    draw(c, v) {
      const h = c.h;
      const E = c.E;
      const st = STONE.earth;
      if (v === 1) {
        let o = plat(c, 1);
        o += mound(c, 16, 70, 104, 30, M.rough);
        o += tcrys(c, 32, 58, 12, 22, -18, E.color) + tcrys(c, 60, 66, 10, 18, 20, E.color) + crystal(c, 46, 52, 16, 32, E.color);
        o += cart(c, 74, 108, E.color);
        o += spark(c, 56, 44, 3.5, M.gold);
        return o;
      }
      if (v === 2 || v === 3) {
        const L3 = v === 3;
        let o = plat(c, v, { stone: st });
        if (L3) o += aura(c, 50, 46, 36, 26, E.color, 0.5);
        o += mound(c, 12, 88, 104, 44, h.shade(st, -0.1));
        o += tcrys(c, 26, 54, 13, 24, -22, E.color) + tcrys(c, 74, 52, 13, 24, 22, E.color) + crystal(c, 52, L3 ? 34 : 40, L3 ? 18 : 16, L3 ? 34 : 30, E.color);
        if (L3) o += tcrys(c, 38, 46, 10, 18, -8, E.light) + tcrys(c, 64, 44, 9, 16, 10, E.light);
        // 갱도 입구
        o += c.p('M36 104V74Q50 66 64 74V104Z', '#2a2620', 2.6);
        o += c.ol('M38 104V70M62 104V70', L3 ? M.wood : M.wood, 4) + c.ol('M33 70H67', M.wood, 4.4);
        if (L3) {
          o += c.r(31, 67, 38, 5, c.vg(M.gold, 0.35, -0.3), 1, 2.2);
          o += c.ol('M56 72V78', M.iron, 1.4) + c.ci(56, 81, 3.6, c.sg('#ffd25a'), 1.8);
        }
        o += c.ln('M44 112L48 96M56 112L52 96', M.iron, 2);
        o += cart(c, 50, 104, E.color);
        o += spark(c, 30, 40, 3.5, M.gold) + spark(c, 72, 36, 3, M.gold);
        return o;
      }
      if (v === 'A') {
        // 깊은 광맥 — 깊은 갱도 위 높은 권양탑, 커다란 결정
        let o = plat(c, 4, { stone: '#8f8e78' });
        o += aura(c, 50, 70, 46, 30, E.color, 0.5);
        o += c.ol('M24 98L44 14M76 98L56 14', M.wood, 5) + c.ol('M32 66H68M38 40H62', M.wood, 3.6) + c.ol('M30 80L62 40M70 80L38 40', M.woodD, 2.4);
        o += wheel(c, 50, 16, 11, M.ironL, M.gold, 6);
        o += c.ol('M56 18V76', '#d9cfa8', 1.6);
        o += c.e(50, 92, 22, 7, '#221e1a', 3);
        o += tcrys(c, 20, 72, 18, 38, -18, E.color, 3) + tcrys(c, 80, 70, 18, 38, 18, E.color, 3);
        o += tcrys(c, 33, 84, 13, 24, -8, E.light) + tcrys(c, 67, 84, 13, 24, 10, E.light);
        o += c.p('M50 74H62L60 82H52Z', c.vg(M.wood), 2);
        o += spark(c, 30, 30, 4, M.gold);
        return o;
      }
      // 'B' 보석 세공소 — 지붕 위 커다란 세공 보석
      let o = plat(c, 4, { stone: '#8f8e78', trim: M.gold });
      o += aura(c, 50, 22, 26, 22, E.color, 0.55);
      o += house(c, 20, 80, 66, 46, 100, c.vg(h.shade(STONE.earth, 0.15), 0.25, -0.2), '#5f8a3a', 12);
      o += c.ln('M20 78H80M20 90H80M32 66V78M68 66V78M28 78V90M72 78V90', h.shade(STONE.earth, -0.35), 1.4);
      o += c.p('M42 100V84H58V100Z', c.vg(M.woodD, 0.2, -0.2), 2.4);
      o += c.r(24, 72, 14, 12, c.vg('#fff8dc', 0.2, -0.1), 1, 2.4) + c.r(62, 72, 14, 12, c.vg('#fff8dc', 0.2, -0.1), 1, 2.4);
      o += c.p('M28 82L31 76L34 82ZM66 82L69 75L72 82Z', E.color, 1.4);
      o += c.ol('M50 34V44', M.gold, 2.4);
      // 세공 보석
      o += c.p('M34 22L42 12H58L66 22L50 40Z', c.vg(E.color, 0.45, -0.25), 3) + c.ln('M34 22H66M42 12L46 22L50 40L54 22L58 12', h.shade(E.color, -0.35), 1.6) + c.p('M42 12L46 22H36Z', '#fff', 0, ' opacity="0.6"');
      o += c.ci(84, 102, 4, c.sg(M.gold), 2) + c.ci(90, 98, 4, c.sg(M.gold), 2) + c.ci(87, 94, 4, c.sg(M.gold), 2);
      o += spark(c, 70, 12, 4, '#fff') + spark(c, 28, 30, 3, M.gold);
      return o;
    },
  };

  /* ---------- ✨ 햇살 렌즈 ---------- */
  /* 렌즈 — 중심 (x,y), 반지름 r, 테 색 */
  function lens(c, x, y, r, frame, ang = -18) {
    const g = c.def('lens', (id) => c.lgc(id, [[0, '#ffffff'], [0.45, '#d8f4ff'], [1, '#9fd8f0']], 'd'));
    const b = c.e(x, y, r * 0.78, r, 'none', 0, ` stroke="${OL}" stroke-width="${c.sw(r * 0.34 + 2.6)}"`) +
      c.e(x, y, r * 0.78, r, g, 0, ` stroke="${frame}" stroke-width="${c.sw(r * 0.34)}"`) +
      c.p(`M${f(x - r * 0.4)} ${f(y - r * 0.45)}Q${f(x - r * 0.2)} ${f(y - r * 0.7)} ${f(x + r * 0.05)} ${f(y - r * 0.7)}`, 'none', 0, ` stroke="#fff" stroke-width="${c.sw(2.4)}"`) +
      spark(c, x + r * 0.18, y + r * 0.2, r * 0.38, '#fff7c2');
    return `<g transform="rotate(${ang} ${x} ${y})">${b}</g>`;
  }
  T.sun_lens = {
    muzzle: [[50, 40], [50, 36], [50, 30], [62, 30], [50, 14]],
    draw(c, v) {
      const h = c.h;
      const E = c.E;
      const st = STONE.light;
      if (v === 1) {
        let o = plat(c, 1);
        o += c.ol('M38 104L46 90M62 104L54 90', M.wood, 3.4);
        o += c.r(45, 56, 10, 50, c.cg(M.wood), 2, 3);
        o += c.ol('M38 40Q38 58 50 58Q62 58 62 40', M.wood, 3.6);
        o += aura(c, 50, 40, 20, 20, E.color, 0.5);
        o += lens(c, 50, 40, 15, M.woodD);
        return o;
      }
      if (v === 2 || v === 3) {
        const L3 = v === 3;
        const ly = L3 ? 30 : 36;
        const lr = L3 ? 21 : 18;
        let o = plat(c, v, { stone: st });
        o += aura(c, 50, ly, lr + 12, lr + 12, E.color, L3 ? 0.7 : 0.5);
        if (L3) o += c.p(starPathS(50, ly, lr + 14, lr + 4, 8), E.light, 0, ' opacity="0.6"');
        o += frus(c, 50, 62, 104, 10, 16, c.cg(st), c.vg(h.shade(st, 0.2)));
        o += c.ln(`${ring(50, 76, 12, 3.6)}${ring(50, 90, 14, 4.2)}M47 64V76M53 78V90M47 92V104`, h.shade(st, -0.3), 1.5);
        if (L3) o += band(c, 50, 82, 86, 13, 3.9, c.vg(M.gold, 0.35, -0.25)) + band(c, 50, 66, 69, 11, 3.3, c.vg(M.gold, 0.35, -0.25));
        o += c.ol(`M${50 - lr * 0.95} ${ly}Q${50 - lr} ${ly + lr + 8} 50 ${ly + lr + 8}Q${50 + lr} ${ly + lr + 8} ${50 + lr * 0.95} ${ly}M50 ${ly + lr + 8}V64`, L3 ? M.gold : M.bronze, 3.6);
        o += lens(c, 50, ly, lr, L3 ? M.gold : M.bronze);
        if (L3) o += crystal(c, 50 - lr * 0.3, ly - lr - 6, 8, 12, E.color, 2);
        return o;
      }
      if (v === 'A') {
        // 태양 집광기 — 커다란 금빛 오목 접시와 초점 결정
        let o = plat(c, 4, { stone: '#d8cfb8', trim: M.gold });
        o += aura(c, 56, 38, 46, 40, E.color, 0.55);
        o += frus(c, 50, 70, 99, 11, 18, c.cg(STONE.light), null);
        o += c.ol('M38 70L44 58M62 70L56 58', M.gold, 4);
        const dg = c.def('dish', (id) => c.rgc(id, [[0, '#fffbe6'], [0.35, '#ffe48a'], [0.8, '#e0a830'], [1, '#a8741a']], 0.62, 0.58, 0.6));
        o += `<g transform="rotate(-28 46 40)">${c.e(46, 40, 40, 28, dg, 3.4)}${c.e(46, 40, 40, 28, 'none', 0, ` stroke="${M.gold}" stroke-width="${c.sw(3)}"`)}${c.ln('M10 40Q46 52 82 40M46 12Q58 40 46 68', '#c08a2a', 1.6, 0.7)}</g>`;
        o += c.ol('M30 22L62 30M70 58L62 30M40 64L62 30', M.gold, 2);
        o += crystal(c, 63, 28, 10, 16, '#fff3b0', 2.4) + spark(c, 63, 28, 9, '#fff');
        return o;
      }
      // 'B' 프리즘 탑 — 삼각 프리즘과 세 렌즈
      let o = plat(c, 4, { stone: '#d8cfb8', trim: M.gold });
      o += aura(c, 50, 28, 38, 28, E.color, 0.55);
      o += frus(c, 50, 52, 99, 12, 19, c.cg(STONE.light), null);
      o += c.ln(`${ring(50, 68, 14, 4.2)}${ring(50, 84, 16.5, 5)}M46 55V67M54 71V83M47 87V98`, h.shade(STONE.light, -0.3), 1.5);
      o += band(c, 50, 74, 78, 15, 4.5, c.vg(M.gold, 0.35, -0.25));
      o += c.ol('M38 54L16 40M62 54L84 40M50 52V44', M.gold, 3);
      o += lens(c, 14, 36, 9, M.gold, -10) + lens(c, 86, 36, 9, M.gold, 10);
      o += c.p('M50 4L74 46H26Z', c.vg('#e8faff', 0.3, -0.1), 3) + c.p('M50 4L74 46H58Z', '#bfe6f5', 0, ' opacity="0.8"');
      o += c.ln('M32 40L56 22', '#ff9a9a', 2, 0.8) + c.ln('M36 42L60 28', '#ffe48a', 2, 0.9) + c.ln('M40 44L64 34', '#9ad8ff', 2, 0.8);
      o += c.p('M50 4L74 46H26Z', 'none', 3);
      return o;
    },
  };
  /* 별(고정 소수) */
  function starPathS(cx, cy, r1, r2, n) { return RG.art._h.starPath(cx, cy, r1, r2, n); }

  /* ---------- ✨ 성소 ---------- */
  /* 작은 등불 — 바닥 (x,y), 크기 k */
  function lamp(c, x, y, k = 1) {
    return aura(c, x, y - 12 * k, 16 * k, 16 * k, c.E.color, 0.75) +
      c.p(`M${f(x - 8 * k)} ${f(y - 6 * k)}H${f(x + 8 * k)}Q${f(x + 7 * k)} ${f(y)} ${f(x)} ${f(y)}Q${f(x - 7 * k)} ${f(y)} ${f(x - 8 * k)} ${f(y - 6 * k)}Z`, c.vg(M.gold, 0.35, -0.3), 2.4) +
      c.p(`M${f(x)} ${f(y - 22 * k)}C${f(x + 6 * k)} ${f(y - 14 * k)} ${f(x + 5 * k)} ${f(y - 7 * k)} ${f(x)} ${f(y - 7 * k)}C${f(x - 5 * k)} ${f(y - 7 * k)} ${f(x - 6 * k)} ${f(y - 14 * k)} ${f(x)} ${f(y - 22 * k)}Z`, c.vg('#fff8dc', 0, -0.1), 2) +
      c.e(x, y - 11 * k, 2.2 * k, 3.2 * k, '#fff', 0);
  }
  /* 상자형 제단 */
  function altar(c, x1, x2, yt, yb, col, d = 7) {
    return c.p(`M${x1} ${yt}H${x2}V${yb}H${x1}Z`, c.vg(col, 0.15, -0.2), 3) + c.p(`M${x1 - 2} ${yt}L${x1 + 3} ${yt - d}H${x2 - 3}L${x2 + 2} ${yt}Z`, c.vg(c.h.shade(col, 0.25), 0.2, 0), 3);
  }
  T.sanctuary = {
    muzzle: [[50, 70], [50, 62], [50, 54], [50, 40], [50, 34]],
    draw(c, v) {
      const h = c.h;
      const E = c.E;
      const st = STONE.light;
      const ring0 = (rx, ry, a) => c.e(50, 104, rx, ry, 'none', 0, ` stroke="${E.color}" stroke-width="${c.sw(2.4)}" opacity="${a}"`);
      if (v === 1) {
        let o = plat(c, 1);
        o += aura(c, 50, 102, 40, 12, E.color, 0.6);
        o += c.ol('M26 106V70M74 106V70', M.wood, 3.4) + c.ol('M22 70H78', M.wood, 3.4);
        o += c.ol('M34 70V76M66 70V76', M.rope, 1.4) + c.ci(34, 79, 3, c.sg(E.color), 1.8) + c.ci(66, 79, 3, c.sg(E.color), 1.8);
        o += altar(c, 32, 68, 80, 106, st);
        o += c.p('M44 93L50 87L56 93L50 99Z', E.color, 1.6);
        o += lamp(c, 50, 75, 1.2);
        return o;
      }
      if (v === 2 || v === 3) {
        const L3 = v === 3;
        let o = plat(c, v, { stone: st });
        o += aura(c, 50, 102, 42, 13, E.color, 0.7) + ring0(36, 10.5, 0.8);
        o += c.r(18, 52, 11, 54, c.cg(st), 2, 3) + c.r(71, 52, 11, 54, c.cg(st), 2, 3);
        if (L3) o += c.r(16, 52, 15, 6, c.vg(M.gold, 0.35, -0.3), 1, 2.2) + c.r(69, 52, 15, 6, c.vg(M.gold, 0.35, -0.3), 1, 2.2);
        o += altar(c, 34, 66, 84, 106, st);
        o += c.p('M44 96L50 90L56 96L50 102Z', E.color, 1.6);
        o += lamp(c, 50, 80, L3 ? 1.25 : 1.1);
        o += c.p('M12 54L50 30L88 54Q50 58 12 54Z', c.vg(L3 ? '#f2e6c8' : st, 0.2, -0.2), 3);
        o += c.ol('M12 54L50 30L88 54', L3 ? M.gold : '#d8b46a', 3);
        if (L3) {
          o += aura(c, 50, 24, 14, 14, E.color, 0.8) + spark(c, 50, 24, 12, '#ffe48a', 2) + c.ci(50, 24, 4.5, c.sg('#fff3b0'), 1.8);
          o += ring0(42, 12.5, 0.6);
        } else o += c.ci(50, 28, 4, c.sg(M.gold), 2);
        return o;
      }
      if (v === 'A') {
        // 대성당 — 세 첨탑, 장미창
        const ws = '#eee8da';
        let o = plat(c, 4, { stone: '#d8cfb8', trim: M.gold });
        o += aura(c, 50, 54, 40, 40, E.color, 0.45);
        const spireT = (x, yt, w, yb) => cone(c, x, yb, w, yb - yt, '#6f8ab0', 0.28, false) + c.ci(x, yt - 2, 2.4, M.gold, 1.8);
        o += c.r(12, 46, 20, 56, c.cg(ws), 1, 3) + c.r(68, 46, 20, 56, c.cg(ws), 1, 3);
        o += spireT(22, 20, 24, 48) + spireT(78, 20, 24, 48);
        o += c.p('M30 102V40L50 26L70 40V102Q50 108 30 102Z', c.cg(ws), 3);
        o += spireT(50, 4, 22, 32);
        o += c.ln('M12 66H32M68 66H88M12 84H32M68 84H88', h.shade(ws, -0.25), 1.5);
        o += c.p('M18 64V56Q22 50 26 56V64ZM74 64V56Q78 50 82 56V64Z', c.vg('#ffd25a', 0.3, -0.2), 2);
        o += c.ci(50, 54, 11, c.sg('#ffe48a'), 3) + c.ln('M50 43V65M39 54H61M42 46L58 62M58 46L42 62', '#c08a2a', 1.6) + c.ci(50, 54, 3.5, '#fff', 1.6);
        o += c.p('M41 104V84Q50 72 59 84V104Z', c.vg('#ffd25a', 0.35, -0.3), 2.6);
        o += c.ln('M30 70H70', M.gold, 2.4);
        return o;
      }
      // 'B' 치유의 샘 — 둥근 샘과 층층 분수, 빛 구슬
      let o = plat(c, 4, { stone: '#d8cfb8', trim: '#7ad0a0' });
      o += aura(c, 50, 70, 46, 34, '#c8ffd8', 0.5);
      const water = c.def('wat', (id) => c.lgc(id, [[0, '#d6fbff'], [1, '#6cc8d8']]));
      o += cyl(c, 50, 84, 99, 40, 12, c.cg(STONE.light), c.vg(h.shade(STONE.light, 0.15)));
      o += band(c, 50, 88, 91, 40, 12, c.vg(M.gold, 0.35, -0.25));
      o += c.e(50, 84, 34, 9.5, water, 2.2) + c.e(50, 84, 22, 6, 'none', 0, ` stroke="#fff" stroke-width="${c.sw(1.6)}" opacity="0.8"`);
      o += c.r(45, 56, 10, 30, c.cg(STONE.light), 1, 2.6);
      o += c.ln('M34 60Q24 66 22 82M66 60Q76 66 78 82', '#ffffff', 5, 0.7) + c.ln('M34 60Q24 66 22 82M66 60Q76 66 78 82', '#8ad8e6', 2.4);
      o += cyl(c, 50, 54, 60, 18, 5.4, c.cg(STONE.light), water);
      o += c.r(46, 34, 8, 20, c.cg(STONE.light), 1, 2.4);
      o += orb(c, 50, 26, 9, E.color, 2.6) + spark(c, 50, 26, 5, '#fff');
      o += spark(c, 22, 50, 3.5, '#c8ffd8') + spark(c, 80, 44, 3, '#c8ffd8') + c.p('M70 72h4v-4h3v4h4v3h-4v4h-3v-4h-4z', '#7ad0a0', 1.4);
      return o;
    },
  };

  /* ---------- ✨ 광휘 탑 ---------- */
  /* 오벨리스크: 앞면 + 오른쪽 옆면 + 뾰족 머리 */
  function obelisk(c, x, yt, yb, wt, wb, col, cap = true) {
    const h = c.h;
    const sd = wb * 0.28;
    let o = c.p(poly([[x + wb / 2, yb], [x + wb / 2 + sd, yb - 3], [x + wt / 2 + sd * 0.7, yt - 2], [x + wt / 2, yt]]), c.vg(h.shade(col, -0.25), 0.1, -0.2), 3);
    o += c.p(poly([[x - wb / 2, yb], [x - wt / 2, yt], [x + wt / 2, yt], [x + wb / 2, yb]]), c.cg(col), 3);
    if (cap) {
      o += c.p(poly([[x + wt / 2, yt], [x + wt / 2 + sd * 0.7, yt - 2], [x + sd * 0.2, yt - wt * 1.1]]), h.shade(col, -0.2), 2.6);
      o += c.p(poly([[x - wt / 2, yt], [x + sd * 0.2, yt - wt * 1.1], [x + wt / 2, yt]]), c.vg(M.gold, 0.4, -0.2), 2.6);
    }
    return o;
  }
  T.radiance_spire = {
    muzzle: [[50, 42], [50, 32], [50, 24], [50, 31], [50, 26]],
    draw(c, v) {
      const h = c.h;
      const E = c.E;
      const ws = '#f2ede2';
      if (v === 1) {
        let o = plat(c, 1);
        o += obelisk(c, 50, 70, 106, 12, 20, '#ddd6c6');
        o += aura(c, 50, 42, 18, 18, E.color, 0.8);
        o += orb(c, 50, 42, 8, '#fff3b0', 2.6);
        return o;
      }
      if (v === 2 || v === 3) {
        const L3 = v === 3;
        let o = plat(c, v, { stone: STONE.light });
        const oy = L3 ? 24 : 32;
        o += aura(c, 50, oy, L3 ? 30 : 22, L3 ? 30 : 22, E.color, 0.8);
        if (L3) o += c.p(starPathS(50, oy, 26, 9, 8), E.light, 0, ' opacity="0.8"');
        if (L3) o += c.p('M40 70Q24 62 20 44Q30 54 40 56ZM64 70Q80 62 84 44Q74 54 64 56Z', c.vg(ws, 0.2, -0.2), 2.6) + c.ln('M22 47Q28 54 38 58M82 47Q76 54 66 58', M.gold, 2);
        o += obelisk(c, 50, L3 ? 52 : 58, 106, L3 ? 13 : 13, L3 ? 24 : 22, ws);
        o += c.ln(`M${L3 ? 42 : 43} ${L3 ? 78 : 80}H${L3 ? 58 : 57}`, M.gold, 2.6) + c.ln('M41 96H59', M.gold, 2.6);
        o += c.e(50, oy, 15, 4.5, 'none', 0, ` stroke="${M.gold}" stroke-width="${c.sw(2.2)}" opacity="0.9"`);
        o += orb(c, 50, oy, L3 ? 11 : 9.5, '#fff3b0', 2.8);
        return o;
      }
      if (v === 'A') {
        // 일출 탑 — 꼭대기에 커다란 햇살 원반
        let o = plat(c, 4, { stone: '#d8cfb8', trim: M.gold });
        o += aura(c, 50, 32, 44, 36, E.color, 0.65);
        o += obelisk(c, 50, 52, 101, 14, 26, ws, false);
        o += c.ln('M40 72H60M39 88H61', M.gold, 2.6);
        o += c.p(starPathS(50, 31, 28, 16, 12), c.vg(M.gold, 0.35, -0.2), 2.6);
        o += c.ci(50, 31, 14.5, c.sg('#ffe48a'), 3) + c.ci(50, 31, 7.5, '#fffbe6', 0);
        return o;
      }
      // 'B' 정화의 탑 — 엇갈린 두 고리 속 구슬, 떠도는 결정 조각
      let o = plat(c, 4, { stone: '#d8cfb8', trim: M.gold });
      o += aura(c, 50, 26, 34, 32, '#ffffff', 0.6);
      o += obelisk(c, 50, 54, 101, 14, 26, ws);
      o += c.ln('M40 76H60M39 90H61', M.gold, 2.6);
      const rg2 = (a) => `<g transform="rotate(${a} 50 26)">${c.e(50, 26, 26, 9, 'none', 0, ` stroke="${OL}" stroke-width="${c.sw(6)}"`)}${c.e(50, 26, 26, 9, 'none', 0, ` stroke="${M.gold}" stroke-width="${c.sw(3.4)}"`)}</g>`;
      o += rg2(35);
      o += orb(c, 50, 26, 11, '#ffffff', 2.8);
      o += rg2(-35);
      o += crystal(c, 18, 52, 7, 12, '#fffbe6', 2) + crystal(c, 82, 48, 7, 12, '#fffbe6', 2) + crystal(c, 26, 8, 6, 10, '#fffbe6', 2) + crystal(c, 76, 8, 6, 10, '#fffbe6', 2);
      return o;
    },
  };

  /* ---------- 🌑 저주 첨탑 ---------- */
  const DST = '#3d3348';
  /* 눈 보석 — 중심 (x,y), 너비 w */
  function eyeGem(c, x, y, w, glowA = 0.7) {
    const E = c.E;
    const hh = w * 0.42;
    return aura(c, x, y, w * 0.9, w * 0.7, E.color, glowA) +
      c.p(`M${f(x - w / 2)} ${f(y)}Q${f(x)} ${f(y - hh * 1.5)} ${f(x + w / 2)} ${f(y)}Q${f(x)} ${f(y + hh * 1.5)} ${f(x - w / 2)} ${f(y)}Z`, c.vg('#f6e8ff', 0.2, -0.2), 2.8) +
      c.ci(x, y, hh * 0.85, c.sg(E.color), 0) + c.e(x, y, hh * 0.22, hh * 0.7, '#1a0b1e', 0) + c.ci(x - hh * 0.3, y - hh * 0.35, hh * 0.2, '#fff', 0);
  }
  /* 룬 글자 */
  const rune = (c, x, y, k, i = 0) => {
    const d = [`M${x} ${y - 6 * k}V${y + 6 * k}M${x - 4 * k} ${y - 3 * k}L${x} ${y}L${x + 4 * k} ${y - 3 * k}`,
      `M${x - 4 * k} ${y - 6 * k}L${x + 4 * k} ${y}L${x - 4 * k} ${y + 6 * k}M${x + 4 * k} ${y - 6 * k}V${y + 6 * k}`,
      `M${x} ${y - 6 * k}L${x + 5 * k} ${y}L${x} ${y + 6 * k}L${x - 5 * k} ${y}Z`][i % 3];
    return c.ln(d, c.E.color, 4.2 * k, 0.45) + c.ln(d, c.E.light, 1.8 * k);
  };
  /* 뒤틀린 첨탑: 바닥 너비 bw, 꼭대기 (x, yt) */
  function jagSpire(c, yt, yb, bw, col) {
    const h = c.h;
    const L = (t) => yb - (yb - yt) * t;
    const pts = [[50 - bw / 2, yb], [50 - bw * 0.42, L(0.3)], [50 - bw * 0.48, L(0.38)], [50 - bw * 0.28, L(0.7)], [50 - bw * 0.16, L(0.85)], [52, yt],
      [50 + bw * 0.18, L(0.78)], [50 + bw * 0.3, L(0.62)], [50 + bw * 0.24, L(0.54)], [50 + bw * 0.44, L(0.25)], [50 + bw / 2, yb]];
    return c.p(`${poly(pts).slice(0, -1)}Q50 ${yb + bw * 0.18} ${50 - bw / 2} ${yb}Z`, c.cg(col), 3) +
      c.p(poly([[52, yt], [50 + bw * 0.18, L(0.78)], [50 + bw * 0.3, L(0.62)], [50 + bw * 0.24, L(0.54)], [50 + bw * 0.44, L(0.25)], [50 + bw / 2, yb], [52, yb + 3], [50, L(0.5)]]), h.shade(col, -0.35), 0, ' opacity="0.7"');
  }
  T.hex_spire = {
    muzzle: [[50, 30], [50, 22], [50, 16], [50, 26], [50, 30]],
    draw(c, v) {
      const h = c.h;
      const E = c.E;
      if (v === 1) {
        let o = plat(c, 1, { rough: '#6e6474' });
        o += jagSpire(c, 46, 106, 30, '#4a4054');
        o += rune(c, 48, 82, 1);
        o += eyeGem(c, 50, 30, 20);
        return o;
      }
      if (v === 2 || v === 3) {
        const L3 = v === 3;
        let o = plat(c, v, { stone: STONE.dark, trim: '#a89cc0' });
        o += shard(c, 26, 60, 104, 12, '#4a4054') + shard(c, 75, 56, 104, 12, '#4a4054');
        o += jagSpire(c, L3 ? 34 : 38, 106, L3 ? 36 : 34, DST);
        if (L3) o += c.ln('M37 88Q50 93 63 88M40 66Q50 70 60 66', OL, 5) + c.ln('M37 88Q50 93 63 88M40 66Q50 70 60 66', '#a89cc0', 2.6);
        o += rune(c, 46, 78, 1, 0) + rune(c, 54, 56, 0.85, 1);
        o += eyeGem(c, 50, L3 ? 16 : 22, L3 ? 26 : 22, L3 ? 0.85 : 0.7);
        if (L3) o += c.p(polyRot(20, 34, 6), c.vg('#4a4054'), 2.2) + rune(c, 20, 34, 0.5, 2) + c.p(polyRot(80, 30, 6), c.vg('#4a4054'), 2.2) + rune(c, 80, 30, 0.5, 1);
        return o;
      }
      if (v === 'A') {
        // 파멸 첨탑 — 거대한 뿔 둘, 커다란 눈
        let o = plat(c, 4, { stone: '#4a3f58', trim: E.color });
        o += aura(c, 50, 26, 34, 28, E.color, 0.55);
        o += c.p('M40 50C26 46 12 34 10 6C18 24 28 32 42 36Z', c.vg('#e8dcc8', 0.2, -0.35), 3) + c.p('M60 50C74 46 88 34 90 6C82 24 72 32 58 36Z', c.vg('#e8dcc8', 0.2, -0.35), 3);
        o += c.ln('M16 22Q20 30 26 34M84 22Q80 30 74 34', '#a8987e', 1.6);
        o += jagSpire(c, 32, 101, 40, DST);
        o += rune(c, 44, 80, 1.1, 0) + rune(c, 56, 62, 1, 2);
        o += eyeGem(c, 50, 26, 30, 0.85);
        return o;
      }
      // 'B' 역병 첨탑 — 뒤틀린 탑 위 부푼 구슬, 흘러내리는 독기
      let o = plat(c, 4, { stone: '#4a3f58', trim: E.color });
      o += aura(c, 50, 30, 36, 30, E.color, 0.5);
      o += jagSpire(c, 44, 101, 34, DST);
      o += rune(c, 46, 80, 1, 1);
      o += c.ci(50, 30, 19, c.sg('#5a2a62'), 3);
      o += c.ln('M38 24L44 30L40 38M58 18L56 28L62 34M48 40L52 44', E.color, 2.4);
      o += c.p('M34 38Q36 50 34 56Q38 52 38 42ZM62 42Q66 52 64 60Q68 54 66 40ZM48 48Q50 58 48 64Q52 60 52 48Z', c.vg(E.color, 0.2, -0.2), 2);
      o += c.ci(22, 30, 3.5, c.sg(E.color), 1.8) + c.ci(80, 22, 3, c.sg(E.color), 1.8) + c.ci(74, 46, 2.6, c.sg(E.color), 1.6) + c.ci(28, 12, 2.6, c.sg(E.color), 1.6);
      o += c.e(43, 22, 4, 2.6, '#fff', 0, ' opacity="0.5"');
      return o;
    },
  };
  function polyRot(x, y, r) { return RG.art._h.polyPath(x, y, r, 5, -80); }

  /* ---------- 🌑 공허 구체 ---------- */
  function voidBall(c, x, y, r) {
    const g = c.def('void', (id) => c.rgc(id, [[0, '#0a0410'], [0.6, '#1c0a24'], [0.86, '#6e2a72'], [1, '#e070d0']], 0.5, 0.5, 0.5));
    return c.ci(x, y, r, g, 3) + c.ln(`M${f(x - r * 0.5)} ${f(y + r * 0.1)}Q${f(x - r * 0.2)} ${f(y - r * 0.5)} ${f(x + r * 0.4)} ${f(y - r * 0.3)}M${f(x + r * 0.45)} ${f(y + r * 0.2)}Q${f(x)} ${f(y + r * 0.55)} ${f(x - r * 0.35)} ${f(y + r * 0.35)}`, c.E.color, 2, 0.8) +
      c.e(x - r * 0.38, y - r * 0.45, r * 0.22, r * 0.12, '#f2b8ea', 0, ' opacity="0.7"');
  }
  /* 돌손: 손바닥 중심 (x,y), 크기 k — back: 뒤 손가락, front: 손바닥 앞 */
  function handBack(c, x, y, k, col) {
    const P = (a, b) => `${f(x + a * k)} ${f(y + b * k)}`;
    return c.p(`M${P(-15, 2)}C${P(-22, -6)} ${P(-24, -20)} ${P(-17, -30)}C${P(-13, -26)} ${P(-13, -22)} ${P(-14, -16)}C${P(-12, -10)} ${P(-10, -6)} ${P(-8, -2)}Z`, c.cg(col), 2.6) +
      c.p(`M${P(15, 2)}C${P(22, -6)} ${P(24, -20)} ${P(17, -30)}C${P(13, -26)} ${P(13, -22)} ${P(14, -16)}C${P(12, -10)} ${P(10, -6)} ${P(8, -2)}Z`, c.cg(col), 2.6) +
      c.p(`M${P(-6, -2)}C${P(-9, -14)} ${P(-8, -26)} ${P(-4, -34)}C${P(-1, -30)} ${P(-2, -24)} ${P(-1, -16)}Z`, c.cg(c.h.shade(col, -0.15)), 2.4) +
      c.p(`M${P(6, -2)}C${P(9, -14)} ${P(8, -26)} ${P(4, -34)}C${P(1, -30)} ${P(2, -24)} ${P(1, -16)}Z`, c.cg(c.h.shade(col, -0.15)), 2.4);
  }
  function handFront(c, x, y, k, col, nails) {
    const P = (a, b) => `${f(x + a * k)} ${f(y + b * k)}`;
    let o = c.p(`M${P(-20, -2)}Q${P(-20, 14)} ${P(0, 15)}Q${P(20, 14)} ${P(20, -2)}Q${P(0, 6)} ${P(-20, -2)}Z`, c.cg(col), 3);
    o += c.ln(`M${P(-12, 8)}Q${P(-10, 4)} ${P(-6, 6)}M${P(12, 8)}Q${P(10, 4)} ${P(6, 6)}`, c.h.shade(col, -0.35), 1.5);
    if (nails) o += c.p(`M${P(-17, -30)}L${P(-19, -36)}L${P(-14, -31)}ZM${P(17, -30)}L${P(19, -36)}L${P(14, -31)}Z`, nails, 1.6);
    return o;
  }
  T.void_orb = {
    muzzle: [[50, 60], [50, 50], [50, 44], [50, 40], [50, 28]],
    draw(c, v) {
      const h = c.h;
      const E = c.E;
      if (v === 1 || v === 2 || v === 3) {
        const k = [0, 0.9, 1, 1.1][v];
        const hy = [0, 76, 70, 66][v];
        const col = v === 1 ? '#6e6474' : '#5a4e68';
        let o = plat(c, v, v === 1 ? { rough: '#6e6474' } : { stone: STONE.dark, trim: '#a89cc0' });
        o += aura(c, 50, hy - 18 * k, 26 * k, 26 * k, E.color, v === 3 ? 0.7 : 0.5);
        o += frus(c, 50, hy + 8, 105, 8 * k, 13 * k, c.cg(col), null);
        if (v >= 2) o += c.ln(`${ring(50, hy + 22, 9.5 * k, 2.9 * k)}M48 ${hy + 24}V${hy + 34}`, h.shade(col, -0.35), 1.5);
        if (v === 3) o += band(c, 50, hy + 12, hy + 17, 8.5 * k, 2.6 * k, c.vg('#a89cc0', 0.35, -0.25)) + band(c, 50, hy + 30, hy + 34, 10 * k, 3 * k, c.vg('#a89cc0', 0.35, -0.25));
        o += handBack(c, 50, hy, k, col);
        o += voidBall(c, 50, hy - 16 * k, 15 * k);
        o += handFront(c, 50, hy, k, col, v >= 2 ? E.light : null);
        if (v === 3) o += c.ci(22, hy - 30, 2.6, c.sg(E.color), 1.6) + c.ci(80, hy - 22, 3, c.sg(E.color), 1.6) + c.ci(72, hy - 44, 2.2, c.sg(E.color), 1.4);
        return o;
      }
      if (v === 'A') {
        // 블랙홀 — 구슬을 둘러싼 넓은 빛 고리
        let o = plat(c, 4, { stone: '#4a3f58', trim: E.color });
        o += aura(c, 50, 40, 46, 30, E.color, 0.55);
        const ringG = c.def('acc', (id) => c.lgc(id, [[0, '#f2b8ea'], [0.5, '#d14fc0'], [1, '#6e1f66']], 'h'));
        const disk = (back) => `<g transform="rotate(-12 50 40)">${back ? c.p('M6 40A44 12 0 0 1 94 40L80 40A30 7 0 0 0 20 40Z', ringG, 2.6) : c.p('M6 40A44 12 0 0 0 94 40L80 40A30 7 0 0 1 20 40Z', ringG, 2.6)}</g>`;
        o += frus(c, 50, 72, 101, 10, 16, c.cg('#5a4e68'), null);
        o += handBack(c, 50, 70, 1.05, '#5a4e68');
        o += disk(true);
        o += voidBall(c, 50, 40, 17);
        o += disk(false);
        o += handFront(c, 50, 70, 1.05, '#5a4e68', E.light);
        return o;
      }
      // 'B' 분열 구체 — 세 손가락 끝마다 작은 구슬
      let o = plat(c, 4, { stone: '#4a3f58', trim: E.color });
      o += aura(c, 50, 40, 40, 32, E.color, 0.55);
      const col = '#5a4e68';
      o += frus(c, 50, 74, 101, 10, 16, c.cg(col), null);
      o += c.p('M40 76C30 70 22 60 18 46L26 44C30 56 36 64 44 68ZM60 76C70 70 78 60 82 46L74 44C70 56 64 64 56 68ZM45 70C44 58 45 44 47 30H53C55 44 56 58 55 70Z', c.cg(col), 3);
      o += c.p('M34 80Q34 66 50 64Q66 66 66 80Q50 88 34 80Z', c.cg(col), 3);
      o += voidBall(c, 22, 36, 11) + voidBall(c, 78, 36, 11) + voidBall(c, 50, 20, 12);
      o += c.ln('M28 30Q50 8 72 30', E.color, 2, 0.6);
      return o;
    },
  };

  /* ---------- 🌑 그림자 덫 ---------- */
  /* A자 오두막: 꼭대기 (50, ya), 바닥 yb, 반너비 w */
  function aHut(c, ya, yb, w, wall, roof, edge) {
    const h = c.h;
    let o = c.p(poly([[50, ya], [50 + w, yb], [50 + w + 8, yb - 8], [58, ya - 8]]), c.vg(h.shade(roof, -0.2), 0.1, -0.2), 3);
    o += c.p(`M${50 - w} ${yb}L50 ${ya}L${50 + w} ${yb}Q50 ${yb + 6} ${50 - w} ${yb}Z`, c.vg(wall, 0.15, -0.25), 3);
    o += c.ln(`M${f(50 - w * 0.5)} ${f(yb + 2)}L${f(50 - w * 0.15)} ${f(ya + (yb - ya) * 0.3)}M${f(50 + w * 0.5)} ${f(yb + 2)}L${f(50 + w * 0.15)} ${f(ya + (yb - ya) * 0.3)}`, h.shade(wall, -0.35), 1.5);
    o += c.ol(`M${50 - w - 4} ${yb + 2}L50 ${ya - 4}L${50 + w + 4} ${yb + 2}`, edge, 4.5);
    return o;
  }
  const darkDoor = (c, x, yb, w, ht) => archDoor(c, x, yb, w, ht, '#160c1c') + c.ci(x - w * 0.18, yb - ht * 0.55, 1.8, c.E.light, 0) + c.ci(x + w * 0.18, yb - ht * 0.55, 1.8, c.E.light, 0);
  /* 쇠사슬 — (x1,y1)→(x2,y2), 처짐 sag */
  function chain(c, x1, y1, x2, y2, sag) {
    const d = `M${x1} ${y1}Q${f((x1 + x2) / 2)} ${f((y1 + y2) / 2 + sag)} ${x2} ${y2}`;
    return c.ln(d, OL, 6.4) + `<path d="${d}" fill="none" stroke="${M.ironL}" stroke-width="${c.sw(3.4)}" stroke-dasharray="${c.sw(4.5)} ${c.sw(2.5)}"/>`;
  }
  function bearTrap(c, x, y, k = 1) {
    const P = (a, b) => `${f(x + a * k)} ${f(y + b * k)}`;
    return c.p(`M${P(-8, 0)}Q${P(0, 6)} ${P(8, 0)}L${P(6, -3)}L${P(4, 0)}L${P(2, -3)}L${P(0, 0)}L${P(-2, -3)}L${P(-4, 0)}L${P(-6, -3)}Z`, c.vg(M.ironL, 0.3, -0.2), 2) +
      c.p(`M${P(-8, 2)}Q${P(0, -4)} ${P(8, 2)}L${P(6, 5)}L${P(4, 2)}L${P(2, 5)}L${P(0, 2)}L${P(-2, 5)}L${P(-4, 2)}L${P(-6, 5)}Z`, c.vg(M.iron, 0.3, -0.2), 2);
  }
  T.shadow_snare = {
    muzzle: [[50, 70], [50, 60], [50, 56], [50, 40], [50, 30]],
    draw(c, v) {
      const h = c.h;
      const E = c.E;
      const runeCircle = (x, y, r) => c.e(x, y, r, r * 0.3, 'none', 0, ` stroke="${E.color}" stroke-width="${c.sw(2.2)}" opacity="0.9"`) + c.ln(`M${x - r * 0.6} ${y}L${x} ${f(y - r * 0.2)}L${x + r * 0.6} ${y}L${x} ${f(y + r * 0.2)}Z`, E.color, 1.6, 0.9);
      if (v === 1) {
        let o = plat(c, 1);
        o += aHut(c, 54, 106, 28, M.plank, '#5a4a52', M.woodD);
        o += darkDoor(c, 50, 107, 16, 22);
        o += runeCircle(78, 109, 9);
        return o;
      }
      if (v === 2 || v === 3) {
        const L3 = v === 3;
        let o = plat(c, v, { stone: STONE.dark, trim: '#a89cc0' });
        if (L3) o += aura(c, 50, 70, 34, 30, E.color, 0.4);
        o += cyl(c, 50, 92, 104, 32, 9.6, c.cg(h.shade(STONE.dark, 0.1)), null);
        o += c.ln(`${vseam(50, 92, 104, 32, 9.6, -45)}${vseam(50, 92, 104, 32, 9.6, 0)}${vseam(50, 92, 104, 32, 9.6, 45)}`, h.shade(STONE.dark, -0.4), 1.5);
        o += aHut(c, 44, 96, 30, '#6a5560', '#4a3d58', L3 ? '#a89cc0' : M.woodD);
        o += darkDoor(c, 50, 97, 16, 24);
        o += c.ol('M50 40V36', M.iron, 1.6) + c.ci(50, 32, 4, c.sg(E.color), 2);
        if (L3) {
          o += rune(c, 50, 62, 0.8, 2);
          // 그림자 사냥꾼
          o += c.p('M80 112C78 98 76 86 80 78C82 72 90 72 92 78C96 86 94 98 92 112Z', c.vg('#2a1e34', 0.2, -0.2), 2.6) +
            c.p('M79 80C78 70 82 64 86 62C90 64 94 70 93 80Q86 76 79 80Z', '#1e1428', 2.4) + c.ci(84, 74, 1.4, E.light, 0) + c.ci(88, 74, 1.4, E.light, 0);
          o += runeCircle(20, 108, 9);
        } else o += c.ol('M78 72V80', M.iron, 1.4) + bearTrap(c, 78, 84, 0.9);
        return o;
      }
      if (v === 'A') {
        // 속박의 사슬 — 오두막 뒤 높은 기둥과 늘어진 사슬
        let o = plat(c, 4, { stone: '#4a3f58', trim: E.color });
        o += aura(c, 50, 30, 30, 30, E.color, 0.4);
        o += c.r(44, 4, 12, 70, c.cg('#4a3d58'), 2, 3) + c.p('M40 8H60L56 2H44Z', c.vg('#a89cc0'), 2.4);
        o += rune(c, 50, 22, 0.8, 0);
        o += chain(c, 46, 12, 12, 94, 14) + chain(c, 54, 12, 88, 94, 14) + chain(c, 46, 30, 22, 98, 6) + chain(c, 54, 30, 78, 98, 6);
        o += c.ci(50, 34, 6, 'none', 0, ` stroke="${OL}" stroke-width="5"`) + c.ci(50, 34, 6, 'none', 0, ` stroke="${M.ironL}" stroke-width="2.6"`);
        o += cyl(c, 50, 90, 99, 32, 9.6, c.cg(h.shade(STONE.dark, 0.1)), null);
        o += aHut(c, 50, 94, 30, '#6a5560', '#4a3d58', '#a89cc0');
        o += darkDoor(c, 50, 95, 16, 24);
        o += runeCircle(18, 104, 9) + runeCircle(82, 104, 9);
        return o;
      }
      // 'B' 그림자 칼날 — 지붕 위 엇갈린 큰 낫 날
      let o = plat(c, 4, { stone: '#4a3f58', trim: E.color });
      o += aura(c, 50, 28, 40, 26, E.color, 0.45);
      const blade = (s) => c.p(s > 0 ? 'M50 56L80 10C90 18 92 30 88 40C84 30 80 26 76 26L54 60Z' : 'M50 56L20 10C10 18 8 30 12 40C16 30 20 26 24 26L46 60Z', c.vg(M.silver, 0.4, -0.2), 2.8);
      o += blade(1) + blade(-1);
      o += c.ln('M80 12C88 20 90 30 88 38M20 12C12 20 10 30 12 38', E.color, 2.2);
      o += cyl(c, 50, 90, 99, 32, 9.6, c.cg(h.shade(STONE.dark, 0.1)), null);
      o += aHut(c, 46, 94, 32, '#6a5560', '#3a2e48', '#a89cc0');
      o += c.p('M40 64L36 56L44 60ZM60 64L64 56L56 60Z', c.vg(M.silver), 1.8);
      o += darkDoor(c, 50, 95, 16, 24);
      o += c.ln('M24 106Q36 98 48 106M56 106Q66 98 78 104', E.color, 2.4, 0.8);
      return o;
    },
  };

})();
