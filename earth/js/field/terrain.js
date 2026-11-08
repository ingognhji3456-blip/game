'use strict';

/*
 * 지상 장면의 땅 모양과 하늘 빛 — 셰이더(js/render/ground.js)와 같은 계산.
 * 지점 정보(EC.surface.query)와 시대 상태로 장면 값을 만들고, 생물을 땅 높이에 맞춰 세울 때 씁니다.
 */
(function () {
  const EC = (window.EC = window.EC || {});
  EC.field = EC.field || {};
  const U = EC.util;
  const N = EC.noise;

  const BASE_R_KM = [5.8e-3, 13.5e-3, 33.1e-3];
  const MIE_KM_PER_UNIT = 0.021 / 67;
  const RP = 6371;
  const RAT = 6451;

  const octFor = (t) => Math.round(U.clamp(9 - Math.log2(1 + t * 0.02), 3, 9)) | 0;
  /* GLSL 의 int() 는 버림이므로 같게 맞춥니다 */
  const octForG = (t) => Math.floor(U.clamp(7 - Math.log2(1 + t * 0.02), 3, 7));

  function terrainH(P, x, z, oct) {
    const qx = x + P.uSeed[0];
    const qz = z + P.uSeed[1];
    const r = Math.hypot(x, z);
    const near = U.smoothstep(3, 40, r);
    let seaMask = 0;
    let s = 0;
    if (P.uCoast > 0.5) {
      s = x * P.uSeaDir[0] + z * P.uSeaDir[1] - P.uCoastDist;
      seaMask = U.smoothstep(-250, -40, s);
    }
    let h = P.uHillAmp * N.fbm2(qx * P.uHillFreq, qz * P.uHillFreq, oct) * (0.3 + 0.7 * near);
    h += P.uRough * N.fbm2(qx * 0.06, qz * 0.06, Math.max(oct - 3, 2)) * (0.4 + 0.6 * near);
    if (P.uMtnAmp > 0 && r > P.uMtnNear) h += P.uMtnAmp * N.ridged2(qx * 0.00045, qz * 0.00045, Math.min(oct, 6)) * U.smoothstep(P.uMtnNear, P.uMtnNear * 6, r) * (1 - seaMask);
    if (P.uDune > 0) {
      const d = Math.sin(qx * 0.011 + qz * 0.0045 + N.fbm2(qx * 0.0025, qz * 0.0025, 3) * 2.6);
      h += P.uDune * 12 * (1 - d * d) * near * (1 - seaMask);
    }
    if (P.uCanopy > 0) h += P.uCanopy * 16 * U.smoothstep(90, 260, r) * (0.55 + 0.45 * N.fbm2(qx * 0.035, qz * 0.035, 3)) * (1 - seaMask);
    h += P.uBaseH;
    if (P.uCoast > 0.5) h -= U.smoothstep(-150, 250, s) * (P.uBaseH + 30) + Math.max(s, 0) * 0.015;
    return h;
  }

  /* 카메라에서 거리 dist 인 곳의 높이 (셰이더가 같은 거리에서 쓰는 세밀도로) */
  function heightAt(P, x, z, dist) {
    return terrainH(P, x, z, octForG(dist));
  }

  /* ---------- 하늘 빛 (km 단위) ---------- */
  function sphere2(o, d, r) {
    const b = o[0] * d[0] + o[1] * d[1] + o[2] * d[2];
    const c = o[0] * o[0] + o[1] * o[1] + o[2] * o[2] - r * r;
    const h = b * b - c;
    if (h < 0) return [-1, -1];
    const sh = Math.sqrt(h);
    return [-b - sh, -b + sh];
  }
  function ext(P, odR, odM) {
    return [0, 1, 2].map((i) => P.uBetaR[i] * odR + (P.uBetaM[i] * 1.1 + P.uMieAbs[i]) * odM);
  }
  function lightOD(P, p) {
    const sd = P.uSunDir;
    if (sphere2(p, sd, RP)[0] > 0) return [1e5, 1e5];
    const len = sphere2(p, sd, RAT)[1];
    const ds = len / 4;
    let r = 0;
    let m = 0;
    for (let i = 0; i < 4; i++) {
      const s = [p[0] + sd[0] * ds * (i + 0.5), p[1] + sd[1] * ds * (i + 0.5), p[2] + sd[2] * ds * (i + 0.5)];
      const h = Math.hypot(s[0], s[1], s[2]) - RP;
      r += Math.exp(-h / 8) * ds;
      m += Math.exp(-h / 1.2) * ds;
    }
    return [r, m];
  }
  function skyScatter(P, d) {
    const o = [0, RP + 0.002, 0];
    d = [d[0], Math.max(d[1], 0.004), d[2]];
    const l = Math.hypot(d[0], d[1], d[2]);
    d = [d[0] / l, d[1] / l, d[2] / l];
    const tmax = sphere2(o, d, RAT)[1];
    let odR = 0;
    let odM = 0;
    const sR = [0, 0, 0];
    const sM = [0, 0, 0];
    let prev = 0;
    for (let i = 0; i < 8; i++) {
      const f = (i + 1) / 8;
      const tt = tmax * f * f;
      const ds = tt - prev;
      const tm = prev + ds * 0.5;
      prev = tt;
      const p = [o[0] + d[0] * tm, o[1] + d[1] * tm, o[2] + d[2] * tm];
      const h = Math.hypot(p[0], p[1], p[2]) - RP;
      const dr = Math.exp(-h / 8) * ds;
      const dm = Math.exp(-h / 1.2) * ds;
      odR += dr;
      odM += dm;
      const lo = lightOD(P, p);
      const e = ext(P, odR + lo[0], odM + lo[1]);
      for (let k = 0; k < 3; k++) {
        const att = Math.exp(-e[k]);
        sR[k] += att * dr;
        sM[k] += att * dm;
      }
    }
    const mu = d[0] * P.uSunDir[0] + d[1] * P.uSunDir[1] + d[2] * P.uSunDir[2];
    const pR = 0.0596831 * (1 + mu * mu);
    const g = 0.76;
    const pM = 0.1193662 * ((1 - g * g) * (1 + mu * mu)) / ((2 + g * g) * Math.pow(Math.max(1 + g * g - 2 * g * mu, 1e-4), 1.5));
    return [0, 1, 2].map((k) => (sR[k] * P.uBetaR[k] * pR + sM[k] * P.uBetaM[k] * pM) * P.uSunColor[k] * P.uSunI);
  }

  /* 관찰자에게 닿는 햇빛 */
  function sunLight(P) {
    const o = [0, RP + 0.002, 0];
    const lo = lightOD(P, o);
    const e = ext(P, lo[0], lo[1]);
    const up = U.smoothstep(-0.06, 0.04, P.uSunDir[1]);
    return [0, 1, 2].map((k) => P.uSunColor[k] * Math.exp(-e[k]) * 1.7 * up * P.uSunIntensity);
  }

  const mix3 = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  const mul3 = (a, k) => [a[0] * k, a[1] * k, a[2] * k];

  function hashSeed(lat, lon) {
    const a = Math.sin(lat * 12.9898 + lon * 78.233) * 43758.5453;
    const b = Math.sin(lat * 39.346 + lon * 11.135) * 24634.6345;
    return [(a - Math.floor(a)) * 6000 - 3000, (b - Math.floor(b)) * 6000 - 3000];
  }

  /*
   * 장면 값 만들기
   * info: EC.surface.query, bio: EC.surface.biome, st: 시뮬레이션 상태, look: EC.look.build, sun/moon: 지평 좌표 단위 벡터
   */
  function build(info, bio, st, look, sun, moon) {
    const S = EC.sim.S;
    const P = {};
    P.uSeed = hashSeed(Math.round(info.lat * 2) / 2, Math.round(info.lon * 2) / 2);
    const under = bio.habitat === 'sea';
    const oxid = U.smoothstep(0.2, 3, st.O2);
    const plants = st.alive && st.stage >= S.landPlants;
    P.uUnder = under ? 1 : 0;
    P.uCoast = 0;
    P.uCoastDist = 1000;
    P.uSeaDir = [1, 0];
    P.uBaseH = 0;
    P.uHillAmp = 16;
    P.uHillFreq = 0.004;
    P.uRough = 0.35;
    P.uMtnAmp = 250 + 900 * Math.max(0, info.mtn - 0.15);
    P.uMtnNear = 400;
    P.uDune = 0;
    P.uCanopy = 0;
    P.uSandAmt = 0;
    P.uSnow = 0;
    P.uIce = 0;
    P.uLava = 0;
    P.uSalt = 0;
    P.uMats = st.alive && st.stage >= S.microbe && st.stage < S.landPlants ? 1 : 0;
    P.uSnowLine = Math.max(60, (info.tempLocal + 6) * 150);
    P.uDepth = 0;

    const id = bio.id;
    if (id === 'desert' || id === 'barren' || id === 'scorched') { P.uHillAmp = 22; P.uRough = 0.6; }
    if (id === 'desert') { P.uDune = 1; P.uSandAmt = 1; P.uHillAmp = 8; }
    if (id === 'grassland' || id === 'savanna') { P.uHillAmp = 10; P.uHillFreq = 0.003; P.uRough = 0.25; }
    if (id === 'forest' || id === 'rainforest' || id === 'boreal') { P.uHillAmp = 18; P.uRough = 0.3; P.uCanopy = plants && st.stage >= S.forests ? 1 : 0; }
    if (id === 'tundra') { P.uHillAmp = 10; P.uSnow = 0.25; }
    if (id === 'ice') { P.uHillAmp = 8; P.uHillFreq = 0.002; P.uRough = 0.15; P.uSnow = 1; P.uIce = 1; }
    if (id === 'lava') { P.uHillAmp = 26; P.uHillFreq = 0.005; P.uRough = 1.2; P.uLava = Math.max(info.lava, info.heat, 0.6); }
    if (id === 'seabed') { P.uHillAmp = 4; P.uRough = 0.1; P.uSalt = 1; }
    if (bio.mountain) { P.uHillAmp = 45; P.uMtnAmp = 1100; P.uMtnNear = 150; }

    if (!under && info.land && info.coastKm < 80 && st.ocean > 0.3 && id !== 'lava') {
      P.uCoast = 1;
      P.uCoastDist = 60 + (info.coastKm / 80) * 1800;
      const l = Math.hypot(info.seaDir[0], info.seaDir[1]) || 1;
      P.uSeaDir = [info.seaDir[0] / l, info.seaDir[1] / l];
      P.uBaseH = 6 + Math.min(info.coastKm, 80) * 0.25;
    }
    if (under) {
      const depth = id === 'shelf' ? 6 + info.depth * 80 : 25 + Math.min(info.depth, 1) * 30;
      P.uDepth = depth;
      P.uBaseH = -depth;
      P.uHillAmp = 3;
      P.uHillFreq = 0.006;
      P.uRough = 0.4;
      P.uMtnAmp = 0;
      P.uSandAmt = 0.8;
    }

    /* 색 */
    let soil = mix3([0.11, 0.10, 0.095], [0.30, 0.19, 0.12], oxid);
    if (plants) soil = mix3(soil, [0.17, 0.12, 0.08], 0.6);
    P.uSoil = soil;
    P.uRock = mul3(look.uRock, 0.75);
    P.uSand = oxid > 0.5 ? [0.62, 0.5, 0.34] : [0.24, 0.22, 0.2];
    let grass = [0.09, 0.15, 0.05];
    if (st.E !== null && st.E < -385) grass = [0.13, 0.19, 0.07];
    if (id === 'grassland' && st.E !== null && st.E > -30) grass = [0.30, 0.33, 0.11];
    if (id === 'savanna') grass = st.E !== null && st.E > -30 ? [0.46, 0.38, 0.17] : [0.2, 0.22, 0.09];
    if (id === 'tundra') grass = [0.28, 0.27, 0.18];
    if (id === 'rainforest') grass = [0.06, 0.13, 0.04];
    P.uGrass = grass;
    const vegF = { desert: 0.12, savanna: 0.85, grassland: 1, forest: 1, rainforest: 1, boreal: 0.9, tundra: 0.7 }[id] || 0;
    P.uVeg = (look.uVeg || 0) * vegF;
    P.uWaterDeep = mul3(look.uOceanDeep, 2.2);
    P.uWaterShallow = mul3(look.uOceanShallow, 2.4);
    P.uCloud = Math.min(look.uCloud, 0.92);
    P.uCloudColor = look.uCloudColor;

    /* 하늘 */
    P.uBetaR = [0, 1, 2].map((k) => BASE_R_KM[k] * (look.uBetaR[k] / [21, 49, 121][k]));
    P.uBetaM = look.uBetaM.map((v) => v * MIE_KM_PER_UNIT);
    P.uMieAbs = look.uMieAbs.map((v) => v * MIE_KM_PER_UNIT);
    P.uSunDir = sun;
    P.uSunColor = look.uSunColor;
    P.uSunIntensity = look.uSunIntensity;
    P.uSunI = 22 * look.uSunIntensity;
    P.uSunAng = Math.min(1.0, 0.00465 * st.sunRadius * 1.6);
    P.uMoonDir = moon;
    P.uMoonAng = st.moonKm > 0 ? Math.atan(1737 / st.moonKm) * 1.15 : 0;
    P.uSunLight = sunLight(P);
    P.uSkyZenith = skyScatter(P, [0, 1, 0]);
    const hz = [0, 1, 2, 3].map((k) => skyScatter(P, [Math.cos(k * 1.57), 0.05, Math.sin(k * 1.57)]));
    P.uSkyHorizon = [0, 1, 2].map((c) => (hz[0][c] + hz[1][c] + hz[2][c] + hz[3][c]) / 4);
    const night = U.smoothstep(0.05, -0.18, sun[1]);
    P.uStars = night * (1 - Math.min(1, (look.uBetaM[0] - 67) / 1500));
    const hazeF = Math.max(0, (look.uBetaM[1] - 67 * (look.uBetaR[0] / 21)) / 700);
    P.uFogK = 0.00005 * (1 + hazeF * 10) * (look.uBetaR[0] / 21);
    P.uExposure = 1.0;
    P.uMaxH = P.uBaseH + Math.abs(P.uHillAmp) * 1.1 + P.uRough + P.uMtnAmp * 1.05 + P.uDune * 12 + P.uCanopy * 16 + 2;
    P.uFade = 1;
    return P;
  }

  EC.field.terrainH = terrainH;
  EC.field.heightAt = heightAt;
  EC.field.octFor = octForG;
  EC.field.buildParams = build;
  EC.field.skyScatter = skyScatter;
  void octFor;
})();
