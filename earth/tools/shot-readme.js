'use strict';
/* README 용 스크린샷: node tools/shot-readme.js */
const { chromium } = require('playwright');
const path = require('path');
const OUT = path.resolve(__dirname, '../docs/screenshots');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  async function page(w, h) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    const p = await ctx.newPage();
    await p.goto('file://' + path.resolve(__dirname, '../index.html') + '?debug');
    await p.waitForTimeout(1200);
    await p.evaluate(() => { document.getElementById('intro').hidden = true; });
    return p;
  }
  const shot = async (p, name) => { await p.waitForTimeout(1500); await p.screenshot({ path: `${OUT}/${name}.png` }); };
  let p = await page(1280, 760);
  await p.evaluate(() => window.EC_APP.seek(0));
  await shot(p, 'present');
  await p.evaluate(() => window.EC_APP.seek(-250));
  await shot(p, 'pangaea');
  await p.evaluate(() => window.EC_APP.seek(-4530));
  await shot(p, 'magma');
  await p.evaluate(() => window.EC_APP.seek(-160));
  await p.click('.rail-btn[data-group="impact"]');
  await p.click('.size[data-tool="impact10"]');
  await p.mouse.click(660, 330);
  await p.waitForTimeout(400);
  await shot(p, 'impact');
  p = await page(390, 760);
  await p.evaluate(() => window.EC_APP.seek(-700));
  await shot(p, 'phone');
  await b.close();
})();
