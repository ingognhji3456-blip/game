'use strict';

/*
 * 지구 한 지점의 지표 정보 — 셰이더(shadeEarth)와 같은 계산을 자바스크립트로 합니다.
 * 바다인지 육지인지, 해안까지 얼마나 가까운지, 산, 기온, 습도, 얼음, 그리고 생물군계 이름.
 */
(function () {
  const EC = (window.EC = window.EC || {});
  const U = EC.util;
  const Q = EC.q;
  const N = EC.noise;
  const D2R = Math.PI / 180;

  /* R8 텍스처 + LINEAR 필터와 같은 쌍선형 보간 */
  function sampleMask(layer, lat, lon) {
    const M = EC.landmask;
    const W = M.W;
    const H = M.H;
    const data = M.data;
    const u = lon / 360 + 0.5;
    const v = 0.5 - lat / 180;
    const x = u * W - 0.5;
    const y = U.clamp(v * H - 0.5, 0, H - 1);
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;
    const y1 = Math.min(H - 1, y0 + 1);
    const wx0 = ((x0 % W) + W) % W;
    const wx1 = (wx0 + 1) % W;
    const base = layer * W * H;
    const a = data[base + y0 * W + wx0];
    const b = data[base + y0 * W + wx1];
    const c = data[base + y1 * W + wx0];
    const d = data[base + y1 * W + wx1];
    const val = (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
    return (val - 128) / 127;
  }

  function plateField(q, rots, vis) {
    let best = -1;
    let sum = 0;
    let layer = -1;
    for (let i = 0; i < rots.length; i++) {
      if (vis[i] < 0.01) continue;
      const v = Q.rotate(Q.conj(rots[i]), q);
      const lat = Math.asin(U.clamp(v[1], -1, 1)) / D2R;
      const lon = Math.atan2(v[0], v[2]) / D2R;
      const s = U.lerp(-1, sampleMask(i, lat, lon), vis[i]);
      if (s > best) { best = s; layer = i; }
      sum += Math.max(s, 0);
    }
    return { s: best, overlap: sum - Math.max(best, 0), layer };
  }

  function coastAt(q, look, rots, vis) {
    const pf = plateField(q, rots, vis);
    const n1 = N.fbm(q[0] * 3 + 11, q[1] * 3 + 11, q[2] * 3 + 11, 5);
    const n2 = N.fbm(q[0] * 11 + 3, q[1] * 11 + 3, q[2] * 11 + 3, 4);
    const d = look.uDetail || 0;
    const fine = d > 0.001 ? d * (N.fbm(q[0] * 48 + 2, q[1] * 48 + 2, q[2] * 48 + 2, 4) * 0.022 + N.snoise(q[0] * 160, q[1] * 160, q[2] * 160) * 0.006) : 0;
    const coast = pf.s + (n1 * 0.2 + n2 * 0.065 + fine) * (1 + look.uShrink * 0.9) - look.uShrink + look.uSeaShift;
    const basin = pf.s + n1 * 0.2 + n2 * 0.065 + fine + look.uSeaShift;
    return { pf, n1, n2, coast, basin };
  }

  /* q: 지구 고정 좌표의 단위 벡터, look: EC.look.build() 결과 */
  function query(q, look, rots, vis) {
    const lat = Math.asin(U.clamp(q[1], -1, 1));
    const alat = Math.abs(lat) / D2R;
    const c = coastAt(q, look, rots, vis);
    const { pf, n1, n2, coast, basin } = c;
    const future = look.uFuture > 0.5;
    const dry = coast > 0 ? 1 : 0;
    const level = U.lerp(-1.6, 0, look.uOcean);
    const landAmt = future ? Math.max(dry, basin > level ? 1 : 0) : dry;
    const waterPresent = future ? 1 : U.smoothstep(0, 0.25, look.uOcean);
    const land = 1 - (1 - landAmt) * waterPresent;
    const inland = U.clamp(coast, 0, 1.5);
    const mount = N.ridge4(q[0] * 5 + 7, q[1] * 5 + 7, q[2] * 5 + 7);
    const mtn = mount * (0.22 + 1.9 * U.clamp(pf.overlap, 0, 0.6)) * U.smoothstep(0.02, 0.3, inland);
    const depth = future ? U.clamp(level - basin, 0, 2) : U.clamp(-coast, 0, 2);
    const tempLocal = look.uTempG + 13 - 38 * Math.sin(lat) * Math.sin(lat) - mtn * 22;
    let moist = 0.55 + 0.45 * n2 + 0.35 * N.fbm(q[0] * 4 + 21, q[1] * 4 + 21, q[2] * 4 + 21, 3)
      - 0.7 * U.smoothstep(0.25, 1.0, inland)
      + 0.45 * (1 - U.smoothstep(0, 14, alat))
      - 0.55 * Math.exp(-(((alat - 24) / 9) ** 2))
      + 0.3 * U.smoothstep(36, 52, alat) + look.uWet;
    moist = U.clamp(moist, 0, 1);
    const iceEdge = look.uIceLat + n1 * 7 + n2 * 2.5;
    const ice = U.smoothstep(iceEdge - 1.2, iceEdge + 1.2, alat);
    const peakSnow = U.smoothstep(-4, -14, tempLocal) * U.smoothstep(0.25, 0.6, mtn);
    const landIce = Math.max(ice, peakSnow);
    const seaIce = U.smoothstep(iceEdge + 0.8, iceEdge + 3, alat);

    /* 바다 쪽 방향: 해안선 값이 줄어드는 쪽 (동·북 방향 성분) */
    const east = Q.norm(Q.cross([0, 1, 0], q));
    const north = Q.cross(q, east);
    const e = 0.004;
    const off = (dx, dy) => Q.norm([q[0] + (east[0] * dx + north[0] * dy), q[1] + (east[1] * dx + north[1] * dy), q[2] + (east[2] * dx + north[2] * dy)]);
    const ce = coastAt(off(e, 0), look, rots, vis).coast;
    const cn = coastAt(off(0, e), look, rots, vis).coast;
    let gx = (ce - coast) / e;
    let gy = (cn - coast) / e;
    const gl = Math.hypot(gx, gy) || 1;
    gx /= gl;
    gy /= gl;
    /* 해안선까지 대략적인 거리(라디안): 값 ÷ 기울기 */
    const coastDistRad = Math.abs(coast) / Math.max(1e-3, Math.hypot((ce - coast) / e, (cn - coast) / e));

    return {
      lat: lat / D2R,
      lon: Math.atan2(q[0], q[2]) / D2R,
      layer: pf.layer,
      layerId: pf.layer >= 0 ? EC.data.layers[pf.layer].id : null,
      land: land >= 0.5,
      coast, inland, mtn, depth, tempLocal, moist, landIce, seaIce, n1, n2,
      seaDir: [-gx, -gy], // (동, 북) 성분 — 바다 쪽
      coastKm: coastDistRad * 6371,
      lava: look.uLava,
      heat: look.uHeat,
      veg: look.uVeg,
    };
  }

  /* 생물군계 이름과 종류 */
  function biome(info, st) {
    if (info.lava > 0.3 || info.heat > 0.3) return { id: 'lava', name: '녹은 지표', habitat: 'lava' };
    if (!info.land) {
      if (info.seaIce > 0.5 || st.snow) return { id: 'seaIce', name: '얼어붙은 바다', habitat: 'sea' };
      return { id: info.depth < 0.22 ? 'shelf' : 'ocean', name: info.depth < 0.22 ? '얕은 바다' : '깊은 바다', habitat: 'sea' };
    }
    if (info.landIce > 0.5 || st.snow) return { id: 'ice', name: '빙원', habitat: 'land' };
    if (info.coast < 0 && st.ocean < 0.99) return { id: 'seabed', name: '말라붙은 바다 밑', habitat: 'land' };
    const T = info.tempLocal;
    const m = info.moist;
    const mountain = info.mtn > 0.42;
    if (info.veg < 0.05) {
      if (T > 60) return { id: 'scorched', name: '타는 듯한 맨땅', habitat: 'land', mountain };
      return { id: 'barren', name: mountain ? '바위산' : '맨바위 땅', habitat: 'land', mountain };
    }
    if (m < 0.22) return { id: 'desert', name: '사막', habitat: 'land', mountain };
    if (T < -2) return { id: 'tundra', name: '툰드라', habitat: 'land', mountain };
    if (T < 8) return { id: 'boreal', name: '침엽수림', habitat: 'land', mountain };
    if (m > 0.62 && T > 20) return { id: 'rainforest', name: '열대 우림', habitat: 'land', mountain };
    if (m < 0.45 && T > 17) return { id: 'savanna', name: '사바나', habitat: 'land', mountain };
    if (m < 0.48) return { id: 'grassland', name: '초원', habitat: 'land', mountain };
    return { id: 'forest', name: '온대림', habitat: 'land', mountain };
  }

  EC.surface = { query, biome, sampleMask };
})();
