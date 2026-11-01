'use strict';

/* =========================================================
 * 저장 — localStorage (사용할 수 없으면 조용히 무시)
 * ========================================================= */
CB.save = (() => {
  const KEYS = {
    run: 'cardExpedition.run',
    settings: 'cardExpedition.settings',
    history: 'cardExpedition.history',
  };
  const DEFAULT_SETTINGS = { master: 0.8, sfx: 0.8, music: 0.5, muted: false, shake: true, fast: false };

  function storage() {
    try {
      if (typeof localStorage === 'undefined') return null;
      return localStorage;
    } catch (e) {
      return null;
    }
  }
  function read(key) {
    const s = storage();
    if (!s) return null;
    try {
      const raw = s.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }
  function write(key, value) {
    const s = storage();
    if (!s) return false;
    try {
      s.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  }
  function remove(key) {
    const s = storage();
    if (!s) return;
    try { s.removeItem(key); } catch (e) { /* 무시 */ }
  }

  function saveRun(run) {
    if (!run) return false;
    if (run._rng) run.rngState = run._rng.getState();
    if (run.over) { clearRun(); return true; }
    return write(KEYS.run, run);
  }

  function loadRun() {
    const run = read(KEYS.run);
    if (!run || run.version !== 1 || !run.player || !Array.isArray(run.deck) || !run.map) return null;
    // 카드 ID 카운터가 겹치지 않도록
    let max = 0;
    for (const c of run.deck) {
      const n = parseInt(String(c.uid).replace(/\D/g, ''), 10);
      if (n > max) max = n;
    }
    CB.util.bumpIdCounter('c', max + 1);
    return run;
  }

  const clearRun = () => remove(KEYS.run);
  const hasRun = () => !!loadRun();

  function loadSettings() {
    return { ...DEFAULT_SETTINGS, ...(read(KEYS.settings) || {}) };
  }
  function saveSettings(settings) {
    return write(KEYS.settings, { ...DEFAULT_SETTINGS, ...settings });
  }

  function getHistory() {
    const list = read(KEYS.history);
    return Array.isArray(list) ? list : [];
  }
  function recordResult(run) {
    const entry = {
      score: CB.run.score(run),
      victory: !!run.victory,
      act: run.act,
      floor: run.floor,
      kills: run.stats.enemiesKilled,
      date: new Date().toISOString().slice(0, 10),
      seed: run.seed,
    };
    const list = getHistory();
    list.push(entry);
    list.sort((a, b) => b.score - a.score);
    write(KEYS.history, list.slice(0, 10));
    return entry;
  }

  return { saveRun, loadRun, clearRun, hasRun, loadSettings, saveSettings, getHistory, recordResult, DEFAULT_SETTINGS };
})();
