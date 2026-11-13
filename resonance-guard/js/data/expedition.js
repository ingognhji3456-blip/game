'use strict';

/* =========================================================
 * 원정 모드 데이터 — 설계: docs/design/expedition.md
 * 유물 mods 키: 기술 나무 meta 키(startGoldPct·bountyPct·earlyBonusPct·buildCostPct·upgradeCostPct·mineIncomePct·purePct·ampPct·
 *   tripleDamagePct·quadSpeedPct·rangePct·branchCostPct·branchDamagePct·heroHpPct·heroDamagePct·heroCooldownPct·heroRespawnPct·
 *   heroStartLevel·leakShield) + 원정 전용(elFire…elDark: 원소 탑 피해, hpScale: 적 체력, armorAdd: 적 갑옷, countdownMul,
 *   silverPct: 은화, winLife: 이기면 불꽃)
 * ========================================================= */
RG.data.expedition = {
  unlockAfter: '3-6',
  acts: 3,
  floors: 5,                 // 막마다 일반 층 수 (그 뒤 막 보스)
  startLives: 12,
  maxLives: 20,
  startDeck: { offer: 6, pick: 4 },
  maxDeck: 10,
  actRegions: [[1, 2], [3, 4], [5, 6]],
  actBoss: [['1-6', '2-6'], ['3-6', '4-6'], ['5-6', '6-6']],
  actScale: [0.85, 1.0, 1.1],
  floorScale: 0.03,
  eliteScale: 1.25,
  goldMult: 1.5,             // 짧은 작전이라 경제가 덜 쌓임 → 시작 골드를 더 줌
  waveWindow: 0.75,          // 전투·정예는 맵 웨이브의 앞 75% 안에서 이어진 웨이브 (1층은 처음부터, 5층은 창의 끝까지)
  boss: { goldMult: 2.5, hpScale: [0.7, 0.7, 0.5] }, // 막 보스(막마다): 마지막 5웨이브를 앞 웨이브 경제 없이, 작은 덱으로 치르므로
  waves: { battle: 6, elite: 7, boss: 5 },
  silver: { battle: 20, elite: 40, boss: 80, perAct: 5, skip: 25 },
  shop: { tower: 60, relic: 110, heal: 45, healLives: 3, upgrade: 70 },
  rest: { heal: 3 },
  reward: { perFloor: 15, win: 150 },
  /** 노드 종류 가중치 (층 2부터 정예, 층 3부터 상점·쉼터) */
  nodeWeights: { battle: 45, elite: 15, event: 20, shop: 10, rest: 10 },
  nodeInfo: {
    battle: { name: '전투', icon: 'wave', desc: '짧은 작전 6웨이브. 이기면 탑 하나를 덱에 넣거나 은화.' },
    elite: { name: '정예', icon: 'skull', desc: '강한 7웨이브. 이기면 유물 하나를 고름.' },
    event: { name: '사건', icon: 'book', desc: '무슨 일이 기다리고 있을까요?' },
    shop: { name: '상점', icon: 'gold', desc: '원정 은화로 탑·유물·불꽃·강화를 삽니다.' },
    rest: { name: '쉼터', icon: 'lives', desc: '불꽃 +3 또는 탑 하나 원정 강화.' },
    boss: { name: '막 보스', icon: 'crown', desc: '이 막 지역 보스 맵의 마지막 5웨이브.' },
  },

  /** 변형 규칙 (전투·정예마다 하나) */
  rules: {
    clear: { name: '맑은 하늘', desc: '특별한 일 없음.', mods: {} },
    fog: { name: '짙은 안개', desc: '탑 사거리 −10%.', mods: { rangePct: -0.1 } },
    gold: { name: '황금 웨이브', desc: '현상금 +30%.', mods: { bountyPct: 0.3 } },
    steel: { name: '강철 무리', desc: '적 갑옷 +10%p.', mods: { armorAdd: 0.1 } },
    hurry: { name: '서두르는 밤', desc: '웨이브 카운트다운 절반, 조기 호출 보너스 +50%.', mods: { countdownMul: 0.5, earlyBonusPct: 0.5 } },
    fat: { name: '살찐 무리', desc: '적 체력 +15%, 현상금 +20%.', mods: { hpScale: 0.15, bountyPct: 0.2 } },
  },
  ruleOrder: ['clear', 'fog', 'gold', 'steel', 'hurry', 'fat'],

  /** 유물 30종 */
  relics: {
    coin_pouch: { name: '금화 주머니', kind: 'eco', desc: '시작 골드 +25%', mods: { startGoldPct: 0.25 } },
    bounty_book: { name: '현상금 수첩', kind: 'eco', desc: '현상금 +20%', mods: { bountyPct: 0.2 } },
    early_bell: { name: '이른 종소리', kind: 'eco', desc: '조기 호출 보너스 +60%', mods: { earlyBonusPct: 0.6 } },
    cheap_hammer: { name: '할인 망치', kind: 'eco', desc: '건설비 −10%', mods: { buildCostPct: -0.1 } },
    file_rasp: { name: '숙련공의 줄', kind: 'eco', desc: '강화비 −15%', mods: { upgradeCostPct: -0.15 } },
    mine_lamp: { name: '광산 등불', kind: 'eco', desc: '광산 수입 +50%', mods: { mineIncomePct: 0.5 } },
    ember_heart: { name: '불꽃 심장', kind: 'element', desc: '불 탑 피해 +15%', mods: { elFire: 0.15 } },
    frost_shard: { name: '서리 조각', kind: 'element', desc: '얼음 탑 피해 +15%', mods: { elFrost: 0.15 } },
    storm_quill: { name: '폭풍 깃', kind: 'element', desc: '폭풍 탑 피해 +15%', mods: { elStorm: 0.15 } },
    earth_core: { name: '대지 핵', kind: 'element', desc: '대지 탑 피해 +15%', mods: { elEarth: 0.15 } },
    dawn_mirror: { name: '새벽 거울', kind: 'element', desc: '빛 탑 피해 +15%', mods: { elLight: 0.15 } },
    shadow_thorn: { name: '그림자 가시', kind: 'element', desc: '어둠 탑 피해 +15%', mods: { elDark: 0.15 } },
    pure_fork: { name: '순수 소리굽쇠', kind: 'resonance', desc: '순수 공명 효과 +20%', mods: { purePct: 0.2 } },
    amp_crystal: { name: '증폭 수정', kind: 'resonance', desc: '지원 탑 증폭 +5%p', mods: { ampPct: 0.05 } },
    triple_knot: { name: '세 갈래 매듭', kind: 'resonance', desc: '세 원소 이상 공명 피해 +10%', mods: { tripleDamagePct: 0.1 } },
    quad_drum: { name: '네 박자 북', kind: 'resonance', desc: '네 원소 공명 공격 속도 +10%', mods: { quadSpeedPct: 0.1 } },
    far_lens: { name: '망원 렌즈', kind: 'tower', desc: '탑 사거리 +10%', mods: { rangePct: 0.1 } },
    branch_plan: { name: '분기 설계도', kind: 'tower', desc: '분기 강화 비용 −20%', mods: { branchCostPct: -0.2 } },
    branch_blade: { name: '분기 칼날', kind: 'tower', desc: '분기한 탑 피해 +10%', mods: { branchDamagePct: 0.1 } },
    hero_cloak: { name: '영웅의 망토', kind: 'hero', desc: '영웅 체력 +25%', mods: { heroHpPct: 0.25 } },
    hero_blade: { name: '영웅의 칼', kind: 'hero', desc: '영웅 공격력 +20%', mods: { heroDamagePct: 0.2 } },
    clockwork: { name: '시계태엽', kind: 'hero', desc: '영웅 기술 재사용 −20%', mods: { heroCooldownPct: -0.2 } },
    quick_rise: { name: '빠른 부활', kind: 'hero', desc: '영웅 부활 시간 −40%', mods: { heroRespawnPct: -0.4 } },
    lore_book: { name: '경험의 책', kind: 'hero', desc: '영웅이 Lv2로 시작', mods: { heroStartLevel: 1 } },
    lamp_shield: { name: '등불 방패', kind: 'life', desc: '판마다 새는 적 2마리를 막음', mods: { leakShield: 2 } },
    life_dew: { name: '생명 이슬', kind: 'life', desc: '판을 이기면 불꽃 +1', mods: { winLife: 1 } },
    piggy_bank: { name: '은화 저금통', kind: 'life', desc: '은화 +25%', mods: { silverPct: 0.25 } },
    cursed_crown: { name: '저주받은 금관', kind: 'curse', desc: '적 체력 +10%, 은화 +50%', mods: { hpScale: 0.1, silverPct: 0.5 } },
    heavy_armor: { name: '무거운 갑옷', kind: 'curse', desc: '적 갑옷 +10%p, 시작 골드 +40%', mods: { armorAdd: 0.1, startGoldPct: 0.4 } },
    broken_glass: { name: '깨진 모래시계', kind: 'curse', desc: '카운트다운 절반, 현상금 +30%', mods: { countdownMul: 0.5, bountyPct: 0.3 } },
  },

  /** 사건 12종: 선택지 effect 키 — silver, lives, relic('random'|'curse'), upgrade('random'), addTower('random'), removeTower('random') */
  events: [
    { id: 'smith', title: '떠도는 대장장이', text: '망치를 멘 대장장이가 모닥불 곁에 앉아 있습니다. "은화 몇 닢이면 탑 하나 손봐 주지."', options: [
      { text: '은화 40을 내고 원정 강화', cost: { silver: 40 }, effect: { upgrade: 'random' } }, { text: '고맙다고 하고 지나간다', effect: {} }] },
    { id: 'spring', title: '별빛 샘', text: '구름 사이로 별빛이 고인 작은 샘이 반짝입니다.', options: [
      { text: '샘물을 마신다 (불꽃 +2)', effect: { lives: 2 } }, { text: '바닥의 동전을 줍는다 (은화 +30)', effect: { silver: 30 } }] },
    { id: 'chest', title: '수상한 상자', text: '길가에 이끼 낀 상자가 놓여 있습니다. 안에서 무언가 울립니다.', options: [
      { text: '연다 (유물 — 저주일지도)', effect: { relic: 'gamble' } }, { text: '건드리지 않는다', effect: {} }] },
    { id: 'spirit', title: '길 잃은 정령', text: '작은 정령이 길을 잃고 울고 있습니다. 데려다주면 보답하겠다고 합니다.', options: [
      { text: '데려다준다 (불꽃 −1, 원정 강화)', effect: { lives: -1, upgrade: 'random' } }, { text: '방향만 알려 준다 (은화 +15)', effect: { silver: 15 } }] },
    { id: 'fork', title: '안개 낀 갈림길', text: '지름길은 짙은 안개 속으로 이어집니다.', options: [
      { text: '안개 속 지름길 (은화 +60, 불꽃 −2)', effect: { silver: 60, lives: -2 } }, { text: '돌아간다', effect: {} }] },
    { id: 'recruit', title: '망루 수리공', text: '부서진 망루를 고치던 장인이 함께 가겠다고 합니다.', options: [
      { text: '함께 간다 (덱에 탑 하나)', effect: { addTower: 'random' } }, { text: '은화를 받는다 (은화 +25)', effect: { silver: 25 } }] },
    { id: 'shrine', title: '잊힌 사당', text: '금 간 종이 걸린 사당. 기도하면 무언가 바뀔 것 같습니다.', options: [
      { text: '기도한다 (유물 하나)', cost: { lives: 2 }, effect: { relic: 'random' } }, { text: '종을 닦아 준다 (불꽃 +1)', effect: { lives: 1 } }] },
    { id: 'merchant', title: '떠돌이 상인', text: '"오늘만 특가! 은화 50에 귀한 물건 하나!"', options: [
      { text: '산다 (은화 −50, 유물)', cost: { silver: 50 }, effect: { relic: 'random' } }, { text: '구경만 한다', effect: {} }] },
    { id: 'storm', title: '갑작스런 폭풍', text: '바람이 거세게 불어 장비가 날아갑니다.', options: [
      { text: '탑 하나를 지킨다 (덱에서 하나 빠짐, 은화 +40)', effect: { removeTower: 'random', silver: 40 } }, { text: '몸을 숙여 버틴다 (불꽃 −1)', effect: { lives: -1 } }] },
    { id: 'library', title: '별지기의 서고', text: '먼지 쌓인 두루마리에 탑을 다루는 비법이 적혀 있습니다.', options: [
      { text: '밤새 읽는다 (원정 강화)', effect: { upgrade: 'random' } }, { text: '책을 팔아 은화로 (은화 +35)', effect: { silver: 35 } }] },
    { id: 'gambler', title: '주사위 노름꾼', text: '"이기면 두 배, 지면 빈손이지."', options: [
      { text: '은화 30을 건다', cost: { silver: 30 }, effect: { gamble: 60 } }, { text: '거절한다', effect: {} }] },
    { id: 'campfire', title: '다른 수호대의 모닥불', text: '먼저 지나간 수호대가 남긴 따뜻한 모닥불입니다.', options: [
      { text: '쉬어 간다 (불꽃 +1)', effect: { lives: 1 } }, { text: '남은 보급품을 챙긴다 (은화 +20)', effect: { silver: 20 } }] },
  ],
};
