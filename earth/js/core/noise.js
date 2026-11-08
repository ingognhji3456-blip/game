'use strict';

/*
 * 셰이더(js/render/shaders.js)와 똑같은 simplex 잡음을 자바스크립트로 옮긴 것.
 * 화면에서 육지로 보이는 곳을 컴퓨터도 육지로 판단하고, 지상 장면에서 생물을 땅 높이에 맞춰 세우는 데 씁니다.
 */
(function () {
  const EC = (window.EC = window.EC || {});

  const mod289 = (x) => x - Math.floor(x * (1 / 289)) * 289;
  const permute = (x) => mod289((x * 34 + 10) * x);
  const taylorInvSqrt = (r) => 1.79284291400159 - 0.85373472095314 * r;

  /* 그래픽 카드는 32비트 실수를 쓰므로 상수도 32비트로 맞춥니다 (floor 경계에서 결과가 달라지지 않게) */
  const f32 = Math.fround;
  const N_ = f32(0.142857142857);
  const NS_X = f32(N_ * 2);
  const NS_Y = f32(f32(N_ * 0.5) - 1);
  const NS_Z = N_;

  function snoise(vx, vy, vz) {
    const s = (vx + vy + vz) / 3;
    let ix = Math.floor(vx + s);
    let iy = Math.floor(vy + s);
    let iz = Math.floor(vz + s);
    const t = (ix + iy + iz) / 6;
    const x0x = vx - ix + t;
    const x0y = vy - iy + t;
    const x0z = vz - iz + t;
    const gx = x0x >= x0y ? 1 : 0;
    const gy = x0y >= x0z ? 1 : 0;
    const gz = x0z >= x0x ? 1 : 0;
    const lx = 1 - gx;
    const ly = 1 - gy;
    const lz = 1 - gz;
    const i1x = Math.min(gx, lz), i1y = Math.min(gy, lx), i1z = Math.min(gz, ly);
    const i2x = Math.max(gx, lz), i2y = Math.max(gy, lx), i2z = Math.max(gz, ly);
    const x1x = x0x - i1x + 1 / 6, x1y = x0y - i1y + 1 / 6, x1z = x0z - i1z + 1 / 6;
    const x2x = x0x - i2x + 1 / 3, x2y = x0y - i2y + 1 / 3, x2z = x0z - i2z + 1 / 3;
    const x3x = x0x - 0.5, x3y = x0y - 0.5, x3z = x0z - 0.5;
    ix = mod289(ix);
    iy = mod289(iy);
    iz = mod289(iz);
    const pz = [permute(iz), permute(iz + i1z), permute(iz + i2z), permute(iz + 1)];
    const py = [permute(pz[0] + iy), permute(pz[1] + iy + i1y), permute(pz[2] + iy + i2y), permute(pz[3] + iy + 1)];
    const p = [permute(py[0] + ix), permute(py[1] + ix + i1x), permute(py[2] + ix + i2x), permute(py[3] + ix + 1)];
    const X = [x0x, x1x, x2x, x3x];
    const Y = [x0y, x1y, x2y, x3y];
    const Z = [x0z, x1z, x2z, x3z];
    let sum = 0;
    for (let k = 0; k < 4; k++) {
      const j = p[k] - 49 * Math.floor(p[k] * NS_Z * NS_Z);
      const xu = Math.floor(j * NS_Z);
      const yu = Math.floor(j - 7 * xu);
      const gxk = xu * NS_X + NS_Y;
      const gyk = yu * NS_X + NS_Y;
      const h = 1 - Math.abs(gxk) - Math.abs(gyk);
      const sh = h <= 0 ? -1 : 0;
      let ax = gxk + (Math.floor(gxk) * 2 + 1) * sh;
      let ay = gyk + (Math.floor(gyk) * 2 + 1) * sh;
      let az = h;
      const norm = taylorInvSqrt(ax * ax + ay * ay + az * az);
      ax *= norm;
      ay *= norm;
      az *= norm;
      let m = Math.max(0.5 - (X[k] * X[k] + Y[k] * Y[k] + Z[k] * Z[k]), 0);
      m *= m;
      sum += m * m * (ax * X[k] + ay * Y[k] + az * Z[k]);
    }
    return 105 * sum;
  }

  function fbm(x, y, z, oct) {
    let s = 0;
    let a = 0.5;
    for (let i = 0; i < oct; i++) {
      s += a * snoise(x, y, z);
      x = x * 2.03 + 1.7;
      y = y * 2.03 + 9.2;
      z = z * 2.03 + 3.1;
      a *= 0.5;
    }
    return s;
  }

  function ridge4(x, y, z) {
    let s = 0;
    let a = 0.5;
    for (let i = 0; i < 4; i++) {
      const n = 1 - Math.abs(snoise(x, y, z));
      s += a * n * n;
      x = x * 2.1 + 3.3;
      y = y * 2.1 + 1.1;
      z = z * 2.1 + 7.7;
      a *= 0.5;
    }
    return s;
  }

  /* 지상 장면용 2차원 잡음 (셰이더 ground.js 와 같음) */
  function fbm2(x, z, oct) {
    let s = 0;
    let a = 0.5;
    for (let i = 0; i < oct; i++) {
      s += a * snoise(x, 7.31, z);
      const nx = 1.6 * x + 1.2 * z;
      const nz = -1.2 * x + 1.6 * z;
      x = nx + 1.7;
      z = nz + 9.2;
      a *= 0.5;
    }
    return s;
  }

  function ridged2(x, z, oct) {
    let s = 0;
    let a = 0.5;
    let w = 1;
    for (let i = 0; i < oct; i++) {
      let n = 1 - Math.abs(snoise(x, 3.71, z));
      n *= n;
      s += a * n * w;
      w = Math.min(1, n * 2);
      const nx = 1.6 * x + 1.2 * z;
      const nz = -1.2 * x + 1.6 * z;
      x = nx + 3.3;
      z = nz + 7.7;
      a *= 0.5;
    }
    return s;
  }

  EC.noise = { snoise, fbm, ridge4, fbm2, ridged2 };
})();
