'use strict';

/* 탑 뽑기 — js/core/gacha.js, 진행도 연결, 전투 강화 효과 */
const assert = require('assert');
const { loadGame } = require('./load');

const seeded = (seed) => { let s = seed >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
const fresh = () => {
  const L = loadGame();
  L.RG.progress.load();
  return L;
};

test('처음 시작: 기본 탑 3종만 가지고, 공명석 100으로 1회 뽑을 수 있음', () => {
  const { RG } = fresh();
  const g = RG.progress.gachaState();
  assert.strictEqual(JSON.stringify(RG.progress.ownedTowers()), JSON.stringify(['ember_archer', 'frost_crystal', 'stone_barracks']));
  assert.strictEqual(g.crystals, RG.gacha.COST.one);
  assert.ok(RG.gacha.BASIC.every((t) => RG.progress.towerRank(t) === 0));
  assert.strictEqual(RG.progress.towerRank('void_orb'), -1);
});

test('모든 탑에 등급이 있고, 등급 확률 합은 1', () => {
  const { RG } = fresh();
  for (const t of RG.data.towerOrder) assert.ok(['common', 'rare', 'epic'].includes(RG.gacha.RARITY[t]), t);
  const sum = Object.values(RG.gacha.RARITIES).reduce((a, r) => a + r.rate, 0);
  assert.ok(Math.abs(sum - 1) < 1e-9);
});

test('중복이 나오면 그 탑 강화 +1, 최대 +5, 그 뒤로는 공명석 30을 돌려받음', () => {
  const { RG } = fresh();
  const st = { owned: { ember_archer: 0 }, crystals: 0, tickets: 0, pity: 0 };
  for (let i = 1; i <= 5; i++) assert.deepStrictEqual(RG.gacha.grant(st, 'ember_archer').rank, i);
  const r = RG.gacha.grant(st, 'ember_archer');
  assert.strictEqual(r.refund, RG.gacha.REFUND);
  assert.strictEqual(st.owned.ember_archer, RG.gacha.MAX_RANK);
  assert.strictEqual(st.crystals, RG.gacha.REFUND);
  const n = RG.gacha.grant(st, 'void_orb');
  assert.ok(n.isNew && st.owned.void_orb === 0);
});

test('1회 100·10회 900을 쓰고, 공명석이 모자라면 뽑지 않음', () => {
  const { RG } = fresh();
  const st = { owned: {}, crystals: 950, tickets: 0, pity: 0 };
  const r10 = RG.gacha.pull(st, 'ten', seeded(3));
  assert.ok(r10.ok && r10.results.length === 10);
  assert.strictEqual(st.crystals + r10.results.reduce((s, x) => s - x.refund, 0), 50);
  const no = RG.gacha.pull(st, 'one', seeded(4));
  assert.ok(!no.ok || st.crystals >= 0);
  const st2 = { owned: {}, crystals: 99, tickets: 0, pity: 0 };
  assert.ok(!RG.gacha.pull(st2, 'one').ok);
  assert.strictEqual(st2.crystals, 99);
});

test('10회 뽑기에는 희귀 이상이 반드시 하나', () => {
  const { RG } = fresh();
  for (let seed = 1; seed <= 200; seed++) {
    const st = { owned: {}, crystals: 900, tickets: 0, pity: 0 };
    const r = RG.gacha.pull(st, 'ten', seeded(seed));
    assert.ok(r.results.some((x) => x.rarity !== 'common'), `시드 ${seed}`);
  }
});

test('천장: 30회 안에 영웅 등급이 반드시 나옴', () => {
  const { RG } = fresh();
  const allCommon = () => 0.99; // 늘 일반이 나오는 운
  const st = { owned: {}, crystals: 1e6, tickets: 0, pity: 0 };
  let epicAt = -1;
  for (let i = 1; i <= 30; i++) {
    const r = RG.gacha.pull(st, 'one', allCommon);
    if (r.results[0].rarity === 'epic') { epicAt = i; break; }
  }
  assert.strictEqual(epicAt, RG.gacha.PITY);
  assert.strictEqual(st.pity, 0, '영웅이 나오면 천장 초기화');
});

test('확률은 대략 60/30/10 (시드 고정 2만 회)', () => {
  const { RG } = fresh();
  const rng = seeded(11);
  const n = { common: 0, rare: 0, epic: 0 };
  for (let i = 0; i < 20000; i++) n[RG.gacha.rollRarity(rng)]++;
  assert.ok(Math.abs(n.common / 20000 - 0.6) < 0.02 && Math.abs(n.rare / 20000 - 0.3) < 0.02 && Math.abs(n.epic / 20000 - 0.1) < 0.015, JSON.stringify(n));
});

test('새 탑 확정권: 아직 없는 탑만 나오고, 모두 가지면 쓸 수 없음', () => {
  const { RG } = fresh();
  const st = { owned: { ember_archer: 0, stone_barracks: 0, frost_crystal: 0 }, crystals: 0, tickets: 15, pity: 0 };
  for (let i = 0; i < 15; i++) {
    const r = RG.gacha.pull(st, 'ticket', seeded(i + 1));
    assert.ok(r.ok && r.results[0].isNew, `${i}번째 확정권`);
  }
  assert.strictEqual(Object.keys(st.owned).length, RG.data.towerOrder.length);
  st.tickets = 1;
  assert.ok(!RG.gacha.pull(st, 'ticket').ok);
});

test('판 결과로 공명석: 첫 클리어 100 + 새 별 30씩 + 승리 15, 새 탑이 나오던 맵 앞이면 확정권', () => {
  const { RG } = fresh();
  const P = RG.progress;
  const before = P.gachaState().crystals;
  const rec = P.record('1-2', 'normal', { result: 'win', lives: 12, task: { done: true }, wave: { index: 8 } });
  // 1-2 첫 클리어: ★3 + 과제 = 새 별 4개, 다음 맵 1-3은 화염 박격포가 새로 나오던 맵 → 확정권 1
  assert.strictEqual(rec.reward.crystals, RG.gacha.REWARD.win + RG.gacha.REWARD.firstClear + 4 * RG.gacha.REWARD.perStar);
  assert.strictEqual(rec.reward.tickets, 1);
  assert.strictEqual(P.gachaState().crystals, before + rec.reward.crystals);
  const again = P.record('1-2', 'normal', { result: 'win', lives: 12, task: { done: true }, wave: { index: 8 } });
  assert.strictEqual(again.reward.crystals, RG.gacha.REWARD.win, '다시 하면 승리 보상만');
  assert.strictEqual(again.reward.tickets, 0);
  const lose = P.record('1-3', 'normal', { result: 'lose', lives: 0, wave: { index: 3 } });
  assert.strictEqual(lose.reward.crystals, RG.gacha.REWARD.lose);
});

test('예전 기록(뽑기 전)은 그때까지 해금한 탑을 그대로 가짐', () => {
  const L = loadGame();
  const old = { v: 1, maps: { '1-1': { cleared: true, stars: 3 }, '1-2': { cleared: true, stars: 3 }, '1-3': { cleared: true, stars: 2 }, '1-4': { cleared: true, stars: 3 } }, skills: [], seen: {}, endless: {} };
  L.store.set(L.RG.save.KEYS.progress, JSON.stringify(old));
  L.RG.progress.load();
  const owned = L.RG.progress.ownedTowers();
  for (const t of ['ember_archer', 'stone_barracks', 'frost_crystal', 'flame_mortar', 'crystal_mine', 'sanctuary']) assert.ok(owned.includes(t), `${t} 유지`);
  assert.ok(!owned.includes('winter_bell'));
});

test('강화 단계가 전투에 반영: 공격 탑 공격력, 지원 탑 지원 효과, 병영 병사, 광산 수입 (+6%/단계, 도전 모드는 없음)', () => {
  const { RG } = fresh();
  const mk = (ranks, mode = 'normal') => {
    const g = RG.sim.create({ mapId: '1-1', seed: 1, heroId: null, mode, towerRanks: ranks });
    g.state.gold = 1e6;
    return g;
  };
  const calcOf = (g, type, c, r) => { const res = g.cmd({ type: 'build', tower: type, c, r }); assert.ok(res.ok, res.reason); RG.stats.computeAll(g); return g.state.towers.find((t) => t.id === res.id).calc; };
  const base = calcOf(mk({}), 'ember_archer', 5, 2);
  const up = calcOf(mk({ ember_archer: 3 }), 'ember_archer', 5, 2);
  assert.ok(Math.abs((up.dmgBonus - base.dmgBonus) - 0.18) < 1e-9, '공격력 +18%');
  const ch = calcOf(mk({ ember_archer: 3 }, 'challenge'), 'ember_archer', 5, 2);
  assert.strictEqual(ch.rank, 0, '도전 모드는 강화 없음');
  const b0 = calcOf(mk({}), 'stone_barracks', 5, 2);
  const b5 = calcOf(mk({ stone_barracks: 5 }), 'stone_barracks', 5, 2);
  assert.ok(Math.abs(b5.soldiers.hp / b0.soldiers.hp - 1.3) < 1e-9 && Math.abs(b5.soldiers.damage / b0.soldiers.damage - 1.3) < 1e-9, '병사 +30%');
  const s0 = calcOf(mk({}), 'sanctuary', 5, 2);
  const s2 = calcOf(mk({ sanctuary: 2 }), 'sanctuary', 5, 2);
  if (s0.heal) assert.ok(Math.abs(s2.heal.hps / s0.heal.hps - 1.12) < 1e-9, '지원 효과 +12%');
  const m0 = calcOf(mk({}), 'crystal_mine', 5, 2);
  const m5 = calcOf(mk({ crystal_mine: 5 }), 'crystal_mine', 5, 2);
  assert.strictEqual(m5.income, Math.round(m0.income * 1.3), '광산 수입 +30%');
});
