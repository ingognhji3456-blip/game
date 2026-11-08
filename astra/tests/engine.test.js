'use strict';

/*
 * 데이터 참조 검사와 전투 규칙 검사
 *   node astra/tests/engine.test.js
 */
const { loadGame } = require('./load');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    passed += 1;
  } catch (e) {
    failed += 1;
    console.log(`✗ ${name}\n   ${e.message}`);
  }
}
function ok(cond, msg) { if (!cond) throw new Error(msg || '조건 실패'); }
function eq(a, b, msg) { if (a !== b) throw new Error(`${msg || ''} 기대 ${JSON.stringify(b)}, 실제 ${JSON.stringify(a)}`); }

const { AZ, errors } = loadGame();
const D = AZ.data;
const P = AZ.progress;

function freshSave(level, chapter) {
  const s = AZ.save.fresh('normal');
  s.level = level || 1;
  return s;
}
function makeWorld(opts) {
  const o = opts || {};
  const s = freshSave(o.level || 10);
  if (o.weapon) { s.weapons[o.weapon] = 1; s.weapon = o.weapon; }
  if (o.learned) for (const id of o.learned) if (!s.learned.includes(id)) s.learned.push(id);
  if (o.skills) s.equippedSkills = o.skills;
  const stats = P.computeStats(s);
  const ch = o.chapterId || 1;
  const W = AZ.battle.create({ chapterId: ch, mode: o.mode || 'boss', bossId: o.bossId || D.chapters[ch - 1].boss, difficulty: o.diff || 'normal', stats, party: o.party || { lia: true, zero: false } });
  W.state = 'fight';
  return W;
}
const idle = () => ({ mx: 0, my: 0, attack: false, heavy: false, dodge: false, skills: [false, false, false], ult: false, chain: false, cmds: [false, false, false] });
function stepN(W, n, inpFn) {
  for (let i = 0; i < n; i++) { W.events.length = 0; AZ.battle.step(W, 1 / 60, inpFn ? inpFn(i) : idle()); }
}

/* ───────── 데이터 ───────── */
test('스크립트를 불러올 때 오류가 없다', () => eq(errors.length, 0, errors.join('\n')));

test('챕터 10개, 보스 10종, 순서가 맞는다', () => {
  eq(D.chapters.length, 10);
  eq(D.bossOrder.length, 10);
  D.chapters.forEach((c, i) => {
    eq(c.id, i + 1);
    ok(D.bosses[c.boss], `보스 없음: ${c.boss}`);
    eq(D.bosses[c.boss].chapter, c.id, c.boss);
    eq(D.bossOrder[i], c.boss);
    for (const wave of c.waves) for (const [type] of wave) ok(D.enemies[type], `적 없음: ${type}`);
    for (const m of c.reward.modules || []) ok(D.modules[m], `모듈 없음: ${m}`);
    if (c.reward.weapon) ok(D.weapons[c.reward.weapon], c.reward.weapon);
    ok(c.challenge && c.challenge.desc, '도전 과제');
  });
});

test('모든 보스에 AI 와 도감 설명이 있다', () => {
  for (const id of D.bossOrder) {
    ok(AZ.ai.BOSS_AI[id], `AI 없음: ${id}`);
    ok(D.story.bossLore[id], `도감 설명 없음: ${id}`);
    ok(D.assets['boss_' + id], `보스 카드 없음: ${id}`);
    ok(D.story.battle[id], `전투 대사 없음: ${id}`);
  }
  for (const id of Object.keys(D.enemies)) ok(AZ.ai.MINION_AI[D.enemies[id].ai], `일반 적 AI 없음: ${id}`);
});

test('스킬 트리: 모든 노드가 가지에 한 번씩, 액티브는 구현이 있다', () => {
  const seen = new Set();
  for (const br of D.skills.branches) {
    eq(br.nodes.length, D.skills.tierCost.length);
    for (const id of br.nodes) {
      ok(D.skills.nodes[id], id);
      ok(!seen.has(id), `중복 ${id}`);
      seen.add(id);
      if (D.skills.nodes[id].type === 'active') ok(AZ.player.SKILLS[id], `구현 없음 ${id}`);
    }
  }
  eq(seen.size, Object.keys(D.skills.nodes).length);
});

test('모듈 능력치 키가 계산식에 쓰인다', () => {
  const known = ['hpPct', 'atkPct', 'breakMul', 'perfectMul', 'iframe', 'zeroDur', 'lifesteal', 'cdMul', 'weakMul', 'focusMul', 'comboAmp', 'dmgReduce', 'afterimage', 'allyMul', 'allyHp', 'ultMul', 'startFocus'];
  for (const [id, m] of Object.entries(D.modules)) for (const k of Object.keys(m.stats)) ok(known.includes(k), `${id}.${k}`);
});

test('스토리: 형식과 참조가 계약을 따른다', () => {
  const S = D.story;
  const WHO = ['kai', 'lia', 'zero', 'astra', 'sera', 'protocol', 'narr', 'system', 'npc'];
  const FLAGS = ['survivorsFirst', 'zeroSpared', 'liaTrusted'];
  const BG = ['ruins', 'city', 'lab', 'highway', 'sky', 'archive', 'skyport', 'warfront', 'core', 'void', 'dawn', 'black'];
  const walk = (lines, where) => {
    for (const l of lines) {
      if (l.choice) {
        ok(FLAGS.includes(l.choice), `${where}: 선택 플래그 ${l.choice}`);
        for (const o of l.options) walk(o.lines || [], where);
      } else if (l.if) {
        ok(FLAGS.includes(l.if), `${where}: if ${l.if}`);
        walk(l.then || [], where);
        walk(l.else || [], where);
      } else {
        ok(WHO.includes(l.who), `${where}: who ${l.who}`);
        ok(typeof l.text === 'string' && l.text.length > 0 && l.text.length <= 80, `${where}: 길이 ${l.text}`);
        if (l.bg) ok(BG.includes(l.bg), `${where}: bg ${l.bg}`);
      }
    }
  };
  for (let c = 1; c <= 10; c++) {
    const ch = S.chapters[c];
    ok(ch, `챕터 ${c}`);
    for (const part of ['intro', 'preBoss', 'outro']) { ok(Array.isArray(ch[part]) && ch[part].length, `${c}.${part}`); walk(ch[part], `${c}.${part}`); }
    eq(S.chapterNames[c], D.chapters[c - 1].name, `챕터 이름 ${c}`);
  }
  walk(S.finalChoice.prompt, 'finalChoice');
  const ends = S.finalChoice.options.map((o) => o.ending).sort();
  eq(ends.join(), 'dawn,eternal,stars');
  for (const id of ['dawn', 'stars', 'eternal']) walk(S.endings[id].lines, id);
  eq(S.memories.length, 20);
  for (let c = 1; c <= 10; c++) eq(S.memories.filter((m) => m.chapter === c).length, 2, `기억 ${c}장`);
});

test('선택지 플래그: 4장 제로, 7장 리아, 2장 생존자', () => {
  const has = (lines, flag) => JSON.stringify(lines).includes(`"choice":"${flag}"`);
  const S = D.story.chapters;
  ok(has(S[4].outro, 'zeroSpared'));
  ok(has(S[7].outro, 'liaTrusted'));
  ok(has(S[2].intro, 'survivorsFirst') || has(S[2].outro, 'survivorsFirst'));
});

/* ───────── 성장 ───────── */
test('경험치: 레벨 업과 SP', () => {
  const s = freshSave(1);
  const sp = s.sp;
  const lv = P.addExp(s, P.expToNext(1) + P.expToNext(2) + 5);
  eq(lv, 2);
  eq(s.level, 3);
  eq(s.sp, sp + 2);
  eq(s.exp, 5);
});

test('스킬 배우기: 순서·SP·자동 장착', () => {
  const s = freshSave(1);
  s.sp = 10;
  ok(!P.learn(s, 'rayStrike').ok, '앞 단계 없이 배우면 안 됨');
  ok(P.learn(s, 'atkUp').ok);
  ok(P.learn(s, 'rayStrike').ok);
  eq(s.equippedSkills[1], 'rayStrike');
  eq(s.sp, 7);
  const st = P.computeStats(s);
  ok(Math.abs(st.atk - (40 + 4) * 1.12) < 0.01, '전투 연산 +12%');
});

test('무기 강화와 모듈 장착이 능력치에 반영된다', () => {
  const s = freshSave(5);
  s.credits = 10000;
  const before = P.computeStats(s).atk;
  ok(P.upgradeWeapon(s, 'blade'));
  eq(s.weapons.blade, 2);
  ok(Math.abs(P.computeStats(s).atk / before - 1.12) < 0.001);
  s.modules.push('vitality');
  ok(P.equipModule(s, 0, 'vitality'));
  eq(P.computeStats(s).maxHp, Math.round((500 + 40 * 5) * 1.2));
  ok(!P.equipModule(s, 1, 'edge'), '없는 모듈은 장착 불가');
});

test('챕터 보상은 처음 한 번만, 선택 모듈은 플래그를 따른다', () => {
  const s = freshSave(5);
  s.flags.survivorsFirst = true;
  const r = P.grantChapterRewards(s, 2);
  ok(r.length >= 3);
  ok(s.weapons.twin === 1);
  ok(s.modules.includes('guardian'));
  eq(s.unlockedChapter, 3);
  eq(P.grantChapterRewards(s, 2).length, 0);
});

test('파티 구성: 리아 차단 / 제로 합류', () => {
  const s = freshSave(10);
  s.flags.liaTrusted = false;
  s.flags.zeroSpared = true;
  eq(JSON.stringify(P.partyFor(s, 8)), JSON.stringify({ lia: false, zero: true }));
  eq(JSON.stringify(P.partyFor(s, 10)), JSON.stringify({ lia: true, zero: true }));
  eq(JSON.stringify(P.partyFor(s, 5)), JSON.stringify({ lia: true, zero: false }));
});

test('랭크와 기록(상위 5개)', () => {
  const s = freshSave(10);
  for (let i = 0; i < 7; i++) P.recordBoss(s, 'scavenger', 1, { time: 100 - i * 5, damageTaken: 0, maxHp: 500, zeroFrames: 0, breaks: 0 });
  eq(s.records.scavenger.length, 5);
  eq(s.records.scavenger[0].time, 70);
  eq(s.codex.scavenger.best, 70);
  eq(P.rankFromScore(95), 'S');
  eq(P.rankFromScore(60), 'B');
});

test('저장/불러오기와 빠진 필드 보정', () => {
  const s = freshSave(3);
  s.flags.zeroSpared = true;
  AZ.save.store(s);
  const back = AZ.save.load();
  eq(back.level, 3);
  eq(back.flags.zeroSpared, true);
  AZ.save.store({ level: 4, weapon: 'nope' });
  const fixed = AZ.save.load();
  eq(fixed.weapon, 'blade');
  ok(Array.isArray(fixed.equippedSkills) && fixed.equippedSkills.length === 3);
  AZ.save.clear();
  ok(!AZ.save.hasSave());
});

/* ───────── 전투 ───────── */
test('완벽 회피 → ZERO FRAME, 적의 시간이 느려진다', () => {
  const W = makeWorld();
  const p = W.player;
  W.boss.brain.rest = 99;
  const h = AZ.battle.addHazard(W, 'circle', { x: p.x, y: p.y, r: 60 }, { warn: 0.1, dmg: 1, owner: W.boss });
  // 판정 직전에 회피
  stepN(W, 4);
  stepN(W, 1, () => Object.assign(idle(), { dodge: true, mx: 1 }));
  stepN(W, 14);
  ok(W.stats.zeroFrames === 1, `ZERO FRAME ${W.stats.zeroFrames}`);
  eq(p.hp, p.maxHp, '피해 없음');
  ok(W.zero > 0 && W.enemyScale === 0.25);
  void h;
});

test('회피하지 않으면 피해를 입는다', () => {
  const W = makeWorld();
  const p = W.player;
  W.boss.brain.rest = 99;
  AZ.battle.addHazard(W, 'circle', { x: p.x, y: p.y, r: 60 }, { warn: 0.05, dmg: 1, owner: W.boss });
  stepN(W, 10);
  ok(p.hp < p.maxHp);
  eq(W.stats.hitsTaken, 1);
});

test('등 뒤 공격은 약점, 아르카의 정면 방패는 피해를 크게 줄인다', () => {
  const W = makeWorld({ chapterId: 2 });
  const e = W.boss;
  e.facing = 0;
  const front = AZ.battle.hitAngleInfo(W, e, e.x + 100, e.y);
  const back = AZ.battle.hitAngleInfo(W, e, e.x - 100, e.y);
  ok(front.shielded && !front.weak);
  ok(back.weak && !back.shielded);
  const r1 = AZ.battle.hitEnemy(W, e, { mv: 1, brk: 0, x: e.x + 100, y: e.y, kind: 'melee', crit: false });
  const r2 = AZ.battle.hitEnemy(W, e, { mv: 1, brk: 0, x: e.x - 100, y: e.y, kind: 'melee', crit: false });
  ok(r2.dmg > r1.dmg * 4, `${r1.dmg} vs ${r2.dmg}`);
});

test('브레이크: 게이지가 0 이 되면 무방비 + 받는 피해 증가 + 연계 가능', () => {
  const W = makeWorld();
  const e = W.boss;
  AZ.battle.damageBreak(W, e, e.brkMax + 1);
  ok(e.broken && e.breakT > 0);
  eq(W.stats.breaks, 1);
  W.player.target = e;
  const chain = AZ.battle.ev; void chain;
  W.player.chain = 0;
  stepN(W, 1, () => Object.assign(idle(), { chain: true }));
  stepN(W, 10);
  ok(W.chainUsedThisBreak, '브레이크 중 연계는 게이지 없이 가능');
  stepN(W, 60 * 7);
  ok(!e.broken, '시간이 지나면 회복');
  ok(e.brk > e.brkMax * 0.9, '게이지 회복');
});

test('보스 페이즈 전환', () => {
  const W = makeWorld();
  const e = W.boss;
  e.hp = e.maxHp * 0.51;
  AZ.battle.hitEnemy(W, e, { mv: 50, brk: 0, x: e.x, y: e.y - 100, kind: 'melee' });
  eq(e.phase, 2);
});

test('공중의 드라코에게는 근접 공격이 닿지 않는다', () => {
  const W = makeWorld({ chapterId: 7 });
  const e = W.boss;
  ok(e.airborne);
  eq(AZ.battle.hitEnemy(W, e, { mv: 1, x: e.x, y: e.y + 50, kind: 'melee', air: false }), null);
  ok(AZ.battle.hitEnemy(W, e, { mv: 1, x: e.x, y: e.y + 50, kind: 'proj', air: true }));
});

test('제로의 반격 태세를 때리면 반격당한다', () => {
  const W = makeWorld({ chapterId: 4 });
  const e = W.boss;
  e.stance = 1;
  AZ.battle.hitEnemy(W, e, { mv: 1, x: e.x + 40, y: e.y, kind: 'melee' });
  stepN(W, 10);
  ok(W.hazards.some((h) => h.counterHit), '반격 판정 생성');
});

test('콤보는 무기 단수만큼 이어지고, 다음 단계는 동작이 거의 끝난 뒤에 나간다', () => {
  const W = makeWorld();
  W.boss.brain.rest = 99;
  const p = W.player;
  W.boss.x = p.x;
  W.boss.y = p.y - 70;
  const seen = new Set();
  for (let i = 0; i < 120; i++) {
    W.events.length = 0;
    AZ.battle.step(W, 1 / 60, Object.assign(idle(), { attack: i % 3 === 0 }));
    if (p.st && p.st.idx != null) seen.add(p.st.idx);
  }
  eq(seen.size, D.weapons.blade.combo.length);
});

test('궁극기는 집중 게이지 100 이 필요하고 시간을 멈춘다', () => {
  const W = makeWorld();
  const p = W.player;
  stepN(W, 1, () => Object.assign(idle(), { ult: true }));
  ok(p.state !== 'ult');
  p.focus = 100;
  stepN(W, 1, () => Object.assign(idle(), { ult: true }));
  eq(p.state, 'ult');
  ok(W.timeStop > 0);
  const hp = W.boss.hp;
  stepN(W, 140);
  ok(W.boss.hp < hp);
  eq(p.focus, 0);
});

test('전술 명령: 분석은 리아가 있어야 하고 재사용 대기가 있다', () => {
  const W = makeWorld({ party: { lia: false, zero: false } });
  stepN(W, 1, () => Object.assign(idle(), { cmds: [true, false, false] }));
  eq(W.scan > 0, false);
  const W2 = makeWorld();
  stepN(W2, 1, () => Object.assign(idle(), { cmds: [true, false, false] }));
  ok(W2.scan > 0 && W2.cmdCd[0] > 0);
  eq(W2.stats.scans, 1);
});

test('웨이브를 모두 쓰러뜨리면 기억 파편이 나오고, 주우면 승리', () => {
  const W = makeWorld({ mode: 'wave' });
  for (let k = 0; k < 4; k++) {
    stepN(W, 120);
    for (const e of W.enemies) if (!e.dead) AZ.battle.killEnemy(W, e);
  }
  stepN(W, 60);
  const mem = W.pickups.find((x) => x.kind === 'memory');
  ok(mem, '기억 파편');
  W.player.x = mem.x;
  W.player.y = mem.y;
  stepN(W, 120);
  eq(W.state, 'victory');
  ok(W.result.memoryFound);
});

test('모든 보스가 오류 없이 30초 동안 공격 패턴을 펼친다 (모든 페이즈)', () => {
  for (const ch of D.chapters) {
    for (const frac of [1, 0.45, 0.2]) {
      const W = makeWorld({ chapterId: ch.id, party: { lia: true, zero: true } });
      W.player.hp = W.player.maxHp = 1e9;
      if (frac < 1) {
        W.boss.hp = W.boss.maxHp * (frac + 0.01);
        AZ.battle.hitEnemy(W, W.boss, { mv: 0.01, x: W.boss.x, y: W.boss.y + 50, kind: 'melee', air: true });
        W.boss.hp = W.boss.maxHp * frac;
        AZ.battle.hitEnemy(W, W.boss, { mv: 0.01, x: W.boss.x, y: W.boss.y + 50, kind: 'melee', air: true });
      }
      let hazards = 0;
      for (let i = 0; i < 60 * 30; i++) {
        W.events.length = 0;
        AZ.battle.step(W, 1 / 60, idle());
        hazards = Math.max(hazards, W.hazards.length);
        if (W.player.state === 'locked' && W.player.st.t > 5) throw new Error('잠금 해제 안 됨');
      }
      ok(hazards > 0, `${ch.boss} 공격 없음 (phase ${W.boss.phase})`);
      ok(isFinite(W.boss.x) && isFinite(W.boss.y), `${ch.boss} 위치 NaN`);
    }
  }
  eq(errors.length, 0, errors.join('\n'));
});

/* ───────── 이어진 스테이지 (지역 입구 → 보스 구역) ───────── */
function stageWorld(ch, checkpoint) {
  const s = freshSave(30);
  const stats = P.computeStats(s);
  const c = D.chapters[ch - 1];
  const W = AZ.battle.create({ chapterId: ch, mode: 'stage', bossId: c.boss, difficulty: 'normal', stats, party: { lia: true, zero: false }, checkpoint: checkpoint || 0 });
  W.state = 'fight';
  return W;
}

test('모든 챕터의 지도가 지역 흐름(입구 → 갈림길 → 합류 → 보스)을 따른다', () => {
  for (const c of D.chapters) {
    const W = stageWorld(c.id);
    const L = W.level;
    const kinds = L.areas.map((a) => a.id);
    for (const k of ['start', 'explore', 'battle1', 'branch', 'battle2', 'lab', 'treasure', 'story', 'midboss', 'checkpoint', 'final', 'boss']) ok(kinds.includes(k), `${c.id}장: ${k} 구역 없음`);
    eq(L.areas[0].kind, 'boss', `${c.id}장 첫 구역`);
    // 길 안내선의 모든 점은 걸을 수 있는 곳
    for (const [x, y] of L.route) {
      const q = AZ.level.constrain(L, x, y, 10, null);
      ok(Math.hypot(q.x - x, q.y - y) < 1, `${c.id}장: 경로 점 (${x | 0}, ${y | 0}) 이 길 밖`);
    }
    const last = L.route[L.route.length - 1];
    ok(AZ.level.inArea(L.areas[0], last[0], last[1], 0), `${c.id}장: 경로가 보스 구역에서 끝나지 않음`);
    // 보물 구역은 갈림길보다 높은 곳 (위로 올라가는 길)
    const z = (id) => L.areas.find((a) => a.id === id).z;
    ok(z('treasure') > z('lab'), `${c.id}장: 보물 구역이 높지 않음`);
    ok(z('boss') > z('start'), `${c.id}장: 보스 구역이 입구보다 높지 않음`);
    ok(L.objects.some((o) => o.kind === 'npc') && L.objects.some((o) => o.kind === 'chest') && L.objects.some((o) => o.kind === 'gate'), `${c.id}장: NPC·상자·관문 단말기`);
    ok((D.maps[c.theme].regions || []).length === 7, `${c.id}장: 지역 이름 7개`);
  }
});

/** 길 안내를 따라 걷고, 교전은 즉시 정리하고, 관문 단말기를 작동시키며 보스까지 */
function walkStage(W, maxSec, opt) {
  const o = opt || {};
  const st = W.stage;
  const seen = { regions: new Set(), story: false, elite: false, cp: false, gate: false };
  const side = { on: false, i: 0, wps: [] };
  for (const sg of W.level.segs) if (sg.branch) side.wps.push([sg.ax, sg.ay], [sg.bx, sg.by]);
  for (let i = 0; i < 60 * maxSec; i++) {
    W.events.length = 0;
    const p = W.player;
    const inp = idle();
    if (st.active) {
      if (st.active.elite) seen.elite = true;
      for (const m of W.enemies) if (!m.dead && m.kind === 'enemy' && m.spawnT <= 0) AZ.battle.killEnemy(W, m);
    } else {
      const gate = st.objects.find((q) => q.kind === 'gate');
      const fin = st.enc.find((q) => q.id === 'final');
      let tx;
      let ty;
      if (!st.gateOpen && fin.state === 'cleared') { tx = gate.x; ty = gate.y; inp.interact = st.near === gate; } else {
        const gd = AZ.level.guide(W.level, p.x, p.y, 120);
        tx = gd.x; ty = gd.y;
      }
      // 옆길: 분기점에서 연구실 → 오르막 → 보물 구역 → 스토리 순서로 갈래 길을 따라감
      if (o.side && side.i < side.wps.length && (side.on || st.regionKey === 'branch')) {
        side.on = true;
        const [wx, wy] = side.wps[side.i];
        tx = wx; ty = wy;
        if (Math.hypot(wx - p.x, wy - p.y) < 30) side.i += 1;
        const chest = st.objects.find((q) => q.kind === 'chest');
        if (st.near === chest && !chest.used) inp.interact = true;
      }
      const d = Math.hypot(tx - p.x, ty - p.y);
      if (d > 4) { inp.mx = (tx - p.x) / d; inp.my = (ty - p.y) / d; }
    }
    AZ.battle.step(W, 1 / 60, inp);
    for (const e of W.events) {
      if (e.type === 'region') seen.regions.add(e.text);
      if (e.type === 'storyEvent') { seen.story = true; W.hold = false; }
      if (e.type === 'npcTalk') W.hold = false;
      if (e.type === 'bossApproach') return Object.assign(seen, { time: i / 60, gate: st.gateOpen, cp: st.cpReached });
    }
  }
  return Object.assign(seen, { time: -1, gate: st.gateOpen, cp: st.cpReached });
}
test('모든 챕터: 몬스터를 정리하며 길을 따라가면 끊김 없이 보스 구역에 닿는다', () => {
  for (const c of D.chapters) {
    const W = stageWorld(c.id);
    const r = walkStage(W, 240);
    ok(r.time > 0, `${c.id}장: 보스 구역에 닿지 못함 (위치 ${W.player.x | 0}, ${W.player.y | 0})`);
    ok(r.story, `${c.id}장: 스토리 이벤트 없음`);
    ok(r.elite, `${c.id}장: 중간 보스 없음`);
    ok(r.cp, `${c.id}장: 체크포인트 안 지남`);
    ok(r.gate, `${c.id}장: 관문 단말기 미작동`);
    ok(r.regions.size >= 5, `${c.id}장: 지역 이름 변화 ${r.regions.size}`);
    // 보스 등장
    AZ.battle.startBoss(W);
    ok(W.boss && !W.boss.dead, `${c.id}장: 보스 없음`);
    ok(W.stageStats && W.stageStats.kills > 0, `${c.id}장: 스테이지 처치 기록`);
    stepN(W, 120);
    ok(isFinite(W.player.x) && isFinite(W.boss.x), `${c.id}장: 위치 NaN`);
  }
  eq(errors.length, 0, errors.join('\n'));
});

test('갈림길: 연구실로 가면 일반 전투②는 사라지고 보물 상자를 열 수 있다', () => {
  const W = stageWorld(1);
  const r = walkStage(W, 240, { side: true });
  ok(r.time > 0, '보스 구역 도착');
  const lab = W.stage.enc.find((q) => q.id === 'lab');
  const b2 = W.stage.enc.find((q) => q.id === 'battle2');
  eq(lab.state, 'cleared', '연구실');
  eq(b2.state, 'skipped', '일반 전투②');
  ok(W.found.chest, '보물 상자');
});

test('체크포인트에서 다시 시작하면 앞 구역은 정리된 상태', () => {
  const W = stageWorld(3, 'cp');
  const st = W.stage;
  ok(st.cpReached);
  ok(st.enc.filter((e) => e.id !== 'final').every((e) => e.state === 'cleared'), '앞 교전 정리');
  eq(st.enc.find((e) => e.id === 'final').state, 'idle', '최종 구역은 남음');
  ok(Math.hypot(W.player.x - W.level.checkpointPos.x, W.player.y - W.level.checkpointPos.y) < 2, '체크포인트 위치');
  const r = walkStage(W, 120);
  ok(r.time > 0 && r.time < 60, `체크포인트 → 보스 ${r.time}`);
  const B = stageWorld(3, 'boss');
  ok(B.stage.gateOpen, '보스 체크포인트: 관문 열림');
  const rb = walkStage(B, 30);
  ok(rb.time >= 0 && rb.time < 6, `보스 체크포인트 → 보스 구역 ${rb.time}`);
});

test('관문은 최종 구역을 정리하기 전에는 열리지 않고, 닫힌 관문은 통과할 수 없다', () => {
  const W = stageWorld(2, 'cp');
  const st = W.stage;
  const gate = st.objects.find((o) => o.kind === 'gate');
  W.player.x = gate.x;
  W.player.y = gate.y + 20;
  stepN(W, 2);
  eq(st.near, gate, '단말기 근처');
  AZ.battle.step(W, 1 / 60, Object.assign(idle(), { interact: true }));
  ok(!st.gateOpen, '최종 구역 전에는 닫힘');
  // 관문 너머로 밀어 넣어도 막힘
  const gy = W.level.gate.y;
  W.player.x = (W.level.gate.x0 + W.level.gate.x1) / 2;
  W.player.y = gy - 60;
  stepN(W, 2);
  ok(W.player.y >= gy, `닫힌 관문 통과 ${W.player.y | 0} < ${gy | 0}`);
});

console.log(`\n${passed}개 통과, ${failed}개 실패`);
process.exit(failed ? 1 : 0);
