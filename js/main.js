'use strict';

/* =========================================================
 * 시작점
 * ========================================================= */
document.addEventListener('DOMContentLoaded', () => {
  CB.fx.init();
  CB.ui.flow.applySettings(CB.save.loadSettings());

  // 브라우저 정책상 소리는 첫 입력 이후에만 켤 수 있습니다.
  const unlockAudio = () => {
    CB.audio.init();
    window.removeEventListener('pointerdown', unlockAudio);
    window.removeEventListener('keydown', unlockAudio);
  };
  window.addEventListener('pointerdown', unlockAudio);
  window.addEventListener('keydown', unlockAudio);

  // 모달은 Esc 로 닫기 (닫을 수 있는 것만)
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'Escape') return;
    const top = CB.ui.modal.top();
    if (top && top.dismissable) top.close();
  });

  CB.ui.flow.boot();

  // 테스트용: index.html?debug
  if (/[?&]debug\b/.test(location.search)) {
    const flow = CB.ui.flow;
    CB.debug = {
      win: () => CB.ui.battle.debugWin(),
      lose: () => CB.ui.battle.debugLose(),
      gold: (n = 500) => { CB.run.addGold(flow.run, n); CB.ui.hud.render(flow.run); },
      relic: (id) => { flow.takeRelic(id); },
      card: (id, upgraded) => { CB.run.addCard(flow.run, id, upgraded); CB.ui.hud.render(flow.run); },
      potion: (id) => { CB.run.addPotion(flow.run, id); CB.ui.hud.render(flow.run); },
      heal: () => { flow.run.player.hp = flow.run.player.maxHp; CB.ui.hud.render(flow.run); },
      act: (n) => {
        const run = flow.run;
        run.act = n;
        run.floor = 0;
        run.currentNodeId = null;
        run.current = null;
        run.combatsThisAct = 3;
        run.map = CB.run.generateMap(run, n);
        flow.goMap(true);
      },
      node: (type) => {
        const run = flow.run;
        const node = CB.run.availableNodes(run)[0];
        if (!node) return;
        node.type = type;
        flow.enterNode(node.id);
      },
    };
    console.info('[debug] CB.debug 사용 가능:', Object.keys(CB.debug).join(', '));
  }
});
