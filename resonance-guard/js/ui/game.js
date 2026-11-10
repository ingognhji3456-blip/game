'use strict';

/* =========================================================
 * 전투 화면 — 입력, 양옆 정보 띠, 탑 목록(고르고 놓기), 정보 창, 영웅, 루프
 * 설계: DESIGN.md §13
 * ========================================================= */
(() => {
  const { el, escapeHtml: esc, round } = RG.util;
  const UI = RG.ui;
  const D = () => RG.data;

  let root = null;
  let game = null;
  let opts = null;
  let canvas = null;
  let raf = 0;
  let last = 0;
  let acc = 0;
  let speed = 1;
  let paused = false;
  let resultShown = false;
  let mode = 'idle';
  let sel = null;            // { kind:'tower'|'enemy', id }
  let pick = null;           // 놓기 모드: 고른 탑 { type, c, r, res } — c·r은 미리보기 칸(없으면 null)
  let drag = null;           // 탑 목록에서 끌기 { type, id, x0, y0, started, touch }
  let keyCursor = null;      // 방향키로 고른 칸 { c, r }
  let stageObs = null;       // 전장 크기가 바뀌면 캔버스 다시 맞추기
  let skillAim = null;
  let hudT = 0;
  let beamT = 0;
  let saveT = 0;
  let bossTrackOn = false;
  let tipsQueue = [];
  const R = {};              // DOM 참조
  // 안내는 게임을 켠 동안 한 번씩만
  let buildHintShown = false; // 빈 건설지를 눌렀을 때 "탑 목록에서 고르세요"
  let keyHintShown = false;   // 키보드로 빈 건설지를 골랐을 때
  let placeHintShown = false; // 손가락으로 탑을 골랐을 때 "놓을 칸을 누르세요"

  const DT = () => RG.sim.DT;

  /* =====================================================
   * 화면 시작
   * ===================================================== */
  function enter(sec, data) {
    root = sec;
    resultShown = false;
    paused = false;
    acc = 0;
    mode = 'idle';
    sel = null; pick = null; drag = null; skillAim = null; bossTrackOn = false; keyCursor = null;
    speed = UI.getSettings().speed || 1;
    if (data.resume) {
      opts = data.resume.opts;
      game = RG.sim.replay(opts, data.resume.log, data.resume.tick);
    } else {
      opts = data.opts;
      game = RG.sim.create(opts);
    }
    RG.fx.clear();
    buildDom();
    fitDock();
    RG.render.attach(canvas, game);
    // 탑 목록이 접히거나 글자 크기가 바뀌어 전장 크기가 달라져도 맵이 잘리지 않게
    if (window.ResizeObserver) { stageObs = new ResizeObserver(() => { RG.render.resize(); placeLabel(); }); stageObs.observe(R.stage); }
    Object.assign(RG.render.overlay, { hover: null, selectedTower: null, ghost: null, selectedEnemy: null, heroSelected: false, skill: null, rally: null });
    root.classList.add('loading');
    RG.art.sprites.prepareForGame(game).then(() => { root.classList.remove('loading'); });
    const region = D().regions.find((r) => r.id === game.def.region);
    UI.music(region ? region.music : 'meadow');
    window.addEventListener('resize', onResize);
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onOutsideDown, true);
    last = performance.now();
    raf = requestAnimationFrame(loop);
    updateHud(true);
    // 튜토리얼 팁
    // 특정 탑을 설명하는 팁은 그 탑을 가지고 있을 때만 (탑은 뽑기로 얻으므로) — 안 보인 팁은 '본 것'으로 치지 않아 나중에 다시 나옴
    const have = new Set(game.opts.towers || D().towerOrder);
    tipsQueue = (game.def.tips || []).filter((t) => !RG.progress.seen('tips', t) && TIPS[t] && (!TIP_TOWER[t] || have.has(TIP_TOWER[t])));
    if (!data.resume && opts.mode === 'normal') setTimeout(nextTip, 600);
    if (!data.resume) banner(`${game.def.id} ${game.def.name}`, opts.mode === 'challenge' ? `도전: ${game.def.challenge.text}` : opts.mode === 'endless' ? '무한 모드' : '준비가 되면 웨이브를 호출하세요');
  }

  function leave() {
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', onResize);
    document.removeEventListener('keydown', onKey);
    document.removeEventListener('pointerdown', onOutsideDown, true);
    if (stageObs) { stageObs.disconnect(); stageObs = null; }
    document.body.classList.remove('rg-dragging');
    pick = null; drag = null;
    if (game && !game.state.result) saveRun();
    RG.render.detach();
    game = null;
  }

  function onResize() { fitDock(); RG.render.resize(); placeLabel(); }

  /* =====================================================
   * DOM
   * ===================================================== */
  function buildDom() {
    root.innerHTML = '';
    const left = el('aside', { class: 'rail rail-left' });
    R.lives = el('div', { class: 'stat stat-lives', title: '등불 불꽃' }, [UI.icon('lives'), el('b', { text: '0' }), el('small', { text: '' })]);
    R.gold = el('div', { class: 'stat stat-gold', title: '골드' }, [UI.icon('gold'), el('b', { text: '0' })]);
    R.wave = el('div', { class: 'stat stat-wave', title: '웨이브' }, [UI.icon('wave'), el('b', { text: '0/0' })]);
    R.next = el('div', { class: 'next-wave' });
    R.call = el('button', { class: 'btn btn-call', onclick: () => doCmd({ type: 'callWave' }) }, [el('span', { class: 'call-label', text: '웨이브 호출' }), el('small', { class: 'call-sub', text: '' })]);
    R.speed = el('button', { class: 'icon-btn', title: '배속 (F)', onclick: cycleSpeed }, [UI.icon('fast'), el('span', { class: 'speed-label', text: '1×' })]);
    R.pause = el('button', { class: 'icon-btn', title: '일시정지 (P)', onclick: openPause }, [UI.icon('pause')]);
    R.task = el('div', { class: 'task-box' });
    left.append(R.lives, R.gold, R.wave, R.next, R.call, el('div', { class: 'rail-row' }, [R.speed, R.pause]), R.task);

    const stage = el('div', { class: 'stage' });
    canvas = el('canvas', { class: 'game-canvas', 'aria-label': '전장' });
    R.stage = stage;
    R.boss = el('div', { class: 'boss-bar hidden' }, [el('span', { class: 'boss-name' }), el('div', { class: 'boss-hp' }, [el('i')])]);
    R.banner = el('div', { class: 'banner' });
    R.bossIntro = el('div', { class: 'boss-intro' });
    R.loading = el('div', { class: 'stage-loading', text: '그림 준비 중…' });
    stage.append(canvas, R.boss, R.banner, R.bossIntro, R.loading);

    const right = el('aside', { class: 'rail rail-right' });
    R.heroCard = el('div', { class: 'hero-card' });
    R.skill = el('button', { class: 'skill-btn', title: '영웅 기술 (Q)', onclick: () => startSkill() });
    R.info = el('div', { class: 'info-panel hidden' });
    right.append(R.heroCard, R.skill, R.info);

    // 탑 목록: 데스크톱은 맵 아래, 좁은 화면은 오른쪽 띠 아래 (css/game.css 격자)
    R.dock = buildDock();
    // 놓기 미리보기 이름표 (손가락·마우스를 따라다님)
    R.label = el('div', { class: 'place-label hidden', 'aria-hidden': 'true' });

    root.append(el('div', { class: 'game-layout' }, [left, stage, right, R.dock]), R.label);
    buildHeroCard();
    bindCanvas();
  }

  function buildHeroCard() {
    const h = game.state.hero;
    R.heroCard.innerHTML = '';
    R.skill.innerHTML = '';
    if (!h) {
      R.heroCard.classList.add('hidden');
      R.skill.classList.add('hidden');
      return;
    }
    const hd = D().heroes[h.heroId];
    R.heroPortrait = UI.portrait(h.heroId, 'normal', 'hero-portrait');
    R.heroMood = 'normal';
    R.heroLv = el('span', { class: 'hero-lv', text: 'Lv1' });
    R.heroHp = el('div', { class: 'bar bar-hp' }, [el('i')]);
    R.heroXp = el('div', { class: 'bar bar-xp' }, [el('i')]);
    const btn = el('button', { class: 'hero-btn', title: '영웅 선택 (H)', onclick: () => selectHero() }, [R.heroPortrait]);
    R.heroCard.append(btn, el('div', { class: 'hero-meta' }, [el('b', { text: hd.name }), R.heroLv, R.heroHp, R.heroXp]));
    R.skillCd = el('i', { class: 'skill-cd' });
    R.skill.append(UI.icon('skill'), el('span', { class: 'skill-name', text: hd.skill.name }), R.skillCd);
    UI.tooltipFor(R.skill, () => `<b>${esc(hd.skill.name)}</b><br>${esc(hd.skill.desc)}<br><span class="dim">패시브 · ${esc(hd.passive.name)}: ${esc(hd.passive.desc)}</span>`);
  }

  /* =====================================================
   * 루프
   * ===================================================== */
  function loop(ts) {
    raf = requestAnimationFrame(loop);
    if (!game) return;
    const dt = Math.min(0.1, Math.max(0, (ts - last) / 1000));
    last = ts;
    const st = game.state;
    const events = [];
    const running = !paused && !UI.modalOpen() && !st.result && !root.classList.contains('loading');
    if (running) {
      acc += dt * speed;
      let n = 0;
      while (acc >= DT() && n < 16) {
        game.step();
        if (st.events.length) events.push(...st.events);
        acc -= DT();
        n += 1;
      }
      if (n >= 16) acc = 0;
    }
    if (events.length) handleEvents(events);
    if (running && st.beams.length) { beamT -= dt; if (beamT <= 0) { UI.sfx('beam', { vol: 0.3 }); beamT = 0.2; } }
    RG.render.frame(running ? acc / DT() : 1, running ? dt : dt * 0.25);
    hudT -= dt;
    if (hudT <= 0) { updateHud(false); hudT = 0.1; }
    saveT += dt;
    if (saveT > 15 && running) { saveRun(); saveT = 0; }
    if (st.result && !resultShown) {
      resultShown = true;
      RG.save.remove(RG.save.KEYS.run);
      // 기록은 결과가 난 순간 바로 (연출 시간 안에 지도로 나가도 별·해금이 남게),
      // 결과 화면은 잠시 뒤 — 그 사이 다시 시작했으면 띄우지 않음
      const payload = finish();
      const which = game;
      setTimeout(() => { if (game === which && UI.currentId() === 'game' && payload) UI.show('result', payload); }, st.result === 'win' ? 1400 : 900);
    }
  }

  function handleEvents(events) {
    RG.fx.onEvents(events, game);
    if (RG.render.onEvents) RG.render.onEvents(events);
    for (const e of events) {
      switch (e.type) {
        case 'fire': UI.sfx(e.kind === 'bolt' && e.element === 'dark' ? 'hex' : FIRE_SFX[e.kind] || 'arrow', { vol: 0.5 }); break;
        case 'pulse': if (e.towerId) { const t = game.state.towers.find((q) => q.id === e.towerId); UI.sfx(t ? PULSE_SFX[t.type] || 'bell' : 'bell', { vol: 0.5 }); } break;
        case 'chain': if (!e.small) UI.sfx('chain', { vol: 0.5 }); break;
        case 'splash': if (e.element === 'fire' || e.big) UI.sfx('explosion', { vol: 0.55 }); break;
        case 'hit': if (!e.dot && !e.beam) UI.sfx(`hit_${e.element}`, { vol: 0.3 }); break;
        case 'kill': UI.sfx(e.boss ? 'killBig' : 'kill', { vol: 0.45 }); if (e.boss) onBossDown(); break;
        case 'leak': UI.sfx('leak'); flashLives(); if (!e.shielded && game.state.lives > 0 && game.state.lives <= 3) UI.toast(`등불 불꽃이 ${game.state.lives}개 남았습니다!`, 'warn'); break;
        case 'waveStart': UI.sfx('wave'); onWaveStart(e); break;
        case 'build': UI.sfx('build'); break;
        case 'upgrade': UI.sfx(e.branch ? 'branch' : 'upgrade'); break;
        case 'sell': UI.sfx('sell'); break;
        case 'heroSkill': UI.sfx('heroSkill'); heroLine('skill'); break;
        case 'heroAttack': UI.sfx('heroAttack', { vol: 0.35 }); break;
        case 'heroDown': UI.sfx('heroDown'); heroLine('down'); break;
        case 'heroRevive': UI.sfx('heroRevive'); heroLine('revive'); break;
        case 'heroLevel': UI.sfx('heroLevel'); break;
        case 'heroWin': heroLine('win'); break;
        case 'spawn': onSpawn(e); break;
        case 'bossPhase': UI.sfx('bossPhase'); banner('보스가 더 강해졌다!', bossPhaseText(e)); break;
        case 'bossAbility': if (/Warn$/.test(e.ability)) UI.sfx('bossWarn'); break;
        case 'towerDisabled': UI.sfx('towerDisabled', { vol: 0.5 }); break;
        case 'shieldBreak': UI.sfx('shieldBreak', { vol: 0.5 }); break;
        case 'gold': UI.sfx('gold', { vol: 0.5 }); break;
        case 'taskDone': UI.sfx('taskDone'); UI.toast(`공명 과제 달성! ${game.def.task.text}`, 'good', 2600); break;
        case 'trap': UI.sfx('trap', { vol: 0.4 }); break;
        case 'enemyShot': UI.sfx('enemyShot', { vol: 0.35 }); break;
        default: break;
      }
    }
    // 선택한 탑이 팔렸거나 상태가 바뀌면 정보 창 갱신
    if (sel && sel.kind === 'tower' && !game.state.towers.find((t) => t.id === sel.id)) closePanels();
    if (sel && sel.kind === 'enemy' && !game.state.enemies.find((t) => t.id === sel.id)) closePanels();
  }

  const FIRE_SFX = { arrow: 'arrow', bolt: 'bolt', gust: 'gust', mortar: 'mortar', orb: 'orb', ballista: 'ballista' };
  const PULSE_SFX = { winter_bell: 'bell', quake_hammer: 'slam', radiance_spire: 'flash' };

  function bossPhaseText(e) {
    if (e.immune) return `이제 ${e.immune.map((x) => D().elements[x].name).join('·')}에 면역입니다`;
    return '';
  }

  function onSpawn(e) {
    const ed = D().enemies[e.enemyType];
    if (ed.boss) {
      UI.sfx('bossAppear');
      bossIntro(e.enemyType);
      if (!bossTrackOn) { UI.music('boss'); bossTrackOn = true; }
    }
    if (!RG.progress.seen('enemies', e.enemyType)) {
      RG.progress.markSeen('enemies', e.enemyType);
      if (!ed.minion && !ed.boss) UI.toast(`새 적: ${ed.name} — ${ed.desc}`, 'info', 3200);
    }
  }
  let bossIntroTimer = 0;
  /** 보스 등장 카드: 큰 그림 + 이름 + 설명 (판은 멈추지 않음) */
  function bossIntro(type) {
    const ed = D().enemies[type];
    R.bossIntro.innerHTML = '';
    R.bossIntro.append(
      el('div', { class: 'bi-art' }, [UI.enemyImg(type, 'bi-img')]),
      el('div', { class: 'bi-text' }, [el('small', { text: '보스 등장' }), el('b', { text: ed.name }), el('span', { text: ed.desc })]),
    );
    R.bossIntro.classList.remove('show');
    R.banner.classList.remove('show'); // 웨이브 알림과 겹치지 않게
    void R.bossIntro.offsetWidth;
    R.bossIntro.classList.add('show');
    clearTimeout(bossIntroTimer);
    bossIntroTimer = setTimeout(() => R.bossIntro.classList.remove('show'), 3400);
  }
  function onBossDown() {
    const alive = game.state.enemies.some((q) => !q.dead && D().enemies[q.type].boss);
    if (!alive) {
      const ed = D().enemies[game.def.boss] || null;
      if (ed) { R.bossIntro.classList.remove('show'); banner(`👑 ${ed.name} 처치!`, '등불이 다시 환하게 빛납니다'); }
    }
    if (bossTrackOn && !alive) {
      bossTrackOn = false;
      const region = D().regions.find((r) => r.id === game.def.region);
      UI.music(region ? region.music : 'meadow');
    }
  }

  function onWaveStart(e) {
    const w = game.state.wave;
    banner(`웨이브 ${e.index}${isFinite(w.total) ? ` / ${w.total}` : ''}`, e.bonus ? `조기 호출 보너스 +${e.bonus}` : '');
    saveRun();
  }

  /* =====================================================
   * 정보 띠 갱신
   * ===================================================== */
  function updateHud(force) {
    if (!game) return;
    const st = game.state;
    R.lives.children[1].textContent = String(st.lives);
    R.lives.children[2].textContent = `/${st.maxLives}`;
    R.lives.classList.toggle('danger', st.lives <= 3);
    R.gold.children[1].textContent = String(Math.floor(st.gold));
    const w = st.wave;
    R.wave.children[1].textContent = isFinite(w.total) ? `${w.index}/${w.total}` : `${w.index}`;
    // 호출 버튼
    const canCall = !st.result && w.index < w.total && (w.index === 0 || w.countdown !== null);
    R.call.disabled = !canCall;
    const sub = R.call.querySelector('.call-sub');
    const label = R.call.querySelector('.call-label');
    if (w.index === 0) { label.textContent = '전투 시작'; sub.textContent = 'Space'; } else if (w.countdown !== null) {
      const cd = game.challenge && game.challenge.type === 'countdown' ? game.challenge.value : D().rules.countdown;
      const bonus = Math.ceil(Math.max(0, w.countdown) * ((8 + 2 * w.index) / cd) * (1 + ((game.meta && game.meta.earlyBonusPct) || 0)));
      label.textContent = '다음 웨이브';
      sub.textContent = `${Math.ceil(w.countdown)}초 · +${bonus}`;
    } else if (w.index >= w.total) { label.textContent = '마지막 웨이브'; sub.textContent = ''; } else { label.textContent = '적이 오는 중'; sub.textContent = ''; }
    R.call.classList.toggle('pulse', canCall && (w.index === 0 || (w.countdown !== null && w.countdown < 6)));
    // 다음 웨이브 미리보기
    if (force || R.nextFor !== w.index) {
      R.nextFor = w.index;
      R.next.innerHTML = '';
      if (w.index < w.total && game.opts.mode !== 'endless') {
        const wd = RG.grid.parseWaves([game.def.waves[w.index]])[0];
        const counts = new Map();
        for (const g of wd.groups) counts.set(g.e, (counts.get(g.e) || 0) + g.n);
        R.next.appendChild(el('span', { class: 'next-title', text: '다음' }));
        for (const [type, n] of counts) {
          const chip = el('span', { class: 'next-chip' }, [UI.enemyImg(type, 'mini'), el('b', { text: `×${n}` })]);
          UI.tooltipFor(chip, () => enemyTip(type));
          R.next.appendChild(chip);
        }
      }
    }
    // 과제
    if (st.task && game.opts.mode === 'normal') {
      const tk = st.task;
      R.task.classList.toggle('done', tk.done);
      R.task.innerHTML = `<span class="task-head">공명 과제${tk.done ? ' ✓' : ''}</span><span>${esc(tk.def.text)}</span>${!tk.done && tk.need ? `<span class="dim">최고 ${Math.floor(tk.best)}/${tk.need}</span>` : ''}`;
    } else if (game.challenge) {
      R.task.innerHTML = `<span class="task-head">도전</span><span>${esc(game.challenge.text)}</span>`;
    } else R.task.innerHTML = '';
    // 배속
    R.speed.querySelector('.speed-label').textContent = `${speed}×`;
    R.pause.classList.toggle('on', paused);
    // 영웅
    const h = st.hero;
    if (h) {
      R.heroLv.textContent = `Lv${h.level}`;
      R.heroHp.firstChild.style.width = `${h.dead ? 0 : (h.hp / h.maxHp) * 100}%`;
      const xpT = D().heroXp;
      const cur = xpT[h.level - 1] || 0;
      const nxt = xpT[h.level] || cur;
      R.heroXp.firstChild.style.width = `${h.level >= xpT.length ? 100 : ((h.xp - cur) / Math.max(1, nxt - cur)) * 100}%`;
      R.heroCard.classList.toggle('down', !!h.dead);
      R.heroCard.classList.toggle('selected', mode === 'hero');
      const mood = h.dead || h.hp / h.maxHp < 0.35 ? 'worried' : 'normal';
      if (mood !== R.heroMood) { R.heroMood = mood; R.heroPortrait.src = RG.art.sprites.dataUrl(RG.art.portrait(h.heroId, mood)); }
      const hd = D().heroes[h.heroId];
      const cdMax = hd.skill.cooldown;
      R.skill.disabled = !!h.dead;
      R.skill.classList.toggle('ready', h.skillCd <= 0 && !h.dead);
      R.skill.classList.toggle('aiming', mode === 'skill');
      R.skillCd.style.height = `${Math.min(100, (h.skillCd / cdMax) * 100)}%`;
      R.skillCd.textContent = h.dead ? `${Math.ceil(Math.max(0, h.downUntil - st.time))}` : (h.skillCd > 0 ? `${Math.ceil(h.skillCd)}` : '');
    }
    // 보스 막대
    const boss = st.enemies.find((e) => !e.dead && D().enemies[e.type].boss);
    if (boss) {
      R.boss.classList.remove('hidden');
      R.boss.querySelector('.boss-name').textContent = D().enemies[boss.type].name;
      R.boss.querySelector('.boss-hp i').style.width = `${(boss.hp / boss.maxHp) * 100}%`;
    } else R.boss.classList.add('hidden');
    // 열린 정보 창 갱신
    if (sel && sel.kind === 'tower') refreshTowerPanel();
    if (sel && sel.kind === 'enemy') refreshEnemyPanel();
    // 탑 목록(골드에 따라 살 수 있는지)과 놓기 미리보기(적이 움직이면 공터 판정이 바뀜)
    refreshDock();
    if (pick) refreshGhost();
  }

  function flashLives() {
    R.lives.classList.remove('flash');
    void R.lives.offsetWidth;
    R.lives.classList.add('flash');
  }

  let bannerTimer = 0;
  function banner(title, sub) {
    R.banner.innerHTML = `<b>${esc(title)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}`;
    R.banner.classList.remove('show');
    void R.banner.offsetWidth;
    R.banner.classList.add('show');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => R.banner.classList.remove('show'), 2400);
  }

  let lineTimer = 0;
  function heroLine(kind) {
    const h = game && game.state.hero;
    if (!h) return;
    const lines = D().heroes[h.heroId].lines[kind];
    if (!lines || !lines.length) return;
    const text = lines[Math.floor(Math.random() * lines.length)];
    let b = R.stage.querySelector('.hero-line');
    if (!b) { b = el('div', { class: 'hero-line' }); R.stage.appendChild(b); }
    b.textContent = `${D().heroes[h.heroId].name}: ${text}`;
    b.classList.add('show');
    clearTimeout(lineTimer);
    lineTimer = setTimeout(() => b.classList.remove('show'), 2200);
  }

  /* =====================================================
   * 명령
   * ===================================================== */
  function doCmd(c, quiet) {
    if (!game) return { ok: false };
    UI.hideTooltip();
    const res = game.cmd(c);
    if (!res.ok && !quiet) { UI.sfx('error'); UI.toast(res.reason, 'warn'); }
    if (res.ok && c.type === 'build') {
      const t = game.state.towers.find((q) => q.id === res.id);
      if (t && t.effects.length) {
        UI.sfx('resonance');
        const names = t.effects.map((k) => D().resonance[k].name).join(', ');
        UI.toast(`공명! ${names}`, 'good', 1600);
      }
    }
    updateHud(false);
    return res;
  }

  function cycleSpeed() {
    speed = speed >= 3 ? 1 : speed + 1;
    UI.setSettings({ speed });
    UI.sfx('click');
    updateHud(false);
  }

  /* =====================================================
   * 캔버스 입력
   * ===================================================== */
  function bindCanvas() {
    let downAt = null;
    canvas.addEventListener('pointermove', (e) => {
      if (!game) return;
      const p = toWorld(e);
      const c = Math.floor(p.x);
      const r = Math.floor(p.y);
      const inside = c >= 0 && r >= 0 && c < game.map.cols && r < game.map.rows;
      RG.render.overlay.hover = inside ? { c, r } : null;
      keyCursor = null;
      if (mode === 'skill') RG.render.overlay.skillPos = p;
      if (pick) {
        // 놓기 모드: 미리보기가 칸에 붙어 따라옴 (손가락으로 끌면 손가락 위쪽 칸)
        const lifted = e.pointerType === 'touch' && downAt && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 14;
        const q = lifted ? liftPoint(p) : p;
        setGhost(Math.floor(q.x), Math.floor(q.y), 'tile');
      }
      if (e.pointerType === 'mouse' && inside) hoverTip(p, e);
    });
    canvas.addEventListener('pointerleave', (e) => {
      RG.render.overlay.hover = null;
      UI.hideTooltip();
      if (pick && e.pointerType === 'mouse' && !keyCursor) setGhost(null);
    });
    canvas.addEventListener('pointerdown', (e) => { downAt = { x: e.clientX, y: e.clientY, t: performance.now() }; });
    canvas.addEventListener('pointerup', (e) => {
      if (!game || !downAt) return;
      const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
      const longPress = performance.now() - downAt.t > 450;
      downAt = null;
      UI.init && UI.init();
      try { if (RG.audio) RG.audio.init(); } catch (er) { /* 무시 */ }
      if (pick && e.button <= 0) {
        // 놓기 모드에서는 맵 위에서 끌다가 떼도 그 칸에 짓기 (손가락은 미리보기가 보이던 위쪽 칸)
        const q = moved > 14 && e.pointerType === 'touch' ? liftPoint(toWorld(e)) : toWorld(e);
        placeAt(Math.floor(q.x), Math.floor(q.y), e.shiftKey);
        return;
      }
      if (moved > 14) return;
      onTap(toWorld(e), longPress, e.pointerType);
    });
    canvas.addEventListener('contextmenu', (e) => { e.preventDefault(); cancelAll(); });
  }

  function toWorld(e) {
    const rect = canvas.getBoundingClientRect();
    return RG.render.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
  }

  function pickEnemy(p) {
    let best = null;
    let bd = Infinity;
    for (const e of game.state.enemies) {
      if (e.dead || (e.stealth && !e.revealed)) continue;
      const lift = e.flying ? 0.45 : 0;
      const cy = e.y - e.size * 0.4 - lift;
      const d = Math.hypot(p.x - e.x, p.y - cy);
      if (d < Math.max(0.42, e.size * 0.55) && d < bd) { bd = d; best = e; }
    }
    return best;
  }

  function onTap(p, longPress, via) {
    const st = game.state;
    const c = Math.floor(p.x);
    const r = Math.floor(p.y);
    const inside = c >= 0 && r >= 0 && c < game.map.cols && r < game.map.rows;
    if (mode === 'skill') {
      const h = st.hero;
      // 조준 중에 영웅이 쓰러졌거나 맵 밖을 누르면 조준 취소 (터치 기기에서 Esc 없이도 빠져나오게)
      if (!h || h.dead || !inside) { endSkill(); if (h && h.dead) UI.toast('영웅이 쓰러져 기술을 취소했습니다', 'warn'); return; }
      const hd = D().heroes[h.heroId];
      const tgt = hd && hd.skill.target === 'enemy' ? pickEnemy(p) : null;
      const res = doCmd({ type: 'heroSkill', x: round(p.x, 3), y: round(p.y, 3), targetId: tgt ? tgt.id : undefined });
      if (res.ok) endSkill();
      return;
    }
    if (mode === 'rally' && sel && sel.kind === 'tower') {
      const res = doCmd({ type: 'rally', id: sel.id, x: round(p.x, 3), y: round(p.y, 3) });
      if (res.ok) { mode = 'tower'; RG.render.overlay.rally = null; refreshTowerPanel(true); }
      return;
    }
    if (!inside) { cancelAll(); return; }
    if (pick) { placeAt(c, r, false); return; }
    const h = st.hero;
    if (mode === 'hero') {
      if (h && !h.dead && Math.hypot(p.x - h.x, p.y - (h.y - 0.4)) < 0.5) { cancelAll(); return; }
      const res = doCmd({ type: 'heroMove', x: round(p.x, 3), y: round(p.y, 3) });
      if (res.ok) { heroLine('move'); cancelAll(); }
      return;
    }
    // 영웅
    if (h && !h.dead && Math.hypot(p.x - h.x, p.y - (h.y - 0.4)) < 0.5) { selectHero(); return; }
    // 적
    const en = pickEnemy(p);
    if (en) { openEnemy(en); return; }
    // 탑
    const t = game.tileTower(c, r);
    if (t) { openTower(t); return; }
    // 빈 건설 칸: 짓기는 탑 목록에서 탑을 먼저 고름 — 처음 한 번만 알려 주고, 목록을 반짝여 눈길을 끎
    const k = game.map.kinds[r * game.map.cols + c];
    cancelAll();
    if (RG.grid.isBuildKind(k)) buildHint(via === 'keyboard');
  }

  function hoverTip(p, ev) {
    if (mode === 'skill' || mode === 'rally' || pick) { UI.hideTooltip(); return; }
    const en = pickEnemy(p);
    if (en) {
      const tip = document.getElementById('tooltip');
      tip.innerHTML = enemyTip(en.type, en);
      tip.classList.add('show');
      tip.style.left = `${Math.min(window.innerWidth - tip.offsetWidth - 8, ev.clientX + 16)}px`;
      tip.style.top = `${Math.max(6, ev.clientY - tip.offsetHeight - 10)}px`;
    } else UI.hideTooltip();
  }

  function cancelAll() {
    closePanels();
    if (mode === 'skill') endSkill();
    mode = 'idle';
    RG.render.overlay.heroSelected = false;
    RG.render.overlay.rally = null;
  }

  /* =====================================================
   * 영웅
   * ===================================================== */
  function selectHero() {
    const h = game.state.hero;
    if (!h) return;
    if (h.dead) { UI.toast('영웅이 쓰러져 있습니다', 'warn'); return; }
    closePanels();
    mode = 'hero';
    RG.render.overlay.heroSelected = true;
    UI.sfx('click');
    heroLine('select');
    UI.toast('영웅이 갈 곳을 누르세요', 'info', 1400);
  }

  function startSkill() {
    const h = game && game.state.hero;
    if (!h) return;
    if (mode === 'skill') { endSkill(); return; } // 조준 중이면 언제든 다시 눌러 취소
    if (h.dead) { UI.toast('영웅이 쓰러져 있습니다', 'warn'); return; }
    if (h.skillCd > 0) { UI.toast(`기술을 ${Math.ceil(h.skillCd)}초 뒤에 쓸 수 있습니다`, 'warn'); return; }
    closePanels();
    const sk = D().heroes[h.heroId].skill;
    mode = 'skill';
    skillAim = sk;
    RG.render.overlay.skill = { radius: sk.radius || 0.5 };
    UI.toast(sk.target === 'enemy' ? '노릴 적을 누르세요' : sk.target === 'path' ? '벽을 세울 길을 누르세요' : '기술을 쓸 곳을 누르세요', 'info', 1400);
  }
  function endSkill() { mode = 'idle'; skillAim = null; RG.render.overlay.skill = null; }

  /* =====================================================
   * 탑 목록 — 탑을 먼저 고르고 맵에 놓기
   *   누르기: 탑 → 맵의 칸 · 끌어다 놓기: 탑을 맵으로 · 키보드: 숫자 → 방향키 → Enter
   * ===================================================== */
  const SIDE_MQ = '(max-height: 520px), (max-width: 900px)'; // css/game.css 좁은 화면과 같은 조건
  let cardPointerAt = 0;     // 카드를 손가락·마우스로 뗀 때 (뒤따르는 click은 무시)
  let attTimer = 0;

  function availableTowers() {
    return (game.opts.towers || D().towerOrder).filter((t) => D().towers[t]);
  }
  const hotkeyOf = (i) => (i < 9 ? String(i + 1) : i === 9 ? '0' : null);
  const costOf = (type) => RG.stats.costOf(type, 1, null, game.meta);
  const sideDock = () => window.matchMedia(SIDE_MQ).matches;
  /** 탑 목록이 있는 쪽 (안내 문구용) */
  const dockWhere = () => (sideDock() ? '오른쪽' : '아래');
  const coarse = () => window.matchMedia('(pointer: coarse)').matches;

  /** 이 판에서 아예 못 쓰는 탑(도전 금지 등)이면 그 이유. canBuild는 금지 검사를 맵 범위 검사보다 먼저 함 */
  function banReason(type) {
    const res = game.canBuild(type, -1, -1);
    return !res.ok && res.reason !== '맵 밖입니다' && !game.state.result ? res.reason : null;
  }

  function buildDock() {
    const dock = el('nav', { class: 'tower-dock no-click-sfx', 'aria-label': '탑 목록' });
    R.dockHint = el('div', { class: 'dock-hint' });
    R.dockList = el('div', { class: 'dock-list' });
    R.cards = [];
    R.banned = {};
    availableTowers().forEach((type, i) => {
      const td = D().towers[type];
      const key = hotkeyOf(i);
      const cost = costOf(type);
      const ban = banReason(type);
      if (ban) R.banned[type] = ban;
      const card = el('button', {
        class: `tower-card el-${td.element}${ban ? ' banned' : ''}`,
        type: 'button',
        dataset: { type, cost: String(cost) },
        'aria-label': `${td.name} ${cost} 골드${key ? ` (단축키 ${key})` : ''}`,
        'aria-pressed': 'false',
      }, [
        key ? el('kbd', { text: key }) : null,
        (game.ranks && game.ranks[type]) ? el('em', { class: 'tc-rank', text: `+${game.ranks[type]}` }) : null,
        UI.towerImg(type, 1, null, 'tc-img'),
        el('span', { class: 'tc-name', text: td.name }),
        el('span', { class: 'tc-cost' }, [UI.icon('gold', 'tiny'), String(cost)]),
        ban ? el('span', { class: 'tc-ban' }, [UI.icon('lock', 'tiny')]) : null,
      ]);
      card.addEventListener('pointerdown', onCardDown);
      card.addEventListener('pointermove', onCardMove);
      card.addEventListener('pointerup', onCardUp);
      card.addEventListener('pointercancel', onCardCancel);
      // 키보드(Tab → Enter)나 코드로 누른 경우만 여기서 — 손가락·마우스는 pointerup에서 처리함
      card.addEventListener('click', () => { if (performance.now() - cardPointerAt > 600) togglePick(type); });
      card.addEventListener('contextmenu', (e) => { e.preventDefault(); if (pick) { cancelAll(); UI.sfx('click', { vol: 0.4 }); } });
      UI.tooltipFor(card, () => dockTip(type));
      R.dockList.appendChild(card);
      R.cards.push(card);
    });
    dock.addEventListener('contextmenu', (e) => e.preventDefault());
    // 마우스 휠로 가로 목록 넘기기
    R.dockList.addEventListener('wheel', (e) => {
      const L = R.dockList;
      if (L.scrollWidth > L.clientWidth + 1 && Math.abs(e.deltaY) > Math.abs(e.deltaX)) { L.scrollLeft += e.deltaY; e.preventDefault(); }
    }, { passive: false });
    dock.append(R.dockHint, R.dockList);
    return dock;
  }

  /**
   * 데스크톱: 맵 크기를 줄이지 않는 가장 큰 카드 모양을 고름 — 큰 카드(여러 줄) → 작은 카드(여러 줄) → 작은 카드 한 줄(가로로 넘김).
   * 넘치는 방향만 브라우저 스크롤에 맡김
   */
  function fitDock() {
    if (!R.dock || !game) return;
    const side = sideDock();
    const cl = R.dock.classList;
    cl.remove('small', 'compact');
    if (!side) {
      const m = game.map;
      const mapH = Math.floor(R.stage.clientWidth / m.cols) * m.rows; // 폭에 맞춘 맵 높이
      if (R.stage.offsetHeight < mapH) cl.add('small');
      if (R.stage.offsetHeight < mapH) cl.add('compact');
    }
    const L = R.dockList;
    const scroll = side ? L.scrollHeight > L.clientHeight + 1 : L.scrollWidth > L.clientWidth + 1;
    // 손가락: 목록이 넘치면 그 방향은 스크롤, 다른 방향(맵 쪽)으로 끌면 탑 끌기
    L.style.touchAction = scroll ? (side ? 'pan-y' : 'pan-x') : 'none';
    updateDockHint();
  }

  function dockTip(type) {
    const ban = R.banned[type];
    const poor = !ban && game.state.gold < costOf(type);
    const how = coarse() ? '눌러서 고르기 · 맵으로 끌어다 놓기' : '눌러서 고른 뒤 맵을 누르기 · 맵으로 끌어다 놓기';
    return `${towerTip(type)}<br><span class="${ban || poor ? 'warn-line' : 'dim'}">${esc(ban || (poor ? `골드가 부족합니다 (${costOf(type)} 필요)` : how))}</span>`;
  }

  function refreshDock() {
    if (!R.cards || !game) return;
    const gold = game.state.gold;
    for (const card of R.cards) {
      const on = !!pick && pick.type === card.dataset.type;
      const poor = gold < +card.dataset.cost;
      if (card._on !== on) { card._on = on; card.classList.toggle('picked', on); card.setAttribute('aria-pressed', on ? 'true' : 'false'); }
      if (card._poor !== poor) { card._poor = poor; card.classList.toggle('poor', poor); }
    }
  }

  function updateDockHint() {
    if (!R.dock) return;
    R.dock.classList.toggle('placing', !!pick);
    const touch = coarse();
    let html;
    if (pick) {
      const name = esc(D().towers[pick.type].name);
      html = touch ? `<b>${name}</b> · 놓을 칸을 누르세요 · 다시 누르면 취소`
        : `<b>${name}</b> · 놓을 칸을 누르세요 · <kbd>Shift</kbd> 이어서 짓기 · <kbd>Esc</kbd>·오른쪽 클릭 취소`;
    } else {
      html = touch ? '탑을 눌러 고른 뒤 맵을 누르거나, 맵으로 끌어다 놓으세요'
        : '탑을 눌러 고른 뒤 맵에 놓거나, 맵으로 끌어다 놓으세요 · 숫자 키로도 고릅니다';
    }
    if (R.dockHint.dataset.html !== html) { R.dockHint.dataset.html = html; R.dockHint.innerHTML = html; }
  }

  /** 탑 목록을 잠깐 반짝여 눈길을 끎 */
  function dockAttention() {
    if (!R.dock) return;
    R.dock.classList.remove('attention');
    void R.dock.offsetWidth;
    R.dock.classList.add('attention');
    clearTimeout(attTimer);
    attTimer = setTimeout(() => { if (R.dock) R.dock.classList.remove('attention'); }, 1700);
  }

  /** 빈 건설지를 눌렀는데 고른 탑이 없을 때: 처음 한 번만 말로 알려 주고, 목록은 매번 반짝임 */
  function buildHint(byKey) {
    dockAttention();
    if (byKey) {
      if (keyHintShown) return;
      keyHintShown = true;
      UI.toast('숫자 키(1~9, 0)로 탑을 고른 뒤 방향키로 칸을 옮기고 Enter로 놓으세요', 'info', 3000);
      return;
    }
    if (buildHintShown) return;
    buildHintShown = true;
    UI.toast(`${dockWhere()} 탑 목록에서 탑을 골라 맵에 놓으세요`, 'info', 2600);
  }

  function flashCard(type) {
    const card = R.cards && R.cards.find((b) => b.dataset.type === type);
    if (!card) return;
    card.classList.remove('flash');
    void card.offsetWidth;
    card.classList.add('flash');
    clearTimeout(card._flashT);
    card._flashT = setTimeout(() => card.classList.remove('flash'), 1400);
  }

  /* ---------------- 놓기 모드 ---------------- */
  function togglePick(type, via) {
    if (pick && pick.type === type) { cancelAll(); UI.sfx('click', { vol: 0.4 }); return; }
    pickTower(type, via);
  }

  function pickTower(type, via) {
    if (!game || game.state.result) return false;
    const ban = R.banned && R.banned[type];
    if (ban) { UI.sfx('error'); UI.toast(ban, 'warn'); return false; }
    cancelAll(); // 열린 창·영웅 이동·기술 조준을 닫고 놓기 모드로
    pick = { type, c: null, r: null, res: null, links: [] };
    mode = 'place';
    UI.sfx('click');
    UI.hideTooltip();
    if (via === 'key') {
      // 숫자 키: 방향키 커서(없으면 마우스가 있던 칸, 그것도 없으면 가운데 가까운 빈 건설지)에 미리보기
      const h = RG.render.overlay.hover;
      keyCursor = keyCursor || (h ? { c: h.c, r: h.r } : defaultCursor());
      RG.render.overlay.hover = { c: keyCursor.c, r: keyCursor.r };
      setGhost(keyCursor.c, keyCursor.r);
    } else if (via !== 'drag' && keyCursor) setGhost(keyCursor.c, keyCursor.r);
    if (via === 'touch' && !placeHintShown && sideDock()) {
      placeHintShown = true;
      UI.toast(`${D().towers[type].name}: 놓을 칸을 누르세요`, 'info', 1500);
    }
    refreshDock();
    updateDockHint();
    return true;
  }

  function endPlacing() {
    pick = null;
    if (mode === 'place') mode = 'idle';
    RG.render.overlay.ghost = null;
    if (canvas) canvas.style.cursor = '';
    hideLabel();
    refreshDock();
    updateDockHint();
  }

  /** 맵 가운데에서 가장 가까운 빈 건설지 */
  function defaultCursor() {
    const m = game.map;
    const cc = (m.cols - 1) / 2;
    const cr = (m.rows - 1) / 2;
    let best = null;
    let bd = Infinity;
    for (let r = 0; r < m.rows; r++) {
      for (let c = 0; c < m.cols; c++) {
        if (!RG.grid.isBuildKind(m.kinds[r * m.cols + c]) || game.tileTower(c, r)) continue;
        const d = Math.hypot(c - cc, r - cr);
        if (d < bd) { bd = d; best = { c, r }; }
      }
    }
    return best || { c: Math.floor(m.cols / 2), r: Math.floor(m.rows / 2) };
  }

  /** 손가락으로 끌 때는 미리보기를 손가락 위쪽(약 한 칸)에 둠 — 손가락에 가리지 않게 */
  function liftPoint(p) {
    const T = RG.render.T || 40;
    return { x: p.x, y: p.y - Math.max(T * 1.05, 42) / T };
  }

  /** 미리보기 칸 옮기기 (맵 밖이면 지움) */
  function setGhost(c, r) {
    if (!pick) return;
    const m = game.map;
    const inside = c != null && c >= 0 && r >= 0 && c < m.cols && r < m.rows;
    if (!inside) {
      if (pick.c != null) { pick.c = null; pick.r = null; RG.render.overlay.ghost = null; canvas.style.cursor = ''; }
      hideLabel();
      return;
    }
    if (pick.c === c && pick.r === r && RG.render.overlay.ghost) return;
    pick.c = c;
    pick.r = r;
    refreshGhost();
  }

  /** 미리보기 다시 계산: 지을 수 있는지(초록/빨강), 생길 공명, 길 만들기 맵이면 바뀔 길 */
  function refreshGhost() {
    if (!pick || pick.c == null) { RG.render.overlay.ghost = null; return; }
    const { type, c, r } = pick;
    const m = game.map;
    const i = r * m.cols + c;
    const res = game.canBuild(type, c, r);
    const free = RG.grid.isBuildKind(m.kinds[i]) && !game.tileTower(c, r);
    const links = free ? game.previewLinks(type, c, r) : [];
    const gh = { type, c, r, ok: res.ok, links };
    if (res.ok && m.kinds[i] === RG.grid.T.OPEN) {
      // 공터에 지으면 적이 돌아갈 길 — 준비 단계의 길 화살표가 이 길을 보여 줌
      const blocked = Uint8Array.from(game.blocked);
      blocked[i] = 1;
      gh.blocked = blocked;
      gh.flow = RG.grid.computeFlow(m, blocked);
    }
    pick.res = res;
    pick.links = links;
    RG.render.overlay.ghost = gh;
    canvas.style.cursor = res.ok ? 'pointer' : 'not-allowed';
    placeLabel();
  }

  /** 그 칸에 짓기. 못 지으면 이유를 알리고 놓기 모드는 그대로. keep(Shift)이면 지은 뒤에도 같은 탑으로 계속 */
  function placeAt(c, r, keep) {
    if (!pick) return false;
    const m = game.map;
    if (c < 0 || r < 0 || c >= m.cols || r >= m.rows) { cancelAll(); UI.sfx('click', { vol: 0.4 }); return false; }
    setGhost(c, r);
    const type = pick.type;
    const chk = game.canBuild(type, c, r);
    if (!chk.ok) { UI.sfx('error'); UI.toast(chk.reason, 'warn'); return false; }
    const res = doCmd({ type: 'build', tower: type, c, r });
    if (!res.ok) return false;
    flashCard(type);
    if (keep) { refreshGhost(); refreshDock(); return true; }
    const t = game.state.towers.find((q) => q.id === res.id);
    endPlacing();
    // 병영은 바로 정보 창을 열어 집결지를 옮길 수 있게
    if (t && D().towers[t.type].role === 'barracks') openTower(t);
    return true;
  }

  /** 놓기 모드에서 맵·탑 목록 밖(양옆 띠, 버튼 등)을 누르면 취소 */
  function onOutsideDown(e) {
    if (!pick || !game) return;
    const t = e.target;
    if (!t || !t.closest) return;
    if (t === canvas || t.closest('.tower-dock') || t.closest('#modal-root') || t.closest('#toast-root')) return;
    cancelAll();
  }

  /* ---------------- 카드 누르기·끌기 (Pointer Events: 마우스·터치·펜 공통) ---------------- */
  function onCardDown(e) {
    if (!game || e.button > 0 || UI.modalOpen()) return;
    const card = e.currentTarget;
    if (e.pointerType === 'mouse') e.preventDefault(); // 글자 선택·초점 막기 (초점이 남으면 Space가 카드를 누름)
    drag = { type: card.dataset.type, card, id: e.pointerId, x0: e.clientX, y0: e.clientY, started: false, touch: e.pointerType !== 'mouse' };
    try { card.setPointerCapture(e.pointerId); } catch (er) { /* 무시 */ }
  }

  function onCardMove(e) {
    if (!drag || e.pointerId !== drag.id) return;
    if (!drag.started) {
      if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < (drag.touch ? 10 : 6)) return;
      if (R.banned[drag.type]) return; // 금지된 탑은 끌지 않음 (떼면 이유를 알림)
      drag.started = true;
      if (!pick || pick.type !== drag.type) pickTower(drag.type, 'drag');
      document.body.classList.add('rg-dragging');
      UI.hideTooltip();
    }
    dragAt(e);
  }

  /** 끄는 중: 맵 위면 칸에 붙은 미리보기, 아니면 손가락·마우스 옆 이름표만 */
  function dragAt(e) {
    if (!pick) return;
    const rect = canvas.getBoundingClientRect();
    const over = e.clientX >= rect.left && e.clientX < rect.right && e.clientY >= rect.top && e.clientY < rect.bottom;
    let p = null;
    if (over) {
      p = RG.render.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
      if (drag && drag.touch) p = liftPoint(p);
    }
    setGhost(p ? Math.floor(p.x) : null, p ? Math.floor(p.y) : null);
    if (pick.c == null) placeLabel({ x: e.clientX, y: e.clientY, touch: !!(drag && drag.touch) });
  }

  function onCardUp(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    cardPointerAt = performance.now();
    document.body.classList.remove('rg-dragging');
    if (document.activeElement === d.card) d.card.blur();
    if (!d.started) { togglePick(d.type, d.touch ? 'touch' : 'click'); return; }
    // 끌어다 놓기: 맵의 칸 위에서 떼면 짓기, 목록 위나 맵 밖이면 취소
    if (!pick || pick.type !== d.type) return; // 끄는 중에 Esc로 취소함
    // 마지막으로 보이던 미리보기 칸에 짓기 (손가락은 손가락 위쪽 칸)
    if (pick.c != null) placeAt(pick.c, pick.r, e.shiftKey);
    else { cancelAll(); UI.sfx('click', { vol: 0.4 }); }
  }

  function onCardCancel(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    document.body.classList.remove('rg-dragging');
    if (d.started && pick && pick.type === d.type) cancelAll();
  }

  /* ---------------- 놓기 이름표: 이름·값·지을 수 있는지 ---------------- */
  function hideLabel() {
    if (!R.label) return;
    R.label.classList.add('hidden');
    R.label.dataset.sig = '';
  }

  /** 미리보기 칸 위(자리가 없으면 옆)에, 끄는 중 맵 밖이면 손가락·마우스 위에 */
  function placeLabel(pt) {
    const L = R.label;
    if (!L || !game) return;
    if (!pick || (pick.c == null && !pt)) { hideLabel(); return; }
    const td = D().towers[pick.type];
    let status;
    let cls = '';
    if (pick.c != null && pick.res) {
      if (!pick.res.ok) { status = pick.res.reason; cls = 'bad'; } else {
        const names = [...new Set((pick.links || []).map((l) => l.res.name))];
        status = names.length ? `공명: ${names.join(', ')}` : td.noResonance ? '공명하지 않는 탑' : '여기에 짓기';
        cls = names.length ? 'ok res' : 'ok';
      }
    } else status = '맵 위에서 놓으세요';
    const sig = `${pick.type}|${status}|${cls}`;
    if (L.dataset.sig !== sig) {
      L.dataset.sig = sig;
      L.className = `place-label ${cls}`;
      L.innerHTML = '';
      const card = R.cards.find((b) => b.dataset.type === pick.type);
      const img = card ? card.querySelector('.tc-img').cloneNode(false) : UI.towerImg(pick.type, 1, null);
      img.className = 'pl-img';
      L.append(img, el('div', { class: 'pl-text' }, [
        el('div', { class: 'pl-head' }, [el('b', { text: td.name }), el('span', { class: 'pl-cost' }, [UI.icon('gold', 'tiny'), String(costOf(pick.type))])]),
        el('span', { class: 'pl-status', text: `${cls === 'bad' ? '✕ ' : cls ? '✓ ' : ''}${status}` }),
      ]));
    }
    const W = root.clientWidth;
    const lw = L.offsetWidth;
    const lh = L.offsetHeight;
    let x;
    let y;
    if (pick.c != null) {
      const rect = canvas.getBoundingClientRect();
      const T = RG.render.T;
      const top = RG.render.worldToScreen(pick.c + 0.5, pick.r - 0.5); // 탑 그림 꼭대기 조금 위
      x = rect.left + top.x - lw / 2;
      y = rect.top + top.y - lh - 2;
      if (y < 4) {
        // 위쪽이 모자라면 칸 옆으로 (손가락은 미리보기 아래에 있으니 아래로는 두지 않음)
        const mid = RG.render.worldToScreen(pick.c + 0.5, pick.r + 0.5);
        x = rect.left + mid.x + T * 0.7;
        if (x + lw > W - 4) x = rect.left + mid.x - T * 0.7 - lw;
        y = rect.top + mid.y - lh / 2;
      }
    } else {
      x = pt.x - lw / 2;
      y = pt.y - lh - (pt.touch ? 58 : 16);
      if (y < 4) y = pt.touch ? 4 : pt.y + 22;
    }
    x = Math.max(4, Math.min(W - lw - 4, x));
    y = Math.max(4, y);
    L.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    L.classList.remove('hidden');
  }

  function closePanels() {
    if (R.info) { R.info.classList.add('hidden'); R.info.innerHTML = ''; }
    sel = null;
    if (pick) endPlacing();
    RG.render.overlay.ghost = null;
    RG.render.overlay.selectedTower = null;
    RG.render.overlay.selectedEnemy = null;
    RG.render.overlay.rally = null;
    if (mode === 'place' || mode === 'tower' || mode === 'enemy' || mode === 'rally') mode = 'idle';
  }

  /* =====================================================
   * 탑 정보 창
   * ===================================================== */
  function openTower(t) {
    closePanels();
    sel = { kind: 'tower', id: t.id };
    mode = 'tower';
    RG.render.overlay.selectedTower = t.id;
    UI.sfx('click');
    refreshTowerPanel(true);
  }

  function statLines(calc, td) {
    const out = [];
    const k = (v) => round(v, 2);
    const role = td.role;
    if (role === 'attack') {
      if (calc.kind === 'beam') out.push(['damage', '초당 피해', `${k(calc.dps)} → 최대 ×${calc.beam.maxMult}`, calc.dmgBonus]);
      else if (calc.kind === 'orb') out.push(['damage', '장판 초당 피해', `${k(calc.zone.dps)}`, calc.dmgBonus]);
      else if (calc.kind === 'snare') out.push(['damage', '덫 피해', `${k(calc.snare.damage)}`, calc.dmgBonus]);
      else out.push(['damage', '피해', `${k(calc.damage)}${calc.multishot ? ` ×${calc.multishot}발` : ''}`, calc.dmgBonus]);
      if (calc.interval) out.push(['speed', calc.kind === 'snare' ? '덫 간격' : '공격 간격', `${k(calc.interval)}초`]);
      if (calc.range) out.push(['range', calc.kind === 'pulse' ? '범위' : '사거리', `${k(calc.range)}칸`]);
      out.push(['target', '대상', calc.targets === 'both' ? '지상·공중' : calc.targets === 'air' ? '공중만' : '지상만']);
    }
    if (role === 'barracks') {
      const s = calc.soldiers;
      out.push(['hero', '병사', `${s.count}명 · 체력 ${k(s.hp)} · 붙잡기 ${s.block}`]);
      out.push(['damage', '병사 피해', `${k(s.damage)}`, calc.dmgBonus]);
      out.push(['speed', '공격 간격', `${k(s.interval)}초 · 다시 나옴 ${s.respawn}초`]);
    }
    if (role === 'support' && calc.aura) {
      const a = calc.aura;
      if (a.damagePct) out.push(['damage', '이웃 피해', `+${round(a.damagePct * 100, 1)}%`]);
      if (a.speedPct) out.push(['speed', '이웃 공격 속도', `+${round(a.speedPct * 100, 1)}%`]);
      if (a.rangePct) out.push(['range', '이웃 사거리', `+${round(a.rangePct * 100, 1)}%`]);
      if (a.critChance) out.push(['damage', '이웃 치명타', `+${round(a.critChance * 100, 1)}%`]);
      if (a.burnOnHit) out.push(['burn', '이웃 화상', `피해의 ${round(a.burnOnHit.pct * 100)}%`]);
      if (a.zapEvery) out.push(['storm', '추가 번개', `${a.zapEvery.n}번째 공격마다 ${k(a.zapEvery.damage)}`]);
      if (calc.detect) out.push(['stealth', '탐지', `${calc.detect}칸`]);
      if (calc.heal) out.push(['hp', '회복', `초당 ${k(calc.heal.hps)} (${calc.heal.radius}칸)`]);
      if (calc.discharge) out.push(['storm', '방전', `${calc.discharge.every}초마다 ${k(calc.discharge.damage)}`]);
    }
    if (role === 'economy') {
      out.push(['gold', '웨이브 수입', `${calc.income}${calc.incomeGrowth ? ` (+${calc.incomeGrowth}씩, 최대 +${calc.incomeGrowthMax})` : ''}`]);
      if (calc.bountyAura) out.push(['gold', '주변 현상금', `+${round(calc.bountyAura.pct * 100)}% (${calc.bountyAura.radius}칸)`]);
    }
    // 명중 효과
    const oh = calc.onHit || {};
    const fx = [];
    if (oh.burn) fx.push(`화상 초당 ${k(oh.burn.dps)}`);
    if (oh.slow) fx.push(`감속 ${round(oh.slow.pct * 100)}%`);
    if (oh.freezeEvery) fx.push(`${oh.freezeEvery.n}번째마다 빙결 ${oh.freezeEvery.dur}초`);
    if (oh.curse) fx.push(`저주 +${round(oh.curse.pct * 100)}%`);
    if (oh.shred) fx.push(`갑옷 −${round(oh.shred.pct * 100)}%p`);
    if (oh.stun) fx.push(`기절 ${oh.stun.dur}초`);
    if (oh.knockback) fx.push(`밀쳐내기 ${oh.knockback}칸`);
    if (oh.flyingMult) fx.push(`비행 피해 ×${oh.flyingMult}`);
    if (oh.blind) fx.push(`실명 ${oh.blind}초`);
    if (oh.purify) fx.push('보호막 제거·치유 봉쇄');
    if (oh.halt) fx.push(`치유·보호막 재생 정지 ${oh.halt}초`);
    if (oh.veil) fx.push(`감속된 적 받는 피해 +${round(oh.veil.pct * 100)}%`);
    if (oh.execute) fx.push(`체력 ${round(oh.execute * 100)}% 이하 처치`);
    if (oh.bonusVsSlowed) fx.push(`감속·빙결된 적 피해 +${round(oh.bonusVsSlowed * 100)}%`);
    if (oh.spreadCurse) fx.push('죽으면 저주 확산');
    if (calc.splash) fx.push(`폭발 반경 ${calc.splash}칸`);
    if (calc.zone && calc.kind !== 'orb') fx.push(`장판 초당 ${k(calc.zone.dps)} · ${calc.zone.dur}초`);
    if (calc.zone && calc.zone.slowPct) fx.push(`장판 감속 ${round(calc.zone.slowPct * 100)}%`);
    if (calc.zone && calc.zone.meltArmor) fx.push(`장판 위 갑옷 −${round(calc.zone.meltArmor * 100)}%p`);
    if (calc.chain) fx.push(`연쇄 ${calc.chain.count}번`);
    if (calc.pierce) fx.push('직선 관통');
    if (calc.crit) fx.push(`치명타 ${round(calc.crit.chance * 100)}%`);
    if (calc.shieldMult) fx.push(`보호막 피해 ×${calc.shieldMult}`);
    if (calc.cyclone) fx.push(`${calc.cyclone.every}초마다 회오리`);
    if (calc.snare) fx.push(`덫 ${calc.snare.maxTraps}개 · 속박 ${calc.snare.root}초${calc.snare.bleed ? ' · 출혈' : ''}${calc.snare.extraTargets ? ` · 주변 ${calc.snare.extraTargets}명 함께` : ''}`);
    if (calc.minRange) fx.push(`최소 사거리 ${calc.minRange}칸`);
    return { lines: out, fx };
  }

  function refreshTowerPanel(force) {
    const t = game.state.towers.find((q) => q.id === (sel && sel.id));
    if (!t) { closePanels(); return; }
    const info = game.towerInfo(t.id);
    const sig = JSON.stringify([t.level, t.branch, t.effects, t.disabled, t.dampened, t.building, Math.floor(game.state.gold / 5), t.targetMode, Math.floor(info.damageDealt / 50), mode]);
    if (!force && R.info.dataset.sig === sig) return;
    R.info.dataset.sig = sig;
    const td = info.def;
    const calc = t.calc;
    R.info.innerHTML = '';
    R.info.classList.remove('hidden');
    const head = el('div', { class: 'ip-head' }, [
      UI.towerImg(t.type, t.level, t.branch, 'ip-img'),
      el('div', { class: 'ip-title' }, [
        el('b', { text: info.name }),
        el('span', { class: 'ip-sub' }, [UI.elementBadge(td.element), el('span', { text: t.level >= 4 ? ' 분기' : ` Lv${t.level}` }), calc && calc.rank ? el('em', { class: 'ip-rank', title: `뽑기 중복 강화: ${UI.rankText ? UI.rankText(t.type, calc.rank) : ''}`, text: ` 강화 +${calc.rank}` }) : null]),
      ]),
      el('button', { class: 'x-btn', 'aria-label': '닫기', onclick: cancelAll }, [UI.icon('close')]),
    ]);
    R.info.appendChild(head);
    const desc = t.level >= 4 ? td.branches[t.branch].desc : td.desc;
    R.info.appendChild(el('p', { class: 'ip-desc', text: desc }));
    if (t.disabled) R.info.appendChild(el('p', { class: 'warn-line', text: t.silenced ? '침묵: 지금은 공격·지원·공명을 못 합니다' : '멈춤: 지금은 공격·지원·공명을 못 합니다' }));
    else if (t.dampened) R.info.appendChild(el('p', { class: 'warn-line', text: '공명이 끊겼습니다' }));
    if (t.building) R.info.appendChild(el('p', { class: 'dim', text: '짓는 중…' }));
    const sl = statLines(calc, td);
    const tbl = el('div', { class: 'stat-list' });
    for (const [ic, name, val, bonus] of sl.lines) {
      tbl.appendChild(el('div', { class: 'stat-row' }, [UI.icon(ic, 'tiny'), el('span', { text: name }), el('b', { text: val }), bonus ? el('em', { class: 'bonus', text: `+${round(bonus * 100)}%` }) : null]));
    }
    R.info.appendChild(tbl);
    if (sl.fx.length) R.info.appendChild(el('div', { class: 'fx-list' }, sl.fx.map((f) => el('span', { class: 'fx-chip', text: f }))));
    // 공명
    const resBox = el('div', { class: 'res-box' });
    resBox.appendChild(el('div', { class: 'sec-title', text: td.noResonance ? '공명 — 이 탑은 공명하지 않습니다' : `공명 ${t.effects.length ? `(${t.effects.length})` : ''}` }));
    if (!td.noResonance) {
      if (!t.effects.length) resBox.appendChild(el('p', { class: 'dim small', text: '이웃한 8칸에 다른 탑을 지으면 공명이 생깁니다.' }));
      if (td.role === 'support' && t.effects.length) resBox.appendChild(el('p', { class: 'small', text: `공명 증폭: 지원 효과 +${round(calc.amp * 100)}%` }));
      for (const key of t.effects) {
        const res = D().resonance[key];
        const na = calc.inapplicable && calc.inapplicable.includes(res.id);
        const supportOnly = td.role === 'support';
        resBox.appendChild(el('div', { class: `res-row ${na ? 'na' : ''}` }, [
          el('b', { text: res.name }),
          el('span', { text: na ? '이 탑에는 적용되지 않음' : supportOnly ? '이웃에게 효과를 주고, 나는 증폭을 받음' : res.desc }),
        ]));
      }
      const au = calc.auras || {};
      const auraTexts = [];
      if (au.damagePct) auraTexts.push(`대장간 피해 +${round(au.damagePct * 100)}%`);
      if (au.speedPct) auraTexts.push(`축전기 속도 +${round(au.speedPct * 100)}%`);
      if (au.rangePct) auraTexts.push(`성소 사거리 +${round(au.rangePct * 100)}%`);
      if (au.critChance) auraTexts.push(`무기고 치명타 +${round(au.critChance * 100)}%`);
      if (auraTexts.length) resBox.appendChild(el('p', { class: 'small aura-line', text: `지원 받는 중: ${auraTexts.join(', ')}` }));
    }
    R.info.appendChild(resBox);
    // 강화
    const up = el('div', { class: 'up-box' });
    for (const n of info.next) {
      if (n.type === 'upgrade') {
        const b = el('button', { class: 'btn btn-up', disabled: game.state.gold < n.cost || t.building, onclick: () => doCmd({ type: 'upgrade', id: t.id }) }, [
          UI.icon('upgrade', 'tiny'), el('span', { text: `Lv${n.level} 강화` }), el('span', { class: 'cost' }, [UI.icon('gold', 'tiny'), String(n.cost)]),
        ]);
        UI.tooltipFor(b, () => upgradeDiff(t, n.spec));
        up.appendChild(b);
      } else {
        const card = el('button', { class: `branch-card ${n.locked ? 'locked' : ''}`, disabled: n.locked || game.state.gold < n.cost || t.building, onclick: () => confirmBranch(t, n) }, [
          UI.towerImg(t.type, 4, n.branch, 'br-img'),
          el('b', { text: `${n.branch} · ${n.spec.name}` }),
          el('span', { class: 'br-desc', text: n.locked ? '첫 보스(1-6)를 쓰러뜨리면 열립니다' : n.spec.desc }),
          el('span', { class: 'cost' }, [UI.icon('gold', 'tiny'), String(n.cost)]),
        ]);
        up.appendChild(card);
      }
    }
    if (!info.next.length && t.level < 4) up.appendChild(el('p', { class: 'dim small', text: '이 도전에서는 더 강화할 수 없습니다' }));
    R.info.appendChild(up);
    // 표적·집결지·판매
    const row = el('div', { class: 'ip-actions' });
    if (td.role === 'attack') {
      const tm = el('div', { class: 'target-modes' });
      for (const m of D().targetModeOrder) {
        tm.appendChild(el('button', { class: `tm-btn ${t.targetMode === m ? 'on' : ''}`, title: D().targetModes[m].desc, text: D().targetModes[m].name, onclick: () => { doCmd({ type: 'target', id: t.id, mode: m }); refreshTowerPanel(true); } }));
      }
      R.info.appendChild(el('div', { class: 'sec-title', text: '표적' }));
      R.info.appendChild(tm);
    }
    if (td.role === 'barracks') {
      row.appendChild(el('button', { class: `btn ${mode === 'rally' ? 'btn-primary' : ''}`, onclick: () => { mode = 'rally'; RG.render.overlay.rally = t.id; UI.toast('병사가 설 길을 누르세요', 'info'); refreshTowerPanel(true); } }, ['집결지 옮기기']));
    }
    if (info.canSell) {
      row.appendChild(el('button', { class: 'btn btn-sell', onclick: () => confirmSell(t, info.sellValue) }, [UI.icon('sell', 'tiny'), `팔기 ${info.sellValue}`]));
    }
    R.info.appendChild(row);
    if (info.damageDealt > 0) R.info.appendChild(el('p', { class: 'dim small', text: `이번 판 피해 ${Math.round(info.damageDealt).toLocaleString()}` }));
  }

  function upgradeDiff(t, spec) {
    const cur = t.calc;
    const parts = [];
    if (spec.damage != null && cur.damage != null) parts.push(`피해 ${round(cur.damage, 1)} → ${spec.damage}`);
    if (spec.interval && cur.interval) parts.push(`간격 ${round(RG.stats.specOf(t.type, t.level, t.branch).interval, 2)} → ${spec.interval}초`);
    if (spec.range && cur.range) parts.push(`사거리 ${round(RG.stats.specOf(t.type, t.level, t.branch).range, 1)} → ${spec.range}칸`);
    if (spec.income) parts.push(`수입 ${cur.income} → ${spec.income}`);
    if (spec.soldiers) parts.push(`병사 ${cur.soldiers.count}명 체력 ${cur.soldiers.hp} → ${spec.soldiers.count}명 ${spec.soldiers.hp}`);
    if (spec.aura) parts.push(Object.entries(spec.aura).filter(([, v]) => typeof v === 'number').map(([k, v]) => `${({ damagePct: '피해', speedPct: '속도', rangePct: '사거리', critChance: '치명타' })[k] || k} +${round(v * 100)}%`).join(', '));
    return parts.map(esc).join('<br>') || '강화';
  }

  function confirmBranch(t, n) {
    UI.confirmBox(`${D().towers[t.type].name}을(를) "${n.spec.name}"(으)로 분기합니다.\n${n.spec.desc}\n\n한번 고르면 바꿀 수 없습니다. (${n.cost} 골드)`, () => doCmd({ type: 'branch', id: t.id, branch: n.branch }), { title: '분기 강화', yes: '분기' });
  }
  function confirmSell(t, value) {
    if (!game.state.wave.started) { doCmd({ type: 'sell', id: t.id }); return; }
    UI.confirmBox(`${D().towers[t.type].name}을(를) ${value} 골드에 팝니다.`, () => doCmd({ type: 'sell', id: t.id }), { title: '팔기', yes: '팔기', danger: true });
  }

  /* =====================================================
   * 적 정보 창
   * ===================================================== */
  function openEnemy(e) {
    closePanels();
    sel = { kind: 'enemy', id: e.id };
    mode = 'enemy';
    RG.render.overlay.selectedEnemy = e.id;
    refreshEnemyPanel(true);
  }

  function enemyTip(type, live) {
    const ed = D().enemies[type];
    const traits = Object.keys(ed.traits).filter((k) => D().traits[k]).map((k) => D().traits[k].name);
    const aff = Object.entries(ed.affinity).map(([el2, a]) => `${D().elements[el2].name} ${D().affinities[a].name}`);
    return `<b>${esc(ed.name)}</b>${ed.boss ? ' 👑' : ed.elite ? ' · 정예' : ''}<br>${live ? `체력 ${Math.ceil(live.hp)}/${Math.ceil(live.maxHp)}${live.shield > 0 ? ` · 보호막 ${Math.ceil(live.shield)}` : ''}<br>` : `체력 ${ed.hp}<br>`}${traits.length ? `특성: ${esc(traits.join(', '))}<br>` : ''}${aff.length ? `친화: ${esc(aff.join(', '))}<br>` : ''}${ed.armor ? `갑옷 ${round(ed.armor * 100)}%<br>` : ''}<span class="dim">${esc(ed.desc)}</span>`;
  }

  function refreshEnemyPanel(force) {
    const e = game.state.enemies.find((q) => q.id === (sel && sel.id));
    if (!e) { closePanels(); return; }
    const ed = D().enemies[e.type];
    if (force) {
      R.info.innerHTML = '';
      R.info.classList.remove('hidden');
      R.info.append(
        el('div', { class: 'ip-head' }, [UI.enemyImg(e.type, 'ip-img'), el('div', { class: 'ip-title' }, [el('b', { text: ed.name }), el('span', { class: 'ip-sub', text: ed.boss ? '보스' : ed.elite ? '정예' : `${D().regions[ed.region - 1].name}` })]), el('button', { class: 'x-btn', onclick: cancelAll }, [UI.icon('close')])]),
        el('div', { class: 'bar bar-ehp' }, [el('i'), el('span')]),
        el('p', { class: 'ip-desc', text: ed.desc }),
      );
      const tbl = el('div', { class: 'stat-list' });
      tbl.append(
        el('div', { class: 'stat-row' }, [UI.icon('armor', 'tiny'), el('span', { text: '갑옷' }), el('b', { class: 'v-armor', text: `${round(ed.armor * 100)}%` })]),
        el('div', { class: 'stat-row' }, [UI.icon('speed', 'tiny'), el('span', { text: '이동 속도' }), el('b', { text: `${ed.speed}칸/초` })]),
        el('div', { class: 'stat-row' }, [UI.icon('lives', 'tiny'), el('span', { text: '등불에 닿으면' }), el('b', { text: ed.boss ? '즉시 패배' : `불꽃 ${ed.lives}개` })]),
        el('div', { class: 'stat-row' }, [UI.icon('gold', 'tiny'), el('span', { text: '현상금' }), el('b', { text: String(ed.bounty) })]),
      );
      R.info.appendChild(tbl);
      const traits = Object.keys(ed.traits).filter((k) => D().traits[k]);
      if (traits.length) {
        R.info.appendChild(el('div', { class: 'sec-title', text: '특성' }));
        for (const k of traits) R.info.appendChild(el('div', { class: 'trait-row' }, [UI.icon(D().traits[k].icon, 'small'), el('div', {}, [el('b', { text: D().traits[k].name }), el('span', { text: D().traits[k].desc })])]));
      }
      const aff = Object.entries(ed.affinity);
      if (aff.length) {
        R.info.appendChild(el('div', { class: 'sec-title', text: '원소 친화' }));
        R.info.appendChild(el('div', { class: 'aff-list' }, aff.map(([el2, a]) => el('span', { class: `aff-chip aff-${a}` }, [UI.elementBadge(el2), D().affinities[a].name]))));
      }
      R.info.appendChild(el('div', { class: 'status-now' }));
    }
    const hb = R.info.querySelector('.bar-ehp');
    if (hb) {
      hb.firstChild.style.width = `${(e.hp / e.maxHp) * 100}%`;
      hb.lastChild.textContent = `${Math.ceil(e.hp)} / ${Math.ceil(e.maxHp)}${e.shield > 0 ? ` (+${Math.ceil(e.shield)})` : ''}`;
    }
    const sn = R.info.querySelector('.status-now');
    if (sn) {
      const st = game.state;
      const s = [];
      if (st.time < e.ccUntil) s.push(D().statuses[e.ccKind] ? D().statuses[e.ccKind].name : e.ccKind);
      if (st.time < e.st.slowUntil) s.push(`감속 ${round(e.st.slowPct * 100)}%`);
      if (e.st.curse && st.time < e.st.curse.until) s.push(`저주 +${round(e.st.curse.pct * 100)}%`);
      if (e.st.burns.length) s.push('화상');
      if (e.st.bleeds.length) s.push('출혈');
      let shred = 0;
      for (const v of Object.values(e.st.shreds)) if (st.time < v.until) shred += v.pct;
      if (shred) s.push(`갑옷 −${round(shred * 100)}%p`);
      if (st.time < e.st.stillUntil) s.push('치유 감소');
      if (e.immuneEls) s.push(`면역: ${e.immuneEls.map((x) => D().elements[x].name).join('·')}`);
      sn.textContent = s.length ? `지금: ${s.join(' · ')}` : '';
    }
  }

  function towerTip(type) {
    const td = D().towers[type];
    const s = td.levels[0];
    return `<b>${esc(td.name)}</b> · ${esc(D().elements[td.element].name)}<br>${esc(td.desc)}${s.range ? `<br><span class="dim">사거리 ${s.range}칸</span>` : ''}`;
  }

  /* =====================================================
   * 키보드
   * ===================================================== */
  function onKey(e) {
    if (!game || UI.currentId() !== 'game') return;
    if (e.target && /input|textarea/i.test(e.target.tagName)) return;
    const k = e.key;
    if (k === 'Escape') {
      if (UI.closeTopModal()) return;
      if (mode !== 'idle' || sel) cancelAll(); else openPause();
      e.preventDefault();
      return;
    }
    if (UI.modalOpen()) return;
    // 탑 목록 카드에 키보드 초점이 있으면 Enter·Space는 그 카드 누르기
    if ((k === 'Enter' || k === ' ') && e.target && e.target.closest && e.target.closest('.tower-dock')) return;
    if (k === ' ' || k === 'Spacebar') { doCmd({ type: 'callWave' }); e.preventDefault(); return; }
    if (k === 'p' || k === 'P') { togglePause(); return; }
    if (k === 'f' || k === 'F') { cycleSpeed(); return; }
    if (k === 'q' || k === 'Q') { startSkill(); return; }
    if (k === 'h' || k === 'H') { selectHero(); return; }
    // 숫자 키: 탑 목록의 탑 고르기 (1~9, 0 = 10번째). Lv3 탑 정보 창이 열려 있으면 1·2는 분기 A·B
    if (/^[0-9]$/.test(k) && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if ((k === '1' || k === '2') && branchKey(k)) return;
      const type = availableTowers()[k === '0' ? 9 : +k - 1];
      if (type) togglePick(type, 'key');
      e.preventDefault();
      return;
    }
    // 방향키 커서: 마우스·터치 없이 칸 고르기 (Enter = 그 칸 누르기, 놓기 모드면 짓기)
    const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (arrows[k]) {
      const m = game.map;
      const hv = RG.render.overlay.hover;
      const cur = keyCursor || (pick && pick.c != null ? { c: pick.c, r: pick.r } : hv ? { c: hv.c, r: hv.r } : { c: Math.floor(m.cols / 2), r: Math.floor(m.rows / 2) });
      keyCursor = { c: Math.max(0, Math.min(m.cols - 1, cur.c + arrows[k][0])), r: Math.max(0, Math.min(m.rows - 1, cur.r + arrows[k][1])) };
      RG.render.overlay.hover = { c: keyCursor.c, r: keyCursor.r };
      if (mode === 'skill') RG.render.overlay.skillPos = { x: keyCursor.c + 0.5, y: keyCursor.r + 0.5 };
      if (pick) setGhost(keyCursor.c, keyCursor.r);
      e.preventDefault();
      return;
    }
    if (k === 'Enter' && pick) {
      e.preventDefault();
      if (pick.c == null) {
        // 미리보기가 맵에 없으면(마우스가 맵 밖) 먼저 커서 칸에 띄움
        const hv = RG.render.overlay.hover;
        keyCursor = keyCursor || (hv ? { c: hv.c, r: hv.r } : defaultCursor());
        RG.render.overlay.hover = { c: keyCursor.c, r: keyCursor.r };
        setGhost(keyCursor.c, keyCursor.r);
        return;
      }
      placeAt(pick.c, pick.r, e.shiftKey);
      return;
    }
    if (k === 'Enter' && keyCursor) { onTap({ x: keyCursor.c + 0.5, y: keyCursor.r + 0.5 }, false, 'keyboard'); e.preventDefault(); return; }
    if (sel && sel.kind === 'tower') {
      const t = game.state.towers.find((q) => q.id === sel.id);
      if (!t) return;
      if (k === 'u' || k === 'U') { if (t.level < 3) doCmd({ type: 'upgrade', id: t.id }); return; }
      if (k === 's' || k === 'S') { const info = game.towerInfo(t.id); if (info.canSell) confirmSell(t, info.sellValue); }
    }
  }

  /** 고른 탑이 분기를 고를 수 있는 단계면 1 = A, 2 = B (확인 창은 Enter로 확정). 분기 키로 썼으면 true */
  function branchKey(k) {
    if (!sel || sel.kind !== 'tower') return false;
    const t = game.state.towers.find((q) => q.id === sel.id);
    if (!t) return false;
    const n = game.towerInfo(t.id).next.find((x) => x.type !== 'upgrade' && x.branch === (k === '1' ? 'A' : 'B'));
    if (!n || n.locked) return false; // 분기가 아직 잠겼으면 숫자 키는 탑 고르기
    if (t.building) UI.toast('짓는 중입니다', 'warn');
    else if (game.state.gold < n.cost) UI.toast('골드가 부족합니다', 'warn');
    else confirmBranch(t, n);
    return true;
  }

  function togglePause() {
    paused = !paused;
    UI.toast(paused ? '일시정지 — 건설·강화는 할 수 있습니다' : '계속', 'info', 1200);
    updateHud(false);
  }

  /* =====================================================
   * 일시정지 메뉴
   * ===================================================== */
  function openPause() {
    if (!game) return;
    UI.sfx('click');
    const body = el('div', { class: 'pause-body' }, [
      el('p', { class: 'dim', text: `${game.def.id} ${game.def.name} · 웨이브 ${game.state.wave.index}/${isFinite(game.state.wave.total) ? game.state.wave.total : '∞'}` }),
    ]);
    UI.modal(body, {
      title: '일시정지',
      buttons: [
        { text: '설정', onClick: () => RG.ui.openSettings && RG.ui.openSettings() },
        { text: '조작법', onClick: openControls },
        { text: '다시 시작', onClick: () => UI.confirmBox('처음부터 다시 시작할까요?', () => { RG.save.remove(RG.save.KEYS.run); UI.show('game', { opts }); }) },
        { text: '지도로', onClick: () => UI.confirmBox('지도로 나갈까요? 진행 상황은 이어하기로 저장됩니다.', () => UI.show('world', {})) },
        { text: '계속하기', primary: true },
      ],
    });
  }

  const CONTROLS = [
    ['탑 누르기', '방향키 → Enter', '탑 정보 · 강화 · 분기 · 판매'],
    ['강화 버튼', 'U', '선택한 탑 강화'],
    ['분기 카드', '1 / 2', '분기 A / B (Lv3 탑을 고른 동안, 확인 창은 Enter)'],
    ['판매 버튼', 'S', '선택한 탑 판매'],
    ['전투 시작 / 다음 웨이브', 'Space', '웨이브 호출 (일찍 부르면 보너스 골드)'],
    ['영웅 누르기 → 땅 누르기', 'H → 방향키 → Enter', '영웅 이동'],
    ['기술 버튼 → 땅·적 누르기', 'Q → 방향키 → Enter', '영웅 기술'],
    ['배속 / 일시정지 버튼', 'F / P', '배속 바꾸기 / 일시정지 (멈춘 동안에도 건설 가능)'],
    ['✕ · 바깥 누르기 · 오른쪽 클릭', 'Esc', '취소 · 창 닫기 · 일시정지 메뉴'],
  ];
  /** 탑 짓기: 입력 방식마다 한 줄씩 (탑 목록 위치에 맞춘 문구) */
  function buildControls() {
    const where = dockWhere();
    return [
      ['마우스', `${where} 탑 목록에서 탑을 누르고, 맵의 빈 건설지를 누르면 지어집니다. 탑을 맵으로 끌어다 놓아도 됩니다. Shift를 누른 채 놓으면 같은 탑을 이어서 짓고, 같은 탑을 다시 누르거나 오른쪽 클릭·Esc·맵 바깥을 누르면 취소합니다.`],
      ['터치', `${where} 탑 목록에서 탑을 눌러 고른 뒤 맵의 칸을 누르거나, 탑을 맵으로 끌어다 놓으세요. 끄는 동안 탑은 손가락 바로 위 칸에 보입니다. 목록 위나 맵 밖에서 손을 떼면 취소됩니다.`],
      ['키보드', '숫자 키 1~9, 0으로 탑을 고르고(탑 카드 귀퉁이 숫자), 방향키로 칸을 옮긴 뒤 Enter로 짓습니다. Shift+Enter는 이어서 짓기, Esc는 취소.'],
    ];
  }
  function openControls() {
    const build = el('div', { class: 'controls-build' }, [
      el('div', { class: 'sec-title', text: '탑 짓기 — 탑을 먼저 고르고 맵에 놓기' }),
      ...buildControls().map(([who, text]) => el('div', { class: 'cb-row' }, [el('b', { text: who }), el('span', { text })])),
      el('p', { class: 'small dim', text: '놓기 전에 사거리, 생길 공명, 지을 수 있는지(초록·빨강)가 미리 보입니다. 일시정지 중에도 지을 수 있습니다.' }),
    ]);
    const t = el('table', { class: 'controls-table' }, [
      el('tr', {}, [el('th', { text: '마우스 · 터치' }), el('th', { text: '키보드' }), el('th', { text: '하는 일' })]),
      ...CONTROLS.map(([m, k, w]) => el('tr', {}, [el('td', { text: m }), el('td', {}, [el('kbd', { text: k })]), el('td', { class: 'dim', text: w })])),
    ]);
    UI.modal(el('div', { class: 'controls-body' }, [build, el('div', { class: 'sec-title', text: '그 밖의 조작' }), t, el('p', { class: 'small dim', text: '휴대폰에서는 적을 길게 누르면 정보가 나옵니다.' })]), { title: '조작법', buttons: [{ text: '닫기', primary: true }] });
  }

  function saveRun() {
    if (!game || game.state.result) return;
    RG.save.set(RG.save.KEYS.run, { opts, log: game.log, tick: game.state.tick, mapId: game.def.id, wave: game.state.wave.index, savedAt: Date.now() });
  }

  /* =====================================================
   * 끝
   * ===================================================== */
  /** 진행 기록을 남기고 결과 화면에 넘길 내용을 돌려줌 */
  function finish() {
    if (!game || !game.state.result) return null;
    const st = game.state;
    const rec = RG.progress.record(game.def.id, opts.mode, st);
    const stats = {
      damage: st.stats.damageByTower, kills: st.stats.kills, gold: st.stats.goldEarned, heroDamage: st.stats.heroDamage,
      towers: st.towers.map((t) => ({ id: t.id, type: t.type, level: t.level, branch: t.branch })), time: st.time,
    };
    return { mapId: game.def.id, mode: opts.mode, result: st.result, lives: st.lives, maxLives: st.maxLives, task: st.task, rec, stats, opts, waves: st.wave.index, timeout: st.timeout };
  }

  /* =====================================================
   * 튜토리얼 팁
   * ===================================================== */
  /** 이 팁이 설명하는 탑 */
  const TIP_TOWER = { barracks: 'stone_barracks', mine: 'crystal_mine', shred: 'quake_hammer', forge: 'forge', beam: 'sun_lens', support: 'sanctuary' };
  const TIPS = {
    build: { title: '탑 짓기', text: () => `${dockWhere()} 탑 목록에서 탑을 누른 뒤 맵의 빈 건설지를 누르면 지어집니다. 탑을 맵으로 끌어다 놓아도 돼요. 놓기 전에 사거리와 공명 미리보기가 보이고, 지을 수 없는 칸은 빨갛게 보입니다. 키보드는 숫자 키로 고르고 방향키·Enter로 놓아요. 일시정지 중에도 지을 수 있어요.` },
    callWave: { title: '웨이브 호출', text: '준비가 되면 왼쪽의 "전투 시작"(Space)을 누르세요. 다음 웨이브를 일찍 부르면 남은 시간만큼 보너스 골드를 받습니다.' },
    barracks: { title: '바위 병영', text: '병영의 돌 병사는 길 위에서 적을 붙잡아 멈춰 세웁니다. 병영을 누르면 집결지를 옮길 수 있어요.' },
    resonance: { title: '공명', text: '서로 이웃한(대각선 포함) 탑은 공명합니다. 불과 얼음이면 "증기 폭발", 불과 불이면 "순수 공명"처럼 짝에 따라 효과가 다릅니다. 여러 원소를 섞을수록 강해져요.' },
    flying: { title: '비행 적', text: '까마귀 같은 비행 적은 지상 적과 같은 길을 따라 날아옵니다. 병사가 붙잡을 수 없고, 박격포처럼 땅만 치는 탑은 맞히지 못해요. 공중을 칠 수 있는 탑을 길가에 두세요.' },
    affinity: { title: '원소 친화', text: '적마다 강하거나 약한 원소가 있습니다. 적을 누르면 친화를 볼 수 있어요. 허수아비는 불에 약합니다!' },
    armor: { title: '갑옷', text: '녹슨 기사는 갑옷이 피해를 줄입니다. 한 방이 큰 박격포나, 병사로 붙잡아 오래 때리는 방법이 좋아요.' },
    maze: { title: '길 만들기', text: '연한 풀밭(공터)에도 탑을 지을 수 있고, 지으면 적이 돌아갑니다. 길을 길게 만들수록 더 오래 때릴 수 있어요. 단, 길을 완전히 막을 수는 없습니다.' },
    mine: { title: '수정 광산', text: '광산은 웨이브가 시작될 때마다 골드를 줍니다. 일찍 지을수록 이득이지만, 그만큼 지금 쓸 화력이 줄어요. 광산은 공명하지 않습니다.' },
    regen: { title: '재생', text: '덩굴 거머리는 2초 동안 안 맞으면 빠르게 회복합니다. 화상처럼 끊김 없이 때리는 공격이 좋아요.' },
    split: { title: '분열', text: '포자 주머니는 죽으면 작은 포자 새끼 셋으로 갈라집니다. 터지는 곳 뒤쪽에도 화력을 두세요.' },
    branch: { title: '분기 강화', text: 'Lv3 탑은 두 갈래 중 하나로 분기할 수 있습니다. 탑을 누르고 분기 카드를 고르세요. 한 번 고르면 바꿀 수 없으니, 그 맵의 적을 보고 정하세요.' },
    shred: { title: '갑옷 파쇄', text: '얼음 거북은 갑옷이 아주 두껍습니다. 대지 망치는 주변 적의 갑옷을 깎아, 다른 모든 탑의 피해를 늘려 줍니다.' },
    healer: { title: '치유사', text: '설인 주술사는 주변 적을 치유합니다. 표적을 "강한 적"으로 바꿔 먼저 잡거나, 겨울 종을 "정적의 종"으로 분기해 치유를 막으세요.' },
    forge: { title: '대장간', text: '대장간은 이웃 탑의 피해를 높입니다. 여러 원소의 탑으로 둘러쌀수록 대장간의 효과(공명 증폭)도 커집니다.' },
    stealth: { title: '숨은 적', text: '서리 망령은 탐지 범위 밖에서는 표적이 될 수 없습니다. 성소의 빛, 영웅 세라, 그리고 폭발·파동·관통 같은 범위 공격으로 대응하세요. 병사는 붙잡아 공격할 수 있습니다.' },
    shield: { title: '보호막', text: '얼음 방패병의 보호막은 잠시 안 맞으면 다시 찹니다. 끊김 없이 때리거나, 한 방이 큰 공격(빙창 쇠뇌), 얼음 송곳탑으로 깨세요.' },
    immune: { title: '면역', text: '불도마뱀은 불에 면역입니다. 탑은 자기 원소에 면역인 적을 표적으로 삼지 않으니, 얼음·폭풍 탑을 섞어 두세요.' },
    burrow: { title: '굴착', text: '모래 굴착충은 주기적으로 땅속에 숨어 어떤 피해도 받지 않습니다. 길 전체에 고루 탑을 두거나, 그림자 덫(땅에서 나오는 순간에도 걸림)을 쓰세요.' },
    beam: { title: '햇살 렌즈', text: '햇살 렌즈는 한 적을 오래 비출수록 피해가 커집니다. 표적을 "강한 적"으로 바꾸면 체력 높은 적을 끝까지 비춥니다.' },
    ranged: { title: '원거리 적', text: '협곡 투석병은 걸으면서 영웅과 병사에게 돌을 던집니다. 영웅을 사거리 밖에 두거나, 광휘 탑의 실명으로 막으세요.' },
    shock: { title: '마비 폭발', text: '번개 해파리는 죽을 때 터지며 주변 탑을 잠시 멈춥니다. 사거리 긴 탑으로 탑 무리에서 먼 곳에서 잡으세요.' },
    undying: { title: '부활', text: '익사한 해적은 처음 쓰러지면 다시 일어납니다. 길 뒤쪽까지 화력을 이어 두거나, 파멸 첨탑으로 처형하세요.' },
    silence: { title: '침묵', text: '침묵 수도사 근처의 탑은 공격·지원·공명을 모두 멈춥니다. 사거리 긴 탑으로 멀리서 잡거나, 병영으로 붙잡아 한곳에 묶어 두세요.' },
    adaptive: { title: '적응', text: '종 조각 골렘은 같은 원소에 계속 맞으면 그 원소에 강해집니다. 여러 원소의 탑을 섞어 두면 저항이 계속 초기화됩니다.' },
    dampen: { title: '공명 차단', text: '울림 포식자 주변의 탑은 공명이 끊깁니다. 공명 없이도 버틸 기본 화력을 갖추고, 먼저 잡으세요.' },
    support: { title: '지원 탑', text: '성소는 직접 공격하지 않지만 이웃 탑의 사거리를 늘리고 숨은 적을 드러내며 병사를 치료합니다. 지원 탑은 공명할수록 효과가 커집니다.' },
  };
  function nextTip() {
    if (!game || !tipsQueue.length || UI.currentId() !== 'game') return;
    const id = tipsQueue.shift();
    const tip = TIPS[id];
    RG.progress.markSeen('tips', id);
    UI.modal(el('p', { class: 'modal-text', text: typeof tip.text === 'function' ? tip.text() : tip.text }), {
      title: `💡 ${tip.title}`,
      className: 'tip-modal',
      buttons: [{ text: tipsQueue.length ? '다음' : '알겠어요', primary: true, onClick: () => { if (id === 'build') dockAttention(); setTimeout(nextTip, 200); } }],
    });
  }

  UI.register('game', { enter, leave });
  RG.ui.game = {
    get game() { return game; },
    /** 놓기 모드 상태 (시험용): { type, c, r, ok } 또는 null */
    get placing() { return pick ? { type: pick.type, c: pick.c, r: pick.r, ok: !!(pick.res && pick.res.ok) } : null; },
    doCmd, banner, setSpeed: (n) => { speed = Math.max(1, Math.min(8, n)); },
  };
})();
