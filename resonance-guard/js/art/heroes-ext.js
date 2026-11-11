'use strict';

/* =========================================================
 * 확장 영웅 6명 그림 (2026-11-11) — 설계: docs/design/heroes.md, docs/design/expansion.md §2
 *   하루 · 도한 · 나래(바람새 기수) · 토리(정령 / 이끼 거인) · 별이 · 무진 + 눈사람 유닛
 *   규격·도구는 heroes.js와 같음(RG.art._hr). 자세 9장: idle0·idle1·walk0~3·aim·attack·cast
 *   사람 영웅은 "조립기"(humanHero)가 자세 표 + 영웅별 부품(머리·몸통·소품·효과)을 읽어 그림.
 * ========================================================= */
(() => {
  const X = RG.art._hr;
  const { OLC, h, num, sh, IL, RIMC, P, C, E, T, L, G, op, FURI, CL, SHD, PI, OUT, SPEC, LI, STITCH,
    V, pol, rot, angTo, dist, lerp, add, pt, at, limb, castSegs, arcBand, fist, palm, HUMAN, rig, leg, arm, HEAD, eyes, mouth, ear, faceBase, neckS, foot,
    BODY, innerOf, BODY_SHD, TORSO, FACE, plate, sparkle, MOUTH, human, HEROES, PORTRAITS, PORTRAIT_FN, UNITS, cap } = X;

  /* ---------- 공통 걷기 자세 (발·몸) — 기존 영웅과 같은 보폭 ---------- */
  const WALK = {
    idle0: { b: [0, 0], lean: 0, br: 0, fn: [45.5, null, 0], ff: [55.5, null, 0] },
    idle1: { b: [0, 0], lean: 0, br: 1.3, hd: -2, fn: [45.5, null, 0], ff: [55.5, null, 0] },
    walk0: { b: [0, 0.8], lean: 4, fn: [57, null, -12], ff: [42, null, 22], hem: 2 },
    walk1: { b: [0, -0.8], lean: 3, fn: [51, null, 0], ff: [46, 81.5, 16], hem: 0 },
    walk2: { b: [0, 0.8], lean: 4, fn: [42, null, 22], ff: [57, null, -12], hem: -2 },
    walk3: { b: [0, -0.8], lean: 3, fn: [46, 81.5, 16], ff: [51, null, 0], hem: 0 },
  };
  /** 자세 표 만들기: 걷기 기본 + 영웅별 덧붙임 */
  const poses = (extra) => {
    const o = {};
    for (const k of ['idle0', 'idle1', 'walk0', 'walk1', 'walk2', 'walk3', 'aim', 'attack', 'cast']) o[k] = Object.assign({}, WALK[k] || WALK.idle0, extra[k] || {});
    return o;
  };
  const star = (x, y, r, col = '#fff8c0', w = 0) => P(h().starPath(x, y, r, r * 0.34, 4, 0), col, w);

  /**
   * 긴 옷자락(치마·두루마기·망토 아랫단): 허리 두 점 → 앞·뒤 발을 따라 내려온 단.
   * len: 단 높이(땅에서 위로), col, trim(단 띠 색)
   */
  function robeSkirt(c, R, fN, fF, col, o = {}) {
    const hem = o.hem || 0;
    const fx = Math.max(fN[0], fF[0]);
    const bx = Math.min(fN[0], fF[0]);
    const w1 = R.W(V(41.4, 62));
    const w2 = R.W(V(59.8, 61.6));
    const fy = 90 - (o.lift == null ? 8.6 : o.lift);
    const by = fy + 0.6;
    const flare = o.flare || 6.4;
    let s = P(`M${pt(w1)}L${pt(w2)}C${num(w2.x + 2)} ${num(w2.y + 8)} ${num(fx + flare - 0.4 + hem)} ${num(fy - 8)} ${num(fx + flare + hem)} ${num(fy)}`
      + `Q${num((fx + bx) / 2 + hem)} ${num(fy + 2.4)} ${num(bx - flare + 1.2)} ${num(by)}C${num(bx - 4)} ${num(by - 8)} ${num(w1.x - 1.4)} ${num(w1.y + 9)} ${pt(w1)}Z`, c.g(col, 0.16), 2.6)
      + SHD(`M${num(w2.x - 4)} ${num(w2.y)}L${pt(w2)}C${num(w2.x + 2)} ${num(w2.y + 8)} ${num(fx + flare - 0.4 + hem)} ${num(fy - 8)} ${num(fx + flare + hem)} ${num(fy)}L${num(fx + 1 + hem)} ${num(fy + 0.6)}C${num(fx)} ${num(fy - 8)} ${num(w2.x - 3)} ${num(w2.y + 8)} ${num(w2.x - 4)} ${num(w2.y)}Z`, 0.14)
      + T(`M${num((w1.x + w2.x) / 2 - 3)} ${num(w1.y + 3)}Q${num((fx + bx) / 2 - 3 + hem * 0.5)} ${num(fy - 8)} ${num((fx + bx) / 2 - 4 + hem)} ${num(fy + 0.6)}`, IL(col, 0.3), 1)
      + T(`M${num(w1.x + 2)} ${num(w1.y + 4)}Q${num(bx - 1)} ${num(by - 8)} ${num(bx - 2.6)} ${num(by - 0.6)}`, IL(col, 0.22), 0.8, op(0.85))
      + T(`M${num(w1.x + 4.6)} ${num(w1.y + 3)}Q${num((fx + bx) / 2 - 6)} ${num(fy - 9)} ${num((fx + bx) / 2 - 7.4 + hem * 0.6)} ${num(fy - 1)}`, sh(col, 0.45), 0.9, op(0.75));
    if (o.trim) {
      s += T(`M${num(fx + flare + hem)} ${num(fy)}Q${num((fx + bx) / 2 + hem)} ${num(fy + 2.4)} ${num(bx - flare + 1.2)} ${num(by)}`, o.trim, 2.2);
      if (o.dots) s += T(`M${num(fx + flare - 0.8 + hem)} ${num(fy - 1.6)}Q${num((fx + bx) / 2 + hem)} ${num(fy + 0.8)} ${num(bx - flare + 2)} ${num(by - 1.6)}`, o.dots, 0.8, ' stroke-dasharray="0.8 1.8"');
    }
    return s;
  }

  /**
   * 사람 영웅 조립기.
   * cfg: { col, poses, scale, hair(c,Pz) 머리 앞(머리 좌표), backHair(c,Pz), torso(c,Pz,R,near) 몸통 위 장식(몸통 좌표, 잘림 안),
   *        torsoTop(c,Pz) 몸통 밖 장식, belt(c), skirt(c,R,fN,fF,Pz), item(c,Pz,R) → { s, gn, gf, ga, gaF, front }, fx(c,Pz,pose,ctx) → {back, front},
   *        iris, brow, mo, legO }
   */
  function humanHero(c, pose, cfg) {
    const S = cfg.col;
    const Pz = cfg.poses[pose] || cfg.poses.idle0;
    const R = rig(HUMAN, Pz);
    const it = cfg.item ? cfg.item(c, Pz, R, pose) : null;
    const nearT = it && it.gn ? it.gn : V(Pz.hn[0], Pz.hn[1]);
    const farT = it && it.gf ? it.gf : V(Pz.hf[0], Pz.hf[1]);
    const sl = { sleeve: S.sleeve, fore: S.fore || S.sleeve, cuff: S.cuff, rs: cfg.rs || 3.2, re: 2.8, rw: 2.5, roll: S.roll };
    const near = arm(R.sn, nearT, Object.assign({ inner: innerOf(c, R) }, sl, Pz.nE ? { E: Pz.nE } : {}));
    const far = arm(R.sf, farT, Object.assign({}, sl, { sleeve: sh(S.sleeve, -0.18), fore: sh(S.fore || S.sleeve, -0.16), cuff: S.cuff ? sh(S.cuff, -0.15) : undefined, roll: S.roll ? sh(S.roll, -0.12) : undefined }, Pz.fE ? { E: Pz.fE } : {}));
    const fN = foot(Pz.fn);
    const fF = foot(Pz.ff);
    const legO = Object.assign({ pant: S.pant, boot: S.boot, rim: S.bootRim }, cfg.legO || {});
    const legN = leg(c, R.hn, fN, legO);
    const legF = leg(c, R.hf, fF, Object.assign({}, legO, { pant: sh(S.pant, -0.2), boot: sh(S.boot, -0.15), rim: S.bootRim ? sh(S.bootRim, -0.15) : undefined }));

    const tid = c.clip(BODY);
    const torso = G(neckS(c, S.skin), at(HUMAN.head))
      + P(BODY, c.g(S.shirt, 0.2), 2.8)
      + CL(tid, BODY_SHD + (cfg.torso ? cfg.torso(c, Pz, R, near) : '') + G(castSegs(near.segs, 1.8, 2.2, 0.18), R.inv))
      + OUT(BODY, 2.8)
      + (cfg.torsoTop ? cfg.torsoTop(c, Pz) : '');
    const belt = cfg.belt ? cfg.belt(c, Pz) : '';
    const pelvis = cfg.pelvis === false ? '' : P('M41.2 63.4L59.6 63.2L60.2 69.4Q53 72 50 71.6Q45 71.2 40.6 69.6Z', c.g(S.pant, 0.2), 2.6);
    const skirt = cfg.skirt ? cfg.skirt(c, R, fN, fF, Pz) : '';

    const face = faceBase(c, S.skin, { noEar: !!cfg.noEar }) + CL(c.clip(HEAD), SHD('M-2 -2.6C3 -4.2 8 -5 12.6 -1.6L12.6 .6C8 -2.4 3 -2 -1 -1Z', 0.2))
      + (cfg.hair ? cfg.hair(c, Pz) : '')
      + eyes(c, Object.assign({ kind: Pz.eye || 'open', iris: cfg.iris, brow: cfg.brow, bk: Pz.bk || 'calm' }, cfg.eyeO || {}))
      + (cfg.face ? cfg.face(c, Pz) : '')
      + mouth(Pz.mo || cfg.mo || 'smile', cfg.mx, cfg.my)
      + (cfg.hairFront ? cfg.hairFront(c, Pz) : '');
    const headAll = G(G(face, at(HUMAN.head)), R.htf);
    const backHair = cfg.backHair ? G(G(G(cfg.backHair(c, Pz), at(HUMAN.head)), R.htf), R.tf) : '';
    const fx = cfg.fx ? cfg.fx(c, Pz, pose, { R, it, near, far }) : { back: '', front: '' };
    const handN = it && it.gn ? fist(c, near.H, it.ga, S.hand || S.skin, it.sideN || 1)
      : Pz.open ? palm(c, near.H, near.fa - 20, S.hand || S.skin, 'open', -1) : palm(c, near.H, near.fa, S.hand || S.skin);
    const handF = it && it.gf ? fist(c, far.H, it.gaF == null ? it.ga : it.gaF, sh(S.hand || S.skin, -0.12), -1)
      : Pz.openF ? palm(c, far.H, far.fa - 20, sh(S.hand || S.skin, -0.1), 'open', 1) : palm(c, far.H, far.fa, sh(S.hand || S.skin, -0.1));
    const body = (fx.back || '')
      + (cfg.cape ? cfg.cape(c, R, Pz) : '')
      + backHair
      + (it && it.behind ? it.s : '')
      + far.s + handF
      + legF + legN
      + (cfg.skirtUnder ? skirt : '')
      + G(G(torso, R.up) + pelvis + belt, R.tf)
      + (cfg.skirtUnder ? '' : skirt)
      + (cfg.over ? cfg.over(c, R, Pz) : '')
      + (it && !it.behind && !it.overHead ? it.s : '')
      + G(headAll, R.tf)
      + (it && it.overHead ? it.s : '')
      + near.s + handN
      + (it && it.front ? it.front : '')
      + (fx.front || '');
    return cfg.scale && cfg.scale !== 1 ? G(body, `translate(50 90) scale(${cfg.scale}) translate(-50 -90)`) : body;
  }

  /* =========================================================
   * ❄ 하루 — 귀마개 털모자 · 하늘색 망토 · 크림색 스웨터 · 눈덩이 (아이: 0.84배)
   * ========================================================= */
  const HARU_C = {
    skin: '#f8d6ba', hair: '#2c2a36', hat: '#5fb8f0', hatD: '#3a8fd0', fur: '#f4f8ff', furD: '#c9d6ea', shirt: '#fff4e2', sleeve: '#fff4e2', cuff: '#5fb8f0',
    scarf: '#5fb8f0', pant: '#3a5a86', boot: '#6a4a3a', bootRim: '#f4f8ff', iris: '#4a7ab8', hand: '#f8d6ba', mitten: '#3a8fd0',
  };
  /** 눈덩이 — 가운데 (x,y), 반지름 r */
  const snowball = (c, x, y, r = 3.6) => C(x, y, r, c.r('#f4fbff', 0.2), 1.8) + T(`M${num(x - r * 0.5)} ${num(y - r * 0.3)}Q${num(x)} ${num(y - r * 0.8)} ${num(x + r * 0.5)} ${num(y - r * 0.4)}`, '#fff', 0.8) + C(x + r * 0.35, y + r * 0.3, r * 0.22, '#c9dcf0', 0);
  const HARU = poses({
    idle0: { hn: [58, 66], hf: [56, 70], ball: 1, eye: 'open', mo: 'grin' },
    idle1: { hn: [58.4, 65], hf: [56.4, 69], ball: 1, eye: 'open', mo: 'smile' },
    walk0: { hn: [44, 67], hf: [62, 67], ball: 1, eye: 'open', mo: 'grin' },
    walk1: { hn: [51, 69], hf: [55, 69], ball: 1, eye: 'open', mo: 'grin' },
    walk2: { hn: [60, 66], hf: [45, 68], ball: 1, eye: 'open', mo: 'grin' },
    walk3: { hn: [51, 69], hf: [55, 69], ball: 1, eye: 'open', mo: 'grin' },
    // 조준: 눈덩이 든 팔을 머리 뒤로 젖힘
    aim: { b: [-1, 1], lean: -6, hd: -4, fn: [43, null, 0], ff: [58, null, -4], hn: [37, 40], nE: [40.5, 49], hf: [64, 56], openF: true, ball: 1, eye: 'focus', mo: 'grit', bk: 'angry' },
    // 공격: 팔을 앞으로 뻗어 던짐 → 눈덩이가 날아감
    attack: { b: [2.6, 1.2], lean: 10, hd: 4, fn: [41, null, 18], ff: [62, null, 0], hn: [70, 50], hf: [44, 64], open: true, eye: 'open', mo: 'shout', bk: 'up' },
    // 기술 눈사람 친구: 두 팔을 번쩍 들고 폴짝 — 눈송이가 솟음
    cast: { b: [0, -4], lean: -2, hd: -8, fn: [45, 84, 10], ff: [56, 85, 8], hn: [73, 45], nE: [61, 47], hf: [40, 27], fE: [45, 38], open: true, openF: true, eye: 'happy', mo: 'open' },
  });
  const HARU_CFG = {
    col: HARU_C, poses: HARU, scale: 0.84, iris: HARU_C.iris, brow: HARU_C.hair, mo: 'grin',
    hair(c) {
      const S = HARU_C;
      // 앞머리 + 귀마개 털모자(정수리 방울)
      return P('M-9.4 -1.6L12.4 -2.4L12.6 1L10.6 -1.2L9 1.4L7.4 -1.4L5.6 1.2L4 -1.6L2.2 1L0.6 -1.8L-1.2 0.6L-3 -1.8L-5 0.4L-7 -1.8Z', c.g(S.hair, 0.25), 1.6)
        + P('M-11.6 -2C-12.4 -10 -6 -15.6 0.8 -15.6C8 -15.6 13.6 -10.4 13.2 -2.6Z', c.g(S.hat, 0.25), 2.6)
        + CL(c.clip('M-11.6 -2C-12.4 -10 -6 -15.6 0.8 -15.6C8 -15.6 13.6 -10.4 13.2 -2.6Z'), SHD('M5 -15.6C11 -13 13.6 -8 13.2 -2.6H6Z', 0.22) + T('M-6 -12.6Q1 -15.4 8 -12.8', sh(S.hat, 0.45), 1.3, op(0.8)))
        + T('M-6 -14V-3.6M-0.6 -15.4V-3M5 -15V-3M10 -12.6V-3', IL(S.hat, 0.35), 0.8, op(0.7))
        + P('M-12.6 -3.4C-12.6 -5.6 13.8 -6.2 14 -3.8C14.2 -1.2 -12.6 -0.8 -12.6 -3.4Z', c.g(S.hatD, 0.25), 2.2)
        + FURI('M-11.8 -3.6Q0.6 -5.4 13.4 -4', S.fur, S.furD, 2.6, 2.4, 1.4)
        // 귀마개 (가까운 쪽만 보임)
        + P('M-11.4 -2.6C-13.6 -1 -13.8 6 -11.2 9.4C-9.4 11.4 -6.6 10.2 -6.8 6.6L-7.4 -1.8Z', c.g(S.hat, 0.25), 2.2)
        + FURI('M-11.6 9.2Q-8.6 11 -7 7', S.fur, S.furD, 2.2, 2, 1.2)
        + C(1.2, -17.6, 3.4, c.r(S.fur, 0.15), 2) + T('M-0.4 -18.8l1.2 .6M2.4 -17l1 .8', S.furD, 0.7);
    },
    torso(c) {
      const S = HARU_C;
      return T('M44 56Q45.6 60 44.6 64M48.6 56.4Q49.6 60.4 49 64', IL(S.shirt, 0.25), 0.9)
        + T('M43 52H58M42.6 57H59', '#cfe4f8', 1.6, op(0.9)) + T('M43 52H58M42.6 57H59', '#8ac4ec', 0.7, ' stroke-dasharray="1.4 1.4"');
    },
    torsoTop(c) {
      const S = HARU_C;
      // 목도리 (끝이 뒤로 날림)
      return P('M42.8 46.4C46.4 43.6 55 43.4 58.4 46C58.6 48.6 57.6 50 55.6 50.6C51 51.6 46.4 51.4 43 50.2C42 49 42 47.6 42.8 46.4Z', c.g(S.scarf, 0.25), 2.2)
        + T('M44 48.4Q50.4 50.4 57.2 48.2', IL(S.scarf, 0.4), 0.9) + T('M45.6 46.6l0 3M49 46.4v3.4M52.4 46.4v3.4M55.8 46.6v3', '#fff', 0.8, op(0.8))
        + P('M43.6 49.4L38.6 57.6L41.8 58.6L45.8 50.6Z', c.g(S.scarf, 0.25), 2) + T('M39.4 57.2l2 .7', '#fff', 0.9);
    },
    belt(c) { return PI('M41.6 60.8L59.6 60.4L59.8 63.2L41.8 63.6Z', c.g('#8a5a3a', 0.25), '#8a5a3a', 1.1) + OUT('M41.6 60.8L41.8 63.6M59.6 60.4L59.8 63.2', 1.8); },
    cape(c, R, Pz) {
      const S = HARU_C;
      const sw = (Pz.hem || 0) + (Pz.lean || 0) * 0.3;
      const m1 = R.W(V(44, 47), R.br);
      const m2 = R.W(V(49, 46.4), R.br);
      return P(`M${pt(m2)}C${num(m2.x - 6)} ${num(m2.y + 10)} ${num(40 - sw * 0.5 + R.dx)} ${num(66 + R.dy * 0.5)} ${num(38 - sw + R.dx * 0.6)} ${num(76)}Q${num(34 - sw * 1.4 + R.dx * 0.6)} ${num(74)} ${num(31 - sw * 1.8 + R.dx * 0.5)} ${num(75)}C${num(32 - sw + R.dx * 0.5)} ${num(64 + R.dy * 0.5)} ${num(m1.x - 5)} ${num(m1.y + 7)} ${pt(m1)}Z`, c.g(S.hat, 0.22), 2.4)
        + FURI(`M${num(38 - sw + R.dx * 0.6)} 76Q${num(34 - sw * 1.4 + R.dx * 0.6)} 74 ${num(31 - sw * 1.8 + R.dx * 0.5)} 75`, S.fur, S.furD, 2.4, 2.2, 1.2);
    },
    item(c, Pz, R) {
      if (!Pz.ball) return null;
      // 눈덩이는 가까운 손에 (손 위에 그림)
      return { front: '', ball: true };
    },
    fx(c, Pz, pose, k) {
      let back = '';
      let front = '';
      if (Pz.ball) front += snowball(c, k.near.H.x + 0.6, k.near.H.y - 3.2, pose === 'aim' ? 4.2 : 3.4);
      if (pose === 'aim') front += T(`M${num(k.near.H.x - 6)} ${num(k.near.H.y - 2)}l-3 -2M${num(k.near.H.x - 5)} ${num(k.near.H.y + 3)}l-3 1`, '#dff4ff', 1.4, op(0.9));
      if (pose === 'attack') {
        front += snowball(c, 86, 46, 4) + T('M64 48Q72 45 80 46M66 52Q73 50 79 50', '#e8f8ff', 1.6, op(0.8))
          + C(90, 44, 1.2, '#fff', 0) + C(84, 41, 1, '#e8f8ff', 0);
      }
      if (pose === 'cast') {
        back += C(50, 34, 26, c.halo('#dff4ff', 0.55), 0);
        front += [[30, 26, 3], [70, 18, 3.4], [50, 10, 2.6], [22, 46, 2.4], [80, 40, 2.6]].map(([x, y, r]) => star(x, y, r, '#ffffff')).join('')
          // 땅에서 솟는 작은 눈사람
          + G(snowmanBody(c, 'cast', 0.5), 'translate(76 90) scale(0.5) translate(-50 -90)');
      }
      return { back, front };
    },
  };
  function haru(c, pose) { return humanHero(c, pose, HARU_CFG); }

  /* ---------- 눈사람 (하루의 기술, 유닛) — 눈덩이 둘 · 숯 눈 · 당근 코 · 목도리 · 나뭇가지 팔 ---------- */
  function snowmanBody(c, pose, k = 1) {
    const bob = pose === 'walk0' ? -1.5 : pose === 'walk1' ? 0 : pose === 'aim' ? 1 : 0;
    const lean = pose === 'aim' ? -8 : pose === 'attack' ? 12 : 0;
    const o = `rotate(${lean} 50 90)`;
    const arm1 = pose === 'attack' ? 'M62 58L80 50M74 53l4 -5M76 52l5 1' : pose === 'aim' ? 'M62 58L74 44M70 49l-1 -5M72 46l4 -2' : 'M62 60L76 54M72 56l3 -4M73 55l4 1';
    const arm2 = 'M38 60L26 52M30 55l-3 -4M29 54l-4 1';
    let s = T(arm2, '#7a5236', 2.6) + T(arm2, '#a8784a', 1.2)
      + C(50, 74 + bob * 0.3, 15, c.r('#f4fbff', 0.18), 2.8)
      + T('M38 80Q50 88 62 80', '#c9dcf0', 1.4, op(0.9)) + C(50, 70 + bob * 0.3, 1.6, '#3a3040', 0) + C(50, 77 + bob * 0.3, 1.6, '#3a3040', 0)
      + C(50, 51 + bob, 11, c.r('#f4fbff', 0.18), 2.6)
      + P(`M40 ${57 + bob}Q50 ${62 + bob} 60 ${57 + bob}L61 ${61 + bob}Q50 ${66 + bob} 39 ${61 + bob}Z`, c.g('#ff7a6a', 0.25), 2)
      + P(`M56 ${60 + bob}L60 ${70 + bob}L64 ${68 + bob}L59 ${59 + bob}Z`, c.g('#ff7a6a', 0.25), 1.8)
      + C(47, 48 + bob, 1.6, '#2a2430', 0) + C(55, 48 + bob, 1.4, '#2a2430', 0)
      + P(`M51 ${51.5 + bob}L60 ${53 + bob}L51 ${54.4 + bob}Z`, c.g('#ff9a3a', 0.3), 1.4)
      + T(`M46 ${54.6 + bob}q1 1 2 1.2M50 ${55.4 + bob}h1.4M53.6 ${55 + bob}q1 0 2-1`, '#2a2430', 1.2)
      + P(`M42 ${43 + bob}Q50 ${36 + bob} 58 ${43 + bob}L57 ${45 + bob}Q50 ${41 + bob} 43 ${45 + bob}Z`, c.g('#3a8fd0', 0.25), 1.8)
      + T(arm1, '#7a5236', 2.6) + T(arm1, '#a8784a', 1.2);
    if (pose === 'attack') s += T('M80 50l6 -2M82 54l5 1', '#dff4ff', 1.6, op(0.9)) + star(86, 46, 2.6, '#fff');
    return G(s, o);
  }
  const snowmanUnit = (c, pose) => snowmanBody(c, pose);

  /* =========================================================
   * 🔥 도한 — 넓은 어깨 · 짧은 회색빛 수염 · 가죽 앞치마와 토시 · 짧은 단조 망치
   * ========================================================= */
  const DOHAN_C = {
    skin: '#d9a07a', hair: '#5a4a44', hairG: '#9a8e88', shirt: '#b8644a', sleeve: '#b8644a', fore: '#d9a07a', roll: '#a8563e', cuff: '#7a4a30',
    apron: '#7a4a30', strap: '#5a3424', band: '#d8503a', belt: '#3a2a20', brass: '#e8c07a', pant: '#4a3a34', boot: '#3a2a24', iris: '#6a3a24', steel: '#6a6e80', wood: '#8a5a32', hand: '#d9a07a',
  };
  /** 단조 망치: 손 (x,y)에서 자루가 각 a(도)로 뻗고 끝에 쇠머리 */
  function smithHammer(c, p, a, hot = 0) {
    const K = DOHAN_C;
    const top = pol(p, 17, a);
    const base = pol(p, -4, a);
    const hd = 'M-3.6 -6.4H3.6V6.4H-3.6Z';
    return limb([{ a: base, b: top, ra: 1.5, rb: 1.7, col: K.wood }], 1.6)
      + G(P(hd, c.gl(K.steel, a + 90, 0.32), 2.4) + T('M-1.4 -5.6V5.6', sh(K.steel, 0.55), 1.1, op(0.75))
        + P('M-3.6 3.6H3.6V6.4H-3.6Z', hot ? '#ffb43a' : sh(K.steel, -0.2), 0)
        + (hot ? C(0, 6.6, hot > 1 ? 7 : 4.5, c.halo('#ffd23a', 0.9), 0) : ''), at(top, a));
  }
  const DOHAN = poses({
    idle0: { b: [0, 0.4], hn: [60, 66], ham: [-60], hf: [56, 70], eye: 'lidded', mo: 'line' },
    idle1: { b: [0, 0.4], hn: [60.2, 65.2], ham: [-58], hf: [56.2, 69.2], eye: 'lidded', mo: 'line' },
    walk0: { hn: [46, 67], ham: [-80], hf: [62, 67], eye: 'lidded', mo: 'line' },
    walk1: { hn: [52, 69], ham: [-68], hf: [56, 69], eye: 'lidded', mo: 'line' },
    walk2: { hn: [60, 66], ham: [-50], hf: [46, 68], eye: 'lidded', mo: 'line' },
    walk3: { hn: [52, 69], ham: [-68], hf: [56, 69], eye: 'lidded', mo: 'line' },
    // 조준: 망치를 어깨 뒤로 젖혀 던질 준비 (쇠머리가 달아오름)
    aim: { b: [-1.4, 1.2], lean: -6, hd: -3, fn: [42, null, 2], ff: [59, null, -4], hn: [40, 40], nE: [41, 50], ham: [-150], hot: 1, hf: [62, 58], openF: true, eye: 'focus', mo: 'grit', bk: 'angry' },
    // 공격: 앞으로 던짐 → 손은 비고 망치가 돌며 날아감
    attack: { b: [3, 1.6], lean: 12, hd: 5, fn: [40, null, 20], ff: [63, null, 0], hn: [72, 54], hf: [44, 64], open: true, eye: 'focus', mo: 'grit', bk: 'angry' },
    // 기술 담금질: 망치를 높이 들어 불티를 뿌림
    cast: { b: [0, 1.4], lean: -3, hd: -6, fn: [43, null, 0], ff: [58, null, -2], hn: [66, 32], nE: [60, 42], ham: [-84], hot: 2, hf: [40, 52], openF: true, eye: 'focus', mo: 'open', bk: 'angry' },
  });
  const DOHAN_CFG = {
    col: DOHAN_C, poses: DOHAN, scale: 1.04, rs: 3.6, iris: DOHAN_C.iris, brow: DOHAN_C.hair, mo: 'line', eyeO: { y: 2 },
    hair(c) {
      const S = DOHAN_C;
      return P('M-9.6 4C-12.6 -2 -11.6 -9 -6.6 -11.8C-2 -14.4 5 -14.2 9 -11C12 -8.6 13 -5 12.6 -2C10 -4 6 -5.4 1.6 -5C-2.6 -4.6 -5.4 -2.6 -7 0.6Z', c.g(S.hair, 0.22), 2.4)
        + T('M-6 -10.6Q1 -13.4 8 -10.6', S.hairG, 1.2, op(0.85)) + T('M-9 -2Q-9.6 -6 -7 -9', S.hairG, 0.8, op(0.7))
        // 짧은 수염 (턱·뺨)
        + P('M-4.4 6.6C-3 11.6 2 14.6 6 13.4C9.6 12.4 11.6 9 11.6 4.6C9.8 7 7.6 8 5.6 7.8C3.6 9.4 0.6 9.4 -1.4 7.6C-2.6 7.6 -3.6 7.2 -4.4 6.6Z', c.g(S.hair, 0.2), 2)
        + T('M0 10.6l.4 1.6M3 11.6l.2 1.6M6 11.6l-.2 1.6M8.6 10.2l-.6 1.4', S.hairG, 0.8)
        + P('M2.6 6.4Q6.2 5.4 9.6 6.6Q6.2 7.8 2.6 6.4Z', c.g(S.hair, 0.2), 1.2)
        + T('M-6 -3.6Q-3.2 -5.4 0 -4.6', S.hair, 1.6)
        // 붉은 두건(이마 띠) + 뒤로 묶은 매듭
        + P('M-11.4 -5.2C-6 -8.8 6 -9.4 12.8 -5.6L12.6 -2.4C6 -5.8 -5 -5.6 -11.2 -1.8Z', c.g(S.band, 0.25), 2.2)
        + T('M-9.6 -4.4C-4 -7.2 5 -7.6 11.6 -4.6', sh(S.band, 0.4), 0.9, op(0.85))
        + P('M-11 -4.2L-17.4 -1.6L-16.6 2L-10.6 -1.2Z', c.g(S.band, 0.25), 1.8) + P('M-11 -3.6L-15.6 -8.6L-18 -6.2L-11.6 -1.8Z', c.g(sh(S.band, -0.1), 0.25), 1.8)
        + C(-11, -3, 1.9, c.g(S.band, 0.25), 1.8);
    },
    torso(c) {
      const S = DOHAN_C;
      return PI('M45.2 50L59 49C60 55 60.2 61 59.8 67H44.6Z', c.g(S.apron, 0.25), S.apron, 1.5)
        + STITCH('M46.4 51.4L58 50.6', sh(S.apron, 0.4), 0.7)
        + PI('M48 56H53.4V60.2Q50.7 61.2 48 60.2Z', c.g(sh(S.apron, -0.08), 0.2), S.apron, 1)
        + T('M49 55.8V53.6M51.6 55.8l.8 -2.4', '#9aa0b4', 0.9)
        + SHD('M55.4 49.4L59 49C60 55 60.2 61 59.8 67H55.6C56.6 61 56.6 56 55.4 49.4Z', 0.24);
    },
    torsoTop(c) {
      const S = DOHAN_C;
      return LI('M46.6 50.4L44.4 45.6', S.strap, 2.4) + LI('M58.2 49.6L56.8 45.8', sh(S.strap, -0.15), 2.2)
        + C(46.6, 50.8, 1.5, c.r(S.brass, 0.4), 0) + C(58.2, 49.8, 1.4, c.r(S.brass, 0.4), 0)
        + T('M43 45.8Q50 43.4 57.6 45.6', IL(S.shirt, 0.4), 1.2);
    },
    belt(c) {
      const S = DOHAN_C;
      return PI('M41 60.8L59.8 60.4L60 64.2L41.2 64.6Z', c.g(S.belt, 0.25), S.belt, 1.3) + OUT('M41 60.8L41.2 64.6M59.8 60.4L60 64.2', 2.2)
        + PI('M54.6 60.6H58.2V64.2H54.6Z', c.g(S.brass, 0.35), S.brass, 1.1)
        // 허리의 집게
        + T('M43.4 63.6L41.6 70.4M44.6 63.6L43.6 70.6', '#5a5e6e', 1.4);
    },
    skirt(c, R, fN, fF, Pz) {
      const S = DOHAN_C;
      const ap = Pz.hem || 0;
      const a1 = R.W(V(45.4, 64.4));
      const a2 = R.W(V(60, 64));
      const Xx = (x) => num(x + R.dx);
      const Yy = (y) => num(y + R.dy);
      return P(`M${pt(a1)}L${pt(a2)}L${Xx(62.4 + ap)} ${Yy(76)}Q${Xx(54 + ap)} ${Yy(77.6)} ${Xx(45.6 + ap * 0.6)} ${Yy(76.4)}Z`, c.g(S.apron, 0.25), 2.4)
        + T(`M${Xx(52.6 + ap * 0.3)} ${Yy(66)}L${Xx(53.4 + ap * 0.8)} ${Yy(76.2)}`, IL(S.apron, 0.42), 0.9)
        + STITCH(`M${Xx(46.4 + ap * 0.6)} ${Yy(74.8)}Q${Xx(54 + ap)} ${Yy(76)} ${Xx(61.6 + ap)} ${Yy(74.6)}`, sh(S.apron, 0.38), 0.8, '1.4 1.2');
    },
    item(c, Pz) {
      if (!Pz.ham) return null;
      const a = Pz.ham[0];
      const g = V(Pz.hn[0], Pz.hn[1]);
      return { s: '', gn: g, ga: a, front: smithHammer(c, g, a, Pz.hot || 0), sideN: 1 };
    },
    fx(c, Pz, pose, k) {
      let back = '';
      let front = '';
      if (pose === 'aim') back += C(k.near.H.x, k.near.H.y - 12, 10, c.halo('#ffb03a', 0.5), 0);
      if (pose === 'attack') {
        // 날아가는 망치 (돌며)
        front += G(smithHammer(c, V(0, 0), 30, 1), 'translate(76 40) scale(0.9)') + T('M64 50Q70 45 74 46M66 56Q72 53 76 52', '#ffd8a0', 1.6, op(0.8))
          + P(arcBand(80, 46, 12, 9, -150, 30), '#fff4dc', 0, op(0.5));
      }
      if (pose === 'cast') {
        const hh = pol(k.near.H, 17, -100);
        back += C(hh.x, hh.y, 18, c.halo('#ff8a3d', 0.7), 0);
        front += [[hh.x - 10, hh.y - 6], [hh.x + 9, hh.y - 9], [hh.x + 13, hh.y + 4], [hh.x - 13, hh.y + 6], [hh.x, hh.y - 15]].map(([x, y], i) => C(x, y, i % 2 ? 1.3 : 1.8, i % 2 ? '#fff2a8' : '#ffd23a', 0)).join('')
          + T(`M${num(hh.x - 6)} ${num(hh.y - 2)}l-5 -4M${num(hh.x + 5)} ${num(hh.y - 3)}l5 -5M${num(hh.x + 6)} ${num(hh.y + 3)}l6 1`, '#ffe6a0', 1.5, op(0.9));
      }
      return { back, front };
    },
  };
  function dohan(c, pose) { return humanHero(c, pose, DOHAN_CFG); }

  /* =========================================================
   * 🌪 나래 — 바람새 "솔개"를 탄 기수 · 고글 · 깃털 목도리 (공중 영웅: 새가 떠 있음)
   * ========================================================= */
  const NARAE_C = {
    skin: '#f4caa4', hair: '#7a4a32', jacket: '#2f9ab8', jacketL: '#f2ead8', scarf: '#f4fbff', scarfD: '#9ad8ee', goggle: '#ffbe4a', strap: '#5a3a2a',
    iris: '#2a7a9a', glove: '#8a5a3a', bird: '#5cc8e6', birdD: '#2e86b4', belly: '#effaff', tip: '#2a4f86', beak: '#ffc23a', talon: '#e8a83a', rein: '#8a5a3a',
  };
  /** 날개 한 짝: root(세상 좌표), a 방향(도), k 길이 배율, col. 앞날개깃(앞쪽 가장자리)은 지역 +y */
  function birdWing(c, root, a, k, col, far = false) {
    const L = 40 * k;
    const tipC = far ? sh(NARAE_C.tip, -0.15) : NARAE_C.tip;
    const d = `M0 4C${num(L * 0.3)} 10 ${num(L * 0.66)} 8.6 ${num(L)} 1`
      + `L${num(L - 2.4)} -3.4L${num(L * 0.9)} -1.4L${num(L * 0.86)} -6.6L${num(L * 0.76)} -4.2L${num(L * 0.72)} -9.4L${num(L * 0.62)} -7L${num(L * 0.58)} -11.4`
      + `Q${num(L * 0.44)} -9.4 ${num(L * 0.4)} -12.2Q${num(L * 0.27)} -9.8 ${num(L * 0.22)} -12.4Q${num(L * 0.1)} -10.2 0 -10Z`;
    const id = c.clip(d);
    return G(P(d, c.gl(col, a + 90, 0.24), 2.4)
      + CL(id, P(`M${num(L * 0.56)} -14L${num(L + 4)} -14L${num(L + 4)} 12L${num(L * 0.74)} 12Z`, tipC, 0, op(0.9))
        + P(`M-2 2C${num(L * 0.3)} 7.4 ${num(L * 0.6)} 6.6 ${num(L)} 1L${num(L)} 12L-2 12Z`, sh(col, 0.32), 0, op(0.8))
        + T(`M2 1.6C${num(L * 0.3)} 6.6 ${num(L * 0.6)} 6 ${num(L * 0.92)} 1.4`, '#fff', 0.8, op(0.5))
        + T(`M${num(L * 0.9)} -1.4L${num(L * 0.7)} 1.6M${num(L * 0.76)} -4.2L${num(L * 0.58)} 1.4M${num(L * 0.62)} -7L${num(L * 0.46)} 0.6M${num(L * 0.4)} -12.2L${num(L * 0.34)} -1M${num(L * 0.22)} -12.4L${num(L * 0.18)} -2`, IL(col, 0.4), 0.9)
        + SHD(`M0 -10Q${num(L * 0.3)} -11 ${num(L * 0.58)} -11.4L${num(L)} 1L${num(L)} -16L0 -16Z`, 0.16)), at(root, a));
  }
  const NARAE = poses({
    idle0: { wing: [240, 1.04], bob: 0, hn: [63, 60], hf: [61, 59], eye: 'open', mo: 'grin' },
    idle1: { wing: [196, 0.78], bob: -1.2, hn: [63, 59.4], hf: [61, 58.4], eye: 'open', mo: 'smile' },
    walk0: { wing: [250, 1.08], bob: 1, hn: [63, 60], hf: [61, 59], eye: 'open', mo: 'grin' },
    walk1: { wing: [200, 0.74], bob: -0.4, hn: [63, 59.4], hf: [61, 58.6], eye: 'open', mo: 'grin' },
    walk2: { wing: [154, 0.9], bob: -1.8, hn: [63, 58.6], hf: [61, 58], eye: 'open', mo: 'grin' },
    walk3: { wing: [200, 0.74], bob: -0.4, hn: [63, 59.4], hf: [61, 58.6], eye: 'open', mo: 'grin' },
    // 조준: 가까운 손을 뒤로 젖혀 바람을 모음
    aim: { wing: [210, 0.82], bob: 0, lean: -4, hn: [38, 44], nE: [40, 54], hf: [61, 59], open: true, eye: 'focus', mo: 'grit', bk: 'angry', swirl: 1 },
    // 공격: 앞으로 손을 뻗어 바람 칼날을 날림
    attack: { wing: [160, 0.88], bob: -1, lean: 10, hn: [74, 48], hf: [61, 59], open: true, eye: 'open', mo: 'shout', bk: 'up' },
    // 기술 돌풍 급강하: 새가 머리를 숙이고 날개를 뒤로 접어 내리꽂음
    cast: { wing: [186, 1.06], bob: 2, dive: 22, lean: 16, hd: 6, hn: [64, 61], hf: [62, 60], eye: 'focus', mo: 'grit', bk: 'angry' },
  });
  const NARAE_RIDER = {
    col: Object.assign({}, NARAE_C, { shirt: NARAE_C.jacket, sleeve: NARAE_C.jacket, cuff: NARAE_C.glove, pant: '#3a4a6a', boot: '#5a3a2a', hand: NARAE_C.glove }),
    iris: NARAE_C.iris, brow: NARAE_C.hair,
    hair(c) {
      const S = NARAE_C;
      // 바람에 뒤로 날리는 짧은 머리 + 이마 위 고글
      return P('M-9.6 5.6C-12.4 1 -12.6 -5 -10 -8.6L-17.6 -9.4L-11.6 -11.6L-16 -15.6L-8.4 -13.6C-5 -15.6 0 -15.8 4 -14.4C8.6 -12.8 12.2 -8.6 12.6 -3.2C9.4 -5.2 5 -6 1 -5.4C-2.6 -4.8 -5.4 -2.6 -6.6 0.4C-7.8 1.8 -8.6 3.6 -9.6 5.6Z', c.g(S.hair, 0.24), 2.4)
        + T('M-8 -11.4Q-1 -14.4 6 -12.6M-15 -10.4L-9.6 -9.6M-14 -14.6L-8 -12.8', sh(S.hair, 0.42), 1.1, op(0.85))
        + T('M10.6 -6.6Q4.6 -9 -2 -8.4', IL(S.hair, 0.4), 0.9)
        + P('M-11 -6.4C-5 -9.6 6 -10 12.8 -6.6L12.6 -4C6 -7 -5 -6.6 -10.8 -3.6Z', c.g(S.strap, 0.25), 1.8)
        + C(2.2, -8.4, 3.4, c.r(S.goggle, 0.35), 1.8) + C(9, -7.6, 2.9, c.r(S.goggle, 0.35), 1.8)
        + T('M0.8 -9.6l1.6 -1M7.8 -8.8l1.4 -.9', '#fff', 0.9) + T('M5.6 -8.2h0.8', S.strap, 1.4);
    },
    torso(c) {
      const S = NARAE_C;
      return P('M50.4 46L52.4 67L49 67L47.6 46.4Z', S.jacketL, 0) + T('M50.4 46L52.4 67', IL(S.jacket, 0.4), 1)
        + C(53.6, 54, 0.9, '#e8c07a', 0) + C(54, 59, 0.9, '#e8c07a', 0)
        + T('M43 52Q44.4 56 43.8 60', IL(S.jacket, 0.4), 0.9);
    },
    torsoTop(c) {
      const S = NARAE_C;
      // 깃털 목도리: 목둘레 + 뒤로 날리는 깃털 셋
      const fth = (x, y, a, l, col) => G(P(`M0 0Q${num(l * 0.5)} -2.6 ${num(l)} 0Q${num(l * 0.5)} 2.6 0 0Z`, c.g(col, 0.2), 1.6) + T(`M0 0L${num(l * 0.9)} 0`, IL(col, 0.35), 0.6), `translate(${x} ${y}) rotate(${a})`);
      return fth(44, 47, 170, 12, S.scarfD) + fth(44, 48.6, 186, 13, S.scarf) + fth(44.4, 46, 156, 10, S.scarf)
        + P('M42.8 46.2C46.4 43.4 55 43.2 58.4 45.8C58.8 48.4 57.6 49.8 55.6 50.4C51 51.4 46.4 51.2 43 50C42 48.8 42 47.4 42.8 46.2Z', c.g(S.scarf, 0.18), 2.2)
        + T('M44 47.6l1.6 1.8M47.4 47.2l1.4 2.2M51 47l1 2.4M54.6 47l.8 2.2', S.scarfD, 0.9);
    },
  };
  function narae(c, pose) {
    const S = NARAE_C;
    const Pz = NARAE[pose] || NARAE.idle0;
    const [wa, wk] = Pz.wing;
    const bob = Pz.bob || 0;
    const up = wa > 190;
    // 기수 (사람 뼈대 0.7배, 새 등 위)
    const R = rig(HUMAN, Pz);
    const cfg = NARAE_RIDER;
    const K = cfg.col;
    const sl = { sleeve: K.sleeve, cuff: K.cuff, rs: 3.2, re: 2.8, rw: 2.5 };
    const near = arm(R.sn, V(Pz.hn[0], Pz.hn[1]), Object.assign({ inner: innerOf(c, R) }, sl, Pz.nE ? { E: Pz.nE } : {}));
    const far = arm(R.sf, V(Pz.hf[0], Pz.hf[1]), Object.assign({}, sl, { sleeve: sh(K.sleeve, -0.18), cuff: sh(K.cuff, -0.15) }));
    const tid = c.clip(BODY);
    const torso = G(neckS(c, S.skin), at(HUMAN.head)) + P(BODY, c.g(K.shirt, 0.2), 2.8)
      + CL(tid, BODY_SHD + cfg.torso(c) + G(castSegs(near.segs, 1.8, 2.2, 0.18), R.inv)) + OUT(BODY, 2.8) + cfg.torsoTop(c);
    const face = faceBase(c, S.skin, { noEar: false }) + cfg.hair(c) + eyes(c, { kind: Pz.eye, iris: cfg.iris, brow: cfg.brow, bk: Pz.bk || 'calm' }) + mouth(Pz.mo);
    // 앉은 다리 (가까운 쪽만): 엉덩이 → 앞으로 무릎 → 아래로 발
    const legN = leg(c, R.hn, [57.6, 76, 20], { pant: K.pant, boot: K.boot, rim: '#8a5a3a' });
    const handN = Pz.open ? palm(c, near.H, near.fa - 20, K.hand, 'open', -1) : fist(c, near.H, near.fa + 90, K.hand, 1);
    const handF = fist(c, far.H, far.fa + 90, sh(K.hand, -0.12), 1);
    const rider = far.s + handF + G(G(torso, R.up), R.tf) + G(G(G(face, at(HUMAN.head)), R.htf), R.tf);
    const riderNear = legN + near.s + handN;
    const RT = (s) => G(s, 'translate(46 61) scale(0.7) translate(-50 -65)');

    // 새 (세상 좌표, 머리 오른쪽)
    const body = 'M27 64C31 56 45 52 57 53C65 53.6 69.6 56 70.6 60C69.6 66 61.6 72 49.6 72C39.6 72 31.6 69 27 64Z';
    const head = 'M63 57C62.6 49 68.6 44.4 74 45C79.4 45.6 82 49.6 81.4 54C80.6 58.4 76 60.6 70 60.4Z';
    const bid = c.clip(body);
    const birdBack = birdWing(c, V(57, 55), wa + (up ? 6 : -4), wk * 0.92, sh(S.bird, -0.16), true)
      + P('M30 61L10 54.6L15.6 61.6L8.6 66.6L30 67.6Z', c.g(S.birdD, 0.24), 2.4) + T('M29 63L13 60M29 65.6L12 65.2', IL(S.birdD, 0.4), 0.9)
      + P('M10 54.6L15.6 61.6L8.6 66.6L11.6 61Z', S.tip, 0, op(0.85));
    const birdBody = P(body, c.g(S.bird, 0.24), 2.6)
      + CL(bid, P('M33 66C42 71.4 57 72.4 67 63.4L72 70L30 74Z', S.belly, 0) + T('M40 62Q45 66 50 62M48 63Q53 67 58 62.6', IL(S.bird, 0.3), 0.9, op(0.75)) + SHD('M27 63C38 70 55 73 70 62L72 76L26 76Z', 0.14)
        + T('M33 58C40 54.4 50 53.6 58 54.4', sh(S.bird, 0.45), 1.3, op(0.8)))
      + OUT(body, 2.6)
      + P('M48.6 71.4l-1.4 3.6M51.6 71.6l-.6 3.8M54.4 71.2l.4 3.6', 'none', 0) + T('M48 72l-1.2 3.4M51 72.2l-.4 3.6M54 71.8l.6 3.4', S.talon, 1.6);
    const birdHead = P(head, c.g(S.bird, 0.24), 2.6)
      + P('M63.4 50.6L56 47.6L62 52.6Z', c.g(S.birdD, 0.25), 1.8) + P('M64.4 48L58.6 43L64.4 50.6Z', c.g(S.birdD, 0.25), 1.8)
      + P('M66 58.4C70 60 75 59.6 78 57.6C76.6 60.4 72 61.6 67 60.4Z', S.belly, 0)
      + P('M80 49.4C84.6 48.8 88.6 51 89.2 54.4C87.6 53.6 85.4 53.8 83.4 55.4L80.4 55.6Z', c.g(S.beak, 0.3), 2)
      + T('M81 52.6L86 53.2', IL(S.beak, 0.4), 0.9)
      + C(75.2, 50.4, 2, '#22202e', 0) + C(74.6, 49.8, 0.7, '#fff', 0) + T('M72.4 48Q75.4 46.6 78 48.4', OLC, 1.3);
    const reins = T(`M${num(46 + (Pz.hf[0] - 50) * 0.7)} ${num(61 + (Pz.hf[1] - 65) * 0.7)}Q70 60 76 55.6`, S.rein, 1);
    const wingNear = birdWing(c, V(52, 58.6), wa, wk, S.bird);

    let back = '';
    let front = '';
    if (Pz.swirl) {
      const p = V(46 + (Pz.hn[0] - 50) * 0.7, 61 + (Pz.hn[1] - 65) * 0.7);
      back += C(p.x, p.y, 7, c.halo('#c8f4ff', 0.7), 0);
      front += T(`M${num(p.x - 4)} ${num(p.y)}a4 4 0 1 1 4 4a2.4 2.4 0 1 1 -2 -2.6`, '#e8fbff', 1.4, op(0.95));
    }
    if (pose === 'attack') front += P('M86 28Q98 38 88 52Q94 40 84 30Z', c.g('#c8f4ff', 0.3), 1.6, op(0.95)) + T('M68 36Q78 35 86 38M70 44Q78 43 84 46', '#e8fbff', 1.4, op(0.85));
    if (pose === 'cast') back += T('M4 30L30 44M2 46L26 54M8 62L30 64M14 22L34 36', '#dff6ff', 1.8, op(0.8)) + T('M20 74L36 70M10 54L22 56', '#ffffff', 1.2, op(0.6));
    const all = birdBack + (up ? wingNear : '') + birdBody + RT(rider) + birdHead + RT(riderNear) + reins + (up ? '' : wingNear);
    const tr = `translate(0 ${num(bob - 6)})${Pz.dive ? ` rotate(${Pz.dive} 52 62)` : ''}`;
    return back + G(all, tr) + front;
  }

  /* =========================================================
   * 🍄 토리 — 무릎 높이 이끼 정령 · 연두 버섯 갓(흰 점) · 큰 눈 · 등의 새싹
   * ========================================================= */
  const TORI_C = {
    body: '#e9e2c4', bodyD: '#b8ae86', cap: '#9ccf5a', capD: '#5f9a34', gill: '#f2e6c4', dot: '#fbf6dc', moss: '#6aa83e', sprout: '#7ccf4a',
    eye: '#2a2a1e', blush: '#ff9a7a', spore: '#d8f08a', rock: '#8a8a7a', rockD: '#64645a',
  };
  const TORI = {
    idle0: { b: [0, 0], sq: 1, fn: [44, 0], ff: [56, 0], an: [36, 74], af: [64, 74], eye: 'open', mo: 'smile' },
    idle1: { b: [0, 0.8], sq: 0.96, fn: [44, 0], ff: [56, 0], an: [36, 75], af: [64, 75], eye: 'open', mo: 'smile', cap: 2 },
    walk0: { b: [0, -1.4], tilt: 5, fn: [52, 3], ff: [44, 0], an: [37, 72], af: [63, 76], eye: 'open', mo: 'o' },
    walk1: { b: [0, 0], tilt: 0, fn: [48, 0], ff: [52, 0], an: [36, 74], af: [64, 74], eye: 'open', mo: 'smile' },
    walk2: { b: [0, -1.4], tilt: -5, fn: [44, 0], ff: [56, 3], an: [37, 76], af: [63, 72], eye: 'open', mo: 'o' },
    walk3: { b: [0, 0], tilt: 0, fn: [48, 0], ff: [52, 0], an: [36, 74], af: [64, 74], eye: 'open', mo: 'smile' },
    // 조준: 몸을 뒤로 젖혀 갓에서 포자를 모음
    aim: { b: [-1, 1], tilt: -10, sq: 1.04, fn: [44, 0], ff: [56, 0], an: [34, 68], af: [64, 70], eye: 'focus', mo: 'line', puff: 1 },
    // 공격: 앞으로 꾸벅 — 포자 덩어리가 날아감
    attack: { b: [2, 0.6], tilt: 14, sq: 0.94, fn: [46, 0], ff: [58, 0], an: [40, 76], af: [70, 70], eye: 'closed', mo: 'o', shot: 1 },
    // 기술 거인 변신: 두 팔 번쩍, 이끼가 빛나고 돌멩이가 떠오름
    cast: { b: [0, -2], tilt: 0, sq: 1.06, fn: [44, 0], ff: [56, 0], an: [34, 60], af: [66, 60], eye: 'closed', mo: 'shout', glow: 1 },
  };
  /** 갓: 가운데 (x, y) 위쪽, 폭 w. 이끼 술과 흰 점 */
  function mushCap(c, x, y, w, k = 1, tiltCap = 0) {
    const S = TORI_C;
    const hw = w / 2;
    const d = `M${num(x - hw)} ${num(y)}C${num(x - hw)} ${num(y - w * 0.62)} ${num(x + hw)} ${num(y - w * 0.66)} ${num(x + hw + 1)} ${num(y + 0.6)}Q${num(x)} ${num(y + w * 0.16)} ${num(x - hw)} ${num(y)}Z`;
    const id = c.clip(d);
    return G(P(`M${num(x - hw * 0.84)} ${num(y + 0.4)}Q${num(x)} ${num(y + w * 0.26)} ${num(x + hw * 0.88)} ${num(y + 1)}L${num(x + hw * 0.7)} ${num(y + 2.6)}Q${num(x)} ${num(y + w * 0.3)} ${num(x - hw * 0.7)} ${num(y + 2.2)}Z`, S.gill, 1.8)
      + T(`M${num(x - hw * 0.5)} ${num(y + 1.6)}l1 1.6M${num(x - hw * 0.2)} ${num(y + 2.4)}l.4 1.8M${num(x + hw * 0.14)} ${num(y + 2.6)}l-.2 1.8M${num(x + hw * 0.46)} ${num(y + 2)}l-.8 1.6`, sh(S.gill, -0.3), 0.8)
      + P(d, c.r(S.cap, 0.3), 2.6 * k)
      + CL(id, SHD(`M${num(x + hw * 0.2)} ${num(y - w * 0.6)}C${num(x + hw)} ${num(y - w * 0.4)} ${num(x + hw + 2)} ${num(y)} ${num(x + hw + 2)} ${num(y + 2)}H${num(x)}Z`, 0.18)
        + E(x - hw * 0.4, y - w * 0.32, w * 0.16, w * 0.1, S.dot, 1.2) + E(x + hw * 0.14, y - w * 0.44, w * 0.11, w * 0.07, S.dot, 1.2)
        + E(x + hw * 0.6, y - w * 0.2, w * 0.1, w * 0.07, S.dot, 1.2) + E(x - hw * 0.05, y - w * 0.14, w * 0.07, w * 0.05, S.dot, 1)
        + T(`M${num(x - hw * 0.7)} ${num(y - w * 0.3)}Q${num(x - hw * 0.3)} ${num(y - w * 0.56)} ${num(x + hw * 0.1)} ${num(y - w * 0.56)}`, sh(S.cap, 0.5), 1.2 * k, op(0.85)))
      // 갓 가장자리 이끼 술
      + FURI(`M${num(x - hw + 1)} ${num(y + 0.6)}Q${num(x)} ${num(y + w * 0.17)} ${num(x + hw)} ${num(y + 1.2)}`, S.moss, S.capD, 2.4 * k, 3 * k, 1.2), tiltCap ? `rotate(${tiltCap} ${x} ${y})` : '');
  }
  function tori(c, pose) {
    const S = TORI_C;
    const Pz = TORI[pose] || TORI.idle0;
    const [dx, dy] = Pz.b;
    const sq = Pz.sq || 1;
    const tr = `translate(${dx} ${dy}) rotate(${Pz.tilt || 0} 50 88) translate(50 88) scale(${num(1 / Math.sqrt(sq))} ${sq}) translate(-50 -88)`;
    const footP = (f, col) => E(f[0], 87.6 - f[1], 4.2, 2.8, c.g(col, 0.2), 2);
    const armP = (a, col) => {
      const sx = a[0] < 50 ? 40 : 60;
      return limb([{ a: V(sx, 74), b: V(a[0], a[1]), ra: 2.6, rb: 2.4, col }], 1.8) + C(a[0], a[1], 2.6, c.g(col, 0.2), 1.8);
    };
    const bodyD = 'M50 58C60 58 64.6 66 64.6 74.6C64.6 83 59 88 50 88C41 88 35.4 83 35.4 74.6C35.4 66 40 58 50 58Z';
    const bid = c.clip(bodyD);
    let back = '';
    let front = '';
    const body = armP(Pz.af, sh(S.body, -0.14))
      + footP(Pz.ff, sh(S.bodyD, -0.1))
      // 등의 새싹
      + T('M40 64Q36 58 37 54', S.capD, 2.4) + T('M40 64Q36 58 37 54', S.sprout, 1.2)
      + P('M37 54C33 53 30 50 30 47C34 47 37 50 37 54Z', c.g(S.sprout, 0.25), 1.8) + P('M37 54C38 50 42 48 45 49C44 52 41 54 37 54Z', c.g(S.sprout, 0.25), 1.8)
      + P(bodyD, c.r(S.body, 0.25), 2.6)
      + CL(bid, SHD('M58 60C64 66 66 80 58 88H66V58Z', 0.2) + SHD('M34 82Q50 92 66 82V90H34Z', 0.14)
        + P('M35 70Q38 66 42 68Q41 72 36 74Z', S.moss, 0, op(0.85)) + P('M56 82Q60 80 64 82L64 88H54Z', S.moss, 0, op(0.85))
        + T('M37 69.6l1 1.4M39.6 68.6l.4 1.6M57.6 82.4l.4 1.4M60.6 81.6l.4 1.4', sh(S.moss, 0.4), 0.8)
        + T('M39 62Q44 59 49 59', '#fff', 1, op(0.5)))
      + OUT(bodyD, 2.6)
      // 얼굴: 큰 눈 둘(가까운 눈 큼) · 볼 · 입
      + (Pz.eye === 'closed' ? T('M45 72Q48 74.4 51 72M54 71.6Q56.6 73.6 59 71.6', OLC, 1.7)
        : Pz.eye === 'focus' ? E(48, 72.6, 2.6, 2.2, S.eye, 0) + E(56.6, 72.2, 2.2, 1.9, S.eye, 0) + C(47.2, 71.8, 0.8, '#fff', 0) + C(55.9, 71.5, 0.7, '#fff', 0) + T('M45 69.4L51 70.6M54 70.4L59 69.2', OLC, 1.3)
          : E(48, 72, 2.8, 3.6, S.eye, 0) + E(56.6, 71.6, 2.4, 3.2, S.eye, 0) + C(47, 70.6, 1.1, '#fff', 0) + C(55.8, 70.3, 0.9, '#fff', 0) + C(49, 73.6, 0.5, '#fff', 0) + C(57.4, 73.2, 0.45, '#fff', 0))
      + E(44.6, 77, 2.4, 1.4, c.halo(S.blush, 0.6), 0) + E(60, 76.4, 1.9, 1.2, c.halo(S.blush, 0.6), 0)
      + mouth(Pz.mo, 52.6, 77.6)
      + mushCap(c, 50.6, 62 + (Pz.cap || 0) * 0.3, 36, 1, (Pz.tilt || 0) * -0.3)
      + footP(Pz.fn, S.bodyD)
      + armP(Pz.an, S.body);
    if (Pz.puff) {
      back += C(50, 46, 14, c.halo(S.spore, 0.7), 0);
      front += [[38, 40], [46, 34], [56, 36], [62, 42], [52, 30]].map(([x, y], i) => C(x, y, i % 2 ? 1.6 : 2.2, S.spore, 1.2)).join('');
    }
    if (Pz.shot) {
      front += C(84, 60, 6, c.halo(S.spore, 0.7), 0) + C(84, 60, 4, c.r(S.spore, 0.3), 1.6) + C(82.6, 58.6, 1.2, '#fff', 0)
        + [[76, 62], [74, 57], [90, 56], [92, 64]].map(([x, y]) => C(x, y, 1.2, S.spore, 1)).join('') + T('M66 64Q72 62 76 62', '#f0ffc0', 1.4, op(0.8));
    }
    if (Pz.glow) {
      back += C(50, 66, 30, c.halo('#c8f080', 0.7), 0);
      front += [[24, 70, 4], [78, 66, 3.6], [30, 46, 3], [72, 40, 3.2]].map(([x, y, r]) => G(P(`M${-r} 0L${-r * 0.4} ${-r}L${r * 0.7} ${-r * 0.8}L${r} ${r * 0.2}L${r * 0.2} ${r}L${-r * 0.8} ${r * 0.7}Z`, c.g(S.rock, 0.25), 1.8) + P(`M${-r * 0.6} ${-r * 0.4}L${r * 0.2} ${-r * 0.7}L${r * 0.4} ${-r * 0.1}Z`, S.moss, 0), `translate(${x} ${y})`)).join('')
        + T('M20 84l-4 -4M82 84l4 -4M50 32v-6', '#e8ffb0', 1.6, op(0.85));
    }
    return back + G(body, tr) + front;
  }

  /* ---------- 이끼 거인 (토리 변신) — 이끼 덮인 바위 몸 · 같은 버섯 갓 · 큰 어깨와 주먹 ---------- */
  const GIANT = {
    idle0: { b: [0, 0], fn: [42, 0], ff: [60, 0], an: [30, 74], af: [72, 72], eye: 'open' },
    idle1: { b: [0, 1], fn: [42, 0], ff: [60, 0], an: [30, 75], af: [72, 73], eye: 'open', br: 1 },
    walk0: { b: [0, -1], tilt: 3, fn: [48, 4], ff: [38, 0], an: [36, 72], af: [70, 76], eye: 'open' },
    walk1: { b: [0, 0.6], tilt: 0, fn: [44, 0], ff: [56, 0], an: [32, 74], af: [72, 74], eye: 'open' },
    walk2: { b: [0, -1], tilt: -3, fn: [38, 0], ff: [62, 4], an: [28, 76], af: [74, 72], eye: 'open' },
    walk3: { b: [0, 0.6], tilt: 0, fn: [44, 0], ff: [56, 0], an: [32, 74], af: [72, 74], eye: 'open' },
    // 조준: 주먹 하나를 높이 들어 올림
    aim: { b: [-1, 1], tilt: -6, fn: [40, 0], ff: [60, 0], an: [36, 30], af: [72, 70], eye: 'focus' },
    // 공격: 땅을 내려찍음 — 흙먼지와 금
    attack: { b: [2, 2], tilt: 10, fn: [40, 0], ff: [62, 0], an: [74, 84], af: [80, 80], eye: 'focus', slam: 1 },
    // 기술: 두 팔을 벌리고 포효 (이끼가 빛남)
    cast: { b: [0, -1], tilt: -4, fn: [40, 0], ff: [60, 0], an: [22, 40], af: [80, 38], eye: 'focus', roar: 1 },
  };
  function toriGiant(c, pose) {
    const S = TORI_C;
    const Pz = GIANT[pose] || GIANT.idle0;
    const [dx, dy] = Pz.b;
    const br = Pz.br || 0;
    const tr = `translate(${dx} ${dy}) rotate(${Pz.tilt || 0} 50 88)`;
    const rockP = (d, col = S.rock) => P(d, c.g(col, 0.25), 2.6);
    const legP = (f, col) => rockP(`M${f[0] - 7} ${74 - f[1]}L${f[0] + 7} ${74 - f[1]}L${f[0] + 8} ${89.4 - f[1]}L${f[0] - 8} ${89.4 - f[1]}Z`, col)
      + T(`M${f[0] - 6} ${84 - f[1]}H${f[0] + 6}`, IL(col, 0.4), 1);
    const fistP = (a, col, sx) => {
      const sh0 = V(sx, 56 - br);
      return limb([{ a: sh0, b: V(a[0], a[1]), ra: 7, rb: 5.6, col }], 2.4)
        + G(rockP('M-7 -6L5 -7.6L8.4 -2L7 6.4L-4 7.6L-8 2Z', col) + T('M-2 -6.6L-1 6.8M3.4 -7L4 6.2', IL(col, 0.4), 1) + P('M-6 -6L0 -7L-2 -3.6Z', S.moss, 0), `translate(${a[0]} ${a[1]})`);
    };
    const torsoD = `M30 ${58 - br}C28 ${46 - br} 38 ${38 - br} 50 ${38 - br}C63 ${38 - br} 72 ${46 - br} 70 ${58 - br}L66 78Q50 84 34 78Z`;
    const tid = c.clip(torsoD);
    let back = '';
    let front = '';
    const body = fistP(Pz.af, sh(S.rock, -0.18), 64)
      + legP(Pz.ff, sh(S.rock, -0.15)) + legP(Pz.fn, S.rock)
      + P(torsoD, c.g(S.rock, 0.25), 2.8)
      + CL(tid, SHD('M60 40C72 46 72 66 66 80H74V40Z', 0.22)
        + P(`M30 ${50 - br}C36 ${40 - br} 60 ${36 - br} 70 ${48 - br}L70 ${54 - br}Q50 ${46 - br} 30 ${58 - br}Z`, S.moss, 0)
        + FURI(`M31 ${56 - br}Q50 ${46 - br} 70 ${53 - br}`, S.moss, S.capD, 2.6, 3, 1.2)
        + T('M40 62L44 70L42 76M58 60L55 68', IL(S.rock, 0.4), 1.1)
        + C(50, 64, 4.6, c.r('#b8f070', 0.3), 1.8) + C(50, 64, 7, c.halo('#d8ff8a', 0.6), 0)
        + P('M34 74Q38 70 42 74L40 80H32Z', S.moss, 0, op(0.9)) + P('M58 76Q62 72 66 76V80H58Z', S.moss, 0, op(0.9)))
      + OUT(torsoD, 2.8)
      // 머리(작은 바위) + 같은 버섯 갓
      + rockP(`M41 ${40 - br}C40 ${30 - br} 60 ${30 - br} 60 ${40 - br}L58 ${46 - br}H42Z`, sh(S.rock, 0.06))
      + (Pz.eye === 'focus' ? T(`M45 ${40.6 - br}L49 ${42 - br}M52 ${42 - br}L56 ${40.6 - br}`, '#d8ff8a', 2.2) : E(47, 41.6 - br, 1.8, 2, '#d8ff8a', 0) + E(54, 41.6 - br, 1.6, 1.8, '#d8ff8a', 0))
      + (Pz.roar ? P(`M47 ${44.2 - br}H54L52.6 ${46.4 - br}H48.4Z`, '#2a2a1e', 1.2) : T(`M48 ${44.8 - br}H53`, OLC, 1.4))
      + mushCap(c, 50.6, 31.6 - br, 34, 1)
      + fistP(Pz.an, S.rock, 36);
    if (Pz.slam) {
      front += P('M60 90C58 84 63 81 66 84C67 79 73 78 75 82C78 78 84 80 84 85C88 85 90 88 90 90Z', c.g('#b8a07a', 0.3), 2.2, op(0.95))
        + T('M70 90l-4 -1.6M78 90l6 -2M74 89.6l1.6 -2.6', '#5a4a3a', 1.2) + C(62, 78, 1.6, S.rock, 1.2) + C(88, 76, 1.4, S.rock, 1.2);
    }
    if (Pz.roar) {
      back += C(50, 56, 40, c.halo('#c8f080', 0.6), 0);
      front += T('M14 30l-6 -4M86 30l6 -4M10 50H3M90 50h7M50 10V3M30 14l-3 -5M70 14l3 -5', '#e8ffb0', 1.8, op(0.85));
    }
    return back + G(body, tr) + front;
  }

  /* =========================================================
   * ✨ 별이 — 별무늬 남색 망토 · 커다란 동그란 안경 · 등에 접이식 망원경 · 별 지팡이
   * ========================================================= */
  const BYEORI_C = {
    skin: '#fde0c8', hair: '#e8c27a', hairD: '#c0924a', shirt: '#f8f0dc', sleeve: '#f8f0dc', cuff: '#4a5aa8', cape: '#2c3a78', capeIn: '#4a5aa8',
    star: '#ffe7a8', starD: '#e8b84a', skirt: '#3a4a8a', pant: '#f4ecdc', boot: '#6a4a8a', bootRim: '#e8c07a', glass: '#8a5a2a', iris: '#6a5ab8',
    brass: '#e0b060', brassD: '#a87a30', wood: '#7a5a8a', hand: '#fde0c8',
  };
  const star5 = (c, x, y, r, col, w = 1.6) => P(h().starPath(x, y, r, r * 0.45, 5, -90), c.r(col, 0.3), w);
  /** 별 지팡이: 손 p, 위쪽 방향 a. glow 0·1·2 */
  function starStaff(c, p, a, glow = 0) {
    const S = BYEORI_C;
    const top = pol(p, 21, a);
    const base = pol(p, -9, a);
    const tipP = pol(p, 25, a);
    return limb([{ a: base, b: top, ra: 1.3, rb: 1.5, col: S.wood }], 1.6)
      + G(P('M-2.2 -1.6H2.2V1.6H-2.2Z', c.gl(S.brass, a, 0.3), 1.4), at(pol(p, 19, a), a))
      + (glow ? C(tipP.x, tipP.y, glow > 1 ? 13 : 9, c.halo('#fff4c0', 0.9), 0) : '')
      + star5(c, tipP.x, tipP.y, 5.4, S.star, 2) + C(tipP.x - 1.2, tipP.y - 1.4, 0.9, '#fff', 0)
      + T(`M${num(tipP.x - 2.4)} ${num(tipP.y + 1.6)}l-1.6 2.4`, S.starD, 0.8);
  }
  const BYEORI = poses({
    idle0: { hn: [64, 65], st: [-80], hf: [55, 70], eye: 'open', mo: 'smile', bk: 'sad' },
    idle1: { hn: [64.2, 64.2], st: [-79], hf: [55.2, 69.2], eye: 'open', mo: 'smile', bk: 'sad' },
    walk0: { hn: [62, 65], st: [-74], hf: [62, 67], eye: 'open', mo: 'smile', hem: 2 },
    walk1: { hn: [63, 65.6], st: [-79], hf: [55, 69], eye: 'open', mo: 'smile', hem: 0 },
    walk2: { hn: [65, 64.4], st: [-84], hf: [46, 68], eye: 'open', mo: 'smile', hem: -2 },
    walk3: { hn: [63, 65.6], st: [-79], hf: [55, 69], eye: 'open', mo: 'smile', hem: 0 },
    // 조준: 지팡이를 앞 위로 들고 별이 모임 — 먼 손은 안경을 고쳐 씀
    aim: { b: [-0.6, 0.6], lean: -3, hd: -4, hn: [62, 54], st: [-58], glow: 1, hf: [61, 39], fE: [60, 50], openF: true, eye: 'focus', mo: 'line', bk: 'calm' },
    // 공격: 지팡이를 앞으로 내밂 — 별빛이 날아감
    attack: { b: [2, 0.8], lean: 8, hd: 3, fn: [42, null, 18], ff: [60, null, 0], hn: [70, 52], st: [-24], glow: 2, hf: [46, 66], eye: 'open', mo: 'open', bk: 'up', hem: -2 },
    // 기술 유성 낙하: 두 손으로 지팡이를 높이 — 하늘에 유성
    cast: { b: [0, -1], lean: -4, hd: -10, hn: [60, 33], nE: [57, 43], st: [-80], glow: 2, hf: [55, 37], fE: [60, 46], eye: 'closed', mo: 'open', bk: 'up' },
  });
  const BYEORI_CFG = {
    col: BYEORI_C, poses: BYEORI, iris: BYEORI_C.iris, brow: BYEORI_C.hairD, legO: { pant: BYEORI_C.pant },
    backHair(c) {
      const S = BYEORI_C;
      return P('M-9.6 -6C-14.4 0 -13.6 9 -9.4 13.6L-3.6 12.6L-5 -4Z', c.g(S.hair, 0.22), 2.4) + T('M-11 0Q-11.6 6 -9.4 11', IL(S.hair, 0.35), 0.9);
    },
    hair(c) {
      const S = BYEORI_C;
      return P('M-9.6 9.4C-13.4 3.4 -13 -5.6 -8.6 -10.2C-4.6 -14.4 3 -15 8 -12.4C12.2 -10.2 13.8 -6 13.2 -1.6C11 -4.2 8 -5.8 4.6 -6L3.4 -3.4L1.8 -6C-1.4 -5.6 -4.2 -4 -5.6 -1C-6.6 2.6 -6.4 6 -5.2 9.8Z', c.g(S.hair, 0.24), 2.4)
        + T('M-7.4 -10.4Q-1 -13.6 5.4 -12', sh(S.hair, 0.45), 1.3, op(0.85))
        + T('M10.4 -7.4Q5 -9.6 -1.6 -9M-9.6 3Q-10.4 -2 -7.4 -6.6', IL(S.hair, 0.38), 0.9)
        + star5(c, -4.6, -9.6, 3, S.star, 1.4);
    },
    face(c) {
      const S = BYEORI_C;
      // 큰 동그란 안경
      return C(1.8, 1.8, 4.2, '#ffffff', 0, op(0.18)) + C(9, 1.6, 3.4, '#ffffff', 0, op(0.18))
        + C(1.8, 1.8, 4.2, 'none', 0, ` stroke="${S.glass}" stroke-width="1.2"`) + C(9, 1.6, 3.4, 'none', 0, ` stroke="${S.glass}" stroke-width="1.1"`)
        + T('M6 1.4Q5.8 0.6 5.6 1.4', S.glass, 1) + T('M-2.4 1.4L-6 0.2', S.glass, 1)
        + T('M0 -0.6l1.4 -1', '#fff', 0.8, op(0.9));
    },
    torso(c) {
      const S = BYEORI_C;
      // 망원경 끈(어깨에서 허리로) + 블라우스 리본
      return LI('M44 46L58 63', '#7a5a3a', 1.6) + T('M44.4 46.4L57.6 62.6', '#a07a50', 0.5, op(0.8))
        + P('M50 46.6L47 49.6L50 49L53 50L52 47Z', c.g(S.capeIn, 0.25), 1.2);
    },
    torsoTop(c) {
      const S = BYEORI_C;
      return P('M42.4 46.4C46 43.6 55 43.2 58.6 46L57 48.6Q50 46.6 44 49Z', c.g(S.cape, 0.25), 2)
        + C(51.6, 47.6, 1.6, c.r(S.star, 0.3), 1.2);
    },
    cape(c, R, Pz) {
      const S = BYEORI_C;
      const sw = (Pz.hem || 0) + (Pz.lean || 0) * 0.25;
      const m1 = R.W(V(43, 46.4), R.br);
      const m2 = R.W(V(57, 46.2), R.br);
      const d = `M${pt(m2)}C${num(m2.x + 2)} ${num(m2.y + 14)} ${num(58 - sw * 0.5 + R.dx * 0.6)} ${num(74)} ${num(56 - sw + R.dx * 0.5)} 84Q${num(42 - sw * 1.2)} 87 ${num(27 - sw * 1.6 + R.dx * 0.4)} 82`
        + `C${num(30 - sw + R.dx * 0.5)} ${num(68)} ${num(m1.x - 6)} ${num(m1.y + 8)} ${pt(m1)}Z`;
      const id = c.clip(d);
      return P(d, c.g(S.cape, 0.22), 2.6)
        + CL(id, P(`M${num(27 - sw * 1.6 + R.dx * 0.4)} 82Q${num(42 - sw * 1.2)} 87 ${num(56 - sw + R.dx * 0.5)} 84L${num(56 - sw)} 90L20 90Z`, S.capeIn, 0)
          + [[34, 62], [42, 72], [32, 76], [46, 58], [50, 80], [38, 54]].map(([x, y], i) => star(x + R.dx * 0.6 - sw * 0.6, y, i % 2 ? 1.6 : 2.2, S.star)).join('')
          + T(`M${num(40 - sw * 0.8)} 52Q${num(36 - sw)} 68 ${num(36 - sw * 1.2)} 84`, IL(S.cape, 0.35), 0.9))
        // 등의 망원경
        + G(P('M-2.6 0H2.6V-20H-2.6Z', c.gl(S.brass, 0, 0.3), 2) + P('M-3.4 -20H3.4V-26H-3.4Z', c.gl(S.brass, 0, 0.3), 2)
          + P('M-2 0H2V5H-2Z', c.gl(S.brassD, 0, 0.3), 1.8) + T('M-2.6 -8H2.6M-2.6 -14H2.6', S.brassD, 1) + T('M-1.4 -24.6V-21.4', '#fff', 0.8, op(0.8)), `${R.tf} translate(41 62) rotate(-16)`);
    },
    skirt(c, R, fN, fF, Pz) { return robeSkirt(c, R, fN, fF, BYEORI_C.skirt, { hem: Pz.hem, lift: 15, flare: 4.6, trim: BYEORI_C.star }); },
    item(c, Pz) {
      const g = V(Pz.hn[0], Pz.hn[1]);
      return { s: starStaff(c, g, Pz.st[0], Pz.glow || 0), gn: g, ga: Pz.st[0], sideN: 1, overHead: true };
    },
    fx(c, Pz, pose) {
      let back = '';
      let front = '';
      if (pose === 'attack') front += star5(c, 90, 40, 4.6, '#fff4c0', 1.6) + T('M70 44Q78 40 86 40M72 48Q80 46 86 44', '#fff4c0', 1.6, op(0.85)) + C(90, 40, 8, c.halo('#fff4c0', 0.7), 0);
      if (pose === 'cast') {
        back += C(50, 40, 30, c.halo('#c8d0ff', 0.4), 0);
        front += C(86, 12, 7, c.halo('#ffd890', 0.9), 0) + P('M86 12L66 -4L70 2L60 -2Z', '#ffe7a8', 0, op(0.6)) + C(86, 12, 4, c.r('#ffb860', 0.3), 1.6)
          + star(22, 22, 2.4) + star(34, 10, 1.8) + star(76, 32, 2) + star(14, 40, 1.6);
      }
      return { back, front };
    },
  };
  function byeori(c, pose) { return humanHero(c, pose, BYEORI_CFG); }

  /* =========================================================
   * 🔔 무진 — 낡은 회보라 두루마기 · 흰 상투와 긴 흰 수염 · 손종 · 허리의 종메
   * ========================================================= */
  const MUJIN_C = {
    skin: '#e8c0a0', hair: '#f2f0f4', hairD: '#c4bfd2', shirt: '#7a6a8a', sleeve: '#7a6a8a', cuff: '#f0ecf4', robeD: '#5a4a6a', collar: '#f0ecf4',
    sash: '#3a2e48', goreum: '#a08ab8', pant: '#4a4058', boot: '#3a3040', bootRim: '#6a5a7a', iris: '#5a4a6a', bell: '#c8a050', bellD: '#8a6a30', wood: '#7a5a3a', hand: '#e8c0a0',
  };
  /** 손종: 손 p에서 자루를 쥠, a = 종이 매달린 방향(아래 90°) */
  function handBell(c, p, a = 90, ring = 0) {
    const S = MUJIN_C;
    const r = a - 90;
    return G(P('M-1.4 -4H1.4V3H-1.4Z', c.g(S.wood, 0.3), 1.6)
      + P('M-1.6 3H1.6L2.4 4.6H-2.4Z', c.g(S.bellD, 0.3), 1.4)
      + P('M-2.4 4.6C-4.4 5 -5 8 -5.2 11C-5.6 12.4 -6.6 13 -6.8 14.4H6.8C6.6 13 5.6 12.4 5.2 11C5 8 4.4 5 2.4 4.6Z', c.gl(S.bell, 0, 0.32), 2)
      + T('M-3.2 7Q-3.6 10 -4 12.4', sh(S.bell, 0.5), 0.9, op(0.85)) + T('M-5.6 12.6H5.6', IL(S.bell, 0.4), 0.8)
      + C(ring ? 2.2 : 0, 15.4, 1.4, c.g(S.bellD, 0.3), 1.2)
      + (ring ? T('M-9 10Q-10.6 13 -9 16M9 10Q10.6 13 9 16', '#d8c0ff', 1.2, op(0.9)) : ''), at(p, r));
  }
  const MUJIN = poses({
    idle0: { hn: [58, 64], bl: 90, hf: [45, 66], fE: [47, 57], eye: 'lidded', mo: 'line', bk: 'sad' },
    idle1: { hn: [58.2, 63.4], bl: 92, hf: [45.2, 65.4], fE: [47, 56.6], eye: 'lidded', mo: 'line', bk: 'sad' },
    walk0: { hn: [56, 65], bl: 80, hf: [45, 66], fE: [47, 57], eye: 'lidded', mo: 'line', hem: 1.4, fn: [55, null, -10], ff: [45, null, 16] },
    walk1: { hn: [57, 65.4], bl: 90, hf: [45, 66], fE: [47, 57], eye: 'lidded', mo: 'line', hem: 0, fn: [51, null, 0], ff: [47, 82, 12] },
    walk2: { hn: [59, 64.4], bl: 100, hf: [45, 66], fE: [47, 57], eye: 'lidded', mo: 'line', hem: -1.4, fn: [45, null, 16], ff: [55, null, -10] },
    walk3: { hn: [57, 65.4], bl: 90, hf: [45, 66], fE: [47, 57], eye: 'lidded', mo: 'line', hem: 0, fn: [47, 82, 12], ff: [51, null, 0] },
    // 조준: 손종을 가슴 높이로 들어 올림
    aim: { b: [-0.4, 0.4], lean: -2, hd: -3, hn: [63, 46], nE: [56, 56], bl: 70, hf: [45, 66], fE: [47, 57], eye: 'open', mo: 'line', bk: 'calm' },
    // 공격: 손종을 앞으로 흔듦 — 보랏빛 소리 고리
    attack: { b: [1.4, 0.6], lean: 6, hd: 2, hn: [70, 50], bl: 40, ring: 1, hf: [45, 66], fE: [47, 57], eye: 'closed', mo: 'o', bk: 'calm' },
    // 기술 되울림 종: 종을 머리 위로 높이 — 큰 고리 여럿
    cast: { b: [0, -0.6], lean: -3, hd: -8, hn: [74, 28], nE: [63, 41], bl: 96, ring: 1, hf: [58, 52], openF: true, eye: 'closed', mo: 'open', bk: 'up' },
  });
  const MUJIN_CFG = {
    col: MUJIN_C, poses: MUJIN, iris: MUJIN_C.iris, brow: MUJIN_C.hair, scale: 1.02,
    hair(c) {
      const S = MUJIN_C;
      // 머리 옆의 흰 머리 + 정수리 상투(끈) + 긴 흰 수염과 콧수염
      return P('M-10.4 6C-12.6 1 -12.4 -5 -9.4 -8.6C-8 -6 -7.4 -3.6 -7.6 -1C-8.6 1.4 -9.4 3.6 -10.4 6Z', c.g(S.hair, 0.2), 2)
        + T('M-11 -8.4Q-3 -13.4 6 -11.4Q11 -9.6 12.4 -4.6', IL(S.hair, 0.3), 1.6, op(0.9))
        + P('M-6.4 -11.6C-7.8 -16.4 -3.4 -19.6 0.6 -18C3.6 -16.6 3.6 -12.6 1 -11.2Z', c.g(S.hair, 0.22), 2)
        + P('M-6.4 -12.2L1.6 -11.2L1.4 -9.6L-6 -10.6Z', c.g(S.goreum, 0.25), 1.4)
        + P('M-3.6 6.2C-5 13 -2 21 4.6 25.6C6.4 20.6 10.8 14.4 11 6C8.4 8.6 5.4 9.6 2.6 9.2C0.6 9.6 -1.6 8.6 -3.6 6.2Z', c.g(S.hair, 0.2), 2.2)
        + T('M0.6 11Q1.6 17 4.4 22M5 11Q6.6 16 6.4 21', S.hairD, 0.9)
        + P('M1.4 6.4Q5.4 4.6 10.2 6.2Q8 8.4 5.6 7.6Q3.4 8.6 1.4 6.4Z', c.g(S.hair, 0.2), 1.4)
        + T('M-4 -3.4Q-1.4 -5 1.2 -4.2M5.6 -4.4Q8 -5.2 10.2 -4', S.hair, 1.8);
    },
    torso(c) {
      const S = MUJIN_C;
      // 흰 동정(깃) + 고름(리본)
      return P('M45 45.2L53.6 57.8L56.4 56.4L48.4 44.6Z', S.collar, 1.2)
        + T('M43 52Q44.6 57 43.6 62M57.6 50Q58.4 56 57.6 62', IL(S.shirt, 0.4), 0.9)
        + P('M52.6 56.6L49.6 66L51.8 66.4L54.2 57.4Z', c.g(S.goreum, 0.25), 1.2) + P('M53.4 56.8L56.6 64.6L58.4 63.8L54.8 56.4Z', c.g(S.goreum, 0.25), 1.2)
        + C(53.8, 56.8, 1.5, c.g(S.goreum, 0.25), 1.2);
    },
    belt(c) {
      const S = MUJIN_C;
      // 허리띠 + 뒤쪽에 매단 종메
      return PI('M41.2 60.4L59.8 60L60 62.8L41.4 63.2Z', c.g(S.sash, 0.25), S.sash, 1.1)
        + T('M42.6 62.4L40 70', S.wood, 1.6) + G(P('M-2.4 -1.6H2.4V1.6H-2.4Z', c.g(S.wood, 0.3), 1.4), 'translate(39.6 71) rotate(-70)');
    },
    skirt(c, R, fN, fF, Pz) { return robeSkirt(c, R, fN, fF, MUJIN_C.shirt, { hem: Pz.hem, lift: 6.6, flare: 6.6, trim: MUJIN_C.robeD }); },
    item(c, Pz) {
      const g = V(Pz.hn[0], Pz.hn[1]);
      return { s: '', front: handBell(c, add(g, 0, 0), Pz.bl, Pz.ring || 0), gn: g, ga: Pz.bl - 90, sideN: 1 };
    },
    fx(c, Pz, pose, k) {
      let back = '';
      let front = '';
      if (pose === 'attack') {
        const b = pol(k.near.H, 14, Pz.bl);
        front += [10, 17, 24].map((r, i) => P(arcBand(b.x, b.y, r, r - 2.2, -50, 50), i === 0 ? '#d8c0ff' : '#b08ad8', 0, op(0.85 - i * 0.2))).join('');
      }
      if (pose === 'cast') {
        const b = pol(k.near.H, 14, Pz.bl);
        back += C(b.x, b.y, 26, c.halo('#b08ad8', 0.55), 0) + [12, 20, 28].map((r, i) => C(b.x, b.y, r, 'none', 0, ` stroke="${i ? '#b08ad8' : '#e8d8ff'}" stroke-width="${2 - i * 0.4}" opacity="${0.9 - i * 0.22}"`)).join('');
      }
      return { back, front };
    },
  };
  function mujin(c, pose) { return humanHero(c, pose, MUJIN_CFG); }

  /* =========================================================
   * 초상화 (200×200) — heroes.js의 human() 조립기 사용. 표정: normal · happy · worried
   * ========================================================= */
  const { pEye, BROW, sweat } = X;
  const MO = X.MOUTH;
  const star4 = (x, y, r) => `<path d="${h().starPath(x, y, r, r * 0.32, 4, 0)}"/>`;

  // 하루: 기존 초상화에 귀마개를 더함 (설계: 귀마개 달린 털모자)
  const P_HARU0 = PORTRAITS.haru;
  const P_HARU2 = Object.assign({}, P_HARU0, {
    front(c, mood) {
      return P_HARU0.front(c, mood)
        + P('M58 72C50 76 48 96 54 110C58 118 70 118 72 108L70 76Z', c.g('#5fb8f0', 0.25), 4)
        + FURI('M56 110Q63 118 71 108', '#f4f8ff', '#c9d6ea', 4.6, 4.2, 2.4)
        + T('M58 82Q56 94 59 104', '#bfe6ff', 2.6, op(0.8));
    },
  });

  const P_DOHAN = {
    bg: '#e8743a', skin: '#d9a07a', iris: '#6a3a24', browC: '#5a4a44', lid: 0.32,
    motif: '<circle cx="32" cy="60" r="3"/><circle cx="44" cy="36" r="2"/><circle cx="168" cy="46" r="3"/><circle cx="176" cy="122" r="2.4"/>',
    brows: { normal: ['M72 76L97 73', 'M114 73L136 76'], happy: ['M72 73Q85 67 97 71', 'M114 71Q125 67 136 74'], worried: ['M73 77Q86 75 96 69', 'M115 69Q124 75 135 78'] },
    mouth: { normal: 'flat', happy: 'soft', worried: 'frown' },
    eyes: { happy: { closed: true }, worried: { small: true, ly: 2 } },
    sweatX: 152,
    back(c) {
      // 어깨에 걸친 단조 망치
      return L('M30 206L58 132', '#8a5a32', 8, 4) + G(P('M-14 -10h28v20h-28z', c.g('#6a6e80', 0.35), 4) + P('M-14 4h28v6h-28z', '#ffb43a', 0) + T('M-8 -6v12', '#a8aec4', 3), 'translate(60 126) rotate(-20)');
    },
    body(c) {
      return P('M18 206C20 170 46 154 84 150L120 150C158 154 184 170 186 206Z', c.g('#b8644a', 0.25), 4)
        + P('M64 170C80 164 124 164 140 170L146 206H58Z', c.g('#7a4a30', 0.25), 4)
        + L('M70 172L56 152', '#5a3424', 8, 4) + L('M134 172L148 152', '#5a3424', 8, 4)
        + C(70, 176, 3, '#e8c07a', 2) + C(134, 176, 3, '#e8c07a', 2)
        + STITCH('M68 180Q102 174 136 180', '#a87a50', 1.6, '3 3');
    },
    faceExtra: () => T('M80 62q8 -3 16 0', '#000', 1.4, op(0.12)),
    front(c, mood) {
      const S = DOHAN_C;
      return P('M64 82C58 54 74 30 104 30C132 30 150 48 148 78L140 62Q104 50 70 64Z', c.g(S.hair, 0.25), 4)
        + T('M80 40Q100 32 120 36M70 58Q72 48 78 42', S.hairG, 3, op(0.85))
        // 붉은 두건 + 매듭
        + P('M60 62C80 48 128 46 150 60L148 72C126 60 82 60 62 74Z', c.g(S.band, 0.25), 4) + T('M68 62Q104 50 144 62', sh(S.band, 0.4), 2.4, op(0.85))
        + P('M62 66L40 60L44 76Z', c.g(S.band, 0.25), 3.5) + P('M60 70L42 86L56 88Z', c.g(sh(S.band, -0.1), 0.25), 3.5) + C(60, 68, 6, c.g(S.band, 0.25), 3.5)
        // 짧은 수염 (입 주변을 비우고) + 콧수염
        + P('M64 98C64 126 82 148 104 150C128 148 146 126 146 98C142 112 136 122 128 126Q118 136 106 136Q94 136 84 126C76 122 68 112 64 98Z', c.g(S.hair, 0.22), 3.8)
        + T('M86 136l2 6M98 140v6M112 140v6M124 134l-2 6', S.hairG, 2.2)
        + P(mood === 'happy' ? 'M90 114Q106 108 122 114Q114 120 106 118Q98 120 90 114Z' : 'M90 116Q106 110 122 116Q114 121 106 119Q98 121 90 116Z', c.g(S.hair, 0.2), 3);
    },
    mouthY: 125,
  };

  const P_NARAE = {
    bg: '#7ad8ff', skin: '#f4caa4', iris: '#2a7a9a', browC: '#7a4a32', lash: true,
    motif: '<path d="M24 60q10-8 20 0M156 40q10-8 20 0M164 124q8-6 16 0" fill="none" stroke="#fff" stroke-width="3"/>',
    mouth: { normal: (x, y) => MO.grin(x, y, 0.85), happy: (x, y) => MO.grin(x, y, 1.2), worried: 'o' },
    eyes: { happy: { closed: true }, worried: { small: true, ly: 2.5, lx: -1 } },
    back(c) {
      const S = NARAE_C;
      // 오른쪽 어깨 뒤에서 고개를 내민 바람새 솔개
      return G(P('M0 0C-4 -22 14 -36 34 -32C50 -28 56 -12 50 2C44 14 22 18 4 12Z', c.g(S.bird, 0.24), 4)
        + P('M44 -20C58 -24 70 -18 72 -8C64 -10 58 -8 52 -4Z', c.g(S.beak, 0.3), 3.4)
        + C(36, -16, 5, '#22202e', 0) + C(34.4, -17.6, 1.8, '#fff', 0)
        + P('M2 -8L-14 -18L-2 -2Z', c.g(S.birdD, 0.25), 3) + P('M8 4C20 10 36 10 46 4C40 12 22 16 8 10Z', S.belly, 0), 'translate(126 132) scale(0.84)')
        // 뒤로 날리는 머리
        + P('M60 86C52 60 60 36 82 28L48 22L76 18L52 6L92 12C120 6 148 26 150 62Z', c.g(S.hair, 0.25), 4);
    },
    body(c) {
      const S = NARAE_C;
      const fth = (x, y, a, l, col) => G(P(`M0 0Q${l * 0.5} -9 ${l} 0Q${l * 0.5} 9 0 0Z`, c.g(col, 0.2), 3) + T(`M0 0L${l * 0.9} 0`, IL(col, 0.35), 1.6), `translate(${x} ${y}) rotate(${a})`);
      return P(TORSO, c.g(S.jacket, 0.25), 4)
        + P('M98 156L106 156L110 206H94Z', S.jacketL, 2.4)
        + fth(66, 160, 160, 40, S.scarfD) + fth(64, 166, 186, 44, S.scarf)
        + P('M62 156C60 142 144 142 142 156C144 170 124 176 102 176C80 176 60 170 62 156Z', c.g(S.scarf, 0.18), 4)
        + T('M74 156l6 8M90 152l4 10M106 152l2 10M122 154l-2 9M134 156l-4 8', S.scarfD, 2.4);
    },
    front(c) {
      const S = NARAE_C;
      return P('M62 86C56 56 74 30 104 30C132 30 152 50 148 80L138 64L134 74L124 58L118 70L108 56L100 68L92 56C84 64 72 70 66 78Z', c.g(S.hair, 0.25), 4)
        + T('M78 42Q96 32 118 36', sh(S.hair, 0.45), 3, op(0.8))
        // 이마 위 고글
        + P('M56 62C80 46 128 44 152 58L150 68C126 56 82 58 58 72Z', c.g(S.strap, 0.25), 3.4)
        + C(88, 52, 14, c.r(S.goggle, 0.35), 4) + C(122, 52, 12, c.r(S.goggle, 0.35), 4)
        + T('M80 46l6 -4M116 46l5 -4', '#fff', 3) + T('M101 52h8', S.strap, 4);
    },
  };

  const P_BYEORI = {
    bg: '#ffe7a8', skin: '#fde0c8', iris: '#6a5ab8', browC: '#c0924a', lash: true, eyeY: 96, mouthY: 124,
    motif: star4(30, 56, 7) + star4(170, 44, 6) + star4(176, 122, 4.5) + star4(24, 128, 4) + star4(48, 30, 3),
    mouth: { normal: 'soft', happy: (x, y) => MO.grin(x, y, 0.7), worried: 'wavy' },
    eyes: { happy: { closed: true }, worried: { small: true, ly: 2.5, tear: false } },
    brows: { normal: ['M74 75Q85 71 96 74', 'M115 74Q125 71 135 75'], happy: ['M74 72Q85 66 96 70', 'M115 70Q125 66 135 72'], worried: ['M74 76Q86 74 96 68', 'M115 68Q124 74 135 77'] },
    back(c) {
      const S = BYEORI_C;
      return G(P('M-9 0H9V-60H-9Z', c.gl(S.brass, 0, 0.3), 4) + P('M-12 -60H12V-80H-12Z', c.gl(S.brass, 0, 0.3), 4) + T('M-9 -20H9M-9 -40H9', S.brassD, 3) + T('M-6 -76V-64', '#fff', 2.6, op(0.8)), 'translate(160 176) rotate(18)')
        + P('M58 96C50 60 72 30 104 30C136 30 158 58 150 98C152 120 148 140 140 150L68 150C60 140 56 120 58 96Z', c.g(S.hair, 0.22), 4);
    },
    body(c) {
      const S = BYEORI_C;
      return P(TORSO, c.g(S.cape, 0.25), 4)
        + P('M84 154L102 172L120 154L118 206H86Z', c.g(S.shirt, 0.12), 3.4)
        + P('M102 160L94 168L102 166L110 170L106 160Z', c.g(S.capeIn, 0.25), 2.4)
        + G(star4(48, 180, 5) + star4(152, 176, 4.5) + star4(66, 196, 3.5) + star4(140, 198, 3.5), '', ` fill="${S.star}"`)
        + P(h().starPath(102, 158, 7, 3, 5, -90), c.r(S.star, 0.3), 2.4);
    },
    front(c) {
      const S = BYEORI_C;
      return P('M60 92C56 58 76 32 104 32C132 32 152 52 148 86C142 74 132 66 120 64L116 72L110 62C98 62 84 66 72 76C66 80 62 86 60 92Z', c.g(S.hair, 0.22), 4)
        + T('M78 44Q96 34 118 38', '#fff4d0', 3, op(0.85))
        + P(h().starPath(70, 58, 8, 3.4, 5, -90), c.r(S.star, 0.3), 2.6)
        // 커다란 동그란 안경
        + C(86, 97, 18, '#ffffff', 0, op(0.16)) + C(124, 97, 16, '#ffffff', 0, op(0.16))
        + C(86, 97, 18, 'none', 0, ` stroke="${S.glass}" stroke-width="3.6"`) + C(124, 97, 16, 'none', 0, ` stroke="${S.glass}" stroke-width="3.4"`)
        + T('M104 95Q106 91 108 95M68 94L60 90', S.glass, 3.2) + T('M76 86l5 -4M116 87l4 -3', '#fff', 2.6, op(0.9));
    },
  };

  const P_MUJIN = {
    bg: '#b08ad8', skin: '#e8c0a0', iris: '#5a4a6a', browC: '#f2f0f4', lid: 0.42,
    motif: '<circle cx="34" cy="60" r="10" fill="none" stroke="#fff" stroke-width="2.5"/><circle cx="34" cy="60" r="18" fill="none" stroke="#fff" stroke-width="1.6"/><circle cx="168" cy="48" r="3"/><circle cx="176" cy="126" r="2.4"/>',
    brows: { normal: ['M70 76Q84 68 98 74', 'M113 74Q126 68 138 77'], happy: ['M70 73Q84 64 98 70', 'M113 70Q126 64 138 74'], worried: ['M72 78Q86 76 97 67', 'M114 67Q124 76 137 80'] },
    mouth: { normal: 'flat', happy: 'soft', worried: 'frown' },
    eyes: { happy: { closed: true }, worried: { small: true, ly: 2, lid: 0.2 } },
    mouthY: 124,
    back(c) {
      const S = MUJIN_C;
      // 정수리 상투 + 옆머리
      return P('M88 34C84 14 100 4 114 10C124 16 124 30 116 36Z', c.g(S.hair, 0.2), 4)
        + P('M86 30L118 34L117 41L86 38Z', c.g(S.goreum, 0.25), 3);
    },
    body(c) {
      const S = MUJIN_C;
      return P(TORSO, c.g(S.shirt, 0.22), 4)
        + P('M80 152L118 196L128 190L94 150Z', S.collar, 3) + P('M124 152L100 186L92 180L112 150Z', c.g(sh(S.shirt, -0.08), 0.2), 3)
        + T('M50 176Q58 190 54 204M154 176Q146 190 150 204', IL(S.shirt, 0.4), 2.4)
        + G(handBell(c, V(0, 0), 90, 0), 'translate(40 168) scale(2.2)');
    },
    faceExtra: () => T('M84 56Q100 52 116 56M88 64Q100 61 112 64', '#5a3a2a', 1.6, op(0.3)) + T('M126 116q4 4 8 2', '#5a3a2a', 1.4, op(0.25)),
    front(c, mood) {
      const S = MUJIN_C;
      return P('M62 96C56 82 58 64 66 56C70 66 72 78 70 92Z', c.g(S.hair, 0.2), 3.6) + P('M146 92C150 80 150 64 142 56C140 66 138 78 140 90Z', c.g(S.hair, 0.2), 3.6)
        + T('M66 52Q104 30 142 52', IL(S.hair, 0.25), 3, op(0.7))
        // 긴 흰 수염 + 콧수염 (입은 비움)
        + P('M70 112C70 150 88 186 108 200C124 182 140 150 140 112C134 124 126 130 120 132Q106 138 92 132C84 130 76 124 70 112Z', c.g(S.hair, 0.2), 3.8)
        + T('M92 146Q96 168 104 188M114 146Q114 166 110 184M100 140Q102 160 106 176', S.hairD, 2)
        + P(mood === 'happy' ? 'M84 116Q106 104 128 116Q118 124 106 120Q94 124 84 116Z' : 'M84 118Q106 108 128 118Q118 124 106 121Q94 124 84 118Z', c.g(S.hair, 0.2), 3);
    },
  };

  /** 토리 초상화: 큰 버섯 갓 + 둥근 얼굴 + 큰 눈 */
  function toriPortrait(c, mood) {
    const S = TORI_C;
    const happy = mood === 'happy';
    const worried = mood === 'worried';
    const eye = (x, y, r, k) => {
      if (happy) return T(`M${x - r} ${y + 3}Q${x} ${y - r * 1.1} ${x + r} ${y + 3}`, OLC, 4);
      return E(x, y, r, r * 1.25, S.eye, 0) + C(x - r * 0.35, y - r * 0.45, r * 0.38, '#fff', 0) + C(x + r * 0.35, y + r * 0.45, r * 0.16, '#fff', 0)
        + (worried ? P(`M${x + r * 0.4} ${y + r * 1.2}q-4 7-1 10q4 1 4-4q0-3-3-6z`, '#bfeaff', 2) : '') + (k ? '' : '');
    };
    const bodyD = 'M100 66C142 66 160 100 160 140C160 180 136 204 100 204C64 204 40 180 40 140C40 100 58 66 100 66Z';
    const bid = c.clip(bodyD);
    return plate(c, '#9ad060', '<circle cx="30" cy="60" r="4"/><circle cx="172" cy="48" r="3"/><circle cx="178" cy="124" r="2.6"/><circle cx="22" cy="130" r="3"/>')
      // 등의 새싹
      + T('M58 96Q40 76 44 56', S.capD, 7) + T('M58 96Q40 76 44 56', S.sprout, 3.4)
      + P('M44 56C30 54 20 44 22 34C36 34 44 44 44 56Z', c.g(S.sprout, 0.25), 3.4) + P('M44 56C46 42 58 34 68 38C66 48 56 56 44 56Z', c.g(S.sprout, 0.25), 3.4)
      + P(bodyD, c.r(S.body, 0.25), 4)
      + CL(bid, SHD('M140 80C164 110 166 170 140 204H170V80Z', 0.18) + P('M40 150Q50 136 64 142Q60 158 44 164Z', S.moss, 0, op(0.85)) + P('M130 186Q144 178 160 186V204H124Z', S.moss, 0, op(0.85)))
      + OUT(bodyD, 4)
      + eye(84, 132, 11) + eye(126, 130, 9.6)
      + E(66, 152, 9, 5, '#ff9a7a', 0, op(happy ? 0.55 : 0.35)) + E(144, 150, 7, 4.4, '#ff9a7a', 0, op(happy ? 0.55 : 0.35))
      + (happy ? MO.grin(106, 158, 0.6) : worried ? MO.wavy(106, 160) : MO.soft(106, 158))
      + mushCap(c, 102, 92, 150, 1.6)
      + (worried ? sweat(c, 160, 104) : '');
  }

  /* 등록 (나머지 영웅은 아래에서 이어서) */
  Object.assign(HEROES, { haru, dohan, narae, tori, tori_giant: toriGiant, byeori, mujin });
  Object.assign(PORTRAITS, { haru: P_HARU2, dohan: P_DOHAN, narae: P_NARAE, byeori: P_BYEORI, mujin: P_MUJIN });
  Object.assign(PORTRAIT_FN, { tori: toriPortrait });
  Object.assign(UNITS, { snowman: snowmanUnit, tori_giant: (c, pose) => toriGiant(c, { idle: 'idle0', walk0: 'walk0', walk1: 'walk2' }[pose] || pose) });
  RG.art._hrx = { humanHero, poses, robeSkirt, star, snowball, smithHammer, WALK };
})();
