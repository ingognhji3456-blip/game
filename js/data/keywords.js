'use strict';

/* 상태이상 & 키워드 설명 — 툴팁과 도움말에 쓰입니다. {value} 는 현재 수치로 바뀝니다. */
CB.data.keywords = {
  // ---- 버프 ----
  strength: { name: '힘', icon: '💪', kind: 'buff', desc: '공격 카드의 피해가 타격마다 {value} 증가합니다.' },
  dexterity: { name: '민첩', icon: '🪶', kind: 'buff', desc: '카드로 얻는 방어도가 {value} 증가합니다.' },
  regen: { name: '재생', icon: '🌿', kind: 'buff', desc: '턴이 끝날 때 체력을 {value} 회복하고, 수치가 1 감소합니다.' },
  thorns: { name: '가시', icon: '🌵', kind: 'buff', desc: '공격을 받을 때마다 공격자에게 {value}의 피해를 되돌려줍니다.' },
  plating: { name: '철갑', icon: '⚙️', kind: 'buff', desc: '턴이 끝날 때 방어도를 {value} 얻습니다.' },
  fervor: { name: '투지', icon: '💢', kind: 'buff', desc: '턴이 끝날 때 힘을 {value} 얻습니다.' },
  fortress: { name: '요새', icon: '🏰', kind: 'buff', desc: '턴이 시작될 때 방어도가 사라지지 않습니다.' },
  ward: { name: '결계', icon: '✨', kind: 'buff', desc: '다음에 받는 해로운 효과 {value}개를 무효로 합니다.' },
  insight: { name: '통찰', icon: '👁️', kind: 'buff', desc: '턴이 시작될 때 카드를 {value}장 더 뽑습니다.' },
  surge: { name: '활력', icon: '⚡', kind: 'buff', desc: '턴이 시작될 때 에너지를 {value} 더 얻습니다.' },
  toxicAura: { name: '독기', icon: '🍄', kind: 'buff', desc: '턴이 시작될 때 모든 상대에게 독을 {value} 부여합니다.' },
  enrage: { name: '격분', icon: '😡', kind: 'buff', desc: '플레이어가 스킬 카드를 사용할 때마다 힘을 {value} 얻습니다.' },
  nextTurnBlock: { name: '대비', icon: '🔰', kind: 'buff', desc: '다음 턴이 시작될 때 방어도를 {value} 얻습니다.' },
  nextTurnEnergy: { name: '비축', icon: '🔋', kind: 'buff', desc: '다음 턴이 시작될 때 에너지를 {value} 더 얻습니다.' },
  nextTurnDraw: { name: '준비', icon: '📜', kind: 'buff', desc: '다음 턴이 시작될 때 카드를 {value}장 더 뽑습니다.' },

  // ---- 디버프 ----
  weak: { name: '약화', icon: '🥀', kind: 'debuff', desc: '주는 공격 피해가 25% 감소합니다. 턴이 끝날 때마다 1 감소. ({value}턴)' },
  vulnerable: { name: '취약', icon: '💔', kind: 'debuff', desc: '받는 공격 피해가 50% 증가합니다. 턴이 끝날 때마다 1 감소. ({value}턴)' },
  frail: { name: '허약', icon: '🧊', kind: 'debuff', desc: '카드로 얻는 방어도가 25% 감소합니다. 턴이 끝날 때마다 1 감소. ({value}턴)' },
  poison: { name: '독', icon: '☠️', kind: 'debuff', desc: '턴이 시작될 때 체력을 {value} 잃고(방어도 무시), 수치가 1 감소합니다.' },

  // ---- 카드 키워드 ----
  block: { name: '방어도', icon: '🛡️', kind: 'keyword', desc: '받는 피해를 먼저 막아줍니다. 보통 내 턴이 시작될 때 사라집니다.' },
  exhaust: { name: '소멸', icon: '🔥', kind: 'keyword', desc: '사용하면 이번 전투에서 제외됩니다.' },
  ethereal: { name: '휘발', icon: '💨', kind: 'keyword', desc: '턴이 끝날 때 손에 남아 있으면 소멸합니다.' },
  retain: { name: '보존', icon: '📌', kind: 'keyword', desc: '턴이 끝나도 버려지지 않고 손에 남습니다.' },
  innate: { name: '선천', icon: '⭐', kind: 'keyword', desc: '전투가 시작될 때 항상 첫 손패에 들어옵니다.' },
  unplayable: { name: '사용 불가', icon: '🚫', kind: 'keyword', desc: '이 카드는 낼 수 없습니다.' },
  power: { name: '파워', icon: '🔮', kind: 'keyword', desc: '사용하면 이번 전투 내내 효과가 지속됩니다.' },
};

/* 상태 아이콘 표시 순서 */
CB.data.statusOrder = [
  'strength', 'dexterity', 'plating', 'thorns', 'regen', 'fervor', 'fortress', 'ward', 'insight', 'surge',
  'toxicAura', 'enrage', 'nextTurnBlock', 'nextTurnEnergy', 'nextTurnDraw', 'weak', 'vulnerable', 'frail', 'poison',
];
