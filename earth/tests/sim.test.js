'use strict';

/* 시뮬레이션·데이터 검사: node earth/tests/sim.test.js */
const { loadEarth } = require('./load');

let failures = 0;
let passes = 0;
function check(name, cond, extra) {
  if (cond) { passes++; return; }
  failures++;
  console.log(`✗ ${name}${extra !== undefined ? ` — ${JSON.stringify(extra)}` : ''}`);
}
const near = (a, b, tol) => a !== undefined && Math.abs(a - b) <= tol;

const EC = loadEarth();
const { sim, time, util: U, q: Q, plates, data: D } = EC;

/* ---------- 시간 눈금 ---------- */
let prev = -Infinity;
let mono = true;
let maxErr = 0;
for (let i = 0; i <= 2000; i++) {
  const s = i / 2000;
  const t = time.fromS(s);
  if (t <= prev - 1e-9) mono = false;
  prev = t;
  maxErr = Math.max(maxErr, Math.abs(time.toS(t) - s));
}
check('timeline fromS monotonic', mono);
check('timeline toS(fromS(s)) == s', maxErr < 1e-6, maxErr);
check('timeline ends', near(time.fromS(0), -4540, 1e-6) && near(time.fromS(1), D.T_END, 1e-6));
check('humans get visible room on timeline', time.toS(-0.012) - time.toS(-0.3) > 0.02);

/* ---------- 한국어 시간 표기 ---------- */
check('formatTime 45억 4천만', U.formatTime(-4540) === '45억 4천만 년 전', U.formatTime(-4540));
check('formatTime 6,600만', U.formatTime(-66) === '6,600만 년 전', U.formatTime(-66));
check('formatTime 30만', U.formatTime(-0.3) === '30만 년 전', U.formatTime(-0.3));
check('formatTime 1만 2천', U.formatTime(-0.012) === '1만 2천 년 전', U.formatTime(-0.012));
check('formatTime 현재', U.formatTime(0) === '현재');
check('formatTime 미래', U.formatTime(1000) === '10억 년 후', U.formatTime(1000));
check('formatTime 76억', U.formatTime(7600) === '76억 년 후', U.formatTime(7600));

/* ---------- 데이터 ---------- */
for (const e of D.staticEvents) check(`static event ${e.id} in range`, e.t >= D.T_START && e.t <= D.T_END);
for (const [k, tab] of Object.entries(D.climate)) {
  if (!Array.isArray(tab) || !Array.isArray(tab[0])) continue;
  let ok = true;
  for (let i = 1; i < tab.length; i++) if (tab[i][0] < tab[i - 1][0]) ok = false;
  check(`climate table ${k} sorted`, ok);
}
for (const [pl, keys] of Object.entries(D.plateKeys)) {
  let ok = true;
  for (let i = 1; i < keys.length; i++) if (keys[i].t <= keys[i - 1].t) ok = false;
  check(`plate keys ${pl} strictly increasing`, ok);
}

/* ---------- 판: 현재 위치는 그대로, 움직임은 끊기지 않음 ---------- */
const rot0 = plates.layerRotations(0);
check('plates at present are identity', rot0.every((r) => Q.angleBetween(r, Q.IDENTITY) < 1e-6));
let maxJump = 0;
let jumpAt = null;
let last = plates.layerRotations(-4540);
for (let t = -4539; t <= 7600; t += 1) {
  const r = plates.layerRotations(t);
  r.forEach((x, i) => { const a = Q.angleBetween(x, last[i]); if (a > maxJump) { maxJump = a; jumpAt = [t, D.layers[i].id]; } });
  last = r;
}
check('plates move smoothly (< 1.5°/Myr)', maxJump < 1.5, { maxJump, jumpAt });
const yuc = plates.pointAt('NA', 21.3, -89.5, 0);
check('pointAt present', Q.angleBetween([0, 0, 0, 1], [0, 0, 0, 1]) === 0 && near(Q.latLon(yuc)[0], 21.3, 1e-6));

/* ---------- 실제 역사 ---------- */
const base = sim.run([], new Set());
const ft = sim.firstTimes(base);
check('life ~3.8 Ga', near(ft.life, -3800, 1e-6), ft.life);
check('GOE ~2.4 Ga', near(ft.goe, -2440, 30), ft.goe);
check('eukaryotes', near(ft.eukaryote, -1800, 1e-6));
check('cambrian explosion', near(ft.animals, -538.8, 1e-6));
check('tetrapods', near(ft.tetrapods, -375, 1e-6));
check('archosaurs after P-T', near(ft.dynArchosaur, -252, 1e-6), ft.dynArchosaur);
check('dinosaurs appear', near(ft.dinosaurs, -231, 1e-6), ft.dinosaurs);
check('mammals take over at K-Pg', near(ft.dynMammal, -66, 1e-6), ft.dynMammal);
check('Homo sapiens ~300 ka', near(ft.humans, -0.3, 1e-6), ft.humans);
check('civilisation ~12 ka', near(ft.civ, -0.012, 1e-6), ft.civ);
check('plants decline ~ +600 Myr', near(ft.plantsDecline, 600, 30), ft.plantsDecline);
check('complex life ends ~ +0.9 Gyr', near(ft.complexEnd, 900, 120), ft.complexEnd);
check('last life ~ +2.7 Gyr', near(ft.lifeEnd, 2750, 150), ft.lifeEnd);
check('no snowball in baseline from model', !base.events.some((e) => e.id === 'snowball'));

const now = sim.stateAt(base, 0);
check('present T', near(now.T, 15.2, 0.05), now.T);
check('present CO2', near(now.co2, 425, 1), now.co2);
check('present O2', near(now.O2, 20.95, 0.5), now.O2);
check('present biodiversity ~100', near(now.B, 100, 5), now.B);
check('present: humans & civ', now.humans && now.civ && now.dynasty === 'mammal');
check('present moon distance', near(now.moonKm, 384400, 1));
check('present ice latitude', now.iceLat > 60 && now.iceLat < 70, now.iceLat);
const lgm = sim.stateAt(base, -0.021);
check('LGM colder', lgm.T < 9.5 && lgm.T > 7, lgm.T);
check('LGM CO2 low', lgm.co2 < 200, lgm.co2);
check('LGM sea level low', lgm.seaLevel < -100, lgm.seaLevel);
const snow = sim.stateAt(base, -700);
check('Cryogenian snowball', snow.snow && snow.iceLat === 0);
const young = sim.stateAt(base, -4540);
check('young sun faint (~70%)', near(young.sunLum, 0.716, 0.01), young.sunLum);
check('no moon before Theia', young.moonKm === 0);
const dino = sim.stateAt(base, -100);
check('Cretaceous: archosaurs rule, no humans', dino.dynasty === 'archosaur' && !dino.humans);

/* ---------- 바뀐 역사 ---------- */
const noKpg = sim.run([], new Set(['kpg']));
const ftK = sim.firstTimes(noKpg);
const nowK = sim.stateAt(noKpg, 0);
check('prevent K-Pg → dinosaurs still rule', nowK.dynasty === 'archosaur', nowK.dynasty);
check('prevent K-Pg → no humans', ftK.humans === undefined && !nowK.humans);

const early = sim.run([{ id: 'a', t: -160, type: 'impact10' }], new Set());
const ftE = sim.firstTimes(early);
check('10 km impact at 160 Ma → mammals early', near(ftE.dynMammal, -160, 1e-6), ftE.dynMammal);
check('… humans ~94 Ma', near(ftE.humans, -94.3, 0.01), ftE.humans);
check('… no birds (dinosaurs gone before birds)', ftE.birds === undefined, ftE.birds);

const steril = sim.run([{ id: 'b', t: -100, type: 'impact500' }], new Set());
const ftS = sim.firstTimes(steril);
const nowS = sim.stateAt(steril, 0);
check('500 km impact → sterilized', steril.events.some((e) => e.id === 'sterilized' && near(e.t, -100, 1e-6)));
check('… life restarts', steril.events.some((e) => e.id === 'lifeAgain' && near(e.t, 50, 1e-6)));
check('… no humans ever', ftS.humans === undefined);
check('… only microbes now', !nowS.alive || nowS.stage <= sim.S.microbe, nowS.stageName);

const giant = sim.run([{ id: 'c', t: -30, type: 'impact100' }], new Set());
const nowG = sim.stateAt(giant, 0);
check('100 km impact → complex life wiped', giant.events.some((e) => e.id === 'complexWiped'));
check('… back to simple life at present', nowG.stage <= sim.S.multicell && !nowG.humans, nowG.stageName);

const cold = sim.run([{ id: 'd', t: -0.05, type: 'co2down' }], new Set());
const snowEv = cold.events.find((e) => e.id === 'snowball');
const endEv = cold.events.find((e) => e.id === 'snowballEnd');
check('CO2 ÷3 during ice age → snowball', !!snowEv, cold.events.map((e) => e.id).slice(-6));
check('… snowball ends after millions of years', endEv && endEv.t - snowEv.t > 5 && endEv.t - snowEv.t < 30, endEv && endEv.t);
check('… frozen at present', sim.stateAt(cold, 0).snow && sim.stateAt(cold, 0).T <= -40);

const hot = sim.run([{ id: 'e', t: -10, type: 'co2up' }], new Set());
const h = sim.stateAt(hot, -9.9);
check('CO2 ×3 warms ~6°C', near(h.T - h.Tbase, 6.3, 0.5), h.T - h.Tbase);
check('… effect fades', Math.abs(sim.stateAt(hot, 0).T - sim.stateAt(base, 0).T) < 0.5);

const cook = sim.run([1, 2, 3, 4, 5, 6].map((i) => ({ id: 'v' + i, t: -5, type: 'co2up' })), new Set());
const c5 = sim.stateAt(cook, -4.99);
check('stacked CO2 → too hot for complex life', c5.T > 48 && cook.events.some((e) => e.id === 'complexEnd'), c5.T);

const noPT = sim.run([], new Set(['permian']));
const ftP = sim.firstTimes(noPT);
check('prevent P-T → archosaurs only after T-J', near(ftP.dynArchosaur, -201.4, 1e-6), ftP.dynArchosaur);
const ptT = sim.stateAt(noPT, -251.9).T;
check('prevent P-T → no extreme heat spike', ptT < 28, ptT);

/* 같은 입력 → 같은 결과 */
const again = sim.run([{ id: 'a', t: -160, type: 'impact10' }], new Set());
check('deterministic', JSON.stringify(again.events) === JSON.stringify(early.events));

const t0 = Date.now();
for (let i = 0; i < 5; i++) sim.run([{ id: 'x', t: -200 + i, type: 'volcano' }], new Set(['kpg']));
const ms = (Date.now() - t0) / 5;
check('run is fast enough for interactive use (< 120 ms)', ms < 120, ms);

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
