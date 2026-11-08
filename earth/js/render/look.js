'use strict';

/* 시뮬레이션 상태 → 화면 모습(셰이더 값). 시대마다 바다·하늘·땅의 색이 달라집니다. */
(function () {
  const EC = (window.EC = window.EC || {});
  const U = EC.util;

  const mix3 = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

  function lastEventT(run, id, t) {
    let r = null;
    for (const e of run.events) {
      if (e.t > t) break;
      if (e.id === id) r = e.t;
    }
    return r;
  }

  function build(st, run, t) {
    const S = EC.sim.S;
    const T = st.T;
    const oxid = U.smoothstep(0.2, 3, st.O2);

    let rock = mix3([0.17, 0.16, 0.155], [0.46, 0.30, 0.21], oxid);
    if (st.stage >= S.landPlants) rock = mix3(rock, [0.55, 0.45, 0.34], 0.4);
    if (t > 1500) rock = mix3(rock, [0.52, 0.38, 0.28], U.smoothstep(1500, 3000, t));

    let veg = 0;
    if (st.alive && st.stage >= S.landPlants) {
      const tl = lastEventT(run, 'landPlants', t);
      veg = U.clamp(0.22 + ((t - (tl === null ? t : tl)) / 90) * 0.78, 0.22, 1);
      const plantF = st.co2 >= 150 ? 1 : U.clamp(Math.log(st.co2 / 10) / Math.log(15), 0, 1);
      veg *= plantF;
    }
    if (st.snow) veg = 0;
    const mats = st.alive && st.stage >= S.photo && st.stage < S.landPlants ? 0.7 : 0;

    const green = 1 - U.smoothstep(0.1, 2, st.O2);
    const hotOcean = U.smoothstep(40, 90, T);
    let oceanDeep = mix3([0.004, 0.016, 0.046], [0.006, 0.03, 0.026], green);
    let oceanShallow = mix3([0.018, 0.095, 0.125], [0.05, 0.13, 0.09], green);
    oceanDeep = mix3(oceanDeep, [0.06, 0.07, 0.08], hotOcean * 0.6);
    oceanShallow = mix3(oceanShallow, [0.2, 0.22, 0.2], hotOcean * 0.5);

    let cloud;
    let cloudColor = [0.97, 0.97, 0.98];
    let atmo = [0.30, 0.52, 1.0];
    let dens = 1.0;
    let haze = 0;
    let hazeColor = [0.88, 0.58, 0.28];
    if (t <= 0) {
      cloud = 0.46 + 0.2 * U.smoothstep(25, 45, T);
      if (st.snow) cloud = 0.3;
      if (st.alive && st.stage >= S.microbe && st.O2 < 0.3 && t > -3600) haze = 0.55 * (1 - U.smoothstep(0.05, 0.3, st.O2));
      if (st.lava > 0.05) {
        cloud = 0.1;
        haze = 0.12;
        hazeColor = [0.55, 0.22, 0.08];
        atmo = [0.9, 0.42, 0.18];
        dens = 1.4;
      }
      const steam = U.smoothstep(-4470, -4440, t) * (1 - U.smoothstep(-4395, -4365, t));
      if (steam > 0.01) {
        cloud = Math.max(cloud, steam * 0.86);
        cloudColor = [0.97 - 0.37 * steam, 0.97 - 0.38 * steam, 0.98 - 0.4 * steam];
      }
      if (t < -4380) {
        atmo = mix3([0.9, 0.55, 0.32], atmo, U.smoothstep(-4430, -4380, t));
        dens = Math.max(dens, 1.4);
        if (st.lava <= 0.05) { haze = Math.max(haze, 0.3); hazeColor = [0.9, 0.62, 0.4]; }
      }
    } else {
      const wet = U.smoothstep(0.0, 0.5, st.ocean);
      cloud = (0.46 + 0.3 * U.smoothstep(25, 60, T)) * (0.12 + 0.88 * wet);
      if (st.snow) cloud = 0.3;
      if (T > 60) {
        haze = U.smoothstep(60, 220, T) * 0.4;
        hazeColor = [0.92, 0.88, 0.8];
        dens = 1.2;
      }
      if (T > 280 && T < 900) {
        const k = 1 - U.smoothstep(700, 900, T);
        cloud = 0.9 * k;
        cloudColor = [0.92, 0.82, 0.58];
        haze = 0.45 * k;
        hazeColor = [0.95, 0.84, 0.55];
      }
      if (T >= 900) {
        cloud = 0;
        haze = 0.12 * (1 - U.smoothstep(900, 1400, T));
        hazeColor = [0.6, 0.25, 0.1];
      }
      if (t > 5500) dens *= 1 - U.smoothstep(5500, 7300, t) * 0.8;
    }

    const redGiant = U.smoothstep(5000, 7000, t);
    let city = 0;
    if (st.civ && st.civT !== undefined) city = U.smoothstep(st.civT, st.civT + 0.0118, t) * (1 - U.smoothstep(st.civT + 0.0123, st.civT + 0.025, t));

    /* 대기 산란 계수 (지구 반지름 단위): 레일리는 공기 밀도, 미는 안개·연무 */
    const betaR = [21 * dens, 49 * dens, 121 * dens];
    /* 연무는 빛을 고르게 흩뿌리고, 연무 색의 반대색(주황 연무라면 파랑)을 흡수합니다 */
    const betaM = [67 * dens + haze * 1400, 67 * dens + haze * 1350, 67 * dens + haze * 1300];
    const mieAbs = [haze * 3000 * (1 - hazeColor[0]), haze * 3000 * (1 - hazeColor[1]), haze * 3000 * (1 - hazeColor[2])];

    return {
      uBetaR: betaR,
      uBetaM: betaM,
      uMieAbs: mieAbs,
      uRock: rock,
      uVeg: veg,
      uMats: mats,
      uSand: 0.3 + 0.7 * oxid,
      uWet: U.clamp((T - 14) * 0.015, -0.2, 0.25),
      uTempG: U.clamp(T, -60, 90),
      uIceLat: st.snow ? -15 : st.iceLat,
      uShrink: st.crustShrink,
      uSeaShift: -st.seaLevel / 2500,
      uOcean: st.ocean,
      uLava: st.lava,
      uHeat: t > 0 ? U.smoothstep(700, 1600, T) : 0,
      uFuture: t > 0 ? 1 : 0,
      uOceanDeep: oceanDeep,
      uOceanShallow: oceanShallow,
      uCloud: cloud,
      uCloudColor: cloudColor,
      uAtmoColor: atmo,
      uAtmoDensity: dens,
      uHaze: haze,
      uHazeColor: hazeColor,
      uCity: city,
      uSunColor: mix3([1.0, 0.97, 0.93], [1.0, 0.55, 0.32], redGiant),
      uSunIntensity: 0.93 + 0.07 * Math.min(st.sunLum, 1.5) + redGiant * 0.25,
      uSunAng: Math.min(0.85, 0.02 * Math.pow(st.sunRadius, 0.8)),
      uMoonLava: st.moonKm > 0 ? 1 - U.smoothstep(-4500, -4380, t) : 0,
      uExposure: 1.45,
    };
  }

  /* 달까지 실제 거리 → 화면 거리 (가까운 옛날 달이 크게 보이도록 압축) */
  function moonVisualDistance(km) {
    return 1.9 + 7 * Math.pow(km / 384400, 0.8);
  }

  EC.look = { build, moonVisualDistance, lastEventT };
})();
