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

  /** 한 판에 필요한 그림을 모두 준비 */
  function prepareForGame(game) {
    const jobs = [];
    const A = RG.art;
    const types = new Set(game.opts.towers || Object.keys(RG.data.towers));
    // 탑: 모든 단계의 쉬는 자세 + Lv1의 동작 자세는 미리, 나머지 동작은 처음 쓸 때(ensure)
    for (const t of types) {
      for (const lv of [1, 2, 3]) jobs.push(load(towerKey(t, lv, null), () => A.tower(t, lv, null, 'idle'), TW, TH));
      for (const b of ['A', 'B']) jobs.push(load(towerKey(t, 4, b), () => A.tower(t, 4, b, 'idle'), TW, TH));
      for (const p of ['aim', 'fire']) jobs.push(load(towerKey(t, 1, null, p), () => A.tower(t, 1, null, p), TW, TH));
    }
    // 탑과 따로 움직이는 효과 그림 (불사조·바위·철구)
    if (A.fxSprite) {
      if (types.has('phoenix_nest')) for (const fr of [0, 1]) jobs.push(load(`fx:phoenix:${fr}`, () => A.fxSprite('phoenix', fr), 120, 120));
      if (types.has('titan_boulder')) { jobs.push(load('fx:boulder', () => A.fxSprite('boulder', 0), 120, 120)); jobs.push(load('fx:ironball', () => A.fxSprite('ironball', 0), 120, 120)); }
    }
    const enemies = new Set();
    for (const w of RG.grid.parseWaves(game.def.waves || [])) for (const g of w.groups) enemies.add(g.e);
    if (game.opts.mode === 'endless') for (const e of RG.data.regionPools[game.def.region] || []) enemies.add(e);
    // 분열·소환으로 나오는 적
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
    for (const e of enemies) {
      const big = (RG.data.enemies[e] && RG.data.enemies[e].size >= 1.4) ? 288 : 168;
      for (const f of (A.ENEMY_FRAMES || ['walk0', 'walk2'])) jobs.push(load(enemyKey(e, f), () => A.enemy(e, f), big, big));
    }
    for (const id of RG.data.heroOrder) {
      if (game.opts.heroId !== id) continue;
      for (const p of (A.HERO_POSES || ['idle0'])) jobs.push(load(heroKey(id, p), () => A.hero(id, p), 160, 160));
      // 토리: 거인 변신 그림도 미리 (크게)
      const hd = RG.data.heroes[id];
      if (hd && hd.skill && hd.skill.giant) for (const p of (A.HERO_POSES || ['idle0'])) jobs.push(load(heroKey(`${id}_giant`, p), () => A.hero(`${id}_giant`, p), 256, 256));
    }
    const heroSkill = game.opts.heroId && RG.data.heroes[game.opts.heroId] && RG.data.heroes[game.opts.heroId].skill;
    const unitKinds = ['stone_soldier', 'granite_guard', 'obsidian_blade', 'drone', 'rock_wall'];
    if (heroSkill && heroSkill.snowman) unitKinds.push('snowman');
    for (const k of unitKinds) {
      for (const p of (A.UNIT_POSES || ['idle', 'attack'])) jobs.push(load(unitKey(k, p), () => A.unit(k, p), 128, 128));
    }
    for (const s of LANTERN_STEPS) jobs.push(load(`lantern:${s}`, () => A.lantern(s), TW, TH));
    return Promise.all(jobs);
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

  return { sized, load, get, ensure, TW, TH, towerKey, enemyKey, heroKey, unitKey, lanternKey, prepareForGame, dataUrl, LANTERN_STEPS };
})();
