'use strict';

/* =========================================================
 * 탑 뽑기 — 탑은 뽑기로만 얻고, 같은 탑이 또 나오면 그 탑이 강화됩니다.
 * 설계: DESIGN.md §11.5 (2026-11-10 추가·개정)
 *
 *  - 기본 탑 3종(불씨 궁수탑·바위 병영·서리 결정탑)은 처음부터 가지고 있음
 *  - 스테이지가 열리면 그 스테이지의 새 탑이 **뽑기에 들어갈 뿐**(확정으로 주지 않음)
 *  - 공명석으로 뽑기: 1회 100, 10회 900 (10회는 희귀 이상 하나 확정 — 뽑기에 희귀가 있을 때)
 *  - 등급: 일반 60% · 희귀 30% · 영웅 10%. 뽑기에 아직 없는 등급의 몫은 있는 등급에 비율대로 나눔
 *  - 천장: 뽑기에 영웅 탑이 들어온 뒤 30회 안에 영웅 확정
 *  - 중복: 그 탑 강화 +1 (최대 +5). +5에서 한 번 더 나오면 **최종 강화**(2026-11-11 개정: 예전엔 공명석 30 돌려받음)
 *  - 최종 강화한 탑은 뽑기에서 빠짐 (그 몫의 확률은 남은 탑에 나눔). 10회 도중에 최종이 되면 그 뒤로 바로 빠짐
 *  - 강화 효과: 단계마다 공격력(지원 탑은 지원 효과, 병영은 병사, 광산은 수입) +6%, 최종 강화는 +50%
 *
 * 순수 함수(무작위는 rng를 받아 씀) — 시험에서 결과를 정할 수 있게.
 * pool = 지금 뽑기에 들어 있는 탑 목록 (진행도가 정해서 넘김)
 * ========================================================= */
RG.gacha = (() => {
  const D = () => RG.data;

  const BASIC = ['ember_archer', 'stone_barracks', 'frost_crystal'];
  const RARITY = {
    ember_archer: 'common', stone_barracks: 'common', frost_crystal: 'common', flame_mortar: 'common', crystal_mine: 'common', sanctuary: 'common',
    winter_bell: 'rare', quake_hammer: 'rare', lightning_rod: 'rare', forge: 'rare', ice_ballista: 'rare', gale_cannon: 'rare',
    shadow_snare: 'epic', sun_lens: 'epic', hex_spire: 'epic', radiance_spire: 'epic', void_orb: 'epic', dynamo: 'epic',
    // 2차 6종 (2026-11-11)
    flame_jet: 'common', thorn_garden: 'common', icicle_cloud: 'rare', thunder_cloud: 'rare', lighthouse: 'epic', dread_bell: 'epic',
  };
  const ORDER = ['common', 'rare', 'epic'];
  const RARITIES = {
    common: { name: '일반', rate: 0.6, color: '#c9c3d8' },
    rare: { name: '희귀', rate: 0.3, color: '#5fb4ff' },
    epic: { name: '영웅', rate: 0.1, color: '#ffc44a' },
  };
  const COST = { one: 100, ten: 900 };
  const MAX_RANK = 5;
  const RANK_PCT = 0.06;
  /** 최종 강화 단계 (+5 다음) 와 그 효과 */
  const FINAL_RANK = MAX_RANK + 1;
  const FINAL_BONUS = 0.5;
  /** (안전장치) 최종 강화한 탑이 어떻게든 또 나오면 돌려줄 공명석 — 정상이라면 뽑기에서 빠져 있어 나오지 않음 */
  const REFUND = 30;
  const PITY = 30;
  const START_CRYSTALS = 100;
  /** 판 결과로 얻는 공명석 */
  const REWARD = { firstClear: 100, perStar: 30, win: 15, lose: 5, endlessWave: 4 };
  /** (예전 판의) 새 탑 확정권 한 장을 공명석으로 바꿀 때 */
  const TICKET_TO_CRYSTALS = COST.one;

  const rarityOf = (t) => RARITY[t] || 'common';
  const allTowers = () => D().towerOrder.filter((t) => D().towers[t]);
  const poolOf = (pool) => (pool ? pool : allTowers());
  const isFinal = (rank) => (rank || 0) >= FINAL_RANK;
  /** 이 상태에서 뽑을 수 있는 탑 (최종 강화한 탑은 뺌) */
  const livePool = (state, pool) => poolOf(pool).filter((t) => !(state.owned && isFinal(state.owned[t])));

  /** 이 뽑기에서 실제 등급 확률: 뽑기에 없는 등급의 몫을 있는 등급에 비율대로 나눔 */
  function ratesFor(pool) {
    const p = poolOf(pool);
    const have = ORDER.filter((r) => p.some((t) => rarityOf(t) === r));
    const sum = have.reduce((s, r) => s + RARITIES[r].rate, 0) || 1;
    const out = { common: 0, rare: 0, epic: 0 };
    for (const r of have) out[r] = RARITIES[r].rate / sum;
    return out;
  }

  /** 등급 하나 고르기 (floor: 최소 등급 — 뽑기에 그 등급 이상이 있을 때만) */
  function rollRarity(rng, floor, pool) {
    const rates = ratesFor(pool);
    const r = rng();
    let pick = 'common';
    let acc = 0;
    for (const k of ['epic', 'rare', 'common']) {
      if (!rates[k]) continue;
      acc += rates[k];
      if (r < acc) { pick = k; break; }
      pick = k;
    }
    if (floor === 'epic' && rates.epic) return 'epic';
    if (floor === 'rare' && pick === 'common' && (rates.rare || rates.epic)) return rates.rare ? 'rare' : 'epic';
    return pick;
  }

  /** 등급 안에서 탑 하나 (뽑기에 든 탑 중 고르게) */
  function rollTower(rng, rarity, pool) {
    const list = poolOf(pool).filter((t) => rarityOf(t) === rarity);
    if (!list.length) return null;
    return list[Math.floor(rng() * list.length) % list.length];
  }

  /**
   * 뽑기 실행. state = { owned: {type: rank}, crystals, pity }
   * kind: 'one' | 'ten'.  pool: 지금 뽑기에 든 탑.
   * 반환: { ok, reason, results: [{ type, rarity, isNew, rank, refund }] } — state를 바꿉니다(호출한 쪽이 저장).
   */
  function pull(state, kind, rng = Math.random, pool = null) {
    const cost = COST[kind];
    if (!cost) return { ok: false, reason: '알 수 없는 뽑기' };
    let live = livePool(state, pool);
    if (!live.length) return { ok: false, reason: '뽑기에 남은 탑이 없습니다 — 모두 최종 강화했어요!' };
    if ((state.crystals || 0) < cost) return { ok: false, reason: `공명석이 부족합니다 (${cost} 필요)` };
    state.crystals -= cost;
    const n = kind === 'ten' ? 10 : 1;
    const results = [];
    let gotRare = false;
    let rolled = 0;
    for (let i = 0; i < n && live.length; i++) {
      const rates = ratesFor(live);
      // 천장은 뽑기에 영웅 탑이 있을 때만 셈
      if (rates.epic) state.pity = (state.pity || 0) + 1;
      let floor = null;
      if (rates.epic && state.pity >= PITY) floor = 'epic';
      else if (kind === 'ten' && i === n - 1 && !gotRare) floor = 'rare';
      const rarity = rollRarity(rng, floor, live);
      const type = rollTower(rng, rarity, live);
      rolled++;
      if (!type) continue;
      if (rarity === 'epic') state.pity = 0;
      if (rarity !== 'common') gotRare = true;
      const r = grant(state, type);
      results.push(r);
      if (r.isFinal) live = live.filter((t) => t !== type); // 최종 강화 → 이 뽑기 안에서도 바로 빠짐
    }
    // 10회 도중에 뽑을 탑이 다 떨어지면 못 뽑은 만큼 공명석을 돌려줌
    let returned = 0;
    if (rolled < n) { returned = Math.round((cost * (n - rolled)) / n); state.crystals += returned; }
    return { ok: true, results, returned };
  }

  /** 탑 하나를 받음: 없으면 새로, 있으면 강화 +1, +5에서 또 나오면 최종 강화 */
  function grant(state, type) {
    const rarity = rarityOf(type);
    if (!(type in state.owned)) { state.owned[type] = 0; return { type, rarity, isNew: true, rank: 0, refund: 0, isFinal: false }; }
    const cur = state.owned[type];
    if (cur < MAX_RANK) { state.owned[type] = cur + 1; return { type, rarity, isNew: false, rank: cur + 1, refund: 0, isFinal: false }; }
    if (cur === MAX_RANK) { state.owned[type] = FINAL_RANK; return { type, rarity, isNew: false, rank: FINAL_RANK, refund: 0, isFinal: true }; }
    state.crystals = (state.crystals || 0) + REFUND;
    return { type, rarity, isNew: false, rank: FINAL_RANK, refund: REFUND, isFinal: false };
  }

  /** 강화 단계에 따른 배율 (1 + 단계 × 6%, 최종 강화는 1 + 50%) */
  const rankMult = (rank) => (isFinal(rank) ? 1 + FINAL_BONUS : 1 + Math.max(0, Math.min(MAX_RANK, rank || 0)) * RANK_PCT);
  /** 강화 단계 표시 글 (+3 / 최종) */
  const rankLabel = (rank) => (isFinal(rank) ? '최종' : `+${rank || 0}`);

  /** 판 결과로 얻는 공명석 계산 (기록 전 상태 기준) */
  function rewardFor({ result, mode, firstClear, newStars, endlessGain }) {
    let crystals = 0;
    const lines = [];
    if (mode === 'endless') {
      if (endlessGain > 0) { crystals += endlessGain * REWARD.endlessWave; lines.push([`최고 기록 +${endlessGain}웨이브`, endlessGain * REWARD.endlessWave]); }
    } else if (result === 'win') { crystals += REWARD.win; lines.push(['승리', REWARD.win]); } else { crystals += REWARD.lose; lines.push(['참가', REWARD.lose]); }
    if (firstClear) { crystals += REWARD.firstClear; lines.push(['첫 클리어', REWARD.firstClear]); }
    if (newStars > 0) { crystals += newStars * REWARD.perStar; lines.push([`새 별 ★${newStars}`, newStars * REWARD.perStar]); }
    return { crystals, lines };
  }

  return { BASIC, RARITY, RARITIES, ORDER, COST, MAX_RANK, RANK_PCT, FINAL_RANK, FINAL_BONUS, REFUND, PITY, START_CRYSTALS, REWARD, TICKET_TO_CRYSTALS, rarityOf, ratesFor, rollRarity, rollTower, pull, grant, rankMult, rankLabel, isFinal, livePool, rewardFor };
})();
