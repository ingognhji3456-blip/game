'use strict';

/*
 * NEON RAID 테스트 (Node 로 실행: node tests/neon-raid.test.js)
 *  - 데이터: 보스 10명 · 기체 5종 · 강화 6종 · 스테이지 색
 *  - 메뉴: 로비 → 스테이지 선택 → 출격, 잠긴 스테이지 · 2장 잠금, 격납고 구매 · 강화 구매 · 저장
 *  - 전투: 보스 10명 × 4단계를 각각 돌리며 오류 · 숫자 이상이 없는지 (그리기 포함)
 *  - 규칙: 단계 전환(체력 2배), 4단계 격파 → 다음 스테이지, 10번째 보스 → 승리, 체력 0 → 스테이지 선택
 *  - 글자: 모든 화면의 글자가 한국어 (영어 낱말이 남아 있지 않음)
 *  - 레이저: 화면 끝까지 그려짐(판정과 같은 길이), 쏜 보스에 붙어 움직임, 맞기 전에 예고(충전),
 *            물 지뢰는 십자 네 방향, 7번 보스는 갈라지면 연결 레이저가 사라지고 남은 기체에서만 쏨
 *  - 화면 흔들림 · 번쩍임: 전투가 끝나 메뉴 · 전환 · 승리 화면으로 가도 금방 멈춤
 * 원본(Replit)과의 비교는 브라우저에서 같은 난수 · 같은 입력으로 화면을 찍어 픽셀 단위로 했습니다 (README 참고).
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '..', 'neon-raid');

/** 캔버스 · 창 · 저장소를 흉내 내는 가짜 DOM. 그리기 호출은 모두 받아 넘기고, 숫자가 이상하면 잡아냄 */
function fakeDom() {
  const listeners = {};
  const store = {};
  const badDraws = [];
  const texts = [];
  const lines = [];          // 그려진 선분 (moveTo → lineTo)
  const translates = [];     // 화면 흔들림 (render 가 ctx.translate 로 화면을 옮김)
  let pen = null;
  const gradient = { addColorStop() {} };
  const ctxTarget = { canvas: null };
  const ctx = new Proxy(ctxTarget, {
    get(t, k) {
      if (k in t) return t[k];
      if (k === 'createRadialGradient' || k === 'createLinearGradient') return () => gradient;
      if (k === 'measureText') return () => ({ width: 10 });
      if (k === 'fillText') return (txt) => { texts.push(String(txt)); };
      if (k === 'translate') return (x, y) => { translates.push([x, y]); };
      if (k === 'moveTo') return (x, y) => { pen = [x, y]; };
      if (k === 'lineTo') return (x, y) => { if (pen) lines.push([pen[0], pen[1], x, y]); pen = [x, y]; };
      return (...args) => {
        for (const a of args) if (typeof a === 'number' && !Number.isFinite(a)) badDraws.push(`${String(k)}(${args.join(', ')})`);
        // 진짜 캔버스는 반지름이 음수면 오류를 냄
        if ((k === 'arc' && args[2] < 0) || (k === 'ellipse' && (args[2] < 0 || args[3] < 0))) badDraws.push(`${String(k)}(${args.join(', ')})`);
      };
    },
    set(t, k, v) { t[k] = v; return true; },
  });
  const canvas = {
    width: 540, height: 960,
    getContext: () => ctx,
    addEventListener: (type, fn) => { (listeners['canvas:' + type] = listeners['canvas:' + type] || []).push(fn); },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 540, height: 960 }),
  };
  const window = {
    addEventListener: (type, fn) => { (listeners['window:' + type] = listeners['window:' + type] || []).push(fn); },
  };
  const localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
  };
  const fire = (key, ev) => (listeners[key] || []).forEach((fn) => fn(ev));
  return { canvas, window, localStorage, store, fire, badDraws, texts, lines, translates };
}

function load() {
  const dom = fakeDom();
  const sandbox = {
    console, Math, JSON, Object, Array, Number, String, Set, Map, Error,
    window: dom.window, localStorage: dom.localStorage,
    // 그림 캐시가 만드는 오프스크린 캔버스도 가짜 캔버스로 (그리는 코드까지 실제로 돌아감)
    document: { createElement: () => ({ width: 0, height: 0, getContext: () => dom.canvas.getContext('2d') }) },
    performance: { now: () => 0 }, requestAnimationFrame: () => 0, cancelAnimationFrame: () => {},
  };
  vm.createContext(sandbox);
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
  assert.deepStrictEqual(scripts, ['js/constants.js', 'js/graphics.js', 'js/engine.js', 'js/main.js']);
  for (const src of scripts.slice(0, 3)) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, src), 'utf8'), sandbox, { filename: src });
  }
  const get = (name) => vm.runInContext(name, sandbox);
  return { dom, get };
}

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    console.error(`  ✗ ${name}\n    ${e.stack}`);
    process.exitCode = 1;
  }
}

/** 새 엔진 (저장 데이터를 미리 넣을 수 있음) */
function newEngine(save) {
  const env = load();
  if (save) env.dom.localStorage.setItem('neon_raid_save', JSON.stringify(save));
  const Engine = env.get('NeonRaidEngine');
  const e = new Engine(env.dom.canvas);
  return { e, env, C: env.get('({ STAGE_INFO, CHARACTERS, UPGRADES, STAGE_COLORS, WIDTH, HEIGHT })') };
}
const tick = (e, n, renderEvery = 0) => {
  for (let i = 0; i < n; i++) {
    e.update();
    if (renderEvery && i % renderEvery === 0) e.render();
  }
};
const click = (env, x, y) => { env.dom.fire('canvas:mousedown', { clientX: x, clientY: y }); env.dom.fire('canvas:mouseup', {}); };
const savedData = (env) => JSON.parse(env.dom.localStorage.getItem('neon_raid_save'));
const RICH = { coins: 99999, cleared_stages: [1, 2, 3, 4, 5, 6, 7, 8, 9], selected_char: 0, owned_chars: [0], upgrades: { speed: 0, hp: 0, damage: 0, fire: 0, shield: 0, magnet: 0 } };

test('데이터: 보스 10명 · 기체 5종 · 강화 6종, 스테이지마다 단계 색 4개', () => {
  const { C } = newEngine();
  assert.strictEqual(C.WIDTH, 540);
  assert.strictEqual(C.HEIGHT, 960);
  assert.deepStrictEqual(Object.keys(C.STAGE_INFO).map(Number), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.strictEqual(Object.keys(C.CHARACTERS).length, 5);
  assert.deepStrictEqual(Object.keys(C.UPGRADES), ['speed', 'hp', 'damage', 'fire', 'shield', 'magnet']);
  for (let s = 1; s <= 10; s++) assert.strictEqual(C.STAGE_COLORS[s].length, 4);
  for (const u of Object.values(C.UPGRADES)) assert.strictEqual(u.costs.length, u.max);
});

test('메뉴: 로비 → 스테이지 선택 → 출격, 잠긴 스테이지는 못 고르고 2장은 1장을 다 깨야 열림', () => {
  const { e, env } = newEngine();
  assert.strictEqual(e.state, 'LOBBY');
  click(env, 270, 610);                       // ▶ CHALLENGE
  assert.strictEqual(e.state, 'STAGE_SELECT');
  click(env, 270, 130 + 1 * 115 + 50);        // 2번 스테이지 (잠김)
  assert.strictEqual(e.selectedStage, 1);
  click(env, 405, 95);                        // CHAPTER II (잠김)
  assert.strictEqual(e.currentChapter, 1);
  click(env, 100, 895);                       // ← BACK
  assert.strictEqual(e.state, 'LOBBY');
  click(env, 270, 610);
  click(env, 435, 895);                       // ▶ LAUNCH
  assert.strictEqual(e.state, 'PLAY');
  assert.strictEqual(e.bossStage, 1);
  assert.strictEqual(e.bhp, 30000);
  click(env, 467, 925);                       // ← SELECT (전투 중 돌아가기)
  assert.strictEqual(e.state, 'STAGE_SELECT');

  const rich = newEngine(RICH);
  click(rich.env, 270, 610);
  click(rich.env, 405, 95);                   // 1장을 다 깼으니 2장이 열림
  assert.strictEqual(rich.e.currentChapter, 2);
  click(rich.env, 270, 130 + 4 * 115 + 50);   // 10번 스테이지
  click(rich.env, 435, 895);
  assert.strictEqual(rich.e.state, 'PLAY');
  assert.strictEqual(rich.e.bossStage, 10);
});

test('격납고 · 강화: 코인으로 기체를 사고 고르며, 강화를 사면 레벨이 오르고 저장됨', () => {
  const { e, env } = newEngine({ coins: 300, cleared_stages: [], selected_char: 0, owned_chars: [0], upgrades: { speed: 0, hp: 0, damage: 0, fire: 0, shield: 0, magnet: 0 } });
  click(env, 270, 680);                       // ⚙ HANGAR
  assert.strictEqual(e.state, 'HANGAR');
  click(env, 470, 80 + 2 * 115 + 70);         // TITAN(350) — 코인 부족
  assert.deepStrictEqual(e.save.owned_chars, [0]);
  click(env, 470, 80 + 1 * 115 + 70);         // PHANTOM(200) 구매 → 바로 선택
  assert.deepStrictEqual(e.save.owned_chars, [0, 1]);
  assert.strictEqual(e.save.selected_char, 1);
  assert.strictEqual(e.save.coins, 100);
  click(env, 470, 80 + 0 * 115 + 50);         // VANGUARD 다시 선택
  assert.strictEqual(e.save.selected_char, 0);
  click(env, 100, 895);
  click(env, 270, 748);                       // ▲ UPGRADE
  assert.strictEqual(e.state, 'UPGRADE');
  click(env, 470, 75 + 0 * 108 + 50);         // SPEED BOOST 1단계(100)
  assert.strictEqual(e.save.upgrades.speed, 1);
  assert.strictEqual(e.save.coins, 0);
  click(env, 470, 75 + 1 * 108 + 50);         // MAX HP UP(120) — 코인 부족
  assert.strictEqual(e.save.upgrades.hp, 0);
  const saved = savedData(env);
  assert.strictEqual(saved.coins, 0);
  assert.strictEqual(saved.upgrades.speed, 1);
  assert.deepStrictEqual(saved.owned_chars, [0, 1]);
  // 강화가 능력치에 반영됨
  assert.strictEqual(e.getPlayerSpeed(), 4.5 + 0 + 2);
});

test('키보드로 움직이고 화면 안에서 멈춤 · 손을 떼면 미끄러지며 섬', () => {
  const { e, env } = newEngine();
  e.reset(1); e.state = 'PLAY';
  e.pmaxHp = e.php = 1e9;                     // 맞아도 죽지 않게
  env.dom.fire('window:keydown', { key: 'ArrowLeft' });
  env.dom.fire('window:keydown', { key: 'w' });
  const x0 = e.px, y0 = e.py;
  tick(e, 10);
  assert.ok(e.px < x0 && e.py < y0);
  tick(e, 300);
  assert.strictEqual(e.px, 25);
  assert.strictEqual(e.py, 150);
  env.dom.fire('window:keyup', { key: 'ArrowLeft' });
  env.dom.fire('window:keyup', { key: 'w' });
  env.dom.fire('window:keydown', { key: 'D' });
  tick(e, 5);
  assert.ok(e.px > 25);
  env.dom.fire('window:keyup', { key: 'D' });
  tick(e, 60);
  assert.ok(Math.abs(e.pvx) < 0.01, '손을 떼면 속도가 줄어듦');
});

test('보스 10명 × 4단계: 오류 없이 돌아가고 숫자가 정상 (그리기 포함)', () => {
  for (let stage = 1; stage <= 10; stage++) {
    for (let phase = 1; phase <= 4; phase++) {
      for (let char = 0; char < 5; char++) {
        if (char !== (stage + phase) % 5) continue;   // 기체도 골고루 섞어서
        const { e, env } = newEngine(Object.assign({}, RICH, { owned_chars: [0, 1, 2, 3, 4], selected_char: char }));
        e.reset(stage);
        e.state = 'PLAY';
        for (let p = 1; p < phase; p++) e.triggerPhaseTransition();
        assert.strictEqual(e.phase, phase);
        let maxBullets = 0;
        for (let i = 0; i < 900; i++) {
          e.php = 1e9;                                    // 끝까지 살아서 패턴을 모두 보도록
          e.bhp = Math.max(e.bhp, e.bmax * 0.9);          // 단계가 넘어가지 않도록
          e.px += Math.sin(i * 0.05) * 3;                 // 좌우로 흔들며
          e.update();
          if (i % 7 === 0) e.render();
          maxBullets = Math.max(maxBullets, e.bossBullets.length);
          if (e.state !== 'PLAY') break;
        }
        const where = `stage ${stage} phase ${phase}`;
        assert.strictEqual(e.state, 'PLAY', where);
        for (const v of [e.px, e.py, e.bx, e.by, e.bhp]) assert.ok(Number.isFinite(v), `${where}: 숫자 이상`);
        for (const b of e.bossBullets) assert.ok(Number.isFinite(b.p[0]) && Number.isFinite(b.p[1]), `${where}: 탄 좌표 이상`);
        assert.ok(maxBullets < 4000, `${where}: 탄이 너무 많음 (${maxBullets})`);
        assert.deepStrictEqual(env.dom.badDraws.slice(0, 3), [], `${where}: 이상한 숫자로 그림`);
      }
    }
  }
});

test('보스 체력 0 → 다음 단계(체력 2배) · 4단계 격파 → 다음 스테이지 · 저장', () => {
  const { e, env } = newEngine();
  e.reset(1); e.state = 'PLAY'; tick(e, 1);
  const kill = () => { e.bhp = 1; e.bullets.push({ p: [e.bx, e.by], v: [0, 0] }); e.update(); };
  for (let p = 2; p <= 4; p++) {
    const before = e.bmax;
    kill();
    assert.strictEqual(e.phase, p);
    assert.strictEqual(e.bmax, before * 2);
    assert.strictEqual(e.bhp, e.bmax);
    assert.strictEqual(e.bossBullets.length, 0, '단계가 바뀌면 탄이 사라짐');
  }
  kill();
  assert.strictEqual(e.state, 'TRANSITION');
  tick(e, 179, 20);
  assert.strictEqual(e.state, 'TRANSITION');
  tick(e, 1);
  assert.strictEqual(e.state, 'PLAY');
  assert.strictEqual(e.bossStage, 2);
  assert.strictEqual(e.phase, 1);
  assert.strictEqual(e.bhp, 40000);
  assert.deepStrictEqual(savedData(env).cleared_stages, [1]);
});

test('10번째 보스를 4단계까지 깨면 승리 화면 → 스테이지 선택', () => {
  const { e, env } = newEngine(RICH);
  e.reset(10); e.state = 'PLAY'; tick(e, 1);
  for (let p = 1; p <= 4; p++) { e.bhp = 1; e.bullets.push({ p: [e.bx, e.by], v: [0, 0] }); e.update(); }
  assert.strictEqual(e.state, 'WIN');
  assert.ok(savedData(env).cleared_stages.includes(10));
  e.render();
  click(env, 270, 480 + 50);                  // STAGE SELECT
  assert.strictEqual(e.state, 'STAGE_SELECT');
});

test('체력이 0 이 되면 스테이지 선택으로 · 코인을 주우면 저장됨', () => {
  const { e, env } = newEngine();
  e.reset(1); e.state = 'PLAY';
  const coin = e.coinOrbs[0];
  coin.x = e.px + 17; coin.y = e.py + 17;
  e.update();
  assert.strictEqual(e.save.coins, 10);
  assert.strictEqual(e.sessionCoins, 10);
  e.php = 0;
  e.update();
  assert.strictEqual(e.state, 'STAGE_SELECT');
  assert.strictEqual(savedData(env).coins, 10);
});

test('모든 화면의 글자가 한국어 (영어 낱말이 남아 있지 않음)', () => {
  const { e, env } = newEngine({ coins: 650, cleared_stages: [1, 2, 3, 4, 5, 6], selected_char: 2, owned_chars: [0, 1, 2], upgrades: { speed: 5, hp: 2, damage: 0, fire: 1, shield: 0, magnet: 3 } });
  const show = (setup, ticks = 1) => { setup(); for (let i = 0; i < ticks; i++) e.update(); e.render(); };
  show(() => { e.state = 'LOBBY'; });
  show(() => { e.state = 'HANGAR'; });
  show(() => { e.state = 'UPGRADE'; });
  show(() => { e.state = 'STAGE_SELECT'; e.currentChapter = 1; e.selectedStage = 3; });
  show(() => { e.state = 'STAGE_SELECT'; e.currentChapter = 2; e.selectedStage = 9; });  // 9는 잠김 → '스테이지를 고르세요'
  for (let stage = 1; stage <= 10; stage++) {
    show(() => { e.reset(stage); e.state = 'PLAY'; e.php = 1e9; if (stage === 6) e.b6OverchargeTimer = 999; if (stage === 10) { e.triggerPhaseTransition(); e.triggerPhaseTransition(); } }, 30);
  }
  show(() => { e.pHpFlashHeal = 20; });
  for (const t of [10, 70, 130]) show(() => { e.reset(3); e.state = 'TRANSITION'; e.transitionTimer = t; }, 0);
  show(() => { e.state = 'WIN'; });
  const drawn = [...new Set(env.dom.texts)];
  const ALLOWED = new Set(['WASD', 'EMP', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']);
  const english = drawn.filter((t) => (t.match(/[A-Za-z]+/g) || []).some((w) => !ALLOWED.has(w)));
  assert.deepStrictEqual(english, [], '영어가 남은 글자');
  for (const must of ['네온 레이드', '▶  도전', '조종사 격납고', '강화', '스테이지 선택', '▶ 출격', '⚠ 중력 왜곡', '▶ 과충전 ◀', '보스 격파!', '승리!']) {
    assert.ok(drawn.includes(must), `화면에 '${must}' 가 나와야 함`);
  }
  assert.ok(drawn.some((t) => /^⚠ 붕괴까지 \d+초$/.test(t)), '블랙홀 제한 시간');
  assert.ok(drawn.some((t) => /\[\d단계\]$/.test(t)), '보스 이름 옆 단계 표시');
});

test('레이저는 화면 끝까지 그려짐 (판정 길이와 같음 · 중간에서 끊기지 않음)', () => {
  const cases = [
    ['1번 4단계 쓸어 가는 레이저', 1, 4, (e) => { e.phaseTimer = 0; }, 120],
    ['2번 회전 광선', 2, 3, () => {}, 120],
    ['3번 조준 레이저', 3, 4, () => {}, 130],
    ['5번 팔 레이저', 5, 1, (e) => { e.b5ArmLaserTimer = 170; }, 40],
    ['6번 과충전 레이저', 6, 2, (e) => { e.b6OverchargeTimer = 999; }, 50],
    ['9번 물 지뢰 레이저', 9, 2, (e) => { e.b2Mines.push({ x: 270, y: 500, vy: 0, timer: 2, r: 13, is_water_mine: true }); }, 10],
    ['10번 블랙홀 레이저', 10, 3, () => {}, 120],
  ];
  for (const [name, stage, phase, setup, ticks] of cases) {
    const { e, env } = newEngine();
    e.reset(stage); e.state = 'PLAY';
    for (let p = 1; p < phase; p++) e.triggerPhaseTransition();
    setup(e);
    let longLines = 0;
    for (let i = 0; i < ticks; i++) {
      e.php = 1e9; e.update();
      env.dom.lines.length = 0;
      e.render();
      for (const [x1, y1, x2, y2] of env.dom.lines) {
        if (Math.hypot(x2 - x1, y2 - y1) < 400) continue;           // 레이저만 (몸체·HUD 선은 짧음)
        longLines += 1;
        const inside = x2 > -1 && x2 < 541 && y2 > -1 && y2 < 961;
        assert.ok(!inside, `${name}: 레이저가 화면 안 (${x2 | 0}, ${y2 | 0}) 에서 끊김`);
      }
    }
    assert.ok(longLines > 0, `${name}: 레이저가 그려져야 함`);
  }
});

test('보스가 쏜 레이저는 보스에 붙어 움직이고, 물 지뢰는 십자 네 방향', () => {
  const { e } = newEngine();
  e.reset(3); e.state = 'PLAY'; e.triggerPhaseTransition();      // 드래곤 2단계: 머리에서 조준 레이저
  let checked = 0;
  for (let i = 0; i < 400; i++) {
    e.php = 1e9; e.update();
    for (const l of e.lasers) { assert.ok(l.s[0] === e.bx && l.s[1] === e.by, '레이저 시작점 = 드래곤 머리'); checked += 1; }
  }
  assert.ok(checked > 50);

  const w = newEngine().e;
  w.reset(9); w.state = 'PLAY'; w.triggerPhaseTransition(); w.update();
  w.lasers = []; w.b2Mines = [{ x: 270, y: 500, vy: 0, timer: 1, r: 13, is_water_mine: true }];
  w.timer = 1;                                                     // 다른 패턴과 겹치지 않는 틱
  w.php = 1e9; w.update();
  const dirs = w.lasers.filter((l) => !l.follow).map((l) => Math.round(((l.ang % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) / (Math.PI / 2)) % 4).sort();
  assert.deepStrictEqual(dirs, [0, 1, 2, 3]);
});

test('켜진 채 남는 레이저는 예열(조준선)이 끝나야 맞음', () => {
  // 1번 4단계: 단계가 바뀐 직후에는 바로 아래에 있어도 안 맞고, 예열이 끝나면 맞음
  const { e } = newEngine();
  e.reset(1); e.state = 'PLAY';
  for (let p = 1; p < 4; p++) e.triggerPhaseTransition();
  e.bx = 270; e.by = 100; e.b1SweepAng = Math.PI / 2; e.b1SweepDir = 1; e.itime = 0;
  const hp = e.php;
  e.phaseTimer = 10; e.updateBoss1(270, 400, 14);
  assert.strictEqual(e.php, hp, '예열 중에는 안 맞음');
  e.phaseTimer = 100; e.b1SweepAng = Math.PI / 2; e.updateBoss1(270, 400, 14);
  assert.strictEqual(e.php, hp - 4, '예열 뒤에는 맞음');
  // 2번 회전 광선: 막 나온 광선은 안 맞고, 예열 뒤에는 맞음
  const b = newEngine().e;
  b.reset(2); b.state = 'PLAY'; b.triggerPhaseTransition();
  b.bx = 270; b.by = 100; b.itime = 0; b.timer = 1;
  b.b2Beams = [{ cx: 270, cy: 100, ang: Math.PI / 2, speed: 0, life: 999 }];
  const hp2 = b.php;
  b.updateBoss2(270, 400, 14);
  assert.strictEqual(b.php, hp2);
  b.b2Beams[0].age = 100; b.updateBoss2(270, 400, 14);
  assert.ok(b.php < hp2);
});

test('7번 보스: 체력 절반에서 갈라지면 연결 레이저가 끊기고, 남은 기체(맞는 쪽)에서만 쏨', () => {
  const { e } = newEngine();
  e.reset(7); e.state = 'PLAY'; e.update();
  // 이어져 있을 때: 두 기체 사이 레이저에 맞음
  let mid = [(e.b7Pos1[0] + e.b7Pos2[0]) / 2, (e.b7Pos1[1] + e.b7Pos2[1]) / 2];
  e.itime = 0; let hp = e.php;
  e.timer = 1; e.updateBoss7(mid[0], mid[1], 14);
  assert.ok(e.php < hp, '연결 레이저에 맞아야 함');
  // 갈라지면: 같은 자리여도 안 맞고, 탄은 첫 번째 기체에서만 나감
  e.bhp = e.bmax * 0.4; e.timer = 1; e.updateBoss7(0, 0, 14);
  assert.ok(e.b7Enraged);
  mid = [(e.b7Pos1[0] + e.b7Pos2[0]) / 2, (e.b7Pos1[1] + e.b7Pos2[1]) / 2];
  e.itime = 0; hp = e.php; e.bossBullets = [];
  e.timer = 70; e.updateBoss7(mid[0], mid[1], 14);             // timer 70: 조준탄 + 톱날이 함께 나오는 틱
  assert.strictEqual(e.php, hp, '갈라진 뒤에는 연결 레이저가 없음');
  assert.ok(e.bossBullets.length >= 4);
  for (const b of e.bossBullets) assert.ok(b.p[0] === e.b7Pos1[0] && b.p[1] === e.b7Pos1[1], '남은 기체에서만 쏨');
  // 맞는 판정도 남은 기체(첫 번째)
  e.bullets = [{ p: [e.b7Pos1[0], e.b7Pos1[1]], v: [0, 0] }];
  const bhp = e.bhp; e.php = 1e9; e.update();
  assert.ok(e.bhp < bhp);
});

test('화면 흔들림 · 번쩍임은 어느 화면에서든 금방 멈춤 (맞다가 죽어도 메뉴가 계속 흔들리지 않음)', () => {
  // 화면이 멈춰 있는지: render 를 몇 번 불러 화면 이동이 모두 0 이고 덮개가 없는지
  const still = (e, env, where) => {
    // render 의 첫 이동이 화면 흔들림 (그 뒤 기체 그림 등의 이동은 상관없음)
    for (let i = 0; i < 5; i++) {
      env.dom.translates.length = 0;
      e.render();
      const [x, y] = env.dom.translates[0];
      assert.ok(x === 0 && y === 0, `${where}: 화면이 계속 흔들림`);
    }
    assert.strictEqual(e.flash, 0, `${where}: 번쩍임 덮개가 남아 있음`);
  };
  const ticks = (e, n) => { for (let i = 0; i < n; i++) e.update(); };

  // 1) 맞아서 흔들리는 중에 체력이 0 → 스테이지 선택 → 로비 (영상의 증상)
  let { e, env } = newEngine();
  e.reset(1); e.state = 'PLAY'; e.update();
  e.shake = 6; e.flash = 30; e.php = 0; e.update();
  assert.strictEqual(e.state, 'STAGE_SELECT');
  ticks(e, 30); still(e, env, '죽은 뒤 스테이지 선택');
  click(env, 100, 895); ticks(e, 5);
  assert.strictEqual(e.state, 'LOBBY'); still(e, env, '죽은 뒤 로비');

  // 2) 보스 격파 → 다음 스테이지로 넘어가는 동안 (흔들림 40 · 흰 덮개 200 이 3초 내내 남지 않음)
  ({ e, env } = newEngine());
  e.reset(1); e.state = 'PLAY'; e.update();
  for (let p = 1; p <= 4; p++) { e.bhp = 1; e.bullets.push({ p: [e.bx, e.by], v: [0, 0] }); e.php = 1e9; e.update(); }
  assert.strictEqual(e.state, 'TRANSITION');
  ticks(e, 60); still(e, env, '스테이지 전환 화면');

  // 3) 마지막 보스 격파 → 승리 화면
  ({ e, env } = newEngine(RICH));
  e.reset(10); e.state = 'PLAY'; e.update();
  for (let p = 1; p <= 4; p++) { e.bhp = 1; e.bullets.push({ p: [e.bx, e.by], v: [0, 0] }); e.php = 1e9; e.update(); }
  assert.strictEqual(e.state, 'WIN');
  ticks(e, 60); still(e, env, '승리 화면');

  // 4) 상점에서 사면 잠깐 번쩍이고 사라짐
  ({ e, env } = newEngine({ coins: 5000, cleared_stages: [], selected_char: 0, owned_chars: [0], upgrades: { speed: 0, hp: 0, damage: 0, fire: 0, shield: 0, magnet: 0 } }));
  click(env, 270, 748); click(env, 470, 75 + 50);              // 강화 → 이동 속도 구매
  assert.strictEqual(e.save.upgrades.speed, 1);
  assert.ok(e.flash > 0, '살 때 번쩍임');
  ticks(e, 10); still(e, env, '강화 화면');
  click(env, 100, 895); click(env, 270, 680); click(env, 470, 80 + 115 + 70);   // 격납고 → 팬텀 구매
  assert.ok(e.save.owned_chars.includes(1));
  ticks(e, 10); still(e, env, '격납고');

  // 전투 중의 흔들림은 원본과 같은 속도로 줄어듦 (틱마다 1)
  ({ e, env } = newEngine());
  e.reset(1); e.state = 'PLAY'; e.update();
  e.bossBullets = []; e.lasers = [];
  e.shake = 10; e.php = 1e9; e.update();
  assert.strictEqual(e.shake, 9, '전투 중 흔들림은 원본처럼 틱마다 1 씩');
});

console.log(process.exitCode ? '\n실패한 테스트가 있습니다.' : `\n모두 통과 (${passed}개)`);
