'use strict';

/* =========================================================
 * 게임 흐름 — 타이틀, 지도, 칸 진입, 보상, 상점, 휴식, 이벤트, 보물, 결과, 설정, 도움말
 * ========================================================= */
(() => {
  const U = CB.util;
  const el = U.el;
  const $ = (id) => document.getElementById(id);
  const sfx = (n) => CB.ui.sfx(n);
  const esc = U.escapeHtml;
  const save = () => { if (flow.run && !flow.run.over) CB.save.saveRun(flow.run); };
  const music = (t) => CB.audio && CB.audio.music(t);
  const RARITY_NAMES = { common: '일반', uncommon: '고급', rare: '희귀', shop: '상점', boss: '보스', event: '이벤트', starter: '시작' };

  const flow = {
    run: null,

    boot() {
      flow.showTitle();
    },

    /* ================= 타이틀 ================= */
    showTitle() {
      flow.run = null;
      const root = $('screen-title');
      root.innerHTML = '';
      const hasSave = CB.save.hasRun();
      const embers = el('div', { class: 'title-embers' });
      for (let i = 0; i < 24; i++) {
        embers.appendChild(el('span', { style: { left: `${Math.random() * 100}%`, animationDelay: `${-Math.random() * 12}s`, animationDuration: `${8 + Math.random() * 8}s` } }));
      }
      const menu = el('div', { class: 'title-menu' }, [
        el('button', { class: 'btn big', text: hasSave ? '새 원정' : '원정 시작', onclick: () => { sfx('click'); flow.newGame(); } }),
        hasSave ? el('button', { class: 'btn big secondary', text: '이어하기', onclick: () => { sfx('click'); flow.continueGame(); } }) : null,
        el('div', { class: 'title-row' }, [
          el('button', { class: 'btn secondary', text: '도움말', onclick: () => { sfx('click'); flow.openHelp(); } }),
          el('button', { class: 'btn secondary', text: '기록', onclick: () => { sfx('click'); flow.openHistory(); } }),
          el('button', { class: 'btn secondary', text: '설정', onclick: () => { sfx('click'); flow.openSettings(); } }),
        ]),
      ]);
      root.appendChild(el('div', { class: 'title-screen' }, [
        embers,
        el('div', { class: 'title-logo', html: CB.art.logo() }),
        el('div', { class: 'title-hero', html: CB.art.hero() }),
        menu,
        el('div', { class: 'title-foot', text: '덱을 쌓고, 길을 고르고, 심연의 끝까지.' }),
      ]));
      CB.ui.showScreen('title');
      music('title');
    },

    newGame() {
      const start = () => {
        CB.save.clearRun();
        flow.run = CB.run.newRun();
        save();
        flow.goMap(true);
      };
      if (CB.save.hasRun()) {
        CB.ui.modal.open({
          title: '새 원정', className: 'small',
          html: '<p style="text-align:center">진행 중인 원정이 사라집니다. 새로 시작할까요?</p>',
          buttons: [{ label: '새로 시작', kind: 'danger', onClick: (h) => { h.close(); start(); } }, { label: '취소', kind: 'secondary' }],
          dismissable: true,
        });
      } else start();
    },

    continueGame() {
      const run = CB.save.loadRun();
      if (!run) { CB.ui.toast('저장된 원정이 없습니다.', 'error'); flow.showTitle(); return; }
      flow.run = run;
      if (run.current && run.current.data) flow.resume();
      else flow.goMap();
    },

    resume() {
      const cur = flow.run.current;
      const data = cur.data;
      if (cur.stage === 'reward') { flow.showReward(cur.rewardsKind || data.kind || 'normal'); return; }
      if (cur.eventCombat) { flow.startCombat(cur.eventCombat, true); return; }
      flow.dispatch(data);
    },

    /* ================= 지도 ================= */
    goMap(intro = false) {
      const run = flow.run;
      save();
      CB.ui.showScreen('map');
      music('map');
      CB.ui.map.render($('screen-map'), run, { interactive: true, onSelect: (id) => flow.enterNode(id) });
      if (intro && CB.fx) CB.fx.banner(`${run.act}막`, { kind: 'act', sub: CB.ui.ACT_NAMES[run.act], duration: 1700 });
    },

    enterNode(nodeId) {
      if (flow.busy) return;
      flow.busy = true;
      setTimeout(() => { flow.busy = false; }, 400);
      sfx('mapStep');
      const data = CB.run.enterNode(flow.run, nodeId);
      if (!data) return;
      save();
      flow.dispatch(data);
    },

    dispatch(data) {
      switch (data.type) {
        case 'combat': case 'elite': case 'boss': flow.startCombat(data); break;
        case 'shop': flow.showShop(data.shop); break;
        case 'rest': flow.showRest(); break;
        case 'event': flow.showEvent(data.eventId); break;
        case 'treasure': flow.showTreasure(data); break;
        default: flow.finishNode();
      }
    },

    async startCombat(data, fromEvent = false) {
      const run = flow.run;
      if (run.current) {
        run.current.stage = 'battle';
        if (fromEvent || (run.current.type === 'event')) run.current.eventCombat = { enemies: data.enemies, kind: data.kind };
      }
      save();
      const result = await CB.ui.battle.start(run, { enemies: data.enemies, kind: data.kind });
      if (result === 'lost') { flow.gameOver(); return; }
      if (run.current) {
        run.current.stage = 'reward';
        run.current.eventCombat = null;
      }
      save();
      flow.showReward(data.kind);
    },

    finishNode() {
      const run = flow.run;
      const res = CB.run.completeNode(run);
      save();
      if (res.victory) { flow.victory(); return; }
      if (res.actComplete) {
        flow.goMap(true);
        CB.ui.toast('막을 돌파했습니다! 체력을 회복했습니다.', 'good');
        return;
      }
      flow.goMap();
    },

    /* ================= 보상 ================= */
    showReward(kind) {
      const run = flow.run;
      const cur = run.current || (run.current = { stage: 'reward', data: { kind } });
      cur.stage = 'reward';
      const rw = CB.run.rewards(run, kind);
      cur.claimed = cur.claimed || {};
      save();
      const root = $('screen-reward');
      root.innerHTML = '';
      const list = el('div', { class: 'reward-list' });
      const panel = el('div', { class: 'reward-panel panel' }, [
        el('h2', { class: 'title-ornament', text: kind === 'boss' ? '보스 격파!' : kind === 'elite' ? '정예 격파!' : '승리!' }),
        el('p', { class: 'reward-sub', text: '전리품을 챙기세요' }),
        list,
      ]);
      const item = (key, icon, label, onTake, extraClass = '') => {
        if (cur.claimed[key]) return;
        const row = el('button', { class: `reward-item ${extraClass}`, html: `<span class="reward-icon">${icon}</span><span class="reward-label">${label}</span>` });
        row.addEventListener('click', () => {
          if (onTake(row) !== false) {
            cur.claimed[key] = true;
            save();
            row.classList.add('taken');
            setTimeout(() => row.remove(), 260);
            CB.ui.hud.render(run);
          }
        });
        list.appendChild(row);
        return row;
      };

      if (rw.gold) {
        item('gold', '💰', `골드 ${rw.gold}`, (row) => {
          CB.run.addGold(run, rw.gold);
          sfx('gold');
          const c = CB.fx.centerOf(row);
          CB.fx.burst(c.x, c.y, 'gold');
        });
      }
      if (rw.potion) {
        const def = CB.data.potions[rw.potion];
        const row = item('potion', `<span class="reward-svg">${CB.art.potion(def.color, def.shape)}</span>`, esc(def.name), () => {
          if (!CB.run.addPotion(run, rw.potion)) { CB.ui.toast('물약 슬롯이 가득 찼습니다.', 'error'); sfx('error'); return false; }
          sfx('potion');
          return true;
        });
        if (row) CB.ui.tooltip.bind(row, () => CB.ui.potionHTML(rw.potion), { side: 'right' });
      }
      if (rw.relic) {
        const def = CB.data.relics[rw.relic];
        const row = item('relic', `<span class="reward-relic">${def.icon}</span>`, `${esc(def.name)} <small>${RARITY_NAMES[def.rarity] || ''} 유물</small>`, () => {
          flow.takeRelic(rw.relic);
        });
        if (row) CB.ui.tooltip.bind(row, () => CB.ui.relicHTML(rw.relic), { side: 'right' });
      }
      if (rw.relicChoices && rw.relicChoices.length) {
        item('bossRelic', '👑', '보스 유물 선택', () => { flow.chooseBossRelic(rw.relicChoices, () => { cur.claimed.bossRelic = true; save(); CB.ui.hud.render(run); refreshRewardButtons(); }); return false; }, 'special');
      }
      if (rw.cards && rw.cards.length) {
        item('card', '🃏', '카드 한 장 추가', () => { flow.chooseCard(rw.cards, () => { cur.claimed.card = true; save(); CB.ui.hud.render(run); refreshRewardButtons(); }); return false; }, 'special');
      }
      const proceed = el('button', { class: 'btn big', text: '계속하기 ➜', onclick: () => { sfx('click'); flow.finishNode(); } });
      panel.appendChild(el('div', { class: 'reward-actions' }, [proceed]));
      root.appendChild(el('div', { class: 'reward-screen' }, [panel]));
      function refreshRewardButtons() {
        if (cur.claimed.card) list.querySelectorAll('.reward-item').forEach((n) => { if (n.textContent.includes('카드 한 장')) n.remove(); });
        if (cur.claimed.bossRelic) list.querySelectorAll('.reward-item').forEach((n) => { if (n.textContent.includes('보스 유물')) n.remove(); });
      }
      CB.ui.showScreen('reward');
      music('map');
    },

    takeRelic(id, done) {
      const run = flow.run;
      const res = CB.run.addRelic(run, id);
      sfx('relic');
      CB.ui.hud.render(run);
      setTimeout(() => CB.ui.hud.flashRelic(id), 50);
      const def = CB.data.relics[id];
      CB.ui.toast(`${def.icon} ${def.name} 획득!`, 'good');
      (res.messages || []).forEach((m) => CB.ui.toast(m));
      save();
      flow.processFollowUps(res.followUps || [], () => { if (done) done(); });
    },

    chooseCard(ids, done) {
      const run = flow.run;
      const grid = el('div', { class: 'card-grid reward-cards' });
      let handle;
      ids.forEach((id, i) => {
        const node = CB.ui.cardFromId(id, false, { size: 'lg', hoverable: true });
        node.style.animationDelay = `${i * 90}ms`;
        node.classList.add('deal-in');
        node.addEventListener('click', () => {
          CB.run.addCard(run, id);
          sfx('select');
          handle.close();
          CB.ui.toast(`🃏 ${CB.data.cards[id].name} 추가!`, 'good');
          done();
        });
        node.addEventListener('mouseenter', () => sfx('hover'));
        grid.appendChild(node);
      });
      handle = CB.ui.modal.open({
        title: '카드 선택', sub: '덱에 추가할 카드를 한 장 고르세요.', el: grid, dismissable: true,
        buttons: [{ label: '건너뛰기', kind: 'secondary', onClick: (h) => { h.close(); done(); } }],
      });
    },

    chooseBossRelic(ids, done) {
      const box = el('div', { class: 'boss-relics' });
      let handle;
      for (const id of ids) {
        const def = CB.data.relics[id];
        const node = el('button', { class: 'boss-relic panel', html: `<div class="br-icon">${def.icon}</div><div class="br-name">${esc(def.name)}</div><div class="br-desc">${esc(def.desc)}</div>` });
        node.addEventListener('click', () => { handle.close(); flow.takeRelic(id, done); });
        box.appendChild(node);
      }
      handle = CB.ui.modal.open({ title: '보스 유물', sub: '강력하지만 대가가 따르는 유물 하나를 고르세요.', el: box, dismissable: true, buttons: [{ label: '건너뛰기', kind: 'secondary', onClick: (h) => { h.close(); done(); } }] });
    },

    /* ================= 후속 처리 (카드 제거/강화/전투) ================= */
    async processFollowUps(list, done) {
      const run = flow.run;
      for (const f of list) {
        if (f.type === 'removeCard') {
          const removable = run.deck;
          if (!removable.length) continue;
          const n = Math.min(f.count, removable.length);
          const picked = await CB.ui.selectCards({ title: '카드 제거', subtitle: `덱에서 제거할 카드 ${n}장을 고르세요.`, cards: removable, min: n, max: n, confirmLabel: '제거' });
          (picked || []).forEach((uid) => CB.run.removeCard(run, uid));
          if (picked && picked.length) { sfx('exhaust'); CB.ui.toast(`카드 ${picked.length}장을 제거했습니다.`); }
        } else if (f.type === 'upgradeCard') {
          for (let i = 0; i < f.count; i++) {
            const upgradable = run.deck.filter((c) => CB.run.canUpgrade(c));
            if (!upgradable.length) break;
            const picked = await CB.ui.selectCards({ title: '카드 강화', subtitle: f.count > 1 ? `${i + 1} / ${f.count}` : '', cards: upgradable, preview: 'upgrade', confirmLabel: '강화' });
            if (picked && picked[0]) { CB.run.upgradeCard(run, picked[0]); sfx('upgrade'); }
          }
        } else if (f.type === 'combat') {
          flow.pendingAfterCombat = done;
          save();
          await flow.startCombat({ enemies: f.enemies, kind: f.kind }, true);
          return; // 보상 화면에서 finishNode 로 이어짐
        }
        save();
        CB.ui.hud.render(run);
      }
      if (done) done();
    },

    /* ================= 상점 ================= */
    showShop(shop) {
      const run = flow.run;
      const root = $('screen-shop');
      root.innerHTML = '';
      music('shop');
      const render = () => {
        root.innerHTML = '';
        const cards = el('div', { class: 'shop-cards' });
        shop.cards.forEach((item, i) => {
          const slot = el('div', { class: `shop-slot${item.sold ? ' sold' : ''}` });
          if (!item.sold) {
            const node = CB.ui.cardFromId(item.id, false, { size: 'md', hoverable: true });
            slot.appendChild(node);
            slot.appendChild(priceTag(item.price));
            node.addEventListener('click', () => buy('cards', i));
          } else slot.appendChild(el('div', { class: 'sold-mark', text: '판매 완료' }));
          cards.appendChild(slot);
        });
        const relics = el('div', { class: 'shop-relics' });
        shop.relics.forEach((item, i) => {
          const def = CB.data.relics[item.id];
          const slot = el('button', { class: `shop-item${item.sold ? ' sold' : ''}`, html: item.sold ? '<div class="sold-mark">판매 완료</div>' : `<div class="shop-relic-icon">${def.icon}</div><div class="shop-item-name">${esc(def.name)}</div>` });
          if (!item.sold) {
            slot.appendChild(priceTag(item.price));
            CB.ui.tooltip.bind(slot, () => CB.ui.relicHTML(item.id));
            slot.addEventListener('click', () => buy('relics', i));
          }
          relics.appendChild(slot);
        });
        const potions = el('div', { class: 'shop-potions' });
        shop.potions.forEach((item, i) => {
          const def = CB.data.potions[item.id];
          const slot = el('button', { class: `shop-item${item.sold ? ' sold' : ''}`, html: item.sold ? '<div class="sold-mark">판매 완료</div>' : `<div class="shop-potion-icon">${CB.art.potion(def.color, def.shape)}</div><div class="shop-item-name">${esc(def.name)}</div>` });
          if (!item.sold) {
            slot.appendChild(priceTag(item.price));
            CB.ui.tooltip.bind(slot, () => CB.ui.potionHTML(item.id));
            slot.addEventListener('click', () => buy('potions', i));
          }
          potions.appendChild(slot);
        });
        const remove = el('button', { class: `shop-item shop-remove${shop.removeUsed ? ' sold' : ''}`, html: shop.removeUsed ? '<div class="sold-mark">사용 완료</div>' : '<div class="shop-relic-icon">✂️</div><div class="shop-item-name">카드 제거</div>' });
        if (!shop.removeUsed) {
          remove.appendChild(priceTag(shop.removeCost));
          CB.ui.tooltip.bind(remove, '<span class="tt-title">카드 제거</span><p>덱에서 카드 1장을 영구히 제거합니다. 사용할 때마다 가격이 오릅니다.</p>');
          remove.addEventListener('click', async () => {
            if (run.player.gold < shop.removeCost) { sfx('error'); CB.ui.toast('골드가 부족합니다.', 'error'); return; }
            const picked = await CB.ui.selectCards({ title: '카드 제거', subtitle: `${shop.removeCost} 골드`, cards: run.deck, cancellable: true, confirmLabel: '제거' });
            if (!picked || !picked[0]) return;
            const res = CB.run.shopRemove(run, shop, picked[0]);
            if (!res.ok) { CB.ui.toast(res.reason, 'error'); return; }
            sfx('shopBuy');
            save();
            CB.ui.hud.render(run);
            render();
          });
        }
        root.appendChild(el('div', { class: 'shop-screen' }, [
          el('div', { class: 'shop-header' }, [
            el('div', { class: 'merchant', html: CB.art.eventScene('stranger') }),
            el('div', { class: 'merchant-talk panel', html: '<b>떠돌이 상인</b><p>"어서 오시오, 원정대 양반. 쓸 만한 물건이 많다오."</p>' }),
          ]),
          el('div', { class: 'shop-section panel' }, [el('h3', { text: '카드' }), cards]),
          el('div', { class: 'shop-row' }, [
            el('div', { class: 'shop-section panel' }, [el('h3', { text: '유물' }), relics]),
            el('div', { class: 'shop-section panel' }, [el('h3', { text: '물약' }), potions]),
            el('div', { class: 'shop-section panel' }, [el('h3', { text: '서비스' }), remove]),
          ]),
          el('div', { class: 'shop-leave' }, [el('button', { class: 'btn big', text: '상점 떠나기 ➜', onclick: () => { sfx('click'); flow.finishNode(); } })]),
        ]));
      };
      const priceTag = (price) => el('div', { class: `price${run.player.gold < price ? ' expensive' : ''}`, html: `💰 ${price}` });
      const buy = (section, i) => {
        const res = CB.run.buy(run, shop, section, i);
        if (!res.ok) { sfx('error'); CB.ui.toast(res.reason, 'error'); return; }
        sfx('shopBuy');
        if (section === 'relics') {
          const id = shop.relics[i].id;
          setTimeout(() => CB.ui.hud.flashRelic(id), 60);
          flow.processFollowUps(res.followUps || [], () => { save(); CB.ui.hud.render(run); render(); });
        }
        save();
        CB.ui.hud.render(run);
        render();
      };
      render();
      CB.ui.showScreen('shop');
    },

    /* ================= 휴식 ================= */
    showRest() {
      const run = flow.run;
      const root = $('screen-rest');
      root.innerHTML = '';
      music('rest');
      const cur = run.current || {};
      const options = el('div', { class: 'rest-options' });
      const done = (msg) => {
        cur.restDone = msg;
        save();
        options.innerHTML = '';
        options.appendChild(el('div', { class: 'rest-result panel', text: msg }));
        options.appendChild(el('button', { class: 'btn big', text: '계속하기 ➜', onclick: () => { sfx('click'); flow.finishNode(); } }));
      };
      for (const opt of CB.run.restOptions(run)) {
        const btn = el('button', { class: 'rest-option panel', html: `<div class="rest-icon">${opt.icon}</div><div class="rest-label">${opt.label}</div><div class="rest-desc">${esc(opt.desc)}</div>` });
        if (opt.disabled) btn.disabled = true;
        btn.addEventListener('click', async () => {
          if (opt.id === 'heal') {
            const healed = CB.run.restHeal(run);
            sfx('heal');
            const c = CB.fx.centerOf($('hud-hp'));
            CB.fx.burst(c.x, c.y + 20, 'heal');
            CB.ui.hud.render(run);
            done(`모닥불 곁에서 푹 쉬었습니다. 체력 +${healed}`);
          } else {
            const picked = await CB.ui.selectCards({ title: '단련', subtitle: '강화할 카드를 고르세요.', cards: run.deck.filter((c) => CB.run.canUpgrade(c)), preview: 'upgrade', cancellable: true, confirmLabel: '강화' });
            if (!picked || !picked[0]) return;
            CB.run.upgradeCard(run, picked[0]);
            sfx('upgrade');
            const inst = run.deck.find((c) => c.uid === picked[0]);
            done(`「${CB.combat.cardDef(inst).name}」 카드를 단련했습니다.`);
          }
        });
        options.appendChild(btn);
      }
      root.appendChild(el('div', { class: 'rest-screen' }, [
        el('h2', { class: 'title-ornament', text: '휴식처' }),
        el('div', { class: 'campfire', html: '<div class="logs"></div><div class="flame f1"></div><div class="flame f2"></div><div class="flame f3"></div><div class="glow"></div>' }),
        el('div', { class: 'rest-hero', html: CB.art.hero() }),
        options,
      ]));
      if (cur.restDone) done(cur.restDone);
      CB.ui.showScreen('rest');
    },

    /* ================= 이벤트 ================= */
    showEvent(eventId) {
      const run = flow.run;
      const ev = CB.data.events[eventId];
      if (!ev) { flow.finishNode(); return; }
      const cur = run.current || {};
      const root = $('screen-event');
      root.innerHTML = '';
      music('event');
      const textBox = el('div', { class: 'event-text', text: ev.text });
      const choices = el('div', { class: 'event-choices' });
      const showOutcome = (outcome) => {
        choices.innerHTML = '';
        textBox.innerHTML = `<p>${esc(outcome.text || '')}</p>${(outcome.messages || []).map((m) => `<div class="event-msg">${esc(m)}</div>`).join('')}`;
        const pending = cur.followUps || [];
        const hasCombat = pending.some((f) => f.type === 'combat');
        const cont = el('button', { class: `btn big${hasCombat ? ' danger' : ''}`, text: hasCombat ? '⚔️ 맞서 싸운다' : '계속하기 ➜' });
        choices.appendChild(cont);
        const runFollow = () => {
          cur.followUps = [];
          save();
          flow.processFollowUps(pending, () => { save(); CB.ui.hud.render(run); });
        };
        cont.addEventListener('click', () => {
          sfx('click');
          if (hasCombat) runFollow();
          else flow.finishNode();
        });
        if (!hasCombat && pending.length) setTimeout(runFollow, 350);
      };
      ev.choices.forEach((choice, i) => {
        const check = CB.run.canChoose(run, eventId, i);
        const btn = el('button', {
          class: 'event-choice',
          html: `<span class="choice-label">${esc(choice.label)}</span><span class="choice-preview">${esc(choice.preview || '')}</span>${check.ok ? '' : `<span class="choice-req">${esc(check.reason)}</span>`}`,
        });
        if (!check.ok) btn.disabled = true;
        btn.addEventListener('click', () => {
          sfx('select');
          const res = CB.run.resolveEvent(run, eventId, i);
          cur.stage = 'eventResolved';
          cur.outcome = { text: res.text, messages: res.messages };
          cur.followUps = res.followUps;
          save();
          CB.ui.hud.render(run);
          showOutcome(cur.outcome);
        });
        btn.addEventListener('mouseenter', () => sfx('hover'));
        choices.appendChild(btn);
      });
      root.appendChild(el('div', { class: 'event-screen' }, [
        el('div', { class: 'event-card panel' }, [
          el('div', { class: 'event-scene', html: CB.art.eventScene(ev.scene) }),
          el('h2', { class: 'event-title title-ornament', text: ev.name }),
          textBox,
          choices,
        ]),
      ]));
      if (cur.stage === 'eventResolved' && cur.outcome) showOutcome(cur.outcome);
      CB.ui.showScreen('event');
    },

    /* ================= 보물 ================= */
    showTreasure(data) {
      const run = flow.run;
      const cur = run.current || {};
      const root = $('screen-treasure');
      root.innerHTML = '';
      music('event');
      const chest = el('button', { class: `chest${cur.opened ? ' open' : ''}`, html: '<div class="chest-glow"></div><div class="chest-lid"></div><div class="chest-body"><div class="chest-lock"></div></div>' });
      const loot = el('div', { class: 'treasure-loot' });
      const showLoot = () => {
        loot.innerHTML = '';
        const def = data.relicId && CB.data.relics[data.relicId];
        if (def) {
          const r = el('div', { class: 'loot-item panel', html: `<span class="reward-relic">${def.icon}</span><span><b>${esc(def.name)}</b><br><small>${esc(def.desc)}</small></span>` });
          loot.appendChild(r);
        }
        loot.appendChild(el('div', { class: 'loot-item panel', html: `<span class="reward-relic">💰</span><span><b>골드 ${data.gold}</b></span>` }));
        loot.appendChild(el('button', { class: 'btn big', text: '계속하기 ➜', onclick: () => { sfx('click'); flow.finishNode(); } }));
      };
      chest.addEventListener('click', () => {
        if (cur.opened) return;
        cur.opened = true;
        chest.classList.add('open');
        root.querySelector('.treasure-hint').textContent = '';
        sfx('relic');
        const c = CB.fx.centerOf(chest);
        CB.fx.burst(c.x, c.y, 'gold');
        CB.fx.burst(c.x, c.y - 30, 'buff');
        CB.run.addGold(run, data.gold);
        if (data.relicId) flow.takeRelic(data.relicId);
        save();
        CB.ui.hud.render(run);
        setTimeout(showLoot, 450);
      });
      root.appendChild(el('div', { class: 'treasure-screen' }, [
        el('h2', { class: 'title-ornament', text: '보물 상자' }),
        el('p', { class: 'treasure-hint', text: cur.opened ? '' : '상자를 눌러 여세요' }),
        chest,
        loot,
      ]));
      if (cur.opened) showLoot();
      CB.ui.showScreen('treasure');
    },

    /* ================= 결과 ================= */
    showEnd(victory) {
      const run = flow.run;
      run.over = true;
      run.victory = victory;
      const entry = CB.save.recordResult(run);
      CB.save.clearRun();
      const root = $('screen-gameover');
      root.innerHTML = '';
      const stats = el('div', { class: 'end-stats' });
      for (const [k, v] of CB.run.summary(run)) stats.appendChild(el('div', { class: 'end-stat', html: `<span>${k}</span><b>${esc(v)}</b>` }));
      const history = CB.save.getHistory();
      const hist = el('ol', { class: 'end-history' });
      history.slice(0, 5).forEach((h) => {
        const me = h.date === entry.date && h.score === entry.score && h.seed === entry.seed;
        hist.appendChild(el('li', { class: me ? 'me' : '', html: `<b>${h.score}</b>점 · ${h.victory ? '🏆 정복' : `${h.act}막 ${h.floor}층`} · <small>${h.date}</small>` }));
      });
      root.appendChild(el('div', { class: `end-screen ${victory ? 'victory' : 'defeat'}` }, [
        el('div', { class: 'end-art', html: victory ? CB.art.hero() : CB.art.enemy(lastKiller() || 'shade') }),
        el('div', { class: 'end-panel panel' }, [
          el('h1', { class: 'end-title', text: victory ? '원정 성공!' : '원정 실패' }),
          el('p', { class: 'end-sub', text: victory ? '태고의 용을 쓰러뜨리고 심연의 끝에 닿았습니다.' : '당신의 여정은 여기서 끝났습니다. 하지만 원정대의 이야기는 계속됩니다.' }),
          el('div', { class: 'end-score', html: `점수 <b>${entry.score}</b>` }),
          stats,
          el('h3', { text: '최고 기록' }),
          hist,
          el('div', { class: 'end-buttons' }, [
            el('button', { class: 'btn big', text: '다시 도전', onclick: () => { sfx('click'); flow.run = null; flow.newGame(); } }),
            el('button', { class: 'btn secondary', text: '타이틀로', onclick: () => { sfx('click'); flow.showTitle(); } }),
          ]),
        ]),
      ]));
      CB.ui.showScreen('gameover');
      music(victory ? 'victory' : 'defeat');
      function lastKiller() {
        const cur = run.current && run.current.data;
        return cur && cur.enemies ? cur.enemies[0] : null;
      }
    },
    gameOver() { flow.showEnd(false); },
    victory() { flow.showEnd(true); },

    /* ================= 설정/도움말/기록 ================= */
    applySettings(s) {
      if (CB.audio) {
        CB.audio.setVolume({ master: s.master, sfx: s.sfx, music: s.music });
        CB.audio.setMuted(s.muted);
      }
      if (CB.fx) CB.fx.setOptions({ shake: s.shake, speed: s.fast ? 2 : 1 });
      const mute = $('hud-mute');
      if (mute) mute.textContent = s.muted ? '🔇' : '🔊';
    },

    openSettings() {
      const s = CB.save.loadSettings();
      const box = el('div', { class: 'settings' });
      const commit = () => { CB.save.saveSettings(s); flow.applySettings(s); };
      const slider = (key, label) => {
        const input = el('input', { type: 'range', min: '0', max: '100', value: String(Math.round(s[key] * 100)) });
        input.addEventListener('input', () => { s[key] = Number(input.value) / 100; commit(); });
        input.addEventListener('change', () => sfx('click'));
        box.appendChild(el('div', { class: 'settings-row' }, [el('label', { text: label }), input]));
      };
      const toggle = (key, label) => {
        const t = el('button', { class: `toggle${s[key] ? ' on' : ''}`, 'aria-label': label });
        t.addEventListener('click', () => { s[key] = !s[key]; t.classList.toggle('on', s[key]); commit(); sfx('click'); });
        box.appendChild(el('div', { class: 'settings-row' }, [el('label', { text: label }), t]));
      };
      slider('master', '전체 음량');
      slider('sfx', '효과음');
      slider('music', '배경음악');
      toggle('muted', '음소거');
      toggle('shake', '화면 흔들림');
      toggle('fast', '빠른 연출');
      const buttons = [{ label: '닫기', kind: 'secondary' }];
      if (flow.run && CB.ui.currentScreen !== 'title') {
        buttons.unshift({
          label: '저장하고 타이틀로', onClick: (h) => {
            h.close();
            if (CB.ui.battle && CB.ui.battle.isActive()) CB.ui.battle.abort();
            save();
            flow.showTitle();
          },
        });
      }
      CB.ui.modal.open({ title: '설정', el: box, dismissable: true, className: 'small', buttons });
    },

    openHelp() {
      const kws = Object.entries(CB.data.keywords).map(([, k]) => `<div class="glossary-item"><b>${k.icon} ${k.name}</b><span>${esc(k.desc.replace(/\s*\(\{value\}턴\)/g, '').replace(/\{value\}/g, 'X'))}</span></div>`).join('');
      CB.ui.modal.open({
        title: '도움말',
        dismissable: true,
        html: `
          <div class="help">
            <h3>목표</h3>
            <p>세 개의 막을 지나 마지막 보스 <b>태고의 용</b>을 쓰러뜨리세요. 체력이 0이 되면 원정은 끝납니다.</p>
            <h3>지도</h3>
            <p>아래에서 위로 길을 골라 나아갑니다. 전투 ⚔️, 정예 😈, 미지의 장소 ❓, 휴식처 🔥, 상점 💰, 보물 상자 🎁가 있습니다.</p>
            <h3>전투</h3>
            <p>매 턴 에너지 3을 얻고 카드 5장을 뽑습니다. 카드를 <b>위로 끌어 올리거나</b> 클릭해서 사용하세요. 공격 카드는 적에게 끌어다 놓으면 대상을 고를 수 있습니다.
            적의 머리 위 아이콘은 <b>다음 행동</b>입니다. 공격이 예고되면 방어도로 대비하세요. 턴이 끝나면 남은 손패는 버려집니다.</p>
            <h3>단축키</h3>
            <p><b>1~9</b> 카드 선택 · <b>←/→</b> 대상 변경 · <b>Enter</b> 사용 · <b>E</b> 턴 종료 · <b>Esc</b> 취소</p>
            <h3>성장</h3>
            <p>승리하면 골드와 카드 보상을 얻습니다. 휴식처에서 카드를 <b>강화</b>하고, 상점에서 카드를 <b>제거</b>해 덱을 날카롭게 다듬으세요. 유물은 영구적인 효과를, 물약은 한 번 쓰는 강력한 효과를 줍니다.</p>
            <h3>용어</h3>
            <div class="glossary">${kws}</div>
          </div>`,
        buttons: [{ label: '닫기', kind: 'secondary' }],
      });
    },

    openHistory() {
      const list = CB.save.getHistory();
      const html = list.length
        ? `<ol class="end-history big">${list.map((h) => `<li><b>${h.score}</b>점 · ${h.victory ? '🏆 정복' : `${h.act}막 ${h.floor}층`} · 처치 ${h.kills} · <small>${h.date}</small></li>`).join('')}</ol>`
        : '<p style="text-align:center;color:var(--muted)">아직 기록이 없습니다. 첫 원정을 떠나 보세요!</p>';
      CB.ui.modal.open({ title: '기록', html, dismissable: true, className: 'small', buttons: [{ label: '닫기', kind: 'secondary' }] });
    },
  };

  CB.ui.flow = flow;
})();
