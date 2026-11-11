'use strict';

/* =========================================================
 * 원소 · 공명 · 특성 · 상태 이상
 * 설계: docs/DESIGN.md §6, §7.1, §8
 * ========================================================= */

RG.data.elements = {
  fire: { name: '불', color: '#ff6b3d', dark: '#a8331a', light: '#ffc29e', shape: 'flame' },
  frost: { name: '얼음', color: '#5fd4ff', dark: '#1f7fa8', light: '#c8f2ff', shape: 'crystal' },
  storm: { name: '폭풍', color: '#9b8cff', dark: '#4b3fb0', light: '#d8d2ff', shape: 'bolt' },
  earth: { name: '대지', color: '#8fcf5a', dark: '#4a7a26', light: '#d4f0b8', shape: 'mountain' },
  light: { name: '빛', color: '#ffe48a', dark: '#b8902a', light: '#fff8dc', shape: 'star' },
  dark: { name: '어둠', color: '#d14fc0', dark: '#6e1f66', light: '#f2b8ea', shape: 'moon' },
};

RG.data.elementOrder = ['fire', 'frost', 'storm', 'earth', 'light', 'dark'];

/**
 * 공명 효과. 키는 elementOrder 순서로 정렬한 'a+b', 같은 원소는 'pure'.
 * mods 키 목록은 docs/ARCHITECTURE.md §3.1.
 */
RG.data.resonance = {
  pure: {
    id: 'pure', name: '순수 공명',
    desc: '피해 +12%',
    mods: { damagePct: 0.12 },
  },
  'fire+frost': {
    id: 'steam', name: '증기 폭발',
    desc: '명중 시 25% 확률로 작은 폭발을 일으킵니다 (반경 0.8칸, 피해의 40%)',
    mods: { steam: { chance: 0.25, radius: 0.8, pct: 0.4 } },
  },
  'fire+storm': {
    id: 'overheat', name: '과열',
    desc: '피해 +20%',
    mods: { damagePct: 0.2 },
  },
  'fire+earth': {
    id: 'magma', name: '용암',
    desc: '명중 시 갑옷 −5%p (최대 −20%p, 4초)',
    mods: { shredOnHit: { pct: 0.05, max: 0.2, dur: 4 } },
  },
  'fire+light': {
    id: 'sunfire', name: '태양 불꽃',
    desc: '사거리 +15%',
    mods: { rangePct: 0.15 },
  },
  'fire+dark': {
    id: 'cinder', name: '잿불',
    desc: '명중 시 화상 (피해의 30%를 3초에 걸쳐)',
    mods: { burnOnHit: { pct: 0.3, dur: 3 } },
  },
  'frost+storm': {
    id: 'superconduct', name: '초전도',
    desc: '빙결·기절·속박된 적에게 피해 +50%',
    mods: { bonusVsControlled: 0.5 },
  },
  'frost+earth': {
    id: 'permafrost', name: '영구 동토',
    desc: '명중 시 감속 15% (1초)',
    mods: { slowOnHit: { pct: 0.15, dur: 1 } },
  },
  'frost+light': {
    id: 'refraction', name: '굴절',
    desc: '비행 적에게 피해 +30%',
    mods: { bonusVsFlying: 0.3 },
  },
  'frost+dark': {
    id: 'stillness', name: '고요한 밤',
    desc: '명중한 적의 재생·치유 −50% (3초), 보호막에 주는 피해 +50%',
    mods: { stillness: { dur: 3, shieldBonus: 0.5 } },
  },
  'storm+earth': {
    id: 'grounding', name: '접지',
    desc: '명중 시 10% 확률로 기절 0.5초 (보스 제외)',
    mods: { stunOnHit: { chance: 0.1, dur: 0.5 } },
  },
  'storm+light': {
    id: 'flash', name: '뇌광',
    desc: '공격 속도 +20%',
    mods: { speedPct: 0.2 },
  },
  'storm+dark': {
    id: 'tempest', name: '폭풍우',
    desc: '명중 시 근처(1.5칸) 적 1명에게 튑니다 (피해의 35%)',
    mods: { chainExtra: { radius: 1.5, pct: 0.35 } },
  },
  'earth+light': {
    id: 'blessed', name: '축복받은 땅',
    desc: '이 탑이 처치한 적의 현상금 +50%',
    mods: { bountyPct: 0.5 },
  },
  'earth+dark': {
    id: 'gravity', name: '중력',
    desc: '지상 적에게 피해 +15%, 명중 시 감속 10% (1초)',
    mods: { bonusVsGround: 0.15, slowOnHit: { pct: 0.1, dur: 1 } },
  },
  'light+dark': {
    id: 'twilight', name: '황혼',
    desc: '갑옷 25% 무시, 정예·보스에게 피해 +15%',
    mods: { armorIgnore: 0.25, bonusVsElite: 0.15 },
  },
};

/** 지원 탑이 공명 효과 대신 받는 증폭 (서로 다른 효과 하나당) */
RG.data.supportAmpPerLink = 0.1;

/** 엔진 규칙 상수 — DESIGN.md §7.2 */
RG.data.rules = {
  lives: 12,
  starLives: [6, 11],          // ★2, ★3에 필요한 남은 불꽃
  buildTime: 1.0,              // 전투 중 건설 준비 시간(초)
  soldTileLock: 5,             // 판 칸 재건설 금지(초)
  sellRate: 0.7,
  countdown: 15,
  hardCc: { window: 4, mults: [1, 0.5, 0.25], immune: 2 },
  fearSpeed: 0.8, // 공포(공포의 종)에 걸린 적이 뒷걸음질하는 속도 (평소 속도 대비)
  push: { per: 0.35, decay: 0.25 },
  bountyCap: 0.75,
  mineFalloff: [1, 0.8, 0.6, 0.4],
  regenDelay: 2,
  heroRespawn: 15,
  heroXpRadius: 2.5,
  beamProcEvery: 0.5,
  bossWarn: 1.5,
};

/** 적 특성 — DESIGN.md §8 */
RG.data.traits = {
  flying: { name: '비행', icon: 'flying', desc: '길을 따라 날아옵니다. 붙잡을 수 없고, 지상 전용 탑에 맞지 않습니다.' },
  armor: { name: '갑옷', icon: 'armor', desc: '받는 피해가 갑옷 수치만큼 줄어듭니다. 갑옷 파쇄로 깎을 수 있습니다.' },
  regen: { name: '재생', icon: 'regen', desc: '2초 동안 피해를 받지 않으면 매초 최대 체력의 일부를 회복합니다.' },
  split: { name: '분열', icon: 'split', desc: '죽으면 작은 적 여러 마리로 갈라집니다.' },
  stealth: { name: '은신', icon: 'stealth', desc: '탐지 범위 밖에서는 표적이 될 수 없습니다. 폭발·파동·관통·장판 같은 범위 공격에는 맞고, 병사와 영웅은 붙잡아 공격할 수 있습니다.' },
  shield: { name: '보호막', icon: 'shield', desc: '체력보다 먼저 깎이는 보호막이 있습니다. 잠시 피해를 받지 않으면 다시 찹니다.' },
  healer: { name: '치유사', icon: 'healer', desc: '주기적으로 주변 적의 체력을 회복시킵니다.' },
  shielder: { name: '보호막 부여', icon: 'shielder', desc: '주기적으로 주변 적에게 보호막을 씌웁니다.' },
  burrow: { name: '굴착', icon: 'burrow', desc: '주기적으로 땅속에 숨습니다. 숨은 동안 어떤 피해도 받지 않고 붙잡을 수도 없습니다.' },
  dash: { name: '질주', icon: 'dash', desc: '처음 피해를 받으면 잠시 빠르게 달립니다.' },
  undying: { name: '부활', icon: 'undying', desc: '처음 쓰러지면 체력 일부로 다시 일어납니다. 처형당하면 부활하지 않습니다.' },
  deathburst: { name: '죽음 폭발', icon: 'deathburst', desc: '죽을 때 터져 주변 영웅·병사에게 피해를 줍니다.' },
  ranged: { name: '원거리', icon: 'ranged', desc: '걸으면서 사거리 안의 영웅·병사를 공격합니다.' },
  shock: { name: '마비 폭발', icon: 'shock', desc: '죽을 때 터져 주변 탑을 잠시 멈춥니다.' },
  silence: { name: '침묵', icon: 'silence', desc: '지나가는 동안 주변 탑을 멈춥니다(공격·지원·공명 모두 꺼짐).' },
  adaptive: { name: '적응', icon: 'adaptive', desc: '같은 원소에 연속으로 맞으면 그 원소에 대한 저항이 쌓입니다. 다른 원소에 맞으면 사라집니다.' },
  dampen: { name: '공명 차단', icon: 'dampen', desc: '주변 탑의 공명 연결을 끊습니다.' },
  unstoppable: { name: '붙잡기 불가', icon: 'unstoppable', desc: '영웅과 병사에게 붙잡히지 않습니다.' },
  fluffy: { name: '푹신', icon: 'fluffy', desc: '폭발·파동·장판 같은 범위 공격의 피해를 절반만 받습니다. 한 대상을 노리는 공격이 좋습니다.' },
  phase: { name: '위상 이동', icon: 'phase', desc: '주기적으로 일렁이다가 길을 따라 몇 칸 앞으로 순간이동합니다. 붙잡혀 있어도 빠져나갑니다.' },
};

/** 원소 친화 */
RG.data.affinities = {
  weak: { name: '약점', mult: 1.5, desc: '받는 피해 ×1.5' },
  resist: { name: '저항', mult: 0.5, desc: '받는 피해 ×0.5' },
  immune: { name: '면역', mult: 0, desc: '피해를 받지 않음' },
  absorb: { name: '흡수', mult: 0, desc: '피해만큼 체력을 회복' },
};

/** 적에게 걸리는 상태 이상 — DESIGN.md §7.1 */
RG.data.statuses = {
  slow: { name: '감속', icon: 'slow', desc: '이동 속도가 느려집니다. 가장 강한 감속 하나만 적용됩니다.' },
  freeze: { name: '빙결', icon: 'freeze', desc: '움직이지도 공격하지도 못합니다. 강한 제어 — 연달아 걸리면 시간이 줄고 잠시 면역이 됩니다.' },
  stun: { name: '기절', icon: 'stun', desc: '움직이지도 공격하지도 못합니다. 보스는 면역입니다.' },
  root: { name: '속박', icon: 'root', desc: '움직이지 못합니다(공격은 가능).' },
  burn: { name: '화상', icon: 'burn', desc: '매초 피해를 받습니다(화상을 건 탑의 원소). 갑옷을 무시합니다.' },
  bleed: { name: '출혈', icon: 'bleed', desc: '매초 어둠 피해를 받습니다. 갑옷을 무시합니다.' },
  curse: { name: '저주', icon: 'curse', desc: '받는 피해가 늘어납니다. 가장 강한 저주 하나만 적용됩니다.' },
  shred: { name: '갑옷 파쇄', icon: 'shred', desc: '갑옷이 줄어듭니다.' },
  stillness: { name: '치유 감소', icon: 'stillness', desc: '재생·치유 효과가 절반이 됩니다.' },
  blind: { name: '실명', icon: 'blind', desc: '원거리 공격을 할 수 없고, 은신이 드러납니다.' },
  lift: { name: '공중 띄움', icon: 'lift', desc: '공중에 떠서 아무것도 하지 못하고, 붙잡힌 상태가 풀립니다.' },
  purify: { name: '정화', icon: 'stillness', desc: '보호막이 사라지고 재생·치유·보호막 재생이 멈춥니다.' },
  veil: { name: '서리 장막', icon: 'veil', desc: '감속된 동안 받는 피해가 늘어납니다.' },
};

/** 표적 우선순위 */
RG.data.targetModes = {
  first: { name: '첫째', desc: '울림등에 가장 가까운 적' },
  last: { name: '마지막', desc: '울림등에서 가장 먼 적' },
  strong: { name: '강한 적', desc: '남은 체력이 가장 많은 적' },
  weak: { name: '약한 적', desc: '남은 체력이 가장 적은 적' },
  close: { name: '가까운 적', desc: '탑에서 가장 가까운 적' },
};
RG.data.targetModeOrder = ['first', 'last', 'strong', 'weak', 'close'];
