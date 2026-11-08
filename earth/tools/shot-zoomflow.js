'use strict';
/* 확대 → 내려가기 → 축소해서 돌아오기 흐름 확인: node tools/shot-zoomflow.js 출력폴더 w h */
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const out = process.argv[2];
  const W = +(process.argv[3] || 800), H = +(process.argv[4] || 500);
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: W, height: H } });
  const errs = [];
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  await p.goto('file://' + path.resolve(__dirname, '../index.html') + '?debug');
  await p.waitForTimeout(1000);
  await p.click('#btn-now');
  await p.evaluate(() => document.getElementById('card-close').click());
  await p.mouse.move(W / 2, H / 2);
  for (let i = 0; i < 40; i++) { await p.mouse.wheel(0, -200); await p.waitForTimeout(30); }
  await p.waitForTimeout(3000);
  const s1 = await p.evaluate(() => ({ field: EC.fieldMode.active, descend: !document.getElementById('btn-descend').hidden, sub: document.getElementById('descend-sub').textContent }));
  await p.screenshot({ path: `${out}/1-close.png`, timeout: 120000 });
  for (let i = 0; i < 6; i++) { await p.mouse.wheel(0, -200); await p.waitForTimeout(50); }
  await p.waitForTimeout(4000);
  const s2 = await p.evaluate(() => ({ field: EC.fieldMode.active, loc: document.getElementById('field-loc').textContent }));
  await p.screenshot({ path: `${out}/2-ground.png`, timeout: 120000 });
  await p.mouse.click(W / 2, H / 2 + 40);
  await p.waitForTimeout(2500);
  await p.screenshot({ path: `${out}/3-tap.png`, timeout: 120000 });
  for (let i = 0; i < 10; i++) { await p.mouse.wheel(0, 200); await p.waitForTimeout(40); }
  await p.waitForTimeout(3000);
  const s3 = await p.evaluate(() => ({ field: EC.fieldMode.active }));
  await p.screenshot({ path: `${out}/4-back.png`, timeout: 120000 });
  console.log(JSON.stringify({ s1, s2, s3 }), errs.length ? errs : 'no errors');
  await b.close();
})();
