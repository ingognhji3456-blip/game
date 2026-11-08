'use strict';

/* 사건 카드, 천체 설명 카드, 바뀐 역사 패널 */
(function () {
  const UC = (window.UC = window.UC || {});
  const U = UC.util;
  const $ = (id) => document.getElementById(id);
  const esc = U.escapeHtml;

  function addBtn(acts, label, cls, fn) {
    const b = document.createElement('button');
    b.className = `btn sm ${cls || ''}`;
    b.textContent = label;
    b.addEventListener('click', fn);
    acts.appendChild(b);
    return b;
  }

  /* 사건 카드 */
  function showCard(app, e) {
    const card = $('card');
    card.className = `card k-${e.kind === 'end' ? 'extinction' : e.kind}`;
    $('card-icon').textContent = e.icon || '•';
    $('card-title').textContent = e.title + (e.prevented ? ' (일어나지 않음)' : '');
    const lab = UC.time.labelAt(e.t);
    const when = UC.time.shortText(e.t);
    const sub = UC.time.clockSub(e.t);
    $('card-time').textContent = [when, when.includes('빅뱅') ? '' : sub, lab.epoch.name].filter(Boolean).join(' · ');
    let body = '';
    if (e.prevented) body += '<p class="compare">당신의 우주에서는 이 일이 일어나기 전에 우주가 끝납니다. 실제 우주에서는 이렇습니다:</p>';
    body += `<p>${esc(e.text)}</p>`;
    if (e.conseq && e.conseq.length) {
      body += `<div class="conseq"><div class="conseq-title">당신의 개입으로 이렇게 바뀝니다</div><ul>${e.conseq.map((l) => `<li>${l}</li>`).join('')}</ul></div>`;
    }
    $('card-body').innerHTML = body;
    const acts = $('card-actions');
    acts.innerHTML = '';
    if (e.kind === 'intervention') addBtn(acts, '이 개입 취소', 'warn', () => app.removeIntervention(e.iv.id));
    if (e.earth && app.earthAvailable(e.t)) addBtn(acts, '🌍 지구 연대기에서 보기', '', () => app.openEarth(e.t));
    if (Math.abs(app.t - e.t) > Math.max(1e-60, Math.abs(e.t) * 1e-9)) addBtn(acts, '이 시점으로', 'ghost', () => app.jumpToEvent(e));
    const ended = app.state && app.state.st.ended;
    if (!app.playing && !ended && e.t >= app.t * (1 - 1e-12)) addBtn(acts, '▶ 계속', 'primary', () => { hideCard(); app.play(); });
    $('btn-prev').style.visibility = '';
    $('btn-next').style.visibility = '';
    card.hidden = false;
    app.cardEvent = e;
  }

  /* 천체 설명 카드 (눌렀을 때) */
  function showInfo(app, o) {
    const card = $('card');
    card.className = 'card k-info';
    $('card-icon').textContent = o.icon || '•';
    $('card-title').textContent = o.title;
    $('card-time').textContent = o.sub || UC.time.shortText(app.t);
    $('card-body').innerHTML = (o.html || `<p>${esc(o.text)}</p>`);
    const acts = $('card-actions');
    acts.innerHTML = '';
    for (const a of o.actions || []) addBtn(acts, a.label, a.cls, a.fn);
    $('btn-prev').style.visibility = 'hidden';
    $('btn-next').style.visibility = 'hidden';
    card.hidden = false;
    app.cardEvent = null;
  }

  function hideCard() {
    $('card').hidden = true;
  }

  function endText(run) {
    if (run.endType === 'rip') return `빅 립 (빅뱅 후 ${U.formatSpan(run.tEnd)})`;
    if (run.endType === 'crunch') return `빅 크런치 (빅뱅 후 ${U.formatSpan(run.tEnd)})`;
    return '열죽음 (끝없이 팽창)';
  }

  function renderHistory(app) {
    const body = $('history-body');
    const ivs = app.interventions;
    $('history-count').hidden = ivs.length === 0;
    $('history-count').textContent = String(ivs.length);
    if (!ivs.length) {
      body.innerHTML = '<p class="hist-empty">아직 실제 우주 그대로입니다.<br>옆의 🌪️ 🧲 버튼으로 지금 보고 있는 시점의 암흑 에너지를 바꿔 우주의 운명을 갈라 보세요.</p>';
      return;
    }
    let html = '<h4>당신의 개입</h4>';
    for (const iv of ivs) {
      const tool = UC.history.TOOLS[iv.type];
      html += `<div class="hist-item"><span class="hi">${tool.icon}</span><span class="ht">${esc(tool.name)} · ${esc(tool.label)}<small>${esc(UC.time.shortText(iv.t))}</small></span>
        <button class="btn sm" data-go="${iv.id}">가기</button><button class="btn sm warn" data-del="${iv.id}">취소</button></div>`;
    }
    const lost = app.events.filter((e) => e.prevented && e.major && e.kind !== 'intervention');
    html += '<h4>실제 우주와 비교</h4><table class="cmp"><tr><th></th><th>실제 우주</th><th>당신의 우주</th></tr>';
    html += `<tr><td>우주의 끝</td><td>${esc(endText(UC.cosmo.BASE))}</td><td class="changed">${esc(endText(app.run))}</td></tr>`;
    const nowS = UC.cosmo.stateAt(app.run, app.t);
    const nowB = UC.cosmo.stateAt(UC.cosmo.BASE, app.t);
    if (Math.abs(nowS.log10a - nowB.log10a) > 0.01) html += `<tr><td>지금 우주의 크기</td><td>${esc(UC.ui.hud.fmtSize(nowB))}</td><td class="changed">${esc(UC.ui.hud.fmtSize(nowS))}</td></tr>`;
    html += '</table>';
    if (lost.length) html += `<p class="hist-empty" style="margin-top:10px">일어나지 않게 된 일: ${lost.map((e) => esc(e.title)).join(', ')}</p>`;
    html += '<div class="history-actions"><button class="btn sm warn" data-reset="1">실제 우주로 되돌리기</button></div>';
    body.innerHTML = html;
    body.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => app.removeIntervention(+b.dataset.del)));
    body.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => {
      const ev = app.events.find((x) => x.iv && String(x.iv.id) === b.dataset.go);
      if (ev) app.jumpToEvent(ev);
    }));
    body.querySelectorAll('[data-reset]').forEach((b) => b.addEventListener('click', () => app.resetHistory()));
  }

  UC.ui = UC.ui || {};
  UC.ui.panels = { showCard, showInfo, hideCard, renderHistory, endText };
})();
