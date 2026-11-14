'use strict';

/*
 * 입력 방식별 한 판 + 이어하기 (QUALITY.md §5)
 *   node tests/e2e/flows.js [--dist] [--only keyboard|touch|mouse|resume|world|gacha|tutorial|a11y|transfer|raid|awaken|press|crystal]
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
  const long = await longResume(page, ctx, errors);
  await ctx.close();
  const ok = /이어하기/.test(label) && after.tick >= before.tick && after.tick - before.tick < 90 && after.hash === after.ref && Object.values(long.r).every(Boolean);
  return { name: '판 도중 새로고침 → 이어하기', ok, detail: `버튼 "${label.trim()}", 저장 틱 ${before.tick} → 이어서 ${after.tick}, 재현 상태와 해시 ${after.hash === after.ref ? '같음' : '다름'}, 탑 ${after.towers}개 / 긴 판 ${long.tick}틱: ${Object.entries(long.r).map(([k, v]) => `${k} ${v ? '✓' : '✗'}`).join(' · ')}`, errors };
}

/**
 * 긴 판 이어하기 (공명석 웨이브처럼 수천~수만 틱): 클릭은 바로 끝나고 진행률이 보임, 재현하는 동안 입력·자동 저장이 없음,
 * Esc로 그만두면 타이틀로(저장 그대로, 남은 재현 없음), 다시 누르면 끝까지 같은 해시, 재현이 실패하면 알리고 돌아감
 */
async function longResume(page, ctx, errors) {
  const r = {};
  await page.evaluate(() => RG.ui.show('title', {}));
  const saved = await page.evaluate(() => {
    // 적 체력을 낮춰(hpMult — 판 설정이라 재현도 같음) 웨이브 10 넘게 가는 긴 판
    const opts = Object.assign({ mode: 'normal', seed: 5, heroId: 'kara', towers: ['ember_archer', 'frost_crystal', 'stone_barracks'], branches: true }, RG.crystal.setup(1), { hpMult: 0.3 });
    const g = RG.sim.create(opts);
    const m = g.map;
    const spots = [];
    for (let rr = 0; rr < m.rows; rr++) for (let c = 0; c < m.cols; c++) {
      if (m.kinds[rr * m.cols + c] !== RG.grid.T.BUILD) continue;
      let near = 0;
      for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) if (m.kinds[(rr + dr) * m.cols + (c + dc)] === RG.grid.T.PATH) near++;
      spots.push({ near, c, r: rr });
    }
    spots.sort((a, b) => b.near - a.near);
    const types = ['ember_archer', 'frost_crystal', 'stone_barracks'];
    let k = 0;
    const spend = () => {
      for (const t of spots.slice(0, 30)) { if (g.state.gold < 120) break; if (!g.tileTower(t.c, t.r) && g.cmd({ type: 'build', tower: types[k % 3], c: t.c, r: t.r }).ok) k++; }
      for (const t of g.state.towers.slice().sort((a, b) => a.level - b.level)) if (t.level < 3) g.cmd({ type: 'upgrade', id: t.id });
    };
    spend();
    g.cmd({ type: 'callWave' });
    for (let i = 0; i < 12000 && !g.state.result; i++) { if (i % 60 === 0) spend(); g.step(); }
    // 판이 끝났으면 끝나기 조금 전까지로 (이어할 판)
    const T = g.state.result ? g.state.tick - 200 : g.state.tick;
    const log = g.log.filter((x) => x[0] <= T);
    const at = RG.sim.replay(opts, log, T);
    const run = { opts, log, tick: T, mapId: g.def.id, wave: at.state.wave.index, savedAt: Date.now() };
    RG.save.set(RG.save.KEYS.run, run);
    return { tick: run.tick, json: localStorage.getItem('rg.run.v1'), result: at.state.result };
  });
  await page.goto(URL);
  await page.waitForSelector('#screen-title.active .tm-hero');
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 }); // 재현이 몇 초 걸리게 (느린 휴대폰처럼)
  const click = await page.evaluate(() => {
    const t0 = performance.now();
    document.querySelector('.tm-hero').click();
    return { ms: performance.now() - t0, veil: !!document.querySelector('#screen-game.active .resume-veil'), game: !!RG.ui.game.game };
  });
  r.instant = !saved.result && saved.tick > 5000 && click.veil && !click.game && click.ms < 1000;
  if (!r.instant) console.log('긴 판 클릭', JSON.stringify({ tick: saved.tick, result: saved.result, click }));
  await page.waitForFunction(() => { const p = document.querySelector('.rv-pct'); return p && parseInt(p.textContent, 10) >= 3; }, null, { timeout: 30000 });
  const live = await page.evaluate(() => ({ status: !!document.querySelector('.resume-veil [role="status"][aria-live="polite"]'), bar: (document.querySelector('.resume-veil [role="progressbar"]') || { getAttribute: () => '0' }).getAttribute('aria-valuenow') }));
  // 재현하는 동안 키·누르기: 웨이브 호출(Space)·탑 고르기(1)·일시정지(P)·배속(F), 화면 아무 데나 → 판도 루프도 없음, 저장 그대로
  for (const k of ['Space', '1', 'p', 'f']) await page.keyboard.press(k);
  await page.mouse.click(60, 60);
  await page.evaluate(() => RG.ui.game.doCmd({ type: 'callWave' }));
  r.blocked = await page.evaluate((json) => !RG.ui.game.game && RG.ui.currentId() === 'game' && !!document.querySelector('.resume-veil') && localStorage.getItem('rg.run.v1') === json, saved.json);
  r.progress = live.status && +live.bar >= 3;
  // Esc → 들어온 화면(타이틀)으로, 남은 재현이 판을 열지 않음
  await page.keyboard.press('Escape');
  await page.waitForSelector('#screen-title.active');
  await page.waitForTimeout(1500);
  const cancel = await page.evaluate((json) => ({ scr: RG.ui.currentId(), game: !!RG.ui.game.game, veil: !!document.querySelector('.resume-veil'), save: localStorage.getItem('rg.run.v1') === json, tile: !!document.querySelector('.tm-hero') }), saved.json);
  r.cancel = cancel.scr === 'title' && !cancel.game && !cancel.veil && cancel.save && cancel.tile;
  if (!r.cancel) console.log('Esc 취소', JSON.stringify(cancel));
  // 다시 → 끝까지: 저장된 기록을 그 틱까지 한 번에 재현한 것과 같은 해시
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await page.click('.tm-hero');
  await page.waitForFunction(() => RG.ui.game.game && !document.querySelector('#screen-game').classList.contains('loading'), null, { timeout: 60000 });
  const fin = await page.evaluate((json) => {
    const run = JSON.parse(json);
    const g = RG.ui.game.game;
    return { tick: g.state.tick, hash: g.hash(), ref: RG.sim.replay(run.opts, run.log, g.state.tick).hash() };
  }, saved.json);
  r.same = fin.tick >= saved.tick && fin.tick - saved.tick < 90 && fin.hash === fin.ref;
  // 망가진 저장(재현 도중 오류): 알리고 들어온 화면으로, 저장은 지우지 않음, 잡히지 않은 오류 없음
  await page.evaluate(() => RG.ui.show('title', {}));
  await page.evaluate((json) => { const run = JSON.parse(json); run.log = [[10, { type: 'callWave' }], null]; run.tick = 3000; localStorage.setItem('rg.run.v1', JSON.stringify(run)); RG.ui.show('title', {}); }, saved.json);
  const nErr = errors.length;
  await page.click('.tm-hero');
  await page.waitForFunction(() => RG.ui.currentId() === 'title' && document.querySelector('#toast-root').textContent.includes('이어할 수 없습니다'), null, { timeout: 10000 });
  const failErrs = errors.splice(nErr);
  r.badSave = failErrs.length === 1 && /이어하기 재현 실패/.test(failErrs[0]) && await page.evaluate(() => !RG.ui.game.game && !!localStorage.getItem('rg.run.v1'));
  if (!r.badSave) console.log('망가진 저장', JSON.stringify(failErrs));
  return { r, tick: saved.tick };
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
  // 도중에 다시 시작해도 안내가 다시 나옴 (끝내거나 건너뛸 때만 '봤음')
  await page.evaluate(() => { RG.ui.closeAllModals(); RG.save.remove(RG.save.KEYS.run); RG.ui.show('game', { opts: RG.ui.game.game.opts }); });
  await page.waitForFunction(() => RG.ui.game.game && !document.querySelector('#screen-game').classList.contains('loading'));
  const restartOk = await page.waitForFunction(() => RG.ui.tutorial.active && RG.ui.tutorial.step === 'pick', null, { timeout: 5000 }).then(() => true).catch(() => false);
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
  const ok = restartOk && want.every((w, i) => steps[i] === w) && pointsCard && ring.shown && pointsCall && pointsUp && done.seen && done.links >= 1 && done.level >= 2 && done.tip
    && !again && back && !skipped.active && skipped.seen;
  return { name: '첫 판 안내', ok, detail: `다시 시작해도 나옴 ${restartOk}, 단계 ${steps.join('→')}, 손가락(카드 ${pointsCard}·호출 ${pointsCall}·강화 ${pointsUp}), 끝난 뒤 병영 팁 ${done.tip}, 다시 안 나옴 ${!again}, 설정으로 되살림 ${back}, 건너뛰기 ${!skipped.active}`, errors };
}

/* ---------------- 키보드 접근성: 창 안 Tab 순환·Esc·초점 되돌림, 위험 확인은 취소에 초점, 뽑기 두 번 안 됨, 6지역 방향키, 전투 키보드 흐름 ---------------- */
async function a11yRun(browser) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(URL);
  await page.evaluate(() => {
    const P = RG.progress; P.reset();
    const st = { result: 'win', lives: 12, task: { done: true }, wave: { index: 20 } };
    for (const m of RG.data.maps) { if (m.region >= 6) break; P.record(m.id, 'normal', st); }
    for (const k of Object.keys(RG.data.story)) P.markSeen('story', k);
    for (const m of RG.data.maps) for (const t of m.tips || []) P.markSeen('tips', t);
    P.markSeen('tips', 'tutorial');
    P.gachaState().crystals = 1000; P.save();
    RG.ui.show('title', {});
  });
  await page.waitForTimeout(300);
  const r = {};
  // 1) 첫 초점: 키보드를 쓰면 화면의 주 버튼
  await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab');
  await page.evaluate(() => RG.ui.show('title', {}));
  await page.waitForTimeout(150);
  r.autofocus = await page.evaluate(() => document.activeElement && document.activeElement.hasAttribute('data-autofocus'));
  // 2) 설정 창: Tab이 창 안에서만, Esc로 닫으면 설정 버튼으로 초점이 돌아옴
  await page.focus('.tc-btn[title="설정"]');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
  let inside = true;
  for (let i = 0; i < 14; i++) { await page.keyboard.press('Tab'); inside = inside && await page.evaluate(() => !!document.activeElement.closest('.modal')); }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);
  r.trap = inside;
  r.escBack = await page.evaluate(() => !RG.ui.modalOpen() && document.activeElement && document.activeElement.matches('.tc-btn[title="설정"]'));
  // 3) 처음부터 다시(위험): 초점은 취소
  await page.focus('.tf-reset');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(100);
  r.dangerSafe = await page.evaluate(() => !document.activeElement.classList.contains('btn-danger') && !!document.activeElement.closest('.modal'));
  await page.keyboard.press('Enter'); // 취소
  r.notReset = await page.evaluate(() => RG.progress.starsTotal() > 0);
  // 4) 뽑기: Enter 두 번 → 한 번만, Esc → 모두 열기 → Esc → 확인
  await page.evaluate(() => RG.ui.show('gacha', {}));
  await page.waitForTimeout(300);
  const c0 = await page.evaluate(() => RG.progress.gachaState().crystals);
  await page.focus('.gc-pull:not(.gc-ten)');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(80);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  const c1 = await page.evaluate(() => ({ c: RG.progress.gachaState().crystals, n: document.querySelectorAll('.gc-reveal').length }));
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  r.gachaOnce = c0 - c1.c === 100 && c1.n === 1;
  r.gachaClosed = await page.evaluate(() => !document.querySelector('.gc-reveal'));
  // 5) 지역 고르기: 방향키로 6지역까지
  await page.evaluate(() => { const st = { result: 'win', lives: 12, task: { done: true }, wave: { index: 20 } }; for (const m of RG.data.maps.filter((x) => x.region === 5)) RG.progress.record(m.id, 'normal', st); RG.ui.show('world', { view: 'regions' }); });
  await page.waitForTimeout(400);
  await page.focus('.rg-panel');
  for (let i = 0; i < 7; i++) { await page.keyboard.press('ArrowRight'); await page.waitForTimeout(60); }
  r.region6 = await page.evaluate(() => (document.activeElement.textContent || '').includes('별울림'));
  // 6) 전투: Tab으로 탑 카드 → Enter → 초점이 전장으로 → 방향키·Enter로 지음 → 탑 창의 강화 버튼에 초점을 둔 채 골드가 바뀌어도 초점 유지
  await page.evaluate(() => RG.ui.show('game', { opts: { mapId: '1-2', heroId: 'kara', seed: 3, mode: 'normal', towers: ['ember_archer', 'frost_crystal', 'stone_barracks'], branches: true } }));
  await page.waitForFunction(() => RG.ui.game.game && !document.querySelector('#screen-game').classList.contains('loading'));
  await page.evaluate(() => RG.ui.closeAllModals());
  await page.focus('.tower-card[data-type="ember_archer"]');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(100);
  r.mapFocus = await page.evaluate(() => document.activeElement.classList.contains('game-canvas') && !!RG.ui.game.placing);
  const n0 = await page.evaluate(() => RG.ui.game.game.state.towers.length);
  for (const k of ['ArrowRight', 'ArrowDown']) { await page.keyboard.press(k); await page.waitForTimeout(40); }
  let built = false;
  for (let i = 0; i < 16 && !built; i++) {
    await page.keyboard.press('Enter'); await page.waitForTimeout(60);
    built = await page.evaluate((n0) => RG.ui.game.game.state.towers.length > n0, n0);
    if (!built) { await page.keyboard.press(i % 2 ? 'ArrowRight' : 'ArrowDown'); await page.waitForTimeout(40); }
  }
  r.built = built;
  r.cursor = await page.evaluate(() => RG.render.overlay.keyCursor === true);
  await page.evaluate(() => { const t = RG.ui.game.game.state.towers[0]; RG.ui.game.game.state.gold += 300; RG.ui.game.doCmd && 0; window.__t = t.id; });
  await page.keyboard.press('Escape');
  await page.evaluate(() => { const t = RG.ui.game.game.state.towers[0]; const p = RG.render.worldToScreen(t.c + 0.5, t.r + 0.5); const cv = document.querySelector('.game-canvas'); const b = cv.getBoundingClientRect(); const o = { clientX: b.left + p.x, clientY: b.top + p.y, bubbles: true, pointerType: 'mouse' }; cv.dispatchEvent(new PointerEvent('pointerdown', o)); cv.dispatchEvent(new PointerEvent('pointerup', o)); });
  await page.waitForTimeout(200);
  await page.focus('.info-panel .btn-up');
  await page.evaluate(() => { RG.ui.game.game.state.gold += 55; });
  await page.waitForTimeout(400);
  r.panelFocus = await page.evaluate(() => document.activeElement && document.activeElement.matches('.info-panel .btn-up'));
  // 6b) 키보드: 웨이브 호출 버튼에 초점이 있어도 숫자로 탑을 고르면 Enter는 짓기(웨이브 호출 아님) · 표적 버튼은 다시 그려도 같은 버튼에
  await page.evaluate(() => RG.ui.show('game', { opts: { mapId: '1-2', heroId: 'kara', seed: 4, mode: 'normal', towers: ['ember_archer', 'frost_crystal', 'stone_barracks'], branches: true } }));
  await page.waitForFunction(() => RG.ui.game.game && !document.querySelector('#screen-game').classList.contains('loading'));
  await page.evaluate(() => RG.ui.closeAllModals());
  r.noAutoCall = await page.evaluate(() => !document.activeElement.classList.contains('btn-call'));
  await page.focus('.btn-call');
  await page.keyboard.press('1');
  for (const k of ['ArrowRight', 'ArrowDown']) await page.keyboard.press(k);
  let placed = false;
  for (let i = 0; i < 16 && !placed; i++) {
    await page.keyboard.press('Enter'); await page.waitForTimeout(50);
    placed = await page.evaluate(() => RG.ui.game.game.state.towers.length > 0);
    if (!placed) await page.keyboard.press(i % 2 ? 'ArrowRight' : 'ArrowDown');
  }
  r.enterBuilds = placed && await page.evaluate(() => RG.ui.game.game.state.wave.index === 0);
  await page.keyboard.press('Escape');
  await page.evaluate(() => { const t = RG.ui.game.game.state.towers[0]; const p = RG.render.worldToScreen(t.c + 0.5, t.r + 0.5); const cv = document.querySelector('.game-canvas'); const b = cv.getBoundingClientRect(); const o = { clientX: b.left + p.x, clientY: b.top + p.y, bubbles: true, pointerType: 'mouse' }; cv.dispatchEvent(new PointerEvent('pointerdown', o)); cv.dispatchEvent(new PointerEvent('pointerup', o)); });
  await page.waitForTimeout(150);
  await page.focus('.info-panel [data-k="tm:strong"]');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
  r.targetFocus = await page.evaluate(() => RG.ui.game.game.state.towers[0].targetMode === 'strong' && document.activeElement.dataset.k === 'tm:strong');
  // 6c) 이야기: 키보드로 들어가도 첫 Enter는 다음 대사(건너뛰기 아님)
  await page.evaluate(() => { RG.ui.closeAllModals(); RG.ui.show('title', {}); });
  await page.keyboard.press('Tab');
  await page.evaluate(() => RG.ui.show('story', { id: 's1_2', then: () => RG.ui.show('title', {}) }));
  await page.waitForTimeout(500);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  r.storyEnter = await page.evaluate(() => RG.ui.currentId() === 'story');
  await page.keyboard.press('Escape');
  // 7) 효과 줄이기: 설정을 켜면 번쩍임(번개·빛기둥)은 1초에 3번까지, 흔들림 없음, 화면에 reduce-fx
  r.reduceFx = await page.evaluate(() => {
    RG.ui.setSettings({ reduceFx: true });
    RG.fx.clear();
    const ev = [];
    for (let i = 0; i < 10; i++) ev.push({ type: 'strike', x: 3 + i * 0.3, y: 3, element: 'storm' }, { type: 'smite', x: 4, y: 4, radius: 0.6 });
    RG.fx.onEvents(ev);
    const c = RG.fx.counts();
    const shake = RG.fx.shakeOffset(40);
    const ok = c.bolts + c.pillars <= 3 && shake[0] === 0 && document.documentElement.classList.contains('reduce-fx');
    RG.ui.setSettings({ reduceFx: false });
    RG.fx.clear();
    RG.fx.onEvents(ev);
    const c2 = RG.fx.counts();
    return ok && c2.bolts + c2.pillars > 3;
  });
  // 8) 글자 크기 3단계: 뿌리 글자 크기와 버튼 글자가 함께 커짐, 예전 "큰 글씨" 설정은 "크게"로
  r.textSize = await page.evaluate(() => {
    const fs = () => parseFloat(getComputedStyle(document.documentElement).fontSize);
    const btn = () => parseFloat(getComputedStyle(document.querySelector('.btn')).fontSize);
    RG.ui.setSettings({ textSize: 'normal' }); const a = [fs(), btn()];
    RG.ui.setSettings({ textSize: 'xl' }); const b = [fs(), btn()];
    RG.ui.setSettings({ textSize: 'normal' });
    return a[0] === 15 && b[0] === 21 && b[1] > a[1] * 1.3;
  });
  await page.close();
  const ok = Object.values(r).every(Boolean);
  return { name: '키보드 접근성', ok, detail: Object.entries(r).map(([k, v]) => `${k} ${v ? '✓' : '✗'}`).join(' · '), errors };
}

/* ---------------- 진행 옮기기: A 브라우저에서 내보내기(파일·코드) → 저장 공간이 다른 B 브라우저에서 가져오기 ---------------- */
async function transferRun(browser) {
  const errors = [];
  const watch = (page) => { page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); }); };
  const r = {};
  // A: 진행을 쌓고 타이틀의 "진행 옮기기"에서 저장 파일 받기 + 코드 읽기
  const ctxA = await browser.newContext({ viewport: { width: 1280, height: 800 }, acceptDownloads: true });
  const a = await ctxA.newPage(); watch(a);
  await a.goto(URL);
  await a.waitForSelector('#screen-title.active');
  const sumA = await a.evaluate(() => {
    const P = RG.progress;
    for (const id of ['1-1', '1-2', '1-3', '1-4']) P.record(id, 'normal', { result: 'win', lives: 12, task: { done: true }, wave: { index: 8 } });
    P.gachaState().crystals = 2468; P.get().shards.ember_archer = 9; P.save();
    RG.ui.show('title', {});
    return { stars: P.starsTotal(), crystals: 2468 };
  });
  await a.click('#screen-title .tc-btn[title^="진행 상황 옮기기"]');
  await a.waitForSelector('.xfer-modal .xfer-code');
  await a.waitForFunction(() => /^RG1/.test(document.querySelector('.xfer-code').value));
  const code = await a.evaluate(() => document.querySelector('.xfer-code').value);
  const [dl] = await Promise.all([a.waitForEvent('download'), a.click('.xfer-modal button:has-text("저장 파일 받기")')]);
  const savePath = path.join(require('os').tmpdir(), `rg-save-${Date.now()}.txt`);
  await dl.saveAs(savePath);
  r.fileName = /^resonance-guard-save-\d{4}-\d{2}-\d{2}\.txt$/.test(dl.suggestedFilename());
  r.fileIsCode = require('fs').readFileSync(savePath, 'utf8') === code;
  await ctxA.close();

  // B-1: 처음 연 브라우저 — 코드를 붙여 넣어 가져오기 (설정 창 경로)
  const ctxB = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const b = await ctxB.newPage(); watch(b);
  await b.goto(URL);
  await b.waitForSelector('#screen-title.active');
  r.freshB = await b.evaluate(() => !RG.progress.hasSave());
  await b.click('#screen-title .tc-btn[title="설정"]');
  await b.click('.settings button:has-text("내보내기 · 가져오기")');
  await b.waitForSelector('.xfer-modal textarea[aria-label="받은 저장 코드"]');
  await b.fill('.xfer-modal textarea[aria-label="받은 저장 코드"]', 'RG1z.망가진코드');
  await b.click('.xfer-modal button:has-text("코드로 가져오기")');
  await b.waitForSelector('.toast-warn');
  r.badRejected = await b.evaluate(() => !RG.progress.hasSave());
  await b.fill('.xfer-modal textarea[aria-label="받은 저장 코드"]', code);
  await b.click('.xfer-modal button:has-text("코드로 가져오기")');
  await b.waitForSelector('.xfer-confirm');
  r.preview = await b.evaluate((s) => document.querySelector('.xfer-confirm .xfer-sum').textContent.includes(`★${s.stars}`) && document.querySelector('.xfer-confirm .xfer-sum').textContent.includes('2,468'), sumA);
  await b.click('.modal-buttons .btn-danger:has-text("가져오기")');
  await b.waitForFunction(() => RG.ui.currentId() === 'title' && !RG.ui.modalOpen());
  const gotB = await b.evaluate(() => ({ stars: RG.progress.starsTotal(), crystals: RG.progress.gachaState().crystals, shards: RG.progress.shardsOf('ember_archer'), has: RG.progress.hasSave() }));
  r.importedCode = gotB.has && gotB.stars === sumA.stars && gotB.crystals === 2468 && gotB.shards === 9;
  await b.reload();
  await b.waitForSelector('#screen-title.active');
  r.persists = await b.evaluate((s) => RG.progress.starsTotal() === s.stars, sumA);
  await ctxB.close();

  // B-2: 또 다른 브라우저(휴대폰 크기) — 저장 파일로 가져오기
  const ctxC = await browser.newContext({ viewport: { width: 390, height: 780 }, hasTouch: true });
  const c = await ctxC.newPage(); watch(c);
  await c.goto(URL);
  await c.waitForSelector('#screen-title.active');
  await c.click('#screen-title .tc-btn[title^="진행 상황 옮기기"]');
  await c.setInputFiles('.xfer-modal input.xfer-file', savePath);
  await c.waitForSelector('.xfer-confirm');
  r.mobileFits = await c.evaluate(() => { const m = document.querySelector('.xfer-modal .modal'); const b = m.getBoundingClientRect(); return b.left >= 0 && b.right <= innerWidth + 0.5; });
  await c.click('.modal-buttons .btn-danger:has-text("가져오기")');
  await c.waitForFunction(() => RG.ui.currentId() === 'title' && !RG.ui.modalOpen());
  r.importedFile = await c.evaluate((s) => RG.progress.starsTotal() === s.stars && RG.progress.gachaState().crystals === 2468, sumA);
  await ctxC.close();
  try { require('fs').unlinkSync(savePath); } catch (e) { /* 무시 */ }
  const ok = Object.values(r).every(Boolean);
  return { name: '진행 옮기기', ok, detail: Object.entries(r).map(([k, v]) => `${k} ${v ? '✓' : '✗'}`).join(' · '), errors };
}

/* ---------------- 조각 레이드: 월드 지도 → 레이드 → 탑 하나만 지을 수 있는 판 → 결과(조각) → 조각 강화 → 캠페인 판에 반영 ---------------- */
async function raidRun(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const r = {};
  await page.goto(URL);
  await page.waitForSelector('#screen-title.active');
  // 잠김: 2-6 전에는 들어가지 않음
  await page.evaluate(() => { RG.progress.get().maps['1-1'] = { cleared: true, stars: 3 }; RG.progress.save(); RG.ui.show('world', { view: 'regions' }); });
  await page.click('#screen-world .btn-raid');
  r.lockedBefore = await page.evaluate(() => RG.ui.currentId() === 'world');
  await page.evaluate(() => {
    const P = RG.progress;
    for (const m of RG.data.maps.filter((x) => x.region <= 2)) P.record(m.id, 'normal', { result: 'win', lives: 12, task: { done: true }, wave: { index: 8 } });
    for (const id of Object.keys(RG.data.story)) P.markSeen('story', id);
    P.gachaState().owned.flame_mortar = 0; P.save();
    RG.ui.show('world', { view: 'regions' });
  });
  await page.click('#screen-world .btn-raid');
  await page.waitForSelector('#screen-raid.active .rd-tower');
  r.opens = true;
  r.listOwned = await page.evaluate(() => document.querySelectorAll('.rd-tower').length === RG.progress.ownedTowers().length);
  await page.click('.rd-tower:has-text("화염 박격포")');
  r.locked2 = await page.evaluate(() => document.querySelectorAll('.rd-diff.locked').length === 4);
  await page.click('#screen-raid .brief-actions .btn-primary');
  await page.waitForFunction(() => RG.ui.game.game && !document.querySelector('#screen-game').classList.contains('loading'));
  const g0 = await page.evaluate(() => {
    const g = RG.ui.game.game;
    const dock = [...document.querySelectorAll('.tower-card')].map((c) => c.dataset.type);
    let other = null;
    for (let rr = 0; rr < g.map.rows && !other; rr++) for (let c = 0; c < g.map.cols; c++) { const cb = g.canBuild('flame_mortar', c, rr); if (cb.ok) { other = g.cmd({ type: 'build', tower: 'ember_archer', c, r: rr }); break; } }
    return { dock, other, map: g.def.id, banner: document.querySelector('#screen-game').textContent.includes('조각 레이드') };
  });
  r.onlyThatTower = JSON.stringify(g0.dock) === JSON.stringify(['flame_mortar']) && g0.other && !g0.other.ok;
  r.banner = g0.banner && g0.map === 'R1';
  // 박격포를 지어 실제로 이기기 (빨리 끝내려고 시뮬레이션만 코드로 돌림 — 짓기는 실제 카드 누르기)
  await page.click('.tower-card[data-type="flame_mortar"]');
  const spots = await page.evaluate(targetsInPage);
  for (const t of spots.slice(0, 1)) {
    const p = await page.evaluate(({ c, r }) => { const s = RG.render.worldToScreen(c + 0.5, r + 0.5); const b = document.querySelector('.game-canvas').getBoundingClientRect(); return { x: b.left + s.x, y: b.top + s.y }; }, t);
    await page.mouse.click(p.x, p.y);
  }
  r.builtByClick = await page.evaluate(() => RG.ui.game.game.state.towers.length === 1);
  await page.evaluate((spots) => {
    const g = RG.ui.game.game;
    g.state.gold += 3000;
    for (const t of spots.slice(1, 7)) g.cmd({ type: 'build', tower: 'flame_mortar', c: t.c, r: t.r });
    for (let k = 0; k < 3; k++) for (const t of g.state.towers) g.cmd({ type: 'upgrade', id: t.id });
    g.cmd({ type: 'callWave' });
    for (let i = 0; i < 30 * 60 * 20 && !g.state.result; i++) { if (g.state.wave.countdown != null) g.cmd({ type: 'callWave' }); g.step(); }
  }, spots);
  await page.waitForSelector('#screen-result.active .rd-reward', { timeout: 15000 });
  const res = await page.evaluate(() => ({ text: document.querySelector('#screen-result').textContent, shards: RG.progress.shardsOf('flame_mortar'), best: RG.progress.raidBest('flame_mortar'), rmaps: Object.keys(RG.progress.get().maps).filter((k) => k.startsWith('R')).length }));
  r.wonShards = res.shards === 6 && res.best === 1 && res.text.includes('+6') && res.text.includes('화염 박격포 조각');
  r.noMapRecord = res.rmaps === 0;
  r.nextDiffButton = await page.evaluate(() => [...document.querySelectorAll('#screen-result .result-buttons .btn')].some((b) => b.textContent.includes('다음 난이도')));
  // 레이드로 돌아가 조각 강화
  await page.click('#screen-result .result-buttons .btn:has-text("레이드로")');
  await page.waitForSelector('#screen-raid.active .rd-shard');
  await page.evaluate(() => { RG.progress.get().shards.flame_mortar = 30; RG.progress.save(); RG.ui.show('raid', { tower: 'flame_mortar' }); });
  await page.click('.rd-shard-act .btn-primary');
  r.upgraded = await page.evaluate(() => RG.progress.shardLvOf('flame_mortar') === 1 && RG.progress.shardsOf('flame_mortar') === 20);
  // 캠페인 출정 준비 → 판에 조각 강화가 넘어감, 도전에는 안 넘어감
  await page.evaluate(() => RG.ui.show('brief', { mapId: '1-2' }));
  r.chipBadge = await page.evaluate(() => !!document.querySelector('#screen-brief .t-chip .shard-lv'));
  await page.click('#screen-brief .btn-primary.btn-big');
  await page.waitForFunction(() => RG.ui.game.game && RG.ui.currentId() === 'game');
  r.campaignGetsShard = await page.evaluate(() => RG.ui.game.game.shards.flame_mortar === 1);
  await page.evaluate(() => { RG.save.remove(RG.save.KEYS.run); RG.ui.show('brief', { mapId: '1-2', mode: 'challenge' }); });
  await page.click('#screen-brief .btn-primary.btn-big');
  await page.waitForFunction(() => RG.ui.game.game && RG.ui.currentId() === 'game');
  r.challengeNoShard = await page.evaluate(() => !RG.ui.game.game.shards.flame_mortar && !RG.ui.game.game.opts.shardLv);
  await ctx.close();
  const ok = Object.values(r).every(Boolean);
  return { name: '조각 레이드', ok, detail: Object.entries(r).map(([k, v]) => `${k} ${v ? '✓' : '✗'}`).join(' · '), errors };
}

/* ---------------- 각성: 조각 5단계 탑 → 판 안에서 분기 뒤 '✦ 각성' 카드 누르기 / U 키 → Lv5, 4단계 탑은 안내만 ---------------- */
async function awakenRun(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const r = {};
  await page.goto(URL);
  await page.waitForSelector('#screen-title.active');
  await page.evaluate(() => {
    const P = RG.progress;
    for (const m of RG.data.maps.filter((x) => x.region <= 2)) P.record(m.id, 'normal', { result: 'win', lives: 12, task: { done: true }, wave: { index: 8 } });
    for (const id of Object.keys(RG.data.story)) P.markSeen('story', id);
    for (const m of RG.data.maps) for (const t of m.tips || []) P.markSeen('tips', t);
    P.get().shardLv = { ember_archer: 5, frost_crystal: 4 }; P.save();
    RG.ui.show('brief', { mapId: '2-2' });
  });
  await page.click('#screen-brief .btn-primary.btn-big');
  await page.waitForFunction(() => RG.ui.game.game && !document.querySelector('#screen-game').classList.contains('loading'));
  r.optsCarry = await page.evaluate(() => RG.ui.game.game.opts.shardStart === true && RG.ui.game.game.shards.ember_archer === 5);
  const ids = await page.evaluate(() => {
    const ui = RG.ui.game; const g = ui.game; RG.ui.closeAllModals(); g.state.gold = 99999;
    const out = [];
    for (const type of ['ember_archer', 'ember_archer', 'frost_crystal']) {
      let done = false;
      for (let rr = 0; rr < g.map.rows && !done; rr++) for (let c = 0; c < g.map.cols && !done; c++) if (g.map.kinds[rr * g.map.cols + c] === RG.grid.T.BUILD) { const res = ui.doCmd({ type: 'build', tower: type, c, r: rr }, true); if (res.ok) { out.push(res.id); done = true; } }
    }
    for (const id of out) { while (g.state.towers.find((t) => t.id === id).level < 3) g.cmd({ type: 'upgrade', id }); g.cmd({ type: 'branch', id, branch: 'B' }); }
    return out;
  });
  const clickTower = (id) => page.evaluate((tid) => { const t = RG.ui.game.game.state.towers.find((x) => x.id === tid); const pt = RG.render.worldToScreen(t.c + 0.5, t.r + 0.5); const cv = document.querySelector('.game-canvas'); const bb = cv.getBoundingClientRect(); const o = { clientX: bb.left + pt.x, clientY: bb.top + pt.y, bubbles: true, pointerType: 'mouse' }; cv.dispatchEvent(new PointerEvent('pointerdown', o)); cv.dispatchEvent(new PointerEvent('pointerup', o)); }, id);
  // 1) 카드 누르기
  await clickTower(ids[0]);
  await page.waitForSelector('.info-panel .awaken-card, .awaken-card', { timeout: 3000 });
  await page.click('.awaken-card');
  await page.waitForTimeout(200);
  r.cardAwakens = await page.evaluate((id) => RG.ui.game.game.state.towers.find((t) => t.id === id).level === 5, ids[0]);
  r.panelShows = await page.evaluate(() => /각성/.test(document.querySelector('.ip-sub') ? document.querySelector('.ip-sub').textContent : '') && !!document.querySelector('.ip-awake-desc'));
  // 2) U 키
  await page.keyboard.press('Escape');
  await clickTower(ids[1]);
  await page.waitForTimeout(150);
  await page.keyboard.press('u');
  await page.waitForTimeout(200);
  r.keyAwakens = await page.evaluate((id) => RG.ui.game.game.state.towers.find((t) => t.id === id).level === 5, ids[1]);
  // 3) 조각 4단계 탑: 각성 없음, 안내만
  await page.keyboard.press('Escape');
  await clickTower(ids[2]);
  await page.waitForTimeout(150);
  r.hintOnly = await page.evaluate(() => !document.querySelector('.awaken-card') && /◆4\/5/.test((document.querySelector('.awaken-hint') || {}).textContent || ''));
  await page.keyboard.press('u');
  await page.waitForTimeout(150);
  r.noAwakenAt4 = await page.evaluate((id) => RG.ui.game.game.state.towers.find((t) => t.id === id).level === 4, ids[2]);
  // 4) 그림이 그려지는 동안 오류 없음
  await page.evaluate(() => { RG.ui.game.doCmd({ type: 'callWave' }, true); RG.ui.game.setSpeed(2); });
  await page.waitForTimeout(2000);
  r.noErrors = errors.length === 0;
  await ctx.close();
  const ok = Object.values(r).every(Boolean);
  return { name: '각성', ok, detail: Object.entries(r).map(([k, v]) => `${k} ${v ? '✓' : '✗'}`).join(' · '), errors };
}

/* ---------------- 싸우는 중 강화 단추: 적이 맞아 피해·골드가 계속 바뀌는 동안 누르고 있다가 떼도 강화됨 (예전엔 창이 다시 그려져 눌리지 않았음) ---------------- */
async function pressRun(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(URL);
  await page.waitForSelector('#screen-title.active');
  await page.evaluate(() => { for (const id of Object.keys(RG.data.story)) RG.progress.markSeen('story', id); for (const m of RG.data.maps) for (const t of m.tips || []) RG.progress.markSeen('tips', t); RG.progress.get().maps['1-1'] = { cleared: true, stars: 3 }; RG.progress.save(); RG.ui.show('game', { opts: { mapId: '1-2', heroId: 'kara', seed: 4, mode: 'normal', towers: ['ember_archer', 'frost_crystal', 'stone_barracks'], branches: true } }); });
  await page.waitForFunction(() => RG.ui.game.game && !document.querySelector('#screen-game').classList.contains('loading'));
  const spots = await page.evaluate(targetsInPage);
  const id = await page.evaluate((sp) => { const ui = RG.ui.game; RG.ui.closeAllModals(); ui.game.state.gold = 5000; for (const t of sp) { const r = ui.doCmd({ type: 'build', tower: 'ember_archer', c: t.c, r: t.r }, true); if (r.ok) return r.id; } return null; }, spots);
  await page.evaluate(() => RG.ui.game.doCmd({ type: 'callWave' }, true));
  await page.waitForFunction(() => Object.values(RG.ui.game.game.state.stats.damageByTower).some((v) => v > 0), null, { timeout: 20000 });
  await page.evaluate((tid) => { const t = RG.ui.game.game.state.towers.find((x) => x.id === tid); const pt = RG.render.worldToScreen(t.c + 0.5, t.r + 0.5); const cv = document.querySelector('.game-canvas'); const bb = cv.getBoundingClientRect(); const o = { clientX: bb.left + pt.x, clientY: bb.top + pt.y, bubbles: true, pointerType: 'mouse' }; cv.dispatchEvent(new PointerEvent('pointerdown', o)); cv.dispatchEvent(new PointerEvent('pointerup', o)); }, id);
  await page.waitForSelector('.btn-up');
  let ok = 0;
  for (let i = 0; i < 2; i++) {
    const before = await page.evaluate((tid) => RG.ui.game.game.state.towers.find((x) => x.id === tid).level, id);
    const box = await page.locator('.btn-up').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(250);
    await page.evaluate(() => { RG.ui.game.game.state.gold += 37; }); // 누르는 동안 골드가 바뀜 (처치 골드처럼)
    await page.waitForTimeout(150);
    await page.mouse.up();
    await page.waitForTimeout(200);
    if (await page.evaluate((tid) => RG.ui.game.game.state.towers.find((x) => x.id === tid).level, id) > before) ok++;
  }
  await ctx.close();
  return { name: '싸우는 중 강화 단추', ok: ok === 2 && !errors.length, detail: `누르고 있다 떼기 2번 중 ${ok}번 강화`, errors };
}

/* ---------------- 공명석 웨이브: 뽑기 화면 → 공명석 웨이브 → 쉬움 판(가진 탑 모두) → 이기면 +500 → 탑 뽑기로 ---------------- */
async function crystalRun(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const r = {};
  await page.goto(URL);
  await page.waitForSelector('#screen-title.active');
  r.lockedBefore = await page.evaluate(() => !RG.progress.crystalOpen() && !document.querySelector('.tm-crystal'));
  await page.evaluate(() => {
    const P = RG.progress;
    for (const id of ['1-1', '1-2', '1-3']) P.record(id, 'normal', { result: 'win', lives: 12, task: { done: true }, wave: { index: 8 } });
    for (const id of Object.keys(RG.data.story)) P.markSeen('story', id);
    for (const m of RG.data.maps) for (const t of m.tips || []) P.markSeen('tips', t);
    P.gachaState().crystals = 40; P.save();
    RG.ui.show('gacha', {});
  });
  await page.click('#screen-gacha .btn-crystal');
  await page.waitForSelector('#screen-crystal.active .cr-card');
  r.cards = await page.evaluate(() => document.querySelectorAll('.cr-card').length === 3 && document.querySelectorAll('.cr-card.locked').length === 2 && /500/.test(document.querySelector('.cr-card.on').textContent));
  await page.click('#screen-crystal .brief-actions .btn-primary');
  await page.waitForFunction(() => RG.ui.game.game && !document.querySelector('#screen-game').classList.contains('loading'));
  const g0 = await page.evaluate(() => ({ map: RG.ui.game.game.def.id, dock: document.querySelectorAll('.tower-card').length, owned: RG.progress.ownedTowers().length, hud: document.querySelector('.task-box').textContent, banner: document.querySelector('#screen-game').textContent.includes('공명석 웨이브') }));
  r.allTowers = g0.dock === g0.owned && g0.map === 'C1';
  r.hud = /공명석 웨이브/.test(g0.hud) && /\+500/.test(g0.hud) && g0.banner;
  const spots = await page.evaluate(targetsInPage);
  await page.evaluate((sp) => {
    const ui = RG.ui.game; const g = ui.game; RG.ui.closeAllModals(); g.state.gold += 4000;
    const types = ['ember_archer', 'frost_crystal', 'stone_barracks'];
    let k = 0;
    // 사람처럼: 번 골드로 길가에 탑을 더 짓고, 남으면 올림 (20웨이브라 처음에 지은 것만으로는 모자람)
    const spend = () => {
      for (const t of sp) { if (g.state.gold < 120) break; if (g.tileTower && g.tileTower(t.c, t.r)) continue; if (g.cmd({ type: 'build', tower: types[k % 3], c: t.c, r: t.r }).ok) k++; }
      for (const t of g.state.towers.slice().sort((a, b) => a.level - b.level)) { if (t.level < 3) g.cmd({ type: 'upgrade', id: t.id }); }
    };
    spend();
    g.cmd({ type: 'callWave' });
    for (let i = 0; i < 30 * 60 * 30 && !g.state.result; i++) { if (i % 30 === 0) spend(); g.step(); } // 다음 웨이브는 저절로 (일찍 부르면 겹쳐 몰려옴)
  }, spots.slice(0, 40));
  await page.waitForSelector('#screen-result.active .cr-result', { timeout: 15000 });
  const res = await page.evaluate(() => ({ text: document.querySelector('#screen-result').textContent, crystals: RG.progress.gachaState().crystals, clears: RG.progress.crystalClears(1), maps: Object.keys(RG.progress.get().maps).filter((k) => k.startsWith('C')).length }));
  r.got500 = res.crystals === 540 && res.clears === 1 && res.text.includes('+500');
  if (!r.got500) console.log('crystal result', JSON.stringify({ crystals: res.crystals, clears: res.clears, text: res.text.slice(0, 120) }));
  r.noMapRecord = res.maps === 0;
  await page.click('#screen-result .result-buttons .btn-gacha');
  await page.waitForSelector('#screen-gacha.active .gc-pull');
  r.toGacha = await page.evaluate(() => !document.querySelector('.gc-pull:not(.gc-ten)').disabled);
  // 판 중간: 이어하기 글은 '웨이브 n/20', 일시정지 → '끝내고 +x 받기'로 막아 낸 만큼 받음 (검토 2026-11-14)
  await page.evaluate(() => RG.ui.show('crystal', {}));
  await page.waitForSelector('#screen-crystal.active .cr-card');
  await page.click('#screen-crystal .brief-actions .btn-primary');
  await page.waitForFunction(() => RG.ui.game.game && !document.querySelector('#screen-game').classList.contains('loading'));
  await page.evaluate((sp) => {
    const g = RG.ui.game.game; RG.ui.closeAllModals(); g.state.gold += 1500;
    for (const t of sp) g.cmd({ type: 'build', tower: 'ember_archer', c: t.c, r: t.r });
    g.cmd({ type: 'callWave' });
    for (let i = 0; i < 30 * 60 * 30 && g.state.wave.index < 7; i++) g.step();
  }, spots.slice(0, 14));
  await page.evaluate(() => RG.ui.show('title', {})); // 나가면 이어하기로 저장
  await page.waitForSelector('#screen-title.active');
  r.resumeLabel = await page.evaluate(() => /웨이브 \d+\/20/.test(document.querySelector('.tm-kicker').textContent));
  await page.click('#screen-title .tm-hero');
  await page.waitForFunction(() => RG.ui.game.game && RG.ui.game.game.state.wave.index >= 7 && !document.querySelector('#screen-game').classList.contains('loading'), null, { timeout: 30000 });
  await page.evaluate(() => RG.ui.closeAllModals());
  const before = await page.evaluate(() => ({ c: RG.progress.gachaState().crystals, hud: document.querySelector('.task-box').textContent }));
  const hudNow = +((/지금 끝나면 \+(\d+)/.exec(before.hud) || [])[1] || -1);
  await page.keyboard.press('Escape');
  await page.waitForSelector('.modal .modal-buttons');
  const endBtn = page.locator('.modal .modal-buttons .btn', { hasText: '끝내고' });
  r.endButton = (await endBtn.count()) === 1 && hudNow > 0;
  if (r.endButton) {
    await endBtn.click();
    await page.click('.modal .modal-buttons .btn-primary');
    await page.waitForSelector('#screen-result.active .cr-result', { timeout: 15000 });
    const after = await page.evaluate(() => ({ c: RG.progress.gachaState().crystals, text: document.querySelector('#screen-result').textContent, run: RG.save.get(RG.save.KEYS.run) }));
    r.endPaid = after.c - before.c === hudNow && after.text.includes('여기서 마쳤다') && after.text.includes(`+${hudNow}`) && !after.run;
    if (!r.endPaid) console.log('crystal end', JSON.stringify({ before, hudNow, after: { c: after.c, text: after.text.slice(0, 160) } }));
  }
  await ctx.close();
  const ok = Object.values(r).every(Boolean) && !errors.length;
  return { name: '공명석 웨이브', ok, detail: Object.entries(r).map(([k, v]) => `${k} ${v ? '✓' : '✗'}`).join(' · '), errors };
}

(async () => {
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const runs = { keyboard: keyboardRun, touch: touchRun, mouse: mouseRun, resume: resumeRun, world: worldRun, gacha: gachaRun, tutorial: tutorialRun, a11y: a11yRun, transfer: transferRun, raid: raidRun, awaken: awakenRun, press: pressRun, crystal: crystalRun };
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
