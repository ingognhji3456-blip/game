'use strict';

/* =========================================================
 * 탑 능력치 계산 — 단계/분기, 공명(연결·효과·증폭), 지원 효과, 기술 나무
 * 설계: DESIGN.md §6, §7.2.8, §12
 * 결과는 tower.calc / tower.links / tower.effects 에 들어갑니다.
 * ========================================================= */
RG.stats = (() => {
  /** 조각 강화 단계 (조각 레이드) */
  const shardLvOf = (game, t) => (game.shards && game.shards[t.type]) || 0;
  const ORDER = () => RG.data.elementOrder;

  /** 두 원소의 공명 키 */
  function resKey(a, b) {
    if (a === b) return 'pure';
    const o = ORDER();
    return o.indexOf(a) < o.indexOf(b) ? `${a}+${b}` : `${b}+${a}`;
  }

  /** 탑의 현재 단계 spec (분기면 분기 spec) */
  function specOf(type, level, branch) {
    const def = RG.data.towers[type];
    if (level >= 4 && branch) return def.branches[branch];
    return def.levels[Math.min(level, 3) - 1];
  }

  /** 이 단계로 오르는 비용 (기술 나무 반영) */
  function costOf(type, level, branch, meta = {}) {
    const s = specOf(type, level, branch);
    let mult = 1;
    if (level === 1) mult += meta.buildCostPct || 0;
    else if (level <= 3) mult += meta.upgradeCostPct || 0;
    else mult += meta.branchCostPct || 0;
    return Math.round(s.cost * mult);
  }

  /** 탑이 "공명할 수 있는" 상태인가 */
  function canLink(t) {
    const def = RG.data.towers[t.type];
    return !def.noResonance && !t.disabled && !t.building && !t.dampened;
  }
  const isActive = (t) => !t.disabled && !t.building;

  /** 공명 mods에 배율(기술 나무 "깊은 공명")을 곱함 — 지속 시간(dur)은 그대로 */
  function scaleMods(mods, m) {
    if (!m) return mods;
    const out = {};
    for (const [k, v] of Object.entries(mods)) {
      if (typeof v === 'number') out[k] = v * (1 + m);
      else if (v && typeof v === 'object') {
        const o = {};
        for (const [kk, vv] of Object.entries(v)) o[kk] = (typeof vv === 'number' && kk !== 'dur' && kk !== 'radius') ? vv * (1 + m) : vv;
        out[k] = o;
      } else out[k] = v;
    }
    return out;
  }

  /** 한 탑에 적용되지 않는 공명 효과인가 */
  function inapplicable(def, calcTargets, resId) {
    if (def.role === 'barracks') return resId === 'sunfire' || resId === 'refraction';
    if (calcTargets === 'ground' && resId === 'refraction') return true;
    return false;
  }

  /**
   * 모든 탑의 calc를 다시 계산합니다.
   * game: { state: { towers }, tileTower: (c,r)→tower|null, meta: 기술 나무 합계, map }
   */
  function computeAll(game) {
    const towers = game.state.towers;
    const meta = game.meta || {};
    const ampPer = RG.data.supportAmpPerLink + (meta.ampPct || 0);
    const at = (c, r) => game.tileTower(c, r);

    // 1) 연결과 효과
    for (const t of towers) {
      t.links = [];
      t.effects = [];
      const def = RG.data.towers[t.type];
      if (!canLink(t)) continue;
      const set = new Set();
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (!dc && !dr) continue;
          const n = at(t.c + dc, t.r + dr);
          if (!n || !canLink(n)) continue;
          t.links.push(n.id);
          set.add(resKey(def.element, RG.data.towers[n.type].element));
        }
      }
      t.effects = [...set].sort();
    }

    // 2) 지원 탑의 증폭
    for (const t of towers) {
      const def = RG.data.towers[t.type];
      t.amp = def.role === 'support' ? t.effects.length * ampPer : 0;
    }

    // 3) 최종 계산 — 지원 탑을 먼저 계산해야 이웃이 그 수치를 읽을 수 있음
    const ordered = towers.filter((t) => RG.data.towers[t.type].role === 'support')
      .concat(towers.filter((t) => RG.data.towers[t.type].role !== 'support'));
    for (const t of ordered) {
      const def = RG.data.towers[t.type];
      const spec = specOf(t.type, t.level, t.branch);
      const c = JSON.parse(JSON.stringify(spec));
      c.element = def.element;
      c.role = def.role;
      c.kind = def.kind;
      c.targets = spec.targets || def.targets;
      c.dmgBonus = 0;
      c.speedBonus = 0;
      c.rangeBonus = meta.rangePct || 0;
      // 조각 강화(조각 레이드): 단계마다 +5%를 뽑기 강화와 같은 곳에 곱함(아래 rk), 3단계 사거리·5단계 공격 속도(공격 탑)
      const shardLv = shardLvOf(game, t);
      const sb = shardLv && RG.raid ? RG.raid.shardBonus(shardLv) : null;
      if (sb && def.role === 'attack') { c.rangeBonus += sb.rangePct; c.speedBonus += sb.speedPct; }
      // 6지역 별빛 건설지: 사거리 +15%
      if (game.map && game.map.kinds[t.r * game.map.cols + t.c] === RG.grid.T.STAR) c.rangeBonus += RG.data.rules.starRange || 0.15;
      // 그믐달 군주 '별 가리기': 잠시 사거리 감소
      if (t.veilUntil > game.state.time) c.rangeBonus -= t.veilPct || 0;
      c.critBonus = 0;
      c.mods = {};
      c.resIds = [];
      c.inapplicable = [];
      c.amp = t.amp || 0;
      c.onHit = c.onHit || {};
      // 뽑기 중복 강화: 단계마다 +6% (공격 탑은 공격력, 지원 탑은 지원 효과, 병영은 병사 체력·공격력, 광산은 수입)
      const rank = (game.ranks && game.ranks[t.type]) || 0;
      c.rank = rank;
      c.shardLv = shardLv;
      const rk = (RG.gacha ? RG.gacha.rankMult(rank) : 1) * (sb ? 1 + sb.pct : 1);
      if (rk !== 1) {
        if (def.role === 'economy') { if (c.income) c.income = Math.round(c.income * rk); }
        else if (def.role === 'barracks') {
          if (c.soldiers) { c.soldiers = Object.assign({}, c.soldiers); c.soldiers.hp *= rk; if (c.soldiers.damage) c.soldiers.damage *= rk; }
        } else if (def.role !== 'support') c.dmgBonus += rk - 1;
      }

      if (def.role === 'support') {
        // 증폭: 지원 수치 × (1 + amp) × 중복 강화
        const k = (1 + c.amp) * rk;
        if (c.aura) {
          for (const key of ['damagePct', 'speedPct', 'rangePct', 'critChance']) if (c.aura[key]) c.aura[key] *= k;
          if (c.aura.burnOnHit) c.aura.burnOnHit.pct *= k;
          if (c.aura.zapEvery) c.aura.zapEvery.damage *= k;
        }
        if (c.heal) c.heal.hps *= k;
        if (c.discharge) c.discharge.damage *= k;
        c.resIds = t.effects.slice();
      } else if (def.role !== 'economy') {
        // 공명 효과
        for (const key of t.effects) {
          const res = RG.data.resonance[key];
          if (inapplicable(def, c.targets, res.id)) { c.inapplicable.push(res.id); continue; }
          c.resIds.push(res.id);
          let mods = res.mods;
          if (key === 'pure' && meta.purePct) mods = { damagePct: mods.damagePct + meta.purePct };
          mods = scaleMods(mods, meta.resonanceMult || 0);
          for (const [mk, mv] of Object.entries(mods)) {
            if (mk === 'damagePct') c.dmgBonus += mv;
            else if (mk === 'speedPct') c.speedBonus += mv;
            else if (mk === 'rangePct') c.rangeBonus += mv;
            else if (mk === 'slowOnHit' && c.mods.slowOnHit) {
              // 영구 동토 + 중력: 더 강한 쪽
              if (mv.pct > c.mods.slowOnHit.pct) c.mods.slowOnHit = mv;
            } else c.mods[mk] = mv;
          }
        }
        const nRes = c.resIds.length;
        if (nRes >= 3 && meta.tripleDamagePct) c.dmgBonus += meta.tripleDamagePct;
        if (nRes >= 4 && meta.quadSpeedPct) c.speedBonus += meta.quadSpeedPct;
        if (t.level >= 4 && meta.branchDamagePct) c.dmgBonus += meta.branchDamagePct;

        // 이웃 지원 탑 효과 (같은 종류는 가장 강한 하나만)
        const best = {};
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (!dc && !dr) continue;
            const n = at(t.c + dc, t.r + dr);
            if (!n || !isActive(n) || !isActive(t)) continue;
            const nd = RG.data.towers[n.type];
            if (nd.role !== 'support' || !n.calc || !n.calc.aura) continue;
            const a = n.calc.aura;
            for (const key of ['damagePct', 'speedPct', 'rangePct', 'critChance']) {
              if (a[key] && (!best[key] || a[key] > best[key].v)) best[key] = { v: a[key], from: n.id };
            }
            if (a.burnOnHit && (!best.burnOnHit || a.burnOnHit.pct > best.burnOnHit.v.pct)) best.burnOnHit = { v: a.burnOnHit, from: n.id };
            if (a.zapEvery && (!best.zapEvery || a.zapEvery.damage > best.zapEvery.v.damage)) best.zapEvery = { v: a.zapEvery, from: n.id };
          }
        }
        c.auras = {};
        if (best.damagePct) { c.dmgBonus += best.damagePct.v; c.auras.damagePct = best.damagePct.v; }
        if (best.speedPct) { c.speedBonus += best.speedPct.v; c.auras.speedPct = best.speedPct.v; }
        if (best.rangePct && def.role !== 'barracks') { c.rangeBonus += best.rangePct.v; c.auras.rangePct = best.rangePct.v; }
        if (best.critChance) { c.critBonus += best.critChance.v; c.auras.critChance = best.critChance.v; }
        if (best.burnOnHit) {
          const cur = c.mods.burnOnHit;
          if (!cur || best.burnOnHit.v.pct > cur.pct) c.mods.burnOnHit = best.burnOnHit.v;
          c.auras.burnOnHit = best.burnOnHit.v;
        }
        if (best.zapEvery) { c.mods.zap = best.zapEvery.v; c.auras.zapEvery = best.zapEvery.v; }
      }

      // 최종 수치
      if (c.range) c.range *= 1 + (def.role === 'barracks' ? 0 : c.rangeBonus);
      if (c.rallyRange) c.rallyRange *= 1 + (meta.rangePct || 0);
      if (c.interval) c.interval /= 1 + c.speedBonus;
      if (c.soldiers) {
        c.soldiers = Object.assign({}, c.soldiers);
        c.soldiers.interval /= 1 + c.speedBonus;
      }
      if (c.kind === 'beam') c.dps = c.damage * (1 + c.speedBonus);
      if (c.kind === 'sweep' && c.sweep) { c.sweepDps = c.sweep.dps * (1 + c.speedBonus); if (c.detect) c.detect *= 1 + c.rangeBonus; }
      c.crit = c.crit ? { chance: c.crit.chance + c.critBonus, mult: c.crit.mult } : (c.critBonus ? { chance: c.critBonus, mult: 2 } : null);
      t.calc = c;
    }
  }

  return { resKey, specOf, costOf, computeAll, canLink, isActive };
})();
