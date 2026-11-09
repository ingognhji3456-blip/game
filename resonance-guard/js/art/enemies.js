'use strict';

/* =========================================================
 * 적 그림 — 40종 + 보스 6종 (SVG 문자열)
 * 규격: docs/ARCHITECTURE.md §5
 *   RG.art.enemy(type, frame) — viewBox 0 0 100 100, 발 (50,90), 오른쪽을 바라봄
 *   frame 0·1: 걷기/날갯짓 2프레임. 그림자는 그리지 않음(렌더러 몫).
 * 외형: docs/design/enemies.md — 잿빛 몸 + 하얗게 빛나는 눈 + 지역 원소 색 포인트
 * ========================================================= */
RG.art.enemy = (() => {
  const H = RG.art._h;
  const OL = H.OL;
  const sh = H.shade;
  const mx = H.mix;

  /* ---------- 팔레트 ---------- */
  const GREY = '#8e8a9b';     // 안개에 물든 몸
  const GREY_L = '#c3c0cd';
  const GREY_D = '#5c596a';
  const MISTC = '#ebe8f4';    // 안개 김
  const HALO = '#f2f8ff';     // 눈 빛 번짐
  const GREEN = '#9fd45f';    // 1지역 들판
  const ICE = '#5fd4ff';      // 2지역 서리
  const ICE_L = '#c8f2ff';
  const EMBER = '#ff7a3d';    // 3지역 불씨
  const EMBER_L = '#ffc46b';
  const SAND = '#cfae7a';
  const VOLT = '#9b8cff';     // 4지역 번개
  const VOLT_L = '#e4ddff';
  const SEA = '#3fbcb0';      // 4지역 바다
  const BELL = '#9a90b4';     // 5지역 대종(잿빛 보라)
  const GOLD = '#e2b650';
  const BRONZE = '#b48a4a';

  /* ---------- 그리기 문맥 ----------
   * 한 장의 SVG마다 하나. defs(그라데이션·필터) id는 uid로 고유하게.
   * 전체를 외곽선 스타일 <g>로 감싸므로, 각 도형은 fill만 주면 외곽선이 붙음.
   */
  function make(ow = 3) {
    const defs = [];
    let softId = null;
    let glowId = null;
    const c = {
      ow,
      /** 몸통용 방사형 그라데이션 (빛은 왼쪽 위) */
      body(base, hi = 0.4, lo = -0.36, cx = 0.34, cy = 0.28, r = 0.9) {
        const id = H.uid('e');
        defs.push(H.rg(id, [[0, sh(base, hi)], [0.5, base], [1, sh(base, lo)]], cx, cy, r));
        return `url(#${id})`;
      },
      /** 선형 그라데이션 */
      lin(stops, dir = 'v') {
        const id = H.uid('e');
        defs.push(H.lg(id, stops, dir));
        return `url(#${id})`;
      },
      tri(base, dir = 'v') {
        const id = H.uid('e');
        defs.push(H.tri(id, base, dir));
        return `url(#${id})`;
      },
      rad(stops, cx = 0.5, cy = 0.5, r = 0.5) {
        const id = H.uid('e');
        defs.push(H.rg(id, stops, cx, cy, r));
        return `url(#${id})`;
      },
      /** 부드러운 흐림 필터 속성 (빛 번짐, 안개용) */
      soft() {
        if (!softId) { softId = H.uid('ef'); defs.push(H.blur(softId, 2.2)); }
        return `filter="url(#${softId})"`;
      },
      glow() {
        if (!glowId) { glowId = H.uid('eg'); defs.push(H.glow(glowId, 1.6)); }
        return `filter="url(#${glowId})"`;
      },
      /* --- 도형 (외곽선 자동) --- */
      P: (d, fill, x = '') => `<path d="${d}" fill="${fill}"${x}/>`,
      /** 외곽선 없는 도형 */
      Pn: (d, fill, op) => `<path d="${d}" fill="${fill}" stroke="none"${op != null ? ` opacity="${op}"` : ''}/>`,
      E: (cx, cy, rx, ry, fill, x = '') => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}"${x}/>`,
      En: (cx, cy, rx, ry, fill, op) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="none"${op != null ? ` opacity="${op}"` : ''}/>`,
      /** 선만 (금, 무늬) */
      L: (d, col = OL, w = 2, x = '') => `<path d="${d}" fill="none" stroke="${col}" stroke-width="${w}"${x}/>`,
      /** 외곽선 있는 굵은 선 (다리, 꼬리, 팔) */
      limb(d, w, col) {
        return `<path d="${d}" fill="none" stroke-width="${w + 2 * ow}"/><path d="${d}" fill="none" stroke="${col}" stroke-width="${w}"/>`;
      },
      /** 엉덩이(x,y)에서 땅으로 내려오는 다리. 발바닥 외곽선이 정확히 y=90에 닿음 */
      leg(x, y, dx, w, col, lift = 0, bend = 0) {
        const fy = H.n(90 - w / 2 - ow - lift);
        const fx = x + dx;
        const d = bend ? `M${x} ${y}Q${H.n((x + fx) / 2 + bend)} ${H.n((y + fy) / 2)} ${fx} ${fy}` : `M${x} ${y}L${fx} ${fy}`;
        return c.limb(d, w, col);
      },
      /** 땅에 닿는 발(타원) — 바닥이 y=90 */
      foot(x, rx, ry, fill, lift = 0) {
        return c.E(x, H.n(90 - ry - ow / 2 - lift), rx, ry, fill);
      },
      /** 하얗게 빛나는 눈 */
      eye(x, y, r, ring = true) {
        return `<circle cx="${x}" cy="${y}" r="${H.n(r * 2)}" fill="${HALO}" opacity=".5" stroke="none" ${c.soft()}/>` +
          `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff"${ring ? ` stroke-width="${H.n(Math.max(1.6, ow * 0.7))}"` : ' stroke="none"'}/>`;
      },
      /** 빛나는 점(불씨, 전기 등) */
      spark(x, y, r, col) {
        return `<circle cx="${x}" cy="${y}" r="${H.n(r * 2.2)}" fill="${col}" opacity=".55" stroke="none" ${c.soft()}/>` +
          `<circle cx="${x}" cy="${y}" r="${r}" fill="${sh(col, 0.55)}" stroke="none"/>`;
      },
      /** 안개 김: [[x,y,r], ...] */
      mist(pts, col = MISTC, op = 0.75) {
        return `<g fill="${col}" stroke="none" opacity="${op}">${pts.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('')}</g>`;
      },
      /** 구름·안개 덩어리: 원들을 하나의 외곽선으로 합침 [[x,y,r], ...] */
      cloud(pts, fill, op) {
        const cs = pts.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('');
        return `<g${op != null ? ` opacity="${op}"` : ''}><g fill="${OL}" stroke-width="${ow * 2}">${cs}</g><g fill="${fill}" stroke="none">${cs}</g></g>`;
      },
      /** 왼쪽 위 반짝임 */
      shine(cx, cy, rx, ry, op = 0.45, rot = -25) {
        return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#fff" stroke="none" opacity="${op}" transform="rotate(${rot} ${cx} ${cy})"/>`;
      },
      out(body) {
        return H.svg('0 0 100 100', defs.join(''),
          `<g stroke="${OL}" stroke-width="${ow}" stroke-linejoin="round" stroke-linecap="round">${body}</g>`);
      },
    };
    return c;
  }

  const g = (body, t = '') => (t ? `<g transform="${t}">${body}</g>` : body);
  /** 지그재그 번개 경로 */
  const zig = (pts) => `M${pts.map((p) => p.join(' ')).join('L')}`;

  /* =========================================================
   * 1지역 · 솔빛 들판
   * ========================================================= */
  const D = {};

  D.mist_rat = (f) => {
    const c = make(3.5);
    const s = f ? -1 : 1;
    const legC = sh(GREY, -0.25);
    const tail = f ? 'M24 74C12 74 6 64 10 54C13 46 10 40 5 37' : 'M24 74C10 76 4 66 8 56C11 48 9 42 4 40';
    const tip = f ? [[8, 35, 5], [14, 29, 4], [6, 26, 3.5], [18, 22, 2.5]] : [[7, 38, 5], [12, 31, 4], [6, 28, 3.5], [16, 25, 2.5]];
    return c.out(
      c.limb(tail, 4.5, sh(GREY, -0.1)) +
      c.mist(tip, MISTC, 0.85) +
      c.leg(38, 76, -3 * s, 6, legC) + c.leg(68, 76, 3 * s, 6, legC) +
      g(
        c.P('M22 80C17 62 33 46 54 47C66 48 74 53 80 59C86 63 91 68 95 74C92 79 85 82 77 83C60 87 34 88 22 80Z', c.body(GREY)) +
        c.En(54, 79, 20, 5, GREY_L, 0.55) +
        c.E(68, 50, 10, 10, c.body(GREY)) + c.En(68.5, 51, 5.5, 6, '#c9a6b4') +
        c.eye(80, 63, 3.6) +
        c.E(94, 73.5, 3, 2.6, '#d99fb2') +
        c.shine(40, 56, 9, 4),
        f ? 'translate(0 -1)' : ''
      ) +
      c.leg(44, 78, 3 * s, 6, GREY) + c.leg(74, 78, -3 * s, 6, GREY)
    );
  };

  D.ash_boar = (f) => {
    const c = make(3);
    const s = f ? -1 : 1;
    const legF = sh('#857b78', -0.3);
    const legN = '#857b78';
    const hoof = (x) => '';
    void hoof;
    const mane = f
      ? 'M20 48C19 42 22 38 26 36L23 27L32 33L33 22L41 31L46 20L50 30L57 22L59 31L67 26L66 35L73 35L71 43Z'
      : 'M20 48C19 42 22 38 26 36L21 28L31 32L31 23L40 30L44 21L49 29L56 21L58 30L66 24L66 34L74 33L71 43Z';
    return c.out(
      c.leg(30, 70, -4 * s, 9, legF) + c.leg(62, 70, 4 * s, 9, legF) +
      g(
        c.limb('M17 56C10 55 9 48 14 47', 3, '#857b78') +
        c.E(44, 58, 30, 22, c.body('#8b817d')) +
        c.En(46, 74, 22, 5, sh('#8b817d', 0.3), 0.5) +
        c.mist(f ? [[22, 24, 3], [36, 17, 2.5], [54, 16, 2.5], [68, 21, 2]] : [[20, 25, 2.5], [38, 15, 3], [56, 17, 2], [70, 19, 2.5]], MISTC, 0.7) +
        c.P(mane, c.lin([[0, '#f4f2fb'], [1, '#a9a3c0']])) +
        c.P('M60 46C70 41 80 46 84 54L92 61C96 64 96 72 92 75L80 77C69 79 61 72 59 63Z', c.body('#8b817d', 0.3)) +
        c.P('M64 46L61 33L73 42Z', sh('#8b817d', -0.15)) +
        c.E(93, 68, 3.5, 5.5, '#b9a2a2') +
        c.En(93.5, 66, 1, 1.4, OL) + c.En(93.5, 70.5, 1, 1.4, OL) +
        c.P('M80 74L90 71L94 57L87 62L79 66Z', c.lin([[0, '#e4e0d6'], [1, '#9c978c']], 'h')) +
        c.L('M88 64L84 69', '#7d7870', 1.5) +
        c.eye(76, 55, 3.2) +
        c.shine(32, 50, 10, 5, 0.3),
        f ? 'translate(0 -1)' : ''
      ) +
      c.leg(36, 72, 4 * s, 9, legN) + c.foot(36 + 4 * s, 5, 2.5, '#3d3540') +
      c.leg(68, 72, -4 * s, 9, legN) + c.foot(68 - 4 * s, 5, 2.5, '#3d3540')
    );
  };

  D.mist_crow = (f) => {
    const c = make(3.5);
    const crow = '#4c4858';
    const wing = 'M0 0C-10-11-26-15-42-12L-35-6L-44-1L-35 3L-42 8L-31 9L-33 14L-20 11C-11 10-4 6 0 0Z';
    const puffs = c.mist([[-44, -6, 4.5], [-47, 2, 4], [-42, 9, 3.5], [-52, -1, 2.5]], MISTC, 0.8);
    const wingG = (a, col, sc = 1) => `<g transform="translate(50 50) rotate(${a}) scale(${sc})">${c.P(wing, col)}${puffs}</g>`;
    const bob = f ? 3 : -1;
    return c.out(
      g(
        wingG(f ? -12 : 82, sh(crow, -0.3), 0.8) +
        c.P('M30 60L7 51L11 61L7 72L32 67Z', sh(crow, -0.1)) +
        c.P('M21 61C27 47 45 42 60 44C72 45 79 49 83 54C78 62 66 66 54 66C42 68 28 67 21 61Z', c.body(crow, 0.35)) +
        c.E(74, 46, 13, 12, c.body(crow, 0.35)) +
        c.P('M84 41L97 48L84 53Z', c.lin([[0, '#d6ceb0'], [1, '#8f8770']])) +
        c.eye(78, 44, 3.8) +
        wingG(f ? -40 : 50, c.body(sh(crow, 0.12), 0.35)),
        `translate(0 ${bob})`
      )
    );
  };

  D.straw_husk = (f) => {
    const c = make(3);
    const s = f ? -1 : 1;
    const straw = '#d8bc6a';
    const tuft = (x, y, dir) => c.L(`M${x} ${y}l${7 * dir} -5M${x} ${y}l${8 * dir} 0M${x} ${y}l${7 * dir} 5`, straw, 3);
    const rot = f ? 3 : -3;
    return c.out(
      c.leg(46, 70, -5 * s, 7, sh(straw, -0.25), 0, 0) +
      c.leg(56, 70, 5 * s, 7, straw, 0, 0) +
      c.L(`M${56 + 5 * s} 85l-4 4M${56 + 5 * s} 85l4 4M${46 - 5 * s} 85l-4 4`, sh(straw, -0.2), 2.5) +
      g(
        c.L('M18 38L86 44', OL, 9) + c.L('M18 38L86 44', '#8a6a48', 4.5) +
        tuft(18, 38, -1) + tuft(86, 44, 1) +
        c.P('M28 34L42 32L44 50L30 48Z', '#7f8b70') +
        c.P('M60 35L76 38L74 54L60 52Z', '#7f8b70') +
        c.P('M38 34C44 30 60 30 66 35L68 58L71 72L64 68L58 74L52 68L45 74L40 67L34 71L37 58Z', c.body('#88957a', 0.3)) +
        c.L('M40 46l6 2M60 60l5-2', sh('#88957a', -0.35), 1.6) +
        c.E(53, 52, 7.5, 8, '#2b2236') +
        c.L('M53 52m-3 0a3 3 0 1 1 3 3a5 5 0 0 1-5-5', MISTC, 1.8) +
        c.mist([[50, 47, 2], [57, 46, 1.6]], MISTC, 0.7),
        `rotate(${rot} 52 50)`
      ) +
      g(
        c.P('M41 28C40 16 46 11 53 11C61 11 66 17 65 28C64 34 58 37 53 37C47 37 42 34 41 28Z', c.body('#b9a682', 0.3)) +
        c.L('M48 13l3 3m6-3l-2 4', sh(straw, -0.1), 2) +
        c.eye(53, 23, 2.8) + c.eye(61, 23, 2.6) +
        c.L('M51 31l2 2l2-2l2 2l2-2l2 2', OL, 1.6) +
        c.E(52, 13, 21, 4.5, c.body('#857560', 0.2)) +
        c.P('M41 13C43 7 48 3 57 2C56 6 59 9 63 13Z', c.body('#857560', 0.3)) +
        c.L('M43 11L62 11', '#a3463a', 2.2),
        f ? 'translate(0 -1) rotate(-2 53 30)' : 'rotate(2 53 30)'
      )
    );
  };

  D.vine_leech = (f) => {
    const c = make(3);
    const base = '#6f7b68';
    const segs = [];
    const N = 8;
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1);
      const x = 14 + t * 66;
      const r = 8 + Math.sin(t * Math.PI * 0.85) * 7;
      const hump = Math.max(0, Math.cos((t - (f ? 0.55 : 0.38)) * Math.PI * 2.4)) * 14;
      segs.push([H.n(x), H.n(90 - 1.5 - r - hump), H.n(r)]);
    }
    let body = '';
    const grad = c.body(base, 0.35);
    segs.forEach(([x, y, r]) => { body += c.E(x, y, r * 1.05, r, grad); });
    const vein = `M${segs.map(([x, y, r]) => `${x} ${H.n(y - r * 0.35)}`).join('L')}`;
    const [hx, hy, hr] = segs[N - 1];
    const leaf = (x, y, a) => g(c.P('M0 0C2-8 8-12 14-12C12-6 8-1 0 0Z', c.body('#7fae4f', 0.3)), `translate(${x} ${y}) rotate(${a})`);
    return c.out(
      body +
      c.L(vein, GREEN, 5, ` opacity=".35" ${c.soft()}`) +
      c.L(vein, sh(GREEN, 0.25), 2) +
      leaf(segs[3][0], segs[3][1] - segs[3][2] + 2, -20) +
      leaf(segs[5][0], segs[5][1] - segs[5][2] + 2, 10) +
      c.E(hx + hr * 0.8, hy + 2, 4.5, 6, '#4a3a4e') + c.En(hx + hr * 0.9, hy + 2, 2, 3.4, '#d6b6c4') +
      c.eye(hx + 1, hy - hr * 0.45, 2.6) + c.eye(hx + 6, hy - hr * 0.3, 2.3) +
      c.shine(segs[2][0] - 2, segs[2][1] - segs[2][2] * 0.5, 4, 2, 0.35)
    );
  };

  D.spore_sac = (f) => {
    const c = make(3);
    const s = f ? -1 : 1;
    const cap = '#86739a';
    const sac = '#b3a8ba';
    const spot = '#e4dcec';
    return c.out(
      c.leg(40, 74, -3 * s, 8, sh(sac, -0.4)) + c.leg(60, 74, 3 * s, 8, sh(sac, -0.2)) +
      g(
        c.P('M50 28C72 28 85 42 83 59C81 74 68 82 50 82C32 82 19 74 17 59C15 42 28 28 50 28Z', c.body(sac)) +
        c.En(30, 62, 4, 3, sh(sac, -0.18)) + c.En(42, 73, 3.5, 2.4, sh(sac, -0.18)) + c.En(24, 50, 2.6, 2, sh(sac, -0.18)) +
        c.P('M20 40C20 22 34 11 50 11C66 11 80 22 80 40C74 44 68 38 62 42C56 38 46 43 40 39C34 43 26 38 20 40Z', c.body(cap)) +
        c.En(34, 24, 5, 3.6, spot) + c.En(52, 18, 4, 3, spot) + c.En(66, 28, 4, 3, spot) + c.En(28, 35, 2.6, 2, spot) + c.En(48, 32, 2.6, 2, spot) +
        c.mist(f ? [[47, 6, 3.6], [56, 3, 2.6], [40, 4, 2]] : [[53, 6, 3.6], [44, 3, 2.6], [60, 4, 2]], '#d4e89a', 0.9) +
        c.spark(f ? 60 : 38, 8, 1.3, '#c8e07a') +
        c.eye(63, 54, 3.8) + c.eye(75, 53, 3.3) +
        c.L('M64 65q6 4 11-1', OL, 2.2) +
        c.shine(30, 44, 7, 3, 0.35),
        `rotate(${4 * s} 50 86)`
      )
    );
  };

  D.sporeling = (f) => {
    const c = make(3.5);
    const cap = '#86739a';
    const spot = '#e4dcec';
    const y = f ? 5 : 0;
    return c.out(
      c.leg(40, 76, f ? -7 : -3, 8, '#8c8296') + c.leg(60, 76, f ? 7 : 3, 8, '#b0a7b8') +
      g(
        c.P('M32 48C30 64 32 79 50 80C68 79 70 64 68 48Z', c.body('#bdb5c4', 0.3)) +
        c.eye(55, 61, 4.2) + c.eye(67, 60, 3.6) +
        c.P(f ? 'M7 50C7 26 28 14 50 14C72 14 93 26 93 50C80 57 20 57 7 50Z' : 'M11 50C11 24 30 9 50 9C70 9 89 24 89 50C76 57 24 57 11 50Z', c.body(cap)) +
        c.En(34, 30, 6.5, 5, spot) + c.En(58, 22, 5, 4, spot) + c.En(74, 38, 4.5, 3.5, spot) + c.En(22, 44, 3, 2.4, spot) +
        c.shine(28, 24, 7, 3.5, 0.4),
        `translate(0 ${y})`
      )
    );
  };

  D.rust_knight = (f) => {
    const c = make(3);
    const s = f ? -1 : 1;
    const rust = '#8c766a';
    const rustD = sh(rust, -0.35);
    const orange = '#c0683c';
    const plate = c.body(rust, 0.35);
    const sword =
      c.P('M-3.5 5L3.5 5L3.5 24L1.5 29L-0.5 26L-3.5 28Z', c.lin([[0, '#d2ccc8'], [1, '#7a706c']], 'h')) +
      c.En(1, 14, 1.6, 2, orange, 0.9) +
      c.P('M-9 2L9 2L9 6L-9 6Z', rustD) + c.P('M-2-6L2-6L2 2L-2 2Z', '#5a4232');
    return c.out(
      c.leg(44, 66, -6 * s, 9, rustD) + c.foot(44 - 6 * s + 2, 6, 3, sh(rustD, -0.2)) +
      g(
        c.mist(f ? [[44, 9, 3.5], [36, 6, 3], [28, 7, 2.4], [21, 4, 1.8]] : [[44, 9, 3.5], [37, 8, 3], [30, 4, 2.4], [23, 6, 1.8]], MISTC, 0.8) +
        c.limb('M42 40L32 54L36 64', 7, rustD) +
        c.mist([[42, 66, 4], [56, 67, 3.5], [36, 62, 2.5]], MISTC, 0.7) +
        c.P('M36 36C42 32 62 32 68 37L66 62C60 66 44 66 38 62Z', plate) +
        c.L('M52 36L52 63', sh(rust, -0.45), 1.8) +
        c.En(44, 46, 3.4, 2.6, orange, 0.85) + c.En(60, 56, 2.6, 2, orange, 0.85) + c.En(40, 56, 1.8, 1.4, orange, 0.85) +
        c.P('M37 60L67 60L69 70L35 70Z', c.body(sh(rust, -0.08), 0.3)) +
        c.L('M43 61L42 70M52 61V70M61 61L62 70', sh(rust, -0.45), 1.6) +
        c.mist([[52, 32, 4], [46, 31, 3], [58, 30, 2.6]], MISTC, 0.75) +
        c.P('M40 12C46 7 62 7 68 13L68 32C62 36 46 36 40 32Z', c.body(rust, 0.4)) +
        c.P('M54 20L70 20L70 25L54 25Z', '#241b2c') +
        c.eye(63, 22.5, 2.2, false) + c.eye(57.5, 22.5, 1.8, false) +
        c.L('M46 13L46 31', sh(rust, -0.4), 1.6) +
        c.En(62, 29, 2.4, 1.6, orange, 0.85) +
        c.shine(46, 17, 3, 5, 0.4, 0),
        f ? 'translate(0 -1)' : ''
      ) +
      c.leg(58, 66, 6 * s, 9, rust) + c.foot(58 + 6 * s + 2, 6, 3, rustD) +
      g(
        g(sword, `translate(78 51) rotate(${f ? -38 : -26})`) +
        c.P('M58 34C65 30 74 33 74 40L71 45L59 43Z', c.body(sh(rust, 0.05), 0.4)) +
        c.limb('M68 41L73 50L78 51', 7, rust) +
        c.E(78, 51, 4, 4, rustD),
        f ? 'translate(0 -1)' : ''
      )
    );
  };

  D.hollow_elder = (f) => {
    const c = make(3);
    const bark = '#7b6b60';
    const barkD = sh(bark, -0.35);
    const leaf = '#7c9168';
    const s = f ? 1 : -1;
    const root = (x, y, dx, w, col, lift) => c.limb(`M${x} ${y}Q${x + dx * 0.4} ${y + 10} ${x + dx} ${H.n(90 - w / 2 - 3 - lift)}`, w, col);
    const clump = (x, y, r, col) => c.E(x, y, r, r * 0.8, col);
    const leafG = c.body(leaf, 0.3);
    const moss = '#93b062';
    return c.out(
      root(36, 72, -20 + 3 * s, 8, barkD, f ? 2 : 0) + root(62, 72, 20 + 3 * s, 8, barkD, f ? 0 : 2) +
      g(
        c.limb('M30 46C20 42 14 36 12 26M18 38L8 36', 7, barkD) +
        c.limb(f ? 'M68 44C80 44 86 38 90 30M84 40L94 42' : 'M68 44C80 46 88 42 92 34M86 44L95 48', 7, bark) +
        c.L(f ? 'M86 40l1 8M90 33l2 7' : 'M88 44l0 8M92 38l2 7', moss, 2.5) + c.L('M16 34l-1 8M12 28l-2 6', moss, 2.5) +
        c.limb('M40 22L32 6M34 12L26 10M60 20L70 4M66 10L74 12', 3.5, barkD) +
        clump(25, 25, 14, sh(leaf, -0.28)) + clump(75, 23, 14, sh(leaf, -0.28)) +
        clump(50, 18, 17, leafG) + clump(33, 15, 11, leafG) + clump(68, 13, 11, leafG) +
        c.En(44, 11, 6, 3, '#c9dca8', 0.55) + c.En(64, 8, 4, 2, '#c9dca8', 0.5) + c.En(24, 20, 4, 2, '#c9dca8', 0.4) +
        c.L('M38 22q3 2 6 0M54 26q3 2 6 0M28 30q3 2 6 0M66 22q3 2 6 0M46 16q3 2 6 0M74 30q3 2 6 0', sh(leaf, -0.35), 1.6) +
        c.P('M30 30C36 26 64 26 70 30C72 46 72 62 76 76L66 82L56 78L48 82L38 78L26 80C30 64 30 46 30 30Z', c.body(bark, 0.3, -0.4)) +
        c.L('M36 34C34 50 36 64 34 76M44 30C42 40 43 46 42 50M66 34C67 46 66 56 70 74M60 76C60 72 62 70 64 70', barkD, 2) +
        c.Pn('M30 32C36 28 50 27 56 28C46 32 40 40 38 52C36 40 34 34 30 32Z', '#ffffff', 0.12) +
        c.P('M40 50C40 40 50 38 56 40C64 42 66 52 64 64C62 72 56 76 50 75C42 74 39 62 40 50Z', c.rad([[0, '#d9d6e6'], [0.35, '#6e6880'], [1, '#1e1828']], 0.52, 0.55, 0.55)) +
        g(c.L('M0 0m-2 0a2 2 0 1 1 4 0a4 4 0 0 1-8 0a6 6 0 0 1 12 0a8.5 8.5 0 0 1-17 0', MISTC, 2.2, ' opacity=".85"'), `translate(52 58) rotate(${f ? 40 : 0})`) +
        c.P('M42 38L50 31L55 37Q49 40 42 38Z', '#2b2236') + c.P('M57 37L64 31L70 38Q63 40 57 37Z', '#2b2236') +
        c.eye(50, 35.5, 3, false) + c.eye(64, 35.5, 3, false) +
        c.En(29, 56, 6, 3, moss, 0.95) + c.En(71, 64, 5, 2.5, moss, 0.95) + c.En(34, 30, 7, 2.6, moss, 0.9) +
        c.P('M70 50C76 47 81 49 81 54L70 55Z', '#b7a58c') + c.P('M72 57C76 55 79 57 79 60L72 60Z', '#b7a58c') +
        c.mist([[46, 74, 3], [58, 76, 2.5], [52, 80, 2]], MISTC, 0.6),
        f ? 'translate(0 -1)' : ''
      ) +
      g(c.P('M0 0C2-4 6-5 9-4C7 0 4 2 0 0Z', '#b4c88a'), f ? 'translate(84 62) rotate(30)' : 'translate(86 56) rotate(-10)') +
      root(44, 76, -8 - 3 * s, 9, bark, f ? 0 : 1.5) + root(56, 76, 8 - 3 * s, 9, bark, f ? 1.5 : 0) +
      c.P('M28 78C28 74 34 74 34 78Z', '#d8c8b0') + c.L('M31 78V81', '#d8c8b0', 2) +
      c.P('M66 80C66 77 71 77 71 80Z', '#c9a88a') + c.L('M68.5 80V82', '#c9a88a', 2)
    );
  };

  D.frost_wolf = (f) => {
    const c = make(3);
    const fur = '#d2d7e1';
    const furD = sh(fur, -0.32);
    const L = f ? [5, 1, -4, -8] : [-11, -6, 8, 13];
    let spikes = '';
    const spk = c.lin([[0, '#ffffff'], [1, '#7fdcff']]);
    for (let i = 0; i < 5; i++) {
      const x = 27 + i * 9;
      const y = 44 - Math.sin((i / 4) * Math.PI) * 3;
      spikes += c.P(`M${x - 5} ${y + 4}L${x - 8} ${y - 11}L${x + 5} ${y + 2}Z`, spk);
    }
    return c.out(
      c.leg(28, 62, L[0], 6.5, furD, 0, -4) + c.leg(64, 62, L[2], 6.5, furD, 0, 3) +
      g(
        spikes +
        c.P('M20 52C10 48 4 38 6 26C11 31 17 36 25 44Z', c.body(fur, 0.3)) +
        c.P('M6 26L2 18L10 24ZM9 31L4 26L12 29Z', ICE) +
        c.P('M16 56C16 45 27 40 40 41C52 42 58 38 67 40C76 42 80 50 78 58C76 66 68 70 58 69L34 69C24 69 16 64 16 56Z', c.body(fur, 0.35, -0.3)) +
        c.P('M68 56L74 66L70 64L68 70L64 62Z', '#eef1f6') +
        c.P('M66 38L64 25L72 34Z', furD) +
        c.P('M63 46C64 36 71 31 78 31C84 32 88 37 90 41L97 47C98 51 95 54 90 54L80 56C72 58 65 54 63 46Z', c.body(fur, 0.35, -0.3)) +
        c.P('M71 36L73 22L80 33Z', fur) + c.Pn('M73 32L74 26L77 31Z', ICE, 0.8) +
        c.E(96.5, 48, 2, 1.8, OL) + c.L('M88 53L94 52', OL, 1.6) +
        c.En(77, 42, 5, 3.5, '#9aa3b4', 0.6) +
        c.eye(80, 41, 3) +
        c.mist(f ? [[93, 59, 3], [88, 63, 2.5], [97, 63, 2]] : [[95, 58, 3.4], [90, 62, 2.5], [84, 64, 2]], ICE_L, 0.85) +
        c.shine(34, 48, 9, 3.5, 0.5),
        f ? 'translate(0 -2)' : ''
      ) +
      c.leg(32, 63, L[1], 7, fur, 0, -4) + c.leg(68, 63, L[3], 7, fur, 0, 3)
    );
  };

  D.snow_wisp = (f) => {
    const c = make(3.5);
    const wing = 'M0 0C-4-12-14-22-26-22C-24-12-14-3 0 0Z';
    const wingFill = c.lin([[0, '#ffffff', 0.95], [1, ICE, 0.55]]);
    const wings = (a, sc) => g(c.P(wing, wingFill), `translate(46 47) rotate(${a}) scale(${sc})`);
    const rot = f ? 12 : 0;
    let arms = '';
    for (let k = 0; k < 6; k++) {
      const a = ((k * 60 - 90 + rot) * Math.PI) / 180;
      const p = (r, da = 0) => `${H.n(50 + Math.cos(a + da) * r)} ${H.n(52 + Math.sin(a + da) * r)}`;
      arms += `M50 52L${p(32)}M${p(20)}L${p(29, 0.45)}M${p(20)}L${p(29, -0.45)}`;
    }
    const bob = f ? 2 : -1;
    return c.out(
      g(
        `<circle cx="50" cy="52" r="30" fill="${ICE}" opacity=".45" stroke="none" ${c.soft()}/>` +
        wings(f ? -52 : -14, 1.15) + wings(f ? -20 : 18, 1.3) +
        c.limb(arms, 5.5, '#dff7ff') +
        c.L(arms, ICE, 2) +
        c.E(50, 52, 15, 15, c.body('#bfefff', 0.6, -0.2)) +
        c.eye(54, 50, 3.6) + c.eye(63, 50, 3.2) +
        c.shine(44, 45, 5, 3, 0.7),
        `translate(0 ${bob})`
      )
    );
  };

  D.ice_tortoise = (f) => {
    const c = make(3);
    const skin = '#8b92a0';
    const skinD = sh(skin, -0.3);
    const s = f ? -1 : 1;
    const ice = c.lin([[0, '#f4fdff'], [0.45, '#9fe6ff'], [1, '#3aa6d4']]);
    return c.out(
      c.leg(30, 72, -2 * s, 12, skinD) + c.leg(64, 72, 2 * s, 12, skinD) +
      g(
        c.P('M20 72L9 76L20 79Z', skin) +
        c.P('M15 66L20 48L28 42L32 25L42 31L50 9L58 25L67 21L72 38L80 45L85 66Z', ice) +
        c.Pn('M20 48L28 42L32 25L42 31L50 9L46 40L38 44L30 52Z', '#ffffff', 0.45) +
        c.L('M50 9L46 40L32 25M46 40L67 21M46 40L72 38M46 40L38 44L28 42M38 44L30 60M46 40L58 56', '#ffffff', 1.8, ' opacity=".8"') +
        c.L('M58 56L72 38M58 56L80 45', '#2a86b4', 1.4, ' opacity=".6"') +
        c.P('M11 70C13 60 87 60 89 70C82 79 18 79 11 70Z', c.body('#7d8696', 0.3)) +
        c.L('M24 64L22 76M38 63L37 77M52 63V77M66 63L67 77M78 64L80 76', sh('#7d8696', -0.4), 1.6) +
        c.P(f ? 'M78 66C80 58 88 56 93 60C97 64 96 71 92 73C87 76 80 74 78 70Z' : 'M76 67C78 59 86 57 91 61C95 65 94 72 90 74C85 77 78 75 76 71Z', c.body(skin, 0.35)) +
        c.eye(f ? 87 : 85, f ? 63 : 64, 3) + c.L(f ? 'M87 70L94 69' : 'M85 71L92 70', OL, 1.6) +
        c.shine(36, 34, 4, 9, 0.6, 20),
        f ? 'translate(0 -1)' : ''
      ) +
      c.leg(38, 74, 2 * s, 12, skin) + c.leg(72, 74, -2 * s, 12, skin)
    );
  };

  D.avalanche_golem = (f) => {
    const c = make(3);
    const rock = '#7f8797';
    const rockD = sh(rock, -0.3);
    const snow = c.lin([[0, '#ffffff'], [1, '#bfe6f5']]);
    const s = f ? -1 : 1;
    const dots = f ? [[86, 60, 1.6], [16, 64, 1.4], [74, 82, 1.4], [28, 80, 1.6], [90, 74, 1.2]] : [[84, 52, 1.4], [18, 56, 1.6], [78, 76, 1.6], [26, 72, 1.4], [92, 66, 1.2]];
    return c.out(
      c.limb(`M32 40Q22 52 ${22 - 3 * s} 66`, 11, rockD) + c.E(21 - 3 * s, 70, 9, 8, rockD) +
      c.leg(40, 70, -4 * s, 13, rockD) +
      g(
        c.P('M22 44C20 26 36 16 54 17C72 18 82 30 80 46C78 62 68 72 52 73C36 73 24 62 22 44Z', c.body(rock, 0.35)) +
        c.L('M34 50L40 56L38 64M62 52L70 60M48 40L54 46', rockD, 2) +
        c.P('M22 38C23 23 39 15 54 16C69 17 80 26 81 40C75 35 70 40 64 35C58 40 52 33 46 38C40 33 33 40 22 38Z', snow) +
        c.Pn('M30 38C30 42 34 44 34 40ZM58 38C58 44 62 44 62 39Z', '#ffffff', 0.9) +
        c.P('M58 25C58 16 66 12 74 13C82 15 85 24 81 31C77 36 65 36 60 31Z', c.body(rock, 0.3)) +
        c.P('M57 22C59 14 67 10 75 12C80 14 84 19 84 24C79 21 75 25 71 22C67 25 62 21 57 22Z', snow) +
        c.P('M65 25L82 24L81 30L65 30Z', '#241b2c') +
        c.eye(71, 27.5, 2.2, false) + c.eye(78, 27, 2, false) +
        c.mist(dots, '#ffffff', 0.9),
        f ? 'translate(0 -1)' : ''
      ) +
      c.leg(60, 70, 4 * s, 13, rock) +
      c.limb(`M72 40Q86 50 ${82 + 4 * s} 64`, 12, rock) + c.E(83 + 4 * s, 70, 10, 9, c.body(rock, 0.3)) +
      c.P(`M${75 + 4 * s} 64C${78 + 4 * s} 59 ${88 + 4 * s} 59 ${91 + 4 * s} 64C${86 + 4 * s} 63 ${80 + 4 * s} 66 ${75 + 4 * s} 64Z`, snow)
    );
  };

  D.snowball_golem = (f) => {
    const c = make(3.5);
    const stone = '#7d8594';
    const rock = (x, y, sc, col) => g(c.P('M-9-3L-4-9L5-8L10-1L7 7L-3 9L-9 4Z', c.body(col, 0.3)), `translate(${x} ${y}) scale(${sc})`);
    const r = f ? 25 : 0;
    const a = f ? 6 : -6;
    return c.out(
      c.limb(`M30 60L16 ${60 + a}`, 7, sh(stone, -0.3)) + rock(13, 60 + a, 1.05, sh(stone, -0.25)) +
      c.E(48, 59, 30, 29, c.body('#eef6fb', 0.3, -0.28)) +
      g(c.L('M30 44C34 40 40 38 46 38M24 64C28 72 36 78 46 80M60 78C66 76 72 70 74 64', '#9fd3ea', 2.4) +
        c.E(30, 56, 2.5, 2, stone) + c.E(44, 76, 2, 1.6, stone), `rotate(${r} 48 59)`) +
      c.E(57, 51, 4.6, 5.4, '#2b2236') + c.E(70, 50, 4.2, 5, '#2b2236') +
      c.eye(57.5, 51, 2.4, false) + c.eye(70.5, 50, 2.2, false) +
      c.L('M58 64Q64 68 70 63', '#2b2236', 2.4) +
      c.shine(34, 42, 8, 4, 0.7) +
      c.limb(`M72 70L84 ${72 - a}`, 7, stone) + rock(87, 72 - a, 1.2, stone) +
      c.mist(f ? [[20, 86, 3], [12, 84, 2]] : [[22, 86, 2.5], [14, 82, 2]], '#ffffff', 0.85)
    );
  };

  D.yeti_shaman = (f) => {
    const c = make(3);
    const fur = '#d8dbe4';
    const furD = sh(fur, -0.3);
    const face = '#62607a';
    const s = f ? -1 : 1;
    const flame = f ? 'M84 4C89 9 92 13 90 18C88 22 80 22 78 18C76 13 81 10 84 4Z' : 'M83 3C88 7 93 12 91 18C89 22 81 22 79 18C77 13 79 8 83 3Z';
    return c.out(
      c.foot(36 - 3 * s, 10, 4.5, furD) +
      g(
        c.limb(`M30 46Q20 58 ${22 - 2 * s} 70`, 10, furD) + c.E(22 - 2 * s, 72, 6, 6, furD) +
        c.P('M27 86C21 84 19 77 23 71C17 67 17 59 23 55C19 49 23 41 31 41C35 35 44 32 52 32L62 32C72 34 78 42 76 50C82 54 82 62 76 66C80 72 78 80 72 82C70 87 64 88 58 86L40 86C34 88 30 88 27 86Z', c.body(fur, 0.3, -0.32)) +
        c.L('M30 62q-3 4-1 8M40 74q-2 4 0 8M62 72q2 4 0 8M66 58q3 3 2 7', furD, 2) +
        c.P('M26 47C34 39 56 37 73 43L72 51L68 56L64 51L60 57L56 51L52 57L48 51L44 57L40 51L36 56L32 51L27 54Z', c.body('#55688a', 0.3)) +
        c.E(42, 46, 2.2, 2.8, '#e8e0cc') + c.E(52, 46, 2.2, 2.8, ICE) + c.E(62, 46, 2.2, 2.8, '#e8e0cc') +
        c.P('M50 22C46 14 48 7 54 4C52 9 54 15 57 20Z', '#e8e0cc') +
        c.P('M44 34C40 20 48 10 60 10C72 10 79 20 77 32C75 40 66 44 58 44C50 44 46 40 44 34Z', c.body(fur, 0.35, -0.3)) +
        c.L('M50 14l-3 5M56 11l-1 5M46 24l-3 3', furD, 2) +
        c.P('M60 22C66 18 76 20 79 26C81 33 77 40 70 41C64 41 60 37 59 31Z', c.body(face, 0.3)) +
        c.P('M60 23C66 19 75 21 79 26L60 27Z', sh(face, -0.3)) +
        c.eye(66, 28, 2.7) + c.eye(74, 28, 2.4) +
        c.P('M66 36L67.5 39L69 36ZM72 36L73 39L74.5 36Z', '#ffffff') +
        c.P('M64 14C67 7 74 4 80 7C75 8 72 11 70 16Z', '#e8e0cc'),
        f ? 'translate(0 -1)' : ''
      ) +
      c.foot(58 + 3 * s, 10, 4.5, fur) +
      g(
        c.limb('M79 87L84 22', 4.5, '#e3dccb') +
        c.E(81.5, 62, 3.5, 2.5, '#e3dccb') +
        c.E(84, 24, 6, 5, c.body('#e8e0cc', 0.3)) + c.En(82, 24, 1.3, 1.6, OL) + c.En(86.5, 24, 1.3, 1.6, OL) +
        `<path d="${flame}" fill="${ICE}" stroke="none" opacity=".7" ${c.soft()}/>` +
        c.P(flame, c.lin([[0, '#ffffff'], [0.5, ICE], [1, '#2a86b4']])) +
        c.limb('M66 48Q74 54 81 52', 10, fur) + c.E(82, 52, 6, 6, c.body(fur, 0.3)),
        f ? 'translate(0 -1)' : ''
      )
    );
  };

  D.rime_wraith = (f) => {
    const c = make(3);
    const cloth = c.lin([[0, '#f4fdff', 0.95], [0.5, '#a9e4f7', 0.8], [1, '#5fb8dc', 0.55]]);
    const hem = f ? 'L22 84L31 79L37 88L46 80L54 89L62 80L70 87L75 78L83 82' : 'L24 86L32 80L39 87L47 81L55 88L62 81L69 88L75 79L81 85';
    return c.out(
      g(
        c.mist(f ? [[30, 88, 3], [64, 89, 2.5]] : [[40, 89, 2.5], [74, 88, 3]], ICE_L, 0.7) +
        c.P(`M38 26C32 40 30 56 26 72${hem}L76 68C72 56 70 44 68 36Z`, cloth) +
        c.L('M40 50l6 4l-2 6M56 66l4-5l6 2M36 70l4 3', '#ffffff', 1.6, ' opacity=".8"') +
        c.P('M48 9C62 9 72 19 73 33C73 39 70 44 66 46L44 46C36 40 34 30 36 22C38 14 42 9 48 9Z', cloth) +
        c.E(61, 31, 9, 10, c.rad([[0, '#3a3450'], [1, '#141020']], 0.6, 0.5, 0.6)) +
        c.eye(59, 30, 2.6, false) + c.eye(66, 30, 2.3, false) +
        c.P(f ? 'M60 48C68 48 76 50 84 54L80 62C74 60 66 60 60 58Z' : 'M60 48C68 50 76 54 82 60L76 66C72 62 66 60 60 58Z', cloth) +
        c.L(f ? 'M83 56l7-2M82 59l7 1M81 61l5 4' : 'M81 62l7 0M79 64l6 3M77 66l3 5', '#e6f8ff', 2.5) +
        c.shine(46, 18, 4, 7, 0.6, 20),
        `rotate(${f ? 2 : -2} 50 90)`
      )
    );
  };

  D.ice_shieldbearer = (f) => {
    const c = make(3);
    const armor = '#8a90a2';
    const armorD = sh(armor, -0.32);
    const s = f ? -1 : 1;
    const ice = c.lin([[0, '#f4fdff', 0.95], [0.5, '#8fdcff', 0.88], [1, '#2a8cc0', 0.88]], 'd');
    return c.out(
      c.leg(42, 66, -6 * s, 9, armorD) + c.foot(42 - 6 * s + 2, 6, 3, sh(armorD, -0.2)) +
      g(
        c.limb('M24 88L30 12', 4, '#8a6a48') + c.P('M27 14L31 2L35 15Z', c.lin([[0, '#ffffff'], [1, ICE]])) +
        c.limb('M34 42L28 54', 7, armorD) +
        c.P('M32 38C36 32 54 32 58 36L58 64L32 64Z', c.body(armor, 0.35)) +
        c.P('M32 60L58 60L60 70L30 70Z', sh(armor, -0.12)) +
        c.mist([[34, 35, 4], [40, 33, 4], [47, 33, 4], [54, 34, 4]], '#eef2f8', 1) +
        c.P('M32 22C32 12 40 7 46 7C54 7 60 13 60 22L60 32L32 32Z', c.body(armor, 0.4)) +
        c.P('M46 2L50 8L42 8Z', ICE) +
        c.P('M44 19L60 19L60 25L44 25Z', '#241b2c') +
        c.eye(50, 22, 2, false) + c.eye(56, 22, 1.8, false),
        f ? 'translate(0 -1)' : ''
      ) +
      c.leg(52, 66, 6 * s, 9, armor) + c.foot(52 + 6 * s + 2, 6, 3, armorD) +
      g(
        c.P('M60 27L80 22L90 34L89 62L75 85L60 77L56 42Z', ice) +
        c.Pn('M60 27L80 22L74 40L62 46Z', '#ffffff', 0.5) +
        c.L('M68 32L73 44L66 52L74 62L70 72M73 44L83 47', OL, 2.2) +
        c.L('M69 33L74 44L67 52L75 62', '#ffffff', 0.9) +
        c.L('M60 27L80 22L90 34', '#ffffff', 1.4, ' opacity=".8"'),
        f ? 'translate(0 -1)' : ''
      )
    );
  };

  D.whitehorn = (f) => {
    const c = make(3);
    const fur = '#dde1ea';
    const furD = sh(fur, -0.32);
    const hoof = '#4a4458';
    const s = f ? -1 : 1;
    const legH = (x, y, dx, col, bend) => {
      const fy = 90 - 3.25 - 3 - 3;
      return c.leg(x, y, dx, 6.5, col, 3, bend) + c.P(`M${x + dx - 4} ${fy + 1}L${x + dx + 4} ${fy + 1}L${x + dx + 5} 88.5L${x + dx - 4} 88.5Z`, hoof);
    };
    const iceG = c.lin([[0, '#ffffff'], [1, '#7fdcff']]);
    const frost = (x) => c.P(`M${x - 9} 88.5L${x - 7} 80L${x - 4} 88.5ZM${x + 5} 88.5L${x + 8} 78L${x + 11} 88.5Z`, iceG);
    const tip = (x, y, a, l) => g(c.P(`M0 3L${l} 0L0 -3L-2 0Z`, iceG), `translate(${x} ${y}) rotate(${a})`);
    const antler = (dx, dy, col, tipF) => {
      const t = (x, y) => [x + dx, y + dy];
      const p = (pts) => pts.map(([x, y]) => t(x, y).join(' '));
      const beam = `M${p([[80, 24]])}C${p([[76, 15], [68, 12], [56, 11]]).join(' ')}M${p([[75, 17]])}L${p([[78, 9]])}M${p([[68, 13]])}L${p([[67, 7]])}M${p([[60, 11.5]])}L${p([[55, 6]])}M${p([[79, 20]])}L${p([[88, 14]])}`;
      return c.limb(beam, 4.5, col) +
        (tipF ? tip(...t(78, 9), -80, 7) + tip(...t(67, 7), -95, 6.5) + tip(...t(55, 6), -125, 7) + tip(...t(88, 14), -40, 7) + tip(...t(56, 11), 180, 7) : '');
    };
    return c.out(
      legH(28, 62, 5 * s, furD, -3) + legH(64, 62, -5 * s, furD, 2) +
      g(
        `<ellipse cx="72" cy="16" rx="20" ry="9" fill="${ICE}" opacity=".45" stroke="none" ${c.soft()}/>` +
        antler(-5, 1, '#7fb8d4', false) +
        c.P('M18 50C10 48 8 42 12 40C16 42 18 44 20 46Z', '#ffffff') +
        c.P('M16 54C16 44 24 38 36 38L60 38C70 38 76 44 76 52C76 62 70 68 60 68L32 68C22 68 16 62 16 54Z', c.body(fur, 0.35, -0.3)) +
        c.Pn('M24 60C30 64 50 66 64 62C60 66 34 68 24 60Z', '#9fb4c8', 0.5) +
        c.L('M30 50q6-6 12 0t12 0M40 58q5-4 10 0', '#a9d8ee', 2, ' opacity=".8"') +
        c.P('M60 46C63 36 70 28 76 26L87 32C83 38 78 46 76 56Z', c.body(fur, 0.3, -0.3)) +
        c.P('M64 38C70 40 74 46 76 56C72 58 70 54 68 52C66 54 62 50 60 48Z', '#f6f8fc') +
        c.P('M76 24L67 17L78 20Z', furD) +
        c.P('M73 27C76 21 85 20 89 24L97 31C98 35 96 37 92 37L84 39C78 39 74 35 73 30Z', c.body(fur, 0.35, -0.3)) +
        c.E(96, 32.5, 1.8, 1.6, OL) +
        c.En(83, 29, 5, 3.4, '#a9b8cc', 0.55) +
        c.eye(84, 28.5, 2.8) +
        antler(0, 0, '#d8f5ff', true) +
        c.shine(34, 44, 10, 3.5, 0.55, -5),
        f ? 'translate(0 -1)' : ''
      ) +
      legH(32, 63, -5 * s, fur, -3) + legH(68, 63, 5 * s, fur, 2) +
      frost(32 - 5 * s) + frost(68 + 5 * s) +
      c.mist(f ? [[96, 41, 2.5], [92, 44, 2]] : [[97, 40, 2], [93, 43, 2.5]], ICE_L, 0.8)
    );
  };

  D.cinder_lizard = (f) => {
    const c = make(3.5);
    const red = '#ab5a50';
    const redD = sh(red, -0.35);
    const s = f ? -1 : 1;
    const lleg = (x, y, dx, col) => c.limb(`M${x} ${y}L${x + dx * 0.5} ${y + 4}L${x + dx} 83.25`, 6.5, col);
    let spikes = '';
    [[32, 63], [40, 58], [48, 55], [56, 54], [64, 53], [72, 51]].forEach(([x, y], i) => {
      const h = i % 2 ? 10 : 14;
      spikes += c.P(`M${x - 4} ${y + 3}Q${x - 4} ${y - h * 0.5} ${x - 1} ${y - h}Q${x + 1} ${y - h * 0.4} ${x + 4} ${y + 2}Z`, c.lin([[0, EMBER_L], [1, EMBER]]));
    });
    return c.out(
      lleg(40, 74, -8 * s, redD) + lleg(70, 72, 8 * s, redD) +
      g(
        spikes +
        c.P('M5 46C8 62 17 67 27 65C37 57 50 53 62 54C68 49 76 47 84 48C92 49 97 55 96 62C95 68 89 71 82 71L72 73C64 79 50 81 36 79C25 78 12 68 5 46Z', c.body(red, 0.35)) +
        c.Pn('M30 76C42 79 60 78 70 74C62 79 44 81 30 76Z', EMBER_L, 0.6) +
        c.En(46, 70, 3, 2, redD, 0.7) + c.En(56, 67, 2.4, 1.6, redD, 0.7) + c.En(26, 72, 2.4, 1.6, redD, 0.7) +
        c.eye(83, 57, 3.6) + c.L('M86 66L95 64', OL, 1.8) +
        c.spark(f ? 44 : 52, f ? 38 : 36, 1.8, EMBER) + c.spark(f ? 60 : 38, f ? 34 : 42, 1.4, EMBER) + c.spark(f ? 30 : 66, f ? 44 : 32, 1.2, EMBER_L) +
        c.shine(48, 64, 8, 2.5, 0.4, -8),
        f ? 'translate(0 -1)' : ''
      ) +
      lleg(34, 76, 8 * s, red) + lleg(74, 73, -8 * s, red)
    );
  };

  D.sand_burrower = (f) => {
    const c = make(3);
    const shell = '#b39a7a';
    const sand = '#d9bb84';
    const hx = 63;
    const hy = f ? 36 : 33;
    const segs = [];
    for (let i = 0; i < 6; i++) {
      const t = i / 6;
      const x = 30 + t * 27 - Math.sin(t * Math.PI) * 6;
      const y = 80 - t * (80 - hy - 6) - Math.sin(t * Math.PI) * 6;
      segs.push(c.E(H.n(x), H.n(y), H.n(14 - t * 2), H.n(12.5 - t * 1.5), c.body(i % 2 ? shell : sh(shell, -0.08), 0.3)));
    }
    const jaw = (a) => g(c.P('M0 0C9-5 18-3 21 6C16 2 10 2 2 6Z', c.lin([[0, '#efe3c8'], [1, '#8a7258']])), `translate(${hx + 9} ${hy + 5}) rotate(${a}) scale(1.22)`);
    const jawB = (a) => g(c.P('M0 0C9 5 18 3 21-6C16-2 10-2 2-6Z', c.lin([[0, '#8a7258'], [1, '#efe3c8']])), `translate(${hx + 9} ${hy + 8}) rotate(${a}) scale(1.22)`);
    return c.out(
      segs.join('') +
      c.L('M30 66l-6 4M40 58l-6 2M48 48l-6 0', OL, 2.5) +
      jaw(f ? -4 : -18) + jawB(f ? 4 : 18) +
      c.E(hx, hy, 15, 13, c.body(sh(shell, 0.05), 0.35)) +
      c.P(`M${hx - 12} ${hy - 4}C${hx - 6} ${hy - 14} ${hx + 8} ${hy - 14} ${hx + 13} ${hy - 4}C${hx + 4} ${hy - 7} ${hx - 4} ${hy - 7} ${hx - 12} ${hy - 4}Z`, sh(shell, -0.25)) +
      c.eye(hx + 4, hy, 2.8) + c.eye(hx + 11, hy + 1, 2.4) +
      c.P('M6 88.5C10 78 24 72 38 73C52 74 60 80 66 88.5Z', c.body(sand, 0.3, -0.25)) +
      c.En(22, 82, 2, 1.2, sh(sand, -0.3)) + c.En(40, 79, 2, 1.2, sh(sand, -0.3)) + c.En(52, 84, 1.6, 1, sh(sand, -0.3)) +
      c.mist(f ? [[44, 64, 1.6], [56, 54, 1.3], [64, 72, 1.5]] : [[46, 60, 1.4], [58, 58, 1.6], [62, 68, 1.2]], sand, 1) +
      c.shine(hx - 6, hy - 4, 4, 2, 0.4)
    );
  };

  D.magma_brute = (f) => {
    const c = make(3);
    const rock = '#5b5360';
    const rockD = sh(rock, -0.3);
    const s = f ? -1 : 1;
    const crack = (d, w = 2.4) => `<path d="${d}" fill="none" stroke="${EMBER}" stroke-width="${w * 2.6}" opacity=".55" ${c.soft()}/>` + c.L(d, EMBER_L, w);
    return c.out(
      c.limb(`M30 36Q20 48 ${18 - 3 * s} 60`, 13, rockD) + c.E(16 - 3 * s, 66, 10, 9, rockD) + crack(`M${12 - 3 * s} 64l4 3l3-2`, 1.6) +
      c.leg(40, 68, -4 * s, 13, rockD) +
      g(
        c.P('M22 34C26 20 44 14 58 15C74 16 84 26 82 40C80 56 72 70 56 72L40 72C28 68 20 52 22 34Z', c.body(rock, 0.32, -0.4)) +
        crack('M34 28L40 38L35 48L43 58L40 66') + crack('M60 26L55 35L62 43L57 53') + crack('M72 46L65 55L71 63') + crack('M26 46L31 50', 1.8) +
        c.P('M54 22C54 12 62 8 70 9C78 11 81 20 78 27C73 32 61 32 56 28Z', c.body(rock, 0.3)) +
        c.P('M60 17L78 16L77 22L60 22Z', '#241b2c') +
        c.eye(66, 19.5, 2.2, false) + c.eye(73, 19, 2, false) +
        crack('M64 27L74 26', 1.8),
        f ? 'translate(0 -1)' : ''
      ) +
      c.leg(60, 68, 4 * s, 13, rock) +
      c.limb(`M72 34Q86 46 ${84 + 3 * s} 58`, 14, rock) + c.E(85 + 3 * s, 64, 11, 10, c.body(rock, 0.3)) +
      crack(`M${80 + 3 * s} 60l5 4l5-3M${86 + 3 * s} 64l-1 6`, 1.8) +
      c.spark(85 + 3 * s, f ? 82 : 78, 1.6, EMBER)
    );
  };

  D.thermal_vulture = (f) => {
    const c = make(3);
    const body = '#6a5c5a';
    const wing = 'M0 0C-12-14-30-18-46-14C-42-10-49-6-44-2C-50 1-46 5-41 6C-46 10-40 13-33 12C-35 16-27 17-21 14C-13 12-6 8 0 0Z';
    const wf = c.lin([[0, '#ffe08a'], [0.3, EMBER], [0.65, '#7a4a40'], [1, '#5a4a4a']], 'h');
    const wfD = c.lin([[0, '#e8a050'], [0.3, '#c0502e'], [0.65, '#5a3a36'], [1, '#463a3c']], 'h');
    const wingG = (a, fill, sc) => g(c.P(wing, fill), `translate(48 50) rotate(${a}) scale(${sc})`);
    const bob = f ? 3 : -1;
    return c.out(
      g(
        wingG(f ? -14 : 80, wfD, 0.82) +
        c.P('M28 58L8 52L13 58L7 64L14 66L10 72L30 66Z', c.lin([[0, EMBER], [1, '#5a4a4a']], 'h')) +
        c.P('M22 60C28 48 42 44 56 45C66 46 72 50 74 56C70 64 60 67 50 67C38 68 28 66 22 60Z', c.body(body, 0.3)) +
        c.P('M60 48C66 42 74 42 78 46C76 52 70 56 62 56Z', '#efeaf0') +
        c.limb('M72 48Q78 40 80 34', 6, '#c9b4b0') +
        c.E(83, 32, 8.5, 7, c.body('#cbb6b2', 0.3)) +
        c.P('M89 28C95 28 98 32 96 38C95 35 93 34 90 35Z', '#e4d8bc') +
        c.eye(84, 30, 2.8) +
        wingG(f ? -42 : 46, wf, 1),
        `translate(0 ${bob})`
      )
    );
  };

  D.dune_raider = (f) => {
    const c = make(3);
    const cloth = '#cfae7a';
    const grey = '#8a8698';
    const s = f ? -1 : 1;
    const blade = 'M0 0C8-4 16-14 18-28C13-20 6-11-3-5Z';
    return c.out(
      g(
        c.leg(46, 62, -12 * s, 8, sh(grey, -0.3), 0, 4 * s) +
        c.P(f ? 'M42 22C32 22 24 18 16 22C24 24 22 28 18 32C28 28 36 30 44 28Z' : 'M42 22C32 24 24 24 16 30C24 30 23 33 21 37C30 31 37 31 44 28Z', c.body(cloth, 0.2)) +
        c.limb(`M44 40Q36 48 ${30 + 4 * s} 54`, 7, sh(grey, -0.3)) +
        c.P('M38 38C42 32 58 32 62 38L62 60L36 60Z', c.body(grey, 0.3)) +
        c.P('M36 52L62 52L66 66L56 63L50 68L44 63L34 66Z', c.body(sh(cloth, -0.15), 0.3)) +
        c.P('M38 40L62 48L62 54L38 46Z', '#a3463a') +
        c.P('M42 14C46 6 60 5 66 12C70 18 70 28 66 34L46 34C40 28 38 20 42 14Z', c.body(cloth, 0.35)) +
        c.P('M54 17L69 17L69 23L54 23Z', '#241b2c') +
        c.eye(60, 20, 2.2, false) + c.eye(66, 20, 2, false) +
        c.P('M53 23L70 23C70 29 66 33 60 34L52 34Z', sh(cloth, -0.12)) +
        c.leg(54, 62, 12 * s, 8, grey, 0, 4 * s) +
        g(c.P(blade, c.lin([[0, '#f2f0f6'], [1, '#8a8a9c']])) + c.P('M-4-1L4 4L2 7L-6 2Z', GOLD), `translate(74 44) rotate(${f ? 10 : -6})`) +
        c.limb('M58 40Q66 46 72 45', 7, grey) + c.E(73, 45, 3.6, 3.6, sh(grey, -0.2)),
        'rotate(6 50 90)'
      )
    );
  };

  D.obsidian_beetle = (f) => {
    const c = make(3);
    const obs = '#2e2838';
    const s = f ? 1 : -1;
    const bleg = (x, dx, col, ph) => {
      const d = (ph ? s : -s) * 4;
      return c.limb(`M${x} 66L${x + dx + d} 72L${x + dx * 1.4 + d} 84`, 4.5, col);
    };
    return c.out(
      bleg(34, -6, '#1c1726', 0) + bleg(52, 2, '#1c1726', 1) + bleg(68, 8, '#1c1726', 0) +
      c.P('M72 52C80 48 90 52 93 60C95 66 90 72 82 71L72 68Z', c.body('#3c3446', 0.4)) +
      c.P('M84 54C86 44 90 37 96 32C95 41 93 48 92 56Z', c.lin([[0, '#6a5a80'], [1, '#2a2434']])) +
      c.eye(86, 61, 2.8) +
      `<path d="M18 68C30 74 70 74 80 68" fill="none" stroke="${EMBER}" stroke-width="5" opacity=".6" ${c.soft()}/>` +
      c.P('M14 66C14 44 30 30 50 30C68 30 82 42 82 60L82 66C70 72 26 72 14 66Z', c.body(obs, 0.5, -0.3)) +
      c.Pn('M22 54L30 38L44 33L36 48Z', '#d9ccff', 0.55) + c.Pn('M50 33L64 36L56 46Z', '#d9ccff', 0.35) + c.Pn('M70 48L78 56L72 62Z', '#d9ccff', 0.25) +
      c.L('M48 31C48 44 50 56 52 70', '#6a5a80', 2) +
      c.L('M14 66C26 72 70 72 82 66', EMBER, 1.6) +
      bleg(38, -7, '#4a4058', 1) + bleg(56, 2, '#4a4058', 0) + bleg(72, 9, '#4a4058', 1)
    );
  };

  D.flame_spirit = (f) => {
    const c = make(3);
    const outer = f
      ? 'M52 84C32 84 22 70 26 56C28 48 34 44 32 32C40 38 42 42 42 46C44 34 40 22 30 12C46 16 56 28 58 40C62 36 62 30 60 24C72 32 80 48 76 64C72 78 64 84 52 84Z'
      : 'M52 84C32 84 22 70 25 56C27 47 31 42 26 30C36 36 40 41 41 46C43 32 44 20 38 8C52 16 58 30 58 40C63 37 66 32 66 26C76 36 80 50 76 64C72 78 64 84 52 84Z';
    const inner = f
      ? 'M52 78C40 78 34 70 36 60C38 52 44 48 46 40C50 46 52 50 52 54C56 50 58 46 58 42C66 50 68 62 64 70C62 76 58 78 52 78Z'
      : 'M52 78C40 78 34 70 36 60C38 52 42 48 42 40C48 44 52 50 52 54C57 50 59 46 60 40C67 50 68 62 64 70C62 76 58 78 52 78Z';
    return c.out(
      `<ellipse cx="52" cy="58" rx="28" ry="28" fill="${EMBER}" opacity=".45" stroke="none" ${c.soft()}/>` +
      c.mist(f ? [[30, 12, 3.5], [24, 6, 2.5]] : [[37, 8, 3.5], [30, 4, 2.4]], '#b9b4c6', 0.8) +
      c.P(outer, c.lin([[0, '#ffb35a'], [0.5, EMBER], [1, '#c8402a']])) +
      c.P(inner, c.lin([[0, '#fff3b0'], [1, '#ffc24a']]), ' stroke="none"') +
      c.E(53, 64, 4.6, 5.6, '#3a2230') + c.E(65, 63, 4.2, 5.2, '#3a2230') +
      c.eye(53.5, 64, 2.4, false) + c.eye(65.5, 63, 2.2, false)
    );
  };

  D.canyon_slinger = (f) => {
    const c = make(3);
    const cloth = '#c9a272';
    const grey = '#8a8698';
    const s = f ? -1 : 1;
    const stone = f ? [46, 9] : [90, 13];
    return c.out(
      c.leg(44, 66, -6 * s, 8, sh(grey, -0.3)) + c.foot(44 - 6 * s + 2, 5.5, 3, '#5a4a48') +
      g(
        c.limb(`M42 46Q34 54 ${36 + 3 * s} 60`, 7, sh(grey, -0.3)) +
        c.P('M38 44C40 38 58 38 62 44L64 68L36 68Z', c.body(grey, 0.3)) +
        c.P('M34 46C40 40 60 40 66 46L62 62L56 58L50 64L44 58L38 62Z', c.body(cloth, 0.3)) +
        c.E(42, 64, 5, 4.5, c.body('#8a6a48', 0.3)) +
        c.P(f ? 'M42 20C34 20 28 16 22 20C28 22 26 26 24 28C32 26 38 26 42 24Z' : 'M42 20C34 22 28 22 22 28C28 28 28 31 26 34C33 29 38 28 42 24Z', '#a3463a') +
        c.E(54, 28, 14, 13, c.body(grey, 0.35)) +
        c.P('M40 24C42 14 64 12 68 22C60 20 48 20 40 24Z', '#a3463a') +
        c.P('M56 23L69 23L69 30L56 30Z', '#2b2236') +
        c.eye(61, 26.5, 2.4, false) + c.eye(67, 26.5, 2.1, false) +
        c.L('M58 35q4 2 7 0', OL, 1.6),
        f ? 'translate(0 -1)' : ''
      ) +
      c.leg(56, 66, 6 * s, 8, grey) + c.foot(56 + 6 * s + 2, 5.5, 3, '#5a4a48') +
      `<ellipse cx="68" cy="12" rx="23" ry="6.5" fill="none" stroke="#fff" stroke-width="2.2" stroke-dasharray="4 5" opacity=".65"/>` +
      c.L(`M76 21L${stone[0]} ${stone[1]}`, '#6a4a30', 2) +
      c.limb('M60 46Q74 42 76 24', 6.5, grey) + c.E(76, 22, 3.6, 3.6, sh(grey, -0.2)) +
      c.E(stone[0], stone[1], 4.5, 4, c.body('#9a8a80', 0.35))
    );
  };

  D.pyre_worm = (f) => {
    const c = make(3);
    const rock = '#4e4552';
    const lava = EMBER;
    const bez = (t, a, b, cc, d) => (1 - t) ** 3 * a + 3 * (1 - t) ** 2 * t * b + 3 * (1 - t) * t * t * cc + t ** 3 * d;
    const hx = f ? 61 : 60;
    const hy = f ? 35 : 32;
    let segs = '';
    const N = 7;
    const plate = c.body(rock, 0.35, -0.35);
    for (let i = 0; i < N; i++) {
      const t = i / N;
      const x = H.n(bez(t, 32, 12, 30, hx - 8));
      const y = H.n(bez(t, 84, 48, 12, hy + 6));
      const r = H.n(17 - t * 4);
      segs += c.E(x + 2, y + 2, r + 1.5, r + 1.5, lava) + c.E(x, y, r, r - 0.5, plate) +
        c.L(`M${H.n(x - r * 0.5)} ${H.n(y - r * 0.55)}l${H.n(r * 0.3)} ${H.n(r * 0.3)}`, sh(rock, -0.35), 2);
    }
    const crack = (d, w = 2) => `<path d="${d}" fill="none" stroke="${lava}" stroke-width="${w * 2.6}" opacity=".55" ${c.soft()}/>` + c.L(d, EMBER_L, w);
    const jaw = f ? 9 : 5;
    return c.out(
      `<ellipse cx="34" cy="86" rx="32" ry="6" fill="${lava}" opacity=".6" stroke="none" ${c.soft()}/>` +
      c.E(34, 86, 26, 4, '#2a1a24') +
      segs +
      `<g transform="translate(${hx} ${hy}) scale(1.25) translate(${-hx} ${-hy})">` +
      c.P(`M${hx + 8} ${hy + 4}L${hx + 26} ${hy + 4 + jaw}C${hx + 22} ${hy + 14 + jaw} ${hx + 8} ${hy + 16 + jaw} ${hx} ${hy + 10}Z`, c.body(rock, 0.3)) +
      c.P(`M${hx + 9} ${hy + 5}L${hx + 22} ${hy + 5 + jaw * 0.7}L${hx + 9} ${hy + 9 + jaw * 0.5}Z`, c.lin([[0, '#fff1a0'], [1, lava]]), ' stroke="none"') +
      c.P(`M${hx - 14} ${hy}C${hx - 12} ${hy - 14} ${hx + 6} ${hy - 20} ${hx + 18} ${hy - 12}C${hx + 26} ${hy - 7} ${hx + 30} ${hy} ${hx + 28} ${hy + 4}L${hx + 8} ${hy + 6}C${hx} ${hy + 12} ${hx - 12} ${hy + 10} ${hx - 14} ${hy}Z`, c.body(sh(rock, 0.08), 0.4)) +
      c.P(`M${hx - 6} ${hy - 12}L${hx - 10} ${hy - 20}L${hx} ${hy - 15}ZM${hx + 4} ${hy - 16}L${hx + 4} ${hy - 23}L${hx + 11} ${hy - 16}Z`, c.body(sh(rock, -0.1), 0.3)) +
      c.P(`M${hx + 20} ${hy + 4}l2-5l3 5ZM${hx + 14} ${hy + 5}l2-4l2 4Z`, '#efe6d0') +
      crack(`M${hx - 8} ${hy - 4}L${hx - 2} ${hy + 1}L${hx + 4} ${hy - 2}`) +
      c.eye(hx + 10, hy - 6, 3) + c.eye(hx + 18, hy - 4, 2.6) + c.eye(hx + 3, hy - 4, 2) + '</g>' +
      c.P('M6 88.5L10 78L18 76L22 82L20 88.5ZM50 88.5L54 80L62 79L66 84L66 88.5Z', c.body('#6a5c5a', 0.3)) +
      c.P('M24 88.5L27 82L33 82L34 88.5Z', c.body('#6a5c5a', 0.3)) +
      c.spark(f ? 84 : 80, f ? 62 : 58, 1.8, lava) + c.spark(26, f ? 60 : 66, 1.4, lava) + c.spark(f ? 90 : 92, f ? 50 : 44, 1.2, EMBER_L)
    );
  };

  D.rock_crab = (f) => {
    const c = make(3);
    const shell = '#7f7f8e';
    const shellD = sh(shell, -0.35);
    const s = f ? 1 : -1;
    const cleg = (x, dx, col, ph) => {
      const d = (ph ? s : -s) * 3;
      return c.limb(`M${x} 70L${x + dx + d} 76L${x + dx * 1.4 + d} 85.5`, 5.5, col);
    };
    const claw = 'M0 0C-2-10 6-16 14-14L12-7L17-4C15 4 6 7 0 0Z';
    const barn = (x, y, r) => c.P(`M${x - r} ${y + r * 0.5}L${x - r * 0.5} ${y - r * 0.7}L${x + r * 0.5} ${y - r * 0.7}L${x + r} ${y + r * 0.5}Z`, '#d8d4cc') +
      c.En(x, y - r * 0.6, r * 0.4, r * 0.22, '#3a3444');
    return c.out(
      cleg(24, -9, shellD, 0) + cleg(38, -5, shellD, 1) + cleg(54, 4, shellD, 0) +
      '<g transform="translate(0 5)">' +
      c.limb('M58 38L60 24', 3.5, shellD) + c.limb('M66 40L70 26', 3.5, shellD) +
      c.eye(60, 22, 3.2) + c.eye(70, 24, 3) +
      c.limb('M68 48L76 38', 6, shellD) +
      g(c.P(claw, c.body(shellD, 0.3)), `translate(75 36) rotate(${f ? -50 : -64}) scale(1.05)`) +
      c.P('M10 60C10 42 26 32 44 32C62 32 76 42 76 58C76 68 62 74 44 74C26 74 10 68 10 60Z', c.body(shell, 0.4, -0.35)) +
      c.Pn('M14 62C26 71 62 71 72 62C68 70 58 74 44 74C30 74 18 70 14 62Z', SEA, 0.4) +
      barn(28, 44, 4) + barn(42, 38, 3.4) + barn(56, 42, 3.6) + barn(20, 54, 2.8) +
      c.En(36, 54, 4, 2.6, '#5e9a8a', 0.7) + c.En(62, 56, 3, 2, '#5e9a8a', 0.7) +
      c.L('M16 62C26 66 44 68 60 65', shellD, 1.8) + '</g>' +
      cleg(32, 8, shell, 1) + cleg(46, 10, shell, 0) + cleg(60, 12, shell, 1) +
      c.limb('M66 66L75 62', 7, shell) +
      g(c.P(claw, c.body(shell, 0.4)) + c.En(5, -6, 3, 1.8, '#ffffff', 0.45), `translate(75 62) rotate(${f ? -6 : -18}) scale(1.3)`)
    );
  };

  D.volt_jelly = (f) => {
    const c = make(3);
    const bell = f
      ? 'M26 50C24 30 36 18 50 18C64 18 76 30 74 50C69 54 64 50 58 54C53 50 47 54 42 50C36 54 31 50 26 50Z'
      : 'M21 48C19 30 33 20 50 20C67 20 81 30 79 48C73 53 67 48 61 52C55 48 45 52 39 48C33 53 27 48 21 48Z';
    const bx = [30, 40, 50, 60, 70];
    let tent = '';
    let sparks = '';
    bx.forEach((x, i) => {
      const w = (i % 2 ? 1 : -1) * (f ? 4 : -4);
      const ex = x + w * 0.6 + (f ? 0 : 0);
      tent += `M${x} 51C${x + w} 60 ${x - w} 70 ${H.n(ex)} 80`;
      sparks += c.spark(H.n(ex), 82, 1.6, '#fff3a0');
    });
    const bolt = (x, y) => c.L(zig([[x - 4, y - 3], [x, y], [x - 3, y + 2], [x + 2, y + 6]]), '#fff3a0', 1.8);
    return c.out(
      `<ellipse cx="50" cy="40" rx="32" ry="26" fill="${VOLT}" opacity=".4" stroke="none" ${c.soft()}/>` +
      c.limb(tent, 3.2, '#c9bfff') +
      sparks + bolt(bx[0] + (f ? -2 : 3), 86) + bolt(bx[4] + (f ? 3 : -2), 86) +
      c.P(bell, c.rad([[0, '#ffffff', 0.95], [0.35, '#c4b8ff', 0.85], [1, '#5b4bc0', 0.85]], 0.38, 0.3, 0.8)) +
      c.Pn(f ? 'M42 34C42 28 58 28 58 34C58 40 42 40 42 34Z' : 'M40 34C40 27 60 27 60 34C60 41 40 41 40 34Z', '#fff3a0', 0.5) +
      c.L(f ? 'M44 34L50 31L49 35L56 33' : 'M42 35L49 31L48 36L57 33', '#fffbe0', 1.6) +
      c.eye(56, 42, 3) + c.eye(66, 41, 2.7) +
      c.shine(36, 28, 6, 3.5, 0.7)
    );
  };

  D.spray_sprite = (f) => {
    const c = make(3.5);
    const water = c.rad([[0, '#ffffff', 0.95], [0.35, '#9eeaf0', 0.92], [1, '#2a98b0', 0.92]], 0.4, 0.3, 0.8);
    const fin = 'M0 0C-4-12-14-20-26-22C-22-14-20-6-14 2Z';
    const finF = c.lin([[0, '#e8fbff', 0.9], [1, SEA, 0.75]]);
    const fins = (a, sc) => g(c.P(fin, finF) + c.L('M-4-4L-16-16M-8-1L-20-10', '#ffffff', 1.2, ' opacity=".8"'), `translate(48 40) rotate(${a}) scale(${sc})`);
    const bob = f ? 2 : -1;
    return c.out(
      g(
        c.mist(f ? [[10, 56, 3], [4, 62, 2], [14, 66, 2]] : [[8, 52, 2.5], [6, 60, 2.5], [16, 64, 1.8]], '#bdf2f6', 0.85) +
        fins(f ? -10 : 30, 0.85) +
        c.P('M12 50C24 42 38 34 54 34C71 34 82 45 82 58C82 71 70 80 56 80C42 80 32 72 26 62C22 56 18 53 12 50Z', water) +
        c.P(f ? 'M36 74L28 84L42 80Z' : 'M38 75L32 86L44 80Z', finF) +
        c.eye(62, 55, 3.8) + c.eye(73, 54, 3.4) +
        c.L('M66 66q4 3 8 0', OL, 1.8) +
        c.shine(46, 44, 8, 4, 0.7) +
        fins(f ? -30 : 12, 1),
        `translate(0 ${bob})`
      )
    );
  };

  D.drowned_corsair = (f) => {
    const c = make(3);
    const bone = '#dcd6c6';
    const coat = '#3f5a62';
    const weed = '#5e9a6a';
    const s = f ? -1 : 1;
    return c.out(
      c.leg(44, 64, -6 * s, 6, sh(bone, -0.25)) + c.foot(44 - 6 * s + 2, 6, 3.5, '#3a2e34') +
      g(
        c.limb(`M40 40Q32 52 ${34 + 3 * s} 62`, 6.5, sh(coat, -0.3)) + c.E(34 + 3 * s, 64, 3, 3, sh(bone, -0.2)) +
        c.P('M36 36C40 32 60 32 64 36L68 70L58 66L52 72L46 66L32 70Z', c.body(coat, 0.3)) +
        c.P('M46 36L56 36L56 60L46 60Z', '#2b2236') +
        c.L('M47 42H55M47 48H55M47 54H55', bone, 2.2) +
        c.limb('M42 36C40 46 44 52 40 60', 3, weed) +
        c.P('M44 22C44 12 50 8 57 8C65 8 71 14 71 22C71 28 69 30 67 32L67 36L52 36L52 32C46 30 44 27 44 22Z', c.body(bone, 0.25)) +
        c.E(58, 22, 3.8, 4.2, '#241b2c') + c.E(66.5, 22, 3.4, 4, '#241b2c') +
        c.eye(58, 22, 2, false) + c.eye(66.5, 22, 1.8, false) +
        c.P('M62 26L63.5 29L61 29Z', '#241b2c') +
        c.L('M55 33V36M59 33V36M63 33V36', '#241b2c', 1.4) +
        c.P('M45 12C46 3 66 2 70 11Z', c.body('#3a3040', 0.3)) +
        c.P('M35 18C38 9 47 12 56 11C65 10 72 6 80 12C75 18 66 15 57 16C48 17 41 21 35 18Z', c.body('#3a3040', 0.3)) +
        c.L('M36 17C40 11 48 13 56 12C64 11 72 8 79 12', GOLD, 1.6) +
        c.limb('M44 10C40 16 42 22 38 28', 3, weed) + c.L('M60 6l4 3', weed, 2.5),
        f ? 'translate(0 -1)' : ''
      ) +
      c.leg(56, 64, 6 * s, 6, bone) + c.foot(56 + 6 * s + 2, 6, 3.5, '#4a3c42') +
      g(
        c.limb('M60 40Q68 46 72 48', 7, coat) +
        c.P('M70 44L76 46L75 52L69 50Z', bone) +
        c.limb('M75 49L80 50C86 52 86 60 80 61', 3.2, '#b0703e'),
        f ? 'translate(0 -1) rotate(-5 60 40)' : 'rotate(4 60 40)'
      )
    );
  };

  D.coral_colossus = (f) => {
    const c = make(3);
    const stone = '#7c8e93';
    const stoneD = sh(stone, -0.3);
    const coral = '#df8f84';
    const s = f ? -1 : 1;
    const shell = (x, y, r, a) => g(c.P(`M0 ${r * 0.3}L${-r} ${-r * 0.5}C${-r * 0.6} ${-r * 1.1} ${r * 0.6} ${-r * 1.1} ${r} ${-r * 0.5}Z`, c.body('#ece2d4', 0.2)) +
      c.L(`M0 ${r * 0.3}L${-r * 0.5} ${-r * 0.8}M0 ${r * 0.3}L0 ${-r * 0.9}M0 ${r * 0.3}L${r * 0.5} ${-r * 0.8}`, '#b4a08c', 1.4), `translate(${x} ${y}) rotate(${a})`);
    return c.out(
      c.limb('M30 30L22 10M24 16L14 12M22 10L26 2M38 26L42 8M40 14L48 10', 5.5, coral) +
      c.limb('M64 24L72 6M68 14L78 12', 5, '#a87fc0') +
      c.limb(`M30 38Q18 50 ${18 - 3 * s} 62`, 12, stoneD) + c.E(17 - 3 * s, 67, 9, 8, stoneD) +
      c.leg(40, 70, -4 * s, 13, stoneD) +
      g(
        c.P('M20 40C20 24 36 16 52 16C70 16 82 28 80 46C78 62 70 72 54 72L40 72C28 68 20 56 20 40Z', c.body(stone, 0.35)) +
        c.En(30, 50, 5, 3.5, coral, 0.8) + c.En(46, 62, 4, 3, coral, 0.8) + c.En(64, 54, 3, 2.4, '#a87fc0', 0.8) +
        c.En(36, 40, 3.4, 2.6, '#5fa3a0', 0.85) + c.En(56, 66, 2.6, 2, '#5fa3a0', 0.85) + c.En(28, 60, 2.2, 1.8, '#5fa3a0', 0.85) +
        shell(36, 26, 8, -20) +
        c.P('M58 24C58 16 66 12 74 14C80 16 82 24 79 30C74 34 62 34 59 30Z', c.body(stone, 0.3)) +
        c.E(68, 23, 3.6, 4, '#241b2c') + c.E(76, 22.5, 3.2, 3.8, '#241b2c') +
        c.eye(68, 23, 2.1, false) + c.eye(76, 22.5, 1.9, false) +
        c.mist(f ? [[86, 14, 2], [90, 8, 1.5], [84, 4, 1.2]] : [[88, 16, 1.8], [86, 9, 1.5], [91, 4, 1.2]], '#ffffff', 0.7),
        f ? 'translate(0 -1)' : ''
      ) +
      c.leg(60, 70, 4 * s, 13, stone) +
      c.limb(`M72 34Q86 46 ${84 + 3 * s} 58`, 13, stone) + c.E(85 + 3 * s, 64, 10, 9, c.body(stone, 0.3)) +
      shell(74, 34, 7, 20) +
      c.En(80 + 3 * s, 60, 3, 2, '#d8d4cc', 0.9) + c.En(89 + 3 * s, 61, 2.4, 1.6, '#d8d4cc', 0.9) + c.En(85 + 3 * s, 67, 3, 2.2, coral, 0.85)
    );
  };

  D.volt_eel = (f) => {
    const c = make(3);
    const body = '#45506a';
    const path = f ? 'M11 80C22 88 32 70 46 76S68 82 76 62' : 'M11 82C22 72 32 88 46 80S66 68 76 60';
    const bolts = f
      ? [[20, 80], [34, 76], [48, 79], [62, 80]]
      : [[20, 80], [34, 84], [48, 81], [62, 74]];
    const bolt = ([x, y]) => c.L(zig([[x - 3, y - 5], [x + 1, y - 1], [x - 2, y + 1], [x + 2, y + 5]]), '#fff3a0', 2.2);
    return c.out(
      c.P(f ? 'M12 80L4 72L5 87Z' : 'M12 84L4 76L5 89Z', VOLT) +
      `<path d="${path}" fill="none" stroke-width="24"/>` +
      `<path d="${path}" fill="none" stroke="${c.lin([[0, sh(body, 0.35)], [1, sh(body, -0.3)]])}" stroke-width="18"/>` +
      `<path d="${path}" fill="none" stroke="${VOLT}" stroke-width="8" opacity=".55" ${c.soft()}/>` +
      bolts.map(bolt).join('') +
      c.P(f ? 'M66 58C72 48 86 46 94 52C99 57 97 64 90 66L72 70Z' : 'M66 56C72 46 86 44 94 50C99 55 97 62 90 64L72 68Z', c.body(body, 0.35)) +
      c.P(f ? 'M68 56C70 46 76 42 82 45L78 54Z' : 'M68 54C70 44 76 40 82 43L78 52Z', VOLT) +
      c.eye(84, f ? 54 : 52, 3.4) + c.L(f ? 'M88 62L97 59' : 'M88 60L97 57', OL, 1.8) +
      c.spark(f ? 30 : 40, f ? 66 : 70, 1.4, '#fff3a0') + c.spark(f ? 56 : 18, f ? 68 : 70, 1.2, '#fff3a0')
    );
  };

  D.mist_mariner = (f) => {
    const c = make(3);
    const cloak = c.lin([[0, '#b9c4cc', 0.95], [0.6, '#7d8f9a', 0.85], [1, '#6b7f8c', 0.5]]);
    const hem = f ? 'L24 84L32 80L40 86L48 80L56 86L64 80L72 84' : 'L26 86L34 80L42 85L50 80L58 86L66 81L73 85';
    return c.out(
      g(
        c.mist(f ? [[28, 88, 3.5], [44, 88, 3], [62, 88, 3.5]] : [[32, 88, 3], [50, 88, 3.5], [68, 88, 3]], MISTC, 0.75) +
        c.P(`M36 30C30 44 28 62 24 80${hem}L70 60C68 48 66 38 64 32Z`, cloak) +
        c.L('M40 50l2 14M58 54l1 14', '#5d6f7c', 1.6) +
        c.P('M44 10C56 6 70 14 70 28C70 36 66 42 62 44L42 44C36 38 34 28 36 20C38 14 40 12 44 10Z', cloak) +
        c.P('M48 9C52 4 62 4 66 10L64 14C58 10 52 10 48 13Z', '#3a4a66') +
        c.E(59, 28, 8, 9, c.rad([[0, '#3a3450'], [1, '#141020']], 0.6, 0.5, 0.6)) +
        c.eye(58, 27, 2.4, false) + c.eye(64, 27, 2.1, false) +
        c.P('M42 50L82 46L83 52L42 56Z', c.lin([[0, '#8a6a48'], [1, '#5a4232']])) +
        c.P('M66 45L86 44L86 50L66 51Z', c.lin([[0, '#c9ccd6'], [1, '#6a6e80']])) +
        c.L('M84 47L92 47', OL, 3.5) + c.P('M90 42L97 47L90 52L92 47Z', '#c9ccd6') +
        c.L('M60 54C58 62 66 64 66 58', '#c8b48c', 2) +
        c.limb('M54 42Q58 48 62 52', 6, '#8a9aa6') + c.E(62, 52, 3.4, 3.4, '#dfe8ee'),
        `rotate(${f ? 1.5 : -1.5} 50 90)`
      )
    );
  };

  D.tide_caller = (f) => {
    const c = make(3);
    const robe = '#4f6a8a';
    const scale = '#8ea2b0';
    const s = f ? -1 : 1;
    return c.out(
      c.foot(42 - 3 * s, 6, 3, '#5a6878') + c.foot(58 + 3 * s, 6, 3, '#6a7888') +
      g(
        c.P('M36 40C40 34 60 34 64 40L72 84L60 80L50 85L40 80L28 84Z', c.body(robe, 0.3)) +
        c.P('M44 38L56 38L54 84L46 84Z', sh(robe, 0.2)) +
        c.L('M46 46l8 0M46 56l8 0', VOLT, 2) +
        c.P(f ? 'M46 14L42 2L50 8L54 0L58 9L64 4L64 14Z' : 'M46 14L41 3L50 9L53 1L58 10L65 5L64 14Z', c.lin([[0, '#9fe0d8'], [1, SEA]])) +
        c.P('M38 28C38 16 48 11 58 11C70 11 77 20 77 28C77 38 69 44 58 44C48 44 38 38 38 28Z', c.body(scale, 0.35)) +
        c.L('M46 26q-3 5 0 10M50 27q-3 5 0 10', sh(scale, -0.4), 1.8) +
        c.En(54, 18, 3, 2, '#ffffff', 0.35) + c.En(46, 22, 2, 1.4, '#ffffff', 0.3) +
        c.eye(63, 23, 4.4) +
        c.P('M71 32C78 26 84 19 90 19C94 23 94 30 90 34C85 36 78 36 71 36Z', c.body('#e9d6c4', 0.25)) +
        c.L('M78 30q4-6 8-6M83 34q2-5 6-7', '#c49a8a', 1.6) +
        c.limb('M54 46Q66 48 74 38', 6, robe) + c.E(75, 37, 3.4, 3.4, scale),
        f ? 'translate(0 -1)' : ''
      ) +
      c.L(f ? 'M89 12q5 5 0 10M93 8q7 8 0 17' : 'M90 13q4 4 0 8M94 9q6 7 0 15', '#bff4ee', 2.4, ' opacity=".9"')
    );
  };

  D.tempest_whale = (f) => {
    const c = make(3);
    const skin = '#4e5878';
    const belly = '#9aa2bc';
    const cloud = '#6a6684';
    const fluke = 'M0 0C-6-10-14-14-21-12C-16-6-14-2-12 0C-14 2-16 6-21 12C-14 14-6 10 0 0Z';
    const bolt = (pts) => `<path d="${zig(pts)}" fill="none" stroke="${VOLT}" stroke-width="5" opacity=".7" ${c.soft()}/>` + c.L(zig(pts), '#fff6c0', 2);
    const ty = f ? 62 : 38;
    return c.out(
      c.cloud([[26, 32, 8], [36, 25, 10], [50, 20, 10], [64, 19, 9], [77, 22, 8], [88, 28, 6]], c.body(cloud, 0.35, -0.2)) +
      c.En(48, 15, 6, 2.4, '#a9a4c4', 0.7) + c.En(66, 14, 4, 2, '#a9a4c4', 0.7) +
      c.limb(`M30 52C26 52 24 ${ty < 50 ? 46 : 56} 21 ${ty}`, 11, skin) +
      g(c.P(fluke, c.body(skin, 0.3)), `translate(22 ${ty}) rotate(${f ? 30 : -30}) scale(0.9)`) +
      c.limb(f ? 'M54 62L44 54' : 'M54 62L46 72', 7, sh(skin, -0.3)) +
      c.P('M22 50C28 32 46 25 65 25C82 25 96 36 97 50C98 60 92 66 82 70C66 77 44 76 31 68C26 64 23 58 22 50Z', c.body(skin, 0.35, -0.35)) +
      c.P('M30 62C42 71 66 73 82 68C90 65 95 60 97 52C89 58 75 61 60 61C48 61 38 61 30 62Z', c.lin([[0, belly], [1, sh(belly, -0.25)]])) +
      c.L('M38 65L41 68M48 66L51 70M58 67L61 71M68 67L71 70M78 65L80 68', sh(belly, -0.35), 1.6) +
      bolt([[36, 65], [46, 62], [52, 67], [64, 63], [72, 68], [84, 62]]) +
      c.L('M97 52C89 57 81 59 73 58', OL, 2) +
      c.En(42, 36, 2.2, 1.6, '#c8cce0', 0.7) + c.En(54, 33, 2.6, 2, '#c8cce0', 0.7) + c.En(66, 33, 1.8, 1.4, '#c8cce0', 0.7) +
      c.eye(81, 48, 3.2) +
      c.shine(52, 37, 12, 3.5, 0.35, -8) +
      c.limb(f ? 'M62 66Q66 75 58 80' : 'M62 66Q72 73 74 80', 8, sh(skin, -0.1)) +
      c.cloud([[20, 74, 7], [30, 79, 8], [43, 82, 8], [56, 82, 7], [68, 80, 6]], c.body(cloud, 0.3, -0.25)) +
      c.En(30, 76, 5, 2, '#a9a4c4', 0.6) + c.En(44, 79, 5, 2, '#a9a4c4', 0.6) +
      bolt(f ? [[36, 88], [33, 93], [38, 95], [35, 99]] : [[50, 88], [47, 93], [52, 95], [49, 99]])
    );
  };

  D.grey_legionnaire = (f) => {
    const c = make(3);
    const steel = '#8e8c9e';
    const steelD = sh(steel, -0.32);
    const s = f ? -1 : 1;
    const shieldF = c.lin([[0, '#a9a5bc'], [1, '#5e5a70']], 'h');
    return c.out(
      c.leg(42, 64, -5 * s, 9, steelD, f ? 0 : 3) + c.foot(42 - 5 * s + 2, 6, 3, sh(steelD, -0.2), f ? 0 : 3) +
      g(
        c.limb('M30 88L36 8', 3.5, '#6a5a4a') + c.P('M33 12L37 0L41 12L37 15Z', c.lin([[0, '#fff1c0'], [1, GOLD]])) +
        c.limb('M38 40L32 50', 7, steelD) +
        c.P('M34 36C38 31 58 31 62 36L62 62L34 62Z', c.body(steel, 0.35)) +
        c.L('M34 46H62', GOLD, 1.8) +
        c.P('M33 58L63 58L65 70L31 70Z', c.body(sh(steel, -0.1), 0.3)) +
        c.L('M40 59L39 70M48 59V70M56 59L57 70', steelD, 1.6) +
        c.P('M30 38C30 30 40 28 44 34L42 44L30 44Z', c.body(steel, 0.4)) +
        c.P('M38 22C38 11 46 5 54 5C63 5 69 11 69 22L69 32C63 37 44 37 38 32Z', c.body(steel, 0.45, -0.35)) +
        c.P('M50 4C52 0 60 0 62 4L60 8L52 8Z', GOLD) +
        `<path d="M54 22H69" stroke="#fff" stroke-width="5" opacity=".45" ${c.soft()}/>` + c.L('M55 22H68', '#ffffff', 2) +
        c.shine(45, 14, 3, 6, 0.45, 10),
        f ? 'translate(0 -1)' : ''
      ) +
      c.leg(54, 64, 5 * s, 9, steel, f ? 3 : 0) + c.foot(54 + 5 * s + 2, 6, 3, steelD, f ? 3 : 0) +
      g(
        c.P('M58 30L86 27L88 79L60 83Z', shieldF) +
        c.L('M62 33L83 31L85 75L64 78Z', GOLD, 2) +
        c.P('M73 44C69 44 68 48 68 54L66 58L82 57L80 53C80 47 78 44 73 44Z', GOLD) + c.E(74, 59, 2, 1.6, GOLD),
        f ? 'translate(0 -1)' : ''
      )
    );
  };

  D.hush_monk = (f) => {
    const c = make(3);
    const robe = '#8a849c';
    const s = f ? -1 : 1;
    const bell = (x, y) => c.L(`M${x} ${y - 9}V${y - 5}`, '#e8e2f0', 2.4) +
      c.P(`M${x - 6} ${y + 6}C${x - 6} ${y - 2} ${x - 4} ${y - 6} ${x} ${y - 6}C${x + 4} ${y - 6} ${x + 6} ${y - 2} ${x + 6} ${y + 6}L${x + 8} ${y + 8}L${x - 8} ${y + 8}Z`, c.body('#c9a85a', 0.35)) +
      c.L(`M${x - 6} ${y + 1}L${x + 6} ${y + 1}`, '#e8e2f0', 2.4);
    return c.out(
      c.foot(42 - 4 * s, 6, 3, '#4a4458') + c.foot(58 + 4 * s, 6, 3, '#5a5468') +
      g(
        c.P('M36 38C40 32 60 32 64 38L70 84L60 81L50 85L40 81L30 84Z', c.body(robe, 0.3)) +
        c.L('M48 50L46 82M58 54L60 80', sh(robe, -0.3), 1.6) +
        c.P('M38 52C46 56 56 56 64 52L64 57C56 61 46 61 38 57Z', '#5a4a78') +
        c.limb('M46 58L44 70', 2.5, '#5a4a78') +
        c.P('M38 24C38 12 48 6 57 6C67 6 74 14 74 25L74 36C68 42 44 42 38 36Z', c.body(robe, 0.4, -0.3)) +
        c.P('M60 14C64 12 72 13 75 17L76 34L60 34Z', c.rad([[0, '#3a3450'], [1, '#161020']], 0.6, 0.4, 0.7)) +
        c.P('M46 34L44 46L49 44L50 35Z', sh('#b9b1ca', -0.15)) +
        c.P('M44 26C54 22 70 22 77 25L77 33C70 36 54 37 45 34Z', c.body('#b9b1ca', 0.3)) +
        c.L('M60 24L57 35M70 24L67 35', sh('#b9b1ca', -0.25), 1.4) +
        c.eye(65.5, 20, 2, false) + c.eye(72.5, 20, 1.8, false) +
        c.E(44, 42, 2, 2, '#4a4458') + c.E(50, 44, 2, 2, '#4a4458') + c.E(56, 44, 2, 2, '#4a4458') + c.E(62, 42, 2, 2, '#4a4458'),
        f ? 'translate(0 -1)' : ''
      ) +
      g(
        c.limb('M60 44Q70 48 76 46', 7, robe) + c.E(77, 46, 3.4, 3.4, '#cfc8d6') +
        bell(78, 58),
        f ? 'translate(0 -1) rotate(-4 77 46)' : 'rotate(4 77 46)'
      )
    );
  };

  D.void_stalker = (f) => {
    const c = make(3);
    const dk = '#2c2440';
    const DARK = '#d14fc0';
    const L = f ? [6, 1, -5, -9] : [-12, -6, 9, 14];
    const smoke = f ? [[16, 40, 4], [8, 36, 3], [30, 34, 3], [44, 32, 2.5], [4, 30, 2]] : [[18, 38, 3.5], [10, 34, 3], [32, 32, 3.2], [46, 31, 2.4], [6, 28, 2.2]];
    return c.out(
      c.mist(smoke, '#5a4a78', 0.6) +
      g(
        c.leg(28, 60, L[0], 6, '#1c1628', 0, -4) + c.leg(64, 58, L[2], 6, '#1c1628', 0, 3) +
        c.limb(f ? 'M20 52C10 48 8 38 4 34' : 'M20 52C10 50 6 42 2 40', 4, dk) +
        c.P('M16 54C16 44 28 40 42 42C54 43 60 40 68 41C76 43 80 50 78 56C76 63 68 66 58 64L32 64C22 64 16 60 16 54Z', c.body(dk, 0.35, -0.3)) +
        c.L('M30 48C38 46 46 50 52 48M36 56C42 54 50 58 58 55', DARK, 2.2, ` opacity=".85"`) +
        c.P('M66 36L66 24L73 33Z', dk) +
        c.P('M62 44C64 36 72 32 80 34C88 36 94 42 95 47C90 52 80 54 72 52C66 50 62 48 62 44Z', c.body(dk, 0.35)) +
        c.P('M72 34L74 22L80 33Z', sh(dk, 0.1)) +
        c.E(84, 42, 9, 6, DARK, ` opacity=".35" stroke="none" ${c.soft()}`) +
        c.P('M78 41L88 39L87 43L79 44Z', '#ffffff', ` stroke="none" ${c.glow()}`) +
        c.leg(32, 61, L[1], 6.5, '#3a3054', 0, -4) + c.leg(68, 59, L[3], 6.5, '#3a3054', 0, 3),
        `${f ? 'translate(0 -2) ' : ''}`
      ) +
      c.mist(f ? [[70, 70, 2.5], [40, 70, 2]] : [[60, 70, 2], [30, 70, 2.5]], '#5a4a78', 0.5)
    );
  };

  D.ashen_paladin = (f) => {
    const c = make(3);
    const plate = '#d6d2ca';
    const plateD = sh(plate, -0.32);
    const s = f ? -1 : 1;
    const crk = (d) => c.L(d, '#5a5468', 1.6);
    return c.out(
      `<ellipse cx="46" cy="18" rx="17" ry="17" fill="none" stroke="${GOLD}" stroke-width="5" stroke-dasharray="18 7 26 9" opacity=".35" ${c.soft()}/>` +
      `<ellipse cx="46" cy="18" rx="17" ry="17" fill="none" stroke="#f1dc9a" stroke-width="2" stroke-dasharray="18 7 26 9" opacity=".8"/>` +
      c.P(f ? 'M30 34C24 50 20 66 14 82L22 78L26 84L32 78L38 82L40 40Z' : 'M30 34C24 50 18 66 12 80L20 77L23 84L30 78L36 83L40 40Z', c.body('#7a7488', 0.25)) +
      c.leg(40, 64, -6 * s, 10, plateD) + c.foot(40 - 6 * s + 2, 6.5, 3.2, sh(plateD, -0.2)) +
      g(
        c.limb('M36 38L28 52L32 62', 8, plateD) +
        c.P('M32 34C38 28 60 28 66 34L64 62C58 66 40 66 34 62Z', c.body(plate, 0.3, -0.35)) +
        crk('M44 34L46 42L42 48L46 56') + crk('M58 40L54 46') +
        c.P('M46 38L52 38L52 50L46 50Z', c.body(GOLD, 0.2, -0.3)) + c.P('M42 42L56 42L56 46L42 46Z', c.body(GOLD, 0.2, -0.3)) +
        c.P('M33 58L65 58L67 70L31 70Z', c.body(plateD, 0.3)) +
        c.P('M36 20C36 9 44 4 52 4C61 4 67 10 67 20L67 30C61 35 42 35 36 30Z', c.body(plate, 0.4, -0.35)) +
        c.P('M54 18L68 18L68 23L54 23Z', '#241b2c') +
        c.eye(61, 20.5, 2, false) + c.eye(66, 20.5, 1.7, false) +
        crk('M42 8L44 16L40 22') +
        c.P('M49 5C49 0 57 0 57 5Z', GOLD),
        f ? 'translate(0 -1)' : ''
      ) +
      c.leg(56, 64, 6 * s, 10, plate) + c.foot(56 + 6 * s + 2, 6.5, 3.2, plateD) +
      g(
        g(c.P('M-3.5 0L3.5 0L3.5 39L0 45L-3.5 39Z', c.lin([[0, '#c4c2cc'], [1, '#7e7a8c']], 'h')) +
          c.L('M0 8L-1 18L1 26', '#5a5468', 1.4) +
          c.P('M-11 0L11 0L11 4L-11 4Z', c.body('#b89a50', 0.3)) + c.P('M-2.5 4L2.5 4L2.5 12L-2.5 12Z', '#6a5a4a') + c.E(0, 14, 3.4, 3.4, '#b89a50'),
        `translate(78 46) rotate(${f ? 200 : 210})`) +
        c.P('M58 32C66 28 74 32 74 40L70 44L58 42Z', c.body(plate, 0.4)) +
        c.limb('M68 40L74 48L78 48', 8, plate) + c.E(78, 47, 4.4, 4.4, plateD),
        f ? 'translate(0 -1)' : ''
      )
    );
  };

  D.echo_shade = (f) => {
    const c = make(3);
    const s = f ? -1 : 1;
    const fig = (fill, legC) =>
      c.leg(44, 62, -6 * s, 7, legC) + c.leg(56, 62, 6 * s, 7, legC) +
      c.P('M36 40C38 34 46 32 50 32C56 32 64 34 66 40L66 68L60 63L55 69L50 64L45 69L40 63L36 68Z', fill) +
      c.limb(`M40 42Q30 52 ${34 - 3 * s} 62`, 6, legC) + c.limb(`M62 42Q72 50 ${74 + 3 * s} 58`, 6, legC) +
      c.E(52, 22, 13, 13, fill);
    const body = '#4c4462';
    return c.out(
      `<g opacity=".45" stroke="#c4b6ff" transform="translate(${f ? -12 : -9} ${f ? 1 : 0})">${fig('#6a5a9a', '#6a5a9a')}</g>` +
      `<g opacity=".35" stroke="#c4b6ff" transform="translate(${f ? 7 : 10} ${f ? -1 : 0})">${fig('#6a5a9a', '#6a5a9a')}</g>` +
      g(
        fig(c.body(body, 0.35, -0.3), sh(body, -0.2)) +
        c.L('M40 40C46 44 56 44 62 40', '#8f7fc0', 1.8, ' opacity=".8"') +
        c.eye(56, 21, 2.8) + c.eye(63, 21, 2.4) +
        c.L('M38 22C38 14 44 9 52 9', '#b8a8e8', 2, ' opacity=".7"'),
        f ? 'translate(0 -1)' : ''
      )
    );
  };

  D.bellshard_golem = (f) => {
    const c = make(3);
    const br = c.body(BRONZE, 0.35, -0.4);
    const brD = c.body(sh(BRONZE, -0.25), 0.3, -0.35);
    const pat = '#6fa89a';
    const s = f ? -1 : 1;
    const shard = (d, fill = br) => c.P(d, fill);
    return c.out(
      c.limb(`M32 38Q22 48 ${20 - 3 * s} 58`, 10, sh(BRONZE, -0.4)) + shard(`M${12 - 3 * s} 58L${28 - 3 * s} 56L${26 - 3 * s} 72L${14 - 3 * s} 70Z`, brD) +
      c.leg(40, 68, -4 * s, 12, sh(BRONZE, -0.4)) +
      g(
        `<ellipse cx="50" cy="46" rx="26" ry="24" fill="${BELL}" opacity=".7" stroke="none" ${c.soft()}/>` +
        c.E(50, 46, 24, 22, '#3a3248') +
        shard('M26 30C32 20 46 18 52 20L48 46L24 44Z') +
        shard('M56 20C68 22 78 30 78 42L54 46Z') +
        shard('M24 48L48 50L46 72L30 70C26 64 24 56 24 48Z', brD) +
        shard('M52 50L78 46C78 58 72 68 62 72L50 72Z') +
        c.L('M28 34C36 28 44 26 50 26M58 26C66 28 72 32 75 38', pat, 2.4) + c.L('M28 62L44 64M54 64L66 66', pat, 2.4) +
        c.L('M38 22L42 32L36 38', OL, 1.8) +
        `<circle cx="51" cy="48" r="5" fill="${BELL}" opacity=".9" stroke="none" ${c.soft()}/>` + c.E(51, 48, 2.6, 2.6, '#f2eefa', ' stroke="none"') +
        c.P('M54 8C54 2 66 2 66 8L68 20L52 20Z', br) + c.E(60, 3.5, 3, 2.2, br) +
        c.P('M48 22C48 18 72 18 72 22L74 24L46 24Z', brD) +
        c.P('M54 12L68 12L68 16L54 16Z', '#241b2c') + c.eye(60, 14, 1.6, false) + c.eye(65, 14, 1.4, false),
        f ? 'translate(0 -1)' : ''
      ) +
      c.leg(60, 68, 4 * s, 12, sh(BRONZE, -0.15)) +
      c.limb(`M70 36Q82 46 ${82 + 3 * s} 56`, 11, sh(BRONZE, -0.15)) +
      shard(`M${74 + 3 * s} 54L${92 + 3 * s} 52L${92 + 3 * s} 66C${88 + 3 * s} 72 ${78 + 3 * s} 72 ${74 + 3 * s} 66Z`) +
      c.L(`M${76 + 3 * s} 64L${90 + 3 * s} 63`, pat, 2.2)
    );
  };

  D.silent_drake = (f) => {
    const c = make(3);
    const scale = '#7f7b92';
    const memb = '#9c90b8';
    const wing = 'M0 0L-10-30L-16-24L-26-34L-30-24L-42-28L-40-16L-50-14C-40-4-20 2 0 0Z';
    const wingG = (a, fill, sc) => g(c.P(wing, fill) + c.L('M0 0L-10-30M-4-1L-26-34M-10-1L-42-28', sh(scale, -0.35), 1.8), `translate(48 44) rotate(${a}) scale(${sc})`);
    const bob = f ? 3 : -1;
    return c.out(
      g(
        wingG(f ? -60 : 18, c.lin([[0, sh(memb, -0.3)], [1, sh(memb, -0.5)]]), 0.8) +
        c.limb('M30 52C20 54 12 60 8 70', 6, scale) + c.P('M8 70L1 66L4 78L12 74Z', GOLD) +
        c.limb('M42 58L38 68M52 58L50 68', 5, sh(scale, -0.3)) +
        c.P('M26 50C30 40 44 38 56 40C66 42 72 46 74 52C70 60 60 62 48 62C38 62 30 58 26 50Z', c.body(scale, 0.35)) +
        c.P('M34 58C42 62 58 62 68 56C62 62 44 64 34 58Z', '#c8b880') +
        c.limb('M66 46Q74 38 78 34', 8, scale) +
        c.P('M74 32C78 24 88 24 94 30L98 34C96 38 90 40 84 40C78 40 74 38 74 32Z', c.body(scale, 0.35)) +
        c.P('M78 27L72 18L82 25ZM83 26L82 16L88 26Z', c.lin([[0, '#fff1c0'], [1, GOLD]])) +
        c.eye(86, 31, 2.6) + c.L('M90 37L97 35', OL, 1.4) +
        wingG(f ? -95 : -8, c.lin([[0, memb], [1, sh(memb, -0.25)]]), 1),
        `translate(0 ${bob})`
      )
    );
  };

  D.resonance_eater = (f) => {
    const c = make(3);
    const shadow = '#3e3652';
    const fork = '#bdb6c8';
    const xs = [32, 44, 56, 68];
    let tents = '';
    let forks = '';
    xs.forEach((x, i) => {
      const w = (i % 2 ? 1 : -1) * (f ? 3 : -3);
      const ex = x + w;
      tents += `M${x} 54C${x + w} 62 ${x - w} 68 ${ex} 74`;
      forks += `M${ex} 74L${ex} 77M${ex - 3.5} 85.5L${ex - 3.5} 79Q${ex - 3.5} 76 ${ex} 76Q${ex + 3.5} 76 ${ex + 3.5} 79L${ex + 3.5} 85.5`;
    });
    const bell = f
      ? 'M24 54C22 32 36 18 50 18C64 18 78 32 76 54C70 58 64 54 58 58C52 54 48 58 42 54C36 58 30 54 24 54Z'
      : 'M22 52C20 32 34 20 50 20C66 20 80 32 78 52C72 57 66 52 60 56C54 52 46 56 40 52C34 57 28 52 22 52Z';
    return c.out(
      `<ellipse cx="50" cy="48" rx="40" ry="30" fill="none" stroke="${BELL}" stroke-width="2.4" stroke-dasharray="10 9" opacity=".7"/>` +
      c.limb(tents, 4, shadow) +
      c.limb(forks, 2.8, fork) +
      c.P(bell, c.rad([[0, '#8a7fa8', 0.95], [0.5, shadow, 0.95], [1, '#1c1628', 0.95]], 0.4, 0.3, 0.8)) +
      c.L(f ? 'M30 44Q50 36 70 44' : 'M30 42Q50 34 70 42', '#8f7fc0', 2, ' opacity=".8"') +
      c.E(58, 34, 9, 6, '#160f20') +
      c.eye(55, 34, 2.6, false) + c.eye(63, 34, 2.3, false) +
      c.shine(36, 30, 5, 3, 0.35) +
      `<path d="M14 30q-4 6 0 12M86 30q4 6 0 12" fill="none" stroke="${GOLD}" stroke-width="2" opacity=".5"/>`
    );
  };

  D.bellkeeper = (f) => {
    const c = make(3);
    const robe = '#7c768e';
    const robeD = sh(robe, -0.3);
    const s = f ? -1 : 1;
    const br = c.body(BRONZE, 0.4, -0.4);
    const mask = '#d9d2c2';
    return c.out(
      c.foot(46 - 4 * s, 7, 3.2, '#3a3448') +
      g(
        c.E(33, 6, 4.5, 3.6, 'none', ` stroke-width="3.5"`) +
        c.P('M19 54C19 32 23 13 33 10C43 13 48 32 48 54L55 61L12 61Z', br) +
        c.P('M12 61L55 61L54 65L13 65Z', c.body(sh(BRONZE, -0.2), 0.3)) +
        c.L('M21 26C28 24 38 24 46 26M19 48C30 46 38 46 49 48', sh(BRONZE, -0.45), 2) +
        c.L('M24 30C24 40 22 48 23 56', '#f0d890', 2, ' opacity=".6"') +
        c.L('M38 10L36 20L41 27L37 36', OL, 2.2) + c.L('M38 11L36 20L41 27', '#d8ccff', 1, ' opacity=".7"') +
        c.En(30, 40, 4, 3, '#6fa89a', 0.7) + c.En(42, 52, 3, 2, '#6fa89a', 0.7) +
        c.P('M38 32C44 26 62 26 68 32L76 86L65 82L55 87L45 82L34 86Z', c.body(robe, 0.3)) +
        c.L('M50 40L48 82M62 44L64 82', robeD, 1.8) +
        c.L('M40 32L66 56M44 30L68 50', '#4a3a30', 3.5) +
        c.P('M38 60L72 60L73 66L37 66Z', '#5a4a78') +
        c.L('M44 66L42 74', '#5a4a78', 3) +
        c.L('M60 66V70', '#c9c0d8', 1.6) + c.P('M57 75C57 71 63 71 63 75L64 77L56 77Z', c.body(GOLD, 0.3)) +
        c.P('M48 28C48 14 56 7 65 7C75 7 82 14 82 26L82 38L50 40Z', c.body('#4a4458', 0.3)) +
        c.P('M62 10C62 6 74 6 74 10C75 16 75 23 78 28L83 33L55 33L59 28C62 23 61 16 62 10Z', c.body(mask, 0.35, -0.35)) +
        c.E(68, 6.5, 2.6, 2, c.body(mask, 0.3)) +
        c.L('M62.5 21L67 18.5M70.5 18.5L75 21', '#241b2c', 3.6) +
        `<path d="M62.5 21L67 18.5M70.5 18.5L75 21" stroke="#fff" stroke-width="4" opacity=".6" ${c.soft()}/>` + c.L('M62.5 21L67 18.5M70.5 18.5L75 21', '#ffffff', 1.6) +
        c.L('M70 8L68 14L71 17L69 24', '#6a6070', 1.4) +
        c.L('M58 29H80', sh(mask, -0.35), 1.6),
        f ? 'translate(0 -1)' : ''
      ) +
      c.foot(62 + 4 * s, 7, 3.2, '#4a4458') +
      c.mist(f ? [[34, 87, 3], [48, 89, 2.5], [70, 88, 3]] : [[38, 88, 2.5], [56, 89, 3], [74, 87, 2.5]], MISTC, 0.6) +
      g(
        c.limb('M86 87L87 12', 4.5, '#7a5a40') +
        c.P('M78 6L96 6L96 16L78 16Z', c.body('#8a6a48', 0.3)) + c.P('M84 5L90 5L90 17L84 17Z', '#c9c0d8') +
        c.limb('M66 40Q78 46 85 46', 8, robe) + c.E(86, 46, 4, 4, '#c9c0d8'),
        f ? 'translate(0 -1)' : ''
      )
    );
  };

  D.the_silence = (f) => {
    const c = make(3);
    const ash = '#6c6582';
    const ashD = sh(ash, -0.3);
    const mantle = '#827a98';
    const bronze = sh(BRONZE, -0.1);
    const br = c.body(bronze, 0.4, -0.45);
    const crack = (d) => `<path d="${d}" fill="none" stroke="#d8ccff" stroke-width="5" opacity=".5" ${c.soft()}/>` + c.L(d, '#f4f0ff', 1.8);
    const motes = [[EMBER, 8, 24], [ICE, 22, 8], [VOLT, 94, 22], ['#8fcf5a', 5, 80], ['#ffe48a', 86, 6], ['#d14fc0', 96, 84]];
    const shard = (x, y, a, sc = 1) => g(c.P('M-6-4L6-6L5 4L-4 6Z', br), `translate(${x} ${y}) rotate(${a}) scale(${sc})`);
    const sw = f ? 2 : 0;
    const claw = (x, y, a, fill) => g(c.P('M-6-5C-2-8 6-6 8-2L17 1L8 3L15 8L6 6L9 13L2 7L-5 6Z', fill), `translate(${x} ${y}) rotate(${a})`);
    const head =
      c.P('M-17 14C-16 2-14-12-8-18L-4-21L-1-17L2-22L8-18C14-12 16 2 17 14Z', br) +
      c.L('M-15 3C-6 1 6 1 15 3', sh(bronze, -0.5), 2) +
      c.En(-9, -5, 3, 7, '#f6e2a0', 0.35) +
      c.L('M3-20L0-10L5-4L1 5', OL, 2.4) + c.L('M3-19L0-10L5-4L1 4', '#efeaff', 1.1, ' opacity=".85"') +
      c.E(0, 15, 20, 8.5, c.body(sh(bronze, 0.12), 0.3)) +
      c.E(0, 16, 16, 6.2, c.rad([[0, '#3a2a50'], [0.7, '#140c20'], [1, '#05030a']], 0.5, 0.4, 0.6)) +
      c.P('M9 8L14 10L12 13L18 14L19 19L14 17L11 20Z', '#140c20', ' stroke-width="2"') +
      c.eye(-5, 16, 2, false) + c.eye(5, 16, 1.8, false);
    return c.out(
      `<ellipse cx="54" cy="40" rx="40" ry="34" fill="${BELL}" opacity=".35" stroke="none" ${c.soft()}/>` +
      motes.map(([col, x, y], i) => c.spark(x + (f ? (i % 2 ? 2 : -2) : 0), y + (f ? -2 : 0), 1.6, col)).join('') +
      c.limb(`M20 46Q8 56 ${10 - sw} 70`, 10, ashD) + claw(10 - sw, 72, 100, ashD) +
      c.P('M30 56C28 66 26 76 22 84L78 84C74 76 72 66 70 56Z', c.body(ash, 0.25, -0.35)) +
      crack('M44 62L48 70L44 78') +
      c.cloud(f ? [[16, 85, 4], [26, 82, 7], [40, 81, 8], [56, 81, 8], [70, 82, 7], [82, 85, 4]] : [[15, 85, 4], [24, 82, 6], [38, 81, 8], [54, 81, 8], [68, 82, 7], [81, 84, 5]], c.body('#9a94ac', 0.3, -0.2)) +
      c.P(f ? 'M10 54C11 41 24 32 40 32L74 32C88 34 94 44 92 56L86 52L82 61L74 54L66 63L58 55L50 64L42 55L34 63L26 54L18 61Z' : 'M10 54C11 41 24 32 40 32L74 32C88 34 94 44 92 56L86 53L81 61L74 55L66 62L58 56L50 63L42 56L34 62L26 55L18 60Z', c.body(mantle, 0.3, -0.35)) +
      crack('M28 38L33 45L29 52') + crack('M76 40L71 47L76 53') +
      c.mist([[24, 36, 3], [34, 33, 3], [84, 38, 2.6]], '#d9d4e8', 0.55) +
      shard(f ? 10 : 12, f ? 36 : 38, 20) + shard(f ? 28 : 30, f ? 16 : 14, -30, 0.85) + shard(f ? 88 : 90, f ? 26 : 28, 50, 0.9) +
      g(head, `translate(58 ${f ? 28 : 27}) rotate(${f ? -24 : -28}) scale(1.15)`) +
      c.limb(`M82 46Q92 56 ${88 + sw} 68`, 11, mantle) + claw(88 + sw, 70, 80, c.body(mantle, 0.3))
    );
  };

  /* ---------- 자리표시 (알 수 없는 종류) ---------- */
  function placeholder(f) {
    const c = make(3);
    return c.out(
      c.P(`M20 88C14 70 22 40 50 38C78 40 86 70 80 88Z`, c.body(GREY)) +
      c.eye(58, 58, 3.5) + c.eye(70, 58, 3) + c.shine(36, 52, 8, 4) +
      (f ? '' : '')
    );
  }

  return function enemy(type, frame) {
    const f = frame ? 1 : 0;
    const fn = D[type];
    if (!fn) return placeholder(f);
    try {
      return fn(f);
    } catch (e) {
      return placeholder(f);
    }
  };
})();
