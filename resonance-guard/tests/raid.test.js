'use strict';

/* 조각 레이드 — js/data/raid.js · js/core/raid.js · sim(o.raid, o.shardLv) · progress (docs/design/raid.md) */
const assert = require('assert');
const { loadGame } = require('./load');

const fresh = () => { const L = loadGame(); L.RG.progress.load(); return L; };
const raidGame = (RG, type, d, heroId = 'kara', extra = {}) => RG.sim.create(Object.assign({ mode: 'normal', seed: 3, heroId }, RG.raid.setup(type, d, heroId), extra));
const buildSpot = (g, type) => {
  for (let r = 0; r < g.map.rows; r++) for (let c = 0; c < g.map.cols; c++) { const cb = g.canBuild(type, c, r); if (cb && cb.ok) return { c, r }; }
  return null;
};

test('레이드 맵 3개: 캠페인 목록에 없고, 입구에서 등불까지 길이 이어짐', () => {
  const { RG } = fresh();
  const D = RG.data;
  assert.strictEqual(D.raidMaps.length, 3);
  for (const m of D.raidMaps) {
    assert.ok(!D.maps.some((x) => x.id === m.id), `${m.id}는 캠페인 맵이 아님`);
    const g = RG.sim.create({ mapId: m.id, mode: 'normal', seed: 1, raid: RG.raid.setup('ember_archer', 1).raid });
    const s = g.map.spawns[0];
    assert.ok(isFinite(g.flow[s.r * g.map.cols + s.c]), `${m.id}: 입구에서 등불까지 길`);
  }
  for (const d of D.raid.difficulty) assert.ok(D.raidMaps.some((m) => m.id === d.map), d.map);
});

test('그 탑만 지을 수 있음 — 다른 탑은 절대 못 지음 (영웅은 함께)', () => {
  const { RG } = fresh();
  for (const type of ['ember_archer', 'stone_barracks', 'sanctuary', 'crystal_mine', 'shadow_dragon']) {
    const g = raidGame(RG, type, 2);
    assert.strictEqual(JSON.stringify(g.opts.towers), JSON.stringify([type]));
    const spot = buildSpot(g, type);
    assert.ok(spot, `${type}: 지을 자리`);
    for (const other of RG.data.towerOrder) {
      if (other === type) continue;
      const cb = g.canBuild(other, spot.c, spot.r);
      assert.ok(cb && !cb.ok, `${type} 레이드에서 ${other}를 지을 수 있으면 안 됨`);
      const res = g.cmd({ type: 'build', tower: other, c: spot.c, r: spot.r });
      assert.ok(!res.ok && /조각 레이드에서는/.test(res.reason || res.msg || res.error || JSON.stringify(res)), `${other}: 막는 까닭이 보임`);
    }
    assert.ok(g.cmd({ type: 'build', tower: type, c: spot.c, r: spot.r }).ok, `${type}는 지어짐`);
    assert.ok(g.state.hero, '영웅은 데려감');
  }
});

test('웨이브: 같은 입력이면 같음, 모든 탑×난이도에서 읽을 수 있고 그 탑이 칠 수 없는 적은 없음', () => {
  const { RG } = fresh();
  const D = RG.data;
  for (const type of D.towerOrder) {
    for (let d = 1; d <= D.raid.difficulty.length; d++) {
      const w1 = RG.raid.waves(type, d, 'kara');
      assert.deepStrictEqual(w1, RG.raid.waves(type, d, 'kara'), '결정적');
      assert.strictEqual(w1.length, D.raid.difficulty[d - 1].waves);
      const parsed = RG.grid.parseWaves(w1);
      for (const [i, w] of parsed.entries()) {
        assert.ok(w.groups.length > 0, `${type} d${d} 웨이브 ${i + 1}가 비어 있음`);
        for (const gr of w.groups) {
          const ed = D.enemies[gr.e];
          assert.ok(RG.raid.hitsEnemy(type, 'kara', gr.e), `${type}: ${gr.e}는 면역·흡수`);
          if (ed.traits && ed.traits.flying) assert.ok(RG.raid.canAir(type, 'kara'), `${type}: 공중을 못 치는데 ${gr.e}`);
          assert.ok(!(ed.traits && ed.traits.stealth), '숨는 적 없음');
        }
      }
    }
  }
  // 땅만 치는 탑(박격포)·병영은 비행 적이 나오지 않음, 지원 탑은 영웅 따라
  assert.ok(!RG.raid.canAir('flame_mortar', 'kara'));
  assert.ok(!RG.raid.canAir('stone_barracks', 'kara'));
  assert.ok(RG.raid.canAir('ember_archer', 'kara'));
});

test('난이도가 오를수록 적 체력·웨이브 수·보상이 늘어남, 탑 보정은 모든 탑에', () => {
  const { RG } = fresh();
  const D = RG.data.raid;
  for (let i = 1; i < D.difficulty.length; i++) {
    assert.ok(D.difficulty[i].hp > D.difficulty[i - 1].hp);
    assert.ok(D.difficulty[i].waves >= D.difficulty[i - 1].waves);
    assert.ok(D.difficulty[i].reward > D.difficulty[i - 1].reward);
  }
  for (const t of RG.data.towerOrder) assert.ok(D.towerHp[t] > 0, `${t} 보정값`);
  const a = RG.raid.setup('ember_archer', 1);
  const b = RG.raid.setup('ember_archer', 5);
  assert.ok(b.hpMult > a.hpMult);
  assert.strictEqual(a.raid.startGold, RG.data.towers.ember_archer.levels[0].cost * D.goldPerCost + D.goldBase);
});

test('조각 강화: 단계마다 공격력 +5%, 3단계 사거리, 5단계 공격 속도 — 도전 모드에는 없음', () => {
  const { RG } = fresh();
  const at = (shardLv, mode = 'normal') => {
    const g = RG.sim.create({ mapId: '1-1', mode, seed: 1, heroId: null, shardLv });
    const spot = buildSpot(g, 'ember_archer');
    g.state.gold = 9999;
    const res = g.cmd({ type: 'build', tower: 'ember_archer', c: spot.c, r: spot.r });
    assert.ok(res.ok);
    for (let i = 0; i < 90; i++) g.step();
    return g.state.towers[0].calc;
  };
  const c0 = at(null);
  const c2 = at({ ember_archer: 2 });
  const c5 = at({ ember_archer: 5 });
  assert.ok(Math.abs(c2.dmgBonus - c0.dmgBonus - 0.1) < 1e-9, '2단계 +10%');
  assert.strictEqual(c2.rangeBonus, c0.rangeBonus, '2단계는 사거리 그대로');
  assert.ok(Math.abs(c5.dmgBonus - c0.dmgBonus - 0.25) < 1e-9, '5단계 +25%');
  assert.ok(c5.range > c0.range && c5.interval < c0.interval, '5단계 사거리·속도');
  assert.strictEqual(c5.shardLv, 5);
  const ch = at({ ember_archer: 5 }, 'challenge');
  assert.strictEqual(ch.shardLv, 0, '도전 모드는 조각 강화를 쓰지 않음');
  // 다른 탑의 조각은 이 탑에 영향 없음
  assert.strictEqual(at({ frost_crystal: 5 }).dmgBonus, c0.dmgBonus);
});

test('조각 강화가 없으면 예전 판과 같은 해시 (빈 opts.shardLv도)', () => {
  const { RG } = fresh();
  const run = (extra) => { const g = RG.sim.create(Object.assign({ mapId: '1-3', mode: 'normal', seed: 5, heroId: 'kara' }, extra)); g.cmd({ type: 'callWave' }); for (let i = 0; i < 600; i++) g.step(); return g.hash(); };
  assert.strictEqual(run({}), run({ shardLv: {} }));
  assert.strictEqual(run({}), run({ shardLv: null }));
});

test('지원 탑 레이드: 영웅 곁에 그 탑을 지을수록(단계가 높을수록) 영웅이 강해짐, 공격 탑 레이드는 그대로', () => {
  const { RG } = fresh();
  const g = raidGame(RG, 'sanctuary', 1);
  const h = g.state.hero;
  // 영웅 근처 칸에 성소 짓기
  const near = [];
  for (let r = 0; r < g.map.rows; r++) for (let c = 0; c < g.map.cols; c++) {
    const cb = g.canBuild('sanctuary', c, r);
    if (cb && cb.ok && (c + 0.5 - h.x) ** 2 + (r + 0.5 - h.y) ** 2 <= 2.5 * 2.5) near.push({ c, r });
  }
  assert.ok(near.length >= 4, `영웅 곁 건설지 ${near.length}`);
  const S = RG.data.raid.supportHero;
  // 판 결과로 확인: 영웅 피해가 커지는지 (같은 시드, 성소 0개 vs 4개)
  const play = (n, level) => {
    const q = raidGame(RG, 'sanctuary', 1, 'kara', { hpMult: 40 }); // 적이 죽지 않게 (넘친 피해는 세지 않으므로)
    q.state.gold = 99999;
    for (let i = 0; i < n; i++) {
      assert.ok(q.cmd({ type: 'build', tower: 'sanctuary', c: near[i].c, r: near[i].r }).ok);
    }
    for (let i = 0; i < 60; i++) q.step();
    for (const t of q.state.towers) for (let l = 1; l < level; l++) q.cmd({ type: 'upgrade', id: t.id });
    q.cmd({ type: 'callWave' });
    for (let i = 0; i < 30 * 40; i++) q.step();
    return q.state.stats.heroDamage;
  };
  const d0 = play(0, 1);
  const d4 = play(4, 1);
  const d4up = play(4, 3);
  assert.ok(d4 > d0 * 1.3, `성소 4개면 영웅 피해가 늘어남 ${d0.toFixed(0)} → ${d4.toFixed(0)}`);
  assert.ok(d4up > d4, `단계를 올리면 더 ${d4.toFixed(0)} → ${d4up.toFixed(0)}`);
  assert.ok(S.max === 4 && S.levelMult.length === 4);
});

test('진행도: 2-6을 깨면 열림, 이기면 조각(처음 깨면 두 배), 지면 절반 넘게 버텼을 때 1, 다음 난이도 열림', () => {
  const { RG } = fresh();
  const P = RG.progress;
  assert.ok(!P.raidOpen());
  P.get().maps['2-6'] = Object.assign(P.get().maps['2-6'] || {}, { cleared: true });
  assert.ok(P.raidOpen());
  assert.strictEqual(P.raidMaxDiff('ember_archer'), 1);
  const st = (result, wave, total = 7) => ({ result, wave: { index: wave, total }, hero: { heroId: 'kara' } });
  let r = P.recordRaid('ember_archer', 1, st('win', 7));
  assert.strictEqual(r.shards, RG.data.raid.difficulty[0].reward * 2, '처음 깨면 두 배');
  assert.ok(r.firstClear && r.bond, '영웅 인연 경험치도');
  assert.strictEqual(P.raidBest('ember_archer'), 1);
  assert.strictEqual(P.raidMaxDiff('ember_archer'), 2);
  assert.strictEqual(P.raidMaxDiff('frost_crystal'), 1, '난이도는 탑마다 따로');
  r = P.recordRaid('ember_archer', 1, st('win', 7));
  assert.strictEqual(r.shards, RG.data.raid.difficulty[0].reward, '두 번째는 그대로');
  r = P.recordRaid('ember_archer', 2, st('lose', 4, 8));
  assert.strictEqual(r.shards, 1, '절반 버팀');
  r = P.recordRaid('ember_archer', 2, st('lose', 3, 8));
  assert.strictEqual(r.shards, 0);
  assert.strictEqual(P.raidBest('ember_archer'), 1, '지면 기록 그대로');
  assert.strictEqual(P.shardsOf('ember_archer'), 6 + 3 + 1);
  assert.strictEqual(P.shardsOf('frost_crystal'), 0, '조각은 그 탑에만');
});

test('조각 강화: 비용만큼 쓰고 단계가 오름, 5단계가 끝, 모자라면 안 됨, 판에 넘기는 값', () => {
  const { RG } = fresh();
  const P = RG.progress;
  const cost = RG.data.raid.shard.cost;
  assert.strictEqual(P.shardLevels(), null, '없으면 null');
  assert.ok(!P.upgradeShard('ember_archer').ok);
  P.get().shards.ember_archer = cost.reduce((a, b) => a + b, 0) + 3;
  for (let i = 0; i < 5; i++) { const r = P.upgradeShard('ember_archer'); assert.ok(r.ok && r.lv === i + 1); }
  assert.strictEqual(P.shardsOf('ember_archer'), 3);
  assert.ok(!P.upgradeShard('ember_archer').ok, '5단계 끝');
  assert.strictEqual(JSON.stringify(P.shardLevels()), JSON.stringify({ ember_archer: 5 }));
  // 저장·불러오기
  P.save();
  P.load();
  assert.strictEqual(P.shardLvOf('ember_archer'), 5);
});

test('예전 저장(조각 칸 없음)도 불러짐', () => {
  const { RG } = fresh();
  const p = RG.progress.get();
  delete p.shards; delete p.shardLv; delete p.raid;
  RG.progress.save();
  RG.progress.load();
  assert.strictEqual(RG.progress.shardsOf('ember_archer'), 0);
  assert.strictEqual(RG.progress.raidBest('ember_archer'), 0);
});

test('레이드 판: 과제 없음, 시작 골드·웨이브 수가 설정대로, 이기면 끝', () => {
  const { RG } = fresh();
  const g = raidGame(RG, 'flame_mortar', 1);
  assert.strictEqual(g.state.task, null);
  assert.strictEqual(g.state.gold, RG.raid.setup('flame_mortar', 1).raid.startGold);
  assert.strictEqual(g.state.wave.total, RG.data.raid.difficulty[0].waves);
  // 화면(다음 웨이브 미리보기·그림 미리 굽기)이 읽는 웨이브 글은 맵 데이터가 아니라 레이드 웨이브
  assert.strictEqual(JSON.stringify(g.waveStrings), JSON.stringify(RG.raid.setup('flame_mortar', 1).raid.waves));
  const c = RG.sim.create({ mapId: '1-1', mode: 'normal', seed: 1 });
  assert.strictEqual(JSON.stringify(c.waveStrings), JSON.stringify(RG.data.maps[0].waves));
});

test('지원 탑 레이드: 적은 적게·단단하게, 갑옷 적 없음, 처치 골드·경험치 더, 쓰러지면 처음 자리에서 일어남, 영웅 보정', () => {
  const { RG } = fresh();
  const S = RG.data.raid.supportHero;
  const sup = RG.grid.parseWaves(RG.raid.waves('sanctuary', 4, 'kara'));
  const atk = RG.grid.parseWaves(RG.raid.waves('ember_archer', 4, 'kara'));
  const count = (ws) => ws.reduce((a, w) => a + w.groups.reduce((b, g) => b + g.n, 0), 0);
  assert.ok(count(sup) < count(atk) * 0.6, `적 수 ${count(sup)} < ${count(atk)}`);
  for (const w of sup) for (const g of w.groups) assert.ok(!RG.data.raid.pool.armored.includes(g.e), `갑옷 적 ${g.e}`);
  const s = RG.raid.setup('sanctuary', 2, 'kara');
  assert.ok(s.raid.support && s.raid.bountyMult > 2);
  assert.strictEqual(RG.raid.setup('ember_archer', 2, 'kara').raid.bountyMult, 0, '공격 탑 레이드는 그대로');
  // 영웅마다 체력 보정: 모든 영웅에 값이 있고, 같은 탑·난이도라도 영웅에 따라 적 체력이 다름
  for (const h of RG.data.heroOrder) assert.ok(S.heroHp[h] > 0, h);
  assert.ok(RG.raid.setup('sanctuary', 2, 'sera').hpMult < RG.raid.setup('sanctuary', 2, 'kara').hpMult);
  assert.strictEqual(RG.raid.setup('ember_archer', 2, 'sera').hpMult, RG.raid.setup('ember_archer', 2, 'kara').hpMult, '공격 탑 레이드는 영웅 보정 없음');
  // 쓰러진 영웅: 등불 곁이 아니라 처음 자리 근처에서 일어남
  const g = raidGame(RG, 'sanctuary', 1);
  const h = g.state.hero;
  const home = { x: h.x, y: h.y };
  // 등불 쪽에서 쓰러진 것처럼
  h.x = g.map.lantern.x - 1; h.y = g.map.lantern.y; h.hp = 0; h.dead = true; h.downUntil = g.state.time + 0.3;
  let revived = false;
  for (let i = 0; i < 30 * 5 && !revived; i++) { g.step(); revived = !h.dead; }
  assert.ok(revived, '다시 일어남');
  assert.ok(Math.hypot(h.x - home.x, h.y - home.y) < 1.5, `처음 자리 근처 (${h.x.toFixed(1)},${h.y.toFixed(1)}) vs (${home.x},${home.y})`);
  // 공격 탑 레이드는 예전처럼 등불 곁
  const q = raidGame(RG, 'ember_archer', 1);
  const qh = q.state.hero;
  qh.hp = 0; qh.dead = true; qh.downUntil = q.state.time + 0.3;
  for (let i = 0; i < 30 * 5 && qh.dead; i++) q.step();
  assert.ok(Math.hypot(qh.x - q.map.lantern.x, qh.y - q.map.lantern.y) < 2, '공격 탑 레이드는 등불 곁');
});
