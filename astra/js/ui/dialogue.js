'use strict';

/* =========================================================
 * 대화 — 초상화, 타자기 효과, 선택지, 플래그 분기, 건너뛰기/자동/기록
 *   AZ.ui.dialogue.play(lines, { flags, theme }) → Promise (끝나면 resolve)
 * ========================================================= */
window.AZ = window.AZ || {};
AZ.ui = AZ.ui || {};

AZ.ui.dialogue = (() => {
  const U = AZ.util;
  const NAMES = { kai: '카이온', lia: '리아', zero: '제로', astra: 'ASTRA', sera: '세라', protocol: '프로토콜', system: 'SYSTEM', narr: '' };
  const PORTRAIT = { kai: 'kai', lia: 'lia', zero: 'zero', astra: 'astra', sera: 'boss_sera', protocol: 'boss_protocol' };
  const ACCENT = { kai: '#7cc8ff', lia: '#7ce8ff', zero: '#ff4d6d', astra: '#e8f0ff', sera: '#e2b8ff', protocol: '#ffe9a8', system: '#ff8a9a', npc: '#ffd6a0' };

  let root = null;
  let els = {};
  let state = null;

  function h(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  function build(parent) {
    root = h('div', 'dlg hidden');
    root.innerHTML = `
      <canvas class="dlg-bg" width="1280" height="720"></canvas>
      <div class="dlg-shade"></div>
      <img class="dlg-portrait left" alt="">
      <img class="dlg-portrait right" alt="">
      <div class="dlg-flash"></div>
      <div class="dlg-box">
        <div class="dlg-name"></div>
        <div class="dlg-text"></div>
        <div class="dlg-next">▼</div>
      </div>
      <div class="dlg-choices"></div>
      <div class="dlg-ctrl">
        <button type="button" data-a="log">기록</button>
        <button type="button" data-a="auto">자동</button>
        <button type="button" data-a="skip">건너뛰기 ▶▶</button>
      </div>
      <div class="dlg-log hidden"><div class="dlg-log-inner"></div><button type="button" class="btn" data-a="closelog">닫기</button></div>`;
    parent.appendChild(root);
    els = {
      bg: root.querySelector('.dlg-bg'),
      left: root.querySelector('.dlg-portrait.left'),
      right: root.querySelector('.dlg-portrait.right'),
      box: root.querySelector('.dlg-box'),
      name: root.querySelector('.dlg-name'),
      text: root.querySelector('.dlg-text'),
      next: root.querySelector('.dlg-next'),
      choices: root.querySelector('.dlg-choices'),
      flash: root.querySelector('.dlg-flash'),
      log: root.querySelector('.dlg-log'),
      logInner: root.querySelector('.dlg-log-inner'),
      autoBtn: root.querySelector('[data-a="auto"]'),
    };
    root.addEventListener('click', (e) => {
      const a = e.target.closest('[data-a]');
      if (a) {
        e.stopPropagation();
        if (a.blur) a.blur();
        const act = a.dataset.a;
        if (act === 'skip') skip();
        if (act === 'auto') toggleAuto();
        if (act === 'log') openLog();
        if (act === 'closelog') els.log.classList.add('hidden');
        return;
      }
      if (e.target.closest('.dlg-choices') || e.target.closest('.dlg-log')) return;
      advance();
    });
  }

  /* ── 배경 ── */
  const BG_THEME = { ruins: 'ruins', city: 'city', lab: 'lab', highway: 'highway', sky: 'sky', archive: 'archive', skyport: 'skyport', warfront: 'warfront', core: 'core', void: 'void' };
  function drawBg(id) {
    const g = els.bg.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    // 3D 배경을 쓸 수 있으면 장면 테마를 3D 로 (이 캔버스는 투명하게 비움)
    const S3 = AZ.gfx.scene3d;
    if (BG_THEME[id] && S3 && S3.available && AZ.game && AZ.game.settings && AZ.game.settings.bg3d !== false) {
      g.clearRect(0, 0, 1280, 720);
      AZ.game.cineTheme = BG_THEME[id];
      return;
    }
    if (AZ.game) AZ.game.cineTheme = null;
    if (id === 'black') {
      g.fillStyle = '#000';
      g.fillRect(0, 0, 1280, 720);
      return;
    }
    if (id === 'dawn') {
      const grd = g.createLinearGradient(0, 0, 0, 720);
      grd.addColorStop(0, '#1b2a5a');
      grd.addColorStop(0.45, '#c86a6a');
      grd.addColorStop(0.7, '#ffc58a');
      grd.addColorStop(1, '#2a2440');
      g.fillStyle = grd;
      g.fillRect(0, 0, 1280, 720);
      const sun = g.createRadialGradient(640, 470, 10, 640, 470, 360);
      sun.addColorStop(0, 'rgba(255,240,200,0.95)');
      sun.addColorStop(1, 'rgba(255,200,140,0)');
      g.fillStyle = sun;
      g.fillRect(0, 0, 1280, 720);
      g.fillStyle = '#1a1830';
      let x = 0;
      let s = 7;
      while (x < 1280) {
        s = (s * 9301 + 49297) % 233280;
        const w = 30 + (s % 70);
        const hh = 60 + (s % 180);
        g.fillRect(x, 520 - hh, w, hh + 200);
        x += w + 4;
      }
      return;
    }
    const sky = AZ.gfx.render.getSky(BG_THEME[id] || 'ruins');
    if (sky) g.drawImage(sky, -(sky.width - 1280) / 2, 0);
    // 땅
    const T = AZ.gfx.render.THEMES[BG_THEME[id] || 'ruins'];
    const grd = g.createLinearGradient(0, 446, 0, 720);
    grd.addColorStop(0, T.floor[0]);
    grd.addColorStop(1, '#020308');
    g.fillStyle = grd;
    g.fillRect(0, 446, 1280, 274);
  }

  /* ── 진행 ── */
  function setPortrait(who) {
    const key = PORTRAIT[who];
    if (!key) {
      els.left.classList.add('dim');
      els.right.classList.add('dim');
      return;
    }
    const side = who === 'kai' ? els.left : els.right;
    const other = side === els.left ? els.right : els.left;
    const src = AZ.data.assets[key];
    if (side.dataset.key !== key) {
      side.dataset.key = key;
      side.src = src;
      side.classList.remove('show');
      void side.offsetWidth;
    }
    side.classList.add('show');
    side.classList.remove('dim');
    side.classList.toggle('small', key.startsWith('boss_'));
    other.classList.add('dim');
  }

  function showLine(line) {
    const who = line.who || 'narr';
    if (line.bg) drawBg(line.bg);
    if (line.fx) doFx(line.fx);
    setPortrait(who);
    const name = who === 'npc' ? (line.name || '???') : NAMES[who] != null ? NAMES[who] : who;
    els.name.textContent = name;
    els.name.style.color = ACCENT[who] || '#e8f4ff';
    els.name.classList.toggle('hidden', !name);
    els.box.className = 'dlg-box' + (who === 'narr' ? ' narr' : '') + (who === 'system' ? ' system' : '');
    state.full = line.text;
    state.shown = 0;
    state.typing = true;
    state.lineT = 0;
    els.text.textContent = '';
    els.next.classList.remove('show');
    state.log.push({ name, text: line.text, who });
  }

  function doFx(fx) {
    if (fx === 'shake') {
      root.classList.remove('shake');
      void root.offsetWidth;
      root.classList.add('shake');
      if (AZ.audio) AZ.audio.sfx('explosion', { vol: 0.5 });
    } else if (fx === 'flash') {
      els.flash.classList.remove('go');
      void els.flash.offsetWidth;
      els.flash.classList.add('go');
      if (AZ.audio) AZ.audio.sfx('perfect', { vol: 0.4 });
    } else if (fx === 'glitch') {
      root.classList.remove('glitch');
      void root.offsetWidth;
      root.classList.add('glitch');
      if (AZ.audio) AZ.audio.sfx('glitch', { vol: 0.5 });
    } else if (fx === 'fadeIn') {
      root.classList.remove('fadein');
      void root.offsetWidth;
      root.classList.add('fadein');
    }
  }

  /** 다음에 보여 줄 대사 한 줄을 스택에서 꺼냄 (if/choice 처리) */
  function nextLine() {
    while (state.stack.length) {
      const top = state.stack[state.stack.length - 1];
      if (top.i >= top.lines.length) {
        state.stack.pop();
        continue;
      }
      const line = top.lines[top.i++];
      if (!line) continue;
      if (line.if) {
        const v = !!state.flags[line.if];
        const branch = v ? line.then : line.else;
        if (branch && branch.length) state.stack.push({ lines: branch, i: 0 });
        continue;
      }
      if (line.choice) return { choice: line };
      if (line.text != null) return { line };
    }
    return null;
  }

  function step() {
    const n = nextLine();
    if (!n) return finish();
    if (n.choice) return showChoice(n.choice);
    showLine(n.line);
    if (state.skipping) completeTyping();
  }

  function showChoice(c) {
    state.skipping = false;
    state.choosing = true;
    state.typing = false;
    const lastLine = state.log.slice().reverse().find((l) => l.who !== 'choice');
    if (lastLine) {
      els.name.textContent = lastLine.name || '';
      els.name.classList.toggle('hidden', !lastLine.name);
      els.text.textContent = lastLine.text;
    }
    els.choices.innerHTML = '';
    els.next.classList.remove('show');
    c.options.forEach((opt, idx) => {
      const b = h('button', 'dlg-choice');
      b.type = 'button';
      b.innerHTML = `<span class="num">${idx + 1}</span>${escapeHtml(opt.text)}`;
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        pick(c, opt);
      });
      els.choices.appendChild(b);
    });
    els.choices.classList.add('show');
    if (AZ.audio) AZ.audio.sfx('ui');
  }

  function pick(c, opt) {
    if (!state || !state.choosing) return;
    state.choosing = false;
    els.choices.classList.remove('show');
    els.choices.innerHTML = '';
    state.flags[c.choice] = opt.value;
    if (state.onFlag) state.onFlag(c.choice, opt.value);
    state.log.push({ name: '▶ 선택', text: opt.text, who: 'choice' });
    if (AZ.audio) AZ.audio.sfx('uiConfirm');
    if (opt.lines && opt.lines.length) state.stack.push({ lines: opt.lines, i: 0 });
    step();
  }

  function completeTyping() {
    state.shown = state.full.length;
    els.text.textContent = state.full;
    state.typing = false;
    els.next.classList.add('show');
    state.lineT = 0;
  }

  function advance() {
    if (!state || state.choosing) return;
    if (state.typing) {
      completeTyping();
      return;
    }
    if (AZ.audio) AZ.audio.sfx('ui', { vol: 0.3 });
    step();
  }

  function skip() {
    if (!state) return;
    state.skipping = true;
    if (state.choosing) return;
    // 선택지나 끝까지 빠르게
    let guard = 0;
    while (state && !state.choosing && guard++ < 2000) {
      const n = nextLine();
      if (!n) { finish(); return; }
      if (n.choice) { showChoice(n.choice); return; }
      if (n.line.bg) drawBg(n.line.bg);
      state.log.push({ name: n.line.who === 'npc' ? n.line.name : NAMES[n.line.who] || '', text: n.line.text, who: n.line.who });
    }
  }

  function toggleAuto() {
    if (!state) return;
    state.auto = !state.auto;
    els.autoBtn.classList.toggle('on', state.auto);
  }

  function openLog() {
    if (!state) return;
    els.logInner.innerHTML = state.log.map((l) =>
      `<div class="log-row ${l.who === 'choice' ? 'choice' : ''}"><b style="color:${ACCENT[l.who] || '#9ab8ff'}">${escapeHtml(l.name || '')}</b><span>${escapeHtml(l.text)}</span></div>`).join('');
    els.log.classList.remove('hidden');
    els.logInner.scrollTop = els.logInner.scrollHeight;
  }

  function finish() {
    const s = state;
    state = null;
    root.classList.add('hidden');
    els.left.classList.remove('show');
    els.right.classList.remove('show');
    els.left.dataset.key = '';
    els.right.dataset.key = '';
    if (s && s.resolve) s.resolve();
  }

  /** 프레임마다 (타자기) */
  function update(dt) {
    if (!state || state.choosing) return;
    if (state.typing) {
      const speed = 42 * (AZ.game && AZ.game.settings ? AZ.game.settings.textSpeed || 1 : 1);
      const fast = AZ.input && AZ.input.isHeld && AZ.input.isHeld('confirm');
      const before = Math.floor(state.shown);
      state.shown += dt * speed * (fast ? 4 : 1);
      const n = Math.min(state.full.length, Math.floor(state.shown));
      if (n !== before) {
        els.text.textContent = state.full.slice(0, n);
        if (n % 3 === 0 && AZ.audio) AZ.audio.sfx('text', { vol: 0.25 });
      }
      if (n >= state.full.length) completeTyping();
    } else {
      state.lineT += dt;
      if (state.auto && state.lineT > 1.2 + state.full.length * 0.045) step();
    }
  }

  function play(lines, opts) {
    const o = opts || {};
    if (!root) build(o.parent || document.getElementById('stage'));
    return new Promise((resolve) => {
      if (!lines || !lines.length) { resolve(); return; }
      state = {
        stack: [{ lines, i: 0 }], flags: o.flags || {}, onFlag: o.onFlag || null, resolve,
        full: '', shown: 0, typing: false, choosing: false, skipping: false, auto: state ? state.auto : false, log: [], lineT: 0,
      };
      els.autoBtn.classList.toggle('on', state.auto);
      els.choices.innerHTML = '';
      els.choices.classList.remove('show');
      els.log.classList.add('hidden');
      drawBg(o.bg || 'ruins');
      root.classList.remove('hidden');
      step();
    });
  }

  function onKey(a) {
    if (!state) return false;
    if (state.choosing) {
      return false;
    }
    if (a === 'confirm' || a === 'attack' || a === 'dodge' || a === 'cmd0') { advance(); return true; }
    return false;
  }

  /** 숫자 키로 선택 */
  function onDigit(n) {
    if (!state || !state.choosing) return false;
    const btn = els.choices.children[n - 1];
    if (btn) btn.click();
    return true;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  return { play, update, onKey, onDigit, get active() { return !!state; }, escapeHtml, NAMES, PORTRAIT, ACCENT };
})();
