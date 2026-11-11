'use strict';

/* =========================================================
 * 화면 공용 — 화면 전환, 모달, 토스트, 툴팁, 설정, 소리 도우미
 * ========================================================= */
(() => {
  const { el } = RG.util;
  const screens = {};
  let current = null;

  /** 화면 등록: { id, enter(data), leave(), onKey(e) } */
  function register(id, def) { screens[id] = Object.assign({ id }, def); }

  function show(id, data) {
    const next = screens[id];
    if (!next) throw new Error(`화면 없음: ${id}`);
    if (current && current.leave) current.leave();
    document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
    const sec = document.getElementById(`screen-${id}`);
    sec.classList.add('active');
    current = next;
    closeAllModals();
    hideTooltip();
    if (next.enter) next.enter(sec, data || {});
    document.body.dataset.screen = id;
  }
  const currentId = () => (current ? current.id : null);

  /* ---------------- 소리 ---------------- */
  function sfx(name, opts) { try { if (RG.audio) RG.audio.play(name, opts); } catch (e) { /* 무시 */ } }
  function music(track) { try { if (RG.audio) RG.audio.music(track); } catch (e) { /* 무시 */ } }

  /* ---------------- 설정 ---------------- */
  const DEFAULT_SETTINGS = { master: 0.8, sfx: 0.8, music: 0.5, muted: false, speed: 1, shake: true, numbers: true, bigText: false, paths: true };
  let settings = null;
  function getSettings() {
    if (!settings) settings = Object.assign({}, DEFAULT_SETTINGS, RG.save.get(RG.save.KEYS.settings, {}));
    return settings;
  }
  function setSettings(patch) {
    Object.assign(getSettings(), patch);
    RG.save.set(RG.save.KEYS.settings, settings);
    applySettings();
  }
  function applySettings() {
    const s = getSettings();
    try {
      if (RG.audio) { RG.audio.setVolume({ master: s.master, sfx: s.sfx, music: s.music }); RG.audio.setMuted(s.muted); }
    } catch (e) { /* 무시 */ }
    RG.fx.settings.shake = s.shake;
    RG.fx.settings.numbers = s.numbers;
    RG.render.overlay.showPaths = s.paths;
    document.documentElement.classList.toggle('big-text', !!s.bigText);
  }

  /* ---------------- 모달 ---------------- */
  const modals = [];
  function modal(content, opts = {}) {
    const root = document.getElementById('modal-root');
    const back = el('div', { class: `modal-back ${opts.className || ''}` });
    const box = el('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true' });
    if (opts.title) box.appendChild(el('h2', { class: 'modal-title', text: opts.title }));
    if (typeof content === 'string') box.appendChild(el('div', { class: 'modal-body', html: content }));
    else box.appendChild(content);
    if (opts.buttons) {
      const row = el('div', { class: 'modal-buttons' });
      for (const b of opts.buttons.filter(Boolean)) {
        row.appendChild(el('button', {
          class: `btn ${b.primary ? 'btn-primary' : ''} ${b.danger ? 'btn-danger' : ''}`,
          text: b.text,
          onclick: () => { sfx('click'); if (b.keep !== true) close(); if (b.onClick) b.onClick(); },
        }));
      }
      box.appendChild(row);
    }
    back.appendChild(box);
    if (opts.dismiss !== false) back.addEventListener('pointerdown', (e) => { if (e.target === back) { close(); if (opts.onClose) opts.onClose(); } });
    root.appendChild(back);
    // 키보드: 마지막(확인) 버튼에 초점 → Enter로 확정, Esc로 닫기
    const btns = box.querySelectorAll('.modal-buttons .btn');
    if (btns.length) btns[btns.length - 1].focus({ preventScroll: true });
    const handle = { el: box, close, onClose: opts.onClose };
    modals.push(handle);
    function close() {
      back.remove();
      const i = modals.indexOf(handle);
      if (i >= 0) modals.splice(i, 1);
    }
    return handle;
  }
  function closeAllModals() { while (modals.length) modals[modals.length - 1].close(); }
  const modalOpen = () => modals.length > 0;
  function closeTopModal() {
    const m = modals[modals.length - 1];
    if (m) { m.close(); if (m.onClose) m.onClose(); return true; }
    return false;
  }

  function confirmBox(text, onYes, opts = {}) {
    return modal(el('p', { class: 'modal-text', text }), {
      title: opts.title || '확인',
      buttons: [{ text: opts.no || '취소' }, { text: opts.yes || '확인', primary: !opts.danger, danger: !!opts.danger, onClick: onYes }],
    });
  }

  /* ---------------- 토스트 ---------------- */
  function toast(text, kind = 'info', ms = 1800) {
    const root = document.getElementById('toast-root');
    const t = el('div', { class: `toast toast-${kind}`, text });
    root.appendChild(t);
    while (root.children.length > 3) root.firstChild.remove();
    setTimeout(() => t.classList.add('out'), ms);
    setTimeout(() => t.remove(), ms + 400);
  }

  /* ---------------- 툴팁 ---------------- */
  let tipTarget = null;
  function tooltipFor(node, getHtml) {
    node.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') showTooltip(node, typeof getHtml === 'function' ? getHtml() : getHtml); });
    node.addEventListener('pointerleave', hideTooltip);
  }
  function showTooltip(node, html) {
    const tip = document.getElementById('tooltip');
    tip.innerHTML = html;
    tip.classList.add('show');
    tipTarget = node;
    const r = node.getBoundingClientRect();
    const tw = tip.offsetWidth;
    const th = tip.offsetHeight;
    let x = r.left + r.width / 2 - tw / 2;
    let y = r.top - th - 8;
    if (y < 6) y = r.bottom + 8;
    x = Math.max(6, Math.min(window.innerWidth - tw - 6, x));
    tip.style.left = `${x}px`;
    tip.style.top = `${y}px`;
  }
  function hideTooltip() {
    const tip = document.getElementById('tooltip');
    if (tip) tip.classList.remove('show');
    tipTarget = null;
  }

  /* ---------------- 그림 도우미 ---------------- */
  function svgImg(svg, cls, alt) {
    return el('img', { class: cls || '', src: RG.art.sprites.dataUrl(svg), alt: alt || '', draggable: 'false' });
  }
  function icon(name, cls) { return svgImg(RG.art.icon(name), `icon ${cls || ''}`, name); }
  function towerImg(type, level = 1, branch = null, cls = '') { return svgImg(RG.art.tower(type, level, branch), `tower-img ${cls}`, RG.data.towers[type].name); }
  function enemyImg(type, cls = '') { return svgImg(RG.art.enemy(type, 0), `enemy-img ${cls}`, RG.data.enemies[type].name); }
  function portrait(id, mood = 'normal', cls = '') { return svgImg(RG.art.portrait(id, mood), `portrait ${cls}`, id); }

  function stars(n, max = 3, cls = '') {
    const box = el('span', { class: `stars ${cls}` });
    for (let i = 0; i < max; i++) box.appendChild(icon(i < n ? 'star' : 'star_empty', 'star-icon'));
    return box;
  }

  function elementBadge(element) {
    const e = RG.data.elements[element];
    return el('span', { class: `el-badge el-${element}` }, [icon(element, 'el-icon'), e.name]);
  }

  Object.assign(RG.ui, {
    register, show, currentId, sfx, music, getSettings, setSettings, applySettings, modal, closeAllModals, modalOpen, closeTopModal,
    confirmBox, toast, tooltipFor, showTooltip, hideTooltip, svgImg, icon, towerImg, enemyImg, portrait, stars, elementBadge, screens,
  });
})();
