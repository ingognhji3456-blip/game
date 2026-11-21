'use strict';

/* =========================================================
 * NEON RAID — 그래픽 도우미
 *  - 오프스크린 캔버스 · 그림 캐시 (빛 번짐 점, 탄, 배경 성운, 화면 테두리 어둡게)
 *  - 색 밝게/어둡게 (금속 명암용)
 * 게임 규칙과는 상관없고, 그리는 모습만 담당합니다.
 * ========================================================= */

/** 화면에 붙지 않는 캔버스 (브라우저: <canvas>, 워커: OffscreenCanvas, 그 밖에는 null) */
function makeCanvas(w, h) {
  if (typeof document !== 'undefined' && document.createElement) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  return null;
}

/** '#RRGGBB' 꼴인지 */
function isHex(c) { return typeof c === 'string' && c.length === 7 && c[0] === '#'; }

/** f > 0 이면 흰색 쪽으로, f < 0 이면 검은색 쪽으로 (−1 ~ 1) */
function shadeHex(hex, f) {
  if (!isHex(hex)) return hex;
  const [r, g, b] = hexToRgb(hex);
  if (f >= 0) return rgbToHex(r + (255 - r) * f, g + (255 - g) * f, b + (255 - b) * f);
  return rgbToHex(r * (1 + f), g * (1 + f), b * (1 + f));
}

/** 명암을 넣을 만큼 밝은 색인지 (어두운 UI 바탕색에는 금속 명암을 넣지 않음) */
function isShadeable(c) {
  if (!isHex(c)) return false;
  const [r, g, b] = hexToRgb(c);
  return Math.max(r, g, b) > 90;
}

/** 아주 단순한 시드 난수 (배경 성운 배치용 — 게임의 Math.random 순서를 건드리지 않음) */
function seededRandom(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

/**
 * 그림 캐시. 게임 좌표(540×960) 단위로 그리고, 화면 배율(scale)만큼 고해상도로 만들어 둡니다.
 * 배율이 바뀌면 다시 만듭니다. 크기가 정해진 큰 그림(배경 등)은 fixed 에 따로 둡니다.
 */
class SpriteCache {
  constructor() {
    this.scale = 1;
    this.map = new Map();
    this.fixed = new Map();
  }
  setScale(s) {
    if (s === this.scale) return;
    this.scale = s;
    this.map.clear();
  }
  /** 정사각형 그림: size(게임 좌표) 안에 draw(ctx, size) 로 그림 */
  get(key, size, draw) {
    let c = this.map.get(key);
    if (c === undefined) {
      const px = Math.max(2, Math.ceil(size * this.scale));
      c = makeCanvas(px, px);
      if (c) {
        const x = c.getContext('2d');
        x.scale(px / size, px / size);
        draw(x, size);
      }
      if (this.map.size > 400) this.map.clear();
      this.map.set(key, c);
    }
    return c;
  }
  /** 크기가 정해진 그림 (배율과 상관없이 w×h 픽셀) */
  once(key, w, h, draw) {
    let c = this.fixed.get(key);
    if (c === undefined) {
      c = makeCanvas(w, h);
      if (c) draw(c.getContext('2d'), w, h);
      this.fixed.set(key, c);
    }
    return c;
  }
}

const GFX = {
  /** 빛 번짐 점: 가운데가 밝고 가장자리로 사라지는 원 (더하기 합성으로 그리면 네온 빛) */
  glow(cache, color) {
    return cache.get('glow|' + color, 64, (x, s) => {
      const [r, g, b] = hexToRgb(color);
      const grd = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      grd.addColorStop(0, `rgba(${r},${g},${b},0.85)`);
      grd.addColorStop(0.25, `rgba(${r},${g},${b},0.4)`);
      grd.addColorStop(0.6, `rgba(${r},${g},${b},0.1)`);
      grd.addColorStop(1, `rgba(${r},${g},${b},0)`);
      x.fillStyle = grd;
      x.fillRect(0, 0, s, s);
    });
  },

  /** 적 탄: 색 번짐 + 색 테두리 + 하얗게 달아오른 가운데 (탄막 슈팅에서 가장 잘 보이는 모양) */
  bullet(cache, color, r) {
    const rr = Math.round(r * 2) / 2;
    const size = rr * 4.4;
    return cache.get(`bullet|${color}|${rr}`, size, (x, s) => {
      const c = s / 2;
      const [cr, cg, cb] = hexToRgb(color);
      const halo = x.createRadialGradient(c, c, rr * 0.6, c, c, c);
      halo.addColorStop(0, `rgba(${cr},${cg},${cb},0.55)`);
      halo.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
      x.fillStyle = halo;
      x.fillRect(0, 0, s, s);
      const body = x.createRadialGradient(c - rr * 0.25, c - rr * 0.3, rr * 0.1, c, c, rr);
      body.addColorStop(0, '#FFFFFF');
      body.addColorStop(0.45, shadeHex(color, 0.55));
      body.addColorStop(0.8, color);
      body.addColorStop(1, shadeHex(color, -0.35));
      x.fillStyle = body;
      x.beginPath(); x.arc(c, c, rr, 0, Math.PI * 2); x.fill();
    });
  },

  /** 배경: 깊은 우주 그라데이션 + 성운 + 먼지 별 (스테이지마다 색이 다름). 540×960 고정 */
  space(cache, palette, seed) {
    return cache.once('space|' + palette.join(',') + '|' + seed, WIDTH, HEIGHT, (x, w, h) => {
      const base = x.createLinearGradient(0, 0, 0, h);
      base.addColorStop(0, '#05040F');
      base.addColorStop(0.5, '#070519');
      base.addColorStop(1, '#020208');
      x.fillStyle = base;
      x.fillRect(0, 0, w, h);
      const rnd = seededRandom(seed);
      x.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 7; i++) {
        const col = palette[i % palette.length];
        const [r, g, b] = hexToRgb(col);
        const cx = rnd() * w, cy = rnd() * h, rad = 160 + rnd() * 300;
        const a = 0.05 + rnd() * 0.07;
        const grd = x.createRadialGradient(cx, cy, 0, cx, cy, rad);
        grd.addColorStop(0, `rgba(${r},${g},${b},${a})`);
        grd.addColorStop(0.5, `rgba(${r},${g},${b},${a * 0.4})`);
        grd.addColorStop(1, `rgba(${r},${g},${b},0)`);
        x.fillStyle = grd;
        x.fillRect(0, 0, w, h);
      }
      // 아주 멀리 있는 먼지 별
      for (let i = 0; i < 520; i++) {
        const a = 0.08 + rnd() * 0.3;
        x.fillStyle = `rgba(200,210,255,${a})`;
        const sz = rnd() < 0.9 ? 1 : 1.5;
        x.fillRect(rnd() * w, rnd() * h, sz, sz);
      }
      x.globalCompositeOperation = 'source-over';
    });
  },

  /** 화면 가장자리를 살짝 어둡게 (렌즈 느낌). 540×960 고정 */
  vignette(cache) {
    return cache.once('vignette', WIDTH, HEIGHT, (x, w, h) => {
      const grd = x.createRadialGradient(w / 2, h * 0.48, h * 0.32, w / 2, h * 0.48, h * 0.75);
      grd.addColorStop(0, 'rgba(0,0,0,0)');
      grd.addColorStop(1, 'rgba(0,0,0,0.55)');
      x.fillStyle = grd;
      x.fillRect(0, 0, w, h);
    });
  },
};
