'use strict';

/* =========================================================
 * 전투 화면 — 입력, 양옆 정보 띠, 건설 메뉴, 정보 창, 영웅, 루프
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
  let sel = null;            // { kind:'tower'|'enemy'|'build', id, c, r }
  let placing = null;        // 건설 미리보기 { type, c, r }
  let skillAim = null;
  let hudT = 0;
  let beamT = 0;
  let saveT = 0;
  let bossTrackOn = false;
  let tipsQueue = [];
  const R = {};              // DOM 참조

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
    sel = null; placing = null; skillAim = null; bossTrackOn = false;
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
    RG.render.attach(canvas, game);
    Object.assign(RG.render.overlay, { hover: null, selectedTower: null, ghost: null, selectedEnemy: null, heroSelected: false, skill: null, rally: null });
    root.classList.add('loading');
    RG.art.sprites.prepareForGame(game).then(() => { root.classList.remove('loading'); });
    const region = D().regions.find((r) => r.id === game.def.region);
    UI.music(region ? region.music : 'meadow');
    window.addEventListener('resize', onResize);
    document.addEventListener('keydown', onKey);
    last = performance.now();
    raf = requestAnimationFrame(loop);
    updateHud(true);
    // 튜토리얼 팁
    tipsQueue = (game.def.tips || []).filter((t) => !RG.progress.seen('tips', t) && TIPS[t]);
    if (!data.resume && opts.mode === 'normal') setTimeout(nextTip, 600);
    if (!data.resume) banner(`${game.def.id} ${game.def.name}`, opts.mode === 'challenge' ? `도전: ${game.def.challenge.text}` : opts.mode === 'endless' ? '무한 모드' : '준비가 되면 웨이브를 호출하세요');
  }

  function leave() {
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', onResize);
    document.removeEventListener('keydown', onKey);
    if (game && !game.state.result) saveRun();
    RG.render.detach();
    game = null;
  }

  function onResize() { RG.render.resize(); positionPopover(); }

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
    R.over = el('div', { class: 'stage-over' });
    R.boss = el('div', { class: 'boss-bar hidden' }, [el('span', { class: 'boss-name' }), el('div', { class: 'boss-hp' }, [el('i')])]);
    R.banner = el('div', { class: 'banner' });
    R.loading = el('div', { class: 'stage-loading', text: '그림 준비 중…' });
    stage.append(canvas, R.over, R.boss, R.banner, R.loading);

    const right = el('aside', { class: 'rail rail-right' });
    R.heroCard = el('div', { class: 'hero-card' });
    R.skill = el('button', { class: 'skill-btn', title: '영웅 기술 (Q)', onclick: () => startSkill() });
    R.info = el('div', { class: 'info-panel hidden' });
    right.append(R.heroCard, R.skill, R.info);

    root.append(el('div', { class: 'game-layout' }, [left, stage, right]));
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
      setTimeout(() => finish(), st.result === 'win' ? 1400 : 900);
    }
  }

  function handleEvents(events) {
    RG.fx.onEvents(events, game);
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
      banner(`👑 ${ed.name}`, ed.desc);
      if (!bossTrackOn) { UI.music('boss'); bossTrackOn = true; }
    }
    if (!RG.progress.seen('enemies', e.enemyType)) {
      RG.progress.markSeen('enemies', e.enemyType);
      if (!ed.minion && !ed.boss) UI.toast(`새 적: ${ed.name} — ${ed.desc}`, 'info', 3200);
    }
  }
  function onBossDown() {
    if (bossTrackOn && !game.state.enemies.some((q) => !q.dead && D().enemies[q.type].boss)) {
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
    if (sel && sel.kind === 'build') refreshBuildMenu();
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
    canvas.addEventListener('pointermove', (e) => {
      if (!game) return;
      const p = toWorld(e);
      const c = Math.floor(p.x);
      const r = Math.floor(p.y);
      const inside = c >= 0 && r >= 0 && c < game.map.cols && r < game.map.rows;
      RG.render.overlay.hover = inside ? { c, r } : null;
      if (mode === 'skill') RG.render.overlay.skillPos = p;
      if (e.pointerType === 'mouse' && inside) hoverTip(p, e);
    });
    canvas.addEventListener('pointerleave', () => { RG.render.overlay.hover = null; UI.hideTooltip(); });
    let downAt = null;
    canvas.addEventListener('pointerdown', (e) => { downAt = { x: e.clientX, y: e.clientY, t: performance.now() }; });
    canvas.addEventListener('pointerup', (e) => {
      if (!game || !downAt) return;
      const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
      const longPress = performance.now() - downAt.t > 450;
      downAt = null;
      if (moved > 14) return;
      UI.init && UI.init();
      try { if (RG.audio) RG.audio.init(); } catch (er) { /* 무시 */ }
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

  function onTap(p, longPress) {
    const st = game.state;
    const c = Math.floor(p.x);
    const r = Math.floor(p.y);
    const inside = c >= 0 && r >= 0 && c < game.map.cols && r < game.map.rows;
    if (mode === 'skill') {
      const h = st.hero;
      const hd = h && D().heroes[h.heroId];
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
    if (placing && placing.c === c && placing.r === r) { confirmBuild(); return; }
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
    // 빈 건설 칸
    const k = game.map.kinds[r * game.map.cols + c];
    if (RG.grid.isBuildKind(k)) { openBuild(c, r); return; }
    cancelAll();
    if (longPress) return;
  }

  function hoverTip(p, ev) {
    if (mode === 'skill' || mode === 'rally' || placing) { UI.hideTooltip(); return; }
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
    if (h.dead) { UI.toast('영웅이 쓰러져 있습니다', 'warn'); return; }
    if (h.skillCd > 0) { UI.toast(`기술을 ${Math.ceil(h.skillCd)}초 뒤에 쓸 수 있습니다`, 'warn'); return; }
    if (mode === 'skill') { endSkill(); return; }
    closePanels();
    const sk = D().heroes[h.heroId].skill;
    mode = 'skill';
    skillAim = sk;
    RG.render.overlay.skill = { radius: sk.radius || 0.5 };
    UI.toast(sk.target === 'enemy' ? '노릴 적을 누르세요' : sk.target === 'path' ? '벽을 세울 길을 누르세요' : '기술을 쓸 곳을 누르세요', 'info', 1400);
  }
  function endSkill() { mode = 'idle'; skillAim = null; RG.render.overlay.skill = null; }

  /* =====================================================
   * 건설 메뉴
   * ===================================================== */
  function availableTowers() {
    return (game.opts.towers || D().towerOrder).filter((t) => D().towers[t]);
  }

  function openBuild(c, r) {
    closePanels();
    sel = { kind: 'build', c, r };
    mode = 'build';
    placing = null;
    const box = el('div', { class: 'popover build-menu' });
    const head = el('div', { class: 'pop-head' }, [el('b', { text: '탑 짓기' }), el('button', { class: 'x-btn', 'aria-label': '닫기', onclick: cancelAll }, [UI.icon('close')])]);
    const grid = el('div', { class: 'build-grid' });
    R.buildItems = [];
    availableTowers().forEach((type, i) => {
      const td = D().towers[type];
      const cost = RG.stats.costOf(type, 1, null, game.meta);
      const btn = el('button', { class: `build-item el-${td.element}`, dataset: { type } }, [
        UI.towerImg(type, 1, null, 'bi-img'),
        el('span', { class: 'bi-name', text: td.name }),
        el('span', { class: 'bi-cost' }, [UI.icon('gold', 'tiny'), String(cost)]),
        i < 9 ? el('kbd', { text: String(i + 1) }) : null,
      ]);
      btn.addEventListener('click', () => choosePlacing(type));
      UI.tooltipFor(btn, () => towerTip(type));
      grid.appendChild(btn);
      R.buildItems.push(btn);
    });
    R.buildConfirm = el('div', { class: 'build-confirm hidden' });
    box.append(head, grid, R.buildConfirm);
    showPopover(box, c, r);
    refreshBuildMenu();
  }

  function refreshBuildMenu() {
    if (!sel || sel.kind !== 'build' || !R.buildItems) return;
    for (const btn of R.buildItems) {
      const res = game.canBuild(btn.dataset.type, sel.c, sel.r);
      btn.classList.toggle('disabled', !res.ok);
      btn.classList.toggle('chosen', !!(placing && placing.type === btn.dataset.type));
      btn.title = res.ok ? '' : res.reason;
    }
    if (placing) {
      const res = game.canBuild(placing.type, placing.c, placing.r);
      RG.render.overlay.ghost = { type: placing.type, c: placing.c, r: placing.r, ok: res.ok, links: game.previewLinks(placing.type, placing.c, placing.r) };
      const ok = R.buildConfirm.querySelector('.btn-build');
      if (ok) ok.disabled = !res.ok;
    }
  }

  function choosePlacing(type) {
    if (!sel || sel.kind !== 'build') return;
    if (placing && placing.type === type) { confirmBuild(); return; }
    const res = game.canBuild(type, sel.c, sel.r);
    placing = { type, c: sel.c, r: sel.r };
    UI.sfx('click');
    const td = D().towers[type];
    const links = game.previewLinks(type, sel.c, sel.r);
    const effects = [...new Map(links.map((l) => [l.res.id, l.res])).values()];
    const cost = RG.stats.costOf(type, 1, null, game.meta);
    R.buildConfirm.innerHTML = '';
    R.buildConfirm.classList.remove('hidden');
    R.buildConfirm.append(
      el('div', { class: 'bc-info' }, [
        el('b', { text: td.name }),
        el('span', { class: 'dim', text: td.desc }),
        td.noResonance ? el('span', { class: 'res-line dim', text: '공명하지 않는 탑입니다' })
          : effects.length ? el('span', { class: 'res-line' }, [el('span', { class: 'res-tag', text: '공명' }), effects.map((r) => r.name).join(', ')])
            : el('span', { class: 'res-line dim', text: '이웃한 탑이 없어 공명이 생기지 않습니다' }),
        res.ok ? null : el('span', { class: 'warn-line', text: res.reason }),
      ]),
      el('div', { class: 'bc-buttons' }, [
        el('button', { class: 'btn', text: '취소', onclick: () => { placing = null; RG.render.overlay.ghost = null; R.buildConfirm.classList.add('hidden'); refreshBuildMenu(); } }),
        el('button', { class: 'btn btn-primary btn-build', onclick: confirmBuild }, [`짓기 `, UI.icon('gold', 'tiny'), String(cost)]),
      ]),
    );
    refreshBuildMenu();
    positionPopover();
  }

  function confirmBuild() {
    if (!placing) return;
    const res = doCmd({ type: 'build', tower: placing.type, c: placing.c, r: placing.r });
    if (res.ok) {
      const t = game.state.towers.find((q) => q.id === res.id);
      placing = null;
      RG.render.overlay.ghost = null;
      closePanels();
      if (t && D().towers[t.type].role === 'barracks') { openTower(t); }
      mode = sel ? mode : 'idle';
    }
  }

  /* ---------------- 팝오버 위치 ---------------- */
  let popAnchor = null;
  function showPopover(box, c, r) {
    R.over.innerHTML = '';
    R.over.appendChild(box);
    popAnchor = { c, r };
    positionPopover();
  }
  function positionPopover() {
    const box = R.over && R.over.firstChild;
    if (!box || !popAnchor || !game) return;
    const T = RG.render.T;
    const p = RG.render.worldToScreen(popAnchor.c + 0.5, popAnchor.r + 0.5);
    const sw = R.stage.clientWidth;
    const sh = R.stage.clientHeight;
    const bw = box.offsetWidth;
    const bh = box.offsetHeight;
    let x = p.x + T * 0.8;
    if (x + bw > sw - 6) x = p.x - T * 0.8 - bw;
    if (x < 6) x = Math.max(6, (sw - bw) / 2);
    let y = p.y - bh / 2;
    y = Math.max(6, Math.min(sh - bh - 6, y));
    box.style.left = `${x}px`;
    box.style.top = `${y}px`;
  }

  function closePanels() {
    if (R.over) R.over.innerHTML = '';
    if (R.info) { R.info.classList.add('hidden'); R.info.innerHTML = ''; }
    sel = null;
    placing = null;
    popAnchor = null;
    RG.render.overlay.ghost = null;
    RG.render.overlay.selectedTower = null;
    RG.render.overlay.selectedEnemy = null;
    RG.render.overlay.rally = null;
    if (mode === 'build' || mode === 'tower' || mode === 'enemy' || mode === 'rally') mode = 'idle';
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
        el('span', { class: 'ip-sub' }, [UI.elementBadge(td.element), el('span', { text: t.level >= 4 ? ' 분기' : ` Lv${t.level}` })]),
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
    if (k === ' ' || k === 'Spacebar') { doCmd({ type: 'callWave' }); e.preventDefault(); return; }
    if (k === 'p' || k === 'P') { togglePause(); return; }
    if (k === 'f' || k === 'F') { cycleSpeed(); return; }
    if (k === 'q' || k === 'Q') { startSkill(); return; }
    if (k === 'h' || k === 'H') { selectHero(); return; }
    if (sel && sel.kind === 'build' && /^[1-9]$/.test(k)) {
      const list = availableTowers();
      const type = list[+k - 1];
      if (type) choosePlacing(type);
      return;
    }
    if (k === 'Enter' && placing) { confirmBuild(); return; }
    if (sel && sel.kind === 'tower') {
      const t = game.state.towers.find((q) => q.id === sel.id);
      if (!t) return;
      if (k === 'u' || k === 'U') { if (t.level < 3) doCmd({ type: 'upgrade', id: t.id }); return; }
      if (k === 's' || k === 'S') { const info = game.towerInfo(t.id); if (info.canSell) confirmSell(t, info.sellValue); }
    }
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
        { text: '다시 시작', onClick: () => UI.confirmBox('처음부터 다시 시작할까요?', () => { RG.save.remove(RG.save.KEYS.run); UI.show('game', { opts }); }) },
        { text: '지도로', onClick: () => UI.confirmBox('지도로 나갈까요? 진행 상황은 이어하기로 저장됩니다.', () => UI.show('world', {})) },
        { text: '계속하기', primary: true },
      ],
    });
  }

  function saveRun() {
    if (!game || game.state.result) return;
    RG.save.set(RG.save.KEYS.run, { opts, log: game.log, tick: game.state.tick, mapId: game.def.id, wave: game.state.wave.index, savedAt: Date.now() });
  }

  /* =====================================================
   * 끝
   * ===================================================== */
  function finish() {
    if (!game) return;
    const st = game.state;
    const rec = RG.progress.record(game.def.id, opts.mode, st);
    const stats = {
      damage: st.stats.damageByTower, kills: st.stats.kills, gold: st.stats.goldEarned, heroDamage: st.stats.heroDamage,
      towers: st.towers.map((t) => ({ id: t.id, type: t.type, level: t.level, branch: t.branch })), time: st.time,
    };
    UI.show('result', { mapId: game.def.id, mode: opts.mode, result: st.result, lives: st.lives, maxLives: st.maxLives, task: st.task, rec, stats, opts, waves: st.wave.index, timeout: st.timeout });
  }

  /* =====================================================
   * 튜토리얼 팁
   * ===================================================== */
  const TIPS = {
    build: { title: '탑 짓기', text: '빈 땅(건설지)을 누르면 탑 목록이 나옵니다. 탑을 고르면 사거리와 공명 미리보기가 보이고, 한 번 더 누르면 지어집니다. 일시정지 중에도 지을 수 있어요.' },
    callWave: { title: '웨이브 호출', text: '준비가 되면 왼쪽의 "전투 시작"(Space)을 누르세요. 다음 웨이브를 일찍 부르면 남은 시간만큼 보너스 골드를 받습니다.' },
    barracks: { title: '바위 병영', text: '병영의 돌 병사는 길 위에서 적을 붙잡아 멈춰 세웁니다. 병영을 누르면 집결지를 옮길 수 있어요.' },
    resonance: { title: '공명', text: '서로 이웃한(대각선 포함) 탑은 공명합니다. 불과 얼음이면 "증기 폭발", 불과 불이면 "순수 공명"처럼 짝에 따라 효과가 다릅니다. 여러 원소를 섞을수록 강해져요.' },
    flying: { title: '비행 적', text: '까마귀 같은 비행 적은 하늘 입구에서 울림등까지 곧게 날아옵니다(점선). 공중을 칠 수 있는 탑이 필요해요.' },
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
    support: { title: '지원 탑', text: '성소는 직접 공격하지 않지만 이웃 탑의 사거리를 늘리고 숨은 적을 드러내며 병사를 치료합니다. 지원 탑은 공명할수록 효과가 커집니다.' },
  };
  function nextTip() {
    if (!game || !tipsQueue.length || UI.currentId() !== 'game') return;
    const id = tipsQueue.shift();
    const tip = TIPS[id];
    RG.progress.markSeen('tips', id);
    UI.modal(el('p', { class: 'modal-text', text: tip.text }), {
      title: `💡 ${tip.title}`,
      className: 'tip-modal',
      buttons: [{ text: tipsQueue.length ? '다음' : '알겠어요', primary: true, onClick: () => setTimeout(nextTip, 200) }],
    });
  }

  UI.register('game', { enter, leave });
  RG.ui.game = { get game() { return game; }, doCmd, banner, setSpeed: (n) => { speed = Math.max(1, Math.min(8, n)); } };
})();
