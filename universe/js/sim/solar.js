'use strict';

/*
 * 태양계: 태양의 일생(원시 구름 → 원시 행성 원반 → 주계열 → 적색거성 → 행성상 성운 → 백색왜성 → 흑색왜성)과
 * 행성들. 태양의 반지름·밝기·온도는 표준 항성 진화 모형(Sackmann 1993, Schröder & Smith 2008)의 값을 간추렸습니다.
 * 태양이 질량을 잃으면 행성 궤도는 그만큼 넓어지고(a ∝ 1/M), 부푼 태양에 닿은 행성은 삼켜집니다.
 * 시간: 빅뱅 후 햇수. 거리: AU.
 */
(function () {
  const UC = (window.UC = window.UC || {});
  const U = UC.util;
  const NOW = UC.cosmo.T_NOW;
  const T_SUN = NOW - 4.568e9;
  const RSUN_AU = 0.00465047;
  const AU_LY = 1 / 63241.077;

  /* 나이(십억 년), 반지름(태양=1), 밝기(태양=1), 표면 온도(K), 질량(태양=1) */
  const TRACK = [
    [0.0, 1.6, 1.4, 4600, 1.0],
    [0.03, 0.92, 0.72, 5600, 1.0],
    [4.568, 1.0, 1.0, 5772, 1.0],
    [8.0, 1.18, 1.47, 5800, 1.0],
    [10.0, 1.47, 1.84, 5700, 1.0],
    [11.0, 2.3, 2.7, 4900, 0.99],
    [11.6, 6, 8, 4500, 0.97],
    [12.0, 30, 120, 4000, 0.9],
    [12.1, 100, 900, 3500, 0.8],
    [12.165, 256, 2700, 3100, 0.68],
    [12.17, 11, 45, 4800, 0.68],
    [12.27, 13, 55, 4700, 0.67],
    [12.29, 60, 600, 3600, 0.62],
    [12.3, 180, 3000, 3150, 0.56],
    [12.304, 2, 3000, 30000, 0.54],
    [12.31, 0.012, 100, 100000, 0.54],
    [13.31, 0.0085, 0.003, 15000, 0.54],
    [16.31, 0.0085, 1e-4, 7000, 0.54],
    [1000, 0.0085, 1e-6, 3000, 0.54],
    [1e6, 0.0085, 1e-9, 900, 0.54],
  ];
  const T_TIP = 12.165;

  function track(age) {
    if (age <= TRACK[0][0]) return TRACK[0];
    for (let i = 1; i < TRACK.length; i++) {
      if (age <= TRACK[i][0]) {
        const a = TRACK[i - 1];
        const b = TRACK[i];
        const f = (age - a[0]) / (b[0] - a[0]);
        const lg = (x, y) => Math.exp(Math.log(x) + (Math.log(y) - Math.log(x)) * f);
        return [age, lg(a[1], b[1]), lg(a[2], b[2]), U.lerp(a[3], b[3], f), U.lerp(a[4], b[4], f)];
      }
    }
    return TRACK[TRACK.length - 1];
  }

  /* 태양의 상태 */
  function sunAt(tau) {
    const age = (tau - T_SUN) / 1e9;
    const out = { age, exists: age >= 0, cloud: 0, disk: 0, nebula: 0, nebulaR: 0, R: 0, L: 0, T: 5772, M: 1, phase: 'none' };
    if (age < -0.03) return out;
    if (age < 0) {
      out.cloud = U.smoothstep(-0.03, -0.012, age);
      out.phase = 'cloud';
      return out;
    }
    const [, R, L, T, M] = track(age);
    Object.assign(out, { R, L, T, M });
    out.disk = 1 - U.smoothstep(0.004, 0.06, age);
    out.cloud = 1 - U.smoothstep(0, 0.003, age);
    if (age < 0.03) out.phase = 'young';
    else if (age < 10) out.phase = 'main';
    else if (age < T_TIP) out.phase = 'giant';
    else if (age < 12.3) out.phase = 'agb';
    else if (age < 1000) out.phase = 'wd';
    else out.phase = 'black';
    if (age > 12.3 && age < 12.5) {
      const f = (age - 12.3) / 0.2;
      out.nebula = Math.sin(Math.PI * Math.min(1, f * 1.4)) * (1 - f * 0.4);
      out.nebulaR = 40 + f * 1100;
    }
    return out;
  }

  const PLANETS = [
    { id: 'mercury', name: '수성', a: 0.387, e: 0.206, inc: 7.0, node: 48, R: 2440, P: 0.241, born: 0.03, color: [0.62, 0.58, 0.55], minPx: 3,
      info: '태양에 가장 가까운 행성. 대기가 거의 없어 낮에는 430도, 밤에는 영하 180도까지 내려갑니다. 태양이 적색거성이 되면 가장 먼저 삼켜집니다.' },
    { id: 'venus', name: '금성', a: 0.723, e: 0.007, inc: 3.4, node: 76, R: 6052, P: 0.615, born: 0.03, color: [0.93, 0.82, 0.6], minPx: 4,
      info: '두꺼운 이산화탄소 대기의 온실 효과로 표면이 465도에 이릅니다. 지구와 크기가 거의 같아 "쌍둥이 행성"이라고도 불립니다.' },
    { id: 'earth', name: '지구', a: 1.0, e: 0.017, inc: 0, node: 0, R: 6371, P: 1.0, born: 0.028, color: [0.3, 0.52, 0.92], minPx: 4.5, earth: true,
      info: '우리가 사는 행성. 지금까지 생명이 있다고 확인된 유일한 곳입니다.' },
    { id: 'mars', name: '화성', a: 1.524, e: 0.093, inc: 1.85, node: 49, R: 3390, P: 1.881, born: 0.006, color: [0.82, 0.45, 0.28], minPx: 3.5,
      info: '붉은 행성. 아주 먼 옛날에는 강과 호수가 있었던 흔적이 남아 있습니다. 태양이 적색거성이 되어도 살아남을 것으로 봅니다.' },
    { id: 'jupiter', name: '목성', a: 5.203, e: 0.048, inc: 1.3, node: 100, R: 69911, P: 11.86, born: 0.003, color: [0.86, 0.76, 0.62], minPx: 7, bands: 1,
      info: '태양계에서 가장 큰 행성. 나머지 행성을 모두 합친 것의 2.5배 무게입니다. 큰 중력으로 태양계의 모양을 정했습니다.' },
    { id: 'saturn', name: '토성', a: 9.537, e: 0.054, inc: 2.5, node: 113, R: 58232, P: 29.46, born: 0.005, color: [0.9, 0.82, 0.6], minPx: 6.5, bands: 1, rings: 1,
      info: '얼음 조각으로 된 아름다운 고리를 가진 행성. 물보다 가벼워 큰 바다가 있다면 뜰 정도입니다.' },
    { id: 'uranus', name: '천왕성', a: 19.19, e: 0.047, inc: 0.8, node: 74, R: 25362, P: 84.0, born: 0.01, color: [0.62, 0.86, 0.9], minPx: 5,
      info: '옆으로 누운 채(98°) 도는 얼음 거인. 아주 먼 옛날 큰 천체와 부딪혀 쓰러졌다고 봅니다.' },
    { id: 'neptune', name: '해왕성', a: 30.07, e: 0.009, inc: 1.8, node: 131, R: 24622, P: 164.8, born: 0.01, color: [0.33, 0.5, 0.95], minPx: 5,
      info: '태양계에서 가장 먼 행성. 초속 600m 가 넘는 태양계에서 가장 빠른 바람이 붑니다.' },
  ];

  /* 태양이 삼키는 때 (나이, 십억 년) */
  for (const p of PLANETS) {
    p.engulf = null;
    if (p.id === 'earth') { p.engulf = T_TIP; continue; }
    for (let age = 10; age <= 12.31; age += 0.0005) {
      const [, R, , , M] = track(age);
      if (R * RSUN_AU >= 0.85 * p.a / M) { p.engulf = age; break; }
    }
  }

  /* 시대에 따른 행성 색 */
  function planetLook(p, tau, sun) {
    const age = (tau - T_SUN) / 1e9;
    let color = p.color.slice();
    let glow = 0;
    const ago = (NOW - tau) / 1e9;
    const mix = (c, k) => { color = color.map((v, i) => U.lerp(v, c[i], k)); };
    if (p.id === 'earth') {
      mix([1, 0.42, 0.15], 1 - U.smoothstep(0.08, 0.25, age));
      glow = 1 - U.smoothstep(0.05, 0.2, age);
      mix([0.45, 0.4, 0.42], (1 - U.smoothstep(0.3, 0.7, age)) * U.smoothstep(0.15, 0.3, age));
      if ((ago > 0.635 && ago < 0.72) || (ago > 2.1 && ago < 2.4)) mix([0.92, 0.95, 1], 0.85);
      mix([0.78, 0.66, 0.5], U.smoothstep(-1.0, -2.6, ago));
      mix([0.6, 0.35, 0.25], U.smoothstep(-3, -5.5, ago));
    }
    if (p.id === 'mars') mix([0.5, 0.55, 0.7], (1 - U.smoothstep(0.6, 1.5, age)) * U.smoothstep(0.05, 0.2, age));
    if (p.id === 'venus') mix([0.6, 0.55, 0.6], 1 - U.smoothstep(0.1, 0.8, age));
    /* 적색거성 가까이에서 달아오름 */
    if (sun.R > 20) {
      const d = p.a / Math.max(sun.M, 0.5);
      const heat = U.clamp((sun.R * RSUN_AU) / d, 0, 1);
      mix([1, 0.35, 0.12], heat * heat * 0.9);
      glow = Math.max(glow, heat * heat);
    }
    return { color, glow };
  }

  function planetAt(p, tau, sun) {
    const age = (tau - T_SUN) / 1e9;
    const exists = age >= p.born && !(p.engulf !== null && age >= p.engulf);
    const fadeIn = U.smoothstep(p.born, p.born + 0.01, age);
    const a = p.a / Math.max(sun.M || 1, 0.5);
    const look = planetLook(p, tau, sun);
    return { exists, fadeIn, a, color: look.color, glow: look.glow };
  }

  /* 궤도 위 자리 (공전은 보기 좋게 실제 시간과 따로 돌림: 지구 한 바퀴 ≈ 12초) */
  const ORBIT_SECONDS = 12;
  function orbitPos(p, a, wallT) {
    const M = (2 * Math.PI * wallT) / (ORBIT_SECONDS * Math.pow(p.a, 1.5)) + p.node * 0.1;
    let E = M;
    for (let k = 0; k < 5; k++) E = M + p.e * Math.sin(E);
    const x = a * (Math.cos(E) - p.e);
    const y = a * Math.sqrt(1 - p.e * p.e) * Math.sin(E);
    const inc = (p.inc * Math.PI) / 180;
    const node = (p.node * Math.PI) / 180;
    /* 황도 좌표 (x, y 는 궤도면) */
    const xn = x * Math.cos(node) - y * Math.cos(inc) * Math.sin(node);
    const yn = x * Math.sin(node) + y * Math.cos(inc) * Math.cos(node);
    const zn = y * Math.sin(inc);
    return [xn, yn, zn];
  }

  /* ---------- 좌표 변환: 황도 → 적도 → 은하 → 화면 세계 ---------- */
  const EPS = (23.4393 * Math.PI) / 180;
  const EQ2GAL = [
    [-0.0548755604, -0.8734370902, -0.4838350155],
    [0.4941094279, -0.44482963, 0.7469822445],
    [-0.867666149, -0.1980763734, 0.4559837762],
  ];
  function eqToWorld(v) {
    const g = [0, 1, 2].map((r) => EQ2GAL[r][0] * v[0] + EQ2GAL[r][1] * v[1] + EQ2GAL[r][2] * v[2]);
    /* 은하 중심 방향 = -X, 은하 회전 방향(l=90°) = +Z, 은하 북극 = +Y */
    return [-g[0], g[2], g[1]];
  }
  function eclToWorld(v) {
    const eq = [v[0], v[1] * Math.cos(EPS) - v[2] * Math.sin(EPS), v[1] * Math.sin(EPS) + v[2] * Math.cos(EPS)];
    return eqToWorld(eq);
  }
  function radecToWorld(raH, decD, dist) {
    const a = (raH * 15 * Math.PI) / 180;
    const d = (decD * Math.PI) / 180;
    const w = eqToWorld([Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)]);
    return w.map((x) => x * dist);
  }
  const ECL_NORTH = eclToWorld([0, 0, 1]);

  /* ---------- 작은 천체들 (소행성대·카이퍼 벨트·원시 원반·구름) ---------- */
  function buildBelts() {
    const r = U.rng(7);
    const out = [];
    const add = (kind, n, a0, a1, h, ...rest) => {
      for (let i = 0; i < n; i++) {
        const a = a0 + (a1 - a0) * Math.sqrt(r());
        const th = r() * Math.PI * 2;
        out.push({ kind, a, th, z: U.gauss(r) * h * a, s: r(), ...rest });
      }
    };
    add(0, 2600, 2.1, 3.3, 0.06); // 소행성대
    add(1, 3200, 30, 50, 0.08); // 카이퍼 벨트
    /* 원시 행성 원반: 안쪽이 더 빽빽 (면밀도 ∝ 1/r) */
    for (let i = 0; i < 16000; i++) {
      const a = 0.12 + 34 * Math.pow(r(), 2.2);
      out.push({ kind: 2, a, th: r() * Math.PI * 2, z: U.gauss(r) * 0.04 * a, s: r() });
    }
    return out;
  }

  /* 원시 원반의 틈: 행성이 자라며 길을 쓸어 냄 */
  function diskGap(a, age) {
    let g = 1;
    for (const p of PLANETS) {
      const w = p.a * 0.08 + 0.05;
      const k = U.smoothstep(p.born * 0.6, p.born * 1.6 + 0.004, age);
      g *= 1 - k * Math.exp(-Math.pow((a - p.a) / w, 2));
    }
    return g;
  }

  UC.solar = {
    T_SUN, T_TIP, RSUN_AU, AU_LY, PLANETS, ECL_NORTH, ORBIT_SECONDS,
    sunAt, planetAt, orbitPos, eclToWorld, eqToWorld, radecToWorld, buildBelts, diskGap, track,
  };
})();
