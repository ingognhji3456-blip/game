'use strict';

/* =========================================================
 * ASTRA : ZERO PROTOCOL — 부팅, 게임 루프, 화면 흐름
 * ========================================================= */
window.AZ = window.AZ || {};

AZ.game = (() => {
  const U = AZ.util;
  const VW = 1280;
  const VH = 720;
  let stage = null;
  let canvas = null;
  let g = null;
  let scale = 1;
  let backing = 1;
  let last = 0;
  let time = 0;
  let audioReady = false;

  const game = {
    save: null,
    settings: null,
    W: null,
    paused: false,
    flow: null,
    music: 'none',
  };

  /* ───────── 화면 맞춤 ───────── */
  function safeInsets() {
    const probe = document.getElementById('safe-probe');
    if (!probe) return { l: 0, r: 0, t: 0, b: 0 };
    const cs = getComputedStyle(probe);
    return {
      l: parseFloat(cs.paddingLeft) || 0, r: parseFloat(cs.paddingRight) || 0,
      t: parseFloat(cs.paddingTop) || 0, b: parseFloat(cs.paddingBottom) || 0,
    };
  }
  function resize() {
    const ins = safeInsets();
    const vw = window.innerWidth - ins.l - ins.r;
    const vh = window.innerHeight - ins.t - ins.b;
    scale = Math.max(0.1, Math.min(vw / VW, vh / VH));
    const x = ins.l + (vw - VW * scale) / 2;
    const y = ins.t + (vh - VH * scale) / 2;
    stage.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
    const dpr = window.devicePixelRatio || 1;
    backing = Math.min(2, Math.max(0.75, scale * dpr));
    canvas.width = Math.round(VW * backing);
    canvas.height = Math.round(VH * backing);
    if (AZ.gfx.render) AZ.gfx.render.resetCaches();
    document.body.classList.toggle('portrait', window.innerHeight > window.innerWidth * 1.1);
  }
  function toLogical(cx, cy) {
    const r = stage.getBoundingClientRect();
    return { x: (cx - r.left) / scale, y: (cy - r.top) / scale };
  }

  /* ───────── 설정/저장 ───────── */
  function applySettings() {
    const s = game.settings;
    if (AZ.audio) {
      AZ.audio.setVolumes({ master: s.master, music: s.music, sfx: s.sfx });
      AZ.audio.setMuted(!!s.muted);
    }
    AZ.gfx.fx.setSettings({ shake: s.shake, flashes: s.flashes, damageNumbers: s.damageNumbers });
    if (s.touch === 'on') setTouch(true);
    else if (s.touch === 'off') setTouch(false);
    if (game.W) {
      game.W.autoAim = s.autoAim;
      game.W.settingsDamageNumbers = s.damageNumbers;
    }
    AZ.save.storeSettings(s);
  }
  function setTouch(v) {
    AZ.input.setTouch(v);
    AZ.gfx.render.setTouchMode(v);
    document.body.classList.toggle('touch', v);
  }
  function persist() {
    if (game.save) AZ.save.store(game.save);
  }

  function setMusic(id) {
    game.music = id;
    if (audioReady && AZ.audio) AZ.audio.music(id);
  }
  function unlockAudio() {
    if (audioReady || !AZ.audio) return;
    try {
      AZ.audio.init();
      audioReady = true;
      applySettings();
      AZ.audio.music(game.music);
    } catch (e) { /* 소리 없이 계속 */ }
  }

  /* ───────── 기본 흐름 ───────── */
  function toTitle() {
    endBattle();
    game.flow = null;
    AZ.ui.screens.hideOverlay();
    AZ.ui.screens.title();
    setMusic('title');
  }
  function toHub() {
    endBattle();
    if (game.flow && game.flow.abort) game.flow.abort();
    game.flow = null;
    AZ.ui.screens.hideOverlay();
    if (!game.save) return toTitle();
    persist();
    AZ.ui.screens.hub();
    setMusic('hub');
  }
  function continueGame() {
    game.save = AZ.save.load();
    if (!game.save) return toTitle();
    toHub();
  }
  function newGame(diff) {
    game.save = AZ.save.fresh(diff);
    persist();
    startChapter(1, false);
  }

  /* ───────── 전투 ───────── */
  function inBattle() { return !!game.W && !game.paused; }

  function runBattle(cfg) {
    return new Promise((resolve) => {
      const s = game.save;
      const stats = AZ.progress.computeStats(s);
      const party = AZ.progress.partyFor(s, cfg.chapterId);
      const W = AZ.battle.create(Object.assign({ difficulty: s.difficulty, stats, party }, cfg));
      W.autoAim = game.settings.autoAim;
      W.settingsDamageNumbers = game.settings.damageNumbers;
      W._resolve = resolve;
      AZ.gfx.fx.reset();
      AZ.input.clear();
      AZ.ui.screens.hide();
      game.W = W;
      game.paused = false;
      document.body.classList.add('in-battle');
    });
  }
  function finishBattle(outcome) {
    const W = game.W;
    if (!W || W._finished) return;
    W._finished = true;
    const res = W.result || Object.assign({}, W.stats, { outcome, maxHp: W.player.maxHp });
    res.outcome = outcome;
    game.W = null;
    game.paused = false;
    document.body.classList.remove('in-battle');
    AZ.ui.screens.hideOverlay();
    if (W._resolve) W._resolve(res);
  }
  function endBattle() {
    if (game.W) {
      game.W._resolve = null;
      game.W = null;
    }
    game.paused = false;
    document.body.classList.remove('in-battle');
  }
  function pauseBattle() {
    if (!game.W || game.paused || game.W.state !== 'fight' && game.W.state !== 'intro') return;
    game.paused = true;
    AZ.ui.screens.pause({ title: battleTitle() });
    if (AZ.audio) AZ.audio.duck(0.6, 0.3);
  }
  function resume() {
    if (!game.W) return;
    game.paused = false;
    AZ.input.clear();
    AZ.ui.screens.hideOverlay();
  }
  function battleTitle() {
    const W = game.W;
    if (!W) return '';
    return `${W.ch.id}장 ${W.ch.name} — ${W.mode === 'boss' ? AZ.data.bosses[W.cfg.bossId].name : '작전 구역'}`;
  }
  function retryFromPause() { finishBattle('retry'); }
  function quitBattle() {
    AZ.ui.screens.confirm('작전을 포기하고 작전 터미널로 돌아갈까요? (이번 전투의 보상은 없습니다)', () => finishBattle('quit'), '포기');
  }

  /* 실패 화면 → 'retry' | 'hub' */
  function askDefeat(title) {
    return new Promise((resolve) => {
      game.flow.defeatResolve = resolve;
      AZ.ui.screens.defeat({ title });
      setMusic('memory');
    });
  }
  function retry() { if (game.flow && game.flow.defeatResolve) { const r = game.flow.defeatResolve; game.flow.defeatResolve = null; r('retry'); } }
  function resultsNext() { if (game.flow && game.flow.resultsResolve) { const r = game.flow.resultsResolve; game.flow.resultsResolve = null; r(); } }

  function talk(lines, theme, music) {
    if (!lines || !lines.length) return Promise.resolve();
    setMusic(music || 'memory');
    AZ.ui.screens.hide();
    return AZ.ui.dialogue.play(lines, {
      flags: game.save.flags,
      bg: theme,
      onFlag: () => persist(),
    });
  }

  /** 반복 전투 (실패 시 다시) → 결과 or null(포기) */
  async function battleLoop(cfg, title, flowToken) {
    for (;;) {
      if (cfg.mode === 'boss') {
        markSeen(cfg.bossId);
        await AZ.ui.screens.card('boss', { bossId: cfg.bossId });
        if (game.flow !== flowToken) return null;
        setMusic(AZ.data.bosses[cfg.bossId].music);
      } else {
        setMusic(AZ.data.chapters[cfg.chapterId - 1].music);
      }
      const res = await runBattle(cfg);
      if (game.flow !== flowToken) return null;
      if (res.outcome === 'victory') return res;
      if (res.outcome === 'quit') return null;
      if (res.outcome === 'retry') continue;
      const choice = await askDefeat(title);
      if (game.flow !== flowToken) return null;
      if (choice !== 'retry') return null;
    }
  }

  function markSeen(bossId) {
    const s = game.save;
    const cx = s.codex[bossId] || (s.codex[bossId] = { seen: false, defeated: false, clears: 0, best: null });
    cx.seen = true;
    persist();
  }

  function chapterMemories(chId) {
    return ((AZ.data.story || {}).memories || []).filter((m) => m.chapter === chId);
  }

  /** 챕터 진행 */
  async function startChapter(chId, bossOnly) {
    const s = game.save;
    const D = AZ.data;
    const ch = D.chapters[chId - 1];
    const story = (D.story && D.story.chapters && D.story.chapters[chId]) || {};
    const token = { chId, bossOnly };
    game.flow = token;
    AZ.ui.screens.hide();
    AZ.ui.screens.hideOverlay();
    const mems = chapterMemories(chId);
    const gained = { exp: 0, credits: 0, memories: [], time: 0, levelBefore: s.level };
    const dlgMusic = [6, 7, 10].includes(chId) ? 'memory' : 'hub';

    if (!bossOnly) {
      setMusic(dlgMusic);
      await AZ.ui.screens.card('chapter', { id: chId, name: ch.name, summary: (D.story && D.story.chapterSummaries || {})[chId] });
      if (game.flow !== token) return;
      await talk(story.intro, ch.theme, dlgMusic);
      if (game.flow !== token) return;
      const wave = await battleLoop({ chapterId: chId, mode: 'wave', tutorial: chId === 1 }, `${chId}장 작전 구역`, token);
      if (!wave) return toHub();
      gained.exp += wave.exp;
      gained.credits += wave.credits;
      gained.time += wave.time;
      if (mems[0] && AZ.progress.addMemory(s, mems[0].id)) {
        gained.memories.push(mems[0].title);
        AZ.ui.screens.toast(`기억 파편 회수 — 「${mems[0].title}」`, 'mem');
      }
      AZ.progress.addExp(s, wave.exp);
      s.credits += Math.round(wave.credits);
      persist();
      await talk(story.preBoss, ch.theme, dlgMusic);
      if (game.flow !== token) return;
    }

    const res = await battleLoop({ chapterId: chId, mode: 'boss', bossId: ch.boss }, `${chId}장 보스전`, token);
    if (!res) return toHub();
    gained.time += res.time;
    await afterBoss(chId, res, gained, bossOnly, token);
  }

  async function afterBoss(chId, res, gained, bossOnly, token) {
    const s = game.save;
    const D = AZ.data;
    const P = AZ.progress;
    const ch = D.chapters[chId - 1];
    const story = (D.story && D.story.chapters && D.story.chapters[chId]) || {};
    const firstClear = !s.cleared[chId];
    const rec = P.recordBoss(s, ch.boss, chId, res);
    res.score = rec.score;
    const exp = P.bossExp(chId) * (firstClear ? 1 : 0.6) + res.exp;
    const credits = P.bossCredits(chId) * (firstClear ? 1 : 0.6) + res.credits;
    const lvBefore = s.level;
    P.addExp(s, exp);
    s.credits += Math.round(credits);
    const challenge = P.checkChallenge(ch, Object.assign({}, res, { score: rec.score }));
    const mems = chapterMemories(chId);
    const memList = gained.memories.slice();
    if (challenge && mems[1] && P.addMemory(s, mems[1].id)) memList.push(mems[1].title);
    let rewards = [];
    if (!bossOnly) {
      rewards = P.grantChapterRewards(s, chId);
      if (!s.chapterBest[chId] || gained.time < s.chapterBest[chId]) s.chapterBest[chId] = Math.round(gained.time * 100) / 100;
    }
    persist();

    if (!bossOnly) {
      await talk(story.outro, ch.theme, [6, 7, 10].includes(chId) ? 'memory' : 'hub');
      if (game.flow !== token) return;
      persist();
    }

    // 결과 화면
    setMusic('hub');
    await new Promise((resolve) => {
      game.flow.resultsResolve = resolve;
      AZ.ui.screens.results({
        boss: true, title: `${chId}장 ${ch.name} — ${D.bosses[ch.boss].name}`, rank: rec.rank, newBest: rec.newBest, place: rec.place,
        time: res.time, par: P.parTime(chId), damageTaken: res.damageTaken, hitsTaken: res.hitsTaken, zeroFrames: res.zeroFrames,
        breaks: res.breaks, maxCombo: res.maxCombo, weakHits: res.weakHits,
        exp: exp + gained.exp, credits: credits + gained.credits, levelUp: s.level - (gained.levelBefore || lvBefore), level: s.level,
        challenge, challengeDesc: ch.challenge.desc, rewards, memories: memList,
      });
      if (AZ.audio) AZ.audio.sfx('victory');
    });
    if (game.flow !== token) return;

    if (chId === 10 && !bossOnly) return ending(token);
    if (token.returnTo === 'codex') {
      game.flow = null;
      AZ.ui.screens.codex();
      setMusic('hub');
      return;
    }
    toHub();
  }

  /** 보스 도감에서 재도전 */
  async function startBossReplay(bossId) {
    const b = AZ.data.bosses[bossId];
    const token = { chId: b.chapter, bossOnly: true, returnTo: 'codex' };
    game.flow = token;
    const res = await battleLoop({ chapterId: b.chapter, mode: 'boss', bossId }, `보스 재도전 — ${b.name}`, token);
    if (!res) { if (game.flow === token) { game.flow = null; AZ.ui.screens.codex(); setMusic('hub'); } return; }
    await afterBoss(b.chapter, res, { exp: 0, credits: 0, memories: [], time: res.time }, true, token);
  }

  /** 최종 선택 → 엔딩 */
  async function ending(token) {
    const s = game.save;
    const story = AZ.data.story || {};
    const fc = story.finalChoice;
    if (!fc) return toHub();
    const opts = fc.options.filter((o) => !o.require || o.require.every((f) => s.flags[f] === true));
    const temp = Object.assign({}, s.flags);
    setMusic('final');
    await AZ.ui.dialogue.play(fc.prompt.concat([{ choice: '__ending', options: opts.map((o) => ({ text: o.text, value: o.ending })) }]), {
      flags: temp, bg: 'void',
    });
    if (game.flow !== token) return;
    const id = temp.__ending || 'stars';
    const e = (story.endings || {})[id];
    setMusic('ending');
    if (e) await AZ.ui.dialogue.play(e.lines, { flags: s.flags, bg: id === 'dawn' ? 'dawn' : 'void' });
    if (game.flow !== token) return;
    const isNew = !s.endings.includes(id);
    if (isNew) s.endings.push(id);
    if (s.firstClearTime == null) s.firstClearTime = s.playTime;
    persist();
    game.flow = null;
    AZ.ui.screens.credits(id, isNew);
    setMusic('ending');
  }

  /* ───────── 키 ───────── */
  function onKey(a, e) {
    unlockAudio();
    if (AZ.ui.dialogue.active) {
      if (a === 'skill0' || a === 'skill1' || a === 'skill2') { AZ.ui.dialogue.onDigit(Number(a.slice(-1)) + 1); return; }
      if (a === 'ult') { AZ.ui.dialogue.onDigit(4); return; }
      if (AZ.ui.dialogue.onKey(a)) { if (e) e.preventDefault(); }
      return;
    }
    if (game.W) {
      if (a === 'pause') {
        if (game.paused) resume(); else pauseBattle();
      }
      return;
    }
    if (a === 'pause' || a === 'back') {
      const cur = AZ.ui.screens.current;
      if (cur && cur !== 'hub' && cur !== 'title' && cur !== 'results' && cur !== 'defeat' && game.save) AZ.ui.screens.hub();
    }
  }

  /* ───────── 루프 ───────── */
  function drawMenuBackground(dt) {
    g.setTransform(backing, 0, 0, backing, 0, 0);
    const sky = AZ.gfx.render.getSky('void');
    if (sky) {
      const off = (time * 6) % (sky.width - VW);
      g.drawImage(sky, -off * 0.3 - 100, 0);
    } else {
      g.fillStyle = '#05060f';
      g.fillRect(0, 0, VW, VH);
    }
  }

  function tutorialOverlay(W) {
    if (!W.cfg.tutorial || W.stats.time > 30 || AZ.input.touchMode) return;
    const lines = ['이동  W A S D', '공격  J (누르고 있으면 연속)', '강공격  K', '회피  Space — 공격 직전에 피하면 ZERO FRAME', '스킬  U · 궁극기  L · 전술 명령  Z X C'];
    g.save();
    g.globalAlpha = Math.min(1, (30 - W.stats.time) / 3);
    g.fillStyle = 'rgba(4,10,26,0.7)';
    AZ.gfx.fx.roundRect(g, VW / 2 - 230, VH - 196, 460, 132, 12);
    g.fill();
    g.font = '700 15px "Pretendard","Noto Sans KR",sans-serif';
    g.textAlign = 'center';
    g.fillStyle = '#cfe6ff';
    lines.forEach((l, i) => g.fillText(l, VW / 2, VH - 170 + i * 24));
    g.restore();
  }

  function frame(now) {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000 || 0));
    last = now;
    time += dt;
    try {
      const W = game.W;
      if (W) {
        if (!game.paused) {
          const inp = AZ.input.frame();
          AZ.battle.step(W, dt, inp);
          AZ.gfx.fx.consume(W);
          AZ.gfx.fx.update(dt);
          g.setTransform(backing, 0, 0, backing, 0, 0);
          AZ.gfx.render.drawBattle(g, W, time, dt, inp);
          tutorialOverlay(W);
          if (W.state === 'victory' || W.state === 'defeat') finishBattle(W.state);
        }
      } else if (!AZ.ui.dialogue.active) {
        drawMenuBackground(dt);
      }
      AZ.ui.dialogue.update(dt);
      if (game.save && !game.paused) game.save.playTime += dt;
    } catch (err) {
      console.error(err);
    }
    requestAnimationFrame(frame);
  }

  /* ───────── 부팅 ───────── */
  function boot() {
    stage = document.getElementById('stage');
    canvas = document.getElementById('game');
    g = canvas.getContext('2d');
    game.settings = AZ.save.loadSettings();
    AZ.ui.screens.init(stage);
    AZ.input.init({
      canvas, toLogical,
      onTouchModeChange: (v) => {
        if (game.settings.touch === 'auto') { AZ.gfx.render.setTouchMode(v); document.body.classList.toggle('touch', v); }
      },
    });
    if (game.settings.touch === 'on') setTouch(true);
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock);
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', () => setTimeout(resize, 200));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { pauseBattle(); persist(); }
    });
    window.addEventListener('beforeunload', persist);
    setInterval(persist, 30000);
    resize();
    applySettings();
    game.save = AZ.save.load();
    // 디버그: ?debug
    if (/[?&]debug/.test(location.search)) installDebug();
    toTitle();
    requestAnimationFrame((t) => { last = t; frame(t); });
  }

  function installDebug() {
    AZ.debug = {
      win: () => { if (game.W) { for (const e of game.W.enemies) if (!e.dead) AZ.battle.killEnemy(game.W, e); if (game.W.mode === 'wave') { game.W.waveIdx = game.W.waves.length - 1; } } },
      boss: (id) => startBossReplay(id),
      level: (n) => { game.save.level = n; game.save.sp += n; persist(); },
      credits: (n) => { game.save.credits += n; persist(); },
      unlockAll: () => { const s = game.save; s.unlockedChapter = 10; for (let i = 1; i <= 10; i++) s.cleared[i] = true; for (const w of AZ.data.weaponOrder) s.weapons[w] = s.weapons[w] || 1; s.modules = Object.keys(AZ.data.modules); persist(); },
      focus: () => { if (game.W) game.W.player.focus = 100; },
      hp: (f) => { if (game.W) game.W.boss.hp = game.W.boss.maxHp * f; },
      W: () => game.W,
    };
  }

  Object.assign(game, {
    boot, persist, applySettings, toTitle, toHub, continueGame, newGame, startChapter, startBossReplay,
    resultsNext, retry, resume, retryFromPause, quitBattle, battleTitle, inBattle, onKey,
  });
  return game;
})();

window.addEventListener('DOMContentLoaded', () => AZ.game.boot());
