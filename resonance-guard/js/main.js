'use strict';

/* 시작점 */
document.addEventListener('DOMContentLoaded', () => {
  RG.progress.load();
  RG.ui.applySettings();
  // 첫 사용자 동작에서 소리 켜기
  const unlock = () => { try { if (RG.audio) RG.audio.init(); } catch (e) { /* 무시 */ } };
  document.addEventListener('pointerdown', unlock, { once: true });
  document.addEventListener('keydown', unlock, { once: true });
  // 버튼 클릭 소리
  document.addEventListener('click', (e) => {
    if (e.target.closest && e.target.closest('button') && !e.target.closest('.no-click-sfx')) RG.ui.sfx('click', { vol: 0.5 });
  }, true);
  // 세로 휴대폰 안내
  const rot = document.getElementById('rotate-hint');
  const checkRotate = () => {
    const portrait = window.innerHeight > window.innerWidth && window.innerWidth < 700;
    rot.classList.toggle('show', portrait && document.body.dataset.screen === 'game');
  };
  window.addEventListener('resize', checkRotate);
  new MutationObserver(checkRotate).observe(document.body, { attributes: true, attributeFilter: ['data-screen'] });
  const params = new URLSearchParams(location.search);
  if (params.has('debug')) {
    window.RGdebug = {
      unlockAll() { for (const m of RG.data.maps) RG.progress.get().maps[m.id] = { cleared: true, stars: 3, task: true, challenge: true }; RG.progress.save(); RG.ui.show('world', {}); },
      gold(n = 1000) { const g = RG.ui.game.game; if (g) g.state.gold += n; },
      win() { const g = RG.ui.game.game; if (g) { g.state.wave.index = g.state.wave.total; g.state.wave.queue = []; g.state.enemies = []; } },
    };
  }
  const start = params.get('screen');
  if (start === 'game') RG.ui.show('game', { opts: { mapId: params.get('map') || '1-1', heroId: params.get('hero') || 'kara', seed: 1, mode: 'normal', towers: RG.progress.towersFor(params.get('map') || '1-1'), towerRanks: RG.progress.towerRanks(), finalLv2: true, branches: true } });
  else RG.ui.show(start || 'title', {});
});
