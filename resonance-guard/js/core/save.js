'use strict';

/* =========================================================
 * 저장 — localStorage가 없거나 막혀 있어도 메모리로 동작
 * 키: ARCHITECTURE.md §7
 * ========================================================= */
RG.save = (() => {
  const mem = new Map();
  const KEYS = { progress: 'rg.progress.v1', settings: 'rg.settings.v1', run: 'rg.run.v1' };

  function store() {
    try {
      if (typeof localStorage !== 'undefined' && localStorage) return localStorage;
    } catch (e) { /* 막힘 */ }
    return null;
  }

  function get(key, fallback) {
    let raw = null;
    try {
      const s = store();
      raw = s ? s.getItem(key) : (mem.has(key) ? mem.get(key) : null);
    } catch (e) {
      raw = mem.has(key) ? mem.get(key) : null;
    }
    if (raw == null) return fallback;
    try { return JSON.parse(raw); } catch (e) { return fallback; }
  }

  function set(key, value) {
    const raw = JSON.stringify(value);
    mem.set(key, raw);
    try { const s = store(); if (s) s.setItem(key, raw); } catch (e) { /* 저장 공간 없음: 메모리만 */ }
  }

  function remove(key) {
    mem.delete(key);
    try { const s = store(); if (s) s.removeItem(key); } catch (e) { /* 무시 */ }
  }

  return { KEYS, get, set, remove };
})();
