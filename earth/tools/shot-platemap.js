'use strict';
/* node tools/shot-platemap.js '<json opts>' out.png */
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const opts = process.argv[2] || '{}';
  const out = process.argv[3] || 'platemap.png';
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1320, height: 900 } });
  p.on('console', (m) => console.log('console:', m.text()));
  p.on('pageerror', (e) => console.log('pageerror:', e.message));
  await p.goto('file://' + path.resolve(__dirname, 'platemap.html') + '#' + encodeURIComponent(opts));
  await p.waitForFunction(() => document.title === 'done', null, { timeout: 120000 });
  await p.screenshot({ path: out, fullPage: true });
  await b.close();
})();
