'use strict';

/* =========================================================
 * 적 그림 — 3지역 붉은 협곡 · 4지역 폭풍 해안 (공용 도구: enemies.js)
 * 프레임(docs/design/animation.md §2.2): walk0~walk3(걷기·날갯짓 한 바퀴) · aim(공격 직전 예비 동작) · attack(공격 순간)
 * 짐승마다 "자세 표"(등뼈 조절점·관절 목표점·무기 각도)를 두고, 같은 그리기 함수가 표를 읽어 그립니다.
 * → 모든 프레임이 같은 몸(비율·색·장비)이고, 다리는 엉덩이→무릎→발목→발로 이어집니다.
 * ========================================================= */
(() => {
  const { H, OL, sh, MISTC, EMBER, EMBER_L, VOLT, SEA, GOLD, make, g, zig } = RG.art._en;
  const D = RG.art._en.D;
  const n = H.n;
  const RAD = Math.PI / 180;

  /* ---------- 기하 도우미 ---------- */
  const pol = (p, len, deg) => [p[0] + Math.cos(deg * RAD) * len, p[1] + Math.sin(deg * RAD) * len];
  const add = (p, dx, dy) => [p[0] + dx, p[1] + dy];
  const mixp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const P2 = (p) => `${n(p[0])} ${n(p[1])}`;
  const ang = (a, b) => Math.atan2(b[1] - a[1], b[0] - a[0]) / RAD;

  /** 두 마디 관절(IK): 뿌리 a → 끝 b, 마디 길이 l1·l2. bend +1이면 a→b 방향에서 시계 방향(화면 기준)으로 꺾임 */
  function ik(a, b, l1, l2, bend) {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const d = Math.max(Math.abs(l1 - l2) + 0.01, Math.min(l1 + l2 - 0.01, Math.hypot(dx, dy)));
    const base = Math.atan2(dy, dx);
    const A = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))));
    return [a[0] + Math.cos(base + bend * A) * l1, a[1] + Math.sin(base + bend * A) * l1];
  }

  /** 끝이 둥근 마디 하나(굵기 w1→w2)의 닫힌 경로 */
  function cap(a, b, w1, w2) {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const L = Math.hypot(dx, dy) || 0.01;
    const nx = -dy / L;
    const ny = dx / L;
    const r1 = w1 / 2;
    const r2 = w2 / 2;
    return `M${P2([a[0] + nx * r1, a[1] + ny * r1])}L${P2([b[0] + nx * r2, b[1] + ny * r2])}` +
      `A${n(r2)} ${n(r2)} 0 0 0 ${P2([b[0] - nx * r2, b[1] - ny * r2])}L${P2([a[0] - nx * r1, a[1] - ny * r1])}` +
      `A${n(r1)} ${n(r1)} 0 0 0 ${P2([a[0] + nx * r1, a[1] + ny * r1])}Z`;
  }
  /** 마디 이어 붙인 경로: pts 점들, ws 점마다 굵기 */
  function capsD(pts, ws) {
    let d = '';
    for (let i = 0; i < pts.length - 1; i++) d += cap(pts[i], pts[i + 1], ws[i], ws[i + 1]);
    return d;
  }
  /** 여러 도형을 외곽선 하나로 합쳐 칠함 (관절 이음매에 선이 생기지 않음)
   *  섬세 모드(c.fine): 바깥 실루엣은 공용 필터가 진하게 그리므로, 여기서는 반투명 안쪽 선만 가늘게 두름 */
  function solid(c, d, fill, extra = '') {
    if (c.fine) return `<path d="${d}" fill="none" stroke-width="${n(c.ow * 0.82)}"${extra}/><path d="${d}" fill="${fill}" stroke="none"${extra}/>`;
    return `<path d="${d}" fill="${OL}" stroke="${OL}" stroke-width="${n(c.ow * 2)}"${extra}/><path d="${d}" fill="${fill}" stroke="none"${extra}/>`;
  }
  /** 관절로 이어진 팔다리 한 짝 */
  const chain = (c, pts, ws, fill) => solid(c, capsD(pts, ws), fill);

  /** Catmull-Rom 곡선으로 조절점 사이를 촘촘히 */
  function spline(ctrl, per = 6) {
    const P = [ctrl[0], ...ctrl, ctrl[ctrl.length - 1]];
    const out = [];
    for (let i = 1; i < P.length - 2; i++) {
      const [p0, p1, p2, p3] = [P[i - 1], P[i], P[i + 1], P[i + 2]];
      for (let k = 0; k < per; k++) {
        const t = k / per;
        const t2 = t * t;
        const t3 = t2 * t;
        out.push([0, 1].map((j) => 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)));
      }
    }
    out.push(ctrl[ctrl.length - 1]);
    return out;
  }
  /** 곡선 위 t(0~1) 지점의 점과 방향(도) */
  function at(sp, t) {
    const f = Math.max(0, Math.min(sp.length - 1.001, t * (sp.length - 1)));
    const i = Math.floor(f);
    const p = mixp(sp[i], sp[i + 1], f - i);
    return { p, a: ang(sp[i], sp[i + 1]) };
  }
  /** 굵기가 변하는 관(몸통·꼬리·벌레 몸): 곡선 sp, 반폭 hw(t) → 닫힌 경로. +n 쪽(왼→오른 방향이면 아래)이 L */
  function tube(sp, hw, capEnd = true) {
    const A = [];
    const B = [];
    sp.forEach((p, i) => {
      const a = sp[Math.max(0, i - 1)];
      const b = sp[Math.min(sp.length - 1, i + 1)];
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const len = Math.hypot(dx, dy) || 1;
      const w = hw(i / (sp.length - 1));
      A.push([p[0] - dy / len * w, p[1] + dx / len * w]);
      B.push([p[0] + dy / len * w, p[1] - dx / len * w]);
    });
    const we = hw(1);
    const ws = hw(0);
    return `M${A.map(P2).join('L')}` + (capEnd && we > 0.3 ? `A${n(we)} ${n(we)} 0 0 0 ${P2(B[B.length - 1])}` : `L${P2(B[B.length - 1])}`) +
      `L${B.slice().reverse().map(P2).join('L')}` + (ws > 0.3 ? `A${n(ws)} ${n(ws)} 0 0 0 ${P2(A[0])}` : '') + 'Z';
  }
  /** 프레임 이름 → 걷기 단계 번호(0~3) 또는 -1 */
  const wi = (fr) => (fr.startsWith('walk') ? +fr[4] : -1);
  /** 발목 높이: 발바닥 외곽선이 y=90에 닿게 */
  const GND = (c, lift = 0) => 90 - c.ow / 2 - lift;
  /** 점 p를 중심 o에 대해 deg만큼 돌림 */
  const rot = (p, o, deg) => {
    const s = Math.sin(deg * RAD);
    const k = Math.cos(deg * RAD);
    const x = p[0] - o[0];
    const y = p[1] - o[1];
    return [o[0] + x * k - y * s, o[1] + x * s + y * k];
  };
  /** 마디를 따라 지그재그 금(용암 금·번개 무늬): a→b, 꺾임 수 k, 흔들림 amp */
  function crackAlong(a, b, k = 3, amp = 1.6, seed = 0) {
    const pts = [];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const nx = -(b[1] - a[1]) / L;
    const ny = (b[0] - a[0]) / L;
    for (let i = 0; i <= k; i++) {
      const q = mixp(a, b, i / k);
      const o = i === 0 || i === k ? 0 : (((i + seed) % 2) ? amp : -amp);
      pts.push([q[0] + nx * o, q[1] + ny * o]);
    }
    return `M${pts.map(P2).join('L')}`;
  }
  /** 빛나는 금: 번짐 + 밝은 심 */
  const glowLine = (c, d, col, core, w = 2) => `<path d="${d}" fill="none" stroke="${col}" stroke-width="${n(w * 2.6)}" opacity=".55" ${c.soft()}/>` + c.L(d, core, w);
  /** 점들의 경계 상자 비율 안에서의 위치 (방사형 그라데이션 중심 잡기) */
  function bboxFrac(pts, p) {
    const xs = pts.map((q) => q[0]);
    const ys = pts.map((q) => q[1]);
    const x0 = Math.min(...xs);
    const y0 = Math.min(...ys);
    return [n((p[0] - x0) / Math.max(1, Math.max(...xs) - x0)), n((p[1] - y0) / Math.max(1, Math.max(...ys) - y0))];
  }
  /** y0~y1 사이만 보이게 자름 (땅속으로 들어간 부분 감추기) */
  function clipY(body, y0, y1) {
    const id = H.uid('ec');
    return `<clipPath id="${id}"><rect x="-30" y="${y0}" width="160" height="${y1 - y0}"/></clipPath><g clip-path="url(#${id})">${body}</g>`;
  }
  /** 새·물고기 지느러미 날개: 어깨 s → 팔꿈치 e → 손목 w → 끝 t. 깃털은 늘 꼬리 쪽(-x, 조금 아래)으로 끌림.
   *  chord 날개 폭, fingers 바깥 깃 갈라짐(0~1) */
  function wingD(s, e, w, t, chord, fingers = 0.5) {
    const lead = spline([s, e, w, t], 4);
    const N = lead.length;
    const trail = lead.map((p, i) => {
      const k = i / (N - 1);
      const L = chord * (1 - k * 0.55) * (k > 0.6 ? 1.18 : 1);
      return [p[0] - L * 0.93, p[1] + L * 0.36];
    });
    let d = `M${lead.map(P2).join('L')}`;
    for (let i = N - 1; i >= 1; i--) {
      const k = i / (N - 1);
      d += `L${P2(trail[i])}`;
      const ml = mixp(lead[i], lead[i - 1], 0.5);
      const mt = mixp(trail[i], trail[i - 1], 0.5);
      d += `L${P2(mixp(ml, mt, k > 0.55 ? 1 - fingers : 0.82))}`;
    }
    return { d: `${d}L${P2(trail[0])}Z`, lead, trail };
  }
  /** 모래·먼지 알갱이: [[x,y,r]...] */
  const grains = (c, pts, col) => pts.map(([x, y, r]) => c.En(x, y, r, r * 0.8, col)).join('');

  /* ---------- 4차 다듬기 도우미 (docs/design/animation.md §7) ----------
   * 바깥 윤곽은 공용 섬세 모드(make(ow, { fine: true }))의 실루엣 필터가 진하게, 안쪽 선은 그 자리 색의 어두운 변형으로.
   * 면마다 세 단계(밝은 면·바탕·색 튼 그늘) + 그늘 쪽 반사광 + 반짝점 + 접촉 그늘. 빛은 늘 왼쪽 위.
   */
  const FINE = { fine: true };
  const R3_RIM = '#ffb27a'; // 3지역 반사광: 달아오른 붉은 바위·용암빛
  const R4_RIM = '#8fe6da'; // 4지역 반사광: 바닷물 빛
  function hsl(hex) {
    const [r, gg, b] = H.hexToRgb(hex).map((v) => v / 255);
    const mx = Math.max(r, gg, b);
    const mn = Math.min(r, gg, b);
    const l = (mx + mn) / 2;
    if (mx === mn) return [0, 0, l];
    const d = mx - mn;
    const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    const h = mx === r ? (gg - b) / d + (gg < b ? 6 : 0) : mx === gg ? (b - r) / d + 2 : (r - gg) / d + 4;
    return [h * 60, s, l];
  }
  function fromHsl(h, s, l) {
    const hh = (((h % 360) + 360) % 360) / 360;
    if (s <= 0) return H.rgbToHex(l * 255, l * 255, l * 255);
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const f = (t0) => { const t = (t0 + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
    return H.rgbToHex(f(hh + 1 / 3) * 255, f(hh) * 255, f(hh - 1 / 3) * 255);
  }
  const turn = (h, to, max) => { const d = ((to - h + 540) % 360) - 180; return h + Math.sign(d) * Math.min(Math.abs(d), max); };
  const coolOf = (h, s, cool) => (cool != null ? cool : !(s < 0.07 || h < 80 || h >= 290));
  /** 그늘색: 색상을 틀어 어둡게 — 따뜻한 색·회색은 붉은 보라, 차가운 색은 푸른 보라 쪽(cool로 정할 수 있음) */
  function dk(col, amt = 0.35, cool) {
    const [h, s, l] = hsl(col);
    const cc = coolOf(h, s, cool);
    return fromHsl(turn(h, cc ? 250 : 335, 62 * amt), Math.min(1, s + (1 - s) * 0.32 * amt), l * (1 - amt));
  }
  /** 밝은 면: 따뜻한 색은 누런 빛, 차가운 색은 맑은 청록 빛 쪽으로 밝게 */
  function lt(col, amt = 0.3, cool) {
    const [h, s, l] = hsl(col);
    const cc = coolOf(h, s, cool);
    return fromHsl(turn(h, cc ? 188 : 50, 40 * amt), Math.min(1, s * (1 - 0.18 * amt) + 0.04 * amt), l + (1 - l) * amt);
  }
  /** 덩어리 칠(방사형): 밝은 면 → 바탕 → 색 튼 그늘 → 가장 짙은 가장자리 */
  const G3 = (c, base, o = {}) => c.rad([[0, lt(base, o.hi != null ? o.hi : 0.36, o.cool)], [0.4, base], [0.78, dk(base, o.lo != null ? o.lo : 0.3, o.cool)],
    [1, dk(base, (o.lo != null ? o.lo : 0.3) + 0.14, o.cool)]], o.cx != null ? o.cx : 0.32, o.cy != null ? o.cy : 0.26, o.r != null ? o.r : 0.86);
  /** 팔다리·관 칠(선형, 기본 위→아래) */
  const GL = (c, base, o = {}) => c.lin([[0, lt(base, o.hi != null ? o.hi : 0.18, o.cool)], [0.45, base], [1, dk(base, o.lo != null ? o.lo : 0.34, o.cool)]], o.dir || 'v');
  /** 안쪽 선: 그 자리 색의 어두운 변형(굵기 = 바깥 윤곽의 50~65%) */
  const inl = (c, d, base, w = 1.7, amt = 0.5, x = '') => c.L(d, dk(base, amt), w, x);
  /** 초승달 띠: 도형 d에서 왼쪽 위로 k만큼 옮긴 자기 모양을 뺀 부분(= 오른쪽 아래 가장자리 띠)을 칠함.
   *  a: 그 좌표계의 회전(도) — 돌아간 무리 안에서도 화면 기준 오른쪽 아래를 유지, sc: 그 좌표계의 배율 */
  function crescent(c, d, fill, k, op, a = 0, sc = 1) {
    const id = H.uid('em');
    const off = rot([-k / sc, -k / sc], [0, 0], -a);
    return `<mask id="${id}"><path d="${d}" fill="#fff" stroke="none"/><path d="${d}" fill="#000" stroke="none" transform="translate(${n(off[0])} ${n(off[1])})"/></mask>` +
      `<path d="${d}" fill="${fill}" stroke="none" opacity="${op}" mask="url(#${id})"/>`;
  }
  /** 반사광: 그늘 쪽 가장자리 안쪽의 얇은 밝은 띠(주변 색이 비침) */
  const rimL = (c, d, col, o = {}) => crescent(c, d, col, o.k != null ? o.k : 1.8, o.op != null ? o.op : 0.6, o.a || 0, o.sc || 1);
  /** 형태 그늘: 빛 반대편(오른쪽 아래) 넓은 면을 색 튼 반투명으로 */
  const shadeL = (c, d, col, o = {}) => crescent(c, d, col, o.k != null ? o.k : 5, o.op != null ? o.op : 0.4, o.a || 0, o.sc || 1);
  /** 접촉 그늘(맞닿는 곳의 작고 진한 그늘, 가장자리가 부드러움) */
  function ao(c, x, y, rx, ry, op = 0.55, col = '#2a1232') {
    c._ao = c._ao || {};
    const key = col + op;
    if (!c._ao[key]) c._ao[key] = c.rad([[0, col, op], [0.55, col, op * 0.6], [1, col, 0]]);
    return `<ellipse cx="${n(x)}" cy="${n(y)}" rx="${n(rx)}" ry="${n(ry)}" fill="${c._ao[key]}" stroke="none"/>`;
  }
  /** 빛 덩어리(흐림 필터 없이 방사형으로): 빛나는 것이 둘레에 비추는 색 빛 */
  function glowR(c, x, y, rx, ry, col, op = 0.5) {
    c._gl = c._gl || {};
    const key = col + op;
    if (!c._gl[key]) c._gl[key] = c.rad([[0, col, op], [0.5, col, op * 0.45], [1, col, 0]]);
    return `<ellipse cx="${n(x)}" cy="${n(y)}" rx="${n(rx)}" ry="${n(ry)}" fill="${c._gl[key]}" stroke="none"/>`;
  }
  /** 반짝점(금속·보석·눈·물기) */
  const spec = (c, x, y, r = 1.2, op = 0.95) => c.En(n(x), n(y), n(r), n(r * 0.78), '#ffffff', op);
  /** 섬세 모드용 굵은 선(팔·끈·가지): 반투명 안쪽 선만 가늘게 두름 */
  const limbF = (c, d, w, col, x = '') => `<path d="${d}" fill="none" stroke-width="${n(w + c.ow * 0.9)}"${x}/><path d="${d}" fill="none" stroke="${col}" stroke-width="${w}"${x}/>`;
  /** 돌 구멍·흠: 짙은 구멍 + 오른쪽 아래 밝은 턱 */
  const pits = (c, pts, base) => pts.map(([x, y, r]) => c.En(n(x), n(y), n(r), n(r * 0.75), dk(base, 0.55)) + c.En(n(x + r * 0.45), n(y + r * 0.5), n(r * 0.7), n(r * 0.32), lt(base, 0.32), 0.75)).join('');
  /** 비늘 호: 곡선 sp 위 t0~t1 구간, 줄마다 offs(몸 가운데에서 바깥 쪽 비율), 크기 r */
  function scaleArcs(sp, hw, t0, t1, cnt, offs, r, stag = true) {
    let d = '';
    offs.forEach((o, row) => {
      for (let i = 0; i < cnt; i++) {
        const t = t0 + (t1 - t0) * ((i + (stag && row % 2 ? 0.5 : 0)) / cnt);
        if (t > t1) continue;
        const { p, a } = at(sp, t);
        const q = pol(p, hw(t) * o, a - 90);
        const rr = r * (0.6 + 0.4 * Math.min(1, hw(t) / 6));
        const p1 = pol(q, rr, a - 90);
        const p2 = pol(q, rr, a + 90);
        d += `M${P2(p1)}Q${P2(pol(q, rr * 1.2, a + 180))} ${P2(p2)}`;
      }
    });
    return d;
  }

  /* =========================================================
   * 3지역 · 붉은 협곡
   * ========================================================= */

  /* --- 불도마뱀: 낮게 엎드려 기는 붉은 도마뱀. 대각선 다리 짝(앞-가까운+뒤-먼 / 앞-먼+뒤-가까운)이 번갈아.
   *     죽음: 맞고 머리를 젖힘 → 납작 엎어지며 불씨가 꺼짐 → 잿빛 껍데기가 재로 부서짐 --- */
  RG.art._en.MOTION.cinder_lizard = { gait: 'scuttle', bob: 0.015, tilt: 2, sway: 0.025, deathFx: 'ash', deathTime: 0.7 };
  D.cinder_lizard = (fr) => {
    const c = make(3, { fine: true });
    const cool = fr === 'die1' ? 0.5 : fr === 'die2' ? 1 : 0; // 식어 가는 정도
    const red = H.mix('#b0564a', '#6a6270', cool);
    const redD = sh(red, -0.3);
    const emb = H.mix(EMBER, '#55505c', cool);
    const embL = H.mix(EMBER_L, '#77707e', cool);
    if (fr === 'die2') {
      // 잿빛 껍데기가 마디마디 부서져 재 더미로
      const sp = spline([[8, 84], [22, 84.5], [40, 83], [58, 83], [72, 83], [78, 83]], 5);
      const hw = (t) => 1.5 + t * 4.2;
      const seg = (a, b) => c.P(tube(sp.slice(a, b), (t) => hw((a + t * (b - a)) / (sp.length - 1))), c.lin([[0, '#857d8a'], [1, '#4e4856']]));
      return c.out(
        c.mist([[44, 70, 3], [48, 62, 3.6], [53, 54, 4], [60, 47, 3.4]], '#9a94a4', 0.45) +
        c.P('M16 88.5C20 80 34 79 40 88.5Z', c.lin([[0, '#a39cab'], [1, '#6a6472']])) + c.P('M46 88.5C50 81 62 81 68 88.5Z', c.lin([[0, '#a39cab'], [1, '#6a6472']])) +
        seg(0, 9) + seg(10, 17) + seg(18, 25) +
        c.P('M74 86C74 80 84 79 90 82C93 84 92 87 88 88L76 88Z', c.lin([[0, '#8a8290'], [1, '#544e5c']])) + c.E(84, 83, 1.6, 1.4, '#3a3442') +
        c.P('M30 82l3-4l2 4ZM52 81l2-5l3 5ZM64 82l3-3l1 4Z', '#6a6270') +
        c.En(26, 86, 1.3, 0.8, '#3a3442') + c.En(57, 86, 1.3, 0.8, '#3a3442') +
        c.spark(36, 84, 1.2, EMBER) + c.spark(61, 85, 1, EMBER_L)
      );
    }
    // 자세 표: sp 등뼈(꼬리 끝→목), hd 머리 각도, jaw 턱 벌림, ft 발 [앞가까운, 앞먼, 뒤가까운, 뒤먼] = [x, 들림]
    const T = {
      walk0: { sp: [[4, 64], [14, 74], [32, 75], [52, 72], [68, 70], [77, 66]], hd: -6, jaw: 3, ft: [[78, 0], [60, 0], [26, 0], [44, 0]] },
      walk1: { sp: [[3, 73], [14, 77], [32, 74], [52, 71], [68, 69], [77, 65]], hd: -8, jaw: 3, ft: [[64, 0], [72, 5], [40, 5], [32, 0]] },
      walk2: { sp: [[5, 82], [15, 78], [32, 75], [52, 72], [68, 70], [77, 66]], hd: -6, jaw: 3, ft: [[60, 0], [78, 0], [44, 0], [26, 0]] },
      walk3: { sp: [[3, 70], [14, 76], [32, 74], [52, 71], [68, 69], [77, 65]], hd: -8, jaw: 3, ft: [[72, 5], [64, 0], [32, 0], [40, 5]] },
      // 뒷다리로 버티고 몸을 뒤로 젖힘, 앞발 들어 발톱 펼침, 입 벌림, 꼬리 말아 올림
      aim: { sp: [[9, 50], [12, 66], [28, 75], [44, 70], [56, 60], [63, 51]], hd: -30, jaw: 28, ft: [[72, 15], [62, 0], [22, 0], [36, 0]], claw: true },
      // 몸을 쭉 뻗어 물어뜯음(불씨가 튐), 앞발 할퀴기, 뒷다리 밀기
      attack: { sp: [[0, 79], [10, 78], [26, 76], [44, 73], [59, 71], [67, 70]], hd: 8, jaw: 34, ft: [[82, 3], [64, 0], [12, 2], [27, 0]], bite: true },
      // 맞고 등이 휘며 머리를 젖힘, 앞발이 들림
      die0: { sp: [[12, 64], [20, 75], [36, 76], [50, 70], [58, 61], [58, 53]], hd: -80, jaw: 18, ft: [[60, 12], [54, 9], [28, 0], [42, 4]], hit: true },
      // 납작 엎어짐: 다리가 옆으로 벌어지고 머리를 땅에 떨굼, 가시의 불이 꺼짐
      die1: { sp: [[4, 82], [16, 83], [34, 81], [52, 80], [68, 80], [77, 81]], hd: 10, jaw: 10, ft: [[84, 0], [76, 0], [20, 0], [30, 0]], flat: true },
    };
    const S = T[fr];
    const sp = spline(S.sp, 6);
    const hw = (t) => (t < 0.45 ? 0.7 + (t / 0.45) * 6.8 : t < 0.8 ? 7.5 + Math.sin(((t - 0.45) / 0.35) * Math.PI) * 1.6 : 7.5 - ((t - 0.8) / 0.2) * 1.6);
    const hip = add(at(sp, 0.47).p, 0, 3.5);
    const sho = add(at(sp, 0.85).p, 0, 3.5);
    const neck = sp[sp.length - 1];
    const legFill = (col) => c.lin([[0, col], [1, sh(col, -0.28)]]);
    const leg = (root, [fx, lift], front, near) => {
      const col = near ? red : redD;
      const ank = [fx, GND(c, 2 + lift)];
      const knee = ik(root, ank, 7.5, 9, (front ? 1 : -1) * (S.flat ? -1 : 1));
      let toes;
      if (S.claw && front && near) {
        toes = cap(ank, pol(ank, 6, -50), 2.6, 1.6) + cap(ank, pol(ank, 6.5, -18), 2.6, 1.6) + cap(ank, pol(ank, 5.5, 14), 2.6, 1.6);
      } else if (lift > 2) {
        toes = cap(ank, pol(ank, 5, 70), 2.6, 1.8) + cap(ank, pol(ank, 4.5, 110), 2.6, 1.8);
      } else {
        toes = cap(ank, [fx + 5.5, GND(c, 0.9)], 2.6, 1.8) + cap(ank, [fx + 2.5, GND(c, 0.9)], 2.6, 1.8) + cap(ank, [fx - 3.5, GND(c, 0.9)], 2.4, 1.6);
      }
      return solid(c, capsD([root, knee, ank], [7, 5, 3.6]) + toes, legFill(col));
    };
    // 등 가시(불씨 비늘): 등뼈 위쪽으로
    let spikes = '';
    [0.34, 0.43, 0.52, 0.61, 0.7, 0.78].forEach((t, i) => {
      const { p, a } = at(sp, t);
      const nrm = a - 90;
      const base = pol(p, hw(t) - 1.2, nrm);
      const hgt = (i % 2 ? 7.5 : 11) * (S.claw ? 1.25 : S.flat ? 0.6 : 1);
      const tip = pol(base, hgt, nrm - (S.flat ? 50 : 22));
      const b1 = pol(base, 3.8, a + 180);
      const b2 = pol(base, 3.8, a);
      spikes += c.P(`M${P2(b1)}Q${P2(mixp(b1, tip, 0.6))} ${P2(tip)}Q${P2(mixp(b2, tip, 0.3))} ${P2(b2)}Z`, c.lin([[0, embL], [1, emb]]));
      if (!cool && i % 2 === 0) spikes += c.spark(n(tip[0]), n(tip[1]), 0.9, EMBER_L);
    });
    // 머리: 목에서 회전, 아래턱은 경첩(3,2)에서 벌어짐
    const open = S.jaw > 10;
    const head = g(
      (open ? c.P('M2 1L21 0L19 13Z', '#4a1a22', ` transform="rotate(${S.jaw * 0.5} 3 2)"`) : '') +
      (S.bite ? `<ellipse cx="22" cy="6" rx="8" ry="6" fill="${EMBER}" opacity=".75" stroke="none" ${c.soft()}/>` + c.spark(24, 4, 2, EMBER_L) + c.spark(28, 10, 1.4, EMBER) : '') +
      g(c.P('M2 1L20 2C19 5 13 7 5 6C1 5 0 3 2 1Z', c.lin([[0, red], [1, redD]])) + (open ? c.P('M9 2.2l1.5 2.6l1.5-2.6M14 2.4l1.3 2.4l1.3-2.4', '#fff', ' stroke-width="1"') : ''), `rotate(${S.jaw} 3 2)`) +
      c.P('M-3-6C3-11 14-10 19-6C22-4 23-1 21 2L4 3C-1 3-4-1-3-6Z', c.body(red, 0.35)) +
      (open ? c.P('M9 2.6l1.5-2.4l1.5 2.4M15 2.3l1.2-2.2l1.2 2.2', '#fff', ' stroke-width="1"') : c.L('M5 2.5L19 1.8', OL, 1.6)) +
      c.En(19, -3, 1, 0.8, OL) + c.L('M7-7.5C10-9.5 13-9.5 16-8', redD, 1.6) +
      (fr === 'die1' ? c.L('M10-5l4 3M14-5l-4 3', OL, 1.8) : c.eye(12, -3.5, 2.6)),
      `translate(${P2(neck)}) rotate(${n(at(sp, 1).a * 0.4 + S.hd)})`
    );
    let fx = '';
    if (fr === 'aim') fx = c.spark(40, 36, 2, EMBER) + c.spark(52, 30, 1.7, EMBER_L) + c.spark(28, 42, 1.5, EMBER) + c.spark(62, 38, 1.4, EMBER_L);
    else if (S.hit) fx = c.spark(30, 44, 1.8, EMBER) + c.spark(18, 50, 1.4, EMBER_L) + c.spark(44, 40, 1.4, EMBER) + c.L('M80 44l6-4M82 50l7 0M78 38l4-6', '#fff', 1.8);
    else if (S.flat) fx = c.mist([[40, 70, 2.6], [44, 63, 3], [50, 57, 3.2]], '#a8a2b0', 0.5);
    else if (!S.bite) { const k = wi(fr); fx = c.spark(36 + k * 5, 50 - (k % 2) * 4, 1.6, EMBER) + c.spark(58 - k * 3, 52 + (k % 2) * 3, 1.3, EMBER_L); }
    const body = tube(sp, hw);
    const mid = at(sp, 0.6);
    return c.out(
      fx +
      leg(sho, S.ft[1], true, false) + leg(hip, S.ft[3], false, false) +
      spikes +
      c.P(body, c.lin([[0, sh(red, 0.2)], [0.5, red], [1, sh(red, -0.22)]])) +
      // 배 아래 불빛(용암 비늘) + 등 무늬
      c.Pn(tube(sp.slice(14, 30).map((q) => add(q, 0, 4.6)), () => 1.3), emb, 0.75) +
      [0.5, 0.6, 0.7].map((t) => { const q = at(sp, t); return c.En(n(q.p[0]), n(q.p[1] - 1.8), 2.2, 1.4, redD, 0.7); }).join('') +
      c.shine(n(mid.p[0]), n(mid.p[1] - 3.5), 7, 1.8, 0.35, n(mid.a)) +
      leg(hip, S.ft[2], false, true) +
      head +
      leg(sho, S.ft[0], true, true)
    );
  };
  D.cinder_lizard.frames = true;

  /* --- 모래 굴착충: 모래를 헤치며 몸 앞쪽을 활처럼 내밀고 나아감. 마디가 물결치고, 큰 턱이 여닫힘.
   *     죽음: 맞고 몸을 뒤로 젖힘 → 모래 위에 축 늘어짐 → 모래 속으로 가라앉음 --- */
  RG.art._en.MOTION.sand_burrower = { gait: 'slither', bob: 0.02, tilt: 2, sway: 0.03, deathFx: 'crumble', deathTime: 0.8 };
  D.sand_burrower = (fr) => {
    const c = make(3, { fine: true });
    const dull = fr === 'die1' || fr === 'die2' ? 0.3 : 0;
    const shell = H.mix('#bf9f76', '#8d8478', dull);
    const shellD = sh(shell, -0.32);
    const sand = '#d9bb84';
    const sandD = sh(sand, -0.25);
    // sp 등뼈(모래 속 꼬리 → 목), hd 머리 각도, md 턱 벌림, ph 마디 물결 위상
    const T = {
      walk0: { sp: [[13, 96], [20, 77], [30, 66], [44, 58], [57, 52], [66, 49]], hd: 12, md: 22, ph: 0 },
      walk1: { sp: [[13, 96], [21, 79], [32, 70], [46, 63], [58, 57], [68, 55]], hd: 22, md: 12, ph: 0.25 },
      walk2: { sp: [[13, 96], [19, 76], [28, 64], [41, 56], [55, 50], [65, 46]], hd: 6, md: 26, ph: 0.5 },
      walk3: { sp: [[13, 96], [20, 78], [31, 68], [45, 60], [57, 54], [67, 51]], hd: 16, md: 16, ph: 0.75 },
      // 뒤로 크게 젖혀 턱을 활짝 벌림
      aim: { sp: [[13, 96], [17, 76], [20, 60], [27, 46], [37, 37], [46, 34]], hd: -28, md: 46, ph: 0.1 },
      // 앞으로 내리꽂으며 턱을 꽉 닫음 + 모래 튐
      attack: { sp: [[13, 96], [23, 78], [37, 70], [53, 66], [66, 65], [75, 67]], hd: 30, md: -4, ph: 0.4, hit: true },
      // 맞고 몸을 뒤로 꺾음
      die0: { sp: [[13, 96], [18, 77], [21, 63], [26, 51], [33, 44], [39, 44]], hd: -110, md: 34, ph: 0.2, hurt: true },
      // 모래 위로 축 늘어져 쓰러짐
      die1: { sp: [[14, 90], [24, 85], [36, 82], [48, 80], [58, 79], [66, 79]], hd: 2, md: 16, ph: 0.6, lie: true },
    };
    // 헤쳐진 모래 둔덕(울퉁불퉁 두 봉우리, 왼쪽 위가 밝음)
    const mound = (x0, x1, h) => {
      const w = x1 - x0;
      return c.P(`M${x0} 88.5C${x0 + w * 0.08} ${88.5 - h * 0.7} ${x0 + w * 0.2} ${88.5 - h * 1.1} ${x0 + w * 0.34} ${88.5 - h}C${x0 + w * 0.44} ${88.5 - h * 0.85} ${x0 + w * 0.5} ${88.5 - h * 1.25} ${x0 + w * 0.64} ${88.5 - h * 1.1}C${x0 + w * 0.8} ${88.5 - h * 0.95} ${x1 - w * 0.06} ${88.5 - h * 0.4} ${x1} 88.5Z`, c.lin([[0, sh(sand, 0.2)], [0.55, sand], [1, sandD]])) +
        c.L(`M${x0 + w * 0.22} ${88.5 - h * 0.55}q${w * 0.08} -${h * 0.3} ${w * 0.16} 0M${x0 + w * 0.56} ${88.5 - h * 0.6}q${w * 0.07} -${h * 0.3} ${w * 0.15} 0`, sandD, 1.5);
    };
    if (fr === 'die2') {
      // 모래 속으로 가라앉음: 둔덕 위로 마지막 마디와 턱 끝만
      return c.out(
        clipY(c.P(tube(spline([[30, 88], [40, 82], [52, 80], [62, 84]], 5), () => 6), c.body(shellD, 0.25)) +
        c.L('M38 80.5l3 6M46 78l2 6M54 78.5l1 6', sh(shellD, -0.3), 1.8), -20, 88) +
        mound(4, 94, 11) +
        c.P('M70 84C74 78 80 76 84 79C80 79 76 81 74 85Z', c.lin([[0, '#efe3c8'], [1, '#8a7258']])) +
        c.P('M64 86C66 81 70 79 73 80C71 82 69 84 68 87Z', c.lin([[0, '#efe3c8'], [1, '#8a7258']])) +
        grains(c, [[20, 82, 1.2], [34, 79, 1], [50, 81, 1.3], [62, 78, 1], [78, 83, 1.2], [86, 85, 1]], sandD) +
        c.mist([[40, 72, 2.4], [52, 70, 2], [30, 74, 1.8]], sand, 0.7)
      );
    }
    const S = T[fr];
    const sp = spline(S.sp, 6);
    const hw = (t) => 10.5 - Math.abs(t - 0.55) * 4;
    const body = tube(sp, hw);
    // 마디 고리와 배 쪽 짧은 다리(모래를 긁음)
    let rings = '';
    let legs = '';
    for (let k = 0; k < 7; k++) {
      const t = 0.1 + ((k + S.ph) / 7) * 0.86;
      if (t > 0.95) continue;
      const { p, a } = at(sp, t);
      const w = hw(t);
      const p1 = pol(p, w - 0.8, a + 90);
      const p2 = pol(p, w - 0.8, a - 90);
      rings += c.L(`M${P2(p1)}Q${P2(pol(p, 3, a + 180))} ${P2(p2)}`, shellD, 2);
      const l0 = pol(p, w, a + 90);
      const swing = (k % 2 ? 1 : -1) * (S.lie ? 0 : 18) * (wi(fr) % 2 ? 1 : -1);
      legs += cap(l0, pol(l0, 5, a + 90 + 25 + swing), 2.8, 2);
    }
    const neck = sp[sp.length - 1];
    const ha = at(sp, 1).a * 0.5 + S.hd;
    const mand = (sgn) => g(
      c.P(sgn < 0 ? 'M0-2C7-7 16-6 21 3C17 0 10 0 1 3Z' : 'M0 2C7 7 16 6 21-3C17 0 10 0 1-3Z', c.lin([[0, '#f2e6cc'], [1, '#8a7258']])) +
      c.P(sgn < 0 ? 'M8-1.6l1.5 2.6l1.4-2.4M13-1.2l1.3 2.4l1.2-2' : 'M8 1.6l1.5-2.6l1.4 2.4M13 1.2l1.3-2.4l1.2 2', '#f7efdc', ' stroke-width="1"'),
      `translate(15 ${sgn * 3.5}) rotate(${sgn * S.md * 0.5})`
    );
    const head = g(
      mand(1) + mand(-1) +
      c.P('M-6-9C3-13 13-11 17-5C19-1 19 4 16 8C10 12 0 11-6 8Z', c.body(sh(shell, 0.05), 0.35)) +
      c.P('M-5-8C3-12 12-10 16-5C9-7 1-7-5-4Z', shellD) +
      c.L('M-3 2C3 4 9 4 14 2', shellD, 1.6) +
      (S.hurt ? c.L('M5-3l4 3M9-3l-4 3', OL, 1.8) + c.L('M11-2l3 2.5M14-2l-3 2.5', OL, 1.6) : c.eye(7, -1, 2.4) + c.eye(12.5, -0.5, 2)) +
      c.shine(2, -5, 4, 1.6, 0.4),
      `translate(${P2(neck)}) rotate(${n(ha)})`
    );
    let fx = '';
    if (S.hit) fx = grains(c, [[90, 70, 1.4], [94, 78, 1.2], [86, 64, 1], [96, 86, 1.3], [80, 82, 1.1]], sand) + c.L('M86 88l6-6M80 88l2-7M92 89l6-2', sand, 2);
    else if (S.hurt) fx = c.L('M48 30l6-4M50 38l8-1M44 24l3-6', '#fff', 1.8) + grains(c, [[56, 50, 1.2], [60, 58, 1], [52, 44, 1]], sandD);
    else if (wi(fr) >= 0) {
      const k = wi(fr);
      fx = grains(c, [[6 + k, 78 - k * 2, 1.2], [4 + k * 2, 70 + k, 1], [10 - k, 74 + k * 2, 1.1], [26 + k, 80 - k, 1]], sandD);
    }
    return c.out(g(
      fx +
      clipY(solid(c, legs, shellD) +
      c.P(body, c.body(shell, 0.32, -0.3, 0.3, 0.2)) +
      rings, -20, 88) +
      c.shine(n(at(sp, 0.5).p[0] - 3), n(at(sp, 0.5).p[1] - 4), 6, 2, 0.35, n(at(sp, 0.5).a)) +
      head +
      mound(4, 46, S.lie ? 5 : 9) +
      grains(c, [[12, 83, 1.2], [24, 80, 1.1], [34, 84, 1]], sandD), S.hit ? 'translate(-8 0)' : 'translate(-5 0)'));
  };
  D.sand_burrower.frames = true;

  /* --- 덩치(두 발 짐승) 공용 골격: 엉덩이 중심 hip, 몸 기울기 lean, 발 목표 ft[가까운, 먼]=[x,들림], 손 목표 hn[가까운, 먼]
   *     skin.torso(c, 자세) 몸통 경로·장식(몸 좌표), skin.arm/leg 칠, skin.fist, skin.limbDeco --- */
  function brute(c, S, K) {
    const hp = S.hip;
    const W = (q) => rot(add(hp, q[0], q[1]), hp, S.lean);
    const shN = W(K.shN);
    const shF = W(K.shF);
    const hipN = W([7, 0]);
    const hipF = W([-8, -1]);
    const leg = (root, [fx, lift], col, near) => {
      const ank = [fx, GND(c, K.footH + lift)];
      const knee = ik(root, ank, K.thigh, K.shin, -1);
      return chain(c, [root, knee, ank], K.legW, col) + K.foot(c, ank, lift, near) + (K.limbDeco ? K.limbDeco(c, root, knee, ank, near) : '');
    };
    const arm = (root, hand, col, near, bend = 1) => {
      const el = ik(root, hand, K.upper, K.fore, bend);
      return chain(c, [root, el, hand], K.armW, col) + (K.limbDeco ? K.limbDeco(c, root, el, hand, near) : '') + K.fist(c, hand, ang(el, hand), near);
    };
    return { shN, shF, hipN, hipF, W, leg, arm };
  }

  /* --- 용암 덩치: 금 간 용암 바위 덩치. 쿵쿵 걷고, 두 주먹을 머리 위로 모았다 땅을 내리찍음.
   *     죽음: 금이 하얗게 달아오르며 휘청 → 무릎 꿇고 금에서 용암이 쏟아짐 → 식어 굳은 바위 더미 --- */
  RG.art._en.MOTION.magma_brute = { gait: 'stomp', bob: 0.035, tilt: 3, sway: 0.01, deathFx: 'crumble', deathTime: 1.0 };
  D.magma_brute = (fr) => {
    const c = make(3, { fine: true });
    const rock = '#5d5462';
    const cool = fr === 'die2' ? 1 : 0;
    const lava = fr === 'die0' ? '#fff0c0' : EMBER_L;
    const T = {
      walk0: { hip: [50, 64], lean: 4, ft: [[60, 0], [38, 3]], hn: [[56, 72], [50, 70]], hd: 0 },
      walk1: { hip: [50, 62], lean: 2, ft: [[52, 0], [50, 7]], hn: [[64, 70], [42, 72]], hd: -2 },
      walk2: { hip: [50, 64], lean: 4, ft: [[40, 3], [60, 0]], hn: [[72, 66], [34, 72]], hd: 0 },
      walk3: { hip: [50, 62], lean: 2, ft: [[50, 7], [52, 0]], hn: [[64, 70], [42, 72]], hd: -2 },
      // 두 주먹을 머리 위로 모아 들어 올림, 몸을 뒤로 젖힘
      aim: { hip: [50, 64], lean: -8, ft: [[62, 0], [36, 0]], hn: [[40, 13], [33, 15]], hd: -6, up: true },
      // 두 주먹으로 앞 땅을 내리찍음
      attack: { hip: [50, 66], lean: 22, ft: [[64, 0], [34, 0]], hn: [[84, 80], [78, 82]], hd: 10, slam: true },
      // 금이 하얗게 달아오르며 뒤로 휘청
      die0: { hip: [46, 64], lean: -16, ft: [[60, 6], [36, 0]], hn: [[78, 30], [24, 50]], hd: -16, hurt: true },
      // 무릎 꿇고 앞으로 고꾸라지며 금에서 용암이 쏟아짐
      die1: { hip: [46, 76], lean: 30, ft: [[66, 0], [30, 0]], hn: [[80, 74], [68, 76]], hd: 22, kneel: true },
    };
    const crack = (d, w = 2.2) => glowLine(c, d, EMBER, lava, w);
    if (fr === 'die2') {
      // 식어 굳은 바위 더미 + 검게 굳은 용암 웅덩이와 김
      const boulder = (x, y, rx, ry) => c.P(`M${x - rx} ${y + ry * 0.4}C${x - rx} ${y - ry} ${x - rx * 0.3} ${y - ry * 1.1} ${x + rx * 0.2} ${y - ry}C${x + rx} ${y - ry * 0.8} ${x + rx * 1.05} ${y} ${x + rx * 0.8} ${y + ry * 0.6}L${x - rx * 0.7} ${y + ry * 0.7}Z`, c.body(sh(rock, -0.1), 0.3, -0.4));
      return c.out(
        c.mist([[38, 54, 3.4], [44, 46, 4], [52, 40, 3.6], [64, 50, 3], [68, 42, 2.6]], '#c8c2d0', 0.45) +
        c.P('M8 88.5C10 84 22 82 34 83C44 84 52 84 64 83C76 82 90 84 92 88.5Z', c.lin([[0, '#3a2a30'], [1, '#22181e']])) +
        c.L('M20 86l6-1l4 1.5M60 85.5l7 0.5l3-1', '#9a3a20', 1.8) +
        boulder(30, 78, 13, 9) + boulder(60, 78, 15, 10) + boulder(45, 66, 12, 9) + boulder(74, 84, 7, 4) + boulder(16, 84, 6, 4) +
        c.L('M40 62l4 4l-2 4M54 74l5 3M24 76l4 2', '#2a2230', 1.8) +
        c.L('M58 71l4 3l4-2', '#a8401e', 1.8) +
        // 굴러 떨어진 머리(빛이 꺼진 눈구멍)
        c.P('M64 62C64 54 72 51 78 54C83 57 83 64 79 67C74 69 66 68 64 62Z', c.body(rock, 0.3)) + c.P('M68 58L80 57L80 61L68 62Z', '#241b2c')
      );
    }
    const S = T[fr];
    const rockF = c.body(rock, 0.3, -0.42);
    const K = {
      shN: [18, -36], shF: [-14, -38], thigh: 12, shin: 12, footH: 5, upper: 17, fore: 17,
      legW: [14, 12, 10], armW: [14, 11, 12],
      foot: (cc, a, lift, near) => cc.P(`M${n(a[0] - 8)} ${n(a[1] + 4.5)}C${n(a[0] - 8)} ${n(a[1] - 3)} ${n(a[0] + 6)} ${n(a[1] - 4)} ${n(a[0] + 10)} ${n(a[1] + 1)}L${n(a[0] + 11)} ${n(a[1] + 4.5)}Z`, cc.body(near ? rock : sh(rock, -0.25), 0.25)),
      fist: (cc, h, a, near) => g(cc.P('M-4-8C3-11 11-9 13-2C14 5 9 10 1 9C-5 8-7-4-4-8Z', cc.body(near ? rock : sh(rock, -0.25), 0.3)) + cc.L('M6-6l2 3M9-1l3 1M7 4l3 1', '#2a2230', 1.6) + crack('M1-3l3 3l-1 3', 1.4), `translate(${P2(h)}) rotate(${n(a)})`),
      limbDeco: (cc, a, b, e, near) => crack(crackAlong(mixp(a, b, 0.2), mixp(b, e, 0.5), 3, 1.6, near ? 0 : 1), near ? 1.8 : 1.4),
    };
    const B = brute(c, S, K);
    const torso = g(
      c.P('M-27-4C-32-22-23-43-3-46C17-48 31-37 30-18C29-4 22 5 8 5L-14 5C-21 4-26 1-27-4Z', rockF) +
      c.Pn('M-26-2C-20 3 10 6 26-6C22 3 12 6 4 6L-14 6C-20 5-25 2-26-2Z', '#1c1426', 0.35) +
      crack('M-14-36L-8-26L-13-16L-5-6L-8 2') + crack('M10-38L5-29L12-21L7-11', 2) + crack('M22-20L15-11L21-3', 1.8) + crack('M-24-16L-19-12', 1.6) +
      c.P('M-8-44l5-6l5 5ZM6-46l6-5l3 6Z', c.body(sh(rock, -0.1), 0.3)) +
      c.shine(-12, -34, 9, 3.5, 0.25, -30),
      `translate(${P2(S.hip)}) rotate(${S.lean})`
    );
    const hc = B.W([20, -42]);
    const head = g(
      c.P('M-9 0C-9-11 0-16 9-14C16-12 18-4 15 2C10 7-4 7-9 0Z', c.body(rock, 0.3)) +
      c.P('M-2-8L16-8.5L16-3.5L-2-3Z', '#241b2c') + c.L('M-4-11C1-13 8-13 13-11', sh(rock, -0.35), 1.8) +
      (S.hurt ? c.eye(3, -5, 2.4, false) + c.eye(10, -5.2, 2.2, false) + crack('M0 3l4-1l3 2l4-1', 1.6) : c.eye(3, -5, 2, false) + c.eye(10, -5.2, 1.8, false) + crack('M1 2.5L11 2', 1.5)),
      `translate(${P2(hc)}) rotate(${S.lean * 0.6 + S.hd})`
    );
    let fx = '';
    if (S.up) fx = c.spark(30, 6, 2, EMBER) + c.spark(50, 8, 1.6, EMBER_L) + c.spark(24, 18, 1.4, EMBER);
    if (S.slam) {
      fx += `<ellipse cx="82" cy="86" rx="16" ry="5" fill="${EMBER}" opacity=".6" stroke="none" ${c.soft()}/>` +
        [[70, 80, 2], [76, 74, 2.4], [90, 76, 2.2], [95, 82, 1.6]].map(([x, y, r]) => c.E(x, y, r, r * 1.2, c.lin([[0, '#fff1a0'], [1, EMBER]]), ' stroke-width="1.6"')).join('') +
        c.P('M66 88.5C70 85 78 84 84 85C90 84 96 86 98 88.5Z', c.lin([[0, EMBER_L], [1, EMBER]])) +
        c.P('M64 74l-4-5l5 1ZM96 72l4-5l0 6Z', sh(rock, 0.1)) + c.spark(68, 70, 1.6, EMBER_L) + c.spark(96, 66, 1.4, EMBER) +
        c.L('M62 84l-6-2M98 84l2-6', '#fff', 1.8);
    }
    if (S.hurt) fx = c.P('M64 40l6-4l1 5ZM70 50l7 0l-3 4ZM60 32l2-6l3 4Z', sh(rock, 0.05)) + c.spark(72, 36, 1.8, '#fff0c0') + c.spark(66, 46, 1.4, EMBER_L) + c.L('M80 30l6-3M82 40l7 1', '#fff', 1.8);
    let spill = '';
    if (S.kneel) {
      // 금에서 쏟아진 용암이 땅에 고임
      spill = `<ellipse cx="54" cy="87" rx="26" ry="4" fill="${EMBER}" opacity=".55" stroke="none" ${c.soft()}/>` +
        c.P('M28 88.5C32 85 48 84 60 85C70 85 80 86 82 88.5Z', c.lin([[0, EMBER_L], [1, EMBER]])) +
        glowLine(c, 'M42 62C41 70 44 76 43 85', EMBER, EMBER_L, 2.6) + glowLine(c, 'M58 66C59 72 57 78 59 85', EMBER, EMBER_L, 2.2) +
        c.spark(43, 80, 1.6, EMBER_L) + c.spark(59, 82, 1.4, EMBER_L);
    }
    return c.out(
      B.arm(B.shF, S.hn[1], sh(rock, -0.25), false) +
      B.leg(B.hipF, S.ft[1], sh(rock, -0.25), false) +
      torso +
      B.leg(B.hipN, S.ft[0], rockF, true) +
      spill +
      head +
      B.arm(B.shN, S.hn[0], rockF, true) +
      fx
    );
  };
  D.magma_brute.frames = true;

  /* --- 열풍 독수리: 불꽃 깃의 대머리 독수리. 날개 위→내려침→아래→올림 한 바퀴.
   *     aim: 날개를 높이 들고 발톱을 앞으로 / attack: 내리꽂으며 발톱으로 낚아챔
   *     죽음: 맞고 깃털이 흩날림 → 날개가 꺾여 곤두박질 → 땅에 날개를 펼친 채 쓰러짐(불꽃 깃이 식음) --- */
  RG.art._en.MOTION.thermal_vulture = { gait: 'fly', bob: 0.04, tilt: 4, hover: 0.5, deathFx: 'feathers', deathTime: 0.8 };
  D.thermal_vulture = (fr) => {
    const c = make(3, { fine: true });
    const dead = fr === 'die2';
    const body = '#6a5a58';
    const skin = '#cfb4ae';
    const T = {
      walk0: { o: [2, 6], p: 0, wn: [[-4, -18], [-12, -34], [-26, -46]], wf: [[-7, -16], [-16, -30], [-30, -38]], leg: 'tuck' },
      walk1: { o: [2, 2], p: 2, wn: [[-13, -7], [-27, -9], [-46, -5]], wf: [[-11, -9], [-25, -13], [-42, -13]], leg: 'tuck' },
      walk2: { o: [2, -2], p: 4, wn: [[-4, 13], [-11, 26], [-19, 38]], wf: [[-9, 7], [-18, 15], [-31, 20]], leg: 'tuck' },
      walk3: { o: [2, 2], p: 1, wn: [[-9, -11], [-20, -18], [-38, -7]], wf: [[-9, -13], [-20, -22], [-36, -16]], leg: 'tuck' },
      aim: { o: [0, 4], p: -14, wn: [[-8, -20], [-20, -36], [-36, -42]], wf: [[-10, -18], [-22, -31], [-38, -33]], leg: 'reach', beak: 16 },
      attack: { o: [0, 4], p: 24, wn: [[-15, -4], [-31, -2], [-49, 6]], wf: [[-13, -8], [-29, -8], [-46, -4]], leg: 'grab', beak: 20 },
      die0: { o: [-2, 0], p: -22, wn: [[2, -16], [-2, -30], [8, -40]], wf: [[-8, 8], [-14, 18], [-24, 24]], leg: 'limp', beak: 14, hurt: true },
      die1: { o: [6, -12], p: 128, wn: [[-6, -12], [-6, -26], [0, -38]], wf: [[-10, -10], [-12, -24], [-6, -34]], leg: 'limp', beak: 10, hurt: true },
      die2: { o: [-6, 21], p: 6, wn: [[-12, 6], [-23, 9], [-33, 10]], wf: [[-9, -6], [-19, -8], [-30, -6]], leg: 'tuck', beak: 6, hurt: true },
    };
    const S = T[fr];
    const C0 = [50 + S.o[0], 55 + S.o[1]];
    const Wd = (q) => rot(add(C0, q[0], q[1]), C0, S.p);
    const fire = dead ? '#8a6a5a' : EMBER;
    const fireL = dead ? '#a88a78' : '#ffd27a';
    const wingG = (sx, pts, far) => {
      const s0 = Wd(sx);
      const [e, w, t] = pts.map((q) => add(s0, q[0], q[1]));
      const W = wingD(s0, e, w, t, far ? 17 : 20, 0.62);
      const all = W.lead.concat(W.trail);
      const [fx0, fy0] = bboxFrac(all, s0);
      const [fx1, fy1] = bboxFrac(all, t);
      const grad = c.lin([[0, far ? '#4a3a3a' : '#6a504a'], [0.35, far ? '#7a3a2a' : '#a8492c'], [0.7, fire], [1, fireL]], [fx0, fy0, fx1, fy1]);
      // 덮깃(안쪽 짙은 줄) + 깃 결
      const cov = wingD(s0, e, w, mixp(w, t, 0.4), far ? 7 : 8, 0.2);
      const lines = [0.35, 0.55, 0.75, 0.9].map((k) => { const i = Math.round(k * (W.lead.length - 1)); return `M${P2(mixp(W.lead[i], W.trail[i], 0.3))}L${P2(mixp(W.lead[i], W.trail[i], 0.9))}`; }).join('');
      return c.P(W.d, grad) + c.Pn(cov.d, far ? '#3a2e30' : '#5e4a46', 0.8) + c.L(lines, far ? '#2a2026' : '#3a2a2a', 1.5, ' opacity=".7"');
    };
    // 다리: 엉덩이 → 뒤꿈치 → 발(발가락 셋)
    const hipP = Wd([2, 9]);
    let legs = '';
    const legAt = (dx, near) => {
      const r = add(hipP, dx, 0);
      let hock;
      let foot;
      let toes;
      if (S.leg === 'tuck') { hock = Wd([-5 + dx, 12]); foot = Wd([-13 + dx, 12]); toes = [S.p + 200, S.p + 170, S.p + 140]; } else if (S.leg === 'reach') { hock = Wd([10 + dx, 16]); foot = Wd([18 + dx, 20]); toes = [S.p - 20, S.p + 20, S.p + 60]; } else if (S.leg === 'grab') { hock = Wd([12 + dx, 16]); foot = Wd([24 + dx, 20]); toes = [S.p - 50, S.p - 10, S.p + 40]; } else { hock = Wd([2 + dx, 17]); foot = Wd([-2 + dx, 23]); toes = [S.p + 70, S.p + 100, S.p + 130]; }
      const col = near ? '#c9a889' : '#9a7c66';
      const toeD = toes.map((a) => { const m = pol(foot, 4, a); return cap(foot, m, 2.4, 2) + cap(m, pol(m, 3, a + (S.leg === 'grab' || S.leg === 'reach' ? 60 : 40)), 2, 1.6); }).join('');
      return solid(c, capsD([r, hock, foot], [3.4, 3, 2.6]) + toeD, col);
    };
    legs = legAt(-3, false) + legAt(2, true);
    // 꼬리 깃(불꽃 끝)
    const tb = Wd([-24, 2]);
    const tail = [-14, 0, 14].map((a, i) => { const tip = pol(tb, 16 - i * 2, 180 + a + S.p); return c.P(`M${P2(pol(tb, 3, 90 + S.p + a))}Q${P2(mixp(tb, tip, 0.6))} ${P2(tip)}Q${P2(mixp(tb, tip, 0.5))} ${P2(pol(tb, 3, -90 + S.p + a))}Z`, c.lin([[0, fire], [1, '#5a4642']], 'h')); }).join('');
    // 몸통 + 목 + 머리
    const torso = g(
      c.P('M-26 1C-22-9-8-13 6-11C16-10 22-5 24 1C20 9 10 12 0 12C-12 13-22 9-26 1Z', c.body(body, 0.3, -0.4)) +
      c.L('M-14 2C-6 5 4 5 12 3M-10 7C-2 9 6 9 12 7', sh(body, -0.3), 1.5) +
      c.shine(-6, -6, 9, 2.5, 0.3, -8),
      `translate(${P2(C0)}) rotate(${S.p})`
    );
    const nk0 = Wd([18, -4]);
    const hdP = S.hurt && fr !== 'die0' ? Wd([fr === 'die2' ? 28 : 34, 2]) : Wd([30, -18]);
    const nk1 = mixp(nk0, hdP, 0.55);
    const neck = chain(c, [nk0, add(nk1, 2, -1), hdP], [7, 5.5, 5], c.lin([[0, skin], [1, sh(skin, -0.25)]]));
    const ruff = c.cloud([[0, 0, 3.4], [3.5, -2, 2.8], [-3.5, -1, 2.8], [1.5, 2.6, 2.6]].map(([x, y, r]) => { const q = add(nk0, x, y); return [n(q[0]), n(q[1]), r]; }), '#efe9ee');
    const ha = S.p * 0.6 + (fr === 'die1' ? 40 : fr === 'die2' ? 20 : S.beak ? -6 : 4);
    const bk = S.beak || 0;
    const head = g(
      g(c.P('M8 2L17 3C16 6 12 7 9 6Z', '#cdb88c'), `rotate(${bk} 8 2)`) +
      (bk > 8 ? c.P('M8 1.5L17 1.5L12 7Z', '#5a1e22', ` transform="rotate(${bk * 0.5} 8 2)"`) : '') +
      c.P('M-6 0C-6-7 2-10 8-8C11-7 13-5 13-2L18-2C22-2 23 2 21 5C19 4 17 3 14 3L8 3C2 6-6 5-6 0Z', c.body(skin, 0.3)) +
      c.P('M12-3C15-3 19-3 21 0', 'none', ` stroke-width="1.4"`) +
      (S.hurt ? c.L('M1-5l4 3M5-5l-4 3', OL, 1.7) : c.eye(3, -3, 2.6)) + c.L('M-2-7C1-9 5-9 8-7', sh(skin, -0.35), 1.5),
      `translate(${P2(hdP)}) rotate(${n(ha)})`
    );
    let fx = '';
    if (fr === 'attack') fx = c.L('M18 34l-12-4M14 46l-14 0M20 24l-10-6', fire, 2, ' opacity=".8"') + c.spark(86, 80, 1.6, EMBER_L);
    if (fr === 'aim') fx = c.spark(14, 22, 1.6, EMBER) + c.spark(22, 12, 1.3, EMBER_L);
    const feather = (x, y, a) => g(c.P('M0-1.6C4-2.4 8-1 10 0C8 1 4 2.4 0 1.6Z', c.lin([[0, '#5a4642'], [1, fire]], 'h')) + c.L('M0 0L9 0', '#3a2a2a', 1), `translate(${x} ${y}) rotate(${a})`);
    if (fr === 'die0') fx = feather(74, 26, -30) + feather(20, 30, 40) + feather(64, 80, 160) + c.L('M80 40l6-4M82 48l7 0', '#fff', 1.8);
    if (fr === 'die1') fx = c.L('M30 10l0-8M44 8l0-8M58 12l0-8', '#ffffff', 1.8, ' opacity=".6"') + feather(76, 22, -60) + feather(24, 70, 30);
    if (fr === 'die2') fx = feather(80, 86, 10) + feather(14, 84, -170) + c.mist([[50, 70, 2], [54, 64, 2.4]], '#a8a2b0', 0.45);
    const wingFar = wingG([4, -6], S.wf, true);
    const wingNear = wingG([2, -4], S.wn, false);
    return c.out(
      fx +
      wingFar + legAt(-3, false) + tail + torso + legAt(2, true) + neck + ruff + head + wingNear
    );
  };
  D.thermal_vulture.frames = true;

  /* --- 사람꼴 공용 골격: 엉덩이 hip, 몸 기울기 lean(도), 발 ft[가까운, 먼]=[x, 들림, 발끝각], 손 hn[가까운, 먼]=[x,y]
   *     K: 마디 길이·굵기·칠, torso(몸 좌표 그림), head(머리 그림), boot(발), hand(손), 어깨·목 위치 --- */
  function human(c, S, K) {
    const hp = S.hip;
    const W = (q) => rot(add(hp, q[0], q[1]), hp, S.lean);
    const shN = W(K.shN);
    const shF = W(K.shF);
    const hipN = W([3, 0]);
    const hipF = W([-3, -1]);
    const leg = (root, f, near) => {
      const [fx, lift = 0, toe = 0] = f;
      const ank = [fx, GND(c, K.footH + lift)];
      const knee = ik(root, ank, K.thigh, K.shin, S.kneeBend || -1);
      return chain(c, [root, knee, ank], K.legW, near ? K.legFill : K.legFillF) + (K.legDeco ? K.legDeco(c, root, knee, ank, near) : '') + K.boot(c, ank, toe, near);
    };
    const arm = (root, hand, near, bend = 1) => {
      const el = ik(root, hand, K.upper, K.fore, bend);
      return { d: chain(c, [root, el, hand], K.armW, near ? K.armFill : K.armFillF) + (K.armDeco ? K.armDeco(c, root, el, hand, near) : ''), el, hand, fa: ang(el, hand) };
    };
    return { W, shN, shF, hipN, hipF, leg, arm, neck: W(K.neck) };
  }
  /** 쥔 손: 손바닥 원 + 손가락 마디 줄(자루를 감쌈). a = 아래팔 방향 */
  const fist = (c, h, a, fill, r = 3.4) => c.E(n(h[0]), n(h[1]), r, r * 0.92, fill) + c.L(`M${P2(pol(h, r * 0.75, a - 70))}L${P2(pol(h, r * 0.75, a + 70))}`, sh(fill.startsWith('#') ? fill : '#888888', -0.4), 1.2);
  /** 신발: 발목 a, 발끝 각 toe(도, +는 발끝이 아래로), 길이 len */
  const bootD = (a, toe, len = 9, h = 4.4) => {
    const p = (x, y) => P2(rot(add(a, x, y), a, toe));
    return `M${p(-3, -2.5)}C${p(-1, -4)} ${p(3, -4)} ${p(4, -1.6)}L${p(len - 1, 0)}C${p(len + 1, 0.6)} ${p(len + 1, h)} ${p(len - 1, h)}L${p(-3, h)}C${p(-4.6, h)} ${p(-4.6, -1)} ${p(-3, -2.5)}Z`;
  };

  /* --- 모래 약탈자: 모래 두건·얼굴 가리개의 잿빛 약탈자, 휘어진 칼(언월도)을 앞손에 쥠.
   *     aim: 칼을 어깨 뒤로 젖혀 듦 / attack: 앞으로 비스듬히 베어 내림(칼자국)
   *     죽음: 칼을 놓치며 휘청 → 무릎 꿇고 고꾸라짐 → 몸은 안개로 흩어지고 두건과 옷가지·칼만 남음 --- */
  RG.art._en.MOTION.dune_raider = { gait: 'walk', bob: 0.05, tilt: 3, deathFx: 'mist', deathTime: 0.9 };
  D.dune_raider = (fr) => {
    const c = make(3, { fine: true });
    const cloth = '#d2ae78';
    const clothD = sh(cloth, -0.25);
    const skin = '#8f8b9e';
    const sash = '#a3463a';
    const T = {
      walk0: { hip: [50, 62], lean: 6, ft: [[62, 0, 0], [38, 1, 22]], hn: [[66, 62], [38, 58]], bl: -14 },
      walk1: { hip: [50, 60], lean: 5, ft: [[50, 0, 0], [52, 7, 30]], hn: [[63, 63], [44, 62]], bl: -8 },
      walk2: { hip: [50, 62], lean: 6, ft: [[38, 1, 22], [62, 0, 0]], hn: [[58, 65], [58, 56]], bl: -2 },
      walk3: { hip: [50, 60], lean: 5, ft: [[52, 7, 30], [50, 0, 0]], hn: [[63, 63], [44, 62]], bl: -8 },
      // 칼을 어깨 뒤로 젖혀 듦, 몸을 뒤로 비틂
      aim: { hip: [48, 62], lean: -8, ft: [[64, 0, 0], [34, 0, 10]], hn: [[40, 26], [62, 52]], bl: 200, bend: -1 },
      // 앞으로 비스듬히 베어 내림
      attack: { hip: [52, 63], lean: 14, ft: [[68, 0, 0], [34, 2, 30]], hn: [[82, 58], [36, 54]], bl: 30, slash: true },
      // 맞고 뒤로 휘청, 칼이 손에서 빠져나감
      die0: { hip: [46, 62], lean: -18, ft: [[58, 6, -10], [38, 0, 0]], hn: [[66, 34], [30, 40]], bl: null, hurt: true },
      // 무릎 꿇고 앞으로 고꾸라짐
      die1: { hip: [46, 76], lean: 40, ft: [[60, 0, 60], [36, 0, 70]], hn: [[74, 86], [62, 86]], bl: null, kneel: true },
    };
    const blade = (h, a) => g(
      c.P('M-4-1.6L5-1.6L5 1.6L-4 1.6Z', '#5a3a2a') + c.P('M-6-2.4L-3-2.4L-3 2.4L-6 2.4Z', GOLD) +
      c.P('M4-4.6L6-4.6L6 4.6L4 4.6Z', GOLD) +
      c.P('M6-2C14-3 22-6 28-12C27-4 22 2 14 3.4L6 2.4Z', c.lin([[0, '#f4f2f8'], [0.6, '#b8b8c8'], [1, '#7a7a8e']])) +
      c.L('M8-0.6C15-1.4 21-4 26-9', '#ffffff', 1.2, ' opacity=".8"'),
      `translate(${P2(h)}) rotate(${n(a)})`
    );
    if (fr === 'die2') {
      // 안개로 흩어진 뒤 남은 두건·옷가지와 칼
      return c.out(
        c.mist([[40, 66, 4], [48, 58, 5], [56, 50, 4.4], [62, 42, 3.6], [52, 70, 3.4]], MISTC, 0.55) +
        c.P('M24 88.5C26 80 34 76 44 77C54 76 62 80 66 88.5Z', c.lin([[0, cloth], [1, clothD]])) +
        c.L('M32 86C36 81 42 80 46 82M50 85C54 81 58 81 62 84', clothD, 1.6) +
        c.P('M44 79C46 72 54 70 60 74C64 77 64 82 60 84C54 85 46 84 44 79Z', c.body(cloth, 0.3)) + c.P('M52 74L62 75L61 79L52 79Z', '#2a2236') +
        c.P('M26 84C22 82 16 84 12 88.5L22 88.5Z', sash) +
        blade([62, 86], -6)
      );
    }
    const S = T[fr];
    const K = {
      shN: [5, -24], shF: [-5, -25], neck: [3, -27], thigh: 13, shin: 13, footH: 4.4, upper: 11, fore: 11,
      legW: [9, 7.5, 6], armW: [6.4, 5.4, 4.6],
      legFill: c.lin([[0, sh(cloth, -0.05)], [1, clothD]]), legFillF: c.lin([[0, clothD], [1, sh(cloth, -0.42)]]),
      armFill: c.lin([[0, skin], [1, sh(skin, -0.25)]]), armFillF: sh(skin, -0.32),
      legDeco: (cc, r, k, a, near) => cc.L(`M${P2(mixp(k, a, 0.45))}l${n((a[0] - k[0]) * 0.08 - 2.6)} 0.6M${P2(mixp(k, a, 0.7))}l-2.6 0.6`, near ? '#efe0c0' : '#a89270', 1.6),
      armDeco: (cc, r, e, h, near) => cc.L(`M${P2(mixp(e, h, 0.4))}L${P2(pol(mixp(e, h, 0.4), 2.6, ang(e, h) + 90))}M${P2(mixp(e, h, 0.65))}L${P2(pol(mixp(e, h, 0.65), 2.4, ang(e, h) + 90))}`, near ? '#e8dcc4' : '#9a907e', 1.4),
      boot: (cc, a, toe, near) => cc.P(bootD(a, toe, 8.5, 4.2), near ? '#5a4640' : '#3e3030'),
    };
    const B = human(c, S, K);
    const torso = g(
      // 망토 자락(뒤로 날림)
      c.P(`M-6-24C-14-20-20-12-${22 + wi(fr) % 2 * 2}-2L-14-4C-12-12-8-18-4-20Z`, c.lin([[0, cloth], [1, clothD]])) +
      c.P('M-7-26C-4-30 6-30 9-25L10-4L-8-4Z', c.body('#8a8698', 0.3)) +
      c.P('M-8-24L10-12L10-7L-8-19Z', sash) +
      c.P('M-9-6L11-6L13 8L4 5L0 10L-5 5L-11 8Z', c.lin([[0, sh(cloth, -0.1)], [1, sh(cloth, -0.35)]])) +
      c.P('M-9-7L11-7L11-3L-9-3Z', '#4a3632') + c.P('M0-7.6L4-7.6L4-2.4L0-2.4Z', GOLD) +
      c.Pn('M4-26C8-24 10-18 10-8L6-8C7-16 6-22 4-26Z', '#1c1426', 0.25),
      `translate(${P2(S.hip)}) rotate(${S.lean})`
    );
    const hd = S.hurt ? -24 : S.kneel ? 30 : S.slash ? 8 : 0;
    const head = g(
      // 두건 꼬리(바람에 날림)
      c.P(`M-8-4C-16-2-22-6-28-${4 - wi(fr) % 2 * 4}C-22 0-20 4-24 8C-16 5-10 4-6 2Z`, c.lin([[0, cloth], [1, clothD]])) +
      c.P('M-8-8C-6-17 6-19 11-12C14-7 14 0 11 5L-5 6C-9 2-10-3-8-8Z', c.body(cloth, 0.35)) +
      c.P('M2-7L13-7.6L13.6-2.4L2-2Z', '#241b2c') +
      (S.hurt || S.kneel ? c.L('M5-6l3 2.6M8-6l-3 2.6', '#fff', 1.4) : c.eye(6, -4.8, 2, false) + c.eye(11, -5, 1.8, false)) +
      c.P('M1-2L13.6-2.4C13 3 9 6 3 6L0 6Z', sh(cloth, -0.12)) + c.L('M3 1C6 2 9 1.6 12 0.6', clothD, 1.2) +
      c.shine(-3, -12, 4, 1.8, 0.4),
      `translate(${P2(add(B.neck, 1, -8))}) rotate(${S.lean * 0.5 + hd})`
    );
    const aF = B.arm(B.shF, S.hn[1], false);
    const aN = B.arm(B.shN, S.hn[0], true, S.bend || 1);
    let wpn = '';
    let fx = '';
    if (S.bl != null) wpn = blade(aN.hand, S.bl);
    if (S.slash) fx = c.P('M46 14C70 12 90 30 92 56C86 40 74 26 52 22Z', '#ffffff', ' stroke="none" opacity=".55"') + c.L('M52 18C72 18 88 34 90 52', '#ffffff', 1.6, ' opacity=".9"');
    if (S.hurt) fx = blade([82, 18], 130) + c.L('M70 22l6-4M72 30l7-1', '#fff', 1.8);
    if (S.kneel) fx = blade([62, 87], 4) + c.mist([[40, 50, 2.6], [34, 44, 3]], MISTC, 0.5);
    return c.out(
      aF.d + fist(c, aF.hand, aF.fa, sh(skin, -0.32)) +
      B.leg(B.hipF, S.ft[1], false) +
      torso +
      B.leg(B.hipN, S.ft[0], true) +
      head +
      (S.bl != null && S.bl > 90 ? wpn : '') +
      aN.d + fist(c, aN.hand, aN.fa, skin) +
      (S.bl != null && S.bl <= 90 ? wpn + fist(c, aN.hand, aN.fa, skin) : '') +
      fx
    );
  };
  D.dune_raider.frames = true;

  /* --- 협곡 투석병: 머리가 큰 작은 잿빛 약탈자. 앞손에 끈 투석구, 허리에 돌 주머니.
   *     aim: 투석구를 머리 위로 빙빙 돌림 / attack: 팔을 앞으로 채며 끈 하나를 놓아 돌이 날아감
   *     죽음: 머리를 맞고 젖혀짐 → 벌렁 나자빠짐 → 큰대자로 누운 채 주머니의 돌이 쏟아짐 --- */
  RG.art._en.MOTION.canyon_slinger = { gait: 'trot', bob: 0.06, tilt: 4, deathFx: 'crumble', deathTime: 0.7 };
  D.canyon_slinger = (fr) => {
    const c = make(3, { fine: true });
    const cloth = '#c9a272';
    const clothD = sh(cloth, -0.28);
    const skin = '#8f8b9e';
    const band = '#a3463a';
    const rope = '#5e3a22';
    const T = {
      walk0: { hip: [50, 66], lean: 4, ft: [[59, 0, 0], [41, 1, 24]], hn: [[64, 60], [40, 60]], sl: 'hang', sw: 14 },
      walk1: { hip: [50, 64], lean: 3, ft: [[50, 0, 0], [52, 6, 30]], hn: [[63, 61], [44, 64]], sl: 'hang', sw: 2 },
      walk2: { hip: [50, 66], lean: 4, ft: [[41, 1, 24], [59, 0, 0]], hn: [[60, 63], [56, 60]], sl: 'hang', sw: -12 },
      walk3: { hip: [50, 64], lean: 3, ft: [[52, 6, 30], [50, 0, 0]], hn: [[63, 61], [44, 64]], sl: 'hang', sw: 2 },
      // 투석구를 머리 위로 돌림(몸을 뒤로)
      aim: { hip: [48, 66], lean: -8, ft: [[60, 0, 0], [36, 0, 10]], hn: [[52, 20], [62, 56]], sl: 'whirl' },
      // 팔을 앞으로 채며 돌을 놓음
      attack: { hip: [52, 66], lean: 12, ft: [[64, 0, 0], [38, 3, 34]], hn: [[78, 44], [36, 60]], sl: 'throw' },
      die0: { hip: [46, 66], lean: -20, ft: [[56, 7, -10], [40, 0, 0]], hn: [[62, 40], [30, 46]], sl: 'drop', hurt: true },
    };
    const stone = (p, r = 3.6) => c.E(n(p[0]), n(p[1]), r, r * 0.88, c.body('#b8aca4', 0.35)) + c.En(n(p[0] - r * 0.3), n(p[1] - r * 0.3), r * 0.35, r * 0.25, '#ffffff', 0.4);
    const pouch = (x, y) => c.P(`M${x - 4} ${y - 2}C${x - 5} ${y + 4} ${x + 5} ${y + 4} ${x + 4} ${y - 2}Z`, c.body('#8a6a48', 0.3)) + c.L(`M${x - 4} ${y - 2}L${x + 4} ${y - 2}`, '#5a3e28', 1.6);
    const headG = (pos, a, hurt, flap = 0) => g(
      c.P(`M-9-2C-15-${2 + flap * 3} -20 0 -24-${flap * 3}C-20 3-18 6-20 9C-14 6-10 4-8 2Z`, band) +
      c.E(0, -4, 11, 10.4, c.body(skin, 0.35)) +
      c.P('M-11-6C-9-17 7-18 11-8C3-11-4-10-11-6Z', band) + c.L('M-10-7C-3-10 4-11 11-8', sh(band, -0.3), 1.4) +
      c.P('M1-6L12-6L12-0.6L1-0.6Z', '#2b2236') +
      (hurt ? c.L('M4-5l3 3M7-5l-3 3', '#fff', 1.4) : c.eye(5, -3.3, 2.1, false) + c.eye(10, -3.3, 1.8, false)) +
      c.L('M4 3q3 1.6 6 0', OL, 1.5) + c.shine(-5, -8, 4, 2, 0.35),
      `translate(${P2(pos)}) rotate(${n(a)})`
    );
    if (fr === 'die1' || fr === 'die2') {
      // 벌렁 나자빠짐(die1: 다리가 들림) → 큰대자로 누움, 돌이 쏟아짐(die2)
      const up = fr === 'die1';
      const hb = up ? [30, 80] : [22, 84];
      const body = c.P(up ? 'M34 72C38 66 52 66 56 72L58 84L32 84Z' : 'M30 80C34 76 54 76 58 80L58 88.5L30 88.5Z', c.lin([[0, cloth], [1, clothD]]));
      const legsD = up
        ? chain(c, [[54, 78], [64, 64], [72, 60]], [7, 6, 5], clothD) + c.P(bootD([72, 60], -100, 7, 4), '#4a3a36') + chain(c, [[52, 80], [68, 72], [78, 74]], [7, 6, 5], cloth) + c.P(bootD([78, 74], -60, 7, 4), '#5a4640')
        : chain(c, [[56, 86], [68, 84], [80, 86]], [7, 6, 5], clothD) + c.P(bootD([80, 85.6], -90, 7, 4), '#4a3a36') + chain(c, [[56, 84], [66, 78], [78, 80]], [7, 6, 5], cloth) + c.P(bootD([78, 79.6], -80, 7, 4), '#5a4640');
      return c.out(
        legsD + body +
        chain(c, [[36, 76], [30, 66], [26, 58]], [5.4, 4.6, 4], skin) + fist(c, [26, 58], -110, skin) +
        headG([hb[0], hb[1] - 6], up ? -72 : -86, true) +
        (up ? c.L('M20 56l-4-4M26 52l0-6M34 54l3-5', '#fff', 1.6) + stone([66, 50], 3) : pouch(50, 82) + stone([62, 86], 3) + stone([70, 87], 2.6) + stone([42, 87.4], 2.4) + c.L('M28 62C34 68 40 70 46 72', rope, 2) + c.P('M18 60C12 58 8 62 6 66C12 64 16 64 18 62Z', band))
      );
    }
    const S = T[fr];
    const K = {
      shN: [4, -18], shF: [-4, -19], neck: [2, -21], thigh: 10, shin: 10, footH: 4.2, upper: 9, fore: 9,
      legW: [8, 6.5, 5.4], armW: [5.6, 4.8, 4.2],
      legFill: c.lin([[0, sh(cloth, -0.08)], [1, clothD]]), legFillF: c.lin([[0, clothD], [1, sh(cloth, -0.45)]]),
      armFill: c.lin([[0, skin], [1, sh(skin, -0.25)]]), armFillF: sh(skin, -0.32),
      boot: (cc, a, toe, near) => cc.P(bootD(a, toe, 7.5, 4), near ? '#5a4640' : '#3e3030'),
    };
    const B = human(c, S, K);
    const torso = g(
      c.P('M-7-20C-4-23 5-23 8-19L9-2L-8-2Z', c.body('#8a8698', 0.3)) +
      c.P('M-9-18C-4-23 6-23 10-17L9 4L4 1L0 6L-4 1L-9 4Z', c.lin([[0, cloth], [1, clothD]])) +
      c.P('M-9-4L9-4L9-1L-9-1Z', '#4a3632') + pouch(-6, 2) +
      c.Pn('M4-20C8-18 9-12 9-4L6-4C6-12 6-16 4-20Z', '#1c1426', 0.25),
      `translate(${P2(S.hip)}) rotate(${S.lean})`
    );
    const hd = S.hurt ? -30 : S.sl === 'throw' ? 8 : 0;
    const head = headG(add(B.neck, 1, -7), S.lean * 0.5 + hd, S.hurt, wi(fr) % 2);
    const aF = B.arm(B.shF, S.hn[1], false);
    const aN = B.arm(B.shN, S.hn[0], true, S.sl === 'whirl' ? -1 : 1);
    const h = aN.hand;
    let sling = '';
    let fx = '';
    if (S.sl === 'hang') {
      const pp = pol(h, 15, 90 + S.sw);
      sling = c.L(`M${P2(h)}Q${P2(add(mixp(h, pp, 0.5), -2.4, 0))} ${P2(pp)}M${P2(h)}Q${P2(add(mixp(h, pp, 0.5), 2.4, 0))} ${P2(pp)}`, rope, 2) + stone(add(pp, 0, 2), 3.2) + c.P(`M${P2(add(pp, -3.6, 0))}C${P2(add(pp, -3.6, 5))} ${P2(add(pp, 3.6, 5))} ${P2(add(pp, 3.6, 0))}Z`, '#8a6a48');
    } else if (S.sl === 'whirl') {
      const st = [h[0] + 22, h[1] - 9];
      sling = `<ellipse cx="${n(h[0] + 2)}" cy="${n(h[1] - 6)}" rx="23" ry="7" fill="none" stroke="#ffffff" stroke-width="2" stroke-dasharray="5 4" opacity=".7"/>` +
        c.L(`M${P2(h)}L${P2(st)}`, rope, 1.8) + c.L(`M${P2(h)}L${P2(add(st, -1, 3))}`, rope, 1.8) + stone(st, 3.6) +
        c.L(`M${n(h[0] - 18)} ${n(h[1] - 14)}q-4 4-2 9M${n(h[0] - 12)} ${n(h[1] - 13)}q-3 3-1 7`, '#ffffff', 1.4, ' opacity=".7"');
    } else if (S.sl === 'throw') {
      const pp = pol(h, 15, -150);
      sling = c.L(`M${P2(h)}Q${P2(add(mixp(h, pp, 0.5), 0, -3))} ${P2(pp)}`, rope, 1.8) + c.L(`M${P2(h)}L${P2(pol(h, 12, -120))}`, rope, 1.8) + c.P(`M${P2(add(pp, -3, -1))}C${P2(add(pp, -3, 3))} ${P2(add(pp, 3, 3))} ${P2(add(pp, 3, -1))}Z`, '#8a6a48');
      fx = c.L('M70 30L80 31M72 36L82 35M74 25L82 27', '#ffffff', 1.8, ' opacity=".8"') + stone([92, 30], 3.8);
    } else if (S.sl === 'drop') {
      sling = c.L(`M${P2(h)}Q${n(h[0] + 8)} ${n(h[1] + 6)} ${n(h[0] + 12)} ${n(h[1] + 16)}`, rope, 1.8) + stone([80, 70], 3) + c.L('M60 18l4-6M66 22l6-3M56 14l0-6', '#fff', 1.6);
    }
    return c.out(
      aF.d + fist(c, aF.hand, aF.fa, sh(skin, -0.32)) +
      B.leg(B.hipF, S.ft[1], false) +
      torso +
      B.leg(B.hipN, S.ft[0], true) +
      head +
      (S.sl === 'whirl' ? sling : '') +
      aN.d + fist(c, h, aN.fa, skin) +
      (S.sl !== 'whirl' ? sling + fist(c, h, aN.fa, skin) : '') +
      fx
    );
  };
  D.canyon_slinger.frames = true;

  /* --- 흑요석 딱정벌레: 검게 반짝이는 흑요석 등껍질의 뿔 딱정벌레. 세 다리씩 번갈아(삼각 걸음).
   *     aim: 앞을 들고 뿔을 치켜듦 / attack: 뿔로 들이받음(불똥)
   *     죽음: 껍질에 금이 가며 번쩍 → 유리 조각으로 산산이 깨짐 → 날카로운 흑요석 조각 더미와 오그라든 다리 --- */
  RG.art._en.MOTION.obsidian_beetle = { gait: 'crawl', bob: 0.012, tilt: 1.5, sway: 0.01, deathFx: 'shatter', deathTime: 0.8 };
  D.obsidian_beetle = (fr) => {
    const c = make(3, { fine: true });
    const obs = '#2e2838';
    const legC = '#4a4058';
    const legD = '#221c2c';
    // o 몸 이동, p 몸 기울기(뒤끝 기준), st 걸음 위상(삼각: A=앞가까운·뒤가까운·가운데먼 / B=나머지), front 앞다리 들기
    const T = {
      walk0: { o: [0, 0], p: 0, A: [5, 0], B: [-5, 0] },
      walk1: { o: [0, -1], p: -1, A: [0, 0], B: [0, 5] },
      walk2: { o: [0, 0], p: 0, A: [-5, 0], B: [5, 0] },
      walk3: { o: [0, -1], p: -1, A: [0, 5], B: [0, 0] },
      aim: { o: [-4, -2], p: -16, A: [2, 0], B: [-2, 0], up: true, md: 30 },
      attack: { o: [-4, 2], p: 9, A: [-6, 0], B: [-4, 0], ram: true, md: 4 },
      die0: { o: [-4, 0], p: -7, A: [6, 3], B: [-6, 3], hurt: true, md: 24 },
    };
    if (fr === 'die1' || fr === 'die2') {
      // 깨진 흑요석 조각: [중심x, 중심y, 크기, 각도, 날아감]
      const fly = fr === 'die1';
      const shards = fly
        ? [[30, 40, 11, -30], [48, 30, 12, 10], [66, 38, 10, 40], [22, 58, 9, -70], [76, 56, 9, 70], [52, 52, 10, 0], [40, 22, 6, -20], [62, 20, 6, 30]]
        : [[30, 82, 11, -10], [46, 79, 13, 14], [62, 82, 12, -20], [76, 84, 8, 30], [18, 85, 7, 50], [54, 85, 7, -40], [38, 86, 6, 70]];
      const shard = ([x, y, r, a], i) => g(c.P(`M0-${r}L${r * 0.55} ${-r * 0.1}L${r * 0.2} ${r * 0.8}L${-r * 0.6} ${r * 0.3}Z`, c.lin([[0, '#6a5a82'], [0.5, obs], [1, '#14101c']], 'd')) +
        c.Pn(`M-${r * 0.1}-${r * 0.7}L${r * 0.3} ${-r * 0.1}L${-r * 0.2} ${r * 0.1}Z`, '#e4dcff', 0.6), `translate(${x} ${y}) rotate(${a + (i % 2 ? 10 : -10)})`);
      const curled = (x, near) => chain(c, [[x, 84], [x + 4, 80], [x + 8, 83]], [4, 3.4, 2.6], near ? legC : legD);
      return c.out(
        (fly ? `<ellipse cx="50" cy="48" rx="26" ry="20" fill="${EMBER}" opacity=".22" stroke="none" ${c.soft()}/>` + c.L('M50 48L18 22M50 48L84 24M50 48L90 60M50 48L10 64M50 48L50 12', '#ffffff', 1.6, ' opacity=".5"') : `<ellipse cx="48" cy="86" rx="30" ry="4" fill="${EMBER}" opacity=".35" stroke="none" ${c.soft()}/>`) +
        (fly ? c.P('M30 78C34 70 60 68 70 76L72 84L28 84Z', c.body('#3c3446', 0.3)) + curled(32, false) + curled(46, true) + curled(60, true) + c.P('M70 72C76 70 82 74 82 80L72 82Z', c.body('#3c3446', 0.4)) : curled(26, false) + curled(54, true) + curled(66, false)) +
        shards.map(shard).join('') +
        (fly ? c.spark(30, 30, 1.6, EMBER_L) + c.spark(70, 28, 1.4, EMBER) : c.spark(46, 84, 1.2, EMBER) + c.mist([[48, 72, 2.4], [52, 66, 2]], '#a8a2b0', 0.4))
      );
    }
    const S = T[fr];
    const pivot = [20, 66];
    const Wb = (q) => rot(add(q, S.o[0], S.o[1]), add(pivot, S.o[0], S.o[1]), S.p);
    // 다리: 몸 밑 뿌리 → 무릎(바깥 위로 꺾임) → 발끝
    const leg = (rx, base, ph, near, lifted) => {
      const root = Wb([rx, near ? 66 : 63]);
      const fx = rx + base + S.o[0] + ph[0];
      const lift = lifted || ph[1];
      const tip = [fx, GND(c, 1.4 + lift)];
      const kneeUp = ik(root, tip, 10, 13, base >= 0 ? -1 : 1);
      const hook = pol(tip, 3.4, base >= 0 ? 20 : 160);
      return chain(c, [root, kneeUp, tip, hook], [5, 4.2, 3, 2], near ? legC : legD) + c.L(`M${P2(mixp(kneeUp, tip, 0.35))}l2-1.4M${P2(mixp(kneeUp, tip, 0.6))}l2-1.4`, near ? '#6a5a80' : '#3a3046', 1.2);
    };
    const up = (S.up ? 1 : 0);
    const farLegs = leg(30, -14, S.B, false) + leg(52, 3, S.A, false) + leg(70, 15, S.B, false, up * 10);
    const nearLegs = leg(26, -15, S.A, true) + leg(48, 2, S.B, true) + leg(66, 16, S.A, true, up * 12);
    // 머리·앞가슴·뿔·큰턱 (몸 좌표 → Wb)
    const hp = Wb([80, 58]);
    const hdA = S.p + (S.up ? -14 : S.ram ? 8 : 0);
    const md = S.md != null ? S.md : 10;
    const head = g(
      g(c.P('M0 0C4-2 9-1 12 2C9 1 5 2 2 3Z', '#4a4058'), `translate(9 4) rotate(${-md * 0.3})`) +
      g(c.P('M0 0C4 2 9 1 12-2C9-1 5-2 2-3Z', '#4a4058'), `translate(9 6) rotate(${md * 0.3})`) +
      c.P('M-8-6C-2-12 8-10 12-2C13 3 10 8 4 9C-2 10-8 6-8-6Z', c.body('#3c3446', 0.4)) +
      c.P('M2-6C4-14 8-20 14-25C14-17 12-10 10-3Z', c.lin([[0, '#7a6a92'], [1, '#2a2434']])) +
      c.Pn('M5-8C7-14 10-18 13-22C12-15 10-10 8-6Z', '#e4dcff', 0.5) +
      (S.hurt ? c.L('M2 0l3 3M5 0l-3 3', '#fff', 1.6) : c.eye(4, 2, 2.6)),
      `translate(${P2(hp)}) rotate(${n(hdA)})`
    );
    const shell = g(
      `<path d="M18 68C30 74 70 74 80 68" fill="none" stroke="${EMBER}" stroke-width="5" opacity=".6" ${c.soft()}/>` +
      c.P('M14 66C14 44 30 30 50 30C68 30 82 42 82 60L82 66C70 72 26 72 14 66Z', c.body(obs, 0.5, -0.3)) +
      // 깎인 면(빛은 왼쪽 위): 밝은 면 · 어두운 면
      c.Pn('M20 54L28 38L44 32L36 48Z', '#ddd2ff', 0.55) + c.Pn('M50 33L64 36L56 46Z', '#ddd2ff', 0.32) + c.Pn('M72 48L79 57L72 62Z', '#ddd2ff', 0.2) +
      c.Pn('M56 50L80 58L80 66C70 70 60 71 52 71Z', '#0c0a12', 0.45) +
      c.L('M48 31C48 44 50 56 52 70', '#6a5a80', 2) +
      c.L('M14 66C26 72 70 72 82 66', EMBER, 1.6) +
      (S.hurt ? glowLine(c, 'M44 34L40 44L48 50L42 60', '#ffffff', '#fff6e0', 1.8) + glowLine(c, 'M62 38L58 48L66 54', '#ffffff', '#fff6e0', 1.6) : ''),
      `translate(${S.o[0]} ${S.o[1]}) rotate(${S.p} ${pivot[0]} ${pivot[1]})`
    );
    let fx = '';
    if (S.ram) fx = c.spark(96, 50, 2, EMBER_L) + c.spark(92, 42, 1.5, EMBER) + c.L('M90 36l6-5M94 54l6 2M88 60l4 4', '#fff', 1.8);
    if (S.hurt) fx = c.L('M30 20l-4-6M46 14l0-7M62 18l4-6', '#fff', 1.8);
    return c.out(fx + farLegs + head + shell + nearLegs);
  };
  D.obsidian_beetle.frames = true;

  /* --- 불꽃 정령: 눈 두 개가 있는 떠다니는 불꽃. 혀(불길)가 흔들리며 눌렸다 늘어남.
   *     aim: 뒤로 젖히며 숨을 들이켜 크게 부풂 / attack: 앞으로 쏠리며 입에서 불덩이를 뿜음
   *     죽음: 맞고 옆으로 꺾이며 쪼그라듦 → 가늘게 꺼져 가며 연기 → 불씨 몇 개와 연기 한 줄 --- */
  RG.art._en.MOTION.flame_spirit = { gait: 'float', bob: 0.05, squash: 0.08, hover: 0.4, deathFx: 'ash', deathTime: 0.7 };
  D.flame_spirit = (fr) => {
    const c = make(3, { fine: true });
    // 불꽃 윤곽: 바닥 중심 (cx, by), 반폭 w, 키 h, 기울기 lean, 혀 위상 ph
    const flame = (cx, by, w, h, lean, ph, sc = 1) => {
      const tip = (k, hh, ww) => [cx + lean * hh / h + Math.sin(ph + k * 2.1) * 3 * sc + ww, by - hh];
      const t1 = tip(0, h, 0);
      const t2 = tip(1, h * 0.72, -w * 0.62);
      const t3 = tip(2, h * 0.78, w * 0.6);
      const t4 = tip(3, h * 0.5, -w * 0.95);
      return `M${n(cx)} ${n(by)}C${n(cx - w * 1.1)} ${n(by)} ${n(cx - w * 1.25)} ${n(by - h * 0.32)} ${P2(t4)}` +
        `C${n(cx - w * 0.9)} ${n(by - h * 0.45)} ${n(cx - w * 0.75)} ${n(by - h * 0.5)} ${P2(t2)}` +
        `C${n(cx - w * 0.3)} ${n(by - h * 0.55)} ${n(cx - w * 0.15)} ${n(by - h * 0.6)} ${P2(t1)}` +
        `C${n(cx + w * 0.25)} ${n(by - h * 0.62)} ${n(cx + w * 0.35)} ${n(by - h * 0.55)} ${P2(t3)}` +
        `C${n(cx + w * 0.95)} ${n(by - h * 0.5)} ${n(cx + w * 1.2)} ${n(by - h * 0.25)} ${n(cx + w * 0.9)} ${n(by - h * 0.08)}` +
        `C${n(cx + w * 0.6)} ${n(by)} ${n(cx + w * 0.3)} ${n(by)} ${n(cx)} ${n(by)}Z`;
    };
    const T = {
      walk0: { cx: 52, by: 84, w: 21, h: 66, l: -6, ph: 0 },
      walk1: { cx: 52, by: 82, w: 23, h: 60, l: -10, ph: 1.6 },
      walk2: { cx: 52, by: 84, w: 20, h: 70, l: -4, ph: 3.1 },
      walk3: { cx: 52, by: 83, w: 22, h: 62, l: -9, ph: 4.7 },
      aim: { cx: 48, by: 84, w: 25, h: 76, l: -22, ph: 0.8, puff: true },
      attack: { cx: 46, by: 82, w: 22, h: 54, l: 26, ph: 2.2, blast: true },
      die0: { cx: 50, by: 84, w: 18, h: 50, l: -26, ph: 3.6, hurt: true },
      die1: { cx: 50, by: 86, w: 12, h: 30, l: 4, ph: 5, gut: true },
    };
    if (fr === 'die2') {
      return c.out(
        c.L('M50 84C46 76 54 70 50 62C46 54 54 48 50 40', '#9a94a4', 3, ' opacity=".55"') +
        c.L('M42 86C40 80 44 76 42 70', '#9a94a4', 2.2, ' opacity=".4"') +
        c.P('M38 88.5C40 85 46 84 50 85C56 84 62 85 64 88.5Z', c.lin([[0, '#5a5060'], [1, '#2e2834']])) +
        c.spark(44, 85, 1.4, EMBER) + c.spark(55, 84, 1.6, EMBER_L) + c.spark(50, 78, 1, EMBER) + c.spark(60, 72, 0.9, EMBER_L)
      );
    }
    const S = T[fr];
    const outer = flame(S.cx, S.by, S.w, S.h, S.l, S.ph);
    const inner = flame(S.cx + S.l * 0.08, S.by - 4, S.w * 0.58, S.h * 0.66, S.l * 0.7, S.ph + 0.8, 0.6);
    const core = flame(S.cx + S.l * 0.05, S.by - 6, S.w * 0.3, S.h * 0.36, S.l * 0.4, S.ph + 1.5, 0.3);
    const ey = S.by - S.h * 0.32;
    const ex = S.cx + S.l * 0.3 + 4;
    let face;
    if (S.hurt) face = c.L(`M${ex - 4} ${ey - 3}l4 3l-4 3M${ex + 12} ${ey - 3}l-4 3l4 3`, '#3a2230', 2);
    else if (S.gut) face = c.E(ex, ey + 2, 2, 1.4, '#3a2230') + c.E(ex + 7, ey + 2, 2, 1.4, '#3a2230');
    else face = c.E(ex, ey, 4.6, 5.6, '#3a2230') + c.E(ex + 11, ey - 0.5, 4.2, 5.2, '#3a2230') + c.eye(ex + 0.5, ey, 2.4, false) + c.eye(ex + 11.5, ey - 0.5, 2.2, false);
    if (S.puff) face += c.P(`M${ex + 2} ${ey + 8}q4 2.4 8 0q-4 3-8 0Z`, '#3a2230');
    if (S.blast) face += c.E(ex + 8, ey + 9, 3.6, 3, '#3a2230');
    let fx = '';
    if (S.blast) fx = `<ellipse cx="84" cy="${n(ey + 8)}" rx="12" ry="8" fill="${EMBER}" opacity=".6" stroke="none" ${c.soft()}/>` + c.P(`M${ex + 10} ${n(ey + 6)}C76 ${n(ey)} 88 ${n(ey + 2)} 96 ${n(ey + 8)}C88 ${n(ey + 14)} 76 ${n(ey + 16)} ${ex + 10} ${n(ey + 12)}Z`, c.lin([[0, '#fff3b0'], [0.5, '#ffb35a'], [1, EMBER]], 'h')) + c.spark(92, ey + 2, 1.4, EMBER_L);
    if (S.puff) fx = c.spark(84, 40, 1.4, EMBER_L) + c.spark(78, 30, 1.2, EMBER) + c.L('M90 50l-6 0M88 42l-5 2M88 58l-5-2', EMBER_L, 1.6, ' opacity=".8"');
    if (S.hurt) fx = c.mist([[70, 28, 3], [76, 22, 2.4]], '#9a94a4', 0.6) + c.L('M78 44l6-3M80 52l7 0', '#fff', 1.8);
    if (S.gut) fx = c.L('M50 54C46 46 54 40 50 30C47 24 52 18 50 12', '#9a94a4', 3, ' opacity=".55"') + c.spark(40, 70, 1.2, EMBER) + c.spark(62, 66, 1, EMBER_L);
    const glowR = S.gut ? 14 : S.puff ? 34 : 28;
    // 흩날리는 불씨 (걷기 위상에 따라 위로)
    const k = Math.max(0, wi(fr));
    const embers = S.gut || S.hurt ? '' : c.spark(n(S.cx - 14 + k * 2), n(S.by - S.h - 4 - k * 2), 1.4, EMBER_L) + c.spark(n(S.cx + 16 - k), n(S.by - S.h * 0.8 - k * 3), 1.2, EMBER);
    return c.out(
      `<ellipse cx="${S.cx}" cy="${n(S.by - S.h * 0.35)}" rx="${glowR}" ry="${glowR}" fill="${EMBER}" opacity=".4" stroke="none" ${c.soft()}/>` +
      embers + fx +
      c.P(outer, c.lin([[0, '#ffb35a'], [0.5, EMBER], [1, '#c23a26']])) +
      c.P(inner, c.lin([[0, '#ffe08a'], [1, '#ffab3a']]), ' stroke="none"') +
      c.P(core, c.lin([[0, '#ffffff'], [1, '#fff3b0']]), ' stroke="none"') +
      face
    );
  };
  D.flame_spirit.frames = true;

  /* --- 👑 용암 벌레왕: 마디마다 용암이 흐르는 거대한 벌레. 용암 웅덩이에서 상체만 솟아 물결치며 나아감.
   *     aim: 높이 치솟아 턱을 쩍 벌림(용암이 흘러내림) / attack: 앞으로 내리꽂으며 터져 나옴(분출·돌 파편) — 잠수 후 솟구침 자세 겸용
   *     죽음: 금이 하얗게 달아올라 몸부림 → 쿵 하고 옆으로 쓰러지며 용암이 쏟아짐 → 식어 굳은 돌 마디와 김 --- */
  RG.art._en.MOTION.pyre_worm = { gait: 'slither', bob: 0.02, tilt: 1.5, sway: 0.015, deathFx: 'crumble', deathTime: 1.2 };
  D.pyre_worm = (fr) => {
    const c = make(3, { fine: true });
    const rock = '#4e4552';
    const lava = EMBER;
    const T = {
      walk0: { sp: [[22, 96], [16, 74], [22, 52], [38, 38], [54, 34]], hd: 10, jaw: 8, ph: 0 },
      walk1: { sp: [[22, 96], [18, 76], [26, 56], [42, 42], [57, 39]], hd: 18, jaw: 5, ph: 0.25 },
      walk2: { sp: [[22, 96], [15, 72], [20, 50], [35, 35], [51, 30]], hd: 4, jaw: 10, ph: 0.5 },
      walk3: { sp: [[22, 96], [17, 75], [24, 54], [40, 40], [56, 36]], hd: 14, jaw: 6, ph: 0.75 },
      aim: { sp: [[22, 96], [14, 74], [14, 52], [22, 38], [34, 30]], hd: -24, jaw: 34, ph: 0.1, roar: true },
      attack: { sp: [[22, 96], [24, 74], [38, 60], [54, 56], [66, 58]], hd: 34, jaw: 40, ph: 0.4, erupt: true },
      die0: { sp: [[22, 96], [22, 76], [24, 60], [28, 49], [34, 44]], hd: -70, jaw: 30, ph: 0.2, hurt: true },
      die1: { sp: [[22, 96], [24, 82], [36, 76], [50, 75], [60, 76]], hd: 2, jaw: 8, ph: 0.6, fall: true },
    };
    const pool = (w, bright = 1) => `<ellipse cx="30" cy="87" rx="${w + 6}" ry="6" fill="${lava}" opacity="${0.5 * bright}" stroke="none" ${c.soft()}/>` +
      c.P(`M${30 - w} 88.5C${30 - w} 84 ${30 - w * 0.4} 82 30 82C${30 + w * 0.5} 82 ${30 + w} 84 ${30 + w} 88.5Z`, bright ? c.lin([[0, EMBER_L], [0.5, lava], [1, '#b8361e']]) : c.lin([[0, '#4a3036'], [1, '#22181e']])) +
      (bright ? c.P(`M${30 - w * 0.6} 86C${30 - w * 0.4} 84 ${30 - w * 0.1} 84 ${30} 85M${30 + w * 0.2} 85.5C${30 + w * 0.4} 84 ${30 + w * 0.6} 84.4 ${30 + w * 0.75} 86`, 'none', ` stroke="${OL}" stroke-width="1.4"`) : '') +
      c.P(`M${30 - w - 6} 88.5L${30 - w - 3} 82L${30 - w + 3} 81L${30 - w + 5} 88.5ZM${30 + w - 4} 88.5L${30 + w} 80L${30 + w + 6} 81L${30 + w + 7} 88.5Z`, c.body('#6a5c5a', 0.3));
    if (fr === 'die2') {
      // 식어 굳은 돌 마디가 줄지어 반쯤 묻힘 + 검게 굳은 용암 + 김
      const segs = [[20, 82, 12], [36, 80, 13], [53, 80, 12], [68, 82, 10]].map(([x, y, r]) => c.E(x, y, r, r * 0.8, c.body('#5e5660', 0.3, -0.4)) + c.L(`M${x - r * 0.5} ${y - r * 0.4}l${r * 0.3} ${r * 0.3}`, '#3a3240', 2)).join('');
      return c.out(
        c.mist([[30, 56, 4], [40, 48, 4.6], [52, 54, 3.6], [60, 44, 3.4], [72, 58, 3]], '#c8c2d0', 0.45) +
        c.P('M4 88.5C6 84 20 83 40 84C60 83 84 83 94 88.5Z', c.lin([[0, '#3a2a30'], [1, '#22181e']])) +
        segs +
        g(c.P('M-14 0C-12-14 6-20 18-12C26-7 30 0 28 4L8 6C0 12-12 10-14 0Z', c.body('#5e5660', 0.35)) + c.P('M8 4L26 6C22 10 10 12 4 8Z', '#4a4250') + c.E(10, -5, 2.6, 2.2, '#2a2230') + c.E(18, -3, 2.2, 1.8, '#2a2230'), 'translate(72 76) rotate(16) scale(0.85)') +
        c.L('M30 76l4 4l5-2M48 74l3 5', '#a8401e', 1.8, ' opacity=".8"')
      );
    }
    const S = T[fr];
    const sp = spline(S.sp, 6);
    const hw = (t) => 15 - t * 4;
    const crack = (d, w = 2) => glowLine(c, d, lava, S.hurt ? '#fff6d0' : EMBER_L, w);
    // 마디판: 뒤(아래)에서 앞(위)으로, 판 사이 틈에서 용암이 빛남
    let segs = '';
    const N = 8;
    for (let k = N - 1; k >= 0; k--) {
      const t = Math.min(0.97, (k + S.ph) / N);
      const { p, a } = at(sp, t);
      const r = hw(t);
      segs += c.En(n(p[0] + 1.5), n(p[1] + 1.5), n(r + 1.4), n(r + 0.8), lava, 0.9);
    }
    const body = c.P(tube(sp, hw), c.body(rock, 0.32, -0.38, 0.3, 0.2));
    let plates = '';
    for (let k = 0; k < N; k++) {
      const t = Math.min(0.95, (k + S.ph) / N);
      if (t < 0.08) continue;
      const { p, a } = at(sp, t);
      const r = hw(t);
      plates += crack(`M${P2(pol(p, r - 1, a + 90))}Q${P2(pol(p, 4, a + 180))} ${P2(pol(p, r - 1, a - 90))}`, 2.2);
      plates += c.L(`M${P2(pol(pol(p, -3, a), r * 0.6, a - 90))}l${n(Math.cos((a - 40) * RAD) * 3)} ${n(Math.sin((a - 40) * RAD) * 3)}`, sh(rock, -0.35), 2);
    }
    const neck = sp[sp.length - 1];
    const ha = at(sp, 1).a * 0.5 + S.hd;
    const jaw = S.jaw;
    const head = g(
      // 아래턱
      g(c.P('M0 2L26 6C22 14 8 16 0 10Z', c.body(rock, 0.3)) + c.P('M8 6l2-4l2 4ZM15 7l2-4l2 4ZM21 7.6l1.6-3.4l1.6 3.4Z', '#efe6d0', ' stroke-width="1.2"'), `rotate(${jaw} 2 3)`) +
      (jaw > 12 ? c.P('M2 2L28 2L22 16Z', c.lin([[0, '#fff1a0'], [1, lava]]), ` transform="rotate(${jaw * 0.5} 2 3)" stroke="none"`) : '') +
      // 위 머리 + 뿔
      c.P('M-6-12L-12-22L-1-16ZM4-16L5-25L12-16Z', c.body(sh(rock, -0.1), 0.3)) +
      c.P('M-14 0C-12-14 6-20 18-12C26-7 30 0 28 4L8 4C0 10-12 10-14 0Z', c.body(sh(rock, 0.08), 0.4)) +
      c.P('M12 4l2 5l2-5ZM19 4l2 4.4l2-4.4ZM25 4l1.4 3.6l1.6-3.4Z', '#efe6d0', ' stroke-width="1.2"') +
      crack('M-8-4L-2 1L4-2', 1.8) +
      (S.hurt ? crack('M2-12L6-6L4 0', 1.6) + c.eye(10, -6, 3.2) + c.eye(18, -4, 2.6) : c.eye(10, -6, 3) + c.eye(18, -4, 2.6) + c.eye(3, -4, 2)),
      `translate(${P2(neck)}) rotate(${n(ha)}) scale(1.25)`
    );
    let fx = '';
    if (S.roar) fx = c.spark(70, 30, 1.8, EMBER_L) + c.spark(62, 44, 1.4, lava) + glowLine(c, 'M50 24C51 30 49 34 50 40', lava, EMBER_L, 2) + c.L('M74 12l6-3M76 20l7 0M72 4l4-4', '#fff', 1.8);
    if (S.erupt) {
      fx = `<ellipse cx="80" cy="84" rx="18" ry="7" fill="${lava}" opacity=".6" stroke="none" ${c.soft()}/>` +
        c.P('M62 88.5C64 82 70 80 74 84C76 78 82 76 86 82C88 80 92 82 94 88.5Z', c.lin([[0, '#fff1a0'], [0.5, EMBER_L], [1, lava]])) +
        [[68, 72, 2.4], [76, 64, 2.8], [88, 68, 2.2], [94, 76, 1.8], [82, 56, 1.8]].map(([x, y, r]) => c.E(x, y, r, r * 1.2, c.lin([[0, '#fff1a0'], [1, lava]]))).join('') +
        c.P('M62 64l-5-5l6 1ZM94 60l3-6l2 6ZM86 50l2-5l3 4Z', c.body('#6a5c5a', 0.3)) + c.spark(70, 56, 1.8, EMBER_L) + c.spark(96, 72, 1.5, lava) + c.L('M58 82l-6-2M98 80l2-6', '#fff', 1.8);
    }
    if (S.hurt) fx = c.L('M38 10l-4-6M48 8l2-7M58 12l5-5', '#fff', 1.8) + c.spark(40, 30, 1.6, '#fff6d0') + c.spark(10, 40, 1.4, EMBER_L);
    if (S.fall) fx = `<ellipse cx="60" cy="86" rx="30" ry="5" fill="${lava}" opacity=".5" stroke="none" ${c.soft()}/>` + c.P('M40 88.5C44 85 60 84 76 85C86 85 92 86 94 88.5Z', c.lin([[0, EMBER_L], [1, lava]])) + c.P('M50 66l-4-6l5 2ZM78 64l3-6l2 6Z', c.body('#6a5c5a', 0.3)) + c.mist([[50, 60, 3], [64, 56, 3.4]], '#c8c2d0', 0.4);
    // 솟아오른 자리의 용암 테두리(몸 밑동을 덮음)
    const lip = c.P('M6 88.5C8 82 16 79 24 81C30 79 38 80 44 84C46 86 46 87 46 88.5Z', c.lin([[0, EMBER_L], [0.5, lava], [1, '#b8361e']])) +
      c.L('M12 85C16 83 20 83 24 84M30 83C34 82 38 83 41 85', '#b8361e', 1.6);
    return c.out(
      pool(S.fall ? 22 : 26) +
      clipY(segs + body + plates, -40, 86) + lip +
      (S.fall ? fx + head : head + fx) +
      c.spark(n(10 + Math.max(0, wi(fr)) * 3), 80, 1.4, EMBER_L) + c.spark(46, 84, 1.2, EMBER)
    );
  };
  D.pyre_worm.frames = true;

  /* =========================================================
   * 4지역 · 폭풍 해안
   * ========================================================= */

  /** 게 집게: 손바닥 + 고정 손가락 + 움직이는 손가락(경첩에서 open도 벌어짐) */
  function claw(c, p, a, open, sc, fill, hi) {
    return g(
      c.P('M13 1C18 1 23 3 26 8C21 7 16 6 13 5Z', fill) +
      g(c.P('M13-4C18-7 24-6 27-1C22-2 17-1 13 0Z', fill) + c.P('M17-2.4l1 1.8l1-1.8M21-2.2l1 1.6l1-1.6', '#e8e2d8', ' stroke-width="1"'), `rotate(${-open} 13 -2)`) +
      c.P('M-3-6C4-10 12-9 15-4L15 4C10 8 2 8-3 5Z', fill) +
      (hi ? c.En(4, -4, 4, 1.8, '#ffffff', 0.4) : ''),
      `translate(${P2(p)}) rotate(${n(a)}) scale(${sc})`
    );
  }

  /* --- 바위게: 따개비가 붙은 큰 게. 다리 두 무리가 번갈아 종종걸음.
   *     aim: 두 집게를 높이 들어 벌림 / attack: 큰 집게를 앞으로 뻗어 탁 집음
   *     죽음: 등껍질이 금 가며 다리가 허우적 → 발랑 뒤집힘 → 뒤집힌 채 다리를 오므리고 굳음 --- */
  RG.art._en.MOTION.rock_crab = { gait: 'scuttle', bob: 0.015, tilt: 2.5, sway: 0.02, deathFx: 'crumble', deathTime: 0.8 };
  D.rock_crab = (fr) => {
    const c = make(3, { fine: true });
    const shell = '#80808f';
    const shellD = sh(shell, -0.35);
    const barn = (x, y, r) => c.P(`M${x - r} ${y + r * 0.5}L${x - r * 0.5} ${y - r * 0.7}L${x + r * 0.5} ${y - r * 0.7}L${x + r} ${y + r * 0.5}Z`, c.lin([[0, '#efebe2'], [1, '#a8a296']])) + c.En(x, y - r * 0.6, r * 0.42, r * 0.24, '#3a3444');
    const carapace = (cracked) => c.P('M10 60C10 42 26 32 44 32C62 32 76 42 76 58C76 68 62 74 44 74C26 74 10 68 10 60Z', c.body(shell, 0.4, -0.38)) +
      c.Pn('M14 62C26 71 62 71 72 62C68 70 58 74 44 74C30 74 18 70 14 62Z', SEA, 0.45) +
      c.Pn('M52 36C66 38 76 48 76 58C70 52 62 44 52 36Z', '#1c1426', 0.25) +
      barn(28, 44, 4) + barn(42, 38, 3.4) + barn(56, 42, 3.6) + barn(20, 54, 2.8) +
      c.En(36, 54, 4, 2.6, '#5e9a8a', 0.75) + c.En(62, 56, 3, 2, '#5e9a8a', 0.75) + c.L('M34 54c2 3 1 6 3 8', '#4a8a6a', 1.6) +
      c.L('M16 62C26 66 44 68 60 65', shellD, 1.8) +
      (cracked ? c.L('M44 34L40 44L46 50L41 58M58 38L62 46', '#1c1426', 2) + c.L('M45 35L41 44L47 50', '#ffffff', 1, ' opacity=".6"') : '');
    if (fr === 'die1' || fr === 'die2') {
      // 발랑 뒤집힘: 등껍질이 아래, 배·다리가 위
      const curl = fr === 'die2';
      const legU = (x, dx, near) => {
        const r = [x, 52];
        const k = curl ? [x + dx * 1.2, 42] : [x + dx * 1.4, 34];
        const t = curl ? [x + dx * 0.2, 44] : [x + dx * 0.4, 24];
        return chain(c, [r, k, t], [5.4, 4.2, 2.4], near ? shell : shellD);
      };
      return c.out(
        legU(26, -8, false) + legU(40, -3, false) + legU(54, 4, false) +
        g(carapace(true), 'translate(0 120.5) scale(1 -1)') +
        c.Pn('M40 87C58 88 72 80 75 64C76 76 64 86 46 88Z', '#1c1426', 0.35) + c.shine(26, 60, 8, 2.6, 0.35, -20) +
        c.P('M18 52C26 46 62 46 70 52C62 56 26 56 18 52Z', c.lin([[0, '#d8d4cc'], [1, '#a8a296']])) +
        c.L('M30 50l0 3M40 49l0 4M50 49l0 4M60 50l0 3', '#8a8478', 1.4) +
        legU(32, -6, true) + legU(46, 2, true) + legU(60, 8, true) +
        claw(c, curl ? [70, 58] : [72, 50], curl ? 150 : 120, curl ? 4 : 18, 1.05, shell, false) +
        g(c.eye(0, 0, 2.6, false), `translate(76 ${curl ? 62 : 60})`) +
        (curl ? c.mist([[40, 36, 2.6], [46, 30, 2.2]], MISTC, 0.5) : c.L('M22 26l-4-6M44 20l0-6M66 24l4-6', '#fff', 1.6))
      );
    }
    // o 몸 이동, A·B 다리 무리 [앞뒤 이동, 들림], cl 큰 집게 [팔꿈치 목표, 각도, 벌림], cf 작은 집게
    const T = {
      walk0: { o: [-4, 0], A: [4, 0], B: [-4, 0], cl: [[74, 62], -40, 20], cf: [[70, 46], -60, 14] },
      walk1: { o: [-4, -1.5], A: [0, 0], B: [0, 5], cl: [[74, 60], -46, 26], cf: [[70, 44], -64, 18] },
      walk2: { o: [-4, 0], A: [-4, 0], B: [4, 0], cl: [[74, 62], -40, 20], cf: [[70, 46], -60, 14] },
      walk3: { o: [-4, -1.5], A: [0, 5], B: [0, 0], cl: [[74, 60], -46, 26], cf: [[70, 44], -64, 18] },
      aim: { o: [-4, -2], A: [2, 0], B: [-2, 0], cl: [[74, 42], -78, 44], cf: [[64, 36], -96, 40], p: -6 },
      attack: { o: [-2, 1], A: [-5, 0], B: [-3, 0], cl: [[76, 64], -6, -4], cf: [[64, 50], -130, 12], snap: true, p: 4 },
      die0: { o: [-1, -2], A: [6, 6], B: [-6, 4], cl: [[76, 44], -130, 30], cf: [[64, 40], -150, 24], hurt: true, p: -10 },
    };
    const S = T[fr];
    const pv = [44, 70];
    const Wb = (q) => rot(add(q, S.o[0], S.o[1]), add(pv, S.o[0], S.o[1]), S.p || 0);
    const leg = (rx, spread, ph, near) => {
      const root = Wb([rx, near ? 68 : 64]);
      const tip = [rx + spread + S.o[0] + ph[0], GND(c, 0.6 + ph[1])];
      const knee = ik(root, tip, 11, 14, spread >= 0 ? -1 : 1);
      return chain(c, [root, knee, tip], [6, 4.8, 2.2], near ? c.lin([[0, shell], [1, shellD]]) : shellD) + c.L(`M${P2(mixp(root, knee, 0.5))}l1.6-1.6`, near ? '#b8b8c4' : '#4a4858', 1.4);
    };
    const armTo = (root, elb, a, op, sc, fill, near) => {
      const e = Wb(elb);
      const hand = pol(e, 6, a);
      return chain(c, [root, e, hand], near ? [7, 6, 6] : [5.6, 5, 5], fill) + claw(c, hand, a, op, sc, fill, near);
    };
    const eyes = c.limb(`M${P2(Wb([58, 38]))}L${P2(Wb([60, 24]))}`, 3.5, shellD) + c.limb(`M${P2(Wb([66, 40]))}L${P2(Wb([70, 27]))}`, 3.5, shellD) +
      (S.hurt ? c.L(`M${P2(add(Wb([60, 22]), -2, -2))}l4 4M${P2(add(Wb([60, 22]), 2, -2))}l-4 4`, '#fff', 1.6) : c.eye(n(Wb([60, 22])[0]), n(Wb([60, 22])[1]), 3.2) + c.eye(n(Wb([70, 25])[0]), n(Wb([70, 25])[1]), 3));
    let fx = '';
    if (S.snap) fx = c.L('M96 50l3-5M98 60l4 0M94 70l3 4', '#fff', 1.8) + c.spark(97, 60, 1.6, '#e8fbff');
    if (S.hurt) fx = c.L('M30 22l-3-6M44 18l0-7M58 20l3-6', '#fff', 1.8);
    return c.out(
      fx +
      leg(26, -12, S.B, false) + leg(40, -3, S.A, false) + leg(54, 8, S.B, false) +
      armTo(Wb([62, 52]), S.cf[0], S.cf[1], S.cf[2], 0.85, shellD, false) +
      eyes +
      g(carapace(S.hurt), `translate(${S.o[0]} ${S.o[1]}) rotate(${S.p || 0} ${pv[0]} ${pv[1]})`) +
      leg(30, -14, S.A, true) + leg(44, -2, S.B, true) + leg(58, 10, S.A, true) +
      armTo(Wb([66, 62]), S.cl[0], S.cl[1], S.cl[2], 1.15, c.body(shell, 0.4), true)
    );
  };
  D.rock_crab.frames = true;

  /* --- 번개 해파리: 반투명 종이 오므렸다 펴며(맥동) 떠감, 촉수 끝마다 전기.
   *     aim: 종이 부풀고 속에 전기가 모임, 촉수를 앞으로 말아 올림 / attack: 종을 움츠리며 촉수에서 번개가 터짐
   *     죽음: 맞고 종이 찌그러지며 합선 → 펑 터지며 불꽃이 사방으로 → 축 늘어진 막만 남아 지직거림 --- */
  RG.art._en.MOTION.volt_jelly = { gait: 'float', bob: 0.06, squash: 0.1, hover: 0.5, deathFx: 'sparks', deathTime: 0.7 };
  D.volt_jelly = (fr) => {
    const c = make(3, { fine: true });
    const bolt = (pts, w = 1.8) => `<path d="${zig(pts)}" fill="none" stroke="${VOLT}" stroke-width="${w * 2.4}" opacity=".6" ${c.soft()}/>` + c.L(zig(pts), '#fff3a0', w);
    const bellFill = (bright) => c.rad([[0, '#ffffff', 0.95], [0.35, bright ? '#e4dcff' : '#c4b8ff', 0.88], [1, '#5b4bc0', 0.86]], 0.38, 0.3, 0.8);
    // 종: 중심 x, 위 y, 반폭 w, 높이 h, 찌그러짐 dent
    const bellD = (cx, top, w, h, dent = 0) => {
      const by = top + h;
      return `M${cx - w} ${by}C${cx - w - 2} ${top + h * 0.3} ${cx - w * 0.5 + dent} ${top} ${cx + dent * 0.5} ${top}C${cx + w * 0.55} ${top} ${cx + w + 2} ${top + h * 0.3} ${cx + w} ${by}` +
        `C${cx + w * 0.7} ${by + 4} ${cx + w * 0.45} ${by - 1} ${cx + w * 0.2} ${by + 3}C${cx} ${by - 1} ${cx - w * 0.25} ${by + 4} ${cx - w * 0.45} ${by}C${cx - w * 0.65} ${by + 4} ${cx - w * 0.85} ${by} ${cx - w} ${by}Z`;
    };
    const T = {
      walk0: { top: 18, w: 22, h: 30, ph: 0, tl: 32 },
      walk1: { top: 22, w: 27, h: 26, ph: 1.5, tl: 30 },
      walk2: { top: 26, w: 31, h: 22, ph: 3, tl: 26 },
      walk3: { top: 22, w: 26, h: 26, ph: 4.5, tl: 30 },
      aim: { top: 12, w: 30, h: 32, ph: 0.8, tl: 26, charge: true },
      attack: { top: 22, w: 20, h: 28, ph: 2, tl: 34, zap: true },
      die0: { top: 22, w: 26, h: 24, ph: 3.5, tl: 30, dent: -9, hurt: true },
    };
    if (fr === 'die1') {
      // 펑: 찢어진 막 조각 + 사방으로 튀는 불꽃
      const rag = (x, y, a) => g(c.P('M-6-3C-2-6 4-6 7-2C3 0 3 3 0 5C-2 2-5 2-6-3Z', bellFill(true)), `translate(${x} ${y}) rotate(${a})`);
      return c.out(
        `<circle cx="50" cy="44" r="30" fill="${VOLT}" opacity=".5" stroke="none" ${c.soft()}/>` +
        `<circle cx="50" cy="44" r="14" fill="#fff6c0" opacity=".85" stroke="none" ${c.soft()}/>` +
        bolt([[50, 44], [40, 30], [34, 32], [24, 18]]) + bolt([[50, 44], [62, 32], [66, 34], [78, 20]]) + bolt([[50, 44], [36, 54], [30, 52], [18, 62]]) + bolt([[50, 44], [64, 56], [70, 54], [82, 66]]) + bolt([[50, 44], [52, 60], [48, 66], [52, 78]]) +
        rag(26, 30, -40) + rag(74, 28, 40) + rag(22, 58, -120) + rag(78, 60, 120) + rag(50, 18, 0) +
        c.spark(34, 22, 1.6, '#fff3a0') + c.spark(68, 18, 1.4, '#fff3a0') + c.spark(86, 46, 1.4, '#fff3a0') + c.spark(14, 44, 1.4, '#fff3a0')
      );
    }
    if (fr === 'die2') {
      return c.out(
        c.P('M26 88.5C24 80 34 74 48 74C62 74 72 80 70 88.5C62 86 56 89 50 86C44 89 36 86 26 88.5Z', bellFill(false), ' opacity=".8"') +
        c.L('M34 88C38 84 42 86 44 88M54 87C58 84 62 85 64 88', '#c9bfff', 2.4) +
        c.L('M70 86C76 88 82 86 88 88M24 87C18 88 14 86 10 88', '#c9bfff', 2.4) +
        bolt([[44, 76], [47, 72], [45, 70], [49, 66]], 1.4) + c.spark(84, 86, 1.2, '#fff3a0') + c.spark(14, 86, 1, '#fff3a0') +
        c.eye(56, 80, 1.6, false)
      );
    }
    const S = T[fr];
    const cx = 50;
    const by = S.top + S.h;
    let tent = '';
    let tips = '';
    [-0.7, -0.35, 0, 0.35, 0.7].forEach((u, i) => {
      const x0 = cx + u * S.w * 0.9;
      const sway = Math.sin(S.ph + i * 1.3) * 5;
      let pts;
      if (S.charge) pts = [[x0, by], [x0 + 6 + sway * 0.4, by + 10], [x0 + 14, by + 14], [x0 + 18, by + 8 - i * 1.5]];
      else if (S.zap) pts = [[x0, by], [x0 + 4 + sway * 0.3, by + 12], [x0 + 10, by + 22], [x0 + 16 + i * 2, by + S.tl - 4]];
      else pts = [[x0, by], [x0 - 3 + sway, by + S.tl * 0.35], [x0 - 6 - sway, by + S.tl * 0.7], [x0 - 10 + sway * 0.5, by + S.tl]];
      tent += `M${P2(pts[0])}C${P2(pts[1])} ${P2(pts[2])} ${P2(pts[3])}`;
      tips += c.spark(n(pts[3][0]), n(pts[3][1]), 1.5, '#fff3a0');
    });
    // 입 쪽 짧은 팔(주름진 리본)
    const arms = c.limb(`M${cx - 6} ${by}C${cx - 10} ${by + 8} ${cx - 2} ${by + 12} ${cx - 8} ${by + 18}M${cx + 6} ${by}C${cx + 2} ${by + 8} ${cx + 10} ${by + 12} ${cx + 4} ${by + 18}`, 4.4, '#a89aff');
    const core = S.charge ? 9 : S.zap ? 4 : 6;
    let fx = '';
    if (S.charge) fx = bolt([[cx - 10, by + 14], [cx - 4, by + 10], [cx + 2, by + 16], [cx + 8, by + 11]], 1.4) + `<circle cx="${cx}" cy="${S.top + S.h * 0.5}" r="20" fill="${VOLT}" opacity=".35" stroke="none" ${c.soft()}/>`;
    if (S.zap) fx = bolt([[cx + 30, by + 30], [cx + 36, by + 36], [cx + 33, by + 39], [cx + 42, by + 48]], 2.2) + bolt([[cx + 22, by + 32], [cx + 18, by + 40], [cx + 22, by + 42], [cx + 16, by + 52]], 2) + bolt([[cx + 38, by + 20], [cx + 46, by + 22], [cx + 44, by + 26], [cx + 50, by + 28]], 1.8) +
      `<circle cx="${cx + 34}" cy="${by + 36}" r="10" fill="#fff6c0" opacity=".6" stroke="none" ${c.soft()}/>`;
    if (S.hurt) fx = bolt([[cx + 20, S.top + 4], [cx + 26, S.top - 2], [cx + 24, S.top - 6], [cx + 30, S.top - 10]], 1.4) + bolt([[cx - 30, by], [cx - 36, by - 6], [cx - 34, by - 10]], 1.4) + c.L(`M${cx + 34} ${S.top + 10}l6-3M${cx + 36} ${S.top + 18}l7 0`, '#fff', 1.8);
    return c.out(
      `<ellipse cx="${cx}" cy="${S.top + S.h * 0.6}" rx="${S.w + 8}" ry="${S.h * 0.8}" fill="${VOLT}" opacity=".35" stroke="none" ${c.soft()}/>` +
      c.limb(tent, 3, '#c9bfff') + tips + arms +
      c.P(bellD(cx, S.top, S.w, S.h, S.dent || 0), bellFill(S.charge)) +
      // 속 기관(전기가 모이는 곳)
      c.Pn(`M${cx - core} ${S.top + S.h * 0.55}C${cx - core} ${S.top + S.h * 0.3} ${cx + core} ${S.top + S.h * 0.3} ${cx + core} ${S.top + S.h * 0.55}C${cx + core} ${S.top + S.h * 0.75} ${cx - core} ${S.top + S.h * 0.75} ${cx - core} ${S.top + S.h * 0.55}Z`, '#fff3a0', S.charge ? 0.85 : 0.5) +
      c.L(`M${cx - core + 2} ${S.top + S.h * 0.55}L${cx - 1} ${S.top + S.h * 0.45}L${cx} ${S.top + S.h * 0.6}L${cx + core - 2} ${S.top + S.h * 0.5}`, '#fffbe0', 1.6) +
      c.Pn(`M${cx + S.w * 0.3} ${S.top + 4}C${cx + S.w * 0.8} ${S.top + S.h * 0.25} ${cx + S.w} ${S.top + S.h * 0.6} ${cx + S.w * 0.85} ${by}L${cx + S.w * 0.6} ${by}C${cx + S.w * 0.7} ${S.top + S.h * 0.5} ${cx + S.w * 0.55} ${S.top + S.h * 0.2} ${cx + S.w * 0.3} ${S.top + 4}Z`, '#2a1e6a', 0.3) +
      (S.hurt ? c.L(`M${cx + 6} ${S.top + S.h * 0.66}l3 3M${cx + 9} ${S.top + S.h * 0.66}l-3 3M${cx + 15} ${S.top + S.h * 0.64}l3 3M${cx + 18} ${S.top + S.h * 0.64}l-3 3`, '#3a2a6a', 1.6) : c.eye(cx + 8, S.top + S.h * 0.68, 2.8) + c.eye(cx + 17, S.top + S.h * 0.64, 2.5)) +
      c.shine(cx - S.w * 0.45, S.top + S.h * 0.3, 6, 3.4, 0.7) +
      fx
    );
  };
  D.volt_jelly.frames = true;

  /* --- 물보라 요정: 물방울 몸에 지느러미 날개. 날개를 빠르게 퍼덕이며 날아감.
   *     aim: 몸을 뒤로 말며 물을 소용돌이로 모음 / attack: 앞으로 돌진하며 물줄기를 뿜음
   *     죽음: 맞고 찌그러지며 물방울이 튐 → 철썩 터져 물보라 → 땅에 웅덩이와 잔물결 --- */
  RG.art._en.MOTION.spray_sprite = { gait: 'fly', bob: 0.05, tilt: 6, squash: 0.06, hover: 0.42, deathFx: 'splash', deathTime: 0.6 };
  D.spray_sprite = (fr) => {
    const c = make(3.2, { fine: true });
    const water = (b) => c.rad([[0, '#ffffff', 0.95], [0.35, b ? '#c8f6fa' : '#9eeaf0', 0.92], [1, '#2a98b0', 0.92]], 0.4, 0.3, 0.8);
    const finF = c.lin([[0, '#e8fbff', 0.92], [1, SEA, 0.8]]);
    const drop = (x, y, r, a = 0) => g(c.P(`M0-${r * 1.6}C${r * 0.6}-${r * 0.6} ${r} 0 ${r} ${r * 0.3}C${r} ${r} ${r * 0.5} ${r * 1.2} 0 ${r * 1.2}C-${r * 0.5} ${r * 1.2}-${r} ${r}-${r} ${r * 0.3}C-${r} 0-${r * 0.6}-${r * 0.6} 0-${r * 1.6}Z`, water(false), ' stroke-width="1.5"') + c.En(-r * 0.3, 0, r * 0.25, r * 0.4, '#ffffff', 0.7), `translate(${x} ${y}) rotate(${a})`);
    if (fr === 'die1') {
      return c.out(
        c.cloud([[50, 58, 8], [40, 54, 6], [60, 52, 6]], water(true), 0.9) +
        drop(24, 40, 4, -60) + drop(76, 36, 4, 60) + drop(36, 26, 3.4, -30) + drop(64, 22, 3.4, 30) + drop(50, 16, 3, 0) + drop(16, 60, 3, -100) + drop(86, 58, 3, 100) +
        c.L('M30 48l-8-6M70 46l8-6M50 40l0-10', '#ffffff', 1.8, ' opacity=".8"') +
        g(c.P('M0 0C-4-8-10-12-16-12C-12-6-10-2-6 2Z', finF), 'translate(34 70) rotate(-30)') + g(c.P('M0 0C4-8 10-12 16-12C12-6 10-2 6 2Z', finF), 'translate(66 72) rotate(20)')
      );
    }
    if (fr === 'die2') {
      return c.out(
        c.P('M18 88.5C20 84 32 82 50 82C68 82 80 84 82 88.5Z', c.lin([[0, '#c8f6fa', 0.9], [1, '#2a98b0', 0.9]])) +
        c.L('M28 86C36 84 44 84 50 85M56 85C62 84 68 85 74 86', '#ffffff', 1.4, ' opacity=".8"') +
        `<ellipse cx="50" cy="86" rx="40" ry="5" fill="none" stroke="#bdf2f6" stroke-width="1.6" opacity=".7"/>` +
        drop(30, 78, 2.4) + drop(70, 79, 2) + g(c.P('M0 0C-4-6-8-8-12-8C-9-4-8-1-5 2Z', finF), 'translate(60 86) rotate(10)')
      );
    }
    // 몸 중심 o, 기울기 p, 날개 각 [먼, 가까운], 눌림 sq
    const T = {
      walk0: { o: [0, 0], p: 0, wa: [-50, -40], sq: 1 },
      walk1: { o: [0, 2], p: 2, wa: [-6, 4], sq: 1.04 },
      walk2: { o: [0, 3], p: 3, wa: [30, 40], sq: 0.96 },
      walk3: { o: [0, 1], p: 1, wa: [-14, -8], sq: 1 },
      aim: { o: [-6, -2], p: -18, wa: [-70, -60], sq: 1.1, swirl: true },
      attack: { o: [4, 2], p: 14, wa: [10, 20], sq: 0.9, spray: true },
      die0: { o: [-4, 0], p: -26, wa: [40, -80], sq: 0.8, hurt: true },
    };
    const S = T[fr];
    const ctr = [48 + S.o[0], 58 + S.o[1]];
    const fin = (a, sc) => g(c.P('M0 0C-4-12-14-20-26-22C-22-14-20-6-14 2Z', finF) + c.L('M-4-4L-16-16M-8-1L-20-10', '#ffffff', 1.2, ' opacity=".8"'), `translate(${P2(add(ctr, -2, -16))}) rotate(${a + S.p}) scale(${sc})`);
    const ex = 62;
    let face = S.hurt ? c.L(`M${ex - 3} 52l5 3l-5 3M${ex + 12} 51l-5 3l5 3`, OL, 1.8) : c.eye(ex, 55, 3.8) + c.eye(ex + 11, 54, 3.4);
    face += S.spray ? c.E(ex + 9, 65, 3, 2.6, '#1e5a6a') : S.swirl ? c.E(ex + 7, 65, 2, 1.6, '#1e5a6a') : c.L(`M${ex + 4} 66q4 3 8 0`, OL, 1.8);
    let fx = '';
    if (S.swirl) fx = `<path d="M30 30C14 40 18 70 40 78C64 86 86 70 84 50" fill="none" stroke="#bdf2f6" stroke-width="2.4" stroke-dasharray="6 4" opacity=".85"/>` + drop(84, 46, 2.4, 20) + drop(26, 34, 2, -40);
    if (S.spray) fx = c.P('M76 61C84 58 92 56 99 52C97 60 98 68 99 76C92 72 84 70 76 67Z', c.lin([[0, '#ffffff', 0.9], [1, '#7ae0ea', 0.7]], 'h'), ' stroke-width="1.6" stroke="#2a98b0"') + c.L('M80 63l14-4M80 66l15 3', '#ffffff', 1.4, ' opacity=".9"') + drop(94, 52, 2, 60) + drop(96, 78, 2, 120) + c.L('M18 50l-10-2M16 60l-12 0M18 70l-10 2', '#bdf2f6', 1.8);
    if (S.hurt) fx = drop(84, 40, 2.6, 50) + drop(78, 72, 2.4, 130) + drop(20, 44, 2.2, -50) + c.L('M86 54l6-2M84 62l7 1', '#fff', 1.8);
    const bodyD = 'M-36-8C-24-16-10-24 6-24C23-24 34-13 34 0C34 13 22 22 8 22C-6 22-16 14-22 4C-26-2-30-5-36-8Z';
    return c.out(
      c.mist(fr === 'attack' ? [[10, 58, 3], [4, 64, 2.4]] : [[8 + Math.max(0, wi(fr)) * 2, 54, 2.5], [6, 62, 2.2], [16, 66, 1.8]], '#bdf2f6', 0.8) +
      (S.spray ? '' : fx) + fin(S.wa[0], 0.85) +
      g(c.P(bodyD, water(S.swirl)) + c.P('M-12 16L-20 28L-6 22Z', finF), `translate(${P2(ctr)}) rotate(${S.p}) scale(${1 / S.sq} ${S.sq})`) +
      g(face, `rotate(${S.p} ${P2(ctr)}) translate(${S.o[0]} ${S.o[1]})`) +
      c.shine(ctr[0] - 2, ctr[1] - 14, 8, 4, 0.7) +
      fin(S.wa[1], 1) + (S.spray ? fx : '')
    );
  };
  D.spray_sprite.frames = true;

  /* --- 익사한 해적: 해초 감긴 해골 해적. 삼각모, 낡은 외투 사이로 갈비뼈. 앞손에 녹슨 커틀러스, 뒷손은 녹슨 갈고리.
   *     aim: 커틀러스를 머리 위 뒤로 치켜듦(갈고리는 앞으로 막음) / attack: 비스듬히 내리베기
   *     죽음: 맞고 해골이 젖혀짐 → 뼈가 풀리며 바닷물로 무너져 내림 → 바닷물 웅덩이에 모자·뼈·해초·칼만 --- */
  RG.art._en.MOTION.drowned_corsair = { gait: 'walk', bob: 0.04, tilt: 5, sway: 0.01, deathFx: 'splash', deathTime: 0.9 };
  D.drowned_corsair = (fr) => {
    const c = make(3, { fine: true });
    const bone = '#ddd7c6';
    const boneD = sh(bone, -0.3);
    const coat = '#3f5a62';
    const weed = '#5e9a6a';
    const rust = '#a8683a';
    const cutlass = (h, a) => g(
      c.P('M-5-1.5L4-1.5L4 1.5L-5 1.5Z', '#4a3028') + c.P('M3-4.2C6-5 7-2 6 0C7 2 6 5 3 4.2Z', GOLD) +
      c.P('M6-2.2C14-2.8 22-4 30-7C29-2 24 2 16 3L6 2.2Z', c.lin([[0, '#cfcbd4'], [0.7, '#9a96a6'], [1, '#7a6a5a']])) +
      c.En(18, -0.6, 2, 1.2, rust, 0.8) + c.En(25, -3, 1.4, 1, rust, 0.8) + c.L('M8-0.8C15-1.4 22-2.6 28-5', '#ffffff', 1.1, ' opacity=".7"'),
      `translate(${P2(h)}) rotate(${n(a)})`
    );
    const hook = (h, a) => g(c.P('M-3-3L3-3L3 3L-3 3Z', '#5a4a40') + c.L('M3 0L7 0C11 0 12 5 9 7C6 9 3 7 4 4', rust, 2.6), `translate(${P2(h)}) rotate(${n(a)})`);
    const skull = (pos, a, hurt, hat = true) => g(
      c.P('M-8-4C-8-14-2-18 5-18C13-18 19-12 19-4C19 2 17 4 15 6L15 9L1 9L1 6C-5 4-8 1-8-4Z', c.body(bone, 0.25)) +
      c.E(6, -5, 3.8, 4.2, '#241b2c') + c.E(14.5, -5, 3.4, 4, '#241b2c') +
      (hurt ? c.L('M4-7l4 4M8-7l-4 4', '#fff', 1.3) : c.eye(6, -5, 2, false) + c.eye(14.5, -5, 1.8, false)) +
      c.P('M10-1L11.5 2L9 2Z', '#241b2c') + c.L('M4 6V9M8 6V9M12 6V9', '#241b2c', 1.3) +
      (hat ? c.P('M-7-14C-6-23 14-24 18-15Z', c.body('#3a3040', 0.3)) +
        c.P('M-17-10C-14-19-5-16 4-17C13-18 20-22 28-16C23-10 14-13 5-12C-4-11-11-7-17-10Z', c.body('#3a3040', 0.3)) +
        c.L('M-16-11C-12-17-4-15 4-16C12-17 20-20 27-16', GOLD, 1.6) : '') +
      c.limb('M-8-12C-12-6-10 0-14 6', 2.6, weed),
      `translate(${P2(pos)}) rotate(${n(a)})`
    );
    const puddle = (w) => c.P(`M${50 - w} 88.5C${50 - w} 84 ${50 - w * 0.4} 82 50 82C${50 + w * 0.5} 82 ${50 + w} 84 ${50 + w} 88.5Z`, c.lin([[0, '#7ad0c8', 0.85], [1, '#2a6a70', 0.9]])) + c.L(`M${50 - w * 0.6} 86C${50 - w * 0.3} 84.5 ${50} 84.5 ${50 + w * 0.2} 85.5`, '#e8fbff', 1.3, ' opacity=".8"');
    if (fr === 'die1' || fr === 'die2') {
      const end = fr === 'die2';
      const boneP = (x, y, a, l) => g(c.P(`M0-1.6L${l} -1.6L${l} 1.6L0 1.6Z`, bone) + c.E(0, 0, 2.4, 2.4, bone) + c.E(l, 0, 2.4, 2.4, bone), `translate(${x} ${y}) rotate(${a})`);
      return c.out(
        (end ? '' : c.P('M36 40C30 52 34 62 30 72M58 44C64 54 60 64 66 74', 'none', ` stroke="#7ad0c8" stroke-width="4" opacity=".7"`) + c.mist([[42, 50, 2.4], [56, 46, 2]], '#bdf2f6', 0.7)) +
        puddle(end ? 36 : 30) +
        (end
          ? boneP(26, 85, -10, 12) + boneP(60, 86, 16, 10) + skull([42, 74], 84, true, false) + c.limb('M22 86C28 80 34 84 40 80M62 86C66 82 72 84 76 80', 2.6, weed) + cutlass([60, 84], -6) +
            g(c.P('M-7-2C-6-11 14-12 18-3Z', c.body('#3a3040', 0.3)) + c.P('M-17 2C-14-7-5-4 4-5C13-6 20-10 28-4C23 2 14-1 5 0C-4 1-11 5-17 2Z', c.body('#3a3040', 0.3)) + c.L('M-16 1C-12-5-4-3 4-4C12-5 20-8 27-4', GOLD, 1.6), 'translate(36 84) rotate(-6) scale(0.8)')
          : c.P('M30 84C32 70 40 64 50 64C60 64 68 70 70 84Z', c.lin([[0, coat], [1, sh(coat, -0.35)]])) + c.L('M42 70h12M42 75h12M43 80h10', bone, 2) +
            boneP(24, 82, -30, 12) + boneP(66, 80, 30, 12) + cutlass([62, 86], 6) + skull([46, 56], 30, true, false) +
            g(c.P('M-7-2C-6-11 14-12 18-3Z', c.body('#3a3040', 0.3)) + c.P('M-17 2C-14-7-5-4 4-5C13-6 20-10 28-4C23 2 14-1 5 0C-4 1-11 5-17 2Z', c.body('#3a3040', 0.3)), 'translate(72 40) rotate(40) scale(0.8)'))
      );
    }
    const T = {
      walk0: { hip: [50, 62], lean: 4, ft: [[60, 0, 0], [40, 1, 20]], hn: [[64, 64], [40, 60]], bl: 10 },
      walk1: { hip: [50, 60], lean: 2, ft: [[50, 0, 0], [52, 6, 26]], hn: [[62, 65], [46, 63]], bl: 18 },
      walk2: { hip: [50, 62], lean: 4, ft: [[40, 1, 20], [60, 0, 0]], hn: [[58, 66], [58, 58]], bl: 26 },
      walk3: { hip: [50, 60], lean: 2, ft: [[52, 6, 26], [50, 0, 0]], hn: [[62, 65], [46, 63]], bl: 18 },
      aim: { hip: [48, 62], lean: -8, ft: [[62, 0, 0], [34, 0, 10]], hn: [[42, 24], [66, 50]], bl: 205, bend: -1, hk: -30 },
      attack: { hip: [52, 63], lean: 14, ft: [[68, 0, 0], [34, 2, 30]], hn: [[82, 60], [36, 56]], bl: 28, slash: true, hk: 160 },
      die0: { hip: [46, 62], lean: -18, ft: [[58, 6, -10], [38, 0, 0]], hn: [[66, 36], [32, 42]], bl: null, hurt: true, hk: -120 },
    };
    const S = T[fr];
    const K = {
      shN: [5, -24], shF: [-5, -25], neck: [3, -27], thigh: 13, shin: 13, footH: 4.4, upper: 11, fore: 11,
      legW: [8, 4.2, 3.8], armW: [5.6, 3.8, 3.4],
      legFill: bone, legFillF: boneD, armFill: bone, armFillF: boneD,
      legDeco: (cc, r, k, a, near) => cc.P(`M${P2(add(r, -4.4, -2))}L${P2(add(r, 4.4, -2))}L${P2(add(mixp(r, k, 0.85), 4.2, 0))}L${P2(add(mixp(r, k, 0.9), 0, 3))}L${P2(add(mixp(r, k, 0.85), -4.2, 0))}Z`, near ? sh(coat, -0.15) : sh(coat, -0.4)) + cc.E(n(k[0]), n(k[1]), 2.6, 2.6, near ? bone : boneD),
      armDeco: (cc, r, e, h, near) => cc.P(`M${P2(pol(r, 3.6, ang(r, e) - 90))}L${P2(pol(mixp(r, e, 0.8), 3.2, ang(r, e) - 90))}L${P2(pol(mixp(r, e, 0.8), 3.2, ang(r, e) + 90))}L${P2(pol(r, 3.6, ang(r, e) + 90))}Z`, near ? coat : sh(coat, -0.3)) + cc.E(n(e[0]), n(e[1]), 2.4, 2.4, near ? bone : boneD),
      boot: (cc, a, toe, near) => cc.P(bootD(a, toe, 8.5, 4.4), near ? '#3a2e34' : '#2a2026'),
    };
    const B = human(c, S, K);
    const torso = g(
      c.P('M-8-26C-4-30 6-30 10-26L14 6L6 2L1 8L-4 2L-12 6Z', c.lin([[0, coat], [1, sh(coat, -0.35)]])) +
      c.P('M-2-26L6-26L6-6L-2-6Z', '#2b2236') +
      c.L('M-1-21H5M-1-16H5M-1-11H5', bone, 2) + c.L('M2-24V-7', boneD, 1.6) +
      c.P('M-9-4L11-4L11-1L-9-1Z', '#5a3a2a') + c.P('M0-4.6L4-4.6L4-0.4L0-0.4Z', GOLD) +
      c.limb('M-6-26C-8-16-4-10-8-2', 2.6, weed) +
      c.Pn('M6-26C10-22 12-14 13 2L9 2C9-10 8-20 6-26Z', '#1c1426', 0.3),
      `translate(${P2(S.hip)}) rotate(${S.lean})`
    );
    const hd = S.hurt ? -30 : S.slash ? 10 : wi(fr) % 2 ? 4 : -2;
    const head = skull(add(B.neck, -2, -8), S.lean * 0.5 + hd, S.hurt);
    const aF = B.arm(B.shF, S.hn[1], false);
    const aN = B.arm(B.shN, S.hn[0], true, S.bend || 1);
    const wpn = S.bl != null ? cutlass(aN.hand, S.bl) : '';
    let fx = '';
    if (S.slash) fx = c.P('M48 14C72 14 90 32 90 58C84 42 72 28 52 22Z', '#e8fbff', ' stroke="none" opacity=".55"') + c.L('M54 18C74 20 88 36 88 54', '#ffffff', 1.6, ' opacity=".9"');
    if (S.hurt) fx = cutlass([80, 78], 150) + c.L('M70 18l6-4M72 26l7-1', '#fff', 1.8) + c.mist([[64, 30, 2], [70, 36, 1.6]], '#bdf2f6', 0.8);
    // 발밑에서 떨어지는 바닷물 방울
    const drip = wi(fr) >= 0 ? c.En(42 + wi(fr) * 3, 80 + (wi(fr) % 2) * 3, 1.2, 1.8, '#7ad0c8', 0.85) : '';
    return c.out(
      aF.d + hook(aF.hand, S.hk != null ? S.hk : aF.fa) +
      B.leg(B.hipF, S.ft[1], false) +
      torso +
      B.leg(B.hipN, S.ft[0], true) +
      head +
      (S.bl != null && S.bl > 90 ? wpn : '') +
      aN.d + fist(c, aN.hand, aN.fa, bone, 3) +
      (S.bl != null && S.bl <= 90 ? wpn + fist(c, aN.hand, aN.fa, bone, 3) : '') +
      drip + fx
    );
  };
  D.drowned_corsair.frames = true;

  /* --- 안개 선원: 안개 망토를 두른 유령 선원(선원 모자, 그림자 얼굴에 빛나는 눈), 장화. 밧줄 달린 작살을 앞손에.
   *     aim: 작살을 어깨 위로 젖혀 겨눔(뒷손은 앞을 가리킴) / attack: 작살을 던짐(밧줄이 손에서 풀려 나감)
   *     죽음: 맞고 망토가 펄럭이며 휘청 → 몸이 아래부터 안개로 풀려 사라짐 → 땅에 꽂힌 작살과 모자, 안개 자락 --- */
  RG.art._en.MOTION.mist_mariner = { gait: 'walk', bob: 0.035, tilt: 2, sway: 0.02, deathFx: 'mist', deathTime: 1.0 };
  D.mist_mariner = (fr) => {
    const c = make(3, { fine: true });
    const cloakA = '#b9c4cc';
    const cloakB = '#6b7f8c';
    const cloak = c.lin([[0, cloakA, 0.95], [0.6, '#8496a2', 0.9], [1, cloakB, 0.7]]);
    const rope = '#c8b48c';
    const harpoon = (h, a, len = 34) => g(
      c.P(`M-10-2.2L${len - 8}-2.2L${len - 8} 2.2L-10 2.2Z`, c.lin([[0, '#d8b48a'], [1, '#9a7a58']]), ' stroke-width="2"') +
      c.P(`M${len - 9}-2.8L${len - 3}-2.8L${len - 3} 2.8L${len - 9} 2.8Z`, '#9a9eac', ' stroke-width="2"') +
      c.P(`M${len - 3}-4.6L${len + 7} 0L${len - 3} 4.6L${len - 1} 0Z`, c.lin([[0, '#f0f2f8'], [1, '#9a9eac']]), ' stroke-width="2"') +
      c.P(`M${len - 2}-3.4L${len - 7}-7L${len - 4}-2.6Z`, '#d9dce6', ' stroke-width="1.8"'),
      `translate(${P2(h)}) rotate(${n(a)})`
    );
    const cap = (pos, a) => g(c.P('M-9-2C-8-9 8-10 10-3L10 0L-9 0Z', '#3a4a66') + c.P('M-10-1L12-1L12 1.6L-10 1.6Z', '#2a3448') + c.P('M-4-8L4-8.6L3-6L-4-6Z', '#e8eef4'), `translate(${P2(pos)}) rotate(${n(a)})`);
    if (fr === 'die2') {
      return c.out(
        c.mist([[30, 82, 5], [44, 84, 5.4], [58, 83, 5], [70, 85, 4], [40, 74, 3.4], [56, 72, 3]], MISTC, 0.6) +
        harpoon([46, 88], -72, 30) + c.L('M47 82C40 84 34 82 30 86', rope, 1.8) +
        cap([64, 86], 6)
      );
    }
    const T = {
      walk0: { hip: [50, 62], lean: 3, ft: [[59, 0, 0], [41, 1, 22]], hn: [[60, 54], [40, 62]], hp: -24, fade: 0 },
      walk1: { hip: [50, 60], lean: 2, ft: [[50, 0, 0], [52, 6, 28]], hn: [[60, 52], [44, 64]], hp: -26, fade: 0 },
      walk2: { hip: [50, 62], lean: 3, ft: [[41, 1, 22], [59, 0, 0]], hn: [[58, 54], [56, 60]], hp: -28, fade: 0 },
      walk3: { hip: [50, 60], lean: 2, ft: [[52, 6, 28], [50, 0, 0]], hn: [[60, 52], [44, 64]], hp: -26, fade: 0 },
      aim: { hip: [47, 62], lean: -8, ft: [[62, 0, 0], [34, 0, 10]], hn: [[40, 30], [70, 44]], hp: -14, bend: -1, fade: 0, aimH: true },
      attack: { hip: [52, 62], lean: 14, ft: [[67, 0, 0], [35, 3, 32]], hn: [[70, 50], [38, 58]], hp: null, fade: 0, throwH: true },
      die0: { hip: [46, 62], lean: -18, ft: [[58, 6, -10], [38, 0, 0]], hn: [[64, 36], [30, 44]], hp: null, fade: 0, hurt: true },
      die1: { hip: [48, 64], lean: -6, ft: [[56, 0, 0], [42, 0, 0]], hn: [[58, 60], [38, 62]], hp: null, fade: 1, hurt: true },
    };
    const S = T[fr];
    const K = {
      shN: [4, -24], shF: [-4, -25], neck: [2, -27], thigh: 13, shin: 13, footH: 4.4, upper: 11, fore: 11,
      legW: [8, 7, 6.4], armW: [6.4, 5.6, 5],
      legFill: c.lin([[0, '#4a5466'], [1, '#2e3442']]), legFillF: '#262c38', armFill: c.lin([[0, cloakA], [1, '#7d8f9a']]), armFillF: '#6b7c88',
      boot: (cc, a, toe, near) => cc.P(bootD(a, toe, 8.5, 4.8), near ? '#3a3038' : '#2a2228') + cc.L(`M${P2(add(a, -3, -3))}l7 0`, '#5a4a52', 1.4),
    };
    const B = human(c, S, K);
    const swing = wi(fr) >= 0 ? (wi(fr) % 2 ? 2 : -2) : S.throwH ? -6 : S.aimH ? 4 : 0;
    const torso = g(
      // 안개 망토: 어깨에서 무릎까지, 자락이 너풀
      c.P(`M-8-27C-14-14-16 2-${18 + swing} 18L-12 14L-6 20L0 15L6 21L12 15L${16 - swing} 19C14 4 12-14 8-27Z`, cloak) +
      c.L('M-6-10l-2 14M4-8l2 14', '#5d6f7c', 1.5) +
      c.P('M-8-6L10-6L10-3L-8-3Z', '#4a3a32') + c.E(-8, 2, 4, 3, 'none', ` stroke="${rope}" stroke-width="1.8"`) +
      c.Pn('M5-26C10-20 12-10 14 14L10 14C9-4 8-18 5-26Z', '#1c1426', 0.25),
      `translate(${P2(S.hip)}) rotate(${S.lean})`
    );
    const hd = S.hurt ? -26 : S.throwH ? 8 : 0;
    const head = g(
      c.P('M-10 2C-12-8-6-16 2-16C10-16 15-10 14-2C13 4 10 7 6 8L-6 8C-9 6-10 4-10 2Z', cloak) +
      c.E(4, -1, 7, 7.6, c.rad([[0, '#3a3450'], [1, '#141020']], 0.6, 0.5, 0.6)) +
      (S.hurt ? c.L('M2-3l3 3M5-3l-3 3M8-3l3 3M11-3l-3 3', '#e8f2ff', 1.3) : c.eye(3.6, -1.6, 2.3, false) + c.eye(9, -1.6, 2, false)) +
      cap([2, -15], -4),
      `translate(${P2(add(B.neck, 0, -8))}) rotate(${S.lean * 0.5 + hd})`
    );
    const aF = B.arm(B.shF, S.hn[1], false);
    const aN = B.arm(B.shN, S.hn[0], true, S.bend || 1);
    let wpn = '';
    let fx = '';
    if (S.hp != null) wpn = harpoon(aN.hand, S.hp);
    if (S.throwH) {
      fx = harpoon([76, 40], -10, 17) + c.L(`M${P2(aN.hand)}C70 44 66 46 66 42`, rope, 1.8) + c.L('M84 30l6-1M86 50l6 1', '#e8f2ff', 1.6, ' opacity=".8"');
    }
    if (S.hurt && !S.fade) fx = harpoon([76, 80], 160, 30) + c.L('M70 20l6-4M72 28l7-1', '#fff', 1.8);
    let out = aF.d + fist(c, aF.hand, aF.fa, '#8a9aa6') + B.leg(B.hipF, S.ft[1], false) + torso + B.leg(B.hipN, S.ft[0], true) + head +
      (S.aimH ? wpn : '') + aN.d + fist(c, aN.hand, aN.fa, '#dfe8ee') + (S.aimH ? '' : wpn + (wpn ? fist(c, aN.hand, aN.fa, '#dfe8ee') : ''));
    if (S.fade) {
      // 아래부터 안개로 풀림: 아래쪽을 지우고 안개 덩어리로 덮음
      out = clipY(out, -10, 58) + `<g opacity=".45">${clipY(out, 58, 100)}</g>` +
        c.mist([[36, 70, 6], [50, 74, 7], [64, 70, 6], [44, 84, 6], [58, 84, 6], [50, 62, 5], [30, 82, 4], [70, 82, 4]], MISTC, 0.75) + harpoon([70, 84], 170, 30) + cap([72, 40], 30);
    }
    return c.out(
      c.mist(S.fade ? [] : [[30 + Math.max(0, wi(fr)) * 2, 88, 3.4], [50, 88, 3], [68, 88, 3.4]], MISTC, 0.6) +
      out + fx
    );
  };
  D.mist_mariner.frames = true;

  /* --- 조수 술사: 물고기 머리의 술사. 긴 겉옷, 앞손에 진주 박힌 유목 지팡이, 뒷손에 소라고둥.
   *     걸을 때 지팡이를 짚으며 걸음. aim: 지팡이를 높이 들고 소라고둥을 입에 댐 / attack: 고둥을 불며 지팡이 끝에서 보호막 물결이 퍼짐
   *     죽음: 맞고 고둥을 떨어뜨리며 휘청 → 무릎 꿇고 지팡이가 쓰러짐 → 엎어진 겉옷에서 물이 흘러나옴, 고둥만 굴러감 --- */
  RG.art._en.MOTION.tide_caller = { gait: 'walk', bob: 0.03, tilt: 3, sway: 0.015, deathFx: 'splash', deathTime: 0.9 };
  D.tide_caller = (fr) => {
    const c = make(3, { fine: true });
    const robe = '#4f6a8a';
    const robeD = sh(robe, -0.32);
    const scale = '#8ea2b0';
    const conch = (p, a, sc = 1) => g(c.P('M0 0C4-6 10-9 15-8C18-4 18 2 15 5C11 7 5 6 0 4Z', c.body('#ecd8c4', 0.25)) + c.L('M5-3q3-3 6-3M7 3q3-3 6-4', '#c49a8a', 1.4) + c.P('M15-8L19-10L18-6Z', '#d8b8a4'), `translate(${P2(p)}) rotate(${n(a)}) scale(${sc})`);
    const staff = (h, a, glow) => g(
      c.P('M-36-1.8L20-1.8L20 1.8L-36 1.8Z', c.lin([[0, '#a07a52'], [1, '#6a4c36']])) +
      c.L('M-20-1.8l3 3.6M-6-1.8l3 3.6M6-1.8l3 3.6', '#4a3424', 1.2) +
      c.P('M18-5C22-8 26-6 26-2C28 0 26 4 22 4C19 5 17 2 18-1Z', '#6a5038') +
      (glow ? `<circle cx="24" cy="-1" r="${glow}" fill="#9fe0d8" opacity=".6" stroke="none" ${c.soft()}/>` : '') +
      c.E(24, -1, 3.4, 3.4, c.rad([[0, '#ffffff'], [0.5, '#9fe0d8'], [1, SEA]], 0.4, 0.35, 0.7)),
      `translate(${P2(h)}) rotate(${n(a)})`
    );
    const fishHead = (pos, a, hurt, blow) => g(
      c.P('M-4-12L-8-24L0-17L4-26L8-16L14-21L13-11Z', c.lin([[0, '#9fe0d8'], [1, SEA]])) +
      c.P('M-12 0C-12-12-2-17 8-17C20-17 27-8 27 0C27 10 19 16 8 16C-2 16-12 10-12 0Z', c.body(scale, 0.35)) +
      c.L('M-4-2q-3 5 0 10M0-1q-3 5 0 10', sh(scale, -0.4), 1.8) +
      c.En(4, -10, 3, 2, '#ffffff', 0.35) + c.En(-4, -6, 2, 1.4, '#ffffff', 0.3) +
      (hurt ? c.L('M10-7l6 6M16-7l-6 6', '#fff', 2) : c.eye(13, -4, 4.4)) +
      (blow ? '' : c.L('M20 6C23 7 25 6 27 4', OL, 1.6)) +
      c.P('M-10 10C-4 14 0 16 4 16L-2 20Z', sh(scale, -0.2)),
      `translate(${P2(pos)}) rotate(${n(a)})`
    );
    if (fr === 'die2') {
      return c.out(
        c.P('M16 88.5C18 82 28 78 40 79C54 78 66 80 72 88.5Z', c.lin([[0, robe], [1, robeD]])) +
        c.L('M28 86C34 82 40 82 44 84M52 85C56 82 62 82 66 86', robeD, 1.6) +
        fishHead([35, 72], -70, true, false) +
        c.P('M60 88.5C66 86 80 85 92 88.5Z', c.lin([[0, '#7ad0c8', 0.85], [1, '#2a6a70', 0.9]])) +
        staff([56, 86], 4, 0) + conch([74, 82], 30, 0.85) +
        c.L('M86 82c2-2 4-2 6 0', '#bff4ee', 1.6)
      );
    }
    const T = {
      walk0: { hip: [48, 62], lean: 3, ft: [[56, 0, 0], [40, 1, 16]], hn: [[66, 54], [40, 64]], st: [[70, 88], 0], cn: 'hip' },
      walk1: { hip: [48, 60], lean: 2, ft: [[48, 0, 0], [50, 5, 22]], hn: [[64, 54], [42, 64]], st: [[66, 88], 0], cn: 'hip' },
      walk2: { hip: [48, 62], lean: 3, ft: [[40, 1, 16], [56, 0, 0]], hn: [[62, 54], [44, 64]], st: [[60, 88], 0], cn: 'hip' },
      walk3: { hip: [48, 60], lean: 2, ft: [[50, 5, 22], [48, 0, 0]], hn: [[64, 52], [42, 64]], st: [[68, 86], 0], cn: 'hip' },
      // 지팡이를 높이 듦, 고둥을 입에
      aim: { hip: [46, 62], lean: -6, ft: [[58, 0, 0], [36, 0, 8]], hn: [[56, 32], [64, 40]], st: [null, -80], cn: 'mouth', glow: 7, bend: -1 },
      // 고둥을 불고 지팡이를 앞으로 내밀어 보호막 물결
      attack: { hip: [50, 62], lean: 8, ft: [[62, 0, 0], [38, 1, 18]], hn: [[72, 44], [64, 40]], st: [null, -50], cn: 'mouth', glow: 10, cast: true },
      die0: { hip: [44, 62], lean: -16, ft: [[56, 6, -10], [38, 0, 0]], hn: [[60, 34], [30, 48]], st: [null, -120], cn: 'drop', hurt: true },
      die1: { hip: [46, 76], lean: 34, ft: [[60, 0, 60], [34, 0, 70]], hn: [[70, 84], [58, 86]], st: [null, 170], cn: 'drop', hurt: true, kneel: true },
    };
    const S = T[fr];
    const K = {
      shN: [5, -24], shF: [-5, -25], neck: [3, -27], thigh: 13, shin: 13, footH: 4, upper: 11, fore: 11,
      legW: [8, 7, 6], armW: [6.6, 5.6, 4.6],
      legFill: robeD, legFillF: sh(robe, -0.45), armFill: c.lin([[0, robe], [1, robeD]]), armFillF: sh(robe, -0.4),
      boot: (cc, a, toe, near) => cc.P(bootD(a, toe, 8, 3.8), near ? '#6a7888' : '#4a5868'),
    };
    const B = human(c, S, K);
    const sway = wi(fr) >= 0 ? (wi(fr) % 2 ? 0 : wi(fr) === 0 ? 3 : -3) : S.cast ? -4 : 0;
    // 겉옷: 어깨에서 발목까지 (다리는 겉옷 자락 아래로 발만 보임)
    const torso = g(
      c.P(`M-9-26C-4-30 6-30 10-26L${14 + sway} 22L6 19L0 23L-6 19L-${14 - sway} 22Z`, c.lin([[0, sh(robe, 0.1)], [1, robeD]])) +
      c.P(`M-2-26L6-26L${5 + sway * 0.5} 22L-1 22Z`, sh(robe, 0.25)) +
      c.L('M0-14l6 0M0-4l6 0', VOLT, 2) + c.L('M-6-8l-2 26M8-6l2 26', robeD, 1.5) +
      c.Pn('M6-26C10-20 12-6 14 20L10 20C9 2 8-16 6-26Z', '#1c1426', 0.28),
      `translate(${P2(S.hip)}) rotate(${S.lean})`
    );
    const hd = S.hurt ? -24 : S.cn === 'mouth' ? -10 : 0;
    const hp = add(B.neck, 0, -10);
    const head = fishHead(hp, S.lean * 0.5 + hd, S.hurt, S.cn === 'mouth');
    const handF = S.cn === 'mouth' ? rot(add(hp, 24, 4), hp, S.lean * 0.5 + hd) : S.hn[1];
    const aF = B.arm(B.shF, handF, false, S.cn === 'mouth' ? -1 : 1);
    const aN = B.arm(B.shN, S.hn[0], true, S.bend || 1);
    // 지팡이 각도: 걸을 땐 손에서 땅의 짚는 점으로
    const sa = S.st[0] ? ang(S.st[0], aN.hand) : S.st[1];
    const stf = staff(aN.hand, sa, S.glow || 0);
    let cn = '';
    if (S.cn === 'hip') cn = conch(add(aF.hand, -2, 2), 70, 0.8);
    else if (S.cn === 'mouth') cn = conch(add(aF.hand, 0, 0), S.lean * 0.5 + hd - 10, 0.9);
    else cn = conch(fr === 'die1' ? [76, 82] : [70, 74], fr === 'die1' ? 20 : 120, 0.85);
    let fx = '';
    if (S.cast) {
      const tip = pol(aN.hand, 24, sa);
      fx = [10, 17, 24].map((r, i) => `<path d="M${n(tip[0] - r * 0.5)} ${n(tip[1] - r)}A${r} ${r} 0 0 1 ${n(tip[0] - r * 0.5)} ${n(tip[1] + r)}" fill="none" stroke="#bff4ee" stroke-width="${3 - i * 0.6}" opacity="${0.95 - i * 0.2}" transform="translate(${r * 0.8} 0)"/>`).join('') +
        c.L(`M${n(hp[0] + 34)} ${n(hp[1] - 8)}q5 5 0 10M${n(hp[0] + 39)} ${n(hp[1] - 12)}q7 8 0 17`, '#bff4ee', 2.2, ' opacity=".9"');
    }
    if (S.cn === 'mouth' && !S.cast) fx = c.spark(n(pol(aN.hand, 24, sa)[0]), n(pol(aN.hand, 24, sa)[1]), 1.8, '#bff4ee');
    if (S.hurt && !S.kneel) fx = c.L('M66 18l6-4M68 26l7-1', '#fff', 1.8);
    if (S.kneel) fx = c.P('M34 88.5C38 86 52 85 64 86C70 86 74 87 76 88.5Z', c.lin([[0, '#7ad0c8', 0.85], [1, '#2a6a70', 0.9]]));
    return c.out(
      aF.d +
      B.leg(B.hipF, S.ft[1], false) + B.leg(B.hipN, S.ft[0], true) +
      torso + head + cn + fist(c, aF.hand, aF.fa, sh(scale, -0.2), 3) +
      (S.cn === 'mouth' ? fist(c, aF.hand, aF.fa, sh(scale, -0.2), 3) : '') +
      stf + aN.d + fist(c, aN.hand, aN.fa, scale, 3.2) +
      fx
    );
  };
  D.tide_caller.frames = true;

  /* --- 산호 거인: 산호와 조개로 된 거대한 돌몸. 느릿느릿 쿵 걸음. 어깨·등에 산호 가지.
   *     aim: 큰 팔을 뒤로 크게 젖힘(몸을 비틂) / attack: 앞으로 휘둘러 내지름(물보라)
   *     죽음: 산호 가지가 부러지며 휘청 → 몸이 덩어리째 갈라져 무너짐 → 돌·산호·조개 더미와 작은 물웅덩이 --- */
  RG.art._en.MOTION.coral_colossus = { gait: 'stomp', bob: 0.025, tilt: 2, sway: 0.012, deathFx: 'crumble', deathTime: 1.1 };
  D.coral_colossus = (fr) => {
    const c = make(3, { fine: true });
    const stone = '#7c8e93';
    const stoneD = sh(stone, -0.3);
    const coral = '#df8f84';
    const purp = '#a87fc0';
    const shellF = (x, y, r, a) => g(c.P(`M0 ${r * 0.3}L${-r} ${-r * 0.5}C${-r * 0.6} ${-r * 1.1} ${r * 0.6} ${-r * 1.1} ${r} ${-r * 0.5}Z`, c.body('#ece2d4', 0.2)) +
      c.L(`M0 ${r * 0.3}L${-r * 0.5} ${-r * 0.8}M0 ${r * 0.3}L0 ${-r * 0.9}M0 ${r * 0.3}L${r * 0.5} ${-r * 0.8}`, '#b4a08c', 1.4), `translate(${x} ${y}) rotate(${a})`);
    const branch = (base, a, len, col, broken) => {
      const tip = pol(base, len, a);
      const b1 = pol(mixp(base, tip, 0.5), len * 0.45, a - 40);
      const b2 = pol(mixp(base, tip, 0.7), len * 0.35, a + 35);
      return c.limb(`M${P2(base)}L${P2(broken ? mixp(base, tip, 0.55) : tip)}${broken ? '' : `M${P2(mixp(base, tip, 0.5))}L${P2(b1)}M${P2(mixp(base, tip, 0.7))}L${P2(b2)}`}`, 5, col);
    };
    const T = {
      walk0: { hip: [50, 64], lean: 3, ft: [[60, 0], [38, 3]], hn: [[60, 74], [44, 70]], hd: 0 },
      walk1: { hip: [50, 62.5], lean: 1, ft: [[52, 0], [50, 6]], hn: [[66, 72], [40, 70]], hd: -2 },
      walk2: { hip: [50, 64], lean: 3, ft: [[40, 3], [60, 0]], hn: [[72, 70], [36, 70]], hd: 0 },
      walk3: { hip: [50, 62.5], lean: 1, ft: [[50, 6], [52, 0]], hn: [[66, 72], [40, 70]], hd: -2 },
      // 큰 팔을 뒤로 크게 젖혀 듦(몸을 비틂), 작은 팔은 앞으로
      aim: { hip: [48, 64], lean: -12, ft: [[62, 0], [34, 0]], hn: [[24, 26], [66, 50]], hd: -6, bendN: -1 },
      // 앞으로 내지름 + 물보라
      attack: { hip: [50, 65], lean: 16, ft: [[64, 0], [32, 2]], hn: [[82, 52], [40, 66]], hd: 8, punch: true },
      die0: { hip: [46, 64], lean: -16, ft: [[60, 6], [36, 0]], hn: [[76, 34], [24, 46]], hd: -16, hurt: true },
      // 덩어리째 갈라져 무너짐
      die1: { hip: [48, 76], lean: 24, ft: [[66, 0], [30, 0]], hn: [[80, 76], [66, 78]], hd: 20, crumble: true },
    };
    if (fr === 'die2') {
      const boulder = (x, y, rx, ry, col) => c.P(`M${x - rx} ${y + ry * 0.4}C${x - rx} ${y - ry} ${x - rx * 0.3} ${y - ry * 1.1} ${x + rx * 0.2} ${y - ry}C${x + rx} ${y - ry * 0.8} ${x + rx * 1.05} ${y} ${x + rx * 0.8} ${y + ry * 0.6}L${x - rx * 0.7} ${y + ry * 0.7}Z`, c.body(col, 0.3, -0.4));
      return c.out(
        c.P('M60 88.5C64 85 80 84 92 88.5Z', c.lin([[0, '#7ad0c8', 0.85], [1, '#2a6a70', 0.9]])) +
        boulder(30, 79, 13, 9, stone) + boulder(56, 80, 14, 9, stone) + boulder(42, 68, 11, 8, stoneD) + boulder(72, 85, 6, 3.6, stone) + boulder(14, 85, 6, 3.6, stoneD) +
        branch([36, 62], -70, 14, coral, true) + branch([50, 72], -110, 12, purp, true) + branch([20, 80], -40, 10, coral, false) +
        shellF(60, 76, 6, 20) + shellF(80, 86, 4.4, -30) + c.En(30, 76, 3, 2, '#5fa3a0', 0.85) + c.En(52, 82, 2.4, 1.6, '#d8d4cc') +
        g(c.P('M-8 0C-8-8 0-12 8-10C14-8 16-1 13 4C8 7-4 7-8 0Z', c.body(stone, 0.3)) + c.E(2, -3, 2.4, 2.6, '#241b2c') + c.E(9, -3.4, 2.2, 2.4, '#241b2c'), 'translate(70 70) rotate(18)')
      );
    }
    const S = T[fr];
    const stoneF = c.body(stone, 0.32, -0.4);
    const K = {
      shN: [18, -34], shF: [-14, -36], thigh: 12, shin: 12, footH: 5, upper: 17, fore: 17,
      legW: [14, 12, 10], armW: [13, 11, 11],
      foot: (cc, a, lift, near) => cc.P(`M${n(a[0] - 8)} ${n(a[1] + 4.5)}C${n(a[0] - 8)} ${n(a[1] - 3)} ${n(a[0] + 6)} ${n(a[1] - 4)} ${n(a[0] + 10)} ${n(a[1] + 1)}L${n(a[0] + 11)} ${n(a[1] + 4.5)}Z`, cc.body(near ? stone : stoneD, 0.25)) + cc.En(n(a[0] + 2), n(a[1]), 2.4, 1.6, '#d8d4cc', 0.9),
      // 주먹: 따개비와 산호가 붙은 돌덩이
      fist: (cc, h, a, near) => g(cc.P('M-5-9C3-12 12-10 14-2C15 6 9 11 1 10C-6 9-8-5-5-9Z', cc.body(near ? stone : stoneD, 0.3)) + cc.En(4, -6, 3, 2, '#d8d4cc', 0.9) + cc.En(10, 2, 2.4, 1.6, coral, 0.9) + cc.L('M7-7l2 3M10-2l3 1', '#3a4448', 1.4), `translate(${P2(h)}) rotate(${n(a)})`),
      limbDeco: (cc, a, b, e, near) => cc.En(n(mixp(a, b, 0.5)[0]), n(mixp(a, b, 0.5)[1]), 2.6, 1.8, near ? '#5fa3a0' : '#4a7a78', 0.85) + cc.En(n(mixp(b, e, 0.5)[0]), n(mixp(b, e, 0.5)[1]), 2.2, 1.6, near ? coral : '#a8706a', 0.85),
    };
    const B = brute(c, S, K);
    const brk = S.hurt || S.crumble;
    const torso = g(
      branch([-16, -38], -110, 20, coral, brk) + branch([-6, -44], -80, 18, coral, false) + branch([12, -44], -60, 16, purp, S.crumble) +
      c.P('M-27-4C-31-22-22-43-2-45C18-46 30-35 29-17C28-3 21 5 7 5L-14 5C-21 4-26 1-27-4Z', stoneF) +
      c.Pn('M-26-2C-20 3 10 6 26-6C22 3 12 6 4 6L-14 6C-20 5-25 2-26-2Z', '#1c1426', 0.3) +
      c.En(-18, -16, 5, 3.5, coral, 0.85) + c.En(-2, -4, 4, 3, coral, 0.85) + c.En(14, -14, 3, 2.4, purp, 0.85) +
      c.En(-12, -28, 3.4, 2.6, '#5fa3a0', 0.85) + c.En(8, -2, 2.6, 2, '#5fa3a0', 0.85) + c.En(-20, -2, 2.2, 1.8, '#5fa3a0', 0.85) +
      shellF(-8, -30, 7, -20) +
      (S.crumble ? c.L('M-4-44L0-30L-6-18L2-6L-2 4', '#1c1426', 2.6) + c.L('M-3-44L1-30L-5-18', '#cfe6ea', 1, ' opacity=".6"') : '') +
      c.shine(-12, -34, 9, 3.5, 0.25, -30),
      `translate(${P2(S.hip)}) rotate(${S.lean})`
    );
    const hc = B.W([20, -40]);
    const head = g(
      c.P('M-9 0C-9-10 0-15 9-13C16-11 18-3 15 2C10 7-4 7-9 0Z', c.body(stone, 0.3)) +
      c.E(3, -4, 3.4, 3.8, '#241b2c') + c.E(11, -4.4, 3, 3.4, '#241b2c') +
      (S.hurt || S.crumble ? c.L('M1-6l4 4M5-6l-4 4', '#fff', 1.4) : c.eye(3, -4, 2, false) + c.eye(11, -4.4, 1.8, false)) +
      c.En(-4, -9, 2.4, 1.6, '#d8d4cc', 0.9),
      `translate(${P2(hc)}) rotate(${S.lean * 0.6 + S.hd})`
    );
    let fx = '';
    if (S.punch) fx = c.P('M96 40C90 44 92 50 98 52C92 54 90 60 96 64', 'none', ` stroke="#bff4ee" stroke-width="2.4"`) + [[98, 46, 2], [100, 58, 2.2], [92, 36, 1.6], [94, 68, 1.8]].map(([x, y, r]) => c.E(x, y, r, r * 1.2, '#bff4ee', ' stroke-width="1.4"')).join('') + c.L('M64 38l-8-2M62 46l-9 0', '#ffffff', 1.6, ' opacity=".7"');
    if (S.hurt) fx = branch([60, 22], -40, 10, coral, false) + c.L('M80 30l6-3M82 40l7 1', '#fff', 1.8) + c.P('M66 46l5-3l1 4Z', stone);
    if (S.crumble) fx = c.P('M30 88.5C34 85 50 84 62 85C72 85 80 86 82 88.5Z', c.lin([[0, '#7ad0c8', 0.85], [1, '#2a6a70', 0.9]])) + c.P('M70 64l6-2l-2 5ZM24 60l-5-3l1 5Z', stone) + branch([84, 78], -100, 10, coral, true);
    return c.out(
      B.arm(B.shF, S.hn[1], stoneD, false) +
      B.leg(B.hipF, S.ft[1], stoneD, false) +
      torso +
      B.leg(B.hipN, S.ft[0], stoneF, true) +
      head +
      (S.crumble ? fx : '') +
      g(B.arm(B.shN, S.hn[0], stoneF, true, S.bendN || 1), '') +
      shellF(n(B.shN[0]), n(B.shN[1]), 7, 20) +
      (S.crumble ? '' : fx)
    );
  };
  D.coral_colossus.frames = true;

  /* --- 전기 장어: 번개 무늬가 흐르는 긴 장어가 땅 위를 S자로 미끄러짐. 등지느러미는 보랏빛.
   *     aim: 몸을 S자로 말아 머리를 뒤로 당기고 입을 벌림(몸에 전기가 차오름) / attack: 앞으로 튀어나가 물며 입에서 방전
   *     죽음: 맞고 몸이 번개 모양으로 꺾여 경련 → 배를 드러내며 축 늘어짐 → 빛이 꺼진 잿빛 몸과 마지막 불꽃 --- */
  RG.art._en.MOTION.volt_eel = { gait: 'slither', bob: 0.01, sway: 0.04, deathFx: 'sparks', deathTime: 0.8 };
  D.volt_eel = (fr) => {
    const c = make(3, { fine: true });
    const dull = fr === 'die2' ? 1 : fr === 'die1' ? 0.5 : 0;
    const body = H.mix('#45506a', '#6a6672', dull);
    const belly = H.mix('#9aa6c4', '#8a8690', dull);
    const fin = H.mix(VOLT, '#6a6278', dull);
    const bolt = (pts, w = 1.8) => `<path d="${zig(pts)}" fill="none" stroke="${VOLT}" stroke-width="${w * 2.4}" opacity=".6" ${c.soft()}/>` + c.L(zig(pts), '#fff3a0', w);
    // 몸 곡선: 꼬리(왼쪽) → 머리(오른쪽). 걷기는 S자 물결이 뒤로 흐름
    const wave = (ph, amp, x0 = 8, x1 = 70, y = 78) => Array.from({ length: 7 }, (_, i) => { const t = i / 6; return [x0 + (x1 - x0) * t - Math.abs(Math.sin(ph + t * Math.PI * 2)) * 2, y + Math.sin(ph + t * Math.PI * 2) * amp * (t > 0.84 ? 0.35 : 1 - t * 0.3)]; });
    const T = {
      walk0: { sp: wave(0, 7.5), hd: 0, jaw: 6 },
      walk1: { sp: wave(Math.PI / 2, 7.5), hd: 4, jaw: 4 },
      walk2: { sp: wave(Math.PI, 7.5), hd: 0, jaw: 6 },
      walk3: { sp: wave(Math.PI * 1.5, 7.5), hd: -4, jaw: 4 },
      aim: { sp: [[14, 82], [26, 80], [36, 72], [32, 62], [36, 52], [48, 48], [56, 52]], hd: -26, jaw: 34, charge: true },
      attack: { sp: [[6, 82], [18, 80], [32, 78], [46, 75], [60, 70], [70, 66], [76, 64]], hd: 4, jaw: 40, zap: true },
      die0: { sp: [[10, 80], [20, 70], [30, 80], [40, 66], [50, 78], [58, 64], [64, 66]], hd: -40, jaw: 30, hurt: true },
      die1: { sp: [[6, 83], [20, 82], [34, 83], [48, 82], [58, 82], [66, 81], [70, 80]], hd: -6, jaw: 6, lie: true },
      die2: { sp: [[8, 85], [22, 85.5], [36, 85], [50, 85], [60, 85.5], [66, 85], [70, 84.5]], hd: -4, jaw: 8, lie: true },
    };
    const S = T[fr];
    const sp = spline(S.sp, 6);
    const hw = (t) => 1.6 + Math.min(1, t * 3) * 6.4 - (t > 0.9 ? (t - 0.9) * 10 : 0);
    const bd = tube(sp, hw);
    // 등지느러미: 등뼈 위쪽(-n)으로 이어진 띠
    const finTop = sp.slice(4, -3).map((p, i, arr) => { const t = (i + 4) / (sp.length - 1); const { a } = at(sp, t); return pol(p, hw(t) + 3.4 + Math.sin(i * 1.3) * 0.8, a - 90); });
    const finBase = sp.slice(4, -3).map((p, i) => { const t = (i + 4) / (sp.length - 1); const { a } = at(sp, t); return pol(p, hw(t) - 1.5, a - 90); });
    const finD = `M${finBase.map(P2).join('L')}L${finTop.slice().reverse().map(P2).join('L')}Z`;
    // 몸의 번개 무늬(가운데 줄)
    const zz = sp.filter((_, i) => i > 3 && i < sp.length - 4 && i % 2 === 0).map((p, i) => { const t = (i * 2 + 4) / (sp.length - 1); const { a } = at(sp, t); return pol(p, i % 2 ? 2.2 : -2.2, a - 90); });
    const neck = sp[sp.length - 1];
    const ha = at(sp, 1).a * 0.7 + S.hd;
    const head = g(
      g(c.P('M0 2L18 3C17 7 10 9 2 8Z', c.lin([[0, belly], [1, sh(belly, -0.3)]])), `rotate(${S.jaw} 2 3)`) +
      (S.jaw > 12 ? c.P('M2 2L19 1L16 12Z', '#2a1e3a', ` transform="rotate(${S.jaw * 0.5} 2 3)"`) : '') +
      c.P('M-6-6C0-11 12-10 18-4C21-1 21 2 19 3L2 3C-4 4-7 0-6-6Z', c.body(body, 0.35)) +
      c.P('M-2-8C2-14 8-14 10-9L4-6Z', fin) +
      (S.jaw > 12 ? c.P('M7 3l1.4 2.4l1.4-2.4M12 3l1.2 2.2l1.2-2.2', '#fff', ' stroke-width="1"') : c.L('M4 3L18 2.6', OL, 1.5)) +
      (S.hurt || S.lie ? c.L('M7-5l3 3M10-5l-3 3', '#fff', 1.5) : c.eye(9, -3.6, 2.8)),
      `translate(${P2(neck)}) rotate(${n(ha)}) scale(1.15)`
    );
    const tailFin = (() => { const { p, a } = at(sp, 0); return c.P(`M${P2(pol(p, 2, a + 90))}L${P2(pol(pol(p, 9, a + 180), 7, a + 90))}L${P2(pol(pol(p, 9, a + 180), 7, a - 90))}L${P2(pol(p, 2, a - 90))}Z`, fin); })();
    let fx = '';
    if (S.charge) fx = bolt([[20, 70], [24, 66], [22, 62], [28, 58]], 1.4) + bolt([[46, 40], [50, 36], [48, 32], [54, 30]], 1.4) + `<circle cx="40" cy="64" r="20" fill="${VOLT}" opacity=".3" stroke="none" ${c.soft()}/>`;
    if (S.zap) fx = `<circle cx="94" cy="66" r="10" fill="#fff6c0" opacity=".7" stroke="none" ${c.soft()}/>` + bolt([[88, 62], [94, 56], [92, 52], [99, 46]], 2) + bolt([[90, 70], [96, 74], [93, 78], [99, 84]], 2) + bolt([[92, 66], [99, 66]], 2);
    if (S.hurt) fx = bolt([[30, 60], [34, 54], [31, 50], [36, 44]], 1.6) + bolt([[52, 58], [56, 52], [53, 48]], 1.6) + c.L('M80 50l6-3M82 58l7 0', '#fff', 1.8);
    if (fr === 'die2') fx = c.spark(40, 80, 1.2, '#fff3a0') + bolt([[42, 78], [44, 75], [42, 73]], 1.2);
    return c.out(
      fx +
      (S.lie ? '' : `<path d="${bd}" fill="${VOLT}" opacity=".35" stroke="none" ${c.soft()}/>`) +
      tailFin + c.P(finD, fin) +
      c.P(bd, c.lin([[0, sh(body, 0.3)], [0.6, body], [1, S.lie ? belly : sh(body, -0.3)]])) +
      (S.lie ? '' : c.L(`M${zz.map(P2).join('L')}`, '#fff3a0', 1.8)) +
      (fr === 'die1' ? c.Pn(tube(sp.slice(6, -4).map((q) => add(q, 0, 3.4)), () => 2.4), belly, 0.9) : '') +
      head
    );
  };
  D.volt_eel.frames = true;

  /* --- 👑 폭풍 고래: 먹구름을 두르고 하늘을 헤엄치는 거대한 고래, 배에 번개 무늬.
   *     헤엄: 꼬리지느러미 위→가운데→아래→가운데, 가슴지느러미는 반대로. aim: 머리를 들고 입을 벌리며 번개가 배에 차오름
   *     attack: 입에서 벼락 줄기를 내리꽂음(벼락 능력 자세) · 죽음: 맞고 몸을 웅크리며 번개가 튐 → 구름이 흩어지며 머리부터 가라앉음 → 땅에 내려앉아 빛이 꺼짐 --- */
  RG.art._en.MOTION.tempest_whale = { gait: 'swim', bob: 0.05, tilt: 2, hover: 0.6, deathFx: 'mist', deathTime: 1.2 };
  D.tempest_whale = (fr) => {
    const c = make(3, { fine: true });
    const dull = fr === 'die2' ? 1 : fr === 'die1' ? 0.5 : 0;
    const skin = H.mix('#4e5878', '#5e5c6a', dull * 0.6);
    const belly = H.mix('#a2aac4', '#8a8894', dull);
    const cloud = '#6a6684';
    const bolt = (pts, w = 2.2) => `<path d="${zig(pts)}" fill="none" stroke="${VOLT}" stroke-width="${n(w * 2.4)}" opacity=".7" ${c.soft()}/>` + c.L(zig(pts), '#fff6c0', w);
    // o 중심, p 몸 기울기, ty 꼬리 높이, pf 가슴지느러미 각, jaw 입 벌림, cl 구름 상태
    const T = {
      walk0: { o: [52, 48], p: 0, ty: -12, pf: 30, jaw: 0, glow: 0.5 },
      walk1: { o: [52, 47], p: 1, ty: -2, pf: 10, jaw: 0, glow: 0.5 },
      walk2: { o: [52, 46], p: 0, ty: 10, pf: -12, jaw: 0, glow: 0.5 },
      walk3: { o: [52, 47], p: -1, ty: 2, pf: 10, jaw: 0, glow: 0.5 },
      aim: { o: [50, 50], p: -12, ty: 12, pf: -20, jaw: 14, glow: 1, charge: true },
      attack: { o: [50, 46], p: 8, ty: -14, pf: 30, jaw: 22, glow: 0.8, strike: true },
      die0: { o: [46, 50], p: 14, ty: -22, pf: 50, jaw: 10, glow: 0.6, hurt: true },
      die1: { o: [50, 54], p: 26, ty: -16, pf: 60, jaw: 6, glow: 0.2, sink: true },
      die2: { o: [46, 68], p: 2, ty: -6, pf: 70, jaw: 2, glow: 0, ground: true },
    };
    const S = T[fr];
    const ctrl = [[-36, S.ty], [-22, S.ty * 0.45], [-6, 0], [14, 0], [32, 0], [43, 1]];
    const sp = spline(ctrl, 6);
    const hw = (t) => (t < 0.14 ? 2.6 + (t / 0.14) * 5 : t < 0.62 ? 7.6 + ((t - 0.14) / 0.48) * 13.4 : 21 - ((t - 0.62) / 0.38) ** 2 * 9);
    const bd = tube(sp, hw);
    const clipId = H.uid('ew');
    const tail = at(sp, 0);
    const fluke = g(c.P('M0 0C-6-10-14-14-21-12C-16-6-14-2-12 0C-14 2-16 6-21 12C-14 14-6 10 0 0Z', c.body(skin, 0.3)), `translate(${P2(tail.p)}) rotate(${n(tail.a)}) scale(0.9)`);
    // 배·번개 무늬·주름 (몸 안으로 자름)
    const bellyD = tube(sp.map((q, i) => add(q, 0, 9 + i * 0.05)), (t) => hw(t) * 0.62);
    const zzPts = sp.filter((_, i) => i > 8 && i < sp.length - 4 && i % 2 === 0).map((q, i) => add(q, 0, i % 2 ? 11 : 15.5));
    const gl = S.glow;
    const inside = `<clipPath id="${clipId}"><path d="${bd}"/></clipPath><g clip-path="url(#${clipId})" stroke="none">` +
      `<path d="${bellyD}" fill="${belly}"/>` +
      c.L(sp.filter((_, i) => i > 14 && i < sp.length - 2 && i % 3 === 0).map((q) => `M${P2(add(q, -1, 13))}l3 4`).join(''), sh(belly, -0.35), 1.5) +
      (gl ? `<path d="${zig(zzPts.map((q) => q.map(n)))}" fill="none" stroke="${VOLT}" stroke-width="${n(4 + gl * 4)}" opacity="${n(0.4 + gl * 0.4)}" ${c.soft()}/>` + c.L(zig(zzPts.map((q) => q.map(n))), '#fff6c0', n(1.6 + gl)) : c.L(zig(zzPts.map((q) => q.map(n))), '#5a5868', 1.8)) +
      `<path d="M-10-30C10-24 30-22 50-14L50 40L-60 40L-60-30Z" fill="#000" opacity="0"/>` +
      c.Pn('M-20-20C0-26 30-24 46-10L46-4C30-16 0-20-24-14Z', '#ffffff', 0.12) +
      `</g>`;
    // 머리: 입(벌림), 눈, 분수공
    const snout = sp[sp.length - 1];
    const mouth = S.jaw > 2
      ? c.P(`M${P2(add(snout, 2, 4))}L${P2(add(snout, -22, 6))}L${P2(add(snout, 2, 4 + S.jaw))}Z`, '#2a1e3a') + c.P(`M${P2(add(snout, -22, 6))}L${P2(add(snout, 2, 6 + S.jaw))}C${P2(add(snout, -2, 12 + S.jaw))} ${P2(add(snout, -14, 14 + S.jaw * 0.5))} ${P2(add(snout, -24, 9))}Z`, c.lin([[0, belly], [1, sh(belly, -0.25)]]))
      : c.L(`M${P2(add(snout, 3, 4))}C${P2(add(snout, -8, 6))} ${P2(add(snout, -16, 7))} ${P2(add(snout, -24, 5))}`, OL, 2);
    const eyeP = add(snout, -16, -2);
    const eyeG = S.hurt ? c.L(`M${P2(add(eyeP, -2.4, -2.4))}l4.8 4.8M${P2(add(eyeP, 2.4, -2.4))}l-4.8 4.8`, '#fff', 1.8) : S.sink || S.ground ? c.L(`M${P2(add(eyeP, -3, 0))}q3 2.4 6 0`, OL, 1.8) : c.eye(n(eyeP[0]), n(eyeP[1]), 3.2);
    const pfRoot = add(at(sp, 0.52).p, 0, 14);
    const pfin = g(c.P('M0-3C-2 4-6 12-12 18C-4 16 2 10 4 2Z', c.body(sh(skin, -0.12), 0.25)), `translate(${P2(pfRoot)}) rotate(${S.pf - 20})`);
    const spots = [0.4, 0.55, 0.7].map((t, i) => { const q = at(sp, t).p; return c.En(n(q[0]), n(q[1] - hw(t) * 0.55), 2 + i * 0.3, 1.5, '#c8cce0', 0.6); }).join('');
    const whale = g(
      fluke + c.P(bd, c.body(skin, 0.35, -0.38, 0.4, 0.2)) + inside + spots + mouth + eyeG + pfin +
      c.shine(n(at(sp, 0.55).p[0]), n(at(sp, 0.55).p[1] - 13), 12, 3, 0.3, -6),
      `translate(${S.o[0]} ${S.o[1]}) rotate(${S.p})`
    );
    // 먹구름: 등 위 망토와 배 아래 자락 (헤엄 위상에 따라 흐름)
    const k = Math.max(0, wi(fr));
    const thin = S.sink ? 0.55 : S.ground ? 0 : 1;
    const top = thin ? c.cloud([[24 - k, 30, 7], [34, 23 - (k % 2), 9], [48, 19, 10], [62, 18 + (k % 2), 9], [75, 21, 7], [86 + k * 0.5, 27, 5]].map(([x, y, r]) => [x, y + (S.charge ? -2 : 0) + (S.sink ? 6 : 0), n(r * (S.hurt ? 0.85 : 1) * (S.sink ? 0.8 : 1))]), c.body(S.charge ? '#4e4a68' : cloud, 0.3, -0.2), S.sink ? 0.7 : undefined) : '';
    const bottom = thin ? c.cloud([[18 + k, 66, 6], [28, 70, 7], [40, 72, 7], [52, 72, 6], [62 - k, 70, 5]].map(([x, y, r]) => [x, y + (S.sink ? 4 : 0), n(r * (S.sink ? 0.7 : 1))]), c.body(cloud, 0.3, -0.25), S.sink ? 0.6 : undefined) : '';
    const hl = thin ? c.En(48, 14, 6, 2.2, '#a9a4c4', 0.6) + c.En(66, 13, 4, 1.8, '#a9a4c4', 0.6) : '';
    let fx = '';
    const sn = rot(add(add(snout, S.o[0], S.o[1]), 2, 6 + S.jaw * 0.5), S.o, S.p);
    if (S.charge) fx = bolt([[40, 22], [44, 28], [41, 31], [46, 36]], 1.6) + bolt([[66, 16], [70, 22], [67, 25]], 1.6) + `<circle cx="${n(sn[0])}" cy="${n(sn[1])}" r="7" fill="#fff6c0" opacity=".7" stroke="none" ${c.soft()}/>` + c.spark(n(sn[0] + 4), n(sn[1] - 4), 1.6, '#fff6c0');
    if (S.strike) fx = bolt([[sn[0], sn[1]], [sn[0] + 4, sn[1] + 10], [sn[0] - 1, sn[1] + 16], [sn[0] + 6, sn[1] + 26], [sn[0] + 2, sn[1] + 32], [sn[0] + 8, 88]].map((q) => q.map(n)), 3.2) +
      `<ellipse cx="${n(sn[0] + 8)}" cy="86" rx="14" ry="5" fill="#fff6c0" opacity=".6" stroke="none" ${c.soft()}/>` + c.L(`M${n(sn[0])} 86l-6-3M${n(sn[0] + 16)} 86l6-3`, '#fff6c0', 1.8);
    if (S.hurt) fx = bolt([[30, 30], [26, 22], [30, 18], [26, 10]], 1.6) + bolt([[80, 30], [86, 24], [84, 20]], 1.6) + c.L('M94 40l4-3M94 48l5 0', '#fff', 1.8) + c.mist([[20, 20, 3], [86, 16, 2.6]], '#a9a4c4', 0.6);
    if (S.sink) fx = c.L('M30 8l0-6M50 6l0-6M70 8l0-6', '#ffffff', 1.6, ' opacity=".55"') + c.mist([[16, 24, 3], [88, 20, 2.6], [90, 36, 2]], '#a9a4c4', 0.5);
    if (S.ground) fx = c.mist([[24, 54, 4], [40, 48, 4.4], [60, 46, 4], [78, 52, 3.4]], '#a9a4c4', 0.45) + c.spark(46, 82, 1.2, '#fff6c0') + bolt([[62, 80], [64, 77], [62, 75]], 1.2);
    return c.out(top + hl + (S.strike ? '' : fx) + whale + bottom + (S.strike ? fx : ''));
  };
  D.tempest_whale.frames = true;
})();
