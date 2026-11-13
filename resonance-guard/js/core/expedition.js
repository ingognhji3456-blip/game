'use strict';

/* =========================================================
 * 원정 진행 (순수 함수 — 저장할 상태 run을 받아 바꿈) — 설계: docs/design/expedition.md
 * 모든 무작위는 원정 시드에서 파생한 시드 난수(RG.util.makeRng)로 정해짐 → 같은 시드·같은 선택 = 같은 원정.
 * run.phase: 'deck'(시작 덱 고르기) → 'map'(층 노드 고르기) → 'battle'(판 중) → 'reward'(보상 고르기) / 'event' / 'shop' / 'rest' → 'map' … → 'done'
 * ========================================================= */
RG.expedition = (() => {
  const E = () => RG.data.expedition;
  const U = () => RG.util;
  /** (원정 시드, 이름표) → 새 난수 */
  const rngOf = (run, ...tags) => U().makeRng(U().hashStr(`${run.seed}|${tags.join('|')}`) >>> 0);
  const pick = (r, list) => list[Math.floor(r() * list.length) % list.length];
  function shuffled(r, list) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  /** 새 원정: owned = 가진 탑 목록(뽑기), 시작 덱 후보 6종 */
  function newRun(seed, heroId, owned) {
    const run = {
      v: 1, seed: seed >>> 0, heroId, act: 1, floor: 1, lives: E().startLives, silver: 0,
      owned: owned.slice(), deck: [], up: [], relics: [], phase: 'deck', offer: [], node: null, nodes: null,
      history: [], shopBought: [], floorsCleared: 0, actsCleared: 0, result: null, battles: 0,
    };
    // 시작 덱 후보: 가진 탑에서 무작위 6종, 공격 탑이 3종은 들어가게 (지원·경제 탑만으로 덱이 차지 않게)
    const isAtk = (t) => RG.data.towers[t].role === 'attack';
    const all = shuffled(rngOf(run, 'deck'), owned);
    const n = Math.min(E().startDeck.offer, owned.length);
    const atk = all.filter(isAtk).slice(0, Math.min(3, n));
    run.offer = atk.concat(all.filter((t) => !atk.includes(t))).slice(0, n);
    run.offer = all.filter((t) => run.offer.includes(t)); // 순서는 섞인 그대로
    return run;
  }
  function pickDeck(run, types) {
    if (run.phase !== 'deck') return { ok: false, reason: '덱을 고르는 때가 아닙니다' };
    const n = Math.min(E().startDeck.pick, run.offer.length);
    if (types.length !== n || types.some((t) => !run.offer.includes(t)) || new Set(types).size !== n) return { ok: false, reason: `${n}종을 골라 주세요` };
    run.deck = types.slice();
    run.phase = 'map';
    run.nodes = floorNodes(run);
    return { ok: true };
  }

  /** 막 지역의 보스 아닌 맵들 */
  function actMaps(act) {
    const regs = E().actRegions[act - 1];
    return RG.data.maps.filter((m) => regs.includes(m.region) && !m.boss).map((m) => m.id);
  }
  const isBossFloor = (run) => run.floor > E().floors;
  /** 이 막의 보스 맵 (막을 시작할 때부터 정해져 있음 → 지도에서 미리 보여 줌) */
  const actBossMap = (run, act = run.act) => pick(rngOf(run, 'floor', act, E().floors + 1), E().actBoss[act - 1]);

  /** 이번 층의 노드 2~3개 (보스 층은 보스 하나) */
  function floorNodes(run) {
    const r = rngOf(run, 'floor', run.act, run.floor);
    if (isBossFloor(run)) return [{ kind: 'boss', mapId: actBossMap(run) }];
    const n = 2 + (r() < 0.6 ? 1 : 0);
    const maps = shuffled(r, actMaps(run.act));
    const out = [];
    for (let i = 0; i < n; i++) {
      let kind = 'battle';
      if (run.floor > 1) {
        const W = E().nodeWeights;
        const kinds = Object.keys(W).filter((k) => (k !== 'elite' || run.floor >= 2) && ((k !== 'shop' && k !== 'rest') || run.floor >= 3));
        const tot = kinds.reduce((a, k) => a + W[k], 0);
        let x = r() * tot;
        for (const k of kinds) { x -= W[k]; if (x <= 0) { kind = k; break; } }
      }
      const node = { kind };
      if (kind === 'battle' || kind === 'elite') {
        node.mapId = maps[i % maps.length];
        node.rule = pick(r, E().ruleOrder);
      }
      if (kind === 'event') node.event = pick(r, E().events).id;
      out.push(node);
    }
    // 같은 층에 전투가 하나도 없으면 첫 노드를 전투로 (진행이 너무 쉬워지지 않게)
    if (!out.some((x) => x.kind === 'battle' || x.kind === 'elite')) { out[0] = { kind: 'battle', mapId: maps[0], rule: pick(r, E().ruleOrder) }; }
    return out;
  }

  /** 유물·변형 규칙을 합친 수정치 */
  function mods(run, ruleId) {
    const out = {};
    const add = (m) => { for (const [k, v] of Object.entries(m || {})) out[k] = (out[k] || 0) + v; };
    for (const id of run.relics) add((E().relics[id] || {}).mods);
    if (ruleId && E().rules[ruleId]) add(E().rules[ruleId].mods);
    return out;
  }

  /** 노드 고르기 → 전투면 { battle: opts 조각 }, 아니면 그 단계로 */
  function choose(run, idx) {
    if (run.phase !== 'map') return { ok: false, reason: '지금은 고를 수 없습니다' };
    const node = run.nodes && run.nodes[idx];
    if (!node) return { ok: false, reason: '없는 노드' };
    run.node = Object.assign({ idx }, node);
    if (node.kind === 'battle' || node.kind === 'elite' || node.kind === 'boss') { run.phase = 'battle'; return { ok: true, battle: true }; }
    if (node.kind === 'event') run.phase = 'event';
    else if (node.kind === 'shop') { run.phase = 'shop'; run.shopBought = []; run.shopStock = shopStock(run); }
    else if (node.kind === 'rest') run.phase = 'rest';
    return { ok: true };
  }

  /** 지금 노드의 판 설정: { mapId, expedition, hpMult } (게임 opts에 합쳐 씀) */
  function battleSetup(run) {
    const node = run.node;
    const def = RG.data.maps.find((m) => m.id === node.mapId);
    const L = def.waves.length;
    let waves;
    if (node.kind === 'boss') {
      const k = Math.min(E().waves.boss, L);
      waves = Array.from({ length: k }, (_, i) => L - k + i);
    } else {
      // 이어진 k웨이브: 층이 오를수록 맵의 뒤쪽으로 (앞 waveWindow 안에서) — 웨이브 사이 경제 흐름은 맵 그대로
      const k = Math.min(node.kind === 'elite' ? E().waves.elite : E().waves.battle, L);
      const span = Math.max(k, Math.round(L * (E().waveWindow || 1)));
      const start = Math.round(((span - k) * (Math.min(run.floor, E().floors) - 1)) / Math.max(1, E().floors - 1));
      waves = Array.from({ length: k }, (_, i) => start + i);
    }
    const m = mods(run, node.kind === 'boss' ? null : node.rule);
    const boss = node.kind === 'boss';
    const hpScale = E().actScale[run.act - 1] * (1 + E().floorScale * (Math.min(run.floor, E().floors) - 1)) * (node.kind === 'elite' ? E().eliteScale : 1) * (boss ? E().boss.hpScale[run.act - 1] : 1) * (1 + (m.hpScale || 0));
    const meta = {};
    for (const [k, v] of Object.entries(m)) if (!['hpScale', 'armorAdd', 'countdownMul', 'silverPct', 'winLife'].includes(k)) meta[k] = v;
    return {
      mapId: node.mapId,
      hpMult: Math.round(hpScale * 10000) / 10000,
      expedition: {
        waves, lives: run.lives, goldMult: boss ? E().boss.goldMult : E().goldMult, meta, upgraded: run.up.slice(),
        armorAdd: m.armorAdd || 0, countdownMul: m.countdownMul ? Math.max(0.25, 0.5 ** Math.round(m.countdownMul / 0.5)) : 1, // 절반 효과가 겹치면 ¼까지
        act: run.act, floor: run.floor, kind: node.kind, rule: node.kind === 'boss' ? null : node.rule,
      },
    };
  }

  /** 판 결과 반영: { result: 'win'|'lose', lives } */
  function applyBattle(run, res) {
    if (run.phase !== 'battle') return { ok: false, reason: '판 중이 아닙니다' };
    const node = run.node;
    const m = mods(run);
    run.battles += 1;
    run.lives = Math.max(0, Math.min(E().maxLives, res.lives));
    if (res.result !== 'win' || run.lives <= 0) { run.lives = 0; return finish(run, false); }
    if (m.winLife) run.lives = Math.min(E().maxLives, run.lives + m.winLife);
    const S = E().silver;
    const base = (node.kind === 'boss' ? S.boss : node.kind === 'elite' ? S.elite : S.battle) + S.perAct * (run.act - 1);
    const gain = Math.round(base * (1 + (m.silverPct || 0)));
    run.silver += gain;
    const r = rngOf(run, 'reward', run.act, run.floor);
    if (node.kind === 'battle') {
      run.offer = shuffled(r, run.owned.filter((t) => !run.deck.includes(t))).slice(0, 3);
      run.offerKind = 'tower';
    } else {
      run.offer = shuffled(r, Object.keys(E().relics).filter((k) => !run.relics.includes(k) && E().relics[k].kind !== 'curse')).slice(0, 3);
      run.offerKind = 'relic';
    }
    run.phase = 'reward';
    return { ok: true, silver: gain };
  }
  /** 보상 고르기: id(탑·유물) 또는 null(은화로) */
  function takeReward(run, id) {
    if (run.phase !== 'reward') return { ok: false, reason: '보상 단계가 아닙니다' };
    if (id == null) {
      if (run.offerKind === 'tower') run.silver += E().silver.skip;
    } else {
      if (!run.offer.includes(id)) return { ok: false, reason: '없는 보상' };
      if (run.offerKind === 'tower') { if (run.deck.length >= E().maxDeck) return { ok: false, reason: `덱은 ${E().maxDeck}종까지입니다` }; run.deck.push(id); } else run.relics.push(id);
    }
    run.offer = [];
    return advance(run);
  }

  /** 다음 층으로 (보스를 깨면 다음 막, 마지막 막이면 원정 승리) */
  function advance(run) {
    run.history.push({ act: run.act, floor: run.floor, kind: run.node ? run.node.kind : null });
    const wasBoss = run.node && run.node.kind === 'boss';
    run.node = null;
    run.floorsCleared += 1;
    if (wasBoss) {
      run.actsCleared += 1;
      if (run.act >= E().acts) return finish(run, true);
      run.act += 1;
      run.floor = 1;
    } else run.floor += 1;
    run.phase = 'map';
    run.nodes = floorNodes(run);
    return { ok: true };
  }

  /** 사건 선택지 */
  function eventChoose(run, optIdx) {
    if (run.phase !== 'event') return { ok: false, reason: '사건이 아닙니다' };
    const ev = E().events.find((x) => x.id === run.node.event);
    const opt = ev && ev.options[optIdx];
    if (!opt) return { ok: false, reason: '없는 선택지' };
    if (opt.cost) {
      if (opt.cost.silver && run.silver < opt.cost.silver) return { ok: false, reason: '은화가 모자랍니다' };
      if (opt.cost.lives && run.lives <= opt.cost.lives) return { ok: false, reason: '불꽃이 모자랍니다' };
      run.silver -= opt.cost.silver || 0;
      run.lives -= opt.cost.lives || 0;
    }
    const r = rngOf(run, 'event', run.act, run.floor);
    const fx = opt.effect || {};
    const log = [];
    if (fx.silver) { run.silver = Math.max(0, run.silver + fx.silver); log.push(`은화 ${fx.silver > 0 ? '+' : ''}${fx.silver}`); }
    if (fx.lives) { run.lives = Math.max(1, Math.min(E().maxLives, run.lives + fx.lives)); log.push(`불꽃 ${fx.lives > 0 ? '+' : ''}${fx.lives}`); }
    if (fx.gamble) { if (r() < 0.5) { run.silver += fx.gamble; log.push(`이겼다! 은화 +${fx.gamble}`); } else log.push('졌다…'); }
    if (fx.upgrade) { const c = run.deck.filter((t) => !run.up.includes(t)); if (c.length) { const t = pick(r, c); run.up.push(t); log.push(`${RG.data.towers[t].name} 원정 강화`); } }
    if (fx.addTower) { const c = run.owned.filter((t) => !run.deck.includes(t)); if (c.length && run.deck.length < E().maxDeck) { const t = pick(r, c); run.deck.push(t); log.push(`${RG.data.towers[t].name} 합류`); } }
    if (fx.removeTower && run.deck.length > 2) { const t = pick(r, run.deck); run.deck = run.deck.filter((x) => x !== t); run.up = run.up.filter((x) => x !== t); log.push(`${RG.data.towers[t].name} 잃음`); }
    if (fx.relic) {
      const pool = Object.keys(E().relics).filter((k) => !run.relics.includes(k) && (fx.relic === 'gamble' || E().relics[k].kind !== 'curse'));
      if (pool.length) { const id = pick(r, pool); run.relics.push(id); log.push(`유물: ${E().relics[id].name}`); }
    }
    const done = advance(run);
    return Object.assign(done, { log });
  }

  /** 상점 물건 (노드마다 정해짐) */
  function shopStock(run) {
    const r = rngOf(run, 'shop', run.act, run.floor);
    const towers = shuffled(r, run.owned.filter((t) => !run.deck.includes(t))).slice(0, 2);
    const relic = shuffled(r, Object.keys(E().relics).filter((k) => !run.relics.includes(k) && E().relics[k].kind !== 'curse'))[0];
    const items = towers.map((t) => ({ id: `t:${t}`, kind: 'tower', type: t, price: E().shop.tower }));
    if (relic) items.push({ id: `r:${relic}`, kind: 'relic', relic, price: E().shop.relic });
    items.push({ id: 'heal', kind: 'heal', price: E().shop.heal }, { id: 'upgrade', kind: 'upgrade', price: E().shop.upgrade });
    return items;
  }
  /** 상점에서 사기. upgradeType: 원정 강화할 탑 */
  function shopBuy(run, itemId, upgradeType) {
    if (run.phase !== 'shop') return { ok: false, reason: '상점이 아닙니다' };
    const it = (run.shopStock || []).find((x) => x.id === itemId);
    if (!it) return { ok: false, reason: '없는 물건' };
    if (run.shopBought.includes(itemId) && it.kind !== 'heal') return { ok: false, reason: '이미 샀습니다' };
    if (run.silver < it.price) return { ok: false, reason: '은화가 모자랍니다' };
    if (it.kind === 'tower') { if (run.deck.length >= E().maxDeck) return { ok: false, reason: `덱은 ${E().maxDeck}종까지입니다` }; run.deck.push(it.type); }
    else if (it.kind === 'relic') run.relics.push(it.relic);
    else if (it.kind === 'heal') { if (run.lives >= E().maxLives) return { ok: false, reason: '불꽃이 가득합니다' }; run.lives = Math.min(E().maxLives, run.lives + E().shop.healLives); }
    else if (it.kind === 'upgrade') {
      if (!upgradeType || !run.deck.includes(upgradeType) || run.up.includes(upgradeType)) return { ok: false, reason: '강화할 탑을 골라 주세요' };
      run.up.push(upgradeType);
    }
    run.silver -= it.price;
    run.shopBought.push(itemId);
    return { ok: true };
  }
  const shopLeave = (run) => (run.phase === 'shop' ? advance(run) : { ok: false, reason: '상점이 아닙니다' });

  /** 쉼터: 'heal' 또는 { upgrade: type } */
  function rest(run, choice) {
    if (run.phase !== 'rest') return { ok: false, reason: '쉼터가 아닙니다' };
    if (choice === 'heal') run.lives = Math.min(E().maxLives, run.lives + E().rest.heal);
    else if (choice && choice.upgrade) {
      if (!run.deck.includes(choice.upgrade) || run.up.includes(choice.upgrade)) return { ok: false, reason: '강화할 수 없는 탑' };
      run.up.push(choice.upgrade);
    } else return { ok: false, reason: '쉬거나 강화를 고르세요' };
    return advance(run);
  }

  /** 원정 끝: 보상 계산 (공명석, 장신구 등급들) */
  function finish(run, win) {
    run.phase = 'done';
    run.result = win ? 'win' : 'lose';
    run.rewards = rewardsOf(run);
    return { ok: true, done: true, win };
  }
  function rewardsOf(run) {
    const R = E().reward;
    const crystals = run.floorsCleared * R.perFloor + (run.result === 'win' ? R.win : 0);
    const gear = ['common', 'rare', 'epic'].slice(0, run.actsCleared);
    return { crystals, gear };
  }
  /** 지금 몇 번째 층인가(전체): 1막 1층 = 1 */
  const depth = (run) => (run.act - 1) * (E().floors + 1) + run.floor;

  return { newRun, pickDeck, floorNodes, mods, choose, battleSetup, applyBattle, takeReward, advance, eventChoose, shopStock, shopBuy, shopLeave, rest, finish, rewardsOf, actMaps, depth, isBossFloor, actBossMap };
})();
