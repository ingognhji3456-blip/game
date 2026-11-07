'use strict';

/* =========================================================
 * 플레이어(카이온) — 이동, 콤보, 강공격, 회피(완벽 회피 → ZERO FRAME), 반격,
 * 스킬 3개, 궁극기, 연계 공격, 전술 명령
 * 입력(프레임마다): { mx, my, attack, heavy, dodge, skills:[b,b,b], ult, chain, cmds:[b,b,b], aim }
 *   (attack 등은 "이번 프레임에 눌렀는가")
 * ========================================================= */
window.AZ = window.AZ || {};

AZ.player = (() => {
  const U = AZ.util;
  const B = () => AZ.battle;

  const MOVE_SPEED = 270;
  const DODGE_TIME = 0.34;
  const DODGE_SPEED = 760;
  const MAX_DODGE = 3;
  const DODGE_REGEN = 0.85;
  const BUFFER = 0.28;

  function create(W, stats) {
    return {
      id: U.nextId(), kind: 'player', team: 'player',
      x: 0, y: 0, z: 0, r: 18, vx: 0, vy: 0,
      stats, maxHp: stats.maxHp, hp: stats.maxHp, facing: -Math.PI / 2,
      state: 'idle', st: null, comboIdx: 0, comboWin: 0,
      iframe: 0, dodgeT: 0, dodgeCharges: MAX_DODGE, dodgeRegen: 0, perfectUsed: false, dodgeOrigin: null, dodgeDir: 0,
      cds: [0, 0, 0], cdMax: [1, 1, 1], locks: [0, 0, 0],
      focus: Math.min(100, stats.startFocus || 0), chain: 0, combo: 0, comboT: 0,
      shield: 0, shieldT: 0, regen: null, haste: 0, blinkCrit: 0, counterReady: 0,
      kbx: 0, kby: 0, hurtT: 0, flash: 0, target: null,
      buf: { attack: 0, heavy: 0, dodge: 0 },
      anim: 'idle', animT: 0, runT: 0, sched: [], dead: false, deadT: 0,
      lowHpBarked: false, msgT: 0,
    };
  }

  /* ── 도우미 ── */
  function later(p, delay, fn) { p.sched.push({ t: delay, fn }); }

  function gainFocus(W, amt) {
    const p = W.player;
    const before = p.focus;
    p.focus = Math.min(100, p.focus + amt * p.stats.focusMul);
    if (before < 100 && p.focus >= 100) {
      B().text(W, p.x, p.y - 80, '궁극기 준비 완료', '#ffe066', 18);
      B().sfx(W, 'charge', { vol: 0.5, pitch: 1.4 });
    }
  }

  function msg(W, str, color) {
    const p = W.player;
    if (W.t - p.msgT < 0.7) return;
    p.msgT = W.t;
    B().text(W, p.x, p.y - 74, str, color || '#9ab0c8', 15);
  }

  function inputAngle(inp) {
    if (!inp) return null;
    const m = Math.hypot(inp.mx, inp.my);
    return m > 0.2 ? Math.atan2(inp.my, inp.mx) : null;
  }

  /** 공격 방향 대상 고르기 */
  function pickTarget(W, p, dir, maxD) {
    let best = null;
    let bestScore = Infinity;
    for (const e of W.enemies) {
      if (e.dead || e.untargetable) continue;
      const d = U.dist(p.x, p.y, e.x, e.y) - e.r;
      if (d > maxD) continue;
      let score = d;
      if (dir != null) score += Math.abs(U.angleDiff(dir, U.angleTo(p.x, p.y, e.x, e.y))) * 240;
      if (e.clone && W.scan > 0) score += 400;
      if (score < bestScore) { bestScore = score; best = e; }
    }
    return best;
  }

  function aimAt(W, p, inp, maxD) {
    const dir = inp && inp.aim != null ? inp.aim : inputAngle(inp);
    const auto = W.autoAim !== false || dir == null;
    const t = auto ? pickTarget(W, p, dir, maxD || 480) : null;
    if (t) {
      p.target = t;
      p.facing = U.angleTo(p.x, p.y, t.x, t.y);
    } else if (dir != null) {
      p.facing = dir;
    }
  }

  function atkSpeed(p) { return p.haste > 0 ? 1.4 : 1; }

  /* ── 공격 ── */
  function startAttack(W, p, inp, heavy, chained) {
    const wpn = p.stats.weapon;
    let step;
    let idx = 0;
    if (heavy) {
      step = wpn.heavy;
      p.comboIdx = 0;
    } else {
      idx = p.comboWin > 0 || chained ? p.comboIdx : 0;
      if (idx >= wpn.combo.length) idx = 0;
      step = wpn.combo[idx];
      p.comboIdx = idx + 1;
    }
    const ranged = !!(step.proj || step.beam);
    aimAt(W, p, inp, ranged ? 950 : 420);
    p.state = 'attack';
    p.st = { step, t: 0, hitIdx: 0, heavy, idx, lungeLeft: step.lunge || 0, hits: step.hits || [step.hit] };
    p.anim = heavy ? 'heavy' : 'attack';
    p.animT = 0;
    p.buf.attack = 0;
    p.buf.heavy = 0;
    if (heavy) B().sfx(W, 'charge', { vol: 0.35, pitch: 1.6 });
  }

  function updateAttack(W, p, dt, inp) {
    const st = p.st;
    const step = st.step;
    const sp = atkSpeed(p);
    st.t += dt * sp;
    const firstHit = st.hits[0];
    // 내딛기
    if (st.t <= firstHit + 0.02 && st.lungeLeft !== 0) {
      const portion = Math.min(1, (dt * sp) / Math.max(0.05, firstHit));
      let mv = (step.lunge || 0) * portion;
      if (mv > 0 && p.target && !p.target.dead) {
        const gap = U.dist(p.x, p.y, p.target.x, p.target.y) - p.target.r - p.r - 14;
        mv = Math.max(0, Math.min(mv, gap));
        p.facing = U.angleTo(p.x, p.y, p.target.x, p.target.y);
      }
      p.x += Math.cos(p.facing) * mv;
      p.y += Math.sin(p.facing) * mv;
      st.lungeLeft -= mv;
    }
    // 판정
    while (st.hitIdx < st.hits.length && st.t >= st.hits[st.hitIdx]) {
      performHit(W, p, step, st);
      st.hitIdx += 1;
    }
    const lastHit = st.hits[st.hits.length - 1];
    const cancelOK = st.t >= lastHit + 0.05;
    const chainOK = st.t >= Math.max(lastHit + 0.05, step.dur * 0.78);
    if (cancelOK) {
      const wpn = p.stats.weapon;
      if (p.counterReady > 0 && (p.buf.attack > 0 || p.buf.heavy > 0)) return doCounter(W, p);
      if (tryActions(W, p, inp, true)) return;
      if (chainOK) {
        if (p.buf.heavy > 0 && !st.heavy) return startAttack(W, p, inp, true);
        if (p.buf.attack > 0 && !st.heavy && p.comboIdx < wpn.combo.length) return startAttack(W, p, inp, false, true);
      }
    }
    if (st.t >= step.dur) {
      p.state = 'idle';
      p.st = null;
      p.comboWin = st.heavy ? 0 : p.stats.weapon.comboWindow;
      if (p.comboIdx >= p.stats.weapon.combo.length) p.comboWin = 0;
    }
  }

  function performHit(W, p, step, st) {
    const b = B();
    const color = p.stats.weapon.color;
    if (step.proj) {
      const pr = step.proj;
      const n = pr.count || 1;
      for (let i = 0; i < n; i++) {
        const a = p.facing + (n > 1 ? (i - (n - 1) / 2) * pr.spread : 0);
        b.addBullet(W, { x: p.x + Math.cos(a) * 26, y: p.y + Math.sin(a) * 26, ang: a, speed: pr.speed, r: pr.r, life: pr.life,
          team: 'player', mv: step.mv, brk: step.brk, color, kind: 'shot', air: true, pierce: !!pr.pierce });
      }
      b.ev(W, { type: 'muzzle', x: p.x + Math.cos(p.facing) * 30, y: p.y + Math.sin(p.facing) * 30, ang: p.facing, color });
      b.sfx(W, 'shot', { vol: 0.5 });
      if (step.lunge) { p.x += Math.cos(p.facing) * step.lunge; p.y += Math.sin(p.facing) * step.lunge; }
      return;
    }
    if (step.beam) {
      const bm = step.beam;
      const h = { shape: 'line', x: p.x, y: p.y, ang: p.facing, len: bm.len, w: bm.w };
      for (const e of W.enemies) {
        if (e.dead || e.untargetable) continue;
        if (b.inShape(h, e.x, e.y, e.r)) b.hitEnemy(W, e, { mv: step.mv, brk: step.brk, x: p.x, y: p.y, air: true, kind: 'melee', color });
      }
      b.ev(W, { type: 'beam', x: p.x, y: p.y, ang: p.facing, len: bm.len, w: bm.w, color, t: 0.35 });
      b.sfx(W, 'railgun');
      b.shake(W, 7);
      p.x -= Math.cos(p.facing) * 30;
      p.y -= Math.sin(p.facing) * 30;
      return;
    }
    let hitAny = false;
    const full = step.arc >= 6.2;
    for (const e of W.enemies) {
      if (e.dead || e.untargetable) continue;
      const d = U.dist(p.x, p.y, e.x, e.y);
      if (d - e.r > step.range) continue;
      if (!full && d > e.r) {
        const tol = Math.atan2(e.r, d);
        if (Math.abs(U.angleDiff(p.facing, U.angleTo(p.x, p.y, e.x, e.y))) > step.arc / 2 + tol) continue;
      }
      const res = b.hitEnemy(W, e, { mv: step.mv, brk: step.brk, x: p.x, y: p.y, air: !!step.air, kind: 'melee', color });
      if (res) hitAny = true;
    }
    b.ev(W, { type: 'slash', x: p.x, y: p.y, ang: p.facing, range: step.range, arc: step.arc, fx: step.fx, color, heavy: st.heavy || step.mv >= 2 });
    if (!hitAny) b.sfx(W, step.mv >= 2 ? 'slashHeavy' : 'swing', { vol: 0.5, pitch: 0.9 + Math.random() * 0.25 });
    else b.sfx(W, step.mv >= 2 ? 'slashHeavy' : 'slash', { vol: 0.55 });
    if (step.shock) {
      const sx = p.x + Math.cos(p.facing) * 60;
      const sy = p.y + Math.sin(p.facing) * 60;
      for (const e of W.enemies) {
        if (e.dead || e.untargetable) continue;
        if (U.dist(sx, sy, e.x, e.y) < step.shock + e.r) b.hitEnemy(W, e, { mv: step.mv * 0.4, brk: step.brk * 0.4, x: sx, y: sy, kind: 'skill', noCombo: true });
      }
      b.ev(W, { type: 'ring', x: sx, y: sy, r0: 20, r1: step.shock, color, t: 0.4 });
      b.shake(W, 8);
      b.sfx(W, 'stomp', { vol: 0.5 });
    }
  }

  /* ── 반격 (ZERO FRAME 직후 공격) ── */
  function doCounter(W, p) {
    const b = B();
    p.counterReady = 0;
    p.buf.attack = 0;
    p.buf.heavy = 0;
    const t = p.target && !p.target.dead && !p.target.untargetable ? p.target : b.nearestEnemy(W, p.x, p.y, 700);
    if (t) {
      const back = t.facing + Math.PI;
      const ox = p.x;
      const oy = p.y;
      p.x = t.x + Math.cos(back) * (t.r + p.r + 26);
      p.y = t.y + Math.sin(back) * (t.r + p.r + 26);
      b.clampToArena(W, p);
      p.facing = U.angleTo(p.x, p.y, t.x, t.y);
      p.target = t;
      b.ev(W, { type: 'trail', x0: ox, y0: oy, x1: p.x, y1: p.y, color: '#9ae6ff' });
    }
    p.state = 'skill';
    p.st = { t: 0, dur: 0.42, kind: 'counter' };
    p.anim = 'heavy';
    p.animT = 0;
    p.iframe = Math.max(p.iframe, 0.4);
    b.sfx(W, 'counter');
    b.text(W, p.x, p.y - 90, '반격!', '#9ae6ff', 22, { tag: true });
    later(p, 0.1, () => {
      const full = { range: 150, arc: 2.6 };
      for (const e of W.enemies) {
        if (e.dead || e.untargetable) continue;
        const d = U.dist(p.x, p.y, e.x, e.y);
        if (d - e.r > full.range) continue;
        if (d > e.r && Math.abs(U.angleDiff(p.facing, U.angleTo(p.x, p.y, e.x, e.y))) > full.arc / 2 + Math.atan2(e.r, d)) continue;
        b.hitEnemy(W, e, { mv: 3.0, brk: 20, x: p.x, y: p.y, air: true, kind: 'melee', crit: true, color: '#9ae6ff' });
      }
      b.ev(W, { type: 'slash', x: p.x, y: p.y, ang: p.facing, range: 150, arc: 2.6, fx: 'smash', color: '#9ae6ff', heavy: true });
    });
  }

  /* ── 회피 ── */
  function startDodge(W, p, inp) {
    if (p.dodgeCharges < 1) {
      msg(W, '회피 회복 중');
      return false;
    }
    p.dodgeCharges -= 1;
    const dir = inputAngle(inp);
    p.dodgeDir = dir != null ? dir : p.facing + Math.PI;
    if (dir != null) p.facing = dir;
    p.state = 'dodge';
    p.st = null;
    p.dodgeT = 0;
    p.iframe = p.stats.iframe;
    p.perfectUsed = false;
    p.dodgeOrigin = { x: p.x, y: p.y };
    p.anim = 'dodge';
    p.animT = 0;
    p.buf.dodge = 0;
    p.comboWin = 0;
    B().sfx(W, 'dodge', { vol: 0.6 });
    return true;
  }

  function updateDodge(W, p, dt, inp) {
    const speedMul = p.haste > 0 ? 1.15 : 1;
    p.dodgeT += dt;
    const k = p.dodgeT / DODGE_TIME;
    const sp = DODGE_SPEED * speedMul * (k < 0.55 ? 1 : Math.max(0, 1 - (k - 0.55) / 0.45));
    p.x += Math.cos(p.dodgeDir) * sp * dt;
    p.y += Math.sin(p.dodgeDir) * sp * dt;
    if (p.dodgeT > 0.14) {
      if (p.counterReady > 0 && (p.buf.attack > 0 || p.buf.heavy > 0)) return doCounter(W, p);
    }
    if (p.dodgeT >= DODGE_TIME) {
      p.state = 'idle';
      if (p.counterReady > 0 && (p.buf.attack > 0 || p.buf.heavy > 0)) return doCounter(W, p);
    }
  }

  /* ── 스킬 ── */
  function useSkill(W, p, slot, inp) {
    const id = p.stats.skills[slot];
    if (!id) { msg(W, '빈 스킬 슬롯'); return false; }
    if (p.locks[slot] > 0) { msg(W, '권한 회수됨 — 사용 불가', '#ff5470'); return false; }
    if (p.cds[slot] > 0) { msg(W, '재사용 대기 중'); return false; }
    const node = AZ.data.skills.nodes[id];
    const cd = node.cd * p.stats.cdMul;
    const fn = SKILLS[id];
    if (!fn) return false;
    const ok = fn(W, p, inp);
    if (ok === false) return false;
    p.cds[slot] = cd;
    p.cdMax[slot] = cd;
    p.comboWin = 0;
    B().ev(W, { type: 'skillName', name: node.name });
    return true;
  }

  function enterSkillState(p, dur, kind, extra) {
    p.state = 'skill';
    p.st = Object.assign({ t: 0, dur, kind }, extra || {});
    p.anim = kind === 'ray' ? 'dodge' : 'cast';
    p.animT = 0;
  }

  const SKILLS = {
    waveSlash(W, p) {
      const b = B();
      enterSkillState(p, 0.36, 'wave');
      p.iframe = Math.max(p.iframe, 0.2);
      later(p, 0.1, () => {
        for (const e of W.enemies) {
          if (e.dead || e.untargetable) continue;
          if (U.dist(p.x, p.y, e.x, e.y) < 178 + e.r) b.hitEnemy(W, e, { mv: 2.2, brk: 14, x: p.x, y: p.y, kind: 'skill', color: '#ff9ab8' });
        }
        b.ev(W, { type: 'ring', x: p.x, y: p.y, r0: 20, r1: 180, color: '#ff8ab0', t: 0.45, thick: true });
        b.sfx(W, 'wave');
        b.shake(W, 7);
      });
    },
    rayStrike(W, p, inp) {
      const b = B();
      aimAt(W, p, inp, 520);
      let len = 330;
      if (p.target && !p.target.dead) len = Math.min(380, U.dist(p.x, p.y, p.target.x, p.target.y) + p.target.r + 40);
      const sx = p.x;
      const sy = p.y;
      const ang = p.facing;
      enterSkillState(p, 0.3, 'ray', { sx, sy, ang, len });
      p.iframe = Math.max(p.iframe, 0.4);
      b.sfx(W, 'blink');
      later(p, 0.2, () => {
        const h = { shape: 'line', x: sx, y: sy, ang, len, w: 70 };
        for (const e of W.enemies) {
          if (e.dead || e.untargetable) continue;
          if (b.inShape(h, e.x, e.y, e.r)) b.hitEnemy(W, e, { mv: 2.8, brk: 16, x: sx, y: sy, air: true, kind: 'skill', color: '#ffd0e0' });
        }
        b.ev(W, { type: 'beam', x: sx, y: sy, ang, len, w: 26, color: '#ff8ab0', t: 0.3 });
        b.sfx(W, 'slashHeavy');
      });
    },
    astralBlades(W, p, inp) {
      const b = B();
      aimAt(W, p, inp, 800);
      const t = p.target;
      enterSkillState(p, 0.3, 'cast');
      for (let i = 0; i < 6; i++) {
        later(p, i * 0.08, () => {
          const a = p.facing + (i - 2.5) * 0.45 + Math.PI;
          b.addBullet(W, { x: p.x + Math.cos(a) * 40, y: p.y + Math.sin(a) * 40, ang: a, speed: 520, accel: 900, r: 12, life: 2,
            team: 'player', mv: 0.8, brk: 3, color: '#ffd166', kind: 'blade', homing: 9, target: t, air: true, delay: 0.12 });
        });
      }
      b.sfx(W, 'skill');
    },
    barrier(W, p) {
      p.shield = Math.max(p.shield, p.maxHp * 0.3);
      p.shieldT = 8;
      enterSkillState(p, 0.2, 'cast');
      B().sfx(W, 'shield');
      B().ev(W, { type: 'ring', x: p.x, y: p.y, r0: 60, r1: 30, color: '#7ce8ff', t: 0.4 });
    },
    counterStance(W, p) {
      p.state = 'stance';
      p.st = { t: 0, dur: 0.9 };
      p.anim = 'stance';
      p.animT = 0;
      B().sfx(W, 'charge', { vol: 0.5 });
    },
    repair(W, p) {
      p.regen = { perSec: (p.maxHp * 0.25) / 3, t: 3 };
      enterSkillState(p, 0.25, 'cast');
      B().sfx(W, 'heal');
    },
    blink(W, p, inp) {
      const b = B();
      aimAt(W, p, inp, 600);
      const t = p.target && !p.target.dead && !p.target.untargetable ? p.target : null;
      const ox = p.x;
      const oy = p.y;
      if (t) {
        const back = t.facing + Math.PI;
        p.x = t.x + Math.cos(back) * (t.r + p.r + 28);
        p.y = t.y + Math.sin(back) * (t.r + p.r + 28);
        b.clampToArena(W, p);
        p.facing = U.angleTo(p.x, p.y, t.x, t.y);
      } else {
        p.x += Math.cos(p.facing) * 220;
        p.y += Math.sin(p.facing) * 220;
        b.clampToArena(W, p);
      }
      p.blinkCrit = 2;
      p.iframe = Math.max(p.iframe, 0.25);
      enterSkillState(p, 0.12, 'blink');
      b.ev(W, { type: 'trail', x0: ox, y0: oy, x1: p.x, y1: p.y, color: '#c9a4ff' });
      b.sfx(W, 'teleport');
    },
    accel(W, p) {
      p.haste = 7;
      enterSkillState(p, 0.2, 'cast');
      B().sfx(W, 'timeStop', { pitch: 1.6, vol: 0.5 });
      B().ev(W, { type: 'banner', kind: 'skill', text: '시간 가속', sub: '' });
    },
    timeStop(W, p) {
      W.timeStop = W.boss ? 1.8 : 2.5;
      enterSkillState(p, 0.3, 'cast');
      B().sfx(W, 'timeStop');
      B().ev(W, { type: 'flash', color: 'rgba(200,180,255,0.4)', t: 0.3 });
      B().ev(W, { type: 'banner', kind: 'skill', text: '시간 정지', sub: '' });
    },
  };

  function updateSkillState(W, p, dt) {
    const st = p.st;
    st.t += dt;
    if (st.kind === 'ray') {
      const k = Math.min(1, st.t / 0.2);
      const e = U.ease.outCubic(k);
      p.x = st.sx + Math.cos(st.ang) * st.len * e;
      p.y = st.sy + Math.sin(st.ang) * st.len * e;
    }
    if (st.t >= st.dur) {
      p.state = 'idle';
      p.st = null;
    }
  }

  /* ── 반격 자세가 공격을 받았을 때 ── */
  function onCounterStance(W, source) {
    const p = W.player;
    const b = B();
    b.triggerZeroFrame(W, 'stance');
    p.counterReady = 0;
    const t = source && source.kind && !source.dead ? source : (p.target && !p.target.dead ? p.target : b.nearestEnemy(W, p.x, p.y, 600));
    if (t && t.x != null && (t.kind === 'boss' || t.kind === 'enemy')) p.target = t;
    p.state = 'idle';
    p.iframe = Math.max(p.iframe, 0.5);
    p.counterReady = 0.01;
    p.buf.attack = 0.2;
    doCounter(W, p);
    // 반격 자세의 반격은 더 강하다
    later(p, 0.12, () => {
      const tt = p.target;
      if (tt && !tt.dead) b.hitEnemy(W, tt, { mv: 0.5, brk: 5, x: p.x, y: p.y, air: true, kind: 'skill', noCombo: true });
    });
  }

  /* ── 궁극기 ── */
  function startUlt(W, p, inp) {
    const b = B();
    if (p.focus < 100) { msg(W, '집중 게이지 부족'); return false; }
    aimAt(W, p, inp, 900);
    p.focus = 0;
    p.state = 'ult';
    p.st = { t: 0, n: 0, done: false, target: p.target && !p.target.dead ? p.target : b.nearestEnemy(W, p.x, p.y, 900) };
    p.anim = 'cast';
    p.animT = 0;
    p.iframe = 3;
    W.timeStop = Math.max(W.timeStop, 2.6);
    W.stats.ultUsed = (W.stats.ultUsed || 0) + 1;
    b.sfx(W, 'ult');
    b.ev(W, { type: 'cutin', who: 'kai', title: '크로노 디바이드', sub: 'CHRONO DIVIDE' });
    return true;
  }

  function updateUlt(W, p, dt) {
    const b = B();
    const st = p.st;
    st.t += dt;
    const tgt = st.target && !st.target.dead ? st.target : null;
    const cx = tgt ? tgt.x : p.x;
    const cy = tgt ? tgt.y : p.y;
    while (st.n < 7 && st.t >= 0.4 + st.n * 0.15) {
      const a = st.n * 2.3 + 0.5;
      const rr = (tgt ? tgt.r : 30) + 46;
      const ox = p.x;
      const oy = p.y;
      p.x = cx + Math.cos(a) * rr;
      p.y = cy + Math.sin(a) * rr;
      b.clampToArena(W, p);
      p.facing = U.angleTo(p.x, p.y, cx, cy);
      b.ev(W, { type: 'trail', x0: ox, y0: oy, x1: p.x, y1: p.y, color: '#ffe9a0' });
      if (tgt) b.hitEnemy(W, tgt, { mv: 1.6, brk: 3, x: p.x, y: p.y, air: true, kind: 'ult', color: '#ffe066' });
      b.ev(W, { type: 'slash', x: p.x, y: p.y, ang: p.facing, range: 130, arc: 2.4, fx: st.n % 2 ? 'slashL' : 'slashR', color: '#ffe066', heavy: true });
      b.sfx(W, 'slash', { pitch: 1 + st.n * 0.06 });
      st.n += 1;
    }
    if (!st.done && st.t >= 1.65) {
      st.done = true;
      for (const e of W.enemies) {
        if (e.dead || e.untargetable) continue;
        if (U.dist(cx, cy, e.x, e.y) < 300 + e.r) b.hitEnemy(W, e, { mv: 5.0, brk: 40, x: cx, y: cy, air: true, kind: 'ult', color: '#fff3c0' });
      }
      b.ev(W, { type: 'burst', x: cx, y: cy, z: 30, r: 320, color: '#ffe9a0', big: true });
      b.ev(W, { type: 'flash', color: 'rgba(255,245,200,0.7)', t: 0.35 });
      b.sfx(W, 'bigExplosion');
      b.shake(W, 18);
    }
    if (st.t >= 2.1) {
      p.state = 'idle';
      p.st = null;
      p.iframe = 0.4;
      W.timeStop = Math.min(W.timeStop, 0.15);
    }
  }

  /* ── 연계 공격 ── */
  function doChain(W, p) {
    const b = B();
    const allies = W.allies.filter((a) => a.down <= 0);
    if (!allies.length) { msg(W, W.allies.length ? '동료가 다운됨' : '연계할 동료가 없음', '#ffb35c'); return false; }
    const breakChain = W.boss && W.boss.broken && !W.chainUsedThisBreak;
    if (!breakChain && p.chain < 100) { msg(W, '연계 게이지 부족'); return false; }
    if (breakChain) W.chainUsedThisBreak = true;
    else p.chain = 0;
    const t = p.target && !p.target.dead && !p.target.untargetable ? p.target : b.nearestEnemy(W, p.x, p.y, 1200);
    if (!t) return false;
    W.stats.chains = (W.stats.chains || 0) + 1;
    const names = allies.map((a) => (a.ally === 'lia' ? '리아' : '제로'));
    b.ev(W, { type: 'cutin', who: allies[0].ally, who2: allies[1] ? allies[1].ally : null,
      title: allies.length > 1 ? '트리니티 링크' : allies[0].ally === 'lia' ? '오버클럭 캐논' : '적월참', sub: `${names.join(' · ')} 연계 공격` });
    b.sfx(W, 'chain');
    const mult = breakChain ? 1.3 : 1;
    for (const a of allies) {
      if (a.ally === 'lia') {
        b.bark(W, 'lia', 'chain');
        later(p, 0.5, () => {
          if (t.dead) return;
          b.ev(W, { type: 'beam', x: a.x, y: a.y - a.z, ang: U.angleTo(a.x, a.y, t.x, t.y), len: U.dist(a.x, a.y, t.x, t.y) + 40, w: 46, color: '#9ae6ff', t: 0.6 });
          b.hitEnemy(W, t, { mv: 3.2 * mult, brk: 30, x: a.x, y: a.y, air: true, kind: 'ally', color: '#9ae6ff' });
          b.sfx(W, 'beam');
          b.shake(W, 10);
        });
      } else {
        b.bark(W, 'zeroAlly', 'chain');
        for (let i = 0; i < 5; i++) {
          later(p, 0.45 + i * 0.12, () => {
            if (t.dead) return;
            const ang = i * 1.9;
            const ox = a.x;
            const oy = a.y;
            a.x = t.x + Math.cos(ang) * (t.r + 34);
            a.y = t.y + Math.sin(ang) * (t.r + 34);
            a.facing = U.angleTo(a.x, a.y, t.x, t.y);
            b.ev(W, { type: 'trail', x0: ox, y0: oy, x1: a.x, y1: a.y, color: '#ff3355' });
            b.ev(W, { type: 'slash', x: a.x, y: a.y, ang: a.facing, range: 110, arc: 2.4, fx: 'smash', color: '#ff3355', heavy: true });
            b.hitEnemy(W, t, { mv: 1.0 * mult, brk: 7, x: a.x, y: a.y, air: true, kind: 'ally', color: '#ff6b8a' });
          });
        }
      }
    }
    return true;
  }

  /* ── 전술 명령 ── */
  function doCommand(W, p, i) {
    const b = B();
    const cmd = AZ.data.commands[i];
    if (!cmd) return false;
    if (W.cmdCd[i] > 0) { msg(W, `${cmd.name} 재사용 대기 중`); return false; }
    const lia = W.allies.find((a) => a.ally === 'lia' && a.down <= 0);
    const any = W.allies.find((a) => a.down <= 0);
    if (cmd.needs === 'lia' && !lia) { msg(W, '리아가 없어 명령 불가', '#ffb35c'); return false; }
    if (cmd.needs === 'any' && !any) { msg(W, '명령을 받을 동료가 없음', '#ffb35c'); return false; }
    if (p.locks[3] > 0) { msg(W, '권한 회수됨 — 명령 불가', '#ff5470'); return false; }
    W.cmdCd[i] = cmd.cd;
    if (cmd.id === 'scan') {
      W.scan = 12;
      W.stats.scans += 1;
      b.bark(W, 'lia', 'scan');
      b.sfx(W, 'skill', { pitch: 1.3 });
      b.ev(W, { type: 'scan', x: lia.x, y: lia.y });
      b.ev(W, { type: 'banner', kind: 'cmd', text: '전술 분석', sub: '약점 노출 · 공격 예측' });
    } else if (cmd.id === 'cover') {
      const amt = p.maxHp * 0.15;
      p.shield = Math.max(p.shield, 0) + amt;
      p.shieldT = Math.max(p.shieldT, 10);
      for (const a of W.allies) {
        if (a.down > 0) continue;
        a.hp = Math.min(a.maxHp, a.hp + a.maxHp * 0.2);
        a.shield = a.maxHp * 0.2;
        a.shieldT = 10;
      }
      b.sfx(W, 'shield');
      b.ev(W, { type: 'ring', x: p.x, y: p.y, r0: 140, r1: 30, color: '#7ce8ff', t: 0.5 });
      b.ev(W, { type: 'banner', kind: 'cmd', text: '엄호', sub: '파티 방벽 전개' });
    } else if (cmd.id === 'focus') {
      W.allyFocus = 10;
      b.sfx(W, 'charge', { pitch: 1.2 });
      b.ev(W, { type: 'banner', kind: 'cmd', text: '집중 공격', sub: '동료 공격 강화 · 브레이크 2배' });
    }
    return true;
  }

  /* ── 공통 행동 시도 (대기/이동 중, 또는 캔슬 가능한 순간) ── */
  function tryActions(W, p, inp, fromCancel) {
    if (!inp) return false;
    if (p.buf.dodge > 0) return startDodge(W, p, inp) || false;
    for (let i = 0; i < 3; i++) if (inp.skills && inp.skills[i] && useSkill(W, p, i, inp)) return true;
    if (inp.ult && startUlt(W, p, inp)) return true;
    if (inp.chain) doChain(W, p);
    if (!fromCancel) {
      if (p.counterReady > 0 && (p.buf.attack > 0 || p.buf.heavy > 0)) { doCounter(W, p); return true; }
      if (p.buf.heavy > 0) { startAttack(W, p, inp, true); return true; }
      if (p.buf.attack > 0) { startAttack(W, p, inp, false); return true; }
    }
    return false;
  }

  /* ── 피격 / 사망 ── */
  function onHurt(W, dmg, ang, kb) {
    const p = W.player;
    p.combo = 0;
    p.flash = 0.2;
    const armored = p.state === 'attack' && p.st && p.st.step && p.st.step.armor;
    if (armored || p.state === 'ult' || p.state === 'skill') return;
    p.state = 'hurt';
    p.st = null;
    p.hurtT = 0.3;
    p.kbx = Math.cos(ang) * kb * 1.6;
    p.kby = Math.sin(ang) * kb * 1.6;
    p.iframe = Math.max(p.iframe, 0.35);
    p.anim = 'hurt';
    p.animT = 0;
    p.comboWin = 0;
  }

  function onDeath(W) {
    const p = W.player;
    p.dead = true;
    p.state = 'dead';
    p.anim = 'dead';
    p.animT = 0;
    W.slow = 0.35;
    W.slowT = 1.2;
    B().sfx(W, 'defeat');
    B().endBattle(W, 'defeat', 2.2);
  }

  /* ── 매 프레임 ── */
  function update(W, dt, inp) {
    const p = W.player;
    p.animT += dt;
    p.flash = Math.max(0, p.flash - dt);
    if (p.dead) { p.deadT += dt; return; }

    // 예약된 동작
    if (p.sched.length) {
      for (const s of p.sched) s.t -= dt;
      const due = p.sched.filter((s) => s.t <= 0);
      p.sched = p.sched.filter((s) => s.t > 0);
      for (const s of due) s.fn();
    }

    // 타이머
    p.iframe = Math.max(0, p.iframe - dt);
    for (let i = 0; i < 3; i++) {
      if (p.cds[i] > 0) p.cds[i] = Math.max(0, p.cds[i] - dt * (p.haste > 0 ? 1.15 : 1));
    }
    for (let i = 0; i < 4; i++) if (p.locks[i] > 0) p.locks[i] -= dt;
    if (p.shieldT > 0) { p.shieldT -= dt; if (p.shieldT <= 0) p.shield = 0; }
    if (p.haste > 0) p.haste -= dt;
    if (p.blinkCrit > 0) p.blinkCrit -= dt;
    if (p.counterReady > 0) p.counterReady -= dt;
    if (p.comboWin > 0) p.comboWin -= dt;
    if (p.combo > 0) {
      p.comboT -= dt;
      if (p.comboT <= 0) p.combo = 0;
    }
    if (p.regen) {
      p.hp = Math.min(p.maxHp, p.hp + p.regen.perSec * dt);
      p.regen.t -= dt;
      if (p.regen.t <= 0) p.regen = null;
    }
    if (p.dodgeCharges < MAX_DODGE) {
      p.dodgeRegen += dt;
      if (p.dodgeRegen >= DODGE_REGEN) { p.dodgeRegen = 0; p.dodgeCharges += 1; }
    } else p.dodgeRegen = 0;
    if (p.hp > p.maxHp * 0.5) p.lowHpBarked = false;

    // 입력 버퍼
    for (const k of ['attack', 'heavy', 'dodge']) p.buf[k] = Math.max(0, p.buf[k] - dt);
    if (inp) {
      if (inp.attack) p.buf.attack = BUFFER;
      else if (inp.attackHeld && p.buf.attack <= 0) p.buf.attack = 0.06;
      if (inp.heavy) p.buf.heavy = BUFFER;
      if (inp.dodge) p.buf.dodge = BUFFER;
      if (inp.cmds) for (let i = 0; i < 3; i++) if (inp.cmds[i]) doCommand(W, p, i);
    }
    // 대상 유지
    if (p.target && (p.target.dead || p.target.untargetable || U.dist(p.x, p.y, p.target.x, p.target.y) > 900)) p.target = null;
    if (!p.target) p.target = pickTarget(W, p, null, 700);

    // 넉백
    if (p.kbx || p.kby) {
      p.x += p.kbx * dt;
      p.y += p.kby * dt;
      const f = Math.pow(0.0008, dt);
      p.kbx *= f;
      p.kby *= f;
      if (Math.abs(p.kbx) + Math.abs(p.kby) < 5) { p.kbx = 0; p.kby = 0; }
    }

    switch (p.state) {
      case 'idle':
      case 'move': {
        if (tryActions(W, p, inp, false)) break;
        const ang = inputAngle(inp);
        if (ang != null) {
          const m = Math.min(1, Math.hypot(inp.mx, inp.my));
          const sp = MOVE_SPEED * (p.haste > 0 ? 1.35 : 1) * m;
          p.x += Math.cos(ang) * sp * dt;
          p.y += Math.sin(ang) * sp * dt;
          p.facing = U.turnToward(p.facing, ang, 18 * dt);
          p.state = 'move';
          p.runT += dt * m;
          p.anim = 'run';
        } else {
          p.state = 'idle';
          p.anim = 'idle';
        }
        break;
      }
      case 'attack':
        if (inp && p.buf.dodge > 0) {
          if (startDodge(W, p, inp)) break;
        }
        updateAttack(W, p, dt, inp);
        break;
      case 'dodge':
        updateDodge(W, p, dt, inp);
        break;
      case 'skill':
        updateSkillState(W, p, dt);
        break;
      case 'stance':
        p.st.t += dt;
        if (p.st.t >= p.st.dur) { p.state = 'idle'; p.st = null; }
        break;
      case 'hurt':
        p.hurtT -= dt;
        if (p.hurtT <= 0) { p.state = 'idle'; }
        break;
      case 'ult':
        updateUlt(W, p, dt);
        break;
      case 'locked':
        p.st.t -= dt;
        if (p.st.t <= 0) { p.state = 'idle'; p.st = null; }
        break;
      default:
        p.state = 'idle';
    }
    B().clampToArena(W, p);
  }

  return { create, update, onHurt, onDeath, onCounterStance, gainFocus, pickTarget, SKILLS };
})();
