'use strict';

/*
 * 밸런스 보고서 — 봇으로 맵마다 여러 판을 돌려 결과를 표로 만듭니다.
 *   node tools/balance.js                 # 전체 맵, 무작위·그리디
 *   node tools/balance.js --maps 1-1,1-2  # 일부
 *   node tools/balance.js --search        # 탐색 봇까지 (느림)
 *   node tools/balance.js --soak 2000     # 오류 찾기용 대량 실행
 * 결과: docs/reports/balance.md
 */
const fs = require('fs');
const path = require('path');
const { makeEnv, loadGame } = require('../tests/bots');

const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const has = (k) => args.includes(`--${k}`);

const { RG } = loadGame();
const env = makeEnv(RG);
const D = RG.data;
const maps = (arg('maps', '') ? arg('maps').split(',') : D.maps.map((m) => m.id));
const runsRandom = +arg('random', 8);
const runsGreedy = +arg('greedy', 3);
const ROOT = path.resolve(__dirname, '..');

function optsFor(mapId, seed, hero) {
  const heroes = RG.progress.heroesFor(mapId);
  return { mapId, seed, heroId: hero === undefined ? heroes[heroes.length - 1] : hero, towers: RG.progress.towersFor(mapId), branches: RG.progress.mapIndex(mapId) > RG.progress.mapIndex('1-6') };
}

if (has('soak')) {
  const n = +arg('soak', 1000);
  let errors = 0;
  const t0 = Date.now();
  for (let i = 0; i < n; i++) {
    const mapId = maps[i % maps.length];
    const bot = i % 3 === 0 ? 'greedy' : 'random';
    const heroes = RG.progress.heroesFor(mapId);
    try {
      const r = env.run(optsFor(mapId, 1000 + i, heroes[i % heroes.length]), bot, { invariants: true });
      if (r.result === 'timeout') { errors += 1; console.log(`시간 초과: ${mapId} #${i}`); }
    } catch (e) {
      errors += 1;
      console.log(`오류: ${mapId} ${bot} #${i}: ${e.message}`);
    }
    if ((i + 1) % 100 === 0) console.log(`${i + 1}/${n} (${Math.round((Date.now() - t0) / 1000)}초, 오류 ${errors})`);
  }
  console.log(`장기 실행 ${n}판 완료, 오류 ${errors}개`);
  process.exitCode = errors ? 1 : 0;
  return;
}

const rows = [];
const towerDamage = {};
for (const mapId of maps) {
  const res = { mapId, random: [], greedy: [], noHero: null, search: null };
  for (let i = 0; i < runsRandom; i++) res.random.push(env.run(optsFor(mapId, 100 + i), 'random'));
  for (let i = 0; i < runsGreedy; i++) res.greedy.push(env.run(optsFor(mapId, 200 + i), 'greedy'));
  res.noHero = env.run(optsFor(mapId, 300, null), 'greedy');
  for (const r of res.greedy) for (const [k, v] of Object.entries(r.byType)) towerDamage[k] = (towerDamage[k] || 0) + v;
  if (has('search')) {
    const t0 = Date.now();
    const s = env.searchPlan(optsFor(mapId, 1), { gens: +arg('gens', 8), pop: +arg('pop', 10) });
    res.search = s.best.r;
    res.searchMs = Date.now() - t0;
  }
  rows.push(res);
  const rw = res.random.filter((r) => r.result === 'win').length;
  const g = res.greedy;
  console.log(`${mapId}: 무작위 ${rw}/${runsRandom} 승 · 그리디 ${g.map((r) => (r.result === 'win' ? `승${r.lives}` : `패${r.waves}`)).join(' ')} · 영웅 없음 ${res.noHero.result === 'win' ? `승${res.noHero.lives}` : `패${res.noHero.waves}`}${res.search ? ` · 탐색 ${res.search.result === 'win' ? `승${res.search.lives}` : `패${res.search.waves}`} 과제 ${res.search.task} (${Math.round(res.searchMs / 1000)}초)` : ''}`);
}

// 보고서
const lines = ['# 밸런스 보고서', '', `생성: ${new Date().toISOString().slice(0, 16)} · 무작위 봇 ${runsRandom}판, 그리디 봇 ${runsGreedy}판 (영웅: 그 맵에서 가장 최근에 합류한 영웅)`, '',
  '| 맵 | 무작위 승률 | 그리디 (남은 불꽃) | 그리디·영웅 없음 | 탐색 봇 | 판 길이(그리디) |', '|---|---|---|---|---|---|'];
for (const r of rows) {
  const rw = r.random.filter((x) => x.result === 'win').length;
  const g = r.greedy.map((x) => (x.result === 'win' ? `승 ${x.lives}` : `패 (웨이브 ${x.waves})`)).join(', ');
  const nh = r.noHero.result === 'win' ? `승 ${r.noHero.lives}` : `패 (웨이브 ${r.noHero.waves})`;
  const s = r.search ? `${r.search.result === 'win' ? `승 ${r.search.lives}` : `패 (${r.search.waves})`}${r.search.task ? ' · 과제 ✓' : ''}` : '—';
  const len = Math.round(r.greedy.reduce((a, x) => a + x.time, 0) / r.greedy.length);
  lines.push(`| ${r.mapId} | ${Math.round((rw / runsRandom) * 100)}% | ${g} | ${nh} | ${s} | ${Math.floor(len / 60)}분 ${len % 60}초 |`);
}
const total = Object.values(towerDamage).reduce((a, b) => a + b, 0) || 1;
lines.push('', '## 그리디 봇 탑별 피해 비중', '', '| 탑 | 비중 |', '|---|---|');
for (const [k, v] of Object.entries(towerDamage).sort((a, b) => b[1] - a[1])) lines.push(`| ${D.towers[k] ? D.towers[k].name : k} | ${Math.round((v / total) * 100)}% |`);
fs.mkdirSync(path.join(ROOT, 'docs', 'reports'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'docs', 'reports', 'balance.md'), `${lines.join('\n')}\n`);
console.log('→ docs/reports/balance.md');
