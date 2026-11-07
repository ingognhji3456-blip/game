'use strict';

/* =========================================================
 * 일반 적 — 능력치는 챕터별 기준값에 곱하는 배율입니다.
 *   hp  : 기준 공격력 × hp      dmg : 기준 피해 단위 × dmg
 * 행동은 js/core/ai.js 의 MINION_AI[ai] 가 맡습니다.
 * ========================================================= */
window.AZ = window.AZ || {};
AZ.data = AZ.data || {};

AZ.data.enemies = {
  hound: { name: '기계 사냥개', ai: 'hound', hp: 7, dmg: 0.55, r: 20, speed: 175, exp: 12, credits: 6, color: '#ff5470' },
  drone: { name: '정찰 드론', ai: 'drone', hp: 5, dmg: 0.45, r: 16, speed: 120, exp: 10, credits: 5, color: '#5fd4ff', flying: true },
  soldier: { name: '집행 병사', ai: 'soldier', hp: 9, dmg: 0.4, r: 18, speed: 105, exp: 14, credits: 7, color: '#9ab0ff' },
  guardBot: { name: '방패 병기', ai: 'guardBot', hp: 16, dmg: 0.9, r: 28, speed: 70, exp: 22, credits: 10, color: '#8fa8c8', shield: 1.8 },
  sniper: { name: '저격 유닛', ai: 'sniper', hp: 6, dmg: 1.0, r: 17, speed: 90, exp: 16, credits: 8, color: '#ffb35c' },
  bomber: { name: '자폭 드론', ai: 'bomber', hp: 3, dmg: 1.1, r: 15, speed: 210, exp: 8, credits: 4, color: '#ff9b3d', flying: true },
  // 보스가 불러내는 적
  seraClone: { name: '기억의 환영', ai: 'seraClone', hp: 0.5, dmg: 0.6, r: 26, speed: 0, exp: 0, credits: 0, color: '#d8c8ff', flying: true, clone: true },
  miniDrone: { name: '감시 드론', ai: 'drone', hp: 3, dmg: 0.4, r: 14, speed: 140, exp: 2, credits: 1, color: '#66e0ff', flying: true },
};
