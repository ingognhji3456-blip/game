'use strict';

/* =========================================================
 * 원정 화면 — 설계: docs/design/expedition.md · 규칙: js/core/expedition.js · 저장: progress.exp*
 * 한 화면에서 원정 단계(run.phase)에 따라 가운데 패널이 바뀜. 아래 줄은 늘 덱·유물·불꽃·은화.
 * ========================================================= */
(() => {
  const { el } = RG.util;
  const UI = RG.ui;
  const D = () => RG.data;
  const XD = () => RG.data.expedition;
  const P = () => RG.progress;
  const EX = () => RG.expedition;
  const svg = (s, cls) => UI.svgImg(s, cls, '');
  let deckPick = [];        // 시작 덱 고르는 중
  let heroPick = null;
  let lastLog = null;       // 방금 일어난 일 (사건 결과·보상)
  let upgradeFor = null;    // 'shop' | 'rest' — 원정 강화할 탑 고르는 중

  const refresh = (data = {}) => UI.show('expedition', data);
  const relicName = (id) => (XD().relics[id] || {}).name || id;

  function topBar() {
    return el('header', { class: 'top-bar' }, [
      el('button', { class: 'icon-btn', title: '월드 지도', 'aria-label': '월드 지도', onclick: () => UI.show('world', {}) }, [UI.icon('back')]),
      el('h2', { text: '원정' }),
    ]);
  }

  /** 아래 줄: 불꽃·은화·덱·유물 */
  function statusBar(run) {
    const deck = el('div', { class: 'ex-deck', 'aria-label': '원정 덱' }, run.deck.map((t) => el('span', { class: `ex-card rar-${RG.gacha.rarityOf(t)}`, title: `${D().towers[t].name}${run.up.includes(t) ? ' · 원정 강화(Lv2부터)' : ''}` }, [
      UI.towerImg(t, run.up.includes(t) ? 2 : 1, null, 'mini'), run.up.includes(t) ? el('em', { class: 'ex-up', text: '★' }) : null])));
    const relics = el('div', { class: 'ex-relics' }, run.relics.length ? run.relics.map((id) => {
      const r = XD().relics[id];
      const chip = el('span', { class: `ex-relic k-${r.kind}`, tabindex: '0' }, [r.name]);
      UI.tooltipFor(chip, () => `<b>${r.name}</b><br>${r.desc}`);
      return chip;
    }) : [el('span', { class: 'dim', text: '유물 없음' })]);
    return el('div', { class: 'ex-status' }, [
      el('div', { class: 'ex-res' }, [
        el('span', { class: 'ex-lives', title: '원정 불꽃' }, [UI.icon('lives', 'small'), el('b', { text: String(run.lives) }), el('small', { text: `/${XD().maxLives}` })]),
        el('span', { class: 'ex-silver', title: '원정 은화' }, [UI.icon('gold', 'small'), el('b', { text: String(run.silver) }), el('small', { text: ' 은화' })]),
      ]),
      el('div', { class: 'ex-deckwrap' }, [el('span', { class: 'ex-lbl', text: `덱 ${run.deck.length}/${XD().maxDeck}` }), deck]),
      el('div', { class: 'ex-relicwrap' }, [el('span', { class: 'ex-lbl', text: `유물 ${run.relics.length}` }), relics]),
    ]);
  }

  /** 막·층 진행 줄 */
  function progressLine(run) {
    const acts = [];
    for (let a = 1; a <= XD().acts; a++) {
      const steps = [];
      for (let f = 1; f <= XD().floors + 1; f++) {
        const done = a < run.act || (a === run.act && f < run.floor);
        const cur = a === run.act && f === run.floor;
        steps.push(el('i', { class: `ex-step ${done ? 'done' : ''} ${cur ? 'cur' : ''} ${f > XD().floors ? 'boss' : ''}`, title: f > XD().floors ? `${a}막 보스` : `${a}막 ${f}층` }));
      }
      acts.push(el('div', { class: `ex-act ${a === run.act ? 'on' : ''}` }, [el('b', { text: `${a}막` }), el('div', { class: 'ex-steps' }, steps)]));
    }
    return el('div', { class: 'ex-progress' }, acts);
  }

  function nodeCard(run, node, i) {
    const info = XD().nodeInfo[node.kind];
    const def = node.mapId && D().maps.find((m) => m.id === node.mapId);
    const rule = node.rule && XD().rules[node.rule];
    return el('button', {
      class: `ex-node k-${node.kind}`, 'data-focus': `node-${i}`,
      onclick: () => {
        const r = EX().choose(run, i);
        if (!r.ok) { UI.toast(r.reason, 'warn'); return; }
        UI.sfx('click');
        P().save();
        if (r.battle) startBattle(run); else refresh();
      },
    }, [
      el('span', { class: 'ex-node-ico' }, [UI.icon(info.icon)]),
      el('b', { text: info.name }),
      def ? el('span', { class: 'ex-node-map', text: `${def.id} ${def.name}` }) : null,
      rule && node.rule !== 'clear' ? el('span', { class: 'ex-node-rule', text: `${rule.name}: ${rule.desc}` }) : null,
      el('small', { text: info.desc }),
    ]);
  }

  /** 지금 노드의 판 시작 */
  function startBattle(run) {
    const set = EX().battleSetup(run);
    const growth = P().heroGrowth(run.heroId);
    const opts = Object.assign({
      mode: 'expedition', heroId: run.heroId, skills: P().get().skills.slice(), seed: (Math.random() * 1e9) >>> 0,
      towers: run.deck.slice(), towerRanks: P().towerRanks(), finalLv2: true, branches: P().branchesUnlocked(),
    }, set);
    if (growth) opts.heroGrowth = growth;
    try { if (RG.audio) RG.audio.init(); } catch (e) { /* 무시 */ }
    UI.show('game', { opts });
  }

  /* ---------------- 단계별 패널 ---------------- */
  function introPanel() {
    const heroes = P().heroesFor(P().frontier());
    if (!heroPick || !heroes.includes(heroPick)) heroPick = heroes.includes(P().get().lastHero) ? P().get().lastHero : heroes[0];
    const st = P().expStats();
    const row = el('div', { class: 'hero-pick' }, heroes.map((h) => el('button', {
      class: `hp-item ${heroPick === h ? 'on' : ''}`, onclick: () => { heroPick = h; UI.sfx('click'); refresh(); },
    }, [UI.portrait(h, heroPick === h ? 'happy' : 'normal', 'hp-portrait'), el('span', { text: D().heroes[h].name })])));
    return el('div', { class: 'ex-panel ex-intro' }, [
      el('h3', { text: '구름 너머로 떠나는 원정' }),
      el('p', { class: 'dim', text: `3막 × 5층 + 막 보스. 층마다 갈림길에서 하나를 고르고, 짧은 작전으로 싸우며 덱과 유물을 모읍니다. 불꽃 ${XD().startLives}개로 시작해 0이 되면 원정이 끝나요. 기술 나무·뽑기 강화·영웅 성장이 모두 켜집니다.` }),
      el('div', { class: 'ex-sec' }, [el('span', { class: 'hx-kind', text: '함께 갈 영웅' }), row]),
      el('div', { class: 'ex-stats dim', text: `원정 ${st.runs}회 · 승리 ${st.wins}회 · 최고 ${st.best}층` }),
      el('button', {
        class: 'btn btn-primary btn-big', 'data-focus': 'start',
        onclick: () => { UI.sfx('click'); deckPick = []; P().expStart((Math.random() * 1e9) >>> 0, heroPick); refresh(); },
      }, ['원정 출발 ▶']),
    ]);
  }

  function deckPanel(run) {
    const need = Math.min(XD().startDeck.pick, run.offer.length);
    const cards = run.offer.map((t) => el('button', {
      class: `ex-pick rar-${RG.gacha.rarityOf(t)} ${deckPick.includes(t) ? 'on' : ''}`, 'aria-pressed': deckPick.includes(t) ? 'true' : 'false', 'data-focus': `deck-${t}`,
      onclick: () => {
        if (deckPick.includes(t)) deckPick = deckPick.filter((x) => x !== t); else if (deckPick.length < need) deckPick.push(t);
        UI.sfx('click'); refresh({ focus: `deck-${t}` });
      },
    }, [UI.towerImg(t, 1, null, ''), el('b', { text: D().towers[t].name }), el('small', { text: D().elements[D().towers[t].element].name })]));
    return el('div', { class: 'ex-panel' }, [
      el('h3', { text: `시작 덱: ${need}종을 고르세요 (${deckPick.length}/${need})` }),
      el('div', { class: 'ex-picks' }, cards),
      el('button', {
        class: 'btn btn-primary', disabled: deckPick.length === need ? null : '',
        onclick: () => { const r = EX().pickDeck(run, deckPick); if (!r.ok) { UI.toast(r.reason, 'warn'); return; } P().save(); UI.sfx('upgrade'); refresh(); },
      }, ['이 덱으로 출발']),
    ]);
  }

  function mapPanel(run) {
    const boss = EX().isBossFloor(run);
    return el('div', { class: 'ex-panel' }, [
      el('h3', { text: boss ? `${run.act}막 보스` : `${run.act}막 ${run.floor}층 — 갈 길을 고르세요` }),
      lastLog ? el('p', { class: 'ex-log', text: lastLog }) : null,
      el('div', { class: 'ex-nodes' }, run.nodes.map((n, i) => nodeCard(run, n, i))),
    ]);
  }

  function battlePanel(run) {
    const save = RG.save.get(RG.save.KEYS.run, null);
    const resumable = save && save.opts && save.opts.mode === 'expedition';
    const node = run.node;
    const def = D().maps.find((m) => m.id === node.mapId);
    return el('div', { class: 'ex-panel' }, [
      el('h3', { text: `${XD().nodeInfo[node.kind].name} — ${def.id} ${def.name}` }),
      el('p', { class: 'dim', text: resumable ? '하던 전투가 저장되어 있습니다.' : '전투를 시작하세요.' }),
      el('button', {
        class: 'btn btn-primary btn-big', 'data-focus': 'battle',
        onclick: () => (resumable ? UI.show('game', { resume: save }) : startBattle(run)),
      }, [resumable ? '전투 이어 하기 ▶' : '전투 시작 ▶']),
    ]);
  }

  function rewardPanel(run) {
    const isTower = run.offerKind === 'tower';
    const cards = run.offer.map((id) => el('button', {
      class: `ex-pick ${isTower ? `rar-${RG.gacha.rarityOf(id)}` : `relic k-${XD().relics[id].kind}`}`, 'data-focus': `rw-${id}`,
      onclick: () => {
        const r = EX().takeReward(run, id);
        if (!r.ok) { UI.toast(r.reason, 'warn'); return; }
        lastLog = isTower ? `${D().towers[id].name}이(가) 덱에 들어왔습니다` : `유물 ${relicName(id)}을(를) 얻었습니다`;
        UI.sfx('upgrade'); P().save(); refresh();
      },
    }, isTower ? [UI.towerImg(id, 1, null, ''), el('b', { text: D().towers[id].name }), el('small', { text: D().towers[id].desc })]
      : [el('span', { class: 'ex-relic-ico' }, [UI.icon('star')]), el('b', { text: XD().relics[id].name }), el('small', { text: XD().relics[id].desc })]));
    return el('div', { class: 'ex-panel' }, [
      el('h3', { text: isTower ? '승리! 덱에 넣을 탑을 고르세요' : '승리! 유물 하나를 고르세요' }),
      lastLog ? el('p', { class: 'ex-log', text: lastLog }) : null,
      el('div', { class: 'ex-picks' }, cards),
      isTower ? el('button', { class: 'btn', onclick: () => { EX().takeReward(run, null); lastLog = `은화 +${XD().silver.skip}`; P().save(); refresh(); } }, [`건너뛰고 은화 +${XD().silver.skip}`]) : null,
    ]);
  }

  function eventPanel(run) {
    const ev = XD().events.find((x) => x.id === run.node.event);
    return el('div', { class: 'ex-panel ex-event' }, [
      el('h3', { text: ev.title }),
      el('p', { class: 'ex-story', text: ev.text }),
      el('div', { class: 'ex-options' }, ev.options.map((o, i) => el('button', {
        class: 'btn ex-option', 'data-focus': `opt-${i}`,
        onclick: () => {
          const r = EX().eventChoose(run, i);
          if (!r.ok) { UI.toast(r.reason, 'warn'); return; }
          lastLog = `${ev.title}: ${r.log && r.log.length ? r.log.join(' · ') : '아무 일도 없었다'}`;
          UI.sfx('click'); P().save(); refresh();
        },
      }, [o.text]))),
    ]);
  }

  function upgradePicker(run, onPick) {
    const cand = run.deck.filter((t) => !run.up.includes(t));
    return el('div', { class: 'ex-upgrade' }, [
      el('p', { text: '원정 강화할 탑을 고르세요 (원정 동안 Lv2부터 지어짐)' }),
      el('div', { class: 'ex-picks small' }, cand.map((t) => el('button', { class: `ex-pick rar-${RG.gacha.rarityOf(t)}`, onclick: () => onPick(t) }, [UI.towerImg(t, 2, null, ''), el('b', { text: D().towers[t].name })]))),
      el('button', { class: 'btn small', onclick: () => { upgradeFor = null; refresh(); } }, ['취소']),
    ]);
  }

  function shopPanel(run) {
    const items = (run.shopStock || []).map((it) => {
      const bought = run.shopBought.includes(it.id) && it.kind !== 'heal';
      const label = it.kind === 'tower' ? D().towers[it.type].name : it.kind === 'relic' ? relicName(it.relic) : it.kind === 'heal' ? `불꽃 +${XD().shop.healLives}` : '원정 강화';
      const desc = it.kind === 'tower' ? '덱에 넣기' : it.kind === 'relic' ? XD().relics[it.relic].desc : it.kind === 'heal' ? '원정 불꽃 회복' : '덱의 탑 하나를 Lv2부터';
      return el('button', {
        class: `ex-pick ex-shopitem ${bought ? 'sold' : ''}`, disabled: bought || run.silver < it.price ? '' : null,
        onclick: () => {
          if (it.kind === 'upgrade') { upgradeFor = 'shop'; refresh(); return; }
          const r = EX().shopBuy(run, it.id);
          if (!r.ok) { UI.toast(r.reason, 'warn'); return; }
          UI.sfx('gold'); P().save(); refresh();
        },
      }, [it.kind === 'tower' ? UI.towerImg(it.type, 1, null, '') : el('span', { class: 'ex-relic-ico' }, [UI.icon(it.kind === 'relic' ? 'star' : it.kind === 'heal' ? 'lives' : 'upgrade')]),
        el('b', { text: label }), el('small', { text: desc }), el('span', { class: 'ex-price' }, [UI.icon('gold', 'tiny'), bought ? '팔림' : String(it.price)])]);
    });
    return el('div', { class: 'ex-panel' }, [
      el('h3', { text: '떠돌이 상점' }),
      upgradeFor === 'shop' ? upgradePicker(run, (t) => { const r = EX().shopBuy(run, 'upgrade', t); upgradeFor = null; if (!r.ok) UI.toast(r.reason, 'warn'); else { UI.sfx('upgrade'); P().save(); } refresh(); }) : el('div', { class: 'ex-picks' }, items),
      el('button', { class: 'btn btn-primary', onclick: () => { EX().shopLeave(run); lastLog = null; P().save(); refresh(); } }, ['상점을 떠난다 ▶']),
    ]);
  }

  function restPanel(run) {
    return el('div', { class: 'ex-panel' }, [
      el('h3', { text: '쉼터 — 모닥불 곁에서' }),
      upgradeFor === 'rest' ? upgradePicker(run, (t) => { const r = EX().rest(run, { upgrade: t }); upgradeFor = null; if (!r.ok) UI.toast(r.reason, 'warn'); else { lastLog = `${D().towers[t].name} 원정 강화`; UI.sfx('upgrade'); P().save(); } refresh(); })
        : el('div', { class: 'ex-options' }, [
          el('button', { class: 'btn ex-option', disabled: run.lives >= XD().maxLives ? '' : null, onclick: () => { EX().rest(run, 'heal'); lastLog = `불꽃 +${XD().rest.heal}`; UI.sfx('heroRevive'); P().save(); refresh(); } }, [`쉬어 간다 (불꽃 +${XD().rest.heal})`]),
          el('button', { class: 'btn ex-option', disabled: run.deck.every((t) => run.up.includes(t)) ? '' : null, onclick: () => { upgradeFor = 'rest'; refresh(); } }, ['탑을 손본다 (원정 강화)']),
        ]),
    ]);
  }

  function donePanel(run) {
    const rw = run.rewards || EX().rewardsOf(run);
    const win = run.result === 'win';
    return el('div', { class: `ex-panel ex-done ${win ? 'win' : 'lose'}` }, [
      el('h3', { text: win ? '원정 승리! 하늘 끝까지 지켜 냈다' : '원정이 끝났습니다' }),
      el('p', { text: `오른 층 ${run.floorsCleared} · 깬 막 ${run.actsCleared} · 전투 ${run.battles}` }),
      el('div', { class: 'reward-box' }, [
        el('div', { class: 'rw-total' }, [UI.icon('crystal', 'small'), el('b', { text: `+${rw.crystals}` }), el('span', { text: '공명석' })]),
        rw.gear.length ? el('div', { class: 'rw-lines', text: `장신구 ${rw.gear.length}개 (${rw.gear.map((r) => D().growth.gearRarities[r].name).join('·')})` }) : null,
      ]),
      el('button', {
        class: 'btn btn-primary btn-big', 'data-focus': 'claim',
        onclick: () => {
          const got = P().expClaim();
          if (got) {
            const names = got.gear.filter((g) => g.id).map((g) => D().growth.gear[g.id].name + (g.isNew ? '' : ` +${g.plus}`));
            UI.toast(`공명석 +${got.crystals}${names.length ? ` · 장신구: ${names.join(', ')}` : ''}`, 'good', 3200);
            UI.sfx('unlock');
          }
          lastLog = null;
          refresh();
        },
      }, ['보상 받기']),
    ]);
  }

  UI.register('expedition', {
    enter(sec, data = {}) {
      sec.innerHTML = '';
      UI.music('worldmap');
      const bar = topBar();
      let run = P().expRun();
      // 방금 끝난 원정 전투 결과
      if (data.battle && data.battle.ex) {
        const ex = data.battle.ex;
        lastLog = data.battle.result === 'win' ? `승리! 남은 불꽃 ${data.battle.lives} · 은화 +${ex.silver || 0}${ex.bond && ex.bond.levelUp ? ` · ${D().heroes[ex.bond.heroId].name} 인연 Lv${ex.bond.after}!` : ''}` : '전투에서 졌습니다…';
      }
      if (run && run.phase !== 'done') {
        bar.appendChild(el('button', {
          class: 'btn small ex-quit', onclick: () => UI.confirmBox('원정을 그만둘까요? 지금까지 오른 층만큼 보상을 받습니다.', () => { P().expAbandon(); refresh(); }),
        }, ['원정 그만두기']));
      }
      let panel;
      if (!run) panel = introPanel();
      else if (run.phase === 'deck') panel = deckPanel(run);
      else if (run.phase === 'map') panel = mapPanel(run);
      else if (run.phase === 'battle') panel = battlePanel(run);
      else if (run.phase === 'reward') panel = rewardPanel(run);
      else if (run.phase === 'event') panel = eventPanel(run);
      else if (run.phase === 'shop') panel = shopPanel(run);
      else if (run.phase === 'rest') panel = restPanel(run);
      else panel = donePanel(run);
      const body = el('div', { class: 'ex-body' }, [
        run && run.phase !== 'deck' ? progressLine(run) : null,
        run ? el('div', { class: 'ex-hero' }, [UI.portrait(run.heroId, run.lives > 6 ? 'happy' : 'worried', 'mini-portrait'), el('span', { text: D().heroes[run.heroId].name })]) : null,
        panel,
        run && run.phase !== 'deck' ? statusBar(run) : null,
      ]);
      sec.append(bar, body);
      requestAnimationFrame(() => {
        const f = data.focus ? sec.querySelector(`[data-focus="${data.focus}"]`) : sec.querySelector('.ex-panel button:not([disabled])');
        if (f) f.focus({ preventScroll: true });
      });
    },
  });
})();
