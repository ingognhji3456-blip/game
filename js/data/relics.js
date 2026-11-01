'use strict';

/* =========================================================
 * 유물 데이터 — 트리거/수정치 문법은 docs/ARCHITECTURE.md §4.5
 * ========================================================= */
(() => {
  const st = (status, value, target = 'self') => ({ type: 'applyStatus', status, value, target });

  const relics = {
    /* ---- 시작 ---- */
    emberCharm: {
      name: '잿불 부적', rarity: 'starter', icon: '🔥',
      desc: '전투에서 승리하면 체력을 6 회복합니다.',
      triggers: [{ on: 'battleEnd', effects: [{ type: 'heal', value: 6 }] }],
    },

    /* ---- 일반 ---- */
    oakShield: {
      name: '떡갈나무 방패', rarity: 'common', icon: '🪵',
      desc: '전투 시작 시 방어도를 8 얻습니다.',
      triggers: [{ on: 'battleStart', effects: [{ type: 'block', value: 8 }] }],
    },
    whetstone: {
      name: '숫돌', rarity: 'common', icon: '🪨',
      desc: '전투 시작 시 힘을 1 얻습니다.',
      triggers: [{ on: 'battleStart', effects: [st('strength', 1)] }],
    },
    travelBoots: {
      name: '여행자의 장화', rarity: 'common', icon: '👢',
      desc: '획득 시 최대 체력이 8 증가합니다.',
      onPickup: [{ type: 'gainMaxHp', value: 8 }],
    },
    luckyCoin: {
      name: '행운의 동전', rarity: 'common', icon: '🪙',
      desc: '전투에서 얻는 골드가 25% 증가합니다.',
      modifiers: { goldMultiplier: 0.25 },
    },
    wakingHerb: {
      name: '각성초', rarity: 'common', icon: '🌱',
      desc: '전투 첫 턴에 카드를 2장 더 뽑습니다.',
      triggers: [{ on: 'turnStart', turn: 1, effects: [{ type: 'draw', value: 2 }] }],
    },
    bronzeBell: {
      name: '청동 종', rarity: 'common', icon: '🔔',
      desc: '한 턴에 공격 카드를 3장 사용할 때마다 에너지를 1 얻습니다.',
      triggers: [{ on: 'cardPlayed', cardType: 'attack', every: 3, scope: 'turn', effects: [{ type: 'energy', value: 1 }] }],
    },
    bloodVial: {
      name: '피의 약병', rarity: 'common', icon: '🩸',
      desc: '전투 시작 시 체력을 3 회복합니다.',
      triggers: [{ on: 'battleStart', effects: [{ type: 'heal', value: 3 }] }],
    },
    thornBracelet: {
      name: '가시 팔찌', rarity: 'common', icon: '🌵',
      desc: '전투 시작 시 가시를 3 얻습니다.',
      triggers: [{ on: 'battleStart', effects: [st('thorns', 3)] }],
    },

    /* ---- 고급 ---- */
    starShuriken: {
      name: '별 표창', rarity: 'uncommon', icon: '⭐',
      desc: '한 턴에 스킬 카드를 3장 사용할 때마다 모든 적에게 피해를 6 줍니다.',
      triggers: [{ on: 'cardPlayed', cardType: 'skill', every: 3, scope: 'turn', effects: [{ type: 'damage', value: 6, target: 'allEnemies' }] }],
    },
    serpentFang: {
      name: '독사의 이빨', rarity: 'uncommon', icon: '🐍',
      desc: '전투 시작 시 모든 적에게 독을 3 부여합니다.',
      triggers: [{ on: 'battleStart', effects: [st('poison', 3, 'allEnemies')] }],
    },
    warDrum: {
      name: '전쟁 북', rarity: 'uncommon', icon: '🥁',
      desc: '3턴마다 턴 시작 시 힘을 1 얻습니다.',
      triggers: [{ on: 'turnStart', every: 3, effects: [st('strength', 1)] }],
    },
    mirrorShard: {
      name: '거울 조각', rarity: 'uncommon', icon: '🪞',
      desc: '전투 시작 시 결계를 1 얻습니다.',
      triggers: [{ on: 'battleStart', effects: [st('ward', 1)] }],
    },
    herbPouch: {
      name: '약초 주머니', rarity: 'uncommon', icon: '👝',
      desc: '획득 시 무작위 물약을 얻습니다. 물약이 나올 확률이 20% 증가합니다.',
      modifiers: { potionChanceBonus: 0.2 },
      onPickup: [{ type: 'gainPotion', potion: 'random' }],
    },
    campStone: {
      name: '모닥불 조약돌', rarity: 'uncommon', icon: '🏕️',
      desc: '휴식할 때 최대 체력의 15%를 추가로 회복합니다.',
      modifiers: { restHealBonusPct: 0.15 },
    },
    stoneHeart: {
      name: '석심', rarity: 'uncommon', icon: '🗿',
      desc: '턴이 끝날 때 방어도를 3 얻습니다.',
      triggers: [{ on: 'turnEnd', effects: [{ type: 'block', value: 3 }] }],
    },
    vampireFang: {
      name: '흡혈귀의 송곳니', rarity: 'uncommon', icon: '🦇',
      desc: '적을 처치할 때마다 체력을 4 회복합니다.',
      triggers: [{ on: 'enemyKilled', effects: [{ type: 'heal', value: 4 }] }],
    },

    /* ---- 희귀 ---- */
    phoenixFeather: {
      name: '불사조 깃털', rarity: 'rare', icon: '🪶',
      desc: '체력이 50% 이하일 때 전투를 시작하면 힘을 3, 재생을 5 얻습니다.',
      triggers: [{ on: 'battleStart', hpBelowPct: 0.5, effects: [st('strength', 3), st('regen', 5)] }],
    },
    kingsSeal: {
      name: '왕의 인장', rarity: 'rare', icon: '👑',
      desc: '카드 보상의 선택지가 1장 늘어납니다.',
      modifiers: { cardChoices: 1 },
    },
    stormOrb: {
      name: '폭풍 구슬', rarity: 'rare', icon: '🔮',
      desc: '뽑을 카드 더미를 다시 섞을 때마다 에너지를 1 얻고 카드를 1장 뽑습니다.',
      triggers: [{ on: 'shuffle', effects: [{ type: 'energy', value: 1 }, { type: 'draw', value: 1 }] }],
    },
    giantGauntlet: {
      name: '거인의 건틀릿', rarity: 'rare', icon: '🧤',
      desc: '공격 카드를 사용할 때마다 20% 확률로 힘을 1 얻습니다.',
      triggers: [{ on: 'cardPlayed', cardType: 'attack', chance: 0.2, effects: [st('strength', 1)] }],
    },
    shadowCloak: {
      name: '그림자 망토', rarity: 'rare', icon: '🧥',
      desc: '공격으로 체력을 잃을 때마다 방어도를 3 얻습니다.',
      triggers: [{ on: 'playerHurt', effects: [{ type: 'block', value: 3 }] }],
    },

    /* ---- 상점 ---- */
    merchantScale: {
      name: '상인의 저울', rarity: 'shop', icon: '⚖️',
      desc: '상점의 모든 가격이 20% 저렴해집니다.',
      modifiers: { shopDiscountPct: 0.2 },
    },
    potionBelt: {
      name: '물약 허리띠', rarity: 'shop', icon: '🎒',
      desc: '물약 슬롯이 2칸 늘어납니다.',
      modifiers: { potionSlots: 2 },
    },

    /* ---- 이벤트 ---- */
    cursedIdol: {
      name: '저주받은 우상', rarity: 'event', icon: '🪆',
      desc: '전투 시작 시 힘을 2 얻습니다. 획득 시 저주 「의심」을 덱에 추가합니다.',
      triggers: [{ on: 'battleStart', effects: [st('strength', 2)] }],
      onPickup: [{ type: 'addCurse', card: 'doubt' }],
    },

    /* ---- 보스 ---- */
    abyssHeart: {
      name: '심연의 심장', rarity: 'boss', icon: '🖤',
      desc: '매 턴 에너지를 1 더 얻습니다. 휴식처에서 체력을 회복할 수 없습니다.',
      modifiers: { maxEnergy: 1, restHealDisabled: true },
    },
    sunCore: {
      name: '태양핵', rarity: 'boss', icon: '☀️',
      desc: '매 턴 에너지를 1 더 얻습니다. 전투 시작 시 「현기증」 2장이 뽑을 카드 더미에 섞여 들어갑니다.',
      modifiers: { maxEnergy: 1 },
      triggers: [{ on: 'battleStart', effects: [{ type: 'addCard', card: 'dazed', count: 2, to: 'drawPile' }] }],
    },
    hungeringBlade: {
      name: '굶주린 칼날', rarity: 'boss', icon: '🗡️',
      desc: '매 턴 에너지를 1 더 얻습니다. 턴이 시작될 때마다 체력을 1 잃습니다.',
      modifiers: { maxEnergy: 1 },
      triggers: [{ on: 'turnStart', effects: [{ type: 'loseHp', value: 1 }] }],
    },
    ancientTome: {
      name: '고대의 서', rarity: 'boss', icon: '📖',
      desc: '매 턴 에너지를 1 더 얻습니다. 카드 보상의 선택지가 1장 줄어듭니다.',
      modifiers: { maxEnergy: 1, cardChoices: -1 },
    },
    starChart: {
      name: '별자리 지도', rarity: 'boss', icon: '🗺️',
      desc: '매 턴 카드를 1장 더 뽑습니다. 전투에서 얻는 골드가 50% 줄어듭니다.',
      modifiers: { handSize: 1, goldMultiplier: -0.5 },
    },
  };

  for (const [id, relic] of Object.entries(relics)) relic.id = id;
  CB.data.relics = relics;
})();
