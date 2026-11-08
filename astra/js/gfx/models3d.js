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
  function quad(a, b, c, d, col, o) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    const n = [nx / l, ny / l, nz / l];
    let kind = o.kind != null ? o.kind : KIND_TOON;
    let cc = hx(col);
    let em = o.em ? hx(o.em) : WHITE;
    let ea = o.em ? (o.ea != null ? o.ea : 1) : 0;
    if (kind === 2 && !o.em) { em = cc; ea = o.ea != null ? o.ea : 1.2; }
    if (TINT) { cc = [cc[0] * 0.2, cc[1] * 0.2, cc[2] * 0.25]; em = TINT; ea = 0.9; kind = KIND_TOON; }
    if (FLASH > 0) { em = [lerp(em[0], 1, FLASH), lerp(em[1], 1, FLASH), lerp(em[2], 1, FLASH)]; ea = Math.max(ea, FLASH * 1.3); if (kind !== 2) kind = KIND_TOON; }
    const fade = Math.min(1, FADE + (o.fade || 0));
    if (mn + 6 > mesh.length / STRIDE) mesh = grow(mesh, (mn + 600) * STRIDE);
    vtx(a, n, cc, kind, em, ea, fade); vtx(b, n, cc, kind, em, ea, fade); vtx(c, n, cc, kind, em, ea, fade);
    vtx(a, n, cc, kind, em, ea, fade); vtx(c, n, cc, kind, em, ea, fade); vtx(d, n, cc, kind, em, ea, fade);
  }
  function tri(a, b, c, col, o) { quad(a, b, c, c, col, o); }

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
    const hw = w / 2, hh = h / 2, hd = d / 2;
    const tb = o.tb != null ? o.tb : 1, tt = o.tt != null ? o.tt : 1;
    const ox = o.x || 0, oy = o.y || 0, oz = o.z || 0;
    const P = (v) => { const k = v[1] > 0 ? tt : tb; return ap(ox + v[0] * hw * k, oy + v[1] * hh, oz + v[2] * hd * k); };
    for (const f of FACES) quad(P(f[0]), P(f[1]), P(f[2]), P(f[3]), col, o);
  }
  /** Y 축 각기둥 (n 각). r0 아래 반지름, r1 위 반지름 */
  function prism(r0, r1, h, n, col, o) {
    o = o || NO;
    const oy = o.y || 0, ox = o.x || 0, oz = o.z || 0, ph = o.ph || 0;
    const sx = o.sx || 1, sz = o.sz || 1;
    const y0 = oy - h / 2, y1 = oy + h / 2;
    const pts0 = [], pts1 = [];
    for (let i = 0; i <= n; i++) {
      const a = ph + (i / n) * TAU;
      const c = Math.cos(a) * sx, s = Math.sin(a) * sz;
      pts0.push(ap(ox + c * r0, y0, oz + s * r0));
      pts1.push(ap(ox + c * r1, y1, oz + s * r1));
    }
    for (let i = 0; i < n; i++) quad(pts0[i + 1], pts0[i], pts1[i], pts1[i + 1], col, o);
    if (!o.open) {
      const c1 = ap(ox, y1, oz), c0 = ap(ox, y0, oz);
      for (let i = 0; i < n; i++) { if (r1 > 0.01) tri(pts1[i + 1], pts1[i], c1, col, o); if (r0 > 0.01) tri(pts0[i], pts0[i + 1], c0, col, o); }
    }
  }
  /** 팔다리: 원점에서 아래(-Y)로 h 만큼 내려가는 둥근 기둥 (r0 위, r1 아래) */
  function limb(r0, r1, h, col, o) {
    prism(r1, r0, h, 8, col, Object.assign({ y: -h / 2, ph: Math.PI / 8 }, o || NO));
  }

  /** 낮은 다각형 공 (위도 rings, 경도 n) */
  function ball(r, col, o, n, rings) {
    o = o || NO;
    n = n || 8;
    rings = rings || 4;
    const ox = o.x || 0, oy = o.y || 0, oz = o.z || 0;
    const sy = o.sy || 1;
    const P = (i, j) => {
      const th = (j / rings) * Math.PI;
      const a = (i / n) * TAU;
      return ap(ox + Math.sin(th) * Math.cos(a) * r, oy + Math.cos(th) * r * sy, oz + Math.sin(th) * Math.sin(a) * r);
    };
    for (let j = 0; j < rings; j++) for (let i = 0; i < n; i++) quad(P(i + 1, j + 1), P(i, j + 1), P(i, j), P(i + 1, j), col, o);
  }
  /** 고리 (XZ 평면, 반지름 R, 단면 t) */
  function ring(R, t, n, col, o) {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      push();
      tr(Math.cos(a) * R, 0, Math.sin(a) * R);
      ry(-a);
      box(t, t, TAU * R / n * 1.04, col, o);
      pop();
    }
    return pts;
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
        box(3.2, 9, 3.2, '#1a1c24', { y: 1 });
        box(14, 2.4, 4, '#2a2e3a', { y: -4, kind: 6 });
        box(9, 60, 2.4, '#262a36', { y: -35, kind: 6, tb: 0.55 });
        box(1.2, 60, 2.6, c, { kind: 2, x: 4.6, y: -35, ea: 1.3 * I, tb: 0.4 });
        box(1.2, 60, 2.6, c, { kind: 2, x: -4.6, y: -35, ea: 1.3 * I, tb: 0.4 });
        for (let k = 0; k < 4; k++) glowL(0, -14 - k * 14, 0, 22, c, 0.5 * I);
        break;
      }
      case 'spear': {
        box(2, 96, 2, '#2a2e3a', { y: -18, kind: 6 });
        box(4.5, 18, 1.4, c, { kind: 2, y: -74, tb: 0.05, ea: 1.4 * I });
        box(7, 2, 3, '#3a3e4a', { y: -64, kind: 6 });
        glowL(0, -74, 0, 26, c, 0.7 * I);
        break;
      }
      case 'rail': {
        box(5, 30, 7, '#262a34', { y: -10, kind: 6 });
        box(3, 26, 3, '#3a3e4a', { y: -36, kind: 6 });
        box(1.4, 26, 1.4, c, { kind: 2, x: 2, y: -36, ea: 1.2 * I });
        box(5, 7, 4, '#1c1e26', { y: 6, z: -2 });
        glowL(0, -50, 0, 18, c, 0.6 * I);
        break;
      }
      case 'rifle': {
        box(4, 24, 6, '#20242e', { y: -8, kind: 6 });
        box(2.2, 16, 2.2, '#2e323c', { y: -27, kind: 6 });
        box(1, 3, 1, c, { kind: 2, y: -36, ea: 1.4 });
        break;
      }
      case 'longrifle': {
        box(4, 30, 6, '#2a2520', { y: -10, kind: 6 });
        box(2, 34, 2, '#3a342e', { y: -42, kind: 6 });
        box(3, 9, 3, '#1a1816', { y: -6, z: 4 });
        box(1, 3, 1, c, { kind: 2, y: -60, ea: 1.6 });
        break;
      }
      default: {
        const L = len || 48;
        box(2.4, 9, 2.4, '#1a1e2a', { y: 1.5 });
        box(9, 1.8, 3.4, '#2e3646', { y: -3.4, kind: 6 });
        box(1.3, L, 3.8, c, { kind: 2, y: -4.5 - L / 2, ea: 1.5 * I, tb: 0.3 });
        const n = Math.max(2, Math.round(L / 13));
        for (let k = 0; k < n; k++) glowL(0, -8 - (k + 0.5) * (L / n), 0, 16, c, 0.55 * I);
      }
    }
    pop();
  }

  /** 머리카락 */
  function hair(S) {
    const h = S.hair;
    if (S.hairStyle === 'helmet') {
      box(12.6, 12.6, 12.6, S.helm, { y: 0.6, kind: 6 });
      box(11, 2.6, 2, S.eye, { kind: 2, y: 0.5, z: 6.4, ea: 1.4 });
      box(3, 6, 8, S.helmHi || S.helm, { y: 7, kind: 6 });
      return;
    }
    if (S.hairStyle === 'hood') {
      box(13.6, 13, 13.4, S.coat, { y: 1, z: -0.6, tt: 0.8 });
      box(10, 4, 2, '#0a0a0c', { y: 0.4, z: 6 });
      box(6.5, 1.2, 1, S.eye, { kind: 2, y: 0.9, z: 7, ea: 1.6 });
      return;
    }
    if (S.hairStyle === 'knight') {
      box(15, 15, 15, S.helm, { y: 1, kind: 6, tb: 0.9 });
      box(12, 2.4, 2, S.eye, { kind: 2, y: 1, z: 7.6, ea: 1.6 });
      box(3, 12, 16, S.trim, { kind: 2, y: 12, z: -2, tt: 0.4, ea: 1.2 });
      return;
    }
    ball(6.3, h, { y: 1.9, z: -0.5, sy: 0.95 }, 8, 4);
    box(12, 9, 4, h, { y: 0.5, z: -4.4, tb: 0.75 });
    box(2.6, 8, 8, h, { x: 5.6, y: 0.5, z: -0.2, tb: 0.5 });
    box(2.6, 8, 8, h, { x: -5.6, y: 0.5, z: -0.2, tb: 0.5 });
    const spikes = S.hairStyle === 'zero'
      ? [[0, 7, -2, -0.9, 0, 11], [3.5, 6, -3, -1.2, -0.5, 10], [-3.5, 6, -3, -1.2, 0.5, 10], [5, 4, -4, -1.6, -0.9, 9], [-5, 4, -4, -1.6, 0.9, 9], [0, 4, -5, -1.9, 0, 10], [2.5, 7, 2, -0.3, -0.3, 8], [-2.5, 7, 2, -0.3, 0.3, 8]]
      : [[0, 7, -1, -0.55, 0, 9], [3.6, 6, -2, -0.9, -0.5, 8], [-3.6, 6, -2, -0.9, 0.5, 8], [5, 3.5, -3.5, -1.5, -0.8, 7], [-5, 3.5, -3.5, -1.5, 0.8, 7], [0, 4, -5.5, -1.8, 0, 8], [1.8, 5.5, 4.5, 2.4, -0.2, 6], [-2.2, 5.5, 4.5, 2.5, 0.25, 6], [4.5, 5, 3.5, 2.1, -0.6, 5]];
    for (const [x, y, z, ax, az, L] of spikes) {
      push();
      tr(x, y, z);
      rx(ax);
      rz(az);
      box(4.6, L, 4.6, h, { y: L / 2 - 1, tt: 0.08 });
      pop();
    }
    if (S.hairHi) box(10, 1, 6, S.hairHi, { y: 8.1, z: 1, tt: 0.4 });
  }

  function head(S, P) {
    box(4.2, 4, 4.2, S.skin, { y: 1.6 });
    push();
    tr(0, 10, 0.4);
    ry(P.headYaw);
    rx(P.headPitch);
    sc(S.headScale || 1.18);
    ball(5.6, S.skin, { sy: 1.08, y: 0.2 }, 8, 5);
    box(7.4, 4.2, 4, S.skin, { y: -3.4, z: 2, tb: 0.55 });
    box(2.1, 1.7, 0.6, S.eye, { kind: 2, x: 2.3, y: 0.2, z: 5.25, ea: 1.4 * P.eye });
    box(2.1, 1.7, 0.6, S.eye, { kind: 2, x: -2.3, y: 0.2, z: 5.25, ea: 1.4 * P.eye });
    if (P.eye > 1.2) { glowL(2.4, 0.4, 6, 8, S.eye, 0.5 * P.eye); glowL(-2.4, 0.4, 6, 8, S.eye, 0.5 * P.eye); }
    hair(S);
    pop();
  }

  /** 팔 (side: +1 왼쪽, -1 오른쪽) */
  function arm(S, P, side, wpn) {
    const sh = side === 1 ? P.shL : P.shR;
    push();
    tr(side * 9.6, 19, 0);
    ry(sh[0]);
    rx(-sh[1]);
    rz(side * sh[2]);
    if (S.pauldron) box(8, 5.5, 9, S.pauldron, { y: 1.2, kind: 6, tb: 1.15 });
    ball(3.3, S.sleeve || S.coat, { y: -0.5 }, 8, 4);
    limb(3.1, 2.6, 14, S.sleeve || S.coat);
    if (S.trim && S.sleeveTrim !== false) prism(2.8, 2.8, 1.2, 8, S.trim, { kind: 2, y: -12.6, ea: 0.9, open: true });
    tr(0, -13.5, 0);
    rx(-(side === 1 ? P.elbL : P.elbR));
    limb(2.7, 2.3, 12.5, S.glove || S.coat);
    tr(0, -12.5, 0);
    box(4, 4.4, 4.4, S.glove || S.skin, { y: -1.6, tb: 0.8 });
    if (P.glowHand && (side === -1 || P.glowBoth)) glowL(0, -2, 2, 26 * P.glowHand, P.castCol || S.trim, 0.9 * P.glowHand);
    if (wpn) weapon(wpn.type, wpn.color, P, side, wpn.len);
    pop();
  }

  /** 다리 */
  function leg(S, P, side) {
    const sw = side === 1 ? P.legL : P.legR;
    const kn = side === 1 ? P.kneeL : P.kneeR;
    push();
    tr(side * 4.4, -1, 0);
    rz(side * P.spread);
    rx(-sw);
    limb(3.9, 3.0, 17.5, S.pants);
    tr(0, -17, 0);
    rx(kn);
    if (S.knee) box(6, 5, 3, S.knee, { y: -0.5, z: 2.9, kind: 6 });
    limb(3.1, 2.7, 17, S.boots);
    tr(0, -17, 0);
    rx(-kn * 0.3 + sw * 0.5);
    box(6.2, 5, 12, S.boots, { y: -1.2, z: 2.6 });
    if (S.trim) box(6.4, 0.9, 2, S.trim, { kind: 2, y: 0.8, z: 7.4, ea: 0.8 });
    pop();
  }

  /** 긴 코트 자락 */
  function coatSkirt(S, P) {
    if (!S.coatLen) return;
    const L = S.coatLen;
    push();
    tr(0, 3, -5);
    rx(0.12 + P.flow);
    box(17, L, 2, S.coat, { y: -L / 2, tb: 1.25 });
    if (S.trim) box(17 * 1.2, 1, 2.2, S.trim, { kind: 2, y: -L + 0.5, ea: 0.9 });
    pop();
    for (const side of [1, -1]) {
      const sw = side === 1 ? P.legL : P.legR;
      push();
      tr(side * 5.4, 3, 4.6);
      rz(side * 0.16);
      rx(-Math.max(-0.2, sw) * 0.7 + P.flow * 0.3);
      box(7, L * 0.9, 1.6, S.coat, { y: -L * 0.45, tb: 1.15 });
      if (S.trim) box(1, L * 0.9, 1.8, S.trim, { kind: 2, x: -side * 3.4, y: -L * 0.45, ea: 0.9 });
      pop();
      push();
      tr(side * 8.2, 3, 0);
      rz(side * (0.22 + P.flow * 0.2));
      box(1.6, L * 0.92, 9, S.coat, { y: -L * 0.46, tb: 1.2 });
      pop();
    }
  }

  function humanoid(S, P, wpnR, wpnL) {
    push();
    tr(0, P.lift, 0);
    if (P.fall) { rx(-P.fall); }
    if (P.tilt) rz(P.tilt);
    push();
    tr(0, 38 - P.crouch, 0);
    rx(P.lean * 0.4);
    prism(7.6, 7.4, 7, 8, S.pants, { y: 1.5, sz: 0.66, ph: Math.PI / 8 });
    if (S.belt) prism(8, 8, 2.2, 8, S.belt, { y: 4, sz: 0.68, kind: 6, ph: Math.PI / 8 });
    leg(S, P, 1);
    leg(S, P, -1);
    coatSkirt(S, P);
    push();
    rx(P.lean * 0.6);
    ry(P.twist);
    prism(6.8, 7.4, 9, 8, S.body, { y: 7, sz: 0.66, ph: Math.PI / 8 });
    prism(7.6, 9.4, 12.4, 8, S.coat, { y: 15.4, sz: 0.6, ph: Math.PI / 8 });
    prism(9.4, 7, 2.6, 8, S.coat, { y: 22.9, sz: 0.62, ph: Math.PI / 8 });
    if (S.trim) {
      box(1.1, 12, 1, S.trim, { kind: 2, x: 2.6, y: 15, z: 5.5, ea: 1.0 });
      box(1.1, 12, 1, S.trim, { kind: 2, x: -2.6, y: 15, z: 5.5, ea: 1.0 });
    }
    if (S.chestPlate) box(13, 8, 3, S.chestPlate, { y: 16, z: 4.6, kind: 6 });
    if (S.collar !== false) box(13, 4.4, 9.6, S.coat2 || S.coat, { y: 22, tb: 0.9, tt: 1.15 });
    head(S, P);
    arm(S, P, 1, wpnL);
    arm(S, P, -1, wpnR);
    pop();
    pop();
    pop();
  }

  /* ───────── 스타일 ───────── */
  const KAI = {
    skin: '#e2cfcc', hair: '#1c2644', hairHi: '#5a7cc0', hairStyle: 'kai', eye: '#55ccff',
    body: '#26304c', coat: '#1e2946', coat2: '#2e3f66', coatLen: 24, trim: '#4fd8ff', sleeve: '#1e2946',
    pants: '#161e36', boots: '#262f48', knee: '#2a3550', pauldron: '#a9b6cc', glove: '#1a2338', belt: '#2a3550',
  };
  const ZERO = {
    skin: '#e4cecb', hair: '#b3122e', hairHi: '#ff7a90', hairStyle: 'zero', eye: '#ff4060',
    body: '#24161e', coat: '#22141c', coat2: '#3a1628', coatLen: 30, trim: '#ff2a4a', sleeve: '#22141c',
    pants: '#1c1218', boots: '#2a1820', knee: '#2a1820', glove: '#1c1218', belt: '#2a1820',
  };
  const SOLDIER = {
    skin: '#c9d0e0', hairStyle: 'helmet', helm: '#283250', helmHi: '#3f4c72', eye: '#9ab0ff',
    body: '#283152', coat: '#252e4a', coat2: '#36425f', coatLen: 0, trim: '#9ab0ff', sleeve: '#252e4a',
    pants: '#192036', boots: '#262d44', knee: '#3a4566', pauldron: '#4a5878', glove: '#1e2538', chestPlate: '#3a4668', belt: '#3a4566',
  };
  const SNIPER = {
    skin: '#2a2a30', hairStyle: 'hood', eye: '#ffb35c',
    body: '#38322e', coat: '#2c2724', coat2: '#463c35', coatLen: 22, trim: '#ffb35c', sleeve: '#2c2724',
    pants: '#1e1b1a', boots: '#2a2522', knee: '#3a332e', glove: '#2a2522', sleeveTrim: false,
  };
  const ARKA = {
    skin: '#5a6a8a', hairStyle: 'knight', helm: '#6a7ea4', eye: '#ffe066',
    body: '#3a4866', coat: '#6a7ea4', coat2: '#8fa4c8', coatLen: 20, trim: '#ffe066', sleeve: '#5a6c90',
    pants: '#3a4866', boots: '#5a6c90', knee: '#8fa4c8', pauldron: '#8fa4c8', glove: '#4a5a7a', chestPlate: '#8fa4c8', belt: '#ffe066',
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
  const LIA = {
    skin: '#e6eefc', hair: '#bccff4', hairGlow: '#8fd8ff', body: '#bfe6ff', chest: '#e6f6ff', arm: '#cfeeff',
    glove: '#9fd8ff', skirt: '#78bdea', hem: '#5fd8ff', eye: '#4fc8ff', accent: '#5fd8ff', halo: true, legFade: 0.3,
  };
  const SERA = {
    skin: '#f2eaf4', hair: '#ece6fa', hairGlow: '#d8b8ff', body: '#eef0fa', chest: '#ffffff', arm: '#e8eaf6',
    glove: '#1e2444', skirt: '#262c50', hem: '#b07cff', eye: '#b98cff', accent: '#b07cff', shards: true, legFade: 0.1,
  };
  const PROTOCOL = {
    skin: '#f4f2f0', hair: '#e8ecf8', hairGlow: '#a8f0ff', body: '#f6f4ee', chest: '#ffffff', arm: '#ecebe4',
    glove: '#d8b860', skirt: '#e2c470', hem: '#66e0ff', eye: '#66e0ff', accent: '#66e0ff', wings: true, legFade: 0.1,
  };

  function lady(S, P, t) {
    push();
    tr(0, P.lift, 0);
    if (P.tilt) rz(P.tilt);
    // 치마와 다리
    push();
    tr(0, 30, 0);
    rx(P.lean * 0.3);
    for (const side of [1, -1]) {
      push();
      tr(side * 3, 0, 0);
      rx(-(side === 1 ? P.legL : P.legR));
      box(4.4, 16, 4.8, S.skin, { y: -8, tb: 0.7, fade: S.legFade });
      box(4, 14, 4.4, S.glove, { y: -22, tb: 0.6, fade: Math.min(0.9, S.legFade + 0.25) });
      pop();
    }
    prism(12 + P.flow * 3, 6, 14, 10, S.skirt, { y: -1 });
    prism(12.6 + P.flow * 3, 12 + P.flow * 3, 1.4, 10, S.hem, { kind: 2, y: -8.2, ea: 1.1, open: true });
    prism(6.4, 6.4, 1.8, 10, S.accent, { kind: 2, y: 6.4, ea: 1.0, open: true });
    // 몸통
    push();
    rx(P.lean * 0.5);
    ry(P.twist);
    box(10, 9, 7, S.body, { y: 9, tb: 0.85 });
    box(12, 9, 8, S.chest, { y: 16, tb: 0.85, tt: 1.05 });
    box(8, 2, 1, S.accent, { kind: 2, y: 13, z: 4.2, ea: 1.1 });
    box(4, 3.6, 4, S.skin, { y: 22 });
    // 머리
    push();
    tr(0, 30, 0.5);
    ry(P.headYaw);
    rx(P.headPitch);
    sc(1.16);
    box(9.6, 10.6, 9.6, S.skin, { tb: 0.82 });
    box(1.8, 1.4, 0.6, S.eye, { kind: 2, x: 2.2, y: 0.2, z: 4.9, ea: 1.4 });
    box(1.8, 1.4, 0.6, S.eye, { kind: 2, x: -2.2, y: 0.2, z: 4.9, ea: 1.4 });
    box(11, 4.4, 11, S.hair, { y: 5 });
    box(10.6, 6, 3, S.hair, { y: 2.4, z: 4, tb: 0.6 });
    const sway = Math.sin(t * 1.6) * 0.08 + P.flow * 0.3;
    push();
    tr(0, 2, -4.8);
    rx(0.12 + sway);
    for (const sd of [1, -1]) {
      push();
      tr(sd * 2.6, 0, 0);
      rz(sd * 0.08);
      box(5, 22, 3, S.hair, { y: -10, tb: 0.45 });
      box(2.4, 1, 3.2, S.hairGlow, { kind: 2, y: -21, ea: 0.9 });
      pop();
    }
    pop();
    for (const side of [1, -1]) {
      push();
      tr(side * 5.2, 1, 0.5);
      rz(side * (0.06 + sway * 0.3));
      box(2.6, 16, 5, S.hair, { y: -7, tb: 0.5 });
      pop();
    }
    if (S.halo) {
      push();
      tr(0, 8, -3);
      rx(-0.35);
      ring(9, 1, 12, S.accent, { kind: 2, ea: 1.3 });
      pop();
      glowL(0, 8, -3, 26, S.accent, 0.35);
    }
    pop();
    // 팔
    for (const side of [1, -1]) {
      const sh = side === 1 ? P.shL : P.shR;
      push();
      tr(side * 6.6, 19, 0);
      ry(sh[0]);
      rx(-sh[1]);
      rz(side * sh[2]);
      box(3.6, 12, 4, S.arm, { y: -6, tb: 0.85 });
      tr(0, -11.5, 0);
      rx(-(side === 1 ? P.elbL : P.elbR));
      box(3.3, 11, 3.6, S.glove, { y: -5.5, tb: 0.8 });
      if (P.glowHand && side === -1) glowL(0, -12, 0, 30 * P.glowHand, S.accent, 0.9 * P.glowHand);
      pop();
    }
    pop();
    pop();
    // 장식
    if (S.shards) {
      for (let i = 0; i < 5; i++) {
        const a = t * 0.9 + (i / 5) * TAU;
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
        for (let k = 0; k < 3; k++) {
          push();
          tr(side * 6, 48 - k * 5, -6);
          ry(side * (0.5 + k * 0.1));
          rz(side * (0.9 + k * 0.42 + Math.sin(t * 1.5) * 0.06));
          box(1.6, 34 - k * 6, 9, '#f4ecd0', { y: -(17 - k * 3), kind: 6, tb: 0.3 });
          box(0.8, 32 - k * 6, 1, S.accent, { kind: 2, x: 0, y: -(17 - k * 3), z: 4.8, ea: 1.2, tb: 0.3 });
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
  const K = { push, pop, tr, rx, ry, rz, sc, ap, box, prism, ball, ring, glowL, glowAt, quad, tri, humanoid, lady, manPose, ladyPose, basePose, swing, runCycle, weapon, clamp01, lerp, easeOut, easeIn, smooth, TAU, ARKA, ZERO };

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
          FADE = Math.max(FADE, 0.18);
          sc(1.0);
          lady(LIA, ladyPose(e, t), t);
          glowL(0, 40, 0, 70, '#8fd8ff', 0.22);
        } else {
          const P = manPose(e, W, t, 'blade');
          sc((e.r || 20) / 20 * 1.03);
          humanoid(ZERO, P, { type: 'blade', color: '#ff3355', len: 52 });
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

  function build(W, t, ghosts) {
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
          const wid = (p.stats && p.stats.weaponId) || 'blade';
          humanoid(KAI, manPose(snap, W, t, wid), null, null);
        } catch (err) { stack.length = 0; }
        TINT = null;
        FADE = 0;
      }
    }
    return { mesh: mesh.subarray(0, mn * STRIDE), meshCount: mn, glow: glow.subarray(0, gn * STRIDE), glowCount: gn, shadow: shad.subarray(0, sn * 6), shadowCount: sn };
  }

  return { build, BOSSES, K, KAI, ZERO, LIA, SERA, PROTOCOL, ARKA };
})();
