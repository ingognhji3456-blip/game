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

/* =============== 새 적 8종 + 보스 =============== */
const SRC = (element) => ({ calc: { element, dmgBonus: 0, mods: {}, onHit: {} }, element });
function g11() { const g = RG.sim.create({ mapId: '1-1', seed: 1, heroId: null }); g.state.gold = 1e6; return g; }
function at(g, type, x, y, o = {}) {
  const e = g.api.spawnEnemy(type, 0);
  Object.assign(e, { x, y, px: x, py: y, c: Math.floor(x), r: Math.floor(y), tc: Math.floor(x), tr: Math.floor(y) });
  if (o.root) { e.ccUntil = 1e9; e.ccKind = 'root'; }
  return e;
}

test('6지역 적 데이터: 8종 + 보스, 특성 이름·설명, 설계서 순서', () => {
  const ids = ['stardust_moth', 'cloud_sheep', 'comet_knight', 'nebula_jelly', 'umbral_stargazer', 'eclipse_priest', 'meteor_golem', 'phase_wraith', 'gloom_monarch'];
  for (const id of ids) { assert.ok(D.enemies[id] && D.enemies[id].region === 6, id); assert.ok(D.enemyOrder.includes(id), `${id} 순서`); }
  for (const t of ['fluffy', 'phase']) assert.ok(D.traits[t] && D.traits[t].name && D.traits[t].desc, t);
  assert.ok(D.enemies.gloom_monarch.boss);
});

test('구름 양 푹신: 범위 피해는 절반, 한 대상 공격은 그대로', () => {
  const g = g11();
  const a = at(g, 'cloud_sheep', 6.5, 1.5, { root: true });
  const b = at(g, 'cloud_sheep', 7.5, 1.5, { root: true });
  const da = g.api.damage(a, 100, 'fire', SRC('fire'), { area: true });
  const db = g.api.damage(b, 100, 'fire', SRC('fire'), {});
  assert.ok(Math.abs(da / db - 0.5) < 1e-6, `${da} / ${db}`);
});

test('위상 망령: 일렁인 뒤 4초마다 길을 따라 앞으로 순간이동, 붙잡혀 있어도 빠져나감', () => {
  const g = g11();
  const e = g.api.spawnEnemy('phase_wraith', 0);
  e.hp = e.maxHp = 1e6;
  const evs = [];
  let warned = false;
  for (let i = 0; i < 30 * 4.1; i++) { g.step(); if (e.phaseWarn) warned = true; for (const x of g.state.events) if (x.type === 'phase') evs.push(x); }
  assert.ok(warned, '경고(일렁임)');
  assert.strictEqual(evs.length, 1);
  assert.ok(Math.hypot(evs[0].x - evs[0].fromX, evs[0].y - evs[0].fromY) > 1.2, '앞으로 이동');
  // 병영에 붙잡혀 있어도 빠져나감
  const g2 = g11();
  const res = g2.cmd({ type: 'build', tower: 'stone_barracks', c: 5, r: 2 });
  assert.ok(res.ok);
  const w = g2.api.spawnEnemy('phase_wraith', 0);
  w.hp = w.maxHp = 1e6;
  let held = false; let escaped = false;
  for (let i = 0; i < 30 * 20 && !escaped; i++) { g2.step(); if (w.blockedBy) held = true; else if (held && g2.state.events.some((x) => x.type === 'phase')) escaped = true; }
  assert.ok(held && escaped, `붙잡힘 ${held} → 빠져나감 ${escaped}`);
});

test('성운 해파리: 죽으면 작은 해파리 셋(더 갈라지지 않음) · 일식 사제: 치유와 보호막 · 유성 골렘: 죽음 폭발', () => {
  const g = g11();
  const j = at(g, 'nebula_jelly', 6.5, 1.5);
  g.api.damage(j, 1e6, 'light', SRC('light'), {});
  const kids = g.state.enemies.filter((e) => !e.dead && e.type === 'nebula_jelly');
  assert.strictEqual(kids.length, 3);
  assert.ok(kids.every((k) => k.fragment && k.maxHp < j.maxHp * 0.25));
  for (let i = 0; i < 10; i++) g.step(); // 갈라진 직후 0.15초 무적
  for (const k of kids) g.api.damage(k, 1e6, 'light', SRC('light'), {});
  assert.strictEqual(g.state.enemies.filter((e) => !e.dead && e.type === 'nebula_jelly').length, 0, '작은 것은 안 갈라짐');
  // 일식 사제
  const g2 = g11();
  const p = at(g2, 'eclipse_priest', 6.5, 1.5, { root: true });
  const o = at(g2, 'comet_knight', 7.0, 1.5, { root: true });
  o.hp = o.maxHp * 0.5;
  for (let i = 0; i < 30 * 8; i++) g2.step();
  assert.ok(o.hp > o.maxHp * 0.5 && o.shield > 0, `치유 ${o.hp / o.maxHp} 보호막 ${o.shield}`);
  assert.ok(p.hp > 0);
  // 유성 골렘: 죽을 때 주변 병사 피해
  const g3 = g11();
  const r3 = g3.cmd({ type: 'build', tower: 'stone_barracks', c: 5, r: 2 });
  assert.ok(r3.ok);
  for (let i = 0; i < 30 * 3; i++) g3.step();
  const sol = g3.state.units.find((u) => u.kind === 'soldier' && !u.dead);
  const m = at(g3, 'meteor_golem', sol.x + 0.3, sol.y);
  const hp0 = sol.hp;
  g3.api.damage(m, 1e7, 'frost', SRC('frost'), {});
  assert.ok(m.dead && (sol.hp < hp0 || sol.dead), '죽음 폭발 피해');
});

test('그믐달 군주: 별 가리기(경고 뒤 탑 사거리 −40%, 5초 뒤 회복) · 70% 나방 · 35% 순간이동 + 많이 맞은 원소 면역', () => {
  const g = g11();
  const tid = g.cmd({ type: 'build', tower: 'ember_archer', c: 5, r: 2 }).id;
  const t = g.state.towers.find((q) => q.id === tid);
  t.building = false; t.buildUntil = 0;
  g.step();
  const r0 = t.calc.range;
  const b = at(g, 'gloom_monarch', 5.5, 1.5, { root: true });
  b.armor = 0;
  let veiled = false; let restored = false;
  for (let i = 0; i < 30 * 15; i++) {
    g.step();
    if (!veiled && t.calc.range < r0 * 0.7) veiled = true;
    if (veiled && Math.abs(t.calc.range - r0) < 1e-6) { restored = true; break; }
  }
  assert.ok(veiled && restored, `가림 ${veiled} 회복 ${restored}`);
  // 70%: 나방
  const before = g.state.enemies.filter((e) => e.type === 'stardust_moth' && !e.dead).length;
  b.hp = b.maxHp * 0.69;
  g.step();
  assert.ok(g.state.enemies.filter((e) => e.type === 'stardust_moth' && !e.dead).length >= before + 4, '나방 소환');
  // 35%: 많이 맞은 원소(얼음)에 면역
  for (let i = 0; i < 5; i++) g.api.damage(b, 100, 'frost', SRC('frost'), {});
  g.api.damage(b, 100, 'fire', SRC('fire'), {});
  b.hp = b.maxHp * 0.34;
  g.step();
  assert.deepStrictEqual(Array.from(b.immuneEls || []), ['frost']);
  assert.strictEqual(g.api.damage(b, 100, 'frost', SRC('frost'), {}), 0, '얼음 면역');
});
