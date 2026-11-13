'use strict';

/*
 * 입력 방식별 한 판 + 이어하기 (QUALITY.md §5)
 *   node tests/e2e/flows.js [--dist] [--only keyboard|touch|mouse|resume|world|gacha|tutorial]
 *
 * - keyboard: 숫자(탑 고르기)·방향키·Enter·U·Space·F만으로 1-1을 깬다 (마우스·터치 없음)
 * - touch:    휴대폰 가로(터치 에뮬레이션)에서 탑 목록 탭 → 칸 탭, 탑 끌어다 놓기만으로 1-1을 깬다
 * - mouse:    탑 고르고 놓기의 세부 동작 (누르기·끌어다 놓기·Shift 이어 짓기·취소·못 짓는 칸·빈 칸 안내)
 * - resume:   판 도중 새로고침 → 타이틀의 "이어하기" → 같은 틱·같은 상태 해시
 * - world:    타이틀 "월드 지도" → 지역 고르기(펼침 패널): 접힌 패널 첫 누름은 펼치기만, 두 번째에 들어감,
 *             잠긴 지역은 안 들어감, 방향키·Enter로도, 지역 지도에서 "지역 고르기"로 돌아옴
 * - gacha:    타이틀 → 탑 뽑기 → 1회 뽑기(카드 뒤집기) → 확인 → 공명석이 줄고 탑이 늘거나 강화됨,
 *             뽑은 탑이 출정 준비 "내 탑"과 전투 탑 목록에 나옴, 공명석이 모자라면 버튼이 꺼짐
 * - tutorial: 처음 1-1 → 단계별 안내(탑 고르기→놓기→웨이브 호출→강화→공명→끝)를 실제 클릭으로 따라감, 손가락이 그 버튼을
 *             가리키는지, 끝나면 병영 팁, 다시 들어가면 안 나옴, 설정 "튜토리얼 다시 보기"로 되살아남, 건너뛰기
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
    // 팁 창이 끼어들 수 있으니 한 번 더 시도
    for (let attempt = 0; attempt < 2; attempt++) {
      await closeModals();
      if (await page.evaluate(() => !!RG.ui.game.placing)) await page.keyboard.press('Escape');
      await page.keyboard.press('1');     // 탑 목록의 첫 번째 탑 → 커서 칸에 미리보기
      await moveTo(t.c, t.r);             // 방향키로 미리보기 옮기기
      await page.keyboard.press('Enter'); // 짓기
      await page.waitForTimeout(80);
      if ((await state(page)).towers === before + 1) { built.push(t); return true; }
    }
    await page.keyboard.press('Escape');
    return false;
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
  const closeModals = async () => { for (let i = 0; i < 6 && (await state(page)).modal; i++) { const b = await page.$('.modal-buttons .btn:last-child'); if (b) { try { await b.tap({ timeout: 3000 }); } catch (e) { /* 애니메이션 중 — 다시 */ } } await page.waitForTimeout(200); } };
  const tapTile = async (c, r) => {
    const p = await page.evaluate(([c2, r2]) => { const s = RG.render.worldToScreen(c2 + 0.5, r2 + 0.5); const b = document.querySelector('#screen-game canvas').getBoundingClientRect(); return { x: b.left + s.x, y: b.top + s.y }; }, [c, r]);
    await page.touchscreen.tap(p.x, p.y);
    await page.waitForTimeout(120);
  };
  await closeModals();
  const built = [];
  let dragged = 0;
  const cdp = await ctx.newCDPSession(page);
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: Math.round(x), y: Math.round(y) }] });
  /** 살 수 있는 첫 탑 카드 가운데 (없으면 null) */
  const cardAt = () => page.evaluate(() => { const b = document.querySelector('.tower-card:not(.poor):not(.banned)'); if (!b) return null; const r = b.getBoundingClientRect(); return { type: b.dataset.type, x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  const closePanel = async () => { const x = await page.$('.info-panel:not(.hidden) .x-btn'); if (x) { try { await x.tap({ timeout: 2000 }); } catch (e) { /* 무시 */ } } };
  /** 탑 카드를 손가락으로 끌어 칸에 놓기 — 끄는 동안 미리보기는 손가락 위쪽 칸에 보이므로 손가락은 그 칸 아래에서 뗌 */
  const dragTo = async (card, c, r) => {
    const p = await page.evaluate(([c2, r2]) => { const s = RG.render.worldToScreen(c2 + 0.5, r2 + 0.5); const b = document.querySelector('#screen-game canvas').getBoundingClientRect(); return { x: b.left + s.x, y: b.top + s.y, T: RG.render.T }; }, [c, r]);
    const fy = p.y + Math.max(p.T * 1.05, 42);
    await touch('touchStart', card.x, card.y);
    for (let i = 1; i <= 12; i++) { await touch('touchMove', card.x + (p.x - card.x) * i / 12, card.y + (fy - card.y) * i / 12); await page.waitForTimeout(16); }
    const pl = await page.evaluate(() => RG.ui.game.placing);
    await touch('touchEnd');
    await page.waitForTimeout(120);
    return pl;
  };
  const buildOne = async () => {
    const t = (await page.evaluate(targetsInPage))[0];
    if (!t) return false;
    const before = (await state(page)).towers;
    // 팁 창이 늦게 떠서 탭을 가릴 수 있으니 단계마다 창을 닫고, 실패하면 한 번 더
    for (let attempt = 0; attempt < 3; attempt++) {
      await closeModals();
      await closePanel(); // 병영을 지으면 정보 창이 열려 탑 목록을 가림
      const card = await cardAt();
      if (!card) return false;
      if (built.length === 0 && attempt === 0) {
        // 첫 탑은 끌어다 놓기
        const pl = await dragTo(card, t.c, t.r);
        if (pl && (pl.c !== t.c || pl.r !== t.r)) throw new Error(`끄는 중 미리보기 칸 ${pl.c},${pl.r} ≠ ${t.c},${t.r}`);
        if ((await state(page)).towers === before + 1) { built.push(t); dragged++; return true; }
        continue;
      }
      // 나머지는 탭: 탑 카드 → 칸
      const cur = await page.evaluate(() => RG.ui.game.placing);
      if (!cur || cur.type !== card.type) { await page.touchscreen.tap(card.x, card.y); await page.waitForTimeout(80); }
      await closeModals();
      await tapTile(t.c, t.r);
      if ((await state(page)).towers === before + 1) { built.push(t); return true; }
    }
    return false;
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
      if (up) { try { await up.tap({ timeout: 2000 }); upgrades++; } catch (e) { /* 정보 창은 0.1초마다 다시 그려짐 — 다음 차례에 */ } }
      await closePanel();
    }
    if (s.countdown !== null) { const b = await page.$('.btn-call:not([disabled])'); if (b) { try { await b.tap({ timeout: 2000 }); } catch (e) { /* 다시 그려짐 */ } } }
    await page.waitForTimeout(400);
  }
  await page.waitForSelector('#screen-result.active', { timeout: 20000 });
  const res = await page.evaluate(() => document.querySelector('.result-box h2').textContent);
  await page.screenshot({ path: path.join(SHOTS, 'flow-touch-result.png') });
  await ctx.close();
  return { name: '터치만으로 1-1 (휴대폰 가로)', ok: /승리|지켜|클리어/.test(res) && dragged > 0, detail: `"${res}", 탑 ${built.length}개(끌어다 놓기 ${dragged}), 강화 ${upgrades}회`, errors };
}

/* ---------------- 마우스: 탑 고르고 놓기 ---------------- */
async function mouseRun(browser) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await openGame(page, '1-2');
  await page.evaluate(() => { RG.ui.closeAllModals(); RG.ui.game.game.state.gold = 1000; });
  const fails = [];
  const check = (cond, msg) => { if (!cond) fails.push(msg); };
  const tile = (c, r) => page.evaluate(([c2, r2]) => { const s = RG.render.worldToScreen(c2 + 0.5, r2 + 0.5); const b = document.querySelector('#screen-game canvas').getBoundingClientRect(); return { x: b.left + s.x, y: b.top + s.y }; }, [c, r]);
  const card = (i) => page.evaluate((i2) => { const r = document.querySelectorAll('.tower-card')[i2].getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, i);
  const placing = () => page.evaluate(() => RG.ui.game.placing);
  const has = (s2) => page.evaluate((x) => RG.ui.game.game.state.towers.some((t) => `${t.type}@${t.c},${t.r}` === x), s2);
  const toasts = () => page.evaluate(() => [...document.querySelectorAll('.toast')].map((t) => t.textContent).join(' | '));
  // 1-2: (6~8, 3~5)는 건설지, (5,4)는 길
  const t64 = await tile(6, 4);
  await page.mouse.click(t64.x, t64.y);
  check(/탑 목록에서 탑을 골라/.test(await toasts()) && !(await placing()), '빈 칸 누르기 → 안내만 (놓기 모드 아님)');
  const c0 = await card(0);
  await page.mouse.click(c0.x, c0.y);
  await page.mouse.move(t64.x, t64.y, { steps: 4 });
  const pl = await placing();
  check(pl && pl.type === 'ember_archer' && pl.c === 6 && pl.r === 4 && pl.ok, `탑 고르기 → 맵 위 미리보기 ${JSON.stringify(pl)}`);
  check(await page.evaluate(() => !document.querySelector('.place-label').classList.contains('hidden')), '놓기 이름표');
  await page.mouse.click(t64.x, t64.y);
  check(await has('ember_archer@6,4') && !(await placing()), '칸 누르기 → 짓고 놓기 모드 끝');
  // 못 짓는 칸: 이유를 알리고 놓기 모드 유지
  await page.mouse.click(c0.x, c0.y);
  const t54 = await tile(5, 4);
  await page.mouse.move(t54.x, t54.y, { steps: 3 });
  check((await placing()).ok === false, '길 위 미리보기는 불가(빨강)');
  await page.mouse.click(t54.x, t54.y);
  check(/지을 수 없/.test(await toasts()) && (await placing()), '못 짓는 칸 → 이유, 놓기 모드 유지');
  // Shift: 이어서 짓기
  const t74 = await tile(7, 4);
  const t75 = await tile(7, 5);
  await page.keyboard.down('Shift');
  await page.mouse.move(t74.x, t74.y, { steps: 3 }); await page.mouse.click(t74.x, t74.y);
  await page.mouse.move(t75.x, t75.y, { steps: 3 }); await page.mouse.click(t75.x, t75.y);
  await page.keyboard.up('Shift');
  check(await has('ember_archer@7,4') && await has('ember_archer@7,5') && (await placing()), 'Shift 누른 채 두 번 짓기, 놓기 모드 유지');
  // 취소 방법들
  await page.keyboard.press('Escape');
  check(!(await placing()), 'Esc 취소');
  await page.mouse.click(c0.x, c0.y); await page.mouse.click(c0.x, c0.y);
  check(!(await placing()), '같은 탑 다시 누르기 → 취소');
  await page.mouse.click(c0.x, c0.y); await page.mouse.move(t64.x, t64.y, { steps: 3 });
  await page.mouse.click(t64.x, t64.y, { button: 'right' });
  check(!(await placing()), '오른쪽 클릭 → 취소');
  await page.mouse.click(c0.x, c0.y); await page.mouse.click(60, 420);
  check(!(await placing()), '맵 밖(왼쪽 띠) 누르기 → 취소');
  // 끌어다 놓기
  const c2 = await card(2);
  const t83 = await tile(8, 3);
  await page.mouse.move(c2.x, c2.y); await page.mouse.down();
  await page.mouse.move(c2.x, c2.y - 40, { steps: 3 });
  await page.mouse.move(t83.x, t83.y, { steps: 8 });
  const pd = await placing();
  await page.mouse.up();
  check(pd && pd.c === 8 && pd.r === 3 && await has(`${pd.type}@8,3`) && !(await placing()), `끌어다 놓기로 짓기 ${JSON.stringify(pd)}`);
  await page.mouse.move(c2.x, c2.y); await page.mouse.down();
  await page.mouse.move(t83.x, t83.y - 80, { steps: 6 });
  await page.mouse.move(c2.x + 4, c2.y, { steps: 6 });
  await page.mouse.up();
  check(!(await placing()), '끌다가 탑 목록 위에서 놓기 → 취소');
  // 지은 탑 누르기 → 정보 창 (예전과 같음)
  await page.mouse.click(t64.x, t64.y);
  check(await page.evaluate(() => !document.querySelector('.info-panel').classList.contains('hidden')), '지은 탑 누르기 → 정보 창');
  await page.close();
  return { name: '마우스로 탑 고르고 놓기', ok: !fails.length, detail: fails.length ? `실패: ${fails.join(' / ')}` : '누르기·끌어다 놓기·Shift·취소 4가지·못 짓는 칸·빈 칸 안내 모두 통과', errors };
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

async function worldRun(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(URL);
  await page.evaluate(() => { const st = { result: 'win', lives: 12, task: { done: true }, wave: { index: 8 } }; for (const id of ['1-1', '1-2', '1-3', '1-4', '1-5', '1-6', '2-1']) RG.progress.record(id, 'normal', st); RG.ui.show('title', {}); });
  await page.waitForSelector('#screen-title.active .title-menu .btn-big');
  await page.click('#screen-title .title-menu .btn-big:not(.btn-primary), #screen-title .title-menu .btn-primary');
  await page.waitForSelector('#screen-world.active .rg-panel');
  const st = () => page.evaluate(() => ({ view: document.querySelector('.rg-select') ? 'regions' : 'stages', on: (document.querySelector('.rg-panel.on') || { dataset: {} }).dataset.r, nodes: document.querySelectorAll('.map-node').length, title: (document.querySelector('.wm-title b') || {}).textContent }));
  const s0 = await st();
  await page.click('.rg-panel[data-r="1"]');
  await page.waitForTimeout(700);
  const s1 = await st();                        // 펼치기만
  await page.click('.rg-panel[data-r="3"]');    // 잠긴 지역: 펼쳐지지만
  await page.waitForTimeout(600);
  await page.click('.rg-panel[data-r="3"] .rg-go', { force: true });
  await page.waitForTimeout(700);
  const s2 = await st();                        // 들어가지 않음
  await page.focus('.rg-panel[data-r="3"]');
  await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(300);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(900);
  const s3 = await st();                        // 2지역 지도
  await page.click('.wm-all');
  await page.waitForTimeout(700);
  const s4 = await st();                        // 지역 고르기로, 2지역이 펼쳐진 채
  await ctx.close();
  const ok = s0.view === 'regions' && s0.on === '2' && s1.view === 'regions' && s1.on === '1' && s2.view === 'regions' && s3.view === 'stages' && s3.nodes > 0 && s3.title === '서리 고개' && s4.view === 'regions' && s4.on === '2';
  return { name: '지역 고르기', ok, detail: `처음 펼친 지역 ${s0.on} → 접힌 1지역 누름: ${s1.view}/${s1.on} → 잠긴 3지역 들어가기: ${s2.view} → ←·Enter: ${s3.view} "${s3.title}" 메달 ${s3.nodes}개 → 지역 고르기: ${s4.view}/${s4.on}`, errors };
}

async function gachaRun(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(URL);
  await page.waitForSelector('#screen-title.active .btn-gacha');
  const g0 = await page.evaluate(() => JSON.parse(JSON.stringify(RG.progress.gachaState())));
  await page.click('#screen-title .btn-gacha');
  await page.waitForSelector('#screen-gacha.active .gc-pull');
  await page.click('.gc-pull:not(.gc-ten):not(.gc-ticket)');
  await page.waitForSelector('.gc-ok:not(.hidden)', { timeout: 5000 });
  const pulled = await page.evaluate(() => [...document.querySelectorAll('.gc-rcard .gc-rname')].map((n) => n.textContent));
  await page.click('.gc-ok');
  await page.waitForSelector('#screen-gacha.active .gc-pull');
  const g1 = await page.evaluate(() => JSON.parse(JSON.stringify(RG.progress.gachaState())));
  const gotType = Object.keys(g1.owned).find((t) => !(t in g0.owned) || g1.owned[t] !== g0.owned[t]);
  const spent = g0.crystals - g1.crystals === 100;
  const disabled = await page.evaluate(() => document.querySelector('.gc-pull:not(.gc-ticket)').disabled);
  // 출정 준비와 전투에 뽑은 탑이 보이는지 (새 탑일 때)
  await page.evaluate(() => { for (const id of Object.keys(RG.data.story)) RG.progress.markSeen('story', id); RG.ui.show('brief', { mapId: '1-1' }); });
  const briefCount = await page.evaluate(() => (document.querySelector('#screen-brief').textContent.match(/내 탑 \((\d+)\//) || [])[1]);
  await page.click('#screen-brief .btn-primary.btn-big');
  await page.waitForFunction(() => RG.ui.game.game && !document.querySelector('#screen-game').classList.contains('loading'));
  const dock = await page.evaluate(() => [...document.querySelectorAll('.tower-card')].map((c) => c.dataset.type));
  await ctx.close();
  const ownedN = Object.keys(g1.owned).length;
  const inDock = gotType ? dock.includes(gotType) : false;
  const ok = spent && !!gotType && disabled && +briefCount === ownedN && dock.length === ownedN && inDock;
  return { name: '탑 뽑기', ok, detail: `뽑은 탑 "${pulled.join(', ')}"(${gotType}${g1.owned[gotType] > 0 ? ` 강화 +${g1.owned[gotType]}` : ' 새 탑'}), 공명석 ${g0.crystals}→${g1.crystals}, 모자라면 버튼 꺼짐 ${disabled}, 출정 준비 내 탑 ${briefCount}개, 전투 탑 목록 ${dock.length}개`, errors };
}

/* ---------------- 첫 판 단계별 안내: 탑 고르기 → 놓기 → 웨이브 호출 → 강화 → 공명 → 끝, 건너뛰기·다시 보기 ---------------- */
async function tutorialRun(browser) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(URL);
  await page.evaluate(() => { RG.progress.reset(); RG.progress.markSeen('story', 'prologue'); });
  await openGame(page, '1-1');
  await page.waitForFunction(() => RG.ui.tutorial.active, null, { timeout: 5000 });
  const step = () => page.evaluate(() => RG.ui.tutorial.step);
  const steps = [await step()];
  const handOn = async (sel) => page.evaluate((sel) => {
    const h = document.querySelector('.tut-hand').getBoundingClientRect();
    const t = document.querySelector(sel).getBoundingClientRect();
    const x = h.left + 16; const y = h.top;
    return x >= t.left - 8 && x <= t.right + 8 && y >= t.top - 8 && y <= t.bottom + 30;
  }, sel);
  const pointsCard = await handOn('.tower-card[data-type="ember_archer"]');
  await page.click('.tower-card[data-type="ember_archer"]');
  await page.waitForTimeout(200);
  steps.push(await step());
  const ring = await page.evaluate(() => { const r = document.querySelector('.tut-ring').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, shown: getComputedStyle(document.querySelector('.tut-ring')).display !== 'none' }; });
  await page.mouse.click(ring.x, ring.y);
  await page.waitForTimeout(400);
  steps.push(await step());
  const pointsCall = await handOn('.btn-call');
  await page.click('.btn-call');
  await page.waitForTimeout(400);
  steps.push(await step());
  await page.evaluate(() => { RG.ui.game.game.state.gold += 200; });
  await page.waitForTimeout(300);
  const t0 = await page.evaluate(() => { const t = RG.ui.game.game.state.towers[0]; const p = RG.render.worldToScreen(t.c + 0.5, t.r + 0.5); const r = document.querySelector('.game-canvas').getBoundingClientRect(); return { x: r.left + p.x, y: r.top + p.y }; });
  await page.mouse.click(t0.x, t0.y);
  await page.waitForTimeout(300);
  const pointsUp = await handOn('.info-panel .btn-up');
  await page.click('.info-panel .btn-up');
  await page.waitForTimeout(400);
  steps.push(await step());
  await page.evaluate(() => { RG.ui.game.game.state.gold += 200; });
  await page.keyboard.press('Escape');
  await page.click('.tower-card[data-type="ember_archer"]');
  await page.waitForTimeout(200);
  const ring2 = await page.evaluate(() => { const r = document.querySelector('.tut-ring').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await page.mouse.click(ring2.x, ring2.y);
  await page.waitForFunction(() => RG.ui.tutorial.step === 'end' || !RG.ui.tutorial.active, null, { timeout: 5000 });
  steps.push(await step());
  await page.waitForFunction(() => !RG.ui.tutorial.active, null, { timeout: 9000 });
  await page.waitForFunction(() => RG.ui.modalOpen(), null, { timeout: 3000 }).catch(() => {}); // 끝나고 0.4초 뒤 남은 팁(병영)
  const done = await page.evaluate(() => ({ seen: RG.progress.seen('tips', 'tutorial'), links: RG.ui.game.game.state.towers.reduce((a, t) => a + t.links.length, 0) / 2, level: Math.max(...RG.ui.game.game.state.towers.map((t) => t.level)), tip: RG.ui.modalOpen() }));
  // 다시 들어가면 안 나옴 → 설정의 "튜토리얼 다시 보기" → 다시 나옴 → 건너뛰기
  await page.evaluate(() => RG.ui.closeAllModals());
  await openGame(page, '1-1');
  const again = await page.evaluate(() => RG.ui.tutorial.active);
  await page.evaluate(() => { RG.ui.closeAllModals(); RG.ui.openSettings(); });
  await page.click('.settings button:has-text("튜토리얼 다시 보기")');
  await page.evaluate(() => RG.ui.closeAllModals());
  await openGame(page, '1-1');
  await page.waitForFunction(() => RG.ui.tutorial.active, null, { timeout: 5000 }).catch(() => {});
  const back = await page.evaluate(() => RG.ui.tutorial.active);
  await page.click('.tut-skip');
  await page.waitForTimeout(200);
  const skipped = await page.evaluate(() => ({ active: RG.ui.tutorial.active, seen: RG.progress.seen('tips', 'tutorial') }));
  await page.close();
  const want = ['pick', 'place', 'wave', 'upgrade', 'resonance', 'end'];
  const ok = want.every((w, i) => steps[i] === w) && pointsCard && ring.shown && pointsCall && pointsUp && done.seen && done.links >= 1 && done.level >= 2 && done.tip
    && !again && back && !skipped.active && skipped.seen;
  return { name: '첫 판 안내', ok, detail: `단계 ${steps.join('→')}, 손가락(카드 ${pointsCard}·호출 ${pointsCall}·강화 ${pointsUp}), 끝난 뒤 병영 팁 ${done.tip}, 다시 안 나옴 ${!again}, 설정으로 되살림 ${back}, 건너뛰기 ${!skipped.active}`, errors };
}

(async () => {
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const runs = { keyboard: keyboardRun, touch: touchRun, mouse: mouseRun, resume: resumeRun, world: worldRun, gacha: gachaRun, tutorial: tutorialRun };
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
