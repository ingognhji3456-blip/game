'use strict';

/*
 * 봇 — 무작위 / 그리디 / 계획(탐색용)
 *   node tests/bots.js --map 1-1 --bot greedy --runs 5
 * 라이브러리로: const { runBot, searchPlan } = require('./bots');
 */
const { loadGame } = require('./load');

function makeEnv(RG) {
  const D = RG.data;

  function routeTiles(g) {
    // 각 입구에서 흐름장을 따라가는 실제 길 칸 (갈림길은 여러 lane으로)
    const set = new Map();
    const m = g.map;
    for (const s of m.spawns) {
      for (let lane = 0; lane < 3; lane++) {
        let c = s.c;
        let r = s.r;
        let guard = 0;
        while (guard++ < 400) {
          const k = r * m.cols + c;
          set.set(k, (set.get(k) || 0) + 1);
          const nx = RG.grid.nextStep(m, g.flow, g.blocked, c, r, lane);
          if (!nx) break;
          c = nx.c; r = nx.r;
        }
      }
    }
    return [...set.keys()].map((k) => ({ c: k % m.cols, r: Math.floor(k / m.cols) }));
  }

  // 비행 적도 지상 길을 따라가므로(2026-11-10 개정) 따로 셀 비행 경로가 없음
  function airSegs() { return []; }

  function segDist(px, py, ax, ay, bx, by) {
    const vx = bx - ax; const vy = by - ay; const L = vx * vx + vy * vy;
    let t = L ? ((px - ax) * vx + (py - ay) * vy) / L : 0;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (ax + vx * t), py - (ay + vy * t));
  }

  function coverage(route, air, c, r, range, targets) {
    if (!range) return 0;
    let n = 0;
    const x = c + 0.5; const y = r + 0.5;
    for (const t of route) if ((t.c + 0.5 - x) ** 2 + (t.r + 0.5 - y) ** 2 <= range * range) n += 1; // 지상·비행 모두 같은 길
    if (targets !== 'ground') for (const s of air) if (segDist(x, y, ...s) <= range) n += 2 * Math.min(range, 3);
    return n;
  }

  function buildableTiles(g, allowOpen) {
    const out = [];
    const m = g.map;
    for (let r = 0; r < m.rows; r++) {
      for (let c = 0; c < m.cols; c++) {
        const k = m.kinds[r * m.cols + c];
        if (k === RG.grid.T.BUILD || (allowOpen && k === RG.grid.T.OPEN)) if (!g.tileTower(c, r)) out.push({ c, r, open: k === RG.grid.T.OPEN });
      }
    }
    return out;
  }

  /** 길 만들기 맵: 공터를 지그재그 벽으로 막는 칸 목록 (사람이 흔히 쓰는 미로) */
  function mazePlan(g) {
    const m = g.map;
    const open = [];
    for (let r = 0; r < m.rows; r++) for (let c = 0; c < m.cols; c++) if (m.kinds[r * m.cols + c] === RG.grid.T.OPEN) open.push({ c, r });
    if (open.length < 12) return [];
    const c0 = Math.min(...open.map((t) => t.c)); const c1 = Math.max(...open.map((t) => t.c));
    const r0 = Math.min(...open.map((t) => t.r)); const r1 = Math.max(...open.map((t) => t.r));
    const isOpen = (c, r) => m.kinds[r * m.cols + c] === RG.grid.T.OPEN;
    const plan = [];
    let k = 0;
    // 세로 벽 (가로로 긴 공터) 또는 가로 벽 (세로로 긴 공터)
    if (c1 - c0 >= r1 - r0) {
      for (let c = c0 + 1; c <= c1 - 1; c += 2, k++) {
        const gap = k % 2 === 0 ? r1 : r0;
        for (let r = r0; r <= r1; r++) if (r !== gap && isOpen(c, r)) plan.push({ c, r });
      }
    } else {
      for (let r = r0 + 1; r <= r1 - 1; r += 2, k++) {
        const gap = k % 2 === 0 ? c1 : c0;
        for (let c = c0; c <= c1; c++) if (c !== gap && isOpen(c, r)) plan.push({ c, r });
      }
    }
    return plan;
  }

  const TYPE_W = {
    ember_archer: 1.0, flame_mortar: 1.0, frost_crystal: 0.85, ice_ballista: 1.0, winter_bell: 0.7, lightning_rod: 1.0, gale_cannon: 0.7,
    stone_barracks: 0.75, quake_hammer: 1.0, sun_lens: 1.0, radiance_spire: 0.95, hex_spire: 0.9, void_orb: 0.9, shadow_snare: 0.8,
  };

  /** 탑 하나의 대략적인 가치(초당 피해 비슷한 것) */
  function towerValue(g, type, level, branch, c, r, route, air, W) {
    const spec = RG.stats.specOf(type, level, branch);
    const td = D.towers[type];
    if (td.role === 'barracks') return coverage(route, air, c, r, spec.rallyRange, 'ground') * 2 + spec.soldiers.count * spec.soldiers.damage * 0.5;
    if (td.role !== 'attack') return 0;
    let dps = 0;
    if (td.kind === 'beam') dps = spec.damage * 1.8;
    else if (td.kind === 'orb') dps = (spec.zone.dps * spec.zone.dur) / spec.interval * 1.5;
    else if (td.kind === 'snare') dps = (spec.snare.damage * spec.snare.maxTraps) / spec.interval;
    else dps = (spec.damage * (spec.multishot || 1)) / spec.interval;
    if (spec.splash || td.kind === 'pulse' || spec.chain || spec.pierce) dps *= 1.8;
    if (spec.zone && td.kind !== 'orb') dps += spec.zone.dps * 0.8;
    // 저주: 같은 적을 때리는 다른 탑 피해까지 늘림 → 이웃 화력의 일부로 셈
    const curse = (spec.onHit && spec.onHit.curse) || null;
    if (curse) dps *= 1 + curse.pct * 4;
    const cov = coverage(route, air, c, r, spec.range || 1.5, spec.targets || td.targets);
    // 이 맵의 적 구성에 대한 상성(원소 친화·비행)
    const mix = enemyMix(g);
    // 갑옷을 덜 타는 정도: 화상(지속 피해)·갑옷 파쇄·장판은 갑옷에 덜 막힘
    const oh = spec.onHit || {};
    const ign = td.kind === 'orb' ? 0.6 : (oh.shred || spec.shred) ? 0.5 : (oh.burn || spec.burn) ? 0.3 : 0;
    let fit = 0;
    for (const [e, w] of mix) {
      const ed = D.enemies[e];
      const tg = spec.targets || td.targets;
      if (ed.traits.flying && tg === 'ground') continue;
      if (!ed.traits.flying && tg === 'air') continue;
      const a = ed.affinity[td.element];
      const armorK = 1 - (ed.armor || 0) * (1 - ign * (ed.traits.shredResist && (oh.shred || spec.shred) ? 0.5 : 1));
      fit += w * armorK * (a === 'weak' ? 1.5 : a === 'resist' ? 0.5 : a === 'immune' || a === 'absorb' ? 0 : 1);
    }
    return dps * Math.sqrt(cov + 0.5) * ((W && W[type]) || TYPE_W[type] || 0.8) * fit;
  }

  const mixCache = new Map();
  function enemyMix(g) {
    if (mixCache.has(g.def.id)) return mixCache.get(g.def.id);
    const hp = new Map();
    let total = 0;
    for (const w of RG.grid.parseWaves(g.def.waves || [])) for (const gr of w.groups) {
      const ed = D.enemies[gr.e];
      const v = ed.hp * gr.n * (1 + ed.armor);
      hp.set(gr.e, (hp.get(gr.e) || 0) + v);
      total += v;
    }
    const out = [...hp].map(([e, v]) => [e, v / (total || 1)]);
    mixCache.set(g.def.id, out);
    return out;
  }

  /** 그리디 봇 스타일 (탐색 초기값을 다양하게) */
  const STYLES = [
    {},
    { W: { ember_archer: 0.7, flame_mortar: 1.5, quake_hammer: 1.3 } },
    { W: { stone_barracks: 1.6, ember_archer: 0.8 }, res: 0.25 },
    { W: { frost_crystal: 1.4, winter_bell: 1.2, lightning_rod: 1.3 }, res: 0.3 },
    { res: 0.45, same: 0.4 },
    { mine: 3, W: { flame_mortar: 1.2 } },
    { up: 2.2 }, // 소수 정예: 새로 짓기보다 강화·분기
  ];

  /* ---------------- 봇들 ---------------- */
  function randomBot(g, rng) {
    let t = 0;
    return () => {
      t += 1;
      if (t % 15) return;
      const st = g.state;
      const types = g.opts.towers || D.towerOrder;
      if (rng() < 0.6) {
        const tiles = buildableTiles(g, true);
        if (tiles.length) {
          const tile = tiles[Math.floor(rng() * tiles.length)];
          g.cmd({ type: 'build', tower: types[Math.floor(rng() * types.length)], c: tile.c, r: tile.r });
        }
      } else if (st.towers.length) {
        const tw = st.towers[Math.floor(rng() * st.towers.length)];
        if (tw.level < 3) g.cmd({ type: 'upgrade', id: tw.id }); else g.cmd({ type: 'branch', id: tw.id, branch: rng() < 0.5 ? 'A' : 'B' });
      }
      if (st.wave.index === 0 && st.tick > 60) g.cmd({ type: 'callWave' });
    };
  }

  function greedyBot(g, rng, options = {}) {
    const W = options.W || null;
    const RES = options.res != null ? options.res : 0.12;
    const SAME = options.same != null ? options.same : 0.12;
    const MINES = options.mine != null ? options.mine : 2;
    const UP = options.up != null ? options.up : 1;
    let t = 0;
    let route = routeTiles(g);
    let air = airSegs(g);
    // 도전 규칙으로 못 짓는 탑(원소 제한·지원 금지 등)은 처음부터 빼 둠 — 실패하는 짓기만 고르다 첫 웨이브를 영영 안 부르던 것
    const types = (g.opts.towers || D.towerOrder).filter((x) => D.towers[x] && (!g.towerAllowed || g.towerAllowed(x) == null));
    const hasStealth = RG.grid.parseWaves(g.def.waves || []).some((w) => w.groups.some((gr) => D.enemies[gr.e].traits.stealth));
    const allowOpen = g.def.type !== 'fixed';
    const maze = options.noMaze ? [] : mazePlan(g);
    let mazeI = 0;
    // 도전 "Lv○까지": 그 단계를 넘는 강화·분기는 고려하지 않음 (실패하는 명령만 되풀이하며 다른 행동을 막던 것)
    const ch = g.opts.mode === 'challenge' ? g.def.challenge : null;
    const maxLv = ch && ch.type === 'maxLevel' ? ch.value : 4;
    return () => {
      t += 1;
      const st = g.state;
      if (t % 8) return;
      // 행동 고르기
      let best = null;
      const consider = (val, cost, action) => {
        if (cost > st.gold) return;
        const score = val / Math.max(1, cost);
        if (!best || score > best.score) best = { score, action };
      };
      const tiles = buildableTiles(g, allowOpen);
      // 미로 벽 먼저: 다음 미로 칸에 값싼 공격 탑을 지음
      while (mazeI < maze.length && g.tileTower(maze[mazeI].c, maze[mazeI].r)) mazeI += 1;
      if (mazeI < maze.length && st.towers.length >= 1) {
        const t = maze[mazeI];
        const cheap = types.filter((x) => D.towers[x].role === 'attack' && D.towers[x].targets !== 'air').sort((a2, b2) => RG.stats.costOf(a2, 1, null, g.meta) - RG.stats.costOf(b2, 1, null, g.meta));
        const pick = cheap.find((x) => g.canBuild(x, t.c, t.r).ok) || null;
        if (pick) {
          const v = towerValue(g, pick, 1, null, t.c, t.r, route, air, W) * 1.6 + 40;
          consider(v, RG.stats.costOf(pick, 1, null, g.meta), { type: 'build', tower: pick, c: t.c, r: t.r });
        } else if (!g.canBuild(cheap[0] || 'ember_archer', t.c, t.r).ok && !/골드/.test(g.canBuild(cheap[0] || 'ember_archer', t.c, t.r).reason)) mazeI += 1;
      }
      for (const type of types) {
        const td = D.towers[type];
        if (td.role === 'support' && st.towers.length < 3 && !(type === 'sanctuary' && hasStealth)) continue; // 지원은 이웃 공격 탑이 생긴 뒤
        if (td.role === 'economy') {
          const left = st.wave.total - st.wave.index;
          const mines = st.towers.filter((x) => x.type === type).length;
          if (left >= 7 && mines < MINES && st.towers.length >= 2) {
            const cost = RG.stats.costOf(type, 1, null, g.meta);
            consider(18 * left * 0.08 / (mines + 1), cost, { type: 'build', tower: type, ...tiles[0] });
          }
          continue;
        }
        const cost = RG.stats.costOf(type, 1, null, g.meta);
        if (cost > st.gold) continue;
        for (const tile of tiles) {
          let v;
          if (td.role === 'support') {
            // 은신 적이 있으면 성소(탐지)를 길이 많이 지나는 곳에 일찍 — 하나는 꼭, 둘째는 덜 급하게
            const sp = RG.stats.specOf(type, 1, null);
            const det = (type === 'sanctuary' && hasStealth && sp.detect) || 0;
            const have = st.towers.filter((x) => x.type === type).length;
            // 지원 효과: 이웃 공격 탑 가치 × (피해·속도 보너스 + 사거리 보너스 절반)
            const a = sp.aura || {};
            const gain = (a.damagePct || 0) + (a.speedPct || 0) + (a.rangePct || 0) * 0.5 + (a.critChance || 0);
            let nb = 0;
            for (const o of st.towers) if (Math.max(Math.abs(o.c - tile.c), Math.abs(o.r - tile.r)) === 1 && D.towers[o.type].role === 'attack') nb += towerValue(g, o.type, o.level, o.branch, o.c, o.r, route, air, W);
            v = nb * gain * 1.1 + (det ? coverage(route, [], tile.c, tile.r, det, 'ground') * (have === 0 ? 60 : have === 1 ? 6 : 0.3) : 0);
            if (v <= 0) continue;
          } else v = towerValue(g, type, 1, null, tile.c, tile.r, route, air, W);
          if (tile.open) {
            // 길을 늘리면 가산점
            const before = g.flow[g.map.spawns[0].r * g.map.cols + g.map.spawns[0].c];
            g.blocked[tile.r * g.map.cols + tile.c] = 1;
            const nd = RG.grid.computeFlow(g.map, g.blocked);
            g.blocked[tile.r * g.map.cols + tile.c] = 0;
            const after = nd[g.map.spawns[0].r * g.map.cols + g.map.spawns[0].c];
            if (!isFinite(after)) continue;
            v *= 1 + Math.max(0, after - before) * 0.25;
          }
          const links = g.previewLinks(type, tile.c, tile.r);
          const eff = new Set(links.map((l) => l.res.id)).size;
          v *= 1 + RES * eff;
          // 같은 종류만 몰지 않게
          const same = st.towers.filter((x) => x.type === type).length;
          v *= 1 / (1 + same * SAME);
          consider(v, cost, { type: 'build', tower: type, c: tile.c, r: tile.r });
        }
      }
      // 보스 맵 막바지엔 강화·분기를 더 높이 침
      const up = UP * (g.def.boss && st.wave.index >= st.wave.total - 5 ? 2 : 1);
      for (const tw of st.towers) {
        const td = D.towers[tw.type];
        if (tw.level >= 4 || tw.level >= maxLv) continue;
        if (tw.level < 3) {
          const cost = g.upgradeCost(tw);
          const v = td.role === 'economy' ? (st.wave.total - st.wave.index) * 1.0 : (towerValue(g, tw.type, tw.level + 1, null, tw.c, tw.r, route, air, W) - towerValue(g, tw.type, tw.level, null, tw.c, tw.r, route, air, W) * 0.3) * 1.15;
          consider(td.role === 'economy' ? v : v * up, cost, { type: 'upgrade', id: tw.id });
        } else if (g.opts.branches !== false) {
          for (const b of ['A', 'B']) {
            const cost = g.upgradeCost(tw, b);
            const v = td.role === 'economy' ? 0 : towerValue(g, tw.type, 4, b, tw.c, tw.r, route, air, W) - towerValue(g, tw.type, 3, null, tw.c, tw.r, route, air, W) * 0.3;
            consider(v * up, cost, { type: 'branch', id: tw.id, branch: b });
          }
        }
      }
      let acted = false;
      if (best) {
        const res = g.cmd(best.action);
        acted = res.ok;
        if (res.ok && best.action.type === 'build') { route = routeTiles(g); air = airSegs(g); }
      }
      // 웨이브 호출 (고른 행동이 실패했어도 — 탑 수 제한 등으로 막히면 그대로 기다리기만 했음)
      if (st.wave.index === 0 && (!acted || st.gold < 60)) g.cmd({ type: 'callWave' });
      if (options.early !== false && st.wave.countdown !== null && st.enemies.length <= 2 && st.lives >= st.maxLives - 1 && !best && st.wave.countdown < 10) g.cmd({ type: 'callWave' });
      // 영웅 기술
      heroAI(g);
    };
  }

  function heroAI(g) {
    const st = g.state;
    const h = st.hero;
    if (!h || h.dead || h.skillCd > 0) return;
    const sk = D.heroes[h.heroId].skill;
    const R = sk.radius || 1;
    let best = null;
    let bn = 0;
    for (const e of st.enemies) {
      let n = 0;
      for (const o of st.enemies) if ((o.x - e.x) ** 2 + (o.y - e.y) ** 2 <= R * R) n += D.enemies[o.type].boss ? 4 : 1;
      if (n > bn) { bn = n; best = e; }
    }
    if (best && (bn >= 3 || D.enemies[best.type].boss)) g.cmd({ type: 'heroSkill', x: best.x, y: best.y, targetId: best.id });
  }

  /** 계획 봇: 정해진 행동 목록을 차례로(골드가 되면) 실행 */
  function planBot(g, plan, options = {}) {
    let i = 0;
    let t = 0;
    let stuck = 0;          // 골드를 기다린 횟수
    const early = new Map(); // 막혔을 때 먼저 지은 뒤쪽 건설: plan 위치 → 탑 id
    const fallback = greedyBot(g, () => 0.5, options.style || {});
    const ids = [];   // plan에서 지은 탑 id (index로 참조)
    return () => {
      t += 1;
      const st = g.state;
      if (t % 4) return;
      let guard = 0;
      while (i < plan.length && guard++ < 4) {
        const a = plan[i];
        let res;
        if (a.type === 'build') {
          if (early.has(i)) { ids.push(early.get(i)); i += 1; continue; }
          res = g.cmd({ type: 'build', tower: a.tower, c: a.c, r: a.r });
          if (res.ok) { ids.push(res.id); stuck = 0; } else if (/골드/.test(res.reason)) {
            // (과제 검증용) 오래 막히면 뒤쪽의 살 수 있는 건설을 먼저
            if (options.skipStuck && ++stuck > 150) {
              for (let j = i + 1; j < plan.length; j++) {
                const b2 = plan[j];
                if (b2.type !== 'build' || early.has(j)) continue;
                const r2 = g.cmd({ type: 'build', tower: b2.tower, c: b2.c, r: b2.r });
                if (r2.ok) { early.set(j, r2.id); break; }
              }
            }
            break;
          } else ids.push(null);
        } else {
          const id = ids[a.ref % Math.max(1, ids.length)];
          const tw = id && st.towers.find((x) => x.id === id);
          if (!tw) { i += 1; continue; }
          res = a.type === 'upgrade' ? g.cmd({ type: 'upgrade', id }) : g.cmd({ type: 'branch', id, branch: a.branch });
          if (!res.ok && /골드/.test(res.reason)) break;
        }
        i += 1;
      }
      if (i >= plan.length && st.wave.index > 0) { for (let k = 0; k < 4; k++) fallback(); }
      if (st.wave.index === 0 && (i >= plan.length || st.tick > 30 * 3)) g.cmd({ type: 'callWave' });
      if (options.early && st.wave.countdown !== null && st.enemies.length <= 1) g.cmd({ type: 'callWave' });
      heroAI(g);
      if (options.rally && t % 60 === 0) {
        // 병영 집결지는 기본값 유지
      }
    };
  }

  function runBase(opts, botKind, extra = {}) {
    const g = RG.sim.create(Object.assign({ mode: 'normal', seed: 1, heroId: null }, opts));
    const rng = RG.util.makeRng((opts.seed || 1) * 7 + 3);
    const tick = botKind === 'random' ? randomBot(g, rng) : botKind === 'plan' ? planBot(g, extra.plan || [], extra) : greedyBot(g, rng, extra);
    let guard = 0;
    let bossMin = 1; // 보스 남은 체력 비율의 최소 (보스에서 졌을 때 얼마나 가까웠나)
    while (!g.state.result && guard++ < 30 * 60 * 30) {
      tick();
      g.step();
      if (extra.invariants) checkInvariants(g);
      if (guard % 15 === 0) for (const e of g.state.enemies) if (!e.dead && D.enemies[e.type].boss) bossMin = Math.min(bossMin, e.hp / e.maxHp);
    }
    const st = g.state;
    const byType = {};
    for (const [id, v] of Object.entries(st.stats.damageByTower)) {
      const tw = st.towers.find((x) => String(x.id) === id);
      const key = tw ? tw.type : 'sold';
      byType[key] = (byType[key] || 0) + v;
    }
    return {
      result: st.result || 'timeout', lives: st.lives, waves: st.wave.index, total: st.wave.total, time: st.time,
      towers: st.towers.map((t) => `${t.type}:${t.level}${t.branch || ''}`), byType, task: st.task ? st.task.done : null,
      resonance: Object.keys(st.stats.resonanceSeen), log: g.log, game: g, bossDone: st.result === 'win' ? 1 : (g.def.boss ? 1 - bossMin : 0),
    };
  }

  const run = runBase;

  function checkInvariants(g) {
    const st = g.state;
    for (const e of st.enemies) {
      if (!isFinite(e.x) || !isFinite(e.y) || !isFinite(e.hp)) throw new Error(`적 값 이상 ${e.type} ${e.x},${e.y},${e.hp}`);
      if (e.x < -1 || e.y < -1 || e.x > g.map.cols + 1 || e.y > g.map.rows + 1) throw new Error(`적이 맵 밖 ${e.type} ${e.x},${e.y}`);
    }
    if (!isFinite(st.gold) || st.gold < -0.001) throw new Error(`골드 이상 ${st.gold}`);
    for (const u of st.units) if (!isFinite(u.x) || !isFinite(u.hp)) throw new Error(`유닛 값 이상 ${u.kind}`);
  }

  /* ---------------- 탐색 ---------------- */
  /** 그리디 봇의 기록을 계획으로 바꿈 */
  function logToPlan(log, g) {
    const plan = [];
    const idToRef = new Map();
    for (const [, c] of log) {
      if (c.type === 'build') { idToRef.set(idToRef.size + 1, plan.filter((p) => p.type === 'build').length); plan.push({ type: 'build', tower: c.tower, c: c.c, r: c.r }); }
    }
    // 강화는 지은 순서 참조로
    let buildIdx = 0;
    const buildIds = [];
    for (const [, c] of log) {
      if (c.type === 'build') buildIds.push(null);
    }
    const out = [];
    const towerOrder = [];
    for (const [, c] of log) {
      if (c.type === 'build') { out.push({ type: 'build', tower: c.tower, c: c.c, r: c.r }); towerOrder.push(c); buildIdx += 1; } else if (c.type === 'upgrade' || c.type === 'branch') {
        // id → 몇 번째로 지은 탑인지는 알 수 없으니 상대 위치를 기억
        const tw = g && g.state.towers.find((t) => t.id === c.id);
        const ref = tw ? towerOrder.findIndex((b) => b.c === tw.c && b.r === tw.r) : 0;
        out.push({ type: c.type, ref: Math.max(0, ref), branch: c.branch });
      }
    }
    return out;
  }

  function mutate(plan, g, rng) {
    const p = plan.map((a) => Object.assign({}, a));
    const types = (g.opts.towers || D.towerOrder).filter((x) => D.towers[x]);
    const tiles = buildableTiles(g, g.def.type !== 'fixed');
    const nBuild = () => p.filter((a) => a.type === 'build').length;
    if (rng() < 0.18 && nBuild()) {
      // 키우기: 지은 탑 하나를 Lv3 + 분기까지 한 번에 (낱개 변이로는 거의 안 나오는 조합)
      const builds = p.map((a, i) => (a.type === 'build' ? i : -1)).filter((i) => i >= 0);
      const bi = Math.floor(rng() * builds.length);
      const at = builds[bi] + 1 + Math.floor(rng() * (p.length - builds[bi]));
      p.splice(at, 0, { type: 'upgrade', ref: bi }, { type: 'upgrade', ref: bi }, { type: 'branch', ref: bi, branch: rng() < 0.5 ? 'A' : 'B' });
      return p;
    }
    const k = rng();
    if (k < 0.25 && p.length) {
      const i = Math.floor(rng() * p.length);
      if (p[i].type === 'build') p[i].tower = types[Math.floor(rng() * types.length)];
    } else if (k < 0.5 && p.length) {
      const i = Math.floor(rng() * p.length);
      if (p[i].type === 'build' && tiles.length) { const t = tiles[Math.floor(rng() * tiles.length)]; p[i].c = t.c; p[i].r = t.r; }
    } else if (k < 0.65 && p.length > 1) {
      const i = Math.floor(rng() * (p.length - 1));
      [p[i], p[i + 1]] = [p[i + 1], p[i]];
    } else if (k < 0.8) {
      const i = Math.floor(rng() * (p.length + 1));
      if (rng() < 0.5 && tiles.length) { const t = tiles[Math.floor(rng() * tiles.length)]; p.splice(i, 0, { type: 'build', tower: types[Math.floor(rng() * types.length)], c: t.c, r: t.r }); } else p.splice(i, 0, { type: rng() < 0.75 ? 'upgrade' : 'branch', ref: Math.floor(rng() * Math.max(1, nBuild())), branch: rng() < 0.5 ? 'A' : 'B' });
    } else if (p.length > 2) {
      p.splice(Math.floor(rng() * p.length), 1);
    }
    return p;
  }

  /** 'use:탑:최소수' 목표: 그 탑을 몇 개 지었나, 공격 탑이면 탑 피해 중 그 탑 몫 */
  function useStats(r, objective) {
    const [, type, min] = objective.split(':');
    const n = (r.towers || []).filter((t) => t.split(':')[0] === type).length;
    const tot = Object.values(r.byType || {}).reduce((a, b) => a + b, 0) || 1;
    const share = (r.byType && r.byType[type] ? r.byType[type] : 0) / tot;
    const attack = D.towers[type].role === 'attack';
    return { n, share, attack, ok: n >= +min }; // 피해 몫은 참고만 (감속·밀치기 탑은 피해가 작아도 쓸모 있음 — 쓸모는 빼 보기 시험으로)
  }
  function fitness(r, objective) {
    // 탑 쓰임 검증: 그 탑을 쓰면서 이겨야 함 — 안 쓴 승리는 크게 깎음 (공격 탑은 피해 몫이 클수록 조금 더 쳐 줌)
    if (objective && objective.startsWith('use:')) {
      const u = useStats(r, objective);
      return (r.result === 'win' ? 10000 : 0) + r.lives * 300 + r.waves * 100 + (r.bossDone || 0) * 1200 - (u.ok ? 0 : 9000) + Math.min(u.n, 4) * 150 + (u.attack ? u.share * 2000 : 0);
    }
    // 과제: 이기는 것이 먼저 — 진 판의 과제 달성은 조금만 쳐서, 이길 수 있는 계열이 밀려나지 않게
    if (objective === 'task') return (r.result === 'win' ? 10000 + (r.task ? 6000 : 0) : (r.task ? 400 : 0)) + r.lives * 100 + r.waves * 100 + (r.bossDone || 0) * 600;
    return (r.result === 'win' ? 10000 : 0) + r.lives * 300 + r.waves * 100 + (r.task ? 150 : 0) + (r.bossDone || 0) * 1200;
  }

  /** 공명 과제를 노리는 초기 계획: 건설지가 넓은 곳에 원소를 섞어 뭉쳐 짓기 */
  function taskSeedPlan(g, avoid) {
    const td = g.def.task;
    if (!td) return null;
    const m = g.map;
    const types = (g.opts.towers || D.towerOrder).filter((x) => D.towers[x] && !D.towers[x].noResonance);
    const byEl = {};
    for (const t of types) { const e = D.towers[t].element; (byEl[e] = byEl[e] || []).push(t); }
    const pickEl = (e) => (byEl[e] || []).find((t) => D.towers[t].role === 'attack') || (byEl[e] || [])[0];
    const free = (c, r) => c >= 0 && r >= 0 && c < m.cols && r < m.rows && !(avoid && avoid.has(r * m.cols + c)) && (m.kinds[r * m.cols + c] === RG.grid.T.BUILD || (m.kinds[r * m.cols + c] === RG.grid.T.OPEN && g.canBuild(types[0], c, r).ok));
    // 중심 후보: 이웃 8칸 중 건설지가 가장 많은 칸 (길 가까운 쪽 우선)
    const route = routeTiles(g);
    let best = null;
    for (let r = 0; r < m.rows; r++) for (let c = 0; c < m.cols; c++) {
      if (!free(c, r)) continue;
      let n = 0;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if ((dc || dr) && free(c + dc, r + dr)) n++;
      const cov = coverage(route, [], c, r, 2.5, 'ground');
      const score = n * 10 + cov;
      if (!best || score > best.score) best = { c, r, score };
    }
    if (!best) return null;
    const ring = [];
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) if (free(best.c + dc, best.r + dr)) ring.push({ c: best.c + dc, r: best.r + dr });
    const els = Object.keys(byEl);
    const plan = [];
    let center = pickEl(els[0]);
    if (td.type === 'amp') center = td.tower;
    if (td.type === 'elementEffects' && byEl[td.element]) {
      // 그 원소 탑을 가운데에, 서로 다른 원소를 둘레에 (원소마다 다른 공명)
      center = pickEl(td.element);
      const others = els.filter((e) => e !== td.element);
      plan.push({ type: 'build', tower: center, c: best.c, r: best.r });
      ring.forEach((t, i) => plan.push({ type: 'build', tower: pickEl(i < others.length ? others[i] : td.element), c: t.c, r: t.r }));
      return plan;
    }
    if (td.type === 'effects' && td.ids.length < 2) {
      // 필요한 원소 짝을 찾아 이웃으로 (둘 이상이면 아래의 배치 최적화)
      const need = new Map();
      for (const id of td.ids) for (const [k, res] of Object.entries(D.resonance)) if (res.id === id) (k === 'pure' ? [els[0], els[0]] : k.split('+')).forEach((e) => need.set(e, (need.get(e) || 0) + 1));
      // 여러 짝에 낀 원소를 가운데에 (예: 초전도+과열 → 폭풍)
      const list = [...need.keys()].filter((e) => byEl[e]).sort((x, y) => need.get(y) - need.get(x));
      center = pickEl(list[0]) || center;
      plan.push({ type: 'build', tower: center, c: best.c, r: best.r });
      list.slice(1).forEach((e, i) => ring[i] && plan.push({ type: 'build', tower: pickEl(e), c: ring[i].c, r: ring[i].r }));
      if (list.length > 2) ring.slice(list.length - 1).forEach((t, i) => plan.push({ type: 'build', tower: pickEl(list[i % list.length]), c: t.c, r: t.r }));
      return plan;
    }
    if ((td.type === 'distinct' && td.n >= 6) || (td.type === 'links' && td.n >= 10) || (td.type === 'effects' && td.ids.length >= 2)) {
      // 큰 묶음: 중심에서 가까운 건설지 12칸을 모으고, 원소 배치를 언덕 오르기로 최적화
      // 건설지가 한 줄짜리인 맵도 있으니, 한 덩어리가 끝나면 가장 가까운 다른 덩어리로 이어서 모음
      const K = td.type === 'distinct' ? Math.min(26, td.n + 10) : td.type === 'effects' ? 10 : 14;
      const wantKeys = td.type === 'effects' ? new Set(Object.entries(D.resonance).filter(([, res]) => td.ids.includes(res.id)).map(([k]) => k)) : null;
      const cells = [];
      const seen = new Set([best.r * m.cols + best.c]);
      const q = [{ c: best.c, r: best.r }];
      while (cells.length < K) {
        if (!q.length) {
          let nb = null;
          for (let r = 0; r < m.rows; r++) for (let c = 0; c < m.cols; c++) {
            if (seen.has(r * m.cols + c) || !free(c, r)) continue;
            const d = Math.min(...cells.map((x) => Math.hypot(x.c - c, x.r - r)));
            if (!nb || d < nb.d) nb = { c, r, d };
          }
          if (!nb) break;
          seen.add(nb.r * m.cols + nb.c);
          q.push({ c: nb.c, r: nb.r });
        }
        const cur = q.shift();
        cells.push(cur);
        for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
          const c2 = cur.c + dc; const r2 = cur.r + dr; const k = r2 * m.cols + c2;
          if (!seen.has(k) && free(c2, r2)) { seen.add(k); q.push({ c: c2, r: r2 }); }
        }
      }
      const adj = [];
      for (let i = 0; i < cells.length; i++) for (let j = i + 1; j < cells.length; j++) if (Math.max(Math.abs(cells[i].c - cells[j].c), Math.abs(cells[i].r - cells[j].r)) === 1) adj.push([i, j]);
      const keyOf = (a2, b2) => (a2 === b2 ? 'pure' : D.resonance[`${a2}+${b2}`] ? `${a2}+${b2}` : `${b2}+${a2}`);
      const score = (as) => { const ks = new Set(); for (const [i, j] of adj) ks.add(keyOf(as[i], as[j])); return td.type === 'links' ? adj.length : wantKeys ? [...ks].filter((k) => wantKeys.has(k)).length : ks.size; };
      let asg = cells.map((_, i) => els[i % els.length]);
      let sc = score(asg);
      const rr = RG.util.makeRng(97);
      for (let it = 0; it < 8000; it++) {
        const i = Math.floor(rr() * asg.length);
        const prev = asg[i];
        asg[i] = els[Math.floor(rr() * els.length)];
        const s2 = score(asg);
        if (s2 >= sc) sc = s2; else asg[i] = prev;
      }
      // 목표를 채우는 한에서 탑을 하나씩 빼 비용을 줄임
      const need = wantKeys ? wantKeys.size : td.n;
      const on = cells.map(() => true);
      const scoreOn = () => { const ks = new Set(); let links = 0; for (const [i, j] of adj) if (on[i] && on[j]) { ks.add(keyOf(asg[i], asg[j])); links++; } return td.type === 'links' ? links : wantKeys ? [...ks].filter((k) => wantKeys.has(k)).length : ks.size; };
      if (scoreOn() >= need) {
        const order = cells.map((_, i) => i).sort((x, y) => (cells[y].c * 7 + cells[y].r * 13) % 11 - (cells[x].c * 7 + cells[x].r * 13) % 11);
        for (const i of order) { on[i] = false; if (scoreOn() < need) on[i] = true; }
      }
      cells.forEach((t, i) => { if (on[i]) plan.push({ type: 'build', tower: pickEl(asg[i]), c: t.c, r: t.r }); });
      return plan;
    }
    if (td.type === 'pureAll') {
      // 원소마다 같은 원소 둘을 붙여 짓기 (건설지 짝 찾기)
      const used = new Set();
      for (const e of els) {
        let done = false;
        for (let r = 0; r < m.rows && !done; r++) for (let c = 0; c < m.cols - 1 && !done; c++) {
          if (free(c, r) && free(c + 1, r) && !used.has(`${c},${r}`) && !used.has(`${c + 1},${r}`)) {
            plan.push({ type: 'build', tower: pickEl(e), c, r }, { type: 'build', tower: pickEl(e), c: c + 1, r });
            used.add(`${c},${r}`); used.add(`${c + 1},${r}`); done = true;
          }
        }
      }
      return plan;
    }
    plan.push({ type: 'build', tower: center, c: best.c, r: best.r });
    const centerEl = D.towers[center].element;
    const order = [centerEl, ...els.filter((e) => e !== centerEl)];
    ring.forEach((t, i) => plan.push({ type: 'build', tower: pickEl(order[i % order.length]), c: t.c, r: t.r }));
    return plan;
  }

  /** 계획 탐색: 그리디 해법에서 출발해 진화 */
  function searchPlan(opts, { gens = 10, pop = 12, seed = 1, goal = 'stars3', early = false, maxGens = 30, objective = 'stars', seeds = [] } = {}) {
    const rng = RG.util.makeRng(seed * 131 + 7);
    const run = objective === 'task' ? (o2, kind, extra = {}) => runBase(o2, kind, kind === 'plan' ? Object.assign({ skipStuck: true }, extra) : extra) : runBase;
    const greedy = run(opts, 'greedy');
    const g0 = RG.sim.create(Object.assign({ mode: 'normal', seed: 1 }, opts));
    let popu = [];
    // 탑 쓰임 검증이면 그 탑을 무겁게 치는 그리디 계획들도 출발점에
    const useType = objective && objective.startsWith('use:') ? objective.split(':')[1] : null;
    const styles = useType ? STYLES.concat([{ W: { [useType]: 3 } }, { W: { [useType]: 6 }, res: 0.25 }, { W: { [useType]: 4 }, up: 2 }]) : STYLES;
    for (const style of styles) {
      const gr = style === STYLES[0] ? greedy : run(opts, 'greedy', style);
      const plan = logToPlan(gr.log, gr.game);
      popu.push({ plan, r: run(opts, 'plan', { plan, early }) });
    }
    // 미리 찾은 좋은 계획(예: 이기는 계획)을 초기값으로
    for (const pl of seeds) {
      popu.push({ plan: pl, r: run(opts, 'plan', { plan: pl, early }) });
      if (objective === 'task') {
        // 이긴 배치는 그대로 두고, 그 배치가 안 쓰는 칸에 과제용 묶음을 뒤쪽에 덧붙임 (사람이 하는 순서)
        const used = new Set(pl.filter((a) => a.type === 'build').map((a) => a.r * g0.map.cols + a.c));
        const extra = taskSeedPlan(g0, used);
        if (extra) {
          for (const frac of [1, 0.9, 0.8, 0.7, 0.6, 0.5]) {
            const k = Math.floor(pl.length * frac);
            const p2 = pl.slice(0, k).concat(extra, pl.slice(k));
            popu.push({ plan: p2, r: run(opts, 'plan', { plan: p2, early }) });
          }
        }
      }
    }
    if (objective === 'task') {
      const seedPlan = taskSeedPlan(g0);
      if (seedPlan) {
        for (const pl of popu.slice()) {
          for (const k of [0, 3, 6]) {
            const p2 = pl.plan.slice(0, k).concat(seedPlan, pl.plan.slice(k));
            popu.push({ plan: p2, r: run(opts, 'plan', { plan: p2, early }) });
          }
        }
      }
    }
    const base = popu[0].plan;
    while (popu.length < pop) { const p = mutate(mutate(popu[popu.length % STYLES.length].plan, g0, rng), g0, rng); popu.push({ plan: p, r: run(opts, 'plan', { plan: p, early }) }); }
    let best = popu.reduce((a, b) => (fitness(b.r, objective) > fitness(a.r, objective) ? b : a));
    const goalMet = (r) => (objective === 'task' ? r.result === 'win' && r.task : objective === 'challenge' ? r.result === 'win'
      : useType ? r.result === 'win' && r.lives >= RG.data.rules.starLives[1] && useStats(r, objective).ok : r.result === 'win' && r.lives >= RG.data.rules.starLives[1]);
    for (let gen = 0; gen < (goalMet(best.r) ? 0 : maxGens); gen++) {
      if (gen >= gens && best.r.result !== 'win' && gen >= maxGens) break;
      popu.sort((a, b) => fitness(b.r, objective) - fitness(a.r, objective));
      const keep = popu.slice(0, Math.max(3, Math.floor(pop / 3)));
      const next = keep.slice();
      while (next.length < pop) {
        const parent = keep[Math.floor(rng() * keep.length)];
        let child = mutate(parent.plan, g0, rng);
        if (rng() < 0.5) child = mutate(child, g0, rng);
        next.push({ plan: child, r: run(opts, 'plan', { plan: child, early }) });
      }
      popu = next;
      const cand = popu.reduce((a, b) => (fitness(b.r, objective) > fitness(a.r, objective) ? b : a));
      if (fitness(cand.r, objective) > fitness(best.r, objective)) best = cand;
      if (goalMet(best.r)) break;
      if (gen + 1 >= gens && best.r.result === 'win' && goal !== 'stars3') break;
    }
    return { greedy, best };
  }

  /** 탐색은 시드에 따라 결과가 크게 흔들림 → 목표를 못 채우면 다른 시드로 다시 (최대 tries번), 가장 좋은 것 */
  function searchBest(opts, params = {}, tries = 3) {
    const objective = params.objective || 'stars';
    const met = (r) => (objective === 'task' ? r.result === 'win' && r.task : objective === 'challenge' ? r.result === 'win'
      : objective.startsWith('use:') ? r.result === 'win' && r.lives >= RG.data.rules.starLives[1] && useStats(r, objective).ok : r.result === 'win' && r.lives >= RG.data.rules.starLives[1]);
    let best = null;
    for (let i = 0; i < tries; i++) {
      const s = searchPlan(opts, Object.assign({}, params, { seed: (params.seed || 1) + i }));
      if (!best || fitness(s.best.r, objective) > fitness(best.best.r, objective)) best = s;
      if (met(best.best.r)) break;
    }
    return best;
  }

  return { run, searchPlan, searchBest, routeTiles, coverage, logToPlan, fitness, useStats, STYLES, mazePlan, taskSeedPlan };
}

module.exports = { makeEnv, loadGame };

if (require.main === module) {
  const args = process.argv.slice(2);
  const arg = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
  const { RG } = loadGame();
  const env = makeEnv(RG);
  const mapId = arg('map', '1-1');
  const bot = arg('bot', 'greedy');
  const runs = +arg('runs', 3);
  const hero = arg('hero', 'kara');
  const towers = RG.progress ? RG.progress.towersFor(mapId) : null;
  for (let i = 0; i < runs; i++) {
    const t0 = Date.now();
    const r = env.run({ mapId, seed: i + 1, heroId: hero === 'none' ? null : hero, towers, branches: mapId > '1-6' }, bot, { invariants: true });
    console.log(`${mapId} ${bot} #${i + 1}: ${r.result} 불꽃 ${r.lives} 웨이브 ${r.waves}/${r.total} ${Math.round(r.time)}초 과제 ${r.task} (${Date.now() - t0}ms)\n   ${r.towers.join(' ')}`);
  }
}
