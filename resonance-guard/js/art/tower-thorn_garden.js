'use strict';

/* =========================================================
 * 탑 그림 — 🪨 가시 덤불 `thorn_garden` (2차 탑, 2026-11-11). 설계: docs/design/towers.md E4
 *  들판 정원사의 가시 덩굴 화단. 탑은 직접 쏘지 않고 길 위에 가시밭을 키움(렌더러가 그림).
 *  idle: 정원사가 씨앗 주머니를 들고 서 있음 · aim: 주머니를 들어 올리고 덩굴이 꿈틀
 *  fire: 씨앗을 앞으로 흩뿌리고 덩굴 한 가닥이 앞으로 휙 뻗음
 *  4A 강철 가시: 쇠 가시가 빽빽한 철제 시렁 탑 + 금속 꽃 · 4B 휘감는 덩굴: 덩굴이 아치처럼 감아 오른 나무 탑 + 꽃
 * ========================================================= */
(() => {
  const { f, M, STONE, fine, poly, cyl, ring, aura, spark, plat, masonryCyl, metalBand, gem, plankTop } = RG.art._tw;
  const A = RG.art._tw.A;
  const { man, footShade, motion, planks, stoneRect, beam, lash, rnd, OP } = A;
  const T = RG.art._tw.T;
  const D2R = Math.PI / 180;
  const LEAF = '#5e9a3a';
  const LEAF_D = '#3f6e2a';
  const BERRY = '#d83a3a';
  const IRON = '#5a5f6a';

  /* ---------- 부품 ---------- */
  /** 가시 덤불 덩이 — 가운데 (x,y), 반지름 r. 둥근 잎 덩이 여럿 + 테두리 가시 + 붉은 열매 */
  function bush(c, x, y, r, o = {}) {
    const h = c.h;
    const col = o.col || LEAF;
    const blobs = [[-0.55, 0.2, 0.62], [0.5, 0.22, 0.6], [0, -0.25, 0.7], [-0.25, 0.35, 0.55], [0.3, 0.4, 0.5]];
    let back = '';
    let thorns = '';
    blobs.forEach(([bx, by, br], i) => {
      const cx = x + bx * r;
      const cy = y + by * r;
      const R = br * r;
      back += c.ci(cx, cy, R, c.sg(i === 2 ? h.shade(col, 0.08) : col), 2.6);
      /* 바깥쪽 가시 */
      for (let k = 0; k < 6; k++) {
        const a = (-150 + k * 50 + rnd(i * 9 + k) * 20) * D2R;
        const px = cx + Math.cos(a) * R;
        const py = cy + Math.sin(a) * R;
        if (Math.hypot(px - x, py - y) < r * 0.75) continue;
        const ox = Math.cos(a) * r * 0.16;
        const oy = Math.sin(a) * r * 0.16;
        thorns += `M${f(px - Math.sin(a) * 1.2)} ${f(py + Math.cos(a) * 1.2)}L${f(px + ox)} ${f(py + oy)}L${f(px + Math.sin(a) * 1.2)} ${f(py - Math.cos(a) * 1.2)}Z`;
      }
    });
    let s = back + c.p(thorns, c.lt('#e8dcb0', 0.1), 1.2, c.ink('#8a7a4a'));
    /* 덤불 위 뾰족한 잎들(왼쪽 위는 밝게, 오른쪽 아래는 짙게) */
    const LV = [[-0.6, -0.05, -30], [-0.25, -0.55, -60], [0.2, -0.6, 20], [0.6, -0.15, 40], [-0.1, -0.1, 70], [0.35, 0.3, 120], [-0.45, 0.4, 160], [0.05, 0.45, 100], [0.7, 0.35, 60], [-0.75, 0.3, -120]];
    LV.forEach(([lx, ly, la], i) => {
      const px = x + lx * r;
      const py = y + ly * r;
      const lc = lx + ly < -0.4 ? c.lt(col, 0.35) : lx + ly > 0.5 ? c.dk(col, 0.3) : h.shade(col, 0.1);
      const L = r * 0.3;
      s += c.p(`M${f(px)} ${f(py)}Q${f(px + L * 0.5)} ${f(py - L * 0.42)} ${f(px + L)} ${f(py)}Q${f(px + L * 0.5)} ${f(py + L * 0.42)} ${f(px)} ${f(py)}Z`, lc, 1.1, `${c.ink(col, 0.5)} transform="rotate(${la} ${f(px)} ${f(py)})"`);
    });
    s += c.ln(`M${f(x - r * 0.4)} ${f(y - r * 0.45)}Q${f(x - r * 0.2)} ${f(y - r * 0.7)} ${f(x + r * 0.15)} ${f(y - r * 0.72)}`, c.lt(col, 0.6), 1.4, 0.6);
    /* 열매: 작은 송이(셋씩) — 눈처럼 보이지 않게 작고 짙게 */
    for (const [bx, by] of o.berries || [[-0.32, -0.12], [0.38, 0.08], [0.02, 0.38], [-0.58, 0.38]]) {
      const bxp = x + bx * r;
      const byp = y + by * r;
      const br = Math.max(1, r * 0.06);
      for (const [dx, dy] of [[0, 0], [br * 1.7, br * 0.5], [br * 0.6, br * 1.6]]) s += c.ci(bxp + dx, byp + dy, br, o.berry || BERRY, 1, c.ink(o.berry || BERRY, 0.55));
      s += c.ci(bxp - br * 0.3, byp - br * 0.3, br * 0.35, '#ffd0c8', 0, ' opacity="0.8"');
    }
    return s;
  }
  /** 가시 덩굴 줄기 — 점 목록, 굵기 w, 가시 간격 */
  function vine(c, pts, col, w = 2.4, o = {}) {
    let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i];
      const q = pts[i - 1];
      d += `Q${f(q[0] + (p[0] - q[0]) * 0.5 + (o.curl || 3) * (i % 2 ? 1 : -1))} ${f(q[1] + (p[1] - q[1]) * 0.5)} ${f(p[0])} ${f(p[1])}`;
    }
    let s = c.ol(d, col, w);
    /* 가시 */
    let th = '';
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i];
      const q = pts[i - 1];
      const L = Math.hypot(p[0] - q[0], p[1] - q[1]) || 1;
      const nx = -(p[1] - q[1]) / L;
      const ny = (p[0] - q[0]) / L;
      const m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
      const sgn = i % 2 ? 1 : -1;
      th += `M${f(m[0] - (p[0] - q[0]) / L * 1.4)} ${f(m[1] - (p[1] - q[1]) / L * 1.4)}L${f(m[0] + nx * 3.2 * sgn)} ${f(m[1] + ny * 3.2 * sgn)}L${f(m[0] + (p[0] - q[0]) / L * 1.4)} ${f(m[1] + (p[1] - q[1]) / L * 1.4)}Z`;
    }
    s += c.p(th, o.thorn || '#e8dcb0', 1, c.ink('#8a7a4a'));
    if (o.leaves) {
      for (let i = 1; i < pts.length; i += 2) {
        const p = pts[i];
        s += c.p(`M${f(p[0])} ${f(p[1])}Q${f(p[0] - 5)} ${f(p[1] - 4)} ${f(p[0] - 7)} ${f(p[1] + 1)}Q${f(p[0] - 3)} ${f(p[1] + 3)} ${f(p[0])} ${f(p[1])}Z`, c.vg(LEAF, 0.3, -0.25), 1.6);
      }
    }
    return s;
  }
  /** 꽃(꽃잎 5장) */
  function flower(c, x, y, r, col, mid = '#ffd84a') {
    let s = '';
    for (let k = 0; k < 5; k++) {
      const a = (k * 72 - 90) * D2R;
      s += c.e(x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.6, r * 0.55, r * 0.38, c.vg(col, 0.35, -0.15), 1.4, ` transform="rotate(${f(k * 72)} ${f(x + Math.cos(a) * r * 0.6)} ${f(y + Math.sin(a) * r * 0.6)})"`);
    }
    return s + c.ci(x, y, r * 0.32, c.sg(mid), 1.2);
  }
  /** 흩뿌리는 씨앗 */
  const seeds = (c, x, y, k = 1) => [[6, -4], [11, -1], [15, -6], [9, 4], [17, 2], [13, 7]].map(([dx, dy], i) => c.e(x + dx * k, y + dy * k, 1.3 * k, 0.9 * k, i % 2 ? '#8a5a2a' : '#c89a4a', 1)).join('') + motion(c, `M${f(x + 2)} ${f(y - 2)}Q${f(x + 9 * k)} ${f(y - 8 * k)} ${f(x + 18 * k)} ${f(y - 4 * k)}`, '#fff6d0', 1.4, 0.6);
  /** 정원사(밀짚모자·초록 옷) — 씨앗 주머니를 든 가까운 손 */
  function gardener(c, x, y, gy, k, pose, G0 = {}) {
    const A2 = {
      idle: { near: { e: [-3, -6], h: [3, -6] }, far: { e: [5.4, -7], h: [8.4, -11] }, lean: 0 },
      aim: { near: { e: [-2.4, -16], h: [1.6, -23.5] }, far: { e: [6.2, -9], h: [8.8, -12.6] }, lean: -6 },
      fire: { near: { e: [3.6, -13.4], h: [10.6, -14.6], open: true }, far: { e: [5.6, -8], h: [8, -10.6] }, lean: 8 },
    }[pose];
    const P = man(c, {
      x, y, k, lean: A2.lean, near: A2.near, far: A2.far, legs: { near: [x - 3 * k, gy], far: [x + 3.6 * k, gy] },
      tunic: G0.tunic || '#6f9a4a', apron: '#8a5a34', head: 'cap', headCol: G0.hat || '#e2c070', glove: '#6a4a2a', pants: '#5a4a3a', boot: '#4a3424',
      squint: pose === 'aim', shout: pose === 'fire', beard: G0.beard,
    });
    /* 씨앗 주머니(idle·aim은 손에, fire는 허리춤) */
    const sack = (sx, sy, s2 = 1) => c.p(`M${f(sx - 3 * s2)} ${f(sy)}Q${f(sx - 4 * s2)} ${f(sy + 5 * s2)} ${f(sx)} ${f(sy + 5.6 * s2)}Q${f(sx + 4 * s2)} ${f(sy + 5 * s2)} ${f(sx + 3 * s2)} ${f(sy)}Q${f(sx)} ${f(sy - 1.6 * s2)} ${f(sx - 3 * s2)} ${f(sy)}Z`, c.vg('#d8b878', 0.3, -0.25), 1.8) + c.ln(`M${f(sx - 2.4 * s2)} ${f(sy + 0.6)}Q${f(sx)} ${f(sy + 1.8)} ${f(sx + 2.4 * s2)} ${f(sy + 0.6)}`, '#8a5a2a', 1.2);
    const hold = pose === 'fire' ? sack(P.W(-4.6, -3)[0], P.W(-4.6, -3)[1], 0.8 * k) : sack(P.nh[0], P.nh[1] + 1, 0.9 * k);
    return { s: P.back + P.legs + P.farArm + P.farHand + P.body + (pose === 'fire' ? hold : '') + P.nearArm + P.nearHand + (pose === 'fire' ? seeds(c, P.nh[0] + 1, P.nh[1], k) : hold), hand: P.nh };
  }

  /* ---------- 단계별 ---------- */
  function lv1(c, pose) {
    const h = c.h;
    let o = plat(c, 1);
    o += footShade(c, 54, 103, 30, 6);
    /* 나무 화단 상자 */
    const bx = 34;
    const bw = 40;
    o += c.p(`M${bx} 92L${bx + 4} 88H${bx + bw + 4}L${bx + bw} 92Z`, c.vg('#4a3020', 0.1, -0.2), 2.2);
    const curl = pose === 'aim' ? 1 : pose === 'fire' ? 0.5 : 0;
    /* 덤불 + 덩굴 */
    o += vine(c, [[bx + 8, 92], [bx + 4, 80 - curl * 6], [bx + 8, 72 - curl * 8]], LEAF_D, 2, { curl: 2 });
    o += bush(c, bx + bw / 2 + 2, 78, 15);
    if (pose === 'fire') o += vine(c, [[bx + bw - 4, 84], [bx + bw + 6, 80], [bx + bw + 14, 82], [bx + bw + 22, 79]], LEAF_D, 2.2, { curl: 2 });
    if (pose === 'aim') o += vine(c, [[bx + bw - 6, 82], [bx + bw + 2, 74], [bx + bw - 1, 66], [bx + bw + 4, 62]], LEAF_D, 2, { curl: 2.5 });
    o += planks(c, bx, 92, bw, 12, M.plank, { n: 2 });
    o += c.r(bx - 1.5, 90.5, 3.4, 14, c.vg(M.woodD, 0.25, -0.25), 0.8, 2) + c.r(bx + bw - 1.9, 90.5, 3.4, 14, c.vg(M.woodD, 0.25, -0.25), 0.8, 2);
    /* 물뿌리개(바닥) */
    o += c.p('M80 104V96Q80 94 82 94H88Q90 94 90 96V104Z', c.vg('#7a8a9a', 0.35, -0.25), 2) + c.ol('M90 97L95 92', '#7a8a9a', 1.6) + c.e(95.5, 91.5, 1.8, 1.1, '#5a6a7a', 1.2);
    const G = gardener(c, 18, 90, 107, 1.18, pose);
    o += G.s;
    return o;
  }

  function lv23(c, pose, L3) {
    const h = c.h;
    const st = STONE.earth;
    let o = plat(c, L3 ? 3 : 2, { stone: st, trim: L3 ? M.gold : undefined });
    o += footShade(c, 56, 103, 32, 7);
    const curl = pose === 'aim' ? 1 : 0;
    if (!L3) {
      /* 돌 화단 + 나무 격자 시렁 + 시렁을 타고 오르는 덩굴 */
      const lat = (x1, x2, y1, y2) => {
        let d = '';
        for (let x = x1; x <= x2; x += 7) d += `M${x} ${y2}L${Math.min(x2, x + (y2 - y1) * 0.5)} ${y1}`;
        for (let x = x1; x <= x2; x += 7) d += `M${x} ${y1}L${Math.min(x2, x + (y2 - y1) * 0.5)} ${y2}`;
        return c.ln(d, '#1c1426', 3.6) + c.ln(d, M.wood, 1.8);
      };
      o += beam(c, 38, 92, 38, 52, 3.6, M.woodD) + beam(c, 78, 92, 78, 52, 3.6, M.woodD);
      o += lat(38, 78, 54, 88);
      o += beam(c, 34, 54, 82, 54, 3.4, M.wood);
      o += vine(c, [[42, 90], [40, 78], [46, 70 - curl * 4], [44, 60 - curl * 6], [50, 54]], LEAF_D, 2.2, { curl: 3, leaves: true });
      o += vine(c, [[74, 90], [76, 76], [70, 66 - curl * 4], [74, 58 - curl * 4]], LEAF_D, 2.2, { curl: 3, leaves: true });
      o += bush(c, 58, 80, 16);
      o += stoneRect(c, 34, 90, 48, 14, st, { ch: 7, bw: 9, seed: 211 });
      o += c.r(34, 88, 48, 3, c.vg(h.shade(st, 0.25), 0.3, -0.1), 1, 2.2);
    } else {
      /* 금속 테 두른 큰 화분 + 가시나무 */
      o += masonryCyl(c, 58, 86, 104, 18, 5.4, st, { ch: 6, bw: 9, seed: 221 });
      o += metalBand(c, 58, 88, 91.5, 18, 5.4, M.gold);
      o += c.e(58, 86, 18, 5.4, c.vg('#4a3020', 0.1, -0.2), 2.4);
      /* 줄기 */
      o += c.p('M54 86C52 76 56 68 52 58L56 56C60 66 58 74 62 86Z', c.cg('#6a4a30'), 2.6);
      o += vine(c, [[54, 66], [46, 60 - curl * 3], [40, 54 - curl * 5]], '#6a4a30', 2.2, { curl: 2 });
      o += vine(c, [[58, 70], [68, 64 - curl * 3], [74, 58 - curl * 5]], '#6a4a30', 2.2, { curl: 2 });
      o += bush(c, 40, 52, 10, { berries: [[-0.2, -0.2], [0.3, 0.2]] }) + bush(c, 74, 54, 10, { berries: [[0.1, -0.3], [-0.3, 0.2]] });
      o += bush(c, 56, 44, 15);
      o += c.ol('M56 30V24', M.gold, 1.6) + gem(c, 56, 21, 3, 3.8, '#9be06a', pose !== 'idle');
    }
    if (pose === 'fire') o += vine(c, [[70, 82], [80, 78], [88, 82], [96, 78]], LEAF_D, 2.4, { curl: 2 });
    const G = gardener(c, 18, 90, 107, 1.18, pose, L3 ? { tunic: '#4f8a3a', hat: '#e8c868' } : {});
    o += G.s;
    return o;
  }

  /* 4A 강철 가시: 쇠기둥 넷과 고리로 된 시렁 탑 + 바깥으로 뻗은 쇠 가시 + 꼭대기 금속 꽃 */
  function ironThorn(c, pose) {
    const h = c.h;
    let o = plat(c, 4, { stone: '#8e8a7a', trim: '#9be06a' });
    o += footShade(c, 50, 99, 34, 8);
    const spike = (x, y, ang, L = 7) => {
      const a = ang * D2R;
      return c.p(poly([[x - Math.sin(a) * 1.8, y + Math.cos(a) * 1.8], [x + Math.cos(a) * L, y + Math.sin(a) * L], [x + Math.sin(a) * 1.8, y - Math.cos(a) * 1.8]]), c.vg('#d8dce4', 0.4, -0.3), 1.4);
    };
    const up = pose === 'aim' ? 2 : pose === 'fire' ? 4 : 0;
    /* 뒤 기둥 */
    o += c.ol('M38 99L40 34M62 99L60 34', h.shade(IRON, -0.25), 3.2);
    /* 고리 셋 (뒤 반쪽) */
    for (const [y, r] of [[86, 22], [66, 18], [46, 13]]) o += c.ln(`M${50 - r} ${y}A${r} ${r * 0.3} 0 0 1 ${50 + r} ${y}`, h.shade(IRON, -0.3), 2.6);
    /* 안쪽 강철 덩굴 */
    o += vine(c, [[50, 99], [46, 84], [54, 70], [46, 56], [52, 42]], '#7a808c', 2.6, { curl: 3, thorn: '#eef0f4' });
    /* 앞 기둥 + 고리(앞 반쪽) + 쇠 가시 */
    o += c.ol('M28 99L34 34M72 99L66 34', IRON, 3.4) + c.ol('M50 100V30', IRON, 3);
    for (const [y, r] of [[86, 22], [66, 18], [46, 13]]) {
      o += c.ol(`M${50 - r} ${y}A${r} ${r * 0.3} 0 0 0 ${50 + r} ${y}`, IRON, 2.6);
      o += spike(50 - r - 1, y, 180 - 10, 7 + up) + spike(50 + r + 1, y, -10 + 0, 7 + up) + spike(50 - r * 0.6, y + r * 0.26, 140, 6 + up) + spike(50 + r * 0.6, y + r * 0.26, 40, 6 + up);
    }
    /* 금속 꽃 (꼭대기) */
    const bloom = pose === 'idle' ? 0.8 : pose === 'aim' ? 1 : 1.15;
    o += aura(c, 50, 26, 14, 12, '#9be06a', pose === 'idle' ? 0.35 : 0.75);
    o += flower(c, 50, 26, 10 * bloom, '#d8dce4', M.gold);
    o += flower(c, 36, 40, 5.5, '#c8ccd4', M.gold) + flower(c, 64, 40, 5.5, '#c8ccd4', M.gold);
    if (pose === 'fire') o += [[30, 20], [70, 18], [24, 34], [76, 32]].map(([x, y]) => spark(c, x, y, 2.6, '#eef0f4', 0)).join('') + motion(c, 'M22 60L12 58M78 60L88 58M24 80L14 80M76 80L86 80', '#eef0f4', 1.8, 0.8);
    return o;
  }

  /* 4B 휘감는 덩굴: 양쪽 덩굴 줄기가 감아 올라 아치를 이루고 꽃이 핌 */
  function vineArch(c, pose) {
    const h = c.h;
    let o = plat(c, 4, { stone: '#8e8a6a', trim: '#9be06a' });
    o += footShade(c, 50, 99, 36, 8);
    const sway = pose === 'aim' ? -2 : pose === 'fire' ? 3 : 0;
    /* 아치 줄기 (두 줄기 꼬임) */
    const trunk = (d, col, w) => c.ln(d, '#1c1426', w + 2.6) + c.ln(d, col, w);
    o += trunk(`M24 99C18 76 22 52 32 38C40 26 ${46 + sway} 20 50 20C${54 + sway} 20 62 26 68 38C78 52 82 76 76 99`, '#6a4a30', 5.4);
    o += trunk(`M30 99C26 80 26 58 36 44C42 34 ${48 + sway} 28 52 28C${58 + sway} 30 64 36 66 46C72 60 74 80 70 99`, '#7a5a3a', 3.4);
    o += c.ln(`M22 90C18 72 24 52 32 40`, c.lt('#6a4a30', 0.45), 1.6, 0.7);
    /* 가운데 가시 덤불(아래) */
    o += bush(c, 50, 84, 15);
    /* 덩굴 잎·가시 */
    o += vine(c, [[26, 84], [20, 70], [26, 58], [22, 46]], LEAF_D, 2, { curl: 3, leaves: true });
    o += vine(c, [[74, 84], [80, 70], [74, 58], [78, 46]], LEAF_D, 2, { curl: 3, leaves: true });
    /* 꽃 */
    const fl = [[32, 38, 5], [68, 38, 5], [50, 18, 6.5], [40, 26, 4.4], [60, 26, 4.4], [22, 62, 4], [78, 62, 4]];
    o += aura(c, 50, 30, 30, 18, '#ffb0d8', pose === 'idle' ? 0.3 : 0.6);
    o += fl.map(([x, y, r], i) => flower(c, x, y, r * (pose === 'fire' ? 1.15 : 1), i % 2 ? '#ffc0dc' : '#fff0f6', i % 2 ? '#ffd84a' : '#ff9ac8')).join('');
    if (pose === 'fire') {
      o += vine(c, [[64, 80], [76, 76], [86, 82], [94, 78]], LEAF_D, 2.4, { curl: 2 }) + vine(c, [[36, 80], [24, 76], [14, 82], [6, 78]], LEAF_D, 2.4, { curl: 2 });
      o += [[16, 30], [84, 28], [50, 8]].map(([x, y]) => spark(c, x, y, 2.4, '#ffd8ea', 0)).join('');
    }
    if (pose === 'aim') o += vine(c, [[50, 74], [56, 64], [50, 56]], LEAF_D, 2, { curl: 2 });
    return o;
  }

  T.thorn_garden = {
    /* 씨앗을 던지는 손 / 덩굴 끝 */
    muzzle: [[31, 76], [31, 76], [31, 76], [50, 26], [50, 20]],
    draw(c, v, pose = 'idle') {
      c = fine(c);
      if (v === 1) return lv1(c, pose);
      if (v === 2) return lv23(c, pose, false);
      if (v === 3) return lv23(c, pose, true);
      if (v === 'A') return ironThorn(c, pose);
      return vineArch(c, pose);
    },
  };
})();
