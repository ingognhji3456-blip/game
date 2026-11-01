'use strict';

/* =========================================================
 * 전체 런 시뮬레이터 — 간단한 봇으로 수백 판을 돌려 밸런스와 오류를 점검합니다.
 *   node tests/sim.js --runs 200 --seed 1
 * ========================================================= */
const { loadGame } = require('./load');

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? Number(args[i + 1]) : def;
};
const RUNS = opt('runs', 200);
const SEED = opt('seed', 1);
const VERBOSE = args.includes('--verbose');

const { CB, warnings } = loadGame();
const C = CB.combat;
const R = CB.run;

const errors = [];
function assert(cond, msg) { if (!cond) errors.push(msg); }

/* ---------------- 전투 봇 ---------------- */
function incomingDamage(battle) {
  let total = 0;
  for (const e of C.livingEnemies(battle)) {
    const iv = C.intentView(battle, e.uid);
    if (iv && iv.damage) total += iv.damage * Math.max(1, iv.times);
  }
  return total;
}

function scoreCard(battle, inst, target) {
  const def = C.cardDef(inst);
  if (def.unplayable) return -1;
  const p = battle.player;
  const incoming = incomingDamage(battle);
  const needBlock = Math.max(0, incoming - p.block);
  let score = 0;
  for (const e of def.effects) {
    switch (e.type) {
      case 'damage': {
        const per = C.attackDamage(p, target, e.value + (e.bonusPer ? battle.counters.cardsPlayedThisTurn * e.bonusPer.value : 0));
        const hits = e.times || 1;
        const n = e.target === 'allEnemies' ? C.livingEnemies(battle).length : 1;
        let dmg = per * hits * n;
        if (target && dmg >= target.hp + target.block) dmg += 10;
        score += dmg;
        break;
      }
      case 'damageFromBlock': score += p.block; break;
      case 'block': {
        const b = e.value + (p.statuses.dexterity || 0);
        score += Math.min(b, needBlock) * 1.3 + b * 0.15;
        break;
      }
      case 'applyStatus':
        if (e.target === 'self') score += battle.turn <= 3 ? 9 : 4;
        else score += e.status === 'poison' ? e.value * 1.5 : 5;
        break;
      case 'multiplyStatus': score += target && target.statuses.poison ? target.statuses.poison * 2 : 0; break;
      case 'draw': score += e.value * 3; break;
      case 'energy': score += e.value * 5; break;
      case 'heal': score += p.hp < p.maxHp * 0.6 ? e.value : 1; break;
      case 'loseHp': score -= e.value; break;
      case 'multiplyBlock': score += Math.min(p.block, needBlock); break;
      case 'removeDebuffs': score += 2; break;
      case 'upgradeHand': score += battle.hand.length; break;
      default: break;
    }
  }
  if (def.type === 'power') score += battle.turn <= 2 ? 10 : 3;
  return score;
}

function botPlayTurn(battle) {
  let safety = 0;
  while (battle.phase === 'player' && safety++ < 40) {
    const enemies = C.livingEnemies(battle);
    if (!enemies.length) return;
    const target = enemies.slice().sort((a, b) => (a.hp + a.block) - (b.hp + b.block))[0];
    let best = null;
    battle.hand.forEach((inst, i) => {
      if (!C.canPlay(battle, i).ok) return;
      const def = C.cardDef(inst);
      const s = scoreCard(battle, inst, target) / Math.max(0.6, def.cost);
      if (s > 0 && (!best || s > best.s)) best = { i, s };
    });
    // 물약: 위험하거나 정예/보스 첫 턴
    const slot = battle.run.potions.findIndex((p) => p);
    if (slot >= 0 && (battle.player.hp < battle.player.maxHp * 0.35 || (battle.kind !== 'normal' && battle.turn === 1))) {
      C.usePotion(battle, slot, target.uid);
      continue;
    }
    if (!best) return;
    const ev = C.playCard(battle, best.i, target.uid);
    if (ev[0] && ev[0].type === 'error') return;
  }
}

function fight(run, enemies, kind, log) {
  const battle = C.createBattle(run, enemies, kind);
  C.startBattle(battle);
  let turns = 0;
  while (!C.result(battle) && turns < 80) {
    botPlayTurn(battle);
    if (C.result(battle)) break;
    C.endTurn(battle);
    turns++;
    const p = battle.player;
    assert(Number.isFinite(p.hp) && p.hp >= 0 && p.hp <= p.maxHp, `player hp out of range ${p.hp}/${p.maxHp}`);
    for (const e of battle.enemies) assert(Number.isFinite(e.hp) && e.hp >= 0 && e.hp <= e.maxHp, `enemy hp ${e.id} ${e.hp}`);
    assert(Number.isFinite(battle.energy), 'energy NaN');
  }
  assert(turns < 60, `battle too long: ${enemies.join('+')} ${turns} turns`);
  const deckIds = new Set(run.deck.map((c) => c.uid));
  const piles = [...battle.drawPile, ...battle.hand, ...battle.discardPile, ...battle.exhaustPile, ...battle.powersPlayed];
  for (const uid of deckIds) assert(piles.some((c) => c.uid === uid), `card lost ${uid}`);
  C.finishBattle(battle);
  log.turns.push(battle.turn);
  return C.result(battle) || 'lost';
}

/* ---------------- 런 봇 ---------------- */
function pickCard(run, ids) {
  if (run.deck.length > 26) return null;
  const rank = { rare: 3, uncommon: 2, common: 1 };
  const sorted = ids.slice().sort((a, b) => rank[CB.data.cards[b].rarity] - rank[CB.data.cards[a].rarity]);
  return sorted[0];
}

function handleFollowUps(run, followUps, log) {
  for (const f of followUps || []) {
    if (f.type === 'removeCard') {
      for (let i = 0; i < f.count; i++) {
        const c = run.deck.find((x) => ['curse', 'status'].includes(CB.data.cards[x.id].type))
          || run.deck.find((x) => x.id === 'guard') || run.deck.find((x) => x.id === 'slash');
        if (c) R.removeCard(run, c.uid);
      }
    } else if (f.type === 'upgradeCard') {
      for (let i = 0; i < f.count; i++) {
        const c = run.deck.find((x) => R.canUpgrade(x));
        if (c) R.upgradeCard(run, c.uid);
      }
    } else if (f.type === 'combat') {
      const res = fight(run, f.enemies, f.kind, log);
      if (res === 'lost') return 'lost';
      const rw = R.rewards(run, f.kind);
      R.addGold(run, rw.gold);
    }
  }
  return 'ok';
}

function simulateRun(seed) {
  const run = R.newRun({ seed });
  const log = { turns: [], death: null };
  let steps = 0;
  while (!run.over && steps++ < 200) {
    const nodes = R.availableNodes(run);
    assert(nodes.length > 0, `no available nodes act ${run.act} floor ${run.floor}`);
    if (!nodes.length) break;
    const p = run.player;
    const prefer = (types) => nodes.find((n) => types.includes(n.type));
    let node;
    if (p.hp < p.maxHp * 0.5) node = prefer(['rest', 'shop', 'event', 'treasure']);
    else if (p.hp > p.maxHp * 0.75) node = prefer(['elite', 'treasure']);
    if (!node && p.gold > 150) node = prefer(['shop']);
    if (!node) node = nodes[Math.floor(R.rng(run)() * nodes.length)];

    const data = R.enterNode(run, node.id);
    assert(!!data, `enterNode failed ${node.id}`);
    if (!data) break;
    if (['combat', 'elite', 'boss'].includes(data.type)) {
      const res = fight(run, data.enemies, data.kind, log);
      if (res === 'lost') {
        log.death = `${run.act}:${data.enemies.join('+')}`;
        run.over = true;
        break;
      }
      const rw = R.rewards(run, data.kind);
      R.addGold(run, rw.gold);
      if (rw.potion) R.addPotion(run, rw.potion);
      if (rw.relic) handleFollowUps(run, R.addRelic(run, rw.relic).followUps, log);
      if (rw.relicChoices.length) handleFollowUps(run, R.addRelic(run, rw.relicChoices[0]).followUps, log);
      const card = pickCard(run, rw.cards);
      if (card) R.addCard(run, card);
    } else if (data.type === 'shop') {
      const shop = data.shop;
      const removable = run.deck.find((x) => ['curse'].includes(CB.data.cards[x.id].type)) || run.deck.find((x) => x.id === 'guard');
      if (removable && p.gold >= shop.removeCost) R.shopRemove(run, shop, removable.uid);
      shop.cards.forEach((c, i) => { if (CB.data.cards[c.id].rarity !== 'common' && p.gold >= c.price + 20) R.buy(run, shop, 'cards', i); });
      shop.relics.forEach((c, i) => { if (p.gold >= c.price) handleFollowUps(run, R.buy(run, shop, 'relics', i).followUps, log); });
    } else if (data.type === 'rest') {
      if (p.hp < p.maxHp * 0.65 && !R.modifier(run, 'restHealDisabled')) R.restHeal(run);
      else {
        const c = run.deck.find((x) => R.canUpgrade(x) && CB.data.cards[x.id].rarity !== 'starter') || run.deck.find((x) => R.canUpgrade(x));
        if (c) R.upgradeCard(run, c.uid);
        else R.restHeal(run);
      }
    } else if (data.type === 'event') {
      const ev = CB.data.events[data.eventId];
      const options = ev.choices.map((c, i) => i).filter((i) => R.canChoose(run, data.eventId, i).ok);
      const choice = options[Math.floor(R.rng(run)() * options.length)];
      const res = R.resolveEvent(run, data.eventId, choice);
      if (handleFollowUps(run, res.followUps, log) === 'lost') {
        log.death = `${run.act}:event`;
        run.over = true;
        break;
      }
    } else if (data.type === 'treasure') {
      if (data.relicId) handleFollowUps(run, R.addRelic(run, data.relicId).followUps, log);
      R.addGold(run, data.gold);
    }
    const done = R.completeNode(run);
    assert(Number.isFinite(run.player.hp) && run.player.hp > 0, `hp after node ${run.player.hp}`);
    if (done.victory) break;
  }
  // 저장 왕복
  CB.save.saveRun(run);
  return { run, log };
}

/* ---------------- 실행 & 통계 ---------------- */
const results = [];
const t0 = Date.now();
for (let i = 0; i < RUNS; i++) {
  try {
    results.push(simulateRun(SEED * 100000 + i));
  } catch (e) {
    errors.push(`exception: ${e.stack}`);
  }
}
const wins = results.filter((r) => r.run.victory).length;
const actReached = [0, 0, 0, 0];
const deaths = {};
const turns = [];
for (const { run, log } of results) {
  actReached[run.act] += 1;
  if (log.death) deaths[log.death] = (deaths[log.death] || 0) + 1;
  turns.push(...log.turns);
}
const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

console.log(`runs: ${results.length}, time ${Date.now() - t0}ms`);
console.log(`win rate: ${((wins / Math.max(1, results.length)) * 100).toFixed(1)}%`);
console.log(`ended in act: 1=${actReached[1]} 2=${actReached[2]} 3=${actReached[3]}`);
console.log(`avg turns/fight: ${avg(turns).toFixed(2)}, max ${Math.max(...turns)}`);
console.log(`avg floors climbed: ${avg(results.map((r) => r.run.stats.floorsClimbed)).toFixed(1)}`);
console.log('top deaths:');
Object.entries(deaths).sort((a, b) => b[1] - a[1]).slice(0, 14).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
const uniqueErrors = [...new Set(errors)];
console.log(`errors: ${uniqueErrors.length}`);
uniqueErrors.slice(0, 15).forEach((e) => console.log('  ' + e));
const uniqueWarnings = [...new Set(warnings)];
console.log(`warnings: ${uniqueWarnings.length}`);
uniqueWarnings.slice(0, 10).forEach((w) => console.log('  ' + w));
if (VERBOSE) console.log(JSON.stringify(results[0].run.stats));
process.exit(uniqueErrors.length ? 1 : 0);
