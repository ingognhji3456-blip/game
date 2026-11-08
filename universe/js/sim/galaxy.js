'use strict';

/*
 * 우리 은하와 안드로메다 은하.
 *
 * 1) 별 입자를 미리 만들어 둡니다. 입자마다 "다 자란 모습"의 자리(posF)와 "갓 태어난 은하"의 자리(posE,
 *    작은 덩어리들 속)를 갖고, 시간이 지나면 덩어리들이 합쳐져 팽대부·두꺼운 원반·얇은 원반·나선팔이 됩니다.
 * 2) 안드로메다와의 충돌(지금부터 30억~90억 년 뒤)은 실제로 중력을 계산합니다(제한 N체 모형).
 *    두 은하의 중심(별 원반 + 암흑 물질 헤일로, 플러머 퍼텐셜)이 서로 끌어당기며 다가오고,
 *    가까워지면 동역학적 마찰로 합쳐집니다. 별 입자 6천여 개는 두 퍼텐셜 속에서 움직이며 꼬리를 그립니다.
 *    화면의 나머지 별들은 가장 가까운 계산 입자를 따라갑니다.
 * 단위: 광년, 백만 년(Myr). 원반은 XZ 평면, Y 가 은하 북극 방향입니다.
 */
(function () {
  const UC = (window.UC = window.UC || {});
  const U = UC.util;
  const C = UC.cosmo;
  const NOW = C.T_NOW;

  const R_SUN = 26000;
  const SUN0 = [R_SUN, 55, 0];
  const STRIDE = 20;
  const TYPE = { BULGE: 0, THICK: 1, THIN: 2, YOUNG: 3, HII: 4, HALO: 5, GSE: 6, DUST: 7 };

  /* 은하 퍼텐셜: 별 원반 부분(안쪽) + 헤일로 */
  const POT = {
    mw: { gmIn: 3.5e10, aIn: 25000, gmH: 0.9e11, aH: 120000 },
    m31: { gmIn: 4.5e10, aIn: 30000, gmH: 1.2e11, aH: 140000 },
  };

  const SPEC = {
    mw: { n: 92000, nDust: 22000, h: 9000, rMax: 52000, arms: 4, pitch: (12.5 * Math.PI) / 180, armA: 0.55, bulge: 0.13, bar: 15000, barAng: (27 * Math.PI) / 180, thin: 900, thick: 3000, halo: 0.035, gse: 0.03, young: 0.2, hii: 0.035, seed: 11 },
    m31: { n: 42000, nDust: 9000, h: 15000, rMax: 85000, arms: 2, pitch: (9 * Math.PI) / 180, armA: 0.45, bulge: 0.24, bar: 0, barAng: 0, thin: 1200, thick: 3800, halo: 0.05, gse: 0, young: 0.12, hii: 0.02, seed: 23 },
  };

  /* 안드로메다의 기울어진 원반 (지구에서 보는 기울기 77°를 참고한 방향) */
  const M31_ROT = (function () {
    const a = (77 * Math.PI) / 180;
    const b = (38 * Math.PI) / 180;
    const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
    /* X축으로 a, Y축으로 b 회전 (열 우선 3x3) */
    const rx = [1, 0, 0, 0, ca, sa, 0, -sa, ca];
    const ry = [cb, 0, -sb, 0, 1, 0, sb, 0, cb];
    const m = new Array(9).fill(0);
    for (let c = 0; c < 3; c++) for (let r = 0; r < 3; r++) for (let k = 0; k < 3; k++) m[c * 3 + r] += ry[k * 3 + r] * rx[c * 3 + k];
    return m;
  })();
  const rot = (m, v) => [m[0] * v[0] + m[3] * v[1] + m[6] * v[2], m[1] * v[0] + m[4] * v[1] + m[7] * v[2], m[2] * v[0] + m[5] * v[1] + m[8] * v[2]];

  const laplace = (r, s) => {
    const u = r() - 0.5;
    return -s * Math.sign(u) * Math.log(1 - 2 * Math.abs(u));
  };

  /* ---------- 입자 만들기 ---------- */
  function buildGalaxy(key) {
    const S = SPEC[key];
    const r = U.rng(S.seed);
    const total = S.n + S.nDust;
    const A = new Float32Array(total * STRIDE);
    const armTheta = (rad) => -Math.log(Math.max(rad, 500) / 4000) / Math.tan(S.pitch);
    const K = key === 'mw' ? 9 : 7;
    const clumps = [];
    for (let k = 0; k < K; k++) {
      const rr = 8000 + r() * 50000;
      const th = r() * Math.PI * 2;
      clumps.push([rr * Math.cos(th), (r() - 0.5) * 30000, rr * Math.sin(th), 2500 + r() * 4000]);
    }
    const gseC = [-95000, 30000, 40000];
    const W = { [TYPE.BULGE]: 1.0, [TYPE.THICK]: 0.55, [TYPE.THIN]: 0.75, [TYPE.YOUNG]: 1.5, [TYPE.HII]: 2.4, [TYPE.HALO]: 0.35, [TYPE.GSE]: 0.45, [TYPE.DUST]: 0 };
    let lumSum = 0;

    const diskRadius = () => Math.min(-S.h * Math.log(Math.max(1e-9, r() * r())), S.rMax * (0.8 + 0.2 * r()));

    for (let i = 0; i < total; i++) {
      const o = i * STRIDE;
      let type;
      const u = r();
      if (i >= S.n) type = TYPE.DUST;
      else if (u < S.bulge) type = TYPE.BULGE;
      else if (u < S.bulge + S.halo) type = TYPE.HALO;
      else if (u < S.bulge + S.halo + S.gse) type = TYPE.GSE;
      else if (u < S.bulge + S.halo + S.gse + S.young) type = TYPE.YOUNG;
      else if (u < S.bulge + S.halo + S.gse + S.young + S.hii) type = TYPE.HII;
      else if (u < S.bulge + S.halo + S.gse + S.young + S.hii + 0.17) type = TYPE.THICK;
      else type = TYPE.THIN;

      let p;
      let size = 380;
      let temp = 5600;
      let birth = 6;
      let s0 = 4;
      let s1 = 8;
      if (type === TYPE.BULGE) {
        if (S.bar && r() < 0.6) {
          const x = U.gauss(r) * S.bar * 0.42, y = U.gauss(r) * 1700, z = U.gauss(r) * S.bar * 0.17;
          const c = Math.cos(S.barAng), s = Math.sin(S.barAng);
          p = [x * c - z * s, y, x * s + z * c];
        } else {
          const rr = Math.abs(U.gauss(r)) * (key === 'mw' ? 4200 : 7000);
          const th = r() * Math.PI * 2, ph = Math.acos(2 * r() - 1);
          p = [rr * Math.sin(ph) * Math.cos(th), rr * Math.cos(ph) * 0.75, rr * Math.sin(ph) * Math.sin(th)];
        }
        size = 820; temp = 4300 + r() * 600; birth = 0.5 + r() * r() * 3; s0 = 0.8; s1 = 3.0;
      } else if (type === TYPE.HALO || type === TYPE.GSE) {
        const rr = 6000 / Math.pow(Math.max(1e-4, r()), 0.55) ;
        const rc = Math.min(rr, 160000);
        const th = r() * Math.PI * 2, ph = Math.acos(2 * r() - 1);
        p = [rc * Math.sin(ph) * Math.cos(th), rc * Math.cos(ph), rc * Math.sin(ph) * Math.sin(th)];
        if (type === TYPE.GSE) { p[0] *= 1.5; p[1] *= 0.6; }
        size = 900; temp = 4200 + r() * 500; birth = type === TYPE.GSE ? 0.8 + r() * 1.7 : 0.4 + r() * 1.1;
        s0 = type === TYPE.GSE ? 3.3 : 0.8; s1 = type === TYPE.GSE ? 4.4 : 2.5;
      } else if (type === TYPE.YOUNG || type === TYPE.HII) {
        let rad = diskRadius();
        while (rad < 5000) rad = diskRadius();
        const arm = Math.floor(r() * S.arms);
        const spread = type === TYPE.HII ? 0.07 : 0.16;
        const th = armTheta(rad) + (arm * 2 * Math.PI) / S.arms + U.gauss(r) * spread + 0.08;
        p = [rad * Math.cos(th), laplace(r, S.thin * 0.45), rad * Math.sin(th)];
        size = type === TYPE.HII ? 380 : 480;
        temp = type === TYPE.HII ? 0 : 9000 + r() * 16000;
        birth = 5.5 + r() * 1.5; s0 = 5.0; s1 = 8.0;
      } else if (type === TYPE.DUST) {
        let rad = diskRadius();
        while (rad < 3500) rad = diskRadius();
        const arm = Math.floor(r() * S.arms);
        const th = armTheta(rad) + (arm * 2 * Math.PI) / S.arms + U.gauss(r) * 0.2 - 0.05;
        p = [rad * Math.cos(th), laplace(r, S.thin * 0.35), rad * Math.sin(th)];
        size = 1100 + r() * 900; temp = 0; birth = 5 + r() * 2; s0 = 4.5; s1 = 8.5;
      } else {
        /* 원반: 나선팔 쪽이 조금 더 붐비게 */
        let rad;
        let th;
        for (let tries = 0; tries < 20; tries++) {
          rad = diskRadius();
          th = r() * Math.PI * 2;
          let d = 1e9;
          for (let a = 0; a < S.arms; a++) {
            let dd = th - armTheta(rad) - (a * 2 * Math.PI) / S.arms;
            dd = Math.atan2(Math.sin(dd), Math.cos(dd));
            d = Math.min(d, Math.abs(dd));
          }
          const accept = (1 + S.armA * Math.exp(-(d * d) / 0.12) * (type === TYPE.THIN ? 1 : 0.4)) / (1 + S.armA);
          if (r() < accept) break;
        }
        const zs = type === TYPE.THIN ? S.thin : S.thick;
        p = [rad * Math.cos(th), laplace(r, zs), rad * Math.sin(th)];
        size = type === TYPE.THIN ? 640 : 760;
        temp = type === TYPE.THIN ? 4600 + r() * 2600 : 4500 + r() * 900;
        birth = type === TYPE.THIN ? 5 + r() * 8.8 : 1.5 + r() * 4.5;
        s0 = type === TYPE.THIN ? 4.5 : 1.5;
        s1 = type === TYPE.THIN ? 8.5 : 5.0;
      }

      /* 태어나던 무렵의 자리 */
      let e;
      if (type === TYPE.GSE) {
        e = [gseC[0] + U.gauss(r) * 6000, gseC[1] + U.gauss(r) * 6000, gseC[2] + U.gauss(r) * 6000];
      } else {
        const c = clumps[Math.floor(r() * K)];
        const sc = type === TYPE.HALO ? 2.5 : 1;
        e = [c[0] + U.gauss(r) * c[3] * sc, c[1] + U.gauss(r) * c[3] * sc, c[2] + U.gauss(r) * c[3] * sc];
        /* 늦게 자리잡는 별일수록 이미 원반 쪽으로 다가와 있음 */
        const k = U.smoothstep(1.5, 8, s0);
        for (let j = 0; j < 3; j++) e[j] = U.lerp(e[j], p[j] * 1.4, k);
      }
      const jit = (r() - 0.5) * 0.8;

      A[o] = p[0]; A[o + 1] = p[1]; A[o + 2] = p[2]; A[o + 3] = type;
      A[o + 4] = e[0]; A[o + 5] = e[1]; A[o + 6] = e[2]; A[o + 7] = birth;
      const lum = W[type] * (0.6 + 0.8 * r());
      A[o + 8] = lum; A[o + 9] = size; A[o + 10] = temp / 1000; A[o + 11] = r();
      A[o + 12] = s0 + jit; A[o + 13] = s1 + jit; A[o + 14] = -1; A[o + 15] = 0;
      lumSum += lum;
    }
    for (let i = 0; i < total; i++) A[i * STRIDE + 8] /= lumSum;
    return { key, data: A, count: total, stars: S.n, dust: S.nDust };
  }

  /* ---------- 안드로메다의 접근 (충돌 전) ---------- */
  const SIM = {
    t0: NOW + 3.0e9,
    t1: NOW + 9.0e9,
    dtMyr: 2.5,
    ckSteps: 80, // 200 Myr 마다 저장
    nMW: 4200,
    nA: 2600,
  };
  SIM.steps = Math.round((SIM.t1 - SIM.t0) / 1e6 / SIM.dtMyr);
  SIM.nCk = Math.floor(SIM.steps / SIM.ckSteps) + 1;
  SIM.n = SIM.nMW + SIM.nA;

  function accelFrom(g, cx, cy, cz, px, py, pz, out, sign) {
    const dx = px - cx, dy = py - cy, dz = pz - cz;
    const r2 = dx * dx + dy * dy + dz * dz;
    const q1 = r2 + g.aIn * g.aIn;
    const q2 = r2 + g.aH * g.aH;
    const k = (g.gmIn / (q1 * Math.sqrt(q1)) + g.gmH / (q2 * Math.sqrt(q2))) * sign;
    out[0] -= k * dx; out[1] -= k * dy; out[2] -= k * dz;
  }
  function vCirc(g, rad) {
    const r2 = rad * rad;
    const v2 = (g.gmIn * r2) / Math.pow(r2 + g.aIn * g.aIn, 1.5) + (g.gmH * r2) / Math.pow(r2 + g.aH * g.aH, 1.5);
    return Math.sqrt(v2);
  }

  /* 두 중심의 움직임 (동역학적 마찰 포함) */
  const DF = { k: 0.0011, r: 160000 };
  function centerStep(c, dt) {
    const a1 = [0, 0, 0];
    const a2 = [0, 0, 0];
    accelFrom(POT.m31, c.p2[0], c.p2[1], c.p2[2], c.p1[0], c.p1[1], c.p1[2], a1, 1);
    accelFrom(POT.mw, c.p1[0], c.p1[1], c.p1[2], c.p2[0], c.p2[1], c.p2[2], a2, 1);
    const dx = c.p2[0] - c.p1[0], dy = c.p2[1] - c.p1[1], dz = c.p2[2] - c.p1[2];
    const rr = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const f = DF.k / (1 + (rr / DF.r) * (rr / DF.r));
    const m1 = POT.mw.gmIn + POT.mw.gmH;
    const m2 = POT.m31.gmIn + POT.m31.gmH;
    for (let j = 0; j < 3; j++) {
      const vr = c.v2[j] - c.v1[j];
      a1[j] += f * vr * (m2 / (m1 + m2));
      a2[j] -= f * vr * (m1 / (m1 + m2));
    }
    return [a1, a2];
  }

  /* 지금(T_NOW) 안드로메다: 250만 광년, 초속 110km(=367 광년/Myr)로 다가오고, 옆으로 조금 비껴 움직임 */
  const M31_DIR = (function () {
    const v = [-0.52, 0.34, 0.78];
    const l = Math.hypot(v[0], v[1], v[2]);
    return v.map((x) => x / l);
  })();
  const M31_SIDE = (function () {
    const up = [0, 1, 0];
    const s = [M31_DIR[1] * up[2] - M31_DIR[2] * up[1], M31_DIR[2] * up[0] - M31_DIR[0] * up[2], M31_DIR[0] * up[1] - M31_DIR[1] * up[0]];
    const l = Math.hypot(s[0], s[1], s[2]);
    return s.map((x) => x / l);
  })();
  const VR0 = 367;
  const VT0 = 60;

  /* 지금부터 충돌 계산 시작(t0)까지 두 중심을 미리 풀어 둠 (MW 정지 좌표) */
  const APPROACH = (function () {
    const c = {
      p1: [0, 0, 0], v1: [0, 0, 0],
      p2: M31_DIR.map((x) => x * 2.5e6),
      v2: M31_DIR.map((x, j) => -x * VR0 + M31_SIDE[j] * VT0),
    };
    const dt = SIM.dtMyr;
    const n = Math.round((SIM.t0 - NOW) / 1e6 / dt);
    const rel = new Float64Array((n + 1) * 3);
    const relV = new Float64Array(3);
    const store = (k) => { for (let j = 0; j < 3; j++) rel[k * 3 + j] = c.p2[j] - c.p1[j]; };
    store(0);
    for (let k = 1; k <= n; k++) {
      let [a1, a2] = centerStep(c, dt);
      for (let j = 0; j < 3; j++) { c.v1[j] += 0.5 * dt * a1[j]; c.v2[j] += 0.5 * dt * a2[j]; }
      for (let j = 0; j < 3; j++) { c.p1[j] += dt * c.v1[j]; c.p2[j] += dt * c.v2[j]; }
      [a1, a2] = centerStep(c, dt);
      for (let j = 0; j < 3; j++) { c.v1[j] += 0.5 * dt * a1[j]; c.v2[j] += 0.5 * dt * a2[j]; }
      store(k);
    }
    for (let j = 0; j < 3; j++) relV[j] = c.v2[j] - c.v1[j];
    return { rel, n, relV };
  })();

  /* 안드로메다 중심 위치 (충돌 계산 전, 우리 은하 중심 기준) */
  function m31Center(tau) {
    if (tau <= NOW) {
      const back = (NOW - tau) / 1e6;
      const v0 = M31_DIR.map((x, j) => -x * VR0 + M31_SIDE[j] * VT0);
      return [0, 1, 2].map((j) => M31_DIR[j] * 2.5e6 - v0[j] * back);
    }
    const k = U.clamp((tau - NOW) / 1e6 / SIM.dtMyr, 0, APPROACH.n);
    const i = Math.min(Math.floor(k), APPROACH.n - 1);
    const f = k - i;
    return [0, 1, 2].map((j) => APPROACH.rel[i * 3 + j] + f * (APPROACH.rel[(i + 1) * 3 + j] - APPROACH.rel[i * 3 + j]));
  }

  /* ---------- 충돌 계산 ---------- */
  function Collision(mw, m31) {
    this.mw = mw;
    this.m31 = m31;
    this.n = SIM.n;
    this.ck = new Array(SIM.nCk).fill(null);
    this.ckDone = 0;
    this.cur = null;
    this.init();
  }

  Collision.prototype.init = function () {
    const n = this.n;
    const pos = new Float32Array(n * 3);
    const vel = new Float32Array(n * 3);
    const r = U.rng(99);
    const c2 = m31Center(SIM.t0);
    const relV = APPROACH.relV;
    /* 계산 입자 뽑기: 별 입자 가운데 고르게 (먼지는 빼고), 0번은 태양 */
    const pick = (G, count, skipSun) => {
      const idx = [];
      const step = G.stars / count;
      for (let k = 0; k < count; k++) idx.push(Math.min(G.stars - 1, Math.floor((k + r()) * step)));
      if (skipSun) idx[0] = -1;
      return idx;
    };
    this.idxMW = pick(this.mw, SIM.nMW, true);
    this.idxA = pick(this.m31, SIM.nA, false);
    const setBody = (k, p, v) => {
      pos[k * 3] = p[0]; pos[k * 3 + 1] = p[1]; pos[k * 3 + 2] = p[2];
      vel[k * 3] = v[0]; vel[k * 3 + 1] = v[1]; vel[k * 3 + 2] = v[2];
    };
    const circ = (g, lp, typeId) => {
      const rad = Math.hypot(lp[0], lp[2]);
      const vc = vCirc(g, Math.max(rad, 300));
      let fr = 1;
      let disp = 0.08;
      if (typeId === TYPE.BULGE) { fr = 0.45; disp = 0.45; }
      if (typeId === TYPE.HALO || typeId === TYPE.GSE) { fr = 0.1; disp = 0.6; }
      if (typeId === TYPE.THICK) { fr = 0.85; disp = 0.2; }
      const v = [(-lp[2] / Math.max(rad, 1)) * vc * fr, 0, (lp[0] / Math.max(rad, 1)) * vc * fr];
      for (let j = 0; j < 3; j++) v[j] += U.gauss(r) * vc * disp * 0.5;
      return v;
    };
    for (let k = 0; k < SIM.nMW; k++) {
      if (this.idxMW[k] < 0) {
        setBody(k, SUN0, circ(POT.mw, SUN0, TYPE.THIN).map((v, j) => (j === 1 ? 0 : v)));
        continue;
      }
      const o = this.idxMW[k] * STRIDE;
      const lp = [this.mw.data[o], this.mw.data[o + 1], this.mw.data[o + 2]];
      setBody(k, lp, circ(POT.mw, lp, this.mw.data[o + 3]));
    }
    for (let k = 0; k < SIM.nA; k++) {
      const o = this.idxA[k] * STRIDE;
      const lp = [this.m31.data[o], this.m31.data[o + 1], this.m31.data[o + 2]];
      const wp = rot(M31_ROT, lp);
      const wv = rot(M31_ROT, circ(POT.m31, lp, this.m31.data[o + 3]));
      setBody(SIM.nMW + k, [wp[0] + c2[0], wp[1] + c2[1], wp[2] + c2[2]], [wv[0] + relV[0], wv[1] + relV[1], wv[2] + relV[2]]);
    }
    this.ck[0] = { pos, vel, c: { p1: [0, 0, 0], v1: [0, 0, 0], p2: c2.slice(), v2: Array.from(relV) } };
    this.ckDone = 1;
    this.bind();
  };

  /* 화면용 별을 가장 가까운 계산 입자에 묶기 (공간 격자로 찾기) */
  Collision.prototype.bind = function () {
    const c2 = m31Center(SIM.t0);
    const doBind = (G, idxList, base, world) => {
      const cell = 2500;
      const map = new Map();
      const keyI = (ix, iy, iz) => ((ix + 1024) * 2048 + (iy + 1024)) * 2048 + (iz + 1024);
      const key = (x, y, z) => keyI(Math.floor(x / cell), Math.floor(y / cell), Math.floor(z / cell));
      const P0 = this.ck[0].pos;
      const pts = idxList.map((_, k) => [P0[(base + k) * 3], P0[(base + k) * 3 + 1], P0[(base + k) * 3 + 2]]);
      pts.forEach((p, k) => {
        const kk = key(p[0], p[1], p[2]);
        if (!map.has(kk)) map.set(kk, []);
        map.get(kk).push(k);
      });
      for (let i = 0; i < G.count; i++) {
        const o = i * STRIDE;
        let wp = [G.data[o], G.data[o + 1], G.data[o + 2]];
        if (world) { wp = rot(M31_ROT, wp); wp = [wp[0] + c2[0], wp[1] + c2[1], wp[2] + c2[2]]; }
        let best = -1;
        let bd = Infinity;
        for (let rad = 0; rad <= 6 && best < 0; rad++) {
          const cx = Math.floor(wp[0] / cell), cy = Math.floor(wp[1] / cell), cz = Math.floor(wp[2] / cell);
          for (let dx = -rad; dx <= rad; dx++) for (let dy = -rad; dy <= rad; dy++) for (let dz = -rad; dz <= rad; dz++) {
            if (Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) !== rad) continue;
            const list = map.get(keyI(cx + dx, cy + dy, cz + dz));
            if (!list) continue;
            for (const k of list) {
              const p = pts[k];
              const d = (p[0] - wp[0]) ** 2 + (p[1] - wp[1]) ** 2 + (p[2] - wp[2]) ** 2;
              if (d < bd) { bd = d; best = k; }
            }
          }
        }
        if (best < 0) {
          for (let k = 0; k < pts.length; k++) {
            const p = pts[k];
            const d = (p[0] - wp[0]) ** 2 + (p[1] - wp[1]) ** 2 + (p[2] - wp[2]) ** 2;
            if (d < bd) { bd = d; best = k; }
          }
        }
        const p = pts[best];
        G.data[o + 14] = base + best;
        G.data[o + 16] = wp[0] - p[0];
        G.data[o + 17] = wp[1] - p[1];
        G.data[o + 18] = wp[2] - p[2];
      }
    };
    doBind(this.mw, this.idxMW, 0, false);
    doBind(this.m31, this.idxA, SIM.nMW, true);
  };

  /* 별 입자 가속도: 두 은하 퍼텐셜의 합 */
  function particleAcc(st, n) {
    const { pos, c } = st;
    const acc = st.acc || (st.acc = new Float32Array(n * 3));
    const g1 = POT.mw, g2 = POT.m31;
    const a1i = g1.aIn * g1.aIn, a1h = g1.aH * g1.aH, a2i = g2.aIn * g2.aIn, a2h = g2.aH * g2.aH;
    const x1 = c.p1[0], y1 = c.p1[1], z1 = c.p1[2], x2 = c.p2[0], y2 = c.p2[1], z2 = c.p2[2];
    for (let k = 0, i = 0; k < n; k++, i += 3) {
      let dx = pos[i] - x1, dy = pos[i + 1] - y1, dz = pos[i + 2] - z1;
      let r2 = dx * dx + dy * dy + dz * dz;
      let q1 = r2 + a1i, q2 = r2 + a1h;
      let f = g1.gmIn / (q1 * Math.sqrt(q1)) + g1.gmH / (q2 * Math.sqrt(q2));
      let ax = -f * dx, ay = -f * dy, az = -f * dz;
      dx = pos[i] - x2; dy = pos[i + 1] - y2; dz = pos[i + 2] - z2;
      r2 = dx * dx + dy * dy + dz * dz;
      q1 = r2 + a2i; q2 = r2 + a2h;
      f = g2.gmIn / (q1 * Math.sqrt(q1)) + g2.gmH / (q2 * Math.sqrt(q2));
      acc[i] = ax - f * dx; acc[i + 1] = ay - f * dy; acc[i + 2] = az - f * dz;
    }
    return acc;
  }

  Collision.prototype.step = function (st, steps) {
    const dt = SIM.dtMyr;
    const h = 0.5 * dt;
    const n = this.n;
    const m = n * 3;
    const { pos, vel, c } = st;
    if (!st.acc) particleAcc(st, n);
    if (!c.a1) [c.a1, c.a2] = centerStep(c, dt);
    for (let s = 0; s < steps; s++) {
      const acc = st.acc;
      for (let i = 0; i < m; i++) { vel[i] += h * acc[i]; pos[i] += dt * vel[i]; }
      for (let j = 0; j < 3; j++) {
        c.v1[j] += h * c.a1[j]; c.v2[j] += h * c.a2[j];
        c.p1[j] += dt * c.v1[j]; c.p2[j] += dt * c.v2[j];
      }
      [c.a1, c.a2] = centerStep(c, dt);
      for (let j = 0; j < 3; j++) { c.v1[j] += h * c.a1[j]; c.v2[j] += h * c.a2[j]; }
      particleAcc(st, n);
      for (let i = 0; i < m; i++) vel[i] += h * acc[i];
    }
  };

  const cloneState = (s) => ({
    pos: Float32Array.from(s.pos), vel: Float32Array.from(s.vel), acc: s.acc ? Float32Array.from(s.acc) : null,
    c: { p1: s.c.p1.slice(), v1: s.c.v1.slice(), p2: s.c.p2.slice(), v2: s.c.v2.slice(), a1: s.c.a1 && s.c.a1.slice(), a2: s.c.a2 && s.c.a2.slice() },
  });

  /* 저장점을 하나 더 계산 (한가할 때 조금씩 불러 씀). 다 했으면 false */
  Collision.prototype.work = function () {
    if (this.ckDone >= SIM.nCk) return false;
    const st = cloneState(this.ck[this.ckDone - 1]);
    const left = SIM.steps - (this.ckDone - 1) * SIM.ckSteps;
    this.step(st, Math.min(SIM.ckSteps, left));
    this.ck[this.ckDone] = st;
    this.ckDone++;
    return true;
  };

  /* tau 의 계산 입자 상태. 충돌 계산 구간 밖이면 null */
  Collision.prototype.at = function (tau) {
    if (tau < SIM.t0) return null;
    const myr = Math.min((tau - SIM.t0) / 1e6, SIM.steps * SIM.dtMyr);
    const stepF = myr / SIM.dtMyr;
    const ckI = Math.min(Math.floor(stepF / SIM.ckSteps), SIM.nCk - 1);
    while (this.ckDone <= ckI) this.work();
    const target = Math.min(Math.floor(stepF), SIM.steps);
    let cur = this.cur;
    if (!cur || cur.step > target || cur.step < ckI * SIM.ckSteps || target - cur.step > SIM.ckSteps) {
      cur = cloneState(this.ck[ckI]);
      cur.step = ckI * SIM.ckSteps;
    }
    if (target > cur.step) {
      this.step(cur, target - cur.step);
      cur.step = target;
    }
    this.cur = cur;
    /* 마지막 걸음 사이는 속도로 메움 */
    const rem = (stepF - target) * SIM.dtMyr;
    const n = this.n;
    const out = this.out || (this.out = new Float32Array(n * 3));
    for (let i = 0; i < n * 3; i++) out[i] = cur.pos[i] + cur.vel[i] * rem;
    const c = cur.c;
    const p1 = c.p1.map((v, j) => v + c.v1[j] * rem);
    const p2 = c.p2.map((v, j) => v + c.v2[j] * rem);
    return { pos: out, p1, p2, sun: [out[0], out[1], out[2]] };
  };

  /* ---------- 시간에 따라 바뀌는 전체 값 (셰이더에 넘김) ---------- */
  function looks(tau, st) {
    const g = tau / 1e9;
    /* 별 탄생률: 빅뱅 후 35억 년에 가장 높고, 먼 미래에는 가스가 바닥남 */
    const sfr = U.smoothstep(0.15, 0.8, g) * (0.35 + 0.65 * Math.exp(-Math.pow((g - 3.5) / 3.5, 2))) * (1 - U.smoothstep(14, 1e3, g)) + 0.04 * (1 - U.smoothstep(100, 1e4, g));
    /* 오래된 별들이 붉어지고 어두워지는 정도 */
    const lg = Math.log10(Math.max(tau, 1));
    const old = U.smoothstep(11.5, 14, lg);
    const fade = Math.max(0, 1 - U.smoothstep(12.3, 14.1, lg) * 0.985) * (1 - U.smoothstep(18, 21, lg) * 0.6);
    const gas = U.smoothstep(0.12, 0.4, g) * (1 - U.smoothstep(6, 30, g)) * 0.9;
    /* 은하가 흩어짐 (10¹⁹년) */
    const evap = U.smoothstep(18.3, 20, lg);
    return { g, sfr, old, fade, gas, evap, tau };
  }

  let mwG = null;
  let m31G = null;
  let collision = null;
  function init() {
    if (mwG) return;
    mwG = buildGalaxy('mw');
    m31G = buildGalaxy('m31');
  }
  /* 충돌 계산은 처음 필요할 때 준비 (별을 계산 입자에 묶는 일 포함) */
  function getCollision() {
    init();
    if (!collision) collision = new Collision(mwG, m31G);
    return collision;
  }

  UC.galaxy = {
    STRIDE, TYPE, SUN0, R_SUN, SIM, POT, M31_ROT, init, looks, m31Center, vCirc,
    get mw() { return mwG; },
    get m31() { return m31G; },
    get collision() { return getCollision(); },
    collisionReady: () => !!collision,
  };
})();
