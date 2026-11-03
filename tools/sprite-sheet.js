'use strict';

/*
 * 픽셀 그림 미리보기: 등록된 그림을 모두(또는 일부) 크게 늘려 PNG 한 장으로 저장합니다.
 *
 *   node tools/sprite-sheet.js out.png                         # 전부
 *   node tools/sprite-sheet.js out.png --only=slime,bat,orb_*  # 이름(뒤에 * 는 앞부분 일치)
 *   node tools/sprite-sheet.js out.png --files=shooter/js/sprites/enemies.js
 *   node tools/sprite-sheet.js out.png --scale=4
 *
 * 각 그림마다: 하늘색·어두운 배경 위의 모든 프레임(확대) + 실제 게임 크기(2.5배) 미리보기.
 * 그림 데이터에 문제가 있으면 오류를 출력하고 종료 코드 1 로 끝납니다.
 * (Playwright 와 Chromium 이 필요합니다)
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const SHOOTER = path.join(ROOT, 'shooter');

const args = process.argv.slice(2);
const out = path.resolve(args.find((a) => !a.startsWith('--')) || 'sprite-sheet.png');
const opt = (k) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : null; };
const only = opt('only') ? opt('only').split(',').map((s) => s.trim()).filter(Boolean) : null;
const scaleOpt = opt('scale') ? parseInt(opt('scale'), 10) : 0;

function spriteFiles() {
  const f = opt('files');
  if (f) return f.split(',').map((p) => path.resolve(ROOT, p));
  const html = fs.readFileSync(path.join(SHOOTER, 'index.html'), 'utf8');
  const listed = [...html.matchAll(/<script src="(js\/sprites\/[^"]+)"><\/script>/g)].map((m) => path.join(SHOOTER, m[1]));
  const dir = path.join(SHOOTER, 'js', 'sprites');
  const all = fs.existsSync(dir) ? fs.readdirSync(dir).filter((n) => n.endsWith('.js')).sort().map((n) => path.join(dir, n)) : [];
  return [...new Set([...listed, ...all])];
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.setContent('<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;background:#2b2840"></body></html>');
  for (const f of ['js/util.js', 'js/data.js', 'js/pix.js']) await page.addScriptTag({ content: fs.readFileSync(path.join(SHOOTER, f), 'utf8') });
  for (const f of spriteFiles()) {
    try {
      await page.addScriptTag({ content: `try {\n${fs.readFileSync(f, 'utf8')}\n} catch (e) { console.error(${JSON.stringify(path.relative(ROOT, f))} + ': ' + e.message); }` });
    } catch (e) {
      errors.push(`${path.relative(ROOT, f)}: ${e.message}`);
    }
  }
  const result = await page.evaluate(({ only, scaleOpt }) => {
    const names = SH.pix.names().filter((n) => !only || only.some((o) => (o.endsWith('*') ? n.startsWith(o.slice(0, -1)) : n === o)));
    const rows = [];
    const problems = [];
    for (const n of names) {
      const inf = SH.pix.info(n);
      const s = scaleOpt || Math.max(2, Math.min(6, Math.floor(150 / Math.max(inf.w, inf.h))));
      try { for (let f = 0; f < inf.n; f++) SH.pix.get(n, f); } catch (e) { problems.push(`${n}: ${e.message}`); continue; }
      rows.push({ n, inf, s });
    }
    const PAD = 10, W = 1380;
    // 줄 높이 계산
    let y = PAD;
    const layout = [];
    for (const r of rows) {
      const cw = r.inf.w * r.s + 8, ch = r.inf.h * r.s + 8;
      const perRow = Math.max(1, Math.floor((W - 260) / (cw + 6)));
      const lines = Math.ceil(r.inf.n / perRow);
      const h = 18 + lines * (ch * 2 + 10) + 6;
      layout.push({ r, y, cw, ch, perRow });
      y += Math.max(h, 18 + r.inf.h * 2.5 + 30);
    }
    const c = document.createElement('canvas');
    c.width = W;
    c.height = Math.max(40, y + PAD);
    document.body.appendChild(c);
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    x.fillStyle = '#2b2840';
    x.fillRect(0, 0, c.width, c.height);
    for (const L of layout) {
      const { r, cw, ch, perRow } = L;
      x.fillStyle = '#ffe08a';
      x.font = 'bold 13px monospace';
      x.fillText(`${r.n}  ${r.inf.w}x${r.inf.h}  frames:${r.inf.n}  (x${r.s})`, PAD, L.y + 12);
      for (let f = 0; f < r.inf.n; f++) {
        const col = f % perRow, line = Math.floor(f / perRow);
        const cx = 250 + col * (cw + 6), cy = L.y + 18 + line * (ch * 2 + 10);
        x.fillStyle = '#5aa8f0';
        x.fillRect(cx, cy, cw, ch);
        x.fillStyle = '#140f26';
        x.fillRect(cx, cy + ch + 2, cw, ch);
        const img = SH.pix.get(r.n, f);
        x.drawImage(img, cx + 4, cy + 4, r.inf.w * r.s, r.inf.h * r.s);
        x.drawImage(img, cx + 4, cy + ch + 6, r.inf.w * r.s, r.inf.h * r.s);
        x.fillStyle = '#ffffff99';
        x.font = '10px monospace';
        x.fillText(String(f), cx + 2, cy + 10);
      }
      // 실제 게임 크기 (약 2.5배)
      x.fillStyle = '#7fd0ff';
      x.fillRect(PAD, L.y + 20, Math.ceil(r.inf.w * 2.5) + 8, Math.ceil(r.inf.h * 2.5) + 8);
      x.imageSmoothingEnabled = false;
      x.drawImage(SH.pix.get(r.n, 0), PAD + 4, L.y + 24, Math.round(r.inf.w * 2.5), Math.round(r.inf.h * 2.5));
    }
    window.__sheet = c;
    return { count: rows.length, problems, list: rows.map((r) => `${r.n} ${r.inf.w}x${r.inf.h} x${r.inf.n}`) };
  }, { only, scaleOpt });
  const el = await page.$('canvas');
  if (el) await el.screenshot({ path: out });
  await browser.close();
  console.log(`그림 ${result.count}개 → ${out}`);
  console.log(result.list.join('\n'));
  const all = [...errors, ...result.problems];
  if (all.length) {
    console.error('\n문제:\n' + all.join('\n'));
    process.exit(1);
  }
})().catch((e) => { console.error(e); process.exit(1); });
