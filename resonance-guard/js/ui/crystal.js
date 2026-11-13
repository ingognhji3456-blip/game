'use strict';

/* =========================================================
 * 공명석 웨이브 화면 — 설계: docs/design/crystal.md · 규칙: js/core/crystal.js · 데이터: js/data/crystal.js
 * 난이도 3단계(쉬움 500 · 보통 800 · 어려움 1200 공명석), 영웅 고르기, 시작. 가진 탑을 모두 씀.
 * 결과 화면(RG.ui.crystalResult)도 여기서: 받은 공명석, 뽑기 몇 번, 다시·뽑기·공명석 웨이브로
 * ========================================================= */
(() => {
  const { el, escapeHtml: esc } = RG.util;
  const UI = RG.ui;
  const D = () => RG.data;
  const P = () => RG.progress;
  const CD = () => RG.data.crystal;

  let pickD = 1;
  let pickHero = null;
  let backTo = null;
  let backData = null;

  /** 시작 opts (캠페인과 같은 성장: 기술 나무·뽑기 강화·조각 강화·영웅 성장, 가진 탑 모두) */
  function crystalOpts(d, heroId) {
    const opts = Object.assign({
      mode: 'normal', heroId, skills: P().get().skills.slice(), seed: (Math.random() * 1e9) >>> 0,
      towers: P().ownedTowers(), towerRanks: P().towerRanks(), finalLv2: true, shardStart: true, branches: P().branchesUnlocked(),
    }, RG.crystal.setup(d));
    const sl = P().shardLevels();
    if (sl) opts.shardLv = sl;
    const growth = heroId ? P().heroGrowth(heroId) : null;
    if (growth) opts.heroGrowth = growth;
    return opts;
  }
  RG.ui.crystalOpts = crystalOpts;

  function start(d, heroId) {
    try { if (RG.audio) RG.audio.init(); } catch (e) { /* 무시 */ }
    UI.sfx('click');
    if (heroId) { P().get().lastHero = heroId; P().save(); }
    pickD = d; pickHero = heroId;
    UI.show('game', { opts: crystalOpts(d, heroId) });
  }

  /** 들어가는 단추 (타이틀·월드 지도·뽑기 화면) — 열리기 전엔 잠김 안내 */
  function crystalButton(cls, from) {
    const open = P().crystalOpen();
    return el('button', {
      class: `${cls} btn-crystal ${open ? '' : 'locked'}`, 'aria-label': '공명석 웨이브',
      title: open ? '공명석 웨이브 — 웨이브를 막아 뽑기 재화(공명석)를 모읍니다' : P().crystalLock(1),
      onclick: () => {
        if (!open) { UI.toast(`공명석 웨이브는 ${P().crystalLock(1)}`, 'warn'); return; }
        UI.show('crystal', { back: from || UI.currentId() || 'world' });
      },
    }, [UI.icon(open ? 'crystal' : 'lock', 'tiny'), el('span', { class: 'rb-label', text: '공명석 웨이브' })]);
  }
  RG.ui.crystalButton = crystalButton;

  UI.register('crystal', {
    enter(sec, data = {}) {
      UI.music('worldmap');
      sec.innerHTML = '';
      if (data.back) { backTo = data.back; backData = data.backData || {}; }
      const back = () => { const b = backTo || 'world'; const bd = backData || {}; backTo = null; backData = null; UI.show(b, bd); };
      const g = P().gachaState();
      const head = el('header', { class: 'top-bar' }, [
        el('button', { class: 'icon-btn', title: '돌아가기', 'aria-label': '돌아가기', onclick: back }, [UI.icon('back')]),
        el('h2', {}, [UI.icon('crystal', 'tiny'), ' 공명석 웨이브']),
        el('div', { class: 'gc-wallet' }, [el('span', { class: 'gc-coin', title: '가진 공명석' }, [UI.icon('crystal'), el('b', { text: g.crystals.toLocaleString() })])]),
      ]);
      if (!P().crystalOpen()) {
        sec.append(head, el('div', { class: 'rd-locked' }, [UI.icon('lock', 'big-ico'), el('p', { text: P().crystalLock(1) })]));
        return;
      }
      // 이어할 공명석 웨이브 판이 있으면 그 난이도를 골라 둠
      const run = RG.save.get(RG.save.KEYS.run, null);
      const savedC = run && run.opts && run.opts.crystal;
      if (data.d) pickD = data.d;
      else if (!data.keep && savedC) pickD = savedC.d;
      if (P().crystalLock(pickD)) pickD = 1;
      const heroes = P().heroesFor(P().frontier());
      if (data.hero && heroes.includes(data.hero)) pickHero = data.hero;
      if (!pickHero || !heroes.includes(pickHero)) pickHero = heroes.includes(P().get().lastHero) ? P().get().lastHero : heroes[0];
      const d = pickD;
      const rerender = (patch, focus) => {
        const body = sec.querySelector('.cr-body');
        const keep = body ? body.scrollTop : 0;
        UI.show('crystal', Object.assign({ keep: true, d: pickD, hero: pickHero, focus }, patch));
        const b2 = sec.querySelector('.cr-body');
        if (b2) b2.scrollTop = keep;
      };

      // 난이도 카드
      const cards = el('div', { class: 'cr-cards', role: 'radiogroup', 'aria-label': '난이도' });
      CD().difficulty.forEach((df, i) => {
        const n = i + 1;
        const lock = P().crystalLock(n);
        const map = D().crystalMaps.find((m) => m.id === df.map);
        const pm = RG.grid.parseMap(map);
        const clears = P().crystalClears(n);
        cards.appendChild(el('button', {
          class: `cr-card ${n === d ? 'on' : ''} ${lock ? 'locked' : ''}`, role: 'radio', 'aria-checked': n === d ? 'true' : 'false',
          'aria-disabled': lock ? 'true' : null, 'data-focus': `d-${n}`, title: lock || `${df.name} · ${map.name}`,
          onclick: () => { if (lock) { UI.toast(lock, 'warn'); return; } UI.sfx('click'); rerender({ d: n }, `d-${n}`); },
        }, [
          el('span', { class: 'cr-map' }, [UI.svgImg(RG.art.mapBackground ? RG.art.mapBackground(pm) : RG.art.icon('map'), 'cr-map-img', '')]),
          el('b', { class: 'cr-name', text: df.name }),
          el('span', { class: 'cr-sub', text: `${map.name} · 웨이브 ${df.waves}` }),
          el('span', { class: 'cr-reward' }, [UI.icon('crystal', 'tiny'), el('b', { text: `${df.reward.toLocaleString()}` })]),
          lock ? el('small', { class: 'dim cr-lock' }, [UI.icon('lock', 'tiny'), ` ${lock}`]) : el('small', { class: clears ? 'good' : 'dim', text: clears ? `${clears}번 깸` : '아직 안 깸' }),
        ]));
      });
      const df = CD().difficulty[d - 1];

      // 영웅
      const heroRow = el('div', { class: 'hero-pick' });
      for (const h of heroes) {
        const hd = D().heroes[h];
        heroRow.appendChild(el('button', {
          class: `hp-item ${pickHero === h ? 'on' : ''}`, title: `${hd.name} — ${hd.title}`, 'data-focus': `h-${h}`,
          onclick: () => { UI.sfx('click'); rerender({ hero: h }, `h-${h}`); },
        }, [UI.portrait(h, pickHero === h ? 'happy' : 'normal', 'hp-portrait'), el('span', { text: hd.name })]));
      }
      // 적
      const enemyRow = el('div', { class: 'chip-row' });
      for (const e of RG.crystal.pool(d)) {
        const used = RG.crystal.waves(d).some((w) => w.includes(`${e}*`));
        if (!used) continue;
        const chip = el('span', { class: 'e-chip' }, [UI.enemyImg(e, 'mini')]);
        UI.tooltipFor(chip, () => `<b>${esc(D().enemies[e].name)}</b><br>${esc(D().enemies[e].desc)}`);
        enemyRow.appendChild(chip);
      }
      const owned = P().ownedTowers().length;
      const resume = run && run.opts && run.opts.crystal && run.opts.crystal.d === d;
      const body = el('div', { class: 'cr-body' }, [
        el('p', { class: 'cr-intro', text: '웨이브를 막아 뽑기 재화(공명석)를 모읍니다. 가진 탑을 모두 쓸 수 있고, 끝까지 막으면 보상을 전부 받아요. 지더라도 막아 낸 웨이브만큼 받고, 몇 번이든 다시 할 수 있습니다.' }),
        cards,
        el('p', { class: 'rd-mapline' }, [UI.icon('crystal', 'tiny'), ` 끝까지 막으면 공명석 ${df.reward.toLocaleString()} (뽑기 ${Math.floor(df.reward / RG.gacha.COST.one)}번) · 지면 막아 낸 만큼 최대 ${Math.floor((df.reward * CD().loseShare) / 10) * 10} · 내 탑 ${owned}종 · 시작 골드 ${CD().startGold[d - 1]}`]),
        el('div', { class: 'sec-title', text: '나오는 적' }), enemyRow,
        el('div', { class: 'sec-title', text: '영웅' }), heroRow,
        el('div', { class: 'brief-actions' }, [
          resume ? el('button', { class: 'btn', 'data-autofocus': '', onclick: () => UI.show('game', { resume: run }) }, [`이어하기 (웨이브 ${run.wave})`]) : null,
          el('button', { class: 'btn btn-primary btn-big', 'data-autofocus': resume ? null : '', onclick: () => (resume ? UI.confirmBox('하던 공명석 웨이브 판을 지우고 새로 시작할까요?', () => start(d, pickHero)) : start(d, pickHero)) }, [resume ? '새로 시작' : '출발!']),
        ]),
      ]);
      sec.append(head, body);
    },
  });

  /* =====================================================
   * 결과 (result 화면이 data.crystal이면 여기로)
   * ===================================================== */
  RG.ui.crystalResult = function crystalResult(sec, data) {
    const win = data.result === 'win';
    const d = data.crystal.d;
    const df = CD().difficulty[d - 1];
    const rr = data.rec;
    const box = el('div', { class: `result-box ${win ? 'win' : 'lose'}` });
    const hero = data.opts.heroId;
    if (hero) box.appendChild(UI.portrait(hero, win ? 'happy' : 'worried', 'result-portrait'));
    box.appendChild(el('h2', { text: win ? '공명석을 지켜 냈다!' : data.timeout ? '시간이 너무 오래 걸렸다…' : '등불이 꺼졌다…' }));
    box.appendChild(el('p', { class: 'dim', text: `공명석 웨이브 · ${df.name} (${rr.cleared}/${rr.waves}웨이브 막아 냄)` }));
    const pulls = Math.floor(rr.total / RG.gacha.COST.one);
    box.appendChild(el('div', { class: 'reward-box cr-result' }, [
      el('div', { class: 'rw-total' }, [UI.icon('crystal', 'small'), el('b', { text: `+${rr.crystals.toLocaleString()}` }), el('span', { text: '공명석' })]),
      el('div', { class: 'rw-lines dim', text: win ? `끝까지 막아 낸 보상 ${df.reward.toLocaleString()}` : rr.crystals ? `막아 낸 ${rr.cleared}웨이브만큼` : '웨이브를 하나도 끝까지 막지 못했습니다' }),
      el('p', { class: pulls ? 'good' : 'dim', text: `가진 공명석 ${rr.total.toLocaleString()} · 뽑기 ${pulls}번 가능` }),
      win && rr.firstClear && d < CD().difficulty.length && !P().crystalLock(d + 1) ? el('p', { class: 'good', text: `${CD().difficulty[d].name} 난이도가 열렸습니다 (공명석 ${CD().difficulty[d].reward.toLocaleString()})` }) : null,
    ]));
    if (rr.crystals > 0) setTimeout(() => UI.sfx('star'), 500);
    const bd = rr.bond;
    if (bd && bd.gain > 0) {
      const hn = D().heroes[bd.heroId].name;
      box.appendChild(el('div', { class: 'growth-box' }, [el('div', { class: `gb-bond ${bd.levelUp ? 'up' : ''}` }, [
        UI.portrait(bd.heroId, bd.levelUp ? 'happy' : 'normal', 'mini-portrait'),
        el('span', { text: bd.levelUp ? `${hn} 인연 Lv${bd.after}! 재능 점수 +${bd.after - bd.before}` : `${hn} 인연 +${bd.gain}` }),
      ])]));
    }
    if (RG.ui.resultStats) box.appendChild(RG.ui.resultStats(data, hero));
    box.appendChild(el('div', { class: 'result-buttons' }, [
      el('button', { class: 'btn', onclick: () => UI.show('game', { opts: crystalOpts(d, hero) }) }, ['다시 하기']),
      el('button', { class: 'btn', onclick: () => UI.show('crystal', { keep: true, d, hero }) }, ['공명석 웨이브로']),
      el('button', { class: `btn btn-primary btn-gacha ${pulls ? 'ready' : ''}`, 'data-autofocus': '', onclick: () => UI.show('gacha', { back: { screen: 'crystal', data: { keep: true, d, hero } } }) }, [UI.icon('crystal', 'tiny'), '탑 뽑기']),
    ]));
    sec.appendChild(box);
  };
})();
