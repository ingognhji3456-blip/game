'use strict';

/* 공용 도우미: 보간, 표 조회, 한국어 시간 표기 */
(function () {
  const EC = (window.EC = window.EC || {});

  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smoothstep = (a, b, x) => {
    const t = clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };

  /* table: [[t, v], ...] (t 오름차순, 같은 t 가 두 번 나오면 계단) → table[i][0] <= t 인 가장 큰 i */
  function findIndex(table, t) {
    let lo = 0;
    let hi = table.length - 1;
    if (t < table[0][0]) return 0;
    if (t >= table[hi][0]) return hi;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (table[mid][0] <= t) lo = mid;
      else hi = mid;
    }
    return lo;
  }

  function interp(table, t) {
    const n = table.length;
    if (t <= table[0][0]) return table[0][1];
    if (t >= table[n - 1][0]) return table[n - 1][1];
    const i = findIndex(table, t);
    const a = table[i];
    const b = table[i + 1];
    if (b[0] === a[0]) return b[1];
    return a[1] + (b[1] - a[1]) * (t - a[0]) / (b[0] - a[0]);
  }

  /* 양수 값(이산화탄소 농도 등)을 로그 공간에서 보간 */
  function interpLog(table, t) {
    const n = table.length;
    if (t <= table[0][0]) return table[0][1];
    if (t >= table[n - 1][0]) return table[n - 1][1];
    const i = findIndex(table, t);
    const a = table[i];
    const b = table[i + 1];
    if (b[0] === a[0]) return b[1];
    const f = (t - a[0]) / (b[0] - a[0]);
    return Math.exp(Math.log(a[1]) + (Math.log(b[1]) - Math.log(a[1])) * f);
  }

  /* 정렬된 숫자 배열에서 arr[i] <= x 인 가장 큰 i (없으면 -1) */
  function bisectRight(arr, x, key) {
    let lo = 0;
    let hi = arr.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      const v = key ? key(arr[mid]) : arr[mid];
      if (v <= x) lo = mid + 1;
      else hi = mid;
    }
    return lo - 1;
  }

  const nf = new Intl.NumberFormat('ko-KR');

  /* 햇수(양수)를 한국어 큰 수 단위로: 45억 4천만 / 6,600만 / 1만 2천 / 8천 */
  function formatYears(y) {
    y = Math.abs(y);
    if (y >= 1e8 - 5e6) {
      let eok = Math.floor((y + 5e6) / 1e8);
      let rest = Math.round((y - eok * 1e8) / 1e7);
      if (rest < 0) rest = 0;
      if (rest >= 10) { eok += 1; rest = 0; }
      return rest ? `${eok}억 ${rest}천만` : `${eok}억`;
    }
    if (y >= 1e4) {
      const man = y / 1e4;
      if (man >= 1000) return `${nf.format(Math.round(man / 10) * 10)}만`;
      if (man >= 10) return `${nf.format(Math.round(man))}만`;
      let m = Math.floor(man);
      let cheon = Math.round((y - m * 1e4) / 1e3);
      if (cheon >= 10) { m += 1; cheon = 0; }
      return cheon ? `${m}만 ${cheon}천` : `${m}만`;
    }
    if (y >= 1000) return `${Math.round(y / 1000)}천`;
    return nf.format(Math.max(10, Math.round(y / 10) * 10));
  }

  /* t: 현재 기준 백만 년 (음수 = 과거) */
  function formatTime(t) {
    const years = Math.abs(t) * 1e6;
    if (years < 50) return '현재';
    return `${formatYears(years)} 년 ${t < 0 ? '전' : '후'}`;
  }

  /* 기간(백만 년 단위)을 "1억 2천만 년" 처럼 */
  function formatSpan(myr) {
    return `${formatYears(Math.abs(myr) * 1e6)} 년`;
  }

  function formatNumber(v, digits = 0) {
    return new Intl.NumberFormat('ko-KR', { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(v);
  }

  /* 시드 난수 (mulberry32) */
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  EC.util = {
    clamp, lerp, smoothstep, findIndex, interp, interpLog, bisectRight,
    formatYears, formatTime, formatSpan, formatNumber, rng, escapeHtml,
  };
})();
