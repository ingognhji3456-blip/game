'use strict';

/*
 * 실제 화면 흐름으로 1-1을 처음부터 끝까지 진행합니다 (타이틀 → 지도 → 준비 → 이야기 → 전투 → 결과 → 이야기 → 지도).
 *   node tests/e2e/play.js [--dist] [--map 1-1]
 */
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const file = process.argv.includes('--dist') ? 'dist/resonance-guard.html' : 'index.html';
const mapId = process.argv.includes('--map') ? process.argv[process.argv.indexOf('--map') + 1] : '1-1';

(async () => {
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}\n${e.stack}`));
  await page.goto(`file://${path.join(ROOT, file)}`);
  await page.waitForTimeout(400);
  // 타이틀 → 시작하기
  await page.click('.title-menu .btn-primary');
  await page.waitForTimeout(300);
  // 지도에서 맵 누르기 (앞선 맵은 디버그로 연다)
  await page.evaluate((id) => {
    const D = RG.data;
    for (const m of D.maps) { if (m.id === id) break; RG.progress.get().maps[m.id] = { cleared: true, stars: 3 }; }
    RG.progress.save();
    RG.ui.show('world', {});
  }, mapId);
  await page.waitForTimeout(300);
  await page.evaluate((id) => { [...document.querySelectorAll('.map-node')].find((n) => n.textContent.includes(id)).click(); }, mapId);
  await page.waitForTimeout(300);
  await page.click('.brief-actions .btn-primary');
  await page.waitForTimeout(500);
  // 이야기면 넘기기
  if (await page.$('#screen-story.active')) {
    for (let i = 0; i < 40 && await page.$('#screen-story.active'); i++) { await page.click('#screen-story'); await page.waitForTimeout(60); }
  }
  await page.waitForSelector('#screen-game.active');
  // 팁 닫기
  for (let i = 0; i < 6; i++) { const b = await page.$('.modal-buttons .btn-primary'); if (!b) break; await b.click(); await page.waitForTimeout(250); }
  // 자동 플레이: 배속 3, 1초마다 그리디 비슷하게 짓기·강화·호출
  await page.evaluate(() => {
    RG.ui.game.setSpeed(8);
    const loop = () => {
      const ui = RG.ui.game;
      const g = ui.game;
      if (!g || g.state.result) return;
      const st = g.state;
      const types = g.opts.towers;
      const m = g.map;
      // 길 옆 건설지 중 아직 비어 있는 곳
      const tiles = [];
      for (let r = 0; r < m.rows; r++) for (let c = 0; c < m.cols; c++) {
        if (m.kinds[r * m.cols + c] !== RG.grid.T.BUILD || g.tileTower(c, r)) continue;
        let near = 0;
        for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) { const k = m.kinds[(r + dr) * m.cols + (c + dc)]; if (k === RG.grid.T.PATH) near++; }
        tiles.push([near, c, r]);
      }
      tiles.sort((a, b) => b[0] - a[0]);
      const attack = types.filter((t) => RG.data.towers[t].role === 'attack');
      const t = attack[(st.towers.length) % attack.length];
      if (tiles.length && st.gold >= 100) ui.doCmd({ type: 'build', tower: t, c: tiles[0][1], r: tiles[0][2] }, true);
      else for (const tw of st.towers) if (tw.level < 3 && st.gold > 150) { ui.doCmd({ type: 'upgrade', id: tw.id }, true); break; }
      if (st.wave.index === 0 || (st.wave.countdown !== null && st.enemies.length < 3)) ui.doCmd({ type: 'callWave' }, true);
      setTimeout(loop, 700);
    };
    loop();
  });
  const t0 = Date.now();
  for (let i = 0; i < 60; i++) {
    if (await page.$('#screen-result.active')) break;
    await page.waitForTimeout(4000);
    const s = await page.evaluate(() => ({ scr: RG.ui.currentId(), modal: RG.ui.modalOpen(), loading: document.querySelector('#screen-game').classList.contains('loading'), tick: RG.ui.game.game && RG.ui.game.game.state.tick, wave: RG.ui.game.game && RG.ui.game.game.state.wave.index, lives: RG.ui.game.game && RG.ui.game.game.state.lives, towers: RG.ui.game.game && RG.ui.game.game.state.towers.length }));
    if (process.argv.includes('--verbose') || i % 5 === 4) console.log(JSON.stringify(s));
    if (s.modal) await page.evaluate(() => RG.ui.closeAllModals());
  }
  await page.waitForSelector('#screen-result.active', { timeout: 5000 });
  const res = await page.evaluate(() => document.querySelector('.result-box h2').textContent);
  await page.screenshot({ path: path.join(ROOT, 'docs', 'reports', 'screens', `play-${mapId}-result.png`) });
  // 결과 → 지도 (이야기 있으면 넘김)
  await page.evaluate(() => [...document.querySelectorAll('.result-buttons .btn')].find((b) => b.textContent.includes('월드')).click());
  await page.waitForTimeout(400);
  for (let i = 0; i < 40 && await page.$('#screen-story.active'); i++) { await page.click('#screen-story'); await page.waitForTimeout(60); }
  const onWorld = await page.$('#screen-world.active');
  const prog = await page.evaluate((id) => RG.progress.mapRec(id), mapId);
  await browser.close();
  console.log(`${mapId}: "${res}" (${Math.round((Date.now() - t0) / 1000)}초), 지도로 복귀 ${!!onWorld}, 기록 ${JSON.stringify(prog)}`);
  if (errors.length) { console.log(`콘솔 오류 ${errors.length}개:\n  ${errors.slice(0, 10).join('\n  ')}`); process.exitCode = 1; }
})().catch((e) => { console.error(e); process.exit(1); });
