'use strict';

/* 시작점: 시뮬레이션·지구 그리기·화면 조작을 묶습니다 */
(function () {
  const EC = window.EC;
  const U = EC.util;
  const D = EC.data;
  const Q = EC.q;
  const $ = (id) => document.getElementById(id);

  const SAVE_KEY = 'earth-chronicle-v1';
  const SPEEDS = [600, 240, 90, 30]; // 타임라인 전체를 지나는 데 걸리는 초
  const DIST_MIN = 1.3;
  const DIST_MAX = 16;

  const app = {
    t: D.T_START,
    playing: false,
    speedIdx: 1,
    autoPause: true,
    interventions: [],
    disabled: new Set(),
    base: null,
    run: null,
    events: [],
    baseFirst: {},
    tool: null,
    cardEvent: null,
    scrubbing: false,
    crossIndex: 0,
  };

  let globe = null;
  let fx = null;
  let timeline = null;
  let canvas = null;
  let chartMetric = 'T';
  let chartDirty = true;
  let chartTimer = 0;
  let hudTimer = 0;
  let hudForce = true;
  let lastFrame = 0;
  let moonAngle = 1.9;
  let lhbTimer = 0;
  let pickHover = null;
  let focus = null;
  let frameAvg = 16;
  let resizePending = true;
  const cam = { yaw: 0.55, pitch: 0.28, dist: 3.4, vy: 0, vp: 0 };
  const now = () => performance.now() / 1000;
  
  /* ---------------- 저장 ---------------- */

  function save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        v: 1, t: app.t, interventions: app.interventions, disabled: [...app.disabled],
        speedIdx: app.speedIdx, autoPause: app.autoPause, muted: EC.audio.isMuted(),
      }));
    } catch (e) { /* 저장 공간을 못 쓰는 환경 */ }
  }

  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      if (!s || s.v !== 1) return null;
      s.interventions = (s.interventions || []).filter((iv) => iv && D.tools[iv.type] && Number.isFinite(iv.t) && iv.t >= D.T_START && iv.t <= D.T_END
        && (iv.dir === null || (Array.isArray(iv.dir) && iv.dir.length === 3 && iv.dir.every(Number.isFinite))));
      s.disabled = (s.disabled || []).filter((id) => D.catastrophes.some((c) => c.id === id));
      return s;
    } catch (e) {
      return null;
    }
  }

  /* ---------------- 시뮬레이션 ---------------- */

  function diverged() {
    return app.run !== app.base;
  }

  function resetCrossIndex() {
    let i = 0;
    while (i < app.events.length && app.events[i].t <= app.t + 1e-9) i++;
    app.crossIndex = i;
  }

  function recompute() {
    app.run = app.interventions.length || app.disabled.size ? EC.sim.run(app.interventions, app.disabled) : app.base;
    app.events = EC.sim.timeline(app.run);
    timeline.setEvents(app.events);
    resetCrossIndex();
    EC.ui.panels.renderHistory(app);
    chartDirty = true;
    hudForce = true;
    save();
  }

  /* ---------------- 시간 이동 ---------------- */

  app.seek = function (t) {
    app.t = U.clamp(t, D.T_START, D.T_END);
    resetCrossIndex();
    hudForce = true;
    chartDirty = true;
  };

  app.play = function () {
    EC.audio.init();
    if (app.t >= D.T_END - 1e-6) app.seek(D.T_START);
    app.playing = true;
    updatePlayButton();
  };

  app.pause = function () {
    app.playing = false;
    updatePlayButton();
    save();
  };

  app.beginScrub = function () {
    app.scrubbing = true;
    EC.ui.panels.hideCard();
    if (app.playing) app.pause();
  };

  app.endScrub = function () {
    app.scrubbing = false;
    save();
  };

  function updatePlayButton() {
    const b = $('btn-play');
    b.textContent = app.playing ? '❚❚' : '▶';
    b.setAttribute('aria-label', app.playing ? '멈춤' : '재생');
  }

  function eventDir(e) {
    if (e.kind === 'intervention') return e.iv && e.iv.dir;
    if (e.loc) return EC.plates.pointAt(e.loc.plate, e.loc.lat, e.loc.lon, e.t);
    if (e.id === 'theia') return Q.norm([0.35, 0.25, 0.9]);
    return null;
  }

  function eventFx(e) {
    const dir = eventDir(e);
    if (!dir) return;
    const tnow = now();
    if (e.source === 'catastrophe' && !e.prevented) {
      if (e.cause === 'impact') { fx.add(dir, 'impact', 1, tnow); EC.audio.whoosh(); }
      else if (e.cause === 'volcano') { fx.add(dir, 'volcano', 1.6, tnow); EC.audio.impact(0.5); }
    } else if (e.kind === 'intervention') {
      const tool = D.tools[e.tool];
      if (tool.group === 'impact') { fx.add(dir, 'impact', tool.size, tnow); EC.audio.whoosh(); }
      else if (tool.group === 'volcano') { fx.add(dir, 'volcano', tool.size, tnow); EC.audio.impact(0.5); }
    } else if (e.id === 'theia') {
      fx.add(dir, 'impact', 5, tnow);
      EC.audio.whoosh();
    }
    focusOn(dir);
  }

  function showEvent(e, extra) {
    EC.ui.panels.showCard(app, e, extra);
    EC.audio.chime(e.kind);
  }

  app.jumpToEvent = function (e) {
    if (app.playing) app.pause();
    app.seek(e.t);
    eventFx(e);
    showEvent(e);
  };

  function nextEvent() {
    const e = app.events.find((x) => x.t > app.t + 1e-7);
    if (e) app.jumpToEvent(e);
  }

  function prevEvent() {
    let e = null;
    for (const x of app.events) if (x.t < app.t - 1e-7) e = x;
    if (e) app.jumpToEvent(e);
  }

  function advance(dt) {
    const s0 = EC.time.toS(app.t);
    const s1 = s0 + dt / SPEEDS[app.speedIdx];
    let t1 = s1 >= 1 ? D.T_END : EC.time.fromS(s1);
    while (app.crossIndex < app.events.length && app.events[app.crossIndex].t <= t1 + 1e-9) {
      const e = app.events[app.crossIndex++];
      eventFx(e);
      if (e.major && app.autoPause) {
        t1 = e.t;
        app.t = t1;
        app.pause();
        showEvent(e);
        return;
      }
    }
    app.t = t1;
    if (app.t >= D.T_END) app.pause();
  }

  /* ---------------- 개입 ---------------- */

  function setTool(type) {
    app.tool = type;
    document.body.classList.toggle('picking', !!type);
    document.querySelectorAll('.rail-btn[data-tool], .rail-btn[data-group], .size').forEach((b) => {
      const on = type && (b.dataset.tool === type || (b.dataset.group === 'impact' && type.startsWith('impact')));
      b.classList.toggle('on', !!on);
    });
    const hint = $('hint');
    if (type) {
      hint.textContent = `${D.tools[type].name} — 지구에서 떨어뜨릴 곳을 누르세요`;
      hint.hidden = false;
      if (app.playing) app.pause();
    } else {
      hint.hidden = true;
      pickHover = null;
    }
  }

  function cancelTool() {
    setTool(null);
    $('impact-sizes').hidden = true;
  }

  function applyIntervention(type, dir) {
    const prev = app.run;
    const iv = {
      id: `iv${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`,
      t: app.t,
      type,
      dir: dir ? dir.map((v) => +v.toFixed(5)) : null,
    };
    app.interventions.push(iv);
    app.interventions.sort((a, b) => a.t - b.t);
    cancelTool();
    if (app.playing) app.pause();
    recompute();
    EC.audio.init();
    const tool = D.tools[type];
    if (dir && tool.group === 'impact') { fx.add(dir, 'impact', tool.size, now()); EC.audio.whoosh(); }
    else if (dir && tool.group === 'volcano') { fx.add(dir, 'volcano', tool.size, now()); EC.audio.impact(0.5); }
    else EC.audio.chime('intervention');
    const shock = app.run.cfg.shocks.find((s) => s.source === iv.id);
    const lines = EC.ui.panels.consequences(prev, app.run, iv.t, shock ? shock.s : undefined);
    const ev = app.events.find((e) => e.id === iv.id);
    EC.ui.panels.showCard(app, ev, { conseq: lines, conseqTitle: '당신의 개입으로 이렇게 바뀝니다' });
  }

  app.removeIntervention = function (id) {
    const prev = app.run;
    const iv = app.interventions.find((x) => x.id === id);
    app.interventions = app.interventions.filter((x) => x.id !== id);
    recompute();
    EC.ui.panels.hideCard();
    if (iv) {
      const lines = EC.ui.panels.consequences(prev, app.run, iv.t);
      const tool = D.tools[iv.type];
      EC.ui.panels.showCard(app, { id: 'undo', t: iv.t, kind: 'intervention', tool: iv.type, title: `${tool.name} 취소`, text: '이 개입이 없었던 역사로 되돌렸습니다.', source: 'undo' },
        { conseq: lines, conseqTitle: '되돌린 결과' });
    }
  };

  app.toggleCatastrophe = function (id) {
    const prev = app.run;
    if (app.disabled.has(id)) app.disabled.delete(id);
    else app.disabled.add(id);
    recompute();
    const c = D.catastrophes.find((x) => x.id === id);
    const ev = app.events.find((e) => e.id === id && e.source === 'catastrophe');
    const lines = EC.ui.panels.consequences(prev, app.run, c.t - 1e-4);
    EC.ui.panels.showCard(app, ev, { conseq: lines, conseqTitle: app.disabled.has(id) ? '이 사건을 막으면' : '이 사건이 다시 일어나면' });
    EC.audio.chime('intervention');
  };

  app.resetHistory = function () {
    app.interventions = [];
    app.disabled.clear();
    recompute();
    EC.ui.panels.hideCard();
  };

  /* ---------------- 카메라 ---------------- */

  function focusOn(dirEarth) {
    focus = { dir: dirEarth, until: now() + 1.6 };
    cam.vy = 0;
    cam.vp = 0;
  }

  function wrapAngle(a) {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
  }

  function updateCamera(dt) {
    if (focus) {
      const w = globe.toWorld(focus.dir);
      const ty = Math.atan2(w[0], w[2]);
      const tp = U.clamp(Math.asin(U.clamp(w[1], -1, 1)), -1.1, 1.1);
      const k = 1 - Math.exp(-dt * 4);
      cam.yaw += wrapAngle(ty - cam.yaw) * k;
      cam.pitch += (tp - cam.pitch) * k;
      if (now() > focus.until) focus = null;
    } else {
      cam.yaw += cam.vy * dt;
      cam.pitch += cam.vp * dt;
      const decay = Math.exp(-dt * 3.5);
      cam.vy *= decay;
      cam.vp *= decay;
    }
    cam.pitch = U.clamp(cam.pitch, -1.45, 1.45);
    globe.camera = { yaw: cam.yaw, pitch: cam.pitch, dist: cam.dist };
  }

  function bindCanvas() {
    const pointers = new Map();
    let drag = null;
    let pinch = null;
    const pt = (e) => ({ x: e.clientX, y: e.clientY });
    canvas.addEventListener('pointerdown', (e) => {
      canvas.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, pt(e));
      if (pointers.size === 1) {
        drag = { ...pt(e), moved: 0, last: performance.now() };
        canvas.classList.add('dragging');
      } else if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), dist: cam.dist };
        drag = null;
      }
      focus = null;
    });
    canvas.addEventListener('pointermove', (e) => {
      const p = pt(e);
      if (pointers.has(e.pointerId)) pointers.set(e.pointerId, p);
      if (pinch && pointers.size >= 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        cam.dist = U.clamp((pinch.dist * pinch.d) / Math.max(d, 1), DIST_MIN, DIST_MAX);
        return;
      }
      if (drag) {
        const dx = p.x - drag.x;
        const dy = p.y - drag.y;
        const tnow = performance.now();
        const dt = Math.max(1, tnow - drag.last) / 1000;
        const k = 0.0055 * U.clamp((cam.dist - 1) / 2.4, 0.15, 2.5);
        cam.yaw -= dx * k;
        cam.pitch += dy * k;
        cam.vy = (-dx * k) / dt * 0.6;
        cam.vp = (dy * k) / dt * 0.6;
        drag.moved += Math.abs(dx) + Math.abs(dy);
        drag.x = p.x;
        drag.y = p.y;
        drag.last = tnow;
      } else if (app.tool && e.pointerType !== 'touch') {
        pickHover = globe.pick(p.x, p.y);
      }
    });
    const up = (e) => {
      const wasDrag = drag;
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = null;
      if (pointers.size === 0) canvas.classList.remove('dragging');
      if (wasDrag && pointers.size === 0) {
        drag = null;
        if (performance.now() - wasDrag.last > 80) { cam.vy = 0; cam.vp = 0; }
        if (wasDrag.moved < 7) onCanvasClick(e.clientX, e.clientY);
      }
    };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      cam.dist = U.clamp(cam.dist * Math.exp(e.deltaY * 0.0012), DIST_MIN, DIST_MAX);
    }, { passive: false });
  }

  function onCanvasClick(x, y) {
    if (app.tool) {
      const dir = globe.pick(x, y);
      if (dir) applyIntervention(app.tool, dir);
      return;
    }
    $('impact-sizes').hidden = true;
  }

  /* ---------------- 화면 조작 ---------------- */

  function bindUI() {
    $('btn-play').addEventListener('click', () => (app.playing ? app.pause() : app.play()));
    $('btn-next').addEventListener('click', nextEvent);
    $('btn-prev').addEventListener('click', prevEvent);
    $('btn-speed').addEventListener('click', () => setSpeed((app.speedIdx + 1) % SPEEDS.length));
    $('chk-pause').addEventListener('change', (e) => { app.autoPause = e.target.checked; save(); });
    $('card-close').addEventListener('click', () => EC.ui.panels.hideCard());

    document.querySelector('.rail-btn[data-group="impact"]').addEventListener('click', () => {
      const box = $('impact-sizes');
      if (app.tool && app.tool.startsWith('impact')) { cancelTool(); return; }
      box.hidden = !box.hidden;
    });
    document.querySelectorAll('.size').forEach((b) => b.addEventListener('click', () => {
      EC.audio.init();
      $('impact-sizes').hidden = true;
      setTool(b.dataset.tool);
    }));
    document.querySelectorAll('.rail-btn[data-tool]').forEach((b) => b.addEventListener('click', () => {
      EC.audio.init();
      const type = b.dataset.tool;
      $('impact-sizes').hidden = true;
      if (D.tools[type].group === 'co2') { cancelTool(); applyIntervention(type, null); return; }
      if (app.tool === type) cancelTool();
      else setTool(type);
    }));

    $('btn-history').addEventListener('click', () => {
      const p = $('history-panel');
      p.hidden = !p.hidden;
      if (!p.hidden) { $('chart-panel').hidden = true; EC.ui.panels.renderHistory(app); }
    });
    $('btn-chart').addEventListener('click', () => {
      const p = $('chart-panel');
      p.hidden = !p.hidden;
      if (!p.hidden) { $('history-panel').hidden = true; chartDirty = true; }
    });
    $('chart-tabs').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-metric]');
      if (!b) return;
      chartMetric = b.dataset.metric;
      document.querySelectorAll('#chart-tabs button').forEach((x) => x.classList.toggle('on', x === b));
      chartDirty = true;
    });
    document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => { $(b.dataset.close).hidden = true; }));

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
    $('btn-sound').addEventListener('click', () => {
      EC.audio.init();
      EC.audio.setMuted(!EC.audio.isMuted());
      $('btn-sound').textContent = EC.audio.isMuted() ? '🔇' : '🔊';
      save();
    });
    $('btn-help').addEventListener('click', () => { $('help').hidden = false; });

    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
      if (!$('intro').hidden) return;
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        if (app.playing) app.pause();
        else app.play();
      } else if (e.key === 'ArrowRight') { e.preventDefault(); nextEvent(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); prevEvent(); }
      else if (e.key === '+' || e.key === '=') setSpeed(Math.min(SPEEDS.length - 1, app.speedIdx + 1));
      else if (e.key === '-' || e.key === '_') setSpeed(Math.max(0, app.speedIdx - 1));
      else if (e.key === 'Escape') {
        if (app.tool) cancelTool();
        else if (!$('help').hidden) $('help').hidden = true;
        else if (!$('card').hidden) EC.ui.panels.hideCard();
        else { $('chart-panel').hidden = true; $('history-panel').hidden = true; }
      }
    });

    window.addEventListener('resize', () => { resizePending = true; });
    window.addEventListener('pagehide', save);
  }

  const SPEED_LABELS = ['느리게', '보통', '빠르게', '매우 빠르게'];
  function setSpeed(i) {
    app.speedIdx = i;
    $('btn-speed').textContent = SPEED_LABELS[i];
    hudForce = true;
    save();
  }

  function startIntro(saved) {
    const intro = $('intro');
    const resume = $('btn-resume');
    const hasSave = saved && (saved.interventions.length || saved.disabled.length || saved.t > D.T_START + 1);
    resume.hidden = !hasSave;
    const close = () => { intro.hidden = true; EC.audio.init(); };
    $('btn-start').addEventListener('click', () => {
      close();
      app.interventions = [];
      app.disabled.clear();
      recompute();
      app.seek(D.T_START);
      app.play();
    });
    resume.addEventListener('click', () => {
      close();
      app.seek(saved.t);
      hudForce = true;
    });
    $('btn-now').addEventListener('click', () => {
      close();
      app.interventions = [];
      app.disabled.clear();
      recompute();
      app.seek(0);
      const ev = app.events.find((e) => e.id === 'present');
      if (ev) showEvent(ev);
    });
  }

  /* ---------------- 그리기 ---------------- */

  function doResize() {
    resizePending = false;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    globe.resize(window.innerWidth, window.innerHeight, dpr);
    timeline.resize();
    chartDirty = true;
  }

  function rateText() {
    if (!app.playing) return '';
    const s = EC.time.toS(app.t);
    const eps = 1e-4;
    const a = EC.time.fromS(Math.max(0, s - eps));
    const b = EC.time.fromS(Math.min(1, s + eps));
    const myrPerSec = ((b - a) / (2 * eps)) / SPEEDS[app.speedIdx];
    return `1초에 ${U.formatYears(myrPerSec * 1e6)} 년`;
  }

  function frame(ms) {
    const tnow = ms / 1000;
    const dt = Math.min(0.1, Math.max(0, tnow - (lastFrame || tnow)));
    lastFrame = tnow;
    frameAvg = frameAvg * 0.95 + dt * 1000 * 0.05;
    if (resizePending) doResize();

    if (app.playing && !app.scrubbing) {
      advance(dt);
      if (app.playing && app.t > -4100 && app.t < -3850) {
        lhbTimer -= dt;
        if (lhbTimer <= 0) {
          lhbTimer = 0.35 + Math.random() * 0.6;
          const d = Q.norm([Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1]);
          fx.add(d, 'impact', 0.25 + Math.random() * 0.35, now());
        }
      }
    }

    const st = EC.sim.stateAt(app.run, app.t);
    const u = EC.look.build(st, app.run, app.t);
    globe.spin += dt * ((Math.PI * 2) / (80 * U.clamp(st.dayHours / 24, 0.2, 3)));
    moonAngle += dt * ((Math.PI * 2) / 70);
    updateCamera(dt);
    const md = st.moonKm > 0 ? EC.look.moonVisualDistance(st.moonKm) : 0;
    u.uMoonPos = [md * Math.sin(moonAngle), md * 0.09 * Math.sin(moonAngle * 0.5 + 1), md * Math.cos(moonAngle)];
    u.uMoonR = md > 0 ? 0.27 : 0;
    u.uCloudSpin = tnow * 0.012;
    u.time = tnow;
    u.plateRots = EC.plates.layerRotations(app.t);
    u.layerVis = EC.plates.layerVisibility(app.t);
    Object.assign(u, fx.update(now(), globe));
    u.uPick = app.tool && pickHover ? pickHover : [0, 0, 0];
    globe.render(u);

    timeline.draw(app.t);

    hudTimer -= dt;
    if (hudTimer <= 0 || hudForce) {
      hudTimer = 0.1;
      hudForce = false;
      const div = diverged();
      const base = div ? EC.sim.stateAt(app.base, app.t) : null;
      EC.ui.hud.update(st, base, div, rateText());
      EC.audio.setMood(st);
    }
    chartTimer -= dt;
    if (!$('chart-panel').hidden && (chartDirty || chartTimer <= 0)) {
      chartTimer = 0.25;
      chartDirty = false;
      EC.ui.chart.draw($('chart'), chartMetric, app.run, app.base, app.t);
    }

    if (frameAvg > 30 && globe.scale > 0.5) { globe.scale = Math.max(0.5, globe.scale - 0.1); frameAvg = 22; resizePending = true; }
    else if (frameAvg < 15 && globe.scale < 1) { globe.scale = Math.min(1, globe.scale + 0.05); frameAvg = 18; resizePending = true; }

    requestAnimationFrame(frame);
  }

  /* ---------------- 시작 ---------------- */

  function init() {
    canvas = $('globe');
    try {
      globe = new EC.Globe(canvas);
    } catch (err) {
      $('intro').hidden = true;
      $('nogl').hidden = false;
      if (err && /셰이더/.test(err.message || '')) $('nogl-msg').textContent = '그래픽 카드에서 지구를 그리는 프로그램을 준비하지 못했습니다. 브라우저를 최신 버전으로 바꾸거나 다른 브라우저에서 열어 주세요.';
      if (err && err.message) $('nogl-msg').textContent += ` (${err.message.slice(0, 160)})`;
      return;
    }
    const mask = EC.landmask.build();
    globe.setMask(mask, EC.landmask.W, EC.landmask.H, D.layers.length);
    fx = new EC.FxManager();
    fx.onImpact = (e) => EC.audio.impact(e.size);
    timeline = new EC.ui.Timeline($('timeline'), app);
    EC.ui.hud.init();

    app.base = EC.sim.run([], new Set());
    app.baseFirst = EC.sim.firstTimes(app.base);
    const saved = load();
    if (saved) {
      app.interventions = saved.interventions;
      app.disabled = new Set(saved.disabled);
      app.t = U.clamp(saved.t, D.T_START, D.T_END);
      if (Number.isInteger(saved.speedIdx)) app.speedIdx = U.clamp(saved.speedIdx, 0, SPEEDS.length - 1);
      if (typeof saved.autoPause === 'boolean') app.autoPause = saved.autoPause;
      if (saved.muted) { EC.audio.setMuted(true); $('btn-sound').textContent = '🔇'; }
    }
    $('chk-pause').checked = app.autoPause;
    setSpeed(app.speedIdx);
    const aspect = window.innerWidth / Math.max(1, window.innerHeight);
    if (aspect < 1) cam.dist = U.clamp(1.18 / (Math.tan((38 * Math.PI) / 360) * aspect), 3.4, 9);
    recompute();
    app.seek(app.t);
    bindUI();
    bindCanvas();
    startIntro(saved);

    if (/[?&]debug\b/.test(location.search)) window.EC_APP = app;
    const m = /[?&]t=(-?[\d.]+)/.exec(location.search);
    if (m) { app.seek(+m[1]); $('intro').hidden = true; }
    requestAnimationFrame(frame);
  }

  init();
})();
