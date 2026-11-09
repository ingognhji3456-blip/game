'use strict';

/* =========================================================
 * 지형 그림 (SVG 문자열) — 맵 바탕 + 지역 풍경
 * 규격: docs/ARCHITECTURE.md §5, 색: DESIGN.md §14, 칸 종류: DESIGN.md §4.2
 *
 *   RG.art.mapBackground(map)   map = RG.grid.parseMap(def) 결과 → viewBox 0 0 cols*100 rows*100
 *   RG.art.regionBanner(id)     1~5 → viewBox 0 0 400 160 (월드 지도·준비 화면용 풍경)
 *
 * - 장식 위치는 (map.id, c, r) 해시로 정합니다(Math.random 없음) → 같은 맵은 늘 같은 그림.
 * - 탑·적·울림등·입구 소용돌이는 렌더러가 위에 그립니다. 여기서는 바닥 표시(광장·동굴 입구·안개)만.
 * - 읽힘 우선(1칸 ≈ 40px):
 *     길  = 테두리가 진한 이어진 길(흙/눌린 눈/모래/젖은 모래/판석)
 *     공터 = 밝고 평평한 땅 + 칸마다 점선 격자 (걸을 수도, 지을 수도 있음)
 *     건설지 = 칸마다 도톰하게 돋운 판(앞면이 보임)
 *     장애물 = 어두운 땅 위의 물체(나무·바위·기둥), 물·용암 웅덩이
 * ========================================================= */
(() => {
  const h = RG.art._h;
  const OL = h.OL;
  const f = (v) => Math.round(v * 10) / 10;

  /* 칸 종류 (RG.grid.T와 같은 값) */
  const K = { PATH: 1, OPEN: 2, BUILD: 3, WATER: 4, ROCK: 5, TREE: 6, LAVA: 7, PILLAR: 8, SPAWN: 9, AIR: 10, LANTERN: 11 };

  /* ---------------- 지역 색 ---------------- */
  const PAL = {
    1: { // 솔빛 들판 — 연두·노랑
      wild: '#5d8c35', wildL: '#7aa944', wildD: '#44702a', forest: '#3c6826', rubble: '#76864f',
      open: '#c6de80', openAlt: '#b6d26f', openDot: '#4f6e22',
      build: '#94c24c', buildL: '#bde074', buildD: '#6f9f35', buildSide: '#7a5c34', buildGap: '#36591f',
      road: '#dcb478', roadL: '#f2dba8', roadD: '#c29657', roadEdge: '#7d5a30',
      water: '#4aa8da', waterD: '#2a72ab', waterL: '#c4ecf8', shore: '#cdb979', foam: '#eaf8fc',
      lava: '#ff8a2a', lavaL: '#ffe28c', lavaD: '#c4401b', crust: '#3e2c26',
      stone: '#a7a69c', stoneL: '#d6d5c9', stoneD: '#6b6a64', accent: '#76a63c',
      plaza: '#ddd3b8', plazaD: '#a19579', wood: '#a8723f', woodD: '#6a4323',
      leaf: '#5ca83a', leafL: '#9cd85e', leafD: '#357026',
      flowers: ['#fff6c8', '#ffd23f', '#ff9db5', '#ffffff'], mist: '#5e5478',
      skyTop: '#86cdf2', skyBot: '#fcf2c4',
    },
    2: { // 서리 고개 — 하양·하늘
      wild: '#e2ecf6', wildL: '#ffffff', wildD: '#b8cbdf', forest: '#c6d6e8', rubble: '#b3c3d6',
      open: '#bde3f5', openAlt: '#acd8ef', openDot: '#2f6a99',
      build: '#9cb2cc', buildL: '#c9d9ea', buildD: '#7d95b2', buildSide: '#56698a', buildGap: '#6d82a0',
      road: '#bcae9b', roadL: '#ddd3c4', roadD: '#a69584', roadEdge: '#6e5f55',
      water: '#3d86be', waterD: '#1d4e80', waterL: '#d8f2ff', shore: '#f6fafe', foam: '#ffffff',
      lava: '#ff8a2a', lavaL: '#ffe28c', lavaD: '#c4401b', crust: '#323744',
      stone: '#8ea1b8', stoneL: '#c9d7e6', stoneD: '#56677e', accent: '#ffffff',
      plaza: '#dce5ef', plazaD: '#8d9fb6', wood: '#7d5a44', woodD: '#4c3427',
      leaf: '#2e6a5c', leafL: '#4f927a', leafD: '#1b463d',
      flowers: ['#ffffff', '#d6f1ff'], mist: '#66658a',
      skyTop: '#bfe2fa', skyBot: '#f4fbff',
    },
    3: { // 붉은 협곡 — 주황·적갈
      wild: '#8a4428', wildL: '#a6583a', wildD: '#6b311c', forest: '#7a3b22', rubble: '#985636',
      open: '#e8bb7a', openAlt: '#ddad6a', openDot: '#6e3a1c',
      build: '#cc7640', buildL: '#eb9d5f', buildD: '#a95a2f', buildSide: '#723619', buildGap: '#55270f',
      road: '#f2ddac', roadL: '#fdf1d2', roadD: '#dcc08a', roadEdge: '#8e522b',
      water: '#36a6a2', waterD: '#1d6a72', waterL: '#bdf2e6', shore: '#d8b682', foam: '#ecfff7',
      lava: '#ff8a2a', lavaL: '#ffe28c', lavaD: '#c4401b', crust: '#3a1f1a',
      stone: '#bb673c', stoneL: '#e8986a', stoneD: '#7a381e', accent: '#f3b77a',
      plaza: '#ecd4a4', plazaD: '#a8743f', wood: '#8a6040', woodD: '#553620',
      leaf: '#5e9a48', leafL: '#8fc86c', leafD: '#3a682e',
      flowers: ['#ffd36b', '#ff7a4a', '#fff1c0'], mist: '#5a4466',
      skyTop: '#ff9f5c', skyBot: '#ffe0a8',
    },
    4: { // 폭풍 해안 — 청록·남색
      wild: '#2c6064', wildL: '#3e7b7a', wildD: '#1e4850', forest: '#22525a', rubble: '#486570',
      open: '#a8d6bf', openAlt: '#97c9af', openDot: '#22574f',
      build: '#4ca48f', buildL: '#77c8ae', buildD: '#378574', buildSide: '#24545a', buildGap: '#173a44',
      road: '#d6c296', roadL: '#ebdcb8', roadD: '#bea97a', roadEdge: '#76654a',
      water: '#23618f', waterD: '#103963', waterL: '#a4e6f0', shore: '#dac99e', foam: '#f3fcff',
      lava: '#ff8a2a', lavaL: '#ffe28c', lavaD: '#c4401b', crust: '#22303a',
      stone: '#56656f', stoneL: '#8d9ea8', stoneD: '#313c45', accent: '#ebe5d2',
      plaza: '#dbd3bb', plazaD: '#8b8b7b', wood: '#9a7448', woodD: '#5c4227',
      leaf: '#3e9a58', leafL: '#76cc7c', leafD: '#24663c',
      flowers: ['#ffd6c9', '#fff2d6', '#ff9a8a'], mist: '#4a5578',
      skyTop: '#1d3a58', skyBot: '#4f8c94',
    },
    5: { // 깨진 대종 — 회보라·금
      wild: '#433d55', wildL: '#58506d', wildD: '#312c41', forest: '#393348', rubble: '#58526e',
      open: '#bdb4cd', openAlt: '#aea4c1', openDot: '#43385c',
      build: '#8b83a7', buildL: '#b2aac9', buildD: '#6e678f', buildSide: '#474160', buildGap: '#29253a',
      road: '#d6b870', roadL: '#efdca2', roadD: '#bb9b52', roadEdge: '#6a522c',
      water: '#4e4d88', waterD: '#2a2956', waterL: '#cdc7f4', shore: '#7c7492', foam: '#e8e2ff',
      lava: '#ff8a2a', lavaL: '#ffe28c', lavaD: '#c4401b', crust: '#2a2234',
      stone: '#8b85a1', stoneL: '#bcb6cf', stoneD: '#56506b', accent: '#e8bd4c',
      plaza: '#ddd2b2', plazaD: '#9c8a5a', wood: '#8f899b', woodD: '#5b5568',
      leaf: '#e2b84a', leafL: '#f6dc84', leafD: '#a8802a',
      flowers: ['#f2d27a', '#ffffff'], mist: '#241d33',
      skyTop: '#4e4864', skyBot: '#b4a6c6',
    },
  };

  /* ---------------- 결정적 해시 ---------------- */
  function hashStr(s) {
    let x = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) x = Math.imul(x ^ s.charCodeAt(i), 16777619);
    return x >>> 0;
  }
  /** (c, r, k) → [0, 1). 같은 맵 id면 늘 같은 값 */
  function rndFactory(key) {
    const base = hashStr(String(key));
    return (c, r, k = 0) => {
      let x = (base ^ Math.imul(c + 0x3a1, 0x9e3779b1) ^ Math.imul(r + 0x7c3, 0x85ebca77) ^ Math.imul(k + 0x1f5, 0xc2b2ae3d)) >>> 0;
      x ^= x >>> 16; x = Math.imul(x, 0x7feb352d);
      x ^= x >>> 15; x = Math.imul(x, 0x846ca68b);
      x ^= x >>> 16;
      return (x >>> 0) / 4294967296;
    };
  }

  /* ---------------- 덩어리(이어 붙인 칸) 경로 ----------------
   * cells의 칸들을 하나의 경로로. 바깥 모서리는 둥글게(R), 노출된 변은 ins만큼 안쪽으로.
   * 이웃 칸이 같은 집합이면 경계까지 꽉 채워 이음매가 없습니다(한 path 안 → 틈 없음). */
  function blobPath(cells, inF, ins, R) {
    let d = '';
    for (const [c, r] of cells) {
      const x0 = c * 100;
      const y0 = r * 100;
      // [모서리 x, y, 안쪽 부호 sx, sy, 가로 이웃 dc, 세로 이웃 dr, 들어오는 변이 세로인가]
      const corners = [
        [x0, y0, 1, 1, -1, -1, true],
        [x0 + 100, y0, -1, 1, 1, -1, false],
        [x0 + 100, y0 + 100, -1, -1, 1, 1, true],
        [x0, y0 + 100, 1, -1, -1, 1, false],
      ];
      let first = true;
      for (const [cx, cy, sx, sy, hd, vd, vin] of corners) {
        const hIn = inF(c + hd, r);
        const vIn = inF(c, r + vd);
        const P = (a, b) => `${f(cx + sx * a)} ${f(cy + sy * b)}`;
        const mv = (p) => { const s = (first ? 'M' : 'L') + p; first = false; return s; };
        if (hIn && vIn) {
          if (inF(c + hd, r + vd)) d += mv(P(0, 0));
          else if (vin) d += `${mv(P(0, ins))}Q${P(ins, ins)} ${P(ins, 0)}`;
          else d += `${mv(P(ins, 0))}Q${P(ins, ins)} ${P(0, ins)}`;
        } else if (hIn) d += mv(P(0, ins));
        else if (vIn) d += mv(P(ins, 0));
        else if (vin) d += `${mv(P(ins, ins + R))}Q${P(ins, ins)} ${P(ins + R, ins)}`;
        else d += `${mv(P(ins + R, ins))}Q${P(ins, ins)} ${P(ins, ins + R)}`;
      }
      d += 'Z';
    }
    return d;
  }

  /** 원 하나를 경로 조각으로 (여러 개를 한 path에 모으기 위해) */
  const circ = (x, y, r) => `M${f(x - r)} ${f(y)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0Z`;
  /** 타원 조각 */
  const ell = (x, y, rx, ry) => `M${f(x - rx)} ${f(y)}a${f(rx)} ${f(ry)} 0 1 0 ${f(2 * rx)} 0a${f(rx)} ${f(ry)} 0 1 0 ${f(-2 * rx)} 0Z`;

  /** 같은 모양새 조각을 한 path로 모으는 통 */
  function Buckets() {
    const map = new Map();
    return {
      add(attrs, d) { map.set(attrs, (map.get(attrs) || '') + d); },
      out() { let s = ''; for (const [a, d] of map) if (d) s += `<path d="${d}" ${a}/>`; return s; },
    };
  }
  const fillA = (col, op = 1) => `fill="${col}"${op < 1 ? ` fill-opacity="${op}"` : ''}`;
  const strokeA = (col, w, op = 1) => `fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"${op < 1 ? ` stroke-opacity="${op}"` : ''}`;

  /* =========================================================
   * 물체 기호 (나무·바위·기둥) — 바닥 중심 (0,0), 위쪽이 음수
   * ========================================================= */
  const SO = (w = 3.5) => `stroke="${OL}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;

  /** 동그란 수관(겹친 원): 바깥 외곽선 → 채움 → 하이라이트 */
  function canopy(blobs, grad, hlCol, ow = 3.5) {
    let s = `<path d="${blobs.map(([x, y, r]) => circ(x, y, r + ow)).join('')}" fill="${OL}"/>`;
    s += `<path d="${blobs.map(([x, y, r]) => circ(x, y, r)).join('')}" fill="${grad}"/>`;
    s += `<path d="${blobs.filter((b) => b[3]).map(([x, y, r]) => circ(x - r * 0.3, y - r * 0.35, r * 0.38)).join('')}" fill="${hlCol}" fill-opacity="0.55"/>`;
    return s;
  }
  /** 굵은 가지(외곽선 있는 선) */
  function branches(d, col, w) {
    return `<path d="${d}" ${strokeA(OL, w + 7)}/><path d="${d}" ${strokeA(col, w)}/>`;
  }

  /** 지역별 나무 기호들: [{ g: svg, top: 꼭대기 높이(양수), half: 반폭 }] */
  function treeSyms(region, P, def) {
    const leafG = def('leaf', (id) => h.rg(id, [[0, P.leafL], [0.55, P.leaf], [1, P.leafD]], 0.35, 0.3, 0.8));
    const trunk = (w = 6, ht = 26) => `<path d="M${-w} 2C${-w * 0.7} -8 ${-w * 0.6} ${-ht * 0.6} ${-w * 0.55} ${-ht}H${w * 0.55}C${w * 0.6} ${-ht * 0.6} ${w * 0.7} -8 ${w} 2Z" fill="${P.wood}" ${SO(3)}/>`;
    const pine = (tiers, wTop, wBot, hTot, snow) => {
      let s = trunk(5, 16);
      const n = tiers;
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1 || 1);
        const yb = -10 - (hTot - 10) * (i / n) * 0.92;
        const yt = yb - (hTot - 10) / n * 1.55;
        const w = wBot + (wTop - wBot) * t;
        const tip = i === n - 1 ? yt - 6 : yt;
        s += `<path d="M${-w} ${f(yb)}Q0 ${f(yb + 7)} ${w} ${f(yb)}L3 ${f(tip + 3)}Q0 ${f(tip - 1)} -3 ${f(tip + 3)}Z" fill="${leafG}" ${SO(3.2)}/>`;
        if (snow) s += `<path d="M${f(-w * 0.55)} ${f(yb - (yb - tip) * 0.42)}Q${f(-w * 0.2)} ${f(yb - (yb - tip) * 0.3)} 0 ${f(yb - (yb - tip) * 0.4)}Q${f(w * 0.3)} ${f(yb - (yb - tip) * 0.28)} ${f(w * 0.55)} ${f(yb - (yb - tip) * 0.44)}L2 ${f(tip + 4)}Q0 ${f(tip + 1)} -2 ${f(tip + 4)}Z" fill="#ffffff" ${SO(2.2)}/>`;
        else s += `<path d="M${f(-w * 0.55)} ${f(yb - 2)}L-2 ${f(tip + 6)}" ${strokeA(P.leafL, 3.5, 0.7)}/>`;
      }
      return s;
    };
    const out = [];
    if (region === 1) {
      out.push({ g: trunk() + canopy([[-14, -36, 19, 1], [14, -37, 19], [0, -53, 22, 1], [0, -33, 20]], leafG, P.leafL), top: 79, half: 37 });
      out.push({ g: trunk(5, 24) + canopy([[-11, -34, 17, 1], [12, -42, 20, 1], [-5, -55, 16, 1], [4, -30, 16]], leafG, P.leafL), top: 75, half: 36 });
      out.push({ g: pine(3, 9, 30, 80, false), top: 84, half: 33 });
      out.push({ g: `${canopy([[-16, -14, 14, 1], [14, -14, 14, 1], [0, -22, 16, 1]], leafG, P.leafL)}<path d="${circ(-8, -18, 3)}${circ(9, -24, 3)}${circ(16, -12, 3)}" fill="${P.flowers[2]}" ${SO(1.5)}/>`, top: 42, half: 34, bush: 1 });
    } else if (region === 2) {
      out.push({ g: pine(3, 9, 31, 84, true), top: 88, half: 34 });
      out.push({ g: pine(4, 8, 28, 88, true), top: 92, half: 31 });
      out.push({ g: pine(2, 10, 26, 58, true), top: 62, half: 29 });
      out.push({ g: `<path d="M-30 2C-34-10-22-24-6-24C2-34 22-30 26-16C34-12 34 0 28 2Z" fill="#f4f9fe" ${SO(3.2)}/><path d="M-20-12C-14-18-6-18 0-14" ${strokeA('#bcd0e4', 3)}/>`, top: 32, half: 34, bush: 1 });
    } else if (region === 3) {
      const cG = def('cactus', (id) => h.lg(id, [[0, P.leafL], [0.5, P.leaf], [1, P.leafD]], 'h'));
      const cactus = (arms) => {
        let s = '';
        const body = 'M-8 2V-54Q-8-64 0-64Q8-64 8-54V2Z';
        const armL = arms[0] ? `M-8 ${-arms[0]}H-18Q-24 ${-arms[0]} -24 ${-arms[0] - 6}V${-arms[0] - 22}Q-24 ${-arms[0] - 28} -19 ${-arms[0] - 28}Q-14 ${-arms[0] - 28} -14 ${-arms[0] - 22}V${-arms[0] - 9}H-8Z` : '';
        const armR = arms[1] ? `M8 ${-arms[1]}H18Q24 ${-arms[1]} 24 ${-arms[1] - 6}V${-arms[1] - 18}Q24 ${-arms[1] - 24} 19 ${-arms[1] - 24}Q14 ${-arms[1] - 24} 14 ${-arms[1] - 18}V${-arms[1] - 9}H8Z` : '';
        s += `<path d="${body}${armL}${armR}" fill="${OL}" stroke="${OL}" stroke-width="7" stroke-linejoin="round"/>`;
        s += `<path d="${body}${armL}${armR}" fill="${cG}"/>`;
        s += `<path d="M-3 -4V-56M3 -4V-58" ${strokeA(P.leafD, 2.2, 0.6)}/><path d="M-4.5 -10V-56" ${strokeA(P.leafL, 2.4, 0.7)}/>`;
        s += `<path d="${circ(0, -64, 3.5)}" fill="#ff7a8a" ${SO(1.6)}/>`;
        return s;
      };
      out.push({ g: cactus([22, 32]), top: 70, half: 28 });
      out.push({ g: cactus([30, 0]), top: 70, half: 28 });
      out.push({ g: branches('M0 2L-2-16L-14-30M-2-16L6-34M6-34L14-40M6-34L2-46M-2-16L12-22', P.wood, 4.5) + canopy([[-14, -32, 7, 1], [14, -40, 7, 1], [2, -48, 7, 1]], `${P.leafD}`, P.leafL, 3), top: 58, half: 26 });
      out.push({ g: `${canopy([[-13, -12, 12, 1], [12, -12, 12, 1], [0, -18, 13, 1]], '#9c8f4e', '#d8cc80')}<path d="M-8-22l-6-9M6-26l3-10M0-30v-8" ${strokeA(P.woodD, 2.6)}/>`, top: 40, half: 28, bush: 1 });
    } else if (region === 4) {
      const fr = (a, len) => {
        const r = (a * Math.PI) / 180;
        const ex = Math.cos(r) * len;
        const ey = Math.sin(r) * len * 0.75;
        const nx = -Math.sin(r) * 9;
        const ny = Math.cos(r) * 9;
        return `M0 0Q${f(ex * 0.5 + nx)} ${f(ey * 0.5 + ny - 10)} ${f(ex)} ${f(ey + 8)}Q${f(ex * 0.45)} ${f(ey * 0.45 - 2)} 0 0Z`;
      };
      const palm = (lean) => {
        const tx = lean;
        const tyTop = -62;
        let s = `<path d="M-6 2Q${tx * 0.3 - 6} -30 ${tx - 4} ${tyTop}H${tx + 4}Q${tx * 0.3 + 6} -30 6 2Z" fill="${P.wood}" ${SO(3)}/>`;
        s += `<path d="M${f(tx * 0.08 - 5)} -12h10M${f(tx * 0.25 - 5)} -26h10M${f(tx * 0.45 - 5)} -40h10M${f(tx * 0.7 - 5)} -52h10" ${strokeA(P.woodD, 2.4, 0.8)}/>`;
        const fronds = [200, 235, 270, 305, 340, 160, 20].map((a) => fr(a, 34)).join('');
        s += `<g transform="translate(${tx} ${tyTop})"><path d="${fronds}" fill="${leafG}" ${SO(3)}/><path d="${circ(-4, 3, 4)}${circ(4, 4, 4)}" fill="${P.woodD}" ${SO(2)}/></g>`;
        return s;
      };
      out.push({ g: palm(10), top: 88, half: 38 });
      out.push({ g: palm(-9), top: 88, half: 38 });
      out.push({ g: pine(3, 9, 28, 76, false), top: 80, half: 30 });
      const coral = branches('M0 2V-18M0-18L-14-32V-44M0-18L12-30V-46M-14-32L-22-38M12-30L20-36M0-18V-38', '#ff8a7a', 6) +
        `<path d="${circ(-14, -45, 3.5)}${circ(12, -47, 3.5)}${circ(0, -40, 3.5)}${circ(-22, -39, 3)}${circ(20, -37, 3)}" fill="#ffd0c4"/>`;
      out.push({ g: coral, top: 52, half: 28, coral: 1 });
    } else {
      // 잿빛 고목: 굵은 밑동 + 맨가지 + 금빛 잎 몇 장
      const wG = def('dwood', (id) => h.lg(id, [[0, h.shade(P.wood, 0.25)], [0.6, P.wood], [1, P.woodD]], 'h'));
      const stem = (w, ht) => `<path d="M${-w - 4} 2Q${-w} -6 ${-w * 0.7} ${-ht * 0.45}L${-w * 0.45} ${-ht}H${w * 0.45}L${w * 0.7} ${-ht * 0.45}Q${w} -6 ${w + 4} 2Z" fill="${wG}" ${SO(3.2)}/>`;
      const leaves = (pts) => `<path d="${pts.map(([x, y]) => `M${x} ${y}q4 -6 8 0q-4 6 -8 0Z`).join('')}" fill="${P.leaf}" ${SO(1.8)}/>`;
      out.push({ g: branches('M0-28L-16-42L-20-58M-16-42L-30-48M0-30L12-50L10-64M12-50L26-56M2-34L18-38', P.wood, 6) + stem(8, 34) + leaves([[-24, -60], [24, -58], [6, -67], [-34, -49]]), top: 72, half: 34 });
      out.push({ g: branches('M0-30L-13-48L-15-62M0-32L13-46L20-60M-13-48L-24-52M2-26L-12-28', P.wood, 5.5) + stem(7, 34) + leaves([[-19, -64], [16, -62], [-28, -53]]), top: 68, half: 30 });
      out.push({ g: `<path d="M-16 2L-14-14L-18-26L-8-21L-3-31L4-20L12-25L16 2Z" fill="${wG}" ${SO(3.2)}/><path d="M-5-4V-18M5-6L6-16" ${strokeA(P.woodD, 2.4)}/>${branches('M10-16L20-28', P.wood, 4.5)}${leaves([[18, -31]])}`, top: 34, half: 24, bush: 1 });
    }
    return out;
  }

  /** 지역별 바위 기호들 */
  function rockSyms(region, P, def) {
    const rG = def('rock', (id) => h.rg(id, [[0, P.stoneL], [0.5, P.stone], [1, P.stoneD]], 0.35, 0.25, 0.85));
    const out = [];
    const accentCap = (d) => {
      if (region === 1) return `<path d="${d}" fill="${P.accent}" ${SO(2)}/>`;
      if (region === 2) return `<path d="${d}" fill="#ffffff" ${SO(2)}/>`;
      return '';
    };
    const boulder = (body, cap, crack, extra = '') => `<path d="${body}" fill="${rG}" ${SO()}/>${accentCap(cap)}<path d="${crack}" ${strokeA(P.stoneD, 2.6, 0.85)}/>${extra}`;
    const A = { body: 'M-33 0C-37-10-32-26-18-34C-6-41 14-40 26-30C35-22 37-8 32 0C14 5-16 5-33 0Z', cap: 'M-24-27C-16-35-2-38 10-36C18-34 24-30 26-27C14-22-10-21-24-27Z', crack: 'M6-1L10-13L4-21', top: 40 };
    const B = { body: 'M-31 0C-35-12-27-30-11-32C3-34 13-24 13-12C13-4 9 0 5 2C-7 4-21 3-31 0ZM3 2C1-8 7-20 19-21C29-22 35-12 33-2C29 4 13 5 3 2Z', cap: 'M-25-21C-19-29-7-31 3-27C-5-23-15-22-25-21ZM8-14C11-19 19-21 26-18C22-14 14-13 8-14Z', crack: 'M-14-2L-11-12M22-2L24-9', top: 34 };
    const C = { body: 'M-22 0L-26-20L-16-46L-2-52L14-44L22-22L24 0C8 4-10 4-22 0Z', cap: 'M-16-46L-2-52L14-44L4-37Z', crack: 'M4-37L6-18L2 0', top: 54 };
    if (region === 3) {
      // 겹겹이 쌓인 사암
      const slab = (y, w, hh) => `<rect x="${-w}" y="${y - hh}" width="${w * 2}" height="${hh}" rx="7" fill="${rG}" ${SO()}/><path d="M${-w + 5} ${y - hh + 4}H${w - 6}" ${strokeA(P.accent, 3, 0.8)}/>`;
      out.push({ g: slab(2, 32, 18) + slab(-15, 25, 16) + slab(-30, 16, 14), top: 46 });
      out.push({ g: boulder(A.body, A.cap, A.crack, `<path d="M-30-12C-14-8 14-8 33-12" ${strokeA(P.accent, 3, 0.7)}/>`), top: A.top });
      out.push({ g: boulder(C.body, C.cap, C.crack, `<path d="M-24-14H23M-20-30H18" ${strokeA(P.accent, 3, 0.7)}/>`), top: C.top });
    } else if (region === 5) {
      const bG = def('bronze', (id) => h.rg(id, [[0, '#fbe3a0'], [0.5, '#d29a3a'], [1, '#7c5220']], 0.35, 0.3, 0.85));
      out.push({ g: boulder(A.body, A.cap, A.crack, `<path d="M-18-30L-10-20L-14-10" ${strokeA(P.accent, 2.6, 0.9)}/>`), top: A.top });
      out.push({ g: boulder(C.body, C.cap, C.crack), top: C.top });
      // 깨진 대종 조각(청동)
      out.push({ g: `<path d="M-29 -4C-28-22-18-38 0-46L7-34L-1-29L8-19L0-12L6 -4Z" fill="${bG}" ${SO()}/>` +
        `<path d="M-32 3C-32-2-31-5-29-8H6L10 3Z" fill="#8a5a22" ${SO()}/>` +
        `<path d="M-23-14C-20-25-14-33-5-39M-26-20C-24-24-22-27-20-30" ${strokeA('#fff0c0', 3, 0.65)}/>` +
        `<path d="M12 3L16-9L27-13L33-3L30 3Z" fill="${bG}" ${SO()}/><path d="M14-2H31" ${strokeA('#8a5a22', 3)}/>`, top: 48 });
    } else {
      const ex = region === 4 ? (d) => `<path d="${d}" fill="${P.accent}" ${SO(1.6)}/>` : () => '';
      out.push({ g: boulder(A.body, A.cap, A.crack, ex(circ(-20, -12, 3) + circ(-12, -6, 2.5) + circ(18, -8, 3))), top: A.top });
      out.push({ g: boulder(B.body, B.cap, B.crack, ex(circ(-18, -8, 2.6) + circ(24, -6, 2.6))), top: B.top });
      out.push({ g: boulder(C.body, C.cap, C.crack, ex(circ(-14, -10, 2.6) + circ(10, -6, 2.6))), top: C.top });
    }
    return out;
  }

  /** 무너진 기둥 기호들 */
  function pillarSyms(region, P, def) {
    const sG = def('pillar', (id) => h.lg(id, [[0, P.stone], [0.25, P.stoneL], [0.65, P.stone], [1, P.stoneD]], 'h'));
    const band = region === 5 ? P.accent : region === 4 ? '#3e8a5c' : region === 1 ? P.accent : null;
    const col = (ht, broken) => {
      const top = -15 - ht;
      let s = `<path d="M-27 0V-10L-23-15H23L27-10V0Z" fill="${sG}" ${SO()}/><path d="M-23-15H23" ${strokeA(P.stoneL, 3, 0.8)}/>`;
      const topEdge = broken ? `L17 ${top + 5}L9 ${top - 2}L3 ${top + 6}L-5 ${top - 4}L-11 ${top + 3}L-17 ${top}` : `L17 ${top}L-17 ${top}`;
      s += `<path d="M-17 -15H17${topEdge}Z" fill="${sG}" ${SO()}/>`;
      if (broken) s += `<path d="M-14 ${top + 3}L-11 ${top + 6}L-5 ${top + 1}L3 ${top + 9}L9 ${top + 2}L14 ${top + 7}" ${strokeA(P.stoneL, 2.6, 0.8)}/>`;
      s += `<path d="M-8 -18V${top + 8}M0 -18V${top + 10}M8 -18V${top + 8}" ${strokeA(P.stoneD, 2.4, 0.55)}/>`;
      if (!broken) s += `<path d="M-22 ${top}H22L19 ${top - 9}H-19Z" fill="${sG}" ${SO()}/>`;
      if (band) s += `<path d="M-17 ${-15 - ht * 0.4}H17" ${strokeA(band, 4, 0.85)}/>`;
      return s;
    };
    const drum = `<g transform="translate(26 -2)"><ellipse cx="0" cy="-6" rx="9" ry="8" fill="${P.stoneD}" ${SO(3)}/><path d="M0 -14H-12V2H0" fill="${sG}" ${SO(3)}/><ellipse cx="-12" cy="-6" rx="5" ry="8" fill="${P.stoneL}" ${SO(3)}/></g>`;
    return [
      { g: col(50, true), top: 66 },
      { g: col(28, true) + drum, top: 46 },
      { g: col(58, false), top: 82 },
    ];
  }

  /* =========================================================
   * 맵 바탕
   * ========================================================= */
  function mapBackground(map) {
    const cols = map.cols;
    const rows = map.rows;
    const kinds = map.kinds;
    const region = (map.def && PAL[map.def.region]) ? map.def.region : 1;
    const P = PAL[region];
    const W = cols * 100;
    const H = rows * 100;
    const rnd = rndFactory(map.id != null ? map.id : (map.def && map.def.id) || 'map');
    const inb = (c, r) => c >= 0 && r >= 0 && c < cols && r < rows;
    const kAt = (c, r) => (inb(c, r) ? kinds[r * cols + c] : 0);
    const isRoad = (k) => k === K.PATH || k === K.SPAWN || k === K.LANTERN;
    const isObst = (k) => k === K.WATER || k === K.ROCK || k === K.TREE || k === K.LAVA || k === K.PILLAR || k === K.AIR || k === 0;
    const cellsWhere = (pred) => {
      const out = [];
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (pred(kAt(c, r), c, r)) out.push([c, r]);
      return out;
    };

    const defs = [];
    const memo = {};
    const def = (key, mk) => {
      if (!memo[key]) { const id = h.uid('tr'); defs.push(mk(id)); memo[key] = `url(#${id})`; }
      return memo[key];
    };
    const body = [];

    /* ---- 다리 찾기: 길 칸의 양옆(또는 위아래)이 물/용암 ---- */
    const liquid = (k) => k === K.WATER || k === K.LAVA;
    const bridges = new Map();
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (kAt(c, r) !== K.PATH) continue;
        const n = kAt(c, r - 1); const s = kAt(c, r + 1); const w = kAt(c - 1, r); const e = kAt(c + 1, r);
        if (liquid(n) && liquid(s)) bridges.set(r * cols + c, { c, r, dir: 'h', lava: n === K.LAVA || s === K.LAVA });
        else if (liquid(w) && liquid(e)) bridges.set(r * cols + c, { c, r, dir: 'v', lava: w === K.LAVA || e === K.LAVA });
      }
    }
    const bridgeAt = (c, r) => (inb(c, r) ? bridges.get(r * cols + c) : undefined);

    /* ---- 0. 바탕 흙/풀 + 얼룩 ---- */
    body.push(`<rect width="${W}" height="${H}" fill="${P.wild}"/>`);
    const nL = def('nl', (id) => h.rg(id, [[0, P.wildL, 0.55], [1, P.wildL, 0]], 0.5, 0.5, 0.5));
    const nD = def('nd', (id) => h.rg(id, [[0, P.wildD, 0.6], [1, P.wildD, 0]], 0.5, 0.5, 0.5));
    {
      let s = '';
      const n = Math.round((cols * rows) / 2.5);
      for (let i = 0; i < n; i++) {
        const x = rnd(i, 1, 11) * W;
        const y = rnd(i, 2, 11) * H;
        const rx = 50 + rnd(i, 3, 11) * 90;
        s += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(rx)}" ry="${f(rx * (0.5 + rnd(i, 4, 11) * 0.3))}" fill="${i % 2 ? nL : nD}"/>`;
      }
      body.push(s);
    }

    /* ---- 1. 숲 바닥 · 자갈 바닥 ---- */
    const treeCells = cellsWhere((k) => k === K.TREE);
    if (treeCells.length) {
      const inT = (c, r) => (inb(c, r) ? kAt(c, r) === K.TREE : true);
      body.push(`<path d="${blobPath(treeCells, inT, 5, 34)}" fill="${P.forest}"/>`);
    }
    const rockCells = cellsWhere((k) => k === K.ROCK || k === K.PILLAR);
    if (rockCells.length) {
      const inR = (c, r) => { const k = kAt(c, r); return k === K.ROCK || k === K.PILLAR; };
      body.push(`<path d="${blobPath(rockCells, inR, 9, 32)}" fill="${P.rubble}" fill-opacity="0.75"/>`);
    }

    /* ---- 2. 물 (다리 아래 포함) ---- */
    const waterAt = (c, r) => { if (!inb(c, r)) return true; const k = kAt(c, r); if (k === K.WATER) return true; const b = bridgeAt(c, r); return !!(b && !b.lava); };
    const waterCells = cellsWhere((k, c, r) => k === K.WATER || (bridgeAt(c, r) && !bridgeAt(c, r).lava));
    if (waterCells.length) {
      const wG = def('water', (id) => `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${f(W * 0.3)}" y2="${H}"><stop offset="0" stop-color="${h.shade(P.water, 0.08)}"/><stop offset="1" stop-color="${h.shade(P.water, -0.12)}"/></linearGradient>`);
      const coast = region === 4;
      body.push(`<path d="${blobPath(waterCells, waterAt, 1, 38)}" fill="${P.shore}"/>`);
      body.push(`<path d="${blobPath(waterCells, waterAt, 6, 36)}" fill="${h.shade(P.shore, -0.18)}"/>`);
      body.push(`<path d="${blobPath(waterCells, waterAt, coast ? 9 : 10, 34)}" fill="${P.foam}"/>`);
      body.push(`<path d="${blobPath(waterCells, waterAt, coast ? 15 : 13, 31)}" fill="${wG}"/>`);
      body.push(`<path d="${blobPath(waterCells, waterAt, 30, 20)}" fill="${P.waterD}" fill-opacity="0.45"/>`);
      // 잔물결·반짝임
      const bk = Buckets();
      for (const [c, r] of waterCells) {
        if (bridgeAt(c, r)) continue;
        const n = 1 + Math.floor(rnd(c, r, 21) * 2);
        for (let i = 0; i < n; i++) {
          const x = c * 100 + 24 + rnd(c, r, 22 + i) * 52;
          const y = r * 100 + 26 + rnd(c, r, 24 + i) * 50;
          const w = 9 + rnd(c, r, 26 + i) * 8;
          bk.add(strokeA(P.waterL, 3.2, 0.7), `M${f(x - w)} ${f(y)}q${f(w / 2)} ${-5} ${f(w)} 0q${f(w / 2)} 5 ${f(w)} 0`);
        }
        if (rnd(c, r, 28) < 0.35) bk.add(fillA('#ffffff', 0.75), circ(c * 100 + 30 + rnd(c, r, 29) * 40, r * 100 + 30 + rnd(c, r, 30) * 40, 2.6));
        // 지역 장식
        const v = rnd(c, r, 31);
        const x = c * 100 + 28 + rnd(c, r, 32) * 44;
        const y = r * 100 + 30 + rnd(c, r, 33) * 40;
        if (region === 1 && v < 0.3) {
          bk.add(`fill="#5aa64a" ${SO(2.5)}`, `M${f(x)} ${f(y)}l9 -3a10 8 0 1 0 0 6Z`);
          if (v < 0.12) bk.add(`fill="#ffc6d8" ${SO(1.8)}`, circ(x - 4, y - 1, 3.2));
        } else if (region === 2 && v < 0.35) {
          bk.add(`fill="#f2fbff" ${SO(2.4)}`, `M${f(x - 12)} ${f(y)}l5 -7h13l6 6l-5 6h-14Z`);
        } else if (region === 4 && v < 0.3) {
          bk.add(strokeA('#ffffff', 3.2, 0.8), `M${f(x - 12)} ${f(y)}q6 -7 12 0q6 7 12 0`);
        } else if (region === 5 && v < 0.3) {
          bk.add(fillA(P.accent, 0.8), `M${f(x)} ${f(y - 5)}l2 4l4 1l-4 1l-2 4l-2 -4l-4 -1l4 -1Z`);
        }
      }
      body.push(bk.out());
    }

    /* ---- 3. 용암 ---- */
    const lavaCells = cellsWhere((k, c, r) => k === K.LAVA || (bridgeAt(c, r) && bridgeAt(c, r).lava));
    if (lavaCells.length) {
      const lavaAt = (c, r) => { if (!inb(c, r)) return true; const k = kAt(c, r); if (k === K.LAVA) return true; const b = bridgeAt(c, r); return !!(b && b.lava); };
      const blurF = def('lblur', (id) => h.blur(id, 9));
      const lG = def('lava', (id) => h.rg(id, [[0, P.lavaL], [0.5, P.lava], [1, P.lavaD]], 0.5, 0.5, 0.7));
      const d0 = blobPath(lavaCells, lavaAt, 4, 34);
      const d1 = blobPath(lavaCells, lavaAt, 9, 32);
      body.push(`<path d="${d0}" fill="${P.lava}" fill-opacity="0.75" filter="${blurF}"/>`);
      body.push(`<path d="${d0}" fill="${P.crust}"/>`);
      body.push(`<path d="${d1}" fill="${P.lava}"/>`);
      // 판 모양 딱지 사이로 빛나는 금 — 칸을 넘어 이어지도록 공용 격자점(흔들림) 사용
      const clipId = h.uid('tr');
      defs.push(`<clipPath id="${clipId}"><path d="${d1}"/></clipPath>`);
      const S2 = 50;
      const jp = (gx, gy) => [gx * S2 + (rnd(gx, gy, 41) - 0.5) * 22, gy * S2 + (rnd(gx, gy, 42) - 0.5) * 22];
      let plates = '';
      let hot = '';
      for (const [c, r] of lavaCells) {
        for (let sy = 0; sy < 2; sy++) {
          for (let sx = 0; sx < 2; sx++) {
            const gx = c * 2 + sx;
            const gy = r * 2 + sy;
            const q = [jp(gx, gy), jp(gx + 1, gy), jp(gx + 1, gy + 1), jp(gx, gy + 1)];
            const cx = (q[0][0] + q[1][0] + q[2][0] + q[3][0]) / 4;
            const cy = (q[0][1] + q[1][1] + q[2][1] + q[3][1]) / 4;
            const sh = 0.72;
            const pts = q.map(([x, y]) => [cx + (x - cx) * sh, cy + (y - cy) * sh]);
            plates += `M${pts.map(([x, y]) => `${f(x)} ${f(y)}`).join('L')}Z`;
            hot += circ(cx, cy, 7);
          }
        }
      }
      const pG = def('crust', (id) => h.rg(id, [[0, h.shade(P.crust, 0.25)], [1, P.crust]], 0.35, 0.3, 0.9));
      body.push(`<g clip-path="url(#${clipId})"><path d="${plates}" fill="${pG}" stroke="${h.shade(P.lavaD, -0.2)}" stroke-width="2"/><path d="${hot}" fill="${P.lavaD}" fill-opacity="0.35"/></g>`);
      body.push(`<path d="${d1}" fill="none" stroke="${P.lavaL}" stroke-width="3" stroke-opacity="0.8"/>`);
    }

    /* ---- 4. 공터: 밝은 땅 + 바둑판 + 점선 격자 ---- */
    const openCells = cellsWhere((k) => k === K.OPEN);
    if (openCells.length) {
      const inO = (c, r) => { if (!inb(c, r)) return true; const k = kAt(c, r); return k === K.OPEN || isRoad(k); };
      const dO = blobPath(openCells, inO, 4, 16);
      const oG = def('open', (id) => h.rg(id, [[0, h.shade(P.open, 0.12)], [1, P.open]], 0.4, 0.35, 0.8));
      body.push(`<path d="${blobPath(openCells, inO, 1, 18)}" fill="${h.shade(P.open, -0.28)}"/>`);
      body.push(`<path d="${dO}" fill="${oG}"/>`);
      const clipId = h.uid('tr');
      defs.push(`<clipPath id="${clipId}"><path d="${dO}"/></clipPath>`);
      let chk = '';
      for (const [c, r] of openCells) if ((c + r) % 2 === 0) chk += `M${c * 100} ${r * 100}h100v100h-100Z`;
      const bk = Buckets();
      // 장식(작고 흐리게): 꽃·풀·금·반짝임
      for (const [c, r] of openCells) {
        const n = rnd(c, r, 51) < 0.6 ? 1 : 2;
        for (let i = 0; i < n; i++) {
          const x = c * 100 + 22 + rnd(c, r, 52 + i) * 56;
          const y = r * 100 + 24 + rnd(c, r, 54 + i) * 52;
          const v = rnd(c, r, 56 + i);
          if (region === 1) {
            if (v < 0.5) bk.add(strokeA(P.openDot, 2.4, 0.35), `M${f(x - 4)} ${f(y)}l-2 -7M${f(x)} ${f(y)}v-8M${f(x + 4)} ${f(y)}l2 -6`);
            else bk.add(fillA(P.flowers[Math.floor(v * 10) % P.flowers.length], 0.9), circ(x, y, 3));
          } else if (region === 2) {
            if (v < 0.5) bk.add(strokeA('#ffffff', 2.6, 0.8), `M${f(x - 10)} ${f(y - 4)}l7 4l5 -3l8 6`);
            else bk.add(fillA('#ffffff', 0.9), `M${f(x)} ${f(y - 5)}l1.5 3.5l3.5 1.5l-3.5 1.5l-1.5 3.5l-1.5 -3.5l-3.5 -1.5l3.5 -1.5Z`);
          } else if (region === 3) {
            bk.add(strokeA(P.openDot, 2.4, 0.3), `M${f(x - 10)} ${f(y)}l6 -2l4 4l7 -3M${f(x - 4)} ${f(y - 2)}l-2 -6`);
          } else if (region === 4) {
            if (v < 0.55) bk.add(strokeA(P.openDot, 2.4, 0.35), `M${f(x - 3)} ${f(y)}q-3 -6 -1 -10M${f(x + 2)} ${f(y)}q2 -6 5 -8`);
            else bk.add(`fill="${P.flowers[Math.floor(v * 10) % P.flowers.length]}" stroke="${P.openDot}" stroke-width="1.4" stroke-opacity="0.5"`, `M${f(x - 4)} ${f(y + 2)}q4 -9 8 0Z`);
          } else {
            if (v < 0.5) bk.add(fillA(P.accent, 0.7), circ(x, y, 2.2));
            else bk.add(strokeA(P.openDot, 2.2, 0.3), `M${f(x - 8)} ${f(y)}l5 -3l4 3l6 -2`);
          }
        }
      }
      // 칸 경계 점선: 공터끼리 맞닿은 변 + 꼭짓점 십자
      let grid = '';
      let cross = '';
      for (const [c, r] of openCells) {
        if (kAt(c + 1, r) === K.OPEN) grid += `M${c * 100 + 100} ${r * 100 + 14}V${r * 100 + 86}`;
        if (kAt(c, r + 1) === K.OPEN) grid += `M${c * 100 + 14} ${r * 100 + 100}H${c * 100 + 86}`;
        if (kAt(c + 1, r) === K.OPEN && kAt(c, r + 1) === K.OPEN && kAt(c + 1, r + 1) === K.OPEN) {
          const x = c * 100 + 100;
          const y = r * 100 + 100;
          cross += `M${x - 7} ${y}h14M${x} ${y - 7}v14`;
        }
      }
      body.push(`<g clip-path="url(#${clipId})"><path d="${chk}" fill="${P.openAlt}" fill-opacity="0.55"/>${bk.out()}</g>`);
      body.push(`<path d="${grid}" fill="none" stroke="${P.openDot}" stroke-opacity="0.42" stroke-width="4" stroke-linecap="round" stroke-dasharray="0.1 12"/>`);
      body.push(`<path d="${cross}" ${strokeA(P.openDot, 3.4, 0.5)}/>`);
    }

    /* ---- 5. 건설지: 칸마다 돋운 판 ---- */
    const buildCells = cellsWhere((k) => k === K.BUILD);
    if (buildCells.length) {
      const inB = (c, r) => kAt(c, r) === K.BUILD;
      body.push(`<path d="${blobPath(buildCells, inB, 1, 14)}" fill="${P.buildGap}"/>`);
      const bG = def('build', (id) => h.lg(id, [[0, P.buildL], [0.45, P.build], [1, P.buildD]], [0, 0, 0.6, 1]));
      let side = '';
      let top = '';
      let hl = '';
      let edge = '';
      const bk = Buckets();
      for (const [c, r] of buildCells) {
        const x = c * 100;
        const y = r * 100;
        side += `M${x + 18} ${y + 9}H${x + 82}Q${x + 95} ${y + 9} ${x + 95} ${y + 22}V${y + 83}Q${x + 95} ${y + 96} ${x + 82} ${y + 96}H${x + 18}Q${x + 5} ${y + 96} ${x + 5} ${y + 83}V${y + 22}Q${x + 5} ${y + 9} ${x + 18} ${y + 9}Z`;
        top += `M${x + 18} ${y + 5}H${x + 82}Q${x + 95} ${y + 5} ${x + 95} ${y + 18}V${y + 73}Q${x + 95} ${y + 86} ${x + 82} ${y + 86}H${x + 18}Q${x + 5} ${y + 86} ${x + 5} ${y + 73}V${y + 18}Q${x + 5} ${y + 5} ${x + 18} ${y + 5}Z`;
        hl += `M${x + 10} ${y + 66}V${y + 20}Q${x + 10} ${y + 10} ${x + 20} ${y + 10}H${x + 78}`;
        edge += `M${x + 7} ${y + 80}Q${x + 12} ${y + 86} ${x + 22} ${y + 86}H${x + 78}Q${x + 88} ${y + 86} ${x + 93} ${y + 80}`;
        // 작은 장식(판 가장자리 쪽)
        const v = rnd(c, r, 61);
        const px = x + 20 + rnd(c, r, 62) * 60;
        const py = y + 20 + rnd(c, r, 63) * 50;
        if (v < 0.55) {
          if (region === 1 || region === 4) bk.add(strokeA(P.buildD, 2.4, 0.7), `M${f(px - 4)} ${f(py)}l-2 -7M${f(px)} ${f(py)}v-8M${f(px + 4)} ${f(py)}l2 -6`);
          else if (region === 2) bk.add(fillA('#ffffff', 0.8), ell(px, py, 9, 4));
          else if (region === 3) bk.add(strokeA(P.buildD, 2.4, 0.6), `M${f(px - 9)} ${f(py)}l6 -3l5 4l6 -3`);
          else bk.add(strokeA(P.accent, 2.2, 0.55), `M${f(px - 8)} ${f(py)}l5 -4l4 4l5 -3`);
        }
        if (region === 1 && v > 0.88) bk.add(fillA(P.flowers[1]), circ(px, py, 3));
      }
      body.push(`<path d="${side}" fill="${P.buildSide}" ${SO(2.5)}/>`);
      body.push(`<path d="${top}" fill="${bG}"/>`);
      body.push(`<path d="${hl}" ${strokeA(P.buildL, 3.5, 0.85)}/>`);
      body.push(`<path d="${edge}" ${strokeA(P.buildD, 3, 0.8)}/>`);
      body.push(bk.out());
    }

    /* ---- 6. 길 (끊김 없이 둥글게 이어진 띠) ---- */
    const roadCells = cellsWhere((k) => isRoad(k));
    if (roadCells.length) {
      let segR = '';
      let segB = '';
      let blocks = '';
      for (const [c, r] of roadCells) {
        const cx = c * 100 + 50;
        const cy = r * 100 + 50;
        const nb = [[0, -1], [1, 0], [0, 1], [-1, 0]].map(([dc, dr]) => kAt(c + dc, r + dr));
        if (isRoad(nb[1])) segR += `M${cx} ${cy}H${cx + 100}`;
        if (isRoad(nb[2])) segR += `M${cx} ${cy}V${cy + 100}`;
        if (!nb.some(isRoad)) segR += `M${cx} ${cy}h.1`;
        // 공터로 들어가는 길: 경계까지
        [[0, -1], [1, 0], [0, 1], [-1, 0]].forEach(([dc, dr], i) => {
          if (nb[i] === K.OPEN) segB += `M${cx} ${cy}L${cx + dc * 52} ${cy + dr * 52}`;
        });
        // 가장자리 입구: 맵 밖까지
        if (kAt(c, r) === K.SPAWN) {
          if (c === 0) segB += `M${cx} ${cy}H${cx - 70}`;
          else if (c === cols - 1) segB += `M${cx} ${cy}H${cx + 70}`;
          else if (r === 0) segB += `M${cx} ${cy}V${cy - 70}`;
          else if (r === rows - 1) segB += `M${cx} ${cy}V${cy + 70}`;
        }
        if (isRoad(kAt(c + 1, r)) && isRoad(kAt(c, r + 1)) && isRoad(kAt(c + 1, r + 1))) blocks += `M${cx} ${cy}h100v100h-100Z`;
      }
      const RW = 70;
      const layer = (col, w, op = 1, extra = '') => {
        const o = op < 1 ? ` stroke-opacity="${op}"` : '';
        let s = `<path d="${segR}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"${o}${extra}/>`;
        if (segB) s += `<path d="${segB}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="butt"${o}${extra}/>`;
        if (blocks && op === 1) s += `<path d="${blocks}" fill="${col}"/>`;
        return s;
      };
      // 길 결 무늬(지역별)
      const tex = def('rtex', (id) => {
        let p = '';
        if (region === 1) p = `<path d="${circ(8, 10, 2.2)}${circ(31, 4, 1.6)}${circ(40, 30, 2.4)}${circ(17, 38, 1.8)}${circ(46, 47, 1.5)}" fill="${P.roadD}"/><path d="${circ(25, 21, 1.8)}${circ(4, 44, 1.6)}" fill="${P.roadL}"/>`;
        else if (region === 2) p = `<path d="${ell(10, 12, 3, 4.5)}${ell(17, 18, 3, 4.5)}${ell(36, 34, 3, 4.5)}${ell(43, 40, 3, 4.5)}" fill="${P.roadD}"/><path d="${circ(30, 8, 1.8)}${circ(6, 40, 1.8)}" fill="#ffffff"/>`;
        else if (region === 3) p = `<path d="M2 14q6 -4 12 0t12 0M24 36q6 -4 12 0t12 0" fill="none" stroke="${P.roadD}" stroke-width="2.4" stroke-linecap="round"/><path d="${circ(40, 12, 2)}${circ(10, 40, 1.8)}" fill="${P.roadEdge}" fill-opacity="0.5"/>`;
        else if (region === 4) p = `<path d="M4 18q10 -5 20 0M28 42q10 -5 20 0" fill="none" stroke="${P.roadL}" stroke-width="3" stroke-linecap="round"/><path d="${circ(38, 14, 2)}${circ(12, 34, 1.6)}" fill="${P.roadD}"/>`;
        else p = `<path d="M0 0.5H50M0 25.5H50M17 0V25M42 25V50M5 50V25" fill="none" stroke="${P.roadEdge}" stroke-width="2.6" stroke-opacity="0.55"/><path d="M2 3H15M19 28H40" stroke="${P.roadL}" stroke-width="2" fill="none"/>`;
        return `<pattern id="${id}" patternUnits="userSpaceOnUse" width="50" height="50">${p}</pattern>`;
      });
      body.push(layer(P.roadEdge, RW + 10));
      body.push(layer(P.roadD, RW));
      body.push(layer(P.road, RW - 14));
      body.push(layer(P.roadL, RW * 0.36, 0.55));
      body.push(layer(tex, RW - 8, 1).replace(/<path d="[^"]*" fill="url\([^)]*\)"\/>/g, ''));
    }

    /* ---- 7. 다리 ---- */
    for (const b of bridges.values()) {
      const cx = b.c * 100 + 50;
      const cy = b.r * 100 + 50;
      const along = b.dir === 'h';
      const prevB = along ? bridgeAt(b.c - 1, b.r) : bridgeAt(b.c, b.r - 1);
      const nextB = along ? bridgeAt(b.c + 1, b.r) : bridgeAt(b.c, b.r + 1);
      const L = prevB ? -50 : -56;
      const R = nextB ? 50 : 56;
      let s = '';
      // 지역 좌표: x = 길 방향, y = 강 방향(-42~42)
      if (!b.lava) {
        const woodG = def('plank', (id) => h.lg(id, [[0, h.shade(P.wood, 0.25)], [1, P.wood]]));
        s += `<rect x="${L}" y="-34" width="${R - L}" height="${76}" fill="#000" fill-opacity="0.22"/>`;
        s += `<rect x="${L}" y="-38" width="${R - L}" height="76" fill="${woodG}" ${SO(3)}/>`;
        let pl = '';
        for (let x = L + 12; x < R - 4; x += 12) pl += `M${x} -36V36`;
        s += `<path d="${pl}" ${strokeA(P.woodD, 2.6, 0.75)}/>`;
        s += `<path d="M${L} -38H${R}M${L} 38H${R}" ${strokeA(OL, 11)}/><path d="M${L} -38H${R}M${L} 38H${R}" ${strokeA(P.woodD, 6)}/>`;
        const posts = [];
        if (!prevB) posts.push(L + 5);
        if (!nextB) posts.push(R - 5);
        for (const x of posts) s += `<rect x="${x - 6}" y="-46" width="12" height="16" rx="3" fill="${P.wood}" ${SO(3)}/><rect x="${x - 6}" y="30" width="12" height="16" rx="3" fill="${P.wood}" ${SO(3)}/>`;
      } else {
        const stG = def('bstone', (id) => h.lg(id, [[0, P.stoneL], [1, P.stone]]));
        s += `<rect x="${L}" y="-40" width="${R - L}" height="80" fill="${stG}" ${SO(3)}/>`;
        let j = '';
        for (let x = L + 18; x < R - 4; x += 18) j += `M${x} -40V40`;
        s += `<path d="${j}M${L} 0H${R}" ${strokeA(P.stoneD, 2.4, 0.7)}/>`;
        s += `<path d="M${L} -40H${R}M${L} 40H${R}" ${strokeA(OL, 10)}/><path d="M${L} -40H${R}M${L} 40H${R}" ${strokeA(P.stoneD, 5)}/>`;
      }
      body.push(`<g transform="translate(${cx} ${cy})${along ? '' : ' rotate(90)'}">${s}</g>`);
    }

    /* ---- 8. 울림등 광장 ---- */
    if (map.lantern) {
      const cx = map.lantern.c * 100 + 50;
      const cy = map.lantern.r * 100 + 50;
      let j = '';
      for (let i = 0; i < 8; i++) {
        const a = ((i * 45 + 22.5) * Math.PI) / 180;
        j += `M${f(cx + Math.cos(a) * 16)} ${f(cy + Math.sin(a) * 16)}L${f(cx + Math.cos(a) * 39)} ${f(cy + Math.sin(a) * 39)}`;
      }
      const pG = def('plaza', (id) => h.rg(id, [[0, h.shade(P.plaza, 0.3)], [0.7, P.plaza], [1, h.shade(P.plaza, -0.08)]], 0.4, 0.35, 0.8));
      body.push(`<circle cx="${cx}" cy="${cy}" r="47" fill="${P.plazaD}" ${SO(3)}/><circle cx="${cx}" cy="${cy}" r="40" fill="${pG}"/>` +
        `<path d="${j}" ${strokeA(P.plazaD, 3)}/><circle cx="${cx}" cy="${cy}" r="16" fill="none" stroke="${P.plazaD}" stroke-width="3"/>` +
        `<path d="M${cx - 34} ${cy - 16}A37 37 0 0 1 ${cx - 12} ${cy - 35}" ${strokeA('#ffffff', 3.5, 0.55)}/>` +
        `<path d="${[0, 1, 2, 3].map((i) => { const a = ((i * 90 + 45) * Math.PI) / 180; return circ(cx + Math.cos(a) * 43.5, cy + Math.sin(a) * 43.5, 3.2); }).join('')}" fill="#f2c14e" ${SO(1.6)}/>`);
    }

    /* ---- 9. 지상 입구: 어두운 안개 동굴 ---- */
    const mouthG = def('mouth', (id) => h.rg(id, [[0, '#07050c'], [0.55, '#140f1e'], [0.85, P.mist], [1, h.shade(P.mist, 0.25)]], 0.62, 0.5, 0.6));
    const hazeG = def('haze', (id) => h.rg(id, [[0, '#cfc6e8', 0.55], [1, '#cfc6e8', 0]], 0.5, 0.5, 0.5));
    const rockG = def('rock', (id) => h.rg(id, [[0, P.stoneL], [0.5, P.stone], [1, P.stoneD]], 0.35, 0.25, 0.85));
    const caveG = def('cave', (id) => h.lg(id, [[0, h.shade(P.stone, -0.05)], [1, h.shade(P.stoneD, -0.25)]], [0, 0, 0.8, 1]));
    for (const s of map.spawns || []) {
      const cx = s.c * 100 + 50;
      const cy = s.r * 100 + 50;
      let ang = null;
      if (s.c === 0) ang = 0; else if (s.c === cols - 1) ang = 180; else if (s.r === 0) ang = 90; else if (s.r === rows - 1) ang = 270;
      const haze = `<ellipse cx="6" cy="2" rx="34" ry="26" fill="${hazeG}"/><path d="${ell(4, -12, 14, 5)}${ell(14, 14, 16, 5)}" fill="#e4def5" fill-opacity="0.35"/>`;
      if (ang !== null) {
        // 맵 가장자리에 붙은 바위 언덕 + 어두운 동굴 입구 (지역 좌표: 가장자리 = 왼쪽)
        const cave = `<path d="M-54 -52H-30C-8 -48 4 -28 1 -8C4 14 -4 40 -28 52H-54Z" fill="${caveG}" ${SO(3.5)}/>` +
          `<path d="M-44 -42C-28 -40-16-32-10-20M-14 30C-10 24-8 18-8 12" ${strokeA(P.stoneL, 3.2, 0.7)}/>` +
          `<path d="M-48 -26L-38 -22M-46 28L-36 34" ${strokeA(OL, 2.6, 0.5)}/>` +
          `<path d="M-52 -30C-34 -30-12 -20-10 2C-12 22-34 32-52 32Z" fill="${mouthG}" ${SO(3.5)}/>`;
        body.push(`<g transform="translate(${cx} ${cy}) rotate(${ang})">${cave}${haze}</g>`);
      } else {
        body.push(`<g transform="translate(${cx} ${cy})"><ellipse cx="0" cy="2" rx="38" ry="30" fill="${caveG}" ${SO(3.5)}/><ellipse cx="0" cy="4" rx="27" ry="20" fill="${mouthG}" ${SO(3)}/>${haze}</g>`);
      }
    }

    /* ---- 10. 길가·장애물 땅 장식 ---- */
    {
      const bk = Buckets();
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const k = kAt(c, r);
          const x0 = c * 100;
          const y0 = r * 100;
          if (k === K.PATH && !bridgeAt(c, r)) {
            // 길가 풀(길 가장자리 바깥쪽 어깨)
            const sides = [[0, -1], [1, 0], [0, 1], [-1, 0]].filter(([dc, dr]) => !isRoad(kAt(c + dc, r + dr)) && kAt(c + dc, r + dr) !== K.OPEN);
            for (const [dc, dr] of sides) {
              if (rnd(c, r, 71 + dc * 3 + dr) > 0.55) continue;
              const t = rnd(c, r, 75 + dc * 3 + dr) * 50 - 25;
              const x = x0 + 50 + dc * 43 + (dr ? t : 0);
              const y = y0 + 50 + dr * 43 + (dc ? t : 0) + 4;
              if (region === 2) bk.add(fillA('#ffffff', 0.9), ell(x, y, 8, 4));
              else if (region === 5) bk.add(fillA(P.stoneD), circ(x, y - 2, 3.5));
              else bk.add(strokeA(region === 3 ? '#c49a5c' : P.wildL, 2.6), `M${f(x - 4)} ${f(y)}l-2 -7M${f(x)} ${f(y)}v-9M${f(x + 4)} ${f(y)}l2 -6`);
            }
            // 길 위 돌멩이
            if (rnd(c, r, 79) < 0.5) {
              const x = x0 + 30 + rnd(c, r, 80) * 40;
              const y = y0 + 30 + rnd(c, r, 81) * 40;
              bk.add(`fill="${P.roadD}" stroke="${P.roadEdge}" stroke-width="1.6"`, ell(x, y, 4.5, 3.2));
            }
          } else if (k === K.ROCK || k === K.TREE || k === K.AIR) {
            const n = 1 + Math.floor(rnd(c, r, 82) * 2);
            for (let i = 0; i < n; i++) {
              const x = x0 + 14 + rnd(c, r, 83 + i) * 72;
              const y = y0 + 20 + rnd(c, r, 85 + i) * 72;
              const v = rnd(c, r, 87 + i);
              if (region === 1) {
                if (v < 0.65) bk.add(strokeA(P.wildL, 2.6), `M${f(x - 4)} ${f(y)}l-2 -7M${f(x)} ${f(y)}v-9M${f(x + 4)} ${f(y)}l2 -6`);
                else bk.add(`fill="${P.flowers[Math.floor(v * 7) % 4]}" ${SO(1.4)}`, circ(x, y, 3.4));
              } else if (region === 2) bk.add(fillA('#ffffff', 0.85), ell(x, y, 10, 4.5));
              else if (region === 3) bk.add(fillA(P.wildD, 0.8), ell(x, y, 5, 3.5));
              else if (region === 4) bk.add(strokeA(P.wildL, 2.6), `M${f(x - 3)} ${f(y)}q-3 -6 -1 -10M${f(x + 2)} ${f(y)}q2 -6 5 -8`);
              else bk.add(fillA(P.wildL, 0.9), circ(x, y, 3.2));
            }
          }
        }
      }
      body.push(bk.out());
    }

    /* ---- 10b. 이어진 바위(3칸 이상) = 돋운 바위 벽/능선 ---- */
    const wallSet = new Set();
    {
      const seen = new Uint8Array(cols * rows);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const i0 = r * cols + c;
          if (seen[i0] || kAt(c, r) !== K.ROCK) continue;
          const group = [];
          const stack = [[c, r]];
          seen[i0] = 1;
          while (stack.length) {
            const [cc, rr] = stack.pop();
            group.push(rr * cols + cc);
            for (const [dc, dr] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
              const nc = cc + dc;
              const nr = rr + dr;
              if (kAt(nc, nr) !== K.ROCK || seen[nr * cols + nc]) continue;
              seen[nr * cols + nc] = 1;
              stack.push([nc, nr]);
            }
          }
          if (group.length >= 3) group.forEach((i) => wallSet.add(i));
        }
      }
    }
    const wallCells = cellsWhere((k, c, r) => wallSet.has(r * cols + c));
    if (wallCells.length) {
      const inW = (c, r) => inb(c, r) && wallSet.has(r * cols + c);
      const dW = blobPath(wallCells, inW, 15, 14);
      const topCol = region === 2 ? '#f3f8fd' : P.stone;
      const wTex = def('wtex', (id) => {
        let p;
        if (region === 1 || region === 5) p = `<path d="M0 1H50M0 26H50M18 1V26M43 26V50M6 26V50" fill="none" stroke="${P.stoneD}" stroke-width="2.6" stroke-opacity="0.6"/><path d="M3 5H15M22 30H40" stroke="${P.stoneL}" stroke-width="2.4" stroke-opacity="0.7" fill="none"/>`;
        else if (region === 2) p = `<path d="M6 14q8 -4 16 0M30 38q8 -4 16 0" fill="none" stroke="#c4d6ea" stroke-width="3" stroke-linecap="round"/>`;
        else if (region === 3) p = `<path d="M0 12H50M0 37H50" stroke="${P.accent}" stroke-width="3" stroke-opacity="0.6" fill="none"/><path d="M14 20l6 6l-3 6" stroke="${P.stoneD}" stroke-width="2.2" fill="none"/>`;
        else p = `<path d="${circ(10, 12, 2.6)}${circ(34, 30, 2.2)}${circ(20, 42, 2)}" fill="${P.accent}" fill-opacity="0.8"/><path d="M28 8l6 8l-4 6" stroke="${P.stoneD}" stroke-width="2.2" fill="none"/>`;
        return `<pattern id="${id}" patternUnits="userSpaceOnUse" width="50" height="50">${p}</pattern>`;
      });
      const faceTex = def('ftex', (id) => `<pattern id="${id}" patternUnits="userSpaceOnUse" width="34" height="100"><path d="M17 0V100" stroke="${OL}" stroke-width="2.4" stroke-opacity="0.35"/></pattern>`);
      let s = `<g transform="translate(0 10)"><path d="${dW}" fill="${h.shade(P.stoneD, -0.1)}" ${SO(3.5)}/><path d="${dW}" fill="${faceTex}"/></g>`;
      s += `<g transform="translate(0 -5)"><path d="${dW}" fill="${topCol}" ${SO(3.5)}/><path d="${dW}" fill="${wTex}"/></g>`;
      // 윗면 가장자리 빛
      s += `<g transform="translate(0 -5)"><path d="${blobPath(wallCells, inW, 21, 9)}" fill="none" stroke="${region === 2 ? '#ffffff' : P.stoneL}" stroke-width="3" stroke-opacity="0.55"/></g>`;
      const bk = Buckets();
      for (const [c, r] of wallCells) {
        const x = c * 100 + 30 + rnd(c, r, 131) * 40;
        const y = r * 100 + 30 + rnd(c, r, 132) * 30;
        const v = rnd(c, r, 133);
        if (region === 1 && v < 0.45) {
          bk.add(fillA(h.shade(P.accent, -0.15), 0.9), circ(x - 6, y + 1, 5) + circ(x + 1, y - 2, 6) + circ(x + 8, y + 1, 4.5));
          bk.add(fillA(h.shade(P.accent, 0.25), 0.9), circ(x - 1, y - 4, 3));
        }
        else if (region === 2 && v < 0.5) bk.add(fillA('#ffffff'), ell(x, y, 12, 5));
        else if (region === 5 && v < 0.35) bk.add(strokeA(P.accent, 2.6, 0.9), `M${f(x - 6)} ${f(y - 6)}l5 6l-3 6`);
      }
      s += bk.out();
      body.push(s);
    }

    /* ---- 11. 물체 (위→아래 순서로 겹치게) ---- */
    const tSyms = treeSyms(region, P, def);
    const rSyms = rockSyms(region, P, def);
    const pSyms = pillarSyms(region, P, def);
    const symIds = (arr) => arr.map((s) => { const id = h.uid('tr'); defs.push(`<g id="${id}">${s.g}</g>`); return { ...s, id }; });
    const TR = symIds(tSyms);
    const RK = symIds(rSyms);
    const PI = symIds(pSyms);
    const objs = [];
    const place = (sym, x, y, sc, flip) => objs.push({ y, s: `<use href="#${sym.id}" transform="translate(${f(x)} ${f(y)}) scale(${flip ? -f(sc * 100) / 100 : f(sc * 100) / 100} ${f(sc * 100) / 100})"/>` });
    const nearWater = (c, r) => [[0, -1], [1, 0], [0, 1], [-1, 0]].filter(([dc, dr]) => kAt(c + dc, r + dr) === K.WATER).length;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const k = kAt(c, r);
        const x0 = c * 100;
        const y0 = r * 100;
        const roomUp = r === 0 || isObst(kAt(c, r - 1)) ? 22 : -2; // 위 칸이 장애물이면 위로 넘쳐도 됨
        if (k === K.TREE) {
          const trees = TR.filter((t) => !t.bush && !t.coral);
          const bushes = TR.filter((t) => t.bush);
          const corals = TR.filter((t) => t.coral);
          const v = rnd(c, r, 91);
          const pick = (arr, kk) => arr[Math.floor(rnd(c, r, kk) * arr.length) % arr.length];
          const fit = (sym, by, want) => Math.min(want, (by - y0 + roomUp) / sym.top);
          const flip = rnd(c, r, 92) < 0.5;
          if (region === 4 && corals.length && nearWater(c, r) >= 2) {
            const sym = corals[0];
            const by = y0 + 82;
            place(sym, x0 + 50 + (rnd(c, r, 93) - 0.5) * 16, by, fit(sym, by, 1.05), flip);
          } else if (v < 0.62) {
            const sym = pick(trees, 94);
            const by = y0 + 86 + (rnd(c, r, 95) - 0.5) * 6;
            place(sym, x0 + 50 + (rnd(c, r, 96) - 0.5) * 12, by, fit(sym, by, 0.92 + rnd(c, r, 97) * 0.22), flip);
          } else if (v < 0.86) {
            const a = pick(trees, 98);
            const b = pick(trees, 99);
            const by1 = y0 + 56;
            const by2 = y0 + 90;
            place(a, x0 + 30 + rnd(c, r, 100) * 8, by1, fit(a, by1, 0.74), flip);
            place(b, x0 + 66 + rnd(c, r, 101) * 6, by2, fit(b, by2, 0.8), !flip);
          } else {
            const a = pick(trees, 102);
            const bsh = bushes.length ? bushes[0] : a;
            const by1 = y0 + 74;
            place(a, x0 + 38, by1, fit(a, by1, 0.8), flip);
            place(bsh, x0 + 66, y0 + 92, 0.7, !flip);
          }
        } else if (k === K.ROCK && wallSet.has(r * cols + c)) {
          // 벽 위에 굴러 떨어진 돌 몇 개
          if (rnd(c, r, 118) < 0.3) {
            const sym = RK[Math.floor(rnd(c, r, 119) * RK.length) % RK.length];
            place(sym, x0 + 38 + rnd(c, r, 120) * 24, y0 + 66, 0.5, rnd(c, r, 121) < 0.5);
          }
        } else if (k === K.ROCK) {
          const sym = RK[Math.floor(rnd(c, r, 111) * RK.length) % RK.length];
          const by = y0 + 80 + (rnd(c, r, 112) - 0.5) * 8;
          const sc = Math.min(1.08, 0.88 + rnd(c, r, 113) * 0.22, (by - y0 + roomUp) / sym.top);
          place(sym, x0 + 50 + (rnd(c, r, 114) - 0.5) * 12, by, sc, rnd(c, r, 115) < 0.5);
          if (rnd(c, r, 116) < 0.45) {
            const x = x0 + (rnd(c, r, 117) < 0.5 ? 18 : 82);
            objs.push({ y: y0 + 92, s: `<path d="${ell(x, y0 + 90, 8, 5.5)}" fill="${rockG}" ${SO(2.6)}/>` });
          }
        } else if (k === K.PILLAR) {
          const sym = PI[Math.floor(rnd(c, r, 121) * PI.length) % PI.length];
          const by = y0 + 84;
          const sc = Math.min(1, (by - y0 + roomUp) / sym.top);
          place(sym, x0 + 50 + (rnd(c, r, 122) - 0.5) * 8, by, sc, rnd(c, r, 123) < 0.5);
        }
      }
    }
    objs.sort((a, b) => a.y - b.y);
    body.push(objs.map((o) => o.s).join(''));

    /* ---- 12. 하늘 입구: 엷은 안개 소용돌이 ---- */
    if ((map.airSpawns || []).length) {
      const aG = def('air', (id) => h.rg(id, [[0, '#ffffff', 0.45], [0.6, '#e6e0ff', 0.18], [1, '#e6e0ff', 0]], 0.5, 0.5, 0.5));
      const sp = 'M0 -32A32 32 0 0 1 32 0A24 24 0 0 1 8 24A15 15 0 0 1 -7 9A7 7 0 0 1 0 2';
      for (const a of map.airSpawns) {
        const cx = a.c * 100 + 50;
        const cy = a.r * 100 + 50;
        body.push(`<g transform="translate(${cx} ${cy})"><circle r="46" fill="${aG}"/><path d="${sp}" ${strokeA(P.mist, 9, 0.35)}/><path d="${sp}" ${strokeA('#ffffff', 5, 0.75)}/><path d="${sp}" transform="rotate(180)" ${strokeA('#ffffff', 4, 0.5)}/></g>`);
      }
    }

    /* ---- 13. 가장자리 살짝 어둡게 ---- */
    const vG = def('vig', (id) => h.rg(id, [[0.6, OL, 0], [1, OL, region === 2 ? 0.16 : 0.26]], 0.5, 0.5, 0.75));
    body.push(`<rect width="${W}" height="${H}" fill="${vG}"/>`);

    return h.svg(`0 0 ${W} ${H}`, defs.join(''), body.join(''), `width="${W}" height="${H}"`);
  }

  /* =========================================================
   * 지역 풍경 (400 × 160)
   * ========================================================= */
  function regionBanner(regionId) {
    const id = PAL[regionId] ? regionId : 1;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 160"><rect width="400" height="160" fill="${PAL[id].skyTop}"/></svg>`;
  }

  RG.art.mapBackground = mapBackground;
  RG.art.regionBanner = regionBanner;
})();
