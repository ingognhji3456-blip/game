'use strict';

/*
 * 전투 장면 녹화 — 동작(쏘기 전 조준·발사·걷기·휘두르기)이 실제 화면에서 어떻게 보이는지 확인용
 *   node tools/record.js [--map 2-4] [--hero sio] [--sec 12] [--out docs/reports/screens/battle.webm] [--dist]
 * 맵의 길 옆에 탑 여러 종류를 세우고, 적을 불러 1배속으로 찍습니다(웹엠 영상).
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const mapId = arg('map', '2-4');
const hero = arg('hero', 'sio');
const sec = +arg('sec', 12);
const out = path.resolve(ROOT, arg('out', `docs/reports/screens/battle-${mapId}.webm`));
const file = args.includes('--dist') ? 'dist/resonance-guard.html' : 'index.html';
const towersArg = arg('towers', '');

(async () => {
  const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'rec-'));
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: tmp, size: { width: 1280, height: 720 } } });
  const page = await ctx.newPage();
  await page.goto(`file://${path.join(ROOT, file)}?screen=game&map=${mapId}&hero=${hero}`);
  await page.waitForFunction(() => RG.ui.game.game && !document.querySelector('#screen-game').classList.contains('loading'), null, { timeout: 30000 });
  await page.evaluate((towersArg) => {
    RG.ui.closeAllModals();
    const ui = RG.ui.game;
    const g = ui.game;
    g.state.gold = 1e5;
    const m = g.map;
    // 길 가까운 건설지 순서
    const tiles = [];
    for (let r = 0; r < m.rows; r++) for (let c = 0; c < m.cols; c++) {
      if (m.kinds[r * m.cols + c] !== RG.grid.T.BUILD) continue;
      let near = 0;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if (m.kinds[(r + dr) * m.cols + (c + dc)] === RG.grid.T.PATH) near++;
      if (near) tiles.push({ c, r, near });
    }
    tiles.sort((a, b) => b.near - a.near);
    const types = towersArg ? towersArg.split(',') : g.opts.towers.filter((t) => RG.data.towers[t].role !== 'economy');
    let i = 0;
    for (const t of tiles) {
      if (i >= types.length * 2) break;
      const type = types[i % types.length];
      if (ui.doCmd({ type: 'build', tower: type, c: t.c, r: t.r }, true).ok) {
        const tw = g.state.towers[g.state.towers.length - 1];
        const lv = Math.floor(i / types.length) ? 3 : 1;
        for (let k = 1; k < lv; k++) ui.doCmd({ type: 'upgrade', id: tw.id }, true);
        i++;
      }
    }
    ui.doCmd({ type: 'callWave' }, true);
    // 영웅을 길 가운데로
    const p = m.spawns[0];
    ui.doCmd({ type: 'heroMove', x: m.lantern.x - (m.lantern.x - p.x) * 0.4, y: m.lantern.y - (m.lantern.y - p.y) * 0.4 }, true);
  }, towersArg);
  await page.waitForTimeout(sec * 1000);
  await ctx.close();
  await browser.close();
  const vid = fs.readdirSync(tmp).find((f) => f.endsWith('.webm'));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.copyFileSync(path.join(tmp, vid), out);
  console.log(`녹화 → ${path.relative(ROOT, out)}`);
})().catch((e) => { console.error(e); process.exit(1); });
