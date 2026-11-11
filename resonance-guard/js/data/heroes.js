'use strict';

/* =========================================================
 * 영웅 12명 — 설계: docs/design/heroes.md (확장 6명: docs/design/expansion.md §2)
 * 필드 뜻: docs/ARCHITECTURE.md §3.4
 * lines(대사)는 heroes.md 대사표와 같아야 합니다(테스트 검사).
 * ========================================================= */

RG.data.heroXp = [0, 8, 20, 38, 62];           // Lv1~5 누적 경험치 (일반 적 처치 1, 정예 3, 보스 10, 근처 처치 절반)
RG.data.heroLevelBonus = { stat: 0.12, skill: 0.1, lv5Cooldown: 0.1 };

RG.data.heroes = {
  kara: {
    name: '카라', element: 'fire', title: '솔빛의 망치', color: '#ff6b3d', unlock: '1-1',
    hp: 300, damage: 8, interval: 1.0, range: 0.75, melee: true, block: 3, speed: 1.6, armor: 0.15,
    splash: 0.6, targets: 'ground',
    skill: {
      id: 'flame_slam', name: '불꽃 내려찍기', cooldown: 18, target: 'point', radius: 1.5, damage: 70, burn: { dps: 10, dur: 3 },
      desc: '고른 곳으로 뛰어올라 내려찍습니다. 반경 1.5칸의 지상 적에게 피해와 화상을 주고, 그 자리에서 적을 붙잡아 싸웁니다.',
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
    hp: 200, damage: 9, interval: 1.1, range: 2.6, melee: false, block: 1, speed: 1.5, armor: 0.05,
    projSpeed: 8, targets: 'both',
    skill: {
      id: 'dawn_prayer', name: '새벽의 기도', cooldown: 22, target: 'point', radius: 2.0, heal: 120, damage: 60, blind: 3,
      desc: '고른 곳 반경 2칸의 영웅·병사를 크게 회복하고, 적에게 피해와 실명을 줍니다.',
    },
    passive: { id: 'lamp_keeper', name: '등불지기', detect: 1.8, regen: 0.01, desc: '주변 1.8칸의 숨은 적을 드러내고, 자신은 매초 최대 체력의 1%를 회복합니다.' },
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
    passive: { id: 'field_mod', name: '현장 개조', radius: 2.0, every: 4, damage: 12, desc: '주변 2칸 안의 탑이 4번 공격할 때마다, 맞은 적에게 작은 번개가 한 번 더 떨어집니다.' },
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
      desc: '고른 적에게 순간이동해 큰 피해를 줍니다. 체력이 20% 이하인 적은 바로 처치합니다. 보스는 처치되지 않는 대신 피해를 2배로 받습니다.',
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

  /* ===================== 확장 영웅 6명 (2026-11-11) — 6지역에서 합류, docs/design/expansion.md §2 ===================== */

  haru: {
    name: '하루', element: 'frost', title: '눈사람 친구', color: '#9fe4ff', unlock: '6-1',
    hp: 220, damage: 10, interval: 1.0, range: 2.4, melee: false, block: 0, speed: 1.6, armor: 0.05,
    projSpeed: 9, targets: 'both',
    skill: {
      id: 'snow_friends', name: '눈사람 친구', cooldown: 22, target: 'path', count: 2, duration: 15,
      snowman: { hp: 240, damage: 6, interval: 1.0, block: 2, armor: 0.1 },
      desc: '고른 길에 눈사람 친구 둘을 15초 동안 세웁니다. 눈사람은 지상 적을 둘씩 붙잡아 싸웁니다.',
    },
    passive: { id: 'snowball_fight', name: '눈싸움', slow: { pct: 0.2, dur: 1.5 }, desc: '하루의 눈덩이에 맞은 적은 1.5초 동안 20% 느려집니다.' },
    bio: '형 시오를 따라 수호대에 들어온, 눈사람 만들기를 좋아하는 밝은 아이.',
    lines: {
      select: ['하루예요! 형, 나도 할 수 있어!', '눈사람 친구들, 준비됐지?', '눈 오는 날은 내가 제일 세!'],
      move: ['응, 거기!', '달려간다~!', '형보다 빨리 갈게!'],
      skill: ['눈사람 친구들, 나와라!', '여기는 우리가 지킨다!'],
      down: ['으앙… 차가워… 금방 일어날게…'],
      revive: ['다시 왔어! 아까는 미끄러진 거야!'],
      win: ['이겼다! 형, 봤어? 봤지?'],
    },
  },

  dohan: {
    name: '도한', element: 'fire', title: '솔빛 대장장이', color: '#e8743a', unlock: '6-2',
    hp: 320, damage: 18, interval: 1.3, range: 1.8, melee: false, block: 1, speed: 1.4, armor: 0.15,
    projSpeed: 10, targets: 'ground',
    skill: {
      id: 'temper', name: '담금질', cooldown: 20, target: 'tower', duration: 8, speedPct: 0.6,
      desc: '고른 탑을 8초 동안 담금질합니다. 그 탑은 공격 속도 +60%(계속 쏘는 탑은 피해 +30%)가 되고, 멈춤·침묵에 걸리지 않습니다.',
    },
    passive: { id: 'smith_hand', name: '대장장이의 손', radius: 2.0, damagePct: 0.1, desc: '도한 주변 2칸 안의 탑은 피해 +10%.' },
    bio: '말수는 적지만 망치 소리로 마음을 전하는, 카라의 아버지이자 솔빛 마을 대장장이.',
    lines: {
      select: ['도한이다. 쇠는 뜨거울 때 두드리지.', '망루 하나쯤은 금방 손봐 주마.', '카라 녀석, 무리하지 마라.'],
      move: ['간다.', '그리 가지.', '알았다.'],
      skill: ['불 좀 더 지펴라!', '담금질이다. 버텨라.'],
      down: ['허… 나이를 먹긴 했나 보군.'],
      revive: ['쉬었다. 다시 하지.'],
      win: ['좋은 쇳소리였다.'],
    },
  },

  narae: {
    name: '나래', element: 'storm', title: '바람새 기수', color: '#7ad8ff', unlock: '6-3',
    hp: 200, damage: 13, interval: 0.8, range: 2.8, melee: false, block: 0, speed: 2.2, armor: 0.05,
    projSpeed: 12, targets: 'both', flying: true,
    skill: {
      id: 'gale_dive', name: '돌풍 급강하', cooldown: 18, target: 'point', damage: 90, width: 0.7, push: 1.2,
      desc: '고른 곳까지 한 줄로 내리꽂습니다. 지나가는 줄의 적에게 피해를 주고 뒤로 밀어냅니다(보스·큰 적은 밀리지 않음).',
    },
    passive: { id: 'gale_rider', name: '바람새', flyingBonus: 0.3, desc: '공중 적에게 피해 +30%. 바람새를 타고 장애물 위로 곧장 날아갑니다(붙잡기는 못 함).' },
    bio: '구름 바다를 건너는 바람새 "솔개"와 함께 사는, 시원시원한 하늘 나루의 기수.',
    lines: {
      select: ['나래 왔어! 솔개야, 날자고!', '바람 좋다! 오늘은 이기는 날이거든!', '하늘길은 나한테 맡겨!'],
      move: ['날아간다!', '바람 타고 슝!', '거기 금방이야!'],
      skill: ['급강하다, 꽉 잡아!', '바람아, 밀어 버려!'],
      down: ['으아, 솔개야… 잠깐 내려가자…'],
      revive: ['다시 떴어! 하늘은 안 놓쳐!'],
      win: ['봤지? 바람은 우리 편이거든!'],
    },
  },

  tori: {
    name: '토리', element: 'earth', title: '이끼 숲 정령', color: '#9ad060', unlock: '6-4',
    hp: 240, damage: 9, interval: 0.9, range: 2.2, melee: false, block: 0, speed: 1.5, armor: 0.05,
    projSpeed: 8, targets: 'ground',
    skill: {
      id: 'giant_form', name: '거인 변신', cooldown: 26, target: 'self', duration: 10,
      giant: { hpMult: 3, damageMult: 2.5, block: 5, range: 0.9, splash: 0.8, armor: 0.35, speed: 1.0 },
      desc: '10초 동안 이끼 거인으로 변신합니다. 체력 3배, 공격력 2.5배, 지상 적을 다섯씩 붙잡고 주변을 내려찍습니다.',
    },
    passive: { id: 'spores', name: '포자', shred: { pct: 0.05, max: 0.2, dur: 3 }, desc: '토리의 공격(포자·거인 주먹)은 적의 갑옷을 5%p씩 깎습니다(최대 20%p, 3초).' },
    bio: '오래된 이끼 숲에서 깨어난 작은 정령. 화나면 숲만큼 커진다.',
    lines: {
      select: ['…토리야아. 같이 가도 돼?', '이끼는 천천히 자라. 그래도 단단해.', '…숲 냄새, 좋아.'],
      move: ['…응.', '천천히… 가아.', '…저기?'],
      skill: ['…화났어. 커질 거야아!', '쿵. 쿵. 쿵.'],
      down: ['…조금만… 잘게…'],
      revive: ['…다시, 싹 텄어.'],
      win: ['…다 같이 해서, 좋아아.'],
    },
  },

  byeori: {
    name: '별이', element: 'light', title: '첨탑의 별지기', color: '#ffe7a8', unlock: '6-5',
    hp: 190, damage: 30, interval: 1.8, range: 3.6, melee: false, block: 0, speed: 1.4, armor: 0.05,
    projSpeed: 7, targets: 'both', splash: 0.7,
    skill: {
      id: 'meteor', name: '유성 낙하', cooldown: 24, target: 'point', delay: 1.2, radius: 1.6, damage: 220, stun: 0.5,
      desc: '고른 곳에 1.2초 뒤 유성이 떨어집니다. 반경 1.6칸에 큰 피해를 주고 잠깐 기절시킵니다(보스 제외).',
    },
    passive: { id: 'constellation', name: '별자리', every: 5, split: 3, desc: '다섯 번째 공격마다 별빛이 셋으로 갈라져 서로 다른 적 셋을 맞힙니다.' },
    bio: '별울림 첨탑에서 별의 길을 기록해 온 수줍은 별지기. 별 이야기만 나오면 말이 많아진다.',
    lines: {
      select: ['별이에요… 오늘 별자리가 좋은 것 같아요.', '계산은 끝났어요. 아마도요.', '저, 저도 도울게요!'],
      move: ['네, 그쪽으로요.', '관측 위치로 갈게요.', '조금만 기다려 주세요.'],
      skill: ['별이 떨어져요, 피하세요!', '궤도 계산… 완료!'],
      down: ['별이… 흐려져요…'],
      revive: ['다시 반짝일게요.'],
      win: ['오늘 밤 별은… 꺼지지 않을 것 같아요.'],
    },
  },

  mujin: {
    name: '무진', element: 'dark', title: '돌아온 종지기', color: '#b08ad8', unlock: '6-6',
    hp: 260, damage: 12, interval: 1.0, range: 2.6, melee: false, block: 1, speed: 1.4, armor: 0.1,
    projSpeed: 9, targets: 'both', splash: 0.5,
    skill: {
      id: 'echo_bell', name: '되울림 종', cooldown: 24, target: 'point', radius: 2.0, stop: 1.5, bossSlow: 0.5, towerSpeed: 0.3, towerDur: 6,
      desc: '고른 곳에서 작은 종을 울립니다. 반경 2칸의 적은 1.5초 동안 멈추고(보스는 크게 느려짐), 그 안의 탑은 6초 동안 공격 속도 +30%.',
    },
    passive: { id: 'quiet_bell', name: '고요한 종', radius: 2.0, vulnPct: 0.1, desc: '무진 주변 2칸 안의 적은 모든 피해를 10% 더 받습니다.' },
    bio: '대종을 지키지 못한 슬픔에 침묵의 편에 섰다가 돌아온 옛 종지기. 이제는 조용히 하늘의 별종을 지킨다.',
    lines: {
      select: ['무진이네. …이번에는 지키겠네.', '종소리는 다시 들리지. 반드시.', '야로, 고맙네.'],
      move: ['가지.', '그쪽이로군.', '조용히 가겠네.'],
      skill: ['울려라, 작은 종이여.', '멈추게. 잠시만.'],
      down: ['…또 놓치는 것인가…'],
      revive: ['아직이네. 아직 울릴 수 있어.'],
      win: ['좋은 울림이었네. 모두의 것이지.'],
    },
  },
};

RG.data.heroOrder = ['kara', 'sera', 'sio', 'zena', 'bawi', 'yaro', 'haru', 'dohan', 'narae', 'tori', 'byeori', 'mujin'];
