'use strict';

/* =========================================================
 * 영웅 성장 — 인연 레벨 · 재능 나무 · 장신구
 * 설계: docs/design/hero-growth.md (계산: js/core/growth.js, 판 반영: sim.js GR)
 * 효과 키(mods): hpPct damagePct atkSpeedPct takenPct(받는 피해 감소) cooldownPct skillPct respawnPct speedPct
 *   rangeAdd meleeDmgPct regenPct blockAdd bountyPct burnPct(초당 공격력 비율, 2초) slowPct
 *   chainPct(1.5칸 안 다른 적 하나) skillBoostPct(기술 후 주변 탑 공격 속도) towerAuraPct killCdr
 * 재능 고유 효과는 talent id(예: 'kara_atk')를 GR.has(...)로 읽음.
 * ========================================================= */

RG.data.growth = {
  bond: {
    max: 10,
    win: 3, perStar: 2, lose: 1, endlessPer: 10, endlessMax: 4,
    /** 다음 레벨까지 필요한 경험치 */
    need: (lv) => 4 + 2 * (lv - 1),
  },

  /** 공용 재능 칸 (갈래 · 단계). 3단계 공격·기술은 영웅 고유(아래 unique) */
  tree: {
    atk: [
      { id: 'atk1', name: '날 선 공격', desc: '공격력 +10%', mods: { damagePct: 0.1 } },
      { id: 'atk2', name: '빠른 손', desc: '공격 속도 +10%', mods: { atkSpeedPct: 0.1 } },
    ],
    sur: [
      { id: 'sur1', name: '단단한 몸', desc: '체력 +15%', mods: { hpPct: 0.15 } },
      { id: 'sur2', name: '버티기', desc: '받는 피해 −10%', mods: { takenPct: 0.1 } },
      { id: 'sur3', name: '되살아남', desc: '부활 시간 −40%', mods: { respawnPct: 0.4 } },
    ],
    sk: [
      { id: 'sk1', name: '익숙한 손놀림', desc: '기술 재사용 −10%', mods: { cooldownPct: 0.1 } },
      { id: 'sk2', name: '깊은 울림', desc: '기술 위력 +15%', mods: { skillPct: 0.15 } },
    ],
  },
  branches: [
    { key: 'atk', name: '공격', icon: 'damage' },
    { key: 'sur', name: '생존', icon: 'hp' },
    { key: 'sk', name: '기술', icon: 'skill' },
  ],

  /** 영웅 고유 재능 — [공격 갈래 끝, 기술 갈래 끝] */
  unique: {
    kara: [
      { name: '달군 망치', desc: '공격에 화상(초당 공격력의 40%, 2초)', mods: { burnPct: 0.4 } },
      { name: '용암 자국', desc: '내려찍은 자리에 4초 불길 장판(반경 1.2칸, 초당 18)', lava: { radius: 1.2, dps: 18, dur: 4 } },
    ],
    sera: [
      { name: '빛 퍼짐', desc: '공격이 맞힌 적 둘레 0.6칸에 60% 피해', splash: { radius: 0.6, pct: 0.6 } },
      { name: '새벽의 축복', desc: '기도 반경 안의 탑 6초 공격 속도 +25%', boost: { pct: 0.25, dur: 6 } },
    ],
    sio: [
      { name: '꿰뚫는 화살', desc: '맞힌 적 뒤(1칸 안)의 적 하나도 60% 피해', pierce: { radius: 1.0, pct: 0.6 } },
      { name: '깊은 얼음', desc: '화살비 반경 +0.4칸, 빙결 +1초', radiusAdd: 0.4, freezeAdd: 1 },
    ],
    zena: [
      { name: '과충전', desc: '연쇄 +2회', chainAdd: 2 },
      { name: '쌍둥이 드론', desc: '드론이 둘', drones: 2 },
    ],
    bawi: [
      { name: '지진 주먹', desc: '세 번째 공격마다 주변 1칸 적 0.6초 기절(보스 제외)', quake: { every: 3, radius: 1.0, stun: 0.6 } },
      { name: '가시 벽', desc: '벽에 붙잡힌 적은 초당 25 피해', wallDps: 25 },
    ],
    yaro: [
      { name: '급소', desc: '치명타 확률 +15%p, 치명타 2.5배', crit: { chance: 0.15, mult: 2.5 } },
      { name: '그림자 분신', desc: '습격 뒤 1.5칸 안 다른 적 하나에게 60% 습격', echo: { radius: 1.5, pct: 0.6 } },
    ],
    haru: [
      { name: '큰 눈덩이', desc: '눈덩이가 0.6칸 범위에 60% 피해', splash: { radius: 0.6, pct: 0.6 } },
      { name: '눈사람 대가족', desc: '눈사람 +1, 눈사람 체력 +30%', countAdd: 1, hpPct: 0.3 },
    ],
    dohan: [
      { name: '튕기는 망치', desc: '맞힌 뒤 1.5칸 안 다른 적 하나에 60% 피해', bounce: { radius: 1.5, pct: 0.6 } },
      { name: '이웃 담금질', desc: '고른 탑과 이웃한 탑(1.5칸 안)도 함께 담금질', spread: 1.5 },
    ],
    narae: [
      { name: '바람 칼날', desc: '공격이 적을 0.15칸 밀어냄(보스·큰 적 제외)', push: 0.15 },
      { name: '회오리 급강하', desc: '내리꽂은 자리 반경 1.2칸 적 0.8초 기절(보스 제외)', landStun: { radius: 1.2, stun: 0.8 } },
    ],
    tori: [
      { name: '독 포자', desc: '맞은 적 3초 동안 초당 공격력의 35% 피해', poison: { pct: 0.35, dur: 3 } },
      { name: '오래가는 거인', desc: '변신 +5초, 변신할 때 주변 1.5칸 적 1초 기절(보스 제외)', durAdd: 5, roar: { radius: 1.5, stun: 1 } },
    ],
    byeori: [
      { name: '큰곰자리', desc: '별자리가 다섯 번째 → 세 번째 공격마다', every: 3 },
      { name: '유성우', desc: '큰 유성 둘레에 작은 유성 둘(각 60% 피해)', shower: { count: 2, pct: 0.6, offset: 1.1, radius: 0.9 } },
    ],
    mujin: [
      { name: '무거운 종소리', desc: '고요한 종 반경 +1칸, 받는 피해 +5%p', radiusAdd: 1, vulnAdd: 0.05 },
      { name: '긴 울림', desc: '멈춤 +1초, 탑 공격 속도 +20%p', stopAdd: 1, towerAdd: 0.2 },
    ],
  },

  /** 장신구 18종 — rarity: common·rare·epic. mods 값은 +0 기준(강화 단계마다 +20%, 같은 원소 영웅 +25%) */
  gearRarities: {
    common: { name: '일반', costs: [30, 60, 90], color: '#c9c3d6' },
    rare: { name: '희귀', costs: [50, 100, 150], color: '#6fb8ff' },
    epic: { name: '영웅', costs: [80, 160, 240], color: '#c890ff' },
  },
  gearMaxPlus: 3,
  gearPlusStep: 0.2,
  gearSameElement: 0.25,
  gearDupCrystals: 50,
  gear: {
    ember_ring: { name: '불씨 반지', element: 'fire', rarity: 'common', desc: '공격에 화상(초당 공격력의 {burnPct}, 2초)', mods: { burnPct: 0.2 } },
    frost_bead: { name: '서리 구슬', element: 'frost', rarity: 'common', desc: '공격에 맞은 적 {slowPct} 감속(1초)', mods: { slowPct: 0.15 } },
    wind_feather: { name: '바람 깃털', element: 'storm', rarity: 'common', desc: '이동 속도 +{speedPct}', mods: { speedPct: 0.25 } },
    pebble_charm: { name: '조약돌 부적', element: 'earth', rarity: 'common', desc: '체력 +{hpPct}', mods: { hpPct: 0.15 } },
    light_shard: { name: '빛 조각', element: 'light', rarity: 'common', desc: '원거리 사거리 +{rangeAdd}칸 (근접은 공격력 +{meleeDmgPct})', mods: { rangeAdd: 0.4, meleeDmgPct: 0.08 } },
    shadow_ribbon: { name: '그림자 리본', element: 'dark', rarity: 'common', desc: '영웅이 처치한 적의 현상금 +{bountyPct}', mods: { bountyPct: 0.2 } },
    forge_glove: { name: '대장간 장갑', element: 'fire', rarity: 'rare', desc: '공격력 +{damagePct}', mods: { damagePct: 0.12 } },
    snow_brooch: { name: '눈꽃 브로치', element: 'frost', rarity: 'rare', desc: '받는 피해 −{takenPct}', mods: { takenPct: 0.12 } },
    thunder_bell: { name: '번개 방울', element: 'storm', rarity: 'rare', desc: '공격 속도 +{atkSpeedPct}', mods: { atkSpeedPct: 0.12 } },
    moss_cloak: { name: '이끼 망토', element: 'earth', rarity: 'rare', desc: '매초 최대 체력 {regenPct} 회복', mods: { regenPct: 0.015 } },
    lantern_shard: { name: '등불 조각', element: 'light', rarity: 'rare', desc: '기술을 쓰면 주변 2칸 탑 5초 공격 속도 +{skillBoostPct}', mods: { skillBoostPct: 0.15 } },
    night_key: { name: '밤의 열쇠', element: 'dark', rarity: 'rare', desc: '기술 재사용 −{cooldownPct}', mods: { cooldownPct: 0.12 } },
    phoenix_plume: { name: '불사조 깃', element: 'fire', rarity: 'epic', desc: '부활 시간 −{respawnPct}', mods: { respawnPct: 0.5 } },
    glacier_heart: { name: '빙하 심장', element: 'frost', rarity: 'epic', desc: '기술 위력 +{skillPct}', mods: { skillPct: 0.2 } },
    storm_gem: { name: '폭풍 눈', element: 'storm', rarity: 'epic', desc: '공격이 1.5칸 안 다른 적 하나에게 튐({chainPct} 피해)', mods: { chainPct: 0.5 } },
    titan_belt: { name: '거인의 허리띠', element: 'earth', rarity: 'epic', desc: '붙잡기 +1, 체력 +{hpPct}', mods: { blockAdd: 1, hpPct: 0.1 } },
    dawn_circlet: { name: '새벽 왕관', element: 'light', rarity: 'epic', desc: '영웅 주변 2칸 탑 피해 +{towerAuraPct}', mods: { towerAuraPct: 0.08 } },
    void_ring: { name: '공허 반지', element: 'dark', rarity: 'epic', desc: '영웅이 처치할 때마다 기술 재사용 대기 −{killCdr}초', mods: { killCdr: 0.6 } },
  },
  gearOrder: ['ember_ring', 'frost_bead', 'wind_feather', 'pebble_charm', 'light_shard', 'shadow_ribbon',
    'forge_glove', 'snow_brooch', 'thunder_bell', 'moss_cloak', 'lantern_shard', 'night_key',
    'phoenix_plume', 'glacier_heart', 'storm_gem', 'titan_belt', 'dawn_circlet', 'void_ring'],
  /** 정수로 남는 효과(강화·원소 배율을 받지 않음) */
  flatMods: ['blockAdd'],
  /** 비율 합계 상한 */
  caps: { takenPct: 0.5, cooldownPct: 0.5, respawnPct: 0.8 },
  /** 무한 기록 보상 웨이브 */
  endlessMilestones: [10, 20, 30, 40],
};
