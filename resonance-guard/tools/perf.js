'use strict';

/* 성능 측정 — 부하 상황에서 시뮬레이션 틱당 시간 (QUALITY.md §7)
 *   node tools/perf.js */
const { loadGame } = require('../tests/load');
const { RG } = loadGame();

function bench(mapId, nEnemies, nTowers, nProj = 0) {
  const g = RG.sim.create({ mapId, seed: 3, heroId: 'zena', mode: 'normal' });
  g.state.gold = 1e7;
  let n = 0;
  const types = RG.data.towerOrder;
  for (let r = 0; r < g.map.rows && n < nTowers; r++) for (let c = 0; c < g.map.cols && n < nTowers; c++) {
    const t = types[n % types.length];
    if (g.cmd({ type: 'build', tower: t, c, r }).ok) {
      const tw = g.state.towers[g.state.towers.length - 1];
      g.cmd({ type: 'upgrade', id: tw.id }); g.cmd({ type: 'upgrade', id: tw.id }); g.cmd({ type: 'branch', id: tw.id, branch: n % 2 ? 'A' : 'B' });
      n++;
    }
  }
  g.cmd({ type: 'callWave' });
  const pool = ['mist_rat', 'ash_boar', 'frost_wolf', 'spray_sprite', 'rock_crab', 'echo_shade', 'ice_shieldbearer'];
  for (let i = 0; i < nEnemies; i++) { const e = g.api.spawnEnemy(pool[i % pool.length], 0); e.hp = e.maxHp = 1e9; }
  for (let i = 0; i < 60; i++) g.step();
  const t0 = process.hrtime.bigint();
  const N = 300;
  let maxProj = 0;
  for (let i = 0; i < N; i++) {
    g.step();
    // 투사체 부하: 모자란 만큼 화살을 채워 넣음 (QUALITY.md §7 "투사체 1000")
    if (nProj) {
      const live = g.state.enemies.filter((e) => !e.dead);
      const t0w = g.state.towers[0];
      while (g.state.projectiles.length < nProj && live.length) {
        const e = live[g.state.projectiles.length % live.length];
        g.state.projectiles.push({ id: 1e6 + g.state.projectiles.length + i * 2000, kind: 'arrow', element: 'fire', x: t0w.x, y: t0w.y, px: t0w.x, py: t0w.y, targetId: e.id, tx: e.x, ty: e.y, speed: 0.5, src: { tower: t0w, calc: t0w.calc, element: 'fire' }, base: 1, towerType: t0w.type, level: 1, branch: null });
      }
    }
    maxProj = Math.max(maxProj, g.state.projectiles.length);
    while (g.state.enemies.length < nEnemies) { const e = g.api.spawnEnemy(pool[g.state.enemies.length % pool.length], 0); e.hp = e.maxHp = 1e9; }
  }
  const ms = Number(process.hrtime.bigint() - t0) / 1e6 / N;
  return { mapId, enemies: g.state.enemies.length, towers: g.state.towers.length, projectiles: maxProj, msPerTick: Math.round(ms * 100) / 100 };
}

for (const [m, e, t, p] of [['1-1', 100, 20, 0], ['5-6', 300, 40, 0], ['3-4', 300, 50, 0], ['5-6', 300, 40, 1000]]) console.log(JSON.stringify(bench(m, e, t, p)));
