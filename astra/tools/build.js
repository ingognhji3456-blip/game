'use strict';

/*
 * 한 파일짜리 게임 만들기: astra/index.html 이 불러오는 CSS/JS 를 모두 안에 넣어
 * dist/astra-zero-protocol.html 하나만으로 실행되게 합니다.
 *   node astra/tools/build.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.resolve(ROOT, '..', 'dist');
const OUT = path.join(OUT_DIR, 'astra-zero-protocol.html');

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

function guard(code, rel, tag) {
  if (new RegExp(`</${tag}`, 'i').test(code)) {
    throw new Error(`${rel} 안에 </${tag} 문자열이 있어 한 파일로 합칠 수 없습니다.`);
  }
  return code;
}

let html = read('index.html');
let cssCount = 0;
let jsCount = 0;

html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, (_, href) => {
  cssCount += 1;
  return `<style>/* ${href} */\n${guard(read(href), href, 'style')}\n</style>`;
});

html = html.replace(/<script src="([^"]+)"><\/script>/g, (_, src) => {
  jsCount += 1;
  return `<script>/* ${src} */\n${guard(read(src), src, 'script')}\n</script>`;
});

if (/<link rel="stylesheet"|<script src=/.test(html)) {
  throw new Error('합치지 못한 외부 파일 참조가 남아 있습니다.');
}

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT, html);
console.log(`CSS ${cssCount}개, JS ${jsCount}개를 합쳤습니다 → ${path.relative(path.resolve(ROOT, '..'), OUT)} (${Math.round(html.length / 1024)}KB)`);

/*
 * --artifact <경로>: claude.ai 아티팩트(웹 페이지)로 올릴 판.
 * 아티팩트는 문서 뼈대(doctype/html/head/body, charset·viewport)를 스스로 씌우므로
 * 그 태그들을 빼고 <title> 과 <style> 을 맨 앞에 둡니다.
 */
const ai = process.argv.indexOf('--artifact');
if (ai >= 0 && process.argv[ai + 1]) {
  const out = path.resolve(process.argv[ai + 1]);
  let page = html
    .replace(/<!DOCTYPE html>\s*/i, '')
    .replace(/<\/?html[^>]*>\s*/gi, '')
    .replace(/<\/?head>\s*/gi, '')
    .replace(/<\/?body>\s*/gi, '')
    .replace(/<meta charset="[^"]*">\s*/i, '')
    .replace(/<meta name="viewport"[^>]*>\s*/i, '');
  const title = page.match(/<title>[^<]*<\/title>/i)[0];
  page = title + '\n' + page.replace(title, '');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, page);
  console.log(`아티팩트 판 → ${out} (${Math.round(page.length / 1024)}KB)`);
}
