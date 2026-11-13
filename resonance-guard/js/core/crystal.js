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

  /** 웨이브 문자열들 (sim이 grid.parseWaves로 읽는 형식) */
  function waves(d) {
    const diff = C().difficulty[d - 1];
    const P = pool(d);
    const normals = P.filter((e) => !D().enemies[e].elite);
    const elites = P.filter((e) => D().enemies[e].elite);
    const N = diff.waves;
    const out = [];
    for (let i = 0; i < N; i++) {
      const last = i === N - 1;
      const groups = [];
      const nGroups = last ? 3 : 1 + Math.min(2, Math.floor(i / 3));
      for (let g = 0; g < nGroups; g++) {
        const useElite = elites.length && (last ? g === 0 : (i + g) % 4 === 3);
        const list = useElite ? elites : normals.length ? normals : P;
        const e = list[(hash(`${d}:${i}:${g}`)) % list.length];
        const n = useElite ? Math.max(1, Math.round(1 + i * 0.25 + (last ? 1 : 0))) : Math.round(5 + i * 0.9 + (last ? 3 : 0));
        const gap = useElite ? 1.8 : 0.8;
        groups.push(`${e}*${n}/${gap}${g ? `@${g * 3}` : ''}`);
      }
      out.push(groups.join(' ; '));
    }
    return out;
  }

  /** 판 설정 조각 (게임 opts에 합침): { mapId, hpMult, crystal } */
  function setup(d) {
    const diff = C().difficulty[d - 1];
    return { mapId: diff.map, hpMult: diff.hp, crystal: { d, waves: waves(d), startGold: C().startGold[d - 1] } };
  }

  /** 받는 공명석: 끝까지 막으면 난이도 보상 전부, 지면 보상 × loseShare × 막아 낸 비율 (10 단위) */
  function reward(d, { win, cleared, total }) {
    const R = C().difficulty[d - 1].reward;
    if (win) return R;
    const frac = total > 0 ? Math.max(0, Math.min(1, cleared / total)) : 0;
    return Math.floor((R * C().loseShare * frac) / 10) * 10;
  }

  return { pool, waves, setup, reward };
})();
