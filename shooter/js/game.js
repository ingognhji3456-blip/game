'use strict';

/* =========================================================
 * 하늘 사냥꾼 — 게임 엔진 (기계 보스 결전 · DOM 없음, Node 에서도 실행 가능)
 *
 *   const g = new SH.Game({ seed, emit(type, data) {} });
 *   g.input = { tx, ty, ax, ay, focus, bomb };   // 매 프레임 입력
 *   g.update(SH.DT);                             // 1/60 초씩 진행
 *
 * 진행: intro → warning → boss(싸움) → clear(점수 정산) → 승리
 * 보스: 포탑(부품) → 코어 열림 → 장갑 부서짐 → 폭주
 * 그리기·소리·효과는 emit 으로 받은 이벤트를 보고 따로 처리합니다.
 * ========================================================= */

(() => {
  const { W, H, TAU, clamp } = SH;
  const HALF_PI = Math.PI / 2;
  const INTRO = 2.2, WARNING = 3.0, CLEAR = 6.5;

  /* =========================================================
   * 보스 공격. src = { x, y, ang(포탑이 겨눈 방향), side(-1 왼쪽/1 오른쪽/0 가운데) }
   * k = 이번 공격에서 몇 번째 발사인지
   * ========================================================= */
  const ATTACKS = {
    ring(g, src, k, a) {
      const n = g._dens(a.n);
      const off = (a.rot || 0) * k + (a.rot ? 0 : g.rng() * TAU);
      for (let i = 0; i < n; i++) g._eShot(src.x, src.y, off + (i * TAU) / n, a.speed, a);
    },
    fan(g, src, k, a) {
      g._fan(src.x, src.y, src.ang != null ? src.ang : g._aim(src.x, src.y), g._dens(a.n), a.spread || 0.6, a.speed, a);
    },
    stream(g, src, k, a) {
      const base = src.ang != null ? src.ang : g._aim(src.x, src.y);
      g._eShot(src.x, src.y, base + (g.rng() - 0.5) * 2 * (a.jitter || 0), a.speed, a);
    },
    spiral(g, src, k, a) {
      const arms = a.arms || 3;
      for (let j = 0; j < arms; j++) {
        const base = (j * TAU) / arms;
        g._eShot(src.x, src.y, base + k * a.step, a.speed, a);
        if (a.both) g._eShot(src.x, src.y, base - k * a.step + TAU / arms / 2, a.speed * 0.85, a);
      }
    },
    curve(g, src, k, a) {
      const n = g._dens(a.n);
      const dir = k % 2 ? -1 : 1;
      const off = g.rng() * TAU;
      for (let i = 0; i < n; i++) g._eShot(src.x, src.y, off + (i * TAU) / n, a.speed, a, { curve: a.curve * dir, curveT: 1.6 });
    },
    rain(g, src, k, a) {
      for (let c = 0; c < (a.count || 1); c++) g._eShot(src.x, src.y, HALF_PI + (g.rng() * 2 - 1) * a.cone, a.speed * (0.7 + g.rng() * 0.5), a);
    },
    wall(g, src, k, a) {
      if (src.side > 0) return; // 양쪽에서 불려도 한 번만
      const gx = 70 + g.rng() * (W - 140);
      for (let x = 14; x < W; x += a.step || 28) {
        if (Math.abs(x - gx) < a.gap / 2) continue;
        g._eShot(x, -8, HALF_PI, a.speed, a);
      }
    },
    split(g, src, k, a) {
      const ang = a.aim ? g._aim(src.x, src.y) : HALF_PI + (g.rng() - 0.5) * 1.2;
      g._eShot(src.x, src.y, ang, a.speed, a, { big: true, split: { at: a.at || 1, n: a.sn || 10, speed: a.sspeed || 120, kind: a.skind || a.kind } });
    },
    missiles(g, src, k, a) {
      const n = a.n || 3;
      for (let i = 0; i < n; i++) {
        const ang = HALF_PI + (i - (n - 1) / 2) * 0.5 + (src.side || 0) * 0.3;
        g._missile(src.x, src.y, ang, a.speed);
      }
    },
    laser(g, src, k, a) {
      let a0, a1;
      if (a.aim) {
        const base = g._aim(src.x, src.y), dir = g.rng() < 0.5 ? -1 : 1;
        a0 = base - (dir * a.sweep) / 2;
        a1 = base + (dir * a.sweep) / 2;
      } else {
        const mir = a.mirror && src.side > 0;
        a0 = mir ? Math.PI - a.a0 : a.a0;
        a1 = mir ? Math.PI - a.a1 : a.a1;
      }
      g.beams.push({ ox: src.x - g.boss.x, oy: src.y - g.boss.y, a0, a1, warn: a.warn, dur: a.dur, width: a.width, t: 0, ang: a0, on: false });
      g.boss.hold = Math.max(g.boss.hold, a.warn + a.dur);
      if (src.side <= 0) g.emit('laserWarn', {});
    },
  };

  /* =========================================================
   * 게임
   * ========================================================= */
  class Game {
    constructor(o = {}) {
      this.seed = o.seed != null ? o.seed >>> 0 : (Date.now() >>> 0);
      this.rng = SH.rng(this.seed);
      this.emit = o.emit || (() => {});
      this.loop = o.loop || 0;
      this.god = !!o.god;

      this.score = 0;
      this.lives = 3;
      this.bombs = 3;
      this.continues = 0;
      this.weapon = o.weapon || 'spread';
      this.power = o.power || 1;
      this.extendIdx = 0;
      this.stats = { deaths: 0, bombs: 0, gems: 0, time: 0, missiles: 0 };

      this.input = { tx: null, ty: null, ax: 0, ay: 0, focus: false, bomb: false };
      this.player = {
        x: W / 2, y: H + 40, r: 3.5, inv: 0, shield: 0, dead: false, respawnT: 0,
        entering: true, enterT: 0, exiting: false, fireT: 0, missileT: 0, bank: 0, anchor: 0,
      };
      this.pb = []; // 내 탄
      this.eb = []; // 적 탄 (미사일 포함)
      this.beams = []; // 레이저
      this.items = [];
      this.time = 0;
      this.bombT = 0;
      this.bombTick = 0;
      this.boss = null;
      this.over = null; // 'gameover' | 'win'
      this.overT = 0;
      this.start();
    }

    /* ---------------- 진행 ---------------- */
    start() {
      this.def = SH.BOSS;
      this.bossDef = SH.BOSS;
      this.stage = SH.STAGE;
      this.stageIndex = 0;
      this._setPhase('intro');
      this.fightT = 0;
      this.boss = null;
      this.tally = null;
      this.eb.length = 0;
      this.pb.length = 0;
      this.beams.length = 0;
      this.deathsThisRun = 0;
      this._calcDiff();
      const p = this.player;
      if (!p.dead) {
        p.x = W / 2;
        p.y = H + 40;
        p.entering = true;
        p.enterT = 0;
        p.vy = 0;
      }
      p.exiting = false;
      p.inv = Math.max(p.inv, 1);
      this.emit('stageStart', { loop: this.loop, boss: this.def });
    }

    _calcDiff() {
      const L = this.loop;
      this.diff = { hp: 1 + 0.4 * L, speed: 1 + 0.12 * L, density: 1 + 0.25 * L };
    }

    /** 2회차 이상: 더 단단하고 더 빠른 보스와 다시 */
    nextLoop() {
      this.loop += 1;
      this.over = null;
      this.start();
    }

    continueGame() {
      if (this.over !== 'gameover') return;
      this.over = null;
      this.overT = 0;
      this.continues += 1;
      this.lives = 3;
      this.bombs = Math.max(this.bombs, 3);
      this._respawn();
      this.emit('continue', {});
    }

    /* ---------------- 한 틱 ---------------- */
    update(dt) {
      if (this.over) return;
      this.time += dt;
      this.phaseT += dt;
      this.stats.time += dt;
      if (this.boss && this.boss.state === 'fight') this.fightT += dt;

      this._updatePhase();
      this._updatePlayer(dt);
      this._updateBoss(dt);
      this._updateBullets(dt);
      this._updateBeams(dt);
      this._collide();
      this._updateItems(dt);

      if (this.bombT > 0) {
        this.bombT -= dt;
        this.bombTick -= dt;
        if (this.bombTick <= 0) {
          this.bombTick = 0.2;
          this._bombDamage(5);
        }
        if (this.eb.length) this._cancelBullets(true);
      }

      if (this.overT > 0) {
        this.overT -= dt;
        if (this.overT <= 0) {
          this.over = 'gameover';
          this.emit('gameOver', { score: this.score });
        }
      }
    }

    _updatePhase() {
      switch (this.phase) {
        case 'intro':
          if (this.phaseT >= INTRO) {
            this._setPhase('warning');
            this.emit('warning', { boss: this.def });
          }
          break;
        case 'warning':
          if (this.phaseT >= WARNING) {
            this._setPhase('boss');
            this._spawnBoss();
          }
          break;
        case 'boss':
          if (!this.boss) this._startClear();
          break;
        case 'clear':
          if (this.phaseT >= CLEAR - 1.6 && !this.player.dead) this.player.exiting = true;
          if (this.phaseT >= CLEAR) {
            this.over = 'win';
            this.emit('win', { score: this.score, loop: this.loop });
          }
          break;
        default:
      }
    }

    _setPhase(p) {
      this.phase = p;
      this.phaseT = 0;
    }

    _startClear() {
      this._setPhase('clear');
      const L = this.loop;
      const t = {
        clearBonus: 100000 * (1 + L),
        timeBonus: Math.max(0, Math.round((240 - this.fightT) * 500)) * (1 + L),
        noMiss: this.deathsThisRun === 0 ? 100000 * (1 + L) : 0,
        bombBonus: this.bombs * 10000,
        fightTime: this.fightT,
      };
      t.total = t.clearBonus + t.timeBonus + t.noMiss + t.bombBonus;
      this.tally = t;
      this._addScore(t.total);
      this.emit('stageClear', t);
    }

    /* ---------------- 보스 ---------------- */
    _spawnBoss() {
      const def = this.def, hp = Math.round(def.core.hp * this.diff.hp);
      const parts = {};
      for (const [id, p] of Object.entries(def.parts)) {
        const php = Math.round(p.hp * this.diff.hp);
        parts[id] = { id, ox: p.ox, oy: p.oy, r: p.r, hp: php, maxHp: php, alive: true, flash: 0, ang: HALF_PI, score: p.score };
      }
      this.boss = {
        x: W / 2, y: -150, hp, maxHp: hp, flash: 0, state: 'enter', st: 0,
        phase: 0, cur: null, order: 0, rest: 1.2, inv: 0, mt: 0, boomT: 0, hold: 0, parts,
      };
      this.emit('bossAppear', { boss: def });
    }

    get bossPhase() { return this.boss ? this.def.phases[this.boss.phase] : null; }

    _updateBoss(dt) {
      const e = this.boss;
      if (!e) return;
      const def = this.def;
      e.st += dt;
      if (e.flash > 0) e.flash -= dt;
      if (e.inv > 0) e.inv -= dt;
      for (const p of Object.values(e.parts)) {
        if (p.flash > 0) p.flash -= dt;
        // 포탑은 플레이어 쪽으로 천천히 돌아감
        const want = Math.atan2(this.player.y - (e.y + p.oy), this.player.x - (e.x + p.ox));
        let da = want - p.ang;
        while (da > Math.PI) da -= TAU;
        while (da < -Math.PI) da += TAU;
        p.ang += clamp(da, -2.2 * dt, 2.2 * dt);
        p.ang = clamp(p.ang, 0.25, Math.PI - 0.25);
      }

      if (e.state === 'enter') {
        const u = Math.min(1, e.st / 3);
        e.y = SH.lerp(-150, def.y, SH.easeOut(u));
        if (u >= 1) { e.state = 'fight'; e.st = 0; this.fightT = 0; this.emit('bossReady', {}); }
        return;
      }
      if (e.state === 'dying') {
        e.x += Math.sin(e.st * 40) * 0.8;
        e.y += 12 * dt;
        e.boomT -= dt;
        if (e.boomT <= 0) {
          e.boomT = 0.1;
          this.emit('bossBoom', { x: e.x + (this.rng() - 0.5) * def.hull.rx * 2, y: e.y + (this.rng() - 0.5) * def.hull.ry * 2 });
        }
        if (e.st >= 3.4) this._bossFinish();
        return;
      }

      // 움직임 (레이저를 쏘는 동안·나선 공격 중에는 가운데에 멈춤)
      const ph = def.phases[e.phase];
      e.mt += dt;
      if (e.hold > 0) e.hold -= dt;
      const still = e.hold > 0 || (e.cur && e.cur.def.still);
      const sway = def.sway * (ph.berserk ? 1.4 : 1);
      const tx = still ? e.x : W / 2 + Math.sin(e.mt * (ph.berserk ? 0.9 : 0.5)) * sway;
      const ty = def.y + Math.sin(e.mt * 1.1) * 10;
      const kk = Math.min(1, dt * 1.8);
      e.x += (tx - e.x) * kk;
      e.y += (ty - e.y) * kk;

      // 공격
      if (this.player.dead || e.inv > 0) return;
      if (e.cur) {
        const c = e.cur;
        c.acc += dt;
        while (c.acc >= c.def.every && c.k < c.def.times) {
          c.acc -= c.def.every;
          for (const src of this._sources(c.def.from)) ATTACKS[c.def.a](this, src, c.k, c.def);
          c.k += 1;
        }
        if (c.k >= c.def.times) {
          e.rest = c.def.rest != null ? c.def.rest : 0.8;
          e.cur = null;
        }
      } else {
        e.rest -= dt * (ph.berserk ? 1.5 : 1);
        if (e.rest <= 0) {
          let atk = ph.attacks[e.order % ph.attacks.length];
          e.order += 1;
          // 쏠 포탑이 없으면 건너뜀
          if (atk.from === 'parts' && !this._aliveParts().length) atk = ph.attacks[e.order++ % ph.attacks.length];
          e.cur = { def: atk, k: 0, acc: atk.every };
        }
      }
    }

    _aliveParts() { return this.boss ? Object.values(this.boss.parts).filter((p) => p.alive) : []; }

    /** 쏘는 곳 목록 */
    _sources(from) {
      const e = this.boss, c = this.def.core;
      if (from === 'parts') {
        return this._aliveParts().map((p) => ({
          x: e.x + p.ox + Math.cos(p.ang) * 22, y: e.y + p.oy + Math.sin(p.ang) * 22, ang: p.ang, side: Math.sign(p.ox),
        }));
      }
      if (from === 'sides') return [-1, 1].map((s) => ({ x: e.x + s * 48, y: e.y + 34, side: s }));
      return [{ x: e.x, y: e.y + c.oy + 26, side: 0 }];
    }

    _nextPhase() {
      const e = this.boss;
      e.phase += 1;
      e.cur = null;
      e.order = 0;
      e.rest = 1.8;
      e.inv = 1.6;
      e.hold = 0;
      this.beams.length = 0;
      this._cancelBullets(true);
      this._dropItem('power', e.x, e.y + 40);
      const ph = this.def.phases[e.phase];
      this.emit('bossPhase', { x: e.x, y: e.y, phase: e.phase, name: ph.name, berserk: !!ph.berserk });
    }

    _damageCore(dmg) {
      const e = this.boss;
      if (!e || e.state !== 'fight' || e.inv > 0) return false;
      const ph = this.def.phases[e.phase];
      if (ph.shield) return false;
      e.hp -= dmg;
      e.flash = 0.06;
      this._addScore(Math.round(dmg * 10));
      if (e.hp <= 0) { e.hp = 0; this._killBoss(); return true; }
      if (ph.until != null && e.hp <= e.maxHp * ph.until && e.phase < this.def.phases.length - 1) this._nextPhase();
      return true;
    }

    _damagePart(p, dmg) {
      const e = this.boss;
      if (!p.alive || e.state !== 'fight' || e.inv > 0) return;
      p.hp -= dmg;
      p.flash = 0.06;
      this._addScore(Math.round(dmg * 10));
      if (p.hp > 0) return;
      p.alive = false;
      const x = e.x + p.ox, y = e.y + p.oy;
      this._addScore(p.score * (1 + this.loop * 0.5));
      this.emit('partDestroyed', { x, y, id: p.id });
      this._dropItem('power', x, y);
      this._dropItem('bomb', x, y);
      const ph = this.def.phases[e.phase];
      if (ph.needParts && ph.needParts.every((id) => !e.parts[id].alive)) this._nextPhase();
    }

    _bombDamage(dmg) {
      const e = this.boss;
      if (!e) return;
      for (const p of this._aliveParts()) this._damagePart(p, dmg);
      this._damageCore(dmg);
    }

    _killBoss() {
      const e = this.boss;
      e.state = 'dying';
      e.st = 0;
      e.cur = null;
      this.beams.length = 0;
      this._addScore(this.def.score * (1 + this.loop * 0.5));
      this._cancelBullets(true);
      this.emit('bossDefeated', { x: e.x, y: e.y, name: this.def.name, time: this.fightT });
    }

    _bossFinish() {
      const e = this.boss;
      this.emit('bossDie', { x: e.x, y: e.y });
      this._cancelBullets(true);
      for (let i = 0; i < 36; i++) this._dropItem(i % 4 === 0 ? 'bigGem' : 'gem', e.x + (this.rng() - 0.5) * 160, e.y, 220);
      this.boss = null;
    }

    _dens(n) { return Math.max(1, Math.round(n * this.diff.density)); }

    _aim(x, y) {
      const p = this.player;
      return Math.atan2(p.y - y, p.x - x);
    }

    _fan(x, y, center, n, spread, speed, o) {
      if (n === 1) { this._eShot(x, y, center, speed, o); return; }
      for (let i = 0; i < n; i++) this._eShot(x, y, center - spread / 2 + (spread * i) / (n - 1), speed, o);
    }

    /** 적 탄 하나 쏘기 */
    _eShot(x, y, ang, speed, o, extra) {
      if (this.bombT > 0 || this.eb.length >= 700) return null;
      const sp = speed * this.diff.speed;
      const big = !!((extra && extra.big) || o.big);
      const b = {
        x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, r: big ? 10 : 5.5, kind: o.kind || 'pink', big, t: 0,
        curve: (extra && extra.curve) || o.curve || 0, curveT: (extra && extra.curveT) || 99,
        split: (extra && extra.split) || null,
      };
      this.eb.push(b);
      return b;
    }

    /** 쫓아오는 미사일 (내 탄으로 부술 수 있음) */
    _missile(x, y, ang, speed) {
      if (this.bombT > 0 || this.eb.length >= 700) return null;
      const sp = speed * this.diff.speed;
      const m = { x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, r: 6, kind: 'missile', missile: true, hp: 2, t: 0, speed: sp, rot: ang };
      this.eb.push(m);
      this.emit('enemyMissile', {});
      return m;
    }

    /* ---------------- 플레이어 ---------------- */
    _updatePlayer(dt) {
      const p = this.player, inp = this.input;
      if (p.inv > 0) p.inv -= dt;
      if (p.shield > 0) p.shield -= dt;

      if (p.dead) {
        p.respawnT -= dt;
        if (p.respawnT <= 0 && this.overT <= 0 && this.lives > 0) this._respawn();
        return;
      }
      if (p.entering) {
        p.enterT += dt;
        const u = Math.min(1, p.enterT / 0.9);
        p.y = SH.lerp(H + 40, H - 140, SH.easeOut(u));
        if (u >= 1) { p.entering = false; p.anchor += 1; }
        p.bank *= 0.8;
      } else if (p.exiting) {
        p.vy = (p.vy || 0) - 900 * dt;
        p.y += p.vy * dt;
        p.bank *= 0.8;
        return;
      } else {
        const ox = p.x;
        if (inp.tx != null) {
          const dx = inp.tx - p.x, dy = inp.ty - p.y;
          const d = Math.hypot(dx, dy), max = 1900 * dt;
          if (d <= max) { p.x = inp.tx; p.y = inp.ty; }
          else { p.x += (dx / d) * max; p.y += (dy / d) * max; }
        }
        if (inp.ax || inp.ay) {
          const sp = inp.focus ? 150 : 330;
          const len = Math.hypot(inp.ax, inp.ay) || 1;
          p.x += (inp.ax / len) * sp * dt;
          p.y += (inp.ay / len) * sp * dt;
        }
        p.x = clamp(p.x, 16, W - 16);
        p.y = clamp(p.y, 50, H - 26);
        const vx = (p.x - ox) / dt;
        p.bank += (clamp(vx / 260, -1, 1) - p.bank) * Math.min(1, dt * 12);
      }

      if (inp.bomb) {
        inp.bomb = false;
        this.useBomb();
      }
      this._fire(dt);
    }

    _fire(dt) {
      const p = this.player, L = this.power;
      p.fireT -= dt;
      if (p.fireT > 0) return;
      const w = this.weapon;
      const y = p.y - 22;
      if (w === 'spread') {
        p.fireT += 0.1;
        const straight = [[-6, 6], [-6, 6], [-9, 0, 9], [-9, 0, 9], [-12, -4, 4, 12]][L - 1];
        const angled = [[], [0.13], [0.15], [0.12, 0.26], [0.14, 0.28]][L - 1];
        for (const ox of straight) this._pShot(p.x + ox, y, -HALF_PI, 1150, 1, 'spread');
        for (const a of angled) {
          this._pShot(p.x - 8, y + 4, -HALF_PI - a, 1050, 1, 'spread');
          this._pShot(p.x + 8, y + 4, -HALF_PI + a, 1050, 1, 'spread');
        }
      } else if (w === 'laser') {
        p.fireT += 0.075;
        const b = this._pShot(p.x, y - 6, -HALF_PI, 1350, [1.65, 2.1, 2.55, 3.0, 3.45][L - 1], 'laser');
        b.hw = [5, 7, 9, 11, 13][L - 1];
        b.hh = 18;
        b.lv = L;
      } else {
        p.fireT += 0.1;
        const offs = L >= 3 ? [-8, 0, 8] : [-6, 6];
        for (const ox of offs) this._pShot(p.x + ox, y, -HALF_PI, 1150, 0.8, 'homing');
        p.missileT -= 0.1;
        if (p.missileT <= 0) {
          p.missileT = 0.45;
          const n = [1, 2, 2, 3, 4][L - 1];
          for (let i = 0; i < n; i++) {
            const side = i % 2 ? 1 : -1;
            const m = this._pShot(p.x + side * 14, p.y, -HALF_PI + side * (0.6 + 0.25 * Math.floor(i / 2)), 330, 2, 'missile');
            m.homing = true;
            m.life = 2.6;
            m.hw = 6; m.hh = 6;
          }
          this.emit('missile', {});
        }
      }
      if (p.fireT < -0.1) p.fireT = 0;
      this.emit('shoot', { weapon: w });
    }

    _pShot(x, y, ang, speed, dmg, kind) {
      const b = { x, y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, dmg, kind, hw: 5, hh: 9, rot: ang + HALF_PI, t: 0 };
      this.pb.push(b);
      return b;
    }

    useBomb() {
      const p = this.player;
      if (this.bombs <= 0 || p.dead || p.entering || p.exiting || this.bombT > 0 || this.over) return false;
      this.bombs -= 1;
      this.stats.bombs += 1;
      this.bombT = 2.2;
      this.bombTick = 0.2;
      p.inv = Math.max(p.inv, 2.6);
      this.beams.length = 0;
      this._cancelBullets(true);
      this._bombDamage(30);
      this.emit('bomb', { x: p.x, y: p.y });
      return true;
    }

    _hitPlayer() {
      const p = this.player;
      if (this.god || p.dead || p.inv > 0 || this.bombT > 0 || p.entering || p.exiting || this.over || this.overT > 0) return;
      if (p.shield > 0) {
        p.shield = 0;
        p.inv = 1.4;
        this._cancelBullets(true, p.x, p.y, 110);
        this.emit('shieldBreak', { x: p.x, y: p.y });
        return;
      }
      p.dead = true;
      p.respawnT = 1.4;
      this.lives -= 1;
      this.stats.deaths += 1;
      this.deathsThisRun += 1;
      this.power = Math.max(1, this.power - 1);
      this.emit('playerDie', { x: p.x, y: p.y });
      this._cancelBullets(false);
      this.beams.length = 0;
      if (this.lives <= 0) this.overT = 1.8;
    }

    _respawn() {
      const p = this.player;
      p.dead = false;
      p.x = W / 2;
      p.y = H + 40;
      p.entering = true;
      p.enterT = 0;
      p.exiting = false;
      p.inv = 3.2;
      p.bank = 0;
      this.bombs = Math.max(this.bombs, 2);
      this.emit('respawn', {});
    }

    /* ---------------- 탄 ---------------- */
    /** 유도 미사일이 노릴 곳: 살아 있는 포탑 → 코어 */
    _homingTarget(x, y) {
      const e = this.boss;
      if (!e || e.state !== 'fight') return null;
      let best = null, bd = Infinity;
      for (const p of this._aliveParts()) {
        const px = e.x + p.ox, py = e.y + p.oy;
        const d = (px - x) ** 2 + (py - y) ** 2;
        if (d < bd) { bd = d; best = [px, py]; }
      }
      return best || [e.x, e.y + this.def.core.oy];
    }

    _updateBullets(dt) {
      // 내 탄
      let j = 0;
      for (let i = 0; i < this.pb.length; i++) {
        const b = this.pb[i];
        b.t += dt;
        if (b.homing) {
          b.life -= dt;
          const tg = this._homingTarget(b.x, b.y);
          let sp = Math.hypot(b.vx, b.vy);
          sp = Math.min(560, sp + 700 * dt);
          let a = Math.atan2(b.vy, b.vx);
          if (tg && b.t > 0.08) {
            let da = Math.atan2(tg[1] - b.y, tg[0] - b.x) - a;
            while (da > Math.PI) da -= TAU;
            while (da < -Math.PI) da += TAU;
            a += clamp(da, -8 * dt, 8 * dt);
          }
          b.vx = Math.cos(a) * sp;
          b.vy = Math.sin(a) * sp;
          b.rot = a + HALF_PI;
          if (b.life <= 0) b.dead = true;
        }
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (b.dead || b.y < -40 || b.y > H + 40 || b.x < -40 || b.x > W + 40) continue;
        this.pb[j++] = b;
      }
      this.pb.length = j;

      // 적 탄
      j = 0;
      const n0 = this.eb.length;
      const pl = this.player;
      for (let i = 0; i < n0; i++) {
        const b = this.eb[i];
        b.t += dt;
        if (b.missile) {
          if (b.hp <= 0) continue;
          if (b.t < 3.2 && !pl.dead) {
            let a = Math.atan2(b.vy, b.vx);
            let da = Math.atan2(pl.y - b.y, pl.x - b.x) - a;
            while (da > Math.PI) da -= TAU;
            while (da < -Math.PI) da += TAU;
            a += clamp(da, -1.7 * dt, 1.7 * dt);
            b.vx = Math.cos(a) * b.speed;
            b.vy = Math.sin(a) * b.speed;
            b.rot = a;
          }
        } else if (b.curve && b.t < b.curveT) {
          const c = Math.cos(b.curve * dt), s = Math.sin(b.curve * dt);
          const vx = b.vx * c - b.vy * s;
          b.vy = b.vx * s + b.vy * c;
          b.vx = vx;
        }
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (b.split && b.t >= b.split.at) {
          const sp = b.split;
          const off = this.rng() * TAU;
          const n = this._dens(sp.n);
          for (let q = 0; q < n; q++) this._eShot(b.x, b.y, off + (q * TAU) / n, sp.speed, { kind: sp.kind });
          this.emit('split', { x: b.x, y: b.y });
          continue;
        }
        if (b.y < -40 || b.y > H + 30 || b.x < -30 || b.x > W + 30) continue;
        this.eb[j++] = b;
      }
      for (let i = n0; i < this.eb.length; i++) this.eb[j++] = this.eb[i];
      this.eb.length = j;
    }

    _updateBeams(dt) {
      const e = this.boss;
      let j = 0;
      for (const bm of this.beams) {
        bm.t += dt;
        if (!e || bm.t >= bm.warn + bm.dur) continue;
        if (bm.t >= bm.warn) {
          if (!bm.on) { bm.on = true; this.emit('laserFire', {}); }
          bm.ang = SH.lerp(bm.a0, bm.a1, SH.easeInOut((bm.t - bm.warn) / bm.dur));
        }
        bm.x = e.x + bm.ox;
        bm.y = e.y + bm.oy;
        this.beams[j++] = bm;
      }
      this.beams.length = j;
    }

    /** 적 탄 지우기. toSparks 이면 점수 반짝이로 바뀜. r 을 주면 그 반경 안만 */
    _cancelBullets(toSparks, cx, cy, r) {
      let j = 0;
      const pts = [];
      for (let i = 0; i < this.eb.length; i++) {
        const b = this.eb[i];
        if (r != null && (b.x - cx) ** 2 + (b.y - cy) ** 2 > r * r) { this.eb[j++] = b; continue; }
        if (toSparks && this.items.length < 500) this.items.push({ kind: 'spark', x: b.x, y: b.y, vx: 0, vy: 0, t: 0 });
        pts.push(b.x, b.y);
      }
      this.eb.length = j;
      if (pts.length) this.emit('cancel', { pts });
    }

    /* ---------------- 충돌 ---------------- */
    _collide() {
      const e = this.boss;
      const def = this.def;
      // 내 탄 → 미사일 · 포탑 · 코어 · 몸통(막힘)
      for (let i = 0; i < this.pb.length; i++) {
        const b = this.pb[i];
        if (b.dead) continue;
        // 미사일 격추
        for (let q = 0; q < this.eb.length; q++) {
          const m = this.eb[q];
          if (!m.missile || m.hp <= 0) continue;
          if (Math.abs(b.x - m.x) < b.hw + 7 && Math.abs(b.y - m.y) < b.hh + 7) {
            m.hp -= b.dmg;
            b.dead = true;
            if (m.hp <= 0) {
              this.stats.missiles += 1;
              this._addScore(300);
              this.emit('missileDown', { x: m.x, y: m.y });
            }
            break;
          }
        }
        if (b.dead || !e || e.state === 'enter' || e.state === 'dying') continue;
        // 포탑
        let hitSomething = false;
        for (const p of this._aliveParts()) {
          const px = e.x + p.ox, py = e.y + p.oy;
          if (Math.abs(b.x - px) < b.hw + p.r && Math.abs(b.y - py) < b.hh + p.r) {
            this._damagePart(p, b.dmg);
            this.emit('hit', { x: b.x, y: py + p.r * 0.5, kind: b.kind });
            hitSomething = true;
            break;
          }
        }
        if (!hitSomething) {
          const cx = e.x, cy = e.y + def.core.oy, cr = def.core.r;
          if (Math.abs(b.x - cx) < b.hw + cr && Math.abs(b.y - cy) < b.hh + cr) {
            const dealt = this._damageCore(b.dmg);
            this.emit('hit', { x: b.x, y: cy + cr * 0.6, kind: b.kind, armor: !dealt });
            hitSomething = true;
          } else {
            const nx = (b.x - e.x) / def.hull.rx, ny = (b.y - e.y) / def.hull.ry;
            if (nx * nx + ny * ny < 1) {
              this.emit('hit', { x: b.x, y: b.y, kind: b.kind, armor: true });
              hitSomething = true;
            }
          }
        }
        if (hitSomething) b.dead = true;
      }

      const p = this.player;
      if (p.dead || p.entering || p.exiting) return;
      // 적 탄 → 나
      for (let i = 0; i < this.eb.length; i++) {
        const b = this.eb[i];
        if (b.missile && b.hp <= 0) continue;
        const rr = b.r * 0.72 + p.r;
        if ((b.x - p.x) ** 2 + (b.y - p.y) ** 2 < rr * rr) {
          this._hitPlayer();
          return;
        }
      }
      // 레이저 → 나
      for (const bm of this.beams) {
        if (!bm.on) continue;
        const dx = p.x - bm.x, dy = p.y - bm.y;
        const ux = Math.cos(bm.ang), uy = Math.sin(bm.ang);
        const along = dx * ux + dy * uy;
        if (along < 0) continue;
        const perp = Math.abs(dx * uy - dy * ux);
        if (perp < bm.width / 2 + p.r) { this._hitPlayer(); return; }
      }
      // 보스 몸통 → 나
      if (e && e.state !== 'dying') {
        const nx = (p.x - e.x) / (def.hull.rx * 0.9), ny = (p.y - e.y) / (def.hull.ry * 0.9);
        if (nx * nx + ny * ny < 1) this._hitPlayer();
      }
    }

    /* ---------------- 아이템 ---------------- */
    _dropItem(kind, x, y, spread) {
      const sp = spread || 90;
      const it = { kind, x, y, vx: (this.rng() - 0.5) * sp, vy: -60 - this.rng() * sp, t: 0 };
      if (kind === 'power') {
        it.w0 = Math.floor(this.rng() * 3);
        it.wtype = SH.WEAPON_ORDER[it.w0];
        it.vx = (this.rng() < 0.5 ? -1 : 1) * 55;
        it.vy = -50;
      }
      this.items.push(it);
      return it;
    }

    _updateItems(dt) {
      const p = this.player;
      const canTake = !p.dead && !p.entering;
      const vacuum = canTake && (p.y < H * 0.26 || this.phase === 'clear');
      let j = 0;
      for (let i = 0; i < this.items.length; i++) {
        const it = this.items[i];
        it.t += dt;
        const dx = p.x - it.x, dy = p.y - it.y;
        const d = Math.hypot(dx, dy);
        if (it.kind === 'power') it.wtype = SH.WEAPON_ORDER[(it.w0 + Math.floor(it.t / 2.4)) % 3];

        if (canTake && (it.kind === 'spark' ? it.t > 0.15 : vacuum || d < (it.kind === 'gem' || it.kind === 'bigGem' ? 90 : 46))) {
          const sp = it.kind === 'spark' ? 300 + it.t * 900 : 560;
          if (d > 1) { it.x += (dx / d) * Math.min(d, sp * dt); it.y += (dy / d) * Math.min(d, sp * dt); }
        } else if (it.kind === 'spark') {
          if (it.t > 0.6) continue; // 플레이어가 없으면 그 자리에서 사라짐
        } else if (it.kind === 'power' && it.t < 10) {
          it.x += it.vx * dt;
          it.y += it.vy * dt;
          if (it.x < 18 || it.x > W - 18) { it.vx = -it.vx; it.x = clamp(it.x, 18, W - 18); }
          if (it.y > H * 0.72 && it.vy > 0) it.vy = -Math.abs(it.vy);
          if (it.y < 260 && it.vy < 0) it.vy = Math.abs(it.vy);
          if (it.t > 0.6) it.vy += (Math.sign(it.vy) * 50 - it.vy) * Math.min(1, dt * 2);
        } else {
          it.vy = Math.min(it.vy + 260 * dt, 85);
          it.vx *= 1 - Math.min(1, dt * 2);
          it.x += it.vx * dt;
          it.y += it.vy * dt;
          if (it.x < 10 || it.x > W - 10) { it.vx = -it.vx; it.x = clamp(it.x, 10, W - 10); }
        }
        if (canTake && Math.hypot(p.x - it.x, p.y - it.y) < 24) { this._takeItem(it); continue; }
        if (it.y > H + 30 || it.y < -60) continue;
        this.items[j++] = it;
      }
      this.items.length = j;
    }

    _takeItem(it) {
      switch (it.kind) {
        case 'spark': this._addScore(10); this.emit('spark', {}); return;
        case 'gem': this._addScore(100 * (1 + this.loop)); this.stats.gems += 1; this.emit('gem', { x: it.x, y: it.y }); return;
        case 'bigGem': this._addScore(1000 * (1 + this.loop)); this.stats.gems += 1; this.emit('gem', { x: it.x, y: it.y, big: true }); return;
        case 'power': {
          const maxed = this.power >= SH.MAX_POWER && this.weapon === it.wtype;
          const changed = this.weapon !== it.wtype;
          this.weapon = it.wtype;
          if (this.power < SH.MAX_POWER) this.power += 1;
          if (maxed) this._addScore(5000);
          this.emit('power', { x: it.x, y: it.y, weapon: this.weapon, level: this.power, changed, maxed });
          return;
        }
        case 'bomb':
          if (this.bombs < SH.MAX_BOMBS) this.bombs += 1;
          else this._addScore(3000);
          this.emit('item', { x: it.x, y: it.y, kind: 'bomb' });
          return;
        case 'life':
          if (this.lives < SH.MAX_LIVES) this.lives += 1;
          else this._addScore(10000);
          this.emit('extend', { x: it.x, y: it.y });
          return;
        case 'shield':
          this.player.shield = 12;
          this.emit('item', { x: it.x, y: it.y, kind: 'shield' });
          return;
        default:
      }
    }

    _addScore(n) {
      this.score += Math.round(n);
      while (this.score >= SH.extendAt(this.extendIdx)) {
        this.extendIdx += 1;
        if (this.lives < SH.MAX_LIVES) this.lives += 1;
        this.emit('extend', { x: this.player.x, y: this.player.y, score: true });
      }
    }
  }

  SH.Game = Game;
  SH.ATTACKS = ATTACKS;
})();
