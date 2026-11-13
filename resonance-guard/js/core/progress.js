'use strict';

/* =========================================================
 * 진행도 — 별, 맵·탑·영웅·분기 해금, 기술 나무, 본 것(도감)
 * 설계: DESIGN.md §11~12
 * ========================================================= */
RG.progress = (() => {
  const D = () => RG.data;

  function blank() {
    return { v: 1, maps: {}, skills: [], seen: { enemies: [], story: [], tips: [] }, endless: {}, lastMap: '1-1', lastHero: 'kara', gacha: blankGacha(), heroes: {}, gear: {}, shards: {}, shardLv: {}, raid: {} };
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
    if (!profile.heroes || typeof profile.heroes !== 'object') profile.heroes = {};
    if (!profile.gear || typeof profile.gear !== 'object') profile.gear = {};
    for (const k of ['shards', 'shardLv', 'raid']) if (!profile[k] || typeof profile[k] !== 'object') profile[k] = {}; // 조각 레이드
    // 영웅 성장(장신구)이 생기기 전 기록: 장신구는 도전을 처음 깰 때·무한 기록이 10·20·30·40을 넘을 때만 주므로,
    // 이미 해 둔 것만큼 한 번 채워 줌 (record()와 같은 순서·같은 시드 이름 — 결과가 늘 같음)
    if (p && !('gear' in p)) {
      for (const m of D().maps) if (profile.maps[m.id] && profile.maps[m.id].challenge) grantGear(rarityForRegion(m.region), `ch:${m.id}`);
      for (const e of D().endless || []) {
        const best = (profile.endless && profile.endless[e.id]) || 0;
        D().growth.endlessMilestones.forEach((w, i) => { if (best >= w) grantGear(['common', 'rare', 'epic', 'epic'][i], `en:${e.id}:${w}`); });
      }
    }
    // 잠깐 있었던 원정 모드(없앰)의 기록·저장된 원정 전투는 지움
    if ('expRun' in profile || 'expStats' in profile) { delete profile.expRun; delete profile.expStats; RG.save.set(RG.save.KEYS.progress, profile); }
    const savedRun = RG.save.get(RG.save.KEYS.run, null);
    if (savedRun && savedRun.opts && savedRun.opts.mode === 'expedition') RG.save.remove(RG.save.KEYS.run);
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
  // region을 따로 적은 탑(흑룡의 둥지 = 6)은 그 지역 번호를 씀 — 6은 '마지막 지역(5)을 깬 뒤'
  const towerRegion = (t) => { const td = D().towers[t]; if (!td) return 1; if (td.region) return td.region; return td.unlock ? mapRegion(td.unlock) : 1; };
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
    const wasChallenge = !!rec.challenge;
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
    // 영웅 인연 경험치 · 장신구 (docs/design/hero-growth.md)
    const heroId = st.hero && st.hero.heroId ? st.hero.heroId : st.heroId || null;
    const runWaves = mode === 'endless' ? Math.max(0, st.wave.index - (st.result === 'lose' ? 1 : 0)) : 0; // 이번 판에 버틴 웨이브 (최고 기록 아님)
    const bond = heroId && D().heroes[heroId] ? addBond(heroId, RG.growth.bondGain({ result: st.result, mode, newStars: after - before, waves: runWaves })) : null;
    const gear = [];
    if (mode === 'challenge' && st.result === 'win' && !wasChallenge) gear.push(grantGear(rarityForRegion(mapRegion(mapId)), `ch:${mapId}`));
    if (mode === 'endless') {
      const now = p.endless[mapId] || 0;
      D().growth.endlessMilestones.forEach((w, i) => { if (beforeEndless < w && now >= w) gear.push(grantGear(['common', 'rare', 'epic', 'epic'][i], `en:${mapId}:${w}`)); });
    }
    return { stars, newStars: after - before, firstClear, unlocks, reward, bond, gear };
  }

  /* ---------------- 영웅 성장 ---------------- */
  function heroRec(id) {
    const hs = get().heroes;
    if (!hs[id]) hs[id] = { xp: 0, talents: [], gear: [null, null] };
    const r = hs[id];
    if (!Array.isArray(r.talents)) r.talents = [];
    if (!Array.isArray(r.gear)) r.gear = [null, null];
    return r;
  }
  const bondOf = (id) => RG.growth.levelOf(heroRec(id).xp);
  function addBond(id, gain) {
    const r = heroRec(id);
    const before = RG.growth.levelOf(r.xp).level;
    r.xp += Math.max(0, gain);
    const now = RG.growth.levelOf(r.xp);
    save();
    return { heroId: id, gain, before, after: now.level, levelUp: now.level > before };
  }
  function takeTalent(heroId, talentId) {
    const r = heroRec(heroId);
    r.talents = RG.growth.cleanTalents(heroId, r.talents, bondOf(heroId).level);
    const ok = RG.growth.canTake(heroId, r.talents, talentId, bondOf(heroId).level);
    if (!ok.ok) return ok;
    r.talents.push(talentId);
    save();
    return { ok: true };
  }
  function resetTalents(heroId) { heroRec(heroId).talents = []; save(); }
  const talentsOf = (heroId) => RG.growth.cleanTalents(heroId, heroRec(heroId).talents, bondOf(heroId).level);
  const ownedGear = () => Object.assign({}, get().gear);
  /** 장신구 끼기/빼기: slot 0·1, gearId null = 빼기. 같은 장신구는 한 영웅의 두 칸에 함께 못 낌 */
  function equipGear(heroId, slot, gearId) {
    const r = heroRec(heroId);
    if (slot !== 0 && slot !== 1) return { ok: false, reason: '없는 칸' };
    if (gearId != null && !(gearId in get().gear)) return { ok: false, reason: '가지지 않은 장신구' };
    if (gearId != null && r.gear[1 - slot] === gearId) r.gear[1 - slot] = null;
    r.gear[slot] = gearId;
    save();
    return { ok: true };
  }
  function upgradeGear(gearId) {
    const g = get().gear;
    if (!(gearId in g)) return { ok: false, reason: '가지지 않은 장신구' };
    const cost = RG.growth.upgradeCost(gearId, g[gearId]);
    if (cost == null) return { ok: false, reason: '이미 최대로 강화했습니다' };
    if (gachaState().crystals < cost) return { ok: false, reason: '공명석이 모자랍니다' };
    gachaState().crystals -= cost;
    g[gearId] += 1;
    save();
    return { ok: true, plus: g[gearId], cost };
  }
  const rarityForRegion = (r) => (r <= 2 ? 'common' : r <= 4 ? 'rare' : 'epic');
  /** 장신구 하나 주기: 그 등급에서 아직 없는 것 중 하나(기록 문자열로 결정), 다 있으면 가장 낮은 강화 +1, 다 최대면 공명석 */
  function grantGear(rarity, seedKey) {
    const G = D().growth;
    const g = get().gear;
    const pool = G.gearOrder.filter((id) => G.gear[id].rarity === rarity);
    const fresh = pool.filter((id) => !(id in g));
    let h = 0;
    for (const ch of `${seedKey}|${Object.keys(g).length}`) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    let out;
    if (fresh.length) {
      const id = fresh[h % fresh.length];
      g[id] = 0;
      out = { id, plus: 0, isNew: true };
    } else {
      const up = pool.filter((id) => g[id] < G.gearMaxPlus).sort((a, b) => g[a] - g[b] || pool.indexOf(a) - pool.indexOf(b))[0];
      if (up) { g[up] += 1; out = { id: up, plus: g[up], isNew: false }; } else { gachaState().crystals += G.gearDupCrystals; out = { id: null, crystals: G.gearDupCrystals }; }
    }
    save();
    return out;
  }

  /* ---------------- 조각 레이드 (docs/design/raid.md) ---------------- */
  const raidOpen = () => !!mapRec(D().raid.unlockAfter).cleared;
  const shardsOf = (type) => get().shards[type] || 0;
  const shardLvOf = (type) => get().shardLv[type] || 0;
  /** 판에 넘길 조각 강화 단계 (opts.shardLv) — 하나도 없으면 null (예전 판과 같은 해시) */
  function shardLevels() {
    const out = {};
    for (const [k, v] of Object.entries(get().shardLv)) if (v > 0) out[k] = v;
    return Object.keys(out).length ? out : null;
  }
  /** 그 탑으로 깬 가장 높은 난이도 (0 = 아직) · 고를 수 있는 가장 높은 난이도 */
  const raidBest = (type) => get().raid[type] || 0;
  const raidMaxDiff = (type) => Math.min(D().raid.difficulty.length, raidBest(type) + 1);
  /** 레이드 판 결과: 조각·기록·영웅 인연 경험치 */
  function recordRaid(type, d, st) {
    const win = st.result === 'win';
    const firstClear = win && raidBest(type) < d;
    const n = RG.raid.reward(d, { win, firstClear, waves: st.wave.index, total: st.wave.total });
    const p = get();
    p.shards[type] = (p.shards[type] || 0) + n;
    if (win && firstClear) p.raid[type] = d;
    const heroId = st.hero && st.hero.heroId;
    const bond = heroId && D().heroes[heroId] ? addBond(heroId, RG.growth.bondGain({ result: st.result, mode: 'normal', newStars: 0 })) : null;
    save();
    return { shards: n, total: p.shards[type], firstClear, win, bond };
  }
  /** 조각 강화 한 단계 */
  function upgradeShard(type) {
    const lv = shardLvOf(type);
    const cost = RG.raid.shardCost(lv);
    if (cost == null) return { ok: false, reason: '이미 가장 높은 단계입니다' };
    if (shardsOf(type) < cost) return { ok: false, reason: `조각이 ${cost - shardsOf(type)}개 모자랍니다` };
    const p = get();
    p.shards[type] -= cost;
    p.shardLv[type] = lv + 1;
    save();
    return { ok: true, lv: lv + 1 };
  }

  /** 판에 넘길 성장 복사본 (opts.heroGrowth) — 재능·장신구가 하나도 없으면 null */
  function heroGrowth(heroId) {
    if (!D().heroes[heroId]) return null;
    const r = heroRec(heroId);
    const level = bondOf(heroId).level;
    const talents = RG.growth.cleanTalents(heroId, r.talents, level);
    const g = get().gear;
    const gear = r.gear.filter((id) => id && id in g).map((id) => [id, g[id]]);
    if (!talents.length && !gear.length) return null;
    return { level, talents, gear };
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
    heroRec, bondOf, addBond, takeTalent, resetTalents, talentsOf, ownedGear, equipGear, upgradeGear, grantGear, heroGrowth, rarityForRegion,
    raidOpen, shardsOf, shardLvOf, shardLevels, raidBest, raidMaxDiff, recordRaid, upgradeShard,
  };
})();
