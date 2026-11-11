'use strict';

/* =========================================================
 * 적 48종 + 보스 7종 — 설계: docs/design/enemies.md (6지역: docs/design/region6.md)
 * 필드 뜻: docs/ARCHITECTURE.md §3.3
 *  hp, speed(칸/초), armor(0~1), bounty(골드), lives(등불 불꽃), size(칸)
 *  melee: 붙잡혔을 때의 공격, traits: 특성, affinity: 원소 친화
 * 처음 정한 값이며 봇 시뮬레이션으로 조정합니다.
 * ========================================================= */

RG.data.enemies = {
  /* ============ 1지역 · 솔빛 들판 ============ */
  mist_rat: {
    name: '안개 쥐', region: 1, size: 0.5, hp: 44, speed: 1.35, armor: 0, bounty: 4, lives: 1,
    melee: { damage: 2, interval: 1.0 }, traits: {}, affinity: {},
    desc: '빠르고 많습니다.',
  },
  ash_boar: {
    name: '잿빛 멧돼지', region: 1, size: 0.7, hp: 200, speed: 0.85, armor: 0, bounty: 14, lives: 1,
    melee: { damage: 8, interval: 1.2 }, traits: {}, affinity: {},
    desc: '체력이 높아 한 탑으로는 잡기 어렵습니다.',
  },
  mist_crow: {
    name: '안개 까마귀', region: 1, size: 0.5, hp: 80, speed: 1.2, armor: 0, bounty: 7, lives: 1,
    melee: null, traits: { flying: true }, affinity: {},
    desc: '길을 무시하고 곧장 날아옵니다.',
  },
  straw_husk: {
    name: '짚 허수아비', region: 1, size: 0.7, hp: 230, speed: 0.7, armor: 0, bounty: 14, lives: 1,
    melee: { damage: 6, interval: 1.2 }, traits: {}, affinity: { fire: 'weak' },
    desc: '느리지만 단단합니다. 불에 약합니다.',
  },
  vine_leech: {
    name: '덩굴 거머리', region: 1, size: 0.7, hp: 210, speed: 0.8, armor: 0, bounty: 14, lives: 1,
    melee: { damage: 5, interval: 1.0 }, traits: { regen: 0.06 }, affinity: {},
    desc: '2초 동안 안 맞으면 빠르게 회복합니다.',
  },
  spore_sac: {
    name: '포자 주머니', region: 1, size: 0.7, hp: 170, speed: 0.8, armor: 0, bounty: 9, lives: 1,
    melee: { damage: 4, interval: 1.2 }, traits: { split: { into: 'sporeling', n: 3 } }, affinity: {},
    desc: '죽으면 포자 새끼 셋이 터져 나옵니다.',
  },
  sporeling: {
    name: '포자 새끼', region: 1, size: 0.5, hp: 32, speed: 1.4, armor: 0, bounty: 2, lives: 1,
    melee: { damage: 2, interval: 1.0 }, traits: {}, affinity: {}, minion: true,
    desc: '포자 주머니에서 나오는 작은 적.',
  },
  rust_knight: {
    name: '녹슨 기사', region: 1, size: 0.7, hp: 250, speed: 0.8, armor: 0.4, bounty: 18, lives: 1,
    melee: { damage: 10, interval: 1.2 }, traits: {}, affinity: {},
    desc: '갑옷이 피해를 크게 줄입니다.',
  },
  hollow_elder: {
    name: '속 빈 고목', region: 1, size: 1.8, hp: 3600, speed: 0.4, armor: 0, bounty: 200, lives: 99, boss: true, elite: true,
    melee: { damage: 40, interval: 1.5 }, traits: {}, affinity: { fire: 'weak' },
    bossData: { summon: { type: 'vine_leech', n: 3, every: 15 }, phase: { at: 0.5, armor: 0.3, speedMul: 1.25 } },
    desc: '15초마다 덩굴 거머리를 부르고, 체력이 절반이 되면 나무껍질 갑옷을 두릅니다.',
  },

  /* ============ 2지역 · 서리 고개 ============ */
  frost_wolf: {
    name: '서리 늑대', region: 2, size: 0.7, hp: 120, speed: 1.5, armor: 0, bounty: 8, lives: 1,
    melee: { damage: 8, interval: 0.9 }, traits: {}, affinity: { frost: 'resist', fire: 'weak' },
    desc: '빠른 무리. 얼음에 강하고 불에 약합니다.',
  },
  snow_wisp: {
    name: '눈 요정', region: 2, size: 0.5, hp: 110, speed: 1.25, armor: 0, bounty: 9, lives: 1,
    melee: null, traits: { flying: true }, affinity: { frost: 'resist', fire: 'weak' },
    desc: '얼음이 잘 안 통하는 비행 적.',
  },
  ice_tortoise: {
    name: '얼음 거북', region: 2, size: 0.9, hp: 560, speed: 0.55, armor: 0.6, bounty: 26, lives: 2, elite: true,
    melee: { damage: 14, interval: 1.5 }, traits: {}, affinity: { fire: 'weak' },
    desc: '매우 두꺼운 갑옷.',
  },
  avalanche_golem: {
    name: '눈사태 골렘', region: 2, size: 0.9, hp: 520, speed: 0.7, armor: 0, bounty: 18, lives: 2, elite: true,
    melee: { damage: 14, interval: 1.4 }, traits: { split: { into: 'snowball_golem', n: 2 } }, affinity: {},
    desc: '죽으면 눈덩이 골렘 둘로 갈라집니다.',
  },
  snowball_golem: {
    name: '눈덩이 골렘', region: 2, size: 0.5, hp: 130, speed: 1.15, armor: 0, bounty: 4, lives: 1,
    melee: { damage: 6, interval: 1.0 }, traits: {}, affinity: {}, minion: true,
    desc: '눈사태 골렘에서 나오는 작은 적.',
  },
  yeti_shaman: {
    name: '설인 주술사', region: 2, size: 0.9, hp: 420, speed: 0.75, armor: 0, bounty: 24, lives: 2, elite: true,
    melee: { damage: 12, interval: 1.3 }, traits: { healer: { radius: 2.0, pct: 0.08, every: 4 } }, affinity: {},
    desc: '주기적으로 주변 적을 치유합니다.',
  },
  rime_wraith: {
    name: '서리 망령', region: 2, size: 0.7, hp: 200, speed: 1.0, armor: 0, bounty: 15, lives: 1,
    melee: { damage: 10, interval: 1.0 }, traits: { stealth: true }, affinity: { frost: 'resist' },
    desc: '탐지 없이는 표적이 될 수 없습니다.',
  },
  ice_shieldbearer: {
    name: '얼음 방패병', region: 2, size: 0.7, hp: 280, speed: 0.8, armor: 0, bounty: 18, lives: 1,
    melee: { damage: 12, interval: 1.2 }, traits: { shield: { amount: 0.6, delay: 4, rate: 0.15 } }, affinity: {},
    desc: '보호막이 체력을 지키고, 잠시 안 맞으면 다시 찹니다.',
  },
  whitehorn: {
    name: '서리 군주 흰뿔', region: 2, size: 1.8, hp: 7000, speed: 0.5, armor: 0, bounty: 300, lives: 99, boss: true, elite: true,
    melee: { damage: 60, interval: 1.5 }, traits: {}, affinity: { frost: 'immune', fire: 'weak' },
    bossData: { breath: { every: 12, towers: 2, range: 3.5, dur: 3 }, phase: { at: 0.5, summon: { type: 'frost_wolf', n: 5 }, speedMul: 1.2 } },
    desc: '12초마다 가까운 탑 둘을 멈추고, 체력이 절반이 되면 늑대 무리를 부릅니다.',
  },

  /* ============ 3지역 · 붉은 협곡 ============ */
  cinder_lizard: {
    name: '불도마뱀', region: 3, size: 0.5, hp: 130, speed: 1.55, armor: 0, bounty: 8, lives: 1,
    melee: { damage: 10, interval: 0.9 }, traits: { unstoppable: true }, affinity: { fire: 'immune', frost: 'weak' },
    desc: '빠르고 불이 안 통하며, 병사에게 붙잡히지 않습니다.',
  },
  sand_burrower: {
    name: '모래 굴착충', region: 3, size: 0.7, hp: 390, speed: 0.85, armor: 0, bounty: 20, lives: 1,
    melee: { damage: 14, interval: 1.2 }, traits: { burrow: { every: 4, dur: 2 } }, affinity: {},
    desc: '주기적으로 땅속에 숨습니다.',
  },
  magma_brute: {
    name: '용암 덩치', region: 3, size: 0.9, hp: 820, speed: 0.6, armor: 0.3, bounty: 38, lives: 2, elite: true,
    melee: { damage: 28, interval: 1.6 }, traits: { deathburst: { radius: 1.2, damage: 80 } }, affinity: { fire: 'immune', frost: 'weak' },
    desc: '단단하고, 죽을 때 터져 주변 영웅·병사를 다치게 합니다.',
  },
  thermal_vulture: {
    name: '열풍 독수리', region: 3, size: 0.7, hp: 200, speed: 1.45, armor: 0, bounty: 13, lives: 1,
    melee: null, traits: { flying: true }, affinity: { fire: 'resist' },
    desc: '빠른 비행 적.',
  },
  dune_raider: {
    name: '모래 약탈자', region: 3, size: 0.7, hp: 340, speed: 0.95, armor: 0, bounty: 18, lives: 1,
    melee: { damage: 16, interval: 1.0 }, traits: { dash: { mult: 2, dur: 3 } }, affinity: {},
    desc: '처음 맞으면 잠시 두 배로 달립니다.',
  },
  obsidian_beetle: {
    name: '흑요석 딱정벌레', region: 3, size: 0.7, hp: 450, speed: 0.8, armor: 0.55, bounty: 26, lives: 1,
    melee: { damage: 18, interval: 1.3 }, traits: { shredResist: 0.5 }, affinity: {},
    desc: '매우 단단하고, 갑옷 파쇄도 절반만 먹힙니다.',
  },
  flame_spirit: {
    name: '불꽃 정령', region: 3, size: 0.5, hp: 180, speed: 1.2, armor: 0, bounty: 12, lives: 1,
    melee: null, traits: { flying: true }, affinity: { fire: 'absorb', frost: 'weak' },
    desc: '불에 맞으면 오히려 회복합니다.',
  },
  canyon_slinger: {
    name: '협곡 투석병', region: 3, size: 0.7, hp: 280, speed: 0.9, armor: 0, bounty: 18, lives: 1,
    melee: { damage: 8, interval: 1.2 }, traits: { ranged: { range: 2.4, damage: 14, interval: 1.6 } }, affinity: {},
    desc: '걸으면서 영웅·병사에게 돌을 던집니다.',
  },
  pyre_worm: {
    name: '용암 벌레왕', region: 3, size: 1.8, hp: 11250, speed: 0.55, armor: 0, bounty: 450, lives: 99, boss: true, elite: true,
    melee: { damage: 80, interval: 1.5 }, traits: {}, affinity: { fire: 'immune', frost: 'weak' },
    bossData: { dive: { every: 8, tiles: 3, under: 1.0, stunRadius: 1.2, stun: 1 }, phase: { at: 0.5, summon: { type: 'flame_spirit', n: 4 } } },
    desc: '8초마다 땅속으로 들어가 3칸 앞에서 튀어나옵니다.',
  },

  /* ============ 4지역 · 폭풍 해안 ============ */
  rock_crab: {
    name: '바위게', region: 4, size: 0.7, hp: 630, speed: 0.75, armor: 0.5, bounty: 30, lives: 1,
    melee: { damage: 22, interval: 1.3 }, traits: {}, affinity: { storm: 'weak' },
    desc: '단단하지만 폭풍에 약합니다.',
  },
  volt_jelly: {
    name: '번개 해파리', region: 4, size: 0.7, hp: 420, speed: 0.9, armor: 0, bounty: 24, lives: 1,
    melee: null, traits: { flying: true, shock: { radius: 1.6, dur: 2.5 } }, affinity: { storm: 'resist' },
    desc: '죽을 때 터지며 주변 탑을 잠시 멈춥니다.',
  },
  spray_sprite: {
    name: '물보라 요정', region: 4, size: 0.5, hp: 160, speed: 1.8, armor: 0, bounty: 7, lives: 1,
    melee: null, traits: { flying: true }, affinity: {},
    desc: '매우 빠른 비행 떼.',
  },
  drowned_corsair: {
    name: '익사한 해적', region: 4, size: 0.7, hp: 560, speed: 0.9, armor: 0, bounty: 28, lives: 1,
    melee: { damage: 24, interval: 1.1 }, traits: { undying: { pct: 0.4 } }, affinity: {},
    desc: '처음 쓰러지면 다시 일어납니다.',
  },
  coral_colossus: {
    name: '산호 거인', region: 4, size: 0.9, hp: 2520, speed: 0.45, armor: 0, bounty: 80, lives: 3, elite: true,
    melee: { damage: 50, interval: 1.8 }, traits: { regen: 0.02 }, affinity: {},
    desc: '체력이 매우 높고 재생합니다. 등불에 닿으면 불꽃 3개.',
  },
  volt_eel: {
    name: '전기 장어', region: 4, size: 0.7, hp: 450, speed: 1.35, armor: 0, bounty: 22, lives: 1,
    melee: { damage: 18, interval: 0.9 }, traits: {}, affinity: { storm: 'absorb', earth: 'weak' },
    desc: '폭풍에 맞으면 회복합니다. 빠릅니다.',
  },
  mist_mariner: {
    name: '안개 선원', region: 4, size: 0.7, hp: 450, speed: 0.9, armor: 0, bounty: 26, lives: 1,
    melee: { damage: 14, interval: 1.2 }, traits: { stealth: true, ranged: { range: 2.6, damage: 24, interval: 1.8 } }, affinity: {},
    desc: '숨어서 영웅·병사를 쏩니다.',
  },
  tide_caller: {
    name: '조수 술사', region: 4, size: 0.7, hp: 520, speed: 0.8, armor: 0, bounty: 30, lives: 1,
    melee: { damage: 16, interval: 1.2 }, traits: { shielder: { radius: 2.0, pct: 0.25, every: 6 } }, affinity: {},
    desc: '주변 적에게 보호막을 씌웁니다.',
  },
  tempest_whale: {
    name: '폭풍 고래', region: 4, size: 2.0, hp: 14000, speed: 0.4, armor: 0, bounty: 700, lives: 99, boss: true, elite: true,
    melee: null, traits: { flying: true }, affinity: { storm: 'resist' },
    bossData: { bolt: { every: 10, towers: 3, width: 0.8, dur: 4 }, phase: { at: 0.5, summon: { type: 'volt_jelly', n: 4 } } },
    desc: '하늘을 헤엄치는 보스. 10초마다 일직선 위의 탑을 멈춥니다.',
  },

  /* ============ 5지역 · 깨진 대종 ============ */
  grey_legionnaire: {
    name: '회색 군단병', region: 5, size: 0.7, hp: 840, speed: 0.8, armor: 0.25, bounty: 30, lives: 1,
    melee: { damage: 30, interval: 1.1 }, traits: {}, affinity: {},
    desc: '체력과 갑옷이 모두 좋은 강적.',
  },
  hush_monk: {
    name: '침묵 수도사', region: 5, size: 0.7, hp: 720, speed: 0.75, armor: 0, bounty: 34, lives: 1,
    melee: { damage: 20, interval: 1.2 }, traits: { silence: { radius: 1.5 } }, affinity: {},
    desc: '지나가는 동안 주변 탑을 멈춥니다.',
  },
  void_stalker: {
    name: '공허 추적자', region: 5, size: 0.7, hp: 600, speed: 1.45, armor: 0, bounty: 28, lives: 1,
    melee: { damage: 26, interval: 0.9 }, traits: { stealth: true, unstoppable: true }, affinity: { dark: 'resist', light: 'weak' },
    desc: '숨어서 매우 빠르게 달리고, 병사에게 붙잡히지 않습니다.',
  },
  ashen_paladin: {
    name: '잿빛 성기사', region: 5, size: 0.9, hp: 1320, speed: 0.7, armor: 0.4, bounty: 50, lives: 2, elite: true,
    melee: { damage: 40, interval: 1.3 }, traits: { shield: { amount: 0.5, delay: 4, rate: 0.12 } }, affinity: {},
    desc: '갑옷과 보호막을 모두 가졌습니다.',
  },
  echo_shade: {
    name: '메아리 그림자', region: 5, size: 0.7, hp: 780, speed: 0.95, armor: 0, bounty: 30, lives: 1,
    melee: { damage: 22, interval: 1.0 }, traits: { split: { into: 'echo_shade', n: 2, hpPct: 0.25, fragment: true } }, affinity: {},
    desc: '죽으면 약한 메아리 둘로 갈라집니다(메아리는 더 갈라지지 않음).',
  },
  bellshard_golem: {
    name: '종 조각 골렘', region: 5, size: 0.9, hp: 1560, speed: 0.65, armor: 0, bounty: 50, lives: 2, elite: true,
    melee: { damage: 44, interval: 1.5 }, traits: { adaptive: { per: 0.08, max: 0.6 } }, affinity: {},
    desc: '같은 원소에 계속 맞으면 그 원소에 점점 강해집니다.',
  },
  silent_drake: {
    name: '침묵의 비룡', region: 5, size: 0.9, hp: 960, speed: 1.1, armor: 0.4, bounty: 38, lives: 2, elite: true,
    melee: null, traits: { flying: true }, affinity: {},
    desc: '단단한 비행 적.',
  },
  resonance_eater: {
    name: '울림 포식자', region: 5, size: 0.7, hp: 780, speed: 0.85, armor: 0, bounty: 36, lives: 1,
    melee: { damage: 20, interval: 1.2 }, traits: { dampen: { radius: 2.0 } }, affinity: {},
    desc: '주변 탑들의 공명 연결을 끊습니다.',
  },
  bellkeeper: {
    name: '종지기', region: 5, size: 1.6, hp: 20000, speed: 0.5, armor: 0, bounty: 900, lives: 99, boss: true, elite: true,
    melee: { damage: 120, interval: 1.5 }, traits: {}, affinity: {},
    bossData: { blink: { every: 6, tiles: 2 }, ward: { every: 10, radius: 2.5, pct: 0.3 }, phase: { at: 0.5, summon: { type: 'hush_monk', n: 3 } } },
    desc: '6초마다 앞으로 순간이동하고, 주변 적에게 보호막을 씌웁니다.',
  },
  the_silence: {
    name: '침묵', region: 5, size: 2.0, hp: 40000, speed: 0.35, armor: 0, bounty: 0, lives: 99, boss: true, elite: true,
    melee: { damage: 200, interval: 1.5 }, traits: {}, affinity: { fire: 'immune', frost: 'immune' },
    bossData: {
      phases: [
        { at: 0.67, immune: ['storm', 'earth'], freezeLinks: 3, summon: { type: 'grey_legionnaire', n: 4 } },
        { at: 0.34, immune: ['light', 'dark'], freezeLinks: 3, summon: { type: 'echo_shade', n: 3 } },
      ],
    },
    desc: '안개의 근원. 페이즈마다 면역 원소가 바뀝니다.',
  },

  /* ============ 6지역 · 별울림 첨탑 (확장) ============ */
  stardust_moth: {
    name: '별가루 나방', region: 6, size: 0.5, hp: 300, speed: 1.75, armor: 0, bounty: 8, lives: 1,
    melee: null, traits: { flying: true }, affinity: { frost: 'weak' },
    desc: '별가루를 흩뿌리며 떼로 날아오는 빠른 나방. 얼음에 약합니다.',
  },
  cloud_sheep: {
    name: '구름 양', region: 6, size: 0.9, hp: 2300, speed: 0.6, armor: 0, bounty: 60, lives: 2, elite: true,
    melee: { damage: 36, interval: 1.4 }, traits: { fluffy: { pct: 0.5 } }, affinity: { storm: 'weak' },
    desc: '푹신한 털이 폭발·범위 공격을 절반 흡수합니다. 바람(폭풍)에 약합니다.',
  },
  comet_knight: {
    name: '혜성 기사', region: 6, size: 0.7, hp: 1250, speed: 0.85, armor: 0.4, bounty: 44, lives: 1,
    melee: { damage: 42, interval: 1.1 }, traits: { dash: { mult: 2.2, dur: 2.5 } }, affinity: { fire: 'resist' },
    desc: '두꺼운 갑옷. 처음 맞으면 혜성처럼 돌진합니다.',
  },
  nebula_jelly: {
    name: '성운 해파리', region: 6, size: 0.7, hp: 1000, speed: 0.85, armor: 0, bounty: 36, lives: 1,
    melee: null, traits: { flying: true, split: { into: 'nebula_jelly', n: 3, hpPct: 0.2, fragment: true } }, affinity: { light: 'weak' },
    desc: '하늘을 떠다니다 죽으면 작은 해파리 셋으로 갈라집니다(작은 것은 더 갈라지지 않음).',
  },
  umbral_stargazer: {
    name: '그림자 별지기', region: 6, size: 0.7, hp: 900, speed: 0.85, armor: 0, bounty: 38, lives: 1,
    melee: { damage: 18, interval: 1.2 }, traits: { stealth: true, ranged: { range: 3.0, damage: 32, interval: 1.8 } }, affinity: { light: 'weak', dark: 'resist' },
    desc: '숨어서 망원경으로 겨누고 영웅·병사에게 별빛 화살을 쏩니다.',
  },
  eclipse_priest: {
    name: '일식 사제', region: 6, size: 0.7, hp: 980, speed: 0.75, armor: 0, bounty: 40, lives: 1,
    melee: { damage: 16, interval: 1.2 }, traits: { healer: { radius: 2.0, pct: 0.06, every: 5 }, shielder: { radius: 2.0, pct: 0.15, every: 7 } }, affinity: {},
    desc: '주변 적을 치유하고 보호막을 씌웁니다. 먼저 잡으세요.',
  },
  meteor_golem: {
    name: '유성 골렘', region: 6, size: 0.9, hp: 2900, speed: 0.55, armor: 0.2, bounty: 85, lives: 3, elite: true,
    melee: { damage: 60, interval: 1.6 }, traits: { deathburst: { radius: 1.4, damage: 150 } }, affinity: { frost: 'weak', fire: 'immune' },
    desc: '불타는 운석 덩어리. 죽을 때 터져 주변 영웅·병사에게 큰 피해. 불에 면역, 얼음에 약합니다.',
  },
  phase_wraith: {
    name: '위상 망령', region: 6, size: 0.7, hp: 950, speed: 0.9, armor: 0, bounty: 40, lives: 1,
    melee: { damage: 26, interval: 1.0 }, traits: { phase: { every: 4, tiles: 2, warn: 0.6 } }, affinity: { dark: 'resist', light: 'weak' },
    desc: '4초마다 일렁이다가 길을 따라 2칸 앞으로 순간이동합니다(붙잡혀 있어도 빠져나감).',
  },
  gloom_monarch: {
    name: '그믐달 군주', region: 6, size: 2.0, hp: 52000, speed: 0.38, armor: 0.1, bounty: 0, lives: 99, boss: true, elite: true,
    melee: { damage: 220, interval: 1.5 }, traits: {}, affinity: {},
    bossData: {
      veil: { every: 12, radius: 2.6, pct: 0.4, dur: 5 }, trackEls: true,
      phases: [
        { at: 0.7, summon: { type: 'stardust_moth', n: 6 } },
        { at: 0.35, blink: 3, adaptImmune: true, summon: { type: 'phase_wraith', n: 2 } },
      ],
    },
    desc: '별빛을 삼킨 그믐달. 12초마다 주변 탑의 별빛을 가려 사거리를 줄이고, 체력이 줄면 나방을 부르고 가장 많이 맞은 원소에 면역이 됩니다.',
  },
};

/** 설계서 순서 */
RG.data.enemyOrder = [
  'mist_rat', 'ash_boar', 'mist_crow', 'straw_husk', 'vine_leech', 'spore_sac', 'sporeling', 'rust_knight', 'hollow_elder',
  'frost_wolf', 'snow_wisp', 'ice_tortoise', 'avalanche_golem', 'snowball_golem', 'yeti_shaman', 'rime_wraith', 'ice_shieldbearer', 'whitehorn',
  'cinder_lizard', 'sand_burrower', 'magma_brute', 'thermal_vulture', 'dune_raider', 'obsidian_beetle', 'flame_spirit', 'canyon_slinger', 'pyre_worm',
  'rock_crab', 'volt_jelly', 'spray_sprite', 'drowned_corsair', 'coral_colossus', 'volt_eel', 'mist_mariner', 'tide_caller', 'tempest_whale',
  'grey_legionnaire', 'hush_monk', 'void_stalker', 'ashen_paladin', 'echo_shade', 'bellshard_golem', 'silent_drake', 'resonance_eater', 'bellkeeper', 'the_silence',
  'stardust_moth', 'cloud_sheep', 'comet_knight', 'nebula_jelly', 'umbral_stargazer', 'eclipse_priest', 'meteor_golem', 'phase_wraith', 'gloom_monarch',
];
