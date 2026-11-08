'use strict';

/*
 * 은하 문명 모드: 지금 보고 있는 시대의 우리 은하에서 4천만 년 동안 문명들이 퍼지고 다투는 모습을 봅니다.
 * 별이나 문명을 눌러 알아보고, 씨앗 뿌리기 · 기술 선물 · 평화 · 전쟁 · 초신성으로 개입합니다.
 * 타임라인·재생·시계·상태 패널이 이 모드의 시간(시작부터 흐른 햇수)으로 바뀝니다.
 */
(function () {
  const UC = (window.UC = window.UC || {});
  const U = UC.util;
  const CV = UC.civ;
  const $ = (id) => document.getElementById(id);
  const esc = U.escapeHtml;

  const SPEEDS_Y = [30000, 120000, 400000, 1200000]; // 1초에 흐르는 햇수 (보통: 4천만 년을 약 5분 30초에)
  const L_RANGE = [2.6, 6.2];

  Object.assign(UC.data.KIND_COLOR, { cborn: '#7ee0a1', cwar: '#ff6b5c', cpeace: '#7cc4ff', cdeath: '#9aa3b8', ctrans: '#ffd27a', cnova: '#e8f0ff' });
  const KIND_OF = { born: 'cborn', contact: 'cpeace', war: 'cwar', peace: 'cpeace', split: 'cwar', homefall: 'cwar', extinct: 'cdeath', selfdestroy: 'cdeath', transcend: 'ctrans', supernova: 'cnova', gift: 'intervention', calm: 'intervention', rage: 'intervention', dominant: 'ctrans' };

  const M = {
    active: false,
    h: null,
    t: 0,
    tau0: 0,
    ivs: [],
    nextId: 1,
    follow: null,
    events: [],
    deps: null,
    focus: null,
    savedL: null,
  };

  const fmtY = (y) => (y < 1e4 ? `${U.formatNumber(Math.round(y / 100) * 100)}년` : `${U.formatYears(y)} 년`);
  const civName = (id) => (id >= 0 && M.h.civs[id] ? M.h.civs[id].name : '');
  const colorCss = (c, a) => `rgba(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)},${a === undefined ? 1 : a})`;
  const lin = (c) => c.map((x) => Math.pow(x, 2.2));

  /* 타임라인이 이 모드에서 쓰는 값들 */
  const adapter = {
    scale: { toS: (t) => t / CV.DURATION, fromS: (s) => s * CV.DURATION, tStart: 0, tEnd: CV.DURATION },
    ages: [
      { name: '초기', from: 0, to: 10e6, color: '#7cc4ff' },
      { name: '중기', from: 10e6, to: 25e6, color: '#b39dff' },
      { name: '후기', from: 25e6, to: Infinity, color: '#ff9b7a' },
    ],
    ticks: [[0, '시작'], [5e6, '500만'], [10e6, '1천만'], [20e6, '2천만'], [30e6, '3천만'], [40e6, '4천만 년']],
    shortText: (t) => `${fmtY(t)}째`,
    clockText: (t) => `${fmtY(t)}째`,
    seek: (t) => { M.t = U.clamp(t, 0, CV.DURATION); },
    beginScrub: () => M.deps.app.pause(),
    endScrub: () => {},
    jumpToEvent: (e) => jumpTo(e),
  };

  function available(app) {
    const t = app.t;
    if (app.state && app.state.st.ended) return { ok: false, why: '우주가 이미 끝났어요.' };
    if (t < 6e9) return { ok: false, why: '이 시대의 우리 은하는 아직 자라는 중이고 무거운 원소도 모자라 문명이 생기기 어려워요. 빅뱅 후 60억 년(약 78억 년 전) 이후로 옮겨 보세요.' };
    if (t >= UC.galaxy.SIM.t0 - 1e8) return { ok: false, why: '이 시대에는 안드로메다와의 충돌이 가까워 은하가 크게 흔들립니다. 지금부터 29억 년 뒤까지의 우리 은하에서 볼 수 있어요.' };
    return { ok: true };
  }

  function recompute() {
    const t0 = performance.now();
    M.h = CV.simulate({ tau0: M.tau0, humans: M.humans, interventions: M.ivs });
    M.calcMs = performance.now() - t0;
    M.events = M.h.events
      .filter((e) => e.major || ['war', 'peace', 'born', 'extinct', 'transcend', 'split', 'supernova'].includes(e.type))
      .map((e) => ({ t: e.t, kind: e.iv ? 'intervention' : KIND_OF[e.type] || 'cpeace', icon: CV.EVENT_ICON[e.type], title: `${titleOf(e)}${e.civ >= 0 && !e.iv ? ` · ${civName(e.civ)}` : ''}`, text: CV.eventText(M.h, e), major: !!e.major, ev: e }));
    M.deps.timeline.setEvents(M.events);
    renderList(true);
    renderLog();
  }

  function enter(deps) {
    M.deps = deps;
    const app = deps.app;
    const ok = available(app);
    if (!ok.ok) {
      UC.ui.panels.showInfo(app, { icon: '👽', title: '여기서는 은하 문명을 볼 수 없어요', text: ok.why });
      return false;
    }
    app.pause();
    M.active = true;
    M.tau0 = app.t;
    M.humans = Math.abs(app.t - UC.cosmo.T_NOW) < 2e7;
    M.ivs = [];
    M.t = 0;
    M.follow = null;
    M.focus = null;
    M.savedL = app.cam.L;
    recompute();
    document.body.classList.add('civ');
    deps.timeline.app = adapter;
    deps.timeline.dirty = true;
    app.cam.fly = { L0: app.cam.L, L1: 5.0, p0: app.cam.pitch, p1: 1.05, t: 0, dur: 1.4 };
    $('stats-body').innerHTML = '';
    UC.ui.panels.hideCard();
    ['history-panel', 'chart-panel', 'fate-menu'].forEach((id) => { $(id).hidden = true; });
    const humanText = M.humans
      ? '지금의 은하에서 시작하므로 <b>인류</b>(하늘색)도 지구에서 막 우주로 나서고 있습니다.'
      : '이 시대의 지구에는 아직 문명이 없습니다. 태양계를 눌러 지구에 문명의 씨앗을 뿌려 볼 수도 있어요.';
    UC.ui.panels.showInfo(app, {
      icon: '👽', title: '은하 문명',
      sub: `${UC.time.shortText(M.tau0)}의 우리 은하에서 4천만 년`,
      html: `<p>생명이 살 만한 별 ${M.h.systems.length}개에서 문명이 태어나 이주선을 보내고, 이웃을 만나 전쟁하거나 평화롭게 지내고, 갈라지고, 멸망하거나 초월합니다. 색이 칠해진 곳이 각 문명의 영역입니다.</p><p>${humanText}</p><p class="compare">외계 문명은 아직 하나도 발견되지 않았습니다. "만약 은하에 문명이 많다면?"을 상상해 보는 놀이입니다.</p>`,
      actions: [{ label: '▶ 시작', cls: 'primary', fn: () => { UC.ui.panels.hideCard(); app.play(); } }],
    });
    return true;
  }

  function exit() {
    const app = M.deps.app;
    M.active = false;
    app.pause();
    document.body.classList.remove('civ');
    M.deps.timeline.app = app;
    M.deps.timeline.setEvents(app.events);
    app.focusOverride = null;
    ['civ-list-panel', 'civ-log-panel'].forEach((id) => { $(id).hidden = true; });
    UC.ui.panels.hideCard();
    UC.ui.hud.init();
    M.deps.onExit();
    app.cam.fly = { L0: app.cam.L, L1: 5.05, p0: app.cam.pitch, p1: 0.62, t: 0, dur: 1.2 };
  }

  /* ---------- 시간 ---------- */
  function frame(dt) {
    const app = M.deps.app;
    if (app.playing) {
      const t0 = M.t;
      const t1 = Math.min(CV.DURATION, t0 + dt * SPEEDS_Y[app.speedIdx]);
      if (app.autoPause) {
        const e = M.events.find((x) => x.major && x.t > t0 && x.t <= t1);
        if (e) {
          M.t = e.t;
          app.pause();
          showEvent(e);
          UC.audio.chime(e.kind === 'cwar' ? 'end' : e.kind === 'cborn' ? 'earth' : 'galaxy');
          if (app.follow && e.ev.sys !== undefined) M.focus = M.h.systems[e.ev.sys].pos.slice();
          return;
        }
      }
      M.t = t1;
      if (t1 >= CV.DURATION) app.pause();
    }
    /* 카메라: 따라가는 문명의 중심, 아니면 사건 자리, 아니면 은하 중심 */
    let target = [0, 0, 0];
    if (M.follow !== null) {
      const c = centroid(M.follow);
      if (c) target = c;
      else M.follow = null;
    } else if (M.focus) target = M.focus;
    const cur = app.focusOverride || [0, 0, 0];
    const k = 1 - Math.exp(-dt * 3);
    app.focusOverride = cur.map((v, j) => v + (target[j] - v) * k);
    app.cam.L = U.clamp(app.cam.L, L_RANGE[0], L_RANGE[1]);
  }

  function centroid(id) {
    const own = CV.ownerAt(M.h, M.t);
    let x = 0, y = 0, z = 0, n = 0;
    for (let k = 0; k < own.length; k++) {
      if (own[k] !== id) continue;
      const p = M.h.systems[k].pos;
      x += p[0]; y += p[1]; z += p[2]; n++;
    }
    return n ? [x / n, y / n, z / n] : null;
  }
  function capitalOf(id) {
    const c = M.h.civs[id];
    const own = CV.ownerAt(M.h, M.t);
    if (own[c.home] === id) return c.home;
    const cen = centroid(id);
    if (!cen) return -1;
    let best = -1;
    let bd = Infinity;
    for (let k = 0; k < own.length; k++) {
      if (own[k] !== id) continue;
      const p = M.h.systems[k].pos;
      const d = Math.hypot(p[0] - cen[0], p[2] - cen[2]);
      if (d < bd) { bd = d; best = k; }
    }
    return best;
  }

  /* ---------- 그릴 것 ---------- */
  function renderData() {
    const h = M.h;
    const t = M.t;
    const own = CV.ownerAt(h, t);
    const S = h.systems;
    const halo = [];
    const dots = [];
    const flash = [];
    const lines = [];
    const caps = new Set(h.civs.map((c) => (own[c.home] === c.id ? c.home : -1)));
    for (let k = 0; k < S.length; k++) {
      const p = S[k].pos;
      const o = own[k];
      if (o >= 0) {
        const col = lin(h.civs[o].color);
        halo.push(p[0], p[1], p[2], col[0], col[1], col[2], caps.has(k) ? 0.3 : 0.2, 2000, 2.5);
        dots.push(p[0], p[1], p[2], col[0], col[1], col[2], caps.has(k) ? 4 : 2.2, 120, caps.has(k) ? 3.2 : 2.2);
      } else {
        const bb = U.blackbody(S[k].T).map((x) => Math.pow(x, 2.2));
        dots.push(p[0], p[1], p[2], bb[0], bb[1], bb[2], k === 0 ? 1.6 : 0.55, 80, k === 0 ? 2.4 : 1.4);
      }
    }
    for (const sh of CV.shipsAt(h, t)) {
      const c = lin(h.civs[sh.civ].color);
      const a = S[sh.from].pos;
      const b = S[sh.to].pos;
      const f = (t - sh.t0) / (sh.t1 - sh.t0);
      const q = [0, 1, 2].map((j) => a[j] + (b[j] - a[j]) * f);
      lines.push(a[0], a[1], a[2], c[0], c[1], c[2], 0.05, q[0], q[1], q[2], c[0], c[1], c[2], 0.7);
      dots.push(q[0], q[1], q[2], c[0] * 0.6 + 0.4, c[1] * 0.6 + 0.4, c[2] * 0.6 + 0.4, 3.5, 50, 1.8);
    }
    const W = 1.6e5;
    for (const b of CV.battlesAt(h, t, W)) {
      const age = (t - b.t) / W;
      const p = S[b.sys].pos;
      flash.push(p[0], p[1], p[2], 1, 0.5, 0.2, 3.5 * (1 - age), 500 + 900 * age, 5);
    }
    for (const e of h.events) {
      if (e.type !== 'supernova' || e.t > t || e.t < t - 6e5) continue;
      const age = (t - e.t) / 6e5;
      const p = S[e.sys].pos;
      flash.push(p[0], p[1], p[2], 0.7, 0.85, 1, 4 * (1 - age), e.R * (0.3 + 1.2 * age), 8);
    }
    return { halo: Float32Array.from(halo), dots: Float32Array.from(dots), flash: Float32Array.from(flash), lines: Float32Array.from(lines) };
  }

  function labels(project) {
    const h = M.h;
    const cnt = CV.countAt(h, M.t);
    const out = [];
    const top = [...cnt.entries()].sort((a, b) => b[1] - a[1]).slice(0, 9);
    for (const [id, n] of top) {
      const s = capitalOf(id);
      if (s < 0) continue;
      const p = project(h.systems[s].pos);
      if (!p) continue;
      const c = h.civs[id];
      out.push({ x: p.x, y: p.y, text: `${c.species.icon} ${c.name}`, sub: `별 ${n}개 · ${CV.statusAt(h, id, M.t)}`, kind: c.human ? 'earth' : 'civ', color: colorCss(c.color), obj: { type: 'civ', id }, pri: c.human ? 9 : 4 + n / 100 });
    }
    if (!cnt.has(h.civs.findIndex((c) => c.human))) {
      const p = project(h.systems[0].pos);
      if (p) out.push({ x: p.x, y: p.y, text: '태양계', sub: M.humans ? '' : '아직 문명 없음', kind: 'sun', obj: { type: 'sys', id: 0 }, pri: 3 });
    }
    return out;
  }

  /* ---------- 누르기 ---------- */
  function pick(x, y, project, labelHit) {
    if (labelHit) {
      if (labelHit.type === 'civ') showCiv(labelHit.id);
      else showSystem(labelHit.id);
      return true;
    }
    let best = -1;
    let bd = 22;
    M.h.systems.forEach((s, k) => {
      const p = project(s.pos);
      if (!p) return;
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < bd) { bd = d; best = k; }
    });
    if (best >= 0) { showSystem(best); return true; }
    return false;
  }

  function sysLine(k) {
    const s = M.h.systems[k];
    return `${s.name} · ${s.star}형 별`;
  }

  function showSystem(k) {
    const o = CV.ownerAt(M.h, M.t)[k];
    if (o >= 0) { showCiv(o, k); return; }
    const s = M.h.systems[k];
    const app = M.deps.app;
    const wasOwned = M.h.civs.find((c) => c.home === k && c.born <= M.t);
    const txt = k === 0
      ? (M.humans ? '인류의 고향, 태양계입니다.' : '아직 문명이 없는 태양계. 세 번째 행성에는 생명이 가득합니다.')
      : wasOwned ? `한때 ${wasOwned.name}의 고향이었던 별. 지금은 빈 도시의 폐허만 남아 있습니다.`
        : '아직 아무도 살지 않는 별입니다. 행성 가운데 하나는 생명이 살 수 있을지도 모릅니다.';
    UC.ui.panels.showInfo(app, {
      icon: '⭐', title: s.name + (k === 0 ? ' (지구)' : ''), sub: `${s.star}형 별 · 은하 중심에서 ${U.formatNumber(Math.round(Math.hypot(s.pos[0], s.pos[2]) / 100) * 100)} 광년`,
      text: txt,
      actions: [
        { label: '🌱 여기에 문명 탄생시키기', cls: 'primary', fn: () => addIv('seed', { sys: k }) },
        { label: '💥 초신성 일으키기', cls: 'warn', fn: () => addIv('supernova', { sys: k }) },
      ],
    });
  }

  function showCiv(id, k) {
    const h = M.h;
    const c = h.civs[id];
    const app = M.deps.app;
    const t = M.t;
    const status = CV.statusAt(h, id, t);
    const tech = CV.techAt(h, id, t);
    const st = CV.stageOf(tech);
    const n = CV.countAt(h, t).get(id) || 0;
    const rel = CV.relationsAt(h, id, t);
    const age = t - c.born;
    const alive = status !== '멸망함' && status !== '초월함' && status !== '아직 없음';
    let html = `<p><b>${esc(c.species.icon)} ${esc(c.species.name)}</b> · ${esc(c.species.text)}</p>`;
    html += '<div class="conseq"><ul>';
    html += `<li>상태: <b>${esc(status)}</b>${alive ? ` · 다스리는 별 <b>${n}개</b>` : ''}</li>`;
    if (alive) html += `<li>기술: <b>${esc(st.name)}</b> (${esc(st.k)}) — ${esc(st.text)}</li>`;
    html += `<li>${c.born > 0 ? `${fmtY(c.born)}째에 ${esc(h.systems[c.home].name)}에서 태어남` : `처음부터 있던 문명 · 고향 ${esc(h.systems[c.home].name)}`}${alive && c.born > 0 ? ` (${fmtY(age)} 전)` : ''}</li>`;
    if (c.parent !== null) html += `<li>${esc(civName(c.parent))}에서 갈라져 나옴</li>`;
    if (rel.war.length) html += `<li>전쟁 중: ${rel.war.map((o) => `<b style="color:${colorCss(h.civs[o].color)}">${esc(civName(o))}</b>`).join(', ')}</li>`;
    if (rel.peace.length) html += `<li>평화: ${rel.peace.slice(0, 6).map((o) => esc(civName(o))).join(', ')}${rel.peace.length > 6 ? ` 외 ${rel.peace.length - 6}` : ''}</li>`;
    html += `<li>성격: ${c.agg > 0.66 ? '호전적' : c.agg < 0.3 ? '평화로움' : '신중함'}</li>`;
    html += '</ul></div>';
    if (c.end !== null && t >= c.end) html += `<p class="compare">${esc(CV.eventText(h, h.events.find((e) => e.civ === id && (e.type === 'extinct' || e.type === 'transcend' || e.type === 'selfdestroy')) || { type: '' }))}</p>`;
    const actions = [];
    if (alive) {
      actions.push({ label: '💡 기술 선물', cls: '', fn: () => addIv('gift', { civ: id }) });
      actions.push({ label: '🕊️ 평화롭게', cls: '', fn: () => addIv('peace', { civ: id }) });
      actions.push({ label: '⚔️ 호전적으로', cls: 'warn', fn: () => addIv('war', { civ: id }) });
      actions.push({ label: M.follow === id ? '따라가기 그만' : '🔭 따라가기', cls: 'ghost', fn: () => { M.follow = M.follow === id ? null : id; M.focus = null; showCiv(id, k); } });
    }
    if (k !== undefined) actions.push({ label: '💥 이 별에 초신성', cls: 'ghost', fn: () => addIv('supernova', { sys: k }) });
    UC.ui.panels.showInfo(app, {
      icon: c.species.icon, title: c.name, sub: k !== undefined ? sysLine(k) : `${fmtY(t)}째`,
      html, actions,
    });
    $('card-title').innerHTML = `<span style="color:${colorCss(c.color)}">●</span> ${esc(c.name)}`;
  }

  function showEvent(e) {
    const app = M.deps.app;
    const ev = e.ev;
    const actions = [];
    if (ev.civ >= 0 && M.h.civs[ev.civ]) actions.push({ label: `${M.h.civs[ev.civ].species.icon} ${M.h.civs[ev.civ].name} 보기`, cls: '', fn: () => showCiv(ev.civ) });
    if (ev.iv) actions.push({ label: '이 개입 취소', cls: 'warn', fn: () => { M.ivs = M.ivs.filter((v) => v.id !== ev.iv); recompute(); UC.ui.panels.hideCard(); } });
    if (!app.playing && M.t < CV.DURATION) actions.push({ label: '▶ 계속', cls: 'primary', fn: () => { UC.ui.panels.hideCard(); app.play(); } });
    UC.ui.panels.showInfo(app, { icon: e.icon || '•', title: titleOf(ev), sub: `${fmtY(ev.t)}째`, text: e.text, actions });
  }
  function titleOf(ev) {
    return { born: '새 문명', contact: '첫 만남', war: '전쟁', peace: '평화 조약', split: '내전', homefall: '고향 함락', extinct: '멸망', selfdestroy: '자멸', transcend: '초월', supernova: '초신성', gift: '당신의 개입 · 기술 선물', calm: '당신의 개입 · 평화', rage: '당신의 개입 · 전쟁', dominant: '은하의 패자' }[ev.type] || '사건';
  }

  function jumpTo(e) {
    M.deps.app.pause();
    M.t = e.t;
    if (e.ev.sys !== undefined) M.focus = M.h.systems[e.ev.sys].pos.slice();
    showEvent(e);
  }

  function nav(dir) {
    const list = M.events;
    const e = dir > 0 ? list.find((x) => x.t > M.t + 1) : list.slice().reverse().find((x) => x.t < M.t - 1);
    if (e) jumpTo(e);
  }

  /* ---------- 개입 ---------- */
  function addIv(type, target) {
    const iv = Object.assign({ id: M.nextId++, t: Math.round(M.t / CV.DT) * CV.DT, type }, target);
    M.ivs.push(iv);
    recompute();
    UC.audio.init();
    UC.audio.chime('intervention');
    const e = M.events.find((x) => x.ev.iv === iv.id) || M.events.find((x) => x.ev.type === 'supernova' && x.t === iv.t && !x.ev.natural);
    if (e) showEvent(e);
    else UC.ui.panels.showInfo(M.deps.app, { icon: 'ℹ️', title: '아무 일도 일어나지 않았어요', text: '이미 다른 문명이 살고 있거나, 그 문명이 이 순간에는 없습니다.' });
  }

  /* ---------- 상태 패널 · 목록 · 기록 ---------- */
  let hudKey = '';
  function updateHud() {
    const h = M.h;
    const t = M.t;
    $('clock-time').textContent = `${fmtY(t)}째`;
    const key = `${M.tau0}`;
    if (key !== hudKey) {
      hudKey = key;
      $('clock-era').innerHTML = `<span class="chip" style="background:#7ee0a1"></span>👽 은하 문명 · ${esc(UC.time.shortText(M.tau0))}의 우리 은하`;
    }
    const cnt = CV.countAt(h, t);
    let wars = 0;
    for (const id of cnt.keys()) wars += CV.relationsAt(h, id, t).war.filter((o) => o > id).length;
    const top = [...cnt.entries()].sort((a, b) => b[1] - a[1])[0];
    const owned = [...cnt.values()].reduce((a, b) => a + b, 0);
    const hi = h.civs.findIndex((c) => c.human);
    const rows = [
      ['살아 있는 문명', `${cnt.size}개`],
      ['진행 중인 전쟁', `${wars}건`],
      ['가장 큰 문명', top ? `${h.civs[top[0]].name} (${top[1]})` : '—'],
      ['은하 점유', `${Math.round((owned / h.systems.length) * 100)}%`],
    ];
    if (hi >= 0) rows.push(['인류', `${CV.statusAt(h, hi, t)}${cnt.get(hi) ? ` · 별 ${cnt.get(hi)}개` : ''}`]);
    $('stats-body').innerHTML = rows.map(([a, b]) => `<div class="stat"><span class="sl">${a}</span><span class="stat-v"><span class="sv">${esc(b)}</span></span></div>`).join('');
    $('stats-toggle').textContent = `👽 문명 ${cnt.size} · 전쟁 ${wars}`;
    $('view-note').textContent = '색이 칠해진 곳이 문명의 영역 · 선은 이주선 · 주황 섬광은 전투 · 별이나 문명을 눌러 보세요';
    if (!$('civ-list-panel').hidden) renderList();
    if (!$('civ-log-panel').hidden && M.logT !== Math.floor(M.t / 2e5)) { M.logT = Math.floor(M.t / 2e5); renderLog(); }
  }

  let listSig = '';
  let listAt = 0;
  function renderList(force) {
    if (!M.h || $('civ-list-panel').hidden) return;
    const now = performance.now();
    if (!force && now - listAt < 1000) return;
    const h = M.h;
    const t = M.t;
    const cnt = CV.countAt(h, t);
    const rows = h.civs.filter((c) => c.born <= t).map((c) => ({ c, n: cnt.get(c.id) || 0, st: CV.statusAt(h, c.id, t) }));
    rows.sort((a, b) => b.n - a.n || a.c.id - b.c.id);
    const sig = rows.map((r) => `${r.c.id}:${r.n}:${r.st}`).join('|') + h.civs.length;
    if (!force && sig === listSig) return;
    listSig = sig;
    listAt = now;
    const max = Math.max(1, ...rows.map((r) => r.n));
    $('civ-list-body').innerHTML = rows.map((r) => `<button class="civ-row${r.n ? '' : ' dead'}" data-civ="${r.c.id}">
      <span class="cdot" style="background:${colorCss(r.c.color)}"></span><span class="cicon">${r.c.species.icon}</span>
      <span class="cname">${esc(r.c.name)}<small>${esc(r.st)}${r.n ? ` · 별 ${r.n}` : ''}</small></span>
      <span class="cbar"><i style="width:${Math.round((r.n / max) * 100)}%;background:${colorCss(r.c.color)}"></i></span></button>`).join('') || '<p class="hist-empty">아직 문명이 없습니다.</p>';
    $('civ-list-body').querySelectorAll('[data-civ]').forEach((b) => b.addEventListener('click', () => {
      const id = +b.dataset.civ;
      M.follow = CV.countAt(M.h, M.t).get(id) ? id : null;
      showCiv(id);
    }));
  }

  function renderLog() {
    if (!M.h) return;
    const list = M.events.filter((e) => e.t <= M.t).slice(-60).reverse();
    $('civ-log-body').innerHTML = list.map((e, i) => `<button class="hist-item log-row" data-i="${M.events.indexOf(e)}"><span class="hi">${e.icon}</span><span class="ht">${esc(e.text)}<small>${fmtY(e.t)}째</small></span></button>`).join('') || '<p class="hist-empty">아직 기록된 사건이 없습니다. ▶ 를 눌러 시간을 흘려 보세요.</p>';
    $('civ-log-body').querySelectorAll('[data-i]').forEach((b) => b.addEventListener('click', () => jumpTo(M.events[+b.dataset.i])));
  }

  function bind(deps) {
    M.deps = deps;
    $('btn-civ-exit').addEventListener('click', exit);
    $('btn-civ-list').addEventListener('click', () => { $('civ-list-panel').hidden = !$('civ-list-panel').hidden; $('civ-log-panel').hidden = true; renderList(true); });
    $('btn-civ-log').addEventListener('click', () => { $('civ-log-panel').hidden = !$('civ-log-panel').hidden; $('civ-list-panel').hidden = true; renderLog(); });
  }

  function onPlay() {
    if (M.t >= CV.DURATION - 1) M.t = 0;
  }

  UC.civMode = {
    get active() { return M.active; },
    get t() { return M.t; },
    get h() { return M.h; },
    available, enter, exit, frame, renderData, labels, pick, nav, updateHud, bind, onPlay, adapter, renderLog, L_RANGE,
    showCiv, showSystem, addIv, M,
  };
})();
