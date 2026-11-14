'use strict';

/*
 * 화면 검사 — 모든 주요 화면을 데스크톱·휴대폰 가로·휴대폰 세로로 캡처하고 콘솔 오류를 모읍니다.
 *   node tests/e2e/screens.js [--only desktop]
 * 결과: docs/reports/screens/<크기>/<화면>.png, 콘솔 오류는 종료 코드 1
 */
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.join(ROOT, 'docs', 'reports', 'screens');
const URL = `file://${path.join(ROOT, process.argv.includes('--dist') ? 'dist/resonance-guard.html' : 'index.html')}`;
const SIZES = {
  desktop: { width: 1280, height: 800 },
  phoneLand: { width: 844, height: 390, isMobile: true, hasTouch: true },
  phonePort: { width: 390, height: 844, isMobile: true, hasTouch: true },
};

async function shot(page, dir, name) {
  await page.waitForTimeout(350);
  await page.screenshot({ path: path.join(dir, `${name}.png`) });
}

async function checkLayout(page, label, issues) {
  // 휴대폰은 손가락 기준 최소 40px (QUALITY.md §5), 데스크톱은 30px
  const min = /^phone/.test(label) ? 40 : 30;
  const res = await page.evaluate((min) => {
    const out = [];
    const docW = document.documentElement.clientWidth;
    if (document.documentElement.scrollWidth > docW + 1) out.push(`가로 스크롤 (${document.documentElement.scrollWidth} > ${docW})`);
    const active = document.querySelector('.screen.active') || document.body;
    for (const b of active.querySelectorAll('button')) {
      const r = b.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const cs = getComputedStyle(b);
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      if (r.width < min || r.height < min) out.push(`작은 버튼 "${(b.textContent || b.title || b.getAttribute('aria-label') || b.className || '').trim().slice(0, 18)}" ${Math.round(r.width)}×${Math.round(r.height)}`);
    }
    // 겹치면 안 되는 것: 출정 준비의 지도 미리보기 ↔ 정보 칸, 월드 지도의 설명 판 ↔ 맵 메달
    const box = (e) => e.getBoundingClientRect();
    const overlap = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
    const pv = active.querySelector('.brief-preview');
    const inf = active.querySelector('.brief-info');
    if (pv && inf && overlap(box(pv), box(inf)) > 4) out.push('출정 준비: 정보 칸이 지도 미리보기와 겹침');
    const plate = active.querySelector('.wm-plate');
    if (plate && getComputedStyle(plate).display !== 'none') {
      for (const n of active.querySelectorAll('.map-node .mn-medal')) {
        if (overlap(box(plate), box(n)) > 4) { out.push(`월드 지도: 설명 판이 메달 "${n.textContent.trim().slice(0, 6)}"을 가림`); break; }
      }
    }
    return out.slice(0, 12);
  }, min);
  for (const r of res) issues.push(`${label}: ${r}`);
}

async function run() {
  const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;
  const browser = await chromium.launch();
  const errors = [];
  const issues = [];
  for (const [sizeName, vp] of Object.entries(SIZES)) {
    if (only && only !== sizeName) continue;
    const dir = path.join(OUT, sizeName);
    fs.mkdirSync(dir, { recursive: true });
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1, isMobile: !!vp.isMobile, hasTouch: !!vp.hasTouch });
    const page = await ctx.newPage();
    page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${sizeName}] ${m.type()}: ${m.text()}`); });
    page.on('pageerror', (e) => errors.push(`[${sizeName}] pageerror: ${e.message}`));
    await page.goto(URL);
    await page.waitForTimeout(500);
    await shot(page, dir, '01-title'); await checkLayout(page, `${sizeName}/title`, issues);
    await page.evaluate(() => RG.ui.show('world', { view: 'regions' }));
    await page.waitForTimeout(700);
    await shot(page, dir, '02a-regions'); await checkLayout(page, `${sizeName}/regions`, issues);
    await page.evaluate(() => RG.ui.show('world', {}));
    await shot(page, dir, '02-world'); await checkLayout(page, `${sizeName}/world`, issues);
    await page.evaluate(() => RG.ui.show('brief', { mapId: '1-1' }));
    await shot(page, dir, '03-brief'); await checkLayout(page, `${sizeName}/brief`, issues);
    await page.evaluate(() => RG.ui.show('story', { id: 'prologue', then: () => RG.ui.show('world', {}) }));
    await page.waitForTimeout(900);
    await shot(page, dir, '04-story');
    // 첫 판 단계별 안내 (처음 기록이라 1-1에서 나옴)
    await page.evaluate(() => RG.ui.show('game', { opts: { mapId: '1-1', heroId: 'kara', seed: 3, mode: 'normal', towers: RG.progress.towersFor('1-1'), branches: false } }));
    await page.waitForFunction(() => RG.ui.tutorial.active, null, { timeout: 6000 }).catch(() => issues.push(`${sizeName}/tutorial: 첫 판 안내가 나오지 않음`));
    await page.waitForTimeout(400);
    await shot(page, dir, '04a-tutorial'); await checkLayout(page, `${sizeName}/tutorial`, issues);
    // 전투: 1-2, 탑 몇 개 짓고 진행
    await page.evaluate(() => {
      RG.progress.markSeen('tips', 'resonance'); RG.progress.markSeen('tips', 'flying');
      RG.ui.show('game', { opts: { mapId: '1-2', heroId: 'kara', seed: 3, mode: 'normal', towers: ['ember_archer', 'stone_barracks', 'frost_crystal'], branches: true } });
    });
    await page.waitForTimeout(1500);
    await shot(page, dir, '05-game-prep'); await checkLayout(page, `${sizeName}/game`, issues);
    await page.evaluate(() => {
      const ui = RG.ui.game;
      ui.doCmd({ type: 'build', tower: 'ember_archer', c: 6, r: 3 });
      ui.doCmd({ type: 'build', tower: 'frost_crystal', c: 7, r: 3 });
      ui.doCmd({ type: 'build', tower: 'stone_barracks', c: 8, r: 3 });
      ui.doCmd({ type: 'callWave' });
    });
    await page.waitForTimeout(6000);
    await shot(page, dir, '06-game-wave');
    // 탑 목록에서 탑을 고르고 맵 위에 올린 모습 (놓기 모드: 미리보기·사거리·공명 선·이름표)
    await page.evaluate(() => {
      RG.ui.game.game.state.gold += 200; // 지을 수 있는(초록) 미리보기를 찍으려고
      document.querySelector('.tower-card').click();
      const p = RG.render.worldToScreen(6.5, 4.5);
      const cv = document.querySelector('.game-canvas');
      const r = cv.getBoundingClientRect();
      cv.dispatchEvent(new PointerEvent('pointermove', { clientX: r.left + p.x, clientY: r.top + p.y, bubbles: true, pointerType: 'mouse' }));
    });
    await shot(page, dir, '07-placing'); await checkLayout(page, `${sizeName}/placing`, issues);
    const ghost = await page.evaluate(() => { const g = RG.render.overlay.ghost; return g ? `${g.type}@${g.c},${g.r} ${g.ok ? '가능' : '불가'}` : null; });
    if (!ghost) issues.push(`${sizeName}/placing: 놓기 미리보기가 없음`);
    // 탑 눌러 정보 창 (먼저 Esc로 놓기 모드를 끝냄)
    await page.keyboard.press('Escape');
    await page.evaluate(() => {
      const p = RG.render.worldToScreen(6.5, 3.5);
      const cv = document.querySelector('.game-canvas');
      const r = cv.getBoundingClientRect();
      const opt = { clientX: r.left + p.x, clientY: r.top + p.y, bubbles: true, pointerType: 'mouse' };
      cv.dispatchEvent(new PointerEvent('pointerdown', opt));
      cv.dispatchEvent(new PointerEvent('pointerup', opt));
    });
    await shot(page, dir, '08-tower-panel'); await checkLayout(page, `${sizeName}/tower`, issues);
    await page.evaluate(() => RG.ui.show('result', {
      mapId: '1-2', mode: 'normal', result: 'win', lives: 11, maxLives: 12, task: { done: true }, rec: { stars: 3, newStars: 5, unlocks: { towers: [], heroes: [], maps: ['1-3'], branches: false }, reward: { crystals: 265, pooled: ['flame_mortar'], lines: [['승리', 15], ['첫 클리어', 100], ['새 별 ★5', 150]] } },
      stats: { damage: {}, kills: 50, gold: 900, heroDamage: 0, towers: [], time: 300 }, opts: { heroId: 'kara', mode: 'normal' }, waves: 8,
    }));
    await shot(page, dir, '09-result'); await checkLayout(page, `${sizeName}/result`, issues);
    for (const [id, name] of [['codex', '10-codex'], ['heroes', '11-heroes'], ['tree', '12-tree']]) {
      await page.evaluate((s) => RG.ui.show(s, {}), id);
      await shot(page, dir, name); await checkLayout(page, `${sizeName}/${id}`, issues);
    }
    // 탑 뽑기: 모음 화면 + 10회 결과(카드 모두 연 뒤)
    await page.evaluate(() => { const g = RG.progress.gachaState(); g.crystals = 1800; RG.progress.save(); RG.ui.show('gacha', {}); });
    await page.waitForTimeout(400);
    await shot(page, dir, '13-gacha'); await checkLayout(page, `${sizeName}/gacha`, issues);
    await page.evaluate(() => { Math.random = (() => { let s = 7; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })(); document.querySelector('.gc-ten').click(); });
    await page.waitForTimeout(300);
    await page.evaluate(() => document.querySelector('.gc-skip').click());
    await page.waitForTimeout(700);
    await shot(page, dir, '14-gacha-result'); await checkLayout(page, `${sizeName}/gacha-result`, issues);
    // 6지역 "별울림 첨탑": 지역 지도, 별다리 맵 준비, 전투(별다리·별빛 건설지·새 적), 보스, 6막 이야기
    await page.evaluate(() => {
      const st = { result: 'win', lives: 12, task: { done: true }, wave: { index: 20 } };
      for (const m of RG.data.maps) { if (m.region >= 6) break; RG.progress.record(m.id, 'normal', st); }
      for (const k of Object.keys(RG.data.story)) RG.progress.markSeen('story', k);
      for (const m of RG.data.maps) for (const t of m.tips || []) RG.progress.markSeen('tips', t);
      RG.progress.save();
      RG.ui.show('world', { region: 6 });
    });
    await page.waitForTimeout(500);
    await shot(page, dir, '15-r6-world'); await checkLayout(page, `${sizeName}/r6-world`, issues);
    await page.evaluate(() => RG.ui.show('brief', { mapId: '6-2' }));
    await shot(page, dir, '16-r6-brief'); await checkLayout(page, `${sizeName}/r6-brief`, issues);
    await page.evaluate(() => RG.ui.show('story', { id: 's6_1', then: () => RG.ui.show('world', {}) }));
    await page.waitForTimeout(900);
    await shot(page, dir, '17-r6-story');
    await page.evaluate(() => {
      RG.ui.show('game', { opts: { mapId: '6-2', heroId: 'dohan', seed: 3, mode: 'normal', towers: RG.progress.towersFor('6-2'), branches: true } });
    });
    await page.waitForTimeout(1500);
    await page.evaluate(() => {
      const ui = RG.ui.game; const g = ui.game;
      RG.ui.closeAllModals();
      g.state.gold = 6000;
      const m = g.map; let n = 0;
      const kinds = [RG.grid.T.BUILD, RG.grid.T.STAR];
      for (let r = 0; r < m.rows && n < 9; r++) for (let c = 0; c < m.cols && n < 9; c++) {
        if (kinds.includes(m.kinds[r * m.cols + c])) { const t = g.opts.towers[(n * 5) % g.opts.towers.length]; if (ui.doCmd({ type: 'build', tower: t, c, r }, true).ok) n++; }
      }
      ui.doCmd({ type: 'callWave' }, true);
      for (const t of ['cloud_sheep', 'comet_knight', 'phase_wraith', 'nebula_jelly']) g.api.spawnEnemy(t, 0);
      ui.setSpeed(2);
    });
    await page.waitForTimeout(5000);
    await page.evaluate(() => RG.ui.game.setSpeed(1));
    await shot(page, dir, '18-r6-battle'); await checkLayout(page, `${sizeName}/r6-battle`, issues);
    await page.evaluate(() => {
      RG.ui.show('game', { opts: { mapId: '6-6', heroId: 'mujin', seed: 3, mode: 'normal', towers: RG.progress.towersFor('6-6'), branches: true } });
    });
    await page.waitForTimeout(1500);
    await page.evaluate(() => {
      const ui = RG.ui.game; const g = ui.game;
      RG.ui.closeAllModals();
      ui.doCmd({ type: 'callWave' }, true);
      const e = g.api.spawnEnemy('gloom_monarch', 0);
      e.hp = e.maxHp * 0.8; // 70% 아래면 2단계(나방 소환) 알림이 겹쳐 찍힘
      ui.setSpeed(2);
    });
    await page.waitForTimeout(1200);
    await shot(page, dir, '19-r6-boss'); await checkLayout(page, `${sizeName}/r6-boss`, issues);
    // 조각 레이드: 레이드 화면(공격 탑·지원 탑), 레이드 판, 레이드 결과 (js/ui/raid.js)
    await page.evaluate(() => {
      const P = RG.progress;
      const g = P.gachaState(); for (const t of ['flame_mortar', 'sanctuary', 'ice_ballista', 'shadow_dragon']) g.owned[t] = 0;
      P.get().shards.ember_archer = 26; P.get().shardLv.ember_archer = 2; P.get().raid.ember_archer = 2; P.get().shards.sanctuary = 4;
      P.save();
      RG.ui.show('raid', { tower: 'ember_archer' });
    });
    await page.waitForTimeout(500);
    await shot(page, dir, '20-raid'); await checkLayout(page, `${sizeName}/raid`, issues);
    await page.evaluate(() => RG.ui.show('raid', { tower: 'sanctuary' }));
    await page.waitForTimeout(300);
    await shot(page, dir, '20a-raid-support'); await checkLayout(page, `${sizeName}/raid-support`, issues);
    await page.evaluate(() => RG.ui.show('game', { opts: RG.ui.raidOpts('ember_archer', 3, 'kara') }));
    await page.waitForTimeout(1500);
    await page.evaluate(() => {
      const ui = RG.ui.game; const g = ui.game;
      RG.ui.closeAllModals();
      g.state.gold = 2000;
      const m = g.map; let n = 0;
      for (let r = 0; r < m.rows && n < 6; r++) for (let c = 0; c < m.cols && n < 6; c++) if (m.kinds[r * m.cols + c] === RG.grid.T.BUILD && ui.doCmd({ type: 'build', tower: 'ember_archer', c, r }, true).ok) n++;
      ui.doCmd({ type: 'callWave' }, true);
      ui.setSpeed(2);
    });
    await page.waitForTimeout(3000);
    await page.evaluate(() => RG.ui.game.setSpeed(1));
    await shot(page, dir, '20b-raid-battle'); await checkLayout(page, `${sizeName}/raid-battle`, issues);
    await page.evaluate(() => {
      const st = { result: 'win', wave: { index: 9, total: 9 }, hero: { heroId: 'kara' } };
      const rec = RG.progress.recordRaid('ember_archer', 3, st);
      RG.ui.show('result', { raid: { tower: 'ember_archer', d: 3 }, mapId: 'R2', mode: 'normal', result: 'win', rec, opts: { heroId: 'kara', mode: 'normal' }, waves: 9, totalWaves: 9, stats: { damage: {}, kills: 120, gold: 1400, heroDamage: 900, towers: [], time: 280 } });
    });
    await page.waitForTimeout(1800);
    await shot(page, dir, '20c-raid-result'); await checkLayout(page, `${sizeName}/raid-result`, issues);
    // 각성 (Lv5): 각성한 탑 셋 + 각성 카드가 보이는 탑 정보 창
    await page.evaluate(() => {
      RG.progress.get().shardLv = { ember_archer: 5, flame_mortar: 5, shadow_dragon: 5 }; RG.progress.save();
      RG.ui.show('game', { opts: { mapId: '3-2', heroId: 'kara', seed: 3, mode: 'normal', towers: RG.progress.ownedTowers(), branches: true, finalLv2: true, shardStart: true, shardLv: RG.progress.shardLevels() } });
    });
    await page.waitForTimeout(1500);
    await page.evaluate(() => {
      const ui = RG.ui.game; const g = ui.game; RG.ui.closeAllModals(); g.state.gold = 99999;
      const want = ['ember_archer', 'flame_mortar', 'shadow_dragon', 'ember_archer']; let n = 0;
      for (let r = 0; r < g.map.rows && n < want.length; r++) for (let c = 0; c < g.map.cols && n < want.length; c++) if (g.map.kinds[r * g.map.cols + c] === RG.grid.T.BUILD && ui.doCmd({ type: 'build', tower: want[n], c, r }, true).ok) n++;
      for (const t of g.state.towers) { for (let i = 0; i < 3; i++) g.cmd({ type: 'upgrade', id: t.id }); g.cmd({ type: 'branch', id: t.id, branch: 'B' }); }
      for (const t of g.state.towers.slice(0, 3)) g.cmd({ type: 'upgrade', id: t.id });
      ui.doCmd({ type: 'callWave' }, true); ui.setSpeed(2);
    });
    await page.waitForTimeout(2500);
    await page.evaluate(() => {
      RG.ui.game.setSpeed(1);
      const tw = RG.ui.game.game.state.towers; const t = tw.find((x) => x.level === 4) || tw[tw.length - 1]; const pt = RG.render.worldToScreen(t.c + 0.5, t.r + 0.5); const cv = document.querySelector('.game-canvas'); const bb = cv.getBoundingClientRect();
      const o = { clientX: bb.left + pt.x, clientY: bb.top + pt.y, bubbles: true, pointerType: 'mouse' }; cv.dispatchEvent(new PointerEvent('pointerdown', o)); cv.dispatchEvent(new PointerEvent('pointerup', o));
    });
    await page.waitForTimeout(400);
    await shot(page, dir, '20d-awaken-battle'); await checkLayout(page, `${sizeName}/awaken-battle`, issues);
    // 공명석 웨이브: 화면, 판(왼쪽 아래 공명석), 결과
    await page.evaluate(() => { RG.progress.get().crystalRun = { 1: 1 }; RG.progress.save(); RG.ui.show('crystal', { d: 2 }); });
    await page.waitForTimeout(500);
    await shot(page, dir, '21-crystal'); await checkLayout(page, `${sizeName}/crystal`, issues);
    await page.evaluate(() => RG.ui.show('game', { opts: RG.ui.crystalOpts(1, 'kara') }));
    await page.waitForTimeout(1500);
    await page.evaluate(() => {
      const ui = RG.ui.game; const g = ui.game; RG.ui.closeAllModals(); g.state.gold = 3000; let k = 0;
      for (let r = 0; r < g.map.rows && k < 7; r++) for (let c = 0; c < g.map.cols && k < 7; c++) if (g.map.kinds[r * g.map.cols + c] === RG.grid.T.BUILD && ui.doCmd({ type: 'build', tower: ['ember_archer', 'frost_crystal', 'stone_barracks'][k % 3], c, r }, true).ok) k++;
      ui.doCmd({ type: 'callWave' }, true); ui.setSpeed(2);
    });
    await page.waitForTimeout(3000);
    await page.evaluate(() => RG.ui.game.setSpeed(1));
    await shot(page, dir, '21a-crystal-battle'); await checkLayout(page, `${sizeName}/crystal-battle`, issues);
    await page.evaluate(() => {
      const rec = RG.progress.recordCrystal(1, { result: 'win', wave: { index: 20, total: 20, queue: [] }, enemies: [], hero: { heroId: 'kara' } });
      RG.ui.show('result', { crystal: { d: 1 }, mapId: 'C1', mode: 'normal', result: 'win', rec, opts: { heroId: 'kara', mode: 'normal' }, waves: 20, totalWaves: 20, stats: { damage: {}, kills: 90, gold: 900, heroDamage: 600, towers: [], time: 240 } });
    });
    await page.waitForTimeout(1800);
    await shot(page, dir, '21b-crystal-result'); await checkLayout(page, `${sizeName}/crystal-result`, issues);
    await ctx.close();
  }
  await browser.close();
  const uniq = [...new Set(errors)];
  if (uniq.length) console.log(`콘솔 오류·경고 ${uniq.length}개:\n  ${uniq.slice(0, 30).join('\n  ')}`);
  if (issues.length) console.log(`레이아웃 문제 ${issues.length}개:\n  ${[...new Set(issues)].slice(0, 40).join('\n  ')}`);
  console.log(`캡처 → ${path.relative(ROOT, OUT)}`);
  process.exitCode = uniq.length ? 1 : 0;
}
run().catch((e) => { console.error(e); process.exit(1); });
