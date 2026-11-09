'use strict';

/* =========================================================
 * 적 그림 — 5지역 깨진 대종 (공용 도구: enemies.js)
 * 동작 개정(docs/design/animation.md §2.2·§2.5·§2.6):
 *   적마다 walk0~3(걸음 한 바퀴) · aim(휘두르기 직전) · attack(때리는 순간) · die0~2(죽음) 9장.
 *   인물형은 "관절 표"(자세 → 골반 위치·몸 기울기·발목·손·무기 각도)를 두고
 *   같은 그리기 함수가 표를 읽어 그립니다. 팔·다리는 두 마디(역운동학)로 이어 그립니다.
 *   빛은 왼쪽 위. 몸통의 형태 그림자·팔이 드리운 그늘은 그리고, 바닥 그림자는 그리지 않음(렌더러 몫).
 * ========================================================= */
(() => {
  const { H, OL, sh, MISTC, EMBER, ICE, VOLT, BELL, GOLD, BRONZE, make, g } = RG.art._en;
  const D = RG.art._en.D;
  const MOTION = RG.art._en.MOTION || (RG.art._en.MOTION = {});

  /* ---------- 좌표 도우미 ---------- */
  const n = H.n;
  const RAD = Math.PI / 180;
  const pt = (p) => `${n(p[0])} ${n(p[1])}`;
  /** 점 p에서 각도 a(도, 0=오른쪽, 90=아래)로 l만큼 */
  const pol = (p, a, l) => [p[0] + Math.cos(a * RAD) * l, p[1] + Math.sin(a * RAD) * l];
  const mid = (a, b, t = 0.5) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const angOf = (a, b) => Math.atan2(b[1] - a[1], b[0] - a[0]) / RAD;
  const tr = (p, a = 0, s = 1) => `translate(${pt(p)})${a ? ` rotate(${n(a)})` : ''}${s !== 1 ? ` scale(${n(s)})` : ''}`;
  const SHADE = '#1c1426';

  /**
   * 두 마디 관절(역운동학): 시작 s에서 끝 e까지 마디 길이 l1·l2.
   * 관절(무릎·팔꿈치)은 pref 방향 쪽으로 굽음. 닿지 않으면 곧게 편 채 끝을 향함.
   */
  function ik(s, e, l1, l2, pref) {
    const dx = e[0] - s[0];
    const dy = e[1] - s[1];
    const dist = Math.hypot(dx, dy) || 0.001;
    const d = Math.min(Math.max(dist, Math.abs(l1 - l2) + 0.01), l1 + l2 - 0.01);
    const ux = dx / dist;
    const uy = dy / dist;
    const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
    const m = [s[0] + ux * a, s[1] + uy * a];
    const c1 = [m[0] - uy * h, m[1] + ux * h];
    const c2 = [m[0] + uy * h, m[1] - ux * h];
    const d1 = (c1[0] - m[0]) * pref[0] + (c1[1] - m[1]) * pref[1];
    const d2 = (c2[0] - m[0]) * pref[0] + (c2[1] - m[1]) * pref[1];
    return d1 >= d2 ? c1 : c2;
  }

  /** 끝이 둥근 마디(굵기가 r1→r2로 줄어듦). 외곽선은 감싸는 <g>가 붙임 */
  function seg(c, a, b, r1, r2, fill, x = '') {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const L = Math.hypot(dx, dy) || 0.001;
    const nx = -dy / L;
    const ny = dx / L;
    const p1 = [a[0] + nx * r1, a[1] + ny * r1];
    const p2 = [b[0] + nx * r2, b[1] + ny * r2];
    const p3 = [b[0] - nx * r2, b[1] - ny * r2];
    const p4 = [a[0] - nx * r1, a[1] - ny * r1];
    return c.P(`M${pt(p1)}L${pt(p2)}A${n(r2)} ${n(r2)} 0 0 0 ${pt(p3)}L${pt(p4)}A${n(r1)} ${n(r1)} 0 0 0 ${pt(p1)}Z`, fill, x);
  }
  /** 외곽선 없는 마디(그늘·하이라이트용) */
  function segN(c, a, b, r1, r2, fill, op) {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const L = Math.hypot(dx, dy) || 0.001;
    const nx = -dy / L;
    const ny = dx / L;
    const p1 = [a[0] + nx * r1, a[1] + ny * r1];
    const p2 = [b[0] + nx * r2, b[1] + ny * r2];
    const p3 = [b[0] - nx * r2, b[1] - ny * r2];
    const p4 = [a[0] - nx * r1, a[1] - ny * r1];
    return c.Pn(`M${pt(p1)}L${pt(p2)}A${n(r2)} ${n(r2)} 0 0 0 ${pt(p3)}L${pt(p4)}A${n(r1)} ${n(r1)} 0 0 0 ${pt(p1)}Z`, fill, op);
  }

  /** 몸 좌표계: 골반 (px,py)에서 lean(도, +는 앞으로 숙임)만큼 기울어짐. p(x,y) → 화면 좌표 */
  function frameOf(px, py, lean) {
    const cs = Math.cos(lean * RAD);
    const sn = Math.sin(lean * RAD);
    return { t: tr([px, py], lean), p: (x, y) => [px + x * cs - y * sn, py + x * sn + y * cs] };
  }

  /** 쥔 주먹: 자루 방향 a에 직각으로 감싼 손가락 + 손등 하이라이트 */
  function fist(c, p, r, fill, a = 0) {
    return g(
      c.P(`M${n(-r)} ${n(-r * 0.9)}Q${n(-r)} ${n(-r * 1.25)} 0 ${n(-r * 1.2)}Q${n(r * 1.05)} ${n(-r * 1.15)} ${n(r * 1.05)} 0Q${n(r * 1.05)} ${n(r * 1.15)} 0 ${n(r * 1.2)}Q${n(-r)} ${n(r * 1.25)} ${n(-r)} ${n(r * 0.9)}Z`, fill) +
      c.L(`M${n(r * 0.35)} ${n(-r * 0.9)}V${n(r * 0.9)}`, sh(fill, -0.4), 1.5),
      tr(p, a));
  }

  /**
   * 장화·발: 발목 a, 발 길이 len, 발목~바닥 h, 기울기 tilt(+: 발끝이 아래로).
   * 땅에 닿은 발은 발목 y = 88.5 − h (바닥 외곽선이 y=90).
   */
  function boot(c, a, len, h, tilt, fill, plate = false) {
    const t = h * 0.55;
    const d = `M${n(-len * 0.26)} ${n(-t)}L${n(len * 0.16)} ${n(-t)}C${n(len * 0.3)} ${n(h * 0.15)} ${n(len * 0.66)} ${n(h * 0.25)} ${n(len * 0.74)} ${n(h * 0.72)}Q${n(len * 0.76)} ${n(h)} ${n(len * 0.56)} ${n(h)}L${n(-len * 0.3)} ${n(h)}Q${n(-len * 0.36)} ${n(h * 0.2)} ${n(-len * 0.26)} ${n(-t)}Z`;
    const sole = c.Pn(`M${n(-len * 0.3)} ${n(h - 1.6)}L${n(len * 0.66)} ${n(h - 1.6)}L${n(len * 0.6)} ${n(h)}L${n(-len * 0.3)} ${n(h)}Z`, SHADE, 0.45);
    const lam = plate ? c.L(`M${n(len * 0.05)} ${n(-t * 0.2)}Q${n(len * 0.3)} ${n(h * 0.25)} ${n(len * 0.55)} ${n(h * 0.35)}`, sh(fill, -0.35), 1.5) : '';
    return g(c.P(d, fill) + lam + sole, tr(a, tilt));
  }

  /** 땅에 닿은 발목 높이 */
  const groundAnkle = (h) => 88.5 - h;

  /** 다리 하나: 엉덩이 hip, 발목 [x, 들림, 기울기], 마디 길이, 굵기, 색. knee 반환 */
  function leg(c, hip, foot, o) {
    const ankle = foot.length > 3 ? [foot[0], foot[3]] : [foot[0], groundAnkle(o.h) - foot[1]];
    const knee = ik(hip, ankle, o.l1, o.l2, o.pref || [1, -0.2]);
    let s = seg(c, hip, knee, o.r1, o.r2, o.thigh) + seg(c, knee, ankle, o.r2, o.r3, o.shin);
    if (o.shade !== false) s += segN(c, mid(knee, ankle, 0.1), ankle, o.r2 * 0.5, o.r3 * 0.5, SHADE, 0.18);
    if (o.kneecap) s += o.kneecap(knee, angOf(hip, knee));
    s += boot(c, ankle, o.len, o.h, foot[2] || 0, o.boot, o.plate);
    return { svg: s, knee, ankle };
  }

  /** 팔 하나: 어깨 s → 손 hand. 팔꿈치 반환 */
  function arm(c, s, hand, o) {
    const el = ik(s, hand, o.l1, o.l2, o.pref || [-0.4, 1]);
    const svg = seg(c, s, el, o.r1, o.r2, o.upper) + seg(c, el, hand, o.r2, o.r3, o.fore);
    return { svg, el };
  }

  /** 움직임 선(잔상) */
  const streaks = (c, lines, col = '#f2eefa', w = 2, op = 0.7) =>
    `<g fill="none" stroke="${col}" stroke-width="${w}" opacity="${op}" stroke-linecap="round">${lines.map((d) => `<path d="${d}"/>`).join('')}</g>`;
  /** 휘두른 자국(초승달 모양 빛) */
  const swoosh = (c, d, col = '#f2eefa', op = 0.55) => c.Pn(d, col, op);
  /** 재·안개 알갱이 */
  const motes = (c, pts, col = '#b8b0c8', op = 0.8) => `<g fill="${col}" stroke="none" opacity="${op}">${pts.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('')}</g>`;
  /** 마무리: 발 기준점(50,90)을 중심으로 k배 키워 내보냄 */
  const fin = (c, s, k = 1) => c.out(k === 1 ? s : g(s, `translate(50 90) scale(${k}) translate(-50 -90)`));
  /** 납작하게 눕힌 물건(땅에 놓인 방패 등): 중심 p, 각도 a, 세로 눌림 sy */
  const flat = (body, p, a, sy) => `<g transform="translate(${pt(p)}) scale(1 ${sy})"><g transform="rotate(${n(a)})">${body}</g></g>`;

  /* ==== BEGIN grey_legionnaire ==== */
  /* =========================================================
   * 33 · 회색 군단병 — 얼굴 없는 통투구·회색 판갑·종 문양 방패·창. 발맞춰 행진.
   * 가까운 팔(오른팔)=창, 먼 팔(왼팔)=방패. 가까운 다리 = 오른다리.
   * 죽음: 맞고 뒤로 휘청 → 무릎 꿇고 방패·창을 떨굼 → 속 빈 갑옷이 와르르 무너져 투구가 굴러감.
   * ========================================================= */
  const LEGION = {
    //       골반          기울기  가까운 발 [발목x,들림,기울기(,발목y)]  먼 발      창 손      창 각도  방패 [x,y,각도]  머리 기울기
    walk0: { p: [43, 63.5], lean: 2, nf: [53, 0, 0], ff: [34, 1.5, 24], hand: [37, 57], spear: -95, sh: [60, 57, 3], head: 0 },
    walk1: { p: [43, 61.6], lean: 2, nf: [43, 0, 0], ff: [48, 7, 14], hand: [39, 56], spear: -92, sh: [61, 55, 1], head: 0 },
    walk2: { p: [43, 63.5], lean: 2, nf: [33, 1.5, 24], ff: [53, 0, 0], hand: [41, 57], spear: -88, sh: [62, 57, -1], head: 0 },
    walk3: { p: [43, 61.6], lean: 2, nf: [48, 7, 14], ff: [43, 0, 0], hand: [39, 56], spear: -92, sh: [61, 55, 1], head: 0 },
    aim: { p: [40, 64], lean: -9, nf: [30, 0, 6], ff: [55, 0, 0], hand: [30, 23], spear: -9, sh: [61, 53, -6], head: -4 },
    attack: { p: [44, 65.5], lean: 14, nf: [27, 1, 26], ff: [60, 0, 0], hand: [60, 47], spear: 9, sh: [59, 64, 12], head: 4 },
    die0: { p: [41, 63], lean: -17, nf: [30, 5, 22], ff: [50, 0, 0], hand: [26, 47], spear: -128, sh: [57, 63, 20], head: -18 },
    die1: { p: [43, 73], lean: 26, nf: [28, 0, 62, 86], ff: [56, 0, 0], hand: [49, 72], spear: null, sh: null, head: 24 },
  };

  function drawLegionnaire(fr) {
    const c = make(2.5);
    const steel = '#8f8ca3';
    const steelL = sh(steel, 0.3);
    const steelD = sh(steel, -0.3);
    const mail = '#6e6a84';
    const FAR = -0.2;
    const P = LEGION[fr];
    const legO = (far) => ({
      l1: 13, l2: 13, r1: 4.6, r2: 3.6, r3: 3, h: 4.6, len: 11, plate: true,
      thigh: sh(mail, far ? FAR : 0), shin: c.body(sh(steel, far ? FAR : 0), 0.35, -0.3),
      boot: c.body(sh(steelD, far ? FAR : 0), 0.3, -0.3),
      kneecap: (k, a) => g(c.P('M-3.6 -2.6Q0 -5 3.6 -2.6L3.2 2.4Q0 4 -3.2 2.4Z', c.body(sh(steelL, far ? FAR : 0), 0.4, -0.2)) + c.En(-1.2, -1.6, 1, 0.8, '#fff', 0.5), tr(k, a - 90)),
    });

    /* 창: 쥔 곳 기준 뒤 20 · 앞 37. 물미(끝 쇠)는 금빛 */
    const spear = (hand, a) => {
      const butt = pol(hand, a + 180, 20);
      const neck = pol(hand, a, 28);
      return seg(c, butt, neck, 1.8, 1.7, c.lin([[0, '#8a7258'], [1, '#5c4a3a']], 'h')) +
        c.L(`M${pt(pol(hand, a + 180, 4))}L${pt(pol(hand, a + 180, 8))}`, '#3a2e26', 2.4) +
        g(c.P('M-1 -2.8L3 -3.6Q9 -3.8 11 0Q9 3.8 3 3.6L-1 2.8Z', c.lin([[0, '#f4f2fa'], [0.55, '#b9b6c8'], [1, '#6e6a80']])) +
          c.L('M2.5 0H9.5', '#6e6a80', 1.4) + c.P('M-2.6 -2.8L0.8 -2.8L0.8 2.8L-2.6 2.8Z', c.body(GOLD, 0.3, -0.3)), tr(neck, a)) +
        c.E(n(butt[0]), n(butt[1]), 2, 2, c.body(GOLD, 0.2, -0.3));
    };

    /* 방패: 직사각 방패(휜 면은 가로 그라데이션) + 금 테두리 + 종 문양(좌우 대칭) + 리벳 + 긁힌 자국 */
    const shield = () =>
      c.P('M-9.5 -16Q-9.5 -18.5 -6.5 -18.5L6.5 -18.5Q9.5 -18.5 9.5 -16L9.5 16Q9.5 18.5 6.5 18.5L-6.5 18.5Q-9.5 18.5 -9.5 16Z', c.lin([[0, '#cac7d9'], [0.35, '#a09cb4'], [1, '#55516a']], 'h')) +
      c.Pn('M3.5 -18L9 -16L9 16L3.5 18Z', SHADE, 0.2) +
      c.L('M-7 -15.5H7V15.5H-7Z', GOLD, 1.6) +
      c.P('M0 -9C-3.6 -9 -4.6 -5.6 -4.6 -2L-6 2.6L6 2.6L4.6 -2C4.6 -5.6 3.6 -9 0 -9Z', c.body(GOLD, 0.35, -0.35)) +
      c.E(0, 4.8, 1.8, 1.8, c.body(GOLD, 0.2)) + c.L('M-3 -6Q-2.5 -7.8 -0.5 -8', '#fff6d0', 1.4) +
      c.En(-5, -12.5, 1.1, 1.1, GOLD) + c.En(5, -12.5, 1.1, 1.1, GOLD) + c.En(-5, 12.5, 1.1, 1.1, GOLD) + c.En(5, 12.5, 1.1, 1.1, GOLD) +
      c.L('M-9 7L-5 9L-6 12', '#5a5468', 1.5);

    /* 통투구: 가로 눈 틈만 하얗게 빛남(lit=false면 꺼진 빈 투구), 금 볏, 리벳 */
    const helm = (lit = true) =>
      c.P('M-3.8 -16.6C-1.2 -22.4 6.6 -22.8 9.4 -16.6L7.8 -15.6C5.2 -19.8 0.2 -19.8 -2.2 -15.6Z', c.body(GOLD, 0.35, -0.35)) +
      c.P('M-9 -9C-10 -16 -3 -18.5 2 -18.5C9 -18.5 11.5 -13 11.5 -6L11.5 3.5C8 6 -4 6 -8.5 3.5Z', c.body(steel, 0.45, -0.35)) +
      c.L('M-8.6 -4.5C-3 -3 5 -3 11.4 -4.5', steelD, 1.6) +
      c.Pn('M-8.6 -4C-3 -2.5 5 -2.5 11.4 -4L11.4 3.5C8 6 -4 6 -8.6 3.5Z', SHADE, 0.18) +
      (lit ? `<path d="M3.5 -8.4H11.2" stroke="#fff" stroke-width="5" opacity=".5" ${c.soft()}/>` + c.L('M3.5 -8.4H11', '#ffffff', 2.2) : c.L('M3.5 -8.4H11', '#2a2236', 2.4)) +
      c.En(-1, 0.6, 0.9, 0.9, steelD) + c.En(3.4, 1.2, 0.9, 0.9, steelD) + c.En(7.8, 1.2, 0.9, 0.9, steelD) +
      c.shine(-3.5, -11, 2.2, 4.6, 0.5, 15);

    /* 흉갑(몸 좌표: 골반 (0,0), 위가 −) */
    const cuirass = () =>
      c.P('M-9.5 -1C-11.5 -8 -11.5 -18 -8.5 -23C-3 -26.5 6 -26.5 9.5 -23C12.5 -17 12.5 -8 9.5 -1Z', c.body(steel, 0.42, -0.38)) +
      c.L('M3.5 -24.5C5.5 -17 5.5 -8 3.8 -1.5', steelD, 1.8) +
      c.L('M3 -24C4.6 -17 4.6 -9 3.6 -3', steelL, 1.2, ' opacity=".6"') +
      c.Pn('M5 -24C10 -23 12.5 -17 12 -9L9.5 -1L5 -1.5C6 -8 6 -17 5 -24Z', SHADE, 0.2) +
      c.L('M-8 -21.5C-3 -24 5 -24.2 9 -21.8', GOLD, 1.8) +
      c.shine(-5, -16, 2.4, 5, 0.4, 10);
    /* 허리띠 + 판 치마(태싯) */
    const skirt = () =>
      c.P('M-10 -4.5L10.2 -4.5L10.6 -0.5L-10.4 -0.5Z', c.lin([[0, '#5a4a3e'], [1, '#3a2e28']])) +
      c.P('M1.5 -5.2L5.5 -5.2L5.5 0.2L1.5 0.2Z', c.body(GOLD, 0.3, -0.3)) +
      c.P('M-11 -0.5L11 -0.5L12.6 10L-12.4 10Z', c.body(sh(steel, -0.08), 0.32, -0.3)) +
      c.L('M-5 0L-5.6 10M0.5 0V10M6 0L6.5 10', steelD, 1.5) +
      c.Pn('M-11 6L12.2 6L12.6 10L-12.4 10Z', SHADE, 0.2) +
      c.En(-8, 3.6, 0.9, 0.9, GOLD) + c.En(-2.3, 3.6, 0.9, 0.9, GOLD) + c.En(3.3, 3.6, 0.9, 0.9, GOLD) + c.En(9, 3.6, 0.9, 0.9, GOLD);
    const pauldronAt = (p, a) => g(c.P('M-6 -3C-6 -8 2 -9.5 6 -5L5.5 2C2 0 -3 0 -6 2Z', c.body(steelL, 0.3, -0.35)) + c.L('M-5.5 -1C-2 -3 2 -3 5.5 -1', steelD, 1.5), tr(p, a));

    let s = '';
    if (fr === 'die2') {
      /* 남은 모습: 속 빈 갑옷 더미. 창은 땅에, 방패는 눕고, 흉갑은 뒤로 넘어지고, 투구는 앞으로 굴러감 */
      s += spear([30, 86.4], -2);
      s += flat(shield(), [36, 84], 90, 0.5);
      s += seg(c, [22, 85], [33, 86.5], 3.2, 2.8, c.body(sh(steel, -0.1), 0.3)) + boot(c, [17, 84.5], 11, 4, -70, c.body(steelD, 0.3), true);
      s += g(skirt(), tr([52, 82], -84, 0.95));
      s += g(cuirass() + c.P('M-4 -27L6 -27L6.5 -23L-4.5 -23Z', mail), tr([48, 84], -78, 0.95));
      s += pauldronAt([44, 78], -40);
      s += g(helm(false), tr([75, 80], 96));
      s += seg(c, [61, 87], [70, 86.5], 3.4, 3, c.body(steel, 0.3));
      s += c.mist([[46, 70, 3], [51, 64, 2.4], [56, 58, 1.8], [72, 70, 2.2], [75, 64, 1.6]], '#cfc8dc', 0.55);
      s += motes(c, [[40, 74, 1], [60, 72, 0.9], [66, 66, 0.8], [50, 58, 0.7]], '#efeaf8', 0.8);
      return fin(c, s, 1.12);
    }

    const B = frameOf(P.p[0], P.p[1], P.lean);
    const farHip = B.p(3, -1);
    const nearHip = B.p(-2.5, 1);
    const farSh = B.p(5.5, -22.5);
    const nearSh = B.p(-6.5, -21);
    const lf = leg(c, farHip, P.ff, legO(true));
    const ln = leg(c, nearHip, P.nf, legO(false));
    const shC = P.sh ? [P.sh[0], P.sh[1]] : null;
    // 먼 팔(방패 팔): 위팔만 보이고 아래팔·손은 방패 뒤 손잡이를 쥠
    const farHand = shC || B.p(14, -6);
    const farArm = arm(c, farSh, farHand, { l1: 11, l2: 10, r1: 3.6, r2: 3, r3: 2.8, upper: sh(mail, FAR), fore: c.body(sh(steel, FAR), 0.3), pref: [-0.2, 1] });
    const torso = g(
      c.P('M6 -23C9 -26 13 -25 13.5 -21L12 -17L6 -18Z', c.body(sh(steel, FAR), 0.3)) +
      cuirass() + skirt() +
      c.P('M-4 -27L6 -27L6.5 -23L-4.5 -23Z', mail) +
      c.Pn('M-4 -24.5L6.5 -24.5L6.5 -23L-4.5 -23Z', SHADE, 0.3) +
      g(helm(fr !== 'die1'), tr([1.5, -31], P.head)),
      B.t);
    const nearArm = arm(c, nearSh, P.hand, { l1: 12, l2: 11, r1: 3.8, r2: 3.2, r3: 2.9, upper: mail, fore: c.body(steel, 0.35, -0.3), pref: fr === 'aim' || fr === 'die0' ? [-1, 0.2] : [-0.5, 1] });

    if (fr === 'die1') {
      // 떨어지는 창(뒤로 넘어감)과 앞으로 엎어지는 방패
      s += spear(pol([62, 87], -142, 20), -142);
    }
    s += lf.svg + (shC ? farArm.svg : '') + ln.svg + torso;
    if (!shC) s += farArm.svg + fist(c, farHand, 2.8, c.body(sh(steel, FAR), 0.3), 60);
    if (shC) s += g(shield(), tr(shC, P.sh[2]));
    if (fr === 'die1') s += g(shield(), tr([72, 76], 38));
    // 팔이 몸통에 드리운 그늘(빛이 왼쪽 위 → 오른쪽 아래로)
    s += segN(c, [nearSh[0] + 2.5, nearSh[1] + 3], [nearArm.el[0] + 2.5, nearArm.el[1] + 2], 3, 2.4, SHADE, 0.16);
    if (P.spear != null) s += spear(P.hand, P.spear);
    s += nearArm.svg + pauldronAt(nearSh, angOf(nearSh, nearArm.el) - 90) + fist(c, P.hand, 3, c.body(steel, 0.3, -0.3), (P.spear == null ? 70 : P.spear) + 90);

    if (fr === 'aim') {
      const tip = pol(P.hand, P.spear, 37);
      s += c.spark(n(tip[0]), n(tip[1]), 1.5, '#ffffff');
    }
    if (fr === 'attack') {
      const tip = pol(P.hand, P.spear, 37);
      s += streaks(c, [`M${pt(pol(tip, 189, 20).map((v, i) => v - (i ? 4 : 0)))}L${pt(pol(tip, 189, 34).map((v, i) => v - (i ? 4 : 0)))}`,
        `M${pt(pol(tip, 189, 16).map((v, i) => v + (i ? 4.5 : 0)))}L${pt(pol(tip, 189, 27).map((v, i) => v + (i ? 4.5 : 0)))}`], '#efeaff', 1.6, 0.55);
      s += c.spark(n(tip[0]), n(tip[1]), 1.8, '#ffffff');
    }
    if (fr === 'die0') {
      // 가슴판에 금이 가며 잿빛 김이 새어 나옴
      const hit = B.p(4, -15);
      s += c.L(`M${pt(hit)}l3 -3l-1 -3l3 -2M${pt(hit)}l2 3l4 1`, '#f4f0ff', 1.6) + c.mist([[hit[0] + 6, hit[1] - 3, 2.6], [hit[0] + 9, hit[1] - 7, 2], [hit[0] + 4, hit[1] - 8, 1.6]], '#d8d2e6', 0.7);
    }
    if (fr === 'die1') {
      // 목 틈으로 잿빛 김이 빠져나감
      const nk = B.p(1, -27);
      s += c.mist([[nk[0] - 1, nk[1] - 5, 2.6], [nk[0] - 4, nk[1] - 10, 2.2], [nk[0] - 2, nk[1] - 15, 1.6]], '#d8d2e6', 0.65);
    }
    return fin(c, s, 1.12);
  }
  D.grey_legionnaire = (fr) => drawLegionnaire(LEGION[fr] || fr === 'die2' ? fr : 'walk0');
  D.grey_legionnaire.frames = true;
  // 발맞춘 행진: 보폭 일정, 위아래는 작게, 몸은 곧음
  MOTION.grey_legionnaire = { gait: 'walk', bob: 0.02, tilt: 1.5, deathFx: 'ash', deathTime: 0.8 };
  /* ==== END grey_legionnaire ==== */

  /* ===== 아래는 아직 옛 그림 (차례로 다시 그림) ===== */
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
      c.P('M40 26C38 12 46 8 52 8C58 8 66 12 65 24C65 32 60 36 52 36C46 36 41 32 40 26ZM42 18C36 14 32 16 28 12C34 10 38 10 44 13Z', fill);
    const body = '#4c4462';
    return c.out(
      `<g opacity=".45" stroke="#c4b6ff" transform="translate(${f ? -12 : -9} ${f ? 1 : 0})">${fig('#6a5a9a', '#6a5a9a')}</g>` +
      `<g opacity=".35" stroke="#c4b6ff" transform="translate(${f ? 7 : 10} ${f ? -1 : 0})">${fig('#6a5a9a', '#6a5a9a')}</g>` +
      g(
        fig(c.body(body, 0.35, -0.3), sh(body, -0.2)) +
        c.L('M40 40C46 44 56 44 62 40', '#8f7fc0', 1.8, ' opacity=".8"') +
        c.eye(56, 21, 2.8) + c.eye(63, 21, 2.4) +
        c.L('M42 22C42 15 46 11 52 11', '#b8a8e8', 2, ' opacity=".7"'),
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
})();
