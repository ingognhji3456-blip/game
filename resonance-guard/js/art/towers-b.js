'use strict';

/*
 * 탑 그림 — 🪨 대지 · ✨ 빛 · 🌑 어둠 (공용 도구: towers.js)
 *
 * - draw(c, v, pose): v = 1|2|3|'A'|'B', pose = 'idle'(쉬기) · 'aim'(직전: 힘을 모음) · 'fire'(순간: 놓음).
 *   공격하지 않는 탑(병영·광산·성소)은 idle → aim → fire 를 "일하는 모습"으로 반복합니다.
 *   규칙: docs/design/animation.md (§2 자세, §2.6 건물다운 탑, §3 개연성 점검표)
 * - 건물처럼: 돌 하나하나와 줄눈, 나무 결, 널빤지, 지붕, 창 불빛. 빛은 늘 왼쪽 위.
 *   바닥에 떨어지는 그림자는 그리지 않습니다(렌더러가 그림). 땅에 닿는 곳만 어둡게.
 * - 돌 모양은 고정 난수(seed)로 만들어 자세가 바뀌어도 벽이 흔들리지 않습니다.
 * - 같은 탑은 단계가 올라도 같은 인물·장치(광부, 사제, 망치 틀, 눈, 돌손, 그림자 사냥꾼).
 */
(() => {
  const { OL, f, M, STONE, poly, crystal, orb, aura, spark, shard } = RG.art._tw;
  const T = RG.art._tw.T;
  const H0 = RG.art._h;

  /* ================= 기본 계산 ================= */
  const RAD = Math.PI / 180;
  const pp = (p) => `${f(p[0])} ${f(p[1])}`;
  const f3 = (v) => Math.round(v * 1000) / 1000;
  const pol = (o, len, deg) => [o[0] + Math.cos(deg * RAD) * len, o[1] + Math.sin(deg * RAD) * len];
  const lerp = (a, b, t) => a + (b - a) * t;
  const mix2 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  /** 자세별 값 */
  const by = (pose, idle, aim, fire) => (pose === 'aim' ? aim : pose === 'fire' ? fire : idle);
  /** 고정 난수 */
  function rng(seed) {
    let s = (Math.imul(seed | 0, 2654435761) >>> 0) || 1;
    return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  }
  /** 두 마디 관절: a → b, 길이 l1·l2. bend +1 = 화면에서 시계 방향으로 굽음(아래로 뻗은 팔이면 팔꿈치가 뒤로) */
  function joint(a, b, l1, l2, bend) {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const d = Math.hypot(dx, dy) || 0.001;
    if (d >= l1 + l2) return [a[0] + (dx * l1) / (l1 + l2), a[1] + (dy * l1) / (l1 + l2)];
    const ca = Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)));
    const ang = Math.atan2(dy, dx) + bend * Math.acos(ca);
    return [a[0] + Math.cos(ang) * l1, a[1] + Math.sin(ang) * l1];
  }
  /** 회전 묶음 */
  const rotG = (body, ang, p) => `<g transform="rotate(${f(ang)} ${f(p[0])} ${f(p[1])})">${body}</g>`;
  /** 경로로 잘라 그리기 */
  const clip = (c, d, body) => `<g clip-path="${c.def(`clip:${d}`, (id) => `<clipPath id="${id}"><path d="${d}"/></clipPath>`)}">${body}</g>`;
  /** 선(끝 모양 지정) */
  const lnc = (c, d, col, w, cap = 'butt', ex = '') => `<path d="${d}" fill="none" stroke="${col}" stroke-width="${c.sw(w)}" stroke-linecap="${cap}"${ex}/>`;
  /** 위·아래 그늘 덧칠(돌출부 아래 형태 그림자, 땅에 닿는 접지 그늘) */
  const vshade = (c, a1, a2, k1 = 0.3, k2 = 0.7) => c.def(`vs${a1}_${a2}_${k1}_${k2}`, (id) => c.lgc(id, [[0, '#24183a', a1], [k1, '#24183a', 0], [k2, '#24183a', 0], [1, '#1c1230', a2]]));
  /** 땅에 닿는 곳 접지 그늘(바닥 그림자가 아니라 맞닿은 틈의 어둠) */
  const ao = (c, x, y, rx, ry, a = 0.45) => c.e(x, y, rx, ry, c.ag('#1c1230', a), 0);
  /** 원기둥 옆면 실루엣 */
  const cylD = (cx, yt, yb, rx, ry) => `M${f(cx - rx)} ${f(yt)}V${f(yb)}A${f(rx)} ${f(ry)} 0 0 0 ${f(cx + rx)} ${f(yb)}V${f(yt)}A${f(rx)} ${f(ry)} 0 0 1 ${f(cx - rx)} ${f(yt)}Z`;
  const ellD = (cx, cy, rx, ry) => `M${f(cx - rx)} ${f(cy)}A${f(rx)} ${f(ry)} 0 1 0 ${f(cx + rx)} ${f(cy)}A${f(rx)} ${f(ry)} 0 1 0 ${f(cx - rx)} ${f(cy)}Z`;

  /* ================= 색 (4차: 색을 튼 명암) ================= */
  /*
   * docs/design/animation.md §7.2 — 그늘은 검게가 아니라 색을 틀어서(따뜻한 색은 붉은 보라, 차가운 색은 푸른 보라),
   * 밝은 면은 햇빛(따뜻한 흰색) 쪽으로. hs(색, +밝게 / −어둡게)
   */
  const LITC = '#fff4d8';
  const SH_W = '#3c1838';
  const SH_C = '#1b2254';
  const hsMemo = {};
  function hs(col, amt) {
    if (!amt || col[0] !== '#') return col;
    const key = col + amt;
    if (hsMemo[key]) return hsMemo[key];
    let out;
    if (amt > 0) out = H0.mix(col, LITC, Math.min(1, amt));
    else {
      const [r, , b] = H0.hexToRgb(col);
      const w = clamp(0.5 + (r - b) / 150, 0, 1);
      out = H0.mix(col, H0.mix(SH_C, SH_W, w), Math.min(1, -amt * 1.12));
    }
    hsMemo[key] = out;
    return out;
  }
  /** 안쪽 선 색: 그 자리 색의 어두운 변형(§7.1) */
  const inl = (col, k = 0.58) => H0.mix(hs(col, -0.35), OL, k * 0.6);
  /** 안쪽 선 속성(외곽선 대신 그 자리 색의 어두운 선) */
  const ist = (col, k) => ` stroke="${inl(col, k)}"`;
  /*
   * 그리기 문맥 다듬기: 공용 Ctx 의 원기둥·위아래·공 그라데이션을 색을 튼 명암 + 반사광으로 바꿈.
   * 이 파일의 탑을 그릴 때만 바뀝니다(공용 도구는 그대로).
   */
  function enhance(c) {
    if (c._b4) return c;
    const { def, lgc, rgc } = c;
    // 원기둥 옆면: 왼쪽 밝은 면 → 본색 → 오른쪽 그늘(색을 튼) → 가장자리 반사광
    c.cg = (col) => def(`C${col}`, (id) => lgc(id, [[0, hs(col, 0.1)], [0.24, hs(col, 0.32)], [0.58, col], [0.86, hs(col, -0.42)], [1, hs(col, -0.18)]], 'h'));
    c.vg = (col, a = 0.3, b = -0.25) => def(`V${col}${a}${b}`, (id) => lgc(id, [[0, hs(col, a)], [1, hs(col, b)]]));
    // 공: 왼쪽 위 햇빛 → 본색 → 그늘 → 가장자리 반사광
    c.sg = (col) => def(`S${col}`, (id) => rgc(id, [[0, hs(col, 0.62)], [0.42, col], [0.84, hs(col, -0.46)], [1, hs(col, -0.2)]], 0.36, 0.3, 0.78));
    // 평면(왼쪽 위 → 오른쪽 아래)
    c.dg = (col, a = 0.28, b = -0.3) => def(`D${col}${a}${b}`, (id) => lgc(id, [[0, hs(col, a)], [0.55, col], [1, hs(col, b)]], 'd'));
    c._b4 = true;
    return c;
  }
  /** 빛나는 것이 둘레 면에 비추는 색 빛: 실루엣 d 안에만 */
  const castLight = (c, d, x, y, rx, ry, col, a = 0.45) => clip(c, d, c.e(x, y, rx, ry, c.ag(col, a), 0));
  /** 반짝점(금속·보석·눈의 반사) */
  const spec = (c, x, y, r = 0.9, a = 0.95) => c.e(x, y, r, r * 0.8, '#ffffff', 0, ` opacity="${a}"`);

  /* ================= 재료 ================= */
  /*
   * 돌쌓기: 실루엣 d 안을 줄눈 있는 돌로 채웁니다. box = [x1, y1, x2, y2]
   * o: rowH 줄 높이, bw 돌 너비, bulge 줄이 가운데서 처지는 양(원기둥이면 ry), round 원기둥 명암,
   *    rough 막돌(크기·모서리 들쭉날쭉), seed, top·bot 위/아래 그늘, mortar 줄눈 색, w 외곽선(0 = 없음), lit 밝기 보정
   * 4차: 돌마다 세 단계(윗변·왼변 빛, 본색, 아랫변·오른변 그늘), 색을 조금씩 튼 돌(누런·푸른·보랏빛), 작은 구멍,
   *      원기둥 그늘 쪽 가장자리 반사광. 같은 색의 돌은 한 경로로 묶어 SVG 를 가볍게.
   */
  function masonry(c, d, box, col, o = {}) {
    const [x1, y1, x2, y2] = box;
    const R = rng(o.seed || 11);
    const rowH = o.rowH || 6;
    const bw = o.bw || 10;
    const bul = o.bulge || 0;
    const cx = (x1 + x2) / 2;
    const hw = Math.max(1, (x2 - x1) / 2);
    const g = o.gap != null ? o.gap : 0.55;
    const lit = o.lit || 0;
    const jit = o.rough ? 0.18 : 0.1;
    const yAt = (x, y) => y + bul * (1 - Math.min(1, ((x - cx) / hw) ** 2));
    const q = (xa, xb, yy) => { const m = (xa + xb) / 2; return [m, 2 * yAt(m, yy) - (yAt(xa, yy) + yAt(xb, yy)) / 2]; };
    const tints = [col, H0.mix(col, '#d0a464', 0.16), H0.mix(col, '#7c8ec8', 0.15), H0.mix(col, '#a07cb8', 0.12)];
    const groups = {};
    let hi = '';
    let lo = '';
    let pits = '';
    let y = y1;
    let row = 0;
    while (y < y2 + bul) {
      const rh = o.rough ? rowH * (0.75 + R() * 0.5) : rowH;
      const xs = [];
      if (o.round) {
        const n = Math.max(2, Math.round((Math.PI * hw) / bw));
        const off = (row % 2) * 0.5 + (o.rough ? R() * 0.3 : 0);
        for (let j = -1; j <= n + 1; j++) {
          const th = (-0.5 + (j + off) / n) * Math.PI + (R() - 0.5) * (o.rough ? 0.25 : 0.1);
          xs.push(cx + hw * Math.sin(Math.max(-Math.PI / 2, Math.min(Math.PI / 2, th))));
        }
      } else {
        let x = x1 - (row % 2 ? bw * 0.5 : 0) - (o.rough ? R() * bw * 0.5 : 0);
        while (x < x2 + bw) { xs.push(x); x += bw * (o.rough ? 0.6 + R() * 0.8 : 0.85 + R() * 0.3); }
      }
      xs.sort((a, b) => a - b);
      for (let j = 0; j + 1 < xs.length; j++) {
        const a = xs[j] + g;
        const b = xs[j + 1] - g;
        if (b - a < 0.9) continue;
        const t = Math.max(0, Math.min(1, ((a + b) / 2 - x1) / (x2 - x1)));
        let lt = lit + (R() - 0.5) * jit;
        if (o.round) lt += 0.22 - 0.58 * t + (t > 0.9 ? 0.14 : 0);
        lt = Math.round(clamp(lt, -0.7, 0.6) * 20) / 20;
        const rr = R();
        const ti = rr < 0.15 ? 1 : rr < 0.28 ? 2 : rr < 0.36 ? 3 : 0;
        const fill = hs(tints[ti], lt);
        const tp = y + g;
        const bt = y + rh - g;
        const cr = o.rough ? Math.min(1.6, (b - a) * 0.25, rh * 0.25) : 0.5;
        const q1 = q(a + cr, b - cr, tp);
        const q2 = q(b - cr, a + cr, bt);
        groups[fill] = (groups[fill] || '') + `M${f(a + cr)} ${f(yAt(a + cr, tp))}Q${pp(q1)} ${f(b - cr)} ${f(yAt(b - cr, tp))}L${f(b)} ${f(yAt(b, tp) + cr)}L${f(b)} ${f(yAt(b, bt) - cr)}L${f(b - cr)} ${f(yAt(b - cr, bt))}Q${pp(q2)} ${f(a + cr)} ${f(yAt(a + cr, bt))}L${f(a)} ${f(yAt(a, bt) - cr)}L${f(a)} ${f(yAt(a, tp) + cr)}Z`;
        if (o.bevel !== false && b - a > 4 && rh > 3.2) {
          // 윗변·왼변의 빛, 아랫변·오른변의 그늘(돌 하나의 세 단계)
          hi += `M${f(a + 0.35)} ${f(yAt(a, bt) - cr - 0.3)}L${f(a + 0.35)} ${f(yAt(a, tp) + cr)}L${f(a + cr + 0.4)} ${f(yAt(a + cr, tp) + 0.45)}Q${f(q1[0])} ${f(q1[1] + 0.45)} ${f(b - cr - 0.5)} ${f(yAt(b - cr, tp) + 0.45)}`;
          lo += `M${f(b - 0.35)} ${f(yAt(b, tp) + cr + 0.4)}L${f(b - 0.35)} ${f(yAt(b, bt) - cr)}L${f(b - cr)} ${f(yAt(b - cr, bt) - 0.4)}Q${f(q2[0])} ${f(q2[1] - 0.4)} ${f(a + cr + 0.4)} ${f(yAt(a + cr, bt) - 0.4)}`;
          // 작은 구멍·깨진 자국
          if (b - a > 5.5 && rh > 3.8 && R() < (o.rough ? 0.2 : 0.12)) {
            const px = lerp(a, b, 0.3 + R() * 0.4);
            const py = lerp(yAt(px, tp), yAt(px, bt), 0.35 + R() * 0.3);
            pits += `M${f(px - 0.6)} ${f(py)}a0.6 0.45 0 1 0 1.2 0a0.6 0.45 0 1 0 -1.2 0`;
          }
        }
      }
      y += rh;
      row += 1;
    }
    let body = c.r(x1 - 3, y1 - 3, x2 - x1 + 6, y2 - y1 + bul + 6, o.mortar || hs(col, -0.5), 0, 0);
    Object.keys(groups).forEach((fl) => { body += `<path d="${groups[fl]}" fill="${fl}" stroke="none"/>`; });
    if (hi) body += `<path d="${hi}" fill="none" stroke="${LITC}" stroke-width="${c.sw(0.75)}" opacity="${o.hiA || 0.5}"/>`;
    if (lo) body += `<path d="${lo}" fill="none" stroke="${hs(col, -0.62)}" stroke-width="${c.sw(0.7)}" opacity="0.55"/>`;
    if (pits) body += `<path d="${pits}" fill="${hs(col, -0.55)}" stroke="${hs(col, 0.25)}" stroke-width="${c.sw(0.35)}" opacity="0.8"/>`;
    if (o.top || o.bot) body += c.r(x1 - 3, y1 - 3, x2 - x1 + 6, y2 - y1 + bul + 6, vshade(c, o.top || 0, o.bot || 0, o.k1 || 0.3, o.k2 || 0.7), 0, 0);
    if (o.over) body += o.over;
    return clip(c, d, body) + (o.w === 0 ? '' : c.p(d, 'none', o.w || 3, o.ol ? ` stroke="${o.ol}"` : ''));
  }

  /* 각목: 굵은 외곽선 + 위쪽 빛 + 결. o.inner: 벽 안쪽 들보(외곽선을 그 자리 색의 어두운 선으로) */
  function beam(c, a, b, w, col, o = {}) {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const ux = (b[0] - a[0]) / L;
    const uy = (b[1] - a[1]) / L;
    let nx = -uy;
    let ny = ux;
    if (nx + ny > 0) { nx = -nx; ny = -ny; } // 왼쪽 위를 향하는 쪽이 빛
    const e = 1.3;
    const A = [a[0] - ux * e, a[1] - uy * e];
    const B = [b[0] + ux * e, b[1] + uy * e];
    const off = (p, k) => [p[0] + nx * k, p[1] + ny * k];
    let s = lnc(c, `M${pp(A)}L${pp(B)}`, o.inner ? inl(col, 0.7) : OL, w + (o.inner ? 1.6 : 2.6)) + lnc(c, `M${pp(a)}L${pp(b)}`, col, w);
    s += lnc(c, `M${pp(off(a, w * 0.3))}L${pp(off(b, w * 0.3))}`, hs(col, 0.32), w * 0.26);
    s += lnc(c, `M${pp(off(a, -w * 0.3))}L${pp(off(b, -w * 0.3))}`, hs(col, -0.34), w * 0.22);
    if (o.grain !== false && w >= 2.6) {
      s += lnc(c, `M${pp(off(a, -w * 0.05))}L${pp(off(b, -w * 0.05))}`, hs(col, -0.38), Math.max(0.7, w * 0.12), 'butt', ` stroke-dasharray="${c.sw(L * 0.22)} ${c.sw(L * 0.09)}" opacity="0.8"`);
      // 옹이 하나(긴 들보)
      if (L > 18) { const k = mix2(a, b, 0.62); s += c.e(k[0], k[1], w * 0.2, w * 0.14, hs(col, -0.45), 0, ' opacity="0.85"'); }
    }
    return s;
  }

  /*
   * 널빤지: 실루엣 d 안을 널로 채움. box = [x1,y1,x2,y2], o.dir 'v'(세로 널) | 'h', o.pw 널 너비, o.nails 못
   * 4차: 결·못을 한 경로로 묶고, 옹이와 갈라진 끝을 더함
   */
  function planks(c, d, box, col, o = {}) {
    const [x1, y1, x2, y2] = box;
    const R = rng(o.seed || 5);
    const pw = o.pw || 5;
    const vert = o.dir !== 'h';
    let body = c.r(x1 - 2, y1 - 2, x2 - x1 + 4, y2 - y1 + 4, hs(col, -0.58), 0, 0);
    const from = vert ? x1 : y1;
    const to = vert ? x2 : y2;
    let grain = '';
    let nails = '';
    let knots = '';
    let hiL = '';
    for (let p = from; p < to; p += pw) {
      const sh = (R() - 0.5) * 0.16 + (vert ? 0.12 - 0.3 * ((p - x1) / Math.max(1, x2 - x1)) : 0.05);
      const fill = hs(col, Math.round(sh * 25) / 25);
      const g = 0.45;
      if (vert) {
        body += c.r(p + g, y1 - 2, pw - 2 * g, y2 - y1 + 4, fill, 0, 0);
        grain += `M${f(p + pw * (0.3 + R() * 0.4))} ${f(y1 + R() * 3)}V${f(y2 - R() * 4)}`;
        if (pw > 2.6) hiL += `M${f(p + g + 0.35)} ${f(y1)}V${f(y2)}`;
        if (o.nails) nails += `M${f(p + pw / 2)} ${f(y1 + 2.2)}h0.01M${f(p + pw / 2)} ${f(y2 - 2.2)}h0.01`;
        if (pw > 3 && R() < 0.3) { const ky = lerp(y1, y2, 0.25 + R() * 0.5); const kx = p + pw * 0.5; knots += `M${f(kx - pw * 0.18)} ${f(ky)}a${f(pw * 0.18)} ${f(pw * 0.3)} 0 1 0 ${f(pw * 0.36)} 0a${f(pw * 0.18)} ${f(pw * 0.3)} 0 1 0 ${f(-pw * 0.36)} 0`; }
      } else {
        body += c.r(x1 - 2, p + g, x2 - x1 + 4, pw - 2 * g, fill, 0, 0);
        grain += `M${f(x1 + R() * 4)} ${f(p + pw * (0.3 + R() * 0.4))}H${f(x2 - R() * 4)}`;
        if (pw > 2.6) hiL += `M${f(x1)} ${f(p + g + 0.35)}H${f(x2)}`;
        if (o.nails) nails += `M${f(x1 + 2.2)} ${f(p + pw / 2)}h0.01M${f(x2 - 2.2)} ${f(p + pw / 2)}h0.01`;
        if (pw > 3 && R() < 0.3) { const kx = lerp(x1, x2, 0.25 + R() * 0.5); const ky = p + pw * 0.5; knots += `M${f(kx - pw * 0.3)} ${f(ky)}a${f(pw * 0.3)} ${f(pw * 0.18)} 0 1 0 ${f(pw * 0.6)} 0a${f(pw * 0.3)} ${f(pw * 0.18)} 0 1 0 ${f(-pw * 0.6)} 0`; }
      }
    }
    body += `<path d="${grain}" fill="none" stroke="${hs(col, -0.4)}" stroke-width="${c.sw(0.7)}" opacity="0.7"/>`;
    if (hiL) body += `<path d="${hiL}" fill="none" stroke="${LITC}" stroke-width="${c.sw(0.55)}" opacity="0.35"/>`;
    if (knots) body += `<path d="${knots}" fill="${hs(col, -0.32)}" stroke="${hs(col, -0.55)}" stroke-width="${c.sw(0.5)}" opacity="0.85"/>`;
    if (nails) body += `<path d="${nails}" fill="none" stroke="${hs(col, -0.65)}" stroke-width="${c.sw(1.2)}" stroke-linecap="round"/>`;
    if (o.top || o.bot) body += c.r(x1 - 2, y1 - 2, x2 - x1 + 4, y2 - y1 + 4, vshade(c, o.top || 0, o.bot || 0, o.k1 || 0.3, o.k2 || 0.7), 0, 0);
    if (o.over) body += o.over;
    return clip(c, d, body) + (o.w === 0 ? '' : c.p(d, 'none', o.w || 3, o.ol ? ` stroke="${o.ol}"` : ''));
  }

  /*
   * 지붕면: 평행사변형 O + u·U + v·V (U: 처마와 나란히, V: 용마루 → 처마)
   * kind: 'tile'(기와) | 'thatch'(초가) | 'shingle'(널 지붕) | 'slate'(돌판)
   */
  function roofPlane(c, O, U, V, kind, col, o = {}) {
    const LU = Math.hypot(U[0], U[1]);
    const LV = Math.hypot(V[0], V[1]);
    const m = `matrix(${f3(U[0] / LU)} ${f3(U[1] / LU)} ${f3(V[0] / LV)} ${f3(V[1] / LV)} ${f(O[0])} ${f(O[1])})`;
    const R = rng(o.seed || 3);
    const lt = o.lit || 0;
    const rh = o.rh || (kind === 'thatch' ? 4 : 4.4);
    let body = c.r(-1, -1, LU + 2, LV + 2, hs(col, lt - 0.38), 0, 0);
    let dark = '';
    let light = '';
    let i = 0;
    for (let v = -rh * 0.4; v < LV + rh; v += rh, i++) {
      const rowCol = hs(col, Math.round((lt + (v / LV) * 0.12 + (R() - 0.5) * 0.06) * 25) / 25);
      if (kind === 'tile') {
        const tw = o.tw || 4.6;
        let dd = `M-2 ${f(v)}H${f(LU + 2)}V${f(v + rh)}`;
        for (let u = LU + 2 - ((i % 2) * tw) / 2; u > -tw; u -= tw) dd += `A${f(tw / 2)} ${f(rh * 0.45)} 0 0 1 ${f(u - tw)} ${f(v + rh)}`;
        body += c.p(`${dd}Z`, rowCol, 0);
        light += `M-2 ${f(v + 0.8)}H${f(LU + 2)}`;
        for (let u = LU + 2 - ((i % 2) * tw) / 2; u > -tw; u -= tw) dark += `M${f(u - tw / 2)} ${f(v + 1.2)}V${f(v + rh * 0.9)}`;
      } else if (kind === 'thatch') {
        body += c.r(-2, v, LU + 4, rh + 0.6, rowCol, 0, 0);
        for (let u = -1; u < LU + 2; u += 1.6) { const l = rh * (0.6 + R() * 0.5); dark += `M${f(u + R() * 0.8)} ${f(v + rh + 0.4 - l)}l${f((R() - 0.5) * 0.8)} ${f(l)}`; }
        for (let u = 0.4; u < LU + 2; u += 3.1) light += `M${f(u + R())} ${f(v + 0.6)}l${f((R() - 0.5) * 0.6)} ${f(rh * 0.5)}`;
        dark += `M-2 ${f(v + rh + 0.2)}H${f(LU + 2)}`;
      } else {
        // shingle · slate: 엇갈린 네모 조각
        const tw = o.tw || (kind === 'slate' ? 6 : 5);
        body += c.r(-2, v, LU + 4, rh, rowCol, 0, 0);
        for (let u = -((i % 2) * tw) / 2 + (R() - 0.5); u < LU + 2; u += tw) dark += `M${f(u)} ${f(v)}V${f(v + rh)}`;
        dark += `M-2 ${f(v + rh - 0.2)}H${f(LU + 2)}`;
        light += `M-2 ${f(v + 0.7)}H${f(LU + 2)}`;
      }
    }
    body += `<path d="${dark}" fill="none" stroke="${hs(col, lt - 0.5)}" stroke-width="${c.sw(0.8)}" opacity="0.8"/>`;
    if (light) body += `<path d="${light}" fill="none" stroke="${LITC}" stroke-width="${c.sw(0.7)}" opacity="0.32"/>`;
    // 용마루 쪽은 밝고 처마 쪽 끝은 짙게(빛 + 처마 그늘)
    body += c.r(-1, -1, LU + 2, LV + 2, vshade(c, 0, 0.3, 0.3, 0.75), 0, 0);
    if (o.over) body += o.over;
    const corners = [O, [O[0] + U[0], O[1] + U[1]], [O[0] + U[0] + V[0], O[1] + U[1] + V[1]], [O[0] + V[0], O[1] + V[1]]];
    const dl = `M0 0H${f(LU)}V${f(LV)}H0Z`;
    const u = c.def(`rclip${f(LU)}_${f(LV)}`, (id) => `<clipPath id="${id}"><path d="${dl}"/></clipPath>`);
    return `<g transform="${m}"><g clip-path="${u}">${body}</g></g>` + c.p(poly(corners), 'none', o.w || 3);
  }

  /* 창: 가운데 (x,y), 너비 w, 높이 ht, lit 0(어둠)~1(불빛), arch 아치 위, frame 틀 색 */
  function win(c, x, y, w, ht, lit, o = {}) {
    const fr = o.frame || '#5a4636';
    const top = y - ht / 2;
    const d = o.arch ? `M${f(x - w / 2)} ${f(y + ht / 2)}V${f(top + w / 2)}A${f(w / 2)} ${f(w / 2)} 0 0 1 ${f(x + w / 2)} ${f(top + w / 2)}V${f(y + ht / 2)}Z` : `M${f(x - w / 2)} ${f(top)}H${f(x + w / 2)}V${f(y + ht / 2)}H${f(x - w / 2)}Z`;
    const gl = lit > 0 ? c.def(`win${lit}`, (id) => c.rgc(id, [[0, H0.mix('#3a2e2a', '#fff2b8', lit)], [0.7, H0.mix('#2a2226', '#ffc35a', lit)], [1, H0.mix('#1e1820', '#d9822a', lit)]], 0.45, 0.6, 0.7)) : '#241c26';
    let s = '';
    if (lit > 0.5 && o.glow !== false) s += aura(c, x, y, w * 1.3, ht * 0.9, '#ffd77a', 0.35 * lit);
    s += c.p(d, gl, 0);
    // 창 안쪽 위 그늘(벽 두께)
    s += clip(c, d, c.r(x - w / 2, top - 1, w, Math.min(2.4, ht * 0.25) + (o.arch ? w / 2 : 0), '#1c1230', 0, 0, ' opacity="0.35"'));
    s += c.ln(`M${f(x)} ${f(top + 0.5)}V${f(y + ht / 2)}M${f(x - w / 2)} ${f(y + ht * 0.05)}H${f(x + w / 2)}`, fr, Math.max(1, w * 0.13));
    s += c.p(d, 'none', o.w || 2.2, ` stroke="${fr}"`) + c.p(d, 'none', 1, ist(fr, 0.8));
    // 창턱 + 그 아래 짙은 그늘
    if (o.sill !== false) s += c.r(x - w / 2 - 1.4, y + ht / 2, w + 2.8, 1.8, c.vg(o.sillCol || '#d8cfbf', 0.2, -0.2), 0.4, 1.2, ist(o.sillCol || '#d8cfbf')) + c.r(x - w / 2 - 0.6, y + ht / 2 + 2.2, w + 1.2, 1.2, '#1c1230', 0, 0, ' opacity="0.3"');
    return s;
  }

  /* 쇠 리벳 줄 */
  const rivets = (c, pts, col = '#c9d0d8', r = 0.75) => pts.map((p) => c.ci(p[0], p[1], r, col, 0) + c.ci(p[0] + r * 0.25, p[1] + r * 0.3, r * 0.45, hs(col, -0.5), 0)).join('');

  /* 이끼 덩이 (윗면에 얹힘) — 안쪽 선은 짙은 초록 */
  function mossPatch(c, x, y, w, ht, seed = 1) {
    const R = rng(seed);
    let d = `M${f(x - w / 2)} ${f(y)}`;
    const n = 5;
    for (let i = 0; i <= n; i++) { const t = i / n; d += `Q${f(x - w / 2 + w * (t - 0.1))} ${f(y - ht * (0.6 + R() * 0.6))} ${f(x - w / 2 + w * t)} ${f(y - ht * (i === 0 || i === n ? 0 : 0.3 + R() * 0.3))}`; }
    d += `Q${f(x)} ${f(y + ht * 0.8)} ${f(x - w / 2)} ${f(y)}Z`;
    let s = c.p(d, c.vg('#74b23e', 0.32, -0.3), 1.3, ' stroke="#2c4a1c"');
    // 잎 끝 붓질(밝은 점)
    s += c.ci(x - w * 0.2, y - ht * 0.35, Math.max(0.6, ht * 0.18), '#b8e07a', 0, ' opacity="0.85"') + c.ci(x + w * 0.15, y - ht * 0.45, Math.max(0.5, ht * 0.12), '#d4f0a0', 0, ' opacity="0.7"');
    return s;
  }


  /* ================= 받침(기초) ================= */
  /*
   * 단계 표시는 공용 plat 과 같은 규칙(크기·높이 같음): Lv1 막돌 + 널 마루, Lv2 다듬은 돌,
   * Lv3 + 금속 테와 원소 보석, Lv4 2단 + 원소 띠. 돌 하나하나를 줄눈으로 쌓고, 맨 아랫줄은 땅에 닿아 어둡게.
   */
  function base(c, v, o = {}) {
    const E = c.E;
    const stone = o.stone || '#a7a29b';
    const seed = o.seed || 21;
    let s = '';
    if (v === 1) {
      const rs = o.rough || M.rough;
      s += masonry(c, cylD(50, 104, 112, 44, 13), [6, 104, 94, 112], rs, { round: true, rough: true, rowH: 4, bw: 9, bulge: 13, seed, bot: 0.32, k2: 0.55 });
      const top = ellD(50, 104, 44, 13);
      s += planks(c, top, [6, 91, 94, 117], o.top || M.plank, { pw: 8.8, seed: seed + 1, nails: true, bot: 0.14, top: 0.04, w: 3 });
      // 널 마루 가장자리 빛(왼쪽 위)과 테두리 안쪽 그늘
      s += c.ln('M9 101.5Q14 94.5 32 92.4', LITC, 1.1, 0.45);
      return s;
    }
    if (v === 2 || v === 3) {
      s += masonry(c, cylD(50, 104, 112, 44, 13), [6, 104, 94, 112], stone, { round: true, rowH: 4, bw: 11, bulge: 13, seed, bot: 0.3, k2: 0.55 });
      if (v === 3) {
        const tr = o.trim || M.gold;
        s += c.p(`M6 104A44 13 0 0 0 94 104V107.5A44 13 0 0 1 6 107.5Z`, c.cg(tr), 2);
        s += c.ln('M8 105.6A44 13 0 0 0 40 116.6', LITC, 0.8, 0.6);
        s += rivets(c, [-60, -30, 0, 30, 60].map((dg) => [50 + 44 * Math.sin(dg * RAD), 105.8 + 13 * Math.cos(dg * RAD)]), hs(tr, 0.5), 0.8);
        s += c.p(poly([[50, 115], [54, 119.5], [50, 124], [46, 119.5]]), c.vg(E.color, 0.4, -0.25), 2) + c.p(poly([[50, 115.8], [52.4, 119.5], [50, 119.5]]), '#fff', 0, ' opacity="0.6"') + spec(c, 48.8, 117.6, 0.7);
      }
      s += masonry(c, ellD(50, 104, 44, 13), [6, 91, 94, 117], hs(stone, 0.2), { rowH: 6.5, bw: 13, seed: seed + 2, gap: 0.45, hiA: 0.35 });
      s += c.e(50, 104, 34, 9.5, 'none', 0, ` stroke="${hs(stone, -0.28)}" stroke-width="${c.sw(1.3)}"`);
      s += c.ln('M9 101.5Q14 94.5 32 92.4', LITC, 1.1, 0.5);
      return s;
    }
    const s2 = o.stone || stone;
    const lo = hs(s2, -0.22);
    s += masonry(c, cylD(50, 106, 112, 46, 14), [4, 106, 96, 112], lo, { round: true, rough: true, rowH: 3.2, bw: 12, bulge: 14, seed, bot: 0.36, k2: 0.42 });
    s += masonry(c, ellD(50, 106, 46, 14), [4, 92, 96, 120], hs(lo, 0.12), { rowH: 7, bw: 14, seed: seed + 3, gap: 0.45, bevel: false });
    s += masonry(c, cylD(50, 98, 106, 39, 11.5), [11, 98, 89, 106], s2, { round: true, rowH: 4, bw: 10, bulge: 11.5, seed: seed + 4, bot: 0.3 });
    // 위 단이 아래 단에 닿는 곳 접촉 그늘
    s += c.p('M11 105.4A39 11.5 0 0 0 89 105.4L89 106.4A39 11.5 0 0 1 11 106.4Z', '#1c1230', 0, ' opacity="0.35"');
    s += c.p(`M11 101A39 11.5 0 0 0 89 101V104.5A39 11.5 0 0 1 11 104.5Z`, c.vg(o.trim || E.color, 0.3, -0.3), 2);
    s += c.ln('M12.5 102.4A39 11.5 0 0 0 40 112', LITC, 0.8, 0.55);
    s += [-50, 0, 50].map((dg) => {
      const x = 50 + 39 * Math.sin(dg * RAD);
      const y = 102.8 + 11.5 * Math.cos(dg * RAD);
      return c.p(poly([[x, y - 4], [x + 3, y], [x, y + 4], [x - 3, y]]), c.vg(E.light, 0.3, -0.15), 1.8) + spec(c, x - 0.9, y - 1.4, 0.6);
    }).join('');
    s += masonry(c, ellD(50, 98, 39, 11.5), [11, 86, 89, 110], hs(s2, 0.22), { rowH: 6, bw: 12, seed: seed + 5, gap: 0.45, hiA: 0.3 });
    s += c.e(50, 98, 30, 8.5, 'none', 0, ` stroke="${E.color}" stroke-width="${c.sw(2)}" opacity="0.7"`);
    s += c.ln('M14 95.8Q19 89.6 36 87.8', LITC, 1, 0.45);
    return s;
  }

  /* ================= 사람 ================= */
  /** 장화(오른쪽을 향함) — 발바닥 (x,y) */
  const boot = (c, p, k, col) => c.p(`M${f(p[0] - 2.4 * k)} ${f(p[1])}V${f(p[1] - 3.6 * k)}H${f(p[0] + 1.6 * k)}Q${f(p[0] + 4.8 * k)} ${f(p[1] - 3 * k)} ${f(p[0] + 4.8 * k)} ${f(p[1])}Z`, c.vg(col, 0.3, -0.25), 2.2)
    + c.ln(`M${f(p[0] - 1.8 * k)} ${f(p[1] - 2.9 * k)}H${f(p[0] + 1.4 * k)}`, hs(col, 0.4), 0.7 * k, 0.7);
  /** 관(팔다리 한 마디): 본색 + 왼쪽 위 빛 줄 + 오른쪽 아래 그늘 줄 */
  function tube(c, a, b, w, col) {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    let nx = -(b[1] - a[1]) / L;
    let ny = (b[0] - a[0]) / L;
    if (nx + ny > 0) { nx = -nx; ny = -ny; }
    const o = (p, k) => `${f(p[0] + nx * k)} ${f(p[1] + ny * k)}`;
    return c.ln(`M${pp(a)}L${pp(b)}`, col, w) + c.ln(`M${o(a, w * 0.24)}L${o(b, w * 0.24)}`, hs(col, 0.3), w * 0.3) + c.ln(`M${o(a, -w * 0.28)}L${o(b, -w * 0.28)}`, hs(col, -0.32), w * 0.24);
  }
  /** 두 마디 팔다리(관절이 이어짐) */
  function limb(c, a, j, b, w, cu, cl) {
    return c.ln(`M${pp(a)}L${pp(j)}L${pp(b)}`, OL, w + 2.6) + tube(c, a, j, w, cu) + tube(c, j, b, w * 0.9, cl || cu) + c.ci(j[0], j[1], w * 0.45, cu, 0);
  }
  /** 쥔 손 */
  const fist = (c, p, r, col) => c.ci(p[0], p[1], r, c.sg(col), 2.2) + c.ln(`M${f(p[0] - r * 0.2)} ${f(p[1] - r * 0.55)}L${f(p[0] + r * 0.45)} ${f(p[1] + r * 0.1)}`, hs(col, -0.38), 0.8, 0.8);
  /**
   * 자세 키우기(§7.5 일꾼 15~25% 크게): 발 가운데를 기준으로 좌표를 s배. 반환 함수 S(p) 와 크기 k
   */
  function grow(feet, s) {
    const ax = (feet[0][0] + feet[1][0]) / 2;
    const ay = Math.max(feet[0][1], feet[1][1]);
    const S = (p) => [ax + (p[0] - ax) * s, ay + (p[1] - ay) * s];
    S.k = s;
    S.a = [ax, ay];
    return S;
  }

  /*
   * 사람(오른쪽을 봄). g = {
   *   hip:[x,y], lean(도, + 앞으로 숙임), k(크기), feet:[뒤, 앞], hands:[뒤, 앞], bend:[뒤팔, 앞팔](+1 팔꿈치가 뒤·아래로),
   *   skin, shirt, sleeve, pants, boot, belt, robe(긴 옷 색), apron, glove, hat(c, H, r, up, nx) → 문자열, face(c, H, r),
   *   cuff(소매 끝 색), sash(허리띠 천 색)
   * }
   * 반환: { back(뒷다리·뒷팔), body(앞다리·몸·머리), handB(뒷손), front(앞팔·앞손), H, r, neck, up, nx }
   * 그리는 순서: back → (몸 뒤 도구) → body → (손에 든 도구) → handB → front
   */
  function fig(c, g) {
    const k = g.k || 1;
    const lean = (g.lean || 0) * RAD;
    const up = [Math.sin(lean), -Math.cos(lean)];
    const nx = [Math.cos(lean), Math.sin(lean)];
    const at = (o, a, b) => [o[0] + (up[0] * a + nx[0] * b) * k, o[1] + (up[1] * a + nx[1] * b) * k];
    const hip = g.hip;
    const neck = at(hip, 11.5, 0);
    const r = 5.3 * k;
    const H = at(neck, 6, 0.7);
    const sB = at(neck, -1.7, -2.5);
    const sF = at(neck, -1.7, 2.1);
    const hB = at(hip, 0.3, -1.6);
    const hF = at(hip, 0.3, 1.6);
    const AL = 7 * k;
    const LL = 7.2 * k;
    const [fB, fF] = g.feet;
    const [aB, aF] = g.hands;
    const bend = g.bend || [1, 1];
    const sk = g.skin || M.skin;
    const shirt = g.shirt;
    const sl = g.sleeve || shirt;
    const gl = g.glove || sk;
    const pants = g.pants || '#5a4a3a';
    const bootC = g.boot || '#3e2e22';
    const leg = (hp, ft, col) => limb(c, hp, joint(hp, ft, LL, LL, -1), ft, 4.3 * k, col) + boot(c, ft, k, bootC);
    const arm = (s0, hd, b, col) => {
      const el = joint(s0, hd, AL, AL, b);
      let a = limb(c, s0, el, hd, 3.7 * k, col, g.bare ? sk : col);
      // 소매 끝 테(손목 쪽)
      if (g.cuff) { const w0 = mix2(el, hd, 0.72); const w1 = mix2(el, hd, 0.86); a += c.ln(`M${pp(w0)}L${pp(w1)}`, g.cuff, 3.4 * k); }
      return a;
    };
    // 발밑 접촉 그늘
    let back = ao(c, fB[0] + 1, fB[1], 4 * k, 1.3 * k, 0.5) + ao(c, fF[0] + 1, fF[1], 4.2 * k, 1.3 * k, 0.5);
    let body = '';
    if (!g.robe) back += leg(hB, fB, hs(pants, -0.22));
    back += arm(sB, aB, bend[0], hs(sl, -0.22));
    // 몸통(왼쪽 위 빛: 왼쪽 밝고 오른쪽 어두움)
    const tw = 4.7;
    const bw = 4.2;
    const tor = `M${pp(at(hip, -1.2, -bw))}L${pp(at(neck, 0.4, -tw))}Q${pp(at(neck, 2.8, 0))} ${pp(at(neck, 0.4, tw))}L${pp(at(hip, -1.2, bw))}Q${pp(at(hip, -2.6, 0))} ${pp(at(hip, -1.2, -bw))}Z`;
    if (g.robe) {
      const yb = Math.max(fB[1], fF[1]) - 1.2 * k;
      const xl = Math.min(fB[0], fF[0]) - 3.4 * k;
      const xr = Math.max(fB[0], fF[0]) + 3.4 * k;
      body += boot(c, fB, k, hs(bootC, -0.2)) + boot(c, fF, k, bootC);
      const rd = `M${pp(at(neck, 0.4, -tw))}Q${f(xl - 1)} ${f(lerp(neck[1], yb, 0.55))} ${f(xl)} ${f(yb)}Q${f((xl + xr) / 2)} ${f(yb + 2.2 * k)} ${f(xr)} ${f(yb)}Q${f(xr + 0.5)} ${f(lerp(neck[1], yb, 0.5))} ${pp(at(neck, 0.4, tw))}Q${pp(at(neck, 2.8, 0))} ${pp(at(neck, 0.4, -tw))}Z`;
      body += c.p(rd, c.cg(g.robe), 2.6);
      // 옷 주름 셋(빛 반대쪽에 짙게) + 왼쪽 주름의 빛
      const fc = inl(g.robe, 0.45);
      body += c.ln(`M${f(lerp(xl, xr, 0.42))} ${f(lerp(neck[1], yb, 0.45))}L${f(lerp(xl, xr, 0.36))} ${f(yb)}M${f(lerp(xl, xr, 0.7))} ${f(lerp(neck[1], yb, 0.4))}L${f(lerp(xl, xr, 0.76))} ${f(yb + 0.8)}M${f(lerp(xl, xr, 0.57))} ${f(lerp(neck[1], yb, 0.62))}L${f(lerp(xl, xr, 0.56))} ${f(yb + 1)}`, fc, 1, 0.85);
      body += c.ln(`M${f(lerp(xl, xr, 0.3))} ${f(lerp(neck[1], yb, 0.5))}L${f(lerp(xl, xr, 0.24))} ${f(yb - 0.6)}`, hs(g.robe, 0.45), 0.9, 0.7);
      if (g.trim) body += c.ln(`M${f(xl + 0.8)} ${f(yb - 1)}Q${f((xl + xr) / 2)} ${f(yb + 1.2 * k)} ${f(xr - 0.8)} ${f(yb - 1)}`, g.trim, 1.6);
      if (g.sash) body += c.ln(`M${pp(at(hip, 2.4, -bw - 0.4))}Q${pp(at(hip, 1.6, 0))} ${pp(at(hip, 2.2, bw + 0.6))}`, inl(g.sash, 0.5), 3.4 * k) + c.ln(`M${pp(at(hip, 2.4, -bw - 0.4))}Q${pp(at(hip, 1.6, 0))} ${pp(at(hip, 2.2, bw + 0.6))}`, g.sash, 2 * k);
    } else {
      body += leg(hF, fF, pants);
      body += c.p(tor, c.cg(shirt), 2.6);
      const fc = inl(shirt, 0.45);
      body += c.ln(`M${pp(at(hip, 4.5, 0.8))}L${pp(at(hip, 0.6, 1.9))}M${pp(at(neck, -2.4, 2.6))}Q${pp(at(neck, -4.5, 1.4))} ${pp(at(neck, -6, 2.4))}`, fc, 0.9, 0.8);
      if (g.apron) body += c.p(`M${pp(at(neck, -3, -1.2))}L${pp(at(neck, -3, 3.6))}L${pp(at(hip, -4.5, 4.4))}L${pp(at(hip, -4.5, -1.8))}Z`, c.vg(g.apron, 0.18, -0.28), 1.6, ist(g.apron));
      const belt = g.belt || '#6a4428';
      body += c.ln(`M${pp(at(hip, 1.4, -bw))}L${pp(at(hip, 1.4, bw))}`, inl(shirt, 0.75), 3) + c.ln(`M${pp(at(hip, 1.4, -bw + 0.5))}L${pp(at(hip, 1.4, bw - 0.5))}`, belt, 1.8);
      const bk = at(hip, 1.4, 1.2);
      body += c.r(bk[0] - 1, bk[1] - 1, 2, 2, M.gold, 0.3, 0.8, ist(M.gold)) + spec(c, bk[0] - 0.4, bk[1] - 0.4, 0.4);
    }
    // 목 + 머리
    body += c.ln(`M${pp(neck)}L${pp(at(neck, 2.2, 0.4))}`, OL, 4.4 * k) + c.ln(`M${pp(neck)}L${pp(at(neck, 2.2, 0.4))}`, hs(sk, -0.2), 2.4 * k);
    body += c.ci(H[0], H[1], r, c.def(`skin${sk}`, (id) => c.rgc(id, [[0, hs(sk, 0.28)], [0.58, sk], [0.9, hs(sk, -0.3)], [1, hs(sk, -0.12)]], 0.35, 0.3, 0.8)), 2.6);
    if (g.face) body += g.face(c, H, r, up, nx);
    else body += c.e(H[0] + r * 0.45, H[1] + r * 0.02, 0.85 * k, 1.25 * k, '#2a1a2e', 0) + c.ci(H[0] + r * 0.97, H[1] + r * 0.2, 0.9 * k, hs(sk, -0.15), 0);
    if (g.hat) body += g.hat(c, H, r, up, nx);
    const handB = fist(c, aB, 2.2 * k, gl);
    const front = arm(sF, aF, bend[1], sl) + fist(c, aF, 2.25 * k, gl);
    return { back, body, handB, front, H, r, neck, up, nx, sh: [sB, sF] };
  }
  const figAll = (F, held = '') => F.back + F.body + held + F.handB + F.front;

  /* 손잡이 도구 공통: 쥔 곳 g에서 각 ang으로 길이 L — 끝점 */
  const toolEnd = (g, ang, L) => pol(g, L, ang);


  /* ================================================================
   * 🪨 바위 병영 — 작은 돌 요새. 일하는 모습: 깃발이 펄럭이고(aim·fire), 문이 열려 병사가 나오며(fire),
   * 문지기 골렘이 창을 고쳐 잡았다(aim) 경례함(fire).
   * 4A 화강암 수호병: 쌍탑 성채 + 내리닫이 쇠창살 문, 문지기가 철퇴로 방패를 쳐서 도발.
   * 4B 흑요석 검사: 흑요석 가시 막사, 문지기가 검을 세워 경례했다 벰.
   * ================================================================ */
  const GOLEM = {
    stone: { col: '#a39d90', eye: '#d4ff8a' },
    granite: { col: '#b9a59c', eye: '#8dffb0' },
    obsidian: { col: '#5a5272', eye: '#8dffb0' },
  };
  /*
   * 돌 골렘(오른쪽을 봄). g = { x, y(발), k, kind, lean, hands:[뒤, 앞], bend:[뒤, 앞], helm }
   * 반환 { back, body, handB, front, H }
   */
  function golemFig(c, g) {
    const h = c.h;
    const k = g.k || 1;
    const G = GOLEM[g.kind || 'stone'];
    const col = G.col;
    const lean = (g.lean || 0) * RAD;
    const up = [Math.sin(lean), -Math.cos(lean)];
    const nx = [Math.cos(lean), Math.sin(lean)];
    const hip = [g.x, g.y - 8 * k];
    const at = (a, b) => [hip[0] + (up[0] * a + nx[0] * b) * k, hip[1] + (up[1] * a + nx[1] * b) * k];
    const B = at(6.5, 0);
    const H = at(17.6, 1.6);
    const sB = at(10.5, -6);
    const sF = at(10.5, 5.6);
    const fB = [g.x - 4 * k, g.y];
    const fF = [g.x + 4.6 * k, g.y];
    const [aB, aF] = g.hands;
    const bend = g.bend || [1, 1];
    const obs = g.kind === 'obsidian';
    const leg = (hp, ft, cc) => limb(c, hp, joint(hp, ft, 4.6 * k, 4.6 * k, -1), ft, 5 * k, cc) + c.r(ft[0] - 3 * k, ft[1] - 2.8 * k, 6.8 * k, 2.8 * k, c.vg(cc, 0.25, -0.25), 1 * k, 2);
    const arm = (s0, hd, b, cc) => limb(c, s0, joint(s0, hd, 6.2 * k, 6 * k, b), hd, 4.4 * k, cc);
    const back = arm(sB, aB, bend[0], hs(col, -0.28)) + leg(at(0.5, -3.4), fB, hs(col, -0.22));
    let body = leg(at(0.5, 3.4), fF, col);
    const bodyG = c.def(`gol${col}`, (id) => c.rgc(id, [[0, hs(col, obs ? 0.35 : 0.3)], [0.55, col], [1, hs(col, -0.45)]], 0.32, 0.28, 0.85));
    if (obs) {
      body += c.p(poly([at(15, -5.5), at(15.5, 6.5), at(6, 8.5), at(-1, 4.5), at(-1, -4.5), at(7, -8)]), bodyG, 2.8);
      body += c.p(poly([at(15, -5.5), at(15.5, 6.5), at(9, 1)]), '#c9c0ff', 0, ' opacity="0.45"') + c.ln(`M${pp(at(9, 1))}L${pp(at(0, 2))}`, '#8f86c8', 1, 0.7);
      body += c.ln(`M${pp(at(14, -4.8))}L${pp(at(7.2, -7.2))}L${pp(at(-0.4, -4))}`, '#b8b0e8', 1.2, 0.8);
    } else {
      body += c.e(B[0], B[1], 8.4 * k * (g.kind === 'granite' ? 1.12 : 1), 9 * k, bodyG, 2.8);
      body += c.ln(`M${pp(at(9, -3))}l${f(2.2 * k)} ${f(2 * k)}M${pp(at(3, 4))}l${f(-1.6 * k)} ${f(2 * k)}`, hs(col, -0.4), 1.1, 0.8);
      body += c.p(`M${pp(at(1.5, -7.4))}Q${pp(at(-2, 0))} ${pp(at(1.5, 7.4))}Q${pp(at(0.2, 0))} ${pp(at(1.5, -7.4))}Z`, c.vg('#6fae3e', 0.3, -0.25), 1.4);
      if (g.kind === 'granite') body += [[8, -3], [4, 2], [11, 3], [6, -6]].map(([a, b]) => c.ci(...at(a, b), 0.8 * k, '#6a5a54', 0, ' opacity="0.6"')).join('');
    }
    // 머리 + 이끼 모자 + 빛나는 눈
    if (obs) {
      body += c.p(poly([[H[0] - 5 * k, H[1] + 4 * k], [H[0] - 5.5 * k, H[1] - 3 * k], [H[0] - 1 * k, H[1] - 7.5 * k], [H[0] + 5 * k, H[1] - 4 * k], [H[0] + 5.2 * k, H[1] + 3 * k], [H[0], H[1] + 5.4 * k]]), bodyG, 2.6) + c.p(poly([[H[0] - 1 * k, H[1] - 7.5 * k], [H[0] + 5 * k, H[1] - 4 * k], [H[0] + 1 * k, H[1] - 2 * k]]), '#c9c0ff', 0, ' opacity="0.5"');
    } else {
      body += c.ci(H[0], H[1], 5.8 * k, bodyG, 2.6);
      body += c.p(`M${f(H[0] - 6 * k)} ${f(H[1] - 1 * k)}Q${f(H[0] - 5 * k)} ${f(H[1] - 7.5 * k)} ${f(H[0] + 0.5 * k)} ${f(H[1] - 6.8 * k)}Q${f(H[0] + 5.5 * k)} ${f(H[1] - 6.4 * k)} ${f(H[0] + 5.8 * k)} ${f(H[1] - 1.6 * k)}Q${f(H[0] + 2 * k)} ${f(H[1] - 3.4 * k)} ${f(H[0] - 1 * k)} ${f(H[1] - 2.4 * k)}Q${f(H[0] - 3.5 * k)} ${f(H[1] - 1.2 * k)} ${f(H[0] - 6 * k)} ${f(H[1] - 1 * k)}Z`, c.vg('#6fae3e', 0.35, -0.2), 1.6);
    }
    if (g.helm) body += g.helm(c, H, k);
    body += aura(c, H[0] + 3 * k, H[1] + 0.5 * k, 4 * k, 3 * k, G.eye, 0.6) + c.e(H[0] + 1.6 * k, H[1] + 0.6 * k, 0.9 * k, 1.2 * k, G.eye, 0) + c.e(H[0] + 4.1 * k, H[1] + 0.5 * k, 0.8 * k, 1.1 * k, G.eye, 0);
    const handB = c.ci(aB[0], aB[1], 2.8 * k, c.sg(hs(col, -0.12)), 2.2);
    const front = arm(sF, aF, bend[1], col) + c.ci(aF[0], aF[1], 3 * k, c.sg(col), 2.2);
    return { back, body, handB, front, H, k };
  }
  /** 창: 쥔 곳 hd, 각 ang(위로 -90), 손 위로 up, 아래로 dn */
  function spear(c, hd, ang, up, dn, tip = '#8a8478') {
    const a = pol(hd, -dn, ang);
    const b = pol(hd, up, ang);
    const t = pol(b, 6, ang);
    return c.ol(`M${pp(a)}L${pp(b)}`, '#9a6a3a', 2) + c.p(`M${pp(pol(b, 2.4, ang + 90))}Q${pp(pol(pol(b, 3, ang), 2.2, ang + 90))} ${pp(t)}Q${pp(pol(pol(b, 3, ang), 2.2, ang - 90))} ${pp(pol(b, 2.4, ang - 90))}Z`, c.vg(tip, 0.4, -0.2), 1.8);
  }
  /** 깃발: 장대 아래 (x,y), 높이 ht, wave 0(늘어짐) · 1(날림) · 2(펄럭임) */
  function banner(c, x, y, ht, col, wave, fw = 16, o = {}) {
    const t = y - ht;
    const L = fw;
    const A2 = [[0, 0], [0.4 * L, -3], [0.6 * L, 3], [L, 1], [0.78 * L, 6], [L, 11], [0.6 * L, 13], [0.4 * L, 8], [0, 11]];
    const A0 = [[0, 0], [2.6, 0.35 * L], [4.2, 0.65 * L], [4.8, L + 1], [2.8, L + 0.6], [1.8, L + 3.4], [1, 0.75 * L], [0.4, 0.5 * L], [0, 11]];
    const tt = wave / 2;
    const P = A2.map((p, i) => [x + lerp(A0[i][0], p[0], tt), t + lerp(A0[i][1], p[1], tt)]);
    const d = `M${pp(P[0])}C${pp(P[1])} ${pp(P[2])} ${pp(P[3])}L${pp(P[4])}L${pp(P[5])}C${pp(P[6])} ${pp(P[7])} ${pp(P[8])}Z`;
    let s = beam(c, [x, y], [x, t - 2], 2.2, M.woodD, { grain: false });
    s += c.p(d, c.def(`ban${col}`, (id) => c.lgc(id, [[0, hs(col, 0.25)], [0.5, col], [1, hs(col, -0.3)]], 'd')), 2.2);
    // 깃발 무늬(산 모양 — 좌우 대칭)와 주름
    const m = mix2(P[0], P[5], 0.5);
    const cc = [lerp(m[0], P[3][0], 0.35), lerp(m[1], P[3][1], 0.35)];
    if (o.emblem !== false) s += c.p(`M${f(cc[0] - 2.6)} ${f(cc[1] + 2)}L${f(cc[0])} ${f(cc[1] - 2.4)}L${f(cc[0] + 2.6)} ${f(cc[1] + 2)}Z`, o.emblem || '#f4ead0', 1);
    s += c.ln(`M${pp(mix2(P[1], P[7], 0.5))}L${pp(mix2(P[2], P[6], 0.5))}`, hs(col, -0.35), 0.9, 0.7);
    s += c.ci(x, t - 3, 2.1, c.sg(M.gold), 1.8);
    return s;
  }
  /** 돌 아치 문: 가운데 x, 바닥 yb, 너비 w, 높이 ht, open 0 닫힘 · 1 반쯤 · 2 활짝, o.inside 안쪽 그림, o.portcullis 쇠창살 */
  function gate(c, x, yb, w, ht, open, o = {}) {
    const h = c.h;
    const r = w / 2;
    const ys = yb - ht + r;
    const st = o.stone || '#b8b2a4';
    const d = `M${f(x - r)} ${f(yb)}V${f(ys)}A${f(r)} ${f(r)} 0 0 1 ${f(x + r)} ${f(ys)}V${f(yb)}Z`;
    let s = '';
    if (o.arch !== false) {
      const R2 = r + 3.2;
      s += c.p(`M${f(x - R2)} ${f(yb)}V${f(ys)}A${f(R2)} ${f(R2)} 0 0 1 ${f(x + R2)} ${f(ys)}V${f(yb)}Z`, c.vg(st, 0.25, -0.15), 2.6);
      let jd = '';
      for (let i = 1; i < 6; i++) { const a = 180 + i * 30; jd += `M${pp(pol([x, ys], r, a))}L${pp(pol([x, ys], R2, a))}`; }
      for (let yy = ys + 4.5; yy < yb - 1; yy += 5) jd += `M${f(x - R2)} ${f(yy)}H${f(x - r)}M${f(x + r)} ${f(yy)}H${f(x + R2)}`;
      s += c.ln(jd, hs(st, -0.45), 1);
      // 이맛돌(쐐기돌)
      s += c.p(poly([pol([x, ys], r - 0.5, -100), pol([x, ys], R2 + 1.2, -104), pol([x, ys], R2 + 1.2, -76), pol([x, ys], r - 0.5, -80)]), o.key || hs(st, 0.15), 1.6);
    }
    const inner = open > 0 ? c.def('gateLit', (id) => c.rgc(id, [[0, '#ffcf7a'], [0.35, '#a8602a'], [0.75, '#3a2018'], [1, '#140c0c']], 0.5, 0.95, 0.9)) : c.def('gateIn', (id) => c.rgc(id, [[0, '#2a2018'], [0.7, '#140e10'], [1, '#0a0608']], 0.5, 0.8, 0.8));
    s += c.p(d, inner, 0);
    if (open > 0 && o.inside) s += clip(c, d, o.inside);
    const wood = o.wood || M.wood;
    if (o.portcullis) {
      const lift = (open / 2) * (ht - 4);
      let bars = '';
      for (let bx = x - r + 2.2; bx < x + r; bx += 3.4) bars += `M${f(bx)} ${f(ys - r - 2 - lift)}V${f(yb - lift + 1.5)}`;
      for (let by2 = ys - r + 3; by2 < yb + 2; by2 += 4) bars += `M${f(x - r)} ${f(by2 - lift)}H${f(x + r)}`;
      let pts = '';
      for (let bx = x - r + 2.2; bx < x + r; bx += 3.4) pts += `M${f(bx - 0.9)} ${f(yb - lift + 1.5)}L${f(bx)} ${f(yb - lift + 3.4)}L${f(bx + 0.9)} ${f(yb - lift + 1.5)}Z`;
      s += clip(c, d, c.ln(bars, OL, 2.6) + c.ln(bars, M.ironL, 1.3) + c.p(pts, M.iron, 1));
    } else {
      const leafW = [w * 0.5, w * 0.3, w * 0.11][open];
      const band = (x0, x1) => c.ln(`M${f(x0)} ${f(ys + 1.5)}H${f(x1)}M${f(x0)} ${f(yb - 4.5)}H${f(x1)}`, M.iron, 1.5);
      const leaf = (x0, x1, sd) => clip(c, d, planks(c, `M${f(x0)} ${f(yb - ht - 2)}H${f(x1)}V${f(yb)}H${f(x0)}Z`, [x0, yb - ht - 2, x1, yb], open === 0 ? wood : hs(wood, -0.25), { pw: open === 0 ? 3 : 2.2, seed: sd, w: open === 0 ? 0 : 1.6 }) + band(x0, x1) + (open === 0 ? '' : ''));
      s += leaf(x - r, x - r + leafW, 3) + leaf(x + r - leafW, x + r, 4);
      if (open === 0) s += c.ln(`M${f(x)} ${f(ys - r + 1)}V${f(yb)}`, OL, 1.1) + c.ci(x - 1.8, yb - ht * 0.42, 1.2, 'none', 0, ` stroke="${M.iron}" stroke-width="${c.sw(1)}"`) + c.ci(x + 1.8, yb - ht * 0.42, 1.2, 'none', 0, ` stroke="${M.iron}" stroke-width="${c.sw(1)}"`);
      if (open > 0) s += c.p(d, OL, 0, ' opacity="0.12"');
    }
    s += c.p(d, 'none', 2.4);
    return s;
  }
  /** 화살 구멍(좁은 창) */
  const slit = (c, x, y, ht, lit = 0.4) => c.r(x - 1.5, y - ht / 2, 3, ht, lit ? c.vg(c.h.mix('#20161a', '#ffcf6a', lit), 0, -0.3) : '#1a1216', 0.6, 1.8) + c.r(x - 2.6, y + ht / 2, 5.2, 1.6, '#c9c2b4', 0.3, 1.2);
  /** 문지기 골렘 자세: 앞손에 창(쉬기: 세워 듦 → aim: 앞으로 기울여 겨눔 → fire: 머리 위로 치켜든 경례), 뒷팔에 둥근 방패 */
  function guardPose(pose, x, y) {
    return by(pose,
      { lean: 0, hB: [x - 7, y - 13], hF: [x + 7.5, y - 12], sa: -90 },
      { lean: 5, hB: [x - 6.5, y - 14], hF: [x + 10, y - 17], sa: -52 },
      { lean: -4, hB: [x - 7, y - 14], hF: [x + 6, y - 29], sa: -90 });
  }
  /** 문간에서 걸어 나오는 골렘(머리·어깨) */
  const emerging = (c, x, yb, k, kind) => {
    const G = golemFig(c, { x, y: yb + 2, k, kind, hands: [[x - 6 * k, yb - 6 * k], [x + 7 * k, yb - 8 * k]] });
    return G.back + G.body + G.handB + G.front;
  };

  T.stone_barracks = {
    muzzle: [[50, 60], [50, 50], [50, 44], [50, 36], [50, 40]],
    draw(c, v, pose = 'idle') {
      const h = c.h;
      const E = c.E;
      const st = STONE.earth;
      const open = by(pose, 0, 1, 2);
      const wave = by(pose, 0.3, 1.2, 2);
      if (v === 1 || v === 2 || v === 3) {
        const L = v;
        let o = base(c, L, L === 1 ? { seed: 51 } : { stone: st, seed: 51 });
        if (L === 3) o += aura(c, 50, 64, 32, 28, E.color, 0.45);
        o += ao(c, 50, 104, 34, 9, 0.55);
        if (L === 1) {
          // 막돌 움막(벌집 모양) + 이끼 지붕
          o += banner(c, 25, 103, 50, E.color, wave, 14);
          const dd = 'M20 104A30 42 0 0 1 80 104A30 9 0 0 1 20 104Z';
          o += masonry(c, dd, [18, 60, 82, 114], M.rough, { rough: true, round: true, rowH: 6, bw: 8.5, bulge: 6, gap: 0.7, mortar: '#4e463c', seed: 52, bot: 0.4, top: 0.1, k1: 0.15 });
          o += mossPatch(c, 50, 70, 34, 9, 4) + mossPatch(c, 70, 86, 8, 3, 7);
          o += slit(c, 33, 86, 7, 0.5) + slit(c, 67, 86, 7, 0.5);
          o += gate(c, 50, 106, 15, 22, open, { stone: '#a8a092', inside: emerging(c, 50, 107, 0.62, 'stone') });
        } else {
          const L3 = L === 3;
          // 둥근 성탑: 다듬은 돌 벽 + 흉벽 + 뒤로 보이는 이끼 돔
          o += masonry(c, 'M29 72A22 22 0 0 1 73 72Z', [29, 50, 73, 72], hs(st, -0.05), { rough: true, round: true, rowH: 5, bw: 7, bulge: 3, gap: 0.6, seed: 54 }) + mossPatch(c, 51, 56, 30, 8, 9);
          o += banner(c, 51, 54, 30, E.color, wave, L3 ? 18 : 15);
          o += masonry(c, cylD(50, 72, 104, 29, 8.7), [21, 72, 79, 104], st, { round: true, rowH: 5, bw: 8.5, bulge: 8.7, seed: 53, bot: 0.35, top: 0.35, k1: 0.18 });
          // 흉벽(앞쪽 반원을 따라 돌출 돌)
          o += c.p(`M19 72A31 9.3 0 0 0 81 72V68A31 9.3 0 0 1 19 68Z`, c.vg(hs(st, 0.2), 0.2, -0.2), 2.4);
          [-70, -40, -12, 16, 44, 72].forEach((dg, i) => {
            const a = dg * RAD;
            const x = 50 + 31 * Math.sin(a);
            const y = 68 + 9.3 * Math.cos(a);
            const wd = 6.4 * Math.cos(a) + 1.2;
            o += c.p(`M${f(x - wd / 2)} ${f(y)}V${f(y - 6)}H${f(x + wd / 2)}V${f(y)}Z`, c.vg(hs(st, 0.1 - 0.35 * ((Math.sin(a) + 1) / 2)), 0.25, -0.15), 2.2);
            if (i === 2) o += c.ln(`M${f(x - wd / 2 + 0.8)} ${f(y - 3)}H${f(x + wd / 2 - 0.8)}`, hs(st, -0.4), 0.9);
          });
          o += c.r(22, 74, 56, 2.4, OL, 0, 0, ' opacity="0.25"');
          o += slit(c, 31, 86, 8, 0.55) + slit(c, 69, 86, 8, 0.55);
          if (L3) {
            // 횃불 받침
            [[36, 92], [64, 92]].forEach(([x, y]) => {
              o += c.ol(`M${x} ${y}V${y - 6}`, M.iron, 1.4) + c.p(`M${x - 2.4} ${y - 6}H${x + 2.4}L${x + 1.6} ${y - 3.6}H${x - 1.6}Z`, M.iron, 1.2);
              o += aura(c, x, y - 10, 6, 6, '#ffb347', 0.7) + RG.art._tw.flame(c, x, y - 6, 4.4, by(pose, 6, 7, 8));
            });
          }
          o += gate(c, 50, 106, 18, 26, open, { stone: hs(st, 0.3), key: L3 ? E.color : null, wood: M.wood, inside: emerging(c, 50, 107, 0.72, 'stone') });
          if (L3) o += crystal(c, 50, 76, 7, 10, E.color, 2) + c.ln('M44.5 93.5H55.5', M.gold, 1.6);
        }
        // 문지기 골렘: 앞손에 창, 뒷팔에 방패
        const gk = [0, 0.9, 1, 1][L];
        const gx = L === 1 ? 76 : 80;
        const gy = L === 1 ? 110 : 112;
        const GP = guardPose(pose, gx, gy);
        const sc = (p) => [gx + (p[0] - gx) * gk, gy + (p[1] - gy) * gk];
        const G = golemFig(c, { x: gx, y: gy, k: gk, kind: 'stone', lean: GP.lean, hands: [sc(GP.hB), sc(GP.hF)], bend: [1, pose === 'fire' ? -1 : 1], helm: L === 3 ? (cc, H, k) => cc.p(`M${f(H[0] - 6.2 * k)} ${f(H[1] - 1.2 * k)}Q${f(H[0])} ${f(H[1] - 10.5 * k)} ${f(H[0] + 6.2 * k)} ${f(H[1] - 1.2 * k)}Q${f(H[0])} ${f(H[1] - 3.4 * k)} ${f(H[0] - 6.2 * k)} ${f(H[1] - 1.2 * k)}Z`, cc.vg(M.gold, 0.35, -0.25), 1.8) : null });
        const hb = sc(GP.hB);
        const shield = c.ci(hb[0] - 1, hb[1], 6 * gk, c.sg('#9a6a3a'), 2.4) + c.ci(hb[0] - 1, hb[1], 3.8 * gk, 'none', 0, ` stroke="#6a4424" stroke-width="${c.sw(1.2)}"`) + c.ci(hb[0] - 1, hb[1], 1.6 * gk, L >= 2 ? E.color : '#c9c2b4', 1.2);
        const sp = spear(c, sc(GP.hF), GP.sa, 15 * gk, 12 * gk, L === 3 ? '#cfd6de' : '#8a8478');
        o += G.back + shield + G.body + sp + G.handB + G.front;
        if (pose === 'fire') o += c.ln(`M${f(gx + 11)} ${f(gy - 34)}l3 -2.4M${f(gx + 12)} ${f(gy - 29)}l3.6 0`, '#fff', 1.5, 0.85);
        return o;
      }
      if (v === 'A') {
        // 화강암 성채: 양쪽 둥근 탑 + 흉벽 + 쇠창살 문. 문지기는 큰 방패와 철퇴
        const gs = '#a3a08c';
        let o = base(c, 4, { stone: '#8f8e78', seed: 55 });
        o += ao(c, 50, 99, 38, 8, 0.55);
        o += banner(c, 80, 24, 20, E.color, wave, 16);
        // 성벽
        o += masonry(c, 'M22 100V48H78V100Q50 106 22 100Z', [22, 48, 78, 106], gs, { rowH: 5, bw: 9, seed: 56, bot: 0.35, top: 0.3, k1: 0.15 });
        o += masonry(c, 'M20 48V39H28V43H36V39H44V43H56V39H64V43H72V39H80V48Z', [20, 39, 80, 48], hs(gs, 0.1), { rowH: 4.5, bw: 8, seed: 57, w: 2.6 });
        o += c.r(22, 48, 56, 2.2, OL, 0, 0, ' opacity="0.3"');
        [20, 80].forEach((x, i) => {
          o += masonry(c, cylD(x, 34, 100, 11, 3.3), [x - 11, 34, x + 11, 104], gs, { round: true, rowH: 5, bw: 6, bulge: 3.3, seed: 58 + i, bot: 0.35, top: 0.3, k1: 0.12 });
          o += masonry(c, `M${x - 13} 36V24H${x - 7}V29H${x - 3}V24H${x + 3}V29H${x + 7}V24H${x + 13}V36Z`, [x - 13, 24, x + 13, 36], hs(gs, 0.12), { rowH: 4, bw: 6, seed: 60 + i, w: 2.6 });
          o += c.p(`M${x - 13} 36A13 3.6 0 0 0 ${x + 13} 36V38A13 3.6 0 0 1 ${x - 13} 38Z`, OL, 0, ' opacity="0.3"');
          o += slit(c, x, 60, 8, 0.6) + slit(c, x, 80, 8, 0.6);
        });
        // 문장(이끼 방패)
        o += c.p('M50 52C56 54 61 54 63 53V63C63 71 57 76 50 79C43 76 37 71 37 63V53C39 54 44 54 50 52Z', c.vg('#6fae3e', 0.3, -0.25), 2.6);
        o += c.p('M42 70L48 60L51 65L54 62L58 70Z', c.vg(E.light, 0.2, -0.1), 1.6);
        o += gate(c, 50, 100, 20, 22, open, { stone: hs(gs, 0.2), portcullis: true, inside: emerging(c, 50, 101, 0.72, 'granite') });
        // 문지기: 화강암 골렘. 앞손 방패, 뒷손 철퇴
        const gx = 24;
        const gy = 105;
        const GP = by(pose,
          { lean: 0, hB: [gx - 6, gy - 9], hF: [gx + 8, gy - 13], ma: 120 },
          { lean: -8, hB: [gx - 4, gy - 30], hF: [gx + 9, gy - 17], ma: -130 },
          { lean: 8, hB: [gx + 6, gy - 22], hF: [gx + 9.5, gy - 16], ma: -20 });
        const G = golemFig(c, { x: gx, y: gy, k: 0.95, kind: 'granite', lean: GP.lean, hands: [GP.hB, GP.hF], bend: [1, 1] });
        const mace = (() => {
          const e = pol(GP.hB, 9, GP.ma);
          let sp = '';
          for (let i = 0; i < 6; i++) sp += `M${pp(pol(e, 3.2, i * 60))}L${pp(pol(e, 5.4, i * 60 + 6))}`;
          return c.ol(`M${pp(pol(GP.hB, -2, GP.ma))}L${pp(e)}`, '#6a4424', 2.2) + c.ln(sp, OL, 2.2) + c.ci(e[0], e[1], 3.8, c.sg('#8a7a72'), 2.2);
        })();
        const sx = GP.hF[0] + 1;
        const sy = GP.hF[1];
        const shield = c.p(`M${f(sx - 6)} ${f(sy - 11)}H${f(sx + 6)}Q${f(sx + 8)} ${f(sy - 11)} ${f(sx + 8)} ${f(sy - 9)}V${f(sy + 6)}Q${f(sx + 8)} ${f(sy + 11)} ${f(sx + 1)} ${f(sy + 14)}Q${f(sx - 6)} ${f(sy + 11)} ${f(sx - 6)} ${f(sy + 6)}Z`, c.cg('#9c8a82'), 2.8)
          + c.p(`M${f(sx - 6)} ${f(sy - 10)}H${f(sx + 8)}V${f(sy - 7)}C${f(sx + 4)} ${f(sy - 9)} ${f(sx - 2)} ${f(sy - 9)} ${f(sx - 6)} ${f(sy - 7)}Z`, c.vg('#6fae3e', 0.2, -0.2), 1.6)
          + aura(c, sx + 1, sy + 1, 7, 7, '#8dffb0', pose === 'fire' ? 0.9 : 0.35) + c.p(`M${f(sx + 1)} ${f(sy - 4)}l4 5.5l-4 6.5l-4 -6.5z`, c.sg('#6dff9a'), 1.8)
          + rivets(c, [[sx - 4, sy - 5], [sx + 6, sy - 5], [sx - 4, sy + 6], [sx + 6, sy + 6]], '#d8d0c8', 0.6);
        if (pose === 'fire') o += G.back + G.body + shield + G.front + mace + G.handB + c.ln(`M${f(sx + 11)} ${f(sy - 10)}q4 9 0 18M${f(sx + 15)} ${f(sy - 13)}q6 12 0 24`, '#fff', 1.8, 0.85);
        else o += G.back + mace + G.handB + G.body + shield + G.front;
        return o;
      }
      // 'B' 흑요석 검사: 흑요석 가시를 두른 막사, 문지기는 흑요석 골렘 검사
      const ob = '#3e3a46';
      let o = base(c, 4, { stone: '#55524a', trim: E.color, seed: 63 });
      o += aura(c, 50, 50, 40, 40, E.color, by(pose, 0.3, 0.4, 0.55));
      o += ao(c, 50, 99, 36, 8, 0.55);
      const sp = (x, yt, yb, w) => shard(c, x, yt, yb, w, '#4d4858', 2.6);
      o += sp(22, 30, 80, 14) + sp(78, 26, 80, 15) + sp(36, 14, 70, 14) + sp(64, 12, 70, 14);
      o += banner(c, 80, 30, 18, E.color, wave, 15, { emblem: false });
      const wall = 'M16 100L20 70L34 54L50 48L66 54L80 70L84 100Q50 108 16 100Z';
      o += masonry(c, wall, [16, 48, 84, 108], ob, { rowH: 6, bw: 10, seed: 64, bot: 0.35, mortar: '#16121c', lit: 0.05 });
      o += c.ln('M20 70L36 72L50 62L64 72L80 70M36 72L34 100M64 72L66 100M50 62V48', E.color, 1.6, 0.8);
      o += sp(50, 4, 56, 16);
      o += gate(c, 50, 100, 18, 24, open, { stone: '#5a5468', key: E.color, wood: '#2e2838', inside: emerging(c, 50, 101, 0.7, 'obsidian') });
      o += c.ol('M38 60L62 84M62 60L38 84', M.silver, 2.2) + c.ol('M41 63L36 58M59 63L64 58', M.gold, 2.4);
      // 문지기 검사
      const gx = 27;
      const gy = 105;
      const GP = by(pose,
        { lean: 0, hB: [gx - 6, gy - 10], hF: [gx + 7, gy - 11], ba: 100 },
        { lean: -3, hB: [gx - 5, gy - 12], hF: [gx + 6, gy - 21], ba: -88 },
        { lean: 10, hB: [gx - 7, gy - 11], hF: [gx + 12, gy - 17], ba: -12 });
      const G = golemFig(c, { x: gx, y: gy, k: 0.92, kind: 'obsidian', lean: GP.lean, hands: [GP.hB, GP.hF], bend: [1, 1] });
      const blade = (() => {
        const e = pol(GP.hF, 21, GP.ba);
        const s0 = pol(GP.hF, 3, GP.ba);
        return c.p(`M${pp(pol(s0, 1.8, GP.ba + 90))}L${pp(pol(e, 0.8, GP.ba + 90))}L${pp(pol(e, 3, GP.ba))}L${pp(pol(e, 0.8, GP.ba - 90))}L${pp(pol(s0, 1.8, GP.ba - 90))}Z`, c.vg('#3a3450', 0.5, -0.1), 2.2)
          + c.ln(`M${pp(pol(s0, 0.6, GP.ba + 90))}L${pp(pol(e, 0.2, GP.ba + 90))}`, '#d8d0ff', 1, 0.9)
          + c.ol(`M${pp(pol(GP.hF, 2.6, GP.ba + 90))}L${pp(pol(GP.hF, 2.6, GP.ba - 90))}`, '#8dffb0', 1.6);
      })();
      if (pose === 'fire') o += c.p(`M${f(gx + 6)} ${f(gy - 40)}Q${f(gx + 38)} ${f(gy - 30)} ${f(gx + 34)} ${f(gy - 6)}Q${f(gx + 30)} ${f(gy - 26)} ${f(gx + 6)} ${f(gy - 40)}Z`, '#d8d0ff', 0, ' opacity="0.7"');
      o += G.back + G.handB + G.body + blade + G.front;
      return o;
    },
  };

  /* ================================================================
   * 🪨 대지 망치 — 물레방아 공이(트립 해머). 물레바퀴 축의 캠이 자루 꼬리를 눌러 머리가 들리고(aim),
   * 캠이 빠지면 돌 머리가 모루돌을 내리찍음(fire: 먼지·금·충격파).
   * 4A 지진 망치: 두 돌기둥 사이 말뚝박기 — 거대한 쌍머리를 끝까지 끌어올렸다 땅에 떨어뜨림.
   * 4B 가시 대지: 같은 공이에 가시 철퇴, 내리찍으면 둘레에 가시가 솟음.
   * ================================================================ */
  /** 물레바퀴: 가운데 (x,y), 반지름 R, 돌아간 각 spin */
  function waterWheel(c, x, y, R, spin, hub, o = {}) {
    const h = c.h;
    let spokes = '';
    let pads = '';
    const n = 8;
    for (let i = 0; i < n; i++) {
      const a = spin + (i * 360) / n;
      spokes += `M${pp(pol([x, y], R * 0.22, a))}L${pp(pol([x, y], R * 0.94, a))}`;
      const p0 = pol([x, y], R * 0.94, a);
      pads += `M${pp(p0)}L${pp(pol(p0, R * 0.3, a + 75))}`;
    }
    let s = c.ci(x, y, R, 'none', 0, ` stroke="${OL}" stroke-width="${c.sw(6.6)}"`) + c.ci(x, y, R, 'none', 0, ` stroke="${M.wood}" stroke-width="${c.sw(4)}"`);
    s += c.ci(x, y, R - 1.1, 'none', 0, ` stroke="${hs(M.wood, -0.35)}" stroke-width="${c.sw(0.9)}"`);
    s += c.ln(spokes, OL, 4.4) + c.ln(spokes, hs(M.wood, -0.1), 2.2);
    s += c.ln(pads, OL, 5.4) + c.ln(pads, M.plank, 3);
    s += c.ci(x, y, R * 0.24, c.sg(hub), 2.4) + c.ci(x, y, R * 0.09, OL, 0);
    if (o.wet) s += c.ln(`M${f(x - R * 0.7)} ${f(y + R * 0.8)}q-2 3 0 5M${f(x + R * 0.2)} ${f(y + R * 1.05)}q-1.5 2.5 0 4.5`, '#bfe8ff', 1.4, 0.8);
    return s;
  }
  /** 모루돌: 앞면 x1~x2, 앞 윗변 yt, 바닥 yb, 깊이 d */
  function anvilStone(c, x1, x2, yt, yb, d, col, seed) {
    const h = c.h;
    let s = c.p(poly([[x1, yt], [x1 + d * 0.6, yt - d], [x2 + d * 0.6, yt - d], [x2, yt]]), c.vg(hs(col, 0.25), 0.15, -0.05), 2.6);
    s += c.p(poly([[x2, yt], [x2 + d * 0.6, yt - d], [x2 + d * 0.6, yb - d], [x2, yb]]), c.vg(hs(col, -0.35), 0.1, -0.2), 2.6);
    s += masonry(c, `M${x1} ${yt}H${x2}V${yb}H${x1}Z`, [x1, yt, x2, yb], col, { rowH: (yb - yt) / 2, bw: 8, seed, bot: 0.35 });
    return s;
  }
  /** 먼지 구름 한 덩이 */
  const puff = (c, x, y, r, col = '#d8ccb0') => c.p(`M${f(x - r)} ${f(y)}Q${f(x - r * 1.1)} ${f(y - r * 0.9)} ${f(x - r * 0.3)} ${f(y - r * 0.8)}Q${f(x)} ${f(y - r * 1.5)} ${f(x + r * 0.5)} ${f(y - r * 0.9)}Q${f(x + r * 1.2)} ${f(y - r * 0.8)} ${f(x + r)} ${f(y)}Q${f(x)} ${f(y + r * 0.35)} ${f(x - r)} ${f(y)}Z`, c.vg(col, 0.25, -0.15), 1.8, ' opacity="0.92"');
  /** 내리찍는 순간 효과: 충격파·먼지·금·돌조각 */
  function slamFx(c, x, y, k, col, o = {}) {
    let s = c.e(x, y + 3, 26 * k, 7.5 * k, 'none', 0, ` stroke="${col}" stroke-width="${c.sw(2.6)}" opacity="0.85"`) + c.e(x, y + 3, 34 * k, 10 * k, 'none', 0, ` stroke="#fff" stroke-width="${c.sw(1.6)}" opacity="0.5"`);
    s += puff(c, x - 15 * k, y + 1, 6 * k) + puff(c, x + 16 * k, y + 2, 6.5 * k) + puff(c, x - 7 * k, y + 4, 4.5 * k) + puff(c, x + 7 * k, y + 5, 4.2 * k);
    s += c.ln(`M${f(x - 3)} ${f(y + 1)}l-5 3l-4 -1M${f(x + 3)} ${f(y + 1)}l6 2l3 3M${f(x)} ${f(y + 2)}l1 5`, o.crackGlow || OL, o.crackGlow ? 1.6 : 1.3, 0.85);
    s += c.p(`M${f(x - 12 * k)} ${f(y - 12 * k)}l2.2 -1.6l1.4 2.2l-2 1.4z M${f(x + 14 * k)} ${f(y - 14 * k)}l2.6 -1l0.8 2.4l-2.4 1z M${f(x + 5 * k)} ${f(y - 18 * k)}l1.8 -1.6l1.2 1.8l-1.8 1.4z`, '#a8a088', 1.2);
    s += c.ln(`M${f(x - 20 * k)} ${f(y - 8 * k)}l-3 -3M${f(x + 22 * k)} ${f(y - 8 * k)}l3 -3M${f(x)} ${f(y - 24 * k)}v-3`, '#fff', 1.5, 0.8);
    return s;
  }
  /** 물 홈통: 위 (x1,y1) → 끝 (x2,y2), 끝에서 물이 떨어짐 */
  function flume(c, x1, y1, x2, y2, fall) {
    let s = c.p(poly([[x1, y1 - 2], [x2, y2 - 2], [x2, y2 + 2.5], [x1, y1 + 2.5]]), c.vg(M.wood, 0.25, -0.25), 2.2) + c.ln(`M${f(x1)} ${f(y1 - 1.2)}L${f(x2)} ${f(y2 - 1.2)}`, '#8fd4f0', 1.6);
    s += c.p(`M${f(x2 - 0.5)} ${f(y2)}Q${f(x2 + 4)} ${f(y2 + 1)} ${f(x2 + 4.5)} ${f(y2 + fall)}H${f(x2 + 1)}Q${f(x2 + 1.5)} ${f(y2 + 3)} ${f(x2 - 0.5)} ${f(y2 + 2.5)}Z`, c.vg('#bfe8ff', 0.3, -0.1), 1.4, ' opacity="0.9"');
    return s;
  }
  /*
   * 트립 해머 한 벌 (Lv1~3, 4B)
   * o: L(1~3, 4), mace(4B 가시 철퇴), thorns
   */
  function tripHammer(c, pose, o) {
    const h = c.h;
    const E = c.E;
    const L = o.L;
    const st = STONE.earth;
    const top = L === 4 ? 99 : 104;
    const P = [44, top - 30];
    const al = by(pose, -10, -48, 20);
    const spin = by(pose, -22, 14, 52);
    const tail = pol(P, -13, al);
    const head = pol(P, 38, al);
    let s = '';
    // 물레바퀴(왼쪽) + 물 받이
    const wc = [20, top - 24];
    const R = L === 1 ? 13.5 : 15;
    if (L >= 2) s += beam(c, [7, top + 1], [6, wc[1] - R - 6], 2.4, M.woodD) + flume(c, 3, wc[1] - R - 8, wc[0] - 4, wc[1] - R - 4, 8);
    s += c.p(`M${f(wc[0] - R - 3)} ${f(top - 3)}V${f(top + 2)}H${f(wc[0] + R + 2)}V${f(top - 3)}Z`, c.vg('#7a7464', 0.2, -0.2), 2.2) + c.e(wc[0], top - 2.6, R + 1.5, 1.6, '#6cc8e6', 1.4);
    s += waterWheel(c, wc[0], wc[1], R, spin, L === 3 ? E.color : M.iron, { wet: L >= 2 });
    // 캠(축에 박힌 쐐기): 자루 꼬리를 누름
    const camTip = pol(wc, R + 1.5, spin);
    s += c.ol(`M${pp(wc)}L${pp(camTip)}`, M.woodD, 3.4) + c.ci(camTip[0], camTip[1], 2, c.sg(M.iron), 1.6);
    // 모루돌(오른쪽)
    s += ao(c, 79, top - 1, 15, 5, 0.5);
    s += anvilStone(c, 66, 88, top - 6, top + 3, 5, hs(st, -0.05), 81);
    if (o.thorns) s += o.thorns('back');
    // 받침(뒤 기둥)
    const post = (x, front) => (L === 1
      ? beam(c, [x - 7, top + 1], [P[0], P[1] + 2], 3.4, front ? M.wood : M.woodD)
      : masonry(c, `M${x - 5} ${top + 2}V${P[1] + 7}H${x + 5}V${top + 2}Z`, [x - 5, P[1] + 7, x + 5, top + 2], front ? st : hs(st, -0.2), { rowH: 4.4, bw: 10, seed: front ? 82 : 83, bot: 0.35, top: 0.2 })
        + c.r(x - 6.2, P[1] + 4.4, 12.4, 3.4, c.vg(hs(st, 0.25), 0.2, -0.2), 0.6, 2.2));
    if (L === 1) s += beam(c, [P[0] + 7, top + 1], [P[0], P[1] + 2], 3.4, M.woodD);
    else s += post(P[0] - 2, false);
    // 자루(공이대)
    s += beam(c, tail, head, L === 1 ? 4.2 : 4.8, M.wood);
    if (L >= 2) [0.3, 0.62].forEach((t) => { const q = mix2(tail, head, t); s += rotG(c.r(q[0] - 1.4, q[1] - 3.4, 2.8, 6.8, c.vg(L === 3 ? M.gold : M.iron, 0.35, -0.3), 0.5, 1.6), al, q); });
    // 머리
    if (o.mace) {
      let sp = '';
      for (let i = 0; i < 10; i++) { const a = i * 36 + al; sp += `M${pp(pol(head, 10, a - 12))}L${pp(pol(head, 17, a))}L${pp(pol(head, 10, a + 12))}Z`; }
      s += c.p(sp, c.vg('#d8d0b0', 0.25, -0.25), 2) + c.ci(head[0], head[1], 11.5, c.sg('#8a8670'), 2.8);
      s += c.p(`M${f(head[0] - 7)} ${f(head[1] - 6)}Q${f(head[0])} ${f(head[1] - 12)} ${f(head[0] + 7)} ${f(head[1] - 6)}Q${f(head[0] + 2)} ${f(head[1] - 7)} ${f(head[0] - 7)} ${f(head[1] - 6)}Z`, c.vg('#6fae3e', 0.3, -0.2), 1.4);
    } else {
      const hw = L === 1 ? 12 : 14;
      const hh = L === 1 ? 20 : 22;
      const hc = L === 1 ? M.rough : st;
      let b = masonry(c, `M${f(head[0] - hw / 2)} ${f(head[1] - hh / 2)}H${f(head[0] + hw / 2)}V${f(head[1] + hh / 2)}H${f(head[0] - hw / 2)}Z`, [head[0] - hw / 2, head[1] - hh / 2, head[0] + hw / 2, head[1] + hh / 2], hc, { rowH: hh / 3, bw: hw, seed: 85, round: true, w: 2.8 });
      if (L >= 2) b += c.r(head[0] - hw / 2 - 1, head[1] - hh / 2 + 2, hw + 2, 3.4, c.vg(L === 3 ? M.gold : M.iron, 0.35, -0.3), 0.6, 1.8) + c.r(head[0] - hw / 2 - 1, head[1] + hh / 2 - 5.4, hw + 2, 3.4, c.vg(L === 3 ? M.gold : M.iron, 0.35, -0.3), 0.6, 1.8);
      b += c.p(`M${f(head[0] - hw / 2)} ${f(head[1] - hh / 2 + 1)}Q${f(head[0])} ${f(head[1] - hh / 2 - 3)} ${f(head[0] + hw / 2)} ${f(head[1] - hh / 2 + 1)}Q${f(head[0] + 1)} ${f(head[1] - hh / 2 + 3)} ${f(head[0] - hw / 2)} ${f(head[1] - hh / 2 + 1)}Z`, c.vg('#6fae3e', 0.3, -0.2), 1.4);
      if (L === 3) b += aura(c, head[0], head[1], 9, 9, E.color, pose === 'idle' ? 0.4 : 0.8) + c.ln(`M${f(head[0] - 3.4)} ${f(head[1] + 3)}L${f(head[0])} ${f(head[1] - 3.6)}L${f(head[0] + 3.4)} ${f(head[1] + 3)}M${f(head[0] - 1.6)} ${f(head[1])}H${f(head[0] + 1.6)}`, E.light, 1.8);
      s += rotG(b, al, head);
    }
    // 앞 기둥 + 굴대(축)
    if (L === 1) s += beam(c, [P[0] - 7, top + 2], [P[0], P[1] + 2], 3.6, M.wood);
    else s += post(P[0] + 2, true) + c.p(`M${P[0] - 3} ${P[1] + 5}V${P[1] - 1}H${P[0] + 3}V${P[1] + 5}`, 'none', 0, ` stroke="${OL}" stroke-width="${c.sw(4.4)}"`) + c.p(`M${P[0] - 3} ${P[1] + 5}V${P[1] - 1}H${P[0] + 3}V${P[1] + 5}`, 'none', 0, ` stroke="${M.iron}" stroke-width="${c.sw(2)}"`);
    s += c.ci(P[0], P[1], 2.6, c.sg(L === 3 ? M.gold : M.ironL), 1.8);
    if (L === 3) s += crystal(c, P[0] + 2, P[1] + 12, 6, 8, E.color, 1.8);
    if (o.thorns) s += o.thorns('front');
    // 자세 효과
    const strike = [head[0] - 11 * Math.sin(al * RAD), head[1] + 11 * Math.cos(al * RAD)];
    if (pose === 'aim') s += spark(c, head[0] + 7, head[1] - 9, 3.6, '#fff', 1.2) + c.ln(`M${f(head[0] + 12)} ${f(head[1] + 2)}q4 6 2 12M${f(head[0] + 16)} ${f(head[1] - 2)}q5 8 3 16`, '#fff', 1.4, 0.6);
    if (pose === 'fire') s += slamFx(c, strike[0] + 2, top - 6, L === 4 ? 1 : 0.9, E.color, { crackGlow: L >= 3 ? E.light : null });
    return s;
  }

  T.quake_hammer = {
    muzzle: [[78, 98], [78, 98], [78, 98], [50, 97], [78, 93]],
    draw(c, v, pose = 'idle') {
      const h = c.h;
      const E = c.E;
      const st = STONE.earth;
      if (v === 1 || v === 2 || v === 3) {
        let o = base(c, v, v === 1 ? { seed: 71 } : { stone: st, seed: 71 });
        if (v === 3) o += aura(c, 60, 60, 36, 30, E.color, 0.35) + banner(c, 6, 104, 58, E.color, by(pose, 0.5, 1, 2), 12, { emblem: false });
        o += tripHammer(c, pose, { L: v });
        return o;
      }
      if (v === 'A') {
        // 지진 망치: 돌기둥 둘 + 꼭대기 들보·도르래, 가운데로 쌍머리 말뚝이 오르내림
        const gs = STONE.earth;
        const hy = by(pose, 58, 38, 87); // 머리 가운데
        const spin = by(pose, 0, 40, 80);
        let o = base(c, 4, { stone: '#8f8e78', seed: 73 });
        o += aura(c, 50, by(pose, 50, 34, 80), 40, 26, E.color, by(pose, 0.3, 0.55, 0.7));
        o += ao(c, 50, 99, 38, 8, 0.5);
        // 뒤 큰 바퀴(감는 틀)
        o += waterWheel(c, 50, 62, 21, spin, E.color);
        // 돌기둥
        [20, 80].forEach((x, i) => {
          o += masonry(c, `M${x - 6} 101V24H${x + 6}V101Z`, [x - 6, 24, x + 6, 101], gs, { rowH: 5.5, bw: 12, seed: 74 + i, bot: 0.35, top: 0.25, k1: 0.12 });
          o += c.r(x - 8, 19, 16, 7, c.vg(M.gold, 0.35, -0.3), 1.6, 2.6) + rivets(c, [[x - 5, 22.5], [x + 5, 22.5]], '#fff3c0', 0.7);
        });
        // 들보 + 도르래
        o += beam(c, [10, 17], [90, 17], 5, M.wood);
        o += c.ci(50, 17, 5, c.sg(M.ironL), 2.4) + c.ci(50, 17, 1.6, OL, 0);
        // 사슬
        const chainD = `M47 18V${f(hy - 14)}M53 18V${f(hy - 14)}`;
        o += c.ln(chainD, OL, 4.4) + `<path d="${chainD}" fill="none" stroke="${M.ironL}" stroke-width="${c.sw(2.4)}" stroke-dasharray="${c.sw(2.6)} ${c.sw(1.4)}"/>`;
        // 안내 홈(기둥 안쪽 쇠 테)
        o += c.ln('M26.5 30V98M73.5 30V98', OL, 2.6) + c.ln('M26.5 30V98M73.5 30V98', M.iron, 1.2);
        // 쌍머리: 가운데 자루 + 양쪽 머리(쇠 테·이끼)
        const head = masonry(c, `M24 ${f(hy - 10)}H76V${f(hy + 10)}H24Z`, [24, hy - 10, 76, hy + 10], '#8a8670', { rowH: 10, bw: 13, seed: 77, w: 3 })
          + c.r(23, hy - 11, 8, 22, c.vg(M.gold, 0.35, -0.3), 1.5, 2.4) + c.r(69, hy - 11, 8, 22, c.vg(M.gold, 0.35, -0.3), 1.5, 2.4)
          + c.r(44, hy - 15, 12, 6, c.vg(M.iron, 0.35, -0.3), 1, 2.2)
          + c.ln(`M33 ${f(hy - 4)}L37 ${f(hy + 2)}L34 ${f(hy + 7)}M64 ${f(hy - 5)}L67 ${f(hy + 1)}L64 ${f(hy + 6)}M48 ${f(hy - 6)}L52 ${f(hy + 2)}`, E.color, 2, pose === 'idle' ? 0.6 : 1);
        o += head;
        if (pose === 'aim') o += spark(c, 76, hy - 12, 4, '#fff', 1.2) + c.ln(`M30 ${f(hy + 14)}v5M50 ${f(hy + 14)}v6M70 ${f(hy + 14)}v5`, '#fff', 1.4, 0.6);
        if (pose === 'fire') {
          o += slamFx(c, 50, 96, 1.35, E.color, { crackGlow: E.light });
          // 기절 별
          [[30, 70], [50, 64], [70, 70]].forEach(([x, y]) => { o += spark(c, x, y, 3.2, '#ffe48a', 1.2); });
        }
        return o;
      }
      // 'B' 가시 대지: 가시 철퇴 공이 + 받침을 두른 가시덤불, 내리찍으면 가시가 솟음
      let o = base(c, 4, { stone: '#8f8e78', seed: 75 });
      const tall = by(pose, 1, 0.75, 1.6);
      const th = (x, y, k) => c.p(`M${f(x - 6 * k)} ${f(y)}L${f(x - 2 * k)} ${f(y - 15 * k * tall)}L${f(x + 1 * k)} ${f(y - 4 * k)}L${f(x + 4 * k)} ${f(y - 11 * k * tall)}L${f(x + 7 * k)} ${f(y)}Z`, c.vg('#6a8a34', 0.2, -0.35), 2) + c.ln(`M${f(x - 2 * k)} ${f(y - 15 * k * tall)}l-1.2 3M${f(x + 4 * k)} ${f(y - 11 * k * tall)}l1.4 2.6`, '#e8e0c0', 1, 0.9);
      const thorns = (layer) => (layer === 'back'
        ? th(64, 94, 0.8) + th(92, 92, 0.9) + th(80, 90, 0.7)
        : th(8, 104, 0.9) + th(22, 110, 0.9) + th(40, 113, 0.85) + th(58, 113, 0.8) + th(97, 101, 0.85) + c.ln('M4 102Q28 116 50 111Q72 116 96 100', '#4e6a26', 2.6, 0.9));
      o += tripHammer(c, pose, { L: 4, mace: true, thorns });
      if (pose === 'fire') o += th(60, 104, 1.1) + th(95, 99, 1.1) + th(86, 110, 0.7);
      return o;
    },
  };

  /* ================================================================
   * 🪨 수정 광산 — 광부가 곡괭이를 들었다(aim) 수정을 내리찍음(fire). 수레가 조금씩 굴러 나옴.
   * 4A 깊은 광맥: 같은 광부가 권양기 손잡이를 돌려 갱도에서 광석 통을 끌어 올림.
   * 4B 보석 세공소: 같은 광부가 앞치마를 두르고 망치로 정을 쳐 보석을 깎음.
   * ================================================================ */
  const MINER = { skin: '#eebd92', shirt: '#b98a56', pants: '#5c4a3c', boot: '#3e2c20', beard: '#7a4a2a' };
  /** 광부 얼굴: 눈, 코, 짧은 수염, 뒷머리 */
  function minerFace(loupe) {
    return (c, H, r) => {
      const [x, y] = H;
      let s = c.p(`M${f(x - r * 1.0)} ${f(y - r * 0.2)}Q${f(x - r * 1.12)} ${f(y + r * 0.6)} ${f(x - r * 0.55)} ${f(y + r * 0.86)}L${f(x - r * 0.25)} ${f(y + r * 0.1)}Z`, MINER.beard, 1.4);
      s += c.e(x + r * 0.42, y - r * 0.02, r * 0.16, r * 0.24, '#2a1a2e', 0);
      s += c.p(`M${f(x + r * 0.05)} ${f(y + r * 0.5)}Q${f(x + r * 0.25)} ${f(y + r * 1.2)} ${f(x + r * 0.66)} ${f(y + r * 1.05)}Q${f(x + r * 1.0)} ${f(y + r * 0.9)} ${f(x + r * 0.98)} ${f(y + r * 0.5)}Q${f(x + r * 0.7)} ${f(y + r * 0.68)} ${f(x + r * 0.05)} ${f(y + r * 0.5)}Z`, c.vg(MINER.beard, 0.2, -0.2), 1.4);
      s += c.e(x + r * 0.98, y + r * 0.18, r * 0.2, r * 0.16, hs(MINER.skin, -0.12), 1);
      if (loupe) s += c.ci(x + r * 0.42, y - r * 0.02, r * 0.34, 'none', 0, ` stroke="${M.gold}" stroke-width="${c.sw(1.3)}"`) + c.ci(x + r * 0.36, y - r * 0.1, r * 0.1, '#fff', 0);
      return s;
    };
  }
  /** 광부 모자: 1 천 모자, 2 가죽 투구 + 촛불, 3 쇠 투구 + 등, B 세공사 모자 */
  function minerHat(tier) {
    return (c, H, r) => {
      const [x, y] = H;
      const h = c.h;
      const dome = (col, hi) => c.p(`M${f(x - r * 1.08)} ${f(y - r * 0.05)}C${f(x - r * 1.1)} ${f(y - r * 1.25)} ${f(x + r * 0.9)} ${f(y - r * 1.4)} ${f(x + r * 1.0)} ${f(y - r * 0.3)}Q${f(x)} ${f(y - r * 0.55)} ${f(x - r * 1.08)} ${f(y - r * 0.05)}Z`, c.vg(col, hi, -0.25), 2.4);
      const brim = (col) => c.p(`M${f(x + r * 0.2)} ${f(y - r * 0.5)}Q${f(x + r * 1.2)} ${f(y - r * 0.55)} ${f(x + r * 1.55)} ${f(y - r * 0.2)}Q${f(x + r * 1.0)} ${f(y - r * 0.12)} ${f(x + r * 0.2)} ${f(y - r * 0.25)}Z`, col, 2);
      if (tier === 1) return dome('#8a5a3a', 0.2) + brim(hs('#8a5a3a', -0.2)) + c.ln(`M${f(x - r * 0.9)} ${f(y - r * 0.32)}Q${f(x)} ${f(y - r * 0.6)} ${f(x + r * 0.9)} ${f(y - r * 0.4)}`, '#5a3a24', 1.2);
      if (tier === 'B') return dome('#3f7a52', 0.25) + c.ln(`M${f(x - r * 1.0)} ${f(y - r * 0.2)}Q${f(x)} ${f(y - r * 0.55)} ${f(x + r * 0.98)} ${f(y - r * 0.38)}`, M.gold, 1.6) + c.ci(x - r * 0.2, y - r * 1.15, r * 0.22, M.gold, 1.2);
      const col = tier === 2 ? '#9a6a3a' : '#8e98a6';
      let s = dome(col, 0.35) + brim(hs(col, -0.25));
      s += c.ln(`M${f(x - r * 0.95)} ${f(y - r * 0.25)}Q${f(x)} ${f(y - r * 0.6)} ${f(x + r * 0.95)} ${f(y - r * 0.38)}`, tier === 2 ? '#5a3a20' : M.gold, 1.5);
      if (tier === 2) {
        // 촛불 받침
        s += c.r(x + r * 0.55, y - r * 1.25, r * 0.36, r * 0.6, '#f4ead0', 1.2) + c.p(`M${f(x + r * 0.73)} ${f(y - r * 1.75)}Q${f(x + r * 0.95)} ${f(y - r * 1.4)} ${f(x + r * 0.73)} ${f(y - r * 1.25)}Q${f(x + r * 0.52)} ${f(y - r * 1.4)} ${f(x + r * 0.73)} ${f(y - r * 1.75)}Z`, '#ffcf4a', 0.8);
      } else {
        // 쇠 투구 이마 등
        s += aura(c, x + r * 1.0, y - r * 0.75, r * 1.0, r * 0.8, '#fff3b0', 0.6) + c.r(x + r * 0.55, y - r * 1.05, r * 0.6, r * 0.55, c.vg(M.bronze, 0.3, -0.2), 0.6, 1.4) + c.ci(x + r * 1.12, y - r * 0.78, r * 0.24, '#fff6c8', 1);
      }
      return s;
    };
  }
  /** 곡괭이: 쥔 곳 gp, 각 ang, 길이 L */
  function pickaxe(c, gp, ang, L, head, band) {
    const E = toolEnd(gp, ang, L);
    const S = toolEnd(gp, ang, -1.6);
    const T1 = pol(E, 7.8, ang + 90);
    const T2 = pol(E, 6.2, ang - 90);
    let s = c.ol(`M${pp(S)}L${pp(E)}`, M.wood, 2.4) + c.ln(`M${pp(toolEnd(gp, ang, 2))}L${pp(toolEnd(gp, ang, L - 3))}`, M.woodD, 0.8, 0.7);
    s += c.p(`M${pp(T1)}Q${pp(pol(E, 5.5, ang))} ${pp(T2)}Q${pp(pol(E, -1.2, ang))} ${pp(T1)}Z`, c.vg(head, 0.4, -0.2), 2.2);
    s += c.ln(`M${pp(pol(T1, -1.8, ang + 90))}Q${pp(pol(E, 3.4, ang))} ${pp(pol(T2, -1.8, ang - 90))}`, hs(head, 0.45), 0.9, 0.9);
    if (band) s += c.ol(`M${pp(toolEnd(gp, ang, L - 2.6))}L${pp(toolEnd(gp, ang, L - 0.8))}`, band, 2.6);
    return s;
  }
  /** 광부 자세(Lv1~3 같은 자리) */
  const MINER_POSE = {
    idle: { hip: [24, 93.5], lean: 3, feet: [[19, 106], [30, 106]], g: [33, 88.5], ang: 72 },
    aim: { hip: [22.5, 94], lean: -12, feet: [[18, 106], [29, 106]], g: [26, 74], ang: -140 },
    fire: { hip: [26.5, 94.5], lean: 18, feet: [[19, 106], [32, 106]], g: [36, 88], ang: 10 },
  };
  function miner(c, pose, tier, held) {
    const P = MINER_POSE[pose];
    const gB = P.g;
    const gF = toolEnd(gB, P.ang, 3.4);
    const F = fig(c, { ...MINER, hip: P.hip, lean: P.lean, feet: P.feet, hands: [gB, gF], bend: [1, 1], glove: tier >= 3 ? '#8a5a34' : null, sleeve: tier >= 3 ? '#9a7246' : null, face: minerFace(false), hat: minerHat(tier) });
    const tool = pickaxe(c, gB, P.ang, 20, tier >= 3 ? '#9aa4b2' : '#6a7280', tier >= 3 ? M.gold : null);
    return figAll(F, tool + (held || ''));
  }
  /** 돌무더기(막돌 바위 언덕) */
  function rockMound(c, x1, x2, yb, ht, col, seed) {
    const w = x2 - x1;
    const d = `M${x1} ${yb}C${f(x1 - 2)} ${f(yb - ht * 0.6)} ${f(x1 + w * 0.15)} ${f(yb - ht)} ${f(x1 + w * 0.35)} ${f(yb - ht * 0.95)}C${f(x1 + w * 0.5)} ${f(yb - ht * 1.1)} ${f(x1 + w * 0.75)} ${f(yb - ht * 1.05)} ${f(x1 + w * 0.85)} ${f(yb - ht * 0.7)}C${f(x2 + 2)} ${f(yb - ht * 0.5)} ${f(x2 + 2)} ${f(yb - ht * 0.2)} ${x2} ${yb}Q${f(x1 + w / 2)} ${f(yb + 6)} ${x1} ${yb}Z`;
    return masonry(c, d, [x1 - 2, yb - ht * 1.1, x2 + 2, yb + 6], col, { rough: true, round: true, rowH: 8, bw: 11, bulge: 5, gap: 0.75, mortar: '#4a3c30', seed, bot: 0.4, top: 0, k2: 0.75 });
  }
  /** 갱도 입구: 가운데 x, 바닥 yb, 너비 w, 높이 ht. 나무 기둥 + 들보, 안쪽은 깊어질수록 어둡게 */
  function adit(c, x, yb, w, ht, o = {}) {
    const h = c.h;
    const top = yb - ht;
    const inner = c.def('aditIn', (id) => c.rgc(id, [[0, '#050308'], [0.6, '#1a1218'], [1, '#3a2e2a']], 0.5, 0.75, 0.75));
    let s = c.p(`M${f(x - w / 2)} ${f(yb)}V${f(top + 3)}Q${f(x)} ${f(top - 2)} ${f(x + w / 2)} ${f(top + 3)}V${f(yb)}Z`, inner, 2.6);
    // 안쪽 버팀목(깊이감)
    s += c.ln(`M${f(x - w * 0.28)} ${f(yb - 1)}V${f(top + ht * 0.3)}H${f(x + w * 0.28)}V${f(yb - 1)}`, '#4a3626', 2, 0.8);
    if (o.rails) s += c.ln(`M${f(x - w * 0.18)} ${f(yb)}L${f(x - w * 0.1)} ${f(yb - ht * 0.45)}M${f(x + w * 0.18)} ${f(yb)}L${f(x + w * 0.1)} ${f(yb - ht * 0.45)}`, '#8a93a0', 1.2, 0.7);
    s += beam(c, [x - w / 2 - 1.2, yb + 0.5], [x - w / 2 - 0.6, top + 1], 3.6, M.wood);
    s += beam(c, [x + w / 2 + 1.2, yb + 0.5], [x + w / 2 + 0.6, top + 1], 3.6, hs(M.wood, -0.12));
    s += beam(c, [x - w / 2 - 4, top - 0.5], [x + w / 2 + 4, top - 0.5], 4.2, M.wood);
    // 들보 아래 짙은 그늘
    s += c.r(x - w / 2 + 0.6, top + 1.7, w - 1.2, 2.2, OL, 0, 0, ' opacity="0.4"');
    if (o.band) s += c.r(x - w / 2 - 3, top - 2.6, w + 6, 4.2, c.vg(o.band, 0.35, -0.3), 0.6, 1.6) + rivets(c, [[x - w / 2 - 1, top - 0.5], [x, top - 0.5], [x + w / 2 + 1, top - 0.5]], '#fff3c0', 0.7);
    return s;
  }
  /** 광차: 바닥 가운데 (x,y), 크기 k, spin 바퀴 각 */
  function mcart(c, x, y, k, col, spin = 0) {
    const h = c.h;
    const P = (a, b) => `${f(x + a * k)} ${f(y + b * k)}`;
    let s = '';
    s += `<g transform="rotate(-14 ${f(x - 3 * k)} ${f(y - 18 * k)})">${crystal(c, x - 3 * k, y - 18 * k, 7 * k, 12 * k, col, 2)}</g>`;
    s += `<g transform="rotate(12 ${f(x + 4 * k)} ${f(y - 19 * k)})">${crystal(c, x + 4 * k, y - 19 * k, 8 * k, 13 * k, col, 2)}</g>`;
    const tub = `M${P(-12, -14)}H${P(12, -14).split(' ')[0]}L${P(9, -3)}H${P(-9, -3).split(' ')[0]}Z`;
    s += planks(c, tub, [x - 12 * k, y - 14 * k, x + 12 * k, y - 3 * k], M.plank, { dir: 'h', pw: 3.6 * k, seed: 9, w: 2.4 });
    s += c.ln(`M${P(-11.4, -11)}H${P(11.4, -11).split(' ')[0]}M${P(-9.6, -5.4)}H${P(9.6, -5.4).split(' ')[0]}`, M.iron, 1.4) + rivets(c, [[x - 9 * k, y - 11 * k], [x + 9 * k, y - 11 * k]], '#c9d0d8', 0.6);
    const wheel = (wx) => {
      let sp = '';
      for (let i = 0; i < 3; i++) { const a = spin + i * 60; sp += `M${pp(pol([wx, y], 3.2 * k, a))}L${pp(pol([wx, y], 3.2 * k, a + 180))}`; }
      return c.ci(wx, y, 3.8 * k, c.sg(M.iron), 2) + c.ln(sp, hs(M.iron, 0.4), 0.9) + c.ci(wx, y, 1 * k, hs(M.iron, 0.3), 0.8);
    };
    return s + wheel(x - 6 * k) + wheel(x + 6 * k);
  }
  /** 철로(침목 + 두 줄) — 안쪽 (x0,y0)에서 앞쪽 (x1,y1)으로, 폭이 앞으로 갈수록 넓어짐 */
  function rails(c, x0, y0, x1, y1, w0, w1) {
    let s = '';
    for (let t = 0.1; t < 1; t += 0.28) {
      const x = lerp(x0, x1, t);
      const y = lerp(y0, y1, t);
      const w = lerp(w0, w1, t) + 3;
      s += c.r(x - w / 2, y - 0.9, w, 1.8 + t, c.vg(M.woodD, 0.2, -0.2), 0.3, 1.2);
    }
    s += c.ln(`M${f(x0 - w0 / 2)} ${f(y0)}L${f(x1 - w1 / 2)} ${f(y1)}M${f(x0 + w0 / 2)} ${f(y0)}L${f(x1 + w1 / 2)} ${f(y1)}`, OL, 2.6) + c.ln(`M${f(x0 - w0 / 2)} ${f(y0)}L${f(x1 - w1 / 2)} ${f(y1)}M${f(x0 + w0 / 2)} ${f(y0)}L${f(x1 + w1 / 2)} ${f(y1)}`, '#aab3c0', 1.2);
    return s;
  }
  /** 기운 결정 */
  const tcrys = (c, x, y, w, ht, ang, col, w0 = 2.6) => `<g transform="rotate(${ang} ${f(x)} ${f(y + ht / 2)})">${crystal(c, x, y, w, ht, col, w0)}</g>`;
  /** 내리찍는 순간: 불꽃·파편 */
  function strikeFx(c, x, y, col, big = 1) {
    let s = aura(c, x, y, 12 * big, 10 * big, '#fff3b0', 0.8) + spark(c, x, y, 7 * big, '#fff', 1.4) + spark(c, x + 1, y - 1, 3.6 * big, '#ffe48a', 0);
    s += c.ln(`M${f(x + 4)} ${f(y - 4)}l5 -5M${f(x - 2)} ${f(y - 6)}l-2 -6M${f(x + 6)} ${f(y + 1)}l6 -1`, '#fff6c8', 1.6);
    s += tcrys(c, x + 10 * big, y - 12 * big, 3, 5, 30, col, 1.4) + tcrys(c, x - 5 * big, y - 13 * big, 2.6, 4.4, -25, col, 1.4) + tcrys(c, x + 14 * big, y - 4 * big, 2.4, 4, 60, col, 1.4);
    return s;
  }
  /** 금화 */
  const coin = (c, x, y, r = 2.6) => c.e(x, y, r, r * 0.9, c.sg(M.gold), 1.6) + c.ln(`M${f(x - r * 0.3)} ${f(y - r * 0.4)}V${f(y + r * 0.4)}`, hs(M.gold, -0.4), 0.9);

  T.crystal_mine = {
    muzzle: [[56, 96], [56, 96], [56, 96], [64, 46], [38, 88]],
    draw(c, v, pose = 'idle') {
      const h = c.h;
      const E = c.E;
      const st = STONE.earth;
      const tip = pol(toolEnd(MINER_POSE.fire.g, 10, 20), 7.8, 100);
      if (v === 1 || v === 2 || v === 3) {
        const L = v;
        const cx = by(pose, 0, 1.5, 3);
        const spin = by(pose, 0, 25, 50);
        let o = base(c, L, L === 1 ? { seed: 31 } : { stone: st, seed: 31 });
        if (L === 3) o += aura(c, 62, 56, 38, 30, E.color, 0.45);
        o += ao(c, 68, 104, 30, 8, 0.5);
        if (L === 1) {
          o += rockMound(c, 44, 96, 104, 32, M.rough, 41);
          o += mossPatch(c, 74, 75, 14, 4, 3);
          o += adit(c, 77, 104, 15, 17);
          o += tcrys(c, 64, 64, 14, 28, -6, E.color) + tcrys(c, 89, 74, 10, 18, 22, E.color) + tcrys(c, 53, 80, 8, 13, -28, E.color, 2.2);
          o += mcart(c, 86 + cx, 112, 0.62, E.color, spin);
        } else {
          o += rockMound(c, 34, 96, 104, 46, hs(st, -0.1), 43);
          o += mossPatch(c, 50, 62, 14, 4, 5) + mossPatch(c, 84, 64, 10, 3, 6);
          o += tcrys(c, 44, 58, 11, 20, -26, E.color) + tcrys(c, 90, 52, 12, 22, 22, E.color) + crystal(c, 60, L === 3 ? 40 : 44, L === 3 ? 18 : 16, L === 3 ? 34 : 30, E.color);
          if (L === 3) o += tcrys(c, 72, 46, 9, 16, 12, E.light, 2.2) + tcrys(c, 50, 46, 8, 14, -10, E.light, 2.2);
          o += adit(c, 75, 104, 20, 27, { rails: true, band: L === 3 ? M.gold : null });
          if (L === 3) {
            // 들보에 매단 등불
            o += c.ol('M86 77V82', M.iron, 1.2) + aura(c, 86, 86, 9, 8, '#ffd77a', 0.7) + c.r(83.6, 82, 4.8, 6.4, c.vg('#ffe9a0', 0.4, -0.1), 1, 1.6) + c.p('M83 82H89L86 79.6Z', M.iron, 1.4);
          }
          o += rails(c, 75, 103, 77, 117, 8, 13);
          o += mcart(c, 76 + cx, 111, 0.82, E.color, spin);
        }
        // 내리찍을 결정(광부 쪽으로 기운 바위 결정)
        o += mossPatch(c, 56, 101, 10, 2.6, 8);
        o += tcrys(c, 57.5, 94, 9, 15, -40, E.color, 2.4);
        if (pose === 'fire') o += aura(c, 57, 95, 12, 12, E.light, 0.9);
        o += miner(c, pose, L);
        if (pose === 'fire') o += strikeFx(c, tip[0], tip[1] - 1, E.color, L === 1 ? 1.1 : 1);
        if (pose === 'aim') o += spark(c, ...pol(toolEnd(MINER_POSE.aim.g, -140, 20), 7.8, -50), 3.4, '#fff', 1.2);
        return o;
      }
      if (v === 'A') {
        // 깊은 광맥 — 갱도 위 권양탑, 광부가 권양기를 돌려 광석 통을 끌어 올림
        const bucketY = by(pose, 88, 70, 54); // 통 바닥
        const crank = by(pose, 80, 190, -40);
        let o = base(c, 4, { stone: '#8f8e78', seed: 33 });
        o += aura(c, 64, 60, 40, 34, E.color, 0.4);
        // 뒤쪽 큰 결정
        o += tcrys(c, 87, 64, 15, 32, 16, E.color, 2.8);
        o += ao(c, 64, 94, 24, 7, 0.5);
        // 권양탑 뒷다리
        const LL1 = [[47, 95], [55, 18]];
        const LL2 = [[81, 95], [69, 18]];
        const xAt = (Lg, y) => lerp(Lg[0][0], Lg[1][0], (Lg[0][1] - y) / (Lg[0][1] - Lg[1][1]));
        o += beam(c, [xAt(LL1, 70), 70], [xAt(LL2, 46), 46], 2.4, M.woodD) + beam(c, [xAt(LL2, 70), 70], [xAt(LL1, 46), 46], 2.4, M.woodD);
        // 갱도 테두리(돌)
        o += masonry(c, cylD(64, 89, 94, 17, 5.5), [47, 89, 81, 94], '#9a947c', { round: true, rowH: 2.6, bw: 6, bulge: 5.5, seed: 61, bot: 0.3 });
        o += c.e(64, 89, 17, 5.5, c.vg('#aaa48c', 0.2, -0.1), 2.6) + c.e(64, 89.4, 12.5, 3.8, c.def('shaft', (id) => c.rgc(id, [[0, '#000'], [0.7, '#140c12'], [1, '#3a2e2a']], 0.5, 0.6, 0.6)), 2);
        // 밧줄(도르래 → 통, 도르래 → 권양기)
        o += c.ln(`M63.5 13V${f(bucketY - 13)}`, '#d9c08a', 1.6) + c.ln('M49 12L33 74', '#d9c08a', 1.6);
        // 광석 통
        const bx = 63.5;
        const bt = bucketY - 11;
        o += c.ln(`M${bx - 6} ${f(bt + 1)}L${bx} ${f(bt - 4)}L${bx + 6} ${f(bt + 1)}`, M.iron, 1.4);
        o += tcrys(c, bx - 2.5, bt - 2, 5, 9, -16, E.color, 1.8) + tcrys(c, bx + 3, bt - 3, 6, 10, 14, E.color, 1.8);
        o += planks(c, `M${bx - 7} ${f(bt)}H${bx + 7}L${bx + 6} ${f(bucketY)}H${bx - 6}Z`, [bx - 7, bt, bx + 7, bucketY], M.plank, { pw: 3, seed: 17, w: 2.4 });
        o += c.ln(`M${bx - 6.8} ${f(bt + 2.5)}H${bx + 6.8}M${bx - 6.3} ${f(bucketY - 2.4)}H${bx + 6.3}`, M.iron, 1.5);
        if (bucketY > 84) o += c.p('M51.5 89A12.5 3.8 0 0 0 76.5 89V95H51.5Z', '#aaa48c', 0) + masonry(c, 'M47 89.5A17 5.5 0 0 0 81 89.5V95A17 5.5 0 0 1 47 95Z', [47, 89, 81, 95], '#9a947c', { round: true, rowH: 2.6, bw: 6, bulge: 5.5, seed: 61, w: 2.4 });
        // 권양탑 앞다리 + 가로대 + 도르래
        o += beam(c, LL1[0], LL1[1], 3.6, M.wood) + beam(c, LL2[0], LL2[1], 3.6, hs(M.wood, -0.1));
        o += beam(c, [xAt(LL1, 70) - 2, 70], [xAt(LL2, 70) + 2, 70], 2.8, M.wood) + beam(c, [xAt(LL1, 46) - 2, 46], [xAt(LL2, 46) + 2, 46], 2.8, M.wood);
        o += beam(c, [50, 19], [74, 19], 3.4, M.wood);
        const sheave = (cx0, cy0, R) => {
          let sp = '';
          for (let i = 0; i < 6; i++) { const a = crank * 0.5 + i * 60; sp += `M${f(cx0)} ${f(cy0)}L${pp(pol([cx0, cy0], R, a))}`; }
          return c.ci(cx0, cy0, R, 'none', 0, ` stroke="${OL}" stroke-width="${c.sw(5)}"`) + c.ci(cx0, cy0, R, 'none', 0, ` stroke="${M.ironL}" stroke-width="${c.sw(2.6)}"`) + c.ln(sp, M.iron, 1.4) + c.ci(cx0, cy0, 2, c.sg(M.gold), 1.6);
        };
        o += sheave(56.3, 13, 7.2);
        // 권양기(나무 받침 + 밧줄 감긴 북 + 손잡이)
        const ax = [33, 80];
        o += beam(c, [26, 99], [33, 81], 2.6, M.woodD) + beam(c, [40, 99], [33, 81], 2.6, M.wood);
        o += c.ci(ax[0], ax[1], 6.4, c.sg(M.wood), 2.6) + c.ci(ax[0], ax[1], 4.2, 'none', 0, ` stroke="#d9c08a" stroke-width="${c.sw(2.2)}"`) + c.ci(ax[0], ax[1], 4.2, 'none', 0, ` stroke="#8a6a3a" stroke-width="${c.sw(0.8)}" stroke-dasharray="${c.sw(1.2)} ${c.sw(1)}"`);
        const hd = pol(ax, 7, crank);
        const ML = by(pose, { hip: [20, 89.5], lean: 6, feet: [[15, 102], [25, 102]] }, { hip: [19, 90], lean: -14, feet: [[14, 102], [24, 102]] }, { hip: [21.5, 90], lean: 14, feet: [[15, 102], [27, 102]] });
        const F = fig(c, { ...MINER, ...ML, hands: [mix2(hd, ax, 0.1), hd], bend: [1, 1], glove: '#8a5a34', sleeve: '#9a7246', face: minerFace(false), hat: minerHat(3) });
        const crankArm = c.ol(`M${pp(ax)}L${pp(hd)}`, M.iron, 2.2) + c.ci(ax[0], ax[1], 1.8, c.sg(M.ironL), 1.4) + c.ci(hd[0], hd[1], 1.6, M.woodD, 1.2);
        o += F.back + F.body + crankArm + F.handB + F.front;
        o += tcrys(c, 84, 90, 6, 10, 24, E.light, 2) + tcrys(c, 88.5, 92, 5, 8, 40, E.color, 1.8);
        if (pose === 'fire') o += aura(c, bx, bt - 3, 16, 12, E.light, 0.85) + spark(c, bx + 9, bt - 8, 5, '#fff', 1.2) + spark(c, bx - 9, bt - 4, 3.4, M.gold, 0) + coin(c, bx + 13, bt + 2) + coin(c, bx - 12, bt - 10, 2.2);
        if (pose === 'aim') o += c.ln(`M66.5 ${f(bucketY + 2)}v4M60.5 ${f(bucketY + 3)}v4`, '#fff', 1.4, 0.7);
        return o;
      }
      // 'B' 보석 세공소 — 반은 돌, 위는 나무틀 벽인 공방. 같은 광부가 앞치마를 두르고 정으로 보석을 깎음
      let o = base(c, 4, { stone: '#8f8e78', trim: M.gold, seed: 35 });
      const gemGlow = by(pose, 0.45, 0.7, 1);
      o += aura(c, 63, 28, 24, 20, E.color, gemGlow * 0.7);
      o += ao(c, 63, 99, 30, 7, 0.5);
      // 지붕(뒤로 보이는 두 면) — 기와
      o += roofPlane(c, [63, 44], [0, -12], [-34, 24], 'tile', '#6e8f52', { lit: 0.08, seed: 4 });
      o += roofPlane(c, [63, 44], [0, -12], [34, 24], 'tile', '#6e8f52', { lit: -0.2, seed: 5 });
      // 앞 박공벽: 아래는 돌, 위는 나무틀 회벽
      const wall = 'M36 100V68L63 47L90 68V100Q63 104 36 100Z';
      o += masonry(c, 'M36 100V78H90V100Q63 104 36 100Z', [36, 78, 90, 104], '#b5ae98', { rowH: 4.4, bw: 8, seed: 71, bot: 0.4, top: 0.25, k1: 0.2, w: 0 });
      o += c.p('M36 78V68L63 47L90 68V78Z', c.vg('#efe6d0', 0.1, -0.15), 0);
      o += beam(c, [36, 77], [90, 77], 2.8, M.woodD, { grain: false }) + beam(c, [63, 49], [63, 77], 2.6, M.woodD, { grain: false }) + beam(c, [44, 77], [55, 55], 2.2, M.woodD, { grain: false }) + beam(c, [82, 77], [71, 55], 2.2, M.woodD, { grain: false });
      o += c.p(wall, 'none', 3);
      // 처마 아래 그늘 + 박공 널
      o += c.p('M36 68L63 47L90 68L90 71L63 50L36 71Z', OL, 0, ' opacity="0.3"');
      o += beam(c, [31, 72], [63, 45], 3.4, M.wood) + beam(c, [95, 72], [63, 45], 3.4, hs(M.wood, -0.15));
      // 문(반쯤 열림, 안쪽 불빛) + 창
      o += c.p('M57 100V87Q63 81 69 87V100Z', c.def('shopIn', (id) => c.rgc(id, [[0, '#fff0b0'], [0.6, '#e09a3a'], [1, '#6a3a1a']], 0.6, 0.6, 0.7)), 2.4);
      o += planks(c, 'M57 100V87Q59.5 84 61.5 83.6V100Z', [57, 83, 62, 100], M.woodD, { pw: 2.4, seed: 2, w: 2 });
      o += win(c, 46, 89, 7, 8, 0.9, { frame: M.woodD }) + win(c, 80, 89, 7, 8, 0.9, { frame: M.woodD });
      o += win(c, 63, 62, 6, 7, 0.8, { frame: M.woodD, arch: true, sill: false });
      // 금화 더미
      o += coin(c, 82, 101) + coin(c, 86, 100) + coin(c, 84, 97.6);
      // 용마루의 세공 보석
      o += c.ol('M63 36V45', M.gold, 2.2) + c.p('M57 46L63 40L69 46Z', c.vg(M.gold, 0.35, -0.3), 1.8);
      o += c.p('M49 26L55 18H71L77 26L63 40Z', c.vg(E.color, 0.45, -0.25), 3) + c.ln('M49 26H77M55 18L59 26L63 40L67 26L71 18', hs(E.color, -0.35), 1.5) + c.p('M55 18L59 26H51Z', '#fff', 0, ' opacity="0.6"');
      if (pose === 'fire') o += spark(c, 72, 20, 7, '#fff', 1.2) + spark(c, 52, 30, 4, '#fff', 0);
      // 작업대(그루터기 + 쇠 받침)와 보석
      o += c.p('M30 102V93H44V102Q37 104 30 102Z', c.cg(M.wood), 2.4) + c.e(37, 93, 7, 2.2, c.vg('#c89a62', 0.2, -0.1), 2.2) + c.ln('M33 95V101M40 96V101', M.woodD, 0.9, 0.8);
      o += c.r(33, 89.4, 8, 2.6, c.vg(M.iron, 0.4, -0.2), 0.6, 1.8);
      o += c.p('M35 89.4L37 86H40L42 89.4Z', c.vg(E.color, 0.45, -0.2), 1.6);
      // 세공사(같은 광부): 뒷손은 정, 앞손은 작은 망치
      const JP = by(pose,
        { hip: [21, 91], lean: 8, ham: [28, 90], ha: 80 },
        { hip: [20.5, 91.5], lean: -6, ham: [27, 74], ha: -120 },
        { hip: [22, 91.5], lean: 16, ham: [35, 81], ha: 60 });
      const chisel = [38.5, 84];
      const F = fig(c, { ...MINER, hip: JP.hip, lean: JP.lean, feet: [[16, 103], [26, 103]], hands: [[36.2, 86], JP.ham], bend: [1, 1], apron: '#7a5a3c', face: minerFace(true), hat: minerHat('B') });
      const ham = (() => {
        const e = pol(JP.ham, 8, JP.ha);
        return c.ol(`M${pp(pol(JP.ham, -1.5, JP.ha))}L${pp(e)}`, M.woodD, 1.8) + rotG(c.r(e[0] - 2.4, e[1] - 1.6, 4.8, 3.2, c.vg(M.ironL, 0.4, -0.2), 0.5, 1.6), JP.ha + 90, e);
      })();
      const chis = c.ol(`M${pp(chisel)}L36 87.5`, M.ironL, 1.6);
      o += F.back + F.body + chis + F.handB + ham + F.front;
      if (pose === 'fire') o += aura(c, 38, 86, 10, 9, '#fff3b0', 0.9) + spark(c, 39, 85, 5, '#fff', 1.2) + c.ln('M43 82l4 -3M41 80l1 -5M45 86l5 0', '#fff6c8', 1.4) + coin(c, 47, 74, 2.4) + coin(c, 53, 81, 2.2);
      if (pose === 'aim') o += spark(c, ...pol(JP.ham, 8, JP.ha), 2.6, '#fff', 1);
      return o;
    },
  };

  /* ================================================================
   * ✨ 햇살 렌즈 — 받침대 위 멍에(U자 틀)에 걸린 큰 렌즈. 쉴 때는 하늘을 향해 눕혀 햇빛을 받고(idle),
   * 겨눌 때 앞으로 세우며 빛이 모이고(aim), 비추는 동안 렌즈 가운데가 하얗게 타오름(fire, 광선 내내).
   * 4A 태양 집광기: 돌 탑 위 금빛 오목 접시가 초점 결정에 빛을 모음.
   * 4B 프리즘 탑: 돌 탑 위 삼각 프리즘 + 양팔 렌즈 둘(세 갈래 광선).
   * ================================================================ */
  /** 렌즈 유리 색: heat 0 맑음 · 1 모임 · 2 타오름 */
  const lensFill = (c, heat) => c.def(`lens${heat}`, (id) => c.rgc(id, [
    [[0, '#ffffff'], [0.45, '#d8f4ff'], [1, '#8fcbe6']],
    [[0, '#fffbe6'], [0.4, '#ffe9a0'], [1, '#9fd0e0']],
    [[0, '#ffffff'], [0.35, '#fff6c8'], [0.75, '#ffd25a'], [1, '#e8a830']],
  ][heat], 0.42, 0.4, 0.7));
  /** 렌즈: 가운데 (x,y), 반지름 r, open(0.4 누움 ~ 1 정면), 테 색, heat */
  function lensDisk(c, x, y, r, open, frame, heat) {
    const h = c.h;
    const ry = r * open;
    let s = '';
    if (heat) s += aura(c, x, y, r * (1.4 + heat * 0.5), r * (1.3 + heat * 0.5), '#ffe48a', 0.45 + heat * 0.2);
    s += c.e(x, y, r, ry, 'none', 0, ` stroke="${OL}" stroke-width="${c.sw(r * 0.26 + 2.8)}"`);
    s += c.e(x, y, r, ry, lensFill(c, heat), 0, ` stroke="${frame}" stroke-width="${c.sw(r * 0.26)}"`);
    s += c.e(x, y - ry * 0.04, r * 0.88, ry * 0.86, 'none', 0, ` stroke="${hs(frame, -0.35)}" stroke-width="${c.sw(0.9)}"`);
    s += c.e(x, y, r, ry, 'none', 0, ` stroke="${hs(frame, 0.45)}" stroke-width="${c.sw(1)}" stroke-dasharray="${c.sw(r * 1.2)} ${c.sw(r * 5)}" stroke-dashoffset="${c.sw(r * 2.2)}"`);
    // 유리 반사(왼쪽 위)
    s += c.p(`M${f(x - r * 0.5)} ${f(y - ry * 0.35)}Q${f(x - r * 0.3)} ${f(y - ry * 0.68)} ${f(x + r * 0.05)} ${f(y - ry * 0.7)}`, 'none', 0, ` stroke="#fff" stroke-width="${c.sw(Math.max(1.4, r * 0.12))}" opacity="0.9"`);
    if (heat === 2) s += spark(c, x, y, r * 0.95, '#fff', 0) + c.ci(x, y, r * 0.3, '#fff', 0) + spark(c, x, y, r * 0.5, '#fff6c8', 0);
    else s += spark(c, x + r * 0.2, y + ry * 0.2, r * (heat ? 0.5 : 0.32), '#fff7c2', 0);
    return s;
  }
  /** 렌즈로 모이는 햇빛 줄기(왼쪽 위 하늘에서) */
  function sunRays(c, x, y, r, heat) {
    if (!heat) return '';
    if (heat === 1) return c.ln(`M${f(x - r * 1.6)} ${f(y - r * 2.4)}L${f(x - r * 0.4)} ${f(y - r * 0.5)}M${f(x - r * 0.4)} ${f(y - r * 2.8)}L${f(x)} ${f(y - r * 0.6)}M${f(x + r * 0.9)} ${f(y - r * 2.5)}L${f(x + r * 0.3)} ${f(y - r * 0.6)}`, '#fff3b0', 1.6, 0.8)
      + spark(c, x - r * 1.1, y - r * 1.6, 2.6, '#fff', 0) + spark(c, x + r * 0.7, y - r * 1.8, 2.2, '#fff', 0) + spark(c, x - r * 0.2, y - r * 2.1, 1.8, '#fff', 0);
    const g = c.def('shaft', (id) => c.lgc(id, [[0, '#fff6c8', 0], [1, '#fff6c8', 0.75]]));
    return c.p(`M${f(x - r * 2.2)} ${f(y - r * 3)}L${f(x + r * 1.2)} ${f(y - r * 3)}L${f(x + r * 0.6)} ${f(y)}L${f(x - r * 0.6)} ${f(y)}Z`, g, 0)
      + c.ln(`M${f(x - r * 1.9)} ${f(y - r * 2.8)}L${f(x - r * 0.5)} ${f(y - r * 0.3)}M${f(x + r * 1)} ${f(y - r * 2.8)}L${f(x + r * 0.45)} ${f(y - r * 0.3)}`, '#fff', 1.4, 0.8);
  }
  /** U자 멍에: 받침 꼭대기 (x, yb)에서 렌즈 굴대 (x ± r, y)까지 */
  function yoke(c, x, yb, y, r, col, w = 3.4) {
    const d = `M${f(x - r)} ${f(y)}C${f(x - r - 1)} ${f(y + r * 0.9)} ${f(x - 4)} ${f(yb)} ${f(x)} ${f(yb)}C${f(x + 4)} ${f(yb)} ${f(x + r + 1)} ${f(y + r * 0.9)} ${f(x + r)} ${f(y)}`;
    return c.ol(d, col, w) + c.ln(d, hs(col, 0.4), w * 0.3, 0.7) + c.ci(x - r, y, 2.4, c.sg(hs(col, 0.2)), 1.8) + c.ci(x + r, y, 2.4, c.sg(hs(col, -0.1)), 1.8);
  }

  T.sun_lens = {
    muzzle: [[50, 40], [50, 36], [50, 30], [63, 28], [50, 16]],
    draw(c, v, pose = 'idle') {
      const h = c.h;
      const E = c.E;
      const st = STONE.light;
      const heat = by(pose, 0, 1, 2);
      const open = by(pose, 0.42, 0.8, 0.96);
      if (v === 1) {
        let o = base(c, 1, { seed: 91 });
        o += ao(c, 50, 104, 16, 5, 0.5);
        // 막돌 받침(돌무더기) + 나무 기둥 + 밧줄로 묶은 Y자 가지
        o += masonry(c, 'M36 106Q35 97 40 94Q50 90 60 94Q65 97 64 106Q50 110 36 106Z', [34, 90, 66, 110], M.rough, { rough: true, round: true, rowH: 5, bw: 7, bulge: 2, gap: 0.6, seed: 92, bot: 0.3 });
        o += beam(c, [50, 96], [50, 56], 5.2, M.wood);
        o += c.ol('M50 58Q40 56 37 40M50 58Q60 56 63 40', M.woodD, 3);
        o += c.ln('M47.4 60.5L52.6 57.5M47.4 63L52.6 60M47.4 65.5L52.6 62.5', M.rope, 1.5);
        o += sunRays(c, 50, 40, 13, heat);
        o += lensDisk(c, 50, 40, 13, open, M.woodD, heat);
        o += c.ci(37, 40, 2.2, c.sg(M.bronze), 1.6) + c.ci(63, 40, 2.2, c.sg(M.bronze), 1.6);
        return o;
      }
      if (v === 2 || v === 3) {
        const L3 = v === 3;
        const ly = L3 ? 31 : 36;
        const lr = L3 ? 19 : 16;
        const top = L3 ? 60 : 64;
        let o = base(c, v, { stone: st, seed: 93 });
        if (L3) o += aura(c, 50, ly, lr + 14, lr + 12, E.color, by(pose, 0.4, 0.6, 0.8));
        o += ao(c, 50, 104, 20, 6, 0.5);
        // 다듬은 돌 기둥(위가 좁음) + 받침돌 + 회전판
        const pd = `M36 104L41 ${top + 4}H59L64 104Q50 108 36 104Z`;
        o += masonry(c, pd, [36, top + 4, 64, 108], st, { round: true, rowH: 5.5, bw: 7, bulge: 2.5, seed: 94, bot: 0.35, top: 0.3, k1: 0.15 });
        o += c.p(`M33 104H67V100H33Z`, 'none', 0) + masonry(c, 'M33 106V100H67V106Q50 109 33 106Z', [33, 100, 67, 109], hs(st, 0.1), { rowH: 6, bw: 8, seed: 95, bot: 0.35 });
        if (L3) o += c.p(`M40.2 ${top + 14}H59.8L60.6 ${top + 18}H39.4Z`, c.cg(M.gold), 1.8) + c.p(`M38.6 ${top + 26}H61.4L62.2 ${top + 30}H37.8Z`, c.cg(M.gold), 1.8);
        o += c.e(50, top + 3, 11, 3.4, c.cg(L3 ? M.gold : M.bronze), 2.4) + c.p(`M39 ${top + 3}V${top}A11 3.4 0 0 0 61 ${top}V${top + 3}Z`, c.cg(hs(L3 ? M.gold : M.bronze, -0.1)), 2) + c.e(50, top, 11, 3.4, c.vg(hs(L3 ? M.gold : M.bronze, 0.3), 0.2, -0.1), 2);
        o += sunRays(c, 50, ly, lr, heat);
        o += yoke(c, 50, top, ly, lr + 1.5, L3 ? M.gold : M.bronze, L3 ? 4 : 3.6);
        o += lensDisk(c, 50, ly, lr, open, L3 ? M.gold : M.bronze, heat);
        if (L3) {
          // 굴대 톱니(돌리는 장치)
          const gear = (x) => { let t = ''; for (let i = 0; i < 8; i++) { const a = by(pose, 0, 25, 40) + i * 45; t += `M${pp(pol([x, ly], 3.2, a))}L${pp(pol([x, ly], 4.6, a))}`; } return c.ln(t, OL, 3) + c.ln(t, M.gold, 1.6) + c.ci(x, ly, 3.4, c.sg(M.gold), 1.8); };
          o += gear(50 - lr - 1.5) + gear(50 + lr + 1.5);
          o += crystal(c, 50, top + 9, 6, 8, E.color, 1.8);
        }
        return o;
      }
      if (v === 'A') {
        // 태양 집광기: 둥근 돌 탑 + 흉벽, 위에 금빛 오목 접시와 버팀대 끝 초점 결정
        let o = base(c, 4, { stone: '#d8cfb8', trim: M.gold, seed: 96 });
        o += aura(c, 56, 38, 46, 40, E.color, by(pose, 0.35, 0.55, 0.75));
        o += ao(c, 50, 99, 22, 6, 0.5);
        o += masonry(c, cylD(50, 66, 99, 17, 5), [33, 66, 67, 104], STONE.light, { round: true, rowH: 5.5, bw: 7, bulge: 5, seed: 97, bot: 0.35, top: 0.35, k1: 0.15 });
        o += win(c, 50, 82, 6, 9, by(pose, 0.5, 0.8, 1), { arch: true, frame: '#8a7a5a' });
        o += c.p('M31 66A19 5.6 0 0 0 69 66V62A19 5.6 0 0 1 31 62Z', c.cg(M.gold), 2.2) + c.e(50, 62, 19, 5.6, c.vg('#efe6d0', 0.2, -0.1), 2.2);
        o += beam(c, [42, 62], [44, 50], 3.2, M.gold, { grain: false }) + beam(c, [58, 62], [52, 50], 3.2, M.gold, { grain: false });
        const ang = by(pose, -40, -30, -26);
        const sq = by(pose, 0.55, 0.72, 0.78);
        const dg = c.def('dish', (id) => c.rgc(id, [[0, '#fffbe6'], [0.35, '#ffe48a'], [0.8, '#e0a830'], [1, '#a8741a']], 0.62, 0.58, 0.6));
        const dish = c.e(46, 40, 38, 38 * sq, dg, 3.2) + c.e(46, 40, 38, 38 * sq, 'none', 0, ` stroke="${M.gold}" stroke-width="${c.sw(2.6)}"`) + c.ln(`M10 40Q46 ${f(40 + 12 * sq)} 82 40M46 ${f(40 - 38 * sq + 2)}Q58 40 46 ${f(40 + 38 * sq - 2)}`, '#c08a2a', 1.4, 0.7)
          + (heat ? c.e(46, 40, 26, 26 * sq, c.ag('#fff6c8', 0.3 + heat * 0.3), 0) : '');
        o += rotG(dish, ang, [46, 40]);
        const fc = [63, 28];
        o += c.ol(`M30 22L${fc[0]} ${fc[1]}M68 56L${fc[0]} ${fc[1]}M40 62L${fc[0]} ${fc[1]}`, M.gold, 1.8);
        if (heat) o += c.ln(`M22 ${f(40 - 14)}L${fc[0]} ${fc[1]}M28 58L${fc[0]} ${fc[1]}M60 14L${fc[0]} ${fc[1]}`, '#fff6c8', heat === 2 ? 2.2 : 1.4, heat === 2 ? 0.9 : 0.6);
        o += aura(c, fc[0], fc[1], 8 + heat * 6, 8 + heat * 6, '#fff3b0', 0.6 + heat * 0.15);
        o += crystal(c, fc[0], fc[1], 10, 16, '#fff3b0', 2.4) + spark(c, fc[0], fc[1], 6 + heat * 4, '#fff', heat === 2 ? 1 : 0);
        return o;
      }
      // 'B' 프리즘 탑: 둥근 돌 탑, 꼭대기 삼각 프리즘 + 양팔에 렌즈 둘
      let o = base(c, 4, { stone: '#d8cfb8', trim: M.gold, seed: 98 });
      o += aura(c, 50, 28, 38, 28, E.color, by(pose, 0.35, 0.55, 0.75));
      o += ao(c, 50, 99, 22, 6, 0.5);
      o += masonry(c, `M33 99L37 52H63L67 99Q50 104 33 99Z`, [33, 52, 67, 104], STONE.light, { round: true, rowH: 5.5, bw: 7, bulge: 4, seed: 99, bot: 0.35, top: 0.3, k1: 0.12 });
      o += c.p('M35.5 76H64.5L65 81H35Z', c.cg(M.gold), 2);
      o += win(c, 50, 66, 6, 8, by(pose, 0.5, 0.8, 1), { arch: true, frame: '#8a7a5a' });
      o += win(c, 50, 90, 6, 7, 0.6, { frame: '#8a7a5a' });
      o += c.p('M34 54H66L63 49H37Z', c.vg('#efe6d0', 0.2, -0.15), 2.4);
      o += beam(c, [38, 52], [16, 40], 3, M.gold, { grain: false }) + beam(c, [62, 52], [84, 40], 3, M.gold, { grain: false }) + beam(c, [50, 50], [50, 44], 3, M.gold, { grain: false });
      const sideOpen = by(pose, 0.5, 0.85, 0.95);
      o += lensDisk(c, 14, 36, 8.5, sideOpen, M.gold, heat) + lensDisk(c, 86, 36, 8.5, sideOpen, M.gold, heat);
      if (heat) o += aura(c, 50, 26, 22, 22, '#ffffff', 0.4 + heat * 0.2);
      o += c.p('M50 4L74 46H26Z', c.vg('#e8faff', 0.3, -0.1), 3) + c.p('M50 4L74 46H58Z', '#bfe6f5', 0, ' opacity="0.8"');
      const bandA = by(pose, 0.5, 0.8, 1);
      o += c.ln('M32 40L56 22', '#ff9a9a', 2, bandA) + c.ln('M36 42L60 28', '#ffe48a', 2, bandA) + c.ln('M40 44L64 34', '#9ad8ff', 2, bandA);
      if (heat === 2) o += spark(c, 50, 16, 10, '#fff', 1) + c.ci(50, 16, 2.6, '#fff', 0);
      else if (heat === 1) o += spark(c, 50, 16, 5, '#fff', 0) + spark(c, 32, 8, 2.4, '#fff', 0) + spark(c, 68, 10, 2, '#fff', 0);
      o += c.p('M50 4L74 46H26Z', 'none', 3);
      return o;
    },
  };

  /* ================================================================
   * ✨ 성소 — 제단 앞 사제. 일하는 모습: 두 손을 모아 기도(idle) → 두 팔을 앞으로 들어 빛을 모음(aim)
   * → 두 팔을 활짝 벌리며 빛의 고리가 퍼지고 회복의 빛 조각이 떠오름(fire).
   * Lv1 나무 사당, Lv2·3 돌기둥 사당(기와 박공), 4A 대성당(사제가 지팡이를 들어 장미창이 번쩍),
   * 4B 치유의 샘(같은 사제가 물그릇을 들어 샘물이 솟음).
   * ================================================================ */
  const PRIEST = { skin: '#f3c99d', robe: '#f4efe4', boot: '#8a6a4a' };
  /** 사제 머리쓰개(베일) — tier: 1 흰 베일, 2 금테, 3 금 머리띠 + 빛 고리, A 높은 관, B 초록 띠 */
  function veil(tier) {
    return (c, H, r) => {
      const [x, y] = H;
      const col = tier === 'B' ? '#e6f4ea' : '#fbf6ea';
      // 앞머리(갈색) 위로 베일
      let s = c.p(`M${f(x + r * 0.8)} ${f(y - r * 0.75)}Q${f(x + r * 0.1)} ${f(y - r * 0.9)} ${f(x - r * 0.35)} ${f(y + r * 0.1)}Q${f(x + r * 0.05)} ${f(y - r * 0.45)} ${f(x + r * 0.85)} ${f(y - r * 0.5)}Z`, '#8a5a3a', 1.2);
      s += c.p(`M${f(x + r * 0.55)} ${f(y - r * 0.98)}C${f(x - r * 0.3)} ${f(y - r * 1.5)} ${f(x - r * 1.35)} ${f(y - r * 0.8)} ${f(x - r * 1.25)} ${f(y + r * 0.4)}C${f(x - r * 1.2)} ${f(y + r * 1.3)} ${f(x - r * 0.7)} ${f(y + r * 1.9)} ${f(x - r * 0.2)} ${f(y + r * 1.9)}L${f(x - r * 0.35)} ${f(y + r * 0.3)}Q${f(x - r * 0.25)} ${f(y - r * 0.6)} ${f(x + r * 0.7)} ${f(y - r * 0.82)}Z`, c.vg(col, 0.15, -0.2), 2.2);
      if (tier === 2 || tier === 3 || tier === 'A') s += c.ln(`M${f(x + r * 0.5)} ${f(y - r * 0.92)}C${f(x - r * 0.3)} ${f(y - r * 1.42)} ${f(x - r * 1.25)} ${f(y - r * 0.8)} ${f(x - r * 1.18)} ${f(y + r * 0.4)}`, M.gold, 1.4);
      if (tier === 3) s += c.e(x - r * 0.1, y - r * 1.45, r * 0.9, r * 0.28, 'none', 0, ` stroke="${M.gold}" stroke-width="${c.sw(1.4)}" opacity="0.9"`);
      if (tier === 'A') s += c.p(`M${f(x - r * 0.7)} ${f(y - r * 0.9)}L${f(x - r * 0.3)} ${f(y - r * 2.3)}L${f(x + r * 0.3)} ${f(y - r * 1.7)}L${f(x + r * 0.55)} ${f(y - r * 0.85)}Q${f(x)} ${f(y - r * 1.15)} ${f(x - r * 0.7)} ${f(y - r * 0.9)}Z`, c.vg('#fbf6ea', 0.1, -0.2), 2) + c.ln(`M${f(x - r * 0.35)} ${f(y - r * 1.2)}L${f(x - r * 0.1)} ${f(y - r * 1.95)}`, M.gold, 1.3);
      if (tier === 'B') s += c.ln(`M${f(x + r * 0.5)} ${f(y - r * 0.92)}C${f(x - r * 0.3)} ${f(y - r * 1.42)} ${f(x - r * 1.25)} ${f(y - r * 0.8)} ${f(x - r * 1.18)} ${f(y + r * 0.4)}`, '#5ab07a', 1.5);
      return s;
    };
  }
  const priestFace = (c, H, r) => c.ln(`M${f(H[0] + r * 0.28)} ${f(H[1] + r * 0.02)}q${f(r * 0.17)} ${f(r * 0.16)} ${f(r * 0.34)} 0`, '#2a1a2e', 1.1) + c.e(H[0] + r * 0.6, H[1] + r * 0.42, r * 0.2, r * 0.12, '#ff9a8a', 0, ' opacity="0.6"');
  /** 사제 자세(제단 쪽을 봄) — 기준 엉덩이 (x,y) */
  function priestPose(pose, x, y) {
    return by(pose,
      { hip: [x, y], lean: 2, hands: [[x + 4.5, y - 7], [x + 5.8, y - 7.3]], bend: [1, 1] },
      { hip: [x, y], lean: -3, hands: [[x + 7.5, y - 18], [x + 10, y - 16.5]], bend: [1, 1] },
      { hip: [x - 0.5, y], lean: -7, hands: [[x - 4.5, y - 23], [x + 8.5, y - 22.5]], bend: [1, -1] });
  }
  function priest(c, pose, x, y, tier, o = {}) {
    const P = priestPose(pose, x, y);
    const hands = o.hands || P.hands;
    const F = fig(c, { skin: PRIEST.skin, shirt: PRIEST.robe, robe: tier === 'B' ? '#eef6f0' : PRIEST.robe, sleeve: '#efe8d8', boot: PRIEST.boot, trim: tier === 1 ? null : tier === 'B' ? '#5ab07a' : M.gold, hip: P.hip, lean: P.lean, feet: [[x - 4, y + 13], [x + 4, y + 13]], hands, bend: o.bend || P.bend, face: priestFace, hat: veil(tier) });
    // 영대(어깨띠)
    const stole = tier === 1 ? '' : c.ln(`M${pp(mix2(F.sh[1], F.neck, 0.3))}L${f(x + 2.4)} ${f(y + 9)}`, OL, 3.4) + c.ln(`M${pp(mix2(F.sh[1], F.neck, 0.3))}L${f(x + 2.4)} ${f(y + 9)}`, tier === 'B' ? '#5ab07a' : M.gold, 1.8);
    return { F, all: F.back + F.body + stole + (o.held || '') + F.handB + F.front + (o.over || '') };
  }
  /** 빛의 고리(바닥) + 회복 십자·반짝이 */
  function lightPulse(c, x, y, rx, ry, pose, col) {
    if (pose === 'idle') return c.e(x, y, rx * 0.8, ry * 0.8, 'none', 0, ` stroke="${col}" stroke-width="${c.sw(1.6)}" opacity="0.45"`);
    if (pose === 'aim') return c.e(x, y, rx * 0.65, ry * 0.65, 'none', 0, ` stroke="${col}" stroke-width="${c.sw(2.2)}" opacity="0.75"`);
    const plus = (px, py, k) => c.p(`M${f(px - 1.2 * k)} ${f(py - 3.4 * k)}h${f(2.4 * k)}v${f(2.2 * k)}h${f(2.2 * k)}v${f(2.4 * k)}h${f(-2.2 * k)}v${f(2.2 * k)}h${f(-2.4 * k)}v${f(-2.2 * k)}h${f(-2.2 * k)}v${f(-2.4 * k)}h${f(2.2 * k)}z`, '#fff8dc', 1.2);
    return c.e(x, y, rx * 1.05, ry * 1.05, 'none', 0, ` stroke="${col}" stroke-width="${c.sw(3)}" opacity="0.9"`) + c.e(x, y, rx * 0.8, ry * 0.8, 'none', 0, ` stroke="#fff" stroke-width="${c.sw(1.6)}" opacity="0.7"`)
      + plus(x - rx * 0.75, y - ry * 2.6, 1) + plus(x + rx * 0.7, y - ry * 3.4, 0.85) + spark(c, x + rx * 0.35, y - ry * 4.6, 2.6, '#fff', 0) + spark(c, x - rx * 0.3, y - ry * 5.2, 2.2, '#fff', 0);
  }
  /** 제단 위 등불(빛 세기 heat) */
  function altarLamp(c, x, y, k, heat) {
    const E = c.E;
    let s = aura(c, x, y - 12 * k, (14 + heat * 8) * k, (14 + heat * 8) * k, E.color, 0.6 + heat * 0.15);
    s += c.p(`M${f(x - 7 * k)} ${f(y - 5 * k)}H${f(x + 7 * k)}Q${f(x + 6 * k)} ${f(y)} ${f(x)} ${f(y)}Q${f(x - 6 * k)} ${f(y)} ${f(x - 7 * k)} ${f(y - 5 * k)}Z`, c.vg(M.gold, 0.35, -0.3), 2.2);
    s += c.p(`M${f(x)} ${f(y - (19 + heat * 3) * k)}C${f(x + 5.5 * k)} ${f(y - 12 * k)} ${f(x + 4.5 * k)} ${f(y - 6 * k)} ${f(x)} ${f(y - 6 * k)}C${f(x - 4.5 * k)} ${f(y - 6 * k)} ${f(x - 5.5 * k)} ${f(y - 12 * k)} ${f(x)} ${f(y - (19 + heat * 3) * k)}Z`, c.vg('#fff8dc', 0, -0.1), 1.8);
    s += c.e(x, y - 10 * k, 2 * k, 3 * k, '#fff', 0);
    if (heat === 1) s += c.ci(x, y - 24 * k, 4.5 * k, c.sg('#fff6c8'), 1.4) + c.ln(`M${f(x - 9 * k)} ${f(y - 30 * k)}L${f(x - 3 * k)} ${f(y - 25 * k)}M${f(x + 9 * k)} ${f(y - 31 * k)}L${f(x + 3 * k)} ${f(y - 25 * k)}M${f(x)} ${f(y - 34 * k)}V${f(y - 30 * k)}`, '#fff6c8', 1.4, 0.8);
    if (heat === 2) {
      let rays = '';
      for (let i = 0; i < 8; i++) { const a = i * 45 + 22; rays += `M${pp(pol([x, y - 22 * k], 7 * k, a))}L${pp(pol([x, y - 22 * k], 15 * k, a))}`; }
      s += c.ln(rays, '#fff6c8', 1.8, 0.9) + c.ci(x, y - 22 * k, 5 * k, c.sg('#ffffff'), 1.2) + spark(c, x, y - 22 * k, 8 * k, '#fff', 0);
    }
    return s;
  }
  /** 돌 제단(앞면 돌쌓기 + 윗판) */
  function altarStone(c, x1, x2, yt, yb, col, seed) {
    const h = c.h;
    let s = masonry(c, `M${x1} ${yt}H${x2}V${yb}H${x1}Z`, [x1, yt, x2, yb], col, { rowH: (yb - yt) / 3, bw: 7, seed, bot: 0.35, top: 0.3, k1: 0.25 });
    s += c.p(`M${x1 - 2} ${yt}L${x1 + 2} ${yt - 5}H${x2 - 2}L${x2 + 2} ${yt}Z`, c.vg(hs(col, 0.25), 0.2, 0), 2.6);
    s += c.p(`M${(x1 + x2) / 2 - 4} ${(yt + yb) / 2}L${(x1 + x2) / 2} ${(yt + yb) / 2 - 4}L${(x1 + x2) / 2 + 4} ${(yt + yb) / 2}L${(x1 + x2) / 2} ${(yt + yb) / 2 + 4}Z`, c.E.color, 1.4);
    return s;
  }

  T.sanctuary = {
    muzzle: [[58, 60], [64, 54], [64, 50], [50, 40], [52, 34]],
    draw(c, v, pose = 'idle') {
      const h = c.h;
      const E = c.E;
      const st = STONE.light;
      const heat = by(pose, 0, 1, 2);
      if (v === 1) {
        // 나무 사당: 기둥 둘 + 널 지붕 + 가로대에 매단 작은 등 둘, 가운데 돌 제단과 등불
        let o = base(c, 1, { seed: 101 });
        o += lightPulse(c, 52, 104, 40, 11.5, pose, E.color);
        o += ao(c, 58, 104, 22, 6, 0.5);
        o += planks(c, 'M42 104V66H75V104Z', [42, 66, 75, 104], hs(M.woodD, -0.1), { pw: 4.2, seed: 11, top: 0.55, bot: 0.3, k1: 0.35, w: 2.4 });
        o += beam(c, [41, 106], [42, 66], 3.4, M.woodD) + beam(c, [76, 106], [75, 66], 3.4, hs(M.wood, -0.1));
        o += altarStone(c, 47, 69, 86, 106, st, 102);
        o += altarLamp(c, 58, 82, 1, heat);
        o += beam(c, [36, 68], [80, 68], 3, M.wood);
        o += c.ol('M48 68V73M68 68V73', M.rope, 1.2) + c.ci(48, 75.5, 2.6, c.sg(E.color), 1.6) + c.ci(68, 75.5, 2.6, c.sg(E.color), 1.6);
        o += roofPlane(c, [58, 50], [0, -8], [-25, 17], 'shingle', '#8a6a4a', { lit: 0.08, seed: 6 }) + roofPlane(c, [58, 50], [0, -8], [25, 17], 'shingle', '#8a6a4a', { lit: -0.18, seed: 7 });
        o += beam(c, [31, 68], [58, 49], 2.8, M.wood) + beam(c, [85, 68], [58, 49], 2.8, hs(M.wood, -0.15));
        o += c.ci(58, 47, 2.4, c.sg(M.gold), 1.6);
        o += priest(c, pose, 27, 93, 1).all;
        return o;
      }
      if (v === 2 || v === 3) {
        // 돌 사당: 돌기둥 둘 + 기와 박공 지붕, 제단과 등불. 사제는 왼쪽 앞
        const L3 = v === 3;
        let o = base(c, v, { stone: st, seed: 103 });
        o += lightPulse(c, 52, 104, 41, 12, pose, E.color);
        if (L3) o += aura(c, 62, 70, 30, 26, E.color, 0.35 + heat * 0.15);
        o += ao(c, 63, 104, 26, 7, 0.5);
        const pillar = (x, sd) => masonry(c, `M${x - 4.5} 106V58H${x + 4.5}V106Z`, [x - 4.5, 58, x + 4.5, 106], st, { rowH: 6, bw: 9, seed: sd, bot: 0.35, top: 0.3, k1: 0.15, round: true })
          + c.r(x - 6, 104, 12, 4, c.vg(hs(st, 0.1), 0.2, -0.2), 0.6, 2.2) + c.r(x - 6, 54.5, 12, 4, c.vg(L3 ? M.gold : hs(st, 0.2), 0.3, -0.2), 0.6, 2.2);
        o += masonry(c, 'M44 104V54H82V104Z', [44, 54, 82, 104], hs(st, -0.28), { rowH: 5, bw: 8, seed: 118, top: 0.6, bot: 0.3, k1: 0.4, w: 2.4, bevel: false });
        o += pillar(42, 104);
        o += altarStone(c, 52, 74, 88, 106, st, 105);
        o += altarLamp(c, 63, 84, L3 ? 1.15 : 1.05, heat);
        o += pillar(84, 106);
        // 박공 지붕(기와) + 박공벽
        o += roofPlane(c, [63, 34], [0, -10], [-31, 20], 'tile', L3 ? '#c9a450' : '#a87a5a', { lit: 0.1, seed: 8 }) + roofPlane(c, [63, 34], [0, -10], [31, 20], 'tile', L3 ? '#c9a450' : '#a87a5a', { lit: -0.18, seed: 9 });
        o += masonry(c, 'M37 54L63 37L89 54Z', [37, 37, 89, 54], hs(st, 0.05), { rowH: 4.5, bw: 7, seed: 107, top: 0, bot: 0.3, w: 2.6 });
        o += c.r(37, 54, 52, 2.4, OL, 0, 0, ' opacity="0.3"');
        o += c.ci(63, 47, 3.6, L3 ? c.sg('#fff3b0') : c.sg(M.gold), 1.8) + (L3 ? aura(c, 63, 47, 7, 7, E.color, 0.8) : '');
        o += beam(c, [32, 56], [63, 34], 3.2, L3 ? M.gold : '#d8b46a', { grain: false }) + beam(c, [94, 56], [63, 34], 3.2, hs(L3 ? M.gold : '#d8b46a', -0.15), { grain: false });
        if (L3) o += aura(c, 63, 26, 10, 10, E.color, 0.8) + spark(c, 63, 26, 7, '#ffe48a', 1.4);
        o += priest(c, pose, 24, 93, L3 ? 3 : 2).all;
        return o;
      }
      if (v === 'A') {
        // 대성당: 세 첨탑(슬레이트), 돌쌓기 벽, 장미창, 문 계단. 사제는 지팡이를 들어 올림
        const ws = '#eee8da';
        let o = base(c, 4, { stone: '#d8cfb8', trim: M.gold, seed: 108 });
        o += aura(c, 50, 54, 40, 40, E.color, 0.3 + heat * 0.15);
        o += lightPulse(c, 50, 99, 38, 11, pose, E.color);
        o += ao(c, 50, 99, 36, 8, 0.5);
        const cone2 = (x, yt, w, yb, sd) => {
          const d = `M${f(x - w / 2)} ${f(yb)}L${f(x)} ${f(yt)}L${f(x + w / 2)} ${f(yb)}Q${f(x)} ${f(yb + 3)} ${f(x - w / 2)} ${f(yb)}Z`;
          return masonry(c, d, [x - w / 2, yt, x + w / 2, yb + 3], '#6f8ab0', { round: true, rowH: 3.4, bw: 4, bulge: 1.5, seed: sd, gap: 0.4, bevel: false }) + c.ci(x, yt - 2, 2.2, c.sg(M.gold), 1.6);
        };
        o += masonry(c, 'M12 102V46H32V102Z', [12, 46, 32, 102], ws, { rowH: 5, bw: 7, seed: 109, bot: 0.35, top: 0.3, k1: 0.12 }) + masonry(c, 'M68 102V46H88V102Z', [68, 46, 88, 102], ws, { rowH: 5, bw: 7, seed: 110, bot: 0.35, top: 0.3, k1: 0.12 });
        o += cone2(22, 20, 24, 47, 111) + cone2(78, 20, 24, 47, 112);
        o += win(c, 22, 62, 6, 10, 0.4 + heat * 0.3, { arch: true, frame: '#8a7a5a' }) + win(c, 78, 62, 6, 10, 0.4 + heat * 0.3, { arch: true, frame: '#8a7a5a' });
        o += masonry(c, 'M30 102V40L50 26L70 40V102Q50 107 30 102Z', [30, 26, 70, 107], ws, { rowH: 5, bw: 8, seed: 113, bot: 0.35 });
        o += cone2(50, 4, 22, 33, 114);
        o += c.r(30, 40, 40, 2, OL, 0, 0, ' opacity="0.25"');
        // 장미창: aim 밝아짐, fire 번쩍
        const rw = c.def(`rose${heat}`, (id) => c.rgc(id, [[0, '#ffffff'], [0.4, heat ? '#fff3b0' : '#ffe48a'], [1, heat === 2 ? '#ffd25a' : '#d8a840']], 0.5, 0.5, 0.6));
        if (heat) o += aura(c, 50, 54, 14 + heat * 8, 14 + heat * 8, '#fff3b0', 0.5 + heat * 0.2);
        o += c.ci(50, 54, 11, rw, 3) + c.ln('M50 43V65M39 54H61M42.2 46.2L57.8 61.8M57.8 46.2L42.2 61.8', '#c08a2a', 1.5) + c.ci(50, 54, 3.4, '#fff', 1.4);
        if (heat === 2) { let rays = ''; for (let i = 0; i < 12; i++) { const a = i * 30; rays += `M${pp(pol([50, 54], 14, a))}L${pp(pol([50, 54], 24, a))}`; } o += c.ln(rays, '#fff6c8', 2, 0.85); }
        // 문 + 계단
        o += c.p('M42 102V86Q50 76 58 86V102Z', c.def('catDoor', (id) => c.rgc(id, [[0, '#fff0b0'], [0.6, '#e0a040'], [1, '#7a4a1a']], 0.5, 0.7, 0.7)), 2.6);
        o += planks(c, 'M42 102V86Q44 83 46 82V102Z', [42, 80, 46, 102], M.woodD, { pw: 2, seed: 3, w: 1.8 }) + planks(c, 'M58 102V86Q56 83 54 82V102Z', [54, 80, 58, 102], M.woodD, { pw: 2, seed: 4, w: 1.8 });
        o += c.r(38, 101, 24, 3, c.vg('#e8e0cc', 0.2, -0.2), 0.5, 2) + c.r(36, 103.6, 28, 3, c.vg('#ddd4be', 0.2, -0.2), 0.5, 2);
        o += c.ln('M30 70H70', M.gold, 2);
        // 대사제(지팡이)
        const sx = 19;
        const sy = 90;
        const P = priestPose(pose, sx, sy);
        const fh = P.hands[1];
        const staffTop = [fh[0] + 1, fh[1] - 13];
        const staff = c.ol(`M${f(fh[0] + 0.2)} ${f(fh[1] + 14)}L${pp(staffTop)}`, M.gold, 1.8) + c.ol(`M${pp(staffTop)}q-4 -1 -4 -5q0 -4 4 -4q4 0 4 4`, M.gold, 1.8) + aura(c, staffTop[0], staffTop[1] - 5, 6 + heat * 3, 6 + heat * 3, '#fff3b0', 0.6 + heat * 0.15) + c.ci(staffTop[0], staffTop[1] - 5, 2, c.sg('#fff6c8'), 1.2);
        o += priest(c, pose, sx, sy, 'A', { held: staff }).all;
        return o;
      }
      // 'B' 치유의 샘: 돌을 쌓은 둥근 샘, 층층 분수와 빛 구슬. 사제가 물그릇을 듦
      let o = base(c, 4, { stone: '#d8cfb8', trim: '#7ad0a0', seed: 115 });
      o += aura(c, 56, 70, 42, 32, '#c8ffd8', 0.35 + heat * 0.12);
      o += lightPulse(c, 52, 99, 38, 11, pose, '#7ad0a0');
      o += ao(c, 57, 99, 30, 8, 0.5);
      const water = c.def('wat', (id) => c.lgc(id, [[0, '#d6fbff'], [1, '#6cc8d8']]));
      o += masonry(c, cylD(57, 86, 99, 30, 9), [27, 86, 87, 108], STONE.light, { round: true, rowH: 4.4, bw: 8, bulge: 9, seed: 116, bot: 0.35 });
      o += c.p('M27 89A30 9 0 0 0 87 89V92A30 9 0 0 1 27 92Z', c.vg(M.gold, 0.35, -0.25), 1.8);
      o += c.e(57, 86, 30, 9, c.vg(hs(STONE.light, 0.2), 0.2, -0.1), 2.6) + c.e(57, 86, 25, 7, water, 2) + c.e(57, 86, 16, 4.6, 'none', 0, ` stroke="#fff" stroke-width="${c.sw(1.4)}" opacity="0.8"`);
      o += masonry(c, 'M53 86V60H61V86Z', [53, 60, 61, 86], STONE.light, { rowH: 5, bw: 8, seed: 117, round: true, w: 2.6 });
      const jet = by(pose, 1, 1.25, 1.7);
      const arc = (sx2) => `M${f(57 + sx2 * 5)} 60Q${f(57 + sx2 * 14 * jet)} ${f(60 - 8 * jet)} ${f(57 + sx2 * 20)} 84`;
      o += c.ln(arc(-1) + arc(1), '#ffffff', 4.4, 0.7) + c.ln(arc(-1) + arc(1), '#8ad8e6', 2);
      o += c.e(57, 58, 10, 3, c.vg(hs(STONE.light, 0.2), 0.2, -0.1), 2.2) + c.e(57, 58, 7.5, 2.1, water, 1.4);
      o += c.r(54.5, 42, 5, 16, c.cg(STONE.light), 1, 2.2);
      const oy = by(pose, 36, 33, 30);
      o += aura(c, 57, oy, 10 + heat * 4, 10 + heat * 4, E.color, 0.7) + orb(c, 57, oy, 7.5 + heat, E.color, 2.4) + spark(c, 57, oy, 4.5 + heat * 2, '#fff', 0);
      if (pose === 'fire') o += orb(c, 30, 60, 3, '#c8ffd8', 1.4) + orb(c, 84, 54, 3.4, '#c8ffd8', 1.4) + orb(c, 70, 40, 2.4, '#c8ffd8', 1.2);
      // 치유 사제: 두 손에 물그릇(aim: 들어 올림, fire: 기울여 부음)
      const sx = 19;
      const sy = 90;
      const bowl = by(pose, [27, 84], [29, 72], [31, 70]);
      const tilt = by(pose, 0, 0, 28);
      const bw = rotG(c.p(`M${f(bowl[0] - 5)} ${f(bowl[1] - 1)}H${f(bowl[0] + 5)}Q${f(bowl[0] + 4.5)} ${f(bowl[1] + 4)} ${f(bowl[0])} ${f(bowl[1] + 4)}Q${f(bowl[0] - 4.5)} ${f(bowl[1] + 4)} ${f(bowl[0] - 5)} ${f(bowl[1] - 1)}Z`, c.vg(M.gold, 0.35, -0.3), 1.8) + c.e(bowl[0], bowl[1] - 1, 5, 1.4, water, 1.2), tilt, bowl);
      const pourFx = pose === 'fire' ? c.ln(`M${f(bowl[0] + 5)} ${f(bowl[1] + 1)}Q${f(bowl[0] + 10)} ${f(bowl[1] + 4)} ${f(bowl[0] + 11)} ${f(bowl[1] + 14)}`, '#bfefff', 2.4, 0.9) : '';
      const pr = priest(c, pose, sx, sy, 'B', { hands: [[bowl[0] - 4, bowl[1] + 1.5], [bowl[0] + 4, bowl[1] + 1.5]], bend: [1, 1] });
      o += pr.F.back + pr.F.body + bw + pourFx + pr.F.handB + pr.F.front;
      return o;
    },
  };

  /* ================================================================
   * ✨ 광휘 탑 — 돌을 쌓은 하얀 오벨리스크 위에 뜬 빛 구슬. 쉴 때 은은함(idle) → 섬광 직전 구슬이 부풀고
   * 빛 알갱이가 빨려 들며 새긴 룬이 켜짐(aim) → 하얀 섬광과 퍼지는 빛 고리(fire).
   * 4A 일출 탑: 꼭대기 햇살 원반이 빛살을 뻗음. 4B 정화의 탑: 엇갈린 두 고리가 벌어지며 결정 조각이 튐.
   * ================================================================ */
  /** 오벨리스크(돌쌓기): 바닥 yb, 꼭대기 yt, 아래 너비 wb, 위 너비 wt */
  function obeliskB(c, x, yt, yb, wt, wb, col, seed, o = {}) {
    const h = c.h;
    const sd = wb * 0.26;
    let s = masonry(c, poly([[x + wb / 2, yb], [x + wb / 2 + sd, yb - 3], [x + wt / 2 + sd * 0.7, yt - 2], [x + wt / 2, yt]]), [x + wt / 2, yt - 3, x + wb / 2 + sd, yb], hs(col, -0.3), { rowH: 5, bw: 20, seed: seed + 1, bot: 0.3, bevel: false, w: 2.8 });
    s += masonry(c, poly([[x - wb / 2, yb], [x - wt / 2, yt], [x + wt / 2, yt], [x + wb / 2, yb]]), [x - wb / 2, yt, x + wb / 2, yb], col, { rowH: 5, bw: wb * 0.55, seed, bot: 0.35, top: 0.05, lit: 0.05, w: 2.8 });
    if (o.cap !== false) {
      s += c.p(poly([[x + wt / 2, yt], [x + wt / 2 + sd * 0.7, yt - 2], [x + sd * 0.2, yt - wt * 1.1]]), hs(M.gold, -0.25), 2.4);
      s += c.p(poly([[x - wt / 2, yt], [x + sd * 0.2, yt - wt * 1.1], [x + wt / 2, yt]]), c.vg(M.gold, 0.4, -0.2), 2.4);
    }
    return s;
  }
  /** 새긴 룬(빛 세기 lit 0~2) */
  function glyph(c, x, y, k, i, lit) {
    const d = [`M${f(x)} ${f(y - 4 * k)}V${f(y + 4 * k)}M${f(x - 3 * k)} ${f(y - 1.5 * k)}L${f(x)} ${f(y + 0.5 * k)}L${f(x + 3 * k)} ${f(y - 1.5 * k)}`,
      `M${f(x - 3 * k)} ${f(y + 3 * k)}L${f(x)} ${f(y - 4 * k)}L${f(x + 3 * k)} ${f(y + 3 * k)}M${f(x - 1.6 * k)} ${f(y)}H${f(x + 1.6 * k)}`,
      `M${f(x)} ${f(y - 4 * k)}L${f(x + 3 * k)} ${f(y)}L${f(x)} ${f(y + 4 * k)}L${f(x - 3 * k)} ${f(y)}Z`][i % 3];
    const col = ['#8a7a5a', M.gold, '#fff6c8'][lit];
    return (lit ? c.ln(d, '#ffe48a', 3.6 * k, 0.4 + lit * 0.2) : '') + c.ln(d, col, 1.6 * k);
  }
  /** 빛 구슬 + 자세 효과 */
  function radOrb(c, x, y, r, pose, ringCol) {
    const E = c.E;
    let s = '';
    if (pose === 'idle') s += aura(c, x, y, r * 2.2, r * 2.2, E.color, 0.65) + orb(c, x, y, r, '#fff3b0', 2.6);
    if (pose === 'aim') {
      const R = r * 1.35;
      s += aura(c, x, y, R * 2.4, R * 2.4, E.color, 0.85);
      // 빨려 드는 빛 알갱이
      [[-2.6, -1.4], [2.4, -2], [2.8, 1.2], [-2.2, 1.8], [0.2, -3]].forEach(([a, b], i) => {
        const p = [x + a * r, y + b * r];
        s += c.ln(`M${pp(p)}L${pp(mix2(p, [x, y], 0.45))}`, '#fff6c8', 1.3, 0.75) + spark(c, p[0], p[1], 1.8 + (i % 2), '#fff', 0);
      });
      s += orb(c, x, y, R, '#fff6c8', 2.8) + c.ci(x, y, R * 0.45, '#fff', 0, ' opacity="0.7"');
    }
    if (pose === 'fire') {
      s += aura(c, x, y, r * 4, r * 3.4, '#fff6c8', 0.9);
      let rays = '';
      for (let i = 0; i < 12; i++) { const a = i * 30 + 15; rays += `M${pp(pol([x, y], r * 1.4, a))}L${pp(pol([x, y], r * (i % 2 ? 2.6 : 3.4), a))}`; }
      s += c.ln(rays, '#fff', 2, 0.9);
      s += c.e(x, y, r * 3.6, r * 1.1, 'none', 0, ` stroke="${ringCol || E.color}" stroke-width="${c.sw(2.6)}" opacity="0.9"`) + c.e(x, y, r * 4.4, r * 1.4, 'none', 0, ` stroke="#fff" stroke-width="${c.sw(1.4)}" opacity="0.6"`);
      s += c.ci(x, y, r * 1.05, c.sg('#ffffff'), 2.4) + spark(c, x, y, r * 2, '#fff', 0);
    }
    return s;
  }

  T.radiance_spire = {
    muzzle: [[50, 42], [50, 32], [50, 24], [50, 31], [50, 26]],
    draw(c, v, pose = 'idle') {
      const h = c.h;
      const E = c.E;
      const ws = '#f2ede2';
      const lit = by(pose, 0, 1, 2);
      const groundRing = (rx, ry, y) => (pose === 'fire' ? c.e(50, y, rx, ry, 'none', 0, ` stroke="${E.color}" stroke-width="${c.sw(2.6)}" opacity="0.85"`) : '');
      if (v === 1) {
        let o = base(c, 1, { seed: 121 });
        o += groundRing(40, 11.5, 104);
        o += ao(c, 50, 104, 14, 4.5, 0.5);
        o += masonry(c, 'M38 106V100H62V106Q50 109 38 106Z', [38, 100, 62, 109], M.rough, { rough: true, rowH: 4.5, bw: 7, seed: 122, bot: 0.3 });
        o += obeliskB(c, 50, 70, 101, 12, 19, '#ddd6c6', 123);
        o += glyph(c, 49, 86, 0.9, 0, lit);
        o += radOrb(c, 50, 42, 8, pose);
        return o;
      }
      if (v === 2 || v === 3) {
        const L3 = v === 3;
        const oy = L3 ? 24 : 32;
        let o = base(c, v, { stone: STONE.light, seed: 124 });
        o += groundRing(41, 12, 104);
        o += ao(c, 50, 104, 18, 5.5, 0.5);
        if (L3) {
          // 날개돌(앞으로 벌어지는 돌 지느러미)
          const wing = (sgn) => masonry(c, sgn < 0 ? 'M40 70Q24 62 20 44Q30 54 40 56Z' : 'M64 70Q80 62 84 44Q74 54 64 56Z', sgn < 0 ? [20, 44, 40, 70] : [64, 44, 84, 70], sgn < 0 ? ws : hs(ws, -0.2), { rowH: 4.5, bw: 6, seed: 125 + sgn, w: 2.6 });
          const flap = by(pose, 0, -6, 4);
          o += rotG(wing(-1), -flap, [40, 63]) + rotG(wing(1), flap, [64, 63]);
          o += c.ln('M22 47Q28 54 38 58M82 47Q76 54 66 58', M.gold, 1.8);
        }
        o += masonry(c, 'M36 106V100H64V106Q50 109 36 106Z', [36, 100, 64, 109], hs(STONE.light, -0.05), { rowH: 4.5, bw: 8, seed: 127, bot: 0.3 });
        o += obeliskB(c, 50, L3 ? 52 : 58, 101, 13, L3 ? 23 : 21, ws, 128);
        o += c.p(`M${L3 ? 41.6 : 42} ${L3 ? 77 : 79}H${L3 ? 58.4 : 58}V${L3 ? 80 : 82}H${L3 ? 41.6 : 42}Z`, c.vg(M.gold, 0.35, -0.3), 1.6) + c.p('M39.8 93H60.2V96H39.8Z', c.vg(M.gold, 0.35, -0.3), 1.6);
        o += glyph(c, 50, L3 ? 68 : 70, 0.9, 1, lit) + glyph(c, 50, 88, 0.9, 2, lit);
        if (L3) o += c.p(RG.art._h.starPath(50, oy, 26, 9, 8), E.light, 0, ` opacity="${by(pose, 0.55, 0.8, 0.3)}"`);
        const ringR = by(pose, 15, 11, 18);
        o += c.e(50, oy, ringR, ringR * 0.3, 'none', 0, ` stroke="${OL}" stroke-width="${c.sw(4.4)}"`) + c.e(50, oy, ringR, ringR * 0.3, 'none', 0, ` stroke="${M.gold}" stroke-width="${c.sw(2.2)}"`);
        o += radOrb(c, 50, oy, L3 ? 10.5 : 9.5, pose);
        return o;
      }
      if (v === 'A') {
        // 일출 탑: 오벨리스크 위 햇살 원반(빛살이 aim에서 짧게 움츠렸다 fire에서 길게 뻗음)
        let o = base(c, 4, { stone: '#d8cfb8', trim: M.gold, seed: 129 });
        o += aura(c, 50, 32, 44, 36, E.color, by(pose, 0.45, 0.65, 0.85));
        o += groundRing(38, 11, 99);
        o += ao(c, 50, 99, 20, 6, 0.5);
        o += masonry(c, 'M34 101V95H66V101Q50 104 34 101Z', [34, 95, 66, 104], '#e6dfcf', { rowH: 3, bw: 8, seed: 130, bot: 0.3 });
        o += obeliskB(c, 50, 52, 96, 14, 25, ws, 131, { cap: false });
        o += c.p('M40.6 70H59.4V73H40.6Z', c.vg(M.gold, 0.35, -0.3), 1.6) + c.p('M39.5 84H60.5V87H39.5Z', c.vg(M.gold, 0.35, -0.3), 1.6);
        o += glyph(c, 50, 62, 0.9, 0, lit) + glyph(c, 50, 78, 0.9, 1, lit) + glyph(c, 50, 91, 0.7, 2, lit);
        o += c.ol('M44 52L50 46L56 52', M.gold, 2.4);
        const rOut = by(pose, 28, 23, 36);
        o += c.p(RG.art._h.starPath(50, 31, rOut, 16, 12), c.vg(M.gold, 0.35, -0.2), 2.6);
        if (pose === 'fire') o += c.p(RG.art._h.starPath(50, 31, rOut + 8, 18, 12), '#fff6c8', 0, ' opacity="0.55"');
        o += c.ci(50, 31, 14.5, c.sg(lit === 2 ? '#fff6c8' : '#ffe48a'), 3) + c.ci(50, 31, 7.5 + lit * 1.5, '#fffbe6', 0);
        if (pose === 'aim') o += c.ci(50, 31, 18, 'none', 0, ` stroke="#fff6c8" stroke-width="${c.sw(1.6)}" opacity="0.8"`) + spark(c, 30, 14, 2.4, '#fff', 0) + spark(c, 72, 18, 2.2, '#fff', 0);
        if (pose === 'fire') o += c.e(50, 31, 42, 13, 'none', 0, ` stroke="${E.color}" stroke-width="${c.sw(2.6)}" opacity="0.9"`) + spark(c, 50, 31, 20, '#fff', 0);
        return o;
      }
      // 'B' 정화의 탑: 엇갈린 두 금 고리 속 하얀 구슬, 떠도는 결정 조각
      let o = base(c, 4, { stone: '#d8cfb8', trim: M.gold, seed: 132 });
      o += aura(c, 50, 26, 34, 32, '#ffffff', by(pose, 0.45, 0.65, 0.85));
      o += groundRing(38, 11, 99);
      o += ao(c, 50, 99, 20, 6, 0.5);
      o += masonry(c, 'M34 101V95H66V101Q50 104 34 101Z', [34, 95, 66, 104], '#e6dfcf', { rowH: 3, bw: 8, seed: 133, bot: 0.3 });
      o += obeliskB(c, 50, 54, 96, 14, 25, ws, 134);
      o += c.p('M40.4 74H59.6V77H40.4Z', c.vg(M.gold, 0.35, -0.3), 1.6) + c.p('M39.4 88H60.6V91H39.4Z', c.vg(M.gold, 0.35, -0.3), 1.6);
      o += glyph(c, 50, 66, 0.9, 2, lit) + glyph(c, 50, 82, 0.9, 0, lit);
      const tilt = by(pose, 35, 18, 50);
      const rr = by(pose, 26, 21, 30);
      const rg2 = (a) => rotG(c.e(50, 26, rr, 9, 'none', 0, ` stroke="${OL}" stroke-width="${c.sw(6)}"`) + c.e(50, 26, rr, 9, 'none', 0, ` stroke="${M.gold}" stroke-width="${c.sw(3.4)}"`), a, [50, 26]);
      o += rg2(tilt);
      o += radOrb(c, 50, 26, 10.5, pose, '#ffffff');
      o += rg2(-tilt);
      const spread = by(pose, 1, 0.8, 1.35);
      const cry = (x, y, s0) => crystal(c, 50 + (x - 50) * spread, Math.max(9, 30 + (y - 30) * spread), 7 * s0, 12 * s0, '#fffbe6', 2);
      o += cry(18, 52, 1) + cry(82, 48, 1) + cry(26, 10, 0.86) + cry(76, 10, 0.86);
      return o;
    },
  };

  /* ================================================================
   * 🌑 저주 첨탑 — 검은 돌을 들쭉날쭉 쌓은 첨탑 꼭대기에 떠 있는 "지켜보는 눈".
   * 쉴 때 눈꺼풀을 반쯤 내리고 아래를 봄(idle) → 눈을 부릅뜨며 앞에 저주 문양(원·룬)이 그려짐(aim)
   * → 문양이 깨지며 저주탄이 튀어 나가고 눈이 번쩍(fire). 새긴 룬도 함께 켜짐.
   * 4A 파멸 첨탑: 뿔 둘 + 큰 눈, 문양은 해골 룬. 4B 역병 첨탑: 부푼 역병 주머니 속 눈, 독 방울을 뱉음.
   * ================================================================ */
  const DST2 = '#3d3348';
  /** 들쭉날쭉한 첨탑 실루엣 */
  function jagD(yt, yb, bw) {
    const L = (t) => yb - (yb - yt) * t;
    const pts = [[50 - bw / 2, yb], [50 - bw * 0.42, L(0.3)], [50 - bw * 0.48, L(0.38)], [50 - bw * 0.28, L(0.7)], [50 - bw * 0.16, L(0.85)], [52, yt],
      [50 + bw * 0.18, L(0.78)], [50 + bw * 0.3, L(0.62)], [50 + bw * 0.24, L(0.54)], [50 + bw * 0.44, L(0.25)], [50 + bw / 2, yb]];
    return `${poly(pts).slice(0, -1)}Q50 ${f(yb + bw * 0.18)} ${f(50 - bw / 2)} ${f(yb)}Z`;
  }
  function jagSpireB(c, yt, yb, bw, col, seed) {
    return masonry(c, jagD(yt, yb, bw), [50 - bw / 2, yt, 50 + bw / 2, yb + bw * 0.18], col, { rowH: 5, bw: 7, seed, round: true, mortar: '#17101e', bot: 0.35, top: 0.1, k1: 0.2 });
  }
  /** 새긴 룬(lit 0~2) */
  function hexRune(c, x, y, k, i, lit) {
    const d = [`M${f(x)} ${f(y - 6 * k)}V${f(y + 6 * k)}M${f(x - 4 * k)} ${f(y - 3 * k)}L${f(x)} ${f(y)}L${f(x + 4 * k)} ${f(y - 3 * k)}`,
      `M${f(x - 4 * k)} ${f(y - 6 * k)}L${f(x + 4 * k)} ${f(y)}L${f(x - 4 * k)} ${f(y + 6 * k)}M${f(x + 4 * k)} ${f(y - 6 * k)}V${f(y + 6 * k)}`,
      `M${f(x)} ${f(y - 6 * k)}L${f(x + 5 * k)} ${f(y)}L${f(x)} ${f(y + 6 * k)}L${f(x - 5 * k)} ${f(y)}Z`][i % 3];
    return c.ln(d, c.E.color, (3.6 + lit * 0.8) * k, 0.3 + lit * 0.2) + c.ln(d, lit === 2 ? '#fff' : c.E.light, 1.7 * k);
  }
  /** 저주 문양(원 + 룬 눈금 + 세모) */
  function sigil(c, x, y, r, broken) {
    const E = c.E;
    if (broken) {
      let s = '';
      for (let i = 0; i < 6; i++) { const a = i * 60 + 20; const p = pol([x, y], r * 1.1, a); s += c.p(`M${pp(pol(p, 2.6, a + 90))}L${pp(pol(p, 2.2, a))}L${pp(pol(p, 2.6, a - 90))}Z`, E.light, 1.2); }
      return s + c.ci(x, y, r * 1.18, 'none', 0, ` stroke="${E.color}" stroke-width="${c.sw(1.6)}" stroke-dasharray="${c.sw(3)} ${c.sw(4)}" opacity="0.8"`);
    }
    let ticks = '';
    for (let i = 0; i < 8; i++) { const a = i * 45; ticks += `M${pp(pol([x, y], r * 0.86, a))}L${pp(pol([x, y], r * 1.12, a))}`; }
    const tri = poly([pol([x, y], r * 0.9, -90), pol([x, y], r * 0.9, 30), pol([x, y], r * 0.9, 150)]);
    return aura(c, x, y, r * 1.5, r * 1.5, E.color, 0.5) + c.ci(x, y, r, 'none', 0, ` stroke="${OL}" stroke-width="${c.sw(4)}"`) + c.ci(x, y, r, 'none', 0, ` stroke="${E.color}" stroke-width="${c.sw(2)}"`)
      + c.ln(ticks, E.light, 1.6) + c.p(tri, 'none', 0, ` stroke="${E.light}" stroke-width="${c.sw(1.2)}" opacity="0.8"`);
  }
  /** 지켜보는 눈: 가운데 (x,y), 너비 w, open(0~1), look(눈동자 아래로), flash */
  function watchEye(c, x, y, w, open, look, flash, o = {}) {
    const h = c.h;
    const E = c.E;
    const hh = w * 0.42;
    const d = `M${f(x - w / 2)} ${f(y)}Q${f(x)} ${f(y - hh * 1.5)} ${f(x + w / 2)} ${f(y)}Q${f(x)} ${f(y + hh * 1.5)} ${f(x - w / 2)} ${f(y)}Z`;
    let s = aura(c, x, y, w * (0.9 + flash * 0.5), w * (0.7 + flash * 0.4), E.color, 0.55 + flash * 0.3);
    let inner = c.r(x - w, y - w, w * 2, w * 2, c.vg(o.white || '#f6e8ff', 0.2, -0.25), 0, 0);
    const py = y + look * hh * 0.35;
    inner += c.ci(x, py, hh * 0.85, c.sg(E.color), 0) + c.e(x, py, hh * (0.22 - open * 0.08), hh * 0.72, '#1a0b1e', 0) + c.ci(x - hh * 0.3, py - hh * 0.35, hh * 0.2, '#fff', 0);
    if (flash) inner += c.ci(x, py, hh * 0.9, c.ag('#ffffff', 0.9), 0);
    // 윗눈꺼풀(내려온 만큼 덮음) + 아랫눈꺼풀 조금
    const lidY = y - hh * 1.6 + (1 - open) * hh * 1.75;
    const lc = o.lid || '#4a3858';
    inner += c.p(`M${f(x - w)} ${f(y - w)}H${f(x + w)}V${f(lidY)}Q${f(x)} ${f(lidY + hh * 0.5)} ${f(x - w)} ${f(lidY)}Z`, c.vg(lc, 0.2, -0.2), 0) + c.ln(`M${f(x - w)} ${f(lidY)}Q${f(x)} ${f(lidY + hh * 0.5)} ${f(x + w)} ${f(lidY)}`, OL, 1.8);
    inner += c.p(`M${f(x - w)} ${f(y + w)}H${f(x + w)}V${f(y + hh * 0.95)}Q${f(x)} ${f(y + hh * 0.55)} ${f(x - w)} ${f(y + hh * 0.95)}Z`, c.vg(lc, 0.1, -0.2), 0);
    s += clip(c, d, inner) + c.p(d, 'none', 2.8);
    // 속눈썹 가시
    s += c.ln(`M${f(x - w * 0.3)} ${f(lidY - 0.5)}l-1.4 -3M${f(x)} ${f(lidY + hh * 0.2)}l0 -3.4M${f(x + w * 0.3)} ${f(lidY - 0.5)}l1.4 -3`, OL, 1.4);
    return s;
  }
  /** 저주탄(떠나는 순간): 꼬리 달린 보랏빛 불덩이, 위·앞으로 */
  function curseBolt(c, x, y, k = 1) {
    const E = c.E;
    const t = [x + 12 * k, y - 14 * k];
    return c.p(`M${f(x + 2 * k)} ${f(y - 1 * k)}Q${f(x + 4 * k)} ${f(y - 9 * k)} ${f(t[0] - 3 * k)} ${f(t[1] + 2 * k)}Q${f(t[0] + 4 * k)} ${f(t[1] - 5 * k)} ${f(t[0] + 5 * k)} ${f(t[1] + 2 * k)}Q${f(t[0] + 3 * k)} ${f(t[1] + 7 * k)} ${f(t[0] - 4 * k)} ${f(t[1] + 6 * k)}Q${f(x + 8 * k)} ${f(y - 2 * k)} ${f(x + 2 * k)} ${f(y - 1 * k)}Z`, c.vg(E.color, 0.3, -0.3), 1.8, ' opacity="0.9"')
      + c.ci(t[0] + 0.5 * k, t[1] + 1.5 * k, 3.4 * k, c.sg(E.light), 1.6) + c.ci(t[0] - 0.4 * k, t[1] + 1.2 * k, 0.8 * k, '#1a0b1e', 0) + c.ci(t[0] + 1.6 * k, t[1] + 1.2 * k, 0.8 * k, '#1a0b1e', 0);
  }
  const eyeState = (pose) => by(pose, { open: 0.38, look: 1, flash: 0 }, { open: 1, look: 0, flash: 0.3 }, { open: 0.72, look: -0.2, flash: 1 });
  /** 눈 + 자세 효과 한 벌 */
  function eyeRig(c, x, y, w, pose, o = {}) {
    const S = eyeState(pose);
    let s = '';
    if (pose === 'aim') s += o.sigil ? o.sigil(x, y, w * 0.82) : sigil(c, x, y, w * 0.82, false);
    s += watchEye(c, x, y, w, S.open, S.look, S.flash, o);
    if (pose === 'fire') s += sigil(c, x, y, w * 0.82, true) + curseBolt(c, x + w * 0.2, y - w * 0.15, o.boltK || 1.35) + c.ln(`M${f(x - w * 0.8)} ${f(y)}h-4M${f(x + w * 0.8)} ${f(y + 2)}h4M${f(x)} ${f(y + w * 0.6)}v4`, '#fff', 1.4, 0.8);
    return s;
  }
  /** 떠 있는 룬 돌(오각) */
  const runeStone = (c, x, y, i, lit) => c.p(RG.art._h.polyPath(x, y, 6, 5, -80), c.vg('#4a4054', 0.25, -0.2), 2.2) + hexRune(c, x, y, 0.5, i, lit);

  T.hex_spire = {
    muzzle: [[50, 30], [50, 23], [50, 21], [50, 30], [50, 29]],
    draw(c, v, pose = 'idle') {
      const h = c.h;
      const E = c.E;
      const lit = by(pose, 0, 1, 2);
      if (v === 1) {
        let o = base(c, 1, { rough: '#6e6474', seed: 141 });
        o += ao(c, 50, 104, 16, 5, 0.55);
        o += jagSpireB(c, 46, 104, 30, '#4a4054', 142);
        o += hexRune(c, 48, 82, 1, 0, lit);
        o += eyeRig(c, 50, 30, 20, pose);
        return o;
      }
      if (v === 2 || v === 3) {
        const L3 = v === 3;
        let o = base(c, v, { stone: STONE.dark, trim: '#a89cc0', seed: 143 });
        if (L3) o += aura(c, 50, 30, 30, 26, E.color, 0.3 + lit * 0.12);
        o += ao(c, 50, 104, 22, 6, 0.55);
        o += shard(c, 26, 60, 104, 12, '#4a4054') + shard(c, 75, 56, 104, 12, '#4a4054');
        o += jagSpireB(c, L3 ? 34 : 38, 104, L3 ? 36 : 34, DST2, 144);
        if (L3) o += c.ln('M37 88Q50 93 63 88M40 66Q50 70 60 66', OL, 4.6) + c.ln('M37 88Q50 93 63 88M40 66Q50 70 60 66', '#a89cc0', 2.4) + rivets(c, [[42, 89.6], [50, 91], [58, 89.6]], '#e0d8f0', 0.7);
        o += hexRune(c, 46, 78, 1, 0, lit) + hexRune(c, 54, 56, 0.85, 1, lit);
        const ey = L3 ? 21 : 23;
        o += eyeRig(c, 50, ey, L3 ? 26 : 22, pose);
        if (L3) {
          const rs = by(pose, [[20, 36], [80, 32]], [[22, 26], [78, 22]], [[13, 30], [87, 26]]);
          o += runeStone(c, ...rs[0], 2, lit) + runeStone(c, ...rs[1], 1, lit);
          if (pose === 'aim') o += c.ln(`M${rs[0][0] + 5} ${rs[0][1] - 2}L${50 - 12} ${ey}M${rs[1][0] - 5} ${rs[1][1] - 2}L${50 + 12} ${ey}`, E.color, 1.4, 0.7);
        }
        return o;
      }
      if (v === 'A') {
        // 파멸 첨탑: 뿔 둘, 큰 눈, 해골 룬 문양
        let o = base(c, 4, { stone: '#4a3f58', trim: E.color, seed: 145 });
        o += aura(c, 50, 30, 34, 28, E.color, 0.35 + lit * 0.12);
        o += ao(c, 50, 99, 24, 6, 0.55);
        const horn = (sgn) => c.p(sgn < 0 ? 'M40 50C26 46 12 34 10 6C18 24 28 32 42 36Z' : 'M60 50C74 46 88 34 90 6C82 24 72 32 58 36Z', c.vg('#e8dcc8', 0.2, -0.35), 3) + c.ln(sgn < 0 ? 'M16 22Q20 30 26 34M13 14Q16 20 20 24' : 'M84 22Q80 30 74 34M87 14Q84 20 80 24', '#a8987e', 1.4);
        const hr = by(pose, 0, -5, 3);
        o += rotG(horn(-1), hr, [40, 44]) + rotG(horn(1), -hr, [60, 44]);
        o += jagSpireB(c, 32, 99, 40, DST2, 146);
        o += hexRune(c, 44, 80, 1.1, 0, lit) + hexRune(c, 56, 62, 1, 2, lit);
        const skull = (x, y, r) => sigil(c, x, y, r, false) + c.p(`M${f(x - 4)} ${f(y - r * 0.55)}Q${f(x)} ${f(y - r * 0.9)} ${f(x + 4)} ${f(y - r * 0.55)}`, 'none', 0, ` stroke="${E.light}" stroke-width="${c.sw(1.4)}"`);
        o += eyeRig(c, 50, 30, 30, pose, { sigil: skull, boltK: 1.3 });
        return o;
      }
      // 'B' 역병 첨탑: 부푼 역병 주머니 속 눈, 흘러내리는 독, 뱉어 내는 독 방울
      let o = base(c, 4, { stone: '#4a3f58', trim: E.color, seed: 147 });
      o += aura(c, 50, 30, 36, 30, E.color, 0.35 + lit * 0.12);
      o += ao(c, 50, 99, 22, 6, 0.55);
      o += jagSpireB(c, 44, 99, 34, DST2, 148);
      o += hexRune(c, 46, 80, 1, 1, lit);
      const sw = by(pose, 1, 1.18, 0.92);
      o += c.ci(50, 30, 19 * sw, c.sg('#5a2a62'), 3);
      o += c.ln(`M${f(50 - 12 * sw)} 24L${f(50 - 6 * sw)} 30L${f(50 - 10 * sw)} 38M${f(50 + 8 * sw)} 18L${f(50 + 6 * sw)} 28L${f(50 + 12 * sw)} 34`, E.color, 2.2, 0.6 + lit * 0.2);
      o += c.p('M34 38Q36 50 34 56Q38 52 38 42ZM62 42Q66 52 64 60Q68 54 66 40ZM48 46Q50 56 48 62Q52 58 52 46Z', c.vg(E.color, 0.2, -0.2), 2);
      o += eyeRig(c, 50, 29, 18 * sw, pose, { white: '#e8f0c8', lid: '#5a2a62' });
      if (pose === 'fire') o += c.ci(78, 12, 3.6, c.sg(E.color), 1.6) + c.ci(84, 20, 2.6, c.sg(E.color), 1.4) + c.ci(72, 6, 2.2, c.sg(E.color), 1.2);
      o += c.ci(22, 30, 3.2, c.sg(E.color), 1.6) + c.ci(80, 34, 2.6, c.sg(E.color), 1.4) + c.ci(26, 12, 2.4, c.sg(E.color), 1.4);
      o += c.e(43, 20, 3.6, 2.4, '#fff', 0, ' opacity="0.45"');
      return o;
    },
  };

  /* ================================================================
   * 🌑 공허 구체 — 돌을 쌓은 받침 위, 검은 구체를 받쳐 든 돌손.
   * 쉴 때 손가락을 느슨히 오므려 작은 구체를 품음(idle) → 구체가 부풀며 주위 빛을 빨아들이고
   * 손가락이 꽉 감쌈(aim) → 손가락을 활짝 펴 구체를 위로 던짐(fire: 빈 손바닥, 소용돌이 고리, 솟는 꼬리).
   * 4A 블랙홀: 강착 원반이 빨라지며 커짐. 4B 분열 구체: 세 손가락 끝마다 작은 구체.
   * ================================================================ */
  function voidBallB(c, x, y, r, spin = 0) {
    const g = c.def('void', (id) => c.rgc(id, [[0, '#0a0410'], [0.6, '#1c0a24'], [0.86, '#6e2a72'], [1, '#e070d0']], 0.5, 0.5, 0.5));
    const sw = `M${f(x - r * 0.5)} ${f(y + r * 0.1)}Q${f(x - r * 0.2)} ${f(y - r * 0.5)} ${f(x + r * 0.4)} ${f(y - r * 0.3)}M${f(x + r * 0.45)} ${f(y + r * 0.2)}Q${f(x)} ${f(y + r * 0.55)} ${f(x - r * 0.35)} ${f(y + r * 0.35)}`;
    return c.ci(x, y, r, g, 3) + rotG(c.ln(sw, c.E.color, 2, 0.85), spin, [x, y]) + c.e(x - r * 0.38, y - r * 0.45, r * 0.22, r * 0.12, '#f2b8ea', 0, ' opacity="0.7"');
  }
  /** 빨려 드는 소용돌이 줄 */
  function suck(c, x, y, r) {
    let s = '';
    [0, 120, 240].forEach((a0) => { const p0 = pol([x, y], r * 2, a0); const p1 = pol([x, y], r * 1.05, a0 + 70); s += `M${pp(p0)}Q${pp(pol([x, y], r * 1.7, a0 + 45))} ${pp(p1)}`; });
    return c.ln(s, c.E.light, 1.6, 0.8) + [30, 150, 270].map((a) => c.ci(...pol([x, y], r * 1.8, a), 1.4, c.E.light, 0)).join('');
  }
  /** 돌 손가락 하나: 뿌리 (x,y), 길이 L, 굵기 w, 각 ang(0 = 위) */
  function stoneFinger(c, x, y, L, w, ang, col, nail) {
    const h = c.h;
    let s = c.p(`M${f(x - w)} ${f(y)}C${f(x - w * 1.15)} ${f(y - L * 0.45)} ${f(x - w * 0.7)} ${f(y - L * 0.92)} ${f(x)} ${f(y - L)}C${f(x + w * 0.55)} ${f(y - L * 0.9)} ${f(x + w * 0.95)} ${f(y - L * 0.45)} ${f(x + w)} ${f(y)}Z`, c.cg(col), 2.4);
    s += c.ln(`M${f(x - w * 0.6)} ${f(y - L * 0.45)}q${f(w * 0.6)} ${f(1)} ${f(w * 1.2)} 0`, hs(col, -0.4), 1, 0.8);
    if (nail) s += c.p(`M${f(x - w * 0.35)} ${f(y - L * 0.86)}L${f(x)} ${f(y - L - 2.4)}L${f(x + w * 0.35)} ${f(y - L * 0.86)}Z`, nail, 1.2);
    return rotG(s, ang, [x, y]);
  }
  /** 돌손: 손바닥 가운데 (x,y), 크기 k, curl(+ 오므림, − 폄), 결과 { back, front } */
  function stoneHand(c, x, y, k, col, curl, nail) {
    const h = c.h;
    const F = [[-15, -1, 30, 5.5, -24], [-6, -3, 33, 4.8, -7], [6, -3, 33, 4.8, 7], [15, -1, 30, 5.5, 24]];
    let back = '';
    F.forEach(([dx, dy, L, w, a]) => { const sg = Math.sign(dx); back += stoneFinger(c, x + dx * k, y + dy * k, L * k * (Math.abs(dx) > 10 ? 1 : 1.06), w * k, a - sg * curl, Math.abs(dx) > 10 ? col : hs(col, -0.15), nail); });
    const P = (a, b) => `${f(x + a * k)} ${f(y + b * k)}`;
    let front = c.p(`M${P(-20, -2)}Q${P(-20, 14)} ${P(0, 15)}Q${P(20, 14)} ${P(20, -2)}Q${P(0, 6)} ${P(-20, -2)}Z`, c.cg(col), 3);
    front += c.ln(`M${P(-11, 3.6)}Q${P(-11.5, 7)} ${P(-10, 10)}M${P(0, 6)}V${P(0, 12.5).split(' ')[1]}M${P(11, 3.6)}Q${P(11.5, 7)} ${P(10, 10)}`, hs(col, -0.38), 1.3) + c.ln(`M${P(-17, 2)}Q${P(-10, 8)} ${P(0, 8.5)}`, hs(col, 0.3), 1, 0.7);
    return { back, front };
  }
  /** 던진 순간: 빈 손 위 소용돌이 고리 + 위로 솟는 꼬리 */
  function launchFx(c, x, y, r) {
    const E = c.E;
    return c.e(x, y, r * 1.4, r * 0.45, 'none', 0, ` stroke="${E.color}" stroke-width="${c.sw(2.6)}" opacity="0.9"`) + c.e(x, y - 2, r * 2, r * 0.65, 'none', 0, ` stroke="${E.light}" stroke-width="${c.sw(1.4)}" opacity="0.6"`)
      + c.p(`M${f(x - r * 0.5)} ${f(y - 2)}Q${f(x - r * 0.3)} ${f(y - r * 1.6)} ${f(x)} ${f(y - r * 2.6)}Q${f(x + r * 0.3)} ${f(y - r * 1.6)} ${f(x + r * 0.5)} ${f(y - 2)}Z`, c.vg(E.color, 0.2, -0.2), 0, ' opacity="0.55"')
      + voidBallB(c, x, y - r * 2.6, r * 0.62, 40) + c.ln(`M${f(x - r * 1.2)} ${f(y - r * 1.2)}l-3 -3M${f(x + r * 1.2)} ${f(y - r * 1.2)}l3 -3`, '#fff', 1.4, 0.8);
  }
  /** 받침(돌쌓기 원뿔대) */
  function voidPedestal(c, yt, yb, rt, rb, col, seed, bands) {
    let s = masonry(c, `M${f(50 - rb)} ${f(yb)}L${f(50 - rt)} ${f(yt)}L${f(50 + rt)} ${f(yt)}L${f(50 + rb)} ${f(yb)}A${f(rb)} ${f(rb * 0.3)} 0 0 1 ${f(50 - rb)} ${f(yb)}Z`, [50 - rb, yt, 50 + rb, yb + rb * 0.3], col, { round: true, rowH: 5, bw: 6, bulge: rb * 0.3, seed, mortar: '#17101e', bot: 0.35, top: 0.35, k1: 0.2 });
    if (bands) bands.forEach(([y, r]) => { s += c.p(`M${f(50 - r)} ${f(y)}A${f(r)} ${f(r * 0.3)} 0 0 0 ${f(50 + r)} ${f(y)}V${f(y + 3.4)}A${f(r)} ${f(r * 0.3)} 0 0 1 ${f(50 - r)} ${f(y + 3.4)}Z`, c.vg('#a89cc0', 0.35, -0.25), 1.8); });
    return s;
  }

  T.void_orb = {
    muzzle: [[50, 60], [50, 52], [50, 46], [50, 40], [50, 18]],
    draw(c, v, pose = 'idle') {
      const h = c.h;
      const E = c.E;
      const curl = by(pose, 0, 10, -26);
      if (v === 1 || v === 2 || v === 3) {
        const k = [0, 0.9, 1, 1.1][v];
        const hy = [0, 76, 70, 66][v];
        const col = v === 1 ? '#6e6474' : '#5a4e68';
        let o = base(c, v, v === 1 ? { rough: '#6e6474', seed: 151 } : { stone: STONE.dark, trim: '#a89cc0', seed: 151 });
        const oy = hy - 16 * k;
        const r = by(pose, 12, 16, 12) * k;
        o += aura(c, 50, oy, 26 * k, 26 * k, E.color, by(pose, 0.45, 0.75, 0.55));
        o += ao(c, 50, 104, 14 * k + 4, 5, 0.55);
        o += voidPedestal(c, hy + 8, 104, 8 * k, 13 * k + 2, col, 152, v === 3 ? [[hy + 13, 9 * k], [hy + 28, 11 * k]] : null);
        if (v >= 2) o += hexRune(c, 50, hy + 24, 0.55, 2, by(pose, 0, 1, 2));
        const H = stoneHand(c, 50, hy, k, col, curl, v >= 2 ? E.light : null);
        o += H.back;
        if (pose === 'aim') o += suck(c, 50, oy, r);
        if (pose !== 'fire') o += voidBallB(c, 50, oy + (pose === 'aim' ? -2 : 0), r, by(pose, 0, 50, 0));
        o += H.front;
        if (pose === 'fire') o += launchFx(c, 50, hy - 6 * k, 12 * k);
        if (v === 3) o += c.ci(22, hy - 30, 2.6, c.sg(E.color), 1.6) + c.ci(80, hy - 22, 3, c.sg(E.color), 1.6) + c.ci(72, hy - 44, 2.2, c.sg(E.color), 1.4);
        return o;
      }
      const col = '#5a4e68';
      if (v === 'A') {
        // 블랙홀: 손 위 구체를 두른 강착 원반(뒤·앞 반쪽), aim에 더 빨리 돌고 밝아짐, fire에 원반이 퍼짐
        let o = base(c, 4, { stone: '#4a3f58', trim: E.color, seed: 153 });
        o += aura(c, 50, 40, 46, 30, E.color, by(pose, 0.45, 0.7, 0.6));
        o += ao(c, 50, 99, 20, 6, 0.55);
        const ringG = c.def('acc', (id) => c.lgc(id, [[0, '#f2b8ea'], [0.5, '#d14fc0'], [1, '#6e1f66']], 'h'));
        const rot = by(pose, -12, -4, -16);
        const sc = by(pose, 1, 1.04, 1.12);
        const disk = (back) => rotG(back ? c.p(`M${f(50 - 44 * sc)} 40A${f(44 * sc)} ${f(12 * sc)} 0 0 1 ${f(50 + 44 * sc)} 40L${f(50 + 30 * sc)} 40A${f(30 * sc)} ${f(7 * sc)} 0 0 0 ${f(50 - 30 * sc)} 40Z`, ringG, 2.6) : c.p(`M${f(50 - 44 * sc)} 40A${f(44 * sc)} ${f(12 * sc)} 0 0 0 ${f(50 + 44 * sc)} 40L${f(50 + 30 * sc)} 40A${f(30 * sc)} ${f(7 * sc)} 0 0 1 ${f(50 - 30 * sc)} 40Z`, ringG, 2.6)
          + c.ln(`M${f(50 - 38 * sc)} ${f(40 + (back ? -2 : 4))}A${f(38 * sc)} ${f(9.5 * sc)} 0 0 ${back ? 1 : 0} ${f(50 + 38 * sc)} ${f(40 + (back ? -2 : 4))}`, '#fff', 1.2, pose === 'idle' ? 0.4 : 0.8), rot, [50, 40]);
        o += voidPedestal(c, 74, 99, 10, 16, col, 154, [[80, 11], [92, 13.5]]);
        const H = stoneHand(c, 50, 70, 1.05, col, curl, E.light);
        o += H.back + disk(true);
        if (pose !== 'fire') o += voidBallB(c, 50, 40, by(pose, 17, 20, 17), by(pose, 0, 60, 0));
        if (pose === 'aim') o += suck(c, 50, 40, 20);
        o += disk(false) + H.front;
        if (pose === 'fire') o += launchFx(c, 50, 58, 14);
        return o;
      }
      // 'B' 분열 구체: 세 손가락 끝마다 작은 구체
      let o = base(c, 4, { stone: '#4a3f58', trim: E.color, seed: 155 });
      o += aura(c, 50, 36, 40, 32, E.color, by(pose, 0.45, 0.7, 0.6));
      o += ao(c, 50, 99, 20, 6, 0.55);
      o += voidPedestal(c, 76, 99, 10, 16, col, 156, [[82, 11], [93, 13.5]]);
      const out = by(pose, 0, -4, 7);
      const tips = [[22 - out, 36 - out * 0.5], [50, 18 - out * 0.4], [78 + out, 36 - out * 0.5]];
      const fin = (x0, y0, t) => c.ol(`M${f(x0)} ${f(y0)}Q${f((x0 + t[0]) / 2 + (t[0] < 50 ? -3 : t[0] > 50 ? 3 : 0))} ${f((y0 + t[1]) / 2)} ${f(t[0])} ${f(t[1] + 8)}`, hs(col, 0.05), 7);
      o += fin(42, 72, tips[0]) + fin(58, 72, tips[2]) + fin(50, 70, tips[1]);
      o += c.p('M34 80Q34 66 50 64Q66 66 66 80Q50 88 34 80Z', c.cg(col), 3) + c.ln('M43 70Q42 75 43 80M50 68V82M57 70Q58 75 57 80', hs(col, -0.38), 1.3);
      const rb = by(pose, 10, 12.5, 10);
      if (pose !== 'fire') {
        o += voidBallB(c, tips[0][0], tips[0][1], rb, 0) + voidBallB(c, tips[2][0], tips[2][1], rb, 0) + voidBallB(c, tips[1][0], tips[1][1], rb + 1, 0);
        if (pose === 'aim') o += suck(c, 50, 18, 12) + c.ln('M28 30Q50 8 72 30', E.color, 2, 0.8);
        else o += c.ln('M28 30Q50 8 72 30', E.color, 2, 0.5);
      } else {
        tips.forEach((t) => { o += c.e(t[0], t[1] + 6, 8, 2.6, 'none', 0, ` stroke="${E.color}" stroke-width="${c.sw(2.2)}" opacity="0.9"`) + spark(c, t[0], t[1] + 2, 4, E.light, 0); });
        o += c.p('M46 20Q48 14 50 9Q52 14 54 20Z', c.vg(E.color, 0.2, -0.2), 0, ' opacity="0.6"') + voidBallB(c, 50, 9, 5.5, 30);
      }
      return o;
    },
  };

  /* ================================================================
   * 🌑 그림자 덫 — 덫 사냥꾼의 A자 오두막과, 그 앞의 그림자 사냥꾼.
   * 쉴 때 덫을 허리춤에 늘어뜨림(idle) → 몸을 뒤로 젖히고 덫을 머리 뒤로 감아 올림(aim)
   * → 팔을 앞으로 뿌려 덫을 던짐(fire: 덫이 손을 떠나 날아감, 바닥 문양이 번쩍).
   * 4A 속박의 사슬: 높은 사슬 기둥, 사슬 달린 덫. 4B 그림자 칼날: 지붕의 낫 날, 톱니 칼날 덫.
   * ================================================================ */
  const HUNTER = { skin: '#6a5280', shirt: '#4a3a5e', pants: '#3a2c4a', boot: '#221828' };
  const hunterFace = (c, H, r) => aura(c, H[0] + r * 0.55, H[1] + r * 0.1, r * 0.9, r * 0.6, c.E.color, 0.7) + c.e(H[0] + r * 0.3, H[1] + r * 0.1, r * 0.16, r * 0.24, c.E.light, 0) + c.e(H[0] + r * 0.78, H[1] + r * 0.08, r * 0.14, r * 0.22, c.E.light, 0);
  /** 두건: tier 1 천 두건, 2 + 가죽 끈, 3 + 가면 뿔, A·B 망토 깃 */
  function hood(tier) {
    return (c, H, r) => {
      const [x, y] = H;
      const col = '#54426a';
      let s = c.p(`M${f(x + r * 1.15)} ${f(y - r * 0.15)}C${f(x + r * 1.0)} ${f(y - r * 1.3)} ${f(x - r * 0.6)} ${f(y - r * 1.6)} ${f(x - r * 1.25)} ${f(y - r * 0.4)}C${f(x - r * 1.5)} ${f(y + r * 0.6)} ${f(x - r * 1.2)} ${f(y + r * 1.5)} ${f(x - r * 0.6)} ${f(y + r * 1.7)}L${f(x - r * 0.1)} ${f(y + r * 0.9)}Q${f(x - r * 0.15)} ${f(y - r * 0.55)} ${f(x + r * 1.15)} ${f(y - r * 0.15)}Z`, c.vg(col, 0.25, -0.25), 2.4);
      s += c.p(`M${f(x + r * 1.0)} ${f(y - r * 1.0)}Q${f(x + r * 1.7)} ${f(y - r * 1.2)} ${f(x + r * 1.9)} ${f(y - r * 0.6)}Q${f(x + r * 1.4)} ${f(y - r * 0.75)} ${f(x + r * 1.05)} ${f(y - r * 0.45)}Z`, c.vg(col, 0.2, -0.2), 1.8);
      if (tier !== 1) s += c.ln(`M${f(x - r * 1.1)} ${f(y - r * 0.6)}Q${f(x)} ${f(y - r * 1.1)} ${f(x + r * 1.0)} ${f(y - r * 0.75)}`, tier === 'B' ? M.silver : '#8a6a4a', 1.4);
      if (tier === 3 || tier === 'A' || tier === 'B') s += c.p(`M${f(x - r * 0.4)} ${f(y - r * 1.3)}L${f(x - r * 0.9)} ${f(y - r * 2.2)}L${f(x + r * 0.1)} ${f(y - r * 1.45)}Z`, c.vg('#e8dcc8', 0.2, -0.3), 1.6);
      return s;
    };
  }
  /** 쇠 덫(위에서 본 둥근 테 + 안쪽 이빨 + 가운데 발판) */
  function bearTrapB(c, x, y, k, ang = 0, glow = false) {
    const E = c.E;
    let teeth = '';
    for (let i = 0; i < 8; i++) {
      const a = i * 45 + 22;
      const p0 = [x + Math.cos(a * RAD) * 6.2 * k, y + Math.sin(a * RAD) * 4 * k];
      const p1 = [x + Math.cos((a - 12) * RAD) * 6.4 * k, y + Math.sin((a - 12) * RAD) * 4.2 * k];
      const p2 = [x + Math.cos((a + 12) * RAD) * 6.4 * k, y + Math.sin((a + 12) * RAD) * 4.2 * k];
      teeth += `M${pp(p1)}L${pp(mix2(p0, [x, y], 0.45))}L${pp(p2)}Z`;
    }
    let s = glow ? aura(c, x, y, 10 * k, 7 * k, E.color, 0.65) : '';
    s += c.e(x, y, 7 * k, 4.6 * k, 'none', 0, ` stroke="${OL}" stroke-width="${c.sw(4.6)}"`) + c.e(x, y, 7 * k, 4.6 * k, 'none', 0, ` stroke="#dfe5ec" stroke-width="${c.sw(2.2)}"`);
    s += c.p(teeth, '#c3cbd6', 1) + c.e(x, y, 2.6 * k, 1.8 * k, c.sg(E.color), 1.4);
    s += c.ln(`M${f(x - 5 * k)} ${f(y - 2.6 * k)}Q${f(x)} ${f(y - 4.6 * k)} ${f(x + 5 * k)} ${f(y - 2.6 * k)}`, '#fff', 1, 0.8);
    return ang ? rotG(s, ang, [x, y]) : s;
  }
  /** 톱니 칼날 덫(4B) */
  function bladeTrap(c, x, y, k, ang = 0) {
    let d = '';
    for (let i = 0; i < 8; i++) { const a = i * 45; d += `${i ? 'L' : 'M'}${pp(pol([x, y], 7 * k, a))}L${pp(pol([x, y], 4.4 * k, a + 22))}`; }
    return rotG(c.p(`${d}Z`, c.vg(M.silver, 0.4, -0.2), 1.8) + c.ci(x, y, 2.6 * k, c.sg(c.E.color), 1.4), ang, [x, y]);
  }
  /** 바닥 덫 문양 */
  function runeCircleB(c, x, y, r, a = 0.9, flash = false) {
    const E = c.E;
    return (flash ? aura(c, x, y, r * 1.6, r * 0.6, E.color, 0.8) : '') + c.e(x, y, r, r * 0.3, 'none', 0, ` stroke="${E.color}" stroke-width="${c.sw(2)}" opacity="${a}"`) + c.ln(`M${f(x - r * 0.6)} ${f(y)}L${f(x)} ${f(y - r * 0.2)}L${f(x + r * 0.6)} ${f(y)}L${f(x)} ${f(y + r * 0.2)}Z`, flash ? '#fff' : E.color, 1.4, a);
  }
  /** A자 오두막: 가운데 cx, 꼭대기 ya, 바닥 yb, 반너비 w */
  function aHutB(c, cx, ya, yb, w, wall, roof, edge, seed) {
    const h = c.h;
    let s = roofPlane(c, [cx, ya], [8, -8], [w, yb - ya], 'thatch', roof, { lit: -0.15, seed });
    const d = `M${f(cx - w)} ${f(yb)}L${f(cx)} ${f(ya)}L${f(cx + w)} ${f(yb)}Q${f(cx)} ${f(yb + 5)} ${f(cx - w)} ${f(yb)}Z`;
    s += planks(c, d, [cx - w, ya, cx + w, yb + 5], wall, { pw: 4.4, seed: seed + 1, top: 0.35, bot: 0.35, k1: 0.25 });
    s += beam(c, [cx - w - 4, yb + 2], [cx, ya - 4], 4, edge) + beam(c, [cx + w + 4, yb + 2], [cx, ya - 4], 4, hs(edge, -0.15));
    // 처마 끝 X자 + 뼈 장식
    s += c.ol(`M${f(cx - 4)} ${f(ya - 9)}L${f(cx)} ${f(ya - 4)}L${f(cx + 4)} ${f(ya - 9)}`, edge, 2.4);
    return s;
  }
  function darkDoorB(c, x, yb, w, ht, eyes) {
    const r = w / 2;
    const d = `M${f(x - r)} ${f(yb)}V${f(yb - ht + r)}A${f(r)} ${f(r)} 0 0 1 ${f(x + r)} ${f(yb - ht + r)}V${f(yb)}Z`;
    const g = c.def('snDoor', (id) => c.rgc(id, [[0, '#3a1640'], [0.6, '#1a0b1e'], [1, '#0a050c']], 0.5, 0.8, 0.8));
    let s = c.p(d, g, 2.6) + c.p(`M${f(x - r - 2)} ${f(yb)}V${f(yb - ht + r)}A${f(r + 2)} ${f(r + 2)} 0 0 1 ${f(x + r + 2)} ${f(yb - ht + r)}V${f(yb)}`, 'none', 0, ` stroke="${M.woodD}" stroke-width="${c.sw(2.4)}"`);
    if (eyes) s += c.ci(x - w * 0.18, yb - ht * 0.55, 1.4, c.E.light, 0) + c.ci(x + w * 0.18, yb - ht * 0.55, 1.4, c.E.light, 0);
    return s;
  }
  /** 사냥꾼 자세 — 엉덩이 (x,y) 기준 */
  function hunterPose(pose, x, y) {
    return by(pose,
      { lean: 2, hip: [x, y], feet: [[x - 5, y + 13], [x + 6, y + 13]], hB: [x - 5, y + 1.5], hF: [x + 6.5, y + 2], bend: [1, 1] },
      { lean: -14, hip: [x - 1, y + 0.5], feet: [[x - 6, y + 13], [x + 7, y + 13]], hB: [x + 7, y - 7], hF: [x - 8, y - 18], bend: [1, -1] },
      { lean: 16, hip: [x + 1.5, y + 0.5], feet: [[x - 6, y + 13], [x + 8, y + 13]], hB: [x - 6, y + 1], hF: [x + 14, y - 9], bend: [1, 1] });
  }
  function hunter(c, pose, x, y, tier, trapFn) {
    const P = hunterPose(pose, x, y);
    const F = fig(c, { ...HUNTER, sleeve: '#43345a', belt: '#8a6a4a', hip: P.hip, lean: P.lean, feet: P.feet, hands: [P.hB, P.hF], bend: P.bend, face: hunterFace, hat: hood(tier) });
    // 망토(등 뒤로 늘어짐)
    const cape = c.p(`M${pp(F.sh[0])}Q${f(x - 10)} ${f(y + 2)} ${f(x - 8 + by(pose, 0, -3, -6))} ${f(y + 12)}L${f(x - 1)} ${f(y + 10)}Q${f(x - 2)} ${f(y)} ${pp(F.neck)}Z`, c.vg('#3a2c4e', 0.2, -0.25), 2.2) + c.ln(`M${pp(F.sh[0])}Q${f(x - 10)} ${f(y + 2)} ${f(x - 8 + by(pose, 0, -3, -6))} ${f(y + 12)}`, '#8a78b0', 1, 0.8);
    // 허리에 찬 여분 덫(2단계부터)
    const spare = '';
    let held = '';
    let fx = '';
    if (pose !== 'fire') held = trapFn(P.hF[0] + (pose === 'aim' ? -3 : 2), P.hF[1] + (pose === 'aim' ? -4 : 5), pose === 'aim' ? -30 : 70);
    else {
      const t = [P.hF[0] + 9, P.hF[1] - 4];
      fx = c.ln(`M${f(P.hF[0] - 2)} ${f(P.hF[1] + 8)}Q${f(P.hF[0] + 4)} ${f(P.hF[1] - 6)} ${f(t[0] - 4)} ${f(t[1] - 2)}`, '#fff', 1.4, 0.6) + c.ln(`M${f(P.hF[0] - 6)} ${f(P.hF[1] + 4)}Q${f(P.hF[0])} ${f(P.hF[1] - 10)} ${f(t[0] - 6)} ${f(t[1] - 6)}`, c.E.light, 1.2, 0.5) + trapFn(t[0], t[1], 25);
    }
    const glow = aura(c, x + 1, y - 6, 16, 20, c.E.color, 0.35);
    // 감아 올린 덫은 머리 뒤(몸 뒤), 나머지는 손 앞
    if (pose === 'aim') return glow + cape + F.back + held + F.body + spare + F.handB + F.front + fx;
    return glow + cape + F.back + F.body + spare + F.handB + held + F.front + fx;
  }

  T.shadow_snare = {
    muzzle: [[90, 82], [92, 80], [92, 80], [90, 78], [90, 78]],
    draw(c, v, pose = 'idle') {
      const h = c.h;
      const E = c.E;
      const flash = pose === 'fire';
      if (v === 1) {
        let o = base(c, 1, { seed: 161 });
        o += runeCircleB(c, 22, 110, 8, 0.8, flash);
        o += ao(c, 40, 104, 24, 6, 0.55);
        o += aHutB(c, 40, 58, 104, 22, M.plank, '#7a6a4a', M.woodD, 162);
        o += darkDoorB(c, 40, 105, 13, 19, true);
        o += hunter(c, pose, 72, 95, 1, (x, y, a) => bearTrapB(c, x, y, 1, a, pose !== 'idle'));
        return o;
      }
      if (v === 2 || v === 3) {
        const L3 = v === 3;
        let o = base(c, v, { stone: STONE.dark, trim: '#a89cc0', seed: 163 });
        if (L3) o += aura(c, 44, 70, 34, 30, E.color, 0.35);
        o += runeCircleB(c, 20, 108, 8, 0.85, flash);
        o += ao(c, 44, 104, 28, 7, 0.55);
        o += masonry(c, cylD(44, 93, 104, 28, 8.4), [16, 93, 72, 112], hs(STONE.dark, 0.1), { round: true, rowH: 3.8, bw: 7, bulge: 8.4, seed: 164, mortar: '#17101e', bot: 0.35 });
        o += aHutB(c, 44, 46, 96, 26, '#6a5560', '#4a3d58', L3 ? '#a89cc0' : M.woodD, 165);
        o += darkDoorB(c, 44, 97, 14, 22, true);
        o += c.ol('M44 42V38', M.iron, 1.4) + aura(c, 44, 34, 6, 6, E.color, 0.8) + c.ci(44, 34, 3.4, c.sg(E.color), 1.8);
        if (L3) o += hexRune(c, 44, 66, 0.75, 2, by(pose, 0, 1, 2)) + runeCircleB(c, 88, 104, 7, 0.8, flash);
        else o += c.ol('M30 60V64', M.iron, 1.2) + bearTrapB(c, 30, 68, 0.6, 80);
        o += hunter(c, pose, 74, 96, L3 ? 3 : 2, (x, y, a) => bearTrapB(c, x, y, 1.05, a, pose !== 'idle' || L3));
        return o;
      }
      if (v === 'A') {
        // 속박의 사슬: 오두막 뒤 높은 사슬 기둥, 사슬 달린 덫을 던짐
        let o = base(c, 4, { stone: '#4a3f58', trim: E.color, seed: 166 });
        o += aura(c, 40, 30, 30, 30, E.color, 0.35);
        o += ao(c, 42, 99, 30, 7, 0.55);
        o += masonry(c, 'M34 74V8H46V74Z', [34, 8, 46, 74], '#4a3d58', { rowH: 5, bw: 12, seed: 167, mortar: '#17101e', top: 0.1, bot: 0.3 });
        o += c.p('M30 10H50L46 3H34Z', c.vg('#a89cc0', 0.3, -0.2), 2.4);
        o += hexRune(c, 40, 24, 0.8, 0, by(pose, 0, 1, 2));
        const sag = by(pose, 14, 8, 4);
        const chainB = (x1, y1, x2, y2, s2) => { const d = `M${x1} ${y1}Q${f((x1 + x2) / 2)} ${f((y1 + y2) / 2 + s2)} ${x2} ${y2}`; return c.ln(d, OL, 5.6) + `<path d="${d}" fill="none" stroke="${M.ironL}" stroke-width="${c.sw(2.8)}" stroke-dasharray="${c.sw(3.6)} ${c.sw(2)}"/>`; };
        o += chainB(36, 14, 8, 94, sag) + chainB(44, 30, 18, 98, sag * 0.5);
        o += masonry(c, cylD(42, 88, 99, 28, 8.4), [14, 88, 70, 107], hs(STONE.dark, 0.1), { round: true, rowH: 3.8, bw: 7, bulge: 8.4, seed: 168, mortar: '#17101e', bot: 0.35 });
        o += aHutB(c, 42, 50, 92, 26, '#6a5560', '#4a3d58', '#a89cc0', 169);
        o += darkDoorB(c, 42, 93, 14, 22, true);
        o += runeCircleB(c, 18, 104, 8, 0.85, flash) + runeCircleB(c, 64, 108, 7, 0.85, flash);
        const P = hunterPose(pose, 74, 91);
        o += hunter(c, pose, 74, 91, 'A', (x, y, a) => bearTrapB(c, x, y, 1.1, a, true));
        // 손목에서 덫까지 사슬
        const t = pose === 'fire' ? [P.hF[0] + 9, P.hF[1] - 4] : [P.hF[0] + (pose === 'aim' ? -3 : 1.5), P.hF[1] + (pose === 'aim' ? -4 : 4)];
        const anchor = [56, 70];
        o += chainB(anchor[0], anchor[1], f(t[0]), f(t[1]), by(pose, 10, 6, -4));
        o += c.ci(anchor[0], anchor[1], 2.6, 'none', 0, ` stroke="${OL}" stroke-width="${c.sw(4.4)}"`) + c.ci(anchor[0], anchor[1], 2.6, 'none', 0, ` stroke="${M.ironL}" stroke-width="${c.sw(2.2)}"`);
        return o;
      }
      // 'B' 그림자 칼날: 지붕 위 엇갈린 낫 날, 톱니 칼날 덫을 던짐
      let o = base(c, 4, { stone: '#4a3f58', trim: E.color, seed: 170 });
      o += aura(c, 42, 28, 40, 26, E.color, 0.4);
      o += ao(c, 42, 99, 30, 7, 0.55);
      const bl = (s) => c.p(s > 0 ? 'M42 56L72 10C82 18 84 30 80 40C76 30 72 26 68 26L46 60Z' : 'M42 56L12 10C2 18 0 30 4 40C8 30 12 26 16 26L38 60Z', c.vg(M.silver, 0.4, -0.2), 2.6);
      o += bl(1) + bl(-1) + c.ln('M72 12C80 20 82 30 80 38M12 12C4 20 2 30 4 38', E.color, 2);
      o += masonry(c, cylD(42, 88, 99, 28, 8.4), [14, 88, 70, 107], hs(STONE.dark, 0.1), { round: true, rowH: 3.8, bw: 7, bulge: 8.4, seed: 171, mortar: '#17101e', bot: 0.35 });
      o += aHutB(c, 42, 48, 92, 28, '#6a5560', '#3a2e48', '#a89cc0', 172);
      o += c.p('M32 64L28 56L36 60ZM52 64L56 56L48 60Z', c.vg(M.silver), 1.6);
      o += darkDoorB(c, 42, 93, 14, 22, true);
      o += c.ln('M16 106Q28 98 40 106', E.color, 2.2, flash ? 1 : 0.7);
      o += hunter(c, pose, 74, 91, 'B', (x, y, a) => bladeTrap(c, x, y, 1, a + by(pose, 0, 0, 30)));
      if (flash) o += c.ln('M86 66q6 4 4 10M90 62q8 6 6 14', E.light, 1.4, 0.8);
      return o;
    },
  };

  /* 4차: 이 파일의 탑은 색을 튼 명암(enhance)으로 그림 */
  ['stone_barracks', 'quake_hammer', 'crystal_mine', 'sun_lens', 'sanctuary', 'radiance_spire', 'hex_spire', 'void_orb', 'shadow_snare'].forEach((id) => {
    const d0 = T[id].draw;
    T[id].draw = (c, v, pose) => d0(enhance(c), v, pose);
  });
})();
