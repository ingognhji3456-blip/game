'use strict';

/* =========================================================
 * 영웅 성장 계산 (순수 함수) — 인연 레벨, 재능 점수·선행 검사, 장신구 수치, 판에 넘길 효과 합(GR)
 * 설계: docs/design/hero-growth.md · 데이터: js/data/growth.js
 * ========================================================= */
RG.growth = (() => {
  const G = () => RG.data.growth;
  const MOD_KEYS = ['hpPct', 'damagePct', 'atkSpeedPct', 'takenPct', 'cooldownPct', 'skillPct', 'respawnPct', 'speedPct', 'rangeAdd', 'meleeDmgPct',
    'regenPct', 'blockAdd', 'bountyPct', 'burnPct', 'slowPct', 'chainPct', 'skillBoostPct', 'towerAuraPct', 'killCdr'];

  /** 인연 경험치 → { level, into(이번 레벨에서 모은 양), need(다음 레벨까지 필요), max } */
  function levelOf(xp) {
    const B = G().bond;
    let lv = 1;
    let rest = Math.max(0, Math.floor(xp || 0));
    while (lv < B.max && rest >= B.need(lv)) { rest -= B.need(lv); lv += 1; }
    return { level: lv, into: lv >= B.max ? 0 : rest, need: lv >= B.max ? 0 : B.need(lv), max: lv >= B.max };
  }
  const points = (level) => Math.max(0, Math.min(G().bond.max, level) - 1);
  /** 판 결과로 얻는 인연 경험치 */
  function bondGain(r) {
    const B = G().bond;
    if (r.mode === 'endless') return Math.min(B.endlessMax, Math.floor((r.waves || 0) / B.endlessPer)) + (r.result === 'win' ? B.win : 0);
    if (r.result === 'win') return B.win + B.perStar * Math.max(0, r.newStars || 0);
    return B.lose;
  }

  /** 영웅의 재능 칸 id: 갈래마다 [1칸, 2칸, 3칸] */
  function branchIds(heroId, key) {
    const t = G().tree[key];
    if (key === 'sur') return t.map((n) => n.id);
    return [t[0].id, t[1].id, `${heroId}_${key}`];
  }
  function allIds(heroId) { return G().branches.flatMap((b) => branchIds(heroId, b.key)); }
  /** 재능 칸 정의 { id, name, desc, mods, unique?, branch, tier } */
  function node(heroId, id) {
    for (const b of G().branches) {
      const ids = branchIds(heroId, b.key);
      const tier = ids.indexOf(id);
      if (tier < 0) continue;
      if (tier === 2 && b.key !== 'sur') {
        const u = (G().unique[heroId] || [])[b.key === 'atk' ? 0 : 1];
        if (!u) return null;
        return Object.assign({ id, unique: true, mods: u.mods || {} }, u, { branch: b.key, tier });
      }
      return Object.assign({}, G().tree[b.key][tier], { branch: b.key, tier });
    }
    return null;
  }
  /** 칸을 찍을 수 있나: { ok, reason } */
  function canTake(heroId, talents, id, level) {
    const n = node(heroId, id);
    if (!n) return { ok: false, reason: '없는 재능' };
    if (talents.includes(id)) return { ok: false, reason: '이미 찍었습니다' };
    if (talents.length >= points(level)) return { ok: false, reason: '재능 점수가 모자랍니다' };
    if (n.tier > 0 && !talents.includes(branchIds(heroId, n.branch)[n.tier - 1])) return { ok: false, reason: '앞 칸을 먼저 찍어야 합니다' };
    return { ok: true };
  }
  /** 저장된 재능을 규칙에 맞게 정리 (점수·선행·없는 칸) — 찍은 순서대로 받아들임 */
  function cleanTalents(heroId, talents, level) {
    const out = [];
    for (const id of talents || []) if (canTake(heroId, out, id, level).ok) out.push(id);
    return out;
  }

  /** 장신구 하나의 실제 수치: 강화 단계 +20%씩, 같은 원소 영웅 +25% (정수 효과는 그대로) */
  function gearMods(id, plus, heroElement) {
    const gd = G().gear[id];
    if (!gd) return {};
    const k = (1 + G().gearPlusStep * Math.max(0, Math.min(G().gearMaxPlus, plus || 0))) * (heroElement && gd.element === heroElement ? 1 + G().gearSameElement : 1);
    const out = {};
    for (const [key, v] of Object.entries(gd.mods)) out[key] = G().flatMods.includes(key) ? v : Math.round(v * k * 10000) / 10000;
    return out;
  }
  /** 장신구 설명 글 (수치 채움) */
  function gearText(id, plus, heroElement) {
    const gd = G().gear[id];
    const m = gearMods(id, plus, heroElement);
    return gd.desc.replace(/\{(\w+)\}/g, (_, key) => {
      const v = m[key] || 0;
      if (key === 'rangeAdd' || key === 'killCdr') return String(Math.round(v * 100) / 100);
      return `${Math.round(v * 1000) / 10}%`;
    });
  }
  const upgradeCost = (id, plus) => {
    const gd = G().gear[id];
    if (!gd || plus >= G().gearMaxPlus) return null;
    return G().gearRarities[gd.rarity].costs[plus];
  };

  /**
   * 판에 넘길 효과 합: growth = { level, talents:[id], gear:[[id, plus]] }
   * 돌려줌: { hpPct …(MOD_KEYS), atkU, skU(고유 재능 정의), has(id) } — 성장이 없으면 null
   */
  function mods(heroId, growth) {
    const hd = RG.data.heroes[heroId];
    if (!growth || !hd) return null;
    const out = { talents: [] };
    for (const k of MOD_KEYS) out[k] = 0;
    const add = (m) => { for (const [k, v] of Object.entries(m || {})) if (k in out) out[k] += v; };
    const talents = cleanTalents(heroId, growth.talents, growth.level || 1);
    for (const id of talents) {
      const n = node(heroId, id);
      add(n.mods);
      if (n.unique) out[n.branch === 'atk' ? 'atkU' : 'skU'] = n;
      out.talents.push(id);
    }
    const seen = new Set();
    for (const [id, plus] of (growth.gear || []).slice(0, 2)) {
      if (seen.has(id) || !G().gear[id]) continue;
      seen.add(id);
      add(gearMods(id, plus, hd.element));
    }
    for (const [k, cap] of Object.entries(G().caps)) out[k] = Math.min(cap, out[k]);
    for (const k of MOD_KEYS) out[k] = Math.round(out[k] * 10000) / 10000;
    const set = new Set(out.talents);
    out.has = (id) => set.has(id);
    return out;
  }

  return { MOD_KEYS, levelOf, points, bondGain, branchIds, allIds, node, canTake, cleanTalents, gearMods, gearText, upgradeCost, mods };
})();
