'use strict';

/* 은하 문명 시뮬레이션 검사: node universe/tests/civ.test.js */
const { loadUniverse } = require('./load');

let failures = 0;
let passes = 0;
function check(name, cond, extra) {
  if (cond) { passes++; return; }
  failures++;
  console.log(`✗ ${name}${extra !== undefined ? ` — ${JSON.stringify(extra)}` : ''}`);
}

const UC = loadUniverse();
const CV = UC.civ;
const N = UC.cosmo.T_NOW;

/* ---------- 별 ---------- */
const sys = CV.systems();
check('별 640개', sys.length === 640, sys.length);
check('0번은 태양계', sys[0].earth && sys[0].name === '태양계');
check('별은 은하의 생명 가능 지대 안', sys.slice(1).every((s) => { const r = Math.hypot(s.pos[0], s.pos[2]); return r >= 7000 && r <= 47000; }));
let minSep = Infinity;
for (let i = 0; i < 200; i++) for (let j = i + 1; j < sys.length; j++) minSep = Math.min(minSep, Math.hypot(sys[i].pos[0] - sys[j].pos[0], sys[i].pos[2] - sys[j].pos[2]));
check('별 사이 최소 650광년', minSep >= 649, minSep);
check('별 이름이 있음', sys.every((s) => s.name && s.name.length >= 2));

/* ---------- 역사 ---------- */
const t0 = Date.now();
const h = CV.simulate({ tau0: N, humans: true });
const ms = Date.now() - t0;
check('계산이 빠름 (1.5초 안)', ms < 1500, ms);
const h2 = CV.simulate({ tau0: N, humans: true });
check('같은 조건이면 같은 역사', h.events.length === h2.events.length && h.events.every((e, i) => e.t === h2.events[i].t && e.type === h2.events[i].type && e.civ === h2.events[i].civ));
check('인류가 지구에서 시작', h.civs[0].human && h.civs[0].home === 0 && CV.ownerAt(h, 0)[0] === 0);
check('문명이 10개 넘게 등장', h.civs.length > 10, h.civs.length);
const types = new Set(h.events.map((e) => e.type));
for (const ty of ['born', 'contact', 'war', 'peace']) check(`사건 "${ty}" 이 일어남`, types.has(ty));
check('기록 길이', h.owners.length === CV.STEPS + 1);
check('시간이 지나면 영역이 넓어짐', [...CV.countAt(h, 20e6).values()].reduce((a, b) => a + b, 0) > [...CV.countAt(h, 0).values()].reduce((a, b) => a + b, 0) * 3);
let consistent = true;
for (const tt of [0, 5e6, 15e6, 30e6, 39.9e6]) {
  for (const [id, n] of CV.countAt(h, tt)) {
    const c = h.civs[id];
    if (n > 0 && (tt < c.born - 1 || (c.end !== null && tt >= c.end + CV.DT))) consistent = false;
  }
}
check('살아 있는 문명만 별을 가짐', consistent);
check('사건이 시간 순서', h.events.every((e, i) => i === 0 || e.t >= h.events[i - 1].t));
const texts = h.events.map((e) => CV.eventText(h, e));
check('모든 사건에 문장', texts.every((t) => t.length > 5));
check('조사가 받침에 맞음 (괄호 조사 없음)', texts.every((t) => !/\(가\)|\(와\)|\(를\)/.test(t)), texts.find((t) => /\(가\)/.test(t)));
check('조사: 인류가 / 인류와', CV.josa('인류', '이', '가') === '인류가' && CV.josa('인류', '과', '와') === '인류와' && CV.josa('연합', '이', '가') === '연합이');
check('이주선 기록', h.ships.length > 100 && h.ships.every((s) => s.t1 > s.t0));
check('전투 기록', h.battles.length > 10);
check('기술 수준은 시간이 지나면 오름', CV.techAt(h, 0, 10e6) > CV.techAt(h, 0, 0));
check('단계 이름', CV.stageOf(1).name === '행성 문명' && CV.stageOf(4).name === '성간 문명');

/* ---------- 과거의 은하: 인류 없음 ---------- */
const hp = CV.simulate({ tau0: N - 6.6e7, humans: false });
check('6,600만 년 전 은하에는 인류가 없음', !hp.civs.some((c) => c.human) && CV.ownerAt(hp, 0)[0] === -1);
check('시작 시점이 다르면 다른 역사', hp.events.length !== h.events.length || hp.civs[1].name !== h.civs[1].name);

/* ---------- 개입 ---------- */
const hs = CV.simulate({ tau0: N - 6.6e7, humans: false, interventions: [{ id: 1, t: 1e6, type: 'seed', sys: 0 }] });
const earthCiv = hs.civs.find((c) => c.home === 0);
check('씨앗: 지구에 문명이 태어남', earthCiv && earthCiv.seeded && earthCiv.born === 1e6);
check('씨앗 이전 역사는 같음', hs.events.filter((e) => e.t < 1e6).length === hp.events.filter((e) => e.t < 1e6).length);
const big = [...CV.countAt(h, 10e6).entries()].sort((a, b) => b[1] - a[1])[0][0];
const hg = CV.simulate({ tau0: N, humans: true, interventions: [{ id: 2, t: 10e6, type: 'gift', civ: big }] });
check('기술 선물: 기술이 3 오름', CV.techAt(hg, big, 10e6 + CV.DT * 10) > CV.techAt(h, big, 10e6 + CV.DT * 10) + 2.5);
const warCiv = h.events.find((e) => e.type === 'war' && e.t > 5e6 && e.t < 30e6);
if (warCiv) {
  const tP = Math.ceil((warCiv.t + 2e5) / CV.DT) * CV.DT;
  const hpz = CV.simulate({ tau0: N, humans: true, interventions: [{ id: 3, t: tP, type: 'peace', civ: warCiv.civ }] });
  const stillWar = CV.relationsAt(hpz, warCiv.civ, tP + 1).war;
  check('평화: 개입 직후 전쟁이 모두 끝남', hpz.civs[warCiv.civ].end !== null && hpz.civs[warCiv.civ].end <= tP ? true : stillWar.length === 0, stillWar);
}
const contactCiv = h.events.find((e) => e.type === 'contact' && e.t > 2e6);
if (contactCiv) {
  const tW = Math.ceil((contactCiv.t + 2e5) / CV.DT) * CV.DT;
  const hw = CV.simulate({ tau0: N, humans: true, interventions: [{ id: 4, t: tW, type: 'war', civ: contactCiv.civ }] });
  check('전쟁: 만난 이웃과 곧바로 전쟁', hw.civs[contactCiv.civ].end !== null && hw.civs[contactCiv.civ].end <= tW ? true : CV.relationsAt(hw, contactCiv.civ, tW + 1).war.length > 0);
}
const target = [...CV.countAt(h, 15e6).keys()][0];
const ownSys = CV.ownerAt(h, 15e6).findIndex((o) => o === target);
const hn = CV.simulate({ tau0: N, humans: true, interventions: [{ id: 5, t: 15e6, type: 'supernova', sys: ownSys }] });
check('초신성: 그 별이 비게 됨', CV.ownerAt(hn, 15e6)[ownSys] === -1, CV.ownerAt(hn, 15e6)[ownSys]);
check('초신성 사건이 기록됨', hn.events.some((e) => e.type === 'supernova' && !e.natural && e.t === 15e6));

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
