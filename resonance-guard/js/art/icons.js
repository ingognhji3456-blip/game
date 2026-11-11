'use strict';

/* =========================================================
 * UI 아이콘 — RG.art.icon(name) → SVG 문자열 (viewBox 0 0 64 64)
 * 규격: docs/ARCHITECTURE.md §5, 원소 모양: docs/DESIGN.md §6.1
 *
 * 스타일 약속
 *  - 외곽선 #1c1426, 굵기 3.5(64 기준). 내부 선은 2.5 이상 — 24px에서도 끊기지 않게.
 *  - 위가 밝은 2단 그라데이션 + 왼쪽 위 흰 하이라이트.
 *  - 그림은 상자의 약 80%(대략 6~58)를 채움.
 *  - 모르는 이름은 '?' 동그라미(예외 없음).
 * ========================================================= */
RG.art.icon = (() => {
  let H = null; // RG.art._h (부를 때 잡음 — 불러오는 순서에 기대지 않기)
  let defs = '';
  const OL = '#1c1426';
  const W = 3.5;

  /* ---------- 색 ---------- */
  const K = {
    gold: '#f5ad2a', goldL: '#fff3b0', goldD: '#b87812',
    steel: '#8b9ab5', steelL: '#f1f5fb', steelD: '#55627c',
    cream: '#e3c286', creamL: '#fffaeb',
    red: '#e0334a', redL: '#ffa0ac',
    green: '#43b553', greenL: '#cff9b8',
    blue: '#3a86e0', blueL: '#c6e6ff',
    wood: '#9c5a2a', woodL: '#e2a066',
    bone: '#d4c6a6', boneL: '#fffcf2',
    stone: '#7b7690', stoneL: '#e6e3f0',
    hole: '#2a1d36',
  };
  const E = (k) => (RG.data && RG.data.elements && RG.data.elements[k]) || { color: '#cccccc', dark: '#666666', light: '#eeeeee' };

  /* ---------- 작은 도구 ---------- */
  const n = (v) => Math.round(v * 10) / 10;
  const grad = (top, bot, dir) => {
    const id = H.uid('ic');
    defs += H.lg(id, [[0, top], [1, bot]], dir || 'v');
    return `url(#${id})`;
  };
  const halo = (c, op) => {
    const id = H.uid('ic');
    defs += H.rg(id, [[0, c, op], [0.55, c, op * 0.45], [1, c, 0]], 0.5, 0.5, 0.5);
    return `url(#${id})`;
  };
  const NS = ' stroke="none"';
  const P = (d, fill, x = '') => `<path d="${d}" fill="${fill}"${x}/>`;
  const C = (cx, cy, r, fill, x = '') => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"${x}/>`;
  const R = (x, y, w, h, rx, fill, ex = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}"${ex}/>`;
  /** 외곽선만 다시 그리기 */
  const O = (d, w) => `<path d="${d}" fill="none"${w ? ` stroke-width="${w}"` : ''}/>`;
  /** 안쪽 선(색, 굵기) */
  const sk = (d, c, w) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}"/>`;
  /** 흰 하이라이트 선 */
  const hl = (d, w = 3.5, op = 0.65) => `<path d="${d}" fill="none" stroke="#fff" stroke-width="${w}" opacity="${op}"/>`;
  /** 외곽선 있는 굵은 선(여러 갈래를 한 path로 주면 하나로 합쳐 보임) */
  const bold = (d, c, w = 5) => `<path d="${d}" fill="none" stroke-width="${w + 2 * W}"/><path d="${d}" fill="none" stroke="${c}" stroke-width="${w}"/>`;
  /** 겹친 도형을 한 덩어리 외곽선으로: 밑그림 */
  const under = (d) => `<path d="${d}" fill="${OL}" stroke-width="${2 * W}"/>`;

  /** (32,32) 기준 크기 바꾸기 + 옮기기 (절대 좌표 M L C Q H V Z 만) */
  function xf(d, s, dx = 0, dy = 0) {
    let cmd = '';
    let i = 0;
    return d.replace(/([MLCQHVZ])|(-?\d*\.?\d+)/g, (m, c, num) => {
      if (c) { cmd = c; i = 0; return c; }
      const v = parseFloat(num);
      const isX = cmd === 'H' ? true : cmd === 'V' ? false : i % 2 === 0;
      i += 1;
      return ` ${n(32 + (v - 32) * s + (isX ? dx : dy))}`;
    });
  }
  /** 시계 방향 원호 경로 (각도: 0=오른쪽, 90=아래) */
  function arc(cx, cy, r, a0, a1) {
    const T = Math.PI / 180;
    const p = (a) => `${n(cx + Math.cos(a * T) * r)} ${n(cy + Math.sin(a * T) * r)}`;
    return `M${p(a0)}A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${p(a1)}`;
  }
  /** 원 전체 경로 (한 바퀴 원호는 시작·끝이 같아 사라지므로 반원 둘로) */
  const circ = (cx, cy, r) => `M${cx + r} ${cy}A${r} ${r} 0 1 1 ${cx - r} ${cy}A${r} ${r} 0 1 1 ${cx + r} ${cy}Z`;
  /** 톱니/별 모양: 반지름 목록을 돌아가며 */
  function burst(cx, cy, rs, cnt, rot = -90) {
    let d = '';
    for (let i = 0; i < cnt; i++) {
      const a = ((rot + (i * 360) / cnt) * Math.PI) / 180;
      const r = rs[i % rs.length];
      d += `${i ? 'L' : 'M'}${n(cx + Math.cos(a) * r)} ${n(cy + Math.sin(a) * r)}`;
    }
    return `${d}Z`;
  }
  /** 화살촉 달린 원호 띠 (a0→a1 시계 방향) */
  function arcArrow(cx, cy, r, a0, a1, c, w) {
    const T = Math.PI / 180;
    const p = (a, rr) => `${n(cx + Math.cos(a * T) * rr)} ${n(cy + Math.sin(a * T) * rr)}`;
    const hw = w * 1.4;
    const aB = a1 - (w * 1.8) / r / T;
    const band = arc(cx, cy, r, a0, aB + 2);
    const head = `M${p(aB, r - hw)}L${p(a1, r)}L${p(aB, r + hw)}Z`;
    return `<path d="${band}" fill="none" stroke-width="${w + 2 * W}"/>${under(head)}`
      + `<path d="${band}" fill="none" stroke="${c}" stroke-width="${w}"/>${P(head, c, NS)}`;
  }

  /* ---------- 자주 쓰는 모양 ---------- */
  const HEART = 'M32 56C20 48 6 38 6 24C6 14 13 8 21 8C26 8 30 11 32 15C34 11 38 8 43 8C51 8 58 14 58 24C58 38 44 48 32 56Z';
  const SHIELD = 'M32 6L52 12C53 30 49 46 32 58C15 46 11 30 12 12Z';
  const ARMOR = 'M12 17L24 9Q32 16 40 9L52 17L51 28Q46 31 47 44Q41 55 32 58Q23 55 17 44Q18 31 13 28Z';
  const SKULL = 'M32 6C46 6 54 16 54 28C54 36 50 40 46 42V50C46 54 42 58 38 58H26C22 58 18 54 18 50V42C14 40 10 36 10 28C10 16 18 6 32 6Z';
  const SPEAKER = 'M6 23H17L32 10V54L17 41H6Z';
  const STAR5 = () => H.starPath(32, 34, 28, 13);

  const heart = (s, dy, top, bot) => P(xf(HEART, s, 0, dy), grad(top || K.redL, bot || K.red));
  const shield = (s, dx, dy) => {
    const d = xf(SHIELD, s, dx, dy);
    return P(d, grad(K.blueL, K.blue), NS)
      + P(xf('M32 6L52 12C53 30 49 46 32 58Z', s, dx, dy), '#123f80', ' opacity=".22" stroke="none"')
      + sk(xf('M32 13L46 17C46 30 43 40 32 49C21 40 18 30 18 17Z', s, dx, dy), '#eaf5ff', 2.5)
      + O(d);
  };
  const coin = (cx, cy, r) => {
    const k = r / 25;
    return C(cx, cy, r, grad(K.goldL, K.gold))
      + C(cx, cy, n(r * 0.7), 'none', ` stroke="${K.goldD}" stroke-width="2.5"`)
      + P(`M${cx} ${n(cy - 9 * k)}L${n(cx + 7 * k)} ${cy}L${cx} ${n(cy + 9 * k)}L${n(cx - 7 * k)} ${cy}Z`, '#fff6c8', ` stroke="${K.goldD}" stroke-width="2.5"`)
      + hl(arc(cx, cy, n(r * 0.84), 195, 250));
  };
  const skull = (s, dy, teeth) => {
    const q = (x, y) => [n(32 + (x - 32) * s), n(32 + (y - 32) * s + dy)];
    const [x1, ey] = q(23, 29);
    const [x2] = q(41, 29);
    return P(xf(SKULL, s, 0, dy), grad(K.boneL, K.bone))
      + C(x1, ey, n(6.5 * s), K.hole, NS) + C(x2, ey, n(6.5 * s), K.hole, NS)
      + P(xf('M32 37L35.5 43H28.5Z', s, 0, dy), K.hole, NS)
      + (teeth ? O(xf('M27 50V56M32 50V56M37 50V56', s, 0, dy), 2.5) : '');
  };
  const cream = () => grad(K.creamL, K.cream);
  const SLASH = (c = '#ff4d4d') => bold('M12 12L52 52', c, 5);

  /* ---------- 아이콘 ---------- */
  const D = {
    /* ===== 원소 (색 + 모양) ===== */
    fire() {
      const c = E('fire').color;
      return P('M33 5C35 16 49 22 49 39C49 50 41 58 32 58C22 58 15 51 15 40C15 32 19 26 23 21C23 28 26 31 29 32C27 23 28 13 33 5Z', grad(H.shade(c, 0.35), H.shade(c, -0.1)))
        + P('M32 30C36 37 42 41 42 47C42 53 37 56 32 56C27 56 22 53 22 47C22 41 28 37 32 30Z', grad('#fff7c0', '#ffc23a'), NS)
        + hl('M20 38C19 43 21 48 24 50');
    },
    frost() {
      const e = E('frost');
      const d = 'M32 5L48 17V47L32 59L16 47V17Z';
      return P(d, grad(e.light, e.color), NS)
        + P('M38 15L48 17V47L38 49Z', e.dark, ' opacity=".4" stroke="none"')
        + P('M32 5L26 15V49L32 59L38 49V15Z', '#fff', ` fill-opacity=".4" stroke="${e.dark}" stroke-width="2.5"`)
        + hl('M21 21V38') + O(d);
    },
    storm() {
      const e = E('storm');
      return P('M37 4L15 36H29L23 60L49 27H35L42 4Z', grad(e.light, H.shade(e.color, -0.1)))
        + hl('M35 9L22 31');
    },
    earth() {
      const e = E('earth');
      const d = 'M5 55L25 11L35 29L42 20L59 55Z';
      return P(d, grad(e.light, H.shade(e.color, -0.15)), NS)
        + P('M25 11L35 29L42 20L59 55H33L30 30Z', e.dark, ' opacity=".3" stroke="none"')
        + P('M25 11L30.5 21L27 19.5L24.5 23L22 19.5L20 22Z', '#fbfdff', ' stroke-width="2.5"')
        + O(d);
    },
    light() {
      const e = E('light');
      return C(32, 32, 31, halo('#fff1a0', 0.8), NS)
        + P(burst(32, 32, [28, 10, 17, 10], 16), grad('#fffdf0', H.shade(e.color, -0.12)))
        + C(32, 32, 5.5, '#fff', NS);
    },
    dark() {
      const e = E('dark');
      return P('M29 8A25 25 0 1 0 54.3 39A20 20 0 1 1 29 8Z', grad(e.light, H.shade(e.color, -0.1)))
        + hl('M13.6 21.5A20 20 0 0 0 11.2 39.8');
    },

    /* ===== 적 특성 ===== */
    flying() {
      const d = 'M8 46C10 28 30 10 58 8C56 15 52 19 47 21C51 23 50 28 43 30C47 33 44 37 37 38C40 42 36 46 29 46C31 51 25 55 17 54C11 53 7 51 8 46Z';
      return P(d, grad('#ffffff', '#a9bddf'))
        + sk('M14 45C22 34 32 26 47 21M22 47C30 42 36 37 43 30', '#7d92b8', 2.5) + O(d);
    },
    armor() {
      return P(ARMOR, grad(K.steelL, K.steel), NS)
        + sk('M32 15V55M18 31Q25 36 32 33Q39 36 46 31', K.steelD, 2.5)
        + sk('M25 12.5Q32 19 39 12.5', K.gold, 3)
        + hl('M18 22Q20 29 20 37') + O(ARMOR);
    },
    regen() {
      return heart(0.52, 4) + hl(xf('M14 22C14 16 18 13 22 13', 0.52, 0, 4), 3)
        + arcArrow(32, 33, 24, 150, 388, K.green, 6);
    },
    split() {
      const g = grad('#d2fff0', '#36b88e');
      return P('M28 13A21 21 0 0 0 28 55L25 49L31 42L25 35L31 28L24 21Z', g)
        + P('M36 13A21 21 0 0 1 36 55L33 49L39 42L33 35L39 28L32 21Z', g)
        + C(18, 31, 3, K.hole, NS) + C(46, 31, 3, K.hole, NS)
        + hl('M14 24C12 29 12 35 14 40');
    },
    stealth() {
      const d = 'M32 6C46 6 54 19 54 33C54 43 57 51 60 58H4C7 51 10 43 10 33C10 19 18 6 32 6Z';
      return P(d, grad('#b3aed0', '#56507a'))
        + P('M32 18C41 18 45 27 45 36C45 44 39 49 32 49C25 49 19 44 19 36C19 27 23 18 32 18Z', K.hole)
        + P('M21 35Q26 30 30 35Q26 38 21 35ZM34 35Q38 30 43 35Q38 38 34 35Z', '#ffe45a', NS)
        + hl('M16 24C14 30 14 36 15 42');
    },
    shield() {
      return shield(1, 0, 0) + hl('M18 17C18 28 20 36 24 43');
    },
    shielder() {
      return shield(0.74, -6, 4)
        + C(46, 17, 11, grad(K.goldL, K.gold))
        + P('M43.5 10H48.5V14.5H53V19.5H48.5V24H43.5V19.5H39V14.5H43.5Z', '#fff', ' stroke-width="2.5"');
    },
    healer() {
      const d = 'M24 7H40V24H57V40H40V57H24V40H7V24H24Z';
      return P(d, grad(K.greenL, K.green)) + hl('M28 12V28H12', 3.5, 0.6)
        + P('M51 4Q52 11 59 12Q52 13 51 20Q50 13 43 12Q50 11 51 4Z', '#fff', ' stroke-width="2.5"');
    },
    burrow() {
      return P('M5 57C8 42 19 35 32 35C45 35 56 42 59 57Z', grad('#dca36a', '#8a5428'))
        + `<ellipse cx="32" cy="47" rx="12" ry="5.5" fill="${K.hole}"/>`
        + C(13, 52, 3, '#f2cc94', ' stroke-width="2.5"') + C(51, 51, 2.8, '#f2cc94', ' stroke-width="2.5"')
        + P('M26 5H38V24H47L32 45L17 24H26Z', cream())
        + hl('M30 9V24', 3);
    },
    dash() {
      const d = 'M23 7H41V33C47 35 57 37 58 46V53H21V45L23 33Z';
      return bold('M4 21H15M2 32H14M6 43H16', K.creamL, 4)
        + P(d, grad(K.woodL, K.wood), NS)
        + P('M23 7H41V15H23Z', '#6e3a18', NS) + P('M21 47H58V53H21Z', '#4a2812', NS)
        + hl('M27 19V32', 3) + O(d) + O('M23 15H41M21 47H58', 2.5);
    },
    undying() {
      const d = 'M15 58V29C15 17 22 10 32 10C42 10 49 17 49 29V58Z';
      return P(d, grad(K.stoneL, K.stone))
        + P('M32 16L43 28H37V44H27V28H21Z', grad('#d8ffd0', '#3fcf6a'), ' stroke-width="2.5"')
        + P('M7 58C11 52 21 50 32 50C43 50 53 52 57 58Z', grad('#a6e66e', '#4f962e'))
        + hl('M20 26C20 21 23 17 27 15', 3);
    },
    deathburst() {
      return P(burst(32, 32, [30, 20], 24), grad('#ffd36a', '#e8432a'))
        + skull(0.6, 1, false);
    },
    ranged() {
      return `<g transform="rotate(-45 32 32)">${bold('M24 4Q52 32 24 60', K.woodL, 5)}`
        + O('M24 4L15 32L24 60', 3)
        + bold('M11 32H50', '#f0e0c0', 3.5)
        + P('M60 32L48 24.5V39.5Z', grad(K.steelL, K.steel))
        + P('M8 32L4 26H13L18 32L13 38H4Z', K.red, ' stroke-width="2.5"')
        + '</g>';
    },
    shock() {
      const t = 'M8 14H16V20H22V14H30V20H36V14H44V28H40V58H12V28H8Z';
      return P(t, grad(K.stoneL, K.stone), NS) + R(23.5, 34, 5, 11, 2.5, K.hole, NS) + O(t) + O('M8 28H44', 2.5)
        + P('M46 3L31 31H41L33 61L59 24H48L55 3Z', grad('#fff6a0', '#ffb81a'))
        + bold('M5 38L10 41M6 49L11 47', '#ffe45a', 3);
    },
    silence() {
      const d = 'M32 9C23 9 18 17 18 28V37C18 42 13 44 12 49H52C51 44 46 42 46 37V28C46 17 41 9 32 9Z';
      return C(32, 8, 4, 'none') + C(32, 53, 5.5, '#c98a22')
        + P(d, grad('#ffe8a0', '#c98a22')) + hl('M23 22C23 18 25 15 28 14', 3)
        + SLASH();
    },
    adaptive() {
      // 적응: 맞은 원소 쪽으로 바뀌는 방패 (반은 불, 반은 얼음 + 돌고 도는 화살)
      const sh = xf(SHIELD, 0.6, 0, 1);
      const cut = H.uid('ic');
      defs += `<clipPath id="${cut}"><rect x="32" y="0" width="32" height="64"/></clipPath>`;
      return arcArrow(32, 32, 25, 196, 336, E('fire').color, 4.5)
        + arcArrow(32, 32, 25, 16, 156, E('frost').color, 4.5)
        + P(sh, grad(E('fire').light, E('fire').color))
        + `<g clip-path="url(#${cut})">${P(sh, grad(E('frost').light, E('frost').color), NS)}</g>`
        + O(sh) + sk('M32 18V48', OL, 2.5)
        + hl('M24 23C24 21 25 20 27 19', 3);
    },
    dampen() {
      const link = (x, c) => `<rect x="-11" y="-6.5" width="22" height="13" rx="6.5" fill="none" transform="translate(${x} ${x}) rotate(45)"${c}/>`;
      return link(18, ' stroke-width="12"') + link(46, ' stroke-width="12"')
        + link(18, ' stroke="#7fe6d6" stroke-width="5"') + link(46, ' stroke="#7fe6d6" stroke-width="5"')
        + bold('M37 27L42 22M27 37L22 42', '#ffe066', 3.5);
    },
    unstoppable() {
      const st = grad(K.stoneL, K.stone);
      return P('M22 4H42V18L38 21L34 17L30 21L26 17L22 19Z', st) + P('M22 60H42V46L38 43L34 47L30 43L26 47L22 45Z', st)
        + sk('M22 11H42M32 4V11M22 53H42M32 53V60', '#5d5872', 2.5)
        + P('M48 5L54 4L55 10L49 11ZM48 53L54 54L53 60L47 59Z', K.stoneL, ' stroke-width="2.5"')
        + P('M3 25H40V14L61 32L40 50V39H3Z', grad('#ffc07a', '#e8502a'))
        + hl('M7 29H40V21', 3);
    },

    /* 6지역 특성: 푹신(구름 털이 폭발을 흡수) · 위상 이동(일렁이며 앞으로 순간이동) */
    fluffy() {
      const w = grad('#ffffff', '#c8c0ec');
      return P('M10 46C4 46 4 36 11 35C9 26 19 21 25 26C28 16 42 16 44 26C51 22 59 29 55 36C61 39 58 48 52 48H12Z', w)
        + hl('M14 33C16 28 21 27 24 29', 3)
        + P('M30 40L33 32L36 40L44 41L37 45L39 53L33 48L27 53L29 45L22 41Z', grad('#ffd27a', '#e8762a'))
        + O('M40 8L44 14M50 12L46 17M30 6V12', 3);
    },
    phase() {
      const g1 = grad('#efe8ff', '#8a6ae8');
      return P('M8 40C8 28 16 20 24 20C32 20 36 28 34 38C33 46 30 52 26 56C24 50 20 50 16 56C12 52 8 48 8 40Z', grad('#ffffff', '#b8a8f0'), ' opacity=".45"')
        + P('M26 34C26 22 34 14 42 14C50 14 54 22 52 32C51 40 48 46 44 50C42 44 38 44 34 50C30 46 26 42 26 34Z', g1)
        + C(38, 28, 2.6, OL) + C(46, 27, 2.4, OL)
        + O('M8 14H18M4 22H14M10 30H16', 3)
        + P('M54 40L62 46L54 52Z', grad('#ffe7a8', '#e8a83a'));
    },

    /* ===== 상태 이상 ===== */
    slow() {
      return P('M6 53C4 47 8 40 14 40C19 40 21 44 23 46H51C56 46 59 50 58 54H8Z', grad('#ffe9c0', '#d9a560'))
        + bold('M12 41L8 28M17 41L19 28', '#e8c27e', 3) + C(8, 27, 3.5, '#ffe9c0') + C(19, 27, 3.5, '#ffe9c0')
        + C(39, 31, 16, grad('#bfe8ff', '#3c96d8'))
        + O('M40 31A2 2 0 0 1 36 31A4 4 0 0 1 44 31A6 6 0 0 1 32 31A8 8 0 0 1 48 31', 3)
        + hl('M28 22C30 19 33 18 36 18', 3);
    },
    freeze() {
      const sil = 'M10 24L22 10H56V42L44 56H10Z';
      return P('M10 24H44V56H10Z', grad('#e8f9ff', '#7ccdf0'), NS)
        + P('M10 24L22 10H56L44 24Z', '#f6fdff', NS)
        + P('M44 24L56 10V42L44 56Z', '#3f9fd2', NS)
        + hl('M16 37L24 29', 3.5, 0.9) + hl('M17 48L31 34', 3.5, 0.7)
        + O(sil) + O('M10 24H44V56M44 24L56 10', 2.5);
    },
    stun() {
      const g = grad('#fff6b0', '#ffbe1a');
      return bold('M7 37A25 10 0 1 0 57 37A25 10 0 1 0 7 37', '#fff3b8', 4)
        + P(H.starPath(11, 34, 9.5, 4.4), g) + P(H.starPath(53, 32, 10, 4.6), g)
        + P(H.starPath(32, 46, 13, 6), g);
    },
    root() {
      const b = 'M18 5H36V31C42 33 52 35 53 44V51H16V43L18 31Z';
      return P(b, grad(K.woodL, K.wood), NS) + P('M18 5H36V12H18Z', '#6e3a18', NS) + O(b) + O('M18 12H36', 2.5)
        + P('M4 58C8 51 18 48 32 48C46 48 56 51 60 58Z', grad('#c88a52', '#7a4a22'))
        + bold('M9 55C6 45 9 34 16 30L39 23M14 55C13 49 14 43 18 41L39 35', '#6fc23e', 4)
        + P('M39 23Q45 14 54 14Q50 23 39 23ZM39 35Q46 29 55 31Q49 38 39 35Z', '#a6ec6e', ' stroke-width="2.5"');
    },
    burn() {
      return P('M10 9L13 13L10 17L7 13ZM55 6L58 10L55 14L52 10Z', '#ffd25a', ' stroke-width="2.5"')
        + P('M32 9C37 18 46 22 44 34C47 31 48 28 50 25C56 33 58 43 53 50C49 56 41 58 32 58C23 58 15 56 11 50C6 43 8 33 14 25C16 28 17 31 20 34C18 22 27 18 32 9Z', grad('#ff8a5a', '#c62a1e'))
        + P('M32 30C36 37 41 41 40 47C40 52 36 55 32 55C28 55 24 52 24 47C23 41 28 37 32 30Z', grad('#fff7c0', '#ffc23a'), NS)
        + hl('M14 36C13 41 14 46 17 49', 3);
    },
    bleed() {
      const g = grad('#ff8a9c', '#b8183c');
      return P('M26 7C30 18 42 28 42 40C42 50 35 57 26 57C17 57 10 50 10 40C10 28 22 18 26 7Z', g)
        + P('M48 25C50 31 56 35 56 42C56 47 52 51 48 51C44 51 40 47 40 42C40 35 46 31 48 25Z', g)
        + hl('M16 38C16 44 18 48 22 50');
    },
    curse() {
      const d = 'M32 6C45 6 52 16 52 29V55C49 52 46 51 44 54C42 57 39 57 37 54C35 51 29 51 27 54C25 57 22 57 20 54C18 51 15 52 12 55V29C12 16 19 6 32 6Z';
      return P(d, grad('#f3b8ff', '#9a3fc8'))
        + P('M19 24L29 28V32C27 35 21 35 19 31ZM45 24L35 28V32C37 35 43 35 45 31Z', K.hole, NS)
        + `<ellipse cx="32" cy="43" rx="4" ry="4.5" fill="${K.hole}"/>`
        + hl('M18 22C19 16 23 12 28 11', 3);
    },
    shred() {
      const g = grad(K.steelL, K.steel);
      const zz = 'L35 47L29 39L35 30L29 22Z';
      return `<g transform="translate(-3 1) rotate(-8 32 58)">${P(`M32 12.5Q28 12.5 24 9L12 17L13 28Q18 31 17 44Q23 55 32 58${zz}`, g)}${hl('M18 22Q20 29 20 37')}</g>`
        + `<g transform="translate(3 1) rotate(8 32 58)">${P(`M32 12.5Q36 12.5 40 9L52 17L51 28Q46 31 47 44Q41 55 32 58${zz}`, g)}${sk('M39 33Q43 33 46 31', K.steelD, 2.5)}</g>`;
    },
    stillness() {
      const g = grad('#d6ffe0', '#3fb878');
      return `<g transform="translate(-3 1) rotate(-6 32 56)">${P('M32 56C20 48 6 38 6 24C6 14 13 8 21 8C26 8 30 11 32 15L28 25L35 33L29 43Z', g)}</g>`
        + `<g transform="translate(3 1) rotate(6 32 56)">${P('M32 15C34 11 38 8 43 8C51 8 58 14 58 24C58 38 44 48 32 56L29 43L35 33L28 25Z', g)}</g>`
        + hl('M10 22C10 17 13 14 17 13', 3);
    },
    blind() {
      return P('M5 32C15 17 49 17 59 32C49 47 15 47 5 32Z', grad('#ffffff', '#d9d3e6'))
        + C(32, 32, 10, grad('#ffe28a', '#d0901a')) + C(32, 32, 4.5, OL, NS) + C(28.5, 28.5, 2, '#fff', NS)
        + SLASH();
    },
    lift() {
      const sb = E('storm');
      return P('M8 12C8 6 56 6 56 12C56 17 50 19 48 20C51 22 50 27 44 29C46 31 44 36 38 38C40 41 37 45 33 46C35 50 33 55 30 58C30 54 27 50 26 46C22 44 20 40 22 37C17 35 15 31 18 28C12 26 10 22 14 19C10 17 8 15 8 12Z', grad('#f4f2ff', sb.color))
        + sk('M14 19C24 23 40 23 48 20M18 28C26 31 38 31 44 29M22 37C28 39 34 39 38 38', OL, 2.5)
        + hl('M14 11C20 9 30 9 36 10', 3);
    },
    veil() {
      return P('M12 12H52V42L48 50L44 42L40 55L36 42L32 50L28 42L24 55L20 42L16 50L12 42Z', grad('#eefaff', '#6fbde8'))
        + sk('M22 15V39M32 15V39M42 15V39', '#4c9fd0', 2.5)
        + bold('M8 11H56', '#d7e2f0', 4) + C(7, 11, 4, '#d7e2f0') + C(57, 11, 4, '#d7e2f0');
    },

    /* ===== 능력치 · HUD ===== */
    gold() { return coin(32, 32, 25); },
    lives() {
      return C(32, 35, 31, halo('#ffd86a', 0.75), NS)
        + O('M26 13C26 5 38 5 38 13', 3.5)
        + R(21, 19, 22, 28, 4, grad('#fffbe0', '#ffb43c'))
        + P('M32 25C35 30 37 33 37 37C37 40 35 42 32 42C29 42 27 40 27 37C27 33 29 30 32 25Z', '#ff7a1f', NS)
        + C(32, 37.5, 2.5, '#fff6c8', NS)
        + P('M19 20L25 12H39L45 20Z', grad('#e0a45c', '#8a5226'))
        + P('M19 46H45L48 54H16Z', grad('#e0a45c', '#8a5226'))
        + hl('M25 24V40', 3, 0.8);
    },
    wave() {
      return P('M18 11C30 6 40 16 56 11L48 24L56 37C40 42 30 32 18 37Z', grad('#ff9a85', '#d23038'))
        + hl('M22 15C30 12 37 16 44 16', 3)
        + R(11, 8, 7, 51, 2.5, grad(K.woodL, K.wood)) + C(14.5, 7, 4.5, grad(K.goldL, K.gold));
    },
    damage() {
      return '<g transform="rotate(45 32 32)">'
        + P('M32 2L38 9V41H26V9Z', grad(K.steelL, K.steel, 'h')) + sk('M32 10V37', K.steelD, 2.5)
        + R(29, 46, 6, 11, 1.5, K.wood) + R(16, 40, 32, 7, 3, grad(K.goldL, K.gold))
        + C(32, 59.5, 4.5, grad(K.goldL, K.gold)) + '</g>';
    },
    range() {
      return C(32, 32, 26, grad('#e2f4ff', '#82c4f0'))
        + C(32, 32, 16, 'none', ' stroke="#3d86c8" stroke-width="3"')
        + bold('M32 32H46', K.creamL, 3) + P('M56 32L46 26V38Z', K.creamL)
        + C(32, 32, 6.5, grad(K.goldL, K.gold));
    },
    speed() {
      const gl = 'M17 12H47C47 24 36 28 36 32C36 36 47 40 47 52H17C17 40 28 36 28 32C28 28 17 24 17 12Z';
      const sand = '#ffc94a';
      return P(gl, grad('#f6fcff', '#b4d6ee'), NS)
        + P('M23 21H41C39 25 35 27 32 30C29 27 25 25 23 21Z', sand, NS)
        + P('M20 50C22 43 27 40 32 40C37 40 42 43 44 50Z', sand, NS) + sk('M32 30V41', sand, 2.5)
        + hl('M21 15C21 20 23 23 26 25', 3) + O(gl)
        + R(11, 5, 42, 8, 3, grad(K.woodL, K.wood)) + R(11, 51, 42, 8, 3, grad(K.woodL, K.wood));
    },
    hp() { return heart(1, 0) + hl('M13 22C13 16 17 13 21 13'); },
    star() { return P(STAR5(), grad('#fff3a8', '#f2a81e')) + hl('M24 27L29 22', 3); },
    star_empty() {
      return P(STAR5(), grad('#77708e', '#46405a'))
        + sk(H.starPath(32, 34, 19, 8.8), '#9790b0', 2.5);
    },
    lock() {
      return bold('M21 30V20C21 9 43 9 43 20V30', K.steelL, 5)
        + R(11, 28, 42, 30, 6, grad(K.goldL, K.gold))
        + P('M32 36A5 5 0 0 1 35 45L37 51H27L29 45A5 5 0 0 1 32 36Z', K.hole, NS)
        + hl('M16 34V50', 3);
    },
    skull() { return skull(1, 0, true) + hl('M16 22C17 16 21 12 26 11'); },
    /** 공명석(뽑기 재화): 여섯 원소 빛이 도는 보라 수정 */
    crystal() {
      const g = grad('#f2d8ff', '#7a4ad8');
      return P('M32 4L50 20L44 54L32 62L20 54L14 20Z', g)
        + P('M32 4L50 20L32 26Z', '#fff1ff', ' stroke-width="2"') + P('M32 4L14 20L32 26Z', '#d4b0ff', ' stroke-width="2"')
        + P('M14 20L32 26L20 54Z', '#9a6ae8', ' stroke-width="2"') + P('M50 20L32 26L44 54Z', '#6a3ac0', ' stroke-width="2"')
        + P('M32 26L20 54L32 62L44 54Z', '#5a2aa8', ' stroke-width="2"')
        + C(26, 16, 2.4, '#ffffff', ' stroke="none"') + hl('M22 22L28 40', 2.6, 0.55);
    },
    crown() {
      const g = grad(K.goldL, K.gold);
      return P('M8 18L20 33L32 10L44 33L56 18L51 54H13Z', g)
        + P('M12 42H52L51 54H13Z', '#e09a1c')
        + C(8, 18, 4, g) + C(32, 10, 4, g) + C(56, 18, 4, g)
        + C(32, 48, 3.5, '#ff4d6a', ' stroke-width="2.5"')
        + hl('M15 27L18 38', 3);
    },

    /* ===== 버튼 ===== */
    play() { return P('M21 9L54 32L21 55Z', cream()) + hl('M26 18V44', 3); },
    pause() { const g = cream(); return R(14, 9, 13, 46, 3, g) + R(37, 9, 13, 46, 3, g) + hl('M19 14V40', 3); },
    fast() { const g = cream(); return P('M7 12L31 32L7 52Z', g) + P('M32 12L56 32L32 52Z', g); },
    settings() {
      let d = '';
      for (let i = 0; i < 8; i++) {
        const a = i * 45 - 90;
        const T = Math.PI / 180;
        [[21, -17], [28, -9.5], [28, 9.5], [21, 17]].forEach(([r, o], j) => {
          d += `${i === 0 && j === 0 ? 'M' : 'L'}${n(32 + Math.cos((a + o) * T) * r)} ${n(32 + Math.sin((a + o) * T) * r)}`;
        });
      }
      d += 'ZM41 32A9 9 0 1 0 23 32A9 9 0 1 0 41 32Z';
      return P(d, cream(), ' fill-rule="evenodd"') + hl(arc(32, 32, 16.5, 200, 250), 3);
    },
    sound() {
      return P(SPEAKER, cream())
        + bold(`${arc(32, 32, 10, -42, 42)}${arc(32, 32, 19, -42, 42)}`, K.creamL, 4.5);
    },
    mute() {
      return P(SPEAKER, cream()) + bold('M40 24L54 40M54 24L40 40', '#ff5a5a', 4.5);
    },
    sell() {
      return coin(26, 38, 20)
        + `<g transform="translate(48 15) rotate(135)">${P('M-12 -5H2V-12L14 0L2 12V5H-12Z', cream())}</g>`;
    },
    upgrade() { return P('M32 5L57 30H43V58H21V30H7Z', grad('#c8f8a0', '#3aa64a')) + hl('M26 33V52', 3); },
    target() {
      return bold(`M32 4V20M32 44V60M4 32H20M44 32H60${circ(32, 32, 17)}`, '#ff6a4f', 5)
        + C(32, 32, 4.5, '#ff6a4f');
    },
    hero() {
      const d = 'M14 50V32C14 18 22 10 32 10C42 10 50 18 50 32V50C50 54 46 57 42 57H22C18 57 14 54 14 50Z';
      return P('M28 13C27 5 38 1 53 4C48 6 45 10 43 15Z', grad('#ff8a7a', '#c8283a'))
        + P(d, grad(K.steelL, K.steel))
        + R(18, 29, 28, 7, 3.5, K.hole, NS) + R(29.5, 34, 5, 18, 2.5, K.hole, NS)
        + sk('M15 46H49', K.gold, 3)
        + hl('M19 27C19 21 22 17 26 15', 3);
    },
    skill() {
      const g = grad('#f0fffb', '#22c4b6');
      return P('M28 8Q31 31 54 34Q31 37 28 60Q25 37 2 34Q25 31 28 8Z', g)
        + P('M50 4Q51 12 59 13Q51 14 50 22Q49 14 41 13Q49 12 50 4Z', g, ' stroke-width="3"')
        + C(28, 34, 4, '#fff', NS);
    },
    back() { return P('M5 32L27 10V22H57V42H27V54Z', cream()) + hl('M27 27H50', 3); },
    close() {
      return P('M10 18L18 10L32 24L46 10L54 18L40 32L54 46L46 54L32 40L18 54L10 46L24 32Z', grad('#ffa494', '#d63a36'))
        + hl('M15 18L19 14', 3);
    },
    map() {
      const d = 'M6 14L22 8L42 14L58 8V50L42 56L22 50L6 56Z';
      return P(d, grad('#fff3d2', '#e0b874'), NS)
        + P('M22 8L42 14V56L22 50Z', '#8a5a2a', ' opacity=".22" stroke="none"')
        + `<path d="M12 45C18 38 26 44 34 32" fill="none" stroke="#a8502a" stroke-width="3.5" stroke-dasharray=".1 6.5"/>`
        + bold('M43 23L51 31M51 23L43 31', '#e8384a', 3.5)
        + O(d) + O('M22 8V50M42 14V56', 2.5);
    },
    book() {
      return R(16, 12, 38, 46, 3, '#fff4dc') + sk('M51 16V54M20 55H50', '#c8b48a', 2.5)
        + R(10, 6, 38, 46, 4, grad('#e0784e', '#8e3a22'))
        + R(10, 6, 8, 46, 3, '#5e2412', ' opacity=".45" stroke="none"')
        + P('M33 17L41 29L33 41L25 29Z', grad(K.goldL, K.gold), ' stroke-width="2.5"')
        + hl('M22 11H43', 3);
    },
    tree() {
      const g = grad(K.goldL, K.gold);
      const can = circ(19, 30, 12) + circ(45, 30, 12) + circ(32, 20, 15) + circ(32, 33, 12);
      return P('M23 58C28 56 29 50 29 40H35C35 50 36 56 41 58Z', grad(K.woodL, K.wood))
        + under(can) + P(can, grad('#bff28e', '#3c9a3c'), NS)
        + sk('M32 44V17M32 38L20 29M32 36L44 29', '#4f3418', 3)
        + C(20, 28, 5, g, ' stroke-width="2.5"') + C(44, 28, 5, g, ' stroke-width="2.5"') + C(32, 16, 5, g, ' stroke-width="2.5"')
        + hl('M14 26C14 21 17 17 21 16', 3);
    },
    retry() { return arcArrow(32, 33, 19, 60, 330, cream(), 7); },

    /* 모르는 이름 */
    _unknown() {
      return C(32, 32, 25, grad('#d2cfdc', '#7e7a90'))
        + bold('M24.5 25C24.5 16 39.5 15.5 39.5 24C39.5 30 32 30 32 37', '#fff', 5)
        + C(32, 46, 3.5, OL, ' stroke-width="7"') + C(32, 46, 3.5, '#fff', NS);
    },
  };

  return function icon(name) {
    H = RG.art._h;
    defs = '';
    const key = typeof name === 'string' && Object.prototype.hasOwnProperty.call(D, name) ? name : '_unknown';
    let body;
    try {
      body = D[key]();
    } catch (e) {
      defs = '';
      body = D._unknown();
    }
    return H.svg('0 0 64 64', defs,
      `<g stroke="${OL}" stroke-width="${W}" stroke-linejoin="round" stroke-linecap="round">${body}</g>`,
      'width="64" height="64"');
  };
})();
