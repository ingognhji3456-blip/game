'use strict';
/* 장면 스크린샷: node tools/shot.js 출력폴더 [w] [h] [이름,이름] */
const { chromium } = require('playwright');
const path = require('path');
const N = 13.7916e9;
const SCENES = [
  { name: 'plasma', t: 1e-6 / 3.156e7, L: 9.3 },
  { name: 'recomb', t: 3.9e5, L: 9.3 },
  { name: 'darkage', t: 5e7, L: 9.3 },
  { name: 'firststars', t: 4e8, L: 9.3 },
  { name: 'web-now', t: N, L: 9.3 },
  { name: 'galaxy-young', t: 1.5e9, L: 5.3 },
  { name: 'galaxy-now', t: N, L: 5.2, pitch: 0.62 },
  { name: 'galaxy-edge', t: N, L: 5.0, pitch: 0.08 },
  { name: 'local-group', t: N, L: 6.9, pitch: 0.4 },
  { name: 'collision', t: N + 4.4e9, L: 6.0, pitch: 0.5 },
  { name: 'merger', t: N + 5.6e9, L: 5.9, pitch: 0.5 },
  { name: 'neighbors', t: N, L: 1.5, pitch: 0.25 },
  { name: 'solar-now', t: N, L: -3.05, pitch: 0.55 },
  { name: 'inner-now', t: N, L: -4.2, pitch: 0.6 },
  { name: 'protodisk', t: N - 4.566e9, L: -3.0, pitch: 0.7 },
  { name: 'redgiant', t: N + 7.59e9, L: -3.8, pitch: 0.6 },
  { name: 'nebula', t: N + 7.78e9, L: -1.6, pitch: 0.4 },
  { name: 'faded', t: 5e13, L: 5.4 },
  { name: 'blackhole', t: 1e60, L: 4.6 },
];
(async () => {
  const out = process.argv[2];
  const W = +(process.argv[3] || 960), H = +(process.argv[4] || 600);
  const only = process.argv[5] ? process.argv[5].split(',') : null;
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: W, height: H } });
  const errs = [];
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push('console: ' + m.text()); });
  await p.goto('file://' + path.resolve(__dirname, '../index.html') + '?debug');
  await p.waitForTimeout(1500);
  await p.evaluate(() => { document.getElementById('intro').hidden = true; });
  for (const sc of SCENES) {
    if (only && !only.includes(sc.name)) continue;
    await p.evaluate((sc) => {
      const a = window.UC_APP;
      a.pause();
      a.seek(sc.t);
      a.cam.fly = null;
      a.cam.L = sc.L;
      a.cam.pitch = sc.pitch !== undefined ? sc.pitch : 0.42;
      a.cam.yaw = sc.yaw !== undefined ? sc.yaw : 0.9;
      UC.ui.panels.hideCard();
    }, sc);
    await p.waitForTimeout(+(process.env.WAIT || 2500));
    await p.screenshot({ path: `${out}/${sc.name}.png`, timeout: 180000 });
    console.log(sc.name, await p.evaluate(() => document.getElementById('clock-time').textContent + ' | ' + document.getElementById('view-note').textContent));
  }
  console.log(errs.length ? errs.slice(0, 10).join('\n') : 'no errors');
  await b.close();
})();
