'use strict';

/* =========================================================
 * 그림 보관소 — SVG 문자열을 이미지로 바꿔 오프스크린 캔버스에 한 번 그려 둡니다.
 * 캔버스에서 매 프레임 SVG를 다시 그리지 않도록 하기 위함 (브라우저 전용)
 * ========================================================= */
RG.art.sprites = (() => {
  const cache = new Map();          // key → { canvas, w, h }
  const loading = new Map();        // key → Promise

  /** SVG에 픽셀 크기를 넣어 선명하게 래스터화되게 함 */
  function sized(svg, w, h) {
    return svg.replace(/<svg\b([^>]*)>/, (m, attrs) => `<svg${attrs.replace(/\s(width|height)="[^"]*"/g, '')} width="${w}" height="${h}">`);
  }

  /**
   * 덩어리 빛(docs/design/animation.md §7.2): 그린 그림 모양 안에만 왼쪽 위 따뜻한 빛 → 오른쪽 아래 푸른 보랏빛 그늘을 얹음.
   * 모든 탑·적·영웅에 같은 방향의 빛이 들어 한 장면처럼 보이고 면이 둥글게 보임. 그림 한 장당 한 번(불러올 때)만.
   */
  function volumeLight(ctx, w, h, k) {
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    const g = ctx.createLinearGradient(w * 0.15, h * 0.05, w * 0.85, h * 0.95);
    g.addColorStop(0, `rgba(255,240,200,${0.2 * k})`);
    g.addColorStop(0.42, 'rgba(255,240,200,0)');
    g.addColorStop(0.6, 'rgba(40,24,90,0)');
    g.addColorStop(1, `rgba(40,24,90,${0.32 * k})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  /**
   * 불투명한 부분의 범위 [x0, y0, x1, y1] (화소, 끝 포함) — 불러올 때 한 번만 읽어 둠.
   * 렌더러가 화면 크기로 줄일 때마다 화소를 다시 읽지 않고 이 범위로 잘라 냄(전투 중 읽기 = 느림).
   */
  function opaqueBounds(ctx, w, h) {
    let d;
    try { d = ctx.getImageData(0, 0, w, h).data; } catch (e) { return null; }
    let x0 = w; let y0 = h; let x1 = -1; let y1 = -1;
    for (let y = 0; y < h; y++) {
      const row = y * w * 4 + 3;
      for (let x = 0; x < w; x++) {
        if (d[row + x * 4]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; y1 = y; }
      }
    }
    return x1 < 0 ? null : [x0, y0, x1, y1];
  }

  function toCanvas(svg, w, h, opt) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        const ctx = cv.getContext('2d');
        try { ctx.drawImage(img, 0, 0, w, h); } catch (e) { /* 무시 */ }
        if (opt && opt.light) volumeLight(ctx, w, h, opt.light);
        cv._bb = opaqueBounds(ctx, w, h);
        resolve(cv);
      };
      img.onerror = () => resolve(null);
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(sized(svg, w, h))}`;
    });
  }

  /** key로 그림을 준비. make()는 SVG 문자열을 돌려줌 */
  // 덩어리 빛 세기: 탑·적·영웅·병사만 (아이콘·등불은 그대로)
  const lightOf = (key) => (key.startsWith('tower:') ? 1 : key.startsWith('enemy:') ? 0.8 : key.startsWith('hero:') || key.startsWith('unit:') ? 0.7 : 0);
  function load(key, make, w, h) {
    if (cache.has(key)) return Promise.resolve(cache.get(key));
    if (loading.has(key)) return loading.get(key);
    let svg;
    try { svg = make(); } catch (e) { svg = null; }
    if (!svg) { cache.set(key, null); return Promise.resolve(null); }
    const p = toCanvas(svg, w, h, { light: lightOf(key) }).then((cv) => {
      const entry = cv ? { canvas: cv, w, h } : null;
      cache.set(key, entry);
      loading.delete(key);
      return entry;
    });
    loading.set(key, p);
    return p;
  }

  const get = (key) => cache.get(key) || null;

  /* ---------- 자주 쓰는 묶음 ---------- */
  const TW = 168;
  const TH = Math.round(TW * 1.3);

  function towerKey(type, level, branch, pose = 'idle') { return `tower:${type}:${level}:${branch || ''}:${pose}`; }
  function enemyKey(type, frame) { return `enemy:${type}:${typeof frame === 'number' ? (frame ? 'walk2' : 'walk0') : frame}`; }
  function heroKey(id, pose) { return `hero:${id}:${pose}`; }
  function unitKey(kind, pose) { return `unit:${kind}:${pose}`; }
  const LANTERN_STEPS = [1, 0.75, 0.5, 0.25, 0.08];
  function lanternKey(ratio) {
    let best = LANTERN_STEPS[0];
    for (const s of LANTERN_STEPS) if (Math.abs(s - ratio) < Math.abs(best - ratio)) best = s;
    return `lantern:${best}`;
  }

  /* ---------- 한 판의 그림 ---------- */
  const A = () => RG.art;
  const towerJob = (t, lv, b, pose = 'idle') => ({ key: towerKey(t, lv, b, pose), make: () => A().tower(t, lv, b, pose), w: TW, h: TH });
  const enemySize = (e) => ((RG.data.enemies[e] && RG.data.enemies[e].size >= 1.4) ? 288 : 168);
  const enemyJob = (e, f) => ({ key: enemyKey(e, f), make: () => A().enemy(e, f), w: enemySize(e), h: enemySize(e) });
  const heroJob = (id, p) => { const s = id.endsWith('_giant') ? 256 : 160; return { key: heroKey(id, p), make: () => A().hero(id, p), w: s, h: s }; };
  const unitJob = (k, p) => ({ key: unitKey(k, p), make: () => A().unit(k, p), w: 128, h: 128 });
  const lanternJob = (s) => ({ key: `lantern:${s}`, make: () => A().lantern(s), w: TW, h: TH });
  const heroSkillOf = (game) => game.opts.heroId && RG.data.heroes[game.opts.heroId] && RG.data.heroes[game.opts.heroId].skill;
  const unitKindsOf = (game) => { const sk = heroSkillOf(game); return ['stone_soldier', 'granite_guard', 'obsidian_blade', 'drone', 'rock_wall'].concat(sk && sk.snowman ? ['snowman'] : []); };

  /** 적 목록에 분열·소환으로 나오는 적을 더함 */
  function withSpawned(enemies) {
    for (const e of [...enemies]) {
      const ed = RG.data.enemies[e];
      if (ed && ed.traits.split) enemies.add(ed.traits.split.into);
      const bd = ed && ed.bossData;
      if (bd) {
        if (bd.summon) enemies.add(bd.summon.type);
        if (bd.phase && bd.phase.summon) enemies.add(bd.phase.summon.type);
        for (const ph of bd.phases || []) enemies.add(ph.summon.type);
      }
    }
    return enemies;
  }

  /** 한 판에 미리 준비할 그림 목록 [{ key, make, w, h }] — 불러오지는 않음 */
  function planForGame(game) {
    const jobs = [];
    const AR = A();
    const types = new Set(game.opts.towers || Object.keys(RG.data.towers));
    // 탑: 모든 단계의 쉬는 자세 + Lv1의 동작 자세는 미리, 나머지 동작은 처음 쓸 때(ensure)
    for (const t of types) {
      for (const lv of [1, 2, 3]) jobs.push(towerJob(t, lv, null));
      for (const b of ['A', 'B']) jobs.push(towerJob(t, 4, b));
      for (const p of ['aim', 'fire']) jobs.push(towerJob(t, 1, null, p));
    }
    // 탑과 따로 움직이는 효과 그림 (불사조·바위·철구)
    if (AR.fxSprite) {
      if (types.has('phoenix_nest')) for (const fr of [0, 1]) jobs.push({ key: `fx:phoenix:${fr}`, make: () => A().fxSprite('phoenix', fr), w: 120, h: 120 });
      if (types.has('titan_boulder')) for (const k of ['boulder', 'ironball']) jobs.push({ key: `fx:${k}`, make: () => A().fxSprite(k, 0), w: 120, h: 120 });
    }
    const enemies = new Set();
    for (const w of RG.grid.parseWaves(game.waveStrings || game.def.waves || [])) for (const g of w.groups) enemies.add(g.e);
    if (game.opts.mode === 'endless') for (const e of RG.data.regionPools[game.def.region] || []) enemies.add(e);
    for (const e of withSpawned(enemies)) for (const f of (AR.ENEMY_FRAMES || ['walk0', 'walk2'])) jobs.push(enemyJob(e, f));
    for (const id of RG.data.heroOrder) {
      if (game.opts.heroId !== id) continue;
      for (const p of (AR.HERO_POSES || ['idle0'])) jobs.push(heroJob(id, p));
      // 토리: 거인 변신 그림도 미리 (크게)
      const hd = RG.data.heroes[id];
      if (hd && hd.skill && hd.skill.giant) for (const p of (AR.HERO_POSES || ['idle0'])) jobs.push(heroJob(`${id}_giant`, p));
    }
    for (const k of unitKindsOf(game)) for (const p of (AR.UNIT_POSES || ['idle', 'attack'])) jobs.push(unitJob(k, p));
    for (const s of LANTERN_STEPS) jobs.push(lanternJob(s));
    return jobs;
  }

  /** 한 판에 필요한 그림을 모두 한꺼번에 준비 */
  function prepareForGame(game) {
    return Promise.all(planForGame(game).map((j) => load(j.key, j.make, j.w, j.h)));
  }

  /**
   * 지금 화면에 바로 보이는 그림만: 등불, 영웅·병사·벽의 기본 자세, 맵 위의 탑, 살아 있는 적과 지금·다음 웨이브 적의 기본 그림(walk0).
   * 다른 자세는 렌더러가 기본 그림으로 대신하다 처음 그릴 때 부름(ensure), 나머지는 background가 쉬는 틈에.
   * hint.wave: 아직 재현 전이면 저장된 웨이브 번호.
   */
  function essentialForGame(game, hint) {
    const st = game.state;
    const out = new Map();
    const add = (j) => { if (!out.has(j.key)) out.set(j.key, j); };
    for (const s of LANTERN_STEPS) add(lanternJob(s));
    if (game.opts.heroId) add(heroJob(game.opts.heroId, 'idle0'));
    for (const k of unitKindsOf(game)) add(unitJob(k, 'idle'));
    for (const t of st.towers) add(towerJob(t.type, t.level, t.branch));
    const enemies = new Set();
    for (const e of st.enemies) if (!e.dead) enemies.add(e.type);
    const waves = RG.grid.parseWaves(game.waveStrings || game.def.waves || []);
    const w0 = hint && hint.wave != null ? hint.wave : st.wave.index;
    for (let i = Math.max(0, w0 - 1); i <= w0 + 1 && i < waves.length; i++) for (const g of waves[i].groups) enemies.add(g.e);
    for (const e of enemies) if (RG.data.enemies[e]) add(enemyJob(e, 'walk0'));
    return [...out.values()];
  }

  /*
   * 나눠서 준비하기 (js/ui/game.js): 그림 한 장을 만드는 데(SVG 글 + 브라우저가 SVG를 읽기) 느린 휴대폰에서 수십 ms.
   * 한꺼번에 수백 장이면 화면이 수 초~수십 초 멈췄음 → 한 작업에 한 장씩, 지금 보이는 것(need)은 바로바로,
   * 나머지(background)는 판을 하면서 쉬는 틈에(requestIdleCallback). 같은 그림을 두 번 만들지 않음(load가 묶음).
   */
  const post = (() => {
    if (typeof MessageChannel === 'undefined') return (fn) => { const id = setTimeout(fn, 0); return () => clearTimeout(id); };
    const ch = new MessageChannel();
    const q = [];
    ch.port1.onmessage = () => { const fn = q.shift(); if (fn) fn(); };
    return (fn) => { let live = true; q.push(() => { if (live) fn(); }); ch.port2.postMessage(0); return () => { live = false; }; };
  })();
  const idleLater = (fn) => {
    if (typeof requestIdleCallback === 'function') { const id = requestIdleCallback(fn, { timeout: 1000 }); return () => cancelIdleCallback(id); }
    const id = setTimeout(fn, 120);
    return () => clearTimeout(id);
  };

  /**
   * const p = stagedForGame(game)
   * p.need(jobs) → Promise: 이 그림들을 먼저(앞줄) 준비, 다 되면 풀림
   * p.background() → 나머지(planForGame에서 앞줄에 없던 것)를 쉬는 틈에 하나씩
   * p.cancel() → 아직 시작하지 않은 것은 그만 (이미 시작한 한 장은 끝까지 — 보관소에 남아 다음에 씀)
   */
  function stagedForGame(game) {
    const front = [];
    let back = null;
    let stop = null;
    let cancelled = false;
    const pending = new Map(); // key → [resolve] (앞줄 그림이 준비되면)
    function startOne(job) {
      const p = load(job.key, job.make, job.w, job.h);
      const res = pending.get(job.key);
      if (res) { pending.delete(job.key); p.then(() => res.forEach((f) => f())); }
    }
    function pump() {
      stop = null;
      if (cancelled) return;
      const job = front.length ? front.shift() : back && back.length ? back.shift() : null;
      if (job) startOne(job);
      schedule();
    }
    function schedule() {
      if (cancelled || stop) return;
      if (front.length) stop = post(pump);
      else if (back && back.length) stop = idleLater(pump);
    }
    function need(jobs) {
      if (cancelled) return Promise.resolve();
      const waits = [];
      for (const j of jobs) {
        if (cache.has(j.key)) continue;
        if (loading.has(j.key)) { waits.push(loading.get(j.key)); continue; }
        waits.push(new Promise((res) => { if (!pending.has(j.key)) { pending.set(j.key, []); front.push(j); } pending.get(j.key).push(res); }));
      }
      // 앞줄이 생겼으면 쉬는 틈 대기 대신 바로
      if (front.length && stop && back && back.length) { stop(); stop = null; }
      schedule();
      return Promise.all(waits).then(() => undefined);
    }
    function background() {
      if (cancelled || back) return;
      // 순서: 탑 목록의 탑을 놓을 때 보이는 그림(설치 단계의 쉬는 자세 — 렌더러가 스스로 부르지 않음) → 곧 올 웨이브 적의 걷는 동작
      // → 그 적의 다른 동작 → 나머지. (화면에 나온 탑·적·영웅의 다른 자세는 렌더러가 처음 그릴 때 ensure로 부름)
      const ghost = new Set();
      for (const t of game.opts.towers || Object.keys(RG.data.towers)) ghost.add(towerKey(t, game.startLevel ? game.startLevel(t) : 1, null));
      const waves = RG.grid.parseWaves(game.waveStrings || game.def.waves || []);
      const soon = new Set();
      for (const e of game.state.enemies) if (!e.dead) soon.add(e.type);
      for (let i = Math.max(0, game.state.wave.index - 1); i < game.state.wave.index + 3 && i < waves.length; i++) for (const g of waves[i].groups) soon.add(g.e);
      withSpawned(soon);
      const rank = (j) => {
        const [kind, name, frame] = j.key.split(':');
        if (ghost.has(j.key)) return 0;
        if (kind === 'enemy' && soon.has(name)) return frame.startsWith('walk') ? 1 : 2;
        return 3;
      };
      back = planForGame(game).filter((j) => !cache.has(j.key) && !pending.has(j.key))
        .map((j, i) => [rank(j), i, j]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map((x) => x[2]);
      schedule();
    }
    function cancel() {
      cancelled = true;
      if (stop) stop();
      stop = null;
      front.length = 0;
      if (back) back.length = 0;
      for (const res of pending.values()) res.forEach((f) => f());
      pending.clear();
    }
    return { need, background, cancel, get left() { return front.length + (back ? back.length : 0); } };
  }

  /** 건설 메뉴 등 DOM용 작은 그림 (data URL) */
  function dataUrl(svg) {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }

  /** 준비된 그림이면 돌려주고, 아니면 준비를 시작하고 null (렌더러는 그동안 대신할 그림을 씀) */
  function ensure(key, make, w, h) {
    const s = cache.get(key);
    if (s !== undefined) return s;
    if (!loading.has(key)) load(key, make, w, h);
    return null;
  }

  return { sized, load, get, ensure, TW, TH, towerKey, enemyKey, heroKey, unitKey, lanternKey, prepareForGame, planForGame, essentialForGame, stagedForGame, dataUrl, LANTERN_STEPS };
})();
