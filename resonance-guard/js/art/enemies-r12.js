'use strict';

/* =========================================================
 * 적 그림 — 1지역 솔빛 들판 · 2지역 서리 고개 (공용 도구: enemies.js)
 * 프레임(docs/design/animation.md §2.2·§2.5):
 *   walk0~walk3 걷기 한 바퀴(walk0 = 서 있기) · aim 공격 직전 · attack 공격 순간
 *   die0 맞고 휘청 · die1 쓰러짐·깨짐·터짐 · die2 남은 모습
 * 짜임: 적마다 "자세 표"(몸 기울기·관절 목표점·무기 각도)를 두고, 같은 그리기 함수가 표를 읽어 그림.
 *   팔다리는 뿌리(어깨·엉덩이) → 관절(IK) → 끝(손·발) 두 마디로 잇고, 무기는 손 좌표에서 돌려 쥠.
 * 빛: 늘 왼쪽 위(§2.6). 몸이 돌아가도 그라데이션 중심을 되돌려 빛 방향을 지킴.
 *   땅에 떨어지는 그림자는 그리지 않음(렌더러 몫). 몸 아래쪽 형태 그림자·발끝 접지 그늘만 그림.
 * ========================================================= */
(() => {
  const { H, OL, sh, GREY, GREY_L, MISTC, HALO, GREEN, ICE, ICE_L, make, g } = RG.art._en;
  const D = RG.art._en.D;
  const MOTION = RG.art._en.MOTION || (RG.art._en.MOTION = {});

  /* =========================================================
   * 짜임 도우미 (이 파일 전용)
   * ========================================================= */
  const n = H.n;
  const RAD = Math.PI / 180;
  const pt = (p) => `${n(p[0])} ${n(p[1])}`;
  const pol = (p, len, deg) => [p[0] + Math.cos(deg * RAD) * len, p[1] + Math.sin(deg * RAD) * len];
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
  const angOf = (a, b) => Math.atan2(b[1] - a[1], b[0] - a[0]) / RAD;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /** 두 마디 IK: 뿌리 a → 끝 b, 마디 길이 l1·l2. bend +1이면 관절이 a→b 방향의 왼쪽(아래로 뻗을 때 앞쪽 = 무릎) */
  function ik(a, b, l1, l2, bend) {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const d = clamp(Math.hypot(dx, dy), Math.abs(l1 - l2) + 0.01, l1 + l2 - 0.01);
    const base = Math.atan2(dy, dx);
    const k = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
    const t = base - bend * k;
    return [a[0] + Math.cos(t) * l1, a[1] + Math.sin(t) * l1];
  }

  /** 몸 좌표계: 기준점 (cx,cy)에서 크기(sx,sy) → 회전 rot → 이동(dx,dy). f(점)=세계 좌표, f.g(그림)=같은 변환으로 감쌈 */
  function frame(dx = 0, dy = 0, rot = 0, cx = 50, cy = 90, sx = 1, sy = 1) {
    const cs = Math.cos(rot * RAD);
    const sn = Math.sin(rot * RAD);
    const f = (p) => {
      const x = (p[0] - cx) * sx;
      const y = (p[1] - cy) * sy;
      return [cx + x * cs - y * sn + dx, cy + x * sn + y * cs + dy];
    };
    f.rot = rot; f.sx = sx; f.sy = sy;
    f.t = `translate(${n(dx)} ${n(dy)}) rotate(${n(rot)} ${n(cx)} ${n(cy)})` +
      (sx !== 1 || sy !== 1 ? ` translate(${n(cx)} ${n(cy)}) scale(${sx} ${sy}) translate(${n(-cx)} ${n(-cy)})` : '');
    f.g = (body) => `<g transform="${f.t}">${body}</g>`;
    f.flip = Math.sign(sx * sy) || 1;
    return f;
  }
  /** 몸 안의 부분 좌표계(머리 등): 부모 f 안에서 (cx,cy) 기준 rot만큼 */
  function sub(f, rot, cx, cy, dx = 0, dy = 0) {
    const s = frame(dx, dy, rot, cx, cy);
    const w = (p) => f(s(p));
    w.rot = f.rot + rot * f.flip; w.sx = f.sx; w.sy = f.sy; w.flip = f.flip;
    w.t = `${f.t} ${s.t}`;
    w.g = (body) => f.g(`<g transform="${s.t}">${body}</g>`);
    return w;
  }

  /** 빛(왼쪽 위)을 몸 좌표계 안에서 본 그라데이션 중심 */
  function litC(f, lx0 = -0.17, ly0 = -0.23) {
    const r = -(f ? f.rot : 0) * RAD;
    let lx = lx0 * Math.cos(r) - ly0 * Math.sin(r);
    let ly = lx0 * Math.sin(r) + ly0 * Math.cos(r);
    if (f && f.sx < 0) lx = -lx;
    if (f && f.sy < 0) ly = -ly;
    return [n(0.5 + lx), n(0.5 + ly)];
  }
  /** 빛 방향을 지키는 몸통 그라데이션 */
  const lit = (c, base, f, hi = 0.42, lo = -0.42, r = 0.9) => { const [x, y] = litC(f); return c.body(base, hi, lo, x, y, r); };
  /** 팔다리용: 위는 밝고 발끝은 접지 그늘로 어두움 */
  const legG = (c, base, hi = 0.18, lo = -0.42) => c.lin([[0, sh(base, hi)], [0.55, base], [1, sh(base, lo)]]);

  /** 원 경로(시계 방향, cap()과 같은 감김) */
  const circ = (p, r) => `M${n(p[0] - r)} ${n(p[1])}A${n(r)} ${n(r)} 0 1 0 ${n(p[0] + r)} ${n(p[1])}A${n(r)} ${n(r)} 0 1 0 ${n(p[0] - r)} ${n(p[1])}Z`;
  /** 굵기가 변하는 막대(캡슐) 경로: p1(반지름 r1) → p2(r2) */
  function cap(p1, r1, p2, r2) {
    const dx = p2[0] - p1[0];
    const dy = p2[1] - p1[1];
    const d = Math.hypot(dx, dy);
    if (d <= Math.abs(r1 - r2) + 0.05) return r1 > r2 ? circ(p1, r1) : circ(p2, r2);
    const a = Math.atan2(dy, dx);
    const o = Math.acos(clamp((r1 - r2) / d, -1, 1));
    const P = (p, r, t) => pt([p[0] + Math.cos(t) * r, p[1] + Math.sin(t) * r]);
    const big2 = o > Math.PI / 2 ? 1 : 0;
    return `M${P(p1, r1, a + o)}L${P(p2, r2, a + o)}A${n(r2)} ${n(r2)} 0 ${big2} 0 ${P(p2, r2, a - o)}L${P(p1, r1, a - o)}A${n(r1)} ${n(r1)} 0 ${1 - big2} 0 ${P(p1, r1, a + o)}Z`;
  }
  /** 점들을 따라 굵기가 r0→r1로 줄어드는 띠(꼬리·덩굴·뿌리) */
  function taper(pts, r0, r1) {
    const N = pts.length;
    const Ls = [];
    const Rs = [];
    for (let i = 0; i < N; i++) {
      const p = pts[i];
      const q0 = pts[Math.max(0, i - 1)];
      const q1 = pts[Math.min(N - 1, i + 1)];
      const a = Math.atan2(q1[1] - q0[1], q1[0] - q0[0]);
      const r = r0 + (r1 - r0) * (i / (N - 1));
      Ls.push([p[0] + Math.sin(a) * r, p[1] - Math.cos(a) * r]);
      Rs.push([p[0] - Math.sin(a) * r, p[1] + Math.cos(a) * r]);
    }
    return `M${Ls.map(pt).join('L')}A${n(r1)} ${n(r1)} 0 0 1 ${pt(Rs[N - 1])}L${Rs.reverse().map(pt).join('L')}A${n(r0)} ${n(r0)} 0 0 1 ${pt(Ls[0])}Z`;
  }
  /** 점마다 반지름이 다른 관(벌레 몸통 등): pts와 radii 길이가 같음 */
  function tube(pts, radii) {
    const N = pts.length;
    const Ls = [];
    const Rs = [];
    for (let i = 0; i < N; i++) {
      const q0 = pts[Math.max(0, i - 1)];
      const q1 = pts[Math.min(N - 1, i + 1)];
      const a = Math.atan2(q1[1] - q0[1], q1[0] - q0[0]);
      const r = radii[i];
      Ls.push([pts[i][0] + Math.sin(a) * r, pts[i][1] - Math.cos(a) * r]);
      Rs.push([pts[i][0] - Math.sin(a) * r, pts[i][1] + Math.cos(a) * r]);
    }
    const r0 = radii[0];
    const r1 = radii[N - 1];
    return `M${Ls.map(pt).join('L')}A${n(r1)} ${n(r1)} 0 0 1 ${pt(Rs[N - 1])}L${Rs.reverse().map(pt).join('L')}A${n(r0)} ${n(r0)} 0 0 1 ${pt(Ls[0])}Z`;
  }
  /** 3차 베지어 위의 점 N+1개 */
  function bez(p0, p1, p2, p3, N = 10) {
    const out = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const u = 1 - t;
      out.push([u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
        u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]]);
    }
    return out;
  }
  const paths = (ds) => ds.map((d) => `<path d="${d}"/>`).join('');
  /** 여러 조각을 이음매 없는 한 덩어리로: 외곽선을 모두 먼저, 면은 그 위에 */
  const blob = (c, ds, fill) => `<g fill="${OL}" stroke-width="${n(c.ow * 2)}">${paths(ds)}</g><g fill="${fill}" stroke="none">${paths(ds)}</g>`;
  /** 서로 다른 좌표계의 덩어리들을 이음매 없이: items = [[감싸개(f.g 등), d, 면], ...] — 외곽선 먼저 모두, 면은 위에 */
  const fuse = (c, items) => items.map(([w, d]) => w(`<path d="${d}" fill="${OL}" stroke-width="${n(c.ow * 2)}"/>`)).join('') +
    items.map(([w, d, fill]) => w(`<path d="${d}" fill="${fill}" stroke="none"/>`)).join('');
  /** 두 마디 팔다리 조각: 뿌리 a(r0) → 관절 j(r1) → 끝 e(r2) */
  const seg2 = (a, j, e, r0, r1, r2) => [cap(a, r0, j, r1), cap(j, r1, e, r2)];

  /**
   * 형태 그림자: 몸 모양 d(몸 좌표계 f) 안쪽에만, 세계 좌표로 오른쪽 아래 그늘과 왼쪽 위 반사광.
   * box: 세계 좌표 [가운데x, 가운데y, 반폭, 반높이]
   */
  function form(c, d, f, box, dark = 0.3, light = 0.22) {
    const id = H.uid('ec');
    const [x, y, w, h] = box;
    return `<clipPath id="${id}"><path d="${d}"${f ? ` transform="${f.t}"` : ''}/></clipPath>` +
      `<g clip-path="url(#${id})" stroke="none">` +
      `<ellipse cx="${n(x + w * 0.35)}" cy="${n(y + h * 0.95)}" rx="${n(w * 1.05)}" ry="${n(h * 0.62)}" fill="${OL}" opacity="${dark}" ${c.soft()}/>` +
      (light ? `<ellipse cx="${n(x - w * 0.35)}" cy="${n(y - h * 0.55)}" rx="${n(w * 0.55)}" ry="${n(h * 0.35)}" fill="#fff" opacity="${light}" ${c.soft()}/>` : '') +
      '</g>';
  }
  /** 모양 d(변환 t) 안쪽에만 그리기 */
  function inside(d, t, body) {
    const id = H.uid('ec');
    return `<clipPath id="${id}"><path d="${d}"${t ? ` transform="${t}"` : ''}/></clipPath><g clip-path="url(#${id})" stroke="none">${body}</g>`;
  }
  /** 흐린 그늘 덩어리(외곽선 없음) */
  const shadeE = (c, x, y, rx, ry, op = 0.25, col = OL) => `<ellipse cx="${n(x)}" cy="${n(y)}" rx="${n(rx)}" ry="${n(ry)}" fill="${col}" opacity="${op}" stroke="none" ${c.soft()}/>`;
  /** 빛나는 눈이 꺼져 가는 모습(죽음): 감긴 눈 */
  const deadEye = (c, x, y, r) => c.L(`M${n(x - r)} ${n(y)}Q${n(x)} ${n(y + r * 0.9)} ${n(x + r)} ${n(y)}`, OL, 1.8);
  /** 맞는 순간 번쩍(작은 별) */
  function hitStar(c, x, y, r, col = '#ffffff') {
    let d = '';
    for (let i = 0; i < 8; i++) {
      const a = i * 45 * RAD;
      const rr = i % 2 ? r * 0.45 : r;
      d += `${i ? 'L' : 'M'}${n(x + Math.cos(a) * rr)} ${n(y + Math.sin(a) * rr)}`;
    }
    return `<path d="${d}Z" fill="${col}" stroke="${OL}" stroke-width="1.6" opacity=".95"/>`;
  }
  /** 휘두름 궤적(초승달) — 중심 (x,y), 반지름 r, 각도 a0→a1(도) */
  function swoosh(c, x, y, r, a0, a1, w = 6, col = '#ffffff', op = 0.75) {
    const p = (a, rr) => pt([x + Math.cos(a * RAD) * rr, y + Math.sin(a * RAD) * rr]);
    const big = Math.abs(a1 - a0) > 180 ? 1 : 0;
    const sw = a1 > a0 ? 1 : 0;
    const m = (a0 + a1) / 2;
    return `<path d="M${p(a0, r)}A${r} ${r} 0 ${big} ${sw} ${p(a1, r)}Q${p(m, r - w * 1.4)} ${p(a0, r)}Z" fill="${col}" opacity="${op}" stroke="none"/>`;
  }
  /** 목표점: 배열이면 세계 좌표, {L:[x,y]}이면 몸 좌표계 F의 점 */
  const tgt = (q, F) => (Array.isArray(q) ? q : F(q.L));
  /** 쥔 주먹(장갑·건틀릿): 손 p, 아래팔 방향 a(도). 자루 위에 그려서 손가락이 감싼 모양 */
  function fist(c, p, a, r, fill, knuckle = OL) {
    const k1 = pol(p, r * 0.55, a + 70);
    const k2 = pol(p, r * 0.55, a - 70);
    return c.E(p[0], p[1], n(r * 1.12), n(r), fill, ` transform="rotate(${n(a)} ${n(p[0])} ${n(p[1])})"`) +
      c.L(`M${pt(lerp(k1, p, 0.1))}L${pt(lerp(k2, p, 0.1))}`, knuckle, 1.5, ' opacity=".55"');
  }
  /** 무기 그리기: 손 p에 쥔 자루, a도(0=자루가 위로) 돌림. body는 손 기준 좌표(자루 = y축, 위가 -) */
  const held = (p, a, body) => `<g transform="translate(${n(p[0])} ${n(p[1])}) rotate(${n(a)})">${body}</g>`;
  /** 그림 전체를 발 기준선(y=90)에 맞춰 줄이기/옮기기 */
  const fit = (body, k, cx = 50, dx = 0) => `<g transform="translate(${n(dx)} 0) translate(${cx} 90) scale(${k}) translate(${-cx} -90)">${body}</g>`;
  /** 속도선 */
  const speed = (c, lines, col = MISTC, w = 2.2, op = 0.8) => c.L(lines.map(([x, y, l]) => `M${x} ${y}h${-l}`).join(''), col, w, ` opacity="${op}"`);

  /* =========================================================
   * 1지역 · 솔빛 들판
   * ========================================================= */

  /* ---------- 01 안개 쥐: 종종 뛰는 네발(대각선 짝) · 앞니로 물어뜯기 · 죽으면 뒤집혀 발랑 ---------- */
  MOTION.mist_rat = { gait: 'scuttle', bob: 0.03, tilt: 2, sway: 0, squash: 0.04, deathFx: 'mist', deathTime: 0.6 };
  D.mist_rat = (fr) => {
    const c = make(3.2);
    const G = 90 - c.ow / 2;
    const fur = GREY;
    const furD = sh(GREY, -0.32);
    const pink = '#d9a3b5';
    // f: 몸 [dx, dy, 회전, 기준x, 기준y, sx, sy] · h 머리 · jaw 입 · ear 귀 · tl 꼬리끝 · 발: [x, 들림] 또는 {L:[몸 좌표 손목], T:[몸 좌표 발끝]}
    const P = {
      walk0: { f: [0, 0, 0], h: 0, jaw: 3, ear: 0, tl: [0, 0], nf: [75, 0], ff: [61, 0.6], nh: [31, 0.6], fh: [41, 0] },
      walk1: { f: [0, -1.4, -1.5], h: 3, jaw: 3, ear: 4, tl: [3, -3], nf: [68, 0], ff: [68, 5], nh: [40, 5], fh: [35, 0] },
      walk2: { f: [0, 0, 0], h: 0, jaw: 3, ear: 0, tl: [0, 2], nf: [61, 0.6], ff: [73, 0], nh: [44, 0], fh: [28, 0.6] },
      walk3: { f: [0, -1.4, 1.5], h: -3, jaw: 3, ear: -4, tl: [-3, -3], nf: [71, 5], ff: [64, 0], nh: [36, 0], fh: [37, 5] },
      // 공격 직전: 엉덩이를 낮추고 앞몸을 들어 입을 크게 벌림, 앞발 발톱을 세움, 귀는 뒤로
      aim: { f: [-5, -1, -17, 34, 84], h: -8, jaw: 34, ear: -30, tl: [10, -2], nf: { L: [80, 74], T: [85, 72] }, ff: { L: [76, 76], T: [81, 75] }, nh: [33, 0], fh: [28, 0] },
      // 물어뜯기: 몸을 앞으로 쭉 뻗어 덮침, 뒷발은 뒤로 차고 앞발은 앞으로
      attack: { f: [5, 1, 8, 34, 84, 1.05], h: 8, jaw: 24, ear: -12, tl: [6, 8], nf: [88, 3], ff: [83, 0], nh: [25, 0], fh: [29, 2.5], bite: true },
      // 맞고 휘청: 머리가 뒤로 젖혀지고 앞발이 들림
      die0: { f: [-4, -2, -12, 30, 84], h: -24, jaw: 26, ear: -30, tl: [9, 2], nf: { L: [74, 82], T: [76, 87] }, ff: { L: [70, 84], T: [72, 88] }, nh: [32, 0], fh: [25, 1.5], hurt: true },
      // 뒤로 넘어감: 엉덩이를 축으로 몸이 뒤로 젖혀지며 네 발이 허공을 휘저음
      die1: { f: [6, 1, -38, 26, 84], h: -14, jaw: 18, ear: -30, tl: [14, 6], nf: { L: [78, 80], T: [83, 82] }, ff: { L: [72, 86], T: [75, 90] }, nh: { L: [48, 86], T: [54, 83] }, fh: { L: [42, 89], T: [47, 88] }, dead: true },
      // 발랑 뒤집힘: 배를 위로, 다리를 오므려 하늘로, 안개가 빠져나감
      die2: { f: [0, 6, 0, 50, 69, 1, -1], h: 8, jaw: 6, ear: 10, tl: [0, 0], tailW: [[22, 76], [14, 82], [10, 88], [4, 87]], nf: { L: [70, 82], T: [67, 85] }, ff: { L: [65, 84], T: [62, 87] }, nh: { L: [46, 88], T: [52, 87] }, fh: { L: [40, 89], T: [45, 89] }, dead: true, gone: true },
    };
    const p = P[fr] || P.walk0;
    const F = frame(...p.f.slice(0, 3), p.f[3] ?? 38, p.f[4] ?? 76, p.f[5] ?? 1, p.f[6] ?? 1);
    const HF = sub(F, p.h, 68, 64);
    const bodyD = 'M18 74C16 62 28 54 44 54C56 54 64 57 70 62L72 74C68 80 60 84 48 84C34 85 22 83 18 74Z';

    // 앞다리: 어깨 → 팔꿈치(뒤로 굽음) → 손목 → 발
    const frontLeg = (sh0, q, col, r = 1) => {
      const S = F(sh0);
      let W;
      let Tp;
      if (Array.isArray(q)) { W = [q[0] - 1, G - 2.4 - q[1]]; Tp = [q[0] + 3, G - 1.8 - q[1] + (q[1] > 2 ? 1.5 : 0)]; } else { W = F(q.L); Tp = F(q.T); }
      const E = ik(S, W, 7, 6.6, -F.flip);
      return blob(c, [...seg2(S, E, W, 3.3 * r, 2.5 * r, 2.1 * r), cap(W, 2.3 * r, Tp, 1.7 * r)], legG(c, col)) +
        c.L(`M${pt(Tp)}l1.6 1.2M${pt(add(Tp, [-0.6, 0.4]))}l0.6 1.8`, '#f4eef6', 1.5);
    };
    // 뒷다리: 엉덩이 → 무릎(앞으로) → 발뒤꿈치 → 긴 발
    const hindLeg = (h0, q, col, r = 1) => {
      const Hh = F(h0);
      let J;
      let Tp;
      if (Array.isArray(q)) {
        J = q[1] > 1 ? [q[0] - 5, G - 4.5 - q[1]] : [q[0] - 6, G - 2.4 - q[1]];
        Tp = q[1] > 1 ? [q[0] + 2.5, G - 1.8 - q[1] + 1.2] : [q[0] + 3, G - 1.8 - q[1]];
      } else { J = F(q.L); Tp = F(q.T); }
      const K = ik(Hh, J, 8, 6.2, F.flip);
      return blob(c, [cap(Hh, 6.2 * r, K, 3.4 * r), cap(K, 3.4 * r, J, 2.2 * r), cap(J, 2.3 * r, Tp, 1.8 * r)], legG(c, col, 0.1)) +
        c.L(`M${pt(Tp)}l1.8 0.8`, '#f4eef6', 1.5);
    };

    // 꼬리: 엉덩이에서 뒤로 휘어 올라가 끝에서 안개로 흩어짐
    const tb = F([20, 72]);
    const tip = p.tailW ? p.tailW[3] : add(F([6, 50]), p.tl);
    const tailPts = p.tailW ? bez(F([20, 72]), ...p.tailW.slice(1), 12) : bez(tb, add(F([8, 78]), [p.tl[0] * 0.3, 0]), add(F([0, 62]), [p.tl[0] * 0.6, p.tl[1] * 0.5]), tip, 12);
    let s = c.P(taper(tailPts, 3, 1.3), legG(c, sh(GREY, -0.08), 0.15, -0.25)) +
      c.L(`M${pt(tailPts[3])}l1.5 1.5M${pt(tailPts[6])}l1.5 1M${pt(tailPts[9])}l1.4 0.4`, sh(GREY, -0.35), 1.5) +
      c.mist([[tip[0], tip[1], 4.6], [tip[0] - 4, tip[1] - 5, 3.6], [tip[0] + 4, tip[1] - 6, 2.8], [tip[0] + 1, tip[1] - 11, 2]], MISTC, p.gone ? 0.5 : 0.88);

    s += hindLeg([33, 73], p.fh, furD, 0.92) + frontLeg([61, 71], p.ff, furD, 0.92);

    // 몸통 + 배 + 털결
    s += F.g(c.P(bodyD, lit(c, fur, F)));
    const bc = F([45, 70]);
    s += form(c, bodyD, F, [bc[0], bc[1], 27, 15], 0.3, 0.2);
    s += F.g(
      c.Pn('M26 78C34 83 54 84 66 78C60 82 36 85 26 78Z', GREY_L, 0.6) +
      c.L('M30 58l-2.5-3M38 55.5l-1.5-3.2M46 55l-0.5-3.4M24 63l-3-2', sh(GREY, -0.3), 1.6) +
      c.shine(36, 60, 9, 3.4, 0.4)
    );

    // 머리: 아래턱(경첩) → 입속 → 머리뼈 → 코·눈·수염·앞니
    const jawT = `rotate(${p.jaw} 79 69)`;
    s += HF.g(
      c.P('M64 60C61 54 63 48 66 46C69 47 71 51 71 55Z', sh(fur, -0.25)) + // 먼 쪽 귀
      (p.jaw > 8 ? c.P('M76 66L93 67L90 74L78 73Z', '#3a1e2e') + c.P('M90 70.5L93.4 70.2L92.6 73L90.6 73.2Z', '#fffbe8') : '') +
      g(c.P('M77 68L92 69C92.5 72 89 74.5 85 74.5L79 73.5C77 72.5 76 70.5 77 68Z', sh(fur, -0.12)) +
        c.P('M89.5 69.2L92.5 69.4L92 73.2L90 73.4Z', '#fffbe8'), jawT) +
      c.P('M64 66C62 57 69 51 77 52C84 53 90 58 95 65C96 68 94 70 91 70L80 71C72 72 66 71 64 66Z', lit(c, fur, HF, 0.45)) +
      c.Pn('M66 67C72 70 84 70 92 69C86 72 72 73 66 67Z', OL, 0.18) +
      g(c.E(70, 53, 7.2, 7.8, lit(c, fur, HF)) + c.En(70.6, 54, 4.2, 5, pink), `rotate(${p.ear} 70 60)`) +
      c.E(95.4, 65.3, 2.5, 2.1, pink) +
      c.L('M88 66l9-3.5M88.5 67.5l9.5 0.5', '#e9e4f2', 1.5, ' opacity=".85"') +
      (p.dead ? deadEye(c, 83, 60.5, 3) : c.eye(83, 60, p.hurt ? 4 : 3.5))
    );
    if (p.bite) s += hitStar(c, 97, 74, 5) + c.L('M93 79l5 3M95 76l5 0', '#fff', 2, ' opacity=".9"');
    if (p.hurt) s += hitStar(c, 46, 58, 6);

    s += hindLeg([37, 74], p.nh, fur) + frontLeg([65, 72], p.nf, fur);
    if (fr === 'attack') s += speed(c, [[16, 66, 10], [14, 74, 12], [18, 82, 8]]);
    if (p.gone) s += c.mist([[44, 50, 4], [52, 44, 3.2], [40, 40, 2.6], [58, 36, 2]], MISTC, 0.55);
    return c.out(fit(s, 0.9, 50, -1));
  };
  D.mist_rat.frames = true;

  /* ---------- 02 잿빛 멧돼지: 묵직한 속보 · 앞발로 땅을 긁다 엄니로 들이받기 · 죽으면 무릎 꿇고 엎어짐 ---------- */
  MOTION.ash_boar = { gait: 'trot', bob: 0.05, tilt: 2, sway: 0, squash: 0.03, deathFx: 'ash', deathTime: 0.8 };
  D.ash_boar = (fr) => {
    const c = make(3);
    const G = 90 - c.ow / 2;
    const fur = '#8b817d';
    const furD = sh(fur, -0.32);
    const hoofC = '#3d3540';
    const stone = c.lin([[0, '#ece8de'], [1, '#9c978c']], 'h');
    // f 몸 · h 머리 · jaw 입 · mh 갈기 높이 · 발 [x, 들림] 또는 {L:[몸 좌표 발목], T:[몸 좌표 발굽 끝]}
    const P = {
      walk0: { f: [0, 0, 0], h: 0, jaw: 2, mh: 1, nf: [70, 0], ff: [55, 0.6], nh: [24, 0.6], fh: [32, 0] },
      walk1: { f: [0, -1.6, -1], h: 2, jaw: 2, mh: 1.05, nf: [64, 0], ff: [63, 5], nh: [32, 5], fh: [26, 0] },
      walk2: { f: [0, 0, 0], h: 0, jaw: 2, mh: 1, nf: [57, 0.6], ff: [67, 0], nh: [36, 0], fh: [20, 0.6] },
      walk3: { f: [0, -1.6, 1], h: -2, jaw: 2, mh: 1.05, nf: [66, 5], ff: [60, 0], nh: [29, 0], fh: [28, 5] },
      // 돌진 준비: 머리를 낮춰 엄니를 앞으로, 앞발로 땅을 긁고(흙먼지), 갈기가 곤두섬, 콧김
      aim: { f: [-5, 1, 6, 30, 80], h: 16, jaw: 4, mh: 1.55, nf: { L: [56, 80], T: [50, 84] }, ff: [64, 0], nh: [20, 0], fh: [25, 0], dust: true, snort: true },
      // 들이받기: 몸을 앞으로 내던지며 머리를 쳐올려 엄니로 찌름
      attack: { f: [6, -2, -6, 30, 80], h: -24, jaw: 12, mh: 1.25, nf: { L: [76, 76], T: [80, 81] }, ff: [79, 0], nh: [15, 0], fh: [20, 1.2], gore: true },
      // 맞고 휘청: 머리가 젖혀지고 꽥 소리, 앞발이 들림
      die0: { f: [-4, -1, -7, 30, 80], h: -18, jaw: 22, mh: 1.1, nf: [70, 5], ff: [62, 0], nh: [28, 0], fh: [22, 1.5], hurt: true },
      // 앞무릎이 꺾여 털썩 주저앉음, 코끝이 땅으로
      die1: { f: [-1, 8, 7, 30, 80], h: 16, jaw: 8, mh: 0.75, nf: { L: [58, 82], T: [52, 82] }, ff: { L: [55, 81], T: [49, 81] }, nh: [27, 0], fh: [22, 0.6], dead: true },
      // 배를 깔고 엎어짐: 다리를 접고 머리를 땅에, 갈기는 재가 되어 흩어짐
      die2: { f: [0, 11, 2, 30, 80], h: 13, jaw: 4, mh: 0.45, nf: { L: [60, 81], T: [53, 83] }, ff: { L: [57, 80], T: [50, 82] }, nh: { L: [38, 82], T: [45, 84] }, fh: { L: [34, 81], T: [41, 83] }, dead: true, gone: true },
    };
    const p = P[fr] || P.walk0;
    const F = frame(...p.f.slice(0, 3), p.f[3] ?? 30, p.f[4] ?? 78);
    const HF = sub(F, p.h, 64, 54);
    const bodyD = 'M14 62C12 50 20 43 32 43C42 39 54 37 63 41C72 45 75 55 73 65C71 74 63 79 51 79L31 79C20 78 15 71 14 62Z';

    // 발굽: 발목 W에서 아래로, 갈라진 굽
    const hoof = (W, a) => g(c.P('M-3.4 0L3.4 0L4.4 4.6L-3.8 4.6Z', hoofC) + c.L('M0.6 1.4L0.8 4.4', sh(hoofC, 0.35), 1.5), `translate(${pt(W)}) rotate(${n(a)})`);
    const footAt = (q) => {
      if (Array.isArray(q)) {
        const lifted = q[1] > 1.5;
        return { W: [q[0], G - 4.6 - q[1]], a: lifted ? -32 : 0 };
      }
      const W = F(q.L);
      const T = F(q.T);
      return { W, a: angOf(W, T) - 90 + (T[0] < W[0] ? 0 : 0) };
    };
    const frontLeg = (root, q, col, r = 1) => {
      const S = F(root);
      const { W, a } = footAt(q);
      const E = ik(S, W, 8.5, 8, -1);
      return blob(c, seg2(S, E, W, 4.8 * r, 3.6 * r, 3 * r), legG(c, col)) + hoof(W, a);
    };
    const hindLeg = (root, q, col, r = 1) => {
      const Hh = F(root);
      const { W, a } = footAt(q);
      const J = add(W, Array.isArray(q) ? [-3, -6.5] : [0, 0]);
      const K = ik(Hh, Array.isArray(q) ? J : W, 9.5, 7.5, 1);
      const parts = Array.isArray(q) ? [cap(Hh, 7.5 * r, K, 4.2 * r), cap(K, 4.2 * r, J, 3.1 * r), cap(J, 3.1 * r, W, 2.9 * r)] : [cap(Hh, 7.5 * r, K, 4.2 * r), cap(K, 4.2 * r, W, 3 * r)];
      return blob(c, parts, legG(c, col, 0.05)) + hoof(W, a);
    };
    // 갈기: 목덜미에서 등 가운데까지 뾰족한 털뭉치, mh로 곤두섬
    const maneD = (() => {
      const base = bez([22, 47], [32, 40], [50, 34], [68, 42], 6);
      let d = `M${pt(base[0])}`;
      for (let i = 0; i < base.length - 1; i++) {
        const m = lerp(base[i], base[i + 1], 0.5);
        const hgt = (5 + Math.sin((i / 5) * Math.PI) * 8) * p.mh;
        d += `Q${pt([m[0] + 2, m[1] - hgt * 0.5])} ${pt([m[0] - 4 * p.mh, m[1] - hgt])}Q${pt([m[0] - 1, m[1] - hgt * 0.35])} ${pt(base[i + 1])}`;
      }
      return `${d}L66 47C50 42 34 46 24 51Z`;
    })();

    let s = '';
    // 꼬리(짧고 꼬불)
    const tb = F([15, 56]);
    s += c.P(taper(bez(tb, add(tb, [-6, -2]), add(tb, [-9, 4]), add(tb, [-5, 7]), 8), 1.9, 1.3), sh(fur, -0.15)) + c.mist([[tb[0] - 5, tb[1] + 8, 2.4]], MISTC, 0.7);
    s += hindLeg([27, 65], p.fh, furD, 0.92) + frontLeg([59, 67], p.ff, furD, 0.92);
    // 몸통
    s += F.g(c.P(bodyD, lit(c, fur, F, 0.38)));
    const bc = F([44, 60]);
    s += form(c, bodyD, F, [bc[0], bc[1], 30, 18], 0.34, 0.16);
    s += F.g(
      c.Pn('M22 74C32 79 52 80 66 74C60 79 34 81 22 74Z', sh(fur, 0.3), 0.45) +
      c.L('M30 52l-2 4M38 49l-1.5 4.5M46 47l-1 4.5M26 60l-2.5 2.5M56 48l0 4', sh(fur, -0.35), 1.6) +
      c.mist(p.gone ? [] : [[30, 40 - 4 * p.mh, 2.6], [44, 34 - 6 * p.mh, 3], [58, 35 - 5 * p.mh, 2.4]], MISTC, 0.7) +
      c.P(maneD, c.lin([[0, '#f6f4fc', p.gone ? 0.6 : 1], [1, '#a9a3c0', p.gone ? 0.6 : 1]]), ' stroke-width="2.4"') +
      c.shine(34, 52, 10, 4, 0.3)
    );
    // 머리
    s += HF.g(
      c.P('M64 46L59 33L69 42Z', sh(fur, -0.3)) +
      (p.jaw > 6 ? c.P('M73 69L92 70L89 77L75 76Z', '#3a1e2e') : '') +
      g(c.P('M72 71L90 73C89 77 84 79 78 78L71 76Z', sh(fur, -0.1)), `rotate(${p.jaw} 76 73)`) +
      c.P('M60 50C66 43 77 45 83 53L91 61C95 64 95 71 91 74L80 75C69 77 61 71 59 62Z', lit(c, fur, HF, 0.36)) +
      c.Pn('M62 64C68 72 80 74 90 72C84 76 68 77 62 64Z', OL, 0.2) +
      c.E(93, 67.5, 3.4, 5.4, '#b9a2a2') + c.En(93.6, 65.6, 1, 1.4, OL) + c.En(93.6, 70.2, 1, 1.4, OL) +
      c.P('M66 46L62 31L73 41Z', lit(c, fur, HF)) + c.Pn('M66.5 43L64 35L70 41Z', '#c9a6a6', 0.8) +
      c.L('M71 51.5Q76 49 81 52', OL, 2) +
      g(c.P('M79 77C82 71 85 63 84 54C90 58 92 69 88 78Z', stone) + c.L('M85 62l2 1.2M86 69l2 0.8', '#7d7870', 1.5), `rotate(${p.jaw} 76 73)`) +
      (p.dead ? deadEye(c, 76.5, 55.5, 2.8) : c.eye(76.5, 55.5, p.hurt ? 3.6 : 3))
    );
    s += hindLeg([31, 66], p.nh, fur) + frontLeg([63, 68], p.nf, fur);
    if (p.dust) s += c.mist([[46, 86, 3.4], [41, 84, 2.6], [37, 87, 2.2], [50, 83, 2]], '#cdbfa8', 0.85);
    if (p.snort) { const sn = HF([96, 70]); s += c.mist([[sn[0] + 2, sn[1] + 3, 2.6], [sn[0] + 5, sn[1] + 7, 2], [sn[0] + 1, sn[1] + 8, 1.6]], MISTC, 0.85); }
    if (p.gore) { const tp = HF([85, 52]); s += hitStar(c, tp[0] + 2, tp[1] - 2, 6) + speed(c, [[18, 52, 10], [14, 62, 12], [10, 86, 9]]) + c.mist([[12, 86, 3.4], [6, 83, 2.6]], '#cdbfa8', 0.85); }
    if (p.hurt) s += hitStar(c, 42, 50, 6.5);
    if (p.gone) s += c.mist([[36, 52, 3.2], [48, 46, 2.6], [58, 40, 2], [42, 40, 1.8]], '#b6aeb8', 0.6);
    return c.out(fit(s, 0.95, 50, 0));
  };
  D.ash_boar.frames = true;

  /* ---------- 03 안개 까마귀: 날갯짓(위→가운데→아래→가운데) · 날개를 치켜들었다 내리꽂으며 쪼기 · 죽으면 날개를 접고 떨어짐 ---------- */
  MOTION.mist_crow = { gait: 'fly', bob: 0.05, hover: 0.45, tilt: 5, sway: 0, squash: 0, deathFx: 'feathers', deathTime: 0.8 };
  D.mist_crow = (fr) => {
    const c = make(3.3);
    const crow = '#4c4858';
    const crowL = sh(crow, 0.14);
    const beakG = c.lin([[0, '#ddd5b6'], [1, '#8f8770']]);
    // f 몸 · h 머리 · beak 부리 벌림 · wn/wf 날개 [각도, 펼침] (각도+ = 위로) · tal 발톱 'tuck'|'fwd'|'strike'|'up'
    const P = {
      walk0: { f: [0, 3, 0], h: 0, beak: 0, wn: [62, 0.88], wf: [76, 0.8], tal: 'tuck' },
      walk1: { f: [0, 0, -2], h: 0, beak: 0, wn: [8, 1.05], wf: [18, 1], tal: 'tuck' },
      walk2: { f: [0, -2.5, 0], h: 2, beak: 0, wn: [-52, 1], wf: [-38, 0.95], tal: 'tuck' },
      walk3: { f: [0, -0.5, 2], h: 0, beak: 0, wn: [26, 0.66], wf: [36, 0.62], tal: 'tuck' },
      // 내리꽂기 직전: 몸을 젖히고 날개를 높이 펼침, 발톱을 앞으로, 부리를 벌려 까악
      aim: { f: [-2, 2, -18, 52, 56], h: -8, beak: 24, wn: [84, 0.86], wf: [98, 0.8], tal: 'fwd' },
      // 쪼기: 머리를 아래로 내리꽂으며 날개를 뒤로 접고 발톱을 내밂
      attack: { f: [1, 6, 24, 52, 56], h: 6, beak: 16, wn: [28, 0.86], wf: [38, 0.8], tal: 'strike', peck: true },
      // 맞음: 깃털이 튀고 날개가 엉킴
      die0: { f: [-1, 2, -16, 52, 56], h: -18, beak: 26, wn: [72, 0.86], wf: [-40, 0.9], tal: 'fwd', hurt: true, feathers: 1 },
      // 날개를 접고 곤두박질
      die1: { f: [-4, 6, 72, 52, 56], h: 12, beak: 10, wn: [6, 0.55], wf: [12, 0.5], tal: 'up', dead: true, feathers: 2 },
      // 땅에 떨어져 모로 누움: 한쪽 날개가 바닥에 펼쳐지고 발은 오그라듦
      die2: { f: [-2, 24, 10, 52, 56], h: 14, beak: 6, wn: [-14, 0.95, 0.55], wf: null, tal: 'up', dead: true, gone: true, feathers: 3 },
    };
    const p = P[fr] || P.walk0;
    const F = frame(...p.f.slice(0, 3), p.f[3] ?? 52, p.f[4] ?? 56);
    const HF = sub(F, p.h, 70, 52);
    const wingD = 'M0 0C-8-10-24-14-40-12L-34-6L-43-2L-34 2L-41 7L-30 8L-32 13L-19 10C-10 9-4 6 0 0Z';
    const wing = (sp, a, k, sy, col, far) => {
      const S = F(sp);
      const rot = a + F.rot;
      const t = `translate(${pt(S)}) rotate(${n(rot)}) scale(${n(k)} ${n(sy ?? 1)})`;
      return `<g transform="${t}">` +
        c.P(wingD, far ? col : c.body(col, 0.32, -0.35, ...litC({ rot, sx: 1, sy: 1 }))) +
        c.L('M-8-3L-30-8M-10 2L-30 3M-8 5L-24 10', far ? sh(col, -0.2) : sh(col, 0.25), 1.5, ' opacity=".8"') +
        c.mist([[-44, -6, 4.2], [-46, 2, 3.6], [-42, 9, 3.2], [-51, -1, 2.4]], MISTC, p.gone ? 0.45 : 0.8) +
        '</g>';
    };
    const talons = () => {
      const mode = p.tal;
      const hip = F([52, 63]);
      let ft;
      if (mode === 'fwd') ft = F([64, 74]);
      else if (mode === 'strike') ft = F([68, 72]);
      else if (mode === 'up') ft = F([50, 58]);
      else ft = F([48, 68]);
      const a = angOf(hip, ft);
      const toes = [-35, 0, 35].map((da) => `M${pt(ft)}L${pt(pol(ft, 4.2, a + da))}`).join('') + `M${pt(ft)}L${pt(pol(ft, 3.4, a + 180 - 20))}`;
      return c.limb(`M${pt(hip)}L${pt(ft)}`, 2.2, '#3a3440') + c.L(toes, '#d9d2b8', 1.8);
    };

    let s = '';
    if (p.wf) s += wing([62, 48], p.wf[0], p.wf[1], p.wf[2], sh(crow, -0.32), true);
    s += talons();
    // 꼬리 깃
    s += F.g(c.P('M31 60L8 51L12 57L5 61L11 65L7 72L33 66Z', lit(c, sh(crow, -0.08), F, 0.25)) + c.L('M28 62L12 58M28 64L12 66', sh(crow, 0.2), 1.5, ' opacity=".7"'));
    // 몸
    const bodyD = 'M21 61C27 48 45 43 60 44C72 45 79 49 83 54C78 62 66 66 54 66C42 68 28 67 21 61Z';
    s += F.g(c.P(bodyD, lit(c, crow, F, 0.35, -0.38)));
    const bc = F([52, 56]);
    s += form(c, bodyD, F, [bc[0], bc[1], 28, 11], 0.32, 0.12);
    s += F.g(c.L('M40 50q4 2 8 0M50 48q4 2 8 0M34 56q4 2 8 0', crowL, 1.5, ' opacity=".7"'));
    // 머리 + 부리
    s += HF.g(
      g(c.P('M85 49L96 48.5L85.5 53Z', beakG), `rotate(${p.beak} 85 49)`) +
      c.E(74, 46, 13, 12, lit(c, crow, HF, 0.36)) +
      c.P('M64 38L60 32L67 36L66 30L71 35Z', crow, ' stroke-width="2"') +
      c.P('M84 41L98 47.5L85 50Z', beakG) + c.L('M86 44.5l5 2', '#7a735e', 1.5) +
      c.Pn('M66 52C72 57 80 57 85 52C82 58 70 59 66 52Z', OL, 0.22) +
      (p.dead ? deadEye(c, 78, 44.5, 3) : c.eye(78, 44, p.hurt ? 4.4 : 3.6))
    );
    s += wing([58, 50], p.wn[0], p.wn[1], p.wn[2], crowL, false);
    if (p.peck) { const bt = HF([98, 49]); s += hitStar(c, bt[0] - 1, bt[1] + 2, 6) + speed(c, [[30, 30, 10], [24, 40, 12], [22, 52, 8]]); }
    if (p.hurt) s += hitStar(c, 50, 50, 6);
    if (p.feathers) {
      const sets = { 1: [[30, 28, -30], [70, 22, 40], [40, 80, 100]], 2: [[30, 30, 20], [74, 26, -50], [24, 56, 80]], 3: [[22, 86, 80], [78, 87, -80], [34, 72, 30]] }[p.feathers];
      s += sets.map(([x, y, a]) => g(c.P('M0-5C2.4-2 2.4 2 0 5C-2.4 2-2.4-2 0-5Z', sh(crow, 0.1)) + c.L('M0-5V5', sh(crow, 0.4), 1.5), `translate(${x} ${y}) rotate(${a})`)).join('');
    }
    if (p.gone) s += c.mist([[50, 66, 3], [60, 60, 2.4], [44, 58, 2]], MISTC, 0.55);
    return c.out(s);
  };
  D.mist_crow.frames = true;

  /* ---------- 04 짚 허수아비: 뻣뻣하게 기우뚱 걷기 · 녹슨 낫을 머리 뒤로 젖혔다 내리 베기 · 죽으면 짚이 흩어지며 주저앉아 옷만 남음 ---------- */
  MOTION.straw_husk = { gait: 'walk', bob: 0.03, tilt: 8, sway: 0.02, squash: 0, deathFx: 'ash', deathTime: 0.9 };
  D.straw_husk = (fr) => {
    const c = make(3);
    const G = 90 - c.ow / 2;
    const straw = '#d8bc6a';
    const strawD = sh(straw, -0.28);
    const shirt = '#88957a';
    const pants = '#6f6a4e';
    const twine = '#b48a4a';
    const glove = '#7a5a3c';
    const wood = '#8a6a48';
    const burlap = '#b9a682';
    const blade = c.lin([[0, '#d6d0cc'], [1, '#7a706c']], 'h');
    const tuftL = (p, a, len = 6, col = straw) => c.L([-28, -8, 12, 30].map((da) => `M${pt(p)}L${pt(pol(p, len, a + da))}`).join(''), col, 1.9);
    // 낫(손 기준, 자루가 위 = -y): 자루 · 쇠고리 · 휜 날 · 녹
    const sickle = c.limb('M0 7L0-12', 3.2, wood) + c.L('M0 4l0 4', sh(wood, -0.3), 1.6) +
      c.P('M-1.6-12.5L1.6-12.5L1.8-15L-1.8-15Z', '#6b6260') +
      c.P('M-1-14C1-22 12-26 20-21C25-17 25-9 21-4C20-11 15-17 9-17C5-17 2-15 1.5-13Z', blade) +
      c.L('M3-17C8-21 16-21 20-15', '#f3efea', 1.5, ' opacity=".8"') + c.En(13, -20, 1.8, 1.2, '#c0683c', 0.9) + c.En(19.5, -11, 1.3, 1, '#c0683c', 0.85);

    if (fr === 'die2') {
      // 남은 모습: 짚이 빠진 옷가지·자루 머리·모자·낫이 바닥에 흩어지고 안개가 빠져나감
      let s = '';
      s += c.L('M14 88l8-3M18 89l9 0M70 89l9-2M84 88l6-4M30 84l-5-4M60 82l4-5M46 88l-3-5', straw, 1.9);
      s += c.P('M16 86C16 81 30 80 42 82L44 89L16 89Z', lit(c, pants, null, 0.25)) + c.L('M24 86l8 0', sh(pants, -0.35), 1.6);
      s += c.P('M36 89C34 80 44 74 56 75C66 76 72 82 70 89Z', lit(c, shirt, null, 0.3)) + c.En(56, 82, 3.6, 3, '#2b2236') +
        c.P('M44 79L50 78L51 84L45 85Z', '#7f8b70') + c.L('M38 85L70 85', twine, 2.6);
      s += g(`<g transform="scale(0.78)">${sickle}</g>`, 'translate(58 88) rotate(84)');
      s += g(c.P('M41 27C40 15 46 10 53 10C61 10 66 16 65 27C64 33 58 36 53 36C47 36 42 33 41 27Z', lit(c, burlap, { rot: 70, sx: 1, sy: 1 })) +
        c.L('M50 30l2 2l2-2l2 2l2-2', OL, 1.6) + deadEye(c, 57.5, 21, 2.4) + deadEye(c, 63, 21, 2.1), 'translate(84 79) rotate(70) scale(0.8) translate(-53 -23)');
      s += g(c.E(0, 0, 17, 3.8, lit(c, '#857560', null, 0.2)) + c.P('M-10 0C-8-6-3-9 5-10C4-6 7-3 10 0Z', lit(c, '#857560', null, 0.3)) + c.L('M-9-1.5L9-1.5', '#a3463a', 2), 'translate(24 84) rotate(-14)');
      s += c.mist([[54, 70, 3.4], [60, 62, 2.6], [50, 58, 2], [64, 54, 1.6]], MISTC, 0.6);
      return c.out(fit(s, 0.92, 50, 0));
    }

    // f 몸 · h 머리 · nl/fl 발목 [x, 들림] · nh 낫 손 [x, y, 낫 각도] · fh 빈손 [x, y] · hat 모자 벗겨짐
    const P = {
      walk0: { f: [0, 0, -3], h: 2, nl: [59, 0], fl: [42, 0.8], nh: [49, 62, 22], fh: [60, 61] },
      walk1: { f: [0, -1.6, 0], h: 0, nl: [51, 0], fl: [52, 6], nh: [53, 63, 32], fh: [56, 62] },
      walk2: { f: [0, 0, 3], h: -2, nl: [43, 0.8], fl: [59, 0], nh: [62, 60, 44], fh: [44, 61] },
      walk3: { f: [0, -1.6, 0], h: 0, nl: [52, 6], fl: [50, 0], nh: [57, 62, 36], fh: [50, 62] },
      // 낫을 머리 뒤로 높이 젖힘, 몸이 뒤로 감김, 빈손은 앞으로
      aim: { f: [-3, 0, -9], h: -6, nl: [41, 0], fl: [63, 0], nh: [34, 31, -100], fh: [68, 48] },
      // 내리 베기: 몸을 앞으로 숙이며 낫을 앞아래로, 짚 부스러기
      attack: { f: [4, 2, 11], h: 8, nl: [37, 0], fl: [66, 0], nh: [77, 58, 132], fh: [42, 57], swing: true },
      // 맞음: 가슴 구멍에서 짚이 터져 나오고 고개가 젖혀짐, 모자가 들썩
      die0: { f: [-4, -1, -11], h: -18, nl: [49, 0], fl: [57, 2], nh: [66, 30, 22], fh: [34, 36], hurt: true, hat: 1 },
      // 무릎이 꺾이며 주저앉음, 모자가 떨어지고 짚이 흩어짐
      die1: { f: [-1, 15, 9], h: 24, nl: [57, 0], fl: [46, 0], nh: [62, 80, 0], fh: [44, 82], dead: true, hat: 2, drop: [70, 87, 84] },
    };
    const p = P[fr] || P.walk0;
    const F = frame(...p.f, 50, 62);
    const HF = sub(F, p.h, 52, 35);
    const leg = (hip, q, col) => {
      const Hh = F(hip);
      const lift = q[1];
      const A = [q[0], G - 5 - lift];
      const K = ik(Hh, A, 13.5, 13, 1);
      const a = lift > 1.5 ? 22 : 0;
      return tuftL(add(A, [0, 1]), 90 + a - 40, 6.5) + tuftL(add(A, [1, 1]), 60 + a, 6.5) +
        blob(c, seg2(Hh, K, A, 4.8, 3.9, 3.3), legG(c, col, 0.12, -0.3)) +
        c.L(`M${pt(add(A, [-3.4, -1]))}L${pt(add(A, [3.4, -1]))}`, twine, 2.4) +
        c.L(`M${pt(add(K, [-1.5, -2]))}l3 1.5`, sh(col, -0.35), 1.5);
    };
    const arm = (shp, hand, col, withSickle) => {
      const S = F(shp);
      const Hd = [hand[0], hand[1]];
      const E = ik(S, Hd, 11, 10, -1);
      const fa = angOf(E, Hd);
      const W = pol(Hd, -3.2, fa);
      let out = blob(c, seg2(S, E, W, 4, 3.4, 3.1), lit(c, col, null, 0.25));
      out += c.L(`M${pt(pol(W, 1.5, fa + 90))}L${pt(pol(W, 1.5, fa - 90))}`, twine, 2.2) + tuftL(W, fa + 180, 3.5, strawD);
      if (withSickle && !p.drop) out += held(Hd, hand[2], `<g transform="scale(0.78)">${sickle}</g>`);
      return out + fist(c, Hd, fa, 3.3, lit(c, glove, null, 0.3), sh(glove, -0.5));
    };

    let s = '';
    s += arm([47, 40], p.fh, sh(shirt, -0.25), false);
    s += leg([47, 62], p.fl, sh(pants, -0.25)) + leg([53, 62], p.nl, pants);
    // 몸통(셔츠·누더기 단·허리끈·가슴 구멍)
    const torsoD = 'M41 37C45 32 58 32 62 36L64 60L62 70L58 66L54 71L50 66L46 71L42 66L39 70L38 60Z';
    s += F.g(c.P(torsoD, lit(c, shirt, F, 0.3)));
    const tc = F([51, 52]);
    s += form(c, torsoD, F, [tc[0], tc[1], 13, 17], 0.3, 0.15);
    s += F.g(
      c.P('M40 52L46 51.5L46.5 58L40.5 58.5Z', '#7f8b70', ' stroke-width="2"') + c.L('M41.5 53.5l3.5 3M45 53.5l-3.5 3', sh(shirt, -0.45), 1.5) +
      c.E(50, 47, 4.2, 5.2, '#2b2236') + c.L('M50 47m-2.2 0a2.2 2.2 0 1 1 2.2 2.2a3.4 3.4 0 0 1-3.4-3.4', MISTC, 1.6) +
      c.L('M39.5 59.5L63.5 59.5', OL, 5.5) + c.L('M39.5 59.5L63.5 59.5', twine, 2.8) + c.L('M44 58l1.5 3M50 58l1.5 3M56 58l1.5 3', sh(twine, -0.35), 1.5) +
      c.L('M44 66l-1 5M52 67l0 5M60 66l1 5', straw, 1.9) +
      c.L('M58 40l4 1', sh(shirt, -0.35), 1.6)
    );
    if (p.hurt) { const hc = F([53, 47]); s += c.L(`M${pt(hc)}l9-6M${pt(hc)}l11 0M${pt(hc)}l8 6M${pt(hc)}l4-9`, straw, 2) + hitStar(c, hc[0] + 2, hc[1], 5.5); }
    // 목 짚 + 머리
    s += F.g(tuftL([51, 35], -60, 5) + tuftL([53, 35], -120, 5));
    const hatT = p.hat === 1 ? 'translate(-1 -2) rotate(-12 52 12)' : p.hat === 2 ? 'translate(-26 66) rotate(-30 52 12)' : '';
    const hat = c.E(52, 12, 21, 4.5, lit(c, '#857560', HF, 0.2)) + c.P('M41 12C43 6 48 2 57 1C56 5 59 8 63 12Z', lit(c, '#857560', HF, 0.3)) + c.L('M43 10L62 10', '#a3463a', 2.2);
    s += HF.g(
      tuftL([42, 17], 160, 5.5) +
      c.P('M41 27C40 15 46 10 53 10C61 10 66 16 65 27C64 33 58 36 53 36C47 36 42 33 41 27Z', lit(c, burlap, HF, 0.3)) +
      c.Pn('M42 29C46 35 60 37 65 28C62 36 46 38 42 29Z', OL, 0.2) +
      c.L('M47 13l2 3M57 12l-1.5 3.5M45 22l3 0', sh(burlap, -0.3), 1.6) +
      (p.dead ? deadEye(c, 57.5, 21.5, 2.6) + deadEye(c, 63.5, 21.5, 2.2) : c.eye(57.5, 21, p.hurt ? 3.3 : 2.8) + c.eye(63.5, 21, 2.4)) +
      c.L('M52 30l2 2l2-2l2 2l2-2l2 2', OL, 1.6) +
      c.L('M44 33Q52 37 61 33', twine, 2.4) +
      (p.hat ? '' : hat)
    );
    if (p.hat) s += HF.g(g(hat, hatT));
    // 어깨 막대 끝(허수아비 가로대) + 낫 쥔 팔
    s += F.g(c.E(57, 39, 3.2, 3.2, lit(c, wood, F)) + c.L('M57 39m-1.4 0a1.4 1.4 0 1 0 2.8 0a1.4 1.4 0 1 0-2.8 0', sh(wood, -0.4), 1.5));
    s += arm([57, 40], p.nh, shirt, true);
    if (p.drop) s += g(`<g transform="scale(0.78)">${sickle}</g>`, `translate(${p.drop[0]} ${p.drop[1]}) rotate(${p.drop[2]})`);
    if (p.swing) s += swoosh(c, 56, 44, 30, -80, 30, 7, '#ffffff', 0.55) + c.L('M84 44l5-3M86 50l6 0M82 38l4-5', straw, 1.9);
    if (p.dead) s += c.L('M30 80l-6-3M34 86l-7 1M72 84l6-2M68 76l6-4M40 72l-5-4', straw, 1.9) + c.mist([[50, 50, 2.6], [56, 44, 2]], MISTC, 0.6);
    return c.out(fit(s, 0.92, 50, 0));
  };
  D.straw_husk.frames = true;

  /* ---------- 05 덩굴 거머리: 자벌레처럼 몸을 접었다 펴며 기어감 · 앞몸을 쳐들었다 빨판으로 덮침 · 죽으면 몸을 말고 말라 비틀어짐 ---------- */
  MOTION.vine_leech = { gait: 'crawl', bob: 0, tilt: 0, sway: 0.04, squash: 0.06, deathFx: 'mist', deathTime: 0.8 };
  D.vine_leech = (fr) => {
    const c = make(3);
    const G = 90 - c.ow / 2;
    // sp: 등줄기 3차 베지어 [x, 땅 위 높이] 4점(꼬리→머리) · mouth 빨판 벌림(0~1) · k 굵기 배율 · col 몸빛
    const P = {
      walk0: { sp: [[10, 0], [36, 0], [60, 0], [84, 0]], mouth: 0.15 },
      walk1: { sp: [[18, 0], [32, 12], [52, 4], [84, 0]], mouth: 0.15 },
      walk2: { sp: [[27, 0], [38, 26], [64, 24], [84, 0]], mouth: 0.15 },
      walk3: { sp: [[27, 0], [52, 6], [66, 16], [88, 1]], mouth: 0.25 },
      // 앞몸을 높이 쳐들고 빨판을 활짝, 뒷몸은 똬리
      aim: { sp: [[14, 0], [46, -4], [52, 32], [72, 36]], mouth: 1, rear: true },
      // 덮치기: 앞으로 쭉 뻗어 빨판을 들이댐
      attack: { sp: [[22, 0], [44, 0], [62, 12], [92, 5]], mouth: 0.9, lunge: true },
      // 맞음: 몸이 꺾이고 머리가 들리며 수액이 튐
      die0: { sp: [[14, 0], [38, 16], [56, -2], [80, 12]], mouth: 0.7, hurt: true },
      // 몸을 둥글게 말며 맥이 꺼져 감, 잎이 떨어짐
      die1: { sp: [[32, 0], [12, 26], [62, 34], [66, 2]], mouth: 0.4, dead: true, fade: 0.5 },
      // 바짝 말라 납작해진 껍질
      die2: { sp: [[16, 0], [38, 0], [60, 0], [80, 0]], mouth: 0.2, dead: true, fade: 1, k: 0.55 },
    };
    const p = P[fr] || P.walk0;
    const k = p.k || 1;
    const fade = p.fade || 0;
    const base = H.mix('#6f7b68', '#7a6a58', fade);
    const vein = H.mix(GREEN, '#6a6050', fade);
    const N = 13;
    const rr = (t) => (3.6 + 8.6 * Math.sin(Math.PI * (0.08 + 0.78 * t))) * k;
    const xh = bez(...p.sp, N - 1);
    const radii = xh.map((_, i) => rr(i / (N - 1)));
    const pts = xh.map(([x, h], i) => [x, G - radii[i] - h]);
    const bodyD = tube(pts, radii);
    const tan = (i) => angOf(pts[Math.max(0, i - 1)], pts[Math.min(N - 1, i + 1)]);
    const up = (i, f) => { const a = tan(i) - 90; return pol(pts[i], radii[i] * f, a); };

    let s = '';
    s += c.P(bodyD, lit(c, base, null, 0.35, -0.38));
    const xs = pts.map((q) => q[0]);
    const ys = pts.map((q) => q[1]);
    const bx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const by = (Math.min(...ys) + Math.max(...ys)) / 2;
    s += form(c, bodyD, null, [bx, by + 2, (Math.max(...xs) - Math.min(...xs)) / 2 + 6, (Math.max(...ys) - Math.min(...ys)) / 2 + 8], 0.32, 0.16);
    // 마디 고리
    let rings = '';
    for (let i = 2; i < N - 1; i += 2) {
      const a = tan(i) - 90;
      rings += `M${pt(pol(pts[i], radii[i] * 0.92, a))}Q${pt(pol(pts[i], radii[i] * 0.2, a + 25))} ${pt(pol(pts[i], radii[i] * 0.85, a + 180))}`;
    }
    s += c.L(rings, sh(base, -0.32), 1.5, ' opacity=".8"');
    // 초록 맥(등줄기)
    const veinD = `M${pts.slice(1, N - 1).map((_, j) => pt(up(j + 1, 0.42))).join('L')}`;
    if (fade < 1) s += c.L(veinD, vein, 5, ` opacity="${n(0.35 * (1 - fade))}" ${c.soft()}`);
    s += c.L(veinD, sh(vein, 0.25 - fade * 0.4), 2);
    // 잎·덩굴손
    const leaf = (i, da, sc) => {
      const q = up(i, 0.85);
      return g(c.P('M0 0C2-8 8-12 14-12C12-6 8-1 0 0Z', lit(c, H.mix('#7fae4f', '#8a7a52', fade), null, 0.3)) + c.L('M1-1L10-9', sh('#7fae4f', -0.35), 1.5),
        `translate(${pt(q)}) rotate(${n(tan(i) + da)}) scale(${sc})`);
    };
    s += leaf(4, -40, fade ? 0.8 : 1) + leaf(8, -20, fade ? 0.7 : 0.9);
    if (!p.dead) { const q = up(6, 0.9); s += c.L(`M${pt(q)}c-2-5 3-8 5-5c1 2-1 3-2 2`, sh('#7fae4f', -0.1), 1.6); }
    // 머리: 마지막 마디 끝, 진행 방향으로 빨판
    const hp = pts[N - 1];
    const ha = tan(N - 1);
    const hr = radii[N - 1] * 1.4;
    const m = p.mouth;
    let head = c.E(0, 0, hr * 1.02, hr, lit(c, base, { rot: ha, sx: 1, sy: 1 }, 0.38));
    head += c.E(hr * 0.72, hr * 0.08, 2.6 + m * 2.6, hr * (0.55 + m * 0.3), '#d6b6c4');
    head += c.E(hr * 0.8, hr * 0.08, 1.3 + m * 1.8, hr * (0.3 + m * 0.3), '#3a1e2e', ' stroke-width="1.8"');
    if (m > 0.5) {
      head += c.L([-60, -25, 10, 45].map((a) => { const c0 = [hr * 0.8, hr * 0.08]; const ry = hr * (0.3 + m * 0.3); const q = [c0[0] + Math.cos(a * RAD) * (1.3 + m * 1.8) * 0.9, c0[1] + Math.sin(a * RAD) * ry * 0.95]; return `M${pt(q)}L${pt(lerp(q, c0, 0.45))}`; }).join(''), '#fffbe8', 1.6);
    }
    head += p.dead ? deadEye(c, -1, -hr * 0.55, 2.3) + deadEye(c, 4.5, -hr * 0.5, 2) : c.eye(-1, -hr * 0.55, p.hurt ? 3 : 2.6) + c.eye(4.5, -hr * 0.48, 2.3);
    s += `<g transform="translate(${pt(hp)}) rotate(${n(ha)})">${head}</g>`;
    s += c.shine(pts[4][0] - 2, pts[4][1] - radii[4] * 0.5, 4, 2, 0.35);
    if (p.hurt) s += hitStar(c, pts[6][0], pts[6][1] - 4, 6) + c.mist([[pts[6][0] + 6, pts[6][1] - 12, 2], [pts[6][0] - 4, pts[6][1] - 14, 1.6], [pts[6][0] + 2, pts[6][1] - 18, 1.4]], '#b6e07a', 0.9);
    if (p.lunge) { s += hitStar(c, hp[0] + hr + 3, hp[1], 6) + speed(c, [[24, 60, 10], [20, 70, 12], [26, 80, 8]]); }
    if (p.rear) s += c.mist([[hp[0] + 12, hp[1] + 4, 2], [hp[0] + 15, hp[1] - 2, 1.5]], '#b6e07a', 0.8);
    if (fade >= 1) s += c.mist([[40, 74, 3], [52, 68, 2.4], [46, 62, 1.8]], MISTC, 0.55) + c.L('M28 89l3-4M66 89l-2-5', '#8a7a52', 1.8);
    if (p.dead && fade < 1) s += g(c.P('M0 0C2-8 8-12 14-12C12-6 8-1 0 0Z', '#9a9a5a'), 'translate(78 82) rotate(150)');
    return c.out(fit(s, 0.95, 50, 0));
  };
  D.vine_leech.frames = true;

  /* ---------- 06 포자 주머니: 뒤뚱뒤뚱(몸을 좌우로 흔들며 눌렸다 늘어남) · 부풀었다 몸통 박치기 · 죽으면 펑 터져 껍질만 남음 ---------- */
  MOTION.spore_sac = { gait: 'waddle', bob: 0.03, tilt: 6, sway: 0.02, squash: 0.12, deathFx: 'burst', deathTime: 0.7 };
  D.spore_sac = (fr) => {
    const c = make(3);
    const G = 90 - c.ow / 2;
    const cap = '#86739a';
    const sac = '#b3a8ba';
    const spot = '#e4dcec';
    const spore = '#d4e89a';
    const sacD = 'M50 30C72 30 85 44 83 59C81 72 68 79 50 79C32 79 19 72 17 59C15 44 28 30 50 30Z';
    const capD = 'M20 42C20 24 34 13 50 13C66 13 80 24 80 42C74 46 68 40 62 44C56 40 46 45 40 41C34 45 26 40 20 42Z';
    const spots = (op = 1) => c.En(34, 24, 5, 3.6, spot, op) + c.En(52, 18, 4, 3, spot, op) + c.En(66, 28, 4, 3, spot, op) + c.En(28, 35, 2.6, 2, spot, op) + c.En(48, 32, 2.6, 2, spot, op);

    if (fr === 'die1' || fr === 'die2') {
      const burst = fr === 'die1';
      let s = '';
      if (burst) {
        // 펑: 찢어진 아래 껍질 + 날아가는 갓 + 포자 구름
        s += c.mist([[50, 46, 18], [32, 40, 12], [68, 40, 12], [50, 24, 11], [26, 58, 9], [76, 58, 9]], '#eef6c8', 0.5) + c.mist([[44, 42, 8], [58, 34, 6], [36, 54, 5]], '#ffffff', 0.35);
        s += c.P('M22 70C20 78 32 86 50 86C68 86 80 78 78 70L72 62L66 70L60 58L54 68L48 56L42 68L36 60L30 70Z', lit(c, sac, null, 0.3));
        s += c.En(34, 76, 3.4, 2.4, sh(sac, -0.2)) + c.En(60, 80, 3, 2, sh(sac, -0.2));
        s += g(c.P(capD, lit(c, cap, { rot: -24, sx: 1, sy: 1 })) + spots(), 'translate(-6 -2) rotate(-24 50 30) scale(0.8)');
        s += [[16, 30], [84, 26], [24, 14], [78, 12], [88, 50], [10, 52]].map(([x, y]) => c.spark(x, y, 1.4, '#c8e07a')).join('');
        s += c.L('M20 40l-6-4M80 40l6-4M50 20l0-8M30 24l-4-6M70 24l4-6', '#f4f8e0', 2, ' opacity=".8"');
        s += [[38, 88], [62, 88]].map(([x]) => c.E(x, G - 3, 5, 3, sh(sac, -0.3))).join('');
      } else {
        // 남은 모습: 바람 빠진 껍질과 구겨진 갓, 포자 먼지가 가라앉음
        s += c.mist([[30, 76, 6], [50, 72, 7], [70, 76, 6], [40, 64, 4], [62, 62, 4]], spore, 0.35);
        s += c.P('M18 88C18 82 26 78 36 80C42 76 52 77 58 80C66 77 78 79 82 88Z', lit(c, sac, null, 0.25)) +
          c.L('M30 84l6-2M48 82l4 2M62 84l6-2', sh(sac, -0.35), 1.6);
        s += c.P('M40 82C38 74 46 70 54 70C62 70 68 74 66 82C60 80 54 84 48 80C46 83 42 83 40 82Z', lit(c, cap, null, 0.25)) + c.En(50, 74, 2.6, 1.8, spot) + c.En(58, 76, 2, 1.4, spot);
        s += c.E(30, G - 2.5, 4.4, 2.5, sh(sac, -0.3)) + c.E(72, G - 2.5, 4.4, 2.5, sh(sac, -0.3));
        s += [[24, 66], [74, 64], [50, 58]].map(([x, y]) => c.spark(x, y, 1.1, '#c8e07a')).join('');
      }
      return c.out(s);
    }

    // f 몸 [dx, dy, 회전, sx, sy] (기준: 발 사이 바닥) · nl/fl 발 [x, 들림] · face 표정
    const P = {
      walk0: { f: [0, 0, 3, 1.02, 0.98], nl: [61, 0], fl: [41, 0], face: 0 },
      walk1: { f: [0, -2, 0, 0.97, 1.04], nl: [60, 4.5], fl: [43, 0], face: 0 },
      walk2: { f: [0, 0, -3, 1.02, 0.98], nl: [58, 0], fl: [40, 0], face: 0 },
      walk3: { f: [0, -2, 0, 0.97, 1.04], nl: [58, 0], fl: [44, 4.5], face: 0 },
      // 부풀며 뒤로 젖힘: 볼이 빵빵, 갓 위로 포자가 모임
      aim: { f: [-3, -1, -12, 1.06, 1.08], nl: [63, 0], fl: [42, 0], face: 1, gather: true },
      // 몸통 박치기: 앞으로 쏠리며 납작해지고 포자가 뿜어져 나옴
      attack: { f: [1, 0, 14, 1.08, 0.9], nl: [58, 0], fl: [38, 1], face: 2, puff: true },
      // 맞음: 움푹 찌그러지고 포자가 새어 나옴
      die0: { f: [-3, 0, -9, 0.92, 1.05], nl: [57, 0], fl: [44, 2], face: 3, hurt: true },
    };
    const p = P[fr] || P.walk0;
    const F = frame(p.f[0], p.f[1], p.f[2], 50, 84, p.f[3], p.f[4]);
    const leg = (hip, q, col) => {
      const Hh = F(hip);
      const A = [q[0], G - 3.2 - q[1]];
      const K = ik(Hh, A, 7, 6.5, 1);
      return blob(c, seg2(Hh, K, A, 4.4, 3.7, 3.3), legG(c, col)) + c.E(A[0] + 1.5, A[1] + 0.2, 5.2, 3.2, lit(c, sh(col, -0.1), null, 0.25));
    };
    let s = leg([43, 75], p.fl, sh(sac, -0.42)) + leg([58, 75], p.nl, sh(sac, -0.22));
    s += F.g(c.P(sacD, lit(c, sac, F, 0.4, -0.4)));
    const bc = F([50, 58]);
    s += form(c, sacD, F, [bc[0], bc[1], 33, 26], 0.3, 0.2);
    // 얼굴: 0 보통 · 1 볼 부풀림 · 2 입 벌림 · 3 아픔
    const face = [
      c.L('M64 66q6 4 11-1', OL, 2.2),
      c.E(70, 66, 3, 2.4, '#3a1e2e') + c.En(64, 63, 4, 3, '#d8a8c0', 0.6) + c.En(78, 62, 3.4, 2.6, '#d8a8c0', 0.6),
      c.E(70, 67, 5, 5.5, '#3a1e2e') + c.En(70, 69.5, 3, 2, '#c86a8a'),
      c.L('M63 67l3-2l3 2l3-2l3 2l3-2', OL, 2),
    ][p.face];
    s += F.g(
      c.En(30, 62, 4, 3, sh(sac, -0.18)) + c.En(42, 73, 3.5, 2.4, sh(sac, -0.18)) + c.En(24, 50, 2.6, 2, sh(sac, -0.18)) +
      c.P(capD, lit(c, cap, F)) + spots() +
      c.Pn('M22 41C34 45 62 46 78 41C66 49 34 49 22 41Z', OL, 0.25) +
      c.eye(63, 54, p.hurt ? 4.6 : p.face === 1 ? 3.2 : 3.8) + c.eye(75, 53, p.hurt ? 4 : p.face === 1 ? 2.8 : 3.3) +
      (p.face === 1 ? c.L('M58 48l8 2M71 48l8 0', OL, 2) : '') +
      face +
      c.shine(30, 44, 7, 3, 0.35)
    );
    const top = F([50, 12]);
    if (!p.gather && !p.puff) s += c.mist(fr === 'walk1' || fr === 'walk3' ? [[top[0] - 3, top[1] - 4, 3.4], [top[0] + 6, top[1] - 7, 2.4]] : [[top[0] + 3, top[1] - 4, 3.4], [top[0] - 6, top[1] - 7, 2.4]], spore, 0.9);
    if (p.gather) s += c.mist([[top[0] - 14, top[1] - 4, 2.4], [top[0] + 14, top[1] - 2, 2.4], [top[0], top[1] - 10, 3], [top[0] - 6, top[1] - 6, 2]], spore, 0.85) + c.L(`M${pt(add(top, [-20, -6]))}l5 2M${pt(add(top, [20, -4]))}l-5 2M${pt(add(top, [0, -16]))}l0 4`, spore, 1.6);
    if (p.puff) { const fp = F([80, 40]); s += c.mist([[fp[0], fp[1], 6], [fp[0] + 7, fp[1] - 6, 4.6], [fp[0] + 4, fp[1] + 6, 4], [fp[0] - 4, fp[1] - 10, 3.4]], spore, 0.85) + hitStar(c, F([86, 60])[0], F([86, 60])[1], 6); }
    if (p.hurt) s += hitStar(c, bc[0] - 8, bc[1] - 6, 6) + c.mist([[bc[0] - 16, bc[1] - 18, 2.6], [bc[0] - 22, bc[1] - 24, 2]], spore, 0.85);
    return c.out(s);
  };
  D.spore_sac.frames = true;

  /* ---------- 07 포자 새끼: 통통 튀기(웅크림→뛰어오름→떨어짐) · 웅크렸다 갓으로 박치기 · 죽으면 갓이 튕겨 나가며 포자로 흩어짐 ---------- */
  MOTION.sporeling = { gait: 'hop', hop: 0.1, bob: 0, tilt: 4, sway: 0, squash: 0.1, deathFx: 'spores', deathTime: 0.5 };
  D.sporeling = (fr) => {
    const c = make(3.4);
    const G = 90 - c.ow / 2;
    const cap = '#86739a';
    const stalk = '#bdb5c4';
    const spot = '#e4dcec';
    const capD = 'M10 50C10 26 30 12 50 12C70 12 90 26 90 50C78 57 22 57 10 50Z';
    const stalkD = 'M32 50C30 64 33 78 50 79C67 78 70 64 68 50Z';
    const spots = c.En(34, 30, 6.5, 5, spot) + c.En(58, 22, 5, 4, spot) + c.En(74, 38, 4.5, 3.5, spot) + c.En(22, 44, 3, 2.4, spot);
    if (fr === 'die1' || fr === 'die2') {
      let s = '';
      if (fr === 'die1') {
        s += c.mist([[50, 56, 14], [34, 48, 9], [66, 48, 9], [50, 38, 8]], '#eef6c8', 0.55) + c.mist([[46, 50, 6], [58, 44, 4]], '#ffffff', 0.35);
        s += g(c.P('M36 62C35 72 38 82 50 82C62 82 65 72 64 62Z', lit(c, stalk, null, 0.3)) + deadEye(c, 54, 68, 3) + deadEye(c, 62, 67, 2.6), 'translate(0 6)') + c.E(44, G - 3, 5, 3, '#8c8296') + c.E(58, G - 3, 5, 3, '#b0a7b8');
        s += g(c.P(capD, lit(c, cap, { rot: -38, sx: 1, sy: 1 })) + spots, 'translate(-14 -24) rotate(-38 50 34) scale(0.72)');
        s += [[16, 60], [86, 58], [70, 22], [30, 20]].map(([x, y]) => c.spark(x, y, 1.6, '#c8e07a')).join('');
      } else {
        s += c.mist([[44, 80, 7], [60, 78, 6], [52, 70, 4]], '#d4e89a', 0.4);
        s += c.P('M30 88C30 80 38 76 46 78L50 88Z', lit(c, stalk, null, 0.25));
        s += g(c.P(capD, lit(c, cap, null)) + spots, 'translate(64 74) rotate(180) scale(0.42) translate(-50 -50)');
        s += [[28, 70], [74, 66], [50, 60]].map(([x, y]) => c.spark(x, y, 1.2, '#c8e07a')).join('');
      }
      return c.out(fit(s, 0.82, 50, 0));
    }
    // f 몸 [dx, dy, 회전, sx, sy] · 발 들림 · face 0 보통 1 성남 2 아픔
    const P = {
      walk0: { f: [0, 0, 0, 1, 1], lift: 0, face: 0 },
      walk1: { f: [0, 0, 0, 1.1, 0.86], lift: 0, face: 0, crouch: true },
      walk2: { f: [0, -7, -6, 0.92, 1.1], lift: 6, face: 0 },
      walk3: { f: [0, -3, 4, 1, 1.02], lift: 2.5, face: 0, reach: true },
      aim: { f: [-3, 0, -14, 1.12, 0.84], lift: 0, face: 1, crouch: true },
      attack: { f: [2, -3, 24, 0.95, 1.06], lift: 2, face: 1, butt: true },
      die0: { f: [-2, 0, -8, 1.16, 0.8], lift: 0, face: 2, hurt: true },
    };
    const p = P[fr] || P.walk0;
    const F = frame(p.f[0], p.f[1], p.f[2], 50, 82, p.f[3], p.f[4]);
    const leg = (hip, x, col) => {
      const Hh = F(hip);
      const A = [x + p.f[0], G - 3 - p.lift];
      const K = ik(Hh, A, p.crouch ? 6 : 5, 5, 1);
      return blob(c, seg2(Hh, K, A, 4.2, 3.6, 3.2), legG(c, col)) + c.E(A[0] + 1.6, A[1] + 0.3, 5.4, 3.2, lit(c, sh(col, -0.1), null, 0.25));
    };
    let s = leg([43, 76], p.reach ? 40 : 42, '#8c8296') + leg([57, 76], p.reach ? 61 : 59, '#b0a7b8');
    s += F.g(c.P(stalkD, lit(c, stalk, F, 0.35)));
    s += F.g(c.Pn('M33 52C44 58 58 58 67 52L67 56C58 62 42 62 33 56Z', OL, 0.25));
    s += F.g(
      (p.face === 2 ? c.L('M51 58l7 6M58 58l-7 6M63 57l6 6M69 57l-6 6', OL, 2.2) : c.eye(55, 61, 4.2) + c.eye(67, 60, 3.6)) +
      (p.face === 1 ? c.L('M50 55l9 3M63 54l8 2', OL, 2.2) : '') +
      c.L(p.face === 1 ? 'M57 70l8 0' : 'M57 69q4 3 8 0', OL, 1.8) +
      c.P(capD, lit(c, cap, F)) + spots + c.shine(28, 24, 7, 3.5, 0.4)
    );
    const capC = F([50, 30]);
    s += form(c, capD, F, [capC[0], capC[1], 40, 20], 0.26, 0.18);
    if (p.butt) { const tp = F([88, 40]); s += hitStar(c, tp[0] + 2, tp[1], 6) + c.mist([[tp[0] - 2, tp[1] - 8, 3.4], [tp[0] + 4, tp[1] + 8, 3]], '#d4e89a', 0.85) + speed(c, [[18, 40, 9], [14, 52, 11]]); }
    if (p.hurt) s += hitStar(c, 30, 30, 6) + c.mist([[20, 22, 3], [80, 20, 2.6]], '#d4e89a', 0.85);
    if (fr === 'walk1') s += c.mist([[30, 88, 2.4], [70, 88, 2.4]], '#cdbfa8', 0.7);
    return c.out(fit(s, 0.82, 50, 0));
  };
  D.sporeling.frames = true;

  /* ---------- 08 녹슨 기사: 철컥철컥 행군 · 칼을 머리 위 뒤로 젖혔다 내려찍기 · 죽으면 갑옷이 무너지고 투구가 굴러감 ---------- */
  MOTION.rust_knight = { gait: 'march', bob: 0.03, tilt: 3, sway: 0, squash: 0, deathFx: 'crumble', deathTime: 0.9 };
  D.rust_knight = (fr) => {
    const c = make(3);
    const G = 90 - c.ow / 2;
    const rust = '#8c766a';
    const rustD = sh(rust, -0.32);
    const orange = '#c0683c';
    const steel = c.lin([[0, '#dcd6d2'], [0.5, '#a49a94'], [1, '#6e6460']], 'h');
    const hole = (x, y, rx, ry) => c.E(x, y, rx, ry, orange, ' stroke-width="1.6"') + c.En(x + rx * 0.15, y + ry * 0.1, rx * 0.5, ry * 0.5, '#241b2c');
    // 칼(손 기준, 칼날 = -y): 자루 감개 · 손잡이 끝 · 가드 · 이 빠진 녹슨 날
    const sword = c.limb('M0 6L0-4', 3, '#5a4232') + c.L('M-1.5 3l3-1.4M-1.5 0l3-1.4', sh('#5a4232', 0.3), 1.5) + c.E(0, 7.5, 2.6, 2.6, rustD) +
      c.P('M-8-4.5L8-4.5L8.6-2L-8.6-2Z', rustD) +
      c.P('M-3.2-5L3.2-5L3-22L1.4-25L3-27L1.6-34L0-36L-1.6-33L-3-28Z', steel) +
      c.L('M0-7L0-30', '#f4f0ec', 1.5, ' opacity=".7"') + c.En(-1.2, -14, 1.6, 2.2, orange, 0.85) + c.En(1.4, -24, 1.2, 1.5, orange, 0.8);
    const helmD = 'M41 11C47 6 62 6 68 12L68 31C62 35 46 35 41 31Z';
    const helm = (HFx, dead) => c.P(helmD, lit(c, rust, HFx, 0.4)) +
      c.Pn('M41 26C48 32 62 33 68 27L68 31C62 35 46 35 41 31Z', OL, 0.25) +
      c.P('M54 19L70 19L70 24L54 24Z', '#241b2c') +
      (dead ? '' : c.eye(63, 21.5, 2.2, false) + c.eye(58, 21.5, 1.8, false)) +
      c.L('M47 12L47 31', sh(rust, -0.4), 1.6) + c.L('M60 27.5l0 0M63.5 27.5l0 0M67 27.5l0 0', OL, 2) +
      c.En(62, 29.5, 2.4, 1.5, orange, 0.85) + c.En(45, 18, 1.8, 2.4, orange, 0.75) +
      c.P('M50 8C49 3 52 1 55 2C54 4 56 6 57 8Z', '#a3463a', ' stroke-width="2"') +
      c.shine(46, 16, 3, 5, 0.4, 0);

    if (fr === 'die2') {
      // 남은 모습: 빈 갑옷 무더기, 굴러간 투구, 떨어진 칼, 안개가 빠져나감
      let s = '';
      s += held([22, 87], 96, sword);
      s += c.P('M16 89L16 83C24 80 34 80 40 83L40 89Z', lit(c, rustD, null, 0.3)) + c.P('M34 89L36 84L46 84L48 89Z', sh(rustD, -0.1));
      s += c.P('M30 88C30 78 40 72 52 72C62 72 68 78 68 88Z', lit(c, rust, { rot: 80, sx: 1, sy: 1 }, 0.35)) + c.L('M33 80C42 76 56 75 66 80', sh(rust, -0.45), 1.6) + hole(46, 79, 2.6, 2) + hole(58, 82, 2, 1.6);
      s += c.P('M64 89L66 83L74 82L77 89Z', sh(rust, -0.08));
      s += g(helm({ rot: 100, sx: 1, sy: 1 }, true), 'translate(80 79) rotate(100) scale(0.78) translate(-54.5 -21)');
      s += c.mist([[50, 68, 3.6], [56, 60, 2.8], [46, 56, 2.2], [60, 52, 1.8], [84, 66, 2.4], [88, 60, 1.8]], MISTC, 0.65);
      return c.out(s);
    }

    // f 몸 · h 투구 · nl/fl 발목 [x, 들림] · nh 칼 손 [x, y, 칼 각도] · fh 빈손 [x, y]
    const P = {
      walk0: { f: [0, 0, 0], h: 0, nl: [60, 0], fl: [41, 0.8], nh: [60, 61, 104], fh: [58, 58] },
      walk1: { f: [0, -1.4, -1], h: 1, nl: [52, 0], fl: [53, 6], nh: [63, 60, 98], fh: [53, 59] },
      walk2: { f: [0, 0, 0], h: 0, nl: [43, 0.8], fl: [60, 0], nh: [66, 58, 92], fh: [46, 58] },
      walk3: { f: [0, -1.4, 1], h: -1, nl: [53, 6], fl: [51, 0], nh: [63, 59, 98], fh: [51, 59] },
      // 칼을 머리 위 뒤로 높이 젖힘, 몸이 뒤로 감김, 빈손은 앞으로 뻗어 겨눔
      aim: { f: [-3, 0, -8], h: -6, nl: [42, 0], fl: [62, 0], nh: [43, 19, -104], fh: [68, 44] },
      // 내려찍기: 앞발을 내딛고 몸을 숙이며 칼을 앞아래로
      attack: { f: [4, 2, 10], h: 6, nl: [67, 0], fl: [38, 0], nh: [77, 57, 118], fh: [44, 54], swing: true },
      // 맞음: 가슴판에서 불꽃, 투구가 젖혀지고 칼 든 팔이 들림
      die0: { f: [-4, -1, -11], h: -16, nl: [50, 0], fl: [58, 2], nh: [66, 36, 40], fh: [34, 46], hurt: true },
      // 무너짐: 무릎이 꺾이며 몸통이 내려앉고 투구가 날아감, 목에서 안개가 쏟아짐
      die1: { f: [-2, 15, 16], h: 0, nl: [60, 0], fl: [44, 0], nh: [62, 78, 0], fh: [42, 78], helmOff: true, drop: [62, 87, 96] },
    };
    const p = P[fr] || P.walk0;
    const F = frame(...p.f, 50, 60);
    const HF = sub(F, p.h, 54, 33);
    const leg = (hip, q, col) => {
      const Hh = F(hip);
      const lift = q[1];
      const A = [q[0], G - 4.6 - lift];
      const K = ik(Hh, A, 12.5, 12.5, 1);
      const a = lift > 1.5 ? 28 : 0;
      const foot = g(c.P('M-3.4-4.6L4-4.6C7-4.6 9.5-2 10 0L-3.6 0Z', lit(c, col, null, 0.3)) + c.L('M1-4.4L1.6 0', sh(col, -0.4), 1.5), `translate(${pt(add(A, [0, 4.6]))}) rotate(${a} 0 -4.6)`);
      return foot + blob(c, seg2(Hh, K, A, 5, 4.2, 3.4), legG(c, col, 0.2, -0.3)) +
        c.E(K[0], K[1], 3.8, 3.6, lit(c, col, null, 0.4)) + c.L(`M${pt(add(K, [-1.6, 1.6]))}l3.2 0`, sh(col, -0.4), 1.5) +
        c.mist([[K[0] - 3, K[1] - 3.5, 1.8]], MISTC, 0.7);
    };
    const arm = (shp, hand, col, withSword) => {
      const S = F(shp);
      const Hd = [hand[0], hand[1]];
      const E = ik(S, Hd, 10.5, 10, -1);
      const fa = angOf(E, Hd);
      const W = pol(Hd, -3, fa);
      let out = blob(c, seg2(S, E, W, 4, 3.5, 3.2), legG(c, col, 0.25, -0.25));
      out += c.E(E[0], E[1], 3.6, 3.4, lit(c, col, null, 0.45)) + c.mist([[E[0] - 2, E[1] + 3, 1.6]], MISTC, 0.65);
      if (withSword) out += held(Hd, hand[2], sword);
      return out + fist(c, Hd, fa, 3.7, lit(c, sh(col, -0.08), null, 0.4), sh(col, -0.5)) + c.L(`M${pt(W)}L${pt(pol(W, 2, fa + 180))}`, sh(col, -0.4), 3);
    };

    let s = '';
    if (!p.drop) s += '';
    s += arm([47, 39], p.fh, sh(rust, -0.28), false);
    s += leg([47, 59], p.fl, sh(rustD, -0.05)) + leg([53, 59], p.nl, rust);
    // 몸통: 가슴판·허리 갑옷 미늘·녹 구멍(속이 빔)
    const torsoD = 'M38 36C43 31 59 31 64 36L63 56C57 60 45 60 39 56Z';
    s += F.g(c.P('M37 55L65 55L67 66L56 64L51 67L46 64L35 66Z', lit(c, sh(rust, -0.08), F, 0.3)) + c.L('M43 57L42 65M51 57V66M59 57L60 65', sh(rust, -0.45), 1.5));
    s += F.g(c.P(torsoD, lit(c, rust, F, 0.38)));
    const tc = F([51, 46]);
    s += form(c, torsoD, F, [tc[0], tc[1], 13, 13], 0.28, 0.2);
    s += F.g(
      c.L('M52 33L53 58', sh(rust, -0.45), 1.6) + c.L('M41 40Q51 44 62 40', sh(rust, 0.25), 1.5, ' opacity=".7"') +
      hole(45, 47, 3.2, 2.5) + hole(59, 52, 2.4, 1.9) + c.En(41, 53, 1.6, 1.2, orange, 0.85) +
      c.L('M40 37l0 0M63 37l0 0', OL, 2.2) +
      c.P('M45 31C49 29 57 29 61 31L60 35L46 35Z', '#2b2236') + c.mist([[53, 31, 3.2], [48, 30, 2.4], [58, 30, 2.2]], MISTC, 0.75)
    );
    if (p.helmOff) {
      const nk = F([53, 32]);
      s += c.mist([[nk[0], nk[1] - 4, 4.6], [nk[0] - 4, nk[1] - 10, 3.6], [nk[0] + 3, nk[1] - 16, 3], [nk[0] - 2, nk[1] - 22, 2.4]], MISTC, 0.8);
      s += g(helm({ rot: -50, sx: 1, sy: 1 }, true), 'translate(78 22) rotate(-50) scale(0.9) translate(-54.5 -21)');
    } else {
      s += HF.g(helm(HF, false));
    }
    // 어깨받이 + 칼 든 팔
    s += F.g(c.P('M50 35C56 30 66 32 67 39L64 45L52 43Z', lit(c, rust, F, 0.4)) + c.L('M53 41L64 42', sh(rust, -0.45), 1.5) + c.En(60, 37, 1.8, 1.3, orange, 0.8));
    s += arm([58, 39], p.nh, rust, !p.drop);
    if (p.drop) s += held([p.drop[0], p.drop[1]], p.drop[2], sword);
    if (p.swing) s += swoosh(c, 58, 46, 38, -48, 32, 7, '#ffffff', 0.5);
    if (p.hurt) s += hitStar(c, 60, 44, 6.5) + c.L('M66 40l6-4M67 46l7 0M64 50l5 4', '#ffd38a', 2);
    if (p.helmOff) s += c.L('M36 88l-4-3M70 88l5-2', rustD, 2);
    return c.out(fit(s, 0.95, 50, 0));
  };
  D.rust_knight.frames = true;

  /* ---------- 보스 1 속 빈 고목: 뿌리 다리로 쿵쿵 · 가지 팔을 치켜들었다(소환) 땅을 내리쳐 덩굴을 솟게 함 · 죽으면 갈라져 쓰러지고 그루터기에 새싹 ---------- */
  MOTION.hollow_elder = { gait: 'stomp', bob: 0.02, tilt: 3, sway: 0.01, squash: 0.02, deathFx: 'crumble', deathTime: 1.2 };
  D.hollow_elder = (fr) => {
    const c = make(3);
    const G = 90 - c.ow / 2;
    const bark = '#7b6b60';
    const barkD = sh(bark, -0.32);
    const leaf = '#7c9168';
    const moss = '#93b062';
    const vineC = '#6f9a4a';
    const trunkD = 'M30 30C36 25 64 25 70 30C72 46 72 58 73 70L64 74L56 71L46 74L37 71L28 73C30 58 29 46 30 30Z';
    const hollowD = 'M41 48C41 38 50 36 56 38C64 40 66 50 64 61C62 68 56 71 50 70C43 69 40 60 41 48Z';
    // 뿌리 발가락: 발목 A에서 셋으로 갈라져 땅을 움켜쥠
    const rootFoot = (A, lifted, col) => {
      const tips = lifted ? [[-6, 7], [1, 8], [7, 6]] : [[-9, G - A[1]], [2, G - A[1]], [10, G - A[1] - 0.5]];
      return tips.map(([dx, dy]) => c.P(taper(bez(A, add(A, [dx * 0.3, dy * 0.6]), add(A, [dx * 0.8, dy * 0.95]), add(A, [dx, dy - 1.4]), 6), 3.4, 1.4), col)).join('');
    };
    // 가지 팔: 어깨 → 팔꿈치 → 손, 손끝 잔가지 셋
    const branch = (S, Hd, col, bendS) => {
      const E = ik(S, Hd, 15, 14, bendS);
      const a = angOf(E, Hd);
      let out = c.P(taper([S, lerp(S, E, 0.5), E], 5.6, 4.4), col) + c.P(taper([E, lerp(E, Hd, 0.5), Hd], 4.4, 3), col);
      out += [-34, 0, 30].map((da) => { const tip = pol(Hd, 7.5, a + da); return c.P(taper([Hd, lerp(Hd, tip, 0.5), tip], 2.6, 1.2), col); }).join('');
      out += c.L(`M${pt(lerp(S, E, 0.3))}l1.5 6M${pt(lerp(E, Hd, 0.4))}l1 5`, moss, 2.4);
      return { svg: out, E };
    };
    const clump = (x, y, r, col) => c.E(x, y, r, r * 0.8, col);

    if (fr === 'die2') {
      // 남은 모습: 갈라진 그루터기 + 쓰러진 줄기 조각 + 작은 새싹, 안개가 흩어짐
      let s = '';
      s += rootFoot([30, 80], false, barkD) + rootFoot([66, 80], false, barkD);
      s += c.P('M10 89C10 82 18 79 28 80L30 89Z', lit(c, barkD, null, 0.25)) + clump(14, 80, 7, sh(leaf, -0.25)) + clump(22, 84, 6, sh(leaf, -0.1));
      s += c.P('M30 89C30 76 32 66 34 60L40 64L44 56L50 63L56 55L60 63L66 58C68 66 70 78 70 89Z', lit(c, bark, null, 0.3));
      s += c.Pn('M40 64L44 56L50 63L56 55L60 63L66 58L66 64L60 68L56 62L50 68L44 62L40 68Z', '#c9b49a', 0.8);
      s += c.P('M42 89C42 80 46 74 50 74C55 74 58 80 58 89Z', c.rad([[0, '#6e6880'], [1, '#1e1828']], 0.5, 0.7, 0.7));
      s += c.L('M36 70C35 78 36 84 35 88M64 68C65 76 64 82 66 88', barkD, 2);
      s += c.En(32, 76, 5, 2.4, moss, 0.95) + c.En(68, 80, 4, 2, moss, 0.95);
      // 새싹
      s += c.L('M50 62C50 56 51 52 52 48', '#5f8a3a', 2.4) + c.P('M52 50C54 44 60 42 64 44C61 49 56 51 52 50Z', lit(c, '#9fd45f', null, 0.35)) + c.P('M51 53C48 48 42 47 39 49C42 53 47 55 51 53Z', lit(c, '#8fc44f', null, 0.35));
      s += c.spark(58, 40, 1.4, '#c8f08a');
      s += c.mist([[48, 40, 4], [58, 32, 3.2], [42, 28, 2.6], [54, 22, 2]], MISTC, 0.5);
      return c.out(fit(s, 0.94, 50, 0));
    }

    // f 몸 · nl/fl 뿌리 발목 [x, 들림] · nh/fh 가지 손 [x, y] · glow 소환 빛 · lean 수관 흔들림
    const P = {
      walk0: { f: [0, 0, 0], nl: [62, 0], fl: [37, 0.8], nh: [81, 64], fh: [17, 58], cw: 0 },
      walk1: { f: [0, -1.5, -2], nl: [54, 0], fl: [46, 6], nh: [84, 60], fh: [16, 61], cw: -2 },
      walk2: { f: [0, 0, 0], nl: [44, 0.8], fl: [58, 0], nh: [86, 56], fh: [15, 64], cw: 0 },
      walk3: { f: [0, -1.5, 2], nl: [52, 6], fl: [48, 0], nh: [84, 60], fh: [16, 61], cw: 2 },
      // 소환 준비: 두 가지 팔을 높이 치켜들고 뿌리가 초록빛, 땅에서 덩굴 싹이 꿈틀
      aim: { f: [-2, -1, -5], nl: [60, 0], fl: [40, 0], nh: [86, 14], fh: [14, 16], cw: -4, glow: 1, sprout: 1 },
      // 내리치기: 가지 팔을 앞 땅에 내리꽂자 덩굴이 솟구침
      attack: { f: [3, 2, 9], nl: [64, 0], fl: [38, 0], nh: [88, 81], fh: [14, 82], cw: 5, glow: 0.6, sprout: 2 },
      // 맞음: 나무껍질 조각이 튀고 잎이 떨어지며 뒤로 휘청
      die0: { f: [-4, -1, -8], nl: [56, 0], fl: [42, 2], nh: [88, 30], fh: [10, 38], cw: -6, hurt: true },
      // 갈라지며 뒤로 넘어감: 줄기에 큰 금, 팔이 축 늘어지고 잎이 우수수
      die1: { f: [2, 6, -14], nl: [60, 0], fl: [44, 0], nh: [78, 80], fh: [16, 74], cw: -10, dead: true, crack: true },
    };
    const p = P[fr] || P.walk0;
    const F = frame(...p.f, 50, 72);
    const CF = sub(F, p.cw, 50, 30);
    const leg = (hip, q, col, r = 1) => {
      const Hh = F(hip);
      const lift = q[1];
      const A = [q[0], G - 4 - lift];
      const K = ik(Hh, A, 10.5, 10, 1);
      return rootFoot(A, lift > 1.5, col) + c.P(taper([Hh, lerp(Hh, K, 0.5), K], 7 * r, 5.4 * r), legG(c, col, 0.15, -0.25)) +
        c.P(taper([K, lerp(K, A, 0.5), A], 5.4 * r, 4 * r), legG(c, col, 0.1, -0.3)) +
        c.L(`M${pt(add(K, [-2, -4]))}l1 6`, sh(col, -0.35), 1.6);
    };

    let s = '';
    // 수관 뒤쪽 잎 + 먼 가지 팔
    s += CF.g(clump(24, 24, 14, sh(leaf, -0.32)) + clump(76, 22, 14, sh(leaf, -0.32)) + c.limb('M40 22L32 6M34 12L26 10M60 20L70 4M66 10L74 12', 3.5, barkD));
    const fb = branch(F([31, 40]), p.fh, barkD, -1);
    s += fb.svg;
    s += leg([40, 70], p.fl, barkD, 0.92) + leg([60, 70], p.nl, bark);
    // 줄기
    s += F.g(c.P(trunkD, lit(c, bark, F, 0.32, -0.4)));
    const tc = F([50, 50]);
    s += form(c, trunkD, F, [tc[0], tc[1], 22, 24], 0.32, 0.16);
    s += F.g(
      c.L('M36 34C34 50 36 62 34 70M44 30C42 40 43 46 42 50M66 34C67 46 66 56 69 70M60 72C60 69 62 67 64 67', barkD, 2) +
      c.P(hollowD, c.rad([[0, p.glow ? '#e8f4d8' : '#d9d6e6'], [0.35, '#6e6880'], [1, '#1e1828']], 0.52, 0.55, 0.55)) +
      g(c.L('M0 0m-2 0a2 2 0 1 1 4 0a4 4 0 0 1-8 0a6 6 0 0 1 12 0a8.5 8.5 0 0 1-17 0', p.glow ? '#e4ffd0' : MISTC, 2.2, ' opacity=".85"'), `translate(52 55) rotate(${p.glow ? 70 : fr === 'walk1' || fr === 'walk3' ? 30 : 0})`) +
      c.P('M42 36L50 29L55 35Q49 38 42 36Z', '#2b2236') + c.P('M57 35L64 29L70 36Q63 38 57 35Z', '#2b2236') +
      (p.dead ? deadEye(c, 50, 33.5, 2.6) + deadEye(c, 64, 33.5, 2.6) : c.eye(50, 33.5, p.hurt ? 3.6 : 3, false) + c.eye(64, 33.5, p.hurt ? 3.6 : 3, false)) +
      c.En(29, 52, 6, 3, moss, 0.95) + c.En(70, 60, 5, 2.5, moss, 0.95) + c.En(34, 29, 7, 2.6, moss, 0.9) +
      c.P('M69 46C75 43 80 45 80 50L69 51Z', lit(c, '#b7a58c', F, 0.3)) + c.P('M71 53C75 51 78 53 78 56L71 56Z', lit(c, '#b7a58c', F, 0.3)) +
      (p.crack ? c.L('M50 26L47 36L53 44L48 54', OL, 3) + c.L('M50 26L47 36L53 44L48 54', '#d8c8b0', 1.5) : '')
    );
    // 수관 앞쪽 잎
    const leafG = lit(c, leaf, CF, 0.3);
    s += CF.g(
      clump(50, 16, 17, leafG) + clump(33, 13, 11, leafG) + clump(67, 11, 11, leafG) +
      c.En(44, 9, 6, 3, '#c9dca8', 0.55) + c.En(64, 6, 4, 2, '#c9dca8', 0.5) +
      c.L('M38 20q3 2 6 0M54 24q3 2 6 0M46 14q3 2 6 0M62 18q3 2 6 0', sh(leaf, -0.35), 1.6)
    );
    // 가까운 가지 팔
    const nb = branch(F([69, 40]), p.nh, bark, 1);
    s += nb.svg;
    if (p.glow) {
      s += [[p.nh[0], p.nh[1]], [p.fh[0], p.fh[1]]].map(([x, y]) => c.spark(x, y, 2, '#c8f08a')).join('');
      s += c.mist([[F([40, 72])[0], 86, 3], [F([60, 72])[0], 87, 3]], '#c8f08a', 0.6);
    }
    // 땅에서 솟는 덩굴
    const vine = (x, h, lean, w) => {
      const pts = bez([x, G], [x + lean * 0.2, G - h * 0.4], [x + lean * 0.8, G - h * 0.8], [x + lean, G - h], 8);
      const tip = pts[pts.length - 1];
      return c.P(taper(pts, w, 1.4), lit(c, vineC, null, 0.3)) + c.P(`M${pt(tip)}c3-3 7-2 7 1c-3 0-5 1-7-1Z`, '#9fd45f', ' stroke-width="2"');
    };
    if (p.sprout === 1) s += vine(84, 7, 2, 2.4) + vine(92, 5, -1, 2) + c.mist([[86, 88, 2.4], [93, 88, 2]], '#b9a07a', 0.8);
    if (p.sprout === 2) s += vine(14, 12, -4, 2.8) + vine(82, 22, 6, 3.6) + vine(92, 30, -4, 3.8) + vine(74, 14, -6, 3) + hitStar(c, 86, 82, 7) + c.mist([[80, 86, 4], [96, 85, 3.4], [70, 87, 3]], '#b9a07a', 0.85) + c.L('M78 84l-5-6M97 82l3-7', '#9a8064', 2.4);
    if (p.hurt) s += hitStar(c, 60, 46, 7) + c.P('M72 40l6-3l1 4Z', bark) + c.P('M76 50l7 1l-3 4Z', barkD) + c.L('M30 8l-4 6M70 4l4 6', leaf, 3);
    if (p.dead) s += [[18, 60, 30], [82, 50, -40], [70, 82, 70], [26, 84, 10], [88, 70, 120]].map(([x, y, a]) => g(c.P('M0 0C2-5 6-7 9-7C8-3 5-1 0 0Z', lit(c, leaf, null, 0.3), ' stroke-width="2"'), `translate(${x} ${y}) rotate(${a})`)).join('') + c.mist([[50, 50, 3], [44, 40, 2.4]], MISTC, 0.6);
    return c.out(fit(s, 0.94, 50, 0));
  };
  D.hollow_elder.frames = true;

  /* =========================================================
   * 2지역 · 서리 고개
   * ========================================================= */

  /* ---------- 09 서리 늑대: 가벼운 속보 · 몸을 낮춰 으르렁 → 덮쳐 물기 · 죽으면 고드름이 부러지며 옆으로 쓰러짐 ---------- */
  MOTION.frost_wolf = { gait: 'trot', bob: 0.04, tilt: 3, sway: 0, squash: 0.02, deathFx: 'shatter', deathTime: 0.7 };
  D.frost_wolf = (fr) => {
    const c = make(3);
    const G = 90 - c.ow / 2;
    const fur = '#d2d7e1';
    const furD = sh(fur, -0.3);
    const spk = c.lin([[0, '#ffffff'], [1, '#7fdcff']]);
    // f 몸 · nk 목 · h 머리 · jaw 입 · hk 고드름 갈기 높이 · tl 꼬리 들기 · 발 [x, 들림] 또는 {L,T}(몸 좌표)
    const P = {
      walk0: { f: [0, 0, 0], nk: 0, h: 0, jaw: 3, hk: 1, tl: 0, nf: [72, 0], ff: [56, 0.6], nh: [22, 0.6], fh: [35, 0] },
      walk1: { f: [0, -1.8, -1], nk: 2, h: 0, jaw: 3, hk: 1, tl: 3, nf: [64, 0], ff: [62, 6], nh: [32, 6], fh: [27, 0] },
      walk2: { f: [0, 0, 0], nk: 0, h: 0, jaw: 3, hk: 1, tl: 0, nf: [56, 0.6], ff: [68, 0], nh: [38, 0], fh: [19, 0.6] },
      walk3: { f: [0, -1.8, 1], nk: -2, h: 0, jaw: 3, hk: 1, tl: -3, nf: [66, 6], ff: [60, 0], nh: [30, 0], fh: [29, 6] },
      // 덮치기 직전: 몸을 낮추고 머리를 앞으로 내밀어 이빨을 드러냄, 고드름 갈기가 곤두섬, 뒷다리를 웅크림
      aim: { f: [-3, 5, 5, 30, 62], nk: 10, h: 4, jaw: 24, hk: 1.55, tl: -10, nf: [71, 0], ff: [65, 0], nh: [37, 0], fh: [33, 0], breath: true },
      // 덮쳐 물기: 뒷다리로 박차고 몸을 쭉 뻗어 앞발과 입을 내밂
      attack: { f: [4, -8, -12, 30, 62], nk: 6, h: 6, jaw: 34, hk: 1.25, tl: 8, nf: { L: [82, 66], T: [88, 68] }, ff: { L: [78, 69], T: [84, 72] }, nh: [19, 0], fh: { L: [14, 72], T: [10, 76] }, bite: true },
      // 맞고 휘청: 머리가 젖혀지며 깨갱, 고드름 조각이 튐
      die0: { f: [-4, -2, -8, 30, 62], nk: -14, h: -10, jaw: 24, hk: 0.9, tl: 10, nf: [70, 5], ff: [62, 0], nh: [28, 0], fh: [22, 1.5], hurt: true, shards: 1 },
      // 다리가 풀려 주저앉음, 고드름이 부러져 흩어짐
      die1: { f: [-3, 8, 6, 30, 62], nk: 22, h: 6, jaw: 10, hk: 0.45, tl: 16, nf: { L: [70, 74], T: [76, 75] }, ff: { L: [66, 74], T: [72, 75] }, nh: [37, 0], fh: [21, 0.6], dead: true, shards: 2 },
      // 옆으로 길게 뻗어 누움: 머리를 땅에, 고드름 조각과 안개만 남음
      die2: { f: [-1, 14, 0, 30, 62], nk: 34, h: 6, jaw: 4, hk: 0, tl: 20, nf: { L: [84, 68], T: [90, 69] }, ff: { L: [80, 67], T: [86, 68] }, nh: { L: [12, 68], T: [7, 69] }, fh: { L: [17, 67], T: [12, 68] }, dead: true, gone: true, shards: 3 },
    };
    const p = P[fr] || P.walk0;
    const F = frame(p.f[0], p.f[1] + 5, p.f[2], p.f[3] ?? 30, p.f[4] ?? 60);
    const NF = sub(F, p.nk, 62, 52);
    const HF = sub(NF, p.h, 74, 40);
    const bodyD = 'M22 56C20 47 27 43 35 44C45 45 51 43 59 41C69 39 76 45 76 55C76 63 71 69 63 69C55 69 49 63 41 63C33 64 24 63 22 56Z';
    const neckD = 'M58 46C60 38 66 31 74 30L83 38C79 45 74 51 72 58Z';

    const pawAt = (q, back) => {
      if (Array.isArray(q)) {
        const lifted = q[1] > 1.5;
        const W = [q[0], G - 3.2 - q[1]];
        return { W, T: lifted ? add(W, [back ? -1 : -3.4, 2.6]) : [q[0] + 4.2, G - 2.2 - q[1]], ground: !lifted };
      }
      return { W: F(q.L), T: F(q.T) };
    };
    const frontLeg = (root, q, col, r = 1) => {
      const S = F(root);
      const { W, T } = pawAt(q);
      const E = ik(S, W, 10.5, 11.5, -1);
      return blob(c, [...seg2(S, E, W, 4.6 * r, 3 * r, 2.4 * r), cap(W, 2.9 * r, T, 2.3 * r)], legG(c, col, 0.12, -0.32)) +
        c.L(`M${pt(add(T, [1.4, 0.6]))}l1.4 1.2`, '#5a6274', 1.5);
    };
    const hindLeg = (root, q, col, r = 1) => {
      const Hh = F(root);
      const { W, T } = pawAt(q, true);
      const J = Array.isArray(q) ? add(W, [-4.5, -9.5]) : lerp(Hh, W, 0.62);
      const K = ik(Hh, J, 10, 9.5, 1);
      return blob(c, [cap(Hh, 6.8 * r, K, 3.8 * r), cap(K, 3.8 * r, J, 2.5 * r), cap(J, 2.5 * r, W, 2.4 * r), cap(W, 2.8 * r, T, 2.2 * r)], legG(c, col, 0.1, -0.3));
    };
    // 고드름 갈기(목덜미~등)
    const hackles = () => {
      let out = '';
      const base = bez([34, 46], [44, 44], [56, 40], [66, 33], 6);
      for (let i = 0; i < base.length; i++) {
        const [x, y] = base[i];
        const l = (7 + Math.sin((i / 6) * Math.PI) * 6) * p.hk;
        if (l < 2) continue;
        out += c.P(`M${n(x - 4)} ${n(y + 3)}L${n(x - 5 - l * 0.45)} ${n(y - l)}L${n(x + 4)} ${n(y + 2)}Z`, spk, ' stroke-width="2.2"');
      }
      return out;
    };

    let s = '';
    // 꼬리: 풍성하게, 끝은 고드름
    const tb = F([24, 51]);
    const tt = add(F([10, 72]), [-p.tl * 0.3, -p.tl]);
    const tailPts = bez(tb, add(F([14, 52]), [0, -p.tl * 0.3]), add(F([6, 62]), [-p.tl * 0.2, -p.tl * 0.7]), tt, 10);
    s += c.P(taper(tailPts, 5.6, 3.4), lit(c, fur, F, 0.3)) + c.Pn(taper(tailPts.slice(2, 9), 2, 1.2), '#ffffff', 0.35) +
      c.P(`M${pt(add(tt, [-2, -1]))}L${pt(add(tt, [-4, 7]))}L${pt(add(tt, [1, 2]))}L${pt(add(tt, [2, 8]))}L${pt(add(tt, [3, -1]))}Z`, spk, ' stroke-width="1.8"') +
      c.L(`M${pt(tailPts[4])}l2 2M${pt(tailPts[7])}l2 1.5`, furD, 1.5);
    s += hindLeg([27, 53], p.fh, furD, 0.92) + frontLeg([61, 57], p.ff, furD, 0.92);
    s += F.g(hackles());
    // 몸통 + 목 (이음매 없이)
    s += fuse(c, [[F.g, bodyD, lit(c, fur, F, 0.36, -0.32)], [NF.g, neckD, lit(c, fur, NF, 0.36, -0.3)]]);
    const bc = F([48, 55]);
    s += form(c, bodyD, F, [bc[0], bc[1], 27, 12], 0.3, 0.18);
    s += F.g(c.Pn('M28 60C38 64 52 62 60 66C52 68 36 66 28 60Z', '#9aa3b4', 0.45) + c.L('M36 50l-2 3M44 49l-1.5 3.4M28 52l-2.5 2', furD, 1.5) + c.shine(36, 49, 9, 3, 0.45));
    // 목 + 머리
    s += NF.g(c.P('M73 41L68 49L75 46L72 53L79 47Z', '#f2f5fa', ' stroke-width="2"'));
    s += HF.g(
      c.P('M73 31L71 19L78 28Z', furD) +
      (p.jaw > 8 ? c.P('M82 39L97.5 39.5L94 48L83 47Z', '#3a1e2e') + c.P('M91 41L93 41L92 44.5Z', '#fff') : '') +
      g(c.P('M81 42L96 42.5C95.5 45.5 92 47.5 88 47.5L82 46.5Z', lit(c, fur, HF, 0.3)) + (p.jaw > 8 ? c.P('M92.5 42.6L94.4 42.6L93.3 39.6Z', '#fff') : ''), `rotate(${p.jaw} 83 42)`) +
      c.P('M70 36C71 28 79 24 86 27L92 33L98 37C99.5 40 97.5 43 94 43L84 44C77 45 71 42 70 36Z', lit(c, fur, HF, 0.36, -0.3)) +
      c.Pn('M72 39C78 43 88 44 96 42C90 45 78 46 72 39Z', OL, 0.18) +
      c.P('M76 30L76 16.5L83.5 27Z', lit(c, fur, HF)) + c.Pn('M77.5 27L77.5 20L81 26Z', ICE, 0.75) +
      c.E(97.6, 37.6, 2.1, 1.8, OL) + c.En(80, 34, 5, 3.2, '#9aa3b4', 0.55) +
      (p.dead ? deadEye(c, 84, 34, 2.6) : c.eye(84, 33.6, p.hurt ? 3.4 : 2.8))
    );
    s += hindLeg([31, 54], p.nh, fur) + frontLeg([65, 58], p.nf, fur);
    // 서리 숨결·효과
    const mouth = HF([97, 44]);
    if (!p.dead) s += c.mist(p.breath ? [[mouth[0] + 1, mouth[1] + 2, 3], [mouth[0] + 5, mouth[1] + 4, 2.4], [mouth[0] - 1, mouth[1] + 6, 2]] : [[mouth[0] - 1, mouth[1] + 4, 2.4], [mouth[0] - 5, mouth[1] + 6, 1.8]], ICE_L, 0.85);
    if (p.bite) s += hitStar(c, mouth[0] + 1, mouth[1] - 2, 6) + speed(c, [[16, 44, 10], [12, 54, 12], [16, 64, 8]], ICE_L);
    if (p.hurt) s += hitStar(c, 44, 46, 6.5);
    if (p.shards) {
      const sets = { 1: [[52, 30, 20], [60, 26, -30], [44, 32, 50]], 2: [[40, 52, 60], [56, 46, -20], [70, 54, 100], [48, 40, 10]], 3: [[30, 87, 80], [44, 88, -10], [62, 87, 30], [74, 88, 95]] }[p.shards];
      s += sets.map(([x, y, a]) => g(c.P('M-2.2 0L0 -7L2.2 0L0 2.4Z', spk, ' stroke-width="1.6"'), `translate(${x} ${y}) rotate(${a})`)).join('');
    }
    if (p.gone) s += c.mist([[38, 66, 3.2], [50, 60, 2.6], [44, 54, 2], [58, 52, 1.6]], ICE_L, 0.6);
    return c.out(fit(s, 0.96, 50, 0));
  };
  D.frost_wolf.frames = true;

  /* ---------- 10 눈 요정: 날갯짓하며 눈송이가 돌아감 · 물러나 냉기를 모았다 얼음 조각을 뿜으며 돌진 · 죽으면 눈송이 팔이 흩어지며 빛으로 사라짐 ---------- */
  MOTION.snow_wisp = { gait: 'fly', bob: 0.06, hover: 0.5, tilt: 0, sway: 0.03, squash: 0.06, deathFx: 'sparks', deathTime: 0.6 };
  D.snow_wisp = (fr) => {
    const c = make(3.4);
    const wingD = 'M0 0C-4-12-14-22-26-22C-24-12-14-3 0 0Z';
    const wingFill = c.lin([[0, '#ffffff', 0.95], [1, ICE, 0.6]]);
    // x,y 중심 · rot 눈송이 회전 · arm 팔 길이 배율 · spread 팔이 흩어짐 · core [sx, sy] · wn/wf 날개 각 · glow 빛 세기
    const P = {
      walk0: { x: 50, y: 51, rot: 0, arm: 1, core: [1, 1], wn: 40, wf: 14, glow: 0.45 },
      walk1: { x: 50, y: 50, rot: 15, arm: 1, core: [0.95, 1.06], wn: 10, wf: -16, glow: 0.45 },
      walk2: { x: 50, y: 48, rot: 30, arm: 1, core: [1.06, 0.95], wn: -24, wf: -50, glow: 0.45 },
      walk3: { x: 50, y: 50, rot: 45, arm: 1, core: [0.97, 1.03], wn: 14, wf: -12, glow: 0.45 },
      // 물러나며 냉기를 모음: 팔이 길고 뾰족해지고 빛이 강해짐, 앞쪽에 얼음 결정이 모여듦
      aim: { x: 44, y: 50, rot: 10, arm: 1.16, core: [1.05, 1.05], wn: 56, wf: 34, glow: 0.75, gather: true },
      // 돌진: 앞으로 쏘아 나가며 얼음 조각을 뿜음
      attack: { x: 56, y: 52, rot: 30, arm: 1.08, core: [1.15, 0.9], wn: -36, wf: -56, glow: 0.7, blast: true },
      // 맞음: 팔 하나가 부러지고 빛이 깜빡임
      die0: { x: 47, y: 50, rot: 20, arm: 0.95, core: [0.9, 1.1], wn: 50, wf: -60, glow: 0.3, broken: 1, hurt: true },
      // 흩어짐: 팔들이 바깥으로 떨어져 나가고 몸이 작아짐
      die1: { x: 50, y: 54, rot: 35, arm: 0.85, core: [0.65, 0.65], wn: -62, wf: -72, glow: 0.25, spread: 12, dead: true },
    };
    if (fr === 'die2') {
      // 남은 모습: 떨어지는 눈 결정 몇 개와 흩어지는 빛
      let s = `<circle cx="50" cy="66" r="16" fill="${ICE}" opacity=".18" stroke="none" ${c.soft()}/>`;
      s += [[38, 60, 0.5], [56, 54, 0.4], [64, 70, 0.45], [44, 78, 0.35], [52, 86, 0.3]].map(([x, y, k]) =>
        g(c.L('M0-8V8M-7-4L7 4M-7 4L7-4', '#ffffff', 2.4), `translate(${x} ${y}) scale(${k * 1.6})`)).join('');
      s += [[30, 50], [70, 46], [60, 62], [40, 70], [50, 40]].map(([x, y]) => c.spark(x, y, 1.4, ICE)).join('');
      return c.out(s);
    }
    const p = P[fr] || P.walk0;
    const { x, y } = p;
    const wings = (a, sc, far) => g(c.P(wingD, wingFill, ` stroke-width="2.2"${far ? ' opacity=".75"' : ''}`) + c.L('M-4-4L-18-16M-8-1L-20-10', '#ffffff', 1.5, ' opacity=".8"'), `translate(${x - 9} ${y - 3}) rotate(${a - 18}) scale(${sc})`);
    let arms = '';
    let tips = '';
    for (let k = 0; k < 6; k++) {
      if (p.broken === 1 && k === 2) continue;
      const a = ((k * 60 - 90 + p.rot) * Math.PI) / 180;
      const off = p.spread ? [Math.cos(a) * p.spread, Math.sin(a) * p.spread] : [0, 0];
      const q = (r, da = 0) => `${n(x + off[0] + Math.cos(a + da) * r * p.arm)} ${n(y + off[1] + Math.sin(a + da) * r * p.arm)}`;
      arms += `M${q(p.spread ? 8 : 0)}L${q(30)}M${q(18)}L${q(27, 0.45)}M${q(18)}L${q(27, -0.45)}M${q(10)}L${q(15, 0.6)}M${q(10)}L${q(15, -0.6)}`;
      tips += `<circle cx="${q(31).split(' ')[0]}" cy="${q(31).split(' ')[1]}" r="1.8" fill="#fff" stroke="none"/>`;
    }
    let s = `<circle cx="${x}" cy="${y}" r="${n(30 * p.arm)}" fill="${ICE}" opacity="${p.glow}" stroke="none" ${c.soft()}/>`;
    s += wings(p.wf, 1.32, true) + wings(p.wn, 1.48, false);
    s += c.limb(arms, 5.2, '#dff7ff') + c.L(arms, ICE, 2) + tips;
    const coreD = `M${x - 15} ${y}A15 15 0 1 0 ${x + 15} ${y}A15 15 0 1 0 ${x - 15} ${y}Z`;
    const CF = frame(0, 0, 0, x, y, p.core[0], p.core[1]);
    s += CF.g(c.P(coreD, c.body('#bfefff', 0.6, -0.22, 0.34, 0.28)));
    s += form(c, coreD, CF, [x, y, 15, 15], 0.18, 0.3);
    s += CF.g(
      (p.dead ? deadEye(c, x + 4, y - 2, 3) + deadEye(c, x + 12, y - 2, 2.6) : c.eye(x + 4, y - 2, p.hurt ? 3 : 3.6) + c.eye(x + 13, y - 2, p.hurt ? 2.6 : 3.2)) +
      (p.blast ? c.E(x + 9, y + 6, 2.6, 2.2, '#2a6a8a') : c.L(`M${x + 6} ${y + 6}q3 2 6 0`, '#2a6a8a', 1.6)) +
      c.shine(x - 6, y - 7, 5, 3, 0.7)
    );
    if (p.gather) s += [[86, 40, 200], [88, 58, 160], [80, 30, 220], [82, 68, 140]].map(([qx, qy, a]) => g(c.P('M0-1.6L7 0L0 1.6L-1.4 0Z', '#e8fbff', ' stroke-width="1.6"'), `translate(${qx} ${qy}) rotate(${a})`)).join('') + c.spark(x + 22, y, 2, ICE);
    if (p.blast) s += c.mist([[88, 52, 6], [94, 44, 4], [94, 60, 4]], ICE_L, 0.8) + [[84, 40, -20], [90, 50, 0], [86, 62, 20], [96, 56, 10]].map(([qx, qy, a]) => g(c.P('M-3-1.8L5 0L-3 1.8Z', '#ffffff', ' stroke-width="1.6"'), `translate(${qx} ${qy}) rotate(${a})`)).join('') + speed(c, [[18, 44, 10], [14, 56, 12], [20, 66, 8]], ICE_L);
    if (p.hurt) s += hitStar(c, x - 10, y - 12, 6) + g(c.L('M0 0L0-14M0-8l4-4M0-8l-4-4', '#dff7ff', 3), `translate(${x - 26} ${y + 20}) rotate(-130)`);
    if (p.spread) s += [[24, 30], [78, 28], [80, 78], [22, 76]].map(([qx, qy]) => c.spark(qx, qy, 1.6, ICE)).join('');
    return c.out(s);
  };
  D.snow_wisp.frames = true;

  /* ---------- 11 얼음 거북: 느릿느릿 네발(대각선 짝) · 목을 움츠렸다 쭉 뻗어 부리로 물기 · 죽으면 머리·다리를 집어넣고 빙산 등껍질이 쩍 갈라짐 ---------- */
  MOTION.ice_tortoise = { gait: 'crawl', bob: 0.015, tilt: 1.5, sway: 0, squash: 0.02, deathFx: 'shatter', deathTime: 1.0 };
  D.ice_tortoise = (fr) => {
    const c = make(3);
    const G = 90 - c.ow / 2;
    const skin = '#8b92a0';
    const skinD = sh(skin, -0.3);
    const ice = c.lin([[0, '#f4fdff'], [0.45, '#9fe6ff'], [1, '#3aa6d4']]);
    const shellD = 'M16 66L20 48L28 42L32 25L42 31L50 9L58 25L67 21L72 38L80 45L84 66Z';
    const rimD = 'M11 70C13 60 87 60 89 70C82 79 18 79 11 70Z';
    const shell = (cracked) => c.P(shellD, ice) +
      c.Pn('M20 48L28 42L32 25L42 31L50 9L46 40L38 44L30 52Z', '#ffffff', 0.45) +
      c.L('M50 9L46 40L32 25M46 40L67 21M46 40L72 38M46 40L38 44L28 42M38 44L30 60M46 40L58 56', '#ffffff', 1.8, ' opacity=".8"') +
      c.L('M58 56L72 38M58 56L80 45', '#2a86b4', 1.5, ' opacity=".6"') +
      (cracked ? c.L('M50 9L52 24L46 34L54 44L48 56L52 66', OL, 3.2) + c.L('M50 9L52 24L46 34L54 44L48 56L52 66', '#ffffff', 1.5) : '') +
      c.shine(36, 34, 4, 9, 0.6, 20);
    const rim = (F) => c.P(rimD, lit(c, '#7d8696', F, 0.3)) + c.L('M24 64L22 76M38 63L37 77M52 63V77M66 63L67 77M78 64L80 76', sh('#7d8696', -0.4), 1.6);

    if (fr === 'die2') {
      // 남은 모습: 머리·다리를 집어넣은 채 둘로 쪼개진 빙산 등껍질과 얼음 조각
      let s = '';
      s += g(c.P('M16 66L20 48L28 42L32 25L42 31L50 9L52 24L46 34L54 44L48 56L52 66Z', ice) + c.Pn('M20 48L28 42L32 25L42 31L50 9L46 34L30 52Z', '#ffffff', 0.4), 'translate(-6 14) rotate(-10 34 66)');
      s += g(c.P('M52 66L48 56L54 44L46 34L52 24L50 9L58 25L67 21L72 38L80 45L84 66Z', ice) + c.L('M58 56L72 38M58 56L80 45', '#2a86b4', 1.5, ' opacity=".6"'), 'translate(8 14) rotate(12 66 66)');
      s += c.P('M14 89C16 80 84 80 86 89Z', lit(c, '#7d8696', null, 0.25)) + c.L('M28 83v6M50 81v8M72 83v6', sh('#7d8696', -0.4), 1.6);
      s += [[8, 86, 20], [92, 85, -30], [40, 70, 60], [62, 66, -50]].map(([x, y, a]) => g(c.P('M-3 0L0-6L3 0L0 3Z', ice, ' stroke-width="2"'), `translate(${x} ${y}) rotate(${a})`)).join('');
      s += c.mist([[50, 62, 3.4], [44, 54, 2.6], [56, 48, 2]], ICE_L, 0.55);
      return c.out(fit(s, 0.95, 50, 0));
    }

    // f 몸 · nk 목 끝(머리 자리, 몸 좌표) · ha 머리 각 · jaw 부리 · 발 [x, 들림] · tuck 움츠림
    const P = {
      walk0: { f: [0, 0, 0], nk: [84, 62], ha: 6, jaw: 2, nf: [76, 0], ff: [62, 0.6], nh: [24, 0.6], fh: [36, 0] },
      walk1: { f: [0, -1, -1], nk: [85, 60], ha: 2, jaw: 2, nf: [71, 0], ff: [68, 4], nh: [32, 4], fh: [31, 0] },
      walk2: { f: [0, 0, 0], nk: [84, 62], ha: 6, jaw: 2, nf: [66, 0.6], ff: [72, 0], nh: [36, 0], fh: [26, 0.6] },
      walk3: { f: [0, -1, 1], nk: [86, 61], ha: 4, jaw: 2, nf: [73, 4], ff: [66, 0], nh: [28, 0], fh: [34, 4] },
      // 물기 직전: 목을 S자로 움츠려 머리를 들고 부리를 크게 벌림
      aim: { f: [-2, -2, -3], nk: [78, 50], ha: -22, jaw: 30, nf: [74, 0], ff: [66, 0], nh: [28, 0], fh: [34, 0], tuck: true },
      // 물기: 목을 앞아래로 쭉 뻗어 부리를 꽉 다묾
      attack: { f: [3, 1, 4], nk: [92, 70], ha: 18, jaw: 4, nf: [80, 0], ff: [70, 0], nh: [28, 0], fh: [33, 0], snap: true },
      // 맞음: 머리가 젖혀지고 등껍질에서 얼음 조각이 튐
      die0: { f: [-3, -1, -5], nk: [80, 50], ha: -34, jaw: 22, nf: [72, 3], ff: [66, 0], nh: [28, 0], fh: [34, 1.5], hurt: true },
      // 금이 가며 주저앉음: 다리가 풀리고 머리가 땅으로, 등껍질에 큰 금
      die1: { f: [0, 7, 3], nk: [86, 80], ha: 30, jaw: 8, nf: { L: [78, 76], T: [84, 78] }, ff: { L: [72, 76], T: [78, 78] }, nh: { L: [22, 76], T: [16, 78] }, fh: { L: [28, 76], T: [22, 78] }, dead: true, cracked: true },
    };
    const p = P[fr] || P.walk0;
    const F = frame(...p.f, 50, 74);
    const foot = (A, col, lifted) => c.E(A[0] + 1, A[1] + 2.4, 6.2, 3.2, lit(c, col, null, 0.25)) + c.L(`M${n(A[0] + 3)} ${n(A[1] + 4.4)}l2 0.8M${n(A[0] + 5.6)} ${n(A[1] + 3.6)}l2 0.6`, '#e8e4d8', 1.8, lifted ? ' opacity=".8"' : '');
    const leg = (root, q, col, front, r = 1) => {
      const S = F(root);
      let A;
      let lifted = false;
      if (Array.isArray(q)) { lifted = q[1] > 1.5; A = [q[0], G - 5.2 - q[1]]; } else A = F(q.L);
      const K = ik(S, A, 7.5, 7, front ? -1 : 1);
      return blob(c, seg2(S, K, A, 6.6 * r, 5.6 * r, 5 * r), legG(c, col, 0.15, -0.3)) + foot(A, col, lifted) +
        c.L(`M${pt(add(K, [-3, 1]))}l2.4-1.4M${pt(add(A, [-3, -3]))}l2.4-1`, sh(col, -0.35), 1.5);
    };
    let s = '';
    s += leg([30, 70], p.fh, skinD, false, 0.92) + leg([66, 70], p.ff, skinD, true, 0.92);
    s += F.g(c.P('M20 72L8 76L20 79Z', skin));
    // 목과 머리
    const B = F([72, 68]);
    const Hp = F(p.nk);
    const ctrl = p.tuck ? [add(B, [10, 4]), add(Hp, [-10, 10])] : [add(B, [6, -2]), add(Hp, [-6, 2])];
    s += c.P(taper(bez(B, ...ctrl, Hp, 10), 6.4, 4.8), lit(c, skin, null, 0.3)) + c.L(`M${pt(lerp(B, Hp, 0.4))}l1.5 3M${pt(lerp(B, Hp, 0.65))}l1.5 3`, skinD, 1.5);
    const ha = p.ha + F.rot;
    const head = (p.jaw > 8 ? c.P('M1 1L17 0L13 8L2 6Z', '#3a1e2e') : '') +
      g(c.P('M1 3L15 2.5L13 6.5C9 8.5 4 8.5 0.5 6Z', lit(c, skin, { rot: ha, sx: 1, sy: 1 }, 0.25)), `rotate(${p.jaw} 1 3)`) +
      c.P('M-4-5C0-10 11-10 15-5L18.5 0.5L15 2.5L-3 4.5Z', lit(c, skin, { rot: ha, sx: 1, sy: 1 }, 0.35)) +
      c.L('M12-1.5L18 0.5', OL, 1.5) +
      (p.dead ? deadEye(c, 7, -4.5, 2.4) : c.eye(7, -4.5, p.hurt ? 3.2 : 2.6));
    s += `<g transform="translate(${pt(Hp)}) rotate(${n(ha)})">${head}</g>`;
    // 등껍질
    s += F.g(rim(F) + shell(p.cracked));
    const sc = F([50, 50]);
    s += form(c, shellD, F, [sc[0], sc[1], 32, 22], 0.22, 0);
    s += leg([34, 72], p.nh, skin, false) + leg([70, 72], p.nf, skin, true);
    if (p.snap) s += hitStar(c, Hp[0] + 4, Hp[1] + 2, 6) + c.mist([[Hp[0] - 2, Hp[1] + 8, 2.2], [Hp[0] + 6, Hp[1] + 9, 1.8]], ICE_L, 0.85);
    if (p.tuck) s += c.mist([[Hp[0] + 18, Hp[1] + 2, 2], [Hp[0] + 20, Hp[1] - 4, 1.6]], ICE_L, 0.8);
    if (p.hurt) s += hitStar(c, 52, 24, 6.5) + [[60, 10, 30], [40, 8, -40], [70, 18, 70]].map(([x, y, a]) => g(c.P('M-2 0L0-5L2 0L0 2Z', ice, ' stroke-width="1.8"'), `translate(${x} ${y}) rotate(${a})`)).join('');
    if (p.dead) s += c.mist([[50, 30, 2.6], [56, 22, 2]], ICE_L, 0.6);
    return c.out(fit(s, 0.9, 48, 0));
  };
  D.ice_tortoise.frames = true;

  /* ---------- 12 눈사태 골렘: 쿵쿵 무겁게 · 두 주먹을 머리 위로 모았다 땅을 내려침 · 죽으면 금이 가며 바위와 눈 무더기로 부서짐 ---------- */
  MOTION.avalanche_golem = { gait: 'stomp', bob: 0.02, tilt: 3, sway: 0, squash: 0.03, deathFx: 'crumble', deathTime: 1.0 };
  D.avalanche_golem = (fr) => {
    const c = make(3);
    const G = 90 - c.ow / 2;
    const rock = '#7f8797';
    const rockD = sh(rock, -0.3);
    const snow = c.lin([[0, '#ffffff'], [1, '#bfe6f5']]);
    const torsoD = 'M24 46C22 28 36 18 54 19C72 20 82 32 80 48C78 62 68 70 52 71C36 71 26 62 24 46Z';
    const capD = 'M24 40C25 25 39 17 54 18C69 19 80 28 81 42C75 37 70 42 64 37C58 42 52 35 46 40C40 35 33 42 24 40Z';
    const boulder = (x, y, r, col, a = 0) => g(c.P('M-9-3L-4-9L5-8L10-1L7 7L-3 9L-9 4Z', lit(c, col, { rot: a, sx: 1, sy: 1 }, 0.3)), `translate(${n(x)} ${n(y)}) rotate(${a}) scale(${n(r / 9)})`);

    if (fr === 'die2') {
      // 남은 모습: 바위 조각과 눈 무더기, 흩날리는 눈가루
      let s = '';
      s += c.P('M12 89C14 78 30 72 44 76C52 70 66 70 74 76C84 74 92 80 90 89Z', snow);
      s += boulder(30, 82, 10, rockD, 20) + boulder(56, 80, 12, rock, -10) + boulder(76, 84, 8, rockD, 40) + boulder(44, 86, 6, rock, 70);
      s += g(c.P('M58 25C58 16 66 12 74 13C82 15 85 24 81 31C77 36 65 36 60 31Z', lit(c, rock, { rot: 70, sx: 1, sy: 1 }, 0.3)) + c.P('M65 25L82 24L81 30L65 30Z', '#241b2c'), 'translate(84 78) rotate(70) scale(0.7) translate(-71 -24)');
      s += c.mist([[40, 66, 3], [60, 62, 2.6], [50, 56, 2], [70, 58, 1.8], [30, 70, 2]], '#ffffff', 0.8);
      return c.out(fit(s, 0.95, 50, 0));
    }

    // f 몸 · h 머리 · nl/fl 발 [x, 들림] · nh/fh 주먹 [x, y]
    const P = {
      walk0: { f: [0, 0, -2], h: 0, nl: [64, 0], fl: [38, 0.6], nh: [90, 70], fh: [13, 73] },
      walk1: { f: [0, -1.3, 0], h: 2, nl: [56, 0], fl: [46, 5], nh: [89, 72], fh: [14, 71] },
      walk2: { f: [0, 0, 2], h: 0, nl: [48, 0.6], fl: [56, 0], nh: [87, 74], fh: [16, 69] },
      walk3: { f: [0, -1.3, 0], h: -2, nl: [56, 5], fl: [46, 0], nh: [89, 72], fh: [14, 71] },
      // 두 주먹을 머리 위로 모아 들어 올림, 몸이 뒤로 젖혀짐
      aim: { f: [-3, 0, -8], h: -8, nl: [62, 0], fl: [38, 0], nh: [62, 8], fh: [44, 9] },
      // 땅을 내려침: 몸을 숙이며 두 주먹을 앞 땅에 꽂음, 땅이 갈라지고 눈이 튐
      attack: { f: [3, 3, 12], h: 8, nl: [64, 0], fl: [40, 0], nh: [88, 83], fh: [76, 84], slam: true },
      // 맞음: 어깨 바위가 떨어져 나가고 금이 감
      die0: { f: [-4, -1, -10], h: -14, nl: [58, 0], fl: [42, 2], nh: [88, 40], fh: [12, 46], hurt: true },
      // 무너짐: 금이 크게 가고 몸이 내려앉으며 주먹이 땅에 떨어짐, 바위 조각이 굴러떨어짐
      die1: { f: [0, 9, 6], h: 22, nl: [62, 0], fl: [40, 0], nh: [88, 84], fh: [12, 84], dead: true, crack: true },
    };
    const p = P[fr] || P.walk0;
    const F = frame(...p.f, 50, 66);
    const HF = sub(F, p.h, 68, 30);
    const leg = (hip, q, col) => {
      const Hh = F(hip);
      const A = [q[0], G - 4.5 - q[1]];
      const K = ik(Hh, A, 9, 8.5, 1);
      return blob(c, seg2(Hh, K, A, 7.4, 6.6, 6), legG(c, col, 0.15, -0.3)) +
        c.P(`M${n(A[0] - 7)} ${n(G - q[1])}L${n(A[0] - 6)} ${n(A[1] + 0.5)}L${n(A[0] + 7)} ${n(A[1])}L${n(A[0] + 9)} ${n(G - q[1])}Z`, lit(c, sh(col, -0.06), null, 0.25)) +
        c.E(K[0], K[1], 4.2, 3.4, '#eef8ff', ' stroke-width="2"') + c.L(`M${pt(add(Hh, [-3, 3]))}l2 4`, sh(col, -0.35), 1.6);
    };
    const arm = (S0, Hd, col, bend) => {
      const S = F(S0);
      const E = ik(S, Hd, 13, 12, bend);
      const a = angOf(E, Hd);
      return blob(c, seg2(S, E, Hd, 7.4, 6.2, 5.6), lit(c, col, null, 0.3)) +
        c.E(E[0], E[1], 4.6, 3.8, '#eef8ff', ' stroke-width="2"') +
        c.E(Hd[0], Hd[1], 8.6, 7.6, lit(c, col, { rot: a - 90, sx: 1, sy: 1 }, 0.35), ` transform="rotate(${n(a - 90)} ${n(Hd[0])} ${n(Hd[1])})"`) +
        c.L(`M${pt(pol(Hd, 4, a + 120))}l3 1.5M${pt(pol(Hd, 4, a - 120))}l3-1.5`, sh(col, -0.35), 1.6) +
        c.P(`M${pt(pol(Hd, 8, a + 200))}Q${pt(pol(Hd, 10, a + 180))} ${pt(pol(Hd, 7, a + 140))}L${pt(pol(Hd, 4, a + 170))}Z`, snow, ' stroke-width="2"');
    };
    let s = '';
    s += arm([25, 44], p.fh, rockD, -1);
    s += leg([42, 64], p.fl, rockD) + leg([58, 64], p.nl, rock);
    s += F.g(c.P(torsoD, lit(c, rock, F, 0.35)));
    const tc = F([52, 45]);
    s += form(c, torsoD, F, [tc[0], tc[1], 28, 25], 0.3, 0.12);
    s += F.g(
      c.L('M34 50L40 56L38 64M62 52L70 60M48 40L54 46', rockD, 2) +
      (p.crack ? c.L('M54 20L50 34L56 44L48 58L52 70', OL, 3.4) + c.L('M54 20L50 34L56 44L48 58L52 70', '#dfe9f2', 1.5) : '') +
      c.P(capD, snow) + c.Pn('M30 38C30 42 34 44 34 40ZM58 38C58 44 62 44 62 39Z', '#ffffff', 0.9)
    );
    s += HF.g(
      c.P('M58 25C58 16 66 12 74 13C82 15 85 24 81 31C77 36 65 36 60 31Z', lit(c, rock, HF, 0.3)) +
      c.Pn('M59 28C64 34 76 35 81 30L81 32C76 37 64 37 59 31Z', OL, 0.25) +
      c.P('M57 22C59 14 67 10 75 12C80 14 84 19 84 24C79 21 75 25 71 22C67 25 62 21 57 22Z', snow) +
      c.P('M65 25L82 24L81 30L65 30Z', '#241b2c') +
      (p.dead ? '' : c.eye(71, 27.5, p.hurt ? 2.8 : 2.2, false) + c.eye(78, 27, p.hurt ? 2.6 : 2, false))
    );
    s += arm([78, 44], p.nh, rock, 1);
    // 눈가루·효과
    if (!p.dead && !p.slam) s += c.mist(fr === 'walk1' || fr === 'walk3' ? [[86, 60, 1.6], [16, 64, 1.4], [74, 82, 1.4]] : [[84, 52, 1.4], [18, 56, 1.6], [28, 80, 1.6]], '#ffffff', 0.9);
    if (p.slam) s += hitStar(c, 82, 86, 7) + c.mist([[70, 84, 4], [94, 82, 4], [82, 76, 3.4], [62, 86, 3]], '#ffffff', 0.9) + c.L('M70 89l-6-4l-4 3M92 89l5-4l4 2M82 89l1-5', OL, 2);
    if (p.hurt) s += hitStar(c, 72, 34, 6.5) + boulder(86, 22, 5, rock, 40) + boulder(92, 32, 3.4, rockD, -20) + c.mist([[80, 28, 2], [88, 18, 1.6]], '#ffffff', 0.85);
    if (p.dead) s += boulder(30, 84, 5, rockD, 30) + boulder(70, 86, 4, rock, -30) + c.mist([[30, 30, 3], [70, 26, 2.6], [50, 22, 2]], '#ffffff', 0.85);
    return c.out(fit(s, 0.95, 50, 0));
  };
  D.avalanche_golem.frames = true;

  /* ---------- 13 눈덩이 골렘: 데굴데굴 구르며 돌 팔로 밀기 · 돌 주먹을 뒤로 감았다 앞으로 지르기 · 죽으면 쩍 갈라져 눈 무더기 ---------- */
  MOTION.snowball_golem = { gait: 'roll', bob: 0.02, tilt: 0, sway: 0, squash: 0.08, deathFx: 'crumble', deathTime: 0.5 };
  D.snowball_golem = (fr) => {
    const c = make(3.4);
    const G = 90 - c.ow / 2;
    const stone = '#7d8594';
    const stoneD = sh(stone, -0.3);
    const snowB = '#eef6fb';
    const rockP = (x, y, sc, col, a = 0) => g(c.P('M-9-3L-4-9L5-8L10-1L7 7L-3 9L-9 4Z', lit(c, col, { rot: a, sx: 1, sy: 1 }, 0.3)), `translate(${n(x)} ${n(y)}) rotate(${a}) scale(${sc})`);
    if (fr === 'die1' || fr === 'die2') {
      let s = '';
      if (fr === 'die1') {
        // 쩍 갈라짐: 눈덩이가 세 조각으로 벌어지고 돌 팔이 떨어짐
        s += g(c.P('M48 31C32 31 20 44 20 60L46 58Z', lit(c, snowB, null, 0.3, -0.28)), 'translate(-6 -4) rotate(-12 34 50)');
        s += g(c.P('M48 31C64 31 76 44 76 60L50 58Z', lit(c, snowB, null, 0.3, -0.28)) + c.E(62, 48, 3.8, 4.6, '#2b2236'), 'translate(6 -5) rotate(14 62 50)');
        s += c.P('M20 64C22 78 34 88 48 88C62 88 74 78 76 64L48 60Z', lit(c, snowB, null, 0.3, -0.28));
        s += rockP(14, 80, 0.8, stoneD, 30) + rockP(86, 82, 0.9, stone, -20);
        s += c.mist([[48, 54, 4], [30, 40, 2.6], [66, 38, 2.6], [48, 30, 2]], '#ffffff', 0.9);
      } else {
        s += c.P('M14 89C16 80 26 76 36 79C42 74 54 74 60 79C70 76 82 80 84 89Z', lit(c, snowB, null, 0.25, -0.2));
        s += rockP(22, 84, 0.7, stoneD, 30) + rockP(76, 85, 0.8, stone, -40) + rockP(50, 86, 0.5, stoneD, 80);
        s += c.E(44, 79, 2.4, 2, '#2b2236') + c.E(56, 80, 2.2, 1.8, '#2b2236');
        s += c.mist([[40, 70, 2.4], [56, 66, 2], [48, 60, 1.6]], '#ffffff', 0.8);
      }
      return c.out(fit(s, 0.9, 50, 0));
    }
    // rt 구름 무늬 회전 · f 몸 [dx, dy, 기울기, sx, sy] · nh/fh 주먹 [x, y]
    const P = {
      walk0: { rt: 0, f: [0, 0, 0, 1.03, 0.97], nh: [88, 80], fh: [10, 70] },
      walk1: { rt: 45, f: [0, -2, 0, 0.97, 1.03], nh: [92, 68], fh: [8, 78] },
      walk2: { rt: 90, f: [0, 0, 0, 1.03, 0.97], nh: [88, 78], fh: [10, 72] },
      walk3: { rt: 135, f: [0, -2, 0, 0.97, 1.03], nh: [92, 70], fh: [6, 76] },
      // 주먹을 뒤로 감음: 몸이 뒤로 젖혀지며 납작
      aim: { rt: 20, f: [-3, 0, -10, 1.06, 0.94], nh: [72, 24], fh: [10, 58], face: 1 },
      // 주먹 지르기: 앞으로 쏠리며 길쭉
      attack: { rt: 60, f: [2, -1, 10, 0.95, 1.04], nh: [98, 56], fh: [10, 66], face: 1, punch: true },
      // 맞음: 위쪽 눈이 떨어져 나가고 눈을 찡그림
      die0: { rt: 30, f: [-3, 0, -8, 1.04, 0.95], nh: [90, 36], fh: [8, 42], face: 2, hurt: true },
    };
    const p = P[fr] || P.walk0;
    const F = frame(p.f[0], p.f[1], p.f[2], 48, 88, p.f[3], p.f[4]);
    const ballD = 'M18 59A30 29 0 1 0 78 59A30 29 0 1 0 18 59Z';
    const arm = (S0, Hd, col, bend) => {
      const S = F(S0);
      const E = ik(S, Hd, 11, 10.5, bend);
      const a = angOf(E, Hd);
      return blob(c, seg2(S, E, Hd, 4.2, 3.6, 3.2), lit(c, col, null, 0.3)) + c.E(E[0], E[1], 3.6, 3.2, lit(c, sh(col, 0.08), null, 0.35)) + rockP(Hd[0], Hd[1], 0.9, col, a);
    };
    let s = '';
    s += arm([20, 60], p.fh, stoneD, -1);
    s += F.g(c.P(ballD, lit(c, snowB, F, 0.3, -0.28)));
    const bc = F([48, 59]);
    s += form(c, ballD, F, [bc[0], bc[1], 30, 29], 0.26, 0.25);
    s += F.g(g(c.L('M30 44C34 40 40 38 46 38M24 64C28 72 36 78 46 80M60 78C66 76 72 70 74 64', '#9fd3ea', 2.4) +
      c.E(30, 56, 2.5, 2, stone) + c.E(44, 76, 2, 1.6, stone) + c.E(66, 40, 1.8, 1.4, stone), `rotate(${p.rt} 48 59)`));
    s += F.g(
      (p.face === 2 ? c.L('M50 48l6 2M62 47l6 2', '#2b2236', 2.6) : c.E(53, 49, 4.6, 5.4, '#2b2236') + c.E(65, 48, 4.2, 5, '#2b2236') + c.eye(53.5, 49, 2.4, false) + c.eye(65.5, 48, 2.2, false)) +
      (p.face === 1 ? c.L('M48 42l9 3M62 41l8 2', '#2b2236', 2.4) : '') +
      c.L(p.punch ? 'M54 62Q59 68 64 62' : 'M52 62Q58 66 64 61', '#2b2236', 2.4) +
      c.shine(34, 42, 8, 4, 0.7)
    );
    s += arm([76, 60], p.nh, stone, 1);
    if (fr.startsWith('walk')) s += c.mist(fr === 'walk1' || fr === 'walk3' ? [[18, 86, 3], [10, 84, 2]] : [[22, 86, 2.5], [14, 82, 2]], '#ffffff', 0.85);
    if (p.punch) s += hitStar(c, 98, 52, 6) + c.mist([[92, 44, 2.6], [94, 62, 2.4]], '#ffffff', 0.9) + speed(c, [[14, 50, 9], [10, 62, 11]]);
    if (p.hurt) s += hitStar(c, 40, 34, 6) + c.mist([[30, 22, 3.4], [44, 18, 2.6], [22, 30, 2.2]], '#ffffff', 0.95);
    return c.out(fit(s, 0.9, 50, 0));
  };
  D.snowball_golem.frames = true;

  /* ---------- 14 설인 주술사: 뼈 지팡이를 짚으며 어기적 · 지팡이를 높이 들어 냉기를 모았다 내리꽂으며 치유 섬광 · 죽으면 무릎 꿇고 엎어져 불이 꺼짐 ---------- */
  MOTION.yeti_shaman = { gait: 'lumber', bob: 0.04, tilt: 5, sway: 0.01, squash: 0.03, deathFx: 'mist', deathTime: 1.0 };
  D.yeti_shaman = (fr) => {
    const c = make(3);
    const G = 90 - c.ow / 2;
    const fur = '#d8dbe4';
    const furD = sh(fur, -0.3);
    const face = '#62607a';
    const bone = '#e3dccb';
    const flameG = c.lin([[0, '#ffffff'], [0.5, ICE], [1, '#2a86b4']]);
    // 뼈 지팡이(손 기준, 위 = -y): 자루 · 감개 · 해골 · 푸른 불(fl 크기, 0이면 꺼짐)
    const staff = (fl) => c.limb('M0 35L0-30', 4.4, bone) + c.L('M-2.2 2l4.4-1.6M-2.2 6l4.4-1.6M-2.2 10l4.4-1.6', sh('#8a6a48', 0), 1.8) +
      c.E(0, 22, 3.4, 2.4, bone) + c.E(0, -33, 6, 5, lit(c, '#e8e0cc', null, 0.3)) + c.En(-2, -33, 1.3, 1.6, OL) + c.En(2.5, -33, 1.3, 1.6, OL) +
      c.L('M-3-29.5l6 0', OL, 1.5) +
      (fl ? `<path d="M0-${n(38 + 12 * fl)}C${n(5 * fl)}-${n(36 + 8 * fl)} ${n(7 * fl)}-41 ${n(5 * fl)}-37C${n(3 * fl)}-34-${n(3 * fl)}-34-${n(5 * fl)}-37C-${n(6 * fl)}-41-${n(3 * fl)}-${n(36 + 6 * fl)} 0-${n(38 + 12 * fl)}Z" fill="${ICE}" stroke="none" opacity=".7" ${c.soft()}/>` +
        c.P(`M0-${n(38 + 12 * fl)}C${n(5 * fl)}-${n(36 + 8 * fl)} ${n(7 * fl)}-41 ${n(5 * fl)}-37C${n(3 * fl)}-34-${n(3 * fl)}-34-${n(5 * fl)}-37C-${n(6 * fl)}-41-${n(3 * fl)}-${n(36 + 6 * fl)} 0-${n(38 + 12 * fl)}Z`, flameG, ' stroke-width="2.2"') : c.mist([[0, -42, 2.4], [2, -48, 1.8]], '#9aa0aa', 0.7));
    const headD = 'M44 34C40 20 48 10 60 10C72 10 79 20 77 32C75 40 66 44 58 44C50 44 46 40 44 34Z';
    const head = (HFx, dead, hurt) => c.P('M50 22C46 14 48 7 54 4C52 9 54 15 57 20Z', bone) +
      c.P(headD, lit(c, fur, HFx, 0.35, -0.3)) + c.L('M50 14l-3 5M56 11l-1 5M46 24l-3 3', furD, 2) +
      c.P('M60 22C66 18 76 20 79 26C81 33 77 40 70 41C64 41 60 37 59 31Z', lit(c, face, HFx, 0.3)) +
      c.P('M60 23C66 19 75 21 79 26L60 27Z', sh(face, -0.3)) +
      (dead ? deadEye(c, 66, 28.5, 2.5) + deadEye(c, 74, 28.5, 2.2) : c.eye(66, 28, hurt ? 3.2 : 2.7) + c.eye(74, 28, hurt ? 2.9 : 2.4)) +
      c.P('M66 36L67.5 39L69 36ZM72 36L73 39L74.5 36Z', '#ffffff') +
      c.P('M64 14C67 7 74 4 80 7C75 8 72 11 70 16Z', bone);
    const bodyD = 'M24 72C19 68 19 60 24 56C20 50 24 42 32 41C36 35 45 32 53 32L62 32C72 34 78 42 76 50C82 54 82 62 77 66C80 72 76 78 70 78L62 80L54 77L46 80L38 77L30 79C26 78 24 75 24 72Z';

    if (fr === 'die2') {
      // 남은 모습: 엎어진 털 더미, 꺼진 해골 지팡이에서 연기, 안개
      let s = '';
      s += held([58, 88], 92, staff(0));
      s += c.P('M12 89C10 80 18 72 30 72C40 66 56 66 66 72C76 72 82 80 80 89Z', lit(c, fur, null, 0.3, -0.32)) + c.L('M26 80q-2 4 0 8M44 74q-2 4 0 8M62 76q2 4 0 8', furD, 2);
      s += c.P('M24 78C30 74 50 72 66 76L64 80L58 77L52 81L46 77L40 81L34 77Z', lit(c, '#55688a', null, 0.3));
      s += g(c.P(headD, lit(c, fur, null, 0.35)) + c.P('M50 22C46 14 48 7 54 4C52 9 54 15 57 20Z', bone), 'translate(84 80) rotate(60) scale(0.7) translate(-60 -28)');
      s += c.mist([[46, 62, 3.4], [54, 54, 2.6], [42, 50, 2]], MISTC, 0.6);
      return c.out(fit(s, 0.86, 50, 0));
    }

    // f 몸 · h 머리 · nl/fl 발 [x, 들림] · nh 지팡이 손 [x, y, 각도] · fh 빈손 [x, y] · fl 불 크기
    const P = {
      walk0: { f: [0, 0, -2], h: 0, nl: [60, 0], fl: [40, 0.6], nh: [80, 54, 8], fh: [30, 66], fire: 1 },
      walk1: { f: [0, -1.5, 0], h: 2, nl: [53, 0], fl: [47, 5], nh: [79, 51, 2], fh: [28, 64], fire: 1.1 },
      walk2: { f: [0, 0, 2], h: 0, nl: [44, 0.6], fl: [56, 0], nh: [77, 54, -6], fh: [26, 62], fire: 1 },
      walk3: { f: [0, -1.5, 0], h: -2, nl: [52, 5], fl: [48, 0], nh: [79, 51, 2], fh: [28, 64], fire: 1.1 },
      // 지팡이를 높이 쳐들고 빈손을 펴 냉기를 모음(치유 준비·공격 준비)
      aim: { f: [-3, -1, -8], h: -10, nl: [60, 0], fl: [40, 0], nh: [70, 42, -14], fh: [28, 34], fire: 1.4, gather: true },
      // 지팡이를 앞으로 내리꽂음: 해골 불이 터지며 치유의 고리(근접 공격에도 같은 자세)
      attack: { f: [2, 1, 9], h: 8, nl: [64, 0], fl: [40, 0], nh: [80, 52, 24], fh: [72, 52], fire: 1.7, heal: true },
      // 맞음: 뒤로 휘청, 지팡이가 기울고 불이 깜빡임
      die0: { f: [-4, -1, -10], h: -16, nl: [54, 0], fl: [42, 2], nh: [76, 44, -26], fh: [22, 46], fire: 0.6, hurt: true },
      // 무릎을 꿇으며 앞으로 쓰러짐, 지팡이가 손에서 빠짐, 불이 꺼져 감
      die1: { f: [0, 11, 14], h: 20, nl: [62, 0], fl: [44, 0], nh: [74, 80, 0], fh: [40, 80], fire: 0, dead: true, drop: [66, 86, 78] },
    };
    const p = P[fr] || P.walk0;
    const F = frame(...p.f, 48, 72);
    const HF = sub(F, p.h, 60, 40);
    const leg = (hip, q, col) => {
      const Hh = F(hip);
      const A = [q[0], G - 4.4 - q[1]];
      const K = ik(Hh, A, 8.5, 8, 1);
      const foot = c.P(`M${n(A[0] - 6)} ${n(A[1] + 4.4)}C${n(A[0] - 6)} ${n(A[1] - 1)} ${n(A[0] + 4)} ${n(A[1] - 1.5)} ${n(A[0] + 8)} ${n(A[1] + 2)}L${n(A[0] + 8.5)} ${n(A[1] + 4.4)}Z`, lit(c, col, null, 0.25));
      return blob(c, seg2(Hh, K, A, 6.4, 5.6, 5), legG(c, col, 0.12, -0.3)) + foot + c.L(`M${n(A[0] + 5)} ${n(A[1] + 4)}l2 0.6M${n(A[0] + 2)} ${n(A[1] + 4.2)}l2 0.6`, '#f4f0e6', 1.6);
    };
    const arm = (S0, hand, col, withStaff) => {
      const S = F(S0);
      const Hd = [hand[0], hand[1]];
      const E = ik(S, Hd, 12, 11, -1);
      const fa = angOf(E, Hd);
      let out = blob(c, seg2(S, E, Hd, 6, 5.2, 4.6), lit(c, col, null, 0.3)) + c.L(`M${pt(lerp(S, E, 0.5))}l-2 3M${pt(lerp(E, Hd, 0.5))}l-2 3`, sh(col, -0.3), 1.8);
      if (withStaff && !p.drop) out += held(Hd, hand[2], staff(p.fire));
      out += c.E(Hd[0], Hd[1], 5.4, 5, lit(c, col, null, 0.35), ` transform="rotate(${n(fa)} ${n(Hd[0])} ${n(Hd[1])})"`);
      out += c.L([-30, 0, 30].map((da) => `M${pt(pol(Hd, 4.6, fa + da))}L${pt(pol(Hd, 7, fa + da))}`).join(''), '#f4f0e6', 1.6);
      return out;
    };
    let s = '';
    s += arm([34, 46], p.fh, furD, false);
    s += leg([42, 72], p.fl, furD) + leg([54, 72], p.nl, fur);
    s += F.g(c.P(bodyD, lit(c, fur, F, 0.3, -0.34)));
    const bc = F([50, 58]);
    s += form(c, bodyD, F, [bc[0], bc[1], 28, 22], 0.3, 0.16);
    s += F.g(
      c.L('M30 62q-3 4-1 8M40 70q-2 4 0 6M62 70q2 4 0 6M68 56q3 3 2 7', furD, 2) +
      c.P('M26 47C34 39 56 37 73 43L72 51L68 56L64 51L60 57L56 51L52 57L48 51L44 57L40 51L36 56L32 51L27 54Z', lit(c, '#55688a', F, 0.3)) +
      c.E(42, 46, 2.2, 2.8, '#e8e0cc') + c.E(52, 46, 2.4, 3, ICE) + c.E(62, 46, 2.2, 2.8, '#e8e0cc') +
      (p.gather || p.heal ? c.spark(52, 46, 1.6, ICE) : '')
    );
    s += HF.g(head(HF, p.dead, p.hurt));
    s += arm([66, 46], p.nh, fur, true);
    if (p.drop) s += held([p.drop[0], p.drop[1]], p.drop[2], staff(0));
    if (p.gather) s += c.spark(p.fh[0], p.fh[1] - 6, 2.4, ICE) + c.mist([[p.fh[0] - 4, p.fh[1] - 10, 2], [p.fh[0] + 5, p.fh[1] - 12, 1.6]], ICE_L, 0.8);
    if (p.heal) {
      const top = add([p.nh[0], p.nh[1]], [Math.sin(24 * RAD) * 40, -Math.cos(24 * RAD) * 40]);
      s += `<circle cx="${n(top[0])}" cy="${n(top[1])}" r="16" fill="${ICE}" opacity=".35" stroke="none" ${c.soft()}/>`;
      s += `<ellipse cx="50" cy="86" rx="40" ry="7" fill="none" stroke="#b8f0d8" stroke-width="2.6" opacity=".85"/>`;
      s += [[20, 70], [80, 66], [14, 50], [30, 40], [90, 40]].map(([x, y]) => c.L(`M${x - 3} ${y}h6M${x} ${y - 3}v6`, '#c8ffe0', 2.2)).join('');
    }
    if (p.hurt) s += hitStar(c, 46, 50, 6.5) + c.L('M30 40l-5-3M28 46l-6 0M32 34l-4-5', fur, 2.4);
    return c.out(fit(s, 0.86, 50, 0));
  };
  D.yeti_shaman.frames = true;

  /* ---------- 15 서리 망령: 떠서 미끄러지며 옷자락이 물결침 · 두 소매를 치켜들었다 얼음 발톱으로 할퀴기 · 죽으면 천만 남고 안개로 흩어짐 ---------- */
  MOTION.rime_wraith = { gait: 'float', bob: 0.05, tilt: 4, sway: 0.03, squash: 0.03, deathFx: 'mist', deathTime: 0.9 };
  D.rime_wraith = (fr) => {
    const c = make(3);
    const cloth = c.lin([[0, '#f4fdff', 0.95], [0.5, '#a9e4f7', 0.82], [1, '#5fb8dc', 0.5]]);
    const clothS = c.lin([[0, '#dff6ff', 0.9], [1, '#7fc8e4', 0.7]]);
    const clawG = c.lin([[0, '#ffffff'], [1, ICE]]);
    const hoodD = 'M47 8C61 8 71 18 72 32C72 38 69 43 65 45L43 45C35 39 33 29 35 21C37 13 41 8 47 8Z';
    const hood = (HFx, dead, flare) => c.P('M38 15C30 15 22 20 17 27C25 26 31 27 36 30Z', clothS) +
      c.P(hoodD, cloth) +
      c.E(61, 31, 9, 10, c.rad([[0, '#3a3450'], [1, '#141020']], 0.6, 0.5, 0.6)) +
      (dead ? deadEye(c, 59, 30, 2.4) + deadEye(c, 66, 30, 2.1) : c.eye(59, 30, flare ? 3.2 : 2.6, false) + c.eye(66, 30, flare ? 2.8 : 2.3, false)) +
      c.L('M45 14Q42 26 46 40', '#ffffff', 1.6, ' opacity=".7"') + c.shine(46, 18, 4, 7, 0.6, 20);

    if (fr === 'die2') {
      // 남은 모습: 얼어붙은 빈 천 더미와 서리 결정, 마지막 안개
      let s = c.mist([[50, 66, 4], [56, 58, 3], [46, 52, 2.4], [58, 46, 1.8]], ICE_L, 0.55);
      s += c.P('M14 89C16 82 26 78 36 80C44 74 58 74 66 79C74 77 84 80 88 89Z', cloth) + c.L('M26 84l8-2M48 80l6 3M66 83l8-1', '#ffffff', 1.6, ' opacity=".8"');
      s += g(c.P(hoodD, cloth) + c.E(61, 31, 8, 9, '#2a2440'), 'translate(66 78) rotate(80) scale(0.55) translate(-54 -27)');
      s += [[22, 86], [40, 88], [80, 86]].map(([x, y]) => g(c.P('M0-6L2 0L0 6L-2 0Z', clawG, ' stroke-width="1.6"'), `translate(${x} ${y})`)).join('');
      return c.out(s);
    }

    // f 몸 · ph 옷단 물결 위상 · h 두건 · nh/fh 손(발톱) 목표 · fade 아래가 안개로 사라짐
    const P = {
      walk0: { f: [0, 0, -2], ph: 0, h: 0, nh: [74, 64], fh: [40, 62] },
      walk1: { f: [0, -2.2, 0], ph: 1.6, h: 2, nh: [76, 61], fh: [42, 64] },
      walk2: { f: [0, 0, 2], ph: 3.2, h: 0, nh: [78, 58], fh: [38, 64] },
      walk3: { f: [0, -1.2, 0], ph: 4.8, h: -2, nh: [76, 62], fh: [40, 62] },
      // 할퀴기 직전: 몸을 뒤로 젖히고 두 소매를 높이 치켜듦, 발톱을 쫙 폄
      aim: { f: [-4, -2, -12], ph: 1, h: -8, nh: [80, 22], fh: [24, 26], flare: true },
      // 할퀴기: 앞으로 덮치며 얼음 발톱으로 아래로 긁음
      attack: { f: [5, 2, 14], ph: 2.5, h: 8, nh: [90, 64], fh: [80, 50], slash: true },
      // 맞음: 몸이 꺾이고 천이 찢어짐, 얼음 부스러기
      die0: { f: [-4, 0, -14], ph: 4, h: -14, nh: [80, 34], fh: [22, 40], hurt: true },
      // 스러짐: 아래부터 안개로 풀리며 두건이 꺾여 내려앉음
      die1: { f: [0, 10, 8], ph: 5, h: 22, nh: [72, 82], fh: [40, 82], dead: true, fade: true },
    };
    const p = P[fr] || P.walk0;
    const F = frame(...p.f, 50, 60);
    const HF = sub(F, p.h, 54, 44);
    let hem = '';
    for (let i = 0; i <= 6; i++) {
      const x = 24 + i * 8.4;
      const tip = 82 + Math.sin(i * 1.3 + p.ph) * 4.5;
      hem += `L${n(x - 4.2)} ${n(tip)}L${n(x)} ${n(tip - 7)}`;
    }
    const bodyD = `M40 30C33 42 30 58 24 72${hem}L76 68C72 56 70 44 66 34Z`;
    const sleeve = (shp, hand, col, far) => {
      const S = F(shp);
      const E = ik(S, hand, 12, 11.5, -1);
      const a = angOf(E, hand);
      const pts = bez(S, lerp(S, E, 0.7), lerp(E, hand, 0.3), hand, 8);
      let out = c.P(taper(pts, 5, 4.2), col);
      out += c.P(`M${pt(pol(hand, 6, a + 90))}L${pt(pol(hand, 5, a + 10))}L${pt(pol(hand, 6, a - 90))}L${pt(pol(hand, -2, a))}Z`, col);
      out += [-28, 0, 28].map((da) => { const b = pol(hand, 3, a + da * 0.6); const tip = pol(hand, p.flare ? 10 : 8, a + da); return c.P(`M${pt(pol(b, 1.6, a + da + 90))}L${pt(tip)}L${pt(pol(b, 1.6, a + da - 90))}Z`, clawG, ' stroke-width="1.8"'); }).join('');
      return out + (far ? '' : c.L(`M${pt(lerp(S, E, 0.5))}l2 3`, '#ffffff', 1.5, ' opacity=".7"'));
    };
    let s = '';
    if (!p.fade) s += c.mist([[F([30, 88])[0], 88, 3], [F([64, 89])[0], 89, 2.5]], ICE_L, 0.65);
    s += sleeve([44, 46], p.fh, clothS, true);
    s += F.g(c.P(bodyD, cloth, p.fade ? ' opacity=".55"' : ''));
    const bc = F([50, 56]);
    s += form(c, bodyD, F, [bc[0], bc[1], 24, 24], 0.22, 0.2);
    s += F.g(c.L('M40 50l6 4l-2 6M56 66l4-5l6 2M36 70l4 3', '#ffffff', 1.6, ' opacity=".8"') + c.P('M58 52L61 47L64 52L61 57Z', clawG, ' stroke-width="1.6"'));
    if (p.fade) s += c.mist([[30, 82, 6], [44, 86, 5], [58, 84, 6], [72, 80, 5], [38, 74, 4], [64, 72, 4]], ICE_L, 0.7);
    s += HF.g(hood(HF, p.dead, p.flare));
    s += sleeve([60, 48], p.nh, cloth, false);
    if (p.slash) s += c.L('M78 42Q92 56 88 76M84 40Q98 56 94 74M72 46Q84 58 82 76', '#ffffff', 2.6, ' opacity=".85"');
    if (p.hurt) s += hitStar(c, 52, 50, 6.5) + F.g(c.E(46, 62, 3.4, 2.4, '#2a4a6a', ' stroke-width="1.6"')) + c.L('M30 40l-5-3M28 48l-6 0', ICE_L, 2);
    return c.out(fit(s, 0.95, 50, 0));
  };
  D.rime_wraith.frames = true;

  /* ---------- 16 얼음 방패병: 방패를 앞세워 행군 · 방패 뒤로 몸을 웅크렸다 방패로 들이받기 · 죽으면 방패가 산산조각 나고 엎어짐 ---------- */
  MOTION.ice_shieldbearer = { gait: 'march', bob: 0.03, tilt: 2, sway: 0, squash: 0, deathFx: 'shatter', deathTime: 0.8 };
  D.ice_shieldbearer = (fr) => {
    const c = make(3);
    const G = 90 - c.ow / 2;
    const armor = '#8a90a2';
    const armorD = sh(armor, -0.32);
    const furC = '#eef2f8';
    const iceS = c.lin([[0, '#f4fdff', 0.95], [0.5, '#8fdcff', 0.9], [1, '#2a8cc0', 0.9]], 'd');
    const tipG = c.lin([[0, '#ffffff'], [1, ICE]]);
    // 창(손 기준, 창끝 = -y)
    const spear = c.limb('M0 22L0-30', 3.2, '#8a6a48') + c.L('M-1.6 2l3.2-1.2M-1.6 5l3.2-1.2', sh('#8a6a48', -0.35), 1.5) + c.P('M-3-29L0-42L3-29L0-27Z', tipG, ' stroke-width="2.2"');
    // 얼음 방패(손잡이 기준): 금 cracks 0~2
    const shieldD = 'M-6-25L14-30L24-18L23 10L9 33L-6 25L-10-10Z';
    const shield = (cracks) => c.P(shieldD, iceS) + c.Pn('M-6-25L14-30L8-12L-4-6Z', '#ffffff', 0.5) +
      c.L('M2-20L7-8L0 0L8 10L4 20M7-8L17-5', OL, 2.2) + c.L('M3-19L8-8L1 0L9 10', '#ffffff', 1.5, ' opacity=".8"') +
      (cracks ? c.L(cracks > 1 ? 'M14-30L10-14L16-4L8 6L14 18L9 33M-10-10L4-2L23 0' : 'M14-30L10-14L16-4L8 6', OL, 2.6) + c.L(cracks > 1 ? 'M14-30L10-14L16-4L8 6L14 18' : 'M14-30L10-14L16-4', '#ffffff', 1.5) : '') +
      c.L('M-6-25L14-30L24-18', '#ffffff', 1.6, ' opacity=".8"');
    const helmD = 'M32 22C32 12 40 7 46 7C54 7 60 13 60 22L60 32L32 32Z';
    const helm = (HFx, dead) => c.P(helmD, lit(c, armor, HFx, 0.4)) + c.Pn('M32 28L60 28L60 32L32 32Z', OL, 0.25) +
      c.P('M44 2L50 9L40 9Z', tipG, ' stroke-width="2.2"') +
      c.P('M43 18L61 18L61 24L43 24Z', '#241b2c') + (dead ? '' : c.eye(52, 21, 2.1, false) + c.eye(57.5, 21, 1.9, false)) +
      c.L('M36 10L36 30', sh(armor, -0.35), 1.5) + c.shine(38, 14, 3, 5, 0.45, 0);

    if (fr === 'die2') {
      // 남은 모습: 엎어진 병사, 산산조각 난 방패와 떨어진 창
      let s = '';
      s += held([34, 88], 84, spear);
      s += c.P('M14 89L14 82C20 79 30 79 34 82L36 89Z', lit(c, armorD, null, 0.3)) + c.P('M30 89C30 78 40 74 54 74C62 74 66 80 66 89Z', lit(c, armor, { rot: 80, sx: 1, sy: 1 }, 0.35)) + c.mist([[56, 75, 3.4], [62, 76, 3], [50, 74, 3]], furC, 1);
      s += g(helm({ rot: 80, sx: 1, sy: 1 }, true), 'translate(72 80) rotate(80) scale(0.75) translate(-46 -20)');
      s += [[80, 86, 30, 0.5], [88, 80, -20, 0.4], [18, 76, 60, 0.35], [92, 88, 80, 0.3], [62, 66, -40, 0.3]].map(([x, y, a, k]) => g(c.P('M-6-8L6-10L4 8L-4 6Z', iceS), `translate(${x} ${y}) rotate(${a}) scale(${k * 1.6})`)).join('');
      s += c.mist([[46, 64, 3], [54, 58, 2.4]], ICE_L, 0.6);
      return c.out(fit(s, 0.95, 50, 0));
    }

    // f 몸 · h 투구 · nl/fl 발 [x, 들림] · nh 창 손 [x, y, 각도] · sh 방패 손 [x, y, 각도] · cr 금
    const P = {
      walk0: { f: [0, 0, 0], h: 0, nl: [58, 0], fl: [40, 0.8], nh: [46, 60, -34], sh: [64, 50, 0], cr: 0 },
      walk1: { f: [0, -1.4, -1], h: 1, nl: [50, 0], fl: [51, 6], nh: [48, 59, -30], sh: [65, 49, 0], cr: 0 },
      walk2: { f: [0, 0, 0], h: 0, nl: [42, 0.8], fl: [58, 0], nh: [50, 58, -26], sh: [65, 50, 0], cr: 0 },
      walk3: { f: [0, -1.4, 1], h: -1, nl: [51, 6], fl: [49, 0], nh: [48, 59, -30], sh: [65, 49, 0], cr: 0 },
      // 들이받기 직전: 몸을 낮춰 방패 뒤로 웅크리고 방패를 끌어당김, 창은 뒤로
      aim: { f: [-3, 4, 6], h: 6, nl: [40, 0], fl: [62, 0], nh: [36, 54, -70], sh: [58, 50, -8], cr: 0 },
      // 방패 들이받기: 앞발을 내딛으며 방패를 앞으로 내지름, 서리가 터짐
      attack: { f: [3, 1, 8], h: 4, nl: [36, 0], fl: [64, 0], nh: [44, 56, -40], sh: [74, 50, 6], cr: 0, bash: true },
      // 맞음: 방패에 금이 가고 뒤로 휘청
      die0: { f: [-4, -1, -10], h: -14, nl: [48, 0], fl: [56, 2], nh: [36, 40, -30], sh: [62, 44, -18], cr: 1, hurt: true },
      // 방패가 산산조각, 무릎을 꿇음
      die1: { f: [0, 13, 10], h: 16, nl: [58, 0], fl: [44, 0], nh: [56, 80, 80], sh: [66, 74, 30], cr: 2, dead: true, broken: true },
    };
    const p = P[fr] || P.walk0;
    const F = frame(...p.f, 48, 62);
    const HF = sub(F, p.h, 46, 32);
    const leg = (hip, q, col) => {
      const Hh = F(hip);
      const A = [q[0], G - 4.6 - q[1]];
      const K = ik(Hh, A, 12.5, 12.5, 1);
      const a = q[1] > 1.5 ? 26 : 0;
      const foot = g(c.P('M-3.6-5L3.6-5C7-5 9-2.4 9 0L-4 0Z', lit(c, sh(col, -0.15), null, 0.25)) + c.L('M-3.8-5L3.6-5', furC, 2.4), `translate(${pt(add(A, [0, 4.6]))}) rotate(${a} 0 -4.6)`);
      return foot + blob(c, seg2(Hh, K, A, 4.8, 4, 3.4), legG(c, col, 0.2, -0.3)) + c.E(K[0], K[1], 3.4, 3.2, lit(c, col, null, 0.4));
    };
    const arm = (S0, hand, col) => {
      const S = F(S0);
      const Hd = [hand[0], hand[1]];
      const E = ik(S, Hd, 10.5, 10, -1);
      const fa = angOf(E, Hd);
      return { svg: blob(c, seg2(S, E, Hd, 4, 3.5, 3.2), legG(c, col, 0.2, -0.25)) + c.E(E[0], E[1], 3.2, 3, lit(c, col, null, 0.4)), fa, Hd };
    };
    let s = '';
    // 창 든 팔(먼 쪽 = 오른손이 방패보다 뒤) — 창은 몸 뒤에서 위로
    const na = arm([42, 40], p.nh, armorD);
    s += held(na.Hd, p.nh[2], spear) + na.svg + fist(c, na.Hd, na.fa, 3.4, lit(c, armorD, null, 0.3), sh(armorD, -0.5));
    s += leg([45, 60], p.fl, armorD) + leg([51, 60], p.nl, armor);
    const torsoD = 'M32 38C36 32 54 32 58 36L58 62L32 62Z';
    s += F.g(c.P('M31 58L59 58L61 68L29 68Z', lit(c, sh(armor, -0.12), F, 0.3)) + c.L('M38 59L37 68M45 59V68M52 59L53 68', sh(armor, -0.45), 1.5));
    s += F.g(c.P(torsoD, lit(c, armor, F, 0.35)));
    const tc = F([45, 48]);
    s += form(c, torsoD, F, [tc[0], tc[1], 13, 14], 0.28, 0.18);
    s += F.g(c.L('M45 34V60', sh(armor, -0.4), 1.5) + c.L('M32 56L58 56', '#6a5a4a', 3) + c.E(45, 56, 2.2, 2, '#c9b07a', ' stroke-width="1.6"') +
      c.mist([[34, 35, 4], [40, 33, 4], [47, 33, 4], [54, 34, 4]], furC, 1));
    s += HF.g(helm(HF, p.dead));
    // 방패 든 팔 + 방패(몸 앞)
    const sa = arm([50, 40], [p.sh[0], p.sh[1]], armor);
    s += sa.svg + fist(c, sa.Hd, sa.fa, 3.4, lit(c, armor, null, 0.3), sh(armor, -0.5));
    if (p.broken) {
      s += [[p.sh[0] + 8, p.sh[1] - 16, -30, 0.55], [p.sh[0] + 18, p.sh[1] - 4, 20, 0.5], [p.sh[0] + 4, p.sh[1] + 10, 50, 0.45], [p.sh[0] + 22, p.sh[1] + 12, -60, 0.35], [p.sh[0] - 8, p.sh[1] - 22, 80, 0.3]].map(([x, y, a, k]) => g(c.P('M-6-8L6-10L4 8L-4 6Z', iceS), `translate(${n(x)} ${n(y)}) rotate(${a}) scale(${k * 1.6})`)).join('');
    } else {
      s += held([p.sh[0] + 4, p.sh[1]], p.sh[2] + F.rot * 0.5, shield(p.cr));
    }
    if (p.bash) s += hitStar(c, 94, 46, 7) + c.mist([[94, 34, 3.4], [96, 60, 3], [90, 24, 2.4]], ICE_L, 0.9) + speed(c, [[24, 40, 10], [20, 52, 12], [24, 64, 8]], ICE_L);
    if (p.hurt) s += hitStar(c, 78, 34, 6.5) + c.L('M86 30l5-3M88 38l6 0', ICE_L, 2.2);
    return c.out(fit(s, 0.95, 50, 0));
  };
  D.ice_shieldbearer.frames = true;

  /* ---------- 보스 2 서리 군주 흰뿔: 위엄 있는 걸음(대각선 짝) · 고개를 젖혀 숨을 들이켰다(포효) 서리 숨결을 뿜음 · 죽으면 무릎 꿇고 조용히 엎드려 뿔의 얼음이 녹아내림 ---------- */
  MOTION.whitehorn = { gait: 'walk', bob: 0.03, tilt: 2, sway: 0, squash: 0.02, deathFx: 'mist', deathTime: 1.2 };
  D.whitehorn = (fr) => {
    const c = make(3);
    const G = 90 - c.ow / 2;
    const fur = '#dde1ea';
    const furD = sh(fur, -0.3);
    const hoof = '#4a4458';
    const iceG = c.lin([[0, '#ffffff'], [1, '#7fdcff']]);
    // f 몸 · nk 목 · h 머리 · jaw 입 · ag 뿔 빛 · 발 [x, 들림] 또는 {L:[몸 좌표 발목]}
    const P = {
      walk0: { f: [0, 0, 0], nk: 0, h: 0, jaw: 2, ag: 0.45, nf: [72, 0], ff: [58, 0.6], nh: [24, 0.6], fh: [36, 0] },
      walk1: { f: [0, -1.4, -1], nk: 3, h: 0, jaw: 2, ag: 0.45, nf: [66, 0], ff: [65, 6], nh: [32, 6], fh: [30, 0] },
      walk2: { f: [0, 0, 0], nk: 0, h: 0, jaw: 2, ag: 0.45, nf: [60, 0.6], ff: [70, 0], nh: [38, 0], fh: [22, 0.6] },
      walk3: { f: [0, -1.4, 1], nk: -3, h: 0, jaw: 2, ag: 0.45, nf: [68, 6], ff: [62, 0], nh: [28, 0], fh: [33, 6] },
      // 숨 들이켜기·포효: 고개를 높이 젖히고 가슴을 부풀림, 입을 벌려 냉기가 모임, 뿔이 환하게
      aim: { f: [-5, -2, -6, 30, 66], nk: -22, h: -10, jaw: 22, ag: 0.9, nf: [74, 0], ff: [68, 0], nh: [26, 0], fh: [32, 0], gather: true },
      // 서리 숨결: 고개를 앞으로 내밀어 입을 크게 벌리고 얼음 숨을 뿜음
      attack: { f: [-15, 1, 4, 30, 66], nk: 14, h: 8, jaw: 30, ag: 0.8, nf: [66, 0], ff: [56, 0], nh: [14, 0], fh: [20, 0], breath: true },
      // 맞음: 앞몸이 들리며 고개가 젖혀지고 뿔 끝이 부러져 튐
      die0: { f: [-4, -3, -9, 30, 66], nk: -18, h: -12, jaw: 20, ag: 0.3, nf: [72, 6], ff: [66, 2], nh: [28, 0], fh: [22, 1], hurt: true },
      // 앞무릎을 꿇음: 앞다리가 접히고 고개가 숙여짐
      die1: { f: [-10, 8, 8, 30, 66], nk: 22, h: 8, jaw: 6, ag: 0.15, nf: { L: [64, 80], T: [70, 82] }, ff: { L: [60, 80], T: [66, 82] }, nh: [19, 0], fh: [13, 0.6], dead: true },
      // 엎드려 잠든 듯: 다리를 접고 머리를 땅에 누임, 뿔의 얼음이 녹아 흩어짐
      die2: { f: [-13, 18, 0, 30, 66], nk: 34, h: 14, jaw: 2, ag: 0, nf: { L: [70, 70], T: [64, 72] }, ff: { L: [66, 70], T: [60, 72] }, nh: { L: [44, 70], T: [52, 72] }, fh: { L: [40, 70], T: [48, 72] }, dead: true, gone: true },
    };
    const p = P[fr] || P.walk0;
    const F = frame(p.f[0], p.f[1], p.f[2], p.f[3] ?? 30, p.f[4] ?? 64);
    const NF = sub(F, p.nk, 66, 50);
    const HF = sub(NF, p.h, 78, 30);
    const bodyD = 'M16 54C16 44 24 38 36 38L60 38C70 38 77 44 77 53C77 62 71 68 61 68L32 68C22 68 16 62 16 54Z';
    const neckD = 'M60 46C63 36 70 28 76 26L87 32C83 38 78 46 76 56Z';
    const hoofAt = (W, a) => g(c.P('M-3-0.5L3-0.5L4 4.6L-3.4 4.6Z', hoof) + c.L('M0.4 0.6L0.6 4.2', sh(hoof, 0.4), 1.5), `translate(${pt(W)}) rotate(${n(a)})`);
    const footAt = (q) => {
      if (Array.isArray(q)) { const lifted = q[1] > 1.5; return { W: [q[0], G - 4.6 - q[1]], a: lifted ? -34 : 0, air: lifted }; }
      const W = F(q.L);
      return { W, a: angOf(W, F(q.T)) - 90, air: true, free: true };
    };
    const frontLeg = (root, q, col, r = 1) => {
      const S = F(root);
      const { W, a, free } = footAt(q);
      const Kn = free ? lerp(S, W, 0.55) : add(W, [0, -10.5]);
      const E = ik(S, Kn, 9.5, 9, -1);
      return blob(c, [cap(S, 5.2 * r, E, 3.4 * r), cap(E, 3.4 * r, Kn, 2.6 * r), cap(Kn, 2.8 * r, W, 2.2 * r)], legG(c, col, 0.15, -0.3)) + hoofAt(W, a);
    };
    const hindLeg = (root, q, col, r = 1) => {
      const Hh = F(root);
      const { W, a, free } = footAt(q);
      const J = free ? lerp(Hh, W, 0.6) : add(W, [-4, -12]);
      const K = ik(Hh, J, 11, 10, 1);
      return blob(c, [cap(Hh, 7 * r, K, 3.8 * r), cap(K, 3.8 * r, J, 2.6 * r), cap(J, 2.6 * r, W, 2.2 * r)], legG(c, col, 0.12, -0.3)) + hoofAt(W, a);
    };
    const tip = (x, y, a, l) => g(c.P(`M0 3L${l} 0L0 -3L-2 0Z`, iceG, ' stroke-width="2.2"'), `translate(${x} ${y}) rotate(${a})`);
    const antler = (dx, dy, col, tipF, broken) => {
      const t = (x, y) => [x + dx, y + dy];
      const q = (pts) => pts.map(([x, y]) => t(x, y).join(' '));
      const beam = `M${q([[80, 24]])}C${q([[76, 15], [68, 12], [56, 11]]).join(' ')}M${q([[75, 17]])}L${q([[78, 9]])}M${q([[68, 13]])}L${q([[67, 7]])}M${q([[60, 11.5]])}L${q([[55, 6]])}M${q([[79, 20]])}L${q([[88, 14]])}`;
      return c.limb(beam, 4.5, col) +
        (tipF ? tip(...t(78, 9), -80, 7) + tip(...t(67, 7), -95, 6.5) + (broken ? '' : tip(...t(55, 6), -125, 7)) + tip(...t(88, 14), -40, 7) + tip(...t(56, 11), 180, 7) : '');
    };
    let s = '';
    s += hindLeg([27, 58], p.fh, furD, 0.92) + frontLeg([61, 60], p.ff, furD, 0.92);
    s += F.g(c.P('M18 50C10 48 8 42 12 40C16 42 18 44 20 46Z', '#ffffff'));
    s += fuse(c, [[F.g, bodyD, lit(c, fur, F, 0.36, -0.3)], [NF.g, neckD, lit(c, fur, NF, 0.3, -0.3)]]);
    const bc = F([46, 54]);
    s += form(c, bodyD, F, [bc[0], bc[1], 30, 14], 0.28, 0.18);
    s += F.g(c.Pn('M24 60C30 64 50 66 64 62C60 66 34 68 24 60Z', '#9fb4c8', 0.5) + c.L('M30 50q6-6 12 0t12 0M40 58q5-4 10 0', '#a9d8ee', 2, ' opacity=".8"') + c.shine(34, 44, 10, 3.5, 0.55, -5));
    s += NF.g(c.P('M64 38C70 40 74 46 76 56C72 58 70 54 68 52C66 54 62 50 60 48Z', '#f6f8fc', ' stroke-width="2.4"'));
    // 머리 + 뿔
    s += HF.g(
      `<ellipse cx="72" cy="16" rx="20" ry="9" fill="${ICE}" opacity="${p.ag}" stroke="none" ${c.soft()}/>` +
      antler(-5, 1, H.mix('#7fb8d4', '#9aa4b0', p.gone ? 0.6 : 0), false) +
      c.P('M76 24L67 17L78 20Z', furD) +
      (p.jaw > 8 ? c.P('M84 36L98 33L95 42L85 41Z', '#3a1e2e') : '') +
      g(c.P('M84 37L96 35C96 38 93 40 89 40.5L85 40Z', lit(c, fur, HF, 0.3)), `rotate(${p.jaw} 85 37)`) +
      c.P('M73 27C76 21 85 20 89 24L97 31C98 35 96 37 92 37L84 39C78 39 74 35 73 30Z', lit(c, fur, HF, 0.36, -0.3)) +
      c.Pn('M75 33C80 38 90 38 96 35C92 39 80 40 75 33Z', OL, 0.18) +
      c.E(96, 32, 1.8, 1.6, OL) + c.En(83, 29, 5, 3.4, '#a9b8cc', 0.55) +
      (p.dead ? deadEye(c, 84, 29, 2.6) : c.eye(84, 28.5, p.hurt ? 3.4 : 2.8)) +
      antler(0, 0, H.mix('#d8f5ff', '#c4ccd6', p.gone ? 0.7 : 0), !p.gone, p.hurt)
    );
    s += hindLeg([31, 59], p.nh, fur) + frontLeg([65, 61], p.nf, fur);
    // 발굽 서리
    const frost = (x) => c.P(`M${x - 7} 88.5L${x - 5} 82L${x - 3} 88.5ZM${x + 4} 88.5L${x + 6.5} 80L${x + 9} 88.5Z`, iceG, ' stroke-width="2"');
    if (Array.isArray(p.nf) && !p.nf[1]) s += frost(p.nf[0]);
    if (Array.isArray(p.nh) && !p.nh[1]) s += frost(p.nh[0]);
    const mouth = HF([96, 38]);
    if (p.gather) s += [[mouth[0] + 8, mouth[1] - 6], [mouth[0] + 10, mouth[1] + 4], [mouth[0] + 2, mouth[1] - 12]].map(([x, y]) => c.spark(x, y, 1.6, ICE)).join('') + c.L(`M${n(mouth[0] + 14)} ${n(mouth[1] - 10)}l-5 4M${n(mouth[0] + 16)} ${n(mouth[1] + 6)}l-5-3`, ICE_L, 2);
    if (p.breath) {
      const m = mouth;
      s += `<path d="M${n(m[0] - 2)} ${n(m[1])}L100 ${n(m[1] - 18)}L100 ${n(m[1] + 22)}Z" fill="${ICE_L}" opacity=".55" stroke="none" ${c.soft()}/>`;
      s += c.mist([[m[0] + 4, m[1] + 1, 3.4], [m[0] + 10, m[1] - 3, 4.4], [m[0] + 12, m[1] + 7, 4], [m[0] + 18, m[1] + 1, 5]], '#f4fcff', 0.85);
      s += [[m[0] + 14, m[1] - 10, 20], [m[0] + 20, m[1] + 12, -20], [m[0] + 8, m[1] + 10, 50]].map(([x, y, a]) => g(c.P('M-2.4 0L0-4L2.4 0L0 2Z', iceG, ' stroke-width="1.6"'), `translate(${n(x)} ${n(y)}) rotate(${a})`)).join('');
    } else if (!p.dead) s += c.mist(fr === 'walk1' || fr === 'walk3' ? [[mouth[0], mouth[1] + 3, 2.5], [mouth[0] - 4, mouth[1] + 6, 2]] : [[mouth[0] + 1, mouth[1] + 2, 2], [mouth[0] - 3, mouth[1] + 5, 2.5]], ICE_L, 0.8);
    if (p.hurt) { const at = HF([55, 6]); s += hitStar(c, 44, 46, 7) + g(c.P('M0 3L7 0L0 -3L-2 0Z', iceG, ' stroke-width="2"'), `translate(${n(at[0] - 8)} ${n(at[1] - 8)}) rotate(-140)`); }
    if (p.gone) s += c.mist([[70, 52, 3.4], [80, 44, 2.6], [64, 40, 2.2], [76, 34, 1.8]], ICE_L, 0.6) + [[30, 40], [50, 30], [86, 56]].map(([x, y]) => g(c.L('M0-4V4M-3.4-2L3.4 2M-3.4 2L3.4-2', '#ffffff', 1.8), `translate(${x} ${y})`)).join('');
    else if (p.dead) s += [[50, 84, 20], [80, 86, -30]].map(([x, y, a]) => g(c.P('M-2 0L0-5L2 0L0 2Z', iceG, ' stroke-width="1.6"'), `translate(${x} ${y}) rotate(${a})`)).join('');
    return c.out(fit(s, 0.95, 50, 0));
  };
  D.whitehorn.frames = true;

})();
