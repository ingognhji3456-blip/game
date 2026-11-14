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

test('웨이브가 많음(20·25·30) — 뒤로 갈수록 단단해지고, 레이드·캠페인에는 이 배율이 없음', () => {
  const { RG } = fresh();
  assert.strictEqual(JSON.stringify(RG.data.crystal.difficulty.map((d) => d.waves)), JSON.stringify([20, 25, 30]));
  for (let d = 1; d <= 3; d++) {
    const r = RG.crystal.ramp(d);
    assert.strictEqual(r.length, RG.data.crystal.difficulty[d - 1].waves);
    assert.ok(r[0] < 1 && r[r.length - 1] > 1.5);
    for (let i = 1; i < r.length; i++) assert.ok(r[i] >= r[i - 1], '점점 단단하게');
  }
  // 같은 적이라도 뒤 웨이브가 더 단단함
  const g = RG.sim.create(Object.assign({ mode: 'normal', seed: 1, heroId: null }, RG.crystal.setup(1)));
  const a = g.api.spawnEnemy('mist_rat', 0, null, 0);
  const b = g.api.spawnEnemy('mist_rat', 0, null, 19);
  assert.ok(b.maxHp > a.maxHp * 2, `${a.maxHp} → ${b.maxHp}`);
  const raid = RG.sim.create(Object.assign({ mode: 'normal', seed: 1, heroId: 'kara' }, RG.raid.setup('ember_archer', 1, 'kara')));
  const c = raid.api.spawnEnemy('mist_rat', 0, null, 0);
  const e = raid.api.spawnEnemy('mist_rat', 0, null, 5);
  assert.strictEqual(c.maxHp, e.maxHp, '레이드에는 웨이브 체력 배율 없음');
  // 마지막 웨이브 적 수가 지나치게 크지 않음
  for (let d = 1; d <= 3; d++) {
    const last = RG.grid.parseWaves([RG.crystal.waves(d).slice(-1)[0]])[0];
    const n = last.groups.reduce((s, x) => s + x.n, 0);
    assert.ok(n <= 60, `난이도 ${d} 마지막 웨이브 ${n}마리 (마지막은 큰 무리지만 끝없이 커지지 않게)`);
  }
});

test('골드: 난이도마다 적 체력 1당 처치 골드가 설정대로, 처치 골드에 배율이 붙음 — 어려움이 골드를 훨씬 많이 벌어 쉬워지지 않게 (검토 2026-11-14)', () => {
  const { RG } = fresh();
  for (let d = 1; d <= 3; d++) {
    const s = RG.crystal.setup(d);
    const diff = RG.data.crystal.difficulty[d - 1];
    let hp = 0; let gold = 0;
    RG.grid.parseWaves(s.crystal.waves).forEach((w, i) => { for (const g of w.groups) { const ed = RG.data.enemies[g.e]; hp += g.n * ed.hp * diff.hp * s.crystal.ramp[i]; gold += g.n * ed.bounty * s.crystal.goldMult; } });
    assert.ok(Math.abs(gold / hp - diff.gold) < diff.gold * 0.01, `난이도 ${d}: 체력 1당 ${(gold / hp).toFixed(4)} (설정 ${diff.gold})`);
  }
  // 처치 골드 = 기본 골드 × 배율 (반올림)
  const g = RG.sim.create(Object.assign({ mode: 'normal', seed: 1, heroId: null }, RG.crystal.setup(3)));
  const e = g.api.spawnEnemy('rock_crab', 0, null, 0);
  const g0 = g.state.gold;
  g.api.damage(e, 1e7, 'fire', { calc: { dmgBonus: 0, mods: {}, onHit: {} } }, {});
  assert.strictEqual(g.state.gold - g0, Math.max(1, Math.round(RG.data.enemies.rock_crab.bounty * RG.crystal.goldMult(3))));
  // 레이드·캠페인에는 이 배율이 없음
  assert.ok(!RG.raid.setup('ember_archer', 1, 'kara').raid.goldMult);
});

test('같은 탑이면 쉬움 > 보통 > 어려움: 기본 탑 3종 + 시오는 쉬움·보통을 막고 어려움은 못 막음, 어려움은 원소마다 2종이면 막음 (검토 2026-11-14)', () => {
  const { RG } = fresh();
  const { makeEnv } = require('./bots');
  const env = makeEnv(RG);
  const run = (d, towers, heroId) => env.run(Object.assign({ mode: 'normal', seed: 1, heroId, towers, branches: d > 1, finalLv2: true, shardStart: true }, RG.crystal.setup(d)), 'greedy');
  const basic = ['ember_archer', 'frost_crystal', 'stone_barracks'];
  const r = [1, 2, 3].map((d) => run(d, basic, 'sio'));
  assert.deepStrictEqual(r.map((x) => x.result), ['win', 'win', 'lose'], r.map((x) => `${x.result} ${x.waves}/${x.total} 목숨 ${x.lives}`).join(' · '));
  const mix2 = ['ember_archer', 'flame_mortar', 'frost_crystal', 'ice_ballista', 'lightning_rod', 'gale_cannon', 'stone_barracks', 'quake_hammer', 'sun_lens', 'radiance_spire', 'hex_spire', 'void_orb'];
  const h = run(3, mix2, 'sera');
  assert.strictEqual(h.result, 'win', `어려움 원소마다 2종 + 세라: ${h.result} ${h.waves}/${h.total}`);
  assert.ok(h.game.state.towers.length < 88, '맵을 탑으로 가득 채울 만큼 골드가 남지 않음');
});

test('여기서 끝내기: 공명석 웨이브에서만, 지는 것과 같은 정산(막아 낸 만큼), 판 기록에 남아 다시 돌려도 같음 (검토 2026-11-14)', () => {
  const { RG } = fresh();
  for (const id of ['1-1', '1-2', '1-3']) win(RG, id);
  const { makeEnv } = require('./bots');
  const env = makeEnv(RG);
  const opts = Object.assign({ mode: 'normal', seed: 7, heroId: 'kara', towers: ['ember_archer', 'frost_crystal', 'stone_barracks'] }, RG.crystal.setup(1));
  const full = env.run(opts, 'greedy');
  // 봇 판을 웨이브 8쯤까지 다시 돌리고 거기서 끝냄
  const g = RG.sim.create(opts);
  const log = full.game.log.slice();
  let k = 0;
  while (g.state.wave.index < 8 && !g.state.result) { while (k < log.length && log[k][0] <= g.state.tick) g.cmd(log[k++][1]); g.step(); }
  const cleared = RG.raid.wavesCleared(g.state);
  assert.ok(cleared >= 4, `막아 낸 웨이브 ${cleared}`);
  assert.ok(g.cmd({ type: 'endRun' }).ok);
  assert.strictEqual(g.state.result, 'lose');
  assert.ok(g.state.ended);
  assert.ok(!g.cmd({ type: 'endRun' }).ok, '두 번은 안 됨');
  const rec = RG.progress.recordCrystal(1, g.state);
  assert.strictEqual(rec.crystals, RG.crystal.reward(1, { win: false, cleared, total: 20 }));
  assert.ok(rec.crystals > 0);
  // 기록을 다시 돌려도 같은 끝
  const again = RG.sim.replay(opts, g.log, g.state.tick + 5);
  assert.strictEqual(again.state.result, 'lose');
  assert.strictEqual(again.hash(), g.hash());
  // 캠페인에서는 안 됨
  const c = RG.sim.create({ mapId: '1-1', mode: 'normal', seed: 1, heroId: 'kara' });
  assert.ok(!c.cmd({ type: 'endRun' }).ok);
  assert.ok(!c.state.result);
});
