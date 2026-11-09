'use strict';

/* =========================================================
 * 영웅 6명 — 설계: docs/design/heroes.md
 * 필드 뜻: docs/ARCHITECTURE.md §3.4
 * lines(대사)는 heroes.md 대사표와 같아야 합니다(테스트 검사).
 * ========================================================= */

RG.data.heroXp = [0, 8, 20, 38, 62];           // Lv1~5 누적 경험치 (일반 적 처치 1, 정예 3, 보스 10, 근처 처치 절반)
RG.data.heroLevelBonus = { stat: 0.12, skill: 0.1, lv5Cooldown: 0.1 };

RG.data.heroes = {
  kara: {
    name: '카라', element: 'fire', title: '솔빛의 망치', color: '#ff6b3d', unlock: '1-1',
    hp: 360, damage: 16, interval: 1.0, range: 0.75, melee: true, block: 3, speed: 1.6, armor: 0.15,
    splash: 0.6, targets: 'ground',
    skill: {
      id: 'flame_slam', name: '불꽃 내려찍기', cooldown: 18, target: 'point', radius: 1.5, damage: 70, burn: { dps: 10, dur: 3 },
      desc: '고른 곳으로 뛰어올라 내려찍습니다. 반경 1.5칸 피해와 화상, 주변 적을 붙잡습니다.',
    },
    passive: { id: 'unyielding', name: '불굴', threshold: 0.3, reduce: 0.3, desc: '체력 30% 이하일 때 받는 피해 −30%.' },
    bio: '마을이 좋아서 망치를 든, 앞뒤 안 가리는 대장장이 딸.',
    lines: {
      select: ['카라, 준비 끝! 어디부터 부숴 줄까?', '망치는 오늘도 뜨끈뜨끈해!', '등불은 내가 지킨다!'],
      move: ['알았어!', '거기로 간다!', '금방 갈게!'],
      skill: ['불꽃 내려찍기!', '다 비켜어어!'],
      down: ['으윽… 금방… 일어날 거야…!'],
      revive: ['다시 왔다! 아까 건 실수야!'],
      win: ['봤지? 솔빛 마을 사람은 안 물러나!'],
    },
  },

  sera: {
    name: '세라', element: 'light', title: '견습 등불지기', color: '#ffe48a', unlock: '1-4',
    hp: 200, damage: 12, interval: 1.1, range: 2.6, melee: false, block: 1, speed: 1.5, armor: 0.05,
    projSpeed: 8, targets: 'both',
    skill: {
      id: 'dawn_prayer', name: '새벽의 기도', cooldown: 22, target: 'point', radius: 2.0, heal: 120, damage: 60, blind: 3,
      desc: '고른 곳 반경 2칸의 영웅·병사를 크게 회복하고, 적에게 피해와 실명을 줍니다.',
    },
    passive: { id: 'lamp_keeper', name: '등불지기', detect: 1.8, regen: 0.01, desc: '주변 1.8칸의 숨은 적을 드러내고, 자신은 매초 체력 1%를 회복합니다.' },
    bio: '겁은 많지만 등불만큼은 절대 놓지 않는 견습 등불지기.',
    lines: {
      select: ['세라예요. 등불은 제가 지킬게요.', '빛이 닿는 곳이라면 괜찮아요.', '다들, 다치지 마세요.'],
      move: ['네, 그쪽으로요.', '따라갈게요.', '조심해서 갈게요.'],
      skill: ['새벽이여, 비춰 주세요.', '모두 일어나요!'],
      down: ['죄송해요… 잠깐만…'],
      revive: ['다시 비출게요. 이번엔 꺼지지 않아요.'],
      win: ['등불이… 아직 따뜻해요. 다행이다.'],
    },
  },

  sio: {
    name: '시오', element: 'frost', title: '고개 파수꾼', color: '#5fd4ff', unlock: '2-1',
    hp: 220, damage: 34, interval: 1.6, range: 4.2, melee: false, block: 0, speed: 1.5, armor: 0.05,
    projSpeed: 14, targets: 'both',
    skill: {
      id: 'frost_volley', name: '서리 화살비', cooldown: 20, target: 'point', delay: 1.0, radius: 1.8, damage: 80, freeze: 1.5,
      desc: '고른 곳에 1초 뒤 화살비가 쏟아집니다. 반경 1.8칸 피해와 빙결.',
    },
    passive: { id: 'cold_aim', name: '냉정한 조준', critChance: 0.3, critMult: 2, desc: '감속·빙결된 적에게 치명타 확률 30%.' },
    bio: '사라진 동생을 찾아 안개 속을 겨누는, 말 없는 고개 파수꾼.',
    lines: {
      select: ['시오. 겨눈다.', '바람이 차다. 좋다.', '…하루, 기다려.'],
      move: ['간다.', '자리 잡는다.', '알았다.'],
      skill: ['얼어라.', '비가 온다. 서리의.'],
      down: ['…아직이다.'],
      revive: ['다시 겨눈다.'],
      win: ['…끝났다. 다음.'],
    },
  },

  zena: {
    name: '제나', element: 'storm', title: '떠돌이 발명가', color: '#9b8cff', unlock: '3-1',
    hp: 210, damage: 14, interval: 1.0, range: 3.0, melee: false, block: 0, speed: 1.6, armor: 0.05,
    chain: { count: 2, falloff: 0.3, radius: 1.5 }, targets: 'both',
    skill: {
      id: 'thunder_drone', name: '번개 드론', cooldown: 25, target: 'point', duration: 10,
      drone: { damage: 22, interval: 0.8, range: 2.5, chain: { count: 3, falloff: 0.25, radius: 1.5 } },
      desc: '고른 곳에 10초 동안 연쇄 번개를 쏘는 드론을 띄웁니다.',
    },
    passive: { id: 'field_mod', name: '현장 개조', radius: 2.0, every: 4, damage: 12, desc: '주변 2칸 탑의 공격 4번에 1번, 대상에게 작은 번개가 덧붙습니다.' },
    bio: '안개마저 연구 대상으로 보는, 수다스러운 떠돌이 발명가.',
    lines: {
      select: ['제나 등장! 오늘의 실험, 시작합니다!', '코일 충전 완료, 아마도!', '안개 표본 채집해도 돼요?'],
      move: ['이동, 이동!', '거기 좋은 데이터 나올 것 같아요!', '금방 가요!'],
      skill: ['드론 3호, 출동!', '지지직— 성공이다!'],
      down: ['으앗, 과부하…! 기록해 둬요…!'],
      revive: ['재부팅 완료! 아까보다 7% 더 똑똑해졌어요!'],
      win: ['가설 입증! 우리 수호대가 최고라는 가설이요!'],
    },
  },

  bawi: {
    name: '바위', element: 'earth', title: '돌의 수호자', color: '#8fcf5a', unlock: '4-1',
    hp: 650, damage: 12, interval: 1.2, range: 0.8, melee: true, block: 4, speed: 1.1, armor: 0.3,
    splash: 0.5, targets: 'ground',
    skill: {
      id: 'earth_wall', name: '대지의 벽', cooldown: 24, target: 'path', duration: 8, wallHp: 600,
      desc: '고른 길 칸에 8초 동안 바위 벽을 세웁니다. 벽은 지상 적을 몇 명이든 붙잡습니다.',
    },
    passive: { id: 'moss_armor', name: '이끼 갑옷', regen: 0.02, desc: '매초 최대 체력의 2%를 회복합니다.' },
    bio: '대종이 처음 울린 날 태어난, 느리고 다정한 돌의 수호자.',
    lines: {
      select: ['바위요… 막아 보겠소.', '허허, 오랜만에 몸을 푸는구려.', '등불이 참 따뜻하오.'],
      move: ['가오…', '천천히, 그러나 반드시.', '그리로 가겠소.'],
      skill: ['땅이여, 일어나시오.', '여기서부터는… 못 지나가오.'],
      down: ['허허… 잠깐 눈을 붙이겠소…'],
      revive: ['다시 일어났소. 돌은 쉽게 부서지지 않소.'],
      win: ['잘들 했소. 참으로 잘들 했소.'],
    },
  },

  yaro: {
    name: '야로', element: 'dark', title: '그림자 도적', color: '#d14fc0', unlock: '5-1',
    hp: 230, damage: 22, interval: 0.6, range: 0.7, melee: true, block: 1, speed: 2.0, armor: 0.1,
    crit: { chance: 0.3, mult: 2 }, targets: 'ground',
    skill: {
      id: 'shadow_strike', name: '그림자 습격', cooldown: 16, target: 'enemy', damage: 180, execute: 0.2, bossMult: 2,
      desc: '고른 적에게 순간이동해 큰 피해를 줍니다. 체력 20% 이하면 처치(보스에게는 피해 2배).',
    },
    passive: { id: 'plunder', name: '약탈', bountyPct: 0.5, desc: '야로가 처치한 적의 현상금 +50%.' },
    bio: '침묵을 믿던 교단을 떠나 등불 편에 선, 비꼬는 그림자 도적.',
    lines: {
      select: ['야로. 뭐, 도와는 주지.', '그림자는 등불 옆에 있어야 생기는 거야.', '흥, 빨리 끝내자.'],
      move: ['알았어, 알았어.', '그쪽이 더 재밌겠네.', '조용히 간다.'],
      skill: ['그림자 습격.', '잘 가라.'],
      down: ['칫… 방심했어.'],
      revive: ['돌아왔어. 아쉬웠지?'],
      win: ['…나쁘지 않았어. 너희 말이야.'],
    },
  },
};

RG.data.heroOrder = ['kara', 'sera', 'sio', 'zena', 'bawi', 'yaro'];
