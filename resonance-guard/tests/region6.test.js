'use strict';

/*
 * 6지역 "별울림 첨탑" (docs/design/region6.md): 별다리(B/b 번갈아 열림) · 별빛 건설지(*) · 새 적 특성 · 보스.
 * 시험용 작은 맵을 data에 잠깐 넣어 씁니다.
 */
const assert = require('assert');
const { loadGame } = require('./load');

const { RG } = loadGame();
const D = RG.data;

/*  A 무리(1줄)가 처음 열리고 b 무리(3줄)는 닫힘. 4초마다 바뀜.
 *  (7,3)은 공터 — b 길에만 있음 */
const TEST_MAP = {
  id: 'T6', region: 6, name: '시험 별다리', type: 'fixed',
  grid: [
    '#*#######',
    'S.BBB...L',
    '.#######.',
    '..bbbbb,.',
    '#########',
  ],
  bridges: { period: 4 },
  startGold: 5000,
  waves: ['mist_rat*1'],
};
D.maps.push(TEST_MAP);

function game(opts = {}) { const g = RG.sim.create(Object.assign({ mapId: 'T6', seed: 1, heroId: null }, opts)); g.state.gold = 1e6; return g; }
function run(g, sec) { for (let i = 0; i < Math.round(sec * 30); i++) g.step(); }
function spawn(g, type, x, y) {
  const e = g.api.spawnEnemy(type, 0);
  if (x != null) Object.assign(e, { x, y, px: x, py: y, c: Math.floor(x), r: Math.floor(y), tc: Math.floor(x), tr: Math.floor(y) });
  return e;
}

test('별다리 맵 해석: 두 상태 모두 길이 있어야 함', () => {
  const m = RG.grid.parseMap(TEST_MAP);
  assert.ok(m.hasBridges);
  assert.strictEqual(m.bridgeA.length, 3);
  assert.strictEqual(m.bridgeB.length, 5);
  const bad = Object.assign({}, TEST_MAP, { id: 'T6bad', grid: ['#########', 'S.BBB...L', '#########', '#########', '#########'] });
  assert.throws(() => RG.grid.parseMap(bad), /별다리/, 'B만 있는 길은 B가 닫히면 막힘');
});

test('별다리: 열린 무리로만 다니고, 주기마다 번갈아 바뀜(이벤트)', () => {
  const g = game();
  const e = spawn(g, 'mist_rat');
  let minY = 9;
  for (let i = 0; i < 30 * 3; i++) { g.step(); minY = Math.min(minY, e.y); }
  assert.ok(e.y < 2 && e.x > 1.5, `A 길(1줄)로 감 ${e.x},${e.y}`);
  // 4초에 바뀜
  const evs = [];
  for (let i = 0; i < 30 * 2; i++) { g.step(); for (const x of g.state.events) if (x.type === 'bridges') evs.push(x); }
  assert.strictEqual(evs.length, 1);
  assert.strictEqual(g.state.bridge.phase, 1);
  // 바뀐 뒤 새로 나온 적은 b 길(3줄)로
  const e2 = spawn(g, 'mist_rat');
  let maxY = 0;
  for (let i = 0; i < 30 * 3; i++) { g.step(); if (!e2.dead) maxY = Math.max(maxY, e2.y); }
  assert.ok(maxY > 3, `b 길로 감 ${maxY}`);
});

test('별다리: 닫히는 다리 위의 적은 되돌아가지 않고 그대로 건너감', () => {
  const g = game();
  run(g, 3.6);
  const e = spawn(g, 'mist_rat', 3.5, 1.5);
  e.tc = 4; e.tr = 1;
  const x0 = e.x;
  run(g, 0.6); // 4초에 A가 닫힘
  assert.strictEqual(g.state.bridge.phase, 1);
  let back = false;
  for (let i = 0; i < 30 * 6 && !e.dead; i++) { g.step(); if (e.x < x0 - 0.2) back = true; }
  assert.ok(!back, '뒤로 돌아가지 않음');
  assert.ok(e.dead && e.leaked, '울림등까지 감');
});

test('별다리: 다리가 바뀐 뒤 길이 막히게 되는 공터에는 지을 수 없음', () => {
  const g = game();
  const r = g.cmd({ type: 'build', tower: 'ember_archer', c: 7, r: 3 });
  assert.ok(!r.ok && /별다리/.test(r.reason), `막힘: ${r.reason}`);
});

test('별빛 건설지(*): 사거리 +15%', () => {
  const g = game({ towers: ['ember_archer'] });
  const a = g.cmd({ type: 'build', tower: 'ember_archer', c: 1, r: 0 });
  const b = g.cmd({ type: 'build', tower: 'ember_archer', c: 5, r: 0 });
  assert.ok(a.ok && b.ok);
  const ta = g.state.towers.find((t) => t.id === a.id);
  const tb = g.state.towers.find((t) => t.id === b.id);
  assert.ok(Math.abs(ta.calc.range / tb.calc.range - 1.15) < 1e-6, `${ta.calc.range} / ${tb.calc.range}`);
});
