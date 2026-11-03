'use strict';

/* =========================================================
 * 하늘 사냥꾼 — 시작점
 * 화면 맞추기(픽셀이 고르게 보이도록 정수배 확대), 입력 나눠 주기, 게임 루프, 이벤트 → 소리·효과
 * ========================================================= */

(() => {
  const { W, DT } = SH;
  const PW = 225, PH = 400;
  const $ = (id) => document.getElementById(id);
  const S = { game: null, save: null, scale: 1, rect: null, last: 0, acc: 0 };

  /* ---------------- 화면 크기: 225×400 픽셀을 되도록 정수배로 ---------------- */
  function layout() {
    const app = $('app');
    const cs = getComputedStyle(app);
    const aw = app.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const ah = app.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    const dpr = window.devicePixelRatio || 1;
    const fit = Math.min((aw * dpr) / PW, (ah * dpr) / PH);
    // 정수배가 화면을 충분히 채우면 정수배(가장 또렷), 아니면 그대로
    const k = Math.floor(fit) >= 1 && Math.floor(fit) / fit >= 0.82 ? Math.floor(fit) : fit;
    const devW = Math.max(PW, Math.round(PW * k)), devH = Math.max(PH, Math.round(PH * k));
    const cssW = devW / dpr, cssH = devH / dpr;
    SH.render.resize(devW, devH, cssW, cssH);
    S.scale = cssW / W; // CSS 픽셀 / 게임 논리 좌표
  }

  /** 화면 좌표 → 버퍼 픽셀 좌표 */
  function toPx(e) {
    const r = $('cv').getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * PW, y: ((e.clientY - r.top) / r.height) * PH };
  }

  /* ---------------- 설정 ---------------- */
  function applySettings() {
    const st = S.save.settings;
    SH.audio.setVolume({ sfx: st.sfx, music: st.music });
    SH.fx.state.shakeOn = !!st.shake;
    SH.input.setSensitivity(st.sens);
    SH.save.store(S.save);
  }
  function vibrate(ms) {
    if (S.save.settings.vibrate && navigator.vibrate) {
      try { navigator.vibrate(ms); } catch (e) { /* 무시 */ }
    }
  }

  /* ---------------- 게임 이벤트 → 소리·효과·안내 ---------------- */
  const SOUND = {
    missile: 'missile', bossBoom: 'bossBoom', bossDie: 'bossDie', playerDie: 'playerDie', bomb: 'bomb',
    power: 'power', item: 'item', extend: 'extend', gem: 'gem', spark: 'spark', shieldBreak: 'shield',
    warning: 'warning', bossPhase: 'phase', stageClear: 'clear', partDestroyed: 'part', laserWarn: 'laserWarn',
    laserFire: 'laserFire', enemyMissile: 'enemyMissile', missileDown: 'missileDown',
  };
  function onEvent(type, d) {
    SH.fx.onEvent(type, d);
    if (SOUND[type]) SH.audio.sfx(SOUND[type]);
    switch (type) {
      case 'shoot': SH.audio.sfx('shoot_' + d.weapon); break;
      case 'hit': SH.audio.sfx(d.armor ? 'armor' : 'hit'); break;
      case 'stageStart': SH.render.reset(); SH.audio.music('stage1'); break;
      case 'warning': SH.audio.music('none'); break;
      case 'bossAppear': SH.audio.music('boss'); break;
      case 'bossReady': SH.render.showNotice('포탑을 부숴라!', '코어는 방어막으로 덮여 있다', '#ffd84a', 2.4); break;
      case 'bossPhase':
        SH.render.showNotice(d.name, d.berserk ? '모든 공격이 빨라진다!' : '파워 아이템을 챙기자!', d.berserk ? '#ff5a5a' : '#ffd84a', 2.4);
        vibrate(80);
        break;
      case 'partDestroyed': vibrate(120); break;
      case 'stageClear': SH.audio.music('none'); record(true, true); break;
      case 'playerDie': vibrate(220); break;
      case 'bomb': vibrate(60); break;
      case 'bossDie': vibrate(400); break;
      case 'extend': if (d.score && S.game && S.game.phase !== 'clear') SH.render.showNotice('1UP!', '점수 보너스 - 비행기 +1', '#ff7aa8', 1.8); break;
      case 'gameOver':
        SH.audio.sfx('gameOver');
        SH.audio.music('none');
        setTimeout(() => {
          if (!S.game || S.game.over !== 'gameover') return;
          SH.input.releaseAll();
          SH.ui.showOver();
        }, 900);
        break;
      case 'win':
        SH.audio.music('ending');
        S.save.cleared += 1;
        SH.ui.showEnding(record(true));
        break;
      default:
    }
  }

  /** 보스를 얼마나 부쉈는지 (%) */
  function progress(g) {
    if (!g) return 0;
    if (g.phase === 'clear' || g.over === 'win') return 100;
    const e = g.boss;
    if (!e) return 0;
    let total = e.maxHp, dealt = e.maxHp - e.hp;
    for (const p of Object.values(e.parts)) { total += p.maxHp; dealt += p.maxHp - Math.max(0, p.hp); }
    return Math.min(99, Math.floor((dealt / total) * 100));
  }

  /** 점수 기록 (순위표·최고 점수). 결과 요약을 돌려줌 */
  let recorded = null;
  function record(cleared, peek) {
    const g = S.game;
    if (!g) return { score: 0, rank: -1 };
    if (recorded && recorded.game === g && recorded.score === g.score) return recorded.result;
    const isNew = g.score > S.save.best;
    if (isNew) S.save.best = g.score;
    const pct = progress(g);
    let rank = -1;
    if (!peek && g.score > 0) rank = SH.save.addRank(S.save, { score: g.score, stage: 0, pct, cleared: !!cleared });
    SH.save.store(S.save);
    const result = { score: g.score, rank, isNew: isNew && g.score > 0, cleared: !!cleared, pct, missiles: g.stats.missiles, kills: g.stats.missiles };
    if (!peek) recorded = { game: g, score: g.score, result };
    return result;
  }

  /* ---------------- 진행 ---------------- */
  const act = {
    start() {
      SH.audio.unlock();
      SH.fx.clear();
      SH.render.reset();
      recorded = null;
      S.game = new SH.Game({ emit: onEvent });
      S.acc = 0;
      SH.input.releaseAll();
      SH.ui.go(null);
    },
    pause() {
      if (SH.ui.screen !== null || !S.game || S.game.over) return;
      SH.input.releaseAll();
      SH.ui.go('pause');
    },
    resume() {
      if (!S.game) return;
      S.acc = 0;
      SH.ui.go(null);
    },
    toTitle() {
      if (S.game && !S.game.over) record(false);
      S.game = null;
      SH.fx.clear();
      SH.ui.go('title');
      SH.audio.music('title');
    },
    continueGame() {
      if (!S.game) return;
      S.game.continueGame();
      S.acc = 0;
      SH.ui.go(null);
      SH.audio.music('boss');
    },
    nextLoop() {
      if (!S.game) return;
      recorded = null;
      S.game.nextLoop();
      S.acc = 0;
      SH.ui.go(null);
    },
    record: (cleared) => record(cleared),
    bomb: () => SH.input.queueBomb(),
    settings: applySettings,
    game: () => S.game,
    drawGameFrozen() { if (S.game) SH.render.drawGame(S.game, 0, { best: S.save.best, frozen: true }); },
  };

  /* ---------------- 입력 나눠 주기 ---------------- */
  const playing = () => SH.ui.screen === null && S.game && !S.game.over;
  function onDown(e) {
    SH.audio.unlock();
    const p = toPx(e);
    const touch = e.pointerType === 'touch';
    if (touch) SH.ui.touch = true;
    e.preventDefault();
    if (playing()) {
      if (SH.ui.playHit(p.x, p.y)) return;
      SH.input.dragDown(e);
    } else SH.ui.pointerDown(p.x, p.y, touch);
  }
  function onMove(e) {
    if (SH.input.dragMove(e)) e.preventDefault();
  }
  function onUp(e) {
    SH.input.dragUp(e);
    if (!playing()) {
      const p = toPx(e);
      SH.ui.pointerUp(p.x, p.y);
    }
  }
  function onKey(e) {
    SH.audio.unlock();
    if (SH.input.isGameKey(e.code) || e.code === 'Enter') e.preventDefault();
    if (playing()) {
      if (SH.input.keyDown(e) === 'pause') act.pause();
    } else if (!e.repeat) SH.ui.key(e.code);
  }

  /* ---------------- 루프 ---------------- */
  function tick(now) {
    requestAnimationFrame(tick);
    let dt = (now - S.last) / 1000;
    S.last = now;
    if (!(dt > 0)) dt = 0;
    if (dt > 0.1) dt = 0.1;
    const g = S.game;
    if (playing()) {
      S.acc += dt;
      let steps = 0;
      while (S.acc >= DT && steps < 6) {
        SH.input.apply(g);
        g.update(DT);
        SH.fx.update(DT);
        S.acc -= DT;
        steps++;
        if (g.over) break;
      }
      if (steps === 6) S.acc = 0;
      SH.render.drawGame(g, dt, { best: S.save.best });
      SH.ui.drawPlayButtons(g, dt);
    } else if (g && SH.ui.screen === null) {
      // 게임 오버 직후 메뉴가 뜨기 전 잠깐
      SH.fx.update(dt);
      SH.render.drawGame(g, 0, { best: S.save.best });
    } else {
      if (g && (SH.ui.screen === 'over' || SH.ui.screen === 'results')) SH.fx.update(dt);
      SH.ui.draw(dt);
    }
    SH.render.present();
  }

  /* ---------------- 시작 ---------------- */
  function boot() {
    S.save = SH.save.load();
    SH.render.init($('cv'));
    SH.input.setScale(() => S.scale);
    layout();
    window.addEventListener('resize', layout);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', layout);
    window.addEventListener('orientationchange', () => setTimeout(layout, 200));

    const app = $('app');
    app.addEventListener('pointerdown', onDown, { passive: false });
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', (e) => SH.input.dragUp(e));
    app.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', (e) => SH.input.keyUp(e));
    window.addEventListener('blur', () => { SH.input.releaseAll(); act.pause(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) act.pause(); });

    SH.ui.init(act, S.save);
    applySettings();
    SH.audio.music('title');
    SH.pix.preload();
    S.last = performance.now();
    requestAnimationFrame(tick);

    if (/[?&]debug\b/.test(location.search)) {
      SH.debug = {
        start: () => act.start(),
        god: () => { if (S.game) S.game.god = !S.game.god; return S.game && S.game.god; },
        power: (n, w) => { if (S.game) { S.game.power = n || 5; if (w) S.game.weapon = w; } },
        skip: (sec) => { const g = S.game; if (!g) return; for (let i = 0; i < sec * 60; i++) { g.update(DT); SH.fx.update(DT); } },
        phase: (n) => { const g = S.game; if (!g || !g.boss) return; while (g.boss && g.boss.phase < n) { if (g.boss.phase === 0) for (const p of Object.values(g.boss.parts)) { p.hp = 1; g._damagePart(p, 5); } else { g.boss.inv = 0; g._damageCore(g.boss.maxHp * 0.34); } } },
        state: () => S,
      };
      console.log('[하늘 사냥꾼] 디버그: SH.debug.start() · god() · power(5,"laser") · skip(초) · phase(0~3)');
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
