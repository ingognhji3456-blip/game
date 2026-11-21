'use strict';

/* =========================================================
 * NEON RAID — 시작 (원본 NeonRaid.tsx 가 하던 일)
 * 캔버스에 엔진을 붙이고 돌립니다.
 * ========================================================= */
(() => {
  const canvas = document.getElementById('game');
  const engine = new NeonRaidEngine(canvas);
  engine.start();
  window.neonRaid = engine; // 콘솔에서 살펴보기용
})();
