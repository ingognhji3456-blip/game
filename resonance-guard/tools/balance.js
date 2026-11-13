'use strict';

/*
 * 밸런스 보고서 — 봇으로 맵마다 여러 판을 돌려 결과를 표로 만듭니다.
 *   node tools/balance.js                 # 전체 맵, 무작위·그리디
 *   node tools/balance.js --maps 1-1,1-2  # 일부
 *   node tools/balance.js --search        # 탐색 봇까지 (느림)
 *   node tools/balance.js --soak 2000     # 오류 찾기용 대량 실행
 *   node tools/balance.js --expedition 6 [--bot search]  # 원정을 처음부터 끝까지 (docs/reports/expedition.md)
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
    // 맵·모드·봇을 섞음: 5판에 1판은 도전, 7판에 1판은 무한 모드
    const endless = i % 7 === 6;
    const mapId = endless ? D.endless[i % D.endless.length].id : maps[i % maps.length];
    const mode = endless ? 'endless' : i % 5 === 4 ? 'challenge' : 'normal';
    const bot = i % 3 === 0 ? 'greedy' : 'random';
    const heroes = RG.progress.heroesFor(mapId);
    try {
      const o = Object.assign(optsFor(mapId, 1000 + i, heroes[i % heroes.length]), { mode });
      const r = env.run(o, bot, { invariants: true });
      // 무한 모드는 끝이 없으므로 봇 상한(30분)에 닿는 것은 정상
      if (r.result === 'timeout' && mode !== 'endless') { errors += 1; console.log(`시간 초과: ${mapId} ${mode} #${i}`); }
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

if (has('expedition')) {
  // 원정을 처음부터 끝까지 그리디 봇으로 (노드·보상·상점·사건은 간단한 규칙으로 고름)
  const EX = RG.expedition;
  const XD = D.expedition;
  const n = +arg('expedition', 6);
  const owned = D.towerOrder.slice(0, +arg('owned', 18));
  const heroId = arg('hero', 'kara');
  const useSearch = arg('bot', 'greedy') === 'search';
  const kindOrder = (run, k) => ({ rest: run.lives < 9 ? 0 : 5, shop: run.silver >= XD.shop.relic ? 1 : 6, battle: 2, event: 3, elite: run.lives >= 12 ? 1.5 : 4 }[k]);
  const out = [];
  const t0 = Date.now();
  for (let i = 0; i < n; i++) {
    const run = EX.newRun(5000 + i, heroId, owned);
    EX.pickDeck(run, run.offer.slice(0, Math.min(XD.startDeck.pick, run.offer.length)));
    const log = [];
    let guard = 0;
    while (run.phase !== 'done' && guard++ < 300) {
      if (run.phase === 'map') {
        let best = 0;
        run.nodes.forEach((x, j) => { if (kindOrder(run, x.kind) < kindOrder(run, run.nodes[best].kind)) best = j; });
        EX.choose(run, best);
      } else if (run.phase === 'battle') {
        const set = EX.battleSetup(run);
        const o = Object.assign({ seed: run.seed + run.battles, heroId, towers: run.deck, mode: 'expedition', branches: true }, set);
        let r = env.run(o, 'greedy');
        // --bot search: 그리디가 불꽃을 잃으면 탐색 봇(사람에 가까운 계획)으로 다시 — 더 나은 쪽
        if (useSearch && (r.result !== 'win' || r.lives < run.lives)) {
          const sr = env.searchBest(o, { gens: +arg('gens', 6), pop: +arg('pop', 8), maxGens: +arg('maxgens', 10) }).best.r;
          if (sr.result === 'win' && (r.result !== 'win' || sr.lives > r.lives)) r = sr;
        }
        log.push(`${run.act}-${run.floor}${run.node.kind === 'boss' ? '보스' : run.node.kind === 'elite' ? '정예' : ''}(${set.mapId}) ${r.result === 'win' ? `${run.lives}→${r.lives}` : '패'}`);
        EX.applyBattle(run, { result: r.result === 'win' ? 'win' : 'lose', lives: r.result === 'win' ? r.lives : 0 });
      } else if (run.phase === 'reward') EX.takeReward(run, run.offer.length && (run.offerKind === 'relic' || run.deck.length < XD.maxDeck) ? run.offer[0] : null);
      else if (run.phase === 'event') {
        const ev = XD.events.find((x) => x.id === run.node.event);
        if (!EX.eventChoose(run, 0).ok) EX.eventChoose(run, ev.options.findIndex((o) => !o.cost));
      } else if (run.phase === 'shop') {
        const relic = run.shopStock.find((x) => x.kind === 'relic');
        if (relic) EX.shopBuy(run, relic.id);
        EX.shopBuy(run, 'upgrade', run.deck.find((t) => !run.up.includes(t)));
        if (run.lives < 10) EX.shopBuy(run, 'heal');
        EX.shopLeave(run);
      } else if (run.phase === 'rest') {
        const t = run.deck.find((x) => !run.up.includes(x));
        EX.rest(run, run.lives < 10 || !t ? 'heal' : { upgrade: t });
      }
    }
    if (run.phase !== 'done') throw new Error(`원정 ${i}: 끝나지 않음 (${run.phase})`);
    out.push({ i, run, log });
    console.log(`원정 ${i + 1}: ${run.result === 'win' ? '승리' : `${run.act}막 ${run.floor}층에서 끝`} · 판 ${run.battles} · 덱 ${run.deck.length} · 유물 ${run.relics.length} · 공명석 ${run.rewards.crystals} (${Math.round((Date.now() - t0) / 1000)}초)`);
  }
  const file = path.resolve(ROOT, arg('out', path.join('docs', 'reports', 'expedition.md')));
  const wins = out.filter((x) => x.run.result === 'win').length;
  const avgDepth = out.reduce((a, x) => a + EX.depth(x.run), 0) / out.length;
  const lines = ['# 원정 봇 실행', '', `생성: ${new Date().toISOString().slice(0, 16)} · ${useSearch ? '탐색 봇(그리디가 불꽃을 잃는 판만 탐색)' : '그리디 봇'}, 영웅 ${D.heroes[heroId].name}, 가진 탑 ${owned.length}종 · 노드는 쉼터(불꽃 9 미만)·상점(은화 충분)·전투 순, 보상은 첫째 것`, '',
    `원정 ${out.length}번: 승리 ${wins} · 평균 도달 ${avgDepth.toFixed(1)}층(전체 ${XD.acts * (XD.floors + 1)}층) · 막힘 0`, '', '| # | 결과 | 판 | 덱 | 유물 | 공명석 | 판 기록 (막-층(맵) 불꽃) |', '|---|---|---|---|---|---|---|'];
  for (const x of out) lines.push(`| ${x.i + 1} | ${x.run.result === 'win' ? '승리' : `${x.run.act}막 ${x.run.floor}층`} | ${x.run.battles} | ${x.run.deck.length} | ${x.run.relics.length} | ${x.run.rewards.crystals} | ${x.log.join(' · ')} |`);
  fs.writeFileSync(file, `${lines.join('\n')}\n`);
  console.log(`→ ${path.relative(ROOT, file)}`);
  process.exit(0);
}

if (has('challenge') || has('tasks')) {
  const kind = has('challenge') ? 'challenge' : 'task';
  const outRows = [];
  for (const mapId of maps) {
    const def = D.maps.find((m) => m.id === mapId);
    const o = optsFor(mapId, 1);
    if (kind === 'challenge') {
      o.mode = 'challenge';
      const ch = def.challenge;
      if (ch.type === 'noHero' || ch.type === 'noBlock') o.heroId = ch.type === 'noHero' ? null : 'sio';
      // 성소를 못 쓰는 도전 + 은신 적 → 탐지 영웅(세라)을 데려감 (사람도 그렇게 풀 수밖에 없음)
      const noSanct = (ch.type === 'banTowers' && ch.value.includes('sanctuary')) || ch.type === 'noSupport' || (ch.type === 'banElements' && ch.value.includes('light')) || (ch.type === 'allowElements' && !ch.value.includes('light'));
      const stealth = RG.grid.parseWaves(def.waves).some((w) => w.groups.some((gr) => D.enemies[gr.e].traits.stealth));
      const detectHero = RG.progress.heroesFor(mapId).find((h) => D.heroes[h].passive.detect);
      if (noSanct && stealth && detectHero) o.heroId = detectHero;
    }
    const t0 = Date.now();
    let seeds = [];
    if (kind === 'task') {
      // 먼저 이기는 계획을 찾고(별 목표), 그 위에 과제 묶음을 얹어 탐색
      const win = env.searchBest(o, { gens: +arg('gens', 12), pop: +arg('pop', 10), maxGens: +arg('maxgens', 20) });
      if (win.best.r.result === 'win') seeds = [win.best.plan];
    }
    const s = env.searchBest(o, { gens: +arg('gens', 12), pop: +arg('pop', 10), objective: kind === 'challenge' ? 'challenge' : 'task', maxGens: +arg('maxgens', 20), seeds });
    const r = s.best.r;
    const ok = kind === 'challenge' ? r.result === 'win' : r.result === 'win' && r.task;
    outRows.push({ mapId, text: kind === 'challenge' ? def.challenge.text : def.task.text, ok, r, ms: Date.now() - t0 });
    console.log(`${mapId} ${kind === 'challenge' ? '도전' : '과제'} "${kind === 'challenge' ? def.challenge.text : def.task.text}": ${ok ? '통과' : '실패'} (${r.result} 불꽃 ${r.lives} 웨이브 ${r.waves} 과제 ${r.task}) ${Math.round((Date.now() - t0) / 1000)}초`);
  }
  const file = path.resolve(ROOT, arg('out', path.join('docs', 'reports', kind === 'challenge' ? 'challenges.md' : 'tasks.md')));
  const lines = [`# ${kind === 'challenge' ? '도전 규칙' : '공명 과제'} 검증 (탐색 봇)`, '', `생성: ${new Date().toISOString().slice(0, 16)}`, '', '| 맵 | 내용 | 결과 | 세부 |', '|---|---|---|---|'];
  for (const x of outRows) lines.push(`| ${x.mapId} | ${x.text} | ${x.ok ? '✅ 통과' : '❌ 실패'} | ${x.r.result} · 불꽃 ${x.r.lives} · 웨이브 ${x.r.waves}/${x.r.total} |`);
  lines.push('', `통과 ${outRows.filter((x) => x.ok).length}/${outRows.length}`);
  fs.writeFileSync(file, `${lines.join('\n')}\n`);
  console.log(`→ ${path.relative(ROOT, file)}`);
  process.exit(0);
}

const rows = [];
const towerDamage = {};
const searchUse = {};      // 탑 → 탐색 봇 최적 해법에 등장한 맵 수
const resSeen = new Set(); // 발동한 공명 효과
let heroDmg = 0;
let allDmg = 0;
for (const mapId of maps) {
  const res = { mapId, random: [], greedy: [], noHero: null, search: null };
  for (let i = 0; i < runsRandom; i++) res.random.push(env.run(optsFor(mapId, 100 + i), 'random'));
  for (let i = 0; i < runsGreedy; i++) res.greedy.push(env.run(optsFor(mapId, 200 + i), 'greedy'));
  res.noHero = env.run(optsFor(mapId, 300, null), 'greedy');
  for (const r of res.greedy) {
    for (const [k, v] of Object.entries(r.byType)) towerDamage[k] = (towerDamage[k] || 0) + v;
    const hd = r.game.state.stats.heroDamage;
    heroDmg += hd; allDmg += hd + Object.values(r.byType).reduce((a, b) => a + b, 0);
    r.resonance.forEach((x) => resSeen.add(x));
  }
  if (has('search')) {
    const t0 = Date.now();
    const s = env.searchBest(optsFor(mapId, 1), { gens: +arg('gens', 10), pop: +arg('pop', 10), maxGens: +arg('maxgens', 16) });
    res.search = s.best.r;
    res.searchMs = Date.now() - t0;
    for (const k of new Set(res.search.towers.map((t) => t.split(':')[0]))) searchUse[k] = (searchUse[k] || 0) + 1;
    res.search.resonance.forEach((x) => resSeen.add(x));
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
lines.push('', `영웅 피해 비중(그리디 봇 전체): ${Math.round((heroDmg / (allDmg || 1)) * 100)}%`);
if (Object.keys(searchUse).length) {
  lines.push('', '## 탐색 봇 최적 해법에 쓰인 탑 (맵 수)', '', '| 탑 | 맵 수 |', '|---|---|');
  for (const k of D.towerOrder) lines.push(`| ${D.towers[k].name} | ${searchUse[k] || 0} |`);
}
const resAll = [...new Set(Object.values(D.resonance).map((x) => x.id))];
lines.push('', `## 공명 효과 발동 (${resAll.filter((x) => resSeen.has(x)).length}/${resAll.length})`, '', resAll.map((x) => `${resSeen.has(x) ? '✅' : '❌'} ${x}`).join(' · '));
const out = arg('out', path.join('docs', 'reports', 'balance.md'));
fs.mkdirSync(path.dirname(path.resolve(ROOT, out)), { recursive: true });
fs.writeFileSync(path.resolve(ROOT, out), `${lines.join('\n')}\n`);
console.log(`→ ${out}`);
