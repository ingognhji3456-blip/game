'use strict';
/* 지상 장면 스크린샷: node tools/shot-field.js 출력폴더 [w] [h] */
const { chromium } = require('playwright');
const path = require('path');
const SCENES = [
  { name: 'savanna-now', t: 0, plate: 'AF', lat: -1, lon: 36, yaw: 0.6 },
  { name: 'cretaceous', t: -100, plate: 'NA', lat: 45, lon: -100, yaw: 1.2 },
  { name: 'cambrian-sea', t: -510, plate: 'EU', lat: 56, lon: 3, yaw: 0.3, find: 'shelf' },
  { name: 'carboniferous', t: -310, plate: 'NA', lat: 38, lon: -85, yaw: 2.0, find: 'forest' },
  { name: 'ice-age', t: -0.02, plate: 'EU', lat: 50, lon: 30, yaw: 0.8 },
  { name: 'hadean', t: -4530, plate: 'AF', lat: 0, lon: 20, yaw: 0.2 },
  { name: 'archean-shore', t: -3000, plate: 'AF', lat: -26, lon: 30, yaw: 0.5, find: 'shelf' },
  { name: 'jurassic-sea', t: -160, plate: 'EU', lat: 50, lon: 10, yaw: 0.5, find: 'shelf' },
  { name: 'coast-now', t: 0, plate: 'EU', lat: 43.6, lon: 4.5, yaw: 3.0 },
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
  await p.waitForTimeout(1000);
  await p.evaluate(() => { document.getElementById('intro').hidden = true; });
  for (const sc of SCENES) {
    if (only && !only.includes(sc.name)) continue;
    const info = await p.evaluate((sc) => {
      if (EC.fieldMode.active) EC.fieldMode.exit();
      window.EC_APP.seek(sc.t);
      let d = EC.plates.pointAt(sc.plate, sc.lat, sc.lon, sc.t);
      if (sc.find) {
        const st = EC.sim.stateAt(window.EC_APP.run, sc.t);
        const look = Object.assign(EC.look.build(st, window.EC_APP.run, sc.t), { uDetail: 1 });
        const rots = EC.plates.layerRotations(sc.t), vis = EC.plates.layerVisibility(sc.t);
        const rng = EC.util.rng(11);
        for (let k = 0; k < 4000; k++) {
          const r = 0.02 + rng() * 0.6;
          const c = EC.q.norm([d[0] + (rng() - 0.5) * r, d[1] + (rng() - 0.5) * r, d[2] + (rng() - 0.5) * r]);
          const info = EC.surface.query(c, look, rots, vis);
          const bio = EC.surface.biome(info, st);
          if (bio.id === sc.find || (sc.find === 'forest' && /forest|rainforest/.test(bio.id))) { d = c; break; }
        }
      }
      EC.fieldMode.enter(d);
      EC.fieldMode.setView(sc.yaw);
      return true;
    }, sc);
    await p.waitForTimeout(+(process.env.WAIT || 2600));
    const dbg = await p.evaluate(() => { const d = EC.fieldMode.debug(); return { bio: d.bio && d.bio.name, coast: d.env && d.env.coast, under: d.env && d.env.under, items: [...new Set(d.items)].join(',') }; });
    await p.screenshot({ path: `${out}/${sc.name}.png`, timeout: 120000 });
    console.log(sc.name, JSON.stringify(dbg), info);
  }
  console.log(errs.length ? errs.slice(0, 8).join('\n') : 'no errors');
  await b.close();
})();
