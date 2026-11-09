'use strict';

/* 성능 측정 — 부하 상황에서 시뮬레이션 틱당 시간 (QUALITY.md §7)
 *   node tools/perf.js */
const { loadGame } = require('../tests/load');
const { RG } = loadGame();

function bench(mapId, nEnemies, nTowers) {
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
    maxProj = Math.max(maxProj, g.state.projectiles.length);
    while (g.state.enemies.length < nEnemies) { const e = g.api.spawnEnemy(pool[g.state.enemies.length % pool.length], 0); e.hp = e.maxHp = 1e9; }
  }
  const ms = Number(process.hrtime.bigint() - t0) / 1e6 / N;
  return { mapId, enemies: g.state.enemies.length, towers: g.state.towers.length, projectiles: maxProj, msPerTick: Math.round(ms * 100) / 100 };
}

for (const [m, e, t] of [['1-1', 100, 20], ['5-6', 300, 40], ['3-4', 300, 50]]) console.log(JSON.stringify(bench(m, e, t)));
