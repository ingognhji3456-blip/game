'use strict';

/* =========================================================
 * 전투 화면 — 엔진 이벤트를 받아 연출하고, 카드 드래그/클릭/키보드 입력을 처리합니다.
 * ========================================================= */
CB.ui.battle = (() => {
  const C = CB.combat;
  const U = CB.util;
  const el = U.el;
  const $ = (id) => document.getElementById(id);
  const sfx = (n) => CB.audio && CB.audio.play(n);
  const fx = () => CB.fx;
  const wait = (ms) => (CB.fx ? CB.fx.wait(ms) : U.sleep(ms));

  let battle = null;
  let run = null;
  let active = false;
  let locked = true;
  let resolveBattle = null;
  const dom = {};
  let unitEls = {};
  let disp = {};
  let shownHand = [];
  const cardEls = new Map();
  let piles = { draw: 0, discard: 0, exhaust: 0 };
  let hoverIndex = null;
  let selected = null; // { uid }
  let targeting = null; // { kind: 'card'|'potion', uid?, slot? }
  let aimUid = null; // 키보드로 고른 대상
  let drag = null;
  let pending = null; // 방금 낸 카드의 날아가는 요소
  let pointer = { x: 0, y: 0 };
  let lastHoverSfx = 0;

  /* ---------------- 생성 ---------------- */
  function build() {
    const root = $('screen-battle');
    root.innerHTML = '';
    dom.turn = el('div', { class: 'battle-turn' });
    dom.hero = el('div', { class: 'side hero-side' });
    dom.enemies = el('div', { class: 'side enemy-side' });
    dom.field = el('div', { class: 'battlefield' }, [dom.hero, dom.enemies]);
    dom.energy = el('div', { class: 'energy-orb', html: '<div class="energy-core"></div><span class="energy-value">3/3</span>' });
    dom.energyValue = dom.energy.querySelector('.energy-value');
    CB.ui.tooltip.bind(dom.energy, '<span class="tt-title">⚡ 에너지</span><p>카드를 낼 때 소모합니다. 매 턴 다시 채워집니다.</p>');
    dom.draw = pileButton('draw', '뽑을 카드', '🂠');
    dom.discard = pileButton('discard', '버린 카드', '🗑️');
    dom.exhaust = pileButton('exhaust', '소멸', '🔥');
    dom.hand = el('div', { class: 'hand' });
    dom.endTurn = el('button', { class: 'end-turn', html: '<span>턴 종료</span><small>E</small>' });
    dom.endTurn.addEventListener('click', () => endTurn());
    dom.playZone = el('div', { class: 'play-zone', text: '여기에 놓아 사용' });
    dom.bottom = el('div', { class: 'battle-bottom' }, [
      el('div', { class: 'bottom-left' }, [dom.energy, dom.draw]),
      dom.hand,
      el('div', { class: 'bottom-right' }, [dom.endTurn, el('div', { class: 'pile-row' }, [dom.discard, dom.exhaust])]),
    ]);
    const svgNS = 'http://www.w3.org/2000/svg';
    dom.arrow = document.createElementNS(svgNS, 'svg');
    dom.arrow.setAttribute('class', 'target-arrow hidden');
    dom.arrow.innerHTML = `
      <defs><marker id="arrow-head" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 Z" fill="currentColor"/></marker></defs>
      <path class="arrow-path" d="" marker-end="url(#arrow-head)"/>`;
    dom.arrowPath = dom.arrow.querySelector('.arrow-path');
    dom.root = el('div', { class: 'battle' }, [dom.turn, dom.field, dom.playZone, dom.bottom]);
    root.appendChild(dom.root);
    document.body.appendChild(dom.arrow);
    dom.field.addEventListener('click', (e) => {
      if (e.target.closest('.unit')) return;
      onFieldClick();
    });
    resize();
  }

  function pileButton(kind, label, icon) {
    const b = el('button', { class: `pile pile-${kind}`, html: `<span class="pile-icon">${icon}</span><span class="pile-count">0</span>` });
    CB.ui.tooltip.bind(b, `<span class="tt-title">${label} 더미</span><p>클릭해서 확인합니다.</p>`);
    b.addEventListener('click', () => {
      if (!battle) return;
      sfx('click');
      if (kind === 'draw') {
        const sorted = battle.drawPile.slice().sort((a, b2) => C.cardDef(a).name.localeCompare(C.cardDef(b2).name, 'ko'));
        CB.ui.viewPile('뽑을 카드 더미 (순서 무작위)', sorted, battle);
      } else if (kind === 'discard') CB.ui.viewPile('버린 카드 더미', battle.discardPile, battle);
      else CB.ui.viewPile('소멸한 카드', battle.exhaustPile, battle);
    });
    return b;
  }

  function makeUnitEl(unit) {
    const isPlayer = unit.side === 'player';
    const root = el('div', { class: `unit ${isPlayer ? 'unit-player' : 'unit-enemy'} size-${unit.size} rank-${unit.rank}`, dataset: { uid: unit.uid } });
    const intent = isPlayer ? null : el('div', { class: 'intent' });
    const art = el('div', { class: 'unit-art', html: isPlayer ? CB.art.hero() : CB.art.enemy(unit.art) });
    const hpFill = el('div', { class: 'hp-fill' });
    const hpGhost = el('div', { class: 'hp-ghost' });
    const hpText = el('div', { class: 'hp-text' });
    const blockBadge = el('div', { class: 'block-badge hidden', html: '<span>0</span>' });
    const bar = el('div', { class: 'hp-bar' }, [hpGhost, hpFill, hpText]);
    const bars = el('div', { class: 'unit-bars' }, [blockBadge, bar]);
    const name = el('div', { class: 'unit-name', html: `${U.escapeHtml(unit.name)}${unit.rank === 'boss' ? ' <span class="tag boss">보스</span>' : unit.rank === 'elite' ? ' <span class="tag elite">정예</span>' : ''}` });
    const statuses = el('div', { class: 'statuses' });
    if (intent) root.appendChild(intent);
    root.append(art, bars, name, statuses);
    if (!isPlayer) {
      root.addEventListener('click', (e) => { e.stopPropagation(); onUnitClick(unit.uid); });
      root.addEventListener('mouseenter', () => { if (targeting || drag) setHoverTarget(unit.uid); });
      root.addEventListener('mouseleave', () => { if (aimUid === unit.uid && !targeting) setHoverTarget(null); });
      CB.ui.tooltip.bind(intent, () => {
        const iv = C.intentView(battle, unit.uid);
        return iv ? `<span class="tt-title">${U.escapeHtml(iv.moveName)}</span><p>${U.escapeHtml(iv.text)}</p>` : '';
      });
    }
    const refs = { root, intent, art, hpFill, hpGhost, hpText, blockBadge, statuses, name };
    unitEls[unit.uid] = refs;
    return refs;
  }

  /* ---------------- 렌더링 ---------------- */
  const unitOf = (uid) => C.getUnit(battle, uid);

  function renderBars(uid) {
    const u = unitOf(uid);
    const r = unitEls[uid];
    if (!u || !r) return;
    const d = disp[uid] || { hp: u.hp, block: u.block };
    const pct = Math.max(0, Math.min(100, (d.hp / u.maxHp) * 100));
    r.hpFill.style.width = `${pct}%`;
    r.hpGhost.style.width = `${pct}%`;
    r.hpText.textContent = `${d.hp}/${u.maxHp}`;
    r.root.classList.toggle('has-block', d.block > 0);
    r.blockBadge.classList.toggle('hidden', d.block <= 0);
    r.blockBadge.querySelector('span').textContent = d.block;
  }

  function renderStatuses(uid, popId) {
    const u = unitOf(uid);
    const r = unitEls[uid];
    if (!u || !r) return;
    r.statuses.innerHTML = '';
    for (const s of C.statusList(u)) {
      const node = el('div', { class: `status ${s.kind}${s.id === popId ? ' pop' : ''}`, html: `<span class="s-icon">${s.icon}</span><span class="s-val">${s.id === 'fortress' ? '' : s.value}</span>` });
      CB.ui.tooltip.bind(node, `<span class="tt-title">${s.icon} ${s.name}</span><p>${U.escapeHtml(s.desc)}</p>`);
      r.statuses.appendChild(node);
    }
  }

  function renderIntent(uid) {
    const r = unitEls[uid];
    const u = unitOf(uid);
    if (!r || !r.intent || !u) return;
    if (!u.alive || battle.phase === 'won') { r.intent.innerHTML = ''; return; }
    const iv = C.intentView(battle, uid);
    if (!iv) { r.intent.innerHTML = ''; return; }
    const icons = iv.kinds.slice(0, 2).map((k) => `<span class="intent-icon-wrap k-${k}">${CB.art.intent(k)}</span>`).join('');
    const num = iv.damage != null ? `<span class="intent-num">${iv.damage}${iv.times > 1 ? `<small>×${iv.times}</small>` : ''}</span>` : '';
    r.intent.innerHTML = `${icons}${num}`;
    r.intent.classList.toggle('danger', iv.damage != null && iv.damage * Math.max(1, iv.times) >= 15);
  }

  function renderUnits() {
    if (!unitEls.player) dom.hero.appendChild(makeUnitEl(battle.player).root);
    for (const e of battle.enemies) {
      if (!unitEls[e.uid]) dom.enemies.appendChild(makeUnitEl(e).root);
      unitEls[e.uid].root.classList.toggle('dead', !e.alive && !unitEls[e.uid].root.classList.contains('dying'));
    }
    for (const uid of Object.keys(unitEls)) {
      renderBars(uid);
      renderStatuses(uid);
      renderIntent(uid);
    }
    dom.enemies.dataset.count = String(C.livingEnemies(battle).length);
  }

  function renderPiles() {
    dom.draw.querySelector('.pile-count').textContent = piles.draw;
    dom.discard.querySelector('.pile-count').textContent = piles.discard;
    dom.exhaust.querySelector('.pile-count').textContent = piles.exhaust;
    dom.exhaust.classList.toggle('empty', piles.exhaust === 0);
  }

  function renderEnergy(pulse) {
    dom.energyValue.textContent = `${battle.energy}/${battle.maxEnergy}`;
    dom.energy.classList.toggle('empty', battle.energy <= 0);
    if (pulse) {
      dom.energy.classList.remove('pulse');
      void dom.energy.offsetWidth;
      dom.energy.classList.add('pulse');
    }
  }

  function renderControls() {
    const canAct = active && !locked && battle.phase === 'player';
    dom.endTurn.disabled = !canAct;
    const anyPlayable = battle.hand.some((c, i) => C.canPlay(battle, i).ok);
    dom.endTurn.classList.toggle('glow', canAct && !anyPlayable);
    dom.turn.textContent = `${battle.turn}턴`;
    dom.root.classList.toggle('locked', !canAct);
  }

  /* ---------------- 손패 ---------------- */
  function cardSize() {
    if (window.innerWidth <= 520) return 'xs';
    return window.innerWidth < 760 || window.innerHeight < 700 ? 'sm' : 'md';
  }

  function findInst(uid) {
    return battle.hand.find((c) => c.uid === uid)
      || battle.drawPile.find((c) => c.uid === uid)
      || battle.discardPile.find((c) => c.uid === uid)
      || battle.exhaustPile.find((c) => c.uid === uid)
      || battle.powersPlayed.find((c) => c.uid === uid);
  }

  function ensureCardEl(inst) {
    const view = C.cardView(inst, battle);
    const fresh = CB.ui.renderCard(view, { size: cardSize(), tooltip: false });
    let node = cardEls.get(inst.uid);
    if (node) {
      node.className = `${fresh.className} hand-card`;
      node.innerHTML = fresh.innerHTML;
    } else {
      node = fresh;
      node.classList.add('hand-card');
      node.addEventListener('pointerdown', (e) => onCardPointerDown(e, inst.uid));
      node.addEventListener('pointerenter', () => onCardHover(inst.uid, true));
      node.addEventListener('pointerleave', () => onCardHover(inst.uid, false));
      node.addEventListener('contextmenu', (e) => { e.preventDefault(); cancelAll(); });
      CB.ui.tooltip.bind(node, () => {
        const i = battle.hand.findIndex((c) => c.uid === inst.uid);
        const v = i >= 0 ? C.cardView(battle.hand[i], battle) : view;
        return CB.ui.keywordHTML(v.keywords);
      }, { side: 'top', delay: 300 });
      dom.hand.appendChild(node);
      cardEls.set(inst.uid, node);
    }
    if (selected && selected.uid === inst.uid) node.classList.add('selected');
    return node;
  }

  function renderHand() {
    for (const [uid, node] of cardEls) {
      if (!shownHand.includes(uid)) { node.remove(); cardEls.delete(uid); }
    }
    for (const uid of shownHand) {
      const inst = findInst(uid);
      if (inst) ensureCardEl(inst);
    }
    layoutHand();
  }

  function layoutHand() {
    const n = shownHand.length;
    if (!n) return;
    const handW = dom.hand.clientWidth || 600;
    const sample = cardEls.get(shownHand[0]);
    const cardW = sample ? sample.offsetWidth : 150;
    const spread = n > 1 ? Math.min(cardW * 0.86, (handW - cardW) / (n - 1)) : 0;
    const mid = (n - 1) / 2;
    shownHand.forEach((uid, i) => {
      const node = cardEls.get(uid);
      if (!node || node === (drag && drag.node && drag.active ? drag.node : null)) return;
      const off = i - mid;
      let x = off * spread;
      let y = off * off * (n > 6 ? 1.6 : 2.6);
      let rot = off * Math.min(4.5, 24 / n);
      let scale = 1;
      let z = i + 1;
      const isSel = selected && selected.uid === uid;
      if (isSel) { y = -70; rot = 0; scale = 1.12; z = 200; }
      else if (hoverIndex !== null && !selected) {
        if (i === hoverIndex) { y = -54; rot = 0; scale = 1.16; z = 200; }
        else x += (i < hoverIndex ? -1 : 1) * Math.min(34, cardW * 0.22);
      }
      node.style.marginLeft = `${-cardW / 2}px`;
      node.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${rot.toFixed(2)}deg) scale(${scale})`;
      node.style.zIndex = String(z);
    });
  }

  function onCardHover(uid, on) {
    if (drag && drag.active) return;
    const i = shownHand.indexOf(uid);
    hoverIndex = on ? i : (hoverIndex === i ? null : hoverIndex);
    if (on && !locked && performance.now() - lastHoverSfx > 60) { sfx('hover'); lastHoverSfx = performance.now(); }
    layoutHand();
  }

  /* 카드를 화면 위 고정 레이어로 떼어 내어 날립니다. */
  function detachCard(uid) {
    const node = cardEls.get(uid);
    if (!node) return null;
    cardEls.delete(uid);
    const r = node.getBoundingClientRect();
    const w = node.offsetWidth;
    const h = node.offsetHeight;
    node.classList.add('flying-card');
    node.classList.remove('selected');
    document.body.appendChild(node);
    node.style.transition = 'none';
    node.style.marginLeft = '0';
    node.style.left = '0px';
    node.style.top = '0px';
    node.style.zIndex = '950';
    node._w = w;
    node._h = h;
    placeFlying(node, r.left + r.width / 2, r.top + r.height / 2, 1, 0);
    void node.offsetWidth;
    return node;
  }

  function placeFlying(node, x, y, scale, rot = 0) {
    node.style.transform = `translate(${(x - node._w / 2).toFixed(1)}px, ${(y - node._h / 2).toFixed(1)}px) rotate(${rot}deg) scale(${scale})`;
  }

  function flyTo(node, x, y, scale, ms, opacity = 1, rot = 0) {
    node.style.transition = `transform ${ms / fx().speed()}ms cubic-bezier(.3,.7,.3,1), opacity ${ms / fx().speed()}ms ease`;
    placeFlying(node, x, y, scale, rot);
    node.style.opacity = String(opacity);
  }

  function pileCenter(kind) {
    return fx().centerOf({ draw: dom.draw, discard: dom.discard, exhaust: dom.exhaust }[kind]);
  }

  async function animateCardAway(node, mode) {
    if (!node) return;
    if (mode === 'exhaust') {
      node.classList.add('burning');
      const c = fx().centerOf(node);
      fx().burst(c.x, c.y, 'fire');
      sfx('exhaust');
      setTimeout(() => node.remove(), 600 / fx().speed());
    } else if (mode === 'power') {
      const r = node.getBoundingClientRect();
      flyTo(node, r.left + r.width / 2, r.top - 60, 1.15, 380, 0);
      fx().burst(r.left + r.width / 2, r.top + r.height / 2, 'magic');
      sfx('buff');
      setTimeout(() => node.remove(), 420 / fx().speed());
    } else {
      const p = pileCenter('discard');
      flyTo(node, p.x, p.y, 0.18, 320, 0.3, 40);
      setTimeout(() => node.remove(), 340 / fx().speed());
    }
  }

  /* ---------------- 동기화 ---------------- */
  function syncAll() {
    if (!battle) return;
    disp = {};
    for (const u of [battle.player, ...battle.enemies]) disp[u.uid] = { hp: u.hp, block: u.block };
    shownHand = battle.hand.map((c) => c.uid);
    piles = { draw: battle.drawPile.length, discard: battle.discardPile.length, exhaust: battle.exhaustPile.length };
    renderUnits();
    renderHand();
    renderPiles();
    renderEnergy();
    renderControls();
    CB.ui.hud.render(run);
  }

  /* ---------------- 이벤트 연출 ---------------- */
  async function playEvents(events) {
    for (const ev of events) {
      if (!active) return;
      try {
        await animateEvent(ev);
      } catch (e) {
        console.warn('연출 오류', ev, e);
      }
    }
    syncAll();
  }

  function unitCenter(uid) {
    const r = unitEls[uid];
    if (!r) return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    return fx().centerOf(r.art);
  }

  function lunge(uid) {
    const r = unitEls[uid];
    if (!r) return;
    const cls = uid === 'player' ? 'lunge-right' : 'lunge-left';
    r.root.classList.remove(cls);
    void r.root.offsetWidth;
    r.root.classList.add(cls);
    setTimeout(() => r.root.classList.remove(cls), 420);
  }

  function hitReact(uid) {
    const r = unitEls[uid];
    if (!r) return;
    r.root.classList.remove('hit');
    void r.root.offsetWidth;
    r.root.classList.add('hit');
    fx().flash(r.art, '#ff5a4a');
  }

  async function animateEvent(ev) {
    const F = fx();
    switch (ev.type) {
      case 'turnStart':
        if (ev.side === 'player') {
          sfx('turnStart');
          renderControls();
          F.banner('내 턴', { kind: 'player', sub: `${ev.turn}턴`, duration: 900 });
          await wait(420);
        } else {
          F.banner('적의 턴', { kind: 'enemy', duration: 900 });
          await wait(520);
        }
        return;
      case 'draw': {
        const inst = findInst(ev.cardUid);
        if (!inst) return;
        shownHand.push(ev.cardUid);
        piles.draw = Math.max(0, piles.draw - 1);
        renderPiles();
        const node = ensureCardEl(inst);
        const handR = dom.hand.getBoundingClientRect();
        const p = pileCenter('draw');
        const nx = handR.left + handR.width / 2;
        const ny = handR.bottom - node.offsetHeight / 2;
        node.style.transition = 'none';
        node.style.transform = `translate(${p.x - nx}px, ${p.y - ny}px) rotate(-25deg) scale(.25)`;
        node.style.opacity = '0';
        void node.offsetWidth;
        node.style.transition = '';
        node.style.opacity = '1';
        layoutHand();
        sfx('cardDraw');
        await wait(85);
        return;
      }
      case 'shuffle': {
        sfx('shuffle');
        piles.draw = ev.count;
        piles.discard = 0;
        renderPiles();
        const p = pileCenter('draw');
        F.floatText(p.x, p.y - 40, '덱 섞기', 'info');
        await wait(260);
        return;
      }
      case 'cardPlayed':
        if (ev.cardType === 'attack') lunge('player');
        return;
      case 'discard':
      case 'exhaust':
      case 'powerPlayed': {
        const kind = ev.type === 'discard' ? 'discard' : ev.type === 'exhaust' ? 'exhaust' : 'power';
        if (pending && pending.uid === ev.cardUid) {
          const node = pending.node;
          pending = null;
          await animateCardAway(node, kind);
        } else if (shownHand.includes(ev.cardUid)) {
          shownHand = shownHand.filter((u) => u !== ev.cardUid);
          const node = detachCard(ev.cardUid);
          layoutHand();
          animateCardAway(node, kind);
          await wait(45);
        }
        if (kind === 'discard') piles.discard += 1;
        if (kind === 'exhaust') piles.exhaust += 1;
        renderPiles();
        return;
      }
      case 'cardAdded': {
        const def = CB.data.cards[ev.cardId];
        const where = ev.to === 'hand' ? null : ev.to === 'drawPile' ? 'draw' : 'discard';
        if (ev.to === 'hand') {
          shownHand.push(ev.cardUid);
          renderHand();
        } else {
          piles[where] += 1;
          renderPiles();
          const p = pileCenter(where);
          F.floatText(p.x, p.y - 46, `+${def ? def.name : '카드'}`, 'debuff');
        }
        sfx('debuff');
        await wait(220);
        return;
      }
      case 'cardTrigger': {
        const node = cardEls.get(ev.cardUid);
        if (node) {
          node.classList.add('triggered');
          setTimeout(() => node.classList.remove('triggered'), 500);
        }
        await wait(200);
        return;
      }
      case 'energy':
        battle && renderEnergy(true);
        if (ev.delta > 0) sfx('energy');
        return;
      case 'damage': {
        const tgt = ev.targetUid;
        const c = unitCenter(tgt);
        const before = disp[tgt] ? disp[tgt].block : 0;
        if (ev.sourceUid !== 'player' && unitEls[ev.sourceUid]) {
          lunge(ev.sourceUid);
          sfx('enemyAttack');
          await wait(140);
        } else if (ev.isAttack) {
          sfx(ev.heavy ? 'heavyAttack' : 'attack');
          F.slash(c.x, c.y, { heavy: ev.heavy, angle: -0.7 + Math.random() * 0.4 });
        } else {
          sfx('attack');
          F.burst(c.x, c.y, 'fire');
        }
        disp[tgt] = { hp: ev.hp, block: ev.block };
        renderBars(tgt);
        if (ev.blocked > 0) {
          if (ev.hpLoss === 0) {
            sfx('blockHit');
            F.floatText(c.x, c.y - 30, '막음', 'block');
          }
          F.burst(c.x, c.y, before > 0 && ev.block === 0 ? 'shatter' : 'block');
        }
        if (ev.hpLoss > 0) {
          F.floatText(c.x, c.y - 24, `-${ev.hpLoss}`, ev.heavy ? 'crit' : 'damage');
          F.burst(c.x, c.y, ev.heavy ? 'crit' : 'hit');
          hitReact(tgt);
          if (tgt === 'player') F.shake(Math.min(2.6, 0.7 + ev.hpLoss / 9));
          else F.shake(ev.heavy ? 1.3 : 0.45);
        }
        await wait(ev.sourceUid === 'player' ? 170 : 300);
        return;
      }
      case 'block': {
        const tgt = ev.targetUid;
        disp[tgt] = { hp: disp[tgt] ? disp[tgt].hp : unitOf(tgt).hp, block: ev.block };
        renderBars(tgt);
        if (ev.reset || ev.amount <= 0) return;
        const c = unitCenter(tgt);
        sfx('block');
        F.burst(c.x, c.y, 'block');
        F.floatText(c.x, c.y - 10, `+${ev.amount}`, 'block');
        const r = unitEls[tgt];
        if (r) { r.blockBadge.classList.remove('gain'); void r.blockBadge.offsetWidth; r.blockBadge.classList.add('gain'); }
        await wait(140);
        return;
      }
      case 'heal': {
        const tgt = ev.targetUid;
        disp[tgt] = { hp: ev.hp, block: disp[tgt] ? disp[tgt].block : 0 };
        renderBars(tgt);
        const c = unitCenter(tgt);
        sfx('heal');
        F.burst(c.x, c.y, 'heal');
        F.floatText(c.x, c.y - 20, `+${ev.amount}`, 'heal');
        await wait(170);
        return;
      }
      case 'hpLoss': {
        const tgt = ev.targetUid;
        disp[tgt] = { hp: ev.hp, block: disp[tgt] ? disp[tgt].block : 0 };
        renderBars(tgt);
        const c = unitCenter(tgt);
        if (ev.reason === 'poison') { sfx('poison'); F.burst(c.x, c.y, 'poison'); F.floatText(c.x, c.y - 20, `-${ev.amount}`, 'poison'); }
        else if (ev.reason === 'thorns') { sfx('attack'); F.burst(c.x, c.y, 'hit', { count: 8 }); F.floatText(c.x, c.y - 20, `-${ev.amount}`, 'damage'); }
        else { sfx('debuff'); F.floatText(c.x, c.y - 20, `-${ev.amount}`, 'damage'); }
        hitReact(tgt);
        if (tgt === 'player') F.shake(0.6);
        await wait(220);
        return;
      }
      case 'status': {
        const tgt = ev.targetUid;
        renderStatuses(tgt, ev.status);
        const k = CB.data.keywords[ev.status];
        const c = unitCenter(tgt);
        if (ev.negated) {
          F.floatText(c.x, c.y - 50, '무효!', 'info');
          F.burst(c.x, c.y, 'magic');
          sfx('block');
          await wait(220);
          return;
        }
        if (ev.delta > 0 && k) {
          const isDebuff = k.kind === 'debuff';
          F.floatText(c.x + (Math.random() - 0.5) * 40, c.y - 56, `${k.name} ${ev.status === 'fortress' ? '' : `+${ev.delta}`}`.trim(), isDebuff ? 'debuff' : 'buff');
          F.burst(c.x, c.y, isDebuff ? 'debuff' : 'buff');
          sfx(isDebuff ? 'debuff' : 'buff');
          await wait(180);
        } else if (ev.delta < 0 && (ev.status === 'strength' || ev.status === 'dexterity') && k) {
          F.floatText(c.x, c.y - 56, `${k.name} ${ev.delta}`, 'debuff');
          sfx('debuff');
          await wait(160);
        }
        return;
      }
      case 'enemyAct': {
        const r = unitEls[ev.uid];
        if (!r) return;
        r.root.classList.add('acting');
        setTimeout(() => r.root.classList.remove('acting'), 700);
        const c = fx().centerOf(r.art);
        F.floatText(c.x, c.y - 90, ev.moveName, 'info');
        await wait(260);
        return;
      }
      case 'intent':
        renderIntent(ev.uid);
        return;
      case 'summon': {
        const u = unitOf(ev.uid);
        if (!u) return;
        disp[u.uid] = { hp: u.hp, block: u.block };
        const r = makeUnitEl(u);
        r.root.classList.add('summoning');
        dom.enemies.appendChild(r.root);
        renderBars(u.uid);
        renderStatuses(u.uid);
        renderIntent(u.uid);
        dom.enemies.dataset.count = String(C.livingEnemies(battle).length);
        resize();
        await wait(60);
        const c = unitCenter(u.uid);
        F.burst(c.x, c.y, 'magic');
        sfx('buff');
        await wait(320);
        return;
      }
      case 'phaseShift': {
        F.screenFlash('rgba(255,40,30,.35)');
        F.shake(2.2);
        sfx('bossRoar');
        const r = unitEls[ev.uid];
        if (r) r.root.classList.add('enraged');
        await F.banner(ev.text, { kind: 'boss', duration: 1700 });
        return;
      }
      case 'death': {
        const r = unitEls[ev.uid];
        if (!r) return;
        const c = fx().centerOf(r.art);
        r.root.classList.add('dying');
        if (r.intent) r.intent.innerHTML = '';
        F.burst(c.x, c.y, 'death');
        sfx('death');
        setTimeout(() => { r.root.classList.add('dead'); resize(); }, 700 / F.speed());
        await wait(380);
        return;
      }
      case 'relic':
        CB.ui.hud.flashRelic(ev.relicId);
        sfx('select');
        await wait(150);
        return;
      case 'potion':
        sfx('potion');
        CB.ui.hud.render(run);
        await wait(160);
        return;
      case 'gold': {
        sfx('gold');
        const c = fx().centerOf($('hud-gold'));
        F.floatText(c.x, c.y + 30, `+${ev.amount}`, 'gold');
        CB.ui.hud.render(run);
        return;
      }
      case 'upgradeHand': {
        sfx('upgrade');
        renderHand();
        const c = fx().centerOf(dom.hand);
        F.burst(c.x, c.y, 'buff');
        await wait(240);
        return;
      }
      case 'error':
        CB.ui.toast(ev.text, 'error');
        sfx('error');
        return;
      default:
    }
  }

  /* ---------------- 행동 ---------------- */
  async function afterAction() {
    if (!active) return;
    if (C.result(battle)) {
      await endBattle();
      return;
    }
    locked = false;
    syncAll();
  }

  async function playCard(uid, targetUid) {
    if (locked || !active) return;
    const index = battle.hand.findIndex((c) => c.uid === uid);
    if (index < 0) return;
    const check = C.canPlay(battle, index);
    if (!check.ok) { rejectCard(uid, check.reason); return; }
    const def = C.cardDef(battle.hand[index]);
    if (def.target === 'enemy' && !targetUid) {
      const living = C.livingEnemies(battle);
      if (living.length === 1) targetUid = living[0].uid;
      else { CB.ui.toast('대상을 선택하세요.'); return; }
    }
    locked = true;
    clearSelection();
    hoverIndex = null;
    CB.ui.tooltip.hide();
    const node = detachCard(uid);
    shownHand = shownHand.filter((u) => u !== uid);
    layoutHand();
    renderControls();
    sfx('cardPlay');
    if (node) {
      const dest = targetUid ? unitCenter(targetUid) : { x: window.innerWidth / 2, y: window.innerHeight * 0.42 };
      const stage = targetUid ? { x: dest.x - 40, y: Math.max(140, dest.y - 150) } : dest;
      flyTo(node, stage.x, stage.y, 0.95, 200);
      pending = { uid, node };
      await wait(200);
    }
    const events = C.playCard(battle, index, targetUid);
    if (events.length && events[0].type === 'error') {
      if (node) node.remove();
      pending = null;
      CB.ui.toast(events[0].text, 'error');
      locked = false;
      syncAll();
      return;
    }
    await playEvents(events);
    if (pending) { pending.node.remove(); pending = null; }
    await afterAction();
  }

  function rejectCard(uid, reason) {
    const node = cardEls.get(uid);
    if (node) {
      node.classList.remove('shake');
      void node.offsetWidth;
      node.classList.add('shake');
    }
    sfx('error');
    CB.ui.toast(reason, 'error');
    if (reason && reason.includes('에너지')) {
      dom.energy.classList.remove('deny');
      void dom.energy.offsetWidth;
      dom.energy.classList.add('deny');
    }
  }

  async function endTurn() {
    if (locked || !active || battle.phase !== 'player') return;
    locked = true;
    cancelAll();
    renderControls();
    sfx('click');
    const events = C.endTurn(battle);
    await playEvents(events);
    await afterAction();
  }

  async function usePotion(slot, targetUid) {
    if (locked || !active) return;
    locked = true;
    cancelAll();
    const id = run.potions[slot];
    const def = CB.data.potions[id];
    if (def && targetUid && def.effects.some((e) => e.type === 'damage')) {
      const from = fx().centerOf(document.querySelectorAll('.potion-slot')[slot]);
      await fx().projectile(from, unitCenter(targetUid), def.id === 'poisonPotion' ? 'poison' : 'fire');
    }
    const events = C.usePotion(battle, slot, targetUid);
    CB.ui.hud.render(run);
    await playEvents(events);
    await afterAction();
  }

  /* ---------------- 대상 지정 ---------------- */
  function setHoverTarget(uid) {
    aimUid = uid;
    for (const [id, r] of Object.entries(unitEls)) {
      if (id === 'player') continue;
      r.root.classList.toggle('targeted', id === uid);
    }
    updateArrow();
  }

  function startTargeting(t) {
    targeting = t;
    dom.root.classList.add('targeting');
    const living = C.livingEnemies(battle);
    if (!aimUid || !living.some((e) => e.uid === aimUid)) aimUid = null;
    dom.arrow.classList.remove('hidden');
    updateArrow();
  }

  function arrowStart() {
    if (targeting && targeting.kind === 'potion') {
      const slotEl = document.querySelectorAll('.potion-slot')[targeting.slot];
      const c = fx().centerOf(slotEl);
      return { x: c.x, y: c.y + 16 };
    }
    const uid = targeting ? targeting.uid : drag && drag.uid;
    const node = cardEls.get(uid) || (drag && drag.node);
    if (!node) return { x: window.innerWidth / 2, y: window.innerHeight - 200 };
    const r = node.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + 10 };
  }

  function updateArrow() {
    if (!targeting && !(drag && drag.needsTarget && drag.active)) { dom.arrow.classList.add('hidden'); return; }
    const s = arrowStart();
    const e = aimUid && unitEls[aimUid] ? (() => { const r = unitEls[aimUid].art.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height * 0.45 }; })() : pointer;
    const cx = (s.x + e.x) / 2 + (e.x > s.x ? -40 : 40);
    const cy = Math.min(s.y, e.y) - 110;
    dom.arrowPath.setAttribute('d', `M${s.x.toFixed(1)} ${s.y.toFixed(1)} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${e.x.toFixed(1)} ${e.y.toFixed(1)}`);
    dom.arrow.classList.toggle('locked-on', !!aimUid);
    dom.arrow.classList.remove('hidden');
  }

  function clearSelection() {
    selected = null;
    targeting = null;
    dom.root && dom.root.classList.remove('targeting');
    if (dom.arrow) dom.arrow.classList.add('hidden');
    setHoverTarget(null);
  }

  function cancelAll() {
    if (drag && drag.node) { drag.node.classList.remove('dragging'); }
    drag = null;
    CB.ui.dragging = false;
    dom.playZone && dom.playZone.classList.remove('show', 'hot');
    clearSelection();
    layoutHand();
  }

  function selectCard(uid) {
    if (locked) return;
    const index = battle.hand.findIndex((c) => c.uid === uid);
    if (index < 0) return;
    const check = C.canPlay(battle, index);
    if (!check.ok) { rejectCard(uid, check.reason); return; }
    if (selected && selected.uid === uid) {
      if (!C.cardNeedsTarget(battle, index)) playCard(uid);
      else if (aimUid) playCard(uid, aimUid);
      else cancelAll();
      return;
    }
    clearSelection();
    selected = { uid };
    sfx('select');
    if (C.cardNeedsTarget(battle, index)) startTargeting({ kind: 'card', uid });
    renderHand();
  }

  function onUnitClick(uid) {
    if (locked) return;
    const u = unitOf(uid);
    if (!u || !u.alive) return;
    if (targeting && targeting.kind === 'card') playCard(targeting.uid, uid);
    else if (targeting && targeting.kind === 'potion') usePotion(targeting.slot, uid);
    else if (selected) playCard(selected.uid, uid);
  }

  function onFieldClick() {
    if (locked) return;
    if (selected && !targeting) playCard(selected.uid);
    else if (targeting) cancelAll();
  }

  /* ---------------- 드래그 ---------------- */
  function onCardPointerDown(e, uid) {
    if (locked || !active || e.button === 2) return;
    e.preventDefault();
    const node = cardEls.get(uid);
    drag = { uid, node, startX: e.clientX, startY: e.clientY, active: false, needsTarget: false, pointerId: e.pointerId };
    pointer = { x: e.clientX, y: e.clientY };
  }

  function playLineY() {
    return dom.hand.getBoundingClientRect().top - 30;
  }

  function onPointerMove(e) {
    pointer = { x: e.clientX, y: e.clientY };
    if (drag && !drag.active) {
      if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) > 12) {
        const index = battle.hand.findIndex((c) => c.uid === drag.uid);
        const check = index >= 0 ? C.canPlay(battle, index) : { ok: false, reason: '' };
        if (!check.ok) { rejectCard(drag.uid, check.reason); drag = null; return; }
        drag.active = true;
        drag.needsTarget = C.cardNeedsTarget(battle, index);
        CB.ui.dragging = true;
        CB.ui.tooltip.hide();
        clearSelection();
        hoverIndex = null;
        if (drag.needsTarget) {
          selected = { uid: drag.uid };
          layoutHand();
          dom.arrow.classList.remove('hidden');
        } else {
          drag.node.classList.add('dragging');
          dom.playZone.classList.add('show');
        }
      }
    }
    if (drag && drag.active) {
      if (drag.needsTarget) {
        const hit = document.elementFromPoint(e.clientX, e.clientY);
        const unitNode = hit && hit.closest && hit.closest('.unit-enemy:not(.dead):not(.dying)');
        setHoverTarget(unitNode ? unitNode.dataset.uid : null);
      } else {
        const handR = dom.hand.getBoundingClientRect();
        const nx = handR.left + handR.width / 2;
        const ny = handR.bottom - drag.node.offsetHeight / 2;
        drag.node.style.transition = 'transform .05s linear';
        drag.node.style.transform = `translate(${e.clientX - nx}px, ${e.clientY - ny}px) scale(1.08)`;
        drag.node.style.zIndex = '300';
        dom.playZone.classList.toggle('hot', e.clientY < playLineY());
      }
      updateArrow();
    } else if (targeting) {
      updateArrow();
    }
  }

  function onPointerUp(e) {
    if (!drag) return;
    const d = drag;
    drag = null;
    CB.ui.dragging = false;
    if (!d.active) {
      selectCard(d.uid);
      return;
    }
    d.node.classList.remove('dragging');
    d.node.style.transition = '';
    dom.playZone.classList.remove('show', 'hot');
    if (d.needsTarget) {
      const target = aimUid;
      if (target) playCard(d.uid, target);
      else cancelAll();
    } else if (e.clientY < playLineY()) {
      playCard(d.uid);
    } else {
      layoutHand();
    }
  }

  /* ---------------- 키보드 ---------------- */
  function onKey(e) {
    if (!active || CB.ui.modal.isOpen()) return;
    if (e.code === 'Escape') { cancelAll(); return; }
    if (locked) return;
    const digit = /^Digit([1-9])$/.exec(e.code) || /^Numpad([1-9])$/.exec(e.code);
    if (digit) {
      const uid = battle.hand[Number(digit[1]) - 1] && battle.hand[Number(digit[1]) - 1].uid;
      if (uid) selectCard(uid);
      return;
    }
    if (e.code === 'KeyE') { endTurn(); return; }
    if (targeting && (e.code === 'ArrowLeft' || e.code === 'ArrowRight' || e.code === 'Tab')) {
      e.preventDefault();
      const living = C.livingEnemies(battle);
      if (!living.length) return;
      let i = living.findIndex((u) => u.uid === aimUid);
      i = e.code === 'ArrowLeft' ? (i <= 0 ? living.length - 1 : i - 1) : (i + 1) % living.length;
      setHoverTarget(living[i].uid);
      sfx('hover');
      return;
    }
    if (e.code === 'Enter' || e.code === 'Space') {
      e.preventDefault();
      if (targeting && aimUid) {
        if (targeting.kind === 'card') playCard(targeting.uid, aimUid);
        else usePotion(targeting.slot, aimUid);
      } else if (selected && !targeting) playCard(selected.uid);
    }
  }

  /* ---------------- 크기 ---------------- */
  function resize() {
    if (!dom.root) return;
    const n = Math.max(1, C.livingEnemies(battle || { enemies: [] }).length || 1);
    const h = window.innerHeight;
    const w = window.innerWidth;
    const byH = (h - (w <= 520 ? 460 : 420)) / 330;
    const byW = (w * 0.62) / (n * 200);
    const u = Math.max(0.42, Math.min(1.15, byH, byW));
    dom.root.style.setProperty('--u', u.toFixed(3));
    layoutHand();
  }

  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('keydown', onKey);
  window.addEventListener('resize', () => { if (active) resize(); });
  window.addEventListener('contextmenu', (e) => { if (active && (selected || targeting)) { e.preventDefault(); cancelAll(); } });

  /* ---------------- 시작/종료 ---------------- */
  async function start(runRef, { enemies, kind }) {
    run = runRef;
    battle = C.createBattle(run, enemies, kind);
    active = true;
    locked = true;
    unitEls = {};
    cardEls.clear();
    shownHand = [];
    selected = null;
    targeting = null;
    pending = null;
    aimUid = null;
    build();
    disp = {};
    for (const u of [battle.player, ...battle.enemies]) disp[u.uid] = { hp: u.hp, block: u.block };
    piles = { draw: battle.drawPile.length, discard: 0, exhaust: 0 };
    CB.ui.showScreen('battle');
    renderUnits();
    renderPiles();
    renderEnergy();
    renderControls();
    if (CB.audio) CB.audio.music(kind === 'boss' ? 'boss' : kind === 'elite' ? 'elite' : 'battle');

    const promise = new Promise((resolve) => { resolveBattle = resolve; });
    await wait(250);
    if (kind === 'boss') {
      sfx('bossRoar');
      fx().shake(1.6);
      await fx().banner(battle.enemies[0].name, { kind: 'boss', sub: '보스 출현', duration: 1800 });
    } else if (kind === 'elite') {
      sfx('debuff');
      await fx().banner('정예 출현', { kind: 'enemy', sub: battle.enemies.map((e) => e.name).join(' · '), duration: 1300 });
    }
    if (!active) return promise;
    const events = C.startBattle(battle);
    await playEvents(events);
    await afterAction();
    return promise;
  }

  async function endBattle() {
    const result = C.result(battle);
    locked = true;
    cancelAll();
    renderControls();
    const fin = C.finishBattle(battle);
    await playEvents(fin);
    if (result === 'won') {
      sfx('victory');
      await fx().banner('승리!', { kind: 'victory', duration: 1400 });
    } else {
      sfx('defeat');
      if (CB.audio) CB.audio.music('defeat');
      await fx().banner('쓰러졌다...', { kind: 'defeat', duration: 1900 });
    }
    finish(result);
  }

  function cleanup() {
    document.querySelectorAll('.flying-card').forEach((n) => n.remove());
    if (dom.arrow) dom.arrow.remove();
    CB.ui.dragging = false;
  }

  function finish(result) {
    active = false;
    cleanup();
    const r = resolveBattle;
    resolveBattle = null;
    const b = battle;
    battle = null;
    if (r) r(result);
    return b;
  }

  return {
    start,
    isActive: () => active,
    current: () => (active ? battle : null),
    usePotionFlow(slot) {
      if (!active || locked || !battle) return;
      if (!run.potions[slot]) return;
      if (battle.phase !== 'player') return;
      if (C.potionNeedsTarget(battle, slot)) {
        clearSelection();
        startTargeting({ kind: 'potion', slot });
        CB.ui.toast('물약을 사용할 대상을 고르세요.');
      } else {
        usePotion(slot);
      }
    },
    async debugWin() {
      if (!active || !battle) return;
      locked = true;
      const events = C.debugKillAll(battle);
      await playEvents(events);
      await afterAction();
    },
    debugLose() {
      if (!active || !battle) return;
      battle.player.hp = 0;
      battle.player.alive = false;
      battle.phase = 'lost';
      endBattle();
    },
    abort() {
      active = false;
      cleanup();
      resolveBattle = null;
      battle = null;
    },
  };
})();
