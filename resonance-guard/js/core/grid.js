'use strict';

/* =========================================================
 * 격자 — 맵 해석, 웨이브 해석, 흐름장(최단 거리), 영웅 길찾기
 * DOM 없음. 설계: DESIGN.md §4, ARCHITECTURE.md §3.5
 * ========================================================= */
RG.grid = (() => {
  const T = {
    PATH: 1, OPEN: 2, BUILD: 3, WATER: 4, ROCK: 5, TREE: 6, LAVA: 7, PILLAR: 8, SPAWN: 9, AIR: 10, LANTERN: 11,
  };
  const CHAR = {
    '.': T.PATH, ',': T.OPEN, '#': T.BUILD, '~': T.WATER, '^': T.ROCK, T: T.TREE, '%': T.LAVA, '=': T.PILLAR,
    S: T.SPAWN, A: T.AIR, L: T.LANTERN,
  };
  const SQRT2 = Math.SQRT2;
  /** 8방향: 북, 북동, 동, 남동, 남, 남서, 서, 북서 */
  const DIRS = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];

  const isEnemyWalkKind = (k) => k === T.PATH || k === T.OPEN || k === T.SPAWN || k === T.LANTERN;
  const isBuildKind = (k) => k === T.BUILD || k === T.OPEN;
  const isHeroWalkKind = (k) => k === T.PATH || k === T.OPEN || k === T.BUILD || k === T.SPAWN || k === T.LANTERN;

  /** 맵 정의 → 해석된 맵. 오류가 있으면 예외 */
  function parseMap(def) {
    const rows = def.grid.length;
    const cols = def.grid[0].length;
    const n = cols * rows;
    const kinds = new Uint8Array(n);
    const spawns = [];
    const airSpawns = [];
    let lantern = null;
    for (let r = 0; r < rows; r++) {
      const line = def.grid[r];
      if (line.length !== cols) throw new Error(`${def.id}: ${r}번째 줄 길이가 ${line.length} (기대 ${cols})`);
      for (let c = 0; c < cols; c++) {
        const k = CHAR[line[c]];
        if (!k) throw new Error(`${def.id}: 알 수 없는 기호 '${line[c]}' (${c},${r})`);
        kinds[r * cols + c] = k;
        const cell = { c, r, x: c + 0.5, y: r + 0.5 };
        if (k === T.SPAWN) spawns.push(cell);
        else if (k === T.AIR) airSpawns.push(cell);
        else if (k === T.LANTERN) {
          if (lantern) throw new Error(`${def.id}: 울림등이 둘 이상`);
          lantern = cell;
        }
      }
    }
    if (!lantern) throw new Error(`${def.id}: 울림등(L)이 없음`);
    if (!spawns.length) throw new Error(`${def.id}: 입구(S)가 없음`);
    const map = { id: def.id, def, cols, rows, kinds, spawns, airSpawns, lantern };
    const empty = new Uint8Array(n);
    const dist = computeFlow(map, empty);
    for (const s of spawns) {
      if (!isFinite(dist[s.r * cols + s.c])) throw new Error(`${def.id}: 입구 (${s.c},${s.r})에서 울림등까지 길이 없음`);
    }
    map.baseDist = dist;
    return map;
  }

  /**
   * 웨이브 문자열 → [{ groups: [{ e, n, gap, at, s }] }]
   * 무리: '적id*수/간격@시작>입구'
   */
  function parseWaves(list) {
    return list.map((str, wi) => {
      const groups = String(str).split(';').map((g) => g.trim()).filter(Boolean).map((g) => {
        const m = /^([a-z_]+)(?:\*(\d+))?(?:\/([\d.]+))?(?:@([\d.]+))?(?:>(\d+))?$/.exec(g);
        if (!m) throw new Error(`웨이브 ${wi + 1}: 해석할 수 없는 무리 '${g}'`);
        return { e: m[1], n: m[2] ? +m[2] : 1, gap: m[3] ? +m[3] : 1, at: m[4] ? +m[4] : 0, s: m[5] ? +m[5] : 0 };
      });
      return { groups };
    });
  }

  const idx = (map, c, r) => r * map.cols + c;
  const inBounds = (map, c, r) => c >= 0 && r >= 0 && c < map.cols && r < map.rows;

  /** 적이 걸을 수 있는가 (blocked: 탑이 있는 칸 1) */
  function enemyWalkable(map, blocked, c, r) {
    if (!inBounds(map, c, r)) return false;
    const i = idx(map, c, r);
    return isEnemyWalkKind(map.kinds[i]) && !blocked[i];
  }

  /** 대각선 이동은 두 직교 칸이 모두 걸을 수 있을 때만 (모서리 자르기 금지) */
  function canStep(map, walk, c, r, dc, dr) {
    if (!walk(c + dc, r + dr)) return false;
    if (dc !== 0 && dr !== 0) return walk(c + dc, r) && walk(c, r + dr);
    return true;
  }

  /** 울림등까지의 최단 거리(다익스트라, 8방향). 못 가는 칸 = Infinity */
  function computeFlow(map, blocked) {
    const n = map.cols * map.rows;
    const dist = new Float64Array(n).fill(Infinity);
    const walk = (c, r) => enemyWalkable(map, blocked, c, r);
    const start = idx(map, map.lantern.c, map.lantern.r);
    dist[start] = 0;
    // 작은 이진 힙
    const heap = [[0, start]];
    const push = (item) => {
      heap.push(item);
      let i = heap.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (heap[p][0] <= heap[i][0]) break;
        [heap[p], heap[i]] = [heap[i], heap[p]];
        i = p;
      }
    };
    const pop = () => {
      const top = heap[0];
      const last = heap.pop();
      if (heap.length) {
        heap[0] = last;
        let i = 0;
        for (;;) {
          const l = i * 2 + 1;
          const r = l + 1;
          let m = i;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
          if (m === i) break;
          [heap[m], heap[i]] = [heap[i], heap[m]];
          i = m;
        }
      }
      return top;
    };
    while (heap.length) {
      const [d, i] = pop();
      if (d > dist[i]) continue;
      const c = i % map.cols;
      const r = (i - c) / map.cols;
      for (const [dc, dr] of DIRS) {
        if (!canStep(map, walk, c, r, dc, dr)) continue;
        const j = idx(map, c + dc, r + dr);
        const nd = d + (dc !== 0 && dr !== 0 ? SQRT2 : 1);
        if (nd < dist[j] - 1e-9) {
          dist[j] = nd;
          push([nd, j]);
        }
      }
    }
    return dist;
  }

  /**
   * 다음 칸 고르기. 최단 경로 후보가 여럿이면 pref(적마다 고정된 정수)로 고릅니다 → 같은 길이 갈림길에서 고르게 나뉨.
   * 반환: { c, r } 또는 null(이미 울림등이거나 길 없음)
   */
  function nextStep(map, dist, blocked, c, r, pref) {
    const here = dist[idx(map, c, r)];
    if (!isFinite(here) || here === 0) return null;
    const walk = (cc, rr) => enemyWalkable(map, blocked, cc, rr);
    let best = Infinity;
    const cands = [];
    for (let k = 0; k < 8; k++) {
      const [dc, dr] = DIRS[k];
      if (!canStep(map, walk, c, r, dc, dr)) continue;
      const v = dist[idx(map, c + dc, r + dr)] + (dc !== 0 && dr !== 0 ? SQRT2 : 1);
      if (v < best - 1e-6) {
        best = v;
        cands.length = 0;
        cands.push(k);
      } else if (Math.abs(v - best) <= 1e-6) {
        cands.push(k);
      }
    }
    if (!cands.length || !isFinite(best)) return null;
    const k = cands[((pref % cands.length) + cands.length) % cands.length];
    return { c: c + DIRS[k][0], r: r + DIRS[k][1] };
  }

  /** 영웅이 걸을 수 있는가 (towers: 탑이 있는 칸 1) */
  function heroWalkable(map, towers, c, r) {
    if (!inBounds(map, c, r)) return false;
    const i = idx(map, c, r);
    return isHeroWalkKind(map.kinds[i]) && !towers[i];
  }

  /** 영웅 길찾기 (BFS, 8방향) → 칸 목록(시작 칸 제외). 못 가면 null */
  function heroPath(map, towers, fc, fr, tc, tr) {
    if (!heroWalkable(map, towers, tc, tr)) return null;
    if (fc === tc && fr === tr) return [];
    const n = map.cols * map.rows;
    const prev = new Int32Array(n).fill(-1);
    const seen = new Uint8Array(n);
    const walk = (c, r) => heroWalkable(map, towers, c, r);
    const startI = idx(map, fc, fr);
    const goal = idx(map, tc, tr);
    const queue = [startI];
    seen[startI] = 1;
    // 시작 칸이 막혀 있어도(탑이 막 생긴 경우) 빠져나갈 수 있게 시작 칸은 걷는 칸으로 취급
    while (queue.length) {
      const i = queue.shift();
      if (i === goal) break;
      const c = i % map.cols;
      const r = (i - c) / map.cols;
      for (const [dc, dr] of DIRS) {
        const nc = c + dc;
        const nr = r + dr;
        if (!walk(nc, nr)) continue;
        if (dc !== 0 && dr !== 0 && !(walk(c + dc, r) && walk(c, r + dr))) continue;
        const j = idx(map, nc, nr);
        if (seen[j]) continue;
        seen[j] = 1;
        prev[j] = i;
        queue.push(j);
      }
    }
    if (!seen[goal]) return null;
    const path = [];
    for (let i = goal; i !== startI; i = prev[i]) {
      const c = i % map.cols;
      path.push({ c, r: (i - c) / map.cols });
    }
    return path.reverse();
  }

  /** (x, y)에서 가장 가까운 "영웅이 걸을 수 있는" 칸 */
  function nearestHeroTile(map, towers, x, y) {
    let best = null;
    let bd = Infinity;
    for (let r = 0; r < map.rows; r++) {
      for (let c = 0; c < map.cols; c++) {
        if (!heroWalkable(map, towers, c, r)) continue;
        const d = (c + 0.5 - x) ** 2 + (r + 0.5 - y) ** 2;
        if (d < bd) { bd = d; best = { c, r }; }
      }
    }
    return best;
  }

  /** (x, y)에서 가장 가까운 "적이 걸을 수 있는" 칸 (blocked 반영) */
  function nearestEnemyTile(map, blocked, x, y, maxDist = Infinity) {
    let best = null;
    let bd = maxDist * maxDist;
    for (let r = 0; r < map.rows; r++) {
      for (let c = 0; c < map.cols; c++) {
        if (!enemyWalkable(map, blocked, c, r)) continue;
        const d = (c + 0.5 - x) ** 2 + (r + 0.5 - y) ** 2;
        if (d <= bd) { bd = d; best = { c, r }; }
      }
    }
    return best;
  }

  /** 8방향 이웃 칸 */
  function neighbors8(map, c, r) {
    const out = [];
    for (const [dc, dr] of DIRS) if (inBounds(map, c + dc, r + dr)) out.push({ c: c + dc, r: r + dr });
    return out;
  }

  return {
    T, CHAR, DIRS, parseMap, parseWaves, computeFlow, nextStep, enemyWalkable, heroWalkable, heroPath,
    nearestHeroTile, nearestEnemyTile, neighbors8, isEnemyWalkKind, isBuildKind, isHeroWalkKind, idx, inBounds,
  };
})();
