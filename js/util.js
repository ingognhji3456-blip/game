'use strict';

/* =========================================================
 * 카드 원정대 - 공용 유틸리티 & 네임스페이스
 * 모든 모듈은 window.CB 아래에 붙습니다. (빌드 도구/ES 모듈 없음)
 * ========================================================= */

window.CB = window.CB || {};
CB.data = CB.data || {};
CB.ui = CB.ui || {};

CB.util = (() => {
  /**
   * 시드 기반 난수 생성기 (mulberry32).
   * rng() → [0, 1) 실수. 상태는 uint32 하나라서 저장/복원이 쉽다.
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
    /** min~max 정수 (양 끝 포함) */
    rng.int = (min, max) => min + Math.floor(rng() * (max - min + 1));
    rng.pick = (arr) => arr[Math.floor(rng() * arr.length)];
    rng.chance = (p) => rng() < p;
    /** 배열을 제자리에서 섞고 그대로 반환 */
    rng.shuffle = (arr) => {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    };
    /** 가중치 선택: { key: weight } 객체 또는 [[item, weight], ...] 배열 */
    rng.weighted = (weights) => {
      const entries = Array.isArray(weights) ? weights : Object.entries(weights);
      const total = entries.reduce((sum, [, w]) => sum + Math.max(0, w), 0);
      if (total <= 0) return entries.length ? entries[0][0] : undefined;
      let roll = rng() * total;
      for (const [item, w] of entries) {
        roll -= Math.max(0, w);
        if (roll < 0) return item;
      }
      return entries[entries.length - 1][0];
    };
    /** 중복 없이 n개 뽑기 */
    rng.sample = (arr, n) => rng.shuffle([...arr]).slice(0, n);
    return rng;
  }

  function randomSeed() {
    return (Math.random() * 4294967296) >>> 0;
  }

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  /**
   * 받침 유무에 따른 조사 선택. 조사만 반환.
   * josa('슬라임', '이', '가') → '이',  josa('늑대', '을', '를') → '를'
   * 숫자는 한국어 읽기 기준(1,3,6,7,8,0 받침 있음)으로 판단.
   */
  function josa(word, withFinal, withoutFinal) {
    const str = String(word);
    const last = str.charAt(str.length - 1);
    if (/[0-9]/.test(last)) {
      return '013678'.includes(last) ? withFinal : withoutFinal;
    }
    const code = last.charCodeAt(0) - 0xac00;
    if (code < 0 || code > 11171) return withoutFinal;
    const hasFinal = code % 28 !== 0;
    // '(으)로' 는 ㄹ 받침이면 '로'
    if (withFinal === '으로' && code % 28 === 8) return withoutFinal;
    return hasFinal ? withFinal : withoutFinal;
  }

  /** 단어 + 조사. withJosa('슬라임', '이/가') → '슬라임이' */
  function withJosa(word, pair) {
    const [a, b] = pair.split('/');
    return `${word}${josa(word, a, b)}`;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * 간단한 DOM 생성 도우미.
   * el('div', { class: 'card', dataset: { uid: 'c1' }, onclick: fn }, [child, 'text'])
   * attrs.html 을 주면 innerHTML 로 설정.
   */
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
      node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    }
    return node;
  }

  function deepClone(obj) {
    if (typeof structuredClone === 'function') return structuredClone(obj);
    return JSON.parse(JSON.stringify(obj));
  }

  /** 접두사별 증가 ID. nextId('c') → 'c1', 'c2', ... */
  const counters = {};
  function nextId(prefix) {
    counters[prefix] = (counters[prefix] || 0) + 1;
    return `${prefix}${counters[prefix]}`;
  }

  /** 저장된 데이터에서 ID 카운터가 겹치지 않도록 최솟값을 맞춘다. */
  function bumpIdCounter(prefix, atLeast) {
    counters[prefix] = Math.max(counters[prefix] || 0, atLeast);
  }

  return {
    makeRng, randomSeed, clamp, sleep, josa, withJosa, escapeHtml, el, deepClone, nextId, bumpIdCounter,
  };
})();
