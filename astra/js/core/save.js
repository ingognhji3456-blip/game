'use strict';

/* =========================================================
 * 저장 — localStorage (쓸 수 없으면 메모리에만 보관)
 * ========================================================= */
window.AZ = window.AZ || {};

AZ.save = (() => {
  const KEY = 'astraZeroProtocol.save.v1';
  const SETTINGS_KEY = 'astraZeroProtocol.settings.v1';
  const VERSION = 1;
  const memory = {};

  const DEFAULT_SETTINGS = {
    master: 0.8, music: 0.55, sfx: 0.8, muted: false,
    shake: true, flashes: true, textSpeed: 1, damageNumbers: true, touch: 'auto', autoAim: true, bg3d: true,
  };

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
    try {
      const raw = s ? s.getItem(key) : memory[key];
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }
  function write(key, value) {
    const raw = JSON.stringify(value);
    memory[key] = raw;
    const s = storage();
    if (!s) return false;
    try {
      s.setItem(key, raw);
      return true;
    } catch (e) {
      return false;
    }
  }
  function remove(key) {
    delete memory[key];
    const s = storage();
    try {
      if (s) s.removeItem(key);
    } catch (e) { /* 무시 */ }
  }

  /** 새 게임 데이터 */
  function fresh(difficulty) {
    const sk = AZ.data.skills.starting;
    return {
      version: VERSION,
      difficulty: difficulty || 'normal',
      createdAt: Date.now(),
      level: 1, exp: 0, sp: 1, credits: 0,
      unlockedChapter: 1,
      cleared: {},
      weapons: { blade: 1 },          // id → 강화 레벨
      weapon: 'blade',
      modules: [],                     // 가진 모듈 id
      equippedModules: [null, null, null],
      learned: sk.learned.slice(),
      equippedSkills: sk.equipped.slice(),
      flags: {},
      memories: [],                    // 얻은 기억 id
      codex: {},                       // bossId → { seen, defeated, clears, best }
      records: {},                     // bossId → [{ time, rank, score, diff, date }] 상위 5
      chapterBest: {},                 // 챕터 id → 전체(웨이브+보스) 최고 기록(초)
      endings: [],
      playTime: 0,
      firstClearTime: null,            // 처음 엔딩을 본 시점의 누적 플레이 시간
      tutorialDone: false,
    };
  }

  function migrate(d) {
    if (!d || typeof d !== 'object') return null;
    const base = fresh(d.difficulty);
    const out = Object.assign(base, d);
    // 빠진 필드 보정
    for (const k of ['cleared', 'weapons', 'flags', 'codex', 'records', 'chapterBest']) {
      if (!out[k] || typeof out[k] !== 'object') out[k] = {};
    }
    for (const k of ['modules', 'learned', 'memories', 'endings']) {
      if (!Array.isArray(out[k])) out[k] = [];
    }
    if (!Array.isArray(out.equippedModules)) out.equippedModules = [null, null, null];
    if (!Array.isArray(out.equippedSkills)) out.equippedSkills = [null, null, null];
    while (out.equippedModules.length < 3) out.equippedModules.push(null);
    while (out.equippedSkills.length < 3) out.equippedSkills.push(null);
    if (!out.weapons.blade) out.weapons.blade = 1;
    if (!out.weapons[out.weapon]) out.weapon = 'blade';
    out.version = VERSION;
    return out;
  }

  return {
    hasSave: () => !!read(KEY),
    load: () => migrate(read(KEY)),
    store: (d) => write(KEY, d),
    clear: () => remove(KEY),
    fresh,
    loadSettings: () => Object.assign({}, DEFAULT_SETTINGS, read(SETTINGS_KEY) || {}),
    storeSettings: (s) => write(SETTINGS_KEY, s),
    DEFAULT_SETTINGS,
  };
})();
