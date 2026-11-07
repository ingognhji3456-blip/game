'use strict';

/* =========================================================
 * 챕터 10개
 *   theme    : 배경(§3 배경 id)
 *   waves    : 보스 전에 치르는 웨이브 [[적 id, 수], ...]
 *   reward   : 첫 클리어 보상 { modules, weapon }
 *   challenge: 보스전 도전 과제 → 달성하면 두 번째 기억 파편
 *   arena    : 경기장 크기(월드 px)
 * ========================================================= */
window.AZ = window.AZ || {};
AZ.data = AZ.data || {};

AZ.data.chapters = [
  {
    id: 1, name: '잿빛 각성', boss: 'scavenger', theme: 'ruins', music: 'stage',
    waves: [[['hound', 2]], [['hound', 3], ['drone', 1]], [['hound', 2], ['drone', 2]]],
    reward: { modules: ['vitality', 'edge'] },
    challenge: { stat: 'zeroFrames', op: '>=', value: 1, desc: 'ZERO FRAME 1회 이상 발동' },
  },
  {
    id: 2, name: '잃어버린 도시', boss: 'arka', theme: 'city', music: 'stage',
    waves: [[['soldier', 2], ['hound', 2]], [['guardBot', 1], ['soldier', 2]], [['drone', 3], ['hound', 2]]],
    reward: { weapon: 'twin', modules: ['phase'], choiceModule: { flag: 'survivorsFirst', yes: 'guardian', no: 'analyzer' } },
    challenge: { stat: 'weakHits', op: '>=', value: 15, desc: '약점 공격 15회 이상' },
  },
  {
    id: 3, name: '유령의 신호', boss: 'observer', theme: 'lab', music: 'stage',
    waves: [[['drone', 4]], [['sniper', 2], ['hound', 2]], [['guardBot', 1], ['drone', 3]]],
    reward: { weapon: 'great', modules: ['breaker'] },
    challenge: { stat: 'breaks', op: '>=', value: 1, desc: '옵저버를 1회 이상 브레이크' },
  },
  {
    id: 4, name: '붉은 프로토콜', boss: 'zero', theme: 'highway', music: 'stage',
    waves: [[['soldier', 3], ['bomber', 2]], [['hound', 4], ['sniper', 1]], [['guardBot', 2], ['soldier', 2]]],
    reward: { modules: ['syncro', 'focusLens'] },
    challenge: { stat: 'countered', op: '<=', value: 0, desc: '제로의 반격에 한 번도 당하지 않기' },
  },
  {
    id: 5, name: '폐쇄된 천공', boss: 'atlas', theme: 'sky', music: 'stage', arena: [1800, 1150],
    waves: [[['guardBot', 2], ['drone', 3]], [['bomber', 4], ['soldier', 2]], [['sniper', 2], ['guardBot', 1], ['hound', 2]]],
    reward: { weapon: 'spear', modules: ['overclock'] },
    challenge: { stat: 'rankScore', op: '>=', value: 55, desc: 'B 랭크 이상으로 승리' },
  },
  {
    id: 6, name: '기억의 파편', boss: 'sera', theme: 'archive', music: 'stage2',
    waves: [[['drone', 4], ['bomber', 2]], [['soldier', 3], ['sniper', 2]], [['guardBot', 2], ['hound', 3]]],
    reward: { weapon: 'rail', modules: ['afterimage', 'vampire'] },
    challenge: { stat: 'scans', op: '>=', value: 2, desc: '"분석" 명령 2회 이상 사용' },
  },
  {
    id: 7, name: '반역자의 이름', boss: 'draco', theme: 'skyport', music: 'stage2', arena: [1900, 1200],
    waves: [[['drone', 5], ['sniper', 1]], [['bomber', 4], ['hound', 3]], [['soldier', 3], ['guardBot', 2]]],
    reward: { modules: ['chainAmp', 'reactive'] },
    challenge: { stat: 'breaks', op: '>=', value: 2, desc: '드라코를 2회 이상 추락(브레이크)시키기' },
  },
  {
    id: 8, name: '인류의 마지막', boss: 'nemesis', theme: 'warfront', music: 'stage2', arena: [1800, 1150],
    waves: [[['soldier', 4], ['guardBot', 1]], [['bomber', 5], ['sniper', 2]], [['guardBot', 2], ['hound', 3], ['drone', 2]]],
    reward: { modules: ['chrono'] },
    challenge: { stat: 'hitsTaken', op: '<=', value: 8, desc: '피격 8회 이하로 승리' },
  },
  {
    id: 9, name: '제로 프로토콜', boss: 'protocol', theme: 'core', music: 'stage2',
    waves: [[['sniper', 3], ['drone', 3]], [['guardBot', 3], ['bomber', 3]], [['soldier', 4], ['hound', 3], ['sniper', 1]]],
    reward: { modules: [], choiceModule: { flag: 'survivorsFirst', yes: 'analyzer', no: 'guardian' } },
    challenge: { stat: 'zeroFrames', op: '>=', value: 4, desc: 'ZERO FRAME 4회 이상 발동' },
  },
  {
    id: 10, name: '별의 종말', boss: 'astra', theme: 'void', music: 'stage2', arena: [1800, 1150],
    waves: [[['drone', 4], ['sniper', 2], ['bomber', 2]], [['guardBot', 3], ['soldier', 3]], [['hound', 5], ['bomber', 3]]],
    reward: { modules: [] },
    challenge: { stat: 'rankScore', op: '>=', value: 75, desc: 'A 랭크 이상으로 승리' },
  },
];

AZ.data.difficulties = {
  story: { name: '스토리', desc: '이야기를 즐기고 싶은 분께. 받는 피해 크게 감소, 경고 시간 증가.', dmg: 0.5, hp: 0.75, warn: 1.25, aggro: 0.8 },
  normal: { name: '노멀', desc: '기획 의도대로의 긴장감 있는 전투.', dmg: 1.0, hp: 1.0, warn: 1.0, aggro: 1.0 },
  hard: { name: '하드', desc: '숙련자용. 보스가 더 단단하고, 더 아프고, 더 빠르다.', dmg: 1.4, hp: 1.3, warn: 0.85, aggro: 1.2 },
};
