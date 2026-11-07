'use strict';

/* =========================================================
 * 스킬 트리 — 공격 / 방어 / 시간 조작
 * 각 가지는 위에서 아래로 차례대로 배웁니다(앞 노드를 배워야 다음 노드).
 * type: 'active'(장착해서 사용, 최대 3개) / 'passive'(배우면 항상 적용)
 * ========================================================= */
window.AZ = window.AZ || {};
AZ.data = AZ.data || {};

AZ.data.skills = {
  branches: [
    { id: 'atk', name: '공격', color: '#ff6b8a', nodes: ['waveSlash', 'atkUp', 'rayStrike', 'critUp', 'astralBlades', 'comboMaster'] },
    { id: 'def', name: '방어', color: '#5fd4ff', nodes: ['barrier', 'hpUp', 'counterStance', 'ironWill', 'repair', 'lastStand'] },
    { id: 'time', name: '시간 조작', color: '#c9a4ff', nodes: ['blink', 'perfectUp', 'accel', 'zeroSync', 'timeStop', 'cdr'] },
  ],
  /** 가지 안 순서별 필요 SP */
  tierCost: [1, 1, 2, 2, 3, 3],
  nodes: {
    // ── 공격 ──
    waveSlash: { name: '광역 파동', type: 'active', icon: 'wave', cd: 8,
      desc: '주변에 에너지 파동을 터뜨려 둘레의 적 모두에게 공격력 220% 피해.' },
    atkUp: { name: '전투 연산', type: 'passive', icon: 'atk',
      desc: '공격력 +12%.' },
    rayStrike: { name: '레이 스트라이크', type: 'active', icon: 'ray', cd: 9,
      desc: '빛처럼 돌진해 지나간 자리의 적에게 280% 피해. 돌진 중 무적, 공중의 적에게도 닿는다.' },
    critUp: { name: '정밀 타격', type: 'passive', icon: 'crit',
      desc: '치명타율 +12%, 치명타 피해 +20%.' },
    astralBlades: { name: '성광 연참', type: 'active', icon: 'blades', cd: 12,
      desc: '빛의 칼날 6개를 소환해 대상에게 차례로 날린다. 각 80% 피해, 공중의 적에게도 닿는다.' },
    comboMaster: { name: '연격의 극의', type: 'passive', icon: 'combo',
      desc: '콤보 30 이상일 때 주는 피해 +15%.' },
    // ── 방어 ──
    barrier: { name: '위상 방벽', type: 'active', icon: 'barrier', cd: 18,
      desc: '8초 동안 최대 체력 30%만큼 피해를 흡수하는 방벽을 두른다.' },
    hpUp: { name: '강화 골격', type: 'passive', icon: 'hp',
      desc: '최대 체력 +20%.' },
    counterStance: { name: '반격 자세', type: 'active', icon: 'counter', cd: 10,
      desc: '0.9초 동안 자세를 잡는다. 그동안 공격받으면 무효화하고 ZERO FRAME 과 함께 350% 반격.' },
    ironWill: { name: '강철 의지', type: 'passive', icon: 'def',
      desc: '받는 피해 -12%.' },
    repair: { name: '나노 수복', type: 'active', icon: 'repair', cd: 25,
      desc: '3초에 걸쳐 최대 체력의 25%를 회복한다.' },
    lastStand: { name: '최후의 저항', type: 'passive', icon: 'last',
      desc: '체력이 35% 이하일 때 공격력 +25%.' },
    // ── 시간 조작 ──
    blink: { name: '순간 이동', type: 'active', icon: 'blink', cd: 6,
      desc: '대상의 등 뒤(약점 방향)로 순간 이동한다. 2초 안의 다음 공격은 반드시 치명타.' },
    perfectUp: { name: '찰나의 감각', type: 'passive', icon: 'eye',
      desc: '완벽 회피 판정 시간 +50%.' },
    accel: { name: '시간 가속', type: 'active', icon: 'accel', cd: 20,
      desc: '카이온의 고유 능력. 7초 동안 이동 속도 +35%, 공격 속도 +40%.' },
    zeroSync: { name: '제로 동기화', type: 'passive', icon: 'zero',
      desc: 'ZERO FRAME 지속 시간 +1초.' },
    timeStop: { name: '시간 정지', type: 'active', icon: 'stop', cd: 30,
      desc: '2.5초 동안 적의 시간을 멈춘다(보스는 1.8초).' },
    cdr: { name: '시간 압축', type: 'passive', icon: 'cdr',
      desc: '모든 스킬 재사용 대기 시간 -15%.' },
  },
  ultimate: {
    name: '크로노 디바이드', icon: 'ult',
    desc: '집중 게이지 100% 소모. 시간을 멈추고 대상을 연속으로 베어 낸 뒤 폭발시킨다. (공격력 총 1600% + 큰 브레이크 피해)',
  },
  /** 시작할 때 배운/장착한 스킬 */
  starting: { learned: ['waveSlash'], equipped: ['waveSlash', null, null] },
};

/* 전술 명령 (리아/동료에게 내리는 명령) */
AZ.data.commands = [
  { id: 'scan', name: '분석', key: 'Z', cd: 24, needs: 'lia',
    desc: '12초 동안 약점을 드러내고 약점 피해 +25%. 보스의 다음 공격 방향을 미리 보여 준다.' },
  { id: 'cover', name: '엄호', key: 'X', cd: 30, needs: 'lia',
    desc: '파티 전원에게 최대 체력 15%의 방벽을 씌우고 동료를 20% 회복시킨다.' },
  { id: 'focus', name: '집중 공격', key: 'C', cd: 26, needs: 'any',
    desc: '10초 동안 동료의 공격 속도 +50%, 공격 피해 +40%, 브레이크 피해 2배.' },
];
