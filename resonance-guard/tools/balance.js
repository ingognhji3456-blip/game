'use strict';

/*
 * 밸런스 보고서 — 봇으로 맵마다 여러 판을 돌려 결과를 표로 만듭니다.
 *   node tools/balance.js                 # 전체 맵, 무작위·그리디
 *   node tools/balance.js --maps 1-1,1-2  # 일부
 *   node tools/balance.js --search        # 탐색 봇까지 (느림)
 *   node tools/balance.js --soak 2000     # 오류 찾기용 대량 실행
 *   node tools/balance.js --useful --json a.json [--shard 0/4] · --useful-merge a.json,…  # 탑 쓰임 검증 → docs/reports/towers.md
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
  const off = +arg('offset', 0); // 여러 프로세스로 나눠 돌릴 때 서로 다른 판이 되게
  let errors = 0;
  const t0 = Date.now();
  for (let i = off; i < off + n; i++) {
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
    if ((i + 1 - off) % 250 === 0) console.log(`${i + 1 - off}/${n} (${Math.round((Date.now() - t0) / 1000)}초, 오류 ${errors})`);
  }
  console.log(`장기 실행 ${n}판 완료, 오류 ${errors}개`);
  process.exitCode = errors ? 1 : 0;
  return;
}

if (has('useful') || has('useful-merge')) {
  /*
   * 쓸모없는 탑 없음 (QUALITY §6): 탑마다 그 탑을 쓰는 계획(공격 탑이면 탑 피해의 10% 이상)으로 ★3을 내는 맵이 3개 이상인가.
   * 탐색 봇의 "최적 해법" 통계는 초당 피해 위주라 감속·밀치기·지원 탑을 낮게 봄 → 그 탑을 꼭 쓰게 한 탐색으로 확인.
   *   node tools/balance.js --useful [--shard 0/4] [--towers a,b] --json out.json
   *   node tools/balance.js --useful-merge a.json,b.json,...   → docs/reports/towers.md
   */
  if (has('useful-merge')) {
    const rows = [];
    for (const f of arg('useful-merge').split(',')) rows.push(...JSON.parse(fs.readFileSync(f, 'utf8')));
    rows.sort((a, b) => D.towerOrder.indexOf(a.type) - D.towerOrder.indexOf(b.type));
    const okN = rows.filter((r) => r.wins >= 3).length;
    const lines = ['# 탑 쓰임 검증 (탐색 봇)', '', `생성: ${new Date().toISOString().slice(0, 16)} · 탑마다 그 탑을 쓰는 계획으로 ★3(불꽃 11 이상)을 내고, 그 계획에서 그 탑을 빼면(남는 골드는 봇이 다른 탑에 씀) 결과가 나빠지는 맵을 셈 — 둘 다 만점이면 적 체력을 ×1.15·×1.3으로 올려 다시 겨룸. 맵은 그 탑을 쓸 수 있는 맵에서 고르게 최대 6개. 피해 몫은 참고(감속·밀치기·지원 탑은 작음)`, '',
      `기준(3맵 이상) 충족: **${okN}/${rows.length}**`, '', '| 탑 | 등급 | 역할 | ★3 맵 | 결과 (맵: 불꽃 · 개수 · 피해 몫) |', '|---|---|---|---|---|'];
    for (const r of rows) {
      const td = D.towers[r.type];
      const fmt = (v) => (v >= 0 ? v : `패${-v}`);
      const wo = (t) => (t.without == null ? '' : ` → 빼면 ${fmt(t.without)}${t.stress ? ` (체력 ×${t.stress.k}: ${fmt(t.stress.with)} vs 빼면 ${fmt(t.stress.without)})` : ''}`);
      lines.push(`| ${td.name} | ${RG.gacha.rarityOf(r.type)} | ${td.role} | ${r.wins >= 3 ? '✅' : '⚠️'} ${r.wins} | ${r.tries.map((t) => `${t.map}: ${t.ok ? '✓' : '✗'} ${t.result === 'win' ? t.lives : '패' + t.waves} · ${t.n}개${t.attack ? ` · ${Math.round(t.share * 100)}%` : ''}${wo(t)}`).join(' / ')} |`);
    }
    const file = path.resolve(ROOT, arg('out', path.join('docs', 'reports', 'towers.md')));
    fs.writeFileSync(file, `${lines.join('\n')}\n`);
    console.log(`→ ${path.relative(ROOT, file)} (${okN}/${rows.length})`);
    process.exit(0);
  }
  const [si, sn] = (arg('shard', '0/1')).split('/').map(Number);
  const list = (arg('towers', '') ? arg('towers').split(',') : D.towerOrder).filter((t, i) => i % sn === si);
  const out = [];
  for (const type of list) {
    const avail = D.maps.filter((m) => RG.progress.towersFor(m.id).includes(type)).map((m) => m.id);
    // 고르게 최대 6맵: 처음·끝을 포함해 간격을 두고
    const k = Math.min(6, avail.length);
    const pick = [...new Set(Array.from({ length: k }, (_, i) => avail[Math.round((i * (avail.length - 1)) / Math.max(1, k - 1))]))];
    const tier = RG.gacha.TIER[RG.gacha.rarityOf(type)];
    const min = 1; // 한 개라도 제대로 쓰이면 됨 (쓸모는 빼 보기로 판단)
    const row = { type, wins: 0, tries: [] };
    const t0 = Date.now();
    for (const mapId of pick) {
      if (row.wins >= 3) break;
      const o = optsFor(mapId, 1);
      const s = env.searchBest(o, { objective: `use:${type}:${min}`, gens: +arg('gens', 8), pop: +arg('pop', 10), maxGens: +arg('maxgens', 14) }, +arg('tries', 2));
      const r = s.best.r;
      const u = env.useStats(r, `use:${type}:${min}`);
      // 빼 보기: 같은 계획에서 그 탑을 지은 것·강화를 빼고(그 탑은 못 짓게) 남는 골드는 그리디가 다른 탑에 씀 → 결과가 나빠져야 쓸모 있음
      let without = null;
      let stress = null;
      if (r.result === 'win' && u.ok) {
        const remap = new Map();
        let bi = 0; let ni = 0;
        for (const a of s.best.plan) if (a.type === 'build') { if (a.tower !== type) remap.set(bi, ni++); bi++; }
        const abl = [];
        for (const a of s.best.plan) {
          if (a.type === 'build') { if (a.tower !== type) abl.push(a); } else if (remap.has(a.ref)) abl.push(Object.assign({}, a, { ref: remap.get(a.ref) }));
        }
        const o2 = Object.assign({}, o, { towers: (o.towers || D.towerOrder).filter((t) => t !== type) });
        without = env.run(o2, 'plan', { plan: abl });
        // 둘 다 불꽃 12로 이기면 차이가 안 보임(천장) → 적 체력 ×1.3으로 한 번 더 겨룸
        if (without.result === 'win' && without.lives >= r.lives) {
          // 차이가 보일 때까지 적 체력을 조금씩 올림 (×1.15 → ×1.3) — 둘 다 같은 웨이브에서 지면 다음 단계는 의미 없음
          for (const k of [1.15, 1.3]) {
            const hard = (x) => Object.assign({}, x, { hpMult: (x.hpMult || 1) * k });
            const a = env.run(hard(o), 'plan', { plan: s.best.plan });
            const b = env.run(hard(o2), 'plan', { plan: abl });
            const fa = env.fitness(a, 'stars'); const fb = env.fitness(b, 'stars');
            stress = { k, with: a.result === 'win' ? a.lives : -a.waves, without: b.result === 'win' ? b.lives : -b.waves, helps: fb < fa - 150 };
            if (Math.abs(fa - fb) > 150 || (a.result !== 'win' && b.result !== 'win')) break;
          }
        }
      }
      const fit = (x) => env.fitness(x, 'stars');
      const helps = !!without && (fit(without) < fit(r) - 150 || !!(stress && stress.helps));
      const ok = r.result === 'win' && r.lives >= D.rules.starLives[1] && u.ok && helps;
      if (ok) row.wins++;
      row.tries.push({ map: mapId, ok, result: r.result, lives: r.lives, waves: r.waves, n: u.n, share: u.share, attack: u.attack, without: without ? (without.result === 'win' ? without.lives : -without.waves) : null, stress });
    }
    out.push(row);
    console.log(`${type}: ★3 ${row.wins}맵 — ${row.tries.map((t) => `${t.map}${t.ok ? '✓' : '✗'}`).join(' ')} (${Math.round((Date.now() - t0) / 1000)}초)`);
    if (arg('json')) fs.writeFileSync(path.resolve(arg('json')), JSON.stringify(out));
  }
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
    } else {
      // 도전도 일반 판에서 이긴 계획을 출발점으로 (불꽃 제한 도전은 새지 않은 일반 승리 계획이 그대로 통함 — 탐색이 처음부터 못 찾는 경우가 있었음)
      const normal = Object.assign({}, o, { mode: 'normal' });
      const win = env.searchBest(normal, { gens: +arg('gens', 12), pop: +arg('pop', 10), maxGens: +arg('maxgens', 20) });
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
