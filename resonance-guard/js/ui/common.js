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
    // 키보드로 쓰는 중이면 첫 초점: data.focus(같은 화면을 다시 그릴 때 누르던 것) → [data-autofocus] → 첫 버튼
    if (kbUser) requestAnimationFrame(() => {
      if (current !== next || modals.length) return;
      const a = document.activeElement;
      if (a && a !== document.body && sec.contains(a)) return; // 화면이 스스로 초점을 줌
      const f = (data && data.focus && sec.querySelector(`[data-focus="${data.focus}"]`)) || sec.querySelector('[data-autofocus]') || sec.querySelector('button:not([disabled]), [tabindex="0"]');
      if (f) f.focus({ preventScroll: true });
    });
  }
  /* 입력 방식: 키보드(Tab·방향키·Enter)를 쓰면 켜지고, 마우스·터치를 쓰면 꺼짐 — 초점을 자동으로 줄지 정할 때 */
  let kbUser = false;
  document.addEventListener('keydown', (e) => { if (/^(Tab|Arrow|Enter| |Escape)/.test(e.key)) kbUser = true; }, true);
  document.addEventListener('pointerdown', () => { kbUser = false; }, true);
  const keyboardUser = () => kbUser;
  const currentId = () => (current ? current.id : null);

  /* ---------------- 소리 ---------------- */
  function sfx(name, opts) { try { if (RG.audio) RG.audio.play(name, opts); } catch (e) { /* 무시 */ } }
  function music(track) { try { if (RG.audio) RG.audio.music(track); } catch (e) { /* 무시 */ } }

  /* ---------------- 설정 ---------------- */
  // reduceFx(효과 줄이기)는 기기의 "동작 줄이기" 설정을 따라 기본값을 정함
  const prefersReduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const DEFAULT_SETTINGS = { master: 0.8, sfx: 0.8, music: 0.5, muted: false, speed: 1, shake: true, numbers: true, bigText: false, paths: true, reduceFx: prefersReduced, cvd: false };
  /* 색약 친화 색 (설정 cvd): 원소 6색과 좋음·주의·나쁨 색을 적록·청황 색약에서도 서로 구별되는 값으로 (가장 가까운 짝의 색차 ΔE 16 이상).
     원소 아이콘·글자가 함께 있으므로 색은 보조 — 이미 구운 탑·적 그림의 색은 그대로 */
  const CVD = {
    fire: ['#ff5410', '#822502', '#feac8c'], frost: ['#70daff', '#3186a1', '#ebf9fe'], storm: ['#a970ff', '#542d95', '#d0b2f3'],
    earth: ['#30a874', '#055637', '#a1d0b6'], light: ['#fbe048', '#a18e17', '#fff6dd'], dark: ['#e783b3', '#873e62', '#f6c7dc'],
  };
  const CVD_UI = { '--good': '#93eafd', '--warn': '#ffeb12', '--bad': '#e0677f' };
  let elemOrig = null;
  function applyPalette(on) {
    const E = RG.data.elements;
    if (!elemOrig) { elemOrig = {}; for (const [k, v] of Object.entries(E)) elemOrig[k] = [v.color, v.dark, v.light]; }
    const root = document.documentElement.style;
    for (const k of Object.keys(elemOrig)) {
      const [c, d, l] = on && CVD[k] ? CVD[k] : elemOrig[k];
      Object.assign(E[k], { color: c, dark: d, light: l });
      root.setProperty(`--${k}`, c);
    }
    for (const [v, c] of Object.entries(CVD_UI)) { if (on) root.setProperty(v, c); else root.removeProperty(v); }
    document.documentElement.classList.toggle('cvd', !!on);
  }
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
    RG.fx.settings.reduce = !!s.reduceFx;
    applyPalette(!!s.cvd);
    document.documentElement.classList.toggle('reduce-fx', !!s.reduceFx);
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
    const opener = document.activeElement;
    root.appendChild(back);
    // 키보드: 마지막(확인) 버튼에 초점 → Enter로 확정, Esc로 닫기. 되돌릴 수 없는 확인(위험 버튼)이면 취소 쪽에 초점
    const btns = [...box.querySelectorAll('.modal-buttons .btn')];
    const danger = opts.buttons && opts.buttons.filter(Boolean).some((b) => b.danger);
    const first = danger ? btns.find((b) => !b.classList.contains('btn-danger')) : btns[btns.length - 1];
    if (first) first.focus({ preventScroll: true });
    else { box.tabIndex = -1; box.focus({ preventScroll: true }); }
    const handle = { el: box, close, onClose: opts.onClose, dismiss: opts.dismiss !== false };
    modals.push(handle);
    function close() {
      back.remove();
      const i = modals.indexOf(handle);
      if (i >= 0) modals.splice(i, 1);
      // 연 곳으로 초점을 돌려줌 (아직 화면에 있고 다른 창이 없을 때)
      if (!modals.length && opener && opener !== document.body && document.contains(opener) && !opener.disabled) opener.focus({ preventScroll: true });
    }
    return handle;
  }
  /* 창이 떠 있을 때: Tab은 창 안에서만 돌고, Esc는 맨 위 창을 닫음 (화면들의 키 처리보다 먼저 — 이 파일이 먼저 등록됨) */
  document.addEventListener('keydown', (e) => {
    const m = modals[modals.length - 1];
    if (!m) return;
    if (e.key === 'Escape') {
      if (m.dismiss) closeTopModal();
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }
    if (e.key === 'Tab') {
      const items = [...m.el.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])')].filter((x) => x.offsetParent !== null);
      if (!items.length) { e.preventDefault(); return; }
      const i = items.indexOf(document.activeElement);
      const next = e.shiftKey ? (i <= 0 ? items.length - 1 : i - 1) : (i < 0 || i >= items.length - 1 ? 0 : i + 1);
      items[next].focus();
      e.preventDefault();
    }
  });
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
    // 종류를 색(왼쪽 띠)만이 아니라 기호로도 (색약)
    const glyph = kind === 'warn' ? '⚠ ' : kind === 'good' ? '✓ ' : '';
    const t = el('div', { class: `toast toast-${kind}`, text: glyph && !String(text).startsWith(glyph.trim()) ? glyph + text : text, role: 'status' });
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
    // 키보드 초점에도 (마우스로 눌러 생긴 초점은 제외)
    node.addEventListener('focus', () => { if (node.matches(':focus-visible')) showTooltip(node, typeof getHtml === 'function' ? getHtml() : getHtml); });
    node.addEventListener('blur', hideTooltip);
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
    register, show, currentId, keyboardUser, sfx, music, getSettings, setSettings, applySettings, modal, closeAllModals, modalOpen, closeTopModal,
    confirmBox, toast, tooltipFor, showTooltip, hideTooltip, svgImg, icon, towerImg, enemyImg, portrait, stars, elementBadge, screens,
  });
})();
