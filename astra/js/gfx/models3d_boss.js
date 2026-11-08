'use strict';

/* =========================================================
 * 3D 보스 10종 — js/gfx/models3d.js 의 도형 도구(K)로 만듭니다.
 * 각 함수는 (e, W, t, K) 를 받고, 현재 좌표계는 보스 발밑(바라보는 쪽 +Z)입니다.
 * 애니메이션: e.anim (idle·move·windup·attack·charge·cast·roar·dash·slam·recover·fly·fade·stance·exposed·burrow·broken)
 *            e.animT, e.exposed(약점 노출), e.charging, e.broken, e.phase
 * ========================================================= */
(() => {
  const M3 = AZ.gfx.models3d;
  const B = M3.BOSSES;

  /** 공용 애니메이션 값 */
  function anim(e, t) {
    const an = e.anim || 'idle';
    const at = e.animT || 0;
    const k = (d) => Math.max(0, Math.min(1, at / d));
    const pulse = 0.5 + 0.5 * Math.sin(t * 10);
    const ex = e.exposed > 0 ? 1 : 0;
    const hot = e.charging > 0 || an === 'charge' || an === 'cast' || an === 'windup' ? 1 : 0;
    const spd = Math.hypot(e.vx || 0, e.vy || 0);
    const slump = e.broken || an === 'broken' || an === 'recover' ? 1 : 0;
    return { an, at, k, pulse, ex, hot, spd, slump, ph: e.phase || 1 };
  }

  /* ───────── 1. 스캐빈저 — 고철을 뒤집어쓴 포식 기계 ───────── */
  B.scavenger = (e, W, t, K) => {
    const A = anim(e, t);
    const s = (e.r || 46) / 46 * 1.35;
    const body = '#3a3236', plate = '#6a5446', rust = '#8a5a3a', eye = '#ff4d6d', fire = '#ffb35c';
    K.sc(s);
    let y = 44, lean = 0, neck = 0.15, jaw = 0.1, sink = 0;
    const walk = A.spd > 25 || A.an === 'move' || A.an === 'dash';
    const ph = t * (A.an === 'dash' ? 16 : 9);
    if (A.an === 'windup') { y -= 9 * A.k(0.4); lean = -0.2; neck = -0.3; }
    if (A.an === 'dash') { lean = 0.25; neck = -0.1; jaw = 0.4; }
    if (A.an === 'roar') { neck = 0.9 * Math.sin(A.k(0.3) * Math.PI / 2); jaw = 0.8; lean = -0.15; }
    if (A.an === 'attack') { const q = Math.sin(A.k(0.35) * Math.PI); neck = -0.5 * q; jaw = 0.9 * q; lean = 0.2 * q; }
    if (A.an === 'slam') { const q = A.k(0.5); lean = q < 0.6 ? -0.5 * (q / 0.6) : -0.5 + 0.9 * ((q - 0.6) / 0.4); }
    if (A.an === 'burrow') sink = 70 * A.k(0.6);
    if (A.slump) { y -= 12; neck = -0.6; jaw = 0.3; }
    K.push();
    K.tr(0, y - sink, 0);
    K.rx(lean);
    // 몸통
    K.box(42, 28, 64, body, { tb: 0.85, tt: 0.9 });
    K.box(36, 10, 52, plate, { y: 15, kind: 6, tt: 0.7 });
    for (let i = 0; i < 5; i++) {
      K.push(); K.tr((i % 2 ? 1 : -1) * 6, 19, -22 + i * 10); K.rx(-0.5); K.rz((i % 2 ? 0.3 : -0.3));
      K.box(5, 16, 7, rust, { y: 6, tt: 0.15, kind: 6 }); K.pop();
    }
    // 배기관과 불꽃
    for (const sd of [1, -1]) {
      K.push(); K.tr(sd * 14, 16, -24); K.rx(-0.6);
      K.prism(3.4, 3, 18, 6, '#2a2626', { y: 9, kind: 6 });
      K.glowL(0, 20, 0, 22 + A.hot * 16, fire, 0.5 + A.hot * 0.6 * A.pulse);
      K.pop();
    }
    // 목·머리
    K.push();
    K.tr(0, 6, 30);
    K.rx(-neck);
    K.box(16, 16, 26, body, { z: 11, tb: 0.9, kind: 6 });
    K.tr(0, 2, 26);
    K.box(26, 18, 30, plate, { z: 10, tb: 0.85, kind: 6 });
    K.box(22, 3, 1, eye, { kind: 2, y: 3, z: 25.4, ea: 1.7 });
    K.glowL(0, 3, 27, 30, eye, 0.7);
    for (const sd of [1, -1]) K.box(4, 12, 4, rust, { x: sd * 9, y: 12, z: 2, tt: 0.15, kind: 6 });
    K.push(); K.tr(0, -8, 2); K.rx(jaw);
    K.box(22, 6, 28, body, { z: 12, kind: 6, tt: 0.95 });
    for (let i = 0; i < 4; i++) K.box(2, 5, 2, '#e8e0d0', { x: -7 + i * 4.6, y: 5, z: 24, tt: 0.1 });
    K.pop();
    K.pop();
    // 다리 (앞다리 길고 갈고리)
    const legs = [[17, 22, 0, 1.25], [-17, 22, Math.PI, 1.25], [17, -24, Math.PI, 1], [-17, -24, 0, 1]];
    for (const [x, z, p0, L] of legs) {
      const sw = walk ? Math.sin(ph + p0) * 0.55 : 0;
      K.push();
      K.tr(x, -6, z);
      K.rz(x > 0 ? 0.25 : -0.25);
      K.rx(-sw + (A.an === 'slam' && z > 0 ? -1.0 * Math.sin(A.k(0.5) * Math.PI) : 0));
      K.box(12, 26 * L, 14, plate, { y: -12 * L, kind: 6, tb: 0.75 });
      K.tr(0, -24 * L, 0);
      K.rx(z > 0 ? -0.6 : 0.6);
      K.box(9, 24 * L, 10, body, { y: -11 * L, tb: 0.7 });
      K.tr(0, -22 * L, 0);
      for (let c = -1; c <= 1; c++) { K.push(); K.tr(c * 3.4, 0, 4); K.rx(1.2); K.box(2.6, 10, 2.6, '#d8d0c0', { y: 4, tt: 0.1 }); K.pop(); }
      K.pop();
    }
    // 꼬리
    K.push();
    K.tr(0, 6, -32);
    for (let i = 0; i < 6; i++) {
      K.rx(0.18 + Math.sin(t * 3 + i * 0.6) * 0.05);
      K.ry(Math.sin(t * 2 + i * 0.7) * 0.12);
      K.box(10 - i * 1.3, 8 - i, 12, i % 2 ? plate : body, { z: -6, kind: 6 });
      K.tr(0, 0, -11);
    }
    K.box(3, 3, 8, eye, { kind: 2, z: -3, ea: 1.3 });
    K.pop();
    K.pop();
  };

  /* ───────── 2. 아르카 — 탑 방패를 든 기계 기사 ───────── */
  B.arka = (e, W, t, K) => {
    const A = anim(e, t);
    const s = (e.r || 50) / 50 * 2.0;
    const P = K.manPose(Object.assign({}, e, { anim: A.an === 'move' || A.an === 'charge' ? 'move' : 'idle', kind: 'boss' }), W, t, 'spear');
    P.shL = [0.55, 1.15, 0.15]; P.elbL = 1.35; P.wpL = 0;
    P.shR = [0.1, 0.5, 0.15]; P.elbR = 1.2; P.wpR = 1.9;
    const shieldUp = !e.shieldDown;
    if (A.an === 'windup') { const k = A.k(0.4); P.shR = [0.2, K.lerp(0.5, 2.6, k), 0.1]; P.elbR = 0.4; P.wpR = 0.8; P.lean = -0.1; }
    if (A.an === 'attack' || A.an === 'dash') { const k = A.k(0.25); P.shR = [0.05, K.lerp(1.0, 1.55, k), 0.05]; P.elbR = K.lerp(1.4, 0.05, k); P.wpR = 1.55; P.lean = 0.35; P.legL = 0.5; P.legR = -0.4; }
    if (A.an === 'slam') { const k = A.k(0.5); P.shR = [0.1, k < 0.6 ? 2.8 : K.lerp(2.8, 0.6, (k - 0.6) / 0.4), 0.1]; P.elbR = 0.2; P.wpR = 0.6; P.crouch = k > 0.6 ? 8 : 0; }
    if (A.an === 'charge') { P.lean = 0.35; P.shL = [0.2, 1.4, 0.1]; P.elbL = 1.0; }
    if (A.an === 'stance') { P.crouch = 6; P.shL = [0.3, 1.4, 0.1]; P.elbL = 1.1; }
    if (!shieldUp) { P.shL = [0.2, 0.3, 0.4]; P.elbL = 0.4; }
    if (A.slump) { P.lean = 0.4; P.crouch = 8; P.headPitch = 0.4; P.shL = [0, 0.1, 0.5]; P.shR = [0, 0.1, 0.5]; }
    K.sc(s);
    K.humanoid(K.ARKA, P, { type: 'spear', color: '#ffe066' }, null);
    // 탑 방패 (왼팔 앞)
    K.push();
    K.tr(0, 0, 0);
    const sx = 13, sy = 46 - P.crouch, sz = shieldUp ? 16 : 10;
    K.tr(sx, sy, sz);
    K.ry(shieldUp ? -0.15 : 0.4);
    if (!shieldUp) K.rz(0.5);
    K.box(26, 44, 3.6, '#6a7ea4', { kind: 6, tb: 0.75 });
    K.box(20, 36, 1.2, '#8fa4c8', { kind: 6, z: 2.2, tb: 0.75 });
    K.box(2, 34, 1.4, '#ffe066', { kind: 2, z: 3, ea: shieldUp ? 1.4 : 0.4 });
    K.box(16, 2, 1.4, '#ffe066', { kind: 2, y: 8, z: 3, ea: shieldUp ? 1.4 : 0.4 });
    if (shieldUp) K.glowL(0, 6, 5, 40, '#ffe066', 0.25);
    K.pop();
    // 등의 추진기
    K.push(); K.tr(0, 48 - P.crouch, -8);
    for (const sd of [1, -1]) { K.box(6, 16, 6, '#3a4866', { x: sd * 6, kind: 6 }); K.glowL(sd * 6, -9, -1, 18, '#8fb8ff', 0.5 + A.hot * 0.5); }
    K.pop();
  };

  /* ───────── 3. 옵저버 — 하늘에 뜬 거대한 감시의 눈 ───────── */
  B.observer = (e, W, t, K) => {
    const A = anim(e, t);
    const s = (e.r || 52) / 52 * 1.2;
    const shell = '#2a3a4c', shell2 = '#4a5e78', lens = A.ex ? '#ff5470' : '#66e0ff';
    K.sc(s);
    K.push();
    K.tr(0, 70 + Math.sin(t * 1.4) * 6 - A.slump * 20, 0);
    K.rx(A.slump ? 0.5 : -0.1 + Math.sin(t * 0.8) * 0.05);
    // 몸통 (공)
    K.ball(36, shell, { kind: 6 }, 10, 5);
    // 눈꺼풀 셔터: 노출되면 열림
    const open = A.ex ? 1 : A.hot ? 0.45 : 0.18;
    for (const sd of [1, -1]) {
      K.push();
      K.tr(0, sd * 4, 6);
      K.rx(-sd * (0.25 + open * 0.9));
      K.box(56, 6, 30, shell2, { y: sd * 18, z: 16, kind: 6, tb: 0.8 });
      K.pop();
    }
    // 렌즈
    K.push();
    K.tr(0, 0, 33);
    K.rx(Math.PI / 2);
    K.prism(16, 16, 4, 12, '#0a1018', {});
    K.prism(12 * (0.6 + open * 0.4), 12 * (0.6 + open * 0.4), 5, 12, lens, { kind: 2, ea: 1.4 + open });
    K.prism(4, 4, 6, 8, '#ffffff', { kind: 2, ea: 2 });
    K.pop();
    K.glowL(0, 0, 40, 60 + open * 60, lens, 0.6 + open * 0.8 * (0.7 + 0.3 * A.pulse));
    // 양옆의 거대한 장갑 포드 (원작의 어깨 장갑)
    for (const sd of [1, -1]) {
      K.push();
      K.tr(sd * 50, -4 + Math.sin(t * 1.3 + sd) * 3, -4);
      K.rz(sd * (0.2 + A.hot * 0.15));
      K.ball(19, shell2, { kind: 6, sy: 1.2 }, 10, 6);
      K.box(30, 10, 30, shell, { y: -14, kind: 6, tb: 0.7 });
      for (let k = 0; k < 3; k++) K.box(3.4, 3.4, 1, A.hot ? '#ff9a3d' : lens, { kind: 2, x: -sd * 4 + sd * k * 4, y: 2, z: 17, ea: 1.5 });
      K.push(); K.tr(sd * 6, -26, 6); K.rx(0.4); K.box(8, 26, 8, shell, { y: -10, kind: 6, tb: 0.6 }); K.box(10, 6, 12, shell2, { y: -24, kind: 6 }); K.pop();
      K.pop();
    }
    // 도는 고리와 위성
    K.push();
    K.ry(t * 0.7);
    K.rz(0.35);
    K.ring(52, 2.4, 18, '#3a4e68', { kind: 6 });
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * K.TAU;
      K.push(); K.tr(Math.cos(a) * 52, 0, Math.sin(a) * 52);
      K.ball(7, shell2, { kind: 6 }, 6, 3);
      K.box(3, 3, 3, lens, { kind: 2, ea: 1.6 });
      K.pop();
    }
    K.pop();
    // 매달린 케이블
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * K.TAU;
      K.push();
      K.tr(Math.cos(a) * 18, -28, Math.sin(a) * 18);
      for (let j = 0; j < 4; j++) {
        K.rx(Math.sin(t * 2 + i + j) * 0.18);
        K.rz(Math.cos(t * 1.7 + i * 2 + j) * 0.18);
        K.box(3.2 - j * 0.5, 12, 3.2 - j * 0.5, j % 2 ? '#1e2836' : shell2, { y: -6, kind: 6 });
        K.tr(0, -11, 0);
      }
      K.box(2, 2, 2, lens, { kind: 2, ea: 1.4 });
      K.pop();
    }
    K.pop();
  };

  /* ───────── 4. 제로 (보스) ───────── */
  B.zero = (e, W, t, K) => {
    const P = K.manPose(e, W, t, 'blade');
    const A = anim(e, t);
    if (A.an === 'windup' || A.an === 'charge') { const k = A.k(0.35); P.shR = [-1.3 * k, 1.4, 0.15]; P.elbR = 0.2; P.wpR = 0.2; P.twist = -0.5 * k; P.crouch = 4 * k; }
    if (A.an === 'dash') { P.lean = 0.7; P.crouch = 6; P.shR = [1.0, 1.3, 0.1]; P.wpR = 0.2; P.legL = 0.8; P.legR = -0.7; P.kneeL = 1.0; P.flow = 1.2; }
    if (A.an === 'stance') { P.crouch = 7; P.shR = [0.85, 1.25, 0.1]; P.elbR = 0.5; P.wpR = 0.05; P.eye = 2; }
    if (A.an === 'cast') { P.shR = [0, 2.9, 0.1]; P.elbR = 0.2; P.wpR = 0.1; P.eye = 2; }
    if (A.slump) { P.crouch = 9; P.lean = 0.45; P.headPitch = 0.5; P.shR = [0, 0.1, 0.5]; P.wpR = 2.4; }
    K.sc((e.r || 24) / 20 * 1.02);
    K.humanoid(K.ZERO, P, { type: 'crystal', color: '#ff2a4a', len: 58 }, null);
    K.glowL(0, 40, 0, 110, '#ff3355', 0.12 + A.hot * 0.15);
  };

  /* ───────── 5. 아틀라스 — 거대 전투 병기 ───────── */
  B.atlas = (e, W, t, K) => {
    const A = anim(e, t);
    const s = (e.r || 92) / 92 * 1.3;
    const steel = '#4a5a7a', dark = '#262e40', hi = '#7a8eb4', core = '#ff7a3d';
    K.sc(s);
    const walk = A.spd > 10 || A.an === 'move';
    const ph = t * 4;
    let crouch = A.slump ? 18 : 0, lean = A.slump ? 0.25 : 0;
    let armUp = 0, slam = 0;
    if (A.an === 'windup' || A.an === 'cast') armUp = A.k(0.5);
    if (A.an === 'slam') { const k = A.k(0.6); armUp = k < 0.6 ? k / 0.6 : 1 - (k - 0.6) / 0.4; slam = k > 0.6 ? 1 : 0; crouch += slam * 10; }
    if (A.an === 'charge') lean = 0.2;
    K.push();
    K.tr(0, Math.abs(Math.sin(ph)) * 3 * (walk ? 1 : 0) - crouch, 0);
    // 다리
    for (const sd of [1, -1]) {
      const sw = walk ? Math.sin(ph + (sd > 0 ? 0 : Math.PI)) * 0.35 : 0;
      K.push();
      K.tr(sd * 30, 96, 0);
      K.rx(-sw);
      K.box(30, 50, 34, steel, { y: -22, kind: 6, tb: 0.85 });
      K.box(20, 14, 6, hi, { y: -30, z: 17, kind: 6 });
      K.tr(0, -48, 0);
      K.rx(sw * 0.6 + 0.1);
      K.box(26, 46, 30, dark, { y: -22, kind: 6, tt: 1.1 });
      K.box(38, 12, 50, steel, { y: -46, z: 6, kind: 6 });
      K.pop();
    }
    // 허리·몸통
    K.box(70, 20, 44, dark, { y: 104, kind: 6 });
    K.push();
    K.tr(0, 114, 0);
    K.rx(lean);
    K.ry(Math.sin(t * 0.6) * 0.06);
    K.box(96, 62, 62, steel, { y: 32, kind: 6, tb: 0.8, tt: 1.05 });
    K.box(70, 18, 56, hi, { y: 66, kind: 6, tt: 0.7 });
    // 가슴 코어: 노출되면 장갑이 열림
    const op = A.ex ? 1 : 0;
    K.box(34, 30, 6, '#1a1e28', { y: 34, z: 31 });
    K.push(); K.tr(0, 34, 33); K.rx(Math.PI / 2); K.prism(11, 11, 6, 8, core, { kind: 2, ea: 1.2 + op * 1.4 + A.hot * 0.6 }); K.pop();
    for (const sd of [1, -1]) K.box(18, 32, 5, hi, { x: sd * (9 + op * 16), y: 34, z: 34, kind: 6 });
    K.glowL(0, 34, 40, 50 + op * 80, core, 0.5 + op * 0.9 * (0.7 + 0.3 * A.pulse));
    // 머리
    K.push(); K.tr(0, 72, 10);
    K.box(26, 18, 24, dark, { y: 9, kind: 6, tb: 1.1 });
    K.box(20, 3, 1, core, { kind: 2, y: 10, z: 12.4, ea: 1.8 });
    K.glowL(0, 10, 14, 26, core, 0.5);
    K.pop();
    // 어깨 미사일 포드
    for (const sd of [1, -1]) {
      K.push(); K.tr(sd * 50, 62, -6);
      K.box(30, 26, 40, dark, { kind: 6 });
      for (let i = 0; i < 6; i++) K.box(5, 5, 1, A.hot ? core : '#40485a', { kind: A.hot ? 2 : 6, x: -9 + (i % 3) * 9, y: i < 3 ? 5 : -5, z: 20.4, ea: 1.4 });
      K.pop();
      // 팔
      K.push();
      K.tr(sd * 62, 52, 0);
      K.rx(-(0.3 + armUp * 2.4));
      K.rz(sd * 0.15);
      K.box(26, 46, 28, steel, { y: -20, kind: 6, tb: 0.9 });
      K.tr(0, -44, 0);
      K.rx(-(0.4 + armUp * 0.2));
      K.box(30, 40, 30, dark, { y: -18, kind: 6, tt: 0.9 });
      K.box(36, 24, 34, hi, { y: -44, kind: 6 });
      if (slam) K.glowL(0, -50, 0, 80, core, 0.6);
      K.pop();
    }
    K.pop();
    K.pop();
  };

  /* ───────── 6. 세라 — 기억 조작 병기 ───────── */
  B.sera = (e, W, t, K) => {
    const P = K.ladyPose(e, t);
    const A = anim(e, t);
    K.sc((e.r || 30) / 26 * 1.25);
    K.tr(0, 6, 0);
    K.lady(M3.SERA, P, t);
    // 빛의 날개
    for (const sd of [1, -1]) {
      for (let i = 0; i < 4; i++) {
        K.push();
        K.tr(sd * 5, 50, -6);
        K.rz(sd * (0.7 + i * 0.32 + Math.sin(t * 1.4 + i) * 0.05));
        K.box(1, 30 - i * 4, 7, '#e2d4ff', { kind: 2, y: -(15 - i * 2), ea: 0.7, tb: 0.2, fade: 0.25 });
        K.pop();
      }
    }
    K.glowL(0, 50, -8, 90, '#b07cff', 0.2 + A.hot * 0.25);
  };

  /* ───────── 7. 드라코 — 기계 드래곤 ───────── */
  B.draco = (e, W, t, K) => {
    const A = anim(e, t);
    const s = (e.r || 62) / 62 * 1.3;
    const hull = '#3a2420', plate = '#6a3a2a', hi = '#a85a3a', fire = '#ffd166', eye = '#ff5f3d';
    K.sc(s);
    const flap = Math.sin(t * (A.an === 'dash' ? 9 : 4)) * (A.slump ? 0.15 : 0.55);
    K.push();
    K.tr(0, 40 + Math.sin(t * 4) * 4 - A.slump * 20, 0);
    K.rx(A.an === 'dash' ? 0.3 : A.an === 'windup' ? -0.25 : 0.05);
    // 몸통
    K.box(30, 24, 66, hull, { kind: 6, tb: 0.8 });
    K.box(22, 8, 56, plate, { y: 14, kind: 6, tt: 0.6 });
    for (let i = 0; i < 5; i++) K.box(3, 10, 6, hi, { y: 19, z: -24 + i * 12, tt: 0.1, kind: 6 });
    // 엔진
    for (const sd of [1, -1]) { K.prism(5, 6, 10, 6, '#2a1a18', { x: sd * 10, y: -6, z: -34, kind: 6 }); K.glowL(sd * 10, -6, -42, 26 + A.hot * 20, fire, 0.7 + A.hot * 0.5); }
    // 목·머리
    K.push();
    K.tr(0, 6, 30);
    const neckUp = A.an === 'cast' || A.an === 'roar' ? -0.6 : A.an === 'attack' ? 0.3 : -0.2;
    for (let i = 0; i < 3; i++) { K.rx(neckUp / 3 + Math.sin(t * 2 + i) * 0.04); K.box(14 - i * 1.5, 12 - i, 14, i % 2 ? plate : hull, { z: 6, kind: 6 }); K.tr(0, 0, 12); }
    K.box(20, 14, 30, hull, { z: 12, kind: 6, tb: 0.8 });
    K.box(16, 3, 1, eye, { kind: 2, y: 3, z: 26, ea: 1.8 });
    K.glowL(0, 3, 28, 30, eye, 0.6);
    for (const sd of [1, -1]) { K.push(); K.tr(sd * 6, 7, 2); K.rx(-0.9); K.box(3, 14, 3, hi, { y: 7, tt: 0.1, kind: 6 }); K.pop(); }
    K.push(); K.tr(0, -6, 4); K.rx(A.an === 'cast' || A.an === 'attack' ? 0.6 : 0.1);
    K.box(16, 5, 26, plate, { z: 11, kind: 6 });
    K.pop();
    if (A.an === 'cast' || A.hot) K.glowL(0, -4, 36, 40 + 20 * A.pulse, fire, 0.8);
    K.pop();
    // 날개
    for (const sd of [1, -1]) {
      K.push();
      K.tr(sd * 14, 10, 6);
      K.rz(sd * (0.25 + flap));
      K.box(56, 5, 7, plate, { x: sd * 28, kind: 6 });
      K.tr(sd * 56, 0, 0);
      K.rz(sd * (flap * 0.5));
      K.box(44, 4, 6, hi, { x: sd * 22, kind: 6, tb: 0.6 });
      K.pop();
      // 막 (판 여러 장)
      for (let i = 0; i < 4; i++) {
        K.push();
        K.tr(sd * 14, 9, 4 - i * 9);
        K.rz(sd * (0.25 + flap));
        K.box(54 - i * 6, 1.2, 9, i % 2 ? '#5a2a20' : '#7a3a26', { x: sd * (27 - i * 3), kind: 6 });
        K.box(54 - i * 6, 0.8, 1, fire, { kind: 2, x: sd * (27 - i * 3), z: -4.8, ea: 0.5 });
        K.pop();
      }
    }
    // 꼬리
    K.push();
    K.tr(0, 2, -32);
    for (let i = 0; i < 7; i++) { K.ry(Math.sin(t * 2.4 + i * 0.6) * 0.14); K.rx(0.05); K.box(12 - i * 1.4, 9 - i, 12, i % 2 ? plate : hull, { z: -6, kind: 6 }); K.tr(0, 0, -11); }
    K.box(14, 2, 10, hi, { z: -4, kind: 6, tb: 0.2 });
    K.pop();
    K.pop();
  };

  /* ───────── 8. 네메시스 — 행성 파괴 병기 ───────── */
  B.nemesis = (e, W, t, K) => {
    const A = anim(e, t);
    const s = (e.r || 86) / 86 * 1.45;
    const armor = '#2e2440', armor2 = '#4a3a66', hi = '#7a5aa8', core = '#b04dff', red = '#ff3d6e';
    K.sc(s);
    const walk = A.spd > 10 || A.an === 'move';
    const ph = t * 5;
    K.push();
    K.tr(0, -A.slump * 14, 0);
    // 네 다리
    const legs = [[46, 40, 0], [-46, 40, Math.PI], [46, -40, Math.PI], [-46, -40, 0]];
    for (const [x, z, p0] of legs) {
      const sw = walk ? Math.sin(ph + p0) * 0.3 : 0;
      K.push();
      K.tr(x, 78, z);
      K.rz(x > 0 ? -0.5 : 0.5);
      K.rx(-sw);
      K.box(20, 46, 22, armor2, { y: -20, kind: 6 });
      K.tr(0, -42, 0);
      K.rz(x > 0 ? 0.75 : -0.75);
      K.box(18, 50, 20, armor, { y: -22, kind: 6, tb: 0.8 });
      K.box(28, 8, 30, hi, { y: -48, kind: 6 });
      K.pop();
    }
    // 몸통
    K.push();
    K.tr(0, 92, 0);
    K.box(110, 44, 104, armor, { kind: 6, tb: 0.8, tt: 0.92 });
    K.box(90, 14, 84, armor2, { y: 28, kind: 6, tt: 0.8 });
    for (const sd of [1, -1]) K.box(16, 40, 90, hi, { x: sd * 58, kind: 6, tb: 0.7 });
    // 앞의 코어
    const op = A.ex ? 1 : 0;
    K.box(40, 30, 8, '#14101e', { z: 52 });
    K.push(); K.tr(0, 0, 55); K.rx(Math.PI / 2); K.prism(12, 12, 6, 8, red, { kind: 2, ea: 1.3 + op * 1.6 }); K.pop();
    for (const sd of [1, -1]) K.box(20, 32, 5, armor2, { x: sd * (11 + op * 18), z: 56, kind: 6 });
    K.glowL(0, 0, 60, 50 + op * 90, red, 0.5 + op);
    // 거대한 주포
    const charge = A.hot ? 1 : 0;
    K.push();
    K.tr(0, 46, -10);
    K.rx(-(0.15 + charge * 0.35));
    K.box(40, 30, 50, armor2, { kind: 6 });
    K.box(26, 26, 150, armor, { z: 80, kind: 6, tt: 0.9 });
    for (let i = 0; i < 4; i++) K.box(32, 32, 6, hi, { z: 30 + i * 32, kind: 6 });
    K.push(); K.tr(0, 0, 156); K.rx(Math.PI / 2); K.prism(17, 17, 6, 10, core, { kind: 2, ea: 1 + charge * 1.6 * (0.6 + 0.4 * A.pulse) }); K.pop();
    K.glowL(0, 0, 162, 60 + charge * 110, core, 0.5 + charge * 1.0);
    for (let i = 0; i < 3; i++) K.box(28, 1, 1, core, { kind: 2, y: 13.5, z: 50 + i * 40, ea: 0.6 + charge });
    K.pop();
    // 안테나
    for (const sd of [1, -1]) { K.push(); K.tr(sd * 40, 30, -40); K.rz(-sd * 0.3); K.box(3, 40, 3, hi, { y: 20, kind: 6 }); K.box(4, 4, 4, red, { kind: 2, y: 41, ea: 2 * (Math.sin(t * 4 + sd) > 0 ? 1 : 0.3) }); K.pop(); }
    K.pop();
    K.pop();
  };

  /* ───────── 9. 프로토콜 — 최종 관리자 ───────── */
  B.protocol = (e, W, t, K) => {
    const P = K.ladyPose(e, t);
    const A = anim(e, t);
    K.sc((e.r || 34) / 26 * 1.3);
    K.tr(0, 8, 0);
    K.lady(M3.PROTOCOL, P, t);
    K.glowL(0, 46, -6, 100, '#66e0ff', 0.15 + A.hot * 0.25);
    // 머리 위 왕관 고리
    K.push(); K.tr(0, 76, 0); K.ry(t * 0.8); K.ring(12, 1.4, 10, '#d8b860', { kind: 2, ea: 1.2 }); K.pop();
  };

  /* ───────── 10. ASTRA — 최종 형태 ───────── */
  B.astra = (e, W, t, K) => {
    const A = anim(e, t);
    const s = (e.r || 100) / 100 * 1.3;
    const ph = A.ph;
    const main = ph >= 3 ? '#ff5a7a' : ph === 2 ? '#c8a8ff' : '#9ad8ff';
    const crystal = ph >= 3 ? '#3a1a2a' : '#1a2a44';
    K.sc(s);
    K.push();
    K.tr(0, 120 + Math.sin(t * 1.2) * 8 - A.slump * 30, 0);
    const spin = t * (0.3 + ph * 0.15);
    // 핵: 수정 껍질 안에 떠 있는 ASTRA 의 모습 (원작의 하얀 머리·후광·감은 눈)
    const op = A.ex ? 1 : 0;
    K.push();
    K.tr(0, -38, 6);
    K.sc(1.15);
    const AP = K.ladyPose(Object.assign({}, e, { anim: A.an === 'cast' || A.hot ? 'cast' : 'idle', vx: 0, vy: 0, down: 0, dead: false }), t);
    AP.shL = [-0.2, 0.5, 0.9]; AP.shR = [0.2, 0.5, 0.9]; AP.elbL = 0.3; AP.elbR = 0.3; AP.lift = 0;
    if (A.hot) { AP.shL = [-0.1, 1.6, 0.4]; AP.shR = [0.1, 1.6, 0.4]; }
    K.lady(M3.ASTRA_FORM, AP, t);
    K.pop();
    K.push();
    K.ry(spin * 0.6);
    K.prism(30, 0, 50, 8, '#cfe8ff', { y: 25, kind: 6, fade: 0.72 - op * 0.3, open: true });
    K.prism(0, 30, 50, 8, '#cfe8ff', { y: -25, kind: 6, fade: 0.72 - op * 0.3, open: true });
    K.pop();
    K.glowL(0, 0, 0, 140 + op * 100, main, 0.6 + op * 0.8 * (0.7 + 0.3 * A.pulse));
    // 둘레의 수정 갑옷 판
    for (let i = 0; i < 6; i++) {
      const a = spin + (i / 6) * K.TAU;
      const d = 52 + op * 26 + Math.sin(t * 2 + i) * 3;
      K.push();
      K.tr(Math.cos(a) * d, Math.sin(t * 1.5 + i) * 8, Math.sin(a) * d);
      K.ry(-a);
      K.box(10, 70, 26, crystal, { kind: 6, tt: 0.2, tb: 0.3 });
      K.box(1.2, 64, 2, main, { kind: 2, x: 5.4, ea: 1.2, tt: 0.2, tb: 0.3 });
      K.pop();
    }
    // 기울어진 고리 셋
    for (let r = 0; r < 3; r++) {
      K.push();
      K.rx(0.5 + r * 0.6);
      K.ry(spin * (r % 2 ? -1.4 : 1) + r);
      K.ring(84 + r * 18, 2.6, 28, r === 1 ? main : '#3a4e78', { kind: r === 1 ? 2 : 6, ea: 1.0 });
      K.pop();
    }
    // 날개 같은 수정 부채
    for (const sd of [1, -1]) {
      for (let i = 0; i < 6; i++) {
        K.push();
        K.tr(sd * 30, 10, -16);
        K.rz(sd * (0.4 + i * 0.26 + Math.sin(t * 1.1 + i) * 0.04));
        K.box(5, 90 - i * 8, 12, crystal, { y: 45 - i * 4, kind: 6, tt: 0.05 });
        K.box(1, 86 - i * 8, 1.2, main, { kind: 2, y: 45 - i * 4, z: 6.4, ea: 1.1, tt: 0.05 });
        K.pop();
      }
    }
    // 머리 위 후광
    K.push(); K.tr(0, 96, -10); K.rx(-0.3); K.ring(30, 2, 20, main, { kind: 2, ea: 1.4 }); K.pop();
    K.pop();
  };
})();
