'use strict';

/* =========================================================
 * 탑 24종 (2차 6종은 맨 아래, 2026-11-11) — 설계: docs/design/towers.md
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
      { cost: 120, range: 2.2, interval: 3.2, damage: 32, onHit: { blind: 2 } },
      { cost: 120, range: 2.3, interval: 3.0, damage: 48, onHit: { blind: 2 } },
      { cost: 170, range: 2.5, interval: 2.8, damage: 72, onHit: { blind: 2 } },
    ],
    branches: {
      A: { id: 'dawn_spire', name: '일출 탑', desc: '섬광이 더 세고 자주 터집니다.', cost: 290, range: 2.7, interval: 2.2, damage: 110, onHit: { blind: 2.5 } },
      B: { id: 'purifier', name: '정화의 탑', desc: '섬광이 보호막을 걷어 내고 3초간 재생·치유를 막습니다.', cost: 280, range: 2.7, interval: 2.6, damage: 84, onHit: { blind: 2, purify: 3 } },
    },
  },

  /* ===================== 🌑 어둠 ===================== */
  hex_spire: {
    name: '저주 첨탑', element: 'dark', role: 'attack', targets: 'both', kind: 'bolt', unlock: '3-4',
    desc: '저주를 걸어 그 적이 받는 모든 피해를 늘립니다.',
    levels: [
      { cost: 100, range: 3.0, interval: 1.2, damage: 10, projSpeed: 8, onHit: { curse: { pct: 0.15, dur: 4 } } },
      { cost: 100, range: 3.0, interval: 1.1, damage: 16, projSpeed: 8, onHit: { curse: { pct: 0.18, dur: 4 } } },
      { cost: 150, range: 3.2, interval: 1.0, damage: 24, projSpeed: 9, onHit: { curse: { pct: 0.22, dur: 4 } } },
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

  /* ===================== ✦ 2차 6종 (2026-11-11) — 원소마다 하나, 새 공격 방식 ===================== */

  flame_jet: {
    name: '화염 분사기', element: 'fire', role: 'attack', targets: 'ground', kind: 'cone', unlock: '1-1',
    desc: '가장 앞선 적 쪽으로 부채꼴 불길을 짧은 간격으로 뿜어, 그 안의 지상 적을 모두 태웁니다. 사거리가 짧습니다.',
    levels: [
      { cost: 85, range: 1.8, interval: 0.5, damage: 3, cone: 60, onHit: { burn: { dps: 1.5, dur: 1.5 } } },
      { cost: 90, range: 1.9, interval: 0.5, damage: 4.6, cone: 60, onHit: { burn: { dps: 2.5, dur: 1.5 } } },
      { cost: 140, range: 2.0, interval: 0.45, damage: 6.8, cone: 64, onHit: { burn: { dps: 3.5, dur: 1.5 } } },
    ],
    branches: {
      A: { id: 'dragon_breath', name: '용의 숨결', desc: '불길이 좁아지는 대신 길고 뜨거워집니다. 한 줄로 오는 떼·정예용.', cost: 280, range: 2.6, interval: 0.45, damage: 13, cone: 40, onHit: { burn: { dps: 8, dur: 2 } } },
      B: { id: 'fire_whirl', name: '불꽃 회오리', desc: '사방(360°)으로 불길을 돌려 뿜습니다. 사거리는 짧습니다.', cost: 270, range: 1.75, interval: 0.5, damage: 9, cone: 360, onHit: { burn: { dps: 5, dur: 2 } } },
    },
  },

  thorn_garden: {
    name: '가시 덤불', element: 'earth', role: 'attack', targets: 'ground', kind: 'spikes', unlock: '1-1',
    desc: '사거리 안의 길에 가시밭을 키웁니다. 가시밭 위의 지상 적은 계속 찔리고 느려집니다.',
    levels: [
      { cost: 90, range: 2.4, interval: 2.6, spikes: { max: 2, radius: 0.55, dur: 6, dps: 4, slowPct: 0.15 } },
      { cost: 90, range: 2.5, interval: 2.4, spikes: { max: 2, radius: 0.6, dur: 6, dps: 6.5, slowPct: 0.15 } },
      { cost: 140, range: 2.6, interval: 2.2, spikes: { max: 3, radius: 0.6, dur: 6.5, dps: 10, slowPct: 0.18 } },
    ],
    branches: {
      A: { id: 'iron_thorn', name: '강철 가시', desc: '가시가 강철이 되어 피해가 크게 늘고, 그 위의 적은 갑옷이 녹습니다(−15%p).', cost: 280, range: 2.7, interval: 2.0, spikes: { max: 3, radius: 0.65, dur: 7, dps: 22, slowPct: 0.18, meltArmor: 0.15 } },
      B: { id: 'vine_tangle', name: '휘감는 덩굴', desc: '가시밭이 넓어지고 감속이 강해지며(35%), 더 많이 깔립니다.', cost: 260, range: 2.8, interval: 1.8, spikes: { max: 4, radius: 0.85, dur: 7, dps: 8, slowPct: 0.35 } },
    },
  },

  icicle_cloud: {
    name: '고드름 구름', element: 'frost', role: 'attack', targets: 'both', kind: 'rain', unlock: '2-1',
    desc: '사거리 안 적 여럿의 머리 위로 고드름을 떨어뜨립니다(0.35초 뒤). 맞으면 피해와 감속. 공중 적도 맞습니다.',
    levels: [
      { cost: 100, range: 3.0, interval: 1.7, damage: 9, rain: { count: 2, delay: 0.35, radius: 0.35 }, onHit: { slow: { pct: 0.25, dur: 1.2 } } },
      { cost: 110, range: 3.1, interval: 1.6, damage: 13, rain: { count: 3, delay: 0.35, radius: 0.35 }, onHit: { slow: { pct: 0.25, dur: 1.2 } } },
      { cost: 160, range: 3.3, interval: 1.5, damage: 19, rain: { count: 3, delay: 0.35, radius: 0.38 }, onHit: { slow: { pct: 0.3, dur: 1.3 } } },
    ],
    branches: {
      A: { id: 'hail_storm', name: '우박 폭풍', desc: '한 번에 적 여섯에게 떨어뜨립니다. 떼용.', cost: 290, range: 3.4, interval: 1.4, damage: 15, rain: { count: 6, delay: 0.35, radius: 0.4 }, onHit: { slow: { pct: 0.3, dur: 1.3 } } },
      B: { id: 'glacier_spear', name: '빙하 창', desc: '적 하나에게 거대한 얼음 창을 떨어뜨려 큰 피해를 주고 얼립니다(1초). 보스·정예용.', cost: 300, range: 3.6, interval: 2.4, damage: 125, rain: { count: 1, delay: 0.45, radius: 0.5 }, onHit: { freezeEvery: { n: 1, dur: 1.0 } } },
    },
  },

  thunder_cloud: {
    name: '뇌운 탑', element: 'storm', role: 'attack', targets: 'both', kind: 'strike', unlock: '3-1',
    desc: '아주 먼 적 하나에 하늘에서 번개를 바로 내리꽂습니다. 주변에도 작은 피해, 가끔 기절(보스 제외). 간격이 깁니다.',
    levels: [
      { cost: 110, range: 4.0, interval: 2.2, damage: 32, strike: { count: 1, splash: 0.5, splashPct: 0.3 }, onHit: { stun: { chance: 0.3, dur: 0.3 } } },
      { cost: 120, range: 4.2, interval: 2.1, damage: 50, strike: { count: 1, splash: 0.5, splashPct: 0.3 }, onHit: { stun: { chance: 0.3, dur: 0.3 } } },
      { cost: 170, range: 4.5, interval: 2.0, damage: 76, strike: { count: 1, splash: 0.55, splashPct: 0.3 }, onHit: { stun: { chance: 0.35, dur: 0.35 } } },
    ],
    branches: {
      A: { id: 'thunder_altar', name: '천둥신 제단', desc: '한 발이 매우 셉니다. 보스용.', cost: 300, range: 5.0, interval: 2.8, damage: 200, strike: { count: 1, splash: 0.6, splashPct: 0.3 }, onHit: { stun: { chance: 0.4, dur: 0.4 } } },
      B: { id: 'storm_front', name: '폭풍 전선', desc: '한 번에 적 넷에게 번개를 내리꽂습니다. 떼용.', cost: 300, range: 4.6, interval: 2.1, damage: 50, strike: { count: 4, splash: 0.45, splashPct: 0.25 }, onHit: { stun: { chance: 0.25, dur: 0.3 } } },
    },
  },

  lighthouse: {
    name: '빛의 등대', element: 'light', role: 'attack', targets: 'both', kind: 'sweep', unlock: '4-1',
    desc: '도는 빛줄기가 스치는 사거리 안의 적을 모두 태우고(공중 포함), 숨은 적을 드러냅니다.',
    levels: [
      { cost: 120, range: 2.6, detect: 2.6, sweep: { beams: 1, speed: 2.6, width: 0.9, dps: 50 } },
      { cost: 120, range: 2.8, detect: 2.8, sweep: { beams: 1, speed: 2.6, width: 0.9, dps: 76 } },
      { cost: 170, range: 3.0, detect: 3.0, sweep: { beams: 1, speed: 2.6, width: 0.95, dps: 112 } },
    ],
    branches: {
      A: { id: 'prism_lighthouse', name: '프리즘 등대', desc: '빛줄기가 셋으로 갈라져 돕니다. 사방의 떼용.', cost: 300, range: 3.0, detect: 3.0, sweep: { beams: 3, speed: 2.4, width: 0.9, dps: 82 } },
      B: { id: 'searchlight', name: '수색 등대', desc: '사거리가 길고, 빛에 비친 적은 3초 동안 모든 피해를 20% 더 받습니다.', cost: 290, range: 3.6, detect: 3.6, sweep: { beams: 1, speed: 2.8, width: 0.8, dps: 105, mark: { pct: 0.2, dur: 3 } } },
    },
  },

  dread_bell: {
    name: '공포의 종', element: 'dark', role: 'attack', targets: 'both', kind: 'pulse', unlock: '5-1',
    desc: '종을 울려 범위 안 적에게 작은 피해를 주고 겁먹게 해, 잠깐 왔던 길을 거꾸로 걷게 합니다. 보스는 겁먹지 않습니다.',
    levels: [
      { cost: 120, range: 1.8, interval: 4.2, damage: 10, fear: { dur: 0.8 } },
      { cost: 120, range: 2.0, interval: 4.0, damage: 15, fear: { dur: 1.0 } },
      { cost: 170, range: 2.2, interval: 3.8, damage: 24, fear: { dur: 1.2 } },
    ],
    branches: {
      A: { id: 'doom_bell', name: '파멸의 종', desc: '공포가 길고 범위가 넓어집니다. 길을 되감는 제어.', cost: 300, range: 2.6, interval: 3.6, damage: 30, fear: { dur: 1.8 } },
      B: { id: 'soul_bell', name: '영혼의 종', desc: '자주 울리고 피해가 크며, 울린 적은 3초 동안 받는 피해 +15%.', cost: 290, range: 2.2, interval: 2.6, damage: 70, fear: { dur: 0.7 }, onHit: { curse: { pct: 0.15, dur: 3 } } },
    },
  },

  /* ===================== ✦ 전설 6종·신화 2종 (2026-11-11) — 뽑기 높은 등급, 모두 새 공격 방식 ===================== */

  phoenix_nest: {
    name: '불사조 둥지', element: 'fire', role: 'attack', targets: 'both', kind: 'orbit', unlock: '3-2',
    desc: '불사조가 탑 둘레를 쉬지 않고 날며, 날개에 닿는 적(공중 포함)을 태웁니다.',
    levels: [
      { cost: 150, range: 2.4, orbit: { birds: 1, speed: 2.4, radius: 0.55, dps: 60 }, onHit: { burn: { dps: 6, dur: 2 } } },
      { cost: 150, range: 2.5, orbit: { birds: 1, speed: 2.4, radius: 0.55, dps: 88 }, onHit: { burn: { dps: 9, dur: 2 } } },
      { cost: 220, range: 2.7, orbit: { birds: 1, speed: 2.5, radius: 0.6, dps: 128 }, onHit: { burn: { dps: 13, dur: 2 } } },
    ],
    branches: {
      A: { id: 'sun_phoenix', name: '태양 불사조', desc: '불사조가 커지고 훨씬 뜨거워집니다. 큰 원을 그리며 납니다.', cost: 380, range: 3.0, orbit: { birds: 1, speed: 2.2, radius: 0.85, dps: 230 }, onHit: { burn: { dps: 24, dur: 2.5 } } },
      B: { id: 'twin_phoenix', name: '쌍둥이 불사조', desc: '불사조 둘이 마주 보며 돕니다.', cost: 370, range: 2.8, orbit: { birds: 2, speed: 2.6, radius: 0.6, dps: 150 }, onHit: { burn: { dps: 15, dur: 2 } } },
    },
  },

  blizzard_keep: {
    name: '눈보라 성채', element: 'frost', role: 'attack', targets: 'both', kind: 'blizzard', unlock: '4-2',
    desc: '적이 몰린 곳에 눈보라를 일으켜 계속 피해를 주고 크게 느리게 합니다. 눈보라가 끝날 때 얼음이 터집니다(언 적은 2배).',
    levels: [
      { cost: 150, range: 3.0, interval: 5.0, blizzard: { count: 1, radius: 1.1, dur: 3, dps: 10, slowPct: 0.35, shatter: 40 } },
      { cost: 150, range: 3.1, interval: 4.8, blizzard: { count: 1, radius: 1.2, dur: 3, dps: 15, slowPct: 0.38, shatter: 60 } },
      { cost: 220, range: 3.3, interval: 4.5, blizzard: { count: 1, radius: 1.3, dur: 3.2, dps: 22, slowPct: 0.4, shatter: 90 } },
    ],
    branches: {
      A: { id: 'eternal_winter', name: '영원한 겨울', desc: '눈보라가 아주 넓고 길어지며, 터질 때 남은 적을 얼립니다(1초).', cost: 380, range: 3.5, interval: 5.0, blizzard: { count: 1, radius: 1.7, dur: 4, dps: 30, slowPct: 0.5, shatter: 140, freeze: 1.0 } },
      B: { id: 'ice_storm', name: '얼음 폭풍', desc: '눈보라를 두 곳에 한꺼번에 일으킵니다.', cost: 370, range: 3.4, interval: 4.2, blizzard: { count: 2, radius: 1.2, dur: 3, dps: 26, slowPct: 0.4, shatter: 110 } },
    },
  },

  storm_eye: {
    name: '폭풍의 눈', element: 'storm', role: 'attack', targets: 'both', kind: 'roller', unlock: '4-4',
    desc: '회오리를 일으켜 길을 거슬러 보냅니다. 회오리에 걸린 적은 피해를 입으며 뒤로 밀려납니다(보스·큰 적은 밀리지 않음).',
    levels: [
      { cost: 150, range: 2.6, interval: 6.0, roller: { type: 'tornado', count: 1, speed: 1.6, length: 5, radius: 0.6, dps: 16, push: 1.2 } },
      { cost: 150, range: 2.7, interval: 5.7, roller: { type: 'tornado', count: 1, speed: 1.6, length: 5.5, radius: 0.6, dps: 24, push: 1.3 } },
      { cost: 220, range: 2.9, interval: 5.4, roller: { type: 'tornado', count: 1, speed: 1.7, length: 6, radius: 0.65, dps: 34, push: 1.4 } },
    ],
    branches: {
      A: { id: 'typhoon', name: '태풍', desc: '회오리가 거대해져 더 멀리 가고 더 세게 밀어냅니다.', cost: 380, range: 3.2, interval: 5.5, roller: { type: 'tornado', count: 1, speed: 1.5, length: 8, radius: 0.9, dps: 52, push: 1.6 } },
      B: { id: 'thunder_twister', name: '번개 회오리', desc: '덜 밀어내는 대신 번개가 감겨 피해가 크고, 처음 닿은 적을 기절시킵니다(0.4초, 보스 제외).', cost: 370, range: 3.0, interval: 5.0, roller: { type: 'tornado', count: 1, speed: 2.0, length: 7, radius: 0.65, dps: 80, push: 0.7, stun: 0.4 } },
    },
  },

  titan_boulder: {
    name: '거인의 바위', element: 'earth', role: 'attack', targets: 'ground', kind: 'roller', unlock: '3-3',
    desc: '커다란 바위를 길 위로 굴려 보냅니다. 바위는 길을 거슬러 구르며 닿는 지상 적을 한 번씩 깔아뭉개고 잠깐 기절시킵니다(보스 제외).',
    levels: [
      { cost: 150, range: 2.6, interval: 5.5, roller: { type: 'boulder', count: 1, speed: 2.4, length: 6, radius: 0.55, crush: 40, stun: 0.5 } },
      { cost: 150, range: 2.7, interval: 5.3, roller: { type: 'boulder', count: 1, speed: 2.4, length: 6.5, radius: 0.55, crush: 60, stun: 0.55 } },
      { cost: 220, range: 2.9, interval: 5.0, roller: { type: 'boulder', count: 1, speed: 2.5, length: 7, radius: 0.6, crush: 90, stun: 0.6 } },
    ],
    branches: {
      A: { id: 'landslide', name: '산사태', desc: '바위 셋을 줄지어 굴립니다. 길게 늘어선 떼용.', cost: 380, range: 3.0, interval: 5.5, roller: { type: 'boulder', count: 3, speed: 2.5, length: 7, radius: 0.55, crush: 85, stun: 0.5 } },
      B: { id: 'iron_ball', name: '거인의 철구', desc: '쇠공 하나가 아주 세게 깔아뭉개고, 맞은 적의 갑옷을 4초 동안 25%p 깎습니다.', cost: 370, range: 2.9, interval: 5.0, roller: { type: 'boulder', count: 1, speed: 2.2, length: 7, radius: 0.7, crush: 280, stun: 0.6, shred: 0.25 } },
    },
  },

  judgment_spire: {
    name: '심판의 첨탑', element: 'light', role: 'attack', targets: 'both', kind: 'smite', unlock: '5-2',
    desc: '적 하나에 빛의 표식을 새기고, 잠시 뒤 하늘에서 빛기둥을 내립니다. 기본 피해에 최대 체력의 일부만큼 더 줍니다(보스는 덜). 큰 적일수록 아픕니다.',
    levels: [
      { cost: 150, range: 3.6, interval: 3.2, damage: 60, smite: { count: 1, delay: 0.8, pct: 0.06, bossPct: 0.02, splash: 0.6, splashPct: 0.3 } },
      { cost: 150, range: 3.8, interval: 3.0, damage: 90, smite: { count: 1, delay: 0.8, pct: 0.07, bossPct: 0.025, splash: 0.6, splashPct: 0.3 } },
      { cost: 220, range: 4.0, interval: 2.8, damage: 135, smite: { count: 1, delay: 0.8, pct: 0.08, bossPct: 0.03, splash: 0.65, splashPct: 0.3 } },
    ],
    branches: {
      A: { id: 'divine_verdict', name: '신의 심판', desc: '빛기둥 하나가 아주 셉니다(최대 체력 12%, 보스 4%).', cost: 380, range: 4.4, interval: 3.0, damage: 300, smite: { count: 1, delay: 0.9, pct: 0.12, bossPct: 0.04, splash: 0.7, splashPct: 0.3 } },
      B: { id: 'light_rain', name: '빛의 비', desc: '한 번에 적 셋에게 표식을 새깁니다.', cost: 370, range: 4.2, interval: 2.6, damage: 120, smite: { count: 3, delay: 0.8, pct: 0.06, bossPct: 0.02, splash: 0.55, splashPct: 0.3 } },
    },
  },

  soul_reaper: {
    name: '영혼 수확자', element: 'dark', role: 'attack', targets: 'both', kind: 'bolt', unlock: '5-3',
    desc: '어둠 화살을 쏩니다. 근처에서 적이 죽을 때마다 영혼을 모아 점점 세지고(영혼마다 공격력 +%), 영혼이 가득 차면 영혼 폭풍으로 주변을 휩씁니다.',
    levels: [
      { cost: 150, range: 2.8, interval: 1.0, damage: 26, projSpeed: 9, harvest: { max: 12, per: 0.05, storm: 120, radius: 2.2 } },
      { cost: 150, range: 3.0, interval: 1.0, damage: 39, projSpeed: 9, harvest: { max: 12, per: 0.05, storm: 180, radius: 2.3 } },
      { cost: 220, range: 3.1, interval: 0.9, damage: 57, projSpeed: 9, harvest: { max: 12, per: 0.06, storm: 260, radius: 2.4 } },
    ],
    branches: {
      A: { id: 'death_scythe', name: '죽음의 낫', desc: '화살이 매우 세지고, 영혼 10개로 아주 센 폭풍을 일으킵니다.', cost: 380, range: 3.2, interval: 0.8, damage: 105, projSpeed: 9, harvest: { max: 10, per: 0.07, storm: 520, radius: 2.6 } },
      B: { id: 'soul_legion', name: '영혼 군단', desc: '영혼을 20개까지 모으고, 폭풍이 넓으며 휩쓸린 적은 4초 동안 받는 피해 +20%.', cost: 370, range: 3.3, interval: 0.9, damage: 78, projSpeed: 9, harvest: { max: 20, per: 0.06, storm: 300, radius: 3.0, curse: { pct: 0.2, dur: 4 } } },
    },
  },

  chrono_spire: {
    name: '시간의 탑', element: 'light', role: 'attack', targets: 'both', kind: 'bolt', unlock: '5-4',
    desc: '시계 바늘 같은 빛 화살을 쏘고, 주기적으로 넓은 범위의 시간을 멈춥니다. 멈춘 적은 조금 뒤로 되감깁니다. 보스는 멈추지 않고 크게 느려집니다.',
    levels: [
      { cost: 200, range: 3.0, interval: 0.9, damage: 30, projSpeed: 10, chrono: { every: 7, radius: 2.4, stop: 1.2, rewind: 0.6, bossSlow: 0.5 } },
      { cost: 200, range: 3.1, interval: 0.85, damage: 45, projSpeed: 10, chrono: { every: 6.8, radius: 2.5, stop: 1.3, rewind: 0.7, bossSlow: 0.5 } },
      { cost: 300, range: 3.3, interval: 0.8, damage: 66, projSpeed: 10, chrono: { every: 6.5, radius: 2.7, stop: 1.4, rewind: 0.8, bossSlow: 0.5 } },
    ],
    branches: {
      A: { id: 'frozen_world', name: '멈춘 세계', desc: '시간을 아주 넓게, 오래 멈추고 더 많이 되감습니다.', cost: 480, range: 3.6, interval: 0.8, damage: 85, projSpeed: 10, chrono: { every: 6, radius: 3.4, stop: 2.0, rewind: 1.0, bossSlow: 0.6 } },
      B: { id: 'haste_clock', name: '가속 시계', desc: '시간을 빠르게 돌려 화살을 아주 빨리 쏩니다.', cost: 470, range: 3.4, interval: 0.35, damage: 60, projSpeed: 10, chrono: { every: 7, radius: 2.6, stop: 1.2, rewind: 0.8, bossSlow: 0.5 } },
    },
  },

  shadow_dragon: {
    name: '흑룡의 둥지', element: 'dark', role: 'attack', targets: 'both', kind: 'breath', unlock: '5-6', region: 6,
    desc: '흑룡이 가장 앞선 적 쪽으로 어둠의 불길을 일직선으로 뿜습니다. 줄 위의 적(공중 포함)을 모두 꿰뚫고, 받는 피해를 늘립니다.',
    levels: [
      { cost: 200, range: 3.2, interval: 2.2, damage: 70, breath: { count: 1, width: 0.5 }, onHit: { curse: { pct: 0.1, dur: 3 } } },
      { cost: 200, range: 3.3, interval: 2.1, damage: 105, breath: { count: 1, width: 0.5 }, onHit: { curse: { pct: 0.1, dur: 3 } } },
      { cost: 300, range: 3.5, interval: 2.0, damage: 155, breath: { count: 1, width: 0.55 }, onHit: { curse: { pct: 0.12, dur: 3 } } },
    ],
    branches: {
      A: { id: 'doom_breath', name: '멸망의 숨결', desc: '불길이 길고 굵어지며 한 번이 아주 셉니다. 받는 피해 +20%.', cost: 480, range: 4.2, interval: 2.2, damage: 380, breath: { count: 1, width: 0.65 }, onHit: { curse: { pct: 0.2, dur: 4 } } },
      B: { id: 'twin_dragon', name: '쌍두 흑룡', desc: '머리 둘이 서로 다른 적에게 한꺼번에 뿜습니다.', cost: 470, range: 3.6, interval: 1.9, damage: 170, breath: { count: 2, width: 0.5 }, onHit: { curse: { pct: 0.12, dur: 3 } } },
    },
  },
};

/** 설계서 순서 (도감·건설 메뉴 정렬용) */
RG.data.towerOrder = [
  'ember_archer', 'flame_mortar', 'forge', 'flame_jet',
  'frost_crystal', 'ice_ballista', 'winter_bell', 'icicle_cloud',
  'lightning_rod', 'gale_cannon', 'dynamo', 'thunder_cloud',
  'stone_barracks', 'quake_hammer', 'crystal_mine', 'thorn_garden',
  'sun_lens', 'sanctuary', 'radiance_spire', 'lighthouse',
  'hex_spire', 'void_orb', 'shadow_snare', 'dread_bell',
  // 전설·신화 (2026-11-11) — 원소 차례로
  'phoenix_nest', 'blizzard_keep', 'storm_eye', 'titan_boulder', 'judgment_spire', 'soul_reaper', 'chrono_spire', 'shadow_dragon',
];
