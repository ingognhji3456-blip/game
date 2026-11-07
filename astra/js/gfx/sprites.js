'use strict';

/* =========================================================
 * ASTRA : ZERO PROTOCOL — 캐릭터 스프라이트 (절차적 캔버스 드로잉)
 *
 *   AZ.gfx.sprites.draw(g, ent, W, t)
 *     g 는 이미 엔티티의 발밑(0,0)으로 옮겨지고 카메라 배율이 적용된 상태.
 *     그림자·선택 표시·방벽·HP 바·피격 번쩍임은 렌더러가 그린다.
 *   AZ.gfx.sprites.drawPortraitIcon(g, id, size)
 *     HUD 용 작은 얼굴 아이콘 (kai / lia / zero), (0,0) 가운데 정렬.
 *
 * 화면 규칙: 3/4 내려다보기. 캐릭터는 똑바로 서서(-y 가 위) 그리고,
 * cos(facing) 부호로 좌우를 뒤집는다. 설계 좌표는 "오른쪽을 봄" 기준.
 * ========================================================= */
window.AZ = window.AZ || {};
AZ.gfx = AZ.gfx || {};

AZ.gfx.sprites = (() => {
  const TAU = Math.PI * 2;
  const PI = Math.PI;
  const HALF = Math.PI / 2;
  const HAS_DOM = typeof document !== 'undefined';
  const SQ = 0.62; // 월드 y 납작 배율

  /* ───────────── 수학 도우미 ───────────── */
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const lerp = (a, b, k) => a + (b - a) * k;
  const easeOut = (k) => 1 - (1 - k) * (1 - k);
  const easeOut3 = (k) => 1 - (1 - k) * (1 - k) * (1 - k);
  const easeIn = (k) => k * k;
  const smooth = (k) => k * k * (3 - 2 * k);
  const hash = (n) => {
    const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  const pulse = (t, f) => 0.5 + 0.5 * Math.sin(t * f);

  /* ───────────── 색 도우미 ───────────── */
  const rgbCache = new Map();
  function toRgb(c) {
    let v = rgbCache.get(c);
    if (v) return v;
    let r = 255;
    let gg = 255;
    let b = 255;
    if (typeof c === 'string') {
      if (c[0] === '#') {
        let h = c.slice(1);
        if (h.length === 3 || h.length === 4) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
        const n = parseInt(h.slice(0, 6), 16);
        if (!isNaN(n)) { r = (n >> 16) & 255; gg = (n >> 8) & 255; b = n & 255; }
      } else {
        const m = c.match(/(\d+(?:\.\d+)?)\D+(\d+(?:\.\d+)?)\D+(\d+(?:\.\d+)?)/);
        if (m) { r = +m[1] | 0; gg = +m[2] | 0; b = +m[3] | 0; }
      }
    }
    v = [r, gg, b];
    if (rgbCache.size > 600) rgbCache.clear();
    rgbCache.set(c, v);
    return v;
  }
  function rgba(c, a) {
    const v = toRgb(c);
    const aa = a < 0 ? 0 : a > 1 ? 1 : a;
    return 'rgba(' + v[0] + ',' + v[1] + ',' + v[2] + ',' + aa.toFixed(3) + ')';
  }
  function mix(c1, c2, k) {
    const a = toRgb(c1);
    const b = toRgb(c2);
    return 'rgb(' + ((a[0] + (b[0] - a[0]) * k) | 0) + ',' + ((a[1] + (b[1] - a[1]) * k) | 0) + ',' + ((a[2] + (b[2] - a[2]) * k) | 0) + ')';
  }
  function hsl(h, s, l, a) {
    return 'hsla(' + (h % 360).toFixed(0) + ',' + s + '%,' + l + '%,' + (a == null ? 1 : a).toFixed(3) + ')';
  }

  /* ───────────── 빛 번짐 스프라이트 (가산 합성) ───────────── */
  const glowCache = new Map();
  function glowSprite(color, hot) {
    const key = hot ? color + '|h' : color;
    let c = glowCache.get(key);
    if (c !== undefined) return c;
    c = null;
    if (HAS_DOM) {
      try {
        const cv = document.createElement('canvas');
        cv.width = 64;
        cv.height = 64;
        const x = cv.getContext('2d');
        const v = toRgb(color);
        const s = v[0] + ',' + v[1] + ',' + v[2];
        const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
        if (hot) {
          gr.addColorStop(0, 'rgba(255,255,255,1)');
          gr.addColorStop(0.12, 'rgba(255,255,255,0.9)');
          gr.addColorStop(0.3, 'rgba(' + s + ',0.55)');
        } else {
          gr.addColorStop(0, 'rgba(' + s + ',1)');
          gr.addColorStop(0.2, 'rgba(' + s + ',0.6)');
        }
        gr.addColorStop(0.5, 'rgba(' + s + ',0.2)');
        gr.addColorStop(0.75, 'rgba(' + s + ',0.06)');
        gr.addColorStop(1, 'rgba(' + s + ',0)');
        x.fillStyle = gr;
        x.fillRect(0, 0, 64, 64);
        c = cv;
      } catch (err) {
        c = null;
      }
    }
    glowCache.set(key, c);
    return c;
  }
  /** 가산 합성으로 둥근 빛 번짐 */
  function glow(g, x, y, r, color, a, hot) {
    if (!(r > 0.3) || !(a > 0.005)) return;
    const pa = g.globalAlpha;
    const pc = g.globalCompositeOperation;
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = pa * (a > 1 ? 1 : a);
    const spr = glowSprite(color, hot);
    if (spr) g.drawImage(spr, x - r, y - r, r * 2, r * 2);
    else {
      g.fillStyle = rgba(color, 0.35);
      g.beginPath();
      g.arc(x, y, r * 0.5, 0, TAU);
      g.fill();
    }
    g.globalAlpha = pa;
    g.globalCompositeOperation = pc;
  }
  /** 납작한(타원) 빛 번짐 */
  function glowE(g, x, y, rx, ry, color, a, hot) {
    if (!(rx > 0.3) || !(ry > 0.3) || !(a > 0.005)) return;
    const pa = g.globalAlpha;
    const pc = g.globalCompositeOperation;
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = pa * (a > 1 ? 1 : a);
    const spr = glowSprite(color, hot);
    if (spr) g.drawImage(spr, x - rx, y - ry, rx * 2, ry * 2);
    g.globalAlpha = pa;
    g.globalCompositeOperation = pc;
  }

  /* ───────────── 도형 도우미 ───────────── */
  function poly(g, p) {
    g.beginPath();
    g.moveTo(p[0], p[1]);
    for (let i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]);
    g.closePath();
  }
  function fillPoly(g, p, fill, stroke, lw) {
    poly(g, p);
    if (fill) { g.fillStyle = fill; g.fill(); }
    if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw || 1; g.stroke(); }
  }
  function circ(g, x, y, r) {
    g.beginPath();
    g.arc(x, y, r > 0 ? r : 0.01, 0, TAU);
  }
  function fillCirc(g, x, y, r, fill) {
    circ(g, x, y, r);
    g.fillStyle = fill;
    g.fill();
  }
  function ell(g, x, y, rx, ry, rot) {
    g.beginPath();
    g.ellipse(x, y, rx > 0.01 ? rx : 0.01, ry > 0.01 ? ry : 0.01, rot || 0, 0, TAU);
  }
  function fillEll(g, x, y, rx, ry, rot, fill) {
    ell(g, x, y, rx, ry, rot);
    g.fillStyle = fill;
    g.fill();
  }
  function seg(g, x1, y1, x2, y2, w, col) {
    g.beginPath();
    g.moveTo(x1, y1);
    g.lineTo(x2, y2);
    g.strokeStyle = col;
    g.lineWidth = w;
    g.stroke();
  }
  /** 네온 선 (가산 합성, 두 겹) */
  function neon(g, x1, y1, x2, y2, color, w, a) {
    const aa = a == null ? 1 : a;
    if (aa <= 0.01) return;
    const pc = g.globalCompositeOperation;
    g.globalCompositeOperation = 'lighter';
    g.beginPath();
    g.moveTo(x1, y1);
    g.lineTo(x2, y2);
    g.strokeStyle = rgba(color, 0.22 * aa);
    g.lineWidth = w * 3.2;
    g.stroke();
    g.strokeStyle = rgba(color, 0.95 * aa);
    g.lineWidth = w;
    g.stroke();
    g.globalCompositeOperation = pc;
  }
  /** 네온 꺾은선 */
  function neonPath(g, p, color, w, a, closed) {
    const aa = a == null ? 1 : a;
    if (aa <= 0.01) return;
    const pc = g.globalCompositeOperation;
    g.globalCompositeOperation = 'lighter';
    g.beginPath();
    g.moveTo(p[0], p[1]);
    for (let i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]);
    if (closed) g.closePath();
    g.strokeStyle = rgba(color, 0.22 * aa);
    g.lineWidth = w * 3.2;
    g.stroke();
    g.strokeStyle = rgba(color, 0.95 * aa);
    g.lineWidth = w;
    g.stroke();
    g.globalCompositeOperation = pc;
  }
  /** 가산 합성으로 도형 채우기 */
  function addFill(g, color, a) {
    const pc = g.globalCompositeOperation;
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = rgba(color, a);
    g.fill();
    g.globalCompositeOperation = pc;
  }
  /** 불꽃 튀기 (결정적 의사 난수, 시간에 따라 순환) */
  function sparks(g, t, n, cx, cy, rx, ry, color, seed, w) {
    const pc = g.globalCompositeOperation;
    g.globalCompositeOperation = 'lighter';
    g.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const sp = 0.8 + hash(seed + i * 7.7) * 1.2;
      const ph = (t * sp + hash(seed + i * 3.3)) % 1;
      const ang = hash(seed + i * 5.1 + Math.floor(t * sp + hash(seed + i * 3.3)) * 1.37) * TAU;
      const d = 0.15 + ph * 1.0;
      const x = cx + Math.cos(ang) * rx * d;
      const y = cy + Math.sin(ang) * ry * d + ph * ph * ry * 0.6;
      const len = (1 - ph) * (rx * 0.18 + 2);
      g.strokeStyle = rgba(color, (1 - ph) * 0.95);
      g.lineWidth = w || 1.2;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x - Math.cos(ang) * len, y - Math.sin(ang) * len + ph * 2);
      g.stroke();
    }
    g.globalCompositeOperation = pc;
  }

  /* ───────────── 엔티티별 장식 기억 (좌우 반전 히스테리시스 등) ───────────── */
  const memo = new WeakMap();
  function M(e) {
    let m = memo.get(e);
    if (!m) {
      m = { fx: Math.cos(e.facing || 0) < -0.05 ? -1 : 1, atk: null };
      memo.set(e, m);
    }
    return m;
  }
  function faceX(e) {
    const m = M(e);
    const c = Math.cos(e.facing || 0);
    if (c > 0.14) m.fx = 1;
    else if (c < -0.14) m.fx = -1;
    return m.fx;
  }
  const isAway = (e) => Math.sin(e.facing || 0) < -0.62;

  /* =========================================================
   * 무기
   * ========================================================= */
  function energyBlade(g, x0, x1, hw, col, I) {
    const pc = g.globalCompositeOperation;
    g.lineCap = 'round';
    g.globalCompositeOperation = 'lighter';
    g.beginPath();
    g.moveTo(x0, 0);
    g.lineTo(x1, 0);
    g.strokeStyle = rgba(col, 0.13 * I);
    g.lineWidth = hw * 7;
    g.stroke();
    g.strokeStyle = rgba(col, 0.35 * I);
    g.lineWidth = hw * 3.4;
    g.stroke();
    g.globalCompositeOperation = pc;
    poly(g, [x0, -hw, x1 - hw * 3, -hw * 0.8, x1, 0, x1 - hw * 3, hw * 0.8, x0, hw]);
    g.fillStyle = col;
    g.fill();
    g.globalCompositeOperation = 'lighter';
    g.beginPath();
    g.moveTo(x0 + 0.5, 0);
    g.lineTo(x1 - hw * 2, 0);
    g.strokeStyle = 'rgba(255,255,255,0.9)';
    g.lineWidth = hw * 0.75;
    g.stroke();
    g.globalCompositeOperation = pc;
  }

  /** 무기 하나 (손 위치, 각도, 내밀기) — 무기 좌표는 +x 가 날 방향 */
  function drawWeapon(g, type, x, y, ang, ext, col, charge, gh, I0) {
    const I = (I0 == null ? 1 : I0) * (1 + (charge || 0) * 0.8);
    g.save();
    g.translate(x + Math.cos(ang) * (ext || 0), y + Math.sin(ang) * (ext || 0));
    g.rotate(ang);
    g.lineCap = 'round';
    switch (type) {
      case 'twin':
      case 'blade': {
        const L = type === 'twin' ? 17 : 27;
        g.fillStyle = gh || '#151a28';
        g.fillRect(-4.6, -0.95, 5, 1.9);
        g.fillStyle = gh || '#b9c6d8';
        g.fillRect(0.1, -2.5, 1.5, 5);
        if (gh) fillPoly(g, [1.6, -1.1, L - 3, -0.9, L, 0, L - 3, 0.9, 1.6, 1.1], gh);
        else {
          energyBlade(g, 1.6, L, type === 'twin' ? 1.0 : 1.15, col, I);
          if (charge > 0) glow(g, L * 0.6, 0, 8 + charge * 8, col, 0.5 * charge);
        }
        break;
      }
      case 'great': {
        g.fillStyle = gh || '#151a28';
        g.fillRect(-9, -1.2, 9.5, 2.4);
        fillCirc(g, -9.4, 0, 1.8, gh || '#8a96ac');
        fillPoly(g, [0, -5, 2.2, -4.2, 2.2, 4.2, 0, 5], gh || '#9aa6bc');
        fillPoly(g, [2.2, -3.7, 34, -3.1, 41.5, 0, 34, 3.1, 2.2, 3.7], gh || '#262c3c');
        if (!gh) {
          fillPoly(g, [2.2, -3.7, 34, -3.1, 41.5, 0, 2.2, -0.4], '#3e475c');
          neonPath(g, [2.6, -3.6, 34, -3.0, 41.2, 0, 34, 3.0, 2.6, 3.6], col, 0.7, 0.85 * I);
          neon(g, 5, 0.6, 30, 0.6, col, 1.1, 0.8 * I);
          glow(g, 36, 0, 6 + (charge || 0) * 12, col, 0.35 + (charge || 0) * 0.5);
        }
        break;
      }
      case 'spear': {
        seg(g, -18, 0, 31, 0, 1.8, gh || '#3a4258');
        if (!gh) {
          seg(g, -17, -0.5, 30, -0.5, 0.5, '#7f8aa3');
          neon(g, -6, -1.8, -6, 1.8, col, 0.8, I);
          neon(g, 9, -1.8, 9, 1.8, col, 0.8, I);
          neon(g, -18.5, 0, -16, 0, col, 1.4, I);
        }
        fillPoly(g, [29.5, -1.5, 31.5, -2.6, 31.5, 2.6, 29.5, 1.5], gh || '#9aa6bc');
        if (gh) fillPoly(g, [31.5, 0, 34.5, -2.6, 45, 0, 34.5, 2.6], gh);
        else {
          const pc = g.globalCompositeOperation;
          poly(g, [31.5, 0, 34.5, -2.8, 45.5, 0, 34.5, 2.8]);
          g.globalCompositeOperation = 'lighter';
          g.strokeStyle = rgba(col, 0.35 * I);
          g.lineWidth = 3.5;
          g.stroke();
          g.globalCompositeOperation = pc;
          g.fillStyle = col;
          g.fill();
          neon(g, 33, 0, 43, 0, '#ffffff', 0.7, 0.9);
          glow(g, 38, 0, 9 + (charge || 0) * 10, col, 0.45 + (charge || 0) * 0.4);
        }
        break;
      }
      case 'rail': {
        fillPoly(g, [-9, -0.6, -2, -2.4, -2, 2.8, -9, 3.6], gh || '#1b2030');
        fillPoly(g, [-2.5, -2.8, 15, -2.8, 15, 2.2, 4, 2.2, 2, 4.6, -1, 4.6, -2.5, 2.2], gh || '#242a3c');
        g.fillStyle = gh || '#3c4560';
        g.fillRect(1.5, -4.6, 7, 1.9);
        seg(g, 13, -1.9, 25, -1.9, 1.1, gh || '#6a748c');
        seg(g, 13, 1.3, 25, 1.3, 1.1, gh || '#6a748c');
        if (!gh) {
          neon(g, 0, -0.3, 13, -0.3, col, 0.7, 0.8 * I);
          neon(g, 13.5, -0.3, 24.5, -0.3, col, 0.9 + (charge || 0) * 1.2, 0.6 + (charge || 0) * 0.4);
          glow(g, 25.5, -0.3, 3 + (charge || 0) * 13, col, 0.5 + (charge || 0) * 0.5, charge > 0.3);
          glow(g, 5, -3.8, 2.4, col, 0.7);
        }
        break;
      }
      case 'rifle': {
        fillPoly(g, [-7, -0.5, -1.5, -2.1, -1.5, 2.4, -7, 3], gh || '#1c2233');
        fillPoly(g, [-1.5, -2.4, 12, -2.4, 12, 1.8, 2.5, 1.8, 1.5, 4.2, -0.5, 4.2, -1.5, 1.8], gh || '#2a3248');
        seg(g, 11.5, -0.6, 18, -0.6, 1.5, gh || '#4a5470');
        if (!gh) {
          neon(g, 0.5, -1.3, 10, -1.3, col, 0.55, 0.7 * I);
          glow(g, 18.5, -0.6, 2 + (charge || 0) * 9, col, 0.4 + (charge || 0) * 0.6, charge > 0.4);
        }
        break;
      }
      case 'longrifle': {
        fillPoly(g, [-9, -0.4, -2, -1.8, -2, 2.2, -9, 3.2], gh || '#241f1c');
        fillPoly(g, [-2, -2, 16, -2, 16, 1.6, 3, 1.6, 2, 3.8, 0, 3.8, -2, 1.6], gh || '#3a332d');
        seg(g, 15, -0.3, 37, -0.3, 1.2, gh || '#544a40');
        g.fillStyle = gh || '#1a1614';
        g.fillRect(2, -5, 10, 2.4);
        if (!gh) {
          fillCirc(g, 12.4, -3.8, 1.3, '#ffb35c');
          glow(g, 12.6, -3.8, 4 + pulse(I * 3, 1) * 3, '#ffb35c', 0.8, true);
          neon(g, 16, -0.3, 36, -0.3, col, 0.5 + (charge || 0), 0.3 + (charge || 0) * 0.7);
          glow(g, 37.5, -0.3, 2 + (charge || 0) * 13, col, 0.35 + (charge || 0) * 0.65, charge > 0.4);
        }
        break;
      }
      case 'katana': {
        g.fillStyle = gh || '#140c10';
        g.fillRect(-6, -1, 6.4, 2);
        fillPoly(g, [0.3, -2.3, 1.7, -2.3, 1.7, 2.3, 0.3, 2.3], gh || '#2a1a20');
        if (gh) {
          g.beginPath();
          g.moveTo(1.7, -0.9);
          g.quadraticCurveTo(16, -1.6, 32, 0.6);
          g.quadraticCurveTo(16, 0.6, 1.7, 1);
          g.closePath();
          g.fillStyle = gh;
          g.fill();
        } else {
          const pc = g.globalCompositeOperation;
          g.globalCompositeOperation = 'lighter';
          g.beginPath();
          g.moveTo(1.7, 0);
          g.quadraticCurveTo(16, -0.8, 32, 0.6);
          g.strokeStyle = rgba(col, 0.14 * I);
          g.lineWidth = 7.5;
          g.stroke();
          g.strokeStyle = rgba(col, 0.38 * I);
          g.lineWidth = 3.6;
          g.stroke();
          g.globalCompositeOperation = pc;
          g.beginPath();
          g.moveTo(1.7, -1);
          g.quadraticCurveTo(16, -1.8, 32.5, 0.6);
          g.quadraticCurveTo(16, 0.5, 1.7, 1);
          g.closePath();
          g.fillStyle = col;
          g.fill();
          g.globalCompositeOperation = 'lighter';
          g.beginPath();
          g.moveTo(2.5, -0.3);
          g.quadraticCurveTo(16, -1.1, 30, 0.4);
          g.strokeStyle = 'rgba(255,225,230,0.9)';
          g.lineWidth = 0.75;
          g.stroke();
          g.globalCompositeOperation = pc;
          if (charge > 0) glow(g, 18, 0, 10 + charge * 10, col, 0.55 * charge);
        }
        break;
      }
      default:
        break;
    }
    g.restore();
  }

  /* =========================================================
   * 남성형 리그 — 카이온 · 제로 · 집행 병사 · 저격 유닛
   * 설계 단위: 키 60, 발 = (0,0), 오른쪽을 봄. 팔 각도: 0 = 앞, π/2 = 아래.
   * ========================================================= */
  const LA1 = 8.6;
  const LA2 = 8.4;
  const LL1 = 12.7;
  const LL2 = 12.9;
  const _ik = { kx: 0, ky: 0, fx: 0, fy: 0 };
  function ik(hx, hy, tx, ty, l1, l2, dir) {
    let dx = tx - hx;
    let dy = ty - hy;
    let d = Math.hypot(dx, dy);
    const maxD = l1 + l2 - 0.05;
    if (d > maxD) { dx *= maxD / d; dy *= maxD / d; d = maxD; }
    if (d < 0.6) d = 0.6;
    const a = Math.atan2(dy, dx);
    let cb = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
    cb = cb < -1 ? -1 : cb > 1 ? 1 : cb;
    const ka = a - Math.acos(cb) * dir;
    _ik.kx = hx + Math.cos(ka) * l1;
    _ik.ky = hy + Math.sin(ka) * l1;
    _ik.fx = hx + dx;
    _ik.fy = hy + dy;
    return _ik;
  }

  function basePose() {
    return {
      bob: 0, crouch: 0, lean: 0, fFx: 3.6, fFy: 0, fBx: -3, fBy: 0,
      armF: 1.45, elbF: 0.35, armB: 1.75, elbB: 0.3, headTilt: 0,
      coatFlow: 0, coatWave: 0, away: false,
      wpn: null, wcol: '#5fd4ff', wa: 1.15, waB: 1.0, ext: 0, charge: 0, wI: 1, grip: 0,
      castGlow: 0, castCol: '#7ce8ff', spinX: 1, stretch: 1, eyeGlow: 1, eyeFlare: 0, fall: 0, aura: 0,
    };
  }
  /** 무기 각도에 맞춰 팔 각도 정하기 */
  function armTo(P, wa) {
    const a1 = wa <= HALF ? HALF + (wa - HALF) * 0.8 : HALF + (wa - HALF) * 0.6;
    const a2 = a1 + (wa - a1) * 0.72;
    P.armF = a1;
    P.elbF = a1 - a2;
  }
  function armToB(P, wa) {
    const a1 = wa <= HALF ? HALF + (wa - HALF) * 0.8 : HALF + (wa - HALF) * 0.6;
    const a2 = a1 + (wa - a1) * 0.72;
    P.armB = a1;
    P.elbB = a1 - a2;
  }

  function drawLeg(g, R, hx, hy, fx, fy, far) {
    const gh = R.ghost;
    const k = ik(hx, hy, fx, fy, LL1, LL2, 1);
    const kx = k.kx;
    const ky = k.ky;
    g.lineCap = 'round';
    const pants = gh || (far ? R.pantsD : R.pants);
    seg(g, hx, hy, kx, ky, 4.7 * R.slim, pants);
    seg(g, kx, ky, fx, fy - 1.2, 4.0 * R.slim, pants);
    // 장화
    const boots = gh || (far ? R.bootsD : R.boots);
    const bx = kx + (fx - kx) * 0.45;
    const by = ky + (fy - ky) * 0.45;
    seg(g, bx, by, fx, fy - 1.4, 4.3 * R.slim, boots);
    fillPoly(g, [fx - 2, fy - 2.8, fx + 3.6, fy - 1.6, fx + 4.2, fy, fx - 2.2, fy], boots);
    if (!gh) {
      neon(g, bx - 1.6, by + 0.4, bx + 1.8, by - 0.2, R.trim, 0.5, far ? 0.35 : 0.8);
      fillCirc(g, kx + 0.4, ky, 1.7 * R.slim, far ? R.bootsD : R.knee || R.boots);
    }
  }

  function drawArm(g, R, sx, sy, a1, a2, far, P, ex, ey) {
    const gh = R.ghost;
    let elx = sx + Math.cos(a1) * LA1;
    let ely = sy + Math.sin(a1) * LA1;
    let hx = elx + Math.cos(a2) * LA2;
    let hy = ely + Math.sin(a2) * LA2;
    if (ex != null) {
      const k = ik(sx, sy, ex, ey, LA1, LA2, -1);
      elx = k.kx; ely = k.ky; hx = k.fx; hy = k.fy;
    }
    g.lineCap = 'round';
    const sleeve = gh || (far ? R.coatDark : R.sleeve || R.coat);
    seg(g, sx, sy, elx, ely, 4.2 * R.slim, sleeve);
    seg(g, elx, ely, hx, hy, 3.6 * R.slim, sleeve);
    if (!gh) {
      const cx = elx + (hx - elx) * 0.78;
      const cy = ely + (hy - ely) * 0.78;
      neon(g, cx - 1.3, cy - 0.8, cx + 1.3, cy + 0.8, R.trim, 0.55, far ? 0.35 : 0.85);
    }
    return { hx, hy, elx, ely };
  }

  function drawHand(g, R, x, y, far) {
    fillCirc(g, x, y, 1.75 * R.slim, R.ghost || (far ? R.gloveD : R.glove));
  }

  /* 머리 모양 */
  function drawHead(g, R, P, hx, hy, t) {
    const gh = R.ghost;
    const st = R.hairStyle;
    g.save();
    g.translate(hx, hy);
    if (P.headTilt) g.rotate(P.headTilt);
    if (st === 'helmet') {
      fillCirc(g, 0, 0, 6.4, gh || R.helm);
      if (!gh) {
        fillPoly(g, [-6, -1, -4, -6, 2, -6.8, 0, -2.6], R.helmHi);
        fillPoly(g, [0.6, -2.4, 6.8, -2.6, 6.6, 1.4, 0.6, 1.2], '#0a0e18');
        neon(g, 1.5, -0.6, 6.2, -0.7, R.eye, 1.0, 1);
        glow(g, 4.5, -0.6, 6, R.eye, 0.6 * P.eyeGlow);
        seg(g, -3.5, -5.5, -6, -10, 0.7, '#6a7890');
        fillCirc(g, -6, -10, 0.9, R.eye);
      }
      g.restore();
      return;
    }
    if (st === 'hood') {
      fillPoly(g, [-7.5, 4, -9.5, -2, -5, -7, 2, -7.6, 6.8, -3, 6.6, 3.5, 4, 6.5, -4, 6], gh || R.coat2);
      if (!gh) {
        fillPoly(g, [0.5, -3.5, 6, -2.2, 5.6, 3.5, 2, 5, 0, 1], '#0c0a0a');
        fillCirc(g, 4, -0.4, 1.1, R.eye);
        glow(g, 4, -0.4, 6 + P.charge * 6, R.eye, 0.8 * P.eyeGlow, true);
        neonPath(g, [-7.5, 4, -9.5, -2, -5, -7, 2, -7.6], R.trim, 0.5, 0.35);
      }
      g.restore();
      return;
    }
    if (P.away) {
      // 뒤통수: 머리카락만
      fillCirc(g, 0.2, -0.6, 6.2, gh || R.hair);
      hairShape(g, R, st, true, t);
      g.restore();
      return;
    }
    // 목
    g.fillStyle = gh || R.skinD;
    g.fillRect(-1.6, 3.5, 3.2, 4);
    // 얼굴
    fillPoly(g, [-4.2, -4, -5.2, 1.2, -3.2, 4.6, 1.2, 6.3, 4.2, 4.2, 5.7, 0.8, 5.8, -3.4, 2, -6.2], gh || R.skin);
    if (!gh) {
      fillPoly(g, [-4.2, -1, -5.2, 1.2, -3.2, 4.6, -1, 5.4, -2.2, 1], R.skinD);
      // 눈
      ell(g, 3.1, -0.2, 1.55, 1.05, -0.1);
      g.fillStyle = R.eye;
      g.fill();
      fillCirc(g, 3.5, -0.5, 0.45, '#ffffff');
      ell(g, 5.45, -0.2, 0.5, 0.95, 0);
      g.fillStyle = R.eye;
      g.fill();
      seg(g, 1.4, -1.6, 4.6, -1.9, 0.6, R.brow || R.hair);
      glow(g, 3.2, -0.2, 4.2, R.eye, 0.65 * P.eyeGlow);
      if (P.eyeFlare > 0) {
        glow(g, 3.2, -0.3, 6 + 10 * P.eyeFlare, R.eye, 0.9 * P.eyeFlare, true);
        neon(g, 3.2 - 9 * P.eyeFlare, -0.3, 3.2 + 9 * P.eyeFlare, -0.3, R.eye, 0.4, P.eyeFlare);
      }
      seg(g, 3.6, 3.4, 4.6, 3.2, 0.45, R.skinD);
    }
    hairShape(g, R, st, false, t);
    g.restore();
  }

  function hairShape(g, R, st, away, t) {
    const gh = R.ghost;
    const w = Math.sin(t * 3) * 0.3;
    let pts;
    if (st === 'zero') {
      pts = away ? [
        6.6, -2, 5.6, 3, 2, 6, -2.6, 6.8, -5.4, 7.6, -6.8, 3.8, -11 + w, 4.6, -8, 0.6, -12.6 + w, -2.4, -7.8, -3.6,
        -11 + w, -8.4, -5.4, -6.8, -5.6, -12, -1.8, -8, 1, -12.6, 2.6, -8, 6.6, -10, 5.8, -6.2, 8.8, -5.6, 6.6, -4,
      ] : [
        6.8, -2.6, 5.4, -1.6, 5.2, 1.2, 4.2, -2.2, 3.2, -1.2, 2.4, -3.2, 0.8, -0.2, -0.2, -2.8, -1.6, -0.4,
        -2.6, 2.6, -3.8, 6.4, -5.6, 4.2, -6.4, 7.8, -7.4, 3.2, -11.2 + w, 4.4, -8.2, 0.4, -12.6 + w, -2.6, -8, -3.8,
        -11 + w, -8.6, -5.4, -6.8, -5.6, -12.2, -1.8, -8.2, 1, -12.8, 2.6, -8, 6.6, -10.2, 5.8, -6.2, 8.9, -5.6, 6.6, -4.2,
      ];
    } else {
      pts = away ? [
        6.6, -1.5, 5.6, 2.8, 2.5, 5.8, -2, 6.8, -5.2, 5.6, -6.4, 2.8, -10 + w, 2.4, -7.6, -0.8,
        -10.6 + w, -3.8, -7.4, -4.8, -9 + w, -8.6, -4.8, -7.4, -4.4, -11.2, -1.4, -8, 1.2, -11.4,
        2.8, -7.6, 6.2, -9.2, 5.8, -6, 8.4, -5.4, 6.8, -3.8,
      ] : [
        7.4, -3.0, 5.8, -2.2, 5.6, 0.6, 4.3, -2.0, 3.2, -1.3, 2.4, -3.0, 1.0, -0.6, 0.0, -3.0, -1.6, -0.4,
        -2.4, 2.2, -3.4, 5.4, -5.2, 3.6, -6.4, 6.4, -7.2, 2.4, -10.2 + w, 2.6, -7.8, -0.6, -10.8 + w, -3.6,
        -7.6, -4.6, -9.2 + w, -8.6, -5.0, -7.4, -4.6, -11.4, -1.6, -8.0, 1.0, -11.6, 2.6, -7.6, 6.0, -9.4,
        5.6, -6.0, 8.6, -5.4, 6.4, -4.2,
      ];
    }
    if (gh) {
      fillPoly(g, pts, gh);
      return;
    }
    fillPoly(g, pts, R.hair, R.hairRim, 0.45);
    g.lineCap = 'round';
    g.strokeStyle = R.hairHi;
    g.lineWidth = 0.5;
    g.beginPath();
    g.moveTo(-6.6, -3);
    g.quadraticCurveTo(-3, -7.2, 1.4, -7);
    g.moveTo(-8.2, 0.6);
    g.quadraticCurveTo(-6.8, -2.8, -4.2, -4.4);
    if (!away) {
      g.moveTo(2, -5.4);
      g.quadraticCurveTo(4, -5.8, 5.6, -4.2);
    }
    g.stroke();
  }

  /**
   * 남성형 캐릭터 한 명 그리기 (오른쪽을 보는 설계 좌표).
   * R: 모양/색 설정, P: 자세
   */
  function drawMan(g, R, P, t) {
    const gh = R.ghost;
    g.save();
    if (P.fall) {
      g.translate(0, -2);
      g.rotate(P.fall);
      g.translate(0, 2);
    }
    g.translate(0, P.bob);
    if (P.spinX !== 1) g.scale(Math.abs(P.spinX) < 0.08 ? 0.08 * Math.sign(P.spinX || 1) : P.spinX, 1);
    if (P.stretch !== 1) g.scale(P.stretch, 1 / P.stretch);
    const hipY = -25 + P.crouch;
    const lean = P.lean;
    const shFx = 1.6;
    const shFy = -16.6;
    const shBx = -3.0;
    const shBy = -16.9;
    const coat = R.coatLen != null;
    const hemY = coat ? R.coatLen + 25 : 0;
    const flow = P.coatFlow;
    const wave = P.coatWave;

    // 근거리 손 위치 (먼저 계산 — 양손 무기의 먼 손이 따라감)
    const a1 = P.armF;
    const a2 = P.armF - P.elbF;
    let nhx = shFx + Math.cos(a1) * LA1 + Math.cos(a2) * LA2;
    let nhy = shFy + Math.sin(a1) * LA1 + Math.sin(a2) * LA2;
    let nTarget = false;
    if (P.ext) {
      nhx += Math.cos(P.wa) * P.ext;
      nhy += Math.sin(P.wa) * P.ext;
      nTarget = true;
    }

    // 1) 코트 뒷자락
    if (coat) {
      g.save();
      g.translate(0, hipY);
      g.rotate(lean);
      fillPoly(g, [
        -4.4, -14, -5.6, -3, -7.8 - flow * 8 + wave, hemY - flow * 6, -4.5 - flow * 6 + wave * 0.6, hemY + 1 - flow * 4,
        -1, hemY - 1, 1, -2,
      ], gh || R.coatDark);
      if (!gh) neon(g, -7.6 - flow * 8 + wave, hemY - flow * 6, -4.5 - flow * 6 + wave * 0.6, hemY + 1 - flow * 4, R.trim, 0.55, 0.6 * R.trimA);
      g.restore();
    }

    // 2) 먼 팔 + 먼 무기
    g.save();
    g.translate(0, hipY);
    g.rotate(lean);
    let farHand;
    if (P.grip) {
      const gx = nhx + Math.cos(P.wa) * P.grip;
      const gy = nhy + Math.sin(P.wa) * P.grip;
      farHand = drawArm(g, R, shBx, shBy, 0, 0, true, P, gx, gy);
    } else {
      farHand = drawArm(g, R, shBx, shBy, P.armB, P.armB - P.elbB, true, P);
    }
    if (P.wpn === 'twin' && !P.wpnHide) drawWeapon(g, 'twin', farHand.hx, farHand.hy, P.waB, 0, P.wcol, P.charge, gh, P.wI * 0.85);
    if (!P.grip) drawHand(g, R, farHand.hx, farHand.hy, true);
    if (P.castGlow > 0 && P.castHand === 1 && !gh) {
      glow(g, farHand.hx, farHand.hy, 7 + P.castGlow * 9, P.castCol, 0.8 * P.castGlow, true);
    }
    g.restore();

    // 3) 다리
    drawLeg(g, R, -1.6, hipY, P.fBx, P.fBy, true);
    drawLeg(g, R, 1.6, hipY, P.fFx, P.fFy, false);

    // 4) 몸통
    g.save();
    g.translate(0, hipY);
    g.rotate(lean);
    if (coat) {
      const fo = flow * 2.5;
      const bhx = -6.6 - flow * 4 + wave * 0.5;
      const bhy = hemY - flow * 3;
      // 몸통 + 뒤쪽 치맛자락 (앞은 트여서 다리가 보임)
      fillPoly(g, [
        -4.6, -18.2, -5.8, -9, -5.4, -1, bhx, bhy, -1.8, hemY + 0.5 - flow * 1.5, 0.2, 3, 2.4, -1, 5.0, -1.6, 6.2, -12.5, 4.6, -18.4,
      ], gh || R.coat, gh ? null : R.coatRim, 0.4);
      if (!gh) {
        // 안쪽 옷 (코트 앞섶 틈)
        fillPoly(g, [3.2, -16.5, 5.4, -12.4, 4.5, -2, 2.6, -2], R.body);
        fillPoly(g, [-5.4, -1, bhx, bhy, -1.8, hemY + 0.5 - flow * 1.5, -2, 4], R.coat2);
        neonPath(g, [bhx + 0.2, bhy, -1.8, hemY + 0.5 - flow * 1.5], R.trim, 0.45, 0.7 * R.trimA);
        neon(g, -4.6, -12, -2.5, 8, R.trim, 0.4, 0.45 * R.trimA);
        if (R.hairStyle === 'zero') {
          neonPath(g, [-2, -16, 1.5, -12.5, -0.5, -10, 3.5, -6.5, 1.5, -4], R.trim, 0.6, 1.0 * R.trimA);
        }
      }
      // 앞자락 (흔들리는 좁은 판)
      const fhx = 5.2 + fo + wave * 0.3;
      const fhy = hemY - 1.5 - flow * 2;
      fillPoly(g, [3.0, -2, 5.1, -2, fhx + 1.2, fhy, fhx - 2.2, fhy + 0.8], gh || R.coat, gh ? null : R.coatRim, 0.4);
      if (!gh) {
        neonPath(g, [5.6, -12.5, 4.9, -1.6, fhx + 1.1, fhy, fhx - 2.2, fhy + 0.8], R.trim, 0.55, 0.95 * R.trimA);
        // 허리띠
        fillPoly(g, [-5.4, -2.6, 5.2, -2.6, 5.0, -0.6, -5.5, -0.6], R.belt || '#0a0d16');
        fillCirc(g, 3.4, -1.6, 0.9, R.trim);
      }
      // 깃
      fillPoly(g, [-4.6, -17.2, -5.8, -23.6, -1.8, -19.6, 1.2, -18.6, 3.0, -18.4, 6.6, -22.6, 5.8, -16.6, 2, -17.2], gh || R.coat2);
      if (!gh) neonPath(g, [-5.6, -23.2, -1.8, -19.6, 1.2, -18.6, 3.0, -18.4, 6.4, -22.4], R.trim, 0.45, 0.65 * R.trimA);
    } else {
      fillPoly(g, [-4.8, -1, -5.8, -14, -4.4, -18.4, 4.2, -18.4, 6.0, -14.4, 5.0, -1], gh || R.body);
      if (!gh) {
        fillPoly(g, [-4.6, -16, 5.4, -15.6, 5.8, -9, -5.4, -9.4], R.coat2);
        neon(g, -4, -9.2, 5.4, -9, R.trim, 0.5, 0.7);
        fillCirc(g, 3.4, -12.5, 1, R.trim);
        glow(g, 3.4, -12.5, 3.5, R.trim, 0.5);
        fillPoly(g, [-5.4, -2.8, 5.4, -2.8, 5.2, -0.4, -5.6, -0.4], R.belt || '#0a0d16');
        // 짧은 허리 갑옷
        fillPoly(g, [-5.6, -0.8, 5.4, -0.8, 6.2, 4.5, -6.2, 4.5], R.coat);
      }
    }
    if (P.away && !gh) {
      neon(g, 0, -17, 0.4, coat ? hemY - 2 : -1, R.trim, 0.6, 0.8 * R.trimA);
    }
    if (R.spiky) {
      fillPoly(g, [0.5, -17.6, 9.5, -21.5, 6.6, -17.8, 10.2, -16.2, 5.6, -14.4, 2.2, -13.6], gh || '#1a1016');
      if (!gh) neonPath(g, [0.8, -17.6, 9.5, -21.5, 6.6, -17.8, 10.2, -16.2], R.trim, 0.5, 0.9 * R.trimA);
    }
    // 5) 머리
    drawHead(g, R, P, 1.0, -26.6, t);
    g.restore();

    // 6) 가까운 팔 + 무기
    g.save();
    g.translate(0, hipY);
    g.rotate(lean);
    const near = drawArm(g, R, shFx, shFy, a1, a2, false, P, nTarget ? nhx : null, nhy);
    // 어깨 보호대 (팔 위에 겹침)
    if (R.pauldron && !P.away) {
      g.save();
      g.translate(shFx - 0.2, shFy - 0.4);
      g.rotate(Math.max(-0.6, Math.min(1.2, (a1 - HALF) * 0.35)) + 0.15);
      g.scale(0.78, 0.78);
      const pd = gh || R.pauldron;
      fillPoly(g, [-4.2, -2.6, 1.5, -3.6, 5.0, -1.4, 5.2, 1.6, 1.0, 3.0, -3.6, 1.8], pd);
      if (!gh) {
        fillPoly(g, [-3.2, 0.6, 1.2, 1.2, 5.0, 0.6, 5.4, 3.2, 1.2, 4.6, -2.6, 3.4], R.pauldronD || '#5d6a82');
        fillPoly(g, [-2.4, 2.8, 1.4, 3.6, 4.6, 3.0, 4.4, 5.0, 1.0, 5.8, -1.8, 4.8], pd);
        seg(g, -3.2, -2.2, 2.4, -3.0, 0.45, 'rgba(255,255,255,0.8)');
        neon(g, -2.8, 1.0, 4.6, 0.8, R.trim, 0.35, 0.6 * R.trimA);
      }
      g.restore();
    }
    if (P.wpn && !P.wpnHide) {
      const wt = P.wpn === 'zero' ? 'katana' : P.wpn;
      drawWeapon(g, wt, near.hx, near.hy, P.wa, 0, P.wcol, P.charge, gh, P.wI);
    }
    drawHand(g, R, near.hx, near.hy, false);
    if (P.grip) drawHand(g, R, farHand.hx, farHand.hy, true);
    if (P.castGlow > 0 && P.castHand === 0 && !gh) {
      glow(g, near.hx, near.hy, 7 + P.castGlow * 9, P.castCol, 0.8 * P.castGlow, true);
    }
    g.restore();
    g.restore();
  }

  /** 잔상 (단색 실루엣) */
  function ghostOf(R, color) {
    const k = '_g' + color;
    if (!R[k]) R[k] = Object.assign({}, R, { ghost: color });
    return R[k];
  }

  /* =========================================================
   * 떠 있는 여성형 리그 — 리아 · 세라 · 프로토콜
   * 설계 단위: 키 60, 발끝 = (0,0), 오른쪽을 봄.
   * ========================================================= */
  function ladyPose() {
    return { bob: 0, lean: 0, armF: 1.75, elbF: -0.35, armB: 1.95, elbB: -0.25, headTilt: 0, hairWave: 0,
      castGlow: 0, castHand: 0, castCol: '#9ae6ff', legSw: 0, away: false, eyeGlow: 1 };
  }

  function drawLadyArm(g, S, sx, sy, a1, a2, far) {
    const gh = S.ghost;
    const elx = sx + Math.cos(a1) * 8.2;
    const ely = sy + Math.sin(a1) * 8.2;
    const hx = elx + Math.cos(a2) * 7.8;
    const hy = ely + Math.sin(a2) * 7.8;
    g.lineCap = 'round';
    seg(g, sx, sy, elx, ely, 2.9, gh || (far ? S.armD : S.arm));
    seg(g, elx, ely, hx, hy, 2.4, gh || (far ? S.gloveD : S.glove));
    if (!gh && S.accent) {
      const cx = elx + (hx - elx) * 0.25;
      const cy = ely + (hy - ely) * 0.25;
      neon(g, cx - 1.1, cy - 0.7, cx + 1.1, cy + 0.7, S.accent, 0.45, far ? 0.4 : 0.85);
    }
    fillCirc(g, hx, hy, 1.4, gh || (far ? S.skinD : S.skin));
    return { hx, hy };
  }

  function drawLady(g, S, P, t) {
    const gh = S.ghost;
    g.save();
    g.translate(0, P.bob);
    if (P.lean) {
      g.translate(0, -27);
      g.rotate(P.lean);
      g.translate(0, 27);
    }
    const hx = 1.2;
    const hy = -50.5;
    const wv = P.hairWave;
    const L = S.hairLen;
    const w1 = Math.sin(t * 1.7) * 1.2 * wv;
    const w2 = Math.sin(t * 1.7 + 0.9) * 2.2 * wv;
    const w3 = Math.sin(t * 1.7 + 1.8) * 3.0 * wv;

    // 1) 뒷머리 (몸 뒤)
    const back = [
      hx + 4, hy - 6.6, hx - 2, hy - 7.4, hx - 6.8, hy - 4.2, hx - 8, hy + 2,
      hx - 9.2 - w1, -37, -10.5 - w2, -28, -12 - w3, L + 2,
      -10 - w3, L - 1.5, -8.5 - w3, L + 3.5, -6.2 - w3 * 0.8, L - 0.5, -4 - w3 * 0.7, L + 3, -2 - w3 * 0.5, L - 2,
      -0.5, -30, 0, -40, hx + 4.8, hy + 3, hx + 6, hy - 2,
    ];
    fillPoly(g, back, gh || S.hairD);
    if (!gh) {
      g.lineCap = 'round';
      g.strokeStyle = S.hair;
      g.lineWidth = 1.6;
      g.beginPath();
      g.moveTo(hx - 6, hy + 1);
      g.quadraticCurveTo(-9 - w1, -36, -9.5 - w3, L + 2);
      g.moveTo(hx - 3.5, hy + 2);
      g.quadraticCurveTo(-6 - w1, -34, -5.5 - w3 * 0.8, L + 1);
      g.stroke();
      if (S.hairGlow) {
        neon(g, hx - 7, hy + 4, -10.5 - w2, -28, S.hairGlow, 0.4, 0.35);
      }
    }
    // 뒤쪽 장식 (날개 등은 호출자가 먼저 그림)

    // 2) 먼 팔
    const shFx = 3.2;
    const shFy = -41.6;
    const shBx = -3.4;
    const shBy = -41.4;
    const far = drawLadyArm(g, S, shBx, shBy, P.armB, P.armB - P.elbB, true);
    if (P.castGlow > 0 && P.castHand === 1 && !gh) glow(g, far.hx, far.hy, 6 + 8 * P.castGlow, P.castCol, 0.85 * P.castGlow, true);

    // 3) 다리
    const sw = P.legSw;
    g.lineCap = 'round';
    const legs = gh || S.legs;
    const legsD = gh || S.legsD;
    seg(g, -1.6, -27, -0.6 + sw * 0.5, -14.5, 4.2, legsD);
    seg(g, -0.6 + sw * 0.5, -14.5, -1.4 + sw, -2.5, 2.8, legsD);
    seg(g, 1.8, -27, 2.4 - sw * 0.4, -14, 4.6, legs);
    seg(g, 2.4 - sw * 0.4, -14, 1.6 - sw, -2, 3.0, legs);
    if (S.boots) {
      seg(g, -0.9 + sw * 0.7, -9, -1.4 + sw, -1.5, 3.0, gh || S.bootsD);
      seg(g, 2.1 - sw * 0.6, -8.5, 1.6 - sw, -1, 3.2, gh || S.boots);
      if (!gh && S.accent) neon(g, 0.6 - sw * 0.6, -8.6, 3.6 - sw * 0.6, -8.4, S.accent, 0.45, 0.8);
    }
    fillPoly(g, [0.4 - sw, -2.2, 3.2 - sw, -2, 2 - sw, 0.6], gh || S.bootsD || S.legs);
    if (S.legFade && !gh) {
      // 홀로그램: 다리 끝이 빛으로 사라짐
      glowE(g, 0.6, -4, 5, 7, S.accent, 0.35);
    }

    // 4) 몸통
    fillPoly(g, [-4.4, -26.6, -3.0, -32, -3.8, -37, -4.4, -42.2, 3.4, -42.6, 5.6, -38.6, 4.8, -35.4, 3.0, -32, 4.6, -26.6, 3.8, -24.2, -4, -24.2], gh || S.body);
    if (!gh) {
      fillPoly(g, [-4.4, -26.6, -3, -32, -3.8, -37, -4.4, -42.2, -1.6, -42.4, -1.2, -24.4, -4, -24.2], S.bodyD);
      if (S.chest) fillPoly(g, [0.6, -42.4, 3.4, -42.6, 5.6, -38.6, 4.8, -35.4, 1.4, -36], S.chest);
      if (S.accent) {
        neonPath(g, [-3.2, -32, 0.6, -31.4, 3.0, -32], S.accent, 0.55, 0.9);
        neonPath(g, [-2, -42.4, 0.8, -39, 3.2, -42.6], S.accent, 0.45, 0.8);
        neon(g, 0.4, -38.5, 0.8, -26, S.accent, 0.35, 0.45);
      }
    }
    if (S.skirt) {
      fillPoly(g, [-5, -27.4, 4.9, -27.4, 6.6, -20.5, 2.6, -21.8, -0.6, -19.4, -4.4, -21.6, -6, -20.2], gh || S.skirt);
      if (!gh && S.accent) neonPath(g, [6.6, -20.5, 2.6, -21.8, -0.6, -19.4, -4.4, -21.6, -6, -20.2], S.accent, 0.45, 0.7);
    }
    if (S.collar) {
      fillPoly(g, [-3.2, -42.4, -2.6, -45, 3.6, -45.2, 3.6, -42.6], gh || S.collar);
      if (!gh && S.accent) fillCirc(g, 0.6, -43.6, 0.9, S.accent);
    }

    // 5) 머리 (얼굴 + 앞머리)
    g.save();
    g.translate(hx, hy);
    if (P.headTilt) g.rotate(P.headTilt);
    g.fillStyle = gh || S.skinD;
    g.fillRect(-1.4, 3.5, 2.8, 4.2);
    if (P.away) {
      fillCirc(g, 0, -0.5, 6.4, gh || S.hair);
    } else {
      fillPoly(g, [-4.4, -3.6, -5.0, 1.2, -2.8, 4.6, 0.8, 6.1, 3.4, 4.2, 5.2, 1, 5.4, -2.8, 2, -6], gh || S.skin);
      if (!gh) {
        if (S.eyeClosed) {
          g.lineCap = 'round';
          g.strokeStyle = S.eyeLine || '#5a6a9a';
          g.lineWidth = 0.6;
          g.beginPath();
          g.moveTo(1.6, 0.2);
          g.quadraticCurveTo(2.8, 1.2, 4.2, 0.2);
          g.stroke();
        } else {
          ell(g, 2.7, 0.1, 1.55, 1.45, 0);
          g.fillStyle = S.eye;
          g.fill();
          fillCirc(g, 3.1, -0.4, 0.5, '#ffffff');
          ell(g, 5.0, 0.1, 0.5, 1.15, 0);
          g.fillStyle = S.eye;
          g.fill();
          glow(g, 2.8, 0.1, 4, S.eye, 0.55 * P.eyeGlow);
        }
        fillCirc(g, 3.4, 3.8, 0.35, '#c98a9a');
      }
    }
    // 앞머리
    fillPoly(g, P.away ? [-6.6, 1, -5.4, -5.4, 0, -7.4, 5, -5.8, 6.6, -1.6, 5.8, 3, 2, 5.5, -3, 5.5] : [
      -5.8, -1.6, -3.4, -6.6, 2.4, -7.2, 6, -4.4, 6.6, 0.4, 5.0, -2.4, 4.0, 1.4, 2.8, -2.6,
      1.2, 0.8, -0.2, -3.0, -2.4, -0.6, -3.6, 3.5,
    ], gh || S.hair);
    if (!gh) {
      g.lineCap = 'round';
      seg(g, -3, -5.4, 2.6, -6.2, 0.7, S.hairHi);
    }
    g.restore();
    // 옆머리 (앞쪽으로 늘어진 한 가닥)
    if (!P.away) {
      fillPoly(g, [hx + 4.2, hy - 1.5, hx + 6.2, hy + 3, hx + 5.6, -39, 4.8 + w1, -31, 3.6 + w1, -29.5, 3.6, -38, hx + 3.4, hy + 3], gh || S.hair);
    }
    // 장식
    if (!gh) drawOrnament(g, S, hx, hy, t, P);

    // 6) 가까운 팔
    const near = drawLadyArm(g, S, shFx, shFy, P.armF, P.armF - P.elbF, false);
    if (P.castGlow > 0 && P.castHand === 0 && !gh) glow(g, near.hx, near.hy, 6 + 8 * P.castGlow, P.castCol, 0.85 * P.castGlow, true);
    g.restore();
    return near;
  }

  function drawOrnament(g, S, hx, hy, t, P) {
    switch (S.ornament) {
      case 'lia': {
        // 머리 장식 + 헤드셋
        fillPoly(g, [hx - 4.6, hy - 4.4, hx - 2, hy - 8.6, hx - 0.6, hy - 5.6], '#2a3a6a');
        neon(g, hx - 4.4, hy - 4.6, hx - 2, hy - 8.4, '#7cd8ff', 0.5, 0.9);
        fillPoly(g, [hx - 6.2, hy - 1.6, hx - 4.6, hy - 3.6, hx - 3.4, hy - 0.8, hx - 4.8, hy + 0.6], '#2a3a6a');
        neon(g, hx - 6, hy - 1.4, hx - 4.6, hy - 3.4, '#7cd8ff', 0.45, 0.8);
        glow(g, hx - 4.6, hy - 1.4, 3.2, '#7cd8ff', 0.5 + 0.25 * Math.sin(t * 4));
        break;
      }
      case 'sera': {
        fillPoly(g, [hx - 3.4, hy - 1.5, hx - 7.5, hy - 9.5, hx - 1.4, hy - 3.4], '#1b2140');
        fillPoly(g, [hx - 3.4, hy - 2.6, hx - 4.2, hy + 3.2, hx - 0.8, hy + 2.8, hx - 0.4, hy - 1.6], '#1b2140');
        neon(g, hx - 3.6, hy - 2, hx - 7, hy - 9, S.accent, 0.5, 0.9);
        g.strokeStyle = '#7cc8ff';
        g.lineWidth = 0.45;
        circ(g, hx - 1.9, hy + 0.6, 1.1);
        g.stroke();
        glow(g, hx - 1.9, hy + 0.6, 2.6, '#7cc8ff', 0.4);
        break;
      }
      case 'protocol': {
        // 금빛 관 + 청록 보석
        g.lineCap = 'round';
        seg(g, hx - 5.5, hy - 4.4, hx + 5.6, hy - 3.8, 1.1, '#e8c66a');
        fillPoly(g, [hx + 3.6, hy - 4.2, hx + 4.6, hy - 9, hx + 5.6, hy - 4], '#f2d78a');
        fillPoly(g, [hx - 2, hy - 5, hx - 3.5, hy - 10.5, hx - 0.4, hy - 5.4], '#f2d78a');
        fillCirc(g, hx + 4.6, hy - 4.2, 0.9, '#66e0ff');
        glow(g, hx + 4.6, hy - 4.2, 4, '#66e0ff', 0.8);
        break;
      }
      default:
        break;
    }
  }

  /* ───────────── 스타일(색) 정의 ───────────── */
  function manStyle(o) {
    const s = Object.assign({ slim: 1, trimA: 1, skinD: null, glove: null }, o);
    s.skinD = s.skinD || mix(s.skin, '#3a2a40', 0.3);
    s.pantsD = s.pantsD || mix(s.pants, '#000000', 0.35);
    s.bootsD = s.bootsD || mix(s.boots, '#000000', 0.35);
    s.coatDark = s.coatDark || mix(s.coat, '#000000', 0.4);
    s.glove = s.glove || s.coat2;
    s.coatRim = s.coatRim || mix(s.coat, '#7090d0', 0.22);
    s.gloveD = mix(s.glove, '#000000', 0.35);
    return s;
  }
  function ladyStyle(o) {
    const s = Object.assign({ hairLen: -18, hairWave: 1 }, o);
    s.hairD = s.hairD || mix(s.hair, '#1a1a40', 0.28);
    s.skinD = s.skinD || mix(s.skin, '#5a4a7a', 0.25);
    s.bodyD = s.bodyD || mix(s.body, '#20204a', 0.3);
    s.legsD = s.legsD || mix(s.legs, '#101030', 0.3);
    s.armD = s.armD || mix(s.arm || s.body, '#101030', 0.3);
    s.arm = s.arm || s.body;
    s.glove = s.glove || s.arm;
    s.gloveD = mix(s.glove, '#101030', 0.3);
    if (s.boots) s.bootsD = s.bootsD || mix(s.boots, '#000000', 0.3);
    return s;
  }

  const KAI = manStyle({
    skin: '#eadfe4', hair: '#1a2340', hairHi: '#5a7cc0', hairRim: '#34497e', hairStyle: 'kai', brow: '#161d36',
    body: '#1b2338', coat: '#121a2e', coat2: '#1e2b48', coatLen: -5, trim: '#4fd8ff',
    pants: '#10162a', boots: '#1b2236', knee: '#2a3550', eye: '#55ccff', pauldron: '#a9b6cc', pauldronD: '#4f5c78', glove: '#1a2338',
  });
  const ZERO = manStyle({
    skin: '#eedad8', hair: '#b3122e', hairHi: '#ff7a90', hairRim: '#ff4a64', hairStyle: 'zero', brow: '#7a0c20',
    body: '#16101a', coat: '#120c14', coat2: '#2a1020', coatLen: -12, trim: '#ff2a4a', trimA: 1,
    pants: '#120d14', boots: '#1d1218', knee: '#2a1820', eye: '#ff4060', spiky: true, glove: '#1c1218',
  });
  const ZERO_BOSS = Object.assign({}, ZERO, { trimA: 1.3, hairHi: '#ff7a90' });
  const SOLDIER = manStyle({
    skin: '#c9d0e0', hairStyle: 'helmet', helm: '#283250', helmHi: '#3f4c72', body: '#283152', coat: '#1f2740', coat2: '#36425f',
    coatLen: null, trim: '#9ab0ff', pants: '#192036', boots: '#262d44', knee: '#3a4566', eye: '#9ab0ff', pauldron: '#4a5878', pauldronD: '#2c3550',
  });
  const SNIPER = manStyle({
    skin: '#2a2a30', hairStyle: 'hood', body: '#38322e', coat: '#2a2522', coat2: '#463c35', coatLen: -9, trim: '#ffb35c',
    pants: '#1e1b1a', boots: '#2a2522', knee: '#3a332e', eye: '#ffb35c', slim: 0.82, glove: '#2a2522',
  });
  const LIA = ladyStyle({
    skin: '#eaf2ff', hair: '#e2ebff', hairHi: '#ffffff', hairD: '#9fb6ee', hairGlow: '#8fd8ff', hairLen: -20,
    body: '#bfe6ff', bodyD: '#86b8ee', chest: '#e6f6ff', arm: '#cfeeff', glove: '#9fd8ff', legs: '#a8dcff', legsD: '#7fb4e8',
    eye: '#4fc8ff', accent: '#5fd8ff', ornament: 'lia', legFade: true, skirt: '#9fd0f5', collar: '#2a3a6a',
  });
  const SERA = ladyStyle({
    skin: '#f2eaf4', hair: '#ece6fa', hairHi: '#ffffff', hairD: '#b4a8dc', hairGlow: '#d8b8ff', hairLen: -13,
    body: '#eef0fa', bodyD: '#b8bcd8', chest: '#ffffff', arm: '#e8eaf6', glove: '#1e2444', legs: '#e8eaf6', legsD: '#b0b4d0',
    boots: '#1e2444', eye: '#b98cff', accent: '#b07cff', ornament: 'sera', skirt: '#262c50', collar: '#1e2444',
  });
  const PROTOCOL = ladyStyle({
    skin: '#f4f2f0', hair: '#e8ecf8', hairHi: '#ffffff', hairD: '#a8b4d4', hairGlow: '#a8f0ff', hairLen: -16,
    body: '#f6f4ee', bodyD: '#c4c0b4', chest: '#ffffff', arm: '#ecebe4', glove: '#d8b860', legs: '#eeece6', legsD: '#bcb8ac',
    boots: '#d8b860', eye: '#66e0ff', accent: '#66e0ff', ornament: 'protocol', skirt: '#e2c470', collar: '#d8b860',
  });

  /* =========================================================
   * 카이온 (플레이어)
   * ========================================================= */
  function restWeapon(P, wid) {
    P.wpn = wid;
    P.grip = 0;
    P.armB = 1.78;
    P.elbB = 0.28;
    switch (wid) {
      case 'twin': P.wa = 1.25; P.waB = 1.05; armTo(P, P.wa); armToB(P, P.waB); break;
      case 'great': P.wa = 2.42; P.armF = 1.52; P.elbF = 0.12; break;
      case 'spear': P.wa = -0.32; P.armF = 1.15; P.elbF = 1.1; P.grip = -11; break;
      case 'rail': P.wa = 0.04; P.armF = 1.22; P.elbF = 1.12; P.grip = 9; break;
      default: P.wa = 1.12; armTo(P, P.wa); break;
    }
  }

  function atkInfo(e) {
    const st = e.st;
    if (st && st.step) {
      const dur = st.step.dur || 0.3;
      const hits = st.hits && st.hits.length ? st.hits : [st.step.hit != null ? st.step.hit : dur * 0.35];
      return { k: clamp01(st.t / dur), h: clamp01(hits[0] / dur), hl: clamp01(hits[hits.length - 1] / dur), fx: st.step.fx || 'slashR',
        heavy: !!st.heavy, n: hits.length, dur };
    }
    if (st && st.dur) return { k: clamp01(st.t / st.dur), h: 0.25, hl: 0.25, fx: 'smash', heavy: true, n: 1, dur: st.dur };
    const dur = e.anim === 'heavy' ? 0.6 : 0.3;
    return { k: clamp01((e.animT || 0) / dur), h: 0.35, hl: 0.35, fx: e.anim === 'heavy' ? 'smash' : 'slashR', heavy: e.anim === 'heavy', n: 1, dur };
  }

  /** 공격 자세: 준비 → 휘두르기 → 마무리 */
  function swingPose(P, A, wid) {
    const k = A.k;
    const h = A.h;
    const a = Math.max(0.05, h * 0.45);
    const b = 0.14;
    const k0 = Math.max(0.001, h - a);
    const k1 = h + b;
    const ph = k < k0 ? 0 : k < k1 ? 1 : 2;
    const wk = ph === 0 ? easeOut(k / k0) : 1;
    const sk = ph === 0 ? 0 : ph === 1 ? easeOut3((k - k0) / (k1 - k0)) : 1;
    const fk = ph === 2 ? smooth((k - k1) / Math.max(0.01, 1 - k1)) : 0;
    const big = A.heavy || wid === 'great';
    const rest = P.wa;
    const restB = P.waB;
    const sw = (s, en, r) => (ph === 0 ? lerp(r, s, wk) : ph === 1 ? lerp(s, en, sk) : lerp(en, r, fk * 0.55));
    P.fFx = 4 + 5 * sk * (1 - fk * 0.5);
    P.fBx = -3 - 4 * sk * (1 - fk * 0.5);
    P.crouch = 1 + (big ? 3.5 : 1.8) * sk * (1 - fk * 0.6);
    P.lean = -0.1 * wk * (1 - sk) + (big ? 0.3 : 0.2) * sk * (1 - fk * 0.7);
    P.coatFlow = 0.6 * sk * (1 - fk);
    P.charge = ph === 0 ? wk * (big ? 0.7 : 0.3) : (1 - sk) * 0.5;
    const ranged = wid === 'rail';
    switch (A.fx) {
      case 'slashL':
        P.wa = sw(1.55, -2.15, rest);
        if (!ranged) armTo(P, P.wa);
        if (wid === 'twin') { P.waB = sw(1.3, -1.6, restB); armToB(P, P.waB); }
        break;
      case 'spin': {
        const span = Math.max(0.05, A.hl + b - k0);
        const turns = A.n > 2 ? 2 : 1;
        const ph2 = clamp01((k - k0) / span);
        P.spinX = ph === 0 ? 1 : Math.cos(ph2 * TAU * turns);
        P.wa = ph === 0 ? lerp(rest, 2.4, wk) : 0.1;
        armTo(P, P.wa);
        if (wid === 'twin') { P.waB = ph === 0 ? 2.2 : -0.1; armToB(P, P.waB); }
        if (wid === 'spear') { P.grip = -10; }
        P.crouch = 3 * (ph === 0 ? wk : 1 - fk);
        P.fFx = 6;
        P.fBx = -6;
        P.coatFlow = ph === 1 ? 1 : 0.3;
        break;
      }
      case 'smash':
        P.wa = sw(-1.95, 1.3, rest);
        armTo(P, P.wa);
        if (wid === 'twin') { P.waB = sw(-1.7, 1.1, restB); armToB(P, P.waB); }
        if (wid === 'spear') { P.grip = 0; armToB(P, P.wa + 0.25); }
        if (wid === 'rail') { P.grip = 0; }
        P.lean = -0.22 * wk * (1 - sk) + (big ? 0.38 : 0.28) * sk * (1 - fk * 0.7);
        P.crouch = 1 + (big ? 5.5 : 3.5) * sk * (1 - fk * 0.6);
        break;
      case 'thrust': {
        P.wa = -0.06;
        P.ext = ph === 0 ? -6 * wk : ph === 1 ? lerp(-6, 10, sk) : lerp(10, 0, fk);
        P.armF = 1.0;
        P.elbF = 0.95;
        P.grip = -10;
        P.lean = -0.05 * wk + 0.3 * sk * (1 - fk * 0.6);
        if (A.heavy) {
          P.lean = 0.5 * sk * (1 - fk * 0.5) - 0.1 * wk * (1 - sk);
          P.fFx = 11 * sk + 3;
          P.fBx = -11 * sk - 3;
          P.crouch = 4.5 * sk * (1 - fk * 0.4);
          P.coatFlow = sk * (1 - fk * 0.5);
          P.stretch = 1 + 0.1 * sk * (1 - fk);
        }
        break;
      }
      case 'cross':
        P.wa = sw(-2.0, 1.35, rest);
        armTo(P, P.wa);
        P.waB = sw(1.35, -2.0, restB);
        armToB(P, P.waB);
        break;
      case 'shot': {
        const r = k < h ? 0 : Math.exp(-(k - h) * A.dur * 16);
        P.wa = 0.03 - 0.32 * r;
        P.ext = -3.5 * r;
        P.lean = -0.06 * r;
        P.crouch = 0.8;
        P.fFx = 5;
        P.fBx = -4;
        P.charge = k < h ? 0.3 : r * 0.6;
        break;
      }
      case 'beam': {
        const r = k < h ? 0 : Math.exp(-(k - h) * A.dur * 5);
        P.charge = k < h ? clamp01(k / h) * 1.2 : r * 0.8;
        P.wa = -0.45 * r;
        P.ext = -6 * r;
        P.lean = k < h ? 0.12 * (k / h) : 0.12 - 0.42 * r;
        P.crouch = 3;
        P.fFx = 7;
        P.fBx = -7;
        P.coatFlow = r * 0.8;
        break;
      }
      default: // slashR
        P.wa = sw(-2.25, 1.45, rest);
        if (!ranged) armTo(P, P.wa);
        if (wid === 'twin') { P.waB = sw(-1.9, 1.2, restB); armToB(P, P.waB); }
        break;
    }
    if (wid === 'spear' && A.fx !== 'thrust' && A.fx !== 'smash') P.grip = -10;
    if (ranged && A.fx !== 'shot' && A.fx !== 'beam' && A.fx !== 'smash') { P.wa = 0.04; P.grip = 9; P.armF = 1.22; P.elbF = 1.12; }
    if (wid === 'great') P.wI = 1 + P.charge;
  }

  function kaiPose(e, W, t) {
    const P = basePose();
    const wid = (e.stats && e.stats.weaponId) || 'blade';
    const wpn = e.stats && e.stats.weapon;
    P.wcol = (wpn && wpn.color) || '#5fd4ff';
    restWeapon(P, wid);
    const anim = e.anim || 'idle';
    const at = e.animT || 0;
    P.bob = Math.sin(t * 2.4) * 0.45;
    P.coatWave = Math.sin(t * 1.7) * 0.7;
    if (e.dead || anim === 'dead') {
      const a = e.deadT > 0 ? e.deadT : at;
      const k1 = clamp01(a / 0.45);
      P.bob = 0;
      P.crouch = 9 * easeOut(k1);
      P.lean = 0.35 * k1;
      P.fFx = 6;
      P.fBx = -7;
      P.headTilt = 0.3 * k1;
      P.wa = lerp(P.wa, 0.95, k1);
      armTo(P, P.wa);
      P.grip = 0;
      P.armB = 1.4;
      P.eyeGlow = 1 - k1 * 0.7;
      P.fall = easeIn(clamp01((a - 0.5) / 0.5)) * 1.3;
      P.wI = 1 - clamp01(a / 1.2) * 0.8;
      return P;
    }
    if (e.state === 'locked') {
      P.bob = 0;
      P.coatWave = 0;
      return P;
    }
    if (e.state === 'ult' && e.st) {
      const st = e.st;
      if (st.t < 0.4) {
        P.wa = -1.6;
        armTo(P, P.wa);
        P.charge = st.t / 0.4;
        P.castGlow = 0.8;
        P.castHand = 1;
        P.castCol = '#ffe066';
        P.armB = -0.4;
        P.elbB = 0.4;
        P.grip = 0;
        P.eyeFlare = st.t / 0.4;
      } else if (st.t < 1.5) {
        const u = (st.t - 0.4) / 0.15;
        const n = Math.floor(u);
        swingPose(P, { k: u - n, h: 0.3, hl: 0.3, fx: n % 2 ? 'slashL' : 'slashR', heavy: true, n: 1, dur: 0.15 }, wid === 'rail' ? 'blade' : wid);
        P.eyeFlare = 0.6;
      } else {
        P.wa = -1.7;
        armTo(P, P.wa);
        P.grip = 0;
        P.charge = 1;
        P.eyeFlare = 1;
        P.crouch = 2;
      }
      return P;
    }
    switch (anim) {
      case 'run': {
        const ph = (e.runT || 0) * 11;
        const s = Math.sin(ph);
        const c = Math.cos(ph);
        P.fFx = s * 8.5 + 1;
        P.fFy = -Math.max(0, c) * 4.5;
        P.fBx = -s * 8.5 + 1;
        P.fBy = -Math.max(0, -c) * 4.5;
        P.bob = -Math.abs(c) * 1.2 + 0.4;
        P.lean = 0.2;
        P.coatFlow = 0.85;
        P.coatWave = Math.sin(ph * 2) * 1.2;
        P.armB = HALF - s * 0.75;
        P.elbB = 0.5;
        if (wid === 'blade') { P.wa = 2.3; armTo(P, P.wa); }
        else if (wid === 'twin') { P.wa = 2.3; armTo(P, P.wa); P.waB = 2.5 - s * 0.4; armToB(P, P.waB); }
        else if (wid === 'great') { P.wa = 2.5 + s * 0.05; }
        else if (wid === 'spear') { P.wa = -0.12; }
        else { P.wa = 0.12; }
        break;
      }
      case 'attack':
      case 'heavy':
        swingPose(P, atkInfo(e), wid);
        break;
      case 'dodge': {
        const ray = e.state === 'skill' && e.st && e.st.kind === 'ray';
        const k = clamp01(at / 0.34);
        const dd = ray ? e.facing : e.dodgeDir || 0;
        const rel = Math.cos(dd) * Math.sign(Math.cos(e.facing || 0) || 1);
        const fwd = ray || rel > -0.25;
        const amt = Math.sin(Math.min(1, k * 1.3) * PI) * 0.8 + 0.2;
        if (fwd) {
          P.lean = 0.6 * amt;
          P.crouch = 8 * amt;
          P.fFx = 8;
          P.fBx = -10;
          P.fBy = -2 * amt;
          P.coatFlow = 1;
          P.armB = 2.4;
          P.elbB = 0.2;
          if (wid === 'blade' || wid === 'twin') { P.wa = 2.6; armTo(P, P.wa); P.waB = 2.7; armToB(P, P.waB); }
          if (wid === 'great') P.wa = 2.6;
          P.stretch = 1 + 0.08 * amt;
        } else {
          P.lean = -0.32 * amt;
          P.crouch = 5 * amt;
          P.fFx = 7;
          P.fBx = -5;
          P.fFy = -1.5 * amt;
          P.coatFlow = 0.4;
          P.coatWave = 2 * amt;
          if (wid === 'blade' || wid === 'twin') { P.wa = 0.6; armTo(P, P.wa); }
          P.armB = 1.2;
        }
        break;
      }
      case 'cast': {
        const k = clamp01(at / 0.3);
        P.castHand = 1;
        P.armB = lerp(1.6, -0.55, easeOut(k));
        P.elbB = 0.25;
        P.castGlow = 0.6 + 0.4 * Math.sin(t * 22);
        P.castCol = e.st && e.st.kind === 'wave' ? '#ff8ab0' : e.st && e.st.kind === 'cast' && e.haste > 6.5 ? '#c9a4ff' : '#9ae6ff';
        P.lean = -0.06;
        P.crouch = 1.2;
        P.fFx = 5;
        P.fBx = -4;
        if (wid === 'spear' || wid === 'rail') { P.grip = 0; P.armF = 1.5; P.elbF = 0.4; P.wa = wid === 'rail' ? 1.4 : -1.2; }
        P.coatWave = Math.sin(t * 9) * 1.2;
        break;
      }
      case 'stance': {
        P.crouch = 4.5;
        P.fFx = 7;
        P.fBx = -6;
        P.lean = 0.08;
        if (wid === 'spear') { P.wa = 0.05; P.grip = -10; P.armF = 1.0; P.elbF = 0.9; }
        else if (wid === 'rail') { P.wa = 0.0; }
        else if (wid === 'great') { P.wa = -0.9; armTo(P, P.wa); P.grip = 0; P.armB = 0.5; P.elbB = 0.6; }
        else { P.wa = 0.18; armTo(P, P.wa); P.armB = 0.55; P.elbB = 0.5; if (wid === 'twin') { P.waB = -0.2; armToB(P, P.waB); } }
        P.charge = 0.45 + 0.35 * Math.sin(t * 12);
        P.eyeGlow = 1.6;
        P.aura = 1;
        break;
      }
      case 'hurt': {
        const k = clamp01(at / 0.3);
        const r = 1 - k * 0.6;
        P.lean = -0.34 * r;
        P.crouch = 2 * r;
        P.headTilt = -0.25 * r;
        P.fFx = 6;
        P.fBx = -5;
        P.armB = 2.5;
        P.elbB = 0.1;
        P.coatWave = -2 * r;
        P.coatFlow = 0.3;
        if (wid === 'blade' || wid === 'twin') { P.wa = 2.1; armTo(P, P.wa); }
        break;
      }
      default:
        break;
    }
    return P;
  }

  function drawKai(g, e, W, t) {
    const s = ((e.r || 18) * 3.3) / 60;
    const fx = faceX(e);
    const P = kaiPose(e, W, t);
    P.away = isAway(e) && !e.dead && (e.anim === 'idle' || e.anim === 'run');
    if (e.counterReady > 0) P.eyeFlare = Math.max(P.eyeFlare, Math.min(1, e.counterReady * 2));
    const R = KAI;
    // 뒤쪽 효과
    if (e.haste > 0 && !e.dead) {
      const hA = Math.min(1, e.haste);
      glowE(g, 0, -30 * s, 22 * s, 34 * s, '#5fe8ff', 0.22 * hA);
      const pc = g.globalCompositeOperation;
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) {
        const y = (-12 - i * 14 - ((t * 60 + i * 9) % 8)) * s;
        const x0 = -fx * (10 + ((t * 90 + i * 23) % 14)) * s;
        g.strokeStyle = rgba('#7cf0ff', 0.35 * hA);
        g.lineWidth = 1.2 * s;
        g.beginPath();
        g.moveTo(x0, y);
        g.lineTo(x0 - fx * 12 * s, y);
        g.stroke();
      }
      g.globalCompositeOperation = pc;
    }
    if (P.aura) {
      glowE(g, 0, -28 * s, 26 * s, 36 * s, P.wcol, 0.25 + 0.15 * Math.sin(t * 12));
    }
    // 회피 잔상
    if (e.anim === 'dodge' && !e.dead) {
      const dd = e.state === 'skill' && e.st && e.st.kind === 'ray' ? e.facing : e.dodgeDir || 0;
      const dx = -Math.cos(dd);
      const dy = -Math.sin(dd) * SQ;
      const k = clamp01((e.animT || 0) / 0.34);
      const pa = g.globalAlpha;
      for (let i = 2; i >= 1; i--) {
        g.save();
        g.translate(dx * i * 13 * s * (1 - k * 0.5), dy * i * 13 * s * (1 - k * 0.5));
        g.scale(s * fx, s);
        g.globalAlpha = pa * (0.32 - i * 0.1) * (1 - k * 0.6);
        drawMan(g, ghostOf(R, i === 1 ? '#5fd8ff' : '#3a6cff'), P, t);
        g.restore();
      }
      g.globalAlpha = pa;
    }
    const blink = e.state === 'skill' && e.st && e.st.kind === 'blink';
    if (blink) g.globalAlpha *= 0.5 + 0.5 * Math.sin(t * 60);
    g.save();
    g.scale(s * fx, s);
    if (e.dead) g.globalAlpha *= 1 - clamp01(((e.deadT || e.animT || 0) - 1.2) / 1.5) * 0.4;
    drawMan(g, R, P, t);
    if (e.state === 'locked') {
      const pa = g.globalAlpha;
      g.globalAlpha = pa * 0.55;
      drawMan(g, ghostOf(R, '#8e90b8'), P, t);
      g.globalAlpha = pa;
    }
    g.restore();
    if (e.state === 'locked') chronoLock(g, s, t);
    if (e.stats && e.stats.weaponId === 'great' && (e.anim === 'idle' || e.anim === 'run') && !e.dead) {
      // 땅에 끌리는 대검 끝의 불꽃
      if (e.anim === 'run') sparks(g, t * 2, 3, -fx * 26 * s, -1 * s, 6 * s, 3 * s, P.wcol, 9);
    }
  }

  /** ASTRA 의 시간 정지에 묶인 모습 — 시계 고리 */
  function chronoLock(g, s, t) {
    const pc = g.globalCompositeOperation;
    g.globalCompositeOperation = 'lighter';
    g.strokeStyle = 'rgba(190,170,255,0.7)';
    g.lineWidth = 1.2 * s;
    ell(g, 0, -30 * s, 22 * s, 34 * s, 0);
    g.stroke();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU + t * 0.2;
      const x = Math.cos(a) * 22 * s;
      const y = -30 * s + Math.sin(a) * 34 * s;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x * 0.85, -30 * s + (y + 30 * s) * 0.88);
      g.stroke();
    }
    g.strokeStyle = 'rgba(220,210,255,0.85)';
    g.beginPath();
    g.moveTo(0, -30 * s);
    g.lineTo(0, -52 * s);
    g.moveTo(0, -30 * s);
    g.lineTo(12 * s, -24 * s);
    g.stroke();
    g.globalCompositeOperation = pc;
  }

  /* =========================================================
   * 제로 (동료 / 보스 공용)
   * ========================================================= */
  function zeroPose(e, W, t, isBoss) {
    const P = basePose();
    P.wpn = 'zero';
    P.wcol = '#ff2a48';
    P.wa = 2.35;
    armTo(P, P.wa);
    P.armB = 1.85;
    P.elbB = 0.2;
    P.coatWave = Math.sin(t * 2.1) * 0.9;
    P.bob = Math.sin(t * 2.6) * 0.4;
    let anim = e.anim || 'idle';
    let at = e.animT || 0;
    if (!isBoss) {
      // 동료: 공격 자세는 한 프레임만 남으므로 animT 로 이어서 보여 줌
      const m = M(e);
      if (anim === 'attack') m.atk = e.comboN % 2 ? 'slashL' : 'slashR';
      if (m.atk && at < 0.3 && e.down <= 0) anim = 'attack';
      else if (at >= 0.3) m.atk = null;
    }
    if (e.dead || anim === 'dead' || (!isBoss && e.down > 0)) {
      const a = e.dead ? e.deadT || at : 1;
      const k1 = clamp01(a / 0.4);
      P.crouch = 10 * k1;
      P.lean = 0.45 * k1;
      P.fFx = 6;
      P.fBx = -7;
      P.headTilt = 0.35 * k1;
      P.wa = 0.8;
      armTo(P, P.wa);
      P.eyeGlow = 0.4;
      P.wI = 0.4;
      P.bob = 0;
      if (e.dead && isBoss) P.fall = 0;
      return P;
    }
    if (e.broken) {
      P.crouch = 10;
      P.lean = 0.5;
      P.fFx = 7;
      P.fBx = -7;
      P.headTilt = 0.4 + Math.sin(t * 3) * 0.05;
      P.wa = 1.57;
      P.armF = 1.0;
      P.elbF = -0.4;
      P.armB = 1.3;
      P.wI = 0.6;
      P.bob = Math.sin(t * 6) * 0.4;
      return P;
    }
    switch (anim) {
      case 'move': {
        const ph = t * 12 + (e.id || 0);
        const s = Math.sin(ph);
        const c = Math.cos(ph);
        P.fFx = s * 8.5 + 1;
        P.fFy = -Math.max(0, c) * 4.5;
        P.fBx = -s * 8.5 + 1;
        P.fBy = -Math.max(0, -c) * 4.5;
        P.bob = -Math.abs(c) * 1.2 + 0.4;
        P.lean = 0.28;
        P.coatFlow = 1;
        P.coatWave = Math.sin(ph * 2) * 1.3;
        P.wa = 2.75;
        armTo(P, P.wa);
        P.armB = HALF - s * 0.8;
        break;
      }
      case 'windup': {
        const k = clamp01(at / 0.5);
        P.crouch = 6 * easeOut(k);
        P.lean = 0.32 * k;
        P.fFx = 8;
        P.fBx = -7;
        P.wa = lerp(2.35, 2.95, k);
        armTo(P, P.wa);
        P.armB = lerp(1.8, 0.4, k);
        P.elbB = 0.3;
        P.charge = k;
        P.eyeGlow = 1 + k;
        P.coatFlow = 0.3 * k;
        P.coatWave = Math.sin(t * 20) * k;
        break;
      }
      case 'dash':
        P.crouch = 6;
        P.lean = 0.62;
        P.fFx = 10;
        P.fBx = -11;
        P.fBy = -2;
        P.wa = 2.95;
        armTo(P, P.wa);
        P.armB = 2.5;
        P.coatFlow = 1;
        P.stretch = 1.12;
        P.charge = 0.6;
        break;
      case 'attack': {
        const fxn = (!isBoss && M(e).atk) || 'slashR';
        const k = clamp01(at / 0.3);
        swingPose(P, { k, h: 0.3, hl: 0.3, fx: fxn, heavy: false, n: 1, dur: 0.3 }, 'blade');
        P.wpn = 'zero';
        break;
      }
      case 'recover': {
        P.crouch = 5;
        P.lean = 0.42;
        P.headTilt = 0.35;
        P.fFx = 6;
        P.fBx = -6;
        P.wa = 1.25;
        armTo(P, P.wa);
        P.armB = 1.3;
        P.elbB = -0.2;
        P.bob = Math.sin(t * 7) * 0.9;
        P.eyeGlow = 0.6;
        P.wI = 0.7;
        break;
      }
      case 'stance':
        P.crouch = 4;
        P.lean = 0.12;
        P.fFx = 7;
        P.fBx = -6;
        P.wa = 0.62;
        armTo(P, P.wa);
        P.armB = 0.9;
        P.elbB = 0.9;
        P.charge = 0.6 + 0.4 * Math.sin(t * 14);
        P.eyeGlow = 2;
        P.aura = 1;
        P.coatWave = Math.sin(t * 16) * 1.2;
        break;
      case 'cast':
        P.castHand = 1;
        P.armB = -0.7;
        P.elbB = 0.3;
        P.castGlow = 0.7 + 0.3 * Math.sin(t * 20);
        P.castCol = '#ff3355';
        P.wa = 2.5;
        armTo(P, P.wa);
        P.lean = -0.05;
        P.fFx = 5;
        P.fBx = -4;
        break;
      case 'roar':
        P.armB = -1.0;
        P.elbB = -0.2;
        P.wa = -0.9;
        armTo(P, P.wa);
        P.headTilt = -0.3;
        P.lean = -0.15;
        P.fFx = 7;
        P.fBx = -6;
        P.aura = 1;
        P.charge = 0.8;
        P.coatWave = Math.sin(t * 25) * 1.5;
        break;
      case 'hurt':
        P.lean = -0.3;
        P.crouch = 2;
        P.headTilt = -0.25;
        P.armB = 2.5;
        P.wa = 2.6;
        armTo(P, P.wa);
        break;
      default:
        break;
    }
    return P;
  }

  function drawZero(g, e, W, t, isBoss) {
    const s = ((e.r || 20) * 3.3) / 60;
    const fx = faceX(e);
    const P = zeroPose(e, W, t, isBoss);
    P.away = isAway(e) && (e.anim === 'idle' || e.anim === 'move') && !e.broken;
    const R = isBoss ? ZERO_BOSS : ZERO;
    const down = !isBoss && e.down > 0;
    const stanceOn = (e.stance > 0 || e.anim === 'stance') && !e.broken;
    const phase2 = isBoss && (e.phase || 1) >= 2;
    // 붉은 기운
    if ((stanceOn || phase2 || P.aura) && !e.dead && !down) {
      const ia = stanceOn ? 0.55 + 0.25 * Math.sin(t * 14) : 0.3;
      glowE(g, 0, -30 * s, 26 * s, 38 * s, '#ff1f44', ia);
      const pc = g.globalCompositeOperation;
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < (stanceOn ? 7 : 4); i++) {
        const ph = (t * 1.6 + hash(i * 3.1)) % 1;
        const x = (hash(i * 7.3) - 0.5) * 30 * s;
        const y = -ph * 64 * s;
        g.fillStyle = rgba('#ff3355', (1 - ph) * (stanceOn ? 0.6 : 0.35));
        poly(g, [x - 2.2 * s, y, x, y - (8 + 6 * (1 - ph)) * s, x + 2.2 * s, y]);
        g.fill();
      }
      g.globalCompositeOperation = pc;
    }
    // 잔상 (돌진 / 2페이즈)
    if (!e.dead && !down && (e.anim === 'dash' || (phase2 && e.anim !== 'broken'))) {
      const pa = g.globalAlpha;
      const fwd = e.facing || 0;
      const n = e.anim === 'dash' ? 3 : 2;
      for (let i = n; i >= 1; i--) {
        const off = e.anim === 'dash' ? i * 14 : i * (6 + 3 * Math.sin(t * 3 + i));
        g.save();
        g.translate(-Math.cos(fwd) * off * s, -Math.sin(fwd) * SQ * off * s);
        g.scale(s * fx, s);
        g.globalAlpha = pa * (0.34 - i * 0.08);
        drawMan(g, ghostOf(R, i === 1 ? '#ff2a4a' : '#8a1030'), P, t);
        g.restore();
      }
      g.globalAlpha = pa;
    }
    g.save();
    g.scale(s * fx, s);
    if (down) g.globalAlpha *= 0.85 + 0.15 * Math.sin(t * 9);
    drawMan(g, R, P, t);
    if (down) {
      const pa = g.globalAlpha;
      g.globalAlpha = pa * 0.5;
      drawMan(g, ghostOf(R, '#6a6878'), P, t);
      g.globalAlpha = pa;
    }
    g.restore();
    // 약점 (숨 고르기 중 등 뒤)
    if (isBoss && (e.exposed > 0 || (W && W.scan > 0)) && !e.dead) {
      const ex = e.exposed > 0;
      const pp = pulse(t, 10);
      glow(g, -fx * 4 * s, -38 * s, (ex ? 10 + pp * 5 : 6) * s, ex ? '#ff5470' : '#7cf7ff', ex ? 0.9 : 0.5, true);
      if (ex) glow(g, -fx * 4 * s, -38 * s, 18 * s, '#7cf7ff', 0.25 + 0.2 * pp);
    }
    if (down) sparks(g, t, 4, 0, -24 * s, 14 * s, 14 * s, '#ff6b8a', e.id || 3);
  }

  /* =========================================================
   * 리아 (홀로그램 AI 파트너)
   * ========================================================= */
  function drawLia(g, e, W, t) {
    const s = ((e.r || 14) * 2.85) / 60;
    const fx = faceX(e);
    const P = ladyPose();
    const down = e.down > 0;
    const m = M(e);
    if (e.anim === 'cast') m.atk = 'cast';
    const casting = m.atk === 'cast' && (e.animT || 0) < 0.35 && !down;
    if (!casting && (e.animT || 0) >= 0.35) m.atk = null;
    P.bob = Math.sin(t * 2.2 + (e.id || 0)) * 1.8;
    P.hairWave = 1;
    P.legSw = Math.sin(t * 1.8) * 0.8;
    P.armF = 1.7 + Math.sin(t * 1.5) * 0.08;
    P.armB = 1.95;
    P.away = isAway(e) && !casting;
    if (e.anim === 'move') {
      P.lean = 0.12;
      P.legSw = 2.2;
      P.armB = 2.3;
      P.armF = 2.0;
    }
    if (casting) {
      const k = clamp01((e.animT || 0) / 0.35);
      P.armF = lerp(0.1, 0.4, k);
      P.elbF = 0.1;
      P.castGlow = 1 - k * 0.6;
      P.castHand = 0;
      P.castCol = '#9ae6ff';
      P.lean = 0.06;
    }
    if (down) {
      P.lean = 0.25;
      P.headTilt = 0.4;
      P.armF = 1.9;
      P.armB = 2.0;
      P.bob = 6;
      P.hairWave = 0.2;
    }
    const pa = g.globalAlpha;
    // 아래쪽 투사 빛
    if (!down) {
      glowE(g, 0, -4 * s, 16 * s, 6 * s, '#5fd8ff', 0.35);
      glowE(g, 0, -28 * s, 20 * s, 30 * s, '#5fc8ff', 0.18 + 0.05 * Math.sin(t * 3));
    }
    g.save();
    g.scale(s * fx, s);
    if (down) {
      const fl = hash(Math.floor(t * 14)) > 0.25 ? 0.85 : 0.3;
      g.globalAlpha = pa * fl;
      drawLady(g, ghostOf(LIA, '#8a90a8'), P, t);
      g.globalAlpha = pa;
    } else {
      g.globalAlpha = pa * (0.8 + 0.08 * Math.sin(t * 7));
      drawLady(g, LIA, P, t);
      g.globalAlpha = pa;
      // 홀로그램 반짝임 띠
      const yb = -((t * 22) % 70);
      const pc = g.globalCompositeOperation;
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = 'rgba(160,230,255,0.18)';
      g.fillRect(-8, yb, 16, 1.6);
      g.globalCompositeOperation = pc;
    }
    g.restore();
    if (down) {
      // 주사선 + 오프라인 표시
      const pc = g.globalCompositeOperation;
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = 'rgba(150,160,190,0.25)';
      for (let y = -60; y < 0; y += 4) g.fillRect(-10 * s, y * s + ((t * 30) % 4) * s, 20 * s, 0.8 * s);
      g.globalCompositeOperation = pc;
      sparks(g, t, 3, 0, -30 * s, 10 * s, 12 * s, '#9ab0c8', 41);
    }
  }

  /* =========================================================
   * 일반 적
   * ========================================================= */
  function drawHound(g, e, W, t) {
    const s = (e.r || 20) / 20;
    const fx = faceX(e);
    const col = (e.def && e.def.color) || '#ff5470';
    const anim = e.anim || 'idle';
    const at = e.animT || 0;
    let crouch = 0;
    let tilt = 0;
    let stretch = 1;
    let jit = 0;
    let gait = 0;
    let gaitA = 0;
    let eye = 0.8;
    if (anim === 'move') { gait = t * 16 + (e.id || 0); gaitA = 0.55; }
    else if (anim === 'windup') { const k = clamp01(at / 0.5); crouch = 4 * k; tilt = 0.12 * k; jit = Math.sin(t * 70) * 0.5 * k; eye = 0.8 + k; }
    else if (anim === 'dash') { stretch = 1.25; tilt = 0.06; eye = 1.6; gait = 1.2; gaitA = 0; }
    else if (anim === 'hurt') { tilt = -0.22; }
    else { gait = t * 2; gaitA = 0.04; }
    g.save();
    g.scale(s * fx, s);
    g.translate(jit, 0);
    if (anim === 'dash') {
      const pc = g.globalCompositeOperation;
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) seg(g, -22 - i * 4, -20 + i * 5, -40 - i * 6, -20 + i * 5, 1, rgba(col, 0.4));
      g.globalCompositeOperation = pc;
    }
    const legPair = (bx, by, ph, rear, far) => {
      const c1 = far ? '#1c1e28' : '#2c303e';
      const c2 = far ? '#14161e' : '#3a3f50';
      let a = Math.sin(ph) * gaitA;
      if (anim === 'dash') a = rear ? -0.9 : 0.9;
      const k1 = rear ? 0.55 : -0.25;
      const x1 = bx + Math.sin(a + k1) * 8;
      const y1 = by + Math.cos(a + k1) * 8;
      const x2 = x1 + Math.sin(a - k1 * 1.2) * 8.6;
      const y2 = Math.min(0, y1 + Math.cos(a - k1 * 1.2) * 8.6);
      g.lineCap = 'round';
      seg(g, bx, by, x1, y1, 3.6, c1);
      seg(g, x1, y1, x2, y2, 2.6, c2);
      fillPoly(g, [x2 - 1.5, y2 - 1, x2 + 2.6, y2 - 0.6, x2 + 3, y2, x2 - 1.6, y2], c2);
      if (!far) neon(g, x1 - 0.8, y1, x1 + 0.8, y1, col, 0.6, 0.7);
    };
    const by = -15 + crouch;
    // 먼 다리
    legPair(9 * stretch, by, gait + PI, false, true);
    legPair(-11 * stretch, by, gait, true, true);
    g.save();
    g.translate(0, by - 3);
    g.rotate(tilt);
    g.scale(stretch, 1);
    // 꼬리
    g.lineCap = 'round';
    const tw = Math.sin(t * 9) * 2;
    seg(g, -15, -3, -23, -9 + tw, 1.6, '#3a3f50');
    fillCirc(g, -23.5, -9.5 + tw, 1.4, col);
    glow(g, -23.5, -9.5 + tw, 4, col, 0.7);
    // 몸통
    fillPoly(g, [-17, -2, -14, -8, -2, -9.5, 8, -8, 13.5, -4, 11.5, 3, -2, 3.5, -14, 3, -18, 1], '#2a2d3a');
    fillPoly(g, [-14, -8, -2, -9.5, 8, -8, 9, -5, -2, -6, -13, -5], '#454b60');
    fillPoly(g, [-12, -9, -9, -13, -7, -9], '#3a3f50');
    fillPoly(g, [-5, -9.5, -2, -14, 0, -9.5], '#3a3f50');
    fillPoly(g, [2, -9, 5, -12.5, 6, -8.6], '#3a3f50');
    neonPath(g, [-15, -1, -2, -2.5, 10, -1.5], col, 0.6, 0.85);
    neon(g, -1, -6, -1, 2.5, col, 0.5, 0.5);
    // 머리
    g.save();
    g.translate(13, -5);
    g.rotate(anim === 'windup' ? 0.15 : anim === 'dash' ? 0.05 : Math.sin(t * 2) * 0.04);
    fillPoly(g, [-3, -3, 3, -6, 11, -3, 12.5, 0.5, 6.5, 2.5, 0, 3.5, -3, 2], '#30343f');
    fillPoly(g, [0, 3, 6.5, 2.5, 11.5, 1.5, 10.5, 4.5, 2, 5], '#1e2029');
    fillPoly(g, [0, -3.5, -1.5, -10, 3, -5], '#3a3f50');
    seg(g, 8, 2.8, 11, 2.3, 0.6, '#cfd6e6');
    fillCirc(g, 6.2, -2.4, 1.1, col);
    fillCirc(g, 8.8, -1.8, 0.8, col);
    glow(g, 7, -2.2, 5 + eye * 2, col, 0.6 + 0.3 * eye, true);
    g.restore();
    g.restore();
    // 가까운 다리
    legPair(10 * stretch, by + 0.6, gait, false, false);
    legPair(-10 * stretch, by + 0.6, gait + PI, true, false);
    g.restore();
  }

  function drawDrone(g, e, W, t, mini) {
    const s = (e.r || 16) / 16;
    const col = (e.def && e.def.color) || '#5fd4ff';
    const f = e.facing || 0;
    const anim = e.anim || 'idle';
    const at = e.animT || 0;
    const ch = anim === 'charge' ? clamp01(at / 0.4) : 0;
    const bob = Math.sin(t * 3.2 + (e.id || 0) * 1.7) * 1.6;
    const cx = 0;
    const cy = -12 + bob;
    g.save();
    g.scale(s, s);
    const lx = Math.cos(f);
    const ly = Math.sin(f);
    if (mini) {
      // 작은 감시 드론: 삼각 날개
      g.save();
      g.translate(cx, cy);
      g.rotate(Math.sin(t * 2.2 + (e.id || 0)) * 0.1);
      g.scale(1.15, 1.25);
      fillPoly(g, [-12, 1, -3, -4, 3, -4, 12, 1, 4, 3.5, -4, 3.5], '#1e2738');
      fillPoly(g, [-12, 1, -3, -4, 3, -4, 12, 1, 0, -1], '#2f3c54');
      neonPath(g, [-11.5, 1, -4, 3.2, 4, 3.2, 11.5, 1], col, 0.7, 0.8);
      fillEll(g, 0, -1, 5, 3.6, 0, '#283246');
      const px = lx * 2.4;
      const vis = ly > -0.6;
      fillCirc(g, px, -0.6 + ly * 0.8, 2.2, vis ? '#0c1220' : '#1b2232');
      if (vis) {
        fillCirc(g, px, -0.6 + ly * 0.8, 1.4, col);
        glow(g, px, -0.6 + ly * 0.8, 5 + ch * 8, col, 0.7 + ch * 0.3, true);
      }
      glowE(g, 0, 5, 7, 2.5, col, 0.4);
      g.restore();
      g.restore();
      return;
    }
    // 회전 날개 팔
    const arm = (sx, front) => {
      seg(g, cx + sx * 6, cy - 1, cx + sx * 14, cy - 5, 1.6, front ? '#3a4660' : '#2a3448');
      const w = 5.5 * Math.abs(Math.cos(t * 38 + sx));
      fillEll(g, cx + sx * 14, cy - 6, w + 1, 1.2, 0, 'rgba(160,200,255,0.35)');
      fillCirc(g, cx + sx * 14, cy - 5, 1.4, '#4a5878');
    };
    arm(-1, false);
    arm(1, true);
    // 몸체
    fillCirc(g, cx, cy, 8.6, '#1f2738');
    fillEll(g, cx, cy + 1.5, 8.6, 2.6, 0, '#2c3850');
    neonPath(g, [cx - 8.4, cy + 1.8, cx - 4, cy + 3.6, cx + 4, cy + 3.6, cx + 8.4, cy + 1.8], col, 0.5, 0.6);
    g.beginPath();
    g.arc(cx - 1.5, cy - 2.5, 5.5, PI * 1.05, PI * 1.6);
    g.strokeStyle = 'rgba(200,220,255,0.35)';
    g.lineWidth = 1.2;
    g.stroke();
    // 아래 안테나
    seg(g, cx, cy + 8, cx, cy + 12, 0.8, '#4a5878');
    fillCirc(g, cx, cy + 12.5, 0.9, pulse(t, 6) > 0.5 ? col : '#2a3448');
    // 렌즈 (바라보는 방향)
    const vis = ly > -0.55;
    const px = cx + lx * 4.6;
    const py = cy - 0.5 + ly * 2.4;
    const sx = 0.55 + 0.45 * Math.abs(ly);
    if (vis) {
      fillEll(g, px, py, 3.6 * sx, 3.6, 0, '#0a1020');
      fillEll(g, px, py, 2.5 * sx, 2.5, 0, col);
      fillCirc(g, px + 0.5 * lx, py - 0.6, 0.8, '#ffffff');
      glow(g, px, py, 6 + ch * 10, col, 0.6 + ch * 0.4, ch > 0.4);
    } else {
      fillCirc(g, cx - lx * 3, cy - 3, 1, col);
      glow(g, cx - lx * 3, cy - 3, 3, col, 0.4);
    }
    g.restore();
  }

  function soldierPose(e, t, sniper) {
    const P = basePose();
    P.wpn = sniper ? 'longrifle' : 'rifle';
    P.wcol = sniper ? '#ffb35c' : '#9ab0ff';
    P.wa = 0.5;
    P.armF = 1.25;
    P.elbF = 1.0;
    P.grip = sniper ? 12 : 8;
    P.bob = Math.sin(t * 2.2 + (e.id || 0)) * 0.4;
    const anim = e.anim || 'idle';
    const at = e.animT || 0;
    if (anim === 'move') {
      const ph = t * 10 + (e.id || 0);
      const s = Math.sin(ph);
      const c = Math.cos(ph);
      P.fFx = s * 6 + 1;
      P.fFy = -Math.max(0, c) * 3.5;
      P.fBx = -s * 6 + 1;
      P.fBy = -Math.max(0, -c) * 3.5;
      P.bob = -Math.abs(c) * 0.8;
      P.lean = 0.1;
      P.wa = 0.35;
    } else if (anim === 'charge') {
      const k = clamp01(at / (sniper ? 1.3 : 0.75));
      P.wa = 0.0;
      P.armF = 1.0;
      P.elbF = 1.05;
      P.charge = k;
      P.eyeGlow = 1 + k;
      if (sniper) { P.crouch = 7 * Math.min(1, k * 3); P.fFx = 7; P.fBx = -7; P.lean = 0.12; }
      else { P.crouch = 1.5; P.fFx = 5; P.fBx = -5; }
    } else if (anim === 'hurt') {
      P.lean = -0.3;
      P.headTilt = -0.2;
      P.wa = 1.0;
    }
    if (e.dead) {
      const a = e.deadT || 0;
      const k1 = clamp01(a / 0.35);
      P.crouch = 8 * k1;
      P.lean = 0.3 * k1;
      P.fall = easeIn(clamp01((a - 0.3) / 0.45)) * 1.35;
      P.wa = 1.4;
      P.eyeGlow = 1 - k1;
    }
    return P;
  }

  function drawSoldier(g, e, W, t, sniper) {
    const s = ((e.r || 18) * 3.3) / 60;
    const fx = faceX(e);
    const P = soldierPose(e, t, sniper);
    g.save();
    g.scale(s * fx, s);
    drawMan(g, sniper ? SNIPER : SOLDIER, P, t);
    g.restore();
  }

  function drawGuardBot(g, e, W, t) {
    const s = (e.r || 28) / 28;
    const fx = faceX(e);
    const col = (e.def && e.def.color) || '#8fa8c8';
    const f = e.facing || 0;
    const sf = Math.sin(f);
    const anim = e.anim || 'idle';
    const at = e.animT || 0;
    let lift = 0;
    let push = 0;
    let lean = 0;
    let glowK = 0.5;
    if (anim === 'windup') { const k = clamp01(at / 0.8); lift = 8 * easeOut(k); lean = -0.1 * k; glowK = 0.5 + k; }
    else if (anim === 'attack') { const k = clamp01(at / 0.12); push = 7 * k; lift = 8 * (1 - k) - 2 * k; lean = 0.12 * k; glowK = 1.4 - clamp01((at - 0.15) / 0.4); }
    else if (anim === 'hurt') lean = -0.15;
    const walk = anim === 'move' ? Math.sin(t * 7 + (e.id || 0)) : 0;
    g.save();
    g.scale(s * fx, s);
    const shieldFace = 9 + 21 * Math.abs(sf);
    const shX = 13 * (0.35 + 0.65 * Math.abs(Math.cos(f))) + 5 + push;
    const shY = sf * 5;
    const drawShield = () => {
      g.save();
      g.translate(shX, -26 - lift + shY);
      const w = shieldFace;
      const hw = w / 2;
      const facing = sf > 0.25;
      const pts = [-hw, -22, hw * 0.7, -24, hw, -18, hw, 17, hw * 0.3, 24, -hw * 0.3, 24, -hw, 17];
      if (!facing && sf < -0.25) {
        fillPoly(g, pts, '#1a202c');
        neonPath(g, [-hw, 17, -hw * 0.3, 24, hw * 0.3, 24, hw, 17], col, 0.6, 0.4);
      } else {
        fillPoly(g, pts, '#2c3446', '#7a8aa6', 1.4);
        fillPoly(g, [-hw * 0.7, -18, hw * 0.55, -19.5, hw * 0.72, -15, hw * 0.72, 14, 0, 19, -hw * 0.72, 14], '#384258');
        neon(g, 0, -15, 0, 15, '#7ce8ff', 1.1, 0.5 + glowK * 0.4);
        neon(g, -hw * 0.6, 0, hw * 0.6, 0, '#7ce8ff', 0.7, 0.4 + glowK * 0.3);
        glow(g, 0, 0, 6 + glowK * 4, '#7ce8ff', 0.5 + glowK * 0.3);
        if (anim === 'attack' && at < 0.4) glowE(g, 0, 22, 18, 6, '#bfefff', 0.8 * (1 - at / 0.4), true);
      }
      g.restore();
    };
    if (sf < -0.25) drawShield();
    g.save();
    g.translate(0, -16);
    g.rotate(lean);
    // 다리
    g.lineCap = 'butt';
    fillPoly(g, [-10, 0, -4, 0, -3.5, 16 + walk * -1.5, -11, 16 + walk * -1.5], '#262d3c');
    fillPoly(g, [3, 0, 9, 0, 10, 16 + walk * 1.5, 2.5, 16 + walk * 1.5], '#323b4e');
    fillPoly(g, [-13, 13 + walk * -1.5, -2, 13 + walk * -1.5, -1, 16, -14, 16], '#1c222e');
    fillPoly(g, [1, 13 + walk * 1.5, 13, 13 + walk * 1.5, 14, 16, 0, 16], '#262d3c');
    // 몸통
    fillPoly(g, [-16, -2, -17, -24, -12, -30, 10, -30, 15, -24, 14, -2, 8, 3, -10, 3], '#3a4558');
    fillPoly(g, [-17, -24, -12, -30, 10, -30, 15, -24, 10, -21, -12, -21], '#56657e');
    fillPoly(g, [-16, -2, -10, 3, 8, 3, 14, -2, 8, -5, -10, -5], '#2a3242');
    neon(g, -11, -12, 9, -12, col, 0.7, 0.6);
    fillCirc(g, 4, -14, 3.2, '#1a2030');
    fillCirc(g, 4, -14, 1.8, '#7ce8ff');
    glow(g, 4, -14, 7, '#7ce8ff', 0.5 + glowK * 0.3);
    // 어깨
    fillEll(g, -14, -26, 6.5, 5, -0.3, '#4a566e');
    fillEll(g, 11, -26, 6.5, 5, 0.3, '#5a6880');
    // 머리
    fillPoly(g, [-6, -30, -5, -37, 2, -39, 6, -36, 6, -30], '#465269');
    fillPoly(g, [0, -36, 7, -35.5, 7, -32.5, 0, -33], '#0a0e16');
    neon(g, 1, -34.5, 6.4, -34.3, '#ff5470', 0.9, 0.9);
    glow(g, 4.5, -34.4, 4, '#ff5470', 0.6);
    g.restore();
    if (sf >= -0.25) drawShield();
    g.restore();
  }

  function drawBomber(g, e, W, t) {
    const s = (e.r || 15) / 15;
    const col = (e.def && e.def.color) || '#ff9b3d';
    const anim = e.anim || 'idle';
    const at = e.animT || 0;
    const ch = anim === 'charge' ? clamp01(at / 0.6) : 0;
    const bob = Math.sin(t * 5 + (e.id || 0)) * 1.4;
    const blink = ch > 0 ? Math.sin(t * (40 + ch * 40)) > 0 : Math.sin(t * 9) > 0.3;
    const sc = 1 + ch * 0.35 + (ch > 0 ? Math.sin(t * 50) * 0.04 : 0);
    g.save();
    g.scale(s, s);
    g.translate(0, -11 + bob);
    g.scale(sc, sc);
    // 추진 불꽃
    glowE(g, 0, 8, 4, 7 + Math.sin(t * 30), '#ffb347', 0.7);
    // 가시
    const rot = t * 1.5;
    for (let i = 0; i < 8; i++) {
      const a = rot + (i / 8) * TAU;
      const c = Math.cos(a);
      const sn = Math.sin(a) * 0.8;
      fillPoly(g, [c * 5 - sn * 1.8, sn * 5 + c * 1.6, c * 11, sn * 11, c * 5 + sn * 1.8, sn * 5 - c * 1.6], '#3a2a20');
      fillCirc(g, c * 10.6, sn * 10.6, 0.8, col);
    }
    fillCirc(g, 0, 0, 6.8, '#3a2a22');
    fillCirc(g, 0, 0, 5.6, '#5a3a24');
    g.beginPath();
    g.arc(-1, -1.5, 4, PI * 1.05, PI * 1.6);
    g.strokeStyle = 'rgba(255,220,180,0.4)';
    g.lineWidth = 1;
    g.stroke();
    fillCirc(g, 0, 0, 3, blink ? '#ffe0a0' : col);
    glow(g, 0, 0, (blink ? 10 : 6) + ch * 14, col, blink ? 0.95 : 0.5, blink);
    if (ch > 0) {
      g.strokeStyle = rgba('#ff5a3d', 0.4 + 0.5 * (blink ? 1 : 0));
      g.lineWidth = 1;
      circ(g, 0, 0, 13 + ch * 4);
      g.stroke();
    }
    g.restore();
  }

  /* ───────────── 세라 (보스) 와 기억의 환영 공용 ───────────── */
  function seraPose(e, t) {
    const P = ladyPose();
    const anim = e.anim || 'idle';
    const at = e.animT || 0;
    P.bob = Math.sin(t * 1.8 + (e.id || 0)) * 1.5;
    P.hairWave = 1.4;
    P.legSw = Math.sin(t * 1.4) * 0.6;
    P.armF = 1.95;
    P.elbF = -0.5;
    P.armB = 2.1;
    P.elbB = -0.4;
    switch (anim) {
      case 'cast': {
        const k = clamp01(at / 0.35);
        P.armF = lerp(1.9, -0.7, easeOut(k));
        P.elbF = 0.2;
        P.armB = lerp(2.1, -1.2, easeOut(k));
        P.elbB = -0.2;
        P.castGlow = 0.7 + 0.3 * Math.sin(t * 16);
        P.castHand = 0;
        P.castCol = '#ff7ad9';
        P.headTilt = -0.12;
        P.hairWave = 2.2;
        break;
      }
      case 'windup': {
        const k = clamp01(at / 0.5);
        P.armF = lerp(1.9, 2.7, k);
        P.elbF = 1.2 * k;
        P.armB = 0.6;
        P.elbB = 0.2;
        P.castGlow = k;
        P.castHand = 0;
        P.castCol = '#ff7ad9';
        P.lean = -0.1 * k;
        break;
      }
      case 'attack': {
        const k = clamp01(at / 0.15);
        P.armF = lerp(2.7, -0.05, easeOut(k));
        P.elbF = 0.05;
        P.armB = 2.3;
        P.castGlow = 1 - clamp01((at - 0.15) / 0.4);
        P.castHand = 0;
        P.castCol = '#ffb0ee';
        P.lean = 0.15 * k;
        P.hairWave = 2.5;
        break;
      }
      case 'hurt':
        P.lean = -0.25;
        P.headTilt = -0.2;
        break;
      default:
        break;
    }
    return P;
  }

  /** 데이터 날개 리본 */
  function dataRibbons(g, t, col, col2, sc, n, a) {
    const pc = g.globalCompositeOperation;
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      const side = i % 2 ? 1 : -1;
      const k = Math.floor(i / 2);
      const ph = t * 1.4 + i * 1.3;
      const x0 = side * 2 * sc;
      const y0 = -40 * sc;
      const x1 = side * (12 + k * 4) * sc + Math.sin(ph) * 2 * sc;
      const y1 = (-50 - k * 4) * sc + Math.cos(ph * 0.8) * 3 * sc;
      const x2 = side * (19 + k * 5) * sc + Math.sin(ph + 1) * 3 * sc;
      const y2 = (-34 + k * 8) * sc + Math.sin(ph * 1.2) * 3 * sc;
      g.beginPath();
      g.moveTo(x0, y0);
      g.bezierCurveTo(x1, y1, x2, y2 - 8 * sc, x2 + side * 3 * sc, y2 + 10 * sc);
      g.strokeStyle = rgba(i % 3 === 2 ? col2 : col, 0.16 * a);
      g.lineWidth = 4.5 * sc;
      g.stroke();
      g.strokeStyle = rgba(i % 3 === 2 ? col2 : col, 0.7 * a);
      g.lineWidth = 0.9 * sc;
      g.stroke();
      // 데이터 조각
      for (let j = 0; j < 3; j++) {
        const u = (t * 0.6 + j / 3 + i * 0.17) % 1;
        const bx = lerp(x0, x2 + side * 3 * sc, u) + Math.sin(u * 6 + ph) * 2 * sc;
        const by = lerp(y0, y2 + 10 * sc, u) - Math.sin(u * PI) * 10 * sc;
        g.fillStyle = rgba('#ffffff', 0.6 * (1 - u) * a);
        g.fillRect(bx, by, 1.4 * sc, 1.4 * sc);
      }
    }
    g.globalCompositeOperation = pc;
  }

  function drawSeraFigure(g, e, W, t, S, scale, opts) {
    const fx = faceX(e);
    const P = seraPose(e, t);
    P.away = isAway(e) && e.anim !== 'cast';
    if (opts && opts.broken) {
      P.lean = 0.35;
      P.headTilt = 0.45;
      P.armF = 2.1;
      P.armB = 2.3;
      P.hairWave = 0.5;
      P.bob = 4;
    }
    g.save();
    g.scale(scale * fx, scale);
    drawLady(g, S, P, t);
    g.restore();
    return P;
  }

  function drawSeraClone(g, e, W, t) {
    const sc = ((e.r || 26) * 3.3) / 60;
    const fake = W && W.scan > 0;
    const S = fake ? ghostOf(SERA, '#ff3a5a') : SERA;
    const pa = g.globalAlpha;
    const gl = Math.floor(t * 12);
    // 글리치 띠: 몇 줄씩 어긋나게
    const bands = 4;
    const top = -66 * sc;
    const bh = (-top) / bands;
    dataRibbons(g, t, fake ? '#ff4060' : '#c9a4ff', '#ff7ad9', sc, 4, fake ? 0.4 : 0.5);
    for (let i = 0; i < bands; i++) {
      const off = hash(gl * 3.7 + i * 1.3) > (fake ? 0.45 : 0.75) ? (hash(gl + i * 9.1) - 0.5) * (fake ? 12 : 6) * sc : 0;
      g.save();
      g.beginPath();
      g.rect(-40 * sc, top + i * bh, 80 * sc, bh + 0.5);
      g.clip();
      g.translate(off, 0);
      g.globalAlpha = pa * (fake ? 0.6 : 0.45);
      drawSeraFigure(g, e, W, t, S, sc);
      g.restore();
    }
    if (!fake) {
      // 보랏빛 환영 막
      g.globalAlpha = pa * 0.22;
      drawSeraFigure(g, e, W, t, ghostOf(SERA, '#b8a0ff'), sc);
    }
    g.globalAlpha = pa;
    if (fake) {
      glowE(g, 0, -34 * sc, 22 * sc, 34 * sc, '#ff2244', 0.35 + 0.15 * Math.sin(t * 10));
      // 가짜 표시: 가슴의 깨진 X 표 ("FAKE" 글자는 render.js 가 머리 위에 띄움)
      const jx = (hash(gl * 1.7) - 0.5) * 2 * sc;
      g.strokeStyle = 'rgba(255,235,240,0.9)';
      g.lineWidth = 1.6 * sc;
      g.beginPath();
      g.moveTo(-7 * sc + jx, -44 * sc);
      g.lineTo(7 * sc + jx, -30 * sc);
      g.moveTo(7 * sc + jx, -44 * sc);
      g.lineTo(-7 * sc + jx, -30 * sc);
      g.stroke();
      glow(g, jx, -37 * sc, 12 * sc, '#ff3a5a', 0.6);
    } else {
      // 가끔 튀는 색수차
      if (hash(gl * 2.3) > 0.8) {
        g.save();
        g.translate(2 * sc, 0);
        g.globalAlpha = pa * 0.25;
        drawSeraFigure(g, e, W, t, ghostOf(SERA, '#66e0ff'), sc);
        g.restore();
      }
    }
    g.globalAlpha = pa;
  }

  const MINION = {
    hound: drawHound,
    drone: (g, e, W, t) => drawDrone(g, e, W, t, false),
    miniDrone: (g, e, W, t) => drawDrone(g, e, W, t, true),
    soldier: (g, e, W, t) => drawSoldier(g, e, W, t, false),
    sniper: (g, e, W, t) => drawSoldier(g, e, W, t, true),
    guardBot: drawGuardBot,
    bomber: drawBomber,
    seraClone: drawSeraClone,
  };

  function drawMinion(g, e, W, t) {
    const fn = MINION[e.type];
    if (!fn) return drawUnknown(g, e, W, t);
    const humanoid = e.type === 'soldier' || e.type === 'sniper';
    if (e.dead) {
      const d = e.deadT || 0;
      if (d > 1.15) return;
      const fly = e.def && e.def.flying;
      const k = clamp01(d / 1.0);
      if (e.type === 'seraClone') {
        g.save();
        g.scale(1 + k * 0.6, 1 - k * 0.9);
        fn(g, e, W, t);
        g.restore();
        return;
      }
      g.save();
      if (fly) {
        const fall = Math.min(1, (d * 2.4) * (d * 2.4));
        g.translate(0, fall * (e.z || 20));
        g.rotate(d * 3 * (e.id % 2 ? 1 : -1));
      } else if (!humanoid) {
        g.translate(0, k * 4);
        g.rotate(-faceX(e) * Math.min(1, d * 3) * 0.5);
        g.scale(1, 1 - k * 0.3);
      }
      fn(g, e, W, t);
      g.restore();
      if (d < 0.6) sparks(g, d * 2, 5, 0, -(e.r || 16), (e.r || 16), (e.r || 16), '#ffd28a', (e.id || 1) * 3);
      return;
    }
    if (e.spawnT > 0) {
      // 전송되어 나타나는 중
      const r = e.r || 16;
      glowE(g, 0, -r * 1.2, r * 0.9, r * 2.4, (e.def && e.def.color) || '#7cf7ff', 0.5 + 0.3 * Math.sin(t * 30));
      g.globalAlpha *= 0.65 + 0.35 * hash(Math.floor(t * 30) + (e.id || 0));
    }
    fn(g, e, W, t);
  }

  /* =========================================================
   * 보스 공용 도우미
   * ========================================================= */
  /** 두 점 사이의 사다리꼴(굵기가 변하는 팔다리 판) */
  function taper(g, x1, y1, x2, y2, w1, w2, fill, stroke, lw) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const L = Math.hypot(dx, dy) || 1;
    const nx = (-dy / L) * 0.5;
    const ny = (dx / L) * 0.5;
    poly(g, [x1 + nx * w1, y1 + ny * w1, x2 + nx * w2, y2 + ny * w2, x2 - nx * w2, y2 - ny * w2, x1 - nx * w1, y1 - ny * w1]);
    if (fill) { g.fillStyle = fill; g.fill(); }
    if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw || 1; g.stroke(); }
  }
  function bossAnim(e) {
    return { anim: e.anim || 'idle', at: e.animT || 0, ex: e.exposed > 0, br: !!e.broken, ph: e.phase || 1 };
  }
  /** 약점 강조: 노출 중이면 크게 맥동, 분석 중이면 청록 표시 */
  function weakGlow(g, x, y, r, col, e, W, t, base) {
    const ex = e.exposed > 0;
    const scan = W && W.scan > 0;
    const p = pulse(t, ex ? 11 : 4);
    glow(g, x, y, r * (ex ? 1.6 + p * 0.6 : 1), col, ex ? 0.95 : base == null ? 0.55 : base, true);
    if (ex) {
      glow(g, x, y, r * 3 + p * r, col, 0.3 + 0.2 * p);
      const pc = g.globalCompositeOperation;
      g.globalCompositeOperation = 'lighter';
      g.strokeStyle = rgba('#ffffff', 0.5 * (1 - p));
      g.lineWidth = Math.max(1, r * 0.12);
      circ(g, x, y, r * (1.2 + p * 1.4));
      g.stroke();
      g.globalCompositeOperation = pc;
    }
    if (scan && !ex) {
      const pc = g.globalCompositeOperation;
      g.globalCompositeOperation = 'lighter';
      g.strokeStyle = rgba('#7cf7ff', 0.5 + 0.3 * p);
      g.lineWidth = Math.max(1, r * 0.1);
      circ(g, x, y, r * 1.5);
      g.stroke();
      g.globalCompositeOperation = pc;
    }
  }

  /* ───────────── 1. 스캐빈저 — 폐허의 포식자 ───────────── */
  function bossScavenger(g, e, W, t) {
    const s = (e.r || 46) / 46;
    const fx = faceX(e);
    const A = bossAnim(e);
    const { anim, at } = A;
    const red = '#ff3d55';
    let bodyRot = 0;
    let bodyY = Math.sin(t * 2.2) * 1.2;
    let stretch = 1;
    let jaw = 0.05;
    let eye = 0.8;
    let seam = 0.7;
    let walk = 0;
    let walkA = 0;
    let armN = null; // 가까운 팔 손 위치 [x, y]
    let armF = null;
    let shake = 0;
    if (anim === 'move') { walk = t * 7 + (e.id || 0); walkA = 1; bodyY += Math.abs(Math.sin(walk)) * -2; }
    if (A.br) {
      bodyRot = 0.14;
      bodyY = 12;
      jaw = 0.25;
      eye = 0.3 + 0.3 * hash(Math.floor(t * 10));
      seam = 0.35;
      armN = [44, -2];
      armF = [30, 0];
    } else if (anim === 'windup') {
      const k = easeOut(clamp01(at / 0.5));
      bodyRot = -0.16 * k;
      armN = [lerp(36, 22, k), lerp(-4, -92, k)];
      eye = 0.8 + k;
      seam = 0.7 + 0.5 * k;
      jaw = 0.2 * k;
      shake = Math.sin(t * 60) * 0.8 * k;
    } else if (anim === 'attack') {
      const k = easeOut3(clamp01(at / 0.12));
      bodyRot = lerp(-0.16, 0.12, k);
      armN = [lerp(22, 60, k), lerp(-92, -10, k)];
      jaw = 0.35;
      eye = 1.6;
      seam = 1.2;
      if (at < 0.3) bodyY -= 4 * (1 - at / 0.3);
    } else if (anim === 'dash') {
      bodyRot = 0.08;
      stretch = 1.2;
      armN = [62, -14];
      armF = [56, -8];
      eye = 1.8;
      seam = 1.2;
      jaw = 0.3;
    } else if (anim === 'roar') {
      bodyRot = -0.22;
      jaw = 0.6;
      armN = [44, -40];
      armF = [30, -34];
      eye = 2;
      seam = 1.5;
      shake = Math.sin(t * 50) * 1.2;
    } else if (anim === 'hurt') {
      bodyRot = -0.1;
    }
    // 땅 파고들기
    let sink = 0;
    if (anim === 'burrow') sink = clamp01(at / 0.5);
    g.save();
    g.scale(s * fx, s);
    if (sink > 0) {
      // 흙더미 + 균열
      const m = 1 - Math.abs(sink - 0.6);
      fillEll(g, 0, -2, 44 + 10 * sink, 12, 0, '#1a1418');
      fillEll(g, 0, -4, 36 * m + 8, 8, 0, '#2a1f22');
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU + 0.3;
        neon(g, Math.cos(a) * 10, -3 + Math.sin(a) * 3, Math.cos(a) * (30 + 14 * sink), -3 + Math.sin(a) * 9, red, 0.9, 0.5 + 0.4 * pulse(t, 8));
      }
      sparks(g, t * 1.5, 6, 0, -8, 36, 14, '#ffb35c', 21);
      if (sink >= 1) {
        g.restore();
        return;
      }
      g.beginPath();
      g.rect(-120, -200, 240, 199);
      g.clip();
      g.translate(0, sink * 96);
    }
    const shakeY = 0;
    g.translate(shake, bodyY);
    // 꼬리 (고철 케이블)
    g.lineCap = 'round';
    const tw = Math.sin(t * 2.4) * 5;
    g.strokeStyle = '#2a2226';
    g.lineWidth = 6;
    g.beginPath();
    g.moveTo(-36, -36);
    g.quadraticCurveTo(-56, -40 + tw, -70, -18 + tw * 0.6);
    g.stroke();
    for (let i = 1; i <= 3; i++) {
      const u = i / 3.4;
      const x = lerp(-36, -70, u);
      const y = lerp(-38, -18 + tw * 0.6, u) - Math.sin(u * PI) * 4;
      fillPoly(g, [x - 3, y - 3, x + 3, y - 4, x + 2, y + 3], '#3a3034');
    }
    fillPoly(g, [-70, -22 + tw * 0.6, -82, -10 + tw * 0.6, -68, -14 + tw * 0.6], '#4a3a3e');
    neon(g, -70, -20 + tw * 0.6, -80, -11 + tw * 0.6, red, 0.8, 0.8);

    const limb = (sx, sy, hx, hy, w1, w2, far, claw, bendSign) => {
      const mx = (sx + hx) / 2 + bendSign * 10;
      const my = (sy + hy) / 2 - 4;
      const c1 = far ? '#1c1619' : '#2e2428';
      const c2 = far ? '#151012' : '#3d3034';
      taper(g, sx, sy, mx, my, w1, w1 * 0.8, c1);
      taper(g, mx, my, hx, hy, w1 * 0.8, w2, c2);
      fillCirc(g, mx, my, w1 * 0.45, far ? '#241c1f' : '#4a3a3e');
      if (!far) neon(g, mx - 3, my - 2, mx + 3, my + 2, red, 0.9, seam);
      if (claw) {
        for (let i = 0; i < 3; i++) {
          const a = -0.35 + i * 0.32;
          const cx = hx + Math.cos(a) * 3;
          const cy = hy + Math.sin(a) * 3;
          fillPoly(g, [cx - 2, cy - 2, cx + Math.cos(a) * 15, cy + Math.sin(a) * 15 + 2, cx + 2, cy + 2], far ? '#3a3034' : '#8a7e80');
        }
      }
    };
    g.save();
    g.translate(-26, -36);
    g.rotate(bodyRot);
    g.scale(stretch, 1);
    g.translate(26, 36);
    // 먼 팔다리
    const wF = Math.sin(walk + PI) * 9 * walkA;
    const wN = Math.sin(walk) * 9 * walkA;
    const gy = -bodyY - shakeY;
    limb(-30, -38, -36 + wN, gy - 1 + Math.min(0, Math.cos(walk) * 4 * walkA), 15, 10, true, false, 1);
    const fH = armF ? [armF[0], armF[1] + (A.br ? gy : 0)] : [30 + wN, gy - 2 + Math.min(0, -Math.cos(walk) * 5 * walkA)];
    limb(14, -54, fH[0], fH[1], 14, 10, true, true, -1);
    // 몸통
    fillPoly(g, [-42, -36, -36, -56, -16, -76, 6, -72, 24, -62, 32, -46, 14, -30, -16, -27, -38, -29], '#2a2125');
    fillPoly(g, [-36, -56, -16, -76, 6, -72, 24, -62, 10, -58, -14, -60, -30, -50], '#433438');
    // 들쭉날쭉 판 + 고철 가시
    fillPoly(g, [-34, -54, -46, -72, -26, -60], '#3a2e32');
    fillPoly(g, [-22, -66, -30, -90, -12, -72], '#4a3a3e');
    fillPoly(g, [-2, -72, 2, -94, 10, -70], '#3a2e32');
    fillPoly(g, [12, -66, 24, -84, 22, -62], '#4a3a3e');
    fillPoly(g, [-20, -46, 0, -52, 14, -42, -4, -38], '#3a2e32');
    neonPath(g, [-38, -32, -16, -30, 12, -32, 28, -45], red, 1, seam);
    neonPath(g, [-30, -50, -14, -60, 8, -58, 22, -60], red, 0.9, seam * 0.9);
    neonPath(g, [-20, -46, 0, -52, 14, -42], red, 0.8, seam * 0.7);
    neon(g, -22, -66, -28, -86, red, 0.7, seam * 0.6);
    // 등의 동력 코어 (약점 — 바라보는 반대쪽 등)
    const away = isAway(e);
    const cr = away ? 11 : 8.5;
    fillCirc(g, -18, -74, cr + 3, '#1a1214');
    fillCirc(g, -18, -74, cr, '#ff8a2a');
    fillCirc(g, -18, -74, cr * 0.55, '#ffe0a0');
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * PI + 0.4;
      seg(g, -18 + Math.cos(a) * (cr + 2), -74 + Math.sin(a) * (cr + 2), -18 - Math.cos(a) * (cr + 2), -74 - Math.sin(a) * (cr + 2), 1.6, '#2a1f22');
    }
    weakGlow(g, -18, -74, cr * 1.2, '#ffa040', e, W, t, A.br ? 0.3 + 0.4 * hash(Math.floor(t * 12)) : 0.75);
    // 머리
    g.save();
    g.translate(30, -46);
    if (anim === 'roar') g.rotate(-0.35);
    else if (anim === 'windup') g.rotate(-0.1);
    else if (A.br) g.rotate(0.35);
    fillPoly(g, [-2, -8, 12, -13, 26, -6, 28, 2, 18, 4, 4, 6, -3, 3], '#352a2e');
    fillPoly(g, [2, -10, 12, -13, 24, -7, 12, -6], '#4f3e42');
    fillPoly(g, [4, -12, -2, -22, 10, -12], '#3a2e32');
    // 아래턱
    g.save();
    g.translate(4, 3);
    g.rotate(jaw);
    fillPoly(g, [0, 0, 22, -1, 25, 3, 12, 7, 0, 5], '#2a2024');
    for (let i = 0; i < 4; i++) fillPoly(g, [8 + i * 4, -1, 10 + i * 4, -4, 12 + i * 4, -1], '#cfc4c0');
    g.restore();
    for (let i = 0; i < 4; i++) fillPoly(g, [10 + i * 4, 3, 12 + i * 4, 6.5, 14 + i * 4, 3], '#e0d6d0');
    if (jaw > 0.2) glow(g, 18, 6, 8 + jaw * 10, red, 0.4 * jaw);
    fillCirc(g, 17, -5, 1.6, red);
    fillCirc(g, 21.5, -3.5, 1.2, red);
    fillCirc(g, 13.5, -6, 1.0, red);
    glow(g, 18, -4.5, 7 + eye * 4, red, 0.5 + eye * 0.25, true);
    g.restore();
    // 가까운 다리 + 팔
    limb(-24, -36, -28 + wF, gy - 1 + Math.min(0, -Math.cos(walk) * 4 * walkA), 17, 11, false, false, 1);
    const nH = armN ? [armN[0], armN[1] + (A.br ? gy : 0)] : [36 + wF, gy - 2 + Math.min(0, Math.cos(walk) * 5 * walkA)];
    limb(20, -56, nH[0], nH[1], 16, 11, false, true, -1);
    if (anim === 'attack' && at < 0.25) {
      const pc = g.globalCompositeOperation;
      g.globalCompositeOperation = 'lighter';
      g.strokeStyle = rgba('#ff8a9a', 0.6 * (1 - at / 0.25));
      g.lineWidth = 4;
      g.beginPath();
      g.arc(20, -40, 52, -1.6, 0.6);
      g.stroke();
      g.globalCompositeOperation = pc;
    }
    if (anim === 'roar') glowE(g, 0, -50, 70, 50, red, 0.25 + 0.15 * pulse(t, 20));
    g.restore();
    g.restore();
  }

  /* ───────────── 2. 아르카 — 방어형 기계 기사 ───────────── */
  function bossArka(g, e, W, t) {
    const s = (e.r || 50) / 50;
    const fx = faceX(e);
    const A = bossAnim(e);
    const { anim, at } = A;
    const f = e.facing || 0;
    const sf = Math.sin(f);
    const yel = '#ffe066';
    const cy = '#66e0ff';
    const steel = '#3a5488';
    const steelHi = '#6286c8';
    const steelD = '#1f2d50';
    let crouch = 0;
    let lean = 0;
    let swA1 = 1.25;
    let swA2 = 0.25;
    let swW = -1.2;
    let swI = 0.8;
    let shPush = 0;
    let shLift = 0;
    let headT = 0;
    let visor = 1;
    let fFx = 12;
    let fBx = -12;
    let fFy = 0;
    let fBy = 0;
    let flow = 0.2;
    const shieldDown = !!e.shieldDown || anim === 'recover';
    if (anim === 'move') {
      const ph = t * 6 + (e.id || 0);
      fFx = 12 + Math.sin(ph) * 12;
      fBx = -12 - Math.sin(ph) * 12;
      fFy = -Math.max(0, Math.cos(ph)) * 6;
      fBy = -Math.max(0, -Math.cos(ph)) * 6;
      lean = 0.06;
      flow = 0.5;
    }
    if (A.br) {
      crouch = 26;
      lean = 0.3;
      fFx = 20;
      fBx = -18;
      swA1 = 1.1; swA2 = 0.7; swW = 0.75;
      headT = 0.4;
      visor = 0.3 + 0.4 * hash(Math.floor(t * 9));
      swI = 0.4;
    } else if (anim === 'windup') {
      const k = easeOut(clamp01(at / 0.6));
      swA1 = lerp(1.25, -1.9, k); swA2 = lerp(0.25, -2.4, k); swW = lerp(-1.2, -2.7, k);
      lean = -0.1 * k; crouch = 6 * k; swI = 0.8 + k; headT = -0.05 * k;
      shLift = 4 * k;
    } else if (anim === 'attack') {
      const k = easeOut3(clamp01(at / 0.14));
      swA1 = lerp(-1.9, 0.5, k); swA2 = lerp(-2.4, 0.4, k); swW = lerp(-2.7, 0.85, k);
      lean = lerp(-0.1, 0.16, k); crouch = 8; swI = 1.6; fFx = 22; fBx = -14;
    } else if (anim === 'dash') {
      lean = 0.24; crouch = 10; shPush = 10; swA1 = 2.2; swA2 = 2.0; swW = 2.6; fFx = 24; fBx = -22; fBy = -3; flow = 1;
    } else if (anim === 'recover') {
      lean = 0.18; crouch = 10; swA1 = 1.3; swA2 = 0.9; swW = 0.8; headT = 0.25; swI = 0.5;
      visor = 0.5 + 0.5 * pulse(t, 9);
    } else if (anim === 'cast' || anim === 'roar') {
      const k = easeOut(clamp01(at / 0.4));
      swA1 = lerp(1.25, -1.45, k); swA2 = lerp(0.25, -1.55, k); swW = lerp(-1.2, -1.6, k);
      swI = 1.4 + 0.4 * Math.sin(t * 14); headT = -0.2 * k; lean = -0.06;
      if (anim === 'roar') { shLift = -6; crouch = 4; }
    } else if (anim === 'hurt') {
      lean = -0.12;
    }
    g.save();
    g.scale(s * fx, s);
    const hipY = -62 + crouch;
    // 망토
    g.save();
    g.translate(0, hipY);
    g.rotate(lean);
    const cw = Math.sin(t * 1.6) * 3;
    fillPoly(g, [-14, -48, -22, -20, -34 - flow * 10 + cw, 30 - flow * 6, -26 - flow * 8 + cw, 44, -18 - flow * 6 + cw, 38, -10 - flow * 4, 48, -2, 36, 4, -44], '#141c34');
    neonPath(g, [-34 - flow * 10 + cw, 30 - flow * 6, -26 - flow * 8 + cw, 44, -18 - flow * 6 + cw, 38, -10 - flow * 4, 48], cy, 0.8, 0.35);
    g.restore();
    const drawShield = () => {
      g.save();
      if (shieldDown) {
        g.translate(38, -30);
        g.rotate(0.55);
      } else {
        g.translate(30 + 10 * (1 - Math.abs(sf)) + shPush, -64 - shLift + sf * 6 + crouch * 0.6);
        g.rotate(lean * 0.6);
      }
      const hw = (shieldDown ? 18 : 7 + 19 * Math.abs(sf)) ;
      const pts = [-hw, -46, 0, -52, hw, -46, hw, 36, 0, 50, -hw, 36];
      if (!shieldDown && sf < -0.25) {
        fillPoly(g, pts, '#141c30');
      } else {
        fillPoly(g, pts, steelD, steelHi, 2);
        fillPoly(g, [-hw * 0.78, -40, 0, -45, hw * 0.78, -40, hw * 0.78, 32, 0, 43, -hw * 0.78, 32], steel);
        fillPoly(g, [-hw * 0.78, -40, 0, -45, 0, 43, -hw * 0.78, 32], '#2f4676');
        neonPath(g, [0, -36, 0, 36], cy, 1.4, 0.7);
        neonPath(g, [-hw * 0.5, -6, 0, -14, hw * 0.5, -6, 0, 8], cy, 1.1, 0.85, true);
        glow(g, 0, -4, 12, cy, 0.5 + 0.2 * pulse(t, 3));
      }
      g.restore();
    };
    if (sf < -0.25 && !shieldDown) drawShield();
    // 먼 팔 + 검
    g.save();
    g.translate(0, hipY);
    g.rotate(lean);
    const sx = -15;
    const sy = -44;
    const ex = sx + Math.cos(swA1) * 20;
    const ey = sy + Math.sin(swA1) * 20;
    const hx = ex + Math.cos(swA2) * 19;
    const hy = ey + Math.sin(swA2) * 19;
    taper(g, sx, sy, ex, ey, 11, 9, '#2a3c66');
    taper(g, ex, ey, hx, hy, 9, 8, '#22325a');
    fillCirc(g, ex, ey, 5, '#3a5488');
    g.save();
    g.translate(hx, hy);
    g.rotate(swW);
    g.fillStyle = '#141a2c';
    g.fillRect(-9, -2, 10, 4);
    fillPoly(g, [0, -8, 4, -6, 4, 6, 0, 8], '#c8b25a');
    energyBlade(g, 4, 80, 2.6, yel, swI);
    glow(g, 50, 0, 14 + swI * 6, yel, 0.25 * swI);
    g.restore();
    fillCirc(g, hx, hy, 4.5, '#2a3c66');
    g.restore();
    // 다리
    const leg = (hx2, fx2, fy2, far) => {
      const k = ik(hx2, hipY, fx2, fy2, 31, 33, 1);
      taper(g, hx2, hipY, k.kx, k.ky, 15, 12, far ? '#1e2a4a' : '#33497a');
      taper(g, k.kx, k.ky, fx2, fy2 - 4, 12, 10, far ? '#18223c' : '#2b3f6a');
      fillPoly(g, [fx2 - 7, fy2 - 8, fx2 + 10, fy2 - 5, fx2 + 13, fy2, fx2 - 8, fy2], far ? '#141c30' : '#22325a');
      fillCirc(g, k.kx + 1, k.ky, 6.5, far ? '#26365e' : steelHi);
      if (!far) neon(g, k.kx - 3, k.ky + 8, k.kx + 1, fy2 - 10, cy, 0.8, 0.5);
    };
    leg(-8, fBx, fBy, true);
    leg(8, fFx, fFy, false);
    // 몸통
    g.save();
    g.translate(0, hipY);
    g.rotate(lean);
    fillPoly(g, [-18, -6, 18, -6, 22, 10, 10, 14, 0, 8, -10, 14, -22, 10], '#22325a');
    neonPath(g, [-22, 10, -10, 14, 0, 8, 10, 14, 22, 10], cy, 0.7, 0.4);
    fillPoly(g, [-18, -50, 20, -50, 25, -34, 16, -4, -14, -4, -20, -32], steel);
    fillPoly(g, [-18, -50, 2, -50, 0, -4, -14, -4, -20, -32], '#2c4270');
    fillPoly(g, [4, -48, 20, -48, 24, -34, 12, -22, 4, -30], steelHi);
    fillCirc(g, 6, -30, 7, '#0e1628');
    fillCirc(g, 6, -30, 4.2, cy);
    glow(g, 6, -30, 16, cy, 0.65 + 0.25 * pulse(t, 3), true);
    neonPath(g, [-16, -6, -6, -14, 6, -16, 16, -6], cy, 0.7, 0.5);
    // 어깨 보호대
    fillEll(g, -16, -48, 13, 9, -0.3, '#2a3c66');
    fillEll(g, 20, -48, 14, 9.5, 0.3, steelHi);
    fillEll(g, 21, -44, 12, 6, 0.3, steel);
    fillPoly(g, [14, -55, 22, -68, 26, -54], '#4a68a8');
    neon(g, 10, -42, 32, -46, cy, 0.7, 0.5);
    // 투구
    g.save();
    g.translate(3, -56);
    g.rotate(headT);
    fillPoly(g, [-9, -2, -10, -16, -2, -25, 9, -23, 14, -14, 13, -2, 4, 2], '#2c4270');
    fillPoly(g, [-2, -25, 9, -23, 14, -14, 4, -14], steelHi);
    fillPoly(g, [-4, -22, -26, -36, -10, -16], '#3a5488');
    fillPoly(g, [0, -24, -12, -44, -2, -20], '#4a68a8');
    neon(g, -4, -22, -24, -35, cy, 0.7, 0.6);
    fillPoly(g, [3, -14, 14.5, -13, 14, -9.5, 3, -10], '#0a0e18');
    neon(g, 4, -11.8, 13.6, -11.4, yel, 1.6, visor);
    glow(g, 10, -11.6, 9, yel, 0.6 * visor, true);
    g.restore();
    // 방패 팔 (가까운 팔, 방패 뒤)
    taper(g, 20, -44, 32, -24, 11, 9, '#2f4676');
    g.restore();
    if (sf >= -0.25 || shieldDown) drawShield();
    if (anim === 'dash') {
      const pc = g.globalCompositeOperation;
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 4; i++) seg(g, -40 - i * 6, -110 + i * 26, -80 - i * 10, -110 + i * 26, 2, rgba(cy, 0.35));
      g.globalCompositeOperation = pc;
    }
    g.restore();
    // 등 약점
    if (A.ex || (W && W.scan > 0)) weakGlow(g, -fx * 14 * s, -98 * s, 7 * s, '#7cf7ff', e, W, t, 0.4);
  }

  /* ───────────── 3. 옵저버 — 감시 시스템 ───────────── */
  function bossObserver(g, e, W, t) {
    const s = (e.r || 52) / 52;
    const fx = faceX(e);
    const A = bossAnim(e);
    const { anim, at } = A;
    const f = e.facing || 0;
    const cy = '#66e0ff';
    const ora = '#ff8a3d';
    let tilt = Math.sin(t * 0.9) * 0.05;
    let dy = Math.sin(t * 1.6) * 3;
    let spin = 0.6;
    let charge = 0;
    let open = 0.45;
    let alpha = 1;
    if (A.ex) { open = 1; tilt = 0.12 + Math.sin(t * 5) * 0.03; dy += 6; spin = 0.2; }
    if (anim === 'charge') { charge = clamp01(at / 1.4); spin = 0.6 + charge * 4; open = 0.6 + charge * 0.3; }
    else if (anim === 'cast') { spin = 2.4; }
    else if (anim === 'fade') alpha = 1 - clamp01(at / 0.4);
    if (A.br) { tilt = 0.38; dy = 16; spin = 0.1; open = 0.8; }
    const pa = g.globalAlpha;
    g.globalAlpha = pa * alpha;
    g.save();
    g.scale(s * fx, s);
    if (anim === 'fade') {
      g.scale(1 - (1 - alpha) * 0.5, 1 + (1 - alpha) * 0.8);
    }
    g.translate(0, dy);
    const C = -60;
    // 늘어진 케이블
    g.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
      const bx = -22 + i * 11;
      const sw = Math.sin(t * 1.3 + i * 1.7) * 6;
      g.strokeStyle = i % 2 ? '#1c2436' : '#283248';
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(bx, C + 30);
      g.quadraticCurveTo(bx + sw, C + 48, bx + sw * 1.6, -2 - (i % 2) * 6 - dy * 0.5);
      g.stroke();
      fillCirc(g, bx + sw * 1.6, -2 - (i % 2) * 6 - dy * 0.5, 1.6, cy);
      glow(g, bx + sw * 1.6, -2 - (i % 2) * 6 - dy * 0.5, 4, cy, 0.6);
    }
    g.save();
    g.translate(0, C);
    g.rotate(tilt);
    // 고리 (뒤쪽 절반)
    const ring = (rx, ry, rot, sp, front) => {
      g.save();
      g.rotate(rot);
      g.strokeStyle = front ? '#4a5a7e' : '#2a3450';
      g.lineWidth = 4;
      g.beginPath();
      g.ellipse(0, 0, rx, ry, 0, front ? 0 : PI, front ? PI : TAU);
      g.stroke();
      const pc = g.globalCompositeOperation;
      g.globalCompositeOperation = 'lighter';
      g.strokeStyle = rgba(cy, front ? 0.55 : 0.25);
      g.lineWidth = 1;
      g.stroke();
      g.globalCompositeOperation = pc;
      for (let i = 0; i < 6; i++) {
        const a = ((t * sp + i / 6) % 1) * TAU;
        const isFront = Math.sin(a) > 0;
        if (isFront !== front) continue;
        const x = Math.cos(a) * rx;
        const y = Math.sin(a) * ry;
        fillPoly(g, [x - 3.5, y - 2, x + 3.5, y - 2, x + 2.5, y + 2, x - 2.5, y + 2], front ? '#5a6c94' : '#2e3a58');
        glow(g, x, y, 4, i % 3 === 0 ? ora : cy, front ? 0.8 : 0.35);
      }
      g.restore();
    };
    ring(68, 17, 0.22, spin * 0.25, false);
    ring(58, 28, -0.5, -spin * 0.18, false);
    // 옆 포드
    const pod = (x, y, glint, far) => {
      fillPoly(g, [x - 12, y - 14, x + 8, y - 16, x + 13, y - 2, x + 9, y + 13, x - 10, y + 12, x - 14, y], far ? '#1a2234' : '#2a3450');
      fillPoly(g, [x - 12, y - 14, x + 8, y - 16, x + 13, y - 2, x - 6, y - 4], far ? '#24304a' : '#3c4a6e');
      fillCirc(g, x, y + 2, 3, glint);
      glow(g, x, y + 2, 9, glint, far ? 0.4 : 0.85, true);
    };
    pod(-44, 2, ora, true);
    // 안테나
    seg(g, -2, -38, 4, -62, 2.4, '#3a4766');
    fillCirc(g, 4, -62, 2.2, cy);
    glow(g, 4, -62, 9, cy, 0.6 + 0.4 * pulse(t, 7));
    if (anim === 'cast' || charge > 0.5) {
      neonPath(g, [4, -62, 9, -72, 3, -80, 10, -92], '#bfefff', 0.8, 0.5 + 0.5 * hash(Math.floor(t * 20)));
    }
    // 구체 몸체
    fillCirc(g, 0, 0, 41, '#151c2e');
    fillCirc(g, -3, -3, 37, '#1f2840');
    g.beginPath();
    g.arc(-4, -4, 34, PI * 1.02, PI * 1.62);
    g.strokeStyle = 'rgba(160,190,240,0.35)';
    g.lineWidth = 3;
    g.stroke();
    // 장갑 판 이음매
    g.strokeStyle = '#0c1220';
    g.lineWidth = 1.6;
    g.beginPath();
    g.arc(0, 0, 41, -0.9, 0.9);
    g.moveTo(-36, -20);
    g.quadraticCurveTo(-10, -12, -6, -40);
    g.moveTo(-38, 16);
    g.quadraticCurveTo(-12, 12, -4, 40);
    g.stroke();
    neonPath(g, [-36, -20, -22, -16, -12, -24], cy, 0.6, 0.5);
    neonPath(g, [-38, 16, -24, 14, -14, 22], cy, 0.6, 0.5);
    // 렌즈 (바라보는 방향으로)
    const lx = 10 + 9 * Math.abs(Math.cos(f));
    const ly = Math.sin(f) * 9 - 2;
    const lr = (A.ex ? 21 : 17) * (Math.sin(f) < -0.7 ? 0.75 : 1);
    const lsx = 0.7 + 0.3 * Math.abs(Math.sin(f)) + (A.ex ? 0.1 : 0);
    g.save();
    g.translate(lx, ly);
    g.scale(lsx, 1);
    fillCirc(g, 0, 0, lr + 6, '#0b101c');
    fillCirc(g, 0, 0, lr + 3, '#3a4766');
    const p = pulse(t, A.ex ? 9 : 2);
    const iris = A.ex ? (p > 0.5 ? '#ff5470' : cy) : cy;
    fillCirc(g, 0, 0, lr, '#06101c');
    fillCirc(g, 0, 0, lr * 0.8, mix('#0a2a40', iris, 0.55));
    fillCirc(g, 0, 0, lr * 0.5, iris);
    fillCirc(g, 0, 0, lr * 0.22, '#ffffff');
    fillCirc(g, -lr * 0.35, -lr * 0.35, lr * 0.14, 'rgba(255,255,255,0.8)');
    // 눈꺼풀 셔터
    if (open < 1) {
      const c = lr + 4;
      const top = -c + (1 - open) * c * 1.1;
      fillPoly(g, [-c - 2, -c - 2, c + 2, -c - 2, c + 2, top, 0, top + 4, -c - 2, top], '#2a3450');
      seg(g, -c, top, c, top, 1.5, '#4a5a7e');
      const bot = c - (1 - open) * c * 0.7;
      fillPoly(g, [-c - 2, c + 2, c + 2, c + 2, c + 2, bot, 0, bot - 3, -c - 2, bot], '#222b42');
    }
    g.restore();
    glow(g, lx, ly, lr * (1.8 + charge * 2.5), A.ex ? (p > 0.5 ? '#ff5470' : cy) : cy, 0.45 + charge * 0.55, charge > 0.3);
    if (A.ex) weakGlow(g, lx, ly, lr * 0.6, p > 0.5 ? '#ff5470' : '#7cf7ff', e, W, t);
    if (charge > 0) {
      // 렌즈로 모이는 빛 알갱이
      const pc = g.globalCompositeOperation;
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 10; i++) {
        const u = (t * 1.5 + i / 10) % 1;
        const a = hash(i * 4.1) * TAU;
        const d = (1 - u) * 70;
        g.fillStyle = rgba(cy, u * charge);
        g.fillRect(lx + Math.cos(a) * d - 1, ly + Math.sin(a) * d - 1, 2.2, 2.2);
      }
      g.globalCompositeOperation = pc;
    }
    pod(44, -4, cy, false);
    ring(68, 17, 0.22, spin * 0.25, true);
    ring(58, 28, -0.5, -spin * 0.18, true);
    g.restore();
    g.restore();
    g.globalAlpha = pa;
    if (anim === 'fade') {
      glowE(g, 0, -60 * s, 30 * s, 70 * s, cy, 0.5 * (1 - alpha));
    }
  }

  /* ───────────── 5. 아틀라스 — 거대 전투 병기 ───────────── */
  const ATLAS_LIGHTS = [-40, -210, -28, -170, 38, -214, 50, -168, -52, -190, 30, -150, -18, -146, 60, -196, -60, -160];
  function bossAtlas(g, e, W, t) {
    const s = (e.r || 92) / 92;
    const fx = faceX(e);
    const A = bossAnim(e);
    const { anim, at } = A;
    const blue = '#5fb8ff';
    const hot = '#ff8a3d';
    const armSide = e.parts && e.parts.arm ? e.parts.arm : 0;
    let drop = 0;
    let lean = 0;
    let headUp = 0;
    let podOpen = 0;
    let eyeI = 0.8;
    let coreI = 0.35;
    let walk = 0;
    // 팔 끝(주먹) 위치: [팔꿈치x, 팔꿈치y, 주먹x, 주먹y]
    let armN = [88, -168, 92, -110];
    let armF = [-86, -166, -90, -108];
    const sway = Math.sin(t * 1.4) * 2;
    armN[3] += sway;
    armF[3] -= sway;
    if (anim === 'move') walk = t * 4 + (e.id || 0);
    if (A.br) {
      drop = 36;
      lean = 0.1;
      armN = [90, -120, 96, -46];
      armF = [-88, -118, -92, -44];
      eyeI = 0.2 + 0.4 * hash(Math.floor(t * 8));
      coreI = 0.3;
    } else if (anim === 'windup') {
      const k = easeOut(clamp01(at / 0.6));
      if (armSide === 0) {
        drop = 10 * k;
        armN = [lerp(88, 96, k), lerp(-168, -200, k), lerp(92, 100, k), lerp(-110, -190, k)];
        armF = [lerp(-86, -94, k), lerp(-166, -198, k), lerp(-90, -98, k), lerp(-108, -188, k)];
      } else {
        const up = [84, -270, 56, -318];
        const tgt = armSide > 0 ? armN : armF;
        const sg = armSide > 0 ? 1 : -1;
        const r = [lerp(tgt[0], up[0] * sg, k), lerp(tgt[1], up[1], k), lerp(tgt[2], up[2] * sg, k), lerp(tgt[3], up[3], k)];
        if (armSide > 0) armN = r; else armF = r;
        lean = -0.04 * k;
      }
      eyeI = 0.8 + k;
    } else if (anim === 'slam') {
      const k = easeOut3(clamp01(at / 0.12));
      if (armSide === 0) {
        drop = 14;
        armN = [96, -150, 100, -60];
        armF = [-94, -148, -98, -58];
      } else {
        const sg = armSide > 0 ? 1 : -1;
        const r = [lerp(84 * sg, 92 * sg, k), lerp(-270, -138, k), lerp(56 * sg, 100 * sg, k), lerp(-318, -14, k)];
        if (armSide > 0) armN = r; else armF = r;
        drop = 12 * k;
        lean = 0.05 * sg;
      }
      eyeI = 1.5;
    } else if (anim === 'cast') {
      podOpen = clamp01(at / 0.3);
      headUp = -0.08;
      eyeI = 1.2;
    } else if (anim === 'charge') {
      const k = clamp01(at / 1.0);
      eyeI = 1 + 2 * k;
      coreI = 0.5 + k * 0.5;
      drop = 6;
    } else if (anim === 'roar') {
      armN = [104, -250, 96, -300];
      armF = [-102, -248, -94, -298];
      headUp = -0.15;
      eyeI = 2;
      podOpen = 0.5;
    }
    // 팔이 땅에 박힌 채(노출) 유지
    if (A.ex && armSide !== 0 && anim !== 'windup') {
      const sg = armSide > 0 ? 1 : -1;
      const r = [92 * sg, -138, 100 * sg, -14];
      if (armSide > 0) armN = r; else armF = r;
      drop = Math.max(drop, 12);
    }
    if (A.ex) coreI = 1;
    g.save();
    g.scale(s * fx, s);
    const hipY = -118 + drop;
    const lift = (ph) => Math.max(0, Math.sin(ph)) * 10;
    // 다리
    const leg = (hx, fx2, ph, far) => {
      const fy = -lift(ph);
      const fxx = fx2 + (walk ? Math.cos(ph) * 10 : 0);
      const k = ik(hx, hipY, fxx, fy, 62, 64, 1);
      const c1 = far ? '#141e36' : '#24365e';
      const c2 = far ? '#101a2e' : '#1c2c4e';
      taper(g, hx, hipY, k.kx, k.ky, 34, 28, c1);
      taper(g, k.kx, k.ky, fxx, fy - 8, 28, 30, c2);
      fillPoly(g, [fxx - 20, fy - 14, fxx + 22, fy - 14, fxx + 26, fy, fxx - 22, fy], far ? '#0e1628' : '#2a4070');
      fillPoly(g, [k.kx - 12, k.ky - 12, k.kx + 13, k.ky - 10, k.kx + 11, k.ky + 12, k.kx - 10, k.ky + 10], far ? '#1a2846' : '#3f5f9a');
      if (!far) {
        fillCirc(g, k.kx, k.ky + 22, 2.6, blue);
        glow(g, k.kx, k.ky + 22, 8, blue, 0.7);
        neon(g, fxx - 14, fy - 10, fxx + 16, fy - 10, blue, 1.2, 0.5);
      }
    };
    const legPh = walk;
    leg(-22, -32, legPh + PI, true);
    // 먼 팔
    const arm = (sx, sy, el, far) => {
      const c = far ? '#16223c' : '#2c4272';
      taper(g, sx, sy, el[0], el[1], 30, 26, c);
      taper(g, el[0], el[1], el[2], el[3], 28, 30, far ? '#121c32' : '#24365e');
      fillCirc(g, el[0], el[1], 15, far ? '#1c2a48' : '#3a5488');
      // 주먹
      const a = Math.atan2(el[3] - el[1], el[2] - el[0]);
      g.save();
      g.translate(el[2], el[3]);
      g.rotate(a - HALF);
      g.scale(1.3, 1.3);
      fillPoly(g, [-20, -6, 20, -6, 23, 22, 14, 30, -14, 30, -23, 22], far ? '#1a2846' : '#355088');
      fillPoly(g, [-20, -6, 20, -6, 21, 6, -21, 6], far ? '#141e36' : '#2a4070');
      for (let i = 0; i < 4; i++) seg(g, -14 + i * 9.5, 18, -14 + i * 9.5, 29, 1.6, '#0e1628');
      if (!far) neon(g, -16, 8, 16, 8, blue, 1.4, 0.6);
      g.restore();
    };
    arm(-70, -222 + drop, [armF[0], armF[1] + drop, armF[2], armF[3] + (armF[3] > -40 ? 0 : drop)], true);
    // 등의 배기구
    fillPoly(g, [-40, -240 + drop, -30, -284 + drop, -18, -240 + drop], '#121a30');
    fillPoly(g, [26, -240 + drop, 36, -286 + drop, 48, -240 + drop], '#16203a');
    glow(g, -30, -282 + drop, 8, blue, 0.5);
    glow(g, 36, -284 + drop, 8, blue, 0.5);
    leg(22, 34, legPh, false);
    // 허리
    g.save();
    g.translate(0, hipY);
    g.rotate(lean);
    fillPoly(g, [-36, -22, 38, -22, 42, 6, 24, 16, -22, 16, -40, 6], '#18243e');
    fillPoly(g, [-30, 4, -8, 4, -10, 26, -28, 20], '#22325a');
    fillPoly(g, [8, 4, 30, 4, 28, 20, 10, 26], '#2c4272');
    // 몸통 (허리 기준 좌표)
    const T = 0;
    fillPoly(g, [-66, T - 118, 70, T - 118, 80, T - 94, 56, T - 32, 40, T - 18, -38, T - 18, -54, T - 32, -76, T - 94], '#1b2846');
    fillPoly(g, [-66, T - 118, 0, T - 118, -4, T - 18, -38, T - 18, -54, T - 32, -76, T - 94], '#16223c');
    fillPoly(g, [-56, T - 110, -6, T - 112, -10, T - 74, -44, T - 66, -62, T - 90], '#24365e');
    fillPoly(g, [14, T - 112, 62, T - 110, 70, T - 90, 50, T - 66, 18, T - 74], '#3a5488');
    fillPoly(g, [-30, T - 60, 34, T - 60, 30, T - 26, -26, T - 26], '#1f2f52');
    for (let i = 0; i < 3; i++) seg(g, -24, T - 52 + i * 9, 28, T - 52 + i * 9, 1.4, '#0e1628');
    for (let i = 0; i < ATLAS_LIGHTS.length; i += 2) {
      const lx = ATLAS_LIGHTS[i];
      const ly = ATLAS_LIGHTS[i + 1] + drop * 0 + (T + 118);
      const fl = A.br ? hash(i + Math.floor(t * 9)) : 0.6 + 0.4 * Math.sin(t * 2 + i);
      g.fillStyle = blue;
      g.fillRect(lx - 2.5, ly - 1.2, 5, 2.4);
      glow(g, lx, ly, 6, blue, 0.5 * fl);
    }
    // 가슴 코어
    const cx = 6;
    const ccy = T - 70;
    fillCirc(g, cx, ccy, 22, '#0c1222');
    fillCirc(g, cx, ccy, 17, '#2a3a5e');
    const coreCol = A.ex ? hot : '#3a8cff';
    fillCirc(g, cx, ccy, 12, A.ex ? '#ffd2a0' : mix('#1a3a7a', '#5fb8ff', coreI));
    glow(g, cx, ccy, 18 + coreI * 16, coreCol, 0.3 + coreI * 0.5, coreI > 0.6);
    if (A.ex || (W && W.scan > 0)) weakGlow(g, cx, ccy, 12, A.ex ? hot : '#7cf7ff', e, W, t);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + t * 0.5;
      seg(g, cx + Math.cos(a) * 14, ccy + Math.sin(a) * 14, cx + Math.cos(a) * 20, ccy + Math.sin(a) * 20, 2, '#0c1222');
    }
    // 어깨 + 미사일 포드
    const pod = (x, far) => {
      const y = T - 132;
      fillPoly(g, [x - 22, y - 14, x + 22, y - 14, x + 24, y + 14, x - 24, y + 14], far ? '#16223c' : '#2c4272');
      fillPoly(g, [x - 22, y - 14 - podOpen * 10, x + 22, y - 14 - podOpen * 14, x + 22, y - 10, x - 22, y - 10], far ? '#1c2a48' : '#3f5f9a');
      for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 3; c++) {
          const px = x - 13 + c * 13;
          const py = y - 3 + r * 10;
          fillCirc(g, px, py, 3.6, '#0a0f1c');
          if (podOpen > 0) {
            const on = hash(c + r * 3 + Math.floor(t * 12) + (far ? 7 : 0)) > 0.4;
            fillCirc(g, px, py, 2.2, on ? '#ffd28a' : hot);
            if (on) glow(g, px, py, 9, hot, 0.8 * podOpen, true);
          }
        }
      }
    };
    pod(-58, true);
    pod(62, false);
    fillEll(g, -66, T - 104, 22, 16, -0.3, '#1c2a48');
    fillEll(g, 72, T - 104, 22, 16, 0.3, '#3a5488');
    neon(g, 56, T - 98, 88, T - 106, blue, 1.2, 0.5);
    // 머리
    g.save();
    g.translate(6, T - 130);
    g.rotate(headUp);
    fillPoly(g, [-16, 6, -18, -14, -8, -24, 12, -24, 20, -14, 18, 6], '#24365e');
    fillPoly(g, [-8, -24, 12, -24, 20, -14, 0, -14], '#3f5f9a');
    fillPoly(g, [-12, -12, 18, -12, 17, -5, -11, -5], '#060a14');
    neon(g, -9, -8.5, 15, -8.5, anim === 'charge' ? '#bff0ff' : blue, 2.4, Math.min(1, eyeI));
    glow(g, 4, -8.5, 14 + eyeI * 8, blue, 0.4 + 0.2 * eyeI, eyeI > 1.5);
    seg(g, -14, -18, -22, -36, 2, '#3a5488');
    seg(g, 16, -18, 24, -38, 2, '#3a5488');
    fillCirc(g, 24, -38, 2, blue);
    g.restore();
    g.restore();
    // 가까운 팔
    arm(72, -222 + drop, [armN[0], armN[1] + drop, armN[2], armN[3] + (armN[3] > -40 ? 0 : drop)], false);
    // 땅을 내려친 충격
    if ((anim === 'slam' || (A.ex && armSide !== 0)) && armSide !== 0) {
      const sg = armSide > 0 ? 1 : -1;
      const gx = 100 * sg;
      const k = anim === 'slam' ? clamp01(at / 0.6) : 1;
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * PI + 0.2;
        const L = 30 + 40 * hash(i * 2.1);
        neon(g, gx, 4, gx + Math.cos(a) * L * (0.5 + k * 0.5), 4 + Math.sin(a) * L * 0.4, hot, 1.4, 0.8 - 0.3 * k);
      }
      if (anim === 'slam') glowE(g, gx, 0, 60 * k + 20, 18 * k + 6, '#ffd2a0', 0.7 * (1 - k));
    } else if (anim === 'slam' && armSide === 0) {
      const k = clamp01(at / 0.5);
      glowE(g, 0, 0, 120 * k + 20, 36 * k + 6, '#bfe4ff', 0.6 * (1 - k));
    }
    if (anim === 'charge') {
      const k = clamp01(at / 1.0);
      glow(g, 6, -258 + drop, 30 + 30 * k, '#bff0ff', 0.5 * k, true);
    }
    g.restore();
  }

  /* ───────────── 6. 세라 — 기억 조작 병기 ───────────── */
  function memoryOrbs(g, t, sc, fast, front, bob) {
    const n = 4;
    for (let i = 0; i < n; i++) {
      const a = t * (fast ? 2.4 : 0.9) + (i / n) * TAU;
      const sn = Math.sin(a);
      if ((sn >= 0) !== front) continue;
      const x = Math.cos(a) * 25 * sc;
      const y = (-31 + sn * 8) * sc + bob;
      const r = (fast ? 4.2 : 3.4) * sc * (0.85 + 0.15 * sn);
      glow(g, x, y, r * 3.2, '#ff7ad9', front ? 0.75 : 0.45, true);
      fillCirc(g, x, y, r * 0.55, front ? '#ffe0f6' : '#d890c8');
    }
  }
  function bossSera(g, e, W, t) {
    const sc = ((e.r || 30) * 3.3) / 60;
    const A = bossAnim(e);
    const fade = A.anim === 'fade' ? clamp01(A.at / 0.35) : 0;
    const cast = A.anim === 'cast';
    const pa = g.globalAlpha;
    g.globalAlpha = pa * (1 - fade * 0.85);
    const bob = Math.sin(t * 1.8 + (e.id || 0)) * 1.5 * sc;
    glowE(g, 0, -34 * sc, 30 * sc, 44 * sc, '#b07cff', 0.2 + (cast ? 0.18 : 0));
    memoryOrbs(g, t, sc, cast, false, bob);
    dataRibbons(g, t, '#c9a4ff', '#ff7ad9', sc, 6, cast ? 1 : 0.7);
    if (fade > 0) {
      // 사라지는 글리치
      for (let i = 0; i < 3; i++) {
        g.save();
        g.beginPath();
        g.rect(-50 * sc, (-70 + i * 24) * sc, 100 * sc, 24 * sc);
        g.clip();
        g.translate((hash(Math.floor(t * 20) + i) - 0.5) * 16 * sc * fade, 0);
        drawSeraFigure(g, e, W, t, SERA, sc, { broken: A.br });
        g.restore();
      }
    } else {
      drawSeraFigure(g, e, W, t, SERA, sc, { broken: A.br });
    }
    memoryOrbs(g, t, sc, cast, true, bob);
    g.globalAlpha = pa;
    if (A.ex || (W && W.scan > 0)) weakGlow(g, -faceX(e) * 3 * sc, -38 * sc + bob, 5 * sc, '#ff7ad9', e, W, t, 0.4);
  }

  /* ───────────── 7. 드라코 — 기계 드래곤 ───────────── */
  function bossDraco(g, e, W, t) {
    const s = (e.r || 62) / 62;
    const fx = faceX(e);
    const A = bossAnim(e);
    const { anim, at } = A;
    const air = !!e.airborne && !A.br;
    const red = '#ff3b4f';
    const ora = '#ffb04d';
    const black = '#1a0f14';
    const crim = '#7a1626';
    let flap = Math.sin(t * 6.5);
    let spread = 1;
    let jaw = 0.06;
    let throat = 0.35;
    let tilt = air ? Math.sin(t * 1.2) * 0.04 : 0;
    let tailSwing = 0;
    let headUp = 0;
    let stretch = 1;
    let eye = 0.9;
    if (anim === 'windup') { const k = clamp01(at / 0.6); tilt = -0.14 * k; flap = lerp(flap, -1, k); throat = 0.5 + k * 0.3; headUp = -0.25 * k; eye = 1.6; }
    else if (anim === 'dash') { tilt = air ? 0.26 : 0.1; spread = 0.5; flap = 0.3; stretch = 1.12; eye = 1.8; }
    else if (anim === 'cast') { jaw = 0.6; throat = 1 + 0.2 * Math.sin(t * 20); headUp = 0.1; flap = Math.sin(t * 4); eye = 1.6; }
    else if (anim === 'attack') { tailSwing = Math.sin(clamp01(at / 0.5) * PI); jaw = 0.3; eye = 1.5; }
    else if (anim === 'roar') { jaw = 0.75; headUp = -0.45; spread = 1.1; flap = -0.7 + Math.sin(t * 14) * 0.1; throat = 0.8; eye = 2; }
    if (A.br) { tilt = 0.12; headUp = 0.5; jaw = 0.3; eye = 0.3 + 0.4 * hash(Math.floor(t * 9)); throat = 0.2; }
    g.save();
    g.scale(s * fx, s);
    const by = air ? -40 + Math.sin(t * 6.5 + 0.8) * 2.5 : A.br ? -22 : -36;
    g.translate(0, by);
    g.rotate(tilt);
    g.scale(stretch, 1);

    const wing = (near) => {
      const sg = near ? 1 : -1;
      if (air) {
        const sp = spread;
        const fl = flap * sg * -1;
        const rx = near ? 2 : 0;
        const ry = near ? 0 : -12;
        const P = (x, y) => [rx + x * (1 + (1 - sp) * 0.5), ry + y * sp];
        const wr = P(-12, sg * (38 + 12 * fl));
        const t1 = P(-60, sg * (62 + 16 * fl));
        const t2 = P(-82, sg * (38 + 10 * fl));
        const t3 = P(-86, sg * (14 + 5 * fl));
        const t4 = P(-64, sg * 2);
        const pts = [rx, ry, wr[0], wr[1], t1[0], t1[1], (t1[0] + t2[0]) / 2 + 6, (t1[1] + t2[1]) / 2 - sg * 6, t2[0], t2[1],
          (t2[0] + t3[0]) / 2 + 6, (t2[1] + t3[1]) / 2 - sg * 5, t3[0], t3[1], (t3[0] + t4[0]) / 2 + 5, (t3[1] + t4[1]) / 2 - sg * 4, t4[0], t4[1], -26, ry + sg * 4];
        fillPoly(g, pts, near ? 'rgba(120,16,36,0.92)' : 'rgba(80,10,26,0.92)');
        const pc = g.globalCompositeOperation;
        g.globalCompositeOperation = 'lighter';
        g.fillStyle = rgba(red, near ? 0.12 : 0.07);
        g.fill();
        g.globalCompositeOperation = pc;
        g.lineCap = 'round';
        seg(g, rx, ry, wr[0], wr[1], 4.5, black);
        for (const tp of [t1, t2, t3, t4]) seg(g, wr[0], wr[1], tp[0], tp[1], 2.2, black);
        neonPath(g, [rx, ry, wr[0], wr[1], t1[0], t1[1]], red, 1.1, near ? 0.9 : 0.55);
        neonPath(g, [t1[0], t1[1], (t1[0] + t2[0]) / 2 + 6, (t1[1] + t2[1]) / 2 - sg * 6, t2[0], t2[1], (t2[0] + t3[0]) / 2 + 6, (t2[1] + t3[1]) / 2 - sg * 5, t3[0], t3[1]], red, 0.7, near ? 0.6 : 0.35);
        // 앞날의 가시
        for (let i = 1; i <= 3; i++) {
          const u = i / 4;
          const x = lerp(wr[0], t1[0], u);
          const y = lerp(wr[1], t1[1], u);
          fillPoly(g, [x - 2, y, x + 4, y + sg * 9, x + 3, y - 1], near ? '#c42a40' : '#7a1626');
        }
        fillCirc(g, wr[0], wr[1], 3.2, crim);
      } else {
        // 접힌 날개
        const ox = near ? 4 : 0;
        const oy = near ? 2 : -2;
        const droop = A.br ? 16 : 0;
        const el = [ox - 12, oy - 46 + droop];
        const tip = [ox - 52, oy - 24 + droop * 0.6];
        fillPoly(g, [ox, oy - 12, el[0], el[1], tip[0], tip[1], ox - 40, oy - 10, ox - 22, oy - 8], near ? 'rgba(110,14,32,0.95)' : 'rgba(70,10,24,0.95)');
        seg(g, ox, oy - 12, el[0], el[1], 4.5, black);
        seg(g, el[0], el[1], tip[0], tip[1], 3, black);
        seg(g, el[0], el[1], ox - 40, oy - 10, 2, black);
        neonPath(g, [ox, oy - 12, el[0], el[1], tip[0], tip[1]], red, 1, near ? 0.8 : 0.5);
        fillPoly(g, [el[0] - 2, el[1], el[0] + 2, el[1] - 12, el[0] + 3, el[1] + 1], '#c42a40');
      }
    };
    const leg = (x, y, near, front) => {
      const c = near ? '#2a161e' : '#180c12';
      if (air) {
        const k1 = front ? [x + 4, y + 8] : [x - 6, y + 10];
        const k2 = front ? [x + 12, y + 10] : [x + 4, y + 16];
        taper(g, x, y, k1[0], k1[1], 9, 6, c);
        taper(g, k1[0], k1[1], k2[0], k2[1], 6, 4, c);
        fillPoly(g, [k2[0], k2[1] - 2, k2[0] + 6, k2[1] + 1, k2[0], k2[1] + 2], '#c8b0b4');
      } else {
        const gy = -by;
        const lift = anim === 'move' ? Math.max(0, Math.sin(t * 6 + (near ? 0 : PI) + (front ? PI / 2 : 0))) * 6 : 0;
        const fx2 = x + (front ? 6 : -4);
        const k = front ? [x + 6, y + 18] : [x + 8, y + 16];
        const hk = front ? null : [x - 4, gy - 10];
        taper(g, x, y, k[0], k[1], 11, 8, c);
        if (hk) {
          taper(g, k[0], k[1], hk[0], hk[1] - lift, 8, 6, c);
          taper(g, hk[0], hk[1] - lift, fx2, gy - lift, 6, 5, c);
        } else taper(g, k[0], k[1], fx2, gy - lift, 8, 6, c);
        for (let i = 0; i < 3; i++) fillPoly(g, [fx2 - 2 + i * 3, gy - 2 - lift, fx2 + 3 + i * 3, gy - 0.5 - lift, fx2 + i * 3, gy - lift], '#c8b0b4');
        if (near) neon(g, k[0] - 2, k[1], k[0] + 2, k[1], red, 0.8, 0.7);
      }
    };
    // 먼 날개
    wing(false);
    // 꼬리
    g.save();
    g.translate(-28, -2);
    g.rotate(-tailSwing * 1.9 + (A.br ? 0.2 : 0));
    let px = 0;
    let py = 0;
    let w = 12;
    for (let i = 1; i <= 7; i++) {
      const nx = -i * 12;
      const ny = Math.sin(t * 2.6 - i * 0.7) * 2.2 * i * (air ? 1 : 0.5) + i * (air ? 0.6 : 2.6);
      const nw = 12 - i * 1.3;
      taper(g, px, py, nx, ny, w, nw, i % 2 ? '#22121a' : '#2e1620');
      if (i % 2 === 0) fillPoly(g, [nx + 2, ny - nw * 0.4, nx - 3, ny - nw * 0.4 - 6, nx - 4, ny - nw * 0.3], '#a8202f');
      px = nx;
      py = ny;
      w = nw;
    }
    fillPoly(g, [px, py - 3, px - 16, py + 2, px, py + 4], '#c42a40');
    neon(g, px, py, px - 14, py + 2, red, 1, 0.8);
    g.restore();
    leg(-16, 6, false, false);
    leg(14, 8, false, true);
    // 몸통
    fillPoly(g, [26, -6, 10, -16, -10, -17, -28, -8, -31, 2, -10, 11, 12, 11, 27, 4], black);
    fillPoly(g, [10, -16, -10, -17, -26, -9, -6, -10, 12, -10], crim);
    fillPoly(g, [-10, 11, 12, 11, 20, 6, -6, 5], '#3a1a22');
    for (let i = 0; i < 5; i++) {
      const x = -22 + i * 8.5;
      fillPoly(g, [x - 2.5, -14, x - 6, -25 - (i % 2) * 4, x + 2.5, -14.5], '#a8202f');
    }
    neonPath(g, [-26, -6, -8, -8, 10, -8, 24, -4], red, 1, 0.75);
    neonPath(g, [-8, 9, 8, 9, 22, 4], ora, 0.8, 0.5 * throat + 0.2);
    // 등 약점
    if (A.ex || (W && W.scan > 0)) weakGlow(g, -6, -14, 5, '#ffa040', e, W, t, 0.5);
    // 목 + 머리
    const hx = 46 + (anim === 'cast' ? 6 : 0);
    const hy = air ? -24 : -38;
    const n1 = [34, air ? -12 : -18];
    taper(g, 20, -4, n1[0], n1[1], 15, 11, black);
    taper(g, n1[0], n1[1], hx, hy, 11, 9, '#22121a');
    fillPoly(g, [26, -10, 24, -20, 30, -11], '#a8202f');
    fillPoly(g, [36, n1[1] - 5, 36, n1[1] - 15, 41, n1[1] - 6], '#a8202f');
    neonPath(g, [22, 2, n1[0] + 2, n1[1] + 5, hx + 2, hy + 5], ora, 1.2, throat);
    g.save();
    g.translate(hx, hy);
    g.rotate(headUp);
    fillPoly(g, [-4, -6, 8, -8, 22, -3, 25, 1, 12, 2, -2, 3], '#2a161e');
    fillPoly(g, [-4, -6, 8, -8, 20, -4, 6, -3], crim);
    fillPoly(g, [-2, -6, -16, -18, 2, -7.5], '#3a1a22');
    fillPoly(g, [3, -7.5, -6, -23, 7, -8], '#4a1c28');
    neon(g, -2, -6, -14, -17, red, 0.7, 0.6);
    g.save();
    g.translate(0, 2);
    g.rotate(jaw);
    fillPoly(g, [0, -1, 20, 0, 22, 3, 6, 5], '#1e1016');
    for (let i = 0; i < 3; i++) fillPoly(g, [8 + i * 4, -0.5, 9.5 + i * 4, -3, 11 + i * 4, -0.5], '#e8dcd8');
    g.restore();
    for (let i = 0; i < 3; i++) fillPoly(g, [10 + i * 4, 2, 11.5 + i * 4, 4.5, 13 + i * 4, 2], '#e8dcd8');
    if (jaw > 0.25) {
      glow(g, 20, 4, 8 + throat * 12, ora, 0.5 * throat + 0.2, true);
    }
    fillCirc(g, 12, -3.2, 1.4, ora);
    glow(g, 12, -3.2, 5 + eye * 3, ora, 0.5 + eye * 0.25, true);
    g.restore();
    leg(-12, 8, true, false);
    leg(18, 9, true, true);
    // 가까운 날개
    wing(true);
    if (anim === 'dash' && air) {
      const pc = g.globalCompositeOperation;
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 4; i++) seg(g, -40 - i * 4, -20 + i * 12, -90 - i * 10, -20 + i * 12, 2, rgba(red, 0.3));
      g.globalCompositeOperation = pc;
    }
    g.restore();
  }

  /* ───────────── 8. 네메시스 — 행성 파괴 병기 ───────────── */
  function bossNemesis(g, e, W, t) {
    const s = (e.r || 86) / 86;
    const fx = faceX(e);
    const A = bossAnim(e);
    const { anim, at } = A;
    const pur = '#b04dff';
    const red = '#ff3d6e';
    const charging = e.charging > 0 || anim === 'charge';
    const ck = charging ? clamp01(at / 5.5) : 0;
    let drop = 0;
    let headUp = 0;
    let canA = 0.42;
    let clawUp = 0;
    let vent = 0.5;
    let walk = anim === 'move' ? t * 3.5 + (e.id || 0) : 0;
    const breathe = Math.sin(t * 1.5) * 2;
    if (charging) { canA = lerp(0.42, 0.08, Math.min(1, ck * 4)); drop = 8; vent = 1; }
    if (anim === 'cast') { clawUp = clamp01(at / 0.3); vent = 0.8; }
    if (anim === 'roar') { headUp = -0.2; clawUp = 1; canA = -0.4; vent = 1.2; }
    if (A.br) { drop = 30; headUp = 0.35; canA = 1.0; vent = 0.2; }
    g.save();
    g.scale(s * fx, s);
    const hipY = -106 + drop + breathe * 0.3;
    // 배기 기둥 (뒤)
    for (const vx of [-34, 30]) {
      fillPoly(g, [vx - 8, hipY - 110, vx - 4, hipY - 168, vx + 4, hipY - 168, vx + 8, hipY - 110], '#140c22');
      glow(g, vx, hipY - 168, 10 + vent * 8, pur, 0.35 + vent * 0.3);
    }
    const leg = (hx, fx2, ph, far) => {
      const fy = walk ? -Math.max(0, Math.sin(ph)) * 8 : 0;
      const fxx = fx2 + (walk ? Math.cos(ph) * 8 : 0);
      const k = ik(hx, hipY, fxx, fy, 56, 58, 1);
      taper(g, hx, hipY, k.kx, k.ky, 34, 26, far ? '#120a1e' : '#22163a');
      taper(g, k.kx, k.ky, fxx, fy - 8, 26, 22, far ? '#0e0818' : '#1c1230');
      fillPoly(g, [k.kx - 13, k.ky - 10, k.kx + 12, k.ky - 12, k.kx + 14, k.ky + 10, k.kx - 10, k.ky + 12], far ? '#1c1230' : '#3a2860');
      fillPoly(g, [fxx - 16, fy - 12, fxx + 14, fy - 12, fxx + 18, fy, fxx - 18, fy], far ? '#0e0818' : '#251840');
      for (let i = 0; i < 3; i++) fillPoly(g, [fxx + 8 + i * 0, fy - 8 + i * 4, fxx + 30 - i * 3, fy - 3 + i * 1.5, fxx + 10, fy - 4 + i * 4], far ? '#2a1e40' : '#6a5a88');
      if (!far) neon(g, k.kx - 8, k.ky + 14, k.kx - 4, fy - 14, pur, 1.2, 0.6);
    };
    leg(-22, -36, walk + PI, true);
    // 먼 팔: 집게 손
    const sxF = -68;
    const syF = hipY - 94;
    const elF = [-88, hipY - 50 - clawUp * 60];
    const haF = [-84 + clawUp * 10, hipY + 4 - clawUp * 130];
    taper(g, sxF, syF, elF[0], elF[1], 28, 24, '#170e28');
    taper(g, elF[0], elF[1], haF[0], haF[1], 24, 22, '#140c22');
    fillCirc(g, elF[0], elF[1], 13, '#22163a');
    for (let i = 0; i < 3; i++) {
      const a = HALF + (i - 1) * 0.45 - clawUp * PI;
      fillPoly(g, [haF[0] - 4, haF[1], haF[0] + Math.cos(a) * 26, haF[1] + Math.sin(a) * 26, haF[0] + 4, haF[1]], '#3a2e50');
    }
    if (clawUp > 0) glow(g, haF[0], haF[1] - 20, 20 + clawUp * 14, pur, 0.6 * clawUp, true);
    leg(24, 36, walk, false);
    // 허리 + 몸통
    g.save();
    g.translate(0, hipY);
    fillPoly(g, [-38, -20, 40, -20, 44, 6, 26, 16, -24, 16, -42, 6], '#160e26');
    const T = 0;
    fillPoly(g, [-70, T - 106, 66, T - 112, 84, T - 86, 60, T - 32, 40, T - 16, -40, T - 16, -60, T - 32, -84, T - 84], '#1a1028');
    fillPoly(g, [-70, T - 106, -2, T - 110, -6, T - 16, -40, T - 16, -60, T - 32, -84, T - 84], '#150c22');
    fillPoly(g, [-60, T - 98, -12, T - 102, -18, T - 76, -50, T - 70], '#2e1f4a');
    fillPoly(g, [12, T - 104, 60, T - 102, 72, T - 84, 42, T - 72, 16, T - 78], '#4b3478');
    fillPoly(g, [-36, T - 36, 38, T - 36, 30, T - 18, -30, T - 18], '#22163a');
    neonPath(g, [-58, T - 34, -30, T - 26, 0, T - 24, 32, T - 26, 58, T - 34], pur, 1.4, 0.7);
    neonPath(g, [-70, T - 92, -40, T - 70], pur, 1, 0.5);
    neonPath(g, [68, T - 92, 44, T - 70], pur, 1, 0.5);
    // 행성 코어
    const cx = 2;
    const ccy = T - 62;
    const cr = 24;
    const blaze = charging ? 0.6 + ck * 0.4 + 0.15 * Math.sin(t * 18) : A.ex ? 0.8 : 0.35;
    fillCirc(g, cx, ccy, cr + 6, '#0c0612');
    fillCirc(g, cx, ccy, cr, '#5a0f2a');
    g.save();
    circ(g, cx, ccy, cr);
    g.clip();
    for (let i = 0; i < 4; i++) {
      const yy = ccy - cr + 8 + i * 12 + ((t * 6) % 12);
      fillEll(g, cx, yy, cr * 1.2, 2.6, 0.15, i % 2 ? '#ff6a8a' : '#c02050');
    }
    fillCirc(g, cx + 6, ccy - 6, cr * 0.5, rgba('#ffd0dc', 0.25));
    g.restore();
    glow(g, cx, ccy, cr * (1.4 + blaze * 2.2), red, 0.35 + blaze * 0.5, blaze > 0.7);
    if (charging) {
      glow(g, cx, ccy, cr * (3 + ck * 4), '#ff7a3d', 0.25 + 0.35 * ck);
      fillCirc(g, cx, ccy, cr * (0.35 + 0.25 * ck), 'rgba(255,240,230,0.85)');
      // 코어에서 포신으로 흐르는 에너지
      neonPath(g, [cx + cr, ccy, 40, ccy + 10, 62, -40], '#ff6a8a', 2.2, 0.4 + 0.5 * ck);
    }
    g.strokeStyle = rgba('#ff9ab4', 0.7);
    g.lineWidth = 2;
    ell(g, cx, ccy, cr + 14, 7, -0.2);
    g.stroke();
    if (A.ex || (W && W.scan > 0)) weakGlow(g, cx, ccy, cr * 0.5, red, e, W, t);
    // 어깨 가시
    fillEll(g, -68, T - 100, 24, 16, -0.3, '#22163a');
    fillPoly(g, [-80, T - 108, -92, T - 140, -66, T - 112], '#2e1f4a');
    fillPoly(g, [-62, T - 112, -60, T - 146, -48, T - 110], '#2e1f4a');
    fillEll(g, 68, T - 104, 25, 17, 0.3, '#3a2860');
    fillPoly(g, [60, T - 116, 64, T - 152, 76, T - 114], '#4b3478');
    fillPoly(g, [78, T - 110, 94, T - 140, 88, T - 100], '#4b3478');
    neon(g, 52, T - 96, 88, T - 106, pur, 1.2, 0.6);
    // 머리
    g.save();
    g.translate(8, T - 120);
    g.rotate(headUp);
    fillPoly(g, [-16, 8, -18, -10, -8, -20, 10, -20, 20, -8, 18, 8], '#22163a');
    fillPoly(g, [-8, -20, -14, -40, -2, -22], '#3a2860');
    fillPoly(g, [4, -21, 6, -44, 12, -19], '#4b3478');
    fillPoly(g, [12, -16, 26, -34, 18, -12], '#3a2860');
    fillPoly(g, [-10, -8, 18, -8, 16, 0, -8, 0], '#08040c');
    fillCirc(g, 8, -4, 4, red);
    glow(g, 8, -4, 14 + (charging ? 10 : 0), red, 0.85, true);
    g.restore();
    g.restore();
    // 가까운 팔: 거대 포신
    const sxN = 70;
    const syN = hipY - 96;
    const elN = [74, hipY - 46];
    taper(g, sxN, syN, elN[0], elN[1], 30, 26, '#2a1c46');
    fillCirc(g, elN[0], elN[1], 16, '#3a2860');
    g.save();
    g.translate(elN[0], elN[1]);
    g.rotate(canA);
    fillPoly(g, [-14, -20, 40, -18, 66, -14, 66, 14, 40, 18, -14, 20], '#1e1432');
    fillPoly(g, [-14, -20, 40, -18, 66, -14, 66, -4, -14, -6], '#3a2860');
    for (let i = 0; i < 3; i++) {
      const x = 10 + i * 17;
      fillPoly(g, [x, -20, x + 6, -20, x + 6, 20, x, 20], '#2e1f4a');
      neon(g, x + 3, -18, x + 3, 18, pur, 1.2, 0.5 + (charging ? 0.5 * ck : 0));
    }
    fillPoly(g, [64, -17, 74, -15, 74, 15, 64, 17], '#4b3478');
    fillCirc(g, 74, 0, 10, '#0c0612');
    const mG = charging ? 0.3 + ck * 0.7 : anim === 'cast' ? 0.5 : 0.15;
    glow(g, 76, 0, 10 + mG * 40, red, 0.4 + mG * 0.6, mG > 0.5);
    if (charging) {
      glow(g, 76, 0, 18 + ck * 50, pur, 0.3 + 0.3 * ck);
      const pc = g.globalCompositeOperation;
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 14; i++) {
        const u = (t * 1.2 + i / 14) % 1;
        const a = hash(i * 5.3) * TAU;
        const d = (1 - u) * (60 + 40 * hash(i));
        g.strokeStyle = rgba(i % 2 ? red : pur, u * 0.9);
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(76 + Math.cos(a) * d, Math.sin(a) * d);
        g.lineTo(76 + Math.cos(a) * (d + 10), Math.sin(a) * (d + 10));
        g.stroke();
      }
      g.globalCompositeOperation = pc;
    }
    g.restore();
    g.restore();
  }

  /* ───────────── 9. 프로토콜 — 최종 관리자 ───────────── */
  function protoWings(g, sc, t, k, a) {
    const pc = g.globalCompositeOperation;
    for (let side = -1; side <= 1; side += 2) {
      for (let i = 0; i < 4; i++) {
        const ang = -HALF + side * (0.5 + i * 0.32 + k * 0.15) + Math.sin(t * 1.3 + i) * 0.04 * side;
        const L = (30 - i * 3 + k * 8) * sc;
        const W2 = (5 - i * 0.6) * sc;
        const rx = side * 2 * sc;
        const ry = -42 * sc;
        const dx = Math.cos(ang);
        const dy = Math.sin(ang);
        const nx = -dy;
        const ny = dx;
        const off = (6 + i * 3) * sc;
        const x0 = rx + dx * off;
        const y0 = ry + dy * off;
        poly(g, [x0 + nx * W2 * 0.4, y0 + ny * W2 * 0.4, x0 + dx * L * 0.7 + nx * W2, y0 + dy * L * 0.7 + ny * W2, x0 + dx * L, y0 + dy * L,
          x0 + dx * L * 0.7 - nx * W2 * 0.3, y0 + dy * L * 0.7 - ny * W2 * 0.3]);
        g.globalCompositeOperation = 'lighter';
        g.fillStyle = rgba(i % 2 ? '#66e0ff' : '#a8f0ff', (0.2 + 0.1 * k) * a);
        g.fill();
        g.strokeStyle = rgba(i === 0 ? '#ffe9a8' : '#bff6ff', (0.7 + 0.3 * k) * a);
        g.lineWidth = 0.8 * sc;
        g.stroke();
        g.globalCompositeOperation = pc;
      }
    }
  }
  function codePanels(g, sc, t, k, front, a) {
    const pc = g.globalCompositeOperation;
    for (let i = 0; i < 4; i++) {
      const an = t * (0.5 + k * 1.2) + (i / 4) * TAU;
      const sn = Math.sin(an);
      if ((sn >= 0) !== front) continue;
      const R = (30 - k * 8) * sc;
      const x = Math.cos(an) * R;
      const y = (-38 + (i % 2 ? -10 : 6) + sn * 6) * sc;
      const w = 10 * sc * (0.6 + 0.4 * Math.abs(Math.cos(an)) + 0.1);
      const h = 6.5 * sc;
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = rgba('#66e0ff', (front ? 0.16 : 0.08) * a);
      g.fillRect(x - w / 2, y - h / 2, w, h);
      g.strokeStyle = rgba('#a8f0ff', (front ? 0.75 : 0.35) * a);
      g.lineWidth = 0.6 * sc;
      g.strokeRect(x - w / 2, y - h / 2, w, h);
      g.fillStyle = rgba('#d8fbff', (front ? 0.7 : 0.3) * a);
      for (let j = 0; j < 3; j++) {
        const lw = w * (0.3 + 0.5 * hash(i * 7 + j + Math.floor(t * 3)));
        g.fillRect(x - w / 2 + 1.2 * sc, y - h / 2 + (1.3 + j * 1.6) * sc, lw - 2 * sc > 0 ? lw - 2 * sc : 1, 0.6 * sc);
      }
      g.globalCompositeOperation = pc;
    }
  }
  function bossProtocol(g, e, W, t) {
    const sc = ((e.r || 34) * 3.3) / 60;
    const fx = faceX(e);
    const A = bossAnim(e);
    const { anim, at } = A;
    const charge = anim === 'charge' ? clamp01(at / 0.8) : 0;
    const cast = anim === 'cast' ? clamp01(at / 0.3) : 0;
    const bob = Math.sin(t * 1.6 + (e.id || 0)) * 1.6 * sc;
    g.save();
    g.translate(0, bob);
    glowE(g, 0, -36 * sc, 34 * sc, 46 * sc, '#66e0ff', 0.16 + charge * 0.2);
    protoWings(g, sc, t, Math.max(charge, cast * 0.5), A.br ? 0.4 : 1);
    codePanels(g, sc, t, charge, false, A.br ? 0.4 : 1);
    // 광륜
    const hx = fx * 1.2 * sc;
    const hy = -51 * sc;
    const pc = g.globalCompositeOperation;
    g.globalCompositeOperation = 'lighter';
    g.strokeStyle = rgba('#ffe08a', 0.8);
    g.lineWidth = 1.4 * sc;
    circ(g, hx - fx * 1 * sc, hy - 1 * sc, 10 * sc);
    g.stroke();
    g.strokeStyle = rgba('#66e0ff', 0.5 + charge * 0.5);
    g.lineWidth = 0.8 * sc;
    circ(g, hx - fx * 1 * sc, hy - 1 * sc, 12.5 * sc);
    g.stroke();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + t * 0.6;
      const x = hx - fx * sc + Math.cos(a) * 12.5 * sc;
      const y = hy - sc + Math.sin(a) * 12.5 * sc;
      g.fillStyle = rgba('#d8fbff', 0.8);
      g.fillRect(x - 0.6 * sc, y - 0.6 * sc, 1.2 * sc, 1.2 * sc);
    }
    g.globalCompositeOperation = pc;
    glow(g, hx, hy, 16 * sc, '#ffe9a8', 0.25 + charge * 0.4);
    // 몸
    const P = ladyPose();
    P.hairWave = 1.2;
    P.legSw = Math.sin(t * 1.3) * 0.5;
    P.armF = 1.85;
    P.elbF = -0.4;
    P.armB = 2.0;
    P.elbB = -0.3;
    P.away = isAway(e) && !charge && !cast;
    if (cast) {
      P.armF = lerp(1.85, -0.5, easeOut(cast));
      P.elbF = 0.1;
      P.castGlow = 0.8 + 0.2 * Math.sin(t * 18);
      P.castHand = 0;
      P.castCol = '#66e0ff';
    }
    if (charge) {
      P.armF = lerp(1.85, -0.25, charge);
      P.elbF = 0;
      P.armB = lerp(2.0, -2.9, charge);
      P.elbB = 0;
      P.castGlow = charge;
      P.castHand = 0;
      P.headTilt = -0.1 * charge;
      P.hairWave = 2;
    }
    if (A.br) { P.lean = 0.3; P.headTilt = 0.4; P.armF = 2.1; P.armB = 2.3; P.bob = 3; }
    g.save();
    g.scale(sc * fx, sc);
    drawLady(g, PROTOCOL, P, t);
    // 갑옷 장식: 금빛 어깨판과 가슴 문양
    if (!P.away) {
      fillEll(g, 3.6, -41.5, 3.6, 2.4, 0.3, '#e2c470');
      neon(g, 1, -40.5, 6, -42, '#66e0ff', 0.5, 0.8);
      fillPoly(g, [0.6, -37, 2.4, -39.2, 4.2, -37, 2.4, -34.8], '#66e0ff');
      glow(g, 2.4, -37, 4, '#66e0ff', 0.7 + charge * 0.3);
    }
    g.restore();
    codePanels(g, sc, t, charge, true, A.br ? 0.4 : 1);
    if (charge) glow(g, 0, -36 * sc, (20 + charge * 20) * sc, '#bff6ff', 0.3 * charge);
    g.restore();
    if (A.ex || (W && W.scan > 0)) weakGlow(g, -fx * 3 * sc, -38 * sc + bob, 5 * sc, '#66e0ff', e, W, t, 0.4);
  }

  /* ───────────── 10. ASTRA — 최종 형태 ───────────── */
  function bossAstra(g, e, W, t) {
    const s = (e.r || 100) / 100;
    const fx = faceX(e);
    const A = bossAnim(e);
    const { anim, at } = A;
    const ph = A.ph;
    const charging = e.charging > 0;
    const ck = charging ? clamp01(at / 3.2) : 0;
    const cast = anim === 'cast' ? clamp01(at / 0.4) : 0;
    const roar = anim === 'roar' ? clamp01(at / 0.6) : 0;
    const blue = '#9ad8ff';
    const deep = '#2a6cff';
    const bob = Math.sin(t * 0.9) * 4;
    const spinK = 1 + cast * 1.5 + ck * 3 + roar * 2;
    const jit = ph >= 3 ? (hash(Math.floor(t * 14)) > 0.85 ? (hash(t) - 0.5) * 4 : 0) : 0;
    g.save();
    g.scale(s, s);
    g.translate(jit, bob);
    const pc = g.globalCompositeOperation;
    // 큰 빛 번짐
    glowE(g, 0, -170, 170, 190, deep, 0.25 + ck * 0.3);
    // 광륜 고리 (뒤)
    const ringE = (cy, rx, ry, rot, sp, n, front, col, a) => {
      g.save();
      g.translate(0, cy);
      g.rotate(rot);
      g.globalCompositeOperation = 'lighter';
      g.strokeStyle = rgba(col, (front ? 0.75 : 0.35) * a);
      g.lineWidth = front ? 2.4 : 1.6;
      g.beginPath();
      g.ellipse(0, 0, rx, ry, 0, front ? 0 : PI, front ? PI : TAU);
      g.stroke();
      if (front) {
        g.strokeStyle = rgba(col, 0.12 * a);
        g.lineWidth = 9;
        g.stroke();
      }
      for (let i = 0; i < n; i++) {
        const an = ((t * sp * spinK * 0.05 + i / n) % 1) * TAU;
        const sn = Math.sin(an);
        if ((sn >= 0) !== front) continue;
        const x = Math.cos(an) * rx;
        const y = sn * ry;
        g.fillStyle = rgba('#ffffff', (front ? 0.9 : 0.45) * a);
        poly(g, [x, y - 4, x + 2.5, y, x, y + 4, x - 2.5, y]);
        g.fill();
      }
      g.globalCompositeOperation = pc;
      g.restore();
    };
    const rings = [[-232, 128, 36, 0.12, 1, 12, blue], [-210, 160, 52, -0.22, -0.7, 16, '#c8ecff'], [-250, 96, 30, 0.45, 1.6, 10, '#7cc8ff']];
    const nR = ph >= 3 ? 3 : ph >= 2 ? 2 : 1;
    for (let i = 0; i < nR; i++) ringE(rings[i][0], rings[i][1] * (1 + roar * 0.15), rings[i][2] * (1 + roar * 0.15), rings[i][3], rings[i][4], rings[i][5], false, rings[i][6], 1);
    // 머리 뒤 원형 광배
    g.globalCompositeOperation = 'lighter';
    g.strokeStyle = rgba('#d8f0ff', 0.6);
    g.lineWidth = 2;
    circ(g, 0, -262, 42);
    g.stroke();
    g.strokeStyle = rgba(blue, 0.3);
    g.lineWidth = 1;
    circ(g, 0, -262, 50 + Math.sin(t * 2) * 2);
    g.stroke();
    for (let i = 0; i < 24; i++) {
      const an = (i / 24) * TAU - t * 0.3 * spinK;
      g.beginPath();
      g.moveTo(Math.cos(an) * 42, -262 + Math.sin(an) * 42);
      g.lineTo(Math.cos(an) * (i % 3 ? 46 : 52), -262 + Math.sin(an) * (i % 3 ? 46 : 52));
      g.strokeStyle = rgba('#e8f6ff', 0.6);
      g.stroke();
    }
    g.globalCompositeOperation = pc;
    // 빛의 날개 (2페이즈부터)
    if (ph >= 2) {
      for (let side = -1; side <= 1; side += 2) {
        for (let i = 0; i < 4; i++) {
          const ang = -HALF + side * (0.75 + i * 0.28) + Math.sin(t * 0.8 + i) * 0.05 * side;
          const L = 150 - i * 18 + roar * 20;
          const x0 = side * 14;
          const y0 = -214;
          const dx = Math.cos(ang);
          const dy = Math.sin(ang);
          const nx = -dy * side;
          const ny = dx * side;
          poly(g, [x0, y0, x0 + dx * L * 0.55 + nx * 14, y0 + dy * L * 0.55 + ny * 14, x0 + dx * L, y0 + dy * L, x0 + dx * L * 0.5 - nx * 4, y0 + dy * L * 0.5 - ny * 4]);
          g.globalCompositeOperation = 'lighter';
          g.fillStyle = rgba(i % 2 ? '#7cc8ff' : '#d8f0ff', 0.13);
          g.fill();
          g.strokeStyle = rgba('#e8f6ff', 0.5);
          g.lineWidth = 1.2;
          g.stroke();
          g.globalCompositeOperation = pc;
        }
      }
    }
    // 뒤로 솟은 수정 가시
    const spike = (x0, y0, x1, y1, w, a) => {
      const dx = x1 - x0;
      const dy = y1 - y0;
      const L = Math.hypot(dx, dy) || 1;
      const nx = (-dy / L) * w;
      const ny = (dx / L) * w;
      fillPoly(g, [x0 + nx, y0 + ny, x1, y1, x0 - nx, y0 - ny], rgba('#16306a', 0.85 * a));
      fillPoly(g, [x0 + nx, y0 + ny, x1, y1, x0, y0], rgba('#3a7ad8', 0.7 * a));
      neonPath(g, [x0 + nx, y0 + ny, x1, y1, x0 - nx, y0 - ny], blue, 1.2, 0.7 * a);
    };
    spike(-30, -170, -96, -318, 12, 0.9);
    spike(30, -170, 98, -322, 12, 0.9);
    spike(-16, -190, -46, -336, 10, 1);
    spike(16, -190, 48, -338, 10, 1);
    spike(-50, -160, -140, -250, 10, 0.8);
    spike(50, -160, 142, -252, 10, 0.8);
    // 뒷머리 (빛으로 흐르는 머리카락)
    const hw = Math.sin(t * 1.1) * 6;
    for (let side = -1; side <= 1; side += 2) {
      poly(g, [side * 6, -280, side * 26, -270, side * (44 + hw * side * 0.3), -220, side * (58 + hw), -160, side * (64 + hw * 1.3), -112,
        side * (48 + hw), -120, side * (40 + hw * 0.6), -104, side * (28 + hw * 0.4), -130, side * 18, -200]);
      g.fillStyle = rgba('#dceeff', 0.55);
      g.fill();
      g.globalCompositeOperation = 'lighter';
      g.strokeStyle = rgba('#ffffff', 0.35);
      g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(side * 16, -262);
      g.quadraticCurveTo(side * (46 + hw), -190, side * (56 + hw * 1.2), -120);
      g.moveTo(side * 10, -250);
      g.quadraticCurveTo(side * (32 + hw * 0.5), -180, side * (36 + hw), -110);
      g.stroke();
      g.globalCompositeOperation = pc;
    }
    // 아래쪽 수정 몸체 (거꾸로 된 왕관)
    const shard = (x0, y0, x1, y1, w, c1, c2) => {
      const dx = x1 - x0;
      const dy = y1 - y0;
      const L = Math.hypot(dx, dy) || 1;
      const nx = (-dy / L) * w;
      const ny = (dx / L) * w;
      fillPoly(g, [x0 + nx, y0 + ny, x1, y1, x0 - nx, y0 - ny], c1);
      fillPoly(g, [x0 + nx, y0 + ny, x1, y1, x0, y0], c2);
      neonPath(g, [x0 + nx, y0 + ny, x1, y1, x0 - nx, y0 - ny], blue, 1, 0.6);
    };
    shard(-36, -150, -92, -60, 14, 'rgba(22,48,106,0.9)', 'rgba(58,122,216,0.75)');
    shard(36, -150, 92, -60, 14, 'rgba(22,48,106,0.9)', 'rgba(58,122,216,0.75)');
    shard(-26, -140, -54, -18, 13, 'rgba(26,56,120,0.92)', 'rgba(74,140,230,0.75)');
    shard(26, -140, 54, -18, 13, 'rgba(26,56,120,0.92)', 'rgba(74,140,230,0.75)');
    shard(0, -150, 0, 4, 22, 'rgba(30,64,136,0.95)', 'rgba(90,160,240,0.8)');
    shard(-14, -140, -24, -30, 10, 'rgba(36,74,150,0.9)', 'rgba(110,176,246,0.7)');
    shard(14, -140, 24, -30, 10, 'rgba(36,74,150,0.9)', 'rgba(110,176,246,0.7)');
    // 상체 (홀로그램 여신)
    const fo = fx * 2;
    fillPoly(g, [-22, -148, -16, -186, -30, -222, -12, -230, 14, -230, 32, -222, 18, -186, 24, -148, 0, -136], 'rgba(220,238,255,0.82)');
    fillPoly(g, [-22, -148, -16, -186, -30, -222, -12, -230, 0, -230, 0, -136], 'rgba(170,205,250,0.5)');
    // 가슴 수정 장갑
    fillPoly(g, [-18, -222, 0, -232, 18, -222, 12, -196, 0, -188, -12, -196], 'rgba(60,120,220,0.7)');
    neonPath(g, [-18, -222, 0, -232, 18, -222, 12, -196, 0, -188, -12, -196], '#d8f0ff', 1, 0.8, true);
    neonPath(g, [-20, -150, 0, -160, 20, -150], blue, 1.2, 0.8);
    // 팔
    const armSpread = cast * 0.7 + ck * 0.9 + roar;
    for (let side = -1; side <= 1; side += 2) {
      const sx = side * 28;
      const sy = -222;
      const a1 = HALF + side * (0.35 + armSpread * 0.9);
      const a2 = a1 - side * (0.6 + armSpread * 0.5);
      const ex = sx + Math.cos(a1) * 34;
      const ey = sy + Math.sin(a1) * 34 * (1 - armSpread * 0.3) - armSpread * 20;
      const hx2 = ex + Math.cos(a2) * 32;
      const hy2 = ey + Math.sin(a2) * 32 - armSpread * 18;
      g.lineCap = 'round';
      seg(g, sx, sy, ex, ey, 8, 'rgba(210,230,255,0.85)');
      seg(g, ex, ey, hx2, hy2, 6.5, 'rgba(225,240,255,0.85)');
      neon(g, ex, ey, hx2, hy2, blue, 0.8, 0.5);
      if (cast > 0 || ck > 0 || roar > 0) glow(g, hx2, hy2, 18 + 20 * Math.max(cast, ck), '#d8f0ff', 0.6, true);
    }
    // 머리
    const hx = fo;
    const hy = -262;
    fillPoly(g, [hx - 4, -244, hx + 4, -244, hx + 4, -234, hx - 4, -234], 'rgba(230,240,255,0.9)');
    fillPoly(g, [hx - 12, -270, hx - 13, -258, hx - 8, -248, hx, -244, hx + 8, -248, hx + 13, -258, hx + 12, -270, hx, -280], '#eef4ff');
    const eyesOpen = cast > 0.5 || ck > 0.2 || roar > 0.3;
    if (eyesOpen) {
      fillEll(g, hx - 5, -261, 2.6, 1.4, 0, '#bff0ff');
      fillEll(g, hx + 5, -261, 2.6, 1.4, 0, '#bff0ff');
      glow(g, hx - 5, -261, 8, '#9ad8ff', 0.9, true);
      glow(g, hx + 5, -261, 8, '#9ad8ff', 0.9, true);
    } else {
      g.strokeStyle = '#6a7aa8';
      g.lineWidth = 0.9;
      g.beginPath();
      g.moveTo(hx - 8, -261);
      g.quadraticCurveTo(hx - 5, -259, hx - 2, -261);
      g.moveTo(hx + 2, -261);
      g.quadraticCurveTo(hx + 5, -259, hx + 8, -261);
      g.stroke();
    }
    // 앞머리 + 머리 장식
    fillPoly(g, [hx - 14, -262, hx - 12, -276, hx, -283, hx + 12, -276, hx + 14, -262, hx + 9, -270, hx + 5, -264, hx + 2, -272, hx - 2, -266, hx - 6, -272, hx - 9, -265], '#f6faff');
    for (let side = -1; side <= 1; side += 2) {
      fillPoly(g, [hx + side * 11, -268, hx + side * 22, -288, hx + side * 14, -264], '#3a5aa8');
      neon(g, hx + side * 12, -268, hx + side * 21, -286, blue, 1, 0.9);
      glow(g, hx + side * 13, -266, 6, blue, 0.8);
    }
    // 코어 (다이아몬드)
    const cx = 0;
    const ccy = -128;
    const cr = 20 + ck * 6;
    fillPoly(g, [cx, ccy - cr * 1.3, cx + cr, ccy, cx, ccy + cr * 1.3, cx - cr, ccy], '#eaf6ff');
    fillPoly(g, [cx, ccy - cr * 1.3, cx + cr, ccy, cx, ccy], '#bfe4ff');
    glow(g, cx, ccy, 40 + ck * 120 + cast * 20, '#bfe8ff', 0.6 + ck * 0.4, true);
    if (A.ex || (W && W.scan > 0)) weakGlow(g, cx, ccy, 14, A.ex ? '#ffffff' : '#7cf7ff', e, W, t);
    if (charging) {
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 18; i++) {
        const u = (t * 0.9 + i / 18) % 1;
        const a = hash(i * 3.7) * TAU;
        const d = (1 - u) * (160 + 60 * hash(i * 1.3));
        g.strokeStyle = rgba(i % 3 ? '#d8f0ff' : '#7cc8ff', u * 0.9);
        g.lineWidth = 2.4;
        g.beginPath();
        g.moveTo(cx + Math.cos(a) * d, ccy + Math.sin(a) * d * 0.8);
        g.lineTo(cx + Math.cos(a) * (d + 18), ccy + Math.sin(a) * (d + 18) * 0.8);
        g.stroke();
      }
      g.globalCompositeOperation = pc;
      glow(g, cx, ccy, 70 + ck * 160, '#ffffff', 0.35 + 0.4 * ck);
    }
    // 3페이즈: 프리즘 균열
    if (ph >= 3) {
      g.globalCompositeOperation = 'lighter';
      const cracks = [[-6, -230, 8, -205, -4, -186, 10, -160], [12, -150, 30, -110, 22, -80, 40, -50], [-14, -140, -34, -100, -28, -60],
        [cx - 6, ccy - 10, cx + 8, ccy + 6, cx - 2, ccy + 22], [-40, -200, -60, -170, -50, -150], [4, -270, -2, -258, 6, -248]];
      for (let i = 0; i < cracks.length; i++) {
        const c = cracks[i];
        g.beginPath();
        g.moveTo(c[0], c[1]);
        for (let j = 2; j < c.length; j += 2) g.lineTo(c[j], c[j + 1]);
        g.strokeStyle = hsl(t * 120 + i * 60, 100, 70, 0.3);
        g.lineWidth = 7;
        g.stroke();
        g.strokeStyle = hsl(t * 120 + i * 60, 100, 78, 0.95);
        g.lineWidth = 2.2;
        g.stroke();
      }
      g.globalCompositeOperation = pc;
      glow(g, 0, -190, 60, '#ff9ae8', 0.12 + 0.08 * Math.sin(t * 7));
    }
    // 광륜 고리 (앞)
    for (let i = 0; i < nR; i++) ringE(rings[i][0], rings[i][1] * (1 + roar * 0.15), rings[i][2] * (1 + roar * 0.15), rings[i][3], rings[i][4], rings[i][5], true, rings[i][6], 1);
    g.restore();
  }

  /* ───────────── 알 수 없는 대상 ───────────── */
  function drawUnknown(g, e, W, t) {
    const r = e.r > 0 ? e.r : 18;
    const col = (e.def && e.def.color) || (e.team === 'player' ? '#7cf7ff' : '#ff5470');
    const b = Math.sin(t * 3 + (e.id || 0)) * r * 0.05;
    glowE(g, 0, -r * 1.4 + b, r * 1.1, r * 1.7, col, 0.35);
    fillEll(g, 0, -r * 1.1 + b, r * 0.55, r * 1.0, 0, rgba('#141a2c', 0.9));
    fillCirc(g, 0, -r * 2.3 + b, r * 0.38, rgba('#141a2c', 0.9));
    g.strokeStyle = rgba(col, 0.9);
    g.lineWidth = Math.max(1, r * 0.06);
    ell(g, 0, -r * 1.1 + b, r * 0.55, r * 1.0, 0);
    g.stroke();
    circ(g, 0, -r * 2.3 + b, r * 0.38);
    g.stroke();
    glow(g, r * 0.12 * faceX(e), -r * 2.32 + b, r * 0.3, col, 0.9, true);
  }

  const BOSS = {
    scavenger: bossScavenger,
    arka: bossArka,
    observer: bossObserver,
    zero: (g, e, W, t) => drawZero(g, e, W, t, true),
    atlas: bossAtlas,
    sera: bossSera,
    draco: bossDraco,
    nemesis: bossNemesis,
    protocol: bossProtocol,
    astra: bossAstra,
  };
  // [반폭, 높이] (r 배수) — 브레이크 불꽃, 파괴 연출 범위
  const BOSS_BOX = {
    scavenger: [1.45, 2.1], arka: [1.3, 3.1], observer: [1.5, 2.4], zero: [0.9, 3.4], atlas: [1.4, 3.5],
    sera: [1.5, 3.4], draco: [1.7, 2.4], nemesis: [1.6, 3.2], protocol: [1.6, 3.6], astra: [1.6, 3.4],
  };

  function bossDeath(g, e, W, t, fn) {
    const d = e.deadT || 0;
    if (d >= 2.5) return;
    const r = e.r || 50;
    const box = BOSS_BOX[e.bossId] || [1.4, 2.6];
    const hw = box[0] * r;
    const h = box[1] * r;
    const col = (e.def && e.def.color) || '#ffffff';
    const flick = hash(Math.floor(d * 28)) > 0.28 ? 1 : 0.35;
    const pa = g.globalAlpha;
    if (d < 0.7) {
      g.save();
      g.translate((hash(Math.floor(d * 60)) - 0.5) * r * 0.08, 0);
      g.globalAlpha = pa * flick;
      fn(g, e, W, t);
      g.restore();
      glowE(g, 0, -h * 0.5, hw * 1.1, h * 0.6, col, 0.45 * (d / 0.7));
      sparks(g, d * 3, 10, 0, -h * 0.5, hw, h * 0.45, '#ffe9a0', 77, Math.max(1.2, r * 0.03));
    } else {
      const kk = clamp01((d - 0.7) / 1.8);
      const cols = 3;
      const rows = 3;
      const cw = (2 * hw) / cols;
      const ch = h / rows;
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const x0 = -hw + cw * i;
          const y0 = -h + ch * j;
          const ccx = x0 + cw / 2;
          const ccy = y0 + ch / 2;
          const seed = i * 3 + j + 1;
          g.save();
          g.translate((ccx / hw) * kk * kk * r * 1.3 + (hash(seed) - 0.5) * kk * r * 0.5, ((ccy + h * 0.5) / h - 0.2) * kk * r * 0.5 + kk * kk * r * 0.7);
          g.translate(ccx, ccy);
          g.rotate((hash(seed * 1.7) - 0.5) * kk * 1.4);
          g.translate(-ccx, -ccy);
          g.beginPath();
          g.rect(x0 - 0.5, y0 - 0.5, cw + 1, ch + 1);
          g.clip();
          g.globalAlpha = pa * (1 - kk) * flick;
          fn(g, e, W, t);
          g.restore();
        }
      }
      g.globalAlpha = pa;
      glowE(g, 0, -h * 0.5, hw * (1 + kk), h * (0.6 + kk * 0.3), '#ffffff', 0.5 * (1 - kk));
      sparks(g, d * 2, 14, 0, -h * 0.5, hw * (1 + kk), h * 0.5, '#ffe9a0', 91, Math.max(1.2, r * 0.03));
    }
    g.globalAlpha = pa;
  }

  function drawBoss(g, e, W, t) {
    const fn = BOSS[e.bossId];
    if (!fn) return drawUnknown(g, e, W, t);
    if (e.dead) return bossDeath(g, e, W, t, fn);
    fn(g, e, W, t);
    if (e.broken) {
      const r = e.r || 50;
      const box = BOSS_BOX[e.bossId] || [1.4, 2.6];
      sparks(g, t, 9, 0, -box[1] * r * 0.55, box[0] * r * 0.8, box[1] * r * 0.4, '#ffe066', (e.id || 1) * 5, Math.max(1.2, r * 0.035));
      // 머리 위를 도는 별(어지러움)
      const pc = g.globalCompositeOperation;
      g.globalCompositeOperation = 'lighter';
      const hy = -box[1] * r * 0.92;
      for (let i = 0; i < 3; i++) {
        const a = t * 4 + (i / 3) * TAU;
        const x = Math.cos(a) * r * 0.32;
        const y = hy + Math.sin(a) * r * 0.1;
        g.fillStyle = 'rgba(255,230,120,0.9)';
        const q = Math.max(2, r * 0.06);
        poly(g, [x, y - q, x + q * 0.35, y - q * 0.35, x + q, y, x + q * 0.35, y + q * 0.35, x, y + q, x - q * 0.35, y + q * 0.35, x - q, y, x - q * 0.35, y - q * 0.35]);
        g.fill();
      }
      g.globalCompositeOperation = pc;
    }
  }

  /* =========================================================
   * 공개 함수
   * ========================================================= */
  let errLogged = 0;
  function draw(g, ent, W, t) {
    if (!g || !ent) return;
    const tt = typeof t === 'number' && isFinite(t) ? t : 0;
    g.save();
    try {
      // 일반 투명도(ent.alpha, 무적, 등장, 동료 다운, 일반 적 사망 페이드)는 render.js 의 drawEntity 가 이미 적용한다.
      switch (ent.kind) {
        case 'player':
          drawKai(g, ent, W, tt);
          break;
        case 'ally':
          if (ent.ally === 'lia') drawLia(g, ent, W, tt);
          else if (ent.ally === 'zero') drawZero(g, ent, W, tt, false);
          else drawUnknown(g, ent, W, tt);
          break;
        case 'enemy':
          drawMinion(g, ent, W, tt);
          break;
        case 'boss':
          drawBoss(g, ent, W, tt);
          break;
        default:
          drawUnknown(g, ent, W, tt);
      }
    } catch (err) {
      if (errLogged < 5 && typeof console !== 'undefined') {
        errLogged += 1;
        console.error('[sprites]', err);
      }
    }
    g.restore();
  }

  /** HUD 용 얼굴 아이콘 — (0,0) 가운데, 지름 size */
  function drawPortraitIcon(g, id, size) {
    if (!g) return;
    const sz = size > 0 ? size : 32;
    g.save();
    try {
      const r = sz / 2;
      const ring = id === 'zero' ? '#ff3355' : id === 'lia' ? '#9ae6ff' : '#5fd4ff';
      const bg = g.createRadialGradient(0, -r * 0.2, r * 0.1, 0, 0, r);
      bg.addColorStop(0, id === 'zero' ? '#3a1424' : '#1c2a4e');
      bg.addColorStop(1, '#070b18');
      circ(g, 0, 0, r);
      g.fillStyle = bg;
      g.fill();
      g.save();
      circ(g, 0, 0, r * 0.94);
      g.clip();
      const sc = sz / 22;
      g.scale(sc, sc);
      if (id === 'lia') {
        g.translate(-1.2, 52.5);
        const P = ladyPose();
        P.armF = 1.9;
        P.armB = 2.0;
        drawLady(g, LIA, P, 0);
      } else if (id === 'zero' || id === 'kai') {
        g.translate(-2.2, 53);
        const P = basePose();
        P.wpn = null;
        drawMan(g, id === 'zero' ? ZERO : KAI, P, 0);
      } else {
        fillCirc(g, 0, 0, 6, '#2a3450');
        glow(g, 0, 0, 8, ring, 0.6);
      }
      g.restore();
      g.strokeStyle = ring;
      g.lineWidth = Math.max(1, sz * 0.06);
      circ(g, 0, 0, r * 0.96);
      g.stroke();
    } catch (err) {
      if (errLogged < 5 && typeof console !== 'undefined') {
        errLogged += 1;
        console.error('[sprites] portrait', err);
      }
    }
    g.restore();
  }

  return { draw, drawPortraitIcon };
})();
