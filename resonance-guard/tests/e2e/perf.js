'use strict';

/*
 * 화면 성능 (QUALITY.md §7)
 *   node tests/e2e/perf.js [--dist] [--rate N] [--only start|load|full]
 * - 시작 시간: 주소를 연 뒤 타이틀(그림 준비 포함)이 뜰 때까지
 * - 데스크톱: 부하 맵(탑 40 + 적 300) 3배속 5초 평균 fps (기준 55 이상)
 * - 휴대폰 가로 + CPU 4배 느리게: 같은 부하 평균 fps (기준 30 이상)
 * - 꽉 찬 판: 공명석 웨이브 어려움(C3) 짓는 칸 88개를 모두 채운 후반 웨이브(탑 88 Lv2·3 + 적 40),
 *   데스크톱(기준 55 이상)과 휴대폰 가로·CPU 4배 느리게(기준 30fps 이상·2배 이상) — 탑이 많을수록 느려지던 문제를 지킴
 * 다른 무거운 작업이 함께 돌면 숫자가 낮게 나옵니다.
 */
const path = require('path');
const { chromium, devices } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const file = process.argv.includes('--dist') ? 'dist/resonance-guard.html' : 'index.html';
// --rate N: 휴대폰 시험의 CPU 느리게 배수(기본 4). 더 느린 기기를 흉내 내 여유를 확인할 때
const RATE = process.argv.includes('--rate') ? +process.argv[process.argv.indexOf('--rate') + 1] : 4;
const URL = `file://${path.join(ROOT, file)}`;
// --only start|load|full: 그 시험만 (start = 시작 시간, load = 탑 40 + 적 300, full = 꽉 찬 판)
const ONLY = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;
const want = (k) => !ONLY || ONLY === k;

async function loadFps(page) {
  // 'load'까지 기다리면 판 그림 준비(그림 수백 장)가 끝나야 해서 CPU를 느리게 하면 30초를 넘기기도 했음 — 문서만 읽히면 넘어가고 판 준비를 따로 기다림
  await page.goto(`${URL}?screen=game&map=5-5&hero=zena`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => RG.ui.game.game && !document.querySelector('#screen-game').classList.contains('loading'), null, { timeout: 60000 });
  await page.waitForTimeout(800);
  return page.evaluate(async () => {
    RG.ui.closeAllModals();
    const ui = RG.ui.game; const g = ui.game; g.state.gold = 1e6;
    // 측정 중 판이 끝나지 않게 (예전 시험은 적이 새어 2초 만에 패배 → 멈춘 화면을 재는 꼴이었음)
    g.state.lives = g.state.maxLives = 1e9;
    let n = 0;
    // 이 판에서 지을 수 있는 탑만 차례로 (맵보다 늦게 열리는 탑은 짓기가 실패해 탑 수가 줄었음)
    const types = RG.data.towerOrder.filter((t) => !g.opts.towers || g.opts.towers.includes(t));
    for (let r = 0; r < g.map.rows && n < 40; r++) for (let c = 0; c < g.map.cols && n < 40; c++) if (ui.doCmd({ type: 'build', tower: types[n % types.length], c, r }, true).ok) n++;
    ui.doCmd({ type: 'callWave' }, true);
    const pool = ['mist_rat', 'ash_boar', 'frost_wolf', 'spray_sprite', 'rock_crab', 'echo_shade'];
    // 실제 판에서는 그 맵의 적 그림(모든 동작)을 불러오는 화면에서 미리 준비함(sprites.prepareForGame).
    // 이 시험은 맵에 없는 적을 부르므로 같은 방식으로 미리 준비해, 첫 등장 때 그림을 만드는 시간 대신 실제 전투 부하를 잽니다.
    const S = RG.art.sprites;
    await Promise.all(pool.flatMap((e) => RG.art.ENEMY_FRAMES.map((f) => S.load(S.enemyKey(e, f), () => RG.art.enemy(e, f), 168, 168))));
    // 길이 긴 후반 맵(5-5, 길 59칸)에서 적을 입구에 몰지 않고 길을 따라 흩어 둠 — 측정 동안 거의 새지 않음 (5-6은 길이 9칸이라 2초 만에 다 새어 판이 끝났음)
    for (let i = 0; i < 300; i++) { const e = g.api.spawnEnemy(pool[i % pool.length], i % 3); e.hp = e.maxHp = 1e9; g.api.advance(e, (i * 7) % 20); }
    ui.setSpeed(3);
    await new Promise((r) => setTimeout(r, 1000));
    let frames = 0; const t0 = performance.now(); const tick0 = g.state.tick;
    await new Promise((resolve) => { const f = () => { frames++; if (performance.now() - t0 < 5000) requestAnimationFrame(f); else resolve(); }; requestAnimationFrame(f); });
    const secs = (performance.now() - t0) / 1000;
    // 실제 판 속도: 아주 느리면 한 프레임의 시뮬 시간 상한 때문에 3배속보다 느리게 흐름(game.js SIM_BUDGET_MS) — 숨기지 않고 함께 적음
    const speed = (g.state.tick - tick0) / secs / 30;
    return { fps: Math.round(frames / secs), speed: Math.round(speed * 10) / 10, enemies: g.state.enemies.filter((e) => !e.dead && !e.leaked).length, towers: g.state.towers.length, running: !g.state.result };
  });
}

/*
 * 꽉 찬 판: 긴 판 끝의 공명석 웨이브 어려움처럼 짓는 칸 88개에 탑을 모두 짓고(여러 종류, Lv2 + 다섯 개 중 하나는 Lv3),
 * 후반 웨이브처럼 적 40마리를 길에 흩어 둠. 탑 수가 비용을 좌우함 — 예전엔 탑 88개면 휴대폰에서 30fps 아래로 떨어졌음
 * (적이 공명을 끊을 때마다 탑 그림자 층 전체를 다시 그렸음).
 */
async function fullBoardFps(page) {
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.RG && RG.ui && RG.crystal);
  await page.evaluate(() => {
    // 가진 탑을 모두 쓰는 공명석 판 설정 (뽑기 기록과 상관없이 모든 탑)
    const opts = Object.assign({ mode: 'normal', heroId: 'zena', seed: 1, towers: RG.data.towerOrder.slice(), finalLv2: true, branches: true }, RG.crystal.setup(3));
    RG.ui.show('game', { opts });
  });
  await page.waitForFunction(() => RG.ui.game.game && !document.querySelector('#screen-game').classList.contains('loading'), null, { timeout: 60000 });
  await page.waitForTimeout(800);
  return page.evaluate(async () => {
    RG.ui.closeAllModals();
    const ui = RG.ui.game; const g = ui.game; g.state.gold = 1e9;
    g.state.lives = g.state.maxLives = 1e9;
    const types = RG.data.towerOrder.filter((t) => !g.opts.towers || g.opts.towers.includes(t));
    const ids = [];
    for (let r = 0; r < g.map.rows; r++) for (let c = 0; c < g.map.cols; c++) {
      const res = ui.doCmd({ type: 'build', tower: types[ids.length % types.length], c, r }, true);
      if (res.ok) ids.push(res.id);
    }
    ids.forEach((id, i) => { ui.doCmd({ type: 'upgrade', id }, true); if (i % 5 === 2) ui.doCmd({ type: 'upgrade', id }, true); });
    ui.doCmd({ type: 'callWave' }, true);
    const S = RG.art.sprites;
    const pool = RG.crystal.pool(3);
    // 실제 긴 판에서는 Lv2·3의 동작 자세 그림이 마지막 웨이브보다 훨씬 먼저 준비됨 — 적 그림과 같이 미리 준비해 전투 부하만 잼
    const jobs = [];
    for (const e of pool) for (const f of RG.art.ENEMY_FRAMES) jobs.push(S.load(S.enemyKey(e, f), () => RG.art.enemy(e, f), 168, 168));
    for (const t of g.state.towers) for (const p of ['aim', 'fire']) jobs.push(S.load(S.towerKey(t.type, t.level, t.branch, p), () => RG.art.tower(t.type, t.level, t.branch, p), S.TW, S.TH));
    await Promise.all(jobs);
    for (let i = 0; i < 40; i++) { const e = g.api.spawnEnemy(pool[i % pool.length], i % g.map.spawns.length); e.hp = e.maxHp = 1e9; g.api.advance(e, 2 + (i * 7) % 40); }
    ui.setSpeed(3);
    await new Promise((r) => setTimeout(r, 1000));
    let frames = 0; const t0 = performance.now(); const tick0 = g.state.tick;
    await new Promise((resolve) => { const f = () => { frames++; if (performance.now() - t0 < 5000) requestAnimationFrame(f); else resolve(); }; requestAnimationFrame(f); });
    const secs = (performance.now() - t0) / 1000;
    const speed = (g.state.tick - tick0) / secs / 30;
    const lv3 = g.state.towers.filter((t) => t.level >= 3).length;
    return { fps: Math.round(frames / secs), speed: Math.round(speed * 10) / 10, enemies: g.state.enemies.filter((e) => !e.dead && !e.leaked).length, towers: g.state.towers.length, lv3, running: !g.state.result };
  });
}

(async () => {
  const browser = await chromium.launch();
  const out = [];
  let fail = 0;
  // 시작 시간
  if (want('start')) {
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
  if (want('load')) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const r = await loadFps(page);
    const ok = r.fps >= 55 && r.speed >= 2.8 && r.running && r.enemies >= 200;
    if (!ok) fail++;
    out.push(`${ok ? '✓' : '✗'} 데스크톱 3배속 부하(탑 ${r.towers}, 적 ${r.enemies}): ${r.fps}fps, 실제 판 속도 ${r.speed}배 (기준 55 이상)`);
    await page.close();
  }
  // 휴대폰 가로 + CPU 4배 느리게
  if (want('load')) {
    const ctx = await browser.newContext({ ...devices['Pixel 7 landscape'] });
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: RATE });
    const r = await loadFps(page);
    // 판 속도가 너무 느려져서 fps를 번 것이면 실패 (2배속 이상은 유지해야 함)
    const ok = r.fps >= 30 && r.speed >= 2 && r.running && r.enemies >= 200;
    if (!ok) fail++;
    out.push(`${ok ? '✓' : '✗'} 휴대폰 가로·CPU ${RATE}배 느리게 3배속 부하(탑 ${r.towers}, 적 ${r.enemies}): ${r.fps}fps, 실제 판 속도 ${r.speed}배 (기준 30fps 이상·2배 이상)`);
    await ctx.close();
  }
  // 꽉 찬 판 — 데스크톱
  if (want('full')) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const r = await fullBoardFps(page);
    const ok = r.fps >= 55 && r.speed >= 2.8 && r.running && r.towers >= 85 && r.enemies >= 30;
    if (!ok) fail++;
    out.push(`${ok ? '✓' : '✗'} 데스크톱 꽉 찬 판 3배속(탑 ${r.towers}·Lv3 ${r.lv3}, 적 ${r.enemies}): ${r.fps}fps, 실제 판 속도 ${r.speed}배 (기준 55 이상)`);
    await page.close();
  }
  // 꽉 찬 판 — 휴대폰 가로 + CPU 4배 느리게
  if (want('full')) {
    const ctx = await browser.newContext({ ...devices['Pixel 7 landscape'] });
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: RATE });
    const r = await fullBoardFps(page);
    const ok = r.fps >= 30 && r.speed >= 2 && r.running && r.towers >= 85 && r.enemies >= 30;
    if (!ok) fail++;
    out.push(`${ok ? '✓' : '✗'} 휴대폰 가로·CPU ${RATE}배 느리게 꽉 찬 판 3배속(탑 ${r.towers}·Lv3 ${r.lv3}, 적 ${r.enemies}): ${r.fps}fps, 실제 판 속도 ${r.speed}배 (기준 30fps 이상·2배 이상)`);
    await ctx.close();
  }
  await browser.close();
  console.log(out.join('\n'));
  process.exitCode = fail ? 1 : 0;
})();
