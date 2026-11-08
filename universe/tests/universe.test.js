'use strict';

/* 우주 연대기 시뮬레이션 검사: node universe/tests/universe.test.js */
const { loadUniverse } = require('./load');

let failures = 0;
let passes = 0;
function check(name, cond, extra) {
  if (cond) { passes++; return; }
  failures++;
  console.log(`✗ ${name}${extra !== undefined ? ` — ${JSON.stringify(extra)}` : ''}`);
}
const near = (a, b, tol) => Number.isFinite(a) && Math.abs(a - b) <= tol;

const UC = loadUniverse();
const { cosmo: C, time: T, util: U, history: Hs, web: W, galaxy: G, solar: S, view: V, data: D } = UC;
const N = C.T_NOW;
const Y = U.YEAR_S;

/* ---------- 우주의 팽창 (표준 우주론과 맞는지) ---------- */
check('우주의 나이 137.9억 년', near(N / 1e9, 13.79, 0.05), N / 1e9);
const now = C.stateAt(C.BASE, N);
check('지금 a = 1', near(now.a, 1, 1e-6));
check('지금 배경 온도 2.7255K', near(now.T, 2.7255, 1e-4));
check('지금 허블 상수 67.7', near(now.Hkms, 67.7, 0.05), now.Hkms);
check('지금 성장 인자 D = 1', near(now.D, 1, 1e-3));
check('관측 가능한 우주 반지름 약 465억 광년', near(now.horizon / 1e9, 46.3, 0.6), now.horizon / 1e9);
check('지금은 암흑 에너지가 주인공이고 가속 팽창', now.dominant === 'de' && now.accel);
check('우주가 투명해진 때 35만~40만 년', C.T_RECOMB > 3.5e5 && C.T_RECOMB < 4e5, C.T_RECOMB);
check('물질-복사 같아짐 약 5만 년', C.T_EQ > 4e4 && C.T_EQ < 6e4, C.T_EQ);
check('가속 팽창 시작 약 60억 년 전', near((N - C.T_ACCEL) / 1e9, 6.0, 0.6), (N - C.T_ACCEL) / 1e9);
check('복사 시대의 온도: 1초 무렵 100억 도 근처', C.stateAt(C.BASE, 1 / Y).T > 3e9 && C.stateAt(C.BASE, 1 / Y).T < 3e10);
check('초기 우주는 복사가 주인공', C.stateAt(C.BASE, 100).dominant === 'r');
check('50억 년 무렵은 물질이 주인공·감속 팽창', C.stateAt(C.BASE, 5e9).dominant === 'm' && !C.stateAt(C.BASE, 5e9).accel);
let monoA = true;
let monoD = true;
let prevA = -Infinity;
let prevD = -Infinity;
for (let lg = -50; lg < 15; lg += 0.05) {
  const s = C.stateAt(C.BASE, Math.pow(10, lg));
  if (s.x < prevA) monoA = false;
  if (lg > 6 && s.D < prevD - 1e-9) monoD = false;
  prevA = s.x;
  if (lg > 6) prevD = s.D;
}
check('실제 우주는 계속 커짐', monoA);
check('구조는 계속 자람 (D 증가)', monoD);
check('실제 우주는 끝나지 않음', !Number.isFinite(C.BASE.tEnd) && C.BASE.endType === null);

/* ---------- 우주의 끝 ---------- */
const rip = C.integrate([{ t: N, type: 'rip' }]);
check('빅 립: 유한한 시간 뒤 끝', rip.endType === 'rip' && near((rip.tEnd - N) / 1e9, 22.5, 1.5), (rip.tEnd - N) / 1e9);
check('빅 립: 은하는 끝나기 약 7천만 년 전에 찢어짐', near(C.ripLead(2.5e8) / 1e6, 70, 5));
const cr = C.integrate([{ t: N, type: 'crunch' }]);
check('빅 크런치: 팽창이 멈췄다가 끝', cr.endType === 'crunch' && cr.tTurn > N && cr.tEnd > cr.tTurn, [cr.tTurn, cr.tEnd]);
const crEnd = C.stateAt(cr, cr.tEnd - 10);
check('빅 크런치 직전은 아주 뜨거움 (끝 10년 전 수십만 도)', crEnd.T > 1e5, crEnd.T);
check('빅 크런치 직전은 수축 중', crEnd.contracting);
const back = C.integrate([{ t: N, type: 'rip' }, { t: N + 5e9, type: 'restore' }]);
check('빅 립을 되돌리면 다시 영원히 팽창', back.endType === null);
const late = C.integrate([{ t: N, type: 'crunch' }, { t: cr.tTurn + 2e9, type: 'restore' }]);
check('이미 쪼그라들기 시작하면 되돌려도 크런치', late.endType === 'crunch');
for (const t0 of [1e8, 1e9, 5e9, N, 1e11]) {
  const r = C.integrate([{ t: t0, type: 'crunch' }]);
  check(`크런치 개입 (빅뱅 후 ${U.formatSpan(t0)}) 이 끝남`, r.endType === 'crunch' && r.tEnd > t0, r.tEnd);
  const rr = C.integrate([{ t: t0, type: 'rip' }]);
  check(`립 개입 (빅뱅 후 ${U.formatSpan(t0)}) 이 끝남`, rr.endType === 'rip' && rr.tEnd > t0, rr.tEnd);
  check(`개입 전 과거는 그대로 (${U.formatSpan(t0)})`, near(C.stateAt(rr, t0 * 0.9).x, C.stateAt(C.BASE, t0 * 0.9).x, 1e-9));
}

/* ---------- 시간 눈금과 표기 ---------- */
for (const tEnd of [Infinity, rip.tEnd, cr.tEnd, C.integrate([{ t: 2e9, type: 'crunch' }]).tEnd]) {
  const sc = T.makeScale(tEnd);
  let mono = true;
  let prev = -Infinity;
  let err = 0;
  for (let i = 0; i <= 3000; i++) {
    const s = i / 3000;
    const t = sc.fromS(s);
    if (t < prev) mono = false;
    prev = t;
    err = Math.max(err, Math.abs(sc.toS(t) - s));
  }
  const tag = Number.isFinite(tEnd) ? U.formatSpan(tEnd) : '끝없음';
  check(`눈금 단조 증가 (${tag})`, mono);
  check(`눈금 왕복 (${tag})`, err < 1e-6, err);
  check(`눈금 끝 (${tag})`, near(sc.fromS(1), Number.isFinite(tEnd) ? tEnd : T.TAU_END, Math.abs(sc.fromS(1)) * 1e-9));
}
const sc0 = T.makeScale(Infinity);
check('현재는 타임라인 가운데쯤', sc0.toS(N) > 0.5 && sc0.toS(N) < 0.65, sc0.toS(N));
check('처음 38만 년에 타임라인의 15%', near(sc0.toS(3.8e5), 0.15, 1e-6));
const ripScale = T.makeScale(rip.tEnd);
check('빅 립 마지막 7천만 년에 눈금 자리가 넉넉함', ripScale.toS(rip.tEnd) - ripScale.toS(rip.tEnd - 7e7) > 0.05);
check('시계: 빅뱅', T.clockText(T.TAU_START) === '빅뱅 후 10⁻⁴³초', T.clockText(T.TAU_START));
check('시계: 3분', T.clockText(180 / Y) === '빅뱅 후 3분', T.clockText(180 / Y));
check('시계: 38만 년', T.clockText(3.8e5) === '빅뱅 후 38만 년', T.clockText(3.8e5));
check('시계: 현재', T.clockText(N) === '현재');
check('시계: 45억 년 후', T.clockText(N + 4.5e9) === '45억 년 후', T.clockText(N + 4.5e9));
check('시계: 1조 년 후', T.clockText(N + 1e12) === '1조 년 후', T.clockText(N + 1e12));
check('시계: 10¹⁰⁰ 년 후', T.clockText(1e100) === '10¹⁰⁰ 년 후', T.clockText(1e100));
check('시계: 태양계 탄생은 "몇 년 전"으로', T.clockText(N - 4.568e9) === '45억 7천만 년 전', T.clockText(N - 4.568e9));
check('작은 글씨: 빅뱅 후', T.clockSub(N - 4.568e9) === '빅뱅 후 92억 2천만 년', T.clockSub(N - 4.568e9));
check('시계: 6,600만 년 전 (지구 연대기와 같은 표기)', T.clockText(N - 6.6e7) === '6,600만 년 전', T.clockText(N - 6.6e7));
check('작은 글씨: 오래전은 "몇 년 전"', T.clockSub(1e9) === '128억 년 전', T.clockSub(1e9));
check('시대 이름: 인플레이션', T.labelAt(1e-34 / Y).epoch.name === '급팽창 (인플레이션)');
check('시대 이름: 암흑 시대', T.labelAt(5e7).epoch.name === '우주 암흑 시대');
check('시대 이름: 블랙홀 시대', T.labelAt(1e50).epoch.name === '블랙홀 시대');
check('온도 표기', U.formatTemp(2.7255) === '2.73 K', U.formatTemp(2.7255));
check('거리 표기: AU', U.formatLy(30 / 63241) === '30 AU', U.formatLy(30 / 63241));

/* ---------- 사건 ---------- */
let sorted = true;
for (let i = 1; i < D.EVENTS.length; i++) if (D.EVENTS[i].t < D.EVENTS[i - 1].t) sorted = false;
check('사건이 시간 순서', sorted);
check('사건마다 제목·설명·아이콘', D.EVENTS.every((e) => e.title && e.text && e.icon && Number.isFinite(e.t)));
check('사건 id 겹치지 않음', new Set(D.EVENTS.map((e) => e.id)).size === D.EVENTS.length);
check('사건 시각이 우주의 나이 안', D.EVENTS.every((e) => e.t >= T.TAU_START && e.t <= T.TAU_END));
check('지구 사건은 지구 연대기 범위 안', D.EVENTS.filter((e) => e.earth).every((e) => e.t >= N - 4.54e9 && e.t <= N + 7.6e9));
check('view 값이 올바름', D.EVENTS.every((e) => !e.view || V.VIEWS[e.view]));

/* ---------- 개입과 갈라진 역사 ---------- */
const h0 = Hs.build([]);
check('개입 없으면 막힌 사건 없음', h0.events.every((e) => !e.prevented));
const h1 = Hs.build([{ id: 1, t: N, type: 'rip' }]);
check('빅 립 사건 3개', h1.events.filter((e) => e.fate).length === 3);
check('빅 립 뒤 사건은 일어나지 않음', h1.events.find((e) => e.id === 'heatdeath').prevented && h1.events.find((e) => e.id === 'starsend').prevented);
check('빅 립 전 사건은 그대로', !h1.events.find((e) => e.id === 'andromeda').prevented);
check('개입 카드에 결과 설명', h1.events.find((e) => e.kind === 'intervention').conseq.length >= 2);
const h2 = Hs.build([{ id: 2, t: 2e9, type: 'crunch' }]);
check('일찍 크런치하면 태양계도 생기지 않음', h2.events.find((e) => e.id === 'sun').prevented && h2.events.find((e) => e.id === 'now').prevented);
check('크런치 사건: 멈춤·불투명·끝', ['crunch_turn', 'crunch_end'].every((id) => h2.events.some((e) => e.id === id)));
check('이른 개입은 막음', !Hs.canIntervene(1e6, C.BASE).ok && Hs.canIntervene(N, C.BASE).ok);
check('끝난 우주에는 개입 못 함', !Hs.canIntervene(rip.tEnd + 1, rip).ok);

/* ---------- 우주 거대 구조 ---------- */
const re = new Float64Array(16);
const im = new Float64Array(16);
for (let i = 0; i < 16; i++) re[i] = Math.sin(i * 1.3) + i * 0.05;
const r0 = Float64Array.from(re);
W.fft1(re, im, 16, false);
W.fft1(re, im, 16, true);
check('FFT 왕복', Math.max(...Array.from(r0).map((v, i) => Math.abs(v - re[i]))) < 1e-12);
const web = W.generate();
check('은하 입자 10만 개 넘게', web.count > 100000, web.count);
check('입자 값이 모두 유한', Array.from(web.attrQ.subarray(0, 4000)).every(Number.isFinite) && Array.from(web.attrP.subarray(0, 4000)).every(Number.isFinite));
const sortedD = Array.from(web.dens).sort((a, b) => a - b);
check('물질이 덩어리짐 (밀도 차이)', sortedD[Math.floor(web.count * 0.99)] / Math.max(sortedD[Math.floor(web.count * 0.1)], 1e-3) > 10);
check('우리 은하는 원점', Math.hypot(web.attrQ[web.home * 4], web.attrQ[web.home * 4 + 1], web.attrQ[web.home * 4 + 2]) < 1e-3);

/* ---------- 은하와 충돌 ---------- */
G.init();
check('우리 은하 입자', G.mw.count > 100000 && G.mw.stars > 80000);
check('지금 안드로메다까지 250만 광년', near(Math.hypot(...G.m31Center(N)) / 1e6, 2.5, 0.01));
check('안드로메다는 다가오는 중', Math.hypot(...G.m31Center(N + 2e9)) < Math.hypot(...G.m31Center(N)));
const col = G.collision;
check('모든 화면 별이 계산 입자에 묶임', Array.from({ length: 2000 }, (_, i) => G.mw.data[i * 50 * G.STRIDE + 14]).every((v) => v >= 0 && v < G.SIM.n));
let peri = null;
let minSep = Infinity;
for (let dg = 3.0; dg <= 9.0; dg += 0.05) {
  const s = col.at(N + dg * 1e9);
  const sep = Math.hypot(s.p2[0] - s.p1[0], s.p2[1] - s.p1[1], s.p2[2] - s.p1[2]);
  if (peri === null && sep < 150000) peri = dg;
  minSep = Math.min(minSep, sep);
}
check('첫 충돌 약 40~48억 년 뒤', peri !== null && peri > 3.8 && peri < 4.9, peri);
const fin = col.at(N + 9e9);
const finSep = Math.hypot(fin.p2[0] - fin.p1[0], fin.p2[1] - fin.p1[1], fin.p2[2] - fin.p1[2]);
check('90억 년 뒤에는 하나로 합쳐짐', finSep < 30000, finSep);
const sunR = Math.hypot(fin.sun[0] - fin.p1[0], fin.sun[1] - fin.p1[1], fin.sun[2] - fin.p1[2]);
check('태양은 합쳐진 은하 안에 남음', sunR < 250000, sunR);
check('합쳐진 뒤에도 별 대부분이 은하 안', (() => { let k = 0; for (let i = 0; i < G.SIM.n; i++) if (Math.hypot(fin.pos[i * 3] - fin.p1[0], fin.pos[i * 3 + 1] - fin.p1[1], fin.pos[i * 3 + 2] - fin.p1[2]) < 300000) k++; return k / G.SIM.n > 0.9; })());
const a1 = col.at(N + 4.2e9).pos[30];
col.at(N + 7e9);
check('되감기해도 같은 결과', near(col.at(N + 4.2e9).pos[30], a1, 1e-3));

/* ---------- 태양과 행성 ---------- */
const P = Object.fromEntries(S.PLANETS.map((p) => [p.id, p]));
check('수성 → 금성 → 지구 순서로 삼켜짐', P.mercury.engulf < P.venus.engulf && P.venus.engulf <= P.earth.engulf);
check('지구는 적색거성 꼭대기에 삼켜짐 (약 76억 년 뒤)', near((S.T_SUN + P.earth.engulf * 1e9 - N) / 1e9, 7.6, 0.05));
check('화성 바깥 행성은 살아남음', ['mars', 'jupiter', 'saturn', 'uranus', 'neptune'].every((id) => P[id].engulf === null));
check('태양 탄생 전에는 없음', !S.sunAt(N - 4.7e9).exists);
check('지금 태양: 주계열, 밝기 1', S.sunAt(N).phase === 'main' && near(S.sunAt(N).L, 1, 0.01));
check('태양 적색거성: 지구 궤도 가까이', S.sunAt(N + 7.597e9).R * S.RSUN_AU > 1.0);
check('먼 미래 태양: 백색왜성', S.sunAt(N + 9e9).phase === 'wd' && S.sunAt(N + 9e9).R < 0.02);
check('태양이 가벼워지면 궤도가 넓어짐', S.planetAt(P.mars, N + 9e9, S.sunAt(N + 9e9)).a > 2.5);
const gc = S.radecToWorld(17.761, -29.008, 1);
check('은하 중심 방향이 -X', near(gc[0], -1, 0.01));
const ngp = S.radecToWorld(12.857, 27.128, 1);
check('은하 북극이 +Y', near(ngp[1], 1, 0.01));
check('황도 북극이 은하면과 약 60° 기울어짐', near((Math.acos(S.ECL_NORTH[1]) * 180) / Math.PI, 60.2, 1));

/* ---------- 장면 계산 (화면 없이) ---------- */
const app = { t: N, run: C.BASE, cam: { yaw: 0.5, pitch: 0.4, L: 5 }, wallT: 3, collisionOK: true };
let threw = null;
const times = [T.TAU_START, 1e-36 / Y, 1e-6 / Y, 3.8e5, 5e7, 1e9, N - 4.6e9, N, N + 4.5e9, N + 7.59e9, N + 8e9, 1e13, 1e20, 1e60, 1e101];
for (const t of times) {
  for (const L of [-4.5, -3, 1.5, 5, 6.5, 9.3]) {
    try {
      app.t = t;
      app.cam.L = L;
      const v = V.build(app, { w: 800, h: 500 });
      const bad = [v.cam.eye, v.cam.R, v.cam.U, v.cam.F, v.plasma.col].some((a) => a.some((x) => !Number.isFinite(x)));
      if (bad) throw new Error(`NaN at t=${t} L=${L}`);
    } catch (e) {
      threw = threw || e.message;
    }
  }
}
check('어느 시대·어느 확대에서도 장면 계산이 됨', threw === null, threw);
app.t = 1e-6 / Y;
check('초기 우주는 불투명한 플라스마', V.build(app, {}).plasma.a > 0.99);
app.t = N;
check('지금 우주는 투명', V.build(app, {}).plasma.a < 0.01);
app.t = 1e60;
check('블랙홀 시대엔 블랙홀이 보임', V.build(app, {}).gal.bh > 0.9);

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
