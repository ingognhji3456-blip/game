'use strict';

/* =========================================================
 * 탑 각성 규칙 — 데이터: js/data/awaken.js · 설계: docs/design/awaken.md
 * - 각성 조건: 그 탑의 조각 강화가 마지막 단계(5) — 도전 모드는 조각을 쓰지 않으므로 각성도 없음
 * - Lv5 spec = 고른 분기 spec + 공통 강화(공격 탑) + 탑마다 고유 능력(patch). 같은 입력이면 같은 spec(캐시)
 * ========================================================= */
RG.awaken = (() => {
  const A = () => RG.data.awaken;
  const cache = {};

  /** 피해 계열 값 모두 k배 (공격 탑 공통 강화) */
  function boost(s, k) {
    if (typeof s.damage === 'number') s.damage *= k;
    for (const [o, f] of [['zone', 'dps'], ['spikes', 'dps'], ['orbit', 'dps'], ['sweep', 'dps'], ['roller', 'dps'], ['roller', 'crush'], ['blizzard', 'dps'], ['blizzard', 'shatter'], ['snare', 'damage'], ['harvest', 'storm']]) {
      if (s[o] && typeof s[o][f] === 'number') s[o][f] *= k;
    }
    if (s.onHit && s.onHit.burn) s.onHit.burn.dps *= k;
  }

  /** 이 탑 종류에 각성이 있나 */
  const has = (type) => !!(A() && A().towers[type]);

  /** Lv5(각성) spec: 분기 spec 복사 → 공통 강화 → 고유 능력 */
  function spec(type, branch) {
    const key = `${type}:${branch}`;
    if (cache[key]) return cache[key];
    const td = RG.data.towers[type];
    const b = td.branches[branch];
    const s = JSON.parse(JSON.stringify(b));
    if (td.role === 'attack') {
      boost(s, A().base.damage);
      if (typeof s.range === 'number') s.range *= A().base.range;
    }
    A().towers[type].patch(s, branch);
    s.cost = Math.round((b.cost * A().costMult) / 10) * 10;
    s.awakened = true;
    s.name = `${b.name} · ${A().towers[type].name}`;
    cache[key] = s;
    return s;
  }

  /** 공통 강화 글 (역할별) */
  function commonText(type) {
    const role = RG.data.towers[type].role;
    if (role !== 'attack') return '';
    return `공격력 +${Math.round((A().base.damage - 1) * 100)}% · 사거리 +${Math.round((A().base.range - 1) * 100)}%`;
  }

  return { has, spec, boost, commonText };
})();
