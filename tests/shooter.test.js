'use strict';

/*
 * 하늘 사냥꾼 테스트 (Node 로 실행: node tests/shooter.test.js)
 *  - 데이터·그림 검사: 패턴 이름·필요한 무기, 화면이 쓰는 그림이 모두 있고 그려지는지
 *  - 규칙 검사: 방어막 → 포탑 파괴 → 단계마다 새 무기(주포·미사일 포드) 해금, 부서지는 무기,
 *              조준 → 충전 → 발사 순서, 총구에서 나가는 레이저, 벽 레이저포(나왔다가 들어감·부술 수 있음),
 *              패턴이 연달아 반복되지 않음, 피격·폭탄·방패·미사일 격추·이어하기·1UP
 *  - 봇 시뮬레이션: 무적 봇이 여러 시드로 끝까지 깨는지, 일반 봇이 오류 없이 끝나는지
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '..', 'shooter');

function load() {
  const sandbox = { console, Math, JSON, Date, Object, Array, Number, String, Set, Map, Error };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
  // DOM 을 쓰는 화면 모듈은 빼고 (엔진 · 데이터 · 패턴 · 그림 등록)
  for (const src of scripts) {
    if (/^(fx|render|audio|input|ui|main)\.js$/.test(path.basename(src))) continue;
    vm.runInContext(fs.readFileSync(path.join(ROOT, src), 'utf8'), sandbox, { filename: src });
  }
  return sandbox.SH;
}

const SH = load();
let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    console.error(`  ✗ ${name}\n    ${e.stack}`);
    process.exitCode = 1;
  }
}
const newGame = (o) => new SH.Game(Object.assign({ seed: 1 }, o || {}));
const step = (g, sec) => { for (let i = 0; i < Math.round(sec * 60); i++) g.update(SH.DT); };
/** 보스가 싸울 준비가 될 때까지 */
function toFight(g) {
  for (let i = 0; i < 60 * 20 && !(g.B && g.B.state === 'fight'); i++) g.update(SH.DT);
  assert.ok(g.B && g.B.state === 'fight', '보스가 나와야 함');
}
/** 다음 단계로 넘기고 변신이 끝날 때까지 */
function nextPhase(g) {
  const B = g.B;
  if (B.phase === 0) { for (const n of ['turretL', 'turretR']) g._damageWeapon(B.w[n], 99999); }
  else { B.inv = 0; g._damageCore(B.hp - B.maxHp * g.def.phases[B.phase].until + 1); }
  for (let i = 0; i < 60 * 6 && B.state !== 'fight'; i++) g.update(SH.DT);
  assert.strictEqual(B.state, 'fight');
}
/** 패턴 하나를 강제로 시작 */
function force(g, name) {
  for (const t of g.tasks) if (t.tag === 'boss') t.done = true;
  g.B.task = g.run(SH.BOSS_PATTERNS[name](g), null, 'boss');
}

console.log('데이터 · 그림');
test('단계별 패턴이 모두 있고, 필요한 무기가 그 단계에 있음', () => {
  const B = SH.BOSS;
  B.phases.forEach((ph, i) => {
    const names = Object.keys(ph.pool);
    assert.ok(names.length >= 5, `${i}단계 패턴이 너무 적음`);
    for (const n of names) {
      assert.strictEqual(typeof SH.BOSS_PATTERNS[n], 'function', `패턴 없음 ${n}`);
      const need = SH.BOSS_NEEDS[n] || [];
      for (const w of need) {
        const d = B.weapons[w];
        assert.ok(d, `없는 무기 ${w}`);
        assert.ok(i >= (d.unlock || 0) && (d.lose == null || i < d.lose), `${i}단계 ${n}: ${w} 가 이 단계에 없음`);
      }
    }
    for (const id of ph.needParts || []) assert.ok(B.weapons[id], `없는 부품 ${id}`);
    if (i < B.phases.length - 1 && !ph.needParts) assert.ok(ph.until > 0 && ph.until < 1);
  });
  // 단계가 넘어가면 쓰던 패턴 일부가 사라지고 새 패턴이 생김
  for (let i = 1; i < B.phases.length; i++) {
    const prev = Object.keys(B.phases[i - 1].pool), cur = Object.keys(B.phases[i].pool);
    assert.ok(cur.some((n) => !prev.includes(n)), `${i}단계에 새 패턴이 없음`);
    assert.ok(prev.some((n) => !cur.includes(n)), `${i}단계에 사라지는 패턴이 없음`);
  }
});

test('화면이 쓰는 그림이 모두 등록되어 있고 그려짐', () => {
  const need = ['player', 'flame', 'shield', 'shot_spread', 'shot_homing', 'shot_laser', 'missile', 'gem', 'bigGem', 'spark',
    'item_bomb', 'item_life', 'item_shield', 'titan', 'turret', 'turretWreck', 'cannon', 'pod', 'wallgun', 'scrap', 'emissile',
    'boom', 'boomBig', 'hitSpark', 'pop', 'puff', 'logo', 'icon_life', 'icon_bomb', 'btn_pause', 'btn_bomb', 'frame', 'cursor', 'star'];
  for (const w of SH.WEAPON_ORDER) need.push('item_' + w);
  for (const c of ['pink', 'red', 'orange', 'yellow', 'green', 'blue', 'purple', 'white']) need.push('orb_' + c, 'big_' + c);
  for (const n of need) assert.ok(SH.pix.has(n), `그림 없음: ${n}`);
  assert.strictEqual(SH.pix.info('titan').n, 8, 'titan 은 모습 4 × 2 프레임');
  for (const n of SH.pix.names()) {
    const d = SH.pix.defs[n];
    if (d.kind !== 'paint') continue;
    for (let f = 0; f < d.n; f++) {
      const P = SH.pix.painter(d.w, d.h);
      d.fn(P, f, d.n);
      assert.ok(P.px.some((c) => c !== null), `${n} ${f}번 프레임이 비어 있음`);
    }
  }
  // 모습마다 그림이 실제로 다름 (덮어씌우기가 아니라 점점 부서짐)
  const frames = [0, 2, 4, 6].map((f) => { const P = SH.pix.painter(156, 96); SH.pix.defs.titan.fn(P, f, 8); return P.px.join(','); });
  assert.strictEqual(new Set(frames).size, 4);
});

console.log('보스');
test('1단계: 코어는 방어막, 포탑 둘을 부수면 2단계(장갑 붕괴)와 주포 해금', () => {
  const g = newGame({ god: true });
  toFight(g);
  const B = g.B;
  const hp0 = B.hp;
  assert.strictEqual(g._damageCore(100), false);
  assert.strictEqual(B.hp, hp0);
  assert.strictEqual(g.avail('cannon'), false, '1단계에는 주포 없음');
  g._damageWeapon(B.w.turretL, 99999);
  assert.strictEqual(B.phase, 0);
  g._damageWeapon(B.w.turretR, 99999);
  assert.strictEqual(B.phase, 1);
  assert.strictEqual(B.state, 'transform');
  step(g, 3);
  assert.strictEqual(B.state, 'fight');
  assert.strictEqual(B.look, 1, '부서진 모습으로 바뀜');
  assert.ok(g.avail('cannon'), '주포가 나옴');
  B.inv = 0;
  assert.ok(g._damageCore(10));
});

test('3단계: 발사구·배기구가 부서지고 미사일 포드 해금, 4단계는 폭주', () => {
  const g = newGame({ god: true });
  toFight(g);
  nextPhase(g);
  assert.ok(g.avail('emitL') && g.avail('ventL'));
  nextPhase(g);
  assert.strictEqual(g.B.phase, 2);
  assert.ok(!g.avail('emitL') && !g.avail('ventR'), '발사구·배기구가 부서짐');
  assert.ok(g.avail('podL') && g.avail('podR'), '미사일 포드');
  assert.strictEqual(g.B.look, 2);
  nextPhase(g);
  assert.strictEqual(g.B.look, 3);
  assert.ok(g.bossPhase.berserk);
});

test('주포 레이저: 조준 → 충전 → 총구에서 발사 (총구를 따라감)', () => {
  const g = newGame({ god: true });
  toFight(g);
  nextPhase(g);
  const c = g.B.w.cannon;
  force(g, 'mainBeam');
  const seen = [];
  for (let i = 0; i < 60 * 5; i++) {
    g.update(SH.DT);
    if (seen[seen.length - 1] !== c.state) seen.push(c.state);
    if (g.beams.length) {
      const bm = g.beams[0];
      assert.strictEqual(bm.src, c);
      const [mx, my] = g.muzzle(c);
      assert.ok(Math.hypot(bm.x - mx, bm.y - my) < 1, '레이저가 주포 총구에서 나감');
    }
  }
  const order = seen.filter((s) => ['aim', 'charge', 'fire'].includes(s));
  assert.deepStrictEqual(order.slice(0, 3), ['aim', 'charge', 'fire']);
});

test('벽 레이저포: 보스 신호 → 벽에서 나와 조준·충전·발사 → 다시 들어감', () => {
  const g = newGame({ god: true });
  toFight(g);
  const calls = [];
  g.emit = (t) => calls.push(t);
  force(g, 'wallSnipe');
  let maxGuns = 0, sawCharge = false, sawBeam = false;
  for (let i = 0; i < 60 * 6; i++) {
    g.update(SH.DT);
    maxGuns = Math.max(maxGuns, g.guns.length);
    for (const w of g.guns) {
      if (w.state === 'charge') sawCharge = true;
      if (w.slide >= 1) assert.ok(w.x > 0 && w.x < SH.W, '화면 안으로 나옴');
    }
    if (g.beams.some((b) => b.src.kind === 'gun')) sawBeam = true;
  }
  assert.ok(calls.indexOf('call') >= 0 && calls.indexOf('call') < calls.indexOf('gunIn'), '보스가 먼저 부름');
  assert.strictEqual(maxGuns, 2);
  assert.ok(sawCharge && sawBeam);
  assert.strictEqual(g.guns.length, 0, '다 쏘고 들어감');
});

test('벽 레이저포는 쏴서 부술 수 있고, 부서지면 레이저가 끊김', () => {
  const g = newGame({ god: true });
  toFight(g);
  const gun = g.gun('L', 300, { aim: 5, charge: 1, fire: SH.bossGunPlans.beam(12, 1) });
  step(g, 1);
  assert.ok(gun.slide >= 1);
  g._damageWeapon(gun, 9999);
  assert.ok(gun.gone);
  assert.strictEqual(g.stats.guns, 1);
  step(g, 0.2);
  assert.strictEqual(g.guns.length, 0);
});

test('패턴이 바로 전 두 개와 겹치지 않고, 단계마다 여러 패턴이 나옴', () => {
  const g = newGame({ seed: 3, god: true });
  const seq = [];
  g.emit = (t, d) => { if (t === 'pattern') seq.push([g.B.phase, d.name]); };
  toFight(g);
  for (let i = 0; i < 60 * 70; i++) g.update(SH.DT);
  assert.ok(seq.length >= 12, `패턴 수 ${seq.length}`);
  for (let i = 2; i < seq.length; i++) {
    if (seq[i][0] !== seq[i - 1][0] || seq[i][0] !== seq[i - 2][0]) continue;
    assert.ok(seq[i][1] !== seq[i - 1][1] && seq[i][1] !== seq[i - 2][1], `반복: ${seq.slice(i - 2, i + 1).map((x) => x[1])}`);
  }
  assert.ok(new Set(seq.filter((x) => x[0] === 0).map((x) => x[1])).size >= 4, '1단계에서 4가지 이상');
});

console.log('규칙');
test('맞으면 목숨·파워가 줄고 탄이 사라짐, 목숨이 다하면 게임 오버 → 이어하기', () => {
  const g = newGame({ power: 3 });
  toFight(g);
  g.player.inv = 0;
  g.orbAt(g.player.x, g.player.y, 0, 0, 'pink');
  g._collide();
  assert.strictEqual(g.lives, 2);
  assert.strictEqual(g.power, 2);
  assert.strictEqual(g.eb.length, 0);
  g.lives = 1;
  step(g, 2);
  g.player.inv = 0;
  g.player.entering = false;
  g._hitPlayer();
  step(g, 2.5);
  assert.strictEqual(g.over, 'gameover');
  g.continueGame();
  assert.strictEqual(g.over, null);
  assert.strictEqual(g.lives, 3);
  assert.strictEqual(g.continues, 1);
});

test('레이저 위에 있으면 맞음', () => {
  const g = newGame();
  toFight(g);
  g.player.inv = 0;
  g.eb.length = 0;
  const c = g.B.w.core;
  const [mx, my] = g.muzzle(c);
  c.ang = Math.atan2(g.player.y - my, g.player.x - mx);
  g.beam(c, { width: 16, dur: 1 });
  g._collide();
  assert.strictEqual(g.lives, 2);
});

test('방패는 한 번 막아 줌 · 폭탄은 탄·레이저를 지우고 무적', () => {
  const g = newGame();
  toFight(g);
  g.player.inv = 0;
  g.player.shield = 5;
  g._hitPlayer();
  assert.strictEqual(g.lives, 3);
  assert.strictEqual(g.player.shield, 0);
  for (let i = 0; i < 30; i++) g.orbAt(100 + i, 300, 1, 50, 'red');
  g.beam(g.B.w.core, { width: 16, dur: 2 });
  const hp = g.B.w.turretL.hp;
  assert.ok(g.useBomb());
  assert.strictEqual(g.eb.length, 0);
  assert.strictEqual(g.beams.length, 0);
  assert.ok(g.player.inv > 2);
  assert.ok(g.B.w.turretL.hp < hp);
});

test('적 미사일은 내 탄으로 격추됨', () => {
  const g = newGame();
  toFight(g);
  const m = g.missileFrom(g.B.w.core, Math.PI / 2, 0);
  m.x = 400; m.y = 400;
  g.pb.push({ x: 400, y: 405, vx: 0, vy: 0, dmg: 3, kind: 'spread', hw: 5, hh: 9, rot: 0, t: 0 });
  g._collide();
  assert.ok(m.hp <= 0);
  assert.strictEqual(g.stats.missiles, 1);
});

test('파워 아이템: 레벨이 오르고 색대로 무기가 바뀜 · 점수 1UP', () => {
  const g = newGame();
  const it = g._dropItem('power', 0, 0);
  it.wtype = 'laser';
  g._takeItem(it);
  assert.strictEqual(g.power, 2);
  assert.strictEqual(g.weapon, 'laser');
  g._addScore(SH.EXTENDS[0]);
  assert.strictEqual(g.lives, 4);
});

console.log('시뮬레이션');
function bot(g, god) {
  const p = g.player;
  let fx = 0, fy = 0;
  for (const b of g.eb) {
    const dx = p.x - b.x, dy = p.y - b.y, d2 = dx * dx + dy * dy;
    if (d2 < 6400) { fx += (dx / d2) * 500; fy += (dy / d2) * 500; }
  }
  // 조준선·레이저에서 옆으로 비키기
  const threats = g.guns.map((w) => [w, w.x, w.y]);
  if (g.B) for (const n of ['cannon', 'turretL', 'turretR']) { const w = g.B.w[n]; if (w && w.alive) threats.push([w, ...g.wpos(w)]); }
  let threatened = false;
  for (const [w, wx, wy] of threats) {
    if (!['aim', 'charge', 'fire'].includes(w.state)) continue;
    const ux = Math.cos(w.ang), uy = Math.sin(w.ang), dx = p.x - wx, dy = p.y - wy;
    if (dx * ux + dy * uy < 0) continue;
    const cr = dx * uy - dy * ux;
    if (Math.abs(cr) < 50) { fx += -uy * Math.sign(cr || 1) * 6; fy += ux * Math.sign(cr || 1) * 6; threatened = true; }
  }
  const item = g.items.find((i) => ['power', 'life', 'bomb', 'shield'].includes(i.kind));
  const B = g.B;
  const tur = B && ['turretL', 'turretR'].map((n) => B.w[n]).find((w) => w.alive);
  const wantX = item ? item.x : B ? B.x + (tur ? tur.ox : 0) : SH.W / 2;
  const wantY = item ? Math.max(item.y, SH.H * 0.5) : SH.H - 100;
  if (!threatened) {
    fx += (wantX - p.x) * 0.02;
    fy += (wantY - p.y) * 0.01;
  }
  g.input.ax = Math.max(-1, Math.min(1, fx));
  g.input.ay = Math.max(-1, Math.min(1, fy));
  if (!god && g.bombs > 0 && g.eb.some((b) => (b.x - p.x) ** 2 + (b.y - p.y) ** 2 < 676)) g.input.bomb = true;
}

test('무적 봇: 여러 시드에서 6분 안에 격파, 탄 수 제한·숫자 이상 없음', () => {
  for (const seed of [1, 2, 3]) {
    const g = newGame({ seed, god: true });
    let maxEb = 0;
    for (let i = 0; i < 60 * 60 * 6 && !g.over; i++) {
      bot(g, true);
      g.update(SH.DT);
      maxEb = Math.max(maxEb, g.eb.length);
      assert.ok(Number.isFinite(g.player.x) && Number.isFinite(g.score), 'NaN');
    }
    assert.strictEqual(g.over, 'win', `seed ${seed}: 시간 안에 못 깸 (${g.time.toFixed(0)}초)`);
    assert.ok(maxEb <= 700);
    const kinds = Object.keys(g.stats.patterns).length;
    console.log(`    seed ${seed}: ${g.time.toFixed(0)}초, 점수 ${g.score}, 패턴 ${kinds}종, 최대 탄 ${maxEb}`);
  }
});

test('일반 봇: 이어하기를 하면서 오류 없이 끝까지', () => {
  for (const seed of [4, 5]) {
    const g = newGame({ seed });
    for (let i = 0; i < 60 * 60 * 15 && g.over !== 'win'; i++) {
      if (g.over === 'gameover') g.continueGame();
      bot(g, false);
      g.update(SH.DT);
    }
    assert.strictEqual(g.over, 'win');
    console.log(`    seed ${seed}: ${g.time.toFixed(0)}초, 죽음 ${g.stats.deaths}, 이어하기 ${g.continues}, 벽 포대 파괴 ${g.stats.guns}, 미사일 격추 ${g.stats.missiles}`);
  }
});

console.log(process.exitCode ? '\n실패한 테스트가 있습니다.' : `\n모두 통과 (${passed}개)`);
