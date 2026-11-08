'use strict';

/* 지상 장면 도감 검사: node earth/tests/field.test.js */
const { loadEarth } = require('./load');

let failures = 0;
let passes = 0;
function check(name, cond, extra) {
  if (cond) { passes++; return; }
  failures++;
  console.log(`✗ ${name}${extra !== undefined ? ` — ${JSON.stringify(extra)}` : ''}`);
}

const EC = loadEarth();
const F = EC.field;
const S = EC.sim.S;

/* 시뮬레이션 상태로 장면 조건 만들기 (지점 정보는 가짜) */
function envAt(run, t, opts) {
  const st = EC.sim.stateAt(run, t);
  const look = EC.look.build(st, run, t);
  const info = Object.assign({ lat: 10, lon: 20, land: true, coast: 0.3, inland: 0.3, mtn: 0.1, depth: 0, tempLocal: 22, moist: 0.5, landIce: 0, seaIce: 0, seaDir: [1, 0], coastKm: 500, lava: look.uLava, heat: look.uHeat, veg: look.uVeg, layer: 2 }, opts.info || {});
  const bio = opts.bio || EC.surface_biome(info, st);
  const P = { uCoast: opts.coast ? 1 : 0, uDepth: opts.depth || 0 };
  return F.makeEnv(info, bio, st, look, run, t, P, [0.3, 0.6, 0.7], [0, -1, 0]);
}
EC.surface_biome = (info) => (info.land ? { id: 'forest', name: '온대림', habitat: 'land' } : { id: 'shelf', name: '얕은 바다', habitat: 'sea' });
const ids = (env) => F.available(env).map((s) => s.id);

const base = EC.sim.run([], new Set());

/* 데이터 */
const seen = new Set();
for (const sp of F.SPECIES) {
  check(`species ${sp.id} unique`, !seen.has(sp.id));
  seen.add(sp.id);
  check(`species ${sp.id} has name/info`, sp.name && sp.info && sp.info.length > 30);
  check(`species ${sp.id} kind`, sp.kind === 'life' || sp.kind === 'thing');
  check(`species ${sp.id} sizes`, sp.size[0] <= sp.size[1] && sp.count[0] <= sp.count[1]);
}
for (const f of F.FEATURES) check(`feature ${f.id} has info`, f.name && f.info && f.info.length > 30);

/* 시대별 등장 */
const savanna = envAt(base, 0, { bio: { id: 'savanna', name: '사바나', habitat: 'land' }, info: { tempLocal: 26, moist: 0.4 } });
const sv = ids(savanna);
check('present savanna: humans', sv.includes('human'), sv);
check('present savanna: grass', sv.includes('grass'), sv);
check('present savanna: city (modern)', sv.includes('city'), sv);
check('present savanna: no dinosaurs', !sv.includes('theropod') && !sv.includes('sauropod'), sv);
check('present: no trilobites', !sv.includes('trilobite'));

const cret = ids(envAt(base, -100, { info: { tempLocal: 24, moist: 0.6 } }));
check('Cretaceous: theropod & sauropod', cret.includes('theropod') && cret.includes('sauropod'), cret);
check('Cretaceous: pterosaur & bird', cret.includes('pterosaur') && cret.includes('bird'), cret);
check('Cretaceous: no humans, no grass, no deer', !cret.includes('human') && !cret.includes('grass') && !cret.includes('deer'), cret);
check('Cretaceous: broadleaf trees (flowering plants)', cret.includes('broadleaf'), cret);
const lateCret = ids(envAt(base, -68, { info: { tempLocal: 24, moist: 0.6 } }));
check('late Cretaceous: horned dinosaurs', lateCret.includes('ceratops'), lateCret);

const camb = ids(envAt(base, -510, { info: { land: false, depth: 0.1, tempLocal: 24 }, depth: 15 }));
check('Cambrian sea: trilobite & anomalocaris', camb.includes('trilobite') && camb.includes('anomalocaris'), camb);
check('Cambrian sea: no fish yet', !camb.includes('fish'), camb);
const edi = ids(envAt(base, -560, { info: { land: false, depth: 0.1 }, depth: 15 }));
check('Ediacaran sea: dickinsonia & charnia', edi.includes('dickinsonia') && edi.includes('charnia'), edi);
check('Ediacaran sea: no trilobites', !edi.includes('trilobite'), edi);
const jur = ids(envAt(base, -160, { info: { land: false, depth: 0.1, tempLocal: 25 }, depth: 30 }));
check('Jurassic sea: ammonite, plesiosaur, fish', jur.includes('ammonite') && jur.includes('plesiosaur') && jur.includes('fish'), jur);
const now = ids(envAt(base, 0, { info: { land: false, depth: 0.1, tempLocal: 25 }, depth: 30 }));
check('present sea: whale, no ammonite', now.includes('whale') && !now.includes('ammonite'), now);

const carb = ids(envAt(base, -310, { info: { tempLocal: 26, moist: 0.7 } }));
check('Carboniferous: scale trees, dragonfly, amphibian', carb.includes('scaleTree') && carb.includes('dragonfly') && carb.includes('amphibian'), carb);
const perm = ids(envAt(base, -270, { info: { tempLocal: 26, moist: 0.5 } }));
check('Permian: dimetrodon', perm.includes('dimetrodon'), perm);
const sil = ids(envAt(base, -430, { info: { tempLocal: 20, moist: 0.6 } }));
check('Silurian land: early plants only', sil.includes('earlyPlant') && !sil.includes('fern'), sil);

const hadean = envAt(base, -4530, { bio: { id: 'lava', name: '녹은 지표', habitat: 'lava' }, info: { lava: 1 } });
const hd = ids(hadean);
check('Hadean: no life', !F.available(hadean).some((s) => s.kind === 'life'), hd);
check('Hadean: meteors', hd.includes('meteor'), hd);
const arch = ids(envAt(base, -3000, { info: { land: false, depth: 0.05 }, depth: 10 }));
check('Archean shallow sea: stromatolites', arch.includes('stromatolite'), arch);

const ice = ids(envAt(base, -0.02, { info: { tempLocal: 2, moist: 0.5 }, bio: { id: 'tundra', name: '툰드라', habitat: 'land' } }));
check('Ice age tundra: mammoth & humans', ice.includes('mammoth') && ice.includes('human'), ice);

/* 바뀐 역사 */
const noKpg = EC.sim.run([], new Set(['kpg']));
const nk = ids(envAt(noKpg, 0, { info: { tempLocal: 24, moist: 0.6 } }));
check('no K-Pg: dinosaurs today, no humans', nk.includes('theropod') && !nk.includes('human'), nk);
const wiped = EC.sim.run([{ id: 'w', t: -30, type: 'impact100' }], new Set());
const wp = envAt(wiped, -20, { info: { tempLocal: 24, moist: 0.6 } });
check('after 100 km impact: no animals or plants on land', !F.available(wp).some((s) => s.kind === 'life' && s.id !== 'stromatolite'), ids(wp));

/* 모든 그림 함수가 오류 없이 그려지는지 (가짜 캔버스) */
const noop = () => {};
const grad = { addColorStop: noop };
const ctx = new Proxy({}, {
  get: (o, k) => (k === 'createLinearGradient' || k === 'createRadialGradient' ? () => grad : k === 'measureText' ? () => ({ width: 10 }) : noop),
  set: () => true,
});
const rng = EC.util.rng(3);
const anyEnv = Object.assign({}, savanna, { under: false, oxid: 1, lava: false, night: 0.5, tropical: true, biome: 'savanna' });
for (const sp of F.SPECIES) {
  if (!sp.draw) continue;
  const it = { phase: 1, moving: true, size: 1 };
  try {
    if (sp.setup) sp.setup(it, rng, anyEnv);
    sp.draw(ctx, 1.5, it, anyEnv);
    check(`draw ${sp.id}`, true);
  } catch (e) {
    check(`draw ${sp.id}`, false, e.message);
  }
}

/* 지형: 같은 입력이면 같은 높이, 해안 장면은 바다 쪽이 물에 잠김 */
const P = { uSeed: [10, 20], uCoast: 1, uSeaDir: [1, 0], uCoastDist: 300, uHillAmp: 10, uHillFreq: 0.004, uRough: 0.3, uMtnAmp: 300, uMtnNear: 400, uDune: 0, uCanopy: 0, uBaseH: 8 };
check('terrain deterministic', F.terrainH(P, 50, 30, 7) === F.terrainH(P, 50, 30, 7));
check('coast scene: land behind, sea ahead', F.terrainH(P, -200, 0, 6) > 0 && F.terrainH(P, 900, 0, 4) < -5, [F.terrainH(P, -200, 0, 6), F.terrainH(P, 900, 0, 4)]);

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
