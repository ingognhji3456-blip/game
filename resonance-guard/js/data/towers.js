'use strict';

/* =========================================================
 * 탑 18종 — 설계: docs/design/towers.md
 * 필드 뜻: docs/ARCHITECTURE.md §3.2
 * 각 단계(spec)는 그 단계의 전체 값을 적습니다(상속 없음). cost = 그 단계로 가는 비용.
 * ========================================================= */

RG.data.towers = {
  /* ===================== 🔥 불 ===================== */
  ember_archer: {
    name: '불씨 궁수탑', element: 'fire', role: 'attack', targets: 'both', kind: 'arrow', unlock: '1-1',
    desc: '불붙인 화살을 빠르게 쏩니다. 어디에 세워도 제 몫을 합니다.',
    levels: [
      { cost: 70, range: 3.0, interval: 0.85, damage: 6, projSpeed: 10, onHit: { burn: { dps: 1.5, dur: 2 } } },
      { cost: 80, range: 3.2, interval: 0.8, damage: 9.5, projSpeed: 10, onHit: { burn: { dps: 2.5, dur: 2 } } },
      { cost: 130, range: 3.4, interval: 0.75, damage: 15, projSpeed: 11, onHit: { burn: { dps: 4, dur: 2 } } },
    ],
    branches: {
      A: {
        id: 'ember_sniper', name: '화염 저격대', desc: '사거리가 길고 한 발이 매우 셉니다. 치명타 25%. 보스·정예용.',
        cost: 260, range: 5.5, interval: 1.6, damage: 90, projSpeed: 16, crit: { chance: 0.25, mult: 2 }, onHit: { burn: { dps: 8, dur: 2 } },
      },
      B: {
        id: 'ember_volley', name: '연사 궁수대', desc: '한 번에 서로 다른 적 셋에게 쏘고 화상이 강해집니다. 떼용.',
        cost: 250, range: 3.6, interval: 0.7, damage: 18, projSpeed: 11, multishot: 3, onHit: { burn: { dps: 6, dur: 2.5 } },
      },
    },
  },

  flame_mortar: {
    name: '화염 박격포', element: 'fire', role: 'attack', targets: 'ground', kind: 'mortar', unlock: '1-3',
    desc: '포탄이 떨어진 곳을 폭발과 불바다로 덮습니다. 빠른 적은 피할 수 있습니다.',
    levels: [
      { cost: 100, range: 3.4, minRange: 1.0, interval: 2.6, damage: 22, flight: 0.9, splash: 0.9, zone: { kind: 'fire', radius: 0.7, dur: 2, dps: 4 } },
      { cost: 110, range: 3.4, minRange: 1.0, interval: 2.4, damage: 34, flight: 0.9, splash: 1.0, zone: { kind: 'fire', radius: 0.7, dur: 2, dps: 6 } },
      { cost: 160, range: 3.6, minRange: 1.0, interval: 2.2, damage: 52, flight: 0.85, splash: 1.1, zone: { kind: 'fire', radius: 0.75, dur: 2, dps: 9 } },
    ],
    branches: {
      A: {
        id: 'lava_catapult', name: '용암 투석기', desc: '불바다가 넓고 오래 남으며, 그 위의 적은 갑옷이 녹습니다(−20%p).',
        cost: 300, range: 3.8, minRange: 1.0, interval: 2.4, damage: 80, flight: 0.9, splash: 1.2, zone: { kind: 'fire', radius: 1.1, dur: 4, dps: 20, meltArmor: 0.2 },
      },
      B: {
        id: 'triple_mortar', name: '연발 포대', desc: '포탄 세 발을 흩뿌립니다.',
        cost: 290, range: 3.6, minRange: 1.0, interval: 2.4, damage: 50, flight: 0.8, splash: 1.0, shells: 3, spread: 0.9, zone: { kind: 'fire', radius: 0.7, dur: 2, dps: 10 },
      },
    },
  },

  forge: {
    name: '대장간', element: 'fire', role: 'support', targets: null, kind: 'none', unlock: '2-4',
    desc: '이웃한 8칸의 탑 피해를 높입니다. 직접 공격하지 않습니다.',
    levels: [
      { cost: 90, aura: { damagePct: 0.15 } },
      { cost: 100, aura: { damagePct: 0.22 } },
      { cost: 150, aura: { damagePct: 0.30 } },
    ],
    branches: {
      A: { id: 'blast_furnace', name: '용광로', desc: '피해 보너스가 커지고, 이웃 탑의 공격에 화상을 더합니다.', cost: 260, aura: { damagePct: 0.38, burnOnHit: { pct: 0.25, dur: 3 } } },
      B: { id: 'armory', name: '무기고', desc: '피해 보너스와 함께 이웃 탑의 치명타 확률을 높입니다.', cost: 260, aura: { damagePct: 0.35, critChance: 0.12 } },
    },
  },

  /* ===================== ❄ 얼음 ===================== */
  frost_crystal: {
    name: '서리 결정탑', element: 'frost', role: 'attack', targets: 'both', kind: 'bolt', unlock: '1-2',
    desc: '서리탄으로 적을 느리게 만듭니다.',
    levels: [
      { cost: 75, range: 2.9, interval: 1.0, damage: 7, projSpeed: 9, onHit: { slow: { pct: 0.3, dur: 1.5 } } },
      { cost: 80, range: 3.0, interval: 0.95, damage: 11, projSpeed: 9, onHit: { slow: { pct: 0.35, dur: 1.6 } } },
      { cost: 130, range: 3.2, interval: 0.9, damage: 17, projSpeed: 9, onHit: { slow: { pct: 0.4, dur: 1.8 } } },
    ],
    branches: {
      A: {
        id: 'glacier_spire', name: '빙결 첨탑', desc: '세 번째 공격마다 대상을 얼립니다.',
        cost: 250, range: 3.4, interval: 0.9, damage: 24, projSpeed: 9, onHit: { slow: { pct: 0.45, dur: 2 }, freezeEvery: { n: 3, dur: 1.0 } },
      },
      B: {
        id: 'icicle_spire', name: '얼음 송곳탑', desc: '무거운 얼음 송곳을 쏩니다. 피해가 크고 보호막에 피해 2배.',
        cost: 240, range: 3.3, interval: 1.3, damage: 42, projSpeed: 10, shieldMult: 2, onHit: { slow: { pct: 0.3, dur: 1.5 } },
      },
    },
  },

  ice_ballista: {
    name: '빙창 쇠뇌', element: 'frost', role: 'attack', targets: 'both', kind: 'ballista', unlock: '2-5',
    desc: '사거리 끝까지 일직선 위의 모든 적을 꿰뚫습니다.',
    levels: [
      { cost: 110, range: 3.6, interval: 2.4, damage: 24, pierce: true },
      { cost: 120, range: 3.8, interval: 2.2, damage: 37, pierce: true },
      { cost: 170, range: 4.0, interval: 2.0, damage: 55, pierce: true },
    ],
    branches: {
      A: {
        id: 'frost_lancer', name: '빙창 사수', desc: '관통한 모든 적의 갑옷을 깎습니다.',
        cost: 300, range: 4.4, interval: 1.9, damage: 80, pierce: true, onHit: { shred: { pct: 0.15, max: 0.3, dur: 5 } },
      },
      B: {
        id: 'shatter_ballista', name: '빙하 파쇄기', desc: '감속·빙결된 적에게 피해 2배.',
        cost: 300, range: 4.2, interval: 2.0, damage: 76, pierce: true, onHit: { bonusVsSlowed: 1.0 },
      },
    },
  },

  winter_bell: {
    name: '겨울 종', element: 'frost', role: 'attack', targets: 'both', kind: 'pulse', unlock: '2-1',
    desc: '울릴 때마다 주변 모든 적을 느리게 만듭니다.',
    levels: [
      { cost: 90, range: 1.8, interval: 2.5, damage: 4, onHit: { slow: { pct: 0.35, dur: 2 } } },
      { cost: 90, range: 2.0, interval: 2.3, damage: 6, onHit: { slow: { pct: 0.4, dur: 2.2 } } },
      { cost: 140, range: 2.2, interval: 2.1, damage: 9, onHit: { slow: { pct: 0.45, dur: 2.4 } } },
    ],
    branches: {
      A: {
        id: 'still_bell', name: '정적의 종', desc: '파동이 적의 재생·치유·보호막 재생을 3초 동안 멈춥니다.',
        cost: 240, range: 2.4, interval: 2.0, damage: 14, onHit: { slow: { pct: 0.5, dur: 2.5 }, halt: 3 },
      },
      B: {
        id: 'frost_veil', name: '서리 장막', desc: '감속된 적이 받는 피해 +15%.',
        cost: 240, range: 2.6, interval: 2.0, damage: 12, onHit: { slow: { pct: 0.5, dur: 2.5 }, veil: { pct: 0.15, dur: 2.5 } },
      },
    },
  },

  /* ===================== ⚡ 폭풍 ===================== */
  lightning_rod: {
    name: '번개 막대', element: 'storm', role: 'attack', targets: 'both', kind: 'chain', unlock: '2-3',
    desc: '즉시 맞는 번개가 근처 적에게 튑니다.',
    levels: [
      { cost: 100, range: 2.8, interval: 1.4, damage: 14, chain: { count: 2, falloff: 0.25, radius: 1.6 } },
      { cost: 110, range: 2.8, interval: 1.3, damage: 20, chain: { count: 3, falloff: 0.25, radius: 1.6 } },
      { cost: 160, range: 3.0, interval: 1.2, damage: 30, chain: { count: 3, falloff: 0.2, radius: 1.7 } },
    ],
    branches: {
      A: {
        id: 'storm_spire', name: '폭풍 첨탑', desc: '연쇄 횟수가 크게 늘고 덜 약해집니다.',
        cost: 290, range: 3.0, interval: 1.1, damage: 38, chain: { count: 6, falloff: 0.12, radius: 1.9 },
      },
      B: {
        id: 'thunder_tower', name: '뇌격탑', desc: '한 대상에게 강한 벼락과 기절(보스 제외).',
        cost: 290, range: 3.2, interval: 1.6, damage: 140, onHit: { stun: { chance: 1, dur: 0.5 } },
      },
    },
  },

  gale_cannon: {
    name: '바람 포탑', element: 'storm', role: 'attack', targets: 'both', kind: 'gust', unlock: '3-1',
    desc: '맞은 지상 적을 길 뒤로 밀어냅니다. 비행 적에게 피해 2배.',
    levels: [
      { cost: 90, range: 2.8, interval: 1.6, damage: 5, projSpeed: 9, onHit: { knockback: 0.8, flyingMult: 2 } },
      { cost: 90, range: 2.8, interval: 1.5, damage: 8, projSpeed: 9, onHit: { knockback: 0.9, flyingMult: 2 } },
      { cost: 140, range: 3.0, interval: 1.4, damage: 12, projSpeed: 10, onHit: { knockback: 1.0, flyingMult: 2 } },
    ],
    branches: {
      A: {
        id: 'cyclone_tower', name: '회오리 탑', desc: '주기적으로 회오리를 보내 여러 적을 크게 밀어내고 잠시 띄웁니다.',
        cost: 270, range: 3.0, interval: 1.4, damage: 14, projSpeed: 10, onHit: { knockback: 1.0, flyingMult: 2 }, cyclone: { every: 7, dist: 1.6, lift: 1.5, radius: 1.0 },
      },
      B: {
        id: 'sky_hunter', name: '하늘 사냥꾼', desc: '비행 적만 공격합니다. 비행 피해 3배, 빠른 연사.',
        cost: 260, range: 3.6, interval: 0.45, damage: 22, projSpeed: 14, targets: 'air', onHit: { flyingMult: 3 },
      },
    },
  },

  dynamo: {
    name: '축전기', element: 'storm', role: 'support', targets: null, kind: 'none', unlock: '4-2',
    desc: '이웃한 8칸의 탑 공격 속도를 높입니다.',
    levels: [
      { cost: 100, aura: { speedPct: 0.12 } },
      { cost: 100, aura: { speedPct: 0.18 } },
      { cost: 150, aura: { speedPct: 0.25 } },
    ],
    branches: {
      A: { id: 'overcharge_coil', name: '과충전 코일', desc: '공격 속도 보너스가 커지고, 이웃 탑의 세 번째 공격마다 작은 번개가 덧붙습니다.', cost: 260, aura: { speedPct: 0.32, zapEvery: { n: 3, damage: 25 } } },
      B: { id: 'discharge_coil', name: '방전 코일', desc: '공격 속도 보너스와 함께, 스스로 주기적으로 주변 적에게 방전합니다.', cost: 260, aura: { speedPct: 0.25 }, discharge: { every: 2.0, damage: 40, radius: 1.8 } },
    },
  },

  /* ===================== 🪨 대지 ===================== */
  stone_barracks: {
    name: '바위 병영', element: 'earth', role: 'barracks', targets: 'ground', kind: 'none', unlock: '1-1',
    desc: '돌 병사가 길을 막고 적을 붙잡아 싸웁니다. 집결지를 옮길 수 있습니다.',
    levels: [
      { cost: 80, rallyRange: 2.4, soldiers: { count: 2, hp: 60, damage: 4, interval: 1.0, armor: 0.1, respawn: 10, block: 1 } },
      { cost: 90, rallyRange: 2.4, soldiers: { count: 2, hp: 95, damage: 6, interval: 1.0, armor: 0.15, respawn: 9, block: 1 } },
      { cost: 140, rallyRange: 2.6, soldiers: { count: 3, hp: 130, damage: 9, interval: 1.0, armor: 0.2, respawn: 8, block: 1 } },
    ],
    branches: {
      A: {
        id: 'granite_guard', name: '화강암 수호병', desc: '체력이 크게 늘고, 병사 하나가 둘을 붙잡으며 주변 적을 끌어당깁니다.',
        cost: 240, rallyRange: 2.6, soldiers: { count: 3, hp: 280, damage: 11, interval: 1.0, armor: 0.35, respawn: 8, block: 2, taunt: 1.3 },
      },
      B: {
        id: 'obsidian_blades', name: '흑요석 검사', desc: '공격력과 치명타가 크게 늘어납니다.',
        cost: 250, rallyRange: 2.6, soldiers: { count: 3, hp: 170, damage: 26, interval: 0.8, armor: 0.25, respawn: 8, block: 1, crit: { chance: 0.25, mult: 2 } },
      },
    },
  },

  quake_hammer: {
    name: '대지 망치', element: 'earth', role: 'attack', targets: 'ground', kind: 'pulse', unlock: '2-2',
    desc: '주변을 내려찍어 지상 적 모두에게 피해를 주고 갑옷을 깎습니다.',
    levels: [
      { cost: 110, range: 1.5, interval: 2.2, damage: 16, onHit: { shred: { pct: 0.1, max: 0.3, dur: 4 } } },
      { cost: 110, range: 1.5, interval: 2.1, damage: 25, onHit: { shred: { pct: 0.1, max: 0.3, dur: 4 } } },
      { cost: 160, range: 1.6, interval: 2.0, damage: 38, onHit: { shred: { pct: 0.1, max: 0.3, dur: 4 } } },
    ],
    branches: {
      A: {
        id: 'earthshaker', name: '지진 망치', desc: '내려찍을 때 짧게 기절시킵니다.',
        cost: 280, range: 1.7, interval: 1.9, damage: 60, onHit: { shred: { pct: 0.1, max: 0.3, dur: 4 }, stun: { chance: 1, dur: 0.4 } },
      },
      B: {
        id: 'thorn_field', name: '가시 대지', desc: '내려찍은 자리에 가시 지대가 생겨 지속 피해와 감속을 줍니다.',
        cost: 270, range: 1.7, interval: 2.0, damage: 55, onHit: { shred: { pct: 0.1, max: 0.3, dur: 4 } }, zone: { kind: 'thorn', radius: 1.4, dur: 3, dps: 14, slowPct: 0.2 },
      },
    },
  },

  crystal_mine: {
    name: '수정 광산', element: 'earth', role: 'economy', targets: null, kind: 'none', unlock: '1-4', noResonance: true,
    desc: '웨이브가 시작될 때마다 골드를 캡니다. 공격하지 않고 공명하지 않습니다.',
    levels: [
      { cost: 120, income: 18 },
      { cost: 110, income: 34 },
      { cost: 140, income: 52 },
    ],
    branches: {
      A: { id: 'deep_vein', name: '깊은 광맥', desc: '수입이 늘고, 웨이브마다 수입이 +4씩 더 늘어납니다(최대 +40).', cost: 240, income: 64, incomeGrowth: 4, incomeGrowthMax: 40 },
      B: { id: 'jeweler', name: '보석 세공소', desc: '수입과 함께, 주변에서 죽은 적의 현상금이 30% 늘어납니다.', cost: 230, income: 60, bountyAura: { radius: 2.0, pct: 0.3 } },
    },
  },

  /* ===================== ✨ 빛 ===================== */
  sun_lens: {
    name: '햇살 렌즈', element: 'light', role: 'attack', targets: 'both', kind: 'beam', unlock: '3-3',
    desc: '같은 적을 오래 비출수록 뜨거워지는 광선. (피해 = 초당 피해)',
    levels: [
      { cost: 120, range: 2.8, damage: 12, beam: { rampTime: 2.0, maxMult: 3, beams: 1 } },
      { cost: 120, range: 3.0, damage: 18, beam: { rampTime: 2.0, maxMult: 3, beams: 1 } },
      { cost: 170, range: 3.2, damage: 27, beam: { rampTime: 2.0, maxMult: 3, beams: 1 } },
    ],
    branches: {
      A: { id: 'solar_focus', name: '태양 집광기', desc: '더 빨리 뜨거워지고, 최대 5배까지 오릅니다.', cost: 300, range: 3.4, damage: 38, beam: { rampTime: 1.6, maxMult: 5, beams: 1 } },
      B: { id: 'prism_tower', name: '프리즘 탑', desc: '광선이 세 갈래로 나뉩니다(최대 2배).', cost: 290, range: 3.3, damage: 34, beam: { rampTime: 1.5, maxMult: 2, beams: 3 } },
    },
  },

  sanctuary: {
    name: '성소', element: 'light', role: 'support', targets: null, kind: 'none', unlock: '1-5',
    desc: '이웃 탑의 사거리를 늘리고, 숨은 적을 드러내고, 영웅과 병사를 치료합니다.',
    levels: [
      { cost: 90, aura: { rangePct: 0.12 }, detect: 2.2, heal: { hps: 3, radius: 2.2 } },
      { cost: 90, aura: { rangePct: 0.16 }, detect: 2.5, heal: { hps: 5, radius: 2.5 } },
      { cost: 140, aura: { rangePct: 0.2 }, detect: 2.8, heal: { hps: 7, radius: 2.8 } },
    ],
    branches: {
      A: { id: 'cathedral', name: '대성당', desc: '사거리 보너스와 탐지 범위가 커집니다.', cost: 240, aura: { rangePct: 0.3 }, detect: 4.0, heal: { hps: 8, radius: 3.0 } },
      B: { id: 'healing_spring', name: '치유의 샘', desc: '회복량이 크게 늘고, 범위 안 병사가 빨리 다시 나옵니다.', cost: 230, aura: { rangePct: 0.2 }, detect: 3.0, heal: { hps: 18, radius: 3.0 }, respawnMul: 0.5 },
    },
  },

  radiance_spire: {
    name: '광휘 탑', element: 'light', role: 'attack', targets: 'both', kind: 'pulse', unlock: '3-5',
    desc: '주기적인 섬광으로 주변 모두를 태우고 눈멀게 합니다.',
    levels: [
      { cost: 120, range: 2.0, interval: 3.2, damage: 26, onHit: { blind: 2 } },
      { cost: 120, range: 2.1, interval: 3.0, damage: 40, onHit: { blind: 2 } },
      { cost: 170, range: 2.3, interval: 2.8, damage: 60, onHit: { blind: 2 } },
    ],
    branches: {
      A: { id: 'dawn_spire', name: '일출 탑', desc: '섬광이 더 세고 자주 터집니다.', cost: 290, range: 2.5, interval: 2.2, damage: 95, onHit: { blind: 2.5 } },
      B: { id: 'purifier', name: '정화의 탑', desc: '섬광이 보호막을 걷어 내고 3초간 재생·치유를 막습니다.', cost: 280, range: 2.5, interval: 2.6, damage: 70, onHit: { blind: 2, purify: 3 } },
    },
  },

  /* ===================== 🌑 어둠 ===================== */
  hex_spire: {
    name: '저주 첨탑', element: 'dark', role: 'attack', targets: 'both', kind: 'bolt', unlock: '3-4',
    desc: '저주를 걸어 그 적이 받는 모든 피해를 늘립니다.',
    levels: [
      { cost: 100, range: 3.0, interval: 1.2, damage: 9, projSpeed: 8, onHit: { curse: { pct: 0.15, dur: 4 } } },
      { cost: 100, range: 3.0, interval: 1.1, damage: 14, projSpeed: 8, onHit: { curse: { pct: 0.18, dur: 4 } } },
      { cost: 150, range: 3.2, interval: 1.0, damage: 21, projSpeed: 9, onHit: { curse: { pct: 0.22, dur: 4 } } },
    ],
    branches: {
      A: { id: 'doom_spire', name: '파멸 첨탑', desc: '체력 12% 이하인 적을 즉시 처치합니다(보스 제외).', cost: 280, range: 3.2, interval: 1.0, damage: 30, projSpeed: 9, onHit: { curse: { pct: 0.3, dur: 4 }, execute: 0.12 } },
      B: { id: 'plague_spire', name: '역병 첨탑', desc: '저주받은 적이 죽으면 주변으로 저주가 퍼지고 피해를 줍니다.', cost: 270, range: 3.2, interval: 1.0, damage: 28, projSpeed: 9, onHit: { curse: { pct: 0.25, dur: 4 }, spreadCurse: { radius: 1.5, damage: 30 } } },
    },
  },

  void_orb: {
    name: '공허 구체', element: 'dark', role: 'attack', targets: 'both', kind: 'orb', unlock: '4-1',
    desc: '느린 구체가 떨어진 곳에 공허장을 만들어 적을 붙잡고 갉아먹습니다.',
    levels: [
      { cost: 110, range: 2.8, interval: 3.0, damage: 0, projSpeed: 3.5, zone: { kind: 'void', radius: 0.8, dur: 3, dps: 8, slowPct: 0.45 } },
      { cost: 110, range: 2.8, interval: 2.9, damage: 0, projSpeed: 3.5, zone: { kind: 'void', radius: 0.85, dur: 3, dps: 13, slowPct: 0.5 } },
      { cost: 160, range: 3.0, interval: 2.8, damage: 0, projSpeed: 3.8, zone: { kind: 'void', radius: 0.9, dur: 3, dps: 20, slowPct: 0.55 } },
    ],
    branches: {
      A: { id: 'black_hole', name: '블랙홀', desc: '공허장이 크고, 세고, 오래갑니다.', cost: 290, range: 3.0, interval: 3.0, damage: 0, projSpeed: 3.8, zone: { kind: 'void', radius: 1.3, dur: 4, dps: 34, slowPct: 0.7 } },
      B: { id: 'split_orb', name: '분열 구체', desc: '착탄하면 작은 공허장 셋으로 갈라집니다.', cost: 280, range: 3.0, interval: 2.8, damage: 0, projSpeed: 3.8, zones: 3, spread: 1.0, zone: { kind: 'void', radius: 0.7, dur: 3, dps: 20, slowPct: 0.55 } },
    },
  },

  shadow_snare: {
    name: '그림자 덫', element: 'dark', role: 'attack', targets: 'ground', kind: 'snare', unlock: '3-2',
    desc: '사거리 안의 길에 덫을 깔아 둡니다. 밟은 지상 적은 묶이고 피해를 받습니다.',
    levels: [
      { cost: 100, range: 2.6, interval: 3.5, snare: { maxTraps: 2, root: 1.4, damage: 20 } },
      { cost: 100, range: 2.6, interval: 3.2, snare: { maxTraps: 3, root: 1.6, damage: 32 } },
      { cost: 150, range: 2.8, interval: 3.0, snare: { maxTraps: 3, root: 1.8, damage: 48 } },
    ],
    branches: {
      A: { id: 'binding_chains', name: '속박의 사슬', desc: '덫이 주변 적 둘까지 함께 묶고, 속박이 길어집니다.', cost: 270, range: 2.8, interval: 2.8, snare: { maxTraps: 3, root: 2.6, damage: 60, extraTargets: 2, chainRadius: 1.2 } },
      B: { id: 'shadow_blades', name: '그림자 칼날', desc: '덫 피해가 크게 늘고 출혈을 남깁니다.', cost: 270, range: 2.8, interval: 2.6, snare: { maxTraps: 3, root: 1.6, damage: 140, bleed: { dps: 20, dur: 4 } } },
    },
  },
};

/** 설계서 순서 (도감·건설 메뉴 정렬용) */
RG.data.towerOrder = [
  'ember_archer', 'flame_mortar', 'forge',
  'frost_crystal', 'ice_ballista', 'winter_bell',
  'lightning_rod', 'gale_cannon', 'dynamo',
  'stone_barracks', 'quake_hammer', 'crystal_mine',
  'sun_lens', 'sanctuary', 'radiance_spire',
  'hex_spire', 'void_orb', 'shadow_snare',
];
