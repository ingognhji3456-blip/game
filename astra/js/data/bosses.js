'use strict';

/* =========================================================
 * 보스 10종
 *   hpMul    : 챕터 기준 체력에 곱하는 배율
 *   breakMax : 브레이크 게이지 (가벼운 공격 1타 ≈ 3, 강공격 ≈ 16)
 *   weak     : { back: 등 뒤 약점 각도(rad), exposedOnly: 노출 중에만 약점 }
 *   shield   : 정면 방패 각도(rad) — 정면 피해 85% 감소
 *   phases   : 남은 체력 비율 문턱 (예: [0.5] → 50%에서 2페이즈)
 *   tips     : 도감 공략 메모 (해금 후 표시)
 * ========================================================= */
window.AZ = window.AZ || {};
AZ.data = AZ.data || {};

AZ.data.bosses = {
  scavenger: {
    name: '스캐빈저', title: '폐허의 포식자', chapter: 1,
    r: 46, speed: 150, hpMul: 1.0, breakMax: 150, phases: [0.5],
    weak: { back: 1.7 }, color: '#ff4d6d', accent: '#ffb35c', music: 'boss',
    tips: [
      '돌진 전에 붉은 직선 경고가 뜬다. 옆으로 피하거나 타이밍을 맞춰 회피하자.',
      '등에 노출된 동력 코어가 약점. 돌진이 끝난 직후 등 뒤를 노려라.',
      '체력이 절반 아래로 떨어지면 땅속으로 파고든다. 발밑의 경고를 주시할 것.',
    ],
  },
  arka: {
    name: '아르카', title: '방어형 기계 기사', chapter: 2,
    r: 50, speed: 105, hpMul: 1.1, breakMax: 190, phases: [0.5],
    weak: { back: 1.4 }, shield: 2.0, turnRate: 2.2, color: '#8fb8ff', accent: '#ffe066', music: 'boss',
    tips: [
      '정면의 방패는 피해를 85% 막는다. 순간 이동이나 회피로 등 뒤를 잡자.',
      '방패 돌진은 길게 뻗는다. 경고선 바깥으로 벗어나면 등을 보인 채 멈춘다.',
      '2페이즈에서는 경기장 바깥에서 창이 날아든다.',
    ],
  },
  observer: {
    name: '옵저버', title: '감시 시스템', chapter: 3,
    r: 52, speed: 90, hpMul: 1.05, breakMax: 170, phases: [0.5],
    weak: { exposedOnly: true }, armorMul: 0.7, flying: true, color: '#66e0ff', accent: '#ff5470', music: 'boss',
    tips: [
      '평소에는 장갑이 단단해 피해가 30% 줄어든다.',
      '거대 레이저를 쏜 뒤 렌즈가 드러난다. 그때가 공격할 기회.',
      '회전 광선은 경고선 방향으로 돈다. 반대쪽으로 돌아 들어가자.',
    ],
  },
  zero: {
    name: '제로', title: '붉은 라이벌', chapter: 4,
    r: 24, speed: 250, hpMul: 1.3, breakMax: 160, phases: [0.55],
    weak: { back: 1.0 }, color: '#ff3355', accent: '#ff9aa8', music: 'rival', humanoid: true,
    tips: [
      '연속 공격이 끝나면 잠시 숨을 고른다(약점 노출). 그 틈을 노려라.',
      '붉게 빛나는 "반격 태세" 중에 공격하면 즉시 반격당한다. 기다리거나 물러서자.',
      '2페이즈의 잔상 돌진은 여러 방향에서 동시에 날아온다.',
    ],
  },
  atlas: {
    name: '아틀라스', title: '거대 전투 병기', chapter: 5,
    r: 92, speed: 55, hpMul: 1.0, breakMax: 240, phases: [0.55],
    weak: { back: 1.2 }, color: '#7aa2ff', accent: '#ff7a3d', music: 'boss', big: true,
    tips: [
      '주먹 내려찍기 뒤에는 팔이 땅에 박혀 가슴 코어가 드러난다.',
      '미사일 폭격은 연달아 떨어진다. 멈추지 말고 움직일 것.',
      '2페이즈의 궤도 폭격은 초록색 안전 지대로 피하자.',
    ],
  },
  sera: {
    name: '세라', title: '기억 조작 병기', chapter: 6,
    r: 30, speed: 160, hpMul: 1.05, breakMax: 180, phases: [0.5],
    weak: { back: 1.3 }, flying: true, color: '#d8c8ff', accent: '#ff7ad9', music: 'boss', humanoid: true,
    tips: [
      '환영 분신이 나타나면 "분석" 명령으로 진짜를 찾아낼 수 있다.',
      '진짜 세라를 공격하면 환영이 모두 사라진다.',
      '기억 왜곡 중에는 세라 가까이의 작은 원만이 안전하다.',
    ],
  },
  draco: {
    name: '드라코', title: '공중전 보스', chapter: 7,
    r: 62, speed: 230, hpMul: 0.9, breakMax: 200, phases: [0.5],
    weak: { back: 1.2 }, flying: true, airborne: true, color: '#ff5f3d', accent: '#ffd166', music: 'boss',
    tips: [
      '하늘에 떠 있는 동안에는 근접 공격이 닿지 않는다. 레일건·스킬·리아의 사격을 활용하자.',
      '급강하 뒤에는 땅에 내려앉아 무방비해진다.',
      '브레이크하면 추락한다. 그때 근접 무기로 몰아치자.',
    ],
  },
  nemesis: {
    name: '네메시스', title: '행성 파괴 병기', chapter: 8,
    r: 86, speed: 50, hpMul: 1.5, breakMax: 260, phases: [0.5],
    weak: { back: 1.2 }, color: '#b04dff', accent: '#ff3d6e', music: 'boss', big: true,
    tips: [
      '"행성 파괴포"를 충전하는 동안 코어가 노출된다. 브레이크하면 충전을 끊을 수 있다.',
      '막지 못했다면 초록색 방어 지대 안으로 숨어라.',
      '중력장은 몸을 끌어당긴다. 회피로 빠져나오자.',
    ],
  },
  protocol: {
    name: '프로토콜', title: '최종 관리자', chapter: 9,
    r: 34, speed: 180, hpMul: 1.5, breakMax: 220, phases: [0.5],
    weak: { back: 1.3 }, flying: true, color: '#e8f0ff', accent: '#66e0ff', music: 'final', humanoid: true,
    tips: [
      '"권한 회수"는 스킬 하나를 잠시 잠근다. 잠긴 동안은 기본 공격과 회피로 버티자.',
      '방화벽에는 틈이 있다. 빛나는 틈으로 빠져나갈 것.',
      '지난 보스들의 공격을 흉내 낸다. 기억을 떠올려라.',
    ],
  },
  astra: {
    name: 'ASTRA', title: '최종 형태', chapter: 10,
    r: 100, speed: 40, hpMul: 1.5, breakMax: 280, phases: [0.66, 0.33],
    weak: { back: 1.0 }, flying: true, color: '#9ad8ff', accent: '#ffffff', music: 'final', big: true,
    tips: [
      'ASTRA 가 시간을 멈추면 움직일 수 없다. 시간이 다시 흐르는 순간 회피하라.',
      '광륜 레이저는 천천히 회전한다. 빈틈을 따라 돌자.',
      '마지막 "별의 종말"은 피할 곳이 없다. 카운트다운에 맞춰 회피해 ZERO FRAME 을 노려라.',
    ],
  },
};

AZ.data.bossOrder = ['scavenger', 'arka', 'observer', 'zero', 'atlas', 'sera', 'draco', 'nemesis', 'protocol', 'astra'];
