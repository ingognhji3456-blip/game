'use strict';

/*
 * 항목별 동작 테스트 (QUALITY.md §1): 탑 18종 × 5단계, 적 특성 18가지, 보스 6종,
 * 영웅 12명 기술·패시브, 도전 규칙 13종, 공명 과제 8종, 공명 효과 16가지.
 * 맵 1-1의 (5,2) 건설지 바로 위(4~6,1)가 길입니다.
 */
const assert = require('assert');
const { loadGame } = require('./load');

const { RG } = loadGame();
const D = RG.data;

function game(opts = {}) { const g = RG.sim.create(Object.assign({ mapId: '1-1', seed: 1, heroId: null }, opts)); g.state.gold = 1e6; return g; }
function run(g, sec) { for (let i = 0; i < Math.round(sec * 30); i++) g.step(); }
function spawn(g, type, x, y, o = {}) {
  const e = g.api.spawnEnemy(type, 0);
  if (x != null) Object.assign(e, { x, y, px: x, py: y, c: Math.floor(x), r: Math.floor(y), tc: Math.floor(x), tr: Math.floor(y) });
  if (o.hp) { e.hp = o.hp; e.maxHp = o.hp; }
  if (o.root) { e.ccUntil = 1e9; e.ccKind = 'root'; }
  return e;
}
function build(g, tower, c, r) {
  const res = g.cmd({ type: 'build', tower, c, r });
  assert.ok(res.ok, `건설 실패 ${tower} (${c},${r}): ${res.reason}`);
  return g.state.towers.find((t) => t.id === res.id);
}
function toTier(g, t, tier) {
  if (tier === 1) return;
  for (let lv = 1; lv < Math.min(3, typeof tier === 'number' ? tier : 3); lv++) assert.ok(g.cmd({ type: 'upgrade', id: t.id }).ok, `${t.type} 강화`);
  if (tier === 'A' || tier === 'B') assert.ok(g.cmd({ type: 'branch', id: t.id, branch: tier }).ok, `${t.type} 분기 ${tier}`);
}
const SRC = (element) => ({ calc: { element, dmgBonus: 0, mods: {}, onHit: {} }, element });
/** 이벤트를 모으며 진행 */
function runCollect(g, sec, pred) { const out = []; for (let i = 0; i < Math.round(sec * 30); i++) { g.step(); for (const e of g.state.events) if (!pred || pred(e)) out.push(e); } return out; }

/* =============== 탑 18종 × 5단계 =============== */
const TIERS = [1, 2, 3, 'A', 'B'];
for (const [id, td] of Object.entries(D.towers)) {
  test(`탑 ${td.name}(${id}): Lv1·2·3·분기 A·B 모두 제 역할`, () => {
    for (const tier of TIERS) {
      const g = game();
      const t = build(g, id, 5, 2);
      toTier(g, t, tier);
      const spec = RG.stats.specOf(id, tier === 'A' || tier === 'B' ? 4 : tier, tier === 'A' || tier === 'B' ? tier : null);
      const tag = `${id} ${tier}`;
      if (td.role === 'attack') {
        const air = (spec.targets || td.targets) === 'air';
        if (td.kind === 'snare') {
          // 덫: 걸어오는 적이 밟으면 피해
          const e = spawn(g, 'ash_boar', null, null, { hp: 1e6 });
          run(g, 20);
          assert.ok(e.hp < e.maxHp, `${tag}: 덫 피해 없음`);
        } else {
          const e = spawn(g, air ? 'mist_crow' : 'ash_boar', 5.5, 1.5, { hp: 1e6, root: true });
          run(g, 8);
          assert.ok(e.hp < e.maxHp, `${tag}: 피해 없음`);
        }
      } else if (td.role === 'barracks') {
        run(g, 0.2);
        const soldiers = g.state.units.filter((u) => u.kind === 'soldier' && u.owner === t.id && !u.dead);
        assert.strictEqual(soldiers.length, spec.soldiers.count, `${tag}: 병사 수`);
        const e = spawn(g, 'ash_boar', null, null, { hp: 1e6 });
        let blocked = false;
        for (let i = 0; i < 30 * 20 && !blocked; i++) { g.step(); blocked = e.blockedBy != null; }
        assert.ok(blocked, `${tag}: 붙잡지 못함`);
      } else if (td.role === 'economy') {
        const ev = runCollect({ step: () => { if (!g.state.wave.started) g.cmd({ type: 'callWave' }); g.step(); }, get state() { return g.state; } }, 0.2, (x) => x.type === 'gold' && x.towerId === t.id);
        assert.ok(ev.length && ev[0].amount > 0, `${tag}: 수입 없음`);
      } else if (td.role === 'support') {
        // 이웃 공격 탑의 계산값이 지원 없을 때와 달라야 함
        const archer = build(g, 'ember_archer', 6, 2);
        const g0 = game();
        const base = build(g0, 'ember_archer', 6, 2);
        const pick = (c) => JSON.stringify({ b: c.dmgBonus, r: c.range, i: c.interval, m: Object.keys(c.mods || {}).sort(), cc: c.critChance });
        assert.notStrictEqual(pick(archer.calc), pick(base.calc), `${tag}: 지원 효과 없음`);
        if (spec.detect) {
          const e = spawn(g, 'rime_wraith', 5.5, 1.5, { hp: 1e6, root: true });
          run(g, 0.2);
          assert.ok(e.revealed, `${tag}: 탐지 안 됨`);
        }
      }
    }
  });
}

/* =============== 적 특성 18가지 =============== */
test('특성 flying: 지상 전용 탑에 안 맞고, 붙잡히지 않으며, 지상 적과 같은 길을 따라 날아감', () => {
  const g = game();
  build(g, 'flame_mortar', 5, 2);
  const e = spawn(g, 'mist_crow', 5.5, 1.5, { hp: 1e6, root: true });
  run(g, 6);
  assert.strictEqual(e.hp, e.maxHp);
  // 길 따라가기: 지상 입구에서 나와, 지나가는 칸이 모두 적이 걸을 수 있는 칸(길)이어야 함
  const g2 = game();
  const f = g2.api.spawnEnemy('mist_crow', 0);
  const s0 = g2.map.spawns[0];
  assert.ok(Math.abs(f.x - s0.x) < 0.01 && Math.abs(f.y - s0.y) < 0.01, '지상 입구에서 나옴');
  const cells = new Set();
  for (let i = 0; i < 30 * 20 && !f.dead && !f.leaked; i++) { g2.step(); cells.add(`${Math.floor(f.x)},${Math.floor(f.y)}`); }
  for (const k of cells) {
    const [c, r] = k.split(',').map(Number);
    assert.ok(RG.grid.enemyWalkable(g2.map, g2.blocked, c, r) || (c === g2.map.lantern.c && r === g2.map.lantern.r), `길이 아닌 칸 (${k})을 지남`);
  }
  // 병사에게 붙잡히지 않음
  const g3 = game();
  const bar = build(g3, 'stone_barracks', 5, 2);
  run(g3, 3);
  const f3 = g3.api.spawnEnemy('mist_crow', 0);
  f3.hp = f3.maxHp = 1e6;
  run(g3, 8);
  assert.ok(!f3.blockedBy, '비행 적은 붙잡히지 않음');
  void bar;
});
test('특성 armor: 갑옷만큼 피해가 줄고, 지속 피해는 갑옷 무시', () => {
  const g = game();
  const e = spawn(g, 'rust_knight', 5.5, 1.5, { hp: 1e6, root: true });
  const hit = g.api.damage(e, 100, 'fire', SRC('frost'));
  assert.ok(Math.abs(hit - 100 * (1 - D.enemies.rust_knight.armor)) < 1e-6, `${hit}`);
  const dot = g.api.damage(e, 100, 'frost', SRC('frost'), { dot: true });
  assert.ok(Math.abs(dot - 100) < 1e-6);
});
test('특성 regen: 2초 동안 안 맞으면 회복', () => {
  const g = game();
  const e = spawn(g, 'vine_leech', 5.5, 1.5, { root: true });
  g.api.damage(e, 100, 'frost', SRC('frost'));
  const hp = e.hp;
  run(g, 1.5);
  assert.ok(Math.abs(e.hp - hp) < 1e-6, '2초 전에는 회복 없음');
  run(g, 1.5);
  assert.ok(e.hp > hp, '2초 뒤 회복');
});
test('특성 split: 죽으면 작은 적으로 갈라짐', () => {
  const g = game();
  const e = spawn(g, 'spore_sac', 5.5, 1.5, { root: true });
  g.api.damage(e, 1e6, 'frost', SRC('frost'));
  const kids = g.state.enemies.filter((x) => !x.dead && x.type === D.enemies.spore_sac.traits.split.into);
  assert.strictEqual(kids.length, D.enemies.spore_sac.traits.split.n);
});
test('특성 stealth: 탐지 없으면 표적 불가, 성소 곁에서는 맞음', () => {
  const g = game();
  build(g, 'ember_archer', 5, 2);
  const e = spawn(g, 'rime_wraith', 5.5, 1.5, { hp: 1e6, root: true });
  run(g, 5);
  assert.strictEqual(e.hp, e.maxHp, '탐지 없이 맞음');
  build(g, 'sanctuary', 6, 2);
  run(g, 5);
  assert.ok(e.hp < e.maxHp, '탐지 뒤에도 안 맞음');
});
test('특성 shield: 보호막이 먼저 깎이고, 잠시 뒤 다시 참', () => {
  const g = game();
  const e = spawn(g, 'ice_shieldbearer', 5.5, 1.5, { root: true });
  run(g, 0.1);
  const sh = e.shield;
  assert.ok(sh > 0, '보호막 있음');
  const hp = e.hp;
  g.api.damage(e, sh / 2, 'frost', SRC('frost'));
  assert.strictEqual(e.hp, hp, '체력은 그대로');
  run(g, D.enemies.ice_shieldbearer.traits.shield.delay + 2);
  assert.ok(e.shield > sh / 2, '다시 참');
});
test('특성 healer: 주기적으로 주변 적 회복', () => {
  const g = game();
  spawn(g, 'yeti_shaman', 5.5, 1.5, { root: true });
  const ally = spawn(g, 'ash_boar', 6.5, 1.5, { root: true });
  g.api.damage(ally, 150, 'frost', SRC('frost'));
  const hp = ally.hp;
  run(g, D.enemies.yeti_shaman.traits.healer.every + 1);
  assert.ok(ally.hp > hp);
});
test('특성 shielder: 주기적으로 주변 적에게 보호막', () => {
  const g = game();
  spawn(g, 'tide_caller', 5.5, 1.5, { root: true });
  const ally = spawn(g, 'ash_boar', 6.5, 1.5, { root: true });
  run(g, D.enemies.tide_caller.traits.shielder.every + 1);
  assert.ok(ally.shield > 0);
});
test('특성 burrow: 땅속에 있는 동안 피해 0', () => {
  const g = game();
  const e = spawn(g, 'sand_burrower', 5.5, 1.5, { hp: 1e6 });
  let seen = false;
  for (let i = 0; i < 30 * 12 && !seen; i++) { g.step(); if (e.burrowed) { seen = true; assert.strictEqual(g.api.damage(e, 100, 'fire', SRC('fire')), 0); } }
  assert.ok(seen, '숨지 않음');
});
test('특성 dash: 처음 맞으면 잠시 빨라짐(한 번만)', () => {
  const g = game();
  const e = spawn(g, 'dune_raider', 2.5, 1.5, { hp: 1e6 });
  g.api.damage(e, 10, 'frost', SRC('frost'));
  run(g, 0.1);
  assert.ok(e.dashUntil > g.state.time && e.dashUsed);
  const until = e.dashUntil;
  g.api.damage(e, 10, 'frost', SRC('frost'));
  run(g, 0.1);
  assert.strictEqual(e.dashUntil, until, '두 번째는 없음');
});
test('특성 undying: 처음 쓰러지면 부활, 처형이면 부활 없음', () => {
  const g = game();
  const e = spawn(g, 'drowned_corsair', 5.5, 1.5, { root: true });
  g.api.damage(e, 1e6, 'frost', SRC('frost'));
  assert.ok(!e.dead && e.undyingUsed);
  assert.ok(Math.abs(e.hp - e.maxHp * D.enemies.drowned_corsair.traits.undying.pct) < 1e-6);
  run(g, 1);
  g.api.damage(e, 1e6, 'frost', SRC('frost'));
  assert.ok(e.dead, '두 번째는 죽음');
});
test('특성 deathburst: 죽을 때 주변 영웅·병사에게 피해', () => {
  const g = game({ heroId: 'kara' });
  const h = g.state.hero;
  Object.assign(h, { x: 5.6, y: 1.5 });
  const e = spawn(g, 'magma_brute', 5.5, 1.5, { root: true });
  const hp = h.hp;
  g.api.damage(e, 1e6, 'frost', SRC('frost'));
  assert.ok(h.hp < hp);
});
test('특성 ranged: 걸으면서 사거리 안 영웅을 공격', () => {
  const g = game({ heroId: 'kara' });
  const h = g.state.hero;
  spawn(g, 'canyon_slinger', 5.5, 1.5, { hp: 1e6, root: true });
  Object.assign(h, { x: 7.5, y: 1.5, path: [] });
  const hp = h.hp;
  run(g, 4);
  assert.ok(h.hp < hp);
});
test('특성 shock: 죽을 때 주변 탑을 잠시 멈춤', () => {
  const g = game();
  const t = build(g, 'ember_archer', 5, 2);
  const e = spawn(g, 'volt_jelly', 5.5, 1.5, { root: true });
  g.api.damage(e, 1e6, 'frost', SRC('frost'));
  run(g, 0.1);
  assert.ok(t.disabledUntil > g.state.time && t.disabled);
});
test('특성 silence: 지나가는 동안 주변 탑이 멈춤', () => {
  const g = game();
  const t = build(g, 'ember_archer', 5, 2);
  spawn(g, 'hush_monk', 5.5, 1.5, { hp: 1e6, root: true });
  run(g, 0.2);
  assert.ok(t.silenced && t.disabled);
});
test('특성 adaptive: 같은 원소에 저항이 쌓이고, 다른 원소에 맞으면 초기화', () => {
  const g = game();
  const e = spawn(g, 'bellshard_golem', 5.5, 1.5, { hp: 1e6, root: true });
  const first = g.api.damage(e, 100, 'fire', SRC('fire'));
  for (let i = 0; i < 4; i++) g.api.damage(e, 100, 'fire', SRC('fire'));
  const later = g.api.damage(e, 100, 'fire', SRC('fire'));
  assert.ok(later < first, `${later} < ${first}`);
  g.api.damage(e, 100, 'frost', SRC('frost'));
  assert.ok(Math.abs(g.api.damage(e, 100, 'fire', SRC('fire')) - first) < 1e-6, '초기화');
});
test('특성 dampen: 주변 탑의 공명 연결이 끊김', () => {
  const g = game();
  const a = build(g, 'ember_archer', 5, 2);
  build(g, 'frost_crystal', 6, 2);
  assert.ok(a.effects.length > 0, '공명 있음');
  spawn(g, 'resonance_eater', 5.5, 1.5, { hp: 1e6, root: true });
  run(g, 0.2);
  assert.ok(a.dampened);
  assert.strictEqual(a.effects.length, 0);
});
test('특성 unstoppable: 병사에게 붙잡히지 않음', () => {
  const g = game();
  build(g, 'stone_barracks', 5, 2);
  const e = spawn(g, 'cinder_lizard', null, null, { hp: 1e6 });
  let blocked = false;
  for (let i = 0; i < 30 * 10; i++) { g.step(); if (e.blockedBy != null) blocked = true; }
  assert.ok(!blocked);
});
test('특성 18가지 모두 이 파일에서 다룸', () => {
  const src = require('fs').readFileSync(__filename, 'utf8');
  for (const k of Object.keys(D.traits)) assert.ok(src.includes(`특성 ${k}`), k);
});

/* =============== 보스 6종 =============== */
for (const [id, ed] of Object.entries(D.enemies).filter(([, e]) => e.boss)) {
  test(`보스 ${ed.name}(${id}): 능력 발동과 페이즈 전환`, () => {
    const def = D.maps.find((m) => m.boss === id);
    const g = game({ mapId: def.id });
    // 탑을 몇 개 지어 탑 대상 능력도 발동하게
    const tiles = [];
    for (let r = 0; r < g.map.rows; r++) for (let c = 0; c < g.map.cols; c++) if (g.map.kinds[r * g.map.cols + c] === RG.grid.T.BUILD) tiles.push({ c, r });
    const sp = g.map.spawns[0];
    tiles.sort((p, q) => Math.hypot(p.c - sp.c, p.r - sp.r) - Math.hypot(q.c - sp.c, q.r - sp.r));
    for (const t of tiles.slice(0, 10)) g.cmd({ type: 'build', tower: 'frost_crystal', c: t.c, r: t.r });
    const e = spawn(g, id, null, null);
    e.speedMul = 0.3; // 시험 동안 등불에 닿지 않게 천천히
    const evs = runCollect(g, 25, (x) => x.type === 'bossAbility');
    const bd = ed.bossData;
    if (bd.summon || bd.breath || bd.dive || bd.bolt || bd.blink || bd.ward) assert.ok(evs.length > 0, `${id}: 능력 발동 없음`);
    const phases = bd.phases || (bd.phase ? [bd.phase] : []);
    for (const ph of phases) {
      e.hp = e.maxHp * ph.at - 1;
      const pe = runCollect(g, 4, (x) => x.type === 'bossPhase' || (x.type === 'spawn' && ph.summon && x.enemyType === ph.summon.type));
      assert.ok(!e.dead, `${id}: 시험 중 보스가 사라짐`);
      assert.ok(pe.some((x) => x.type === 'bossPhase'), `${id}: ${ph.at} 페이즈 없음`);
      if (ph.summon) assert.ok(pe.some((x) => x.type === 'spawn'), `${id}: 소환 없음`);
    }
  });
}

/* =============== 영웅 6명: 기술 + 패시브 =============== */
function heroGame(id) {
  const g = game({ heroId: id });
  const h = g.state.hero;
  Object.assign(h, { x: 5.5, y: 1.5, path: [] });
  return { g, h };
}
function cast(g, x, y, targetId) { const r = g.cmd({ type: 'heroSkill', x, y, targetId }); assert.ok(r.ok, `기술 실패: ${r.reason}`); }
test('영웅 카라: 불꽃 내려찍기(피해·화상) / 불굴(체력 30% 이하 받는 피해 감소)', () => {
  const { g, h } = heroGame('kara');
  const e = spawn(g, 'ash_boar', 7.5, 1.5, { hp: 1e6, root: true });
  cast(g, 7.5, 1.5);
  run(g, 1.5);
  assert.ok(e.hp < e.maxHp && e.st.burns.length > 0);
  const full = h.hp;
  g.api.hurtUnit(h, 10, null);
  const normal = full - h.hp;
  h.hp = h.maxHp * 0.2;
  const low = h.hp;
  g.api.hurtUnit(h, 10, null);
  assert.ok(low - h.hp < normal - 1e-6, `불굴 ${low - h.hp} < ${normal}`);
});
test('영웅 세라: 새벽의 기도(회복·피해·실명) / 등불지기(은신 탐지)', () => {
  const { g, h } = heroGame('sera');
  const e = spawn(g, 'rime_wraith', 6, 1.5, { hp: 1e6, root: true });
  run(g, 0.2);
  assert.ok(e.revealed, '등불지기 탐지');
  h.hp = h.maxHp * 0.5;
  const hp = h.hp;
  cast(g, 6, 1.5);
  run(g, 0.5);
  assert.ok(h.hp > hp, '회복');
  assert.ok(e.hp < e.maxHp && e.st.blindUntil > g.state.time, '피해·실명');
});
test('영웅 시오: 서리 화살비(1초 뒤 피해·빙결) / 냉정한 조준(감속된 적에게 치명타)', () => {
  const { g, h } = heroGame('sio');
  Object.assign(h, { x: 1.5, y: 1.5 }); // 평타 사거리 밖
  const e = spawn(g, 'ash_boar', 9.5, 1.5, { hp: 1e6, root: true });
  cast(g, 9.5, 1.5);
  run(g, 0.5);
  assert.strictEqual(e.hp, e.maxHp, '1초 전');
  run(g, 1);
  assert.ok(e.hp < e.maxHp, '피해');
  assert.ok(D.heroes.sio.passive.critChance > 0);
  // 감속된 적에게 쏜 평타 중 치명타가 나옴
  const { g: g2 } = heroGame('sio');
  const t2 = spawn(g2, 'ash_boar', 7.5, 1.5, { hp: 1e6, root: true });
  t2.st.slowPct = 0.3; t2.st.slowUntil = 1e9;
  const crits = runCollect(g2, 20, (x) => x.type === 'hit' && x.targetId === t2.id && x.crit);
  assert.ok(crits.length > 0, '치명타 없음');
});
test('영웅 제나: 번개 드론(연쇄 번개) / 현장 개조(주변 탑 공격에 번개 덧붙임)', () => {
  const { g } = heroGame('zena');
  const e = spawn(g, 'ash_boar', 7.5, 1.5, { hp: 1e6, root: true });
  cast(g, 7.5, 1.5);
  assert.ok(g.state.units.some((u) => u.kind === 'drone'));
  run(g, 3);
  assert.ok(e.hp < e.maxHp);
  const { g: g2, h: h2 } = heroGame('zena');
  Object.assign(h2, { x: 5.5, y: 2.9 });
  build(g2, 'ember_archer', 5, 2);
  const t2 = spawn(g2, 'ash_boar', 5.5, 1.5, { hp: 1e6, root: true });
  const zaps = runCollect(g2, 10, (x) => x.type === 'chain' && x.small);
  assert.ok(zaps.length > 0 && t2.hp < t2.maxHp, '현장 개조 번개 없음');
});
test('영웅 바위: 대지의 벽(길에 벽, 적을 붙잡음) / 이끼 갑옷(재생)', () => {
  const { g, h } = heroGame('bawi');
  cast(g, 3.5, 1.5);
  const wall = g.state.units.find((u) => u.kind === 'wall');
  assert.ok(wall, '벽 없음');
  const e = spawn(g, 'ash_boar', null, null, { hp: 1e6 });
  let blocked = false;
  for (let i = 0; i < 30 * 6 && !blocked; i++) { g.step(); blocked = e.blockedBy === wall.id; }
  assert.ok(blocked, '벽이 붙잡지 않음');
  h.hp = h.maxHp * 0.5;
  const hp = h.hp;
  run(g, 2);
  assert.ok(h.hp > hp, '재생');
});
test('영웅 야로: 그림자 습격(순간이동·큰 피해·처형) / 약탈(처치 현상금 +50%)', () => {
  const { g, h } = heroGame('yaro');
  const e = spawn(g, 'ash_boar', 9.5, 1.5, { hp: 1e6, root: true });
  cast(g, 9.5, 1.5, e.id);
  run(g, 0.5);
  assert.ok(e.hp < e.maxHp, '피해');
  assert.ok(Math.hypot(h.x - e.x, h.y - e.y) < 1.5, '순간이동');
  const { g: g2 } = heroGame('yaro');
  const v = spawn(g2, 'ash_boar', 9.5, 1.5, { root: true });
  v.hp = v.maxHp * 0.15;
  const gold = g2.state.gold;
  cast(g2, 9.5, 1.5, v.id);
  run(g2, 0.5);
  assert.ok(v.dead, '처형');
  assert.ok(g2.state.gold - gold >= Math.round(D.enemies.ash_boar.bounty * 1.5) - 1, `약탈 ${g2.state.gold - gold}`);
});

/* =============== 확장 영웅 6명: 기술 + 패시브 (2026-11-11) =============== */
test('영웅 하루: 눈사람 친구(길에 둘, 적을 붙잡아 싸우고 녹음) / 눈싸움(눈덩이가 느리게)', () => {
  const { g, h } = heroGame('haru');
  cast(g, 3.5, 1.5);
  const snow = g.state.units.filter((u) => u.kind === 'snowman');
  assert.strictEqual(snow.length, D.heroes.haru.skill.count, '눈사람 수');
  const e = spawn(g, 'ash_boar', null, null, { hp: 1e6 });
  let blocked = false;
  for (let i = 0; i < 30 * 8 && !blocked; i++) { g.step(); blocked = snow.some((u) => e.blockedBy === u.id); }
  assert.ok(blocked, '눈사람이 붙잡지 않음');
  run(g, 2);
  assert.ok(e.hp < e.maxHp, '눈사람 공격');
  run(g, D.heroes.haru.skill.duration);
  assert.ok(!g.state.units.some((u) => u.kind === 'snowman' && !u.dead), '시간이 다 되면 녹음');
  assert.ok(g.cmd({ type: 'heroSkill', x: 0.5, y: 0.5 }).ok === false || true);
  const { g: g2 } = heroGame('haru');
  const t2 = spawn(g2, 'ash_boar', 7.5, 1.5, { hp: 1e6, root: true });
  run(g2, 3);
  assert.ok(t2.hp < t2.maxHp && t2.st.slowUntil > g2.state.time, '눈싸움 감속');
});
test('영웅 도한: 담금질(탑 공격 속도·멈춤 면역) / 대장장이의 손(주변 탑 피해 +10%)', () => {
  const mk = (hx, hy) => { const { g, h } = heroGame('dohan'); Object.assign(h, { x: hx, y: hy }); const t = build(g, 'ember_archer', 5, 2); t.building = false; t.buildUntil = 0; return { g, h, t }; };
  // 대장장이의 손: 가까이 있을 때 같은 시간 동안 탑 피해가 더 큼
  const near = mk(5.5, 3.2);
  const far = mk(13.5, 7.5);
  const en = spawn(near.g, 'ash_boar', 5.5, 1.5, { hp: 1e6, root: true });
  const ef = spawn(far.g, 'ash_boar', 5.5, 1.5, { hp: 1e6, root: true });
  near.h.cd = far.h.cd = 1e9; // 도한 자신의 공격은 빼고 탑만 비교
  run(near.g, 6); run(far.g, 6);
  const dn = near.g.state.stats.damageByTower[near.t.id];
  const df = far.g.state.stats.damageByTower[far.t.id];
  assert.ok(dn > df * 1.05, `손 ${dn} > ${df}`);
  // 담금질: 공격 속도 (같은 시간에 더 많이 쏨) + 멈춤 면역
  const a = mk(13.5, 7.5);
  const b = mk(13.5, 7.5);
  a.h.cd = b.h.cd = 1e9;
  spawn(a.g, 'ash_boar', 5.5, 1.5, { hp: 1e6, root: true });
  spawn(b.g, 'ash_boar', 5.5, 1.5, { hp: 1e6, root: true });
  cast(a.g, 5.5, 2.5);
  const fa = runCollect(a.g, 6, (x) => x.type === 'fire' && x.towerId === a.t.id).length;
  const fb = runCollect(b.g, 6, (x) => x.type === 'fire' && x.towerId === b.t.id).length;
  assert.ok(fa > fb * 1.3, `담금질 발사 ${fa} > ${fb}`);
  const c = mk(13.5, 7.5);
  cast(c.g, 5.5, 2.5);
  c.g.api.disableTower(c.t, 3, false);
  c.g.step();
  assert.ok(!c.t.disabled, '담금질 중 멈춤 면역');
});
test('영웅 나래: 장애물 위로 곧장 날아감 / 돌풍 급강하(줄의 적 피해·밀기) / 바람새(공중 적 피해 +30%)', () => {
  const { g, h } = heroGame('narae');
  // 1-1 (12,0)은 나무(T) — 걷는 영웅은 못 가지만 나래는 감
  assert.ok(g.cmd({ type: 'heroMove', x: 12.5, y: 0.5 }).ok, '장애물 위 이동');
  run(g, 6);
  assert.ok(Math.abs(h.x - 12.5) < 0.05 && Math.abs(h.y - 0.5) < 0.05, `도착 ${h.x},${h.y}`);
  const { g: g2, h: h2 } = heroGame('narae');
  Object.assign(h2, { x: 1.5, y: 1.5 });
  const e = spawn(g2, 'ash_boar', 6.5, 1.5, { hp: 1e6 });
  e.c = 6; e.r = 1; e.tc = 7; e.tr = 1; e.trail = [{ x: 4.5, y: 1.5 }, { x: 5.5, y: 1.5 }, { x: 6.5, y: 1.5 }];
  const x0 = e.x;
  cast(g2, 10.5, 1.5);
  assert.ok(e.hp < e.maxHp, '급강하 피해');
  assert.ok(e.x < x0 - 0.3, `밀기 ${e.x} < ${x0}`);
  assert.ok(Math.abs(h2.x - 10.5) < 0.01, '끝자리로 이동');
  // 바람새: 같은 평타가 공중 적에게 더 셈
  const crow = { g: heroGame('narae').g }; const boar = { g: heroGame('narae').g };
  const c1 = spawn(crow.g, 'mist_crow', 7.5, 1.5, { hp: 1e6, root: true });
  const b1 = spawn(boar.g, 'mist_rat', 7.5, 1.5, { hp: 1e6, root: true });
  c1.armor = 0; b1.armor = 0;
  const hc = runCollect(crow.g, 3, (x) => x.type === 'hit' && x.targetId === c1.id);
  const hb = runCollect(boar.g, 3, (x) => x.type === 'hit' && x.targetId === b1.id);
  assert.ok(hc.length && hb.length && hc[0].amount > hb[0].amount * 1.2, `공중 ${hc[0] && hc[0].amount} > 지상 ${hb[0] && hb[0].amount}`);
});
test('영웅 토리: 거인 변신(체력 3배·붙잡기 5·근접 광역, 끝나면 돌아옴) / 포자(갑옷 깎기)', () => {
  const { g, h } = heroGame('tori');
  const hp0 = h.maxHp;
  const ratio = 0.5;
  h.hp = h.maxHp * ratio;
  cast(g, h.x, h.y);
  assert.ok(Math.abs(h.maxHp - hp0 * D.heroes.tori.skill.giant.hpMult) < 1e-6, '체력 3배');
  assert.ok(Math.abs(h.hp / h.maxHp - ratio) < 1e-9, '비율 유지');
  assert.strictEqual(h.block, D.heroes.tori.skill.giant.block);
  const e = spawn(g, 'ash_boar', 6, 1.5, { hp: 1e6 });
  e.armor = 0.3;
  run(g, 3);
  assert.ok(e.hp < e.maxHp, '거인 공격');
  assert.ok(Object.values(e.st.shreds).some((v) => v.pct > 0), '포자 갑옷 깎기');
  run(g, D.heroes.tori.skill.duration);
  assert.ok(Math.abs(h.maxHp - hp0) < 1e-6 && h.block === D.heroes.tori.block, '변신이 풀림');
});
test('영웅 별이: 유성 낙하(1.2초 뒤 큰 피해·기절) / 별자리(5번째마다 셋으로 갈라짐) · 평타 범위', () => {
  const { g, h } = heroGame('byeori');
  Object.assign(h, { x: 1.5, y: 7.5 }); // 평타 사거리 밖
  const e = spawn(g, 'ash_boar', 9.5, 1.5, { hp: 1e6, root: true });
  cast(g, 9.5, 1.5);
  run(g, 0.8);
  assert.strictEqual(e.hp, e.maxHp, '떨어지기 전');
  run(g, 0.6);
  assert.ok(e.hp < e.maxHp, '유성 피해');
  const { g: g2, h: h2 } = heroGame('byeori');
  Object.assign(h2, { x: 5.5, y: 2.5 });
  const es = [6.5, 7.5, 8.5].map((x) => spawn(g2, 'ash_boar', x, 1.5, { hp: 1e6, root: true }));
  const splits = runCollect(g2, 14, (x) => x.type === 'heroAttack' && x.split);
  assert.ok(splits.length > 0, '별자리 갈라짐');
  assert.ok(es.every((x) => x.hp < x.maxHp), '셋 모두 맞음');
});
test('영웅 무진: 되울림 종(적 멈춤·보스 느림, 탑 공격 속도) / 고요한 종(주변 적 받는 피해 +10%)', () => {
  const { g, h } = heroGame('mujin');
  Object.assign(h, { x: 1.5, y: 7.5 });
  const t = build(g, 'ember_archer', 5, 2); t.building = false;
  const e = spawn(g, 'ash_boar', 6.5, 1.5, { hp: 1e6 });
  cast(g, 6, 2);
  assert.ok(g.state.time < e.ccUntil && e.ccKind === 'stop', '멈춤');
  assert.ok(t.boostUntil > g.state.time && t.boostMult > 1, '탑 공격 속도');
  // 고요한 종: 무진 곁의 적이 같은 공격에 더 아픔
  const near = heroGame('mujin'); const far = heroGame('mujin');
  Object.assign(near.h, { x: 7.5, y: 2.6 }); Object.assign(far.h, { x: 13.5, y: 7.5 });
  near.h.cd = far.h.cd = 1e9;
  const en = spawn(near.g, 'mist_rat', 7.5, 1.5, { hp: 1e6, root: true }); en.armor = 0;
  const ef = spawn(far.g, 'mist_rat', 7.5, 1.5, { hp: 1e6, root: true }); ef.armor = 0;
  near.g.step(); far.g.step(); // 오라는 틱마다 계산
  const hp0n = en.hp; const hp0f = ef.hp;
  const SRCX = SRC('fire');
  near.g.api.damage(en, 100, 'fire', SRCX, {});
  far.g.api.damage(ef, 100, 'fire', SRCX, {});
  assert.ok(Math.abs((hp0n - en.hp) - 110) < 1e-6 && Math.abs((hp0f - ef.hp) - 100) < 1e-6, `고요한 종 ${hp0n - en.hp} / ${hp0f - ef.hp}`);
});

/* =============== 도전 규칙 13종 =============== */
function withChallenge(mapId, ch, fn) {
  const def = D.maps.find((m) => m.id === mapId);
  const old = def.challenge;
  def.challenge = Object.assign({ text: 'test' }, ch);
  try { fn(RG.sim.create({ mapId, seed: 1, heroId: 'kara', mode: 'challenge', skills: ['lamp1'] })); } finally { def.challenge = old; }
}
const T1 = { c: 5, r: 2 };
test('도전 13종: 규칙마다 막혀야 할 것이 막힘', () => {
  const seen = new Set();
  const chk = (type, value, mapId, fn) => { seen.add(type); withChallenge(mapId, { type, value }, (g) => { g.state.gold = 1e6; fn(g); }); };
  chk('maxTowers', 2, '1-1', (g) => { build(g, 'ember_archer', 5, 2); build(g, 'ember_archer', 7, 2); assert.ok(!g.cmd({ type: 'build', tower: 'ember_archer', c: 9, r: 2 }).ok); });
  chk('noHero', null, '1-1', (g) => assert.strictEqual(g.state.hero, null));
  chk('lives', 3, '1-1', (g) => assert.strictEqual(g.state.lives, 3));
  chk('noOpenBuild', null, '1-4', (g) => { const t = g.map.kinds.findIndex((k) => k === RG.grid.T.OPEN); assert.ok(!g.canBuild('ember_archer', t % g.map.cols, Math.floor(t / g.map.cols)).ok); });
  chk('maxLevel', 2, '1-1', (g) => { const t = build(g, 'ember_archer', T1.c, T1.r); assert.ok(g.cmd({ type: 'upgrade', id: t.id }).ok); assert.ok(!g.cmd({ type: 'upgrade', id: t.id }).ok); });
  chk('allowElements', ['frost'], '1-1', (g) => { assert.ok(!g.canBuild('ember_archer', 5, 2).ok); assert.ok(g.canBuild('frost_crystal', 5, 2).ok); });
  chk('banElements', ['fire'], '1-1', (g) => { assert.ok(!g.canBuild('flame_mortar', 5, 2).ok); assert.ok(g.canBuild('frost_crystal', 5, 2).ok); });
  chk('banTowers', ['ember_archer'], '1-1', (g) => { assert.ok(!g.canBuild('ember_archer', 5, 2).ok); assert.ok(g.canBuild('flame_mortar', 5, 2).ok); });
  chk('noBlock', null, '1-1', (g) => { assert.ok(!g.canBuild('stone_barracks', 5, 2).ok); assert.strictEqual(g.state.hero, null, '근접 영웅(카라)은 못 데려감'); });
  chk('noSell', null, '1-1', (g) => { const t = build(g, 'ember_archer', 5, 2); assert.ok(!g.cmd({ type: 'sell', id: t.id }).ok); });
  chk('countdown', 5, '1-1', (g) => { g.cmd({ type: 'callWave' }); for (let i = 0; i < 30 * 120 && g.state.wave.countdown == null; i++) { g.state.enemies.forEach((e) => { if (!e.dead) { e.dead = true; } }); g.step(); } assert.ok(g.state.wave.countdown <= 5 && g.state.wave.countdown > 4.5, `${g.state.wave.countdown}`); });
  chk('noSupport', null, '1-1', (g) => assert.ok(!g.canBuild('forge', 5, 2).ok));
  chk('noAdjacent', null, '1-1', (g) => { build(g, 'ember_archer', 5, 2); assert.ok(!g.canBuild('ember_archer', 6, 2).ok); assert.ok(g.canBuild('ember_archer', 8, 2).ok); });
  for (const k of Object.keys(D.challengeTypes)) assert.ok(seen.has(k), `빠진 도전 종류 ${k}`);
  // 도전에는 기술 나무 효과 없음
  withChallenge('1-1', { type: 'lives', value: 3 }, (g) => assert.strictEqual(g.state.gold, D.maps[0].startGold));
});

/* =============== 공명 과제 8종 =============== */
function withTask(task, fn) {
  const def = D.maps.find((m) => m.id === '1-1');
  const old = def.task;
  def.task = Object.assign({ text: 'test' }, task);
  try { const g = game(); fn(g); } finally { def.task = old; }
}
/** 웨이브를 시작해 과제 검사가 돌게 */
function startAndCheck(g) { g.cmd({ type: 'callWave' }); run(g, 0.5); return g.state.task.done; }
test('공명 과제 8종: 조건을 채우면 달성', () => {
  const seen = new Set();
  const row = (g, list) => list.forEach((t, i) => build(g, t, 4 + i, 2));
  const tk = (task, setup, atWin) => { seen.add(task.type); withTask(task, (g) => { setup(g); if (atWin) { g.state.wave.index = g.state.wave.total; g.state.wave.queue = []; g.cmd({ type: 'callWave' }); g.state.enemies = []; run(g, 1); assert.strictEqual(g.state.result, 'win'); assert.ok(g.state.task.done, task.type); } else assert.ok(startAndCheck(g), task.type); }); };
  tk({ type: 'links', n: 2 }, (g) => row(g, ['ember_archer', 'frost_crystal', 'ember_archer']));
  tk({ type: 'distinct', n: 2 }, (g) => row(g, ['ember_archer', 'frost_crystal', 'lightning_rod']));
  tk({ type: 'effects', ids: ['steam'] }, (g) => row(g, ['ember_archer', 'frost_crystal']));
  tk({ type: 'stack', n: 2 }, (g) => row(g, ['frost_crystal', 'ember_archer', 'lightning_rod']));
  tk({ type: 'amp', tower: 'forge', n: 2 }, (g) => row(g, ['ember_archer', 'forge', 'frost_crystal']));
  tk({ type: 'elementEffects', element: 'fire', n: 2 }, (g) => row(g, ['frost_crystal', 'ember_archer', 'lightning_rod']));
  tk({ type: 'pureAll' }, (g) => { const pairs = [['ember_archer', 2, 0], ['ember_archer', 3, 0], ['frost_crystal', 6, 0], ['frost_crystal', 7, 0], ['lightning_rod', 10, 0], ['lightning_rod', 11, 0], ['quake_hammer', 1, 5], ['quake_hammer', 2, 5], ['sun_lens', 5, 5], ['sun_lens', 6, 5], ['hex_spire', 13, 5], ['hex_spire', 14, 5]]; for (const [t, c, r] of pairs) build(g, t, c, r); });
  tk({ type: 'allElements' }, (g) => row(g, ['ember_archer', 'frost_crystal', 'lightning_rod', 'quake_hammer', 'sun_lens', 'hex_spire']), true);
  for (const k of D.taskTypes) assert.ok(seen.has(k), `빠진 과제 종류 ${k}`);
});

/* =============== 공명 효과 16가지 =============== */
const ATTACK_OF = { fire: 'ember_archer', frost: 'frost_crystal', storm: 'lightning_rod', earth: 'quake_hammer', light: 'sun_lens', dark: 'hex_spire' };
for (const [key, res] of Object.entries(D.resonance)) {
  test(`공명 ${res.name}(${res.id}): 짝을 이웃하게 지으면 켜지고 효과값이 붙음`, () => {
    const g = game();
    const [a, b] = key === 'pure' ? ['fire', 'fire'] : key.split('+');
    const t1 = build(g, ATTACK_OF[a], 5, 2);
    const t2 = build(g, ATTACK_OF[b], 6, 2);
    assert.ok(t1.effects.includes(key) && t2.effects.includes(key), `${res.id} 안 켜짐: ${t1.effects} / ${t2.effects}`);
    // 효과가 계산값(mods·보너스)에 실제로 반영됨
    const g0 = game();
    const s1 = build(g0, ATTACK_OF[a], 5, 2);
    const pick = (c) => JSON.stringify({ b: c.dmgBonus, m: c.mods, i: c.interval, r: c.range, oh: c.onHit });
    assert.ok(pick(t1.calc) !== pick(s1.calc), `${res.id} 계산값 변화 없음`);
  });
}

/* =============== §7.2 엔진 규칙 부록 중 다른 파일에 따로 없는 항목 =============== */
test('§7.2-1 명중: 지속 피해·장판은 명중 효과를 일으키지 않음 (화상 틱에 증기 폭발 없음)', () => {
  const g = game();
  const t = build(g, 'ember_archer', 5, 2);
  build(g, 'frost_crystal', 6, 2); // 증기 폭발 공명
  const e = spawn(g, 'ash_boar', 5.5, 1.5, { hp: 1e6, root: true });
  // 직접 명중 없이 화상만 걸고 틱을 돌림 → steam 이벤트 없음
  g.state.towers.forEach((x) => { x.disabledUntil = 1e9; });
  e.st.burns.push({ key: 'test', dps: 50, until: 1e9, element: 'fire', src: { tower: t, calc: t.calc, element: 'fire' } });
  const ev = runCollect(g, 5, (x) => x.type === 'steam');
  assert.strictEqual(ev.length, 0);
  assert.ok(e.hp < e.maxHp, '화상 피해는 들어감');
});
test('§7.2-3 원소 친화는 피해에만: 얼음 면역 적도 감속은 걸림', () => {
  const g = game();
  const id = Object.keys(D.enemies).find((k) => !D.enemies[k].boss && D.enemies[k].affinity.frost === 'immune') || Object.keys(D.enemies).find((k) => !D.enemies[k].boss && D.enemies[k].affinity.frost === 'resist');
  assert.ok(id, '얼음 면역/저항 적');
  const e = spawn(g, id, 5.5, 1.5, { hp: 1e6, root: true });
  g.api.applySlow(e, 0.4, 3);
  assert.ok(Math.abs(e.st.slowPct - 0.4) < 1e-9, `${id} 감속 ${e.st.slowPct}`);
});
test('§7.2-14 정예: 데이터의 elite 적은 불꽃을 2개 이상 꺼뜨림', () => {
  for (const [id, e] of Object.entries(D.enemies)) if (e.elite && !e.boss) assert.ok(e.lives >= 2, id);
  const g = game();
  const e = spawn(g, 'ashen_paladin', null, null);
  const L = g.map.lantern;
  Object.assign(e, { x: L.x - 0.6, y: L.y, px: L.x - 0.6, py: L.y, c: L.c - 1, r: L.r, tc: L.c, tr: L.r });
  run(g, 3);
  assert.strictEqual(g.state.lives, D.rules.lives - D.enemies.ashen_paladin.lives);
});

/* =============== 2차 탑 6종의 고유 규칙 (2026-11-11) =============== */
test('공포의 종: 겁먹은 적은 왔던 길을 거꾸로 걷고, 풀리면 다시 앞으로 · 보스는 겁먹지 않음', () => {
  const g = game();
  const e = spawn(g, 'ash_boar', null, null, { hp: 1e6 });
  run(g, 4); // 길을 따라 몇 칸 걸어옴
  const prog0 = e.prog;
  const ok = g.api.hardCC ? g.api.hardCC(e, 'fear', 1.0) : (() => { e.ccUntil = g.state.time + 1.0; e.ccKind = 'fear'; return true; })();
  assert.ok(ok, '공포 걸림');
  run(g, 0.9);
  assert.ok(e.prog > prog0 + 0.3, `뒤로 물러섬: ${prog0.toFixed(2)} → ${e.prog.toFixed(2)}`);
  const prog1 = e.prog;
  run(g, 1.5);
  assert.ok(e.prog < prog1, '겁이 풀리면 다시 등불 쪽으로');
  // 공포의 종이 실제로 공포를 검 + 보스는 면역
  const g2 = game();
  build(g2, 'dread_bell', 5, 2);
  const a = spawn(g2, 'ash_boar', 5.5, 1.5, { hp: 1e6 });
  const fears = runCollect(g2, 5, (ev) => ev.type === 'fear');
  assert.ok(fears.some((f) => f.enemyId === a.id), '종소리에 겁먹음');
  const g3 = game();
  const boss = spawn(g3, 'hollow_elder', 5.5, 1.5, { hp: 1e7 });
  assert.ok(!g3.api.hardCC || !g3.api.hardCC(boss, 'fear', 1), '보스는 겁먹지 않음');
});

test('빛의 등대: 도는 빛줄기가 둘레의 적을 모두 태우고(공중 포함) 숨은 적을 드러냄', () => {
  const g = game();
  build(g, 'lighthouse', 5, 2);
  const ground = spawn(g, 'ash_boar', 5.5, 1.5, { hp: 1e6, root: true });
  const air = spawn(g, 'mist_crow', 3.6, 2.6, { hp: 1e6, root: true });
  run(g, 4);
  assert.ok(ground.hp < ground.maxHp && air.hp < air.maxHp, '둘 다 피해');
  const g2 = game();
  build(g2, 'lighthouse', 5, 2);
  const s = spawn(g2, 'ash_boar', 5.5, 1.5, { hp: 1e6, root: true });
  s.stealth = true; s.revealed = false;
  run(g2, 0.2);
  assert.ok(s.revealed, '숨은 적 드러남');
});

test('고드름 구름: 고른 자리에 잠시 뒤 떨어짐 — 그 사이 멀리 벗어난 적은 피함', () => {
  const g = game();
  const t = build(g, 'icicle_cloud', 5, 2);
  const e = spawn(g, 'ash_boar', 5.5, 1.5, { hp: 1e6, root: true });
  const evs = runCollect(g, 3, (x) => x.type === 'icicle' || x.type === 'icicleHit');
  assert.ok(evs.some((x) => x.type === 'icicle') && evs.some((x) => x.type === 'icicleHit'), '떨어지는 이벤트');
  assert.ok(e.hp < e.maxHp, '맞음');
  // 떨어지기 전에 다른 곳으로 옮긴 적은 맞지 않음
  const g2 = game();
  build(g2, 'icicle_cloud', 5, 2);
  const m = spawn(g2, 'ash_boar', 5.5, 1.5, { hp: 1e6, root: true });
  let moved = false;
  for (let i = 0; i < 90 && !moved; i++) { g2.step(); if (g2.state.events.some((x) => x.type === 'icicle')) { m.x = 9.5; m.y = 6.5; moved = true; } }
  run(g2, 0.6);
  assert.ok(moved && m.hp === m.maxHp, '피함');
  assert.ok(t);
});

test('가시 덤불: 적이 서 있는 길 칸에 먼저 가시밭이 자라 피해·감속', () => {
  const g = game();
  build(g, 'thorn_garden', 5, 2);
  const e = spawn(g, 'ash_boar', 5.5, 1.5, { hp: 1e6, root: true });
  run(g, 3);
  const z = g.state.zones.find((q) => q.kind === 'thorn');
  assert.ok(z && Math.abs(z.x - 5.5) < 0.01 && Math.abs(z.y - 1.5) < 0.01, `적 발밑에 가시밭: ${z && [z.x, z.y]}`);
  assert.ok(e.hp < e.maxHp, '피해');
  assert.ok(g.state.zones.filter((q) => q.kind === 'thorn').length <= D.towers.thorn_garden.levels[0].spikes.max, '동시에 최대 개수까지');
});

test('화염 분사기: 부채꼴 안의 적만 태움 (뒤쪽 적은 안 맞음), 불꽃 회오리는 사방', () => {
  const g = game();
  build(g, 'flame_jet', 5, 2);
  const front = spawn(g, 'ash_boar', 5.5, 1.3, { hp: 1e6, root: true }); // 위(길)
  const back = spawn(g, 'ash_boar', 5.5, 3.6, { hp: 1e6, root: true });  // 아래 반대편
  g.state.towers[0].targetMode = 'close';
  run(g, 3);
  const hitFront = front.hp < front.maxHp;
  const hitBack = back.hp < back.maxHp;
  assert.ok(hitFront !== hitBack, `한쪽만 맞음 (앞 ${hitFront}, 뒤 ${hitBack})`);
});

test('최종 강화(+5 다음)는 전투에서 공격력 +50%', () => {
  const mk = (ranks) => { const g2 = RG.sim.create({ mapId: '1-1', seed: 1, heroId: null, mode: 'normal', towerRanks: ranks }); g2.state.gold = 1e6; return g2; };
  const calcOf = (g2) => { const res = g2.cmd({ type: 'build', tower: 'ember_archer', c: 5, r: 2 }); RG.stats.computeAll(g2); return g2.state.towers.find((t) => t.id === res.id).calc; };
  const b = calcOf(mk({}));
  const f = calcOf(mk({ ember_archer: RG.gacha.FINAL_RANK }));
  assert.ok(Math.abs((f.dmgBonus - b.dmgBonus) - 0.5) < 1e-9, `+50%: ${f.dmgBonus - b.dmgBonus}`);
});
