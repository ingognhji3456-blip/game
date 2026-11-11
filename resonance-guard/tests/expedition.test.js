'use strict';

/* 원정 모드 (docs/design/expedition.md): 결정적 지도·보상, 노드 규칙, 유물·변형 규칙의 판 반영, 판 결과, 끝 보상 */
const assert = require('assert');
const { loadGame } = require('./load');

const { RG } = loadGame();
const D = RG.data;
const XD = D.expedition;
const EX = RG.expedition;
const plain = (x) => JSON.parse(JSON.stringify(x));
const OWNED = ['ember_archer', 'frost_crystal', 'stone_barracks', 'sun_lens', 'forge', 'lightning_rod', 'hex_spire', 'flame_mortar'];

function startRun(seed = 7) {
  const run = EX.newRun(seed, 'kara', OWNED);
  assert.ok(EX.pickDeck(run, run.offer.slice(0, 4)).ok);
  return run;
}
/** 판을 치른 셈 치기 */
function fakeBattle(run, result = 'win', lives = run.lives) { return EX.applyBattle(run, { result, lives }); }

test('원정 데이터: 유물 30종(갈래·설명·수정치), 사건 12종(선택지 2~3), 변형 규칙 6가지', () => {
  assert.strictEqual(Object.keys(XD.relics).length, 30);
  for (const [id, r] of Object.entries(XD.relics)) assert.ok(r.name && r.desc && r.kind && Object.keys(r.mods).length, id);
  assert.strictEqual(XD.events.length, 12);
  for (const e of XD.events) assert.ok(e.options.length >= 2 && e.options.length <= 3, e.id);
  assert.strictEqual(XD.ruleOrder.length, 6);
  for (const k of XD.ruleOrder) assert.ok(XD.rules[k]);
  // 막 보스 맵은 실제 보스 맵
  for (const list of XD.actBoss) for (const id of list) assert.ok(D.maps.find((m) => m.id === id && m.boss), id);
});

test('같은 시드 = 같은 원정: 시작 덱 후보·층 노드·보상', () => {
  const a = EX.newRun(42, 'kara', OWNED);
  const b = EX.newRun(42, 'kara', OWNED);
  assert.deepStrictEqual(plain(a.offer), plain(b.offer));
  assert.ok(EX.pickDeck(a, a.offer.slice(0, 4)).ok && EX.pickDeck(b, b.offer.slice(0, 4)).ok);
  assert.deepStrictEqual(plain(a.nodes), plain(b.nodes));
  const c = EX.newRun(43, 'kara', OWNED);
  EX.pickDeck(c, c.offer.slice(0, 4));
  assert.notDeepStrictEqual(plain(a.nodes).concat(plain(a.offer)), plain(c.nodes).concat(plain(c.offer)), '다른 시드는 다름');
});

test('노드 규칙: 첫 층은 전투만, 층마다 2~3개, 전투가 하나 이상, 6층은 막 보스, 막 지역의 맵', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const run = startRun(seed);
    assert.ok(run.nodes.every((x) => x.kind === 'battle'), '첫 층 전투');
    for (let f = 2; f <= XD.floors; f++) {
      run.floor = f;
      const ns = EX.floorNodes(run);
      assert.ok(ns.length >= 2 && ns.length <= 3);
      assert.ok(ns.some((x) => x.kind === 'battle' || x.kind === 'elite'));
      if (f < 3) assert.ok(!ns.some((x) => x.kind === 'shop' || x.kind === 'rest'), '상점·쉼터는 3층부터');
      for (const x of ns) if (x.mapId) assert.ok(XD.actRegions[0].includes(D.maps.find((m) => m.id === x.mapId).region));
    }
    run.floor = XD.floors + 1;
    const boss = EX.floorNodes(run);
    assert.strictEqual(boss.length, 1);
    assert.ok(boss[0].kind === 'boss' && XD.actBoss[0].includes(boss[0].mapId));
  }
});

test('판 설정: 짧은 작전 웨이브·체력 배율·불꽃·유물과 변형 규칙이 판에 반영', () => {
  const run = startRun(5);
  run.relics.push('coin_pouch', 'ember_heart', 'heavy_armor');
  run.up.push(run.deck[0]);
  assert.ok(EX.choose(run, 0).battle);
  run.node.rule = 'steel';
  const set = EX.battleSetup(run);
  assert.strictEqual(set.expedition.waves.length, XD.waves.battle);
  assert.ok(Math.abs(set.hpMult - XD.actScale[0]) < 1e-9, '1막 1층 배율');
  assert.ok(Math.abs(set.expedition.armorAdd - 0.2) < 1e-9, '무거운 갑옷 + 강철 무리');
  const g = RG.sim.create(Object.assign({ seed: 3, heroId: 'kara', towers: run.deck, mode: 'expedition' }, set));
  const def = D.maps.find((m) => m.id === set.mapId);
  assert.strictEqual(g.state.wave.total, XD.waves.battle);
  assert.strictEqual(g.state.lives, run.lives);
  assert.strictEqual(g.state.gold, Math.round(def.startGold * XD.goldMult * (1 + 0.25 + 0.4)));
  assert.strictEqual(g.state.task, null);
  // 원정 강화 탑은 Lv2로 지어짐, 불 탑 피해 +15%
  const tiles = [];
  for (let r = 0; r < g.map.rows; r++) for (let c = 0; c < g.map.cols; c++) if (g.map.kinds[r * g.map.cols + c] === RG.grid.T.BUILD) tiles.push({ c, r });
  const res = g.cmd({ type: 'build', tower: run.deck[0], c: tiles[0].c, r: tiles[0].r });
  assert.ok(res.ok, res.reason);
  const t = g.state.towers.find((q) => q.id === res.id);
  assert.strictEqual(t.level, 2);
  const e = g.api.spawnEnemy(RG.grid.parseWaves(def.waves)[0].groups[0].e, 0);
  assert.ok(Math.abs(e.armor - Math.min(0.9, D.enemies[e.type].armor + 0.2)) < 1e-9, '적 갑옷');
});

test('판 결과: 이기면 은화·보상(전투=탑 3종, 정예=유물 3개), 지면 원정 끝', () => {
  const run = startRun(9);
  EX.choose(run, 0);
  const before = run.silver;
  const r1 = fakeBattle(run, 'win', 10);
  assert.ok(r1.ok && run.silver > before && run.lives === 10 && run.phase === 'reward' && run.offerKind === 'tower' && run.offer.length === 3);
  const t = run.offer[0];
  assert.ok(EX.takeReward(run, t).ok);
  assert.ok(run.deck.includes(t) && run.floor === 2 && run.phase === 'map');
  // 지는 판
  const run2 = startRun(10);
  EX.choose(run2, 0);
  const r2 = fakeBattle(run2, 'lose', 0);
  assert.ok(r2.done && !r2.win && run2.phase === 'done' && run2.result === 'lose');
  assert.strictEqual(run2.rewards.crystals, 0);
});

test('사건·상점·쉼터: 은화·불꽃·유물·강화가 바뀌고 다음 층으로', () => {
  const run = startRun(11);
  run.floor = 3;
  run.silver = 500;
  // 사건 (별빛 샘: 불꽃 +2)
  run.nodes = [{ kind: 'event', event: 'spring' }];
  EX.choose(run, 0);
  const l0 = run.lives;
  const ev = EX.eventChoose(run, 0);
  assert.ok(ev.ok && run.lives === l0 + 2 && run.floor === 4);
  // 상점
  run.nodes = [{ kind: 'shop' }];
  EX.choose(run, 0);
  const relicItem = run.shopStock.find((x) => x.kind === 'relic');
  assert.ok(EX.shopBuy(run, relicItem.id).ok && run.relics.includes(relicItem.relic));
  assert.ok(!EX.shopBuy(run, relicItem.id).ok, '두 번은 못 삼');
  assert.ok(!EX.shopBuy(run, 'upgrade').ok, '강화할 탑을 골라야 함');
  assert.ok(EX.shopBuy(run, 'upgrade', run.deck[1]).ok && run.up.includes(run.deck[1]));
  assert.ok(EX.shopLeave(run).ok && run.floor === 5);
  // 쉼터
  run.nodes = [{ kind: 'rest' }];
  EX.choose(run, 0);
  const l1 = run.lives;
  assert.ok(EX.rest(run, 'heal').ok && run.lives === Math.min(XD.maxLives, l1 + XD.rest.heal));
});

test('막 보스를 깨면 다음 막, 3막 보스를 깨면 원정 승리 · 끝 보상(층 × 15 + 150, 장신구 3)', () => {
  const run = startRun(12);
  for (let act = 1; act <= 3; act++) {
    run.floor = XD.floors + 1;
    run.nodes = EX.floorNodes(run);
    EX.choose(run, 0);
    assert.strictEqual(run.node.kind, 'boss');
    const set = EX.battleSetup(run);
    assert.strictEqual(set.expedition.waves.length, XD.waves.boss);
    assert.ok(set.expedition.waves.includes(D.maps.find((m) => m.id === set.mapId).waves.length - 1), '보스 웨이브 포함');
    fakeBattle(run, 'win', 12);
    assert.strictEqual(run.offerKind, 'relic');
    EX.takeReward(run, run.offer[0]);
    if (act < 3) assert.ok(run.act === act + 1 && run.floor === 1);
  }
  assert.ok(run.phase === 'done' && run.result === 'win');
  assert.strictEqual(run.rewards.crystals, run.floorsCleared * XD.reward.perFloor + XD.reward.win);
  assert.deepStrictEqual(plain(run.rewards.gear), ['common', 'rare', 'epic']);
});

test('원정 판도 재현이 같음 (opts만으로)', () => {
  const run = startRun(13);
  EX.choose(run, 0);
  const set = EX.battleSetup(run);
  const mk = () => {
    const g = RG.sim.create(JSON.parse(JSON.stringify(Object.assign({ seed: 5, heroId: 'kara', towers: run.deck, mode: 'expedition' }, set))));
    g.cmd({ type: 'callWave' });
    for (let i = 0; i < 30 * 30; i++) g.step();
    return g.hash();
  };
  assert.strictEqual(mk(), mk());
});
