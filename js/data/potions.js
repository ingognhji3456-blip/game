'use strict';

/* =========================================================
 * 물약 데이터 — 전투 중에만 사용 가능
 * ========================================================= */
(() => {
  const st = (status, value, target) => ({ type: 'applyStatus', status, value, target });

  const potions = {
    firePotion: {
      name: '화염 물약', rarity: 'common', color: '#e8553f', shape: 'round', target: 'enemy',
      effects: [{ type: 'damage', value: 20 }], desc: '적 하나에게 피해를 20 줍니다.',
    },
    blockPotion: {
      name: '방패 물약', rarity: 'common', color: '#4f8fe0', shape: 'flask', target: 'self',
      effects: [{ type: 'block', value: 12 }], desc: '방어도를 12 얻습니다.',
    },
    healPotion: {
      name: '치유 물약', rarity: 'common', color: '#45c46b', shape: 'round', target: 'self',
      effects: [{ type: 'healPct', value: 0.25 }], desc: '최대 체력의 25%를 회복합니다.',
    },
    strengthPotion: {
      name: '힘의 물약', rarity: 'common', color: '#f08a2c', shape: 'vial', target: 'self',
      effects: [st('strength', 2, 'self')], desc: '힘을 2 얻습니다.',
    },
    swiftPotion: {
      name: '신속 물약', rarity: 'common', color: '#3cc9d6', shape: 'vial', target: 'self',
      effects: [{ type: 'draw', value: 3 }], desc: '카드를 3장 뽑습니다.',
    },
    energyPotion: {
      name: '활력 물약', rarity: 'uncommon', color: '#f2d43b', shape: 'flask', target: 'self',
      effects: [{ type: 'energy', value: 2 }], desc: '에너지를 2 얻습니다.',
    },
    poisonPotion: {
      name: '독 물약', rarity: 'common', color: '#7bbf2a', shape: 'round', target: 'enemy',
      effects: [st('poison', 8, 'enemy')], desc: '적 하나에게 독을 8 부여합니다.',
    },
    fearPotion: {
      name: '공포 물약', rarity: 'common', color: '#9b59d0', shape: 'vial', target: 'enemy',
      effects: [st('vulnerable', 3, 'enemy')], desc: '적 하나에게 취약을 3 부여합니다.',
    },
    weakPotion: {
      name: '쇠약 물약', rarity: 'common', color: '#8a8f9c', shape: 'vial', target: 'enemy',
      effects: [st('weak', 3, 'enemy')], desc: '적 하나에게 약화를 3 부여합니다.',
    },
    explosivePotion: {
      name: '폭발 물약', rarity: 'uncommon', color: '#ff7a1a', shape: 'round', target: 'allEnemies',
      effects: [{ type: 'damage', value: 10, target: 'allEnemies' }], desc: '모든 적에게 피해를 10 줍니다.',
    },
    dexPotion: {
      name: '민첩 물약', rarity: 'uncommon', color: '#2fb59a', shape: 'flask', target: 'self',
      effects: [st('dexterity', 2, 'self')], desc: '민첩을 2 얻습니다.',
    },
    regenPotion: {
      name: '재생 물약', rarity: 'uncommon', color: '#ff7eb6', shape: 'round', target: 'self',
      effects: [st('regen', 5, 'self')], desc: '재생을 5 얻습니다.',
    },
    wardPotion: {
      name: '결계 물약', rarity: 'rare', color: '#e8eefc', shape: 'flask', target: 'self',
      effects: [st('ward', 2, 'self')], desc: '결계를 2 얻습니다.',
    },
    forgePotion: {
      name: '단련의 물약', rarity: 'rare', color: '#d6a640', shape: 'vial', target: 'self',
      effects: [{ type: 'upgradeHand' }], desc: '손에 있는 모든 카드를 이번 전투 동안 강화합니다.',
    },
  };

  for (const [id, potion] of Object.entries(potions)) potion.id = id;
  CB.data.potions = potions;
})();
