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

  function airSegs(g) {
    const m = g.map;
    return m.airSpawns.map((a) => [a.x, a.y, m.lantern.x, m.lantern.y]);
  }

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
    if (targets !== 'air') for (const t of route) if ((t.c + 0.5 - x) ** 2 + (t.r + 0.5 - y) ** 2 <= range * range) n += 1;
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
    const cov = coverage(route, air, c, r, spec.range || 1.5, spec.targets || td.targets);
    // 이 맵의 적 구성에 대한 상성(원소 친화·비행)
    const mix = enemyMix(g);
    let fit = 0;
    for (const [e, w] of mix) {
      const ed = D.enemies[e];
      const tg = spec.targets || td.targets;
      if (ed.traits.flying && tg === 'ground') continue;
      if (!ed.traits.flying && tg === 'air') continue;
      const a = ed.affinity[td.element];
      fit += w * (a === 'weak' ? 1.5 : a === 'resist' ? 0.5 : a === 'immune' || a === 'absorb' ? 0 : 1);
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
    let t = 0;
    let route = routeTiles(g);
    let air = airSegs(g);
    const types = (g.opts.towers || D.towerOrder).filter((x) => D.towers[x]);
    const hasStealth = (g.def.waves || []).some((w) => /rime_wraith|mist_mariner|void_stalker/.test(w));
    const allowOpen = g.def.type !== 'fixed';
    const maze = options.noMaze ? [] : mazePlan(g);
    let mazeI = 0;
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
        if (td.role === 'support' && !(type === 'sanctuary' && hasStealth)) continue;
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
          let v = td.role === 'support' ? 30 : towerValue(g, type, 1, null, tile.c, tile.r, route, air, W);
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
      for (const tw of st.towers) {
        const td = D.towers[tw.type];
        if (tw.level >= 4) continue;
        if (tw.level < 3) {
          const cost = g.upgradeCost(tw);
          const v = td.role === 'economy' ? (st.wave.total - st.wave.index) * 1.0 : (towerValue(g, tw.type, tw.level + 1, null, tw.c, tw.r, route, air, W) - towerValue(g, tw.type, tw.level, null, tw.c, tw.r, route, air, W) * 0.3) * 1.15;
          consider(v, cost, { type: 'upgrade', id: tw.id });
        } else if (g.opts.branches !== false) {
          for (const b of ['A', 'B']) {
            const cost = g.upgradeCost(tw, b);
            const v = td.role === 'economy' ? 0 : towerValue(g, tw.type, 4, b, tw.c, tw.r, route, air, W) - towerValue(g, tw.type, 3, null, tw.c, tw.r, route, air, W) * 0.3;
            consider(v, cost, { type: 'branch', id: tw.id, branch: b });
          }
        }
      }
      if (best) {
        const res = g.cmd(best.action);
        if (res.ok && best.action.type === 'build') { route = routeTiles(g); air = airSegs(g); }
      }
      // 웨이브 호출
      if (st.wave.index === 0 && (!best || st.gold < 60)) g.cmd({ type: 'callWave' });
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
          res = g.cmd({ type: 'build', tower: a.tower, c: a.c, r: a.r });
          if (res.ok) ids.push(res.id);
          else if (/골드/.test(res.reason)) break;
          else ids.push(null);
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

  function run(opts, botKind, extra = {}) {
    const g = RG.sim.create(Object.assign({ mode: 'normal', seed: 1, heroId: null }, opts));
    const rng = RG.util.makeRng((opts.seed || 1) * 7 + 3);
    const tick = botKind === 'random' ? randomBot(g, rng) : botKind === 'plan' ? planBot(g, extra.plan || [], extra) : greedyBot(g, rng, extra);
    let guard = 0;
    while (!g.state.result && guard++ < 30 * 60 * 30) {
      tick();
      g.step();
      if (extra.invariants) checkInvariants(g);
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
      resonance: Object.keys(st.stats.resonanceSeen), log: g.log, game: g,
    };
  }

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
    const types = (g.opts.towers || D.towerOrder).filter((x) => D.towers[x].role !== 'support' || x === 'sanctuary');
    const tiles = buildableTiles(g, g.def.type !== 'fixed');
    const nBuild = () => p.filter((a) => a.type === 'build').length;
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

  function fitness(r, objective) {
    if (objective === 'task') return (r.result === 'win' ? 10000 : 0) + (r.task ? 6000 : 0) + r.lives * 100 + r.waves * 100;
    return (r.result === 'win' ? 10000 : 0) + r.lives * 300 + r.waves * 100 + (r.task ? 150 : 0);
  }

  /** 공명 과제를 노리는 초기 계획: 건설지가 넓은 곳에 원소를 섞어 뭉쳐 짓기 */
  function taskSeedPlan(g) {
    const td = g.def.task;
    if (!td) return null;
    const m = g.map;
    const types = (g.opts.towers || D.towerOrder).filter((x) => D.towers[x] && !D.towers[x].noResonance);
    const byEl = {};
    for (const t of types) { const e = D.towers[t].element; (byEl[e] = byEl[e] || []).push(t); }
    const pickEl = (e) => (byEl[e] || []).find((t) => D.towers[t].role === 'attack') || (byEl[e] || [])[0];
    const free = (c, r) => c >= 0 && r >= 0 && c < m.cols && r < m.rows && (m.kinds[r * m.cols + c] === RG.grid.T.BUILD || (m.kinds[r * m.cols + c] === RG.grid.T.OPEN && g.canBuild(types[0], c, r).ok));
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
    if (td.type === 'effects') {
      // 필요한 원소 짝을 찾아 이웃으로
      const need = new Set();
      for (const id of td.ids) for (const [k, res] of Object.entries(D.resonance)) if (res.id === id) k === 'pure' ? need.add(els[0]) : k.split('+').forEach((e) => need.add(e));
      const list = [...need].filter((e) => byEl[e]);
      center = pickEl(list[0]) || center;
      plan.push({ type: 'build', tower: center, c: best.c, r: best.r });
      list.slice(1).forEach((e, i) => ring[i] && plan.push({ type: 'build', tower: pickEl(e), c: ring[i].c, r: ring[i].r }));
      if (list.length > 2) ring.slice(list.length - 1).forEach((t, i) => plan.push({ type: 'build', tower: pickEl(list[i % list.length]), c: t.c, r: t.r }));
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
  function searchPlan(opts, { gens = 10, pop = 12, seed = 1, goal = 'stars3', early = false, maxGens = 30, objective = 'stars' } = {}) {
    const rng = RG.util.makeRng(seed * 131 + 7);
    const greedy = run(opts, 'greedy');
    const g0 = RG.sim.create(Object.assign({ mode: 'normal', seed: 1 }, opts));
    let popu = [];
    for (const style of STYLES) {
      const gr = style === STYLES[0] ? greedy : run(opts, 'greedy', style);
      const plan = logToPlan(gr.log, gr.game);
      popu.push({ plan, r: run(opts, 'plan', { plan, early }) });
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
    const goalMet = (r) => (objective === 'task' ? r.result === 'win' && r.task : objective === 'challenge' ? r.result === 'win' : r.result === 'win' && r.lives >= RG.data.rules.starLives[1]);
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

  return { run, searchPlan, routeTiles, coverage, logToPlan, fitness, STYLES, mazePlan };
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
