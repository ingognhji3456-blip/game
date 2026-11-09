'use strict';

/*
 * 그림 검수 도구 — 모든 그림을 "대상 하나당 이미지 하나"로 찍습니다.
 * 각 이미지에는 그 대상의 모든 단계/프레임을 크게, 그리고 실제 게임 크기(1칸=32px)로 함께 넣습니다.
 *
 *   node tools/art-review.js                 # 전부
 *   node tools/art-review.js towers          # 분류 하나 (towers|enemies|heroes|portraits|units|icons|terrain|lantern)
 *   node tools/art-review.js towers ember_archer   # 대상 하나
 *
 * 결과: docs/reports/art/<분류>/<id>.png
 * 그림 함수가 없거나 예외가 나면 그 칸에 빨간 오류 표시를 하고 콘솔에 알립니다.
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'docs', 'reports', 'art');

const SCRIPTS = [
  'js/util.js', 'js/data/elements.js', 'js/data/towers.js', 'js/data/enemies.js', 'js/data/heroes.js', 'js/data/maps.js',
  'js/core/grid.js',
  'js/art/helpers.js', 'js/art/towers.js', 'js/art/enemies.js', 'js/art/heroes.js', 'js/art/terrain.js', 'js/art/icons.js',
];

/* 설계서 기준 목록 (데이터 파일이 아직 없어도 검수할 수 있게) */
const TOWERS = ['ember_archer', 'flame_mortar', 'forge', 'frost_crystal', 'ice_ballista', 'winter_bell',
  'lightning_rod', 'gale_cannon', 'dynamo', 'stone_barracks', 'quake_hammer', 'crystal_mine',
  'sun_lens', 'sanctuary', 'radiance_spire', 'hex_spire', 'void_orb', 'shadow_snare'];
const ENEMIES = ['mist_rat', 'ash_boar', 'mist_crow', 'straw_husk', 'vine_leech', 'spore_sac', 'sporeling', 'rust_knight',
  'frost_wolf', 'snow_wisp', 'ice_tortoise', 'avalanche_golem', 'snowball_golem', 'yeti_shaman', 'rime_wraith', 'ice_shieldbearer',
  'cinder_lizard', 'sand_burrower', 'magma_brute', 'thermal_vulture', 'dune_raider', 'obsidian_beetle', 'flame_spirit', 'canyon_slinger',
  'rock_crab', 'volt_jelly', 'spray_sprite', 'drowned_corsair', 'coral_colossus', 'volt_eel', 'mist_mariner', 'tide_caller',
  'grey_legionnaire', 'hush_monk', 'void_stalker', 'ashen_paladin', 'echo_shade', 'bellshard_golem', 'silent_drake', 'resonance_eater',
  'hollow_elder', 'whitehorn', 'pyre_worm', 'tempest_whale', 'bellkeeper', 'the_silence'];
const ENEMY_SIZE = {
  mist_rat: 0.5, sporeling: 0.5, mist_crow: 0.5, snow_wisp: 0.5, snowball_golem: 0.5, cinder_lizard: 0.5, flame_spirit: 0.5, spray_sprite: 0.5,
  ice_tortoise: 0.9, avalanche_golem: 0.9, yeti_shaman: 0.9, magma_brute: 0.9, coral_colossus: 0.9, ashen_paladin: 0.9, bellshard_golem: 0.9, silent_drake: 0.9,
  hollow_elder: 1.8, whitehorn: 1.8, pyre_worm: 1.8, tempest_whale: 2.0, bellkeeper: 1.6, the_silence: 2.0,
};
const HEROES = ['kara', 'sera', 'sio', 'zena', 'bawi', 'yaro'];
const PORTRAITS = [...HEROES, 'elder', 'bellkeeper', 'haru'];
const UNITS = ['stone_soldier', 'granite_guard', 'obsidian_blade', 'drone', 'rock_wall'];
const ICONS = ['fire', 'frost', 'storm', 'earth', 'light', 'dark',
  'flying', 'armor', 'regen', 'split', 'stealth', 'shield', 'healer', 'shielder', 'burrow', 'dash', 'undying', 'deathburst',
  'ranged', 'shock', 'silence', 'adaptive', 'dampen', 'unstoppable',
  'slow', 'freeze', 'stun', 'root', 'burn', 'bleed', 'curse', 'shred', 'stillness', 'blind', 'lift', 'veil',
  'gold', 'lives', 'wave', 'damage', 'range', 'speed', 'hp', 'star', 'star_empty', 'lock', 'skull', 'crown',
  'play', 'pause', 'fast', 'settings', 'sound', 'mute', 'sell', 'upgrade', 'target', 'hero', 'skill', 'back', 'close', 'map', 'book', 'tree', 'retry'];

const CATEGORY_DEFS = {
  towers: () => TOWERS.map((id) => ({
    id,
    items: [
      ...[1, 2, 3].map((lv) => ({ label: `Lv${lv}`, call: ['tower', id, lv, null], vb: [100, 130], tile: 1 })),
      { label: 'Lv4 A', call: ['tower', id, 4, 'A'], vb: [100, 130], tile: 1 },
      { label: 'Lv4 B', call: ['tower', id, 4, 'B'], vb: [100, 130], tile: 1 },
    ],
  })),
  lantern: () => [{ id: 'lantern', items: [1, 0.5, 0.1].map((r) => ({ label: `빛 ${r}`, call: ['lantern', r], vb: [100, 130], tile: 1 })) }],
  enemies: () => ENEMIES.map((id) => ({
    id,
    items: [0, 1].map((f) => ({ label: `frame ${f}`, call: ['enemy', id, f], vb: [100, 100], tile: ENEMY_SIZE[id] || 0.7, flipDemo: f === 1 })),
  })),
  heroes: () => HEROES.map((id) => ({
    id,
    items: ['idle', 'walk1', 'walk2', 'attack'].map((p) => ({ label: p, call: ['hero', id, p], vb: [100, 100], tile: 0.9, flipDemo: p === 'walk2' })),
  })),
  portraits: () => PORTRAITS.map((id) => ({
    id,
    items: ['normal', 'happy', 'worried'].map((m) => ({ label: m, call: ['portrait', id, m], vb: [200, 200], tile: 0, big: 260 })),
  })),
  units: () => UNITS.map((id) => ({
    id,
    items: ['idle', 'attack'].map((p) => ({ label: p, call: ['unit', id, p], vb: [100, 100], tile: id === 'rock_wall' ? 1 : 0.6 })),
  })),
  icons: () => [{ id: 'icons', items: ICONS.map((name) => ({ label: name, call: ['icon', name], vb: [64, 64], tile: 0, big: 96, small: 24 })) }],
  terrain: () => [{ id: 'terrain', terrain: true }],
};

function pageHtml() {
  const code = SCRIPTS.filter((f) => fs.existsSync(path.join(ROOT, f)))
    .map((f) => `<script>/* ${f} */\n${fs.readFileSync(path.join(ROOT, f), 'utf8')}\n</script>`).join('\n');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body{margin:0;background:#2a2f3a;font:13px sans-serif;color:#eee}
    .sheet{display:inline-block;padding:12px;background:#2a2f3a}
    h2{margin:0 0 8px;font-size:16px}
    .row{display:flex;gap:14px;align-items:flex-end;flex-wrap:wrap;max-width:1500px}
    .cell{display:flex;flex-direction:column;align-items:center;gap:4px}
    .big{background:repeating-conic-gradient(#3a4150 0 25%,#323846 0 50%) 0 0/20px 20px;border:1px solid #556}
    .game{background:#5d7a3c;border:1px solid #556;position:relative}
    .err{background:#a22;color:#fff;padding:6px;max-width:220px;white-space:pre-wrap;font-size:11px}
    .lbl{font-size:12px;color:#ccd}
    .grid32{background-image:linear-gradient(#0002 1px,transparent 1px),linear-gradient(90deg,#0002 1px,transparent 1px);background-size:32px 32px}
  </style></head><body><div id="root"></div>${code}</body></html>`;
}

async function main() {
  const [cat, only] = process.argv.slice(2);
  const cats = cat ? [cat] : Object.keys(CATEGORY_DEFS);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
  const logs = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.text()); });
  page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
  await page.setContent(pageHtml(), { waitUntil: 'load' });
  let count = 0;
  let errors = 0;

  for (const c of cats) {
    const def = CATEGORY_DEFS[c];
    if (!def) { console.error(`알 수 없는 분류: ${c}`); continue; }
    const subjects = def().filter((s) => !only || s.id === only);
    fs.mkdirSync(path.join(OUT, c), { recursive: true });
    for (const subj of subjects) {
      const res = await page.evaluate((s) => {
        const root = document.getElementById('root');
        root.innerHTML = '';
        const sheet = document.createElement('div');
        sheet.className = 'sheet';
        sheet.id = 'sheet';
        root.appendChild(sheet);
        const errs = [];
        const h2 = document.createElement('h2');
        h2.textContent = s.id;
        sheet.appendChild(h2);
        const toUrl = (svg) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

        if (s.terrain) {
          const maps = (window.RG && RG.data && RG.data.maps) || [];
          const wrap = document.createElement('div');
          wrap.className = 'row';
          sheet.appendChild(wrap);
          if (!RG.art.mapBackground || !RG.grid) { errs.push('RG.art.mapBackground 또는 RG.grid 없음'); }
          for (const m of maps.concat(RG.data.endless || [])) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            try {
              const pm = RG.grid.parseMap(m);
              const img = new Image();
              img.src = toUrl(RG.art.mapBackground(pm));
              img.width = pm.cols * 32;
              img.height = pm.rows * 32;
              cell.appendChild(img);
            } catch (e) { const d = document.createElement('div'); d.className = 'err'; d.textContent = `${m.id}: ${e.message}`; cell.appendChild(d); errs.push(`${m.id}: ${e.message}`); }
            const l = document.createElement('div'); l.className = 'lbl'; l.textContent = `${m.id} ${m.name}`; cell.appendChild(l);
            wrap.appendChild(cell);
          }
          return { errs, imgs: wrap.querySelectorAll('img').length };
        }

        const bigRow = document.createElement('div'); bigRow.className = 'row'; sheet.appendChild(bigRow);
        const smallRow = document.createElement('div'); smallRow.className = 'row'; smallRow.style.marginTop = '10px'; sheet.appendChild(smallRow);
        for (const it of s.items) {
          const [fn, ...args] = it.call;
          let svg = null;
          try {
            if (typeof RG.art[fn] !== 'function') throw new Error(`RG.art.${fn} 없음`);
            svg = RG.art[fn](...args);
            if (typeof svg !== 'string' || !svg.includes('<svg')) throw new Error('SVG 문자열이 아님');
          } catch (e) { errs.push(`${it.label}: ${e.message}`); }
          const cell = document.createElement('div'); cell.className = 'cell';
          if (svg) {
            const img = new Image();
            img.src = toUrl(svg);
            const bw = it.big || (it.vb[0] === 100 ? 200 : 200);
            img.width = bw; img.height = bw * it.vb[1] / it.vb[0];
            img.className = 'big';
            cell.appendChild(img);
          } else {
            const d = document.createElement('div'); d.className = 'err'; d.textContent = errs[errs.length - 1]; cell.appendChild(d);
          }
          const l = document.createElement('div'); l.className = 'lbl'; l.textContent = it.label; cell.appendChild(l);
          bigRow.appendChild(cell);

          // 게임 크기 (1칸 = 32px). 3×2칸 땅 위에 놓고, 좌우 반전도 함께
          if (svg && (it.tile || it.small)) {
            const sc = document.createElement('div'); sc.className = 'cell';
            const box = document.createElement('div'); box.className = 'game grid32';
            const T = 32;
            box.style.width = `${T * 3}px`; box.style.height = `${T * 2}px`;
            const place = (flip, cx) => {
              const img = new Image(); img.src = toUrl(svg);
              const w = it.small || T * it.tile; const h = w * it.vb[1] / it.vb[0];
              img.width = w; img.height = h;
              img.style.position = 'absolute';
              // 기준점: 탑(100x130)은 (50,112), 그 외(100x100)는 (50,90)
              const ay = it.vb[1] === 130 ? 112 / 130 : 0.9;
              img.style.left = `${cx - w / 2}px`;
              img.style.top = `${T * 1.5 - h * ay}px`;
              if (flip) img.style.transform = 'scaleX(-1)';
              box.appendChild(img);
            };
            if (it.small) { place(false, T * 1.5); } else { place(false, T * 0.8); place(true, T * 2.2); }
            sc.appendChild(box);
            const l2 = document.createElement('div'); l2.className = 'lbl'; l2.textContent = it.small ? `${it.label} ${it.small}px` : `${it.label} (게임 크기, 반전)`; sc.appendChild(l2);
            smallRow.appendChild(sc);
          }
        }
        return { errs, imgs: sheet.querySelectorAll('img').length };
      }, subj);
      await page.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 15000 }).catch(() => {});
      const el = await page.$('#sheet');
      const file = path.join(OUT, c, `${subj.id}.png`);
      await el.screenshot({ path: file });
      count += 1;
      if (res.errs.length) { errors += res.errs.length; console.log(`! ${c}/${subj.id}: ${res.errs.join(' | ')}`); }
    }
  }
  await browser.close();
  if (logs.length) console.log(`콘솔 메시지 ${logs.length}개:\n  ${logs.slice(0, 20).join('\n  ')}`);
  console.log(`이미지 ${count}장 → ${path.relative(ROOT, OUT)}  (오류 ${errors}개)`);
  process.exitCode = errors ? 1 : 0;
}

main().catch((e) => { console.error(e); process.exit(1); });
