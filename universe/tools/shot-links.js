'use strict';
/* 휴대폰 화면과 지구 연대기 ↔ 우주 연대기 연결 검사 (dist 한 파일 버전). 먼저 node tools/build.js. node tools/shot-links.js 출력폴더 */
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const out = process.argv[2];
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 760 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  const dist = path.resolve(__dirname, '../../dist');
  // 1) earth single file -> universe button
  await p.goto('file://' + dist + '/earth-chronicle.html?t=-66');
  await p.waitForTimeout(2500);
  await p.click('#btn-universe');
  await p.waitForTimeout(4000);
  const u1 = await p.evaluate(() => ({ url: location.pathname.split('/').pop() + location.search, intro: document.getElementById('intro').hidden, clock: document.getElementById('clock-time').textContent }));
  await p.screenshot({ path: `${out}/m1-from-earth.png`, timeout: 180000 });
  // 2) universe debug on dist: tap Earth label
  await p.goto('file://' + dist + '/universe-chronicle.html?debug&t=0&from=earth');
  await p.waitForTimeout(5000);
  const lab = await p.evaluate(() => (window.UC_APP.labelsNow() || []).map((l) => ({ t: l.text, x: l.x, y: l.y })));
  const e = lab.find((l) => l.t === '지구');
  let card = null;
  if (e) {
    await p.evaluate((e) => window.UC_APP.pickAt(e.x, e.y), e);
    await p.waitForTimeout(800);
    card = await p.evaluate(() => [document.getElementById('card-title').textContent, [...document.querySelectorAll('#card-actions button')].map((b) => b.textContent)]);
  }
  await p.screenshot({ path: `${out}/m2-earth-card.png`, timeout: 180000 });
  // 3) click the link
  let u3 = null;
  if (card) {
    await p.click('#card-actions button');
    await p.waitForTimeout(3000);
    u3 = await p.evaluate(() => ({ url: location.pathname.split('/').pop() + location.search, clock: document.getElementById('clock-time').textContent }));
  }
  // 4) phone galaxy view
  await p.goto('file://' + dist + '/universe-chronicle.html?debug');
  await p.waitForTimeout(3000);
  await p.click('#btn-now');
  await p.waitForTimeout(5000);
  await p.screenshot({ path: `${out}/m3-phone-now.png`, timeout: 180000 });
  console.log(JSON.stringify({ u1, labels: lab.map((l) => l.t), card, u3 }), errs.length ? errs : 'no errors');
  await b.close();
})();
