'use strict';
/* node tools/shot-render.js out-prefix '[{"t":0},{"t":-200}]' [width] [height] */
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const prefix = process.argv[2];
  const list = JSON.parse(process.argv[3]);
  const W = +(process.argv[4] || 640), H = +(process.argv[5] || 480);
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: W, height: H } });
  p.on('pageerror', (e) => console.log('pageerror:', e.message));
  p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('console:', m.text()); });
  await p.goto('file://' + path.resolve(__dirname, 'render.html'));
  await p.waitForFunction(() => document.title === 'ready');
  for (let i = 0; i < list.length; i++) {
    const t0 = Date.now();
    const info = await p.evaluate((o) => window.renderAt(o), list[i]);
    await p.screenshot({ path: `${prefix}${i}.png` });
    console.log(i, JSON.stringify(list[i]).slice(0, 60), JSON.stringify(info), (Date.now() - t0) + 'ms');
  }
  await b.close();
})();
