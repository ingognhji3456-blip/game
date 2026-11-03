'use strict';

/* =========================================================
 * 하늘 사냥꾼 — 플레이 중 입력
 *  · 터치/마우스: 화면 아무 데나 대고 끌면 비행기가 손가락 움직임만큼 따라 움직임
 *    (손가락에 비행기가 가려지지 않음). 끄는 중에 두 번째 손가락으로 톡 치면 폭탄.
 *  · 키보드: 방향키/WASD 이동, Shift 정밀 이동, X·Space·B 폭탄, Esc·P 일시정지
 * 메뉴 입력은 SH.ui 가, 둘 사이 나눠 주기는 main.js 가 합니다.
 * ========================================================= */

SH.input = (() => {
  const { W, H, clamp } = SH;
  const keys = new Set();
  const drag = { id: null, fx: 0, fy: 0, sx: 0, sy: 0, px: 0, py: 0, anchor: -1 };
  let sens = 1.3;
  let bombQueued = false;
  let scale = () => 1; // 화면 CSS 픽셀 / 게임 논리 좌표

  const MOVE_KEYS = {
    ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
    KeyA: [-1, 0], KeyD: [1, 0], KeyW: [0, -1], KeyS: [0, 1],
  };

  function setScale(fn) { scale = fn; }

  function dragDown(e) {
    if (drag.id === null) {
      drag.id = e.pointerId;
      drag.fx = drag.sx = e.clientX;
      drag.fy = drag.sy = e.clientY;
      drag.anchor = -1;
    } else if (e.pointerType === 'touch') {
      bombQueued = true;
    }
  }
  function dragMove(e) {
    if (e.pointerId !== drag.id) return false;
    drag.fx = e.clientX;
    drag.fy = e.clientY;
    return true;
  }
  function dragUp(e) {
    if (e.pointerId === drag.id) drag.id = null;
  }

  /** 플레이 중 키. 일시정지 키면 'pause' 를 돌려줌 */
  function keyDown(e) {
    keys.add(e.code);
    if (e.repeat) return null;
    if (e.code === 'KeyX' || e.code === 'Space' || e.code === 'KeyB') bombQueued = true;
    if (e.code === 'Escape' || e.code === 'KeyP') return 'pause';
    return null;
  }
  function keyUp(e) { keys.delete(e.code); }
  const isGameKey = (code) => !!MOVE_KEYS[code] || code === 'Space';

  function releaseAll() {
    keys.clear();
    drag.id = null;
  }

  /** 매 틱 게임 입력 채우기 */
  function apply(g) {
    const inp = g.input;
    let ax = 0, ay = 0;
    for (const code of keys) {
      const m = MOVE_KEYS[code];
      if (m) { ax += m[0]; ay += m[1]; }
    }
    inp.ax = clamp(ax, -1, 1);
    inp.ay = clamp(ay, -1, 1);
    inp.focus = keys.has('ShiftLeft') || keys.has('ShiftRight');

    const p = g.player;
    if (drag.id !== null && !p.dead && !p.entering && !p.exiting) {
      if (drag.anchor !== p.anchor) {
        drag.anchor = p.anchor;
        drag.sx = drag.fx;
        drag.sy = drag.fy;
        drag.px = p.x;
        drag.py = p.y;
      }
      const s = scale() || 1;
      const tx = drag.px + ((drag.fx - drag.sx) / s) * sens;
      const ty = drag.py + ((drag.fy - drag.sy) / s) * sens;
      const cx = clamp(tx, 16, W - 16), cy = clamp(ty, 50, H - 26);
      // 벽에 닿으면 기준점을 옮겨, 반대로 움직일 때 바로 반응하게
      if (cx !== tx) { drag.px = cx; drag.sx = drag.fx; }
      if (cy !== ty) { drag.py = cy; drag.sy = drag.fy; }
      inp.tx = cx;
      inp.ty = cy;
    } else {
      inp.tx = null;
      inp.ty = null;
      if (drag.id !== null) drag.anchor = -1;
    }
    if (bombQueued) {
      bombQueued = false;
      inp.bomb = true;
    }
  }

  function queueBomb() { bombQueued = true; }
  function setSensitivity(v) { sens = v; }

  return { setScale, dragDown, dragMove, dragUp, keyDown, keyUp, isGameKey, releaseAll, apply, queueBomb, setSensitivity };
})();
