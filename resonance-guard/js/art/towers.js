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
  RG.art._tw = { OL, SC, VKEYS, f, M, STONE, ELEM, Ctx, poly, cyl, frus, ring, band, vseam, flame, crystal, orb, aura, spark, bolt, flag, cone, person, bow, plat, house, shard, T: {} };
})();
