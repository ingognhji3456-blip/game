'use strict';

/* =========================================================
 * 공명 수호대 — 공용 유틸리티 & 이름공간
 * 모든 모듈은 window.RG 아래에 붙습니다. (ES 모듈·빌드 도구 없음)
 * 이 파일은 DOM 없이도 동작해야 합니다(Node 테스트). el()만 DOM을 씁니다.
 * ========================================================= */

window.RG = window.RG || {};
RG.data = RG.data || {};
RG.art = RG.art || {};
RG.ui = RG.ui || {};

RG.util = (() => {
  /**
   * 시드 기반 난수 생성기 (mulberry32). rng() → [0, 1)
   * 상태는 uint32 하나라 저장·복원이 쉽습니다.
   */
  function makeRng(seed) {
    let s = seed >>> 0;
    const rng = () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    rng.getState = () => s;
    rng.setState = (v) => { s = v >>> 0; };
    rng.int = (min, max) => min + Math.floor(rng() * (max - min + 1));
    rng.range = (min, max) => min + rng() * (max - min);
    rng.pick = (arr) => arr[Math.floor(rng() * arr.length)];
    rng.chance = (p) => rng() < p;
    rng.shuffle = (arr) => {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
      }
      return arr;
    };
    return rng;
  }

  function randomSeed() {
    return (Math.random() * 4294967296) >>> 0;
  }

  const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const dist2 = (ax, ay, bx, by) => { const dx = ax - bx; const dy = ay - by; return dx * dx + dy * dy; };
  const dist = (ax, ay, bx, by) => Math.sqrt(dist2(ax, ay, bx, by));
  const round = (v, d = 0) => { const m = Math.pow(10, d); return Math.round(v * m) / m; };

  /** 받침 유무에 따른 조사. josa('늑대', '을', '를') → '를' */
  function josa(word, withFinal, withoutFinal) {
    const str = String(word);
    const last = str.charAt(str.length - 1);
    if (/[0-9]/.test(last)) return '013678'.includes(last) ? withFinal : withoutFinal;
    const code = last.charCodeAt(0) - 0xac00;
    if (code < 0 || code > 11171) return withoutFinal;
    const fin = code % 28;
    if (withFinal === '으로' && fin === 8) return withoutFinal;
    return fin !== 0 ? withFinal : withoutFinal;
  }
  /** withJosa('궁수탑', '이/가') → '궁수탑이' */
  function withJosa(word, pair) {
    const [a, b] = pair.split('/');
    return `${word}${josa(word, a, b)}`;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /** DOM 생성 도우미. el('div', { class: 'a', onclick: fn }, [child, 'text']) */
  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs || {})) {
      if (value === undefined || value === null || value === false) continue;
      if (key === 'class' || key === 'className') node.className = value;
      else if (key === 'html') node.innerHTML = value;
      else if (key === 'text') node.textContent = value;
      else if (key === 'style' && typeof value === 'object') Object.assign(node.style, value);
      else if (key === 'dataset') Object.assign(node.dataset, value);
      else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value);
      else node.setAttribute(key, value === true ? '' : value);
    }
    for (const child of [].concat(children)) {
      if (child === null || child === undefined || child === false) continue;
      node.appendChild(typeof child === 'string' || typeof child === 'number' ? document.createTextNode(String(child)) : child);
    }
    return node;
  }

  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  /** 32비트 FNV-1a 해시 (문자열) */
  function hashStr(str, h = 0x811c9dc5) {
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h >>> 0;
  }

  /** 숫자를 보기 좋게: 12.0 → '12', 0.85 → '0.85' */
  function fmt(v, d = 2) {
    if (typeof v !== 'number' || !isFinite(v)) return String(v);
    const r = round(v, d);
    return String(r);
  }
  /** 비율 → 퍼센트 문자열: 0.15 → '15%' */
  const pct = (v) => `${round(v * 100, 1)}%`;

  return {
    makeRng, randomSeed, clamp, lerp, dist, dist2, round, josa, withJosa, escapeHtml, el, deepClone, hashStr, fmt, pct,
  };
})();
