'use strict';

/* =========================================================
 * 전투 엔진 — DOM 을 건드리지 않는 순수 로직.
 * 상태를 바꾸는 함수는 모두 "이벤트 배열"을 반환하고, UI 가 이를 순서대로 연출합니다.
 * ========================================================= */
CB.combat = (() => {
  const U = CB.util;
  const MAX_HAND = 10;
  const MAX_ENEMIES = 4;
  const DEBUFFS = ['weak', 'vulnerable', 'frail', 'poison'];
  const DECAYING = ['weak', 'vulnerable', 'frail'];
  const NON_NEGATIVE = new Set(['weak', 'vulnerable', 'frail', 'poison', 'regen', 'thorns', 'plating', 'fervor', 'fortress', 'ward', 'insight', 'surge', 'toxicAura', 'enrage', 'nextTurnBlock', 'nextTurnEnergy', 'nextTurnDraw']);

  /* ---------------- RNG (런에 묶인 시드 난수) ---------------- */
  function rngOf(run) {
    if (!run) return U.makeRng(U.randomSeed());
    if (!run._rng) {
      const rng = U.makeRng(run.rngState >>> 0);
      Object.defineProperty(run, '_rng', { value: rng, enumerable: false, writable: true, configurable: true });
    }
    return run._rng;
  }
  const rngB = (battle) => rngOf(battle.run);

  /* ---------------- 정의 조회 ---------------- */
  function cardDef(idOrInst, upgraded) {
    const id = typeof idOrInst === 'string' ? idOrInst : idOrInst && idOrInst.id;
    const up = typeof idOrInst === 'string' ? !!upgraded : !!(idOrInst && idOrInst.upgraded);
    const base = CB.data.cards[id];
    if (!base) {
      return { id, name: `?${id}`, type: 'status', rarity: 'status', cost: 0, target: 'none', art: 'wound', effects: [], unplayable: true, missing: true };
    }
    if (!up || !base.upgrade) return { ...base, upgraded: false };
    return { ...base, ...base.upgrade, upgrade: base.upgrade, upgraded: true, name: `${base.name}+` };
  }

  function canUpgradeInst(inst) {
    const def = CB.data.cards[inst.id];
    return !!(def && def.upgrade && !inst.upgraded);
  }

  const enemyDef = (id) => CB.data.enemies[id];
  const relicDef = (id) => CB.data.relics[id];
  const potionDef = (id) => CB.data.potions[id];
  const kw = (id) => (CB.data.keywords && CB.data.keywords[id]) || { name: id, icon: '❔', kind: 'keyword', desc: '' };

  /* ---------------- 유닛 ---------------- */
  function getUnit(battle, uid) {
    if (!uid) return null;
    if (uid === 'player') return battle.player;
    return battle.enemies.find((e) => e.uid === uid) || null;
  }
  const livingEnemies = (battle) => battle.enemies.filter((e) => e.alive);
  const opponents = (battle, unit) => (unit.side === 'player'
    ? livingEnemies(battle)
    : (battle.player.alive ? [battle.player] : []));
  const allies = (battle, unit) => (unit.side === 'player' ? [battle.player] : livingEnemies(battle));
  const isOver = (battle) => battle.phase === 'won' || battle.phase === 'lost';
  const st = (unit, id) => unit.statuses[id] || 0;

  function makeEnemyUnit(battle, id, summoned = false) {
    const def = enemyDef(id);
    if (!def) return null;
    const rng = rngB(battle);
    const [lo, hi] = Array.isArray(def.hp) ? def.hp : [def.hp, def.hp];
    const hp = rng.int(lo, hi == null ? lo : hi);
    battle.enemySeq += 1;
    return {
      uid: `e${battle.enemySeq}`, side: 'enemy', id, name: def.name, hp, maxHp: hp, block: 0,
      statuses: {}, alive: true, rank: def.rank || 'normal', art: def.art || id, size: def.size || 'medium',
      summoned, phase2: false, ai: { opening: 0, cycle: 0, last: null, repeat: 0 },
    };
  }

  /* ---------------- 전투 생성 ---------------- */
  function createBattle(run, enemyIds, kind = 'normal') {
    const p = run.player;
    const battle = {
      run, kind, turn: 0, phase: 'start', enemySeq: 0,
      player: {
        uid: 'player', side: 'player', id: 'hero', name: '방랑 검사', hp: p.hp, maxHp: p.maxHp, block: 0,
        statuses: {}, alive: true, rank: 'hero', art: 'hero', size: 'medium',
      },
      enemies: [],
      energy: 0,
      maxEnergy: p.maxEnergy,
      drawPile: [], hand: [], discardPile: [], exhaustPile: [], powersPlayed: [],
      counters: { cardsPlayedThisTurn: 0, cardsPlayedThisBattle: 0, attacksThisTurn: 0, skillsThisTurn: 0 },
      relicCounters: {}, relicTurnCounters: {},
      intents: {},
      stats: { damageDealt: 0, damageTaken: 0, cardsPlayed: 0 },
      finished: false,
    };
    for (const id of enemyIds) {
      const unit = makeEnemyUnit(battle, id);
      if (unit) battle.enemies.push(unit);
      else console.warn('알 수 없는 적:', id);
    }
    // 덱 복사본을 섞고, 선천 카드를 맨 위로
    const rng = rngOf(run);
    const pile = rng.shuffle(run.deck.map((c) => ({ ...c })));
    const innate = pile.filter((c) => cardDef(c).innate);
    const rest = pile.filter((c) => !cardDef(c).innate);
    battle.drawPile = rest.concat(innate); // 맨 끝이 맨 위
    for (const enemy of battle.enemies) chooseIntent(battle, enemy, []);
    return battle;
  }

  /* ---------------- 적 의도(AI) ---------------- */
  function moveUsable(battle, move) {
    if (!move) return false;
    if (move.effects.some((e) => e.type === 'summon')) return livingEnemies(battle).length < MAX_ENEMIES;
    return true;
  }

  function chooseIntent(battle, enemy, ev) {
    const def = enemyDef(enemy.id);
    if (!def || !enemy.alive) return;
    const pattern = (enemy.phase2 && def.phase2 && def.phase2.pattern) || def.pattern || { type: 'cycle', order: Object.keys(def.moves) };
    const ai = enemy.ai;
    const valid = (id) => moveUsable(battle, def.moves[id]);
    let moveId = null;

    while (!moveId && pattern.opening && ai.opening < pattern.opening.length) {
      const id = pattern.opening[ai.opening++];
      if (valid(id)) moveId = id;
    }
    if (!moveId && pattern.type === 'cycle') {
      const order = pattern.order || [];
      for (let i = 0; i < order.length && !moveId; i++) {
        const id = order[ai.cycle % order.length];
        ai.cycle++;
        if (valid(id)) moveId = id;
      }
    }
    if (!moveId && pattern.type !== 'cycle') {
      const maxRepeat = pattern.maxRepeat || 99;
      const weights = Object.entries(pattern.weights || {})
        .filter(([id]) => valid(id) && !(id === ai.last && ai.repeat >= maxRepeat));
      if (weights.length) moveId = rngB(battle).weighted(weights);
    }
    if (!moveId) moveId = Object.keys(def.moves).find(valid) || Object.keys(def.moves)[0];

    ai.repeat = moveId === ai.last ? ai.repeat + 1 : 1;
    ai.last = moveId;
    battle.intents[enemy.uid] = moveId;
    ev.push({ type: 'intent', uid: enemy.uid, moveId });
  }

  /* ---------------- 수치 계산 ---------------- */
  function bonusValue(battle, source, target, bonusPer) {
    if (!bonusPer) return 0;
    let stat = 0;
    switch (bonusPer.stat) {
      case 'cardsPlayedThisTurn': stat = battle.counters.cardsPlayedThisTurn; break;
      case 'block': stat = source.block; break;
      case 'targetPoison': stat = target ? st(target, 'poison') : 0; break;
      case 'exhaustCount': stat = battle.exhaustPile.length; break;
      case 'handSize': stat = battle.hand.length; break;
      default: stat = 0;
    }
    return stat * (bonusPer.value || 0);
  }

  function attackDamage(source, target, base, raw = false) {
    let dmg = base;
    if (!raw) {
      dmg += st(source, 'strength');
      if (st(source, 'weak') > 0) dmg *= 0.75;
    }
    if (target && st(target, 'vulnerable') > 0) dmg *= 1.5;
    return Math.max(0, Math.floor(dmg));
  }

  function blockAmount(unit, base, modified) {
    let value = base;
    if (modified) {
      value += st(unit, 'dexterity');
      if (st(unit, 'frail') > 0) value *= 0.75;
    }
    return Math.max(0, Math.floor(value));
  }

  /* ---------------- 기본 동작 ---------------- */
  function checkEnd(battle, ev) {
    if (isOver(battle)) return true;
    if (!battle.player.alive || battle.player.hp <= 0) {
      battle.phase = 'lost';
      ev.push({ type: 'battleEnd', result: 'lost' });
      return true;
    }
    if (livingEnemies(battle).length === 0) {
      battle.phase = 'won';
      ev.push({ type: 'battleEnd', result: 'won' });
      return true;
    }
    return false;
  }

  function kill(battle, unit, ev) {
    if (!unit.alive) return;
    unit.alive = false;
    unit.hp = 0;
    unit.block = 0;
    ev.push({ type: 'death', uid: unit.uid });
    if (unit.side === 'enemy') {
      if (battle.run.stats) battle.run.stats.enemiesKilled = (battle.run.stats.enemiesKilled || 0) + 1;
      delete battle.intents[unit.uid];
      if (unit.rank === 'boss') {
        for (const minion of livingEnemies(battle).filter((e) => e.summoned)) kill(battle, minion, ev);
      }
      if (!checkEnd(battle, ev)) triggerRelics(battle, 'enemyKilled', ev);
    }
    checkEnd(battle, ev);
  }

  function checkPhase2(battle, unit, ev) {
    if (unit.side !== 'enemy' || !unit.alive || unit.phase2) return;
    const def = enemyDef(unit.id);
    if (!def || !def.phase2) return;
    if (unit.hp > Math.floor(unit.maxHp * def.phase2.hpPct)) return;
    unit.phase2 = true;
    unit.ai = { opening: 0, cycle: 0, last: null, repeat: 0 };
    ev.push({ type: 'phaseShift', uid: unit.uid, text: def.phase2.text || `${unit.name}의 기세가 달라졌다!` });
    runEffects(battle, def.phase2.onEnter || [], { source: unit }, ev);
    if (unit.alive && !isOver(battle)) chooseIntent(battle, unit, ev);
  }

  function loseHp(battle, unit, amount, reason, ev) {
    if (!unit.alive || amount <= 0) return;
    const before = unit.hp;
    unit.hp = Math.max(0, unit.hp - amount);
    const lost = before - unit.hp;
    if (unit.side === 'player') battle.stats.damageTaken += lost;
    else battle.stats.damageDealt += lost;
    ev.push({ type: 'hpLoss', targetUid: unit.uid, amount: lost, hp: unit.hp, reason });
    if (unit.hp <= 0) kill(battle, unit, ev);
    else checkPhase2(battle, unit, ev);
  }

  function dealDamage(battle, source, target, amount, opts, ev) {
    if (!target.alive) return;
    const blocked = Math.min(target.block, amount);
    target.block -= blocked;
    const hpLoss = Math.min(target.hp, amount - blocked);
    target.hp -= hpLoss;
    const killed = target.hp <= 0;
    if (target.side === 'player') battle.stats.damageTaken += hpLoss;
    else battle.stats.damageDealt += hpLoss;
    ev.push({
      type: 'damage', sourceUid: source.uid, targetUid: target.uid, amount, blocked, hpLoss,
      hp: target.hp, block: target.block, isAttack: !!opts.isAttack, killed, heavy: amount >= 15,
    });
    if (killed) kill(battle, target, ev);
    else checkPhase2(battle, target, ev);

    if (target.side === 'player' && hpLoss > 0 && opts.isAttack && !isOver(battle)) {
      triggerRelics(battle, 'playerHurt', ev);
    }
    if (opts.isAttack && source !== target && source.alive && st(target, 'thorns') > 0) {
      loseHp(battle, source, st(target, 'thorns'), 'thorns', ev);
    }
    if (opts.lifesteal && hpLoss > 0 && source.alive) heal(battle, source, hpLoss, ev);
  }

  function gainBlock(battle, unit, base, modified, ev) {
    if (!unit.alive) return;
    const amount = blockAmount(unit, base, modified);
    unit.block += amount;
    ev.push({ type: 'block', targetUid: unit.uid, amount, block: unit.block });
  }

  function clearBlock(unit, ev) {
    if (st(unit, 'fortress') > 0 || unit.block === 0) return;
    unit.block = 0;
    ev.push({ type: 'block', targetUid: unit.uid, amount: 0, block: 0, reset: true });
  }

  function heal(battle, unit, amount, ev) {
    if (!unit.alive) return 0;
    const healed = Math.max(0, Math.min(Math.floor(amount), unit.maxHp - unit.hp));
    if (healed <= 0) return 0;
    unit.hp += healed;
    ev.push({ type: 'heal', targetUid: unit.uid, amount: healed, hp: unit.hp });
    return healed;
  }

  function isDebuff(status, value) {
    return DEBUFFS.includes(status) || ((status === 'strength' || status === 'dexterity') && value < 0);
  }

  function applyStatus(battle, unit, status, value, ev) {
    if (!unit.alive || !value) return;
    if (isDebuff(status, value) && st(unit, 'ward') > 0) {
      unit.statuses.ward -= 1;
      if (unit.statuses.ward <= 0) delete unit.statuses.ward;
      ev.push({ type: 'status', targetUid: unit.uid, status, delta: 0, value: st(unit, status), negated: true });
      ev.push({ type: 'status', targetUid: unit.uid, status: 'ward', delta: -1, value: st(unit, 'ward') });
      return;
    }
    let next = st(unit, status) + value;
    if (NON_NEGATIVE.has(status)) next = Math.max(0, next);
    const delta = next - st(unit, status);
    if (next === 0) delete unit.statuses[status];
    else unit.statuses[status] = next;
    if (delta !== 0) ev.push({ type: 'status', targetUid: unit.uid, status, delta, value: next });
  }

  function setStatus(unit, status, value, ev) {
    const prev = st(unit, status);
    if (value <= 0 && NON_NEGATIVE.has(status)) delete unit.statuses[status];
    else if (value === 0) delete unit.statuses[status];
    else unit.statuses[status] = value;
    if (prev !== value) ev.push({ type: 'status', targetUid: unit.uid, status, delta: value - prev, value: Math.max(0, value) });
  }

  /* ---------------- 카드 더미 ---------------- */
  function drawCards(battle, n, ev) {
    for (let i = 0; i < n; i++) {
      if (isOver(battle)) return;
      if (battle.drawPile.length === 0) {
        if (battle.discardPile.length === 0) return;
        battle.drawPile = rngB(battle).shuffle(battle.discardPile);
        battle.discardPile = [];
        ev.push({ type: 'shuffle', count: battle.drawPile.length });
        triggerRelics(battle, 'shuffle', ev);
        if (battle.drawPile.length === 0) return;
      }
      const card = battle.drawPile.pop();
      if (battle.hand.length >= MAX_HAND) {
        battle.discardPile.push(card);
        ev.push({ type: 'discard', cardUid: card.uid, overflow: true });
      } else {
        battle.hand.push(card);
        ev.push({ type: 'draw', cardUid: card.uid });
      }
    }
  }

  function addCards(battle, cardId, count, to, upgraded, ev) {
    if (!CB.data.cards[cardId]) { console.warn('알 수 없는 카드:', cardId); return; }
    const rng = rngB(battle);
    for (let i = 0; i < count; i++) {
      const inst = { uid: U.nextId('c'), id: cardId, upgraded: !!upgraded, temp: true };
      let dest = to;
      if (dest === 'hand' && battle.hand.length >= MAX_HAND) dest = 'discardPile';
      if (dest === 'hand') battle.hand.push(inst);
      else if (dest === 'drawPile') battle.drawPile.splice(rng.int(0, battle.drawPile.length), 0, inst);
      else { dest = 'discardPile'; battle.discardPile.push(inst); }
      ev.push({ type: 'cardAdded', cardUid: inst.uid, cardId, to: dest });
    }
  }

  /* ---------------- 효과 실행 ---------------- */
  function resolveTargets(battle, source, spec, ctx) {
    switch (spec) {
      case 'self': return source.alive ? [source] : [];
      case 'allEnemies': return opponents(battle, source);
      case 'allAllies': return allies(battle, source);
      case 'randomEnemy': {
        const list = opponents(battle, source);
        return list.length ? [rngB(battle).pick(list)] : [];
      }
      case 'enemy':
      default: {
        if (source.side === 'enemy') return opponents(battle, source);
        let target = ctx.targetUid ? getUnit(battle, ctx.targetUid) : null;
        if (!target || !target.alive || target.side !== 'enemy') {
          const list = livingEnemies(battle);
          target = ctx.targetUid || list.length !== 1 ? (list.length ? rngB(battle).pick(list) : null) : list[0];
          if (target) ctx.targetUid = target.uid;
        }
        return target ? [target] : [];
      }
    }
  }

  const DEFAULT_TARGET = {
    damage: 'enemy', damageFromBlock: 'enemy', block: 'self', heal: 'self', healPct: 'self', loseHp: 'self',
    removeDebuffs: 'self', multiplyBlock: 'self',
  };

  function runEffects(battle, effects, ctx, ev, force = false) {
    for (const effect of effects || []) {
      if (!force && isOver(battle)) return;
      if (!ctx.source.alive && !force) return;
      applyEffect(battle, effect, ctx, ev);
    }
  }

  function applyEffect(battle, e, ctx, ev) {
    const source = ctx.source;
    const isPlayer = source.side === 'player';
    const spec = e.target || DEFAULT_TARGET[e.type] || 'self';
    const modified = !!ctx.fromCard; // 카드/적 기술에서 온 방어도만 민첩/허약 적용

    switch (e.type) {
      case 'damage':
      case 'damageFromBlock': {
        const times = e.type === 'damage' ? Math.max(1, e.times || 1) : 1;
        for (let i = 0; i < times; i++) {
          if (isOver(battle) || !source.alive) return;
          const targets = resolveTargets(battle, source, spec, ctx);
          for (const target of targets) {
            const base = e.type === 'damage' ? e.value + bonusValue(battle, source, target, e.bonusPer) : source.block;
            const amount = attackDamage(source, target, base, !!ctx.isPotion);
            dealDamage(battle, source, target, amount, { isAttack: !ctx.isPotion && !ctx.fromRelic, lifesteal: e.lifesteal }, ev);
            if (isOver(battle)) return;
          }
        }
        return;
      }
      case 'block':
        for (const t of resolveTargets(battle, source, spec, ctx)) gainBlock(battle, t, e.value, modified, ev);
        return;
      case 'heal':
        for (const t of resolveTargets(battle, source, spec, ctx)) heal(battle, t, e.value, ev);
        return;
      case 'healPct':
        for (const t of resolveTargets(battle, source, spec, ctx)) heal(battle, t, Math.floor(t.maxHp * e.value), ev);
        return;
      case 'loseHp':
        for (const t of resolveTargets(battle, source, spec, ctx)) loseHp(battle, t, e.value, 'self', ev);
        return;
      case 'applyStatus':
        for (const t of resolveTargets(battle, source, spec, ctx)) applyStatus(battle, t, e.status, e.value, ev);
        return;
      case 'multiplyStatus':
        for (const t of resolveTargets(battle, source, spec, ctx)) {
          const cur = st(t, e.status);
          if (cur > 0 && e.value > 1) applyStatus(battle, t, e.status, cur * (e.value - 1), ev);
        }
        return;
      case 'removeDebuffs':
        for (const t of resolveTargets(battle, source, spec, ctx)) {
          for (const id of Object.keys(t.statuses)) {
            if (isDebuff(id, t.statuses[id])) setStatus(t, id, 0, ev);
          }
        }
        return;
      case 'multiplyBlock':
        for (const t of resolveTargets(battle, source, spec, ctx)) {
          const gain = t.block * (e.value - 1);
          if (gain > 0) { t.block += gain; ev.push({ type: 'block', targetUid: t.uid, amount: gain, block: t.block }); }
        }
        return;
      case 'draw':
        if (isPlayer) drawCards(battle, e.value, ev);
        return;
      case 'energy':
        if (isPlayer) {
          battle.energy += e.value;
          ev.push({ type: 'energy', value: battle.energy, delta: e.value });
        }
        return;
      case 'addCard':
        addCards(battle, e.card, e.count || 1, e.to || 'discardPile', e.upgraded, ev);
        return;
      case 'upgradeHand':
        if (isPlayer) {
          let n = 0;
          for (const c of battle.hand) if (canUpgradeInst(c)) { c.upgraded = true; n++; }
          ev.push({ type: 'upgradeHand', count: n });
        }
        return;
      case 'summon':
        if (!isPlayer) {
          for (let i = 0; i < (e.count || 1); i++) {
            if (livingEnemies(battle).length >= MAX_ENEMIES) break;
            const unit = makeEnemyUnit(battle, e.enemy, true);
            if (!unit) break;
            battle.enemies.push(unit);
            ev.push({ type: 'summon', uid: unit.uid });
            chooseIntent(battle, unit, ev);
          }
        }
        return;
      case 'gainGold': {
        const run = battle.run;
        run.player.gold += e.value;
        if (run.stats) run.stats.goldEarned = (run.stats.goldEarned || 0) + e.value;
        ev.push({ type: 'gold', amount: e.value, total: run.player.gold });
        return;
      }
      default:
        console.warn('알 수 없는 효과:', e);
    }
  }

  /* ---------------- 유물 ---------------- */
  function triggerRelics(battle, on, ev, info = {}) {
    const run = battle.run;
    for (const relicId of run.relics || []) {
      const def = relicDef(relicId);
      if (!def || !def.triggers) continue;
      def.triggers.forEach((t, index) => {
        if (t.on !== on) return;
        if (on !== 'battleEnd' && isOver(battle)) return;
        if (t.cardType && t.cardType !== info.cardType) return;
        if (t.turn && battle.turn !== t.turn) return;
        if (t.hpBelowPct && battle.player.hp > battle.player.maxHp * t.hpBelowPct) return;
        if (t.every) {
          const key = `${relicId}:${index}`;
          const counters = t.scope === 'turn' ? battle.relicTurnCounters : battle.relicCounters;
          counters[key] = (counters[key] || 0) + 1;
          if (counters[key] % t.every !== 0) return;
        }
        if (t.chance && !rngB(battle).chance(t.chance)) return;
        ev.push({ type: 'relic', relicId });
        runEffects(battle, t.effects, { source: battle.player, fromRelic: true }, ev, on === 'battleEnd');
      });
    }
  }

  /** HUD 표시용: every 카운터가 있는 유물의 현재 진행도 */
  function relicCounter(battle, relicId) {
    const def = relicDef(relicId);
    if (!battle || !def || !def.triggers) return null;
    const index = def.triggers.findIndex((t) => t.every);
    if (index < 0) return null;
    const t = def.triggers[index];
    const counters = t.scope === 'turn' ? battle.relicTurnCounters : battle.relicCounters;
    return (counters[`${relicId}:${index}`] || 0) % t.every;
  }

  /* ---------------- 턴 흐름 ---------------- */
  function handSizeFor(battle) {
    const run = battle.run;
    return Math.max(1, (run.player.handSize || 5) + (CB.run ? Number(CB.run.modifier(run, 'handSize')) || 0 : 0));
  }
  function maxEnergyFor(battle) {
    const run = battle.run;
    return Math.max(0, (run.player.maxEnergy || 3) + (CB.run ? Number(CB.run.modifier(run, 'maxEnergy')) || 0 : 0));
  }

  function startBattle(battle) {
    const ev = [];
    if (battle.phase !== 'start') return ev;
    for (const enemy of battle.enemies) {
      const def = enemyDef(enemy.id);
      for (const p of (def && def.passives) || []) applyStatus(battle, enemy, p.status, p.value, ev);
    }
    triggerRelics(battle, 'battleStart', ev);
    if (!checkEnd(battle, ev)) startPlayerTurn(battle, ev);
    return ev;
  }

  function startPlayerTurn(battle, ev) {
    const p = battle.player;
    battle.turn += 1;
    battle.phase = 'player';
    battle.counters.cardsPlayedThisTurn = 0;
    battle.counters.attacksThisTurn = 0;
    battle.counters.skillsThisTurn = 0;
    battle.relicTurnCounters = {};
    ev.push({ type: 'turnStart', side: 'player', turn: battle.turn });

    clearBlock(p, ev);
    if (st(p, 'poison') > 0) {
      const dmg = st(p, 'poison');
      loseHp(battle, p, dmg, 'poison', ev);
      if (checkEnd(battle, ev)) return;
      setStatus(p, 'poison', dmg - 1, ev);
    }
    if (st(p, 'toxicAura') > 0) {
      for (const enemy of livingEnemies(battle)) applyStatus(battle, enemy, 'poison', st(p, 'toxicAura'), ev);
    }
    if (st(p, 'nextTurnBlock') > 0) {
      gainBlock(battle, p, st(p, 'nextTurnBlock'), false, ev);
      setStatus(p, 'nextTurnBlock', 0, ev);
    }
    battle.maxEnergy = maxEnergyFor(battle);
    battle.energy = battle.maxEnergy + st(p, 'surge') + st(p, 'nextTurnEnergy');
    if (st(p, 'nextTurnEnergy') > 0) setStatus(p, 'nextTurnEnergy', 0, ev);
    ev.push({ type: 'energy', value: battle.energy });

    triggerRelics(battle, 'turnStart', ev);
    if (checkEnd(battle, ev)) return;

    let n = handSizeFor(battle) + st(p, 'insight') + st(p, 'nextTurnDraw');
    if (st(p, 'nextTurnDraw') > 0) setStatus(p, 'nextTurnDraw', 0, ev);
    if (battle.turn === 1) {
      const innateCount = battle.drawPile.filter((c) => cardDef(c).innate).length;
      n = Math.max(n, Math.min(innateCount, MAX_HAND));
    }
    drawCards(battle, n, ev);
  }

  function endOfTurnStatuses(battle, unit, ev) {
    if (!unit.alive) return;
    if (st(unit, 'plating') > 0) gainBlock(battle, unit, st(unit, 'plating'), false, ev);
    if (st(unit, 'regen') > 0) {
      heal(battle, unit, st(unit, 'regen'), ev);
      setStatus(unit, 'regen', st(unit, 'regen') - 1, ev);
    }
    if (st(unit, 'fervor') > 0) applyStatus(battle, unit, 'strength', st(unit, 'fervor'), ev);
    for (const id of DECAYING) {
      if (st(unit, id) > 0) setStatus(unit, id, st(unit, id) - 1, ev);
    }
  }

  function endTurn(battle) {
    if (battle.phase !== 'player') return [{ type: 'error', text: '지금은 턴을 끝낼 수 없습니다.' }];
    const ev = [];
    const p = battle.player;

    triggerRelics(battle, 'turnEnd', ev);
    for (const card of [...battle.hand]) {
      const def = cardDef(card);
      if (def.onTurnEndInHand && !isOver(battle)) {
        ev.push({ type: 'cardTrigger', cardUid: card.uid });
        runEffects(battle, def.onTurnEndInHand, { source: p, fromCard: false }, ev);
      }
    }
    if (checkEnd(battle, ev)) return ev;

    // 손패 정리
    const kept = [];
    for (const card of battle.hand) {
      const def = cardDef(card);
      if (def.retain) kept.push(card);
      else if (def.ethereal) { battle.exhaustPile.push(card); ev.push({ type: 'exhaust', cardUid: card.uid }); }
      else { battle.discardPile.push(card); ev.push({ type: 'discard', cardUid: card.uid }); }
    }
    battle.hand = kept;
    endOfTurnStatuses(battle, p, ev);

    // ---- 적의 턴 ----
    battle.phase = 'enemy';
    ev.push({ type: 'turnStart', side: 'enemy', turn: battle.turn });
    for (const enemy of livingEnemies(battle)) {
      clearBlock(enemy, ev);
      if (st(enemy, 'poison') > 0) {
        const dmg = st(enemy, 'poison');
        loseHp(battle, enemy, dmg, 'poison', ev);
        if (checkEnd(battle, ev)) return ev;
        if (enemy.alive) setStatus(enemy, 'poison', dmg - 1, ev);
      }
      if (enemy.alive && st(enemy, 'toxicAura') > 0) applyStatus(battle, p, 'poison', st(enemy, 'toxicAura'), ev);
    }
    if (checkEnd(battle, ev)) return ev;

    for (const enemy of livingEnemies(battle)) {
      if (!enemy.alive) continue;
      const def = enemyDef(enemy.id);
      const moveId = battle.intents[enemy.uid];
      const move = def && def.moves[moveId];
      if (move) {
        ev.push({ type: 'enemyAct', uid: enemy.uid, moveId, moveName: move.name });
        runEffects(battle, move.effects, { source: enemy, fromCard: true }, ev);
        if (checkEnd(battle, ev)) return ev;
      }
      if (!enemy.alive) continue;
      endOfTurnStatuses(battle, enemy, ev);
      chooseIntent(battle, enemy, ev);
    }
    if (checkEnd(battle, ev)) return ev;
    startPlayerTurn(battle, ev);
    return ev;
  }

  /* ---------------- 카드 사용 ---------------- */
  function canPlay(battle, handIndex) {
    if (battle.phase !== 'player') return { ok: false, reason: '지금은 카드를 낼 수 없습니다.' };
    const inst = battle.hand[handIndex];
    if (!inst) return { ok: false, reason: '카드가 없습니다.' };
    const def = cardDef(inst);
    if (def.unplayable) return { ok: false, reason: '사용할 수 없는 카드입니다.' };
    if (def.cost > battle.energy) return { ok: false, reason: '에너지가 부족합니다.' };
    if (def.target === 'enemy' && livingEnemies(battle).length === 0) return { ok: false, reason: '대상이 없습니다.' };
    return { ok: true };
  }

  function cardNeedsTarget(battle, handIndex) {
    const inst = battle.hand[handIndex];
    if (!inst) return false;
    return cardDef(inst).target === 'enemy' && livingEnemies(battle).length > 1;
  }

  function playCard(battle, handIndex, targetUid) {
    const check = canPlay(battle, handIndex);
    if (!check.ok) return [{ type: 'error', text: check.reason }];
    const inst = battle.hand[handIndex];
    const def = cardDef(inst);
    const ctx = { source: battle.player, fromCard: true, card: inst };

    if (def.target === 'enemy') {
      const living = livingEnemies(battle);
      let target = targetUid ? getUnit(battle, targetUid) : null;
      if (!target || !target.alive || target.side !== 'enemy') {
        if (living.length === 1) target = living[0];
        else return [{ type: 'error', text: '대상을 선택하세요.' }];
      }
      ctx.targetUid = target.uid;
    }

    const ev = [];
    battle.energy -= def.cost;
    battle.hand.splice(handIndex, 1);
    battle.counters.cardsPlayedThisTurn += 1;
    battle.counters.cardsPlayedThisBattle += 1;
    if (def.type === 'attack') battle.counters.attacksThisTurn += 1;
    if (def.type === 'skill') battle.counters.skillsThisTurn += 1;
    battle.stats.cardsPlayed += 1;
    ev.push({ type: 'cardPlayed', cardUid: inst.uid, cardId: inst.id, targetUid: ctx.targetUid || null, cardType: def.type });
    if (def.cost) ev.push({ type: 'energy', value: battle.energy, delta: -def.cost });

    runEffects(battle, def.effects, ctx, ev);

    if (def.type === 'skill' && !isOver(battle)) {
      for (const enemy of livingEnemies(battle)) {
        if (st(enemy, 'enrage') > 0) applyStatus(battle, enemy, 'strength', st(enemy, 'enrage'), ev);
      }
    }
    if (!isOver(battle)) triggerRelics(battle, 'cardPlayed', ev, { cardType: def.type });

    if (def.type === 'power') { battle.powersPlayed.push(inst); ev.push({ type: 'powerPlayed', cardUid: inst.uid }); }
    else if (def.exhaust) { battle.exhaustPile.push(inst); ev.push({ type: 'exhaust', cardUid: inst.uid }); }
    else { battle.discardPile.push(inst); ev.push({ type: 'discard', cardUid: inst.uid }); }
    checkEnd(battle, ev);
    return ev;
  }

  /* ---------------- 물약 ---------------- */
  function potionNeedsTarget(battle, slot) {
    const def = potionDef(battle.run.potions[slot]);
    return !!def && def.target === 'enemy' && livingEnemies(battle).length > 1;
  }

  function usePotion(battle, slot, targetUid) {
    const run = battle.run;
    const id = run.potions[slot];
    const def = potionDef(id);
    if (!def) return [{ type: 'error', text: '물약이 없습니다.' }];
    if (battle.phase !== 'player') return [{ type: 'error', text: '지금은 물약을 쓸 수 없습니다.' }];
    const ctx = { source: battle.player, isPotion: true };
    if (def.target === 'enemy') {
      const living = livingEnemies(battle);
      let target = targetUid ? getUnit(battle, targetUid) : null;
      if (!target || !target.alive || target.side !== 'enemy') {
        if (living.length === 1) target = living[0];
        else return [{ type: 'error', text: '대상을 선택하세요.' }];
      }
      ctx.targetUid = target.uid;
    }
    const ev = [{ type: 'potion', slot, potionId: id, targetUid: ctx.targetUid || null }];
    run.potions[slot] = null;
    runEffects(battle, def.effects, ctx, ev);
    checkEnd(battle, ev);
    return ev;
  }

  /* ---------------- 종료 ---------------- */
  function result(battle) {
    return battle.phase === 'won' || battle.phase === 'lost' ? battle.phase : null;
  }

  function finishBattle(battle) {
    const ev = [];
    if (battle.finished) return ev;
    battle.finished = true;
    const run = battle.run;
    if (battle.phase === 'won') triggerRelics(battle, 'battleEnd', ev);
    run.player.hp = battle.phase === 'lost' ? 0 : Math.max(1, Math.min(battle.player.maxHp, battle.player.hp));
    run.player.maxHp = battle.player.maxHp;
    if (run.stats) {
      run.stats.damageDealt = (run.stats.damageDealt || 0) + battle.stats.damageDealt;
      run.stats.turns = (run.stats.turns || 0) + battle.turn;
      if (battle.phase === 'won') {
        if (battle.kind === 'elite') run.stats.elitesKilled = (run.stats.elitesKilled || 0) + 1;
        if (battle.kind === 'boss') run.stats.bossesKilled = (run.stats.bossesKilled || 0) + 1;
      }
    }
    return ev;
  }

  function debugKillAll(battle) {
    const ev = [];
    for (const enemy of livingEnemies(battle)) {
      dealDamage(battle, battle.player, enemy, enemy.hp + enemy.block, { isAttack: false }, ev);
    }
    checkEnd(battle, ev);
    return ev;
  }

  /* =========================================================
   * 설명 문구 생성 (한국어)
   * ========================================================= */
  const kwSpan = (id) => `<span class="kw" data-kw="${id}">${kw(id).name}</span>`;
  const numSpan = (actual, base) => {
    if (actual > base) return `<span class="num up">${actual}</span>`;
    if (actual < base) return `<span class="num down">${actual}</span>`;
    return `<span class="num">${actual}</span>`;
  };
  const josa = U.josa;

  const BONUS_TEXT = {
    cardsPlayedThisTurn: '이번 턴에 사용한 카드 1장당',
    block: '현재 방어도 1당',
    targetPoison: '대상의 독 1당',
    exhaustCount: '소멸한 카드 1장당',
    handSize: '손에 있는 카드 1장당',
  };

  function targetPhrase(spec, perspective) {
    if (perspective === 'enemy') {
      if (spec === 'allAllies') return '모든 아군에게 ';
      return '';
    }
    if (spec === 'allEnemies') return '모든 적에게 ';
    if (spec === 'randomEnemy') return '무작위 적에게 ';
    return '';
  }

  /**
   * ctx: { battle, source, target, perspective: 'card'|'enemy'|'plain', cardHand }
   */
  function describeEffect(e, ctx) {
    const { battle, source, target } = ctx;
    const spec = e.target || DEFAULT_TARGET[e.type] || 'self';
    const who = targetPhrase(spec, ctx.perspective);
    switch (e.type) {
      case 'damage': {
        let shown = `<span class="num">${e.value}</span>`;
        if (battle && source) {
          let bonus = 0;
          if (e.bonusPer) {
            // 카드를 내기 직전 기준으로 미리 계산
            const fake = { ...battle, counters: { ...battle.counters }, hand: battle.hand };
            if (ctx.perspective === 'card') fake.counters.cardsPlayedThisTurn += 1;
            bonus = bonusValue(fake, source, target, e.bonusPer);
            if (e.bonusPer.stat === 'handSize' && ctx.perspective === 'card') bonus -= e.bonusPer.value;
          }
          const t = spec === 'enemy' || ctx.perspective === 'enemy' ? target : null;
          shown = numSpan(attackDamage(source, t, e.value + bonus, ctx.isPotion), e.value);
        }
        const times = e.times > 1 ? `${shown}씩 ${e.times}번` : shown;
        let text = `${who}피해를 ${times} 줍니다.`;
        if (e.bonusPer) text += ` ${BONUS_TEXT[e.bonusPer.stat] || ''} 피해 +${e.bonusPer.value}.`;
        if (e.lifesteal) text += ' 막히지 않은 피해만큼 체력을 회복합니다.';
        return text;
      }
      case 'damageFromBlock': {
        let extra = '';
        if (battle && source) extra = ` (${numSpan(attackDamage(source, target, source.block), source.block)})`;
        return `현재 ${kwSpan('block')}만큼 피해를 줍니다.${extra}`;
      }
      case 'block': {
        let shown = `<span class="num">${e.value}</span>`;
        if (battle && source && ctx.perspective !== 'plain') shown = numSpan(blockAmount(source, e.value, true), e.value);
        return `${who}${kwSpan('block')}를 ${shown} 얻${who ? '게 합' : '습'}니다.`;
      }
      case 'heal': return `${who}체력을 ${e.value} 회복합니다.`;
      case 'healPct': return `최대 체력의 ${Math.round(e.value * 100)}%를 회복합니다.`;
      case 'loseHp': return `체력을 ${e.value} 잃습니다.`;
      case 'applyStatus': {
        const k = kw(e.status);
        const name = kwSpan(e.status);
        if (spec === 'self' || (spec === 'allAllies' && ctx.perspective !== 'enemy')) {
          if (e.status === 'fortress') return `${name}를 얻습니다.`;
          if (e.status === 'nextTurnBlock') return `다음 턴 시작 시 ${kwSpan('block')}를 ${e.value} 얻습니다.`;
          if (e.status === 'nextTurnEnergy') return `다음 턴 시작 시 에너지를 ${e.value} 더 얻습니다.`;
          if (e.status === 'nextTurnDraw') return `다음 턴 시작 시 카드를 ${e.value}장 더 뽑습니다.`;
          if (e.value < 0) return `${name}${josa(k.name, '이', '가')} ${-e.value} 감소합니다.`;
          return `${name}${josa(k.name, '을', '를')} ${e.value} 얻습니다.`;
        }
        if (spec === 'allAllies') return `모든 아군에게 ${name} ${e.value}${josa(e.value, '을', '를')} 부여합니다.`;
        return `${who}${name} ${e.value}${josa(e.value, '을', '를')} 부여합니다.`;
      }
      case 'multiplyStatus': {
        const name = kwSpan(e.status);
        const owner = spec === 'self' ? '' : spec === 'allEnemies' ? '모든 적의 ' : '대상의 ';
        return `${owner}${name}${josa(kw(e.status).name, '을', '를')} ${e.value}배로 만듭니다.`;
      }
      case 'removeDebuffs': return '모든 해로운 효과를 제거합니다.';
      case 'multiplyBlock': return `${kwSpan('block')}를 ${e.value}배로 만듭니다.`;
      case 'draw': return `카드를 ${e.value}장 뽑습니다.`;
      case 'energy': return `에너지를 ${e.value} 얻습니다.`;
      case 'addCard': {
        const def = CB.data.cards[e.card];
        const name = def ? `「${def.name}」` : e.card;
        const where = { hand: '손', drawPile: '뽑을 카드 더미', discardPile: '버린 카드 더미' }[e.to || 'discardPile'];
        return `${name} ${e.count || 1}장을 ${where}에 넣습니다.`;
      }
      case 'upgradeHand': return '손에 있는 모든 카드를 이번 전투 동안 강화합니다.';
      case 'summon': {
        const def = enemyDef(e.enemy);
        const name = def ? def.name : e.enemy;
        return `${name}${e.count > 1 ? ` ${e.count}마리` : ''}${josa(e.count > 1 ? '리' : name, '을', '를')} 소환합니다.`;
      }
      case 'gainGold': return `골드를 ${e.value} 얻습니다.`;
      default: return '';
    }
  }

  function collectKeywords(def) {
    const set = new Set();
    const scan = (effects) => {
      for (const e of effects || []) {
        if (e.type === 'applyStatus' || e.type === 'multiplyStatus') set.add(e.status);
        if (e.type === 'block' || e.type === 'damageFromBlock' || e.type === 'multiplyBlock') set.add('block');
        if (e.type === 'addCard' && CB.data.cards[e.card]) {
          const c = CB.data.cards[e.card];
          if (c.unplayable) set.add('unplayable');
          if (c.ethereal) set.add('ethereal');
        }
      }
    };
    scan(def.effects);
    scan(def.onTurnEndInHand);
    for (const flag of ['innate', 'retain', 'ethereal', 'exhaust', 'unplayable']) if (def[flag]) set.add(flag);
    if (def.type === 'power') set.add('power');
    return [...set];
  }

  function cardView(inst, battle, targetUid) {
    const def = cardDef(inst);
    const source = battle ? battle.player : null;
    let target = battle && targetUid ? getUnit(battle, targetUid) : null;
    if (battle && !target && def.target === 'enemy') {
      const living = livingEnemies(battle);
      if (living.length === 1) target = living[0];
    }
    let descHTML;
    if (def.desc) {
      descHTML = def.desc;
    } else {
      const lines = [];
      if (def.innate) lines.push(`${kwSpan('innate')}.`);
      if (def.unplayable) lines.push(`${kwSpan('unplayable')}.`);
      const parts = (def.effects || []).map((e) => describeEffect(e, { battle, source, target, perspective: 'card' })).filter(Boolean);
      if (parts.length) lines.push(parts.join(' '));
      if (def.onTurnEndInHand) {
        const sub = def.onTurnEndInHand.map((e) => describeEffect(e, { perspective: 'plain' })).join(' ');
        lines.push(`턴 종료 시 손에 있으면 ${sub}`);
      }
      if (def.retain) lines.push(`${kwSpan('retain')}.`);
      if (def.ethereal) lines.push(`${kwSpan('ethereal')}.`);
      if (def.exhaust) lines.push(`${kwSpan('exhaust')}.`);
      descHTML = lines.join('<br>');
    }
    const baseDef = CB.data.cards[inst.id] || def;
    const playable = battle
      ? battle.phase === 'player' && !def.unplayable && def.cost <= battle.energy
      : undefined;
    return {
      uid: inst.uid, id: inst.id, name: def.name, cost: def.cost, baseCost: baseDef.cost,
      type: def.type, rarity: def.rarity, art: def.art, target: def.target, upgraded: !!def.upgraded,
      unplayable: !!def.unplayable, exhaust: !!def.exhaust, ethereal: !!def.ethereal, retain: !!def.retain,
      innate: !!def.innate, descHTML, keywords: collectKeywords(def), playable,
    };
  }

  function intentKinds(effects) {
    const kinds = new Set();
    for (const e of effects) {
      const spec = e.target || DEFAULT_TARGET[e.type] || 'self';
      switch (e.type) {
        case 'damage': case 'damageFromBlock': kinds.add('attack'); break;
        case 'block': case 'multiplyBlock': kinds.add('defend'); break;
        case 'heal': case 'healPct': kinds.add('heal'); break;
        case 'summon': kinds.add('summon'); break;
        case 'addCard': kinds.add('debuff'); break;
        case 'applyStatus': case 'multiplyStatus':
          if (spec === 'self' || spec === 'allAllies') kinds.add(isDebuff(e.status, e.value) ? 'debuff' : 'buff');
          else kinds.add('debuff');
          break;
        case 'removeDebuffs': kinds.add('buff'); break;
        case 'loseHp': break;
        default: break;
      }
    }
    const order = ['attack', 'defend', 'buff', 'debuff', 'heal', 'summon'];
    const list = order.filter((k) => kinds.has(k));
    return list.length ? list : ['unknown'];
  }

  function intentView(battle, uid) {
    const enemy = getUnit(battle, uid);
    if (!enemy || !enemy.alive) return null;
    const def = enemyDef(enemy.id);
    const moveId = battle.intents[uid];
    const move = def && def.moves[moveId];
    if (!move) return { kinds: ['unknown'], damage: null, times: 0, moveName: '???', text: '알 수 없는 행동' };
    const hits = [];
    for (const e of move.effects) {
      if (e.type === 'damage') {
        const per = attackDamage(enemy, battle.player, e.value + bonusValue(battle, enemy, battle.player, e.bonusPer));
        for (let i = 0; i < (e.times || 1); i++) hits.push(per);
      } else if (e.type === 'damageFromBlock') {
        hits.push(attackDamage(enemy, battle.player, enemy.block));
      }
    }
    let damage = null;
    let times = 0;
    if (hits.length) {
      if (hits.every((h) => h === hits[0])) { damage = hits[0]; times = hits.length; }
      else { damage = hits.reduce((a, b) => a + b, 0); times = 1; }
    }
    const text = move.effects
      .map((e) => describeEffect(e, { battle, source: enemy, target: battle.player, perspective: 'enemy' }))
      .filter(Boolean).join(' ')
      .replace(/<[^>]+>/g, '');
    return { kinds: intentKinds(move.effects), damage, times, moveName: move.name, text };
  }

  function statusList(unit) {
    const order = CB.data.statusOrder || [];
    const ids = Object.keys(unit.statuses).filter((id) => unit.statuses[id]);
    ids.sort((a, b) => {
      const ia = order.indexOf(a); const ib = order.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
    return ids.map((id) => {
      const k = kw(id);
      const value = unit.statuses[id];
      const kind = isDebuff(id, value) ? 'debuff' : (k.kind === 'debuff' ? 'debuff' : 'buff');
      return { id, value, name: k.name, icon: k.icon, kind, desc: (k.desc || '').replace(/\{value\}/g, Math.abs(value)) };
    });
  }

  return {
    MAX_HAND, MAX_ENEMIES,
    rngOf, cardDef, canUpgradeInst, getUnit, livingEnemies,
    createBattle, startBattle, canPlay, cardNeedsTarget, playCard, potionNeedsTarget, usePotion,
    endTurn, result, finishBattle, debugKillAll,
    cardView, intentView, statusList, relicCounter, describeEffect, attackDamage,
  };
})();
