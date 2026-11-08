'use strict';

/*
 * 지상 탐사 모드: 우주에서 끝까지 확대하면 그 지점의 땅(또는 바닷속)으로 내려갑니다.
 * 끌어서 둘러보고, 생명체·무생명체를 누르면 설명이 나옵니다. 시간을 흘리면 풍경도 그 시대로 바뀝니다.
 */
(function () {
  const EC = (window.EC = window.EC || {});
  const U = EC.util;
  const Q = EC.q;
  const F = EC.field;
  const $ = (id) => document.getElementById(id);

  const S = {
    ready: false,
    active: false,
    anchor: null,
    dirFixed: null,
    yaw: 0,
    pitch: -0.04,
    fov: 58,
    fade: 0,
    fadeDir: 0,
    exitAcc: 0,
    info: null,
    bio: null,
    env: null,
    terrain: null,
    sig: '',
    queryTimer: 0,
    lastT: null,
    scene: null,
    rng: U.rng(7),
    guideSig: '',
  };
  let globe = null;
  let app = null;
  let gr = null;
  let ov = null;
  let octx = null;
  let hooks = {};

  const TERRAIN_KEYS = ['uSeed', 'uUnder', 'uCoast', 'uCoastDist', 'uSeaDir', 'uBaseH', 'uHillAmp', 'uHillFreq', 'uRough', 'uMtnAmp', 'uMtnNear', 'uDune', 'uCanopy', 'uDepth'];

  function init(g, a, h) {
    globe = g;
    app = a;
    hooks = h || {};
    try {
      gr = new EC.GroundRenderer(g.gl);
    } catch (e) {
      console.warn(e);
      return;
    }
    ov = $('field-canvas');
    octx = ov.getContext('2d');
    S.scene = new F.Scene();
    S.ready = true;
    $('btn-ascend').addEventListener('click', () => exit());
    $('guide-head').addEventListener('click', () => $('field-guide').classList.toggle('open'));
  }

  /* 화면 가운데의 지점 (지구 고정 좌표) */
  function centerDir() {
    return globe.pick(globe.cssW / 2, globe.cssH / 2);
  }

  function queryAt(dir, look, st) {
    const l = Object.assign({}, look, { uDetail: 1 });
    const info = EC.surface.query(dir, l, EC.plates.layerRotations(app.t), EC.plates.layerVisibility(app.t));
    const bio = EC.surface.biome(info, st);
    return { info, bio };
  }

  function currentDir() {
    if (S.anchor) return Q.rotate(EC.plates.rotationOf(EC.data.layers[S.anchor.layer].plate, app.t, {}), S.anchor.vec);
    return S.dirFixed;
  }

  function enter(dir) {
    if (!S.ready || S.active || !dir) return;
    const st = EC.sim.stateAt(app.run, app.t);
    const look = EC.look.build(st, app.run, app.t);
    const { info } = queryAt(dir, look, st);
    S.anchor = null;
    S.dirFixed = dir;
    if (info.land && info.layer >= 0) {
      const rot = EC.plates.rotationOf(EC.data.layers[info.layer].plate, app.t, {});
      S.anchor = { layer: info.layer, vec: Q.rotate(Q.conj(rot), dir) };
    }
    /* 오전 햇살 속에서 시작하도록 지구를 돌려 둡니다 (해 높이 약 35°, 해가 뜨는 쪽) */
    let best = globe.spin;
    let bestScore = -1e9;
    const keep = globe.spin;
    for (let k = 0; k < 96; k++) {
      globe.spin = (k / 96) * Math.PI * 2;
      const f = globe.localFrame(dir);
      const el = Q.dot(globe.sunDir, f.up);
      const east = Q.dot(globe.sunDir, f.east);
      const score = -Math.abs(el - 0.57) + (east > 0 ? 0.3 : 0);
      if (score > bestScore) { bestScore = score; best = globe.spin; }
    }
    globe.spin = best;
    void keep;
    S.active = true;
    S.sig = '';
    S.terrain = null;
    S.queryTimer = 0;
    S.fade = 0;
    S.fadeDir = 1;
    S.exitAcc = 0;
    S.fov = 58;
    S.pitch = info.land ? -0.1 : -0.3;
    S.yaw = Math.random() * Math.PI * 2;
    S.scene.selected = null;
    document.body.classList.add('field');
    $('field-ui').hidden = false;
    ov.hidden = false;
    $('btn-descend').hidden = true;
    if (hooks.onEnter) hooks.onEnter();
  }

  function exit() {
    if (!S.active) return;
    const dir = currentDir();
    S.active = false;
    document.body.classList.remove('field');
    $('field-ui').hidden = true;
    ov.hidden = true;
    $('field-guide').classList.remove('open');
    if (hooks.onExit) hooks.onExit(dir);
  }

  function camera() {
    const cp = Math.cos(S.pitch);
    const fwd = [Math.sin(S.yaw) * cp, Math.sin(S.pitch), Math.cos(S.yaw) * cp];
    const right = Q.norm(Q.cross([0, 1, 0], fwd));
    const up = Q.cross(fwd, right);
    const P = S.terrain;
    let y;
    if (P.uUnder > 0.5) y = F.terrainH(P, 0, 0, 7) + 2.2;
    else y = Math.max(F.terrainH(P, 0, 0, 7), P.uCoast > 0.5 ? 0.3 : -1e9) + 1.8;
    return { pos: [0, y, 0], fwd, right, up, tanHalf: Math.tan((S.fov * Math.PI) / 360) };
  }

  function lightFor(P) {
    const sl = P.uSunLight;
    const sz = P.uSkyZenith;
    const day = U.clamp(P.uSunDir[1] * 3 + 0.3, 0, 1);
    let L = [0, 1, 2].map((k) => U.clamp(sl[k] * 0.33 * day + sz[k] * 0.55 + 0.05, 0.07, 1.2));
    if (P.uUnder > 0.5) {
      const a = Math.exp(-P.uDepth * 0.018);
      L = [L[0] * 0.5 * a, L[1] * 0.85 * a, L[2] * 1.0 * a].map((v) => U.clamp(v, 0.06, 1.1));
    }
    if (P.uLava > 0.3) L = [Math.min(1.2, L[0] + 0.35), L[1] + 0.08, L[2]];
    return L;
  }

  function locationText(info, bio, env, st) {
    const lat = info.lat;
    const lon = info.lon;
    const ns = lat >= 0 ? '북위' : '남위';
    const ew = lon >= 0 ? '동경' : '서경';
    const where = S.anchor ? `${EC.data.layers[S.anchor.layer].name}판` : '';
    const T = `${U.formatNumber(st && st.T > 80 ? st.T : info.tempLocal, 0)}°C`;
    const depth = env.under ? ` · 수심 ${Math.round(env.depth)}m` : '';
    return `📍 ${where ? where + ' · ' : ''}${bio.name}${depth} · ${T} · ${ns} ${Math.abs(lat).toFixed(0)}° ${ew} ${Math.abs(lon).toFixed(0)}°`;
  }

  function renderGuide(env) {
    const list = S.scene.guide(env);
    const sig = list.map((g) => g.id + g.count).join(',');
    if (sig === S.guideSig) return;
    S.guideSig = sig;
    const life = list.filter((g) => g.kind === 'life');
    const things = list.filter((g) => g.kind !== 'life');
    $('guide-count').textContent = `생명체 ${life.length} · 무생명체 ${things.length}`;
    const row = (g) => `<button class="guide-item" data-id="${g.id}"><span class="gi">${g.icon}</span><span class="gn">${U.escapeHtml(g.name)}</span>${g.count > 1 ? `<span class="gc">${g.count}</span>` : ''}</button>`;
    let html = '';
    html += `<div class="guide-group">생명체</div>${life.length ? life.map(row).join('') : '<div class="guide-empty">아직 눈에 보이는 생명이 없습니다.</div>'}`;
    html += `<div class="guide-group">무생명체</div>${things.map(row).join('')}`;
    const body = $('guide-body');
    body.innerHTML = html;
    body.querySelectorAll('.guide-item').forEach((b) => b.addEventListener('click', () => {
      const g = list.find((x) => x.id === b.dataset.id);
      if (!g) return;
      const it = S.scene.nearestOf(g.id);
      if (it) {
        S.yaw = Math.atan2(it.x, it.z);
        S.scene.selected = it;
      }
      showInfo(g);
    }));
  }

  function showInfo(g) {
    const kindLabel = g.kind === 'life' ? '생명체' : '무생명체';
    EC.ui.panels.showCard(app, {
      id: 'field-' + g.id, t: app.t, kind: g.kind === 'life' ? 'life' : 'field', icon: g.icon,
      title: g.name, text: `[${kindLabel}] ${g.info}`, source: 'field',
    });
  }

  function frame(dt, st, look, tnow) {
    if (!S.active) return false;
    if (S.fadeDir > 0) S.fade = Math.min(1, S.fade + dt * 1.8);
    const dir = currentDir();
    const frameW = globe.localFrame(dir);
    const toLocal = (w) => Q.norm([Q.dot(w, frameW.east), Q.dot(w, frameW.up), Q.dot(w, frameW.north)]);
    const sun = toLocal(globe.sunDir);
    const moonW = hooks.moonPos ? hooks.moonPos() : [0, 0, 1];
    const moon = toLocal([moonW[0] - frameW.up[0], moonW[1] - frameW.up[1], moonW[2] - frameW.up[2]]);

    S.queryTimer -= dt;
    if (!S.info || S.queryTimer <= 0 || (S.lastT !== null && Math.abs(EC.time.toS(app.t) - EC.time.toS(S.lastT)) > 0.002)) {
      const q = queryAt(dir, look, st);
      S.info = q.info;
      S.bio = q.bio;
      S.queryTimer = 0.5;
      S.lastT = app.t;
    }
    const P = F.buildParams(S.info, S.bio, st, look, sun, moon);
    const terrainKey = S.bio.id + S.bio.habitat + (P.uCoast > 0.5 ? 'c' : '') + (S.bio.mountain ? 'm' : '');
    if (!S.terrain || S.terrain._key !== terrainKey) {
      S.terrain = { _key: terrainKey };
      for (const k of TERRAIN_KEYS) S.terrain[k] = P[k];
      S.sig = '';
    }
    for (const k of TERRAIN_KEYS) P[k] = S.terrain[k];
    P.uMaxH = P.uBaseH + Math.abs(P.uHillAmp) * 1.1 + P.uRough + P.uMtnAmp * 1.05 + P.uDune * 12 + P.uCanopy * 16 + 2;
    const env = F.makeEnv(S.info, S.bio, st, look, app.run, app.t, P, sun, moon);
    const sig = F.signature(env) + '|' + terrainKey;
    if (sig !== S.sig) {
      const seed = Math.floor((S.info.lat + 90) * 1000) * 7919 + Math.floor((S.info.lon + 180) * 1000) + terrainKey.length * 13;
      S.scene.compose(env, P, seed, S.yaw);
      S.sig = sig;
    }
    S.env = env;
    S.scene.update(dt, env, P, S.rng);

    P.uTime = tnow;
    P.uFade = S.fade;
    const cam = camera();
    gr.render(globe.canvas, cam, P);

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = window.innerWidth;
    const H = window.innerHeight;
    if (ov.width !== Math.round(W * dpr) || ov.height !== Math.round(H * dpr)) {
      ov.width = Math.round(W * dpr);
      ov.height = Math.round(H * dpr);
    }
    octx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ov.style.opacity = String(S.fade);
    S.scene.draw(octx, W, H, cam, P, env, tnow, lightFor(P), P.uFogK);

    $('field-loc').textContent = locationText(S.info, S.bio, env, st);
    renderGuide(env);
    return true;
  }

  /* ---------- 조작 ---------- */
  function drag(dx, dy) {
    const k = 0.0045 * (S.fov / 58);
    S.yaw -= dx * k;
    S.pitch = U.clamp(S.pitch + dy * k, -0.75, 1.1);
  }

  function zoom(delta) {
    if (delta < 0) {
      S.fov = U.clamp(S.fov * Math.exp(delta * 0.0012), 22, 58);
      S.exitAcc = 0;
    } else {
      if (S.fov < 57.5) { S.fov = U.clamp(S.fov * Math.exp(delta * 0.0012), 22, 58); return; }
      S.exitAcc += delta;
      if (S.exitAcc > 260) exit();
    }
  }

  function tap(x, y) {
    const it = S.scene.pick(x, y);
    if (!it) {
      S.scene.selected = null;
      return;
    }
    S.scene.selected = it;
    const sp = it.sp;
    showInfo({ id: sp.id, name: sp.name, icon: sp.icon, kind: sp.kind, info: sp.info });
  }

  /* 우주에서 볼 때 화면 가운데 아래에 무엇이 있는지 (내려가기 버튼용) */
  function peek(look, st) {
    const dir = centerDir();
    if (!dir) return null;
    const { info, bio } = queryAt(dir, look, st);
    return { dir, info, bio };
  }

  function setView(yaw, pitch) {
    S.yaw = yaw;
    if (pitch !== undefined) S.pitch = pitch;
  }

  EC.fieldMode = {
    init, enter, exit, frame, drag, zoom, tap, peek, centerDir, setView,
    debug: () => ({ info: S.info, bio: S.bio, env: S.env, items: S.scene && S.scene.items.map((i) => i.sp.id) }),
    get active() { return S.active; },
    get ready() { return S.ready; },
  };
})();
