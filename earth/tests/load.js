'use strict';

/* 브라우저용 스크립트(데이터·시뮬레이션)를 Node vm 안에 불러오는 도우미 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const FILES = [
  'js/core/util.js', 'js/core/quat.js', 'js/core/noise.js',
  'js/data/timescale.js', 'js/data/continents.js', 'js/data/plates.js', 'js/data/climate.js', 'js/data/events.js',
  'js/sim/plates.js', 'js/sim/model.js', 'js/render/look.js',
  'js/field/terrain.js', 'js/field/species.js', 'js/field/scene.js',
];

function loadEarth() {
  const sandbox = { console, Math, JSON, Date, Object, Array, Number, String, Set, Map, Intl, Infinity, isFinite, performance };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  for (const file of FILES) vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), sandbox, { filename: file });
  return sandbox.EC;
}

module.exports = { loadEarth, FILES };
