'use strict';

/* =========================================================
 * 공명석 웨이브 규칙 (순수 함수) — 데이터: js/data/crystal.js · 설계: docs/design/crystal.md
 * - 웨이브는 난이도에서만 정해짐(같은 난이도면 늘 같은 웨이브 — 판 재현·이어하기).
 * - 판 설정은 sim에 o.crystal로 넘김(웨이브 문자열·시작 골드). 탑은 가진 것 모두.
 * ========================================================= */
RG.crystal = (() => {
  const C = () => RG.data.crystal;
  const D = () => RG.data;
  const hash = (s) => { let h = 11; for (const ch of s) h = (h * 33 + ch.charCodeAt(0)) >>> 0; return h; };

  /** 난이도의 적 무리: 지역 무리를 합치고 숨는 적은 뺌 (숨은 적을 찾는 탑이 없어도 깰 수 있게) */
  function pool(d) {
    const out = [];
    for (const r of C().difficulty[d - 1].regions) for (const e of D().regionPools[r] || []) {
      const ed = D().enemies[e];
      if (ed && !ed.boss && !(ed.traits && ed.traits.stealth) && !out.includes(e)) out.push(e);
    }
    return out;
  }

  /** 웨이브 문자열들 (sim이 grid.parseWaves로 읽는 형식) — 웨이브 수가 많아도 마지막 웨이브가 지나치게 커지지 않게 진행 비율(f)로 늘림 */
  function waves(d) {
    const diff = C().difficulty[d - 1];
    const P = pool(d);
    const normals = P.filter((e) => !D().enemies[e].elite);
    const elites = P.filter((e) => D().enemies[e].elite);
    const N = diff.waves;
    const out = [];
    for (let i = 0; i < N; i++) {
      const f = N > 1 ? i / (N - 1) : 1;
      const last = i === N - 1;
      const groups = [];
      const nGroups = last ? 3 : f >= 0.45 ? 3 : f >= 0.2 ? 2 : 1; // 무리 수도 웨이브 번호가 아니라 진행 비율로 — 웨이브가 많은 난이도는 큰 웨이브가 늦게 옴
      for (let g = 0; g < nGroups; g++) {
        const useElite = elites.length && (last ? g === 0 : (i + g) % 4 === 3);
        const list = useElite ? elites : normals.length ? normals : P;
        const e = list[(hash(`${d}:${i}:${g}`)) % list.length];
        const n = useElite ? 1 + Math.round(3 * f) + (last ? 1 : 0) : Math.round(5 + 10 * f) + (last ? 3 : 0);
        const gap = useElite ? 1.8 : 0.8;
        groups.push(`${e}*${n}/${gap}${g ? `@${g * 3}` : ''}`);
      }
      out.push(groups.join(' ; '));
    }
    return out;
  }

  /** 웨이브마다 적 체력 배율 (뒤로 갈수록 단단하게): from + (to − from) × f^pow — pow > 1이면 앞은 천천히, 뒤에서 가파르게 */
  function ramp(d) {
    const N = C().difficulty[d - 1].waves;
    const R = C().ramp;
    const pow = R.pow || 1;
    return Array.from({ length: N }, (_, i) => Math.round((R.from + (R.to - R.from) * Math.pow(N > 1 ? i / (N - 1) : 1, pow)) * 1000) / 1000);
  }

  /** 처치 골드 배율: 적 체력 1당 버는 골드가 난이도의 gold가 되게 (체력 배율·웨이브 배율을 넣은 전체 체력 기준).
   *  골드를 적 기본값 그대로 주면 체력 배율이 낮은 어려운 난이도(지역 4~5 적: 기본 골드가 큼)가 골드를 훨씬 많이 벌어
   *  맵을 탑으로 가득 채우고 오히려 쉬워짐 (2026-11-14 검토). 웨이브 배율(ramp)만큼 골드는 늘지 않아 뒤 웨이브일수록 체력당 골드가 적음 */
  function goldMult(d) {
    const diff = C().difficulty[d - 1];
    const rp = ramp(d);
    let hp = 0;
    let gold = 0;
    RG.grid.parseWaves(waves(d)).forEach((w, i) => {
      for (const g of w.groups) {
        const ed = D().enemies[g.e];
        hp += g.n * ed.hp * diff.hp * rp[i];
        gold += g.n * ed.bounty;
      }
    });
    return gold > 0 ? Math.round((diff.gold * hp / gold) * 1000) / 1000 : 1;
  }

  /** 판 설정 조각 (게임 opts에 합침): { mapId, hpMult, crystal } */
  function setup(d) {
    const diff = C().difficulty[d - 1];
    return { mapId: diff.map, hpMult: diff.hp, crystal: { d, waves: waves(d), ramp: ramp(d), goldMult: goldMult(d), startGold: C().startGold[d - 1] } };
  }

  /** 받는 공명석: 끝까지 막으면 난이도 보상 전부, 지면 보상 × loseShare × 막아 낸 비율 (10 단위) */
  function reward(d, { win, cleared, total }) {
    const R = C().difficulty[d - 1].reward;
    if (win) return R;
    const frac = total > 0 ? Math.max(0, Math.min(1, cleared / total)) : 0;
    return Math.floor((R * C().loseShare * frac) / 10) * 10;
  }

  return { pool, waves, ramp, goldMult, setup, reward };
})();
