'use strict';

/* =========================================================
 * 카드 데이터
 * 효과(effects) 문법은 docs/ARCHITECTURE.md §4.2 참고.
 * 설명 문구는 엔진이 효과를 보고 자동으로 만듭니다.
 * ========================================================= */
(() => {
  // 짧게 쓰기 위한 도우미
  const dmg = (value, extra = {}) => ({ type: 'damage', value, ...extra });
  const blk = (value) => ({ type: 'block', value });
  const st = (status, value, target = 'enemy') => ({ type: 'applyStatus', status, value, target });
  const self = (status, value) => st(status, value, 'self');
  const draw = (value) => ({ type: 'draw', value });
  const energy = (value) => ({ type: 'energy', value });

  const cards = {
    /* ---------------- 시작 카드 ---------------- */
    slash: {
      name: '베기', type: 'attack', rarity: 'starter', cost: 1, target: 'enemy', art: 'slash',
      effects: [dmg(6)],
      upgrade: { effects: [dmg(9)] },
    },
    guard: {
      name: '막기', type: 'skill', rarity: 'starter', cost: 1, target: 'self', art: 'shield',
      effects: [blk(5)],
      upgrade: { effects: [blk(8)] },
    },
    crushingBlow: {
      name: '내려찍기', type: 'attack', rarity: 'starter', cost: 2, target: 'enemy', art: 'heavyBlow',
      effects: [dmg(8), st('vulnerable', 2)],
      upgrade: { effects: [dmg(10), st('vulnerable', 3)] },
    },

    /* ---------------- 일반 ---------------- */
    twinFang: {
      name: '쌍아', type: 'attack', rarity: 'common', cost: 1, target: 'enemy', art: 'doubleSlash',
      effects: [dmg(4, { times: 2 })],
      upgrade: { effects: [dmg(6, { times: 2 })] },
    },
    sweepingCut: {
      name: '휩쓸기', type: 'attack', rarity: 'common', cost: 1, target: 'allEnemies', art: 'whirlwind',
      effects: [dmg(6, { target: 'allEnemies' })],
      upgrade: { effects: [dmg(9, { target: 'allEnemies' })] },
    },
    shieldSlam: {
      name: '방패 밀치기', type: 'attack', rarity: 'common', cost: 1, target: 'enemy', art: 'shieldBash',
      effects: [{ type: 'damageFromBlock' }],
      upgrade: { cost: 0 },
    },
    ironStance: {
      name: '철벽 자세', type: 'skill', rarity: 'common', cost: 2, target: 'self', art: 'tower',
      effects: [blk(13)],
      upgrade: { effects: [blk(17)] },
    },
    parryStrike: {
      name: '받아치기', type: 'attack', rarity: 'common', cost: 1, target: 'enemy', art: 'thrust',
      effects: [dmg(5), blk(5)],
      upgrade: { effects: [dmg(7), blk(7)] },
    },
    venomEdge: {
      name: '독날', type: 'attack', rarity: 'common', cost: 1, target: 'enemy', art: 'venomBlade',
      effects: [dmg(4), st('poison', 3)],
      upgrade: { effects: [dmg(5), st('poison', 5)] },
    },
    toxicCloud: {
      name: '독안개', type: 'skill', rarity: 'common', cost: 1, target: 'allEnemies', art: 'poison',
      effects: [st('poison', 4, 'allEnemies')],
      upgrade: { effects: [st('poison', 6, 'allEnemies')] },
    },
    quickStep: {
      name: '재빠른 발놀림', type: 'skill', rarity: 'common', cost: 1, target: 'self', art: 'feather',
      effects: [blk(5), draw(1)],
      upgrade: { effects: [blk(7), draw(1)] },
    },
    focus: {
      name: '정신 집중', type: 'skill', rarity: 'common', cost: 0, target: 'self', art: 'eye', exhaust: true,
      effects: [draw(2)],
      upgrade: { effects: [draw(3)] },
    },
    warCry: {
      name: '기합', type: 'skill', rarity: 'common', cost: 1, target: 'self', art: 'muscle', exhaust: true,
      effects: [self('strength', 2)],
      upgrade: { cost: 0 },
    },
    lunge: {
      name: '찌르기', type: 'attack', rarity: 'common', cost: 0, target: 'enemy', art: 'thrust',
      effects: [dmg(3), draw(1)],
      upgrade: { effects: [dmg(5), draw(1)] },
    },
    heavySwing: {
      name: '강철 휘두르기', type: 'attack', rarity: 'common', cost: 2, target: 'enemy', art: 'axe',
      effects: [dmg(15)],
      upgrade: { effects: [dmg(20)] },
    },
    flurry: {
      name: '연타', type: 'attack', rarity: 'common', cost: 1, target: 'enemy', art: 'fist',
      effects: [dmg(3, { bonusPer: { stat: 'cardsPlayedThisTurn', value: 2 } })],
      upgrade: { effects: [dmg(4, { bonusPer: { stat: 'cardsPlayedThisTurn', value: 3 } })] },
    },
    bandage: {
      name: '붕대 감기', type: 'skill', rarity: 'common', cost: 1, target: 'self', art: 'heart', exhaust: true,
      effects: [{ type: 'heal', value: 6 }],
      upgrade: { effects: [{ type: 'heal', value: 9 }] },
    },
    hamstring: {
      name: '발목 베기', type: 'attack', rarity: 'common', cost: 1, target: 'enemy', art: 'dagger',
      effects: [dmg(6), st('weak', 2)],
      upgrade: { effects: [dmg(8), st('weak', 3)] },
    },
    bracing: {
      name: '버티기', type: 'skill', rarity: 'common', cost: 1, target: 'self', art: 'armor',
      effects: [blk(6), self('nextTurnBlock', 4)],
      upgrade: { effects: [blk(8), self('nextTurnBlock', 6)] },
    },
    throwingKnife: {
      name: '투척 단검', type: 'attack', rarity: 'common', cost: 1, target: 'allEnemies', art: 'dagger',
      effects: [dmg(3, { times: 3, target: 'randomEnemy' })],
      upgrade: { effects: [dmg(4, { times: 3, target: 'randomEnemy' })] },
    },
    purge: {
      name: '정화', type: 'skill', rarity: 'common', cost: 1, target: 'self', art: 'moon',
      effects: [{ type: 'removeDebuffs' }, blk(7)],
      upgrade: { effects: [{ type: 'removeDebuffs' }, blk(11)] },
    },
    feint: {
      name: '견제', type: 'skill', rarity: 'common', cost: 1, target: 'enemy', art: 'spiral',
      effects: [st('weak', 2), blk(4)],
      upgrade: { effects: [st('weak', 3), blk(6)] },
    },
    fissure: {
      name: '균열', type: 'skill', rarity: 'common', cost: 0, target: 'enemy', art: 'crack', exhaust: true,
      effects: [st('vulnerable', 2)],
      upgrade: { effects: [st('vulnerable', 3)] },
    },

    /* ---------------- 고급 ---------------- */
    titanGrip: {
      name: '거인의 악력', type: 'power', rarity: 'uncommon', cost: 1, target: 'self', art: 'muscle',
      effects: [self('strength', 2)],
      upgrade: { effects: [self('strength', 3)] },
    },
    doubleEdge: {
      name: '양날 도끼', type: 'attack', rarity: 'uncommon', cost: 1, target: 'enemy', art: 'axe',
      effects: [dmg(13), { type: 'loseHp', value: 3 }],
      upgrade: { effects: [dmg(18), { type: 'loseHp', value: 3 }] },
    },
    steelSkin: {
      name: '강철 피부', type: 'power', rarity: 'uncommon', cost: 1, target: 'self', art: 'armor',
      effects: [self('plating', 3)],
      upgrade: { effects: [self('plating', 4)] },
    },
    fortify: {
      name: '방벽 강화', type: 'skill', rarity: 'uncommon', cost: 1, target: 'self', art: 'shield', exhaust: true,
      effects: [{ type: 'multiplyBlock', value: 2 }],
      upgrade: { exhaust: false },
    },
    thornMail: {
      name: '가시 갑옷', type: 'power', rarity: 'uncommon', cost: 1, target: 'self', art: 'thorns',
      effects: [self('thorns', 3)],
      upgrade: { effects: [self('thorns', 5)] },
    },
    agility: {
      name: '날렵함', type: 'power', rarity: 'uncommon', cost: 1, target: 'self', art: 'feather',
      effects: [self('dexterity', 2)],
      upgrade: { effects: [self('dexterity', 3)] },
    },
    plagueBloom: {
      name: '역병의 꽃', type: 'skill', rarity: 'uncommon', cost: 2, target: 'enemy', art: 'poison',
      effects: [st('poison', 10)],
      upgrade: { effects: [st('poison', 14)] },
    },
    corrode: {
      name: '부식', type: 'attack', rarity: 'uncommon', cost: 1, target: 'enemy', art: 'crack',
      effects: [dmg(4, { bonusPer: { stat: 'targetPoison', value: 1 } })],
      upgrade: { effects: [dmg(7, { bonusPer: { stat: 'targetPoison', value: 1 } })] },
    },
    bladeDance: {
      name: '칼춤', type: 'attack', rarity: 'uncommon', cost: 2, target: 'enemy', art: 'whirlwind',
      effects: [dmg(3, { times: 4 })],
      upgrade: { effects: [dmg(4, { times: 4 })] },
    },
    soulBurn: {
      name: '혼 태우기', type: 'attack', rarity: 'uncommon', cost: 1, target: 'enemy', art: 'fire',
      effects: [dmg(5, { bonusPer: { stat: 'exhaustCount', value: 3 } })],
      upgrade: { effects: [dmg(7, { bonusPer: { stat: 'exhaustCount', value: 4 } })] },
    },
    secondWind: {
      name: '숨 고르기', type: 'skill', rarity: 'uncommon', cost: 1, target: 'self', art: 'wind',
      effects: [blk(4), self('nextTurnEnergy', 2)],
      upgrade: { effects: [blk(7), self('nextTurnEnergy', 2)] },
    },
    bloodPact: {
      name: '피의 맹세', type: 'skill', rarity: 'uncommon', cost: 0, target: 'self', art: 'blood', exhaust: true,
      effects: [{ type: 'loseHp', value: 3 }, energy(2)],
      upgrade: { effects: [{ type: 'loseHp', value: 3 }, energy(3)] },
    },
    battleTrance: {
      name: '전투 몰입', type: 'skill', rarity: 'uncommon', cost: 1, target: 'self', art: 'eye',
      effects: [draw(3)],
      upgrade: { cost: 0 },
    },
    lifeDrain: {
      name: '흡혈 베기', type: 'attack', rarity: 'uncommon', cost: 2, target: 'enemy', art: 'blood', exhaust: true,
      effects: [dmg(12, { lifesteal: true })],
      upgrade: { effects: [dmg(16, { lifesteal: true })] },
    },
    wardSigil: {
      name: '수호 문양', type: 'skill', rarity: 'uncommon', cost: 1, target: 'self', art: 'star',
      effects: [self('ward', 1), blk(6)],
      upgrade: { effects: [self('ward', 2), blk(8)] },
    },
    rally: {
      name: '재정비', type: 'skill', rarity: 'uncommon', cost: 1, target: 'self', art: 'tower',
      effects: [blk(8), self('nextTurnDraw', 2)],
      upgrade: { effects: [blk(11), self('nextTurnDraw', 2)] },
    },
    ashCleaver: {
      name: '잿빛 참격', type: 'attack', rarity: 'uncommon', cost: 1, target: 'allEnemies', art: 'fire', exhaust: true,
      effects: [dmg(11, { target: 'allEnemies' })],
      upgrade: { effects: [dmg(15, { target: 'allEnemies' })] },
    },

    /* ---------------- 희귀 ---------------- */
    berserkerHeart: {
      name: '광전사의 심장', type: 'power', rarity: 'rare', cost: 3, target: 'self', art: 'blood',
      effects: [self('fervor', 2)],
      upgrade: { cost: 2 },
    },
    executioner: {
      name: '처형', type: 'attack', rarity: 'rare', cost: 3, target: 'enemy', art: 'heavyBlow',
      effects: [dmg(32)],
      upgrade: { effects: [dmg(44)] },
    },
    bastion: {
      name: '난공불락', type: 'power', rarity: 'rare', cost: 2, target: 'self', art: 'tower',
      effects: [self('fortress', 1), blk(6)],
      upgrade: { cost: 1 },
    },
    catalyst: {
      name: '촉매', type: 'skill', rarity: 'rare', cost: 1, target: 'enemy', art: 'skull', exhaust: true,
      effects: [{ type: 'multiplyStatus', status: 'poison', value: 2, target: 'enemy' }],
      upgrade: { effects: [{ type: 'multiplyStatus', status: 'poison', value: 3, target: 'enemy' }] },
    },
    miasma: {
      name: '독기 서린 숨', type: 'power', rarity: 'rare', cost: 2, target: 'self', art: 'skull',
      effects: [self('toxicAura', 2)],
      upgrade: { effects: [self('toxicAura', 3)] },
    },
    tempest: {
      name: '질풍 연참', type: 'attack', rarity: 'rare', cost: 2, target: 'enemy', art: 'wind',
      effects: [dmg(2, { times: 3, bonusPer: { stat: 'cardsPlayedThisTurn', value: 1 } })],
      upgrade: { effects: [dmg(3, { times: 3, bonusPer: { stat: 'cardsPlayedThisTurn', value: 2 } })] },
    },
    keenSense: {
      name: '예리한 감각', type: 'power', rarity: 'rare', cost: 1, target: 'self', art: 'eye',
      effects: [self('insight', 1)],
      upgrade: { innate: true },
    },
    surgingSpirit: {
      name: '솟구치는 기백', type: 'power', rarity: 'rare', cost: 2, target: 'self', art: 'bolt',
      effects: [self('surge', 1)],
      upgrade: { cost: 1 },
    },
    regenerate: {
      name: '재생의 숨결', type: 'skill', rarity: 'rare', cost: 2, target: 'self', art: 'heart', exhaust: true,
      effects: [self('regen', 7)],
      upgrade: { effects: [self('regen', 10)] },
    },
    moonlightSlash: {
      name: '월광참', type: 'attack', rarity: 'rare', cost: 2, target: 'allEnemies', art: 'moon',
      effects: [dmg(10, { target: 'allEnemies' }), st('weak', 2, 'allEnemies')],
      upgrade: { effects: [dmg(14, { target: 'allEnemies' }), st('weak', 3, 'allEnemies')] },
    },
    lastStand: {
      name: '배수진', type: 'skill', rarity: 'rare', cost: 2, target: 'self', art: 'shield', retain: true,
      effects: [blk(22)],
      upgrade: { effects: [blk(30)] },
    },
    eyeOfStorm: {
      name: '폭풍의 눈', type: 'skill', rarity: 'rare', cost: 1, target: 'self', art: 'star', exhaust: true,
      effects: [{ type: 'upgradeHand' }, draw(1)],
      upgrade: { cost: 0 },
    },

    /* ---------------- 상태이상 ---------------- */
    wound: {
      name: '상처', type: 'status', rarity: 'status', cost: 0, target: 'none', art: 'wound', unplayable: true,
      effects: [],
    },
    dazed: {
      name: '현기증', type: 'status', rarity: 'status', cost: 0, target: 'none', art: 'spiral',
      unplayable: true, ethereal: true, effects: [],
    },
    burn: {
      name: '화상', type: 'status', rarity: 'status', cost: 0, target: 'none', art: 'fire', unplayable: true,
      effects: [], onTurnEndInHand: [{ type: 'loseHp', value: 2 }],
    },

    /* ---------------- 저주 ---------------- */
    regret: {
      name: '후회', type: 'curse', rarity: 'curse', cost: 0, target: 'none', art: 'curse', unplayable: true,
      effects: [], onTurnEndInHand: [{ type: 'loseHp', value: 1 }],
    },
    doubt: {
      name: '의심', type: 'curse', rarity: 'curse', cost: 0, target: 'none', art: 'curse', unplayable: true,
      effects: [], onTurnEndInHand: [self('weak', 2)],
    },
    shackles: {
      name: '족쇄', type: 'curse', rarity: 'curse', cost: 0, target: 'none', art: 'curse', unplayable: true,
      effects: [],
    },
    decay: {
      name: '부패', type: 'curse', rarity: 'curse', cost: 0, target: 'none', art: 'skull', unplayable: true,
      effects: [], onTurnEndInHand: [self('frail', 2)],
    },
  };

  for (const [id, card] of Object.entries(cards)) card.id = id;
  CB.data.cards = cards;

  CB.data.starter = {
    hp: 70,
    gold: 99,
    maxEnergy: 3,
    handSize: 5,
    potionSlots: 3,
    deck: ['slash', 'slash', 'slash', 'slash', 'slash', 'guard', 'guard', 'guard', 'guard', 'crushingBlow'],
    relic: 'emberCharm',
  };
})();
