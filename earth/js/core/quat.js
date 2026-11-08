'use strict';

/* 구면 위치와 회전(쿼터니언). 좌표계: x = cos(위도)sin(경도), y = sin(위도), z = cos(위도)cos(경도) */
(function () {
  const EC = (window.EC = window.EC || {});
  const D2R = Math.PI / 180;

  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const len = (a) => Math.sqrt(dot(a, a));
  const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

  function vec(lat, lon) {
    const la = lat * D2R;
    const lo = lon * D2R;
    return [Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo)];
  }

  function latLon(v) {
    const y = Math.max(-1, Math.min(1, v[1]));
    return [Math.asin(y) / D2R, Math.atan2(v[0], v[2]) / D2R];
  }

  const IDENTITY = [0, 0, 0, 1];

  /* 오른손 법칙: 축 바깥쪽에서 내려다볼 때 반시계 방향이 양수 (지질학의 오일러 회전과 같음) */
  function axisAngle(axis, deg) {
    const h = (deg * D2R) / 2;
    const s = Math.sin(h);
    return [axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(h)];
  }

  function euler(lat, lon, deg) {
    return axisAngle(vec(lat, lon), deg);
  }

  function mul(a, b) {
    return [
      a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
      a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
      a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
      a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
    ];
  }

  const conj = (q) => [-q[0], -q[1], -q[2], q[3]];

  function normalize(q) {
    const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
    return [q[0] / l, q[1] / l, q[2] / l, q[3] / l];
  }

  function rotate(q, v) {
    const x = q[0], y = q[1], z = q[2], w = q[3];
    const tx = 2 * (y * v[2] - z * v[1]);
    const ty = 2 * (z * v[0] - x * v[2]);
    const tz = 2 * (x * v[1] - y * v[0]);
    return [
      v[0] + w * tx + (y * tz - z * ty),
      v[1] + w * ty + (z * tx - x * tz),
      v[2] + w * tz + (x * ty - y * tx),
    ];
  }

  function slerp(a, b, t) {
    let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
    let bb = b;
    if (d < 0) { bb = [-b[0], -b[1], -b[2], -b[3]]; d = -d; }
    if (d > 0.99995) {
      return normalize([a[0] + (bb[0] - a[0]) * t, a[1] + (bb[1] - a[1]) * t, a[2] + (bb[2] - a[2]) * t, a[3] + (bb[3] - a[3]) * t]);
    }
    const th = Math.acos(d);
    const s = Math.sin(th);
    const wa = Math.sin((1 - t) * th) / s;
    const wb = Math.sin(t * th) / s;
    return [a[0] * wa + bb[0] * wb, a[1] * wa + bb[1] * wb, a[2] * wa + bb[2] * wb, a[3] * wa + bb[3] * wb];
  }

  /* u 를 v 로 보내는 최소 회전 */
  function fromTo(u, v) {
    const d = dot(u, v);
    if (d < -0.999999) {
      let axis = cross([1, 0, 0], u);
      if (len(axis) < 1e-6) axis = cross([0, 1, 0], u);
      return axisAngle(norm(axis), 180);
    }
    const c = cross(u, v);
    return normalize([c[0], c[1], c[2], 1 + d]);
  }

  /* 두 쿼터니언 사이 각도(도) */
  function angleBetween(a, b) {
    const d = Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]);
    return (2 * Math.acos(Math.min(1, d))) / D2R;
  }

  /* GLSL mat3 (열 우선): m * v == rotate(q, v) */
  function toMat3(q, out, offset = 0) {
    const x = q[0], y = q[1], z = q[2], w = q[3];
    const xx = x * x, yy = y * y, zz = z * z, xy = x * y, xz = x * z, yz = y * z, wx = w * x, wy = w * y, wz = w * z;
    const m = out || new Float32Array(9);
    m[offset + 0] = 1 - 2 * (yy + zz); m[offset + 1] = 2 * (xy + wz); m[offset + 2] = 2 * (xz - wy);
    m[offset + 3] = 2 * (xy - wz); m[offset + 4] = 1 - 2 * (xx + zz); m[offset + 5] = 2 * (yz + wx);
    m[offset + 6] = 2 * (xz + wy); m[offset + 7] = 2 * (yz - wx); m[offset + 8] = 1 - 2 * (xx + yy);
    return m;
  }

  EC.q = { D2R, dot, cross, len, norm, vec, latLon, IDENTITY, axisAngle, euler, mul, conj, normalize, rotate, slerp, fromTo, angleBetween, toMat3 };
})();
