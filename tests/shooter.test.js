'use strict';

/*
 * 하늘 사냥꾼 테스트 (Node 로 실행: node tests/shooter.test.js)
 *  - 데이터·그림 검사: 보스 공격 이름, 부품 참조, 화면이 쓰는 그림이 모두 있고 그려지는지
 *  - 규칙 검사: 방어막, 포탑 파괴 → 단계 변화, 피격, 폭탄, 레이저, 미사일 격추, 이어하기, 1UP
 *  - 봇 시뮬레이션: 무적 봇이 여러 시드로 끝까지 깨는지, 일반 봇이 오류 없이 끝나는지
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '..', 'shooter');

function load() {
  const sandbox = { console, Math, JSON, Date, Object, Array, Number, String, Set, Map, Error };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
  // DOM 을 쓰는 화면 모듈 앞까지만 (엔진·데이터·그림 등록)
  for (const src of scripts) {
    if (/fx|render|audio|input|ui|main/.test(path.basename(src))) continue;
    vm.runInContext(fs.readFileSync(path.join(ROOT, src), 'utf8'), sandbox, { filename: src });
  }
  return sandbox.SH;
}

const SH = load();
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
const newGame = (o) => new SH.Game(Object.assign({ seed: 1 }, o || {}));
const step = (g, sec) => { for (let i = 0; i < Math.round(sec * 60); i++) g.update(SH.DT); };
/** 보스가 싸울 준비가 될 때까지 진행 */
function toFight(g) {
  for (let i = 0; i < 60 * 20 && !(g.boss && g.boss.state === 'fight'); i++) g.update(SH.DT);
  assert.ok(g.boss && g.boss.state === 'fight', '보스가 나와야 함');
}

console.log('데이터 · 그림');
test('보스 공격과 부품 참조가 올바름', () => {
  const B = SH.BOSS;
  const kinds = Object.keys(SH.ATTACKS);
  B.phases.forEach((ph, i) => {
    assert.ok(ph.attacks.length > 0, `${i}단계 공격 없음`);
    for (const a of ph.attacks) {
      assert.ok(kinds.includes(a.a), `알 수 없는 공격 ${a.a}`);
      assert.ok(['core', 'parts', 'sides', undefined].includes(a.from), `잘못된 from ${a.from}`);
      assert.ok(a.times >= 1 && a.every > 0, `${a.a}: times/every`);
      if (a.kind) assert.ok(SH.pix.has('orb_' + a.kind), `탄 색 그림 없음 ${a.kind}`);
    }
    for (const id of ph.needParts || []) assert.ok(B.parts[id], `없는 부품 ${id}`);
    if (i < B.phases.length - 1 && !ph.needParts) assert.ok(ph.until > 0 && ph.until < 1, `${i}단계 until`);
  });
});

test('화면이 쓰는 그림이 모두 등록되어 있고 그려짐', () => {
  const need = ['player', 'flame', 'shield', 'shot_spread', 'shot_homing', 'shot_laser', 'missile', 'gem', 'bigGem', 'spark',
    'item_bomb', 'item_life', 'item_shield', 'titan', 'turret', 'turretWreck', 'emissile', 'boom', 'boomBig', 'hitSpark', 'pop', 'puff',
    'cloud0', 'cloud1', 'cloud2', 'cloud3', 'island', 'rock', 'logo', 'icon_life', 'icon_bomb', 'btn_pause', 'btn_bomb', 'frame', 'cursor', 'star'];
  for (const w of SH.WEAPON_ORDER) need.push('item_' + w);
  for (const c of ['pink', 'red', 'orange', 'yellow', 'green', 'blue', 'purple', 'white']) need.push('orb_' + c, 'big_' + c);
  for (const n of need) assert.ok(SH.pix.has(n), `그림 없음: ${n}`);
  assert.strictEqual(SH.pix.info('titan').n, 8, 'titan 은 모습 4 × 2 프레임');
  assert.strictEqual(SH.pix.info('shot_laser').n, SH.MAX_POWER, '레이저는 파워 단계마다 한 프레임');
  // 코드로 그리는 그림을 모두 실제로 칠해 봄 (오류 없고, 빈 그림이 아님)
  for (const n of SH.pix.names()) {
    const d = SH.pix.defs[n];
    if (d.kind !== 'paint') continue;
    for (let f = 0; f < d.n; f++) {
      const P = SH.pix.painter(d.w, d.h);
      d.fn(P, f, d.n);
      assert.ok(P.px.some((c) => c !== null), `${n} ${f}번 프레임이 비어 있음`);
    }
  }
});

console.log('규칙');
test('첫 단계: 코어는 방어막, 포탑을 다 부수면 코어가 열림', () => {
  const g = newGame({ god: true });
  toFight(g);
  const hp0 = g.boss.hp;
  assert.strictEqual(g._damageCore(100), false);
  assert.strictEqual(g.boss.hp, hp0);
  g._damagePart(g.boss.parts.L, 9999);
  assert.strictEqual(g.boss.phase, 0, '포탑 하나만으로는 단계가 안 바뀜');
  g._damagePart(g.boss.parts.R, 9999);
  assert.strictEqual(g.boss.phase, 1);
  assert.ok(g.items.some((i) => i.kind === 'power'), '포탑에서 파워 아이템');
  g.boss.inv = 0;
  assert.strictEqual(g._damageCore(10), true);
  assert.ok(g.boss.hp < hp0);
});

test('코어 체력이 줄면 단계가 넘어가고 0 이면 격파 → 승리', () => {
  const g = newGame({ god: true });
  toFight(g);
  for (const p of Object.values(g.boss.parts)) g._damagePart(p, 9999);
  const seen = [];
  for (let n = 0; n < 50 && g.boss && g.boss.state === 'fight'; n++) {
    g.boss.inv = 0;
    g._damageCore(g.boss.maxHp * 0.1);
    if (!seen.includes(g.boss.phase)) seen.push(g.boss.phase);
  }
  assert.deepStrictEqual(seen, [1, 2, 3]);
  assert.strictEqual(g.boss.state, 'dying');
  step(g, 15);
  assert.strictEqual(g.over, 'win');
  assert.ok(g.tally && g.tally.total > 0);
});

test('맞으면 목숨·파워가 줄고 탄이 사라짐, 목숨이 다하면 게임 오버 → 이어하기', () => {
  const g = newGame({ power: 3 });
  toFight(g);
  g.player.inv = 0;
  g._eShot(g.player.x, g.player.y, 0, 0, { kind: 'pink' });
  g._collide();
  assert.strictEqual(g.lives, 2);
  assert.strictEqual(g.power, 2);
  assert.strictEqual(g.eb.length, 0);
  g.lives = 1;
  step(g, 2);
  g.player.inv = 0;
  g.player.entering = false;
  g._hitPlayer();
  step(g, 2.5);
  assert.strictEqual(g.over, 'gameover');
  g.continueGame();
  assert.strictEqual(g.over, null);
  assert.strictEqual(g.lives, 3);
  assert.strictEqual(g.continues, 1);
});

test('방패는 한 번 막아 줌', () => {
  const g = newGame();
  toFight(g);
  g.player.inv = 0;
  g.player.shield = 5;
  g._hitPlayer();
  assert.strictEqual(g.lives, 3);
  assert.strictEqual(g.player.shield, 0);
});

test('폭탄: 탄·레이저를 지우고 무적, 보스에게 피해', () => {
  const g = newGame();
  toFight(g);
  for (let i = 0; i < 30; i++) g._eShot(100 + i, 300, 1, 50, { kind: 'red' });
  g.beams.push({ ox: 0, oy: 0, a0: 1.5, a1: 1.6, warn: 1, dur: 1, width: 16, t: 0, ang: 1.5, on: false });
  const partHp = g.boss.parts.L.hp;
  assert.ok(g.useBomb());
  assert.strictEqual(g.eb.length, 0);
  assert.strictEqual(g.beams.length, 0);
  assert.ok(g.player.inv > 2);
  assert.ok(g.boss.parts.L.hp < partHp);
  assert.strictEqual(g.bombs, 2);
});

test('레이저: 경고 중에는 안전, 발사되면 광선 위에서 맞음', () => {
  const g = newGame();
  toFight(g);
  g.player.inv = 0;
  g.eb.length = 0;
  const e = g.boss;
  const ang = Math.atan2(g.player.y - e.y, g.player.x - e.x);
  g.beams.push({ ox: 0, oy: 0, a0: ang, a1: ang, warn: 0.5, dur: 1, width: 16, t: 0, ang, on: false, x: e.x, y: e.y });
  g._collide();
  assert.strictEqual(g.lives, 3, '경고 중');
  g.beams[0].on = true;
  g._collide();
  assert.strictEqual(g.lives, 2, '광선에 맞음');
});

test('적 미사일은 내 탄으로 격추됨', () => {
  const g = newGame();
  toFight(g);
  const m = g._missile(225, 500, Math.PI / 2, 0);
  g.pb.push({ x: 225, y: 505, vx: 0, vy: 0, dmg: 3, kind: 'spread', hw: 5, hh: 9, rot: 0, t: 0 });
  g._collide();
  assert.ok(m.hp <= 0);
  assert.strictEqual(g.stats.missiles, 1);
});

test('파워 아이템: 레벨이 오르고 색대로 무기가 바뀜', () => {
  const g = newGame();
  const it = g._dropItem('power', 0, 0);
  it.wtype = 'laser';
  g._takeItem(it);
  assert.strictEqual(g.power, 2);
  assert.strictEqual(g.weapon, 'laser');
});

test('점수가 기준을 넘으면 1UP', () => {
  const g = newGame();
  g._addScore(SH.EXTENDS[0]);
  assert.strictEqual(g.lives, 4);
});

console.log('시뮬레이션');
function bot(g, god) {
  const p = g.player;
  let fx = 0, fy = 0;
  for (const b of g.eb) {
    const dx = p.x - b.x, dy = p.y - b.y, d2 = dx * dx + dy * dy;
    if (d2 < 6400) { fx += (dx / d2) * 500; fy += (dy / d2) * 500; }
  }
  for (const bm of g.beams) {
    const a = Math.atan2(p.y - bm.y, p.x - bm.x);
    const lo = Math.min(bm.a0, bm.a1) - 0.12, hi = Math.max(bm.a0, bm.a1) + 0.12;
    if (a > lo && a < hi) fx += Math.cos((a - lo) < (hi - a) ? lo - 0.1 : hi + 0.1) > Math.cos(a) ? 3 : -3;
  }
  const item = g.items.find((i) => ['power', 'life', 'bomb', 'shield'].includes(i.kind));
  const e = g.boss;
  const part = e && Object.values(e.parts).find((q) => q.alive);
  const wantX = item ? item.x : e ? e.x + (part ? part.ox : 0) : SH.W / 2;
  const wantY = item ? Math.max(item.y, 300) : SH.H - 150;
  fx += (wantX - p.x) * 0.02;
  fy += (wantY - p.y) * 0.01;
  g.input.ax = Math.max(-1, Math.min(1, fx));
  g.input.ay = Math.max(-1, Math.min(1, fy));
  if (!god && g.bombs > 0 && g.eb.some((b) => (b.x - p.x) ** 2 + (b.y - p.y) ** 2 < 676)) g.input.bomb = true;
}

test('무적 봇: 여러 시드에서 6분 안에 격파, 탄 수 제한·숫자 이상 없음', () => {
  for (const seed of [1, 2, 3]) {
    const g = newGame({ seed, god: true });
    let maxEb = 0;
    for (let i = 0; i < 60 * 60 * 6 && !g.over; i++) {
      bot(g, true);
      g.update(SH.DT);
      maxEb = Math.max(maxEb, g.eb.length);
      assert.ok(Number.isFinite(g.player.x) && Number.isFinite(g.score), 'NaN');
    }
    assert.strictEqual(g.over, 'win', `seed ${seed}: 시간 안에 못 깸 (${g.time.toFixed(0)}초)`);
    assert.ok(maxEb <= 700);
    console.log(`    seed ${seed}: ${g.time.toFixed(0)}초, 점수 ${g.score}, 최대 탄 ${maxEb}`);
  }
});

test('일반 봇: 이어하기를 하면서 오류 없이 끝까지', () => {
  for (const seed of [4, 5]) {
    const g = newGame({ seed });
    for (let i = 0; i < 60 * 60 * 12 && g.over !== 'win'; i++) {
      if (g.over === 'gameover') g.continueGame();
      bot(g, false);
      g.update(SH.DT);
    }
    assert.strictEqual(g.over, 'win');
    console.log(`    seed ${seed}: ${g.time.toFixed(0)}초, 죽음 ${g.stats.deaths}, 이어하기 ${g.continues}, 미사일 격추 ${g.stats.missiles}`);
  }
});

console.log(process.exitCode ? '\n실패한 테스트가 있습니다.' : `\n모두 통과 (${passed}개)`);
