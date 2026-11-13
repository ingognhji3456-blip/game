'use strict';

/* 모든 tests/*.test.js 를 실행합니다.  node tests/run.js [이름 일부] */
const fs = require('fs');
const path = require('path');

const filter = process.argv[2] || '';
const files = fs.readdirSync(__dirname).filter((f) => f.endsWith('.test.js') && f.includes(filter)).sort();
let pass = 0;
let fail = 0;
const failures = [];

global.test = (name, fn) => { global.__tests.push({ name, fn }); };

(async () => {
  for (const f of files) {
    global.__tests = [];
    require(path.join(__dirname, f));
    for (const t of global.__tests) {
      try {
        await t.fn(); // 비동기 테스트(진행 옮기기의 압축)도 기다림
        pass += 1;
      } catch (e) {
        fail += 1;
        failures.push(`${f} › ${t.name}\n    ${e && e.stack ? e.stack.split('\n').slice(0, 3).join('\n    ') : e}`);
      }
    }
  }
  for (const m of failures) console.log(`✗ ${m}`);
  console.log(`\n${pass}개 통과, ${fail}개 실패 (${files.join(', ')})`);
  process.exitCode = fail ? 1 : 0;
})();
