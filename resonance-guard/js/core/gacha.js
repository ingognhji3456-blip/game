'use strict';

/* =========================================================
 * 탑 뽑기 — 탑은 뽑기로만 얻고, 같은 탑이 또 나오면 그 탑이 강화됩니다.
 * 설계: DESIGN.md §11.5 (2026-11-10 추가)
 *
 *  - 기본 탑 3종(불씨 궁수탑·바위 병영·서리 결정탑)은 처음부터 가지고 있음
 *  - 공명석으로 뽑기: 1회 100, 10회 900 (10회는 희귀 이상 하나 확정)
 *  - 등급: 일반 60% · 희귀 30% · 영웅 10%, 30회 안에 영웅 확정(천장)
 *  - 중복: 그 탑 강화 +1 (최대 +5). +5에서 또 나오면 공명석 30을 돌려받음
 *  - 강화 효과: 단계마다 공격력(지원 탑은 지원 효과, 광산은 수입) +6%
 *  - 새 탑 확정권: 새 탑이 나오던 맵에 닿으면 1장 — 아직 없는 탑 중에서만 뽑음
 *
 * 순수 함수(무작위는 rng를 받아 씀) — 시험에서 결과를 정할 수 있게.
 * ========================================================= */
RG.gacha = (() => {
  const D = () => RG.data;

  const BASIC = ['ember_archer', 'stone_barracks', 'frost_crystal'];
  const RARITY = {
    ember_archer: 'common', stone_barracks: 'common', frost_crystal: 'common', flame_mortar: 'common', crystal_mine: 'common', sanctuary: 'common',
    winter_bell: 'rare', quake_hammer: 'rare', lightning_rod: 'rare', forge: 'rare', ice_ballista: 'rare', gale_cannon: 'rare',
    shadow_snare: 'epic', sun_lens: 'epic', hex_spire: 'epic', radiance_spire: 'epic', void_orb: 'epic', dynamo: 'epic',
  };
  const RARITIES = {
    common: { name: '일반', rate: 0.6, color: '#c9c3d8' },
    rare: { name: '희귀', rate: 0.3, color: '#5fb4ff' },
    epic: { name: '영웅', rate: 0.1, color: '#ffc44a' },
  };
  const COST = { one: 100, ten: 900 };
  const MAX_RANK = 5;
  const RANK_PCT = 0.06;
  const REFUND = 30;
  const PITY = 30;
  const START_CRYSTALS = 100;
  /** 판 결과로 얻는 공명석 */
  const REWARD = { firstClear: 100, perStar: 30, win: 15, lose: 5, endlessWave: 4 };

  const rarityOf = (t) => RARITY[t] || 'common';

  /** 등급 하나 고르기 (pity: 천장까지 남은 수가 0이면 영웅, floor: 최소 등급) */
  function rollRarity(rng, floor) {
    let r = rng();
    const order = ['epic', 'rare', 'common'];
    let pick = 'common';
    let acc = 0;
    for (const k of order) { acc += RARITIES[k].rate; if (r < acc) { pick = k; break; } }
    if (floor === 'rare' && pick === 'common') pick = 'rare';
    if (floor === 'epic') pick = 'epic';
    return pick;
  }

  /** 등급 안에서 탑 하나 (onlyNew: 가진 것 제외, 그 등급에 없으면 다른 등급으로) */
  function rollTower(rng, rarity, owned, onlyNew) {
    const all = D().towerOrder.filter((t) => D().towers[t]);
    const ok = (t) => !onlyNew || !(t in owned);
    let pool = all.filter((t) => rarityOf(t) === rarity && ok(t));
    if (!pool.length) {
      // 그 등급에 남은 새 탑이 없으면: 가까운 등급부터
      const near = { epic: ['rare', 'common'], rare: ['common', 'epic'], common: ['rare', 'epic'] }[rarity];
      for (const k of near) { pool = all.filter((t) => rarityOf(t) === k && ok(t)); if (pool.length) break; }
    }
    if (!pool.length) return null;
    return pool[Math.floor(rng() * pool.length) % pool.length];
  }

  /**
   * 뽑기 실행. state = { owned: {type: rank}, crystals, tickets, pity }
   * kind: 'one' | 'ten' | 'ticket'.  반환: { ok, reason, results: [{ type, rarity, isNew, rank, refund }] }
   * state를 바꿉니다(호출한 쪽이 저장).
   */
  function pull(state, kind, rng = Math.random) {
    const n = kind === 'ten' ? 10 : 1;
    if (kind === 'ticket') {
      if ((state.tickets || 0) <= 0) return { ok: false, reason: '새 탑 확정권이 없습니다' };
      if (D().towerOrder.every((t) => t in state.owned)) return { ok: false, reason: '이미 모든 탑을 가지고 있습니다' };
    } else {
      const cost = COST[kind];
      if ((state.crystals || 0) < cost) return { ok: false, reason: `공명석이 부족합니다 (${cost} 필요)` };
      state.crystals -= cost;
    }
    if (kind === 'ticket') state.tickets -= 1;
    const results = [];
    let gotRare = false;
    for (let i = 0; i < n; i++) {
      state.pity = (state.pity || 0) + 1;
      let floor = null;
      if (state.pity >= PITY) floor = 'epic';
      else if (kind === 'ten' && i === n - 1 && !gotRare) floor = 'rare';
      const rarity = rollRarity(rng, floor);
      const type = rollTower(rng, rarity, state.owned, kind === 'ticket');
      if (!type) continue;
      const realRarity = rarityOf(type);
      if (realRarity === 'epic') state.pity = 0;
      if (realRarity !== 'common') gotRare = true;
      results.push(grant(state, type));
    }
    return { ok: true, results };
  }

  /** 탑 하나를 받음: 없으면 새로, 있으면 강화 +1, 최대면 공명석 돌려받음 */
  function grant(state, type) {
    const rarity = rarityOf(type);
    if (!(type in state.owned)) { state.owned[type] = 0; return { type, rarity, isNew: true, rank: 0, refund: 0 }; }
    if (state.owned[type] < MAX_RANK) { state.owned[type] += 1; return { type, rarity, isNew: false, rank: state.owned[type], refund: 0 }; }
    state.crystals = (state.crystals || 0) + REFUND;
    return { type, rarity, isNew: false, rank: MAX_RANK, refund: REFUND };
  }

  /** 강화 단계에 따른 배율 (1 + 단계 × 6%) */
  const rankMult = (rank) => 1 + Math.max(0, Math.min(MAX_RANK, rank || 0)) * RANK_PCT;

  /** 판 결과로 얻는 공명석과 확정권 계산 (기록 전 상태 기준) */
  function rewardFor({ result, mode, firstClear, newStars, endlessGain, nextNewTowers }) {
    let crystals = 0;
    const lines = [];
    if (mode === 'endless') {
      if (endlessGain > 0) { crystals += endlessGain * REWARD.endlessWave; lines.push([`최고 기록 +${endlessGain}웨이브`, endlessGain * REWARD.endlessWave]); }
    } else if (result === 'win') { crystals += REWARD.win; lines.push(['승리', REWARD.win]); } else { crystals += REWARD.lose; lines.push(['참가', REWARD.lose]); }
    if (firstClear) { crystals += REWARD.firstClear; lines.push(['첫 클리어', REWARD.firstClear]); }
    if (newStars > 0) { crystals += newStars * REWARD.perStar; lines.push([`새 별 ★${newStars}`, newStars * REWARD.perStar]); }
    const tickets = firstClear ? (nextNewTowers || []).filter((t) => !BASIC.includes(t)).length : 0;
    return { crystals, tickets, lines };
  }

  return { BASIC, RARITY, RARITIES, COST, MAX_RANK, RANK_PCT, REFUND, PITY, START_CRYSTALS, REWARD, rarityOf, rollRarity, rollTower, pull, grant, rankMult, rewardFor };
})();
