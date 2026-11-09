'use strict';

/* 브라우저용 스크립트(util/data/core)를 Node vm 안에 불러오는 도우미 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const FILES = [
  'js/util.js',
  'js/data/elements.js', 'js/data/towers.js', 'js/data/enemies.js', 'js/data/heroes.js', 'js/data/maps.js',
  'js/data/meta.js', 'js/data/story.js',
  'js/core/grid.js', 'js/core/stats.js', 'js/core/bosses.js', 'js/core/sim.js', 'js/core/progress.js', 'js/core/save.js',
];

function loadGame({ quiet = true, extra = [] } = {}) {
  const store = new Map();
  const warnings = [];
  const sandbox = {
    console: {
      log: (...a) => { if (!quiet) console.log(...a); },
      warn: (...a) => { warnings.push(a.map(String).join(' ')); },
      error: (...a) => { warnings.push(a.map(String).join(' ')); },
    },
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    },
    Math, JSON, Date, Object, Array, Number, String, Set, Map, Promise, setTimeout, Float64Array, Uint8Array, Int32Array, Infinity, NaN, isFinite,
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  for (const file of FILES.concat(extra)) {
    const full = path.join(ROOT, file);
    if (!fs.existsSync(full)) continue;
    vm.runInContext(fs.readFileSync(full, 'utf8'), sandbox, { filename: file });
  }
  return { RG: sandbox.RG, warnings, store, sandbox };
}

module.exports = { loadGame, ROOT };
