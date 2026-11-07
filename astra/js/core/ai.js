'use strict';

/* =========================================================
 * 적 행동 — 보스 10종과 일반 적
 * 행동 패턴은 제너레이터: yield 초  (적의 시간 = ZERO FRAME 에 느려짐)
 * 공격은 battle.addHazard 로 "경고 → 판정" 위험 지역을 만들어 표현합니다.
 * ========================================================= */
window.AZ = window.AZ || {};

AZ.ai = (() => {
  const U = AZ.util;
  const B = () => AZ.battle;

  /* ───────────── 생성 ───────────── */
  function baseEntity(W, kind, x, y, r) {
    return {
      id: U.nextId(), kind, team: 'enemy', x, y, z: 0, vx: 0, vy: 0, r,
      facing: Math.PI / 2, flash: 0, stun: 0, exposed: 0, alert: 0, alpha: 1,
      anim: 'idle', animT: 0, brain: { gen: null, wait: 0, rest: 1, last: null, iter: 0 },
      dash: null, dead: false, deadT: 0, untargetable: false, airborne: false, spawnT: 0, parts: {},
    };
  }

  function spawnBoss(W, id) {
    const def = AZ.data.bosses[id];
    const P = AZ.progress;
    const e = baseEntity(W, 'boss', W.w / 2, W.h * (def.big ? 0.4 : 0.3), def.r);
    e.bossId = id;
    e.def = def;
    e.maxHp = Math.round(P.bossHp(W.cfg.chapterId, def.hpMul) * W.diff.hp);
    e.hp = e.maxHp;
    e.brkMax = def.breakMax;
    e.brk = e.brkMax;
    e.brkIdle = 0;
    e.broken = false;
    e.breakT = 0;
    e.phase = 1;
    e.speed = def.speed;
    e.superArmor = true;
    e.timers = {};
    e.brain.rest = 1.2;
    W.enemies.push(e);
    const ai = BOSS_AI[id];
    if (ai && ai.init) ai.init(e, W);
    return e;
  }

  function spawnMinion(W, type, x, y, opts) {
    const def = AZ.data.enemies[type];
    const e = baseEntity(W, 'enemy', x, y, def.r);
    e.type = type;
    e.def = def;
    const scale = 1 + (W.cfg.chapterId - 1) * 0.12;
    e.maxHp = Math.max(1, Math.round(W.ref.atk * def.hp * scale * (0.85 + 0.15 * W.diff.hp)));
    e.hp = e.maxHp;
    e.speed = def.speed * (0.92 + Math.random() * 0.16);
    e.clone = !!def.clone;
    e.z = def.flying ? 26 : 0;
    e.spawnT = (opts && opts.delay) || 0.3;
    e.untargetable = true;
    e.brain.rest = 0.8 + Math.random() * 0.8;
    e.facing = U.angleTo(x, y, W.player.x, W.player.y);
    W.enemies.push(e);
    return e;
  }

  /* ───────────── 패턴 문맥(k) ───────────── */
  function ctx(W, e) {
    const b = B();
    const p = W.player;
    const own = (o, dmgDefault) => {
      const out = Object.assign({ owner: e }, o);
      if (out.dmg == null) out.dmg = dmgDefault != null ? dmgDefault : 1;
      if (e.kind === 'enemy') out.dmg *= e.def.dmg;
      if (out.dmg >= 1.6 && e.kind === 'boss') e.alert = Math.max(e.alert, 0.7);
      return out;
    };
    const k = {
      W, e, p,
      get phase() { return e.phase || 1; },
      ang: () => U.angleTo(e.x, e.y, p.x, p.y),
      dist: () => U.dist(e.x, e.y, p.x, p.y),
      face: (a) => { e.facing = a != null ? a : U.angleTo(e.x, e.y, p.x, p.y); return e.facing; },
      circle: (x, y, r, o) => b.addHazard(W, 'circle', { x, y, r }, own(o)),
      ring: (x, y, r0, r1, o) => b.addHazard(W, 'ring', { x, y, r0, r1 }, own(o)),
      sector: (x, y, r, ang, arc, o) => b.addHazard(W, 'sector', { x, y, r, ang, arc }, own(o)),
      line: (x, y, ang, len, w, o) => b.addHazard(W, 'line', { x, y, ang, len, w }, own(o)),
      outside: (x, y, r, o) => b.addHazard(W, 'outside', { x, y, r }, own(o)),
      all: (safe, o) => b.addHazard(W, 'all', { x: W.w / 2, y: W.h / 2, safe }, own(o)),
      bullet: (o) => b.addBullet(W, Object.assign({ owner: e, team: 'enemy' }, o, { dmg: (o.dmg || 1) * (e.kind === 'enemy' ? e.def.dmg : 1) })),
      dash: (ang, len, time, dmg) => {
        e.dash = { vx: Math.cos(ang) * len / time, vy: Math.sin(ang) * len / time, t: time, dmg: dmg || 0, hit: new Set() };
        e.facing = ang;
      },
      anim: (name) => { e.anim = name; e.animT = 0; },
      sfx: (n, o) => b.sfx(W, n, o),
      shake: (a) => b.shake(W, a),
      banner: (text, sub, kind) => b.ev(W, { type: 'banner', kind: kind || 'warn', text, sub: sub || '' }),
      bark: (group, key) => b.bark(W, group, key),
      text: (str, color) => b.text(W, e.x, e.y - e.r - (e.z || 0) - 40, str, color || '#ff9aa8', 18, { tag: true }),
      near: (r) => ({ x: p.x + U.rand(-r, r), y: p.y + U.rand(-r, r) }),
      clampPt: (x, y, m) => ({ x: U.clamp(x, m || 60, W.w - (m || 60)), y: U.clamp(y, m || 60, W.h - (m || 60)) }),
      minions: () => W.enemies.filter((m) => !m.dead && m.kind === 'enemy').length,
      spawn: (type, x, y) => spawnMinion(W, type, x, y, { delay: 0.5 }),
      ev: (o) => b.ev(W, o),
    };
    return k;
  }

  /* ───────────── 이동 도우미 ───────────── */
  function moveToward(e, tx, ty, speed, dt) {
    const d = U.dist(e.x, e.y, tx, ty);
    if (d < 2) return 0;
    const step = Math.min(d, speed * dt);
    const a = U.angleTo(e.x, e.y, tx, ty);
    e.x += Math.cos(a) * step;
    e.y += Math.sin(a) * step;
    return step;
  }
  function chase(W, e, dt, keep, speedMul) {
    const p = W.player;
    const d = U.dist(e.x, e.y, p.x, p.y);
    const turn = (e.def && e.def.turnRate) || 7;
    e.facing = U.turnToward(e.facing, U.angleTo(e.x, e.y, p.x, p.y), turn * dt);
    if (d > keep) {
      moveToward(e, p.x, p.y, e.speed * (speedMul || 1), dt);
      e.anim = 'move';
    } else e.anim = 'idle';
  }
  function strafe(W, e, dt, keep, speedMul) {
    const p = W.player;
    const d = U.dist(e.x, e.y, p.x, p.y);
    const a = U.angleTo(p.x, p.y, e.x, e.y);
    e.strafeDir = e.strafeDir || (Math.random() < 0.5 ? 1 : -1);
    if (Math.random() < dt * 0.25) e.strafeDir *= -1;
    const na = a + e.strafeDir * 0.9 * dt * (e.speed / Math.max(80, d));
    const tx = p.x + Math.cos(na) * keep;
    const ty = p.y + Math.sin(na) * keep;
    moveToward(e, tx, ty, e.speed * (speedMul || 1) * (Math.abs(d - keep) > 60 ? 1 : 0.5), dt);
    e.facing = U.turnToward(e.facing, U.angleTo(e.x, e.y, p.x, p.y), 8 * dt);
    e.anim = 'move';
  }

  /* ───────────── 공용 업데이트 ───────────── */
  function update(W, dt, edt) {
    for (const e of W.enemies) {
      if (e.dead) {
        e.deadT += dt;
        continue;
      }
      e.animT += edt;
      e.flash = Math.max(0, e.flash - dt);
      if (e.spawnT > 0) {
        e.spawnT -= dt;
        if (e.spawnT <= 0) e.untargetable = false;
        continue;
      }
      if (e.alert > 0) e.alert -= edt;
      if (e.exposed > 0) e.exposed -= edt;
      if (e.stance > 0) e.stance -= edt;
      if (e.kind === 'boss') updateBossTimers(W, e, dt, edt);
      // 넉백 속도
      if (e.vx || e.vy) {
        e.x += e.vx * edt;
        e.y += e.vy * edt;
        const f = Math.pow(0.004, edt);
        e.vx *= f;
        e.vy *= f;
        if (Math.abs(e.vx) + Math.abs(e.vy) < 4) { e.vx = 0; e.vy = 0; }
      }
      if (edt <= 0) continue;
      if (e.broken) {
        e.anim = 'broken';
        continue;
      }
      if (e.stun > 0) {
        e.stun -= edt;
        e.anim = 'hurt';
        continue;
      }
      // 돌진
      if (e.dash) {
        e.x += e.dash.vx * edt;
        e.y += e.dash.vy * edt;
        e.dash.t -= edt;
        if (e.dash.dmg > 0) dashContact(W, e);
        if (e.dash.t <= 0 || e.x < e.r || e.y < e.r || e.x > W.w - e.r || e.y > W.h - e.r) e.dash = null;
        B().clampToArena(W, e);
      }
      runBrain(W, e, dt, edt);
      if (!e.airborne) B().clampToArena(W, e);
      else {
        e.x = U.clamp(e.x, 40, W.w - 40);
        e.y = U.clamp(e.y, 40, W.h - 40);
      }
    }
    // 시체 정리 (보스는 남겨 둠)
    W.enemies = W.enemies.filter((e) => !e.dead || e.kind === 'boss' || e.deadT < 1.2);
  }

  function dashContact(W, e) {
    const targets = [W.player, ...W.allies];
    for (const t of targets) {
      if (t.dead || t.down > 0 || e.dash.hit.has(t.id)) continue;
      if (U.dist(e.x, e.y, t.x, t.y) < e.r + t.r) {
        e.dash.hit.add(t.id);
        B().hurt(W, t, e.dash.dmg * W.ref.dmg * (e.kind === 'enemy' ? e.def.dmg : 1), { x: e.x, y: e.y, kb: 240, perfectable: true, source: e });
      }
    }
  }

  function runBrain(W, e, dt, edt) {
    const ai = e.kind === 'boss' ? BOSS_AI[e.bossId] : MINION_AI[e.def.ai];
    if (!ai) return;
    const br = e.brain;
    if (br.gen) {
      br.wait -= edt;
      let guard = 0;
      while (br.gen && br.wait <= 0 && guard++ < 30) {
        let r;
        try {
          r = br.gen.next();
        } catch (err) {
          if (typeof console !== 'undefined') console.error(err);
          r = { done: true };
        }
        if (r.done) {
          br.gen = null;
          const rest = ai.rest || [0.6, 1.0];
          br.rest = U.rand(rest[0], rest[1]) / (W.diff.aggro || 1) * (e.phase > 1 ? 0.8 : 1);
          e.anim = 'idle';
        } else br.wait += r.value || 0;
      }
      return;
    }
    const k = ctx(W, e);
    if (ai.idle) ai.idle(k, edt);
    br.rest -= edt;
    if (br.rest <= 0 && W.state === 'fight' && !W.player.dead) {
      const opts = ai.moves(k).filter((m) => m[1] > 0 && ai[m[0]]);
      let pickName = U.weighted(opts.map(([n, w]) => [n, n === br.last && opts.length > 1 ? w * 0.25 : w]));
      if (!pickName) { br.rest = 0.5; return; }
      br.last = pickName;
      br.gen = ai[pickName](k);
      br.wait = 0;
    }
  }

  /** 행동을 끊고 다른 패턴으로 */
  function interrupt(W, e, genFn) {
    const k = ctx(W, e);
    e.brain.gen = genFn(k);
    e.brain.wait = 0;
    e.dash = null;
  }

  /* ───────────── 보스 상태 ───────────── */
  function updateBossTimers(W, e, dt, edt) {
    if (e.broken) {
      e.breakT -= edt;
      if (e.breakT <= 0) {
        e.broken = false;
        e.brk = e.brkMax;
        B().text(W, e.x, e.y - e.r - 50, '자세 회복', '#ffb35c', 16);
        const ai = BOSS_AI[e.bossId];
        if (ai.onRecover) interrupt(W, e, ai.onRecover);
      }
      return;
    }
    e.brkIdle += edt;
    if (e.brkIdle > 4 && e.brk < e.brkMax) e.brk = Math.min(e.brkMax, e.brk + e.brkMax * 0.05 * edt);
    // 공중 높이
    const wantZ = e.airborne ? (e.def.airborne ? 130 : 0) : (e.def.flying ? 28 : 0);
    e.z = U.approach(e.z, e.bossId === 'astra' ? 40 : wantZ, 260 * dt);
  }

  function onBossDamaged(W, e, dmg, o) {
    const ai = BOSS_AI[e.bossId];
    // 페이즈 전환
    const th = e.def.phases || [];
    if (e.phase - 1 < th.length && e.hp > 0 && e.hp / e.maxHp <= th[e.phase - 1]) {
      e.phase += 1;
      B().bark(W, e.bossId, 'phase2');
      B().ev(W, { type: 'banner', kind: 'phase', text: `PHASE ${e.phase}`, sub: e.def.name + ' — 출력 상승' });
      if (ai.transition && !e.broken) interrupt(W, e, ai.transition);
    }
    if (ai.onHit) ai.onHit(ctx(W, e), dmg, o);
  }

  function onBossBroken(W, e) {
    const ai = BOSS_AI[e.bossId];
    e.stance = 0;
    if (ai.onBreak) ai.onBreak(ctx(W, e));
  }

  function onBossDeath(W, e) {
    const b = B();
    e.anim = 'dead';
    e.animT = 0;
    W.slow = 0.25;
    W.slowT = 1.6;
    W.zero = 0;
    for (const h of W.hazards) { if (!h.done) { h.done = true; h.fade = 0.3; } }
    W.bullets = W.bullets.filter((bl) => bl.team !== 'enemy');
    for (const m of W.enemies) if (m !== e && !m.dead) b.killEnemy(W, m);
    b.ev(W, { type: 'burst', x: e.x, y: e.y, z: (e.z || 0) + e.r, r: e.r * 4, color: e.def.color, big: true });
    b.ev(W, { type: 'flash', color: 'rgba(255,255,255,0.75)', t: 0.5 });
    b.ev(W, { type: 'bossDown', name: e.def.name });
    b.sfx(W, 'bigExplosion');
    b.shake(W, 22);
    b.bark(W, e.bossId, 'defeat');
    b.endBattle(W, 'victory', 3.0);
  }

  /* ───────────── 보스 행동 ───────────── */
  const BOSS_AI = {};

  /* 1. 스캐빈저 — 폐허의 포식자 */
  BOSS_AI.scavenger = {
    rest: [0.45, 0.9],
    idle(k, dt) { chase(k.W, k.e, dt, 120, k.phase > 1 ? 1.3 : 1); },
    moves(k) {
      const d = k.dist();
      const m = [['claw', d < 230 ? 5 : 1], ['pounce', d > 200 ? 4 : 2], ['toss', 2]];
      if (k.phase > 1) m.push(['burrow', 2.5]);
      return m;
    },
    *claw(k) {
      const e = k.e;
      k.face();
      k.anim('windup');
      k.sector(e.x, e.y, 145, e.facing, 1.9, { warn: 0.55, dmg: 1.0 });
      yield 0.55;
      k.anim('attack');
      k.sfx('slash', { pitch: 0.7 });
      yield 0.22;
      k.face();
      k.anim('windup');
      k.sector(e.x, e.y, 150, e.facing, 2.1, { warn: 0.42, dmg: 1.1 });
      yield 0.42;
      k.anim('attack');
      k.sfx('slash', { pitch: 0.65 });
      yield 0.55;
    },
    *pounce(k) {
      const e = k.e;
      const n = k.phase > 1 ? 3 : 1;
      for (let i = 0; i < n; i++) {
        const ang = k.face();
        const len = Math.min(k.dist() + 130, 540);
        const warn = i === 0 ? 0.72 : 0.5;
        k.anim('windup');
        k.line(e.x, e.y, ang, len, 78, { warn, life: 0.26, dmg: 1.5, kb: 280 });
        yield warn;
        k.anim('dash');
        k.dash(ang, len, 0.26);
        k.sfx('swing', { pitch: 0.6 });
        yield 0.34;
      }
      k.anim('idle');
      yield 0.75;
    },
    *toss(k) {
      k.anim('windup');
      k.sfx('roar', { vol: 0.4, pitch: 1.3 });
      yield 0.3;
      const n = k.phase > 1 ? 8 : 5;
      for (let i = 0; i < n; i++) {
        const pt = k.clampPt(k.p.x + U.rand(-200, 200), k.p.y + U.rand(-200, 200));
        if (i === 0) { pt.x = k.p.x; pt.y = k.p.y; }
        k.circle(pt.x, pt.y, 62, { warn: 0.95 + i * 0.07, dmg: 1.1, visual: 'debris' });
      }
      yield 1.3;
    },
    *burrow(k) {
      const e = k.e;
      k.anim('burrow');
      e.untargetable = true;
      k.sfx('stomp', { vol: 0.6 });
      yield 0.5;
      const tx = k.p.x;
      const ty = k.p.y;
      k.circle(tx, ty, 115, { warn: 1.0, dmg: 1.8, kb: 300, label: '발밑 주의' });
      yield 1.0;
      e.x = tx;
      e.y = ty;
      e.untargetable = false;
      k.anim('attack');
      k.shake(10);
      k.ring(tx, ty, 115, 270, { warn: 0.35, dmg: 1.0 });
      yield 1.0;
    },
    *transition(k) {
      k.anim('roar');
      k.sfx('roar');
      k.shake(8);
      k.ring(k.e.x, k.e.y, 0, 300, { warn: 0.6, dmg: 0.6, kb: 420 });
      yield 1.2;
    },
  };

  /* 2. 아르카 — 방어형 기계 기사 */
  BOSS_AI.arka = {
    rest: [0.6, 1.1],
    init(e) { e.parts.shieldUp = 1; },
    idle(k, dt) {
      chase(k.W, k.e, dt, 150);
      k.e.shieldDown = false;
    },
    moves(k) {
      const d = k.dist();
      const m = [['sweep', d < 240 ? 4 : 1], ['charge', d > 220 ? 4 : 1.5], ['slam', 2.5]];
      if (k.phase > 1) m.push(['lances', 2.5]);
      return m;
    },
    *sweep(k) {
      const e = k.e;
      k.anim('windup');
      for (let i = 0; i < 6; i++) { e.facing = U.turnToward(e.facing, k.ang(), 0.25); yield 0.05; }
      k.sector(e.x, e.y, 178, e.facing, 3.0, { warn: 0.5, dmg: 1.4 });
      yield 0.5;
      k.anim('attack');
      k.sfx('slashHeavy', { pitch: 0.7 });
      yield 0.6;
    },
    *charge(k) {
      const e = k.e;
      const ang = k.face();
      k.anim('windup');
      k.line(e.x, e.y, ang, 540, 98, { warn: 0.85, life: 0.36, dmg: 1.6, kb: 320 });
      yield 0.85;
      k.anim('dash');
      k.dash(ang, 540, 0.36);
      k.sfx('stomp', { vol: 0.6 });
      yield 0.4;
      // 돌진 뒤에는 방패가 내려가 빈틈
      e.shieldDown = true;
      k.anim('recover');
      k.text('빈틈!', '#7cf7ff');
      yield 1.1;
      e.shieldDown = false;
    },
    *slam(k) {
      const e = k.e;
      k.face();
      k.anim('windup');
      const fx = e.x + Math.cos(e.facing) * 70;
      const fy = e.y + Math.sin(e.facing) * 70;
      k.circle(fx, fy, 150, { warn: 0.9, dmg: 1.8, kb: 300 });
      yield 0.9;
      k.anim('attack');
      k.shake(10);
      k.sfx('stomp');
      k.ring(fx, fy, 150, 285, { warn: 0.35, dmg: 1.0 });
      yield 0.9;
    },
    *lances(k) {
      const W = k.W;
      k.anim('cast');
      k.sfx('alarm', { vol: 0.4 });
      for (let i = 0; i < 3; i++) {
        const ang = U.rand(0, U.TAU);
        const px = k.p.x;
        const py = k.p.y;
        const ox = px - Math.cos(ang) * 1100;
        const oy = py - Math.sin(ang) * 1100;
        k.line(ox, oy, ang, 2200, 60, { warn: 1.0, dmg: 1.3, visual: 'lance' });
        yield 0.35;
      }
      yield 0.9;
      void W;
    },
    *transition(k) {
      k.anim('roar');
      k.sfx('clang');
      k.banner('방패 과부하', '아르카가 더 빠르게 돌아선다');
      k.ring(k.e.x, k.e.y, 0, 260, { warn: 0.6, dmg: 0.7, kb: 400 });
      k.e.def = Object.assign({}, k.e.def, { turnRate: 3.2 });
      yield 1.1;
    },
  };

  /* 3. 옵저버 — 감시 시스템 */
  BOSS_AI.observer = {
    rest: [0.7, 1.2],
    idle(k, dt) {
      const e = k.e;
      const p = k.p;
      const d = k.dist();
      const keep = 330;
      const a = U.angleTo(p.x, p.y, e.x, e.y) + dt * 0.35;
      moveToward(e, p.x + Math.cos(a) * keep, p.y + Math.sin(a) * keep, e.speed * (Math.abs(d - keep) > 80 ? 1.2 : 0.5), dt);
      e.facing = U.turnToward(e.facing, k.ang(), 3 * dt);
    },
    moves(k) {
      return [['beam', 3], ['eyeLaser', 3.5], ['mines', 2], ['drones', k.minions() < 3 ? 1.5 : 0], ['teleport', k.dist() < 160 ? 3 : 0.8]];
    },
    *beam(k) {
      const e = k.e;
      const dir = Math.random() < 0.5 ? 1 : -1;
      const a0 = k.ang() - 1.25 * dir;
      const lines = k.phase > 1 ? [a0, a0 + Math.PI] : [a0];
      k.anim('charge');
      for (const a of lines) {
        k.line(e.x, e.y, a, 780, 36, { warn: 0.9, life: 2.3, tick: 0.3, dmg: 0.7, follow: e,
          update: (h, W, dt) => { if (h.active) h.ang += dir * (2.6 / 2.3) * dt; } });
      }
      k.sfx('laser', { vol: 0.5 });
      yield 3.2;
    },
    *eyeLaser(k) {
      const e = k.e;
      const n = k.phase > 1 ? 3 : 1;
      for (let i = 0; i < n; i++) {
        k.anim('charge');
        const warn = i === 0 ? 1.3 : 0.9;
        k.line(e.x, e.y, k.ang(), 1050, 86, { warn, life: 0.3, dmg: 2.0, kb: 260, follow: e,
          update: (h, W, dt) => { if (!h.active && h.t < h.warn - 0.38) h.ang = U.turnToward(h.ang, U.angleTo(e.x, e.y, W.player.x, W.player.y), 2.6 * dt); } });
        k.sfx('charge', { vol: 0.5, pitch: 0.7 });
        yield warn;
        k.sfx('beam');
        k.shake(8);
        yield 0.35;
      }
      e.exposed = 3.6;
      k.anim('exposed');
      k.banner('렌즈 노출', '지금 공격하세요', 'chance');
      yield 1.2;
    },
    *mines(k) {
      k.anim('cast');
      const px = k.p.x;
      const py = k.p.y;
      for (let ix = -1; ix <= 1; ix++) {
        for (let iy = -1; iy <= 1; iy += 2) {
          const pt = k.clampPt(px + ix * 135, py + iy * 70);
          k.circle(pt.x, pt.y, 72, { warn: 1.1, dmg: 1.0, visual: 'mine' });
        }
      }
      k.circle(px, py, 60, { warn: 1.5, dmg: 1.0, visual: 'mine' });
      yield 1.5;
    },
    *drones(k) {
      k.anim('cast');
      k.sfx('summon');
      for (let i = 0; i < 3; i++) {
        const a = i * 2.1;
        k.spawn('miniDrone', k.e.x + Math.cos(a) * 90, k.e.y + Math.sin(a) * 90);
      }
      yield 1.0;
    },
    *teleport(k) {
      const e = k.e;
      const W = k.W;
      k.anim('fade');
      e.untargetable = true;
      k.sfx('teleport');
      yield 0.45;
      let best = null;
      for (let i = 0; i < 8; i++) {
        const pt = { x: U.rand(150, W.w - 150), y: U.rand(150, W.h - 150) };
        if (!best || U.dist(pt.x, pt.y, k.p.x, k.p.y) > U.dist(best.x, best.y, k.p.x, k.p.y)) best = pt;
      }
      e.x = best.x;
      e.y = best.y;
      e.untargetable = false;
      k.anim('idle');
      yield 0.5;
    },
    *transition(k) {
      k.sfx('alarm');
      k.banner('경계 단계 상승', '감시 드론 출동');
      for (let i = 0; i < 3; i++) k.spawn('miniDrone', k.e.x + U.rand(-120, 120), k.e.y + U.rand(-80, 80));
      yield 1.0;
    },
  };

  /* 4. 제로 — 라이벌 */
  BOSS_AI.zero = {
    rest: [0.35, 0.8],
    idle(k, dt) { strafe(k.W, k.e, dt, 210, k.phase > 1 ? 1.2 : 1); },
    moves(k) {
      const m = [['dashSlash', 3.5], ['crescent', 3], ['stance', 2]];
      if (k.phase > 1) m.push(['redRain', 2], ['clones', 2.2]);
      return m;
    },
    *dashSlash(k) {
      const e = k.e;
      const n = k.phase > 1 ? 3 : 2;
      for (let i = 0; i < n; i++) {
        const ang = k.face();
        const len = Math.min(k.dist() + 150, 470);
        const warn = i === 0 ? 0.5 : 0.4;
        k.anim('windup');
        k.line(e.x, e.y, ang, len, 56, { warn, life: 0.22, dmg: 1.2, kb: 220 });
        yield warn;
        k.anim('dash');
        k.dash(ang, len, 0.22);
        k.sfx('slash', { pitch: 1.1 });
        k.ev({ type: 'trail', x0: e.x, y0: e.y, x1: e.x + Math.cos(ang) * len, y1: e.y + Math.sin(ang) * len, color: '#ff3355' });
        yield 0.3;
      }
      e.exposed = 1.1;
      k.anim('recover');
      yield 1.0;
    },
    *crescent(k) {
      const e = k.e;
      k.face();
      k.anim('windup');
      k.sector(e.x, e.y, 155, e.facing, 2.4, { warn: 0.5, dmg: 1.3 });
      yield 0.5;
      k.anim('attack');
      k.sfx('slashHeavy');
      k.bullet({ x: e.x, y: e.y, ang: k.ang(), speed: 540, r: 28, dmg: 1.0, life: 1.8, kind: 'crescent', color: '#ff3355', pierce: true });
      if (k.phase > 1) {
        k.bullet({ x: e.x, y: e.y, ang: k.ang() + 0.35, speed: 540, r: 28, dmg: 1.0, life: 1.8, kind: 'crescent', color: '#ff3355', pierce: true });
        k.bullet({ x: e.x, y: e.y, ang: k.ang() - 0.35, speed: 540, r: 28, dmg: 1.0, life: 1.8, kind: 'crescent', color: '#ff3355', pierce: true });
      }
      yield 0.7;
    },
    *stance(k) {
      const e = k.e;
      k.anim('stance');
      e.stance = 1.6;
      k.text('반격 태세', '#ff3355');
      k.sfx('charge', { pitch: 0.8 });
      yield 1.6;
      e.stance = 0;
      yield 0.2;
    },
    *counter(k) {
      const e = k.e;
      const p = k.p;
      e.stance = 0;
      const back = p.facing + Math.PI;
      e.x = U.clamp(p.x + Math.cos(back) * 70, 40, k.W.w - 40);
      e.y = U.clamp(p.y + Math.sin(back) * 70, 40, k.W.h - 40);
      k.face();
      k.anim('windup');
      k.sfx('counter');
      k.text('간파했다!', '#ff3355');
      const h = k.sector(e.x, e.y, 130, e.facing, 2.6, { warn: 0.32, dmg: 1.8, kb: 300 });
      h.counterHit = true;
      yield 0.32;
      k.anim('attack');
      k.sfx('slashHeavy');
      yield 0.6;
    },
    *redRain(k) {
      k.anim('cast');
      for (let i = 0; i < 10; i++) {
        k.circle(k.p.x, k.p.y, 70, { warn: 0.65, dmg: 0.9, visual: 'red' });
        yield 0.18;
      }
      yield 0.6;
    },
    *clones(k) {
      const p = k.p;
      k.anim('cast');
      k.sfx('teleport');
      const base = U.rand(0, U.TAU);
      for (let i = 0; i < 3; i++) {
        const a = base + i * (U.TAU / 3);
        const ox = p.x + Math.cos(a) * 320;
        const oy = p.y + Math.sin(a) * 320;
        k.line(ox, oy, a + Math.PI, 640, 52, { warn: 0.75 + i * 0.12, life: 0.2, dmg: 1.1, visual: 'afterimage' });
      }
      yield 1.3;
      k.e.exposed = 0.9;
      yield 0.6;
    },
    onHit(k) {
      const e = k.e;
      if (e.stance > 0 && !e.broken) {
        e.stance = 0;
        interrupt(k.W, e, BOSS_AI.zero.counter);
      }
    },
    *transition(k) {
      k.anim('roar');
      k.banner('붉은 프로토콜', '제로의 출력이 한계를 넘는다');
      k.sfx('roar', { pitch: 1.5 });
      k.e.speed = k.e.def.speed * 1.2;
      k.ring(k.e.x, k.e.y, 0, 240, { warn: 0.5, dmg: 0.8, kb: 380, visual: 'red' });
      yield 1.0;
    },
  };

  /* 5. 아틀라스 — 거대 전투 병기 */
  BOSS_AI.atlas = {
    rest: [0.8, 1.3],
    idle(k, dt) { chase(k.W, k.e, dt, 220); },
    moves(k) {
      const m = [['fist', 3], ['missiles', 2.5], ['sweep', 2], ['stomp', k.dist() < 300 ? 3 : 1]];
      if (k.phase > 1) m.push(['orbital', (k.e.timers.orbital || 0) < k.W.t ? 2.5 : 0]);
      return m;
    },
    *fist(k) {
      const e = k.e;
      const n = k.phase > 1 ? 2 : 1;
      for (let i = 0; i < n; i++) {
        k.face();
        e.parts.arm = i % 2 ? 1 : -1;
        k.anim('windup');
        k.circle(k.p.x, k.p.y, 140, { warn: i === 0 ? 1.1 : 0.8, dmg: 2.0, kb: 320, visual: 'fist' });
        yield i === 0 ? 1.1 : 0.8;
        k.anim('slam');
        k.shake(12);
        k.sfx('stomp');
        yield 0.25;
      }
      e.exposed = 2.4;
      k.banner('코어 노출', '팔이 땅에 박혔다 — 공격!', 'chance');
      yield 1.8;
      e.parts.arm = 0;
    },
    *missiles(k) {
      k.anim('cast');
      k.sfx('missile');
      const n = k.phase > 1 ? 18 : 12;
      for (let i = 0; i < n; i++) {
        const pt = k.clampPt(k.p.x + U.rand(-300, 300), k.p.y + U.rand(-260, 260));
        if (i % 4 === 0) { pt.x = k.p.x; pt.y = k.p.y; }
        k.circle(pt.x, pt.y, 64, { warn: 1.0, dmg: 1.0, visual: 'missile' });
        yield 0.09;
      }
      yield 1.0;
    },
    *sweep(k) {
      const e = k.e;
      const dir = Math.random() < 0.5 ? 1 : -1;
      k.anim('charge');
      k.line(e.x, e.y, k.ang() - 1.5 * dir, 1350, 64, { warn: 1.0, life: 2.4, tick: 0.3, dmg: 1.1, follow: e,
        update: (h, W, dt) => { if (h.active) h.ang += dir * (3.0 / 2.4) * dt; } });
      k.sfx('laser');
      yield 3.4;
    },
    *stomp(k) {
      const e = k.e;
      k.anim('windup');
      yield 0.25;
      for (let i = 0; i < 3; i++) {
        const r0 = 50 + i * 125;
        k.ring(e.x, e.y, r0, r0 + 115, { warn: 0.6 + i * 0.35, dmg: 1.3 });
      }
      yield 0.6;
      k.anim('slam');
      k.shake(10);
      k.sfx('stomp');
      yield 1.2;
    },
    *orbital(k) {
      const W = k.W;
      k.e.timers.orbital = W.t + 18;
      k.anim('cast');
      k.sfx('alarm');
      k.banner('궤도 폭격', '초록색 안전 지대로 피하세요!');
      const safe = [];
      for (let i = 0; i < 2; i++) {
        let pt;
        let tries = 0;
        do {
          pt = { x: U.rand(160, W.w - 160), y: U.rand(160, W.h - 160), r: 115 };
          tries++;
        } while (tries < 20 && (U.dist(pt.x, pt.y, k.p.x, k.p.y) < 220 || safe.some((s) => U.dist(s.x, s.y, pt.x, pt.y) < 500)));
        safe.push(pt);
      }
      k.all(safe, { warn: 2.6, dmg: 3.0, kb: 200, label: '궤도 폭격', visual: 'orbital' });
      yield 2.6;
      k.shake(18);
      k.sfx('bigExplosion');
      yield 1.0;
    },
    *transition(k) {
      k.anim('roar');
      k.sfx('roar', { pitch: 0.6 });
      k.banner('전투 출력 최대', '아틀라스가 궤도 무장을 연다');
      yield 1.2;
    },
  };

  /* 6. 세라 — 기억 조작 병기 */
  BOSS_AI.sera = {
    rest: [0.6, 1.0],
    idle(k, dt) {
      const e = k.e;
      const p = k.p;
      const keep = 270;
      const a = U.angleTo(p.x, p.y, e.x, e.y) - dt * 0.45;
      moveToward(e, p.x + Math.cos(a) * keep, p.y + Math.sin(a) * keep, e.speed * 0.8, dt);
      e.facing = U.turnToward(e.facing, k.ang(), 5 * dt);
    },
    moves(k) {
      const clones = k.W.enemies.some((m) => m.clone && !m.dead);
      const m = [['orbs', 3], ['clones', clones ? 0 : 2.5], ['prison', 2], ['blinkStrike', 2.5]];
      if (k.phase > 1) m.push(['distortion', (k.e.timers.dist || 0) < k.W.t ? 2.2 : 0]);
      return m;
    },
    *orbs(k) {
      const e = k.e;
      k.anim('cast');
      k.sfx('summon', { pitch: 1.4 });
      const n = k.phase > 1 ? 10 : 8;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * U.TAU;
        k.bullet({ x: e.x + Math.cos(a) * 40, y: e.y + Math.sin(a) * 40, ang: a, speed: 120, accel: 70, r: 13, dmg: 0.8, life: 4.5, homing: 1.1, kind: 'orb', color: '#ff7ad9', delay: 0.4 });
      }
      yield 1.3;
    },
    *clones(k) {
      const e = k.e;
      const p = k.p;
      const W = k.W;
      k.anim('cast');
      k.sfx('glitch');
      k.banner('기억의 환영', '진짜 세라를 찾아라 — "분석"으로 간파 가능');
      const base = U.rand(0, U.TAU);
      const spots = [];
      for (let i = 0; i < 4; i++) {
        const a = base + i * (U.TAU / 4);
        spots.push(k.clampPt(p.x + Math.cos(a) * 280, p.y + Math.sin(a) * 280, 80));
      }
      U.shuffle(spots);
      e.x = spots[0].x;
      e.y = spots[0].y;
      for (let i = 1; i < 4; i++) {
        const c = spawnMinion(W, 'seraClone', spots[i].x, spots[i].y, { delay: 0.05 });
        c.brain.rest = 0.8 + i * 0.5;
      }
      yield 1.0;
    },
    *prison(k) {
      const p = k.p;
      k.anim('cast');
      const gap = U.randInt(0, 7);
      for (let i = 0; i < 8; i++) {
        if (i === gap) continue;
        const a = (i / 8) * U.TAU;
        k.circle(p.x + Math.cos(a) * 150, p.y + Math.sin(a) * 150, 56, { warn: 1.2, dmg: 1.2, visual: 'pillar' });
      }
      k.circle(p.x, p.y, 70, { warn: 1.45, dmg: 1.2, visual: 'pillar' });
      yield 1.6;
    },
    *blinkStrike(k) {
      const e = k.e;
      const p = k.p;
      k.anim('fade');
      e.untargetable = true;
      k.sfx('teleport');
      yield 0.3;
      const back = p.facing + Math.PI;
      const pt = k.clampPt(p.x + Math.cos(back) * 110, p.y + Math.sin(back) * 110);
      e.x = pt.x;
      e.y = pt.y;
      e.untargetable = false;
      k.face();
      k.anim('windup');
      k.sector(e.x, e.y, 155, e.facing, 2.2, { warn: 0.5, dmg: 1.3 });
      yield 0.5;
      k.anim('attack');
      k.sfx('slash', { pitch: 1.3 });
      yield 0.7;
    },
    *distortion(k) {
      const e = k.e;
      e.timers.dist = k.W.t + 14;
      k.anim('cast');
      k.sfx('glitch');
      k.ev({ type: 'glitch', t: 1.8 });
      k.banner('기억 왜곡', '세라 곁의 작은 원만이 안전하다!');
      k.outside(e.x, e.y, 135, { warn: 1.8, dmg: 2.2, kb: 200, label: '안전 지대', visual: 'distort' });
      yield 2.2;
    },
    onHit(k) {
      const clones = k.W.enemies.filter((m) => m.clone && !m.dead);
      if (clones.length) {
        for (const c of clones) B().killEnemy(k.W, c);
        k.e.stun = 0.7;
        k.e.brain.gen = null;
        B().cancelOwnedWarnings(k.W, k.e);
        k.banner('환영 해제', '진짜를 찾아냈다!', 'chance');
        k.sfx('glitch');
      }
    },
    onBreak(k) {
      for (const c of k.W.enemies.filter((m) => m.clone && !m.dead)) B().killEnemy(k.W, c);
    },
    *transition(k) {
      k.anim('cast');
      k.ev({ type: 'glitch', t: 1.0 });
      k.sfx('glitch');
      yield 1.0;
    },
  };

  /* 7. 드라코 — 공중전 보스 */
  BOSS_AI.draco = {
    rest: [0.6, 1.0],
    init(e) { e.airborne = true; e.z = 130; e.flyA = 0; },
    idle(k, dt) {
      const e = k.e;
      const W = k.W;
      if (e.airborne) {
        e.flyA += dt * 0.55;
        const tx = W.w / 2 + Math.cos(e.flyA) * 420;
        const ty = W.h / 2 + Math.sin(e.flyA) * 260;
        const prevX = e.x;
        const prevY = e.y;
        moveToward(e, tx, ty, e.speed, dt);
        if (Math.abs(e.x - prevX) + Math.abs(e.y - prevY) > 0.5) e.facing = U.turnToward(e.facing, U.angleTo(prevX, prevY, e.x, e.y), 4 * dt);
        e.anim = 'fly';
      } else {
        e.facing = U.turnToward(e.facing, k.ang(), 3 * dt);
        e.anim = 'idle';
      }
    },
    moves(k) {
      if (!k.e.airborne) return [['takeoff', 1]];
      const m = [['strafe', 3], ['rain', 2.5], ['swoop', 3]];
      if (k.phase > 1) m.push(['breath', 2.5]);
      return m;
    },
    *strafe(k) {
      const e = k.e;
      const W = k.W;
      const horizontal = Math.random() < 0.5;
      k.anim('fly');
      k.sfx('roar', { vol: 0.5, pitch: 1.2 });
      for (let i = -1; i <= 1; i++) {
        if (horizontal) k.line(0, U.clamp(k.p.y + i * 150, 60, W.h - 60), 0, W.w, 82, { warn: 0.95 + (i + 1) * 0.12, dmg: 1.3, visual: 'fire' });
        else k.line(U.clamp(k.p.x + i * 150, 60, W.w - 60), 0, Math.PI / 2, W.h, 82, { warn: 0.95 + (i + 1) * 0.12, dmg: 1.3, visual: 'fire' });
      }
      // 경기장을 가로질러 날아간다
      const tx = horizontal ? (e.x < W.w / 2 ? W.w - 120 : 120) : e.x;
      const ty = horizontal ? e.y : (e.y < W.h / 2 ? W.h - 120 : 120);
      const ang = U.angleTo(e.x, e.y, tx, ty);
      k.dash(ang, U.dist(e.x, e.y, tx, ty), 1.1, 0);
      yield 1.5;
    },
    *rain(k) {
      k.anim('cast');
      const n = k.phase > 1 ? 14 : 10;
      for (let i = 0; i < n; i++) {
        const pt = k.clampPt(k.p.x + U.rand(-230, 230), k.p.y + U.rand(-200, 200));
        if (i % 3 === 0) { pt.x = k.p.x; pt.y = k.p.y; }
        k.circle(pt.x, pt.y, 72, { warn: 1.0, dmg: 1.1, visual: 'fireball' });
        yield 0.12;
      }
      yield 0.8;
    },
    *swoop(k) {
      const e = k.e;
      const n = k.phase > 1 ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const ang = k.face();
        const len = Math.min(k.dist() + 160, 760);
        k.anim('windup');
        k.sfx('roar', { vol: 0.6 });
        k.line(e.x, e.y, ang, len, 92, { warn: 0.85, life: 0.36, dmg: 1.8, kb: 320 });
        yield 0.85;
        k.anim('dash');
        k.dash(ang, len, 0.36);
        if (i === n - 1) e.airborne = false;
        yield 0.4;
      }
      // 착지
      k.shake(12);
      k.sfx('stomp');
      e.exposed = 3.2;
      k.anim('idle');
      k.banner('착지', '근접 공격이 닿는다 — 몰아쳐라!', 'chance');
      k.ring(e.x, e.y, 30, 170, { warn: 0.3, dmg: 0.8 });
      yield 1.5;
      k.face();
      k.anim('attack');
      k.circle(e.x, e.y, 165, { warn: 0.6, dmg: 1.2, kb: 300, label: '꼬리 휘두르기' });
      yield 1.5;
      yield* BOSS_AI.draco.takeoff(k);
    },
    *breath(k) {
      const e = k.e;
      const dir = Math.random() < 0.5 ? 1 : -1;
      k.anim('cast');
      k.sfx('roar');
      k.sector(e.x, e.y, 560, k.ang() - 0.8 * dir, 0.9, { warn: 0.8, life: 1.6, tick: 0.25, dmg: 0.8, follow: e, visual: 'fire',
        update: (h, W, dt) => { if (h.active) h.ang += dir * (1.6 / 1.6) * dt; } });
      yield 2.6;
    },
    *takeoff(k) {
      const e = k.e;
      k.anim('fly');
      e.airborne = true;
      k.sfx('swing', { pitch: 0.5 });
      yield 0.8;
    },
    onBreak(k) {
      const e = k.e;
      e.airborne = false;
      e.dash = null;
      k.text('추락!', '#ffe066');
      k.shake(14);
    },
    *onRecover(k) {
      yield 0.3;
      yield* BOSS_AI.draco.takeoff(k);
    },
    *transition(k) {
      k.anim('roar');
      k.sfx('roar');
      k.banner('분노', '드라코의 화염 출력 상승');
      yield 1.0;
    },
  };

  /* 8. 네메시스 — 행성 파괴 병기 */
  BOSS_AI.nemesis = {
    rest: [0.8, 1.3],
    init(e, W) { e.timers.buster = W.t + 16; },
    idle(k, dt) { chase(k.W, k.e, dt, 300); },
    moves(k) {
      const ready = k.W.t >= k.e.timers.buster;
      return [['well', 2], ['grid', 3], ['meteor', 2.5], ['buster', ready ? 12 : 0]];
    },
    *well(k) {
      k.anim('cast');
      k.sfx('summon', { pitch: 0.5 });
      const n = k.phase > 1 ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const pt = i === 0 ? { x: k.p.x, y: k.p.y } : k.clampPt(k.p.x + U.rand(-300, 300), k.p.y + U.rand(-250, 250));
        k.circle(pt.x, pt.y, 78, { warn: 0.6, life: 3.4, tick: 0.3, dmg: 0.6, pull: 150, pullR: 320, label: '중력장', visual: 'gravity' });
      }
      yield 1.4;
    },
    *grid(k) {
      const W = k.W;
      k.anim('cast');
      const fast = k.phase > 1;
      for (let i = 0; i < 4; i++) {
        const vertical = i % 2 === 0;
        const off = U.rand(-120, 120);
        if (vertical) k.line(U.clamp(k.p.x + off, 50, W.w - 50), 0, Math.PI / 2, W.h, 74, { warn: 1.0, dmg: 1.5, visual: 'orbitalLine' });
        else k.line(0, U.clamp(k.p.y + off, 50, W.h - 50), 0, W.w, 74, { warn: 1.0, dmg: 1.5, visual: 'orbitalLine' });
        k.sfx('laser', { vol: 0.35 });
        yield fast ? 0.32 : 0.45;
      }
      yield 1.1;
    },
    *meteor(k) {
      k.anim('cast');
      for (let i = 0; i < 6; i++) {
        const pt = i === 0 ? { x: k.p.x, y: k.p.y } : k.clampPt(k.p.x + U.rand(-320, 320), k.p.y + U.rand(-260, 260));
        k.circle(pt.x, pt.y, 105, { warn: 1.4, dmg: 2.0, kb: 300, visual: 'meteor' });
        yield 0.2;
      }
      yield 1.4;
    },
    *buster(k) {
      const e = k.e;
      const W = k.W;
      e.timers.buster = W.t + 30;
      k.anim('charge');
      e.charging = 6;
      e.exposed = 6;
      k.sfx('alarm');
      k.banner('행성 파괴포 충전', '브레이크로 저지하거나 초록 방어 지대로!');
      k.bark('lia', 'scan');
      const safe = [];
      for (let i = 0; i < 2; i++) {
        let pt;
        let tries = 0;
        do {
          pt = { x: U.rand(170, W.w - 170), y: U.rand(170, W.h - 170), r: 100 };
          tries++;
        } while (tries < 20 && (safe.some((s) => U.dist(s.x, s.y, pt.x, pt.y) < 520) || U.dist(pt.x, pt.y, e.x, e.y) < 260));
        safe.push(pt);
      }
      k.all(safe, { warn: 6.0, dmg: 4.0, kb: 200, label: '행성 파괴포', visual: 'buster' });
      yield 6.0;
      e.charging = 0;
      k.shake(22);
      k.sfx('bigExplosion');
      k.ev({ type: 'flash', color: 'rgba(200,120,255,0.6)', t: 0.5 });
      yield 1.6;
    },
    onBreak(k) {
      if (k.e.charging > 0) {
        k.e.charging = 0;
        k.e.exposed = 0;
        k.banner('충전 저지 성공', '행성 파괴포가 붕괴했다', 'chance');
      }
    },
    *transition(k) {
      k.anim('roar');
      k.sfx('roar', { pitch: 0.5 });
      k.e.timers.buster = Math.min(k.e.timers.buster, k.W.t + 4);
      yield 1.0;
    },
  };

  /* 9. 프로토콜 — 최종 관리자 */
  BOSS_AI.protocol = {
    rest: [0.5, 0.9],
    idle(k, dt) { strafe(k.W, k.e, dt, 290, 0.8); },
    moves(k) {
      const W = k.W;
      const m = [['firewall', 3], ['codeRain', 2.5], ['revoke', (k.e.timers.revoke || 0) < W.t ? 1.5 : 0], ['hex', 2], ['echo', 2.2]];
      if (k.phase > 1) m.push(['judgment', 2.5]);
      return m;
    },
    *firewall(k) {
      const W = k.W;
      k.anim('cast');
      k.sfx('glitch', { vol: 0.5 });
      for (let i = 0; i < 3; i++) {
        const vertical = Math.random() < 0.5;
        const gapW = 150;
        if (vertical) {
          const x = U.clamp(k.p.x + U.rand(-60, 60), 60, W.w - 60);
          const gy = U.clamp(k.p.y + U.rand(-180, 180), gapW, W.h - gapW);
          k.line(x, 0, Math.PI / 2, gy - gapW / 2, 52, { warn: 0.95, dmg: 1.4, visual: 'firewall' });
          k.line(x, gy + gapW / 2, Math.PI / 2, W.h, 52, { warn: 0.95, dmg: 1.4, visual: 'firewall' });
        } else {
          const y = U.clamp(k.p.y + U.rand(-60, 60), 60, W.h - 60);
          const gx = U.clamp(k.p.x + U.rand(-200, 200), gapW, W.w - gapW);
          k.line(0, y, 0, gx - gapW / 2, 52, { warn: 0.95, dmg: 1.4, visual: 'firewall' });
          k.line(gx + gapW / 2, y, 0, W.w, 52, { warn: 0.95, dmg: 1.4, visual: 'firewall' });
        }
        yield 0.75;
      }
      yield 0.6;
    },
    *codeRain(k) {
      k.anim('cast');
      for (let i = 0; i < 18; i++) {
        const pt = k.clampPt(k.p.x + U.rand(-320, 320), k.p.y + U.rand(-260, 260));
        if (i % 5 === 0) { pt.x = k.p.x; pt.y = k.p.y; }
        k.circle(pt.x, pt.y, 46, { warn: 0.7, dmg: 0.8, visual: 'code' });
        yield 0.06;
      }
      yield 1.0;
    },
    *revoke(k) {
      const W = k.W;
      const p = k.p;
      k.e.timers.revoke = W.t + 20;
      k.anim('cast');
      k.sfx('glitch');
      const slots = [0, 1, 2].filter((i) => p.stats.skills[i]);
      const slot = slots.length && Math.random() < 0.75 ? U.pick(slots) : 3;
      p.locks[slot] = 8;
      k.banner('권한 회수', slot === 3 ? '전술 명령이 8초간 잠겼다' : `${AZ.data.skills.nodes[p.stats.skills[slot]].name} — 8초간 잠김`);
      k.ev({ type: 'glitch', t: 0.6 });
      k.sector(k.e.x, k.e.y, 170, k.face(), 2.0, { warn: 0.55, dmg: 1.1 });
      yield 1.0;
    },
    *hex(k) {
      const px = k.p.x;
      const py = k.p.y;
      k.anim('cast');
      const pts = [[], []];
      for (let ix = -3; ix <= 3; ix++) {
        for (let iy = -2; iy <= 2; iy++) {
          const x = px + ix * 130 + (iy % 2 ? 65 : 0);
          const y = py + iy * 112;
          pts[(ix + iy + 10) % 2].push([x, y]);
        }
      }
      for (const [x, y] of pts[0]) k.circle(x, y, 66, { warn: 1.0, dmg: 1.2, visual: 'hex' });
      yield 1.1;
      for (const [x, y] of pts[1]) k.circle(x, y, 66, { warn: 0.9, dmg: 1.2, visual: 'hex' });
      yield 1.2;
    },
    *echo(k) {
      const e = k.e;
      const which = U.pick(['arka', 'zero', 'atlas']);
      k.banner(`에코: ${AZ.data.bosses[which].name}`, '기억된 전투 데이터 재현');
      k.anim('cast');
      k.sfx('summon');
      if (which === 'arka') {
        k.face();
        k.sector(e.x, e.y, 200, e.facing, 3.1, { warn: 0.75, dmg: 1.5, visual: 'echo' });
        yield 1.2;
      } else if (which === 'zero') {
        for (let i = 0; i < 3; i++) {
          const ang = k.face();
          const len = Math.min(k.dist() + 150, 480);
          k.line(e.x, e.y, ang, len, 56, { warn: 0.5, life: 0.22, dmg: 1.2, visual: 'echo' });
          yield 0.5;
          k.dash(ang, len, 0.22);
          yield 0.3;
        }
        yield 0.6;
      } else {
        k.circle(k.p.x, k.p.y, 145, { warn: 1.0, dmg: 1.9, kb: 300, visual: 'echo' });
        yield 1.0;
        k.shake(10);
        yield 0.8;
      }
    },
    *judgment(k) {
      const e = k.e;
      const dir = Math.random() < 0.5 ? 1 : -1;
      const a0 = k.ang();
      k.anim('charge');
      k.sfx('laser');
      for (let i = 0; i < 3; i++) {
        k.line(e.x, e.y, a0 + i * (U.TAU / 3), 850, 40, { warn: 0.9, life: 2.6, tick: 0.3, dmg: 0.9, follow: e,
          update: (h, W, dt) => { if (h.active) h.ang += dir * (1.7 / 2.6) * dt; } });
      }
      yield 3.4;
    },
    *transition(k) {
      k.anim('cast');
      k.sfx('glitch');
      k.ev({ type: 'glitch', t: 0.8 });
      k.banner('관리자 권한 집행', '프로토콜이 심판의 광선을 준비한다');
      yield 1.0;
    },
  };

  /* 10. ASTRA — 최종 형태 */
  BOSS_AI.astra = {
    rest: [0.6, 1.0],
    init(e, W) {
      e.x = W.w / 2;
      e.y = W.h * 0.36;
      e.z = 40;
      e.timers.freeze = W.t + 12;
      e.timers.finale = Infinity;
    },
    idle(k, dt) {
      const e = k.e;
      const W = k.W;
      const t = W.t * 0.3;
      moveToward(e, W.w / 2 + Math.cos(t) * 160, W.h * 0.38 + Math.sin(t * 1.3) * 90, e.speed, dt);
      e.facing = U.turnToward(e.facing, k.ang(), 2 * dt);
    },
    moves(k) {
      const W = k.W;
      const e = k.e;
      const m = [['halo', 2.5], ['starfall', 3], ['rings', 2.2], ['freeze', W.t >= e.timers.freeze ? 3 : 0]];
      if (k.phase >= 2) m.push(['zeroEcho', 2.2]);
      if (k.phase >= 3) m.push(['finale', W.t >= e.timers.finale ? 10 : 0]);
      return m;
    },
    *halo(k) {
      const e = k.e;
      const n = k.phase >= 2 ? 8 : 6;
      const dir = Math.random() < 0.5 ? 1 : -1;
      const a0 = k.ang() + Math.PI / n;
      k.anim('cast');
      k.sfx('laser');
      for (let i = 0; i < n; i++) {
        k.line(e.x, e.y, a0 + (i / n) * U.TAU, 950, 34, { warn: 1.0, life: 3.0, tick: 0.3, dmg: 0.8, follow: e, visual: 'halo',
          update: (h, W, dt) => { if (h.active) h.ang += dir * (1.25 / 3) * dt; } });
      }
      yield 3.8;
    },
    *starfall(k) {
      k.anim('cast');
      const n = k.phase >= 3 ? 18 : 14;
      for (let i = 0; i < n; i++) {
        k.circle(k.p.x + U.rand(-40, 40), k.p.y + U.rand(-40, 40), 78, { warn: 0.8, dmg: 1.1, visual: 'star' });
        yield 0.15;
      }
      yield 0.7;
    },
    *rings(k) {
      const e = k.e;
      k.anim('cast');
      const n = k.phase >= 2 ? 3 : 2;
      for (let i = 0; i < n; i++) {
        const h = k.ring(e.x, e.y, 60, 110, { warn: 0.6, life: 1.6, dmg: 1.2, visual: 'wave',
          update: (hh, W, dt) => { if (hh.active) { hh.r0 += 560 * dt; hh.r1 += 560 * dt; } } });
        h.follow = null;
        k.sfx('wave', { pitch: 0.7 });
        yield 0.7;
      }
      yield 1.2;
    },
    *freeze(k) {
      const W = k.W;
      const p = k.p;
      k.e.timers.freeze = W.t + (k.phase >= 3 ? 16 : 22);
      if (p.state === 'ult' || p.dead) { yield 0.2; return; }
      k.anim('cast');
      k.sfx('timeStop', { pitch: 0.6 });
      k.banner('ASTRA — 시간 정지', '시간이 다시 흐르는 순간 회피하라!');
      k.ev({ type: 'astraFreeze', t: 1.35 });
      p.state = 'locked';
      p.st = { t: 1.35 };
      p.anim = 'idle';
      const base = U.rand(0, U.TAU);
      for (let i = 0; i < 6; i++) {
        const a = base + (i / 6) * U.TAU;
        k.circle(p.x + Math.cos(a) * 120, p.y + Math.sin(a) * 120, 80, { warn: 1.35 + 0.6, dmg: 1.2, visual: 'star' });
      }
      k.circle(p.x, p.y, 90, { warn: 1.35 + 0.6, dmg: 1.4, visual: 'star' });
      yield 2.3;
    },
    *zeroEcho(k) {
      const p = k.p;
      k.anim('cast');
      k.sfx('teleport');
      const base = U.rand(0, U.TAU);
      for (let i = 0; i < 3; i++) {
        const a = base + i * (U.TAU / 3);
        k.line(p.x + Math.cos(a) * 330, p.y + Math.sin(a) * 330, a + Math.PI, 660, 52, { warn: 0.65 + i * 0.15, life: 0.2, dmg: 1.2, visual: 'afterimage' });
      }
      yield 1.4;
    },
    *finale(k) {
      const e = k.e;
      const W = k.W;
      e.timers.finale = W.t + 34;
      k.anim('charge');
      e.charging = 3.4;
      e.exposed = 3.4;
      k.sfx('alarm');
      k.banner('별의 종말', '피할 곳은 없다 — 카운트다운에 맞춰 회피!');
      k.bark('lia', 'zeroFrame');
      k.all(null, { warn: 3.4, dmg: 3.2, kb: 200, label: '별의 종말', visual: 'finale' });
      yield 3.4;
      e.charging = 0;
      k.sfx('bigExplosion');
      k.shake(24);
      k.ev({ type: 'flash', color: 'rgba(220,240,255,0.8)', t: 0.6 });
      yield 1.5;
    },
    onBreak(k) {
      if (k.e.charging > 0) {
        k.e.charging = 0;
        k.banner('별의 종말 저지', 'ASTRA 의 코어가 흔들린다', 'chance');
      }
    },
    *transition(k) {
      const e = k.e;
      k.anim('roar');
      k.sfx('roar', { pitch: 0.7 });
      k.ev({ type: 'glitch', t: 1.0 });
      if (k.phase >= 3) {
        k.banner('ZERO PROTOCOL', 'ASTRA 최종 프로세스 가동');
        e.timers.finale = k.W.t + 1.5;
      } else {
        k.banner('광륜 전개', 'ASTRA 가 진정한 모습을 드러낸다');
      }
      k.ring(e.x, e.y, 0, 320, { warn: 0.7, dmg: 0.8, kb: 420, visual: 'wave' });
      yield 1.4;
    },
  };

  /* ───────────── 일반 적 행동 ───────────── */
  const MINION_AI = {
    hound: {
      rest: [0.7, 1.3],
      idle(k, dt) { chase(k.W, k.e, dt, 60); },
      moves(k) { return [['lunge', k.dist() < 220 ? 5 : 0.3], ['circle', 1]]; },
      *lunge(k) {
        const e = k.e;
        const ang = k.face();
        const len = Math.min(k.dist() + 70, 260);
        k.anim('windup');
        k.line(e.x, e.y, ang, len, 44, { warn: 0.5, life: 0.2, dmg: 1 });
        yield 0.5;
        k.anim('dash');
        k.dash(ang, len, 0.2);
        yield 0.5;
      },
      *circle(k) {
        const t0 = k.W.t;
        while (k.W.t - t0 < 0.8) { strafe(k.W, k.e, 0.05, 140, 1.2); yield 0.05; }
      },
    },
    drone: {
      rest: [1.4, 2.2],
      idle(k, dt) { strafe(k.W, k.e, dt, 250, 0.9); },
      moves() { return [['shoot', 1]]; },
      *shoot(k) {
        const e = k.e;
        k.anim('charge');
        k.face();
        yield 0.4;
        k.bullet({ x: e.x, y: e.y, ang: k.ang(), speed: 400, r: 9, dmg: 1, life: 2.5, color: '#66e0ff', kind: 'orb' });
        k.sfx('shot', { vol: 0.25, pitch: 1.6 });
        yield 0.3;
      },
    },
    soldier: {
      rest: [1.2, 2.0],
      idle(k, dt) { strafe(k.W, k.e, dt, 320, 0.8); },
      moves() { return [['burst', 1]]; },
      *burst(k) {
        const e = k.e;
        const ang = k.face();
        k.anim('charge');
        k.line(e.x, e.y, ang, 650, 18, { warn: 0.75, life: 0.05, dmg: 0, visual: 'aim' });
        yield 0.75;
        for (let i = 0; i < 3; i++) {
          k.bullet({ x: e.x, y: e.y, ang: ang + U.rand(-0.05, 0.05), speed: 640, r: 8, dmg: 1, life: 1.4, color: '#9ab0ff', kind: 'shot' });
          k.sfx('shot', { vol: 0.2 });
          yield 0.1;
        }
        yield 0.3;
      },
    },
    guardBot: {
      rest: [1.2, 1.8],
      init: null,
      idle(k, dt) { chase(k.W, k.e, dt, 90); },
      moves(k) { return [['slam', k.dist() < 200 ? 4 : 0.5]]; },
      *slam(k) {
        const e = k.e;
        k.face();
        k.anim('windup');
        const fx = e.x + Math.cos(e.facing) * 50;
        const fy = e.y + Math.sin(e.facing) * 50;
        k.circle(fx, fy, 100, { warn: 0.8, dmg: 1 });
        yield 0.8;
        k.anim('attack');
        k.shake(5);
        k.sfx('stomp', { vol: 0.4 });
        yield 0.6;
      },
    },
    sniper: {
      rest: [2.0, 2.8],
      idle(k, dt) { strafe(k.W, k.e, dt, 460, 0.7); },
      moves() { return [['snipe', 1]]; },
      *snipe(k) {
        const e = k.e;
        k.anim('charge');
        k.line(e.x, e.y, k.ang(), 1200, 26, { warn: 1.3, life: 0.1, dmg: 1, follow: e, visual: 'snipe',
          update: (h, W, dt) => { if (!h.active && h.t < h.warn - 0.35) h.ang = U.angleTo(e.x, e.y, W.player.x, W.player.y); } });
        yield 1.3;
        k.sfx('railgun', { vol: 0.4 });
        yield 0.4;
      },
    },
    bomber: {
      rest: [0.2, 0.4],
      idle(k, dt) { chase(k.W, k.e, dt, 50, 1); },
      moves(k) { return [['explode', k.dist() < 100 ? 1 : 0]]; },
      *explode(k) {
        const e = k.e;
        k.anim('charge');
        k.circle(e.x, e.y, 95, { warn: 0.6, dmg: 1, follow: e });
        k.sfx('alarm', { vol: 0.25, pitch: 2 });
        yield 0.6;
        B().ev(k.W, { type: 'burst', x: e.x, y: e.y, z: 24, r: 110, color: '#ff9b3d' });
        k.sfx('explosion', { vol: 0.5 });
        e.dead = true;
        e.deadT = 0;
        yield 0.1;
      },
    },
    seraClone: {
      rest: [1.8, 2.6],
      idle(k, dt) { k.e.facing = U.turnToward(k.e.facing, k.ang(), 4 * dt); k.e.anim = 'idle'; },
      moves() { return [['cast', 1]]; },
      *cast(k) {
        const e = k.e;
        k.anim('cast');
        k.line(e.x, e.y, k.ang(), 560, 46, { warn: 0.85, life: 0.1, dmg: 1, visual: 'echo' });
        yield 1.0;
      },
    },
  };

  return { spawnBoss, spawnMinion, update, onBossDamaged, onBossBroken, onBossDeath, BOSS_AI, MINION_AI };
})();
