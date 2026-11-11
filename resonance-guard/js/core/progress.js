'use strict';

/* =========================================================
 * 진행도 — 별, 맵·탑·영웅·분기 해금, 기술 나무, 본 것(도감)
 * 설계: DESIGN.md §11~12
 * ========================================================= */
RG.progress = (() => {
  const D = () => RG.data;

  function blank() {
    return { v: 1, maps: {}, skills: [], seen: { enemies: [], story: [], tips: [] }, endless: {}, lastMap: '1-1', lastHero: 'kara', gacha: blankGacha() };
  }
  /** 뽑기 상태: 가진 탑과 강화 단계, 공명석, 천장 */
  function blankGacha() {
    const owned = {};
    for (const t of RG.gacha.BASIC) owned[t] = 0;
    return { owned, crystals: RG.gacha.START_CRYSTALS, pity: 0, pulls: 0 };
  }

  let profile = null;

  function load() {
    const p = RG.save.get(RG.save.KEYS.progress, null);
    profile = p && p.v === 1 ? Object.assign(blank(), p) : blank();
    profile.seen = Object.assign({ enemies: [], story: [], tips: [] }, profile.seen || {});
    if (!p || !p.gacha) {
      // 뽑기가 생기기 전 기록: 그때까지 해금했던 탑은 그대로 가진 것으로 (빼앗지 않음)
      const g = blankGacha();
      if (p) for (const t of towersFor(frontier())) if (!(t in g.owned)) g.owned[t] = 0;
      profile.gacha = g;
      if (p) RG.save.set(RG.save.KEYS.progress, profile);
    }
    if (profile.gacha.tickets) {
      // 잠깐 있었던 "새 탑 확정권"은 없앰(스테이지는 뽑기에 탑을 넣기만 함) — 남은 장수는 공명석으로 바꿔 줌
      profile.gacha.crystals += profile.gacha.tickets * RG.gacha.TICKET_TO_CRYSTALS;
      delete profile.gacha.tickets;
      RG.save.set(RG.save.KEYS.progress, profile);
    } else if ('tickets' in profile.gacha) delete profile.gacha.tickets;
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

  /* ---------------- 뽑기 ---------------- */
  const gachaState = () => get().gacha;
  /** 가진 탑 (설계서 순서) */
  function ownedTowers() { const o = gachaState().owned; return D().towerOrder.filter((t) => t in o); }
  const ownsTower = (t) => t in gachaState().owned;
  const towerRank = (t) => (ownsTower(t) ? gachaState().owned[t] : -1);
  /** 판에 넘길 강화 단계 묶음 (명령 재현이 같도록 판 시작 때 복사해 둠) */
  function towerRanks() { return Object.assign({}, gachaState().owned); }
  /*
   * 뽑기에 들어오는 때 (2026-11-11 개정, 사용자 요청): 스테이지마다 하나씩이 아니라 **지역 단위로 한꺼번에**.
   *  - 1지역(솔빛 들판) 탑은 처음부터 뽑기에 들어 있음
   *  - n지역 탑은 n−1지역의 마지막 맵을 깨면 한꺼번에 들어옴 (예: 솔빛 들판을 깨면 서리 고개 탑 전부)
   *  - 들어와도 탑을 주지는 않음(뽑아야 얻음). 최종 강화한 탑은 뽑기에서 빠짐
   */
  const mapRegion = (id) => { const m = D().maps.find((q) => q.id === id); return m ? m.region : 1; };
  /** 이 지역을 다 깼나 (그 지역 마지막 맵 클리어) */
  function regionCleared(r) {
    const ms = D().maps.filter((m) => m.region === r);
    return ms.length > 0 && !!mapRec(ms[ms.length - 1].id).cleared;
  }
  /** 이 탑이 뽑기에 들어오는 지역 (그 탑이 처음 나오는 맵의 지역) */
  const towerRegion = (t) => (D().towers[t] && D().towers[t].unlock ? mapRegion(D().towers[t].unlock) : 1);
  /** 뽑기에 열렸나 (최종 강화 여부와 상관없이) */
  function towerOpen(t) {
    if (RG.gacha.BASIC.includes(t)) return true;
    const r = towerRegion(t);
    return r <= 1 || regionCleared(r - 1);
  }
  /** 열린 탑 전부 (최종 강화한 탑 포함) */
  function towersOpen() { return D().towerOrder.filter(towerOpen); }
  /** 지금 뽑기에서 나올 수 있는 탑 (열렸고, 최종 강화하지 않은 탑) */
  function gachaPool() {
    const o = gachaState().owned;
    return towersOpen().filter((t) => !RG.gacha.isFinal(o[t]));
  }
  const inPool = (t) => gachaPool().includes(t);
  const towerFinal = (t) => RG.gacha.isFinal(gachaState().owned[t]);
  function pullGacha(kind, rng) {
    const res = RG.gacha.pull(gachaState(), kind, rng, gachaPool());
    if (res.ok) { gachaState().pulls = (gachaState().pulls || 0) + res.results.length; save(); }
    return res;
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
    const beforeEndless = p.endless[mapId] || 0;
    const beforePool = new Set(towersOpen());
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
    // 공명석·새 탑 확정권
    const firstClear = st.result === 'win' && !wasCleared && mode === 'normal';
    const reward = RG.gacha.rewardFor({ result: st.result, mode, firstClear, newStars: after - before, endlessGain: mode === 'endless' ? (p.endless[mapId] || 0) - beforeEndless : 0 });
    // 지역을 깨서 뽑기에 새로 들어온 탑 (주는 것은 아님)
    reward.pooled = towersOpen().filter((t) => !beforePool.has(t));
    p.gacha.crystals += reward.crystals;
    save();
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
    return { stars, newStars: after - before, firstClear, unlocks, reward };
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
    gachaState, ownedTowers, ownsTower, towerRank, towerRanks, gachaPool, inPool, pullGacha, towersOpen, towerOpen, towerRegion, regionCleared, towerFinal,
    mapStars, starsTotal, starsSpent, starsFree, canLearn, learn, resetSkills, record, nextMapId, markSeen, seen, frontier, skillCost,
  };
})();
