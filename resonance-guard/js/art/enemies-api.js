'use strict';

/* 적 그림 공개 함수 RG.art.enemy (공용 도구: enemies.js, 적 정의: enemies-*.js) */
RG.art.enemy = (() => {
  const { H, OL, sh, GREY, GREY_L, MISTC, HALO, GREEN, ICE, ICE_L, EMBER, EMBER_L, VOLT, SEA, BELL, GOLD, BRONZE, make, g, zig } = RG.art._en;
  const D = RG.art._en.D;


  /* ---------- 자리표시 (알 수 없는 종류) ---------- */
  function placeholder(f) {
    const c = make(3);
    return c.out(g(
      c.P('M20 88.5C14 70 22 40 50 38C78 40 86 70 80 88.5Z', c.body(GREY)) +
      c.eye(58, 58, 3.5) + c.eye(70, 58, 3) + c.shine(36, 52, 8, 4),
      f ? 'translate(0 -1)' : ''
    ));
  }

  /**
   * 적 프레임: walk0~walk3(걷기·날갯짓 한 바퀴) · aim(공격 직전: 무기를 들어 올림) · attack(공격하는 순간)
   * 옛 숫자 프레임 0·1은 walk0·walk2로 읽음.
   * 새 방식 그림 함수는 fn.frames = true 로 표시하고 프레임 이름(문자열)을 받음.
   */
  const FRAMES = ['walk0', 'walk1', 'walk2', 'walk3', 'aim', 'attack'];
  RG.art.ENEMY_FRAMES = FRAMES;
  const legacyBit = (fr) => (fr === 'walk1' || fr === 'walk2' ? 1 : 0);
  return function enemy(type, frame) {
    const fr = typeof frame === 'number' || frame == null ? (frame ? 'walk2' : 'walk0') : (FRAMES.includes(frame) ? frame : 'walk0');
    const fn = D[type];
    if (!fn) return placeholder(legacyBit(fr));
    try {
      return fn.frames ? fn(fr) : fn(legacyBit(fr));
    } catch (e) {
      if (RG.art._strict) throw e;
      return placeholder(legacyBit(fr));
    }
  };
})();

