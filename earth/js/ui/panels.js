'use strict';

/* 사건 카드, 바뀐 역사 패널 */
(function () {
  const EC = (window.EC = window.EC || {});
  const U = EC.util;
  const $ = (id) => document.getElementById(id);
  const esc = U.escapeHtml;

  const KIND_ICON = { astro: '🌌', geo: '🌍', climate: '🌡️', life: '🧬', extinction: '💀', intervention: '⚡', human: '🏙️' };

  const MILESTONE_NAMES = {
    life: '생명의 탄생', goe: '대산화 사건', eukaryote: '진핵생물', animals: '캄브리아기 대폭발', landPlants: '육상 식물',
    tetrapods: '육상 척추동물', dinosaurs: '공룡의 등장', dynMammal: '포유류의 시대', humans: '인류의 등장', civ: '문명의 시작',
    plantsDecline: '식물의 위기', complexEnd: '복잡한 생명의 종말', lifeEnd: '마지막 생명',
  };

  const IMMEDIATE = {
    dynArchosaur: '지배파충류가 육지의 주인이 됩니다.',
    dynMammal: '공룡의 시대가 끝나고 포유류가 지구를 차지합니다.',
    sterilized: '지구의 모든 생명이 사라졌습니다.',
    complexWiped: '동물과 식물이 모두 사라지고 미생물만 남았습니다.',
    humansLost: '인류가 멸종했습니다.',
    snowball: '지구 전체가 얼어붙었습니다.',
    complexEnd: '복잡한 생명이 살 수 없는 환경이 되었습니다.',
    lifeEnd: '마지막 생명까지 사라졌습니다.',
  };

  const fmtT = (t) => U.formatTime(t);

  /* 두 실행을 비교해 결과를 문장 목록으로 */
  function consequences(prev, next, atT, shockS) {
    const lines = [];
    const before = EC.sim.stateAt(prev, atT);
    if (shockS !== undefined && before.alive && shockS >= 0.02) lines.push(`생물 종의 약 ${Math.round(shockS * 100)}%가 사라집니다.`);
    for (const e of next.events) {
      if (Math.abs(e.t - atT) < 1e-6 && IMMEDIATE[e.id]) {
        const had = prev.events.some((p) => p.id === e.id && Math.abs(p.t - e.t) < 1e-6);
        if (!had) lines.push(IMMEDIATE[e.id]);
      }
    }
    const a = EC.sim.stateAt(prev, atT + 0.05);
    const b = EC.sim.stateAt(next, atT + 0.05);
    const dT = b.T - a.T;
    if (Math.abs(dT) >= 1 && !b.userSnow) lines.push(`평균 기온이 ${dT > 0 ? '+' : ''}${U.formatNumber(dT, 1)}°C 바뀝니다 (수백만 년에 걸쳐 되돌아옵니다).`);
    const fa = EC.sim.firstTimes(prev);
    const fb = EC.sim.firstTimes(next);
    for (const id of EC.sim.MILESTONES) {
      const name = MILESTONE_NAMES[id];
      const x = fa[id];
      const y = fb[id];
      if (x !== undefined && y !== undefined) {
        if (Math.abs(x - y) > Math.max(0.0005, Math.abs(x) * 0.002)) lines.push(`${name}: ${fmtT(x)} → <b>${fmtT(y)}</b>`);
      } else if (x !== undefined && y === undefined) {
        if (x > atT) lines.push(`${name}: <b>일어나지 않게 되었습니다</b>`);
      } else if (x === undefined && y !== undefined) {
        lines.push(`${name}: <b>새로 일어납니다</b> (${fmtT(y)})`);
      }
    }
    return lines;
  }

  function cardHtmlCompare(app, e) {
    if (e.source !== 'life' || app.run === app.base) return '';
    const bt = app.baseFirst[e.id];
    if (bt === undefined) return '<p class="compare">실제 역사에는 없던 일입니다.</p>';
    if (Math.abs(bt - e.t) > 1e-6) return `<p class="compare">실제 역사에서는 ${esc(fmtT(bt))}의 일입니다.</p>`;
    return '';
  }

  function presentText(app) {
    const st = EC.sim.stateAt(app.run, 0);
    if (st.civ) return null;
    const ruler = EC.ui.hud.rulerLabel(st);
    return `이 역사의 지구에는 인류 문명이 없습니다. 지금 지구를 지배하는 것은 <b>${esc(ruler)}</b>입니다. 평균 기온은 ${esc(EC.ui.hud.fmtT(st.T))}, 대기 중 이산화탄소는 ${esc(EC.ui.hud.fmtCO2(st.co2))}입니다.`;
  }

  /* 사건 카드 열기. extra: { conseq: [문장], conseqTitle } */
  function showCard(app, e, extra) {
    const card = $('card');
    card.className = `card k-${e.kind}`;
    $('card-icon').textContent = e.icon || (e.kind === 'intervention' ? EC.data.tools[e.tool].icon : KIND_ICON[e.kind] || '•');
    const pre = e.kind === 'intervention' ? '당신의 개입 · ' : '';
    $('card-title').textContent = pre + e.title + (e.prevented ? ' (막음)' : '');
    const lab = EC.time.labelAt(e.t);
    $('card-time').textContent = `${fmtT(e.t)} · ${[lab.era && lab.era.name, lab.period && lab.period.name].filter(Boolean).join(' · ') || lab.eon.name}`;
    let body = '';
    if (e.id === 'present' && e.source === 'static') {
      const alt = presentText(app);
      body += `<p>${alt || esc(e.text)}</p>`;
    } else if (e.prevented) {
      body += `<p>당신이 이 사건을 막았습니다. 실제 역사에서는 이랬습니다:</p><p>${esc(e.text)}</p>`;
    } else {
      body += `<p>${esc(e.text)}</p>`;
    }
    if (e.kind === 'life' && e.data && e.data.cause) {
      const c = { co2: '이산화탄소가 너무 적어 광합성을 할 수 없습니다.', heat: '지표가 너무 뜨거워졌습니다.', oxygen: '산소가 너무 적습니다.' }[e.data.cause];
      if (c) body += `<p class="compare">원인: ${c}</p>`;
    }
    body += cardHtmlCompare(app, e);
    if (extra && extra.conseq) {
      body += `<div class="conseq"><div class="conseq-title">${esc(extra.conseqTitle || '이렇게 바뀝니다')}</div>`;
      body += extra.conseq.length ? `<ul>${extra.conseq.map((l) => `<li>${l}</li>`).join('')}</ul>` : '<div>지구 전체의 역사에는 큰 변화가 없습니다.</div>';
      body += '</div>';
    }
    $('card-body').innerHTML = body;

    const acts = $('card-actions');
    acts.innerHTML = '';
    const btn = (label, cls, fn) => {
      const b = document.createElement('button');
      b.className = `btn sm ${cls || ''}`;
      b.textContent = label;
      b.addEventListener('click', fn);
      acts.appendChild(b);
    };
    if (e.source === 'catastrophe') {
      if (e.prevented) btn('다시 일어나게 하기', '', () => app.toggleCatastrophe(e.id));
      else btn('🛡️ 이 사건 막기', 'warn', () => app.toggleCatastrophe(e.id));
    }
    if (e.kind === 'intervention' && e.source !== 'undo') btn('이 개입 취소', 'warn', () => app.removeIntervention(e.id));
    if (Math.abs(app.t - e.t) > 1e-7 && e.source !== 'undo') btn('이 시점으로', 'ghost', () => app.jumpToEvent(e));
    if (app.playing === false && e.t >= app.t - 1e-7) btn('▶ 계속', 'primary', () => { hideCard(); app.play(); });
    card.hidden = false;
    app.cardEvent = e;
  }

  function hideCard() {
    $('card').hidden = true;
  }

  function renderHistory(app) {
    const body = $('history-body');
    const ivs = app.interventions;
    const dis = [...app.disabled];
    $('history-count').hidden = ivs.length + dis.length === 0;
    $('history-count').textContent = String(ivs.length + dis.length);
    if (!ivs.length && !dis.length) {
      body.innerHTML = `<p class="hist-empty">아직 실제 역사 그대로입니다.<br>옆의 도구로 소행성을 떨어뜨리거나 온실가스를 바꿔 보세요. 타임라인의 노란 표시(대멸종)를 눌러 막을 수도 있습니다.</p>`;
      return;
    }
    let html = '';
    if (ivs.length) {
      html += '<h4>당신의 개입</h4>';
      for (const iv of ivs) {
        const tool = EC.data.tools[iv.type];
        html += `<div class="hist-item"><span class="hi">${tool.icon}</span><span class="ht">${esc(tool.name)}<small>${esc(fmtT(iv.t))}</small></span>
          <button class="btn sm" data-go="${iv.id}">가기</button><button class="btn sm warn" data-del="${iv.id}">취소</button></div>`;
      }
    }
    if (dis.length) {
      html += '<h4>막은 대멸종</h4>';
      for (const id of dis) {
        const c = EC.data.catastrophes.find((x) => x.id === id);
        html += `<div class="hist-item"><span class="hi">🛡️</span><span class="ht">${esc(c.title)}<small>${esc(fmtT(c.t))}</small></span>
          <button class="btn sm" data-undis="${id}">되돌리기</button></div>`;
      }
    }
    const fa = app.baseFirst;
    const fb = EC.sim.firstTimes(app.run);
    let rows = '';
    for (const id of EC.sim.MILESTONES) {
      const x = fa[id];
      const y = fb[id];
      const same = x !== undefined && y !== undefined && Math.abs(x - y) <= Math.max(0.0005, Math.abs(x) * 0.002);
      if (same || (x === undefined && y === undefined)) continue;
      const yv = y === undefined ? '<td class="gone">일어나지 않음</td>' : `<td class="changed">${esc(fmtT(y))}</td>`;
      rows += `<tr><td>${esc(MILESTONE_NAMES[id])}</td><td>${x === undefined ? '없음' : esc(fmtT(x))}</td>${yv}</tr>`;
    }
    const now = EC.sim.stateAt(app.run, 0);
    const nowBase = EC.sim.stateAt(app.base, 0);
    const rulerYou = EC.ui.hud.rulerLabel(now);
    const rulerBase = EC.ui.hud.rulerLabel(nowBase);
    if (rulerYou !== rulerBase) rows += `<tr><td>현재의 지배 생물</td><td>${esc(rulerBase)}</td><td class="changed">${esc(rulerYou)}</td></tr>`;
    html += '<h4>실제 역사와 비교</h4>';
    html += rows ? `<table class="cmp"><tr><th>이정표</th><th>실제 역사</th><th>당신의 역사</th></tr>${rows}</table>` : '<p class="hist-empty">아직 큰 이정표는 달라지지 않았습니다.</p>';
    html += '<div class="history-actions"><button class="btn sm warn" data-reset="1">실제 역사로 되돌리기</button></div>';
    body.innerHTML = html;
    body.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => app.removeIntervention(b.dataset.del)));
    body.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => {
      const ev = app.events.find((x) => x.id === b.dataset.go);
      if (ev) app.jumpToEvent(ev);
    }));
    body.querySelectorAll('[data-undis]').forEach((b) => b.addEventListener('click', () => app.toggleCatastrophe(b.dataset.undis)));
    body.querySelectorAll('[data-reset]').forEach((b) => b.addEventListener('click', () => app.resetHistory()));
  }

  EC.ui = EC.ui || {};
  EC.ui.panels = { showCard, hideCard, renderHistory, consequences, KIND_ICON, MILESTONE_NAMES };
})();
