'use strict';

/* =========================================================
 * 화면 — 타이틀, 월드 지도, 출정 준비, 결과, 설정
 * ========================================================= */
(() => {
  const { el, escapeHtml: esc, round } = RG.util;
  const UI = RG.ui;
  const D = () => RG.data;
  const P = () => RG.progress;

  /* =====================================================
   * 타이틀
   * ===================================================== */
  UI.register('title', {
    enter(sec) {
      UI.music('title');
      sec.innerHTML = '';
      const run = RG.save.get(RG.save.KEYS.run, null);
      const has = P().hasSave() || !!run;
      const bg = el('div', { class: 'title-bg' }, [UI.svgImg(RG.art.regionBanner ? RG.art.regionBanner(1) : RG.art.icon('light'), 'title-banner')]);
      const logo = el('div', { class: 'logo' }, [
        el('div', { class: 'logo-orbs' }, D().elementOrder.map((e) => UI.icon(e, 'logo-orb'))),
        el('h1', { text: '공명 수호대' }),
        el('p', { class: 'logo-sub', text: '여섯 원소의 울림으로 등불을 지켜라' }),
      ]);
      const menu = el('div', { class: 'title-menu' });
      const go = (fn) => () => { try { if (RG.audio) RG.audio.init(); } catch (e) { /* 무시 */ } UI.sfx('click'); fn(); };
      if (run && D().maps.concat(D().endless).some((m) => m.id === run.mapId)) {
        menu.appendChild(el('button', { class: 'btn btn-primary btn-big', onclick: go(() => UI.show('game', { resume: run })) }, [`이어하기 — ${run.mapId} 웨이브 ${run.wave}`]));
      }
      menu.appendChild(el('button', { class: `btn btn-big ${run ? '' : 'btn-primary'}`, onclick: go(() => UI.show('world', {})) }, [has ? '월드 지도' : '시작하기']));
      menu.appendChild(el('div', { class: 'title-row' }, [
        el('button', { class: 'btn', onclick: go(() => UI.show('heroes', {})) }, ['수호대']),
        el('button', { class: 'btn', onclick: go(() => UI.show('codex', {})) }, ['도감']),
        el('button', { class: 'btn', onclick: go(() => openSettings()) }, ['설정']),
        el('button', { class: 'btn', onclick: go(() => credits()) }, ['만든 이']),
      ]));
      if (has) menu.appendChild(el('button', { class: 'btn btn-ghost small', onclick: go(() => UI.confirmBox('모든 진행 상황(별, 기술 나무, 도감)을 지우고 처음부터 시작할까요?', () => { P().reset(); RG.save.remove(RG.save.KEYS.run); UI.show('title', {}); }, { danger: true, yes: '처음부터' })) }, ['처음부터 다시']));
      sec.append(bg, el('div', { class: 'title-wrap' }, [logo, menu]), el('div', { class: 'title-foot', text: '설치 없이 브라우저에서 · 그림과 소리는 모두 코드로 만들었습니다' }));
    },
  });

  function credits() {
    UI.modal(el('div', { class: 'credits' }, [
      el('p', { text: '공명 수호대 (Resonance Guard)' }),
      el('p', { class: 'dim', text: '기획·프로그램·그림·소리: Claude와 사용자의 공동 작업' }),
      el('p', { class: 'dim', text: '모든 그림은 SVG 코드로, 모든 소리는 WebAudio로 실시간 합성했습니다. 외부 파일을 쓰지 않습니다.' }),
    ]), { title: '만든 이', buttons: [{ text: '닫기', primary: true }] });
  }

  /* =====================================================
   * 설정
   * ===================================================== */
  function openSettings() {
    const s = UI.getSettings();
    const body = el('div', { class: 'settings' });
    const slider = (key, label) => {
      const input = el('input', { type: 'range', min: '0', max: '1', step: '0.05', value: String(s[key]) });
      input.addEventListener('input', () => UI.setSettings({ [key]: +input.value }));
      return el('label', { class: 'set-row' }, [el('span', { text: label }), input]);
    };
    const toggle = (key, label) => {
      const input = el('input', { type: 'checkbox' });
      input.checked = !!s[key];
      input.addEventListener('change', () => UI.setSettings({ [key]: input.checked }));
      return el('label', { class: 'set-row' }, [el('span', { text: label }), input]);
    };
    body.append(
      slider('master', '전체 음량'), slider('sfx', '효과음'), slider('music', '음악'),
      toggle('muted', '소리 끄기'), toggle('shake', '화면 흔들림'), toggle('numbers', '피해 숫자'), toggle('paths', '준비 중 길 미리보기'), toggle('bigText', '큰 글씨'),
    );
    UI.modal(body, { title: '설정', buttons: [{ text: '닫기', primary: true }] });
  }
  RG.ui.openSettings = openSettings;

  /* =====================================================
   * 월드 지도
   * ===================================================== */
  let worldRegion = null;
  UI.register('world', {
    enter(sec, data) {
      UI.music('worldmap');
      sec.innerHTML = '';
      const front = P().frontier();
      const frontMap = D().maps.find((m) => m.id === front);
      if (data.region) worldRegion = data.region;
      if (!worldRegion) worldRegion = frontMap ? frontMap.region : 1;
      const head = el('header', { class: 'top-bar' }, [
        el('button', { class: 'icon-btn', title: '타이틀', onclick: () => UI.show('title', {}) }, [UI.icon('back')]),
        el('h2', { text: '월드 지도' }),
        el('div', { class: 'top-stars' }, [UI.icon('star'), el('b', { text: String(P().starsTotal()) }), el('small', { text: ' / 150' })]),
        el('div', { class: 'top-actions' }, [
          el('button', { class: 'btn small', onclick: () => UI.show('tree', {}) }, [UI.icon('tree', 'tiny'), `기술 나무${P().starsFree() > 0 ? ` (${P().starsFree()})` : ''}`]),
          el('button', { class: 'btn small', onclick: () => UI.show('heroes', {}) }, [UI.icon('hero', 'tiny'), '수호대']),
          el('button', { class: 'btn small', onclick: () => UI.show('codex', {}) }, [UI.icon('book', 'tiny'), '도감']),
          el('button', { class: 'icon-btn', title: '설정', onclick: openSettings }, [UI.icon('settings')]),
        ]),
      ]);
      const tabs = el('nav', { class: 'region-tabs' });
      for (const reg of D().regions) {
        const maps = D().maps.filter((m) => m.region === reg.id);
        const open = maps.length && P().mapUnlocked(maps[0].id);
        const got = maps.reduce((s, m) => s + P().mapStars(m.id), 0);
        tabs.appendChild(el('button', {
          class: `region-tab ${reg.id === worldRegion ? 'on' : ''} ${open ? '' : 'locked'}`,
          onclick: () => { if (!open) { UI.toast(maps.length ? '앞 지역을 먼저 지켜 내야 합니다' : '아직 갈 수 없는 지역입니다', 'warn'); return; } worldRegion = reg.id; UI.sfx('click'); UI.show('world', {}); },
        }, [el('b', { text: `${reg.id}. ${reg.name}` }), el('small', { text: maps.length ? `★ ${got}/${maps.length * 5}` : '잠김' })]));
      }
      const reg = D().regions.find((r) => r.id === worldRegion);
      const maps = D().maps.filter((m) => m.region === worldRegion);
      const board = el('div', { class: `region-board theme-${reg.theme}` });
      board.appendChild(UI.svgImg(RG.art.regionBanner ? RG.art.regionBanner(reg.id) : '', 'region-banner'));
      board.appendChild(el('div', { class: 'region-desc' }, [el('h3', { text: reg.name }), el('p', { text: reg.desc })]));
      const nodes = el('div', { class: 'map-nodes' });
      maps.forEach((m, i) => {
        const open = P().mapUnlocked(m.id);
        const rec = P().mapRec(m.id);
        const node = el('button', {
          class: `map-node ${open ? '' : 'locked'} ${rec.cleared ? 'cleared' : ''} ${m.id === front ? 'frontier' : ''} ${m.boss ? 'boss' : ''}`,
          onclick: () => { if (!open) { UI.toast('앞 맵을 먼저 지켜 내야 합니다', 'warn'); return; } UI.sfx('click'); UI.show('brief', { mapId: m.id }); },
        }, [
          el('span', { class: 'mn-id', text: m.id }),
          el('span', { class: 'mn-name', text: m.name }),
          open ? UI.stars(rec.stars || 0, 3, 'mn-stars') : UI.icon('lock', 'mn-lock'),
          open ? el('span', { class: 'mn-extra' }, [rec.task ? '공명 ✓' : '', rec.challenge ? ' 도전 ✓' : '']) : null,
          m.boss ? el('span', { class: 'mn-boss', text: '👑' }) : null,
        ]);
        node.style.setProperty('--i', i);
        nodes.appendChild(node);
      });
      if (!maps.length) nodes.appendChild(el('p', { class: 'dim', text: '이 지역은 아직 준비 중입니다.' }));
      // 무한 맵
      const endless = (D().endless || []).filter((e) => e.region === worldRegion);
      for (const e of endless) {
        const open = P().mapUnlocked(e.id);
        nodes.appendChild(el('button', { class: `map-node endless ${open ? '' : 'locked'}`, onclick: () => { if (!open) { UI.toast('지역 보스를 쓰러뜨리면 열립니다', 'warn'); return; } UI.show('brief', { mapId: e.id }); } }, [
          el('span', { class: 'mn-id', text: '∞' }), el('span', { class: 'mn-name', text: e.name }), el('span', { class: 'mn-extra', text: open ? `최고 ${P().get().endless[e.id] || 0}웨이브` : '잠김' }),
        ]));
      }
      board.appendChild(nodes);
      sec.append(head, tabs, board);
    },
  });

  /* =====================================================
   * 출정 준비
   * ===================================================== */
  UI.register('brief', {
    enter(sec, data) {
      sec.innerHTML = '';
      const def = D().maps.find((m) => m.id === data.mapId) || D().endless.find((m) => m.id === data.mapId);
      const isEndless = !D().maps.includes(def);
      const rec = P().mapRec(def.id);
      let mode = data.mode || (isEndless ? 'endless' : 'normal');
      const heroes = P().heroesFor(def.id);
      let hero = data.hero || (heroes.includes(P().get().lastHero) ? P().get().lastHero : (def.hero && heroes.includes(def.hero) ? def.hero : heroes[0]));
      if (def.hero && !RG.progress.mapRec(def.id).cleared && heroes.includes(def.hero) && !data.hero) hero = def.hero;
      // 도전은 "그 시점까지 해금된 탑 전부"(§11.3): 이 맵과 지금까지 연 맵 중 더 뒤쪽 기준
      const later = P().mapIndex(P().frontier()) > P().mapIndex(def.id) ? P().frontier() : def.id;
      const towers = P().towersFor(mode === 'challenge' && !isEndless ? later : def.id);
      // "붙잡기 없이" 도전에서 근접 영웅이 골라져 있으면 근접 아닌 영웅으로 바꿈 (영웅이 조용히 빠지지 않게)
      if (mode === 'challenge' && def.challenge && def.challenge.type === 'noBlock' && hero && D().heroes[hero].melee) {
        hero = heroes.find((h) => !D().heroes[h].melee) || null;
      }
      const pm = RG.grid.parseMap(def);

      const head = el('header', { class: 'top-bar' }, [
        el('button', { class: 'icon-btn', title: '지도', onclick: () => UI.show('world', {}) }, [UI.icon('back')]),
        el('h2', { text: `${def.id} ${def.name}` }),
        el('span', { class: 'dim', text: D().regions[def.region - 1].name }),
      ]);
      const preview = el('div', { class: 'brief-preview' }, [UI.svgImg(RG.art.mapBackground ? RG.art.mapBackground(pm) : RG.art.icon('map'), 'brief-map')]);
      // 입구·등불 표시
      const marks = el('div', { class: 'brief-marks' });
      const mk = (c, r, cls, text) => { const m = el('span', { class: `bm ${cls}`, text }); m.style.left = `${((c + 0.5) / pm.cols) * 100}%`; m.style.top = `${((r + 0.5) / pm.rows) * 100}%`; marks.appendChild(m); };
      for (const s of pm.spawns) mk(s.c, s.r, 'bm-spawn', '입구');
      for (const s of pm.airSpawns) mk(s.c, s.r, 'bm-air', '하늘');
      mk(pm.lantern.c, pm.lantern.r, 'bm-lantern', '등불');
      preview.appendChild(marks);

      const waves = def.waves ? def.waves.length : 0;
      const info = el('div', { class: 'brief-info' }, [
        el('div', { class: 'brief-facts' }, [
          fact('wave', '웨이브', isEndless ? '끝없음' : String(waves)),
          fact('gold', '시작 골드', String(def.startGold)),
          fact('map', '종류', ({ fixed: '고정 길', maze: '길 만들기', mixed: '혼합' })[def.type] || def.type),
          isEndless ? fact('star', '최고 기록', `${P().get().endless[def.id] || 0}웨이브`) : fact('star', '별', `${P().mapStars(def.id)}/5`),
        ]),
      ]);
      // 모드
      const modes = el('div', { class: 'mode-tabs' });
      const addMode = (id, label, enabled, why) => {
        modes.appendChild(el('button', { class: `mode-tab ${mode === id ? 'on' : ''} ${enabled ? '' : 'locked'}`, onclick: () => { if (!enabled) { UI.toast(why, 'warn'); return; } UI.show('brief', { mapId: def.id, mode: id, hero }); } }, [label]));
      };
      if (!isEndless) {
        addMode('normal', '캠페인', true);
        addMode('challenge', '도전', !!rec.cleared, '캠페인을 먼저 클리어하세요');
      } else addMode('endless', '무한', true);
      info.appendChild(modes);
      if (mode === 'normal' && def.task) info.appendChild(el('div', { class: `brief-goal ${rec.task ? 'done' : ''}` }, [el('b', { text: '공명 과제' }), el('span', { text: def.task.text }), rec.task ? el('em', { text: ' ✓ 달성' }) : null]));
      if (mode === 'challenge' && def.challenge) info.appendChild(el('div', { class: `brief-goal challenge ${rec.challenge ? 'done' : ''}` }, [el('b', { text: '도전 규칙' }), el('span', { text: def.challenge.text }), el('small', { class: 'dim', text: ' · 기술 나무 효과 없음' }), rec.challenge ? el('em', { text: ' ✓ 클리어' }) : null]));

      // 영웅
      const heroRow = el('div', { class: 'hero-pick' });
      const noHero = mode === 'challenge' && def.challenge && def.challenge.type === 'noHero';
      if (noHero) heroRow.appendChild(el('p', { class: 'dim', text: '이 도전에서는 영웅을 데려갈 수 없습니다.' }));
      else {
        for (const h of D().heroOrder) {
          const unlocked = heroes.includes(h);
          const hd = D().heroes[h];
          const banned = mode === 'challenge' && def.challenge && def.challenge.type === 'noBlock' && hd.melee;
          heroRow.appendChild(el('button', {
            class: `hp-item ${hero === h ? 'on' : ''} ${unlocked && !banned ? '' : 'locked'}`,
            title: unlocked ? `${hd.name} — ${hd.title}` : '아직 만나지 못한 영웅',
            onclick: () => { if (!unlocked || banned) return; UI.sfx('click'); UI.show('brief', { mapId: def.id, mode, hero: h }); },
          }, [unlocked ? UI.portrait(h, hero === h ? 'happy' : 'normal', 'hp-portrait') : el('span', { class: 'hp-q', text: '?' }), el('span', { text: unlocked ? hd.name : '???' })]));
        }
      }
      const hd = hero && D().heroes[hero];
      const heroInfo = hd && !noHero ? el('p', { class: 'hero-blurb' }, [el('b', { text: `${hd.name} · ${hd.title}` }), ` — ${hd.skill.name}: ${hd.skill.desc}`]) : null;

      // 탑과 적
      const towerRow = el('div', { class: 'chip-row' });
      for (const t of towers) {
        const isNew = (def.newTowers || []).includes(t);
        const chip = el('span', { class: `t-chip ${isNew ? 'new' : ''}` }, [UI.towerImg(t, 1, null, 'mini'), isNew ? el('em', { text: 'NEW' }) : null]);
        UI.tooltipFor(chip, () => `<b>${esc(D().towers[t].name)}</b><br>${esc(D().towers[t].desc)}`);
        towerRow.appendChild(chip);
      }
      const enemyRow = el('div', { class: 'chip-row' });
      const eset = new Set();
      for (const w of RG.grid.parseWaves(def.waves || [])) for (const g of w.groups) eset.add(g.e);
      if (isEndless) for (const e of D().regionPools[def.region] || []) eset.add(e);
      for (const e of eset) {
        const isNew = (def.newEnemies || []).includes(e);
        const chip = el('span', { class: `e-chip ${isNew ? 'new' : ''}` }, [UI.enemyImg(e, 'mini'), isNew ? el('em', { text: 'NEW' }) : null]);
        UI.tooltipFor(chip, () => `<b>${esc(D().enemies[e].name)}</b><br>${esc(D().enemies[e].desc)}`);
        enemyRow.appendChild(chip);
      }
      const run = RG.save.get(RG.save.KEYS.run, null);
      const resume = run && run.mapId === def.id && run.opts.mode === mode;
      const start = () => {
        try { if (RG.audio) RG.audio.init(); } catch (e) { /* 무시 */ }
        UI.sfx('click');
        if (hero) { P().get().lastHero = hero; P().save(); }
        const opts = {
          mapId: def.id, mode, heroId: noHero ? null : hero, skills: P().get().skills.slice(),
          seed: (Math.random() * 1e9) >>> 0, towers, branches: P().branchesUnlocked(),
        };
        const go = () => UI.show('game', { opts });
        const story = def.story && def.story.before;
        if (mode === 'normal' && story && D().story[story] && !P().seen('story', story)) UI.show('story', { id: story, then: go });
        else go();
      };
      const actions = el('div', { class: 'brief-actions' }, [
        resume ? el('button', { class: 'btn', onclick: () => UI.show('game', { resume: run }) }, [`이어하기 (웨이브 ${run.wave})`]) : null,
        el('button', { class: 'btn btn-primary btn-big', onclick: start }, [resume ? '새로 시작' : '출정!']),
      ]);
      info.append(
        el('div', { class: 'sec-title', text: '영웅' }), heroRow, heroInfo,
        el('div', { class: 'sec-title', text: `쓸 수 있는 탑 (${towers.length})` }), towerRow,
        el('div', { class: 'sec-title', text: '나오는 적' }), enemyRow,
        actions,
      );
      sec.append(head, el('div', { class: 'brief-body' }, [preview, info]));
    },
  });

  function fact(icon, label, value) {
    return el('div', { class: 'fact' }, [UI.icon(icon, 'tiny'), el('span', { text: label }), el('b', { text: value })]);
  }

  /* =====================================================
   * 결과
   * ===================================================== */
  UI.register('result', {
    enter(sec, data) {
      sec.innerHTML = '';
      const win = data.result === 'win';
      UI.music(win ? 'victory' : 'defeat');
      UI.sfx(win ? 'win' : 'lose');
      const def = D().maps.find((m) => m.id === data.mapId) || D().endless.find((m) => m.id === data.mapId);
      const box = el('div', { class: `result-box ${win ? 'win' : 'lose'}` });
      const hero = data.opts.heroId;
      if (hero) box.appendChild(UI.portrait(hero, win ? 'happy' : 'worried', 'result-portrait'));
      box.appendChild(el('h2', { text: data.mode === 'endless' ? `${data.waves}웨이브까지 버텼다!` : win ? '등불을 지켜 냈다!' : data.timeout ? '시간이 너무 오래 걸렸다…' : '등불이 꺼졌다…' }));
      box.appendChild(el('p', { class: 'dim', text: `${def.id} ${def.name} · ${data.mode === 'challenge' ? `도전 (${def.challenge.text})` : data.mode === 'endless' ? '무한' : '캠페인'}` }));
      if (win && data.mode === 'normal') {
        const s = el('div', { class: 'result-stars' });
        for (let i = 0; i < 3; i++) {
          const star = UI.icon(i < data.rec.stars ? 'star' : 'star_empty', 'big-star');
          star.style.animationDelay = `${0.25 + i * 0.3}s`;
          s.appendChild(star);
          if (i < data.rec.stars) setTimeout(() => UI.sfx('star'), 300 + i * 300);
        }
        box.appendChild(s);
        box.appendChild(el('p', { text: `남은 등불 불꽃 ${data.lives}/${data.maxLives}` }));
        if (data.task) box.appendChild(el('p', { class: data.task.done ? 'good' : 'dim', text: `공명 과제 "${def.task.text}" ${data.task.done ? '달성!' : '미달성'}` }));
      }
      if (win && data.mode === 'challenge') box.appendChild(el('p', { class: 'good', text: '도전 클리어! ★+1' }));
      if (data.rec.newStars > 0) box.appendChild(el('p', { class: 'good', text: `새로 얻은 별 ★${data.rec.newStars} — 기술 나무에서 쓸 수 있습니다` }));
      // 해금
      const un = data.rec.unlocks;
      if (un && (un.towers.length || un.heroes.length || un.branches)) {
        const ul = el('div', { class: 'unlocks' });
        for (const t of un.towers) ul.appendChild(el('div', { class: 'unlock' }, [UI.towerImg(t, 1, null, 'mini'), el('span', { text: `새 탑: ${D().towers[t].name}` })]));
        for (const h of un.heroes) ul.appendChild(el('div', { class: 'unlock' }, [UI.portrait(h, 'happy', 'mini-portrait'), el('span', { text: `새 영웅: ${D().heroes[h].name}` })]));
        if (un.branches) ul.appendChild(el('div', { class: 'unlock' }, [UI.icon('upgrade', 'small'), el('span', { text: '분기 강화(Lv4)가 열렸습니다!' })]));
        box.appendChild(ul);
        setTimeout(() => UI.sfx('unlock'), 1300);
      }
      // 통계
      const dmg = Object.entries(data.stats.damage || {}).map(([id, v]) => [data.stats.towers.find((t) => String(t.id) === id), v]).filter(([t]) => t).sort((a, b) => b[1] - a[1]).slice(0, 6);
      const total = dmg.reduce((s, [, v]) => s + v, 0) + (data.stats.heroDamage || 0) || 1;
      const st = el('div', { class: 'result-stats' });
      st.appendChild(el('div', { class: 'sec-title', text: `처치 ${data.stats.kills} · 번 골드 ${Math.round(data.stats.gold)} · ${Math.floor(data.stats.time / 60)}분 ${Math.floor(data.stats.time % 60)}초` }));
      for (const [t, v] of dmg) {
        const name = t.level >= 4 ? D().towers[t.type].branches[t.branch].name : `${D().towers[t.type].name} Lv${t.level}`;
        st.appendChild(el('div', { class: 'dmg-row' }, [UI.towerImg(t.type, t.level, t.branch, 'mini'), el('span', { text: name }), el('div', { class: 'dmg-bar' }, [el('i', { style: { width: `${(v / total) * 100}%`, background: D().elements[D().towers[t.type].element].color } })]), el('b', { text: Math.round(v).toLocaleString() })]));
      }
      if (data.stats.heroDamage) st.appendChild(el('div', { class: 'dmg-row' }, [UI.portrait(hero, 'normal', 'mini-portrait'), el('span', { text: D().heroes[hero].name }), el('div', { class: 'dmg-bar' }, [el('i', { style: { width: `${(data.stats.heroDamage / total) * 100}%`, background: '#fff' } })]), el('b', { text: Math.round(data.stats.heroDamage).toLocaleString() })]));
      box.appendChild(st);
      // 버튼
      const next = P().nextMapId(def.id);
      const after = win && data.mode === 'normal' && def.story && def.story.after;
      const afterStory = after && D().story[after] && !P().seen('story', after);
      const goWorld = () => UI.show('world', {});
      const btns = el('div', { class: 'result-buttons' }, [
        el('button', { class: 'btn', onclick: () => UI.show('brief', { mapId: def.id, mode: data.mode, hero }) }, ['다시 하기']),
        el('button', { class: 'btn', onclick: () => (afterStory ? UI.show('story', { id: after, then: goWorld }) : goWorld()) }, ['월드 지도']),
        win && next && data.mode === 'normal' ? el('button', { class: 'btn btn-primary', onclick: () => { const go = () => UI.show('brief', { mapId: next }); if (afterStory) UI.show('story', { id: after, then: go }); else go(); } }, ['다음 맵 ▶']) : null,
      ]);
      box.appendChild(btns);
      sec.appendChild(box);
    },
  });
})();
