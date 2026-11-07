'use strict';

/*
 * 자동 전투 시뮬레이터 — 간단한 봇이 웨이브와 보스 10종을 직접 싸워 보며
 * 오류·무한 전투·밸런스(승률, 걸린 시간)를 확인합니다.
 *   node astra/tests/sim.js [--runs 3] [--diff normal] [--boss astra] [--skill 0.7]
 * --skill: 봇이 위험 지역을 알아채고 피하는 확률(0~1)
 */
const { loadGame } = require('./load');

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf('--' + name);
  return i >= 0 ? args[i + 1] : def;
};
const RUNS = Number(opt('runs', 3));
const DIFF = opt('diff', 'normal');
const ONLY = opt('boss', null);
const SKILL = Number(opt('skill', 0.75));
const MAX_TIME = 600;

function makeSave(AZ, chapterId, weapon) {
  const P = AZ.progress;
  const s = AZ.save.fresh(DIFF);
  s.level = Math.round(P.refLevel(chapterId));
  const wl = Math.min(5, 1 + Math.floor((chapterId - 1) * 0.5));
  for (const id of AZ.data.weaponOrder) s.weapons[id] = wl;
  s.weapon = weapon || 'blade';
  const S = AZ.data.skills;
  const per = Math.floor((s.level - 1 + chapterId) / 3);
  s.learned = [];
  for (const br of S.branches) s.learned.push(...br.nodes.slice(0, Math.min(6, Math.max(1, Math.round(per / 2)))));
  const actives = s.learned.filter((id) => S.nodes[id].type === 'active');
  s.equippedSkills = [actives[0] || null, actives[1] || null, actives[2] || null];
  const mods = Object.keys(AZ.data.modules).slice(0, Math.min(3, chapterId));
  s.modules = mods;
  s.equippedModules = [mods[0] || null, mods[1] || null, mods[2] || null];
  s.flags = { zeroSpared: true, liaTrusted: true };
  return s;
}

/** 봇 입력 */
function botInput(AZ, W, mem) {
  const U = AZ.util;
  const p = W.player;
  const inp = { mx: 0, my: 0, attack: false, heavy: false, dodge: false, skills: [false, false, false], ult: false, chain: false, cmds: [false, false, false], aim: null };
  const tgt = p.target || AZ.battle.nearestEnemy(W, p.x, p.y, 3000);
  // 위험 지역 확인
  let danger = null;
  for (const h of W.hazards) {
    if (h.done || h.active || h.dmg <= 0) continue;
    if (!AZ.battle.inShape(h, p.x, p.y, p.r + 6)) continue;
    if (!mem.noticed.has(h.id)) mem.noticed.set(h.id, Math.random() < SKILL);
    if (!mem.noticed.get(h.id)) continue;
    const left = h.warn - h.t;
    if (!danger || left < danger.left) danger = { h, left };
  }
  for (const b of W.bullets) {
    if (b.team !== 'enemy') continue;
    if (U.dist(b.x, b.y, p.x, p.y) < 90 && Math.random() < SKILL * 0.3) danger = danger || { h: { x: b.x, y: b.y, shape: 'circle' }, left: 0.05 };
  }
  if (danger) {
    const h = danger.h;
    let away;
    if (h.shape === 'line') away = h.ang + Math.PI / 2 * (U.angleDiff(h.ang, U.angleTo(h.x, h.y, p.x, p.y)) > 0 ? 1 : -1);
    else if (h.shape === 'outside') away = U.angleTo(p.x, p.y, h.x, h.y);
    else if (h.shape === 'all') {
      const s = h.safe && h.safe.slice().sort((a, b) => U.dist(a.x, a.y, p.x, p.y) - U.dist(b.x, b.y, p.x, p.y))[0];
      away = s ? U.angleTo(p.x, p.y, s.x, s.y) : p.facing;
    } else away = U.angleTo(h.x, h.y, p.x, p.y);
    inp.mx = Math.cos(away);
    inp.my = Math.sin(away);
    if (danger.left < 0.14 && (h.shape !== 'all' || !h.safe)) inp.dodge = true;
    return inp;
  }
  if (!tgt) {
    const pk = W.pickups[0];
    if (pk) { const a = U.angleTo(p.x, p.y, pk.x, pk.y); inp.mx = Math.cos(a); inp.my = Math.sin(a); }
    return inp;
  }
  const d = U.dist(p.x, p.y, tgt.x, tgt.y) - tgt.r;
  const ranged = p.stats.weapon.combo[0].proj;
  const want = ranged ? 300 : 70;
  let a = U.angleTo(p.x, p.y, tgt.x, tgt.y);
  // 약점(등 뒤)으로 돌아 들어가기
  if (tgt.kind === 'boss' && tgt.def.weak && tgt.def.weak.back && !ranged) {
    const back = tgt.facing + Math.PI;
    const bx = tgt.x + Math.cos(back) * (tgt.r + 50);
    const by = tgt.y + Math.sin(back) * (tgt.r + 50);
    if (U.dist(p.x, p.y, bx, by) > 40 && Math.random() < 0.5) a = U.angleTo(p.x, p.y, bx, by);
  }
  if (d > want) { inp.mx = Math.cos(a); inp.my = Math.sin(a); }
  if (d < want + 40 || ranged) {
    mem.t += 1;
    if (mem.t % 7 === 0) inp.heavy = Math.random() < 0.2;
    inp.attack = !inp.heavy;
  }
  for (let i = 0; i < 3; i++) if (p.cds[i] <= 0 && p.stats.skills[i] && Math.random() < 0.02) inp.skills[i] = true;
  if (p.focus >= 100) inp.ult = true;
  if ((W.boss && W.boss.broken) || p.chain >= 100) inp.chain = true;
  for (let i = 0; i < 3; i++) if (W.cmdCd[i] <= 0 && Math.random() < 0.01) inp.cmds[i] = true;
  return inp;
}

function runBattle(AZ, cfg) {
  const W = AZ.battle.create(cfg);
  const mem = { noticed: new Map(), t: 0 };
  const dt = 1 / 60;
  let t = 0;
  while (W.state !== 'victory' && W.state !== 'defeat' && t < MAX_TIME) {
    W.events.length = 0;
    AZ.battle.step(W, dt, botInput(AZ, W, mem));
    t += dt;
  }
  return { W, t };
}

function main() {
  const { AZ, errors } = loadGame();
  const P = AZ.progress;
  const weapons = ['blade', 'twin', 'great', 'spear', 'rail'];
  const rows = [];
  let anyErr = false;
  for (const ch of AZ.data.chapters) {
    if (ONLY && ch.boss !== ONLY) continue;
    let wins = 0;
    let time = 0;
    let zf = 0;
    let hpLeft = 0;
    let waveOk = 0;
    for (let r = 0; r < RUNS; r++) {
      const save = makeSave(AZ, ch.id, weapons[r % weapons.length]);
      const stats = P.computeStats(save);
      const party = P.partyFor(save, ch.id);
      if (r === 0) {
        const wv = runBattle(AZ, { chapterId: ch.id, mode: 'wave', difficulty: DIFF, stats, party });
        if (wv.W.state === 'victory') waveOk++;
      }
      const { W, t } = runBattle(AZ, { chapterId: ch.id, mode: 'boss', bossId: ch.boss, difficulty: DIFF, stats, party });
      if (W.state === 'victory') { wins++; time += W.stats.time; hpLeft += W.player.hp / W.player.maxHp; }
      if (process.env.SIM_DEBUG) console.log(ch.boss, W.state, W.stats.time.toFixed(1), JSON.stringify(W.stats.byKind), "atk", Math.round(stats.atk), "brk", W.stats.breaks, "ult", W.stats.ultUsed, "chains", W.stats.chains);
      zf += W.stats.zeroFrames;
      if (t >= MAX_TIME) errors.push(`${ch.boss}: 시간 초과 (보스 체력 ${Math.round(W.boss.hp)}/${W.boss.maxHp})`);
    }
    rows.push({
      ch: ch.id, boss: ch.boss, hp: P.bossHp(ch.id, AZ.data.bosses[ch.boss].hpMul), win: `${wins}/${RUNS}`,
      avgTime: wins ? (time / wins).toFixed(0) + 's' : '-', par: P.parTime(ch.id) + 's', zeroF: (zf / RUNS).toFixed(1),
      hpLeft: wins ? Math.round((hpLeft / wins) * 100) + '%' : '-', wave: waveOk ? 'ok' : 'FAIL',
    });
  }
  console.table(rows);
  if (errors.length) {
    anyErr = true;
    console.log('오류/경고:');
    for (const e of [...new Set(errors)].slice(0, 20)) console.log(' -', e);
  }
  process.exit(anyErr ? 1 : 0);
}

main();
