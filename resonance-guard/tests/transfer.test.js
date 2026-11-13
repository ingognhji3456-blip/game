'use strict';

/* 진행 상황 옮기기 — js/core/transfer.js (저장 코드·파일로 내보내고 가져오기) */
const assert = require('assert');
const { loadGame } = require('./load');

const fresh = () => { const L = loadGame(); L.RG.progress.load(); return L; };
const winRec = (lives = 12) => ({ result: 'win', lives, task: { done: true }, wave: { index: 8 } });

/** 진행이 조금 쌓인 기기 */
function played() {
  const L = fresh();
  const P = L.RG.progress;
  for (const id of ['1-1', '1-2', '1-3']) P.record(id, 'normal', winRec());
  P.gachaState().crystals = 4321;
  P.get().shards.ember_archer = 7;
  P.get().shardLv.ember_archer = 2;
  P.save();
  return L;
}

test('내보낸 코드를 다른 기기에서 가져오면 진행이 그대로 (별·공명석·조각)', async () => {
  const A = played();
  const code = await A.RG.transfer.encode();
  assert.ok(/^RG1z?\./.test(code), code.slice(0, 8));
  const B = fresh();
  assert.ok(!B.RG.progress.hasSave());
  const obj = await B.RG.transfer.decode(code);
  const s = B.RG.transfer.summary(obj);
  assert.strictEqual(s.cleared, 3);
  assert.strictEqual(s.stars, A.RG.progress.starsTotal());
  assert.strictEqual(s.crystals, 4321);
  assert.strictEqual(s.shardTowers, 1);
  assert.ok(B.RG.transfer.apply(obj).ok);
  const P = B.RG.progress;
  assert.ok(P.hasSave());
  assert.strictEqual(P.starsTotal(), A.RG.progress.starsTotal());
  assert.strictEqual(P.gachaState().crystals, 4321);
  assert.strictEqual(P.shardsOf('ember_archer'), 7);
  assert.strictEqual(P.shardLvOf('ember_archer'), 2);
  assert.strictEqual(JSON.stringify(P.get()), JSON.stringify(A.RG.progress.get()), '진행 전체가 같음');
  // 다시 불러와도 그대로 (저장됨)
  P.load();
  assert.strictEqual(P.gachaState().crystals, 4321);
});

test('압축 코드가 압축 안 한 것보다 짧음, 줄바꿈·공백이 섞여도 읽힘, JSON 그대로도 읽힘', async () => {
  const A = played();
  const T = A.RG.transfer;
  const code = await T.encode();
  assert.ok(code.startsWith('RG1z.'), 'Node에도 CompressionStream이 있으면 압축');
  const plain = 'RG1.' + Buffer.from(JSON.stringify(T.bundle())).toString('base64url');
  assert.ok(code.length < plain.length * 0.6, `압축 ${code.length} < ${plain.length}`);
  const messy = `  ${code.slice(0, 40)}\n${code.slice(40, 90)} \r\n${code.slice(90)}  `;
  assert.strictEqual((await T.decode(messy)).progress.gacha.crystals, 4321);
  assert.strictEqual((await T.decode(plain)).progress.gacha.crystals, 4321, '압축 안 한 코드');
  assert.strictEqual((await T.decode(JSON.stringify(T.bundle()))).progress.gacha.crystals, 4321, 'JSON 그대로');
});

test('잘린 코드·다른 글·다른 게임·새 버전은 알아들을 수 있는 말로 거절, 진행은 그대로', async () => {
  const A = played();
  const T = A.RG.transfer;
  const code = await T.encode();
  const reject = async (text, re) => {
    let err = null;
    try { await T.decode(text); } catch (e) { err = e; }
    assert.ok(err, `거절해야 함: ${String(text).slice(0, 20)}`);
    assert.ok(re.test(err.message), err.message);
  };
  await reject('', /비어/);
  await reject(code.slice(0, Math.floor(code.length / 2)), /잘렸거나/);
  await reject('안녕하세요', /저장 코드가 아닙니다/);
  await reject(JSON.stringify({ game: 'other', kind: 'save', v: 1, progress: {} }), /아닙니다/);
  await reject(JSON.stringify({ game: 'resonance-guard', kind: 'save', v: 2, progress: { v: 1, maps: {} } }), /새로운 버전/);
  await reject(JSON.stringify({ game: 'resonance-guard', kind: 'save', v: 1, progress: { v: 1, maps: [] } }), /망가/);
  assert.ok(!T.apply({ game: 'x' }).ok);
  assert.strictEqual(A.RG.progress.gachaState().crystals, 4321, '거절해도 진행은 그대로');
});

test('가져오면 이어하기 판은 지움 (다른 진행의 판), 예전 형식의 진행도 새 칸이 채워짐', async () => {
  const B = fresh();
  B.RG.save.set(B.RG.save.KEYS.run, { mapId: '1-1', opts: { mode: 'normal' }, log: [], tick: 10 });
  const old = { game: 'resonance-guard', kind: 'save', v: 1, progress: { v: 1, maps: { '1-1': { cleared: true, stars: 3 } }, skills: [], seen: { enemies: [], story: [], tips: [] }, endless: {} } };
  assert.ok(B.RG.transfer.apply(old).ok);
  assert.strictEqual(B.RG.save.get(B.RG.save.KEYS.run, null), null);
  const P = B.RG.progress;
  assert.strictEqual(P.mapStars('1-1'), 3);
  assert.ok(P.gachaState().owned.ember_archer === 0, '뽑기 칸이 채워짐');
  assert.strictEqual(P.shardsOf('ember_archer'), 0, '조각 칸이 채워짐');
});

test('설정(음량 등)은 옮기지 않음, 파일 이름', () => {
  const A = played();
  A.RG.save.set(A.RG.save.KEYS.settings, { master: 0.1 });
  const b = A.RG.transfer.bundle();
  assert.ok(!('settings' in b) && !JSON.stringify(b).includes('"master"'));
  assert.strictEqual(A.RG.transfer.fileName(new Date(2026, 10, 3)), 'resonance-guard-save-2026-11-03.txt');
});
