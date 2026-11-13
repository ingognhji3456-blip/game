'use strict';

/* 공명석 웨이브 — js/data/crystal.js · js/core/crystal.js · sim(o.crystal) · progress.recordCrystal (docs/design/crystal.md) */
const assert = require('assert');
const { loadGame } = require('./load');

const fresh = () => { const L = loadGame(); L.RG.progress.load(); return L; };
const win = (RG, id) => RG.progress.record(id, 'normal', { result: 'win', lives: 12, task: { done: true }, wave: { index: 8 } });
const st = (result, cleared, total, extra = {}) => Object.assign({ result, wave: { index: cleared, total, queue: [] }, enemies: [], hero: { heroId: 'kara' } }, extra);

test('맵 3개: 캠페인 목록에 없고 입구에서 등불까지 길이 이어짐, 난이도마다 맵이 있음', () => {
  const { RG } = fresh();
  assert.strictEqual(RG.data.crystalMaps.length, 3);
  for (const m of RG.data.crystalMaps) {
    assert.ok(!RG.data.maps.some((x) => x.id === m.id));
    const g = RG.sim.create(Object.assign({ mode: 'normal', seed: 1, heroId: null }, RG.crystal.setup(RG.data.crystal.difficulty.findIndex((d) => d.map === m.id) + 1)));
    assert.strictEqual(g.def.id, m.id);
    const s = g.map.spawns[0];
    assert.ok(isFinite(g.flow[s.r * g.map.cols + s.c]), `${m.id}: 길`);
  }
});

test('보상: 가장 쉬운 난이도도 끝까지 막으면 500 이상, 난이도가 오를수록 더, 지면 막아 낸 만큼 일부', () => {
  const { RG } = fresh();
  const D = RG.data.crystal.difficulty;
  assert.ok(D[0].reward >= 500, '쉬움 500 이상');
  for (let i = 1; i < D.length; i++) assert.ok(D[i].reward > D[i - 1].reward);
  assert.strictEqual(RG.crystal.reward(1, { win: true, cleared: 8, total: 8 }), D[0].reward);
  assert.strictEqual(RG.crystal.reward(1, { win: false, cleared: 0, total: 8 }), 0);
  const half = RG.crystal.reward(1, { win: false, cleared: 4, total: 8 });
  assert.ok(half > 0 && half < D[0].reward / 2, `반쯤: ${half}`);
  assert.strictEqual(half % 10, 0, '10 단위');
  assert.ok(RG.crystal.reward(1, { win: false, cleared: 7, total: 8 }) < D[0].reward, '지면 끝까지 막은 것보다 적음');
});

test('웨이브: 같은 난이도면 늘 같음, 읽을 수 있고 숨는 적·보스 없음, 그 난이도의 지역 적만', () => {
  const { RG } = fresh();
  for (let d = 1; d <= 3; d++) {
    const w = RG.crystal.waves(d);
    assert.strictEqual(JSON.stringify(w), JSON.stringify(RG.crystal.waves(d)));
    assert.strictEqual(w.length, RG.data.crystal.difficulty[d - 1].waves);
    const pool = RG.crystal.pool(d);
    for (const wave of RG.grid.parseWaves(w)) {
      assert.ok(wave.groups.length > 0);
      for (const g of wave.groups) {
        const ed = RG.data.enemies[g.e];
        assert.ok(pool.includes(g.e), `${g.e}는 ${d}단계 무리`);
        assert.ok(!ed.boss && !(ed.traits && ed.traits.stealth), g.e);
      }
    }
  }
});

test('판: 가진 탑을 모두 씀, 과제 없음, 시작 골드·웨이브 수가 설정대로, 다음 웨이브 미리보기는 공명석 웨이브의 것', () => {
  const { RG } = fresh();
  const towers = ['ember_archer', 'frost_crystal', 'stone_barracks', 'flame_mortar'];
  const g = RG.sim.create(Object.assign({ mode: 'normal', seed: 1, heroId: 'kara', towers }, RG.crystal.setup(1)));
  assert.strictEqual(g.state.task, null);
  assert.strictEqual(g.state.gold, RG.data.crystal.startGold[0]);
  assert.strictEqual(g.state.wave.total, RG.data.crystal.difficulty[0].waves);
  assert.strictEqual(JSON.stringify(g.waveStrings), JSON.stringify(RG.crystal.waves(1)));
  for (const t of towers) {
    let ok = false;
    for (let r = 0; r < g.map.rows && !ok; r++) for (let c = 0; c < g.map.cols && !ok; c++) { const cb = g.canBuild(t, c, r); if (cb.ok) ok = true; }
    assert.ok(ok, `${t}를 지을 수 있음`);
  }
});

test('열림: 1-3을 깨면 쉬움, 보통은 2-6 + 쉬움을 한 번, 어려움은 4-6 + 보통을 한 번', () => {
  const { RG } = fresh();
  const P = RG.progress;
  assert.ok(!P.crystalOpen());
  assert.ok(/1-3/.test(P.crystalLock(1)));
  for (const id of ['1-1', '1-2', '1-3']) win(RG, id);
  assert.ok(P.crystalOpen());
  assert.ok(P.crystalLock(2), '보통은 아직');
  for (const m of RG.data.maps.filter((x) => x.region <= 2)) win(RG, m.id);
  assert.ok(/쉬움/.test(P.crystalLock(2)), '쉬움을 먼저');
  P.recordCrystal(1, st('win', 8, 8));
  assert.strictEqual(P.crystalLock(2), null);
  assert.ok(/4-6/.test(P.crystalLock(3)));
});

test('기록: 이기면 보상 전부(몇 번이든), 지면 일부, 공명석이 뽑기 재화에 더해짐, 맵 기록·별에는 안 들어감', () => {
  const { RG } = fresh();
  const P = RG.progress;
  for (const id of ['1-1', '1-2', '1-3']) win(RG, id);
  const stars = P.starsTotal();
  const c0 = P.gachaState().crystals;
  let r = P.recordCrystal(1, st('win', 8, 8));
  assert.strictEqual(r.crystals, 500);
  assert.ok(r.firstClear && r.bond);
  r = P.recordCrystal(1, st('win', 8, 8));
  assert.strictEqual(r.crystals, 500, '두 번째도 그대로');
  assert.ok(!r.firstClear);
  r = P.recordCrystal(1, st('lose', 4, 8));
  assert.ok(r.crystals > 0 && r.crystals < 250);
  // 웨이브만 불러 놓고 지면(첫 웨이브 적이 남음) 0
  r = P.recordCrystal(1, st('lose', 8, 8, { enemies: [{ wave: 0, dead: false }] }));
  assert.strictEqual(r.crystals, 0);
  assert.strictEqual(P.gachaState().crystals, c0 + 1000 + (r.total - c0 - 1000));
  assert.ok(P.gachaState().crystals >= c0 + 1000);
  assert.strictEqual(P.crystalClears(1), 2);
  assert.strictEqual(P.starsTotal(), stars, '별 그대로');
  assert.ok(!Object.keys(P.get().maps).some((k) => k.startsWith('C')), '맵 기록 없음');
  // 저장·불러오기
  P.save(); P.load();
  assert.strictEqual(P.crystalClears(1), 2);
});

test('실제 판: 기본 탑 3종 + 카라로 쉬움을 봇이 끝까지 막고 500을 받음', () => {
  const { RG } = fresh();
  const { makeEnv } = require('./bots');
  const env = makeEnv(RG);
  for (const id of ['1-1', '1-2', '1-3']) win(RG, id);
  const r = env.run(Object.assign({ mode: 'normal', seed: 7, heroId: 'kara', towers: ['ember_archer', 'frost_crystal', 'stone_barracks'] }, RG.crystal.setup(1)), 'greedy');
  assert.strictEqual(r.result, 'win', `${r.result} ${r.waves}/${r.total}`);
  const c0 = RG.progress.gachaState().crystals;
  const rec = RG.progress.recordCrystal(1, r.game.state);
  assert.strictEqual(rec.crystals, 500);
  assert.strictEqual(RG.progress.gachaState().crystals, c0 + 500);
});

test('공명석 웨이브가 없는 판은 예전과 같은 해시', () => {
  const { RG } = fresh();
  const run = (extra) => { const g = RG.sim.create(Object.assign({ mapId: '2-3', mode: 'normal', seed: 9, heroId: 'sera' }, extra)); g.cmd({ type: 'callWave' }); for (let i = 0; i < 900; i++) g.step(); return g.hash(); };
  assert.strictEqual(run({}), run({ crystal: null }));
});

test('탑 없이 다 새어 나가게 둔 판은 0 (새어 나간 웨이브는 막아 낸 것이 아님), 분열 새끼도 부모 웨이브 — 검토에서 찾은 것', () => {
  const { RG } = fresh();
  for (const id of ['1-1', '1-2', '1-3']) win(RG, id);
  for (const d of [1, 2]) {
    const g = RG.sim.create(Object.assign({ mode: 'normal', seed: 3, heroId: 'kara', towers: ['ember_archer'] }, RG.crystal.setup(d)));
    g.cmd({ type: 'callWave' });
    for (let i = 0; i < 30 * 60 * 10 && !g.state.result; i++) g.step(); // 다음 웨이브는 저절로, 탑은 하나도 없이
    assert.strictEqual(g.state.result, 'lose');
    assert.strictEqual(RG.raid.wavesCleared(g.state), 0, `난이도 ${d}: 막아 낸 웨이브 ${RG.raid.wavesCleared(g.state)}`);
    assert.strictEqual(RG.progress.recordCrystal(d, g.state).crystals, 0);
  }
  // 분열: 포자 주머니 새끼는 부모의 웨이브 번호
  const g = RG.sim.create(Object.assign({ mode: 'normal', seed: 3, heroId: null }, RG.crystal.setup(1)));
  const sac = g.api.spawnEnemy('spore_sac', 0, null, 2);
  assert.strictEqual(sac.wave, 2);
  g.api.damage(sac, 1e6, 'fire', { calc: { dmgBonus: 0, mods: {}, onHit: {} } }, {});
  const kids = g.state.enemies.filter((e) => e !== sac && !e.dead);
  assert.ok(kids.length > 0, '새끼가 나옴');
  for (const k of kids) assert.strictEqual(k.wave, 2, '새끼도 웨이브 2');
});

test('막아 낸 웨이브: 새어 나간 적이 그 웨이브의 20% 이하면 셈, 넘으면 안 셈', () => {
  const { RG } = fresh();
  const base = { result: 'lose', enemies: [], wave: { index: 4, total: 8, queue: [], spawned: { 0: 10, 1: 10, 2: 10, 3: 10 }, leaks: { 1: 2, 2: 3 } } };
  assert.strictEqual(RG.raid.wavesCleared(base), 3, '웨이브 2(30%)만 빠짐');
});
