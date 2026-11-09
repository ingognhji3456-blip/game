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
const URL = `file://${path.join(ROOT, 'index.html')}`;
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
  const res = await page.evaluate(() => {
    const out = [];
    const docW = document.documentElement.clientWidth;
    if (document.documentElement.scrollWidth > docW + 1) out.push(`가로 스크롤 (${document.documentElement.scrollWidth} > ${docW})`);
    const active = document.querySelector('.screen.active') || document.body;
    for (const b of active.querySelectorAll('button')) {
      const r = b.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const cs = getComputedStyle(b);
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      if (r.width < 30 || r.height < 30) out.push(`작은 버튼 "${(b.textContent || b.title || '').trim().slice(0, 14)}" ${Math.round(r.width)}×${Math.round(r.height)}`);
    }
    return out.slice(0, 8);
  });
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
    await page.evaluate(() => RG.ui.show('world', {}));
    await shot(page, dir, '02-world'); await checkLayout(page, `${sizeName}/world`, issues);
    await page.evaluate(() => RG.ui.show('brief', { mapId: '1-1' }));
    await shot(page, dir, '03-brief'); await checkLayout(page, `${sizeName}/brief`, issues);
    await page.evaluate(() => RG.ui.show('story', { id: 'prologue', then: () => RG.ui.show('world', {}) }));
    await page.waitForTimeout(900);
    await shot(page, dir, '04-story');
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
    // 빈 칸 눌러 건설 메뉴
    await page.evaluate(() => {
      const g = RG.ui.game.game;
      const p = RG.render.worldToScreen(6.5, 4.5);
      const cv = document.querySelector('.game-canvas');
      const r = cv.getBoundingClientRect();
      const opt = { clientX: r.left + p.x, clientY: r.top + p.y, bubbles: true, pointerType: 'mouse' };
      cv.dispatchEvent(new PointerEvent('pointerdown', opt));
      cv.dispatchEvent(new PointerEvent('pointerup', opt));
      return !!g;
    });
    await page.waitForTimeout(300);
    await page.evaluate(() => { const b = document.querySelector('.build-item'); if (b) b.click(); });
    await shot(page, dir, '07-build-menu'); await checkLayout(page, `${sizeName}/build`, issues);
    // 탑 눌러 정보 창
    await page.evaluate(() => {
      document.querySelector('.x-btn') && document.querySelector('.x-btn').click();
      const p = RG.render.worldToScreen(6.5, 3.5);
      const cv = document.querySelector('.game-canvas');
      const r = cv.getBoundingClientRect();
      const opt = { clientX: r.left + p.x, clientY: r.top + p.y, bubbles: true, pointerType: 'mouse' };
      cv.dispatchEvent(new PointerEvent('pointerdown', opt));
      cv.dispatchEvent(new PointerEvent('pointerup', opt));
    });
    await shot(page, dir, '08-tower-panel'); await checkLayout(page, `${sizeName}/tower`, issues);
    await page.evaluate(() => RG.ui.show('result', {
      mapId: '1-2', mode: 'normal', result: 'win', lives: 11, maxLives: 12, task: { done: true }, rec: { stars: 3, newStars: 5, unlocks: { towers: ['flame_mortar'], heroes: [], maps: ['1-3'], branches: false } },
      stats: { damage: {}, kills: 50, gold: 900, heroDamage: 0, towers: [], time: 300 }, opts: { heroId: 'kara', mode: 'normal' }, waves: 8,
    }));
    await shot(page, dir, '09-result'); await checkLayout(page, `${sizeName}/result`, issues);
    for (const [id, name] of [['codex', '10-codex'], ['heroes', '11-heroes'], ['tree', '12-tree']]) {
      await page.evaluate((s) => RG.ui.show(s, {}), id);
      await shot(page, dir, name); await checkLayout(page, `${sizeName}/${id}`, issues);
    }
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
