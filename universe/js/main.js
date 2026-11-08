'use strict';

/* 시작점: 시뮬레이션 · 그리기 · 화면 조작을 묶습니다 */
(function () {
  const UC = window.UC;
  const U = UC.util;
  const C = UC.cosmo;
  const V = UC.view;
  const GX = UC.galaxy;
  const S = UC.solar;
  const $ = (id) => document.getElementById(id);

  const SAVE_KEY = 'universe-chronicle-v1';
  const SPEEDS = [600, 240, 90, 30]; // 타임라인 전체를 지나는 데 걸리는 초
  const SPEED_NAMES = ['느리게', '보통', '빠르게', '아주 빠르게'];
  const EARTH_FROM = C.T_NOW - 4.54e9;
  const EARTH_TO = C.T_NOW + 7.59e9;

  const app = {
    t: UC.time.TAU_START,
    playing: false,
    speedIdx: 1,
    autoPause: true,
    follow: true,
    interventions: [],
    nextId: 1,
    run: C.BASE,
    scale: UC.time.makeScale(Infinity),
    events: [],
    cardEvent: null,
    scrubbing: false,
    cam: { yaw: 0.9, pitch: 0.42, L: 9.3, vy: 0, vp: 0, fly: null },
    wallT: 0,
    collisionOK: false,
    state: null,
  };

  let renderer = null;
  let timeline = null;
  let labelsCanvas = null;
  let lctx = null;
  let labels = [];
  let hudTimer = 0;
  let hudForce = true;
  let chartMetric = 'size';
  let chartDirty = true;
  let chartTimer = 0;
  let frameAvg = 16;
  let resizePending = true;
  let lastFrame = 0;
  let moodTimer = 0;
  const now = () => performance.now() / 1000;

  /* ---------- 저장 ---------- */
  function save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        t: app.t, interventions: app.interventions, nextId: app.nextId, speedIdx: app.speedIdx,
        autoPause: app.autoPause, follow: app.follow, muted: UC.audio.isMuted(), L: app.cam.L,
      }));
    } catch (e) { /* 저장 공간이 없으면 넘어감 */ }
  }
  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      if (!s || !Number.isFinite(s.t)) return null;
      s.interventions = Array.isArray(s.interventions) ? s.interventions.filter((v) => UC.history.TOOLS[v.type] && Number.isFinite(v.t)) : [];
      return s;
    } catch (e) {
      return null;
    }
  }

  /* ---------- 역사 다시 계산 ---------- */
  function recompute() {
    const h = UC.history.build(app.interventions);
    app.run = h.run;
    app.scale = h.scale;
    app.events = h.events;
    if (timeline) timeline.setEvents(app.events);
    UC.ui.panels.renderHistory(app);
    chartDirty = true;
    hudForce = true;
    if (app.t > app.scale.tEnd) app.t = app.scale.tEnd;
  }

  /* 충돌 계산 준비 (별을 계산 입자에 묶고, 화면 데이터 다시 올리기) */
  function ensureCollision() {
    if (app.collisionOK) return;
    GX.collision; // eslint-disable-line no-unused-expressions
    renderer.refreshGalaxies();
    app.collisionOK = true;
  }

  app.seek = (t) => {
    app.t = U.clamp(t, app.scale.tStart, app.scale.tEnd);
    if (app.t >= GX.SIM.t0) ensureCollision();
    hudForce = true;
  };
  app.beginScrub = () => {
    app.scrubbing = true;
    app.wasPlaying = app.playing;
    app.pause();
  };
  app.endScrub = () => {
    app.scrubbing = false;
    save();
  };
  app.play = () => {
    if (UC.civMode.active) {
      UC.civMode.onPlay();
      app.playing = true;
      $('btn-play').textContent = '❚❚';
      $('btn-play').setAttribute('aria-label', '멈춤');
      UC.audio.init();
      return;
    }
    if (app.t >= app.scale.tEnd - Math.max(1, app.scale.tEnd * 1e-12)) app.seek(app.scale.tStart);
    app.playing = true;
    $('btn-play').textContent = '❚❚';
    $('btn-play').setAttribute('aria-label', '멈춤');
    UC.audio.init();
  };
  app.pause = () => {
    app.playing = false;
    $('btn-play').textContent = '▶';
    $('btn-play').setAttribute('aria-label', '재생');
  };
  function setSpeed(i) {
    app.speedIdx = i;
    $('btn-speed').textContent = SPEED_NAMES[i];
  }

  app.jumpToEvent = (e) => {
    app.pause();
    app.seek(e.t);
    UC.ui.panels.showCard(app, e);
    if (app.follow && e.view) flyTo(e.view);
    save();
  };

  app.earthAvailable = (t) => t >= EARTH_FROM && t <= EARTH_TO;
  app.openEarth = (t) => {
    const myr = (t - C.T_NOW) / 1e6;
    const single = /universe-chronicle\.html$/i.test(location.pathname);
    const url = `${single ? 'earth-chronicle.html' : '../earth/index.html'}?t=${myr.toFixed(myr > -10 && myr < 10 ? 4 : 1)}&from=universe`;
    save();
    location.href = url;
  };

  /* ---------- 개입 ---------- */
  function addIntervention(type) {
    const ok = UC.history.canIntervene(app.t, app.run);
    if (!ok.ok) {
      UC.ui.panels.showInfo(app, { icon: 'ℹ️', title: '여기서는 개입할 수 없어요', text: ok.why });
      return;
    }
    const iv = { id: app.nextId++, t: app.t, type };
    app.interventions = app.interventions.filter((v) => Math.abs(v.t - app.t) > 1e3);
    app.interventions.push(iv);
    recompute();
    const ev = app.events.find((e) => e.iv && e.iv.id === iv.id);
    app.pause();
    if (ev) UC.ui.panels.showCard(app, ev);
    UC.audio.init();
    UC.audio.chime('intervention');
    if (app.follow) flyTo('web');
    save();
  }
  app.removeIntervention = (id) => {
    app.interventions = app.interventions.filter((v) => v.id !== id);
    recompute();
    UC.ui.panels.hideCard();
    save();
  };
  app.resetHistory = () => {
    app.interventions = [];
    recompute();
    UC.ui.panels.hideCard();
    save();
  };

  /* ---------- 카메라 ---------- */
  function flyTo(viewId) {
    const v = V.VIEWS[viewId] || V.LEVELS.find((l) => l.id === viewId);
    if (!v) return;
    app.cam.fly = { L0: app.cam.L, L1: v.L, p0: app.cam.pitch, p1: v.pitch, t: 0, dur: U.clamp(Math.abs(v.L - app.cam.L) * 0.22, 0.6, 2.6) };
  }
  function zoomBy(dL) {
    app.cam.fly = null;
    const R = UC.civMode.active ? UC.civMode.L_RANGE : [V.L_MIN, V.L_MAX];
    app.cam.L = U.clamp(app.cam.L + dL, R[0], R[1]);
  }

  /* ---------- 이름표 ---------- */
  function collectLabels(view) {
    const out = [];
    const L = view.cam.L;
    const add = (pos, text, sub, kind, obj, pri) => {
      const p = renderer.project(pos);
      if (!p) return;
      if (p.x < -40 || p.y < -20 || p.x > window.innerWidth + 40 || p.y > window.innerHeight + 20) return;
      out.push({ x: p.x, y: p.y, text, sub, kind, obj, pri });
    };
    if (UC.civMode.active) {
      return UC.civMode.labels((pos) => renderer.project(pos)).filter((l) => l.x > -40 && l.y > -20 && l.x < window.innerWidth + 40 && l.y < window.innerHeight + 20);
    }
    const tau = view.tau;
    const st = view.st;
    if (st.T > 3000 || (st.ended && app.run.endType === 'rip')) return out;
    const merged = view.merged;
    if (L > 7.15 && view.w.web > 0.3 && tau > 2e8) add(view.galFocus, merged ? '밀코메다 (여기)' : '우리 은하 (여기)', '', 'here', { type: 'mw' }, 3);
    if (L > 5.6 && L < 8.8 && tau > 3e8) {
      add(view.galFocus, merged ? '밀코메다' : '우리 은하', '', 'galaxy', { type: 'mw' }, 4);
      if (!merged && tau < GX.SIM.t0 + 3.2e9) add(view.m31, '안드로메다 은하', U.formatLy(Math.hypot(view.m31[0] - view.galFocus[0], view.m31[1] - view.galFocus[1], view.m31[2] - view.galFocus[2])), 'galaxy', { type: 'm31' }, 4);
    }
    if (view.gal.bh > 0.5 && L > 3 && L < 8) add(view.gal.bhPos, '마지막 블랙홀', '', 'galaxy', { type: 'bh' }, 5);
    const sun = view.solar.sun;
    if (L > 0.9 && L < 5.2 && sun.exists && sun.phase !== 'black') add(view.sunWorld, '태양', L > 3 ? '우리 태양계는 여기' : '', 'sun', { type: 'sun' }, 5);
    if (view.w.local > 0.35) {
      const D = view.cam.D;
      for (const s of localStarsData) {
        if (s.id === 'sun' || s.star.d > D * 3) continue;
        add([0, 1, 2].map((j) => view.sunWorld[j] + s.pos[j]), s.name, '', 'star', { type: 'star', star: s.star }, s.star.L > 100 ? 2 : 1);
      }
    }
    if (view.w.solar > 0.5) {
      if (sun.exists && L < -0.6) add(view.sunWorld, '태양', UC.ui.hud.sunLabel(sun), 'sun', { type: 'sun' }, 6);
      for (const pl of view.solar.planets) {
        if (!pl.st.exists) continue;
        if (pl.p.a > Math.pow(10, L) * 63241 * 4) continue;
        add(pl.world, pl.p.name, pl.p.earth && app.earthAvailable(tau) ? '눌러서 지구로' : '', pl.p.earth ? 'earth' : 'planet', { type: 'planet', p: pl.p }, pl.p.earth ? 7 : 5);
      }
    }
    return out;
  }

  function drawLabels(list) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = window.innerWidth;
    const H = window.innerHeight;
    if (labelsCanvas.width !== Math.round(W * dpr) || labelsCanvas.height !== Math.round(H * dpr)) {
      labelsCanvas.width = Math.round(W * dpr);
      labelsCanvas.height = Math.round(H * dpr);
    }
    const c = lctx;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, W, H);
    list.sort((a, b) => b.pri - a.pri);
    const boxes = [];
    labels = [];
    c.textBaseline = 'middle';
    for (const l of list) {
      c.font = l.kind === 'earth' || l.kind === 'galaxy' || l.kind === 'civ' ? '600 13px system-ui, sans-serif' : '12px system-ui, sans-serif';
      const tw = c.measureText(l.text).width;
      c.font = '10.5px system-ui, sans-serif';
      const sw = l.sub ? c.measureText(l.sub).width : 0;
      const w = Math.max(tw, sw) + 8;
      const h = l.sub ? 30 : 17;
      const bx = l.x + 9;
      const by = l.y - (l.sub ? 15 : 9);
      if (by < 120 || by + h > H - 90) continue;
      if (boxes.some((b) => bx < b.x + b.w && bx + w > b.x && by < b.y + b.h && by + h > b.y)) continue;
      boxes.push({ x: bx, y: by, w, h });
      labels.push(Object.assign({ bx, by, bw: w, bh: h }, l));
      const col = l.color || (l.kind === 'earth' ? '#8be3ad' : l.kind === 'sun' ? '#ffd27a' : l.kind === 'galaxy' || l.kind === 'here' ? '#bcd6ff' : '#e6ecf8');
      c.strokeStyle = col;
      c.globalAlpha = 0.75;
      c.lineWidth = 1.2;
      c.beginPath();
      c.arc(l.x, l.y, l.kind === 'here' ? 9 : 4.5, 0, Math.PI * 2);
      c.stroke();
      c.globalAlpha = 1;
      c.shadowColor = 'rgba(0,0,0,0.9)';
      c.shadowBlur = 5;
      c.fillStyle = col;
      c.font = l.kind === 'earth' || l.kind === 'galaxy' || l.kind === 'civ' ? '600 13px system-ui, sans-serif' : '12px system-ui, sans-serif';
      c.fillText(l.text, bx + 4, l.sub ? l.y - 6 : l.y);
      if (l.sub) {
        c.font = '10.5px system-ui, sans-serif';
        c.fillStyle = 'rgba(220,228,245,0.75)';
        c.fillText(l.sub, bx + 4, l.y + 8);
      }
      c.shadowBlur = 0;
    }
  }

  function pickAt(x, y) {
    let best = null;
    let bd = 26;
    for (const l of labels) {
      const inBox = x >= l.bx - 4 && x <= l.bx + l.bw && y >= l.by - 2 && y <= l.by + l.bh + 2;
      const d = inBox ? 0 : Math.hypot(l.x - x, l.y - y);
      if (d < bd) { bd = d; best = l; }
    }
    if (UC.civMode.active) return UC.civMode.pick(x, y, (pos) => renderer.project(pos), best && best.obj);
    if (best) showObject(best.obj);
    return !!best;
  }

  function showObject(o) {
    const P = UC.ui.panels;
    const t = app.t;
    if (o.type === 'planet') {
      const p = o.p;
      const sun = S.sunAt(t);
      const st = S.planetAt(p, t, sun);
      const extra = p.earth && !app.earthAvailable(t) ? `<p class="compare">${t < EARTH_FROM ? '이 시대에는 아직 지구가 없습니다.' : '지구는 이미 태양에 삼켜졌습니다.'}</p>` : '';
      const actions = [];
      if (p.earth && app.earthAvailable(t)) actions.push({ label: '🌍 지구 연대기에서 이 시대의 지구 보기', cls: 'primary', fn: () => app.openEarth(t) });
      P.showInfo(app, {
        icon: p.earth ? '🌍' : '🪐', title: p.name,
        sub: `태양에서 ${U.formatNumber(st.a, st.a < 10 ? 2 : 1)} AU · 지름 ${U.formatNumber(p.R * 2, 0)} km`,
        html: `<p>${U.escapeHtml(p.info)}</p>${extra}`, actions,
      });
    } else if (o.type === 'sun') {
      const sun = S.sunAt(t);
      const txt = {
        cloud: '가스와 먼지 구름이 스스로의 중력으로 무너지고 있습니다. 가운데가 뜨거워져 곧 태양이 켜집니다.',
        young: '갓 태어난 태양은 지금보다 30% 어두웠지만, 둘레의 원반에서는 행성들이 자라고 있습니다.',
        main: '태양은 중심에서 수소를 헬륨으로 바꾸며 빛납니다. 1억 년마다 약 1%씩 밝아집니다.',
        giant: '중심의 수소를 다 쓴 태양이 부풀어 오르고 있습니다. 표면은 식어 붉어졌지만 전체 밝기는 수천 배가 됩니다.',
        agb: '태양이 바깥층을 우주로 날려 보내고 있습니다.',
        wd: '태양의 남은 핵, 지구만 한 크기의 백색왜성입니다. 더 타지 않고 수조 년에 걸쳐 천천히 식어 갑니다.',
        black: '완전히 식어 빛을 잃은 흑색왜성입니다.',
      }[sun.phase] || '아직 태양이 태어나지 않았습니다. 태양은 약 46억 년 전에 태어납니다.';
      P.showInfo(app, { icon: '☀️', title: '태양', sub: UC.ui.hud.sunLabel(sun), text: txt });
    } else if (o.type === 'star') {
      const s = o.star;
      P.showInfo(app, { icon: s.nebula ? '🌫️' : '⭐', title: s.name, sub: `태양에서 ${U.formatNumber(s.d, s.d < 10 ? 2 : 0)} 광년${s.T ? ` · 표면 ${U.formatNumber(s.T)} K` : ''}`, text: s.info });
    } else if (o.type === 'mw') {
      const merged = t > GX.SIM.t0 + 3.5e9;
      P.showInfo(app, merged
        ? { icon: '🌀', title: '밀코메다', sub: UC.ui.hud.galaxyLabel(t), text: '우리 은하와 안드로메다가 합쳐진 커다란 타원 은하. 나선팔은 사라지고 별들이 공처럼 모여 있습니다. 태양은 바깥쪽으로 밀려났을 가능성이 큽니다.' }
        : { icon: '🌀', title: '우리 은하', sub: UC.ui.hud.galaxyLabel(t), text: '지름 약 10만 광년, 별 1천억~4천억 개의 막대 나선 은하. 태양은 중심에서 약 2만 6천 광년 떨어진 나선팔 사이에서 2억 3천만 년에 한 바퀴씩 돕니다. 중심에는 태양 400만 배 무게의 블랙홀 궁수자리 A*가 있습니다.' });
    } else if (o.type === 'm31') {
      P.showInfo(app, { icon: '🌌', title: '안드로메다 은하', sub: '우리 은하에서 가장 가까운 큰 은하', text: '지름 약 22만 광년, 별 1조 개의 나선 은하. 맨눈으로 볼 수 있는 가장 먼 천체입니다(250만 광년). 초속 110km로 다가오고 있습니다.' });
    } else if (o.type === 'bh') {
      P.showInfo(app, { icon: '🕳️', title: '마지막 블랙홀', sub: UC.time.shortText(t), text: '은하 중심에 있던 초대질량 블랙홀이 우주에 마지막으로 남은 큰 천체입니다. 호킹 복사로 아주아주 천천히 증발해 10¹⁰⁰년쯤 뒤 사라집니다.' });
    }
  }

  /* ---------- 상황 안내 (화면 아래 한 줄) ---------- */
  function viewNote(view) {
    const st = view.st;
    const tau = view.tau;
    const L = view.cam.L;
    if (st.ended) return app.run.endType === 'rip' ? '공간이 찢어져 아무것도 남지 않았습니다' : '모든 것이 한 점으로 무너졌습니다';
    if (tau < 1e-32 / U.YEAR_S) return '모든 것이 원자보다 작은 한 점에 담겨 있습니다';
    if (st.T > 3400) return st.contracting ? '쪼그라든 우주가 다시 뜨거운 불덩이가 되었습니다' : '빛조차 곧게 나아갈 수 없는 뜨거운 플라스마 속입니다';
    if (tau < 3e6 && !st.contracting) return '우주가 투명해지며 마지막 불빛(우주 배경 복사)이 퍼져 나갑니다';
    if (tau < 1.4e8) return '아직 별이 하나도 없는 캄캄한 우주 — 가스가 거미줄처럼 모이고 있습니다';
    if (view.solar.sun.phase === 'cloud' && L < -0.5) return '가스 구름이 무너지며 태양이 태어나려 합니다';
    if (L < -0.6 && !view.solar.sun.exists && tau < S.T_SUN) return '여기엔 아직 태양이 없습니다 — 태양은 약 46억 년 전에 태어납니다';
    if (view.gal.bh > 0.5) return '별도 행성도 없이 블랙홀만 남은 우주';
    if (view.lg > 14.2 && view.lg < 40) return '별이 모두 꺼진 어둠 — 가끔 별의 잔해끼리 부딪혀 번쩍입니다';
    if (view.lg >= 100.2) return '아무것도 일어나지 않는 영원한 어둠';
    if (tau >= GX.SIM.t0 + 0.6e9 && tau < GX.SIM.t0 + 3.6e9 && L > 4 && L < 7.5) return '두 은하의 중력이 서로를 늘이고 휘저어 별들이 꼬리를 그립니다';
    if (L > 7) return '점 하나하나가 은하입니다 — 은하들이 거미줄처럼 이어진 우주 거대 구조';
    if (L > 4) return '빛나는 점 하나가 별 수천 개의 무리입니다';
    if (L > -0.4) return '태양 둘레의 이름난 별들 — 별을 눌러 보세요';
    return '행성을 눌러 보세요 · 지구를 누르면 지구 연대기로 이어집니다';
  }

  /* ---------- 매 프레임 ---------- */
  let localStarsData = [];

  function step(dt) {
    if (!app.playing) return;
    const s0 = app.scale.toS(app.t);
    let slow = 1;
    if (app.t > GX.SIM.t0 + 0.6e9 && app.t < GX.SIM.t0 + 3.8e9) slow = 0.22;
    const s1 = Math.min(1, s0 + (dt / SPEEDS[app.speedIdx]) * slow);
    const t1 = app.scale.fromS(s1);
    if (app.autoPause) {
      for (const e of app.events) {
        if (e.prevented || !e.major) continue;
        if (e.t > app.t && e.t <= t1) {
          app.seek(e.t);
          app.pause();
          UC.ui.panels.showCard(app, e);
          UC.audio.chime(e.kind);
          if (app.follow && e.view) flyTo(e.view);
          save();
          return;
        }
      }
    }
    app.seek(t1);
    if (s1 >= 1) {
      app.pause();
      const last = app.events.filter((e) => !e.prevented && e.major).pop();
      if (last) UC.ui.panels.showCard(app, last);
    }
  }

  function camStep(dt) {
    const c = app.cam;
    if (c.fly) {
      c.fly.t += dt;
      const k = U.smoothstep(0, 1, c.fly.t / c.fly.dur);
      c.L = U.lerp(c.fly.L0, c.fly.L1, k);
      c.pitch = U.lerp(c.fly.p0, c.fly.p1, k);
      if (c.fly.t >= c.fly.dur) c.fly = null;
    }
    if (!dragging) {
      c.yaw += c.vy * dt;
      c.pitch = U.clamp(c.pitch + c.vp * dt, -1.45, 1.45);
      c.vy *= Math.exp(-dt * 3);
      c.vp *= Math.exp(-dt * 3);
      c.yaw += dt * 0.012;
    }
  }

  function updateLevels(view) {
    const L = view.cam.L;
    let best = null;
    let bd = 1e9;
    for (const l of V.LEVELS) {
      const d = Math.abs(l.L - L);
      if (d < bd) { bd = d; best = l.id; }
    }
    document.querySelectorAll('.level[data-level]').forEach((b) => b.classList.toggle('on', b.dataset.level === best && bd < 1.2));
    $('btn-earth').classList.toggle('off', !app.earthAvailable(app.t));
    const width = 2 * view.cam.D * Math.tan(view.cam.fovY / 2);
    $('scale-note').textContent = `보는 폭 ${U.formatLy(width)}`;
  }

  function frame(ts) {
    const tnow = ts / 1000;
    const dt = Math.min(0.1, lastFrame ? tnow - lastFrame : 0.016);
    lastFrame = tnow;
    app.wallT += dt;
    if (resizePending) doResize();
    const civOn = UC.civMode.active;
    if (civOn) UC.civMode.frame(dt);
    else step(dt);
    camStep(dt);

    /* 충돌 계산은 가까워지면 미리 조금씩 */
    const nearCollision = app.t > GX.SIM.t0 - 2.5e9 && app.t < 1e13;
    if (!app.collisionOK && nearCollision) ensureCollision();
    if (app.collisionOK && nearCollision) {
      const col = GX.collision;
      if (col.ckDone < GX.SIM.nCk) col.work();
    }

    const view = V.build(app, { w: window.innerWidth, h: window.innerHeight });
    app.state = view;
    if (civOn) {
      view.civ = UC.civMode.renderData();
      view.gal.mwAlpha *= 0.5;
      view.gal.m31Alpha *= 0.5;
    }
    renderer.render(view);
    drawLabels(collectLabels(view));
    timeline.draw(civOn ? UC.civMode.t : app.t);

    hudTimer -= dt;
    if (civOn && hudTimer <= 0) {
      hudTimer = 0.15;
      UC.civMode.updateHud();
    } else if (!civOn && (hudTimer <= 0 || hudForce)) {
      hudTimer = 0.12;
      hudForce = false;
      const diverged = app.interventions.length > 0 && app.interventions.some((v) => v.t <= app.t);
      const sun = view.solar.sun;
      const base = diverged ? { tau: app.t, st: C.stateAt(C.BASE, app.t), looks: GX.looks(app.t), sun } : null;
      let rate = '';
      if (app.playing) {
        const s = app.scale.toS(app.t);
        const ds = 0.002;
        const yrs = (app.scale.fromS(Math.min(1, s + ds)) - app.scale.fromS(Math.max(0, s - ds))) / (2 * ds) / SPEEDS[app.speedIdx];
        rate = yrs >= 1 ? `1초에 ${U.formatSpan(yrs)}` : '';
      }
      UC.ui.hud.update({ tau: app.t, st: view.st, looks: view.looks, sun }, base, diverged, rate);
      updateLevels(view);
      $('view-note').textContent = viewNote(view);
    }
    if (!$('chart-panel').hidden) {
      chartTimer -= dt;
      if (chartDirty || chartTimer <= 0) {
        UC.ui.chart.draw($('chart'), chartMetric, app.run, app.scale, app.t);
        chartDirty = false;
        chartTimer = 0.4;
      }
    }
    moodTimer -= dt;
    if (moodTimer <= 0) {
      moodTimer = 0.5;
      const st = view.st;
      UC.audio.setMood({
        heat: U.smoothstep(2000, 1e9, st.T) + (st.T > 3000 ? 0.3 : 0),
        stars: U.smoothstep(1.5e8, 2e9, app.t) * view.looks.fade,
        empty: U.smoothstep(12.5, 20, view.lg) + (st.ended ? 1 : 0),
      });
    }

    /* 느린 기기에서는 해상도를 조금 낮춤 */
    frameAvg = frameAvg * 0.95 + dt * 1000 * 0.05;
    if (frameAvg > 34 && renderer.scale > 0.5) { renderer.scale = Math.max(0.5, renderer.scale - 0.1); frameAvg = 24; resizePending = true; }
    else if (frameAvg < 17 && renderer.scale < 1) { renderer.scale = Math.min(1, renderer.scale + 0.05); frameAvg = 20; resizePending = true; }
    requestAnimationFrame(frame);
  }

  function doResize() {
    resizePending = false;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.resize(window.innerWidth, window.innerHeight, dpr);
    timeline.resize();
  }

  /* ---------- 입력 ---------- */
  let dragging = false;
  function bindCanvas() {
    const canvas = $('sky');
    const pointers = new Map();
    let downAt = null;
    let moved = 0;
    let pinch = null;
    canvas.addEventListener('pointerdown', (e) => {
      canvas.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1) {
        downAt = { x: e.clientX, y: e.clientY, t: now() };
        moved = 0;
        dragging = true;
        canvas.classList.add('dragging');
        app.cam.vy = 0;
        app.cam.vp = 0;
      } else if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinch = Math.hypot(a.x - b.x, a.y - b.y);
      }
    });
    canvas.addEventListener('pointermove', (e) => {
      const p = pointers.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x;
      const dy = e.clientY - p.y;
      p.x = e.clientX;
      p.y = e.clientY;
      if (pointers.size === 2 && pinch) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        zoomBy(-Math.log10(d / pinch) * 2.2);
        pinch = d;
        moved += 10;
        return;
      }
      moved += Math.abs(dx) + Math.abs(dy);
      const k = 0.0055;
      app.cam.yaw -= dx * k;
      app.cam.pitch = U.clamp(app.cam.pitch + dy * k, -1.45, 1.45);
      app.cam.vy = (-dx * k) / 0.016 * 0.5;
      app.cam.vp = (dy * k) / 0.016 * 0.5;
    });
    const up = (e) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = null;
      if (pointers.size === 0) {
        dragging = false;
        canvas.classList.remove('dragging');
        if (downAt && moved < 6 && now() - downAt.t < 0.6) {
          app.cam.vy = 0;
          app.cam.vp = 0;
          pickAt(e.clientX, e.clientY);
        }
        downAt = null;
      }
    };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      zoomBy(e.deltaY * 0.0016 * (e.deltaMode === 1 ? 30 : 1));
    }, { passive: false });
  }

  function bindUI() {
    $('btn-play').addEventListener('click', () => (app.playing ? app.pause() : (UC.ui.panels.hideCard(), app.play())));
    $('btn-speed').addEventListener('click', () => { setSpeed((app.speedIdx + 1) % SPEEDS.length); save(); });
    $('btn-sound').addEventListener('click', () => {
      UC.audio.init();
      UC.audio.setMuted(!UC.audio.isMuted());
      $('btn-sound').textContent = UC.audio.isMuted() ? '🔇' : '🔊';
      save();
    });
    $('btn-help').addEventListener('click', () => { $('help').hidden = false; });
    document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => { $(b.dataset.close).hidden = true; }));
    $('card-close').addEventListener('click', () => UC.ui.panels.hideCard());
    const nav = (dir) => {
      if (UC.civMode.active) { UC.civMode.nav(dir); return; }
      const list = app.events.filter((e) => !e.prevented || e.kind === 'intervention');
      const cur = app.cardEvent ? app.cardEvent.t : app.t;
      const e = dir > 0 ? list.find((x) => x.t > cur * (1 + 1e-12) + 1e-60) : list.slice().reverse().find((x) => x.t < cur * (1 - 1e-12));
      if (e) app.jumpToEvent(e);
    };
    $('btn-prev').addEventListener('click', () => nav(-1));
    $('btn-next').addEventListener('click', () => nav(1));
    $('btn-fate').addEventListener('click', () => {
      const m = $('fate-menu');
      m.hidden = !m.hidden;
      $('btn-fate').classList.toggle('on', !m.hidden);
    });
    document.querySelectorAll('#fate-menu [data-tool]').forEach((b) => b.addEventListener('click', () => {
      $('fate-menu').hidden = true;
      $('btn-fate').classList.remove('on');
      addIntervention(b.dataset.tool);
    }));
    $('btn-history').addEventListener('click', () => { $('history-panel').hidden = !$('history-panel').hidden; $('chart-panel').hidden = true; UC.ui.panels.renderHistory(app); });
    $('btn-civ').addEventListener('click', () => UC.civMode.enter({ app, timeline, onExit: () => { timeline.setEvents(app.events); hudForce = true; } }));
    UC.civMode.bind({ app, timeline, onExit: () => { timeline.setEvents(app.events); hudForce = true; } });
    $('btn-chart').addEventListener('click', () => { $('chart-panel').hidden = !$('chart-panel').hidden; $('history-panel').hidden = true; chartDirty = true; });
    document.querySelectorAll('#chart-tabs button').forEach((b) => b.addEventListener('click', () => {
      document.querySelectorAll('#chart-tabs button').forEach((x) => x.classList.toggle('on', x === b));
      chartMetric = b.dataset.metric;
      chartDirty = true;
    }));
    document.querySelectorAll('.level[data-level]').forEach((b) => b.addEventListener('click', () => flyTo(b.dataset.level)));
    $('btn-earth').addEventListener('click', () => {
      if (app.earthAvailable(app.t)) app.openEarth(app.t);
      else UC.ui.panels.showInfo(app, { icon: '🌍', title: '이 시대에는 지구를 볼 수 없어요', text: app.t < EARTH_FROM ? '지구는 약 45억 4천만 년 전에 태어납니다. 타임라인을 "태양계 탄생" 뒤로 옮겨 보세요.' : '지구는 약 76억 년 뒤 부푼 태양에 삼켜집니다.', actions: app.t < EARTH_FROM ? [{ label: '지구 탄생으로', cls: 'primary', fn: () => { const e = app.events.find((x) => x.id === 'earth'); if (e) app.jumpToEvent(e); } }] : [] });
    });
    $('stats-toggle').addEventListener('click', () => {
      const s = $('stats');
      s.classList.toggle('open');
      $('stats-toggle').setAttribute('aria-expanded', String(s.classList.contains('open')));
    });
    $('stats-more').addEventListener('click', () => {
      const s = $('stats');
      s.classList.toggle('expanded');
      $('stats-more').textContent = s.classList.contains('expanded') ? '간단히' : '자세히';
    });
    $('chk-pause').addEventListener('change', (e) => { app.autoPause = e.target.checked; save(); });
    $('chk-follow').addEventListener('change', (e) => { app.follow = e.target.checked; save(); });
    window.addEventListener('keydown', (e) => {
      if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
      if (e.key === ' ') { e.preventDefault(); $('btn-play').click(); }
      else if (e.key === 'ArrowRight') nav(1);
      else if (e.key === 'ArrowLeft') nav(-1);
      else if (e.key === '+' || e.key === '=') setSpeed(Math.min(SPEEDS.length - 1, app.speedIdx + 1));
      else if (e.key === '-') setSpeed(Math.max(0, app.speedIdx - 1));
      else if (e.key === 'Escape') {
        UC.ui.panels.hideCard();
        $('fate-menu').hidden = true;
        $('btn-fate').classList.remove('on');
        $('help').hidden = true;
        $('chart-panel').hidden = true;
        $('history-panel').hidden = true;
        $('civ-list-panel').hidden = true;
        $('civ-log-panel').hidden = true;
      }
    });
    window.addEventListener('resize', () => { resizePending = true; });
    window.addEventListener('pagehide', save);
  }

  function startIntro(saved) {
    if (saved) $('btn-resume').hidden = false;
    const close = () => { $('intro').hidden = true; UC.audio.init(); };
    $('btn-start').addEventListener('click', () => {
      close();
      app.seek(app.scale.tStart);
      app.cam.L = 9.3;
      app.cam.pitch = 0.42;
      const e = app.events[0];
      UC.ui.panels.showCard(app, e);
    });
    $('btn-resume').addEventListener('click', () => { close(); app.play(); });
    $('btn-now').addEventListener('click', () => {
      close();
      app.seek(C.T_NOW);
      flyTo('galaxy');
      const e = app.events.find((x) => x.id === 'now');
      if (e) UC.ui.panels.showCard(app, e);
    });
  }

  function init() {
    try {
      renderer = new UC.Renderer($('sky'));
    } catch (e) {
      $('nogl').hidden = false;
      $('intro').hidden = true;
      if (!/WebGL2/.test(String(e.message))) $('nogl-msg').textContent = `그래픽을 준비하지 못했습니다: ${e.message}`;
      return;
    }
    labelsCanvas = $('labels');
    lctx = labelsCanvas.getContext('2d');
    UC.ui.hud.init();
    timeline = new UC.ui.Timeline($('timeline'), app);

    /* 우주 만들기 */
    renderer.setWeb(UC.web.generate());
    GX.init();
    renderer.setGalaxies(GX.mw, GX.m31);
    localStarsData = V.localStars();
    renderer.setLocalStars(localStarsData);
    renderer.setSolar(S.buildBelts(), V.orbitShapes());

    const saved = load();
    if (saved) {
      app.interventions = saved.interventions;
      app.nextId = Math.max(saved.nextId || 1, ...app.interventions.map((v) => v.id + 1), 1);
      if (Number.isInteger(saved.speedIdx)) app.speedIdx = U.clamp(saved.speedIdx, 0, SPEEDS.length - 1);
      if (typeof saved.autoPause === 'boolean') app.autoPause = saved.autoPause;
      if (typeof saved.follow === 'boolean') app.follow = saved.follow;
      if (saved.muted) { UC.audio.setMuted(true); $('btn-sound').textContent = '🔇'; }
      if (Number.isFinite(saved.L)) app.cam.L = U.clamp(saved.L, V.L_MIN, V.L_MAX);
    }
    $('chk-pause').checked = app.autoPause;
    $('chk-follow').checked = app.follow;
    setSpeed(app.speedIdx);
    recompute();
    app.seek(saved ? saved.t : app.scale.tStart);
    bindUI();
    bindCanvas();
    startIntro(saved);

    if (/[?&]debug\b/.test(location.search)) window.UC_APP = Object.assign(app, { renderer, flyTo, addIntervention, ensureCollision, labelsNow: () => labels, pickAt });
    const m = /[?&]t=(-?[\d.]+)/.exec(location.search);
    if (m) {
      app.seek(C.T_NOW + Number(m[1]) * 1e6);
      $('intro').hidden = true;
      if (/[?&]from=earth\b/.test(location.search)) { app.cam.L = -2.2; flyTo('solar'); }
    }
    requestAnimationFrame(frame);
  }

  init();
})();
