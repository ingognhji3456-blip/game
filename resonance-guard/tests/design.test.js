'use strict';

/* 설계서와 데이터 일치 — QUALITY.md §2 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { loadGame, ROOT } = require('./load');

const { RG } = loadGame();
const D = RG.data;
const doc = (f) => fs.readFileSync(path.join(ROOT, 'docs', f), 'utf8');

test('탑 설계서 ↔ 데이터: 32종, 이름·id·원소·해금', () => {
  const md = doc('design/towers.md');
  const heads = [...md.matchAll(/^### [A-Z]\d · (.+?) `([a-z_]+)`$/gm)].map((m) => ({ name: m[1], id: m[2] }));
  assert.strictEqual(heads.length, 32, `설계서 탑 수 ${heads.length}`);
  assert.strictEqual(Object.keys(D.towers).length, 32);
  for (const h of heads) {
    const t = D.towers[h.id];
    assert.ok(t, `데이터에 없음: ${h.id}`);
    assert.strictEqual(t.name, h.name, `${h.id} 이름`);
  }
  const elName = { 불: 'fire', 얼음: 'frost', 폭풍: 'storm', 대지: 'earth', 빛: 'light', 어둠: 'dark' };
  for (const m of md.matchAll(/^\| [A-Z]\d \| (\S+) \| (.+?) \| `([a-z_]+)` \| .+? \| .+? \| (\d-\d) \|$/gm)) {
    const t = D.towers[m[3]];
    assert.ok(t, m[3]);
    assert.strictEqual(t.element, elName[m[1]], `${m[3]} 원소`);
    assert.strictEqual(t.name, m[2], `${m[3]} 표 이름`);
    assert.strictEqual(t.unlock, m[4], `${m[3]} 해금`);
  }
  for (const id of Object.keys(D.towers)) for (const b of ['A', 'B']) assert.ok(md.includes(`\`${D.towers[id].branches[b].id}\``), `분기 id ${D.towers[id].branches[b].id}`);
});

test('적 설계서 ↔ 데이터: 55종, 이름·id', () => {
  const md = doc('design/enemies.md');
  const heads = [...md.matchAll(/^### (?:\d\d|👑 [^·]+) · (.+?) `([a-z_]+)`$/gm)].map((m) => ({ name: m[1], id: m[2] }));
  assert.strictEqual(heads.length, 55, `설계서 적 수 ${heads.length}`);
  assert.strictEqual(Object.keys(D.enemies).length, 55);
  for (const h of heads) {
    assert.ok(D.enemies[h.id], `데이터에 없음: ${h.id}`);
    assert.strictEqual(D.enemies[h.id].name, h.name, `${h.id} 이름`);
  }
});

test('영웅 설계서 ↔ 데이터: 이름·원소·대사', () => {
  const md = doc('design/heroes.md');
  for (const id of D.heroOrder) {
    const h = D.heroes[id];
    const sec = md.split(/^## /m).find((s) => s.split('\n')[0].includes(`\`${id}\``));
    assert.ok(sec, `${id} 절 없음`);
    assert.ok(sec.split('\n')[0].includes(`${h.name} \`${id}\``), `${id} 이름`);
    const map = { select: '선택', move: '이동', skill: '기술', down: '쓰러짐', revive: '부활', win: '승리' };
    for (const [k, label] of Object.entries(map)) {
      const row = sec.split('\n').find((l) => l.startsWith(`| ${label} |`));
      assert.ok(row, `${id} ${label} 대사 줄`);
      const quotes = [...row.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
      assert.deepStrictEqual(quotes, JSON.parse(JSON.stringify(h.lines[k])), `${id} ${label} 대사 불일치`);
    }
  }
});

test('이야기 장면 id: 데이터의 장면은 모두 설계서 목록에 있음, 맵이 가리키는 장면은 모두 존재', () => {
  const md = doc('design/story.md');
  for (const id of Object.keys(D.story)) assert.ok(md.includes(`\`${id}\``), `story.md에 없음: ${id}`);
  for (const m of D.maps) for (const k of ['before', 'after']) if (m.story && m.story[k]) assert.ok(D.story[m.story[k]], `${m.id} ${k} 장면 없음: ${m.story[k]}`);
});

test('맵 설계서 ↔ 데이터: 정의된 맵의 이름·과제·도전', () => {
  const md = doc('design/maps.md');
  for (const m of D.maps) {
    const row = md.split('\n').find((l) => l.startsWith(`| ${m.id} | ${m.name} |`));
    assert.ok(row, `${m.id} ${m.name} 행 없음`);
    if (m.task) assert.ok(row.includes(m.task.text), `${m.id} 과제 문구 "${m.task.text}"`);
  }
});

test('설계서 AUTO 표가 최신 (node tools/gen-docs.js)', () => {
  execFileSync(process.execPath, [path.join(ROOT, 'tools', 'gen-docs.js'), '--check'], { stdio: 'pipe' });
});
