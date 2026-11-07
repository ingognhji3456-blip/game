'use strict';

/* =========================================================
 * 입력 — 키보드, 마우스, 터치(가상 스틱 + HUD 버튼), 게임패드
 * frame() 이 전투용 입력 객체를 돌려주고 "이번 프레임에 눌림"을 비웁니다.
 * ========================================================= */
window.AZ = window.AZ || {};

AZ.input = (() => {
  const held = new Set();
  const pressed = new Set();
  let toLogical = (x, y) => ({ x, y });
  let canvas = null;
  let touchMode = false;
  let onTouchModeChange = null;
  let listeners = [];
  let stick = null; // { id, ox, oy, dx, dy }
  const touchButtons = new Map(); // pointerId → button id
  const pressedButtons = new Set();
  const heldButtons = new Set();
  let padPrev = [];
  let lastPadUse = 0;

  const KEYMAP = {
    KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
    KeyJ: 'attack', KeyK: 'heavy', Space: 'dodge', ShiftLeft: 'dodge', ShiftRight: 'dodge',
    KeyU: 'skill0', KeyI: 'skill1', KeyO: 'skill2', Digit1: 'skill0', Digit2: 'skill1', Digit3: 'skill2',
    KeyL: 'ult', Digit4: 'ult', KeyF: 'chain', KeyZ: 'cmd0', KeyX: 'cmd1', KeyC: 'cmd2',
    Escape: 'pause', KeyP: 'pause', Enter: 'confirm', NumpadEnter: 'confirm', Backspace: 'back',
  };
  const keyLabels = { skills: ['U', 'I', 'O'], ult: 'L', chain: 'F', cmds: ['Z', 'X', 'C'] };

  function setTouch(v) {
    if (touchMode === v) return;
    touchMode = v;
    if (onTouchModeChange) onTouchModeChange(v);
  }

  function on(target, type, fn, opts) {
    target.addEventListener(type, fn, opts);
    listeners.push(() => target.removeEventListener(type, fn, opts));
  }

  function init(opts) {
    canvas = opts.canvas;
    toLogical = opts.toLogical || toLogical;
    onTouchModeChange = opts.onTouchModeChange || null;
    on(window, 'keydown', (e) => {
      const a = KEYMAP[e.code];
      if (!a) return;
      if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      // 대화 중에는 포커스된 버튼이 Space/Enter 로 눌리지 않게
      if (AZ.ui.dialogue && AZ.ui.dialogue.active && (a === 'dodge' || a === 'confirm')) e.preventDefault();
      if (!e.repeat) pressed.add(a);
      held.add(a);
      if (opts.forced !== true && touchMode && AZ.game && AZ.game.settings && AZ.game.settings.touch === 'auto') setTouch(false);
      if (a === 'dodge' || a.startsWith('up') || a === 'down' || a === 'left' || a === 'right') {
        if (AZ.game && AZ.game.inBattle && AZ.game.inBattle()) e.preventDefault();
      }
      if (AZ.game && AZ.game.onKey) AZ.game.onKey(a, e);
    });
    on(window, 'keyup', (e) => {
      const a = KEYMAP[e.code];
      if (a) held.delete(a);
    });
    on(window, 'blur', () => { held.clear(); heldButtons.clear(); stick = null; });

    on(canvas, 'contextmenu', (e) => e.preventDefault());
    on(canvas, 'pointerdown', (e) => {
      const pt = toLogical(e.clientX, e.clientY);
      if (e.pointerType === 'touch' || e.pointerType === 'pen') {
        if (AZ.game && AZ.game.settings && AZ.game.settings.touch !== 'off') setTouch(true);
      }
      const btn = hitButton(pt.x, pt.y);
      if (btn) {
        pressedButtons.add(btn);
        heldButtons.add(btn);
        touchButtons.set(e.pointerId, btn);
        try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* 무시 */ }
        e.preventDefault();
        return;
      }
      if (touchMode && pt.x < 1280 * 0.5) {
        stick = { id: e.pointerId, ox: pt.x, oy: pt.y, dx: 0, dy: 0 };
        try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* 무시 */ }
        e.preventDefault();
        return;
      }
      if (!touchMode && e.pointerType === 'mouse') {
        if (e.button === 0) { pressed.add('attack'); held.add('mouseAttack'); }
        if (e.button === 2) pressed.add('heavy');
        e.preventDefault();
      } else if (touchMode) {
        pressed.add('attack');
      }
    });
    on(canvas, 'pointermove', (e) => {
      if (stick && e.pointerId === stick.id) {
        const pt = toLogical(e.clientX, e.clientY);
        let dx = (pt.x - stick.ox) / 64;
        let dy = (pt.y - stick.oy) / 64;
        const m = Math.hypot(dx, dy);
        if (m > 1) { dx /= m; dy /= m; }
        stick.dx = dx;
        stick.dy = dy;
      }
    });
    const up = (e) => {
      if (stick && e.pointerId === stick.id) stick = null;
      const b = touchButtons.get(e.pointerId);
      if (b) { heldButtons.delete(b); touchButtons.delete(e.pointerId); }
      if (e.pointerType === 'mouse') held.delete('mouseAttack');
    };
    on(canvas, 'pointerup', up);
    on(canvas, 'pointercancel', up);
    on(window, 'gamepadconnected', () => { lastPadUse = Date.now(); });
  }

  function hitButton(x, y) {
    const list = (AZ.gfx.render && AZ.gfx.render.buttons) || [];
    if (!AZ.game || !AZ.game.inBattle || !AZ.game.inBattle()) return null;
    for (const b of list) {
      if ((x - b.x) * (x - b.x) + (y - b.y) * (y - b.y) <= b.r * b.r) return b.id;
    }
    return null;
  }

  /* 게임패드: 표준 배치 */
  function pollPad(out) {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return;
    const pads = navigator.getGamepads();
    const pad = pads && Array.from(pads).find((p) => p && p.connected);
    if (!pad) return;
    const b = pad.buttons.map((x) => x && x.pressed);
    const edge = (i) => b[i] && !padPrev[i];
    const ax = pad.axes[0] || 0;
    const ay = pad.axes[1] || 0;
    if (Math.hypot(ax, ay) > 0.25) { out.mx = ax; out.my = ay; lastPadUse = Date.now(); }
    if (b[12]) out.my = -1;
    if (b[13]) out.my = 1;
    if (b[14]) out.mx = -1;
    if (b[15]) out.mx = 1;
    if (edge(2)) out.attack = true;        // X / □
    if (edge(3)) out.heavy = true;         // Y / △
    if (edge(0)) out.dodge = true;         // A / ✕
    if (edge(1)) out.chain = true;         // B / ○
    if (edge(4)) out.skills[0] = true;     // LB
    if (edge(5)) out.skills[1] = true;     // RB
    if (edge(6)) out.skills[2] = true;     // LT
    if (edge(7)) out.ult = true;           // RT
    if (edge(10)) out.cmds[0] = true;      // L3
    if (edge(11)) out.cmds[1] = true;      // R3
    if (edge(8)) out.cmds[2] = true;       // Back/Select
    if (edge(9) && AZ.game && AZ.game.onKey) AZ.game.onKey('pause', null);
    if (b.some(Boolean)) lastPadUse = Date.now();
    padPrev = b;
  }

  /** 전투용 입력 */
  function frame() {
    const out = {
      mx: 0, my: 0,
      attack: pressed.has('attack') || pressedButtons.has('attack'),
      heavy: pressed.has('heavy') || pressedButtons.has('heavy'),
      dodge: pressed.has('dodge') || pressedButtons.has('dodge'),
      skills: [0, 1, 2].map((i) => pressed.has('skill' + i) || pressedButtons.has('skill' + i)),
      ult: pressed.has('ult') || pressedButtons.has('ult'),
      chain: pressed.has('chain') || pressedButtons.has('chain'),
      cmds: [0, 1, 2].map((i) => pressed.has('cmd' + i) || pressedButtons.has('cmd' + i)),
      aim: null,
      stick: touchMode ? stick : null,
      keyLabels,
    };
    if (held.has('left')) out.mx -= 1;
    if (held.has('right')) out.mx += 1;
    if (held.has('up')) out.my -= 1;
    if (held.has('down')) out.my += 1;
    if (stick) { out.mx = stick.dx; out.my = stick.dy; }
    const m = Math.hypot(out.mx, out.my);
    if (m > 1) { out.mx /= m; out.my /= m; }
    // 계속 누르고 있으면 연타 (공격 버튼/마우스/J)
    if ((held.has('attack') || held.has('mouseAttack') || heldButtons.has('attack')) && !out.attack) {
      out.attackHeld = true;
    }
    pollPad(out);
    if (pressedButtons.has('pause') && AZ.game && AZ.game.onKey) AZ.game.onKey('pause', null);
    pressed.clear();
    pressedButtons.clear();
    return out;
  }

  function clear() {
    pressed.clear();
    pressedButtons.clear();
    held.clear();
    heldButtons.clear();
    stick = null;
  }

  return {
    init, frame, clear, keyLabels,
    setTouch,
    get touchMode() { return touchMode; },
    get padActive() { return Date.now() - lastPadUse < 15000; },
    isHeld: (a) => held.has(a),
  };
})();
