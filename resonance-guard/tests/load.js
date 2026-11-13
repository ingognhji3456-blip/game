'use strict';

/* 브라우저용 스크립트(util/data/core)를 Node vm 안에 불러오는 도우미 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const FILES = [
  'js/util.js',
  'js/data/elements.js', 'js/data/towers.js', 'js/data/enemies.js', 'js/data/heroes.js', 'js/data/growth.js', 'js/data/maps.js', 'js/data/raid.js',
  'js/data/meta.js', 'js/data/story.js',
  'js/core/grid.js', 'js/core/stats.js', 'js/core/bosses.js', 'js/core/growth.js', 'js/core/raid.js', 'js/core/sim.js', 'js/core/gacha.js', 'js/core/progress.js', 'js/core/save.js',
];

/** 그림 스크립트 (index.html과 같은 순서) */
const ART = [
  'js/art/helpers.js',
  'js/art/towers.js',
  'js/art/towers-a.js',
  'js/art/towers-b.js',
  'js/art/tower-flame_jet.js',
  'js/art/tower-thorn_garden.js',
  'js/art/tower-icicle_cloud.js',
  'js/art/tower-thunder_cloud.js',
  'js/art/tower-lighthouse.js',
  'js/art/tower-dread_bell.js',
  'js/art/tower-phoenix_nest.js',
  'js/art/tower-blizzard_keep.js',
  'js/art/tower-storm_eye.js',
  'js/art/tower-titan_boulder.js',
  'js/art/tower-judgment_spire.js',
  'js/art/tower-soul_reaper.js',
  'js/art/tower-chrono_spire.js',
  'js/art/tower-shadow_dragon.js',
  'js/art/fx-sprites.js',
  'js/art/towers-api.js',
  'js/art/enemies.js',
  'js/art/enemies-r12.js',
  'js/art/enemies-r34.js',
  'js/art/enemies-r5.js',
  'js/art/enemies-r6.js',
  'js/art/enemies-api.js',
  'js/art/heroes.js',
  'js/art/heroes-ext.js',
  'js/art/gear.js',
  'js/art/terrain.js',
  'js/art/icons.js',
  'js/art/scenes.js',
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

module.exports = { ART, loadGame, ROOT };
