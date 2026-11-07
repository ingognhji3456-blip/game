'use strict';

/* =========================================================
 * 전술 모듈 — 최대 3개 장착. stats 의 값이 능력치에 더해집니다.
 * 능력치 키는 AZ.progress.computeStats 참고.
 * ========================================================= */
window.AZ = window.AZ || {};
AZ.data = AZ.data || {};

AZ.data.modules = {
  vitality: { name: '수호 프레임', icon: '⬢', color: '#5fd4ff', stats: { hpPct: 0.2 },
    desc: '최대 체력 +20%.' },
  edge: { name: '예리한 회로', icon: '◆', color: '#ff6b8a', stats: { atkPct: 0.12 },
    desc: '공격력 +12%.' },
  breaker: { name: '브레이커 코어', icon: '✸', color: '#ffb35c', stats: { breakMul: 0.35 },
    desc: '브레이크 게이지 피해 +35%.' },
  phase: { name: '위상 회피 회로', icon: '≋', color: '#7cf7d4', stats: { perfectMul: 0.5, iframe: 0.06 },
    desc: '완벽 회피 판정 시간 +50%, 회피 무적 시간 +0.06초.' },
  syncro: { name: '제로 동기화 장치', icon: '◎', color: '#c9a4ff', stats: { zeroDur: 1.2 },
    desc: 'ZERO FRAME 지속 시간 +1.2초.' },
  vampire: { name: '에너지 흡수 코어', icon: '♥', color: '#ff7a9a', stats: { lifesteal: 0.03 },
    desc: '준 피해의 3%만큼 체력 회복.' },
  overclock: { name: '과부하 회로', icon: '⚡', color: '#ffe066', stats: { cdMul: 0.2 },
    desc: '스킬 재사용 대기 시간 -20%.' },
  analyzer: { name: '약점 해석기', icon: '⌖', color: '#66e0ff', stats: { weakMul: 0.3 },
    desc: '약점 공격 피해 +30%.' },
  focusLens: { name: '집중 렌즈', icon: '◉', color: '#9ad0ff', stats: { focusMul: 0.4 },
    desc: '집중 게이지 획득량 +40%.' },
  chainAmp: { name: '연쇄 증폭기', icon: '∞', color: '#ff9ef0', stats: { comboAmp: 0.25 },
    desc: '콤보 보너스 최대치 +25% (콤보 50에서 최대).' },
  reactive: { name: '반응 장갑', icon: '▣', color: '#8fa8c8', stats: { dmgReduce: 0.15 },
    desc: '받는 피해 -15%.' },
  afterimage: { name: '잔상 생성기', icon: '❖', color: '#b0f0ff', stats: { afterimage: 1 },
    desc: '완벽 회피하면 그 자리에 폭발하는 잔상을 남긴다(공격력 300%).' },
  guardian: { name: '동료 강화 모듈', icon: '✚', color: '#a0ffb0', stats: { allyMul: 0.4, allyHp: 0.5 },
    desc: '동료의 공격 피해 +40%, 동료 체력 +50%.' },
  chrono: { name: '크로노 배터리', icon: '⌛', color: '#e0c0ff', stats: { ultMul: 0.3, startFocus: 30 },
    desc: '궁극기 피해 +30%. 전투를 집중 게이지 30%로 시작한다.' },
};
