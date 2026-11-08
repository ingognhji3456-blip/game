'use strict';

/* 브라우저용 스크립트(데이터·시뮬레이션)를 Node 에서 불러오는 도우미 (그리기·화면 코드는 빼고) */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const FILES = [
  'js/core/util.js', 'js/sim/cosmo.js', 'js/data/epochs.js', 'js/data/events.js', 'js/data/stars.js',
  'js/sim/history.js', 'js/sim/web.js', 'js/sim/galaxy.js', 'js/sim/solar.js', 'js/render/view.js',
];

/* 계산이 무거운 충돌 모형 때문에 격리된 vm 대신 이 프로세스 안에서 실행합니다 */
function loadUniverse(files) {
  global.window = global;
  for (const file of files || FILES) vm.runInThisContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), { filename: file });
  return global.UC;
}

module.exports = { loadUniverse, FILES };
