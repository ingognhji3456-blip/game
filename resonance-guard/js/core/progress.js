'use strict';

/* =========================================================
 * 진행도 — 별, 맵·탑·영웅·분기 해금, 기술 나무, 본 것(도감)
 * 설계: DESIGN.md §11~12
 * ========================================================= */
RG.progress = (() => {
  const D = () => RG.data;

  function blank() {
    return { v: 1, maps: {}, skills: [], seen: { enemies: [], story: [], tips: [] }, endless: {}, lastMap: '1-1', lastHero: 'kara' };
  }

  let profile = null;

  function load() {
    const p = RG.save.get(RG.save.KEYS.progress, null);
    profile = p && p.v === 1 ? Object.assign(blank(), p) : blank();
    profile.seen = Object.assign({ enemies: [], story: [], tips: [] }, profile.seen || {});
    return profile;
  }
  function get() { return profile || load(); }
  function save() { RG.save.set(RG.save.KEYS.progress, get()); }
  function reset() { profile = blank(); save(); return profile; }
  function hasSave() { const p = get(); return Object.keys(p.maps).length > 0 || p.seen.story.length > 0; }

  const mapIndex = (id) => D().maps.findIndex((m) => m.id === id);
  const mapRec = (id) => get().maps[id] || {};

  /** 맵이 열렸는가: 첫 맵, 또는 바로 앞 맵을 클리어 */
  function mapUnlocked(id) {
    const i = mapIndex(id);
    if (i < 0) {
      const e = (D().endless || []).find((m) => m.id === id);
      return !!(e && e.unlockAfter && mapRec(e.unlockAfter).cleared);
    }
    if (i === 0) return true;
    return !!mapRec(D().maps[i - 1].id).cleared;
  }

  /** 이 맵에서 쓸 수 있는 탑 (해금 맵이 이 맵 이전이거나 같음) */
  function towersFor(mapId) {
    let idx = mapIndex(mapId);
    if (idx < 0) idx = mapIndex(frontierCleared());
    return D().towerOrder.filter((t) => {
      const u = mapIndex(D().towers[t].unlock);
      return u >= 0 && u <= idx;
    });
  }

  function heroesFor(mapId) {
    let idx = mapIndex(mapId);
    if (idx < 0) idx = mapIndex(frontierCleared());
    return D().heroOrder.filter((h) => {
      const u = mapIndex(D().heroes[h].unlock);
      return u >= 0 && u <= idx;
    });
  }

  function branchesUnlocked() {
    const boss = D().maps.find((m) => m.unlocksBranches);
    return !!(boss && mapRec(boss.id).cleared);
  }

  function mapStars(id) {
    const r = mapRec(id);
    return (r.stars || 0) + (r.task ? 1 : 0) + (r.challenge ? 1 : 0);
  }
  function starsTotal() {
    return Object.keys(get().maps).reduce((s, id) => s + mapStars(id), 0);
  }
  function skillCost(id) {
    const s = D().skills.find((k) => k.id === id);
    return s ? s.cost : 0;
  }
  function starsSpent() { return get().skills.reduce((s, id) => s + skillCost(id), 0); }
  function starsFree() { return starsTotal() - starsSpent(); }

  function canLearn(id) {
    const s = D().skills.find((k) => k.id === id);
    if (!s || get().skills.includes(id)) return false;
    if (s.tier > 1) {
      const prev = D().skills.find((k) => k.branch === s.branch && k.tier === s.tier - 1);
      if (prev && !get().skills.includes(prev.id)) return false;
    }
    return starsFree() >= s.cost;
  }
  function learn(id) {
    if (!canLearn(id)) return false;
    get().skills.push(id);
    save();
    return true;
  }
  function resetSkills() { get().skills = []; save(); }

  /**
   * 판 결과 기록. 반환: { stars, newStars, firstClear, unlocks: { towers:[], heroes:[], maps:[], branches } }
   */
  function record(mapId, mode, st) {
    const p = get();
    const rec = p.maps[mapId] || {};
    const before = mapStars(mapId);
    const beforeTowers = new Set(towersFor(nextMapId(mapId) || mapId));
    const beforeHeroes = new Set(heroesFor(nextMapId(mapId) || mapId));
    const wasBranches = branchesUnlocked();
    const wasCleared = !!rec.cleared;
    let stars = 0;
    if (st.result === 'win') {
      const R = D().rules;
      stars = st.lives >= R.starLives[1] ? 3 : st.lives >= R.starLives[0] ? 2 : 1;
      if (mode === 'normal') {
        rec.cleared = true;
        rec.stars = Math.max(rec.stars || 0, stars);
        if (st.task && st.task.done) rec.task = true;
        rec.bestLives = Math.max(rec.bestLives || 0, st.lives);
      } else if (mode === 'challenge') {
        rec.challenge = true;
      }
    }
    if (mode === 'endless') {
      const waves = Math.max(0, st.wave.index - (st.result === 'lose' ? 1 : 0));
      p.endless[mapId] = Math.max(p.endless[mapId] || 0, waves);
    }
    rec.plays = (rec.plays || 0) + 1;
    p.maps[mapId] = rec;
    p.lastMap = mapId;
    save();
    const after = mapStars(mapId);
    const next = nextMapId(mapId);
    const unlocks = { towers: [], heroes: [], maps: [], branches: false };
    if (st.result === 'win' && mode === 'normal' && !wasCleared) {
      if (next) {
        unlocks.maps.push(next);
        unlocks.towers = towersFor(next).filter((t) => !beforeTowers.has(t) || D().towers[t].unlock === next);
        unlocks.heroes = heroesFor(next).filter((h) => !beforeHeroes.has(h) || D().heroes[h].unlock === next);
      }
      for (const e of D().endless || []) if (e.unlockAfter === mapId) unlocks.maps.push(e.id);
      unlocks.branches = !wasBranches && branchesUnlocked();
    }
    return { stars, newStars: after - before, firstClear: st.result === 'win' && !wasCleared && mode === 'normal', unlocks };
  }

  function nextMapId(id) {
    const i = mapIndex(id);
    return i >= 0 && i + 1 < D().maps.length ? D().maps[i + 1].id : null;
  }

  function markSeen(kind, id) {
    const list = get().seen[kind];
    if (list && !list.includes(id)) { list.push(id); save(); return true; }
    return false;
  }
  function seen(kind, id) { return get().seen[kind] && get().seen[kind].includes(id); }

  /** 클리어한 맵 중 가장 뒤의 맵 (무한 모드 해금 기준) */
  function frontierCleared() {
    let last = D().maps[0].id;
    for (const m of D().maps) if (mapRec(m.id).cleared) last = m.id;
    return last;
  }

  /** 다음에 할 맵 (아직 클리어 안 한 첫 맵) */
  function frontier() {
    for (const m of D().maps) if (!mapRec(m.id).cleared) return m.id;
    return D().maps[D().maps.length - 1].id;
  }

  return {
    load, get, save, reset, hasSave, mapIndex, mapRec, mapUnlocked, towersFor, heroesFor, branchesUnlocked,
    mapStars, starsTotal, starsSpent, starsFree, canLearn, learn, resetSkills, record, nextMapId, markSeen, seen, frontier, skillCost,
  };
})();
