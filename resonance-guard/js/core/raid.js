'use strict';

/* =========================================================
 * 조각 레이드 규칙 (순수 함수) — 설계: docs/design/raid.md · 데이터: js/data/raid.js
 * - 웨이브는 (탑, 난이도, 영웅)에서 정해짐: 그 탑이 칠 수 없는 적(원소 면역·흡수, 공중을 못 치면 비행)은 빼서
 *   "그 탑 하나로" 깰 수 있는 판만 나오게. 같은 입력이면 늘 같은 웨이브.
 * - 판 설정은 sim에 o.raid로 넘김(웨이브 문자열·시작 골드·지원 탑이면 영웅 강화) — 판은 결정적.
 * - 조각 강화 단계의 효과 수치는 shardBonus(단계)로 (stats.js가 씀).
 * ========================================================= */
RG.raid = (() => {
  const R = () => RG.data.raid;
  const D = () => RG.data;

  /** 조각 강화 단계(0~5)의 효과: { pct: 공격력·지원 효과 등 +%, rangePct, speedPct } */
  function shardBonus(lv) {
    const S = R().shard;
    const l = Math.max(0, Math.min(S.max, lv || 0));
    return { pct: l * S.levelPct, rangePct: l >= S.rangeAt ? S.rangePct : 0, speedPct: l >= S.speedAt ? S.speedPct : 0 };
  }
  /** 다음 단계에 드는 조각 (최대면 null) */
  function shardCost(lv) {
    const S = R().shard;
    return (lv || 0) >= S.max ? null : S.cost[lv || 0];
  }

  /** 지원·경제 탑: 영웅이 싸우는 레이드 */
  const isSupport = (type) => ['support', 'economy'].includes(D().towers[type].role);
  /** 이 레이드에서 공중을 칠 수 있나: 공격 탑·병영은 그 탑, 지원·경제 탑은 영웅 */
  function canAir(type, heroId) {
    const td = D().towers[type];
    if (isSupport(type)) { const hd = heroId && D().heroes[heroId]; return !!hd && hd.targets !== 'ground'; }
    if (td.role === 'barracks') return false; // 병사는 비행 적을 붙잡지 못함
    const tg = td.levels[0].targets || td.targets;
    return tg !== 'ground';
  }
  /** 이 탑(지원이면 영웅)의 원소에 면역·흡수인 적은 뺌 */
  function hitsEnemy(type, heroId, enemyId) {
    const ed = D().enemies[enemyId];
    if (!ed) return false;
    const el = isSupport(type) ? (D().heroes[heroId] || {}).element : D().towers[type].element;
    const a = el && ed.affinity[el];
    return a !== 'immune' && a !== 'absorb';
  }
  // 이름 → 작은 정수 (탑마다 적 순서를 조금 다르게, 결정적)
  const hash = (s) => { let h = 7; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };

  /** 웨이브 문자열들 (sim이 grid.parseWaves로 읽는 형식) */
  function waves(type, d, heroId) {
    const diff = R().difficulty[d - 1];
    const P = R().pool;
    const air = canAir(type, heroId);
    const pick = (cat, i) => {
      if (cat === 'armored' && isSupport(type)) return null; // 영웅 혼자 갑옷 적은 무리
      const list = P[cat].filter((e) => hitsEnemy(type, heroId, e) && (cat !== 'flying' || air));
      return list.length ? list[(i + hash(type)) % list.length] : null;
    };
    const N = diff.waves;
    const out = [];
    const SH = R().supportHero;
    const sup = isSupport(type);
    for (let i = 0; i < N; i++) {
      const f = N > 1 ? i / (N - 1) : 1;
      const groups = [];
      const add = (cat, n, iv, delay, spawn = 0) => {
        const e = pick(cat, i);
        if (sup) { n = Math.max(1, Math.round(n * SH.countMult)); iv = Math.round(iv * SH.gapMult * 100) / 100; } // 지원 탑 레이드: 적게·띄엄띄엄
        if (e && n > 0) groups.push(`${e}*${n}/${iv}${delay ? `@${delay}` : ''}${spawn ? `>${spawn}` : ''}`);
      };
      if (i === N - 1) {
        // 마지막 웨이브: 큰 적 + 호위
        add('big', 2 + Math.floor(d / 2), 2.4);
        add('normal', 6 + d, 0.9, 4);
        if (d >= 3) add('armored', 2 + Math.floor(d / 2), 1.8, 8);
        if (air) add('flying', 3 + d, 0.9, 10);
      } else {
        const cat = ['swarm', 'normal', 'swarm', 'normal', 'big'][i % 5];
        const base = { swarm: 7, normal: 4, big: 1 }[cat];
        add(cat, Math.round(base * (1 + f * 1.6)), cat === 'swarm' ? 0.55 : cat === 'normal' ? 1.1 : 2.2);
        if (i % 3 === 2 && d >= 3) add('armored', 1 + Math.floor(f * 3), 1.9, 5);
        if (air && i % 4 === 1) add('flying', 3 + Math.floor(f * 4), 1, 4);
        if (i >= 2 && cat !== 'normal') add('normal', 2 + Math.floor(f * 3), 1.2, 6);
      }
      out.push(groups.join(' ; '));
    }
    return out;
  }

  /** 탑마다 적 체력 보정 (탑 하나만 쓰므로 탑 세기 차이를 메움 — tools/raid-balance.js --calibrate) */
  const towerScale = (type) => (R().towerHp && R().towerHp[type]) || 1;
  /** 지원·경제 탑 레이드에서 영웅마다 적 체력 보정 (영웅이 싸우므로 영웅 세기 차이를 메움 — --calibrate-heroes) */
  const heroScale = (heroId) => (R().supportHero.heroHp && R().supportHero.heroHp[heroId]) || 1;

  /** 판 설정 조각 (게임 opts에 합침): { mapId, hpMult, towers, raid } */
  function setup(type, d, heroId) {
    const diff = R().difficulty[d - 1];
    const td = D().towers[type];
    const support = isSupport(type);
    return {
      mapId: diff.map,
      hpMult: Math.round(diff.hp * (support ? R().supportHero.hpMult * heroScale(heroId) : 1) * towerScale(type) * 1000) / 1000,
      towers: [type],
      raid: {
        tower: type, d, support,
        waves: waves(type, d, heroId),
        startGold: td.levels[0].cost * R().goldPerCost + R().goldBase,
        bountyMult: support ? Math.round(100 / R().supportHero.countMult) / 100 : 0,
      },
    };
  }

  /** 판 결과 → 조각: 이기면 난이도 보상(그 탑으로 그 난이도를 처음 깨면 두 배), 지면 절반 넘게 버텼을 때 1 */
  function reward(d, { win, firstClear, waves: w, total }) {
    if (win) return R().difficulty[d - 1].reward * (firstClear ? R().firstClearMult : 1);
    return w >= Math.ceil(total / 2) ? R().loseShards : 0;
  }

  return { shardBonus, shardCost, isSupport, canAir, hitsEnemy, waves, towerScale, heroScale, setup, reward };
})();
