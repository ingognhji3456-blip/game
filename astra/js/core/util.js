'use strict';

/* =========================================================
 * ASTRA : ZERO PROTOCOL — 네임스페이스와 공용 도우미
 * 모든 모듈은 window.AZ 아래에 붙습니다.
 * ========================================================= */
window.AZ = window.AZ || {};
AZ.data = AZ.data || {};
AZ.ui = AZ.ui || {};
AZ.gfx = AZ.gfx || {};

AZ.util = (() => {
  const TAU = Math.PI * 2;

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const approach = (cur, target, delta) =>
    cur < target ? Math.min(target, cur + delta) : Math.max(target, cur - delta);
  const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
  const dist2 = (ax, ay, bx, by) => (bx - ax) * (bx - ax) + (by - ay) * (by - ay);
  const angleTo = (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax);
  /** a 에서 b 로 가는 가장 짧은 각도 차 (-π..π) */
  const angleDiff = (a, b) => {
    let d = (b - a) % TAU;
    if (d > Math.PI) d -= TAU;
    if (d < -Math.PI) d += TAU;
    return d;
  };
  const turnToward = (cur, target, maxStep) => {
    const d = angleDiff(cur, target);
    return cur + clamp(d, -maxStep, maxStep);
  };
  const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
  const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const chance = (p) => Math.random() < p;
  const shuffle = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };
  const weighted = (entries) => {
    const total = entries.reduce((s, e) => s + Math.max(0, e[1]), 0);
    if (total <= 0) return entries.length ? entries[0][0] : undefined;
    let r = Math.random() * total;
    for (const [item, w] of entries) {
      r -= Math.max(0, w);
      if (r < 0) return item;
    }
    return entries[entries.length - 1][0];
  };

  const ease = {
    linear: (t) => t,
    outQuad: (t) => 1 - (1 - t) * (1 - t),
    inQuad: (t) => t * t,
    outCubic: (t) => 1 - Math.pow(1 - t, 3),
    inCubic: (t) => t * t * t,
    inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
    outBack: (t) => {
      const c1 = 1.70158;
      const c3 = c1 + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    },
    outExpo: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  };

  /** 초 → "m:ss.cc" */
  function fmtTime(sec) {
    if (sec == null || !isFinite(sec)) return '--:--.--';
    const s = Math.max(0, sec);
    const m = Math.floor(s / 60);
    const r = s - m * 60;
    const whole = Math.floor(r);
    const cs = Math.floor((r - whole) * 100);
    return `${m}:${String(whole).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
  }

  /** 초 → "h시간 m분" (총 플레이 시간) */
  function fmtDuration(sec) {
    const s = Math.floor(sec || 0);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return h > 0 ? `${h}시간 ${m}분` : `${m}분 ${s % 60}초`;
  }

  const deepClone = (o) => JSON.parse(JSON.stringify(o));

  /** 받침 유무에 따라 조사를 고릅니다: josa('리아','을','를') → '를' */
  function josa(word, withBatchim, withoutBatchim) {
    const ch = String(word).charCodeAt(String(word).length - 1);
    if (ch < 0xac00 || ch > 0xd7a3) return withoutBatchim;
    return (ch - 0xac00) % 28 ? withBatchim : withoutBatchim;
  }

  /** 점과 선분 사이 거리 제곱 */
  function segDist2(px, py, ax, ay, bx, by) {
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
    t = clamp(t, 0, 1);
    const cx = ax + dx * t;
    const cy = ay + dy * t;
    return (px - cx) * (px - cx) + (py - cy) * (py - cy);
  }

  let idCounter = 0;
  const nextId = () => ++idCounter;

  return {
    TAU, clamp, lerp, approach, dist, dist2, angleTo, angleDiff, turnToward,
    rand, randInt, pick, chance, shuffle, weighted, ease, fmtTime, fmtDuration,
    deepClone, josa, segDist2, nextId,
  };
})();
