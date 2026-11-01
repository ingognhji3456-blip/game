'use strict';

/* =========================================================
 * 공용 UI — 화면 전환, 카드 렌더링, 툴팁, 모달, 카드 선택, HUD, 토스트
 * ========================================================= */
(() => {
  const U = CB.util;
  const el = U.el;
  const $ = (id) => document.getElementById(id);
  const sfx = (name) => CB.audio && CB.audio.play(name);

  const TYPE_NAMES = { attack: '공격', skill: '스킬', power: '파워', status: '상태이상', curse: '저주' };
  const ACT_NAMES = { 1: '속삭이는 숲', 2: '잊혀진 폐허', 3: '불타는 심연' };
  CB.ui.TYPE_NAMES = TYPE_NAMES;
  CB.ui.ACT_NAMES = ACT_NAMES;
  CB.ui.sfx = sfx;

  /* ---------------- 화면 전환 ---------------- */
  const SCREEN_BG = { title: 'title', map: 'map', shop: 'shop', rest: 'rest', event: 'event', treasure: 'event', reward: 'map', gameover: 'title' };
  CB.ui.currentScreen = null;
  CB.ui.showScreen = (name, opts = {}) => {
    document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === `screen-${name}`));
    document.body.className = document.body.className.replace(/\bscreen-\w+/g, '').trim() + ` screen-${name}`;
    const run = CB.ui.flow && CB.ui.flow.run;
    const bg = opts.bg || (name === 'battle' || name === 'reward' ? `act${run ? run.act : 1}` : SCREEN_BG[name] || 'map');
    if (CB.art && CB.art.background) $('app').style.background = CB.art.background(bg);
    const showHud = !['title', 'gameover'].includes(name);
    $('hud').classList.toggle('hidden', !showHud);
    if (showHud && run) CB.ui.hud.render(run);
    CB.ui.tooltip.hide();
    CB.ui.currentScreen = name;
  };

  /* ---------------- 카드 ---------------- */
  CB.ui.renderCard = (view, opts = {}) => {
    const size = opts.size || 'md';
    const classes = ['card', `card-${view.type}`, `rarity-${view.rarity}`, `size-${size}`];
    if (view.upgraded) classes.push('upgraded');
    if (view.unplayable) classes.push('no-cost');
    if (view.playable === false) classes.push('unplayable-now');
    if (opts.hoverable) classes.push('hoverable');
    const costClass = view.cost < view.baseCost ? 'card-cost cheaper' : 'card-cost';
    const art = CB.art && CB.art.cardIcon ? CB.art.cardIcon(view.art, view.type) : '';
    const node = el('div', {
      class: classes.join(' '),
      dataset: { uid: view.uid || '', id: view.id },
      html: `
        <div class="card-frame">
          <div class="${costClass}">${view.cost}</div>
          <div class="card-gem"></div>
          <div class="card-name">${U.escapeHtml(view.name)}</div>
          <div class="card-art">${art}</div>
          <div class="card-type">${TYPE_NAMES[view.type] || view.type}</div>
          <div class="card-desc"><div>${view.descHTML}</div></div>
        </div>`,
    });
    if (opts.tooltip !== false && view.keywords && view.keywords.length) {
      CB.ui.tooltip.bind(node, () => CB.ui.keywordHTML(view.keywords), { side: 'right' });
    }
    return node;
  };

  /** 덱/보상 등 전투 밖 카드 */
  CB.ui.cardFromInst = (inst, opts) => CB.ui.renderCard(CB.combat.cardView(inst), opts);
  CB.ui.cardFromId = (id, upgraded, opts) => CB.ui.renderCard(CB.combat.cardView({ uid: `v_${id}`, id, upgraded: !!upgraded }), opts);

  /* ---------------- 툴팁 ---------------- */
  const tip = {
    node: null,
    owner: null,
    timer: null,
    show(html, target, side = 'top') {
      if (!html) return;
      const node = this.node || (this.node = $('tooltip'));
      node.innerHTML = html;
      node.classList.add('show');
      const r = target.getBoundingClientRect();
      const tw = node.offsetWidth;
      const th = node.offsetHeight;
      let x;
      let y;
      if (side === 'right') { x = r.right + 10; y = r.top + r.height / 2 - th / 2; }
      else if (side === 'bottom') { x = r.left + r.width / 2 - tw / 2; y = r.bottom + 10; }
      else { x = r.left + r.width / 2 - tw / 2; y = r.top - th - 10; }
      if (side === 'right' && x + tw > window.innerWidth - 8) x = r.left - tw - 10;
      if (side === 'top' && y < 8) y = r.bottom + 10;
      x = U.clamp(x, 8, window.innerWidth - tw - 8);
      y = U.clamp(y, 8, window.innerHeight - th - 8);
      node.style.left = `${x}px`;
      node.style.top = `${y}px`;
    },
    hide() {
      if (this.node) this.node.classList.remove('show');
      this.owner = null;
    },
    bind(target, content, opts = {}) {
      const resolve = () => (typeof content === 'function' ? content() : content);
      target.addEventListener('mouseenter', () => {
        if (CB.ui.dragging) return;
        tip.owner = target;
        clearTimeout(tip.timer);
        const showNow = () => { if (tip.owner === target && !CB.ui.dragging) tip.show(resolve(), target, opts.side || 'top'); };
        if (opts.delay) tip.timer = setTimeout(showNow, opts.delay);
        else showNow();
      });
      target.addEventListener('mouseleave', () => { clearTimeout(tip.timer); if (tip.owner === target) tip.hide(); });
      target.addEventListener('touchstart', () => {
        clearTimeout(tip.timer);
        tip.timer = setTimeout(() => { tip.owner = target; tip.show(resolve(), target, opts.side || 'top'); }, 420);
      }, { passive: true });
      target.addEventListener('touchend', () => { clearTimeout(tip.timer); setTimeout(() => tip.hide(), 1400); });
    },
  };
  CB.ui.tooltip = {
    bind: (t, c, o) => tip.bind(t, c, o),
    show: (h, t, s) => tip.show(h, t, s),
    hide: () => tip.hide(),
  };

  CB.ui.keywordHTML = (ids) => (ids || []).map((id) => {
    const k = CB.data.keywords[id];
    if (!k) return '';
    return `<div class="tt-kw"><span class="tt-title">${k.icon} ${k.name}</span><p>${k.desc.replace(/\s*\(\{value\}턴\)/g, '').replace(/\{value\}/g, 'X')}</p></div>`;
  }).join('');

  CB.ui.relicHTML = (id) => {
    const r = CB.data.relics[id];
    if (!r) return '';
    const rarity = { starter: '시작', common: '일반', uncommon: '고급', rare: '희귀', boss: '보스', shop: '상점', event: '이벤트' }[r.rarity] || '';
    return `<span class="tt-title">${r.icon} ${U.escapeHtml(r.name)}</span><span class="tt-sub">${rarity} 유물</span><p>${U.escapeHtml(r.desc)}</p>`;
  };
  CB.ui.potionHTML = (id) => {
    const p = CB.data.potions[id];
    if (!p) return '';
    return `<span class="tt-title">${U.escapeHtml(p.name)}</span><p>${U.escapeHtml(p.desc)}</p>`;
  };

  /* ---------------- 모달 ---------------- */
  const modalStack = [];
  CB.ui.modal = {
    open({ title, sub, html, el: content, buttons = [], dismissable = false, className = '', onClose }) {
      CB.ui.tooltip.hide();
      const box = el('div', { class: `modal ${className}` });
      if (title) box.appendChild(el('h2', { class: 'modal-title title-ornament', text: title }));
      if (sub) box.appendChild(el('p', { class: 'modal-sub', html: sub }));
      const body = el('div', { class: 'modal-body' });
      if (html) body.innerHTML = html;
      if (content) body.appendChild(content);
      box.appendChild(body);
      const handle = {};
      if (buttons.length) {
        const row = el('div', { class: 'modal-buttons' });
        for (const b of buttons) {
          const btn = el('button', {
            class: `btn ${b.kind === 'secondary' ? 'secondary' : b.kind === 'danger' ? 'danger' : ''}`,
            text: b.label,
            onclick: () => { sfx('click'); if (b.onClick) b.onClick(handle); else handle.close(); },
          });
          if (b.disabled) btn.disabled = true;
          if (b.id) btn.id = b.id;
          row.appendChild(btn);
        }
        box.appendChild(row);
        handle.buttons = row;
      }
      if (dismissable) {
        const x = el('button', { class: 'icon-btn modal-close', text: '✕', 'aria-label': '닫기', onclick: () => handle.close() });
        box.appendChild(x);
      }
      const backdrop = el('div', { class: 'modal-backdrop' }, [box]);
      if (dismissable) backdrop.addEventListener('click', (e) => { if (e.target === backdrop) handle.close(); });
      $('modal-root').appendChild(backdrop);
      handle.body = body;
      handle.box = box;
      handle.dismissable = dismissable;
      handle.close = () => {
        const i = modalStack.indexOf(handle);
        if (i >= 0) modalStack.splice(i, 1);
        backdrop.remove();
        CB.ui.tooltip.hide();
        if (onClose) onClose();
      };
      modalStack.push(handle);
      return handle;
    },
    close() {
      const top = modalStack[modalStack.length - 1];
      if (top) top.close();
    },
    isOpen: () => modalStack.length > 0,
    top: () => modalStack[modalStack.length - 1],
  };

  /* ---------------- 카드 선택 ---------------- */
  CB.ui.selectCards = (o) => new Promise((resolve) => {
    const cards = o.cards || [];
    const min = o.min != null ? o.min : 1;
    const max = o.max != null ? o.max : 1;
    const selected = new Set();
    const grid = el('div', { class: `card-grid${o.viewOnly ? ' view-only' : ''}` });
    const preview = el('div', { class: 'upgrade-preview' });
    const wrapEl = el('div', {}, o.preview === 'upgrade' ? [preview, grid] : [grid]);
    if (!cards.length) grid.appendChild(el('p', { class: 'modal-sub', text: '카드가 없습니다.' }));
    const sorted = o.sort === false ? cards : cards.slice().sort((a, b) => {
      const da = CB.combat.cardDef(a);
      const db = CB.combat.cardDef(b);
      const order = { attack: 0, skill: 1, power: 2, status: 3, curse: 4 };
      return (order[da.type] - order[db.type]) || (da.cost - db.cost) || da.name.localeCompare(db.name, 'ko');
    });
    let handle;
    const update = () => {
      if (handle && handle.buttons) {
        const ok = handle.buttons.querySelector('#select-confirm');
        if (ok) ok.disabled = selected.size < min || selected.size > max;
      }
      if (o.preview === 'upgrade') {
        preview.innerHTML = '';
        const uid = [...selected][0];
        const inst = cards.find((c) => c.uid === uid);
        if (inst) {
          preview.appendChild(CB.ui.cardFromInst(inst, { size: 'md', tooltip: false }));
          preview.appendChild(el('div', { class: 'arrow', text: '➜' }));
          preview.appendChild(CB.ui.cardFromInst({ ...inst, upgraded: true }, { size: 'md', tooltip: false }));
        } else {
          preview.appendChild(el('p', { class: 'modal-sub', text: '강화할 카드를 고르세요.' }));
        }
      }
    };
    for (const inst of sorted) {
      const node = CB.ui.cardFromInst(inst, { size: 'md', hoverable: !o.viewOnly });
      if (!o.viewOnly) {
        node.addEventListener('click', () => {
          sfx('select');
          if (selected.has(inst.uid)) selected.delete(inst.uid);
          else {
            if (max === 1) { selected.clear(); grid.querySelectorAll('.selected').forEach((n) => n.classList.remove('selected')); }
            if (selected.size >= max) return;
            selected.add(inst.uid);
          }
          node.classList.toggle('selected', selected.has(inst.uid));
          update();
        });
      }
      grid.appendChild(node);
    }
    const buttons = [];
    // resolve 를 먼저 호출해야 onClose 의 resolve(null) 보다 우선합니다.
    if (!o.viewOnly) buttons.push({ id: 'select-confirm', label: o.confirmLabel || '확인', onClick: (h) => { resolve([...selected]); h.close(); } });
    if (o.viewOnly || o.cancellable) buttons.push({ label: o.viewOnly ? '닫기' : '취소', kind: 'secondary', onClick: (h) => { resolve(null); h.close(); } });
    handle = CB.ui.modal.open({
      title: o.title, sub: o.subtitle, el: wrapEl, buttons,
      dismissable: !!(o.viewOnly || o.cancellable),
      onClose: () => resolve(null),
    });
    update();
  });

  CB.ui.viewPile = (title, insts, battle) => {
    const grid = el('div', { class: 'card-grid view-only' });
    if (!insts.length) grid.appendChild(el('p', { class: 'modal-sub', text: '비어 있습니다.' }));
    for (const inst of insts) grid.appendChild(CB.ui.renderCard(CB.combat.cardView(inst, battle), { size: 'md' }));
    CB.ui.modal.open({ title: `${title} (${insts.length})`, el: grid, dismissable: true, buttons: [{ label: '닫기', kind: 'secondary' }] });
  };

  /* ---------------- 토스트 ---------------- */
  CB.ui.toast = (text, kind = '') => {
    const root = $('toast-root');
    const t = el('div', { class: `toast ${kind}`, text });
    root.appendChild(t);
    while (root.children.length > 3) root.firstChild.remove();
    setTimeout(() => t.remove(), 2300);
  };

  /* ---------------- HUD ---------------- */
  let lastHud = { hp: null, gold: null };
  CB.ui.hud = {
    render(run) {
      if (!run) return;
      const battle = CB.ui.battle && CB.ui.battle.current && CB.ui.battle.current();
      const hp = battle && !battle.finished ? battle.player.hp : run.player.hp;
      const maxHp = battle && !battle.finished ? battle.player.maxHp : run.player.maxHp;
      $('hud-hp-text').textContent = `${hp}/${maxHp}`;
      $('hud-gold-text').textContent = run.player.gold;
      if (lastHud.gold !== null && lastHud.gold !== run.player.gold) bump($('hud-gold'));
      if (lastHud.hp !== null && lastHud.hp !== hp) bump($('hud-hp'));
      lastHud = { hp, gold: run.player.gold };
      const nodeLabel = run.act <= 3 ? `<b>${run.act}막</b> · ${ACT_NAMES[run.act] || ''} · ${run.floor}층` : '';
      $('hud-floor').innerHTML = nodeLabel;
      $('hud-deck-count').textContent = run.deck.length;

      // 물약
      const pots = $('hud-potions');
      pots.innerHTML = '';
      run.potions.forEach((id, slot) => {
        const def = id && CB.data.potions[id];
        const btn = el('button', { class: `potion-slot${def ? ' filled' : ''}`, 'aria-label': def ? def.name : '빈 물약 슬롯' });
        if (def) {
          btn.innerHTML = CB.art.potion(def.color, def.shape);
          CB.ui.tooltip.bind(btn, () => CB.ui.potionHTML(id), { side: 'bottom' });
          btn.addEventListener('click', () => onPotionClick(run, slot));
        }
        pots.appendChild(btn);
      });

      // 유물
      const relics = $('hud-relics');
      relics.innerHTML = '';
      for (const id of run.relics) {
        const def = CB.data.relics[id];
        if (!def) continue;
        const node = el('div', { class: `relic-icon${def.rarity === 'boss' ? ' boss' : ''}`, dataset: { relic: id }, text: def.icon });
        const counter = battle ? CB.combat.relicCounter(battle, id) : null;
        if (counter !== null && counter !== undefined) node.appendChild(el('span', { class: 'relic-counter', text: String(counter) }));
        CB.ui.tooltip.bind(node, () => CB.ui.relicHTML(id), { side: 'bottom' });
        relics.appendChild(node);
      }
      $('hud-mute').textContent = CB.audio && CB.audio.isMuted() ? '🔇' : '🔊';
    },
    flashRelic(id) {
      const node = document.querySelector(`.relic-icon[data-relic="${id}"]`);
      if (!node) return;
      node.classList.remove('pulse');
      void node.offsetWidth;
      node.classList.add('pulse');
    },
  };
  function bump(node) {
    node.classList.remove('bump');
    void node.offsetWidth;
    node.classList.add('bump');
  }

  function onPotionClick(run, slot) {
    const id = run.potions[slot];
    if (!id) return;
    sfx('click');
    if (CB.ui.battle && CB.ui.battle.isActive()) {
      CB.ui.battle.usePotionFlow(slot);
      return;
    }
    const def = CB.data.potions[id];
    CB.ui.modal.open({
      title: def.name,
      className: 'small',
      html: `<div style="display:flex;gap:14px;align-items:center;justify-content:center"><div style="width:64px;height:64px">${CB.art.potion(def.color, def.shape)}</div><p>${U.escapeHtml(def.desc)}<br><span class="tt-sub">물약은 전투 중에만 사용할 수 있습니다.</span></p></div>`,
      dismissable: true,
      buttons: [
        { label: '버리기', kind: 'danger', onClick: (h) => { CB.run.discardPotion(run, slot); CB.save.saveRun(run); CB.ui.hud.render(run); h.close(); } },
        { label: '닫기', kind: 'secondary' },
      ],
    });
  }

  // HUD 버튼
  document.addEventListener('DOMContentLoaded', () => {
    $('hud-deck').addEventListener('click', () => {
      const run = CB.ui.flow && CB.ui.flow.run;
      if (!run) return;
      sfx('click');
      CB.ui.selectCards({ title: '내 덱', subtitle: `${run.deck.length}장`, cards: run.deck, viewOnly: true });
    });
    $('hud-map').addEventListener('click', () => {
      const run = CB.ui.flow && CB.ui.flow.run;
      if (!run || CB.ui.currentScreen === 'map') return;
      sfx('click');
      CB.ui.map.peek(run);
    });
    $('hud-mute').addEventListener('click', () => {
      if (!CB.audio) return;
      CB.audio.init();
      const settings = CB.save.loadSettings();
      settings.muted = !CB.audio.isMuted();
      CB.save.saveSettings(settings);
      CB.audio.setMuted(settings.muted);
      $('hud-mute').textContent = settings.muted ? '🔇' : '🔊';
    });
    $('hud-settings').addEventListener('click', () => { sfx('click'); CB.ui.flow.openSettings(); });
  });

  CB.ui.esc = U.escapeHtml;
})();
