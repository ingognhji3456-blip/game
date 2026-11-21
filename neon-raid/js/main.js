'use strict';

/* =========================================================
 * 네온 레이드 — 시작 (원본 NeonRaid.tsx 가 하던 일)
 * 캔버스에 엔진을 붙이고, 창 크기에 맞춰 고해상도로 그리게 한 뒤 돌립니다.
 * ========================================================= */
(() => {
  const canvas = document.getElementById('game');
  const engine = new NeonRaidEngine(canvas);
  const fit = () => engine.fitToParent();
  window.addEventListener('resize', fit);
  fit();
  engine.start();
  window.neonRaid = engine; // 콘솔에서 살펴보기용
})();
