'use strict';

/* 데이터 무결성 — 참조, 필수 필드, 그림 함수가 모든 id를 그리는지 */
const assert = require('assert');
const { loadGame } = require('./load');

const { ART } = require('./load');
const { RG } = loadGame({ extra: ART });
const D = RG.data;

test('탑: 3단계 + 분기 2개, 공격 방식에 맞는 필드', () => {
  for (const [id, t] of Object.entries(D.towers)) {
    assert.strictEqual(t.levels.length, 3, id);
    assert.ok(t.branches.A && t.branches.B, `${id} 분기`);
    assert.ok(D.elements[t.element], `${id} 원소`);
    for (const s of [...t.levels, t.branches.A, t.branches.B]) {
      assert.ok(s.cost > 0, `${id} 비용`);
      if (t.role === 'attack') {
        assert.ok(s.range > 0, `${id} 사거리`);
        if (t.kind !== 'beam' && t.kind !== 'sweep' && t.kind !== 'orbit') assert.ok(s.interval > 0, `${id} 간격`); // 빛줄기·도는 빛·불사조는 계속 쏨
      }
      if (t.role === 'barracks') assert.ok(s.soldiers && s.rallyRange, `${id} 병사`);
      if (t.role === 'economy') assert.ok(s.income > 0, `${id} 수입`);
      if (t.role === 'support') assert.ok(s.aura, `${id} 지원`);
    }
    assert.ok(D.towerOrder.includes(id), `${id} 순서 목록`);
  }
});

test('적: 필수 필드, 분열·소환 대상 존재, 보스 패턴 구현', () => {
  for (const [id, e] of Object.entries(D.enemies)) {
    for (const k of ['name', 'region', 'size', 'hp', 'speed', 'armor', 'bounty', 'lives']) assert.ok(e[k] != null, `${id}.${k}`);
    for (const k of Object.keys(e.traits)) assert.ok(D.traits[k] || k === 'shredResist', `${id} 특성 ${k}`);
    for (const [el, a] of Object.entries(e.affinity)) { assert.ok(D.elements[el], `${id} 친화 원소`); assert.ok(D.affinities[a], `${id} 친화 ${a}`); }
    if (e.traits.split) assert.ok(D.enemies[e.traits.split.into], `${id} 분열 대상`);
    if (e.boss) {
      assert.ok(e.bossData, `${id} bossData`);
      assert.ok(RG.bosses.BOSSES[id], `${id} 보스 패턴 구현`);
      const bd = e.bossData;
      for (const s of [bd.summon, bd.phase && bd.phase.summon, ...(bd.phases || []).map((p) => p.summon)]) if (s) assert.ok(D.enemies[s.type], `${id} 소환 ${s.type}`);
    }
    assert.ok(D.enemyOrder.includes(id), `${id} 순서 목록`);
  }
});

test('특성마다 대표 적이 하나 이상', () => {
  for (const k of Object.keys(D.traits)) assert.ok(Object.values(D.enemies).some((e) => (k === 'armor' ? e.armor > 0 : e.traits[k])), `특성 ${k}을(를) 가진 적이 없음`);
});

test('영웅: 대사 6종, 기술 구현', () => {
  const SK = ['flame_slam', 'dawn_prayer', 'frost_volley', 'thunder_drone', 'earth_wall', 'shadow_strike', 'snow_friends', 'temper', 'gale_dive', 'giant_form', 'meteor', 'echo_bell'];
  for (const [id, h] of Object.entries(D.heroes)) {
    for (const k of ['select', 'move', 'skill', 'down', 'revive', 'win']) assert.ok(h.lines[k] && h.lines[k].length, `${id} 대사 ${k}`);
    assert.ok(SK.includes(h.skill.id), `${id} 기술`);
  }
});

test('맵: 과제·도전 종류가 엔진 목록에 있음, 새 탑·적·영웅 참조 유효', () => {
  for (const m of D.maps) {
    if (m.task) assert.ok(D.taskTypes.includes(m.task.type), `${m.id} 과제 ${m.task.type}`);
    if (m.challenge) assert.ok(D.challengeTypes[m.challenge.type], `${m.id} 도전 ${m.challenge.type}`);
    for (const t of m.newTowers || []) assert.strictEqual(D.towers[t].unlock, m.id, `${m.id} 새 탑 ${t}의 해금 맵`);
    for (const e of m.newEnemies || []) assert.ok(D.enemies[e], `${m.id} 새 적 ${e}`);
    if (m.hero) assert.strictEqual(D.heroes[m.hero].unlock, m.id, `${m.id} 영웅 해금`);
    assert.strictEqual(m.grid.length, 9, `${m.id} 세로 9칸`);
    assert.strictEqual(m.grid[0].length, 16, `${m.id} 가로 16칸`);
  }
});

test('비행 적은 지상 입구에서 나와 길을 따라감 (하늘 입구 A는 그림 장식만)', () => {
  // 2026-11-10 개정: 비행 적이 가운데를 질러 오지 않도록 길을 따라 날게 바꿈 — 모든 맵에서 입구→등불 길이 이어져 있어야 함
  for (const def of D.maps.concat(D.endless)) {
    const flyers = RG.grid.parseWaves(def.waves || []).some((w) => w.groups.some((g) => D.enemies[g.e].traits.flying));
    if (!flyers && !def.endless) continue;
    const g = RG.sim.create({ mapId: def.id, seed: 1, heroId: null, mode: def.endless ? 'endless' : 'normal' });
    for (const s of g.map.spawns) assert.ok(isFinite(g.flow[s.r * g.map.cols + s.c]), `${def.id} 입구 (${s.c},${s.r})에서 등불까지 길이 이어짐`);
  }
});

test('맵 난이도 계수(hpMult)는 0.5~1.2 사이', () => {
  for (const def of D.maps.concat(D.endless || [])) if (def.hpMult != null) assert.ok(def.hpMult >= 0.5 && def.hpMult <= 1.2, def.id);
});

test('새 적은 그 맵에서 처음 등장 (이전 맵 웨이브에 없음)', () => {
  const seen = new Set();
  for (const m of D.maps) {
    const here = new Set();
    for (const w of RG.grid.parseWaves(m.waves)) for (const g of w.groups) here.add(g.e);
    for (const e of m.newEnemies || []) {
      if (D.enemies[e].minion) continue;
      assert.ok(!seen.has(e), `${m.id}의 새 적 ${e}이(가) 이전 맵에 나옴`);
      assert.ok(here.has(e), `${m.id}의 새 적 ${e}이(가) 이 맵 웨이브에 없음`);
    }
    for (const e of here) if (!D.enemies[e].minion && !seen.has(e)) assert.ok((m.newEnemies || []).includes(e), `${m.id}: ${e}이(가) 처음 나오는데 newEnemies에 없음`);
    for (const e of here) seen.add(e);
  }
});

test('그림 함수가 모든 탑·적·영웅·유닛·초상화·맵을 그린다', () => {
  const ok = (svg, what) => assert.ok(typeof svg === 'string' && svg.includes('<svg'), what);
  for (const id of Object.keys(D.towers)) { for (const lv of [1, 2, 3]) ok(RG.art.tower(id, lv, null), `${id} Lv${lv}`); ok(RG.art.tower(id, 4, 'A'), `${id} 4A`); ok(RG.art.tower(id, 4, 'B'), `${id} 4B`); }
  for (const id of Object.keys(D.enemies)) for (const f of [0, 1]) ok(RG.art.enemy(id, f), `${id} ${f}`);
  for (const id of D.heroOrder) { for (const p of ['idle', 'walk1', 'walk2', 'attack']) ok(RG.art.hero(id, p), `${id} ${p}`); for (const m of ['normal', 'happy', 'worried']) ok(RG.art.portrait(id, m), `${id} ${m}`); }
  for (const id of ['elder', 'bellkeeper', 'haru']) ok(RG.art.portrait(id, 'normal'), id);
  for (const k of ['stone_soldier', 'granite_guard', 'obsidian_blade', 'drone', 'rock_wall']) ok(RG.art.unit(k, 'idle'), k);
  for (const m of D.maps.concat(D.endless)) ok(RG.art.mapBackground(RG.grid.parseMap(m)), m.id);
  for (let r = 1; r <= 5; r++) ok(RG.art.regionBanner(r), `banner ${r}`);
  ok(RG.art.lantern(0.5), 'lantern');
});

test('모든 자세가 오류 없이 그려진다 (엄격 모드: 그리다 실패하면 자리표시로 숨기지 않음)', () => {
  RG.art._strict = true;
  try {
    for (const t of Object.keys(D.towers)) for (const [lv, br] of [[1], [2], [3], [4, 'A'], [4, 'B']]) for (const p of RG.art.TOWER_POSES) assert.ok(RG.art.tower(t, lv, br, p).includes('<svg'), `${t} ${lv}${br || ''} ${p}`);
    for (const e of Object.keys(D.enemies)) for (const f of RG.art.ENEMY_FRAMES) assert.ok(RG.art.enemy(e, f).includes('<svg'), `${e} ${f}`);
    for (const h of [...Object.keys(D.heroes), 'tori_giant']) for (const p of RG.art.HERO_POSES) assert.ok(RG.art.hero(h, p).includes('<svg'), `${h} ${p}`);
    for (const u of ['stone_soldier', 'granite_guard', 'obsidian_blade', 'drone', 'rock_wall', 'snowman', 'tori_giant']) for (const p of RG.art.UNIT_POSES) assert.ok(RG.art.unit(u, p).includes('<svg'), `${u} ${p}`);
    for (const g of D.growth.gearOrder) assert.ok(RG.art.GEAR_ICONS.includes(g) && RG.art.gearIcon(g).includes('<svg'), `장신구 ${g}`);
    // 영웅마다 초상화 3표정이 자리표시(물음표 얼굴)가 아닌 진짜 그림
    const placeholder = RG.art.portrait('__없는_영웅__', 'normal').replace(/id="[^"]*"|url\(#[^)]*\)/g, '');
    for (const h of D.heroOrder) for (const m of ['normal', 'happy', 'worried']) {
      const svg = RG.art.portrait(h, m);
      assert.ok(svg.includes('<svg') && svg.replace(/id="[^"]*"|url\(#[^)]*\)/g, '') !== placeholder, `${h} ${m} 초상화`);
    }
    // 영웅 전신도 자리표시가 아님
    const heroPh = RG.art.hero('__없는_영웅__', 'idle0').replace(/id="[^"]*"|url\(#[^)]*\)/g, '');
    for (const h of D.heroOrder) assert.notStrictEqual(RG.art.hero(h, 'idle0').replace(/id="[^"]*"|url\(#[^)]*\)/g, ''), heroPh, `${h} 전신`);
  } finally { RG.art._strict = false; }
});

test('쓰이는 아이콘 이름이 모두 실제 아이콘 (물음표 대체 아님)', () => {
  const norm = (s) => s.replace(/id="[^"]*"|url\(#[^)]*\)|href="#[^"]*"/g, '');
  const unknown = norm(RG.art.icon('__없는_아이콘__'));
  const names = new Set([...D.elementOrder, ...Object.values(D.traits).map((t) => t.icon), ...Object.values(D.statuses).map((s) => s.icon),
    'gold', 'lives', 'wave', 'damage', 'range', 'speed', 'hp', 'star', 'star_empty', 'lock', 'play', 'pause', 'fast', 'settings', 'sell', 'upgrade', 'target', 'hero', 'skill', 'back', 'close', 'map', 'book', 'tree', 'storm', 'burn', 'stealth', 'armor']);
  for (const n of names) assert.notStrictEqual(norm(RG.art.icon(n)), unknown, `아이콘 없음: ${n}`);
});
