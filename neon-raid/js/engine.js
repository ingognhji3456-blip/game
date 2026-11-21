'use strict';

/* =========================================================
 * NEON RAID: ETERNAL OVERLORD — 게임 엔진 (메뉴 · 보스 10명 · 그리기 전부)
 * Replit 원본(src/game/engine.ts)과 같은 코드입니다. 타입 표기를 빼고 화면 글자를 한국어로 바꿨을 뿐,
 * 줄 배치와 동작은 그대로입니다.
 * 캔버스 540×960(세로), 1초 60틱 고정, 저장은 localStorage 'neon_raid_save'.
 * ========================================================= */

const TAU = Math.PI * 2;
const MAX_PARTICLES = 80;
/** 켜진 채 남아 있는 레이저(쓸어 가는 레이저 · 회전 광선 · 블랙홀 레이저)가 맞기 시작하기 전 예열 시간 (틱) */
const BEAM_WARMUP = 60;

function dist(ax, ay, bx, by) {
  const dx = ax - bx, dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function rand(lo, hi) { return lo + Math.random() * (hi - lo); }
function randInt(lo, hi) { return Math.floor(rand(lo, hi + 1)); }
function rnd360() { return rand(0, TAU); }

function loadSave() {
  try {
    const s = localStorage.getItem('neon_raid_save');
    if (s) {
      const d = JSON.parse(s);
      if (!d.upgrades) d.upgrades = {};
      for (const k of Object.keys(UPGRADES)) if (!(k in d.upgrades)) d.upgrades[k] = 0;
      return d;
    }
  } catch (_) {}
  return { coins: 0, cleared_stages: [], selected_char: 0, owned_chars: [0], upgrades: { speed: 0, hp: 0, damage: 0, fire: 0, shield: 0, magnet: 0 } };
}

function saveSave(data) {
  try { localStorage.setItem('neon_raid_save', JSON.stringify(data)); } catch (_) {}
}

class NeonRaidEngine {
  canvas;
  ctx;
  save;

  state = 'LOBBY';
  lobbyTimer = 0;
  selTimer = 0;
  hangarTimer = 0;
  upgTimer = 0;
  transitionTimer = 0;
  currentChapter = 1;
  selectedStage = 1;
  selectedCharPreview = 0;

  // player
  px = WIDTH / 2; py = HEIGHT - 100;
  pvx = 0; pvy = 0;
  php = 150; pmaxHp = 150;
  itime = 0;
  pFireTimer = 0;
  pRegenTimer = 0;
  sessionCoins = 0;
  coinSpawnTimer = 0;

  // boss
  bossStage = 1;
  bx = WIDTH / 2; by = 100;
  bhp = 30000; bmax = 30000;
  timer = 0;
  score = 0;
  phase = 1;
  bColor = C_MAGENTA;

  // effects
  shake = 0;
  flash = 0;
  flashColor = C_WHITE;

  // HP bar smooth display values (0-1 ratios)
  bHpDisplay = 1;      // smoothly lerped boss HP ratio
  bHpTrail   = 1;      // ghost trail that lags behind (shows recent loss)
  pHpDisplay = 1;      // smoothly lerped player HP ratio
  pHpTrail   = 1;      // ghost trail for player bar
  bHpFlash   = 0;      // >0 while boss bar flashes from damage
  pHpFlashDmg  = 0;   // >0 while player bar flashes red (damage)
  pHpFlashHeal = 0;   // >0 while player bar flashes green (heal)

  // collections
  particles = [];
  bullets = [];
  bossBullets = [];
  orbs = [];
  healOrbs = [];
  lasers = [];
  coinOrbs = [];

  // boss-specific
  b1SweepAng = Math.PI / 2;
  b1SweepDir = 1;
  b2Mines = [];
  b2Rings = [];
  b2Beams = [];
  b2Shield = 0;
  b2ShieldActive = false;
  b3Segments = [];
  b3SinTime = 0;
  b4TeleportTimer = 0;
  b4Pos = [WIDTH / 2, 120];
  b4TargetPos = [WIDTH / 2, 120];
  b4MoveLerp = 0;
  b4ScytheAng = 0;
  b4BurstTimer = 0;
  b4SickleBlades = [];
  b5GearAng = [0, 0, 0];
  b5ArmAng = 0;
  b5ArmLaserTimer = 0;
  b5ArmLaserActive = false;
  b5ArmLaserLife = 0;
  b5EmpTimer = 0;
  b5EmpRings = [];
  b5MissileTimer = 0;
  b5CorePulse = 0;
  b6BladeAng = 0;
  b6OverchargeTimer = 0;
  b6OverchargeActive = false;
  b6OverchargeLife = 0;
  b6QuakeTimer = 0;
  b6QuakeRings = [];
  b7Pos1 = [WIDTH / 2 - 110, 120];
  b7Pos2 = [WIDTH / 2 + 110, 120];
  b7Enraged = false;
  b8Clones = [];
  b8RealIdx = 0;
  b8GravityActive = false;
  b8GravityTimer = 0;
  b9Submerged = false;
  b9Alpha = 255;
  b9SonarPos = [0, 0];
  b9SonarRadius = 0;
  b10TimeAttack = 2400;
  armAngle = 0;
  phaseTimer = 0;   // 이번 단계가 시작된 뒤 지난 틱 (레이저 예열용)

  // virtual joystick
  joyBase = [90, HEIGHT - 120];
  joyPos = [90, HEIGHT - 120];
  joyDragging = false;
  joyTouchId = null;

  // keyboard
  keys = new Set();

  // stars
  stars = [];

  // animation frame
  rafId = null;
  lastTime = 0;
  accumulator = 0;
 TICK = 1000 / 60;

  // mouse state
  mouseX = 0;
  mouseY = 0;
  mouseDown = false;

  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.save = loadSave();
    this.selectedCharPreview = this.save.selected_char;
    this.selectedStage = 1;

    // generate stars
    for (let i = 0; i < 100; i++) {
      this.stars.push([rand(0, WIDTH), rand(0, HEIGHT), rand(0, TAU), rand(0.01, 0.04), randInt(1, 2)]);
    }

    this.reset(1);
    this.bindEvents();
  }

  // ─── helpers ─────────────────────────────
  getPlayerSpeed() {
    const c = CHARACTERS[this.save.selected_char];
    return Math.max(4, 4.5 + c.speed_bonus + this.save.upgrades.speed * 2);
  }
  getPlayerMaxHp() {
    const c = CHARACTERS[this.save.selected_char];
    return 150 + c.hp_bonus + this.save.upgrades.hp * 30;
  }
  getDamageMult() { return 1 + this.save.upgrades.damage * 0.5; }
  getFireRate() {
    const c = CHARACTERS[this.save.selected_char];
    return Math.max(2, c.fire_rate - this.save.upgrades.fire);
  }
  getCoinRadius() { return 80 + this.save.upgrades.magnet * 80; }

  // ─── save ─────────────────────────────────
  saveData() { saveSave(this.save); }

  // ─── reset ────────────────────────────────
  reset(startStage) {
    this.bossStage = startStage;
    this.bmax = STAGE_INFO[startStage].hp;
    this.bhp = this.bmax;
    this.timer = 0;
    this.score = 0;
    this.phase = 1;

    this.px = WIDTH / 2 - 17;
    this.py = HEIGHT - 100;
    this.pvx = this.pvy = 0;
    this.pmaxHp = this.getPlayerMaxHp();
    this.php = this.pmaxHp;
    this.itime = 0;
    this.pFireTimer = 0;
    this.pRegenTimer = 0;
    this.sessionCoins = 0;
    this.coinSpawnTimer = 0;

    // reset HP bar display state
    this.bHpDisplay = 1; this.bHpTrail = 1;
    this.pHpDisplay = 1; this.pHpTrail = 1;
    this.bHpFlash = 0; this.pHpFlashDmg = 0; this.pHpFlashHeal = 0;

    this.particles = [];
    this.bullets = [];
    this.bossBullets = [];
    this.orbs = [];
    this.healOrbs = [];
    this.lasers = [];
    this.coinOrbs = [];
    this.b2Mines = [];
    this.b2Rings = [];
    this.b2Beams = [];
    this.b4SickleBlades = [];
    this.b5EmpRings = [];
    this.b6QuakeRings = [];

    this.b1SweepAng = Math.PI / 2;
    this.b1SweepDir = 1;
    this.b2Shield = 0;
    this.b2ShieldActive = false;
    this.b3Segments = [];
    this.b3SinTime = 0;
    this.b4TeleportTimer = 0;
    this.b4Pos = [WIDTH / 2, 120];
    this.b4TargetPos = [WIDTH / 2, 120];
    this.b4MoveLerp = 0;
    this.b4ScytheAng = 0;
    this.b4BurstTimer = 0;
    this.b5GearAng = [0, 0, 0];
    this.b5ArmAng = 0;
    this.b5ArmLaserTimer = 0;
    this.b5ArmLaserActive = false;
    this.b5ArmLaserLife = 0;
    this.b5EmpTimer = 0;
    this.b5MissileTimer = 0;
    this.b5CorePulse = 0;
    this.b6BladeAng = 0;
    this.b6OverchargeTimer = 0;
    this.b6OverchargeActive = false;
    this.b6OverchargeLife = 0;
    this.b6QuakeTimer = 0;
    this.b7Pos1 = [WIDTH / 2 - 110, 150];
    this.b7Pos2 = [WIDTH / 2 + 110, 150];
    this.b7Enraged = false;
    this.b8Clones = [];
    this.b8RealIdx = 0;
    this.b8GravityActive = false;
    this.b8GravityTimer = 0;
    this.b9Submerged = false;
    this.b9Alpha = 255;
    this.b9SonarRadius = 0;
    this.b10TimeAttack = 2400;
    this.shake = 0;
    this.flash = 0;
    this.flashColor = C_WHITE;
    this.armAngle = 0;
    this.phaseTimer = 0;

    for (let i = 0; i < 3; i++) this.spawnCoin();
  }

  spawnCoin() {
    this.coinOrbs.push({ x: rand(60, WIDTH - 60), y: rand(260, HEIGHT - 120), t: 0, value: 10 });
  }

  spawnParticles(x, y, c, n = 12, speed = 8, size = 6) {
    const room = MAX_PARTICLES - this.particles.length;
    const cnt = Math.min(n, room);
    for (let i = 0; i < cnt; i++) {
      const a = rnd360();
      const spd = rand(1, speed);
      this.particles.push({ x, y, c, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, life: 1, life_dec: 0.025 + Math.random() * 0.02, size });
    }
  }

  triggerPhaseTransition() {
    this.phase++;
    this.phaseTimer = 0;
    this.bmax *= 2;
    this.bhp = this.bmax;
    this.flash = 200; this.flashColor = C_WHITE; this.shake = 20;
    this.spawnParticles(WIDTH / 2, 100, C_WHITE, 20, 10, 10);
    this.bossBullets = [];
    this.lasers = [];
    this.b2Mines = [];
    this.b2Rings = [];
    this.b2Beams = [];
    this.b4SickleBlades = [];
    this.b5EmpRings = [];
  }

  // ─── event binding ────────────────────────
  bindEvents() {
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.key.toLowerCase());
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.key.toLowerCase());
    });

    this.canvas.addEventListener('mousedown', (e) => {
      const [cx, cy] = this.canvasCoords(e.clientX, e.clientY);
      this.mouseX = cx; this.mouseY = cy;
      this.mouseDown = true;
      this.handleClick(cx, cy);
      // joystick
      if (this.state === 'PLAY' && dist(cx, cy, this.joyBase[0], this.joyBase[1]) < 80) {
        this.joyDragging = true;
      }
    });
    this.canvas.addEventListener('mousemove', (e) => {
      const [cx, cy] = this.canvasCoords(e.clientX, e.clientY);
      this.mouseX = cx; this.mouseY = cy;
      if (this.joyDragging) {
        const dx = cx - this.joyBase[0], dy = cy - this.joyBase[1];
        const d = Math.min(Math.hypot(dx, dy), 60);
        const a = Math.atan2(dy, dx);
        this.joyPos = [this.joyBase[0] + Math.cos(a) * d, this.joyBase[1] + Math.sin(a) * d];
      }
    });
    this.canvas.addEventListener('mouseup', () => {
      this.mouseDown = false;
      this.joyDragging = false;
      this.joyPos = [...this.joyBase];
    });

    // Touch
    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      for (const t of Array.from(e.changedTouches)) {
        const [cx, cy] = this.canvasCoords(t.clientX, t.clientY);
        this.handleClick(cx, cy);
        if (this.state === 'PLAY' && dist(cx, cy, this.joyBase[0], this.joyBase[1]) < 80 && this.joyTouchId === null) {
          this.joyDragging = true;
          this.joyTouchId = t.identifier;
        }
      }
    }, { passive: false });
    this.canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier === this.joyTouchId && this.joyDragging) {
          const [cx, cy] = this.canvasCoords(t.clientX, t.clientY);
          const dx = cx - this.joyBase[0], dy = cy - this.joyBase[1];
          const d = Math.min(Math.hypot(dx, dy), 60);
          const a = Math.atan2(dy, dx);
          this.joyPos = [this.joyBase[0] + Math.cos(a) * d, this.joyBase[1] + Math.sin(a) * d];
        }
      }
    }, { passive: false });
    this.canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier === this.joyTouchId) {
          this.joyDragging = false;
          this.joyTouchId = null;
          this.joyPos = [...this.joyBase];
        }
        const [cx, cy] = this.canvasCoords(t.clientX, t.clientY);
        this.mouseX = cx; this.mouseY = cy;
      }
    }, { passive: false });
  }

  canvasCoords(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = WIDTH / rect.width;
    const scaleY = HEIGHT / rect.height;
    return [(clientX - rect.left) * scaleX, (clientY - rect.top) * scaleY];
  }

  handleClick(cx, cy) {
    const mx = cx, my = cy;
    if (this.state === 'LOBBY') {
      if (this.inRect(mx, my, WIDTH/2-150, HEIGHT/2+100, 300, 60)) { this.state = 'STAGE_SELECT'; this.selTimer = 0; }
      else if (this.inRect(mx, my, WIDTH/2-150, HEIGHT/2+175, 300, 55)) { this.state = 'HANGAR'; this.hangarTimer = 0; }
      else if (this.inRect(mx, my, WIDTH/2-150, HEIGHT/2+243, 300, 55)) { this.state = 'UPGRADE'; this.upgTimer = 0; }
    } else if (this.state === 'HANGAR') {
      for (let cid = 0; cid < 5; cid++) {
        const cy2 = 80 + cid * 115;
        const char = CHARACTERS[cid];
        if (this.save.owned_chars.includes(cid) && cid !== this.save.selected_char) {
          if (this.inRect(mx, my, WIDTH - 110, cy2 + 30, 95, 40)) {
            this.save.selected_char = cid; this.selectedCharPreview = cid; this.saveData();
          }
        } else if (!this.save.owned_chars.includes(cid)) {
          if (this.inRect(mx, my, WIDTH - 110, cy2 + 55, 95, 40) && this.save.coins >= char.cost) {
            this.save.coins -= char.cost;
            this.save.owned_chars.push(cid);
            this.save.selected_char = cid;
            this.selectedCharPreview = cid;
            this.saveData();
            this.flash = 60; this.flashColor = char.color;
          }
        }
        if (this.inRect(mx, my, 30, cy2, WIDTH - 120, 105)) this.selectedCharPreview = cid;
      }
      if (this.inRect(mx, my, 30, HEIGHT - 90, 140, 50)) this.state = 'LOBBY';
    } else if (this.state === 'UPGRADE') {
      const keys = Object.keys(UPGRADES);
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        const upg = UPGRADES[key];
        const lv = this.save.upgrades[key];
        if (lv >= upg.max) continue;
        const cost = upg.costs[lv];
        const cy2 = 75 + i * 108;
        if (this.inRect(mx, my, WIDTH - 130, cy2 + 30, 110, 48) && this.save.coins >= cost) {
          this.save.coins -= cost;
          this.save.upgrades[key]++;
          this.saveData();
          this.flash = 50; this.flashColor = upg.color;
          this.spawnParticles(WIDTH / 2, HEIGHT / 2, upg.color, 15, 10);
        }
      }
      if (this.inRect(mx, my, 30, HEIGHT - 90, 140, 50)) this.state = 'LOBBY';
    } else if (this.state === 'STAGE_SELECT') {
      const ch1Done = [1,2,3,4,5].every(s => this.save.cleared_stages.includes(s));
      // chapter tabs
      if (this.inRect(mx, my, 30, 75, 210, 40)) { this.currentChapter = 1; this.selectedStage = 1; }
      if (this.inRect(mx, my, WIDTH - 240, 75, 210, 40) && ch1Done) { this.currentChapter = 2; this.selectedStage = 6; }
      // stage cards
      const range = this.currentChapter === 1 ? [1,2,3,4,5] : [6,7,8,9,10];
      for (let i = 0; i < range.length; i++) {
        const sid = range[i];
        const unlocked = sid === 1 || sid === 6 || this.save.cleared_stages.includes(sid - 1);
        if (unlocked && this.inRect(mx, my, 30, 130 + i * 115, WIDTH - 60, 108)) {
          this.selectedStage = sid;
        }
      }
      // back
      if (this.inRect(mx, my, 30, HEIGHT - 90, 140, 50)) this.state = 'LOBBY';
      // launch
      const canLaunch = this.selectedStage === 1 || this.selectedStage === 6 || this.save.cleared_stages.includes(this.selectedStage - 1);
      if (canLaunch && this.inRect(mx, my, WIDTH - 185, HEIGHT - 90, 160, 50)) {
        this.reset(this.selectedStage);
        this.state = 'PLAY';
      }
    } else if (this.state === 'PLAY') {
      // back button: ← SELECT (bottom-right)
      if (this.inRect(mx, my, WIDTH-135, HEIGHT-55, 125, 40)) {
        this.saveData();
        this.shake = 0; this.flash = 0;
        this.state = 'STAGE_SELECT'; this.selTimer = 0;
      }
    } else if (this.state === 'WIN') {
      if (this.inRect(mx, my, WIDTH/2 - 130, HEIGHT/2 + 30, 260, 55)) {
        this.state = 'STAGE_SELECT'; this.selTimer = 0;
      }
    }
  }

  inRect(mx, my, x, y, w, h) {
    return mx >= x && mx <= x + w && my >= y && my <= y + h;
  }

  // ─── main loop ────────────────────────────
  start() {
    this.lastTime = performance.now();
    this.rafId = requestAnimationFrame(this.loop);
  }

  stop() {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
  }

  loop = (now) => {
    const dt = now - this.lastTime;
    this.lastTime = now;
    // cap accumulator to 3 ticks so tab-switch spikes can't spiral into a lag freeze
    this.accumulator = Math.min(this.accumulator + dt, this.TICK * 3);
    while (this.accumulator >= this.TICK) {
      this.update();
      this.accumulator -= this.TICK;
    }
    this.render();
    this.rafId = requestAnimationFrame(this.loop);
  };

  // ─── update ───────────────────────────────
  update() {
    this.lobbyTimer++;
    // 화면 흔들림 · 번쩍임은 어느 화면에서든 줄어들게 합니다. 원본은 전투 중(updatePlay)에만 줄여서,
    // 맞다가 죽거나 보스를 깨고 나가면 메뉴 · 전환 · 승리 화면이 계속 흔들리고 색으로 덮여 있었습니다.
    if (this.state !== 'PLAY') this.fadeScreenFx();
    if (this.state === 'LOBBY') return;
    if (this.state === 'HANGAR') { this.hangarTimer++; return; }
    if (this.state === 'UPGRADE') { this.upgTimer++; return; }
    if (this.state === 'STAGE_SELECT') { this.selTimer++; return; }
    if (this.state === 'WIN') return;
    if (this.state === 'TRANSITION') { this.updateTransition(); return; }
    if (this.state === 'PLAY') this.updatePlay();
  }

  updateTransition() {
    this.transitionTimer++;
    for (const p of this.particles) { p.x += p.vx; p.y += p.vy; p.life -= p.life_dec; }
    this.particles = this.particles.filter(p => p.life > 0);
    if (this.transitionTimer % 5 === 0) {
      this.spawnParticles(WIDTH / 2, HEIGHT / 3, [C_STEEL, C_TEAL, C_WHITE][randInt(0, 2)], 6, 8);
    }
    if (this.transitionTimer >= 180) {
      if (!this.save.cleared_stages.includes(this.bossStage)) {
        this.save.cleared_stages.push(this.bossStage);
        this.saveData();
      }
      if (this.bossStage < 10) {
        this.bossStage++;
        this.bmax = STAGE_INFO[this.bossStage].hp;
      }
      this.bhp = this.bmax; this.phase = 1; this.timer = 0; this.phaseTimer = 0;
      this.particles = []; this.bullets = []; this.orbs = [];
      this.healOrbs = []; this.bossBullets = []; this.lasers = [];
      this.b4SickleBlades = []; this.b5EmpRings = [];
      this.coinOrbs = [];
      for (let i = 0; i < 3; i++) this.spawnCoin();
      this.state = 'PLAY';
    }
  }

  updatePlay() {
    const char = CHARACTERS[this.save.selected_char];
    const speed = this.getPlayerSpeed();
    const fireRate = this.getFireRate();
    const dmgMult = this.getDamageMult();
    const coinRadius = this.getCoinRadius();

    // ── player movement ──
    let kbvx = 0, kbvy = 0;
    if (this.keys.has('arrowleft') || this.keys.has('a')) kbvx = -speed;
    if (this.keys.has('arrowright') || this.keys.has('d')) kbvx = speed;
    if (this.keys.has('arrowup') || this.keys.has('w')) kbvy = -speed;
    if (this.keys.has('arrowdown') || this.keys.has('s')) kbvy = speed;

    if (kbvx !== 0 || kbvy !== 0) {
      this.pvx = kbvx; this.pvy = kbvy;
    } else if (this.joyDragging) {
      const dx = this.joyPos[0] - this.joyBase[0], dy = this.joyPos[1] - this.joyBase[1];
      const d = Math.min(Math.hypot(dx, dy), 60);
      const a = Math.atan2(dy, dx);
      this.pvx = Math.cos(a) * (d / 60) * speed;
      this.pvy = Math.sin(a) * (d / 60) * speed;
    } else {
      this.pvx *= 0.78; this.pvy *= 0.78;
    }

    this.px += this.pvx; this.py += this.pvy;
    this.px = clamp(this.px, 25, WIDTH - 65);
    this.py = clamp(this.py, 150, HEIGHT - 80);

    // ── shield regen ──
    const regenLv = this.save.upgrades.shield;
    if (regenLv > 0) {
      this.pRegenTimer++;
      if (this.pRegenTimer >= Math.max(1, 180 / regenLv)) {
        this.pRegenTimer = 0;
        if (this.php < this.pmaxHp) this.php = Math.min(this.pmaxHp, this.php + 1);
      }
    }

    // ── coin spawn ──
    this.coinSpawnTimer++;
    if (this.coinSpawnTimer >= 300 && this.coinOrbs.length < 6) {
      this.coinSpawnTimer = 0; this.spawnCoin();
    }

    // ── coin pickup ──
    const pcx = this.px + 17, pcy = this.py + 17;
    const toRemove = [];
    for (let i = 0; i < this.coinOrbs.length; i++) {
      const coin = this.coinOrbs[i];
      coin.t += 0.06;
      const cd = dist(coin.x, coin.y, pcx, pcy);
      if (cd < coinRadius && cd > 1) {
        const pull = Math.min(10, (coinRadius - cd) / coinRadius * 15);
        const a = Math.atan2(pcy - coin.y, pcx - coin.x);
        coin.x += Math.cos(a) * pull; coin.y += Math.sin(a) * pull;
      }
      if (dist(coin.x, coin.y, pcx, pcy) < 30) {
        toRemove.push(i);
        this.save.coins += coin.value;
        this.sessionCoins += coin.value;
        this.flash = 15; this.flashColor = C_COIN;
        this.spawnParticles(coin.x, coin.y, C_COIN, 5, 4, 4);
      }
    }
    for (const i of toRemove.reverse()) this.coinOrbs.splice(i, 1);

    // ── boss state ──
    const colors = STAGE_COLORS[this.bossStage];
    this.bColor = colors[this.phase - 1] || C_WHITE;
    const shakeAmp = 5 * this.phase;
    this.bx = WIDTH / 2;
    this.by = 100 + Math.sin(this.timer * 0.03) * shakeAmp;
    this.timer++;
    this.phaseTimer++;

    const p_hit_r = 14;

    // ── boss logic ──
    switch (this.bossStage) {
      case 1: this.updateBoss1(pcx, pcy, p_hit_r); break;
      case 2: this.updateBoss2(pcx, pcy, p_hit_r); break;
      case 3: this.updateBoss3(pcx, pcy, p_hit_r); break;
      case 4: this.updateBoss4(pcx, pcy, p_hit_r); break;
      case 5: this.updateBoss5(pcx, pcy, p_hit_r); break;
      case 6: this.updateBoss6(pcx, pcy, p_hit_r); break;
      case 7: this.updateBoss7(pcx, pcy, p_hit_r); break;
      case 8: this.updateBoss8(pcx, pcy, p_hit_r); break;
      case 9: this.updateBoss9(pcx, pcy, p_hit_r); break;
      case 10: this.updateBoss10(pcx, pcy, p_hit_r); break;
    }

    // ── attack orbs ──
    if (this.orbs.length < 3 && this.timer % (180 - this.phase * 15) === 0) {
      this.orbs.push({ x: rand(60, WIDTH - 60), y: rand(200, HEIGHT - 150), t: 0 });
    }
    for (let i = this.orbs.length - 1; i >= 0; i--) {
      const o = this.orbs[i];
      o.t += 0.1;
      if (dist(o.x, o.y, pcx, pcy) < 35) {
        this.orbs.splice(i, 1);
        this.itime = 60;
        this.spawnParticles(o.x, o.y, C_CYAN, 8, 6, 6);
        for (let j = -2; j <= 2; j++) {
          const af = Math.atan2(this.by - this.py, this.bx - this.px) + j * 0.1;
          this.bullets.push({ p: [this.px + 17, this.py + 17], v: [Math.cos(af) * 17, Math.sin(af) * 17] });
        }
      }
    }

    // ── heal orbs ──
    const healInterval = Math.max(200, 600 - this.phase * 30);
    if (this.healOrbs.length < 1 && this.timer % healInterval === 0 && this.timer > 0) {
      this.healOrbs.push({ x: rand(80, WIDTH - 80), y: rand(220, HEIGHT - 160), t: 0 });
    }
    for (let i = this.healOrbs.length - 1; i >= 0; i--) {
      const h = this.healOrbs[i];
      h.t += 0.08;
      if (dist(h.x, h.y, pcx, pcy) < 35) {
        this.healOrbs.splice(i, 1);
        this.php = Math.min(this.pmaxHp, this.php + 50);
        this.flash = 35; this.flashColor = C_GREEN;
        this.spawnParticles(h.x, h.y, C_GREEN, 12, 6, 8);
      }
    }

    // ── boss bullet movement ──
    const newBossBullets = [];
    const extraBullets = [];
    for (const bb of this.bossBullets) {
      if (bb.homing && bb.life > 0) {
        bb.life--;
        const tx = bb.target[0], ty = bb.target[1];
        const ca = Math.atan2(bb.v[1], bb.v[0]);
        const diff = ((Math.atan2(ty - bb.p[1], tx - bb.p[0]) - ca + Math.PI) % TAU) - Math.PI;
        const turn = bb.turn_speed || 0.04;
        const nca = ca + Math.max(-turn, Math.min(turn, diff));
        const spd = Math.hypot(bb.v[0], bb.v[1]);
        bb.v = [Math.cos(nca) * spd, Math.sin(nca) * spd];
      }
      if (bb.type === 'shrapnel_missile') {
        if (bb.p[1] >= bb.target_y) {
          this.spawnParticles(bb.p[0], bb.p[1], C_YELLOW, 8, 6);
          const n = bb.shrapnel_count || 6;
          for (let j = 0; j < n; j++) {
            const rad = j * TAU / n;
            extraBullets.push({ p: [bb.p[0], bb.p[1]], v: [Math.cos(rad) * 5, Math.sin(rad) * 5], c: C_GOLD, r: 5 });
          }
          continue;
        }
      } else if (bb.type === 'plasma_saw') {
        bb.spin_angle = (bb.spin_angle || 0) + 0.2;
        const dx = pcx - bb.p[0], dy = pcy - bb.p[1];
        const d = Math.hypot(dx, dy);
        if (d > 5) {
          bb.v[0] += (dx / d) * 0.12;
          bb.v[1] += (dy / d) * 0.12;
          const vs = Math.hypot(bb.v[0], bb.v[1]);
          if (vs > 4) { bb.v[0] = bb.v[0] / vs * 4; bb.v[1] = bb.v[1] / vs * 4; }
        }
      } else if (bb.type === 'mirror_bounce') {
        if (bb.p[0] <= 15 || bb.p[0] >= WIDTH - 15) { bb.v[0] *= -1; bb.bounces--; this.spawnParticles(bb.p[0], bb.p[1], C_MAGENTA, 4); }
        if (bb.p[1] <= 100 || bb.p[1] >= HEIGHT - 70) { bb.v[1] *= -1; bb.bounces--; this.spawnParticles(bb.p[0], bb.p[1], C_MAGENTA, 4); }
        if (bb.bounces <= 0) continue;
      }

      const px0 = bb.p[0], py0 = bb.p[1];
      bb.p[0] += bb.v[0]; bb.p[1] += bb.v[1];

      let hitPlayer = false;
      if (this.itime === 0) {
        const br = bb.r || 5;
        const hr = p_hit_r + br;
        if (dist(bb.p[0], bb.p[1], pcx, pcy) < hr) {
          hitPlayer = true;
        } else {
          const dx = bb.p[0] - px0, dy = bb.p[1] - py0;
          const ssl = dx * dx + dy * dy;
          if (ssl > 0) {
            const t = clamp(((pcx - px0) * dx + (pcy - py0) * dy) / ssl, 0, 1);
            if (dist(px0 + t * dx, py0 + t * dy, pcx, pcy) < hr) hitPlayer = true;
          }
        }
      }
      if (hitPlayer) {
        this.php -= 8; this.itime = 50;
        this.spawnParticles(bb.p[0], bb.p[1], bb.c || C_RED, 5, 4, 4);
        this.shake = 6;
        continue;
      }
      if (bb.p[0] > -60 && bb.p[0] < WIDTH + 60 && bb.p[1] > -60 && bb.p[1] < HEIGHT + 60) {
        newBossBullets.push(bb);
      }
    }
    this.bossBullets = [...newBossBullets, ...extraBullets];

    // ── mines shared update ──
    for (let i = this.b2Mines.length - 1; i >= 0; i--) {
      const mine = this.b2Mines[i];
      mine.y += mine.vy; mine.timer--;
      if (mine.is_water_mine) {
        if (mine.timer <= 0) {
          // 십자 모양 지뢰 → 네 방향으로 (원본은 오른쪽과 아래로만 나갔음)
          for (const ang of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) this.lasers.push({ s: [mine.x, mine.y], ang, t: 20 });
          this.spawnParticles(mine.x, mine.y, C_TEAL, 10);
          this.b2Mines.splice(i, 1);
          continue;
        }
      } else {
        if (mine.y >= HEIGHT - 60) mine.vy = 0;
        if (mine.timer <= 0 || dist(mine.x, mine.y, pcx, pcy) < p_hit_r) {
          this.spawnParticles(mine.x, mine.y, C_ORANGE, 10, 8);
          this.b2Rings.push({ x: mine.x, y: mine.y, r: 10, max_r: 120, speed: 6, c: C_ORANGE });
          this.shake = 8;
          if (dist(mine.x, mine.y, pcx, pcy) < p_hit_r * 3 && this.itime === 0) { this.php -= 12; this.itime = 50; }
          this.b2Mines.splice(i, 1); continue;
        }
      }
    }
    for (let i = this.b2Rings.length - 1; i >= 0; i--) {
      const ring = this.b2Rings[i];
      ring.r += ring.speed;
      if (Math.abs(dist(ring.x, ring.y, pcx, pcy) - ring.r) < p_hit_r && this.itime === 0) { this.php -= 8; this.itime = 50; }
      if (ring.r > ring.max_r) { this.b2Rings.splice(i, 1); }
    }

    // ── player bullets ──
    this.pFireTimer++;
    if (this.pFireTimer >= fireRate) {
      this.pFireTimer = 0;
      const af = -Math.PI / 2;
      const spec = char.special;
      if (spec === 'triple') {
        for (let i = -1; i <= 1; i++) {
          const fa = af + i * char.bullet_spread;
          this.bullets.push({ p: [this.px + 17, this.py + 10], v: [Math.cos(fa) * char.bullet_speed, Math.sin(fa) * char.bullet_speed], c: char.bullet_color, r: char.bullet_size });
        }
      } else if (spec === 'rapid') {
        this.bullets.push({ p: [this.px + 17, this.py + 10], v: [Math.cos(af) * char.bullet_speed, Math.sin(af) * char.bullet_speed], c: char.bullet_color, r: char.bullet_size });
      } else if (spec === 'scatter') {
        for (let i = 0; i < char.bullet_count; i++) {
          const fa = af + rand(-char.bullet_spread, char.bullet_spread);
          this.bullets.push({ p: [this.px + 17, this.py + 10], v: [Math.cos(fa) * char.bullet_speed, Math.sin(fa) * char.bullet_speed], c: char.bullet_color, r: char.bullet_size });
        }
      } else if (spec === 'homing') {
        for (let i = 0; i < char.bullet_count; i++) {
          const fa = af + rand(-0.15, 0.15);
          this.bullets.push({ p: [this.px + 17, this.py + 10], v: [Math.cos(fa) * char.bullet_speed, Math.sin(fa) * char.bullet_speed], c: char.bullet_color, r: char.bullet_size, homing: true, life: 150, target: [this.bx, this.by], turn_speed: 0.08 });
        }
      } else if (spec === 'ring') {
        for (let i = 0; i < char.bullet_count; i++) {
          const fa = i * TAU / char.bullet_count;
          this.bullets.push({ p: [this.px + 17, this.py + 10], v: [Math.cos(fa) * char.bullet_speed, Math.sin(fa) * char.bullet_speed], c: char.bullet_color, r: char.bullet_size });
        }
      }
    }

    // ── player bullets → boss ──
    const validBullets = [];
    let bossKilled = false;
    for (const b of this.bullets) {
      if (b.homing && b.life > 0) {
        b.life--;
        const tx = b.target[0], ty = b.target[1];
        const ca = Math.atan2(b.v[1], b.v[0]);
        const diff = ((Math.atan2(ty - b.p[1], tx - b.p[0]) - ca + Math.PI) % TAU) - Math.PI;
        const ts = b.turn_speed || 0.06;
        const nca = ca + Math.max(-ts, Math.min(ts, diff));
        const spd = Math.hypot(b.v[0], b.v[1]);
        b.v = [Math.cos(nca) * spd, Math.sin(nca) * spd];
      }
      b.p[0] += b.v[0]; b.p[1] += b.v[1];
      if (b.p[0] < 0 || b.p[0] > WIDTH || b.p[1] < 0 || b.p[1] > HEIGHT) continue;

      let hit = false;
      switch (this.bossStage) {
        case 1: hit = this.inRect(b.p[0], b.p[1], this.bx - 80, this.by - 40, 160, 80); break;
        case 2: if (!this.b2ShieldActive || this.phase === 4) hit = dist(b.p[0], b.p[1], this.bx, this.by) < 55; else if (dist(b.p[0], b.p[1], this.bx, this.by) < 90) { this.spawnParticles(b.p[0], b.p[1], C_TEAL, 4); continue; } break;
        case 3: if (dist(b.p[0], b.p[1], this.bx, this.by) < 30) hit = true; else for (const s of this.b3Segments) { if (dist(b.p[0], b.p[1], s[0], s[1]) < 17) { hit = true; break; } } break;
        case 4: if (dist(b.p[0], b.p[1], this.bx, this.by) < 30) hit = true; break;
        case 5: if (dist(b.p[0], b.p[1], this.bx, this.by) < 30 + this.b5CorePulse) hit = true; break;
        case 6: {
          const dc = dist(b.p[0], b.p[1], this.bx, this.by + 5);
          if (this.b6OverchargeActive && dc < 45) hit = true;
          else if (!this.b6OverchargeActive && dc < 37) hit = true;
          break;
        }
        case 7: if (dist(b.p[0], b.p[1], this.b7Pos1[0], this.b7Pos1[1]) < 35 || (!this.b7Enraged && dist(b.p[0], b.p[1], this.b7Pos2[0], this.b7Pos2[1]) < 35)) hit = true; break;
        case 8: for (let j = 0; j < this.b8Clones.length; j++) { if (dist(b.p[0], b.p[1], this.b8Clones[j][0], this.b8Clones[j][1]) < 32) { if (j === this.b8RealIdx) hit = true; else { this.spawnParticles(this.b8Clones[j][0], this.b8Clones[j][1], C_PURPLE, 8); for (let k = 0; k < 12; k++) { const rad = k * TAU / 12; this.bossBullets.push({ p: [this.b8Clones[j][0], this.b8Clones[j][1]], v: [Math.cos(rad) * 3, Math.sin(rad) * 3], c: C_PINK, r: 4 }); } b.p[0] = -9999; } break; } } break;
        case 9: if (!this.b9Submerged && dist(b.p[0], b.p[1], this.bx, this.by) < 65) hit = true; break;
        case 10: if (dist(b.p[0], b.p[1], this.bx, this.by) < 70) hit = true; break;
      }

      if (hit) {
        const dmg = Math.round(400 * dmgMult);
        this.bhp -= dmg;
        this.score += 100;
        this.shake = 2;
        this.spawnParticles(b.p[0], b.p[1], b.c || C_CYAN, 5, 5, 4);
        if (this.bhp <= 0) { bossKilled = true; break; }
      } else {
        validBullets.push(b);
      }
    }

    if (bossKilled) {
      if (this.phase < 4) {
        this.triggerPhaseTransition();
        this.bullets = [];
      } else {
        this.flash = 200; this.flashColor = C_WHITE; this.shake = 40;
        this.spawnParticles(this.bx, this.by, C_WHITE, 40, 15, 12);
        if (this.bossStage < 10) {
          this.state = 'TRANSITION'; this.transitionTimer = 0;
          this.bossBullets = []; this.lasers = []; this.orbs = [];
          this.b4SickleBlades = []; this.b5EmpRings = []; this.bullets = [];
        } else {
          if (!this.save.cleared_stages.includes(10)) { this.save.cleared_stages.push(10); this.saveData(); }
          this.state = 'WIN';
        }
      }
    } else {
      this.bullets = validBullets;
    }

    if (this.itime > 0) this.itime--;
    if (this.php <= 0) { this.saveData(); this.state = 'STAGE_SELECT'; this.selTimer = 0; }

    // ── HP bar smooth display update ──
    const bRatio = Math.max(0, Math.min(1, this.bhp / this.bmax));
    const pRatio = Math.max(0, Math.min(1, this.php / this.pmaxHp));

    // detect boss damage → flash + trail
    if (bRatio < this.bHpDisplay - 0.0005) {
      this.bHpFlash = 22;
    }
    // detect player HP change
    if (pRatio < this.pHpDisplay - 0.0005) {
      this.pHpFlashDmg = 25;
    } else if (pRatio > this.pHpDisplay + 0.0005) {
      this.pHpFlashHeal = 25;
    }

    // lerp display values toward real values (fast = near-instant feedback)
    this.bHpDisplay += (bRatio - this.bHpDisplay) * 0.18;
    this.pHpDisplay += (pRatio - this.pHpDisplay) * 0.20;

    // trail lags behind the display value (slower drain = shows how much was lost)
    if (this.bHpTrail > this.bHpDisplay) {
      this.bHpTrail = Math.max(this.bHpDisplay, this.bHpTrail - 0.006);
    } else {
      this.bHpTrail = this.bHpDisplay;
    }
    if (this.pHpTrail > this.pHpDisplay) {
      this.pHpTrail = Math.max(this.pHpDisplay, this.pHpTrail - 0.008);
    } else if (this.pHpTrail < this.pHpDisplay) {
      // heal: trail catches up upward quickly
      this.pHpTrail = Math.min(this.pHpDisplay, this.pHpTrail + 0.012);
    }

    if (this.bHpFlash > 0) this.bHpFlash--;
    if (this.pHpFlashDmg > 0) this.pHpFlashDmg--;
    if (this.pHpFlashHeal > 0) this.pHpFlashHeal--;

    // particles
    for (const p of this.particles) { p.x += p.vx; p.y += p.vy; p.life -= p.life_dec; }
    this.particles = this.particles.filter(p => p.life > 0);
    this.fadeScreenFx();
  }

  /** 화면 흔들림은 틱마다 1, 번쩍임은 틱마다 12 씩 줄어듦 (원본과 같은 속도) */
  fadeScreenFx() {
    if (this.shake > 0) this.shake--;
    if (this.flash > 0) this.flash = Math.max(0, this.flash - 12);
  }

  // ─── BOSS UPDATES ─────────────────────────
  addBulletRadial(cx, cy, step, c, r, speed, rot = 0) {
    for (let i = 0; i < 360; i += step) {
      const a = (i + rot) * Math.PI / 180;
      this.bossBullets.push({ p: [cx, cy], v: [Math.cos(a) * speed, Math.sin(a) * speed], c, r });
    }
  }
  addBulletAim(cx, cy, pcx, pcy, c, r, speed, spread = 0) {
    const a = Math.atan2(pcy - cy, pcx - cx) + rand(-spread, spread);
    this.bossBullets.push({ p: [cx, cy], v: [Math.cos(a) * speed, Math.sin(a) * speed], c, r });
  }
  laserAim(cx, cy, pcx, pcy, spread = 0) {
    this.lasers.push({ s: [cx, cy], ang: Math.atan2(pcy - cy, pcx - cx) + spread, t: 70, follow: true });
  }
  updateLasers(pcx, pcy, p_hit_r, dmg = 18) {
    for (let i = this.lasers.length - 1; i >= 0; i--) {
      const l = this.lasers[i];
      // 보스가 쏜 레이저는 보스(총구)에 붙어서 같이 움직임 — 원본은 쏜 자리에 남아 움직이는 보스와 떨어졌음
      if (l.follow) { l.s[0] = this.bx; l.s[1] = this.by; }
      l.t--;
      if (l.t <= 0) { this.lasers.splice(i, 1); continue; }
      if (l.t <= 15 && this.itime === 0) {
        const ep = [l.s[0] + Math.cos(l.ang) * 1200, l.s[1] + Math.sin(l.ang) * 1200];
        const dx = ep[0] - l.s[0], dy = ep[1] - l.s[1];
        const tl = clamp(((pcx - l.s[0]) * dx + (pcy - l.s[1]) * dy) / (dx * dx + dy * dy + 1e-9), 0, 1);
        if (dist(l.s[0] + tl * dx, l.s[1] + tl * dy, pcx, pcy) < p_hit_r) {
          this.php -= dmg; this.itime = 50; this.shake = 8;
        }
      }
    }
  }

  updateBoss1(pcx, pcy, p_hit_r) {
    const { bx, by } = this;
    if (this.phase === 1) {
      if (this.timer % 120 === 0) this.addBulletRadial(bx, by, 30, this.bColor, 5, 2.5);
      if (this.timer % 100 === 0) this.laserAim(bx, by, pcx, pcy);
    } else if (this.phase === 2) {
      if (this.timer % 90 === 0) this.addBulletRadial(bx, by, 25, this.bColor, 5, 3, this.timer % 25);
      if (this.timer % 80 === 0) { this.laserAim(bx, by, pcx, pcy); }
      if (this.timer % 80 === 40) this.laserAim(bx, by, pcx, pcy, 0.35);
    } else if (this.phase === 3) {
      if (this.timer % 60 === 0) { this.addBulletRadial(bx, by, 20, this.bColor, 5, 3.5, this.timer % 20); this.addBulletRadial(bx, by, 20, this.bColor, 5, 3.5, (this.timer % 20) + 10); }
      if (this.timer % 55 === 0) { const ba = Math.atan2(pcy - by, pcx - bx); [-0.35, 0, 0.35].forEach(s => this.lasers.push({ s: [bx, by], ang: ba + s, t: 70, follow: true })); }
    } else {
      if (this.timer % 8 === 0) { for (let j = 0; j < 2; j++) { const r = rnd360(); this.bossBullets.push({ p: [bx, by], v: [Math.cos(r) * 4.5, Math.sin(r) * 4.5], c: C_RED, r: 6 }); } }
      this.b1SweepAng += 0.022 * this.b1SweepDir;
      if (this.b1SweepAng > Math.PI - 0.15) this.b1SweepDir = -1;
      if (this.b1SweepAng < 0.15) this.b1SweepDir = 1;
      // sweep laser damage
      const ex = bx + Math.cos(this.b1SweepAng) * 1200;
      const ey = by + Math.sin(this.b1SweepAng) * 1200;
      const dx = ex - bx, dy = ey - by;
      const tl = clamp(((pcx - bx) * dx + (pcy - by) * dy) / (dx * dx + dy * dy + 1e-9), 0, 1);
      if (this.phaseTimer > BEAM_WARMUP && dist(bx + tl * dx, by + tl * dy, pcx, pcy) < p_hit_r && this.itime === 0) {
        this.php -= 4; this.itime = 8;
      }
    }
    this.updateLasers(pcx, pcy, p_hit_r);
  }

  updateBoss2(pcx, pcy, p_hit_r) {
    this.armAngle += 0.015 * this.phase;
    const { bx, by } = this;
    if (this.phase === 1) {
      if (this.timer % 120 === 0) this.addBulletRadial(bx, by, 45, C_PURPLE, 4, 3.5, this.timer * 5);
      if (this.timer % 200 === 0) this.addBulletAim(bx, by, pcx, pcy, C_YELLOW, 6, 2.5, 0.26);
      if (this.timer % 250 === 0) this.b2Mines.push({ x: rand(60, WIDTH - 60), y: by + 25, vy: 1.5, timer: 140, r: 10 });
    } else if (this.phase === 2) {
      if (this.timer % 80 === 0) this.addBulletRadial(bx, by, 30, C_PURPLE, 4, 4, this.timer * 6);
      if (this.timer % 130 === 0) { for (let j = 0; j < 2; j++) this.addBulletAim(bx, by, pcx, pcy, C_YELLOW, 6, 3, 0.35); }
      if (this.timer % 170 === 0) this.b2Mines.push({ x: rand(60, WIDTH - 60), y: by + 25, vy: 2, timer: 130, r: 10 });
      if (this.timer % 350 === 0) { for (let j = 0; j < 2; j++) this.b2Beams.push({ cx: bx, cy: by, ang: j * Math.PI, speed: 2, life: 160 }); }
    } else if (this.phase === 3) {
      if (this.timer % 55 === 0) this.addBulletRadial(bx, by, 22, C_PURPLE, 4, 4.5, this.timer * 6);
      if (this.timer % 100 === 0) { for (let j = 0; j < 2; j++) this.addBulletAim(bx, by, pcx, pcy, C_YELLOW, 6, 3.5, 0.17); }
      if (this.timer % 100 === 0) { for (let j = 0; j < 2; j++) this.b2Mines.push({ x: rand(60, WIDTH - 60), y: by + 25, vy: 2.5, timer: 110, r: 10 }); }
      if (this.b2Beams.length === 0) for (let j = 0; j < 3; j++) this.b2Beams.push({ cx: bx, cy: by, ang: j * TAU / 3, speed: 2, life: 9999 });
    } else {
      this.b2ShieldActive = false;
      if (this.timer % 10 === 0) this.b2Mines.push({ x: rand(60, WIDTH - 60), y: 0, vy: 3.5, timer: 80, r: 11 });
      if (this.timer % 8 === 0) this.addBulletAim(bx, by, pcx, pcy, C_YELLOW, 5, 4, 0.14);
      if (this.b2Beams.length === 0) for (let j = 0; j < 6; j++) this.b2Beams.push({ cx: bx, cy: by, ang: j * Math.PI / 3, speed: 1.8, life: 9999 });
    }
    // shield toggle
    if (this.phase < 4) {
      this.b2Shield--;
      if (this.b2Shield <= 0) {
        this.b2ShieldActive = !this.b2ShieldActive;
        const openT = Math.max(60, 120 - this.phase * 20);
        const closeT = Math.max(120, 240 - this.phase * 30);
        this.b2Shield = this.b2ShieldActive ? openT : closeT;
      }
    }
    // beams
    for (let i = this.b2Beams.length - 1; i >= 0; i--) {
      const beam = this.b2Beams[i];
      beam.ang += beam.speed * Math.PI / 180;
      beam.life--;
      beam.age = (beam.age || 0) + 1;   // 나온 뒤 예열하는 동안은 조준선만 (원본은 갑자기 나타나 바로 맞았음)
      if (beam.age > BEAM_WARMUP && this.itime === 0) {
        const ex = bx + Math.cos(beam.ang) * 1100, ey = by + Math.sin(beam.ang) * 1100;
        const dx = ex - bx, dy = ey - by;
        const tl = clamp(((pcx - bx) * dx + (pcy - by) * dy) / (dx * dx + dy * dy + 1e-9), 0, 1);
        if (dist(bx + tl * dx, by + tl * dy, pcx, pcy) < p_hit_r) { this.php--; }
      }
      if (beam.life <= 0 && this.phase < 4) this.b2Beams.splice(i, 1);
    }
    this.updateLasers(pcx, pcy, p_hit_r);
  }

  updateBoss3(pcx, pcy, p_hit_r) {
    this.b3SinTime += 0.05;
    this.bx = WIDTH / 2 + Math.cos(this.b3SinTime * 0.7) * 200;
    this.by = 200 + Math.sin(this.b3SinTime * 1.3) * 120;
    const { bx, by } = this;

    if (!this.b3Segments.length) for (let i = 0; i < 20; i++) this.b3Segments.push([bx, by]);
    let head = [bx, by];
    for (const seg of this.b3Segments) {
      const d = dist(head[0], head[1], seg[0], seg[1]);
      if (d > 12) { const a = Math.atan2(head[1] - seg[1], head[0] - seg[0]); seg[0] += Math.cos(a) * (d - 12); seg[1] += Math.sin(a) * (d - 12); }
      head = seg;
    }

    const randSegs = (n) => { const s = [...this.b3Segments]; for (let i = s.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [s[i], s[j]] = [s[j], s[i]]; } return s.slice(0, n); };
    if (this.phase === 1) {
      if (this.timer % 70 === 0) { const s = randSegs(1)[0]; for (let j = 0; j < 4; j++) { const a = rnd360(); this.bossBullets.push({ p: [s[0], s[1]], v: [Math.cos(a) * 3.5, Math.sin(a) * 3.5], c: C_GREEN, r: 4 }); } }
    } else if (this.phase === 2) {
      if (this.timer % 50 === 0) { for (const s of randSegs(3)) { for (let j = 0; j < 6; j++) { const a = rnd360(); this.bossBullets.push({ p: [s[0], s[1]], v: [Math.cos(a) * 4, Math.sin(a) * 4], c: C_GREEN, r: 4 }); } } }
      if (this.timer % 90 === 0) this.laserAim(bx, by, pcx, pcy);
    } else if (this.phase === 3) {
      if (this.timer % 40 === 0) { for (const s of randSegs(5)) { for (let j = 0; j < 7; j++) { const a = rnd360(); this.bossBullets.push({ p: [s[0], s[1]], v: [Math.cos(a) * 4.5, Math.sin(a) * 4.5], c: C_YELLOW, r: 5 }); } } }
      if (this.timer % 65 === 0) { const ba = Math.atan2(pcy - by, pcx - bx); [-0.26, 0.26].forEach(s => this.lasers.push({ s: [bx, by], ang: ba + s, t: 60, follow: true })); }
    } else {
      if (this.timer % 28 === 0) { for (const s of this.b3Segments) { const a = rnd360(); this.bossBullets.push({ p: [s[0], s[1]], v: [Math.cos(a) * 5, Math.sin(a) * 5], c: C_RED, r: 5 }); } }
      if (this.timer % 65 === 0) { const ba = Math.atan2(pcy - by, pcx - bx); [-0.35, 0, 0.35].forEach(s => this.lasers.push({ s: [bx, by], ang: ba + s, t: 60, follow: true })); }
    }
    this.updateLasers(pcx, pcy, p_hit_r);
  }

  updateBoss4(pcx, pcy, p_hit_r) {
    this.b4ScytheAng += 0.025 + this.phase * 0.012;
    this.bx = this.b4Pos[0]; this.by = this.b4Pos[1];
    if (this.b4MoveLerp < 1) {
      this.b4MoveLerp = Math.min(1, this.b4MoveLerp + 0.09);
      this.b4Pos[0] += (this.b4TargetPos[0] - this.b4Pos[0]) * 0.18;
      this.b4Pos[1] += (this.b4TargetPos[1] - this.b4Pos[1]) * 0.18;
    }
    const intervals = [280, 230, 180, 130];
    this.b4TeleportTimer++;
    if (this.b4TeleportTimer >= intervals[this.phase - 1]) {
      this.b4TeleportTimer = 0;
      if (this.phase < 3) {
        this.b4TargetPos = [rand(80, WIDTH - 80), rand(80, 250)];
      } else {
        const oa = rnd360();
        this.b4TargetPos = [clamp(this.px + Math.cos(oa) * 90, 80, WIDTH - 80), clamp(this.py + Math.sin(oa) * 65, 80, 250)];
      }
      this.b4MoveLerp = 0;
      this.spawnParticles(this.bx, this.by, C_PURPLE, 10, 8);
      this.flash = 30; this.flashColor = C_PURPLE;
      if (this.phase >= 3) this.addBulletRadial(this.bx, this.by, 30, C_PURPLE, 4, 3.5);
    }
    const burstI = [75, 60, 48, 36];
    this.b4BurstTimer++;
    if (this.b4BurstTimer >= burstI[this.phase - 1]) {
      this.b4BurstTimer = 0;
      const n = 2 + this.phase;
      for (let j = 0; j < n; j++) {
        const a = this.b4ScytheAng + j * TAU / n;
        this.b4SickleBlades.push({ p: [this.bx + Math.cos(a) * 45, this.by + Math.sin(a) * 45], ang: a, spin: 0.15 + this.phase * 0.02, speed: 3.5 + this.phase, life: 120, curved: 35 });
      }
    }
    if (this.phase >= 2 && this.timer % (140 - this.phase * 18) === 0) this.addBulletRadial(this.bx, this.by, 35, C_MAGENTA, 4, 3);
    if (this.phase >= 3 && this.timer % 20 === 0) this.addBulletAim(this.bx, this.by, pcx, pcy, C_INDIGO, 6, 5.5, 0.14);

    // sickle blades
    for (let i = this.b4SickleBlades.length - 1; i >= 0; i--) {
      const blade = this.b4SickleBlades[i];
      blade.life--;
      if (blade.curved > 0) { blade.curved--; blade.ang += blade.spin; }
      blade.p[0] += Math.cos(blade.ang) * blade.speed;
      blade.p[1] += Math.sin(blade.ang) * blade.speed;
      if (dist(blade.p[0], blade.p[1], pcx, pcy) < p_hit_r + 8 && this.itime === 0) {
        this.php -= 10; this.itime = 50; this.spawnParticles(blade.p[0], blade.p[1], C_PURPLE, 6);
        this.b4SickleBlades.splice(i, 1); continue;
      }
      if (blade.life <= 0 || blade.p[0] < -30 || blade.p[0] > WIDTH + 30 || blade.p[1] < -30 || blade.p[1] > HEIGHT + 30) {
        this.b4SickleBlades.splice(i, 1);
      }
    }
  }

  updateBoss5(pcx, pcy, p_hit_r) {
    this.b5GearAng[0] += 0.030 + this.phase * 0.005;
    this.b5GearAng[1] -= 0.022 + this.phase * 0.004;
    this.b5GearAng[2] += 0.015 + this.phase * 0.003;
    this.b5ArmAng += 0.010 + this.phase * 0.004;
    this.b5CorePulse = Math.sin(this.timer * 0.12) * 4 + 2;
    this.bx = WIDTH / 2; this.by = 140;

    const gearI = [80, 65, 50, 38];
    if (this.timer % gearI[this.phase - 1] === 0) {
      const gcols = [C_STEEL, this.bColor, C_CHROME];
      for (let gi = 0; gi < 3; gi++) {
        const nb = 10 + gi * 4 + (this.phase - 1) * 3;
        for (let j = 0; j < nb; j++) {
          const a = this.b5GearAng[gi] + j * TAU / nb;
          const spd = 3 + gi * 0.75 + this.phase * 0.3;
          this.bossBullets.push({ p: [this.bx, this.by], v: [Math.cos(a) * spd, Math.sin(a) * spd], c: gcols[gi], r: 3 + gi });
        }
      }
    }
    const armLaserI = [180, 155, 125, 95];
    this.b5ArmLaserTimer++;
    if (this.b5ArmLaserTimer >= armLaserI[this.phase - 1]) {
      this.b5ArmLaserTimer = 0; this.b5ArmLaserActive = true; this.b5ArmLaserLife = 55 - this.phase * 5;
    }
    if (this.b5ArmLaserActive) {
      this.b5ArmLaserLife--;
      const na = this.phase < 2 ? 4 : (this.phase < 4 ? 6 : 8);
      const al = 65 + this.phase * 5;
      if (this.b5ArmLaserLife <= 40 - this.phase * 4 && this.itime === 0) {
        for (let j = 0; j < na; j++) {
          const a = this.b5ArmAng + j * TAU / na;
          const tx = this.bx + Math.cos(a) * al, ty = this.by + Math.sin(a) * al;
          const lex = tx + Math.cos(a) * 1200, ley = ty + Math.sin(a) * 1200;
          const dx = lex - tx, dy = ley - ty;
          const tl = clamp(((pcx - tx) * dx + (pcy - ty) * dy) / (dx * dx + dy * dy + 1e-9), 0, 1);
          if (dist(tx + tl * dx, ty + tl * dy, pcx, pcy) < p_hit_r) { this.php -= 2; this.itime = 25; break; }
        }
      }
      if (this.b5ArmLaserLife <= 0) this.b5ArmLaserActive = false;
    }
    const missileI = [160, 135, 110, 85];
    this.b5MissileTimer++;
    if (this.b5MissileTimer >= missileI[this.phase - 1]) {
      this.b5MissileTimer = 0;
      const nm = 1 + Math.floor(this.phase / 2);
      for (let m = 0; m < nm; m++) {
        const oa = m * TAU / nm;
        this.bossBullets.push({ p: [this.bx + Math.cos(oa) * 30, this.by + Math.sin(oa) * 30], v: [Math.cos(oa) * 2, Math.sin(oa) * 2], c: C_ORANGE, r: 7, homing: true, life: 220, target: [this.px + this.pvx * 6, this.py + this.pvy * 6], turn_speed: 0.08 + this.phase * 0.015 });
      }
    }
    const empI = [250, 215, 180, 145];
    this.b5EmpTimer++;
    if (this.b5EmpTimer >= empI[this.phase - 1]) {
      this.b5EmpTimer = 0; this.flash = 50; this.flashColor = C_STEEL; this.shake = 12;
      this.spawnParticles(this.bx, this.by, C_CHROME, 15, 10, 8);
      for (let k = 0; k <= this.phase; k++) {
        this.b5EmpRings.push({ x: this.bx, y: this.by, r: 15, max_r: 600, speed: 8 + k * 3, c: k % 2 === 0 ? C_CYAN : C_STEEL });
      }
    }
    for (let i = this.b5EmpRings.length - 1; i >= 0; i--) {
      const ring = this.b5EmpRings[i];
      ring.r += ring.speed;
      if (Math.abs(dist(ring.x, ring.y, pcx, pcy) - ring.r) < p_hit_r && this.itime === 0) { this.php -= 15; this.itime = 60; this.spawnParticles(pcx, pcy, C_CYAN, 8, 6); }
      if (ring.r > ring.max_r) this.b5EmpRings.splice(i, 1);
    }
  }

  updateBoss6(pcx, pcy, p_hit_r) {
    this.bx = WIDTH / 2; this.by = 150;
    this.b6BladeAng += 0.020 + this.phase * 0.007;
    const oCycles = [210, 175, 145, 110], oDurs = [70, 65, 58, 50];
    if (!this.b6OverchargeActive) {
      this.b6OverchargeTimer++;
      if (this.b6OverchargeTimer >= oCycles[this.phase - 1]) {
        this.b6OverchargeTimer = 0; this.b6OverchargeActive = true; this.b6OverchargeLife = oDurs[this.phase - 1];
        this.flash = 70; this.flashColor = C_RED; this.shake = 10;
        this.spawnParticles(this.bx, this.by, C_RED, 15, 10, 8);
      }
    } else {
      this.b6OverchargeLife--;
      const triggers = { 1: [30], 2: [35, 52], 3: [30, 45, 60], 4: [25, 38, 51, 64] };
      if (triggers[this.phase]?.includes(this.b6OverchargeLife)) {
        const angles = [Math.PI / 2, Math.PI / 4, Math.PI * 3 / 4, Math.PI / 6, Math.PI * 5 / 6, Math.PI / 3, Math.PI * 2 / 3];
        for (const a of angles.slice(0, this.phase + 1)) this.lasers.push({ s: [this.bx, this.by], ang: a, t: 55, follow: true });
      }
      if (this.b6OverchargeLife <= 0) {
        this.b6OverchargeActive = false; this.b6OverchargeTimer = 0;
        this.addBulletRadial(this.bx, this.by, 360 / (8 + this.phase * 2), this.bColor, 6, 4);
        this.flash = 50; this.flashColor = this.bColor; this.shake = 12;
      }
    }
    const qCycles = [250, 210, 170, 130];
    this.b6QuakeTimer++;
    if (this.b6QuakeTimer >= qCycles[this.phase - 1]) {
      this.b6QuakeTimer = 0; this.shake = 18; this.flash = 35; this.flashColor = C_ORANGE;
      this.spawnParticles(WIDTH / 2, HEIGHT - 40, C_ORANGE, 12, 7);
      for (let k = 0; k < this.phase; k++) {
        this.b6QuakeRings.push({ x: WIDTH / 2, y: HEIGHT - 40, r: 10, max_r: 650, speed: 7 + k * 3, c: k % 2 === 0 ? C_ORANGE : C_YELLOW });
      }
    }
    for (let i = this.b6QuakeRings.length - 1; i >= 0; i--) {
      const ring = this.b6QuakeRings[i];
      ring.r += ring.speed;
      if (Math.abs(dist(ring.x, ring.y, pcx, pcy) - ring.r) < p_hit_r + 9 && this.itime === 0) { this.php -= 15; this.itime = 45; this.shake = 8; }
      if (ring.r >= ring.max_r) this.b6QuakeRings.splice(i, 1);
    }
    const shI = [95, 78, 62, 48];
    if (this.timer % shI[this.phase - 1] === 0) {
      this.bossBullets.push({ p: [this.bx + rand(-75, 75), this.by + 20], v: [0, 2.75], c: C_GOLD, r: 8, type: 'shrapnel_missile', target_y: pcy - rand(40, 125), shrapnel_count: 6 + this.phase * 2 });
    }
    if (this.phase >= 2 && this.timer % (100 - this.phase * 10) === 0) this.addBulletAim(this.bx, this.by, pcx, pcy, C_ORANGE, 6, 4.5, 0.17);
    if (this.phase >= 3 && this.timer % 72 === 0) { [-1, 1].forEach(s => this.addBulletAim(this.bx, this.by, pcx, pcy, C_ORANGE, 6, 4, s * 0.26)); }
    if (this.phase === 4 && this.timer % 45 === 0) { for (let k = 0; k < 3; k++) this.addBulletAim(this.bx, this.by, pcx, pcy, C_RED, 6, 5.5, 0.087); }
    this.updateLasers(pcx, pcy, p_hit_r, 22);
  }

  updateBoss7(pcx, pcy, p_hit_r) {
    const cx = WIDTH / 2, cy = 125;
    const tspd = this.b7Enraged ? 0.085 : 0.040;
    this.b7Pos1 = [cx - 110 + Math.cos(this.timer * tspd) * 160, cy + Math.sin(this.timer * tspd * 1.6) * 90];
    this.b7Pos2 = [cx + 110 + Math.cos(this.timer * tspd + Math.PI) * 160, cy + Math.sin(this.timer * tspd * 1.6 + Math.PI) * 90];
    const wasEnraged = this.b7Enraged;
    this.b7Enraged = this.bhp < this.bmax / 2;
    this.bx = cx; this.by = cy;
    // 체력 절반: 두 번째 기체가 터지고 연결 레이저가 끊김 (원본은 보이지 않는 기체에 레이저가 계속 이어졌음)
    if (this.b7Enraged && !wasEnraged) {
      this.spawnParticles(this.b7Pos2[0], this.b7Pos2[1], C_ORANGE, 20, 10, 8);
      this.flash = 60; this.flashColor = C_RED; this.shake = 14;
    }

    // link laser damage (두 기체가 이어져 있을 때만)
    if (!this.b7Enraged) {
      const [x1, y1] = this.b7Pos1, [x2, y2] = this.b7Pos2;
      const dx = x2 - x1, dy = y2 - y1;
      const tl = clamp(((pcx - x1) * dx + (pcy - y1) * dy) / (dx * dx + dy * dy + 1e-9), 0, 1);
      if (dist(x1 + tl * dx, y1 + tl * dy, pcx, pcy) < p_hit_r && this.itime === 0) {
        this.php -= 6; this.itime = 40; this.shake = 12;
      }
    }
    // 쏘는 기체: 이어져 있으면 둘, 갈라지면 남은 기체가 두 발씩 (탄 수는 원본과 같음)
    const guns = this.b7Enraged ? [[this.b7Pos1, -0.12], [this.b7Pos1, 0.12]] : [[this.b7Pos1, 0], [this.b7Pos2, 0]];
    const fireI = [35, 28, 22, 16];
    if (this.timer % fireI[this.phase - 1] === 0) {
      for (const [pos, off] of guns) {
        const a = Math.atan2(pcy - pos[1], pcx - pos[0]) + off;
        this.bossBullets.push({ p: [pos[0], pos[1]], v: [Math.cos(a) * 4.5, Math.sin(a) * 4.5], c: C_RED, r: 4 });
      }
    }
    const chargeC = [220, 190, 160, 130];
    const cc = chargeC[this.phase - 1];
    if (this.timer % cc === 30) {
      for (const [pos, off] of guns) {
        const a = Math.atan2(pcy - pos[1], pcx - pos[0]) + off;
        this.bossBullets.push({ p: [pos[0], pos[1]], v: [Math.cos(a) * 9, Math.sin(a) * 9], c: C_WHITE, r: 11 });
      }
    }
    if (this.b7Enraged) {
      if (this.timer % 70 === 0) {
        for (const [pos, off] of guns) {
          const a = Math.atan2(pcy - pos[1], pcx - pos[0]) + off;
          this.bossBullets.push({ p: [pos[0], pos[1]], v: [Math.cos(a) * 3.5, Math.sin(a) * 3.5], c: C_RED, r: 19, type: 'plasma_saw', spin_angle: 0 });
        }
      }
      if (this.timer % 55 === 0) this.addBulletRadial(this.b7Pos1[0], this.b7Pos1[1], 45, C_ORANGE, 4, 3);
    }
  }

  updateBoss8(pcx, pcy, p_hit_r) {
    this.bx = WIDTH / 2; this.by = 125;
    this.b8Clones = [
      [this.bx - 150, this.by],
      [this.bx - 50, this.by + 60],
      [this.bx + 50, this.by + 60],
      [this.bx + 150, this.by],
    ];
    this.b8RealIdx = Math.floor(this.timer / 300) % 4;
    this.b8GravityTimer++;
    if (this.b8GravityTimer >= 400) this.b8GravityTimer = 0;
    this.b8GravityActive = this.b8GravityTimer < 200;
    if (this.b8GravityActive) {
      if (this.timer % 12 === 0) {
        const a = rnd360();
        const sx = pcx + Math.cos(a) * 200, sy = pcy + Math.sin(a) * 200;
        this.bossBullets.push({ p: [sx, sy], v: [-Math.cos(a) * 2.75, -Math.sin(a) * 2.75], c: C_PURPLE, r: 5 });
      }
      if (this.phase >= 3) {
        const dx = WIDTH / 2 - pcx, dy = HEIGHT / 2 - pcy;
        const d = Math.hypot(dx, dy) + 1e-9;
        this.px += (dx / d) * (this.phase === 3 ? 0.75 : 1.25);
        this.py += (dy / d) * (this.phase === 3 ? 0.75 : 1.25);
      }
    }
    if (this.timer % 110 === 0) {
      const pos = this.b8Clones[this.b8RealIdx];
      const a = Math.atan2(pcy - pos[1], pcx - pos[0]);
      this.bossBullets.push({ p: [pos[0], pos[1]], v: [Math.cos(a) * 4.5, Math.sin(a) * 4.5], c: C_GOLD, r: 8, type: 'mirror_bounce', bounces: 3 });
    }
    const fireI = [55, 44, 33, 24];
    if (this.timer % fireI[this.phase - 1] === 0) {
      for (let j = 0; j < this.b8Clones.length; j++) {
        const pos = this.b8Clones[j];
        if (j === this.b8RealIdx) {
          const a = Math.atan2(pcy - pos[1], pcx - pos[0]);
          this.bossBullets.push({ p: [pos[0], pos[1]], v: [Math.cos(a) * 6.5, Math.sin(a) * 6.5], c: C_GOLD, r: 6 });
        } else if (this.phase >= 3) {
          const a = Math.atan2(pcy - pos[1], pcx - pos[0]) + rand(-0.35, 0.35);
          this.bossBullets.push({ p: [pos[0], pos[1]], v: [Math.cos(a) * 4, Math.sin(a) * 4], c: C_PURPLE, r: 4 });
        } else {
          const a = Math.PI / 2 + Math.sin(this.timer * 0.05 + j) * 0.5;
          this.bossBullets.push({ p: [pos[0], pos[1]], v: [Math.cos(a) * 3.5, Math.sin(a) * 3.5], c: C_PURPLE, r: 4 });
        }
      }
    }
  }

  updateBoss9(pcx, pcy, p_hit_r) {
    const cycle = this.timer % 380;
    if (cycle < 160) {
      this.b9Submerged = true;
      this.b9Alpha = Math.max(20, this.b9Alpha - 10);
      if (cycle === 20) { this.b9SonarPos = [pcx, pcy]; this.b9SonarRadius = 250; }
      this.b9SonarRadius = Math.max(0, this.b9SonarRadius - 1.75);
      if (Math.abs(this.b9SonarRadius - 7) < 2 && this.itime === 0 && dist(pcx, pcy, this.b9SonarPos[0], this.b9SonarPos[1]) < 90) {
        this.php -= 18; this.itime = 40; this.flash = 30; this.shake = 8;
      }
      if (this.phase === 4 && cycle === 80) {
        for (const off of [0, Math.PI / 2]) {
          const a = rnd360() + off;
          const sx = pcx + Math.cos(a) * 150, sy = pcy + Math.sin(a) * 150;
          this.bossBullets.push({ p: [sx, sy], v: [-Math.cos(a) * 2.5, -Math.sin(a) * 2.5], c: C_TEAL, r: 6 });
        }
      }
      this.bx = WIDTH / 2; this.by = 150;
    } else if (cycle < 230) {
      this.b9Submerged = false; this.b9Alpha = 255;
      const prog = (cycle - 160) / 50;
      this.bx = Math.round(this.b9SonarPos[0] + Math.sin(prog * Math.PI * 2) * 75);
      this.by = Math.round(-50 + prog * (HEIGHT + 100));
      if (dist(this.bx, this.by, pcx, pcy) < 70 && this.itime === 0) {
        this.php -= 30; this.itime = 50; this.shake = 20;
        this.spawnParticles(pcx, pcy, C_TEAL, 15);
      }
    } else {
      this.b9Submerged = false;
      this.b9Alpha = Math.min(255, this.b9Alpha + 15);
      this.bx = WIDTH / 2; this.by = Math.round(150 + Math.sin(this.timer * 0.05) * 7);
    }
    const fireI = [40, 32, 25, 18];
    if (this.timer % fireI[this.phase - 1] === 0 && !this.b9Submerged) {
      const n = 1 + Math.floor(this.phase / 2);
      for (let j = 0; j < n; j++) {
        this.bossBullets.push({ p: [this.bx, this.by], v: [rand(-2.5, 2.5), 3.5], c: C_SKY, r: 5 });
      }
    }
    if (this.phase >= 2 && this.timer % Math.max(40, 130 - this.phase * 15) === 0) {
      this.b2Mines.push({ x: rand(75, WIDTH - 75), y: rand(175, HEIGHT - 150), vy: 0.75, timer: 110, r: 13, is_water_mine: true });
    }
  }

  updateBoss10(pcx, pcy, p_hit_r) {
    this.bx = WIDTH / 2; this.by = 175;
    this.b5CorePulse = Math.sin(this.timer * 0.15) * 6 + 3;
    const bhActive = this.phase >= 3;
    if (bhActive) {
      this.b10TimeAttack--;
      if (this.b10TimeAttack <= 0) { this.php = 0; return; }
      const dx = this.bx - pcx, dy = this.by - pcy;
      const d = Math.hypot(dx, dy);
      if (d > 5) { const pull = this.phase === 3 ? 1.75 : 2.75; this.px += (dx / d) * pull; this.py += (dy / d) * pull; }
      if (d < 90 && this.itime === 0) { this.php -= 4; this.itime = 10; }
      const lc = this.phase === 3 ? 3 : 5;
      for (let j = 0; j < lc; j++) {
        const a = this.timer * 0.018 + j * (TAU / lc);
        const lex = this.bx + Math.cos(a) * 1200, ley = this.by + Math.sin(a) * 1200;
        const ldx = lex - this.bx, ldy = ley - this.by;
        const tl = clamp(((this.px + 17 - this.bx) * ldx + (this.py + 17 - this.by) * ldy) / (ldx * ldx + ldy * ldy + 1e-9), 0, 1);
        if (this.phaseTimer > BEAM_WARMUP && dist(this.bx + tl * ldx, this.by + tl * ldy, pcx, pcy) < p_hit_r && this.itime === 0) {
          this.php -= 20; this.itime = 45; this.shake = 12;
        }
      }
    }
    if (this.phase === 1) {
      if (this.timer % 22 === 0) { for (const off of [0, 0.26, -0.26]) { const a = Math.atan2(pcy - this.by, pcx - this.bx) + off; this.bossBullets.push({ p: [this.bx, this.by], v: [Math.cos(a) * 5, Math.sin(a) * 5], c: C_GOLD, r: 6 }); } }
    } else if (this.phase === 2) {
      if (this.timer % 18 === 0) { for (let j = 0; j < 8; j++) { const a = this.timer * 0.1 + j * TAU / 8; this.bossBullets.push({ p: [this.bx, this.by], v: [Math.cos(a) * 4.5, Math.sin(a) * 4.5], c: C_ORANGE, r: 5 }); } }
    } else if (this.phase === 3) {
      if (this.timer % 15 === 0) { for (const ro of [0, Math.PI / 8]) { for (let j = 0; j < 8; j++) { const a = this.timer * 0.12 + j * TAU / 8 + ro; this.bossBullets.push({ p: [this.bx, this.by], v: [Math.cos(a) * 4.5, Math.sin(a) * 4.5], c: C_ORANGE, r: 5 }); } } }
    } else {
      if (this.timer % 12 === 0) { for (let j = 0; j < 12; j++) { const a = this.timer * 0.14 + j * TAU / 12; this.bossBullets.push({ p: [this.bx, this.by], v: [Math.cos(a) * 5.5, Math.sin(a) * 5.5], c: C_RED, r: 5 }); } }
      if (this.timer % 20 === 0) { const a = Math.atan2(pcy - this.by, pcx - this.bx); this.bossBullets.push({ p: [this.bx, this.by], v: [Math.cos(a) * 7, Math.sin(a) * 7], c: C_WHITE, r: 7 }); }
    }
  }

  // ─── RENDER ───────────────────────────────
  render() {
    const ctx = this.ctx;
    // clear the ENTIRE canvas before any transform so shake never leaves edge ghosts
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    ctx.save();
    // defensive reset — wipes any shadow/composite state that leaked from last frame
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    const ox = this.shake > 0 ? rand(-this.shake, this.shake) : 0;
    const oy = this.shake > 0 ? rand(-this.shake, this.shake) : 0;
    ctx.translate(ox, oy);

    ctx.fillStyle = C_BG;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    this.renderStars();

    switch (this.state) {
      case 'LOBBY': this.renderLobby(); break;
      case 'HANGAR': this.renderHangar(); break;
      case 'UPGRADE': this.renderUpgrade(); break;
      case 'STAGE_SELECT': this.renderStageSelect(); break;
      case 'PLAY': this.renderPlay(); break;
      case 'TRANSITION': this.renderTransition(); break;
      case 'WIN': this.renderWin(); break;
    }

    // flash
    if (this.flash > 0) {
      ctx.save();
      const [r, g, b] = hexToRgb(this.flashColor);
      ctx.fillStyle = `rgba(${r},${g},${b},${this.flash / 255})`;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.restore();
    }

    // scanlines
    ctx.fillStyle = 'rgba(0,0,0,0.04)';
    for (let y = 0; y < HEIGHT; y += 3) {
      ctx.fillRect(0, y, WIDTH, 1);
    }

    ctx.restore();
  }

  // ─── draw helpers ─────────────────────────
  text(txt, x, y, color, size, center = false, bold = true) {
    const ctx = this.ctx;
    ctx.font = `${bold ? 'bold ' : ''}${size}px ${FONT_STACK}`;
    ctx.fillStyle = color;
    if (center) { ctx.textAlign = 'center'; ctx.fillText(txt, x, y); ctx.textAlign = 'left'; }
    else ctx.fillText(txt, x, y);
  }
  glowText(txt, x, y, color, size, center = false) {
    const ctx = this.ctx;
    ctx.font = `bold ${size}px ${FONT_STACK}`;
    ctx.save();
    const [r, g, b] = hexToRgb(color);
    // 네온 빛: 원본은 글자를 2px 씩 24번 겹쳐 찍어 빛을 냈지만, 한글은 획이 촘촘해 작은 글자가 뭉개집니다.
    // 그래서 그림자 번짐으로 빛을 내고, 그 위에 글자를 한 번 더 또렷하게 찍습니다.
    ctx.shadowColor = `rgba(${r},${g},${b},0.9)`;
    ctx.shadowBlur = Math.max(4, size * 0.45);
    ctx.fillStyle = color;
    if (center) ctx.textAlign = 'center';
    ctx.fillText(txt, x, y);
    ctx.shadowBlur = 0; ctx.shadowColor = 'transparent';
    ctx.fillText(txt, x, y);
    if (center) ctx.textAlign = 'left';
    ctx.restore();
  }
  circle(x, y, r, color, fill = true, lw = 2) {
    const ctx = this.ctx;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU);
    if (fill) { ctx.fillStyle = color; ctx.fill(); }
    else { ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.stroke(); }
  }
  line(x1, y1, x2, y2, color, lw = 1) {
    const ctx = this.ctx;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.stroke();
  }
  rect(x, y, w, h, color, fill = true, radius = 4, lw = 1) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radius);
    if (fill) { ctx.fillStyle = color; ctx.fill(); }
    else { ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.stroke(); }
  }
  poly(pts, color, fill = true, lw = 2) {
    const ctx = this.ctx;
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (const p of pts.slice(1)) ctx.lineTo(p[0], p[1]);
    ctx.closePath();
    if (fill) { ctx.fillStyle = color; ctx.fill(); }
    else { ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.stroke(); }
  }
  neonRect(x, y, w, h, color, lw = 2) {
    // glow
    this.ctx.save();
    this.ctx.shadowBlur = 8; this.ctx.shadowColor = color;
    this.rect(x, y, w, h, color, false, 5, lw);
    this.ctx.shadowBlur = 0; this.ctx.restore();
  }

  /** 레이저 충전 (k: 0 → 1): 조준선이 점점 밝고 굵어지고, 쏘는 곳에 빛이 모임 */
  laserCharge(x1, y1, x2, y2, k, color) {
    this.line(x1, y1, x2, y2, colorWithAlpha(C_WHITE, 0.15 + 0.25 * k), 1 + 1.5 * k);
    this.line(x1, y1, x2, y2, colorWithAlpha(color, 0.12 + 0.3 * k), 3 + 3 * k);
    this.circle(x1, y1, 3 + 8 * k, colorWithAlpha(color, 0.35 + 0.45 * k));
    this.circle(x1, y1, 1.5 + 3 * k, colorWithAlpha(C_WHITE, 0.5 + 0.4 * k));
  }

  renderStars() {
    const ctx = this.ctx;
    for (const s of this.stars) {
      s[2] += s[3];
      const br = Math.round(100 + 80 * Math.sin(s[2]));
      ctx.fillStyle = `rgb(${br},${br},${Math.min(255, br + 50)})`;
      ctx.fillRect(s[0] | 0, s[1] | 0, s[4], s[4]);
    }
  }

  // ─── LOBBY ────────────────────────────────
  renderLobby() {
    const t = this.lobbyTimer;
    const pulse = 0.85 + 0.15 * Math.sin(t * 0.05);
    const cx = WIDTH / 2;

    // spinning rings
    const ctx = this.ctx;
    for (let i = 0; i < 3; i++) {
      const r = [160, 220, 290][i];
      const ang = t * 0.008 * (i % 2 === 0 ? 1 : -1);
      const col = [C_CYAN, C_MAGENTA, C_PURPLE][i];
      ctx.save();
      ctx.strokeStyle = colorWithAlpha(col, 0.3);
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let k = 0; k <= 60; k++) {
        const a = ang + k * TAU / 60;
        const x = cx + Math.cos(a) * r, y = HEIGHT / 2 + Math.sin(a) * r;
        k === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.closePath(); ctx.stroke(); ctx.restore();
    }

    const titleC = rgbToHex(0, 255 * pulse, 255 * pulse);
    this.glowText('네온 레이드', cx, HEIGHT / 2 - 280, titleC, 40, true);
    this.glowText('영원한 지배자', cx, HEIGHT / 2 - 235, rgbToHex(255 * pulse, 0, 255 * pulse), 22, true);

    ctx.save(); ctx.strokeStyle = colorWithAlpha(C_CYAN, 0.4); ctx.lineWidth = 1;
    const lw = 220 + 40 * Math.sin(t * 0.04);
    ctx.beginPath(); ctx.moveTo(cx - lw / 2, HEIGHT / 2 - 208); ctx.lineTo(cx + lw / 2, HEIGHT / 2 - 208); ctx.stroke(); ctx.restore();

    this.glowText(`⬡ ${this.save.coins}`, cx, HEIGHT / 2 - 180, C_COIN, 20, true);

    const char = CHARACTERS[this.save.selected_char];
    this.glowText(`조종사: ${char.name}`, cx, HEIGHT / 2 - 148, char.color, 13, true);
    this.text(char.desc, cx, HEIGHT / 2 - 128, '#888899', 10, true);

    const btns = [
      { label: '▶  도전', color: C_CYAN, y: HEIGHT / 2 + 100 },
      { label: '⚙  격납고',   color: C_ORANGE, y: HEIGHT / 2 + 175 },
      { label: '▲  강화',  color: C_LIME, y: HEIGHT / 2 + 243 },
    ];
    for (const btn of btns) {
      const hov = this.inRect(this.mouseX, this.mouseY, cx - 150, btn.y, 300, 55);
      const c = hov ? C_WHITE : btn.color;
      if (hov) {
        ctx.save(); ctx.fillStyle = colorWithAlpha(btn.color, 0.1);
        ctx.roundRect(cx - 150, btn.y, 300, 55, 6); ctx.fill(); ctx.restore();
      }
      this.neonRect(cx - 150, btn.y, 300, 55, c);
      this.glowText(btn.label, cx, btn.y + 33, c, 14, true);
    }

    this.text('WASD / 방향키로 이동  ·  공격은 항상 자동', cx, HEIGHT - 30, '#404050', 9, true);
  }

  // ─── HANGAR ───────────────────────────────
  renderHangar() {
    const ctx = this.ctx;
    this.glowText('조종사 격납고', WIDTH / 2, 45, C_ORANGE, 22, true);
    this.line(30, 60, WIDTH - 30, 60, '#2a2a38', 1);
    this.glowText(`⬡ ${this.save.coins}`, WIDTH - 15, 55, C_COIN, 13);
    ctx.textAlign = 'right'; ctx.fillStyle = C_COIN; ctx.font = `bold 13px ${FONT_STACK}`; ctx.fillText(`⬡ ${this.save.coins}`, WIDTH - 15, 55); ctx.textAlign = 'left';

    for (let cid = 0; cid < 5; cid++) {
      const char = CHARACTERS[cid];
      const cy = 80 + cid * 115;
      const owned = this.save.owned_chars.includes(cid);
      const selected = this.save.selected_char === cid;
      const preview = this.selectedCharPreview === cid;
      const col = owned ? char.color : '#404050';

      ctx.save();
      ctx.fillStyle = selected ? colorWithAlpha(char.color, 0.08) : (preview ? colorWithAlpha(char.color, 0.04) : 'rgba(8,8,15,0.9)');
      ctx.beginPath(); ctx.roundRect(30, cy, WIDTH - 60, 105, 5); ctx.fill();
      ctx.strokeStyle = selected ? char.color : (preview ? colorWithAlpha(char.color, 0.6) : '#303040');
      ctx.lineWidth = selected ? 2 : 1; ctx.beginPath(); ctx.roundRect(30, cy, WIDTH - 60, 105, 5); ctx.stroke();
      ctx.restore();

      this.text(char.icon, 50, cy + 60, col, 22);
      this.line(78, cy + 8, 78, cy + 97, colorWithAlpha(col, 0.3), 1);
      this.text(char.name, 88, cy + 25, col, 13);
      this.text(char.desc, 88, cy + 42, owned ? '#909090' : '#404040', 10);

      // stat bars
      const stats = [['속도', char.speed_bonus + 5], ['체력', (char.hp_bonus + 150) / 30 | 0], ['연사', 10 - char.fire_rate]];
      for (let si = 0; si < 3; si++) {
        const [sn, sv] = stats[si];
        this.text(sn, 88 + si * 62, cy + 62, '#606070', 8);
        for (let bi = 0; bi < 5; bi++) {
          const fx = 88 + si * 62 + 22 + bi * 8;
          const filled = owned && bi < Math.max(1, sv / 2);
          ctx.fillStyle = filled ? char.color : '#2a2a38';
          ctx.fillRect(fx, cy + 53, 6, 5);
        }
      }
      this.text(`특수 사격: ${char.special_name}`, 88, cy + 76, colorWithAlpha(col, 0.8), 9);

      if (selected) {
        ctx.fillStyle = colorWithAlpha(char.color, 0.85); ctx.beginPath(); ctx.roundRect(WIDTH - 95, cy + 10, 60, 22, 3); ctx.fill();
        this.text('사용 중', WIDTH - 84, cy + 24, C_BG, 10);
      } else if (owned) {
        const hov = this.inRect(this.mouseX, this.mouseY, WIDTH - 110, cy + 30, 95, 40);
        this.rect(WIDTH - 110, cy + 30, 95, 40, hov ? colorWithAlpha(char.color, 0.9) : '#1a1a28', true, 4);
        this.rect(WIDTH - 110, cy + 30, 95, 40, char.color, false, 4, 1);
        this.text('선택', WIDTH - 73, cy + 55, hov ? C_BG : char.color, 11, true);
      } else {
        this.text(`⬡ ${char.cost}`, WIDTH - 80, cy + 25, C_COIN, 10, true);
        const canBuy = this.save.coins >= char.cost;
        const hov = this.inRect(this.mouseX, this.mouseY, WIDTH - 110, cy + 55, 95, 35);
        const bc = canBuy ? C_COIN : '#333340';
        this.rect(WIDTH - 110, cy + 55, 95, 35, '#151520', true, 4);
        this.rect(WIDTH - 110, cy + 55, 95, 35, bc, false, 4, 1);
        this.text(canBuy ? '구매' : '잠김', WIDTH - 73, cy + 77, bc, 10, true);
      }
    }

    const hov = this.inRect(this.mouseX, this.mouseY, 30, HEIGHT - 90, 140, 50);
    this.rect(30, HEIGHT - 90, 140, 50, '#141420', true, 5);
    this.rect(30, HEIGHT - 90, 140, 50, hov ? C_WHITE : '#808090', false, 5, 1);
    this.text('← 뒤로', 100, HEIGHT - 58, hov ? C_WHITE : '#808090', 12, true);
  }

  // ─── UPGRADE ──────────────────────────────
  renderUpgrade() {
    const ctx = this.ctx;
    this.glowText('강화', WIDTH / 2, 45, C_LIME, 22, true);
    this.line(30, 58, WIDTH - 30, 58, '#2a2a38', 1);
    ctx.textAlign = 'right'; ctx.font = `bold 12px ${FONT_STACK}`; ctx.fillStyle = C_COIN; ctx.fillText(`⬡ ${this.save.coins}`, WIDTH - 15, 53); ctx.textAlign = 'left';

    const keys = Object.keys(UPGRADES);
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const upg = UPGRADES[key];
      const lv = this.save.upgrades[key];
      const maxed = lv >= upg.max;
      const cy = 75 + i * 108;
      const col = upg.color;

      ctx.fillStyle = maxed ? colorWithAlpha(C_GREEN, 0.05) : colorWithAlpha(col, 0.04);
      ctx.beginPath(); ctx.roundRect(30, cy, WIDTH - 60, 96, 5); ctx.fill();
      ctx.strokeStyle = maxed ? C_GREEN : col; ctx.lineWidth = maxed ? 2 : 1;
      ctx.beginPath(); ctx.roundRect(30, cy, WIDTH - 60, 96, 5); ctx.stroke();

      this.text(upg.icon, 46, cy + 54, col, 18);
      this.line(72, cy + 8, 72, cy + 88, colorWithAlpha(col, 0.3), 1);
      this.text(upg.name, 82, cy + 22, col, 12);
      this.text(upg.desc, 82, cy + 38, '#909090', 9);
      this.text(`레벨 ${lv} / ${upg.max}`, 82, cy + 55, col, 9);
      for (let bi = 0; bi < upg.max; bi++) {
        ctx.fillStyle = bi < lv ? col : '#252535';
        ctx.fillRect(82 + 42 + bi * 20, cy + 46, 14, 6);
        if (bi >= lv) { ctx.strokeStyle = '#3a3a4a'; ctx.lineWidth = 0.5; ctx.strokeRect(82 + 42 + bi * 20, cy + 46, 14, 6); }
      }

      if (maxed) {
        this.text('최대!', WIDTH - 80, cy + 50, C_GREEN, 11, true);
      } else {
        const cost = upg.costs[lv];
        const can = this.save.coins >= cost;
        const hov = this.inRect(this.mouseX, this.mouseY, WIDTH - 130, cy + 28, 110, 48);
        ctx.fillStyle = can && hov ? colorWithAlpha(col, 0.7) : '#151520'; ctx.beginPath(); ctx.roundRect(WIDTH - 130, cy + 28, 110, 48, 5); ctx.fill();
        ctx.strokeStyle = can ? col : '#333340'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(WIDTH - 130, cy + 28, 110, 48, 5); ctx.stroke();
        this.text(`⬡ ${cost}`, WIDTH - 75, cy + 45, can ? C_COIN : '#404040', 9, true);
        this.text('강화하기', WIDTH - 75, cy + 62, can ? col : '#404040', 10, true);
      }
    }

    const hov = this.inRect(this.mouseX, this.mouseY, 30, HEIGHT - 90, 140, 50);
    this.rect(30, HEIGHT - 90, 140, 50, '#141420', true, 5);
    this.rect(30, HEIGHT - 90, 140, 50, hov ? C_WHITE : '#808090', false, 5, 1);
    this.text('← 뒤로', 100, HEIGHT - 58, hov ? C_WHITE : '#808090', 12, true);
  }

  // ─── STAGE SELECT ─────────────────────────
  renderStageSelect() {
    const ctx = this.ctx;
    this.glowText('스테이지 선택', WIDTH / 2, 45, C_WHITE, 22, true);
    this.line(30, 58, WIDTH - 30, 58, '#2a2a38', 1);

    const ch1Done = [1,2,3,4,5].every(s => this.save.cleared_stages.includes(s));

    // Chapter tabs
    const t1hov = this.inRect(this.mouseX, this.mouseY, 30, 75, 210, 40);
    const t2hov = this.inRect(this.mouseX, this.mouseY, WIDTH - 240, 75, 210, 40);
    const t1col = this.currentChapter === 1 ? C_CYAN : (t1hov ? C_WHITE : '#808090');
    const t2col = !ch1Done ? '#404050' : (this.currentChapter === 2 ? C_MAGENTA : (t2hov ? C_WHITE : '#808090'));
    this.rect(30, 75, 210, 40, '#141420', true, 5);
    this.rect(30, 75, 210, 40, t1col, false, 5, this.currentChapter === 1 ? 2 : 1);
    this.text('1장', 135, 100, t1col, 11, true);
    this.rect(WIDTH - 240, 75, 210, 40, '#141420', true, 5);
    this.rect(WIDTH - 240, 75, 210, 40, t2col, false, 5, this.currentChapter === 2 ? 2 : 1);
    this.text(ch1Done ? '2장' : '🔒 2장', WIDTH - 135, 100, t2col, 11, true);

    const range = this.currentChapter === 1 ? [1,2,3,4,5] : [6,7,8,9,10];
    for (let i = 0; i < 5; i++) {
      const sid = range[i];
      const info = STAGE_INFO[sid];
      const unlocked = sid === 1 || sid === 6 || this.save.cleared_stages.includes(sid - 1);
      const cleared = this.save.cleared_stages.includes(sid);
      const sel = this.selectedStage === sid;
      const col = unlocked ? info.color : '#404050';
      const cy = 130 + i * 115;

      ctx.fillStyle = sel ? colorWithAlpha(col, 0.1) : (cleared ? 'rgba(0,100,50,0.05)' : 'rgba(8,8,15,0.9)');
      ctx.roundRect(30, cy, WIDTH - 60, 105, 5); ctx.fill();
      ctx.strokeStyle = sel ? col : (cleared ? C_GREEN : '#2a2a38'); ctx.lineWidth = sel ? 2 : 1;
      ctx.beginPath(); ctx.roundRect(30, cy, WIDTH - 60, 105, 5); ctx.stroke();

      if (!unlocked) {
        this.text('잠김', WIDTH / 2, cy + 58, '#505060', 18, true);
        continue;
      }

      const roman = ['I','II','III','IV','V','VI','VII','VIII','IX','X'][sid - 1];
      this.glowText(roman, 55, cy + 66, col, 20);
      this.line(88, cy + 10, 88, cy + 95, colorWithAlpha(col, 0.3), 1);
      this.text(info.name, 98, cy + 28, col, 12);
      this.text(info.desc, 98, cy + 44, '#909090', 9);
      const tl = sid <= 5 ? sid : sid - 5;
      this.text('위험도', 98, cy + 62, '#505060', 8);
      for (let d = 0; d < 5; d++) {
        ctx.fillStyle = d < tl ? col : '#252535';
        ctx.fillRect(128 + d * 14, cy + 53, 10, 5);
      }
      this.text(`체력: ${info.hp.toLocaleString()}`, 98, cy + 78, '#606070', 8);
      if (cleared) {
        ctx.fillStyle = 'rgba(0,160,60,0.8)'; ctx.roundRect(WIDTH - 90, cy + 12, 58, 20, 3); ctx.fill();
        this.text('클리어', WIDTH - 61, cy + 26, C_BG, 8, true);
      }
    }

    // buttons
    const bhov = this.inRect(this.mouseX, this.mouseY, 30, HEIGHT - 90, 140, 50);
    this.rect(30, HEIGHT - 90, 140, 50, '#141420', true, 5);
    this.rect(30, HEIGHT - 90, 140, 50, bhov ? C_WHITE : '#808090', false, 5, 1);
    this.text('← 뒤로', 100, HEIGHT - 58, bhov ? C_WHITE : '#808090', 12, true);

    const canLaunch = this.selectedStage === 1 || this.selectedStage === 6 || this.save.cleared_stages.includes(this.selectedStage - 1);
    if (canLaunch) {
      const lcol = STAGE_INFO[this.selectedStage].color;
      const lhov = this.inRect(this.mouseX, this.mouseY, WIDTH - 185, HEIGHT - 90, 160, 50);
      if (lhov) { ctx.fillStyle = colorWithAlpha(lcol, 0.15); ctx.roundRect(WIDTH - 185, HEIGHT - 90, 160, 50, 5); ctx.fill(); }
      this.rect(WIDTH - 185, HEIGHT - 90, 160, 50, lcol, false, 5, 2);
      this.glowText('▶ 출격', WIDTH - 105, HEIGHT - 60, lcol, 13, true);
    } else {
      this.rect(WIDTH - 185, HEIGHT - 90, 160, 50, '#252535', false, 5, 1);
      this.text('스테이지를 고르세요', WIDTH - 105, HEIGHT - 60, '#505060', 11, true);
    }
  }

  // ─── PLAY ─────────────────────────────────
  renderPlay() {
    const ctx = this.ctx;
    const { bx, by } = this;

    // boss
    this.renderBoss();

    // b6 quake rings
    for (const ring of this.b6QuakeRings) {
      if (ring.r < ring.max_r) this.circle(ring.x, ring.y, ring.r, ring.c, false, 3);
    }
    // emp rings
    for (const ring of this.b5EmpRings) {
      if (ring.r < ring.max_r) this.circle(ring.x, ring.y, ring.r, ring.c, false, 4);
    }
    // b2 rings
    for (const ring of this.b2Rings) {
      if (ring.r < ring.max_r) this.circle(ring.x, ring.y, ring.r, ring.c, false, 3);
    }

    // mines
    for (const mine of this.b2Mines) {
      if (mine.is_water_mine) {
        this.circle(mine.x, mine.y, mine.r, C_TEAL, false, 2);
        this.line(mine.x - mine.r, mine.y, mine.x + mine.r, mine.y, C_WHITE, 2);
        this.line(mine.x, mine.y - mine.r, mine.x, mine.y + mine.r, C_WHITE, 2);
      } else {
        const mc = mine.timer > 40 ? C_YELLOW : C_RED;
        this.circle(mine.x, mine.y, mine.r, mc, false, 2);
      }
    }

    // b2 beams
    for (const beam of this.b2Beams) {
      const ex = bx + Math.cos(beam.ang) * 1100, ey = by + Math.sin(beam.ang) * 1100;
      if ((beam.age || 0) <= BEAM_WARMUP) { this.laserCharge(bx, by, ex, ey, (beam.age || 0) / BEAM_WARMUP, this.bColor); continue; }
      this.line(bx, by, ex, ey, colorWithAlpha(C_WHITE, 0.4), 8);
      this.line(bx, by, ex, ey, colorWithAlpha(this.bColor, 0.7), 4);
    }

    // lasers
    for (const l of this.lasers) {
      const ep = [l.s[0] + Math.cos(l.ang) * 1200, l.s[1] + Math.sin(l.ang) * 1200];
      if (l.t > 15) {
        this.laserCharge(l.s[0], l.s[1], ep[0], ep[1], clamp(1 - (l.t - 15) / 40, 0, 1), this.bColor);
      } else {
        const w = l.t * 4;
        this.line(l.s[0], l.s[1], ep[0], ep[1], colorWithAlpha(C_WHITE, 0.7), w + 8);
        this.line(l.s[0], l.s[1], ep[0], ep[1], this.bColor, w + 3);
      }
    }

    // boss1 sweep laser (phase 4)
    if (this.bossStage === 1 && this.phase === 4) {
      // 맞는 판정과 같은 길이로 끝까지 (원본은 700 이라 화면 중간에서 끊겨 보였음)
      const ex = bx + Math.cos(this.b1SweepAng) * 1200;
      const ey = by + Math.sin(this.b1SweepAng) * 1200;
      if (this.phaseTimer <= BEAM_WARMUP) this.laserCharge(bx, by, ex, ey, this.phaseTimer / BEAM_WARMUP, C_RED);
      else {
        this.line(bx, by, ex, ey, colorWithAlpha(C_RED, 0.7), 30);
        this.line(bx, by, ex, ey, colorWithAlpha(C_WHITE, 0.5), 12);
      }
    }

    // boss arm lasers (boss5)
    if (this.bossStage === 5) {
      const firing = this.b5ArmLaserActive && this.b5ArmLaserLife <= 40 - this.phase * 4;
      // 충전: 켜지기 30틱 전부터 팔 끝에서 조준선이 밝아짐 (원본은 예고 없이 갑자기 나타났음)
      const toOn = [180, 155, 125, 95][this.phase - 1] - this.b5ArmLaserTimer;
      const charging = !firing && (this.b5ArmLaserActive || toOn <= 30);
      if (firing || charging) {
        const k = this.b5ArmLaserActive ? 1 : clamp(1 - toOn / 30, 0, 1);
        const na = this.phase < 2 ? 4 : (this.phase < 4 ? 6 : 8);
        const al = 65 + this.phase * 5;
        for (let j = 0; j < na; j++) {
          const a = this.b5ArmAng + j * TAU / na;
          const tx = this.bx + Math.cos(a) * al, ty = this.by + Math.sin(a) * al;
          const ex = tx + Math.cos(a) * 1200, ey = ty + Math.sin(a) * 1200;   // 판정과 같은 길이 (원본 700)
          if (!firing) { this.laserCharge(tx, ty, ex, ey, k, this.bColor); continue; }
          this.line(tx, ty, ex, ey, colorWithAlpha(C_WHITE, 0.6), 8);
          this.line(tx, ty, ex, ey, this.bColor, 4);
        }
      }
    }

    // boss10 blackhole lasers
    if (this.bossStage === 10 && this.phase >= 3) {
      const lc = this.phase === 3 ? 3 : 5;
      for (let j = 0; j < lc; j++) {
        const a = this.timer * 0.018 + j * (TAU / lc);
        const ex = this.bx + Math.cos(a) * 1200, ey = this.by + Math.sin(a) * 1200;   // 판정과 같은 길이 (원본 700)
        if (this.phaseTimer <= BEAM_WARMUP) { this.laserCharge(this.bx, this.by, ex, ey, this.phaseTimer / BEAM_WARMUP, C_GOLD); continue; }
        this.line(this.bx, this.by, ex, ey, colorWithAlpha(C_GOLD, 0.6), 5);
        this.line(this.bx, this.by, ex, ey, colorWithAlpha(C_WHITE, 0.3), 2);
      }
    }

    // boss7 link laser
    if (this.bossStage === 7 && !this.b7Enraged) {   // 갈라지면 연결 레이저도 사라짐
      const lc = C_SKY;
      this.line(this.b7Pos1[0], this.b7Pos1[1], this.b7Pos2[0], this.b7Pos2[1], colorWithAlpha(C_WHITE, 0.4), 6);
      this.line(this.b7Pos1[0], this.b7Pos1[1], this.b7Pos2[0], this.b7Pos2[1], colorWithAlpha(lc, 0.6), 3);
    }

    // boss8 gravity ring
    if (this.bossStage === 8 && this.b8GravityActive) {
      const r = 300 + Math.sin(this.timer * 0.2) * 20;
      ctx.save();
      ctx.strokeStyle = colorWithAlpha(C_PURPLE, 0.2);
      ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.arc(WIDTH / 2, HEIGHT / 2, r, 0, TAU); ctx.stroke();
      ctx.setLineDash([]); ctx.restore();
      this.glowText('⚠ 중력 왜곡', WIDTH / 2, HEIGHT / 2 - 100, C_PURPLE, 10, true);
    }

    // boss9 sonar
    if (this.bossStage === 9 && this.b9SonarRadius > 0) {
      this.circle(this.b9SonarPos[0], this.b9SonarPos[1], this.b9SonarRadius, colorWithAlpha(C_TEAL, 0.5), false, 2);
    }

    // b4 sickle blades
    for (const blade of this.b4SickleBlades) {
      const [bpx, bpy] = blade.p;
      const a = blade.ang;
      const pts = [
        [bpx + Math.cos(a) * 9, bpy + Math.sin(a) * 9],
        [bpx + Math.cos(a + 2.4) * 6, bpy + Math.sin(a + 2.4) * 6],
        [bpx + Math.cos(a - 2.4) * 6, bpy + Math.sin(a - 2.4) * 6],
      ];
      this.poly(pts, C_PURPLE);
      this.poly(pts, C_WHITE, false, 1);
    }

    // boss bullets
    for (const bb of this.bossBullets) {
      const bpx = bb.p[0] | 0, bpy = bb.p[1] | 0;
      if (bb.type === 'plasma_saw') {
        const sa = bb.spin_angle || 0;
        ctx.save();
        ctx.strokeStyle = C_RED; ctx.lineWidth = 2;
        ctx.beginPath();
        for (let k = 0; k < 8; k++) {
          const ang = sa + k * TAU / 8;
          const r = k % 2 === 0 ? (bb.r || 19) : (bb.r || 19) / 2;
          k === 0 ? ctx.moveTo(bpx + Math.cos(ang) * r, bpy + Math.sin(ang) * r) : ctx.lineTo(bpx + Math.cos(ang) * r, bpy + Math.sin(ang) * r);
        }
        ctx.closePath(); ctx.stroke(); ctx.restore();
      } else {
        const r = bb.r || 5;
        const c = bb.c || this.bColor;
        ctx.save();
        ctx.shadowBlur = 4; ctx.shadowColor = c;
        this.circle(bpx, bpy, r, c);
        ctx.restore();
      }
    }

    // player bullets
    for (const b of this.bullets) {
      const bc = b.c || C_CYAN;
      const br = b.r || 5;
      ctx.save(); ctx.shadowBlur = 4; ctx.shadowColor = bc;
      this.circle(b.p[0] | 0, b.p[1] | 0, br, bc);
      ctx.restore();
    }

    // attack orbs
    for (const o of this.orbs) {
      const oy = o.y + Math.sin(o.t) * 5;
      ctx.save(); ctx.shadowBlur = 6; ctx.shadowColor = C_CYAN;
      this.circle(o.x, oy | 0, 11, C_CYAN, false, 2);
      this.circle(o.x, oy | 0, 4, C_WHITE);
      ctx.restore();
    }

    // heal orbs
    for (const h of this.healOrbs) {
      const hy = h.y + Math.sin(h.t) * 6;
      ctx.save(); ctx.shadowBlur = 6; ctx.shadowColor = C_GREEN;
      this.circle(h.x, hy | 0, 12, C_GREEN, false, 2);
      this.circle(h.x, hy | 0, 5, C_WHITE);
      this.line(h.x - 5, hy | 0, h.x + 5, hy | 0, C_WHITE, 2);
      this.line(h.x, (hy - 5) | 0, h.x, (hy + 5) | 0, C_WHITE, 2);
      ctx.restore();
    }

    // coin orbs
    for (const coin of this.coinOrbs) {
      const cy2 = coin.y + Math.sin(coin.t) * 4;
      ctx.save(); ctx.shadowBlur = 5; ctx.shadowColor = C_COIN;
      this.circle(coin.x, cy2 | 0, 8, C_COIN);
      this.circle(coin.x, cy2 | 0, 5, '#FFE868');
      ctx.restore();
      this.text('¢', coin.x, (cy2 + 5) | 0, '#503000', 8, true);
    }

    // particles
    for (const p of this.particles) {
      const li = p.life;
      const [r, g, b2] = hexToRgb(p.c);
      ctx.fillStyle = `rgba(${r * li | 0},${g * li | 0},${b2 * li | 0},${li})`;
      const sz = Math.max(1, p.size * li | 0);
      ctx.fillRect((p.x - sz / 2) | 0, (p.y - sz / 2) | 0, sz, sz);
    }

    // player
    this.renderPlayer();

    // HUD
    this.renderHUD();

    // joystick
    ctx.save();
    ctx.strokeStyle = colorWithAlpha(C_CYAN, 0.3); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(this.joyBase[0], this.joyBase[1], 42, 0, TAU); ctx.stroke();
    ctx.fillStyle = colorWithAlpha(C_CYAN, 0.35);
    ctx.beginPath(); ctx.arc(this.joyPos[0], this.joyPos[1], 20, 0, TAU); ctx.fill();
    ctx.restore();
  }

  renderBoss() {
    const ctx = this.ctx;
    const { bx, by, bColor, phase, timer } = this;
    const t = timer * 0.04;

    const glow = (x, y, r, c) => {
      ctx.save();
      const [ri, gi, bi] = hexToRgb(c);
      const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, `rgba(${ri},${gi},${bi},0.35)`);
      grad.addColorStop(1, `rgba(${ri},${gi},${bi},0)`);
      ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.restore();
    };

    switch (this.bossStage) {
      case 1: {
        glow(bx, by, 60, bColor);
        if (phase <= 1) {
          this.poly([[bx, by-35],[bx+65,by-5],[bx+40,by+25],[bx,by+15],[bx-40,by+25],[bx-65,by-5]], bColor);
          this.poly([[bx,by-35],[bx+65,by-5],[bx+40,by+25],[bx,by+15],[bx-40,by+25],[bx-65,by-5]], C_WHITE, false, 2);
          for (const sx of [-55, 55]) { this.rect(bx+sx-6, by-4, 12, 18, C_STEEL, true, 2); this.rect(bx+sx-6, by-4, 12, 18, C_WHITE, false, 2, 1); }
        } else if (phase === 2) {
          this.poly([[bx,by-40],[bx+80,by+10],[bx+45,by+30],[bx,by+18],[bx-45,by+30],[bx-80,by+10]], bColor);
          this.poly([[bx,by-40],[bx+80,by+10],[bx+45,by+30],[bx,by+18],[bx-45,by+30],[bx-80,by+10]], C_WHITE, false, 2);
          for (let i = 0; i < 6; i++) { const a = t + i*TAU/6; const ex = bx+Math.cos(a)*50, ey = by+Math.sin(a)*50; this.line(bx,by,ex,ey,bColor,2); this.circle(ex,ey,3,C_WHITE); }
        } else {
          this.rect(bx-83, by-24, 166, 48, bColor, true, 12);
          this.rect(bx-83, by-24, 166, 48, C_WHITE, false, 12, 2);
          for (const sx of [-73, 63]) { this.rect(bx+sx, by-14, 14, 40, C_STEEL, true, 3); this.rect(bx+sx, by-14, 14, 40, C_WHITE, false, 3, 1); }
          const pr = 16 + Math.sin(t*3)*4;
          this.circle(bx, by, pr+6, bColor); this.circle(bx, by, pr, C_WHITE, false, 2); this.circle(bx, by, pr-5, bColor);
        }
        this.circle(bx, by, 11, C_WHITE); this.circle(bx, by, 7, bColor); this.circle(bx, by, 3, C_WHITE);
        break;
      }
      case 2: {
        if (this.b2ShieldActive) {
          const r = 88 + Math.sin(t*5)*7;
          ctx.save(); ctx.globalAlpha = 0.5; this.circle(bx, by, r, C_TEAL, false, 4); ctx.globalAlpha = 0.25; this.circle(bx, by, r-8, C_TEAL, false, 2); ctx.restore();
        }
        glow(bx, by, 55, bColor);
        const na = phase===1?8:(phase===2?12:16);
        for (let i = 0; i < na; i++) {
          const a = this.armAngle + i*TAU/na;
          const d1 = phase===1?28:42;
          const ax = bx+Math.cos(a)*d1, ay = by+Math.sin(a)*d1;
          const ex = bx+Math.cos(a)*78, ey = by+Math.sin(a)*78;
          this.line(ax,ay,ex,ey,bColor,3); this.line((ax+ex)/2,(ay+ey)/2,ex,ey,C_WHITE,1);
          this.circle(ex,ey,3.5,C_WHITE); this.circle(ex,ey,2,bColor);
        }
        for (const [r2,c2] of [[28,bColor],[20,C_PURPLE],[12,C_WHITE]]) { this.circle(bx,by,r2,c2, (c2 !== C_WHITE), c2===C_WHITE?2:0); }
        const pp = 9 + Math.sin(t*4)*2; this.circle(bx,by,pp,C_WHITE); this.circle(bx,by,pp-4,bColor);
        break;
      }
      case 3: {
        const segs = this.b3Segments;
        for (let i = segs.length-1; i >= 0; i--) {
          const seg = segs[i];
          const ratio = (segs.length-1-i)/(segs.length-1||1);
          const [r1,g1,b1] = hexToRgb(bColor), [r2,g2,b2] = hexToRgb(C_WHITE);
          const rc = rgbToHex(r1*ratio+r2*(1-ratio), g1*ratio+g2*(1-ratio), b1*ratio+b2*(1-ratio));
          const sz = Math.max(4, 19-i*0.7);
          this.circle(seg[0], seg[1], sz, rc, false, 2);
          if (i % 4 === 0 && sz > 7) this.circle(seg[0], seg[1], sz-4, bColor);
        }
        glow(bx, by, 30, bColor);
        this.circle(bx, by, 24, bColor); this.circle(bx, by, 24, C_WHITE, false, 2);
        for (const [ex2,ey2] of [[-9,-5],[9,-5]]) { this.circle(bx+ex2,by+ey2,4.5,C_RED); this.circle(bx+ex2,by+ey2,2,C_WHITE); }
        this.poly([[bx-7,by-24],[bx-12,by-40],[bx-2,by-25]], bColor); this.poly([[bx+7,by-24],[bx+12,by-40],[bx+2,by-25]], bColor);
        break;
      }
      case 4: {
        glow(bx, by, 45, bColor);
        const bp = [0,1,2,3,4,5].map(k=>[bx+Math.cos(this.b4ScytheAng*0.3+k*Math.PI/3)*28,by+Math.sin(this.b4ScytheAng*0.3+k*Math.PI/3)*28]);
        this.poly(bp, bColor); this.poly(bp, C_WHITE, false, 2);
        for (let j = 0; j < 6; j++) {
          const a = this.b4ScytheAng + j*TAU/6;
          const jx = bx+Math.cos(a)*44, jy = by+Math.sin(a)*44;
          this.line(bx,by,jx,jy,bColor,4);
          const s1 = [[jx,jy],[jx+Math.cos(a+0.6)*15,jy+Math.sin(a+0.6)*15],[jx+Math.cos(a+1.2)*10,jy+Math.sin(a+1.2)*10]];
          this.poly(s1,C_PURPLE); this.poly(s1,C_WHITE,false,1);
        }
        const ep = 6 + Math.sin(t*5)*2;
        this.circle(bx,by,ep+4,C_INDIGO); this.circle(bx,by,ep,C_PURPLE); this.circle(bx,by,ep-3,C_WHITE); this.circle(bx,by,Math.max(1,ep-6),C_MAGENTA);
        break;
      }
      case 5: {
        glow(bx, by, 70, bColor);
        const gcols = [C_STEEL, bColor, C_CHROME];
        for (let gi = 0; gi < 3; gi++) {
          const r5 = [53,40,29][gi]; const teeth = 12-gi*2;
          for (let k = 0; k < teeth; k++) {
            const at = this.b5GearAng[gi] + k*TAU/teeth;
            this.line(bx+Math.cos(at)*r5,by+Math.sin(at)*r5, bx+Math.cos(at)*(r5+8),by+Math.sin(at)*(r5+8),gcols[gi],3);
          }
          this.circle(bx,by,r5,gcols[gi],false,2);
        }
        const al5 = 65+this.phase*5;
        for (let j = 0; j < 6; j++) {
          const a = this.b5ArmAng + j*TAU/6;
          const mx = bx+Math.cos(a+0.3)*al5*0.55, my = by+Math.sin(a+0.3)*al5*0.55;
          const tx = bx+Math.cos(a)*al5, ty = by+Math.sin(a)*al5;
          this.line(bx,by,mx,my,bColor,5); this.line(mx,my,tx,ty,C_STEEL,4);
          this.circle(mx,my,5,C_WHITE); this.circle(mx,my,3,bColor);
          this.circle(tx,ty,7,C_CHROME,false,2);
        }
        const cr = 23+this.b5CorePulse;
        this.circle(bx,by,cr+4,C_STEEL); this.circle(bx,by,cr,bColor); this.circle(bx,by,cr-5,C_WHITE,false,2); this.circle(bx,by,cr-11,C_CHROME); this.circle(bx,by,6,C_WHITE);
        break;
      }
      case 6: {
        glow(bx, by+5, 55, bColor);
        for (let j = 0; j < 4; j++) {
          const a = this.b6BladeAng + j*TAU/4;
          const spread = this.b6OverchargeActive ? Math.max(0.1, this.b6OverchargeLife/60) : 1;
          const ir = 40, or2 = 40 + 38*spread;
          const ax = bx+Math.cos(a)*ir, ay = by+Math.sin(a)*ir;
          const ex = bx+Math.cos(a)*or2, ey = by+Math.sin(a)*or2;
          this.line(ax,ay,ex,ey,this.b6OverchargeActive?C_RED:C_STEEL,7);
          this.line(ax,ay,ex,ey,C_WHITE,1.5);
          const tang = a+Math.PI/2;
          const t1 = [[ex+Math.cos(tang)*11,ey+Math.sin(tang)*11],[ex-Math.cos(tang)*11,ey-Math.sin(tang)*11],[ex+Math.cos(a)*11,ey+Math.sin(a)*11]];
          this.poly(t1, this.b6OverchargeActive?C_RED:bColor); this.poly(t1,C_WHITE,false,1);
          this.circle(ax,ay,5,C_CHROME,false,1);
        }
        this.rect(bx-40,by-30,80,58,C_CHROME,true,7); this.rect(bx-40,by-30,80,58,C_WHITE,false,7,2);
        const cr = 14+Math.sin(t*5)*2;
        if (this.b6OverchargeActive) {
          glow(bx,by+5,cr+10,C_RED);
          this.glowText('▶ 과충전 ◀', bx, by-55, C_RED, 9, true);
        }
        this.circle(bx,by+5,cr,this.b6OverchargeActive?C_RED:bColor); this.circle(bx,by+5,Math.max(1,cr-5),C_WHITE); this.circle(bx,by+5,Math.max(1,cr-10),this.b6OverchargeActive?C_RED:bColor);
        for (const sx of [-26,26]) { this.rect(bx+sx-5,by-43,11,17,C_STEEL,true,2); this.rect(bx+sx-5,by-43,11,17,C_WHITE,false,2,1); }
        break;
      }
      case 7: {
        for (const [pi, pos] of [[0,this.b7Pos1],[1,this.b7Pos2]]) {
          if (this.b7Enraged && pi === 1) continue;   // 갈라지면 두 번째 기체(터진 쪽)를 그리지 않음 — 맞는 판정이 남은 첫 번째 기체와 맞게 (원본은 반대로 숨겼음)
          const [px2,py2] = pos;
          const c7 = this.b7Enraged ? C_RED : bColor;
          const er = 11+Math.sin(t*8+pi)*3;
          glow(px2,py2+10,er,C_ORANGE);
          this.poly([[px2,py2-25],[px2+25,py2+15],[px2+10,py2+8],[px2,py2+10],[px2-10,py2+8],[px2-25,py2+15]],c7);
          this.poly([[px2,py2-25],[px2+25,py2+15],[px2+10,py2+8],[px2,py2+10],[px2-10,py2+8],[px2-25,py2+15]],C_WHITE,false,2);
          this.poly([[px2-10,py2],[px2-40,py2+22],[px2-15,py2+15]],c7); this.poly([[px2-10,py2],[px2-40,py2+22],[px2-15,py2+15]],C_WHITE,false,1);
          this.poly([[px2+10,py2],[px2+40,py2+22],[px2+15,py2+15]],c7); this.poly([[px2+10,py2],[px2+40,py2+22],[px2+15,py2+15]],C_WHITE,false,1);
          this.ctx.save(); this.ctx.fillStyle=C_SKY; this.ctx.beginPath(); this.ctx.ellipse(px2,py2-13,7,5,0,0,TAU); this.ctx.fill(); this.ctx.strokeStyle=C_WHITE; this.ctx.lineWidth=1; this.ctx.stroke(); this.ctx.restore();
          this.circle(px2,py2+12,er/2,C_ORANGE);
        }
        break;
      }
      case 8: {
        for (let i = 0; i < this.b8Clones.length; i++) {
          const [cx2,cy2] = this.b8Clones[i];
          const isReal = i === this.b8RealIdx;
          const gc = isReal ? C_GOLD : C_PURPLE;
          glow(cx2,cy2,isReal?28:20,gc);
          const pts8 = Array.from({length:6},(_,k)=>[cx2+Math.cos(t+k*TAU/6)*25,cy2+Math.sin(t+k*TAU/6)*25]);
          this.poly(pts8,bColor,false,2);
          if (isReal) {
            const ir2 = 9+Math.sin(t*5)*2;
            this.circle(cx2,cy2,ir2,C_GOLD); this.circle(cx2,cy2,ir2-3,C_WHITE,false,1); this.circle(cx2,cy2,ir2-7,C_GOLD);
            this.line(cx2-ir2,cy2,cx2+ir2,cy2,C_WHITE,1); this.line(cx2,cy2-ir2,cx2,cy2+ir2,C_WHITE,1);
          } else {
            this.circle(cx2,cy2,7,C_PURPLE); this.circle(cx2,cy2,3.5,C_WHITE,false,1);
          }
        }
        break;
      }
      case 9: {
        const a9 = Math.max(0,Math.min(1,this.b9Alpha/255));
        ctx.save(); ctx.globalAlpha = a9;
        glow(bx,by,55,bColor);
        ctx.globalAlpha = a9 * 0.8;
        const body9 = [[bx,by-50],[bx+95,by+30],[bx+70,by+70],[bx,by+90],[bx-70,by+70],[bx-95,by+30]];
        this.poly(body9,bColor); this.poly(body9,C_WHITE,false,2);
        this.poly([[bx-10,by+80],[bx+10,by+80],[bx+8,by+115],[bx-8,by+115]],bColor);
        const er2 = 9+Math.sin(t*3)*2;
        this.circle(bx,by+10,er2,C_TEAL); this.circle(bx,by+10,er2-3,C_WHITE,false,2); this.circle(bx,by+10,er2-6,C_TEAL);
        for (const [bx2,by2] of [[bx-35,by+40],[bx+35,by+40],[bx,by+70]]) { this.circle(bx2,by2,3,C_TEAL); }
        ctx.restore();
        break;
      }
      case 10: {
        glow(bx,by,80,bColor);
        this.poly([[bx-60,by-20],[bx-180,by-65],[bx-140,by+30],[bx-80,by+20]],C_STEEL); this.poly([[bx-60,by-20],[bx-180,by-65],[bx-140,by+30],[bx-80,by+20]],C_CHROME,false,2);
        this.poly([[bx+60,by-20],[bx+180,by-65],[bx+140,by+30],[bx+80,by+20]],C_STEEL); this.poly([[bx+60,by-20],[bx+180,by-65],[bx+140,by+30],[bx+80,by+20]],C_CHROME,false,2);
        this.poly([[bx-100,by+30],[bx-190,by+85],[bx-100,by+70]],C_GOLD); this.poly([[bx+100,by+30],[bx+190,by+85],[bx+100,by+70]],C_GOLD);
        for (let i = 0; i < 3; i++) {
          const r10 = 58-i*14;
          const a10 = t*(i%2===0?1:-1)*(1+i*0.3);
          const pts10 = Array.from({length:10},(_,k)=>[bx+Math.cos(a10+k*TAU/10)*r10,by+Math.sin(a10+k*TAU/10)*r10]);
          this.poly(pts10,[bColor,C_GOLD,C_WHITE][i],false,2);
        }
        if (this.phase >= 3) {
          const bhr = 38+Math.sin(t*10)*7;
          glow(bx,by,bhr+20,C_GOLD);
          ctx.fillStyle='#050010'; ctx.beginPath(); ctx.arc(bx,by,bhr,0,TAU); ctx.fill();
          this.circle(bx,by,bhr,C_GOLD,false,4); this.circle(bx,by,bhr-9,C_WHITE,false,1);
        } else {
          const cr10 = 25+this.b5CorePulse;
          this.circle(bx,by,cr10+6,C_GOLD); this.circle(bx,by,cr10,C_WHITE,false,3); this.circle(bx,by,cr10-6,bColor); this.circle(bx,by,cr10-13,C_WHITE,false,1); this.circle(bx,by,cr10-18,C_GOLD);
        }
        break;
      }
    }
  }

  renderPlayer() {
    const ctx = this.ctx;
    const { px, py, itime, timer } = this;
    const char = CHARACTERS[this.save.selected_char];
    const flash_p = itime % 4 < 2;
    const col = (flash_p && itime > 0) ? '#AACCFF' : char.color;
    const cx = px + 17, cy = py + 17;
    ctx.save();
    ctx.shadowBlur = 8; ctx.shadowColor = char.color;
    switch (this.save.selected_char) {
      case 0:
        this.poly([[cx,cy-17],[cx+17,cy+17],[cx,cy+12],[cx-17,cy+17]], col);
        this.circle(cx, cy+10, 5, C_WHITE);
        if (timer % 4 < 2) this.poly([[cx-8,cy+17],[cx,cy+22],[cx+8,cy+17]], char.color);
        break;
      case 1:
        this.poly([[cx,cy-17],[cx+15,cy+5],[cx,cy+18],[cx-15,cy+5]], col);
        this.poly([[cx,cy-17],[cx+15,cy+5],[cx,cy+18],[cx-15,cy+5]], C_WHITE, false, 1);
        this.circle(cx,cy+5,4,C_MAGENTA);
        if (timer % 3 < 1) this.poly([[cx-5,cy+18],[cx,cy+24],[cx+5,cy+18]], C_PURPLE);
        break;
      case 2:
        this.rect(cx-18,cy-10,36,22,col,true,3); this.rect(cx-18,cy-10,36,22,C_WHITE,false,3,1);
        this.circle(cx,cy,7,C_WHITE); this.circle(cx,cy,5,col);
        this.rect(cx-27,cy-3,11,15,col,true,2); this.rect(cx+16,cy-3,11,15,col,true,2);
        break;
      case 3:
        this.poly([[cx,cy-17],[cx+10,cy],[cx+12,cy+16],[cx,cy+18],[cx-12,cy+16],[cx-10,cy]], col);
        this.circle(cx,cy,6,C_WHITE); this.circle(cx,cy,3.5,col);
        if (timer % 5 < 2) { this.line(cx-8,cy+16,cx-8,cy+24,col,2); this.line(cx+8,cy+16,cx+8,cy+24,col,2); }
        break;
      case 4:
        this.circle(cx,cy,16,col,false,2); this.circle(cx,cy,12,C_WHITE,false,1);
        const ir = 6+Math.sin(timer*0.2)*2; this.circle(cx,cy,ir,col);
        for (let i = 0; i < 4; i++) { const a = timer*0.08+i*Math.PI/2; this.circle(cx+Math.cos(a)*11,cy+Math.sin(a)*11,2,C_WHITE); }
        break;
    }
    ctx.restore();
  }

  renderHUD() {
    const ctx = this.ctx;
    const { bColor, phase, bossStage } = this;

    // ── boss HP bar ──────────────────────────────────────
    const BW = 400, BX = WIDTH / 2 - BW / 2, BY = 12, BH = 14;

    // track bar — pale colour shows recent damage (lags behind)
    const trailCol = this.bHpFlash > 0 ? '#FFFFFF' : '#7a3a3a';
    ctx.beginPath(); ctx.roundRect(BX, BY, BW * this.bHpTrail, BH, 6);
    ctx.fillStyle = trailCol; ctx.fill();

    // background
    ctx.beginPath(); ctx.roundRect(BX, BY, BW, BH, 6);
    ctx.fillStyle = '#1a1a2a'; ctx.fill();

    // main fill — flash white when hit
    const bFillCol = this.bHpFlash > 10 ? '#FFFFFF' :
                     this.bHpFlash > 0  ? blendColor(bColor, 0.5 + (this.bHpFlash / 10) * 0.5) :
                     bColor;
    const bFillW = Math.max(0, BW * this.bHpDisplay);
    if (bFillW > 0) {
      ctx.beginPath(); ctx.roundRect(BX, BY, bFillW, BH, 6);
      ctx.fillStyle = bFillCol; ctx.fill();
    }

    // phase pip markers
    for (let p = 1; p <= 3; p++) {
      const px = BX + BW * (p / 4);
      ctx.beginPath(); ctx.moveTo(px, BY - 1); ctx.lineTo(px, BY + BH + 1);
      ctx.strokeStyle = '#0d0d1a'; ctx.lineWidth = 2; ctx.stroke();
    }

    // border
    ctx.beginPath(); ctx.roundRect(BX, BY, BW, BH, 6);
    ctx.strokeStyle = colorWithAlpha(bColor, 0.6); ctx.lineWidth = 1; ctx.stroke();

    const bossNames = {
      1:'강철 군주', 2:'수정 망령', 3:'네온 드래곤', 4:'공허 사마귀',
      5:'오메가 머신',  6:'철의 수호자',   7:'쌍둥이 요격기', 8:'환영 군주',
      9:'심연의 포식자', 10:'종말의 정점'
    };
    const bHpText = `${Math.max(0, this.bhp | 0).toLocaleString()} / ${this.bmax.toLocaleString()}`;
    ctx.save();
    ctx.textAlign = 'center'; ctx.font = `bold 8px ${FONT_STACK}`;
    ctx.fillStyle = C_WHITE; ctx.fillText(bHpText, WIDTH / 2, BY + BH - 2);
    ctx.restore();
    this.text(`${bossNames[bossStage]}  [${phase}단계]`, WIDTH / 2, BY + BH + 16, bColor, 9, true);

    // ── player HP bar ────────────────────────────────────
    const PW = 200, PX = 25, PY = 47, PH = 11;

    // trail (red when taking damage, green when healed)
    const pTrailCol = this.pHpFlashDmg > 0  ? '#cc3333' :
                      this.pHpFlashHeal > 0 ? '#33cc66' : '#2a4a3a';
    ctx.beginPath(); ctx.roundRect(PX, PY, PW * this.pHpTrail, PH, 5);
    ctx.fillStyle = pTrailCol; ctx.fill();

    // background
    ctx.beginPath(); ctx.roundRect(PX, PY, PW, PH, 5);
    ctx.fillStyle = '#1a1a2a'; ctx.fill();

    // main fill — flash colours for damage / heal
    const pFillCol = this.pHpFlashDmg > 15  ? '#FF4444' :
                     this.pHpFlashDmg > 0   ? blendColor(C_CYAN, 0.5 + (this.pHpFlashDmg / 15) * 0.5) :
                     this.pHpFlashHeal > 15 ? '#88FFAA' :
                     this.pHpFlashHeal > 0  ? C_GREEN :
                     C_CYAN;
    const pFillW = Math.max(0, PW * this.pHpDisplay);
    if (pFillW > 0) {
      ctx.beginPath(); ctx.roundRect(PX, PY, pFillW, PH, 5);
      ctx.fillStyle = pFillCol; ctx.fill();
    }

    // border
    ctx.beginPath(); ctx.roundRect(PX, PY, PW, PH, 5);
    ctx.strokeStyle = colorWithAlpha(C_CYAN, 0.5); ctx.lineWidth = 1; ctx.stroke();

    const hpLabel = this.pHpFlashHeal > 0
      ? `+체력  ${this.php | 0} / ${this.pmaxHp}`
      : `체력  ${this.php | 0} / ${this.pmaxHp}`;
    const hpLabelCol = this.pHpFlashHeal > 0 ? C_GREEN :
                       this.pHpFlashDmg > 0  ? C_RED   : C_CYAN;
    this.text(hpLabel, PX, PY + PH + 14, hpLabelCol, 9);

    const char = CHARACTERS[this.save.selected_char];
    this.text(`${char.icon} ${char.name}`, 25, 87, char.color, 9);  // 한글은 키가 커서 체력 글자와 겹치지 않게 조금 아래로 (원본 80)

    // score & coins
    ctx.textAlign='right'; ctx.font=`bold 10px ${FONT_STACK}`; ctx.fillStyle=C_WHITE; ctx.fillText(`점수 ${this.score}`,WIDTH-12,25); ctx.textAlign='left';
    ctx.textAlign='right'; ctx.font=`bold 9px ${FONT_STACK}`; ctx.fillStyle=C_COIN; ctx.fillText(`⬡ ${this.save.coins}  (+${this.sessionCoins})`,WIDTH-12,40); ctx.textAlign='left';

    // boss10 time attack
    if (this.bossStage === 10 && this.phase >= 3) {
      const sec = Math.max(0, (this.b10TimeAttack / 60) | 0);
      const c = sec <= 15 ? C_RED : C_GOLD;
      this.glowText(`⚠ 붕괴까지 ${sec}초`, WIDTH/2, 93, c, 11, true);
    }

    // back button (click handled in handleClick)
    const bhov = this.inRect(this.mouseX, this.mouseY, WIDTH-135, HEIGHT-55, 125, 40);
    this.rect(WIDTH-135, HEIGHT-55, 125, 40, '#141420', true, 5);
    this.rect(WIDTH-135, HEIGHT-55, 125, 40, bhov?C_WHITE:'#707080', false, 5, 1);
    this.text('← 나가기', WIDTH-73, HEIGHT-29, bhov?C_WHITE:'#707080', 10, true);
  }

  // ─── TRANSITION ───────────────────────────
  renderTransition() {
    const ctx = this.ctx;
    const alpha = Math.abs(Math.sin(this.transitionTimer * 0.1)) * 0.6;
    ctx.fillStyle = `rgba(${hexToRgb(C_PURPLE).join(',')},${alpha})`;
    ctx.fillRect(0,0,WIDTH,HEIGHT);

    let txt = '';
    if (this.transitionTimer < 60) txt = '보스 격파!';
    else if (this.transitionTimer < 120) txt = `스테이지 ${this.bossStage + 1} 진입`;
    else txt = STAGE_INFO[Math.min(10, this.bossStage + 1)]?.name || '???';
    this.glowText(txt, WIDTH/2, HEIGHT/3, C_WHITE, 20, true);

    for (const p of this.particles) {
      const li = p.life;
      const [r,g,b] = hexToRgb(p.c);
      ctx.fillStyle=`rgba(${r*li|0},${g*li|0},${b*li|0},${li})`;
      const sz = Math.max(1,p.size*li|0);
      ctx.fillRect((p.x-sz/2)|0,(p.y-sz/2)|0,sz,sz);
    }
  }

  // ─── WIN ──────────────────────────────────
  renderWin() {
    const t = this.lobbyTimer;
    const pulse = 0.8 + 0.2*Math.sin(t*0.04);
    const gc = rgbToHex(255*pulse,215*pulse,0);
    this.glowText('승리!', WIDTH/2, HEIGHT/3-50, gc, 38, true);
    this.glowText('모든 보스를 물리쳤다', WIDTH/2, HEIGHT/3+15, C_WHITE, 16, true);
    this.text(`최종 점수: ${this.score.toLocaleString()}`, WIDTH/2, HEIGHT/3+50, C_WHITE, 12, true);
    this.text('스테이지 10개 × 4단계 클리어', WIDTH/2, HEIGHT/3+70, C_LIME, 10, true);
    this.text(`⬡ 모은 코인: ${this.save.coins}`, WIDTH/2, HEIGHT/3+90, C_COIN, 12, true);
    const bhov = this.inRect(this.mouseX, this.mouseY, WIDTH/2-130, HEIGHT/2+30, 260, 55);
    const bc = bhov ? C_WHITE : C_GOLD;
    if (bhov) { this.ctx.fillStyle=colorWithAlpha(C_GOLD,0.1); this.ctx.roundRect(WIDTH/2-130,HEIGHT/2+30,260,55,6); this.ctx.fill(); }
    this.neonRect(WIDTH/2-130, HEIGHT/2+30, 260, 55, bc);
    this.glowText('스테이지 선택', WIDTH/2, HEIGHT/2+63, bc, 14, true);
  }
}
