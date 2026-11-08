'use strict';

/*
 * 시간 눈금과 시대 이름.
 * 시간 단위: 빅뱅 후 햇수(우주의 나이). 10⁻⁴³초부터 10¹⁰⁶년까지 아주 넓으므로
 * 타임라인은 구간마다 로그·선형 눈금을 섞어 씁니다. 우주가 끝나는 개입을 하면 눈금도 그 끝에 맞춰 바뀝니다.
 */
(function () {
  const UC = (window.UC = window.UC || {});
  const U = UC.util;
  const C = UC.cosmo;
  const Y = U.YEAR_S;
  const T_NOW = C.T_NOW;

  const TAU_START = 1.7e-51; // 플랑크 시간 (5.4×10⁻⁴⁴초)
  const TAU_END = 1e106;

  const BASE_SEGMENTS = [
    { from: TAU_START, to: 3.8e5, w: 0.15, mode: 'log' },
    { from: 3.8e5, to: 1e9, w: 0.12, mode: 'log' },
    { from: 1e9, to: T_NOW, w: 0.3, mode: 'lin' },
    { from: T_NOW, to: T_NOW + 16e9, w: 0.15, mode: 'lin' },
    { from: T_NOW + 16e9, to: TAU_END, w: 0.28, mode: 'log' },
  ];

  /* 우주가 tEnd 에 끝나면 그 뒤를 잘라 내고, 마지막 구간은 끝으로 갈수록 촘촘하게 */
  function makeScale(tEnd) {
    let segs = BASE_SEGMENTS.map((s) => Object.assign({}, s));
    if (Number.isFinite(tEnd) && tEnd < TAU_END) {
      segs = segs.filter((s) => s.from < tEnd);
      const last = segs[segs.length - 1];
      last.to = tEnd;
      last.mode = 'logEnd';
      last.eps = (tEnd - last.from) * 3e-4;
      const sum = segs.reduce((a, s) => a + s.w, 0);
      segs.forEach((s) => { s.w /= sum; });
    }
    let acc = 0;
    for (const s of segs) {
      s.s0 = acc;
      acc += s.w;
      s.s1 = acc;
      if (s.mode === 'log') { s.l0 = Math.log10(s.from); s.l1 = Math.log10(s.to); }
      if (s.mode === 'logEnd') s.L = Math.log(1 + (s.to - s.from) / s.eps);
    }
    const tStart = TAU_START;
    const tEndS = segs[segs.length - 1].to;

    function toS(t) {
      t = U.clamp(t, tStart, tEndS);
      for (const s of segs) {
        if (t <= s.to || s === segs[segs.length - 1]) {
          let u;
          if (s.mode === 'log') u = (Math.log10(Math.max(t, 1e-300)) - s.l0) / (s.l1 - s.l0);
          else if (s.mode === 'logEnd') u = 1 - Math.log(1 + (s.to - t) / s.eps) / s.L;
          else u = (t - s.from) / (s.to - s.from);
          return s.s0 + U.clamp(u, 0, 1) * s.w;
        }
      }
      return 1;
    }
    function fromS(x) {
      x = U.clamp(x, 0, 1);
      for (const s of segs) {
        if (x <= s.s1 || s === segs[segs.length - 1]) {
          const u = U.clamp((x - s.s0) / s.w, 0, 1);
          if (s.mode === 'log') return Math.pow(10, s.l0 + u * (s.l1 - s.l0));
          if (s.mode === 'logEnd') return s.to - s.eps * (Math.exp((1 - u) * s.L) - 1);
          return s.from + u * (s.to - s.from);
        }
      }
      return tEndS;
    }
    return { segs, toS, fromS, tStart, tEnd: tEndS };
  }

  /* 큰 시대 (타임라인 색띠) */
  const AGES = [
    { name: '초기 우주', from: 0, to: C.T_RECOMB, color: '#ffae5e' },
    { name: '우주 암흑 시대', from: C.T_RECOMB, to: 1.5e8, color: '#8d5bb0' },
    { name: '별과 은하의 시대', from: 1.5e8, to: T_NOW, color: '#78b6ff' },
    { name: '미래', from: T_NOW, to: 1e14, color: '#76d3b0' },
    { name: '끝없는 밤', from: 1e14, to: Infinity, color: '#5a617f' },
  ];

  /* 자세한 시대 이름 */
  const EPOCHS = [
    { name: '플랑크 시대', from: 0, to: 1e-43 / Y },
    { name: '대통일 시대', from: 1e-43 / Y, to: 1e-36 / Y },
    { name: '급팽창 (인플레이션)', from: 1e-36 / Y, to: 1e-32 / Y },
    { name: '전약 시대', from: 1e-32 / Y, to: 1e-12 / Y },
    { name: '쿼크 시대', from: 1e-12 / Y, to: 1e-6 / Y },
    { name: '강입자 시대', from: 1e-6 / Y, to: 1 / Y },
    { name: '경입자 시대', from: 1 / Y, to: 10 / Y },
    { name: '원자핵 합성', from: 10 / Y, to: 1200 / Y },
    { name: '광자 시대', from: 1200 / Y, to: C.T_RECOMB },
    { name: '우주 암흑 시대', from: C.T_RECOMB, to: 1.5e8 },
    { name: '첫 별과 재이온화', from: 1.5e8, to: 1e9 },
    { name: '은하의 시대', from: 1e9, to: T_NOW - 2e6 },
    { name: '지금', from: T_NOW - 2e6, to: T_NOW + 2e6 },
    { name: '별의 시대', from: T_NOW + 2e6, to: 1e14 },
    { name: '축퇴 시대', from: 1e14, to: 1e40 },
    { name: '블랙홀 시대', from: 1e40, to: 1e100 },
    { name: '영원한 어둠', from: 1e100, to: Infinity },
  ];

  const findIn = (list, t) => list.find((e) => t >= e.from && t < e.to) || list[list.length - 1];
  function labelAt(t) {
    const age = findIn(AGES, t);
    const epoch = findIn(EPOCHS, t);
    return { age, epoch, color: age.color };
  }

  const isNow = (t) => Math.abs(t - T_NOW) < 2e6;

  /* 태양이 있던 시대(최근 50억 년)는 지구 연대기처럼 "몇 년 전"으로, 그보다 이른 때는 "빅뱅 후"로 */
  const RECENT = T_NOW - 5e9;
  /* 화면 위 큰 시계 */
  function clockText(t) {
    if (isNow(t)) return '현재';
    if (t < T_NOW) return t > RECENT ? `${U.formatYears(T_NOW - t)} 년 전` : `빅뱅 후 ${U.formatSpan(t)}`;
    return `${U.formatSpan(t - T_NOW)} 후`;
  }
  /* 시계 아래 작은 글씨 */
  function clockSub(t) {
    if (isNow(t)) return `빅뱅 후 ${U.formatSpan(T_NOW)}`;
    if (t < T_NOW && t > RECENT) return `빅뱅 후 ${U.formatSpan(t)}`;
    if (t < T_NOW && t > 1e8) return `${U.formatYears(T_NOW - t)} 년 전`;
    if (t > T_NOW && t - T_NOW < 1e12) return `빅뱅 후 ${U.formatSpan(t)}`;
    return '';
  }
  /* 짧은 한 줄 (카드, 툴팁) */
  function shortText(t) {
    if (isNow(t)) return '현재';
    if (t < T_NOW) {
      if (t > 1e8) return `${U.formatYears(T_NOW - t)} 년 전`;
      return `빅뱅 후 ${U.formatSpan(t)}`;
    }
    return `${U.formatSpan(t - T_NOW)} 후`;
  }

  const TICKS = [
    [TAU_START, '빅뱅'], [1e-32 / Y, `10${U.sup(-32)}초`], [1 / Y, '1초'], [180 / Y, '3분'], [3.8e5, '38만 년'],
    [1e8, '1억'], [1e9, '10억'], [5e9, '50억'], [T_NOW, '현재'], [T_NOW + 5e9, '50억 년 후'],
    [1e12, '1조'], [1e20, `10${U.sup(20)}`], [1e40, `10${U.sup(40)}`], [1e100, `10${U.sup(100)}`],
  ];

  UC.time = { TAU_START, TAU_END, T_NOW, makeScale, labelAt, clockText, clockSub, shortText, isNow, TICKS };
  UC.data = UC.data || {};
  UC.data.AGES = AGES;
  UC.data.EPOCHS = EPOCHS;
})();
