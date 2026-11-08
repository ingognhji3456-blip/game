'use strict';

/*
 * 우주 거대 구조(코즈믹 웹): 급팽창 때 생긴 작은 밀도 요동(가우스 무작위장)을 만들고,
 * 젤도비치 근사로 물질이 중력에 끌려 움직이게 합니다.
 *   x(t) = q + D(t) · ψ(q),   ∇·ψ = −δ
 * D(t)는 우주론 모형이 준 구조 성장 인자입니다. 물질은 처음엔 고르게 퍼져 있다가 시트·필라멘트·
 * 은하단으로 모이고, 그 사이에는 텅 빈 공간(보이드)이 생깁니다.
 * 상자 한 변 2,000백만 광년(공동 좌표), 우리 은하는 상자 한가운데 필라멘트 위에 놓습니다.
 */
(function () {
  const UC = (window.UC = window.UC || {});
  const U = UC.util;

  const NG = 64;
  const BOX = 2000; // 백만 광년 (공동 좌표)
  const CELL = BOX / NG;

  /* 제자리 복소수 FFT (길이 2의 거듭제곱). 비트 뒤집기와 회전 인자는 길이마다 한 번만 계산 */
  const plans = {};
  function plan(n) {
    if (plans[n]) return plans[n];
    const rev = new Uint32Array(n);
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      rev[i] = j;
    }
    const cos = new Float64Array(n / 2);
    const sin = new Float64Array(n / 2);
    for (let k = 0; k < n / 2; k++) { cos[k] = Math.cos((2 * Math.PI * k) / n); sin[k] = Math.sin((2 * Math.PI * k) / n); }
    plans[n] = { rev, cos, sin };
    return plans[n];
  }
  function fft1(re, im, n, inverse) {
    const { rev, cos, sin } = plan(n);
    for (let i = 1; i < n; i++) {
      const j = rev[i];
      if (i < j) {
        let t = re[i]; re[i] = re[j]; re[j] = t;
        t = im[i]; im[i] = im[j]; im[j] = t;
      }
    }
    const sg = inverse ? 1 : -1;
    for (let len = 2; len <= n; len <<= 1) {
      const half = len >> 1;
      const step = n / len;
      for (let i = 0; i < n; i += len) {
        for (let k = 0; k < half; k++) {
          const cr = cos[k * step];
          const ci = sg * sin[k * step];
          const a = i + k;
          const b = a + half;
          const tr = re[b] * cr - im[b] * ci;
          const ti = re[b] * ci + im[b] * cr;
          re[b] = re[a] - tr; im[b] = im[a] - ti;
          re[a] += tr; im[a] += ti;
        }
      }
    }
    if (inverse) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
  }

  function fft3(re, im, n, inverse) {
    const lr = new Float64Array(n);
    const li = new Float64Array(n);
    const strides = [1, n, n * n];
    for (let axis = 0; axis < 3; axis++) {
      const st = strides[axis];
      const o1 = strides[(axis + 1) % 3];
      const o2 = strides[(axis + 2) % 3];
      for (let a = 0; a < n; a++) {
        for (let b = 0; b < n; b++) {
          const base = a * o1 + b * o2;
          for (let k = 0, i = base; k < n; k++, i += st) { lr[k] = re[i]; li[k] = im[i]; }
          fft1(lr, li, n, inverse);
          for (let k = 0, i = base; k < n; k++, i += st) { re[i] = lr[k]; im[i] = li[k]; }
        }
      }
    }
  }

  /* 여러 장(field)을 한 번에 삼선형 보간 (주기 경계) */
  function sampleInto(fields, n, x, y, z, out) {
    const fx = Math.floor(x), fy = Math.floor(y), fz = Math.floor(z);
    const tx = x - fx, ty = y - fy, tz = z - fz;
    const x0 = ((fx % n) + n) % n, y0 = ((fy % n) + n) % n, z0 = ((fz % n) + n) % n;
    const x1 = (x0 + 1) % n, y1 = (y0 + 1) % n, z1 = (z0 + 1) % n;
    const i000 = (z0 * n + y0) * n + x0, i100 = (z0 * n + y0) * n + x1;
    const i010 = (z0 * n + y1) * n + x0, i110 = (z0 * n + y1) * n + x1;
    const i001 = (z1 * n + y0) * n + x0, i101 = (z1 * n + y0) * n + x1;
    const i011 = (z1 * n + y1) * n + x0, i111 = (z1 * n + y1) * n + x1;
    const w000 = (1 - tx) * (1 - ty) * (1 - tz), w100 = tx * (1 - ty) * (1 - tz);
    const w010 = (1 - tx) * ty * (1 - tz), w110 = tx * ty * (1 - tz);
    const w001 = (1 - tx) * (1 - ty) * tz, w101 = tx * (1 - ty) * tz;
    const w011 = (1 - tx) * ty * tz, w111 = tx * ty * tz;
    for (let f = 0; f < fields.length; f++) {
      const F = fields[f];
      out[f] = F[i000] * w000 + F[i100] * w100 + F[i010] * w010 + F[i110] * w110 +
        F[i001] * w001 + F[i101] * w101 + F[i011] * w011 + F[i111] * w111;
    }
  }

  /* count: 상자 안에 뿌릴 입자 수(구 안의 것만 남김) */
  function generate(opts) {
    const o = Object.assign({ seed: 20240611, count: 300000, sigma: 1.25 }, opts || {});
    const r = U.rng(o.seed);
    const n = NG;
    const n3 = n * n * n;
    const re = new Float64Array(n3);
    const im = new Float64Array(n3);
    for (let i = 0; i < n3; i++) re[i] = U.gauss(r);
    fft3(re, im, n, false);

    /* 파워 스펙트럼: 큰 규모는 거의 고르고, 작은 규모로 갈수록 덩어리짐. 격자보다 작은 요동은 걸러 냄 */
    const KF = new Int32Array(n);
    for (let i = 0; i < n; i++) KF[i] = i <= n / 2 ? i : i - n;
    const kf = (i) => KF[i];
    const Rs = 1.15; // 칸 단위 평활 반지름
    const dRe = new Float64Array(n3);
    const dIm = new Float64Array(n3);
    for (let z = 0; z < n; z++) {
      for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
          const i = (z * n + y) * n + x;
          const kx = kf(x), ky = kf(y), kz = kf(z);
          const k2 = kx * kx + ky * ky + kz * kz;
          if (k2 === 0) continue;
          const k = Math.sqrt(k2) * ((2 * Math.PI) / n);
          const amp = Math.pow(k, -0.85) * Math.exp(-0.5 * k * k * Rs * Rs) / (1 + Math.pow(0.35 / k, 2));
          dRe[i] = re[i] * amp;
          dIm[i] = im[i] * amp;
        }
      }
    }

    /* δ 실공간 (밝기·별이 켜지는 순서에 씀) */
    const delta = (function () {
      const a = Float64Array.from(dRe);
      const b = Float64Array.from(dIm);
      fft3(a, b, n, true);
      return a;
    })();
    let s2 = 0;
    for (let i = 0; i < n3; i++) s2 += delta[i] * delta[i];
    const sd = Math.sqrt(s2 / n3);
    const norm = o.sigma / sd; // 지금(D=1) 선형 밀도 요동의 표준편차 = sigma

    /* ψ_j(k) = i k_j / k² δ(k)  (칸 단위) */
    const psi = [];
    for (let axis = 0; axis < 3; axis++) {
      const a = new Float64Array(n3);
      const b = new Float64Array(n3);
      for (let z = 0; z < n; z++) {
        for (let y = 0; y < n; y++) {
          for (let x = 0; x < n; x++) {
            const i = (z * n + y) * n + x;
            const kx = kf(x), ky = kf(y), kz = kf(z);
            const k2 = kx * kx + ky * ky + kz * kz;
            const kj = axis === 0 ? kx : axis === 1 ? ky : kz;
            if (k2 === 0 || Math.abs(kj) === n / 2) continue;
            const s = (kj * (n / (2 * Math.PI))) / k2; // 1/k 를 칸 단위로
            a[i] = -dIm[i] * s * norm;
            b[i] = dRe[i] * s * norm;
          }
        }
      }
      fft3(a, b, n, true);
      psi.push(a);
    }
    for (let i = 0; i < n3; i++) delta[i] *= norm;

    const fields = [psi[0], psi[1], psi[2], delta];
    const smp = new Float64Array(4);

    /* 입자 뿌리기: 상자 안 무작위 위치 q (격자 무늬가 보이지 않게), 구 안만 */
    const R = n / 2;
    const tmp = [];
    for (let k = 0; k < o.count; k++) {
      const qx = r() * n, qy = r() * n, qz = r() * n;
      const dx = qx - R, dy = qy - R, dz = qz - R;
      if (dx * dx + dy * dy + dz * dz > R * R) continue;
      tmp.push(qx, qy, qz);
    }
    const count = tmp.length / 3;
    const q = new Float32Array(count * 3);
    const ps = new Float32Array(count * 3);
    const lin = new Float32Array(count);
    for (let k = 0; k < count; k++) {
      const qx = tmp[3 * k], qy = tmp[3 * k + 1], qz = tmp[3 * k + 2];
      q[3 * k] = qx; q[3 * k + 1] = qy; q[3 * k + 2] = qz;
      sampleInto(fields, n, qx, qy, qz, smp);
      ps[3 * k] = smp[0]; ps[3 * k + 1] = smp[1]; ps[3 * k + 2] = smp[2];
      lin[k] = smp[3];
    }

    /* 지금(D=1) 모인 정도: 옮겨진 위치를 격자에 세어 입자마다 주변 밀도를 구함 */
    const grid = new Float32Array(n3);
    const cellOf = (x) => ((Math.floor(x) % n) + n) % n;
    const pos1 = (k, j) => q[3 * k + j] + ps[3 * k + j];
    for (let k = 0; k < count; k++) grid[(cellOf(pos1(k, 2)) * n + cellOf(pos1(k, 1))) * n + cellOf(pos1(k, 0))] += 1;
    const mean = count / ((4 / 3) * Math.PI * R * R * R);
    const dens = new Float32Array(count);
    for (let k = 0; k < count; k++) {
      const c = grid[(cellOf(pos1(k, 2)) * n + cellOf(pos1(k, 1))) * n + cellOf(pos1(k, 0))];
      dens[k] = c / mean;
    }

    /* 우리 은하 자리: 가운데 가까운, 꽤 붐비지만 은하단 한복판은 아닌 필라멘트 위 입자 */
    const sorted = Array.from(dens).sort((a, b) => a - b);
    const lo = sorted[Math.floor(count * 0.8)];
    const hi = sorted[Math.floor(count * 0.93)];
    let home = 0;
    let best = Infinity;
    for (let k = 0; k < count; k++) {
      if (dens[k] < lo || dens[k] > hi) continue;
      const dx = pos1(k, 0) - R, dy = pos1(k, 1) - R, dz = pos1(k, 2) - R;
      const d = dx * dx + dy * dy + dz * dz;
      if (d < best) { best = d; home = k; }
    }

    /* 셰이더에 넘길 값: 칸 단위 → 백만 광년, 우리 은하 기준 */
    const hq = [q[3 * home], q[3 * home + 1], q[3 * home + 2]];
    const hp = [ps[3 * home], ps[3 * home + 1], ps[3 * home + 2]];
    const attrQ = new Float32Array(count * 4);
    const attrP = new Float32Array(count * 4);
    for (let k = 0; k < count; k++) {
      for (let j = 0; j < 3; j++) {
        attrQ[4 * k + j] = (q[3 * k + j] - hq[j]) * CELL;
        attrP[4 * k + j] = (ps[3 * k + j] - hp[j]) * CELL;
      }
      attrQ[4 * k + 3] = dens[k];
      attrP[4 * k + 3] = r();
    }
    return { count, attrQ, attrP, lin, dens, home, cell: CELL, box: BOX, radius: R * CELL, meanDens: mean };
  }

  UC.web = { generate, fft1, fft3, NG, BOX, CELL };
})();
