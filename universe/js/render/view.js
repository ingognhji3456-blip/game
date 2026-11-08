'use strict';

/*
 * 한 장면에 필요한 값 계산: 카메라(10의 거듭제곱 확대), 층마다 보이는 정도, 시간에 따라 바뀌는 모습.
 * L = log10(카메라 거리, 광년).  우주 거대 구조 ≈ 9.3 · 은하 ≈ 5.2 · 이웃 별 ≈ 1.4 · 태양계 ≈ −3
 */
(function () {
  const UC = (window.UC = window.UC || {});
  const U = UC.util;
  const C = UC.cosmo;
  const GX = UC.galaxy;
  const S = UC.solar;

  const L_MIN = -5.0;
  const L_MAX = 9.75;
  const LEVELS = [
    { id: 'web', icon: '🌌', name: '우주', L: 9.3, pitch: 0.42 },
    { id: 'galaxy', icon: '🌀', name: '은하', L: 5.05, pitch: 0.62 },
    { id: 'local', icon: '✨', name: '이웃 별', L: 1.5, pitch: 0.25 },
    { id: 'solar', icon: '☀️', name: '태양계', L: -3.05, pitch: 0.55 },
  ];
  const VIEWS = {
    web: { L: 9.3, pitch: 0.42 },
    local: { L: 6.9, pitch: 0.4 },
    galaxy: { L: 5.05, pitch: 0.62 },
    collision: { L: 6.05, pitch: 0.5 },
    solar: { L: -3.05, pitch: 0.55 },
  };

  const norm = (v) => {
    const l = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / l, v[1] / l, v[2] / l];
  };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const lerp3 = (a, b, t) => [U.lerp(a[0], b[0], t), U.lerp(a[1], b[1], t), U.lerp(a[2], b[2], t)];

  const ECL_ROT = (function () {
    const c0 = S.eclToWorld([1, 0, 0]);
    const c1 = S.eclToWorld([0, 1, 0]);
    const c2 = S.eclToWorld([0, 0, 1]);
    return [...c0, ...c1, ...c2];
  })();
  const eclDir = (v) => S.eclToWorld(v);
  /* 토성 자전축 (적경 40.6°, 적위 83.5°) */
  const SATURN_POLE = norm(S.radecToWorld(40.6 / 15, 83.5, 1));

  /* 주변 별 목록 (첫 자리는 태양) */
  function localStars() {
    const out = [{ id: 'sun', name: '태양', pos: [0, 0, 0], col: [1, 0.95, 0.85], lum: 0.15 }];
    for (const s of UC.data.STARS) {
      const col = s.nebula ? [1, 0.45, 0.65] : U.blackbody(s.T).map((x) => Math.pow(x, 2.2));
      out.push({ id: s.id, name: s.name, pos: S.radecToWorld(s.ra, s.dec, s.d), col, lum: Math.pow(s.L, 0.33) * 0.16, star: s });
    }
    return out;
  }

  function orbitShapes() {
    return S.PLANETS.map((p) => {
      const n = 160;
      const pts = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const E = (i / n) * Math.PI * 2;
        const x = Math.cos(E) - p.e;
        const y = Math.sqrt(1 - p.e * p.e) * Math.sin(E);
        const inc = (p.inc * Math.PI) / 180;
        const node = (p.node * Math.PI) / 180;
        pts[i * 3] = x * Math.cos(node) - y * Math.cos(inc) * Math.sin(node);
        pts[i * 3 + 1] = x * Math.sin(node) + y * Math.cos(inc) * Math.cos(node);
        pts[i * 3 + 2] = y * Math.sin(inc);
      }
      return pts;
    });
  }

  function camFrame(L) {
    const up = norm(lerp3([0, 1, 0], S.ECL_NORTH, U.smoothstep(0.5, -1.5, L)));
    const e1 = norm(cross(up, [0, 0, 1]));
    const e2 = cross(e1, up);
    return { up, e1, e2 };
  }

  /* 은하 쪽 상태: 충돌 계산, 두 은하 중심, 태양 자리 */
  function galaxyState(app, tau) {
    const SIM = GX.SIM;
    let sim = null;
    let p1 = [0, 0, 0];
    let p2 = GX.m31Center(Math.min(tau, SIM.t0));
    let sun = GX.SUN0.slice();
    if (tau >= SIM.t0 && app.collisionOK) {
      sim = GX.collision.at(Math.min(tau, SIM.t1));
      p1 = sim.p1;
      p2 = sim.p2;
      sun = sim.sun;
    }
    const m1 = GX.POT.mw.gmIn + GX.POT.mw.gmH;
    const m2 = GX.POT.m31.gmIn + GX.POT.m31.gmH;
    const com = [0, 1, 2].map((j) => (p1[j] * m1 + p2[j] * m2) / (m1 + m2));
    const k = U.smoothstep(SIM.t0, SIM.t0 + 1.2e9, tau);
    return { sim, p1, p2, sun, focus: lerp3(p1, com, k), merged: tau > GX.SIM.t0 + 3.5e9 };
  }

  function build(app, dims) {
    const tau = app.t;
    const run = app.run;
    const st = C.stateAt(run, tau);
    const lg = Math.log10(Math.max(tau, 1e-60));
    const cam = app.cam;
    const L = cam.L;
    const D = Math.pow(10, L);
    const gs = galaxyState(app, tau);
    const sunWorld = gs.sun;
    const focus = app.focusOverride || lerp3(gs.focus, sunWorld, U.smoothstep(5.2, 3.6, L));
    const fr = camFrame(L);
    const cp = Math.cos(cam.pitch);
    const dir = [0, 1, 2].map((j) => cp * (Math.cos(cam.yaw) * fr.e1[j] + Math.sin(cam.yaw) * fr.e2[j]) + Math.sin(cam.pitch) * fr.up[j]);
    const eye = [0, 1, 2].map((j) => focus[j] + D * dir[j]);
    const F = dir.map((x) => -x);
    const R = norm(cross(F, fr.up));
    const Up = cross(R, F);
    const camOut = { eye, R, U: Up, F, fovY: (55 * Math.PI) / 180, D, L, focus };

    /* 층마다 보이는 정도 */
    const w = {
      web: U.smoothstep(6.6, 7.5, L),
      galaxy: 1 - U.smoothstep(7.8, 8.8, L),
      local: U.smoothstep(-1.4, -0.4, L) * (1 - U.smoothstep(3.0, 3.9, L)),
      solar: 1 - U.smoothstep(-1.4, -0.4, L),
    };

    /* 끝난 우주 */
    let endFade = 1;
    if (run.endType === 'rip') endFade = 1 - U.smoothstep(run.tEnd - 2e5, run.tEnd, tau);
    if (st.ended && run.endType === 'rip') endFade = 0;

    /* --- 우주 거대 구조 --- */
    const looks = GX.looks(tau, st);
    const a = st.a;
    const gDisp = a <= 1 ? Math.pow(a, 0.35) : 1 + Math.min(st.log10a, 300) * 0.06;
    const lonely = st.contracting ? 0 : U.smoothstep(5e10, 1.6e11, tau - C.T_NOW) * (run.endType === 'crunch' ? 0 : 1);
    const web = {
      exposure: 1,
      u: {
        uD: U.clamp(st.D, 0, 3),
        uG: gDisp,
        uGasVis: U.smoothstep(C.T_RECOMB * 2, 4e6, tau) * (1 - U.smoothstep(2e8, 1.2e9, tau)),
        uOld: looks.old,
        uFade: looks.fade * endFade,
        uLonely: lonely,
        uHideHome: w.galaxy,
      },
    };

    /* --- 은하 --- */
    let ripG = 1;
    let ripS = 1;
    if (run.endType === 'rip') {
      const dt = run.tEnd - tau;
      const leadG = C.ripLead(2.5e8);
      const leadS = C.ripLead(1);
      if (dt < leadG) ripG = Math.min(1e4, Math.pow(Math.max(dt / leadG, 1e-4), -1.5));
      if (dt < leadS) ripS = Math.min(1e4, Math.pow(Math.max(dt / leadS, 1e-4), -1.5));
    }
    const bh = U.smoothstep(39, 40, lg) * (1 - U.smoothstep(99.6, 100, lg));
    const gal = {
      exposure: 1,
      sim: gs.sim,
      m31Center: gs.p2,
      mwAlpha: 1 - 0.45 * U.smoothstep(-0.5, -2.0, L),
      m31Alpha: 1,
      bh: bh * endFade,
      bhPos: gs.focus,
      u: {
        uSfr: looks.sfr / 0.6,
        uOld: looks.old,
        uFade: looks.fade * endFade,
        uGas: looks.gas,
        uEvap: looks.evap,
        uRip: ripG,
        uRipC: gs.focus,
        uDeg: U.smoothstep(14, 14.6, lg) * (1 - U.smoothstep(38, 40, lg)),
      },
    };

    /* --- 태양계 --- */
    const sun = S.sunAt(tau);
    const age = sun.age;
    const ago = (C.T_NOW - tau) / 1e9;
    const planets = S.PLANETS.map((p, i) => {
      const pst = S.planetAt(p, tau, sun);
      const pos = S.orbitPos(p, pst.a * ripS, app.wallT);
      const wd = eclDir(pos);
      const world = [0, 1, 2].map((j) => sunWorld[j] + wd[j] * S.AU_LY);
      const toV = (d) => [d[0] * R[0] + d[1] * R[1] + d[2] * R[2], d[0] * Up[0] + d[1] * Up[1] + d[2] * Up[2], -(d[0] * F[0] + d[1] * F[1] + d[2] * F[2])];
      let ringU = null;
      let ringV = null;
      if (p.rings) {
        const u0 = norm(cross(SATURN_POLE, [0, 1, 0]));
        const v0 = cross(SATURN_POLE, u0);
        ringU = toV(u0);
        ringV = toV(v0);
      }
      return { p, st: pst, world, ringU, ringV, seed: i * 3.7 + 1, spin: toV(p.id === 'uranus' ? eclDir([1, 0, 0.1]) : S.ECL_NORTH) };
    });
    const solar = {
      sun,
      planets,
      eclRot: ECL_ROT,
      mass: sun.exists ? sun.M : 1,
      belt: U.smoothstep(0.03, 0.12, age) * (sun.exists ? 1 : 0),
      disk: sun.exists ? sun.disk : 0,
      cloud: sun.cloud,
      nebula: sun.nebula,
      nebulaR: sun.nebulaR,
      sunL: sun.L,
      sunI: sun.exists ? 6.5 * U.clamp(Math.pow(sun.T / 5772, 2), 0.12, 2.5) * U.smoothstep(700, 3500, sun.T) : 0,
      orbitAlpha: 1,
      plA: S.PLANETS.map((p) => p.a),
      plB: S.PLANETS.map((p) => U.smoothstep(p.born * 0.6, p.born * 1.6 + 0.004, age)),
      earthBlue: U.smoothstep(0.4, 0.8, age) * (1 - U.smoothstep(-0.9, -1.8, ago)),
      rip: ripS,
    };
    if (endFade < 1) { solar.sunI *= endFade; }

    /* --- 초기 우주: 불투명한 플라스마 · 우주 배경 복사 --- */
    const T = st.T;
    const lgT = Math.log10(Math.max(T, 1));
    let plasmaA = U.smoothstep(2600, 3400, T);
    let bb = U.blackbody(Math.min(T, 40000)).map((x) => Math.pow(x, 2.2));
    const violet = U.smoothstep(10, 14, lgT);
    bb = bb.map((x, i) => U.lerp(x, [0.92, 0.85, 1.0][i], violet));
    const inten = U.clamp(1.3 + 0.2 * (lgT - 3.48), 1.3, 3.2);
    const Y = U.YEAR_S;
    const birth = tau < 1e-32 / Y ? U.clamp(0.03 + 0.97 * U.smoothstep(Math.log10(UC.time.TAU_START), Math.log10(1e-32 / Y), lg), 0, 1) : 1;
    const cmbOn = U.smoothstep(C.T_RECOMB * 0.85, C.T_RECOMB * 1.25, tau) * (1 - U.smoothstep(C.T_RECOMB * 1.6, 1.5e7, tau)) * (st.contracting ? 0 : 1);
    const cmbCol = U.blackbody(Math.max(T, 1000)).map((x) => Math.pow(x, 2.2) * 0.75 * Math.pow(U.clamp(T / 3000, 0, 1), 2));
    let flash = U.smoothstep(99.85, 100, lg) * (1 - U.smoothstep(100, 100.15, lg)) * 0.6;
    if (st.ended && run.endType === 'crunch') { plasmaA = 1; flash = 0.5; }
    const plasma = {
      a: plasmaA,
      col: bb.map((x) => x * inten),
      scale: 1.8 + 5 * U.smoothstep(4, 30, lgT),
      birth,
      cmb: cmbOn,
      cmbCol,
      flash,
    };
    if (st.ended && run.endType === 'rip') { w.web = 0; w.galaxy = 0; w.local = 0; w.solar = 0; }

    return {
      tau, tauG: Math.min(tau / 1e9, 1000), st, cam: camOut, w, web, gal, solar, sunWorld, plasma,
      wallT: app.wallT, exposure: 1.0, bloom: 0.9, galFocus: gs.focus, m31: gs.p2, merged: gs.merged, looks, lg,
    };
  }

  UC.view = { build, LEVELS, VIEWS, L_MIN, L_MAX, localStars, orbitShapes, camFrame };
})();
