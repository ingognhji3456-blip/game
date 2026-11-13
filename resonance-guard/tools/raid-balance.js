'use strict';

/*
 * 조각 레이드 밸런스 — 탑마다 난이도 1~5를 봇으로 돌려 봄 (docs/design/raid.md)
 *   node tools/raid-balance.js                       # 모든 탑 × 난이도 1~5, 그리디(영웅 카라)
 *   node tools/raid-balance.js --towers sanctuary,forge --d 1-3 --hero kara --shard 0
 *   node tools/raid-balance.js --search --d 3-5       # 그리디가 지면 탐색 봇으로 다시
 *   node tools/raid-balance.js --json out.json
 *   node tools/raid-balance.js --towers stone_barracks --f 0.2 --d 4-5 --search   # 보정값을 바꿔 봄
 * 공격 탑·병영: 그리디 봇(그 탑만 지을 수 있음). 지원·경제 탑: 영웅 곁에 그 탑을 모아 짓고 올리는 봇.
 */
const fs = require('fs');
const { makeEnv, loadGame } = require('../tests/bots');

const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const flag = (k) => args.includes(k);

const { RG } = loadGame();
const D = RG.data;
const env = makeEnv(RG);
const range = (s) => { const [a, b] = String(s).split('-').map(Number); const out = []; for (let i = a; i <= (b || a); i++) out.push(i); return out; };

const towers = arg('--towers') ? arg('--towers').split(',') : D.towerOrder;
const diffs = range(arg('--d', '1-5'));
const hero = arg('--hero', 'kara');
const shard = Number(arg('--shard', 0));

/** 지원·경제 탑 레이드 봇: 영웅 자리 주변(반경 안) 건설지에 그 탑을 짓고, 남는 골드로 올림. 기술은 무리에 */
function supportRun(opts) {
  const g = RG.sim.create(opts);
  const S = D.raid.supportHero;
  const type = opts.raid.tower;
  const h = g.state.hero;
  const spots = [];
  for (let r = 0; r < g.map.rows; r++) {
    for (let c = 0; c < g.map.cols; c++) {
      const d2 = (c + 0.5 - h.x) ** 2 + (r + 0.5 - h.y) ** 2;
      if (d2 <= S.radius * S.radius) spots.push({ c, r, d2 });
    }
  }
  spots.sort((a, b) => a.d2 - b.d2);
  let guard = 0;
  let t = 0;
  while (!g.state.result && guard++ < 30 * 60 * 30) {
    t += 1;
    const st = g.state;
    if (t % 10 === 0) {
      const mine = st.towers.filter((x) => x.type === type);
      let done = false;
      if (mine.length < S.max + (type === 'crystal_mine' ? 2 : 0)) {
        for (const sp of spots) { const cb = g.canBuild(type, sp.c, sp.r); if (!cb || !cb.ok) continue; const res = g.cmd({ type: 'build', tower: type, c: sp.c, r: sp.r }); if (res && res.ok) { done = true; break; } }
      }
      if (!done) {
        for (const tw of mine.sort((a, b) => a.level - b.level)) {
          if (tw.level >= 3) continue;
          const res = g.cmd({ type: 'upgrade', id: tw.id });
          if (res && res.ok) break;
        }
      }
      // 분기(Lv4)는 첫 갈래
      for (const tw of mine) if (tw.level === 3) { const res = g.cmd({ type: 'branch', id: tw.id, branch: 'A' }); if (res && res.ok) break; }
      if (st.hero && !st.hero.dead && st.hero.skillCd <= 0) {
        let best = null; let bn = 0;
        const sk = D.heroes[st.hero.heroId].skill; const R = sk.radius || 1;
        for (const e of st.enemies) { let n = 0; for (const o of st.enemies) if ((o.x - e.x) ** 2 + (o.y - e.y) ** 2 <= R * R) n++; if (n > bn) { bn = n; best = e; } }
        if (best && bn >= 3) g.cmd({ type: 'heroSkill', x: best.x, y: best.y, targetId: best.id });
      }
      if (st.wave.index < st.wave.total && (st.wave.index === 0 || st.wave.timer != null)) {
        if (st.wave.index === 0 && mine.length >= 2) g.cmd({ type: 'callWave' });
      }
    }
    g.step();
  }
  const st = g.state;
  return { result: st.result || 'timeout', lives: st.lives, waves: st.wave.index, total: st.wave.total, towers: st.towers.map((x) => `${x.type}:${x.level}${x.branch || ''}`) };
}

/** f: 탑 보정값을 이 값으로 바꿔 봄(보정용) */
function one(type, d, f = null) {
  const setup = RG.raid.setup(type, d, hero);
  const opts = Object.assign({ mode: 'normal', seed: 1, heroId: hero }, setup);
  if (f != null) opts.hpMult = Math.round(setup.hpMult / RG.raid.towerScale(type) * f * 1000) / 1000;
  if (shard > 0) opts.shardLv = { [type]: shard };
  if (setup.raid.support) return Object.assign({ bot: 'support' }, supportRun(opts));
  let r = env.run(opts, 'greedy');
  let bot = 'greedy';
  if (r.result !== 'win' && flag('--search')) {
    const s = env.searchBest(opts, { gens: 8, pop: 10, maxGens: 16, objective: 'challenge' }, 2);
    r = s.best.r; bot = 'search';
  }
  return { bot, result: r.result, lives: r.lives, waves: r.waves, total: r.total, towers: r.towers };
}

const out = {};
const t0 = Date.now();
if (flag('--calibrate-heroes')) {
  // 지원 탑 레이드의 영웅 보정: 기준 탑(--tower, 기본 성소)·기준 난이도(--at 2)를 영웅마다 이기는 최대 배율 ÷ 카라의 것
  const at = Number(arg('--at', 2));
  const ref = arg('--tower', 'sanctuary');
  const grid = [0.1, 0.13, 0.17, 0.22, 0.28, 0.36, 0.46, 0.6, 0.78, 1, 1.3, 1.69, 2.2, 2.86, 3.7, 4.8, 6.3];
  const maxOf = (h) => {
    let best = 0;
    for (const f of grid) {
      const setup = RG.raid.setup(ref, at, h);
      const opts = Object.assign({ mode: 'normal', seed: 1, heroId: h }, setup);
      opts.hpMult = Math.round(setup.hpMult / RG.raid.heroScale(h) * f * 1000) / 1000;
      const r = supportRun(opts);
      if (r.result === 'win') best = f; else break;
    }
    return best;
  };
  const base = maxOf('kara');
  const table = {};
  for (const h of D.heroOrder) { const m = h === 'kara' ? base : maxOf(h); table[h] = Math.max(0.1, Math.round((m / base) * 100) / 100); console.log(`${h.padEnd(8)} 이김 최대 ×${m} → 보정 ${table[h]}`); }
  console.log(JSON.stringify(table));
  process.exit(0);
}
if (flag('--calibrate')) {
  // 탑마다 보정값: 기준 난이도(--at, 기본 2)를 봇이 이기는 가장 큰 배율 ÷ 여유(--margin)
  const at = Number(arg('--at', 2));
  const margin = Number(arg('--margin', 1.3));
  const grid = [0.2, 0.25, 0.3, 0.36, 0.43, 0.52, 0.62, 0.75, 0.9, 1.08, 1.3, 1.56, 1.87, 2.25, 2.7, 3.24, 3.9, 4.7, 5.6, 6.7, 8.1, 9.7];
  const table = {};
  for (const type of towers) {
    let best = 0;
    for (const f of grid) { const r = one(type, at, f); if (r.result === 'win') best = f; else break; }
    table[type] = Math.max(0.2, Math.round(best / margin * 100) / 100);
    console.log(`${type.padEnd(16)} ${D.towers[type].role.padEnd(8)} 이김 최대 ×${best} → 보정 ${table[type]}`);
  }
  console.log(JSON.stringify(table));
  if (arg('--json')) fs.writeFileSync(arg('--json'), JSON.stringify(table, null, 1));
  process.exit(0);
}
for (const type of towers) {
  out[type] = {};
  const line = [];
  for (const d of diffs) {
    const r = one(type, d, arg('--f') ? Number(arg('--f')) : null);
    out[type][d] = r;
    line.push(`d${d}:${r.result === 'win' ? `W${r.lives}` : `L${r.waves}/${r.total}`}${r.bot === 'search' ? 's' : ''}`);
  }
  console.log(`${type.padEnd(16)} ${D.towers[type].role.padEnd(8)} ${line.join(' ')}`);
}
const wins = diffs.map((d) => towers.filter((t) => out[t][d].result === 'win').length);
console.log(`승리 수 (탑 ${towers.length}개): ${diffs.map((d, i) => `d${d} ${wins[i]}`).join(' · ')} — ${((Date.now() - t0) / 1000).toFixed(0)}초`);
if (arg('--json')) fs.writeFileSync(arg('--json'), JSON.stringify(out, null, 1));
