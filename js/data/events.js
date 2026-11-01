'use strict';

/* =========================================================
 * 이벤트 데이터 — 실행 효과 문법은 docs/ARCHITECTURE.md §4.7
 * ========================================================= */
CB.data.events = {
  /* ================= 1막 ================= */
  mossShrine: {
    name: '이끼 낀 제단', acts: [1, 2], scene: 'shrine',
    text: '빽빽한 숲 한가운데, 이끼로 뒤덮인 돌 제단이 희미한 녹빛을 내뿜고 있다. 제단 위 움푹 팬 홈에는 오래된 동전 몇 닢이 놓여 있다.',
    choices: [
      {
        label: '무릎 꿇고 기도한다', preview: '최대 체력 +6',
        outcomes: [{ text: '따스한 기운이 온몸을 감싼다. 몸이 한결 단단해진 느낌이다.', effects: [{ type: 'gainMaxHp', value: 6 }] }],
      },
      {
        label: '동전을 바친다', preview: '골드 -40, 무작위 유물', require: { gold: 40 },
        outcomes: [{ text: '동전이 홈에 닿자 제단이 갈라지며 작은 보물이 떠오른다.', effects: [{ type: 'loseGold', value: 40 }, { type: 'gainRelic', relic: 'random' }] }],
      },
      {
        label: '동전을 챙긴다', preview: '골드 +35, 저주 「후회」',
        outcomes: [{ text: '주머니가 묵직해졌다. 등 뒤로 차가운 시선이 따라붙는 것 같다.', effects: [{ type: 'gainGold', value: 35 }, { type: 'addCurse', card: 'regret' }] }],
      },
      { label: '그냥 지나간다', preview: '아무 일도 없다', outcomes: [{ text: '당신은 제단을 뒤로하고 길을 재촉했다.', effects: [] }] },
    ],
  },

  glowingMushrooms: {
    name: '빛나는 버섯 군락', acts: [1], scene: 'forest',
    text: '쓰러진 고목 아래, 푸르스름하게 빛나는 버섯들이 둥글게 자라 있다. 은은한 단내가 코끝을 간지럽힌다.',
    choices: [
      {
        label: '하나 먹어 본다', preview: '50%: 최대 체력 +5, 체력 회복 / 50%: 체력 -8',
        outcomes: [
          { weight: 1, text: '쌉싸름한 맛 뒤로 활력이 솟는다!', effects: [{ type: 'gainMaxHp', value: 5 }, { type: 'heal', value: 12 }] },
          { weight: 1, text: '속이 뒤집힌다... 한참을 주저앉아 있어야 했다.', effects: [{ type: 'loseHp', value: 8 }] },
        ],
      },
      {
        label: '조심스럽게 채집한다', preview: '무작위 물약',
        outcomes: [{ text: '버섯 즙을 짜내 작은 병에 담았다.', effects: [{ type: 'gainPotion', potion: 'random' }] }],
      },
      { label: '떠난다', preview: '아무 일도 없다', outcomes: [{ text: '수상한 것은 건드리지 않는 게 상책이다.', effects: [] }] },
    ],
  },

  fallenAdventurer: {
    name: '쓰러진 모험가', acts: [1, 2], scene: 'chest',
    text: '길가에 낡은 배낭을 멘 모험가가 쓰러져 있다. 이미 숨이 끊어진 지 오래다. 근처 덤불에서 무언가 낮게 으르렁거린다.',
    choices: [
      {
        label: '배낭을 뒤진다', preview: '70%: 골드 +50 / 30%: 늑대와 전투',
        outcomes: [
          { weight: 7, text: '배낭 안에서 두둑한 돈주머니를 찾았다.', effects: [{ type: 'gainGold', value: 50 }] },
          { weight: 3, text: '덤불에서 굶주린 늑대가 뛰쳐나왔다!', effects: [{ type: 'combat', enemies: ['wolf'], kind: 'normal' }] },
        ],
      },
      {
        label: '묻어 준다', preview: '카드 1장 강화',
        outcomes: [{ text: '흙을 덮으며 그의 무기를 손질해 두었다. 당신의 무기도 함께.', effects: [{ type: 'upgradeCard', count: 1 }] }],
      },
      { label: '서둘러 떠난다', preview: '아무 일도 없다', outcomes: [{ text: '으르렁거림이 멀어진다.', effects: [] }] },
    ],
  },

  lostTraveler: {
    name: '길 잃은 나그네', acts: [1, 3], scene: 'stranger',
    text: '누더기를 걸친 나그네가 지팡이에 기댄 채 길을 묻는다. "멀리서 왔는데, 먹을 것이 다 떨어졌소."',
    choices: [
      {
        label: '식량을 나눠 준다', preview: '체력 -6, 무작위 유물',
        outcomes: [{ text: '"고맙소, 젊은이." 나그네가 품에서 무언가를 꺼내 건넨다.', effects: [{ type: 'loseHp', value: 6 }, { type: 'gainRelic', relic: 'random', rarity: 'common' }] }],
      },
      {
        label: '길을 알려 준다', preview: '카드 1장 제거',
        outcomes: [{ text: '함께 걸으며 이야기를 나누다 보니 마음속 짐 하나를 내려놓을 수 있었다.', effects: [{ type: 'removeCard', count: 1 }] }],
      },
      { label: '외면한다', preview: '아무 일도 없다', outcomes: [{ text: '나그네의 한숨이 등 뒤로 흩어진다.', effects: [] }] },
    ],
  },

  /* ================= 2막 ================= */
  bloodWell: {
    name: '핏빛 우물', acts: [2], scene: 'well',
    text: '무너진 성채 안뜰, 붉은 물이 찰랑이는 우물이 있다. 물 위에 비친 당신의 얼굴이 미소 짓는다. 당신은 웃고 있지 않은데도.',
    choices: [
      {
        label: '물을 마신다', preview: '체력 -10, 카드 2장 강화',
        outcomes: [{ text: '쇠 맛이 혀를 감싸고, 머릿속에 낯선 검술이 스쳐 지나간다.', effects: [{ type: 'loseHp', value: 10 }, { type: 'upgradeCard', count: 2 }] }],
      },
      {
        label: '동전을 던진다', preview: '골드 -30, 무작위 물약, 체력 +15', require: { gold: 30 },
        outcomes: [{ text: '동전이 가라앉자 물이 맑아지며 작은 병 하나가 떠오른다.', effects: [{ type: 'loseGold', value: 30 }, { type: 'gainPotion', potion: 'random' }, { type: 'heal', value: 15 }] }],
      },
      { label: '떠난다', preview: '아무 일도 없다', outcomes: [{ text: '당신은 우물에서 시선을 거두었다.', effects: [] }] },
    ],
  },

  boneCollector: {
    name: '뼈 수집가', acts: [2], scene: 'stranger',
    text: '해골 가면을 쓴 상인이 뼈로 엮은 수레를 끌고 나타난다. "필요 없는 기억을 사겠소. 값은 후하게 쳐 드리지."',
    choices: [
      {
        label: '카드를 판다', preview: '카드 1장 제거, 골드 +50',
        outcomes: [{ text: '"좋은 거래였소." 그가 뼈 동전을 세어 건넨다.', effects: [{ type: 'removeCard', count: 1 }, { type: 'gainGold', value: 50 }] }],
      },
      {
        label: '진열품을 산다', preview: '골드 -90, 희귀 유물', require: { gold: 90 },
        outcomes: [{ text: '그가 수레 깊숙한 곳에서 묘한 빛을 내는 물건을 꺼낸다.', effects: [{ type: 'loseGold', value: 90 }, { type: 'gainRelic', relic: 'random', rarity: 'rare' }] }],
      },
      { label: '거절한다', preview: '아무 일도 없다', outcomes: [{ text: '"언제든 다시 찾으시오." 수레 소리가 멀어진다.', effects: [] }] },
    ],
  },

  cryptLibrary: {
    name: '무너진 서고', acts: [2, 3], scene: 'crypt',
    text: '천장이 내려앉은 지하 서고. 먼지 쌓인 책장 사이로 금박이 벗겨진 고서 한 권이 저절로 펼쳐져 있다.',
    choices: [
      {
        label: '고서를 읽는다', preview: '희귀 카드 1장, 저주 「의심」',
        outcomes: [{ text: '금지된 지식이 머릿속으로 흘러든다. 대가는 마음 한구석에 남았다.', effects: [{ type: 'addRandomCard', rarity: 'rare', count: 1 }, { type: 'addCurse', card: 'doubt' }] }],
      },
      {
        label: '필사본을 훑어본다', preview: '무작위 카드 1장 강화',
        outcomes: [{ text: '흥미로운 전술 몇 가지를 익혔다.', effects: [{ type: 'upgradeRandom', count: 1 }] }],
      },
      { label: '떠난다', preview: '아무 일도 없다', outcomes: [{ text: '책이 스르륵 덮였다.', effects: [] }] },
    ],
  },

  darkAltar: {
    name: '검은 제단', acts: [2], scene: 'altar',
    text: '촛농이 굳은 검은 제단 앞에 신도들의 시신이 둘러앉아 있다. 제단 중앙의 단검이 피를 갈구하듯 떨린다.',
    choices: [
      {
        label: '피를 바친다', preview: '최대 체력 -6, 무작위 희귀 유물',
        outcomes: [{ text: '단검이 손바닥을 스치자 제단이 검게 빛나며 보물을 토해 낸다.', effects: [{ type: 'loseMaxHp', value: 6 }, { type: 'gainRelic', relic: 'random', rarity: 'rare' }] }],
      },
      {
        label: '제단을 부순다', preview: '어둠 신도 둘과 전투',
        outcomes: [{ text: '제단이 무너지자 시신 사이에서 신도 둘이 일어선다!', effects: [{ type: 'combat', enemies: ['zealot', 'zealot'], kind: 'normal' }] }],
      },
      { label: '물러난다', preview: '아무 일도 없다', outcomes: [{ text: '단검의 떨림이 잦아든다.', effects: [] }] },
    ],
  },

  /* ================= 3막 ================= */
  lavaForge: {
    name: '용암 대장간', acts: [3], scene: 'lava',
    text: '용암이 흐르는 협곡 끝, 버려진 대장간의 모루가 아직도 붉게 달아올라 있다. 망치 하나가 당신을 기다리듯 놓여 있다.',
    choices: [
      {
        label: '무기를 담금질한다', preview: '체력 -12, 카드 2장 강화',
        outcomes: [{ text: '불꽃이 튀며 손이 데었지만, 칼날은 전보다 날카롭게 빛난다.', effects: [{ type: 'loseHp', value: 12 }, { type: 'upgradeCard', count: 2 }] }],
      },
      {
        label: '장비를 녹인다', preview: '카드 2장 제거, 체력 -6',
        outcomes: [{ text: '쓸모없는 것들을 용암에 던져 넣었다. 한결 가벼워졌다.', effects: [{ type: 'removeCard', count: 2 }, { type: 'loseHp', value: 6 }] }],
      },
      { label: '떠난다', preview: '아무 일도 없다', outcomes: [{ text: '열기를 피해 발걸음을 돌렸다.', effects: [] }] },
    ],
  },

  whisperingChest: {
    name: '속삭이는 상자', acts: [3], scene: 'chest',
    text: '바위 틈에 끼인 쇠 상자에서 속삭임이 새어 나온다. "열어... 열어 줘... 보답할게..."',
    choices: [
      {
        label: '상자를 연다', preview: '50%: 무작위 유물 / 50%: 저주 「부패」 + 골드 +100',
        outcomes: [
          { weight: 1, text: '상자 안에는 정말로 보물이 들어 있었다!', effects: [{ type: 'gainRelic', relic: 'random' }] },
          { weight: 1, text: '검은 연기가 솟아 몸에 스며든다. 상자 바닥에는 금화만 잔뜩 남았다.', effects: [{ type: 'addCurse', card: 'decay' }, { type: 'gainGold', value: 100 }] },
        ],
      },
      { label: '무시한다', preview: '아무 일도 없다', outcomes: [{ text: '속삭임이 원망으로 바뀌었다가 이내 잠잠해진다.', effects: [] }] },
    ],
  },

  fallenStar: {
    name: '떨어진 별', acts: [3], scene: 'altar',
    text: '어두운 심연 한가운데, 하늘에서 떨어진 별 조각이 차갑게 빛나고 있다. 가까이 다가가자 심장 박동이 별빛에 맞춰 뛰기 시작한다.',
    choices: [
      {
        label: '별 조각을 삼킨다', preview: '최대 체력 +10, 저주 「족쇄」',
        outcomes: [{ text: '온몸이 별빛으로 들끓는다. 무언가 무거운 것이 함께 따라왔다.', effects: [{ type: 'gainMaxHp', value: 10 }, { type: 'addCurse', card: 'shackles' }] }],
      },
      {
        label: '별빛 아래 쉰다', preview: '최대 체력의 40% 회복',
        outcomes: [{ text: '차가운 빛이 상처를 어루만진다.', effects: [{ type: 'healPct', value: 0.4 }] }],
      },
      { label: '떠난다', preview: '아무 일도 없다', outcomes: [{ text: '별빛이 등 뒤에서 깜빡였다.', effects: [] }] },
    ],
  },

  /* ================= 모든 막 ================= */
  wanderingPeddler: {
    name: '떠돌이 행상', acts: [1, 2, 3], scene: 'stranger',
    text: '방울 소리와 함께 커다란 짐을 진 행상이 나타난다. "어이, 원정대 양반! 좋은 물건 있소!"',
    choices: [
      {
        label: '물약을 산다', preview: '골드 -30, 무작위 물약', require: { gold: 30 },
        outcomes: [{ text: '"현명한 선택이오!"', effects: [{ type: 'loseGold', value: 30 }, { type: 'gainPotion', potion: 'random' }] }],
      },
      {
        label: '부적을 산다', preview: '골드 -60, 카드 1장 제거', require: { gold: 60 },
        outcomes: [{ text: '부적을 태우자 덱에서 쓸모없던 기억 하나가 사라졌다.', effects: [{ type: 'loseGold', value: 60 }, { type: 'removeCard', count: 1 }] }],
      },
      { label: '구경만 한다', preview: '아무 일도 없다', outcomes: [{ text: '"다음에 또 봅시다!"', effects: [] }] },
    ],
  },
};

for (const [id, event] of Object.entries(CB.data.events)) event.id = id;
