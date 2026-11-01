'use strict';

/* =========================================================
 * 런(한 판) 진행 — 지도, 보상, 상점, 휴식, 이벤트, 막 전환
 * ========================================================= */
CB.run = (() => {
  const U = CB.util;
  const ROWS = 9;
  const COLS = 7;
  const HERO_RARITIES = ['common', 'uncommon', 'rare'];
  const rng = (run) => CB.combat.rngOf(run);

  /* ---------------- 기본 ---------------- */
  function newCardInst(id, upgraded = false) {
    return { uid: U.nextId('c'), id, upgraded: !!upgraded };
  }

  function newRun(opts = {}) {
    const seed = opts.seed != null ? opts.seed >>> 0 : U.randomSeed();
    const s = CB.data.starter;
    const run = {
      version: 1, seed, rngState: seed,
      act: 1, floor: 0,
      map: null, currentNodeId: null, current: null,
      player: { hp: s.hp, maxHp: s.hp, gold: s.gold, maxEnergy: s.maxEnergy, handSize: s.handSize },
      deck: s.deck.map((id) => newCardInst(id)),
      relics: [], relicCounters: {},
      potions: new Array(s.potionSlots).fill(null),
      cardRemoveCost: 75, seenEvents: [], combatsThisAct: 0, lastEncounter: null,
      stats: { floorsClimbed: 0, enemiesKilled: 0, elitesKilled: 0, bossesKilled: 0, goldEarned: 0, cardsAdded: 0, damageDealt: 0, turns: 0 },
      over: false, victory: false,
    };
    if (s.relic) addRelic(run, s.relic);
    run.map = generateMap(run, 1);
    return run;
  }

  function modifier(run, key) {
    let total = 0;
    let flag = false;
    for (const id of run.relics) {
      const def = CB.data.relics[id];
      const v = def && def.modifiers && def.modifiers[key];
      if (v === undefined) continue;
      if (typeof v === 'boolean') flag = flag || v;
      else total += v;
    }
    return key === 'restHealDisabled' ? flag : total;
  }

  /* ---------------- 지도 생성 ---------------- */
  function generateMap(run, act) {
    const r = rng(run);
    const grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    const edges = new Set(); // "row:col>col"
    const getNode = (row, col) => {
      if (!grid[row][col]) grid[row][col] = { id: `${act}-${row}-${col}`, row, col, type: null, next: [], visited: false };
      return grid[row][col];
    };
    const crosses = (row, from, to) => {
      if (to === from) return false;
      // (row, from→to) 와 (row, to→from) 가 교차
      return edges.has(`${row}:${to}>${from}`);
    };

    const pathCount = r.int(3, 4);
    const starts = r.sample([0, 1, 2, 3, 4, 5, 6], pathCount);
    for (let p = 0; p < pathCount; p++) {
      let col = starts[p];
      for (let row = 0; row < ROWS; row++) {
        const node = getNode(row, col);
        if (row === ROWS - 1) break;
        const options = r.shuffle([-1, 0, 1].map((d) => col + d).filter((c) => c >= 0 && c < COLS));
        let nextCol = options.find((c) => !crosses(row, col, c));
        if (nextCol === undefined) nextCol = col;
        edges.add(`${row}:${col}>${nextCol}`);
        const nextId = `${act}-${row + 1}-${nextCol}`;
        if (!node.next.includes(nextId)) node.next.push(nextId);
        col = nextCol;
      }
    }

    const rows = grid.map((row) => row.filter(Boolean));
    const byId = {};
    rows.flat().forEach((n) => { byId[n.id] = n; });
    const parents = {};
    rows.flat().forEach((n) => n.next.forEach((id) => { (parents[id] = parents[id] || []).push(n); }));

    // 칸 종류 정하기
    const baseWeights = { combat: 45, event: 22, elite: 12, rest: 12, shop: 9 };
    for (let row = 0; row < ROWS; row++) {
      for (const node of rows[row]) {
        if (row === 0) { node.type = 'combat'; continue; }
        if (row === 4) { node.type = 'treasure'; continue; }
        if (row === ROWS - 1) { node.type = 'rest'; continue; }
        const parentTypes = (parents[node.id] || []).map((p) => p.type);
        const weights = { ...baseWeights };
        if (row < 3) { delete weights.elite; delete weights.rest; }
        if (row === ROWS - 2) delete weights.rest;
        for (const t of ['rest', 'shop', 'elite']) if (parentTypes.includes(t)) delete weights[t];
        node.type = r.weighted(weights) || 'combat';
      }
    }
    // 최소 상점 1개, 정예 1개 보장
    const middle = rows.slice(2, ROWS - 1).flat().filter((n) => n.type === 'combat' || n.type === 'event');
    const ensure = (type, minRow) => {
      if (rows.flat().some((n) => n.type === type)) return;
      const candidates = middle.filter((n) => n.row >= minRow && n.type !== 'treasure');
      if (candidates.length) r.pick(candidates).type = type;
    };
    ensure('shop', 2);
    ensure('elite', 3);

    // 배치 좌표 (0~1, y=0 이 맨 아래)
    for (const node of rows.flat()) {
      node.x = U.clamp((node.col + 0.5) / COLS + (r() - 0.5) * 0.06, 0.04, 0.96);
      node.y = node.row / ROWS + (r() - 0.5) * 0.02;
    }
    const encounters = CB.data.encounters[act] || CB.data.encounters[1];
    const bossEnemies = r.pick(encounters.boss);
    const boss = { id: `${act}-boss`, row: ROWS, col: 3, x: 0.5, y: 1, type: 'boss', next: [], visited: false, enemies: bossEnemies };
    rows[ROWS - 1].forEach((n) => { n.next = [boss.id]; });
    return { act, rows, boss };
  }

  function allNodes(run) {
    if (!run.map) return [];
    return run.map.rows.flat().concat([run.map.boss]);
  }
  function findNode(run, id) {
    return allNodes(run).find((n) => n.id === id) || null;
  }
  function availableNodes(run) {
    if (!run.map || run.over) return [];
    if (!run.currentNodeId) return run.map.rows[0].slice();
    const cur = findNode(run, run.currentNodeId);
    if (!cur) return run.map.rows[0].slice();
    return cur.next.map((id) => findNode(run, id)).filter(Boolean);
  }

  /* ---------------- 무작위 선택 ---------------- */
  function heroCardPool(rarity) {
    return Object.values(CB.data.cards).filter((c) => (rarity ? c.rarity === rarity : HERO_RARITIES.includes(c.rarity)));
  }

  function randomCardIds(run, n, opts = {}) {
    const r = rng(run);
    const weights = opts.weights || { common: 60, uncommon: 32, rare: 8 };
    const picked = [];
    let guard = 0;
    while (picked.length < n && guard++ < 200) {
      const rarity = opts.rarity && opts.rarity !== 'any' ? opts.rarity : r.weighted(weights);
      const pool = heroCardPool(rarity).filter((c) => !picked.includes(c.id));
      if (!pool.length) continue;
      picked.push(r.pick(pool).id);
    }
    return picked;
  }

  function randomRelicId(run, rarity) {
    const r = rng(run);
    const owned = new Set(run.relics);
    const all = Object.values(CB.data.relics).filter((d) => !owned.has(d.id));
    let pool;
    if (rarity) pool = all.filter((d) => d.rarity === rarity);
    else {
      const pick = r.weighted({ common: 50, uncommon: 33, rare: 17 });
      pool = all.filter((d) => d.rarity === pick);
    }
    if (!pool || !pool.length) pool = all.filter((d) => ['common', 'uncommon', 'rare'].includes(d.rarity));
    return pool.length ? r.pick(pool).id : null;
  }

  function randomPotionId(run) {
    const r = rng(run);
    const rarity = r.weighted({ common: 65, uncommon: 25, rare: 10 });
    let pool = Object.values(CB.data.potions).filter((p) => p.rarity === rarity);
    if (!pool.length) pool = Object.values(CB.data.potions);
    return r.pick(pool).id;
  }

  /* ---------------- 덱/유물/물약 조작 ---------------- */
  function addGold(run, n) {
    run.player.gold = Math.max(0, run.player.gold + n);
    if (n > 0) run.stats.goldEarned += n;
    return run.player.gold;
  }

  function addCard(run, cardId, upgraded = false) {
    if (!CB.data.cards[cardId]) { console.warn('알 수 없는 카드:', cardId); return null; }
    const inst = newCardInst(cardId, upgraded);
    run.deck.push(inst);
    const def = CB.data.cards[cardId];
    if (HERO_RARITIES.includes(def.rarity)) run.stats.cardsAdded += 1;
    return inst;
  }

  function removeCard(run, uid) {
    const i = run.deck.findIndex((c) => c.uid === uid);
    if (i < 0) return false;
    run.deck.splice(i, 1);
    return true;
  }

  const canUpgrade = (inst) => CB.combat.canUpgradeInst(inst);

  function upgradeCard(run, uid) {
    const inst = run.deck.find((c) => c.uid === uid);
    if (!inst || !canUpgrade(inst)) return false;
    inst.upgraded = true;
    return true;
  }

  const hasRelic = (run, id) => run.relics.includes(id);

  function addRelic(run, relicId) {
    const def = CB.data.relics[relicId];
    if (!def || hasRelic(run, relicId)) return { followUps: [], messages: [] };
    run.relics.push(relicId);
    run.relicCounters[relicId] = 0;
    if (def.modifiers && def.modifiers.potionSlots) {
      for (let i = 0; i < def.modifiers.potionSlots; i++) run.potions.push(null);
    }
    if (def.onPickup) return applyRunEffects(run, def.onPickup);
    return { followUps: [], messages: [] };
  }

  function addPotion(run, potionId) {
    if (!CB.data.potions[potionId]) return false;
    const slot = run.potions.indexOf(null);
    if (slot < 0) return false;
    run.potions[slot] = potionId;
    return true;
  }

  function discardPotion(run, slot) {
    if (slot < 0 || slot >= run.potions.length) return false;
    run.potions[slot] = null;
    return true;
  }

  function heal(run, n) {
    const healed = Math.max(0, Math.min(Math.floor(n), run.player.maxHp - run.player.hp));
    run.player.hp += healed;
    return healed;
  }

  /* ---------------- 칸 진입/완료 ---------------- */
  function pickEncounter(run, pool) {
    const r = rng(run);
    const options = pool.filter((e) => e.join(',') !== run.lastEncounter);
    const choice = r.pick(options.length ? options : pool);
    run.lastEncounter = choice.join(',');
    return choice.slice();
  }

  function enterNode(run, nodeId) {
    const node = findNode(run, nodeId);
    if (!node) return null;
    const avail = availableNodes(run).some((n) => n.id === nodeId);
    if (!avail && !(run.current && run.current.nodeId === nodeId)) return null;
    if (run.current && run.current.nodeId === nodeId && run.current.data) return run.current.data;

    run.currentNodeId = nodeId;
    node.visited = true;
    const enc = CB.data.encounters[run.act] || CB.data.encounters[1];
    let data;
    switch (node.type) {
      case 'combat': {
        const pool = run.combatsThisAct < 3 ? enc.easy : enc.normal;
        run.combatsThisAct += 1;
        data = { type: 'combat', kind: 'normal', enemies: pickEncounter(run, pool) };
        break;
      }
      case 'elite':
        data = { type: 'elite', kind: 'elite', enemies: pickEncounter(run, enc.elite) };
        break;
      case 'boss':
        data = { type: 'boss', kind: 'boss', enemies: (node.enemies || enc.boss[0]).slice() };
        break;
      case 'shop':
        data = { type: 'shop', shop: generateShop(run) };
        break;
      case 'rest':
        data = { type: 'rest' };
        break;
      case 'event': {
        const eventId = pickEvent(run);
        data = eventId ? { type: 'event', eventId } : { type: 'combat', kind: 'normal', enemies: pickEncounter(run, enc.normal) };
        break;
      }
      case 'treasure':
        data = { type: 'treasure', relicId: randomRelicId(run), gold: rng(run).int(20, 40) };
        break;
      default:
        data = { type: 'rest' };
    }
    run.current = { nodeId, type: data.type, data, stage: 'entered' };
    return data;
  }

  function completeNode(run) {
    const node = run.currentNodeId ? findNode(run, run.currentNodeId) : null;
    run.current = null;
    if (!node) return { actComplete: false, victory: false };
    node.visited = true;
    run.floor = node.row + 1;
    run.stats.floorsClimbed += 1;
    if (node.type !== 'boss') return { actComplete: false, victory: false };

    if (run.act >= 3) {
      run.over = true;
      run.victory = true;
      return { actComplete: true, victory: true };
    }
    run.act += 1;
    run.floor = 0;
    run.combatsThisAct = 0;
    run.currentNodeId = null;
    run.lastEncounter = null;
    heal(run, Math.ceil((run.player.maxHp - run.player.hp) * 0.75));
    run.map = generateMap(run, run.act);
    return { actComplete: true, victory: false };
  }

  /* ---------------- 보상 ---------------- */
  function rewards(run, kind = 'normal') {
    if (run.current && run.current.rewards && run.current.rewardsKind === kind) return run.current.rewards;
    const r = rng(run);
    const goldRange = { normal: [12, 20], elite: [28, 38], boss: [75, 95], event: [12, 20] }[kind] || [12, 20];
    const mult = Math.max(0, 1 + Number(modifier(run, 'goldMultiplier')));
    const gold = Math.round(r.int(goldRange[0], goldRange[1]) * mult);
    const count = Math.max(1, 3 + Number(modifier(run, 'cardChoices')));
    const weights = kind === 'elite' ? { common: 45, uncommon: 40, rare: 15 } : { common: 60, uncommon: 32, rare: 8 };
    const cards = kind === 'boss' ? randomCardIds(run, count, { rarity: 'rare' }) : randomCardIds(run, count, { weights });
    const potionChance = 0.4 + Number(modifier(run, 'potionChanceBonus'));
    const potion = kind !== 'boss' && r.chance(potionChance) ? randomPotionId(run) : null;
    const relic = kind === 'elite' ? randomRelicId(run) : null;
    let relicChoices = [];
    if (kind === 'boss' && run.act < 3) {
      const pool = Object.values(CB.data.relics).filter((d) => d.rarity === 'boss' && !hasRelic(run, d.id)).map((d) => d.id);
      relicChoices = r.sample(pool, Math.min(3, pool.length));
    }
    const result = { gold, cards, potion, relic, relicChoices };
    if (run.current) { run.current.rewards = result; run.current.rewardsKind = kind; }
    return result;
  }

  /* ---------------- 상점 ---------------- */
  function priceFor(run, base) {
    const discount = Number(modifier(run, 'shopDiscountPct')) || 0;
    return Math.max(1, Math.round(base * (1 - discount)));
  }

  function generateShop(run) {
    const r = rng(run);
    const cardPrice = { common: [45, 55], uncommon: [70, 80], rare: [135, 160] };
    const cards = randomCardIds(run, 5, { weights: { common: 45, uncommon: 38, rare: 17 } }).map((id) => {
      const [lo, hi] = cardPrice[CB.data.cards[id].rarity] || [50, 60];
      return { id, price: priceFor(run, r.int(lo, hi)), sold: false };
    });
    const relicPrice = { common: [140, 170], uncommon: [190, 230], rare: [250, 300], shop: [160, 200] };
    const relicIds = [];
    for (let i = 0; i < 2; i++) {
      const id = randomRelicId(run);
      if (id && !relicIds.includes(id)) relicIds.push(id);
    }
    const shopPool = Object.values(CB.data.relics).filter((d) => d.rarity === 'shop' && !hasRelic(run, d.id) && !relicIds.includes(d.id));
    if (shopPool.length) relicIds.push(r.pick(shopPool).id);
    else {
      const extra = randomRelicId(run);
      if (extra && !relicIds.includes(extra)) relicIds.push(extra);
    }
    const relics = relicIds.map((id) => {
      const [lo, hi] = relicPrice[CB.data.relics[id].rarity] || [150, 200];
      return { id, price: priceFor(run, r.int(lo, hi)), sold: false };
    });
    const potionPrice = { common: [45, 55], uncommon: [65, 75], rare: [80, 90] };
    const potions = [0, 1, 2].map(() => {
      const id = randomPotionId(run);
      const [lo, hi] = potionPrice[CB.data.potions[id].rarity] || [50, 60];
      return { id, price: priceFor(run, r.int(lo, hi)), sold: false };
    });
    return { cards, relics, potions, removeCost: priceFor(run, run.cardRemoveCost), removeUsed: false };
  }

  function buy(run, shop, section, index) {
    const item = shop[section] && shop[section][index];
    if (!item) return { ok: false, reason: '상품이 없습니다.' };
    if (item.sold) return { ok: false, reason: '이미 판매된 상품입니다.' };
    if (run.player.gold < item.price) return { ok: false, reason: '골드가 부족합니다.' };
    let followUps = [];
    if (section === 'potions') {
      if (!run.potions.includes(null)) return { ok: false, reason: '물약 슬롯이 가득 찼습니다.' };
      addPotion(run, item.id);
    } else if (section === 'cards') {
      addCard(run, item.id);
    } else if (section === 'relics') {
      followUps = addRelic(run, item.id).followUps;
    }
    run.player.gold -= item.price;
    item.sold = true;
    return { ok: true, followUps };
  }

  function shopRemove(run, shop, uid) {
    if (shop.removeUsed) return { ok: false, reason: '이번 상점에서는 이미 카드를 제거했습니다.' };
    if (run.player.gold < shop.removeCost) return { ok: false, reason: '골드가 부족합니다.' };
    if (!removeCard(run, uid)) return { ok: false, reason: '카드를 찾을 수 없습니다.' };
    run.player.gold -= shop.removeCost;
    shop.removeUsed = true;
    run.cardRemoveCost += 25;
    return { ok: true };
  }

  /* ---------------- 휴식 ---------------- */
  function restHealAmount(run) {
    const pct = 0.3 + (Number(modifier(run, 'restHealBonusPct')) || 0);
    return Math.floor(run.player.maxHp * pct);
  }

  function restOptions(run) {
    const healDisabled = !!modifier(run, 'restHealDisabled');
    const amount = restHealAmount(run);
    return [
      {
        id: 'heal', label: '휴식', icon: '🔥',
        desc: healDisabled ? '심연의 심장이 휴식을 허락하지 않습니다.' : `체력을 ${amount} 회복합니다.`,
        disabled: healDisabled,
      },
      {
        id: 'upgrade', label: '단련', icon: '⚒️',
        desc: '덱의 카드 1장을 강화합니다.',
        disabled: !run.deck.some(canUpgrade),
      },
    ];
  }

  function restHeal(run) {
    if (modifier(run, 'restHealDisabled')) return 0;
    return heal(run, restHealAmount(run));
  }

  /* ---------------- 이벤트 ---------------- */
  function pickEvent(run) {
    const all = Object.values(CB.data.events).filter((e) => (e.acts || [1, 2, 3]).includes(run.act));
    let pool = all.filter((e) => !run.seenEvents.includes(e.id));
    if (!pool.length) pool = all;
    if (!pool.length) return null;
    const ev = rng(run).pick(pool);
    if (!run.seenEvents.includes(ev.id)) run.seenEvents.push(ev.id);
    return ev.id;
  }

  function canChoose(run, eventId, idx) {
    const ev = CB.data.events[eventId];
    const choice = ev && ev.choices[idx];
    if (!choice) return { ok: false, reason: '선택지가 없습니다.' };
    const req = choice.require || {};
    if (req.gold && run.player.gold < req.gold) return { ok: false, reason: `골드 ${req.gold} 필요` };
    if (req.hpAbove && run.player.hp <= req.hpAbove) return { ok: false, reason: `체력 ${req.hpAbove + 1} 이상 필요` };
    return { ok: true };
  }

  function resolveEvent(run, eventId, idx) {
    const check = canChoose(run, eventId, idx);
    if (!check.ok) return { ok: false, text: check.reason, followUps: [], messages: [] };
    const choice = CB.data.events[eventId].choices[idx];
    const outcomes = choice.outcomes || [];
    const outcome = outcomes.length > 1
      ? rng(run).weighted(outcomes.map((o) => [o, o.weight || 1]))
      : outcomes[0] || { text: '', effects: [] };
    const res = applyRunEffects(run, outcome.effects || []);
    return { ok: true, text: outcome.text || '', followUps: res.followUps, messages: res.messages };
  }

  /* ---------------- 실행 효과 ---------------- */
  function applyRunEffects(run, effects) {
    const followUps = [];
    const messages = [];
    const p = run.player;
    for (const e of effects || []) {
      switch (e.type) {
        case 'gainGold': addGold(run, e.value); messages.push(`💰 골드 +${e.value}`); break;
        case 'loseGold': {
          const lost = Math.min(p.gold, e.value);
          p.gold -= lost;
          messages.push(`💰 골드 -${lost}`);
          break;
        }
        case 'heal': { const h = heal(run, e.value); if (h) messages.push(`❤️ 체력 +${h}`); break; }
        case 'healPct': { const h = heal(run, Math.floor(p.maxHp * e.value)); if (h) messages.push(`❤️ 체력 +${h}`); break; }
        case 'loseHp': {
          const lost = Math.min(p.hp - 1, e.value);
          p.hp -= Math.max(0, lost);
          messages.push(`💔 체력 -${Math.max(0, lost)}`);
          break;
        }
        case 'gainMaxHp': p.maxHp += e.value; p.hp += e.value; messages.push(`❤️ 최대 체력 +${e.value}`); break;
        case 'loseMaxHp':
          p.maxHp = Math.max(1, p.maxHp - e.value);
          p.hp = Math.min(p.hp, p.maxHp);
          messages.push(`💔 최대 체력 -${e.value}`);
          break;
        case 'addCard': {
          const inst = addCard(run, e.card, e.upgraded);
          if (inst) messages.push(`🃏 카드 획득: ${CB.combat.cardDef(inst).name}`);
          break;
        }
        case 'addRandomCard':
          for (const id of randomCardIds(run, e.count || 1, { rarity: e.rarity || 'any' })) {
            addCard(run, id);
            messages.push(`🃏 카드 획득: ${CB.data.cards[id].name}`);
          }
          break;
        case 'addCurse': {
          let id = e.card;
          if (!CB.data.cards[id]) id = rng(run).pick(Object.values(CB.data.cards).filter((c) => c.type === 'curse')).id;
          addCard(run, id);
          messages.push(`🕸️ 저주 획득: ${CB.data.cards[id].name}`);
          break;
        }
        case 'removeCard': followUps.push({ type: 'removeCard', count: e.count || 1 }); break;
        case 'upgradeCard': followUps.push({ type: 'upgradeCard', count: e.count || 1 }); break;
        case 'upgradeRandom': {
          const pool = rng(run).shuffle(run.deck.filter(canUpgrade));
          for (const inst of pool.slice(0, e.count || 1)) {
            inst.upgraded = true;
            messages.push(`⚒️ 강화: ${CB.combat.cardDef(inst).name}`);
          }
          break;
        }
        case 'gainRelic': {
          const id = e.relic === 'random' || !e.relic ? randomRelicId(run, e.rarity) : e.relic;
          if (id && !hasRelic(run, id)) {
            const res = addRelic(run, id);
            messages.push(`${CB.data.relics[id].icon} 유물 획득: ${CB.data.relics[id].name}`);
            followUps.push(...res.followUps);
            messages.push(...res.messages);
          } else {
            addGold(run, 50);
            messages.push('💰 골드 +50');
          }
          break;
        }
        case 'gainPotion': {
          const id = e.potion === 'random' || !e.potion ? randomPotionId(run) : e.potion;
          if (addPotion(run, id)) messages.push(`🧪 물약 획득: ${CB.data.potions[id].name}`);
          else messages.push('🧪 물약 슬롯이 가득 차 물약을 버렸습니다.');
          break;
        }
        case 'maxEnergy': p.maxEnergy += e.value; messages.push(`⚡ 최대 에너지 +${e.value}`); break;
        case 'potionSlots':
          for (let i = 0; i < e.value; i++) run.potions.push(null);
          messages.push(`🧪 물약 슬롯 +${e.value}`);
          break;
        case 'combat': followUps.push({ type: 'combat', enemies: e.enemies.slice(), kind: e.kind || 'normal' }); break;
        default: console.warn('알 수 없는 실행 효과:', e);
      }
    }
    return { followUps, messages };
  }

  /* ---------------- 점수/요약 ---------------- */
  function score(run) {
    const s = run.stats;
    let total = s.floorsClimbed * 10 + s.enemiesKilled * 3 + s.elitesKilled * 25 + s.bossesKilled * 100;
    total += Math.floor(run.player.gold / 10);
    if (run.victory) total += 500 + run.player.hp * 2;
    return total;
  }

  function summary(run) {
    const s = run.stats;
    return [
      ['도달', run.victory ? '정상 정복!' : `${run.act}막 ${run.floor}층`],
      ['오른 층', `${s.floorsClimbed}`],
      ['처치한 적', `${s.enemiesKilled}`],
      ['정예 처치', `${s.elitesKilled}`],
      ['보스 처치', `${s.bossesKilled}`],
      ['획득 골드', `${s.goldEarned}`],
      ['총 피해량', `${s.damageDealt}`],
      ['덱', `${run.deck.length}장`],
      ['유물', `${run.relics.length}개`],
    ];
  }

  return {
    ROWS, COLS,
    rng, newRun, newCardInst, modifier, generateMap, findNode, allNodes, availableNodes,
    enterNode, completeNode, rewards, addGold, addCard, removeCard, upgradeCard, canUpgrade,
    addRelic, hasRelic, addPotion, discardPotion, heal,
    generateShop, buy, shopRemove, restOptions, restHeal, restHealAmount,
    pickEvent, canChoose, resolveEvent, applyRunEffects,
    randomCardIds, randomRelicId, randomPotionId, score, summary,
  };
})();
