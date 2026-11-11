'use strict';

/* =========================================================
 * 탑 그림 (SVG 문자열) — 24종 × (Lv1, Lv2, Lv3, Lv4 A, Lv4 B) + 울림등 (2차 6종은 js/art/tower-<id>.js)
 * 규격: docs/ARCHITECTURE.md §5, 외형: docs/design/towers.md
 *
 * - viewBox 0 0 100 130, 바닥 중심(기준점) (50,112).
 * - 각 탑은 "틀 좌표"(Lv4 크기 = 칸 너비 100%)로 그린 뒤, 단계 비율
 *   (Lv1 0.7 · Lv2 0.8 · Lv3 0.9 · Lv4 1.0)로 기준점을 중심으로 줄입니다.
 *   외곽선 굵기는 줄어든 뒤에도 같도록 보정합니다.
 * - 받침 윗면 중심: Lv1~3은 y=104, Lv4는 y=99 (틀 좌표).
 * ========================================================= */
(() => {
  const OL = '#1c1426';
  const SC = { 1: 0.7, 2: 0.8, 3: 0.9, A: 1, B: 1 };
  const VKEYS = [1, 2, 3, 'A', 'B'];
  const f = (v) => Math.round(v * 10) / 10;

  /* 재질 색 */
  const M = {
    wood: '#a8703e', woodD: '#74482a', plank: '#b98450',
    rough: '#8f857a', iron: '#5c6370', ironL: '#8a93a0',
    bronze: '#c9853f', gold: '#f2c14e', silver: '#c9d4de', skin: '#f3c99d',
    rope: '#d9b98a', sand: '#d8c08a',
  };
  /* 원소별 다듬은 돌 색 */
  const STONE = {
    fire: '#a8968a', frost: '#a3b4c4', storm: '#9896ae', earth: '#a1a184', light: '#e6dfcf', dark: '#5f5170',
  };
  const ELEM = {
    ember_archer: 'fire', flame_mortar: 'fire', forge: 'fire',
    frost_crystal: 'frost', ice_ballista: 'frost', winter_bell: 'frost',
    lightning_rod: 'storm', gale_cannon: 'storm', dynamo: 'storm',
    stone_barracks: 'earth', quake_hammer: 'earth', crystal_mine: 'earth',
    sun_lens: 'light', sanctuary: 'light', radiance_spire: 'light',
    hex_spire: 'dark', void_orb: 'dark', shadow_snare: 'dark',
    // 2차 6종 (2026-11-11) — 그림은 js/art/tower-<id>.js
    flame_jet: 'fire', thorn_garden: 'earth', icicle_cloud: 'frost', thunder_cloud: 'storm', lighthouse: 'light', dread_bell: 'dark',
    phoenix_nest: 'fire', blizzard_keep: 'frost', storm_eye: 'storm', titan_boulder: 'earth', judgment_spire: 'light', soul_reaper: 'dark', chrono_spire: 'light', shadow_dragon: 'dark',
  };

  /* ---------------- 섬세한 명암 (docs/design/animation.md §7) ----------------
   * 그늘은 검게가 아니라 색을 틀어서(따뜻한 색 → 붉은 보라, 차가운 색 → 푸른 보라),
   * 밝은 면은 왼쪽 위 따뜻한 빛, 그늘 쪽 끝에는 하늘빛 반사광.
   */
  const LIT = '#fff3d8';
  const RIM = '#b8c6ea';
  function shadeTo(h, col) {
    const [r, , b] = h.hexToRgb(col);
    return r - b > 24 ? '#3c1a3e' : b - r > 24 ? '#1c2250' : '#2a1d48';
  }
  /** 색을 튼 어두운 색(a 0~1) */
  const dk = (h, col, a) => h.mix(col, shadeTo(h, col), a);
  /** 따뜻한 밝은 색(a 0~1) */
  const lt = (h, col, a) => h.mix(col, LIT, a);
  /** 안쪽 선 색: 그 자리 색의 어두운 변형 */
  const inkOf = (h, col, a = 0.58) => dk(h, col, a);

  /* ---------------- 그리기 문맥 ---------------- */
  function Ctx(s, element) {
    const h = RG.art._h;
    const E = h.el(element || 'none');
    const defs = [];
    const memo = {};
    const def = (key, mk) => {
      if (!memo[key]) { const id = h.uid('tw'); defs.push(mk(id)); memo[key] = `url(#${id})`; }
      return memo[key];
    };
    const sw = (w) => f(w / s);
    /* 외곽선: 기본(굵기 3)은 바깥 <g>가 정하므로 굵기만 다를 때 적음 */
    const st = (w = 3) => (w === 3 ? '' : ` stroke-width="${sw(w)}"`);
    const sa = (w, ex) => (w ? st(w) : ex.includes('stroke=') ? '' : ' stroke="none"');
    const stops = (arr) => arr.map(([o, col, op]) => `<stop offset="${o}" stop-color="${col}"${op != null ? ` stop-opacity="${f(op * 100) / 100}"` : ''}/>`).join('');
    /* 짧은 선형 그라데이션: 'h'(기본 방향) | 'v' | 'd' */
    const lgc = (id, arr, dir = 'v') => `<linearGradient id="${id}"${dir === 'v' ? ' x2="0" y2="1"' : dir === 'd' ? ' y2="1"' : ''}>${stops(arr)}</linearGradient>`;
    const rgc = (id, arr, cx = 0.4, cy = 0.35, r = 0.75) => `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">${stops(arr)}</radialGradient>`;
    const c = {
      h, s, E, defs, st, sw, def, lgc, rgc,
      /* 원기둥 옆면(왼쪽 위 빛) */
      cg: (col) => def(`c${col}`, (id) => lgc(id, [[0, h.shade(col, 0.1)], [0.28, h.shade(col, 0.3)], [0.62, col], [1, h.shade(col, -0.38)]], 'h')),
      /* 위→아래 */
      vg: (col, a = 0.3, b = -0.25) => def(`v${col}${a}${b}`, (id) => lgc(id, [[0, h.shade(col, a)], [1, h.shade(col, b)]])),
      /* 공(왼쪽 위 하이라이트) */
      sg: (col) => def(`s${col}`, (id) => rgc(id, [[0, h.shade(col, 0.65)], [0.45, col], [1, h.shade(col, -0.45)]], 0.36, 0.3, 0.78)),
      /* 빛 번짐(가장자리로 사라짐) */
      ag: (col, a = 0.7) => def(`a${col}${a}`, (id) => rgc(id, [[0, col, a], [0.45, col, a * 0.5], [1, col, 0]], 0.5, 0.5, 0.5)),
      /* 불꽃 */
      fo: () => def('fo', (id) => lgc(id, [[0, '#e8341a'], [0.6, '#ff6b3d'], [1, '#ffb347']])),
      fi: () => def('fi', (id) => lgc(id, [[0, '#ffd94a'], [1, '#fff6c8']])),
    };
    c.p = (d, fill, w = 3, ex = '') => `<path d="${d}" fill="${fill}"${sa(w, ex)}${ex}/>`;
    c.e = (cx, cy, rx, ry, fill, w = 3, ex = '') => `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(rx)}" ry="${f(ry)}" fill="${fill}"${sa(w, ex)}${ex}/>`;
    c.ci = (cx, cy, r, fill, w = 3, ex = '') => `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" fill="${fill}"${sa(w, ex)}${ex}/>`;
    c.r = (x, y, wd, ht, fill, rx = 0, w = 3, ex = '') => `<rect x="${f(x)}" y="${f(y)}" width="${f(wd)}" height="${f(ht)}"${rx ? ` rx="${f(rx)}"` : ''} fill="${fill}"${sa(w, ex)}${ex}/>`;
    /* 선(외곽선 없음) */
    c.ln = (d, col = OL, w = 2, op) => `<path d="${d}" fill="none" stroke="${col}" stroke-width="${sw(w)}"${op != null ? ` opacity="${op}"` : ''}/>`;
    /* 외곽선 있는 굵은 선(장대·밧줄·활) */
    c.ol = (d, col, w = 3) => c.ln(d, OL, w + 2.6) + c.ln(d, col, w);
    /* 색 계산(틀어진 그늘·따뜻한 빛·안쪽 선 색) */
    c.dk = (col, a) => dk(h, col, a);
    c.lt = (col, a) => lt(h, col, a);
    c.inkc = (col, a) => inkOf(h, col, a);
    /* 안쪽 선: c.p(d, fill, 1.8, c.ink(바탕색)) — 진한 윤곽색 대신 그 자리 색의 어두운 변형 */
    c.ink = (col, a) => ` stroke="${inkOf(h, col, a)}"`;
    return c;
  }
  /**
   * 섬세한 명암으로 바꾼 문맥(같은 c를 고쳐 돌려줌): cg·vg·sg 가 세 단계 + 색을 튼 그늘 + 반사광이 됩니다.
   * 그룹 파일이 draw 시작에서 fine(c) 를 부르면 그 탑만 바뀝니다(다른 그룹은 그대로).
   */
  function fine(c) {
    if (c.fine) return c;
    const { h, def, lgc, rgc } = c;
    const D = (col, a) => dk(h, col, a);
    const L = (col, a) => lt(h, col, a);
    const rim = (col) => h.mix(D(col, 0.42), RIM, 0.34);
    c.cg = (col) => def(`C${col}`, (id) => lgc(id, [[0, L(col, 0.1)], [0.2, L(col, 0.34)], [0.48, col], [0.78, D(col, 0.4)], [0.92, D(col, 0.5)], [1, rim(col)]], 'h'));
    c.vg = (col, a = 0.3, b = -0.25) => def(`V${col}${a}${b}`, (id) => lgc(id, [[0, a >= 0 ? L(col, a) : D(col, -a)], [0.5, a >= 0 && b < 0 ? col : h.mix(a >= 0 ? L(col, a) : D(col, -a), b >= 0 ? L(col, b) : D(col, -b), 0.5)], [1, b >= 0 ? L(col, b) : D(col, Math.min(0.9, -b * 1.2))]]));
    c.sg = (col) => def(`S${col}`, (id) => rgc(id, [[0, L(col, 0.72)], [0.42, col], [0.8, D(col, 0.46)], [1, rim(col)]], 0.36, 0.3, 0.78));
    c.fine = true;
    return c;
  }

  /* 점 목록 → 닫힌 경로 */
  const poly = (pts) => `M${pts.map((p) => `${f(p[0])} ${f(p[1])}`).join('L')}Z`;
  /* 원기둥: 옆면 + 윗면 */
  const cyl = (c, cx, yt, yb, rx, ry, side, top, w = 3) =>
    c.p(`M${f(cx - rx)} ${f(yt)}V${f(yb)}A${f(rx)} ${f(ry)} 0 0 0 ${f(cx + rx)} ${f(yb)}V${f(yt)}Z`, side, w) + (top ? c.e(cx, yt, rx, ry, top, w) : '');
  /* 원뿔대(위가 좁음) */
  const frus = (c, cx, yt, yb, rt, rb, side, top, w = 3, k = 0.3) =>
    c.p(`M${f(cx - rb)} ${f(yb)}L${f(cx - rt)} ${f(yt)}L${f(cx + rt)} ${f(yt)}L${f(cx + rb)} ${f(yb)}A${f(rb)} ${f(rb * k)} 0 0 1 ${f(cx - rb)} ${f(yb)}Z`, side, w) +
    (top ? c.e(cx, yt, rt, rt * k, top, w) : '');
  /* 원기둥 앞면을 도는 줄(이음매·띠) */
  const ring = (cx, y, rx, ry) => `M${f(cx - rx)} ${f(y)}A${f(rx)} ${f(ry)} 0 0 0 ${f(cx + rx)} ${f(y)}`;
  /* 원기둥 띠(두 줄 사이를 채움) */
  const band = (c, cx, y1, y2, rx, ry, fill, w = 2) =>
    c.p(`M${f(cx - rx)} ${f(y1)}A${f(rx)} ${f(ry)} 0 0 0 ${f(cx + rx)} ${f(y1)}V${f(y2)}A${f(rx)} ${f(ry)} 0 0 1 ${f(cx - rx)} ${f(y2)}Z`, fill, w);
  /* 원기둥 옆면 세로 이음매: 각도(도, 0=정면) */
  const vseam = (cx, y1, y2, rx, ry, deg) => {
    const a = (deg * Math.PI) / 180;
    const x = cx + rx * Math.sin(a);
    const o = ry * Math.cos(a);
    return `M${f(x)} ${f(y1 + o)}V${f(y2 + o)}`;
  };

  /* ---------------- 공용 부품 ---------------- */
  /* 불꽃: 아래 중심 (x,y), 너비 w, 높이 h */
  function flame(c, x, y, w, h, inner = true) {
    const P = (px, py) => `${f(x + px * w)} ${f(y - py * h)}`;
    const outer = `M${P(0, 0)}C${P(-0.52, 0)} ${P(-0.62, 0.36)} ${P(-0.36, 0.64)}C${P(-0.32, 0.48)} ${P(-0.2, 0.44)} ${P(-0.15, 0.52)}C${P(-0.18, 0.76)} ${P(-0.02, 0.86)} ${P(0.06, 1)}C${P(0.14, 0.8)} ${P(0.34, 0.72)} ${P(0.3, 0.5)}C${P(0.4, 0.56)} ${P(0.46, 0.62)} ${P(0.44, 0.72)}C${P(0.64, 0.44)} ${P(0.56, 0)} ${P(0, 0)}Z`;
    let o = c.p(outer, c.fo(), 2.4);
    if (inner) {
      const Q = (px, py) => `${f(x + px * w)} ${f(y - 1.5 - py * h)}`;
      o += c.p(`M${Q(0, 0)}C${Q(-0.3, 0)} ${Q(-0.32, 0.28)} ${Q(0, 0.6)}C${Q(0.32, 0.28)} ${Q(0.3, 0)} ${Q(0, 0)}Z`, c.fi(), 0);
    }
    return o;
  }
  /* 결정(육각 기둥 모양) — 중심 (x,y) */
  function crystal(c, x, y, w, h, col, w0 = 3) {
    const pts = [[x, y - h / 2], [x + w / 2, y - h * 0.2], [x + w * 0.42, y + h * 0.28], [x, y + h / 2], [x - w * 0.42, y + h * 0.28], [x - w / 2, y - h * 0.2]];
    const hh = c.h;
    const ins = (P) => P.map(([px, py]) => [x + (px - x) * 0.84, y + (py - y) * 0.9]);
    return c.p(poly(pts), c.vg(col, 0.45, -0.2), w0) +
      c.p(poly(ins([[x + 1, y - h / 2], [x + w / 2, y - h * 0.2], [x + w * 0.42, y + h * 0.28], [x + 1, y + h / 2]])), hh.shade(col, -0.22), 0, ' opacity="0.75"') +
      c.p(poly(ins([[x - 1, y - h / 2], [x - w / 2, y - h * 0.2], [x - w * 0.18, y - h * 0.1]])), hh.shade(col, 0.6), 0, ' opacity="0.8"');
  }
  /* 공 */
  const orb = (c, x, y, r, col, w = 3) => c.ci(x, y, r, c.sg(col), w) + c.e(x - r * 0.35, y - r * 0.4, r * 0.28, r * 0.2, '#fff', 0, ' opacity="0.75"');
  /* 빛 번짐 */
  const aura = (c, x, y, rx, ry, col, a = 0.7) => c.e(x, y, rx, ry, c.ag(col, a), 0);
  /* 반짝임(네 갈래 별) */
  function spark(c, x, y, r, col = '#fff', w = 0) {
    const k = r * 0.28;
    return c.p(`M${f(x)} ${f(y - r)}Q${f(x + k)} ${f(y - k)} ${f(x + r)} ${f(y)}Q${f(x + k)} ${f(y + k)} ${f(x)} ${f(y + r)}Q${f(x - k)} ${f(y + k)} ${f(x - r)} ${f(y)}Q${f(x - k)} ${f(y - k)} ${f(x)} ${f(y - r)}Z`, col, w);
  }
  /* 번개 모양 — 위 끝 (x,y), 크기 s */
  function bolt(c, x, y, s, col, w = 2.2) {
    const pts = [[0, 0], [5, 0], [2, 7], [7, 7], [-2, 20], [0.5, 10], [-4, 10]].map(([a, b]) => [x + a * s, y + b * s]);
    return c.p(poly(pts), col, w);
  }
  /* 깃발 — 장대 아래 (x,y), 높이 h, 방향 dir(1=오른쪽) */
  function flag(c, x, y, h, col, dir = 1, fw = 18) {
    const t = y - h;
    const d = dir;
    return c.ol(`M${f(x)} ${f(y)}V${f(t - 2)}`, M.woodD, 2.2) +
      c.p(`M${f(x)} ${f(t)}C${f(x + d * fw * 0.4)} ${f(t - 3)} ${f(x + d * fw * 0.6)} ${f(t + 3)} ${f(x + d * fw)} ${f(t + 1)}L${f(x + d * fw * 0.8)} ${f(t + 6)}L${f(x + d * fw)} ${f(t + 11)}C${f(x + d * fw * 0.6)} ${f(t + 13)} ${f(x + d * fw * 0.4)} ${f(t + 8)} ${f(x)} ${f(t + 11)}Z`, c.vg(col, 0.2, -0.2), 2.4) +
      c.ci(x, t - 3, 2.2, M.gold, 2);
  }
  /* 원뿔 지붕 — 아래 중심 (x,y), 너비 w, 높이 h */
  function cone(c, x, y, w, h, col, k = 0.28, lines = true) {
    const r = w / 2;
    let o = c.p(`M${f(x - r)} ${f(y)}L${f(x)} ${f(y - h)}L${f(x + r)} ${f(y)}A${f(r)} ${f(r * k)} 0 0 1 ${f(x - r)} ${f(y)}Z`, c.cg(col), 3);
    if (lines) {
      const dk = c.h.shade(col, -0.35);
      o += c.ln(`M${f(x - r * 0.45)} ${f(y + r * k * 0.88)}L${f(x)} ${f(y - h + 2)}M${f(x + r * 0.45)} ${f(y + r * k * 0.88)}L${f(x)} ${f(y - h + 2)}`, dk, 1.6, 0.7);
      o += c.ln(ring(x, y - h * 0.45, r * 0.55, r * k * 0.55), dk, 1.6, 0.7);
    }
    return o;
  }
  /* 사람(두건) — 어깨 중심 (x,y), 크기 k, 옷 색 col */
  function person(c, x, y, k, col, hood = col) {
    return c.p(`M${f(x - 7 * k)} ${f(y + 9 * k)}C${f(x - 7.5 * k)} ${f(y + 1 * k)} ${f(x - 4 * k)} ${f(y - 0.5 * k)} ${f(x)} ${f(y - 0.5 * k)}C${f(x + 4 * k)} ${f(y - 0.5 * k)} ${f(x + 7.5 * k)} ${f(y + 1 * k)} ${f(x + 7 * k)} ${f(y + 9 * k)}Z`, c.vg(col), 2.4) +
      c.p(`M${f(x - 5.2 * k)} ${f(y - 2 * k)}C${f(x - 6 * k)} ${f(y - 9 * k)} ${f(x - 2 * k)} ${f(y - 12 * k)} ${f(x + 1 * k)} ${f(y - 13.5 * k)}C${f(x + 1 * k)} ${f(y - 11.5 * k)} ${f(x + 6 * k)} ${f(y - 9 * k)} ${f(x + 5.2 * k)} ${f(y - 2 * k)}Z`, c.vg(hood, 0.15, -0.3), 2.4) +
      c.e(x, y - 4.6 * k, 3.3 * k, 3 * k, M.skin, 0);
  }
  /* 활(오른쪽을 겨눔) — 손잡이 (x,y), 반높이 hh */
  function bow(c, x, y, hh, col = M.woodD, arrow = true, fire = true) {
    let o = c.ln(`M${f(x)} ${f(y - hh)}L${f(x - hh * 0.25)} ${f(y)}L${f(x)} ${f(y + hh)}`, '#f4ead8', 1.4);
    o += c.ol(`M${f(x)} ${f(y - hh)}Q${f(x + hh * 0.75)} ${f(y)} ${f(x)} ${f(y + hh)}`, col, 2.4);
    if (arrow) {
      o += c.ol(`M${f(x - hh * 0.25)} ${f(y)}L${f(x + hh * 0.8)} ${f(y)}`, M.rope, 1.6);
      if (fire) o += spark(c, x + hh * 0.9, y, hh * 0.38, '#ffb347', 1.6) + c.ci(x + hh * 0.9, y, hh * 0.13, '#fff3b0', 0);
    }
    return o;
  }

  /* ---------------- 받침 ---------------- */
  /* 고정 난수(같은 자리는 늘 같은 돌) */
  const rn = (i) => { const x = Math.sin(i * 91.7 + 47.3) * 43758.5453; return x - Math.floor(x); };
  /* 원기둥 옆면 밝기: u 0(왼쪽 끝) ~ 1(오른쪽 끝) — fine 의 cg 와 같은 단계 */
  function toneAt(h, col, u) {
    const S = [[0, lt(h, col, 0.1)], [0.2, lt(h, col, 0.32)], [0.48, col], [0.78, dk(h, col, 0.38)], [0.93, dk(h, col, 0.48)], [1, h.mix(dk(h, col, 0.4), RIM, 0.32)]];
    for (let i = 1; i < S.length; i++) if (u <= S[i][0]) return h.mix(S[i - 1][1], S[i][1], (u - S[i - 1][0]) / (S[i][0] - S[i - 1][0]));
    return S[S.length - 1][1];
  }
  /* 모서리를 둥글린 다각형 경로 */
  function roundPoly(pts, r) {
    const n = pts.length;
    let d = '';
    for (let i = 0; i < n; i++) {
      const p = pts[i];
      const a = pts[(i + n - 1) % n];
      const b = pts[(i + 1) % n];
      const la = Math.hypot(a[0] - p[0], a[1] - p[1]) || 1;
      const lb = Math.hypot(b[0] - p[0], b[1] - p[1]) || 1;
      const ra = Math.min(r, la * 0.45);
      const rb = Math.min(r, lb * 0.45);
      const p1 = [p[0] + ((a[0] - p[0]) * ra) / la, p[1] + ((a[1] - p[1]) * ra) / la];
      const p2 = [p[0] + ((b[0] - p[0]) * rb) / lb, p[1] + ((b[1] - p[1]) * rb) / lb];
      d += `${i ? 'L' : 'M'}${f(p1[0])} ${f(p1[1])}Q${f(p[0])} ${f(p[1])} ${f(p2[0])} ${f(p2[1])}`;
    }
    return `${d}Z`;
  }
  /* 돌 색 흔들림: 푸른·누런·보랏빛·밝게·어둡게 */
  const TINTS = ['#9aa8c8', '#c8b07a', '#a08ab0', '#ffffff', '#3a2a40'];
  const tintStone = (h, col, q) => (q < 0.5 ? col : h.mix(col, TINTS[Math.floor((q - 0.5) * 10) % 5], q > 0.9 ? 0.1 : 0.16));
  /**
   * 돌쌓기(원기둥·원뿔대 옆면) — 가운데 cx, 위 yt(반지름 rt) ~ 아래 yb(반지름 rb), 타원 비율 kE, 돌 색 col.
   * o: rows 줄 수(또는 ch 줄 높이), bw 돌 너비, rough 막돌(크기·모서리 들쭉날쭉), seed, moss 이끼, noOutline, ao(접지 그늘, 기본 켬)
   * 돌마다 자리에 따른 밝기(왼쪽 위 빛·오른쪽 그늘·끝 반사광) + 색 흔들림(푸른·누런·보랏빛) + 윗모서리 빛·아랫모서리 그늘 + 이 빠짐.
   * 줄눈은 그 돌 색의 어두운 변형(진한 윤곽색 아님). 맨 아래는 땅에 닿아 가장 어둡게.
   * 바탕은 앞 윗선(타원 호) ~ 아랫선 사이만 칠하므로 고리 담처럼 안쪽이 보여야 하는 곳에도 씀.
   */
  function masonry(c, cx, yt, yb, rt, rb, kE, col, o = {}) {
    const h = c.h;
    const rows = o.rows || Math.max(1, Math.round((yb - yt) / (o.ch || 7)));
    const seed = o.seed || 1;
    const g = o.gap != null ? o.gap : 0.5;
    const rough = !!o.rough;
    const rAt = (y) => rt + (rb - rt) * ((y - yt) / (yb - yt || 1));
    const sideD = `M${f(cx - rt)} ${f(yt)}A${f(rt)} ${f(rt * kE)} 0 0 0 ${f(cx + rt)} ${f(yt)}L${f(cx + rb)} ${f(yb)}A${f(rb)} ${f(rb * kE)} 0 0 1 ${f(cx - rb)} ${f(yb)}Z`;
    let s = c.p(sideD, o.mortar || dk(h, col, 0.55), 0);
    const P = (a, y) => { const r = rAt(y); return [cx + r * Math.sin(a), y + r * kE * Math.cos(a)]; };
    const dy = (yb - yt) / rows;
    let hi = '';
    let lo = '';
    const H2 = Math.PI / 2 - 0.015;
    for (let i = 0; i < rows; i++) {
      const y1 = yt + i * dy;
      const y2 = y1 + dy;
      const rm = rAt((y1 + y2) / 2);
      const bw = (o.bw || 12) / rm;
      let a = -H2 - rn(seed * 3 + i * 7) * bw * 0.8 - (i % 2 ? bw * 0.5 : 0);
      let j = 0;
      while (a < H2) {
        const q = rn(seed * 17 + i * 31 + j * 5);
        const w = bw * (rough ? 0.6 + q * 0.75 : 0.8 + q * 0.4);
        const a1 = Math.max(a, -H2);
        const a2 = Math.min(a + w, H2);
        a += w;
        j += 1;
        if (a2 - a1 < 0.06) continue;
        const ia1 = g / (rm * Math.max(0.22, Math.cos(a1)));
        const ia2 = g / (rm * Math.max(0.22, Math.cos(a2)));
        const b1 = a1 + (a1 > -H2 + 0.01 ? ia1 : 0);
        const b2 = a2 - (a2 < H2 - 0.01 ? ia2 : 0);
        if (b2 - b1 < 0.03) continue;
        const m = (b1 + b2) / 2;
        const jt = rough ? (rn(seed + i * 13 + j) - 0.5) * Math.min(0.9, dy * 0.15) : 0;
        const jb = rough ? (rn(seed + i * 19 + j * 3) - 0.5) * Math.min(0.9, dy * 0.15) : 0;
        const top = i === 0 ? 0.15 : g;
        const bot = i === rows - 1 ? 0 : g;
        const pts = [P(b1, y1 + top + Math.abs(jt)), P(m, y1 + top), P(b2, y1 + top + Math.abs(jt) * 0.5), P(b2, y2 - bot + jb * 0.4), P(m, y2 - bot), P(b1, y2 - bot - Math.abs(jb))];
        const u = (1 + Math.sin(m)) / 2;
        const fill = tintStone(h, toneAt(h, col, u), rn(seed * 7 + i * 11 + j * 13));
        s += c.p(roundPoly(pts, rough ? Math.min(1.6, dy * 0.25) : 0.7), fill, 0);
        if (u < 0.8) hi += `M${f(pts[0][0] + 0.4)} ${f(pts[0][1] + 0.55)}L${f(pts[1][0])} ${f(pts[1][1] + 0.55)}L${f(pts[2][0] - 0.4)} ${f(pts[2][1] + 0.55)}`;
        lo += `M${f(pts[5][0] + 0.6)} ${f(pts[5][1] - 0.45)}L${f(pts[4][0])} ${f(pts[4][1] - 0.45)}L${f(pts[3][0] - 0.4)} ${f(pts[3][1] - 0.45)}`;
        if (q > 0.8 && b2 - b1 > 0.16 && dy > 4) { const pc = P(m + (b2 - b1) * 0.18, (y1 + y2) / 2); s += c.e(pc[0], pc[1], 0.9, 0.55, dk(h, fill, 0.45), 0); }
      }
    }
    if (hi) s += c.ln(hi, lt(h, col, 0.5), 1.1, 0.75);
    if (lo) s += c.ln(lo, dk(h, col, 0.5), 1.1, 0.6);
    /* 이끼(왼쪽 아래) — 작은 덩이 몇 개 */
    if (o.moss) {
      const mc = '#6f9a4a';
      [[-1.0, 0.0, 3.2], [-0.78, 0.25, 2.2], [-0.6, -0.1, 1.6]].forEach(([am, yo, r], k) => {
        const p0 = P(am, yb - 0.6 - yo);
        s += c.p(`M${f(p0[0] - r)} ${f(p0[1])}Q${f(p0[0] - r * 0.8)} ${f(p0[1] - r * 0.9)} ${f(p0[0] - r * 0.1)} ${f(p0[1] - r * 0.7)}Q${f(p0[0] + r * 0.5)} ${f(p0[1] - r * 1.1)} ${f(p0[0] + r)} ${f(p0[1])}Z`, k ? h.mix(mc, '#9ac060', 0.3) : mc, 1.2, c.ink(mc));
        s += c.ci(p0[0] - r * 0.25, p0[1] - r * 0.45, Math.max(0.5, r * 0.18), '#b8e080', 0, ' opacity="0.8"');
      });
    }
    /* 땅에 닿는 곳(가장 어둡게) */
    if (o.ao !== false) s += c.p(`M${f(cx - rb)} ${f(yb - 2.4)}A${f(rb)} ${f(rb * kE)} 0 0 0 ${f(cx + rb)} ${f(yb - 2.4)}V${f(yb)}A${f(rb)} ${f(rb * kE)} 0 0 1 ${f(cx - rb)} ${f(yb)}Z`, OL, 0, ' opacity="0.3"');
    if (!o.noOutline) s += c.p(sideD, 'none', 3);
    return s;
  }
  const masonryCyl = (c, cx, yt, yb, rx, ry, col, o = {}) => masonry(c, cx, yt, yb, rx, rx, ry / rx, col, o);
  /**
   * 윗면 판석(타원 안에 돌 고리) — 가운데 (cx,cy), 반지름 rx·ry. 빛은 왼쪽 위.
   */
  function flagTop(c, cx, cy, rx, ry, col, o = {}) {
    const h = c.h;
    const seed = o.seed || 5;
    const base = lt(h, col, 0.16);
    let s = c.e(cx, cy, rx, ry, o.mortar || dk(h, col, 0.42), o.w == null ? 3 : o.w);
    const g = 0.55;
    const Q = (u, v) => [cx + u * rx, cy + v * ry];
    const rings = [[0, 0.34, 1], [0.34, 0.68, 6], [0.68, 0.99, 11]];
    let hi = '';
    rings.forEach(([r1, r2, n], ri) => {
      for (let k = 0; k < n; k++) {
        const q = rn(seed * 5 + ri * 17 + k * 3);
        let pts;
        if (n === 1) {
          pts = [];
          for (let t = 0; t < 8; t++) { const a = (t / 8) * Math.PI * 2; pts.push(Q(Math.cos(a) * (r2 - 0.05), Math.sin(a) * (r2 - 0.05))); }
        } else {
          const off = ri * 0.37 + rn(seed + ri) * 0.4;
          const a1 = off + (k / n) * Math.PI * 2;
          const a2 = off + ((k + 1) / n) * Math.PI * 2;
          const ia = g / (rx * ((r1 + r2) / 2));
          const ri1 = r1 + g / rx;
          const ri2 = r2 - (ri === 2 ? 0.02 : g / rx);
          pts = [];
          [0, 0.5, 1].forEach((t) => { const a = a1 + ia + (a2 - a1 - 2 * ia) * t; pts.push(Q(Math.cos(a) * ri2, Math.sin(a) * ri2)); });
          [1, 0.5, 0].forEach((t) => { const a = a1 + ia + (a2 - a1 - 2 * ia) * t; pts.push(Q(Math.cos(a) * ri1, Math.sin(a) * ri1)); });
        }
        const cxs = pts.reduce((a, p) => a + p[0], 0) / pts.length;
        const cys = pts.reduce((a, p) => a + p[1], 0) / pts.length;
        const u = (cxs - cx) / rx;
        const v = (cys - cy) / ry;
        const tone = u + v < -0.3 ? lt(h, base, 0.12) : u + v > 0.6 ? dk(h, base, 0.1) : base;
        s += c.p(roundPoly(pts, 0.9), tintStone(h, tone, q), 0);
        if (n > 1 && v < 0.2) hi += `M${f(pts[3][0])} ${f(pts[3][1] + 0.5)}L${f(pts[4][0])} ${f(pts[4][1] + 0.5)}L${f(pts[5][0])} ${f(pts[5][1] + 0.5)}`;
      }
    });
    if (hi) s += c.ln(hi, lt(h, col, 0.55), 1, 0.6);
    return s;
  }
  /**
   * 윗면 널마루(타원 안 세로 널) — 나뭇결·옹이·못·널 틈.
   */
  function plankTop(c, cx, cy, rx, ry, col, o = {}) {
    const h = c.h;
    const n = o.n || 6;
    const clip = c.def(`ptc${cx}_${cy}_${rx}_${ry}`, (id) => `<clipPath id="${id}"><ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(rx)}" ry="${f(ry)}"/></clipPath>`);
    let s = c.e(cx, cy, rx, ry, dk(h, col, 0.5), 3);
    let inner = '';
    const bw = (2 * rx) / n;
    let grain = '';
    let gaps = '';
    let nails = '';
    for (let i = 0; i < n; i++) {
      const x1 = cx - rx + i * bw;
      const u = (i + 0.5) / n;
      const q = rn(i * 7 + (o.seed || 3));
      const tone = h.mix(u < 0.35 ? lt(h, col, 0.2) : u > 0.75 ? dk(h, col, 0.22) : col, q > 0.5 ? '#c89058' : '#8a5a3a', 0.12);
      inner += c.r(x1 + 0.35, cy - ry - 1, bw - 0.7, 2 * ry + 2, tone, 0, 0);
      const gx = x1 + bw * (0.3 + q * 0.3);
      grain += `M${f(gx)} ${f(cy - ry)}Q${f(gx + 1.2)} ${f(cy - ry * 0.2)} ${f(gx - 0.4)} ${f(cy + ry * 0.4)}Q${f(gx - 1)} ${f(cy + ry * 0.8)} ${f(gx + 0.3)} ${f(cy + ry)}`;
      if (q > 0.55) inner += c.e(x1 + bw * 0.65, cy - ry * 0.25 + q * 4, 1.1, 0.7, dk(h, col, 0.4), 0) + c.e(x1 + bw * 0.65, cy - ry * 0.25 + q * 4, 2, 1.3, 'none', 0, ` stroke="${dk(h, col, 0.3)}" stroke-width="${c.sw(0.9)}"`);
      if (i > 0) gaps += `M${f(x1)} ${f(cy - ry)}V${f(cy + ry)}`;
      /* 가로 장선 위 못 */
      const hy = ry * Math.sqrt(Math.max(0, 1 - ((x1 + bw / 2 - cx) / rx) ** 2));
      nails += c.ci(x1 + bw / 2, cy - hy * 0.55, 0.65, '#4a4450', 0) + c.ci(x1 + bw / 2, cy + hy * 0.55, 0.65, '#4a4450', 0);
    }
    inner += c.ln(grain, dk(h, col, 0.32), 0.9, 0.7) + c.ln(gaps, dk(h, col, 0.55), 1.3) + nails;
    /* 장선 줄(못 자리) */
    s += `<g clip-path="${clip}">${inner}${c.e(cx - rx * 0.3, cy - ry * 0.35, rx * 0.6, ry * 0.45, LIT, 0, ' opacity="0.12"')}</g>`;
    return s;
  }
  /** 보석(마름모, 면마다 밝기 + 반짝점) */
  function gem(c, x, y, rw, rh, col, glow) {
    const h = c.h;
    let s = glow ? c.e(x, y, rw * 2.6, rh * 2, c.ag(col, 0.6), 0) : '';
    s += c.p(poly([[x, y - rh], [x + rw, y], [x, y + rh], [x - rw, y]]), dk(h, col, 0.2), 1.8);
    s += c.p(poly([[x, y - rh], [x - rw, y], [x, y]]), lt(h, col, 0.45), 0);
    s += c.p(poly([[x, y - rh], [x + rw, y], [x, y]]), col, 0);
    s += c.p(poly([[x - rw, y], [x, y + rh], [x, y]]), h.mix(col, dk(h, col, 0.3), 0.5), 0);
    s += c.ci(x - rw * 0.35, y - rh * 0.35, Math.max(0.6, rw * 0.22), '#ffffff', 0, ' opacity="0.9"');
    return s;
  }
  /** 금속 띠(원기둥을 도는) + 리벳 + 반짝 띠 */
  function metalBand(c, cx, y1, y2, rx, ry, col, o = {}) {
    const h = c.h;
    let s = band(c, cx, y1, y2, rx, ry, c.cg(col), 2);
    s += c.ln(ring(cx, y1 + 0.9, rx * 0.98, ry * 0.98), lt(h, col, 0.6), 0.9, 0.8);
    if (o.rivets !== false) {
      [-62, -32, 0, 32, 62].forEach((dg) => {
        const a = (dg * Math.PI) / 180;
        const x = cx + rx * Math.sin(a);
        const y = (y1 + y2) / 2 + ry * Math.cos(a);
        s += c.ci(x, y, 0.85, dg < 20 ? lt(h, col, 0.55) : dk(h, col, 0.25), 0);
      });
    }
    return s;
  }
  /*
   * 받침 — Lv1: 막돌 + 널 마루. Lv2: 다듬은 돌 + 판석. Lv3: + 금속 테(리벳)와 원소 보석.
   * Lv4: 2단(아래 막돌, 위 다듬은 돌), 원소 띠와 빛나는 보석.
   * 모양(높이·타원)은 예전과 같음 — 위에 놓이는 탑 그림이 그대로 맞음.
   */
  function plat(c, v, o = {}) {
    const E = c.E;
    const h = c.h;
    const stone = o.stone || '#a7a29b';
    let out = '';
    if (v === 1) {
      const rs = o.rough || M.rough;
      out += masonryCyl(c, 50, 104, 112, 44, 13, rs, { rows: 1, bw: 10, rough: true, seed: 3, moss: true });
      out += plankTop(c, 50, 104, 44, 13, o.top || M.plank);
      return out;
    }
    if (v === 2 || v === 3) {
      out += masonryCyl(c, 50, 104, 112, 44, 13, stone, { rows: 1, bw: 12, seed: v === 3 ? 9 : 7 });
      if (v === 3) {
        out += metalBand(c, 50, 104, 107.4, 44, 13, o.trim || M.gold);
        out += gem(c, 50, 119.6, 3.6, 4.4, E.color, true);
      }
      out += flagTop(c, 50, 104, 44, 13, stone, { seed: v === 3 ? 13 : 11 });
      out += c.e(50, 104, 34.5, 9.8, 'none', 0, ` stroke="${lt(h, stone, 0.4)}" stroke-width="${c.sw(1)}" opacity="0.6"`);
      return out;
    }
    /* Lv4 */
    const s2 = o.stone || stone;
    const lo = dk(h, s2, 0.22);
    out += masonryCyl(c, 50, 106, 112, 46, 14, lo, { rows: 1, bw: 12, rough: true, seed: 21 });
    out += flagTop(c, 50, 106, 46, 14, lo, { seed: 23 });
    out += masonryCyl(c, 50, 98, 106, 39, 11.5, s2, { rows: 1, bw: 10, seed: 25 });
    const tr = o.trim || E.color;
    out += band(c, 50, 101, 104.5, 39, 11.5, c.cg(tr), 2) + c.ln(ring(50, 101.8, 38.4, 11.3), lt(h, tr, 0.55), 0.9, 0.8);
    out += [-50, 0, 50].map((d) => {
      const a = (d * Math.PI) / 180;
      return gem(c, 50 + 39 * Math.sin(a), 102.8 + 11.5 * Math.cos(a), 3, 4, E.light, d === 0);
    }).join('');
    out += flagTop(c, 50, 98, 39, 11.5, s2, { seed: 27 });
    out += c.e(50, 98, 30, 8.5, 'none', 0, ` stroke="${E.color}" stroke-width="${c.sw(1.8)}" opacity="0.65"`);
    return out;
  }


  /* 여러 그룹이 함께 쓰는 부품 */
  function house(c, x1, x2, yw, ya, yb, wall, roof, d = 12) {
    const h = c.h;
    const cx = (x1 + x2) / 2;
    let o = '';
    // 지붕 뒤쪽 면(위로 보이는 경사면)
    o += c.p(poly([[x1 - 4, yw + 2], [cx, ya - 2], [cx, ya - 2 - d], [x1 - 4, yw + 2 - d]]), c.vg(h.shade(roof, 0.1), 0.2, -0.1), 3);
    o += c.p(poly([[x2 + 4, yw + 2], [cx, ya - 2], [cx, ya - 2 - d], [x2 + 4, yw + 2 - d]]), c.vg(h.shade(roof, -0.15), 0.1, -0.2), 3);
    o += c.ln(`M${f(x1 + 4)} ${f(yw - 2 - d * 0.5 + 2)}L${f(cx)} ${f(ya - 2 - d * 0.5)}L${f(x2 - 4)} ${f(yw - 2 - d * 0.5 + 2)}`, h.shade(roof, -0.4), 1.5, 0.8);
    // 앞벽(박공)
    o += c.p(`M${x1} ${yb}V${yw}L${cx} ${ya}L${x2} ${yw}V${yb}Q${cx} ${yb + 5} ${x1} ${yb}Z`, wall, 3);
    // 처마 끝
    o += c.ol(`M${f(x1 - 5)} ${f(yw + 3)}L${f(cx)} ${f(ya - 3)}L${f(x2 + 5)} ${f(yw + 3)}`, roof, 4.5);
    return o;
  }
  function shard(c, x, yt, yb, w, col, w0 = 2.6) {
    const m = yb - w * 0.35;
    return c.p(poly([[x, yt], [x + w / 2, m], [x, yb], [x - w / 2, m]]), c.vg(col, 0.5, -0.15), w0) +
      c.p(poly([[x, yt], [x + w / 2, m], [x, yb]]), c.h.shade(col, -0.2), 0, ' opacity="0.7"') +
      c.ln(`M${f(x - w * 0.18)} ${f(m - 2)}L${f(x - 1)} ${f(yt + 6)}`, '#fff', 1.4, 0.8);
  }

  /* 그룹 파일(towers-*.js)이 쓰는 공용 도구와 탑 목록 */
  RG.art._tw = { OL, SC, VKEYS, f, M, STONE, ELEM, Ctx, fine, poly, cyl, frus, ring, band, vseam, flame, crystal, orb, aura, spark, bolt, flag, cone, person, bow, plat, house, shard, rn, roundPoly, toneAt, masonry, masonryCyl, flagTop, plankTop, gem, metalBand, T: {} };
})();
