'use strict';

/*
 * 공명석 웨이브 밸런스 — 난이도마다 봇으로 돌려 봄 (docs/design/crystal.md)
 *   node tools/crystal-balance.js                    # 그 시점 탑 묶음 × 영웅 3 × 난이도 1~3, 그리디 한 판씩 (결과·시간·탑 수·번 골드)
 *   node tools/crystal-balance.js --econ             # 난이도마다 전체 적 체력·처치 골드·골드 배율
 *   node tools/crystal-balance.js --margins          # 체력 여유: 체력을 올려 가며 봇(전략 7가지 중 하나라도)이 이기는 최대 배율
 *   node tools/crystal-balance.js --margins --d 3 --sets mix2,basic3 --heroes kara,sio --seeds 1,2 --j 4
 * 탑 묶음: basic3 = 기본 탑 3종(쉬움을 여는 1-3 무렵), mix1 = 지역 2까지 원소마다 1종(보통을 여는 2-6 무렵),
 *          mix2 = 지역 4까지 원소마다 2종(어려움을 여는 4-6 무렵). 공격 탑·병영만, 기술 나무·뽑기 강화 없이.
 * 맞춘 기준: 그 난이도의 묶음으로 여유 1.3배 안팎, 같은 묶음이면 쉬움 > 보통 > 어려움.
 */
const path = require('path');
const { spawn } = require('child_process');
const { makeEnv, loadGame } = require('../tests/bots');

const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const flag = (k) => args.includes(k);
const list = (k, d) => String(arg(k, d)).split(',').filter(Boolean);

const { RG } = loadGame();
const D = RG.data;
const env = makeEnv(RG);
RG.progress.load();

const region = (r) => D.towerOrder.filter((t) => RG.progress.towerRegion(t) <= r);
const mix = (r, k) => {
  const out = [];
  for (const el of D.elementOrder) out.push(...region(r).filter((t) => D.towers[t].element === el && ['attack', 'barracks'].includes(D.towers[t].role)).slice(0, k));
  return out;
};
const SETS = { basic3: ['ember_archer', 'frost_crystal', 'stone_barracks'], mix1: mix(2, 1), mix2: mix(4, 2) };
const INTENDED = { 1: 'basic3', 2: 'mix1', 3: 'mix2' };

/** 한 판: 게임 화면과 같은 출발 설정 (js/ui/crystal.js) — 쉬움은 분기 없이(1-3 무렵), 체력만 scale배 */
function run(d, set, hero, seed, scale = 1, style) {
  const base = RG.crystal.setup(d);
  const opts = Object.assign({ mode: 'normal', seed, heroId: hero, towers: SETS[set] || set.split('+'), branches: d > 1, finalLv2: true, shardStart: true }, base, { hpMult: base.hpMult * scale });
  const r = env.run(opts, 'greedy', style);
  const st = r.game.state;
  return { win: r.result === 'win', lives: r.lives, waves: r.waves, total: r.total, t: Math.round(r.time), towers: st.towers.length, gold: Math.round(st.stats.goldEarned) };
}
/** 전략(env.STYLES) 중 하나라도 이기면 이김 — 봇 한 가지 버릇(예: 불 탑만 모으다 불 면역 적에 짐)에 끌려가지 않게 */
function runAny(d, set, hero, seed, scale) {
  let best = null;
  for (const style of env.STYLES) {
    const r = run(d, set, hero, seed, scale, style);
    if (!best || (r.win && !best.win) || (r.win === best.win && (r.win ? r.lives > best.lives : r.waves > best.waves))) best = r;
    if (best.win) break;
  }
  return best;
}
const SCALES = [0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.45, 1.6, 1.8, 2, 2.3, 2.6, 3];
/** 체력 여유: 1배에서 시작해 지는 첫 배율 바로 아래 (1배에서 지면 이기는 배율까지 내려감) */
function margin(d, set, hero, seed) {
  const r1 = runAny(d, set, hero, seed, 1);
  let best = 0; let lossAt = null;
  if (r1.win) {
    best = 1;
    for (const s of SCALES.filter((x) => x > 1)) { const r = runAny(d, set, hero, seed, s); if (r.win) best = s; else { lossAt = { s, wave: r.waves }; break; } }
  } else {
    lossAt = { s: 1, wave: r1.waves };
    for (const s of SCALES.filter((x) => x < 1).reverse()) if (runAny(d, set, hero, seed, s).win) { best = s; break; }
  }
  return { d, set, hero, seed, best, lossAt, at1: r1 };
}

const fmt = (r) => `${r.win ? `이김 목숨 ${r.lives}` : `짐 ${r.waves}/${r.total}`} · ${Math.round(r.t / 6) / 10}분 · 탑 ${r.towers} · 골드 ${r.gold}`;

if (arg('--job')) { // --margins의 일꾼 (child process)
  const [d, set, hero, seed] = arg('--job').split(':');
  console.log(JSON.stringify(margin(+d, set, hero, +seed)));
} else if (flag('--econ')) {
  for (let d = 1; d <= 3; d++) {
    const s = RG.crystal.setup(d);
    let hp = 0; let gold = 0; let n = 0;
    RG.grid.parseWaves(s.crystal.waves).forEach((w, i) => { for (const g of w.groups) { const ed = D.enemies[g.e]; hp += g.n * ed.hp * s.hpMult * s.crystal.ramp[i]; gold += g.n * ed.bounty * s.crystal.goldMult; n += g.n; } });
    console.log(`${D.crystal.difficulty[d - 1].name}: 웨이브 ${s.crystal.waves.length} · 적 ${n} · 전체 체력 ${Math.round(hp)} · 처치 골드 ${Math.round(gold)} (배율 ×${s.crystal.goldMult}) · 체력 1000당 ${(gold / hp * 1000).toFixed(1)} · 시작 ${s.crystal.startGold}`);
  }
} else if (flag('--margins')) {
  const diffs = list('--d', '1,2,3').map(Number);
  const jobs = [];
  for (const d of diffs) for (const set of list('--sets', INTENDED[d])) for (const hero of list('--heroes', 'kara,sera,sio')) for (const seed of list('--seeds', '1,2')) jobs.push(`${d}:${set}:${hero}:${seed}`);
  const J = Number(arg('--j', 4));
  const out = [];
  let i = 0; let running = 0;
  const next = () => {
    if (i >= jobs.length && running === 0) return report();
    while (running < J && i < jobs.length) {
      const job = jobs[i++]; running++;
      const p = spawn(process.execPath, [path.join(__dirname, 'crystal-balance.js'), '--job', job]);
      let buf = '';
      p.stdout.on('data', (x) => (buf += x));
      p.stderr.on('data', (x) => process.stderr.write(x));
      p.on('close', () => { running--; out.push(JSON.parse(buf.trim().split('\n').pop())); next(); });
    }
  };
  const report = () => {
    const groups = {};
    for (const r of out) (groups[`${D.crystal.difficulty[r.d - 1].name} · ${r.set}`] = groups[`${D.crystal.difficulty[r.d - 1].name} · ${r.set}`] || []).push(r);
    for (const [k, rs] of Object.entries(groups)) {
      rs.sort((a, b) => a.hero.localeCompare(b.hero) || a.seed - b.seed);
      console.log(`${k}: 최소 여유 ×${Math.min(...rs.map((r) => r.best))}`);
      for (const r of rs) console.log(`   ${r.hero}/${r.seed}: ×${r.best}${r.lossAt ? ` (×${r.lossAt.s}에서 웨이브 ${r.lossAt.wave}에 짐)` : ''} | 1배: ${fmt(r.at1)}`);
    }
  };
  next();
} else {
  for (let d = 1; d <= 3; d++) {
    console.log(`${D.crystal.difficulty[d - 1].name} (웨이브 ${D.crystal.difficulty[d - 1].waves}, 체력 ×${D.crystal.difficulty[d - 1].hp}, 골드 ×${RG.crystal.goldMult(d)})`);
    for (const set of ['basic3', 'mix1', 'mix2']) for (const hero of ['kara', 'sera', 'sio']) console.log(`   ${set} + ${hero}: ${fmt(run(d, set, hero, 1))}`);
  }
}
