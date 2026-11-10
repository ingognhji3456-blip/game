'use strict';

/* 탑 뽑기 — js/core/gacha.js, 진행도 연결, 전투 강화 효과 (DESIGN.md §11.5) */
const assert = require('assert');
const { loadGame } = require('./load');

const seeded = (seed) => { let s = seed >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
const fresh = () => {
  const L = loadGame();
  L.RG.progress.load();
  return L;
};
const js = (v) => JSON.stringify(v);
const winRec = (lives = 12) => ({ result: 'win', lives, task: { done: true }, wave: { index: 8 } });

test('처음 시작: 기본 탑 3종만 가지고, 뽑기에도 기본 3종만, 공명석 100', () => {
  const { RG } = fresh();
  const P = RG.progress;
  assert.strictEqual(js(P.ownedTowers()), js(['ember_archer', 'frost_crystal', 'stone_barracks']));
  assert.strictEqual(js(P.gachaPool()), js(['ember_archer', 'frost_crystal', 'stone_barracks']));
  assert.strictEqual(P.gachaState().crystals, RG.gacha.COST.one);
  assert.ok(!('tickets' in P.gachaState()), '확정권 없음');
  assert.strictEqual(P.towerRank('void_orb'), -1);
});

test('모든 탑에 등급이 있고, 기본 등급 확률 합은 1', () => {
  const { RG } = fresh();
  for (const t of RG.data.towerOrder) assert.ok(['common', 'rare', 'epic'].includes(RG.gacha.RARITY[t]), t);
  const sum = Object.values(RG.gacha.RARITIES).reduce((a, r) => a + r.rate, 0);
  assert.ok(Math.abs(sum - 1) < 1e-9);
});

test('뽑기에 든 탑만 나옴: 처음엔 기본 3종(중복 → 강화)만, 스테이지가 열려야 새 탑이 뽑기에 들어옴', () => {
  const { RG } = fresh();
  const P = RG.progress;
  P.gachaState().crystals = 1e6;
  for (let i = 0; i < 30; i++) {
    const r = P.pullGacha('one', seeded(i + 1));
    assert.ok(RG.gacha.BASIC.includes(r.results[0].type), `기본 탑만: ${r.results[0].type}`);
  }
  assert.ok(P.ownedTowers().length === 3, '새 탑을 얻지 않음');
});

test('스테이지가 열리면 그 탑이 뽑기에 들어갈 뿐, 가진 탑은 늘지 않음 (확정으로 주지 않음)', () => {
  const { RG } = fresh();
  const P = RG.progress;
  P.record('1-1', 'normal', winRec());
  const rec = P.record('1-2', 'normal', winRec());
  // 1-2 클리어 → 1-3(화염 박격포가 처음 나오는 맵)이 열림
  assert.strictEqual(js(rec.reward.pooled), js(['flame_mortar']));
  assert.ok(P.inPool('flame_mortar'));
  assert.ok(!P.ownsTower('flame_mortar'), '확정으로 주지 않음');
  assert.strictEqual(P.ownedTowers().length, 3);
  assert.ok(!('tickets' in rec.reward));
  // 다시 깨면 새로 들어오는 탑 없음
  assert.strictEqual(P.record('1-2', 'normal', winRec()).reward.pooled.length, 0);
  // 뽑기에 든 탑이면 뽑기로 나올 수 있음
  const pool = P.gachaPool();
  let got = false;
  for (let s = 1; s <= 200 && !got; s++) { const st = { owned: {}, crystals: 100, pity: 0 }; got = RG.gacha.pull(st, 'one', seeded(s), pool).results[0].type === 'flame_mortar'; }
  assert.ok(got, '뽑기에서 나옴');
});

test('뽑기에 없는 등급의 확률은 있는 등급에 비율대로 나뉨', () => {
  const { RG } = fresh();
  const r1 = RG.gacha.ratesFor(RG.gacha.BASIC);
  assert.deepStrictEqual(js(r1), js({ common: 1, rare: 0, epic: 0 }));
  const r2 = RG.gacha.ratesFor(['ember_archer', 'winter_bell']);
  assert.ok(Math.abs(r2.common - 2 / 3) < 1e-9 && Math.abs(r2.rare - 1 / 3) < 1e-9 && r2.epic === 0);
  const r3 = RG.gacha.ratesFor(RG.data.towerOrder);
  assert.ok(Math.abs(r3.common - 0.6) < 1e-9 && Math.abs(r3.rare - 0.3) < 1e-9 && Math.abs(r3.epic - 0.1) < 1e-9);
});

test('중복이 나오면 그 탑 강화 +1, 최대 +5, 그 뒤로는 공명석 30을 돌려받음', () => {
  const { RG } = fresh();
  const st = { owned: { ember_archer: 0 }, crystals: 0, pity: 0 };
  for (let i = 1; i <= 5; i++) assert.strictEqual(RG.gacha.grant(st, 'ember_archer').rank, i);
  const r = RG.gacha.grant(st, 'ember_archer');
  assert.strictEqual(r.refund, RG.gacha.REFUND);
  assert.strictEqual(st.owned.ember_archer, RG.gacha.MAX_RANK);
  assert.strictEqual(st.crystals, RG.gacha.REFUND);
});

test('1회 100·10회 900을 쓰고, 공명석이 모자라면 뽑지 않음', () => {
  const { RG } = fresh();
  const all = RG.data.towerOrder;
  const st = { owned: {}, crystals: 950, pity: 0 };
  const r10 = RG.gacha.pull(st, 'ten', seeded(3), all);
  assert.ok(r10.ok && r10.results.length === 10);
  assert.strictEqual(st.crystals - r10.results.reduce((s, x) => s + x.refund, 0), 50);
  const st2 = { owned: {}, crystals: 99, pity: 0 };
  assert.ok(!RG.gacha.pull(st2, 'one', Math.random, all).ok);
  assert.strictEqual(st2.crystals, 99);
  assert.ok(!RG.gacha.pull({ owned: {}, crystals: 1e6, pity: 0 }, 'ticket', Math.random, all).ok, '확정권 뽑기는 없음');
});

test('10회 뽑기에는 희귀 이상이 반드시 하나 (뽑기에 희귀가 있을 때)', () => {
  const { RG } = fresh();
  const pool = ['ember_archer', 'stone_barracks', 'frost_crystal', 'flame_mortar', 'winter_bell'];
  for (let seed = 1; seed <= 200; seed++) {
    const st = { owned: {}, crystals: 900, pity: 0 };
    const r = RG.gacha.pull(st, 'ten', seeded(seed), pool);
    assert.ok(r.results.some((x) => x.rarity !== 'common'), `시드 ${seed}`);
  }
  // 기본 3종뿐이면 일반만 나와도 됨
  const st = { owned: {}, crystals: 900, pity: 0 };
  assert.ok(RG.gacha.pull(st, 'ten', seeded(1), RG.gacha.BASIC).results.every((x) => x.rarity === 'common'));
});

test('천장: 영웅 탑이 뽑기에 들어온 뒤 30회 안에 영웅 확정, 영웅이 없으면 세지 않음', () => {
  const { RG } = fresh();
  const allCommon = () => 0.99; // 늘 일반이 나오는 운
  const noEpic = ['ember_archer', 'winter_bell'];
  const st = { owned: {}, crystals: 1e6, pity: 0 };
  for (let i = 0; i < 40; i++) RG.gacha.pull(st, 'one', allCommon, noEpic);
  assert.strictEqual(st.pity, 0, '영웅이 없는 뽑기는 천장을 세지 않음');
  const withEpic = noEpic.concat(['shadow_snare']);
  let epicAt = -1;
  for (let i = 1; i <= 30; i++) { if (RG.gacha.pull(st, 'one', allCommon, withEpic).results[0].rarity === 'epic') { epicAt = i; break; } }
  assert.strictEqual(epicAt, RG.gacha.PITY);
  assert.strictEqual(st.pity, 0, '영웅이 나오면 천장 초기화');
});

test('확률은 대략 60/30/10 (모든 탑이 뽑기에 있을 때, 시드 고정 2만 회)', () => {
  const { RG } = fresh();
  const rng = seeded(11);
  const n = { common: 0, rare: 0, epic: 0 };
  for (let i = 0; i < 20000; i++) n[RG.gacha.rollRarity(rng, null, RG.data.towerOrder)]++;
  assert.ok(Math.abs(n.common / 20000 - 0.6) < 0.02 && Math.abs(n.rare / 20000 - 0.3) < 0.02 && Math.abs(n.epic / 20000 - 0.1) < 0.015, JSON.stringify(n));
});

test('판 결과로 공명석: 첫 클리어 100 + 새 별 30씩 + 승리 15 (패배 5)', () => {
  const { RG } = fresh();
  const P = RG.progress;
  const before = P.gachaState().crystals;
  const rec = P.record('1-2', 'normal', winRec());
  assert.strictEqual(rec.reward.crystals, RG.gacha.REWARD.win + RG.gacha.REWARD.firstClear + 4 * RG.gacha.REWARD.perStar);
  assert.strictEqual(P.gachaState().crystals, before + rec.reward.crystals);
  assert.strictEqual(P.record('1-2', 'normal', winRec()).reward.crystals, RG.gacha.REWARD.win, '다시 하면 승리 보상만');
  assert.strictEqual(P.record('1-3', 'normal', { result: 'lose', lives: 0, wave: { index: 3 } }).reward.crystals, RG.gacha.REWARD.lose);
});

test('예전 기록(뽑기 전)은 그때까지 해금한 탑을 그대로 가지고, 뽑기에도 열린 스테이지의 탑이 들어 있음', () => {
  const L = loadGame();
  const old = { v: 1, maps: { '1-1': { cleared: true, stars: 3 }, '1-2': { cleared: true, stars: 3 }, '1-3': { cleared: true, stars: 2 }, '1-4': { cleared: true, stars: 3 } }, skills: [], seen: {}, endless: {} };
  L.store.set(L.RG.save.KEYS.progress, JSON.stringify(old));
  L.RG.progress.load();
  const owned = L.RG.progress.ownedTowers();
  for (const t of ['ember_archer', 'stone_barracks', 'frost_crystal', 'flame_mortar', 'crystal_mine', 'sanctuary']) assert.ok(owned.includes(t), `${t} 유지`);
  assert.ok(!owned.includes('winter_bell'));
  assert.ok(L.RG.progress.inPool('sanctuary') && !L.RG.progress.inPool('winter_bell'));
});

test('잠깐 있었던 새 탑 확정권은 장당 공명석 100으로 바뀜', () => {
  const L = loadGame();
  const prev = { v: 1, maps: {}, skills: [], seen: { story: ['x'] }, endless: {}, gacha: { owned: { ember_archer: 0, stone_barracks: 0, frost_crystal: 0 }, crystals: 40, tickets: 2, pity: 3 } };
  L.store.set(L.RG.save.KEYS.progress, JSON.stringify(prev));
  L.RG.progress.load();
  const g = L.RG.progress.gachaState();
  assert.strictEqual(g.crystals, 40 + 2 * L.RG.gacha.TICKET_TO_CRYSTALS);
  assert.ok(!('tickets' in g));
  assert.strictEqual(g.pity, 3);
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
  assert.strictEqual(calcOf(mk({ ember_archer: 3 }, 'challenge'), 'ember_archer', 5, 2).rank, 0, '도전 모드는 강화 없음');
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

test('강화 단계가 있어도 이어하기(명령 재현)가 같은 결과', () => {
  const { RG } = fresh();
  const opts = { mapId: '1-2', seed: 7, heroId: 'kara', towers: ['ember_archer', 'frost_crystal', 'stone_barracks'], towerRanks: { ember_archer: 3, frost_crystal: 5, stone_barracks: 1 } };
  const g = RG.sim.create(opts); // 골드는 손대지 않음(재현에는 명령만 들어가므로)
  const cmds = [[10, { type: 'build', tower: 'ember_archer', c: 5, r: 2 }], [40, { type: 'build', tower: 'frost_crystal', c: 6, r: 2 }], [70, { type: 'callWave' }], [400, { type: 'build', tower: 'stone_barracks', c: 7, r: 4 }]];
  for (let i = 0; i < 1200; i++) { for (const [at, c] of cmds) if (at === i) g.cmd(c); g.step(); }
  const ref = RG.sim.replay(opts, g.log, g.state.tick);
  assert.strictEqual(ref.hash(), g.hash());
  // 강화가 다르면 결과도 달라짐 (강화가 실제로 판에 들어갔는지)
  const other = RG.sim.replay(Object.assign({}, opts, { towerRanks: {} }), g.log, g.state.tick);
  assert.notStrictEqual(other.hash(), g.hash());
});
