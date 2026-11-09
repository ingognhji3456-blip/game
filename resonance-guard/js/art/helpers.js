'use strict';

/* =========================================================
 * 그림 공용 도우미 (SVG 문자열)
 * 규격: docs/ARCHITECTURE.md §5
 * ========================================================= */
RG.art._h = (() => {
  let counter = 0;
  /** SVG 안에서 겹치지 않는 id */
  const uid = (p = 'g') => `${p}${(counter++).toString(36)}`;

  /** 외곽선 색 */
  const OL = '#1c1426';

  /** 외곽선 속성 (w = 굵기) */
  const S = (w = 3) => `stroke="${OL}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;

  /* ---------- 색 계산 ---------- */
  function hexToRgb(hex) {
    let h = hex.replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgbToHex(r, g, b) {
    const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
    return `#${c(r)}${c(g)}${c(b)}`;
  }
  /** 두 색 섞기 (t: 0=a, 1=b) */
  function mix(a, b, t) {
    const A = hexToRgb(a);
    const B = hexToRgb(b);
    return rgbToHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
  }
  /** 밝게(+)/어둡게(−): amt −1~1 */
  const shade = (c, amt) => (amt >= 0 ? mix(c, '#ffffff', amt) : mix(c, '#000000', -amt));
  /** rgba 문자열 */
  function rgba(hex, a) {
    const [r, g, b] = hexToRgb(hex);
    return `rgba(${r},${g},${b},${a})`;
  }

  /* ---------- defs ---------- */
  /** 선형 그라데이션. stops: [[offset, color, opacity?], ...], dir: 'v'(위→아래) | 'h' | [x1,y1,x2,y2] */
  function lg(id, stops, dir = 'v') {
    const d = dir === 'v' ? [0, 0, 0, 1] : dir === 'h' ? [0, 0, 1, 0] : dir === 'd' ? [0, 0, 1, 1] : dir;
    return `<linearGradient id="${id}" x1="${d[0]}" y1="${d[1]}" x2="${d[2]}" y2="${d[3]}">${
      stops.map(([o, c, op]) => `<stop offset="${o}" stop-color="${c}"${op != null ? ` stop-opacity="${op}"` : ''}/>`).join('')
    }</linearGradient>`;
  }
  /** 방사형 그라데이션. cx, cy, r는 0~1 비율 */
  function rg(id, stops, cx = 0.4, cy = 0.35, r = 0.75) {
    return `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">${
      stops.map(([o, c, op]) => `<stop offset="${o}" stop-color="${c}"${op != null ? ` stop-opacity="${op}"` : ''}/>`).join('')
    }</radialGradient>`;
  }
  /** 빛 번짐 필터 */
  function glow(id, std = 2.5) {
    return `<filter id="${id}" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="${std}" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
  }
  /** 부드러운 흐림(빛 덩어리용) */
  function blur(id, std = 3) {
    return `<filter id="${id}" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="${std}"/></filter>`;
  }

  /** 원소 색 세트 */
  function el(element) {
    const e = (RG.data.elements && RG.data.elements[element]) || { color: '#cccccc', dark: '#666666', light: '#eeeeee' };
    return e;
  }

  /** 3단 그라데이션 (밝음→본색→어두움) 한 번에 */
  function tri(id, base, dir = 'v') {
    return lg(id, [[0, shade(base, 0.35)], [0.55, base], [1, shade(base, -0.4)]], dir);
  }

  /** SVG 감싸기 */
  function svg(viewBox, defs, body, extra = '') {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" ${extra}><defs>${defs}</defs>${body}</svg>`;
  }

  /** 숫자 다듬기 */
  const n = (v) => Math.round(v * 10) / 10;

  /** 별 모양 경로 */
  function starPath(cx, cy, r1, r2, points = 5, rot = -90) {
    let d = '';
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? r1 : r2;
      const a = ((rot + (i * 180) / points) * Math.PI) / 180;
      d += `${i === 0 ? 'M' : 'L'}${n(cx + Math.cos(a) * r)} ${n(cy + Math.sin(a) * r)} `;
    }
    return `${d}Z`;
  }
  /** 정다각형 경로 */
  function polyPath(cx, cy, r, sides, rot = -90) {
    let d = '';
    for (let i = 0; i < sides; i++) {
      const a = ((rot + (i * 360) / sides) * Math.PI) / 180;
      d += `${i === 0 ? 'M' : 'L'}${n(cx + Math.cos(a) * r)} ${n(cy + Math.sin(a) * r)} `;
    }
    return `${d}Z`;
  }

  return { uid, OL, S, hexToRgb, rgbToHex, mix, shade, rgba, lg, rg, glow, blur, el, tri, svg, n, starPath, polyPath };
})();
