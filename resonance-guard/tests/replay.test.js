'use strict';

/* 이어하기 재현을 나눠서 (RG.sim.replayer, js/ui/game.js 이어하기) — 한 번에 하는 replay와 상태가 바이트까지 같음 */
const assert = require('assert');
const { loadGame } = require('./load');
const { makeEnv } = require('./bots');

const fresh = () => { const L = loadGame(); L.RG.progress.load(); return L; };

/**
 * 같은 기록을 replay(한 번에)와 replayer(여러 가지로 나눠서)로 재현해 비교:
 * 해시, 상태 전체(JSON 문자열), 명령 기록, 그리고 숨은 상태(난수 등)까지 보려고 그 뒤로 더 돌린 상태
 */
function sameAsReplay(RG, opts, log, until, label) {
  const ref = RG.sim.replay(opts, log, until);
  const refState = JSON.stringify(ref.state);
  const refLog = JSON.stringify(ref.log);
  const irregular = [1, 7, 64, 3, 250, 2, 33, 1000, 5];
  const ways = {
    '1틱씩(시간 예산 0)': (r) => r.step(0),
    '들쭉날쭉한 틱 수': (r, i) => r.step(Infinity, irregular[i % irregular.length]),
    '시간 예산 0.3ms': (r) => r.step(0.3),
  };
  for (const [name, stepOnce] of Object.entries(ways)) {
    const r = RG.sim.replayer(opts, log, until);
    assert.strictEqual(r.progress, 0, `${label} ${name}: 처음 진행률 0`);
    let prev = 0;
    let calls = 0;
    while (!stepOnce(r, calls++)) {
      assert.ok(!r.done, `${label} ${name}: 끝나기 전엔 done 아님`);
      assert.ok(r.progress >= prev && r.progress < 1, `${label} ${name}: 진행률은 늘기만 하고 1 미만 (${prev} → ${r.progress})`);
      prev = r.progress;
    }
    assert.ok(r.done && r.progress === 1, `${label} ${name}: 끝`);
    assert.ok(calls > 1, `${label} ${name}: 실제로 나눠짐 (${calls}번)`);
    assert.strictEqual(r.step(5), true, '끝난 뒤 step은 아무것도 안 하고 true');
    assert.strictEqual(r.game.state.tick, ref.state.tick, `${label} ${name}: 틱`);
    assert.strictEqual(r.game.hash(), ref.hash(), `${label} ${name}: 해시`);
    assert.strictEqual(JSON.stringify(r.game.state), refState, `${label} ${name}: 상태 전체`);
    assert.strictEqual(JSON.stringify(r.game.log), refLog, `${label} ${name}: 명령 기록`);
  }
  // 이어서 더 돌려도 같음 (난수·쿨다운처럼 상태 JSON에 안 보이는 것까지)
  const again = RG.sim.replayer(opts, log, until);
  while (!again.step(Infinity, 97));
  for (let i = 0; i < 900 && !ref.state.result; i++) { ref.step(); again.game.step(); }
  assert.strictEqual(again.game.hash(), ref.hash(), `${label}: 이어서 900틱 뒤 해시`);
  assert.strictEqual(JSON.stringify(again.game.state), JSON.stringify(ref.state), `${label}: 이어서 900틱 뒤 상태`);
  return ref;
}

test('나눠서 재현 = 한 번에 재현: 긴 공명석 웨이브 판 (봇, 20웨이브 끝 무렵)', () => {
  const { RG } = fresh();
  const env = makeEnv(RG);
  const towers = ['ember_archer', 'frost_crystal', 'stone_barracks', 'flame_mortar', 'storm_spire', 'sun_lens'].filter((t) => RG.data.towers[t]);
  const opts = Object.assign({ mode: 'normal', seed: 12345, heroId: 'kara', towers, finalLv2: true, shardStart: true, branches: true }, RG.crystal.setup(1));
  const run = env.run(opts, 'greedy');
  const end = run.game.state.tick;
  assert.ok(end > 10000, `긴 판 (${end}틱)`);
  // 이어하기 저장처럼: 끝나기 조금 전, 그 틱까지의 명령만
  const until = end - 60;
  const log = run.log.filter((x) => x[0] <= until);
  const ref = sameAsReplay(RG, opts, log, until, '공명석');
  assert.strictEqual(ref.state.result, 'win', '이어서 돌리면 봇 판처럼 이김');
});

test('나눠서 재현 = 한 번에 재현 = 실제로 둔 판: 캠페인 판 (봇, 결과가 난 틱까지)', () => {
  const { RG } = fresh();
  const env = makeEnv(RG);
  const opts = { mapId: '3-2', mode: 'normal', seed: 9, heroId: 'sera', branches: true, towers: RG.progress.towersFor('3-2') };
  const run = env.run(opts, 'greedy');
  const end = run.game.state.tick;
  assert.ok(run.game.state.result === 'win' && end > 5000, `${run.game.state.result} ${end}틱`);
  // 결과가 난 틱까지: 재현도 결과에서 멈춤
  const ref = sameAsReplay(RG, Object.assign({ mode: 'normal', seed: 1, heroId: null }, opts), run.log, end + 500, '캠페인');
  assert.strictEqual(ref.state.tick, end, '결과가 나면 거기서 멈춤');
  assert.strictEqual(ref.hash(), run.game.hash(), '실제로 둔 판과 같은 해시');
  assert.strictEqual(JSON.stringify(ref.state), JSON.stringify(run.game.state), '실제로 둔 판과 같은 상태');
  // 중간 틱에서도
  sameAsReplay(RG, Object.assign({ mode: 'normal', seed: 1, heroId: null }, opts), run.log, Math.floor(end / 2), '캠페인 중간');
});

test('나눠서 재현: 빈 기록·0틱·이미 끝난 판도 바로 끝남', () => {
  const { RG } = fresh();
  const opts = { mapId: '1-1', mode: 'normal', seed: 3, heroId: 'kara' };
  const a = RG.sim.replayer(opts, [], 0);
  assert.strictEqual(a.step(10), true);
  assert.strictEqual(a.progress, 1);
  assert.strictEqual(a.game.hash(), RG.sim.replay(opts, [], 0).hash());
  // 0틱 명령(시작 전에 지은 탑)도 0틱에서 적용
  const log = [[0, { type: 'build', tower: 'ember_archer', c: 4, r: 2 }]];
  const b = RG.sim.replayer(opts, log, 0);
  b.step(10);
  assert.strictEqual(b.game.state.towers.length, RG.sim.replay(opts, log, 0).state.towers.length);
  assert.strictEqual(b.game.state.towers.length, 1);
});
