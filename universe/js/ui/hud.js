'use strict';

/* 위쪽 시계와 오른쪽 "우주 상태" 패널 */
(function () {
  const UC = (window.UC = window.UC || {});
  const U = UC.util;
  const $ = (id) => document.getElementById(id);
  const NOW = UC.cosmo.T_NOW;

  function fmtSize(st) {
    if (st.ended && st.endType === 'rip') return '무한대';
    const lg = st.log10a;
    if (Math.abs(lg) < 0.004) return '지금과 같음';
    if (lg < 0) {
      if (lg > -6) return `지금의 1/${U.formatNumber(Math.pow(10, -lg), Math.pow(10, -lg) < 10 ? 1 : 0)}`;
      return `지금의 10${U.sup(Math.round(lg))}배`;
    }
    if (lg < 3) return `지금의 ${U.formatNumber(Math.pow(10, lg), lg < 1 ? 2 : 1)}배`;
    if (lg < 1e6) return `지금의 10${U.sup(Math.round(lg))}배`;
    return '셀 수 없이 큼';
  }
  function fmtExp(st) {
    if (st.ended) return st.endType === 'rip' ? '찢어짐' : '끝남';
    const h = Math.abs(st.Hkms);
    const v = h >= 1e4 ? U.formatSci(h) : U.formatNumber(h, h < 10 ? 1 : 0);
    if (st.contracting) return `수축 · ${v}`;
    return `${st.accel ? '가속' : '감속'} · ${v}`;
  }
  const DOM = { r: '빛 (복사)', m: '물질', de: '암흑 에너지' };
  function fmtDom(st) {
    const p = st.comps[st.dominant];
    return `${DOM[st.dominant]} ${Math.round(p * 100)}%`;
  }
  function starsLabel(tau, looks, st) {
    if (st.T > 3000) return '없음 (너무 뜨거움)';
    if (tau < 1.2e8) return '아직 없음';
    if (tau < 6e8) return '첫 별들';
    const lg = Math.log10(tau);
    if (lg > 14.1) return '모두 꺼짐';
    if (lg > 12.5) return '꺼져 가는 중';
    if (looks.sfr > 0.5) return '탄생 전성기';
    if (looks.sfr > 0.12) return '꾸준히 태어남';
    return '거의 안 태어남';
  }
  function sunLabel(sun) {
    switch (sun.phase) {
      case 'none': return sun.age < 0 ? '아직 없음' : '—';
      case 'cloud': return '가스 구름이 뭉치는 중';
      case 'young': return '갓 태어난 별';
      case 'main': return `주계열 · 밝기 ${Math.round(sun.L * 100)}%`;
      case 'giant': return `적색거성 · 지금의 ${Math.round(sun.R)}배`;
      case 'agb': return '적색거성 (마지막 단계)';
      case 'wd': return '백색왜성';
      case 'black': return '흑색왜성';
      default: return '—';
    }
  }
  function galaxyLabel(tau) {
    const SIM = UC.galaxy.SIM;
    const lg = Math.log10(Math.max(tau, 1));
    if (tau < 2e8) return '아직 없음';
    if (tau < 2.5e9) return '작은 덩어리들이 모이는 중';
    if (tau < 6e9) return '두꺼운 원반';
    if (tau < SIM.t0 + 0.8e9) return '나선 은하';
    if (tau < SIM.t0 + 3.4e9) return '안드로메다와 충돌 중';
    if (lg < 19) return '타원 은하 (밀코메다)';
    if (lg < 40) return '흩어진 별의 잔해';
    return '블랙홀만 남음';
  }

  const ROWS = [
    { key: 'age', main: true, label: '우주의 나이', val: (v) => (v.st.ended ? `${U.formatSpan(v.st.tEnd)} (끝)` : U.formatSpan(v.tau)) },
    { key: 'T', main: true, label: '온도', val: (v) => U.formatTemp(v.st.T), diff: (a, b) => Math.abs(Math.log(a.st.T / b.st.T)) > 0.02 },
    { key: 'size', main: true, label: '우주의 크기', val: (v) => fmtSize(v.st), diff: (a, b) => Math.abs(a.st.log10a - b.st.log10a) > 0.01 || a.st.ended !== b.st.ended },
    { key: 'exp', main: true, label: '팽창 (km/s/Mpc)', val: (v) => fmtExp(v.st), diff: (a, b) => fmtExp(a.st).split(' ')[0] !== fmtExp(b.st).split(' ')[0] || Math.abs(a.st.Hkms / b.st.Hkms - 1) > 0.03 },
    { key: 'dom', label: '우주의 주인공', val: (v) => fmtDom(v.st), diff: (a, b) => a.st.dominant !== b.st.dominant },
    { key: 'hor', label: '보이는 우주 반지름', val: (v) => U.formatLy(v.st.horizon), diff: (a, b) => Math.abs(a.st.horizon / b.st.horizon - 1) > 0.02 },
    { key: 'stars', label: '별', val: (v) => starsLabel(v.tau, v.looks, v.st) },
    { key: 'gal', label: '우리 은하', val: (v) => galaxyLabel(v.tau) },
    { key: 'sun', label: '태양', val: (v) => sunLabel(v.sun) },
  ];

  const els = {};
  function rowHtml(r) {
    return `<div class="stat" data-k="${r.key}"><span class="sl">${r.label}</span><span class="stat-v"><span class="sv"></span><span class="sub" hidden></span></span></div>`;
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

  let lastEra = '';
  /* v: { tau, st, looks, sun }, base: 같은 모양(실제 우주) */
  function update(v, base, diverged, rateText) {
    els.time.textContent = v.st.ended ? (v.st.endType === 'rip' ? '빅 립' : '빅 크런치') : UC.time.clockText(v.tau);
    const lab = UC.time.labelAt(v.tau);
    const sub = UC.time.clockSub(v.tau);
    const eraText = [lab.epoch.name, sub].filter(Boolean).join(' · ') + (rateText ? `  ·  ${rateText}` : '');
    const key = eraText + lab.color;
    if (key !== lastEra) {
      lastEra = key;
      els.era.innerHTML = `<span class="chip" style="background:${lab.color}"></span>${U.escapeHtml(eraText)}`;
    }
    for (const r of ROWS) {
      const e = els[r.key];
      e.v.textContent = r.val(v);
      const show = diverged && base && r.diff && r.diff(v, base);
      e.sub.hidden = !show;
      if (show) e.sub.textContent = `실제: ${r.val(base)}`;
    }
    els.chip.innerHTML = `${diverged ? '<span style="color:var(--warn)">●</span> ' : ''}${U.escapeHtml(`${U.formatTemp(v.st.T)} · ${fmtSize(v.st)}`)}`;
  }

  UC.ui = UC.ui || {};
  UC.ui.hud = { init, update, fmtSize, sunLabel, galaxyLabel };
})();
