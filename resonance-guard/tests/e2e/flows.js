'use strict';

/*
 * 입력 방식별 한 판 + 이어하기 (QUALITY.md §5)
 *   node tests/e2e/flows.js [--dist] [--only keyboard|touch|resume]
 *
 * - keyboard: 방향키·Enter·숫자·U·Space·F만으로 1-1을 깬다 (마우스·터치 없음)
 * - touch:    휴대폰 가로(터치 에뮬레이션)에서 화면 두드리기만으로 1-1을 깬다
 * - resume:   판 도중 새로고침 → 타이틀의 "이어하기" → 같은 틱·같은 상태 해시
 *
 * 시험을 빨리 끝내려고 배속만 코드로 올립니다(입력은 전부 실제 키·터치 이벤트).
 */
const path = require('path');
const { chromium, devices } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const file = process.argv.includes('--dist') ? 'dist/resonance-guard.html' : 'index.html';
const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;
const URL = `file://${path.join(ROOT, file)}`;
const SHOTS = path.join(ROOT, 'docs', 'reports', 'screens');

/** 길에 가까운 빈 건설지 순서 (play.js와 같은 기준) */
function targetsInPage() {
  const g = RG.ui.game.game;
  const m = g.map;
  const out = [];
  for (let r = 0; r < m.rows; r++) for (let c = 0; c < m.cols; c++) {
    if (m.kinds[r * m.cols + c] !== RG.grid.T.BUILD || g.tileTower(c, r)) continue;
    let near = 0;
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) { const k = m.kinds[(r + dr) * m.cols + (c + dc)]; if (k === RG.grid.T.PATH) near++; }
    out.push({ near, c, r });
  }
  return out.sort((a, b) => b.near - a.near || a.r - b.r || a.c - b.c);
}

const state = (page) => page.evaluate(() => {
  const g = RG.ui.game.game;
  return { scr: RG.ui.currentId(), modal: RG.ui.modalOpen(), gold: g ? Math.floor(g.state.gold) : 0, towers: g ? g.state.towers.length : 0, wave: g ? g.state.wave.index : 0, total: g ? g.state.wave.total : 0, lives: g ? g.state.lives : 0, countdown: g ? g.state.wave.countdown : null, result: g ? g.state.result : null };
});

async function openGame(page, mapId) {
  await page.goto(`${URL}?screen=game&map=${mapId}&hero=kara`);
  await page.waitForSelector('#screen-game.active');
  await page.waitForFunction(() => RG.ui.game.game && !document.querySelector('#screen-game').classList.contains('loading'));
  await page.waitForTimeout(900); // 첫 팁 창
}

/* ---------------- 키보드 ---------------- */
async function keyboardRun(browser) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await openGame(page, '1-1');
  let cur = null; // 커서 위치 추적 (첫 방향키는 맵 가운데에서 출발)
  const closeModals = async () => { for (let i = 0; i < 6 && (await state(page)).modal; i++) { await page.keyboard.press('Enter'); await page.waitForTimeout(150); } };
  const moveTo = async (c, r) => {
    await closeModals(); // 창이 열려 있으면 방향키가 먹히지 않음
    const m = await page.evaluate(() => ({ cols: RG.ui.game.game.map.cols, rows: RG.ui.game.game.map.rows, hv: RG.render.overlay.hover }));
    if (m.hv) cur = { c: m.hv.c, r: m.hv.r };
    // 팁 창이 판 도중에 새로 뜰 수 있으니 키마다 창을 먼저 닫고, 실제 커서 위치로 다시 맞춤
    const press = async (k) => { await closeModals(); await page.keyboard.press(k); const hv = await page.evaluate(() => RG.render.overlay.hover); if (hv) cur = { c: hv.c, r: hv.r }; };
    if (!cur) await press('ArrowRight');
    for (let guard = 0; guard < 60 && (cur.c !== c || cur.r !== r); guard++) {
      if (cur.c < c) await press('ArrowRight');
      else if (cur.c > c) await press('ArrowLeft');
      else if (cur.r < r) await press('ArrowDown');
      else await press('ArrowUp');
    }
    const hv = await page.evaluate(() => RG.render.overlay.hover);
    if (!hv || hv.c !== c || hv.r !== r) throw new Error(`커서 위치 다름: ${JSON.stringify(hv)} ≠ ${c},${r}`);
  };
  await closeModals();
  const built = [];
  const buildOne = async () => {
    const t = (await page.evaluate(targetsInPage))[0];
    if (!t) return false;
    const before = (await state(page)).towers;
    await moveTo(t.c, t.r);
    await page.keyboard.press('Enter'); // 칸 고르기 → 탑 목록
    await page.keyboard.press('1');     // 첫 번째 탑
    await page.keyboard.press('Enter'); // 짓기
    if ((await state(page)).modal) { await closeModals(); await moveTo(t.c, t.r); await page.keyboard.press('Enter'); await page.keyboard.press('1'); await page.keyboard.press('Enter'); }
    await page.waitForTimeout(80);
    const ok = (await state(page)).towers === before + 1;
    if (ok) built.push(t);
    else await page.keyboard.press('Escape');
    return ok;
  };
  for (let i = 0; i < 3; i++) if (!(await buildOne())) break;
  if (built.length < 2) throw new Error(`키보드로 지은 탑 ${built.length}개`);
  // 배속 최대(F)
  await page.keyboard.press('f'); await page.keyboard.press('f');
  await page.evaluate(() => RG.ui.game.setSpeed(8));
  await page.keyboard.press(' ');
  let upgrades = 0;
  for (let i = 0; i < 160; i++) {
    const s = await state(page);
    if (s.scr === 'result' || s.result) break;
    if (s.modal) { await closeModals(); continue; }
    if (s.gold >= 90 && built.length < 7) await buildOne();
    else if (s.gold >= 120) {
      const t = built[upgrades % built.length];
      await moveTo(t.c, t.r);
      await page.keyboard.press('Enter'); // 탑 고르기
      await page.keyboard.press('u');
      await page.keyboard.press('Escape');
      upgrades++;
    }
    if (s.countdown !== null || s.wave === 0) await page.keyboard.press(' ');
    await page.waitForTimeout(400);
  }
  await page.waitForSelector('#screen-result.active', { timeout: 20000 });
  const res = await page.evaluate(() => document.querySelector('.result-box h2').textContent);
  await page.screenshot({ path: path.join(SHOTS, 'flow-keyboard-result.png') });
  await page.close();
  return { name: '키보드만으로 1-1', ok: /승리|지켜|클리어/.test(res), detail: `"${res}", 탑 ${built.length}개, 강화 ${upgrades}회`, errors };
}

/* ---------------- 터치 ---------------- */
async function touchRun(browser) {
  const ctx = await browser.newContext({ ...devices['Pixel 7 landscape'] });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await openGame(page, '1-1');
  const closeModals = async () => { for (let i = 0; i < 6 && (await state(page)).modal; i++) { const b = await page.$('.modal-buttons .btn:last-child'); if (b) await b.tap(); await page.waitForTimeout(200); } };
  const tapTile = async (c, r) => {
    const p = await page.evaluate(([c2, r2]) => { const s = RG.render.worldToScreen(c2 + 0.5, r2 + 0.5); const b = document.querySelector('#screen-game canvas').getBoundingClientRect(); return { x: b.left + s.x, y: b.top + s.y }; }, [c, r]);
    await page.touchscreen.tap(p.x, p.y);
    await page.waitForTimeout(120);
  };
  await closeModals();
  const built = [];
  const buildOne = async () => {
    const t = (await page.evaluate(targetsInPage))[0];
    if (!t) return false;
    const before = (await state(page)).towers;
    await tapTile(t.c, t.r);
    const item = await page.$('.build-menu .build-item:not(.disabled)');
    if (!item) { await tapTile(t.c, t.r); return false; }
    await item.tap();
    await page.waitForTimeout(100);
    const ok2 = await page.$('.build-confirm .btn-build');
    if (ok2) await ok2.tap();
    await page.waitForTimeout(120);
    const ok = (await state(page)).towers === before + 1;
    if (ok) built.push(t);
    return ok;
  };
  for (let i = 0; i < 3; i++) if (!(await buildOne())) break;
  if (built.length < 2) throw new Error(`터치로 지은 탑 ${built.length}개`);
  await page.evaluate(() => RG.ui.game.setSpeed(8));
  await page.tap('.btn-call');
  let upgrades = 0;
  for (let i = 0; i < 160; i++) {
    const s = await state(page);
    if (s.scr === 'result' || s.result) break;
    if (s.modal) { await closeModals(); continue; }
    if (s.gold >= 90 && built.length < 7) await buildOne();
    else if (s.gold >= 120) {
      const t = built[upgrades % built.length];
      await tapTile(t.c, t.r);
      const up = await page.$('.up-box .btn-up:not([disabled])');
      if (up) { await up.tap(); upgrades++; }
      const x = await page.$('.popover .x-btn');
      if (x) await x.tap();
    }
    if (s.countdown !== null) { const b = await page.$('.btn-call:not([disabled])'); if (b) await b.tap(); }
    await page.waitForTimeout(400);
  }
  await page.waitForSelector('#screen-result.active', { timeout: 20000 });
  const res = await page.evaluate(() => document.querySelector('.result-box h2').textContent);
  await page.screenshot({ path: path.join(SHOTS, 'flow-touch-result.png') });
  await ctx.close();
  return { name: '터치만으로 1-1 (휴대폰 가로)', ok: /승리|지켜|클리어/.test(res), detail: `"${res}", 탑 ${built.length}개, 강화 ${upgrades}회`, errors };
}

/* ---------------- 이어하기 ---------------- */
async function resumeRun(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await openGame(page, '1-2');
  await page.evaluate(() => RG.ui.closeAllModals());
  await page.evaluate((targets) => {
    const ui = RG.ui.game;
    for (const t of targets.slice(0, 3)) ui.doCmd({ type: 'build', tower: 'ember_archer', c: t.c, r: t.r }, true);
    ui.doCmd({ type: 'callWave' }, true);
    ui.setSpeed(8);
  }, await page.evaluate(targetsInPage));
  await page.waitForFunction(() => RG.ui.game.game.state.wave.index >= 2, null, { timeout: 60000 });
  // 저장 → 같은 순간의 틱·해시
  const before = await page.evaluate(() => { const ui = RG.ui.game; ui.setSpeed(0); RG.ui.show('title', {}); const run = RG.save.get(RG.save.KEYS.run); const g = RG.sim.replay(run.opts, run.log, run.tick); return { tick: run.tick, hash: g.hash(), wave: run.wave, run }; });
  await page.goto(URL); // 새로고침 (주소의 ?screen=game 없이 처음 화면부터)
  await page.waitForSelector('#screen-title.active');
  const btn = await page.$('.title-menu .btn-primary');
  const label = btn ? await btn.textContent() : '';
  await btn.click();
  await page.waitForSelector('#screen-game.active');
  await page.waitForFunction(() => RG.ui.game.game && !document.querySelector('#screen-game').classList.contains('loading'));
  // 이어진 판은 곧바로 다시 돌아가므로, 지금 틱에서 "저장된 기록을 그 틱까지 재현한 상태"와 같은지 비교
  const after = await page.evaluate((saved) => {
    const g = RG.ui.game.game;
    const T = g.state.tick;
    const ref = RG.sim.replay(saved.opts, saved.log, T);
    return { tick: T, hash: g.hash(), ref: ref.hash(), towers: g.state.towers.length };
  }, await page.evaluate(() => RG.save.get(RG.save.KEYS.run)) || before.run);
  await ctx.close();
  const ok = /이어하기/.test(label) && after.tick >= before.tick && after.tick - before.tick < 90 && after.hash === after.ref;
  return { name: '판 도중 새로고침 → 이어하기', ok, detail: `버튼 "${label.trim()}", 저장 틱 ${before.tick} → 이어서 ${after.tick}, 재현 상태와 해시 ${after.hash === after.ref ? '같음' : '다름'}, 탑 ${after.towers}개`, errors };
}

(async () => {
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const runs = { keyboard: keyboardRun, touch: touchRun, resume: resumeRun };
  let fail = 0;
  for (const [k, fn] of Object.entries(runs)) {
    if (only && only !== k) continue;
    const t0 = Date.now();
    try {
      const r = await fn(browser);
      const bad = !r.ok || r.errors.length;
      if (bad) fail++;
      console.log(`${bad ? '✗' : '✓'} ${r.name}: ${r.detail} (${Math.round((Date.now() - t0) / 1000)}초)${r.errors.length ? `\n   콘솔 오류: ${r.errors.slice(0, 5).join(' | ')}` : ''}`);
    } catch (e) {
      fail++;
      console.log(`✗ ${k}: ${e.message}`);
    }
  }
  await browser.close();
  process.exitCode = fail ? 1 : 0;
})();
