'use strict';

/* 엔진 & 데이터 검사: node tests/engine.test.js */
const { loadGame } = require('./load');

let failures = 0;
let passes = 0;
function check(name, cond, extra) {
  if (cond) { passes++; return; }
  failures++;
  console.log(`✗ ${name}${extra !== undefined ? ` — ${JSON.stringify(extra)}` : ''}`);
}

const { CB, warnings } = loadGame();
const D = CB.data;

/* ---------------- 데이터 참조 검사 ---------------- */
const EFFECTS = new Set(['damage', 'damageFromBlock', 'block', 'heal', 'healPct', 'loseHp', 'applyStatus', 'multiplyStatus',
  'removeDebuffs', 'multiplyBlock', 'draw', 'energy', 'addCard', 'upgradeHand', 'summon', 'gainGold']);
const RUN_EFFECTS = new Set(['gainGold', 'loseGold', 'heal', 'healPct', 'loseHp', 'gainMaxHp', 'loseMaxHp', 'addCard',
  'addRandomCard', 'addCurse', 'removeCard', 'upgradeCard', 'upgradeRandom', 'gainRelic', 'gainPotion', 'maxEnergy',
  'potionSlots', 'combat']);
const TARGETS = new Set(['self', 'enemy', 'allEnemies', 'randomEnemy', 'allAllies']);
const STATUSES = ['strength', 'dexterity', 'weak', 'vulnerable', 'frail', 'poison', 'regen', 'thorns', 'plating', 'fervor',
  'fortress', 'ward', 'insight', 'surge', 'toxicAura', 'enrage', 'nextTurnBlock', 'nextTurnEnergy', 'nextTurnDraw'];
const ICONS = 'slash doubleSlash heavyBlow whirlwind thrust dagger axe shield tower shieldBash armor fist fire poison venomBlade skull heart bolt eye muscle feather thorns spiral crack blood star moon wind curse wound'.split(' ');
const ROSTER = 'slime sporeling wolf bandit beetle ogre treant golem skeleton wraith zealot gargoyle bat fallenKnight bogWitch lichKing imp salamander shade sentinel abyssDemon elderDragon'.split(' ');
const SCENES = 'shrine forest crypt lava chest stranger well altar'.split(' ');
const TRIGGERS = new Set(['battleStart', 'turnStart', 'turnEnd', 'cardPlayed', 'enemyKilled', 'battleEnd', 'playerHurt', 'shuffle']);
const MODIFIERS = new Set(['maxEnergy', 'handSize', 'restHealBonusPct', 'restHealDisabled', 'shopDiscountPct', 'goldMultiplier', 'cardChoices', 'potionChanceBonus', 'potionSlots']);

function checkEffects(where, effects) {
  for (const e of effects || []) {
    check(`${where}: effect type ${e.type}`, EFFECTS.has(e.type));
    if (e.target) check(`${where}: target ${e.target}`, TARGETS.has(e.target));
    if (e.type === 'applyStatus' || e.type === 'multiplyStatus') {
      check(`${where}: status ${e.status}`, STATUSES.includes(e.status));
      check(`${where}: status target required`, !!e.target);
    }
    if (e.type === 'addCard') check(`${where}: addCard ${e.card}`, !!D.cards[e.card]);
    if (e.type === 'summon') check(`${where}: summon ${e.enemy}`, !!D.enemies[e.enemy]);
    if (['damage', 'block', 'heal', 'loseHp', 'draw', 'energy', 'gainGold'].includes(e.type)) {
      check(`${where}: numeric value`, typeof e.value === 'number' && !Number.isNaN(e.value));
    }
  }
}

for (const s of STATUSES) check(`keyword ${s}`, !!D.keywords[s]);
for (const k of ['exhaust', 'ethereal', 'retain', 'innate', 'unplayable', 'block']) check(`keyword ${k}`, !!D.keywords[k]);

for (const [id, c] of Object.entries(D.cards)) {
  check(`card ${id} art`, ICONS.includes(c.art), c.art);
  check(`card ${id} type`, ['attack', 'skill', 'power', 'status', 'curse'].includes(c.type));
  check(`card ${id} target`, ['enemy', 'allEnemies', 'self', 'none'].includes(c.target));
  checkEffects(`card ${id}`, c.effects);
  checkEffects(`card ${id} onTurnEnd`, c.onTurnEndInHand);
  if (!['status', 'curse'].includes(c.type)) {
    check(`card ${id} upgrade`, !!c.upgrade);
    if (c.upgrade && c.upgrade.effects) checkEffects(`card ${id}+`, c.upgrade.effects);
  }
}
for (const id of D.starter.deck) check(`starter card ${id}`, !!D.cards[id]);
check('starter relic', !!D.relics[D.starter.relic]);

for (const id of ROSTER) check(`enemy ${id} exists`, !!D.enemies[id]);
for (const [id, e] of Object.entries(D.enemies)) {
  for (const [mid, m] of Object.entries(e.moves)) checkEffects(`enemy ${id}.${mid}`, m.effects);
  const patterns = [e.pattern, e.phase2 && e.phase2.pattern].filter(Boolean);
  for (const p of patterns) {
    const ids = [...(p.order || []), ...Object.keys(p.weights || {}), ...(p.opening || [])];
    for (const mid of ids) check(`enemy ${id} pattern move ${mid}`, !!e.moves[mid]);
  }
  if (e.phase2) checkEffects(`enemy ${id} phase2`, e.phase2.onEnter);
  for (const ps of e.passives || []) check(`enemy ${id} passive`, STATUSES.includes(ps.status));
}
for (const [act, enc] of Object.entries(D.encounters)) {
  for (const kind of ['easy', 'normal', 'elite', 'boss']) {
    check(`encounters ${act}.${kind}`, Array.isArray(enc[kind]) && enc[kind].length > 0);
    for (const group of enc[kind] || []) for (const id of group) check(`encounter enemy ${id}`, !!D.enemies[id]);
  }
}
for (const [id, r] of Object.entries(D.relics)) {
  for (const t of r.triggers || []) {
    check(`relic ${id} trigger ${t.on}`, TRIGGERS.has(t.on));
    checkEffects(`relic ${id}`, t.effects);
  }
  for (const m of Object.keys(r.modifiers || {})) check(`relic ${id} modifier ${m}`, MODIFIERS.has(m));
  for (const e of r.onPickup || []) check(`relic ${id} pickup ${e.type}`, RUN_EFFECTS.has(e.type));
}
check('exactly one starter relic', Object.values(D.relics).filter((r) => r.rarity === 'starter').length === 1);
for (const [id, p] of Object.entries(D.potions)) {
  checkEffects(`potion ${id}`, p.effects);
  check(`potion ${id} target`, ['enemy', 'allEnemies', 'self', 'none'].includes(p.target));
}
for (const [id, ev] of Object.entries(D.events)) {
  check(`event ${id} scene`, SCENES.includes(ev.scene));
  for (const ch of ev.choices) {
    for (const o of ch.outcomes) {
      for (const e of o.effects) {
        check(`event ${id} effect ${e.type}`, RUN_EFFECTS.has(e.type));
        if (e.type === 'addCurse' || e.type === 'addCard') check(`event ${id} card ${e.card}`, !!D.cards[e.card]);
        if (e.type === 'combat') for (const en of e.enemies) check(`event ${id} enemy ${en}`, !!D.enemies[en]);
      }
    }
  }
}

/* ---------------- 엔진 동작 검사 ---------------- */
function testBattle(enemyIds, setup) {
  const run = CB.run.newRun({ seed: 42 });
  if (setup) setup(run);
  const battle = CB.combat.createBattle(run, enemyIds, 'normal');
  CB.combat.startBattle(battle);
  return { run, battle };
}
function giveHand(battle, ids) {
  battle.hand = ids.map((id) => ({ uid: CB.util.nextId('t'), id, upgraded: false }));
  battle.energy = 99;
}

{ // 기본 피해 & 힘 & 약화 & 취약
  const { battle } = testBattle(['golem']);
  const golem = battle.enemies[0];
  giveHand(battle, ['slash']);
  battle.player.statuses.strength = 2;
  CB.combat.playCard(battle, 0, golem.uid);
  check('slash with strength 2 = 8', golem.maxHp - golem.hp === 8, golem.maxHp - golem.hp);
  const hp = golem.hp;
  golem.statuses.vulnerable = 1;
  battle.player.statuses.weak = 1;
  giveHand(battle, ['slash']);
  CB.combat.playCard(battle, 0, golem.uid);
  check('slash (6+2)*0.75*1.5 = 9', hp - golem.hp === 9, hp - golem.hp);
}
{ // 방어도 & 민첩 & 허약
  const { battle } = testBattle(['golem']);
  giveHand(battle, ['guard']);
  battle.player.statuses.dexterity = 2;
  battle.player.statuses.frail = 1;
  CB.combat.playCard(battle, 0);
  check('guard (5+2)*0.75 = 5', battle.player.block === 5, battle.player.block);
}
{ // 결계가 디버프를 막음
  const { battle } = testBattle(['golem']);
  const g = battle.enemies[0];
  g.statuses.ward = 1;
  giveHand(battle, ['crushingBlow']);
  CB.combat.playCard(battle, 0, g.uid);
  check('ward negates vulnerable', !g.statuses.vulnerable && !g.statuses.ward);
}
{ // 가시
  const { battle } = testBattle(['beetle']);
  const b = battle.enemies[0];
  const hp = battle.player.hp;
  giveHand(battle, ['twinFang']);
  CB.combat.playCard(battle, 0, b.uid);
  check('thorns 2 per hit ×2', hp - battle.player.hp === 4, hp - battle.player.hp);
}
{ // 연타 보너스
  const { battle } = testBattle(['golem']);
  const g = battle.enemies[0];
  giveHand(battle, ['lunge', 'lunge', 'flurry']);
  const run = battle.run;
  CB.combat.playCard(battle, 0, g.uid);
  CB.combat.playCard(battle, 0, g.uid);
  const hp = g.hp;
  const idx = battle.hand.findIndex((c) => c.id === 'flurry');
  CB.combat.playCard(battle, idx, g.uid);
  check('flurry 3 + 3 cards ×2 = 9', hp - g.hp === 9, { lost: hp - g.hp, run: !!run });
}
{ // 독 틱 & 감소
  const { battle } = testBattle(['golem']);
  const g = battle.enemies[0];
  g.statuses.poison = 5;
  const hp = g.hp;
  battle.hand = [];
  CB.combat.endTurn(battle);
  check('poison ticks 5', hp - g.hp >= 5);
  check('poison decays to 4', g.statuses.poison === 4, g.statuses.poison);
}
{ // 약화 지속 시간: 적이 부여한 약화 2 → 플레이어 턴 2번
  const { battle } = testBattle(['golem']);
  battle.player.statuses.weak = 2;
  battle.hand = [];
  CB.combat.endTurn(battle);
  check('weak decays at end of player turn', battle.player.statuses.weak === 1, battle.player.statuses.weak);
}
{ // 2페이즈
  const { battle } = testBattle(['golem']);
  const g = battle.enemies[0];
  giveHand(battle, ['executioner', 'executioner', 'executioner']);
  const ev = [];
  for (let i = 0; i < 3; i++) ev.push(...CB.combat.playCard(battle, 0, g.uid));
  check('golem phase2 triggers', g.phase2 === true && ev.filter((e) => e.type === 'phaseShift').length === 1, g.hp);
}
{ // 소환 상한
  const { battle } = testBattle(['lichKing']);
  for (let i = 0; i < 8; i++) {
    battle.hand = [];
    CB.combat.endTurn(battle);
    battle.player.hp = battle.player.maxHp;
    if (CB.combat.result(battle)) break;
  }
  check('summon cap 4', CB.combat.livingEnemies(battle).length <= 4, CB.combat.livingEnemies(battle).length);
}
{ // 보스 사망 시 소환수도 사망
  const { battle } = testBattle(['lichKing']);
  battle.hand = [];
  CB.combat.endTurn(battle); // raise
  battle.player.hp = battle.player.maxHp;
  const lich = battle.enemies[0];
  lich.hp = 1; lich.block = 0; lich.statuses = {};
  giveHand(battle, ['slash']);
  CB.combat.playCard(battle, 0, lich.uid);
  check('minions die with boss → won', CB.combat.result(battle) === 'won', CB.combat.livingEnemies(battle).map((e) => e.id));
}
{ // 보존/휘발
  const { battle } = testBattle(['golem']);
  battle.hand = [
    { uid: 'x1', id: 'lastStand', upgraded: false },
    { uid: 'x2', id: 'dazed', upgraded: false },
    { uid: 'x3', id: 'slash', upgraded: false },
  ];
  CB.combat.endTurn(battle);
  check('retain keeps card', battle.hand.some((c) => c.uid === 'x1'));
  check('ethereal exhausts', battle.exhaustPile.some((c) => c.uid === 'x2'));
}
{ // 화상
  const { battle } = testBattle(['golem']);
  battle.hand = [{ uid: 'b1', id: 'burn', upgraded: false }];
  const hp = battle.player.hp;
  battle.player.block = 100;
  const ev = CB.combat.endTurn(battle);
  check('burn loses 2 hp through block', ev.some((e) => e.type === 'hpLoss' && e.reason === 'self' && e.amount === 2), hp);
}
{ // 카드 보존 (덱 순환)
  const { battle, run } = testBattle(['golem']);
  for (let t = 0; t < 6; t++) {
    battle.hand = battle.hand.slice();
    CB.combat.endTurn(battle);
    battle.player.hp = battle.player.maxHp;
  }
  const total = battle.drawPile.length + battle.hand.length + battle.discardPile.length + battle.exhaustPile.length;
  check('cards conserved', total >= run.deck.length, total);
}
{ // 유물 every/scope
  const { battle } = testBattle(['golem'], (run) => CB.run.addRelic(run, 'bronzeBell'));
  giveHand(battle, ['slash', 'slash', 'slash']);
  battle.energy = 3;
  const g = battle.enemies[0];
  CB.combat.playCard(battle, 0, g.uid);
  CB.combat.playCard(battle, 0, g.uid);
  CB.combat.playCard(battle, 0, g.uid);
  check('bronze bell gives energy on 3rd attack', battle.energy === 1, battle.energy);
}
{ // 물약
  const { battle, run } = testBattle(['golem']);
  run.potions[0] = 'firePotion';
  battle.player.statuses.strength = 5;
  const g = battle.enemies[0];
  const hp = g.hp;
  CB.combat.usePotion(battle, 0, g.uid);
  check('fire potion 20 (no strength)', hp - g.hp === 20, hp - g.hp);
  check('potion removed', run.potions[0] === null);
}
{ // 지도 제약
  for (let seed = 1; seed <= 30; seed++) {
    const run = CB.run.newRun({ seed });
    const map = run.map;
    check(`map ${seed} rows`, map.rows.length === 9);
    check(`map ${seed} row0 combat`, map.rows[0].every((n) => n.type === 'combat'));
    check(`map ${seed} row4 treasure`, map.rows[4].every((n) => n.type === 'treasure'));
    check(`map ${seed} row8 rest`, map.rows[8].every((n) => n.type === 'rest'));
    check(`map ${seed} early safe`, map.rows.slice(0, 3).flat().every((n) => n.type !== 'elite' && n.type !== 'rest'));
    check(`map ${seed} reachable`, map.rows.slice(0, 8).flat().every((n) => n.next.length > 0));
    check(`map ${seed} has shop`, map.rows.flat().some((n) => n.type === 'shop'));
  }
}
{ // 저장 왕복
  const run = CB.run.newRun({ seed: 7 });
  CB.save.saveRun(run);
  const loaded = CB.save.loadRun();
  check('save roundtrip', loaded && loaded.seed === 7 && loaded.deck.length === run.deck.length);
}
{ // 카드 설명 생성
  for (const id of Object.keys(D.cards)) {
    const v = CB.combat.cardView({ uid: 'v', id, upgraded: false });
    check(`desc ${id}`, typeof v.descHTML === 'string' && v.descHTML.length > 0 && !v.descHTML.includes('undefined'), v.descHTML);
    if (D.cards[id].upgrade) {
      const u = CB.combat.cardView({ uid: 'v', id, upgraded: true });
      check(`desc ${id}+`, !u.descHTML.includes('undefined') && u.name.endsWith('+'));
    }
  }
}

check('no engine warnings', warnings.length === 0, warnings.slice(0, 5));

console.log(`\n${passes} passed, ${failures} failed`);
if (process.argv.includes('--desc')) {
  for (const id of Object.keys(D.cards)) {
    const v = CB.combat.cardView({ uid: 'v', id, upgraded: false });
    console.log(`${v.name}: ${v.descHTML.replace(/<[^>]+>/g, '')}`);
  }
}
process.exit(failures ? 1 : 0);
