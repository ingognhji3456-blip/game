'use strict';

/* =========================================================
 * 한 판의 시뮬레이션 — 결정적(시드 난수만 사용), DOM 없음
 * 설계: DESIGN.md §4~§12, 엔진 규칙 §7.2
 * API: ARCHITECTURE.md §4
 * ========================================================= */
RG.sim = (() => {
  const DT = 1 / 30;
  const U = () => RG.util;
  // 데이터 참조는 판을 만들 때 한 번 잡아 둠 (매 틱 수만 번 부르므로 전역 RG를 찾는 비용이 큼)
  let DATA = null;
  const D = () => DATA || RG.data;

  /* ---------------- 도우미 ---------------- */
  const d2 = (ax, ay, bx, by) => (ax - bx) * (ax - bx) + (ay - by) * (ay - by);
  /** 배열에서 조건에 맞는 것만 남김(제자리, 순서 유지) */
  function compact(arr, keep) {
    let j = 0;
    for (let i = 0; i < arr.length; i++) { const v = arr[i]; if (keep(v)) { if (j !== i) arr[j] = v; j++; } }
    if (j !== arr.length) arr.length = j;
    return arr;
  }
  const dist = (ax, ay, bx, by) => Math.sqrt(d2(ax, ay, bx, by));

  /** 선분(ax,ay)-(bx,by)과 점의 거리 */
  function segDist(px, py, ax, ay, bx, by) {
    const vx = bx - ax;
    const vy = by - ay;
    const L = vx * vx + vy * vy;
    let t = L ? ((px - ax) * vx + (py - ay) * vy) / L : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    return dist(px, py, ax + vx * t, ay + vy * t);
  }

  /** 기술 나무 효과 합계 */
  function sumSkills(ids) {
    const meta = {};
    for (const id of ids || []) {
      const s = D().skills.find((k) => k.id === id);
      if (!s) continue;
      for (const [k, v] of Object.entries(s.effect)) meta[k] = (meta[k] || 0) + v;
    }
    return meta;
  }

  function findMapDef(id) {
    return D().maps.find((m) => m.id === id) || (D().endless || []).find((m) => m.id === id);
  }

  /* =====================================================
   * 생성
   * ===================================================== */
  function create(opts) {
    DATA = RG.data;
    const o = Object.assign({ mode: 'normal', heroId: null, skills: [], seed: 1 }, opts);
    const def = findMapDef(o.mapId);
    if (!def) throw new Error(`맵 없음: ${o.mapId}`);
    const rules = D().rules;
    const challenge = o.mode === 'challenge' ? (def.challenge || null) : null;
    const meta = (o.mode === 'challenge') ? {} : sumSkills(o.skills);
    const map = RG.grid.parseMap(def);
    const waves = o.mode === 'endless' ? [] : RG.grid.parseWaves(def.waves);
    const rng = U().makeRng(o.seed >>> 0);
    const n = map.cols * map.rows;

    const st = {
      tick: 0, time: 0, mapId: def.id, mode: o.mode, map,
      gold: Math.round(def.startGold * (1 + (meta.startGoldPct || 0))),
      lives: challenge && challenge.type === 'lives' ? challenge.value : rules.lives,
      maxLives: rules.lives,
      result: null,
      wave: { index: 0, total: o.mode === 'endless' ? Infinity : waves.length, countdown: null, started: false, queue: [], bonusBase: 0 },
      towers: [], enemies: [], units: [], projectiles: [], zones: [], traps: [], beams: [],
      hero: null,
      events: [],
      stats: { damageByTower: {}, kills: 0, leaked: 0, goldEarned: 0, heroDamage: 0, resonanceSeen: {} },
      task: def.task ? { def: def.task, done: false, best: 0 } : null,
      warnings: [],                         // 데이터 경고(알 수 없는 적 등)
      alerts: [],                           // 보스 경고(1.5초 뒤 탑 멈춤) — 그리기용
      linksFrozenUntil: 0,
      leakShield: meta.leakShield || 0,
      maxTicks: o.mode === 'endless' ? Infinity : 30 * 60 * 40, // 무한 모드는 시간 제한 없음
    };

    const blocked = new Uint8Array(n);       // 탑이 있는 칸
    const tileTowers = new Array(n).fill(null);
    const soldTile = new Float64Array(n);    // 판 칸 재건설 가능 시각
    let flow = map.baseDist;
    let nextId = 1;
    let statsDirty = true;
    const delayed = [];
    const log = [];
    const unlocked = o.towers ? new Set(o.towers) : null;  // null = 전부
    const branchesOk = o.branches !== false;

    // 뽑기 중복 강화 단계 {탑: 0~5} — 도전 모드는 기술 나무처럼 쓰지 않음(순수 실력)
    const ranks = o.mode === 'challenge' ? {} : Object.assign({}, o.towerRanks || {});
    const game = {
      opts: o, def, map, rules, meta, ranks, challenge, state: st, log, DT,
      tileTower: (c, r) => (c >= 0 && r >= 0 && c < map.cols && r < map.rows ? tileTowers[r * map.cols + c] : null),
    };

    /* ---------------- 이벤트 ---------------- */
    const ev = (type, data) => {
      st.events.push(Object.assign({}, data, { type }));   // type은 항상 이벤트 종류
      // 보스가 능력을 쓰는 순간은 시전 자세로 (그림용)
      if (type === 'bossAbility' && data && data.enemyId) { const b = st.enemies.find((q) => q.id === data.enemyId); if (b) b.castAnim = 0.6; }
    };

    /* ---------------- 영웅 ---------------- */
    function heroStat(h) {
      const hd = D().heroes[h.heroId];
      const lv = h.level - 1;
      const k = 1 + D().heroLevelBonus.stat * lv;
      return {
        maxHp: hd.hp * k * (1 + (meta.heroHpPct || 0)),
        damage: hd.damage * k * (1 + (meta.heroDamagePct || 0)),
        skillK: (1 + D().heroLevelBonus.skill * lv) * (1 + (meta.heroDamagePct || 0)),
      };
    }

    function heroStartTile() {
      // 울림등에서 입구 쪽으로 길을 따라 1/3 지점 근처의 걸을 수 있는 칸
      const s = map.spawns[0];
      let c = s.c;
      let r = s.r;
      const total = flow[r * map.cols + c];
      let guard = 0;
      while (flow[r * map.cols + c] > total * 0.45 && guard++ < 200) {
        const nx = RG.grid.nextStep(map, flow, blocked, c, r, 0);
        if (!nx) break;
        c = nx.c; r = nx.r;
      }
      return { c, r };
    }

    function createHero() {
      if (!o.heroId || (challenge && (challenge.type === 'noHero'))) return;
      const hd = D().heroes[o.heroId];
      if (!hd) return;
      if (challenge && challenge.type === 'noBlock' && hd.melee) return;
      const tile = heroStartTile();
      const h = {
        id: nextId++, kind: 'hero', heroId: o.heroId, x: tile.c + 0.5, y: tile.r + 0.5, px: 0, py: 0,
        level: Math.max(1, meta.heroStartLevel || 1), xp: 0, hp: 0, maxHp: 0, armor: hd.armor,
        cd: 0, skillCd: 0, path: [], blocking: [], block: hd.block, downUntil: 0, dead: false, dir: 1, attackAnim: 0,
        regenT: 0,
      };
      if (h.level > 1) h.xp = D().heroXp[h.level - 1];
      const s = heroStat(h);
      h.maxHp = s.maxHp; h.hp = h.maxHp;
      st.units.push(h);
      st.hero = h;
    }

    function heroXp(e, full) {
      const h = st.hero;
      if (!h || h.dead) return;
      const ed = D().enemies[e.type];
      let xp = ed.boss ? 10 : ed.elite ? 3 : 1;
      if (!full) xp *= 0.5;
      h.xp += xp;
      const table = D().heroXp;
      while (h.level < table.length && h.xp >= table[h.level]) {
        const ratio = h.hp / h.maxHp;
        h.level += 1;
        const s = heroStat(h);
        h.maxHp = s.maxHp;
        h.hp = Math.min(h.maxHp, h.maxHp * ratio + h.maxHp * 0.2);
        ev('heroLevel', { heroId: h.heroId, level: h.level });
      }
    }

    /* =====================================================
     * 상태 이상
     * ===================================================== */
    function hardCC(e, kind, dur) {
      if (e.dead || e.burrowed) return false;
      const ed = D().enemies[e.type];
      if (ed.boss) {
        if (kind === 'stun' || kind === 'lift' || kind === 'fear') return false; // 보스는 겁먹지 않음
        dur *= kind === 'freeze' ? 0.3 : kind === 'root' ? 0.2 : 1;
      }
      if (st.time < e.ccUntil) return false;
      if (st.time < e.ccImmuneUntil) return false;
      const R = rules.hardCc;
      e.ccLog = e.ccLog.filter((t) => st.time - t < R.window);
      const k = e.ccLog.length;
      if (k >= R.mults.length) {
        e.ccImmuneUntil = st.time + R.immune;
        e.ccLog = [];
        return false;
      }
      dur *= R.mults[k];
      e.ccLog.push(st.time);
      e.ccUntil = st.time + dur;
      e.ccKind = kind;
      if (kind === 'lift' || kind === 'fear') releaseEnemy(e);
      return true;
    }
    const isHardCC = (e) => st.time < e.ccUntil;
    const isFeared = (e) => st.time < e.ccUntil && e.ccKind === 'fear';
    const canMove = (e) => !isHardCC(e);
    const canAct = (e) => !(isHardCC(e) && e.ccKind !== 'root');

    function applySlow(e, pct, dur) {
      const ed = D().enemies[e.type];
      if (ed.boss) pct *= 0.5;
      const s = e.st;
      if (st.time >= s.slowUntil || pct > s.slowPct + 1e-9) { s.slowPct = pct; s.slowUntil = st.time + dur; } else if (Math.abs(pct - s.slowPct) < 1e-9) s.slowUntil = Math.max(s.slowUntil, st.time + dur);
    }
    /** 땅 적이 지나는 칸 모음 (입구마다 갈림길 lane 3개) — 흐름장이 바뀔 때만 다시 계산 */
    let routeCache = null;
    let routeFlow = null;
    function routeSet() {
      if (routeCache && routeFlow === flow) return routeCache;
      const set = new Set();
      for (const s0 of map.spawns) {
        for (let lane = 0; lane < 3; lane++) {
          let c = s0.c;
          let r = s0.r;
          for (let guard = 0; guard < map.cols * map.rows; guard++) {
            set.add(r * map.cols + c);
            const nx = RG.grid.nextStep(map, flow, blocked, c, r, lane);
            if (!nx) break;
            c = nx.c; r = nx.r;
          }
        }
      }
      routeCache = set;
      routeFlow = flow;
      return set;
    }

    /** 장판(공허 구슬 등) 감속 중 가장 센 것 */
    function zoneSlowOf(e) {
      let best = 0;
      if (!st.zones.length) return 0;
      for (const z of st.zones) {
        if (!z.slowPct || st.time > z.until) continue;
        if (z.kind !== 'void' && e.flying) continue;
        if (d2(z.x, z.y, e.x, e.y) <= z.radius * z.radius) best = Math.max(best, D().enemies[e.type].boss ? z.slowPct * 0.5 : z.slowPct);
      }
      return best;
    }
    const isSlowed = (e) => st.time < e.st.slowUntil || isHardCC(e) || zoneSlowOf(e) > 0;

    function addShred(e, key, pct, max, dur) {
      const ed = D().enemies[e.type];
      const res = ed.traits.shredResist || 0;
      const cur = e.st.shreds[key];
      const live = cur && st.time < cur.until ? cur.pct : 0;
      e.st.shreds[key] = { pct: Math.min(max * (1 - res), live + pct * (1 - res)), until: st.time + dur };
    }
    function shredTotal(e) {
      let s = 0;
      for (const v of Object.values(e.st.shreds)) if (st.time < v.until) s += v.pct;
      return s;
    }
    function addDot(e, kind, key, dps, dur, element, src) {
      const list = kind === 'burn' ? e.st.burns : e.st.bleeds;
      const cur = list.find((b) => b.key === key);
      if (cur) { cur.dps = Math.max(cur.dps, dps); cur.until = st.time + dur; cur.element = element; cur.src = src; } else list.push({ key, dps, until: st.time + dur, element, src });
    }
    function applyCurse(e, pct, dur, spread) {
      const c = e.st.curse;
      if (!c || st.time >= c.until || pct >= c.pct) e.st.curse = { pct, until: st.time + dur, spread: spread || (c && st.time < c.until ? c.spread : null) };
    }

    /* =====================================================
     * 피해
     * ===================================================== */
    function affinityOf(e, element) {
      if (e.immuneEls) return e.immuneEls.includes(element) ? 'immune' : null;   // 페이즈마다 면역이 바뀌는 보스
      const ed = D().enemies[e.type];
      return ed.affinity[element] || null;
    }

    /** 이 원소로 이 적을 공격할 가치가 있는가(면역·흡수 제외) */
    const attackable = (e, element) => {
      const a = affinityOf(e, element);
      return a !== 'immune' && a !== 'absorb';
    };

    function targetable(e) {
      return !e.dead && !e.burrowed && !(e.invulnUntil > st.time) && (e.revealed || !e.stealth);
    }

    /**
     * 피해를 줍니다. src: { tower, unit, calc, heroHit }  o: { dot, secondary, crit, shieldMult, area }
     * 반환: 실제로 깎은 양
     */
    let lastAttackSide = 0;
    function damage(e, base, element, src, o2 = {}) {
      lastAttackSide = 0;
      if (e.dead || e.burrowed || e.invulnUntil > st.time || base <= 0) return 0;
      const ed = D().enemies[e.type];
      const aff = affinityOf(e, element);
      if (aff === 'immune' || (aff === 'absorb' && (o2.area || o2.secondary || o2.dot))) {
        if (!o2.dot && !o2.quiet) ev('immune', { x: e.x, y: e.y, targetId: e.id });
        return 0;
      }
      if (aff === 'absorb') {
        const heal = Math.min(e.maxHp - e.hp, base);
        e.hp += heal;
        ev('absorb', { x: e.x, y: e.y, amount: heal, targetId: e.id });
        return 0;
      }
      const calc = src && src.calc;
      const mods = (calc && calc.mods) || {};
      // 지속 피해(화상·출혈·장판)는 걸 때 이미 공격 보너스를 곱했으므로 틱에서는 다시 곱하지 않음
      let bonus = (calc && !o2.dot && calc.dmgBonus) || 0;
      if (calc && !o2.dot) {
        if (mods.bonusVsControlled && isHardCC(e)) bonus += mods.bonusVsControlled;
        if (calc.onHit && calc.onHit.bonusVsSlowed && isSlowed(e)) bonus += calc.onHit.bonusVsSlowed;
        if (mods.bonusVsFlying && e.flying) bonus += mods.bonusVsFlying;
        if (mods.bonusVsGround && !e.flying) bonus += mods.bonusVsGround;
        if (mods.bonusVsElite && (ed.elite || ed.boss)) bonus += mods.bonusVsElite;
      }
      let vuln = 0;
      const curse = e.st.curse;
      if (curse && st.time < curse.until) vuln += curse.pct;
      const veil = e.st.veil;
      if (veil && st.time < veil.until && isSlowed(e)) vuln += veil.pct;
      let armorEff = 0;
      if (!o2.dot) {
        const armor = e.armor + (e.bossArmor || 0);
        armorEff = Math.max(0, armor - shredTotal(e)) * (1 - ((mods.armorIgnore) || 0));
      }
      let affMult = aff === 'weak' ? 1.5 : aff === 'resist' ? 0.5 : 1;
      if (e.adapt && e.adapt.el === element) affMult *= 1 - Math.min(ed.traits.adaptive.max, e.adapt.stacks * ed.traits.adaptive.per);
      lastAttackSide = base * (1 + bonus) * (o2.crit || 1); // 받는 쪽 배율 전 (잿불 화상 등 파생 화상의 기준)
      let final = base * (1 + bonus) * (1 + vuln) * (1 - armorEff) * affMult;
      if (o2.crit) final *= o2.crit;
      if (final <= 0) return 0;

      let dealt = final;
      if (e.shield > 0) {
        const sm = (o2.shieldMult || 1) * (1 + ((mods.stillness && mods.stillness.shieldBonus) || 0));
        const toShield = final * sm;
        if (toShield <= e.shield) {
          e.shield -= toShield;
        } else {
          const rest = (toShield - e.shield) / sm;
          e.shield = 0;
          ev('shieldBreak', { enemyId: e.id, x: e.x, y: e.y });
          e.hp -= rest;
        }
      } else {
        e.hp -= final;
      }
      e.lastHurt = st.time;
      // 기록
      if (src && src.tower) st.stats.damageByTower[src.tower.id] = (st.stats.damageByTower[src.tower.id] || 0) + dealt;
      else if (src && src.heroHit) st.stats.heroDamage += dealt;
      // 질주
      if (ed.traits.dash && !e.dashUsed) { e.dashUsed = true; e.dashUntil = st.time + ed.traits.dash.dur; }
      // 적응: 직접 명중만
      if (ed.traits.adaptive && !o2.dot && !o2.secondary && !o2.beamTick) {
        if (e.adapt && e.adapt.el === element) e.adapt.stacks += 1;
        else e.adapt = { el: element, stacks: 1 };
      }
      if (!o2.quiet) ev('hit', { x: e.x, y: e.y, element, amount: dealt, crit: !!o2.crit, targetId: e.id, dot: !!o2.dot });
      if (e.hp <= 0.0001) kill(e, src, {});
      return dealt;
    }

    /** 현상금 보너스 합(상한) */
    function bountyBonus(e, src) {
      let b = meta.bountyPct || 0;
      if (src && src.calc && src.calc.mods && src.calc.mods.bountyPct) b += src.calc.mods.bountyPct;
      if (src && src.heroHit && st.hero && st.hero.heroId === 'yaro') b += D().heroes.yaro.passive.bountyPct;
      for (const t of st.towers) {
        if (!t.calc || !t.calc.bountyAura || t.disabled) continue;
        if (d2(t.x, t.y, e.x, e.y) <= t.calc.bountyAura.radius ** 2) { b += t.calc.bountyAura.pct; break; }
      }
      return Math.min(rules.bountyCap, b);
    }

    function kill(e, src, k2) {
      if (e.dead) return;
      const ed = D().enemies[e.type];
      // 부활
      if (ed.traits.undying && !e.undyingUsed && !k2.executed) {
        e.undyingUsed = true;
        e.hp = e.maxHp * ed.traits.undying.pct;
        e.invulnUntil = st.time + 0.6;
        e.st.burns = []; e.st.bleeds = [];
        ev('revive', { enemyId: e.id, x: e.x, y: e.y });
        return;
      }
      e.dead = true;
      e.hp = 0;
      releaseEnemy(e);
      let bounty = ed.bounty;
      if (e.fragment) bounty = Math.max(1, Math.round(ed.bounty * (ed.traits.split ? ed.traits.split.hpPct || 0.25 : 0.25)));
      bounty = Math.round(bounty * (1 + bountyBonus(e, src)));
      st.gold += bounty;
      st.stats.goldEarned += bounty;
      st.stats.kills += 1;
      ev('kill', { enemyId: e.id, enemyType: e.type, x: e.x, y: e.y, bounty, boss: !!ed.boss, flying: e.flying, dir: e.dir, size: e.size }); // dir·size는 죽는 연출용
      // 경험치
      if (st.hero && !st.hero.dead) {
        if (src && src.heroHit) heroXp(e, true);
        else if (d2(st.hero.x, st.hero.y, e.x, e.y) <= rules.heroXpRadius ** 2) heroXp(e, false);
      }
      // 분열
      if (ed.traits.split && !e.fragment) {
        const sp = ed.traits.split;
        for (let i = 0; i < sp.n; i++) {
          const child = spawnEnemy(sp.into, null, { from: e, index: i, fragment: !!sp.fragment, hpPct: sp.hpPct });
          if (child) child.invulnUntil = st.time + 0.15;
        }
      }
      // 죽음 폭발
      if (ed.traits.deathburst) {
        const db = ed.traits.deathburst;
        for (const u of st.units) {
          if (u.dead || u.kind === 'drone') continue;
          if (d2(u.x, u.y, e.x, e.y) <= db.radius ** 2) hurtUnit(u, db.damage, e);
        }
        ev('splash', { x: e.x, y: e.y, radius: db.radius, element: 'fire' });
      }
      // 마비 폭발
      if (ed.traits.shock) {
        const sh = ed.traits.shock;
        for (const t of st.towers) {
          if (d2(t.x, t.y, e.x, e.y) <= sh.radius ** 2) disableTower(t, sh.dur, 'shock');
        }
        ev('pulse', { x: e.x, y: e.y, radius: sh.radius, element: 'storm' });
      }
      // 저주 확산 (역병 첨탑)
      const curse = e.st.curse;
      if (curse && st.time < curse.until && curse.spread) {
        const s = curse.spread;
        for (const o3 of st.enemies) {
          if (o3 === e || o3.dead) continue;
          if (d2(o3.x, o3.y, e.x, e.y) > s.radius ** 2) continue;
          applyCurse(o3, curse.pct, s.dur || 4, s);
          damage(o3, s.damage, 'dark', s.src, { secondary: true });
        }
        ev('pulse', { x: e.x, y: e.y, radius: s.radius, element: 'dark' });
      }
    }

    /* =====================================================
     * 적 생성과 이동
     * ===================================================== */
    function spawnEnemy(type, spawnIdx, from, waveIdx) {
      const ed = D().enemies[type];
      if (!ed) { st.warnings.push(`알 수 없는 적 ${type}`); return null; }
      const flying = !!ed.traits.flying;
      let x; let y; let c; let r;
      if (from && from.from) {
        const p = from.from;
        x = p.x; y = p.y; c = p.c; r = p.r;
        // 겹치지 않게 살짝 흩뿌림 (같은 칸 안에서)
        const a = (from.index / Math.max(1, (ed.traits.split ? 3 : 3))) * Math.PI * 2;
        x += Math.cos(a) * 0.15; y += Math.sin(a) * 0.15;
      } else {
        // 비행 적도 지상 입구에서 나와 길을 따라 날아감 (2026-11-10 개정: 예전엔 하늘 입구에서 등불까지 곧게)
        const s = map.spawns[(spawnIdx || 0) % map.spawns.length];
        x = s.x; y = s.y; c = s.c; r = s.r;
      }
      let hp = ed.hp;
      if (o.hpMult) hp *= o.hpMult;
      if (def.hpMult) hp *= def.hpMult; // 맵 난이도 계수 (밸런스 조정)
      if (def.ramp && o.mode !== 'endless' && waveIdx != null && waveIdx < def.ramp.length) hp *= def.ramp[waveIdx]; // 초반 몸풀기
      if (from && from.hpPct) hp *= from.hpPct;
      if (st.wave.hpScale) hp *= st.wave.hpScale;
      const e = {
        id: nextId++, type, x, y, px: x, py: y, c, r, tc: c, tr: r,
        hp, maxHp: hp, shield: 0, maxShield: 0, armor: ed.armor, flying, size: ed.size * (from && from.fragment ? 0.75 : 1),
        stealth: !!ed.traits.stealth, revealed: !ed.traits.stealth,
        lane: Math.floor(rng() * 1000), dir: 1, prog: 0, trail: [],
        st: { slowPct: 0, slowUntil: 0, curse: null, veil: null, blindUntil: 0, stillUntil: 0, purifyUntil: 0, haltUntil: 0, shreds: {}, burns: [], bleeds: [] },
        ccUntil: 0, ccKind: null, ccLog: [], ccImmuneUntil: 0, pushRes: 0,
        blockedBy: null, meleeCd: 0.5, rangedCd: 1, lastHurt: -99,
        burrowed: false, burrowT: 0, dashUsed: false, dashUntil: 0, undyingUsed: false, adapt: null,
        healCd: 0, shieldCd: 0, invulnUntil: 0, fragment: !!(from && from.fragment), dead: false, leaked: false,
        boss: ed.boss ? { phase: 0, t: 0, timers: {} } : null, bossArmor: 0, speedMul: 1, immuneEls: null,
        walkT: 0,
      };
      if (ed.traits.shield) { e.maxShield = ed.traits.shield.amount * e.maxHp; e.shield = e.maxShield; }
      if (ed.bossData && ed.bossData.phases) e.immuneEls = Object.keys(ed.affinity).filter((k) => ed.affinity[k] === 'immune');
      if (from && from.from) {
        e.trail = from.from.trail.slice(-6);
        e.tc = from.from.tc; e.tr = from.from.tr;
      } else {
        const nx = RG.grid.nextStep(map, flow, blocked, c, r, e.lane);
        if (nx) { e.tc = nx.c; e.tr = nx.r; }
      }
      updateProg(e);
      st.enemies.push(e);
      ev('spawn', { enemyId: e.id, enemyType: type });
      return e;
    }

    function updateProg(e) {
      const ti = e.tr * map.cols + e.tc;
      const fd = flow[ti];
      e.prog = (isFinite(fd) ? fd : 99) + dist(e.x, e.y, e.tc + 0.5, e.tr + 0.5);
    }

    function enemySpeed(e) {
      const ed = D().enemies[e.type];
      let s = ed.speed * e.speedMul;
      // 감속은 가장 센 것 하나만 (상태 감속과 장판 감속도 서로 곱하지 않음 — §7.1)
      const slow = Math.max(st.time < e.st.slowUntil ? e.st.slowPct : 0, zoneSlowOf(e));
      s *= 1 - slow;
      if (e.dashUntil > st.time) s *= ed.traits.dash.mult;
      return s;
    }

    function leak(e) {
      const ed = D().enemies[e.type];
      e.dead = true;
      e.leaked = true;
      releaseEnemy(e);
      let lost = ed.boss ? st.lives : ed.lives;
      if (!ed.boss && !ed.elite && st.leakShield > 0) { st.leakShield -= 1; lost = 0; }
      st.lives = Math.max(0, st.lives - lost);
      st.stats.leaked += lost ? 1 : 0;
      ev('leak', { enemyId: e.id, lives: lost, enemyType: e.type, shielded: lost === 0 });
    }

    function moveGround(e, step) {
      let guard = 0;
      while (step > 1e-6 && guard++ < 4) {
        const tx = e.tc + 0.5;
        const ty = e.tr + 0.5;
        const dd = dist(e.x, e.y, tx, ty);
        if (dd > step) {
          e.x += ((tx - e.x) / dd) * step;
          e.y += ((ty - e.y) / dd) * step;
          if (Math.abs(tx - e.x) > 0.01) e.dir = tx > e.x ? 1 : -1;
          return;
        }
        e.x = tx; e.y = ty; step -= dd;
        if (e.c !== e.tc || e.r !== e.tr) {
          e.trail.push({ x: tx, y: ty });
          if (e.trail.length > 12) e.trail.shift();
        }
        e.c = e.tc; e.r = e.tr;
        if (e.c === map.lantern.c && e.r === map.lantern.r) { leak(e); return; }
        let nx = RG.grid.nextStep(map, flow, blocked, e.c, e.r, e.lane);
        if (!nx) nx = escapeStep(e.c, e.r); // 갇힌 칸(밀려나 막힌 주머니 등): 이웃 중 길이 이어진 칸으로
        if (!nx) { leak(e); return; }
        e.tc = nx.c; e.tr = nx.r;
      }
    }

    /**
     * 공포(공포의 종): 지나온 칸 중심(trail)을 거꾸로 밟아 뒷걸음질. trail의 마지막은 지금 칸(c,r)의 중심.
     * 지금 칸 중심에 닿으면 그 앞 칸으로, 겁이 풀리면 다시 원래 다음 칸(tc,tr)으로 걸어감 — 길은 그대로.
     */
    function moveBack(e, step) {
      let guard = 0;
      while (step > 1e-6 && guard++ < 4) {
        let tx = e.c + 0.5;
        let ty = e.r + 0.5;
        if (Math.abs(e.x - tx) < 1e-6 && Math.abs(e.y - ty) < 1e-6) {
          const tr = e.trail;
          if (tr.length < 2) return; // 더 물러설 곳이 없음 (입구 근처)
          tr.pop();
          const p = tr[tr.length - 1];
          e.tc = e.c; e.tr = e.r; // 겁이 풀리면 방금 떠난 칸으로 다시
          e.c = Math.floor(p.x); e.r = Math.floor(p.y);
          tx = p.x; ty = p.y;
        }
        const dd = dist(e.x, e.y, tx, ty);
        if (dd > step) {
          e.x += ((tx - e.x) / dd) * step;
          e.y += ((ty - e.y) / dd) * step;
          if (Math.abs(tx - e.x) > 0.01) e.dir = tx > e.x ? 1 : -1;
          return;
        }
        e.x = tx; e.y = ty; step -= dd;
      }
    }

    /** 흐름장이 끊긴 칸에서 빠져나갈 이웃 칸 (모서리 규칙 무시 — 비상용) */
    function escapeStep(c, r) {
      let best = null;
      let bf = Infinity;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (!dc && !dr) continue;
          const c2 = c + dc;
          const r2 = r + dr;
          if (c2 < 0 || r2 < 0 || c2 >= map.cols || r2 >= map.rows) continue;
          if (!RG.grid.enemyWalkable(map, blocked, c2, r2)) continue;
          const f = flow[r2 * map.cols + c2];
          if (isFinite(f) && f < bf) { bf = f; best = { c: c2, r: r2 }; }
        }
      }
      return best;
    }

    /** 지나온 칸을 따라 뒤로 밀기 (DESIGN §7.2.7) */
    function push(e, distance) {
      const ed = D().enemies[e.type];
      if (e.flying || ed.boss || e.size >= 0.9 || e.burrowed) return;
      const eff = distance * (1 - e.pushRes);
      e.pushRes = Math.min(1, e.pushRes + rules.push.per);
      if (eff <= 0.01) return;
      let remain = eff;
      let x = e.x;
      let y = e.y;
      while (remain > 1e-6 && e.trail.length) {
        const p = e.trail[e.trail.length - 1];
        const pc = Math.floor(p.x);
        const pr = Math.floor(p.y);
        if (!RG.grid.enemyWalkable(map, blocked, pc, pr)) break;
        if (!isFinite(flow[pr * map.cols + pc])) break; // 등불로 이어지지 않는 칸(막힌 주머니)으로는 밀지 않음
        const dd = dist(x, y, p.x, p.y);
        if (dd >= remain) { x += ((p.x - x) / dd) * remain; y += ((p.y - y) / dd) * remain; remain = 0; break; }
        x = p.x; y = p.y; remain -= dd;
        e.trail.pop();
        e.c = pc; e.r = pr;
      }
      e.x = x; e.y = y;
      releaseEnemy(e);
      const cc = Math.floor(x);
      const cr = Math.floor(y);
      if (RG.grid.enemyWalkable(map, blocked, cc, cr)) { e.c = cc; e.r = cr; }
      e.tc = e.c; e.tr = e.r;
      // 지금 칸 중심으로 먼저 가고, 그다음부터 흐름장
      if (Math.abs(e.x - (e.c + 0.5)) < 0.02 && Math.abs(e.y - (e.r + 0.5)) < 0.02) {
        const nx = RG.grid.nextStep(map, flow, blocked, e.c, e.r, e.lane);
        if (nx) { e.tc = nx.c; e.tr = nx.r; }
      }
      updateProg(e);
      ev('push', { enemyId: e.id, x: e.x, y: e.y });
    }

    /** n칸 앞으로 (보스 순간이동·땅굴) */
    function advance(e, tiles) {
      if (e.flying) return;
      let c = e.tc;
      let r = e.tr;
      for (let i = 0; i < tiles; i++) {
        const nx = RG.grid.nextStep(map, flow, blocked, c, r, e.lane);
        if (!nx) break;
        if (nx.c === map.lantern.c && nx.r === map.lantern.r) break;
        e.trail.push({ x: c + 0.5, y: r + 0.5 });
        c = nx.c; r = nx.r;
      }
      e.c = c; e.r = r; e.x = c + 0.5; e.y = r + 0.5; e.px = e.x; e.py = e.y;
      const nx = RG.grid.nextStep(map, flow, blocked, c, r, e.lane);
      if (nx) { e.tc = nx.c; e.tr = nx.r; } else { e.tc = c; e.tr = r; }
      releaseEnemy(e);
      updateProg(e);
    }

    /* =====================================================
     * 붙잡기와 유닛
     * ===================================================== */
    function unitById(id) { return st.units.find((u) => u.id === id); }
    function enemyById(id) { return st.enemies.find((e) => e.id === id); }

    function releaseEnemy(e) {
      if (!e.blockedBy) return;
      const u = unitById(e.blockedBy);
      if (u) u.blocking = u.blocking.filter((id) => id !== e.id);
      e.blockedBy = null;
    }
    function releaseUnit(u) {
      for (const id of u.blocking) {
        const e = enemyById(id);
        if (e && e.blockedBy === u.id) e.blockedBy = null;
      }
      u.blocking = [];
    }

    function hurtUnit(u, amount, srcEnemy) {
      if (u.dead) return;
      let dmg = amount * (1 - (u.armor || 0));
      if (u.kind === 'hero') {
        const hd = D().heroes[u.heroId];
        if (hd.passive.id === 'unyielding' && u.hp / u.maxHp <= hd.passive.threshold) dmg *= 1 - hd.passive.reduce;
      }
      u.hp -= dmg;
      ev('unitHit', { unitId: u.id, amount: dmg, x: u.x, y: u.y });
      if (u.hp <= 0) unitDown(u);
    }

    function unitDown(u) {
      u.hp = 0;
      releaseUnit(u);
      if (u.kind === 'hero') {
        u.dead = true;
        u.path = [];
        u.downUntil = st.time + rules.heroRespawn * (1 + (meta.heroRespawnPct || 0));
        ev('heroDown', { heroId: u.heroId, x: u.x, y: u.y });
      } else if (u.kind === 'soldier') {
        u.dead = true;
        const t = st.towers.find((tt) => tt.id === u.owner);
        let mul = 1;
        for (const s of st.towers) {
          if (s.calc && s.calc.respawnMul && !s.disabled && d2(s.x, s.y, u.homeX, u.homeY) <= (s.calc.heal ? s.calc.heal.radius : 2.5) ** 2) mul = Math.min(mul, s.calc.respawnMul);
        }
        u.respawnAt = st.time + (t && t.calc.soldiers ? t.calc.soldiers.respawn : 10) * mul;
        ev('unitDown', { unitId: u.id, x: u.x, y: u.y });
      } else {
        u.dead = true;
        u.remove = true;
        ev('unitDown', { unitId: u.id, x: u.x, y: u.y });
      }
    }

    function canBeBlocked(e) {
      const ed = D().enemies[e.type];
      return !e.dead && !e.flying && !e.burrowed && !ed.traits.unstoppable && !(isHardCC(e) && (e.ccKind === 'lift' || e.ccKind === 'fear'));
    }

    // 붙잡기 계산에 매 틱 쓰는 배열은 다시 씀 (적 수백 × 병사 수십을 매 틱 훑으므로 새 배열을 만들면 쓰레기가 많음)
    const freeEnemies = [];
    const candE = [];
    const candD = [];
    const blockRank = (u) => (u.kind === 'hero' ? 0 : u.kind === 'wall' ? 1 : 2);
    function resolveBlocking() {
      // 정리 (제자리에서 걸러 냄 — 순서·부작용은 예전 filter와 같음)
      for (const u of st.units) {
        const bl = u.blocking;
        if (!bl.length) continue;
        let j = 0;
        for (let i = 0; i < bl.length; i++) {
          const id = bl[i];
          const e = enemyById(id);
          const ok = e && !e.dead && e.blockedBy === u.id && canBeBlocked(e) && d2(e.x, e.y, u.x, u.y) < 2.6;
          if (!ok && e && e.blockedBy === u.id) e.blockedBy = null;
          if (ok) bl[j++] = id;
        }
        bl.length = j;
      }
      // 배정: 영웅 → 벽 → 병사
      const building = new Set(st.towers.filter((t) => t.building).map((t) => t.id)); // 짓는 중인 병영의 병사는 아직 싸우지 않음
      const blockers = st.units.filter((u) => !u.dead && u.block > 0 && !(u.kind === 'hero' && u.path.length) && !(u.kind === 'soldier' && building.has(u.owner)));
      if (!blockers.length) return;
      blockers.sort((a, b) => blockRank(a) - blockRank(b));
      // 붙잡을 수 있는 적은 이 틱 동안 바뀌지 않으므로 한 번만 골라 둠(순서 그대로). 배정되면 blockedBy로 건너뜀 → 예전과 같은 후보
      freeEnemies.length = 0;
      for (let i = 0; i < st.enemies.length; i++) { const e = st.enemies[i]; if (!e.blockedBy && canBeBlocked(e)) freeEnemies.push(e); }
      for (const u of blockers) {
        if (u.blocking.length >= u.block) continue;
        const ax = u.kind === 'soldier' ? u.homeX : u.x;
        const ay = u.kind === 'soldier' ? u.homeY : u.y;
        const R = u.kind === 'soldier' ? (u.taunt || 0.9) : u.kind === 'wall' ? 0.75 : 0.95;
        const R2 = R * R;
        candE.length = 0; candD.length = 0;
        for (let i = 0; i < freeEnemies.length; i++) {
          const e = freeEnemies[i];
          if (e.blockedBy) continue;
          const dx = e.x - ax;
          if (dx > R + 1e-6 || dx < -R - 1e-6) continue; // 확실히 먼 적만 (경계는 아래 정확한 계산에 맡김)
          const dd = d2(e.x, e.y, ax, ay);
          if (dd <= R2) {
            // 가까운 순(같으면 id 작은 순)으로 끼워 넣기 — 후보는 보통 몇 마리뿐
            let k = candE.length;
            candE.push(e); candD.push(dd);
            while (k > 0 && (candD[k - 1] > dd || (candD[k - 1] === dd && candE[k - 1].id > e.id))) { candE[k] = candE[k - 1]; candD[k] = candD[k - 1]; k--; }
            candE[k] = e; candD[k] = dd;
          }
        }
        for (let i = 0; i < candE.length; i++) {
          if (u.blocking.length >= u.block) break;
          const e = candE[i];
          e.blockedBy = u.id;
          u.blocking.push(e.id);
        }
      }
      candE.length = 0; freeEnemies.length = 0;
    }

    /* =====================================================
     * 탑
     * ===================================================== */
    function disableTower(t, dur, reason) {
      const until = st.time + dur;
      if (until > t.disabledUntil) t.disabledUntil = until;
      ev('towerDisabled', { towerId: t.id, dur, reason });
    }

    /**
     * 사거리 안 표적 n개 (표적 방식에 따른 순서, 같으면 id가 작은 적).
     * n이 1이면(대부분의 탑) 한 번 훑으며 가장 좋은 적만 고름 — 배열·정렬 없이 (적이 수백일 때 매 틱 비용이 큼). 결과는 정렬과 같음.
     */
    const NO_OPT = Object.freeze({});
    function towerTargets(t, n, range, opt = NO_OPT) {
      const c = t.calc;
      const r2 = range * range;
      const min2 = c.minRange ? c.minRange * c.minRange : 0;
      const mode = t.targetMode;
      const tg = c.targets;
      const tx = t.x;
      const ty = t.y;
      const keyOf = (e, dd) => (mode === 'last' ? -e.prog : mode === 'strong' ? -(e.hp + e.shield) : mode === 'weak' ? e.hp + e.shield : mode === 'close' ? dd : e.prog);
      if (n === 1) {
        let best = null;
        let bk = 0;
        for (const e of st.enemies) {
          if (!targetable(e)) continue;
          if (tg === 'ground' && e.flying) continue;
          if (tg === 'air' && !e.flying) continue;
          const dx = tx - e.x;
          const dy = ty - e.y;
          const dd = dx * dx + dy * dy;
          if (dd > r2 || dd < min2) continue;
          if (!opt.anyElement && !attackable(e, c.element)) continue;
          if (opt.exclude && opt.exclude.has(e.id)) continue;
          const k = keyOf(e, dd);
          if (best === null || k < bk || (k === bk && e.id < best.id)) { best = e; bk = k; }
        }
        return best ? [best] : [];
      }
      const out = [];
      for (const e of st.enemies) {
        if (!targetable(e)) continue;
        if (tg === 'ground' && e.flying) continue;
        if (tg === 'air' && !e.flying) continue;
        const dx = tx - e.x;
        const dy = ty - e.y;
        const dd = dx * dx + dy * dy;
        if (dd > r2 || dd < min2) continue;
        if (!opt.anyElement && !attackable(e, c.element)) continue;
        if (opt.exclude && opt.exclude.has(e.id)) continue;
        out.push({ k: keyOf(e, dd), e });
      }
      out.sort((a, b) => a.k - b.k || a.e.id - b.e.id);
      const res = [];
      for (let i = 0; i < out.length && i < n; i++) res.push(out[i].e);
      return res;
    }

    function enemiesInRadius(x, y, radius, filter) {
      const out = [];
      const r2 = radius * radius;
      const far = radius + 1.5; // 몸 크기 보정(size×0.3)보다 넉넉한 거리 — 이보다 멀면 바로 건너뜀(결과는 같음)
      for (const e of st.enemies) {
        const dx = x - e.x;
        if (dx > far || dx < -far) continue;
        const dy = y - e.y;
        if (dy > far || dy < -far) continue;
        if (e.dead || e.burrowed) continue;
        if (filter === 'ground' && e.flying) continue;
        if (filter === 'air' && !e.flying) continue;
        const rr = radius + e.size * 0.3;
        const dd = d2(x, y, e.x, e.y);
        if (dd <= Math.max(r2, rr * rr) && dd <= rr * rr) out.push(e);
      }
      return out;
    }

    function rollCrit(calc) {
      if (calc && calc.crit && rng() < calc.crit.chance) return calc.crit.mult;
      return 0;
    }

    /**
     * 명중 처리: 피해 + 명중 효과 + 공명 효과
     * src: { tower?, unit?, calc, heroHit? }, hit: { procMult, area, shieldMult, base }
     */
    function hitEnemy(e, base, src, hit = {}) {
      const calc = src.calc;
      if (!e || e.dead) return 0;
      const crit = hit.noCrit ? 0 : rollCrit(calc);
      let b = base;
      if (calc.onHit && calc.onHit.flyingMult && e.flying) b *= calc.onHit.flyingMult;
      if (src.heroCrit && isSlowed(e) && rng() < src.heroCrit.chance) hit.critOverride = src.heroCrit.mult;
      const dealt = damage(e, b, src.element || calc.element, src, { crit: hit.critOverride || crit, area: hit.area, shieldMult: hit.shieldMult || calc.shieldMult, quiet: hit.quiet });
      if (e.dead && !e.leaked) {
        procsOnDeadTarget(e, dealt, src, hit);
        return dealt;
      }
      applyOnHit(e, dealt || b, src, hit);
      return dealt;
    }

    function procsOnDeadTarget(e, dealt, src, hit) {
      // 대상이 죽어도 증기 폭발·폭풍우는 터짐
      const calc = src.calc;
      const mods = calc.mods || {};
      const pm = hit.procMult == null ? 1 : hit.procMult;
      if (mods.steam && rng() < mods.steam.chance * pm) steamBurst(e, dealt, src);
      if (mods.chainExtra) tempestJump(e, dealt, src);
    }

    function steamBurst(e, dealt, src) {
      const m = src.calc.mods.steam;
      for (const o3 of enemiesInRadius(e.x, e.y, m.radius)) {
        if (o3 === e) continue;
        damage(o3, dealt * m.pct, src.element || src.calc.element, src, { secondary: true });
      }
      ev('splash', { x: e.x, y: e.y, radius: m.radius, element: 'steam' });
    }
    function tempestJump(e, dealt, src) {
      const m = src.calc.mods.chainExtra;
      let best = null;
      let bd = m.radius * m.radius;
      for (const o3 of st.enemies) {
        if (o3 === e || !targetable(o3)) continue;
        const dd = d2(o3.x, o3.y, e.x, e.y);
        if (dd <= bd) { bd = dd; best = o3; }
      }
      if (best) {
        damage(best, dealt * m.pct, src.element || src.calc.element, src, { secondary: true });
        ev('chain', { points: [[e.x, e.y], [best.x, best.y]], element: 'storm', small: true });
      }
    }

    function applyOnHit(e, dealt, src, hit) {
      const attackSide = lastAttackSide; // 이 명중의 공격 쪽 피해 (받는 쪽 배율이 틱에서 다시 곱해지지 않게)
      const calc = src.calc;
      const oh = calc.onHit || {};
      const mods = calc.mods || {};
      const pm = hit.procMult == null ? 1 : hit.procMult;
      const t = src.tower;
      const el = src.element || calc.element;
      const key = t ? t.type : (src.unit ? src.unit.kind : 'x');
      if (oh.burn) addDot(e, 'burn', `${key}:${t ? t.id : 'u'}`, oh.burn.dps * (1 + (calc.dmgBonus || 0)), oh.burn.dur, el, src);
      if (oh.slow) applySlow(e, oh.slow.pct, oh.slow.dur);
      if (oh.freezeEvery && t) {
        t.hitCount = (t.hitCount || 0) + 1;
        if (t.hitCount % oh.freezeEvery.n === 0) hardCC(e, 'freeze', oh.freezeEvery.dur);
      }
      if (oh.curse) applyCurse(e, oh.curse.pct, oh.curse.dur, oh.spreadCurse ? { radius: oh.spreadCurse.radius, damage: oh.spreadCurse.damage, dur: oh.curse.dur, src } : null);
      if (oh.shred) addShred(e, key, oh.shred.pct, oh.shred.max, oh.shred.dur);
      if (oh.stun && rng() < oh.stun.chance * pm) hardCC(e, 'stun', oh.stun.dur);
      if (oh.knockback) push(e, oh.knockback);
      if (oh.blind) { e.st.blindUntil = Math.max(e.st.blindUntil, st.time + oh.blind); }
      if (oh.purify) { e.st.purifyUntil = st.time + oh.purify; if (e.shield > 0) { e.shield = 0; ev('shieldBreak', { enemyId: e.id, x: e.x, y: e.y }); } }
      if (oh.halt) e.st.haltUntil = st.time + oh.halt;
      if (oh.veil) { const v = e.st.veil; if (!v || st.time >= v.until || oh.veil.pct >= v.pct) e.st.veil = { pct: oh.veil.pct, until: st.time + oh.veil.dur }; }
      if (oh.execute && !e.dead) {
        const ed = D().enemies[e.type];
        if (!ed.boss && e.hp / e.maxHp <= oh.execute) { ev('execute', { x: e.x, y: e.y }); kill(e, src, { executed: true }); return; }
      }
      // 공명
      if (mods.steam && rng() < mods.steam.chance * pm) steamBurst(e, dealt, src);
      if (mods.shredOnHit && !e.dead) addShred(e, 'magma', mods.shredOnHit.pct, mods.shredOnHit.max, mods.shredOnHit.dur);
      if (mods.burnOnHit && !e.dead) addDot(e, 'burn', `res:${t ? t.id : 'u'}`, ((attackSide || dealt) * mods.burnOnHit.pct) / mods.burnOnHit.dur, mods.burnOnHit.dur, el, src);
      if (mods.slowOnHit && !e.dead) applySlow(e, mods.slowOnHit.pct, mods.slowOnHit.dur);
      if (mods.stillness && !e.dead) e.st.stillUntil = st.time + mods.stillness.dur;
      if (mods.stunOnHit && !e.dead && rng() < mods.stunOnHit.chance * pm) hardCC(e, 'stun', mods.stunOnHit.dur);
      if (mods.chainExtra) tempestJump(e, dealt, src);
      if (mods.zap && t && !e.dead) {
        t.zapCount = (t.zapCount || 0) + 1;
        if (t.zapCount % mods.zap.n === 0) { damage(e, mods.zap.damage, el, src, { secondary: true }); ev('chain', { points: [[t.x, t.y - 0.4], [e.x, e.y]], element: el, small: true }); }
      }
      // 영웅 제나: 현장 개조
      if (t && st.hero && !st.hero.dead && st.hero.heroId === 'zena' && !e.dead) {
        const p = D().heroes.zena.passive;
        if (d2(t.x, t.y, st.hero.x, st.hero.y) <= p.radius * p.radius) {
          t.fmCount = (t.fmCount || 0) + 1;
          if (t.fmCount % p.every === 0) {
            damage(e, p.damage * heroStat(st.hero).skillK, 'storm', { heroHit: false, calc: { dmgBonus: 0, mods: {} } }, { secondary: true });
            ev('chain', { points: [[st.hero.x, st.hero.y - 0.4], [e.x, e.y]], element: 'storm', small: true });
          }
        }
      }
    }

    function fireTower(t) {
      const c = t.calc;
      const src = { tower: t, calc: c, element: c.element };
      switch (c.kind) {
        case 'arrow': case 'bolt': case 'gust': {
          const targets = towerTargets(t, c.multishot || 1, c.range);
          if (!targets.length) return false;
          for (const e of targets) {
            st.projectiles.push({ id: nextId++, kind: c.kind, element: c.element, x: t.x, y: t.y - 0.35, px: t.x, py: t.y - 0.35, targetId: e.id, tx: e.x, ty: e.y, speed: c.projSpeed || 8, src, base: c.damage, towerType: t.type, level: t.level, branch: t.branch });
          }
          ev('fire', { towerId: t.id, kind: c.kind, element: c.element, x: t.x, y: t.y, tx: targets[0].x, ty: targets[0].y });
          return true;
        }
        case 'mortar': {
          const targets = towerTargets(t, 1, c.range);
          if (!targets.length) return false;
          const e = targets[0];
          const shells = c.shells || 1;
          for (let i = 0; i < shells; i++) {
            let tx = e.x;
            let ty = e.y;
            if (i > 0) { const a = rng() * Math.PI * 2; const rr = (c.spread || 0.8) * (0.4 + rng() * 0.6); tx += Math.cos(a) * rr; ty += Math.sin(a) * rr; }
            st.projectiles.push({ id: nextId++, kind: 'shell', element: c.element, x: t.x, y: t.y - 0.4, px: t.x, py: t.y - 0.4, sx: t.x, sy: t.y - 0.4, tx, ty, t: 0, flight: (c.flight || 0.9) + i * 0.08, src, base: c.damage, towerType: t.type });
          }
          ev('fire', { towerId: t.id, kind: 'mortar', element: c.element, x: t.x, y: t.y, tx: e.x, ty: e.y });
          return true;
        }
        case 'orb': {
          const targets = towerTargets(t, 1, c.range);
          if (!targets.length) return false;
          const e = targets[0];
          st.projectiles.push({ id: nextId++, kind: 'orb', element: c.element, x: t.x, y: t.y - 0.4, px: t.x, py: t.y - 0.4, tx: e.x, ty: e.y, speed: c.projSpeed || 3.5, src, base: 0, towerType: t.type });
          ev('fire', { towerId: t.id, kind: 'orb', element: c.element, x: t.x, y: t.y, tx: e.x, ty: e.y });
          return true;
        }
        case 'ballista': {
          const targets = towerTargets(t, 1, c.range);
          if (!targets.length) return false;
          const e = targets[0];
          const dd = dist(t.x, t.y, e.x, e.y) || 1;
          const ex = t.x + ((e.x - t.x) / dd) * c.range;
          const ey = t.y + ((e.y - t.y) / dd) * c.range;
          for (const o3 of st.enemies) {
            if (o3.dead || o3.burrowed) continue;
            if (c.targets === 'ground' && o3.flying) continue;
            if (segDist(o3.x, o3.y, t.x, t.y, ex, ey) <= 0.3 + o3.size * 0.3) hitEnemy(o3, c.damage, src, { area: o3 !== e });
          }
          ev('fire', { towerId: t.id, kind: 'ballista', element: c.element, x: t.x, y: t.y, tx: ex, ty: ey });
          return true;
        }
        case 'pulse': {
          const filter = c.targets === 'ground' ? 'ground' : null;
          const list = enemiesInRadius(t.x, t.y, c.range, filter);
          if (!list.some((e) => !e.dead)) return false;
          for (const e of list) hitEnemy(e, c.damage, src, { area: true });
          if (c.fear) for (const e of list) if (!e.dead && hardCC(e, 'fear', c.fear.dur)) ev('fear', { enemyId: e.id, x: e.x, y: e.y }); // 공포의 종
          if (c.zone) addZone(c.zone, t.x, t.y, src, true);
          ev('pulse', { towerId: t.id, x: t.x, y: t.y, radius: c.range, element: c.element, fear: !!c.fear });
          return true;
        }
        case 'cone': {
          // 화염 분사기: 가장 앞선 적 쪽으로 부채꼴(c.cone도) 안의 지상 적 모두 (360이면 사방)
          const targets = towerTargets(t, 1, c.range);
          if (!targets.length) return false;
          const aim = Math.atan2(targets[0].y - t.y, targets[0].x - t.x);
          const half = (c.cone / 2) * (Math.PI / 180);
          const list = enemiesInRadius(t.x, t.y, c.range, c.targets === 'ground' ? 'ground' : null);
          for (const e of list) {
            if (c.cone < 360) {
              let da = Math.atan2(e.y - t.y, e.x - t.x) - aim;
              while (da > Math.PI) da -= Math.PI * 2;
              while (da < -Math.PI) da += Math.PI * 2;
              if (Math.abs(da) > half && d2(e.x, e.y, t.x, t.y) > 0.25 * 0.25) continue; // 탑에 바짝 붙은 적은 늘 맞음
            }
            hitEnemy(e, c.damage, src, { area: e !== targets[0], quiet: true });
          }
          ev('cone', { towerId: t.id, x: t.x, y: t.y, angle: aim, cone: c.cone, range: c.range, element: c.element });
          return true;
        }
        case 'rain': {
          // 고드름 구름: 적 여럿을 골라 머리 위로 고드름 — 잠시 뒤 그 자리에 떨어짐(빠른 적은 벗어날 수 있음)
          const R = c.rain;
          const targets = towerTargets(t, R.count, c.range);
          if (!targets.length) return false;
          for (const e of targets) {
            const x = e.x;
            const y = e.y;
            ev('icicle', { towerId: t.id, x, y, delay: R.delay, big: R.count === 1, element: c.element });
            delayed.push({
              at: st.time + R.delay,
              fn: () => {
                const hit = enemiesInRadius(x, y, R.radius, c.targets === 'ground' ? 'ground' : null);
                for (const o3 of hit) hitEnemy(o3, c.damage, src, { area: true });
                ev('icicleHit', { x, y, radius: R.radius, big: R.count === 1, element: c.element });
              },
            });
          }
          ev('fire', { towerId: t.id, kind: 'rain', element: c.element, x: t.x, y: t.y, tx: targets[0].x, ty: targets[0].y });
          return true;
        }
        case 'strike': {
          // 뇌운 탑: 고른 적에게 하늘에서 바로 번개 (투사체 없음) + 주변 작은 피해
          const S = c.strike;
          const targets = towerTargets(t, S.count || 1, c.range);
          if (!targets.length) return false;
          for (const e of targets) {
            const x = e.x;
            const y = e.y;
            hitEnemy(e, c.damage, src, {});
            if (S.splash) for (const o3 of enemiesInRadius(x, y, S.splash, c.targets === 'ground' ? 'ground' : null)) if (o3 !== e) hitEnemy(o3, c.damage * S.splashPct, src, { area: true, procMult: 0.5 });
            ev('strike', { towerId: t.id, x, y, element: c.element, big: (S.count || 1) === 1 && c.damage >= 150 });
          }
          ev('fire', { towerId: t.id, kind: 'strike', element: c.element, x: t.x, y: t.y, tx: targets[0].x, ty: targets[0].y });
          return true;
        }
        case 'spikes': {
          // 가시 덤불: 사거리 안 길 칸(적이 오는 쪽부터)에 가시밭을 키움 — 동시에 max곳까지
          const K = c.spikes;
          const mine = st.zones.filter((z) => z.owner === t.id && z.kind === 'thorn' && st.time <= z.until);
          if (mine.length >= K.max) return false;
          const near = enemiesInRadius(t.x, t.y, c.range + 2, 'ground');
          if (!near.length) return false; // 적이 근처에 없으면 기다림
          // 적이 서 있는 길 칸을 먼저(많이 선 칸부터), 없으면 적이 올 쪽(흐름 거리가 먼 칸)
          let best = null;
          let bestN = -1;
          let bestD = -1;
          const R = c.range;
          const route = routeSet();
          for (let r = Math.max(0, Math.floor(t.y - R)); r <= Math.min(map.rows - 1, Math.floor(t.y + R)); r++) {
            for (let cc = Math.max(0, Math.floor(t.x - R)); cc <= Math.min(map.cols - 1, Math.floor(t.x + R)); cc++) {
              if (!route.has(r * map.cols + cc)) continue;
              if (map.kinds[r * map.cols + cc] === RG.grid.T.LANTERN) continue;
              if (d2(cc + 0.5, r + 0.5, t.x, t.y) > R * R) continue;
              if (mine.some((z) => Math.abs(z.x - (cc + 0.5)) < 0.01 && Math.abs(z.y - (r + 0.5)) < 0.01)) continue;
              const fd = flow[r * map.cols + cc];
              if (!isFinite(fd)) continue;
              let n = 0;
              for (let k = 0; k < near.length; k++) { const o3 = near[k]; if (!o3.dead && Math.abs(o3.x - (cc + 0.5)) <= 0.6 && Math.abs(o3.y - (r + 0.5)) <= 0.6) n++; }
              if (n > bestN || (n === bestN && fd > bestD)) { bestN = n; bestD = fd; best = { c: cc, r }; }
            }
          }
          if (!best) return false;
          addZone({ kind: 'thorn', radius: K.radius, dur: K.dur, dps: K.dps, slowPct: K.slowPct, meltArmor: K.meltArmor || 0 }, best.c + 0.5, best.r + 0.5, src, false);
          ev('thorns', { towerId: t.id, x: best.c + 0.5, y: best.r + 0.5, fromX: t.x, fromY: t.y, radius: K.radius });
          return true;
        }
        case 'chain': {
          const targets = towerTargets(t, 1, c.range);
          if (!targets.length) return false;
          let cur = targets[0];
          const hitSet = new Set([cur.id]);
          const points = [[t.x, t.y - 0.5], [cur.x, cur.y]];
          hitEnemy(cur, c.damage, src, {});
          const ch = c.chain;
          if (ch) {
            let dmg = c.damage;
            for (let k = 0; k < ch.count; k++) {
              dmg *= 1 - ch.falloff;
              let best = null;
              let bd = ch.radius * ch.radius;
              for (const o3 of st.enemies) {
                if (hitSet.has(o3.id) || !targetable(o3) || !attackable(o3, c.element)) continue;
                if (c.targets === 'ground' && o3.flying) continue;
                const dd = d2(o3.x, o3.y, cur.x, cur.y);
                if (dd <= bd) { bd = dd; best = o3; }
              }
              if (!best) break;
              hitSet.add(best.id);
              points.push([best.x, best.y]);
              hitEnemy(best, dmg, src, { procMult: 0.5 });
              cur = best;
            }
          }
          ev('chain', { towerId: t.id, points, element: c.element });
          return true;
        }
        case 'snare': {
          const mine = st.traps.filter((tr) => tr.owner === t.id);
          if (mine.length >= c.snare.maxTraps) return false;
          let best = null;
          let bestD = -1;
          const R = c.range;
          // 적이 실제로 지나는 칸(입구에서 흐름장을 따라간 길)에만 — 공터 구석에 깔려 안 밟히던 문제
          const route = routeSet();
          for (let r = Math.max(0, Math.floor(t.y - R)); r <= Math.min(map.rows - 1, Math.floor(t.y + R)); r++) {
            for (let cc = Math.max(0, Math.floor(t.x - R)); cc <= Math.min(map.cols - 1, Math.floor(t.x + R)); cc++) {
              if (!route.has(r * map.cols + cc)) continue;
              const k = map.kinds[r * map.cols + cc];
              if (k === RG.grid.T.LANTERN) continue;
              if (d2(cc + 0.5, r + 0.5, t.x, t.y) > R * R) continue;
              if (st.traps.some((tr) => tr.c === cc && tr.r === r)) continue;
              const fd = flow[r * map.cols + cc];
              if (!isFinite(fd)) continue;
              if (fd > bestD) { bestD = fd; best = { c: cc, r }; }
            }
          }
          if (!best) return false;
          st.traps.push({ id: nextId++, owner: t.id, c: best.c, r: best.r, x: best.c + 0.5, y: best.r + 0.5, src, snare: c.snare });
          ev('trap', { towerId: t.id, x: best.c + 0.5, y: best.r + 0.5, fromX: t.x, fromY: t.y });
          return true;
        }
        default:
          return false;
      }
    }

    function addZone(z, x, y, src, refresh) {
      if (refresh) {
        const cur = st.zones.find((q) => q.owner === src.tower.id && q.kind === z.kind && Math.abs(q.x - x) < 0.01 && Math.abs(q.y - y) < 0.01);
        if (cur) { cur.until = st.time + z.dur; return; }
      }
      st.zones.push({ id: nextId++, kind: z.kind, element: src.calc.element, x, y, radius: z.radius, until: st.time + z.dur, born: st.time, dur: z.dur, dps: z.dps * (1 + (src.calc.dmgBonus || 0)), slowPct: z.slowPct || 0, meltArmor: z.meltArmor || 0, owner: src.tower ? src.tower.id : 0, src });
    }

    /**
     * 빛의 등대: 빛줄기(beams개, 같은 간격)가 탑을 중심으로 계속 돌며, 빛 안에 든 적에게 초당 피해.
     * 각도는 탑마다 저장(t.sweepA) — 결정적. 수색 등대는 비친 적에게 표식(받는 피해 +%).
     */
    const SWEEP_HIT = Object.freeze({ quiet: true, beamTick: true });
    function updateSweep(t) {
      const c = t.calc;
      const S = c.sweep;
      t.sweepA = ((t.sweepA || 0) + S.speed * DT) % (Math.PI * 2);
      const list = enemiesInRadius(t.x, t.y, c.range, c.targets === 'ground' ? 'ground' : null);
      if (!list.length) return;
      const half = S.width / 2;
      const step = (Math.PI * 2) / (S.beams || 1);
      const dps = c.sweepDps || S.dps;
      let any = false;
      for (const e of list) {
        if (!targetable(e)) continue;
        const ang = Math.atan2(e.y - t.y, e.x - t.x);
        let lit = false;
        for (let b = 0; b < (S.beams || 1) && !lit; b++) {
          let da = ang - (t.sweepA + b * step);
          da = ((da % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
          if (Math.abs(da) <= half || d2(e.x, e.y, t.x, t.y) < 0.2 * 0.2) lit = true;
        }
        if (!lit) continue;
        any = true;
        damage(e, dps * DT, c.element, { tower: t, calc: c, element: c.element }, SWEEP_HIT);
        if (S.mark && !e.dead) applyCurse(e, S.mark.pct, S.mark.dur, null);
      }
      if (any) t.anim = Math.max(t.anim, 0.12);
    }

    function updateTowerBeams(t) {
      const c = t.calc;
      const nBeams = c.beam.beams || 1;
      t.beamState = t.beamState || [];
      // 유효하지 않은 대상 정리
      const ids = new Set();
      t.beamState = t.beamState.filter((b) => {
        const e = enemyById(b.targetId);
        const ok = e && targetable(e) && attackable(e, c.element) && d2(t.x, t.y, e.x, e.y) <= c.range * c.range && !(c.targets === 'ground' && e.flying);
        if (ok) ids.add(e.id);
        return ok;
      }).slice(0, nBeams);
      if (t.beamState.length < nBeams) {
        const more = towerTargets(t, nBeams, c.range, { exclude: ids });
        for (const e of more) {
          if (t.beamState.length >= nBeams) break;
          t.beamState.push({ targetId: e.id, t: 0, proc: 0 });
        }
      }
      if (!t.beamState.length) return;
      const src = { tower: t, calc: c, element: c.element };
      for (const b of t.beamState) {
        const e = enemyById(b.targetId);
        if (!e) continue;
        b.t += DT;
        b.proc += DT;
        const mult = 1 + (c.beam.maxMult - 1) * Math.min(1, b.t / c.beam.rampTime);
        b.mult = mult;
        const per = c.dps * mult * DT;
        damage(e, per, c.element, src, { quiet: true, beamTick: true }); // 틱 피해는 "명중"이 아님 (적응 쌓기 없음)
        if (b.proc >= rules.beamProcEvery && !e.dead) {
          b.proc -= rules.beamProcEvery;
          // 0.5초마다 한 번 "명중": 적응 1중첩 + 명중 효과
          const ed = D().enemies[e.type];
          if (ed.traits.adaptive) { if (e.adapt && e.adapt.el === c.element) e.adapt.stacks += 1; else e.adapt = { el: c.element, stacks: 1 }; }
          lastAttackSide = c.dps * mult * rules.beamProcEvery * (1 + (c.dmgBonus || 0));
          applyOnHit(e, c.dps * mult * rules.beamProcEvery, src, {});
          ev('hit', { x: e.x, y: e.y, element: c.element, amount: c.dps * mult * rules.beamProcEvery, targetId: e.id, beam: true });
        }
        st.beams.push({ towerId: t.id, x1: t.x, y1: t.y - 0.55, x2: e.x, y2: e.y, mult, max: c.beam.maxMult, element: c.element });
      }
    }

    /* ---------------- 병영 ---------------- */
    function syncSoldiers(t) {
      const c = t.calc;
      const sp = c.soldiers;
      t.soldiers = t.soldiers || [];
      const kind = t.branch === 'A' ? 'granite_guard' : t.branch === 'B' ? 'obsidian_blade' : 'stone_soldier';
      while (t.soldiers.length < sp.count) {
        const s = { id: nextId++, kind: 'soldier', look: kind, owner: t.id, x: t.rally.x, y: t.rally.y, px: t.rally.x, py: t.rally.y, hp: sp.hp, maxHp: sp.hp, armor: sp.armor, cd: 0.3, blocking: [], block: sp.block, dead: false, respawnAt: 0, slot: t.soldiers.length, dir: 1, homeX: t.rally.x, homeY: t.rally.y, taunt: sp.taunt || 0 };
        t.soldiers.push(s.id);
        st.units.push(s);
      }
      t.soldiers.forEach((id, i) => {
        const s = unitById(id);
        if (!s) return;
        const ratio = s.maxHp ? s.hp / s.maxHp : 1;
        s.maxHp = sp.hp; s.hp = s.dead ? 0 : Math.max(1, sp.hp * ratio); s.armor = sp.armor; s.block = sp.block; s.taunt = sp.taunt || 0; s.look = kind;
        const off = formation(i, sp.count);
        s.homeX = t.rally.x + off[0]; s.homeY = t.rally.y + off[1];
      });
    }
    function formation(i, n) {
      if (n <= 1) return [0, 0];
      if (n === 2) return [[-0.22, 0], [0.22, 0]][i];
      return [[0, -0.2], [-0.24, 0.16], [0.24, 0.16]][i] || [0, 0];
    }

    function defaultRally(t) {
      // 사거리 안에서 탑에 가장 가까운 걸을 수 있는 칸
      const tile = RG.grid.nearestEnemyTile(map, blocked, t.x, t.y, t.calc.rallyRange);
      if (!tile) return { x: t.x, y: t.y };
      return { x: tile.c + 0.5, y: tile.r + 0.5 };
    }

    /* =====================================================
     * 명령
     * ===================================================== */
    const fail = (reason) => ({ ok: false, reason });

    function towerAllowed(type) {
      const td = D().towers[type];
      if (!td) return '알 수 없는 탑입니다';
      if (unlocked && !unlocked.has(type)) return '아직 해금되지 않은 탑입니다';
      const ch = challenge;
      if (ch) {
        if (ch.type === 'allowElements' && !ch.value.includes(td.element)) return `이 도전에서는 ${ch.text}`;
        if (ch.type === 'banElements' && ch.value.includes(td.element)) return `이 도전에서는 ${ch.text}`;
        if (ch.type === 'banTowers' && ch.value.includes(type)) return `이 도전에서는 ${ch.text}`;
        if (ch.type === 'noSupport' && td.role === 'support') return '이 도전에서는 지원 탑을 쓸 수 없습니다';
        if (ch.type === 'noBlock' && td.role === 'barracks') return '이 도전에서는 병영을 쓸 수 없습니다';
      }
      return null;
    }

    function occupiedByEnemy(c, r) {
      for (const e of st.enemies) {
        if (e.dead || e.flying) continue;
        if ((e.c === c && e.r === r) || (e.tc === c && e.tr === r) || (Math.floor(e.x) === c && Math.floor(e.y) === r)) return true;
      }
      return false;
    }

    function canBuild(type, c, r) {
      if (st.result) return fail('판이 끝났습니다');
      const bad = towerAllowed(type);
      if (bad) return fail(bad);
      if (!RG.grid.inBounds(map, c, r)) return fail('맵 밖입니다');
      const i = r * map.cols + c;
      const k = map.kinds[i];
      if (!RG.grid.isBuildKind(k)) return fail('여기에는 지을 수 없습니다');
      if (tileTowers[i]) return fail('이미 탑이 있습니다');
      if (soldTile[i] > st.time) return fail('방금 판 자리입니다. 잠시 뒤에 지을 수 있습니다');
      const ch = challenge;
      if (ch && ch.type === 'maxTowers' && st.towers.length >= ch.value) return fail(`탑은 ${ch.value}개까지입니다`);
      if (ch && ch.type === 'noOpenBuild' && k === RG.grid.T.OPEN) return fail('이 도전에서는 공터에 지을 수 없습니다');
      if (ch && ch.type === 'noAdjacent') {
        for (const nb of RG.grid.neighbors8(map, c, r)) if (tileTowers[nb.r * map.cols + nb.c]) return fail('이 도전에서는 탑끼리 붙여 지을 수 없습니다');
      }
      const cost = RG.stats.costOf(type, 1, null, meta);
      if (st.gold < cost) return fail('골드가 부족합니다');
      if (k === RG.grid.T.OPEN) {
        if (occupiedByEnemy(c, r)) return fail('적이 있는 칸에는 지을 수 없습니다');
        blocked[i] = 1;
        const nd = RG.grid.computeFlow(map, blocked);
        blocked[i] = 0;
        for (const s of map.spawns) if (!isFinite(nd[s.r * map.cols + s.c])) return fail('길을 완전히 막을 수 없습니다');
        for (const e of st.enemies) {
          if (e.dead || e.flying) continue;
          if (!isFinite(nd[e.r * map.cols + e.c]) || !isFinite(nd[e.tr * map.cols + e.tc])) return fail('적이 갇히게 되어 지을 수 없습니다');
        }
      }
      return { ok: true, cost };
    }

    function refreshFlow() {
      flow = RG.grid.computeFlow(map, blocked);
      for (const e of st.enemies) {
        if (e.dead || e.flying) continue;
        // 지금 목표 칸이 여전히 좋은지 확인, 아니면 지금 칸에서 다시 고름
        const curD = flow[e.r * map.cols + e.c];
        const tgtD = flow[e.tr * map.cols + e.tc];
        const tgtOk = RG.grid.enemyWalkable(map, blocked, e.tc, e.tr) && (tgtD < curD || (e.tc === e.c && e.tr === e.r));
        if (!tgtOk) {
          e.tc = e.c; e.tr = e.r;
        }
        updateProg(e);
      }
      // 탑 위에 서 있게 된 영웅·병사 옮기기
      for (const u of st.units) {
        if (u.dead) continue;
        const uc = Math.floor(u.x);
        const ur = Math.floor(u.y);
        if (blocked[ur * map.cols + uc]) {
          const tile = RG.grid.nearestHeroTile(map, blocked, u.x, u.y);
          if (tile) { u.x = tile.c + 0.5; u.y = tile.r + 0.5; u.px = u.x; u.py = u.y; u.path = []; }
        }
      }
    }

    function build(cmd) {
      const ok = canBuild(cmd.tower, cmd.c, cmd.r);
      if (!ok.ok) return ok;
      const i = cmd.r * map.cols + cmd.c;
      const td = D().towers[cmd.tower];
      const t = {
        id: nextId++, type: cmd.tower, level: 1, branch: null, c: cmd.c, r: cmd.r, x: cmd.c + 0.5, y: cmd.r + 0.5,
        invested: ok.cost, targetMode: 'first', cd: 0, calc: null, links: [], effects: [], disabledUntil: 0, disabled: false,
        dampened: false, silenced: false, building: st.wave.started, buildUntil: st.wave.started ? st.time + rules.buildTime : 0,
        builtBeforeStart: !st.wave.started, rally: null, soldiers: [], growth: 0, anim: 0,
      };
      st.gold -= ok.cost;
      st.towers.push(t);
      tileTowers[i] = t;
      blocked[i] = 1;
      // 탑 밑에 깔린 덫은 없앰 (밟힐 수 없어 영원히 남던 문제)
      st.traps = st.traps.filter((tr) => !(tr.c === cmd.c && tr.r === cmd.r));
      refreshFlow();
      RG.stats.computeAll(game);
      if (td.role === 'barracks') { t.rally = defaultRally(t); syncSoldiers(t); }
      statsDirty = true;
      ev('build', { towerId: t.id, c: t.c, r: t.r, towerType: t.type });
      return { ok: true, id: t.id };
    }

    function upgradeCost(t, branch) {
      if (t.level >= 4) return null;
      const nextLv = t.level + 1;
      if (nextLv === 4) {
        if (!branch) return null;
        return RG.stats.costOf(t.type, 4, branch, meta);
      }
      return RG.stats.costOf(t.type, nextLv, null, meta);
    }

    function upgrade(cmd) {
      const t = st.towers.find((x) => x.id === cmd.id);
      if (!t) return fail('탑이 없습니다');
      if (st.result) return fail('판이 끝났습니다');
      const isBranch = cmd.type === 'branch';
      if (t.level >= 4) return fail('더 강화할 수 없습니다');
      if (!isBranch && t.level >= 3) return fail('분기를 골라야 합니다');
      if (isBranch && t.level !== 3) return fail('Lv3에서 분기를 고를 수 있습니다');
      if (isBranch && !branchesOk) return fail('분기 강화는 첫 보스를 쓰러뜨린 뒤 열립니다');
      if (isBranch && !['A', 'B'].includes(cmd.branch)) return fail('분기를 고르세요');
      const ch = challenge;
      const nextLv = t.level + 1;
      if (ch && ch.type === 'maxLevel' && nextLv > ch.value) return fail(`이 도전에서는 ${ch.text}`);
      const cost = upgradeCost(t, isBranch ? cmd.branch : null);
      if (st.gold < cost) return fail('골드가 부족합니다');
      st.gold -= cost;
      t.invested += cost;
      t.level = nextLv;
      if (isBranch) t.branch = cmd.branch;
      t.beamState = [];
      statsDirty = true;
      RG.stats.computeAll(game);
      if (D().towers[t.type].role === 'barracks') syncSoldiers(t);
      ev('upgrade', { towerId: t.id, c: t.c, r: t.r, level: t.level, branch: t.branch });
      return { ok: true };
    }

    function sellValue(t) {
      if (!st.wave.started) return t.invested;
      return Math.floor(t.invested * rules.sellRate);
    }

    function sell(cmd) {
      const t = st.towers.find((x) => x.id === cmd.id);
      if (!t) return fail('탑이 없습니다');
      if (st.result) return fail('판이 끝났습니다');
      if (challenge && challenge.type === 'noSell') return fail('이 도전에서는 팔 수 없습니다');
      const value = sellValue(t);
      st.gold += value;
      const i = t.r * map.cols + t.c;
      tileTowers[i] = null;
      blocked[i] = 0;
      if (st.wave.started) soldTile[i] = st.time + rules.soldTileLock;
      st.towers = st.towers.filter((x) => x !== t);
      for (const id of t.soldiers || []) {
        const s = unitById(id);
        if (s) { releaseUnit(s); s.remove = true; s.dead = true; }
      }
      st.traps = st.traps.filter((tr) => tr.owner !== t.id);
      refreshFlow();
      statsDirty = true;
      RG.stats.computeAll(game);
      ev('sell', { towerId: t.id, c: t.c, r: t.r, value });
      return { ok: true, value };
    }

    function setTarget(cmd) {
      const t = st.towers.find((x) => x.id === cmd.id);
      if (!t) return fail('탑이 없습니다');
      if (!D().targetModes[cmd.mode]) return fail('알 수 없는 표적');
      t.targetMode = cmd.mode;
      return { ok: true };
    }

    function rally(cmd) {
      const t = st.towers.find((x) => x.id === cmd.id);
      if (!t || D().towers[t.type].role !== 'barracks') return fail('병영이 아닙니다');
      const c = Math.floor(cmd.x);
      const r = Math.floor(cmd.y);
      if (!RG.grid.enemyWalkable(map, blocked, c, r)) return fail('병사는 길 위에만 설 수 있습니다');
      if (d2(c + 0.5, r + 0.5, t.x, t.y) > t.calc.rallyRange * t.calc.rallyRange) return fail('집결지가 너무 멉니다');
      t.rally = { x: c + 0.5, y: r + 0.5 };
      for (const id of t.soldiers) { const s = unitById(id); if (s) releaseUnit(s); }
      syncSoldiers(t);
      ev('rally', { towerId: t.id, x: t.rally.x, y: t.rally.y });
      return { ok: true };
    }

    function heroMove(cmd) {
      const h = st.hero;
      if (!h) return fail('영웅이 없습니다');
      if (h.dead) return fail('영웅이 쓰러져 있습니다');
      const c = Math.floor(cmd.x);
      const r = Math.floor(cmd.y);
      const path = RG.grid.heroPath(map, blocked, Math.floor(h.x), Math.floor(h.y), c, r);
      if (!path) return fail('영웅이 갈 수 없는 곳입니다');
      releaseUnit(h);
      h.path = path.map((p) => ({ x: p.c + 0.5, y: p.r + 0.5 }));
      if (!h.path.length) h.path = [{ x: c + 0.5, y: r + 0.5 }];
      ev('heroMove', { heroId: h.heroId, x: c + 0.5, y: r + 0.5 });
      return { ok: true };
    }

    function heroSkill(cmd) {
      const h = st.hero;
      if (!h) return fail('영웅이 없습니다');
      if (h.dead) return fail('영웅이 쓰러져 있습니다');
      if (h.skillCd > 0) return fail('기술을 다시 쓸 수 있을 때까지 기다리세요');
      const hd = D().heroes[h.heroId];
      const sk = hd.skill;
      const k = heroStat(h).skillK;
      const src = { heroHit: true, unit: h, element: hd.element, calc: { element: hd.element, dmgBonus: 0, mods: {}, onHit: {} } };
      const x = cmd.x;
      const y = cmd.y;
      switch (sk.id) {
        case 'flame_slam': {
          const tile = RG.grid.heroWalkable(map, blocked, Math.floor(x), Math.floor(y)) ? { c: Math.floor(x), r: Math.floor(y) } : RG.grid.nearestHeroTile(map, blocked, x, y);
          if (!tile) return fail('뛰어내릴 곳이 없습니다');
          releaseUnit(h);
          h.x = tile.c + 0.5; h.y = tile.r + 0.5; h.px = h.x; h.py = h.y; h.path = [];
          const burnSrc = Object.assign({}, src, { calc: { element: 'fire', dmgBonus: 0, mods: {}, onHit: { burn: { dps: sk.burn.dps * k, dur: sk.burn.dur } } } });
          for (const e of enemiesInRadius(h.x, h.y, sk.radius, 'ground')) hitEnemy(e, sk.damage * k, burnSrc, { area: true, noCrit: true });
          ev('splash', { x: h.x, y: h.y, radius: sk.radius, element: 'fire', big: true });
          break;
        }
        case 'dawn_prayer': {
          for (const u of st.units) {
            if (u.dead || u.kind === 'drone') continue;
            if (d2(u.x, u.y, x, y) <= sk.radius * sk.radius) u.hp = Math.min(u.maxHp, u.hp + sk.heal * k);
          }
          const bsrc = Object.assign({}, src, { calc: { element: 'light', dmgBonus: 0, mods: {}, onHit: { blind: sk.blind } } });
          for (const e of enemiesInRadius(x, y, sk.radius)) hitEnemy(e, sk.damage * k, bsrc, { area: true, noCrit: true });
          ev('pulse', { x, y, radius: sk.radius, element: 'light', big: true });
          break;
        }
        case 'frost_volley': {
          ev('warnArea', { x, y, radius: sk.radius, dur: sk.delay, element: 'frost' });
          delayed.push({
            at: st.time + sk.delay,
            fn: () => {
              for (const e of enemiesInRadius(x, y, sk.radius)) {
                damage(e, sk.damage * k, 'frost', src, { area: true });
                if (!e.dead) hardCC(e, 'freeze', sk.freeze);
              }
              ev('pulse', { x, y, radius: sk.radius, element: 'frost', big: true });
            },
          });
          break;
        }
        case 'thunder_drone': {
          const dr = sk.drone;
          st.units.push({ id: nextId++, kind: 'drone', x, y, px: x, py: y, hp: 1, maxHp: 1, armor: 0, blocking: [], block: 0, dead: false, until: st.time + sk.duration, cd: 0, damage: dr.damage * k, interval: dr.interval, range: dr.range, chain: dr.chain, dir: 1 });
          ev('drone', { x, y });
          break;
        }
        case 'earth_wall': {
          const c = Math.floor(x);
          const r = Math.floor(y);
          if (!RG.grid.enemyWalkable(map, blocked, c, r)) return fail('벽은 길 위에만 세울 수 있습니다');
          st.units.push({ id: nextId++, kind: 'wall', x: c + 0.5, y: r + 0.5, px: c + 0.5, py: r + 0.5, hp: sk.wallHp * k, maxHp: sk.wallHp * k, armor: 0.2, blocking: [], block: 99, dead: false, until: st.time + sk.duration, dir: 1 });
          ev('wall', { x: c + 0.5, y: r + 0.5 });
          break;
        }
        case 'shadow_strike': {
          let target = cmd.targetId ? enemyById(cmd.targetId) : null;
          if (!target || target.dead || !targetable(target)) { // 땅속·은신 적은 지정해도 안 됨
            let bd = 1.5 * 1.5;
            for (const e of st.enemies) {
              if (e.dead || !targetable(e)) continue;
              const dd = d2(e.x, e.y, x, y);
              if (dd <= bd) { bd = dd; target = e; }
            }
          }
          if (!target || target.dead) return fail('적을 골라 주세요');
          const ed = D().enemies[target.type];
          const tile = RG.grid.nearestHeroTile(map, blocked, target.x - 0.3, target.y);
          releaseUnit(h);
          if (tile) { h.x = target.flying ? tile.c + 0.5 : target.x - 0.3 * (target.dir || 1); h.y = target.flying ? tile.r + 0.5 : target.y; h.px = h.x; h.py = h.y; }
          if (!RG.grid.heroWalkable(map, blocked, Math.floor(h.x), Math.floor(h.y)) && tile) { h.x = tile.c + 0.5; h.y = tile.r + 0.5; }
          h.path = [];
          if (!ed.boss && target.hp / target.maxHp <= sk.execute) { ev('execute', { x: target.x, y: target.y }); kill(target, src, { executed: true }); } else damage(target, sk.damage * k * (ed.boss ? sk.bossMult : 1), 'dark', src, {});
          ev('splash', { x: target.x, y: target.y, radius: 0.6, element: 'dark' });
          break;
        }
        default:
          return fail('알 수 없는 기술');
      }
      h.skillCd = sk.cooldown * (1 + (meta.heroCooldownPct || 0)) * (h.level >= 5 ? 1 - D().heroLevelBonus.lv5Cooldown : 1);
      h.castAnim = 0.5; // 기술 자세 (그림용)
      ev('heroSkill', { heroId: h.heroId, skill: sk.id, x, y });
      return { ok: true };
    }

    function waveBonusBase(index) {
      return 8 + 2 * index;
    }

    function callWave(auto) {
      const w = st.wave;
      if (st.result) return fail('판이 끝났습니다');
      if (w.index >= w.total) return fail('더 이상 웨이브가 없습니다');
      if (w.index > 0 && w.countdown === null) return fail('이전 웨이브가 아직 나오는 중입니다');
      let bonus = 0;
      if (!auto && w.countdown !== null && w.index > 0) {
        const cd = challenge && challenge.type === 'countdown' ? challenge.value : rules.countdown;
        bonus = Math.ceil(Math.max(0, w.countdown) * (waveBonusBase(w.index) / cd) * (1 + (meta.earlyBonusPct || 0)));
        st.gold += bonus;
        st.stats.goldEarned += bonus;
      }
      const wdef = o.mode === 'endless' ? endlessWave(w.index) : waves[w.index];
      for (const g of wdef.groups) {
        for (let i = 0; i < g.n; i++) w.queue.push({ at: st.time + g.at + i * g.gap, e: g.e, s: g.s, wave: w.index });
      }
      w.queue.sort((a, b) => a.at - b.at);
      w.index += 1;
      w.countdown = null;
      w.started = true;
      // 광산 수입 (감소 규칙)
      const incomes = [];
      for (const t of st.towers) {
        const c = t.calc;
        if (!c || !c.income || t.building) continue;
        if (c.incomeGrowth && w.index > 1) t.growth = Math.min(c.incomeGrowthMax, (t.growth || 0) + c.incomeGrowth);
        incomes.push([c.income + (t.growth || 0), t]);
      }
      incomes.sort((a, b) => b[0] - a[0] || a[1].id - b[1].id);
      incomes.forEach(([inc, t], i) => {
        const f = rules.mineFalloff[Math.min(i, rules.mineFalloff.length - 1)];
        const g = Math.round(inc * f * (1 + (meta.mineIncomePct || 0)));
        st.gold += g;
        st.stats.goldEarned += g;
        ev('gold', { amount: g, x: t.x, y: t.y, towerId: t.id });
      });
      ev('waveStart', { index: w.index, bonus });
      return { ok: true, bonus };
    }

    /* ---------------- 무한 모드 웨이브 ---------------- */
    function endlessWave(index) {
      const pool = D().regionPools[def.region] || D().regionPools[1];
      const wr = U().makeRng((o.seed + index * 7919) >>> 0);
      const groups = [];
      const nGroups = 1 + Math.min(3, Math.floor(index / 3));
      for (let g = 0; g < nGroups; g++) {
        const e = wr.pick(pool);
        const ed = D().enemies[e];
        const n = Math.max(1, Math.round((ed.elite ? 2 : 6) + index * (ed.elite ? 0.25 : 0.8)));
        groups.push({ e, n, gap: ed.elite ? 1.8 : 0.8, at: g * 3, s: wr.int(0, map.spawns.length - 1) });
      }
      st.wave.hpScale = Math.pow(1.09, index);
      return { groups };
    }

    function cmd(c) {
      let res;
      switch (c && c.type) {
        case 'build': res = build(c); break;
        case 'upgrade': case 'branch': res = upgrade(c); break;
        case 'sell': res = sell(c); break;
        case 'target': res = setTarget(c); break;
        case 'rally': res = rally(c); break;
        case 'heroMove': res = heroMove(c); break;
        case 'heroSkill': res = heroSkill(c); break;
        case 'callWave': res = callWave(false); break;
        default: res = fail('알 수 없는 명령');
      }
      if (res.ok) log.push([st.tick, JSON.parse(JSON.stringify(c))]);
      return res;
    }

    /* =====================================================
     * 한 틱
     * ===================================================== */
    function step() {
      try { stepInner(); } finally { st.eventsEnd = st.events.length; }
    }
    function stepInner() {
      // 지난 틱 이후 명령으로 생긴 이벤트는 남기고, 지난 틱의 이벤트만 비움
      st.events = st.events.slice(st.eventsEnd || 0);
      if (st.result) return;
      st.beams = [];
      st.tick += 1;
      st.time = st.tick * DT;
      const time = st.time;

      for (let i = 0; i < st.enemies.length; i++) { const e = st.enemies[i]; e.px = e.x; e.py = e.y; }
      for (const u of st.units) { u.px = u.x; u.py = u.y; }
      for (const p of st.projectiles) { p.px = p.x; p.py = p.y; }

      // 예약된 효과
      for (let i = delayed.length - 1; i >= 0; i--) {
        if (delayed[i].at <= time) { const f = delayed[i].fn; delayed.splice(i, 1); f(); }
      }

      /* --- 웨이브 --- */
      const w = st.wave;
      while (w.queue.length && w.queue[0].at <= time) {
        const q = w.queue.shift();
        spawnEnemy(q.e, q.s, null, q.wave);
      }
      if (w.started && !w.queue.length && w.countdown === null && w.index < w.total) {
        w.countdown = challenge && challenge.type === 'countdown' ? challenge.value : rules.countdown;
      }
      if (w.countdown !== null) {
        w.countdown -= DT;
        if (w.countdown <= 0) callWave(true);
      }

      /* --- 보스 경고 처리 --- */
      if (RG.bosses) RG.bosses.resolveAlerts(game, api);

      /* --- 탑 상태(멈춤·공명 끊김·건설) --- */
      let changed = statsDirty;
      statsDirty = false;
      const silencers = [];
      const dampeners = [];
      const ens = st.enemies;
      for (let i = 0; i < ens.length; i++) {
        const e = ens[i];
        if (e.dead) continue;
        const tr = D().enemies[e.type].traits;
        if (tr.silence) silencers.push(e, tr.silence.radius);
        if (tr.dampen) dampeners.push(e, tr.dampen.radius);
      }
      const freezeLinks = time < st.linksFrozenUntil;
      for (const t of st.towers) {
        if (t.building && time >= t.buildUntil) { t.building = false; changed = true; }
        let sil = false;
        for (let i = 0; i < silencers.length; i += 2) { const e = silencers[i]; const R = silencers[i + 1]; if (d2(e.x, e.y, t.x, t.y) <= R * R) { sil = true; break; } }
        const dis = sil || time < t.disabledUntil;
        let dmp = freezeLinks;
        if (!dmp) for (let i = 0; i < dampeners.length; i += 2) { const e = dampeners[i]; const R = dampeners[i + 1]; if (d2(e.x, e.y, t.x, t.y) <= R * R) { dmp = true; break; } }
        if (dis !== t.disabled || dmp !== t.dampened) { t.disabled = dis; t.dampened = dmp; t.silenced = sil; changed = true; }
      }
      if (changed) RG.stats.computeAll(game);

      /* --- 탐지 --- */
      const detectors = [];
      for (const t of st.towers) if (t.calc && t.calc.detect && !t.disabled && !t.building) detectors.push(t.x, t.y, t.calc.detect);
      if (st.hero && !st.hero.dead && D().heroes[st.hero.heroId].passive.detect) detectors.push(st.hero.x, st.hero.y, D().heroes[st.hero.heroId].passive.detect);
      for (let k = 0; k < ens.length; k++) {
        const e = ens[k];
        if (!e.stealth) { e.revealed = true; continue; }
        let rev = time < e.st.blindUntil;
        if (!rev) for (let i = 0; i < detectors.length; i += 3) { const R = detectors[i + 2]; if (d2(detectors[i], detectors[i + 1], e.x, e.y) <= R * R) { rev = true; break; } }
        e.revealed = rev;
      }

      /* --- 적 --- */
      // 구간마다 작은 함수로 (큰 함수 하나면 최적화가 자꾸 풀려 느린 길로 돌았음 — 결과는 같음)
      for (let i = 0; i < st.enemies.length; i++) stepEnemy(st.enemies[i], time);

      /* --- 붙잡기 --- */
      resolveBlocking();

      /* --- 적의 공격 --- */
      for (let i = 0; i < st.enemies.length; i++) stepEnemyAttack(st.enemies[i], time);

      /* --- 유닛 --- */
      updateUnits(time);

      /* --- 탑 공격 --- */
      for (const t of st.towers) stepTower(t, time);

      /* --- 투사체 --- */
      updateProjectiles();

      /* --- 장판 --- */
      for (const z of st.zones) {
        if (time > z.until) continue;
        const filter = z.kind === 'void' ? null : 'ground';
        const list = enemiesInRadius(z.x, z.y, z.radius, filter);
        for (let i = 0; i < list.length; i++) {
          const e = list[i];
          damage(e, z.dps * DT, z.element, z.src, ZONE_HIT);
          if (z.meltArmor && !e.dead) addShred(e, 'melt', z.meltArmor, z.meltArmor, 0.4);
        }
      }
      if (st.zones.length) compact(st.zones, (z) => time <= z.until);

      /* --- 덫 --- */
      for (let i = st.traps.length - 1; i >= 0; i--) {
        const tr = st.traps[i];
        let victim = null;
        for (const e of st.enemies) {
          if (e.dead || e.flying || e.burrowed) continue;
          if (d2(e.x, e.y, tr.x, tr.y) <= 0.45 * 0.45) { victim = e; break; }
        }
        if (!victim) continue;
        st.traps.splice(i, 1);
        const s = tr.snare;
        const owner = st.towers.find((t) => t.id === tr.owner);
        const src = owner ? { tower: owner, calc: owner.calc, element: 'dark' } : tr.src;
        const victims = [victim];
        if (s.extraTargets) {
          const more = st.enemies.filter((e) => e !== victim && !e.dead && !e.flying && !e.burrowed && d2(e.x, e.y, victim.x, victim.y) <= (s.chainRadius || 1.2) ** 2)
            .sort((a, b) => d2(a.x, a.y, victim.x, victim.y) - d2(b.x, b.y, victim.x, victim.y)).slice(0, s.extraTargets);
          victims.push(...more);
        }
        for (const e of victims) {
          hitEnemy(e, s.damage, src, { area: true });
          if (!e.dead) {
            hardCC(e, 'root', s.root);
            if (s.bleed) addDot(e, 'bleed', `snare:${tr.owner}`, s.bleed.dps * (1 + ((src.calc && src.calc.dmgBonus) || 0)), s.bleed.dur, 'dark', src);
          }
        }
        ev('trapTrigger', { x: tr.x, y: tr.y, element: 'dark' });
      }

      /* --- 지속 피해 --- */
      for (let k = 0; k < st.enemies.length; k++) {
        const e = st.enemies[k];
        if (e.dead) continue;
        const burns = e.st.burns; // 둘 다 먼저 잡아 둠 (불사 부활 때 목록이 새로 바뀌어도 예전처럼)
        const bleeds = e.st.bleeds;
        if (burns.length && tickDots(e, burns, time)) continue;
        if (bleeds.length) tickDots(e, bleeds, time);
      }

      /* --- 정리 --- */
      // 죽은 적·지운 유닛은 자리에서 당겨 지움(순서 그대로) — 매 틱 새 배열을 만들지 않아 쓰레기 수거가 줄어듦
      compact(st.enemies, (e) => !e.dead);
      compact(st.units, (u) => !u.remove);
      if (st.warnings.length > 20) st.warnings.splice(0, st.warnings.length - 20);

      /* --- 공명 과제 --- */
      if (st.task && !st.task.done && st.wave.started && st.tick % 10 === 0) checkTask(false); // 첫 웨이브 전엔 세지 않음 (지었다 100% 환불로 공짜 별 방지)
      for (const t of st.towers) { const ids = t.calc && t.calc.resIds; if (ids) for (let i = 0; i < ids.length; i++) st.stats.resonanceSeen[ids[i]] = true; }

      /* --- 결과 --- */
      if (st.lives <= 0) { st.result = 'lose'; ev('lose', {}); return; }
      if (w.index >= w.total && !w.queue.length && !st.enemies.length) {
        if (st.task && !st.task.done) checkTask(true);
        st.result = 'win';
        if (st.hero) ev('heroWin', { heroId: st.hero.heroId });
        ev('win', {});
        return;
      }
      if (st.tick > st.maxTicks) { st.result = 'lose'; st.timeout = true; ev('lose', { timeout: true }); }
    }

    // 매 틱 수백 번 쓰는 피해 옵션은 하나를 같이 씀 (damage는 옵션을 읽기만 함)
    const DOT_HIT = Object.freeze({ dot: true, quiet: true });
    const ZONE_HIT = Object.freeze({ dot: true, area: true, quiet: true });
    /** 화상·출혈 목록 하나 처리 — 적이 죽으면 true */
    function tickDots(e, list, time) {
      for (let i = list.length - 1; i >= 0; i--) {
        const b = list[i];
        if (time > b.until) { list.splice(i, 1); continue; }
        damage(e, b.dps * DT, b.element, b.src, DOT_HIT);
        if (e.dead) return true;
      }
      return false;
    }

    /** 적 하나의 한 틱: 재생·보호막·치유·굴착·보스·이동 */
    function stepEnemy(e, time) {
      if (e.dead) return;
      const ed = D().enemies[e.type];
      const tr = ed.traits;
      e.pushRes = Math.max(0, e.pushRes - rules.push.decay * DT);
      const healBlocked = time < e.st.purifyUntil || time < e.st.haltUntil;
      const healMul = time < e.st.stillUntil ? 0.5 : 1;
      // 재생
      if (tr.regen && !healBlocked && time - e.lastHurt >= rules.regenDelay && e.hp < e.maxHp) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * tr.regen * healMul * DT);
      // 보호막 재생
      if (tr.shield && !healBlocked && time - e.lastHurt >= tr.shield.delay && e.shield < e.maxShield) e.shield = Math.min(e.maxShield, e.shield + e.maxShield * tr.shield.rate * DT);
      // 치유사
      if (tr.healer && canAct(e) && !e.burrowed) {
        e.healCd -= DT;
        if (e.healCd <= 0) {
          e.healCd = tr.healer.every;
          let any = false;
          for (const o3 of st.enemies) {
            if (o3.dead || d2(o3.x, o3.y, e.x, e.y) > tr.healer.radius ** 2) continue;
            if (time < o3.st.purifyUntil || time < o3.st.haltUntil) continue;
            const m = time < o3.st.stillUntil ? 0.5 : 1;
            const before = o3.hp;
            o3.hp = Math.min(o3.maxHp, o3.hp + o3.maxHp * tr.healer.pct * m);
            if (o3.hp > before) any = true;
          }
          e.castAnim = 0.45;
          if (any) ev('enemyHeal', { x: e.x, y: e.y, radius: tr.healer.radius });
        }
      }
      // 보호막 부여
      if (tr.shielder && canAct(e) && !e.burrowed) {
        e.shieldCd -= DT;
        if (e.shieldCd <= 0) {
          e.shieldCd = tr.shielder.every;
          for (const o3 of st.enemies) {
            if (o3.dead || o3 === e || d2(o3.x, o3.y, e.x, e.y) > tr.shielder.radius ** 2) continue;
            if (time < o3.st.purifyUntil) continue;
            const amt = o3.maxHp * tr.shielder.pct;
            if (amt > o3.shield) { o3.shield = amt; o3.maxShield = Math.max(o3.maxShield, amt); }
          }
          e.castAnim = 0.45;
          ev('enemyShield', { x: e.x, y: e.y, radius: tr.shielder.radius });
        }
      }
      // 굴착
      if (tr.burrow) {
        e.burrowT += DT;
        if (!e.burrowed && e.burrowT >= tr.burrow.every) { e.burrowed = true; e.burrowT = 0; releaseEnemy(e); ev('burrow', { enemyId: e.id, x: e.x, y: e.y }); } else if (e.burrowed && e.burrowT >= tr.burrow.dur) { e.burrowed = false; e.burrowT = 0; ev('unburrow', { enemyId: e.id, x: e.x, y: e.y }); }
      }
      // 보스
      if (e.boss && RG.bosses) RG.bosses.update(game, e, api);
      if (e.dead) return;
      // 이동
      if (isFeared(e)) { moveBack(e, enemySpeed(e) * rules.fearSpeed * DT); updateProg(e); return; } // 공포: 왔던 길을 거꾸로
      if (e.blockedBy || !canMove(e)) { updateProg(e); return; }
      const sp = enemySpeed(e) * DT;
      e.walkT += sp;
      moveGround(e, sp); // 비행 적도 길을 따라감(붙잡히지 않을 뿐)
      if (!e.dead) updateProg(e);
    }

    /** 적 하나의 공격 (붙잡은 병사 근접·원거리) */
    function stepEnemyAttack(e, time) {
      // 그림용 타이머 (규칙에는 쓰지 않음)
      if (e.attackAnim) e.attackAnim = Math.max(0, e.attackAnim - DT);
      if (e.castAnim) e.castAnim = Math.max(0, e.castAnim - DT);
      e.aiming = false;
      if (e.dead || !canAct(e) || e.burrowed) return;
      const ed = D().enemies[e.type];
      if (e.blockedBy && ed.melee) {
        if (e.meleeCd <= 0.4) e.aiming = true; // 휘두르기 직전 (그림용)
        e.meleeCd -= DT;
        if (e.meleeCd <= 0) {
          e.meleeCd = ed.melee.interval;
          const u = unitById(e.blockedBy);
          if (u && !u.dead) { hurtUnit(u, ed.melee.damage, e); e.attackAnim = 0.25; e.dir = u.x > e.x ? 1 : -1; }
        }
      }
      if (ed.traits.ranged && time >= e.st.blindUntil) {
        e.rangedCd -= DT;
        // 던지기 직전 자세 (그림용): 곧 쏠 때 사거리 안에 상대가 있으면
        if (e.rangedCd <= 0.45 && e.rangedCd > 0) {
          const R2 = ed.traits.ranged.range ** 2;
          for (const u of st.units) if (!u.dead && u.kind !== 'drone' && u.kind !== 'wall' && d2(u.x, u.y, e.x, e.y) <= R2) { e.aiming = true; break; }
        }
        if (e.rangedCd <= 0) {
          const R = ed.traits.ranged.range;
          let best = null;
          let bd = R * R;
          for (const u of st.units) {
            if (u.dead || u.kind === 'drone' || u.kind === 'wall') continue;
            const dd = d2(u.x, u.y, e.x, e.y);
            if (dd <= bd) { bd = dd; best = u; }
          }
          if (best) {
            e.rangedCd = ed.traits.ranged.interval;
            e.attackAnim = 0.3; e.dir = best.x > e.x ? 1 : -1;
            hurtUnit(best, ed.traits.ranged.damage, e);
            ev('enemyShot', { enemyId: e.id, x: e.x, y: e.y, tx: best.x, ty: best.y });
          } else e.rangedCd = 0.2;
        }
      }
    }

    /** 탑 하나의 공격 한 틱 */
    function stepTower(t, time) {
      t.anim = Math.max(0, t.anim - DT);
      const c = t.calc;
      if (!c || t.disabled || t.building) return;
      if (c.role === 'barracks') {
        for (const id of t.soldiers) {
          const s = unitById(id);
          if (s && s.dead && !s.remove && time >= s.respawnAt) {
            s.dead = false; s.hp = s.maxHp; s.x = t.x; s.y = t.y; s.px = s.x; s.py = s.y;
            ev('unitSpawn', { unitId: s.id });
          }
        }
        return;
      }
      if (c.discharge) {
        t.dischargeCd = (t.dischargeCd || 0) - DT;
        if (t.dischargeCd <= 0) {
          const list = enemiesInRadius(t.x, t.y, c.discharge.radius);
          if (list.length) {
            t.dischargeCd = c.discharge.every;
            for (const e of list) damage(e, c.discharge.damage, 'storm', { tower: t, calc: c }, { secondary: true, area: true });
            ev('pulse', { towerId: t.id, x: t.x, y: t.y, radius: c.discharge.radius, element: 'storm' });
          }
        }
      }
      if (c.kind === 'none') return;
      if (c.kind === 'beam') { updateTowerBeams(t); return; }
      if (c.kind === 'sweep') { updateSweep(t); return; }
      if (c.cyclone) {
        t.cycloneCd = (t.cycloneCd == null ? c.cyclone.every * 0.5 : t.cycloneCd) - DT;
        if (t.cycloneCd <= 0) {
          const tg = towerTargets(t, 1, c.range, {});
          const g = tg.find((e) => !e.flying);
          if (g) {
            t.cycloneCd = c.cyclone.every;
            for (const e of enemiesInRadius(g.x, g.y, c.cyclone.radius, 'ground')) { push(e, c.cyclone.dist); hardCC(e, 'lift', c.cyclone.lift); }
            ev('cyclone', { towerId: t.id, x: g.x, y: g.y, radius: c.cyclone.radius });
          }
        }
      }
      t.cd -= DT;
      if (t.cd <= 0) {
        if (fireTower(t)) { t.cd += c.interval; t.anim = 0.25; } else t.cd = 0;
      }
    }

    function updateProjectiles() {
      const keep = [];
      for (const p of st.projectiles) {
        if (p.kind === 'shell') {
          p.t += DT;
          const k = Math.min(1, p.t / p.flight);
          p.x = p.sx + (p.tx - p.sx) * k;
          p.y = p.sy + (p.ty - p.sy) * k;
          p.h = Math.sin(k * Math.PI) * 1.2;
          if (k >= 1) {
            const c = p.src.calc;
            for (const e of enemiesInRadius(p.tx, p.ty, c.splash || 0.8, 'ground')) hitEnemy(e, p.base, p.src, { area: true });
            if (c.zone) addZone(c.zone, p.tx, p.ty, p.src, false);
            ev('splash', { x: p.tx, y: p.ty, radius: c.splash || 0.8, element: p.element });
            continue;
          }
          keep.push(p);
          continue;
        }
        if (p.kind === 'orb') {
          const dd = dist(p.x, p.y, p.tx, p.ty);
          const s = p.speed * DT;
          if (dd <= s) {
            const c = p.src.calc;
            const nZ = c.zones || 1;
            for (let i = 0; i < nZ; i++) {
              let x = p.tx;
              let y = p.ty;
              if (nZ > 1) { const a = (i / nZ) * Math.PI * 2 + 0.5; x += Math.cos(a) * (c.spread || 0.9) * 0.6; y += Math.sin(a) * (c.spread || 0.9) * 0.6; }
              addZone(c.zone, x, y, p.src, false);
            }
            ev('splash', { x: p.tx, y: p.ty, radius: c.zone.radius, element: 'dark' });
            continue;
          }
          p.x += ((p.tx - p.x) / dd) * s;
          p.y += ((p.ty - p.y) / dd) * s;
          keep.push(p);
          continue;
        }
        // 유도 투사체
        const e = enemyById(p.targetId);
        if (e && !e.dead && !e.burrowed) { p.tx = e.x; p.ty = e.y - (e.flying ? 0.5 : 0.15); }
        const dd = dist(p.x, p.y, p.tx, p.ty);
        const s = p.speed * DT;
        if (dd <= s + 0.05) {
          if (e && !e.dead && !e.burrowed) {
            if (p.heroHit) heroHitEnemy(e, p);
            else {
              hitEnemy(e, p.base, p.src, {});
              const c = p.src.calc;
              if (c.splash) for (const o3 of enemiesInRadius(e.x, e.y, c.splash)) if (o3 !== e) hitEnemy(o3, p.base, p.src, { area: true, procMult: 0 });
            }
          }
          continue;
        }
        p.x += ((p.tx - p.x) / dd) * s;
        p.y += ((p.ty - p.y) / dd) * s;
        keep.push(p);
      }
      st.projectiles = keep;
    }

    /* ---------------- 유닛 갱신 ---------------- */
    function moveUnitToward(u, x, y, speed) {
      const dd = dist(u.x, u.y, x, y);
      const s = speed * DT;
      if (dd <= s) { u.x = x; u.y = y; return true; }
      u.x += ((x - u.x) / dd) * s;
      u.y += ((y - u.y) / dd) * s;
      if (Math.abs(x - u.x) > 0.01) u.dir = x > u.x ? 1 : -1;
      return false;
    }

    function heroHitEnemy(e, p) {
      const h = st.hero;
      const hd = D().heroes[h.heroId];
      const src = { heroHit: true, unit: h, element: hd.element, calc: { element: hd.element, dmgBonus: 0, mods: {}, onHit: {} } };
      if (hd.passive.id === 'cold_aim') src.heroCrit = { chance: hd.passive.critChance, mult: hd.passive.critMult };
      hitEnemy(e, p.base, src, { noCrit: true });
    }

    function updateUnits(time) {
      for (const u of st.units) {
        if (u.kind === 'hero') { updateHero(u, time); continue; }
        if (u.kind === 'wall') {
          if (time >= u.until && !u.dead) { u.dead = true; u.remove = true; releaseUnit(u); ev('unitDown', { unitId: u.id, x: u.x, y: u.y }); }
          continue;
        }
        if (u.kind === 'drone') {
          if (time >= u.until) { u.remove = true; u.dead = true; continue; }
          u.cd -= DT;
          if (u.cd <= 0) {
            let best = null;
            let bd = u.range * u.range;
            for (const e of st.enemies) {
              if (!targetable(e) || !attackable(e, 'storm')) continue;
              const dd = d2(e.x, e.y, u.x, u.y);
              if (dd <= bd) { bd = dd; best = e; }
            }
            if (best) {
              u.cd = u.interval;
              const src = { heroHit: true, unit: u, element: 'storm', calc: { element: 'storm', dmgBonus: 0, mods: {}, onHit: {} } };
              const pts = [[u.x, u.y - 0.5], [best.x, best.y]];
              hitEnemy(best, u.damage, src, { noCrit: true });
              let cur = best;
              const seen = new Set([best.id]);
              let dmg = u.damage;
              for (let k = 0; k < u.chain.count; k++) {
                dmg *= 1 - u.chain.falloff;
                let nb = null;
                let nd = u.chain.radius ** 2;
                for (const e of st.enemies) {
                  if (seen.has(e.id) || !targetable(e) || !attackable(e, 'storm')) continue;
                  const dd = d2(e.x, e.y, cur.x, cur.y);
                  if (dd <= nd) { nd = dd; nb = e; }
                }
                if (!nb) break;
                seen.add(nb.id);
                pts.push([nb.x, nb.y]);
                hitEnemy(nb, dmg, src, { noCrit: true, procMult: 0.5 });
                cur = nb;
              }
              ev('chain', { points: pts, element: 'storm' });
            }
          }
          continue;
        }
        if (u.kind !== 'soldier' || u.dead) continue;
        if (u.stunUntil > time) continue;
        const t = st.towers.find((x) => x.id === u.owner);
        if (!t) continue;
        const sp = t.calc.soldiers;
        // 회복 (성소)
        for (const s of st.towers) {
          if (s.calc && s.calc.heal && !s.disabled && !s.building && d2(s.x, s.y, u.x, u.y) <= s.calc.heal.radius ** 2) { u.hp = Math.min(u.maxHp, u.hp + s.calc.heal.hps * DT); break; }
        }
        const target = u.blocking.length ? enemyById(u.blocking[0]) : null;
        if (target && !target.dead) {
          const reach = 0.42 + target.size * 0.2;
          u.engaged = dist(u.x, u.y, target.x, target.y) <= reach; // 그림용
          if (!u.engaged) moveUnitToward(u, target.x, target.y, 2.0);
          else {
            u.dir = target.x > u.x ? 1 : -1;
            u.cd -= DT;
            if (u.cd <= 0) {
              u.cd = sp.interval;
              u.attackAnim = 0.25;
              const src = { tower: t, calc: Object.assign({}, t.calc, { crit: sp.crit || t.calc.crit }), element: 'earth' };
              hitEnemy(target, sp.damage, src, {});
            }
          }
        } else {
          u.engaged = false;
          moveUnitToward(u, u.homeX, u.homeY, 1.8);
          u.cd = Math.max(u.cd - DT, 0);
        }
        u.attackAnim = Math.max(0, (u.attackAnim || 0) - DT);
      }
    }

    function updateHero(h, time) {
      const hd = D().heroes[h.heroId];
      h.attackAnim = Math.max(0, h.attackAnim - DT);
      if (h.castAnim) h.castAnim = Math.max(0, h.castAnim - DT);
      h.skillCd = Math.max(0, h.skillCd - DT);
      if (h.dead) {
        if (time >= h.downUntil) {
          h.dead = false;
          h.hp = h.maxHp;
          const tile = RG.grid.nearestHeroTile(map, blocked, map.lantern.x - 0.6, map.lantern.y);
          h.x = tile ? tile.c + 0.5 : map.lantern.x; h.y = tile ? tile.r + 0.5 : map.lantern.y; h.px = h.x; h.py = h.y;
          h.path = [];
          ev('heroRevive', { heroId: h.heroId, x: h.x, y: h.y });
        }
        return;
      }
      // 회복: 패시브, 성소
      if (hd.passive.regen) h.hp = Math.min(h.maxHp, h.hp + h.maxHp * hd.passive.regen * DT);
      for (const s of st.towers) {
        if (s.calc && s.calc.heal && !s.disabled && !s.building && d2(s.x, s.y, h.x, h.y) <= s.calc.heal.radius ** 2) { h.hp = Math.min(h.maxHp, h.hp + s.calc.heal.hps * DT); break; }
      }
      if (h.stunUntil > time) return;
      // 이동
      if (h.path.length) {
        const p = h.path[0];
        if (moveUnitToward(h, p.x, p.y, hd.speed)) h.path.shift();
        h.walking = true;
        return;
      }
      h.walking = false;
      // 공격
      h.cd -= DT;
      if (h.cd > 0) return;
      const stat = heroStat(h);
      let target = null;
      if (h.blocking.length) target = enemyById(h.blocking[0]);
      if (!target || target.dead) {
        let bd = Infinity;
        const R = hd.melee ? hd.range + 0.35 : hd.range;
        for (const e of st.enemies) {
          if (e.dead || e.burrowed) continue;
          if (!targetable(e) && e.blockedBy !== h.id) continue;
          if (hd.targets === 'ground' && e.flying) continue;
          if (!attackable(e, hd.element)) continue;
          const dd = d2(e.x, e.y, h.x, h.y);
          if (dd > R * R) continue;
          const key = hd.melee ? dd : e.prog;
          if (key < bd) { bd = key; target = e; }
        }
      }
      if (!target) { h.cd = 0; return; }
      h.cd = hd.interval;
      h.attackAnim = 0.3;
      h.dir = target.x > h.x ? 1 : -1;
      const src = { heroHit: true, unit: h, element: hd.element, calc: { element: hd.element, dmgBonus: 0, mods: {}, onHit: {}, crit: hd.crit || null } };
      if (hd.melee) {
        if (hd.splash) {
          for (const e of enemiesInRadius(target.x, target.y, hd.splash, 'ground')) hitEnemy(e, stat.damage, src, {});
        } else hitEnemy(target, stat.damage, src, {});
        ev('heroAttack', { heroId: h.heroId, x: target.x, y: target.y, element: hd.element, melee: true });
      } else if (hd.chain) {
        const pts = [[h.x, h.y - 0.5], [target.x, target.y]];
        hitEnemy(target, stat.damage, src, { noCrit: true });
        let cur = target;
        const seen = new Set([target.id]);
        let dmg = stat.damage;
        for (let k = 0; k < hd.chain.count; k++) {
          dmg *= 1 - hd.chain.falloff;
          let nb = null;
          let nd = hd.chain.radius ** 2;
          for (const e of st.enemies) {
            if (seen.has(e.id) || !targetable(e) || !attackable(e, hd.element)) continue;
            const dd = d2(e.x, e.y, cur.x, cur.y);
            if (dd <= nd) { nd = dd; nb = e; }
          }
          if (!nb) break;
          seen.add(nb.id);
          pts.push([nb.x, nb.y]);
          hitEnemy(nb, dmg, src, { noCrit: true, procMult: 0.5 });
          cur = nb;
        }
        ev('chain', { points: pts, element: hd.element });
      } else {
        st.projectiles.push({ id: nextId++, kind: 'heroShot', heroId: h.heroId, element: hd.element, x: h.x, y: h.y - 0.45, px: h.x, py: h.y - 0.45, targetId: target.id, tx: target.x, ty: target.y, speed: hd.projSpeed || 9, base: stat.damage, heroHit: true });
        ev('heroAttack', { heroId: h.heroId, x: target.x, y: target.y, element: hd.element });
      }
    }

    /* ---------------- 공명 과제 ---------------- */
    function resonanceSnapshot() {
      const distinct = new Set();
      let links = 0;
      let stack = 0;
      const pureEls = new Set();
      for (const t of st.towers) {
        links += t.links.length;
        stack = Math.max(stack, t.effects.length);
        for (const k of t.effects) {
          const res = D().resonance[k];
          distinct.add(res.id);
          if (k === 'pure') pureEls.add(D().towers[t.type].element);
        }
      }
      return { distinct, links: links / 2, stack, pureEls };
    }

    function checkTask(atWin) {
      const tk = st.task;
      const td = tk.def;
      const s = resonanceSnapshot();
      let val = 0;
      let need = td.n || 1;
      switch (td.type) {
        case 'links': val = s.links; break;
        case 'distinct': val = s.distinct.size; break;
        case 'effects': val = td.ids.filter((id) => s.distinct.has(id)).length; need = td.ids.length; break;
        case 'stack': val = s.stack; break;
        case 'amp': for (const t of st.towers) if (t.type === td.tower) val = Math.max(val, t.effects.length); break;
        case 'elementEffects': {
          const el = td.element;
          for (const [k, res] of Object.entries(D().resonance)) {
            if (!s.distinct.has(res.id)) continue;
            if (k === 'pure') { if (s.pureEls.has(el)) val += 1; } else if (k.split('+').includes(el)) val += 1;
          }
          break;
        }
        case 'pureAll': val = s.pureEls.size; need = 6; break;
        case 'allElements': {
          if (!atWin) return;
          const els = new Set(st.towers.map((t) => D().towers[t.type].element));
          val = els.size; need = 6;
          break;
        }
        default: break;
      }
      tk.best = Math.max(tk.best, val);
      tk.need = need;
      if (val >= need) { tk.done = true; ev('taskDone', {}); }
    }

    /* ---------------- 정보 ---------------- */
    function towerInfo(id) {
      const t = st.towers.find((x) => x.id === id);
      if (!t) return null;
      const td = D().towers[t.type];
      const name = t.level >= 4 ? td.branches[t.branch].name : td.name;
      const next = [];
      const ch = challenge;
      const maxLv = ch && ch.type === 'maxLevel' ? ch.value : 4;
      if (t.level < 3 && t.level < maxLv) next.push({ type: 'upgrade', level: t.level + 1, cost: upgradeCost(t), spec: RG.stats.specOf(t.type, t.level + 1) });
      if (t.level === 3 && maxLv >= 4) {
        for (const b of ['A', 'B']) next.push({ type: 'branch', branch: b, cost: upgradeCost(t, b), spec: td.branches[b], locked: !branchesOk });
      }
      return {
        tower: t, def: td, name, level: t.level, branch: t.branch, calc: t.calc, next, sellValue: sellValue(t),
        canSell: !(ch && ch.type === 'noSell'),
        effects: t.effects.map((k) => D().resonance[k]),
        damageDealt: st.stats.damageByTower[t.id] || 0,
      };
    }

    function previewLinks(type, c, r) {
      const td = D().towers[type];
      if (!td || td.noResonance) return [];
      const out = [];
      for (const nb of RG.grid.neighbors8(map, c, r)) {
        const n = tileTowers[nb.r * map.cols + nb.c];
        if (!n || D().towers[n.type].noResonance) continue;
        const key = RG.stats.resKey(td.element, D().towers[n.type].element);
        out.push({ c: nb.c, r: nb.r, towerId: n.id, key, res: D().resonance[key] });
      }
      return out;
    }

    function hash() {
      const parts = [st.tick, Math.round(st.gold), st.lives, st.wave.index, st.enemies.length, st.towers.length];
      for (const e of st.enemies) parts.push(e.type, Math.round(e.x * 100), Math.round(e.y * 100), Math.round(e.hp * 10), Math.round(e.shield * 10));
      for (const t of st.towers) parts.push(t.type, t.c, t.r, t.level, t.branch || '-', Math.round(t.cd * 100));
      for (const u of st.units) parts.push(u.kind, Math.round(u.x * 100), Math.round(u.y * 100), Math.round(u.hp * 10));
      return U().hashStr(parts.join('|'));
    }

    /** 보스 모듈에 넘기는 내부 기능 */
    const api = {
      ev, damage, hardCC, applySlow, advance, spawnEnemy, disableTower, releaseEnemy, hurtUnit, enemiesInRadius,
      rng, get flow() { return flow; }, blocked, unitById,
      freezeLinks: (dur) => { st.linksFrozenUntil = Math.max(st.linksFrozenUntil, st.time + dur); },
    };

    // 시작
    createHero();
    RG.stats.computeAll(game);

    Object.assign(game, {
      step, cmd, canBuild, previewLinks, towerInfo, hash, upgradeCost, sellValue,
      checkTask, resonanceSnapshot, api, blocked,
    });
    Object.defineProperty(game, 'flow', { get: () => flow, enumerable: true });
    return game;
  }

  /** 기록 재현: untilTick까지 진행한 게임을 돌려줌 */
  function replay(opts, log, untilTick) {
    const g = create(opts);
    let li = 0;
    while (g.state.tick < untilTick && !g.state.result) {
      while (li < log.length && log[li][0] <= g.state.tick) { g.cmd(log[li][1]); li += 1; }
      g.step();
    }
    while (li < log.length && log[li][0] <= g.state.tick) { g.cmd(log[li][1]); li += 1; }
    return g;
  }

  return { create, replay, DT };
})();
