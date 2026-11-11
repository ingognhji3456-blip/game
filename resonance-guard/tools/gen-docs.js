'use strict';

/*
 * 설계서의 AUTO 표를 게임 데이터에서 다시 만듭니다.
 *   node tools/gen-docs.js          # 설계서 갱신
 *   node tools/gen-docs.js --check  # 다르면 실패 (테스트용)
 */
const fs = require('fs');
const path = require('path');
const { loadGame } = require('../tests/load');

const ROOT = path.resolve(__dirname, '..');
const { RG } = loadGame();
const D = RG.data;
const r2 = (v) => (typeof v === 'number' ? String(Math.round(v * 100) / 100) : v);
const pct = (v) => `${Math.round(v * 100)}%`;

function specSpecial(s) {
  const out = [];
  const oh = s.onHit || {};
  if (s.multishot) out.push(`${s.multishot}발`);
  if (s.crit) out.push(`치명 ${pct(s.crit.chance)}`);
  if (s.splash) out.push(`폭발 ${s.splash}칸`);
  if (s.shells) out.push(`포탄 ${s.shells}`);
  if (s.zone) out.push(`장판 ${s.zone.dps}/초 ${s.zone.dur}초${s.zone.slowPct ? ` 감속 ${pct(s.zone.slowPct)}` : ''}${s.zone.meltArmor ? ` 갑옷 −${pct(s.zone.meltArmor)}p` : ''}`);
  if (s.zones) out.push(`장판 ${s.zones}개`);
  if (s.chain) out.push(`연쇄 ${s.chain.count}`);
  if (s.pierce) out.push('관통');
  if (s.beam) out.push(`최대 ×${s.beam.maxMult}${s.beam.beams > 1 ? ` ${s.beam.beams}갈래` : ''}`);
  if (s.snare) out.push(`덫 ${s.snare.maxTraps} 속박 ${s.snare.root}초 피해 ${s.snare.damage}`);
  if (s.cyclone) out.push(`회오리 ${s.cyclone.every}초`);
  if (s.cone) out.push(s.cone >= 360 ? '사방 불길' : `부채꼴 ${s.cone}°`);
  if (s.rain) out.push(`고드름 ${s.rain.count}개 (${s.rain.delay}초 뒤)`);
  if (s.strike) out.push(`번개 ${s.strike.count}명${s.strike.splash ? ` 주변 ${s.strike.splash}칸 ${pct(s.strike.splashPct)}` : ''}`);
  if (s.spikes) out.push(`가시밭 ${s.spikes.max}곳 ${s.spikes.dps}/초 ${s.spikes.dur}초 감속 ${pct(s.spikes.slowPct)}${s.spikes.meltArmor ? ` 갑옷 −${pct(s.spikes.meltArmor)}p` : ''}`);
  if (s.sweep) out.push(`빛줄기 ${s.sweep.beams}갈래 ${s.sweep.dps}/초${s.sweep.mark ? ` 표식 +${pct(s.sweep.mark.pct)}` : ''}`);
  if (s.detect) out.push(`탐지 ${s.detect}칸`);
  if (s.fear) out.push(`공포 ${s.fear.dur}초`);
  if (s.shieldMult) out.push(`보호막 ×${s.shieldMult}`);
  if (oh.burn) out.push(`화상 ${oh.burn.dps}/초`);
  if (oh.slow) out.push(`감속 ${pct(oh.slow.pct)}`);
  if (oh.freezeEvery) out.push(`${oh.freezeEvery.n}번째 빙결`);
  if (oh.curse) out.push(`저주 ${pct(oh.curse.pct)}`);
  if (oh.shred) out.push(`파쇄 ${pct(oh.shred.pct)}p`);
  if (oh.stun) out.push(`기절 ${oh.stun.dur}초`);
  if (oh.knockback) out.push(`밀기 ${oh.knockback}`);
  if (oh.flyingMult) out.push(`비행 ×${oh.flyingMult}`);
  if (oh.blind) out.push(`실명 ${oh.blind}초`);
  if (oh.purify) out.push('정화');
  if (oh.halt) out.push(`치유 정지 ${oh.halt}초`);
  if (oh.veil) out.push(`장막 +${pct(oh.veil.pct)}`);
  if (oh.execute) out.push(`처형 ${pct(oh.execute)}`);
  if (oh.bonusVsSlowed) out.push(`감속 대상 +${pct(oh.bonusVsSlowed)}`);
  if (oh.spreadCurse) out.push('저주 확산');
  if (s.aura) {
    const a = s.aura;
    if (a.damagePct) out.push(`이웃 피해 +${pct(a.damagePct)}`);
    if (a.speedPct) out.push(`이웃 속도 +${pct(a.speedPct)}`);
    if (a.rangePct) out.push(`이웃 사거리 +${pct(a.rangePct)}`);
    if (a.critChance) out.push(`이웃 치명 +${pct(a.critChance)}`);
    if (a.burnOnHit) out.push(`이웃 화상 ${pct(a.burnOnHit.pct)}`);
    if (a.zapEvery) out.push(`이웃 번개 ${a.zapEvery.damage}`);
  }
  if (s.detect) out.push(`탐지 ${s.detect}칸`);
  if (s.heal) out.push(`회복 ${s.heal.hps}/초`);
  if (s.respawnMul) out.push(`재소환 ×${s.respawnMul}`);
  if (s.discharge) out.push(`방전 ${s.discharge.damage}`);
  if (s.income) out.push(`수입 ${s.income}`);
  if (s.incomeGrowth) out.push(`+${s.incomeGrowth}/웨이브`);
  if (s.bountyAura) out.push(`현상금 +${pct(s.bountyAura.pct)}`);
  if (s.soldiers) out.push(`병사 ${s.soldiers.count} 체력 ${s.soldiers.hp} 피해 ${s.soldiers.damage} 붙잡기 ${s.soldiers.block}`);
  return out.join(', ') || '—';
}

function towerTable(id) {
  const t = D.towers[id];
  const rows = ['| 단계 | 이름 | 비용 | 피해 | 간격(초) | 사거리 | 특수 |', '|---|---|---|---|---|---|---|'];
  const lv = [[1, t.levels[0], t.name], [2, t.levels[1], t.name], [3, t.levels[2], t.name], ['4A', t.branches.A, t.branches.A.name], ['4B', t.branches.B, t.branches.B.name]];
  for (const [l, s, name] of lv) rows.push(`| ${l} | ${name} | ${s.cost} | ${s.damage != null ? r2(s.damage) : '—'} | ${s.interval ? r2(s.interval) : '—'} | ${s.range ? r2(s.range) : s.rallyRange ? `집결 ${s.rallyRange}` : '—'} | ${specSpecial(s)} |`);
  return rows.join('\n');
}

function enemyTable(id) {
  const e = D.enemies[id];
  const traits = Object.keys(e.traits).filter((k) => D.traits[k]).map((k) => D.traits[k].name).join(', ') || '—';
  const aff = Object.entries(e.affinity).map(([el, a]) => `${D.elements[el].name} ${D.affinities[a].name}`).join(', ') || '—';
  return ['| 체력 | 속도 | 갑옷 | 현상금 | 불꽃 | 크기 | 특성 | 친화 |', '|---|---|---|---|---|---|---|---|',
    `| ${e.hp} | ${e.speed} | ${pct(e.armor)} | ${e.bounty} | ${e.boss ? '즉시 패배' : e.lives} | ${e.size} | ${traits} | ${aff} |`].join('\n');
}

function heroesTable() {
  const rows = ['| 영웅 | 체력 | 공격 | 간격 | 사거리 | 붙잡기 | 이동 | 갑옷 | 기술 재사용 |', '|---|---|---|---|---|---|---|---|---|'];
  for (const id of D.heroOrder) {
    const h = D.heroes[id];
    rows.push(`| ${h.name} | ${h.hp} | ${h.damage} | ${h.interval} | ${h.melee ? '근접' : h.range} | ${h.block} | ${h.speed} | ${pct(h.armor)} | ${h.skill.cooldown}초 |`);
  }
  rows.push('', `레벨 경험치(누적): ${D.heroXp.join(' · ')}`);
  return rows.join('\n');
}

function mapsSummary() {
  const rows = ['| 맵 | 이름 | 종류 | 웨이브 | 시작 골드 | 적 체력 | 공명 과제 | 도전 |', '|---|---|---|---|---|---|---|---|'];
  for (const m of D.maps) rows.push(`| ${m.id} | ${m.name} | ${({ fixed: '고정', maze: '길 만들기', mixed: '혼합' })[m.type]} | ${m.waves.length} | ${m.startGold} | ${m.hpMult ? `×${m.hpMult}` : '×1'} | ${m.task ? m.task.text : '—'} | ${m.challenge ? m.challenge.text : '—'} |`);
  return rows.join('\n');
}

function fill(file, fn) {
  const p = path.join(ROOT, file);
  const src = fs.readFileSync(p, 'utf8');
  const out = src.replace(/<!-- AUTO:([^ ]+) -->[\s\S]*?<!-- \/AUTO -->/g, (m, key) => {
    let body = null;
    try { body = fn(key); } catch (e) { body = `(생성 실패: ${e.message})`; }
    return body == null ? m : `<!-- AUTO:${key} -->\n${body}\n<!-- /AUTO -->`;
  });
  return { p, src, out };
}

const jobs = [
  fill('docs/design/towers.md', (k) => (k.startsWith('tower:') && D.towers[k.slice(6)] ? towerTable(k.slice(6)) : null)),
  fill('docs/design/enemies.md', (k) => (k.startsWith('enemy:') && D.enemies[k.slice(6)] ? enemyTable(k.slice(6)) : null)),
  fill('docs/design/heroes.md', (k) => (k === 'heroes' ? heroesTable() : null)),
  fill('docs/design/maps.md', (k) => (k === 'maps-summary' ? mapsSummary() : null)),
];

if (process.argv.includes('--check')) {
  const stale = jobs.filter((j) => j.src !== j.out).map((j) => path.relative(ROOT, j.p));
  if (stale.length) { console.log(`최신이 아닌 설계서: ${stale.join(', ')} → node tools/gen-docs.js`); process.exitCode = 1; } else console.log('설계서 AUTO 표 최신');
} else {
  for (const j of jobs) if (j.src !== j.out) fs.writeFileSync(j.p, j.out);
  console.log('설계서 AUTO 표를 갱신했습니다');
}
module.exports = { jobs };
