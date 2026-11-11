'use strict';

/* =========================================================
 * 탑 그림 — 🐉 흑룡의 둥지 `shadow_dragon` (신화, 2026-11-11). 설계: docs/design/towers.md D6
 *  검은 바위 둥지 위의 흑룡(보랏빛 눈·뿔·박쥐 날개). 불길은 효과가 그림(일직선).
 *  Lv1: 알을 깨고 나오는 새끼 · Lv2: 바위 위의 젊은 흑룡(날개 접음) · Lv3: 날개를 편 흑룡
 *  idle: 입 다묾 · aim: 입에 보랏빛 불이 모임 · fire: 불길을 뿜음(짧은 불꽃 + 섬광)
 *  4A 멸망의 숨결: 거대한 흑룡 · 4B 쌍두 흑룡: 머리 둘
 * ========================================================= */
(() => {
  const { f, M, STONE, fine, poly, cyl, ring, aura, spark, masonry, metalBand, gem } = RG.art._tw;
  const A = RG.art._tw.A;
  const { footShade, motion, OP } = A;
  const { GOLD, legendPlat } = RG.art._tw.L;
  const T = RG.art._tw.T;
  const SCALE = '#4a3e5e';
  const BELLY = '#8a7aa2';
  const MEMBRANE = '#6a5288';
  const GLOW = '#c890ff';
  const HORN = '#d8d0e0';
  const BLACKROCK = '#4a4258';

  /* ---------- 부품 ---------- */
  /** 머리(오른쪽을 봄) — 목 끝 (x,y), 크기 k, 입 벌림 open(0~1) */
  function head(c, x, y, k, pose, dir = 1) {
    const h = c.h;
    const open = pose === 'idle' ? 0 : pose === 'aim' ? 0.45 : 1;
    const P = (u, v) => `${f(x + dir * u * k)} ${f(y + v * k)}`;
    let s = '';
    // 뿔 둘
    s += c.p(`M${P(-3, -4)}Q${P(-9, -11)} ${P(-14, -10)}Q${P(-8, -8)} ${P(-5, -2)}Z`, c.vg(HORN, 0.3, -0.25), 1.6);
    s += c.p(`M${P(0, -5)}Q${P(-3, -13)} ${P(-8, -15)}Q${P(-3, -10)} ${P(-1, -3)}Z`, c.vg(HORN, 0.3, -0.25), 1.6);
    // 아래턱
    s += c.p(`M${P(-3, 2)}L${P(13, 3 + open * 4)}L${P(12, 5.5 + open * 5)}L${P(-2, 6)}Z`, c.vg(h.shade(SCALE, 0.1), 0.2, -0.3), 1.8);
    if (open > 0) {
      s += c.p(`M${P(0, 1.5)}L${P(12, 2.5)}L${P(12, 3 + open * 4)}L${P(0, 4)}Z`, '#2a0f30', 0);
      s += aura(c, x + dir * 14 * k, y + 2.5 * k, (5 + 5 * open) * k, (4 + 4 * open) * k, GLOW, 0.5 + 0.4 * open);
      s += c.e(x + dir * 9 * k, y + 2.8 * k, 3 * k, 1.2 * k * (0.5 + open), '#e0b8ff', 0, ' opacity="0.9"');
    }
    // 위턱·머리
    s += c.p(`M${P(-6, -4)}Q${P(-2, -8)} ${P(5, -6)}L${P(15, -2)}Q${P(17, 0)} ${P(14, 1.5)}L${P(0, 2)}Q${P(-6, 2)} ${P(-6, -4)}Z`, c.vg(SCALE, 0.3, -0.25), 2);
    s += c.ln(`M${P(3, -5.5)}L${P(13, -1.8)}`, h.shade(SCALE, 0.45), 1, 0.7);
    s += c.ci(x + dir * 14 * k, y - 0.6 * k, 0.6 * k, '#1c1426', 0); // 콧구멍
    // 눈
    s += c.e(x + dir * 3.4 * k, y - 3 * k, 1.8 * k, 1.1 * k, GLOW, 0) + c.e(x + dir * 3.4 * k, y - 3 * k, 0.5 * k, 1 * k, '#1c1426', 0);
    s += c.ci(x + dir * 3.4 * k, y - 3 * k, 2.8 * k, c.ag(GLOW, 0.6), 0);
    if (pose === 'fire') {
      // 짧은 불꽃(입에서) — 진짜 불길은 효과가 그림
      s += c.p(`M${P(13, 1)}Q${P(22, -4)} ${P(32, 0)}Q${P(24, 3)} ${P(32, 7)}Q${P(22, 8)} ${P(13, 5)}Z`, c.vg('#9a4ae8', 0.3, -0.2), 1.6);
      s += c.p(`M${P(14, 2)}Q${P(21, 0)} ${P(27, 2.5)}Q${P(21, 5)} ${P(14, 4)}Z`, '#f0dcff', 0);
      s += spark(c, x + dir * 15 * k, y + 2.5 * k, 4 * k, '#ffffff', 0);
    }
    return s;
  }
  /** 박쥐 날개 — 어깨 (x,y), 크기 k, 펼침 spread(0~1), 방향 d(-1 뒤로/왼쪽, 1 앞/오른쪽), 위로 올림 lift */
  function wing(c, x, y, k, spread, d, col, lift = 0) {
    const h = c.h;
    const P = (u, v) => `${f(x + d * u * k)} ${f(y + v * k)}`;
    const sp = 0.45 + 0.55 * spread;
    const tips = [[-4 * sp, -26 * sp - lift], [10 * sp, -30 * sp - lift], [22 * sp, -22 * sp - lift * 0.7], [28 * sp, -8 * sp]];
    let path = `M${P(0, 0)}L${P(tips[0][0], tips[0][1])}`;
    for (let i = 0; i < tips.length; i++) {
      const [tx, ty] = tips[i];
      path += `L${P(tx, ty)}`;
      const nx = i < tips.length - 1 ? tips[i + 1] : [8 * sp, 2];
      path += `Q${P((tx + nx[0]) / 2 - 1, (ty + nx[1]) / 2 + 4)} ${P(nx[0], nx[1])}`;
    }
    path += 'Z';
    let s = c.p(path, c.vg(col, 0.15, -0.3), 2.2);
    let bones = '';
    for (const [tx, ty] of tips) bones += `M${P(0, 0)}L${P(tx, ty)}`;
    s += c.ln(bones, h.shade(col, 0.4), 1.4, 0.8);
    s += c.ci(x + d * tips[0][0] * k, y + tips[0][1] * k, 1.2 * k, HORN, 0);
    return s;
  }
  /** 흑룡 한 마리 — 발 가운데 (x,y), 크기 k, 날개 펼침 spread, 머리 둘(twin) */
  function dragon(c, x, y, k, pose, o = {}) {
    const h = c.h;
    const spread = o.spread == null ? 0 : o.spread;
    const P = (u, v) => `${f(x + u * k)} ${f(y + v * k)}`;
    const lean = pose === 'aim' ? -1.5 : pose === 'fire' ? 1.5 : 0;
    let s = '';
    s += aura(c, x + 4 * k, y - 18 * k, 26 * k, 22 * k, GLOW, o.glow || 0.18);
    // 날개 둘 다 몸 뒤에서 위로 (머리·목이 가려지지 않게) — 펼친 쪽은 오른쪽 위로 조금 덜 올림
    s += wing(c, x - 2 * k, y - 18 * k, k * 0.92, spread, -1, h.shade(MEMBRANE, -0.12), spread * 4);
    if (spread > 0.3) s += wing(c, x + 1 * k, y - 20 * k, k * 0.85, spread, 1, MEMBRANE, -spread * 2);
    // 꼬리
    s += c.p(`M${P(-8, -4)}Q${P(-20, 0)} ${P(-22, 8)}Q${P(-24, 13)} ${P(-30, 12)}L${P(-36, 8)}L${P(-30, 15)}Q${P(-22, 18)} ${P(-17, 10)}Q${P(-14, 4)} ${P(-4, 2)}Z`, c.vg(SCALE, 0.2, -0.3), 2);
    // 뒷다리
    s += c.p(`M${P(-10, -8)}Q${P(-14, -2)} ${P(-10, 0)}L${P(-4, 0)}Q${P(-2, -4)} ${P(-4, -9)}Z`, c.vg(h.shade(SCALE, 0.05), 0.2, -0.3), 1.8);
    // 몸통
    s += c.p(`M${P(-13, -6)}Q${P(-14, -18)} ${P(-4, -24 + lean)}Q${P(6, -27 + lean)} ${P(9, -18 + lean)}Q${P(10, -6)} ${P(3, -2)}Q${P(-7, 0)} ${P(-13, -6)}Z`, c.vg(SCALE, 0.3, -0.3), 2.4);
    s += c.p(`M${P(-1, -4)}Q${P(5, -10)} ${P(5, -19 + lean)}Q${P(8, -12)} ${P(5, -5)}Z`, c.vg(BELLY, 0.3, -0.15), 0, ' opacity="0.9"');
    s += c.ln(`M${P(1, -6)}L${P(5, -7)}M${P(2, -10)}L${P(6, -11)}M${P(3, -14)}L${P(6.5, -15)}`, h.shade(BELLY, -0.3), 0.9, 0.8);
    // 등 가시
    let sp = '';
    for (const [u, v] of [[-11, -14], [-8, -19], [-4, -22.5]]) sp += `M${P(u, v)}L${P(u - 3, v - 3)}L${P(u + 1.5, v - 1)}Z`;
    s += c.p(sp, c.vg(HORN, 0.2, -0.2), 1.4);
    // 앞다리(발톱이 바위를 짚음)
    s += c.p(`M${P(2, -10)}Q${P(8, -5)} ${P(7, 0)}L${P(11, 0)}Q${P(11, -6)} ${P(6, -12)}Z`, c.vg(h.shade(SCALE, 0.08), 0.2, -0.3), 1.8);
    s += c.ln(`M${P(8, 0)}l${f(-1 * k)} ${f(1.4 * k)}M${P(10, 0)}l0 ${f(1.6 * k)}M${P(12, -0.2)}l${f(1 * k)} ${f(1.4 * k)}`, HORN, 1, 0.9);
    // 목 + 머리 (twin이면 둘)
    const necks = o.twin ? [[-6, -10], [4, 4]] : [[0, 0]];
    for (const [dx, dy] of necks) {
      const hx = x + (14 + dx) * k;
      const hy = y + (-34 + dy + lean) * k;
      s += c.p(`M${P(0, -20 + lean)}Q${P(4 + dx * 0.4, -30 + dy * 0.5 + lean)} ${f(hx - 3 * k)} ${f(hy - 2 * k)}L${f(hx - 1 * k)} ${f(hy + 4 * k)}Q${P(9 + dx * 0.3, -26 + dy * 0.5 + lean)} ${P(8, -17 + lean)}Z`, c.vg(SCALE, 0.25, -0.3), 2.2);
      s += c.p(`M${P(5, -20 + lean)}Q${P(9 + dx * 0.3, -26 + dy * 0.5 + lean)} ${f(hx - 1 * k)} ${f(hy + 3 * k)}`, 'none', 0, ` stroke="${BELLY}" stroke-width="${c.sw(1.6 * k)}" opacity="0.7"`);
      s += head(c, hx, hy, k * (o.headK || 1), pose);
    }
    // 접은 날개 (펼친 날개는 위에서 몸 뒤에 그림)
    if (spread <= 0.3) s += c.p(`M${P(-6, -20)}Q${P(-16, -26)} ${P(-18, -12)}Q${P(-12, -14)} ${P(-8, -8)}Z`, c.vg(h.shade(SCALE, 0.05), 0.2, -0.3), 2); // 접은 날개
    return s;
  }
  /** 검은 바위 둥지 기둥 — 위 가운데 (x,y) */
  function rockPillar(c, x, yTop, yBot, w) {
    const h = c.h;
    let s = c.p(`M${f(x - w * 0.62)} ${f(yBot)}L${f(x - w * 0.5)} ${f(yTop + 6)}L${f(x - w * 0.2)} ${f(yTop)}L${f(x + w * 0.25)} ${f(yTop + 1)}L${f(x + w * 0.5)} ${f(yTop + 7)}L${f(x + w * 0.62)} ${f(yBot)}Z`, c.vg(BLACKROCK, 0.25, -0.35), 2.6);
    s += c.ln(`M${f(x - w * 0.3)} ${f(yTop + 8)}L${f(x - w * 0.1)} ${f(yTop + 16)}L${f(x - w * 0.35)} ${f(yTop + 26)}M${f(x + w * 0.2)} ${f(yTop + 10)}L${f(x + w * 0.32)} ${f(yTop + 22)}`, h.shade(BLACKROCK, -0.4), 1.4, 0.85);
    s += c.ln(`M${f(x - w * 0.28)} ${f(yTop + 12)}L${f(x - w * 0.12)} ${f(yTop + 18)}M${f(x + w * 0.24)} ${f(yTop + 14)}L${f(x + w * 0.3)} ${f(yTop + 20)}`, GLOW, 1.1, 0.7);
    return s;
  }

  /* ---------- 단계별 ---------- */
  /* Lv1: 검은 바위 둥지 위 금 간 알에서 고개를 내민 새끼 흑룡 */
  function lv1(c, pose) {
    const h = c.h;
    let o = legendPlat(c, 1, { stone: BLACKROCK, mythic: false });
    o += footShade(c, 50, 103, 18, 5);
    o += c.p('M34 104L38 92L48 88L60 90L66 104Z', c.vg(BLACKROCK, 0.25, -0.35), 2.4);
    o += aura(c, 50, 80, 16, 14, GLOW, 0.35);
    // 아래 알껍데기
    o += c.p('M40 90Q40 100 50 100Q60 100 60 90L57 86L54 89L50 85L46 89L43 86Z', c.vg('#5a4a6e', 0.3, -0.3), 2.2);
    o += c.ln('M44 93L47 96M55 92L53 97', GLOW, 1.2, 0.85);
    // 새끼 머리
    o += c.p('M46 88Q44 80 48 76Q52 74 54 78Q55 84 54 88Z', c.vg(SCALE, 0.3, -0.25), 2);
    o += head(c, 52, 74, 0.62, pose);
    // 위 껍데기 조각(머리에 얹힘)
    o += c.p('M44 72L48 68L51 71L54 67L56 72Q50 70 44 72Z', c.vg('#6a5a7e', 0.3, -0.2), 1.6);
    return o;
  }

  /* Lv2: 바위 기둥 위 젊은 흑룡(날개 접음) · Lv3: 더 높은 기둥, 날개를 반쯤 폄 */
  function lv23(c, pose, L3) {
    let o = legendPlat(c, L3 ? 3 : 2, { stone: '#6a6278', trim: GOLD });
    o += footShade(c, 50, 103, 20, 6);
    const top = L3 ? 74 : 80;
    o += rockPillar(c, 48, top, 104, L3 ? 30 : 28);
    if (L3) o += metalBand(c, 48, 92, 94.4, 15, 4.4, GOLD);
    o += gem(c, 48, top + 10, 2.6, 3.2, GLOW, true);
    o += dragon(c, 48, top + 1, L3 ? 0.95 : 0.8, pose, { spread: L3 ? 0.6 : 0, glow: L3 ? 0.25 : 0.18 });
    return o;
  }

  /* 4A 멸망의 숨결: 큰 바위 둥지 + 날개를 활짝 편 거대한 흑룡 */
  function doom(c, pose) {
    let o = legendPlat(c, 'A', { stone: '#6a6278', trim: GOLD, glow: GLOW, mythic: true });
    o += footShade(c, 50, 99, 26, 7);
    o += rockPillar(c, 46, 72, 99, 40);
    o += metalBand(c, 46, 86, 88.6, 22, 6, GOLD);
    o += gem(c, 46, 80, 3, 3.8, GLOW, true);
    o += dragon(c, 44, 73, 1.2, pose, { spread: 1, glow: 0.3 });
    return o;
  }

  /* 4B 쌍두 흑룡: 머리 둘 달린 흑룡 */
  function twin(c, pose) {
    let o = legendPlat(c, 'B', { stone: '#6a6278', trim: GOLD, glow: GLOW, mythic: true });
    o += footShade(c, 50, 99, 26, 7);
    o += rockPillar(c, 46, 74, 99, 38);
    o += metalBand(c, 46, 88, 90.6, 21, 5.6, GOLD);
    o += gem(c, 46, 82, 3, 3.8, GLOW, true);
    o += dragon(c, 44, 75, 1.1, pose, { spread: 0.75, twin: true, glow: 0.28, headK: 0.9 });
    return o;
  }

  T.shadow_dragon = {
    /* 입 (불길이 나가는 곳) */
    muzzle: [[60, 76], [64, 54], [65, 46], [67, 37], [63, 34]],
    draw(c, v, pose = 'idle') {
      c = fine(c);
      if (v === 1) return lv1(c, pose);
      if (v === 2) return lv23(c, pose, false);
      if (v === 3) return lv23(c, pose, true);
      if (v === 'A') return doom(c, pose);
      return twin(c, pose);
    },
  };
})();
