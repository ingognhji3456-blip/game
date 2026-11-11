'use strict';

/*
 * 영웅 성장 (docs/design/hero-growth.md): 인연 레벨·재능 나무·장신구 — 계산, 판 반영, 고유 재능 24개, 저장.
 * 맵 1-1: (4~6,1)이 길, (5,2)가 건설지.
 */
const assert = require('assert');
const { loadGame } = require('./load');

const { RG } = loadGame();
const D = RG.data;
const GD = D.growth;
const GW = RG.growth;
const plain = (x) => JSON.parse(JSON.stringify(x)); // vm 안 객체는 원형이 달라 그대로 비교하면 다르다고 나옴

function game(opts = {}) { const g = RG.sim.create(Object.assign({ mapId: '1-1', seed: 1, heroId: null }, opts)); g.state.gold = 1e6; return g; }
function run(g, sec) { for (let i = 0; i < Math.round(sec * 30); i++) g.step(); }
function runCollect(g, sec, pred) { const out = []; for (let i = 0; i < Math.round(sec * 30); i++) { g.step(); for (const e of g.state.events) if (!pred || pred(e)) out.push(e); } return out; }
function spawn(g, type, x, y, o = {}) {
  const e = g.api.spawnEnemy(type, 0);
  if (x != null) Object.assign(e, { x, y, px: x, py: y, c: Math.floor(x), r: Math.floor(y), tc: Math.floor(x), tr: Math.floor(y) });
  if (o.hp) { e.hp = o.hp; e.maxHp = o.hp; }
  if (o.root) { e.ccUntil = 1e9; e.ccKind = 'root'; }
  e.armor = 0;
  return e;
}
function build(g, tower, c, r) {
  const res = g.cmd({ type: 'build', tower, c, r });
  assert.ok(res.ok, `건설 실패 ${tower}: ${res.reason}`);
  const t = g.state.towers.find((q) => q.id === res.id);
  t.building = false; t.buildUntil = 0;
  return t;
}
/** 성장 판: talents = 찍을 칸 목록(앞 칸 자동 포함), gear = [[id, plus]] */
function heroG(heroId, { talents = [], gear = [], mode = 'normal', at = [5.5, 1.5] } = {}) {
  const full = [];
  for (const id of talents) {
    const n = GW.node(heroId, id);
    for (const pre of GW.branchIds(heroId, n.branch).slice(0, n.tier + 1)) if (!full.includes(pre)) full.push(pre);
  }
  const growth = talents.length || gear.length ? { level: 10, talents: full, gear } : undefined;
  const g = game({ heroId, heroGrowth: growth, mode });
  const h = g.state.hero;
  Object.assign(h, { x: at[0], y: at[1], path: [] });
  return { g, h };
}
const cast = (g, x, y, targetId) => { const r = g.cmd({ type: 'heroSkill', x, y, targetId }); assert.ok(r.ok, `기술 실패: ${r.reason}`); };

/* =============== 데이터 =============== */
test('성장 데이터: 고유 재능 12명 × 2, 장신구 18종(등급마다 6·원소마다 3), 설명 칸이 모두 수치', () => {
  for (const id of D.heroOrder) {
    assert.strictEqual((GD.unique[id] || []).length, 2, `${id} 고유 재능`);
    assert.strictEqual(GW.allIds(id).length, 9, `${id} 재능 9칸`);
    for (const nid of GW.allIds(id)) { const n = GW.node(id, nid); assert.ok(n && n.name && n.desc, `${id} ${nid}`); }
  }
  assert.strictEqual(GD.gearOrder.length, 18);
  assert.deepStrictEqual(new Set(GD.gearOrder), new Set(Object.keys(GD.gear)));
  for (const r of Object.keys(GD.gearRarities)) assert.strictEqual(GD.gearOrder.filter((g) => GD.gear[g].rarity === r).length, 6, r);
  for (const el of D.elementOrder) assert.strictEqual(GD.gearOrder.filter((g) => GD.gear[g].element === el).length, 3, el);
  for (const id of GD.gearOrder) {
    const gd = GD.gear[id];
    for (const [, key] of gd.desc.matchAll(/\{(\w+)\}/g)) assert.ok(key in gd.mods, `${id} 설명 {${key}}`);
    for (const k of Object.keys(gd.mods)) assert.ok(GW.MOD_KEYS.includes(k), `${id} 효과 키 ${k}`);
    assert.ok(!/\{/.test(GW.gearText(id, 0, null)), `${id} 설명 채움`);
  }
});

test('인연 레벨 표 · 재능 점수 · 경험치 얻기', () => {
  assert.deepStrictEqual(plain(GW.levelOf(0)), { level: 1, into: 0, need: 4, max: false });
  assert.strictEqual(GW.levelOf(4).level, 2);
  assert.strictEqual(GW.levelOf(9).level, 2);
  assert.strictEqual(GW.levelOf(10).level, 3);
  assert.strictEqual(GW.levelOf(107).level, 9);
  assert.strictEqual(GW.levelOf(108).level, 10);
  assert.ok(GW.levelOf(9999).max);
  assert.strictEqual(GW.points(1), 0);
  assert.strictEqual(GW.points(10), 9);
  assert.strictEqual(GW.bondGain({ result: 'win', mode: 'normal', newStars: 3 }), 9);
  assert.strictEqual(GW.bondGain({ result: 'lose', mode: 'normal' }), 1);
  assert.strictEqual(GW.bondGain({ result: 'lose', mode: 'endless', waves: 37 }), 3);
  assert.strictEqual(GW.bondGain({ result: 'lose', mode: 'endless', waves: 99 }), 4);
});

test('재능: 점수·앞 칸 검사, 잘못 저장된 재능은 정리', () => {
  assert.ok(!GW.canTake('kara', [], 'atk2', 10).ok, '앞 칸 없이 2칸');
  assert.ok(GW.canTake('kara', [], 'atk1', 2).ok);
  assert.ok(!GW.canTake('kara', [], 'atk1', 1).ok, '레벨 1은 점수 0');
  assert.ok(!GW.canTake('kara', ['atk1'], 'atk1', 10).ok, '두 번');
  assert.ok(GW.canTake('kara', ['atk1', 'atk2'], 'kara_atk', 10).ok);
  assert.ok(!GW.canTake('kara', ['atk1', 'atk2'], 'sera_atk', 10).ok, '다른 영웅 고유');
  assert.deepStrictEqual(plain(GW.cleanTalents('kara', ['atk2', 'atk1', 'sur1', 'sur2'], 3)), ['atk1', 'sur1']);
});

test('장신구 수치: 강화 단계 +20%씩, 같은 원소 +25%, 붙잡기는 정수 그대로, 합계 상한', () => {
  assert.strictEqual(GW.gearMods('forge_glove', 0, 'storm').damagePct, 0.12);
  assert.strictEqual(GW.gearMods('forge_glove', 3, 'storm').damagePct, 0.192);
  assert.strictEqual(GW.gearMods('forge_glove', 0, 'fire').damagePct, 0.15);
  assert.strictEqual(GW.gearMods('titan_belt', 3, 'earth').blockAdd, 1);
  assert.strictEqual(GW.upgradeCost('ember_ring', 0), 30);
  assert.strictEqual(GW.upgradeCost('void_ring', 2), 240);
  assert.strictEqual(GW.upgradeCost('void_ring', 3), null);
  const m = GW.mods('sio', { level: 10, talents: ['sur1', 'sur2'], gear: [['snow_brooch', 3], ['snow_brooch', 3]] });
  assert.ok(Math.abs(m.takenPct - (0.1 + 0.12 * 1.6 * 1.25)) < 1e-6, `같은 장신구 두 번은 한 번만: ${m.takenPct}`);
  const cap = GW.mods('kara', { level: 10, talents: ['sk1'], gear: [['night_key', 3]] });
  assert.ok(cap.cooldownPct <= GD.caps.cooldownPct);
  assert.strictEqual(GW.mods('kara', null), null);
});

/* =============== 판 반영 =============== */
test('성장이 판에 반영: 체력·공격력·공격 속도·사거리·이동·받는 피해·재사용·부활·붙잡기', () => {
  const base = heroG('sera');
  const grown = heroG('sera', { talents: ['atk2', 'sur3', 'sk2'], gear: [['light_shard', 0], ['wind_feather', 0]] });
  const hb = base.h; const hg = grown.h;
  assert.ok(Math.abs(hg.maxHp / hb.maxHp - 1.15) < 1e-6, '체력 +15%');
  // 공격 속도·사거리: 같은 적을 두 판에서 때리는 간격, 사거리 끝(2.8칸)의 적
  const eb = spawn(base.g, 'ash_boar', 5.5 + 2.8, 1.5, { hp: 1e6, root: true });
  const eg = spawn(grown.g, 'ash_boar', 5.5 + 2.8, 1.5, { hp: 1e6, root: true });
  const ab = runCollect(base.g, 6, (x) => x.type === 'heroAttack').length;
  const ag = runCollect(grown.g, 6, (x) => x.type === 'heroAttack').length;
  assert.strictEqual(ab, 0, '기본 사거리 밖');
  assert.ok(ag >= 5, `빛 조각 사거리 +0.4 → 공격 ${ag}`);
  assert.ok(eg.hp < eg.maxHp && eb.hp === eb.maxHp);
  // 공격력 +10% (atk1) — 같은 한 방 비교
  const d0 = heroG('kara'); const d1 = heroG('kara', { talents: ['atk1'] });
  const t0 = spawn(d0.g, 'ash_boar', 6.2, 1.5, { hp: 1e6, root: true }); const t1 = spawn(d1.g, 'ash_boar', 6.2, 1.5, { hp: 1e6, root: true });
  const h0 = runCollect(d0.g, 2, (x) => x.type === 'hit' && x.targetId === t0.id)[0];
  const h1 = runCollect(d1.g, 2, (x) => x.type === 'hit' && x.targetId === t1.id)[0];
  assert.ok(h0 && h1 && Math.abs(h1.amount / h0.amount - 1.1) < 0.02, `공격력 ${h1 && h1.amount} / ${h0 && h0.amount}`);
  // 이동 +25%
  const m0 = heroG('kara'); const m1 = heroG('kara', { gear: [['wind_feather', 0]] });
  for (const q of [m0, m1]) q.g.cmd({ type: 'heroMove', x: 1.5, y: 1.5 });
  run(m0.g, 1); run(m1.g, 1);
  assert.ok((5.5 - m1.h.x) / (5.5 - m0.h.x) > 1.2, `이동 ${m1.h.x} vs ${m0.h.x}`);
  // 받는 피해 −10% (sur2), 부활 −40% (sur3)
  const s0 = heroG('kara'); const s1 = heroG('kara', { talents: ['sur3'] });
  s0.g.api.hurtUnit(s0.h, 100); s1.g.api.hurtUnit(s1.h, 100);
  assert.ok(Math.abs((s1.h.maxHp - s1.h.hp) / (s0.h.maxHp - s0.h.hp) - 0.9) < 1e-6, '받는 피해');
  s0.g.api.hurtUnit(s0.h, 1e6); s1.g.api.hurtUnit(s1.h, 1e6);
  const r0 = s0.h.downUntil - s0.g.state.time; const r1 = s1.h.downUntil - s1.g.state.time;
  assert.ok(Math.abs(r1 / r0 - 0.6) < 1e-6, `부활 ${r1}/${r0}`);
  // 재사용 −10%
  const c0 = heroG('kara'); const c1 = heroG('kara', { talents: ['sk1'] });
  cast(c0.g, 6.5, 1.5); cast(c1.g, 6.5, 1.5);
  assert.ok(Math.abs(c1.h.skillCd / c0.h.skillCd - 0.9) < 1e-6, '재사용');
  // 붙잡기 +1
  assert.strictEqual(heroG('kara', { gear: [['titan_belt', 0]] }).h.block, D.heroes.kara.block + 1);
});

test('성장은 도전 모드에서 쓰이지 않음 · 성장 없는 판과 같은 판은 같은 해시 · 같은 성장 판은 재현이 같음', () => {
  const ch = heroG('kara', { talents: ['sur2'], gear: [['pebble_charm', 3]], mode: 'challenge' });
  const no = heroG('kara', { mode: 'challenge' });
  assert.strictEqual(ch.h.maxHp, no.h.maxHp);
  assert.strictEqual(ch.g.growth, null);
  const mk = (growth) => {
    const g = RG.sim.create({ mapId: '1-2', seed: 7, heroId: 'kara', heroGrowth: growth, towers: ['ember_archer', 'frost_crystal', 'stone_barracks'] });
    g.cmd({ type: 'build', tower: 'ember_archer', c: 5, r: 4 });
    g.cmd({ type: 'callWave' });
    for (let i = 0; i < 30 * 40; i++) g.step();
    return g.hash();
  };
  const G1 = { level: 10, talents: ['atk1', 'atk2', 'kara_atk', 'sk1', 'sk2', 'kara_sk'], gear: [['storm_gem', 2], ['void_ring', 1]] };
  assert.strictEqual(mk(G1), mk(JSON.parse(JSON.stringify(G1))), '같은 성장 = 같은 해시');
  assert.notStrictEqual(mk(G1), mk(undefined), '성장이 결과를 바꿈');
});

/* =============== 영웅 고유 재능 24개 =============== */
test('고유 재능(공격 갈래 끝) 12개가 각각 효과를 냄', () => {
  // 카라 달군 망치: 화상
  { const { g } = heroG('kara', { talents: ['kara_atk'] }); const e = spawn(g, 'ash_boar', 6.2, 1.5, { hp: 1e6, root: true }); run(g, 2); assert.ok(e.st.burns.some((b) => b.key === 'heroBurn'), '카라'); }
  // 세라 빛 퍼짐 · 하루 큰 눈덩이: 사거리 밖 옆 적이 맞음
  for (const [id, R] of [['sera', 2.6], ['haru', 2.4]]) {
    const side = (on) => {
      const { g } = heroG(id, { talents: on ? [`${id}_atk`] : [] });
      spawn(g, 'ash_boar', 5.5 + R - 0.2, 1.5, { hp: 1e6, root: true });
      const n = spawn(g, 'ash_boar', 5.5 + R + 0.25, 1.5, { hp: 1e6, root: true });
      run(g, 5);
      return n.maxHp - n.hp;
    };
    assert.ok(side(true) > 0 && side(false) === 0, `${id} 범위`);
  }
  // 시오 꿰뚫기 · 도한 튕기기
  for (const [id, R] of [['sio', 4.2], ['dohan', 1.8]]) {
    const side = (on) => {
      const { g } = heroG(id, { talents: on ? [`${id}_atk`] : [] });
      spawn(g, 'ash_boar', 5.5 + R - 0.2, 1.5, { hp: 1e6, root: true });
      const n = spawn(g, 'ash_boar', 5.5 + R + 0.6, 1.5, { hp: 1e6, root: true });
      run(g, 5);
      return n.maxHp - n.hp;
    };
    assert.ok(side(true) > 0 && side(false) === 0, `${id} 옆 적`);
  }
  // 제나 과충전: 연쇄 길이 +2
  {
    const len = (on) => {
      const { g } = heroG('zena', { talents: on ? ['zena_atk'] : [] });
      for (let i = 0; i < 6; i++) spawn(g, 'ash_boar', 7.0 + i * 0.28, 1.5, { hp: 1e6, root: true }); // 서로 1.5칸 안 — 어느 쪽으로 이어도 끊기지 않음
      return Math.max(...runCollect(g, 2, (x) => x.type === 'chain' && !x.small).map((x) => x.points.length));
    };
    assert.strictEqual(len(true), len(false) + 2, '제나');
  }
  // 바위 지진 주먹: 기절
  { const { g } = heroG('bawi', { talents: ['bawi_atk'] }); const e = spawn(g, 'ash_boar', 6.2, 1.5, { hp: 1e6 }); e.ccUntil = 0; let stun = false; for (let i = 0; i < 30 * 6 && !stun; i++) { g.step(); stun = e.ccKind === 'stun' && e.ccUntil > g.state.time; } assert.ok(stun, '바위'); }
  // 야로 급소: 2.5배 치명타가 나옴
  {
    const { g } = heroG('yaro', { talents: ['yaro_atk'] });
    const e = spawn(g, 'ash_boar', 6.1, 1.5, { hp: 1e7, root: true });
    const hits = runCollect(g, 20, (x) => x.type === 'hit' && x.targetId === e.id).map((x) => x.amount);
    const lo = Math.min(...hits); const hi = Math.max(...hits);
    assert.ok(Math.abs(hi / lo - 2.5) < 0.05, `야로 ${hi}/${lo}`);
  }
  // 나래 바람 칼날: 밀어냄(밀기 저항이 쌓임)
  { const { g } = heroG('narae', { talents: ['narae_atk'] }); const e = spawn(g, 'mist_rat', 7.5, 1.5, { hp: 1e6, root: true }); run(g, 3); assert.ok(e.pushRes > 0, '나래'); }
  // 토리 독 포자
  { const { g } = heroG('tori', { talents: ['tori_atk'] }); const e = spawn(g, 'ash_boar', 7.2, 1.5, { hp: 1e6, root: true }); run(g, 3); assert.ok(e.st.burns.some((b) => b.key === 'heroPoison'), '토리'); }
  // 별이 큰곰자리: 세 번째 공격에 갈라짐
  {
    const firstSplit = (on) => {
      const { g } = heroG('byeori', { talents: on ? ['byeori_atk'] : [] });
      for (let i = 0; i < 3; i++) spawn(g, 'ash_boar', 7.5 + i * 0.5, 1.5, { hp: 1e7, root: true });
      const atk = runCollect(g, 12, (x) => x.type === 'heroAttack');
      return atk.findIndex((x) => x.split) + 1;
    };
    assert.strictEqual(firstSplit(true), 3); assert.strictEqual(firstSplit(false), 5);
  }
  // 무진 무거운 종소리: 2.5칸 떨어진 적도 피해를 더 받음 (탑 피해 비교)
  {
    const tw = (on) => {
      const { g, h } = heroG('mujin', { talents: on ? ['mujin_atk'] : [], at: [8.0, 1.5] });
      h.cd = 1e9;
      const t = build(g, 'ember_archer', 5, 2);
      spawn(g, 'ash_boar', 5.5, 1.5, { hp: 1e7, root: true });
      run(g, 6);
      return g.state.stats.damageByTower[t.id];
    };
    assert.ok(tw(true) > tw(false) * 1.1, '무진');
  }
});

test('고유 재능(기술 갈래 끝) 12개가 각각 효과를 냄', () => {
  // 카라 용암 자국
  { const { g } = heroG('kara', { talents: ['kara_sk'] }); cast(g, 6.5, 1.5); assert.ok(g.state.zones.some((z) => z.kind === 'lava'), '카라'); }
  // 세라 새벽의 축복: 탑 공격 속도
  { const { g } = heroG('sera', { talents: ['sera_sk'] }); const t = build(g, 'ember_archer', 5, 2); cast(g, 5.5, 2.5); assert.ok(t.boostUntil > g.state.time, '세라'); }
  // 시오 깊은 얼음: 빙결 +1초
  { const { g, h } = heroG('sio', { talents: ['sio_sk'] }); h.cd = 1e9; const e = spawn(g, 'ash_boar', 8.5, 1.5, { hp: 1e7, root: true }); e.ccUntil = 0; cast(g, 8.5, 1.5); run(g, 1.05); assert.ok(e.ccKind === 'freeze' && e.ccUntil - g.state.time > D.heroes.sio.skill.freeze + 0.8, '시오'); }
  // 제나 쌍둥이 드론
  { const { g } = heroG('zena', { talents: ['zena_sk'] }); cast(g, 6.5, 2.5); assert.strictEqual(g.state.units.filter((u) => u.kind === 'drone').length, 2, '제나'); }
  // 바위 가시 벽: 붙잡힌 적이 피해
  {
    const { g, h } = heroG('bawi', { talents: ['bawi_sk'], at: [13.5, 7.5] });
    h.cd = 1e9;
    const e = spawn(g, 'ash_boar', null, null, { hp: 1e6 });
    cast(g, 3.5, 1.5);
    run(g, 6);
    assert.ok(e.hp < e.maxHp, '바위 벽 피해');
  }
  // 야로 그림자 분신
  { const { g, h } = heroG('yaro', { talents: ['yaro_sk'] }); h.cd = 1e9; const a = spawn(g, 'ash_boar', 7.5, 1.5, { hp: 1e6, root: true }); const b = spawn(g, 'ash_boar', 8.3, 1.5, { hp: 1e6, root: true }); cast(g, 7.5, 1.5, a.id); assert.ok(b.hp < b.maxHp, '야로'); }
  // 하루 눈사람 대가족
  {
    const { g } = heroG('haru', { talents: ['haru_sk'] });
    cast(g, 3.5, 1.5);
    const sn = g.state.units.filter((u) => u.kind === 'snowman');
    assert.strictEqual(sn.length, D.heroes.haru.skill.count + 1, '하루 수');
    const k = g.state.hero ? 1 : 1;
    assert.ok(sn[0].maxHp > D.heroes.haru.skill.snowman.hp * 1.29 * k, '하루 체력');
  }
  // 도한 이웃 담금질
  { const { g } = heroG('dohan', { talents: ['dohan_sk'] }); const a = build(g, 'ember_archer', 5, 2); const b = build(g, 'ember_archer', 6, 2); cast(g, 5.5, 2.5); assert.ok(a.temperUntil > g.state.time && b.temperUntil > g.state.time, '도한'); }
  // 나래 회오리 급강하: 내린 자리 기절
  { const { g, h } = heroG('narae', { talents: ['narae_sk'], at: [1.5, 1.5] }); h.cd = 1e9; const e = spawn(g, 'ash_boar', 10.5, 1.5, { hp: 1e6, root: true }); e.ccUntil = 0; cast(g, 10.5, 1.5); assert.ok(e.ccKind === 'stun', '나래'); }
  // 토리 오래가는 거인 + 포효
  {
    const { g, h } = heroG('tori', { talents: ['tori_sk'] });
    const e = spawn(g, 'ash_boar', 6.2, 1.5, { hp: 1e6, root: true }); e.ccUntil = 0;
    cast(g, h.x, h.y);
    assert.ok(Math.abs(h.giantUntil - g.state.time - (D.heroes.tori.skill.duration + 5)) < 1e-6, '토리 시간');
    assert.strictEqual(e.ccKind, 'stun', '토리 포효');
  }
  // 별이 유성우: 유성 셋
  { const { g, h } = heroG('byeori', { talents: ['byeori_sk'] }); h.cd = 1e9; cast(g, 8.5, 2.5); const m = runCollect(g, 2, (x) => x.type === 'meteor'); assert.strictEqual(m.length, 3, '별이'); }
  // 무진 긴 울림: 멈춤 +1초
  { const { g, h } = heroG('mujin', { talents: ['mujin_sk'] }); h.cd = 1e9; const e = spawn(g, 'ash_boar', 7.5, 1.5, { hp: 1e6 }); e.ccUntil = 0; cast(g, 7.5, 1.5); assert.ok(e.ccKind === 'stop' && Math.abs(e.ccUntil - g.state.time - (D.heroes.mujin.skill.stop + 1)) < 0.05, '무진'); }
});

test('장신구 효과: 화상·감속·튐·처치 재사용·탑 피해 오라·기술 뒤 탑 가속·현상금·회복', () => {
  { const { g } = heroG('kara', { gear: [['ember_ring', 0]] }); const e = spawn(g, 'ash_boar', 6.2, 1.5, { hp: 1e6, root: true }); run(g, 2); assert.ok(e.st.burns.some((b) => b.key === 'heroBurn'), '불씨 반지'); }
  { const { g } = heroG('kara', { gear: [['frost_bead', 0]] }); const e = spawn(g, 'ash_boar', 6.2, 1.5, { hp: 1e6, root: true }); run(g, 1.2); assert.ok(e.st.slowUntil > g.state.time, '서리 구슬'); }
  { const { g } = heroG('sio', { gear: [['storm_gem', 0]] }); spawn(g, 'ash_boar', 9.5, 1.5, { hp: 1e6, root: true }); const n = spawn(g, 'ash_boar', 10.9, 1.5, { hp: 1e6, root: true }); run(g, 4); assert.ok(n.hp < n.maxHp, '폭풍 눈'); }
  {
    const { g, h } = heroG('kara', { gear: [['void_ring', 0]] });
    cast(g, 6.5, 1.5);
    const cd0 = h.skillCd;
    spawn(g, 'mist_rat', 6.2, 1.5, { hp: 1, root: true });
    run(g, 1.5);
    assert.ok(h.skillCd < cd0 - 1.5 - 0.5, `공허 반지 ${h.skillCd} < ${cd0}`);
  }
  {
    const tw = (on) => { const { g, h } = heroG('kara', { gear: on ? [['dawn_circlet', 0]] : [], at: [5.5, 3.2] }); h.cd = 1e9; const t = build(g, 'ember_archer', 5, 2); spawn(g, 'ash_boar', 5.5, 1.5, { hp: 1e7, root: true }); run(g, 6); return g.state.stats.damageByTower[t.id]; };
    assert.ok(tw(true) > tw(false) * 1.05, '새벽 왕관');
  }
  { const { g } = heroG('kara', { gear: [['lantern_shard', 0]], at: [5.5, 3.2] }); const t = build(g, 'ember_archer', 5, 2); cast(g, 6.5, 1.5); assert.ok(t.boostUntil > g.state.time, '등불 조각'); }
  {
    const gold = (on) => { const { g } = heroG('kara', { gear: on ? [['shadow_ribbon', 3]] : [] }); spawn(g, 'ash_boar', 6.2, 1.5, { hp: 1, root: true }); const g0 = g.state.gold; run(g, 1.5); return g.state.gold - g0; };
    assert.ok(gold(true) > gold(false), '그림자 리본');
  }
  { const { g, h } = heroG('kara', { gear: [['moss_cloak', 0]] }); h.hp = h.maxHp * 0.5; run(g, 2); assert.ok(h.hp > h.maxHp * 0.52, '이끼 망토'); }
});

/* =============== 저장 =============== */
test('저장: 인연 경험치와 레벨 업, 재능 찍기·초기화, 장신구 끼기·강화, 판에 넘길 복사본', () => {
  const P = RG.progress;
  P.reset();
  const st = { result: 'win', lives: 20, task: { done: false }, wave: { index: 8 }, hero: { heroId: 'kara' } };
  const r = P.record('1-1', 'normal', st);
  assert.strictEqual(r.bond.gain, 3 + 2 * 3, '승리 3 + 새 별 3×2');
  assert.ok(r.bond.levelUp && r.bond.after === 2);
  assert.strictEqual(P.heroGrowth('kara'), null, '재능·장신구 없으면 넘기지 않음');
  assert.ok(P.takeTalent('kara', 'atk1').ok);
  assert.ok(!P.takeTalent('kara', 'sur1').ok, '점수 1개뿐');
  P.resetTalents('kara');
  assert.ok(P.takeTalent('kara', 'sur1').ok);
  assert.deepStrictEqual(plain(P.heroGrowth('kara')), { level: 2, talents: ['sur1'], gear: [] });
  assert.ok(!P.equipGear('kara', 0, 'ember_ring').ok, '없는 장신구');
  P.get().gear.ember_ring = 0;
  assert.ok(P.equipGear('kara', 0, 'ember_ring').ok);
  assert.ok(P.equipGear('kara', 1, 'ember_ring').ok);
  assert.deepStrictEqual(plain(P.heroRec('kara').gear), [null, 'ember_ring'], '같은 장신구는 한 칸만');
  P.gachaState().crystals = 100;
  assert.ok(P.upgradeGear('ember_ring').ok);
  assert.strictEqual(P.gachaState().crystals, 70);
  assert.deepStrictEqual(plain(P.heroGrowth('kara').gear), [['ember_ring', 1]]);
  P.reset();
});

test('장신구 얻기: 도전 첫 클리어(지역에 맞는 등급) · 무한 기록 10·20·30·40 · 다 가지면 강화 · 다 최대면 공명석', () => {
  const P = RG.progress;
  P.reset();
  const win = { result: 'win', lives: 20, task: { done: false }, wave: { index: 8 } };
  const r1 = P.record('1-2', 'challenge', win);
  assert.strictEqual(r1.gear.length, 1);
  assert.strictEqual(GD.gear[r1.gear[0].id].rarity, 'common');
  assert.strictEqual(P.record('1-2', 'challenge', win).gear.length, 0, '두 번째 클리어는 없음');
  assert.strictEqual(GD.gear[P.record('5-2', 'challenge', win).gear[0].id].rarity, 'epic');
  const re = P.record('E1', 'endless', { result: 'lose', lives: 0, wave: { index: 32 } });
  assert.deepStrictEqual(plain(re.gear).map((g) => GD.gear[g.id].rarity), ['common', 'rare', 'epic'], '10·20·30');
  assert.strictEqual(P.record('E1', 'endless', { result: 'lose', lives: 0, wave: { index: 25 } }).gear.length, 0, '기록을 못 넘으면 없음');
  // 일반 6종을 다 가지면 강화 → 다 +3이면 공명석
  for (const id of GD.gearOrder) if (GD.gear[id].rarity === 'common') P.get().gear[id] = 0;
  const up = P.grantGear('common', 'x');
  assert.ok(!up.isNew && up.plus === 1);
  for (const id of GD.gearOrder) if (GD.gear[id].rarity === 'common') P.get().gear[id] = 3;
  const c0 = P.gachaState().crystals;
  assert.strictEqual(P.grantGear('common', 'y').crystals, GD.gearDupCrystals);
  assert.strictEqual(P.gachaState().crystals, c0 + GD.gearDupCrystals);
  P.reset();
});
