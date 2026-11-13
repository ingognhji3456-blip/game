'use strict';

/* =========================================================
 * 조각 레이드 — 설계: docs/design/raid.md · 규칙: js/core/raid.js
 * 탑 하나를 골라 그 탑만으로(영웅은 함께) 레이드 맵을 막으면 그 탑의 조각을 얻음.
 * 조각을 모아 그 탑을 "조각 강화"(1~5단계) — 캠페인·무한·레이드 판에 반영(도전 모드는 순수 실력이라 뺌).
 * ========================================================= */
RG.data.raid = {
  unlockAfter: '2-6',            // 이 맵을 깨면 열림
  /** 조각 강화: 단계마다 드는 조각, 효과 */
  shard: {
    max: 5,
    cost: [10, 20, 35, 55, 80],  // 1→2단계가 아니라 0→1, 1→2 … 4→5 (모두 200)
    levelPct: 0.05,              // 단계마다 +5%: 공격 탑은 공격력, 지원 탑은 지원 효과, 병영은 병사 체력·공격력, 광산은 수입
    rangeAt: 3, rangePct: 0.08,  // 3단계부터 사거리 +8% (공격·지원 탑)
    speedAt: 5, speedPct: 0.1,   // 5단계: 공격 속도 +10% (공격 탑)
  },
  /** 난이도 1~5: 적 체력 배율, 웨이브 수, 맵, 보상 조각(이기면) — 처음 깨면 두 배 */
  difficulty: [
    { name: '쉬움', hp: 0.5, waves: 7, map: 'R1', reward: 3 },
    { name: '보통', hp: 0.7, waves: 8, map: 'R1', reward: 5 },
    { name: '어려움', hp: 0.9, waves: 9, map: 'R2', reward: 8 },
    { name: '매우 어려움', hp: 1.15, waves: 10, map: 'R2', reward: 12 },
    { name: '악몽', hp: 1.45, waves: 11, map: 'R3', reward: 16 },
  ],
  firstClearMult: 2,
  loseShards: 1,                 // 지더라도 절반 넘게 버텼으면
  goldPerCost: 4, goldBase: 100, // 시작 골드 = 탑 Lv1 값 × 4 + 100 (탑 값에 따라 지을 수 있는 수가 비슷하게)
  /** 지원·경제 탑 레이드: 영웅이 싸우고, 근처(반경 칸)에 지은 그 탑마다 영웅 피해·기술 +25% × 탑 단계 배율(Lv1~4, 가장 센 4개) — 적은 더 약하게 */
  supportHero: { radius: 2.5, perTower: 0.25, levelMult: [1, 1.5, 2, 2.6], max: 4, hpMult: 0.6 },
  /** 탑마다 적 체력 보정 — 탑 하나로 싸우므로 탑 세기 차이를 메움. tools/raid-balance.js --calibrate (보통 난이도를 그리디 봇이 이기는 최대 배율 ÷ 1.3) */
  towerHp: {
    ember_archer: 0.69, flame_mortar: 2.08, forge: 0.69, flame_jet: 0.83,
    frost_crystal: 0.58, ice_ballista: 1.2, winter_bell: 0.48, icicle_cloud: 1,
    lightning_rod: 1.44, gale_cannon: 0.23, dynamo: 0.48, thunder_cloud: 1.73,
    stone_barracks: 0.4, quake_hammer: 0.69, crystal_mine: 0.48, thorn_garden: 0.58,
    sun_lens: 1.44, sanctuary: 0.48, radiance_spire: 1.44, lighthouse: 1,
    hex_spire: 0.83, void_orb: 1.44, shadow_snare: 0.48, dread_bell: 1,
    phoenix_nest: 1.73, blizzard_keep: 1.2, storm_eye: 0.83, titan_boulder: 1.73,
    judgment_spire: 1.44, soul_reaper: 2.49, chrono_spire: 2.08, shadow_dragon: 2.49,
  },
  /** 적 무리 (탑 원소에 면역·흡수인 적, 공중을 못 치면 비행 적은 빠짐). 숨는 적·탑을 멈추는 적은 넣지 않음 */
  pool: {
    swarm: ['mist_rat', 'frost_wolf'],
    normal: ['ash_boar', 'straw_husk', 'dune_raider', 'cinder_lizard'],
    big: ['avalanche_golem', 'grey_legionnaire', 'magma_brute'],
    armored: ['rust_knight', 'ice_tortoise', 'rock_crab'],
    flying: ['mist_crow', 'snow_wisp', 'spray_sprite', 'thermal_vulture'],
  },
};

/** 레이드 전용 맵 (캠페인 목록·별에 들어가지 않음). region은 그림 팔레트·음악 */
RG.data.raidMaps = [
  {
    id: 'R1', region: 1, name: '조각의 정원', type: 'fixed', raid: true,
    grid: [
      'TT##TT##T##TTTTT',
      'S............TTT',
      'T##T###T###T.##T',
      'T##T###T###T.##T',
      'T##..........##T',
      'T##.##T###T#T##T',
      'T##.##T###T#T##T',
      'TT#............L',
      'TT##TT#####TT##T',
    ],
    startGold: 400,
    waves: ['mist_rat*1'],
  },
  {
    id: 'R2', region: 3, name: '메아리 협곡', type: 'fixed', raid: true,
    grid: [
      '^^^^^^^^^^^^^^^^',
      'S..............^',
      '^####^####^###.^',
      '^##^####^#####.^',
      '^..............^',
      '^.#####^####^##^',
      '^.###^#####^###^',
      '^..............L',
      '^^^^^^^^^^^^^^^^',
    ],
    startGold: 400,
    waves: ['mist_rat*1'],
  },
  {
    id: 'R3', region: 5, name: '부서진 조각 전당', type: 'fixed', raid: true,
    grid: [
      '^^^^^^^^^^^^^^^^',
      'S..#...#...#...^',
      '^#.#.#.#.#.#.#.^',
      '^#.#.#.#.#.#.#.^',
      '^#.#.#.#.#.#.#.^',
      '^#.#.#.#.#.#.#.^',
      '^#.#.#.#.#.#.#.^',
      '^#...#...#...#.L',
      '^^^^^^^^^^^^^^^^',
    ],
    startGold: 400,
    waves: ['mist_rat*1'],
  },
];
