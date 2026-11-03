'use strict';

/* =========================================================
 * 하늘 사냥꾼 — 픽셀 그림 엔진
 *
 * 게임 화면은 225×400 픽셀(논리 좌표 450×800 의 절반)로 그린 뒤
 * 계단 모양 그대로(번짐 없이) 크게 늘립니다.
 *
 * ▸ 글자 그림:  SH.pix.sprite(name, { palette, frames })
 *     palette: { 글자: '#rrggbb' | '#rrggbbaa' }   ('.' 과 ' ' 은 투명)
 *     frames : [ [ '..kk..', '.kwwk.', ... ], ... ]  — 모든 프레임은 같은 크기
 * ▸ 코드 그림:  SH.pix.paint(name, w, h, frameCount, (P, f) => { P.circle(...); P.outline('#1b1230'); })
 *     P: set get rect circle ellipse line poly stamp outline replace mirror shadeY dither
 * ▸ 그리기:     SH.pix.draw(ctx, name, x, y, { frame, flash, flipX, alpha, scale })  — x,y 는 그림 가운데
 * ▸ 글자:       SH.pix.text(ctx, str, x, y, { color, align, outline, scale })
 *     영문·숫자는 5×7 픽셀 글꼴, 한글이 섞이면 시스템 글꼴을 픽셀처럼 깎아서 씀
 * ========================================================= */

SH.pix = (() => {
  const defs = {};
  const cache = new Map();
  const isNode = typeof document === 'undefined';

  /* ---------------- 색 ---------------- */
  const colorCache = new Map();
  function rgba(hex) {
    let c = colorCache.get(hex);
    if (c) return c;
    const h = hex.replace('#', '');
    const n = h.length === 3 ? h.split('').map((x) => x + x).join('') : h;
    c = [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16), n.length >= 8 ? parseInt(n.slice(6, 8), 16) : 255];
    if (c.some((v) => Number.isNaN(v))) throw new Error(`잘못된 색: ${hex}`);
    colorCache.set(hex, c);
    return c;
  }

  /* ---------------- 등록 ---------------- */
  function sprite(name, d) {
    if (!d || !d.palette || !Array.isArray(d.frames) || !d.frames.length) throw new Error(`[pix] ${name}: palette 와 frames 가 필요합니다`);
    const h = d.frames[0].length;
    let w = 0;
    d.frames.forEach((fr, i) => {
      if (fr.length !== h) throw new Error(`[pix] ${name}: ${i}번 프레임 높이 ${fr.length} ≠ ${h}`);
      fr.forEach((row, y) => {
        w = Math.max(w, row.length);
        for (const ch of row) {
          if (ch !== '.' && ch !== ' ' && !(ch in d.palette)) throw new Error(`[pix] ${name}: ${i}번 프레임 ${y}줄에 팔레트에 없는 글자 '${ch}'`);
        }
      });
    });
    d.palette = Object.assign({}, d.palette);
    for (const k of Object.keys(d.palette)) rgba(d.palette[k]);
    defs[name] = { name, w, h, n: d.frames.length, kind: 'rows', d };
    return defs[name];
  }

  function paint(name, w, h, n, fn) {
    defs[name] = { name, w, h, n: n || 1, kind: 'paint', fn };
    return defs[name];
  }

  /** 다른 그림을 색만 바꿔 새 이름으로 등록. map: { '#원래색': '#새색' } */
  function recolor(name, base, map) {
    const b = defs[base];
    if (!b) throw new Error(`[pix] recolor: ${base} 없음`);
    const m = {};
    for (const [from, to] of Object.entries(map)) m[rgba(from).join(',')] = rgba(to);
    defs[name] = { name, w: b.w, h: b.h, n: b.n, kind: 'recolor', base, map: m };
    return defs[name];
  }

  /* ---------------- 코드로 그리는 붓 ---------------- */
  function painter(w, h) {
    const px = new Array(w * h).fill(null);
    const inb = (x, y) => x >= 0 && y >= 0 && x < w && y < h;
    const P = {
      w, h, px,
      set(x, y, c) { x = Math.round(x); y = Math.round(y); if (inb(x, y)) px[y * w + x] = c; },
      get(x, y) { x = Math.round(x); y = Math.round(y); return inb(x, y) ? px[y * w + x] : null; },
      clear(x, y) { P.set(x, y, null); },
      rect(x, y, rw, rh, c) { for (let j = 0; j < rh; j++) for (let i = 0; i < rw; i++) P.set(x + i, y + j, c); },
      /** 꽉 찬 원 (가운데 cx,cy 는 소수 .5 도 됨) */
      circle(cx, cy, r, c) { P.ellipse(cx, cy, r, r, c); },
      ellipse(cx, cy, rx, ry, c) {
        for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) {
          for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
            const dx = (x + 0.5 - cx) / (rx + 0.3), dy = (y + 0.5 - cy) / (ry + 0.3);
            if (dx * dx + dy * dy <= 1) P.set(x, y, c);
          }
        }
      },
      line(x0, y0, x1, y1, c) {
        x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
        const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
        let err = dx + dy;
        for (;;) {
          P.set(x0, y0, c);
          if (x0 === x1 && y0 === y1) break;
          const e2 = 2 * err;
          if (e2 >= dy) { err += dy; x0 += sx; }
          if (e2 <= dx) { err += dx; y0 += sy; }
        }
      },
      /** 다각형 채우기 pts = [x0,y0, x1,y1, ...] */
      poly(pts, c) {
        let minY = Infinity, maxY = -Infinity;
        for (let i = 1; i < pts.length; i += 2) { minY = Math.min(minY, pts[i]); maxY = Math.max(maxY, pts[i]); }
        for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
          const yc = y + 0.5;
          const xs = [];
          for (let i = 0; i < pts.length; i += 2) {
            const x0 = pts[i], y0 = pts[i + 1];
            const j = (i + 2) % pts.length;
            const x1 = pts[j], y1 = pts[j + 1];
            if ((y0 <= yc && y1 > yc) || (y1 <= yc && y0 > yc)) xs.push(x0 + ((yc - y0) / (y1 - y0)) * (x1 - x0));
          }
          xs.sort((a, b) => a - b);
          for (let k = 0; k + 1 < xs.length; k += 2) {
            for (let x = Math.ceil(xs[k] - 0.5); x <= Math.floor(xs[k + 1] - 0.5); x++) P.set(x, y, c);
          }
        }
      },
      /** 글자 그림을 (x,y) 왼쪽 위에 찍기 */
      stamp(rows, palette, x, y, flipX) {
        rows.forEach((row, j) => {
          for (let i = 0; i < row.length; i++) {
            const ch = row[flipX ? row.length - 1 - i : i];
            if (ch === '.' || ch === ' ') continue;
            if (!(ch in palette)) throw new Error(`[pix] stamp: 팔레트에 없는 글자 '${ch}'`);
            P.set(x + i, y + j, palette[ch]);
          }
        });
      },
      /** 비어 있는 칸 중 그림에 닿은 칸을 c 로 (diag: 대각선도) */
      outline(c, diag) {
        const add = [];
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            if (px[y * w + x] !== null) continue;
            const n = (xx, yy) => inb(xx, yy) && px[yy * w + xx] !== null && px[yy * w + xx] !== c;
            if (n(x - 1, y) || n(x + 1, y) || n(x, y - 1) || n(x, y + 1) || (diag && (n(x - 1, y - 1) || n(x + 1, y - 1) || n(x - 1, y + 1) || n(x + 1, y + 1)))) add.push(y * w + x);
          }
        }
        for (const i of add) px[i] = c;
      },
      replace(from, to) { for (let i = 0; i < px.length; i++) if (px[i] === from) px[i] = to; },
      /** 왼쪽 절반을 오른쪽에 거울처럼 복사 */
      mirror() { for (let y = 0; y < h; y++) for (let x = 0; x < Math.floor(w / 2); x++) px[y * w + (w - 1 - x)] = px[y * w + x]; },
      /** 바둑판 무늬로 섞기: 영역 안의 색 a 칸 중 절반을 b 로 */
      dither(x, y, rw, rh, a, b) {
        for (let j = 0; j < rh; j++) for (let i = 0; i < rw; i++) {
          if (((x + i + y + j) & 1) === 0 && P.get(x + i, y + j) === a) P.set(x + i, y + j, b);
        }
      },
      /** 세로 위치에 따라 색 바꾸기: fn(y, color) → color */
      shadeY(fn) { for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const c = px[y * w + x]; if (c !== null) px[y * w + x] = fn(y, c, x); } },
    };
    return P;
  }

  /* ---------------- 프레임 → 캔버스 ---------------- */
  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  function framePixels(def, f) {
    // [r,g,b,a] 배열 또는 null 의 1차원 배열
    const out = new Array(def.w * def.h).fill(null);
    if (def.kind === 'rows') {
      const rows = def.d.frames[f];
      for (let y = 0; y < def.h; y++) {
        const row = rows[y];
        for (let x = 0; x < row.length; x++) {
          const ch = row[x];
          if (ch === '.' || ch === ' ') continue;
          out[y * def.w + x] = rgba(def.d.palette[ch]);
        }
      }
    } else if (def.kind === 'paint') {
      const P = painter(def.w, def.h);
      def.fn(P, f, def.n);
      for (let i = 0; i < P.px.length; i++) if (P.px[i] !== null) out[i] = rgba(P.px[i]);
    } else if (def.kind === 'recolor') {
      const src = framePixels(defs[def.base], f);
      for (let i = 0; i < src.length; i++) {
        const c = src[i];
        if (!c) continue;
        out[i] = def.map[c.join(',')] || c;
      }
    }
    return out;
  }

  function get(name, frame, flash) {
    const def = defs[name];
    if (!def) return null;
    const f = (((frame | 0) % def.n) + def.n) % def.n;
    const key = name + '|' + f + (flash ? '|f' : '');
    let c = cache.get(key);
    if (c) return c;
    const pixels = framePixels(def, f);
    c = makeCanvas(def.w, def.h);
    const x = c.getContext('2d');
    const img = x.createImageData(def.w, def.h);
    for (let i = 0; i < pixels.length; i++) {
      const p = pixels[i];
      if (!p) continue;
      const o = i * 4;
      if (flash && p[3] > 0) { img.data[o] = 255; img.data[o + 1] = 255; img.data[o + 2] = 255; img.data[o + 3] = 255; }
      else { img.data[o] = p[0]; img.data[o + 1] = p[1]; img.data[o + 2] = p[2]; img.data[o + 3] = p[3]; }
    }
    x.putImageData(img, 0, 0);
    cache.set(key, c);
    return c;
  }

  /** 그림 가운데를 (x,y) 에 맞춰 그리기 (픽셀 격자에 맞춤) */
  function draw(ctx, name, x, y, o) {
    const def = defs[name];
    if (!def) return false;
    const sc = (o && o.scale) || 1;
    const img = get(name, o && o.frame, o && o.flash);
    const w = def.w * sc, h = def.h * sc;
    const dx = Math.round(x - w / 2), dy = Math.round(y - h / 2);
    const alpha = o && o.alpha != null ? o.alpha : 1;
    if (alpha <= 0) return true;
    if (alpha !== 1) ctx.globalAlpha = alpha;
    if (o && o.flipX) {
      ctx.save();
      ctx.translate(dx + w, dy);
      ctx.scale(-1, 1);
      ctx.drawImage(img, 0, 0, w, h);
      ctx.restore();
    } else ctx.drawImage(img, dx, dy, w, h);
    if (alpha !== 1) ctx.globalAlpha = 1;
    return true;
  }

  function info(name) { const d = defs[name]; return d ? { w: d.w, h: d.h, n: d.n } : null; }
  function has(name) { return !!defs[name]; }
  function names() { return Object.keys(defs); }

  /** 첫 등장 때 끊기지 않도록 조금씩 미리 만들어 둠 */
  function preload(done) {
    const jobs = [];
    for (const n of names()) for (let f = 0; f < defs[n].n; f++) { jobs.push([n, f, false]); jobs.push([n, f, true]); }
    let i = 0;
    const step = () => {
      const t0 = Date.now();
      while (i < jobs.length && Date.now() - t0 < 6) { get(jobs[i][0], jobs[i][1], jobs[i][2]); i++; }
      if (i < jobs.length) setTimeout(step, 0); else if (done) done();
    };
    step();
  }

  /* =========================================================
   * 5×7 픽셀 글꼴 (영문 대문자·숫자·기호)
   * 한 글자 = 7줄, 각 줄은 5칸 (1 = 칠함)
   * ========================================================= */
  const G = {
    'A': ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
    'B': ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
    'C': ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
    'D': ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
    'E': ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
    'F': ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
    'G': ['01110', '10001', '10000', '10111', '10001', '10001', '01111'],
    'H': ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
    'I': ['01110', '00100', '00100', '00100', '00100', '00100', '01110'],
    'J': ['00111', '00010', '00010', '00010', '00010', '10010', '01100'],
    'K': ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
    'L': ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
    'M': ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
    'N': ['10001', '10001', '11001', '10101', '10011', '10001', '10001'],
    'O': ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
    'P': ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
    'Q': ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
    'R': ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
    'S': ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
    'T': ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
    'U': ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
    'V': ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
    'W': ['10001', '10001', '10001', '10101', '10101', '10101', '01010'],
    'X': ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
    'Y': ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
    'Z': ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
    '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
    '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
    '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
    '3': ['11111', '00010', '00100', '00010', '00001', '10001', '01110'],
    '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
    '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
    '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
    '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
    '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
    '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
    ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
    '.': ['00000', '00000', '00000', '00000', '00000', '01100', '01100'],
    ',': ['00000', '00000', '00000', '00000', '01100', '00100', '01000'],
    ':': ['00000', '01100', '01100', '00000', '01100', '01100', '00000'],
    '!': ['00100', '00100', '00100', '00100', '00100', '00000', '00100'],
    '?': ['01110', '10001', '00001', '00010', '00100', '00000', '00100'],
    '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
    '+': ['00000', '00100', '00100', '11111', '00100', '00100', '00000'],
    '/': ['00001', '00010', '00010', '00100', '01000', '01000', '10000'],
    "'": ['00100', '00100', '01000', '00000', '00000', '00000', '00000'],
    '(': ['00010', '00100', '01000', '01000', '01000', '00100', '00010'],
    ')': ['01000', '00100', '00010', '00010', '00010', '00100', '01000'],
    '%': ['11001', '11010', '00010', '00100', '01000', '01011', '10011'],
    'x': ['00000', '00000', '10001', '01010', '00100', '01010', '10001'],
    '*': ['00000', '10101', '01110', '11111', '01110', '10101', '00000'],
    '#': ['01010', '01010', '11111', '01010', '11111', '01010', '01010'],
    '<': ['00010', '00100', '01000', '10000', '01000', '00100', '00010'],
    '>': ['01000', '00100', '00010', '00001', '00010', '00100', '01000'],
    '=': ['00000', '00000', '11111', '00000', '11111', '00000', '00000'],
    '_': ['00000', '00000', '00000', '00000', '00000', '00000', '11111'],
    '♥': ['00000', '01010', '11111', '11111', '01110', '00100', '00000'],
    '▶': ['01000', '01100', '01110', '01111', '01110', '01100', '01000'],
    '◀': ['00010', '00110', '01110', '11110', '01110', '00110', '00010'],
  };
  const glyphCache = new Map();
  function glyph(ch, color) {
    const key = ch + color;
    let c = glyphCache.get(key);
    if (c) return c;
    const rows = G[ch] || G['?'];
    c = makeCanvas(5, 7);
    const x = c.getContext('2d');
    x.fillStyle = color;
    rows.forEach((r, j) => { for (let i = 0; i < 5; i++) if (r[i] === '1') x.fillRect(i, j, 1, 1); });
    glyphCache.set(key, c);
    return c;
  }

  const hasWide = (s) => /[^\x00-\x7f♥▶◀×]/.test(s);

  /* 한글: 시스템 글꼴을 작게 그린 뒤 반투명 칸을 깎아 또렷한 픽셀로 */
  const hanCache = new Map();
  function hanBitmap(str, size, color) {
    const key = str + '|' + size + '|' + color;
    let c = hanCache.get(key);
    if (c) return c;
    if (hanCache.size > 400) hanCache.clear();
    const font = `bold ${size}px 'Apple SD Gothic Neo', 'Malgun Gothic', 'Noto Sans KR', 'Noto Sans CJK KR', sans-serif`;
    const m = makeCanvas(4, 4).getContext('2d');
    m.font = font;
    const w = Math.ceil(m.measureText(str).width) + 2;
    const h = Math.ceil(size * 1.25) + 2;
    c = makeCanvas(Math.max(1, w), h);
    const x = c.getContext('2d');
    x.font = font;
    x.textBaseline = 'middle';
    x.fillStyle = '#fff';
    x.fillText(str, 1, Math.round(h / 2));
    const img = x.getImageData(0, 0, c.width, c.height);
    const col = rgba(color);
    for (let i = 0; i < img.data.length; i += 4) {
      const on = img.data[i + 3] >= 120;
      img.data[i] = col[0]; img.data[i + 1] = col[1]; img.data[i + 2] = col[2]; img.data[i + 3] = on ? 255 : 0;
    }
    x.putImageData(img, 0, 0);
    hanCache.set(key, c);
    return c;
  }

  /** 글자 너비 (픽셀) */
  function measure(str, o) {
    const sc = (o && o.scale) || 1;
    if (hasWide(str)) return hanBitmap(str, (o && o.size) || 11, '#fff').width * sc;
    return Math.max(0, str.length * 6 - 1) * sc;
  }

  /**
   * 글자 쓰기. y 는 글자 세로 가운데.
   * o: { color, align: left|center|right, outline: 색 | false, shadow: 색, scale, size(한글 크기) }
   */
  function text(ctx, str, x, y, o) {
    o = o || {};
    str = String(str);
    const color = o.color || '#ffffff';
    const sc = o.scale || 1;
    const outline = o.outline === undefined ? '#1b1230' : o.outline;
    const w = measure(str, o);
    let x0 = Math.round(o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x);
    if (hasWide(str)) {
      const size = o.size || 11;
      const main = hanBitmap(str, size, color);
      const hh = main.height * sc;
      const y0 = Math.round(y - hh / 2);
      const dw = main.width * sc;
      if (outline) {
        const ol = hanBitmap(str, size, outline);
        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]) ctx.drawImage(ol, x0 + dx * sc, y0 + dy * sc, dw, hh);
      }
      if (o.shadow) ctx.drawImage(hanBitmap(str, size, o.shadow), x0, y0 + (outline ? 2 : 1) * sc, dw, hh);
      ctx.drawImage(main, x0, y0, dw, hh);
      return w;
    }
    const y0 = Math.round(y - (7 * sc) / 2);
    const up = str.toUpperCase();
    const pass = (col, ox, oy) => {
      for (let i = 0; i < up.length; i++) {
        let ch = up[i];
        if (ch === '×') ch = 'x';
        if (ch === ' ') continue;
        ctx.drawImage(glyph(ch, col), x0 + i * 6 * sc + ox, y0 + oy, 5 * sc, 7 * sc);
      }
    };
    if (outline) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]) pass(outline, dx * sc, dy * sc);
    if (o.shadow) pass(o.shadow, 0, (outline ? 2 : 1) * sc);
    pass(color, 0, 0);
    return w;
  }

  return { sprite, paint, recolor, painter, get, draw, info, has, names, preload, text, measure, rgba, defs, isNode };
})();
