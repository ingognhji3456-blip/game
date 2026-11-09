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

  function toCanvas(svg, w, h) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        const ctx = cv.getContext('2d');
        try { ctx.drawImage(img, 0, 0, w, h); } catch (e) { /* 무시 */ }
        resolve(cv);
      };
      img.onerror = () => resolve(null);
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(sized(svg, w, h))}`;
    });
  }

  /** key로 그림을 준비. make()는 SVG 문자열을 돌려줌 */
  function load(key, make, w, h) {
    if (cache.has(key)) return Promise.resolve(cache.get(key));
    if (loading.has(key)) return loading.get(key);
    let svg;
    try { svg = make(); } catch (e) { svg = null; }
    if (!svg) { cache.set(key, null); return Promise.resolve(null); }
    const p = toCanvas(svg, w, h).then((cv) => {
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

  function towerKey(type, level, branch) { return `tower:${type}:${level}:${branch || ''}`; }
  function enemyKey(type, frame) { return `enemy:${type}:${frame}`; }
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
    for (const t of types) {
      for (const lv of [1, 2, 3]) jobs.push(load(towerKey(t, lv, null), () => A.tower(t, lv, null), TW, TH));
      for (const b of ['A', 'B']) jobs.push(load(towerKey(t, 4, b), () => A.tower(t, 4, b), TW, TH));
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
      for (const f of [0, 1]) jobs.push(load(enemyKey(e, f), () => A.enemy(e, f), big, big));
    }
    for (const id of RG.data.heroOrder) {
      if (game.opts.heroId !== id) continue;
      for (const p of ['idle', 'walk1', 'walk2', 'attack']) jobs.push(load(heroKey(id, p), () => A.hero(id, p), 160, 160));
    }
    for (const k of ['stone_soldier', 'granite_guard', 'obsidian_blade', 'drone', 'rock_wall']) {
      for (const p of ['idle', 'attack']) jobs.push(load(unitKey(k, p), () => A.unit(k, p), 128, 128));
    }
    for (const s of LANTERN_STEPS) jobs.push(load(`lantern:${s}`, () => A.lantern(s), TW, TH));
    return Promise.all(jobs);
  }

  /** 건설 메뉴 등 DOM용 작은 그림 (data URL) */
  function dataUrl(svg) {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }

  return { sized, load, get, towerKey, enemyKey, heroKey, unitKey, lanternKey, prepareForGame, dataUrl, LANTERN_STEPS };
})();
