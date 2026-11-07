'use strict';

/* =========================================================
 * 무기 5종
 * 공격 단계(step) 필드:
 *   dur   동작 전체 시간(초)          hit / hits  판정이 나오는 시각(초)
 *   range 사거리(px)  arc 판정 각도(라디안, 6.3 = 전방위)
 *   mv    피해 배율(공격력 × mv)      brk  브레이크 게이지 피해
 *   lunge 앞으로 내딛는 거리          fx   베기 연출 종류
 *   armor 동작 중 경직 무시           air  공중의 적에게도 닿음
 *   proj  투사체 { speed, r, life, pierce, spread, count }
 *   beam  관통 광선 { len, w }
 *   shock 착지 충격파 반지름
 * ========================================================= */
window.AZ = window.AZ || {};
AZ.data = AZ.data || {};

AZ.data.weapons = {
  blade: {
    id: 'blade', name: '에너지 검', short: '검', unlockAfter: 0,
    color: '#5fd4ff', glow: '#a8ecff', atk: 1.0, crit: 0.05,
    desc: '균형 잡힌 기본 무기. 4연격 콤보와 묵직한 내려베기.',
    comboWindow: 0.38,
    combo: [
      { dur: 0.30, hit: 0.10, range: 100, arc: 2.3, mv: 1.0, brk: 3, lunge: 40, fx: 'slashR' },
      { dur: 0.30, hit: 0.10, range: 100, arc: 2.3, mv: 1.0, brk: 3, lunge: 40, fx: 'slashL' },
      { dur: 0.34, hit: 0.12, range: 112, arc: 2.0, mv: 1.25, brk: 4, lunge: 55, fx: 'slashR' },
      { dur: 0.52, hits: [0.14, 0.26], range: 125, arc: 6.3, mv: 1.0, brk: 5, lunge: 60, fx: 'spin' },
    ],
    heavy: { dur: 0.62, hit: 0.30, range: 138, arc: 2.4, mv: 2.8, brk: 16, lunge: 90, fx: 'smash', armor: true },
  },
  twin: {
    id: 'twin', name: '쌍검', short: '쌍검', unlockAfter: 2,
    color: '#7cf7d4', glow: '#c4fff0', atk: 0.95, crit: 0.15,
    desc: '빠른 6연격. 콤보와 집중 게이지를 빠르게 쌓지만 브레이크 피해가 낮다. 치명타율 +10%.',
    comboWindow: 0.32,
    combo: [
      { dur: 0.20, hit: 0.07, range: 88, arc: 2.0, mv: 0.62, brk: 1.6, lunge: 30, fx: 'slashR' },
      { dur: 0.20, hit: 0.07, range: 88, arc: 2.0, mv: 0.62, brk: 1.6, lunge: 30, fx: 'slashL' },
      { dur: 0.20, hit: 0.07, range: 88, arc: 2.0, mv: 0.62, brk: 1.6, lunge: 30, fx: 'slashR' },
      { dur: 0.22, hit: 0.08, range: 92, arc: 2.2, mv: 0.7, brk: 1.8, lunge: 36, fx: 'slashL' },
      { dur: 0.24, hits: [0.06, 0.14], range: 92, arc: 2.4, mv: 0.55, brk: 1.6, lunge: 40, fx: 'cross' },
      { dur: 0.42, hits: [0.08, 0.16, 0.24], range: 110, arc: 6.3, mv: 0.55, brk: 2, lunge: 50, fx: 'spin' },
    ],
    heavy: { dur: 0.70, hits: [0.12, 0.22, 0.32, 0.42, 0.52], range: 115, arc: 6.3, mv: 0.7, brk: 3, lunge: 70, fx: 'spin' },
  },
  great: {
    id: 'great', name: '대검', short: '대검', unlockAfter: 3,
    color: '#ffb35c', glow: '#ffe0b0', atk: 1.05, crit: 0.05,
    desc: '느리지만 한 방이 크다. 동작 중 경직되지 않으며 브레이크 피해가 매우 높다.',
    comboWindow: 0.45,
    combo: [
      { dur: 0.55, hit: 0.25, range: 132, arc: 2.6, mv: 2.0, brk: 8, lunge: 50, fx: 'slashR', armor: true },
      { dur: 0.55, hit: 0.25, range: 132, arc: 2.6, mv: 2.0, brk: 8, lunge: 50, fx: 'slashL', armor: true },
      { dur: 0.75, hit: 0.36, range: 140, arc: 2.2, mv: 3.0, brk: 14, lunge: 60, fx: 'smash', armor: true, shock: 150 },
    ],
    heavy: { dur: 1.0, hit: 0.56, range: 165, arc: 3.0, mv: 4.6, brk: 30, lunge: 80, fx: 'smash', armor: true, shock: 210 },
  },
  spear: {
    id: 'spear', name: '에너지 창', short: '창', unlockAfter: 5,
    color: '#b28cff', glow: '#e2d4ff', atk: 1.0, crit: 0.08,
    desc: '긴 사거리의 찌르기. 일직선의 적을 꿰뚫고, 공중의 적에게도 닿는다.',
    comboWindow: 0.38,
    combo: [
      { dur: 0.32, hit: 0.12, range: 170, arc: 0.8, mv: 1.1, brk: 3.5, lunge: 45, fx: 'thrust', air: true },
      { dur: 0.32, hit: 0.12, range: 170, arc: 0.8, mv: 1.1, brk: 3.5, lunge: 45, fx: 'thrust', air: true },
      { dur: 0.36, hits: [0.1, 0.2], range: 175, arc: 0.9, mv: 0.8, brk: 3, lunge: 50, fx: 'thrust', air: true },
      { dur: 0.48, hit: 0.18, range: 155, arc: 3.4, mv: 1.7, brk: 6, lunge: 55, fx: 'spin', air: true },
    ],
    heavy: { dur: 0.66, hit: 0.30, range: 130, arc: 1.3, mv: 2.7, brk: 15, lunge: 270, fx: 'thrust', armor: true, air: true },
  },
  rail: {
    id: 'rail', name: '레일건', short: '레일건', unlockAfter: 6,
    color: '#ff7ad9', glow: '#ffd0f2', atk: 0.9, crit: 0.08,
    desc: '원거리 사격. 모든 공격이 공중의 적에게 닿는다. 강공격은 관통 광선.',
    comboWindow: 0.30,
    combo: [
      { dur: 0.20, hit: 0.05, mv: 0.55, brk: 1.3, lunge: 0, fx: 'shot', air: true, proj: { speed: 1150, r: 10, life: 0.8 } },
      { dur: 0.20, hit: 0.05, mv: 0.55, brk: 1.3, lunge: 0, fx: 'shot', air: true, proj: { speed: 1150, r: 10, life: 0.8 } },
      { dur: 0.20, hit: 0.05, mv: 0.55, brk: 1.3, lunge: 0, fx: 'shot', air: true, proj: { speed: 1150, r: 10, life: 0.8 } },
      { dur: 0.20, hit: 0.05, mv: 0.55, brk: 1.3, lunge: 0, fx: 'shot', air: true, proj: { speed: 1150, r: 10, life: 0.8 } },
      { dur: 0.36, hit: 0.10, mv: 0.6, brk: 2, lunge: -20, fx: 'shot', air: true, proj: { speed: 1050, r: 12, life: 0.8, count: 3, spread: 0.22 } },
    ],
    heavy: { dur: 0.80, hit: 0.46, mv: 3.4, brk: 20, lunge: -40, fx: 'beam', air: true, beam: { len: 950, w: 30 } },
  },
};

AZ.data.weaponOrder = ['blade', 'twin', 'great', 'spear', 'rail'];

/** 무기 강화 비용 (다음 레벨로) — index = 현재 레벨 */
AZ.data.weaponUpgradeCost = [0, 400, 900, 1600, 2600];
AZ.data.weaponMaxLevel = 5;
AZ.data.weaponLevelBonus = 0.12; // 레벨당 공격력 +12%
