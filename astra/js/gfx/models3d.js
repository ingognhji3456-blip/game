'use strict';

/* =========================================================
 * 3D 캐릭터·몬스터
 * 상자·각기둥을 관절마다 이어 붙인 로우폴리 모델을, 매 프레임 게임 상태(달리기·공격·회피·피격·보스 패턴)에
 * 맞는 자세로 다시 만들어 js/gfx/scene3d.js 의 3D 장면 안에 그립니다. (조명·안개·깊이를 배경과 함께 받음)
 *
 *   AZ.gfx.models3d.build(W, t, ghosts) → { mesh, meshCount, glow, glowCount, shadow, shadowCount }
 *
 * 모델 좌표: +Y 위, +Z 앞(바라보는 쪽), +X 왼쪽, -X 오른쪽(무기 드는 손). 발바닥 = 0.
 * 세계 좌표: 게임 (x, y, 높이) → GL (x, 높이, y)
 * ========================================================= */
window.AZ = window.AZ || {};
AZ.gfx = AZ.gfx || {};

AZ.gfx.models3d = (() => {
  const STRIDE = 23;
  const TAU = Math.PI * 2;
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const lerp = (a, b, k) => a + (b - a) * k;
  const easeOut = (k) => 1 - (1 - k) * (1 - k);
  const easeIn = (k) => k * k;
  const smooth = (k) => k * k * (3 - 2 * k);

  /* ───────── 정점 버퍼 ───────── */
  let mesh = new Float32Array(STRIDE * 30000);
  let mn = 0;
  let glow = new Float32Array(STRIDE * 3000);
  let gn = 0;
  let shad = new Float32Array(6 * 6 * 80);
  let sn = 0;
  function grow(arr, need) {
    if (need <= arr.length) return arr;
    const n = new Float32Array(Math.max(need, arr.length * 2));
    n.set(arr);
    return n;
  }

  /* 색: '#rrggbb' → [r,g,b] (캐시) */
  const HEX = {};
  function hx(c) {
    if (Array.isArray(c)) return c;
    let v = HEX[c];
    if (!v) {
      const n = parseInt(c.slice(1), 16);
      v = HEX[c] = [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
    }
    return v;
  }

  /* ───────── 변환 (3x3 + 이동, 열 우선) ───────── */
  let Mx = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];
  const stack = [];
  const push = () => stack.push(Mx.slice());
  const pop = () => { Mx = stack.pop(); };
  function tr(x, y, z) {
    const m = Mx;
    m[9] += m[0] * x + m[3] * y + m[6] * z;
    m[10] += m[1] * x + m[4] * y + m[7] * z;
    m[11] += m[2] * x + m[5] * y + m[8] * z;
  }
  function mulRot(r) {
    const m = Mx;
    const o0 = m[0] * r[0] + m[3] * r[1] + m[6] * r[2];
    const o1 = m[1] * r[0] + m[4] * r[1] + m[7] * r[2];
    const o2 = m[2] * r[0] + m[5] * r[1] + m[8] * r[2];
    const o3 = m[0] * r[3] + m[3] * r[4] + m[6] * r[5];
    const o4 = m[1] * r[3] + m[4] * r[4] + m[7] * r[5];
    const o5 = m[2] * r[3] + m[5] * r[4] + m[8] * r[5];
    const o6 = m[0] * r[6] + m[3] * r[7] + m[6] * r[8];
    const o7 = m[1] * r[6] + m[4] * r[7] + m[7] * r[8];
    const o8 = m[2] * r[6] + m[5] * r[7] + m[8] * r[8];
    m[0] = o0; m[1] = o1; m[2] = o2; m[3] = o3; m[4] = o4; m[5] = o5; m[6] = o6; m[7] = o7; m[8] = o8;
  }
  /** X 축 회전: +a 는 위쪽(+Y)을 앞(+Z)으로 숙임, 아래로 늘어진 팔다리(-Y)는 뒤로 */
  function rx(a) { if (!a) return; const c = Math.cos(a), s = Math.sin(a); mulRot([1, 0, 0, 0, c, s, 0, -s, c]); }
  function ry(a) { if (!a) return; const c = Math.cos(a), s = Math.sin(a); mulRot([c, 0, -s, 0, 1, 0, s, 0, c]); }
  /** Z 축 회전: +a 는 아래로 늘어진 것(-Y)을 +X(왼쪽) 으로 */
  function rz(a) { if (!a) return; const c = Math.cos(a), s = Math.sin(a); mulRot([c, s, 0, -s, c, 0, 0, 0, 1]); }
  function sc(s) { for (let i = 0; i < 9; i++) Mx[i] *= s; }
  function ap(x, y, z) {
    const m = Mx;
    return [m[0] * x + m[3] * y + m[6] * z + m[9], m[1] * x + m[4] * y + m[7] * z + m[10], m[2] * x + m[5] * y + m[8] * z + m[11]];
  }

  /* ───────── 재질 상태 (엔티티마다) ───────── */
  let FLASH = 0; // 피격 번쩍임
  let FADE = 0; // 0 불투명 ~ 1 사라짐
  let LOD = 1; // 1: 주인공·보스(자세히), 0: 일반 적(가볍게)
  let TINT = null; // 잔상 색
  const NO = {};
  const KIND_TOON = 10;

  function vtx(p, n, col, kind, em, ea, fade) {
    const o = mn * STRIDE;
    const m = mesh;
    m[o] = p[0]; m[o + 1] = p[1]; m[o + 2] = p[2];
    m[o + 3] = 0; m[o + 4] = 0; m[o + 5] = 0;
    m[o + 6] = n[0]; m[o + 7] = n[1]; m[o + 8] = n[2];
    m[o + 9] = col[0]; m[o + 10] = col[1]; m[o + 11] = col[2]; m[o + 12] = kind;
    m[o + 13] = em[0]; m[o + 14] = em[1]; m[o + 15] = em[2]; m[o + 16] = ea;
    m[o + 17] = 0; m[o + 18] = 0; m[o + 19] = fade; m[o + 20] = 0;
    m[o + 21] = 0; m[o + 22] = 0;
    mn += 1;
  }
  const WHITE = [1, 1, 1];
  /** 재질 계산 (도형마다 한 번) */
  function matOf(col, o) {
    let kind = o.kind != null ? o.kind : KIND_TOON;
    if (kind === 6) kind = 11;
    let cc = hx(col);
    let em = o.em ? hx(o.em) : WHITE;
    let ea = o.em ? (o.ea != null ? o.ea : 1) : 0;
    if (kind === 2 && !o.em) { em = cc; ea = o.ea != null ? o.ea : 1.2; }
    if (TINT) { cc = [cc[0] * 0.2, cc[1] * 0.2, cc[2] * 0.25]; em = TINT; ea = 0.9; kind = KIND_TOON; }
    if (FLASH > 0) { em = [lerp(em[0], 1, FLASH), lerp(em[1], 1, FLASH), lerp(em[2], 1, FLASH)]; ea = Math.max(ea, FLASH * 1.3); if (kind !== 2) kind = KIND_TOON; }
    return { cc, kind, em, ea, fade: Math.min(1, FADE + (o.fade || 0)) };
  }
  function faceN(a, b, d) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    return [nx / l, ny / l, nz / l];
  }
  /** 사각형 (ns: 꼭짓점별 법선 4개, 없으면 면 법선) */
  function quadM(a, b, c, d, m, ns) {
    if (mn + 6 > mesh.length / STRIDE) mesh = grow(mesh, (mn + 2000) * STRIDE);
    let na, nb, nc, nd;
    if (ns) { na = ns[0]; nb = ns[1]; nc = ns[2]; nd = ns[3]; } else { na = nb = nc = nd = faceN(a, b, d[0] === c[0] && d[1] === c[1] && d[2] === c[2] ? c : d); }
    vtx(a, na, m.cc, m.kind, m.em, m.ea, m.fade); vtx(b, nb, m.cc, m.kind, m.em, m.ea, m.fade); vtx(c, nc, m.cc, m.kind, m.em, m.ea, m.fade);
    vtx(a, na, m.cc, m.kind, m.em, m.ea, m.fade); vtx(c, nc, m.cc, m.kind, m.em, m.ea, m.fade); vtx(d, nd, m.cc, m.kind, m.em, m.ea, m.fade);
  }
  /** 삼각형 (정점 3개) */
  function triM(a, b, c, m) {
    if (mn + 3 > mesh.length / STRIDE) mesh = grow(mesh, (mn + 2000) * STRIDE);
    const n = faceN(a, b, c);
    vtx(a, n, m.cc, m.kind, m.em, m.ea, m.fade); vtx(b, n, m.cc, m.kind, m.em, m.ea, m.fade); vtx(c, n, m.cc, m.kind, m.em, m.ea, m.fade);
  }
  function quad(a, b, c, d, col, o) { quadM(a, b, c, d, matOf(col, o || NO)); }
  function tri(a, b, c, col, o) { triM(a, b, c, matOf(col, o || NO)); }
  /** 현재 좌표계의 방향 → 세계 방향 (정규화) */
  function apN(x, y, z) {
    const m = Mx;
    const vx = m[0] * x + m[3] * y + m[6] * z, vy = m[1] * x + m[4] * y + m[7] * z, vz = m[2] * x + m[5] * y + m[8] * z;
    const l = Math.hypot(vx, vy, vz) || 1;
    return [vx / l, vy / l, vz / l];
  }

  /**
   * 상자 (현재 원점 기준). o: { x, y, z: 중심 이동, tb: 아랫면 배율, tt: 윗면 배율, kind, em, ea, fade }
   */
  const FACES = [
    [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]], [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]],
    [[1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1]], [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]],
    [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]], [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]],
  ];
  function box(w, h, d, col, o) {
    o = o || NO;
    const m = matOf(col, o);
    const hw = w / 2, hh = h / 2, hd = d / 2;
    const tb = o.tb != null ? o.tb : 1, tt = o.tt != null ? o.tt : 1;
    const ox = o.x || 0, oy = o.y || 0, oz = o.z || 0;
    // 꼭짓점 8개를 한 번만 계산 (인덱스: x,y,z 부호 비트)
    const C = BOXC;
    for (let i = 0; i < 8; i++) {
      const sxv = i & 1 ? 1 : -1, syv = i & 2 ? 1 : -1, szv = i & 4 ? 1 : -1;
      const k = syv > 0 ? tt : tb;
      C[i] = ap(ox + sxv * hw * k, oy + syv * hh, oz + szv * hd * k);
    }
    for (const f of FACES_I) quadM(C[f[0]], C[f[1]], C[f[2]], C[f[3]], m);
  }
  const BOXC = new Array(8);
  const FACES_I = FACES.map((f) => f.map((v) => (v[0] > 0 ? 1 : 0) | (v[1] > 0 ? 2 : 0) | (v[2] > 0 ? 4 : 0)));
  /** Y 축 각기둥 (n 각). r0 아래 반지름, r1 위 반지름. 8각 이상은 부드러운 법선 (o.flat 으로 끔) */
  function prism(r0, r1, h, n, col, o) {
    o = o || NO;
    const m = matOf(col, o);
    const oy = o.y || 0, ox = o.x || 0, oz = o.z || 0, ph = o.ph || 0;
    const sx = o.sx || 1, sz = o.sz || 1;
    const y0 = oy - h / 2, y1 = oy + h / 2;
    if (LOD === 0 && n > 6) n = 6;
    const smooth = !o.flat && n >= 6;
    const slope = (r0 - r1) / (h || 1);
    const pts0 = [], pts1 = [], nrm = [];
    for (let i = 0; i <= n; i++) {
      const a = ph + (i / n) * TAU;
      const c = Math.cos(a), s = Math.sin(a);
      pts0.push(ap(ox + c * sx * r0, y0, oz + s * sz * r0));
      pts1.push(ap(ox + c * sx * r1, y1, oz + s * sz * r1));
      if (smooth) nrm.push(apN(c / sx, slope, s / sz));
    }
    for (let i = 0; i < n; i++) quadM(pts0[i + 1], pts0[i], pts1[i], pts1[i + 1], m, smooth ? [nrm[i + 1], nrm[i], nrm[i], nrm[i + 1]] : null);
    if (!o.open) {
      const c1 = ap(ox, y1, oz), c0 = ap(ox, y0, oz);
      for (let i = 0; i < n; i++) { if (r1 > 0.01) triM(pts1[i + 1], pts1[i], c1, m); if (r0 > 0.01) triM(pts0[i], pts0[i + 1], c0, m); }
    }
  }
  /** 팔다리: 원점에서 아래(-Y)로 h 만큼 내려가는 둥근 기둥 (r0 위, r1 아래) */
  function limb(r0, r1, h, col, o) {
    prism(r1, r0, h, LOD > 0 ? 10 : 6, col, Object.assign({ y: -h / 2, ph: Math.PI / 8, open: true }, o || NO));
  }

  /** 공 (위도 rings, 경도 n) — 부드러운 법선 */
  function ball(r, col, o, n, rings) {
    o = o || NO;
    const m = matOf(col, o);
    n = n || 8;
    rings = rings || 4;
    if (LOD === 0) { n = Math.min(n, 6); rings = Math.min(rings, 3); }
    const ox = o.x || 0, oy = o.y || 0, oz = o.z || 0;
    const sy = o.sy || 1, sx = o.sx || 1, sz = o.sz || 1;
    const th1 = o.half ? Math.PI * o.half : Math.PI;
    const P = (i, j) => {
      const th = (j / rings) * th1;
      const a = (i / n) * TAU;
      return ap(ox + Math.sin(th) * Math.cos(a) * r * sx, oy + Math.cos(th) * r * sy, oz + Math.sin(th) * Math.sin(a) * r * sz);
    };
    const N = (i, j) => {
      const th = (j / rings) * th1;
      const a = (i / n) * TAU;
      return apN(Math.sin(th) * Math.cos(a) / sx, Math.cos(th) / sy, Math.sin(th) * Math.sin(a) / sz);
    };
    for (let j = 0; j < rings; j++) {
      for (let i = 0; i < n; i++) {
        if (j === 0 && !o.half) { // 꼭대기는 삼각형
          const a = P(i + 1, 1), b = P(i, 1), c = P(i, 0);
          if (mn + 3 > mesh.length / STRIDE) mesh = grow(mesh, (mn + 2000) * STRIDE);
          if (o.flat) triM(a, b, c, m); else { vtx(a, N(i + 1, 1), m.cc, m.kind, m.em, m.ea, m.fade); vtx(b, N(i, 1), m.cc, m.kind, m.em, m.ea, m.fade); vtx(c, N(i, 0), m.cc, m.kind, m.em, m.ea, m.fade); }
          continue;
        }
        quadM(P(i + 1, j + 1), P(i, j + 1), P(i, j), P(i + 1, j), m, o.flat ? null : [N(i + 1, j + 1), N(i, j + 1), N(i, j), N(i + 1, j)]);
      }
    }
  }
  /** 고리 (XZ 평면, 반지름 R, 단면 t) */
  function ring(R, t, n, col, o) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      push();
      tr(Math.cos(a) * R, 0, Math.sin(a) * R);
      ry(-a);
      box(t, t, TAU * R / n * 1.04, col, o);
      pop();
    }
  }
  /**
   * 머리카락 다발: 원점에서 아래(-Y)로 len 만큼, segs 마디로 휘어 내려가며 가늘어짐.
   * bx: 앞뒤로 휘는 정도(+ 는 뒤로), bz: 옆으로 휘는 정도, d: 두께 비율
   */
  function strand(len, w, segs, bx, bz, col, o, d) {
    const sl = len / segs;
    const oo = Object.assign({ sz: d || 0.55, open: true, ph: Math.PI / 4, y: -sl / 2, flat: LOD === 0 }, o || NO);
    push();
    for (let i = 0; i < segs; i++) {
      const k0 = 1 - i / segs;
      const k1 = Math.max(0.06, 1 - (i + 1) / segs);
      rx(bx / segs);
      rz(bz / segs);
      prism(w * k1, w * k0, sl * 1.04, LOD > 0 ? 5 : 4, col, oo);
      tr(0, -sl, 0);
    }
    pop();
  }
  /** 얇은 빛 줄 (회로 무늬) — 현재 좌표계의 a → b */
  function line(a, b, w, col, ea) {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
    const L = Math.hypot(dx, dy, dz) || 1;
    push();
    tr((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
    ry(Math.atan2(dx, dz));
    rx(-Math.atan2(dy, Math.hypot(dx, dz)));
    box(w, w, L, col, { kind: 2, ea: ea != null ? ea : 1.2 });
    pop();
  }

  /* ───────── 빛 (더하기) — 카메라를 향한 판 ───────── */
  let camR = [1, 0, 0];
  let camU = [0, 1, 0];
  function glowAt(p, size, color, strength, kind) {
    if (gn + 6 > glow.length / STRIDE) glow = grow(glow, (gn + 300) * STRIDE);
    const c = hx(color);
    const s2 = size / 2;
    const k = kind != null ? kind : 1;
    const corner = (u, v) => [p[0] + camR[0] * u * s2 + camU[0] * v * s2, p[1] + camR[1] * u * s2 + camU[1] * v * s2, p[2] + camR[2] * u * s2 + camU[2] * v * s2];
    const pts = [[corner(-1, -1), 0, 0], [corner(1, -1), 1, 0], [corner(1, 1), 1, 1], [corner(-1, -1), 0, 0], [corner(1, 1), 1, 1], [corner(-1, 1), 0, 1]];
    const st = strength * (1 - FADE);
    for (const [q, u, v] of pts) {
      const o = gn * STRIDE;
      const g = glow;
      g[o] = q[0]; g[o + 1] = q[1]; g[o + 2] = q[2];
      g[o + 3] = 0; g[o + 4] = 0; g[o + 5] = 0;
      g[o + 6] = 0; g[o + 7] = 0; g[o + 8] = 1;
      g[o + 9] = 0; g[o + 10] = 0; g[o + 11] = 0; g[o + 12] = k;
      g[o + 13] = c[0]; g[o + 14] = c[1]; g[o + 15] = c[2]; g[o + 16] = st;
      g[o + 17] = 0; g[o + 18] = 0; g[o + 19] = 0; g[o + 20] = 0;
      g[o + 21] = u; g[o + 22] = v;
      gn += 1;
    }
  }
  /** 현재 좌표계 안의 점에 빛 */
  const glowL = (x, y, z, size, color, strength, kind) => glowAt(ap(x, y, z), size, color, strength, kind);

  function shadowAt(x, y, z, r, a) {
    if (sn + 6 > shad.length / 6) shad = grow(shad, (sn + 60) * 6);
    const pts = [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]];
    for (const [u, v] of pts) {
      const o = sn * 6;
      shad[o] = x + u * r; shad[o + 1] = z + 1.6; shad[o + 2] = y + v * r;
      shad[o + 3] = u; shad[o + 4] = v; shad[o + 5] = a;
      sn += 1;
    }
  }

  /* =========================================================
   * 사람형 리그 — 카이온 · 제로 · 집행 병사 · 저격 유닛 · 아르카
   * 키 76 (발 0, 엉덩이 38, 어깨 57, 머리 가운데 67)
   * ========================================================= */
  function basePose() {
    return {
      lift: 0, crouch: 0, lean: 0, twist: 0, tilt: 0, fall: 0,
      legL: 0.05, legR: -0.05, kneeL: 0.12, kneeR: 0.12, spread: 0.06,
      shL: [0, 0.18, 0.14], shR: [0, 0.22, 0.14], elbL: 0.3, elbR: 0.45, wpR: 1.25, wpL: 1.2,
      headYaw: 0, headPitch: 0, flow: 0.15, glowHand: 0, castCol: null, wI: 1, eye: 1,
    };
  }

  function weapon(type, col, P, side, len) {
    const c = col || '#5fd4ff';
    push();
    rx(-(side === 1 ? P.wpL : P.wpR));
    const I = P.wI;
    switch (type) {
      case 'great': {
        prism(1.5, 1.5, 9, 8, '#1a1c24', { y: 1.5 });
        box(15, 2.6, 4.4, '#9aa6ba', { y: -4, kind: 6, tb: 0.8 });
        box(4, 4, 4.6, c, { kind: 2, y: -4, ea: 1.3 * I });
        box(9.6, 60, 2.2, '#2c3242', { y: -35, kind: 6, tb: 0.5 });
        box(4, 56, 2.6, '#454e64', { y: -34, kind: 6, tb: 0.4 });
        box(1.2, 60, 2.6, c, { kind: 2, x: 4.8, y: -35, ea: 1.3 * I, tb: 0.4 });
        box(1.2, 60, 2.6, c, { kind: 2, x: -4.8, y: -35, ea: 1.3 * I, tb: 0.4 });
        for (let k = 0; k < 4; k++) glowL(0, -14 - k * 14, 0, 22, c, 0.5 * I);
        break;
      }
      case 'spear': {
        prism(1, 1, 96, 8, '#2a2e3a', { y: -18, kind: 6 });
        for (let k = 0; k < 3; k++) prism(1.3, 1.3, 2, 8, '#9aa6ba', { y: 8 - k * 18, kind: 6 });
        box(5, 18, 1.4, c, { kind: 2, y: -75, tb: 0.05, ea: 1.4 * I });
        box(1.6, 14, 1.8, '#ffffff', { kind: 2, y: -73, tb: 0.1, ea: 1.8 * I });
        box(8, 2.4, 3, '#9aa6ba', { y: -64, kind: 6 });
        glowL(0, -74, 0, 26, c, 0.7 * I);
        break;
      }
      case 'rail': {
        box(5.4, 30, 7, '#262a34', { y: -10, kind: 6 });
        box(6, 12, 3, '#9aa6ba', { y: -8, z: 3, kind: 6 });
        prism(1.6, 1.6, 26, 8, '#3a3e4a', { y: -36, kind: 6 });
        box(1.4, 26, 1.4, c, { kind: 2, x: 2.2, y: -36, ea: 1.2 * I });
        box(5, 7, 4, '#1c1e26', { y: 6, z: -2 });
        box(2.6, 6, 2.6, c, { kind: 2, y: -2, z: 4.2, ea: 1.0 * I });
        glowL(0, -50, 0, 18, c, 0.6 * I);
        break;
      }
      case 'rifle': {
        box(4, 24, 6, '#20242e', { y: -8, kind: 6 });
        box(4.4, 6, 4, '#3a4256', { y: -2, z: 3.6, kind: 6 });
        prism(1.1, 1.1, 16, 6, '#2e323c', { y: -27, kind: 6 });
        box(1, 3, 1, c, { kind: 2, y: -36, ea: 1.4 });
        break;
      }
      case 'longrifle': {
        box(4, 30, 6, '#2a2520', { y: -10, kind: 6 });
        prism(1, 1, 34, 6, '#3a342e', { y: -42, kind: 6 });
        prism(1.8, 1.8, 10, 8, '#1a1816', { y: -8, z: 4.6, kind: 6 });
        box(1, 3, 1, c, { kind: 2, y: -60, ea: 1.6 });
        break;
      }
      case 'crystal': {
        // 제로의 붉은 결정 검: 들쭉날쭉한 결정 조각이 이어진 칼날
        prism(1.4, 1.4, 9, 8, '#140c12', { y: 1.5 });
        box(10, 2.2, 3.6, '#2a1218', { y: -3.4, kind: 6, tb: 0.6 });
        const L = len || 54;
        const n = 6;
        for (let k = 0; k < n; k++) {
          const y = -6 - (k + 0.5) * (L / n);
          push();
          tr((k % 2 ? 0.8 : -0.8), y, 0);
          rz((k % 2 ? 0.18 : -0.15));
          box(2.6 + (n - k) * 0.25, L / n * 1.35, 3.2, c, { kind: 2, ea: 1.5 * I, tb: 0.35, tt: 0.6 });
          box(1, L / n * 1.1, 3.4, '#ffd0d8', { kind: 2, ea: 1.8 * I, tb: 0.3 });
          pop();
          glowL(0, y, 0, 18, c, 0.55 * I);
        }
        push(); tr(1.6, -16, 0); rz(-0.7); box(1.6, 8, 2, c, { kind: 2, y: -4, ea: 1.4 * I, tb: 0.1 }); pop();
        break;
      }
      default: {
        // 에너지 검: 은색 손잡이와 날밑, 하얀 심 + 푸른 빛 날
        const L = len || 48;
        prism(1.25, 1.25, 9, 8, '#1a1e2a', { y: 1.5 });
        prism(1.6, 1.6, 1.4, 8, '#b4c0d4', { y: 6, kind: 6 });
        box(10, 1.8, 3.6, '#b4c0d4', { y: -3.4, kind: 6, tb: 0.7 });
        box(3, 2.4, 4, c, { kind: 2, y: -3.4, ea: 1.4 * I });
        box(1.5, L, 4.2, c, { kind: 2, y: -4.5 - L / 2, ea: 1.2 * I, tb: 0.3 });
        box(0.7, L * 0.94, 1.8, '#f0fbff', { kind: 2, y: -4.5 - L / 2, ea: 1.8 * I, tb: 0.2 });
        const n = Math.max(2, Math.round(L / 13));
        for (let k = 0; k < n; k++) glowL(0, -8 - (k + 0.5) * (L / n), 0, 16, c, 0.55 * I);
      }
    }
    pop();
  }

  /* ───────── 얼굴 (머리 좌표: 가운데 0, 앞 +Z, 반지름 약 5.4) ───────── */
  function face(S, P) {
    const sk = S.skin;
    ball(5.4, sk, { sy: 1.08, sz: 1.0 }, 10, 7);
    ball(3.9, sk, { y: -2.7, z: 0.55, sx: 0.92, sy: 0.98 }, 8, 5);
    box(1.2, 2.4, 1.4, sk, { x: 5.2, y: -0.3, z: -0.4 });
    box(1.2, 2.4, 1.4, sk, { x: -5.2, y: -0.3, z: -0.4 });
    if (S.mask) {
      box(8.2, 3.2, 3.2, S.mask, { y: -3.7, z: 3.4, kind: 6, tb: 0.7 });
      box(5.4, 0.5, 0.6, S.trim, { kind: 2, y: -3.3, z: 5.05, ea: 1.4 });
    } else {
      box(0.5, 0.6, 0.4, sk, { y: -1.7, z: 5.25, kind: 12 });
      box(1.3, 0.28, 0.3, '#8a5a60', { y: -3.6, z: 4.6, kind: 12 });
    }
    const E = P.eye;
    if (LOD === 0) {
      for (const sd of [1, -1]) box(1.8, 1.8, 0.5, S.eye, { kind: 2, x: sd * 2.05, z: 5.05, ea: 1.2 * E });
      return;
    }
    if (S.eyesClosed) {
      for (const sd of [1, -1]) {
        push(); tr(sd * 2.15, -0.2, 5.05); rz(sd * -0.18); box(2.6, 0.4, 0.5, '#2a2440', { kind: 12 }); pop();
        push(); tr(sd * 2.2, 1.7, 5.0); rz(sd * 0.1); box(2.6, 0.35, 0.5, S.hairDk || '#888', { kind: 12 }); pop();
      }
      return;
    }
    for (const sd of [1, -1]) {
      // 동그란 눈: 흰자 위에 큰 홍채, 동공, 반짝임, 위 속눈썹
      ball(1.25, '#e4e8f4', { x: sd * 2.15, y: 0, z: 4.75, sx: 0.95, sy: 0.72, sz: 0.4, kind: 12 }, 8, 4);
      ball(0.98, S.eye, { x: sd * 2.05, y: -0.08, z: 4.98, sx: 0.85, sy: 1.0, sz: 0.3, kind: 2, ea: 1.15 * E }, 8, 4);
      ball(0.42, '#0a0e1a', { x: sd * 2.05, y: -0.12, z: 5.22, sx: 0.8, sy: 1.1, sz: 0.3, kind: 12 }, 6, 3);
      box(0.4, 0.4, 0.4, '#ffffff', { kind: 2, x: sd * 2.38, y: 0.42, z: 5.3, ea: 2 });
      push(); tr(sd * 2.15, 0.95, 5.0); rz(sd * -0.12); box(2.8, 0.42, 0.5, '#10121c', { kind: 12 }); pop();
      push();
      tr(sd * 2.2, 1.85, 5.0);
      rz(sd * (S.browAngle != null ? S.browAngle : 0.12));
      box(2.8, 0.45, 0.5, S.brow || S.hair || '#222', { kind: 12 });
      pop();
    }
    if (E > 1.2) { glowL(2.1, 0.1, 6, 8, S.eye, 0.5 * E); glowL(-2.1, 0.1, 6, 8, S.eye, 0.5 * E); }
  }

  /* ───────── 머리카락 ───────── */
  let TIME = 0;
  function lock(x, y, z, ax, az, L, w, segs, bx, bz, col) {
    push();
    tr(x, y, z);
    if (ax) rx(ax);
    if (az) rz(az);
    strand(L, w, segs, bx, bz, col);
    pop();
  }
  function hairKai(S) {
    const h = S.hair, hi = S.hairHi, dk = S.hairDk || h;
    ball(6.0, h, { y: 1.3, z: -0.5, half: 0.5 }, 10, 4);
    ball(5.8, dk, { y: -0.3, z: -1.6, sy: 1.05 }, 8, 5);
    // 앞머리: 이마를 덮고 눈썹까지 흘러내림 (오른쪽으로 쏠림)
    const bangs = [[-4.4, 0.45, 6.4], [-2.6, 0.22, 7.6], [-0.8, 0.05, 6.8], [1.0, -0.12, 8], [2.8, -0.28, 7], [4.5, -0.5, 6]];
    bangs.forEach(([x, a, L], i) => lock(x, 4.6, 4.0, -0.62, a, L, 1.9, 3, 0.9, a * 0.7, i % 3 === 1 ? hi : h));
    // 옆머리: 귀를 덮고 바깥으로 삐침
    for (const sd of [1, -1]) {
      lock(sd * 5.4, 2.8, 1.8, -0.12, sd * 0.32, 10.5, 1.8, 3, 0.25, sd * -0.25, h);
      lock(sd * 5.6, 3.4, -0.6, 0.05, sd * 0.62, 9, 1.9, 3, 0.2, sd * -0.35, dk);
      lock(sd * 5.0, 2.4, -2.8, 0.25, sd * 0.45, 9.5, 2.0, 3, 0.3, sd * 0.1, h);
    }
    // 정수리: 위로 솟았다가 사방으로 넘어가는 헝클어진 다발
    const top = [[-2.8, 1.2, -0.4, 0.55], [0, 1.8, 0.5, 0], [2.6, 1.2, -0.4, -0.55], [-1.6, -1.2, -0.85, 0.5], [1.6, -1.2, -0.8, -0.5], [0, -2.4, -1.1, 0.1], [-3.6, -0.6, -0.6, 0.9], [3.6, -0.6, -0.6, -0.9]];
    top.forEach(([x, z, ax, az], i) => lock(x, 5.7, z, Math.PI / 2 + 0.35 - ax * 0.4, az, 7.8, 2.4, 3, 0.9, az * 0.9, i % 3 === 1 ? hi : i % 3 === 2 ? dk : h));
    // 뒷머리 (목덜미로 길게 삐침)
    for (let i = 0; i < 7; i++) {
      const x = -4.8 + i * 1.6;
      lock(x, 1.6 - Math.abs(x) * 0.15, -5.0, 0.45, x * 0.09, 9.5 + (i % 2) * 2, 2.1, 3, 0.4, x * 0.05, i % 2 ? dk : h);
    }
    // 바보털
    lock(0.6, 6.3, 0.8, Math.PI - 0.5, 0.2, 3.6, 0.6, 3, -1.6, 0.4, h);
  }
  function hairZero(S) {
    const h = S.hair, hi = S.hairHi, dk = S.hairDk || h;
    ball(6.1, h, { y: 1.3, z: -0.4, half: 0.5 }, 10, 4);
    ball(5.9, dk, { y: -0.3, z: -1.5, sy: 1.05 }, 8, 5);
    // 사방으로 뻗친 거친 붉은 머리 (뒤로 넘어가며 크게 펼쳐짐)
    const spikes = [
      [0, 6, 1, Math.PI - 0.95, 0, 10, 2.7], [2.6, 5.6, 0.6, Math.PI - 0.9, -0.7, 11, 2.6], [-2.6, 5.6, 0.6, Math.PI - 0.9, 0.7, 11, 2.6],
      [4.4, 4.2, -0.6, Math.PI - 1.2, -1.0, 11.5, 2.5], [-4.4, 4.2, -0.6, Math.PI - 1.2, 1.0, 11.5, 2.5], [0, 5, -3, Math.PI - 1.45, 0, 13, 2.7],
      [2.8, 3.6, -4, Math.PI - 1.85, -0.5, 13, 2.5], [-2.8, 3.6, -4, Math.PI - 1.85, 0.5, 13, 2.5], [0, 1.5, -5.2, 0.85, 0, 12, 2.5],
      [3.8, 0.8, -4.2, 0.65, -0.7, 11, 2.3], [-3.8, 0.8, -4.2, 0.65, 0.7, 11, 2.3], [5.2, 2, -2, 0.2, -1.1, 10, 2.2], [-5.2, 2, -2, 0.2, 1.1, 10, 2.2],
    ];
    spikes.forEach(([x, y, z, ax, az, L, w], i) => lock(x, y, z, ax, az, L, w, 3, -0.45, az * 0.45, i % 4 === 0 ? hi : i % 3 === 0 ? dk : h));
    const bangs = [[-3.8, 0.55, 7.5], [-1.6, 0.18, 9], [0.8, -0.18, 8.5], [3.4, -0.55, 7.5]];
    bangs.forEach(([x, a, L], i) => lock(x, 4.6, 4.1, -0.85, a, L, 2.1, 3, 1.05, a * 0.6, i === 1 ? hi : h));
    for (const sd of [1, -1]) lock(sd * 5.5, 2.6, 1.2, -0.1, sd * 0.45, 10, 1.9, 3, 0.2, sd * 0.3, h);
  }
  function hairOther(S) {
    if (S.hairStyle === 'helmet') {
      ball(6.5, S.helm, { y: 0.8, kind: 6, sy: 1.05 }, 10, 6);
      box(11.6, 2.6, 2.4, '#0c1018', { y: 0.2, z: 5.6 });
      box(10.6, 1.4, 1, S.eye, { kind: 2, y: 0.4, z: 6.7, ea: 1.5 });
      box(3, 6, 9, S.helmHi || S.helm, { y: 6.2, z: -1, kind: 6, tt: 0.6 });
      for (const sd of [1, -1]) box(1.6, 5, 5, S.helmHi || S.helm, { x: sd * 6.4, y: -0.5, kind: 6 });
      return;
    }
    if (S.hairStyle === 'hood') {
      ball(6.9, S.coat, { y: 0.9, z: -0.8, sy: 1.08, half: 0.7 }, 10, 6);
      box(10, 5, 2, '#0a0a0c', { y: -0.4, z: 5.6 });
      box(7, 1.1, 1, S.eye, { kind: 2, y: 0.5, z: 6.7, ea: 1.7 });
      box(13, 6, 9, S.coat, { y: -4, z: -2.2, tb: 1.25 });
      return;
    }
    if (S.hairStyle === 'knight') {
      ball(7.4, S.helm, { y: 1, kind: 6, sy: 1.1 }, 12, 6);
      box(13, 7, 4, S.helm, { y: -2.5, z: 5, kind: 6, tb: 0.6 });
      box(12, 1.8, 1.4, S.eye, { kind: 2, y: 1, z: 7.4, ea: 1.7 });
      box(2.4, 1.6, 6, S.eye, { kind: 2, y: 4.4, z: 5.4, ea: 1.2 });
      for (let k = 0; k < 4; k++) lock(0, 7 - k * 0.6, 1 - k * 3, Math.PI - 0.4 - k * 0.3, 0, 9 - k, 1.8, 3, -0.5, 0, S.crest || S.trim);
      for (const sd of [1, -1]) { push(); tr(sd * 6.6, 3, -1); rz(-sd * 0.5); box(1.4, 9, 3, S.helmHi || S.helm, { y: 4, kind: 6, tt: 0.2 }); pop(); }
    }
  }

  function head(S, P) {
    push();
    tr(0, 22.6, 0.3);
    prism(2.4, 2.15, 5, 10, S.skin, { y: 2.2 });
    tr(0, 4.6, 0);
    ry(P.headYaw);
    rx(P.headPitch);
    tr(0, 5, 0.3);
    sc(S.headScale || 1.12);
    if (S.hairStyle === 'kai' || S.hairStyle === 'zero') {
      face(S, P);
      if (S.hairStyle === 'kai') hairKai(S); else hairZero(S);
    } else {
      if (S.hairStyle !== 'knight' && S.hairStyle !== 'helmet') face(S, P);
      hairOther(S);
    }
    pop();
  }

  /** 팔 (side: +1 왼쪽, -1 오른쪽) */
  function arm(S, P, side, wpn) {
    const sh = side === 1 ? P.shL : P.shR;
    push();
    tr(side * 8.5, 19.6, 0);
    ry(sh[0]);
    rx(-sh[1]);
    rz(side * sh[2]);
    ball(3.1, S.sleeve || S.coat, { y: -0.4 }, 8, 4);
    // 어깨 갑옷
    if (S.pauldronR && side === -1) {
      push();
      tr(0, 1.2, 0);
      rz(-0.25);
      ball(5.7, S.pauldronR, { sy: 0.7, half: 0.6, kind: 6 }, 12, 5);
      prism(5.9, 5.5, 2.4, 12, S.pauldronR, { y: -1.4, kind: 6, open: true });
      prism(5.5, 5.0, 2.2, 12, S.pauldronD || S.pauldronR, { y: -3.5, x: -0.3, kind: 6, open: true });
      prism(5.0, 4.4, 2, 12, S.pauldronR, { y: -5.5, x: -0.6, kind: 6, open: true });
      prism(5.95, 5.95, 0.5, 12, S.trim, { kind: 2, y: -0.25, ea: 1.1, open: true });
      box(1.6, 1.6, 1.2, S.trim, { kind: 2, y: 2.4, z: 3.6, ea: 1.3 });
      pop();
    } else if (S.pauldron) {
      push(); tr(0, 1, 0); ball(4.6, S.pauldron, { sy: 0.7, half: 0.62, kind: 6 }, 10, 4); box(8.4, 2.2, 8.6, S.pauldron, { y: -1.6, kind: 6, tb: 1.1 }); pop();
    }
    if (S.crystals && side === 1) {
      for (let k = 0; k < 4; k++) { push(); tr(0.5 + k * 0.6, 3, -1 + k * 1.4); rz(-0.4 - k * 0.25); rx(-0.4 + k * 0.3); box(2.2, 6 + k * 1.6, 2.2, S.trim, { kind: 2, y: 3 + k, ea: 1.5, tt: 0.05 }); pop(); }
      glowL(0, 6, 0, 22, S.trim, 0.5);
    }
    limb(2.8, 2.35, 14, S.sleeve || S.coat);
    if (S.trim && S.sleeveTrim !== false) {
      prism(2.6, 2.6, 1.1, 10, S.trim, { kind: 2, y: -12.6, ea: 0.9, open: true });
      line([side * 2.9, -2, 0.6], [side * 2.4, -11, 1.2], 0.45, S.trim, 1.0);
    }
    if (S.cracks) { line([side * 2.4, -3, 2.2], [side * 1.6, -7, 2.6], 0.5, S.trim, 1.5); line([side * 1.6, -7, 2.6], [side * 2.6, -11, 2.0], 0.5, S.trim, 1.5); }
    tr(0, -13.6, 0);
    ball(2.3, S.sleeve || S.coat, {}, 8, 4);
    rx(-(side === 1 ? P.elbL : P.elbR));
    limb(2.4, 2.0, 13, S.glove || S.coat);
    if (S.gauntlet) {
      box(4.0, 7.5, 2, S.gauntlet, { y: -6.6, z: 1.7, kind: 6, tb: 0.85 });
      box(0.5, 6.5, 0.5, S.trim, { kind: 2, y: -6.6, z: 3.1, ea: 1.2 });
    }
    tr(0, -13, 0);
    box(3.7, 4.2, 4, S.hand || S.glove || S.skin, { y: -1.7, tb: 0.75 });
    box(1.2, 3, 1.4, S.hand || S.glove || S.skin, { x: side * 1.8, y: -1.1, z: 1.5 });
    if (P.glowHand && (side === -1 || P.glowBoth)) glowL(0, -2, 2, 26 * P.glowHand, P.castCol || S.trim, 0.9 * P.glowHand);
    if (wpn) weapon(wpn.type, wpn.color, P, side, wpn.len);
    pop();
  }

  /** 다리 */
  function leg(S, P, side) {
    const sw = side === 1 ? P.legL : P.legR;
    const kn = side === 1 ? P.kneeL : P.kneeR;
    push();
    tr(side * 3.9, -1, 0);
    rz(side * P.spread);
    rx(-sw);
    ball(3.5, S.pants, { y: 0.2 }, 8, 4);
    limb(3.5, 2.7, 18.5, S.pants);
    if (S.thighStrap) prism(3.2, 3.2, 1.2, 10, S.thighStrap, { y: -9, kind: 6, open: true });
    tr(0, -18.3, 0);
    rx(kn);
    ball(2.7, S.pants, {}, 8, 4);
    if (S.knee) { push(); tr(0, -0.3, 2.3); box(4.8, 5.2, 2.2, S.knee, { kind: 6, tb: 0.75, tt: 0.85 }); pop(); }
    limb(2.9, 2.4, 18, S.boots);
    if (S.shinPlate) {
      box(4.0, 11, 1.8, S.shinPlate, { y: -8, z: 2.2, kind: 6, tb: 0.8 });
      box(0.5, 9, 0.5, S.trim, { kind: 2, y: -8, z: 3.2, ea: 1.1 });
    }
    if (S.cracks) line([side * 1.2, -3, 2.6], [side * -0.6, -9, 2.5], 0.5, S.trim, 1.4);
    tr(0, -18, 0);
    rx(-kn * 0.3 + sw * 0.5);
    box(5.2, 4.4, 10.6, S.boots, { y: -1.3, z: 2.2, tt: 0.85 });
    box(5.4, 2, 3.6, S.toe || S.boots, { y: -2.5, z: 6.2, kind: 6 });
    if (S.trim) box(5.6, 0.7, 1.4, S.trim, { kind: 2, y: 0.9, z: 6.8, ea: 0.8 });
    pop();
  }

  /** 긴 코트 자락 (뒤 두 갈래 + 앞 두 장, 가장자리에 빛 줄) */
  function coatSkirt(S, P) {
    if (!S.coatLen) return;
    const L = S.coatLen;
    if (S.ragged) {
      // 찢어진 망토 자락 (제로)
      for (let i = 0; i < 7; i++) {
        const a = Math.PI * (0.35 + i * 0.05) * 2 - Math.PI * 0.2;
        const len = L * (0.7 + ((i * 37) % 10) / 22);
        push();
        tr(Math.cos(a) * 6.6, 3, -Math.abs(Math.sin(a)) * 5.4);
        ry(Math.PI / 2 - a);
        rx(0.12 + P.flow * (0.8 + i * 0.05) + Math.sin(TIME * 3 + i) * 0.04);
        box(4.2, len, 1.2, S.coat, { y: -len / 2, tb: 0.7 });
        box(0.5, len * 0.9, 1.4, S.trim, { kind: 2, x: 1.9, y: -len * 0.45, ea: 0.9, tb: 0.7 });
        pop();
      }
      return;
    }
    for (const sd of [1, -1]) {
      push();
      tr(sd * 3.3, 3, -4.6);
      rz(sd * 0.08);
      rx(0.12 + P.flow + Math.sin(TIME * 2.2 + sd) * 0.03);
      box(7.2, L, 1.3, S.coat, { y: -L / 2, tb: 1.22 });
      box(7.2 * 1.2, 0.8, 1.5, S.trim, { kind: 2, y: -L + 0.4, ea: 0.9 });
      box(0.6, L, 1.5, S.trim, { kind: 2, x: -sd * 3.5 * 1.1, y: -L / 2, ea: 0.7, tb: 1.2 });
      pop();
      const sw = sd === 1 ? P.legL : P.legR;
      push();
      tr(sd * 4.7, 3, 4.1);
      rz(sd * 0.16);
      rx(-Math.max(-0.2, sw) * 0.7 + P.flow * 0.3);
      box(6, L * 0.9, 1.3, S.coat, { y: -L * 0.45, tb: 1.15 });
      if (S.lining) box(5, L * 0.86, 0.4, S.lining, { y: -L * 0.45, z: -0.75, tb: 1.15 });
      box(0.7, L * 0.9, 1.5, S.trim, { kind: 2, x: -sd * 2.9, y: -L * 0.45, ea: 1.0 });
      box(6 * 1.15, 0.7, 1.5, S.trim, { kind: 2, y: -L * 0.9 + 0.3, ea: 0.9 });
      pop();
      push();
      tr(sd * 7.2, 3, 0);
      rz(sd * (0.22 + P.flow * 0.2));
      box(1.3, L * 0.92, 7.8, S.coat, { y: -L * 0.46, tb: 1.2 });
      pop();
    }
  }

  /** 몸통 (엉덩이 좌표에서) */
  function torso(S, P) {
    prism(6.0, 6.6, 8.4, 10, S.body, { y: 7.4, sz: 0.66 });
    prism(6.6, 8.2, 11, 10, S.coat, { y: 16.3, sz: 0.62 });
    prism(8.2, 5.2, 3.4, 10, S.coat, { y: 23.4, sz: 0.62 });
    if (S.chestPlate) {
      push(); tr(0, 16, 4.6); box(12.4, 8, 2.6, S.chestPlate, { kind: 6, tb: 0.8 }); box(12.6, 0.6, 2.8, S.trim, { kind: 2, y: -2, ea: 0.8 }); pop();
    }
    if (S.chestPlateR) {
      // 오른쪽 가슴 은색 갑옷 판 (원작의 비대칭 갑옷)
      push();
      tr(-3.4, 16.4, 4.3);
      ry(0.25);
      box(7.6, 8.6, 2.4, S.chestPlateR, { kind: 6, tb: 0.85 });
      box(6.8, 3, 2.6, S.pauldronD || S.chestPlateR, { y: -5, kind: 6, tb: 0.8 });
      box(7.8, 0.45, 2.6, S.trim, { kind: 2, y: 1.4, ea: 1.0 });
      pop();
    }
    if (S.trim && S.frontLines !== false) {
      // 재킷 앞자락과 회로 무늬
      line([1.6, 6.5, 5.2], [2.2, 21.5, 5.3], 0.5, S.trim, 1.1);
      line([2.2, 19.6, 5.3], [5.8, 19.2, 4.2], 0.42, S.trim, 1.0);
      line([5.8, 19.2, 4.2], [6.6, 14.5, 3.6], 0.42, S.trim, 0.9);
      line([3.4, 9, 5.0], [6.2, 9, 3.8], 0.4, S.trim, 0.8);
      if (!S.chestPlateR) line([-1.6, 6.5, 5.2], [-2.2, 21.5, 5.3], 0.5, S.trim, 1.1);
    }
    if (S.cracks) {
      const pts = [[-4.5, 21, 4.8], [-2, 17, 5.6], [-3.4, 14, 5.6], [0.6, 11, 5.6], [-0.6, 8, 5.2], [2.6, 6, 4.8]];
      for (let i = 0; i < pts.length - 1; i++) line(pts[i], pts[i + 1], 0.55, S.trim, 1.6);
      line([3, 20, 5], [5.4, 16, 4.4], 0.5, S.trim, 1.4);
    }
    if (S.highCollar) {
      // 높게 선 깃 (안쪽 가장자리에 푸른 빛)
      push();
      tr(0, 22.4, -3.4);
      rx(-0.16);
      box(11, 8, 1.3, S.collarCol || S.coat, { y: 4, tt: 1.25 });
      box(13.6, 0.7, 1.5, S.trim, { kind: 2, y: 7.9, ea: 1.2 });
      pop();
      for (const sd of [1, -1]) {
        push();
        tr(sd * 5.2, 22.4, 0.6);
        ry(sd * -0.35);
        rz(sd * -0.2);
        box(1.3, 7.4, 7, S.collarCol || S.coat, { y: 3.7, tt: 1.15 });
        box(1.5, 7, 0.6, S.trim, { kind: 2, y: 3.7, z: 3.8, ea: 1.3 });
        box(1.5, 0.6, 7.4, S.trim, { kind: 2, y: 7.3, ea: 1.1 });
        pop();
      }
    } else if (S.collar !== false) {
      prism(4.6, 5.6, 3, 10, S.coat2 || S.coat, { y: 24, sz: 0.85 });
    }
  }

  function humanoid(S, P, wpnR, wpnL) {
    push();
    tr(0, P.lift, 0);
    if (P.fall) { rx(-P.fall); }
    if (P.tilt) rz(P.tilt);
    push();
    tr(0, 40 - P.crouch, 0);
    rx(P.lean * 0.4);
    prism(6.8, 6.4, 7, 10, S.pants, { y: 1.5, sz: 0.68 });
    if (S.belt) {
      prism(7.2, 7.2, 2.0, 10, S.belt, { y: 4.4, sz: 0.7, kind: 6 });
      if (S.buckle) box(3.2, 2.4, 1, S.buckle, { y: 4.4, z: 5.5, kind: 6 });
    }
    leg(S, P, 1);
    leg(S, P, -1);
    coatSkirt(S, P);
    push();
    rx(P.lean * 0.6);
    ry(P.twist);
    torso(S, P);
    head(S, P);
    arm(S, P, 1, wpnL);
    arm(S, P, -1, wpnR);
    pop();
    pop();
    pop();
  }

  /* ───────── 스타일 (원작 그림 기준) ───────── */
  // 카이온: 검은 머리·푸른 눈, 높게 선 검은 깃에 푸른 빛 줄, 오른쪽 어깨와 가슴의 은색 갑옷
  const KAI = {
    skin: '#e6d2cf', hair: '#1d2542', hairHi: '#4a6cae', hairDk: '#121729', hairStyle: 'kai', eye: '#4cc8ff', brow: '#151a2c',
    body: '#1a2032', coat: '#141a2a', coat2: '#1e2840', collarCol: '#121828', coatLen: 24, trim: '#3fbcff', sleeve: '#151b2c', lining: '#1f3a66',
    pants: '#141a2a', boots: '#1c2232', knee: '#aeb8ca', pauldronR: '#b6c2d8', pauldronD: '#7e8aa4', chestPlateR: '#b6c2d8',
    glove: '#161c2c', gauntlet: '#9aa6bc', shinPlate: '#aeb8ca', toe: '#9aa6bc', belt: '#232a3c', buckle: '#c6d0e0', highCollar: true, browAngle: 0.18,
  };
  // 제로: 거친 붉은 머리, 붉은 균열이 빛나는 검은 갑옷, 왼쪽 어깨의 붉은 결정, 입을 가린 마스크, 찢어진 망토
  const ZERO = {
    skin: '#e2cbc8', hair: '#b8142e', hairHi: '#ff5a70', hairDk: '#6e0a1c', hairStyle: 'zero', eye: '#ff3a58', brow: '#6e0a1c',
    body: '#1a1218', coat: '#1c1218', coat2: '#2a141e', coatLen: 30, trim: '#ff2a4a', sleeve: '#1e141a', ragged: true,
    pants: '#170f14', boots: '#22161c', knee: '#3a2028', glove: '#1c1218', gauntlet: '#3a2028', shinPlate: '#3a2028', toe: '#3a2028',
    belt: '#2a1820', cracks: true, crystals: true, mask: '#1a1014', frontLines: false, sleeveTrim: false, highCollar: true, collarCol: '#1a1016', browAngle: 0.35,
  };
  const SOLDIER = {
    skin: '#c9d0e0', hairStyle: 'helmet', helm: '#283250', helmHi: '#3f4c72', eye: '#9ab0ff',
    body: '#283152', coat: '#252e4a', coat2: '#36425f', coatLen: 0, trim: '#9ab0ff', sleeve: '#252e4a', frontLines: false,
    pants: '#192036', boots: '#262d44', knee: '#3a4566', pauldron: '#4a5878', glove: '#1e2538', chestPlate: '#3a4668', belt: '#3a4566', shinPlate: '#3a4566',
  };
  const SNIPER = {
    skin: '#2a2a30', hairStyle: 'hood', eye: '#ffb35c',
    body: '#38322e', coat: '#2c2724', coat2: '#463c35', coatLen: 22, trim: '#ffb35c', sleeve: '#2c2724', frontLines: false,
    pants: '#1e1b1a', boots: '#2a2522', knee: '#3a332e', glove: '#2a2522', sleeveTrim: false, belt: '#463c35',
  };
  const ARKA = {
    skin: '#5a6a8a', hairStyle: 'knight', helm: '#6a7ea4', helmHi: '#8fa4c8', eye: '#5ff0ff', crest: '#5ff0ff',
    body: '#3a4866', coat: '#6a7ea4', coat2: '#8fa4c8', coatLen: 20, trim: '#5ff0ff', sleeve: '#5a6c90', frontLines: false,
    pants: '#3a4866', boots: '#5a6c90', knee: '#8fa4c8', pauldron: '#8fa4c8', glove: '#4a5a7a', gauntlet: '#8fa4c8', chestPlate: '#8fa4c8',
    belt: '#ffe066', shinPlate: '#8fa4c8', toe: '#8fa4c8',
  };

  /* ───────── 공격 자세 계산 ───────── */
  function atkInfo(e) {
    const st = e.st;
    if (st && st.step) {
      const dur = st.step.dur || 0.3;
      const hits = st.hits && st.hits.length ? st.hits : [st.step.hit != null ? st.step.hit : dur * 0.35];
      return { k: clamp01(st.t / dur), h: clamp01(hits[0] / dur), fx: st.step.fx || 'slashR', heavy: !!st.heavy };
    }
    if (st && st.dur) return { k: clamp01(st.t / st.dur), h: 0.25, fx: 'smash', heavy: true };
    const dur = e.anim === 'heavy' ? 0.6 : 0.32;
    return { k: clamp01((e.animT || 0) / dur), h: 0.35, fx: e.anim === 'heavy' ? 'smash' : 'slashR', heavy: e.anim === 'heavy' };
  }

  /** 휘두르기: k 진행, h 타격 순간 */
  function swing(P, A, wid) {
    const k = A.k;
    const h = Math.max(0.12, A.h);
    const wind = clamp01(k / h);
    const strike = clamp01((k - h * 0.7) / 0.28);
    const rec = clamp01((k - h - 0.3) / 0.4);
    const fx = A.fx;
    if (fx === 'smash' || (A.heavy && fx !== 'thrust' && fx !== 'shot' && fx !== 'spin')) {
      const up = easeOut(wind);
      const dn = easeIn(strike);
      P.shR = [0.15, lerp(lerp(0.4, 2.9, up), 0.75, dn), 0.12];
      P.shL = [-0.2, lerp(lerp(0.3, 2.6, up), 0.7, dn), 0.1];
      P.elbR = lerp(0.8, 0.15, strike);
      P.elbL = lerp(0.9, 0.2, strike);
      P.wpR = lerp(0.3, 1.0, dn);
      P.lean = lerp(lerp(0, -0.2, up), 0.45, dn);
      P.crouch = 7 * dn * (1 - rec * 0.6);
      P.legL = 0.45 * dn; P.legR = -0.35 * dn; P.kneeL = 0.5 * dn; P.kneeR = 0.3;
      return;
    }
    if (fx === 'thrust') {
      const pull = easeOut(wind);
      const out = easeOut(strike);
      P.shR = [0.05, lerp(0.6, 1.5, Math.max(pull * 0.6, out)), 0.1];
      P.elbR = lerp(lerp(0.4, 1.7, pull), 0.05, out);
      P.wpR = lerp(1.2, 1.55, out);
      P.shL = [-0.3, 1.2 * out, 0.1]; P.elbL = 1.0;
      P.twist = lerp(0.3 * pull, -0.25, out);
      P.lean = 0.3 * out;
      P.legL = 0.55 * out; P.legR = -0.4 * out; P.kneeL = 0.4 * out;
      return;
    }
    if (fx === 'shot' || fx === 'beam') {
      const rk = Math.sin(clamp01((k - h) / 0.25) * Math.PI);
      P.shR = [0.1, 1.5 - rk * 0.3, 0.05]; P.elbR = 0.1 + rk * 0.5; P.wpR = 1.5;
      P.shL = [-0.55, 1.45, 0.1]; P.elbL = 0.6;
      P.lean = -0.08 * rk; P.twist = -0.2;
      return;
    }
    if (fx === 'spin') {
      const a = easeOut(strike);
      P.shR = [lerp(-1.4, 4.4, a), 1.45, 0.1];
      P.shL = [lerp(1.2, 6.2, a) * 0.5, 1.3, 0.1];
      P.elbR = 0.12; P.elbL = 0.2; P.wpR = 0.25; P.wpL = 0.25;
      P.twist = lerp(-0.6, 2.4, a) * (1 - rec);
      P.crouch = 4;
      return;
    }
    // 가로베기 (slashR: 오른쪽 → 왼쪽, slashL / cross: 반대)
    const dir = fx === 'slashL' ? -1 : 1;
    const start = dir > 0 ? -1.7 : 1.35;
    const end = dir > 0 ? 1.35 : -1.7;
    const ya = lerp(lerp(-0.2, start, easeOut(wind)), end, easeOut(strike));
    P.shR = [lerp(ya, 0.2, rec), lerp(1.45, 0.5, rec), 0.15];
    P.elbR = lerp(0.18, 0.45, rec);
    P.wpR = lerp(0.2, 1.2, rec);
    P.shL = [lerp(-ya * 0.4, 0, rec), lerp(0.7, 0.2, rec), 0.3];
    P.elbL = 0.9;
    P.twist = ya * 0.38 * (1 - rec);
    P.lean = 0.18;
    P.legL = 0.35; P.legR = -0.25; P.kneeL = 0.35; P.kneeR = 0.2;
    if (wid === 'twin') { P.shL = [-ya * 0.9, 1.4, 0.15]; P.elbL = 0.2; P.wpL = 0.25; }
  }

  function runCycle(P, ph, amt) {
    const s = Math.sin(ph);
    const c = Math.cos(ph);
    P.legL = s * 0.75 * amt;
    P.legR = -s * 0.75 * amt;
    P.kneeL = 0.2 + Math.max(0, -c) * 1.1 * amt;
    P.kneeR = 0.2 + Math.max(0, c) * 1.1 * amt;
    P.shL = [0, -s * 0.65 * amt + 0.15, 0.12];
    P.shR = [0, s * 0.45 * amt + 0.25, 0.12];
    P.elbL = 0.4 + 0.3 * amt;
    P.elbR = 0.6;
    P.lean = 0.28 * amt;
    P.lift = Math.abs(Math.sin(ph)) * 2.2 * amt;
    P.flow = 0.15 + 0.55 * amt;
  }

  /** 카이온·제로·병사의 자세 */
  function manPose(e, W, t, wid) {
    const P = basePose();
    const anim = e.anim || 'idle';
    const at = e.animT || 0;
    const spd = Math.hypot(e.vx || 0, e.vy || 0);
    P.crouch = Math.sin(t * 2.4 + (e.id || 0)) * 0.5;
    P.flow = 0.15 + Math.sin(t * 1.7) * 0.05;
    if (e.dead || anim === 'dead' || (e.kind === 'ally' && e.down > 0)) {
      const a = e.deadT > 0 ? e.deadT : at + (e.down > 0 ? 9 : 0);
      const k = clamp01(a / 0.7);
      P.crouch = 6 * k;
      P.fall = easeIn(k) * 1.45;
      P.lift = 4 * k;
      P.legL = 0.6 * k; P.kneeL = 0.9 * k; P.legR = 0.2 * k; P.kneeR = 0.4 * k;
      P.shL = [0, -0.4 * k, 0.9 * k]; P.shR = [0, -0.3 * k, 0.8 * k];
      P.eye = 1 - k * 0.8;
      P.wI = 1 - k * 0.7;
      return P;
    }
    if (e.state === 'ult' && e.st) {
      const st = e.st;
      if (st.t < 0.4) {
        P.shR = [0, 3.0, 0.1]; P.elbR = 0.2; P.wpR = 0.1; P.glowHand = st.t / 0.4; P.castCol = '#ffe066'; P.eye = 1 + st.t * 3;
        P.shL = [0, 0.4, 0.5];
      } else if (st.t < 1.5) {
        const u = (st.t - 0.4) / 0.15;
        const n = Math.floor(u);
        swing(P, { k: u - n, h: 0.3, fx: n % 2 ? 'slashL' : 'slashR' }, wid);
        P.eye = 1.8;
      } else {
        P.shR = [0, 3.0, 0.1]; P.elbR = 0.2; P.wpR = 0.1; P.eye = 2; P.crouch = 2;
      }
      return P;
    }
    switch (anim) {
      case 'run':
      case 'move':
        runCycle(P, ((e.runT || 0) > 0 ? e.runT : t * 1.1) * 11, Math.min(1, spd / 160 + (anim === 'run' ? 0.5 : 0.2)));
        break;
      case 'attack':
      case 'heavy':
        swing(P, atkInfo(e), wid);
        break;
      case 'dodge': {
        const k = clamp01(at / 0.3);
        P.crouch = 9 * Math.sin(k * Math.PI) + 2;
        P.lean = 0.75 * Math.sin(k * Math.PI);
        P.legL = 0.9; P.kneeL = 1.4; P.legR = -0.7; P.kneeR = 0.7;
        P.shL = [0, -0.8, 0.3]; P.shR = [0, -0.6, 0.3]; P.elbL = 0.3; P.elbR = 0.4;
        P.flow = 1.2;
        P.wpR = 0.6;
        break;
      }
      case 'hurt': {
        const k = Math.sin(clamp01(at / 0.3) * Math.PI);
        P.lean = -0.35 * k; P.headPitch = -0.3 * k; P.crouch = 2 * k;
        P.shL = [0, 0.4, 0.7 * k]; P.shR = [0, 0.3, 0.6 * k];
        P.flow = 0.6;
        break;
      }
      case 'cast':
      case 'skill': {
        const k = clamp01(at / 0.25);
        P.shR = [0.1, lerp(0.3, 1.55, easeOut(k)), 0.05]; P.elbR = 0.1;
        P.shL = [-0.2, lerp(0.2, 1.3, easeOut(k)), 0.1]; P.elbL = 0.3;
        P.glowHand = 0.6 + 0.4 * Math.sin(t * 12); P.glowBoth = true; P.castCol = e.kind === 'player' ? '#7cf7ff' : null;
        P.lean = 0.1; P.legL = 0.3; P.legR = -0.2;
        P.wpR = 1.5;
        break;
      }
      case 'stance': {
        P.crouch = 7; P.legL = 0.45; P.kneeL = 0.7; P.legR = -0.4; P.kneeR = 0.5;
        P.shR = [0.85, 1.25, 0.1]; P.elbR = 0.5; P.wpR = 0.05;
        P.shL = [0.4, 1.0, 0.2]; P.elbL = 1.2;
        P.twist = -0.4; P.eye = 1.6;
        break;
      }
      default:
        if (spd > 30) runCycle(P, t * 11, Math.min(1, spd / 200));
        P.shR[1] += Math.sin(t * 2.4) * 0.03;
    }
    return P;
  }

  /* =========================================================
   * 떠 있는 여성형 리그 — 리아 · 세라 · 프로토콜 · 기억의 환영
   * 키 70, 공중에 뜸
   * ========================================================= */
  // 리아: 길게 흐르는 은빛 머리, 왼쪽의 푸른 기계 머리 장식, 검은 초커와 푸른 보석, 빛나는 회로 무늬의 하얀 바디슈트 (홀로그램)
  const LIA = {
    skin: '#e6e4f0', hair: '#c4cff2', hairHi: '#eef2ff', hairDk: '#8f9ed6', hairGlow: '#8fd8ff', body: '#e8f1ff', chest: '#f4f8ff',
    glove: '#a8d8ff', cuff: '#4fc8ff', stock: '#dbe8ff', skirt: '#cfe2fb', veil: '#7cc8ff', hem: '#4fc8ff', line: '#4fc8ff',
    eye: '#3fc0ff', accent: '#4fc8ff', choker: '#141828', gem: '#3fd0ff', ornament: 'lia', halo: true, legFade: 0.3, hairLen: 38,
  };
  // 세라: 하얀 머리, 남색 치마와 보라빛 장식, 떠다니는 기억의 파편
  const SERA = {
    skin: '#e8dbe2', hair: '#e6e2f6', hairHi: '#ffffff', hairDk: '#b0a8d8', hairGlow: '#d8b8ff', body: '#eef0fa', chest: '#ffffff',
    glove: '#1e2444', cuff: '#b07cff', stock: '#1e2444', skirt: '#262c50', veil: '#b07cff', hem: '#b07cff', line: '#b07cff',
    eye: '#b98cff', accent: '#b07cff', choker: '#1e2444', gem: '#c48aff', ornament: 'sera', shards: true, legFade: 0.08, hairLen: 34,
  };
  // 프로토콜: 하얀 머리, 금빛 갑옷 장식과 왕관, 각진 날개, 떠다니는 코드 판
  const PROTOCOL = {
    skin: '#eadcd6', hair: '#e8ecf8', hairHi: '#ffffff', hairDk: '#aab4d4', hairGlow: '#a8f0ff', body: '#f6f4ee', chest: '#ffffff',
    glove: '#d8b860', cuff: '#66e0ff', stock: '#f0ece0', skirt: '#f2efe6', veil: '#e2c470', hem: '#d8b860', line: '#66e0ff',
    eye: '#66e0ff', accent: '#66e0ff', choker: '#d8b860', gem: '#66e0ff', ornament: 'protocol', wings: true, armor: '#d8b860', legFade: 0.08, hairLen: 36,
  };

  // ASTRA 의 모습: 하얀 머리, 후광, 감은 눈, 푸른 장식
  const ASTRA_FORM = {
    skin: '#eae4ee', hair: '#eef2ff', hairHi: '#ffffff', hairDk: '#b8c4ea', hairGlow: '#9ad8ff', body: '#f2f6ff', chest: '#ffffff',
    glove: '#dfe8ff', cuff: '#5fc8ff', stock: '#e8eeff', skirt: '#eef4ff', veil: '#9ad8ff', hem: '#5fc8ff', line: '#5fc8ff',
    eye: '#9ad8ff', accent: '#5fc8ff', choker: '#1a2440', gem: '#5fd8ff', ornament: 'lia', halo: true, legFade: 0.45, hairLen: 44, eyesClosed: true,
  };

  /** 긴 머리 (머리 좌표) */
  function hairLong(S, P, t) {
    const h = S.hair, hi = S.hairHi || h, dk = S.hairDk || h;
    ball(5.9, h, { y: 1.3, z: -0.4, half: 0.45 }, 10, 4);
    ball(5.7, h, { y: -0.2, z: -1.5, sy: 1.08 }, 8, 5);
    const sway = Math.sin(t * 1.6) * 0.06 + P.flow * 0.35 + P.lean * 0.3;
    // 등 뒤로 흐르는 긴 머리 다발
    const n = LOD > 0 ? 9 : 5;
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1) - 0.5;
      const L = S.hairLen * (0.86 + 0.14 * Math.cos(u * 3)) * (0.92 + ((i * 53) % 10) / 60);
      const ph = Math.sin(t * 1.4 + i * 0.7) * 0.05;
      lock(u * 9.4, 1.6 - Math.abs(u) * 2, -4.6 + Math.abs(u) * 1.4, 0.22 + sway + ph, u * 0.25, L, 2.5, 4, -0.08, -u * 0.12, i % 3 === 0 ? hi : i % 3 === 1 ? h : dk);
    }
    // 어깨 앞으로 내려오는 옆머리
    for (const sd of [1, -1]) {
      lock(sd * 5.2, 2.4, 1.8, -0.06, sd * 0.1, S.hairLen * 0.62, 1.8, 4, 0.12 + sway * 0.4, -sd * 0.08, h);
      lock(sd * 5.5, 2, -0.8, 0.05, sd * 0.16, S.hairLen * 0.7, 1.9, 4, 0.18 + sway * 0.6, sd * 0.05, dk);
    }
    // 앞머리
    const bangs = [[-4, 0.35, 5.2], [-2.2, 0.15, 6], [-0.4, 0, 5.6], [1.4, -0.12, 6.2], [3.2, -0.3, 5.4], [4.6, -0.45, 4.6]];
    bangs.forEach(([x, a, L], i) => lock(x, 4.5, 4.0, -0.55, a, L, 1.7, 3, 0.8, a * 0.5, i % 2 ? hi : h));
    lock(0.4, 6.3, 0.2, Math.PI - 0.1, 0.3, 4.6, 0.6, 3, -1.9, 0.5, h);
    // 머리 장식
    if (S.ornament === 'lia') {
      push();
      tr(5.9, 2.4, -0.2);
      rz(-0.2);
      box(1.8, 4.8, 4.2, '#1a2440', { kind: 6 });
      box(0.6, 3.6, 3.2, S.accent, { kind: 2, x: 1, ea: 1.4 });
      push(); tr(0.4, 2, -1.2); rx(-0.7); box(0.6, 6, 2.2, S.accent, { kind: 2, y: 3, ea: 1.2, tt: 0.2 }); pop();
      push(); tr(0.4, 1, -2.2); rx(-1.1); box(0.6, 4.6, 1.8, S.accent, { kind: 2, y: 2.2, ea: 1.0, tt: 0.2 }); pop();
      pop();
      glowL(6.6, 2.6, 0, 9, S.accent, 0.5);
      box(1.2, 2.4, 2.4, '#1a2440', { x: -5.9, y: 2, z: -0.4, kind: 6 });
      box(0.4, 1.6, 1.6, S.accent, { kind: 2, x: -6.6, y: 2, z: -0.4, ea: 1.3 });
    } else if (S.ornament === 'sera') {
      for (const sd of [1, -1]) { push(); tr(sd * 5.4, 3.2, -1); rz(-sd * 0.5); box(0.8, 5.6, 2.6, S.accent, { kind: 2, y: 2.6, ea: 1.2, tt: 0.1 }); pop(); }
    } else if (S.ornament === 'protocol') {
      // 금빛 왕관
      push();
      tr(0, 5.4, -0.4);
      rx(-0.25);
      ring(5.6, 0.9, 12, S.armor, { kind: 6 });
      for (let k = 0; k < 5; k++) { const a = Math.PI * (0.15 + k * 0.175); push(); tr(Math.cos(a) * 5.6, 0, Math.sin(a) * 5.6); box(0.8, 3.4 + (k === 2 ? 2 : 0), 0.8, S.armor, { y: 1.6, kind: 6, tt: 0.2 }); pop(); }
      box(1.4, 1.4, 1.4, S.gem, { kind: 2, y: 1, z: 5.6, ea: 1.8 });
      pop();
    }
  }

  function lady(S, P, t) {
    push();
    tr(0, P.lift, 0);
    if (P.tilt) rz(P.tilt);
    push();
    tr(0, 30, 0);
    rx(P.lean * 0.3);
    // 다리 (허벅지까지 오는 스타킹, 발끝은 빛으로 흩어짐)
    for (const side of [1, -1]) {
      push();
      tr(side * 2.8, 0, 0);
      rz(side * 0.05);
      rx(-(side === 1 ? P.legL : P.legR));
      limb(2.9, 2.2, 15, S.skin, { fade: S.legFade * 0.4 });
      prism(2.5, 2.5, 1.2, 10, S.cuff, { kind: 2, y: -9, ea: 1.0, open: true, fade: S.legFade * 0.5 });
      limb(2.5, 2.25, 6.5, S.stock, { y: -12.25, fade: S.legFade * 0.5 });
      tr(0, -15, 0);
      rx(0.15 + (side === 1 ? 0.1 : 0));
      limb(2.25, 1.6, 14, S.stock, { fade: S.legFade });
      box(2.6, 3, 6, S.stock, { y: -14.5, z: 1.2, fade: Math.min(0.9, S.legFade + 0.25) });
      pop();
    }
    // 치마: 짧은 겉치마 + 뒤로 흐르는 반투명 자락
    prism(10.5 + P.flow * 3, 6, 9.5, 14, S.skirt, { y: -0.6 });
    prism(11 + P.flow * 3, 10.5 + P.flow * 3, 1.2, 14, S.hem, { kind: 2, y: -5.2, ea: 1.1, open: true });
    prism(6.3, 6.3, 1.6, 12, S.hem, { kind: 2, y: 4.1, ea: 0.9, open: true });
    for (let i = 0; i < 7; i++) {
      const a = Math.PI * (0.5 + (i - 3) * 0.22);
      push();
      ry(-a + Math.PI / 2);
      tr(0, 3.4, -6.4);
      rx(0.22 + P.flow * 0.7 + Math.sin(t * 2 + i) * 0.06);
      box(5.2, 22 + Math.abs(i - 3) * -1.8, 0.5, S.veil, { y: -11, fade: 0.5, tb: 1.35 });
      box(5.2 * 1.3, 0.5, 0.7, S.hem, { kind: 2, y: -22 + Math.abs(i - 3) * 1.8, ea: 0.8 });
      pop();
    }
    // 몸통
    push();
    rx(P.lean * 0.5);
    ry(P.twist);
    prism(5.5, 6.3, 8.4, 12, S.body, { y: 4.6, sz: 0.7 });
    prism(6.3, 7.0, 7.2, 12, S.body, { y: 12.4, sz: 0.68 });
    for (const sd of [1, -1]) ball(3.1, S.chest, { x: sd * 2.4, y: 13.2, z: 2.5, sz: 0.9 }, 10, 6);
    prism(7.0, 4.4, 3.6, 12, S.skin, { y: 17.6, sz: 0.66 });
    if (S.armor) {
      push(); tr(0, 14, 4.2); box(9, 6, 1.6, S.armor, { kind: 6, tb: 0.7 }); pop();
      for (const sd of [1, -1]) { push(); tr(sd * 7.2, 18, 0); ball(3.4, S.armor, { sy: 0.7, half: 0.6, kind: 6 }, 10, 4); pop(); }
      box(11.6, 1.6, 7.6, S.armor, { y: 1.6, kind: 6 });
    }
    // 빛나는 회로 무늬
    line([0, 1.5, 4.2], [0, 10, 4.6], 0.45, S.line, 1.3);
    line([0, 10, 4.6], [-2.6, 11, 4.8], 0.4, S.line, 1.2);
    line([0, 10, 4.6], [2.6, 11, 4.8], 0.4, S.line, 1.2);
    line([-5.2, 3, 3], [-1, 6.5, 4.2], 0.4, S.line, 1.1);
    line([5.2, 3, 3], [1, 6.5, 4.2], 0.4, S.line, 1.1);
    prism(5.6, 5.6, 0.8, 12, S.line, { kind: 2, y: 8.4, sz: 0.72, ea: 0.9, open: true });
    // 초커와 보석
    prism(2.45, 2.45, 1.6, 10, S.choker, { y: 21, kind: 6 });
    box(1.2, 1.2, 0.8, S.gem, { kind: 2, y: 20.6, z: 2.4, ea: 1.8 });
    glowL(0, 20.6, 3, 6, S.gem, 0.6);
    // 머리
    push();
    tr(0, 20, 0.4);
    prism(2.2, 1.95, 4.4, 10, S.skin, { y: 2 });
    tr(0, 4.2, 0);
    ry(P.headYaw);
    rx(P.headPitch);
    tr(0, 4.8, 0.3);
    sc(1.1);
    face(S, P);
    hairLong(S, P, t);
    if (S.halo) {
      push();
      tr(0, 8.6, -3.4);
      rx(-0.4);
      ring(8.4, 0.9, 16, S.accent, { kind: 2, ea: 1.3 });
      ring(6.6, 0.4, 12, '#ffffff', { kind: 2, ea: 1.0 });
      pop();
      glowL(0, 8.6, -3.4, 24, S.accent, 0.3);
    }
    pop();
    // 팔: 드러난 어깨, 팔꿈치부터 긴 장갑
    for (const side of [1, -1]) {
      const sh = side === 1 ? P.shL : P.shR;
      push();
      tr(side * 6.7, 17.6, 0);
      ry(sh[0]);
      rx(-sh[1]);
      rz(side * sh[2]);
      ball(2.5, S.skin, {}, 8, 5);
      limb(2.4, 2.0, 11.5, S.skin);
      prism(2.25, 2.25, 1.2, 10, S.cuff, { kind: 2, y: -7, ea: 1.1, open: true });
      limb(2.2, 2.05, 4.5, S.glove, { y: -7.4 - 2.25 });
      tr(0, -11.4, 0);
      rx(-(side === 1 ? P.elbL : P.elbR));
      limb(2.05, 1.7, 10.5, S.glove);
      prism(2, 2.2, 1.2, 10, S.cuff, { kind: 2, y: -9.6, ea: 1.0, open: true });
      box(2.6, 3.6, 3, S.skin, { y: -11.8, tb: 0.75 });
      if (P.glowHand && side === -1) glowL(0, -12, 0, 30 * P.glowHand, S.accent, 0.9 * P.glowHand);
      pop();
    }
    pop();
    pop();
    // 장식
    if (S.shards) {
      for (let i = 0; i < 6; i++) {
        const a = t * 0.9 + (i / 6) * TAU;
        push();
        tr(Math.cos(a) * 26, 44 + Math.sin(t * 2 + i) * 6, Math.sin(a) * 26);
        ry(t * 2 + i);
        box(4, 8, 4, '#e2d4ff', { kind: 2, tt: 0.1, tb: 0.1, ea: 1.4 });
        pop();
      }
      glowL(0, 46, -8, 60, S.accent, 0.25);
    }
    if (S.wings) {
      for (const side of [1, -1]) {
        for (let k = 0; k < 4; k++) {
          push();
          tr(side * 5, 49 - k * 4, -6);
          ry(side * (0.5 + k * 0.1));
          rz(side * (0.85 + k * 0.36 + Math.sin(t * 1.5) * 0.06));
          box(1.6, 36 - k * 6, 9, '#f4ecd0', { y: -(18 - k * 3), kind: 6, tb: 0.3 });
          box(0.8, 34 - k * 6, 1, S.accent, { kind: 2, y: -(18 - k * 3), z: 4.8, ea: 1.2, tb: 0.3 });
          box(2, 2, 10, S.armor || '#d8b860', { kind: 6, y: -0.5 });
          pop();
        }
      }
      for (let i = 0; i < 6; i++) {
        const a = t * 0.6 + (i / 6) * TAU;
        push();
        tr(Math.cos(a) * 30, 40 + Math.sin(t + i) * 8, Math.sin(a) * 30);
        ry(-a);
        box(9, 6, 0.6, S.accent, { kind: 2, ea: 0.9 });
        pop();
      }
    }
    pop();
  }

  function ladyPose(e, t) {
    const P = basePose();
    const anim = e.anim || 'idle';
    const at = e.animT || 0;
    P.lift = Math.sin(t * 2 + (e.id || 0)) * 2.5;
    P.legL = 0.15 + Math.sin(t * 1.3) * 0.08;
    P.legR = -0.05;
    P.shL = [0, 0.15, 0.25 + Math.sin(t * 1.6) * 0.05];
    P.shR = [0, 0.2, 0.25];
    P.elbL = 0.4; P.elbR = 0.5;
    const spd = Math.hypot(e.vx || 0, e.vy || 0);
    P.lean = Math.min(0.35, spd / 600);
    P.flow = Math.min(0.6, spd / 400);
    if (anim === 'attack' || anim === 'cast' || anim === 'windup' || anim === 'charge') {
      const k = clamp01(at / 0.25);
      P.shR = [0.1, lerp(0.3, 1.55, easeOut(k)), 0.05];
      P.elbR = 0.05;
      P.glowHand = 0.7 + 0.3 * Math.sin(t * 14);
      if (anim === 'cast' || anim === 'charge') { P.shL = [-0.1, lerp(0.2, 1.4, easeOut(k)), 0.15]; P.elbL = 0.1; }
    }
    if (anim === 'hurt') { P.lean = -0.3; P.headPitch = -0.2; }
    if (e.down > 0 || e.dead) { P.lift = -14; P.lean = 0.5; P.headPitch = 0.4; P.shL = [0, -0.2, 0.6]; P.shR = [0, -0.2, 0.6]; }
    return P;
  }

  /* 상자 공용: 외부(보스 파일 부분)에서도 쓰도록 */
  const K = { push, pop, tr, rx, ry, rz, sc, ap, box, prism, ball, ring, glowL, glowAt, quad, tri, strand, lock, line, limb, face, humanoid, lady, manPose, ladyPose, basePose, swing, runCycle, weapon, clamp01, lerp, easeOut, easeIn, smooth, TAU, ARKA, ZERO, KAI };

  /* =========================================================
   * 일반 적
   * ========================================================= */
  function hound(e, t, s) {
    const an = e.anim || 'idle';
    const at = e.animT || 0;
    const spd = Math.hypot(e.vx || 0, e.vy || 0);
    const ph = t * 13 + (e.id || 0);
    const moving = spd > 20 || an === 'move' || an === 'dash';
    let crouch = 0;
    let lean = 0;
    if (an === 'windup') { crouch = 7 * clamp01(at / 0.3); lean = -0.15; }
    if (an === 'dash') lean = 0.25;
    sc(s);
    push();
    tr(0, 26 - crouch, 0);
    rx(lean);
    const body = '#3a3440', plate = '#5a5468', eye = e.def.color || '#ff5470';
    box(17, 13, 38, body, { tb: 0.85 });
    box(13, 4, 30, plate, { y: 7.5, kind: 6 });
    for (let k = 0; k < 3; k++) box(2, 7, 4, '#6a6478', { y: 10, z: -6 + k * 8, tt: 0.2, kind: 6 });
    // 머리
    push();
    tr(0, 4, 20);
    rx(an === 'windup' ? 0.3 : -0.05 + Math.sin(t * 3) * 0.04);
    box(13, 11, 14, body, { z: 5, tb: 0.85 });
    box(11, 4, 12, '#2a2430', { y: -6, z: 6, tt: 0.9 });
    box(11, 2, 1, eye, { kind: 2, y: 1.5, z: 12.2, ea: 1.6 });
    glowL(0, 1.5, 13, 14, eye, 0.6);
    box(2.4, 8, 3, plate, { x: 4.5, y: 8, z: 0, tt: 0.2, kind: 6 });
    box(2.4, 8, 3, plate, { x: -4.5, y: 8, z: 0, tt: 0.2, kind: 6 });
    pop();
    // 다리
    const legs = [[6.5, 13, 0], [-6.5, 13, Math.PI], [6.5, -13, Math.PI], [-6.5, -13, 0]];
    for (const [x, z, p0] of legs) {
      const sw = moving ? Math.sin(ph + p0) * 0.65 : 0;
      push();
      tr(x, -3, z);
      rx(-sw + (an === 'dash' ? (z > 0 ? -0.6 : 0.7) : 0));
      box(4.6, 13, 5.4, plate, { y: -6, kind: 6, tb: 0.8 });
      tr(0, -12, 0);
      rx(z > 0 ? 0.5 : -0.5);
      box(3.6, 12, 4, body, { y: -6, tb: 0.7 });
      box(4.6, 2.4, 6, '#1e1a24', { y: -12, z: 1 });
      pop();
    }
    push();
    tr(0, 3, -19);
    rx(-1.0 + Math.sin(t * 4) * 0.2);
    box(2, 16, 2, plate, { y: -8 + 16, kind: 6, tt: 0.4 });
    box(2.4, 2.4, 2.4, eye, { kind: 2, y: 16, ea: 1.4 });
    pop();
    pop();
  }

  function drone(e, t, s, mini) {
    const an = e.anim || 'idle';
    const at = e.animT || 0;
    sc(s);
    const col = e.def.color || '#5fd4ff';
    const charge = an === 'charge' ? clamp01(at / 0.4) : 0;
    push();
    tr(0, 4 + Math.sin(t * 3 + (e.id || 0)) * 2.5, 0);
    rx(Math.min(0.3, Math.hypot(e.vx || 0, e.vy || 0) / 500));
    prism(11, 12, 7, 8, '#2a3448', { kind: 6 });
    prism(12, 7, 6, 8, '#3a4a64', { y: 6.5, kind: 6 });
    prism(6, 2, 4, 8, '#4a5a78', { y: 11, kind: 6 });
    prism(9, 12, 4, 8, '#1e2636', { y: -5.5, kind: 6 });
    box(9, 6, 3, '#10141e', { z: 11 });
    box(6, 4, 1, col, { kind: 2, z: 12.6, ea: 1.3 + charge * 1.5 });
    glowL(0, 0, 14, 16 + charge * 30, col, 0.6 + charge);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + Math.PI / 4;
      push();
      tr(Math.cos(a) * 14, 2, Math.sin(a) * 14);
      box(3, 2.4, 3, '#4a5a78', { kind: 6 });
      ry(t * 30 + i);
      box(14, 0.6, 2, '#8a9ab8', { y: 1.8 });
      box(2, 0.6, 14, '#8a9ab8', { y: 1.8 });
      pop();
      push();
      ry(-a);
      box(12, 1.6, 2, '#2a3448', { x: 7, y: 2, kind: 6 });
      pop();
    }
    if (!mini) box(2, 7, 2, '#3a4a64', { y: -10, kind: 6 });
    pop();
  }

  function bomber(e, t, s) {
    const an = e.anim || 'idle';
    const charge = an === 'charge';
    sc(s);
    push();
    tr(0, 4 + Math.sin(t * 5 + (e.id || 0)) * 2, 0);
    ry(t * 2);
    ball(9, '#3a2a24', { kind: 6 }, 8, 4);
    for (let i = 0; i < 6; i++) {
      push();
      const a = (i / 6) * TAU;
      ry(a);
      rz(Math.PI / 2 + (i % 2 ? 0.5 : -0.5));
      box(2.6, 8, 2.6, '#6a4a34', { y: 11, tt: 0.1, kind: 6 });
      pop();
    }
    const blink = charge ? (Math.sin(t * 40) > 0 ? 1 : 0.2) : (Math.sin(t * 6) > 0.6 ? 1 : 0.3);
    box(4, 4, 4, '#ff9b3d', { kind: 2, y: 8.5, ea: 1.8 * blink });
    glowL(0, 9, 0, 26, '#ff9b3d', 0.9 * blink);
    pop();
  }

  function guardBot(e, t, s) {
    const an = e.anim || 'idle';
    const spd = Math.hypot(e.vx || 0, e.vy || 0);
    const ph = t * 8 + (e.id || 0);
    const mv = spd > 15 ? 1 : 0;
    sc(s);
    const steel = '#5a6a84', dark = '#2a3242', yel = '#ffe066';
    push();
    tr(0, Math.abs(Math.sin(ph)) * 2 * mv, 0);
    for (const side of [1, -1]) {
      push();
      tr(side * 9, 24, 0);
      rx(-Math.sin(ph) * 0.4 * mv * side);
      box(9, 14, 10, dark, { y: -6, kind: 6 });
      tr(0, -13, 0);
      box(10, 12, 12, steel, { y: -5, kind: 6, tb: 1.15 });
      pop();
    }
    box(30, 26, 22, steel, { y: 40, kind: 6, tb: 0.8 });
    box(20, 10, 4, dark, { y: 42, z: 11, kind: 6 });
    box(14, 2, 1, yel, { kind: 2, y: 45, z: 13.2, ea: 1.2 });
    box(12, 9, 12, dark, { y: 57, kind: 6 });
    box(9, 2, 1, e.def.color || '#8fa8c8', { kind: 2, y: 57, z: 6.4, ea: 1.5 });
    // 방패 (왼팔, 앞)
    const bash = an === 'attack' || an === 'charge' ? 0.5 : 0;
    push();
    tr(12, 40, 12 + bash * 10);
    box(8, 10, 8, dark, { kind: 6 });
    tr(4, -4, 8);
    box(4, 46, 34, '#4a5670', { kind: 6 });
    box(4.4, 46, 2, yel, { kind: 2, z: 17, ea: 0.9 });
    box(4.4, 46, 2, yel, { kind: 2, z: -17, ea: 0.9 });
    box(4.6, 2, 34, yel, { kind: 2, y: 23, ea: 0.9 });
    pop();
    push();
    tr(-17, 44, 0);
    rx(-0.4 - bash);
    box(9, 22, 10, steel, { y: -10, kind: 6 });
    box(10, 8, 10, dark, { y: -24, kind: 6 });
    pop();
    pop();
  }

  /** 일반 적 하나 */
  function minion(e, W, t) {
    const type = e.type || (e.def && e.def.id);
    const r = e.r || 18;
    switch (type) {
      case 'hound': hound(e, t, r / 20); break;
      case 'drone': drone(e, t, r / 16); break;
      case 'miniDrone': drone(e, t, r / 16, true); break;
      case 'bomber': bomber(e, t, r / 15); break;
      case 'guardBot': guardBot(e, t, r / 28); break;
      case 'sniper': {
        const P = manPose(e, W, t, 'rail');
        if (e.anim === 'charge' || e.anim === 'attack') { P.shR = [0.1, 1.5, 0.05]; P.elbR = 0.1; P.wpR = 1.5; P.shL = [-0.5, 1.45, 0.1]; P.elbL = 0.6; P.crouch = 3; }
        else { P.shR = [0, 0.9, 0.1]; P.elbR = 0.9; P.wpR = 1.0; }
        sc(r / 17 * 0.92);
        humanoid(SNIPER, P, { type: 'longrifle', color: '#ffb35c' });
        break;
      }
      case 'seraClone': {
        FADE = Math.max(FADE, 0.35);
        sc(r / 26 * 1.1);
        lady(SERA, ladyPose(e, t), t);
        break;
      }
      default: {
        const P = manPose(e, W, t, 'rifle');
        if (e.anim === 'charge' || e.anim === 'attack' || e.anim === 'windup') { P.shR = [0.1, 1.5, 0.05]; P.elbR = 0.15; P.wpR = 1.5; P.shL = [-0.5, 1.4, 0.1]; P.elbL = 0.7; }
        else if (!(Math.hypot(e.vx || 0, e.vy || 0) > 30)) { P.shR = [0.2, 0.7, 0.1]; P.elbR = 1.1; P.wpR = 1.2; }
        sc(r / 18 * 0.95);
        humanoid(SOLDIER, P, { type: 'rifle', color: e.def.color || '#9ab0ff' });
      }
    }
  }

  /* =========================================================
   * 한 프레임 만들기
   * ========================================================= */
  const BOSSES = {}; // models3d_boss 부분이 채움

  function entityFade(e) {
    let a = e.alpha != null ? e.alpha : 1;
    if (e.untargetable && e.kind === 'boss') a *= 0.4;
    if (e.spawnT > 0) a *= Math.max(0, 1 - e.spawnT / 0.5);
    if (e.kind === 'ally' && e.down > 0) a *= 0.6;
    if (e.dead && e.kind !== 'boss') a *= Math.max(0, 1 - e.deadT / 1.0);
    return 1 - Math.max(0, Math.min(1, a));
  }

  function drawEntity(e, W, t, floorZ) {
    const z0 = floorZ + (e.z || 0);
    TIME = t;
    LOD = e.kind === 'enemy' ? 0 : 1;
    const C = AZ.gfx.cam3d.st;
    if (LOD && e.kind === 'ally' && C && C.eye && Math.hypot(C.eye[0] - e.x, C.eye[2] - e.y) > 1400) LOD = 0;
    // 느린 기기: 동료부터, 더 느리면 주인공도 가볍게
    if (QUALITY < 2 && e.kind === 'ally') LOD = 0;
    if (QUALITY < 1 && e.kind === 'player') LOD = 0;
    Mx = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];
    tr(e.x, z0, e.y);
    ry(Math.PI / 2 - (e.facing || 0));
    FLASH = e.flash > 0 ? Math.min(1, e.flash * 6) : 0;
    FADE = entityFade(e);
    if (e.kind === 'player' && e.iframe > 0 && e.state === 'hurt') FADE = Math.max(FADE, Math.sin(t * 60) > 0 ? 0.5 : 0);
    if (FADE >= 0.98) return;
    switch (e.kind) {
      case 'player': {
        const wid = (e.stats && e.stats.weaponId) || 'blade';
        const wc = (e.stats && e.stats.weapon && e.stats.weapon.color) || '#5fd4ff';
        const P = manPose(e, W, t, wid);
        if (wid === 'great' && !(e.anim === 'attack' || e.anim === 'heavy')) { P.shR = [0.3, 0.5, 0.15]; P.elbR = 1.4; P.wpR = 2.4; }
        if (wid === 'spear' && !(e.anim === 'attack' || e.anim === 'heavy')) { P.shR = [0.1, 0.5, 0.1]; P.elbR = 1.2; P.wpR = 1.9; }
        if (wid === 'rail' && !(e.anim === 'attack' || e.anim === 'heavy')) { P.shR = [0.1, 0.6, 0.1]; P.elbR = 1.3; P.wpR = 1.7; }
        const wR = { type: wid === 'twin' ? 'blade' : wid, color: wc, len: wid === 'twin' ? 32 : 48 };
        const wL = wid === 'twin' ? { type: 'blade', color: wc, len: 32 } : null;
        sc(1.0);
        humanoid(KAI, P, wR, wL);
        if (W.zero > 0 || e.haste > 0) glowL(0, 40, 0, 120, '#7ce8ff', 0.18);
        break;
      }
      case 'ally':
        if (e.ally === 'lia') {
          // 홀로그램 AI: 살짝 비치고 푸른 빛
          FADE = Math.max(FADE, 0.1);
          sc(1.0);
          lady(LIA, ladyPose(e, t), t);
          glowL(0, 40, 0, 70, '#8fd8ff', 0.22);
        } else {
          const P = manPose(e, W, t, 'blade');
          sc((e.r || 20) / 20 * 1.03);
          humanoid(ZERO, P, { type: 'crystal', color: '#ff2a4a', len: 54 });
        }
        break;
      case 'enemy':
        minion(e, W, t);
        break;
      case 'boss': {
        const fn = BOSSES[e.bossId];
        if (e.dead) {
          const k = clamp01((e.deadT || 0) / 3);
          FADE = Math.max(FADE, clamp01(((e.deadT || 0) - 1.4) / 1.6));
          tr(0, -k * 30, 0);
          rz(Math.sin((e.deadT || 0) * 30) * 0.03 * (1 - k) + k * 0.25);
          FLASH = Math.max(FLASH, Math.sin((e.deadT || 0) * 18) > 0.6 ? 0.6 * (1 - k) : 0);
        }
        if (fn) fn(e, W, t, K); else { box(e.r, e.r * 2.4, e.r, e.def.color || '#ff5470', { y: e.r * 1.2 }); }
        break;
      }
      default: break;
    }
    FLASH = 0;
    FADE = 0;
  }

  /* 자동 품질: 모델 만드는 시간이 길면 단계를 낮춤 (2 → 1 → 0) */
  let QUALITY = 2;
  let costAvg = 0;
  let slowFrames = 0;
  function build(W, t, ghosts) {
    const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
    const out = buildInner(W, t, ghosts);
    if (t0) {
      const dt = performance.now() - t0;
      costAvg = costAvg ? costAvg * 0.95 + dt * 0.05 : dt;
      if (costAvg > 7 && QUALITY > 0) { slowFrames += 1; if (slowFrames > 90) { QUALITY -= 1; slowFrames = 0; costAvg *= 0.7; } } else slowFrames = 0;
    }
    return out;
  }
  function buildInner(W, t, ghosts) {
    mn = 0; gn = 0; sn = 0;
    const C = AZ.gfx.cam3d.st;
    if (C && C.eye && C.target) {
      const f = [C.target[0] - C.eye[0], C.target[1] - C.eye[1], C.target[2] - C.eye[2]];
      const fl = Math.hypot(f[0], f[1], f[2]) || 1;
      f[0] /= fl; f[1] /= fl; f[2] /= fl;
      const rl = Math.hypot(f[2], f[0]) || 1;
      camR = [-f[2] / rl, 0, f[0] / rl];
      camU = [camR[1] * f[2] - camR[2] * f[1], camR[2] * f[0] - camR[0] * f[2], camR[0] * f[1] - camR[1] * f[0]];
    }
    const L = W.level;
    const fz = (x, y) => (L ? AZ.level.floorZ(L, x, y) : 0);
    const list = [W.player, ...W.allies, ...W.enemies];
    for (const e of list) {
      if (e.dead && e.kind === 'enemy' && e.deadT > 1) continue;
      if (e.kind === 'boss' && e.dead && e.deadT > 3) continue;
      const z = fz(e.x, e.y);
      try {
        drawEntity(e, W, t, z);
      } catch (err) {
        if (typeof console !== 'undefined') console.error('[models3d]', err);
        stack.length = 0;
      }
      const lift = Math.min(1, (e.z || 0) / 160);
      const r = (e.r || 18) * (e.kind === 'boss' ? 1.2 : 1.15) * (1 - lift * 0.3);
      if (!(e.dead && e.kind !== 'boss' && e.deadT > 0.8)) shadowAt(e.x, e.y, z, r, 0.55 * (1 - lift * 0.5) * (1 - entityFade(e)));
    }
    // 회피 잔상
    if (ghosts && ghosts.length) {
      const p = W.player;
      for (const gh of ghosts) {
        if (Math.hypot(gh.x - p.x, gh.y - p.y) < 14) continue;
        const snap = Object.assign({}, p, gh.snap || {}, { x: gh.x, y: gh.y, facing: gh.facing, flash: 0, iframe: 0, alpha: 1, spawnT: 0 });
        TINT = hx(W.zero > 0 ? '#7ce8ff' : '#4a8cff');
        const base = 0.45 + 0.55 * clamp01(gh.t / 0.25);
        try {
          Mx = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];
          tr(snap.x, fz(snap.x, snap.y) + (snap.z || 0), snap.y);
          ry(Math.PI / 2 - (snap.facing || 0));
          FADE = base;
          LOD = 0;
          const wid = (p.stats && p.stats.weaponId) || 'blade';
          humanoid(KAI, manPose(snap, W, t, wid), null, null);
        } catch (err) { stack.length = 0; }
        TINT = null;
        FADE = 0;
      }
    }
    return { mesh: mesh.subarray(0, mn * STRIDE), meshCount: mn, glow: glow.subarray(0, gn * STRIDE), glowCount: gn, shadow: shad.subarray(0, sn * 6), shadowCount: sn };
  }

  return {
    build, BOSSES, K, KAI, ZERO, LIA, SERA, PROTOCOL, ARKA, ASTRA_FORM,
    get quality() { return QUALITY; }, set quality(v) { QUALITY = v; costAvg = 0; slowFrames = 0; },
  };
})();
