'use strict';

/* 브라우저용 스크립트(core/data)를 Node vm 안에 불러오는 도우미 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const FILES = [
  'js/core/util.js', 'js/data/assets.js',
  'js/data/weapons.js', 'js/data/skills.js', 'js/data/modules.js', 'js/data/enemies.js',
  'js/data/bosses.js', 'js/data/chapters.js', 'js/data/story.js',
  'js/core/save.js', 'js/core/progress.js', 'js/core/battle.js', 'js/core/player.js', 'js/core/ai.js',
  'js/audio/audio.js',
];

function loadGame({ quiet = true, skip = [] } = {}) {
  const store = new Map();
  const errors = [];
  const sandbox = {
    console: {
      log: (...a) => { if (!quiet) console.log(...a); },
      warn: (...a) => { errors.push(a.map(String).join(' ')); },
      error: (...a) => { errors.push(a.map((x) => (x && x.stack) || String(x)).join(' ')); },
    },
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    },
    Math, JSON, Date, Object, Array, Number, String, Set, Map, Promise, setTimeout, clearTimeout,
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  for (const file of FILES) {
    if (skip.includes(file)) continue;
    const full = path.join(ROOT, file);
    if (!fs.existsSync(full)) continue;
    vm.runInContext(fs.readFileSync(full, 'utf8'), sandbox, { filename: file });
  }
  return { AZ: sandbox.AZ, errors, store };
}

module.exports = { loadGame, FILES };
