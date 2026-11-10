'use strict';

/* =========================================================
 * 영웅 · 초상화 · 아군 유닛 그림 (SVG 문자열)
 * 규격: docs/ARCHITECTURE.md §5, 동작: docs/design/animation.md
 *   RG.art.hero(id, pose)      0 0 100 100, 발 (50,90), 오른쪽을 바라봄
 *   RG.art.portrait(id, mood)  0 0 200 200, 가슴 위, 살짝 오른쪽
 *   RG.art.unit(kind, pose)    0 0 100 100, 발 (50,90), 오른쪽을 바라봄
 *
 * 그리는 방식 (animation.md §4)
 *   - 인물마다 "자세 표"(몸 위치·기울기, 두 발, 두 손, 무기 각도)를 두고 같은 그리기 함수가 읽습니다.
 *   - 팔·다리는 두 마디(어깨→팔꿈치→손, 엉덩이→무릎→발목)를 역운동학(ik)으로 이어 그립니다.
 *   - 무기는 손이 쥐는 점에서 계산해 그리고, 손(주먹)은 자루 위에 덮어 그려 손가락이 감싸게 합니다.
 *   - 빛은 늘 왼쪽 위: 면마다 오른쪽 아래가 그늘. 가까운 팔은 몸통에 그늘을 드리웁니다.
 *     바닥 그림자는 그리지 않습니다(렌더러가 그림).
 *   - 3/4 시점(오른쪽을 봄): "가까운" 팔·다리(n)는 몸 앞에, "먼" 팔·다리(f)는 몸 뒤에 그립니다.
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
      /** 돌려 그린 물건용: 물건이 a도 돌아가 있어도 빛은 화면 왼쪽 위에서 */
      gl: (c, a = 0, k = 0.3) => {
        const r = Math.round(a / 15) * 15;
        return add(`gl${c}${r}${k}`, (id) => H.lg(id, [[0, sh(c, k)], [0.55, c], [1, sh(c, -k)]], [0.15, 0, 0.85, 1])
          .replace('<linearGradient ', `<linearGradient gradientTransform="rotate(${-r} 0.5 0.5)" `));
      },
      /** 둥근 면(머리·돌) 방사형 */
      r: (c, k = 0.35) => add(`r${c}${k}`, (id) => H.rg(id, [[0, sh(c, k)], [0.6, c], [1, sh(c, -0.25)]], 0.36, 0.3, 0.8)),
      /** 빛 무리 (가운데 진하고 가장자리 투명) */
      halo: (c, a = 0.85) => add(`h${c}${a}`, (id) => H.rg(id, [[0, c, a], [0.45, c, a * 0.45], [1, c, 0]], 0.5, 0.5, 0.5)),
      glow: (std) => add(`f${std}`, (id) => H.glow(id, std)),
      raw: (key, make) => add(key, make),
      /** 경로 모양 그대로 자르는 clipPath id */
      clip: (d) => add(`clip${d}`, (id) => `<clipPath id="${id}"><path d="${d}"/></clipPath>`).slice(5, -1),
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
  /** 외곽선 있는 굵은 선 */
  const L = (d, c, w, o = 3) => `<path d="${d}" fill="none" stroke-width="${w + o}"/>` + T(d, c, w);
  const G = (body, tr, ex = '') => (tr || ex ? `<g${tr ? ` transform="${tr}"` : ''}${ex}>${body}</g>` : body);
  const op = (a) => ` opacity="${a}"`;
  /** 털 장식(둥근 점선) */
  const FUR = (d, c, w = 4.5, gap = 4, o = 2.6) => `<path d="${d}" fill="none" stroke-width="${w + o}" stroke-dasharray="0.1 ${gap}"/><path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-dasharray="0.1 ${gap}"/>`;
  /** 잘라 그리기 */
  const CL = (id, body) => `<g clip-path="url(#${id})">${body}</g>`;
  /** 그늘(검은 반투명) */
  const SHD = (d, a = 0.22) => `<path d="${d}" fill="${OLC}" opacity="${a}"/>`;

  const wrap = (vb, c, body) => h().svg(vb, c.defs.join(''),
    `<g stroke="${OLC}" stroke-width="0" stroke-linejoin="round" stroke-linecap="round">${body}</g>`);

  /** 작은 꽃 (바위·이끼) */
  function flower(x, y, col = '#fff6e0') {
    return P(`M${x} ${y - 2.6}l1 1.6 1.8-.3-.7 1.7 1.2 1.4-1.8.2-.5 1.8-1-1.5-1.7.6.4-1.8-1.4-1.1 1.8-.6z`, col, 1) + C(x, y, 0.9, '#ffcf3a', 0);
  }

  /* =========================================================
   * 기하 · 몸 만들기 도우미
   * ========================================================= */
  const D2R = Math.PI / 180;
  const V = (x, y) => ({ x, y });
  const pol = (p, len, a) => V(p.x + Math.cos(a * D2R) * len, p.y + Math.sin(a * D2R) * len);
  const rot = (p, a, o) => {
    const s = Math.sin(a * D2R);
    const k = Math.cos(a * D2R);
    const dx = p.x - o.x;
    const dy = p.y - o.y;
    return V(o.x + dx * k - dy * s, o.y + dx * s + dy * k);
  };
  const angTo = (a, b) => Math.atan2(b.y - a.y, b.x - a.x) / D2R;
  const dist = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
  const lerp = (a, b, t) => V(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
  const add = (a, x, y) => V(a.x + x, a.y + y);
  const pt = (p) => `${num(p.x)} ${num(p.y)}`;
  const vp = (a) => (Array.isArray(a) ? V(a[0], a[1]) : a);
  /** 그 점으로 옮겨 a도 돌림 */
  const at = (p, a = 0, s = 1) => `translate(${pt(p)})${a ? ` rotate(${num(a)})` : ''}${s !== 1 ? ` scale(${s})` : ''}`;

  /**
   * 두 마디 역운동학: 어깨 S에서 목표 T로 길이 a(위)·b(아래). bend +1 = 팔꿈치가 아래/뒤, −1 = 무릎이 앞.
   * 닿지 않으면 쭉 뻗은 자리까지(검수용으로 RG.art._ikLog에 남김).
   */
  function ik(S, T0, a, b, bend = 1) {
    const T = vp(T0);
    const dx = T.x - S.x;
    const dy = T.y - S.y;
    let d = Math.hypot(dx, dy) || 0.01;
    let H = T;
    const max = a + b - 0.05;
    if (d > max) {
      if (RG.art._ikLog && d > max + 0.6) RG.art._ikLog.push(`${num(d)}>${num(max)} @${pt(T)}`);
      H = V(S.x + (dx / d) * max, S.y + (dy / d) * max);
      d = max;
    }
    const min = Math.abs(a - b) + 1;
    if (d < min) {
      if (RG.art._ikLog) RG.art._ikLog.push(`short ${num(d)} @${pt(T)}`);
      d = min;
    }
    const base = Math.atan2(dy, dx);
    const k = Math.acos(Math.max(-1, Math.min(1, (a * a + d * d - b * b) / (2 * a * d))));
    const e = base + bend * k;
    return { E: V(S.x + Math.cos(e) * a, S.y + Math.sin(e) * a), H };
  }

  /** 끝이 둥근 테이퍼 막대(캡슐) 경로 */
  function cap(A, B, ra, rb = ra) {
    const Ln = dist(A, B) || 0.01;
    const nx = -(B.y - A.y) / Ln;
    const ny = (B.x - A.x) / Ln;
    return `M${pt(add(A, nx * ra, ny * ra))}L${pt(add(B, nx * rb, ny * rb))}A${num(rb)} ${num(rb)} 0 0 0 ${pt(add(B, -nx * rb, -ny * rb))}`
      + `L${pt(add(A, -nx * ra, -ny * ra))}A${num(ra)} ${num(ra)} 0 0 0 ${pt(add(A, nx * ra, ny * ra))}Z`;
  }

  /**
   * 마디 여러 개를 한 덩어리로 (관절에 선이 끊기지 않게):
   * 외곽선을 모두 먼저 → 그늘색 면 → 왼쪽 위로 비킨 밝은 면(오른쪽 아래에 그늘이 남음)
   * segs: [{a, b, ra, rb, col}]
   */
  function limb(segs, owid = 2.5) {
    let o = '';
    let f = '';
    let l = '';
    for (const s of segs) {
      const d = cap(s.a, s.b, s.ra, s.rb);
      o += `<path d="${d}" fill="${OLC}" stroke-width="${owid * 2}"/>`;
      f += `<path d="${d}" fill="${s.dark || sh(s.col, -0.3)}"/>`;
      const k = Math.min(s.ra, s.rb);
      const ins = Math.min(1.2, k * 0.42);
      l += `<path d="${cap(add(s.a, -ins * 0.62, -ins * 0.72), add(s.b, -ins * 0.62, -ins * 0.72), s.ra - ins, s.rb - ins)}" fill="${s.col}"/>`;
      if (k > 2.4 && !s.flat) l += T(`M${pt(add(lerp(s.a, s.b, 0.12), -k * 0.45, -k * 0.55))}L${pt(add(lerp(s.a, s.b, 0.78), -k * 0.45, -k * 0.55))}`, sh(s.col, 0.35), 1.3, op(0.7));
    }
    return o + f + l;
  }
  /** 그늘용: 마디 모양을 오른쪽 아래로 비켜 반투명 검정 */
  const castSegs = (segs, dx = 1.8, dy = 2.2, a = 0.2) => `<g opacity="${a}">${segs.map((s) => `<path d="${cap(add(s.a, dx, dy), add(s.b, dx, dy), s.ra + 0.6, s.rb + 0.6)}" fill="${OLC}"/>`).join('')}</g>`;

  /** 호 모양 띠(휘두른 자국·빛 꼬리): 중심 (cx,cy), 바깥 r1, 안쪽 r2, a0→a1(도). 끝이 뾰족 */
  function arcBand(cx, cy, r1, r2, a0, a1) {
    const n = 10;
    const out = [];
    const inn = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const a = a0 + (a1 - a0) * t;
      const w = Math.sin(Math.PI * Math.min(1, t * 1.15)) ;
      out.push(pol(V(cx, cy), r1, a));
      inn.push(pol(V(cx, cy), r1 - (r1 - r2) * Math.max(0.05, w), a));
    }
    return `M${out.map(pt).join('L')}L${inn.reverse().map(pt).join('L')}Z`;
  }

  /* ---------- 손 ---------- */
  /**
   * 쥔 손: p = 손 중심, a = 자루 방향(도). 네 손가락이 자루를 감싸 마디 줄이 자루와 수직.
   * side: 손가락이 보이는 쪽(+1 아래, −1 위)
   */
  function fist(c, p, a, skin, side = 1) {
    const s = side;
    return G(P('M-3.6 -1.4Q-3.6 -3 -1.9 -3L1.9 -3Q3.6 -3 3.6 -1.3L3.6 1.3Q3.6 3 1.9 3L-1.9 3Q-3.6 3 -3.6 1.4Z', c.gl(skin, a, 0.22), 2)
      + T(`M-1.2 ${3 * s}V${0.9 * s}M1.2 ${3 * s}V${0.9 * s}`, sh(skin, -0.42), 1.2)
      + T(`M-2.6 ${-0.5 * s}Q-0.6 ${-1.9 * s} 1.8 ${-1.3 * s}`, sh(skin, -0.32), 1.2), at(p, a));
  }
  /** 편 손/느슨한 손: a = 손가락 방향 */
  function palm(c, p, a, skin, kind = 'relax', side = 1) {
    if (kind === 'open') {
      return G(P(`M-2.6 -2.6L2 -3Q5.4 -3 5.6 -1.2L5.6 1.2Q5.4 3 2 3L-2.6 2.6Z`, c.gl(skin, a, 0.2), 2.1)
        + P(`M0 ${-2.6 * side}Q1.4 ${-5.4 * side} 3.4 ${-5 * side}Q3.6 ${-3.6 * side} 2.6 ${-2.4 * side}`, skin, 1.8)
        + T('M2.2 -1H5.2M2.2 1H5.2', sh(skin, -0.35), 1.2), at(p, a));
    }
    return G(P('M-2.6 -2.5Q2.4 -3.4 3.8 -1Q4.6 1.4 2.4 2.8Q-0.6 3.6 -2.6 2.4Z', c.gl(skin, a, 0.2), 2.1)
      + T(`M0.6 ${-1.6 * side}Q2.2 ${-0.6 * side} 2.4 ${0.8 * side}`, sh(skin, -0.38), 1.2), at(p, a));
  }

  /* ---------- 장화 ---------- */
  /** A = 발목, a = 발 기울기(+는 발끝이 아래). 서 있으면 바닥 = 발목 y + 3.5 */
  function boot(c, A, a, col, o = {}) {
    const rim = o.rim || sh(col, 0.28);
    const sole = o.sole || sh(col, -0.5);
    const lace = o.lace;
    return G(P('M-3.6 -5.6L3.3 -5.6L3.7 -1.6C6.8 -1.4 9.3 -0.2 9.4 2.2L9.4 3.5L-3.9 3.5L-4.1 -0.6Z', c.gl(col, a, 0.28), 2.6)
      + P('M-3.9 2L9.4 2L9.4 3.5L-3.9 3.5Z', sole, 0)
      + T('M-3.6 1.9H9.1', OLC, 1.3)
      + T('M4.3 -0.5Q7.4 -0.2 8.2 1.4', sh(col, 0.35), 1.3, op(0.8))
      + P('M-4.3 -7.2H3.9L3.7 -4.4H-4.1Z', c.gl(rim, a, 0.2), 2.2)
      + (lace ? T('M2.4 -4L4 -3.2M2.6 -2.2L4.2 -1.4', lace, 1.2, op(0.8)) : '')
      + T('M-1.2 -1V1.4', sh(col, -0.35), 1.3, op(0.7)), at(A, a, o.bs || 0.9));
  }

  /* ---------- 몸 뼈대 ---------- */
  /** 사람 기본 뼈대 (서 있는 자세, 엉덩이 중심 (50,65)) */
  const HUMAN = {
    hip: V(50, 65),
    hn: V(48, 65.5), hf: V(52.5, 65),
    sn: V(47.6, 49.4), sf: V(55, 48.8),
    neck: V(51.5, 45),
    head: V(52.5, 32),
    thigh: 11.6, shin: 10.6, ua: 11, fa: 11,
  };

  /**
   * 자세 표 한 줄 → 세상 좌표 뼈대
   * P: { b:[dx,dy], lean(도, +앞), br(숨: 어깨가 올라감), hd(머리 기울기) }
   */
  function rig(B, Pz) {
    const dx = (Pz.b && Pz.b[0]) || 0;
    const dy = (Pz.b && Pz.b[1]) || 0;
    const lean = Pz.lean || 0;
    const br = Pz.br || 0;
    const O = B.hip;
    const W = (p, up = 0) => { const q = rot(V(p.x, p.y - up), lean, O); return V(q.x + dx, q.y + dy); };
    return {
      dx, dy, lean, br, W, O,
      tf: `translate(${num(dx)} ${num(dy)}) rotate(${num(lean)} ${O.x} ${O.y})`,
      inv: `rotate(${num(-lean)} ${O.x} ${O.y}) translate(${num(-dx)} ${num(-dy)})`,
      up: `translate(0 ${num(-br)})`,
      htf: `translate(0 ${num(-br)}) rotate(${num(Pz.hd || 0)} ${B.neck.x} ${B.neck.y})`,
      sn: add(W(B.sn, br), (Pz.sno && Pz.sno[0]) || 0, (Pz.sno && Pz.sno[1]) || 0), sf: W(B.sf, br), hn: W(B.hn), hf: W(B.hf), neck: W(B.neck, br), head: W(B.head, br),
    };
  }

  /** 다리 한 짝: 엉덩이 → 무릎 → 발목 + 장화. f = [x, y, 발 기울기] */
  function leg(c, hip, f, o) {
    const { E: K, H: A } = ik(hip, V(f[0], f[1]), o.thigh || 11.6, o.shin || 10.6, -1);
    const segs = [{ a: hip, b: K, ra: o.rh || 3.6, rb: o.rk || 3, col: o.pant }, { a: K, b: A, ra: o.rk || 3, rb: o.ra || 2.6, col: o.shinCol || o.pant }];
    const ka = angTo(K, A);
    return limb(segs)
      + (o.knee ? G(P('M-2 -2.2Q0 -3 2 -2.2V2.2Q0 3 -2 2.2Z', o.knee, 0) + T('M-2 -2.2Q0 -3 2 -2.2M-2 2.2Q0 3 2 2.2', sh(o.knee, -0.45), 1.2, ' stroke-dasharray="1 1"'), at(pol(K, 0.8, ka), ka - 90)) : '')
      + (o.fold ? T(`M${pt(add(lerp(hip, K, 0.55), 0.6, -0.5))}l2.2 1.2`, sh(o.pant, -0.4), 1.3) : '')
      + boot(c, A, f[2] || 0, o.boot, o);
  }

  /**
   * 팔 한 짝 (손은 따로 돌려줌 — 무기 위에 덮어 그리려고)
   * o: { ua, fa, bend, sleeve, fore, rs, re, rw, cuff(팔목 띠 색), roll(팔꿈치 접은 소매 색) }
   */
  function arm(S, T0, o) {
    let { E, H } = ik(S, vp(T0), o.ua || 11, o.fa || 11, o.bend == null ? 1 : o.bend);
    if (o.E) { E = vp(o.E); H = vp(T0); } // 팔꿈치를 직접 정함(앞뒤로 줄어 보이는 팔)
    const fa = angTo(E, H);
    const Wr = pol(H, -2.3, fa);
    const segs = [{ a: S, b: E, ra: o.rs || 3, rb: o.re || 2.6, col: o.sleeve }, { a: E, b: Wr, ra: o.re || 2.6, rb: o.rw || 2.2, col: o.fore || o.sleeve }];
    let s = limb(segs);
    if (o.roll) s += G(P('M-1.8 -3.6H1.8V3.6H-1.8Z', o.roll, 2) + T('M0 -2.6V2.6', sh(o.roll, -0.3), 1.2), at(pol(E, -1.2, angTo(S, E)), angTo(S, E)));
    if (o.cuff) s += G(P('M-1.5 -3.1H1.5V3.1H-1.5Z', o.cuff, 1.8), at(pol(Wr, -0.6, fa), fa));
    return { s, E, H, Wr, fa, segs };
  }

  /* ---------- 얼굴 (3/4, 오른쪽을 봄) ---------- */
  /** 머리 모양: 중심 (0,0), 반지름 약 12, 턱이 오른쪽 아래 */
  const HEAD = 'M-0.5 -12C7 -12 11.6 -6.6 11.6 0.4C11.6 6.4 8.6 10.9 3.6 12.1C-1.4 13.3 -7.4 11.4 -10.1 6.6C-12.4 2 -11.6 -6.2 -7 -9.8C-5.1 -11.3 -2.7 -12 -0.5 -12Z';

  /**
   * 눈 두 개(가까운 눈이 왼쪽·큼): o.kind open|focus|closed|happy|wide|wink
   * o.iris 눈동자 색, o.look 눈동자 이동(x), o.brow 눈썹 색, o.bk 눈썹 모양 calm|angry|sad|up
   */
  function eyes(c, o) {
    const x = o.x == null ? 1.6 : o.x;
    const y = o.y == null ? 1.6 : o.y;
    const iris = o.iris || '#4a3020';
    const lk = o.look || 0;
    const one = (ex, rx, ry, kind) => {
      if (kind === 'closed') return T(`M${ex - rx - 0.6} ${y - 0.2}Q${ex} ${y + 2.2} ${ex + rx + 0.6} ${y - 0.4}`, OLC, 1.6);
      if (kind === 'happy') return T(`M${ex - rx - 0.6} ${y + 0.8}Q${ex} ${y - 2.6} ${ex + rx + 0.6} ${y + 0.6}`, OLC, 1.7);
      const r2 = kind === 'focus' ? ry * 0.55 : kind === 'lidded' ? ry * 0.75 : kind === 'wide' ? ry * 1.08 : ry;
      const yy = kind === 'focus' ? y + 0.6 : kind === 'lidded' ? y + 0.4 : y;
      const ig = c.raw(`ey${iris}`, (id) => h().lg(id, [[0, sh(iris, -0.6)], [0.5, sh(iris, -0.15)], [1, sh(iris, 0.35)]]));
      return E(ex + lk, yy, rx, r2, ig, 0)
        + C(ex + lk - rx * 0.32, yy - r2 * 0.38, Math.max(0.6, rx * 0.36), '#fff', 0)
        + T(`M${ex - rx - 0.7} ${num(yy - r2 * 0.55)}Q${ex} ${num(yy - r2 - 1.2)} ${ex + rx + 0.7} ${num(yy - r2 * 0.65)}`, OLC, 1.5)
        + (kind === 'wide' ? C(ex + lk, yy, rx * 0.4, OLC, 0) : '');
    };
    const k = o.kind || 'open';
    const far = k === 'wink' ? 'closed' : k;
    const near = k === 'wink' ? 'open' : k;
    const bc = o.brow || OLC;
    const bk = o.bk || 'calm';
    const by = y - (k === 'focus' ? 3.4 : 4.4) - (o.browUp || 0);
    const brow = {
      calm: `M${x - 2.6} ${by + 0.3}Q${x} ${by - 1} ${x + 2.4} ${by}M${x + 5.2} ${by}Q${x + 7.3} ${by - 0.9} ${x + 9.1} ${by + 0.3}`,
      angry: `M${x - 2.6} ${by - 1}L${x + 2.4} ${by + 0.9}M${x + 5.4} ${by + 0.9}L${x + 9.1} ${by - 0.6}`,
      sad: `M${x - 2.6} ${by + 1}L${x + 2.4} ${by - 0.8}M${x + 5.4} ${by - 0.8}L${x + 9.1} ${by + 0.8}`,
      up: `M${x - 2.6} ${by - 0.6}Q${x} ${by - 2.2} ${x + 2.4} ${by - 0.9}M${x + 5.2} ${by - 0.9}Q${x + 7.3} ${by - 2} ${x + 9.1} ${by - 0.4}`,
    }[bk];
    return one(x, 2.1, 2.9, near) + one(x + 7.2, 1.75, 2.7, far) + (o.noBrow ? '' : T(brow, bc, 1.6));
  }
  /** 입: smile|open|shout|line|grin|grit|o|smirk. (x,y) = 가운데 */
  function mouth(kind, x = 6.4, y = 8.2) {
    switch (kind) {
      case 'open': return P(`M${x - 2.4} ${y - 0.8}H${x + 2.4}Q${x + 2} ${y + 2.8} ${x} ${y + 2.8}Q${x - 2} ${y + 2.8} ${x - 2.4} ${y - 0.8}Z`, '#6a1a2a', 1.3) + P(`M${x - 1.2} ${y + 1.9}Q${x} ${y + 1} ${x + 1.2} ${y + 1.9}Q${x} ${y + 2.6} ${x - 1.2} ${y + 1.9}Z`, '#ff8a8a', 0);
      case 'shout': return P(`M${x - 3} ${y - 1.2}H${x + 2.8}Q${x + 2.4} ${y + 3.8} ${x} ${y + 3.8}Q${x - 2.6} ${y + 3.8} ${x - 3} ${y - 1.2}Z`, '#6a1a2a', 1.4) + P(`M${x - 2.4} ${y - 0.7}H${x + 2.2}V${y + 0.4}H${x - 2.4}Z`, '#fff', 0) + P(`M${x - 1.4} ${y + 2.8}Q${x} ${y + 1.6} ${x + 1.4} ${y + 2.8}Z`, '#ff8a8a', 0);
      case 'grin': return P(`M${x - 2.8} ${y - 1}Q${x} ${y - 0.2} ${x + 2.8} ${y - 1.4}Q${x + 2} ${y + 2.6} ${x} ${y + 2.6}Q${x - 2} ${y + 2.6} ${x - 2.8} ${y - 1}Z`, '#6a1a2a', 1.3) + P(`M${x - 2.2} ${y - 0.6}Q${x} ${y} ${x + 2.2} ${y - 0.9}V${y + 0.3}H${x - 2.2}Z`, '#fff', 0);
      case 'grit': return P(`M${x - 2.8} ${y - 1}H${x + 2.6}V${y + 1.4}H${x - 2.8}Z`, '#fff', 1.3) + T(`M${x - 2.6} ${y + 0.2}H${x + 2.4}M${x} ${y - 0.9}V${y + 1.3}`, OLC, 1.1);
      case 'line': return T(`M${x - 1.8} ${y}H${x + 1.8}`, OLC, 1.4);
      case 'o': return E(x, y + 0.6, 1.3, 1.6, '#6a1a2a', 1.2);
      case 'smirk': return T(`M${x - 2.2} ${y + 0.4}Q${x + 0.6} ${y + 1.2} ${x + 2.4} ${y - 1.2}`, OLC, 1.5);
      case 'frown': return T(`M${x - 2} ${y + 0.8}Q${x} ${y - 0.8} ${x + 2} ${y + 0.8}`, OLC, 1.4);
      default: return T(`M${x - 2.3} ${y - 0.5}Q${x} ${y + 1.6} ${x + 2.3} ${y - 0.6}`, OLC, 1.5);
    }
  }
  /** 귀(머리카락 위에 다시 그릴 때) */
  const ear = (c, skin) => E(-6.6, 2.6, 2.5, 3.3, c.g(skin, 0.12), 1.5) + T('M-7.2 1.2Q-5.6 2.2 -6.8 4.2', sh(skin, -0.3), 1.2);
  /** 얼굴 바탕: 머리 모양 + 귀 + 볼 + 오른쪽 아래 그늘 */
  function faceBase(c, skin, o = {}) {
    const id = c.clip(HEAD);
    return P(HEAD, c.r(skin, 0.25), 2.8)
      + CL(id, SHD('M4 13C9 10 12.5 5 12 -2C14 4 14 12 4 13Z', 0.16) + SHD('M-12 3C-9 10 -2 13.5 4 13L-2 16L-13 9Z', 0.12))
      + (o.noEar ? '' : ear(c, skin))
      + E(1.2, 6.3, 2.3, 1.3, '#ff7a7a', 0, op(0.42)) + E(10, 5.8, 1.5, 1.1, '#ff7a7a', 0, op(0.35));
  }
  /** 목 */
  const neckS = (c, skin) => P('M-3.4 7L3.2 7L3.6 15.5L-3.4 15.5Z', sh(skin, -0.1), 1.8) + SHD('M-3.4 7L3.2 7L3.4 10.5Q0 12 -3.4 10Z', 0.22);

  /* =========================================================
   * 전투용 작은 그림 — 영웅
   * ========================================================= */
  /** 발이 땅에 닿게 발목 높이 계산 (발 기울기 a일 때 밑창 가장 낮은 점이 y=90) */
  function ground(x, a = 0, lift = 0) {
    const s = Math.sin(a * D2R);
    const k = Math.cos(a * D2R);
    const low = Math.max(-3.9 * s + 3.5 * k, 9.4 * s + 3.5 * k);
    return [x, 90 - low * 0.9 - lift, a];
  }
  /** 자세 표의 발: [x, null, a] = 땅을 딛음, [x, y, a] = 들림 */
  const foot = (f, b) => (f[1] == null ? ground(f[0], f[2] || 0) : [f[0], f[1], f[2] || 0]);

  /** 사람 몸통(셔츠) 기본 모양 — 몸통 좌표(엉덩이 중심 50,65) */
  const BODY = 'M44.4 45.6C40.8 47.8 40 55 41.2 62L41.4 67L59.2 67L59.4 62C60.2 56 60 50 57.2 46.4C53.6 44 48 43.8 44.4 45.6Z';
  /** 몸통 그늘(오른쪽·아래) */
  const BODY_SHD = SHD('M55.6 45.6C60.8 50 61.2 58 59.8 67L53.6 67C56.6 60 57.4 52 55.6 45.6Z', 0.2) + SHD('M40 60.5C47 62 54 62 61 60.5V68H40Z', 0.12);

  /* ---------- 카라: 대장장이 딸 · 큰 망치 · 붉은 높은 말총머리 ---------- */
  const KARA_C = {
    skin: '#efb98f', hair: '#e2452f', tie: '#ffb03a', shirt: '#ff8a3d', apron: '#a0643a', strap: '#7a4628',
    belt: '#4a2c1e', brass: '#e8c07a', pant: '#4e3a36', boot: '#3b2a24', wrap: '#eadcc0', iris: '#d9692a', brow: '#8a2a1e',
    steel: '#62667a', wood: '#a8703c', grip: '#5a3424',
  };
  const HAMMER_LEN = 40;
  /**
   * 망치: base = 자루 끝(쇠 꼭지), a = 머리 쪽 방향(도). hot: 0 보통 · 1 달아오름 · 2 불꽃
   * 머리는 자루와 수직으로 긴 쇳덩이(양쪽 때리는 면이 주황으로 달궈짐)
   */
  function hammer(c, base, a, hot = 0) {
    const K = KARA_C;
    const u = pol(V(0, 0), 1, a);
    const A = (s) => V(base.x + u.x * s, base.y + u.y * s);
    const head = A(HAMMER_LEN);
    const band = hot ? '#ffb43a' : '#ff8a3d';
    const hd = P('M-6 -9.8L-4.4 -11.4H4.4L6 -9.8V9.8L4.4 11.4H-4.4L-6 9.8Z', c.gl(K.steel, a + 90, 0.32), 2.8)
      + P('M-6 -9.8L-4.4 -11.4H4.4L6 -9.8V-7.4H-6Z', c.gl(band, a + 90, 0.3), 2.2)
      + P('M-6 9.8L-4.4 11.4H4.4L6 9.8V7.4H-6Z', c.gl(band, a + 90, 0.3), 2.2)
      + P('M-7.6 -3.8H-5.4V3.8H-7.6Z', '#43465a', 1.8)
      + P('M5.4 -2.4H7.2V2.4H5.4Z', K.wood, 1.6) + T('M6.3 -2V2', '#43465a', 1.3)
      + T('M-3.6 -6.4V6.4', sh(K.steel, 0.5), 1.4, op(0.8)) + T('M3.6 -6.4V6.4', sh(K.steel, -0.45), 1.4, op(0.7))
      + P('M0 -2.6L2 0L0 2.6L-2 0Z', hot ? '#ffe27a' : '#ff9a4a', 1.4)
      + (hot ? C(0, 9.5, hot > 1 ? 9 : 6, c.halo('#ffd23a', 0.9), 0) + C(0, -9.5, hot > 1 ? 9 : 5, c.halo('#ffb03a', 0.7), 0) : '');
    return limb([{ a: A(-1), b: A(HAMMER_LEN - 6), ra: 1.8, rb: 2.1, col: K.wood }], 2.3)
      + G(P('M0 -2.7H12V2.7H0Z', c.gl(K.grip, a, 0.25), 2) + T('M2 -2.7L3.6 2.7M5 -2.7L6.6 2.7M8 -2.7L9.6 2.7', sh(K.grip, -0.45), 1.2), at(A(1), a))
      + C(A(-1.6).x, A(-1.6).y, 2.5, c.r(K.steel, 0.4), 2.2)
      + G(hd, at(head, a));
  }

  const KARA = {
    // carry: [자루 각도, 어깨에 걸친 자리] — 망치를 가까운 어깨에 메고 가까운 손이 자루 아래를 쥠
    //        몸 [dx,dy]  기울기  숨    머리   가까운 발            먼 발               망치            쥔 자리   먼 손(빈손)   꼬리   표정
    idle0: { b: [0, 0], lean: 2, br: 0, hd: 0, fn: [45, null, 0], ff: [56, null, 0], carry: [-140, 14], gn: 4, hf: [61.6, 69.4], tail: 0, eye: 'open', mo: 'grin', bk: 'up' },
    idle1: { b: [0, 0], lean: 2, br: 1.4, hd: -2, fn: [45, null, 0], ff: [56, null, 0], carry: [-136, 14.5], gn: 4.5, hf: [61.8, 68.4], tail: 8, eye: 'open', mo: 'smile', bk: 'up' },
    walk0: { b: [0, 0.8], lean: 5, hd: 2, fn: [57.5, null, -14], ff: [41.5, null, 24], carry: [-138, 14], gn: 4, hf: [64.5, 65.5], tail: -6, eye: 'open', mo: 'grin', ap: 2 },
    walk1: { b: [0, -0.9], lean: 4, fn: [51, null, 0], ff: [45.5, 80.5, 18], carry: [-141, 14], gn: 4, hf: [57.5, 69.5], tail: 5, eye: 'open', mo: 'grin', ap: 0 },
    walk2: { b: [0, 0.8], lean: 5, hd: 2, fn: [41.5, null, 24], ff: [57.5, null, -14], carry: [-142, 14], gn: 4, hf: [44, 67], tail: -6, eye: 'open', mo: 'grin', ap: -2 },
    walk3: { b: [0, -0.9], lean: 4, fn: [45.5, 80.5, 18], ff: [51, null, 0], carry: [-139, 14], gn: 4, hf: [55, 69.5], tail: 5, eye: 'open', mo: 'grin', ap: 0 },
    // 조준: 몸을 뒤로 젖히고 두 손으로 망치를 머리 위로 곧추 들어 올림 (먼 손이 자루 끝, 가까운 손이 그 위)
    aim: { b: [-1.5, 1.4], lean: -7, hd: -4, fn: [40.4, null, 6], ff: [59, null, -4], hm: [62, 47.5, -100], gn: 9, gf: 2.5, tail: 12, eye: 'focus', mo: 'grit', bk: 'angry', hot: 1, ap: -1 },
    // 공격: 앞으로 내디디며 망치를 땅에 내려찍음 → 불꽃
    attack: { b: [3, 2.2], lean: 13, hd: 8, fn: [39, null, 30], ff: [64, null, 0], hm: [45, 61.4, 29], gn: 13.5, gf: 7, tail: -18, eye: 'focus', mo: 'shout', bk: 'angry', hot: 2, ap: 4 },
    // 기술 불꽃 내려찍기: 뛰어올라 공중에서 불붙은 망치를 앞으로 내리꽂는 순간 (아직 땅에 닿기 전)
    cast: { b: [2, -10], lean: 18, hd: 10, fn: [35, 71, 40], ff: [51, 73, 34], hm: [57, 48, 38], gn: 9.5, gf: 3, tail: -24, eye: 'focus', mo: 'shout', bk: 'angry', hot: 2, ap: -4 },
  };

  function kara(c, pose) {
    const K = KARA_C;
    const Pz = KARA[pose] || KARA.idle0;
    const R = rig(HUMAN, Pz);
    let hm = Pz.hm;
    if (Pz.carry) {
      // 어깨 위(가까운 어깨 꼭대기)에 자루가 걸치도록 끝점 계산
      const rest = R.W(V(46.6, 46.4), R.br);
      const uu = pol(V(0, 0), 1, Pz.carry[0]);
      hm = [rest.x - uu.x * Pz.carry[1], rest.y - uu.y * Pz.carry[1], Pz.carry[0]];
    }
    const hb = V(hm[0], hm[1]);
    const u = pol(V(0, 0), 1, hm[2]);
    const onHaft = (s) => add(hb, u.x * s, u.y * s);
    const near = arm(R.sn, onHaft(Pz.gn), { sleeve: K.shirt, fore: K.skin, roll: sh(K.shirt, 0.15), cuff: K.wrap, rs: 3.2 });
    const farT = Pz.gf != null ? onHaft(Pz.gf) : V(Pz.hf[0], Pz.hf[1]);
    const far = arm(R.sf, farT, { sleeve: sh(K.shirt, -0.18), fore: sh(K.skin, -0.12), roll: sh(K.shirt, -0.05), cuff: sh(K.wrap, -0.15), bend: Pz.fb || 1, rs: 3.2 });
    const legO = { pant: K.pant, boot: K.boot, lace: '#b88a5a', knee: sh(K.pant, 0.18) };
    const legN = leg(c, R.hn, foot(Pz.fn), legO);
    const legF = leg(c, R.hf, foot(Pz.ff), Object.assign({}, legO, { pant: sh(K.pant, -0.18), boot: sh(K.boot, -0.15), knee: K.pant }));
    const hot = Pz.hot || 0;
    const ham = hammer(c, hb, hm[2], hot);
    const hamBack = false;

    // 머리 (머리 좌표: 중심 0,0) — 뒤로 바짝 묶은 머리 + 이마의 뾰족한 앞머리 + 정수리 뒤 높은 말총
    const tail = G(P('M-3 -10.6C-9 -21.5 -21 -22.4 -28.6 -15.6C-23.6 -15.4 -21.2 -12.6 -21 -9.6C-27.4 -8.6 -31.6 -2.4 -32.4 4.6C-27.4 0.6 -22.6 -0.4 -18.6 1.4C-20.6 5.6 -20.4 10.6 -18.2 14.6C-14.6 7.6 -10.2 2.6 -5.4 -1.6Z', c.g(K.hair, 0.28), 2.6)
      + T('M-6.4 -11C-12 -17 -19 -18 -24.6 -15.6M-8 -5C-14 -6.6 -21 -4.4 -27 0.4M-8.6 0C-12.6 3 -15.4 7 -17.2 11', sh(K.hair, -0.32), 1.4)
      + T('M-8 -14.4C-12.6 -18 -17.6 -18.6 -22 -17.4M-10 -8.4C-15 -9 -19.6 -7.6 -23 -5.4', sh(K.hair, 0.4), 1.4, op(0.85)), `rotate(${Pz.tail || 0} -3 -10)`);
    const tie = E(-3.4, -10.6, 2.4, 3.4, c.g(K.tie, 0.3), 1.8, ' transform="rotate(-35 -3.4 -10.6)"') + T('M-4.6 -12.4L-2.4 -9', sh(K.tie, -0.35), 1.2);
    const lock = (d) => P(d, c.g(K.hair, 0.24), 1.8);
    const hairCap = P('M-9 7.5C-12.4 3.6 -13.2 -3 -11 -7L-12.8 -8.8L-9.6 -9.4C-7 -12.6 -2 -14.6 3 -14L4.8 -15.8L5.9 -13.4C9.6 -12.2 12.6 -8.6 13 -3.4C10 -5.6 4 -6 -0.6 -4.2C-3 -3.2 -4.8 -1.6 -6 0L-8.6 0.8C-9.2 3.6 -8.8 5.6 -9 7.5Z', c.g(K.hair, 0.24), 2.6)
      + T('M-7.4 -9.6Q-1 -12.8 5.4 -11.4', sh(K.hair, 0.42), 1.4, op(0.8))
      + T('M10.6 -7.6Q4 -10.4 -3.4 -9.8M-10.4 2C-11.2 -2.4 -10 -6 -6.4 -8.6M4 -12.6Q0 -11.6 -3.6 -10.8', sh(K.hair, -0.35), 1.3)
      + lock('M1.2 -6.4C3.4 -5 4.4 -2.6 3.8 0.2C2.6 -1.8 0.8 -3 -1.2 -3.6Z')
      + lock('M4.8 -7.2C7.4 -5.6 8.6 -2.8 8 0C6.8 -2 5 -3.4 3 -4.2Z')
      + lock('M8.4 -7.6C11 -6.2 12.6 -3.4 12.2 -0.6C10.8 -2.6 9.2 -3.8 7.4 -4.6Z')
      + T('M2 -4.8Q3.2 -3.4 3.2 -1.6M5.6 -5.4Q7 -4 7.2 -2', sh(K.hair, 0.4), 1.2, op(0.75))
      + P('M-3.4 -3.6C-2.4 -0.4 -2.6 3.4 -3.8 6.6C-4.8 4 -5.2 0.4 -4.8 -2.6Z', c.g(K.hair, 0.2), 1.6);
    const headG = tail;
    const face = faceBase(c, K.skin, { noEar: true }) + hairCap + tie + ear(c, K.skin)
      + eyes(c, { kind: Pz.eye, iris: K.iris, brow: K.brow, bk: Pz.bk }) + mouth(Pz.mo);

    // 몸통 (몸통 좌표)
    const tid = c.clip(BODY);
    const torso = G(neckS(c, K.skin), at(HUMAN.head))
      + P(BODY, c.g(K.shirt, 0.22), 2.8)
      + CL(tid, BODY_SHD
        + P('M46.4 52.6L58.8 51.4C59.8 56 60 61 59.6 67H46Z', c.g(K.apron, 0.25), 2.4)
        + SHD('M55.4 51.8L58.8 51.4C59.8 56 60 61 59.6 67H55.6C56.6 61 56.6 56 55.4 51.8Z', 0.22)
        + T('M50.6 55V66', sh(K.apron, -0.35), 1.3)
        + G(castSegs(near.segs), R.inv))
      + L('M47.8 53.2L45.4 45.8', K.strap, 2.2, 2.2) + L('M58 52.2L56.6 46.2', sh(K.strap, -0.15), 2, 2.2)
      + C(47.8, 53.4, 1.4, K.brass, 1.4) + C(58, 52.4, 1.3, K.brass, 1.4)
      + T('M44.8 46.6Q47 50 46.4 54', sh(K.shirt, -0.3), 1.3, op(0.8));
    const pelvis = P('M41.2 63.4L59.6 63.2L60.2 69.4Q53 72 50 71.6Q45 71.2 40.6 69.6Z', c.g(K.pant, 0.2), 2.6)
      + P('M41 60.8L59.8 60.4L60 64.2L41.2 64.6Z', c.g(K.belt, 0.25), 2.2)
      + P('M54.8 60.6H58.4V64.2H54.8Z', c.g(K.brass, 0.35), 1.6) + P('M56 61.8H57.2V63H56Z', K.belt, 0)
      + P('M41.4 63.6H46.6L46.4 69.2Q44 70 41.6 69.2Z', c.g(sh(K.apron, -0.1), 0.25), 2) + T('M41.6 65.4H46.4', sh(K.apron, -0.4), 1.3);
    const up = G(torso, R.up);
    // 앞치마 아랫단: 허리에 붙어 다리 앞에 늘어짐 (걸음에 따라 흔들림)
    const ap = Pz.ap || 0;
    const a1 = R.W(V(46.2, 64.4));
    const a2 = R.W(V(60, 64));
    const X = (x) => num(x + R.dx);
    const Y = (y) => num(y + R.dy);
    const skirt = P(`M${pt(a1)}L${pt(a2)}L${X(62.6 + ap)} ${Y(74.4)}Q${X(54.6 + ap)} ${Y(75.8)} ${X(46.4 + ap * 0.6)} ${Y(74.8)}Z`, c.g(K.apron, 0.25), 2.4)
      + SHD(`M${X(57.6 + ap * 0.2)} ${Y(64.2)}L${pt(a2)}L${X(62.6 + ap)} ${Y(74.4)}Q${X(60 + ap)} ${Y(75)} ${X(58.2 + ap * 0.8)} ${Y(75.2)}Z`, 0.2)
      + T(`M${X(52.6 + ap * 0.3)} ${Y(66)}L${X(53.4 + ap * 0.8)} ${Y(74.6)}`, sh(K.apron, -0.35), 1.3)
      + T(`M${X(47.2 + ap * 0.6)} ${Y(73.2)}Q${X(54.6 + ap)} ${Y(74.4)} ${X(61.8 + ap)} ${Y(73)}`, sh(K.apron, 0.32), 1.2, ' stroke-dasharray="1.6 1.4"')
      + P(`M${X(55.4 + ap * 0.5)} ${Y(66.6)}h4.6l.2 4h-4.6z`, sh(K.apron, -0.12), 1.5) + T(`M${X(56.6 + ap * 0.5)} ${Y(66.4)}v-2.6`, '#8a8f9e', 1.5);

    // 효과
    let back = '';
    let mid = '';
    let front = '';
    if (pose === 'attack') {
      // 망치 머리 아래 땅에서 불꽃이 튐 (망치 위치를 따라감)
      const hh = add(hb, u.x * HAMMER_LEN, u.y * HAMMER_LEN);
      const gx = hh.x - 4;
      back += P(arcBand(55, 54, 44, 30, -112, 22), '#ffd8a0', 0, op(0.16)) + P(arcBand(55, 54, 43, 37, -100, 18), '#fff4dc', 0, op(0.32));
      mid += P(`M${gx - 14} 90C${gx - 16} 84 ${gx - 12} 81 ${gx - 9} 84C${gx - 9} 78 ${gx - 4} 76 ${gx - 2} 81L${gx + 6} 81C${gx + 8} 76 ${gx + 13} 78 ${gx + 12} 84C${gx + 14} 84 ${gx + 14} 88 ${gx + 13} 90Z`, c.g('#ff8a3d', 0.4), 2.4)
        + P(`M${gx - 10} 90C${gx - 10} 87 ${gx - 7} 86 ${gx - 6} 88C${gx - 5} 84 ${gx - 1} 84 ${gx} 87L${gx + 5} 87C${gx + 7} 84 ${gx + 10} 85 ${gx + 10} 88V90Z`, '#ffd23a', 0);
      front += C(gx - 12, 76, 1.8, '#ffd23a', 0) + C(gx + 13, 72, 1.6, '#ffb03a', 0) + C(gx + 9, 64, 1.3, '#fff2a8', 0) + C(gx - 6, 70, 1.2, '#fff2a8', 0)
        + T(`M${gx - 16} 88l-6 -3M${gx + 14} 86l2 -4`, '#ffe6a0', 1.6);
    }
    if (pose === 'aim') {
      back += C(hb.x + u.x * HAMMER_LEN, hb.y + u.y * HAMMER_LEN, 14, c.halo('#ffb03a', 0.45), 0);
      front += T('M20 20l-4-2M24 6l-3-3M38 4l1-4', '#ffd890', 1.5, op(0.9));
    }
    if (pose === 'cast') {
      const hh = add(hb, u.x * HAMMER_LEN, u.y * HAMMER_LEN);
      // 하늘에서 망치 머리까지 이어지는 큰 불꽃 꼬리
      back += C(hh.x, hh.y, 20, c.halo('#ff8a3d', 0.8), 0)
        + P(arcBand(57, 46, 42, 26, -150, 34), c.g('#ff8a3d', 0.4), 0, op(0.75))
        + P(arcBand(57, 46, 40, 31, -128, 30), '#ffd23a', 0, op(0.85))
        + P(arcBand(57, 46, 38, 35, -110, 26), '#fff4c0', 0, op(0.9));
      front += C(24, 30, 1.6, '#ffd23a', 0) + C(84, 30, 1.4, '#ffd23a', 0) + C(92, 48, 1.3, '#fff2a8', 0) + C(30, 60, 1.3, '#ffb03a', 0) + C(70, 88, 1.4, '#ffb03a', 0)
        + T('M14 44l-5 2M18 58l-5 3M26 72l-4 4', '#ffd890', 1.6, op(0.85));
    }

    const headAll = G(G(face, at(HUMAN.head)), R.htf);
    const tailAll = G(G(headG, at(HUMAN.head)), R.htf);
    return back
      + G(tailAll, R.tf)
      + (hamBack ? ham : '')
      + far.s + (Pz.gf == null ? fist(c, far.H, far.fa + 90, sh(K.skin, -0.12), 1) : '')
      + legF + legN
      + G(up + pelvis, R.tf)
      + skirt
      + mid + (hamBack ? '' : ham)
      + (Pz.gf != null ? fist(c, far.H, hm[2], sh(K.skin, -0.12), 1) : '')
      + G(headAll, R.tf)
      + near.s + fist(c, near.H, hm[2], K.skin, 1)
      + front;
  }

  /* ---------- 세라: 견습 등불지기 · 긴 은발 · 흰 겉옷과 금빛 테 · 등불 지팡이 ---------- */
  const SERA_C = {
    skin: '#fbdcc4', hair: '#e6e8f3', hairD: '#b9bdd8', robe: '#fbf8f0', gold: '#e8b84a', panel: '#ffe08a',
    boot: '#c99a4a', iris: '#c08a2e', brow: '#8f8fae', wood: '#b98a3c', glass: '#fff3b0', light: '#fff3a0',
  };
  const STAFF_LEN = 68;
  /** 등불: 고리 (0,0)에 매달림. glow 0 은은 · 1 모음 · 2 섬광 */
  function lantern(c, glow) {
    const S = SERA_C;
    return C(0, 8.5, glow === 2 ? 17 : glow === 1 ? 14 : 10, c.halo(S.light, glow ? 0.95 : 0.7), 0)
      + T('M0 0V2.4', OLC, 1.6)
      + P('M-3.4 2.2H3.4L4.8 4.8H-4.8Z', c.g(S.gold, 0.35), 1.8)
      + P('M-4.4 4.8H4.4Q5.6 8.6 4.2 12.2H-4.2Q-5.6 8.6 -4.4 4.8Z', c.r(glow ? '#fffbe6' : S.glass, 0.45), 2)
      + P('M0 6.6C1.8 8.6 1.6 10.6 0 11.2C-1.6 10.6 -1.8 8.6 0 6.6Z', glow ? '#fff' : '#ffc84a', 0)
      + T('M-1.7 5V12M1.7 5V12', sh(S.gold, -0.15), 1.3)
      + P('M-3.4 12.2H3.4L2.2 14.6H-2.2Z', c.g(S.gold, 0.35), 1.8)
      + C(0, 15.6, 1.2, S.gold, 1.2);
  }
  /** 지팡이: base = 아래 끝, a = 위쪽 방향(도). 꼭대기에서 앞으로 굽은 고리에 등불이 매달림(늘 아래로) */
  function lampStaff(c, base, a, glow = 0, swing = 0) {
    const S = SERA_C;
    const top = pol(base, STAFF_LEN, a);
    const hook = pol(pol(top, 3.5, a), 6.4, a + 90);
    const bend = pol(pol(top, 5.4, a), 2.2, a + 90);
    return limb([{ a: base, b: top, ra: 1.7, rb: 2, col: S.wood }], 2.3)
      + L(`M${pt(top)}Q${pt(bend)} ${pt(hook)}`, S.gold, 2.2, 2.4)
      + G(P('M-1 -2.8H3V2.8H-1Z', c.gl(S.gold, a, 0.3), 1.6), at(pol(top, -1, a), a))
      + G(P('M-0.6 -2.6H5.4V2.6H-0.6Z', c.gl(S.gold, a, 0.3), 1.6) + T('M1.4 -2.6V2.6M3.4 -2.6V2.6', sh(S.gold, -0.4), 1.2), at(pol(base, STAFF_LEN * 0.5 - 3, a), a))
      + C(base.x, base.y, 2, c.r(S.gold, 0.3), 1.6)
      + G(lantern(c, glow), `${at(hook)} rotate(${swing})`);
  }

  const SERA = {
    //        몸 [dx,dy]  기울기 숨   머리  가까운 발          먼 발              지팡이 [끝x,끝y,각도] 쥔 자리  먼 손      머리칼 흔들림
    idle0: { b: [0, 0], lean: 0, br: 0, fn: [45.5, null, 0], ff: [55.5, null, 0], st: [66.5, 89.5, -92], gn: 33, hf: [58, 69.5], sw: 0, lsw: 0, eye: 'open', mo: 'smile' },
    idle1: { b: [0, 0], lean: 0, br: 1.3, hd: -2, fn: [45.5, null, 0], ff: [55.5, null, 0], st: [66.5, 89.5, -92], gn: 34, hf: [58, 68.6], sw: 4, lsw: 6, eye: 'open', mo: 'smile' },
    walk0: { b: [0, 0.8], lean: 4, fn: [57, null, -12], ff: [42, null, 22], st: [71, 89.5, -100], gn: 32, hf: [62, 68], sw: -4, lsw: -8, eye: 'open', mo: 'smile', hem: 2 },
    walk1: { b: [0, -0.8], lean: 3, fn: [51, null, 0], ff: [46, 81.5, 16], st: [67, 86.5, -93], gn: 32, hf: [57, 70], sw: 2, lsw: -2, eye: 'open', mo: 'smile', hem: 0 },
    walk2: { b: [0, 0.8], lean: 4, fn: [42, null, 22], ff: [57, null, -12], st: [63, 89.5, -85], gn: 32, hf: [47, 69], sw: -4, lsw: 7, eye: 'open', mo: 'smile', hem: -2 },
    walk3: { b: [0, -0.8], lean: 3, fn: [46, 81.5, 16], ff: [51, null, 0], st: [67, 86.5, -93], gn: 32, hf: [55, 70], sw: 2, lsw: 2, eye: 'open', mo: 'smile', hem: 0 },
    // 조준: 두 손으로 지팡이를 높이 들어 등불에 빛을 모음
    aim: { b: [-1, 0.6], lean: -5, hd: -8, fn: [43, null, 0], ff: [58, null, -4], st: [54, 68, -68], gn: 23, gf: 33, sw: 6, lsw: -10, eye: 'focus', mo: 'line', bk: 'angry', glow: 1 },
    // 공격: 지팡이를 앞으로 내질러 등불에서 빛 구슬이 날아감
    attack: { b: [3, 1], lean: 9, hd: 4, fn: [41, null, 18], ff: [62, null, 0], st: [19.6, 74.6, -22], gn: 42, gf: 52, sw: -8, lsw: 24, eye: 'open', mo: 'open', bk: 'angry', glow: 2, hem: 3 },
    // 기술 새벽의 기도: 한쪽 무릎을 꿇고 두 손으로 지팡이를 세워 눈을 감고 기도 → 등불에서 새벽빛
    cast: { b: [0, 11], lean: 5, hd: 14, fn: [44, 86.6, 30], ff: [62, null, 0], st: [64.5, 89.5, -90], gn: 25, gf: 20, sw: 0, lsw: 0, eye: 'closed', mo: 'smile', bk: 'sad', glow: 2, kneel: true },
  };

  function sera(c, pose) {
    const S = SERA_C;
    const Pz = SERA[pose] || SERA.idle0;
    const R = rig(HUMAN, Pz);
    const sb = V(Pz.st[0], Pz.st[1]);
    const sa = Pz.st[2];
    const onStaff = (g) => pol(sb, g, sa);
    const sleeve = { sleeve: S.robe, fore: S.robe, cuff: S.gold, rs: 3.2, re: 2.8, rw: 2.6 };
    const near = arm(R.sn, onStaff(Pz.gn), sleeve);
    const far = arm(R.sf, Pz.gf != null ? onStaff(Pz.gf) : V(Pz.hf[0], Pz.hf[1]), Object.assign({}, sleeve, { sleeve: sh(S.robe, -0.12), fore: sh(S.robe, -0.12), cuff: sh(S.gold, -0.15) }));
    const fN = foot(Pz.fn);
    const fF = foot(Pz.ff);
    const legO = { pant: sh(S.robe, -0.18), boot: S.boot, rim: S.gold, rh: 3.2, rk: 2.8, ra: 2.5 };
    const legN = leg(c, R.hn, fN, legO);
    const legF = leg(c, R.hf, fF, Object.assign({}, legO, { pant: sh(S.robe, -0.3), boot: sh(S.boot, -0.15) }));
    const glow = Pz.glow || 0;
    const staff = lampStaff(c, sb, sa, glow, Pz.lsw || 0);

    // 등 뒤 망토 (어깨에서 늘어져 뒤로 흩날림)
    const sw = Pz.sw || 0;
    const m1 = R.W(V(44, 46.6), R.br);
    const m2 = R.W(V(49, 46), R.br);
    const kneel = Pz.kneel;
    const hemY = kneel ? 89.6 : 82.6;
    const cape = P(`M${pt(m2)}C${num(m2.x - 6)} ${num(m2.y + 12)} ${num(40 - sw * 0.5 + R.dx)} ${num(70 + R.dy * 0.5)} ${num(37 - sw + R.dx * 0.6)} ${num(hemY - 0.6)}`
      + `Q${num(33 - sw * 1.4 + R.dx * 0.6)} ${num(hemY - 4)} ${num(29.5 - sw * 1.8 + R.dx * 0.5)} ${num(hemY - 2.6)}C${num(31 - sw + R.dx * 0.5)} ${num(68 + R.dy * 0.5)} ${num(m1.x - 6)} ${num(m1.y + 8)} ${pt(m1)}Z`, c.g(sh(S.robe, -0.06), 0.18), 2.6)
      + T(`M${num(37 - sw + R.dx * 0.6)} ${num(hemY - 0.6)}Q${num(33 - sw * 1.4 + R.dx * 0.6)} ${num(hemY - 4)} ${num(29.5 - sw * 1.8 + R.dx * 0.5)} ${num(hemY - 2.6)}`, S.gold, 2)
      + T(`M${num(m1.x - 2)} ${num(m1.y + 10)}Q${num(36 - sw + R.dx * 0.6)} ${num(70 + R.dy * 0.5)} ${num(33 - sw * 1.4 + R.dx * 0.6)} ${num(hemY - 5)}`, sh(S.robe, -0.3), 1.3);

    // 머리 (머리 좌표)
    const hs = Pz.sw || 0;
    const backHair = P(`M-10.6 -4C-14.6 4 -13.6 16 -15.6 ${num(29 + hs * 0.2)}C${num(-12 - hs * 0.4)} ${num(31 + hs * 0.1)} -6 30 -2.6 26C-2.4 18 -1 10 0 4Z`, c.g(S.hair, 0.16), 2.6)
      + T(`M-11.4 4C-12.4 12 -12.4 20 ${num(-13.6 - hs * 0.2)} 27M-7 8C-7.6 15 -7 21 -5.4 26`, S.hairD, 1.4);
    const cap = P('M-9.4 7C-13 1 -12.6 -7.4 -7.6 -11.2C-3.4 -14.4 3.4 -14.6 7.6 -12C11.4 -9.6 13.2 -5.6 12.8 -1.2C11 -4.4 8.8 -5.8 6.6 -6.4C5.4 -3.8 2.4 -2.4 -0.4 -2.8C-1.6 -1.8 -3.2 -1.2 -4.4 -1.4C-5.8 0.6 -7.6 3 -9.4 7Z', c.g(S.hair, 0.16), 2.6)
      + T('M-6 -10.6Q1 -13.6 7.6 -10.4', '#fff', 1.5, op(0.9))
      + T('M9.6 -6.8Q4 -10 -2 -9M-10 1.4C-10.8 -3 -9.2 -7.4 -5.2 -10', S.hairD, 1.3)
      // 얼굴 옆으로 길게 내려온 앞머리 (가슴까지)
      + P(`M-3.6 -2.6C-1.8 4 -2.2 12 -4 ${num(20 + hs * 0.2)}C-5.6 14 -6.6 6 -6 -1Z`, c.g(S.hair, 0.16), 1.8)
      + P('M-8.6 -10.4l1.5 2.2 2.6.3-1.9 1.8.5 2.6-2.4-1.2-2.3 1.3.4-2.6-1.9-1.8 2.6-.4z', c.g('#ffd84a', 0.3), 1.2);
    const face = faceBase(c, S.skin, { noEar: true }) + cap
      + eyes(c, { kind: Pz.eye, iris: S.iris, brow: S.brow, bk: Pz.bk || 'calm', y: 1.8 }) + mouth(Pz.mo);

    // 몸통 (몸통 좌표): 흰 겉옷 + 금빛 앞판 + 어깨 덮개 + 둥근 금 브로치
    const tid = c.clip(BODY);
    const torso = G(neckS(c, S.skin), at(HUMAN.head))
      + P(BODY, c.g(S.robe, 0.12), 2.8)
      + CL(tid, BODY_SHD.replace(/opacity="0.2"/, 'opacity="0.14"')
        + P('M53.6 47.6L58 47.4C59.8 53 60.2 60 59.6 67H54.4C55.2 60 55 53 53.6 47.6Z', c.g(S.panel, 0.25), 2)
        + G(castSegs(near.segs, 1.8, 2.2, 0.16), R.inv))
      + P('M43.4 46.8C46.6 44.4 54 44.2 57.6 46.4C59.6 49 59.8 52 59 54.4C55 55.6 47 55.4 42.2 53.4C41.6 50.6 42 48.4 43.4 46.8Z', c.g(sh(S.robe, -0.02), 0.14), 2.4)
      + T('M42.4 53.4C47 55.4 55 55.6 59 54.4', S.gold, 1.8)
      + C(56, 47.8, 2.4, c.r(S.gold, 0.4), 1.6) + C(56, 47.8, 1, '#fff3b0', 0)
      + T('M45 49.6Q50 51.6 55.4 50.6', sh(S.robe, -0.25), 1.2);
    const belt = P('M41.6 60.6L59.6 60.2L59.8 63.4L41.8 63.8Z', c.g(S.gold, 0.3), 1.8) + C(56.6, 61.8, 1.5, '#fff3b0', 1.2);
    // 치마: 허리에서 종아리까지. 앞자락은 앞발, 뒷자락은 뒷발을 따라감
    const hem = Pz.hem || 0;
    const fx = Math.max(fN[0], fF[0]);
    const bx = Math.min(fN[0], fF[0]);
    const w1 = R.W(V(41.4, 62));
    const w2 = R.W(V(59.8, 61.6));
    const fy = kneel ? 89.4 : 81.4;
    const by = kneel ? 89.6 : 82;
    const skirt = P(`M${pt(w1)}L${pt(w2)}C${num(w2.x + 2)} ${num(w2.y + 8)} ${num(fx + 6 + hem)} ${num(fy - 8)} ${num(fx + 6.4 + hem)} ${num(fy)}`
      + `Q${num((fx + bx) / 2 + hem)} ${num(fy + 2.4)} ${num(bx - 5.2)} ${num(by)}C${num(bx - 4)} ${num(by - 8)} ${num(w1.x - 1.4)} ${num(w1.y + 9)} ${pt(w1)}Z`, c.g(S.robe, 0.14), 2.6)
      + SHD(`M${num(w2.x - 4)} ${num(w2.y)}L${pt(w2)}C${num(w2.x + 2)} ${num(w2.y + 8)} ${num(fx + 6 + hem)} ${num(fy - 8)} ${num(fx + 6.4 + hem)} ${num(fy)}L${num(fx + 1 + hem)} ${num(fy + 0.6)}C${num(fx)} ${num(fy - 8)} ${num(w2.x - 3)} ${num(w2.y + 8)} ${num(w2.x - 4)} ${num(w2.y)}Z`, 0.12)
      + P(`M${num(w2.x - 4.6)} ${num(w2.y + 0.4)}L${num(w2.x - 1.4)} ${num(w2.y + 0.2)}C${num(w2.x + 0.6)} ${num(w2.y + 8)} ${num(fx + 2.6 + hem)} ${num(fy - 8)} ${num(fx + 2.8 + hem)} ${num(fy + 0.7)}L${num(fx - 0.4 + hem)} ${num(fy + 1.1)}C${num(fx - 1.2 + hem * 0.5)} ${num(fy - 8)} ${num(w2.x - 4.2)} ${num(w2.y + 8)} ${num(w2.x - 4.6)} ${num(w2.y + 0.4)}Z`, c.g(S.panel, 0.22), 1.6)
      + T(`M${num(fx + 6.4 + hem)} ${num(fy)}Q${num((fx + bx) / 2 + hem)} ${num(fy + 2.4)} ${num(bx - 5.2)} ${num(by)}`, S.gold, 2.2)
      + T(`M${num((w1.x + w2.x) / 2 - 3)} ${num(w1.y + 3)}Q${num((fx + bx) / 2 - 3 + hem * 0.5)} ${num(fy - 8)} ${num((fx + bx) / 2 - 4 + hem)} ${num(fy + 0.6)}`, sh(S.robe, -0.28), 1.3);

    // 효과
    let back = '';
    let front = '';
    const lamp = pol(pol(pol(sb, STAFF_LEN, sa), 3.5, sa), 6.4, sa + 90);
    const lc = add(lamp, 0, 8.5);
    if (pose === 'aim') {
      back += C(lc.x, lc.y, 20, c.halo('#fff8c0', 0.55), 0);
      for (let i = 0; i < 6; i++) {
        const a = i * 60 + 15;
        const p1 = pol(lc, 15, a);
        const p2 = pol(lc, 9.5, a);
        front += T(`M${pt(p1)}L${pt(p2)}`, '#fff8c0', 1.6, op(0.9));
      }
      front += P(h().starPath(lc.x - 13, lc.y + 10, 2.6, 0.9, 4, 0), '#fff8c0', 0) + P(h().starPath(lc.x + 9, lc.y - 12, 2.2, 0.8, 4, 0), '#fff8c0', 0);
    }
    if (pose === 'attack') {
      back += C(lc.x, lc.y, 18, c.halo('#fff8c0', 0.9), 0);
      front += P(h().starPath(lc.x, lc.y, 15, 4.5, 8, -90), c.halo('#fffbe0', 0.95), 0)
        + C(94, lc.y - 8, 6.5, c.halo('#ffffff', 1), 0) + C(94, lc.y - 8, 3, '#fffbe0', 1.6)
        + T(`M${num(lc.x + 4)} ${num(lc.y - 3)}L90 ${num(lc.y - 7)}`, '#fff8c0', 2, op(0.8));
    }
    if (pose === 'cast') {
      // 새벽빛: 큰 햇살 원 + 위에서 내리는 빛줄기
      back += C(lc.x, lc.y, 34, c.halo('#fff3a0', 0.6), 0)
        + P(h().starPath(lc.x, lc.y, 30, 9, 12, -90), c.halo('#fffbe0', 0.75), 0);
      front += P(h().starPath(lc.x - 22, lc.y + 14, 3, 1, 4, 0), '#fff8c0', 0) + P(h().starPath(lc.x + 20, lc.y + 22, 2.6, 0.9, 4, 0), '#fff8c0', 0)
        + P(h().starPath(lc.x - 10, lc.y - 18, 2.4, 0.8, 4, 0), '#fff', 0) + P(h().starPath(30, 52, 2.4, 0.8, 4, 0), '#fff8c0', 0);
    }

    const headAll = G(G(face, at(HUMAN.head)), R.htf);
    const hairAll = G(G(backHair, at(HUMAN.head)), R.htf);
    return back
      + cape
      + G(hairAll, R.tf)
      + far.s + (Pz.gf == null ? palm(c, far.H, far.fa, sh(S.skin, -0.1)) : '')
      + legF + legN
      + skirt
      + G(G(torso, R.up) + belt, R.tf)
      + staff
      + (Pz.gf != null ? fist(c, far.H, sa, sh(S.skin, -0.1), -1) : '')
      + G(headAll, R.tf)
      + near.s + fist(c, near.H, sa, S.skin, -1)
      + front;
  }

  /* ---------- 시오: 고개 파수꾼 · 흰 털 두건(쓴 채) · 하늘색 털옷 · 얼음 결정 장궁 ---------- */
  const SIO_C = {
    skin: '#f4d3b8', hair: '#2c2a36', fur: '#f4f6fb', furD: '#c9d2e2', coat: '#4bb6ea', coatD: '#2a7fb8', belt: '#6a4430', strap: '#7a4a30',
    ice: '#bff0ff', pant: '#34506e', boot: '#5a4232', glove: '#9a6a4a', iris: '#4aa8e0', wood: '#3f4f74', string: '#e8f6ff', quiver: '#8a5a3a',
  };
  /** 화살 한 대 (오른쪽을 향함, 꼬리 = (0,0), 길이 len) */
  function arrow(c, len = 34, glowy = false) {
    const S = SIO_C;
    return (glowy ? C(len, 0, 6, c.halo('#bff4ff', 0.85), 0) : '')
      + L(`M1 0H${len - 4}`, '#c9a070', 1.6, 2.4)
      + P(`M${len - 5} -2.6L${len + 2.4} 0L${len - 5} 2.6L${len - 3.6} 0Z`, c.g(S.ice, 0.3), 1.6)
      + P('M0.4 0L-3.6 -3.4H-1.2L3.4 0L-1.2 3.4H-3.6Z', '#5fd4ff', 1.4);
  }
  /**
   * 장궁: grip = 손잡이(활 쥔 손), a = 화살이 나가는 방향(도), draw = 시위를 당긴 거리, nock = 화살을 걸었나
   * 활대는 화살 방향의 수직. 당길수록 활 끝이 뒤로 휨. 돌려줌: { s, nockPt }
   */
  function longbow(c, grip, a, draw = 0, nock = false, glowy = false) {
    const S = SIO_C;
    const dep = 5.5 + draw * 0.28;
    const tipU = V(-dep, -29);
    const tipD = V(-dep, 29);
    const np = V(-dep - draw, 0);
    const limbs = L(`M1.2 -5Q3.4 -19 ${tipU.x} ${tipU.y}M1.2 5Q3.4 19 ${tipD.x} ${tipD.y}`, S.wood, 2.8, 2.6)
      + T(`M0.4 -6Q2 -17 ${tipU.x + 0.6} ${tipU.y + 2}`, sh(S.wood, 0.45), 1.2, op(0.8))
      + P('M-1.8 -6.4H2.4V6.4H-1.8Z', c.gl(S.wood, a, 0.3), 2)
      + P('M-2 -3H2.6V3H-2Z', c.gl(S.strap, a, 0.3), 1.6) + T('M-2 -1.4L2.6 0M-2 1L2.6 2.4', sh(S.strap, -0.4), 1.1)
      + P('M2.6 -10L4.6 -8L2.6 -6L1.8 -8Z', S.ice, 1.3)
      + P(`M${tipU.x} ${tipU.y}l-2.4 -1.8 1.2 -3.6 2.6 -1.4 0.6 3.2Z`, c.g(S.ice, 0.3), 1.4)
      + P(`M${tipD.x} ${tipD.y}l-2.4 1.8 1.2 3.6 2.6 1.4 0.6 -3.2Z`, c.g(S.ice, 0.3), 1.4);
    const str = T(`M${tipU.x} ${tipU.y}L${np.x} ${np.y}L${tipD.x} ${tipD.y}`, OLC, 2.6) + T(`M${tipU.x} ${tipU.y}L${np.x} ${np.y}L${tipD.x} ${tipD.y}`, S.string, 1.3);
    const arw = nock ? G(arrow(c, 36, glowy), at(np)) : '';
    const tf = (p) => { const q = rot(p, a, V(0, 0)); return add(q, grip.x, grip.y); };
    return { s: G(limbs + str + arw, at(grip, a)), nockPt: tf(np), tipU: tf(tipU), tipD: tf(tipD) };
  }

  const SIO = {
    //        몸 [dx,dy]  기울기 숨   가까운 발          먼 발              활 [손잡이x,y,각도,당김,걸기]   가까운 손         두건 끝
    idle0: { b: [0, 0], lean: 0, br: 0, fn: [45, null, 0], ff: [56, null, 0], bw: [67.6, 57.4, 10, 0, 0], hn: [53.4, 67.4], held: true, eye: 'open', mo: 'line' },
    idle1: { b: [0, 0], lean: 0, br: 1.2, hd: 2, fn: [45, null, 0], ff: [56, null, 0], bw: [67.8, 56.4, 13, 0, 0], hn: [53.6, 66.2], held: true, eye: 'open', mo: 'line' },
    walk0: { b: [0, 0.8], lean: 4, fn: [57.5, null, -14], ff: [41.5, null, 24], bw: [69.4, 58.6, 16, 0, 0], hn: [42.5, 66], eye: 'open', mo: 'line', hem: 2 },
    walk1: { b: [0, -0.8], lean: 3, fn: [51, null, 0], ff: [45.5, 81, 18], bw: [67, 58.8, 10, 0, 0], hn: [50, 70], eye: 'open', mo: 'line', hem: 0 },
    walk2: { b: [0, 0.8], lean: 4, fn: [41.5, null, 24], ff: [57.5, null, -14], bw: [64.8, 59.4, 4, 0, 0], hn: [60, 66], eye: 'open', mo: 'line', hem: -2 },
    walk3: { b: [0, -0.8], lean: 3, fn: [45.5, 81, 18], ff: [51, null, 0], bw: [67, 58.8, 10, 0, 0], hn: [50, 70], eye: 'open', mo: 'line', hem: 0 },
    // 조준: 활 팔을 앞으로 쭉, 시위를 턱까지 끝까지 당김 (화살촉에 서리가 모임)
    aim: { b: [-1, 1.4], lean: -2, fn: [43, null, 0], ff: [59.5, null, -2], bw: [74.4, 45.6, 0, 14, 1], nE: [39, 47.6], eye: 'focus', mo: 'line', bk: 'angry', glowy: true },
    // 공격: 놓는 순간 — 시위가 앞으로 튕기고 화살은 날아감, 당기던 손은 뒤로 펼쳐짐
    attack: { b: [-1.6, 1.4], lean: -4, hd: -3, fn: [43, null, 0], ff: [59.5, null, -2], bw: [74, 45.6, 0, 0, 0], hn: [41, 41.6], open: true, eye: 'focus', mo: 'line', bk: 'angry' },
    // 기술 서리 화살비: 하늘로 활을 치켜들어 끝까지 당김, 위로 얼음 화살들이 솟구침
    cast: { b: [-2, 1.5], lean: -9, hd: -14, fn: [42, null, 0], ff: [59, null, -2], bw: [66, 33.6, -55, 13, 1], nE: [38, 45.6], eye: 'focus', mo: 'line', bk: 'angry', glowy: true },
  };

  function sio(c, pose) {
    const S = SIO_C;
    const Pz = SIO[pose] || SIO.idle0;
    const R = rig(HUMAN, Pz);
    const bw = Pz.bw;
    const grip = V(bw[0], bw[1]);
    const bowA = bw[2];
    const B = longbow(c, grip, bowA, bw[3], !!bw[4], Pz.glowy);
    const sl = { sleeve: S.coat, cuff: S.fur, rs: 3.3, re: 2.9, rw: 2.6 };
    const far = arm(R.sf, grip, Object.assign({}, sl, { sleeve: sh(S.coat, -0.18), cuff: S.furD }));
    const nearT = bw[4] ? B.nockPt : V(Pz.hn[0], Pz.hn[1]);
    const near = arm(R.sn, nearT, Object.assign({}, sl, Pz.nE ? { E: Pz.nE } : {}));
    const legO = { pant: S.pant, boot: S.boot, rim: S.fur };
    const legN = leg(c, R.hn, foot(Pz.fn), legO);
    const legF = leg(c, R.hf, foot(Pz.ff), Object.assign({}, legO, { pant: sh(S.pant, -0.2), boot: sh(S.boot, -0.15), rim: S.furD }));

    // 등의 화살통 (몸통 좌표)
    const quiver = G(P('M-3.6 0H3.6L3 20Q0 21.6 -3 20Z', c.gl(S.quiver, -18, 0.25), 2.4)
      + T('M-3.4 4H3.4M-3.2 16H3', sh(S.quiver, -0.4), 1.3)
      + P('M-2.6 0L-4.6 -6.4L-1.4 -4L-0.6 -8.4L1 -4.2L3.4 -7.6L3 -0.6Z', S.fur, 1.6)
      + T('M-1.6 -1L-3 -5M1.2 -1L2.6 -5.6', '#5fd4ff', 1.3), 'translate(41.6 44) rotate(-18)');

    // 두건 (머리 좌표) — 흰 털 두건을 쓴 채, 얼굴만 동그랗게 열림
    const hoodBack = P('M-1 -15.8C8 -16 14 -9 14 -0.6C14 7.4 10 12.8 3 13.8L-6.4 13.6C-12.6 11 -16 5 -15.8 -2.6C-15.4 -10.2 -9.8 -15.6 -1 -15.8Z', c.g(S.fur, 0.1), 2.8)
      + T('M-12 -6C-13 0 -12 6 -8 10.4M-6 -13.4Q-12 -10 -13.4 -4', S.furD, 1.4)
      + T('M-8.6 -12.4Q-2 -15.4 5 -13.6', '#fff', 1.5);
    const fid = c.clip('M3.4 -8.6C9.6 -8.6 12.2 -3.6 12.2 1.8C12.2 7.4 8.4 11.6 3.4 11.6C-1.6 11.6 -5.4 7.4 -5.4 1.8C-5.4 -3.6 -2.8 -8.6 3.4 -8.6Z');
    const faceIn = CL(fid, P('M-6 -9H13V12H-6Z', c.r(S.skin, 0.2), 0) + SHD('M8 11C11 8 13 4 12.4 -2L14 12Z', 0.15)
      + P('M-5.6 -9H12.6V-1.2L11 -3.4L9.6 -0.6L8 -3.6L6.2 -0.8L4.6 -3.8L2.8 -0.8L1.2 -3.6L-0.6 -0.4L-2 -3.2L-5.6 0Z', c.g(S.hair, 0.25), 1.8))
      + E(0.6, 6.4, 2, 1.2, '#ff7a7a', 0, op(0.4)) + E(9.6, 6, 1.4, 1, '#ff7a7a', 0, op(0.35))
      + eyes(c, { kind: Pz.eye, iris: S.iris, brow: S.hair, bk: Pz.bk || 'calm', x: 1.4, y: 2.4 }) + mouth(Pz.mo, 6, 8.4);
    const furRing = FUR('M3.4 -9.6C10.6 -9.6 13.4 -3.8 13.4 1.8C13.4 8.2 9 12.8 3.4 12.8C-2.2 12.8 -6.6 8.2 -6.6 1.8C-6.6 -3.8 -3.8 -9.6 3.4 -9.6Z', S.fur, 3.8, 3.4, 2.4);
    const head = hoodBack + faceIn + furRing;

    // 몸통 (몸통 좌표): 털옷 + 앞섶 + 띠(화살통 끈) + 허리띠 얼음 버클
    const tid = c.clip(BODY);
    const torso = G(neckS(c, S.skin), at(HUMAN.head))
      + P(BODY, c.g(S.coat, 0.22), 2.8)
      + CL(tid, BODY_SHD + T('M55.6 46.6Q57.6 55 56.6 66', S.coatD, 1.6) + G(castSegs(near.segs), R.inv)
        + T('M57.8 51.6h2.6M57.4 56.6h2.8', S.fur, 1.6))
      + L('M44.6 46.2L58.8 61.4', S.strap, 2.4, 2.2) + C(51, 53, 1.3, '#d9b070', 1.2)
      + FUR('M43.4 46.6Q50 43.4 57.6 46.4', S.fur, 3.4, 3, 2.2);
    const belt = P('M41.2 60.8L59.8 60.4L60 64L41.4 64.4Z', c.g(S.belt, 0.25), 2) + P('M56.4 59.6L58.6 62.2L56.4 64.8L54.2 62.2Z', c.g(S.ice, 0.35), 1.4);
    // 털옷 아랫자락 (엉덩이까지, 털 단)
    const hem = Pz.hem || 0;
    const a1 = R.W(V(41.2, 63.4));
    const a2 = R.W(V(59.8, 63));
    const X = (x) => num(x + R.dx);
    const Y = (y) => num(y + R.dy);
    const skirt = P(`M${pt(a1)}L${pt(a2)}L${X(62.4 + hem)} ${Y(73.2)}Q${X(51 + hem * 0.6)} ${Y(75.4)} ${X(39.4 + hem * 0.3)} ${Y(73)}Z`, c.g(S.coat, 0.22), 2.6)
      + SHD(`M${X(56 + hem * 0.2)} ${Y(63.4)}L${pt(a2)}L${X(62.4 + hem)} ${Y(73.2)}L${X(57 + hem * 0.8)} ${Y(74.4)}Z`, 0.2)
      + T(`M${X(55.6)} ${Y(64)}L${X(56.4 + hem * 0.8)} ${Y(73.8)}`, S.coatD, 1.5)
      + FUR(`M${X(39.6 + hem * 0.3)} ${Y(73.4)}Q${X(51 + hem * 0.6)} ${Y(75.8)} ${X(62.4 + hem)} ${Y(73.6)}`, S.fur, 3.6, 3.2, 2.2);

    // 손: 가죽 장갑
    const gl = S.glove;
    let nearHand;
    if (bw[4]) nearHand = fist(c, near.H, bowA + 90, gl, 1);
    else if (Pz.open) nearHand = palm(c, near.H, near.fa - 20, gl, 'open', -1);
    else nearHand = fist(c, near.H, near.fa + 90, gl, 1);
    // 서 있을 때 가까운 손에 든 화살 (촉이 아래)
    const heldArrow = Pz.held ? G(arrow(c, 30), `${at(add(near.H, -1.2, -9), 98)}`) : '';

    // 효과
    let back = '';
    let front = '';
    if (pose === 'aim') {
      const tip = pol(B.nockPt, 36, bowA);
      front += T(`M${num(tip.x + 4)} ${num(tip.y - 6)}l3 -3M${num(tip.x + 6)} ${num(tip.y + 4)}l3 2`, S.ice, 1.5, op(0.9))
        + P(h().starPath(tip.x - 4, tip.y - 7, 2.4, 0.8, 6, 0), '#e8fbff', 0);
    }
    if (pose === 'attack') {
      // 화살은 이미 날아감 → 오른쪽 끝에 얼음 화살과 꼬리, 활 앞에 서리 김
      front += T('M78 45.6H88', '#e8fbff', 2, op(0.7)) + T('M82 43H90M82 48.2H89', '#bff0ff', 1.4, op(0.6))
        + G(arrow(c, 12, true), 'translate(84 45.6)')
        + C(74, 45.6, 7, c.halo('#e8fbff', 0.8), 0)
        + T(`M${num(B.tipU.x - 3)} ${num(B.tipU.y + 3)}l-3 1M${num(B.tipD.x - 3)} ${num(B.tipD.y - 3)}l-3 -1`, '#e8fbff', 1.4, op(0.8));
    }
    if (pose === 'cast') {
      back += C(B.nockPt.x + 20, B.nockPt.y - 26, 22, c.halo('#bff4ff', 0.45), 0);
      for (const [x, y] of [[74, 10], [86, 18], [92, 4]]) front += G(T('M-12 0H-2', '#e8fbff', 2, op(0.7)) + arrow(c, 12, true), `translate(${x} ${y}) rotate(-58)`);
      front += P(h().starPath(64, 14, 2.4, 0.8, 6, 0), '#e8fbff', 0) + P(h().starPath(96, 30, 2, 0.7, 6, 0), '#e8fbff', 0);
    }

    const headAll = G(G(head, at(HUMAN.head)), R.htf);
    return back
      + G(G(quiver, R.up), R.tf)
      + far.s
      + legF + legN
      + G(G(torso, R.up) + belt, R.tf)
      + skirt
      + G(headAll, R.tf)
      + B.s + fist(c, far.H, bowA + 90, sh(gl, -0.12), -1)
      + near.s + heldArrow + nearHand
      + front;
  }

  /* ---------- 제나: 떠돌이 발명가 · 곱슬 갈색 머리와 이마의 고글 · 보라 웃옷 · 코일 배낭과 선으로 이은 방전 막대 ---------- */
  const ZENA_C = {
    skin: '#c98c62', hair: '#7a4a2c', jacket: '#8f7bff', shirt: '#f3e7d0', leather: '#7a5232', pant: '#3c3550', boot: '#5a3d2e',
    gold: '#e0b04a', lens: '#c9f0ff', band: '#3a3046', copper: '#e0954a', metal: '#7a6a8a', orb: '#b9adff', spark: '#e8e2ff', glove: '#5a4a6a', iris: '#7a5cff',
  };
  /** 코일 하나: 바닥 (0,0)에서 위로. glow 0~2 */
  function coil(c, glow) {
    const Z = ZENA_C;
    return P('M-2.6 0H2.6V-15H-2.6Z', c.g(Z.metal, 0.3), 2.2)
      + T('M-3.4 -3H3.4M-3.4 -6.2H3.4M-3.4 -9.4H3.4M-3.4 -12.6H3.4', OLC, 3.2) + T('M-3.4 -3H3.4M-3.4 -6.2H3.4M-3.4 -9.4H3.4M-3.4 -12.6H3.4', Z.copper, 1.8)
      + C(0, -19, glow ? 8 + glow * 2 : 6.5, c.halo('#c9bfff', glow ? 1 : 0.75), 0)
      + C(0, -19, 4, c.r(Z.orb, 0.5), 2.2) + C(-1.2, -20.4, 1.1, '#fff', 0);
  }
  /** 방전 막대: p = 쥔 손, a = 겨눈 방향. 뒤 끝에 선이 꽂힘. 돌려줌 { s, tip, butt } */
  function zapRod(c, p, a, glow = 0) {
    const Z = ZENA_C;
    const s = P('M-7.6 -2.4H-4.4V2.4H-7.6Z', c.gl(Z.metal, a, 0.3), 1.8)
      + P('M-4.6 -2.2H3V2.2H-4.6Z', c.gl(Z.leather, a, 0.25), 1.8) + T('M-3 -2.2L-1.8 2.2M-0.6 -2.2L0.6 2.2', sh(Z.leather, -0.4), 1.1)
      + P('M2.8 -3.6H4.8V3.6H2.8Z', c.gl(Z.gold, a, 0.3), 1.6)
      + P('M4.8 -1.9H12V1.9H4.8Z', c.gl(Z.metal, a, 0.3), 1.8)
      + T('M6.4 -2.6V2.6M8.4 -2.6V2.6M10.4 -2.6V2.6', OLC, 2.6) + T('M6.4 -2.6V2.6M8.4 -2.6V2.6M10.4 -2.6V2.6', Z.copper, 1.4)
      + T('M12 -1.6L15 -3.8M12 1.6L15 3.8', OLC, 2.8) + T('M12 -1.6L15 -3.8M12 1.6L15 3.8', '#c8c0d8', 1.4)
      + C(14.6, 0, glow ? 4 + glow * 3 : 3, c.halo('#d8d0ff', glow ? 1 : 0.7), 0) + C(14.2, 0, 1.8, c.r(Z.orb, 0.5), 1.3);
    return { s: G(s, at(p, a)), tip: pol(p, 15, a), butt: pol(p, -7.6, a) };
  }
  /** 작은 번개 드론 (중심 0,0, 폭 약 34). glow 0~2, ph 날개 위상 */
  function droneBody(c, glow = 0, ph = 0) {
    const Z = ZENA_C;
    const rotor = (x) => L(`M${x * 0.55} -8L${x} -15`, Z.metal, 2.2, 2.4)
      + E(x, -16, 10.5, 2.4, '#e8e2ff', 1.8, op(0.55))
      + T(`M${num(x - 9 * Math.cos(ph))} ${num(-16 - 1.6 * Math.sin(ph))}L${num(x + 9 * Math.cos(ph))} ${num(-16 + 1.6 * Math.sin(ph))}`, '#6a5a8a', 1.6)
      + C(x, -16, 1.5, Z.gold, 1.2);
    return rotor(-12) + rotor(12)
      + L('M0 9V16', Z.metal, 3.2, 2.4) + T('M-2.2 11.6H2.2M-2.2 14H2.2', Z.copper, 1.4)
      + C(0, 19, glow ? 6 + glow * 3 : 4.5, c.halo('#d8d0ff', glow ? 1 : 0.7), 0) + C(0, 19, 2.8, c.r(Z.orb, 0.5), 1.8)
      + P('M-17 1C-17 -7.6 -9 -11.6 0 -11.6C9 -11.6 17 -7.6 17 1C17 8 9 11.4 0 11.4C-9 11.4 -17 8 -17 1Z', c.r(Z.jacket, 0.35), 2.6)
      + SHD('M-16 4C-10 10 8 12 16.4 4C15 10 8 11.6 0 11.6C-8 11.6 -14 9 -16 4Z', 0.25)
      + T('M-16.4 2.4Q0 7.4 16.4 2.4', OLC, 3.6) + T('M-16.4 2.4Q0 7.4 16.4 2.4', Z.gold, 2)
      + T('M-10 -7.6Q-4 -10.4 3 -9.8', '#fff', 1.5, op(0.7))
      + C(8, -1.4, glow ? 7 : 5.5, c.halo('#bff4ff', glow ? 1 : 0.6), 0)
      + C(8, -1.4, 4.4, '#2a2440', 2.2) + C(8.6, -1.4, 2.5, c.r('#bff4ff', 0.4), 0) + C(7.4, -2.6, 0.9, '#fff', 0)
      + L('M-6 -11.4L-8 -16', OLC, 1.4, 1.6) + C(-8.2, -16.8, 1.6, '#ffd84a', 1.3);
  }
  /** 번개 줄기 (a→b, 꺾임 n번) */
  function bolt(a, b, n, amp, seed = 1) {
    const pts = [a];
    for (let i = 1; i < n; i++) {
      const t = i / n;
      const p = lerp(a, b, t);
      const off = ((i * 37 + seed * 11) % 7 - 3) / 3 * amp;
      const ang = angTo(a, b) + 90;
      pts.push(pol(p, off, ang));
    }
    pts.push(b);
    return `M${pts.map(pt).join('L')}`;
  }

  const ZENA = {
    //        몸 [dx,dy]  기울기 숨   가까운 발          먼 발              막대 [손x,손y,각도]  먼 손          코일빛
    idle0: { b: [0, 0], lean: 1, br: 0, fn: [45, null, 0], ff: [56, null, 0], rod: [55.6, 68.4, 62], hf: [59.8, 69.6], glow: 0, eye: 'open', mo: 'grin', bk: 'up' },
    idle1: { b: [0, 0], lean: 1, br: 1.3, hd: 3, fn: [45, null, 0], ff: [56, null, 0], rod: [56, 67.4, 52], hf: [59.8, 68.6], glow: 0, arc: true, eye: 'open', mo: 'open', bk: 'up' },
    walk0: { b: [0, 0.8], lean: 4, fn: [57.5, null, -14], ff: [41.5, null, 24], rod: [44.6, 67, 100], hf: [63.6, 66.4], glow: 0, eye: 'open', mo: 'grin' },
    walk1: { b: [0, -0.8], lean: 3, fn: [51, null, 0], ff: [45.5, 81, 18], rod: [51.4, 70.4, 78], hf: [57, 70], glow: 0, eye: 'open', mo: 'grin' },
    walk2: { b: [0, 0.8], lean: 4, fn: [41.5, null, 24], ff: [57.5, null, -14], rod: [59, 66.4, 40], hf: [46, 68], glow: 0, eye: 'open', mo: 'grin' },
    walk3: { b: [0, -0.8], lean: 3, fn: [45.5, 81, 18], ff: [51, null, 0], rod: [51.4, 70.4, 78], hf: [56, 70], glow: 0, eye: 'open', mo: 'grin' },
    // 조준: 두 손으로 막대를 앞으로 겨눔 — 배낭 코일이 밝게 빛나고 막대 끝에 불꽃이 모임
    aim: { b: [0, 1.4], lean: 5, hd: 2, fn: [43, null, 0], ff: [59, null, -4], rod: [60.6, 55.4, -4], gf: 8, glow: 1, arc: true, eye: 'focus', mo: 'grin', bk: 'angry' },
    // 공격: 막대 끝에서 번개가 튀어나감 — 반동으로 막대가 들리고 몸이 살짝 뒤로
    attack: { b: [-1.4, 1.2], lean: -3, hd: -5, fn: [43, null, 0], ff: [59, null, -4], rod: [59.4, 53, -16], gf: 8, glow: 2, arc: true, eye: 'wide', mo: 'shout', bk: 'up' },
    // 기술 번개 드론: 먼 손을 높이 뻗어 드론을 띄워 올림, 막대로 드론을 가리킴
    cast: { b: [0, 0.4], lean: -6, hd: -12, fn: [44, null, 0], ff: [58, null, -6], rod: [58.6, 52, -42], hf: [66.6, 32], palmUp: true, glow: 2, arc: true, eye: 'happy', mo: 'grin', bk: 'up' },
  };

  function zena(c, pose) {
    const Z = ZENA_C;
    const Pz = ZENA[pose] || ZENA.idle0;
    const R = rig(HUMAN, Pz);
    const rp = V(Pz.rod[0], Pz.rod[1]);
    const ra = Pz.rod[2];
    const glow = Pz.glow || 0;
    const Rod = zapRod(c, rp, ra, glow);
    const sl = { sleeve: Z.jacket, cuff: Z.gold, rs: 3.2 };
    const near = arm(R.sn, rp, sl);
    const farT = Pz.gf != null ? pol(rp, Pz.gf, ra) : V(Pz.hf[0], Pz.hf[1]);
    const far = arm(R.sf, farT, Object.assign({}, sl, { sleeve: sh(Z.jacket, -0.2), cuff: sh(Z.gold, -0.2) }));
    const legO = { pant: Z.pant, boot: Z.boot, rim: Z.leather, lace: Z.gold };
    const legN = leg(c, R.hn, foot(Pz.fn), legO);
    const legF = leg(c, R.hf, foot(Pz.ff), Object.assign({}, legO, { pant: sh(Z.pant, -0.2), boot: sh(Z.boot, -0.15) }));

    // 배낭 + 코일 두 개 (몸통 좌표, 등 뒤)
    const pack = G(coil(c, glow), `translate(33.6 48.6) rotate(${-34 + (Pz.sway || 0)})`) + G(coil(c, glow), `translate(38.4 47.4) rotate(${-16 + (Pz.sway || 0)})`)
      + P('M32 47.6Q32 46 33.6 46H44.4L45 66H34Q32.6 66 32.6 64.4Z', c.g('#6d6880', 0.3), 2.6)
      + SHD('M40 46H44.4L45 66H40.6Z', 0.18)
      + P('M33.4 49.4H43.2V53.6H33.4Z', '#5a5470', 1.6) + C(35.6, 51.5, 1, Z.gold, 0) + C(38.4, 51.5, 1, '#8dffb0', 0) + C(41.2, 51.5, 1, '#ff8a6a', 0)
      + T('M33.6 58.4H44.2M33.8 61.8H44.4', sh('#6d6880', -0.35), 1.3) + P('M35.6 63.6H42V66.6H35.6Z', Z.copper, 1.6);
    // 배낭에서 막대 뒤끝으로 이어지는 선 (아래로 처짐)
    const pb = R.W(V(38.8, 66.6), R.br);
    const mid = V((pb.x + Rod.butt.x) / 2, Math.max(pb.y, Rod.butt.y) + 6);
    const cable = L(`M${pt(pb)}Q${pt(mid)} ${pt(Rod.butt)}`, '#4a3e5c', 2, 2.4) + T(`M${pt(pb)}Q${pt(mid)} ${pt(Rod.butt)}`, '#8a7aa8', 1.2, op(0.7));

    // 머리 (머리 좌표): 곱슬머리 덩어리 + 이마 위 고글
    const curlD = (cx, cy, rx, ry, a0, a1, n, r) => {
      let d = '';
      for (let i = 0; i <= n; i++) {
        const a = (a0 + ((a1 - a0) * i) / n) * D2R;
        const x = num(cx + Math.cos(a) * rx);
        const y = num(cy + Math.sin(a) * ry);
        d += i ? `A${r} ${r} 0 0 1 ${x} ${y}` : `M${x} ${y}`;
      }
      return d;
    };
    const backHair = P(`${curlD(-1.6, -0.6, 15.4, 15, 76, 334, 11, 4.8)}C6 -12 -2 -8 -4 2C-4 8 -2 12 1 14Z`, c.g(Z.hair, 0.26), 2.6)
      + T('M-12.4 -1.6q2.2 -2.6 3.8 -0.4M-10.6 5.6q2.4 -2 3.6 0.6M-7.4 -9.8q2.6 -1.4 3.4 1M-13 -7.4q1.6 -2.4 3.6 -1M-6.4 11q2 -2.2 3.6 0', sh(Z.hair, 0.35), 1.3)
      + T('M-12 2Q-13 6 -10 9.6M-9 -12Q-12.6 -9 -13.6 -4', sh(Z.hair, -0.35), 1.3);
    const fringe = P(`${curlD(1.4, -4.4, 11.6, 8.4, 185, 360, 7, 3.6)}C10 -4.6 7 -6 4.6 -4.4C2 -6.4 -1.4 -6 -3.2 -3.6C-5.4 -3 -7 -1 -7.8 2Z`, c.g(Z.hair, 0.26), 2.2)
      + T('M3 -9Q6 -10.6 9.4 -9.4M-4 -8.6Q-1 -10.6 2 -10', sh(Z.hair, 0.38), 1.3, op(0.85));
    const goggles = T('M-11 -5.6Q1 -12.6 13 -6.4', OLC, 4.6) + T('M-11 -5.6Q1 -12.6 13 -6.4', Z.band, 2.6)
      + C(3.4, -9.4, 3.8, c.g(Z.gold, 0.35), 1.8) + C(10, -8, 3.4, c.g(Z.gold, 0.35), 1.8)
      + C(3.4, -9.4, 2.4, c.r(Z.lens, 0.4), 0) + C(10, -8, 2.1, c.r(Z.lens, 0.4), 0)
      + C(2.6, -10.2, 0.8, '#fff', 0) + C(9.3, -8.8, 0.7, '#fff', 0);
    const freckles = G('<circle cx="-0.6" cy="5.4" r="0.6"/><circle cx="1.6" cy="6.4" r="0.6"/><circle cx="0.2" cy="7.2" r="0.6"/><circle cx="9.4" cy="5" r="0.5"/>', '', ' fill="#7a4a30" opacity=".6"');
    const face = faceBase(c, Z.skin, { noEar: true }) + fringe + goggles + freckles
      + eyes(c, { kind: Pz.eye, iris: Z.iris, brow: '#4a2a18', bk: Pz.bk || 'calm', y: 2 }) + mouth(Pz.mo);

    // 몸통 (몸통 좌표): 보라 웃옷 앞섶이 열려 크림색 셔츠, 배낭 멜빵, 공구 허리띠
    const tid = c.clip(BODY);
    const torso = G(neckS(c, Z.skin), at(HUMAN.head))
      + P(BODY, c.g(Z.jacket, 0.22), 2.8)
      + CL(tid, P('M52.4 45.6L58.4 46.2C60 52 60.2 58 59.6 63L54.6 63C55.4 57 54.6 50 52.4 45.6Z', c.g(Z.shirt, 0.2), 2)
        + BODY_SHD + G(castSegs(near.segs), R.inv))
      + T('M52.4 45.6L55.8 51.2L58.4 46.2', sh(Z.jacket, -0.35), 1.6)
      + L('M44.6 46.4L47.6 62', Z.leather, 2.4, 2.2) + L('M53.6 46.2L57.4 52', sh(Z.leather, -0.15), 2.2, 2.2)
      + C(46.6, 55.4, 1.2, Z.gold, 1.2)
      + C(52.6, 56.4, 2.4, c.r('#ffd84a', 0.3), 1.6) + P('M52.9 54.6l-1.3 2h1l-.7 2 1.8-2.4h-1l.8-1.6z', '#7a4a00', 0);
    const belt = P('M41.2 60.8L59.8 60.4L60 64L41.4 64.4Z', c.g(Z.leather, 0.25), 2) + P('M55.4 60.6H58.4V64H55.4Z', c.g(Z.gold, 0.3), 1.4)
      + P('M42.4 63.6H47.2V68.6H42.4Z', c.g(sh(Z.leather, 0.1), 0.25), 1.8) + T('M42.6 65.2H47', sh(Z.leather, -0.4), 1.2)
      + P('M48.4 63.6H52.6V67.6H48.4Z', c.g(sh(Z.leather, 0.05), 0.25), 1.6) + T('M50.5 62.2V64.6', '#9aa0b8', 1.4);
    const pelvis = P('M41.2 63.4L59.6 63.2L60.2 69.4Q53 72 50 71.6Q45 71.2 40.6 69.6Z', c.g(Z.pant, 0.2), 2.6);

    // 손: 작업 장갑
    const gl = Z.glove;
    const farHand = Pz.gf != null ? fist(c, far.H, ra, sh(gl, -0.12), 1)
      : Pz.palmUp ? palm(c, far.H, far.fa - 30, sh(gl, -0.05), 'open', -1) : fist(c, far.H, far.fa + 90, sh(gl, -0.12), 1);

    // 효과
    let back = '';
    let front = '';
    const c1 = R.W(add(V(33.6, 48.6), -10.6, -15.8), R.br);
    const c2 = R.W(add(V(38.4, 47.4), -5.2, -18.3), R.br);
    if (Pz.arc) front += T(bolt(c1, c2, 4, 1.4, glow + 2), '#f4f0ff', 1.5, op(0.95));
    if (pose === 'aim') {
      front += C(Rod.tip.x, Rod.tip.y, 8, c.halo('#d8d0ff', 0.9), 0)
        + T(`M${num(Rod.tip.x + 3)} ${num(Rod.tip.y - 5)}l2.4 -2.4M${num(Rod.tip.x + 5)} ${num(Rod.tip.y + 2)}l3 1M${num(Rod.tip.x - 1)} ${num(Rod.tip.y + 5)}l1 3`, Z.spark, 1.4);
    }
    if (pose === 'attack') {
      const end = V(98, Rod.tip.y - 9);
      back += C(Rod.tip.x, Rod.tip.y, 13, c.halo('#d8d0ff', 1), 0);
      front += L(bolt(Rod.tip, end, 6, 2.6, 3), '#f4f0ff', 2.4, 2.4) + T(bolt(pol(Rod.tip, 8, -10), V(94, Rod.tip.y + 4), 4, 2, 5), '#c9bfff', 1.5)
        + P(h().starPath(Rod.tip.x, Rod.tip.y, 7, 2.4, 6, 0), '#fff', 0);
    }
    if (pose === 'cast') {
      const dp = V(76, 15);
      back += C(dp.x, dp.y, 16, c.halo('#c9bfff', 0.7), 0);
      front += T(`M${num(far.H.x + 1)} ${num(far.H.y - 4)}L${num(dp.x - 5)} ${num(dp.y + 8)}`, '#e8e2ff', 1.5, ' stroke-dasharray="2 2.4"')
        + G(droneBody(c, 2, 0.6), `${at(dp, -8, 0.5)}`)
        + T(bolt(Rod.tip, V(dp.x - 2, dp.y + 10), 4, 1.6, 7), '#f4f0ff', 1.5, op(0.9))
        + T('M60 18l-3-2M88 26l3 1M70 4l-1-3', Z.spark, 1.5);
    }

    const headAll = G(G(face, at(HUMAN.head)), R.htf);
    const hairAll = G(G(backHair, at(HUMAN.head)), R.htf);
    return back
      + G(G(pack, R.up), R.tf)
      + G(hairAll, R.tf)
      + far.s + (Pz.gf == null && !Pz.palmUp ? farHand : '')
      + legF + legN
      + G(pelvis + G(torso, R.up) + belt, R.tf)
      + cable
      + Rod.s + (Pz.gf != null || Pz.palmUp ? farHand : '')
      + G(headAll, R.tf)
      + near.s + fist(c, near.H, ra, gl, 1)
      + front;
  }

  /* ---------- 바위: 이끼 낀 둥근 돌거인 · 가슴의 초록 공명석 · 큰 바위 주먹 ---------- */
  const BAWI_C = { stone: '#a39d90', moss: '#7fbf4a', gem: '#6dff9a', glow: '#8dffb0', eye: '#b8ffcf' };
  /** 돌거인 뼈대: 짧고 굵은 다리, 큰 몸통, 무릎까지 닿는 긴 팔 */
  const GIANT = {
    hip: V(50, 71),
    hn: V(45, 72), hf: V(55, 71.4),
    sn: V(36.4, 49), sf: V(64, 46.6),
    neck: V(55, 40),
    head: V(56, 29.6),
    thigh: 8.6, shin: 8.4, ua: 13, fa: 13,
  };
  /** 돌 발: A = 발목. 둥근 돌덩이 */
  function stoneFoot(c, A, a, col) {
    return G(P('M-6 -4.4Q-6 -6.4 -3.6 -6.4H4Q8.6 -6.2 9.4 -1.6L9.6 2.8Q9.6 3.6 8.6 3.6H-5.2Q-6 3.6 -6 2.8Z', c.gl(col, a, 0.3), 2.8)
      + T('M3 -2.6V3.2M6.2 -2V3.2', sh(col, -0.4), 1.4) + T('M-4 -4.6Q0 -5.6 4 -4.8', sh(col, 0.35), 1.3, op(0.8)), at(A, a));
  }
  /** 바위 주먹: p = 중심, a = 팔 방향 */
  function rockFist(c, p, a, col, k = 1) {
    return G(P('M-6.4 -5.4Q-2 -8.4 4 -7.6Q8.6 -6.4 8.4 0Q8.6 6.4 3.6 7.6Q-2.4 8.6 -6.4 5.4Q-8 0 -6.4 -5.4Z', c.gl(col, a, 0.32), 3)
      + T('M3.6 -6.8Q6.4 -4 4.4 -1.4M4.4 -1.4Q7 1.4 4.4 4.2M4.4 4.2Q6 6.4 3.4 7.4', sh(col, -0.42), 1.5)
      + T('M-3.6 -5.6Q0 -6.8 3 -6', sh(col, 0.4), 1.4, op(0.8))
      + T('M-4.6 2.4L-2 4.6', sh(col, -0.35), 1.4), `${at(p, a)} scale(${k})`);
  }

  const BAWI = {
    //        몸 [dx,dy]  기울기 숨   가까운 발           먼 발              가까운 주먹   먼 주먹      흔들림
    idle0: { b: [0, 0], lean: 0, br: 0, fn: [44, null, 0], ff: [57, null, 0], hn: [30.6, 74], hf: [72.6, 70.4], eye: 'open', mo: 'smile' },
    idle1: { b: [0, 0], lean: 0, br: 1.6, hd: -3, fn: [44, null, 0], ff: [57, null, 0], hn: [31, 72.8], hf: [73, 69.2], fl: 1, eye: 'open', mo: 'smile' },
    walk0: { b: [0, 0.6], lean: 3, fn: [54, null, -8], ff: [42.4, null, 16], hn: [27, 70], hf: [76, 67.6], eye: 'open', mo: 'smile' },
    walk1: { b: [0, -0.8], lean: -1, fn: [49, null, 0], ff: [47, 82, 12], hn: [31.4, 72.6], hf: [71.4, 70.4], eye: 'open', mo: 'smile' },
    walk2: { b: [0, 0.6], lean: 3, fn: [41, null, 16], ff: [55, null, -8], hn: [36.6, 73], hf: [67, 71.6], eye: 'open', mo: 'smile' },
    walk3: { b: [0, -0.8], lean: -1, fn: [47, 82, 12], ff: [51, null, 0], hn: [31.4, 72.6], hf: [71.4, 70.4], eye: 'open', mo: 'smile' },
    // 조준: 가까운 바위 주먹을 어깨 뒤로 크게 젖힘, 먼 팔은 앞으로 막음
    aim: { b: [-2, 0.8], lean: -9, hd: -4, fn: [39, null, 4], ff: [59, null, -4], hn: [19.6, 47.6], hf: [78, 55], eye: 'focus', mo: 'grit', bk: 'angry', glow: 1 },
    // 공격: 앞으로 내디디며 가까운 주먹을 쭉 내지름 → 충격 고리
    attack: { b: [6, 1], lean: 14, hd: 6, sno: [7, 1], fn: [40, null, 18], ff: [63, null, 0], hn: [79.6, 53], hf: [62, 70], headFront: true, eye: 'focus', mo: 'grit', bk: 'angry', glow: 1 },
    // 기술 대지의 벽: 몸을 낮추고 두 주먹으로 땅을 짚음 → 앞에 바위 기둥이 솟음
    cast: { b: [2, 11], lean: 24, hd: 12, sno: [4, 0], fn: [37, null, 18], ff: [60, null, 0], hn: [60.4, 80.6], hf: [73, 80.4], eye: 'open', mo: 'line', bk: 'angry', glow: 2 },
  };

  function bawi(c, pose) {
    const B = BAWI_C;
    const Pz = BAWI[pose] || BAWI.idle0;
    const R = rig(GIANT, Pz);
    const st = B.stone;
    const armO = (col) => ({ ua: 13, fa: 13, sleeve: col, rs: 5.6, re: 4.8, rw: 5.2 });
    const near = arm(R.sn, Pz.hn, armO(st));
    const far = arm(R.sf, Pz.hf, armO(sh(st, -0.16)));
    const legO = (col) => ({ thigh: 8.6, shin: 8.4, pant: col, rh: 6.2, rk: 5.4, ra: 5 });
    const fN = foot(Pz.fn);
    const fF = foot(Pz.ff);
    const kneeN = ik(R.hn, V(fN[0], fN[1] - 1), 8.6, 8.4, -1);
    const kneeF = ik(R.hf, V(fF[0], fF[1] - 1), 8.6, 8.4, -1);
    const legDraw = (hip, k, f, col) => limb([{ a: hip, b: k.E, ra: 6.2, rb: 5.4, col }, { a: k.E, b: k.H, ra: 5.4, rb: 5, col }])
      + T(`M${pt(add(k.E, -4, -1))}Q${pt(add(k.E, 0, 1.6))} ${pt(add(k.E, 4, -0.6))}`, sh(col, -0.4), 1.4)
      + stoneFoot(c, V(f[0], f[1] - 0.4), f[2], col);
    const legN = legDraw(R.hn, kneeN, fN, st);
    const legF = legDraw(R.hf, kneeF, fF, sh(st, -0.16));
    const glow = Pz.glow || 0;

    // 몸통 (몸통 좌표): 큰 둥근 바위, 아래쪽 이끼, 금, 꽃, 가슴의 공명석
    const TOR = 'M28.4 64C25.6 50 33 39 45.4 37.4L59.6 37.4C70.6 39 76 48 74.4 62C73.4 74 66 79.6 52 79.6C37.6 79.6 29.8 74.4 28.4 64Z';
    const tid = c.clip(TOR);
    const torso = P(TOR, c.r(st, 0.3), 3.2)
      + CL(tid, SHD('M64 38C78 44 80 62 74 74C68 80 58 81 50 80C62 76 70 66 70 54C70 46 68 41 64 38Z', 0.22)
        + SHD('M24 70C34 78 60 82 80 70V84H24Z', 0.18)
        + P('M24 70C30 78 40 81 50 81C58 81 64 80 72 74C66 72 62 77 56 74.6C50 77.4 46 73 40 74.4C34 72 29 73 24 70Z', c.g(B.moss, 0.2), 2)
        + G(castSegs(near.segs, 2.2, 2.6, 0.22), R.inv))
      + T('M34 58l4 4 -1 4M66 66l-4 3M42 46l3 3M70 52l-3 1', sh(st, -0.38), 1.6)
      + flower(42, 77, '#ff9cc0') + flower(64, 76)
      + P('M57.6 50.6L63.4 57.6L57.6 64.8L51.8 57.6Z', c.r(B.gem, 0.5), 2.4)
      + C(57.6, 57.6, glow === 2 ? 15 : glow ? 11 : 8.5, c.halo(B.glow, glow ? 0.85 : 0.5), 0)
      + T('M55.6 54.8L57.6 52.4', '#fff', 1.4, op(0.9));
    // 어깨 바위 (이끼와 꽃)
    const shoulder = (p, r, col) => C(p.x, p.y, r, c.r(col, 0.35), 3)
      + P(`M${num(p.x - r + 1)} ${num(p.y - 2)}C${num(p.x - r + 2)} ${num(p.y - r - 2)} ${num(p.x + r - 2)} ${num(p.y - r - 2)} ${num(p.x + r - 1)} ${num(p.y - 2)}C${num(p.x + 3)} ${num(p.y - r + 3)} ${num(p.x - 3)} ${num(p.y - r + 4)} ${num(p.x - r + 1)} ${num(p.y - 2)}Z`, c.g(B.moss, 0.25), 2.2)
      + SHD(`M${num(p.x + r * 0.2)} ${num(p.y + r * 0.95)}A${r} ${r} 0 0 0 ${num(p.x + r)} ${num(p.y + r * 0.1)}Q${num(p.x + r * 0.5)} ${num(p.y + r * 0.6)} ${num(p.x + r * 0.2)} ${num(p.y + r * 0.95)}Z`, 0.2);
    // 머리 (머리 좌표): 둥근 돌 머리 + 이끼 모자 + 꽃 + 초록 눈 + 이끼 수염
    const hd = C(0, 0, 10.6, c.r(st, 0.35), 3)
      + SHD('M4 10C9 7 11 2 10.4 -3C12 3 11 9 4 10Z', 0.2)
      + P('M-11.6 -1.6C-12 -10.4 -5.4 -13.6 1 -13.6C8.4 -13.6 12.6 -9.4 11.6 -2.6C8.6 -5.4 5 -4.4 3 -6.4C0 -3.6 -3.6 -5.4 -5.6 -3.6C-7.6 -4.6 -9.6 -3.6 -11.6 -1.6Z', c.g(B.moss, 0.25), 2.4)
      + flower(-5.6, -10.4) + flower(5.4, -11.2, '#ff9cc0') + (Pz.fl ? flower(10.4, -6.6) : flower(9.6, -7.2))
      + (Pz.eye === 'focus'
        ? P('M0.6 -0.4L5.6 0.8L5.4 2.2L0.8 1.4Z', B.eye, 1) + P('M8 0.8L12 0L11.8 1.4L8.2 2.2Z', B.eye, 1)
        : E(2.6, 1.4, 1.8, 2.2, '#16261a', 0) + E(9.4, 1.2, 1.6, 2, '#16261a', 0) + C(3, 0.6, 0.8, B.eye, 0) + C(9.8, 0.5, 0.7, B.eye, 0))
      + T(Pz.bk === 'angry' ? 'M-0.6 -3L5.4 -0.8M8 -0.8L12.2 -2.6' : 'M-0.6 -2.6Q2.6 -4.6 5.6 -2.6M8 -2.8Q10.4 -4.4 12.2 -2.4', sh(B.moss, -0.2), 2)
      + P('M6.4 2.6C8.6 2.8 9.4 5.6 7.8 6.6C6.6 7.2 5.4 6 5.8 4.4Z', c.r(st, 0.4), 1.8)
      + P('M-2 6.4C0 4.6 4 5.2 6 6.6C8.4 5.4 11 5.8 11.4 7.6C11 11.6 7 14.2 3.6 14C0 13.8 -2.6 10.6 -2 6.4Z', c.g(B.moss, 0.22), 2.2)
      + T('M2 9.6Q4 12.4 3.4 13.6M7.6 9.6Q8 12 7 13.4', sh(B.moss, -0.32), 1.3)
      + (Pz.mo === 'grit' ? P('M3 7.6H8.6V9.6H3Z', '#2a2a26', 1.2) : T('M3.2 8.2Q5.6 9.6 8.4 8', OLC, 1.5));

    // 효과
    let back = '';
    let front = '';
    if (pose === 'aim') front += T('M14 40l-4-2M12 50l-5 0M15 58l-4 2', '#e6dcc8', 1.8, op(0.8));
    if (pose === 'attack') {
      const fp = near.H;
      back += C(fp.x + 8, fp.y, 14, c.halo('#fff4dc', 0.6), 0);
      front += T(`M${num(fp.x + 9)} ${num(fp.y - 9)}Q${num(fp.x + 15)} ${num(fp.y)} ${num(fp.x + 9)} ${num(fp.y + 9)}M${num(fp.x + 13)} ${num(fp.y - 12)}Q${num(fp.x + 20)} ${num(fp.y)} ${num(fp.x + 13)} ${num(fp.y + 12)}`, '#fff4dc', 2.4, op(0.85))
        + T('M30 48h-8M28 56h-10M31 64h-7', '#e6dcc8', 1.8, op(0.7))
        + P(`M${num(fp.x + 12)} ${num(fp.y - 4)}l3 -2 1 3zM${num(fp.x + 13)} ${num(fp.y + 5)}l3 1 -2 2z`, c.g('#c8c2b4'), 1.4);
    }
    if (pose === 'cast') {
      // 앞으로 솟는 바위 기둥 + 흙먼지 + 갈라진 땅
      const spike = (x, w, ht, col) => P(`M${x - w} 90L${x - w * 0.7} ${90 - ht * 0.7}L${x - w * 0.2} ${90 - ht}L${x + w * 0.5} ${90 - ht * 0.8}L${x + w} 90Z`, c.g(col, 0.3), 2.6)
        + T(`M${x - w * 0.2} ${90 - ht + 2}L${x - w * 0.3} ${90 - ht * 0.4}`, sh(col, 0.35), 1.3, op(0.8))
        + SHD(`M${x + w * 0.1} ${90 - ht * 0.9}L${x + w * 0.5} ${90 - ht * 0.8}L${x + w} 90H${x + w * 0.2}Z`, 0.22);
      front += spike(84, 6, 22, st) + spike(92.4, 4.6, 14, sh(st, -0.1)) + spike(77.6, 4, 11, sh(st, 0.06))
        + P('M80 70l2-3 2 2zM92 66l2-2 1 3z', '#7fbf4a', 1.2)
        + C(58, 88, 5, '#e6dcc8', 0, op(0.6)) + C(70, 89, 5.5, '#e6dcc8', 0, op(0.55)) + C(52, 86, 3.4, '#e6dcc8', 0, op(0.5))
        + T('M60 89l6 -2 4 1M72 89l4 -3', '#5a4a3a', 1.6)
        + C(57.6 + R.dx, 57.6 + R.dy, 4, c.halo('#ffffff', 0.9), 0);
      back += C(86, 74, 18, c.halo(B.glow, 0.45), 0);
    }

    const headAll = G(G(hd, at(GIANT.head)), R.htf);
    const sN = R.sn;
    const sF = R.sf;
    return back
      + far.s + rockFist(c, far.H, far.fa, sh(st, -0.16))
      + shoulder(sF, 10.6, sh(st, -0.12))
      + legF + legN
      + G(G(torso, R.up), R.tf)
      + (Pz.headFront ? '' : G(headAll, R.tf))
      + near.s + rockFist(c, near.H, near.fa, st, 1.08)
      + shoulder(sN, 11.4, sh(st, -0.04)) + flower(sN.x - 3, sN.y - 8.6)
      + (Pz.headFront ? G(headAll, R.tf) : '')
      + front;
  }

  /* ---------- 야로: 그림자 도적 · 회색 후드와 짧은 어깨망토 · 검은 목도리 · 양손 단검 ---------- */
  const YARO_C = {
    skin: '#ecc7ab', hood: '#8d8a96', hoodD: '#5f5c68', scarf: '#2a2430', tunic: '#5a5264', accent: '#d14fc0', pant: '#2b2733', boot: '#1f1b24',
    blade: '#e6e9f2', guard: '#6e1f66', grip: '#3a2a3e', hair: '#2e2638', iris: '#d14fc0', wrap: '#8a8496',
  };
  /** 단검: p = 쥔 손, a = 칼날 방향. 손잡이·코등이·잎 모양 칼날 */
  function dagger(c, p, a, glint = false) {
    const Y = YARO_C;
    return G(C(-5, 0, 1.6, Y.guard, 1.4)
      + P('M-4 -1.6H3V1.6H-4Z', Y.grip, 1.6) + T('M-2.4 -1.6L-1.4 1.6M0 -1.6L1 1.6', '#6a5a74', 1.1)
      + P('M3 -4.2H5V4.2H3Z', c.gl(Y.guard, a, 0.3), 1.6) + C(4, 0, 1, Y.accent, 0)
      + P('M5 -2.2L15.6 -1.7L20 0L15.6 1.7L5 2.2Z', c.gl(Y.blade, a, 0.25), 1.9)
      + T('M6 -0.2L17 0', glint ? '#fff' : '#b8b0c8', 1.1)
      + (glint ? P('M16 -3.6L16.8 -0.8L19.6 0L16.8 0.8L16 3.6L15.2 0.8L12.4 0L15.2 -0.8Z', '#fff', 0) : ''), at(p, a));
  }

  const YARO = {
    //        몸 [dx,dy]  기울기 숨   가까운 발          먼 발              가까운 손 [x,y,칼각]  먼 손 [x,y,칼각]   목도리 흔들림
    idle0: { b: [0, 1.6], lean: 7, br: 0, fn: [42.6, null, 0], ff: [58.4, null, -2], hn: [45.6, 66.4, 150], hf: [63.6, 60.4, 96], sc: 0, eye: 'lidded', mo: 'smirk' },
    idle1: { b: [0, 1.6], lean: 7, br: 1.2, hd: 3, fn: [42.6, null, 0], ff: [58.4, null, -2], hn: [46, 65.4, 136], hf: [63.6, 59.4, 110], sc: 1, eye: 'lidded', mo: 'smirk' },
    walk0: { b: [0, 2.4], lean: 10, fn: [58, null, -14], ff: [41, null, 24], hn: [42, 66, 160], hf: [66, 61, 96], sc: 2, eye: 'lidded', mo: 'line' },
    walk1: { b: [0, 0.8], lean: 9, fn: [51, null, 0], ff: [45, 81, 18], hn: [48, 68, 130], hf: [61, 64, 100], sc: 1, eye: 'lidded', mo: 'line' },
    walk2: { b: [0, 2.4], lean: 10, fn: [41, null, 24], ff: [58, null, -14], hn: [56, 65, 110], hf: [54, 66, 120], sc: 2, eye: 'lidded', mo: 'line' },
    walk3: { b: [0, 0.8], lean: 9, fn: [45, 81, 18], ff: [51, null, 0], hn: [48, 68, 130], hf: [61, 64, 100], sc: 1, eye: 'lidded', mo: 'line' },
    // 조준: 몸을 낮게 웅크리고 두 단검을 거꾸로 쥠 (칼날이 팔 아래로), 가까운 팔을 뒤로 높이
    aim: { b: [-2, 5.4], lean: 13, hd: -3, fn: [39, null, 8], ff: [60, null, -4], hn: [38.6, 47.4, 112], hf: [62.4, 63, 168], sc: 3, eye: 'focus', mo: 'line', bk: 'angry' },
    // 공격: 앞으로 파고들며 가까운 단검을 크게 그어 벰
    attack: { b: [5, 3], lean: 20, hd: 6, fn: [38, null, 26], ff: [65, null, 0], hn: [75.4, 60.4, 18], hf: [49, 67, 150], sc: 4, glint: true, eye: 'focus', mo: 'shout', bk: 'angry' },
    // 기술 그림자 습격: 그림자 틈에서 튀어나와 단검을 찌름 (뒤쪽은 아직 그림자 속)
    cast: { b: [7, 2.4], lean: 24, hd: 8, fn: [40, 82.6, 34], ff: [67, null, 0], hn: [80.6, 57.4, -6], hf: [50, 62, 160], sc: 5, glint: true, eye: 'focus', mo: 'smirk', bk: 'angry', rift: true },
  };

  function yaro(c, pose) {
    const Y = YARO_C;
    const Pz = YARO[pose] || YARO.idle0;
    const R = rig(HUMAN, Pz);
    const sl = { sleeve: '#4c4556', cuff: Y.wrap, rs: 3, re: 2.5, rw: 2.1 };
    const near = arm(R.sn, Pz.hn, sl);
    const far = arm(R.sf, Pz.hf, Object.assign({}, sl, { sleeve: sh('#4c4556', -0.2), cuff: sh(Y.wrap, -0.2) }));
    const legO = { pant: Y.pant, boot: Y.boot, rim: Y.wrap, rh: 3.3, rk: 2.7, ra: 2.3, fold: true };
    const legN = leg(c, R.hn, foot(Pz.fn), legO);
    const legF = leg(c, R.hf, foot(Pz.ff), Object.assign({}, legO, { pant: sh(Y.pant, -0.25), boot: sh(Y.boot, -0.2), rim: sh(Y.wrap, -0.25) }));
    const sc = Pz.sc || 0;

    // 목도리 꼬리 (등 뒤로 흩날림) — 몸통 좌표
    const tails = [
      'M45 46C40 46 36 50 31 50C28 50 26 48 23 49C26 53 29 56 33 56C38 56 41 52 45 51Z',
      'M45 46C40 45 36 48 31 47C28 46 25 44 22 45C24 49 27 53 32 53C37 54 41 51 45 51Z',
      'M45 46C40 47 36 52 31 53C28 54 26 53 23 55C26 58 30 59 34 58C38 57 41 53 45 51Z',
      'M45 46C40 44 35 44 30 42C27 41 24 38 21 39C23 43 26 47 31 48C36 50 41 50 45 51Z',
      'M45 46C40 43 34 41 28 40C25 39 21 36 17 37C20 41 24 45 30 46C36 48 41 50 45 51Z',
      'M45 46C38 42 32 38 25 37C21 36 17 33 13 34C16 39 21 43 28 45C35 47 41 50 45 51Z',
    ];
    const scarfTail = G(P(tails[sc], c.g(Y.scarf, 0.3), 2.4), 'translate(45 48.5) scale(1 0.72) translate(-45 -48.5)') + T(tails[sc].replace(/^M45 46C/, 'M44 48.6C').split('C').slice(0, 2).join('C'), '#4a4054', 1.2, op(0.8));
    // 어깨망토 (후드에서 이어짐) — 몸통 좌표
    const capelet = P('M42.6 46.4C46 43.4 55 43 58.6 46C60.6 49.6 60.4 53 59.4 55.6C55 56.6 47 56.2 41.4 54.4C40.6 51.4 41 48.6 42.6 46.4Z', c.g(Y.hood, 0.25), 2.4)
      + SHD('M54 45.6C57.6 45.6 59.6 47.4 60 50.4C60.2 52.6 59.8 54.4 59.4 55.6C57 56.2 55 56.4 53 56.4C55 52.6 55.4 48.6 54 45.6Z', 0.2)
      + T('M44 52Q48 54.4 52.6 54.4', Y.hoodD, 1.3);

    // 머리 (머리 좌표): 얼굴 → 앞머리 → 후드(뒤 꼭지 뾰족) → 목도리
    const hood = P('M3 -14C10.6 -13.4 14.2 -7.6 13.8 -2C11.6 -6.4 7.6 -8.8 2.6 -8.6C-2.4 -8.4 -5.4 -5 -5.8 0.4C-6 4 -5 7.6 -3 10.4L-7.4 13C-12.4 10 -14.4 4 -14 -2.6C-13.6 -9.4 -7.6 -14.6 3 -14Z', c.g(Y.hood, 0.25), 2.6)
      + P(`M-11.6 -8.4C-15.4 -9 -19 -7.4 ${num(-22 - sc * 0.4)} ${num(-4.4 + sc * 0.3)}C-18.4 -3.4 -15.4 -2.2 -13.2 0Z`, c.g(sh(Y.hood, -0.12), 0.25), 2.2)
      + T('M-7.4 -11.4Q0 -15 7.6 -12', sh(Y.hood, 0.4), 1.4, op(0.85))
      + T('M-9.6 -4C-10.6 2 -9.6 7 -6.4 11', Y.hoodD, 1.4)
      + SHD('M2.6 -8.6C7.6 -8.8 11.6 -6.4 13.8 -2L13.6 -0.6C11 -4.6 7 -6.6 2.6 -6.6C-1.6 -6.4 -4.6 -3.6 -5 0.6L-5.8 0.4C-5.4 -5 -2.4 -8.4 2.6 -8.6Z', 0.35);
    const bangs = P('M-5 -8.4H13V-1.6L11.4 -3.6L10 -0.6L8.4 -3.8L6.6 -0.8L5 -4L3.2 -1L1.6 -4.2L-0.2 -1.4L-1.6 -4.2L-5 -1Z', c.g(Y.hair, 0.25), 1.8);
    const scarf = P('M-6.4 8.6C-2 10.6 6 11 11.4 8.6C12.8 11 12.6 14 11 16.4C5 18 -2 17.6 -7 15.6C-8 13 -7.8 10.6 -6.4 8.6Z', c.g(Y.scarf, 0.3), 2.4)
      + T('M-5 12.6Q3 14.4 10.6 12.4', '#4a4054', 1.3);
    const face = faceBase(c, Y.skin, { noEar: true }) + bangs + hood
      + eyes(c, { kind: Pz.eye, iris: Y.iris, brow: Y.hair, bk: Pz.bk || 'calm', y: 2 })
      + mouth(Pz.mo, 6.4, 7.6) + scarf;

    // 몸통 (몸통 좌표): 어두운 웃옷 + 자홍 줄 + 허리띠와 칼집
    const tid = c.clip(BODY);
    const torso = G(neckS(c, Y.skin), at(HUMAN.head))
      + P(BODY, c.g(Y.tunic, 0.22), 2.8)
      + CL(tid, P('M52.4 46L55 46L56.6 67H54Z', Y.accent, 0) + P('M57.4 47.4L59 48.6L59.6 67H58.4Z', sh(Y.accent, -0.2), 0)
        + BODY_SHD + G(castSegs(near.segs, 1.8, 2.2, 0.25), R.inv))
      + T('M49.6 50.6L48.2 62', '#2a2430', 1.4);
    const belt = P('M41 61L59.8 60.6L60 64.2L41.2 64.6Z', c.g('#3a2a3e', 0.3), 2) + P('M54.6 60.8H57.8V64H54.6Z', c.g('#9a90a8', 0.3), 1.4)
      + G(P('M-1.8 0H1.8L1.4 9L0 10.4L-1.4 9Z', c.g('#3a2a3e', 0.3), 1.6) + T('M-1.4 3H1.4', Y.accent, 1.3), 'translate(43.6 62.6) rotate(18)');
    const pelvis = P('M41.2 63.4L59.6 63.2L60.2 69.4Q53 72 50 71.6Q45 71.2 40.6 69.6Z', c.g(Y.pant, 0.2), 2.6)
      + P('M41 63.4L46 63.6L44.6 72.6L39.6 70.4Z', c.g(sh(Y.tunic, -0.05), 0.25), 2) + P('M54 63.4L60 63.2L61.4 70.6L56 72Z', c.g(sh(Y.tunic, -0.1), 0.25), 2);

    // 효과
    let back = '';
    let front = '';
    if (pose === 'aim') front += P(h().starPath(near.H.x + 2, near.H.y + 14, 2.4, 0.8, 4, 0), '#fff', 0);
    if (pose === 'attack') {
      back += P(arcBand(54, 58, 30, 22, -80, 26), '#f2b8ea', 0, op(0.5)) + P(arcBand(54, 58, 29.4, 25.4, -72, 22), '#fff', 0, op(0.65));
      front += T('M82 38l4-3M86 52h5M82 66l4 3', '#f2b8ea', 1.6, op(0.85));
    }
    if (pose === 'cast') {
      // 그림자 틈 (세로로 갈라진 어둠) — 뒤쪽 다리와 목도리가 아직 그 속에
      back += E(36, 62, 11, 27, c.raw('yrift', (id) => h().rg(id, [[0, '#0e0612', 1], [0.7, '#2a0e30', 0.95], [1, '#d14fc0', 0.9]], 0.5, 0.5, 0.5)), 2.6)
        + E(36, 62, 14, 30, c.halo('#d14fc0', 0.5), 0)
        + T('M30 44Q36 52 32 62T36 80', '#ff8ef0', 1.4, op(0.7));
      front += P('M30 76C36 72 42 74 46 78C42 80 38 84 32 84C30 82 29 79 30 76Z', '#1a0c20', 0, op(0.85))
        + P('M26 60C32 58 36 62 40 60C38 64 33 66 28 65Z', '#1a0c20', 0, op(0.7))
        + C(91, 58, 6, c.halo('#ffffff', 0.9), 0)
        + T('M50 40h-8M48 48h-10M52 56h-8', '#d14fc0', 1.6, op(0.7));
    }

    const headAll = G(G(face, at(HUMAN.head)), R.htf);
    const glint = !!Pz.glint;
    return back
      + G(G(scarfTail, R.up), R.tf)
      + dagger(c, far.H, Pz.hf[2]) + far.s + fist(c, far.H, Pz.hf[2], sh(Y.skin, -0.12), 1)
      + legF + legN
      + G(pelvis + G(torso + capelet, R.up) + belt, R.tf)
      + G(headAll, R.tf)
      + dagger(c, near.H, Pz.hn[2], glint) + near.s + fist(c, near.H, Pz.hn[2], Y.skin, 1)
      + front;
  }

  /* ---------- 모르는 영웅: 회색 자리표시 ---------- */
  function heroPlaceholder(c) {
    const R = rig(HUMAN, {});
    const o = { pant: '#6a6a78', boot: '#4a4a56' };
    return leg(c, R.hf, ground(56), o) + leg(c, R.hn, ground(45), o)
      + P(BODY, c.g('#9a9aa8'), 2.8) + G(faceBase(c, '#c8c8d2') + eyes(c, {}), at(HUMAN.head));
  }

  const HEROES = { kara, sera, sio, zena, bawi, yaro };

  /**
   * 영웅 자세: idle0·idle1(숨쉬기 2장) · walk0~walk3(걷기 한 바퀴) · aim(공격 직전) · attack(공격 순간) · cast(기술)
   * 옛 이름: idle → idle0. (옛 walk1·walk2는 새 이름과 겹치므로 새 자세가 우선 — 렌더러는 새 이름만 씀)
   */
  RG.art.HERO_POSES = ['idle0', 'idle1', 'walk0', 'walk1', 'walk2', 'walk3', 'aim', 'attack', 'cast'];
  const HERO_OLD = { idle: 'idle0', walk: 'walk0', walk1: 'walk1', walk2: 'walk2' };
  RG.art.hero = function hero(id, pose = 'idle0') {
    const c = pad();
    const p = RG.art.HERO_POSES.includes(pose) ? pose : (HERO_OLD[pose] || 'idle0');
    let body;
    try {
      body = (HEROES[id] || heroPlaceholder)(c, p);
    } catch (e) {
      if (RG.art._strict) throw e;
      body = heroPlaceholder(c);
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
   * 게임에서 0.6칸(약 20px)으로 작게 보이므로 큰 덩어리·굵은 외곽선 위주
   * ========================================================= */
  const MOSS = '#7fbf4a';
  /** 작은 돌 병사 뼈대 */
  const GOLEM = {
    hip: V(50, 74),
    hn: V(45, 75), hf: V(55.4, 74.6),
    sn: V(40.6, 55), sf: V(60, 53),
    neck: V(52, 47), head: V(53, 38.6),
    thigh: 6.6, shin: 6.4, ua: 10, fa: 10,
  };
  /** 이끼 모자 (돌 머리 위) */
  const mossCap = (c, x, y, r) => P(`M${x - r} ${y}C${x - r} ${y - r * 1.25} ${x + r} ${y - r * 1.25} ${x + r} ${y}C${x + r * 0.5} ${y - r * 0.45} ${x} ${y - r * 0.2} ${x - r * 0.4} ${y - r * 0.5}C${x - r * 0.6} ${y - r * 0.2} ${x - r * 0.8} ${y - r * 0.1} ${x - r} ${y}Z`, c.g(MOSS, 0.25), 2.4);

  /**
   * 돌 병사 공통 몸: 자세 표 한 줄(Pz)과 생김새(o)를 받아 그림.
   * o: { stone, body(몸통 경로), head(머리 그리기), legR, armR, backItem, frontItem(무기·방패), handN, handF }
   */
  function golemBody(c, Pz, o) {
    const R = rig(GOLEM, Pz);
    const st = o.stone;
    const armO = (col) => ({ ua: 10, fa: 10, sleeve: col, rs: o.armR || 4, re: (o.armR || 4) - 0.6, rw: (o.armR || 4) - 0.4, bend: 1 });
    const near = arm(R.sn, Pz.hn, armO(st));
    const far = arm(R.sf, Pz.hf, armO(sh(st, -0.18)));
    const lr = o.legR || 4.6;
    const legDraw = (hip, f, col) => {
      const k = ik(hip, V(f[0], f[1] - 1), 6.6, 6.4, -1);
      return limb([{ a: hip, b: k.E, ra: lr, rb: lr - 0.6, col }, { a: k.E, b: k.H, ra: lr - 0.6, rb: lr - 0.8, col }])
        + G(P('M-5 -3.6Q-5 -5.4 -3 -5.4H3.4Q7.6 -5.2 8 -1.4L8.2 2.6Q8.2 3.4 7.4 3.4H-4.4Q-5 3.4 -5 2.6Z', c.gl(col, f[2], 0.3), 2.6)
          + T('M2.6 -2V3', sh(col, -0.4), 1.4), at(V(f[0], f[1] - 0.6), f[2]));
    };
    const fN = foot(Pz.fn);
    const fF = foot(Pz.ff);
    const tid = c.clip(o.body);
    const torso = P(o.body, c.r(st, 0.3), 3)
      + CL(tid, SHD('M58 46C68 52 68 70 60 78C66 70 66 56 58 46Z', 0.25) + SHD('M30 70C40 80 60 80 70 70V84H30Z', 0.2)
        + (o.mossBelly !== false ? P('M32 72C40 79 52 80 64 74C58 72 54 76 48 74C44 76 38 73 32 72Z', c.g(MOSS, 0.2), 1.8) : '')
        + (o.torsoIn ? o.torsoIn(R) : '')
        + G(castSegs(near.segs, 1.6, 2, 0.25), R.inv))
      + (o.torsoOn ? o.torsoOn(R) : '');
    const headG = G(G(o.head(R), at(GOLEM.head)), R.htf);
    return (o.fxBack || '')
      + (o.backItem ? o.backItem(R, near, far) : '')
      + far.s + (o.handF ? o.handF(R, far) : '')
      + legDraw(R.hf, fF, sh(st, -0.18)) + legDraw(R.hn, fN, st)
      + G(G(torso, R.up), R.tf)
      + G(headG, R.tf)
      + (o.midItem ? o.midItem(R, near, far) : '')
      + near.s + (o.handN ? o.handN(R, near) : '')
      + (o.frontItem ? o.frontItem(R, near, far) : '')
      + (o.fx || '');
  }
  const golemEyes = (x, y, col = '#d8ff8a', kind = 'open') => (kind === 'focus'
    ? P(`M${x - 2} ${y - 0.6}L${x + 2.2} ${y + 0.6}L${x + 2} ${y + 1.8}L${x - 2} ${y + 0.8}Z`, col, 0) + P(`M${x + 5} ${y + 0.6}L${x + 8.4} ${y - 0.4}L${x + 8.4} ${y + 0.8}L${x + 5} ${y + 1.8}Z`, col, 0)
    : C(x, y, 2, col, 0) + C(x + 6.6, y, 1.8, col, 0) + C(x, y, 3.6, col, 0, op(0.25)));

  /* ---------- 돌 병사 (병영 Lv1~3): 둥근 돌몸 + 나무 방패 + 창 ---------- */
  const SOLDIER = {
    //        몸           기울기  가까운 발          먼 발             가까운 손(창)  먼 손(방패)   창 각도
    idle: { b: [0, 0], lean: 0, fn: [44, null, 0], ff: [56, null, 0], hn: [36, 66], hf: [63, 62], sp: -90, eye: 'open' },
    walk0: { b: [0, 0.8], lean: 4, fn: [51.6, null, -6], ff: [48.6, null, 12], hn: [37, 65], hf: [64, 61], sp: -84, eye: 'open' },
    walk1: { b: [0, 0.8], lean: 4, fn: [40, null, 12], ff: [60.6, null, -6], hn: [39, 66], hf: [62, 62], sp: -96, eye: 'open' },
    // 조준: 창을 뒤로 당겨 어깨 높이에 겨눔
    aim: { b: [-2, 0.6], lean: -8, fn: [40, null, 4], ff: [58, null, -2], hn: [34, 52], hf: [62, 58], sp: -4, eye: 'focus' },
    // 공격: 앞으로 내디디며 창을 쭉 찌름
    attack: { b: [4, 0.6], lean: 12, fn: [40.6, null, 12], ff: [60, null, 0], hn: [60, 55], hf: [66, 62], sp: 0, eye: 'focus', fx: true },
  };
  function stoneSoldier(c, pose) {
    const Pz = SOLDIER[pose] || SOLDIER.idle;
    const stone = '#a39d90';
    const wood = '#9a6a3a';
    const spear = (R, near) => {
      const hnd = near.H;
      const a = Pz.sp;
      const back = pol(hnd, -16, a);
      const tip = pol(hnd, 26, a);
      return limb([{ a: back, b: tip, ra: 1.6, rb: 1.6, col: wood }], 2.2)
        + G(P('M0 -3.4L9 0L0 3.4L1.6 0Z', c.gl('#c8c2b4', a, 0.35), 2.2) + T('M1.6 0H7', '#fff', 1.2, op(0.7)), at(tip, a))
        + G(P('M-1.6 -2.6H1.6V2.6H-1.6Z', '#6a4424', 1.4), at(pol(tip, -1, a), a));
    };
    const shield = (R, near, far) => G(C(0, 0, 10, c.r(wood, 0.3), 3) + C(0, 0, 6.6, 'none', 0, ' stroke="#6a4424" stroke-width="1.8"')
      + T('M-6 -6L6 6', '#6a4424', 1.4, op(0.6)) + C(0, 0, 2.6, c.r('#c9c2b4', 0.4), 1.6) + SHD('M3 9C8 6 10 2 9.6 -3C11 4 9 9 3 9Z', 0.25), at(add(far.H, 1, 0)));
    return golemBody(c, Pz, {
      stone,
      body: 'M34.6 64C33 51 41 45 50.4 45C60 45 67.4 51 65.6 64C65.4 75 59.6 80.4 50 80.4C40.4 80.4 34.8 75 34.6 64Z',
      head: () => C(0, 0, 10.4, c.r(stone, 0.35), 3) + SHD('M3 9.6C8 7 10.6 2 10 -3C12 4 10 9.6 3 9.6Z', 0.22) + mossCap(c, 0, -2.6, 10.8) + golemEyes(2.6, 1.6, '#d8ff8a', Pz.eye),
      midItem: spear,
      handN: (R, near) => fist(c, near.H, Pz.sp, sh(stone, 0.05), 1),
      frontItem: shield,
      fx: Pz.fx ? T('M24 52h-8M22 58h-10M25 64h-7', '#fff', 1.8, op(0.65)) + C(92, 55, 6, c.halo('#fff4dc', 0.8), 0) : '',
    });
  }

  /* ---------- 화강암 수호병 (분기 A): 더 크고 무거움 · 큰 사각 방패 + 철퇴 ---------- */
  const GUARD = {
    idle: { b: [0, 0], lean: 0, fn: [44, null, 0], ff: [56, null, 0], hn: [36, 66], hf: [64, 60], ma: -112, sx: 0, eye: 'open' },
    walk0: { b: [0, 0.8], lean: 3, fn: [51.6, null, -6], ff: [48.6, null, 12], hn: [37, 64], hf: [65, 59], ma: -104, sx: 1, eye: 'open' },
    walk1: { b: [0, 0.8], lean: 3, fn: [40, null, 12], ff: [60.6, null, -6], hn: [39, 66], hf: [63, 60], ma: -118, sx: -1, eye: 'open' },
    // 조준: 방패를 앞으로 세우고 철퇴를 머리 뒤로 치켜듦
    aim: { b: [-1.6, 0.6], lean: -7, fn: [40, null, 4], ff: [58, null, -2], hn: [33, 44], hf: [66, 58], ma: -130, sx: 2, eye: 'focus' },
    // 공격: 방패로 밀치며 철퇴를 앞으로 내리침
    attack: { b: [4, 0.6], lean: 12, fn: [40.6, null, 12], ff: [60, null, 0], hn: [62, 60], hf: [71, 58], ma: 20, sx: 6, eye: 'focus', fx: true },
  };
  function graniteGuard(c, pose) {
    const Pz = GUARD[pose] || GUARD.idle;
    const gr = '#b9a59c';
    const speck = '<circle cx="40" cy="58" r="1.3"/><circle cx="46" cy="70" r="1.2"/><circle cx="38" cy="66" r="1"/><circle cx="52" cy="53" r="1"/><circle cx="56" cy="74" r="1.2"/><circle cx="60" cy="62" r="1"/>';
    const mace = (R, near) => {
      const a = Pz.ma;
      const head = pol(near.H, 15, a);
      return limb([{ a: pol(near.H, -4, a), b: head, ra: 1.7, rb: 1.9, col: '#6a4424' }], 2.2)
        + C(head.x, head.y, 6, c.r('#8a7a72', 0.35), 2.6)
        + T(`M${pt(pol(head, 6, a - 50))}l${num(Math.cos((a - 50) * D2R) * 3)} ${num(Math.sin((a - 50) * D2R) * 3)}M${pt(pol(head, 6, a + 50))}l${num(Math.cos((a + 50) * D2R) * 3)} ${num(Math.sin((a + 50) * D2R) * 3)}M${pt(pol(head, 6, a))}l${num(Math.cos(a * D2R) * 3)} ${num(Math.sin(a * D2R) * 3)}`, OLC, 2.6)
        + SHD(`M${num(head.x + 1)} ${num(head.y + 5.8)}A6 6 0 0 0 ${num(head.x + 6)} ${num(head.y + 0.6)}Q${num(head.x + 3)} ${num(head.y + 4)} ${num(head.x + 1)} ${num(head.y + 5.8)}Z`, 0.25);
    };
    const shield = (R, near, far) => {
      const p = add(far.H, 2 + Pz.sx * 0.4, -2);
      return G(P('M-9 -18H9Q11.6 -18 11.6 -15.4V8Q11.6 16 0 21Q-11.6 16 -11.6 8V-15.4Q-11.6 -18 -9 -18Z', c.g('#9c8a82', 0.3), 3)
        + P('M-11 -16Q-11 -17.4 -9 -17.4H9Q11 -17.4 11 -16V-11.6C4 -14.6 -4 -14.6 -11 -11.6Z', c.g(MOSS, 0.2), 1.8)
        + T('M-8 -8V8M8 -8V8', sh('#9c8a82', -0.35), 1.4)
        + P('M0 -5L5.4 2L0 9.4L-5.4 2Z', c.r('#6dff9a', 0.5), 2.2) + C(0, 2, 10, c.halo('#8dffb0', Pz.fx ? 0.75 : 0.4), 0)
        + SHD('M4 -18H9Q11.6 -18 11.6 -15.4V8Q11.6 16 0 21Q8 14 8 6V-18Z', 0.2), at(p));
    };
    return golemBody(c, Pz, {
      stone: gr, armR: 4.6, legR: 5.2,
      body: 'M31.6 64C30 49 39.6 42.6 50.4 42.6C61.4 42.6 70 49 68.4 64C68 76.6 61 82 50 82C39 82 32 76.6 31.6 64Z',
      torsoIn: () => G(speck, '', ' fill="#6a5a54" opacity=".6"'),
      head: () => C(0, 0, 10.6, c.r(gr, 0.35), 3) + SHD('M3 9.8C8 7 10.6 2 10 -3C12 4 10 9.6 3 9.8Z', 0.22)
        + P('M-11 -1C-11 -11.6 11 -11.6 11.4 -1L9 -3L6.4 1L3 -5L0 1L-3 -4.6L-6 1L-8.6 -3Z', c.g('#8a7a72', 0.3), 2.4)
        + mossCap(c, 0, -8.6, 6.4) + golemEyes(3, 2.4, '#d8ff8a', Pz.eye),
      midItem: mace,
      handN: (R, near) => fist(c, near.H, Pz.ma, sh(gr, 0.05), 1),
      frontItem: shield,
      fx: Pz.fx ? T('M86 44l6-3M88 60h7M86 76l6 3', '#fff', 2.2, op(0.8)) + T('M22 50h-8M20 58h-10', '#fff', 1.8, op(0.6)) : '',
    });
  }

  /* ---------- 흑요석 쌍검병 (분기 B): 각진 흑요석 몸 · 초록 눈빛 · 양손 흑요석 칼 ---------- */
  const BLADES = {
    idle: { b: [0, 0], lean: 2, fn: [44, null, 0], ff: [57, null, 0], hn: [40, 66, 40], hf: [62, 64, -46], eye: 'open' },
    walk0: { b: [0, 0.8], lean: 6, fn: [51.6, null, -6], ff: [48.6, null, 12], hn: [41, 65, 50], hf: [64, 62, -40], eye: 'open' },
    walk1: { b: [0, 0.8], lean: 6, fn: [40, null, 12], ff: [60.6, null, -6], hn: [43, 66, 30], hf: [61, 64, -52], eye: 'open' },
    // 조준: 두 칼을 머리 뒤로 엇갈려 치켜듦
    aim: { b: [-2, 1], lean: -8, fn: [40, null, 4], ff: [59, null, -2], hn: [40, 44, -140], hf: [56, 42, -110], eye: 'focus' },
    // 공격: 앞으로 파고들며 X자로 벰
    attack: { b: [4, 1], lean: 14, fn: [40.6, null, 12], ff: [60.4, null, 0], hn: [66, 62, 30], hf: [70, 54, -10], eye: 'focus', fx: true },
  };
  function obsidianBlade(c, pose) {
    const Pz = BLADES[pose] || BLADES.idle;
    const ob = '#3a344a';
    const hi = '#8f86c8';
    const blade = (p, a, glint) => G(P('M2 -3L22 -1.6L28 0L22 1.6L2 3Z', c.gl('#2e2840', a, 0.5), 2.4) + T('M4 -1L22 -0.3', glint ? '#fff' : '#d8d0ff', 1.3)
      + P('M0 -5.4H3V5.4H0Z', '#8dffb0', 1.6) + P('M-6 -1.8H0V1.8H-6Z', '#1c1426', 0), at(p, a));
    return golemBody(c, Pz, {
      stone: ob, armR: 3.6, legR: 4.2, mossBelly: false,
      fxBack: Pz.fx ? P(arcBand(50, 60, 34, 27, -70, 30), '#d8d0ff', 0, op(0.6)) + P(arcBand(54, 54, 30, 25, -20, 70), '#c9c0ff', 0, op(0.5)) : '',
      body: 'M36 52L50 43L64 48L64.6 68L54 79L40 75L35 64Z',
      torsoIn: () => P('M50 43L64 48L55 57L44 53Z', hi, 0, op(0.45)) + T('M55 57L53 77M44 53L38 66', '#5a5274', 1.5) + P('M55 57L64.6 68L54 79Z', '#000', 0, op(0.2)),
      head: () => P('M-10 -3L-3 -13L9 -9L10.4 3L2 8L-8.6 6Z', c.g(ob, 0.4), 2.8) + P('M-3 -13L9 -9L1 -5Z', '#c9c0ff', 0, op(0.6))
        + P('M0 -1.6L10.4 -2.6L10 1L0.4 1.6Z', '#8dffb0', 0) + C(5.6, -0.4, 5, c.halo('#8dffb0', Pz.eye === 'focus' ? 0.95 : 0.7), 0),
      backItem: (R, near, far) => blade(far.H, Pz.hf[2], false),
      handF: (R, far) => fist(c, far.H, Pz.hf[2], sh(ob, 0.1), 1),
      midItem: (R, near) => blade(near.H, Pz.hn[2], !!Pz.fx),
      handN: (R, near) => fist(c, near.H, Pz.hn[2], sh(ob, 0.25), 1),
      torsoOn: () => P('M36 52L30 57L36 61Z', c.g(ob), 2.2),
    });
  }

  /* ---------- 번개 드론 (제나 기술): 떠 있는 드론 · 쉼 / 충전 / 번개 ---------- */
  function droneUnit(c, pose) {
    const ph = { idle: 0.3, walk0: 1.2, walk1: 2.2, aim: 0.8, attack: 1.8 }[pose] || 0.3;
    const glow = pose === 'attack' ? 2 : pose === 'aim' ? 1 : 0;
    const core = V(50, 52 + 19 * 1.3);
    let fx = '';
    if (pose === 'aim') {
      fx += C(core.x, core.y, 12, c.halo('#d8d0ff', 0.85), 0);
      for (let i = 0; i < 5; i++) {
        const a = i * 72 + 20;
        fx += T(`M${pt(pol(core, 13, a))}L${pt(pol(core, 8, a))}`, '#e8e2ff', 1.6, op(0.9));
      }
    }
    if (pose === 'attack') {
      const end = V(86, 96);
      fx += C(core.x, core.y, 14, c.halo('#d8d0ff', 1), 0)
        + L(bolt(core, end, 5, 3, 2), '#f4f0ff', 2.6, 2.4) + T(bolt(core, V(64, 98), 4, 2.2, 4), '#c9bfff', 1.6)
        + C(end.x - 2, end.y - 4, 7, c.halo('#e8e2ff', 0.9), 0) + P(h().starPath(core.x, core.y, 7, 2.4, 6, 0), '#fff', 0);
    }
    return G(droneBody(c, glow, ph), 'translate(50 52) scale(1.3)') + fx;
  }

  /* ---------- 바위 벽 (바위 기술): 이끼 낀 바위를 쌓은 벽 · 초록 공명 금 ---------- */
  function rockWall(c) {
    const stone = '#a39d90';
    const rock = (x, y, rx, ry, col, moss) => {
      const d = `M${x - rx} ${y + ry * 0.3}C${x - rx} ${y - ry * 0.9} ${x - rx * 0.4} ${y - ry} ${x} ${y - ry}C${x + rx * 0.6} ${y - ry} ${x + rx} ${y - ry * 0.7} ${x + rx} ${y + ry * 0.2}C${x + rx} ${y + ry} ${x + rx * 0.5} ${y + ry} ${x} ${y + ry}C${x - rx * 0.6} ${y + ry} ${x - rx} ${y + ry * 0.9} ${x - rx} ${y + ry * 0.3}Z`;
      const id = c.clip(d);
      return P(d, c.r(col, 0.3), 3)
        + CL(id, SHD(`M${x + rx * 0.2} ${y + ry}C${x + rx * 0.9} ${y + ry * 0.6} ${x + rx * 1.1} ${y} ${x + rx * 0.9} ${y - ry * 0.6}L${x + rx * 1.4} ${y + ry * 1.4}Z`, 0.22)
          + T(`M${x - rx * 0.5} ${y - ry * 0.6}Q${x} ${y - ry * 0.85} ${x + rx * 0.4} ${y - ry * 0.7}`, sh(col, 0.4), 1.4, op(0.8)))
        + (moss ? P(`M${x - rx * 0.85} ${y - ry * 0.35}C${x - rx * 0.6} ${y - ry * 1.05} ${x + rx * 0.6} ${y - ry * 1.05} ${x + rx * 0.9} ${y - ry * 0.4}C${x + rx * 0.4} ${y - ry * 0.65} ${x - rx * 0.2} ${y - ry * 0.45} ${x - rx * 0.85} ${y - ry * 0.35}Z`, c.g(MOSS, 0.25), 2.2) : '');
    };
    return rock(30, 50, 20, 19, sh(stone, -0.08), true) + rock(70, 47, 22, 21, stone, true)
      + rock(17, 75, 13, 14.4, sh(stone, -0.12), true) + rock(49, 72, 20, 18, stone, true) + rock(83, 75, 13, 14.4, sh(stone, -0.05), true)
      + C(49, 74, 12, c.halo('#8dffb0', 0.55), 0)
      + T('M44 66l5 6-4 6 6 5', '#3a6a2a', 3.4) + T('M44 66l5 6-4 6 6 5', '#8dffb0', 1.6)
      + T('M66 37l4 6-3 6M24 46l5 3M80 70l-4 4', sh(stone, -0.38), 2)
      + flower(26, 34) + flower(76, 29, '#ff9cc0') + flower(85, 63) + flower(12, 64, '#ff9cc0');
  }

  function unitPlaceholder(c) {
    return C(50, 64, 18, c.r('#a8a8b4'), 3) + golemEyes(52, 60);
  }

  const UNITS = { stone_soldier: stoneSoldier, granite_guard: graniteGuard, obsidian_blade: obsidianBlade, obsidian_blades: obsidianBlade, drone: droneUnit, rock_wall: rockWall };

  /** 유닛 자세: idle · walk0·walk1 · aim(휘두르기 직전·드론은 충전) · attack. 바위 벽은 모든 자세가 같음 */
  RG.art.UNIT_POSES = ['idle', 'walk0', 'walk1', 'aim', 'attack'];
  RG.art.unit = function unit(kind, pose = 'idle') {
    const c = pad();
    const p = RG.art.UNIT_POSES.includes(pose) ? pose : 'idle';
    let body;
    try {
      body = (UNITS[kind] || unitPlaceholder)(c, p);
    } catch (e) {
      if (RG.art._strict) throw e;
      body = unitPlaceholder(c);
    }
    return wrap('0 0 100 100', c, body);
  };
})();
