'use strict';

/*
 * 한 파일짜리 게임 만들기: index.html 이 불러오는 CSS/JS 를 모두 안에 넣어
 * dist/resonance-guard.html 하나만으로 실행되게 합니다.
 *   node tools/build.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'dist');
const OUT = path.join(OUT_DIR, 'resonance-guard.html');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

function guard(code, rel, tag) {
  if (new RegExp(`</${tag}`, 'i').test(code)) throw new Error(`${rel} 안에 </${tag} 문자열이 있어 한 파일로 합칠 수 없습니다.`);
  return code;
}

let html = read('index.html');
let css = 0;
let js = 0;
html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, (_, href) => { css += 1; return `<style>/* ${href} */\n${guard(read(href), href, 'style')}\n</style>`; });
html = html.replace(/<script src="([^"]+)"><\/script>/g, (_, src) => { js += 1; return `<script>/* ${src} */\n${guard(read(src), src, 'script')}\n</script>`; });
if (/<link rel="stylesheet"|<script src=/.test(html)) throw new Error('합치지 못한 외부 파일 참조가 남아 있습니다.');
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT, html);
const kb = Math.round(Buffer.byteLength(html) / 1024);
console.log(`CSS ${css}개, JS ${js}개 → ${path.relative(ROOT, OUT)} (${kb}KB)`);
if (kb > 3072) { console.error('3MB를 넘었습니다 (QUALITY.md §7)'); process.exitCode = 1; }
