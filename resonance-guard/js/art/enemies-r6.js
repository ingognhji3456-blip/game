'use strict';

/* =========================================================
 * 적 그림 — 6지역 별울림 첨탑 (설계: docs/design/region6.md · 도구: enemies-r5.js의 RG.art._en5)
 *   적마다 walk0~3 · aim · attack · die0~2 9장. 빛은 왼쪽 위, 바닥 그림자는 렌더러 몫.
 *   대표 색: 밤하늘 남보라 + 연한 금빛 별, 구름 흰보라.
 * ========================================================= */
(() => {
  const X = RG.art._en5;
  const { H, OL, g, n, D, MOTION, mk, sh, SHADE, TH, pt, pol, mid, angOf, tr, ik, seg, segN, frameOf, boot, groundAnkle, bez, ribbon, streaks, motes, fin, spec, rimL, ao, inl, bloom } = X;
  const STAR = '#ffe7a8';
  const NIGHT = '#3a3478';
  const starP = (x, y, r) => `M${n(x)} ${n(y - r)}L${n(x + r * 0.32)} ${n(y - r * 0.32)}L${n(x + r)} ${n(y)}L${n(x + r * 0.32)} ${n(y + r * 0.32)}L${n(x)} ${n(y + r)}L${n(x - r * 0.32)} ${n(y + r * 0.32)}L${n(x - r)} ${n(y)}L${n(x - r * 0.32)} ${n(y - r * 0.32)}Z`;
  const stars = (c, pts, col = STAR) => pts.map(([x, y, r]) => c.P(starP(x, y, r), col, ' stroke-width="1"')).join('');
  const dust = (c, pts, col = STAR, op = 0.9) => motes(c, pts, col, op);

  /* =========================================================
   * 별가루 나방 — 흰보라 털 몸통, 금빛 별무늬 날개, 깃털 더듬이. 날갯짓 4장.
   * aim: 날개를 뒤로 모음 / attack: 앞으로 내리꽂으며 별가루를 뿌림 / 죽음: 날개가 접혀 떨어짐 → 별가루
   * ========================================================= */
  const MOTH = {
    walk0: { y: 56, wing: -100, wk: 1 }, walk1: { y: 58, wing: -150, wk: 0.78 }, walk2: { y: 60, wing: 168, wk: 0.92 }, walk3: { y: 58, wing: -150, wk: 0.78 },
    aim: { y: 54, wing: -128, wk: 0.95, lean: -10 }, attack: { y: 62, wing: -110, wk: 1, lean: 22, dust: 1 }, die0: { y: 58, wing: 150, wk: 0.9, lean: -24 },
  };
  function drawMoth(fr) {
    const c = mk(2.4);
    const body = '#e8e2f8';
    const wingC = '#9a8ad8';
    const P = MOTH[fr];
    const wing = (root, a, k, far) => {
      const L = 34 * k;
      const d = `M0 0C${n(L * 0.3)} -12 ${n(L * 0.9)} -15 ${n(L)} -3C${n(L * 1.02)} 7 ${n(L * 0.7)} 14 ${n(L * 0.42)} 13C${n(L * 0.3)} 18 ${n(L * 0.1)} 13 0 5Z`;
      return g(c.P(d, c.body(sh(wingC, far ? -0.25 : 0), 0.45, -0.4)) +
        c.Pn(`M${n(L * 0.5)} -6C${n(L * 0.8)} -8 ${n(L * 0.95)} -3 ${n(L * 0.9)} 2C${n(L * 0.75)} 4 ${n(L * 0.55)} 2 ${n(L * 0.5)} -6Z`, '#5a4aa8', far ? 0.5 : 0.7) +
        stars(c, [[L * 0.62, -2, 2.6 * k], [L * 0.3, 5, 1.8 * k]], far ? sh(STAR, -0.25) : STAR) +
        inl(c, `M2 1Q${n(L * 0.4)} -4 ${n(L * 0.85)} -4M2 3Q${n(L * 0.3)} 6 ${n(L * 0.4)} 10`, wingC, 1), tr(root, a));
    };
    let s = '';
    if (fr === 'die1' || fr === 'die2') {
      if (fr === 'die1') {
        s += g(wing([0, 0], 110, 0.8, true) + wing([0, 0], 70, 0.8, false) +
          c.E(0, 0, 9, 6, c.body(body, 0.45, -0.4)) + c.E(9, -2, 4.6, 4.6, c.body(body, 0.4, -0.4)) + c.L('M11 -3l1 1M9 -4l1 1', OL, 1.4), tr([50, 74], 150));
        s += dust(c, [[40, 60, 1.4], [58, 56, 1.2], [46, 50, 1], [62, 66, 1.3]]);
      } else {
        s += stars(c, [[44, 84, 3], [56, 82, 2.4], [50, 76, 2]]) + dust(c, [[38, 80, 1.2], [62, 86, 1], [48, 70, 1], [54, 64, 0.8], [42, 66, 0.8]], '#ffffff', 0.85);
        s += bloom(c, 50, 82, 10, STAR, 0.35);
      }
      return fin(c, s);
    }
    const B = [48, P.y];
    s += g(wing([4, -3], P.wing + 14, P.wk * 0.9, true), tr(B, P.lean || 0));
    // 몸통(털 무늬 3마디) + 머리 + 깃털 더듬이
    s += g(
      c.P('M-13 3C-16 0 -15 -5 -10 -5C-7 -7 -1 -7 2 -5L3 5C-3 8 -9 7 -13 3Z', c.body(sh(body, -0.06), 0.4, -0.42)) +
      inl(c, 'M-8 -5Q-9 0 -7 6M-3 -6Q-4 0 -2 7', body, 1.1) +
      c.E(6, -1, 8, 7, c.body(body, 0.45, -0.38)) + c.Pn('M4 -7C8 -8 13 -5 14 0C10 -2 6 -2 3 -1Z', '#ffffff', 0.6) +
      c.E(14, -3, 5.6, 5.2, c.body(body, 0.45, -0.38)) +
      c.E(16.4, -4, 2, 2.2, '#2a2246', ' stroke="none"') + spec(15.8, -4.8, 0.7) +
      c.L('M15 -8C16 -14 20 -18 25 -18M16 -8C19 -12 24 -13 28 -11', '#8a7ab8', 1.4) +
      c.L('M18 -15l-1 -2M21 -17l0 -2M24 -18l1 -2M22 -12l1 -2M25 -12l2 -1', '#c8bce8', 1) +
      c.L('M6 6l-2 4M10 5l1 4', '#8a7ab8', 1.4), tr(B, P.lean || 0));
    s += g(wing([2, -2], P.wing, P.wk, false), tr(B, P.lean || 0));
    if (P.dust || fr === 'walk0' || fr === 'walk2') s += dust(c, [[36, P.y + 10, 1.1], [30, P.y + 4, 0.9], [42, P.y + 16, 0.8]]);
    if (fr === 'attack') s += streaks(c, ['M22 40L36 50', 'M18 52L32 58', 'M24 64L36 64'], STAR, 1.6, 0.7) + dust(c, [[66, 70, 1.4], [72, 64, 1.1], [60, 76, 1.2], [70, 76, 0.9]]);
    if (fr === 'aim') s += bloom(c, 62, 46, 8, STAR, 0.35);
    if (fr === 'die0') s += c.L('M60 40l6 -4M64 48l7 0', '#ffffff', 1.6, ' opacity=".8"');
    return fin(c, s);
  }
  D.stardust_moth = (fr) => drawMoth(MOTH[fr] || fr === 'die1' || fr === 'die2' ? fr : 'walk0');
  D.stardust_moth.frames = true;
  MOTION.stardust_moth = { gait: 'fly', bob: 0.05, tilt: 4, hover: 0.55, deathFx: 'sparks', deathTime: 0.6 };

  /* =========================================================
   * 구름 양 — 둥실한 구름 털(흰보라) 속에 남보라 얼굴과 짧은 다리, 금빛 별 뿔.
   * walk: 종종걸음 / aim: 고개를 숙이고 뒷발 차기 / attack: 박치기(털 뭉치 튐) / 죽음: 털이 흩어져 구름 조각
   * ========================================================= */
  const SHEEP = {
    walk0: { y: 0, legs: [6, -4, -6, 4], head: 0 }, walk1: { y: -1.4, legs: [0, 0, 0, 0], head: 2 },
    walk2: { y: 0, legs: [-6, 4, 6, -4], head: 0 }, walk3: { y: -1.4, legs: [0, 0, 0, 0], head: 2 },
    aim: { y: 1, legs: [-4, -6, 2, 4], head: 18, lean: -4 }, attack: { y: 0, legs: [8, 6, -6, -8], head: -6, lean: 10, dx: 6 }, die0: { y: 0, legs: [2, -2, -2, 2], head: -14, lean: -10 },
  };
  function drawSheep(fr) {
    const c = mk(2.6);
    const wool = '#ece8fb';
    const face = '#4a4288';
    const P = SHEEP[fr];
    const legX = [34, 44, 58, 68];
    const legG = (i) => {
      const x = legX[i] + (P.dx || 0) * 0.3;
      const off = P.legs[i];
      const far = i === 1 || i === 3;
      return seg(c, [x, 68 + P.y], [x + off * 0.5, 84], 3.4, 3, c.body(sh(face, far ? -0.25 : 0), 0.35)) +
        c.P(`M${n(x + off * 0.5 - 3.6)} 84L${n(x + off * 0.5 + 3.6)} 84L${n(x + off * 0.5 + 4)} 88.5L${n(x + off * 0.5 - 4)} 88.5Z`, sh('#2a2450', far ? -0.2 : 0), TH);
    };
    const woolBody = (cx, cy, k = 1, op) => c.cloud([[cx - 16 * k, cy + 2, 12 * k], [cx - 4 * k, cy - 8, 14 * k], [cx + 10 * k, cy - 6, 13 * k], [cx + 18 * k, cy + 4, 11 * k], [cx + 4 * k, cy + 8, 14 * k], [cx - 12 * k, cy + 10, 10 * k]], c.body(wool, 0.5, -0.32), op);
    let s = '';
    if (fr === 'die1' || fr === 'die2') {
      if (fr === 'die1') {
        s += woolBody(40, 62, 0.7) + woolBody(66, 56, 0.55) + c.cloud([[52, 76, 8], [30, 80, 6]], c.body(wool, 0.5, -0.3));
        s += g(c.E(0, 0, 8, 7, c.body(face, 0.4)) + c.L('M2 -2l3 2M2 2l3 -2', '#ffffff', 1.4) + c.P(starP(-4, -9, 3.6), STAR, TH), tr([58, 80], 70));
        s += dust(c, [[28, 52, 1.4], [74, 44, 1.2], [60, 40, 1]], '#ffffff');
      } else {
        s += c.cloud([[36, 84, 7], [50, 82, 9], [64, 85, 6]], c.body(wool, 0.5, -0.3), 0.85) + stars(c, [[52, 72, 3], [40, 76, 2]]);
        s += dust(c, [[30, 70, 1.2], [70, 66, 1], [58, 60, 0.8]], '#ffffff', 0.8);
      }
      return fin(c, s, 1.02);
    }
    const lean = P.lean || 0;
    const body = legG(1) + legG(3) + legG(0) + legG(2) +
      woolBody(50 + (P.dx || 0), 58 + P.y) +
      c.Pn(`M${n(58 + (P.dx || 0))} ${n(50 + P.y)}C${n(70 + (P.dx || 0))} ${n(52 + P.y)} ${n(72 + (P.dx || 0))} ${n(66 + P.y)} ${n(62 + (P.dx || 0))} ${n(72 + P.y)}C${n(66 + (P.dx || 0))} ${n(62 + P.y)} ${n(64 + (P.dx || 0))} ${n(56 + P.y)} ${n(58 + (P.dx || 0))} ${n(50 + P.y)}Z`, '#b8b0e0', 0.5) +
      stars(c, [[40 + (P.dx || 0), 52 + P.y, 2], [52 + (P.dx || 0), 48 + P.y, 1.6]]);
    const head = g(
      c.P('M-4 -8C4 -12 13 -8 14 0C14 7 9 11 3 11C-3 11 -7 6 -7 0Z', c.body(face, 0.42, -0.4)) +
      c.cloud([[-4, -9, 5], [3, -12, 5.4], [9, -10, 4.6]], c.body(wool, 0.5, -0.3)) +
      c.P('M-2 -12C-6 -18 -2 -22 2 -20C0 -18 0 -15 1 -12Z', c.body(STAR, 0.4), TH) + c.P('M8 -12C10 -18 15 -19 16 -15C13 -15 11 -13 10 -11Z', c.body(STAR, 0.4), TH) +
      (fr === 'aim' ? c.L('M4 -2l4 2M10 -2l-3 2', '#ffffff', 1.6) : c.E(5, -1, 1.8, 2.2, '#ffffff', ' stroke="none"') + c.E(10.6, -1.4, 1.5, 2, '#ffffff', ' stroke="none"') + c.E(5.4, -0.6, 1, 1.3, '#1a1438', ' stroke="none"') + c.E(10.9, -1, 0.9, 1.2, '#1a1438', ' stroke="none"')) +
      c.L('M8 6Q10 7.4 12 6', '#ffffff', 1.1) + c.E(-3, 0, 2.6, 4, c.body(sh(face, -0.15), 0.3), TH), tr([72 + (P.dx || 0), 52 + P.y], P.head));
    s += g(body + head, `rotate(${lean} 50 88)`);
    if (fr === 'attack') s += c.cloud([[88, 50, 5], [92, 58, 4], [84, 60, 3.6]], c.body(wool, 0.5, -0.3), 0.9) + streaks(c, ['M22 50L32 52', 'M20 62L30 62'], '#ffffff', 1.6, 0.7);
    if (fr === 'aim') s += motes(c, [[26, 86, 1.4], [20, 84, 1.1]], '#d8d0f0', 0.9);
    if (fr === 'die0') s += c.cloud([[84, 36, 4], [88, 44, 3]], c.body(wool, 0.5, -0.3), 0.8);
    return fin(c, s, 1.02);
  }
  D.cloud_sheep = (fr) => drawSheep(SHEEP[fr] || fr === 'die1' || fr === 'die2' ? fr : 'walk0');
  D.cloud_sheep.frames = true;
  MOTION.cloud_sheep = { gait: 'stomp', bob: 0.03, tilt: 2, squash: 0.04, deathFx: 'mist', deathTime: 0.8 };

  /* =========================================================
   * 성운 해파리 — 남보라·분홍·청록이 섞인 성운 갓, 속에 별 몇 개, 늘어진 빛 촉수.
   * walk: 갓이 오므렸다 펴짐(4장) / aim: 촉수가 빛남 / attack: 촉수로 찌름(번개 별빛) / 죽음: 터지며 작은 해파리 셋의 빛
   * ========================================================= */
  const JELLY = {
    walk0: { y: 46, sq: 1, t: 0 }, walk1: { y: 44, sq: 0.9, t: 1 }, walk2: { y: 42, sq: 0.82, t: 2 }, walk3: { y: 44, sq: 0.9, t: 1 },
    aim: { y: 44, sq: 1.05, t: 0, glow: 1 }, attack: { y: 46, sq: 0.95, t: 3, glow: 2 }, die0: { y: 46, sq: 1.15, t: 0 },
  };
  function drawJelly(fr) {
    const c = mk(2.4);
    const P = JELLY[fr];
    const nebula = c.rad([[0, '#ffd8f4'], [0.35, '#c88ae8'], [0.7, '#6a5ac8'], [1, '#3a3498']], 0.35, 0.3, 0.8);
    const tent = (x0, wave, len, col) => {
      const pts = bez([x0, P.y + 6], [x0 + wave, P.y + 6 + len * 0.5], [x0 - wave * 0.5, P.y + 6 + len], 8);
      return ribbon(c, pts, 1.8, 0.6, col, TH);
    };
    let s = '';
    if (fr === 'die1' || fr === 'die2') {
      if (fr === 'die1') {
        s += bloom(c, 50, 50, 22, '#c88ae8', 0.45) + c.P('M30 52C30 36 70 36 70 52L64 46L58 54L50 44L42 54L36 46Z', nebula);
        for (const [x, y] of [[26, 34], [74, 32], [50, 22]]) s += c.E(x, y, 5, 3.6, nebula) + c.L(`M${x - 2} ${y + 3}l-1 4M${x + 2} ${y + 3}l1 4`, '#c8a8f0', 1.2);
        s += stars(c, [[40, 60, 2.6], [60, 64, 2.2], [50, 70, 1.8]]);
      } else {
        s += stars(c, [[46, 82, 2.6], [56, 78, 2]]) + dust(c, [[40, 70, 1.2], [60, 66, 1], [50, 58, 0.9]], '#e8c8ff', 0.85) + bloom(c, 50, 78, 8, '#c88ae8', 0.3);
      }
      return fin(c, s);
    }
    const wv = [3, -2, -4, 5][P.t];
    const tc = P.glow ? '#fff0ff' : '#c8a8f0';
    s += tent(38, wv, 30, sh('#a888e0', -0.15)) + tent(46, -wv, 36, '#b898e8') + tent(54, wv, 34, '#b898e8') + tent(62, -wv * 0.8, 28, sh('#a888e0', -0.15));
    s += c.L(`M42 ${P.y + 8}q${wv} 10 0 22M58 ${P.y + 8}q${-wv} 10 0 22`, tc, 1.2, ` opacity="${P.glow ? 1 : 0.7}"`);
    if (P.glow) s += bloom(c, 50, P.y + 26, 14, '#ffd8f4', P.glow > 1 ? 0.6 : 0.4);
    const w = 22 / P.sq;
    const h = 20 * P.sq;
    s += c.P(`M${50 - w} ${P.y + 6}C${50 - w} ${P.y - h} ${50 + w} ${P.y - h} ${50 + w} ${P.y + 6}L${50 + w * 0.6} ${P.y + 2}L${50 + w * 0.2} ${P.y + 8}L${50 - w * 0.2} ${P.y + 2}L${50 - w * 0.6} ${P.y + 8}Z`, nebula);
    s += c.Pn(`M${50 - w * 0.7} ${P.y - h * 0.4}C${50 - w * 0.5} ${P.y - h * 0.8} ${50 - w * 0.1} ${P.y - h * 0.85} ${50 + w * 0.1} ${P.y - h * 0.8}`, 'none') + c.shine(50 - w * 0.45, P.y - h * 0.5, 4, 7, 0.5, -30);
    s += stars(c, [[46, P.y - h * 0.3, 2.4], [56, P.y - h * 0.5, 1.8], [52, P.y - 1, 1.5]]);
    s += c.E(44, P.y - 2, 1.8, 2.2, '#ffffff', ' stroke="none"') + c.E(52, P.y - 3, 1.6, 2, '#ffffff', ' stroke="none"') + c.E(44.4, P.y - 1.6, 0.9, 1.2, '#2a1a48', ' stroke="none"') + c.E(52.3, P.y - 2.6, 0.8, 1.1, '#2a1a48', ' stroke="none"');
    if (fr === 'attack') s += c.L(`M60 ${P.y + 20}L70 ${P.y + 28}L66 ${P.y + 30}L78 ${P.y + 40}`, '#fff0ff', 2) + stars(c, [[80, P.y + 42, 3]]);
    if (fr === 'die0') s += c.L('M26 30l-6 -4M74 30l6 -4', '#ffffff', 1.6, ' opacity=".8"');
    return fin(c, s);
  }
  D.nebula_jelly = (fr) => drawJelly(JELLY[fr] || fr === 'die1' || fr === 'die2' ? fr : 'walk0');
  D.nebula_jelly.frames = true;
  MOTION.nebula_jelly = { gait: 'float', bob: 0.05, tilt: 0, sway: 0.02, squash: 0.06, hover: 0.45, deathFx: 'sparks', deathTime: 0.7 };

  /* =========================================================
   * 유성 골렘 — 검은 운석 바위 몸, 틈마다 주황 불빛, 등에 꼬리 불꽃. 머리는 작은 운석과 빛나는 눈 틈.
   * walk: 쿵쿵 / aim: 불타는 주먹을 높이 / attack: 내리찍기(불꽃 고리) / 죽음: 금이 번져 빛남 → 터짐 → 잔해와 불씨
   * ========================================================= */
  const MGOLEM = {
    walk0: { p: [48, 64], lean: 3, nf: [60, 0, 0], ff: [36, 0, 0], nh: [30, 74], fh: [72, 68] },
    walk1: { p: [48, 62], lean: 0, nf: [50, 0, 0], ff: [48, 8, 6], nh: [33, 72], fh: [70, 70] },
    walk2: { p: [48, 64], lean: -3, nf: [36, 0, 0], ff: [60, 0, 0], nh: [38, 74], fh: [66, 68] },
    walk3: { p: [48, 62], lean: 0, nf: [50, 8, 6], ff: [48, 0, 0], nh: [34, 72], fh: [70, 70] },
    aim: { p: [46, 64], lean: -10, nf: [34, 0, 0], ff: [62, 0, 0], nh: [26, 22], fh: [74, 58] },
    attack: { p: [46, 66], lean: 16, nf: [30, 1, 12], ff: [60, 0, 0], nh: [74, 80], fh: [64, 72] },
    die0: { p: [46, 64], lean: -12, nf: [38, 0, 0], ff: [58, 0, 0], nh: [28, 56], fh: [70, 72] },
  };
  function drawMGolem(fr) {
    const c = mk(2.7);
    const rock = '#4a4058';
    const lava = '#ff8a3d';
    const P = MGOLEM[fr];
    const rockF = (amt = 0) => c.body(sh(rock, amt), 0.38, -0.4);
    const crack = (d, w = 1.8) => `<path d="${d}" fill="none" stroke="${lava}" stroke-width="${w + 2.4}" opacity=".5" ${c.soft()}/>` + c.L(d, '#ffd28a', w);
    const fistR = (p, far) => g(c.P('M-8 -7L5 -8L10 -2L9 7L-4 8L-9 2Z', rockF(far ? -0.2 : 0)) + crack('M-2 -6L0 0L-3 5', 1.2) + c.Pn('M-8 3L9 4L9 7L-4 8Z', SHADE, 0.3), tr(p));
    const limbR = (a, b, r1, r2, far) => seg(c, a, b, r1, r2, rockF(far ? -0.22 : -0.05)) + crack(`M${pt(mid(a, b, 0.3))}L${pt(mid(a, b, 0.6))}`, 1);
    const armR = (s0, hand, far) => {
      const el = ik(s0, hand, 14, 14, fr === 'aim' && !far ? [-0.6, -1] : [-0.7, 0.7]);
      return limbR(s0, el, 6, 5.4, far) + limbR(el, hand, 5.4, 5, far) + fistR(hand, far);
    };
    const legR = (hip, foot, far) => {
      const ankle = [foot[0], groundAnkle(5) - foot[1]];
      const kn = ik(hip, ankle, 11, 11, [1, -0.2]);
      return limbR(hip, kn, 7, 6, far) + limbR(kn, ankle, 6, 5.6, far) + boot(c, ankle, 15, 5, foot[2] || 0, rockF(far ? -0.3 : -0.15));
    };
    const torso = (bright = 0) => c.P('M-20 -2C-24 -14 -20 -32 -6 -38C6 -42 20 -36 22 -22C24 -12 22 -4 18 0Z', rockF(0)) +
      c.Pn('M8 -38C18 -34 24 -22 22 -10C21 -5 20 -2 18 0L8 -2C14 -14 14 -28 8 -38Z', SHADE, 0.28) +
      crack('M-12 -30L-6 -22L-12 -14L-6 -6M8 -32L4 -22L10 -14', bright ? 2.6 : 1.8) +
      `<circle cx="0" cy="-20" r="${bright ? 10 : 7}" fill="${lava}" opacity=".45" stroke="none" ${c.soft()}/>` + c.E(0, -20, 3.4, 3.4, '#ffe0a0', ' stroke="none"') +
      rimL(c, 'M16 -30C20 -22 20 -12 18 -4', rock, 1.2) + spec(-12, -32, 1);
    const headR = () => c.P('M-7 2C-9 -6 -4 -11 2 -11C8 -11 11 -6 10 1L9 4H-6Z', rockF(0.05)) + c.P('M0 -3H9V0H0Z', '#1a1020', TH) +
      `<path d="M1 -1.5H9" stroke="${lava}" stroke-width="4" opacity=".7" ${c.soft()}/>` + c.L('M2 -1.5H8.6', '#ffe0a0', 1.6);
    // 등의 불꽃(운석 꼬리): 어깨 뒤에서 위로 일렁이는 불길 세 갈래
    const tail = (k = 1) => `<ellipse cx="-12" cy="-40" rx="${n(12 * k)}" ry="${n(10 * k)}" fill="${lava}" opacity=".45" stroke="none" ${c.soft()}/>` +
      [[-16, -34, -26, -52, 0], [-8, -38, -12, -58, 1], [-20, -28, -34, -40, 2]].map(([x0, y0, x1, y1, i]) => {
        const w = (i === 1 ? 6 : 4.6) * k;
        return c.P(`M${x0 - w} ${y0}C${x0 - w} ${y0 - 8} ${x1 - 2} ${y1 + 6} ${x1} ${y1}C${x1 + 3} ${y1 + 8} ${x0 + w} ${y0 - 6} ${x0 + w} ${y0}Z`, c.body('#ffb03a', 0.45), ' stroke="none"') +
          c.Pn(`M${x0 - w * 0.4} ${y0}C${x0 - w * 0.4} ${y0 - 6} ${x1} ${y1 + 9} ${x1 + 0.6} ${y1 + 5}C${x1 + 2} ${y1 + 10} ${x0 + w * 0.4} ${y0 - 4} ${x0 + w * 0.4} ${y0}Z`, '#fff0b0', 0.9);
      }).join('');
    let s = '';
    if (fr === 'die1' || fr === 'die2') {
      if (fr === 'die1') {
        s += bloom(c, 50, 56, 30, lava, 0.55) + `<circle cx="50" cy="56" r="34" fill="none" stroke="#ffd28a" stroke-width="2.4" opacity=".7"/>`;
        s += g(c.P('M-14 -10L0 -20L14 -8L10 8L-10 10Z', rockF(0)) + crack('M-6 -10L2 -2L-4 6', 2), tr([34, 52], -30)) + g(c.P('M-12 -8L6 -14L14 2L0 12L-12 6Z', rockF(-0.1)) + crack('M0 -8L4 2', 2), tr([68, 46], 24));
        s += g(c.P('M-8 -6L8 -8L10 6L-6 8Z', rockF(-0.15)), tr([50, 76], 10)) + dust(c, [[26, 40, 1.8], [76, 30, 1.6], [60, 72, 1.4], [38, 74, 1.4]], '#ffb03a');
      } else {
        s += c.P('M24 88.5L28 80L38 78L42 88.5Z', rockF(-0.1)) + c.P('M40 88.5L46 76L58 74L62 88.5Z', rockF(0)) + c.P('M60 88.5L64 80L74 82L76 88.5Z', rockF(-0.15));
        s += crack('M44 82L50 78L56 80', 1.4) + bloom(c, 50, 84, 12, lava, 0.35) + dust(c, [[40, 70, 1.2], [58, 66, 1], [50, 60, 0.9]], '#ffb03a', 0.85);
      }
      return fin(c, s, 1.04);
    }
    const B = frameOf(P.p[0], P.p[1], P.lean);
    const nSh = B.p(-15, -28);
    const fSh = B.p(14, -30);
    s += g(tail(fr === 'attack' ? 1.3 : 1), B.t);
    s += armR(fSh, P.fh, true);
    s += legR(B.p(8, -3), P.ff, true) + legR(B.p(-8, -2), P.nf, false);
    s += g(torso(fr === 'die0' || fr === 'aim' ? 1 : 0) + g(headR(), tr([4, -40])), B.t);
    s += armR(nSh, P.nh, false);
    if (fr === 'aim') s += bloom(c, P.nh[0], P.nh[1], 12, lava, 0.5);
    if (fr === 'attack') {
      const x = P.nh[0] + 4;
      s = `<ellipse cx="${x}" cy="88" rx="22" ry="5" fill="none" stroke="${lava}" stroke-width="2.4" opacity=".75"/><ellipse cx="${x}" cy="88" rx="12" ry="3" fill="none" stroke="#ffe0a0" stroke-width="1.8"/>` + s;
      s += dust(c, [[x - 14, 74, 1.6], [x + 12, 70, 1.4], [x + 4, 64, 1.2]], '#ffb03a');
    }
    if (fr === 'die0') s += crack('M38 40L44 48M58 36L62 44', 2);
    return fin(c, s, 1.04);
  }
  D.meteor_golem = (fr) => drawMGolem(MGOLEM[fr] || fr === 'die1' || fr === 'die2' ? fr : 'walk0');
  D.meteor_golem.frames = true;
  MOTION.meteor_golem = { gait: 'stomp', bob: 0.02, tilt: 4, squash: 0.02, deathFx: 'shatter', deathTime: 1.0 };

  /* =========================================================
   * 사람형 조립기 — 골반 p · 기울기 lean · 발 nf/ff [x, 들림, 기울기] · 손 nh/fh · 머리 기울기 head
   * o: { leg, arm(관절 굵기·색), torso(c,B,P) 몸 좌표 그림, head(c,P), back(c,B,P) 뒤(망토), robe(c,B,P) 다리 위 옷자락,
   *      itemN(c,hand,P) 가까운 손 물건(손 아래), itemF, front(c,P) 맨 앞 효과 }
   * 몸 좌표: 골반 (0,0), 위가 −. 어깨 (−6,−22)·(6,−23), 목 (2,−26)
   * ========================================================= */
  function figure(c, P, o) {
    const B = frameOf(P.p[0], P.p[1], P.lean);
    const nSh = B.p(-6, -22);
    const fSh = B.p(6, -23);
    let s = '';
    if (o.back) s += o.back(c, B, P);
    if (o.itemF) s += o.itemF(c, P.fh, P, true);
    s += X.arm(c, fSh, P.fh, Object.assign({ pref: [-0.3, 1] }, o.arm, { upper: o.arm.farUpper || o.arm.upper, fore: o.arm.farFore || o.arm.fore })).svg;
    if (o.handF) s += o.handF(c, P.fh, P);
    if (!o.noLegs) {
      s += X.leg(c, B.p(4, -1), P.ff, Object.assign({}, o.leg, { thigh: o.leg.farThigh || o.leg.thigh, shin: o.leg.farShin || o.leg.shin, boot: o.leg.farBoot || o.leg.boot })).svg;
      s += X.leg(c, B.p(-4, 0), P.nf, o.leg).svg;
    }
    if (o.robe) s += o.robe(c, B, P);
    s += g(o.torso(c, B, P) + g(o.head(c, P), tr([2, -30], P.head || 0)), B.t);
    s += segN(c, [nSh[0] + 2, nSh[1] + 3], [nSh[0] + 5, nSh[1] + 14], 3, 2, SHADE, 0.16);
    s += X.arm(c, nSh, P.nh, Object.assign({ pref: [-0.3, 1] }, o.arm)).svg;
    if (o.itemN) s += o.itemN(c, P.nh, P, false);
    if (o.handN) s += o.handN(c, P.nh, P);
    if (o.front) s += o.front(c, P);
    return s;
  }
  const hand = (c, p, col, r = 2.6) => c.E(n(p[0]), n(p[1]), r, r, c.body(col, 0.4), TH);
  const WALK_FIG = {
    walk0: { p: [48, 64], lean: 4, nf: [58, 0, -8], ff: [38, 0, 14], head: 0 },
    walk1: { p: [48, 62.5], lean: 2, nf: [50, 0, 0], ff: [46, 7, 10], head: 0 },
    walk2: { p: [48, 64], lean: 4, nf: [38, 0, 14], ff: [58, 0, -8], head: 0 },
    walk3: { p: [48, 62.5], lean: 2, nf: [46, 7, 10], ff: [50, 0, 0], head: 0 },
  };
  const figPoses = (extra) => {
    const out = {};
    for (const k of ['walk0', 'walk1', 'walk2', 'walk3', 'aim', 'attack', 'die0']) out[k] = Object.assign({}, WALK_FIG[k] || WALK_FIG.walk1, extra[k] || {});
    return out;
  };

  /* =========================================================
   * 혜성 기사 — 은청색 판갑, 투구 뒤로 흐르는 혜성 꼬리 깃(금빛·흰빛), 별 끝 기마창.
   * walk: 행진 / aim: 창을 겨드랑이에 끼고 몸을 낮춤 / attack: 돌진 찌르기(별빛 꼬리) / 죽음: 휘청 → 무릎 → 갑옷 더미와 꺼진 꼬리
   * ========================================================= */
  const KNIGHT = figPoses({
    walk0: { nh: [56, 54], fh: [40, 58], lance: -14 }, walk1: { nh: [56, 53], fh: [42, 57], lance: -16 },
    walk2: { nh: [56, 54], fh: [40, 58], lance: -14 }, walk3: { nh: [56, 53], fh: [42, 57], lance: -16 },
    aim: { p: [46, 66], lean: -6, nf: [38, 0, 6], ff: [60, 0, 0], nh: [48, 52], fh: [40, 56], lance: 0, head: -4 },
    attack: { p: [52, 64], lean: 18, nf: [68, 0, -10], ff: [36, 0, 18], nh: [66, 48], fh: [56, 52], lance: 0, head: 8 },
    die0: { p: [46, 64], lean: -16, nf: [40, 0, 0], ff: [56, 0, 0], nh: [36, 52], fh: [62, 62], lance: -70, head: -20 },
  });
  function drawKnight(fr) {
    const c = mk(2.5);
    const steel = '#a8b4d8';
    const gold = '#e8c070';
    const P = KNIGHT[fr];
    // 혜성 꼬리 깃: 투구 꼭대기에서 뒤로 낮게 흐름
    const plume = (k = 1) => c.P(`M0 -9C-6 -12 -12 -10 ${n(-20 * k)} ${n(-8 - 2 * k)}C-14 -4 -8 -4 -2 -5Z`, c.lin([[0, '#ffffff'], [0.45, STAR], [1, '#ffb060']], 'h'), TH) +
      c.Pn(`M-1 -8C-6 -10 -11 -9 ${n(-16 * k)} ${n(-8 - 1.6 * k)}C-11 -6 -6 -6 -1 -6Z`, '#ffffff', 0.8);
    const lance = (hp, a) => g(seg(c, [-12, 0], [28, 0], 1.6, 1.3, c.body('#8a7ab0', 0.35)) + c.P('M28 -3L37 0L28 3Z', c.body('#e8eef8', 0.45), TH) +
      c.P(starP(39, 0, 3.4), STAR, TH) + c.P('M6 -4.4L11 -4.4L13 0L11 4.4L6 4.4Z', c.body(gold, 0.4), TH), tr(hp, a));
    let s = '';
    if (fr === 'die1' || fr === 'die2') {
      if (fr === 'die1') {
        s += figure(c, Object.assign({}, KNIGHT.die0, { p: [46, 72], lean: -30, nf: [40, 0, 30], ff: [58, 0, 20], nh: [32, 70], fh: [62, 74], head: -30 }), knightO(c, steel, gold, plume, 0.6));
        s += g(lance([0, 0], 0), tr([60, 86], -4));
      } else {
        s += c.P('M28 88.5L32 80L44 78L48 88.5Z', c.body(steel, 0.4)) + c.P('M46 88.5L50 78L62 76L66 88.5Z', c.body(sh(steel, -0.1), 0.4)) + g(c.P('M-8 4C-8 -4 -4 -8 2 -8C8 -8 10 -4 10 4Z', c.body(steel, 0.42)) + c.L('M0 -2H9', '#1a1438', 2), tr([72, 84], 20));
        s += g(lance([0, 0], 0), tr([22, 87], 0)) + dust(c, [[40, 70, 1.2], [56, 66, 1], [48, 60, 0.8]]);
      }
      return fin(c, s);
    }
    const O = knightO(c, steel, gold, plume, fr === 'attack' ? 1.4 : 1);
    O.itemN = (cc, hp) => lance(hp, P.lance);
    s += figure(c, P, O);
    if (fr === 'attack') s += streaks(c, ['M14 44L30 46', 'M10 54L28 54', 'M16 64L30 62'], STAR, 1.8, 0.7) + bloom(c, 90, 48, 8, STAR, 0.5);
    if (fr === 'aim') s += bloom(c, 92, 52, 6, STAR, 0.4);
    if (fr === 'die0') s += c.L('M66 30l6 -4M70 38l7 0', '#ffffff', 1.6, ' opacity=".8"');
    return fin(c, s);
  }
  function knightO(c, steel, gold, plume, pk) {
    const plate = c.body(steel, 0.45, -0.42);
    return {
      leg: { h: 5, l1: 12, l2: 12, r1: 4, r2: 3.4, r3: 3, thigh: plate, shin: plate, boot: c.body(sh(steel, -0.1), 0.4), farThigh: c.body(sh(steel, -0.2), 0.4), farShin: c.body(sh(steel, -0.2), 0.4), farBoot: c.body(sh(steel, -0.3), 0.4), len: 13, plate: true },
      arm: { l1: 10, l2: 10, r1: 3.6, r2: 3, r3: 2.6, upper: plate, fore: plate, farUpper: c.body(sh(steel, -0.22), 0.4), farFore: c.body(sh(steel, -0.22), 0.4) },
      torso: () => c.P('M-9 0C-11 -8 -10 -18 -6 -25L8 -26C11 -18 11 -8 9 0Z', plate) + c.Pn('M3 -26L8 -26C11 -18 11 -8 9 0L4 0C6 -10 6 -18 3 -26Z', SHADE, 0.22) +
        c.L('M-7 -12H8M-8 -6H8', sh(steel, -0.4), 1.2) + c.P(starP(0, -18, 4), c.body(gold, 0.4), TH) + c.P('M-10 -2H10V3H-10Z', c.body(gold, 0.4), TH) + spec(-5, -22, 0.9),
      head: () => g(plume(pk), 'translate(-1 -1)') + c.P('M-7 6C-8 -3 -4 -9 2 -9C8 -9 10 -4 10 3L10 7H-7Z', c.body(steel, 0.46, -0.4)) +
        c.P('M1 -1H10V3H1Z', '#1a1438', TH) + `<path d="M2 1H9.6" stroke="${STAR}" stroke-width="4" opacity=".6" ${c.soft()}/>` + c.L('M2.4 1H9.4', '#fff8e0', 1.4) +
        c.L('M-5 -4C-2 -7 2 -7.6 6 -6.6', '#ffffff', 1.2, ' opacity=".7"'),
      handN: (cc, p) => hand(cc, p, steel), handF: (cc, p) => hand(cc, p, sh(steel, -0.2)),
    };
  }
  D.comet_knight = (fr) => drawKnight(KNIGHT[fr] || fr === 'die1' || fr === 'die2' ? fr : 'walk0');
  D.comet_knight.frames = true;
  MOTION.comet_knight = { gait: 'march', bob: 0.02, tilt: 1.5, deathFx: 'sparks', deathTime: 0.9 };

  /* =========================================================
   * 그림자 별지기 — 남색 두건 망토(별 무늬), 그늘진 얼굴에 빛나는 두 눈, 놋쇠 망원경.
   * walk: 옷자락이 흔들림 / aim: 망원경을 눈에 댐(끝이 빛남) / attack: 망원경에서 별빛 화살 / 죽음: 망토가 주저앉아 빈 옷과 망원경
   * ========================================================= */
  const GAZER = figPoses({
    walk0: { nh: [56, 60], fh: [40, 60], scope: -30, hem: 2 }, walk1: { nh: [56, 59], fh: [42, 59], scope: -32, hem: 0 },
    walk2: { nh: [56, 60], fh: [40, 60], scope: -30, hem: -2 }, walk3: { nh: [56, 59], fh: [42, 59], scope: -32, hem: 0 },
    aim: { p: [47, 64], lean: -4, nh: [58, 36], fh: [54, 42], scope: -14, head: -6, glow: 1 },
    attack: { p: [47, 64], lean: -2, nh: [60, 38], fh: [55, 43], scope: -10, head: -4, glow: 2 },
    die0: { p: [46, 64], lean: -14, nh: [36, 56], fh: [60, 62], scope: 40, head: -18 },
  });
  function drawGazer(fr) {
    const c = mk(2.4);
    const robe = '#2e2a68';
    const brass = '#e0b060';
    const P = GAZER[fr];
    const scope = (hp, a, glow) => g(c.P('M-4 -2.6H18V2.6H-4Z', c.body(brass, 0.4), TH) + c.P('M18 -3.6H24V3.6H18Z', c.body(brass, 0.45), TH) + c.L('M4 -2.6V2.6M11 -2.6V2.6', sh(brass, -0.4), 1) +
      (glow ? bloom(c, 25, 0, glow > 1 ? 9 : 6, STAR, 0.7) + c.E(24.6, 0, 2.4, 3, '#fff8e0', ' stroke="none"') : ''), tr(hp, a));
    const hood = () => c.P('M-9 6C-12 -4 -6 -12 2 -12C10 -12 13 -5 12 4L9 8C6 2 2 0 -2 1C-5 2 -7 4 -9 6Z', c.body(robe, 0.38, -0.4)) +
      c.P('M-2 1C2 0 6 2 9 8L8 9C4 6 0 5 -3 6Z', '#141030', TH) + c.Pn('M-3 6C0 3 6 4 9 8L-3 9Z', '#0c0a20', 0.9) +
      c.E(3, 5, 1.4, 1, STAR, ' stroke="none"') + c.E(7.4, 5.4, 1.2, 0.9, STAR, ' stroke="none"') + bloom(c, 5, 5, 4, STAR, 0.4) +
      c.P(starP(-6, -6, 2), STAR, ' stroke-width="1"');
    const robeSkirt = (cc, B, P2) => {
      const h = P2.hem || 0;
      const a = B.p(-10, -2);
      const b = B.p(10, -2);
      return cc.P(`M${pt(a)}L${pt(b)}C${n(b[0] + 4)} ${n(b[1] + 10)} ${n(64 + h)} 80 ${n(66 + h)} 86Q${n(50 + h)} 89 ${n(32 + h * 0.5)} 86C${n(34)} 78 ${n(a[0] - 4)} ${n(a[1] + 10)} ${pt(a)}Z`, cc.body(robe, 0.36, -0.42)) +
        stars(cc, [[40 + h * 0.5, 80, 1.8], [56 + h, 76, 1.6]]) + inl(cc, `M${n(46 + h * 0.3)} ${n(B.p(0, 0)[1] + 2)}Q${n(48 + h * 0.6)} 78 ${n(48 + h)} 86`, robe, 1.1);
    };
    const O = {
      leg: { h: 4.6, l1: 12, l2: 11, r1: 3.2, r2: 2.8, r3: 2.4, thigh: c.body('#1e1a44', 0.3), shin: c.body('#1e1a44', 0.3), boot: c.body('#3a2a20', 0.35), len: 12 },
      arm: { l1: 10, l2: 10, r1: 3.4, r2: 3, r3: 2.6, upper: c.body(robe, 0.38), fore: c.body(robe, 0.38), farUpper: c.body(sh(robe, -0.2), 0.35), farFore: c.body(sh(robe, -0.2), 0.35) },
      torso: () => c.P('M-10 0C-12 -8 -11 -18 -7 -25L8 -26C12 -18 12 -8 10 0Z', c.body(robe, 0.38, -0.42)) + stars(c, [[-3, -14, 2], [4, -8, 1.6]]) + c.L('M-8 -24C-2 -20 4 -20 9 -25', '#4a46a0', 1.4),
      head: hood, robe: robeSkirt,
      itemN: (cc, hp, P2) => scope(hp, P2.scope, P2.glow || 0),
      handN: (cc, p) => hand(cc, p, '#c8b8a8', 2.4), handF: (cc, p) => hand(cc, p, '#a898a0', 2.4),
    };
    let s = '';
    if (fr === 'die1' || fr === 'die2') {
      if (fr === 'die1') {
        s += c.P('M26 88.5C28 74 40 66 52 66C66 66 74 76 74 88.5Z', c.body(robe, 0.36, -0.4)) + g(hood(), tr([52, 66], 30, 0.9)) + stars(c, [[40, 80, 2], [60, 78, 1.6]]);
        s += g(scope([0, 0], 0, 0), tr([66, 84], 10));
      } else {
        s += c.P('M24 88.5C28 82 40 78 52 79C64 78 74 82 76 88.5Z', c.body(robe, 0.36, -0.4)) + g(scope([0, 0], 0, 0), tr([30, 86], -6)) + dust(c, [[48, 70, 1.2], [56, 64, 1], [44, 60, 0.8]]);
      }
      return fin(c, s);
    }
    s += figure(c, P, O);
    if (fr === 'attack') s += c.L('M84 30L96 26', STAR, 2.4) + c.P(starP(92, 27, 4), STAR, TH) + streaks(c, ['M80 32L90 30'], '#ffffff', 1.4, 0.8);
    if (fr === 'die0') s += c.L('M66 30l6 -4M70 38l7 0', '#ffffff', 1.6, ' opacity=".8"');
    return fin(c, s);
  }
  D.umbral_stargazer = (fr) => drawGazer(GAZER[fr] || fr === 'die1' || fr === 'die2' ? fr : 'walk0');
  D.umbral_stargazer.frames = true;
  MOTION.umbral_stargazer = { gait: 'shuffle', bob: 0.012, tilt: 0, sway: 0.01, deathFx: 'mist', deathTime: 0.8 };

  /* =========================================================
   * 일식 사제 — 짙은 자주 사제복과 금빛 테, 머리 뒤 일식 후광(검은 원 + 금빛 코로나), 일식 구슬 지팡이.
   * walk: 천천히 / aim: 지팡이를 들어 기도 / attack(시전): 후광에서 빛 고리 / 죽음: 후광이 꺼지며 쓰러짐
   * ========================================================= */
  const PRIEST = figPoses({
    walk0: { nh: [58, 62], fh: [40, 58], staff: -92, hem: 2 }, walk1: { nh: [58, 61], fh: [41, 57], staff: -91, hem: 0 },
    walk2: { nh: [58, 62], fh: [40, 58], staff: -92, hem: -2 }, walk3: { nh: [58, 61], fh: [41, 57], staff: -91, hem: 0 },
    aim: { p: [47, 64], lean: -4, nh: [62, 46], fh: [40, 44], staff: -96, head: -8, glow: 1, open: 1 },
    attack: { p: [47, 64], lean: 2, nh: [66, 40], fh: [38, 42], staff: -100, head: -10, glow: 2, open: 1 },
    die0: { p: [46, 64], lean: -14, nh: [36, 56], fh: [60, 62], staff: -150, head: -18 },
  });
  function drawPriest(fr) {
    const c = mk(2.4);
    const robe = '#5a2a6a';
    const gold = '#e8c070';
    const P = PRIEST[fr];
    const eclipse = (r, glow) => bloom(c, 0, 0, r * 1.7, gold, glow ? 0.6 : 0.4) + c.E(0, 0, r * 1.25, r * 1.25, 'none', ` stroke="${gold}" stroke-width="2"`) +
      c.E(0, 0, r, r, c.rad([[0, '#2a1e3a'], [1, '#0e0a18']], 0.4, 0.4, 0.6)) + c.Pn(`M${r * 0.3} ${-r}A${r} ${r} 0 0 1 ${r} ${-r * 0.2}`, 'none');
    const staff = (hp, a, glow) => g(seg(c, [-12, 0], [26, 0], 1.4, 1.6, c.body('#7a5a3a', 0.35)) + g(eclipse(4.4, glow), 'translate(31 0)'), tr(hp, a));
    const head = () => g(eclipse(9, (P.glow || 0) > 0), 'translate(-4 -2)') +
      c.P('M-6 6C-7 -2 -3 -8 3 -8C9 -8 11 -3 10 4L9 8H-5Z', c.body('#d8b8a0', 0.42)) +
      c.P('M-8 4C-9 -6 -3 -11 3 -11C10 -11 13 -5 12 2L9 -2C6 -6 0 -6 -4 -3Z', c.body(robe, 0.38), TH) +
      (fr === 'attack' || fr === 'aim' ? c.L('M3 1.6l2 1M7 1.6l2 .6', '#2a1a2a', 1.3) : c.E(4, 2, 1, 1.3, '#2a1a2a', ' stroke="none"') + c.E(8, 2, 0.9, 1.2, '#2a1a2a', ' stroke="none"')) +
      c.L('M4.6 6Q6.4 6.8 8 6', '#6a3a3a', 1);
    const O = {
      leg: { h: 4.6, l1: 12, l2: 11, r1: 3.2, r2: 2.8, r3: 2.4, thigh: c.body('#3a1e44', 0.3), shin: c.body('#3a1e44', 0.3), boot: c.body('#2a1a20', 0.35), len: 12 },
      arm: { l1: 10, l2: 10, r1: 3.6, r2: 3.2, r3: 2.6, upper: c.body(robe, 0.38), fore: c.body(robe, 0.38), farUpper: c.body(sh(robe, -0.2), 0.35), farFore: c.body(sh(robe, -0.2), 0.35) },
      torso: () => c.P('M-10 0C-12 -8 -11 -18 -7 -25L8 -26C12 -18 12 -8 10 0Z', c.body(robe, 0.38, -0.42)) + c.P('M-1 -26L2 -26L3 0L-2 0Z', c.body(gold, 0.4), TH) + c.E(0.6, -16, 2.6, 2.6, c.rad([[0, '#2a1e3a'], [1, '#0e0a18']]), ` stroke="${gold}" stroke-width="1.2"`),
      head, robe: (cc, B, P2) => {
        const h = P2.hem || 0;
        const a = B.p(-10, -2);
        const b = B.p(10, -2);
        return cc.P(`M${pt(a)}L${pt(b)}C${n(b[0] + 3)} ${n(b[1] + 10)} ${n(63 + h)} 80 ${n(64 + h)} 87Q${n(48 + h)} 89.6 ${n(32 + h * 0.5)} 87C${n(34)} 78 ${n(a[0] - 3)} ${n(a[1] + 10)} ${pt(a)}Z`, cc.body(robe, 0.36, -0.42)) +
          cc.L(`M${n(64 + h - 1)} 85Q${n(48 + h)} 87.6 ${n(33 + h * 0.5)} 85`, gold, 1.6) + inl(cc, `M${n(48 + h * 0.3)} ${n(B.p(0, 0)[1] + 2)}Q${n(48 + h * 0.6)} 78 ${n(48 + h)} 86`, robe, 1.1);
      },
      itemF: (cc, hp, P2) => staff(hp, P2.staff, P2.glow || 0),
      handN: (cc, p) => hand(cc, p, '#d8b8a0', 2.4), handF: (cc, p) => hand(cc, p, '#b89a88', 2.4),
    };
    let s = '';
    if (fr === 'die1' || fr === 'die2') {
      if (fr === 'die1') {
        s += c.P('M24 88.5C26 74 38 68 52 68C66 68 76 76 76 88.5Z', c.body(robe, 0.36, -0.4)) + c.L('M26 86Q50 90 74 86', gold, 1.6) + g(c.E(0, 0, 8, 8, '#1a1428'), tr([66, 70])) + g(staff([0, 0], 0, 0), tr([30, 86], -4));
      } else {
        s += c.P('M24 88.5C28 82 40 78 52 79C64 78 74 82 76 88.5Z', c.body(robe, 0.36, -0.4)) + c.L('M28 87Q50 90 72 87', gold, 1.4) + g(staff([0, 0], 0, 0), tr([28, 86], -2)) + dust(c, [[48, 70, 1.2], [56, 64, 1], [44, 60, 0.8]], gold);
      }
      return fin(c, s);
    }
    s += figure(c, P, O);
    if (fr === 'attack') s += `<circle cx="50" cy="34" r="22" fill="none" stroke="${gold}" stroke-width="2" opacity=".7"/><circle cx="50" cy="34" r="30" fill="none" stroke="${gold}" stroke-width="1.4" opacity=".45"/>`;
    if (fr === 'die0') s += c.L('M66 30l6 -4M70 38l7 0', '#ffffff', 1.6, ' opacity=".8"');
    return fin(c, s);
  }
  D.eclipse_priest = (fr) => drawPriest(PRIEST[fr] || fr === 'die1' || fr === 'die2' ? fr : 'walk0');
  D.eclipse_priest.frames = true;
  MOTION.eclipse_priest = { gait: 'shuffle', bob: 0.012, tilt: 0, sway: 0.01, deathFx: 'ash', deathTime: 0.9 };

  /* =========================================================
   * 위상 망령 — 반투명 보랏빛 망령, 다리 대신 일렁이는 꼬리, 긴 손톱. 몸 둘레에 어긋난 잔상(위상).
   * walk: 둥실 + 잔상 / aim: 손톱을 치켜듦 / attack: 할퀴기 / 죽음: 몸이 조각나 흩어짐
   * ========================================================= */
  const WRAITH = {
    walk0: { y: 0, tail: 4, nh: [60, 56], fh: [40, 58], echo: 4 }, walk1: { y: -2, tail: -2, nh: [60, 54], fh: [40, 56], echo: -3 },
    walk2: { y: -3, tail: -5, nh: [60, 55], fh: [40, 57], echo: 5 }, walk3: { y: -2, tail: -2, nh: [60, 54], fh: [40, 56], echo: -4 },
    aim: { y: -2, tail: 2, nh: [54, 30], fh: [40, 34], echo: 0, lean: -8 }, attack: { y: 0, tail: 6, nh: [76, 58], fh: [64, 52], echo: 0, lean: 14 }, die0: { y: 0, tail: 0, nh: [40, 46], fh: [62, 62], echo: 8, lean: -14 },
  };
  function drawWraith(fr) {
    const c = mk(2.3);
    const P = WRAITH[fr];
    const ghost = '#b8a8f0';
    const bodyG = c.lin([[0, '#efe8ff'], [0.5, ghost], [1, '#5a4aa8']], 'v');
    const bodyD = (dx, op) => {
      const y = P.y;
      return `<g transform="translate(${dx} 0)"${op != null ? ` opacity="${op}"` : ''}>` +
        c.P(`M38 ${40 + y}C36 ${26 + y} 48 ${18 + y} 56 ${20 + y}C64 ${22 + y} 66 ${32 + y} 64 ${44 + y}C64 ${58 + y} ${60 + P.tail} ${70 + y} ${54 + P.tail} 84C${50 + P.tail * 0.5} 76 ${46} ${80 + y * 0.5} ${42 - P.tail * 0.3} 86C${42} 74 ${38} ${60 + y} 38 ${40 + y}Z`, bodyG) +
        c.Pn(`M58 ${22 + y}C64 ${26 + y} 66 ${36 + y} 63 ${50 + y}L58 ${50 + y}C61 ${38 + y} 61 ${28 + y} 58 ${22 + y}Z`, '#ffffff', 0.4) +
        c.P(`M48 ${29 + y}L55 ${32 + y}L53 ${35 + y}L48 ${33 + y}Z`, '#1a0e38', ' stroke="none"') + c.P(`M58 ${31 + y}L63 ${28 + y}L63 ${32 + y}L59 ${34 + y}Z`, '#1a0e38', ' stroke="none"') +
        bloom(c, 52, 32 + y, 3, '#e8d8ff', 0.6) + c.E(52, 32.6 + y, 0.9, 0.9, '#f4ecff', ' stroke="none"') + c.E(61, 31 + y, 0.8, 0.8, '#f4ecff', ' stroke="none"') +
        c.P(`M49 ${40 + y}L52 ${43 + y}L54 ${40.6 + y}L57 ${44 + y}L59 ${40.4 + y}L62 ${42.6 + y}L62 ${39 + y}C58 ${37 + y} 53 ${37 + y} 49 ${40 + y}Z`, '#1a0e38', ' stroke="none"') + '</g>';
    };
    const claw = (p, a, far) => g(seg(c, [0, 0], [8, 0], 2.4, 1.8, c.body(sh(ghost, far ? -0.2 : 0), 0.4)) + c.P('M8 -2L16 -5L9 0L16 2L9 2L14 6L8 2Z', c.body('#efe8ff', 0.45), TH), tr(p, a));
    let s = '';
    if (fr === 'die1' || fr === 'die2') {
      if (fr === 'die1') {
        for (const [x, y, a, k] of [[38, 44, -30, 0.7], [62, 38, 24, 0.6], [50, 60, 8, 0.8], [30, 64, -50, 0.5], [70, 62, 40, 0.5]]) s += g(c.P('M-8 -6L6 -8L10 4L-4 8Z', bodyG), tr([x, y], a, k));
        s += bloom(c, 50, 50, 20, ghost, 0.4) + dust(c, [[40, 30, 1.4], [62, 26, 1.2], [56, 72, 1.2]], '#e8d8ff');
      } else {
        s += dust(c, [[40, 80, 1.4], [52, 76, 1.2], [60, 82, 1], [46, 68, 1], [56, 62, 0.8]], '#e8d8ff', 0.85) + bloom(c, 50, 78, 10, ghost, 0.3);
      }
      return fin(c, s);
    }
    const lean = P.lean || 0;
    let body = '';
    if (P.echo) body += bodyD(-P.echo * 2, 0.3) + bodyD(P.echo * 1.4, 0.2);
    body += claw(P.fh, angOf([44, 40 + P.y], P.fh), true) + bodyD(0) + claw(P.nh, angOf([54, 40 + P.y], P.nh), false);
    s += g(body, `rotate(${lean} 50 80)`);
    if (fr === 'attack') s += c.Pn('M70 40Q90 52 76 72Q84 54 68 44Z', '#e8d8ff', 0.6) + streaks(c, ['M74 42L86 50', 'M72 52L84 60'], '#ffffff', 1.4, 0.7);
    if (fr === 'aim') s += bloom(c, 54, 30, 8, '#e8d8ff', 0.4);
    if (fr === 'walk0' || fr === 'walk2') s += c.L('M28 50l-4 0M30 60l-5 1', '#e8d8ff', 1.4, ' opacity=".6"');
    return fin(c, s);
  }
  D.phase_wraith = (fr) => drawWraith(WRAITH[fr] || fr === 'die1' || fr === 'die2' ? fr : 'walk0');
  D.phase_wraith.frames = true;
  MOTION.phase_wraith = { gait: 'float', bob: 0.04, tilt: 0, sway: 0.03, squash: 0.03, deathFx: 'mist', deathTime: 0.8 };

  /* =========================================================
   * 그믐달 군주(보스) — 그믐달 모양 머리(어두운 달, 금빛 테)와 별 왕관, 밤하늘 망토(별), 검은 달 구슬 홀.
   * walk: 위엄 있게 / aim: 홀을 높이 들어 별빛을 빨아들임 / attack: 홀을 내리쳐 어둠의 물결 / 죽음: 달에 금 → 무너짐 → 깨진 달과 흩어지는 별
   * ========================================================= */
  const MONARCH = figPoses({
    walk0: { nh: [66, 62], fh: [40, 58], sc: -88, hem: 2 }, walk1: { nh: [66, 61], fh: [42, 57], sc: -87, hem: 0 },
    walk2: { nh: [66, 62], fh: [40, 58], sc: -88, hem: -2 }, walk3: { nh: [66, 61], fh: [42, 57], sc: -87, hem: 0 },
    aim: { p: [47, 64], lean: -6, nh: [64, 44], fh: [42, 48], sc: -64, head: -8, glow: 1 },
    attack: { p: [50, 64], lean: 14, nh: [70, 58], fh: [44, 52], sc: 30, head: 8, glow: 2 },
    die0: { p: [46, 64], lean: -16, nh: [36, 54], fh: [60, 62], sc: -150, head: -20 },
  });
  function drawMonarch(fr) {
    const c = mk(2.2);
    const robe = '#2a2058';
    const gold = '#e8c070';
    const P = MONARCH[fr];
    const moonHead = (cr = 0) => c.P('M2 -14C-10 -14 -14 -4 -12 4C-10 12 -2 16 6 14C0 12 -4 6 -4 0C-4 -6 0 -12 2 -14Z', c.body('#4a4278', 0.42, -0.42)) +
      c.L('M2 -14C-10 -14 -14 -4 -12 4C-10 12 -2 16 6 14', gold, 1.6) +
      c.E(-6, -1, 1.6, 2, STAR, ' stroke="none"') + bloom(c, -6, -1, 3, STAR, 0.6) +
      c.P('M-12 -12L-10 -20L-6 -14L-2 -22L2 -14L6 -18L5 -11Z', c.body(gold, 0.45), TH) + c.P(starP(-2, -24, 3), STAR, TH) +
      (cr ? c.L('M-10 -6L-4 0L-9 6M-2 -10L2 -4', '#fff4d0', 1.6) : '');
    const scepter = (hp, a, glow) => g(seg(c, [-10, 0], [28, 0], 1.6, 1.8, c.body(gold, 0.4)) + bloom(c, 34, 0, glow ? 12 : 7, '#8a6ae8', glow ? 0.7 : 0.4) +
      c.E(34, 0, 6, 6, c.rad([[0, '#3a2a68'], [1, '#0e0a24']], 0.4, 0.4, 0.6), ` stroke="${gold}" stroke-width="1.6"`) + c.P('M34 -6A6 6 0 0 1 34 6A4 6 0 0 0 34 -6Z', STAR, ' stroke="none"'), tr(hp, a));
    const cape = (cc, B, P2) => {
      const h = P2.hem || 0;
      const a = B.p(-7, -26);
      const b = B.p(8, -26);
      const d = `M${pt(b)}C${n(b[0] + 6)} ${n(b[1] + 16)} ${n(62 + h * 0.5)} 78 ${n(60 + h)} 88Q${n(36 - h)} 92 ${n(14 - h * 1.5)} 86C${n(22 - h)} 70 ${n(a[0] - 10)} ${n(a[1] + 16)} ${pt(a)}Z`;
      return cc.P(d, cc.lin([[0, '#3a3080'], [1, '#141038']], 'v')) + stars(cc, [[26 - h, 76, 2.2], [34 - h, 62, 1.8], [44, 80, 1.6], [22 - h, 84, 1.4], [40 - h * 0.6, 50, 1.4]]) +
        cc.L(`M${n(60 + h - 1)} 86Q${n(36 - h)} 90 ${n(16 - h * 1.5)} 84`, gold, 1.4);
    };
    const O = {
      leg: { h: 4.6, l1: 12, l2: 11, r1: 3.6, r2: 3.2, r3: 2.8, thigh: c.body('#1e1844', 0.3), shin: c.body('#1e1844', 0.3), boot: c.body(gold, 0.4), len: 13 },
      arm: { l1: 10, l2: 10, r1: 3.8, r2: 3.2, r3: 2.8, upper: c.body(robe, 0.38), fore: c.body(robe, 0.38), farUpper: c.body(sh(robe, -0.2), 0.35), farFore: c.body(sh(robe, -0.2), 0.35) },
      back: cape,
      torso: () => c.P('M-10 0C-12 -8 -11 -18 -7 -26L8 -27C12 -18 12 -8 10 0Z', c.body(robe, 0.38, -0.42)) + c.P('M-8 -24L9 -25L7 -20L-6 -19Z', c.body(gold, 0.4), TH) + c.P(starP(1, -12, 3.6), STAR, TH) + c.P('M-10 -2H10V3H-10Z', c.body(gold, 0.4), TH),
      head: () => moonHead(fr === 'die0' ? 1 : 0),
      itemN: (cc, hp, P2) => scepter(hp, P2.sc, P2.glow || 0),
      handN: (cc, p) => hand(cc, p, '#6a5a98', 2.8), handF: (cc, p) => hand(cc, p, '#4a3e78', 2.8),
    };
    let s = '';
    if (fr === 'die1' || fr === 'die2') {
      if (fr === 'die1') {
        s += cape(c, frameOf(46, 72, -20), { hem: 0 }) + c.P('M30 88.5C32 76 42 70 52 70C64 70 70 78 70 88.5Z', c.body(robe, 0.36, -0.4));
        s += g(moonHead(1), tr([58, 66], 40, 1.1)) + g(scepter([0, 0], 0, 0), tr([26, 86], -6)) + stars(c, [[30, 40, 3], [70, 34, 2.6], [50, 26, 2.2]]);
      } else {
        s += c.P('M20 88.5C26 82 40 80 50 80C62 80 74 82 80 88.5Z', c.lin([[0, '#3a3080'], [1, '#141038']], 'v'));
        s += g(c.P('M2 -14C-10 -14 -14 -4 -12 4L-4 2C-4 -4 0 -10 2 -14Z', c.body('#4a4278', 0.42)), tr([40, 82], 60)) + g(c.P('M-12 4C-10 12 -2 16 6 14C0 12 -4 6 -4 2Z', c.body('#4a4278', 0.42)), tr([62, 84], -30));
        s += g(scepter([0, 0], 0, 0), tr([24, 86], -4)) + stars(c, [[46, 66, 2.4], [56, 60, 2], [40, 56, 1.6], [62, 48, 1.4]]) + dust(c, [[50, 40, 1.2], [36, 46, 1]]);
      }
      return fin(c, s, 1.02);
    }
    s += figure(c, P, O);
    if (fr === 'aim') s += [[70, 18], [86, 28], [52, 12], [80, 8]].map(([x, y]) => c.L(`M${x} ${y}L${P.nh[0] + 30} ${P.nh[1] - 30}`, STAR, 1.2, ' opacity=".6"')).join('') + stars(c, [[70, 18, 2], [86, 28, 1.6], [52, 12, 1.6]]);
    if (fr === 'attack') s += `<path d="M60 88Q76 76 96 84" fill="none" stroke="#8a6ae8" stroke-width="6" opacity=".55" ${c.soft()}/>` + c.L('M62 88Q78 78 94 84', '#c8b8ff', 2) + dust(c, [[84, 74, 1.4], [92, 80, 1.2]], '#c8b8ff');
    if (fr === 'die0') s += c.L('M68 26l6 -4M72 34l7 0', '#ffffff', 1.6, ' opacity=".8"');
    return fin(c, s, 1.02);
  }
  D.gloom_monarch = (fr) => drawMonarch(MONARCH[fr] || fr === 'die1' || fr === 'die2' ? fr : 'walk0');
  D.gloom_monarch.frames = true;
  MOTION.gloom_monarch = { gait: 'walk', bob: 0.02, tilt: 1.5, sway: 0.01, deathFx: 'sparks', deathTime: 1.3 };

  RG.art._en6 = { STAR, NIGHT, starP, stars, dust };
})();
