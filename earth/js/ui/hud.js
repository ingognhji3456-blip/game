'use strict';

/* 위쪽 시계와 오른쪽 "지구 상태" 패널 */
(function () {
  const EC = (window.EC = window.EC || {});
  const U = EC.util;
  const $ = (id) => document.getElementById(id);

  const f = (v, d = 0) => U.formatNumber(v, d);

  function fmtT(T) { return `${f(T, Math.abs(T) < 100 ? 1 : 0)}°C`; }
  function fmtCO2(c) {
    if (c >= 1e5) return `약 ${f(c / 1e6, c >= 1e6 ? 0 : 1)}기압`;
    return `${f(c, c < 20 ? 1 : 0)} ppm`;
  }
  function fmtO2(o) {
    if (o < 0.01) return '거의 없음';
    return `${f(o, o < 1 ? 2 : 1)}%`;
  }
  function fmtDay(h) { return `${f(h, 1)}시간`; }
  function fmtMoon(km) { return km <= 0 ? '아직 없음' : `${f(km / 1e4, 1)}만 km`; }

  function lifeLabel(st) {
    if (!st.alive) return st.t < -3800 ? '아직 없음' : '없음';
    return st.stageName;
  }

  function rulerLabel(st) {
    if (!st.alive) return '—';
    if (st.civ) return '인류 문명';
    if (st.humans) return '포유류 (인류 등장)';
    if (st.dynastyName) return st.dynastyName;
    const S = EC.sim.S;
    if (st.stage >= S.animals) return '바다 동물';
    if (st.stage >= S.multicell) return '바다의 작은 생물';
    return '미생물';
  }

  const ROWS = [
    { key: 'T', main: true, label: '평균 기온', val: (s) => fmtT(s.T), diff: (a, b) => Math.abs(a.T - b.T) > 0.5 },
    { key: 'co2', main: true, label: '이산화탄소', val: (s) => fmtCO2(s.co2), diff: (a, b) => Math.abs(Math.log(a.co2 / b.co2)) > 0.05 },
    { key: 'O2', main: true, label: '산소', val: (s) => fmtO2(s.O2), diff: (a, b) => Math.abs(a.O2 - b.O2) > 0.3 },
    { key: 'ruler', main: true, label: '지배 생물', val: rulerLabel, diff: (a, b) => rulerLabel(a) !== rulerLabel(b) },
    { key: 'life', label: '생명', val: lifeLabel, cls: 'life', diff: (a, b) => a.stage !== b.stage || a.alive !== b.alive },
    { key: 'B', label: '생물 다양성', val: (s) => (s.alive ? `${Math.round(s.B)} / 100` : '0'), diff: (a, b) => Math.abs(a.B - b.B) > 3 },
    { key: 'ice', label: '얼음', val: (s) => (s.snow ? '지구 전체' : `${Math.round(s.iceFrac * 100)}%`), diff: (a, b) => Math.abs(a.iceFrac - b.iceFrac) > 0.02 },
    { key: 'sea', label: '바다', val: (s) => (s.ocean < 0.995 ? (s.ocean <= 0.001 ? '없음' : `지금의 ${Math.round(s.ocean * 100)}%`) : `해수면 ${s.seaLevel >= 0 ? '+' : ''}${Math.round(s.seaLevel)}m`) },
    { key: 'day', label: '하루', val: (s) => `${fmtDay(s.dayHours)} · 1년 ${Math.round(8766 / s.dayHours)}일` },
    { key: 'moon', label: '달까지', val: (s) => fmtMoon(s.moonKm) },
    { key: 'sun', label: '태양 밝기', val: (s) => `지금의 ${f(s.sunLum * 100, 0)}%` },
  ];

  const els = {};

  function rowHtml(r) {
    return `<div class="stat ${r.cls || ''}" data-k="${r.key}"><span class="sl">${r.label}</span><span class="stat-v"><span class="sv"></span><span class="sub" hidden></span></span></div>`;
  }

  function init() {
    const body = $('stats-body');
    body.innerHTML = ROWS.filter((r) => r.main).map(rowHtml).join('') + `<div class="more-rows">${ROWS.filter((r) => !r.main).map(rowHtml).join('')}</div>`;
    for (const r of ROWS) {
      const row = body.querySelector(`[data-k="${r.key}"]`);
      els[r.key] = { v: row.querySelector('.sv'), sub: row.querySelector('.sub') };
    }
    els.time = $('clock-time');
    els.era = $('clock-era');
    els.chip = $('stats-toggle');
  }

  let lastEraKey = '';

  function update(st, base, diverged, rateText) {
    els.time.textContent = U.formatTime(st.t);
    const lab = EC.time.labelAt(st.t);
    const parts = [lab.eon.name];
    if (lab.era) parts.push(lab.era.name);
    if (lab.period) parts.push(lab.period.name);
    const eraText = parts.join(' · ') + (rateText ? `  ·  ${rateText}` : '');
    const key = eraText + lab.color;
    if (key !== lastEraKey) {
      lastEraKey = key;
      els.era.innerHTML = `<span class="chip" style="background:${lab.color}"></span>${U.escapeHtml(eraText)}`;
    }
    for (const r of ROWS) {
      const e = els[r.key];
      e.v.textContent = r.val(st);
      const show = diverged && base && r.diff && r.diff(st, base);
      e.sub.hidden = !show;
      if (show) e.sub.textContent = `실제: ${r.val(base)}`;
    }
    els.chip.innerHTML = `${diverged ? '<span style="color:var(--warn)">●</span> ' : ''}${U.escapeHtml(summary(st))}`;
  }

  /* 휴대폰에서 접혀 있을 때 머리글에 보이는 요약 */
  function summary(st) {
    return `${fmtT(st.T)} · ${rulerLabel(st) === '—' ? lifeLabel(st) : rulerLabel(st)}`;
  }

  EC.ui = EC.ui || {};
  EC.ui.hud = { init, update, summary, fmtT, fmtCO2, fmtO2, rulerLabel, lifeLabel };
})();
