'use strict';

/* =========================================================
 * 기술 나무 · 도전 규칙 · 공명 과제 — 설계: DESIGN.md §11~12, maps.md
 * ========================================================= */

/** 기술 나무: 갈래마다 앞 칸을 찍어야 다음 칸을 찍을 수 있음. effect 키는 엔진이 해석. */
RG.data.skillBranches = [
  { id: 'build', name: '축성', icon: 'upgrade' },
  { id: 'res', name: '공명', icon: 'storm' },
  { id: 'hero', name: '영웅', icon: 'hero' },
  { id: 'lamp', name: '등불', icon: 'lives' },
];

RG.data.skills = [
  { id: 'build1', branch: 'build', tier: 1, cost: 3, name: '튼튼한 설계', desc: '탑 건설 비용 −5%', effect: { buildCostPct: -0.05 } },
  { id: 'build2', branch: 'build', tier: 2, cost: 4, name: '숙련 장인', desc: '분기 강화 비용 −10%', effect: { branchCostPct: -0.1 } },
  { id: 'build3', branch: 'build', tier: 3, cost: 6, name: '높은 망루', desc: '모든 탑 사거리 +5%', effect: { rangePct: 0.05 } },
  { id: 'build4', branch: 'build', tier: 4, cost: 7, name: '좋은 연장', desc: '강화(Lv2·Lv3) 비용 −8%', effect: { upgradeCostPct: -0.08 } },
  { id: 'build5', branch: 'build', tier: 5, cost: 10, name: '명장의 손길', desc: '분기 탑 피해 +10%', effect: { branchDamagePct: 0.1 } },

  { id: 'res1', branch: 'res', tier: 1, cost: 3, name: '맑은 울림', desc: '순수 공명 피해 +6%p', effect: { purePct: 0.06 } },
  { id: 'res2', branch: 'res', tier: 2, cost: 4, name: '울림 모으기', desc: '지원 탑 공명 증폭 +5%p', effect: { ampPct: 0.05 } },
  { id: 'res3', branch: 'res', tier: 3, cost: 6, name: '세 겹 화음', desc: '공명 효과 3개 이상인 탑 피해 +10%', effect: { tripleDamagePct: 0.1 } },
  { id: 'res4', branch: 'res', tier: 4, cost: 7, name: '깊은 공명', desc: '공명 효과 수치 +20% (지속 시간 제외)', effect: { resonanceMult: 0.2 } },
  { id: 'res5', branch: 'res', tier: 5, cost: 10, name: '여섯 빛 화음', desc: '공명 효과 4개 이상인 탑 공격 속도 +15%', effect: { quadSpeedPct: 0.15 } },

  { id: 'hero1', branch: 'hero', tier: 1, cost: 3, name: '단련', desc: '영웅 체력 +15%', effect: { heroHpPct: 0.15 } },
  { id: 'hero2', branch: 'hero', tier: 2, cost: 4, name: '빠른 회복', desc: '영웅 부활 시간 −30%', effect: { heroRespawnPct: -0.3 } },
  { id: 'hero3', branch: 'hero', tier: 3, cost: 6, name: '집중', desc: '영웅 기술 재사용 대기 −15%', effect: { heroCooldownPct: -0.15 } },
  { id: 'hero4', branch: 'hero', tier: 4, cost: 7, name: '노련함', desc: '영웅이 Lv2로 시작', effect: { heroStartLevel: 2 } },
  { id: 'hero5', branch: 'hero', tier: 5, cost: 9, name: '수호대의 이름', desc: '영웅 피해 +20%', effect: { heroDamagePct: 0.2 } },

  { id: 'lamp1', branch: 'lamp', tier: 1, cost: 3, name: '넉넉한 곳간', desc: '시작 골드 +8%', effect: { startGoldPct: 0.08 } },
  { id: 'lamp2', branch: 'lamp', tier: 2, cost: 4, name: '앞선 종소리', desc: '조기 호출 보너스 +50%', effect: { earlyBonusPct: 0.5 } },
  { id: 'lamp3', branch: 'lamp', tier: 3, cost: 6, name: '수정 맥', desc: '수정 광산 수입 +20%', effect: { mineIncomePct: 0.2 } },
  { id: 'lamp4', branch: 'lamp', tier: 4, cost: 7, name: '두둑한 현상금', desc: '현상금 +8%', effect: { bountyPct: 0.08 } },
  { id: 'lamp5', branch: 'lamp', tier: 5, cost: 9, name: '등불 보호막', desc: '처음 새어 든 일반 적 2마리는 불꽃을 꺼뜨리지 않음', effect: { leakShield: 2 } },
];

/** 도전 규칙 설명 틀 — maps.md "도전 규칙 종류" */
RG.data.challengeTypes = {
  maxTowers: { name: '탑 개수 제한', fmt: (v) => `탑 ${v}개 이하` },
  noHero: { name: '영웅 없이', fmt: () => '영웅 없이' },
  lives: { name: '적은 불꽃', fmt: (v) => `불꽃 ${v}개로 시작` },
  noOpenBuild: { name: '공터 건설 금지', fmt: () => '공터 건설 금지' },
  maxLevel: { name: '강화 제한', fmt: (v) => (v >= 3 ? 'Lv3까지(분기 금지)' : `강화 Lv${v}까지`) },
  allowElements: { name: '원소 제한', fmt: (v) => `${v.map((e) => RG.data.elements[e].name).join('·')} 탑만` },
  banElements: { name: '원소 금지', fmt: (v) => `${v.map((e) => RG.data.elements[e].name).join('·')} 탑 없이` },
  banTowers: { name: '탑 금지', fmt: (v) => `${v.map((t) => RG.data.towers[t].name).join('·')} 없이` },
  noBlock: { name: '붙잡기 없이', fmt: () => '붙잡기 없이(병영·근접 영웅 금지)' },
  noSell: { name: '판매 금지', fmt: () => '판매 금지' },
  countdown: { name: '빠른 웨이브', fmt: (v) => `카운트다운 ${v}초` },
  noSupport: { name: '지원 탑 없이', fmt: () => '지원 탑 없이' },
  noAdjacent: { name: '공명 없음', fmt: () => '탑끼리 이웃 금지(공명 없음)' },
};

/** 공명 과제 종류 */
RG.data.taskTypes = ['links', 'distinct', 'effects', 'stack', 'amp', 'elementEffects', 'pureAll', 'allElements'];
