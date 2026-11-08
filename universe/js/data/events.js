'use strict';

/*
 * 우주의 큰 사건들. t: 빅뱅 후 햇수.
 * view: 그 사건을 보기 좋은 범위 (web 우주 · local 이웃 은하 · galaxy 우리 은하 · collision 은하 충돌 · solar 태양계)
 * 연대는 플랑크 위성, 제임스 웹 우주 망원경, 가이아 위성 등의 관측과 표준 우주론을 따랐습니다.
 */
(function () {
  const UC = (window.UC = window.UC || {});
  const U = UC.util;
  const C = UC.cosmo;
  const Y = U.YEAR_S;
  const N = C.T_NOW;
  const sup = U.sup;

  const EVENTS = [
    {
      id: 'bigbang', t: UC.time.TAU_START, kind: 'physics', icon: '✨', major: true, view: 'web',
      title: '빅뱅',
      text: '138억 년 전, 우주는 상상할 수 없이 뜨겁고 빽빽한 상태에서 팽창하기 시작했습니다. 어딘가에서 폭발한 것이 아니라 공간 자체가 어디서나 늘어나기 시작한 것입니다. 이보다 앞선 순간(10⁻⁴³초 이전)은 지금의 물리학으로는 설명할 수 없습니다.',
    },
    {
      id: 'gut', t: 1e-43 / Y, kind: 'physics', icon: '⚛️',
      title: '네 가지 힘이 갈라지기 시작',
      text: `중력이 먼저 떨어져 나갑니다. 강한 힘·약한 힘·전자기력은 아직 하나의 힘이었고, 온도는 10${sup(32)}도에 이르렀습니다.`,
    },
    {
      id: 'inflation', t: 1e-36 / Y, kind: 'physics', icon: '🎈', major: true, view: 'web',
      title: '급팽창 (인플레이션)',
      text: `10${sup(-36)}초부터 10${sup(-32)}초 사이, 우주는 원자보다 작은 크기에서 적어도 10${sup(26)}배 커졌습니다. 이때 생긴 아주 작은 양자 요동이 함께 늘어나 훗날 은하와 은하단이 생길 씨앗이 되었습니다.`,
    },
    {
      id: 'higgs', t: 1e-12 / Y, kind: 'physics', icon: '🌀',
      title: '입자들이 질량을 얻음',
      text: '전자기력과 약한 힘이 갈라지고, 힉스 장 덕분에 입자들이 질량을 갖게 됩니다. 우주는 쿼크와 글루온이 뒤섞인 뜨거운 수프(쿼크-글루온 플라스마)입니다.',
    },
    {
      id: 'hadron', t: 1e-6 / Y, kind: 'physics', icon: '🔴', major: true,
      title: '양성자와 중성자 탄생',
      text: '온도가 2조 도 아래로 내려가자 쿼크가 셋씩 묶여 양성자와 중성자가 됩니다. 물질과 반물질이 만나 대부분 빛으로 사라지고, 10억 개 중 1개꼴로 남은 물질이 지금 우주의 모든 별과 행성, 그리고 우리가 되었습니다.',
    },
    {
      id: 'neutrino', t: 1 / Y, kind: 'physics', icon: '👻',
      title: '중성미자가 자유로워짐',
      text: '1초 무렵 중성미자가 다른 입자와 거의 부딪히지 않게 되어 우주를 자유롭게 날아다닙니다. 지금도 1cm³마다 약 340개가 남아 우리 몸을 지나가고 있습니다.',
    },
    {
      id: 'bbn', t: 180 / Y, kind: 'physics', icon: '🎯', major: true,
      title: '첫 원자핵 (빅뱅 핵합성)',
      text: '3분 무렵 양성자와 중성자가 뭉쳐 헬륨 원자핵이 만들어집니다. 20분 만에 우주의 물질은 수소 약 75%, 헬륨 약 25%, 아주 약간의 리튬으로 정해졌습니다. 더 무거운 원소는 수억 년 뒤 별 속에서 만들어집니다.',
    },
    {
      id: 'equality', t: C.T_EQ, kind: 'cosmic', icon: '⚖️',
      title: '물질이 빛보다 많아짐',
      text: '약 5만 년 뒤, 물질의 에너지가 빛(복사)의 에너지를 넘어섭니다. 이제 중력이 물질을 끌어모아 구조가 자라기 시작합니다. 물질의 대부분은 빛을 내지 않는 암흑 물질입니다.',
    },
    {
      id: 'recomb', t: C.T_RECOMB, kind: 'cosmic', icon: '🌅', major: true, view: 'web',
      title: '우주가 투명해짐 (우주 배경 복사)',
      text: '온도가 약 3,000도로 내려가자 전자가 원자핵에 붙잡혀 첫 원자가 됩니다. 빛을 가로막던 자유 전자가 사라져 우주가 처음으로 투명해졌습니다. 이때 풀려난 빛이 138억 년 동안 늘어나 지금 하늘 어디서나 오는 우주 배경 복사(2.7K)가 되었습니다.',
    },
    {
      id: 'darkage', t: 3e6, kind: 'cosmic', icon: '🌑', view: 'web',
      title: '우주 암흑 시대',
      text: '배경 복사의 빛이 늘어나 붉어지다가 눈에 보이지 않게 되자 우주는 캄캄해집니다. 아직 별이 하나도 없습니다. 그동안 암흑 물질의 중력이 수소와 헬륨 가스를 거미줄처럼 끌어모읍니다.',
    },
    {
      id: 'firststars', t: 1.5e8, kind: 'galaxy', icon: '⭐', major: true, view: 'web',
      title: '첫 별이 켜짐',
      text: '빅뱅 후 1~2억 년, 가스가 짙게 뭉친 곳에서 첫 별이 켜집니다. 태양의 수십~수백 배 무게로 아주 밝고 짧게 살다가 초신성으로 터지며, 탄소·산소·철 같은 무거운 원소를 처음으로 우주에 뿌렸습니다.',
    },
    {
      id: 'jades', t: 2.9e8, kind: 'galaxy', icon: '🔭', view: 'web',
      title: '지금까지 본 가장 먼 은하',
      text: '제임스 웹 우주 망원경은 빅뱅 후 약 3억 년의 은하(JADES-GS-z14-0)를 찾아냈습니다. 그 빛은 135억 년을 날아와 지금 우리에게 닿았습니다.',
    },
    {
      id: 'mwbirth', t: 6e8, kind: 'galaxy', icon: '🌀', view: 'galaxy',
      title: '우리 은하의 시작',
      text: '우리 은하에서 가장 오래된 별들은 약 132억 년 전에 태어났습니다. 처음의 우리 은하는 작은 덩어리들이 모여 합쳐지는 불규칙한 모습이었습니다.',
    },
    {
      id: 'reion', t: 1e9, kind: 'cosmic', icon: '💡', view: 'web',
      title: '재이온화 완료',
      text: '첫 별과 은하의 강한 자외선이 우주의 수소 가스를 다시 이온화합니다. 빅뱅 후 약 10억 년, 은하 사이의 공간은 빛이 잘 통하는 지금의 상태가 되었습니다.',
    },
    {
      id: 'noon', t: 3.4e9, kind: 'galaxy', icon: '🎆', view: 'web',
      title: '별 탄생의 전성기',
      text: '빅뱅 후 약 35억 년, 우주에서 별이 가장 많이 태어났습니다. 지금보다 10배쯤 활발했고, 은하 중심의 거대 블랙홀도 가장 밝게 빛났습니다(퀘이사).',
    },
    {
      id: 'gse', t: 3.8e9, kind: 'galaxy', icon: '💥', view: 'galaxy',
      title: '가이아-엔켈라두스와 합쳐짐',
      text: '약 100억 년 전, 작은 은하 가이아-엔켈라두스가 우리 은하에 부딪혀 합쳐졌습니다. 가이아 위성은 그 별들이 지금도 우리 은하의 헤일로에 흩어져 있는 것을 찾아냈습니다.',
    },
    {
      id: 'thindisk', t: 5.8e9, kind: 'galaxy', icon: '🌌', view: 'galaxy',
      title: '얇은 원반과 나선팔',
      text: '합병이 잦아들자 가스가 얇은 원반으로 가라앉고, 나선팔을 따라 새 별이 태어나기 시작했습니다. 지금 우리가 아는 나선 은하의 모습이 갖추어집니다.',
    },
    {
      id: 'accel', t: C.T_ACCEL, kind: 'cosmic', icon: '🚀', major: true, view: 'web',
      title: '팽창이 다시 빨라짐',
      text: '물질이 퍼져 옅어지자 공간 자체가 가진 에너지, 암흑 에너지가 이기기 시작합니다. 약 60억 년 전부터 우주의 팽창은 점점 빨라지고 있습니다. (1998년 발견, 2011년 노벨 물리학상)',
    },
    {
      id: 'sun', t: N - 4.568e9, kind: 'star', icon: '☀️', major: true, view: 'solar',
      title: '태양계 탄생',
      text: '약 46억 년 전, 가스 구름이 무너지며 가운데에서 태양이 켜지고, 둘레의 원반에서 먼지가 뭉쳐 행성이 되었습니다. 태양은 이미 여러 세대의 별이 만든 무거운 원소를 품고 태어난 늦둥이 별입니다.',
    },
    {
      id: 'earth', t: N - 4.54e9, kind: 'earth', icon: '🌍', view: 'solar', earth: true,
      title: '지구 탄생',
      text: '원반 속 바위들이 뭉쳐 지구가 됩니다. 곧 화성만 한 천체 테이아와 부딪혀 달이 생겼습니다. 태양계에서 지구를 누르면 지구 연대기에서 이어서 볼 수 있습니다.',
    },
    {
      id: 'life', t: N - 3.8e9, kind: 'earth', icon: '🦠', view: 'solar', earth: true,
      title: '지구에 생명',
      text: '적어도 35억 년 전, 지구 바다에 첫 생명이 나타났습니다. 지금까지 생명이 있다고 확인된 곳은 우주에서 지구뿐입니다.',
    },
    {
      id: 'now', t: N, kind: 'cosmic', icon: '📍', major: true, view: 'galaxy',
      title: '현재',
      text: '빅뱅 후 138억 년. 관측 가능한 우주의 반지름은 약 465억 광년이고, 그 안에 수천억 개의 은하가 있습니다. 우리는 그중 하나인 우리 은하의 나선팔 한쪽에서, 초속 230km로 은하 중심을 돌고 있습니다.',
    },
    {
      id: 'andromeda', t: N + 4.5e9, kind: 'galaxy', icon: '💞', major: true, view: 'collision',
      title: '안드로메다 은하와 충돌',
      text: '지금 초속 110km로 다가오는 안드로메다 은하가 약 45억 년 뒤 우리 은하와 부딪힙니다. 별 사이가 워낙 멀어 별끼리 부딪히는 일은 거의 없지만, 서로의 중력이 두 은하를 길게 늘이고 휘저어 결국 하나의 커다란 타원 은하 "밀코메다"가 됩니다. (2025년 연구는 100억 년 안에 충돌할 확률을 약 50%로 봅니다.)',
    },
    {
      id: 'redgiant', t: N + 5.4e9, kind: 'star', icon: '🔴', major: true, view: 'solar',
      title: '태양이 부풀기 시작',
      text: '약 54억 년 뒤 태양 중심의 수소가 바닥나면 태양은 부풀어 오르는 적색거성이 됩니다. 약 76억 년 뒤에는 지금보다 200배 넘게 커져 수성과 금성을 삼키고, 지구도 삼킬 가능성이 큽니다.',
    },
    {
      id: 'engulf', t: N + 7.59e9, kind: 'earth', icon: '🫠', view: 'solar', earth: true,
      title: '지구가 삼켜짐',
      text: '가장 크게 부푼 태양의 가장자리가 지구 궤도에 닿습니다. 지구는 태양의 바깥 대기 속으로 끌려 들어가 사라집니다.',
    },
    {
      id: 'whitedwarf', t: N + 7.8e9, kind: 'star', icon: '⚪', view: 'solar',
      title: '행성상 성운과 백색왜성',
      text: '바깥층을 우주로 날려 보낸 태양은 빛나는 가스 껍질(행성상 성운)을 남기고, 지구만 한 크기의 뜨거운 핵인 백색왜성이 됩니다. 남은 행성들은 더 먼 궤도로 밀려납니다.',
    },
    {
      id: 'lonely', t: N + 1.5e11, kind: 'future', icon: '🏝️', view: 'web',
      title: '이웃 은하들이 사라짐',
      text: '가속 팽창 때문에 국부 은하군 밖의 은하들은 점점 빨리 멀어져 결국 그 빛조차 우리에게 닿지 못합니다. 약 1,500억 년 뒤 밤하늘에는 밀코메다 하나만 남고, 미래의 천문학자는 우주가 팽창한다는 사실조차 알기 어려울 것입니다.',
    },
    {
      id: 'starsend', t: 1e14, kind: 'future', icon: '🕯️', major: true, view: 'galaxy',
      title: '마지막 별이 꺼짐',
      text: '별을 만들 가스가 바닥나 새 별이 더는 태어나지 않습니다. 가장 오래 사는 작은 적색왜성도 수조 년을 버틴 끝에 꺼지면, 약 100조 년 뒤 우주에는 스스로 빛나는 별이 사라집니다. "축퇴 시대"가 시작됩니다.',
    },
    {
      id: 'blackdwarf', t: 1e15, kind: 'future', icon: '⚫', view: 'galaxy',
      title: '태양이 흑색왜성이 됨',
      text: '식어 가던 백색왜성(태양의 마지막 모습)이 완전히 식어 빛을 내지 않는 흑색왜성이 됩니다. 지금 우주에는 흑색왜성이 하나도 없습니다. 우주가 아직 너무 젊기 때문입니다.',
    },
    {
      id: 'galaxyevap', t: 1e19, kind: 'future', icon: '🌫️', view: 'galaxy',
      title: '은하가 흩어짐',
      text: '별의 잔해들이 가까이 스치며 에너지를 주고받다 보면 대부분은 은하 밖으로 튕겨 나가고, 나머지는 중심 블랙홀로 떨어집니다.',
    },
    {
      id: 'proton', t: 1e37, kind: 'future', icon: '💨',
      title: '양성자 붕괴 (가설)',
      text: `만약 양성자가 영원하지 않다면(아직 관측된 적은 없습니다), 10${sup(34)}년 이상 지나 남은 물질마저 빛과 가벼운 입자로 부서집니다.`,
    },
    {
      id: 'bhera', t: 1e40, kind: 'future', icon: '🕳️', major: true, view: 'galaxy',
      title: '블랙홀 시대',
      text: '이제 우주에 남은 큰 천체는 블랙홀뿐입니다. 블랙홀도 호킹 복사로 아주 조금씩 질량을 잃습니다.',
    },
    {
      id: 'bhevap', t: 1e100, kind: 'future', icon: '🎇',
      title: '마지막 블랙홀의 증발',
      text: `태양 질량 블랙홀은 10${sup(67)}년, 가장 무거운 초대질량 블랙홀은 10${sup(100)}년 넘게 걸려 증발합니다. 마지막 섬광과 함께 우주의 마지막 큰 천체가 사라집니다.`,
    },
    {
      id: 'heatdeath', t: 1e104, kind: 'future', icon: '🌫️', major: true,
      title: '열죽음',
      text: '남은 것은 아주 옅게 퍼진 빛과 가벼운 입자뿐. 어디에도 온도 차이가 없어 더는 아무 일도 일어나지 않는 "열죽음"에 이릅니다. 지금 아는 물리학으로 그려 본 가장 그럴듯한 우주의 끝입니다.',
    },
  ];

  const KIND_COLOR = {
    physics: '#ffb36b',
    cosmic: '#b39dff',
    galaxy: '#7cb8ff',
    star: '#ffd27a',
    earth: '#7ee0a1',
    future: '#9aa8d6',
    end: '#ff7a5c',
    intervention: '#ff7a5c',
  };

  UC.data = UC.data || {};
  UC.data.EVENTS = EVENTS;
  UC.data.KIND_COLOR = KIND_COLOR;
})();
