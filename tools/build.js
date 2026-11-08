'use strict';

/*
 * 한 파일짜리 게임 만들기: 각 게임의 index.html 이 불러오는 CSS/JS 를 모두 안에 넣어
 * dist/ 아래 HTML 파일 하나만으로 실행되게 합니다.
 *   node tools/build.js
 *   - index.html       → dist/card-expedition.html (카드 원정대)
 *   - earth/index.html → dist/earth-chronicle.html (지구 연대기)
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'dist');

function guard(code, rel, tag) {
  if (new RegExp(`</${tag}`, 'i').test(code)) {
    throw new Error(`${rel} 안에 </${tag} 문자열이 있어 한 파일로 합칠 수 없습니다.`);
  }
  return code;
}

function build(entryRel, outName) {
  const base = path.dirname(path.join(ROOT, entryRel));
  const read = (rel) => fs.readFileSync(path.join(base, rel), 'utf8');
  let html = fs.readFileSync(path.join(ROOT, entryRel), 'utf8');
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
    throw new Error(`${entryRel}: 합치지 못한 외부 파일 참조가 남아 있습니다.`);
  }

  const out = path.join(OUT_DIR, outName);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(out, html);
  console.log(`${entryRel}: CSS ${cssCount}개, JS ${jsCount}개를 합쳤습니다 → ${path.relative(ROOT, out)} (${Math.round(html.length / 1024)}KB)`);
}

build('index.html', 'card-expedition.html');
build('earth/index.html', 'earth-chronicle.html');
