'use strict';

/*
 * 지질 시대 구분과 타임라인 눈금.
 * 시간 단위: 현재 기준 백만 년 (음수 = 과거, 양수 = 미래)
 * 경계와 색은 국제층서위원회(ICS) 연대표를 따랐습니다.
 */
(function () {
  const EC = (window.EC = window.EC || {});
  EC.data = EC.data || {};
  const U = EC.util;

  const T_START = -4540;
  const T_END = 7600;

  const eons = [
    { id: 'hadean', name: '명왕누대', from: -4540, to: -4031, color: '#ae027e' },
    { id: 'archean', name: '시생누대', from: -4031, to: -2500, color: '#f0047f' },
    { id: 'proterozoic', name: '원생누대', from: -2500, to: -538.8, color: '#f73563' },
    { id: 'phanerozoic', name: '현생누대', from: -538.8, to: 0, color: '#9ad9dd' },
    { id: 'future', name: '미래', from: 0, to: T_END, color: '#6b7bb5' },
  ];

  const eras = [
    { name: '초시생대', from: -4031, to: -3600 },
    { name: '고시생대', from: -3600, to: -3200 },
    { name: '중시생대', from: -3200, to: -2800 },
    { name: '신시생대', from: -2800, to: -2500 },
    { name: '고원생대', from: -2500, to: -1600 },
    { name: '중원생대', from: -1600, to: -1000 },
    { name: '신원생대', from: -1000, to: -538.8 },
    { name: '고생대', from: -538.8, to: -251.9 },
    { name: '중생대', from: -251.9, to: -66 },
    { name: '신생대', from: -66, to: 0 },
    { name: '다음 초대륙을 향해', from: 0, to: 250 },
    { name: '밝아지는 태양', from: 250, to: 1000 },
    { name: '증발하는 바다', from: 1000, to: 2800 },
    { name: '죽은 행성', from: 2800, to: 5000 },
    { name: '적색거성의 시대', from: 5000, to: T_END },
  ];

  const periods = [
    { name: '크라이오제니아기', from: -720, to: -635, color: '#fecc5c' },
    { name: '에디아카라기', from: -635, to: -538.8, color: '#fed96a' },
    { name: '캄브리아기', from: -538.8, to: -485.4, color: '#7fa056' },
    { name: '오르도비스기', from: -485.4, to: -443.8, color: '#009270' },
    { name: '실루리아기', from: -443.8, to: -419.2, color: '#b3e1b6' },
    { name: '데본기', from: -419.2, to: -358.9, color: '#cb8c37' },
    { name: '석탄기', from: -358.9, to: -298.9, color: '#67a599' },
    { name: '페름기', from: -298.9, to: -251.9, color: '#f04028' },
    { name: '트라이아스기', from: -251.9, to: -201.4, color: '#812b92' },
    { name: '쥐라기', from: -201.4, to: -145, color: '#34b2c9' },
    { name: '백악기', from: -145, to: -66, color: '#7fc64e' },
    { name: '팔레오기', from: -66, to: -23.03, color: '#fd9a52' },
    { name: '네오기', from: -23.03, to: -2.58, color: '#ffe619' },
    { name: '제4기', from: -2.58, to: 0, color: '#f9f97f' },
  ];

  /*
   * 타임라인 눈금: 구간마다 폭(w)을 따로 주어, 일이 많이 일어난 최근 시대에 더 많은 자리를 줍니다.
   * logEnd: 구간 끝(현재)으로 갈수록 촘촘하게 / logStart: 구간 시작(현재)에 가까울수록 촘촘하게
   */
  const segments = [
    { from: -4540, to: -2500, w: 0.15 },
    { from: -2500, to: -538.8, w: 0.15 },
    { from: -538.8, to: -66, w: 0.25 },
    { from: -66, to: -2.58, w: 0.11 },
    { from: -2.58, to: 0, w: 0.12, logEnd: 0.004 },
    { from: 0, to: 1000, w: 0.12, logStart: 15 },
    { from: 1000, to: T_END, w: 0.10 },
  ];
  let acc = 0;
  for (const s of segments) {
    s.s0 = acc;
    acc += s.w;
    s.s1 = acc;
    if (s.logEnd) s.L = Math.log(1 + (s.to - s.from) / s.logEnd);
    if (s.logStart) s.L = Math.log(1 + (s.to - s.from) / s.logStart);
  }

  function toS(t) {
    t = U.clamp(t, T_START, T_END);
    for (const s of segments) {
      if (t <= s.to || s === segments[segments.length - 1]) {
        let u;
        if (s.logEnd) u = 1 - Math.log(1 + (s.to - t) / s.logEnd) / s.L;
        else if (s.logStart) u = Math.log(1 + (t - s.from) / s.logStart) / s.L;
        else u = (t - s.from) / (s.to - s.from);
        return s.s0 + U.clamp(u, 0, 1) * s.w;
      }
    }
    return 1;
  }

  function fromS(x) {
    x = U.clamp(x, 0, 1);
    for (const s of segments) {
      if (x <= s.s1 || s === segments[segments.length - 1]) {
        const u = U.clamp((x - s.s0) / s.w, 0, 1);
        if (s.logEnd) return s.to - s.logEnd * (Math.exp((1 - u) * s.L) - 1);
        if (s.logStart) return s.from + s.logStart * (Math.exp(u * s.L) - 1);
        return s.from + u * (s.to - s.from);
      }
    }
    return T_END;
  }

  const findIn = (list, t) => list.find((x) => (t >= x.from && t < x.to) || (t === 0 && x.to === 0)) || (t >= list[list.length - 1].to - 1e-9 && t <= list[list.length - 1].to ? list[list.length - 1] : null);

  /* 지금 시각의 이름: "현생누대 · 중생대 · 쥐라기" */
  function labelAt(t) {
    const eon = findIn(eons, t) || eons[eons.length - 1];
    const era = findIn(eras, t);
    const period = findIn(periods, t);
    return { eon, era, period, color: (period && period.color) || eon.color };
  }

  EC.data.T_START = T_START;
  EC.data.T_END = T_END;
  EC.data.eons = eons;
  EC.data.eras = eras;
  EC.data.periods = periods;
  EC.time = { segments, toS, fromS, labelAt, T_START, T_END };
})();
