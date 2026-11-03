'use strict';

/* =========================================================
 * 하늘 사냥꾼 — 게임 데이터 (기계 보스 한 마리와의 결전)
 * 무기 · 보스(부품 · 단계 · 공격 패턴)
 * 숫자만 고쳐도 밸런스를 바꿀 수 있습니다.
 * ========================================================= */

(() => {
  /* ---------------- 무기 ----------------
   * 파워 아이템을 먹을 때마다 레벨이 오르고, 아이템 색이 무기 종류를 정합니다.
   * (아이템 색은 몇 초마다 바뀝니다.) */
  SH.WEAPONS = {
    spread: { name: '확산탄', color: '#ff8a3d', light: '#ffd27a' },
    laser: { name: '관통 레이저', color: '#3fb4ff', light: '#c9f0ff' },
    homing: { name: '유도 미사일', color: '#47dc7f', light: '#caffdc' },
  };
  SH.WEAPON_ORDER = ['spread', 'laser', 'homing'];
  SH.MAX_POWER = 5;
  SH.MAX_LIVES = 9;
  SH.MAX_BOMBS = 6;
  /** 이 점수를 넘길 때마다 비행기 +1 */
  SH.EXTENDS = [50000, 150000, 300000];
  SH.extendAt = (i) => (i < SH.EXTENDS.length ? SH.EXTENDS[i] : SH.EXTENDS[SH.EXTENDS.length - 1] + (i - SH.EXTENDS.length + 1) * 250000);

  /** 결전 무대 */
  SH.STAGE = { en: 'FINAL MISSION', name: '강철 요새를 막아라!', bg: 'sky', music: 'boss' };

  /* ---------------- 기계 보스 ----------------
   * 좌표는 논리 좌표(450×800). 보스 그림 가운데가 (x, y).
   * hull   : 몸통 타원 — 총알을 막아 줌(피해 없음), 부딪히면 내가 맞음
   * core   : 가운데 코어 — 체력(hp)을 가진 진짜 약점
   * parts  : 부술 수 있는 포탑 (첫 단계에서는 코어가 방어막으로 덮여 있어 포탑부터 부숴야 함)
   * phases : 차례로 진행. needParts 가 있으면 그 부품이 다 부서져야, 없으면 코어 체력이 until 비율 아래로 떨어지면 다음 단계.
   *          look = 그림 모습(0 장갑 · 1 코어 열림 · 2 부서짐 · 3 폭주)
   * 공격(a): 쏘는 곳 from = core | parts(살아 있는 포탑마다) | sides(코어 양옆)
   *   ring fan stream spiral rain wall curve split  — 보통 탄막
   *   laser    — 위험 구역을 warn 초 동안 보여 준 뒤 굵은 광선이 a0→a1 로 쓸고 지나감(dur 초)
   *              aim 이면 플레이어 쪽을 중심으로 sweep 만큼, mirror 면 오른쪽은 좌우 반대로
   *   missiles — 플레이어를 천천히 쫓는 미사일 (내 탄으로 맞혀 부술 수 있음) */
  SH.BOSS = {
    name: '강철 요새 타이탄', title: '하늘을 뒤덮은 기계 요새', art: 'titan',
    y: 215, sway: 70, score: 150000,
    hull: { rx: 140, ry: 58 },
    core: { oy: 8, r: 34, hp: 2200 },
    parts: {
      L: { ox: -96, oy: 26, r: 26, hp: 280, score: 15000 },
      R: { ox: 96, oy: 26, r: 26, hp: 280, score: 15000 },
    },
    phases: [
      {
        name: '포탑을 부숴라!', look: 0, needParts: ['L', 'R'], shield: true,
        attacks: [
          { a: 'fan', from: 'parts', n: 3, spread: 0.32, speed: 190, times: 4, every: 0.38, kind: 'orange' },
          { a: 'ring', from: 'core', n: 16, speed: 105, times: 3, every: 0.6, rot: 0.1, kind: 'blue' },
          { a: 'stream', from: 'parts', speed: 230, times: 9, every: 0.13, kind: 'red', jitter: 0.04 },
          { a: 'missiles', from: 'core', n: 4, speed: 150, times: 1, every: 0.2, kind: 'red', rest: 1.6 },
        ],
      },
      {
        name: '코어가 열렸다!', look: 1, until: 0.66,
        attacks: [
          { a: 'laser', from: 'core', aim: true, sweep: 0.5, warn: 1.0, dur: 1.4, width: 18, times: 1, every: 0.1, rest: 2.6 },
          { a: 'curve', from: 'core', n: 14, speed: 115, curve: 0.85, times: 4, every: 0.5, kind: 'blue' },
          { a: 'fan', from: 'sides', n: 5, spread: 0.7, speed: 180, times: 3, every: 0.4, kind: 'orange' },
          { a: 'missiles', from: 'sides', n: 3, speed: 155, times: 1, every: 0.2, kind: 'red', rest: 1.4 },
        ],
      },
      {
        name: '장갑이 부서진다!', look: 2, until: 0.33,
        attacks: [
          { a: 'laser', from: 'sides', a0: 1.62, a1: 2.3, mirror: true, warn: 1.0, dur: 1.8, width: 16, times: 1, every: 0.1, rest: 3.0 },
          { a: 'spiral', from: 'core', arms: 4, step: 0.19, speed: 130, times: 44, every: 0.07, kind: 'purple', still: true },
          { a: 'wall', gap: 100, step: 28, speed: 125, times: 3, every: 0.85, kind: 'red' },
          { a: 'missiles', from: 'sides', n: 4, speed: 160, times: 2, every: 0.6, kind: 'red' },
        ],
      },
      {
        name: '폭주 모드!!', look: 3, until: 0, berserk: true,
        attacks: [
          { a: 'spiral', from: 'core', arms: 3, step: 0.21, speed: 140, times: 44, every: 0.07, kind: 'red', still: true, both: true },
          { a: 'laser', from: 'core', aim: true, sweep: 0.55, warn: 0.8, dur: 1.2, width: 20, times: 1, every: 0.1, rest: 2.0 },
          { a: 'rain', from: 'sides', count: 2, cone: 1.0, speed: 185, times: 24, every: 0.08, kind: 'orange' },
          { a: 'laser', from: 'sides', a0: 1.62, a1: 2.35, mirror: true, warn: 0.85, dur: 1.5, width: 16, times: 1, every: 0.1, rest: 2.4 },
          { a: 'stream', from: 'core', speed: 250, times: 14, every: 0.075, kind: 'red', jitter: 0.05 },
          { a: 'missiles', from: 'sides', n: 5, speed: 165, times: 2, every: 0.5, kind: 'red' },
        ],
      },
    ],
  };
})();
