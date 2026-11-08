'use strict';

/*
 * 대륙 해안선 → 판마다 한 장씩 "부호 있는 거리장(SDF)" 텍스처.
 * 값 128 = 해안선, 위로 갈수록 내륙(최대 R 픽셀), 아래로 갈수록 바다.
 * 셰이더는 이 값으로 해안선을 부드럽게 그리고, 대륙 안쪽 높이와 건조함을 정합니다.
 */
(function () {
  const EC = (window.EC = window.EC || {});

  const W = 1024;
  const H = 512;
  const R = 40; // 거리 포화 픽셀 (약 14도)
  const BIG = 1e20;

  function rasterize(layer) {
    const cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    const path = (polys) => {
      ctx.beginPath();
      for (const poly of polys) {
        poly.forEach(([lon, lat], i) => {
          const x = ((lon + 180) / 360) * W;
          const y = ((90 - lat) / 180) * H;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.closePath();
      }
    };
    ctx.fillStyle = '#fff';
    path(layer.polys);
    ctx.fill('nonzero');
    if (layer.lakes) {
      ctx.globalCompositeOperation = 'destination-out';
      path(layer.lakes);
      ctx.fill('nonzero');
      ctx.globalCompositeOperation = 'source-over';
    }
    const data = ctx.getImageData(0, 0, W, H).data;
    const inside = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) inside[i] = data[i * 4] > 127 && data[i * 4 + 3] > 127 ? 1 : 0;
    return inside;
  }

  /* Felzenszwalb 1차원 거리 변환 */
  function edt1d(f, n, d, v, z) {
    let k = 0;
    v[0] = 0;
    z[0] = -BIG;
    z[1] = BIG;
    for (let q = 1; q < n; q++) {
      let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while (s <= z[k]) {
        k--;
        s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      }
      k++;
      v[k] = q;
      z[k] = s;
      z[k + 1] = BIG;
    }
    k = 0;
    for (let q = 0; q < n; q++) {
      while (z[k + 1] < q) k++;
      const dq = q - v[k];
      d[q] = dq * dq + f[v[k]];
    }
  }

  /* feature(i) 인 픽셀까지의 제곱 거리. 가로는 경도 방향으로 이어지고 위도에 따라 줄어듭니다. */
  function distanceField(isFeature) {
    const N = Math.max(W * 3, H);
    const f = new Float64Array(N);
    const d = new Float64Array(N);
    const v = new Int32Array(N);
    const z = new Float64Array(N + 1);
    const col = new Float64Array(W * H);
    for (let x = 0; x < W; x++) {
      for (let y = 0; y < H; y++) f[y] = isFeature[y * W + x] ? 0 : BIG;
      edt1d(f, H, d, v, z);
      for (let y = 0; y < H; y++) col[y * W + x] = d[y];
    }
    const out = new Float64Array(W * H);
    for (let y = 0; y < H; y++) {
      const lat = 90 - ((y + 0.5) / H) * 180;
      const s = Math.max(Math.cos((lat * Math.PI) / 180), 0.08);
      const s2 = s * s;
      for (let k = 0; k < 3; k++) {
        for (let x = 0; x < W; x++) {
          const c = col[y * W + x];
          f[k * W + x] = c >= BIG ? BIG : c / s2;
        }
      }
      edt1d(f, W * 3, d, v, z);
      for (let x = 0; x < W; x++) out[y * W + x] = d[W + x] * s2;
    }
    return out;
  }

  function sdfLayer(inside) {
    const outside = new Uint8Array(W * H);
    let any = false;
    for (let i = 0; i < W * H; i++) { outside[i] = inside[i] ? 0 : 1; if (inside[i]) any = true; }
    const bytes = new Uint8Array(W * H);
    if (!any) { bytes.fill(0); return bytes; }
    const dOut = distanceField(outside); // 안쪽 픽셀 → 가장 가까운 바깥
    const dIn = distanceField(inside); // 바깥 픽셀 → 가장 가까운 안쪽
    for (let i = 0; i < W * H; i++) {
      const sd = inside[i] ? Math.sqrt(dOut[i]) - 0.5 : -(Math.sqrt(dIn[i]) - 0.5);
      bytes[i] = Math.max(0, Math.min(255, Math.round(128 + (sd * 127) / R)));
    }
    return bytes;
  }

  /* 모든 층을 한 배열로: layer i 의 픽셀 (x, y) = out[i*W*H + y*W + x] */
  function build() {
    const layers = EC.data.layers;
    const out = new Uint8Array(W * H * layers.length);
    layers.forEach((layer, i) => out.set(sdfLayer(rasterize(layer)), i * W * H));
    return out;
  }

  /* CPU 에서 마스크 읽기 (도구·디버그용) */
  function sample(mask, layerIndex, lat, lon) {
    const x = Math.floor((((lon + 180) / 360) * W) % W + W) % W;
    const y = Math.max(0, Math.min(H - 1, Math.floor(((90 - lat) / 180) * H)));
    return (mask[layerIndex * W * H + y * W + x] - 128) / 127;
  }

  EC.landmask = { W, H, R, build, sample };
})();
