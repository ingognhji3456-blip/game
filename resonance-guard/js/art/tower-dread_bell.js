'use strict';

/* =========================================================
 * 탑 그림 — 🌑 공포의 종 `dread_bell` (2차 탑, 2026-11-11). 설계: docs/design/towers.md D4
 *  검보라 돌 종탑에 금이 간 보랏빛 종 — 금 사이로 보랏빛이 새고 유령 연기가 감돕니다. 사람 없음.
 *  idle: 종이 가만히 걸림, 금이 은은하게 빛남 · aim: 종이 뒤로 젖혀짐(금이 밝아짐)
 *  fire: 종이 앞으로 흔들리며 보랏빛 소리 고리 + 유령 연기가 퍼짐
 *  (겨울 종과 달리: 사람·눈 없음, 검보라 돌·금 간 종·유령·까마귀)
 *  4A 파멸의 종: 거대한 검은 종 · 해골 장식 · 보랏빛 불꽃 화로 · 4B 영혼의 종: 영혼 불꽃이 도는 반투명 수정 종
 * ========================================================= */
(() => {
  const { f, M, STONE, fine, poly, aura, spark, plat } = RG.art._tw;
  const A = RG.art._tw.A;
  const { footShade, swingBell, soundRings, stoneRect, OP, G, rotP } = A;
  const T = RG.art._tw.T;
  const ROCK = STONE.dark; // 검보라 돌
  const GLOW = '#c890ff'; // 금·눈에서 새는 보랏빛
  const SOUL = '#a8ecff'; // 영혼 불꽃
  const ANG = { idle: 0, aim: -17, fire: 13 };

  /* ---------- 부품 ---------- */
  /** 종에 간 금(종 좌표: 꼭대기 (x,y), 너비 w, 높이 ht) — 종과 함께 돌도록 ang 회전 */
  function cracks(c, x, y, w, ht, ang, lit) {
    const P = (u, v) => `${f(x + u * w)} ${f(y + v * ht)}`;
    const d = `M${P(0.06, 0.18)}L${P(0.12, 0.34)}L${P(0.05, 0.46)}L${P(0.16, 0.62)}L${P(0.1, 0.74)}L${P(0.2, 0.9)}M${P(0.05, 0.46)}L${P(-0.06, 0.55)}M${P(-0.2, 0.62)}L${P(-0.14, 0.74)}L${P(-0.24, 0.86)}`;
    const body = c.ln(d, '#1c1426', 2.6) + c.ln(d, GLOW, 1.2, 0.5 + lit * 0.5);
    return G(body, ang ? `rotate(${f(ang)} ${f(x)} ${f(y)})` : '');
  }
  /** 유령 연기 한 가닥 — 아래 (x,y), 크기 k, 꼬리가 위로 말려 올라감 */
  function wisp(c, x, y, k, col = '#b8a0d8', a = 0.6, flip = 1) {
    const P = (u, v) => `${f(x + u * k * flip)} ${f(y + v * k)}`;
    const d = `M${P(-3, 0)}Q${P(-4.4, -5)} ${P(-1, -8)}Q${P(1.4, -11)} ${P(-1.2, -14.5)}Q${P(3.6, -12)} ${P(2.6, -7.4)}Q${P(4.4, -3)} ${P(3, 0)}Q${P(0, 2.2)} ${P(-3, 0)}Z`;
    let s = c.p(d, c.vg(c.h.mix(col, '#ffffff', 0.3), 0.3, -0.25), 0);
    s += c.e(x - 0.6 * k * flip, y - 2 * k, 0.9 * k, 1.2 * k, '#2a1838', 0, ' opacity="0.55"') + c.e(x + 1.3 * k * flip, y - 2.2 * k, 0.8 * k, 1.1 * k, '#2a1838', 0, ' opacity="0.55"');
    return OP(s, a);
  }
  /** 해골 장식 — 가운데 (x,y), 크기 k, 눈빛 eye */
  function skull(c, x, y, k, eye) {
    const P = (u, v) => `${f(x + u * k)} ${f(y + v * k)}`;
    let s = c.p(`M${P(-4, 1)}Q${P(-4.6, -5.2)} ${P(0, -5.4)}Q${P(4.6, -5.2)} ${P(4, 1)}L${P(2.6, 2.4)}V${P(2.6, 4.2).split(' ')[1]}H${f(x - 2.6 * k)}V${P(-2.6, 2.4).split(' ')[1]}Z`, c.vg('#e6dccb', 0.3, -0.35), 1.6);
    s += c.e(x - 1.7 * k, y - 0.7 * k, 1.3 * k, 1.5 * k, '#2a1838', 0) + c.e(x + 1.7 * k, y - 0.7 * k, 1.3 * k, 1.5 * k, '#2a1838', 0);
    if (eye) s += c.ci(x - 1.7 * k, y - 0.6 * k, 0.6 * k, eye, 0) + c.ci(x + 1.7 * k, y - 0.6 * k, 0.6 * k, eye, 0);
    s += c.p(`M${P(0, 0.9)}L${P(-0.7, 2)}H${f(x + 0.7 * k)}Z`, '#2a1838', 0);
    s += c.ln(`M${P(-1.3, 2.6)}V${P(-1.3, 4).split(' ')[1]}M${P(0, 2.6)}V${P(0, 4).split(' ')[1]}M${P(1.3, 2.6)}V${P(1.3, 4).split(' ')[1]}`, '#6a5a58', 0.9, 0.9);
    s += c.ln(`M${P(-2.6, -3.6)}Q${P(-1.6, -4.6)} ${P(0, -4.6)}`, '#ffffff', 1.1, 0.7);
    return s;
  }
  /** 보랏빛 불꽃 — 아래 가운데 (x,y), 너비 w, 높이 ht */
  function pflame(c, x, y, w, ht, col = '#9a5ae8', core = '#f0dcff', ow = 2.2) {
    const P = (u, v) => `${f(x + u * w)} ${f(y - v * ht)}`;
    const gid = c.def(`pf${col}`, (id) => c.lgc(id, [[0, c.h.shade(col, 0.35)], [0.6, col], [1, c.h.shade(col, -0.3)]]));
    let s = aura(c, x, y - ht * 0.45, w * 1.4, ht * 0.9, col, 0.5);
    s += c.p(`M${P(0, 0)}C${P(-0.55, 0)} ${P(-0.6, 0.4)} ${P(-0.34, 0.62)}C${P(-0.3, 0.46)} ${P(-0.16, 0.46)} ${P(-0.14, 0.54)}C${P(-0.16, 0.8)} ${P(0, 0.86)} ${P(0.08, 1)}C${P(0.14, 0.78)} ${P(0.36, 0.72)} ${P(0.3, 0.48)}C${P(0.42, 0.56)} ${P(0.48, 0.64)} ${P(0.46, 0.72)}C${P(0.66, 0.44)} ${P(0.56, 0)} ${P(0, 0)}Z`, gid, ow);
    s += c.p(`M${P(0, 0.08)}C${P(-0.28, 0.08)} ${P(-0.28, 0.34)} ${P(0, 0.62)}C${P(0.28, 0.34)} ${P(0.28, 0.08)} ${P(0, 0.08)}Z`, core, 0);
    return s;
  }
  /** 영혼 불꽃 — 아래 (x,y), 크기 k: 외곽선 없이 빛나는 하늘빛 불꽃(꼬리가 위로) */
  function soulFlame(c, x, y, k) {
    const P = (u, v) => `${f(x + u * k)} ${f(y + v * k)}`;
    let s = aura(c, x, y - 4 * k, 6 * k, 6 * k, SOUL, 0.55);
    s += c.p(`M${P(0, 0)}C${P(-3.4, 0)} ${P(-3.6, -3.6)} ${P(-1.6, -6)}Q${P(-1.2, -8.4)} ${P(0.6, -11)}Q${P(0, -7.6)} ${P(2.2, -5.6)}C${P(3.8, -3.4)} ${P(3, 0)} ${P(0, 0)}Z`, c.vg('#7ad0f0', 0.45, -0.1), 0);
    s += c.e(x, y - 2.4 * k, 1.4 * k, 1.9 * k, '#f4fdff', 0);
    return s;
  }
  /** 까마귀 — 발 (x,y), 크기 k, 방향 dir */
  function crow(c, x, y, k, dir = 1) {
    const P = (u, v) => `${f(x + u * k * dir)} ${f(y + v * k)}`;
    let s = c.p(`M${P(-4.6, -1.6)}L${P(-7.4, -0.4)}L${P(-4.2, -3.2)}Q${P(-2, -6.6)} ${P(1.6, -6)}Q${P(3.6, -8.6)} ${P(5, -7)}L${P(7.2, -6.4)}L${P(5.2, -5.4)}Q${P(4.6, -2.6)} ${P(2, -1.2)}Q${P(-1, -0.4)} ${P(-4.6, -1.6)}Z`, c.vg('#3a3048', 0.25, -0.3), 1.6);
    s += c.ci(x + 4 * k * dir, y - 6.9 * k, 0.6 * k, GLOW, 0);
    s += c.ln(`M${P(0.4, -1)}V${f(y)}M${P(1.6, -1.2)}V${f(y)}`, '#3a3048', 1, 1);
    s += c.ln(`M${P(-2.6, -3.4)}Q${P(-0.2, -4.6)} ${P(2, -3.6)}`, '#7a6a90', 1, 0.8);
    return s;
  }
  /** 울림: 보랏빛 소리 고리 + 퍼지는 유령 연기 */
  function toll(c, x, y, r, k = 1) {
    let s = aura(c, x, y, r * 1.7, r * 1.3, GLOW, 0.4);
    s += soundRings(c, x, y, [r, r * 1.4, r * 1.85], GLOW, 2.6);
    s += wisp(c, x - r * 1.5, y + r * 0.2, 1.1 * k, '#b8a0d8', 0.55, -1) + wisp(c, x + r * 1.5, y - r * 0.1, 1 * k, '#b8a0d8', 0.55, 1);
    return s;
  }
  /** 걸린 종 그리기(자세별 각도 + 금 + 울림) → { s, center } */
  function hangBell(c, x, y, w, ht, col, pose, o = {}) {
    const ang = ANG[pose] * (o.k || 1);
    const b = swingBell(c, x, y, w, ht, col, ang, pose, { yoke: o.yoke || '#3a2a40' });
    const lit = pose === 'idle' ? 0.35 : 1;
    let s = '';
    if (o.halo) s += aura(c, x, y + ht * 0.55, w * 0.9, ht * 0.8, GLOW, 0.25 + lit * 0.35);
    s += b.s + (o.noCrack ? '' : cracks(c, x, y, w, ht, ang, lit));
    if (o.extra) s += G(o.extra, ang ? `rotate(${f(ang)} ${f(x)} ${f(y)})` : '');
    if (pose === 'fire') s += toll(c, b.center[0], b.center[1], w * 0.55, o.k2 || 1);
    return { s, center: b.center };
  }

  /* ---------- 단계별 ---------- */
  /* Lv1: 기운 나무 틀에 매단 작은 녹슨 종 + 찢긴 보라 천 + 유령 연기 한 가닥 */
  function lv1(c, pose) {
    const h = c.h;
    let o = plat(c, 1, { stone: ROCK });
    o += footShade(c, 50, 103, 22, 5);
    /* 뒤 다리 */
    o += c.ol('M33 103L36 46M67 103L64 46', h.shade(M.woodD, -0.15), 3);
    /* 받침 돌판 */
    o += c.p('M38 104L40 97H60L62 104Q50 106.5 38 104Z', c.vg(ROCK, 0.25, -0.3), 2.2);
    o += aura(c, 50, 74, 16, 14, GLOW, pose === 'idle' ? 0.2 : 0.4);
    const b = hangBell(c, 50, 50, 25, 26, '#7a5a5e', pose);
    o += b.s;
    /* 가로대·앞 다리·무릎 버팀 */
    o += c.r(25, 40, 50, 6.4, c.vg(M.wood, 0.2, -0.3), 1.4, 2.6);
    o += c.ln('M28 43.2H72', h.shade(M.wood, -0.35), 1, 0.7);
    o += c.ol('M28 103L31 46M72 103L69 46', M.wood, 3.2);
    o += c.ol('M30.4 58L37 46.4M69.6 58L63 46.4', M.woodD, 1.8);
    /* 찢긴 보라 천 */
    o += c.p('M25.6 46.4L31 46.4L30.6 58L29 55L27.6 60L26.6 54Z', c.vg('#6a3a8a', 0.2, -0.3), 1.6);
    /* 유령 연기 */
    o += wisp(c, 77, 64, 0.9, '#b8a0d8', pose === 'idle' ? 0.45 : 0.6);
    return o;
  }

  /* Lv2·3: 검보라 돌 종루. Lv3은 더 높고 쇠테·뾰족 지붕·보랏빛이 새는 금·까마귀 */
  function lv23(c, pose, L3) {
    const h = c.h;
    let o = plat(c, L3 ? 3 : 2, { stone: ROCK, trim: L3 ? '#9a7ac8' : undefined });
    o += footShade(c, 50, 103, 22, 6);
    const yB = L3 ? 70 : 74; // 아래 몸통 윗선
    const yT = L3 ? 38 : 44; // 종루 윗선
    /* 오른쪽 옆면(깊이) */
    o += c.p(`M67 ${yB}L72 ${yB - 3}V101L67 104Z`, c.vg(h.shade(ROCK, -0.35), 0.1, -0.3), 2.4);
    o += stoneRect(c, 33, yB, 34, 104 - yB, ROCK, { seed: L3 ? 41 : 37, ch: 7, bw: 10 });
    /* 문(보랏빛이 새어 나옴) */
    o += aura(c, 50, 98, 8, 6, GLOW, L3 ? 0.55 : 0.35);
    o += c.p('M45 104V96Q50 89.5 55 96V104Z', c.vg('#1e1428', 0.1, -0.1), 2.2);
    o += c.ln('M46.6 103V97M53.4 103V97', '#4a3a58', 1, 0.8);
    if (L3) {
      /* 돌 틈 사이 보랏빛 금 */
      o += c.ln('M37 78L40 82L38 86L41 90M62 76L59 80L61 84', '#1c1426', 2.4) + c.ln('M37 78L40 82L38 86L41 90M62 76L59 80L61 84', GLOW, 1.1, pose === 'idle' ? 0.6 : 1);
    }
    /* 처마 돌판 */
    o += c.r(30, yB - 4, 40, 4.6, c.vg(h.shade(ROCK, 0.15), 0.25, -0.3), 0.8, 2.4);
    if (L3) o += c.r(30, yB - 1.6, 40, 2, c.vg(M.iron, 0.3, -0.2), 0.4, 1.4) + [33, 41, 50, 59, 67].map((x) => c.ci(x, yB - 0.6, 0.7, M.ironL, 0)).join('');
    /* 종루 속(어두운 안쪽 + 보랏빛) */
    o += c.r(35, yT, 30, yB - 4 - yT, '#1e1428', 0, 2.4);
    o += aura(c, 50, (yT + yB) / 2, 14, 13, GLOW, pose === 'idle' ? 0.25 : 0.45);
    const b = hangBell(c, 50, yT + 4, 21, 21, '#5a4a6e', pose, { halo: true });
    o += b.s;
    /* 앞 기둥 둘 */
    o += stoneRect(c, 31, yT, 6.5, yB - 4 - yT, ROCK, { seed: 5, ch: 6, bw: 7 }) + stoneRect(c, 62.5, yT, 6.5, yB - 4 - yT, ROCK, { seed: 9, ch: 6, bw: 7 });
    if (L3) o += c.r(30.5, yT + 8, 7.5, 2, M.iron, 0.4, 1.2) + c.r(62, yT + 8, 7.5, 2, M.iron, 0.4, 1.2);
    /* 상인방(아치 머리) */
    o += c.p(`M30 ${yT - 6}H70V${yT + 1}H64Q50 ${yT - 3} 36 ${yT + 1}H30Z`, c.vg(h.shade(ROCK, 0.1), 0.25, -0.3), 2.6);
    o += c.ln(`M38 ${yT - 3}H62`, h.shade(ROCK, -0.35), 1, 0.7);
    /* 지붕 */
    if (L3) {
      const yr = yT - 6;
      o += c.p(`M27 ${yr}L50 ${yr - 30}L73 ${yr}Q50 ${yr + 4} 27 ${yr}Z`, c.cg('#3c3050'), 2.8);
      o += c.ln(`M33 ${yr - 0.4}L50 ${yr - 28}M42 ${yr + 1}L50 ${yr - 28}M58 ${yr + 1}L50 ${yr - 28}M67 ${yr - 0.4}L50 ${yr - 28}M35 ${yr - 8}H65M40 ${yr - 16}H60M44 ${yr - 23}H56`, '#241c32', 1.2, 0.8);
      o += c.ln(`M31 ${yr - 1}L49 ${yr - 28}`, '#6a5a80', 1.4, 0.7);
      o += c.ol(`M50 ${yr - 30}V${yr - 35}`, M.iron, 1.4) + c.p(`M50 ${yr - 41}L52.6 ${yr - 37}L50 ${yr - 33}L47.4 ${yr - 37}Z`, c.vg(GLOW, 0.4, -0.3), 1.4);
      o += crow(c, 68, yr + 0.5, 0.9, -1);
    } else {
      const yr = yT - 6;
      o += c.p(`M28 ${yr}L50 ${yr - 16}L72 ${yr}Q50 ${yr + 4} 28 ${yr}Z`, c.cg('#3c3050'), 2.8);
      o += c.ln(`M35 ${yr - 5}H65M42 ${yr - 10.4}H58M39 ${yr + 0.6}L50 ${yr - 15}M61 ${yr + 0.6}L50 ${yr - 15}`, '#241c32', 1.2, 0.8);
      o += c.ol(`M50 ${yr - 16}V${yr - 20}`, M.iron, 1.4) + c.ci(50, yr - 21, 1.6, c.sg('#7a6a90'), 1.2);
    }
    o += wisp(c, 74, yB - 6, 0.9, '#b8a0d8', pose === 'idle' ? 0.4 : 0.6);
    if (L3) o += wisp(c, 26, yB + 6, 0.8, '#b8a0d8', 0.45, -1);
    return o;
  }

  /* 4A 파멸의 종: 해골 돌기둥 둘 + 가시 쇠 가로대에 매단 거대한 검은 종, 기둥 위 보랏빛 불꽃 */
  function doom(c, pose) {
    const h = c.h;
    let o = plat(c, 4, { stone: ROCK, trim: '#9a7ac8' });
    o += footShade(c, 50, 99, 30, 7);
    o += aura(c, 50, 64, 34, 30, '#6a3a9a', pose === 'idle' ? 0.3 : 0.5);
    /* 받침 계단 */
    o += c.p('M26 99L29 93H71L74 99Q50 102 26 99Z', c.vg(h.shade(ROCK, 0.1), 0.25, -0.3), 2.4);
    /* 종 */
    const lit = pose === 'idle' ? 0.5 : 1;
    const emblem = skull(c, 50, 58, 1.25, h.mix('#2a1838', GLOW, lit)) + c.ln('M38 70Q50 74 62 70', '#9a7ac8', 1.4, 0.8);
    const b = hangBell(c, 50, 36, 34, 34, '#2e2638', pose, { halo: true, extra: emblem, yoke: '#2a2030', k: 0.75, k2: 1.3 });
    o += b.s;
    /* 기둥 */
    o += stoneRect(c, 17, 30, 10, 65, ROCK, { seed: 23, ch: 7, bw: 10 }) + stoneRect(c, 73, 30, 10, 65, ROCK, { seed: 29, ch: 7, bw: 10 });
    o += skull(c, 22, 60, 0.9, GLOW) + skull(c, 78, 60, 0.9, GLOW);
    /* 쇠 가로대 + 가시 */
    o += c.r(13, 26, 74, 6, c.vg(M.iron, 0.3, -0.35), 1, 2.6);
    o += c.p('M30 26L32 21L34 26ZM40 26L42 22L44 26ZM56 26L58 22L60 26ZM66 26L68 21L70 26Z', c.vg(M.ironL, 0.3, -0.2), 1.6);
    o += [19, 37, 63, 81].map((x) => c.ci(x, 29, 1, M.ironL, 0)).join('');
    /* 기둥 머리 화로 + 보랏빛 불꽃 */
    for (const x of [22, 78]) {
      o += c.p(`M${x - 7} 20H${x + 7}L${x + 5} 26H${x - 5}Z`, c.vg('#3a3048', 0.3, -0.3), 2.2);
      o += pflame(c, x, 20, pose === 'fire' ? 12 : 10, pose === 'idle' ? 13 : pose === 'aim' ? 16 : 19);
    }
    return o;
  }

  /* 4B 영혼의 종: 은빛 아치에 매단 반투명 수정 종 + 둘레를 도는 영혼 불꽃 */
  function soul(c, pose) {
    const h = c.h;
    let o = plat(c, 4, { stone: ROCK, trim: SOUL });
    o += footShade(c, 50, 99, 28, 7);
    o += aura(c, 50, 60, 32, 30, '#7a6ad8', pose === 'idle' ? 0.3 : 0.5);
    /* 아치(뒤쪽 기둥 + 둥근 머리) */
    o += c.p('M26 98V44Q26 18 50 16Q74 18 74 44V98H67V45Q67 26 50 24Q33 26 33 45V98Z', c.vg('#6a5a80', 0.3, -0.3), 2.8);
    o += c.ln('M29.5 96V45Q29.5 22 50 20Q70.5 22 70.5 45V96', '#b8c8e8', 1.2, 0.75);
    o += [[29.5, 70], [70.5, 70], [29.5, 52], [70.5, 52]].map(([x, y]) => c.p(`M${x} ${y - 3}L${x + 2} ${y}L${x} ${y + 3}L${x - 2} ${y}Z`, c.vg(SOUL, 0.3, -0.2), 1.2)).join('');
    o += c.p('M50 10L54 16L50 22L46 16Z', c.vg(SOUL, 0.5, -0.2), 1.8);
    /* 돌 제단 */
    o += c.p('M37 99L39 91H61L63 99Q50 101.5 37 99Z', c.vg(h.shade(ROCK, 0.1), 0.25, -0.3), 2.4);
    o += c.ln('M42 95H58', SOUL, 1.2, 0.6);
    /* 수정 종(반투명) */
    const ang = ANG[pose] * 0.85;
    const lit = pose === 'idle' ? 0.5 : 1;
    let bell = OP(A.bellBody(c, 50, 30, 30, 32, '#9a8ae8'), 0.82);
    bell += c.e(50, 50, 7, 9, c.ag('#f0f8ff', 0.5 + lit * 0.4), 0);
    bell += c.p('M44 36L41 52M47 34L45 44', 'none', 0, ` stroke="#ffffff" stroke-width="${c.sw(1.4)}" opacity="0.8"`);
    bell += c.ln('M54 38L58 46L55 52L59 60', '#e8f6ff', 1, 0.7);
    o += c.ol('M50 24V30', '#b8c8e8', 1.6);
    o += G(bell, ang ? `rotate(${f(ang)} 50 30)` : '');
    const cl = pose === 'fire' ? rotP([50 - 11, 58], [50, 30], ang) : [50 + Math.sin(-ang * Math.PI / 180) * 0, 63];
    o += c.ol(`M50 30L${f(cl[0])} ${f(cl[1] - 3)}`, '#b8c8e8', 1.2) + c.ci(cl[0], cl[1], 2.4, c.sg(SOUL), 1.6);
    /* 영혼 불꽃(둘레를 돔) */
    const spin = pose === 'idle' ? 0 : pose === 'aim' ? 0.5 : 1;
    const SPOTS = [[0.2, 30], [1.6, 22], [2.8, 26], [4.2, 22], [5.4, 28]];
    for (const [a0, r] of SPOTS) {
      const a = a0 + spin;
      const x = 50 + Math.cos(a) * r;
      const y = 52 + Math.sin(a) * r * 0.45;
      o += soulFlame(c, x, y + 4, 1 + (pose === 'fire' ? 0.25 : 0));
    }
    if (pose === 'fire') {
      const cx = 50 + Math.sin(ang * Math.PI / 180) * -16;
      o += toll(c, cx, 47, 19, 1.3);
    }
    return o;
  }

  T.dread_bell = {
    /* 종 가운데 — 소리 고리가 여기서 퍼짐 */
    muzzle: [[50, 64], [50, 60], [50, 54], [50, 55], [50, 47]],
    draw(c, v, pose = 'idle') {
      c = fine(c);
      if (v === 1) return lv1(c, pose);
      if (v === 2) return lv23(c, pose, false);
      if (v === 3) return lv23(c, pose, true);
      if (v === 'A') return doom(c, pose);
      return soul(c, pose);
    },
  };
})();
