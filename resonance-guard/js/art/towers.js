'use strict';

/* =========================================================
 * 탑 그림 (SVG 문자열) — 18종 × (Lv1, Lv2, Lv3, Lv4 A, Lv4 B) + 울림등
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
  };

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
  /*
   * Lv1: 거친 돌 + 나무 마루. Lv2: 다듬은 돌. Lv3: 돌 + 금속 테 + 원소 보석.
   * Lv4: 2단, 원소 색 띠와 빛나는 보석.
   */
  function plat(c, v, o = {}) {
    const h = c.h;
    const E = c.E;
    const stone = o.stone || '#a7a29b';
    let out = '';
    if (v === 1) {
      const rs = o.rough || M.rough;
      out += cyl(c, 50, 104, 112, 44, 13, c.cg(rs), null);
      const dk = h.shade(rs, -0.4);
      out += c.ln(ring(50, 108, 44, 13) + [-62, -22, 18, 56].map((d) => vseam(50, 104, 108, 44, 13, d)).join('') +
        [-44, -4, 36, 72].map((d) => vseam(50, 108, 112, 44, 13, d)).join(''), dk, 1.6);
      out += c.e(50, 104, 44, 13, c.vg(o.top || M.plank, 0.2, -0.15));
      const pk = h.shade(o.top || M.plank, -0.3);
      out += c.ln([-26, -9, 9, 26].map((dx) => { const hy = 13 * Math.sqrt(1 - (dx / 44) ** 2); return `M${f(50 + dx)} ${f(104 - hy + 1)}V${f(104 + hy - 1)}`; }).join(''), pk, 1.4);
      return out;
    }
    if (v === 2 || v === 3) {
      out += cyl(c, 50, 104, 112, 44, 13, c.cg(stone), null);
      const dk = h.shade(stone, -0.38);
      out += c.ln(ring(50, 108, 44, 13) + [-60, -30, 0, 30, 60].map((d) => vseam(50, 104, 108, 44, 13, d)).join('') +
        [-75, -45, -15, 15, 45, 75].map((d) => vseam(50, 108, 112, 44, 13, d)).join(''), dk, 1.5);
      if (v === 3) {
        out += band(c, 50, 104, 107.5, 44, 13, c.vg(o.trim || M.gold, 0.35, -0.25));
        out += c.p(poly([[50, 115], [54, 119.5], [50, 124], [46, 119.5]]), c.vg(E.color, 0.4, -0.2), 2);
      }
      out += c.e(50, 104, 44, 13, c.vg(h.shade(stone, 0.22), 0.25, -0.05));
      out += c.e(50, 104, 34, 9.5, 'none', 0, ` stroke="${h.shade(stone, -0.2)}" stroke-width="${c.sw(1.5)}"`);
      return out;
    }
    /* Lv4 */
    const s2 = o.stone || stone;
    const lo = h.shade(s2, -0.25);
    out += cyl(c, 50, 106, 112, 46, 14, c.cg(lo), c.vg(h.shade(lo, 0.15), 0.2, 0));
    out += c.ln([-70, -35, 0, 35, 70].map((d) => vseam(50, 106, 112, 46, 14, d)).join(''), h.shade(lo, -0.4), 1.5);
    out += cyl(c, 50, 98, 106, 39, 11.5, c.cg(s2), null);
    out += band(c, 50, 101, 104.5, 39, 11.5, c.vg(o.trim || E.color, 0.3, -0.3));
    out += [-50, 0, 50].map((d) => {
      const a = (d * Math.PI) / 180;
      const x = 50 + 39 * Math.sin(a);
      const y = 102.8 + 11.5 * Math.cos(a);
      return c.p(poly([[x, y - 4], [x + 3, y], [x, y + 4], [x - 3, y]]), c.vg(E.light, 0.3, -0.1), 1.8);
    }).join('');
    out += c.e(50, 98, 39, 11.5, c.vg(h.shade(s2, 0.25), 0.25, -0.05));
    out += c.e(50, 98, 30, 8.5, 'none', 0, ` stroke="${E.color}" stroke-width="${c.sw(2)}" opacity="0.7"`);
    return out;
  }

  /* =========================================================
   * 탑별 그림: (c, v) → 몸체 문자열.  v = 1|2|3|'A'|'B'
   * 각 항목: draw, muzzle(틀 좌표 [x,y] × 5)
   * ========================================================= */
  const T = {};

  /* ---------- 🔥 불씨 궁수탑 ---------- */
  T.ember_archer = {
    muzzle: [[72, 33], [69, 46], [67, 18], [79, 35], [67, 34]],
    draw(c, v) {
      const h = c.h;
      const st = STONE.fire;
      if (v === 1) {
        let o = plat(c, 1);
        // 뒷다리
        o += c.ol('M38 102L40 58M62 102L60 58', h.shade(M.wood, -0.25), 4.5);
        // 앞다리 + 버팀대
        o += c.ol('M33 76L66 100M67 76L34 100', M.wood, 3.2);
        o += c.ol('M29 109L31 58M71 109L69 58', M.wood, 5.5);
        // 뒷벽 + 궁수
        o += c.r(25, 40, 50, 10, h.shade(M.wood, -0.35), 1.5);
        o += person(c, 45, 43, 1.35, '#7a3b2a', '#9b3d24');
        o += bow(c, 60, 33, 13);
        // 앞 난간
        o += c.r(22, 48, 56, 16, c.vg(M.plank), 2);
        o += c.ln('M33 50V62M44 50V62M56 50V62M67 50V62M23 55H77', h.shade(M.plank, -0.35), 1.5);
        // 모서리 기둥
        o += c.p('M20 66V36L24 30L28 36V66Z', c.cg(M.wood), 2.6) + c.p('M72 66V36L76 30L80 36V66Z', c.cg(M.wood), 2.6);
        // 원소 포인트: 횃불
        o += c.r(73, 24, 6, 6, M.iron, 1, 2) + flame(c, 76, 25, 11, 16);
        return o;
      }
      if (v === 2) {
        let o = plat(c, 2, { stone: st });
        // 돌 받침(아래층)
        o += frus(c, 50, 70, 104, 24, 30, c.cg(st), null);
        o += c.ln(`${ring(50, 80, 26.5, 7.6)}${ring(50, 92, 28, 8.2)}M44 72V80M58 72V80M38 84V92M50 85V94M62 84V92M44 97V105M57 97V105`, h.shade(st, -0.38), 1.5);
        o += c.e(50, 70, 24, 7, c.vg(h.shade(st, 0.2)));
        // 나무 기둥 + 궁수
        o += c.ol('M31 70V30M69 70V30', M.wood, 4);
        o += person(c, 45, 54, 1.15, '#7a3b2a', '#9b3d24');
        o += bow(c, 59, 46, 11);
        // 난간
        o += c.r(24, 56, 52, 14, c.vg(M.plank), 2);
        o += c.ln('M37 58V68M50 58V68M63 58V68', h.shade(M.plank, -0.35), 1.5);
        // 지붕(원소 색 기와) + 등
        o += cone(c, 50, 30, 68, 28, '#c8462c', 0.22);
        o += c.ci(50, 3, 3, M.gold, 2);
        o += c.ol('M74 32V37', M.iron, 1.6) + c.ci(74, 40.5, 4, c.sg('#ffb347'), 2);
        return o;
      }
      if (v === 3) {
        let o = plat(c, 3, { stone: st });
        o += aura(c, 34, 12, 22, 20, '#ff9a3d', 0.55);
        // 석탑
        o += frus(c, 50, 40, 104, 25, 31, c.cg(st), null);
        o += c.ln(`${ring(50, 58, 26.5, 7.7)}${ring(50, 76, 28, 8.2)}${ring(50, 92, 30, 8.8)}`, h.shade(st, -0.38), 1.5);
        o += c.ln('M40 43V57M60 43V57M47 61V75M33 61V75M67 61V75M40 79V91M60 79V91M48 95V104', h.shade(st, -0.38), 1.5);
        o += band(c, 50, 64, 68, 27.5, 8, c.vg(M.gold, 0.35, -0.25));
        // 창문(불빛)
        o += c.p('M45 92V82Q50 76 55 82V92Z', c.vg('#ffb347', 0.3, -0.2), 2.4);
        // 성가퀴
        o += cyl(c, 50, 30, 40, 30, 9, c.cg(h.shade(st, 0.05)), c.vg(h.shade(st, -0.15), -0.2, 0.1));
        o += person(c, 44, 26, 1.05, '#7a3b2a', '#9b3d24');
        o += bow(c, 56, 18, 12);
        o += c.p('M20 30V20H28V26H36V20H44V30Z', c.cg(st), 2.4) + c.p('M56 30V20H64V26H72V20H80V30Z', c.cg(st), 2.4);
        o += band(c, 50, 30, 35, 30, 9, c.vg(M.bronze, 0.3, -0.2), 2.4);
        // 붉은 깃발 + 화로
        o += flag(c, 76, 22, 22, '#e0442a', 1, 16);
        o += c.p('M20 20L34 20L31 27H23Z', c.vg(M.iron, 0.3, -0.3), 2.4) + flame(c, 27, 20, 16, 22);
        return o;
      }
      if (v === 'A') {
        // 화염 저격대 — 높고 가는 첨탑, 긴 활을 든 저격수
        const dst = '#7d6a66';
        let o = plat(c, 4, { stone: dst, trim: '#e0442a' });
        o += aura(c, 62, 34, 26, 24, '#ff8a3d', 0.5);
        o += frus(c, 50, 52, 99, 15, 22, c.cg(dst), null);
        o += c.ln(`${ring(50, 66, 17, 5)}${ring(50, 82, 19.5, 5.8)}`, h.shade(dst, -0.4), 1.5);
        o += c.ln('M44 56V65M57 56V65M50 70V81M41 86V97M59 86V97', h.shade(dst, -0.4), 1.5);
        o += band(c, 50, 74, 78, 18.5, 5.5, c.vg(M.gold, 0.35, -0.25));
        o += c.p('M45 98V90Q50 84 55 90V99Z', c.vg('#ffb347'), 2.2);
        // 위쪽 기둥 + 뾰족 지붕
        o += cyl(c, 50, 22, 52, 11, 3.3, c.cg(dst), null);
        o += cone(c, 50, 24, 30, 24, '#c8462c');
        o += c.ci(50, 2, 2.6, M.gold, 2);
        // 저격수 + 난간
        o += person(c, 45, 42, 1.1, '#5a2a22', '#c23a22');
        o += cyl(c, 50, 50, 56, 22, 6.5, c.cg(M.bronze), null);
        o += c.e(50, 50, 22, 6.5, 'none', 2.4);
        // 긴 활
        o += c.ln('M58 14L53 37L58 60', '#f4ead8', 1.4);
        o += c.ol('M58 14Q76 37 58 60', '#4a2a1a', 2.8);
        o += c.ol('M53 37L76 35', M.rope, 1.6) + spark(c, 79, 34.5, 7, '#ffb347', 1.6) + c.ci(79, 34.5, 2, '#fff3b0', 0);
        return o;
      }
      // 'B' 연사 궁수대 — 넓은 2층 망루, 궁수 셋
      const bst = '#b09a8a';
      let o = plat(c, 4, { stone: bst, trim: '#e0442a' });
      // 1층(돌)
      o += c.p('M10 100V64H90V100Q50 112 10 100Z', c.cg(bst), 3);
      o += c.ln('M10 78Q50 86 90 78M30 65V78M70 65V78M40 82V96M60 82V96', h.shade(bst, -0.38), 1.5);
      o += c.p('M43 103V90Q50 83 57 90V104Z', c.vg('#5a3a2a', 0.1, -0.3), 2.4);
      // 2층 궁수 셋
      o += c.r(8, 32, 84, 12, h.shade(M.wood, -0.35), 1.5);
      o += c.ol('M12 64V22M88 64V22', M.wood, 4);
      o += person(c, 24, 42, 0.95, '#7a3b2a', '#9b3d24') + person(c, 50, 41, 1, '#7a3b2a', '#c23a22') + person(c, 76, 42, 0.95, '#7a3b2a', '#9b3d24');
      o += bow(c, 33, 35, 9, M.woodD, true, false) + bow(c, 59, 34, 9) + bow(c, 85, 35, 9, M.woodD, true, false);
      o += c.r(6, 46, 88, 18, c.vg(M.plank), 2);
      o += c.ln('M20 48V62M35 48V62M50 48V62M65 48V62M80 48V62M7 54H93', h.shade(M.plank, -0.35), 1.5);
      // 넓은 지붕 + 처마 등
      o += c.p('M2 24L18 2H82L98 24Q50 30 2 24Z', c.vg('#c8462c', 0.25, -0.25), 3);
      o += c.ln('M20 23L28 4M40 25L44 3M60 25L56 3M80 23L72 4', h.shade('#c8462c', -0.4), 1.5);
      o += c.ol('M7 24V28M93 24V28', M.iron, 1.6) + c.ci(7, 32, 4, c.sg('#ffb347'), 2) + c.ci(93, 32, 4, c.sg('#ffb347'), 2);
      return o;
    },
  };

  /* ---------- 🔥 화염 박격포 ---------- */
  /* 포신(세운 상태로 그린 뒤 기울임): 바닥 (x,y), 길이 L, 반지름 r */
  function mortarBarrel(c, x, y, L, r, ang, o = {}) {
    const h = c.h;
    const col = o.col || M.iron;
    const t = y - L;
    let b = c.ci(x, y, r * 1.12, c.sg(col), 3);
    b += frus(c, x, t + 4, y, r * 0.86, r, c.cg(col), null);
    (o.bands || []).forEach((k) => { b += band(c, x, y - L * k - 2, y - L * k + 2, r * (0.9 + 0.1 * (1 - k)), r * 0.3, c.vg(o.trim || h.shade(col, 0.25), 0.3, -0.3), 2); });
    if (o.dragon) {
      // 용 머리(세운 좌표): 왼쪽 = 기울이면 위쪽
      const R = r;
      const D = o.dragon;
      const P = (px, py) => `${f(x + px * R)} ${f(t + py * R)}`;
      b += cyl(c, x, t + 1, t + 8, R * 1.15, R * 0.38, c.cg(D), null) + c.e(x, t + 1, R * 1.0, R * 0.33, '#2a1610', 2.2);
      b += c.p(`M${P(-0.9, 0.5)}C${P(-1.4, 0.3)} ${P(-1.9, 0.1)} ${P(-2.3, -0.4)}C${P(-1.8, -0.1)} ${P(-1.4, 0)} ${P(-1.0, 0.1)}Z`, c.vg('#f6e7c8', 0.2, -0.3), 2.2);
      b += c.p(`M${P(-1.15, 0.9)}C${P(-1.35, 0.3)} ${P(-1.1, -0.5)} ${P(-0.55, -1.0)}L${P(0.1, -1.25)}L${P(0.0, -0.75)}L${P(-0.35, -0.5)}Q${P(-0.5, 0)} ${P(-0.35, 0.5)}Z`, c.cg(D), 2.6);
      b += c.p(`M${P(1.15, 0.9)}C${P(1.3, 0.4)} ${P(1.1, -0.2)} ${P(0.75, -0.6)}L${P(0.3, -0.3)}Q${P(0.4, 0.1)} ${P(0.35, 0.5)}Z`, c.cg(h.shade(D, -0.1)), 2.4);
      b += c.e(x - R * 0.8, t + R * 0.15, R * 0.2, R * 0.14, '#ffe14a', 1.6);
      b += flame(c, x, t + 2, R * 0.9, R * 1.3);
    } else if (o.plain !== false) {
      b += cyl(c, x, t, t + 6, r * 1.12, r * 0.38, c.cg(h.shade(col, 0.1)), null);
      b += c.e(x, t, r * 0.8, r * 0.26, '#2a1610', 2.2);
      b += c.e(x, t + 0.5, r * 0.55, r * 0.17, '#ff8a2a', 0) + c.e(x, t + 0.4, r * 0.28, r * 0.09, '#fff1a8', 0);
    }
    return `<g transform="rotate(${ang} ${x} ${y})">${b}</g>`;
  }
  function sandbag(c, x, y, k = 1) {
    return c.e(x, y, 9 * k, 5.5 * k, c.vg(M.sand, 0.25, -0.25), 2.4) + c.ln(`M${f(x - 3 * k)} ${f(y - 4 * k)}Q${f(x - 1 * k)} ${f(y)} ${f(x - 3 * k)} ${f(y + 4 * k)}`, c.h.shade(M.sand, -0.35), 1.4);
  }
  T.flame_mortar = {
    muzzle: [[70, 58], [72, 50], [80, 42], [20, 22], [50, 22]],
    draw(c, v) {
      const h = c.h;
      const st = STONE.fire;
      if (v === 1) {
        let o = plat(c, 1);
        o += sandbag(c, 26, 92) + sandbag(c, 74, 92);
        o += c.r(34, 84, 32, 18, c.vg(M.wood), 2, 3) + c.ln('M34 92H66', h.shade(M.wood, -0.35), 1.5);
        o += mortarBarrel(c, 50, 88, 36, 14, 32, { bands: [0.45] });
        o += c.p('M40 96L44 80H50L52 96Z', c.cg(M.wood), 2.4) + c.ci(47, 84, 2.4, M.ironL, 1.6);
        o += sandbag(c, 20, 104) + sandbag(c, 37, 109) + sandbag(c, 55, 110) + sandbag(c, 72, 106) + sandbag(c, 84, 99, 0.85);
        o += spark(c, 79, 44, 4, '#ffb347', 1.4);
        return o;
      }
      if (v === 2 || v === 3) {
        const L3 = v === 3;
        let o = plat(c, v, { stone: st });
        if (L3) o += aura(c, 74, 40, 26, 24, '#ff8a3d', 0.55);
        // 둥근 돌 포대
        o += cyl(c, 50, 84, 104, 38, 11.4, c.cg(st), c.vg(h.shade(st, 0.22)));
        o += c.e(50, 84, 31, 9, '#4a3a32', 0);
        // 포탄 더미(달군 쇠)
        o += orb(c, 26, 82, 5.5, '#c8502a', 2.2) + orb(c, 36, 84, 5.5, '#c8502a', 2.2) + orb(c, 31, 77, 5.5, '#e0662e', 2.2);
        o += mortarBarrel(c, 54, 90, L3 ? 44 : 42, 15, 32, L3 ? { bands: [0.3, 0.62], trim: M.gold, dragon: '#b8402a' } : { bands: [0.45] });
        // 앞 테두리
        o += c.p(`M12 84A38 11.4 0 0 0 88 84L81 84A31 9 0 0 1 19 84Z`, c.vg(h.shade(st, 0.18)), 2.6);
        o += c.ln(`${ring(50, 95, 38, 11.4)}${vseam(50, 84, 95, 38, 11.4, -40)}${vseam(50, 84, 95, 38, 11.4, 40)}${vseam(50, 95, 104, 38, 11.4, 0)}${vseam(50, 95, 104, 38, 11.4, -70)}${vseam(50, 95, 104, 38, 11.4, 70)}`, h.shade(st, -0.38), 1.5);
        if (L3) {
          o += band(c, 50, 86, 89.5, 38, 11.4, c.vg(M.gold, 0.35, -0.25));
          o += flag(c, 18, 82, 30, '#e0442a', -1, 14);
        } else {
          o += spark(c, 80, 40, 4.5, '#ffb347', 1.4) + spark(c, 70, 34, 3, '#ffd94a', 0);
        }
        return o;
      }
      if (v === 'A') {
        // 용암 투석기 — 거대한 투석기와 용암 바구니
        let o = plat(c, 4, { stone: '#8a7468', trim: '#e0442a' });
        o += aura(c, 24, 28, 26, 24, '#ff7a2a', 0.6);
        // 차대
        o += c.r(14, 82, 72, 12, c.vg(M.wood), 2, 3) + c.ln('M14 88H86', h.shade(M.wood, -0.35), 1.5);
        // 뒤쪽 A자 틀
        o += c.ol('M40 86L56 46L74 86', h.shade(M.wood, -0.3), 5);
        // 팔(왼쪽 위로) + 평형추
        o += c.ol('M80 72L22 32', M.wood, 6);
        o += c.r(70, 66, 20, 18, c.vg(h.shade(STONE.fire, -0.15)), 2, 3) + c.ln('M70 75H90', OL, 1.5);
        o += c.ol('M80 70L80 66', M.iron, 2);
        // 앞쪽 A자 틀 + 굴대
        o += c.ol('M34 90L54 50L72 90', M.wood, 5) + c.ol('M42 74H64', M.wood, 3.5);
        o += c.ci(55, 48, 5, c.sg(M.ironL), 2.4);
        // 용암 바구니
        o += c.p('M8 28Q8 42 20 43Q32 42 32 28Z', c.vg(M.iron, 0.3, -0.3), 3);
        o += c.ln('M10 34Q20 38 30 34', '#ffb347', 1.5);
        o += c.p('M9 28Q12 16 20 18Q24 12 28 19Q34 20 31 28Z', c.vg('#ffd94a', 0.2, -0.1), 2.4);
        o += c.e(20, 24, 7, 3.5, '#fff1a8', 0) + c.p('M30 32Q34 40 32 46Q30 40 28 36Z', '#ff8a2a', 1.8);
        // 바퀴
        o += c.ci(22, 98, 9, c.sg(M.wood), 3) + c.ci(22, 98, 3, M.iron, 2) + c.ci(78, 98, 9, c.sg(M.wood), 3) + c.ci(78, 98, 3, M.iron, 2);
        return o;
      }
      // 'B' 연발 포대 — 포신 셋이 돌아가는 포대
      let o = plat(c, 4, { stone: '#9a8478', trim: '#e0442a' });
      o += aura(c, 50, 24, 40, 18, '#ff8a3d', 0.45);
      o += cyl(c, 50, 70, 99, 30, 9, c.cg(M.iron), c.vg(h.shade(M.iron, 0.25)));
      o += c.e(50, 70, 23, 6.5, '#2c2430', 0);
      o += mortarBarrel(c, 50, 78, 52, 10, -26, { bands: [0.35, 0.7], trim: M.gold });
      o += mortarBarrel(c, 50, 78, 52, 10, 26, { bands: [0.35, 0.7], trim: M.gold });
      o += mortarBarrel(c, 50, 80, 58, 11, 0, { bands: [0.35, 0.7], trim: M.gold });
      o += c.p('M20 70A30 9 0 0 0 80 70L73 70A23 6.5 0 0 1 27 70Z', c.vg(h.shade(M.iron, 0.3)), 2.4);
      o += band(c, 50, 80, 85, 30, 9, c.vg(M.gold, 0.35, -0.25));
      o += c.ln([-60, -30, 0, 30, 60].map((d) => vseam(50, 88, 96, 30, 9, d)).join(''), h.shade(M.iron, -0.45), 2);
      return o;
    },
  };

  /* ---------- 🔥 대장간 ---------- */
  /* 박공 집: 앞벽 x1~x2, 처마 높이 yw, 꼭대기 ya, 바닥 yb, 지붕 깊이 d */
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
  function anvil(c, x, y, k = 1) {
    return c.p(`M${f(x - 9 * k)} ${f(y - 9 * k)}H${f(x + 10 * k)}Q${f(x + 6 * k)} ${f(y - 5 * k)} ${f(x + 3 * k)} ${f(y - 5 * k)}L${f(x + 5 * k)} ${f(y)}H${f(x - 5 * k)}L${f(x - 3 * k)} ${f(y - 5 * k)}Q${f(x - 7 * k)} ${f(y - 5 * k)} ${f(x - 9 * k)} ${f(y - 9 * k)}Z`, c.vg(M.iron, 0.4, -0.2), 2.4);
  }
  function glowDoor(c, x, yb, w, ht) {
    return c.p(`M${f(x - w / 2)} ${f(yb)}V${f(yb - ht + w / 2)}Q${f(x)} ${f(yb - ht - w * 0.15)} ${f(x + w / 2)} ${f(yb - ht + w / 2)}V${f(yb)}Z`, c.vg('#ffc65a', 0.3, -0.35), 2.6) +
      c.e(x, yb - 3, w * 0.32, 2.5, '#fff1a8', 0, ' opacity="0.9"');
  }
  T.forge = {
    muzzle: [[64, 26], [66, 20], [66, 4], [50, 6], [50, 30]],
    draw(c, v) {
      const h = c.h;
      const st = STONE.fire;
      if (v === 1) {
        let o = plat(c, 1);
        // 굴뚝
        o += c.r(58, 30, 13, 40, c.cg(M.rough), 1, 3) + c.ln('M58 42H71M58 54H71M64 30V42M62 42V54', h.shade(M.rough, -0.4), 1.4);
        o += flame(c, 64.5, 31, 11, 14) + spark(c, 74, 20, 3, '#ffb347', 0) + spark(c, 56, 18, 2.5, '#ffd94a', 0);
        o += house(c, 28, 72, 72, 54, 104, c.vg(M.plank, 0.2, -0.2), '#8a5a34');
        o += c.ln('M39 64V102M50 58V104M61 64V102', h.shade(M.plank, -0.35), 1.4);
        o += glowDoor(c, 50, 104, 16, 22);
        o += anvil(c, 22, 108, 0.9);
        return o;
      }
      if (v === 2 || v === 3) {
        const L3 = v === 3;
        let o = plat(c, v, { stone: st });
        if (L3) o += aura(c, 68, 14, 24, 22, '#ff8a3d', 0.55);
        o += c.r(58, L3 ? 18 : 24, 15, 44, c.cg(h.shade(st, -0.1)), 1, 3) + c.ln(`M58 ${L3 ? 30 : 36}H73M58 48H73M65 ${L3 ? 18 : 24}V${L3 ? 30 : 36}M62 ${L3 ? 30 : 36}V48`, h.shade(st, -0.45), 1.4);
        if (L3) o += c.r(56, 16, 19, 5, c.vg(M.gold, 0.35, -0.3), 1, 2.4);
        o += flame(c, 65.5, L3 ? 17 : 25, L3 ? 15 : 12, L3 ? 22 : 16) + spark(c, 77, L3 ? 6 : 14, 3, '#ffb347', 0) + spark(c, 56, L3 ? 4 : 12, 2.5, '#ffd94a', 0);
        o += house(c, 24, 76, 68, 46, 104, c.vg(st, 0.25, -0.2), '#c8462c', 13);
        o += c.ln('M24 80H76M24 92H76M36 68V80M64 68V80M30 80V92M70 80V92M38 92V104M62 92V104', h.shade(st, -0.38), 1.4);
        o += glowDoor(c, 50, 104, 18, 26);
        o += c.r(28, 70, 9, 9, c.vg('#ffc65a', 0.3, -0.3), 1, 2.2) + c.r(63, 70, 9, 9, c.vg('#ffc65a', 0.3, -0.3), 1, 2.2);
        if (L3) {
          // 금속 모서리 + 망치 간판
          o += c.r(21, 66, 5, 40, c.vg(M.gold, 0.35, -0.25), 1, 2.2) + c.r(74, 66, 5, 40, c.vg(M.gold, 0.35, -0.25), 1, 2.2);
          o += c.ol('M50 46V52', M.iron, 1.6);
          o += c.ci(50, 59, 7.5, c.vg(M.wood, 0.3, -0.2), 2.4) + c.p('M46 55H54V59H51.5V64H48.5V59H46Z', M.iron, 1.4);
          o += flag(c, 15, 104, 34, '#e0442a', -1, 12);
        }
        o += anvil(c, 84, 110, 0.9);
        return o;
      }
      if (v === 'A') {
        // 용광로 — 병 모양 큰 화로, 높은 굴뚝
        const fs = '#8a6a5e';
        let o = plat(c, 4, { stone: '#7a6660', trim: '#e0442a' });
        o += aura(c, 50, 16, 26, 16, '#ff7a2a', 0.65) + aura(c, 50, 92, 30, 16, '#ff9a3d', 0.6);
        o += c.r(42, 18, 16, 32, c.cg(M.iron), 1, 3) + c.r(39, 16, 22, 6, c.vg(M.ironL, 0.3, -0.3), 1, 2.6);
        o += flame(c, 50, 17, 18, 15);
        o += c.p('M50 34C66 34 70 46 78 60C86 74 86 90 82 100Q50 110 18 100C14 90 14 74 22 60C30 46 34 34 50 34Z', c.cg(fs), 3);
        o += c.ln('M27 55Q50 62 73 55M19 76Q50 85 81 76', OL, 4) + c.ln('M27 55Q50 62 73 55M19 76Q50 85 81 76', M.ironL, 2);
        o += c.ln('M34 44Q50 48 66 44', h.shade(fs, -0.4), 1.5);
        o += c.p('M36 104V92Q50 76 64 92V105Z', c.vg('#ffd25a', 0.4, -0.3), 3);
        o += c.e(50, 99, 9, 3.5, '#fff1a8', 0);
        o += c.ci(31, 66, 4, c.sg('#ff8a2a'), 2) + c.ci(69, 66, 4, c.sg('#ff8a2a'), 2);
        return o;
      }
      // 'B' 무기고 — 성가퀴 건물, 방패와 칼, 창 받침
      const ast = '#a89488';
      let o = plat(c, 4, { stone: '#8c7a70', trim: '#e0442a' });
      // 창 받침(뒤)
      o += c.ol('M10 96V26M18 98V34M82 98V34M90 96V26', M.woodD, 2.4);
      o += [[10, 26], [18, 34], [82, 34], [90, 26]].map(([x, y]) => c.p(`M${x} ${y - 9}L${x + 3.5} ${y}H${x - 3.5}Z`, c.vg(M.silver, 0.3, -0.2), 2)).join('');
      // 굴뚝
      o += c.r(64, 22, 11, 24, c.cg(h.shade(ast, -0.15)), 1, 3) + flame(c, 69.5, 23, 10, 13);
      // 본관
      o += c.p('M20 100V48H80V100Q50 108 20 100Z', c.cg(ast), 3);
      o += c.p('M18 50V38H28V44H38V38H48V44H58V38H68V44H78V38H82V50Z', c.cg(h.shade(ast, 0.08)), 3);
      o += band(c, 50, 48, 53, 30, 2, c.vg(M.gold, 0.35, -0.25), 2.4);
      o += c.ln('M20 72H80M20 86H80M32 58V72M68 58V72M26 72V86M74 72V86M30 86V100M70 86V100', h.shade(ast, -0.38), 1.5);
      // 문
      o += c.p('M41 102V88Q50 80 59 88V103Z', c.vg('#5a3a2a', 0.1, -0.3), 2.6) + c.ln('M41 92H59M41 97H59', M.ironL, 1.6);
      // 방패 + 엇갈린 칼
      o += c.ol('M33 56L67 82M67 56L33 82', M.silver, 3);
      o += c.p('M50 54C56 56 60 56 62 55V66C62 74 56 78 50 81C44 78 38 74 38 66V55C40 56 44 56 50 54Z', c.vg('#d8462c', 0.3, -0.25), 2.6);
      o += c.ln('M50 59V76M44 65H56', M.gold, 2);
      return o;
    },
  };

  /* ---------- ❄ 서리 결정탑 ---------- */
  /* 얼음 송곳/가시 — 위 끝 (x,yt), 아래 yb, 너비 w */
  function shard(c, x, yt, yb, w, col, w0 = 2.6) {
    const m = yb - w * 0.35;
    return c.p(poly([[x, yt], [x + w / 2, m], [x, yb], [x - w / 2, m]]), c.vg(col, 0.5, -0.15), w0) +
      c.p(poly([[x, yt], [x + w / 2, m], [x, yb]]), c.h.shade(col, -0.2), 0, ' opacity="0.7"') +
      c.ln(`M${f(x - w * 0.18)} ${f(m - 2)}L${f(x - 1)} ${f(yt + 6)}`, '#fff', 1.4, 0.8);
  }
  /* 발톱 받침 */
  const claws = (c, y, sp, ht, col) => c.ol(`M${50 - sp} ${y}Q${50 - sp - 6} ${y - ht * 0.5} ${50 - sp + 2} ${y - ht}M${50 + sp} ${y}Q${50 + sp + 6} ${y - ht * 0.5} ${50 + sp - 2} ${y - ht}`, col, 3.4);
  T.frost_crystal = {
    muzzle: [[50, 44], [50, 38], [50, 34], [50, 6], [80, 24]],
    draw(c, v) {
      const h = c.h;
      const E = c.E;
      const st = STONE.frost;
      if (v === 1) {
        let o = plat(c, 1);
        o += frus(c, 50, 76, 104, 11, 17, c.cg(M.rough), c.vg(h.shade(M.rough, 0.2)));
        o += c.ln('M44 82L47 90L44 96M56 84L54 92', h.shade(M.rough, -0.4), 1.5);
        o += aura(c, 50, 48, 22, 24, E.color, 0.55);
        o += c.e(50, 74, 9, 2.6, h.shade(E.color, 0.4), 0, ' opacity="0.8"');
        o += crystal(c, 50, 46, 24, 42, E.color);
        return o;
      }
      if (v === 2 || v === 3) {
        const L3 = v === 3;
        let o = plat(c, v, { stone: st, trim: M.silver });
        o += aura(c, 50, 38, L3 ? 34 : 26, L3 ? 34 : 28, E.color, L3 ? 0.6 : 0.45);
        if (L3) o += c.e(50, 42, 38, 11, 'none', 0, ` stroke="${E.light}" stroke-width="${c.sw(2)}" opacity="0.8"`);
        o += frus(c, 50, 72, 104, 12, 18, c.cg(st), null);
        o += c.ln(`${ring(50, 84, 14.5, 4.3)}${ring(50, 95, 16.5, 5)}M47 74V84M53 86V95M46 97V105`, h.shade(st, -0.38), 1.5);
        if (L3) o += band(c, 50, 88, 92, 16, 4.8, c.vg(M.silver, 0.35, -0.25));
        o += cyl(c, 50, 66, 73, 16, 4.8, c.cg(L3 ? M.silver : h.shade(st, 0.1)), c.vg(h.shade(st, 0.25)));
        o += claws(c, 68, 12, 18, L3 ? M.silver : h.shade(st, 0.05));
        o += crystal(c, 50, L3 ? 36 : 40, L3 ? 30 : 26, L3 ? 54 : 46, E.color);
        o += crystal(c, 78, L3 ? 36 : 44, 9, 15, E.light, 2.2);
        if (L3) o += crystal(c, 18, 44, 8, 14, E.light, 2.2) + crystal(c, 70, 56, 7, 12, E.color, 2);
        return o;
      }
      if (v === 'A') {
        // 빙결 첨탑 — 뾰족한 얼음 첨탑
        let o = plat(c, 4, { stone: '#8ea2b6' });
        o += aura(c, 50, 30, 30, 34, E.color, 0.55);
        o += shard(c, 28, 44, 98, 18, E.light) + shard(c, 73, 34, 98, 20, E.light);
        o += shard(c, 50, 2, 100, 30, E.color, 3);
        o += shard(c, 36, 70, 104, 13, E.color) + shard(c, 63, 66, 104, 14, E.color);
        o += c.p('M22 100Q30 92 40 99Q50 94 60 99Q70 92 78 100Q50 110 22 100Z', c.vg('#ffffff', 0, -0.15), 2.4);
        o += spark(c, 44, 22, 4) + spark(c, 62, 48, 3);
        return o;
      }
      // 'B' 얼음 송곳탑 — 고드름 다발을 장전한 결정 포대
      let o = plat(c, 4, { stone: '#9aaec2', trim: M.silver });
      o += aura(c, 70, 34, 30, 28, E.color, 0.5);
      o += cyl(c, 50, 76, 99, 27, 8, c.cg(STONE.frost), c.vg(h.shade(STONE.frost, 0.25)));
      o += band(c, 50, 86, 90, 27, 8, c.vg(M.silver, 0.35, -0.25));
      o += c.ol('M34 78L40 58M66 78L60 58', M.silver, 4);
      let g = '';
      g += shard(c, 43, 26, 80, 11, E.light) + shard(c, 57, 22, 80, 11, E.light);
      g += shard(c, 36, 32, 84, 12, E.color) + shard(c, 50, 14, 84, 14, E.color, 3) + shard(c, 64, 30, 84, 12, E.color);
      g += c.r(30, 62, 40, 7, c.vg(M.silver, 0.35, -0.3), 2, 2.4) + c.ci(50, 65.5, 3, E.light, 1.8);
      o += `<g transform="rotate(30 50 74)">${g}</g>`;
      o += crystal(c, 50, 80, 14, 18, E.color, 2.4);
      return o;
    },
  };

  /* ---------- ❄ 빙창 투척기 ---------- */
  T.ice_ballista = {
    muzzle: [[50, 22], [50, 14], [50, 10], [50, 2], [50, 22]],
    draw(c, v) {
      const h = c.h;
      const E = c.E;
      const st = STONE.frost;
      const spear = (y1, y2, hw, hh) => c.ol(`M50 ${y1}V${y2}`, '#e6f6ff', 3.2) + crystal(c, 50, y2 - hh * 0.3, hw, hh, E.color);
      if (v === 1) {
        let o = plat(c, 1);
        o += c.ol('M30 106L48 76M70 106L52 76', M.wood, 4.5) + c.ol('M50 100V78', h.shade(M.wood, -0.25), 4.5);
        o += c.r(45, 50, 10, 40, c.cg(M.wood), 2, 2.6);
        o += c.ln('M12 68L50 84L88 68', '#f4ead8', 1.6);
        o += c.ol('M12 68Q28 46 50 55Q72 46 88 68', M.wood, 4.6);
        o += spear(84, 40, 13, 24);
        return o;
      }
      if (v === 2 || v === 3) {
        const L3 = v === 3;
        let o = plat(c, v, { stone: st, trim: M.silver });
        if (L3) o += aura(c, 50, 24, 20, 22, E.color, 0.6);
        o += cyl(c, 50, 84, 104, 22, 6.6, c.cg(st), c.vg(h.shade(st, 0.25)));
        o += c.ln(`${ring(50, 94, 22, 6.6)}${vseam(50, 84, 94, 22, 6.6, -40)}${vseam(50, 84, 94, 22, 6.6, 20)}${vseam(50, 94, 104, 22, 6.6, -10)}${vseam(50, 94, 104, 22, 6.6, 50)}`, h.shade(st, -0.38), 1.5);
        if (L3) o += band(c, 50, 86, 89.5, 22, 6.6, c.vg(M.silver, 0.35, -0.25));
        o += c.p('M34 86V74Q50 82 66 74V86Q50 92 34 86Z', c.vg(M.iron, 0.35, -0.25), 2.6);
        o += c.r(44.5, 44, 11, 46, c.cg(M.wood), 2, 2.6) + c.ln('M44.5 58H55.5M44.5 74H55.5', M.ironL, 2.4);
        o += c.ln('M8 64L50 84L92 64', '#f4ead8', 1.6);
        const bc = L3 ? M.silver : M.wood;
        o += c.ol('M8 64Q26 38 50 48Q74 38 92 64', bc, 5.5);
        o += c.ol('M18 52Q34 40 50 46Q66 40 82 52', L3 ? M.gold : M.iron, 1.8);
        o += crystal(c, 9, 60, 9, 14, E.light, 2.2) + crystal(c, 91, 60, 9, 14, E.light, 2.2);
        o += spear(84, 32, 15, 28);
        o += c.ci(68, 88, 7, c.sg(L3 ? M.gold : M.iron), 2.4) + c.ln('M68 82V94M62 88H74', OL, 1.6);
        if (L3) o += flag(c, 22, 92, 30, E.color, -1, 12);
        return o;
      }
      if (v === 'A') {
        // 빙창 사수 — 높은 발사대, 겹활, 송곳 창
        let o = plat(c, 4, { stone: '#8ea2b6', trim: M.silver });
        o += aura(c, 50, 14, 18, 18, E.color, 0.6);
        o += cyl(c, 50, 82, 99, 20, 6, c.cg(STONE.frost), c.vg(h.shade(STONE.frost, 0.25)));
        o += c.ol('M40 84L44 26M60 84L56 26', M.silver, 4) + c.ol('M42 60H58M43 42H57', M.silver, 2.4);
        o += c.ln('M14 66L50 80L86 66M20 46L50 58L80 46', '#f4ead8', 1.4);
        o += c.ol('M14 66Q30 50 50 56Q70 50 86 66', M.silver, 4.5) + c.ol('M20 46Q34 32 50 38Q66 32 80 46', M.silver, 4);
        o += c.ol('M50 82V20', '#e6f6ff', 3.4);
        // 송곳(나선) 머리
        o += c.p('M50 0L58 22H42Z', c.vg(E.color, 0.5, -0.2), 2.6) + c.ln('M45 18L56 14M47 11L54 8', E.dark, 1.6);
        o += crystal(c, 14, 64, 8, 12, E.light, 2) + crystal(c, 86, 64, 8, 12, E.light, 2);
        return o;
      }
      // 'B' 빙하 파쇄기 — 아주 넓은 두 겹 활, 뭉툭한 얼음 덩이 머리
      let o = plat(c, 4, { stone: '#9aaec2', trim: M.silver });
      o += aura(c, 50, 30, 30, 18, E.color, 0.55);
      o += cyl(c, 50, 80, 99, 30, 9, c.cg(STONE.frost), c.vg(h.shade(STONE.frost, 0.25)));
      o += crystal(c, 24, 86, 12, 18, E.light, 2.2) + crystal(c, 76, 86, 12, 18, E.light, 2.2);
      o += c.r(43, 42, 14, 46, c.cg(M.iron), 2, 2.8) + c.ln('M43 56H57M43 72H57', M.silver, 2.4);
      o += c.ln('M7 64L50 82L93 64', '#f4ead8', 1.6);
      o += c.ol('M7 64Q22 34 50 46Q78 34 93 64', M.iron, 6.5) + c.ol('M12 58Q26 36 50 44Q74 36 88 58', M.silver, 2.4);
      o += c.ol('M50 82V40', '#e6f6ff', 3.6);
      o += crystal(c, 40, 32, 14, 20, E.light, 2.4) + crystal(c, 60, 32, 14, 20, E.light, 2.4) + crystal(c, 50, 26, 20, 30, E.color, 3);
      return o;
    },
  };

  /* ---------- ❄ 겨울 종 ---------- */
  /* 종 — 꼭대기 (x,y), 너비 w, 높이 ht */
  function bell(c, x, y, w, ht, col, rim = true) {
    const P = (px, py) => `${f(x + px * w)} ${f(y + py * ht)}`;
    let o = c.ol(`M${P(-0.08, 0.08)}Q${P(0, -0.1)} ${P(0.08, 0.08)}`, c.h.shade(col, -0.2), 2.4);
    o += c.p(`M${P(-0.27, 0.16)}C${P(-0.28, -0.02)} ${P(0.28, -0.02)} ${P(0.27, 0.16)}C${P(0.3, 0.5)} ${P(0.38, 0.74)} ${P(0.5, 0.88)}Q${P(0.52, 1)} ${P(0, 1)}Q${P(-0.52, 1)} ${P(-0.5, 0.88)}C${P(-0.38, 0.74)} ${P(-0.3, 0.5)} ${P(-0.27, 0.16)}Z`, c.cg(col), 3);
    if (w >= 15) o += c.ln(`M${P(-0.36, 0.7)}Q${P(0, 0.8)} ${P(0.36, 0.7)}`, c.h.shade(col, -0.35), 1.8);
    if (rim) o += c.e(x, y + ht * 0.93, w * 0.42, w * 0.08, c.h.shade(col, -0.45), 0) + c.ci(x, y + ht * 0.97, w * 0.08, c.sg(M.silver), 2);
    if (w >= 15) o += c.ln(`M${P(-0.16, 0.2)}Q${P(-0.2, 0.5)} ${P(-0.3, 0.76)}`, '#fff', 2, 0.7);
    return o;
  }
  /* 고드름 줄 */
  function icicles(c, x1, x2, y, n, len, col) {
    let d = '';
    const step = (x2 - x1) / n;
    for (let i = 0; i < n; i++) {
      const a = x1 + i * step + step * 0.15;
      const L = len * (i % 2 ? 0.65 : 1);
      d += `M${f(a)} ${f(y)}L${f(a + step * 0.35)} ${f(y + L)}L${f(a + step * 0.7)} ${f(y)}Z`;
    }
    return c.p(d, c.vg(col, 0.4, -0.1), 1.8);
  }
  /* 눈 덮인 박공 지붕 */
  function snowRoof(c, x1, x2, ya, yb, col) {
    const cx = (x1 + x2) / 2;
    return c.p(`M${x1} ${yb}L${cx} ${ya}L${x2} ${yb}Q${cx} ${yb + 6} ${x1} ${yb}Z`, c.vg(col, 0.2, -0.25), 3) +
      c.p(`M${f(x1 + (cx - x1) * 0.3)} ${f(yb - (yb - ya) * 0.3)}L${cx} ${ya}L${f(x2 - (x2 - cx) * 0.3)} ${f(yb - (yb - ya) * 0.3)}Q${f(cx + 8)} ${f(ya + (yb - ya) * 0.45)} ${f(cx + 3)} ${f(ya + (yb - ya) * 0.38)}Q${f(cx - 4)} ${f(ya + (yb - ya) * 0.55)} ${f(cx - 9)} ${f(ya + (yb - ya) * 0.42)}Z`, '#f6fbff', 2.2);
  }
  T.winter_bell = {
    muzzle: [[50, 64], [50, 66], [50, 66], [50, 66], [50, 60]],
    draw(c, v) {
      const h = c.h;
      const E = c.E;
      const st = STONE.frost;
      if (v === 1) {
        let o = plat(c, 1);
        o += c.ol('M28 106V40M72 106V40', M.wood, 5.5) + c.ol('M30 92L44 104M70 92L56 104', M.wood, 3);
        o += c.r(20, 36, 60, 8, c.vg(M.plank), 2, 2.8);
        o += c.p('M18 37L50 24L82 37Z', c.vg('#8a5a34', 0.2, -0.2), 2.8) + c.p('M30 32L50 24L70 32Q50 30 30 32Z', '#f6fbff', 0);
        o += c.ol('M50 44V48', M.rope, 2);
        o += bell(c, 50, 47, 32, 36, E.color);
        return o;
      }
      if (v === 2 || v === 3) {
        const L3 = v === 3;
        let o = plat(c, v, { stone: st, trim: M.silver });
        if (L3) o += aura(c, 50, 70, 34, 30, E.color, 0.5) + c.e(50, 96, 34, 9, 'none', 0, ` stroke="${E.light}" stroke-width="${c.sw(2.4)}" opacity="0.8"`);
        o += c.r(20, 44, 13, 62, c.cg(st), 2, 3) + c.r(67, 44, 13, 62, c.cg(st), 2, 3);
        o += c.ln('M20 60H33M20 76H33M20 92H33M67 60H80M67 76H80M67 92H80M26 44V60M73 60V76M26 76V92', h.shade(st, -0.38), 1.5);
        if (L3) o += c.r(18, 70, 17, 5, c.vg(M.silver, 0.35, -0.25), 1, 2.2) + c.r(65, 70, 17, 5, c.vg(M.silver, 0.35, -0.25), 1, 2.2);
        o += c.r(16, 38, 68, 10, c.vg(h.shade(st, 0.1)), 2, 3);
        o += c.ol('M50 48V52', M.silver, 2);
        o += bell(c, 50, 51, 34, 40, E.color);
        o += snowRoof(c, 12, 88, L3 ? 10 : 14, 40, '#6f8fb0');
        if (L3) {
          o += icicles(c, 14, 86, 44, 9, 9, E.light);
          o += crystal(c, 50, 4, 10, 16, E.color, 2.2);
        }
        return o;
      }
      if (v === 'A') {
        // 정적의 종 — 두꺼운 얼음 아치 안의 커다란 종, 고요히 얼어 있음
        let o = plat(c, 4, { stone: '#8ea2b6', trim: M.silver });
        o += aura(c, 50, 64, 44, 40, E.light, 0.45);
        o += c.p('M10 100V48C10 18 28 4 50 4C72 4 90 18 90 48V100H76V50C76 30 66 18 50 18C34 18 24 30 24 50V100Z', c.vg(E.light, 0.35, -0.2), 3);
        o += c.ln('M10 70H24M76 70H90M12 40L25 44M88 40L75 44M30 12L36 22M70 12L64 22M50 4V18', h.shade(E.color, -0.1), 1.6);
        o += c.ol('M50 18V24', M.silver, 2.4);
        o += bell(c, 50, 22, 56, 66, h.mix(E.color, '#ffffff', 0.25));
        o += icicles(c, 28, 72, 82, 8, 7, '#ffffff');
        return o;
      }
      // 'B' 서리 장막 — 3층 탑, 층마다 작은 종, 고드름 장막
      let o = plat(c, 4, { stone: '#9aaec2', trim: M.silver });
      o += aura(c, 50, 56, 42, 44, E.color, 0.4);
      o += c.r(42, 20, 16, 50, c.cg(STONE.frost), 1, 3);
      o += c.r(30, 64, 40, 38, c.cg(STONE.frost), 2, 3) + c.p('M38 102V82Q50 68 62 82V102Z', c.vg(E.dark, 0.1, -0.3), 2.6);
      o += bell(c, 50, 76, 20, 24, E.color);
      o += snowRoof(c, 26, 74, 6, 26, '#6f8fb0');
      o += snowRoof(c, 18, 82, 26, 46, '#6f8fb0');
      o += snowRoof(c, 8, 92, 46, 68, '#6f8fb0') + icicles(c, 12, 88, 71, 7, 9, E.light);
      o += bell(c, 12, 70, 12, 14, E.color, false) + bell(c, 88, 70, 12, 14, E.color, false);
      o += crystal(c, 50, 7, 9, 12, E.color, 2.2);
      return o;
    },
  };

  /* ---------- ⚡ 번개 막대 ---------- */
  const COPPER = '#d0803e';
  /* 코일: 기둥(x)을 감는 앞쪽 고리들 */
  function coil(c, x, y1, y2, rx, n, col = COPPER, w = 2.6) {
    const step = (y2 - y1) / n;
    let d = '';
    for (let i = 0; i < n; i++) {
      const y = y1 + i * step;
      d += `M${f(x - rx)} ${f(y)}Q${f(x)} ${f(y + step * 1.6)} ${f(x + rx)} ${f(y + step * 0.5)}`;
    }
    return c.ol(d, col, w);
  }
  /* 지그재그 전기 줄기 */
  function zap(c, pts, col, w = 2) {
    const d = `M${pts.map((p) => `${f(p[0])} ${f(p[1])}`).join('L')}`;
    return c.ln(d, col, w + 2.4, 0.45) + c.ln(d, '#ffffff', w * 0.6) ;
  }
  T.lightning_rod = {
    muzzle: [[50, 14], [50, 12], [50, 8], [50, 6], [50, 18]],
    draw(c, v) {
      const h = c.h;
      const E = c.E;
      const st = STONE.storm;
      if (v === 1) {
        let o = plat(c, 1);
        o += c.ol('M36 104L46 88M64 104L54 88', M.wood, 3.4);
        o += c.r(44, 38, 12, 68, c.cg(M.wood), 2, 3);
        o += coil(c, 50, 52, 80, 9, 5);
        o += c.ol('M50 38V20', M.ironL, 2.6) + c.ci(50, 18, 4, c.sg(COPPER), 2.2);
        o += aura(c, 50, 16, 16, 14, E.color, 0.7) + spark(c, 50, 16, 9, E.light, 2) + spark(c, 50, 16, 4, '#fff', 0);
        return o;
      }
      if (v === 2 || v === 3) {
        const L3 = v === 3;
        let o = plat(c, v, { stone: st });
        if (L3) o += aura(c, 50, 14, 24, 22, E.color, 0.65);
        o += frus(c, 50, 72, 104, 12, 18, c.cg(st), c.vg(h.shade(st, 0.25)));
        o += c.ln(`${ring(50, 84, 14.5, 4.3)}${ring(50, 95, 16.5, 5)}M46 74V84M54 86V95M47 97V105`, h.shade(st, -0.38), 1.5);
        if (L3) o += band(c, 50, 88, 92, 16, 4.8, c.vg(M.gold, 0.35, -0.25));
        o += c.r(45.5, L3 ? 22 : 26, 9, 50, c.cg(M.iron), 2, 2.8);
        o += c.ol('M28 46H72', M.iron, 3);
        o += [30, 70].map((x) => c.e(x, 40, 5, 2, c.vg(E.light), 2) + c.e(x, 44, 5, 2, c.vg(E.light), 2)).join('');
        o += coil(c, 50, L3 ? 50 : 52, 70, L3 ? 10 : 8.5, L3 ? 6 : 5);
        if (L3) {
          o += c.ol('M43 22Q40 14 45 8M57 22Q60 14 55 8', M.gold, 2.4);
          o += orb(c, 50, 14, 7.5, E.color, 2.6) + spark(c, 50, 14, 4, '#fff', 0);
          o += zap(c, [[62, 10], [68, 14], [66, 18], [74, 22]], E.color) + zap(c, [[38, 12], [33, 8], [34, 4]], E.color);
        } else {
          o += c.ol('M50 26V18', M.ironL, 2.4) + c.ci(50, 16, 4.2, c.sg(COPPER), 2.2);
          o += aura(c, 50, 14, 14, 12, E.color, 0.7) + spark(c, 50, 14, 8, E.light, 2) + spark(c, 30, 36, 3, E.light, 0) + spark(c, 70, 36, 3, E.light, 0);
        }
        return o;
      }
      if (v === 'A') {
        // 폭풍 첨탑 — 세 갈래 왕관, 사이를 잇는 번개
        let o = plat(c, 4, { stone: '#85839c' });
        o += aura(c, 50, 22, 42, 22, E.color, 0.55);
        o += frus(c, 50, 64, 99, 13, 21, c.cg(STONE.storm), c.vg(h.shade(STONE.storm, 0.25)));
        o += band(c, 50, 80, 84, 17, 5, c.vg(M.gold, 0.35, -0.25));
        o += c.ol('M46 64Q30 50 20 22M54 64Q70 50 80 22', M.iron, 3.6);
        o += c.r(46, 12, 8, 54, c.cg(M.iron), 2, 2.8);
        o += coil(c, 50, 30, 60, 9, 6);
        o += orb(c, 20, 18, 6, E.color, 2.4) + orb(c, 80, 18, 6, E.color, 2.4) + orb(c, 50, 9, 6.5, E.color, 2.4);
        o += zap(c, [[25, 17], [32, 12], [36, 17], [44, 10]], E.light) + zap(c, [[56, 10], [63, 16], [67, 11], [75, 17]], E.light);
        o += zap(c, [[22, 26], [26, 34], [22, 40]], E.light) + zap(c, [[78, 26], [74, 34], [79, 41]], E.light);
        return o;
      }
      // 'B' 뇌격탑 — 굵은 기둥, 고리, 커다란 구
      let o = plat(c, 4, { stone: '#85839c' });
      o += aura(c, 50, 22, 32, 28, E.color, 0.65);
      o += frus(c, 50, 42, 99, 14, 24, c.cg(M.iron), null);
      o += coil(c, 50, 54, 90, 18, 6, COPPER, 3.4);
      o += c.e(50, 42, 24, 7.5, c.vg(h.shade(COPPER, 0.1)), 3) + c.e(50, 41, 15, 4.2, h.shade(COPPER, -0.45), 0);
      o += c.p('M44 40V34H56V40Z', M.iron, 2.4);
      o += orb(c, 50, 20, 16, E.color, 3);
      o += bolt(c, 46, 9, 0.9, '#fff', 1.6);
      o += zap(c, [[34, 22], [24, 28], [28, 34], [18, 42]], E.light) + zap(c, [[66, 18], [76, 24], [72, 30], [84, 36]], E.light);
      return o;
    },
  };

  /* ---------- ⚡ 바람 포탑 ---------- */
  /* 풍차 날개 — 중심 (x,y), 반지름 R, 날개 n개, 시작 각 rot */
  function rotor(c, x, y, R, sail, n = 4, rot = 45, trim = null) {
    let o = '';
    for (let i = 0; i < n; i++) {
      const a = ((rot + (i * 360) / n) * Math.PI) / 180;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const px = -sa;
      const py = ca;
      const P = (r, s) => [x + ca * r + px * s, y + sa * r + py * s];
      o += c.p(poly([P(R * 0.22, 1), P(R, 1.5), P(R, R * 0.3), P(R * 0.3, R * 0.2)]), c.vg(sail, 0.35, -0.15), 2.4);
      if (trim) o += c.ln(`M${poly([P(R * 0.95, 2), P(R * 0.95, R * 0.28)]).slice(1, -1)}`, trim, 2);
      o += c.ol(`M${f(x)} ${f(y)}L${f(P(R * 1.02, 0)[0])} ${f(P(R * 1.02, 0)[1])}`, M.woodD, 2);
    }
    return o + c.ci(x, y, R * 0.13 + 2, c.sg(M.bronze), 2.4);
  }
  /* 나팔 포신 — (x,y)에서 오른쪽으로 길이 L, 기울기 ang */
  function hornBarrel(c, x, y, L, r, ang, col) {
    const b = c.p(`M${x} ${y - r}L${x + L * 0.75} ${y - r * 0.8}Q${x + L * 0.9} ${y - r * 0.8} ${x + L} ${y - r * 1.7}V${y + r * 1.7}Q${x + L * 0.9} ${y + r * 0.8} ${x + L * 0.75} ${y + r * 0.8}L${x} ${y + r}Z`, c.vg(col, 0.4, -0.3), 3) +
      c.e(x + L, y, r * 0.55, r * 1.7, c.h.shade(col, -0.5), 2.4) + c.e(x + L, y, r * 0.3, r * 1.1, c.E.light, 0, ' opacity="0.7"') +
      c.ln(`M${x + L * 0.25} ${y - r}V${y + r}M${x + L * 0.55} ${y - r * 0.9}V${y + r * 0.9}`, c.h.shade(col, -0.4), 1.8);
    return `<g transform="rotate(${ang} ${x} ${y})">${b}</g>`;
  }
  T.gale_cannon = {
    muzzle: [[80, 70], [84, 66], [86, 62], [50, 4], [50, 6]],
    draw(c, v) {
      const h = c.h;
      const E = c.E;
      const st = STONE.storm;
      const sail = h.mix(E.light, '#ffffff', 0.3);
      if (v === 1) {
        let o = plat(c, 1);
        o += c.ol('M40 84V48', M.woodD, 3.4);
        o += rotor(c, 40, 46, 26, sail);
        o += frus(c, 46, 80, 104, 14, 18, c.cg(M.wood), c.vg(M.plank));
        o += c.ln('M40 84V108M52 84V108', h.shade(M.wood, -0.35), 1.4);
        o += hornBarrel(c, 44, 80, 34, 6, -14, M.bronze);
        return o;
      }
      if (v === 2 || v === 3) {
        const L3 = v === 3;
        let o = plat(c, v, { stone: st });
        if (L3) o += aura(c, 86, 62, 16, 16, E.color, 0.6);
        o += c.ol('M38 80V40', M.iron, 3.6);
        o += rotor(c, 38, 38, L3 ? 34 : 30, sail, 4, 45, L3 ? E.color : null);
        o += cyl(c, 46, 76, 104, 20, 6, c.cg(st), c.vg(h.shade(st, 0.25)));
        o += c.ln(`${ring(46, 88, 20, 6)}${vseam(46, 76, 88, 20, 6, -30)}${vseam(46, 76, 88, 20, 6, 30)}${vseam(46, 88, 104, 20, 6, 0)}`, h.shade(st, -0.38), 1.5);
        if (L3) o += band(c, 46, 79, 82.5, 20, 6, c.vg(M.gold, 0.35, -0.25));
        o += hornBarrel(c, 46, 74, 40, 7, -14, L3 ? M.gold : M.bronze);
        if (L3) o += c.ln('M88 50Q96 56 90 64M92 44Q102 54 96 68', E.light, 2.4, 0.9);
        return o;
      }
      if (v === 'A') {
        // 회오리 탑 — 꼭대기에 회오리 깔때기
        let o = plat(c, 4, { stone: '#85839c' });
        o += aura(c, 50, 30, 42, 32, E.color, 0.45);
        o += frus(c, 50, 58, 99, 15, 22, c.cg(STONE.storm), null);
        o += c.ln(`${ring(50, 72, 17, 5)}${ring(50, 86, 19.5, 5.8)}M45 61V71M56 74V85M44 89V98`, h.shade(STONE.storm, -0.38), 1.5);
        o += band(c, 50, 64, 67, 16, 4.8, c.vg(M.gold, 0.35, -0.25));
        o += c.e(50, 58, 15, 4.5, c.vg(h.shade(STONE.storm, 0.2)));
        o += c.p('M44 58C40 46 30 30 12 8Q50 0 88 8C70 30 60 46 56 58Q50 61 44 58Z', c.vg(E.light, 0.4, -0.05), 3, ' opacity="0.95"');
        o += c.ln('M16 12Q50 20 84 12M24 24Q50 31 74 22M33 36Q50 42 66 35M40 47Q50 51 60 46', E.color, 2.6);
        o += c.ln('M30 16Q46 22 62 18M38 30Q50 34 58 30', '#fff', 1.8, 0.9);
        o += c.r(16, 40, 6, 4, M.woodD, 1, 1.6) + c.r(78, 30, 5, 5, M.rough, 1, 1.6);
        return o;
      }
      // 'B' 하늘 사냥꾼 — 하늘을 향한 쌍포신과 날개
      let o = plat(c, 4, { stone: '#85839c' });
      o += aura(c, 50, 14, 22, 18, E.color, 0.55);
      o += c.p('M44 70C30 64 14 50 6 26C20 34 30 38 40 44Z', c.vg(sail, 0.3, -0.15), 3) + c.p('M56 70C70 64 86 50 94 26C80 34 70 38 60 44Z', c.vg(sail, 0.3, -0.15), 3);
      o += c.ln('M40 60C28 54 18 44 12 34M60 60C72 54 82 44 88 34', E.color, 2);
      o += cyl(c, 50, 74, 99, 24, 7, c.cg(STONE.storm), c.vg(h.shade(STONE.storm, 0.25)));
      o += band(c, 50, 84, 88, 24, 7, c.vg(M.gold, 0.35, -0.25));
      o += c.p('M34 76Q34 58 50 56Q66 58 66 76Q50 82 34 76Z', c.vg(M.iron, 0.35, -0.25), 3);
      o += cyl(c, 43, 10, 64, 6, 2, c.cg(M.bronze), null) + cyl(c, 57, 10, 64, 6, 2, c.cg(M.bronze), null);
      o += c.e(43, 10, 6, 2.2, h.shade(M.bronze, -0.5), 2.4) + c.e(57, 10, 6, 2.2, h.shade(M.bronze, -0.5), 2.4);
      o += c.r(36, 28, 28, 6, c.vg(M.gold, 0.35, -0.3), 2, 2.4) + c.r(36, 48, 28, 6, c.vg(M.gold, 0.35, -0.3), 2, 2.4);
      o += c.ci(50, 68, 5, c.sg(E.color), 2.2);
      return o;
    },
  };

  /* ---------- ⚡ 축전기 ---------- */
  /* 유리관 — 가운데 x, 위 y1, 아래 y2, 반지름 r */
  function tube(c, x, y1, y2, r, col, k = 1) {
    const h = c.h;
    let o = cyl(c, x, y1, y2, r, r * 0.3, h.mix(c.E.light, '#ffffff', 0.4), null, 0);
    o = `<g opacity="0.55">${o}</g>`;
    const m = (y1 + y2) / 2;
    const L = y2 - y1;
    o += c.ln(`M${f(x - 1)} ${f(y1 + 2)}L${f(x + r * 0.5)} ${f(y1 + L * 0.3)}L${f(x - r * 0.5)} ${f(m)}L${f(x + r * 0.4)} ${f(y1 + L * 0.72)}L${f(x)} ${f(y2 - 2)}`, col, 4.4 * k, 0.55);
    o += c.ln(`M${f(x - 1)} ${f(y1 + 2)}L${f(x + r * 0.5)} ${f(y1 + L * 0.3)}L${f(x - r * 0.5)} ${f(m)}L${f(x + r * 0.4)} ${f(y1 + L * 0.72)}L${f(x)} ${f(y2 - 2)}`, '#fff', 1.6 * k);
    o += c.p(`M${f(x - r)} ${f(y1)}V${f(y2)}A${f(r)} ${f(r * 0.3)} 0 0 0 ${f(x + r)} ${f(y2)}V${f(y1)}`, 'none', 2.8);
    o += c.ln(`M${f(x - r * 0.6)} ${f(y1 + 3)}V${f(y2 - 3)}`, '#fff', 2, 0.6);
    return o;
  }
  const cap = (c, x, y, r, col = M.bronze) => cyl(c, x, y - 3, y + 3, r, r * 0.3, c.cg(col), c.vg(c.h.shade(col, 0.2)));
  T.dynamo = {
    muzzle: [[50, 48], [50, 22], [50, 22], [50, 24], [50, 16]],
    draw(c, v) {
      const h = c.h;
      const E = c.E;
      const st = STONE.storm;
      if (v === 1) {
        let o = plat(c, 1);
        o += c.ol('M26 106V40M74 106V40', M.wood, 5) + c.r(20, 36, 60, 7, c.vg(M.plank), 2, 2.6);
        o += aura(c, 50, 78, 24, 26, E.color, 0.55);
        o += c.ol('M50 50V43', COPPER, 2);
        o += tube(c, 50, 62, 100, 16, E.color, 0.9);
        o += cap(c, 50, 61, 17) + c.ol('M50 58V52', COPPER, 2) + c.ci(50, 50, 4, c.sg(COPPER), 2);
        return o;
      }
      if (v === 2 || v === 3) {
        const L3 = v === 3;
        let o = plat(c, v, { stone: st });
        o += aura(c, 50, 62, L3 ? 30 : 22, L3 ? 40 : 34, E.color, L3 ? 0.65 : 0.5);
        o += cyl(c, 50, 90, 104, 24, 7, c.cg(st), c.vg(h.shade(st, 0.25)));
        if (L3) o += band(c, 50, 93, 97, 24, 7, c.vg(M.gold, 0.35, -0.25));
        else o += c.ln(`${vseam(50, 90, 104, 24, 7, -30)}${vseam(50, 90, 104, 24, 7, 30)}`, h.shade(st, -0.38), 1.5);
        const side = L3 ? (x) => cap(c, x, 90, 7) + tube(c, x, 62, 88, 6, E.color, 0.6) + cap(c, x, 62, 7) + c.ol(`M${x} 59V54`, COPPER, 1.8) + c.ci(x, 53, 2.6, c.sg(COPPER), 1.8)
          : (x) => cyl(c, x, 66, 90, 6, 1.8, c.cg(M.iron), c.vg(M.ironL)) + coil(c, x, 68, 88, 6, 5, COPPER, 2);
        o += side(25) + side(75);
        if (L3) o += c.ol('M31 70H40M60 70H69', COPPER, 2);
        o += cap(c, 50, 88, 15) + tube(c, 50, 38, 86, 12, E.color) + cap(c, 50, 37, 15);
        o += c.ol('M50 34V26', COPPER, 2.2) + c.ci(50, 24, 4.2, c.sg(COPPER), 2.2);
        if (L3) o += spark(c, 50, 24, 8, E.light, 1.8) + spark(c, 50, 24, 3, '#fff', 0);
        return o;
      }
      if (v === 'A') {
        // 과충전 코일 — 겹겹이 쌓인 구리 원반, 빛나는 핵
        let o = plat(c, 4, { stone: '#85839c' });
        o += aura(c, 50, 30, 30, 30, E.color, 0.65);
        o += c.r(45, 36, 10, 60, c.cg(M.iron), 1, 2.6);
        [[88, 34], [72, 28], [57, 22], [43, 16]].forEach(([y, r]) => { o += cyl(c, 50, y - 3, y + 3, r, r * 0.3, c.cg(COPPER), c.vg(h.shade(COPPER, 0.25))) + c.e(50, y - 3, r * 0.6, r * 0.18, 'none', 0, ` stroke="${h.shade(COPPER, -0.35)}" stroke-width="${c.sw(1.5)}"`); });
        o += orb(c, 50, 26, 10, E.color, 2.8) + spark(c, 50, 26, 5, '#fff', 0);
        o += zap(c, [[60, 22], [70, 16], [68, 10], [78, 6]], E.light) + zap(c, [[40, 22], [30, 16], [32, 10], [22, 6]], E.light);
        return o;
      }
      // 'B' 방전 코일 — 두 뿔 사이를 오르는 번개
      let o = plat(c, 4, { stone: '#85839c' });
      o += aura(c, 50, 30, 38, 30, E.color, 0.55);
      o += cap(c, 50, 96, 18) + tube(c, 50, 66, 94, 14, E.color) + cap(c, 50, 64, 18);
      o += c.ol('M42 62C38 46 28 30 18 8M58 62C62 46 72 30 82 8', COPPER, 4);
      o += c.ci(18, 8, 4, c.sg(COPPER), 2) + c.ci(82, 8, 4, c.sg(COPPER), 2);
      o += zap(c, [[40, 48], [46, 44], [52, 50], [60, 46]], E.color, 2.4) + zap(c, [[33, 34], [42, 30], [50, 36], [58, 30], [67, 34]], E.color, 2.4) + zap(c, [[25, 18], [36, 14], [46, 20], [56, 14], [66, 20], [75, 16]], E.color, 2.4);
      o += zap(c, [[24, 92], [18, 98], [22, 102]], E.light) + zap(c, [[76, 92], [83, 98], [78, 103]], E.light);
      return o;
    },
  };

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

  /* ---------- 기본(알 수 없는 탑) ---------- */
  T._placeholder = {
    muzzle: [[50, 40], [50, 36], [50, 30], [50, 26], [50, 26]],
    draw(c, v) {
      const g = '#9a9aa2';
      let o = plat(c, v === 'A' || v === 'B' ? 4 : v, { stone: '#a0a0a8' });
      const top = v === 'A' || v === 'B' ? 99 : 104;
      o += frus(c, 50, 50, top, 18, 24, c.cg(g), c.vg(c.h.shade(g, 0.2)));
      o += c.p('M44 70V62Q50 56 56 62V70Z', '#555', 2.4);
      o += c.ci(50, 36, 8, c.sg('#c8c8d0'), 3);
      return o;
    },
  };

  /* ---------------- 공개 함수 ---------------- */
  function vkey(level, branch) {
    if (level >= 4) return branch === 'B' ? 'B' : 'A';
    return level <= 1 ? 1 : level === 2 ? 2 : 3;
  }

  const wrap = (s, body) => `<g stroke="${OL}" stroke-width="${f(3 / s)}" stroke-linejoin="round" stroke-linecap="round"${s === 1 ? '' : ` transform="matrix(${s} 0 0 ${s} ${f(50 - 50 * s)} ${f(112 - 112 * s)})"`}>${body}</g>`;

  RG.art.tower = function tower(type, level, branch) {
    const def = T[type] && type[0] !== '_' ? T[type] : T._placeholder;
    const v = vkey(Number(level) || 1, branch);
    const s = SC[v];
    let c = Ctx(s, ELEM[type] || null);
    let body;
    try {
      body = def.draw(c, v);
    } catch (e) {
      c = Ctx(s, null);
      body = T._placeholder.draw(c, v);
    }
    return c.h.svg('0 0 100 130', c.defs.join(''), wrap(s, body));
  };

  /* 투사체 시작점: 틀 좌표 → 기준점 기준 칸 단위 */
  RG.art.TOWER_MUZZLE = {};
  Object.keys(T).forEach((id) => {
    if (id[0] === '_') return;
    RG.art.TOWER_MUZZLE[id] = T[id].muzzle.map(([x, y], i) => {
      const s = SC[VKEYS[i]];
      return [Math.round((x - 50) * s) / 100, Math.round((y - 112) * s) / 100];
    });
  });

  /* ---------------- 울림등 ---------------- */
  /*
   * 마을의 울림등: 흰 돌 받침 + 돌기둥 + 종 모양 지붕의 등불.
   * ratio(0~1)에 따라 빛 번짐 크기, 빛줄기 수, 유리·불꽃 밝기가 줄고,
   * 빛이 약하면 받침 둘레에 잿빛 안개가 낍니다.
   */
  RG.art.lantern = function lantern(ratio) {
    let r = Number(ratio);
    if (!Number.isFinite(r)) r = 1;
    r = Math.max(0, Math.min(1, r));
    const c = Ctx(1, 'light');
    const h = c.h;
    const ws = STONE.light;
    const glow = '#ffd77a';
    let o = '';
    // 빛 번짐 + 빛줄기
    if (r > 0.02) o += aura(c, 50, 42, 20 + 30 * r, 18 + 28 * r, glow, f(0.25 + 0.55 * r));
    const n = Math.floor(r * 8);
    let rays = '';
    for (let i = 0; i < n; i++) {
      const a = ((i * 360) / n - 67.5) * (Math.PI / 180);
      rays += `M${f(50 + Math.cos(a) * 25)} ${f(42 + Math.sin(a) * 23)}L${f(50 + Math.cos(a) * (32 + 10 * r))} ${f(42 + Math.sin(a) * (30 + 9 * r))}`;
    }
    if (rays) o += c.ln(rays, '#fff3c0', 3.2, f(0.4 + 0.5 * r));
    // 받침
    o += cyl(c, 50, 104, 112, 40, 12, c.cg(h.shade(ws, -0.12)), c.vg(ws, 0.2, -0.05));
    o += c.ln([-60, -20, 20, 60].map((d) => vseam(50, 104, 112, 40, 12, d)).join(''), h.shade(ws, -0.4), 1.5);
    o += cyl(c, 50, 95, 104, 29, 8.7, c.cg(ws), null);
    o += band(c, 50, 98, 101.5, 29, 8.7, c.vg(M.gold, 0.35, -0.25));
    o += c.e(50, 95, 29, 8.7, c.vg(h.shade(ws, 0.2), 0.2, 0));
    // 기둥
    o += cyl(c, 50, 62, 95, 7.5, 2.3, c.cg(ws), null);
    o += c.ln(`${ring(50, 72, 7.5, 2.3)}${ring(50, 86, 7.5, 2.3)}`, h.shade(ws, -0.35), 1.6);
    o += c.p('M38 64H62L58 58H42Z', c.vg(M.gold, 0.35, -0.25), 2.6);
    // 등불 몸통(유리)
    const gl = h.mix('#57536a', '#ffe9a0', r);
    const gg = c.def(`lg${gl}`, (id) => c.rgc(id, [[0, h.mix(gl, '#ffffff', 0.55 * r)], [0.6, gl], [1, h.shade(gl, -0.3)]], 0.5, 0.6, 0.6));
    o += frus(c, 50, 32, 57, 16, 12.5, gg, null);
    o += c.ln('M43.5 33.5L45 57.5M56.5 33.5L55 57.5', h.shade(M.bronze, -0.2), 2.6, 0.6);
    if (r > 0.02) o += flame(c, 50, 54, 6 + 4 * r, 6 + 14 * r);
    o += cyl(c, 50, 55, 59, 15, 4.5, c.cg(M.bronze), null) + c.e(50, 55, 15, 4.5, 'none', 2.4);
    // 종 모양 지붕
    o += c.p('M29 35Q33 31 37 29C37 18 43 12 50 12C57 12 63 18 63 29Q67 31 71 35Q50 41 29 35Z', c.cg(M.gold), 3);
    o += c.ln('M37 29Q50 33 63 29', h.shade(M.gold, -0.4), 1.6);
    o += c.ol('M50 12V7', M.bronze, 2) + c.ci(50, 5, 3, 'none', 2.4);
    // 처마 끝 작은 종
    o += c.ol('M30 36V39M70 36V39', M.bronze, 1.4) + c.p('M27 44Q27 38 30 38Q33 38 33 44Z', c.vg(M.gold, 0.3, -0.2), 1.8) + c.p('M67 44Q67 38 70 38Q73 38 73 44Z', c.vg(M.gold, 0.3, -0.2), 1.8);
    // 울림(소리 고리) — 빛이 충분할 때
    if (r >= 0.6) o += c.ln('M16 32Q12 42 16 52M84 32Q88 42 84 52M9 28Q4 42 9 56M91 28Q96 42 91 56', '#fff3c0', 2.2, f(0.5 * r));
    // 잿빛 안개 — 빛이 약할 때
    if (r < 0.6) {
      const a = f(Math.min(0.85, (0.6 - r) * 1.6));
      o += `<g opacity="${a}">${c.p('M6 112Q4 100 16 100Q20 92 30 98Q38 94 42 104Q30 110 18 114Q8 116 6 112Z', '#9c98a6', 2.4)}${c.p('M94 110Q98 98 86 98Q82 90 72 96Q64 94 62 104Q74 110 84 114Q92 114 94 110Z', '#9c98a6', 2.4)}${c.p('M30 124Q40 116 50 120Q62 114 72 122Q60 128 50 126Q40 130 30 124Z', '#8a8694', 2.2)}</g>`;
    }
    return h.svg('0 0 100 130', c.defs.join(''), wrap(1, o));
  };
})();
