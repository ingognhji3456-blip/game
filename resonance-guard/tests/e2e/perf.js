'use strict';

/*
 * 화면 성능 (QUALITY.md §7)
 *   node tests/e2e/perf.js [--dist]
 * - 시작 시간: 주소를 연 뒤 타이틀(그림 준비 포함)이 뜰 때까지
 * - 데스크톱: 부하 맵(탑 40 + 적 300) 3배속 5초 평균 fps (기준 55 이상)
 * - 휴대폰 가로 + CPU 4배 느리게: 같은 부하 평균 fps (기준 30 이상)
 * 다른 무거운 작업이 함께 돌면 숫자가 낮게 나옵니다.
 */
const path = require('path');
const { chromium, devices } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const file = process.argv.includes('--dist') ? 'dist/resonance-guard.html' : 'index.html';
const URL = `file://${path.join(ROOT, file)}`;

async function loadFps(page) {
  await page.goto(`${URL}?screen=game&map=5-6&hero=zena`);
  await page.waitForFunction(() => RG.ui.game.game && !document.querySelector('#screen-game').classList.contains('loading'));
  await page.waitForTimeout(800);
  return page.evaluate(async () => {
    RG.ui.closeAllModals();
    const ui = RG.ui.game; const g = ui.game; g.state.gold = 1e6;
    let n = 0;
    for (let r = 0; r < g.map.rows && n < 40; r++) for (let c = 0; c < g.map.cols && n < 40; c++) if (ui.doCmd({ type: 'build', tower: RG.data.towerOrder[n % 18], c, r }, true).ok) n++;
    ui.doCmd({ type: 'callWave' }, true);
    const pool = ['mist_rat', 'ash_boar', 'frost_wolf', 'spray_sprite', 'rock_crab', 'echo_shade'];
    // 실제 판에서는 그 맵의 적 그림(모든 동작)을 불러오는 화면에서 미리 준비함(sprites.prepareForGame).
    // 이 시험은 맵에 없는 적을 부르므로 같은 방식으로 미리 준비해, 첫 등장 때 그림을 만드는 시간 대신 실제 전투 부하를 잽니다.
    const S = RG.art.sprites;
    await Promise.all(pool.flatMap((e) => RG.art.ENEMY_FRAMES.map((f) => S.load(S.enemyKey(e, f), () => RG.art.enemy(e, f), 168, 168))));
    for (let i = 0; i < 300; i++) { const e = g.api.spawnEnemy(pool[i % pool.length], i % 3); e.hp = e.maxHp = 1e9; }
    ui.setSpeed(3);
    await new Promise((r) => setTimeout(r, 1000));
    let frames = 0; const t0 = performance.now();
    await new Promise((resolve) => { const f = () => { frames++; if (performance.now() - t0 < 5000) requestAnimationFrame(f); else resolve(); }; requestAnimationFrame(f); });
    return { fps: Math.round(frames / ((performance.now() - t0) / 1000)), enemies: g.state.enemies.filter((e) => !e.dead).length, towers: g.state.towers.length };
  });
}

(async () => {
  const browser = await chromium.launch();
  const out = [];
  let fail = 0;
  // 시작 시간
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const t0 = Date.now();
    await page.goto(URL);
    await page.waitForSelector('#screen-title.active .title-menu .btn-primary');
    const ms = Date.now() - t0;
    const ok = ms <= 3000;
    if (!ok) fail++;
    out.push(`${ok ? '✓' : '✗'} 시작 시간 ${ms}ms (기준 3000ms 이하)`);
    await page.close();
  }
  // 데스크톱
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const r = await loadFps(page);
    const ok = r.fps >= 55;
    if (!ok) fail++;
    out.push(`${ok ? '✓' : '✗'} 데스크톱 3배속 부하(탑 ${r.towers}, 적 ${r.enemies}): ${r.fps}fps (기준 55 이상)`);
    await page.close();
  }
  // 휴대폰 가로 + CPU 4배 느리게
  {
    const ctx = await browser.newContext({ ...devices['Pixel 7 landscape'] });
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const r = await loadFps(page);
    const ok = r.fps >= 30;
    if (!ok) fail++;
    out.push(`${ok ? '✓' : '✗'} 휴대폰 가로·CPU 4배 느리게 3배속 부하(탑 ${r.towers}, 적 ${r.enemies}): ${r.fps}fps (기준 30 이상)`);
    await ctx.close();
  }
  await browser.close();
  console.log(out.join('\n'));
  process.exitCode = fail ? 1 : 0;
})();
