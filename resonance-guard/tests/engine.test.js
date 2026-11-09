'use strict';

/* 규칙 테스트 — DESIGN.md §5~§12, 특히 §7.2 엔진 규칙 부록 */
const assert = require('assert');
const { loadGame } = require('./load');

const { RG } = loadGame();
const same = (a, b, msg) => assert.deepStrictEqual(JSON.parse(JSON.stringify(a)), b, msg);
const near = (a, b, eps = 1e-6, msg = '') => assert.ok(Math.abs(a - b) <= eps, `${msg} 기대 ${b}, 실제 ${a}`);

function game(opts = {}) {
  return RG.sim.create(Object.assign({ mapId: '1-1', seed: 1, heroId: null }, opts));
}
function run(g, sec) { for (let i = 0; i < Math.round(sec * 30); i++) g.step(); }
function spawn(g, type, x, y) {
  const e = g.api.spawnEnemy(type, 0);
  if (x != null) { e.x = x; e.y = y; e.c = Math.floor(x); e.r = Math.floor(y); e.tc = e.c; e.tr = e.r; e.px = x; e.py = y; }
  return e;
}
function rich(g) { g.state.gold = 99999; return g; }
function build(g, tower, c, r) {
  const res = g.cmd({ type: 'build', tower, c, r });
  assert.ok(res.ok, `건설 실패 ${tower} (${c},${r}): ${res.reason}`);
  return g.state.towers.find((t) => t.id === res.id);
}
/** 시험용: 적을 제자리에 묶음(속박 — 행동은 함) */
function freeze(g) { g.state.enemies.forEach((e) => { e.ccUntil = 1e9; e.ccKind = 'root'; }); }

/* ---------------- 데이터·맵 ---------------- */
test('모든 맵 격자가 유효하고 입구가 울림등과 이어짐', () => {
  for (const m of RG.data.maps.concat(RG.data.endless)) RG.grid.parseMap(m);
});

test('웨이브 문자열 해석', () => {
  const w = RG.grid.parseWaves(['mist_rat*5/1.4', 'ash_boar*2/2.5@3>1 ; mist_rat']);
  same(w[0].groups[0], { e: 'mist_rat', n: 5, gap: 1.4, at: 0, s: 0 });
  same(w[1].groups[0], { e: 'ash_boar', n: 2, gap: 2.5, at: 3, s: 1 });
  same(w[1].groups[1], { e: 'mist_rat', n: 1, gap: 1, at: 0, s: 0 });
});

test('모든 맵의 웨이브가 존재하는 적만 쓴다', () => {
  for (const m of RG.data.maps) for (const w of RG.grid.parseWaves(m.waves)) for (const g of w.groups) assert.ok(RG.data.enemies[g.e], `${m.id}: ${g.e}`);
});

/* ---------------- 피해 계산 §7 ---------------- */
test('피해 계산 순서: 보너스 합 × 받는 피해 × 갑옷 × 친화 × 치명타', () => {
  const g = game();
  const e = spawn(g, 'rust_knight', 3.5, 1.5);   // 갑옷 0.4
  e.hp = e.maxHp = 10000;
  e.st.curse = { pct: 0.2, until: 99 };
  const calc = { element: 'fire', dmgBonus: 0.3, mods: { armorIgnore: 0.25 }, onHit: {} };
  const dealt = g.api.damage(e, 100, 'fire', { calc }, { crit: 2 });
  // 100 × 1.3 × 1.2 × (1 − 0.4×0.75) × 1 × 2
  near(dealt, 100 * 1.3 * 1.2 * (1 - 0.3) * 2, 1e-6);
});

test('원소 친화: 약점 1.5배, 저항 0.5배, 면역 0', () => {
  const g = game();
  const husk = spawn(g, 'straw_husk', 3.5, 1.5);
  near(g.api.damage(husk, 10, 'fire', null, {}), 15);
  const wolf = spawn(g, 'frost_wolf', 4.5, 1.5);
  near(g.api.damage(wolf, 10, 'frost', null, {}), 5);
  const lizard = spawn(g, 'cinder_lizard', 5.5, 1.5);
  near(g.api.damage(lizard, 10, 'fire', null, {}), 0);
});

test('흡수: 직접 명중은 회복, 범위 피해는 0', () => {
  const g = game();
  const sp = spawn(g, 'flame_spirit', 3.5, 1.5);
  sp.hp = 100;
  g.api.damage(sp, 30, 'fire', null, {});
  near(sp.hp, 130);
  g.api.damage(sp, 30, 'fire', null, { area: true });
  near(sp.hp, 130);
});

test('지속 피해는 갑옷을 무시', () => {
  const g = game();
  const e = spawn(g, 'rust_knight', 3.5, 1.5);
  near(g.api.damage(e, 10, 'fire', null, { dot: true }), 10);
  near(g.api.damage(e, 10, 'fire', null, {}), 6);
});

test('보호막이 먼저 깎이고, 고요한 밤은 보호막에만 +50%', () => {
  const g = game();
  const e = spawn(g, 'ice_shieldbearer', 3.5, 1.5);
  const hp0 = e.hp;
  const sh0 = e.shield;
  assert.ok(sh0 > 0);
  const calc = { element: 'fire', dmgBonus: 0, mods: { stillness: { dur: 3, shieldBonus: 0.5 } }, onHit: {} };
  g.api.damage(e, 20, 'fire', { calc }, {});
  near(e.shield, sh0 - 30);
  near(e.hp, hp0);
  // 남은 보호막보다 큰 피해: 넘친 만큼(보너스 제외)만 체력에
  const rest = e.shield;
  g.api.damage(e, rest / 1.5 + 10, 'fire', { calc }, {});
  near(e.shield, 0);
  near(e.hp, hp0 - 10, 1e-6);
});

/* ---------------- 공명 §6 ---------------- */
test('이웃한 불·얼음 탑은 증기 폭발을 함께 받는다', () => {
  const g = rich(game());
  const a = build(g, 'ember_archer', 4, 2);
  const b = build(g, 'frost_crystal', 5, 2);
  same(a.effects, ['fire+frost']);
  same(b.effects, ['fire+frost']);
  assert.ok(a.calc.mods.steam && b.calc.mods.steam);
});

test('같은 원소는 순수 공명, 같은 효과는 한 번만', () => {
  const g = rich(game());
  const a = build(g, 'ember_archer', 5, 2);
  build(g, 'ember_archer', 4, 2);
  build(g, 'ember_archer', 6, 2);
  same(a.effects, ['pure']);
  near(a.calc.dmgBonus, 0.12);
});

test('떨어진 탑은 연결되지 않는다', () => {
  const g = rich(game());
  const a = build(g, 'ember_archer', 4, 2);
  build(g, 'frost_crystal', 7, 2);
  same(a.effects, []);
});

test('수정 광산은 공명하지 않는다', () => {
  const g = rich(game({ mapId: '1-4' }));
  const m = build(g, 'crystal_mine', 4, 1);
  const a = build(g, 'ember_archer', 5, 1);
  same(m.effects, []);
  same(a.effects, []);
});

test('지원 탑: 공명 증폭(효과 하나당 +10%), 같은 종류 지원은 가장 강한 하나만', () => {
  RG.data.towers.forge.unlock = '1-1';
  const g = rich(game());
  const a = build(g, 'ember_archer', 5, 2);
  const f1 = build(g, 'forge', 4, 2);
  const f2 = build(g, 'forge', 6, 2);
  // 대장간 둘: 각자 순수 공명(불+불)으로 증폭 +10% → 0.15 × 1.1
  near(f1.calc.aura.damagePct, 0.15 * 1.1);
  // 궁수탑: 순수 0.12 + 대장간 가장 강한 하나
  near(a.calc.dmgBonus, 0.12 + 0.15 * 1.1);
  assert.ok(f2);
});

test('멈춘 탑은 공명이 끊기고 이웃도 그 효과를 잃는다', () => {
  const g = rich(game());
  const a = build(g, 'ember_archer', 4, 2);
  const b = build(g, 'frost_crystal', 5, 2);
  g.api.disableTower(b, 3, 'test');
  run(g, 0.1);
  assert.strictEqual(b.disabled, true);
  same(a.effects, []);
  run(g, 3.5);
  same(a.effects, ['fire+frost']);
});

test('공명 차단: 연결만 끊기고 공격은 한다', () => {
  const g = rich(game());
  const a = build(g, 'ember_archer', 4, 2);
  build(g, 'frost_crystal', 5, 2);
  const eater = spawn(g, 'resonance_eater', 4.5, 1.5);
  freeze(g);
  eater.hp = eater.maxHp = 1e6;
  run(g, 1);
  assert.strictEqual(a.dampened, true);
  assert.strictEqual(a.disabled, false);
  same(a.effects, []);
  assert.ok((g.state.stats.damageByTower[a.id] || 0) > 0, '공명이 끊겨도 공격은 해야 함');
});

/* ---------------- 건설·판매 §5 ---------------- */
test('전투 중 건설은 1초 준비, 첫 웨이브 전에는 즉시', () => {
  const g = rich(game());
  const a = build(g, 'ember_archer', 4, 2);
  assert.strictEqual(a.building, false);
  g.cmd({ type: 'callWave' });
  const b = build(g, 'ember_archer', 6, 2);
  assert.strictEqual(b.building, true);
  run(g, 1.05);
  assert.strictEqual(b.building, false);
});

test('판매: 첫 웨이브 전 100%, 이후 70%, 판 칸은 5초 잠김', () => {
  const g = rich(game());
  const a = build(g, 'ember_archer', 4, 2);
  assert.strictEqual(g.sellValue(a), 70);
  g.cmd({ type: 'callWave' });
  assert.strictEqual(g.sellValue(a), 49);
  g.cmd({ type: 'sell', id: a.id });
  assert.ok(!g.canBuild('ember_archer', 4, 2).ok);
  run(g, 5.1);
  assert.ok(g.canBuild('ember_archer', 4, 2).ok);
});

test('길 만들기: 길을 완전히 막을 수 없고, 적이 있는 칸에는 지을 수 없다', () => {
  const g = rich(game({ mapId: '1-4' }));
  // 입구 쪽 통로 (3,4)는 공터 → 막으면 길이 사라짐
  const r = g.canBuild('ember_archer', 3, 4);
  assert.ok(!r.ok && /막을 수 없/.test(r.reason), r.reason);
  // 공터 (6,4)는 지을 수 있고, 지으면 흐름장이 돌아감
  const before = g.flow[4 * 16 + 4];
  build(g, 'ember_archer', 6, 4);
  assert.ok(g.flow[4 * 16 + 4] > before, '돌아가는 길이 길어져야 함');
  const e = spawn(g, 'mist_rat', 8.5, 4.5);
  assert.ok(e);
  const r2 = g.canBuild('ember_archer', 8, 4);
  assert.ok(!r2.ok, '적 칸에 지으면 안 됨');
});

/* ---------------- 강한 제어 §7.2.6 ---------------- */
test('강한 제어 감쇠: ×1, ×0.5, ×0.25, 그다음 2초 면역', () => {
  const g = game();
  const e = spawn(g, 'ash_boar', 3.5, 1.5);
  const t0 = g.state.time;
  assert.ok(g.api.hardCC(e, 'freeze', 1));
  near(e.ccUntil - t0, 1);
  assert.ok(!g.api.hardCC(e, 'stun', 1), '걸려 있는 동안 새 제어 불가');
  run(g, 1.05);
  assert.ok(g.api.hardCC(e, 'stun', 1));
  near(e.ccUntil - g.state.time, 0.5, 1e-6);
  run(g, 0.55);
  assert.ok(g.api.hardCC(e, 'root', 1));
  near(e.ccUntil - g.state.time, 0.25, 1e-6);
  run(g, 0.3);
  assert.ok(!g.api.hardCC(e, 'freeze', 1), '네 번째는 면역');
  near(e.ccImmuneUntil - g.state.time, 2, 1e-6);
});

test('보스: 빙결 30%, 기절 면역', () => {
  const g = game();
  const b = spawn(g, 'hollow_elder', 3.5, 1.5);
  assert.ok(!g.api.hardCC(b, 'stun', 1));
  assert.ok(g.api.hardCC(b, 'freeze', 1));
  near(b.ccUntil - g.state.time, 0.3);
});

/* ---------------- 밀쳐내기 §7.2.7 ---------------- */
test('밀쳐내기: 지나온 길로 밀리고 저항이 쌓임, 크기 "대"는 안 밀림', () => {
  const g = game();
  const e = spawn(g, 'mist_rat');
  run(g, 2.5);
  const x0 = e.x;
  const towerSrc = { calc: { element: 'storm', dmgBonus: 0, mods: {}, onHit: { knockback: 1 } } };
  // 밀기는 명중 처리로
  const t = { id: -1, type: 'gale_cannon' };
  towerSrc.tower = t;
  g.api.damage(e, 0.0001, 'storm', null, { quiet: true });
  e.pushRes = 0;
  // 직접 호출
  RG.sim; // eslint
  const before = e.x;
  // 내부 push는 api에 없음 → onHit 경로를 쓰기 위해 바람 포탑을 짓고 맞힘
  const g2 = rich(game());
  const gc = (RG.data.towers.gale_cannon.unlock = '1-1', build(g2, 'gale_cannon', 6, 2));
  const r = spawn(g2, 'mist_rat');
  r.hp = r.maxHp = 1e6;
  run(g2, 4);
  assert.ok(r.pushRes > 0, '밀림 저항이 쌓여야 함');
  const tort = spawn(g2, 'ice_tortoise');
  tort.hp = tort.maxHp = 1e6;
  run(g2, 3);
  assert.strictEqual(tort.pushRes, 0, '크기 대는 밀리지 않음');
  assert.ok(gc && before === x0);
});

/* ---------------- 은신·굴착 §7.2.4 ---------------- */
test('은신: 탐지 없으면 표적 불가, 파동(범위)에는 맞음, 성소가 드러냄', () => {
  RG.data.towers.winter_bell.unlock = '1-1';
  const g = rich(game());
  const a = build(g, 'ember_archer', 4, 2);
  const w = spawn(g, 'rime_wraith', 4.5, 1.5);
  w.hp = w.maxHp = 1e6;
  freeze(g);
  run(g, 2);
  assert.strictEqual(g.state.stats.damageByTower[a.id] || 0, 0, '궁수탑은 숨은 적을 못 쏨');
  const bell = build(g, 'winter_bell', 5, 2);
  run(g, 3);
  assert.ok((g.state.stats.damageByTower[bell.id] || 0) > 0, '종 파동은 맞아야 함');
  build(g, 'sanctuary', 3, 0);
  run(g, 2);
  assert.ok(w.revealed);
  assert.ok((g.state.stats.damageByTower[a.id] || 0) > 0, '드러나면 쏨');
});

test('굴착 중에는 어떤 피해도 받지 않음', () => {
  const g = game();
  const e = spawn(g, 'sand_burrower', 3.5, 1.5);
  e.burrowed = true;
  near(g.api.damage(e, 50, 'fire', null, {}), 0);
});

/* ---------------- 재생·보호막·치유 ---------------- */
test('재생은 2초간 피해가 없을 때만', () => {
  const g = game();
  const e = spawn(g, 'vine_leech', 3.5, 1.5);
  freeze(g);
  g.api.damage(e, 50, 'fire', null, {});
  const hp1 = e.hp;
  run(g, 1.5);
  near(e.hp, hp1, 1e-9, '2초 전에는 회복 안 함');
  run(g, 1.5);
  assert.ok(e.hp > hp1, '2초 뒤 회복');
});

test('보호막은 정해진 시간 동안 안 맞으면 다시 찬다', () => {
  const g = game();
  const e = spawn(g, 'ice_shieldbearer', 3.5, 1.5);
  freeze(g);
  e.hp = e.maxHp = 1e6;
  g.api.damage(e, 1000, 'fire', null, {});
  assert.strictEqual(e.shield, 0);
  e.hp = e.maxHp;
  run(g, 3);
  assert.strictEqual(e.shield, 0);
  run(g, 3);
  assert.ok(e.shield > 0);
});

test('치유사는 주변을 치유, 정적의 종(halt)은 막음', () => {
  const g = game();
  const y = spawn(g, 'yeti_shaman', 3.5, 1.5);
  const b = spawn(g, 'ash_boar', 4.0, 1.5);
  freeze(g);
  b.hp = 10;
  run(g, 1);
  assert.ok(b.hp > 10, '치유돼야 함');
  b.hp = 10;
  b.st.haltUntil = g.state.time + 10;
  y.healCd = 0;
  run(g, 1);
  near(b.hp, 10);
});

/* ---------------- 분열·부활·적응 ---------------- */
test('분열: 포자 주머니 → 새끼 셋, 메아리 조각은 더 갈라지지 않음', () => {
  const g = game();
  const s = spawn(g, 'spore_sac', 3.5, 1.5);
  g.api.damage(s, 1e6, 'fire', null, {});
  run(g, 0.1);
  assert.strictEqual(g.state.enemies.filter((e) => e.type === 'sporeling').length, 3);
  const sh = spawn(g, 'echo_shade', 5.5, 1.5);
  g.api.damage(sh, 1e7, 'fire', null, {});
  run(g, 0.3);
  const frags = g.state.enemies.filter((e) => e.type === 'echo_shade');
  assert.strictEqual(frags.length, 2);
  assert.ok(frags.every((f) => f.fragment));
  frags.forEach((f) => { f.invulnUntil = 0; g.api.damage(f, 1e7, 'fire', null, {}); });
  run(g, 0.1);
  assert.strictEqual(g.state.enemies.filter((e) => e.type === 'echo_shade').length, 0);
});

test('부활: 처음 죽으면 일어남', () => {
  const g = game();
  const e = spawn(g, 'drowned_corsair', 3.5, 1.5);
  g.api.damage(e, 1e6, 'fire', null, {});
  assert.ok(!e.dead);
  near(e.hp, e.maxHp * 0.4);
  e.invulnUntil = 0;
  g.api.damage(e, 1e6, 'fire', null, {});
  assert.ok(e.dead);
});

test('적응: 같은 원소 연속 명중에 저항이 쌓이고 다른 원소에 0', () => {
  const g = game();
  const e = spawn(g, 'bellshard_golem', 3.5, 1.5);
  e.hp = e.maxHp = 1e6;
  const d1 = g.api.damage(e, 100, 'fire', null, {});
  const d2 = g.api.damage(e, 100, 'fire', null, {});
  near(d1, 100);
  near(d2, 92);
  g.api.damage(e, 100, 'frost', null, {});
  near(g.api.damage(e, 100, 'fire', null, {}), 100);
});

/* ---------------- 경제 ---------------- */
test('현상금 보너스 상한 +75%', () => {
  const g = game({ skills: ['lamp1', 'lamp2', 'lamp3', 'lamp4'] });
  const e = spawn(g, 'ash_boar', 3.5, 1.5);
  const g0 = g.state.gold;
  const calc = { element: 'earth', dmgBonus: 0, mods: { bountyPct: 0.9 }, onHit: {} };
  g.api.damage(e, 1e6, 'earth', { calc }, {});
  assert.strictEqual(g.state.gold - g0, Math.round(RG.data.enemies.ash_boar.bounty * 1.75));
});

test('광산 수입 감소: 100% · 80% · 60%', () => {
  const g = rich(game({ mapId: '1-4' }));
  build(g, 'crystal_mine', 4, 1);
  build(g, 'crystal_mine', 6, 1);
  build(g, 'crystal_mine', 8, 1);
  const g0 = g.state.gold;
  g.cmd({ type: 'callWave' });
  assert.strictEqual(g.state.gold - g0, Math.round(18) + Math.round(18 * 0.8) + Math.round(18 * 0.6));
});

test('조기 호출 보너스', () => {
  const g = game();
  g.cmd({ type: 'callWave' });
  run(g, 20);
  assert.ok(g.state.wave.countdown !== null);
  const cd = g.state.wave.countdown;
  const g0 = g.state.gold;
  const r = g.cmd({ type: 'callWave' });
  assert.ok(r.ok);
  assert.strictEqual(r.bonus, Math.ceil(cd * (10 / 15)));
  assert.ok(g.state.gold >= g0 + r.bonus);
});

/* ---------------- 불꽃·결과 ---------------- */
test('새어 들면 불꽃이 꺼지고, 보스가 닿으면 즉시 패배', () => {
  const g = game();
  const e = spawn(g, 'ash_boar', 13.5, 7.5);
  e.tc = 14; e.tr = 7;
  run(g, 2);
  assert.strictEqual(g.state.lives, 11);
  const b = spawn(g, 'hollow_elder', 13.5, 7.5);
  b.tc = 14; b.tr = 7;
  run(g, 4);
  assert.strictEqual(g.state.lives, 0);
  assert.strictEqual(g.state.result, 'lose');
});

test('등불 보호막: 처음 새어 든 일반 적 2마리는 무시', () => {
  const g = game({ skills: ['lamp1', 'lamp2', 'lamp3', 'lamp4', 'lamp5'] });
  for (let i = 0; i < 3; i++) { const e = spawn(g, 'mist_rat', 13.5, 7.5); e.tc = 14; e.tr = 7; }
  run(g, 2);
  assert.strictEqual(g.state.lives, 11);
});

/* ---------------- 도전 규칙 ---------------- */
test('도전: 탑 개수·판매 금지·원소 제한·이웃 금지·강화 제한·불꽃', () => {
  const ch = (type, value, mapId = '1-1') => {
    const def = RG.data.maps.find((m) => m.id === mapId);
    const save = def.challenge;
    def.challenge = { type, value, text: 'x' };
    const g = rich(game({ mapId, mode: 'challenge' }));
    def.challenge = save;
    return g;
  };
  let g = ch('maxTowers', 1);
  build(g, 'ember_archer', 4, 2);
  assert.ok(!g.canBuild('ember_archer', 6, 2).ok);
  g = ch('noSell');
  const t = build(g, 'ember_archer', 4, 2);
  assert.ok(!g.cmd({ type: 'sell', id: t.id }).ok);
  g = ch('allowElements', ['earth']);
  assert.ok(!g.canBuild('ember_archer', 4, 2).ok);
  assert.ok(g.canBuild('stone_barracks', 4, 2).ok);
  g = ch('noAdjacent');
  build(g, 'ember_archer', 4, 2);
  assert.ok(!g.canBuild('ember_archer', 5, 2).ok);
  g = ch('maxLevel', 2);
  const t2 = build(g, 'ember_archer', 4, 2);
  assert.ok(g.cmd({ type: 'upgrade', id: t2.id }).ok);
  assert.ok(!g.cmd({ type: 'upgrade', id: t2.id }).ok);
  g = ch('lives', 5);
  assert.strictEqual(g.state.lives, 5);
  g = ch('noHero');
  assert.strictEqual(g.state.hero, null);
});

test('도전에서는 기술 나무 효과가 없다', () => {
  const base = RG.data.maps[0].startGold;
  const g = game({ mode: 'challenge', skills: ['lamp1'] });
  assert.strictEqual(g.state.gold, base);
  const g2 = game({ skills: ['lamp1'] });
  assert.strictEqual(g2.state.gold, Math.round(base * 1.08));
});

/* ---------------- 공명 과제 ---------------- */
test('공명 과제: 연결 수·효과 종류·한 탑 효과 수', () => {
  const g = rich(game());
  build(g, 'ember_archer', 4, 2);
  build(g, 'frost_crystal', 5, 2);
  build(g, 'stone_barracks', 6, 2);
  const s = g.resonanceSnapshot();
  assert.strictEqual(s.links, 2);
  assert.ok(s.distinct.has('steam') && s.distinct.has('permafrost'));
  assert.strictEqual(s.stack, 2);
  g.checkTask(false);
  assert.ok(g.state.task.done, '1-1 과제(연결 2개)');
});

/* ---------------- 결정성 ---------------- */
test('같은 시드·같은 명령이면 같은 결과 (이어하기)', () => {
  const play = () => {
    const g = game({ heroId: 'kara', seed: 99 });
    g.cmd({ type: 'build', tower: 'ember_archer', c: 4, r: 2 });
    g.cmd({ type: 'build', tower: 'stone_barracks', c: 5, r: 2 });
    g.cmd({ type: 'callWave' });
    run(g, 40);
    g.cmd({ type: 'heroMove', x: 8.5, y: 4.5 });
    run(g, 40);
    return g;
  };
  const a = play();
  const b = play();
  assert.strictEqual(a.hash(), b.hash());
  const r = RG.sim.replay({ mapId: '1-1', seed: 99, heroId: 'kara' }, a.log, a.state.tick);
  assert.strictEqual(r.hash(), a.hash());
});

/* ---------------- 영웅 ---------------- */
test('영웅: 이동, 붙잡기 수, 기술 재사용 대기', () => {
  const g = game({ heroId: 'kara' });
  const h = g.state.hero;
  assert.ok(h);
  assert.ok(g.cmd({ type: 'heroMove', x: 5.5, y: 1.5 }).ok);
  run(g, 6);
  near(h.x, 5.5, 0.01);
  for (let i = 0; i < 5; i++) spawn(g, 'ash_boar', 5.3 + i * 0.05, 1.5).hp = 1e6;
  run(g, 0.2);
  assert.strictEqual(h.blocking.length, 3, '카라는 셋을 붙잡음');
  assert.ok(g.cmd({ type: 'heroSkill', x: 5.5, y: 1.5 }).ok);
  assert.ok(!g.cmd({ type: 'heroSkill', x: 5.5, y: 1.5 }).ok, '재사용 대기');
});

test('영웅이 탑·장애물로는 못 감', () => {
  const g = game({ heroId: 'kara' });
  assert.ok(!g.cmd({ type: 'heroMove', x: 0.5, y: 0.5 }).ok);
});

/* ---------------- 탑 공격 방식 ---------------- */
test('탑 공격 방식마다 실제로 피해를 준다', () => {
  for (const id of Object.keys(RG.data.towers)) RG.data.towers[id].unlock = '1-1';
  const kinds = ['ember_archer', 'flame_mortar', 'frost_crystal', 'ice_ballista', 'winter_bell', 'lightning_rod', 'gale_cannon', 'quake_hammer', 'sun_lens', 'radiance_spire', 'hex_spire', 'void_orb', 'shadow_snare'];
  for (const type of kinds) {
    const g = rich(game());
    const t = build(g, type, 5, 2);
    for (let i = 0; i < 4; i++) { const e = spawn(g, 'ash_boar'); e.hp = e.maxHp = 1e6; }
    run(g, 25);
    assert.ok((g.state.stats.damageByTower[t.id] || 0) > 0, `${type} 피해 없음`);
  }
});

test('분기 탑도 모두 동작 (Lv4 A·B)', () => {
  for (const type of Object.keys(RG.data.towers)) {
    for (const br of ['A', 'B']) {
      const g = rich(game());
      const t = build(g, type, 5, 2);
      for (let i = 0; i < 3; i++) assert.ok(g.cmd({ type: i < 2 ? 'upgrade' : 'branch', id: t.id, branch: br }).ok, `${type} 강화`);
      assert.strictEqual(t.level, 4);
      assert.strictEqual(t.branch, br);
      for (let i = 0; i < 3; i++) { const e = spawn(g, br === 'B' && type === 'gale_cannon' ? 'mist_crow' : 'ash_boar'); e.hp = e.maxHp = 1e6; }
      run(g, 15);
      const role = RG.data.towers[type].role;
      if (role === 'attack') assert.ok((g.state.stats.damageByTower[t.id] || 0) > 0, `${type} ${br} 피해 없음`);
    }
  }
});

test('탑은 자기 원소에 면역인 적을 표적으로 삼지 않는다', () => {
  const g = rich(game());
  const a = build(g, 'ember_archer', 5, 2);
  const l = spawn(g, 'cinder_lizard', 5.5, 1.5);
  l.hp = l.maxHp = 1e6;
  freeze(g);
  run(g, 2);
  assert.strictEqual(g.state.projectiles.length, 0);
  assert.strictEqual(g.state.stats.damageByTower[a.id] || 0, 0);
});

/* ---------------- 보스 ---------------- */
test('흰뿔: 경고 1.5초 뒤 탑을 멈춤', () => {
  const g = rich(game());
  const a = build(g, 'ember_archer', 5, 2);
  const w = spawn(g, 'whitehorn', 5.5, 1.5);
  w.hp = w.maxHp = 1e7;
  freeze(g);
  w.boss.timers.breath = 0.01;
  run(g, 0.1);
  assert.strictEqual(g.state.alerts.length, 1);
  assert.ok(!a.disabled);
  run(g, 1.6);
  assert.ok(a.disabled);
});

test('보스 페이즈: 고목은 절반에서 갑옷, 침묵은 면역이 바뀜', () => {
  const g = game();
  const b = spawn(g, 'hollow_elder', 3.5, 1.5);
  freeze(g);
  g.api.damage(b, b.maxHp * 0.55, 'earth', null, {});
  run(g, 0.1);
  near(b.bossArmor, 0.3);
  const s = spawn(g, 'the_silence', 5.5, 1.5);
  freeze(g);
  near(g.api.damage(s, 10, 'fire', null, {}), 0);
  g.api.damage(s, s.maxHp * 0.4, 'storm', null, {});
  run(g, 0.1);
  near(g.api.damage(s, 10, 'storm', null, {}), 0);
  assert.ok(g.api.damage(s, 10, 'fire', null, {}) > 0, '2페이즈에서는 불이 통함');
});

test('이벤트 종류가 데이터에 덮어쓰이지 않는다', () => {
  const g = rich(game());
  build(g, 'ember_archer', 4, 2);
  const e = spawn(g, 'mist_rat', 13.5, 7.5);
  e.tc = 14; e.tr = 7;
  run(g, 0.1);
  const types = new Set();
  for (let i = 0; i < 60; i++) { g.step(); g.state.events.forEach((x) => types.add(x.type)); }
  assert.ok(types.has('leak'), `leak 이벤트가 있어야 함: ${[...types].join(',')}`);
  const s2 = spawn(g, 'ash_boar', 5.5, 1.5);
  g.api.damage(s2, 1e6, 'fire', null, {});
  assert.ok(g.state.events.some((x) => x.type === 'kill' && x.enemyType === 'ash_boar'));
});

test('명령으로 생긴 이벤트는 다음 틱에서도 보인다', () => {
  const g = game();
  g.step();
  g.cmd({ type: 'callWave' });
  g.step();
  assert.ok(g.state.events.some((x) => x.type === 'waveStart'));
  g.step();
  assert.ok(!g.state.events.some((x) => x.type === 'waveStart'), '한 번만');
});

test('무한 모드: 웨이브가 끝없이 만들어지고 갈수록 단단해진다', () => {
  const g = RG.sim.create({ mapId: 'E1', mode: 'endless', seed: 5, heroId: null });
  assert.strictEqual(g.state.wave.total, Infinity);
  g.state.gold = 1e6;
  for (const [c, r] of [[3, 2], [5, 2], [7, 2], [9, 2], [11, 2], [3, 6], [5, 6], [7, 6], [9, 6], [11, 6]]) g.cmd({ type: 'build', tower: 'ember_archer', c, r });
  g.cmd({ type: 'callWave' });
  let maxHp1 = 0;
  let maxHpLate = 0;
  for (let i = 0; i < 30 * 400 && !g.state.result; i++) {
    g.step();
    if (g.state.wave.countdown !== null) g.cmd({ type: 'callWave' });
    for (const e of g.state.enemies) {
      const ratio = e.maxHp / RG.data.enemies[e.type].hp;
      if (g.state.wave.index <= 2) maxHp1 = Math.max(maxHp1, ratio); else maxHpLate = Math.max(maxHpLate, ratio);
    }
  }
  assert.ok(g.state.wave.index >= 5, `웨이브 ${g.state.wave.index}`);
  assert.ok(maxHpLate > maxHp1, '뒤 웨이브일수록 체력 배율이 커야 함');
});

test('모든 맵이 무작위 시드로 30초 동안 오류 없이 돈다 (영웅 6명 돌아가며)', () => {
  const heroes = RG.data.heroOrder;
  RG.data.maps.concat(RG.data.endless).forEach((m, i) => {
    const g = RG.sim.create({ mapId: m.id, seed: 100 + i, heroId: heroes[i % heroes.length], mode: m.waves ? 'normal' : 'endless' });
    g.state.gold = 5000;
    let n = 0;
    for (let r = 0; r < g.map.rows && n < 6; r++) for (let c = 0; c < g.map.cols && n < 6; c++) if (g.cmd({ type: 'build', tower: RG.data.towerOrder[(n * 5) % 18], c, r }).ok) n++;
    g.cmd({ type: 'callWave' });
    for (let k = 0; k < 30 * 30; k++) { g.step(); if (g.state.wave.countdown !== null) g.cmd({ type: 'callWave' }); }
    if (g.state.hero) g.cmd({ type: 'heroSkill', x: g.state.hero.x, y: g.state.hero.y });
    for (let k = 0; k < 30 * 5; k++) g.step();
    assert.ok(isFinite(g.state.gold));
  });
});

test('맵 난이도 계수와 초반 몸풀기(ramp)가 적 체력에 곱해진다', () => {
  const D = RG.data;
  const def = D.maps.find((m) => m.ramp);
  assert.ok(def, 'ramp 있는 맵');
  const g = RG.sim.create({ mapId: def.id, seed: 1, heroId: null });
  g.cmd({ type: 'callWave' });
  let e = null;
  for (let i = 0; i < 30 * 20 && !e; i++) { g.step(); e = g.state.enemies[0]; }
  assert.ok(e, '첫 적이 나옴');
  const first = RG.grid.parseWaves(def.waves)[0].groups[0].e;
  const want = D.enemies[first].hp * (def.hpMult || 1) * def.ramp[0];
  assert.ok(Math.abs(e.maxHp - want) < 1e-6, `${e.maxHp} vs ${want}`);
});
