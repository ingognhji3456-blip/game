'use strict';

/* =========================================================
 * 하늘 사냥꾼 — 게임 엔진 (기계 요새 결전 · 가로 화면 960×540 · DOM 없음, Node 에서도 실행 가능)
 *
 *   const g = new SH.Game({ seed, emit(type, data) {} });
 *   g.input = { tx, ty, ax, ay, focus, bomb };   // 매 프레임 입력
 *   g.update(SH.DT);                             // 1/60 초씩 진행
 *
 * 진행: intro → warning → boss(싸움) → clear(점수 정산) → 승리
 * 보스의 공격은 js/boss.js 의 패턴(제너레이터)이 "조준 → 충전 → 발사" 순서로 무기를 움직여 만듭니다.
 * 그리기·소리·효과는 emit 으로 받은 이벤트를 보고 따로 처리합니다.
 * ========================================================= */

(() => {
  const { W, H, TAU, clamp } = SH;
  const HALF_PI = Math.PI / 2;
  const INTRO = 2.2, WARNING = 3.0, CLEAR = 6.5;
  const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return d; };

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
      this.stats = { deaths: 0, bombs: 0, gems: 0, time: 0, missiles: 0, guns: 0, patterns: {} };

      this.input = { tx: null, ty: null, ax: 0, ay: 0, focus: false, bomb: false };
      this.player = {
        x: W / 2, y: H + 40, r: 3.5, inv: 0, shield: 0, dead: false, respawnT: 0,
        entering: true, enterT: 0, exiting: false, fireT: 0, missileT: 0, bank: 0, anchor: 0,
      };
      this.pb = []; // 내 탄
      this.eb = []; // 적 탄 (미사일 포함)
      this.beams = []; // 레이저 (총구를 따라다님)
      this.guns = []; // 벽 레이저포
      this.tasks = []; // 돌아가는 패턴들
      this.items = [];
      this.time = 0;
      this.bombT = 0;
      this.bombTick = 0;
      this.B = null;
      this.over = null; // 'gameover' | 'win'
      this.overT = 0;
      this.start();
    }

    get boss() { return this.B; }
    get def() { return SH.BOSS; }
    get bossDef() { return SH.BOSS; }
    get bossPhase() { return this.B ? SH.BOSS.phases[this.B.phase] : null; }

    /* ---------------- 진행 ---------------- */
    start() {
      this.stage = SH.STAGE;
      this.stageIndex = 0;
      this._setPhase('intro');
      this.fightT = 0;
      this.B = null;
      this.tally = null;
      this.eb.length = 0;
      this.pb.length = 0;
      this.beams.length = 0;
      this.guns.length = 0;
      this.tasks.length = 0;
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
      // 가로 화면이라 보스와 나 사이가 가까워서 탄을 조금 느리게
      this.diff = { hp: 1 + 0.4 * L, speed: 0.86 + 0.1 * L, tempo: 1 + 0.15 * L };
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
      if (this.B && this.B.state === 'fight') this.fightT += dt;

      this._updatePhase();
      this._updatePlayer(dt);
      this._updateBoss(dt);
      this._runTasks(dt * (this.B && this.bossPhase.berserk ? 1.12 : 1) * this.diff.tempo);
      this._updateWeapons(dt);
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
        this.beams.length = 0;
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
          if (!this.B) this._startClear();
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

    /* =========================================================
     * 보스
     * ========================================================= */
    _spawnBoss() {
      const def = this.def, hp = Math.round(def.core.hp * this.diff.hp);
      const w = {};
      const mk = (name, d) => ({
        name, kind: d.kind, ox: d.ox, oy: d.oy, len: d.len || 0, unlock: d.unlock || 0, lose: d.lose,
        hp: d.hp ? Math.round(d.hp * this.diff.hp) : 0, maxHp: d.hp ? Math.round(d.hp * this.diff.hp) : 0, score: d.score || 0,
        alive: (d.unlock || 0) === 0, reveal: 1, ang: HALF_PI, target: null, turn: 0,
        state: 'idle', charge: 0, chargeDur: 1, recoil: 0, open: 0, flash: 0, sweep: null, big: false,
      });
      for (const [name, d] of Object.entries(def.weapons)) w[name] = mk(name, d);
      w.core = mk('core', { kind: 'core', ox: def.core.ox, oy: def.core.oy, len: 0 });
      this.B = {
        x: W / 2, y: -160, hp, maxHp: hp, flash: 0, state: 'enter', st: 0,
        phase: 0, look: 0, hold: 0, mt: 0, boomT: 0, inv: 0, rest: 1.2, recent: [], task: null, w,
      };
      this.emit('bossAppear', { boss: def });
    }

    W(name) { return this.B.w[name]; }
    /** 지금 쓸 수 있는 무기인가 (나왔고, 안 부서졌고, 다 나왔는지) */
    avail(name) {
      const w = this.B && this.B.w[name];
      if (!w || !w.alive || w.reveal < 1) return false;
      const ph = this.B.phase;
      return ph >= w.unlock && (w.lose == null || ph < w.lose);
    }
    wpos(w) {
      if (w.kind === 'gun') return [w.x, w.y];
      return [this.B.x + w.ox, this.B.y + w.oy];
    }
    /** 총구 끝 (반동만큼 살짝 들어감) */
    muzzle(w) {
      const [x, y] = this.wpos(w);
      const len = w.len * (1 - 0.25 * w.recoil);
      return [x + Math.cos(w.ang) * len, y + Math.sin(w.ang) * len];
    }
    aim(w, turn) { w.state = 'aim'; w.target = 'player'; w.turn = turn; }
    point(w, ang, turn) { w.state = 'aim'; w.target = ang; w.turn = turn; }
    charge(w, t) {
      w.state = 'charge';
      w.charge = 0;
      w.chargeDur = t;
      const [x, y] = this.muzzle(w);
      this.emit('charge', { x, y, kind: w.kind, big: w.big });
    }
    idle(w) { w.state = 'idle'; w.target = null; w.charge = 0; w.sweep = null; }
    hold(t) { if (this.B) this.B.hold = Math.max(this.B.hold, t); }

    /** 무기 총구에서 탄 하나. o.abs 면 각도를 그대로, 아니면 무기가 겨눈 방향 + 각도차 */
    orb(w, dAng, speed, kind, o) {
      o = o || {};
      const [x, y] = this.muzzle(w);
      const ang = o.abs ? dAng : w.ang + dAng;
      w.recoil = 1;
      if (!o.quiet) this.emit('muzzle', { x, y, kind });
      return this.orbAt(x, y, ang, speed, kind, o);
    }
    orbAt(x, y, ang, speed, kind, o) {
      if (this.bombT > 0 || this.eb.length >= 700) return null;
      o = o || {};
      const sp = speed * this.diff.speed;
      const b = {
        x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, r: o.big ? 10 : 5.5, kind: kind || 'pink', big: !!o.big, t: 0,
        curve: o.curve || 0, curveT: o.curveT || 99, split: o.split || null,
      };
      this.eb.push(b);
      return b;
    }
    /** 쫓아오는 미사일 (내 탄으로 부술 수 있음) */
    missileFrom(w, ang, speed) {
      const [x, y] = this.muzzle(w);
      w.recoil = 1;
      if (this.bombT > 0 || this.eb.length >= 700) return null;
      const sp = speed * this.diff.speed;
      const m = { x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, r: 6, kind: 'missile', missile: true, hp: 2, t: 0, speed: sp, rot: ang };
      this.eb.push(m);
      this.emit('enemyMissile', { x, y });
      return m;
    }
    /** 레이저: 무기 총구에서 나가고, 무기가 돌면 같이 돔. from/to 를 주면 그 사이를 쓸어냄 */
    beam(w, o) {
      const bm = { src: w, width: o.width, dur: o.dur, t: 0, from: o.from, to: o.to, ang: o.from != null ? o.from : w.ang, x: 0, y: 0, on: true };
      [bm.x, bm.y] = this.muzzle(w);
      w.state = 'fire';
      this.beams.push(bm);
      this.emit('laserFire', { big: o.width > 30 });
      return bm;
    }
    /** 패턴 하나를 따로 돌림 (동시에 여러 개 가능) */
    run(gen, owner, tag) {
      const t = { it: gen, wait: 0, owner: owner || null, tag: tag || 'boss', done: false };
      this.tasks.push(t);
      return t;
    }

    /* ---------------- 벽 레이저포 ---------------- */
    /** edge: L R (옆 벽, pos = 높이) · BL BR (아래 구석) */
    gun(edge, pos, plan) {
      const hp = Math.round(26 * this.diff.hp);
      const g = {
        kind: 'gun', edge, pos, slide: 0, x: -50, y: -50, len: 15, hp, maxHp: hp, alive: true, gone: false, flash: 0,
        ang: { L: 0, R: Math.PI, BL: -Math.PI / 4, BR: (-3 * Math.PI) / 4 }[edge], target: null, turn: 0,
        state: 'in', charge: 0, chargeDur: 1, recoil: 0, fixed: plan.fixed,
      };
      this._placeGun(g);
      this.guns.push(g);
      g.task = this.run(this._gunLife(g, plan), g, 'gun');
      return g;
    }
    _placeGun(g) {
      const s = SH.easeOut(g.slide);
      if (g.edge === 'L') { g.x = SH.lerp(-28, 17, s); g.y = g.pos; }
      else if (g.edge === 'R') { g.x = SH.lerp(W + 28, W - 17, s); g.y = g.pos; }
      else if (g.edge === 'BL') { g.x = SH.lerp(-30, 26, s); g.y = SH.lerp(H + 30, H - 96, s); }
      else { g.x = SH.lerp(W + 30, W - 26, s); g.y = SH.lerp(H + 30, H - 96, s); }
    }
    *_gunLife(g, plan) {
      this.emit('gunIn', { x: g.x, y: g.y });
      const st = plan.slide || 0.45;
      while (g.slide < 1) { g.slide = Math.min(1, g.slide + SH.DT / st); yield; }
      if (plan.fixed != null) this.point(g, plan.fixed, 6);
      else this.aim(g, 3);
      yield plan.aim;
      if (plan.fixed == null) g.turn = 0.35;
      this.charge(g, plan.charge);
      yield plan.charge;
      if (plan.fixed == null) g.target = null; // 쏘는 동안은 방향 고정
      g.state = 'fire';
      yield* plan.fire(this, g);
      this.idle(g);
      yield 0.2;
      yield* this._gunOut(g);
    }
    *_gunOut(g) {
      g.state = 'out';
      while (g.slide > 0) { g.slide = Math.max(0, g.slide - SH.DT / 0.4); yield; }
      g.gone = true;
    }
    /** 모든 벽 레이저포를 들여보냄 */
    _recallGuns() {
      for (const g of this.guns) {
        if (g.gone) continue;
        if (g.task) g.task.done = true;
        g.task = this.run(this._gunOut(g), g, 'gun');
      }
      this.beams = this.beams.filter((b) => b.src.kind !== 'gun');
    }

    /* ---------------- 패턴 돌리기 ---------------- */
    _runTasks(dt) {
      for (const t of this.tasks) {
        if (t.done) continue;
        if (t.owner && (t.owner.gone || t.owner.alive === false)) { t.done = true; continue; }
        t.wait -= dt;
        let guard = 0;
        while (t.wait <= 0 && !t.done && guard++ < 40) {
          const r = t.it.next();
          if (r.done) { t.done = true; break; }
          t.wait += r.value == null ? SH.DT : r.value;
        }
      }
      if (this.tasks.some((t) => t.done)) this.tasks = this.tasks.filter((t) => !t.done);
      if (this.guns.some((g) => g.gone)) this.guns = this.guns.filter((g) => !g.gone);
    }

    /** 다음 패턴 고르기: 무게대로 뽑되, 바로 전 두 개는 빼고, 쓸 무기가 없는 것도 뺌 */
    _pickPattern() {
      const B = this.B, ph = this.bossPhase;
      const ok = (n) => !(SH.BOSS_NEEDS[n] || []).length || SH.BOSS_NEEDS[n].some((w) => this.avail(w));
      let list = Object.entries(ph.pool).filter(([n]) => ok(n) && !B.recent.includes(n));
      if (!list.length) list = Object.entries(ph.pool).filter(([n]) => ok(n));
      const total = list.reduce((s, [, w]) => s + w, 0);
      let r = this.rng() * total;
      let name = list[0][0];
      for (const [n, w] of list) { r -= w; if (r <= 0) { name = n; break; } }
      B.recent.push(name);
      if (B.recent.length > 2) B.recent.shift();
      this.stats.patterns[name] = (this.stats.patterns[name] || 0) + 1;
      return name;
    }

    _updateBoss(dt) {
      const B = this.B;
      if (!B) return;
      const def = this.def;
      B.st += dt;
      if (B.flash > 0) B.flash -= dt;
      if (B.flashCd > 0) B.flashCd -= dt;
      if (B.inv > 0 && B.state === 'fight') B.inv -= dt;

      if (B.state === 'enter') {
        const u = Math.min(1, B.st / 3);
        B.y = SH.lerp(-160, def.y, SH.easeOut(u));
        if (u >= 1) {
          B.state = 'fight';
          B.st = 0;
          this.fightT = 0;
          this.emit('bossReady', { hint: def.phases[0].hint });
        }
        return;
      }
      if (B.state === 'dying') {
        B.x += Math.sin(B.st * 40) * 0.8;
        B.y += 12 * dt;
        B.boomT -= dt;
        if (B.boomT <= 0) {
          B.boomT = 0.1;
          this.emit('bossBoom', { x: B.x + (this.rng() - 0.5) * def.hull.rx * 2, y: B.y + (this.rng() - 0.5) * def.hull.ry * 2 });
        }
        if (B.st >= 3.4) this._bossFinish();
        return;
      }

      // 움직임 (충전·레이저·나선 중에는 멈춤)
      const ph = this.bossPhase;
      B.mt += dt;
      if (B.hold > 0) B.hold -= dt;
      const still = B.hold > 0 || B.state === 'transform';
      const sway = def.sway * (ph.berserk ? 1.35 : 1);
      const tx = still ? B.x : W / 2 + Math.sin(B.mt * (ph.berserk ? 0.85 : 0.5)) * sway;
      const ty = def.y + Math.sin(B.mt * 1.1) * 8;
      const kk = Math.min(1, dt * 1.6);
      B.x += (tx - B.x) * kk;
      B.y += (ty - B.y) * kk;

      if (B.state !== 'fight') return;
      // 다음 패턴
      if (B.task && !B.task.done) return;
      if (this.player.dead) return;
      B.rest -= dt;
      if (B.rest > 0) return;
      const name = this._pickPattern();
      B.task = this.run(SH.BOSS_PATTERNS[name](this), null, 'boss');
      B.pattern = name;
      B.rest = ph.rest + this.rng() * 0.4;
      this.emit('pattern', { name });
    }

    /** 무기 움직임: 겨누기(회전), 반동, 충전, 뚜껑 */
    _updateWeapons(dt) {
      const all = this.B ? Object.values(this.B.w).concat(this.guns) : this.guns;
      const p = this.player;
      for (const w of all) {
        if (w.flash > 0) w.flash -= dt;
        if (w.flashCd > 0) w.flashCd -= dt;
        if (w.recoil > 0) w.recoil = Math.max(0, w.recoil - dt * 6);
        if (w.reveal < 1) w.reveal = Math.min(1, w.reveal + dt / 0.8);
        if (w.state === 'charge') w.charge = Math.min(1, w.charge + dt / w.chargeDur);
        if (w.kind === 'pod') {
          if (w.state === 'open') w.open = Math.min(1, w.open + dt / 0.35);
          else w.open = Math.max(0, w.open - dt / 0.35);
        }
        if (w.kind === 'gun') this._placeGun(w);
        if (w.target != null) {
          const [x, y] = this.wpos(w);
          const want = w.target === 'player' ? Math.atan2(p.y - y, p.x - x) : w.target;
          w.ang += clamp(angDiff(w.ang, want), -w.turn * dt, w.turn * dt);
        }
        if (w.kind === 'turret' || w.kind === 'cannon') w.ang = clamp(w.ang, 0.2, Math.PI - 0.2);
      }
    }

    /** 단계 넘어가기: 공격을 멈추고, 부서지며 모습이 바뀌고, 새 무기를 꺼냄 */
    _nextPhase() {
      const B = this.B;
      const next = B.phase + 1;
      B.phase = next;
      B.inv = 99;
      B.state = 'transform';
      B.recent = [];
      for (const t of this.tasks) if (t.tag === 'boss' || t.tag === 'transform') t.done = true;
      for (const w of Object.values(B.w)) this.idle(w);
      B.task = null;
      B.rest = 1.0;
      this._recallGuns();
      this.beams.length = 0;
      this._cancelBullets(true);
      this._dropItem('power', B.x, B.y + 40);
      const ph = this.def.phases[next];
      this.emit('bossPhase', { x: B.x, y: B.y, phase: next, name: ph.name, unlock: ph.unlock, hint: ph.hint, berserk: !!ph.berserk });
      this.run(SH.bossTransform(this, next), null, 'transform');
    }

    /** 맞으면 잠깐 하얗게 (계속 맞아도 깜빡이도록 간격을 둠) */
    _flash(o) {
      if (o.flashCd > 0) return;
      o.flash = 0.05;
      o.flashCd = 0.16;
    }

    _damageCore(dmg) {
      const B = this.B;
      if (!B || B.state !== 'fight' || B.inv > 0) return false;
      const ph = this.bossPhase;
      if (ph.shield) return false;
      B.hp -= dmg;
      this._flash(B);
      this._addScore(Math.round(dmg * 10));
      if (B.hp <= 0) { B.hp = 0; this._killBoss(); return true; }
      if (ph.until != null && B.hp <= B.maxHp * ph.until && B.phase < this.def.phases.length - 1) this._nextPhase();
      return true;
    }

    _damageWeapon(w, dmg) {
      const B = this.B;
      if (!w.alive || !w.maxHp) return;
      if (w.kind !== 'gun' && (B.state !== 'fight' || B.inv > 0)) return;
      w.hp -= dmg;
      this._flash(w);
      this._addScore(Math.round(dmg * 10));
      if (w.hp > 0) return;
      w.alive = false;
      const [x, y] = this.wpos(w);
      if (w.kind === 'gun') {
        w.gone = true;
        this.stats.guns += 1;
        this._addScore(2000 * (1 + this.loop));
        this.emit('gunDown', { x, y });
        this.beams = this.beams.filter((b) => b.src !== w);
        if (this.rng() < 0.25) this._dropItem('gem', x, y);
        return;
      }
      this._addScore(w.score * (1 + this.loop * 0.5));
      this.emit('partDestroyed', { x, y, id: w.name });
      this.beams = this.beams.filter((b) => b.src !== w);
      this._dropItem('power', x, y);
      this._dropItem('bomb', x, y);
      const ph = this.bossPhase;
      if (ph.needParts && ph.needParts.every((id) => !B.w[id].alive)) this._nextPhase();
    }

    _bombDamage(dmg) {
      const B = this.B;
      for (const g of this.guns) if (g.alive && g.slide > 0.5) this._damageWeapon(g, dmg * 3);
      if (!B) return;
      for (const n of ['turretL', 'turretR']) if (this.avail(n)) this._damageWeapon(B.w[n], dmg);
      this._damageCore(dmg);
    }

    _killBoss() {
      const B = this.B;
      B.state = 'dying';
      B.st = 0;
      for (const t of this.tasks) t.done = true;
      for (const w of Object.values(B.w)) this.idle(w);
      this._recallGuns();
      this.beams.length = 0;
      this._addScore(this.def.score * (1 + this.loop * 0.5));
      this._cancelBullets(true);
      this.emit('bossDefeated', { x: B.x, y: B.y, name: this.def.name, time: this.fightT });
    }

    _bossFinish() {
      const B = this.B;
      this.emit('bossDie', { x: B.x, y: B.y });
      this._cancelBullets(true);
      for (let i = 0; i < 36; i++) this._dropItem(i % 4 === 0 ? 'bigGem' : 'gem', B.x + (this.rng() - 0.5) * 160, B.y, 220);
      this.B = null;
    }

    _aim(x, y) {
      const p = this.player;
      return Math.atan2(p.y - y, p.x - x);
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
        p.y = SH.lerp(H + 40, H - 90, SH.easeOut(u));
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
        p.x = clamp(p.x, 46, W - 46);
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
    /** 내 유도 미사일이 노릴 곳: 벽 레이저포 → 포탑 → 코어 */
    _homingTarget(x, y) {
      let best = null, bd = Infinity;
      const consider = (px, py) => { const d = (px - x) ** 2 + (py - y) ** 2; if (d < bd) { bd = d; best = [px, py]; } };
      for (const g of this.guns) if (g.alive && g.slide > 0.6) consider(g.x, g.y);
      if (best) return best;
      const B = this.B;
      if (!B || B.state === 'enter' || B.state === 'dying') return null;
      for (const n of ['turretL', 'turretR']) if (this.avail(n)) consider(...this.wpos(B.w[n]));
      return best || [B.x, B.y + this.def.core.oy];
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
          if (tg && b.t > 0.08) a += clamp(angDiff(a, Math.atan2(tg[1] - b.y, tg[0] - b.x)), -8 * dt, 8 * dt);
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
          if (b.t > 0.35 && b.t < 3.6 && !pl.dead) {
            let a = Math.atan2(b.vy, b.vx);
            a += clamp(angDiff(a, Math.atan2(pl.y - b.y, pl.x - b.x)), -1.9 * dt, 1.9 * dt);
            b.vx = Math.cos(a) * b.speed;
            b.vy = Math.sin(a) * b.speed;
          }
          b.rot = Math.atan2(b.vy, b.vx);
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
          for (let q = 0; q < sp.n; q++) this.orbAt(b.x, b.y, off + (q * TAU) / sp.n, sp.speed, sp.kind);
          this.emit('split', { x: b.x, y: b.y });
          continue;
        }
        if (b.y < -60 || b.y > H + 30 || b.x < -30 || b.x > W + 30) continue;
        this.eb[j++] = b;
      }
      for (let i = n0; i < this.eb.length; i++) this.eb[j++] = this.eb[i];
      this.eb.length = j;
    }

    _updateBeams(dt) {
      let j = 0;
      for (const bm of this.beams) {
        bm.t += dt;
        const src = bm.src;
        if (bm.t >= bm.dur || !src || src.gone || src.alive === false || (src.kind !== 'gun' && !this.B)) {
          if (src && src.state === 'fire') src.state = 'cool';
          continue;
        }
        if (bm.from != null) {
          bm.ang = SH.lerp(bm.from, bm.to, SH.easeInOut(bm.t / bm.dur));
          src.ang = bm.ang;
        } else bm.ang = src.ang;
        [bm.x, bm.y] = this.muzzle(src);
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
      const B = this.B;
      const def = this.def;
      // 내 탄 → 미사일 · 벽 레이저포 · 포탑 · 코어 · 몸통(막힘)
      for (let i = 0; i < this.pb.length; i++) {
        const b = this.pb[i];
        if (b.dead) continue;
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
        if (b.dead) continue;
        for (const g of this.guns) {
          if (!g.alive || g.slide < 0.5) continue;
          if (Math.abs(b.x - g.x) < b.hw + 13 && Math.abs(b.y - g.y) < b.hh + 13) {
            this._damageWeapon(g, b.dmg);
            this.emit('hit', { x: b.x, y: g.y + 8, kind: b.kind });
            b.dead = true;
            break;
          }
        }
        if (b.dead || !B || B.state === 'enter' || B.state === 'dying') continue;
        let hit = false;
        for (const n of ['turretL', 'turretR']) {
          if (!this.avail(n)) continue;
          const w = B.w[n];
          const [px, py] = this.wpos(w);
          if (Math.abs(b.x - px) < b.hw + 26 && Math.abs(b.y - py) < b.hh + 26) {
            this._damageWeapon(w, b.dmg);
            this.emit('hit', { x: b.x, y: py + 13, kind: b.kind, armor: B.state !== 'fight' });
            hit = true;
            break;
          }
        }
        if (!hit) {
          // 코어를 향해 곧장 올라가는 탄은 앞 장갑 틈으로 코어까지 닿음
          const cx = B.x + def.core.ox, cy = B.y + def.core.oy, cr = def.core.r;
          if (Math.abs(b.x - cx) < b.hw + cr && b.y < cy + def.hull.ry + 10 && b.y > cy - cr - b.hh) {
            const dealt = this._damageCore(b.dmg);
            this.emit('hit', { x: b.x, y: cy + cr * 0.6, kind: b.kind, armor: !dealt });
            hit = true;
          } else {
            const nx = (b.x - B.x) / def.hull.rx, ny = (b.y - B.y) / def.hull.ry;
            if (nx * nx + ny * ny < 1) {
              this.emit('hit', { x: b.x, y: b.y, kind: b.kind, armor: true });
              hit = true;
            }
          }
        }
        if (hit) b.dead = true;
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
        const dx = p.x - bm.x, dy = p.y - bm.y;
        const ux = Math.cos(bm.ang), uy = Math.sin(bm.ang);
        if (dx * ux + dy * uy < 0) continue;
        if (Math.abs(dx * uy - dy * ux) < bm.width / 2 + p.r) { this._hitPlayer(); return; }
      }
      // 보스 몸통 → 나
      if (B && B.state !== 'dying') {
        const nx = (p.x - B.x) / (def.hull.rx * 0.9), ny = (p.y - B.y) / (def.hull.ry * 0.9);
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
      const vacuum = canTake && this.phase === 'clear';
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
          if (it.x < 40 || it.x > W - 40) { it.vx = -it.vx; it.x = clamp(it.x, 40, W - 40); }
          if (it.y > H * 0.88 && it.vy > 0) it.vy = -Math.abs(it.vy);
          if (it.y < H * 0.44 && it.vy < 0) it.vy = Math.abs(it.vy);
          if (it.t > 0.6) it.vy += (Math.sign(it.vy) * 50 - it.vy) * Math.min(1, dt * 2);
        } else {
          it.vy = Math.min(it.vy + 260 * dt, 85);
          it.vx *= 1 - Math.min(1, dt * 2);
          it.x += it.vx * dt;
          it.y += it.vy * dt;
          if (it.x < 30 || it.x > W - 30) { it.vx = -it.vx; it.x = clamp(it.x, 30, W - 30); }
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
})();
