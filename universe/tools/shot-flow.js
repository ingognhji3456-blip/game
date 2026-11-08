'use strict';
/* 조작 흐름 검사: 빅뱅부터 시작 → 다음 사건 → 빅 립 → 찢어지는 은하 → 바뀐 역사 → 빅 크런치 → 그래프. node tools/shot-flow.js 출력폴더 */
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const out = process.argv[2];
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1000, height: 620 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  await p.goto('file://' + path.resolve(__dirname, '../index.html') + '?debug');
  await p.waitForTimeout(1500);
  // start from big bang via intro button
  await p.click('#btn-start');
  await p.waitForTimeout(2500);
  await p.screenshot({ path: `${out}/1-start.png`, timeout: 180000 });
  const card1 = await p.evaluate(() => document.getElementById('card-title').textContent);
  // press continue -> plays until next major event (inflation)
  await p.evaluate(() => { const b = [...document.querySelectorAll('#card-actions button')].find(x => x.textContent.includes('계속')); b && b.click(); });
  await p.waitForTimeout(6000);
  const card2 = await p.evaluate(() => [document.getElementById('card').hidden, document.getElementById('card-title').textContent, document.getElementById('clock-time').textContent]);
  await p.screenshot({ path: `${out}/2-next.png`, timeout: 180000 });
  // go to now, open fate menu, apply rip
  await p.evaluate(() => { const a = window.UC_APP; a.pause(); a.seek(UC.cosmo.T_NOW); UC.ui.panels.hideCard(); });
  await p.click('#btn-fate');
  await p.waitForTimeout(300);
  await p.screenshot({ path: `${out}/3-fate.png`, timeout: 180000 });
  await p.click('#fate-menu [data-tool="rip"]');
  await p.waitForTimeout(2500);
  const card3 = await p.evaluate(() => [document.getElementById('card-title').textContent, document.getElementById('card-body').innerText.slice(0, 300)]);
  await p.screenshot({ path: `${out}/4-rip.png`, timeout: 180000 });
  // jump near rip end: galaxy tearing
  await p.evaluate(() => { const a = window.UC_APP; const e = a.events.find(x => x.id === 'rip_galaxy'); a.seek(e.t + (a.run.tEnd - e.t) * 0.6); a.cam.L = 5.2; a.cam.fly = null; UC.ui.panels.hideCard(); });
  await p.waitForTimeout(2500);
  await p.screenshot({ path: `${out}/5-tearing.png`, timeout: 180000 });
  // open history panel
  await p.click('#btn-history');
  await p.waitForTimeout(500);
  await p.screenshot({ path: `${out}/6-history.png`, timeout: 180000 });
  // undo and crunch at 50억 years
  await p.evaluate(() => { const a = window.UC_APP; a.resetHistory(); a.seek(5e9); document.getElementById('history-panel').hidden = true; });
  await p.evaluate(() => window.UC_APP.addIntervention('crunch'));
  await p.waitForTimeout(800);
  await p.evaluate(() => { const a = window.UC_APP; a.seek(a.run.tEnd - (a.run.tEnd - a.run.tTurn) * 0.02); a.cam.L = 9.3; a.cam.fly = null; UC.ui.panels.hideCard(); });
  await p.waitForTimeout(2500);
  await p.screenshot({ path: `${out}/7-crunch.png`, timeout: 180000 });
  await p.click('#btn-chart');
  await p.waitForTimeout(800);
  await p.screenshot({ path: `${out}/8-chart.png`, timeout: 180000 });
  console.log(JSON.stringify({ card1, card2, card3 }), errs.length ? errs : 'no errors');
  await b.close();
})();
