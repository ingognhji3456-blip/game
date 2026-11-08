'use strict';
/* 은하 문명 모드 검사: node tools/shot-civ.js 출력폴더 [w] [h] */
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const out = process.argv[2];
  const W = +(process.argv[3] || 1000), H = +(process.argv[4] || 620);
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: W, height: H } });
  const errs = [];
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await p.goto('file://' + path.resolve(__dirname, '../index.html') + '?debug');
  await p.waitForTimeout(1500);
  await p.evaluate(() => { document.getElementById('intro').hidden = true; window.UC_APP.seek(UC.cosmo.T_NOW); });
  await p.click('#btn-civ');
  await p.waitForTimeout(2500);
  await p.screenshot({ path: `${out}/c1-enter.png`, timeout: 180000 });
  const intro = await p.evaluate(() => document.getElementById('card-title').textContent);
  // jump to 12 Myr directly
  await p.evaluate(() => { UC.ui.panels.hideCard(); UC.civMode.adapter.seek(12e6); });
  await p.waitForTimeout(2500);
  await p.screenshot({ path: `${out}/c2-12myr.png`, timeout: 180000 });
  await p.click('#btn-civ-list');
  await p.waitForTimeout(600);
  await p.screenshot({ path: `${out}/c3-list.png`, timeout: 180000 });
  // click first civ in list
  await p.click('.civ-row');
  await p.waitForTimeout(2500);
  await p.screenshot({ path: `${out}/c4-civcard.png`, timeout: 180000 });
  const civCard = await p.evaluate(() => [document.getElementById('card-title').textContent, document.getElementById('card-body').innerText.slice(0, 200), [...document.querySelectorAll('#card-actions button')].map(b => b.textContent)]);
  // play with autopause and see an event card
  await p.evaluate(() => { document.getElementById('civ-list-panel').hidden = true; UC.ui.panels.hideCard(); const a = window.UC_APP; a.speedIdx = 3; a.play(); });
  await p.waitForTimeout(8000);
  const ev = await p.evaluate(() => [window.UC_APP.playing, document.getElementById('card').hidden ? null : document.getElementById('card-title').textContent + ' | ' + document.getElementById('card-body').innerText, document.getElementById('clock-time').textContent]);
  await p.screenshot({ path: `${out}/c5-event.png`, timeout: 180000 });
  // supernova intervention at a populated system
  const r = await p.evaluate(() => { const M = UC.civMode.M; const own = UC.civ.ownerAt(M.h, M.t); let k = own.findIndex(o => o >= 0); UC.civMode.addIv('supernova', { sys: k }); return document.getElementById('card-title').textContent + ' | ' + document.getElementById('card-body').innerText; });
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `${out}/c6-nova.png`, timeout: 180000 });
  await p.click('#btn-civ-log');
  await p.waitForTimeout(600);
  await p.screenshot({ path: `${out}/c7-log.png`, timeout: 180000 });
  await p.click('#btn-civ-exit');
  await p.waitForTimeout(2000);
  const back = await p.evaluate(() => [document.body.classList.contains('civ'), document.getElementById('clock-time').textContent]);
  console.log(JSON.stringify({ intro, civCard, ev, r, back }, null, 1), errs.length ? errs : 'no errors');
  await b.close();
})();
