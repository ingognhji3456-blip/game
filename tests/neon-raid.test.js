'use strict';

/*
 * NEON RAID 테스트 (Node 로 실행: node tests/neon-raid.test.js)
 *  - 데이터: 보스 10명 · 기체 5종 · 강화 6종 · 스테이지 색
 *  - 메뉴: 로비 → 스테이지 선택 → 출격, 잠긴 스테이지 · 2장 잠금, 격납고 구매 · 강화 구매 · 저장
 *  - 전투: 보스 10명 × 4단계를 각각 돌리며 오류 · 숫자 이상이 없는지 (그리기 포함)
 *  - 규칙: 단계 전환(체력 2배), 4단계 격파 → 다음 스테이지, 10번째 보스 → 승리, 체력 0 → 스테이지 선택
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
  const gradient = { addColorStop() {} };
  const ctxTarget = { canvas: null };
  const ctx = new Proxy(ctxTarget, {
    get(t, k) {
      if (k in t) return t[k];
      if (k === 'createRadialGradient' || k === 'createLinearGradient') return () => gradient;
      if (k === 'measureText') return () => ({ width: 10 });
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
  return { canvas, window, localStorage, store, fire, badDraws };
}

function load() {
  const dom = fakeDom();
  const sandbox = {
    console, Math, JSON, Object, Array, Number, String, Set, Map, Error,
    window: dom.window, localStorage: dom.localStorage,
    performance: { now: () => 0 }, requestAnimationFrame: () => 0, cancelAnimationFrame: () => {},
  };
  vm.createContext(sandbox);
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
  assert.deepStrictEqual(scripts, ['js/constants.js', 'js/engine.js', 'js/main.js']);
  for (const src of scripts.slice(0, 2)) {
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

console.log(process.exitCode ? '\n실패한 테스트가 있습니다.' : `\n모두 통과 (${passed}개)`);
