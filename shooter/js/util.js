'use strict';

/* =========================================================
 * 하늘 사냥꾼 — 공용 도우미 & 네임스페이스
 * 모든 모듈은 window.SH 아래에 붙습니다. (빌드 도구/ES 모듈 없음)
 * util / data / game 은 DOM 을 쓰지 않아 Node 에서도 돌아갑니다.
 * ========================================================= */

window.SH = window.SH || {};

(() => {
  /** 게임 화면의 논리 크기 (세로 9:16). 실제 화면에 맞게 늘이고 줄입니다. */
  SH.W = 450;
  SH.H = 800;
  SH.TAU = Math.PI * 2;
  SH.DT = 1 / 60;
  SH.FONT = "'Pretendard', 'Noto Sans KR', 'Apple SD Gothic Neo', 'Malgun Gothic', system-ui, sans-serif";

  SH.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  SH.lerp = (a, b, t) => a + (b - a) * t;
  SH.easeOut = (t) => 1 - (1 - t) * (1 - t);
  SH.easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

  /** 3차 베지어 곡선 위의 점 (p = [x, y]) */
  SH.bezier = (p0, p1, p2, p3, t) => {
    const u = 1 - t;
    const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
    return [
      a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0],
      a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1],
    ];
  };

  /** 시드 기반 난수 (mulberry32). rng() → [0, 1) */
  SH.rng = (seed) => {
    let s = seed >>> 0;
    const rng = () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    rng.range = (a, b) => a + rng() * (b - a);
    rng.int = (a, b) => a + Math.floor(rng() * (b - a + 1));
    rng.pick = (arr) => arr[Math.floor(rng() * arr.length)];
    rng.chance = (p) => rng() < p;
    rng.sign = () => (rng() < 0.5 ? -1 : 1);
    return rng;
  };

  /** 12345 → "12,345" */
  SH.fmt = (n) => String(Math.floor(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
})();
