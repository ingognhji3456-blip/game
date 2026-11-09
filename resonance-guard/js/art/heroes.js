'use strict';

/* =========================================================
 * 영웅 · 초상화 · 아군 유닛 그림 (SVG 문자열)
 * 규격: docs/ARCHITECTURE.md §5
 *   RG.art.hero(id, pose)      0 0 100 100, 발 (50,90), 오른쪽을 바라봄
 *   RG.art.portrait(id, mood)  0 0 200 200, 가슴 위, 살짝 오른쪽
 *   RG.art.unit(kind, pose)    0 0 100 100, 발 (50,90), 오른쪽을 바라봄
 * ========================================================= */
(() => {
  const OLC = '#1c1426';
  const h = () => RG.art._h;
  const num = (v) => Math.round(v * 10) / 10;
  const sh = (c, a) => h().shade(c, a);

  /* ---------- 작업대: SVG 하나의 defs + 색별 그라데이션 캐시 ---------- */
  function pad() {
    const H = h();
    const defs = [];
    const memo = {};
    const add = (key, make) => {
      if (!memo[key]) { memo[key] = H.uid('hr'); defs.push(make(memo[key])); }
      return `url(#${memo[key]})`;
    };
    return {
      defs,
      /** 빛이 왼쪽 위에서 오는 3단 선형 그라데이션 */
      g: (c, k = 0.3) => add(`g${c}${k}`, (id) => H.lg(id, [[0, sh(c, k)], [0.55, c], [1, sh(c, -k)]], [0.15, 0, 0.85, 1])),
      /** 둥근 면(머리·돌) 방사형 */
      r: (c, k = 0.35) => add(`r${c}${k}`, (id) => H.rg(id, [[0, sh(c, k)], [0.6, c], [1, sh(c, -0.25)]], 0.36, 0.3, 0.8)),
      /** 빛 무리 (가운데 진하고 가장자리 투명) */
      halo: (c, a = 0.85) => add(`h${c}${a}`, (id) => H.rg(id, [[0, c, a], [0.45, c, a * 0.45], [1, c, 0]], 0.5, 0.5, 0.5)),
      glow: (std) => add(`f${std}`, (id) => H.glow(id, std)),
      raw: (key, make) => add(key, make),
    };
  }

  /* ---------- 도형 문자열 ---------- */
  // 외곽선 색은 바깥 <g>에서 물려받음(기본 굵기 0 = 선 없음)
  const ow = (w) => (w ? ` stroke-width="${w}"` : '');
  const P = (d, f, w = 3, ex = '') => `<path d="${d}" fill="${f}"${ow(w)}${ex}/>`;
  const C = (x, y, r, f, w = 3, ex = '') => `<circle cx="${num(x)}" cy="${num(y)}" r="${r}" fill="${f}"${ow(w)}${ex}/>`;
  const E = (x, y, rx, ry, f, w = 3, ex = '') => `<ellipse cx="${num(x)}" cy="${num(y)}" rx="${rx}" ry="${ry}" fill="${f}"${ow(w)}${ex}/>`;
  /** 외곽선 없는 선 */
  const T = (d, c, w, ex = '') => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}"${ex}/>`;
  /** 외곽선 있는 굵은 선 (팔·다리·자루). 색은 단색만(그라데이션은 직선에서 깨짐) */
  const L = (d, c, w, o = 3) => `<path d="${d}" fill="none" stroke-width="${w + o}"/>` + T(d, c, w);
  const G = (body, tr, ex = '') => (tr || ex ? `<g${tr ? ` transform="${tr}"` : ''}${ex}>${body}</g>` : body);
  const op = (a) => ` opacity="${a}"`;
  /** 털 장식(둥근 점선) */
  const FUR = (d, c, w = 4.5, gap = 4, o = 2.6) => `<path d="${d}" fill="none" stroke-width="${w + o}" stroke-dasharray="0.1 ${gap}"/><path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-dasharray="0.1 ${gap}"/>`;

  const wrap = (vb, c, body) => h().svg(vb, c.defs.join(''),
    `<g stroke="${OLC}" stroke-width="0" stroke-linejoin="round" stroke-linecap="round">${body}</g>`);

  /* =========================================================
   * 전투용 작은 그림 — 공통 몸
   * ========================================================= */
  const LEGS = { idle: [45, 56], walk1: [38, 62], walk2: [61, 39], attack: [37, 64] };
  const legPos = (pose) => LEGS[pose] || LEGS.idle;

  /** 걷기 자세에서 뒤로 뻗은 발은 살짝 들림 → walk1은 먼 다리, walk2는 가까운 다리 */
  const lift = (pose, fx) => (pose.startsWith('walk') && fx < 50 ? 3.5 : 0);
  /** 두 다리 + 장화. hip y = hy */
  function legs(c, pose, pant, boot, hy = 74) {
    const [b, f] = legPos(pose);
    const one = (x0, fx, col) => {
      const u = lift(pose, fx);
      return L(`M${x0} ${hy}L${fx} ${84 - u}`, col, 7.5)
        + P(`M${fx - 4.5} ${82.5 - u}h6.5q5 1 5.5 6V${90 - u}H${fx - 4.5}Z`, c.g(boot), 2.5);
    };
    return one(46, b, sh(pant, -0.22)) + one(54, f, pant);
  }
  /** 장화만 (긴 옷 아래) */
  function boots(c, pose, boot) {
    const [b, f] = legPos(pose);
    const one = (fx, col) => {
      const u = lift(pose, fx) * 0.7;
      return P(`M${fx - 4.5} ${82 - u}h6.5q5 1 5.5 6.5V${90 - u}H${fx - 4.5}Z`, c.g(col), 2.5);
    };
    return one(b, sh(boot, -0.2)) + one(f, boot);
  }
  /** 팔: 어깨 → (팔꿈치) → 손 */
  function arm(sx, sy, hx, hy, sleeve, skin, ex, ey) {
    const d = ex == null ? `M${sx} ${sy}L${hx} ${hy}` : `M${sx} ${sy}Q${ex} ${ey} ${hx} ${hy}`;
    return L(d, sleeve, 6) + C(hx, hy, 3.4, skin, 2.5);
  }
  /** 작은 얼굴: 눈 두 개(오른쪽을 봄) */
  function sEyes(x, y, col = '#2a1a2e', ry = 2.8) {
    return E(x, y, 1.9, ry, col, 0) + E(x + 8, y, 1.7, ry - 0.1, col, 0)
      + C(x - 0.5, y - 1.1, 0.8, '#fff', 0) + C(x + 7.6, y - 1.1, 0.75, '#fff', 0);
  }
  const blush = (x, y) => E(x, y, 2.4, 1.4, '#ff7a7a', 0, op(0.5));
  /** 작은 입: 'smile' 미소, 'open' 벌린 입, 'line' 일자 */
  const sMouth = (x, y, kind = 'smile') => (kind === 'open'
    ? P(`M${x - 3} ${y - 0.8}h6q-.6 3.8-3 3.8t-3-3.8z`, '#4a1424', 1.3)
    : kind === 'line' ? T(`M${x - 2} ${y}h4`, OLC, 1.4) : T(`M${x - 2.6} ${y - 0.6}q2.6 2.2 5.2 0`, OLC, 1.5));

  /* ---------- 카라: 높은 붉은 말총머리 + 큰 망치 ---------- */
  function hammer(c, gx, gy, hx, hy, hot) {
    const dx = hx - gx;
    const dy = hy - gy;
    const len = Math.hypot(dx, dy);
    const px = gx - (dx / len) * 6;
    const py = gy - (dy / len) * 6;
    const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
    const glowCol = hot ? '#ffd23a' : '#ff8a3d';
    return L(`M${num(px)} ${num(py)}L${num(hx)} ${num(hy)}`, '#a8703c', 4.5)
      + G(P('M-10 -15.5h20v31h-20z', c.g('#62667a', 0.35), 3)
        + P('M-10 -15.5h20v5.5h-20zM-10 10h20v5.5h-20z', c.g(glowCol, 0.25), 2.5)
        + P('M-4 -10h8v20h-8z', '#43465a', 2)
        + T('M-7 -7v5', '#9aa0b8', 2)
        + (hot ? C(0, 16.5, 6, c.halo('#ffd23a'), 0) : ''),
      `translate(${num(hx)} ${num(hy)}) rotate(${num(ang)})`);
  }

  function kara(c, pose) {
    const skin = '#efb98f';
    const hair = '#e2452f';
    const shirt = '#ff8a3d';
    const leather = '#8d5532';
    const atk = pose === 'attack';
    const bob = pose === 'walk1' ? -1 : 0;
    const tail = P('M45 24C43 12 33 6 21 10C26 12 28 15 28 18C21 17 15 22 13 30C19 27 25 28 29 31C26 34 25 38 26 43C31 36 37 32 42 30Z', c.g(hair), 2.8);
    const torso = P('M38 53Q50 48 62 53L64 76Q50 80 36 76Z', c.g(shirt), 3)
      + P('M44 58Q53 55 62 57L63.5 76.5Q53 79.5 44.5 78Z', c.g(leather), 2.5)
      + T('M46 58L43 52.5M60 57L58.5 51.5', OLC, 2) + C(53, 64, 1.4, '#e8c07a', 0);
    const headG = C(50, 37, 15, c.r(skin), 3)
      + sEyes(55, 39) + blush(52, 44.5) + sMouth(60.5, 45.5, atk ? 'open' : 'smile')
      + P('M34.5 42C32 27 41 20.5 51 20.5C61 20.5 67 27 66 35L62.5 31.5L61 36L57 30.5L54 35L51 29.5C46 33 41 37 38.5 46Z', c.g(hair), 2.8)
      + T('M42 27Q47 23 53 23', sh(hair, 0.45), 1.6, op(0.8))
      + C(44, 23.5, 3, c.g('#ffb03a'), 2.2)
      + C(40.5, 41, 1.3, '#3a2a2a', 0, op(0.25));
    if (!atk) {
      const hb = pose === 'walk1' ? 1.5 : pose === 'walk2' ? -0.5 : 0;
      const up = torso
        + hammer(c, 61, 68, 24, 48 + hb)
        + arm(45, 56, 52, 63, sh(shirt, -0.15), skin, 46, 62)
        + tail + headG
        + L('M56 55L59 61', shirt, 6) + arm(59, 61, 61.5, 68, skin, skin);
      return legs(c, pose, '#5c3b2e', '#3b2a24') + G(up, bob ? `translate(0 ${bob})` : '');
    }
    // 공격: 앞으로 숙여 망치를 내려찍고 불꽃이 튐
    const burst = P('M58 90C57 84 61 82 64 85C63 79 68 77 70 82L84 82C86 77 91 78 91 83C94 80 99 83 97 90Z', c.g('#ff8a3d', 0.4), 2.5)
      + P('M63 90C63 87 66 86 67 88C68 84 72 84 73 87L82 87C84 84 88 85 88 87C90 86 93 87 92 90Z', '#ffd23a', 0)
      + C(62, 76, 1.8, '#ffd23a', 0) + C(96, 74, 2, '#ffb03a', 0) + C(93, 66, 1.4, '#fff2a8', 0);
    const swoosh = P('M40 12Q84 4 96 54Q82 20 40 12Z', '#ffcf8a', 0, op(0.6)) + P('M52 11Q84 10 93 42Q80 18 52 11Z', '#fff4dc', 0, op(0.8));
    const up = G(torso + G(tail, 'rotate(-18 44 24)') + headG, 'rotate(9 50 78)')
      + arm(48, 56, 59, 64, sh(shirt, -0.15), skin, 52, 63);
    return swoosh + legs(c, pose, '#5c3b2e', '#3b2a24') + up
      + hammer(c, 60, 63, 81, 74, true) + burst
      + L('M59 57L62 62', shirt, 6) + arm(62, 62, 65, 66, skin, skin);
  }

  /* ---------- 세라: 긴 은발 + 흰·금 망토 + 등불 지팡이 ---------- */
  function lanternStaff(c, bright) {
    // 손잡이 (68,60) 기준으로 그린 지팡이와 등불
    return L('M68 88L68 21Q68 13 75 13Q81 13.5 80.5 19', '#b98a3c', 3.2)
      + C(80.5, 28, bright ? 15 : 11, c.halo(bright ? '#fff3a0' : '#ffe48a', bright ? 0.95 : 0.75), 0)
      + P('M76.5 21.5h8l1 2h-10z', '#d9a63a', 2)
      + P('M76 23.5h9q1 5-1 9.5h-7q-2-4.5-1-9.5z', c.r(bright ? '#fffbe0' : '#fff0a0', 0.4), 2.5)
      + T('M80.5 24v8.5', '#d9a63a', 1.6)
      + P('M77.5 33h6l-1.2 2.5h-3.6z', '#d9a63a', 2);
  }
  function sera(c, pose) {
    const skin = '#fbdcc4';
    const hair = '#e6e8f3';
    const gold = '#e8b84a';
    const atk = pose === 'attack';
    const back = P('M35.5 32C30 46 33 62 27.5 75C36 75 43 70 46 62L47 40Z', c.g(hair, 0.2), 2.8)
      + T('M34 46Q33 60 30 70', '#b9bdd8', 1.6);
    const cloak = P('M38 50Q50 45 62 50L69 84Q50 90 31 84Z', gold, 3)
      + P('M39.5 52Q50 48 60.5 52L66 80.5Q50 85.5 34 80.5Z', c.g('#fbf8f0', 0.12), 0)
      + P('M56 54L65.5 82Q61 84.5 57.5 85L53 60Z', c.g('#ffe08a'), 2.2)
      + C(50, 53, 2.6, c.g(gold), 2);
    const headG = C(50, 37, 15, c.r(skin), 3)
      + sEyes(55, 39.5, '#5a3a20') + blush(52, 45) + sMouth(60.5, 46, atk ? 'open' : 'smile')
      + P('M34 44C31 28 40 20.5 50.5 20.5C61 20.5 67 27 66.5 36C63 31 60 29 57 28C55 32 50 34 45 33C42 37 38 40 37 48Z', c.g(hair, 0.2), 2.8)
      + P('M45 33C43 39 43 46 44 51', 'none', 0) + T('M41 27Q48 22.5 56 24', '#fff', 1.6, op(0.9))
      + P('M44 22.5l1.6 2.2 2.6.4-1.9 1.8.5 2.6-2.4-1.3-2.4 1.3.5-2.6-1.9-1.8 2.6-.4z', '#ffd84a', 1.2);
    const staff = lanternStaff(c, atk);
    if (!atk) {
      return back + boots(c, pose, '#c99a4a') + cloak + headG
        + G(staff, pose === 'walk1' ? 'rotate(-3 68 60)' : pose === 'walk2' ? 'rotate(2 68 60)' : '')
        + arm(56, 55, 67, 60, '#f4efe2', skin, 63, 61);
    }
    // 공격: 지팡이를 앞으로 내밀어 빛 구슬을 쏨
    const rays = P(h().starPath(90, 34, 17, 5, 8, -90), c.halo('#fff8c0', 0.9), 0);
    const orb = C(91, 13, 7, c.halo('#ffffff', 1), 0) + C(91, 13, 3, '#fffbe0', 1.6)
      + P(h().starPath(78, 10, 3.2, 1.1, 4, 0), '#fff8c0', 0) + P(h().starPath(97, 26, 2.6, 0.9, 4, 0), '#fff8c0', 0);
    return back + boots(c, pose, '#c99a4a') + cloak + G(headG, 'rotate(-4 50 60)')
      + rays + G(staff, 'rotate(18 68 60)') + orb
      + arm(56, 55, 67, 60, '#f4efe2', skin, 63, 59);
  }

  /* ---------- 시오: 흰 털 두건 + 긴 얼음 장궁 ---------- */
  function sio(c, pose) {
    const skin = '#f4d3b8';
    const fur = '#f4f6fb';
    const coat = '#4bb6ea';
    const atk = pose === 'attack';
    const bob = pose === 'walk1' ? -1 : 0;
    const hood = P('M33 45C29 30 37 18 50 18C62 18 69 26 68.5 38C68.5 46 64 52 58 54L40 54C36 52 34 49 33 45Z', c.g(fur, 0.12), 3)
      + T('M38 26Q45 20 54 20', '#fff', 1.8)
      + E(56.5, 39.5, 10, 11.5, c.r(skin), 0)
      + P('M46.5 33Q52 25.5 65.5 30.5L64.5 35.5L61.5 32L59.5 36.5L56.5 31.5L53.5 35.5L51 31.5L48.5 37Z', c.g('#2c2a36', 0.25), 0)
      + E(56.5, 39.5, 11.5, 13, 'none', 0) + FUR('M57 26.2a11.8 13.3 0 1 0 0.1 0', fur, 4.2, 3.9)
      + E(55, 40.5, 1.8, 2.3, '#1f2a3a', 0) + E(62, 40.5, 1.6, 2.2, '#1f2a3a', 0)
      + C(54.6, 39.6, 0.7, '#fff', 0) + C(61.6, 39.6, 0.65, '#fff', 0)
      + T('M52.5 36.6l4.5 0.3M60 36.9l4 0', '#1f2a3a', 1.3)
      + T('M58.5 46.2h4', '#8a4a40', 1.3);
    const torso = P('M38 52Q50 48 62 52L65 80Q50 84 35 80Z', c.g(coat), 3)
      + P('M37 66.5L63.5 66L63.8 70L36.6 70.5Z', '#6a4430', 2) + C(56, 68.2, 1.6, '#bff0ff', 1)
      + T('M54 53L56 66', sh(coat, -0.3), 2)
      + FUR('M36 80Q50 84.5 64.5 80', fur, 4, 3.8);
    if (!atk) {
      const bow = L('M66 23Q84 54 66 87', '#3f4f74', 3) + T('M66 23L66 87', '#e8f6ff', 1.2)
        + P('M66 23l-2-5 3 2 2-4 .5 5z', '#bff0ff', 1.6) + P('M66 87l-2 5 3-2 2 4 .5-5z', '#bff0ff', 1.6)
        + P('M73.5 50l3-3 3 3-3 6z', '#bff0ff', 1.6);
      const up = torso + hood + bow
        + arm(56, 56, 72.5, 55, sh(coat, -0.05), skin, 63, 59);
      return legs(c, pose, '#34506e', '#5a4232', 76) + G(up, bob ? `translate(0 ${bob})` : '');
    }
    // 공격: 시위를 당겨 얼음 화살을 겨눔
    const bow = L('M71 17Q93 51 71 85', '#3f4f74', 3) + T('M71 17L52 49L71 85', '#e8f6ff', 1.2)
      + P('M71 17l-2-5 3 2 2-4 .5 5z', '#bff0ff', 1.6) + P('M71 85l-2 5 3-2 2 4 .5-5z', '#bff0ff', 1.6);
    const arrow = L('M50 49H89', '#c9a070', 1.8, 2.6) + C(92, 49, 7, c.halo('#bff4ff', 0.9), 0)
      + P('M87 45l9 4-9 4 1.8-4z', '#bff0ff', 2) + P('M51 49l-5-3.5h3.5l3.5 3.5-3.5 3.5h-3.5z', '#5fd4ff', 1.5);
    return legs(c, pose, '#34506e', '#5a4232', 76) + torso + hood
      + arm(45, 55, 52.5, 49.5, sh(coat, -0.2), skin, 46, 50)
      + bow + arm(57, 56, 78, 53, sh(coat, -0.05), skin, 68, 57) + arrow;
  }

  /* ---------- 제나: 고글 + 등의 코일 두 개 ---------- */
  function coil(c, x, y, rot, bright) {
    return G(P('M-3.2 2h6.4v-29h-6.4z', '#7a6a8a', 2.5)
      + T('M-3-3h6m-6-5h6m-6-5h6m-6-5h6m-6-5h6', '#e0954a', 2.2)
      + C(0, -32, bright ? 9 : 7, c.halo('#c9bfff', bright ? 1 : 0.8), 0)
      + C(0, -32, 4.4, c.r('#b9adff', 0.5), 2.5) + C(-1.3, -33.4, 1.2, '#fff', 0),
    `translate(${x} ${y}) rotate(${rot})`);
  }
  function zapper(c, bright) {
    // 손 (0,0) 기준, 앞쪽(+x)을 향한 전기 장치
    return P('M-3 -3h10l2 2v4l-2 2h-10z', '#5a5470', 2.2)
      + T('M3 -3.5v7M6 -3.5v7', '#e0954a', 1.8)
      + C(11, 0, bright ? 3.6 : 2.8, c.r('#b9adff', 0.5), 2) + P('M-1 3l-2 5h4l1-5z', '#7a5232', 1.8);
  }
  function zena(c, pose) {
    const skin = '#c98c62';
    const hair = '#7a4a2c';
    const jacket = '#8f7bff';
    const atk = pose === 'attack';
    const bob = pose === 'walk1' ? -1 : 0;
    const pack = P('M27 51h16v21h-16z', c.g('#6d6880'), 2.8)
      + coil(c, 30, 55, -30, atk) + coil(c, 38, 52, -5, atk);
    const torso = P('M38 53Q50 48 62 53L64 76Q50 80 36 76Z', c.g(jacket), 3)
      + P('M53.5 53.5L61 53.5L59.5 71L55 71Z', '#f3e7d0', 2.2)
      + P('M36.5 68.5L63.6 68L63.9 72.2L36.2 72.7Z', '#7a5232', 2)
      + P('M40 70h5v6h-5z', '#a3764a', 1.8);
    const backHair = P('M37 49C30 47 30 40 33.5 37C29 33 32 25 38 25C38 19 46 16 51 19.5C55 15.5 63 17 64.5 22.5C69 23 70.5 29 67.5 32L60 40L44 44Z', c.g(hair, 0.25), 2.8);
    const headG = backHair + C(51, 37.5, 14.5, c.r(skin, 0.3), 3)
      + sEyes(56, 40, '#2a1a2e') + blush(53, 45.5) + sMouth(61.5, 46, 'open')
      + P('M38 37C37 30 41 26 45 27C46 23 51 22 54 24.5C57 22 62 23 63.5 26.5C66 26.5 68 29 67 32.5C64 31 61 31.5 59 33C56 31 52 31.5 50 33.5C47 31.5 43 33 41 37Z', c.g(hair, 0.25), 2.6)
      + T('M37.5 32Q50 22 67 29', '#3a3046', 2.6)
      + C(53.5, 26.5, 5, '#e0b04a', 2.2) + C(62, 28, 4.5, '#e0b04a', 2.2)
      + C(53.5, 26.5, 3.1, c.r('#c9f0ff', 0.4), 0) + C(62, 28, 2.7, c.r('#c9f0ff', 0.4), 0)
      + C(52.4, 25.4, 1.1, '#fff', 0) + C(61, 26.9, 1, '#fff', 0);
    if (!atk) {
      const up = pack + torso + arm(45, 56, 46, 66, sh(jacket, -0.2), skin) + headG
        + G(zapper(c, false), 'translate(61 67) rotate(-10)')
        + arm(56, 56, 61, 67, jacket, skin, 59, 62);
      return legs(c, pose, '#3c3550', '#5a3d2e') + G(up, bob ? `translate(0 ${bob})` : '');
    }
    // 공격: 장치를 앞으로 내밀어 번개를 쏨
    const bolt = C(80, 54, 9, c.halo('#c9bfff', 1), 0)
      + P('M78 56L85 45L85 51L92 42L91 49L99 44L91 58L91 53L84 61L85 55Z', '#f4f0ff', 2);
    return legs(c, pose, '#3c3550', '#5a3d2e') + pack + torso
      + arm(45, 56, 50, 63, sh(jacket, -0.2), skin) + headG
      + G(zapper(c, true), 'translate(68 56) rotate(-6)') + bolt
      + arm(56, 56, 68, 56, jacket, skin, 62, 60)
      + T('M9 21l-3-3M29 11l1-4M37 13l3-3', '#e8e2ff', 1.6);
  }

  /* ---------- 바위: 둥근 이끼 돌 거인 ---------- */
  function flower(x, y, col = '#fff6e0') {
    return P(`M${x} ${y - 2.6}l1 1.6 1.8-.3-.7 1.7 1.2 1.4-1.8.2-.5 1.8-1-1.5-1.7.6.4-1.8-1.4-1.1 1.8-.6z`, col, 1) + C(x, y, 0.9, '#ffcf3a', 0);
  }
  function bawi(c, pose) {
    const stone = '#a39d90';
    const moss = '#7fbf4a';
    const atk = pose === 'attack';
    const LB = { idle: [42, 0, 58, 0], walk1: [38, 4, 62, 0], walk2: [44, 0, 58, 4], attack: [38, 0, 62, 0] }[pose];
    const leg = (x, u, col) => P(`M${x - 6} ${79 - u}h12v8q0 3-3 3h-6q-3 0-3-3z`, c.g(col), 2.8);
    const legsG = leg(LB[0], LB[1], sh(stone, -0.2)) + leg(LB[2], LB[3], stone);
    const sway = pose === 'walk1' ? 'rotate(-2.5 50 86) translate(0 -1)' : pose === 'walk2' ? 'rotate(2.5 50 86) translate(0 -1)' : '';
    const body = P('M23 68C19 52 28 39 42 37.5L60 37.5C74 39 83 52 79 68C77 80 67 85 51 85C35 85 25 80 23 68Z', c.r(stone, 0.3), 3.2)
      + P('M25 72C30 79 40 82 50 82C56 82 62 81 66 79C60 77 58 80 52 78C46 80 42 76 36 77C32 75 28 76 25 72Z', c.g(moss, 0.2), 2)
      + T('M33 60l5 4M66 68l-4 3M40 47l3 3', sh(stone, -0.35), 2) + flower(44, 79, '#ff9cc0')
      + P('M56 52l6 7-6 8-6-8z', c.r('#6dff9a', 0.5), 2.5) + C(56, 59, 9, c.halo('#8dffb0', 0.55), 0)
      + C(54.5, 56.5, 1.2, '#fff', 0);
    const headG = C(53, 33, 12.5, c.r(stone, 0.35), 3)
      + P('M41 31C40 22 46 19 53 19C61 19 66 23 65.5 30C62 27 58 28 56 26C53 29 49 27 47 29C45 28 43 29 41 31Z', c.g(moss, 0.25), 2.5)
      + flower(47, 22) + flower(59, 21.5, '#ff9cc0')
      + P('M50.5 31.5q3-3.2 7-.6l-.6 1.6q-3-1.4-6 .6zM58.5 30.9q3.6-2.4 7 .7l-1 1.3q-2.6-1.6-5.6-.5z', c.g(moss, 0.2), 1.6)
      + E(54.5, 35, 1.8, 2.2, '#16261a', 0) + E(62, 35, 1.7, 2.1, '#16261a', 0)
      + C(55, 34.2, 0.75, '#b8ffcf', 0) + C(62.5, 34.2, 0.7, '#b8ffcf', 0)
      + T('M55.5 40.2q3 2 6 0', OLC, 1.6) + E(51.5, 39, 2.2, 1.2, '#c97a6a', 0, op(0.4));
    const shoulder = (x, y, r, col) => C(x, y, r, c.r(col, 0.35), 3)
      + P(`M${x - r + 1} ${y - 2}C${x - r + 2} ${y - r - 2} ${x + r - 2} ${y - r - 2} ${x + r - 1} ${y - 2}C${x + 3} ${y - r + 3} ${x - 3} ${y - r + 4} ${x - r + 1} ${y - 2}Z`, c.g(moss, 0.25), 2.2);
    const fist = (x, y, col) => C(x, y, 8, c.r(col, 0.35), 3) + T(`M${x - 2} ${y - 4}q3 1 4 4`, sh(col, -0.35), 1.6);
    if (!atk) {
      const up = fist(23, 72, sh(stone, -0.2)) + body + headG
        + shoulder(26, 47, 11, sh(stone, -0.1)) + flower(25, 38)
        + L('M74 52L77 70', stone, 9) + fist(77, 72, stone)
        + shoulder(73, 47, 12, stone);
      return legsG + G(up, sway);
    }
    // 공격: 큰 주먹으로 땅을 내려침
    const crack = C(72, 86, 4, '#e6dcc8', 0, op(0.6)) + C(95, 86, 3.5, '#e6dcc8', 0, op(0.6))
      + P('M68 76l-4-5 5 1zM94 72l4-5 0 6zM88 64l2-5 3 4z', c.g('#c8c2b4'), 1.8)
      + T('M66 86q-6-4-6-11M97 85q5-3 2-12', '#fff4dc', 2.4, op(0.85));
    const up = fist(26, 70, sh(stone, -0.2)) + body + headG + shoulder(26, 47, 11, sh(stone, -0.1)) + flower(25, 38);
    return legsG + G(up, 'rotate(7 50 85)') + crack
      + L('M74 52Q84 60 83 74', stone, 9) + fist(83, 79, stone) + shoulder(73, 48, 12, stone);
  }

  /* ---------- 야로: 회색 후드 + 단검 두 자루 + 긴 그림자 ---------- */
  function dagger(c, x, y, rot, glint) {
    return G(P('M2 -2.2L15 -1L18 0L15 1L2 2.2Z', c.g('#e6e9f2', 0.2), 2)
      + T('M4 -0.6L15 -0.2', glint ? '#ffffff' : '#f2b8ea', 1)
      + P('M0.5 -4.2h2.5v8.4h-2.5z', '#6e1f66', 1.8) + P('M-6 -1.5h6.5v3h-6.5z', '#3a2a3e', 1.8),
    `translate(${x} ${y}) rotate(${rot})`);
  }
  function yaro(c, pose) {
    const skin = '#ecc7ab';
    const hood = '#8d8a96';
    const atk = pose === 'attack';
    const bob = pose === 'walk1' ? -1 : 0;
    const shadowG = c.raw('ysh', (id) => h().lg(id, [[0, '#3a1040', 0], [0.6, '#4a1a52', 0.55], [1, '#2a0e30', 0.8]], 'h'));
    const shadow = atk
      ? P('M46 58C32 52 18 60 2 55C10 61 8 65 2 70C14 69 20 72 8 80C24 81 36 77 46 73Z', shadowG, 0)
      : P('M46 58C34 56 22 64 4 62C12 66 10 70 3 74C15 75 20 78 12 84C26 84 38 80 46 75Z', shadowG, 0);
    const wisp = T(atk ? 'M42 64C30 62 20 66 8 64' : 'M42 66C32 66 22 70 10 70', '#d14fc0', 1.6, op(0.6));
    const scarfTail = atk
      ? P('M45 49C36 45 28 47 20 43C17 42 14 40 10 41C14 45 18 50 24 51C32 52 38 54 45 55Z', c.g('#2a2430'), 2.4)
      : P('M45 50C38 49 33 54 26 53C21 52 18 49 13 50C17 54 21 58 27 58.5C34 59 39 56 45 55Z', c.g('#2a2430'), 2.4);
    const torso = P('M38 53Q50 48 62 53L64 76Q50 79 36 76Z', c.g('#4a4352'), 3)
      + P('M37.2 65.5L63.3 63.5L63.6 68.5L36.8 70.5Z', c.g('#d14fc0'), 2.2)
      + T('M51 54L49 64', '#2a2430', 2);
    const headG = P('M35 49C33 42 31 37 23 35C28 31 31 22 42 19C56 16 68 26 67.5 40C67 46 63 50 58 51Z', c.g(hood, 0.25), 3)
      + E(57, 41, 9, 10, c.r(skin, 0.3), 0)
      + P('M47.5 33Q57 29 66.5 33.5L65.5 38L63 35L60.5 39L58 34.5L55 38.5L53 34.5L50 38Z', '#2a2234', 0)
      + P('M48 38.5L66 38.5L65 41L48.5 41Z', '#1c1426', 0, op(0.25))
      + P('M53.2 41.2l3.6-1 .2 1.6-3.4.4z', '#2a1a2e', 0.6) + P('M60.2 40.6l3.6.2-.4 1.6-3.2-.4z', '#2a1a2e', 0.6)
      + C(55.6, 41, 0.6, '#ff8ef0', 0) + C(62.4, 41, 0.6, '#ff8ef0', 0)
      + P('M45.5 45Q57 41.5 67.5 44.5L67 51Q57 54 46 51.5Z', c.g('#2a2430'), 2.5)
      + T('M40 24Q47 20 55 20', sh(hood, 0.45), 1.6)
      + P('M42 46.5C40 41 41 35 45 31', 'none', 0) + T('M44 47C42 42 42.5 37 45.5 33', sh(hood, -0.4), 2);
    if (!atk) {
      const up = scarfTail + dagger(c, 40, 66, 155) + arm(45, 56, 40, 66, '#3e3846', skin, 41, 61)
        + torso + headG
        + dagger(c, 63, 66, -28) + arm(56, 56, 63, 66, '#4a4352', skin, 61, 60);
      return shadow + wisp + legs(c, pose, '#2b2733', '#1f1b24') + G(up, bob ? `translate(0 ${bob})` : '');
    }
    // 공격: 앞으로 파고들며 X자로 벰
    const slash = P('M70 30Q92 40 90 70Q88 48 70 30Z', '#f2b8ea', 0, op(0.9)) + P('M96 34Q78 44 74 72Q84 50 96 34Z', '#d14fc0', 0, op(0.85));
    const up = G(scarfTail + torso + headG, 'rotate(12 50 80)');
    return shadow + wisp + legs(c, pose, '#2b2733', '#1f1b24')
      + dagger(c, 44, 46, -125) + arm(48, 56, 44, 47, '#3e3846', skin, 42, 53) + up
      + slash + dagger(c, 78, 60, -8, true) + arm(60, 58, 78, 60, '#4a4352', skin, 70, 62);
  }

  /* ---------- 모르는 영웅: 회색 자리표시 ---------- */
  function heroPlaceholder(c, pose) {
    return legs(c, pose, '#6a6a78', '#4a4a56') + P('M38 53Q50 48 62 53L64 76Q50 80 36 76Z', c.g('#9a9aa8'), 3)
      + C(50, 37, 15, c.r('#c8c8d2'), 3) + sEyes(55, 39);
  }

  const HEROES = { kara, sera, sio, zena, bawi, yaro };

  RG.art.hero = function hero(id, pose = 'idle') {
    const c = pad();
    const p = LEGS[pose] ? pose : 'idle';
    let body;
    try {
      body = (HEROES[id] || heroPlaceholder)(c, p);
    } catch (e) {
      body = heroPlaceholder(c, 'idle');
    }
    return wrap('0 0 100 100', c, body);
  };

  /* =========================================================
   * 초상화 (200×200) — 가슴 위, 살짝 오른쪽을 봄
   * ========================================================= */
  const FACE = 'M62 84C61 52 80 34 104 34C130 34 146 52 145 84C144 110 131 131 109 140C101 143 94 142 88 138C72 128 63 108 62 84Z';
  const TORSO = 'M26 204C28 172 50 157 84 153L120 153C154 157 174 172 176 204Z';

  /** 둥근 털·곱슬머리 테두리: 타원을 따라 바깥으로 부푼 호를 이음 */
  function curls(cx, cy, rx, ry, a0, a1, n, r) {
    let d = '';
    for (let i = 0; i <= n; i++) {
      const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180;
      const x = num(cx + Math.cos(a) * rx);
      const y = num(cy + Math.sin(a) * ry);
      d += i ? `A${r} ${r} 0 0 1 ${x} ${y}` : `M${x} ${y}`;
    }
    return d;
  }

  /** 배경 원판 + 원소 무늬 */
  function plate(c, col, motif) {
    const g = c.raw(`pl${col}`, (id) => h().rg(id, [[0, sh(col, 0.62)], [0.62, sh(col, 0.25)], [1, col]], 0.5, 0.4, 0.62));
    return C(100, 100, 94, g, 0) + C(100, 100, 87, 'none', 0, ' stroke="#fff" stroke-width="2.5" opacity=".4"')
      + (motif ? G(motif, '', ' fill="#fff" opacity=".55"') : '');
  }
  const sparkle = (x, y, r) => `<path d="${h().starPath(x, y, r, r * 0.32, 4, 0)}"/>`;

  /** 눈 하나. o: iris, sx(가로 비율), lid(0~1 덮임), lx/ly(눈동자 이동), closed, wink, lash(-1|1), star, tear, glow */
  function pEye(c, x, y, o) {
    const w = 10 * (o.sx || 1);
    const top = 11.5 * (1 - (o.lid || 0) * 0.75);
    const lash = o.lash ? T(`M${num(x + o.lash * w)} ${y - 1}l${o.lash * 4} -4`, OLC, 3) : '';
    if (o.closed) {
      return T(`M${num(x - w)} ${y + 2}Q${x} ${y - 9} ${num(x + w)} ${y + 2}`, OLC, 3.8) + lash;
    }
    const d = `M${num(x - w)} ${y}C${num(x - w * 0.8)} ${num(y - top)} ${num(x + w * 0.8)} ${num(y - top)} ${num(x + w)} ${y}C${num(x + w * 0.8)} ${y + 9.5} ${num(x - w * 0.8)} ${y + 9.5} ${num(x - w)} ${y}Z`;
    const id = c.raw(`clip${d}`, (k) => `<clipPath id="${k}"><path d="${d}"/></clipPath>`).slice(5, -1);
    const ix = x + (o.lx == null ? 1.5 : o.lx);
    const iy = y + (o.ly == null ? 1.5 : o.ly);
    const ir = 7.2 * (o.sx || 1) * (o.small ? 0.82 : 1);
    const ig = c.raw(`ir${o.iris}`, (k) => h().lg(k, [[0, sh(o.iris, -0.45)], [0.55, o.iris], [1, sh(o.iris, 0.45)]]));
    const hl = o.star
      ? P(h().starPath(ix - 2, iy - 3, 4.2, 1.4, 4, 0), '#fff', 0) + C(ix + 3, iy + 3, 1.4, '#fff', 0)
      : C(ix - 2.4, iy - 3.2, 2.7, '#fff', 0) + C(ix + 2.8, iy + 2.8, 1.3, '#fff', 0);
    return P(d, '#fff', 0)
      + G(C(ix, iy, ir, ig, 0) + C(ix, iy, ir * 0.48, o.glow || OLC, 0) + hl, '', ` clip-path="url(#${id})"`)
      + T(`M${num(x - w - 1)} ${y + 1}C${num(x - w * 0.8)} ${num(y - top)} ${num(x + w * 0.8)} ${num(y - top)} ${num(x + w + 1)} ${y - 0.5}`, OLC, 3.8)
      + T(`M${num(x - w * 0.6)} ${y + 7.6}Q${x} ${y + 9.6} ${num(x + w * 0.6)} ${y + 7.6}`, OLC, 1.6, op(0.5))
      + (o.smileLid ? T(`M${num(x - w * 0.8)} ${y + 6}Q${x} ${y + 1} ${num(x + w * 0.8)} ${y + 6}`, OLC, 2.6) : '')
      + (o.tear ? P(`M${num(x + w * 0.4)} ${y + 8}q-4 7-1 10q4 1 4-4q0-3-3-6z`, '#bfeaff', 2) : '')
      + lash;
  }

  /** 입. x,y = 가운데 */
  const MOUTH = {
    smile: (x, y) => T(`M${x - 10} ${y - 3}Q${x} ${y + 5} ${x + 10} ${y - 3}`, OLC, 3.3),
    soft: (x, y) => T(`M${x - 7} ${y - 1}Q${x} ${y + 3.5} ${x + 7} ${y - 1}`, OLC, 3),
    flat: (x, y) => T(`M${x - 7} ${y}Q${x} ${y + 1} ${x + 6} ${y - 0.8}`, OLC, 3),
    frown: (x, y) => T(`M${x - 7} ${y + 3}Q${x} ${y - 3} ${x + 7} ${y + 3}`, OLC, 3),
    wavy: (x, y) => T(`M${x - 9} ${y + 1}q2.2-3 4.5 0t4.5 0t4.5 0t4.5 0`, OLC, 3),
    smirk: (x, y) => T(`M${x - 9} ${y + 1}Q${x + 1} ${y + 3} ${x + 10} ${y - 5}`, OLC, 3.3) + T(`M${x + 9} ${y - 8}l2.5 3.5`, OLC, 2),
    o: (x, y) => E(x, y + 1, 4.5, 5.5, '#6a1a2a', 3),
    grit: (x, y) => P(`M${x - 11} ${y - 5}h22q2 0 2 2v6q0 2-2 2h-22q-2 0-2-2v-6q0-2 2-2z`, '#fff', 3)
      + T(`M${x - 12} ${y}h24M${x - 4} ${y - 5}v10M${x + 4} ${y - 5}v10`, OLC, 1.5),
    grin: (x, y, s = 1, smug) => {
      const a = 12 * s;
      const b = 10 * s;
      const r = smug ? -4 : 0;
      return P(`M${x - a} ${y - 5}Q${x} ${y - 2} ${x + a} ${y - 6 + r}Q${x + a - 2} ${y + b} ${x} ${y + b}Q${x - a + 2} ${y + b} ${x - a} ${y - 5}Z`, '#7a2232', 3)
        + P(`M${x - a + 3} ${y - 3.6}Q${x} ${y - 1.2} ${x + a - 3} ${y - 4.6 + r}L${x + a - 4} ${y - 1 + r / 2}Q${x} ${y + 1.5} ${x - a + 4} ${y - 0.6}Z`, '#fff', 0)
        + P(`M${x - 6 * s} ${y + b - 3}Q${x} ${y + b - 8 * s} ${x + 6 * s} ${y + b - 3}Q${x + 3} ${y + b - 0.6} ${x} ${y + b - 0.6}Q${x - 3} ${y + b - 0.6} ${x - 6 * s} ${y + b - 3}Z`, '#ff8a8a', 0);
    },
  };
  const BROW = {
    normal: ['M74 77Q85 71 97 75', 'M114 75Q125 71 135 76'],
    happy: ['M74 73Q85 65 97 70', 'M114 70Q125 65 135 72'],
    worried: ['M74 77Q86 75 96 67', 'M115 67Q124 75 135 78'],
  };
  const sweat = (c, x = 150, y = 60) => P(`M${x} ${y}c-4 7-7 11-4 15c3 3 9 1 8-5c-.5-3-2.5-6-4-10z`, c.g('#cdeeff', 0.2), 2.6) + T(`M${x - 2} ${y + 9}q0 2 1.5 3`, '#fff', 1.6);

  /** 사람 초상화 공통 조립 */
  function human(c, o, mood) {
    const skin = o.skin;
    const ey = o.eyeY || 94;
    const happy = mood === 'happy';
    const worried = mood === 'worried';
    const eye = Object.assign({ iris: o.iris, lid: o.lid || 0, sx: o.eyeSx || 1 }, o.eye, o.eyes && o.eyes[mood]);
    const eyeL = Object.assign({}, eye, o.lash ? { lash: -1 } : null, eye.left);
    const eyeR = Object.assign({}, eye, { sx: (eye.sx || 1) * 0.9 }, o.lash ? { lash: 1 } : null, eye.right);
    const brow = (o.brows && o.brows[mood]) || BROW[mood];
    const mouth = (o.mouth && o.mouth[mood]) || 'soft';
    const my = o.mouthY || 121;
    return plate(c, o.bg, o.motif)
      + (o.back ? o.back(c, mood) : '')
      + P('M86 124L85 158L119 158L117 124Z', c.g(sh(skin, -0.12), 0.15), 3.5)
      + o.body(c, mood)
      + E(66, ey + 2, 7.5, 10.5, c.g(skin, 0.15), 3.5) + T(`M67.5 ${ey - 4}q-4 6 0 12`, sh(skin, -0.3), 2.2)
      + P(o.face || FACE, c.r(skin, 0.22), 4)
      + E(79, ey + 18, 9, 5, '#ff6f86', 0, op(happy ? 0.5 : 0.28)) + E(134, ey + 17, 6.5, 4.5, '#ff6f86', 0, op(happy ? 0.5 : 0.28))
      + (o.faceExtra ? o.faceExtra(c, mood) : '')
      + pEye(c, 86, ey, eyeL) + pEye(c, 124, ey, eyeR)
      + T(`M112 ${ey + 9}q4 5-1 7`, sh(skin, -0.35), 2.6)
      + (typeof mouth === 'function' ? mouth(106, my) : MOUTH[mouth](106, my))
      + (o.front ? o.front(c, mood) : '')
      + T(`${brow[0]}${brow[1]}`, o.browC || '#3a2a2a', 4.6)
      + (worried ? sweat(c, o.sweatX, o.sweatY) : '');
  }

  /* ---------- 카라 ---------- */
  const P_KARA = {
    bg: '#ff8a3d', skin: '#efb98f', iris: '#d9692a', browC: '#8a2a1e', lash: true,
    motif: `<circle cx="30" cy="58" r="3"/><circle cx="42" cy="34" r="2"/><circle cx="168" cy="44" r="3.5"/><circle cx="178" cy="70" r="2"/>`,
    mouth: { normal: (x, y) => MOUTH.grin(x, y, 0.85), happy: (x, y) => MOUTH.grin(x, y + 1, 1.2), worried: 'grit' },
    eyes: { happy: { closed: true }, worried: { small: true, ly: 1 } },
    back(c) {
      const hair = '#e2452f';
      return L('M150 206L172 116', '#a8703c', 9, 4)
        + G(P('M-24 -15h48v30h-48z', c.g('#62667a', 0.35), 4) + P('M-24 -15h7v30h-7zM17 -15h7v30h-7z', c.g('#ff8a3d', 0.3), 3)
          + P('M-6 -15h12v30h-12z', '#43465a', 3) + T('M-12 -9h4', '#a8aec4', 3), 'translate(170 112) rotate(-14)')
        + G(P('M96 40C96 20 84 4 58 2C68 10 70 16 69 22C54 14 34 18 20 34C36 32 46 36 52 42C36 46 26 58 24 76C36 64 50 58 62 58C56 66 54 76 56 88C64 72 74 62 86 56Z', c.g(hair, 0.28), 4)
        + T('M84 28C76 18 68 14 62 12M58 34C48 32 40 34 34 38M60 50C50 54 42 60 38 66', sh(hair, 0.4), 2.6), 'translate(2 5)');
    },
    body(c) {
      return P(TORSO, c.g('#ff8a3d', 0.25), 4)
        + P('M84 153L102 174L120 153Z', '#d99a70', 3)
        + P('M68 178C84 172 120 172 136 178L140 204H64Z', c.g('#8d5532', 0.25), 4)
        + L('M72 180L62 158', '#7a4628', 7, 4) + L('M132 180L142 158', '#7a4628', 7, 4)
        + C(76, 186, 2.6, '#e8c07a', 1.8) + C(128, 186, 2.6, '#e8c07a', 1.8)
        + T('M44 170q6 10 4 22M160 170q-6 10-4 22', sh('#ff8a3d', -0.3), 2.5);
    },
    faceExtra: () => E(136, 113, 6.5, 3, '#3a2626', 0, op(0.22)),
    front(c) {
      const hair = '#e2452f';
      return P('M63 88C56 58 70 29 103 27C131 25 151 44 149 73L141 63L139 77L129 58L124 74L114 55L107 72L98 54C90 64 80 68 72 72C68 76 65 81 63 88Z', c.g(hair, 0.28), 4)
        + T('M78 42Q94 32 114 34', sh(hair, 0.45), 3, op(0.8))
        + E(84, 38, 7, 9, c.g('#ffb03a', 0.3), 3.2, ' transform="rotate(-30 84 38)"');
    },
  };

  /* ---------- 세라 ---------- */
  const P_SERA = {
    bg: '#ffd96a', skin: '#fbdcc4', iris: '#c08a2e', browC: '#8f8fae', lash: true,
    motif: sparkle(34, 56, 7) + sparkle(168, 42, 6) + sparkle(176, 120, 4.5) + sparkle(24, 128, 4),
    mouth: { normal: 'soft', happy: (x, y) => MOUTH.grin(x, y, 0.75), worried: 'o' },
    eyes: { happy: { closed: true }, worried: { small: true, ly: 2.5 } },
    back(c) {
      return P('M60 92C50 54 72 28 104 28C138 28 156 54 150 94C150 130 158 166 170 206H34C46 166 58 130 60 92Z', c.g('#e6e8f3', 0.18), 4)
        + T('M52 150Q48 176 44 200M156 150Q160 176 164 200', '#b9bdd8', 2.5)
        + P('M66 156C62 140 80 133 102 133C124 133 140 140 136 156Z', c.g('#f4efe2', 0.12), 3.5);
    },
    body(c) {
      const gold = '#e8b84a';
      return P(TORSO, c.g('#fbf8f0', 0.1), 4)
        + P('M88 154L116 154L126 206H78Z', c.g('#ffe08a', 0.2), 3.5)
        + T('M86 156L76 204M118 156L128 204', gold, 4)
        + T('M40 176Q60 160 84 156M164 176Q144 160 120 156', gold, 3.5)
        + C(102, 168, 8.5, c.r(gold, 0.4), 3.2) + P('M99 162.5h6l1.2 2v6l-1.2 2h-6l-1.2-2v-6z', '#fff3b0', 1.8);
    },
    front(c) {
      const hair = '#e6e8f3';
      return P('M60 90C56 56 76 32 104 32C130 32 150 50 149 82C142 70 134 62 124 58C120 66 112 72 100 73C106 66 107 60 105 55C95 64 80 70 67 72C64 78 62 84 60 90Z', c.g(hair, 0.18), 4)
        + P('M62 76C55 100 58 132 50 168C60 164 66 152 68 136C70 118 70 98 73 84Z', c.g(hair, 0.18), 3.5)
        + P('M146 72C153 100 150 130 157 160C148 155 142 142 141 126C140 108 142 92 140 80Z', c.g(hair, 0.18), 3.5)
        + T('M80 44Q96 36 116 40', '#fff', 3, op(0.85))
        + P(h().starPath(74, 54, 8, 3.4, 5, -90), c.g('#ffd84a', 0.3), 2.5);
    },
  };

  /* ---------- 시오 ---------- */
  const P_SIO = {
    bg: '#5fd4ff', skin: '#f4d3b8', iris: '#4aa8e0', browC: '#2c2a36', lid: 0.35,
    motif: `<path d="M34 50v16M26 54l16 8M26 62l16-8M168 36v12M162 39l12 6M162 45l12-6M172 112v10M167 114.5l10 5M167 119.5l10-5" fill="none" stroke="#fff" stroke-width="2.5"/>`,
    brows: { normal: ['M75 76Q86 73 97 75', 'M114 75Q125 73 134 76'] },
    mouth: { normal: 'flat', happy: 'soft', worried: 'frown' },
    eyes: { happy: { closed: true }, worried: { lid: 0.05, small: true, lx: -1.5, ly: 2.5 } },
    sweatX: 152,
    back(c) {
      return L('M154 206Q190 140 174 60', '#3f4f74', 7, 4) + T('M174 62L158 206', '#e8f6ff', 2)
        + P('M174 60l-4-9 5 3 4-7 1 9z', '#bff0ff', 2.5)
        + P('M48 124C38 74 60 26 104 24C148 22 168 64 160 114C158 134 150 148 140 156H64C56 148 50 138 48 124Z', c.g('#f4f6fb', 0.14), 4)
        + T('M62 60Q80 32 112 30', '#fff', 3.5);
    },
    body(c) {
      return P(TORSO, c.g('#4bb6ea', 0.25), 4)
        + T('M102 158V204', '#2a7fb8', 3.5)
        + L('M58 166L134 206', '#7a4a30', 8, 4)
        + P('M122 162l6 7-6 9-6-9z', c.g('#bff0ff', 0.3), 2.5);
    },
    front(c) {
      return P('M66 76C66 50 84 40 106 40C128 40 144 52 144 74L138 64L134 70L126 57L120 68L112 55L105 68L97 55L89 66L81 57L74 70Z', c.g('#2c2a36', 0.3), 3.5)
        + T('M84 50Q98 44 112 46', '#5a5870', 2.5)
        + FUR('M105 32a47 58 0 1 0 .1 0', '#f4f6fb', 12, 9.5, 4);
    },
  };

  /* ---------- 제나 ---------- */
  function bigCoil(c, x, y, rot, mood) {
    return G(P('M-7 0h14v-96h-14z', '#7a6a8a', 4)
      + T('M-7-12h14m-14-12h14m-14-12h14m-14-12h14m-14-12h14m-14-12h14m-14-12h14', '#e0954a', 5)
      + C(0, -104, mood === 'happy' ? 20 : 16, c.halo('#d8d0ff', 0.9), 0)
      + C(0, -104, 10, c.r('#b9adff', 0.5), 4) + C(-3, -107, 2.8, '#fff', 0),
    `translate(${x} ${y}) rotate(${rot})`);
  }
  const P_ZENA = {
    bg: '#9b8cff', skin: '#c98c62', iris: '#7a5cff', browC: '#4a2a18',
    motif: `<path d="M30 40l-6 12h6l-4 10 10-14h-6l4-8zM170 120l-5 9h5l-3 8 8-11h-5l3-6z"/>`,
    mouth: { normal: (x, y) => MOUTH.grin(x, y, 0.8), happy: (x, y) => MOUTH.grin(x, y, 1.2), worried: 'wavy' },
    eyes: { happy: { star: true, lid: 0 }, worried: { small: true } },
    sweatX: 154, sweatY: 74,
    back(c, mood) {
      const hair = '#7a4a2c';
      return bigCoil(c, 44, 196, -12, mood) + bigCoil(c, 158, 196, 10, mood)
        + P(`${curls(102, 82, 58, 62, 115, 425, 13, 15)}Z`, c.g(hair, 0.25), 4);
    },
    body(c) {
      return P(TORSO, c.g('#8f7bff', 0.25), 4)
        + P('M84 153L102 180L120 153Z', '#f3e7d0', 3)
        + P('M84 153L74 166L96 178L102 180L80 156ZM120 153L130 166L108 178L102 180L124 156Z', sh('#8f7bff', -0.25), 3)
        + L('M58 164L70 206', '#7a5232', 8, 4) + L('M146 164L134 206', '#7a5232', 8, 4)
        + C(144, 186, 7, c.r('#ffd84a', 0.3), 3) + P('M145 180l-4 6h3l-2 6 5-7h-3l2-5z', '#7a4a00', 0);
    },
    faceExtra: () => G('<circle cx="74" cy="110" r="1.6"/><circle cx="81" cy="113" r="1.6"/><circle cx="76" cy="116" r="1.6"/><circle cx="132" cy="109" r="1.4"/><circle cx="138" cy="112" r="1.4"/>', '', ' fill="#7a4a30" opacity=".55"'),
    front(c) {
      const hair = '#7a4a2c';
      return P('M60 86C54 48 80 28 106 28C134 28 152 48 148 76A7 7 0 0 1 138 64A7 7 0 0 1 126 64A7 7 0 0 1 114 59A7 7 0 0 1 102 62A7 7 0 0 1 90 59A7 7 0 0 1 78 64A7 7 0 0 1 67 70A7 7 0 0 1 60 86Z', c.g(hair, 0.25), 4)
        + T('M56 66C76 44 124 38 152 56', OLC, 11) + T('M56 66C76 44 124 38 152 56', '#3a3046', 6)
        + C(92, 48, 14, c.g('#e0b04a', 0.3), 4) + C(128, 51, 12, c.g('#e0b04a', 0.3), 4)
        + C(92, 48, 9, c.r('#c9f0ff', 0.4), 2.5) + C(128, 51, 7.5, c.r('#c9f0ff', 0.4), 2.5)
        + T('M86 44q3-4 8-4M123 47q3-3 7-3', '#fff', 2.6);
    },
  };

  /* ---------- 야로 ---------- */
  const P_YARO = {
    bg: '#d14fc0', skin: '#ecc7ab', iris: '#d14fc0', browC: '#2a2234', lid: 0.45, eyeSx: 0.95,
    motif: '<path d="M38 40a14 14 0 1 0 12 22a11 11 0 1 1-12-22z"/><circle cx="168" cy="54" r="2.5"/><circle cx="176" cy="122" r="2"/>',
    brows: { normal: ['M74 81Q85 77 97 80', 'M114 77Q125 70 135 75'], happy: ['M74 79Q85 74 97 78', 'M114 77Q125 72 135 77'], worried: ['M74 81Q86 79 96 72', 'M115 72Q124 79 135 82'] },
    mouth: { normal: 'smirk', happy: (x, y) => MOUTH.grin(x, y, 0.85, true), worried: 'flat' },
    eyes: { happy: { right: { closed: true } }, worried: { lid: 0.08, lx: -3, ly: 2 } },
    back(c) {
      return G(P('M-4 -3h32l6 3-6 3h-32z', c.g('#e6e9f2', 0.2), 3) + P('M-6 -7h5v14h-5z', '#6e1f66', 3) + P('M-22 -3h16v6h-16z', '#3a2a3e', 3), 'translate(54 150) rotate(-128)')
        + P('M48 134C42 104 44 78 52 66C44 68 36 74 28 84C32 64 42 48 60 40C70 30 86 26 106 26C142 26 162 54 158 96C156 122 150 140 140 152H62C54 148 50 142 48 134Z', c.g('#8d8a96', 0.25), 4)
        + T('M40 64Q48 52 60 46', '#b8b5c2', 3);
    },
    body(c) {
      return P(TORSO, c.g('#4a4352', 0.25), 4)
        + T('M92 160L82 204M112 160L122 204', '#d14fc0', 4)
        + P('M66 152C66 136 138 136 138 152C140 166 122 172 102 172C82 172 64 166 66 152Z', c.g('#2a2430', 0.3), 4)
        + P('M76 162C66 176 62 190 64 206H86C84 190 86 176 90 166Z', c.g('#2a2430', 0.3), 4)
        + T('M84 150Q102 158 122 150', '#5a5064', 2.5);
    },
    faceExtra: () => T('M130 102l7 6', '#c98a7a', 2.5),
    front(c) {
      return P('M62 80C66 50 84 38 106 38C130 38 146 52 146 78C140 62 126 52 106 52C86 52 70 62 62 80Z', OLC, 0, op(0.3))
        + P('M63 86C62 60 82 46 106 46C128 46 144 58 145 82L139 70L135 78L128 62L122 72L115 58L108 70L101 58L94 70L87 60L80 72L73 64L68 78Z', c.g('#2e2638', 0.3), 3.5)
        + T('M96 52Q108 48 120 52', '#6a5a84', 2.5)
        + P('M54 104C48 62 74 30 106 30C140 30 162 60 155 104C150 72 132 44 106 43C80 43 60 66 54 104Z', c.g('#8d8a96', 0.25), 4);
    },
  };

  /* ---------- 바위 (돌 얼굴) ---------- */
  function bawiPortrait(c, mood) {
    const stone = '#a39d90';
    const moss = '#7fbf4a';
    const happy = mood === 'happy';
    const worried = mood === 'worried';
    const glow = '#8dffb0';
    const fl = (x, y, s, col) => G(flower(0, 0, col), `translate(${x} ${y}) scale(${s})`);
    const eye = (x, y, s) => {
      if (happy) return T(`M${x - 8 * s} ${y + 2}Q${x} ${y - 7} ${x + 8 * s} ${y + 2}`, OLC, 7) + T(`M${x - 8 * s} ${y + 2}Q${x} ${y - 7} ${x + 8 * s} ${y + 2}`, glow, 3);
      return E(x, y, 9 * s, (worried ? 9 : 8) * s, '#2a2a26', 3) + C(x + 1, y + 1, (worried ? 3.6 : 5) * s, c.r(glow, 0.5), 0) + C(x - 1, y - 2, 1.8, '#fff', 0);
    };
    const brow = worried ? ['M64 80L94 70L96 78L68 86Z', 'M114 70L144 78L142 86L112 78Z']
      : happy ? ['M64 72Q80 62 96 68L95 76Q80 72 66 80Z', 'M113 68Q130 62 145 72L143 80Q130 72 114 76Z']
        : ['M64 76Q80 68 96 72L95 80Q80 76 66 84Z', 'M113 72Q130 68 145 76L143 84Q130 76 114 80Z'];
    const mouth = happy ? P('M92 128Q106 132 122 127Q120 142 106 143Q94 142 92 128Z', '#3a2a26', 3) + P('M99 138Q106 134 114 138Q110 142 106 142Q101 142 99 138Z', '#ff8a8a', 0)
      : worried ? T('M94 133q3-3 6 0t6 0t6 0t6 0', OLC, 3.2) : T('M94 130Q106 137 120 129', OLC, 3.4);
    return plate(c, '#8fcf5a', '<path d="M30 54q10-12 18 0q-10 8-18 0zM164 40q10-12 18 0q-10 8-18 0zM166 118q8-9 14 0q-8 6-14 0z"/>')
      + P('M2 206C2 168 22 146 54 140C72 137 128 137 146 140C178 146 198 168 198 206Z', c.r(stone, 0.25), 4)
      + C(36, 162, 30, c.r(sh(stone, -0.08), 0.3), 4) + C(164, 162, 30, c.r(stone, 0.3), 4)
      + P(`${curls(36, 162, 30, 30, 200, 340, 6, 8)}Q36 146 ${num(36 - 28)} ${num(162 - 10)}Z`, c.g(moss, 0.25), 3)
      + P(`${curls(164, 162, 30, 30, 200, 340, 6, 8)}Q164 146 ${num(164 - 28)} ${num(162 - 10)}Z`, c.g(moss, 0.25), 3)
      + fl(30, 140, 2.2, '#fff6e0') + fl(170, 138, 2.2, '#ff9cc0')
      + P('M100 178l12 14-12 14-12-14z', c.r('#6dff9a', 0.5), 3.5) + C(100, 192, 18, c.halo(glow, 0.5), 0)
      + P('M52 96C48 58 70 32 102 30C136 28 156 54 154 92C152 124 136 146 102 148C68 148 54 128 52 96Z', c.r(stone, 0.3), 4)
      + T('M62 112l10 4M140 104l-6 8 4 6M84 46l6 6', sh(stone, -0.35), 2.6)
      + P(`${curls(103, 70, 52, 42, 196, 344, 9, 10)}C140 50 120 46 103 50C86 46 68 52 52 58Z`, c.g(moss, 0.25), 4)
      + fl(74, 36, 2.4, '#fff6e0') + fl(118, 30, 2.6, '#ff9cc0') + fl(140, 46, 2, '#fff6e0')
      + eye(84, 94, 1) + eye(124, 94, 0.92)
      + P(brow[0], c.g(moss, 0.2), 3) + P(brow[1], c.g(moss, 0.2), 3)
      + P('M108 98C118 98 122 112 114 116C108 118 102 114 104 106Z', c.r(stone, 0.4), 3.2)
      + P(`${curls(106, 136, 34, 38, -15, 195, 9, 9)}C80 117 132 117 138.8 126.2Z`, c.g(moss, 0.22), 3.5)
      + T('M96 150q6 8 4 16M116 150q-4 8-2 14', sh(moss, -0.3), 2.2)
      + mouth
      + P('M80 122C86 114 98 116 106 120C114 116 128 114 134 122C130 128 122 124 116 128C110 126 102 126 96 128C90 124 84 128 80 122Z', c.g(moss, 0.25), 3)
      + (worried ? sweat(c, 156, 70) : '')
      + E(74, 112, 8, 4.5, '#ff8a8a', 0, op(happy ? 0.45 : 0.2)) + E(138, 110, 6, 4, '#ff8a8a', 0, op(happy ? 0.45 : 0.2));
  }

  /* ---------- 촌장 모아 할머니 ---------- */
  const P_ELDER = {
    bg: '#f2a97e', skin: '#f0c9a6', iris: '#7a4a2a', browC: '#b9b2aa', lid: 0.5,
    face: 'M62 86C61 54 80 36 104 36C130 36 146 54 145 86C144 114 130 134 106 140C98 142 92 141 86 137C70 128 63 110 62 86Z',
    motif: '<circle cx="34" cy="56" r="5"/><circle cx="168" cy="46" r="4"/><circle cx="174" cy="118" r="3"/>',
    mouth: { normal: 'smile', happy: (x, y) => MOUTH.grin(x, y, 0.8), worried: 'frown' },
    eyes: { happy: { closed: true }, worried: { lid: 0.15, small: true } },
    back(c) {
      return C(84, 30, 21, c.r('#e8e4de', 0.3), 4) + T('M70 22q14-6 28 2', '#c9c2b8', 2.5)
        + L('M54 18L116 40', '#8a5a3a', 4, 3.5) + C(54, 18, 4, '#d9463a', 2.5) + C(116, 40, 3.5, '#d9463a', 2.5);
    },
    body(c) {
      return P('M86 153L102 172L118 153Z', '#f6ead6', 3)
        + P('M26 204C28 172 50 158 82 152L102 188L122 152C154 158 174 172 176 204Z', c.g('#a8456a', 0.25), 4)
        + T('M82 154L102 188L122 154', '#f2c46a', 3.5)
        + G('<circle cx="56" cy="180" r="3"/><circle cx="70" cy="194" r="3"/><circle cx="48" cy="198" r="3"/><circle cx="146" cy="180" r="3"/><circle cx="134" cy="194" r="3"/><circle cx="156" cy="198" r="3"/>', '', ' fill="#f2c46a" opacity=".8"')
        + C(102, 186, 6, c.r('#f2a23a', 0.4), 3);
    },
    faceExtra: (c, mood) => T(`M92 58q12-3 24 0M64 92l-5-2M64 98l-5 1M144 90l4-2M144 96l4 1M88 116q-5 8-1 14M128 114q4 8 1 13${mood === 'worried' ? 'M96 64q10-3 18 0' : ''}`, sh('#f0c9a6', -0.3), 2.2),
    front(c) {
      return P('M61 98C52 60 72 30 104 30C134 30 152 50 147 86C140 64 124 52 104 52C90 52 78 58 72 66C67 74 64 86 63 98Z', c.r('#e8e4de', 0.3), 4)
        + T('M74 64C80 50 92 42 104 40M104 40C118 40 132 46 140 58M86 50C94 42 104 38 112 38', '#c9c2b8', 2.5);
    },
  };

  /* ---------- 하루 (시오의 동생) ---------- */
  const P_HARU = {
    bg: '#8fdcff', skin: '#f8d6ba', iris: '#4a7ab8', browC: '#2c2a36', eyeY: 101, mouthY: 128,
    face: 'M60 92C58 58 78 40 104 40C132 40 149 60 148 92C147 120 130 142 104 144C78 142 61 122 60 92Z',
    eye: { sx: 1.1 },
    brows: { normal: ['M75 83Q85 79 95 81', 'M115 81Q125 79 133 83'], happy: ['M75 81Q85 75 95 79', 'M115 79Q125 75 133 81'], worried: ['M75 84Q86 82 95 76', 'M116 76Q124 82 133 85'] },
    motif: '<circle cx="32" cy="60" r="4"/><circle cx="170" cy="50" r="5"/><circle cx="176" cy="126" r="3"/><circle cx="24" cy="130" r="2.5"/>',
    mouth: { normal: (x, y) => MOUTH.grin(x, y, 0.75), happy: (x, y) => MOUTH.grin(x, y, 1.15), worried: 'wavy' },
    eyes: { happy: { closed: true }, worried: { tear: true, ly: 2.5 } },
    sweatX: 152, sweatY: 70,
    back(c) {
      return C(118, 15, 11.5, c.r('#ffffff', 0.1), 4);
    },
    body(c) {
      return P('M40 206C42 178 60 164 86 158L118 158C144 164 162 178 164 206Z', c.g('#fff4e2', 0.15), 4)
        + P('M64 158C62 144 142 144 140 158C142 170 124 176 102 176C80 176 62 170 64 158Z', c.g('#5fb8f0', 0.25), 4)
        + T('M80 150v24M100 148v28M120 150v24', '#fff', 4)
        + P('M118 168l10 34h-14l-4-30z', c.g('#5fb8f0', 0.25), 3.5);
    },
    front(c) {
      return P('M60 68L146 66L148 80L141 72L136 79L129 71L122 78L115 70L108 78L101 70L94 77L87 70L80 78L73 71L66 79L62 76Z', c.g('#2c2a36', 0.3), 3)
        + P('M58 66C54 34 78 14 104 14C132 14 154 32 150 66Z', c.g('#5fb8f0', 0.25), 4)
        + P('M52 68C54 56 152 54 154 66C156 78 54 80 52 68Z', c.g('#3a8fd0', 0.25), 4)
        + T('M66 62v8M80 60v10M94 59v10M108 59v10M122 59v10M136 60v10M146 62v7', '#2a6aa8', 2.2)
        + T('M74 36Q90 24 112 26', '#bfe6ff', 3);
    },
  };

  /* ---------- 종지기 (종 모양 가면) ---------- */
  function bellkeeperPortrait(c, mood) {
    const happy = mood === 'happy';
    const worried = mood === 'worried';
    const glow = happy ? '#ffd88a' : worried ? '#9ab0c8' : '#cfeaff';
    const slit = (x, s) => {
      const d = happy ? `M${x - 9} ${92 + 3}Q${x} ${92 - 7} ${x + 9} ${95}`
        : worried ? (s < 0 ? `M${x - 9} 92L${x + 8} 87` : `M${x - 8} 87L${x + 9} 92`) : `M${x - 9} 91Q${x} 88 ${x + 9} 91`;
      return T(d, OLC, 8) + T(d, glow, 3);
    };
    const mask = P('M100 50C82 50 74 64 73 82C72 102 66 116 60 124C57 129 60 134 66 134H134C140 134 143 129 140 124C134 116 128 102 127 82C126 64 118 50 100 50Z', c.g('#ece6da', 0.18), 4)
      + T('M66 126H134', '#b8b0a2', 3) + T('M80 64Q100 58 120 64', '#fff', 3, op(0.7))
      + P('M94 50a6 6 0 0 1 12 0z', '#cfc6b6', 3)
      + T('M116 58L110 74L118 86L112 100', OLC, 2.5)
      + C(108, 92, 22, c.halo(glow, happy ? 0.35 : 0.2), 0)
      + slit(88, -1) + slit(116, 1)
      + C(100, 140, 6, c.r('#6a6a78', 0.3), 3);
    return plate(c, '#7d8296', '<circle cx="34" cy="60" r="3"/><circle cx="170" cy="56" r="2.5"/>')
      + P('M100 8C70 8 56 32 54 62C52 98 40 122 18 138C13 144 17 152 26 152H174C183 152 187 144 182 138C160 122 148 98 146 62C144 32 130 8 100 8Z', c.g('#b08a4a', 0.3), 4)
      + T('M57 52H143M50 112H150', '#7a5a2a', 3) + T('M134 22L126 40L136 54L128 70', OLC, 3)
      + C(100, 8, 6, '#8a6a3a', 3)
      + P(TORSO, c.g('#6e6e7c', 0.25), 4) + T('M70 170q4 16 2 34M134 170q-4 16-2 34', '#4a4a56', 3)
      + L('M60 152L84 204', '#6a5a40', 8, 4) + L('M144 152L120 204', '#6a5a40', 8, 4)
      + P('M54 152C44 112 52 44 100 38C148 44 156 112 146 152Z', c.g('#8a8a96', 0.25), 4)
      + P('M68 140C62 104 72 56 100 52C128 56 138 104 132 140Z', '#2a2632', 3)
      + G(mask, worried ? 'rotate(-5 100 100) translate(0 3)' : happy ? 'rotate(3 100 100)' : '')
      + (happy ? sparkle(152, 64, 6).replace('/>', ' fill="#ffe9a0"/>') : '');
  }

  function portraitPlaceholder(c) {
    return plate(c, '#9a9aa8') + P(TORSO, c.g('#7a7a88'), 4) + P(FACE, c.r('#c8c8d2'), 4)
      + T('M92 80q0-12 12-12t12 12q0 10-12 12v8M104 112v2', OLC, 6);
  }

  const PORTRAITS = { kara: P_KARA, sera: P_SERA, sio: P_SIO, zena: P_ZENA, yaro: P_YARO, elder: P_ELDER, haru: P_HARU };
  const PORTRAIT_FN = { bawi: bawiPortrait, bellkeeper: bellkeeperPortrait };

  RG.art.portrait = function portrait(id, mood = 'normal') {
    const c = pad();
    const m = BROW[mood] ? mood : 'normal';
    let body;
    try {
      body = PORTRAIT_FN[id] ? PORTRAIT_FN[id](c, m) : PORTRAITS[id] ? human(c, PORTRAITS[id], m) : portraitPlaceholder(c);
    } catch (e) {
      body = portraitPlaceholder(c);
    }
    return wrap('0 0 200 200', c, body);
  };

  /* =========================================================
   * 아군 유닛 (100×100, 발 (50,90), 오른쪽을 바라봄)
   * ========================================================= */
  const MOSS = '#7fbf4a';
  /** 돌 다리 두 개 */
  function stoneLegs(c, col, atk, w = 9) {
    const one = (x, cc) => P(`M${x - w / 2} 78h${w}v9q0 3-3 3h-${w - 6}q-3 0-3-3z`, c.g(cc), 2.8);
    return atk ? one(40, sh(col, -0.2)) + one(60, col) : one(44, sh(col, -0.2)) + one(56, col);
  }
  /** 이끼 모자 (돌 머리 위) */
  const mossCap = (c, x, y, r) => P(`M${x - r} ${y}C${x - r} ${y - r * 1.25} ${x + r} ${y - r * 1.25} ${x + r} ${y}C${x + r * 0.5} ${y - r * 0.45} ${x} ${y - r * 0.2} ${x - r * 0.4} ${y - r * 0.5}C${x - r * 0.6} ${y - r * 0.2} ${x - r * 0.8} ${y - r * 0.1} ${x - r} ${y}Z`, c.g(MOSS, 0.25), 2.4);
  const golemEyes = (x, y, col = '#d8ff8a') => C(x, y, 1.9, col, 0) + C(x + 6.5, y, 1.7, col, 0);

  function stoneSoldier(c, pose) {
    const atk = pose === 'attack';
    const stone = '#a39d90';
    const spear = atk
      ? L('M34 60H86', '#9a6a3a', 3.2) + P('M85 55l13 5-13 5 2-5z', c.g('#8a8478', 0.35), 2.4) + T('M20 52h10M16 60h12M22 68h10', '#fff', 2, op(0.6))
      : L('M66 88V26', '#9a6a3a', 3.2) + P('M61.5 27l4.5-13 4.5 13-4.5-2z', c.g('#8a8478', 0.35), 2.4);
    const body = P('M34 64C32 51 40 44 50 44C60 44 68 51 66 64C66 76 60 82 50 82C40 82 34 76 34 64Z', c.r(stone, 0.3), 3)
      + P('M36 72C42 78 52 79 62 74C58 80 44 82 36 72Z', c.g(MOSS, 0.2), 2) + T('M42 56l4 3M58 68l-3 2', sh(stone, -0.35), 2)
      + C(52, 35, 11, c.r(stone, 0.35), 3) + mossCap(c, 52, 32, 11.5)
      + golemEyes(55, 36.5);
    const shield = C(35, 62, 10, c.r('#9a6a3a', 0.3), 3) + C(35, 62, 6.5, 'none', 0, ' stroke="#6a4424" stroke-width="2"') + C(35, 62, 2.2, '#c9c2b4', 1.8);
    const g = atk ? 'rotate(8 50 82)' : '';
    return stoneLegs(c, stone, atk) + G(shield + body, g) + spear + C(atk ? 64 : 66, atk ? 60 : 64, 5, c.r(stone, 0.35), 2.6);
  }

  function graniteGuard(c, pose) {
    const atk = pose === 'attack';
    const granite = '#b9a59c';
    const speck = '<circle cx="40" cy="58" r="1.3"/><circle cx="46" cy="70" r="1.2"/><circle cx="34" cy="66" r="1"/><circle cx="52" cy="54" r="1"/><circle cx="44" cy="30" r="1"/><circle cx="56" cy="74" r="1.2"/>';
    const body = P('M28 64C26 48 36 40 50 40C64 40 72 48 70 64C70 78 62 84 49 84C36 84 28 78 28 64Z', c.r(granite, 0.3), 3.2)
      + P('M30 74C38 82 54 84 66 76C60 84 40 86 30 74Z', c.g(MOSS, 0.2), 2)
      + C(50, 32, 12, c.r(granite, 0.35), 3)
      + P('M38 30C38 18 62 18 63 30L60 27L57 31L53 24L49 31L45 25L42 31Z', c.g('#8a7a72', 0.3), 2.6)
      + mossCap(c, 50, 22.5, 7)
      + golemEyes(54, 34)
      + G(speck, '', ' fill="#6a5a54" opacity=".6"');
    const mace = L('M32 66L22 46', '#6a4424', 3.4) + C(21, 43, 6, c.r('#8a7a72', 0.35), 2.6) + T('M17 40l-3-2M25 39l2-3M20 37v-3', OLC, 2.4);
    const sx = atk ? 10 : 0;
    const shield = P(`M${56 + sx} 38h18q4 0 4 4v34q0 8-13 12q-13-4-13-12v-34q0-4 4-4z`, c.g('#9c8a82', 0.3), 3.2)
      + P(`M${56 + sx} 40h22v5c-6-3-16-3-22 0z`, c.g(MOSS, 0.2), 2)
      + P(`M${67 + sx} 52l6 8-6 10-6-10z`, c.r('#6dff9a', 0.5), 2.2) + C(67 + sx, 61, 9, c.halo('#8dffb0', atk ? 0.7 : 0.4), 0)
      + (atk ? T('M92 44l6-3M93 62h7M92 79l6 3', '#fff', 2.4, op(0.8)) : '');
    return stoneLegs(c, granite, atk, 11) + mace + G(body, atk ? 'rotate(6 50 84)' : '') + shield;
  }

  function obsidianBlade(c, pose) {
    const atk = pose === 'attack';
    const ob = '#2e2a3a';
    const hi = '#8f86c8';
    const legs = atk
      ? P('M42 74L34 90H42L48 76Z', c.g(ob), 2.6) + P('M54 74L64 90H72L60 74Z', c.g(ob), 2.6)
      : P('M42 74L40 90H48L49 76Z', c.g(ob), 2.6) + P('M53 74L54 90H62L59 74Z', c.g(ob), 2.6);
    const body = P('M38 50L50 42L64 48L62 70L52 78L40 72Z', c.g(ob, 0.35), 3)
      + P('M50 42L64 48L54 56L44 52Z', hi, 0, op(0.45)) + T('M54 56L52 76', '#5a5274', 1.6)
      + P('M42 36L50 22L62 28L62 40L52 44L43 42Z', c.g(ob, 0.35), 3)
      + P('M50 22L62 28L54 33Z', '#c9c0ff', 0, op(0.6))
      + P('M53 34.5L62 33L61.5 36.5L53.5 37Z', '#8dffb0', 0) + C(58, 35.5, 5, c.halo('#8dffb0', 0.7), 0)
      + P('M38 50L32 56L38 60Z', c.g(ob), 2.4);
    const blade = (x, y, rot) => G(P('M0 -3L32 -1.4L38 0L32 1.4L0 3Z', c.g('#3a3450', 0.5), 2.4) + T('M3 -1.2L32 -0.3', '#d8d0ff', 1.3)
      + P('M-1 -6h3v12h-3z', '#8dffb0', 1.8) + P('M-8 -2h7v4h-7z', '#1c1426', 0), `translate(${x} ${y}) rotate(${rot})`);
    if (atk) {
      const arc = P('M58 18Q100 30 90 78Q92 44 58 18Z', '#d8d0ff', 0, op(0.75)) + P('M66 20Q96 34 90 68Q88 42 66 20Z', '#fff', 0, op(0.6));
      return arc + legs + G(body, 'rotate(10 50 80)') + blade(62, 58, -4) + C(62, 58, 4.4, c.g(ob, 0.4), 2.6);
    }
    return legs + body + blade(62, 62, -48) + C(62, 62, 4.4, c.g(ob, 0.4), 2.6);
  }

  function drone(c, pose) {
    const atk = pose === 'attack';
    const rotor = (x) => L(`M${x} 38V31`, '#5a5470', 2.4) + E(x, 29, 11, 2.6, '#e8e2ff', 2, op(0.75)) + T(`M${x - 8} 29h16`, '#9b8cff', 1.4, op(0.8));
    const bolt = atk
      ? C(51, 73, 11, c.halo('#d8d0ff', 1), 0) + C(80, 86, 10, c.halo('#c9bfff', 0.8), 0)
        + P('M50 74L62 76L59 79L74 80L70 83L90 88L68 88L71 85L56 84L59 81Z', '#f4f0ff', 2)
        + P('M66 82L70 92L64 87Z', '#f4f0ff', 1.6) + T('M36 76l-5 2M42 84l-3 4', '#e8e2ff', 1.6)
      : C(51, 73, 5.5, c.halo('#d8d0ff', 0.8), 0);
    return rotor(37) + rotor(65)
      + L('M51 60V70', '#7a6a8a', 4)
      + T('M48.5 62h5M48.5 65.5h5', '#e0954a', 1.8)
      + bolt + C(51, 73, 3.4, c.r('#c9bfff', 0.5), 2.2)
      + P('M30 48C30 36 40 32 51 32C62 32 72 36 72 48C72 58 62 62 51 62C40 62 30 58 30 48Z', c.r('#8f7bff', 0.35), 3)
      + T('M31 49Q51 54 71 49', '#e0b04a', 3) + T('M31 49Q51 54 71 49', OLC, 1, op(0.4))
      + T('M38 39Q46 35 54 36', '#fff', 2, op(0.7))
      + C(63, 46, atk ? 9 : 7, c.halo('#bff4ff', atk ? 1 : 0.7), 0)
      + C(63, 46, 5.2, '#2a2440', 2.6) + C(63.6, 46, 3, c.r('#bff4ff', 0.4), 0) + C(62.4, 44.8, 1, '#fff', 0)
      + T('M51 32V26', OLC, 2.4) + C(51, 24.5, 2.4, '#ffd84a', 1.8);
  }

  function rockWall(c, pose) {
    const atk = pose === 'attack';
    const stone = '#a39d90';
    const rock = (x, y, rx, ry, col, moss) => P(`M${x - rx} ${y + ry * 0.3}C${x - rx} ${y - ry * 0.9} ${x - rx * 0.4} ${y - ry} ${x} ${y - ry}C${x + rx * 0.6} ${y - ry} ${x + rx} ${y - ry * 0.7} ${x + rx} ${y + ry * 0.2}C${x + rx} ${y + ry} ${x + rx * 0.5} ${y + ry} ${x} ${y + ry}C${x - rx * 0.6} ${y + ry} ${x - rx} ${y + ry * 0.9} ${x - rx} ${y + ry * 0.3}Z`, c.r(col, 0.3), 3.2)
      + (moss ? P(`M${x - rx * 0.85} ${y - ry * 0.35}C${x - rx * 0.6} ${y - ry * 1.05} ${x + rx * 0.6} ${y - ry * 1.05} ${x + rx * 0.9} ${y - ry * 0.4}C${x + rx * 0.4} ${y - ry * 0.65} ${x - rx * 0.2} ${y - ry * 0.45} ${x - rx * 0.85} ${y - ry * 0.35}Z`, c.g(MOSS, 0.25), 2.2) : '');
    const glow = atk ? 0.95 : 0.55;
    const sh0 = atk ? 'translate(1.5 0)' : '';
    const wall = rock(30, 48, 20, 19, sh(stone, -0.08), true) + rock(70, 46, 22, 21, stone, true)
      + rock(17, 74, 13, 15, sh(stone, -0.12), true) + rock(49, 71, 20, 19, stone, true) + rock(83, 74, 13, 15, sh(stone, -0.05), true)
      + C(49, 74, 12, c.halo('#8dffb0', glow), 0)
      + T('M44 66l5 6-4 6 6 5', '#3a6a2a', 3.4) + T('M44 66l5 6-4 6 6 5', '#8dffb0', 1.6)
      + T('M66 36l4 6-3 6M24 44l5 3', sh(stone, -0.35), 2)
      + flower(26, 32) + flower(76, 28, '#ff9cc0') + flower(85, 61);
    if (!atk) return wall;
    const bits = P('M10 30l5-4 3 5-5 3zM90 22l5-3 2 6-5 1zM50 18l4-4 4 4-4 3z', c.g('#c8c2b4'), 2)
      + C(8, 88, 5, '#e6dcc8', 0, op(0.6)) + C(93, 88, 5, '#e6dcc8', 0, op(0.6)) + C(4, 80, 3, '#e6dcc8', 0, op(0.5))
      + T('M96 44l3-2M97 54h3M4 52l-3-1', '#fff', 2, op(0.8));
    return G(wall, sh0) + bits;
  }

  function unitPlaceholder(c) {
    return stoneLegs(c, '#8a8a96') + C(50, 62, 18, c.r('#a8a8b4'), 3) + golemEyes(52, 58);
  }

  const UNITS = { stone_soldier: stoneSoldier, granite_guard: graniteGuard, obsidian_blade: obsidianBlade, obsidian_blades: obsidianBlade, drone, rock_wall: rockWall };

  RG.art.unit = function unit(kind, pose = 'idle') {
    const c = pad();
    const p = pose === 'attack' ? 'attack' : 'idle';
    let body;
    try {
      body = (UNITS[kind] || unitPlaceholder)(c, p);
    } catch (e) {
      body = unitPlaceholder(c);
    }
    return wrap('0 0 100 100', c, body);
  };
})();
