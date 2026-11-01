'use strict';

/* 브라우저용 스크립트(util/data/core)를 Node vm 안에 불러오는 도우미 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const FILES = [
  'js/util.js',
  'js/data/keywords.js', 'js/data/cards.js', 'js/data/enemies.js',
  'js/data/relics.js', 'js/data/potions.js', 'js/data/events.js',
  'js/core/combat.js', 'js/core/run.js', 'js/core/save.js',
];

function loadGame({ quiet = true } = {}) {
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
    structuredClone: global.structuredClone,
    Math, JSON, Date, Object, Array, Number, String, Set, Map, Promise, setTimeout,
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  for (const file of FILES) {
    const code = fs.readFileSync(path.join(ROOT, file), 'utf8');
    vm.runInContext(code, sandbox, { filename: file });
  }
  return { CB: sandbox.CB, warnings, store };
}

module.exports = { loadGame };
