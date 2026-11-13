'use strict';

/* 탑 각성 (Lv5) — js/data/awaken.js · js/core/awaken.js · sim(canAwaken, echo, onHit.awBurst) (docs/design/awaken.md) */
const assert = require('assert');
const { loadGame } = require('./load');

const fresh = () => { const L = loadGame(); L.RG.progress.load(); return L; };
const spotOf = (g, type) => { for (let r = 0; r < g.map.rows; r++) for (let c = 0; c < g.map.cols; c++) { const cb = g.canBuild(type, c, r); if (cb && cb.ok) return { c, r }; } return null; };
/** 탑 하나를 지어 분기(Lv4)까지 올린 판 */
function lv4(RG, type, branch, extra = {}) {
  const g = RG.sim.create(Object.assign({ mapId: '3-4', mode: 'normal', seed: 2, heroId: null, shardLv: { [type]: 5 }, shardStart: true, branches: true, towers: [type] }, extra));
  g.state.gold = 1e6;
  const sp = spotOf(g, type);
  const id = g.cmd({ type: 'build', tower: type, c: sp.c, r: sp.r }).id;
  for (let i = 0; i < 120; i++) g.step();
  const t = () => g.state.towers.find((x) => x.id === id);
  while (t().level < 3) assert.ok(g.cmd({ type: 'upgrade', id }).ok);
  assert.ok(g.cmd({ type: 'branch', id, branch }).ok);
  return { g, id, t };
}

test('모든 탑(32종)에 각성이 있고, 두 분기 모두 판이 읽을 수 있는 spec이 됨 (함수 없음, 분기보다 비쌈)', () => {
  const { RG } = fresh();
  const A = RG.data.awaken;
  assert.strictEqual(Object.keys(A.towers).length, RG.data.towerOrder.length);
  const names = new Set();
  for (const type of RG.data.towerOrder) {
    const aw = A.towers[type];
    assert.ok(aw && aw.name && aw.desc && typeof aw.patch === 'function', type);
    assert.ok(!names.has(aw.name), `각성 이름이 겹침: ${aw.name}`);
    names.add(aw.name);
    for (const b of ['A', 'B']) {
      const s = RG.awaken.spec(type, b);
      assert.strictEqual(JSON.stringify(JSON.parse(JSON.stringify(s))), JSON.stringify(s), `${type} ${b}: JSON으로 그대로`);
      assert.ok(s.cost > RG.data.towers[type].branches[b].cost, `${type} ${b}: 각성 비용`);
      assert.ok(s.awakened && s.name.includes(aw.name));
      assert.strictEqual(RG.awaken.spec(type, b), s, '캐시 (같은 입력이면 같은 spec)');
      assert.strictEqual(RG.stats.specOf(type, 5, b), s, 'stats.specOf(Lv5)');
      // 분기 원본은 그대로
      assert.ok(!RG.data.towers[type].branches[b].awakened, `${type} ${b}: 분기 원본을 바꾸면 안 됨`);
    }
  }
});

test('각성 조건: 분기를 고른 Lv4 + 그 탑 조각 5단계 — 4단계·도전 모드·Lv3·shardStart 없는 예전 판은 안 됨', () => {
  const { RG } = fresh();
  const ok = lv4(RG, 'ember_archer', 'A');
  const info = ok.g.towerInfo(ok.id);
  const aw = info.next.find((n) => n.type === 'awaken');
  assert.ok(aw && aw.level === 5 && aw.name === RG.data.awaken.towers.ember_archer.name);
  const gold0 = ok.g.state.gold;
  assert.ok(ok.g.cmd({ type: 'upgrade', id: ok.id }).ok);
  assert.strictEqual(ok.t().level, 5);
  assert.strictEqual(ok.t().branch, 'A', '분기는 그대로');
  assert.strictEqual(gold0 - ok.g.state.gold, aw.cost, '각성 비용');
  assert.ok(!ok.g.cmd({ type: 'upgrade', id: ok.id }).ok, 'Lv5가 끝');
  assert.ok(ok.g.towerInfo(ok.id).name.includes('불새 화살'));
  assert.strictEqual(ok.t().calc.echo, 3, '고유 능력이 계산에 들어감');

  const four = lv4(RG, 'ember_archer', 'A', { shardLv: { ember_archer: 4 } });
  assert.ok(!four.g.towerInfo(four.id).next.some((n) => n.type === 'awaken'), '조각 4단계는 각성 없음');
  const r4 = four.g.cmd({ type: 'upgrade', id: four.id });
  assert.ok(!r4.ok && /조각 강화/.test(r4.reason || r4.msg || JSON.stringify(r4)), '까닭 안내');
  const old = lv4(RG, 'ember_archer', 'A', { shardStart: false });
  assert.ok(!old.g.cmd({ type: 'upgrade', id: old.id }).ok, 'shardStart 없는 판(예전 판 이어하기)은 각성 없음');
  // 도전 모드: 조각을 쓰지 않으므로 각성도 없음
  const ch = RG.sim.create({ mapId: '3-4', mode: 'challenge', seed: 2, heroId: null, shardLv: { ember_archer: 5 }, shardStart: true, branches: true });
  ch.state.gold = 1e6;
  const sp = spotOf(ch, 'ember_archer');
  if (sp) {
    const id = ch.cmd({ type: 'build', tower: 'ember_archer', c: sp.c, r: sp.r }).id;
    for (let i = 0; i < 120; i++) ch.step();
    for (let i = 0; i < 2; i++) ch.cmd({ type: 'upgrade', id });
    ch.cmd({ type: 'branch', id, branch: 'A' });
    const tw = ch.state.towers.find((x) => x.id === id);
    if (tw.level === 4) assert.ok(!ch.cmd({ type: 'upgrade', id }).ok, '도전 모드는 각성 없음');
  }
});

test('모든 탑·분기: 각성하면 Lv5가 되고 판이 오류 없이 돌아감', () => {
  const { RG } = fresh();
  for (const type of RG.data.towerOrder) {
    for (const b of ['A', 'B']) {
      const x = lv4(RG, type, b);
      assert.ok(x.g.cmd({ type: 'upgrade', id: x.id }).ok, `${type} ${b}`);
      assert.strictEqual(x.t().level, 5);
      x.g.cmd({ type: 'callWave' });
      for (let i = 0; i < 30 * 12; i++) x.g.step();
      assert.ok(Number.isFinite(x.g.state.gold), `${type} ${b}`);
    }
  }
});

test('각성한 공격 탑은 Lv4보다 세다 (단단한 적, 같은 판)', () => {
  const { RG } = fresh();
  const dmg = (type, b, awaken) => {
    const x = lv4(RG, type, b, { hpMult: 30 });
    if (awaken) assert.ok(x.g.cmd({ type: 'upgrade', id: x.id }).ok);
    x.g.cmd({ type: 'callWave' });
    for (let i = 0; i < 30 * 45; i++) { x.g.step(); if (x.g.state.wave.countdown != null) x.g.cmd({ type: 'callWave' }); }
    return x.g.state.stats.damageByTower[x.id] || 0;
  };
  for (const type of ['ember_archer', 'flame_mortar', 'frost_crystal', 'lightning_rod', 'sun_lens', 'hex_spire', 'shadow_dragon', 'chrono_spire']) {
    const a = dmg(type, 'A', false);
    const b = dmg(type, 'A', true);
    assert.ok(b > a * 1.15, `${type}: ${Math.round(a)} → ${Math.round(b)}`);
  }
});

test('메아리(echo): N번째 공격마다 한 번 더 — 각성 폭발(awBurst): 맞은 적 주변에 피해', () => {
  const { RG } = fresh();
  const x = lv4(RG, 'ember_archer', 'A', { hpMult: 30 });
  assert.ok(x.g.cmd({ type: 'upgrade', id: x.id }).ok);
  x.g.cmd({ type: 'callWave' });
  let echoes = 0;
  for (let i = 0; i < 30 * 60; i++) { x.g.step(); for (const e of x.g.state.events) if (e.type === 'echo' && e.towerId === x.id) echoes++; }
  assert.ok(echoes >= 3, `메아리 ${echoes}번`);
  // 지옥불(화염 분사기): 네 번 맞힐 때마다 주변 폭발 이벤트
  const y = lv4(RG, 'flame_jet', 'A', { hpMult: 30 });
  assert.ok(y.g.cmd({ type: 'upgrade', id: y.id }).ok);
  assert.ok(y.t().calc.onHit.awBurst, '계산에 각성 폭발');
  y.g.cmd({ type: 'callWave' });
  let bursts = 0;
  for (let i = 0; i < 30 * 40; i++) { y.g.step(); for (const e of y.g.state.events) if (e.type === 'pulse' && e.towerId === y.id) bursts++; }
  assert.ok(bursts >= 1, `각성 폭발 ${bursts}번`);
});

test('지원·병영·광산 각성: 오라·병사·수입이 커짐', () => {
  const { RG } = fresh();
  const s4 = RG.stats.specOf('forge', 4, 'A');
  const s5 = RG.stats.specOf('forge', 5, 'A');
  assert.ok(s5.aura.damagePct > s4.aura.damagePct && s5.aura.speedPct > 0);
  const b5 = RG.stats.specOf('stone_barracks', 5, 'B');
  const b4 = RG.stats.specOf('stone_barracks', 4, 'B');
  assert.strictEqual(b5.soldiers.count, b4.soldiers.count + 1);
  assert.ok(b5.soldiers.hp > b4.soldiers.hp && b5.soldiers.respawn < b4.soldiers.respawn);
  assert.ok(RG.stats.specOf('crystal_mine', 5, 'A').income > RG.stats.specOf('crystal_mine', 4, 'A').income);
  assert.ok(RG.stats.specOf('sanctuary', 5, 'B').heal.hps > RG.stats.specOf('sanctuary', 4, 'B').heal.hps);
  // 병영 각성: 판에서 병사가 한 명 더
  const x = lv4(RG, 'stone_barracks', 'B');
  const n4 = x.t().soldiers.length;
  assert.ok(x.g.cmd({ type: 'upgrade', id: x.id }).ok);
  assert.strictEqual(x.t().soldiers.length, n4 + 1);
});

test('봇: 조각 5단계 탑을 각성시킴', () => {
  const { RG } = fresh();
  const { makeEnv } = require('./bots');
  const env = makeEnv(RG);
  const r = env.run({ mapId: '4-6', mode: 'normal', seed: 3, heroId: 'kara', towers: ['ember_archer'], shardLv: { ember_archer: 5 }, shardStart: true, branches: true }, 'greedy');
  assert.ok(r.towers.some((t) => t.startsWith('ember_archer:5')), r.towers.join(' '));
});

test('각성 폭발은 그 공격 피해의 pct만큼 (공격 보너스를 두 번 곱하지 않음 — 검토에서 찾은 것)', () => {
  const { RG } = fresh();
  for (const rank of [0, 5]) {
    const type = 'frost_crystal';
    const g = RG.sim.create({ mapId: '3-4', mode: 'normal', seed: 2, heroId: null, shardLv: { [type]: 5 }, shardStart: true, branches: true, towers: [type], towerRanks: { [type]: rank } });
    g.state.gold = 1e6;
    let sp = null;
    for (let r = 0; r < g.map.rows && !sp; r++) for (let c = 0; c < g.map.cols && !sp; c++) {
      const cb = g.canBuild(type, c, r); if (!cb || !cb.ok) continue;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { const k = (r + dr) * g.map.cols + (c + dc); if (isFinite(g.flow[k]) && g.flow[k] > 3 && g.flow[k] < 200 && !sp) sp = { c, r }; }
    }
    const id = g.cmd({ type: 'build', tower: type, c: sp.c, r: sp.r }).id;
    for (let i = 0; i < 120; i++) g.step();
    const t = () => g.state.towers.find((x) => x.id === id);
    while (t().level < 3) g.cmd({ type: 'upgrade', id });
    g.cmd({ type: 'branch', id, branch: 'B' });
    assert.ok(g.cmd({ type: 'upgrade', id }).ok);
    assert.ok(t().calc.dmgBonus > 0, '조각 5단계 보너스가 있는 상태에서');
    let best = null; let bd = 1e9;
    for (let r = 0; r < g.map.rows; r++) for (let c = 0; c < g.map.cols; c++) { const k = r * g.map.cols + c; if (!isFinite(g.flow[k]) || g.flow[k] < 3) continue; const dd = (c + 0.5 - t().x) ** 2 + (r + 0.5 - t().y) ** 2; if (dd < bd) { bd = dd; best = { c, r, x: c + 0.5, y: r + 0.5, trail: [], tc: c, tr: r }; } }
    for (let i = 0; i < 3; i++) { const e = g.api.spawnEnemy('ash_boar', 0, { from: best, index: i }); e.hp = e.maxHp = 1e7; }
    let checked = 0;
    for (let k = 0; k < 500 && checked < 2; k++) {
      g.step();
      const pulse = g.state.events.find((e) => e.type === 'pulse' && e.towerId === id);
      if (!pulse) continue;
      const hits = g.state.events.filter((e) => e.type === 'hit' && !e.dot).map((h) => h.amount).sort((a, b) => b - a);
      if (hits.length < 2) continue;
      const ratio = hits[hits.length - 1] / hits[0];
      assert.ok(Math.abs(ratio - t().calc.onHit.awBurst.pct) < 0.02, `뽑기 강화 +${rank}: 폭발/명중 ${ratio.toFixed(3)} (설명은 ${t().calc.onHit.awBurst.pct})`);
      checked++;
    }
    assert.ok(checked > 0, '폭발을 봄');
  }
});
