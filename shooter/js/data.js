'use strict';

/* =========================================================
 * 하늘 사냥꾼 — 게임 데이터 (기계 요새 내부에서 벌이는 보스 결전)
 * 무기 · 보스(무기 위치 · 단계 · 패턴 묶음)
 * 패턴 자체(어떻게 조준하고 충전하고 쏘는지)는 js/boss.js 에 있습니다.
 * ========================================================= */

(() => {
  /* ---------------- 내 무기 ----------------
   * 파워 아이템을 먹을 때마다 레벨이 오르고, 아이템 색이 무기 종류를 정합니다. */
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

  /** 결전 무대: 기계 요새 내부 */
  SH.STAGE = { en: '최종 작전', name: '요새 내부로 진입!', bg: 'hangar', music: 'boss' };

  /* ---------------- 기계 보스 ----------------
   * 좌표는 논리 좌표(960×540), 보스 가운데 기준. 화면 픽셀은 ÷2.
   * weapons: 보스 몸에 달린 무기. unlock 단계부터 나타나고 lose 단계부터 부서져 없어짐.
   *   turret  — 돌아가는 포탑 (첫 단계 목표, 체력 있음)
   *   emitter — 플라스마 구체를 키워서 던지는 발사구
   *   vent    — 작은 탄을 흩뿌리는 배기구
   *   cannon  — 주포 (조준 → 충전 → 굵은 레이저)
   *   pod     — 미사일 포드 (뚜껑이 열리고 미사일 발사)
   *   antenna — 벽 레이저포를 부르는 신호기
   * phases: 차례로 진행. needParts 의 무기를 모두 부수거나, 코어 체력이 until 아래로 떨어지면 다음 단계.
   *   pool: 이 단계에서 쓰는 패턴과 뽑힐 확률(무게). 바로 전에 쓴 패턴은 다시 뽑지 않음.
   *   unlock: 단계가 바뀔 때 새로 꺼내는 무기 이름 (화면에 크게 알림) */
  SH.BOSS = {
    name: '강철 요새 타이탄', title: '요새의 심장을 지키는 기계 거신', art: 'titan',
    y: 128, sway: 150, score: 150000,
    hull: { rx: 140, ry: 60 },
    core: { ox: 0, oy: 0, r: 30, hp: 2400 },
    weapons: {
      turretL: { kind: 'turret', ox: -100, oy: 24, len: 26, hp: 300, unlock: 0, lose: 1, score: 15000 },
      turretR: { kind: 'turret', ox: 100, oy: 24, len: 26, hp: 300, unlock: 0, lose: 1, score: 15000 },
      emitL: { kind: 'emitter', ox: -56, oy: 44, len: 12, unlock: 0, lose: 2 },
      emitR: { kind: 'emitter', ox: 56, oy: 44, len: 12, unlock: 0, lose: 2 },
      ventL: { kind: 'vent', ox: -80, oy: -20, len: 8, unlock: 0, lose: 2 },
      ventR: { kind: 'vent', ox: 80, oy: -20, len: 8, unlock: 0, lose: 2 },
      cannon: { kind: 'cannon', ox: 0, oy: 52, len: 30, unlock: 1 },
      podL: { kind: 'pod', ox: -36, oy: -48, len: 6, unlock: 2 },
      podR: { kind: 'pod', ox: 36, oy: -48, len: 6, unlock: 2 },
      antenna: { kind: 'antenna', ox: 0, oy: -70, len: 0, unlock: 0 },
    },
    phases: [
      {
        name: '완전 무장', look: 0, needParts: ['turretL', 'turretR'], shield: true, rest: 0.8,
        hint: '포탑을 부숴라! 코어는 방어막으로 덮여 있다',
        pool: { turretBurst: 3, turretSweep: 2, orbToss: 2, wallSnipe: 2, ventRain: 2 },
      },
      {
        name: '장갑 붕괴', look: 1, until: 0.64, rest: 0.8, unlock: '주포 개방!',
        hint: '앞쪽 장갑이 떨어져 나가며 주포가 드러났다',
        pool: { mainBeam: 3, wallCrossfire: 2, gridLasers: 2, orbToss: 2, ventRain: 1, coreRing: 2 },
      },
      {
        name: '내부 노출', look: 2, until: 0.32, rest: 0.7, unlock: '미사일 포드 개방!',
        hint: '발사구가 터지고 등 뒤 격납고가 열렸다',
        pool: { missileSalvo: 3, mainSweep: 2, wallSniper: 2, gridLasers: 2, coreSpiral: 2, beamAmbush: 2 },
      },
      {
        name: '폭주', look: 3, until: 0, rest: 0.55, unlock: '코어 폭주!', berserk: true,
        hint: '코어가 녹아내린다! 마지막 발악',
        pool: { overloadSpiral: 3, laserCage: 2, finalCharge: 2, missileSalvo: 2, mainBeam: 2, beamAmbush: 2 },
      },
    ],
  };
})();
