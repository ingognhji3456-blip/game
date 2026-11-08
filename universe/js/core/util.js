'use strict';

/* 공용 도우미: 보간, 난수, 한국어로 아주 짧은 시간부터 아주 긴 시간까지 쓰기 */
(function () {
  const UC = (window.UC = window.UC || {});

  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smoothstep = (a, b, x) => {
    const t = clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };
  const log10 = Math.log10;

  /* 정렬된 배열에서 arr[i] <= x 인 가장 큰 i (없으면 -1) */
  function bisectRight(arr, x) {
    let lo = 0;
    let hi = arr.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (arr[mid] <= x) lo = mid + 1;
      else hi = mid;
    }
    return lo - 1;
  }

  const nf = new Intl.NumberFormat('ko-KR');
  const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
  const sup = (n) => String(n).split('').map((c) => SUP[c] || c).join('');
  const pow10 = (k) => `10${sup(k)}`;

  /* 햇수(양수)를 한국어 큰 수 단위로: 138억 / 45억 4천만 / 38만 / 1조 / 10²⁰ */
  function formatYears(y) {
    y = Math.abs(y);
    if (y >= 9.95e15) return pow10(Math.round(log10(y)));
    if (y >= 1e12 - 5e10) {
      let jo = Math.floor((y + 5e10) / 1e12);
      let rest = Math.round((y - jo * 1e12) / 1e11);
      if (rest < 0) rest = 0;
      if (rest >= 10) { jo += 1; rest = 0; }
      if (jo >= 10) return `${nf.format(Math.round(y / 1e12))}조`;
      return rest ? `${jo}조 ${rest}천억` : `${jo}조`;
    }
    if (y >= 1e8 - 5e6) {
      let eok = Math.floor((y + 5e6) / 1e8);
      let rest = Math.round((y - eok * 1e8) / 1e7);
      if (rest < 0) rest = 0;
      if (rest >= 10) { eok += 1; rest = 0; }
      if (eok >= 100) return `${nf.format(Math.round(y / 1e8))}억`;
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
    if (y >= 100) return nf.format(Math.round(y / 10) * 10);
    if (y >= 10) return String(Math.round(y));
    return String(Math.round(y * 10) / 10);
  }

  const YEAR_S = 3.15576e7;

  /* 길이(년)를 사람이 읽기 좋게: 10⁻³⁶초 · 3분 · 38만 년 · 1조 년 · 10¹⁰⁰ 년 */
  function formatSpan(years) {
    const y = Math.abs(years);
    const s = y * YEAR_S;
    if (s < 0.95) {
      const k = Math.round(log10(Math.max(s, 1e-300)));
      return `${pow10(k)}초`;
    }
    if (s < 59.5) return `${Math.round(s)}초`;
    if (s < 3570) return `${Math.round(s / 60)}분`;
    if (s < 86400 * 0.98) return `${Math.round(s / 3600)}시간`;
    if (y < 0.997) return `${Math.round(s / 86400)}일`;
    return `${formatYears(y)} 년`;
  }

  function formatNumber(v, digits = 0) {
    return new Intl.NumberFormat('ko-KR', { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(v);
  }

  /* 아주 크거나 작은 수: 1,234 · 3.2×10⁻⁵ */
  function formatSci(v, digits = 2) {
    if (v === 0) return '0';
    const a = Math.abs(v);
    if (a >= 1e-2 && a < 1e6) return formatNumber(v, a < 10 ? digits : a < 100 ? 1 : 0);
    const k = Math.floor(log10(a));
    const m = v / Math.pow(10, k);
    const ms = Math.abs(m - 1) < 0.05 ? '' : `${m.toFixed(1)}×`;
    return `${ms}${pow10(k)}`;
  }

  /* 거리(광년) */
  function formatLy(ly) {
    const a = Math.abs(ly);
    const AU = 1 / 63241.1;
    if (a < 0.05) {
      const au = a / AU;
      if (au < 0.1) return `${formatNumber(au * 149.6, 0)}백만 km`;
      return `${formatNumber(au, au < 10 ? 1 : 0)} AU`;
    }
    if (a < 1) return `${formatNumber(a, 2)} 광년`;
    if (a < 1e4) return `${formatNumber(a, a < 10 ? 1 : 0)} 광년`;
    return `${formatYears(a)} 광년`;
  }

  /* 온도(켈빈) */
  function formatTemp(K) {
    if (K >= 1e6) return `${formatYears(K)} 도`;
    if (K >= 1000) return `${formatNumber(Math.round(K / 10) * 10)} K`;
    if (K >= 10) return `${formatNumber(K, 1)} K`;
    if (K >= 1) return `${formatNumber(K, 2)} K`;
    if (K >= 1e-3) return `${formatNumber(K, 3)} K`;
    return `${formatSci(K)} K`;
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
  /* 정규분포 난수 */
  function gauss(r) {
    let u = r();
    if (u < 1e-12) u = 1e-12;
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  /* 흑체 온도 → 화면 색 (0~1, 대략 sRGB). Tanner Helland 근사를 부드럽게 다듬은 것 */
  function blackbody(K) {
    const t = clamp(K, 800, 40000) / 100;
    let r;
    let g;
    let b;
    if (t <= 66) {
      r = 1;
      g = clamp((99.4708025861 * Math.log(t) - 161.1195681661) / 255, 0, 1);
      b = t <= 19 ? 0 : clamp((138.5177312231 * Math.log(t - 10) - 305.0447927307) / 255, 0, 1);
    } else {
      r = clamp((329.698727446 * Math.pow(t - 60, -0.1332047592)) / 255, 0, 1);
      g = clamp((288.1221695283 * Math.pow(t - 60, -0.0755148492)) / 255, 0, 1);
      b = 1;
    }
    return [r, g, b];
  }

  UC.util = {
    clamp, lerp, smoothstep, bisectRight, sup, pow10, YEAR_S,
    formatYears, formatSpan, formatNumber, formatSci, formatLy, formatTemp,
    rng, gauss, escapeHtml, blackbody,
  };
})();
