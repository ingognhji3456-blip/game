'use strict';

/* =========================================================
 * 카드 & 적 데이터
 *
 * 새 카드나 적을 추가하려면 이 파일만 고치면 됩니다.
 * 카드 설명 문구는 effects 를 보고 자동으로 만들어집니다.
 *
 * 사용할 수 있는 효과(effect.type)
 *   damage          대상에게 피해 (value, times: 반복 횟수)
 *   damageFromBlock 현재 내 방어도만큼 대상에게 피해
 *   block           방어도 획득 (턴이 돌아오면 사라짐)
 *   heal            체력 회복
 *   loseHp          내 체력 감소 (방어도 무시)
 *   strength        힘 증가 → 공격 피해 +value
 *   weak            대상에게 약화 value턴 → 주는 공격 피해 25% 감소
 *   poison          대상에게 독 value → 턴 시작 시 value 피해 후 1 감소
 *   draw            카드 value장 뽑기 (플레이어 전용)
 *   energy          에너지 value 획득 (플레이어 전용)
 * ========================================================= */

// type: 'attack'(공격) | 'skill'(스킬) | 'power'(파워)
// exhaust: true 이면 사용 후 이번 전투에서 제외(소멸)
const CARD_LIBRARY = {
  // --- 시작 덱 카드 ---
  strike: { name: '베기', cost: 1, type: 'attack', effects: [{ type: 'damage', value: 6 }] },
  defend: { name: '막기', cost: 1, type: 'skill', effects: [{ type: 'block', value: 5 }] },
  bash: {
    name: '강타', cost: 2, type: 'attack',
    effects: [{ type: 'damage', value: 8 }, { type: 'weak', value: 2 }],
  },

  // --- 보상으로 얻는 카드 ---
  twinSlash: { name: '연속 베기', cost: 1, type: 'attack', effects: [{ type: 'damage', value: 3, times: 2 }] },
  whirlwind: { name: '회오리 베기', cost: 2, type: 'attack', effects: [{ type: 'damage', value: 4, times: 3 }] },
  guardStrike: {
    name: '공방일체', cost: 1, type: 'attack',
    effects: [{ type: 'damage', value: 5 }, { type: 'block', value: 4 }],
  },
  recklessCharge: {
    name: '무모한 돌진', cost: 0, type: 'attack',
    effects: [{ type: 'damage', value: 9 }, { type: 'loseHp', value: 3 }],
  },
  shieldBash: { name: '방패 밀치기', cost: 1, type: 'attack', effects: [{ type: 'damageFromBlock' }] },
  venomBlade: {
    name: '독칼', cost: 1, type: 'attack',
    effects: [{ type: 'damage', value: 3 }, { type: 'poison', value: 4 }],
  },
  plague: { name: '역병', cost: 2, type: 'skill', exhaust: true, effects: [{ type: 'poison', value: 10 }] },
  ironWall: { name: '철벽', cost: 2, type: 'skill', effects: [{ type: 'block', value: 13 }] },
  firstAid: { name: '응급 처치', cost: 1, type: 'skill', exhaust: true, effects: [{ type: 'heal', value: 7 }] },
  focus: { name: '집중', cost: 0, type: 'skill', exhaust: true, effects: [{ type: 'draw', value: 2 }] },
  adrenaline: {
    name: '아드레날린', cost: 0, type: 'skill', exhaust: true,
    effects: [{ type: 'energy', value: 1 }, { type: 'draw', value: 1 }],
  },
  rage: { name: '분노', cost: 1, type: 'power', exhaust: true, effects: [{ type: 'strength', value: 2 }] },
};

// 게임 시작 시 덱 구성
const STARTER_DECK = [
  'strike', 'strike', 'strike', 'strike', 'strike',
  'defend', 'defend', 'defend', 'defend',
  'bash',
];

// 전투 승리 후 보상으로 나올 수 있는 카드
const REWARD_POOL = [
  'twinSlash', 'whirlwind', 'guardStrike', 'recklessCharge', 'shieldBash',
  'venomBlade', 'plague', 'ironWall', 'firstAid', 'focus', 'adrenaline', 'rage',
];

// 순서대로 등장하는 적. 마지막 적을 쓰러뜨리면 게임 클리어.
// intents: 적이 턴마다 차례대로(반복) 하는 행동. 행동 하나 = 효과 목록.
const ENEMY_LIBRARY = [
  {
    name: '숲 슬라임', emoji: '🟢', maxHp: 28,
    intents: [
      [{ type: 'damage', value: 6 }],
      [{ type: 'block', value: 6 }, { type: 'damage', value: 3 }],
      [{ type: 'damage', value: 8 }],
    ],
  },
  {
    name: '해골 병사', emoji: '💀', maxHp: 38,
    intents: [
      [{ type: 'damage', value: 4, times: 2 }],
      [{ type: 'weak', value: 2 }, { type: 'damage', value: 4 }],
      [{ type: 'damage', value: 10 }],
    ],
  },
  {
    name: '그림자 마법사', emoji: '🧙', maxHp: 45,
    intents: [
      [{ type: 'poison', value: 3 }],
      [{ type: 'damage', value: 8 }],
      [{ type: 'strength', value: 2 }, { type: 'block', value: 5 }],
      [{ type: 'damage', value: 5, times: 2 }],
    ],
  },
  {
    name: '고대 골렘', emoji: '🗿', maxHp: 80, boss: true,
    intents: [
      [{ type: 'block', value: 12 }],
      [{ type: 'damage', value: 14 }],
      [{ type: 'strength', value: 2 }],
      [{ type: 'damage', value: 4, times: 3 }],
    ],
  },
];
