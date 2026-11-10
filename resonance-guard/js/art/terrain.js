'use strict';

/* =========================================================
 * 지형 그림 (SVG 문자열) — 맵 바탕 + 지역 풍경
 * 규격: docs/ARCHITECTURE.md §5, 색: DESIGN.md §14, 칸 종류: DESIGN.md §4.2, 빛: docs/design/animation.md §2.6
 *
 *   RG.art.mapBackground(map)   map = RG.grid.parseMap(def) 결과 → viewBox 0 0 cols*100 rows*100
 *   RG.art.regionBanner(id)     1~5 → viewBox 0 0 400 160 (월드 지도·준비 화면용 풍경)
 *
 * 칸을 이어 붙인 티가 나지 않게 그리는 방법
 *   - 칸 종류마다 "거리장"(칸 덩어리 경계까지의 거리, 5단위 격자)을 만들고, 살짝 흐린 뒤 잡음을 더해
 *     마칭 스퀘어로 등고선을 뽑습니다. 등고선 몇 겹(젖은 흙 → 모래 → 거품 → 얕은 물 → 깊은 물)이 곧 그림입니다.
 *   - 길은 길 칸 중심을 잇는 뼈대까지의 거리로 만들어서 굽이·갈림길이 저절로 둥글게 흐릅니다.
 *   - 장식 위치·흔들림은 (map.id, c, r) 해시로 정합니다(Math.random 없음) → 같은 맵은 늘 같은 그림.
 * 빛은 늘 왼쪽 위
 *   - 솟은 것(건설 판석·절벽·바위·나무)은 왼쪽 위 가장자리가 밝고 오른쪽 아래가 어둡고, 그림자는 오른쪽 아래로.
 *   - 꺼진 것(물·길)은 반대로 왼쪽 위 안쪽에 그늘, 오른쪽 아래 안쪽이 밝음. 높이가 바뀌는 곳에는 접지 그늘.
 * 읽힘 우선(1칸 ≈ 30~40px)
 *     길    = 밝은 흙/모래/눌린 눈/판석 띠, 진한 가장자리와 바퀴 자국
 *     건설지 = 낮은 돌 축대(앞면·그림자) 위에 크기가 제각각인 판석을 깐 하나의 마당, 칸은 옅은 모서리 십자로만 → 탑을 올릴 자리
 *     공터  = 밝고 평평한 빈터(밟힌 풀밭·다진 눈·평평한 모래), 칸 모서리에 아주 옅은 표시만
 *     막힘  = 어두운 땅 위의 물체(나무·바위·기둥·절벽), 물·용암
 *     절벽  = 바위·기둥이 5칸 이상(가장자리는 3칸) 이어지면 돋운 절벽/성벽(앞면·윗면·오른쪽 아래 그림자)
 * 탑·적·울림등·입구 소용돌이는 렌더러가 위에 그립니다. 여기서는 바닥(광장·동굴 입구·다리)만.
 * 같은 맵은 결과를 몇 개 기억해 둡니다(준비 화면·전투 화면이 같은 그림을 다시 만들지 않게).
 * ========================================================= */
(() => {
  // Math를 지역 이름으로 묶어 둠: 해시·잡음이 수백만 번 불리므로 전역 조회를 줄임(Node vm 검사 환경에서 특히 느림)
  const Math = globalThis.Math;
  const h = RG.art._h;
  const OL = h.OL;
  const f = (v) => Math.round(v * 10) / 10;

  /* 칸 종류 (RG.grid.T와 같은 값) */
  const K = { PATH: 1, OPEN: 2, BUILD: 3, WATER: 4, ROCK: 5, TREE: 6, LAVA: 7, PILLAR: 8, SPAWN: 9, AIR: 10, LANTERN: 11 };

  /* ---------------- 지역 색 ---------------- */
  const LAVA = { lava: '#ff8a2a', lavaL: '#ffe28c', lavaD: '#c4401b' };
  const PAL = {
    1: { // 솔빛 들판 — 연두·노랑
      ground: '#6b9b3d', groundL: '#86b44c', groundD: '#55822f', tuft: '#3d6820', tuftL: '#a8d260',
      forest: '#4b7b2c', forestD: '#36601f', rubble: '#8e8c66', litter: '#8a9a45',
      open: '#c8d889', openL: '#dae6a3', openD: '#a2b868', openMark: '#5f7a32',
      plot: '#8a7c52', plotL: '#a69769', plotD: '#5e5333',
      slab: '#c7c1a7', slabL: '#e8e3cd', slabD: '#9b957b', slabSide: '#6a644f', slabLine: '#7a745c', moss: '#7aa140', mossL: '#a9cd62',
      road: '#dab57d', roadL: '#efd7a6', roadD: '#c19762', roadEdge: '#8a6438', roadAO: '#22400e',
      shoreWet: '#4d6a2a', shore: '#c2b07a', foam: '#e8f8fc', waterL: '#6ac0e0', water: '#3e99cf', waterD: '#2b73ad', waterDeep: '#1f5890',
      ...LAVA, crust: '#3e2c26',
      cliffTop: '#9d9b87', cliffTopL: '#c9c7b3', cliffTopD: '#6e6c5b', cliffFace: '#7e7c69', cliffFaceD: '#525043', cliffLine: '#45443a',
      stone: '#a7a69c', stoneL: '#d6d5c9', stoneD: '#6b6a64', accent: '#76a63c',
      plaza: '#ddd3b8', plazaD: '#a19579', wood: '#a8723f', woodD: '#6a4323',
      leaf: '#5ca83a', leafL: '#9cd85e', leafD: '#357026',
      flowers: ['#fff6c8', '#ffd23f', '#ff9db5', '#ffffff'], mist: '#5e5478',
      shadow: '#15300a', shadowOp: 0.34,
      skyTop: '#86cdf2', skyBot: '#fcf2c4',
    },
    2: { // 서리 고개 — 하양·하늘
      ground: '#e6eef7', groundL: '#fbfdff', groundD: '#cbd9e8', tuft: '#a9bfd6', tuftL: '#ffffff',
      forest: '#cbd8e7', forestD: '#b2c3d8', rubble: '#b5c3d3', litter: '#9fb3c9',
      open: '#cfe4f2', openL: '#e3f0f9', openD: '#a7c7de', openMark: '#4f7ca3',
      plot: '#aebccd', plotL: '#c9d5e2', plotD: '#7d8ea6',
      slab: '#9cadc4', slabL: '#c9d6e5', slabD: '#7789a4', slabSide: '#4b5b76', slabLine: '#566887', moss: '#ffffff', mossL: '#ffffff',
      road: '#b9aa98', roadL: '#d8cdbf', roadD: '#a19181', roadEdge: '#6e6056', roadAO: '#7f97b3',
      shoreWet: '#a2b6cc', shore: '#f3f8fd', foam: '#ffffff', waterL: '#5ea6d6', water: '#3a80b8', waterD: '#245a90', waterDeep: '#173f6c',
      ...LAVA, crust: '#323744',
      cliffTop: '#8d9fb8', cliffTopL: '#d9e4ef', cliffTopD: '#6a7d98', cliffFace: '#5d7192', cliffFaceD: '#3d4d6a', cliffLine: '#2f3c55',
      stone: '#8ea1b8', stoneL: '#c9d7e6', stoneD: '#56677e', accent: '#ffffff',
      plaza: '#dce5ef', plazaD: '#8d9fb6', wood: '#7d5a44', woodD: '#4c3427',
      leaf: '#2e6a5c', leafL: '#4f927a', leafD: '#1b463d',
      flowers: ['#ffffff', '#d6f1ff'], mist: '#66658a',
      shadow: '#4f6f99', shadowOp: 0.3,
      skyTop: '#bfe2fa', skyBot: '#f4fbff',
    },
    3: { // 붉은 협곡 — 주황·적갈
      ground: '#9a5232', groundL: '#b06440', groundD: '#7f3f24', tuft: '#6a2f17', tuftL: '#d0925a',
      forest: '#874729', forestD: '#6f3820', rubble: '#a7684a', litter: '#c98b55',
      open: '#e7c083', openL: '#f1d29c', openD: '#c99b5e', openMark: '#7a4524',
      plot: '#8f4f30', plotL: '#a8623e', plotD: '#5e2c16',
      slab: '#d49a6c', slabL: '#f0c094', slabD: '#aa6f45', slabSide: '#6a361b', slabLine: '#82482a', moss: '#ebcb92', mossL: '#f6dfb0',
      road: '#f1ddae', roadL: '#fcf0d2', roadD: '#dcc08c', roadEdge: '#9a6236', roadAO: '#4e220f',
      shoreWet: '#6e3a22', shore: '#d8b682', foam: '#ecfff7', waterL: '#5cc0b8', water: '#36a6a2', waterD: '#1d6a72', waterDeep: '#144e58',
      ...LAVA, crust: '#3a1f1a',
      cliffTop: '#a24e2c', cliffTopL: '#cf7446', cliffTopD: '#6e2d15', cliffFace: '#6c2911', cliffFaceD: '#431505', cliffLine: '#2e0e03', strata: '#b8643c',
      stone: '#bb673c', stoneL: '#e8986a', stoneD: '#7a381e', accent: '#f3b77a',
      plaza: '#ecd4a4', plazaD: '#a8743f', wood: '#8a6040', woodD: '#553620',
      leaf: '#5e9a48', leafL: '#8fc86c', leafD: '#3a682e',
      flowers: ['#ffd36b', '#ff7a4a', '#fff1c0'], mist: '#5a4466',
      shadow: '#3a1206', shadowOp: 0.34,
      skyTop: '#ff9f5c', skyBot: '#ffe0a8',
    },
    4: { // 폭풍 해안 — 청록·남색
      ground: '#3b7571', groundL: '#4d8b80', groundD: '#2d5d5c', tuft: '#204c49', tuftL: '#74b196',
      forest: '#2e605d', forestD: '#224d4c', rubble: '#cdbd92', litter: '#5c8f78',
      open: '#a7d3bc', openL: '#c0e2cd', openD: '#80b39b', openMark: '#2b6556',
      plot: '#6d7c72', plotL: '#87968b', plotD: '#3f4c47',
      slab: '#a5b2ab', slabL: '#cbd6d0', slabD: '#7c8b85', slabSide: '#4a5856', slabLine: '#5c6a66', moss: '#5f9c6a', mossL: '#8ccc8c',
      road: '#dac698', roadL: '#eddcb8', roadD: '#c1aa79', roadEdge: '#7a6848', roadAO: '#12383a',
      shoreWet: '#7b7660', shore: '#ddcc9f', foam: '#f3fcff', waterL: '#3e91b2', water: '#24628f', waterD: '#174b79', waterDeep: '#0f3762',
      ...LAVA, crust: '#22303a',
      cliffTop: '#5b8d6b', cliffTopL: '#86b88e', cliffTopD: '#3d6a52', cliffFace: '#45585f', cliffFaceD: '#26343b', cliffLine: '#1a252b',
      stone: '#56656f', stoneL: '#8d9ea8', stoneD: '#313c45', accent: '#ebe5d2',
      plaza: '#dbd3bb', plazaD: '#8b8b7b', wood: '#9a7448', woodD: '#5c4227',
      leaf: '#4cae62', leafL: '#8edc8a', leafD: '#2a7442',
      flowers: ['#ffd6c9', '#fff2d6', '#ff9a8a'], mist: '#4a5578',
      shadow: '#081e20', shadowOp: 0.38,
      skyTop: '#1d3a58', skyBot: '#4f8c94',
    },
    5: { // 깨진 대종 — 회보라·금
      ground: '#4a4361', groundL: '#5d5577', groundD: '#38324b', tuft: '#2b2640', tuftL: '#8a80a6',
      forest: '#3d3752', forestD: '#2f2a41', rubble: '#867e9f', litter: '#7a7096',
      open: '#958cab', openL: '#a69ebc', openD: '#7a7193', openMark: '#2f2846',
      plot: '#5d5679', plotL: '#726a90', plotD: '#3a3452',
      slab: '#c7c0dc', slabL: '#e6e1f2', slabD: '#9c94b8', slabSide: '#4b4466', slabLine: '#6f6790', moss: '#e8bd4c', mossL: '#f6dc84',
      road: '#d5b56e', roadL: '#edd89e', roadD: '#b9994f', roadEdge: '#6a522c', roadAO: '#1d182b',
      shoreWet: '#3a3450', shore: '#7c7492', foam: '#e8e2ff', waterL: '#6a69a8', water: '#4e4d88', waterD: '#363568', waterDeep: '#25244c',
      ...LAVA, crust: '#2a2234',
      cliffTop: '#6c6587', cliffTopL: '#8f88aa', cliffTopD: '#524b6c', cliffFace: '#4d4766', cliffFaceD: '#2f2a42', cliffLine: '#221e31',
      stone: '#8b85a1', stoneL: '#bcb6cf', stoneD: '#56506b', accent: '#e8bd4c',
      plaza: '#ddd2b2', plazaD: '#9c8a5a', wood: '#8f899b', woodD: '#5b5568',
      leaf: '#e2b84a', leafL: '#f6dc84', leafD: '#a8802a',
      flowers: ['#f2d27a', '#ffffff'], mist: '#241d33',
      shadow: '#0e0a18', shadowOp: 0.4,
      skyTop: '#4e4864', skyBot: '#b4a6c6',
    },
  };
  /* 맵마다 다른 점 (설계서 docs/design/maps.md의 지형 메모) */
  const MAP_STYLE = {
    '1-4': { fireflies: true },         // 반딧불 습지
    '2-3': { ice: true },               // 얼어붙은 호수: 공터 = 얼음판
    '4-3': { coral: true },             // 산호 미궁: 바위 = 산호
  };

  /* ---------------- 결정적 해시 ---------------- */
  function hashStr(s) {
    let x = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) x = Math.imul(x ^ s.charCodeAt(i), 16777619);
    return x >>> 0;
  }
  /** (c, r, k) → [0, 1). 같은 맵 id면 늘 같은 값 (32비트 정수 연산만 → 빠름) */
  function rndFactory(key) {
    const base = hashStr(String(key)) | 0;
    return (c, r, k) => {
      let x = base ^ Math.imul((c + 929) | 0, -1640531535) ^ Math.imul((r + 1987) | 0, -2048144777) ^ Math.imul(((k | 0) + 501) | 0, -1028477379);
      x ^= x >>> 16; x = Math.imul(x, 2146121005);
      x ^= x >>> 15; x = Math.imul(x, -2073254261);
      x ^= x >>> 16;
      return (x >>> 0) / 4294967296;
    };
  }
  /** 값 잡음(부드러운 격자 보간) + 겹잡음. 결과 0~1 */
  function noiseFactory(rnd) {
    const vn = (x, y, k) => {
      const ix = Math.floor(x);
      const iy = Math.floor(y);
      let fx = x - ix;
      let fy = y - iy;
      fx = fx * fx * (3 - 2 * fx);
      fy = fy * fy * (3 - 2 * fy);
      const a = rnd(ix, iy, k);
      const b = rnd(ix + 1, iy, k);
      const c = rnd(ix, iy + 1, k);
      const d = rnd(ix + 1, iy + 1, k);
      return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
    };
    const fbm = (x, y, k, oct = 2) => {
      let s = 0;
      let amp = 0.5;
      let tot = 0;
      let fr = 1;
      for (let o = 0; o < oct; o++) { s += vn(x * fr + o * 7.3, y * fr - o * 3.1, k + o * 17) * amp; tot += amp; amp *= 0.5; fr *= 2.07; }
      return s / tot;
    };
    return { vn, fbm };
  }

  /* =========================================================
   * 격자 장(場) — 5단위 표본. 바깥으로 3칸 여유(등고선이 화면 밖에서 닫히도록)
   * ========================================================= */
  const GS = 5;
  const GP = 3;
  function makeGrid(W, H) {
    const nx = Math.round(W / GS) + 2 * GP + 1;
    const ny = Math.round(H / GS) + 2 * GP + 1;
    const x0 = -GP * GS;
    const y0 = -GP * GS;
    const N = nx * ny;
    const vbuf = new Float32Array(N);
    const edgeS = new Int32Array(4 * N);
    const G = { nx, ny, x0, y0, N };
    G.make = (fn) => {
      const a = new Float32Array(N);
      let k = 0;
      for (let j = 0; j < ny; j++) { const y = y0 + j * GS; for (let i = 0; i < nx; i++) a[k++] = fn(x0 + i * GS, y); }
      return a;
    };
    G.each = (a, fn) => {
      let k = 0;
      for (let j = 0; j < ny; j++) { const y = y0 + j * GS; for (let i = 0; i < nx; i++, k++) a[k] = fn(a[k], x0 + i * GS, y); }
      return a;
    };
    /** 쌍선형 보간 값 */
    G.at = (a, x, y) => {
      let fx = (x - x0) / GS;
      let fy = (y - y0) / GS;
      if (fx < 0) fx = 0; else if (fx > nx - 1.001) fx = nx - 1.001;
      if (fy < 0) fy = 0; else if (fy > ny - 1.001) fy = ny - 1.001;
      const i = fx | 0;
      const j = fy | 0;
      const tx = fx - i;
      const ty = fy - j;
      const k = j * nx + i;
      return (a[k] * (1 - tx) + a[k + 1] * tx) * (1 - ty) + (a[k + nx] * (1 - tx) + a[k + nx + 1] * tx) * ty;
    };
    /** 가우스 흐림 (sig: 단위 길이) */
    G.blur = (a, sig) => {
      const s = sig / GS;
      const R = Math.max(1, Math.ceil(s * 2.5));
      const w = new Float32Array(2 * R + 1);
      let tot = 0;
      for (let k = -R; k <= R; k++) { w[k + R] = Math.exp(-(k * k) / (2 * s * s)); tot += w[k + R]; }
      for (let k = 0; k < w.length; k++) w[k] /= tot;
      const tmp = new Float32Array(N);
      const out = new Float32Array(N);
      for (let j = 0; j < ny; j++) {
        const row = j * nx;
        for (let i = 0; i < nx; i++) {
          let acc = 0;
          for (let k = -R; k <= R; k++) { let ii = i + k; if (ii < 0) ii = 0; else if (ii >= nx) ii = nx - 1; acc += a[row + ii] * w[k + R]; }
          tmp[row + i] = acc;
        }
      }
      for (let j = 0; j < ny; j++) {
        for (let i = 0; i < nx; i++) {
          let acc = 0;
          for (let k = -R; k <= R; k++) { let jj = j + k; if (jj < 0) jj = 0; else if (jj >= ny) jj = ny - 1; acc += tmp[jj * nx + i] * w[k + R]; }
          out[j * nx + i] = acc;
        }
      }
      return out;
    };
    /** 마칭 스퀘어: a > t 인 곳을 둘러싼 닫힌 고리들 [[x,y,x,y,...], ...] (neg면 a < t) */
    G.loops = (a, t, neg = false) => {
      const v = vbuf;
      for (let j = 0; j < ny; j++) {
        for (let i = 0; i < nx; i++) {
          const k = j * nx + i;
          v[k] = (i === 0 || j === 0 || i === nx - 1 || j === ny - 1) ? -1 : (neg ? t - a[k] : a[k] - t);
        }
      }
      edgeS.fill(-1);
      const HE = N;
      const segA = [];
      const segB = [];
      const add = (e1, e2) => {
        const s = segA.length;
        segA.push(e1); segB.push(e2);
        if (edgeS[2 * e1] < 0) edgeS[2 * e1] = s; else edgeS[2 * e1 + 1] = s;
        if (edgeS[2 * e2] < 0) edgeS[2 * e2] = s; else edgeS[2 * e2 + 1] = s;
      };
      for (let j = 0; j < ny - 1; j++) {
        for (let i = 0; i < nx - 1; i++) {
          const k = j * nx + i;
          const cs = (v[k] > 0 ? 8 : 0) | (v[k + 1] > 0 ? 4 : 0) | (v[k + nx + 1] > 0 ? 2 : 0) | (v[k + nx] > 0 ? 1 : 0);
          if (cs === 0 || cs === 15) continue;
          const T = k;
          const B = k + nx;
          const L = HE + k;
          const R = HE + k + 1;
          switch (cs) {
            case 1: case 14: add(L, B); break;
            case 2: case 13: add(B, R); break;
            case 3: case 12: add(L, R); break;
            case 4: case 11: add(T, R); break;
            case 6: case 9: add(T, B); break;
            case 7: case 8: add(L, T); break;
            case 5: if (v[k] + v[k + 1] + v[k + nx] + v[k + nx + 1] > 0) { add(L, T); add(B, R); } else { add(T, R); add(L, B); } break;
            default: if (v[k] + v[k + 1] + v[k + nx] + v[k + nx + 1] > 0) { add(T, R); add(L, B); } else { add(L, T); add(B, R); } break;
          }
        }
      }
      const px = (e) => {
        if (e < HE) {
          const i = e % nx;
          const j = (e / nx) | 0;
          const v0 = v[e];
          return [x0 + (i + v0 / (v0 - v[e + 1])) * GS, y0 + j * GS];
        }
        const k = e - HE;
        const i = k % nx;
        const j = (k / nx) | 0;
        const v0 = v[k];
        return [x0 + i * GS, y0 + (j + v0 / (v0 - v[k + nx])) * GS];
      };
      const used = new Uint8Array(segA.length);
      const out = [];
      for (let s0 = 0; s0 < segA.length; s0++) {
        if (used[s0]) continue;
        const pts = [];
        let s = s0;
        let e = segA[s0];
        for (let guard = 0; guard < 400000; guard++) {
          used[s] = 1;
          const p = px(e);
          pts.push(p[0], p[1]);
          const ne = segA[s] === e ? segB[s] : segA[s];
          const a1 = edgeS[2 * ne];
          const ns = a1 === s ? edgeS[2 * ne + 1] : a1;
          e = ne;
          if (ns < 0 || used[ns]) break;
          s = ns;
        }
        if (pts.length >= 8) out.push(pts);
      }
      return out;
    };
    return G;
  }

  /** 거의 곧은 점은 덜어 내기 (닫힌 고리) */
  function simplify(pts, eps) {
    const n = pts.length / 2;
    if (n < 8) return pts;
    const out = [pts[0], pts[1]];
    let lx = pts[0];
    let ly = pts[1];
    for (let i = 1; i < n; i++) {
      const x = pts[2 * i];
      const y = pts[2 * i + 1];
      const j = (2 * i + 2) % pts.length;
      const dx = pts[j] - lx;
      const dy = pts[j + 1] - ly;
      const L = Math.hypot(dx, dy) || 1;
      if (Math.abs((x - lx) * dy - (y - ly) * dx) / L > eps) { out.push(x, y); lx = x; ly = y; }
    }
    return out;
  }
  /** 고리들 → path d */
  function pathD(ls, eps = 0.3) {
    let d = '';
    for (const L0 of ls) {
      const L = eps > 0 ? simplify(L0, eps) : L0;
      if (L.length < 8) continue;
      d += `M${f(L[0])} ${f(L[1])}`;
      for (let i = 2; i < L.length; i += 2) { const x = f(L[i]); const y = f(L[i + 1]); d += `${x < 0 ? '' : ' '}${x}${y < 0 ? '' : ' '}${y}`; }
      d += 'Z';
    }
    return d;
  }
  /** 칸 집합(set[c,r]=1) 경계까지의 부호 거리: 안 +, 밖 −. 맵 밖은 가장자리 칸을 늘인 것으로 봄 */
  function sdTiles(G, set, cols, rows) {
    const at = (c, r) => set[(r < 0 ? 0 : r >= rows ? rows - 1 : r) * cols + (c < 0 ? 0 : c >= cols ? cols - 1 : c)];
    return G.make((x, y) => {
      const c = Math.floor(x / 100);
      const r = Math.floor(y / 100);
      const ins = at(c, r);
      let best = 1e9;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          if (at(c + dc, r + dr) === ins) continue;
          const bx = (c + dc) * 100;
          const by = (r + dr) * 100;
          const dx = bx > x ? bx - x : (x > bx + 100 ? x - bx - 100 : 0);
          const dy = by > y ? by - y : (y > by + 100 ? y - by - 100 : 0);
          const d = dx * dx + dy * dy;
          if (d < best) best = d;
        }
      }
      const d = best === 1e9 ? 220 : Math.sqrt(best);
      return ins ? d : -d;
    });
  }

  /* ---------------- 작은 모양 도우미 ---------------- */
  const circ = (x, y, r) => `M${f(x - r)} ${f(y)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0Z`;
  const ell = (x, y, rx, ry) => `M${f(x - rx)} ${f(y)}a${f(rx)} ${f(ry)} 0 1 0 ${f(2 * rx)} 0a${f(rx)} ${f(ry)} 0 1 0 ${f(-2 * rx)} 0Z`;
  /** 기울인 타원 (deg: x축 기울기) */
  const ellR = (x, y, rx, ry, deg) => {
    const a = (deg * Math.PI) / 180;
    const ex = Math.cos(a) * rx;
    const ey = Math.sin(a) * rx;
    return `M${f(x - ex)} ${f(y - ey)}a${f(rx)} ${f(ry)} ${f(deg)} 1 0 ${f(2 * ex)} ${f(2 * ey)}a${f(rx)} ${f(ry)} ${f(deg)} 1 0 ${f(-2 * ex)} ${f(-2 * ey)}Z`;
  };
  /** 둥근 모서리 다각형 (정수 좌표 — 수천 개 판석의 글자 수를 줄임) */
  function roundPolyI(pts, rad) {
    const n = pts.length;
    const R = Math.round;
    let d = '';
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i + n - 1) % n];
      const p1 = pts[i];
      const p2 = pts[(i + 1) % n];
      const l1 = Math.hypot(p0[0] - p1[0], p0[1] - p1[1]) || 1;
      const l2 = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) || 1;
      const r1 = Math.min(rad, l1 / 2);
      const r2 = Math.min(rad, l2 / 2);
      d += `${i ? 'L' : 'M'}${R(p1[0] + ((p0[0] - p1[0]) * r1) / l1)} ${R(p1[1] + ((p0[1] - p1[1]) * r1) / l1)}Q${R(p1[0])} ${R(p1[1])} ${R(p1[0] + ((p2[0] - p1[0]) * r2) / l2)} ${R(p1[1] + ((p2[1] - p1[1]) * r2) / l2)}`;
    }
    return `${d}Z`;
  }
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
  const SO = (w = 3.5) => `stroke="${OL}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
  /** 풀포기 (x, y = 밑동, s = 크기) */
  const tuftD = (x, y, s = 1) => `M${f(x - 4 * s)} ${f(y)}q${f(-1 * s)} ${f(-5 * s)} ${f(-4 * s)} ${f(-8 * s)}M${f(x)} ${f(y)}q0 ${f(-7 * s)} ${f(1.5 * s)} ${f(-10 * s)}M${f(x + 3.5 * s)} ${f(y)}q${f(1 * s)} ${f(-4 * s)} ${f(4.5 * s)} ${f(-7 * s)}`;
  const tuftHiD = (x, y, s = 1) => `M${f(x - 5.5 * s)} ${f(y - 4 * s)}q${f(-0.8 * s)} ${f(-2.4 * s)} ${f(-2.5 * s)} ${f(-4 * s)}M${f(x + 0.4 * s)} ${f(y - 5 * s)}q0 ${f(-3 * s)} ${f(1.1 * s)} ${f(-5 * s)}`;

  /* =========================================================
   * 물체 기호 (나무·바위·기둥) — 바닥 중심 (0,0), 위쪽이 음수
   * 형태 그림자: 덩어리마다 오른쪽 아래가 어둡고, 왼쪽 위에 빛
   * ========================================================= */
  /** 동그란 수관(겹친 원): 외곽선 → 어두운 바탕 → 왼쪽 위로 비킨 본색 → 하이라이트 → 잎 무늬 */
  function canopy(blobs, C, ow = 3.5) {
    let s = `<path d="${blobs.map(([x, y, r]) => circ(x, y, r + ow)).join('')}" fill="${OL}"/>`;
    s += `<path d="${blobs.map(([x, y, r]) => circ(x, y, r)).join('')}" fill="${C.d}"/>`;
    s += `<path d="${blobs.map(([x, y, r]) => circ(x - r * 0.13, y - r * 0.16, r * 0.82)).join('')}" fill="${C.m}"/>`;
    s += `<path d="${blobs.filter((b) => b[3]).map(([x, y, r]) => circ(x - r * 0.34, y - r * 0.38, r * 0.4)).join('')}" fill="${C.l}" fill-opacity="0.75"/>`;
    s += `<path d="${blobs.map(([x, y, r]) => `M${f(x + r * 0.05)} ${f(y + r * 0.35)}q${f(r * 0.18)} ${f(-r * 0.16)} ${f(r * 0.36)} 0M${f(x - r * 0.45)} ${f(y + r * 0.05)}q${f(r * 0.16)} ${f(-r * 0.15)} ${f(r * 0.32)} 0`).join('')}" ${strokeA(C.d, 2.2, 0.55)}/>`;
    return s;
  }
  /** 굵은 가지(외곽선 있는 선) */
  function branches(d, col, w) {
    return `<path d="${d}" ${strokeA(OL, w + 7)}/><path d="${d}" ${strokeA(col, w)}/>`;
  }

  /** 지역별 나무 기호들: [{ g: svg, top: 꼭대기 높이(양수), half: 반폭 }] */
  function treeSyms(region, P, def) {
    const leafG = def('leaf', (id) => h.rg(id, [[0, P.leafL], [0.55, P.leaf], [1, P.leafD]], 0.35, 0.3, 0.8));
    const woodG = def('trunk', (id) => h.lg(id, [[0, h.shade(P.wood, 0.25)], [0.45, P.wood], [1, P.woodD]], 'h'));
    const LC = { d: P.leafD, m: P.leaf, l: P.leafL };
    const trunk = (w = 6, ht = 26) => `<path d="M${-w} 2C${-w * 0.7} -8 ${-w * 0.6} ${-ht * 0.6} ${-w * 0.55} ${-ht}H${w * 0.55}C${w * 0.6} ${-ht * 0.6} ${w * 0.7} -8 ${w} 2Z" fill="${woodG}" ${SO(3)}/><path d="M${f(-w * 0.2)} -3V${f(-ht * 0.7)}" ${strokeA(P.woodD, 1.8, 0.5)}/>`;
    const pine = (tiers, wTop, wBot, hTot, snow) => {
      let s = trunk(5, 16);
      const n = tiers;
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1 || 1);
        const yb = -10 - (hTot - 10) * (i / n) * 0.92;
        const yt = yb - ((hTot - 10) / n) * 1.55;
        const w = wBot + (wTop - wBot) * t;
        const tip = i === n - 1 ? yt - 6 : yt;
        s += `<path d="M${-w} ${f(yb)}Q0 ${f(yb + 7)} ${w} ${f(yb)}L3 ${f(tip + 3)}Q0 ${f(tip - 1)} -3 ${f(tip + 3)}Z" fill="${leafG}" ${SO(3.2)}/>`;
        // 오른쪽 절반은 그늘
        s += `<path d="M1 ${f(tip + 4)}L${f(w - 2)} ${f(yb - 1)}Q${f(w * 0.5)} ${f(yb + 4.5)} 1 ${f(yb + 3)}Z" fill="${P.leafD}" fill-opacity="0.45"/>`;
        if (snow) s += `<path d="M${f(-w * 0.55)} ${f(yb - (yb - tip) * 0.42)}Q${f(-w * 0.2)} ${f(yb - (yb - tip) * 0.3)} 0 ${f(yb - (yb - tip) * 0.4)}Q${f(w * 0.3)} ${f(yb - (yb - tip) * 0.28)} ${f(w * 0.55)} ${f(yb - (yb - tip) * 0.44)}L2 ${f(tip + 4)}Q0 ${f(tip + 1)} -2 ${f(tip + 4)}Z" fill="#ffffff" ${SO(2.2)}/><path d="M${f(w * 0.1)} ${f(yb - (yb - tip) * 0.36)}Q${f(w * 0.32)} ${f(yb - (yb - tip) * 0.3)} ${f(w * 0.5)} ${f(yb - (yb - tip) * 0.42)}" ${strokeA('#bcd0e6', 2.2)}/>`;
        else s += `<path d="M${f(-w * 0.55)} ${f(yb - 2)}L-2 ${f(tip + 6)}" ${strokeA(P.leafL, 3.5, 0.7)}/>`;
      }
      return s;
    };
    const out = [];
    if (region === 1) {
      out.push({ g: trunk() + canopy([[-14, -36, 19, 1], [14, -37, 19], [0, -53, 22, 1], [0, -33, 20]], LC), top: 79, half: 37 });
      out.push({ g: trunk(5, 24) + canopy([[-11, -34, 17, 1], [12, -42, 20, 1], [-5, -55, 16, 1], [4, -30, 16]], LC), top: 75, half: 36 });
      out.push({ g: pine(3, 9, 30, 80, false), top: 84, half: 33 });
      out.push({ g: `${canopy([[-16, -14, 14, 1], [14, -14, 14, 1], [0, -22, 16, 1]], LC)}<path d="${circ(-8, -18, 3)}${circ(9, -24, 3)}${circ(16, -12, 3)}" fill="${P.flowers[2]}" ${SO(1.5)}/>`, top: 42, half: 34, bush: 1 });
    } else if (region === 2) {
      out.push({ g: pine(3, 9, 31, 84, true), top: 88, half: 34 });
      out.push({ g: pine(4, 8, 28, 88, true), top: 92, half: 31 });
      out.push({ g: pine(2, 10, 26, 58, true), top: 62, half: 29 });
      out.push({ g: `<path d="M-30 2C-34-10-22-24-6-24C2-34 22-30 26-16C34-12 34 0 28 2Z" fill="#f4f9fe" ${SO(3.2)}/><path d="M6 -27C18-27 26-20 26-14C32-10 33-2 28 1C20 2 10 1 6 -2Z" fill="#c6d6e8"/><path d="M-20-12C-14-18-6-18 0-14" ${strokeA('#ffffff', 3)}/>`, top: 32, half: 34, bush: 1 });
    } else if (region === 3) {
      const cG = def('cactus', (id) => h.lg(id, [[0, P.leafL], [0.45, P.leaf], [1, P.leafD]], 'h'));
      const cactus = (arms) => {
        let s = '';
        const body = 'M-8 2V-54Q-8-64 0-64Q8-64 8-54V2Z';
        const armL = arms[0] ? `M-8 ${-arms[0]}H-18Q-24 ${-arms[0]} -24 ${-arms[0] - 6}V${-arms[0] - 22}Q-24 ${-arms[0] - 28} -19 ${-arms[0] - 28}Q-14 ${-arms[0] - 28} -14 ${-arms[0] - 22}V${-arms[0] - 9}H-8Z` : '';
        const armR = arms[1] ? `M8 ${-arms[1]}H18Q24 ${-arms[1]} 24 ${-arms[1] - 6}V${-arms[1] - 18}Q24 ${-arms[1] - 24} 19 ${-arms[1] - 24}Q14 ${-arms[1] - 24} 14 ${-arms[1] - 18}V${-arms[1] - 9}H8Z` : '';
        s += `<path d="${body}${armL}${armR}" fill="${OL}" stroke="${OL}" stroke-width="7" stroke-linejoin="round"/>`;
        s += `<path d="${body}${armL}${armR}" fill="${cG}"/>`;
        s += `<path d="M-3 -4V-56M3 -4V-58" ${strokeA(P.leafD, 2.2, 0.6)}/><path d="M-4.5 -10V-56" ${strokeA(P.leafL, 2.4, 0.7)}/>`;
        s += `<path d="M-2 -60l-4 -2M2 -40l4 -2M-2 -26l-4 -2M2 -14l4 -2" ${strokeA('#fff1c0', 1.6, 0.8)}/>`;
        s += `<path d="${circ(0, -64, 3.5)}" fill="#ff7a8a" ${SO(1.6)}/>`;
        return s;
      };
      out.push({ g: cactus([22, 32]), top: 70, half: 28 });
      out.push({ g: cactus([30, 0]), top: 70, half: 28 });
      out.push({ g: branches('M0 2L-2-16L-14-30M-2-16L6-34M6-34L14-40M6-34L2-46M-2-16L12-22', P.wood, 4.5) + canopy([[-14, -32, 7, 1], [14, -40, 7, 1], [2, -48, 7, 1]], LC, 3), top: 58, half: 26 });
      out.push({ g: `${canopy([[-13, -12, 12, 1], [12, -12, 12, 1], [0, -18, 13, 1]], { d: '#7a6e38', m: '#9c8f4e', l: '#d8cc80' })}<path d="M-8-22l-6-9M6-26l3-10M0-30v-8" ${strokeA(P.woodD, 2.6)}/>`, top: 40, half: 28, bush: 1 });
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
        let s = `<path d="M-6 2Q${tx * 0.3 - 6} -30 ${tx - 4} ${tyTop}H${tx + 4}Q${tx * 0.3 + 6} -30 6 2Z" fill="${woodG}" ${SO(3)}/>`;
        s += `<path d="M${f(tx * 0.08 - 5)} -12h10M${f(tx * 0.25 - 5)} -26h10M${f(tx * 0.45 - 5)} -40h10M${f(tx * 0.7 - 5)} -52h10" ${strokeA(P.woodD, 2.4, 0.8)}/>`;
        const back = [160, 20, 340].map((a) => fr(a, 34)).join('');
        const front = [200, 235, 270, 305].map((a) => fr(a, 34)).join('');
        s += `<g transform="translate(${tx} ${tyTop})"><path d="${back}" fill="${P.leafD}" ${SO(3)}/><path d="${front}" fill="${leafG}" ${SO(3)}/><path d="${circ(-4, 3, 4)}${circ(4, 4, 4)}" fill="${P.woodD}" ${SO(2)}/></g>`;
        return s;
      };
      out.push({ g: palm(10), top: 88, half: 38 });
      out.push({ g: palm(-9), top: 88, half: 38 });
      const blade = (a, len, w) => {
        const r = (a * Math.PI) / 180;
        const ex = Math.cos(r) * len;
        const ey = Math.sin(r) * len;
        const nx = -Math.sin(r) * w;
        const ny = Math.cos(r) * w;
        return `M${f(nx)} ${f(ny)}Q${f(ex * 0.5 + nx)} ${f(ey * 0.5 + ny)} ${f(ex)} ${f(ey)}Q${f(ex * 0.5 - nx)} ${f(ey * 0.5 - ny)} ${f(-nx)} ${f(-ny)}Z`;
      };
      const agave = [200, 228, 250, 270, 290, 312, 340].map((a, i) => blade(a, i % 2 ? 30 : 38, 6)).join('');
      out.push({ g: `<g transform="translate(0 -2)"><path d="${agave}" fill="${leafG}" ${SO(3)}/><path d="${[228, 270, 312].map((a) => { const r = (a * Math.PI) / 180; return `M0 0L${f(Math.cos(r) * 24)} ${f(Math.sin(r) * 24)}`; }).join('')}" ${strokeA(P.leafL, 2.4, 0.8)}/></g>`, top: 42, half: 38, bush: 1 });
      out.push({ g: coralSyms()[0].g, top: 52, half: 28, coral: 1 });
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

  /** 산호 기호들 (폭풍 해안) */
  function coralSyms() {
    const pink = branches('M0 2V-18M0-18L-14-32V-44M0-18L12-30V-46M-14-32L-22-38M12-30L20-36M0-18V-38', '#ff8a7a', 6) +
      `<path d="M2 -4V-16M2-18L13-29" ${strokeA('#c4504a', 2.4, 0.7)}/>` +
      `<path d="${circ(-14, -45, 3.5)}${circ(12, -47, 3.5)}${circ(0, -40, 3.5)}${circ(-22, -39, 3)}${circ(20, -37, 3)}" fill="#ffd0c4"/>`;
    const brain = `<path d="M-24 2C-28-10-20-24-2-25C16-26 27-14 25 0C14 5-12 5-24 2Z" fill="#f0b45a" ${SO(3.2)}/>` +
      `<path d="M4 -24C16-22 25-12 24 0C14 4 4 4 0 3C10-6 10-16 4-24Z" fill="#c4823a" fill-opacity="0.75"/>` +
      `<path d="M-18-6q6-8 12 0t12 0M-14-14q6-7 12 0t10 0M-10-20q5-4 10 0" ${strokeA('#a0602a', 2.2)}/>` +
      `<path d="M-16-16q4-5 8-6" ${strokeA('#ffe0a0', 2.6, 0.9)}/>`;
    const fan = `<path d="M0 2L-2-8M-2-8C-22-14-26-34-14-46C-4-54 10-52 18-42C28-30 20-12 -2-8Z" fill="#a768c8" ${SO(3.2)}/>` +
      `<path d="M2-10C14-14 24-26 18-42C26-30 22-14 2-10Z" fill="#6e3d8e" fill-opacity="0.7"/>` +
      `<path d="M-2-10L-14-40M-2-10L-2-48M-2-10L10-44M-2-10L18-32M-2-10L-20-24" ${strokeA('#e0b8f0', 1.8, 0.8)}/>`;
    return [{ g: pink, top: 52, half: 26 }, { g: brain, top: 28, half: 28 }, { g: fan, top: 56, half: 28 }];
  }

  /** 지역별 바위 기호들 (오른쪽 아래 면은 어둡게) */
  function rockSyms(region, P, def) {
    const rG = def('rock', (id) => h.rg(id, [[0, P.stoneL], [0.5, P.stone], [1, P.stoneD]], 0.35, 0.25, 0.85));
    const out = [];
    const accentCap = (d) => {
      if (region === 1) return `<path d="${d}" fill="${P.accent}" ${SO(2)}/>`;
      if (region === 2) return `<path d="${d}" fill="#ffffff" ${SO(2)}/>`;
      return '';
    };
    const boulder = (S, extra = '') => `<path d="${S.body}" fill="${rG}" ${SO()}/><path d="${S.facet}" fill="${P.stoneD}" fill-opacity="0.45"/>${accentCap(S.cap)}<path d="${S.crack}" ${strokeA(P.stoneD, 2.6, 0.85)}/><path d="${S.hi}" ${strokeA(P.stoneL, 2.8, 0.75)}/>${extra}`;
    const A = { body: 'M-33 0C-37-10-32-26-18-34C-6-41 14-40 26-30C35-22 37-8 32 0C14 5-16 5-33 0Z', facet: 'M6 1L10-13L4-21L18-36C24-34 30-28 33-22C37-12 36-4 32 0C24 3 14 3 6 1Z', cap: 'M-24-27C-16-35-2-38 10-36C18-34 24-30 26-27C14-22-10-21-24-27Z', crack: 'M6-1L10-13L4-21', hi: 'M-29-12C-28-20-24-26-17-30', top: 40 };
    const B = { body: 'M-31 0C-35-12-27-30-11-32C3-34 13-24 13-12C13-4 9 0 5 2C-7 4-21 3-31 0ZM3 2C1-8 7-20 19-21C29-22 35-12 33-2C29 4 13 5 3 2Z', facet: 'M-14 2L-11-12L-2-30C8-28 13-20 13-12C13-4 9 0 5 2C-3 3-9 3-14 2ZM22 3L24-9L28-19C33-15 35-8 33-2C30 2 26 3 22 3Z', cap: 'M-25-21C-19-29-7-31 3-27C-5-23-15-22-25-21ZM8-14C11-19 19-21 26-18C22-14 14-13 8-14Z', crack: 'M-14-2L-11-12M22-2L24-9', hi: 'M-28-8C-27-16-23-22-17-26M7-8C8-13 11-16 15-18', top: 34 };
    const C = { body: 'M-22 0L-26-20L-16-46L-2-52L14-44L22-22L24 0C8 4-10 4-22 0Z', facet: 'M4-37L14-44L22-22L24 0C16 2 8 2 2 0L6-18Z', cap: 'M-16-46L-2-52L14-44L4-37Z', crack: 'M4-37L6-18L2 0', hi: 'M-22-20L-14-42', top: 54 };
    if (region === 3) {
      // 겹겹이 쌓인 사암
      const slab = (y, w, hh) => `<rect x="${-w}" y="${y - hh}" width="${w * 2}" height="${hh}" rx="7" fill="${rG}" ${SO()}/><path d="M${w * 0.35} ${y - hh + 2}H${w - 4}V${y - 3}H${w * 0.2}Z" fill="${P.stoneD}" fill-opacity="0.35"/><path d="M${-w + 5} ${y - hh + 4}H${w - 6}" ${strokeA(P.accent, 3, 0.8)}/>`;
      out.push({ g: slab(2, 32, 18) + slab(-15, 25, 16) + slab(-30, 16, 14), top: 46 });
      out.push({ g: boulder(A, `<path d="M-30-12C-14-8 14-8 33-12" ${strokeA(P.accent, 3, 0.7)}/>`), top: A.top });
      out.push({ g: boulder(C, `<path d="M-24-14H23M-20-30H18" ${strokeA(P.accent, 3, 0.7)}/>`), top: C.top });
    } else if (region === 5) {
      const bG = def('bronze', (id) => h.rg(id, [[0, '#fbe3a0'], [0.5, '#d29a3a'], [1, '#7c5220']], 0.35, 0.3, 0.85));
      out.push({ g: boulder(A, `<path d="M-18-30L-10-20L-14-10" ${strokeA(P.accent, 2.6, 0.9)}/>`), top: A.top });
      out.push({ g: boulder(C), top: C.top });
      // 깨진 대종 조각(청동)
      out.push({ g: `<path d="M-29 -4C-28-22-18-38 0-46L7-34L-1-29L8-19L0-12L6 -4Z" fill="${bG}" ${SO()}/>` +
        `<path d="M-32 3C-32-2-31-5-29-8H6L10 3Z" fill="#8a5a22" ${SO()}/>` +
        `<path d="M-23-14C-20-25-14-33-5-39M-26-20C-24-24-22-27-20-30" ${strokeA('#fff0c0', 3, 0.65)}/>` +
        `<path d="M12 3L16-9L27-13L33-3L30 3Z" fill="${bG}" ${SO()}/><path d="M14-2H31" ${strokeA('#8a5a22', 3)}/>`, top: 48 });
    } else {
      const ex = region === 4 ? (d) => `<path d="${d}" fill="${P.accent}" ${SO(1.6)}/>` : () => '';
      out.push({ g: boulder(A, ex(circ(-20, -12, 3) + circ(-12, -6, 2.5) + circ(18, -8, 3))), top: A.top });
      out.push({ g: boulder(B, ex(circ(-18, -8, 2.6) + circ(24, -6, 2.6))), top: B.top });
      out.push({ g: boulder(C, ex(circ(-14, -10, 2.6) + circ(10, -6, 2.6))), top: C.top });
    }
    return out;
  }

  /** 무너진 기둥 기호들 */
  function pillarSyms(region, P, def) {
    const sG = def('pillar', (id) => h.lg(id, [[0, P.stone], [0.22, P.stoneL], [0.6, P.stone], [1, P.stoneD]], 'h'));
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
  const bgCache = new Map();
  function mapBackground(map) {
    const mid = String(map.id != null ? map.id : (map.def && map.def.id) || 'map');
    const ckey = `${mid}|${map.cols}x${map.rows}|${Array.prototype.join.call(map.kinds, '')}`;
    if (bgCache.has(ckey)) return bgCache.get(ckey);
    const svg = drawMap(map, mid);
    if (bgCache.size > 6) bgCache.delete(bgCache.keys().next().value);
    bgCache.set(ckey, svg);
    return svg;
  }

  function drawMap(map, mid) {
    const cols = map.cols;
    const rows = map.rows;
    const region = (map.def && PAL[map.def.region]) ? map.def.region : 1;
    const P = PAL[region];
    const ST = MAP_STYLE[mid] || {};
    const W = cols * 100;
    const H = rows * 100;
    const rnd = rndFactory(mid);
    const { vn, fbm } = noiseFactory(rnd);
    const G = makeGrid(W, H);
    const inb = (c, r) => c >= 0 && r >= 0 && c < cols && r < rows;
    const raw = (c, r) => (inb(c, r) ? map.kinds[r * cols + c] : 0);
    const N4 = [[0, -1], [1, 0], [0, 1], [-1, 0]];

    /* ---- 하늘 입구 칸의 바닥: 이웃 장애물 중 가장 많은 것으로 (없으면 맨땅) ---- */
    const kinds = new Uint8Array(cols * rows);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        let k = raw(c, r);
        if (k === K.AIR) {
          const cnt = {};
          for (const [dc, dr] of N4) {
            let n = raw(c + dc, r + dr);
            if (n === K.PILLAR) n = K.ROCK;
            if (n === K.WATER || n === K.LAVA || n === K.ROCK || n === K.TREE) cnt[n] = (cnt[n] || 0) + 1;
          }
          let best = 0;
          let bk = 0;
          for (const n of [K.WATER, K.LAVA, K.ROCK, K.TREE]) if ((cnt[n] || 0) > best) { best = cnt[n]; bk = n; }
          k = bk;
        }
        kinds[r * cols + c] = k;
      }
    }
    const kAt = (c, r) => (inb(c, r) ? kinds[r * cols + c] : -1);
    const isAir = (c, r) => raw(c, r) === K.AIR;
    const isRoad = (k) => k === K.PATH || k === K.SPAWN || k === K.LANTERN;
    const isObst = (k) => k === K.WATER || k === K.ROCK || k === K.TREE || k === K.LAVA || k === K.PILLAR || k === 0 || k === -1;
    const cellsWhere = (pred) => {
      const out = [];
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (pred(kAt(c, r), c, r)) out.push([c, r]);
      return out;
    };
    const setOf = (pred) => {
      const s = new Uint8Array(cols * rows);
      let any = false;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (pred(kAt(c, r), c, r)) { s[r * cols + c] = 1; any = true; }
      return any ? s : null;
    };

    const defs = [];
    const memo = {};
    const def = (key, mk) => {
      if (!memo[key]) { const id = h.uid('tr'); defs.push(mk(id)); memo[key] = `url(#${id})`; }
      return memo[key];
    };
    const clip = (d, tf = '') => { const id = h.uid('tc'); defs.push(`<clipPath id="${id}"><path d="${d}"${tf ? ` transform="${tf}"` : ''} clip-rule="evenodd"/></clipPath>`); return `url(#${id})`; };
    const body = [];
    const P_ = (d, attrs) => (d ? `<path d="${d}" ${attrs}/>` : '');
    const EO = 'fill-rule="evenodd"';
    const fillP = (d, col, op = 1) => P_(d, `${fillA(col, op)} ${EO}`);
    const contour = (a, t, eps = 0.3) => pathD(G.loops(a, t), eps);
    const BIG = `M-60 -60H${W + 60}V${H + 60}H-60Z`;
    /** 잡음 더하기 (거리장 테두리를 들쭉날쭉하게) */
    const addNoise = (a, amp, sc, k, amp2 = amp * 0.4, sc2 = sc / 5) => G.each(a, (v, x, y) => (v < -45 ? v : v + amp * (fbm(x / sc, y / sc, k, 2) * 2 - 1) + amp2 * (vn(x / sc2, y / sc2, k + 9) * 2 - 1)));
    /** 영역 밖은 지움(등고선이 쓸데없이 맵 전체에 생기지 않게): m < lo 인 곳은 등고선 밖 */
    const maskF = (a, m, lo, neg = false) => { const o = new Float32Array(G.N); for (let k = 0; k < G.N; k++) o[k] = m[k] < lo ? (neg ? 9 : -9) : a[k]; return o; };
    /** 부호 거리장 (흐림 + 잡음) */
    const sdField = (set, blurSig, amp, sc, k, amp2, sc2) => addNoise(G.blur(sdTiles(G, set, cols, rows), blurSig), amp, sc, k, amp2, sc2 || sc / 5);
    /** 칸 집합의 이어진 덩어리들 (4방향): [{ cells, n, c0, c1, r0, r1, edge }] */
    const comps = (pred) => {
      const seen = new Uint8Array(cols * rows);
      const out = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (seen[r * cols + c] || !pred(c, r)) continue;
          const cells = [];
          const st = [[c, r]];
          seen[r * cols + c] = 1;
          while (st.length) {
            const [cc, rr] = st.pop();
            cells.push([cc, rr]);
            for (const [dc, dr] of N4) {
              const nc = cc + dc;
              const nr = rr + dr;
              if (!inb(nc, nr) || seen[nr * cols + nc] || !pred(nc, nr)) continue;
              seen[nr * cols + nc] = 1;
              st.push([nc, nr]);
            }
          }
          let c0 = 1e9; let c1 = -1; let r0 = 1e9; let r1 = -1;
          for (const [cc, rr] of cells) { if (cc < c0) c0 = cc; if (cc > c1) c1 = cc; if (rr < r0) r0 = rr; if (rr > r1) r1 = rr; }
          out.push({ cells, n: cells.length, c0, c1, r0, r1, edge: c0 === 0 || r0 === 0 || c1 === cols - 1 || r1 === rows - 1 });
        }
      }
      return out;
    };
    /** 둥근 웅덩이 장(4차): 칸 덩어리의 테두리 상자에 들어맞는 초타원(네모와 원 사이) + 둘레를 따라 출렁이는 반지름.
     *  값 = 테두리까지의 대략 거리(안 +). 맵 가장자리에 붙은 덩어리는 바깥으로 늘여서(물줄기가 맵 밖으로 이어지게).
     *  a[k] = max(a[k], 값)으로 덮어씀. 상자 둘레 90 안쪽만 계산 */
    const blobInto = (a, cp, grow, pw, wob, seed) => {
      let x0 = cp.c0 * 100; let x1 = (cp.c1 + 1) * 100; let y0 = cp.r0 * 100; let y1 = (cp.r1 + 1) * 100;
      if (cp.c0 === 0) x0 -= 160;
      if (cp.c1 === cols - 1) x1 += 160;
      if (cp.r0 === 0) y0 -= 160;
      if (cp.r1 === rows - 1) y1 += 160;
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      const A = (x1 - x0) / 2 + grow;
      const B = (y1 - y0) / 2 + grow;
      const mAB = Math.min(A, B);
      const i0 = Math.max(0, Math.floor((x0 - 90 - G.x0) / GS));
      const i1 = Math.min(G.nx - 1, Math.ceil((x1 + 90 - G.x0) / GS));
      const j0 = Math.max(0, Math.floor((y0 - 90 - G.y0) / GS));
      const j1 = Math.min(G.ny - 1, Math.ceil((y1 + 90 - G.y0) / GS));
      const ph = rnd(cp.c0, cp.r0, seed) * 6.283;
      seed += ((cp.c0 * 7 + cp.r0 * 13) % 41) * 2; // 덩어리마다 다른 굽이
      for (let j = j0; j <= j1; j++) {
        const y = G.y0 + j * GS;
        for (let i = i0; i <= i1; i++) {
          const x = G.x0 + i * GS;
          const dx = x - cx;
          const dy = y - cy;
          const u = Math.abs(dx) / A + 1e-6;
          const v = Math.abs(dy) / B + 1e-6;
          const up = Math.pow(u, pw);
          const vp = Math.pow(v, pw);
          const rho = Math.pow(up + vp, 1 / pw);
          // 둘레 잡음(각도의 함수 → 한 바퀴 돌면 이어짐): 큰 굽이 + 작은 굽이
          const th = Math.atan2(dy / B, dx / A) + ph;
          const ct = Math.cos(th);
          const st = Math.sin(th);
          const nz = (vn(ct * 1.3 + 7, st * 1.3 + 7, seed) * 2 - 1) + 0.45 * (vn(ct * 3.1 + 19, st * 3.1 + 19, seed + 1) * 2 - 1);
          const rr = rho / (1 + wob * nz);
          const gx = Math.pow(rho, 1 - pw) * (up / u) / A;
          const gy = Math.pow(rho, 1 - pw) * (vp / v) / B;
          const g = Math.max(Math.sqrt(gx * gx + gy * gy), 1 / mAB);
          const val0 = (1 - rr) / g;
          const k = j * G.nx + i;
          if (val0 > a[k]) a[k] = val0;
        }
      }
    };

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

    /* ---- 이어진 바위·기둥(5칸 이상, 또는 맵 가장자리에 붙은 3칸 이상) = 돋운 절벽/성벽 ---- */
    const cliffSet = new Uint8Array(cols * rows);
    {
      const isR = (c, r) => { const k = kAt(c, r); return k === K.ROCK || k === K.PILLAR; };
      const seen = new Uint8Array(cols * rows);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (seen[r * cols + c] || !isR(c, r)) continue;
          const group = [];
          const stack = [[c, r]];
          seen[r * cols + c] = 1;
          while (stack.length) {
            const [cc, rr] = stack.pop();
            group.push(rr * cols + cc);
            for (const [dc, dr] of N4) {
              const nc = cc + dc;
              const nr = rr + dr;
              if (!inb(nc, nr) || !isR(nc, nr) || seen[nr * cols + nc]) continue;
              seen[nr * cols + nc] = 1;
              stack.push([nc, nr]);
            }
          }
          const edge = group.some((i) => { const gc = i % cols; const gr = (i / cols) | 0; return gc === 0 || gr === 0 || gc === cols - 1 || gr === rows - 1; });
          if (group.length >= 5 || (edge && group.length >= 3)) group.forEach((i) => { cliffSet[i] = 1; });
        }
      }
    }
    // 절벽에 둘러싸인 나무 칸(걷거나 지을 칸과 닿지 않음)은 절벽 위 나무로
    for (let pass = 0; pass < 2; pass++) {
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (kAt(c, r) !== K.TREE || cliffSet[r * cols + c]) continue;
          const nb = N4.map(([dc, dr]) => [c + dc, r + dr]).filter(([nc, nr]) => inb(nc, nr));
          const touchPlay = nb.some(([nc, nr]) => { const k = kAt(nc, nr); return isRoad(k) || k === K.OPEN || k === K.BUILD; });
          if (!touchPlay && nb.some(([nc, nr]) => cliffSet[nr * cols + nc])) cliffSet[r * cols + c] = 1;
        }
      }
    }
    const inCliff = (c, r) => inb(c, r) && cliffSet[r * cols + c] === 1;

    /* 바닥이 비었는지(풀·장식을 놓아도 되는지) 볼 장들 — 아래에서 채움 */
    const F = {};
    const val = (name, x, y, dflt) => (F[name] ? G.at(F[name], x, y) : dflt);

    /* =====================================================
     * 0. 바탕 땅 + 큰 얼룩 (등고선 띠로 칠한 붓 자국)
     * ===================================================== */
    body.push(`<rect x="-10" y="-10" width="${W + 20}" height="${H + 20}" fill="${P.ground}"/>`);
    {
      const M = G.make((x, y) => fbm(x / 210, y / 210, 5, 3));
      body.push(P_(pathD(G.loops(M, 0.4, true), 0.5), `${fillA(P.groundD, 0.55)} ${EO}`));
      body.push(P_(pathD(G.loops(M, 0.33, true), 0.5), `${fillA(P.groundD, 0.5)} ${EO}`));
      body.push(P_(pathD(G.loops(M, 0.58), 0.5), `${fillA(P.groundL, 0.45)} ${EO}`));
      body.push(P_(pathD(G.loops(M, 0.66), 0.5), `${fillA(P.groundL, 0.4)} ${EO}`));
      const M2 = G.make((x, y) => fbm(x / 55, y / 55, 7, 2));
      body.push(P_(pathD(G.loops(M2, 0.64), 0.4), `${fillA(region === 2 ? '#ffffff' : P.tuftL, region === 2 ? 0.6 : 0.16)} ${EO}`));
      body.push(P_(pathD(G.loops(M2, 0.36, true), 0.4), `${fillA(P.groundD, 0.3)} ${EO}`));
    }

    /* =====================================================
     * 장(場) 만들기
     * ===================================================== */
    const waterSet = setOf((k, c, r) => k === K.WATER || (bridgeAt(c, r) && !bridgeAt(c, r).lava));
    const lavaSet = setOf((k, c, r) => k === K.LAVA || (bridgeAt(c, r) && bridgeAt(c, r).lava));
    const openSet = setOf((k, c, r) => k === K.OPEN || ((k === K.ROCK || k === K.PILLAR || k === K.TREE || k === K.LAVA || k === K.WATER) && !inCliff(c, r) &&
      N4.filter(([dc, dr]) => kAt(c + dc, r + dr) === K.OPEN).length >= 2));
    const buildSet = setOf((k) => k === K.BUILD);
    const treeSet = setOf((k) => k === K.TREE);
    const onOpen = (c, r) => !!(openSet && openSet[r * cols + c]);
    const rubbleSet = setOf((k, c, r) => (k === K.ROCK || k === K.PILLAR) && !inCliff(c, r));
    const anyCliff = cliffSet.some((v) => v);
    /* 작은 물웅덩이(상자에 꽉 찬 4칸 이하·다리 없음, 가장자리는 2칸 이하) = 둥글고 불규칙한 웅덩이(4차).
     * 나머지 물은 거리장. 어느 칸이 물인지는 그대로이고 그림 모양만 바뀜 */
    const rectOk = (cp) => cp.n === (cp.c1 - cp.c0 + 1) * (cp.r1 - cp.r0 + 1);
    const pools = [];
    if (waterSet) {
      const wc = comps((c, r) => waterSet[r * cols + c] === 1);
      const big = new Uint8Array(cols * rows);
      let anyBig = false;
      for (const cp of wc) {
        if (cp.n <= 4 && rectOk(cp) && (!cp.edge || cp.n <= 2) && !cp.cells.some(([c, r]) => bridgeAt(c, r))) pools.push(cp);
        else { for (const [c, r] of cp.cells) big[r * cols + c] = 1; anyBig = true; }
      }
      const A = anyBig ? sdField(big, 13, 15, 72, 401, 4.5, 14) : new Float32Array(G.N).fill(-99);
      for (const cp of pools) blobInto(A, cp, 3, 2.25, 0.11, 4101);
      F.water = pools.length ? addNoise(A, 2.5, 26, 409, 1.8, 8) : A;
    }
    if (lavaSet) F.lava = sdField(lavaSet, 10, 22, 40, 421, 7, 10);
    if (openSet) F.open = sdField(openSet, 8, 10, 60, 441, 3.5, 12);
    /* 건설지 속 작은 구멍(웅덩이·바위·나무 1~4칸, 둘레 절반 이상이 건설지): 축대가 구멍 둘레까지 감싸고
     * 구멍만 둥글게 파임(4차) → 네모난 구멍이 사라짐. 탑을 세울 수 있는 칸은 그대로 */
    if (buildSet) {
      const obst = (c, r) => { const k = kAt(c, r); return (k === K.WATER || k === K.ROCK || k === K.PILLAR || k === K.TREE || k === K.LAVA) && !inCliff(c, r) && !bridgeAt(c, r) && !isAir(c, r); };
      const holes = comps(obst).filter((cp) => {
        if (cp.edge || cp.n > 4 || !rectOk(cp)) return false;
        let nb = 0;
        let nbB = 0;
        for (let c = cp.c0; c <= cp.c1; c++) for (const r of [cp.r0 - 1, cp.r1 + 1]) { nb++; if (kAt(c, r) === K.BUILD) nbB++; }
        for (let r = cp.r0; r <= cp.r1; r++) for (const c of [cp.c0 - 1, cp.c1 + 1]) { nb++; if (kAt(c, r) === K.BUILD) nbB++; }
        return nbB * 2 >= nb;
      });
      const ext = buildSet.slice();
      for (const cp of holes) for (const [c, r] of cp.cells) ext[r * cols + c] = 1;
      F.build = sdField(ext, 8, 12, 45, 461, 4, 10);
      if (holes.length) {
        const HB = new Float32Array(G.N).fill(-99);
        const HW_ = new Float32Array(G.N).fill(-99);
        for (const cp of holes) {
          const wet = cp.cells.some(([c, r]) => kAt(c, r) === K.WATER);
          blobInto(wet ? HW_ : HB, cp, 3, 2.25, 0.11, 4101); // 물이면 웅덩이와 같은 모양
        }
        const B = F.build;
        for (let k = 0; k < G.N; k++) {
          const v = Math.max(HB[k] + 6, HW_[k] + 10); // 구멍 테두리 = 웅덩이 둘레 + 물가 폭
          if (-v < B[k]) B[k] = -v;
        }
      }
    }
    if (treeSet) F.tree = sdField(treeSet, 10, 14, 60, 481, 5, 12);
    if (rubbleSet) F.rubble = sdField(rubbleSet, 10, 11, 35, 501, 4);
    if (anyCliff) F.cliff = sdField(cliffSet, 11, 10, 52, 521, 4.5, 13); // 4차: 더 흐리고 굽이를 키워 계단 같은 테두리를 없앰

    /* ---- 길: 길 칸 중심을 잇는 뼈대까지의 거리 ---- */
    const HW = 33; // 길 반폭
    const roadCells = cellsWhere((k) => isRoad(k));
    if (roadCells.length) {
      const prims = [];
      const bucket = Array.from({ length: cols * rows }, () => []);
      const cl = (v, n) => (v < 0 ? 0 : v >= n ? n - 1 : v);
      const addPrim = (p) => {
        const i = prims.length;
        prims.push(p);
        const ex = p.k === 2 ? 50 : 0;
        const c0 = cl(Math.floor((Math.min(p.ax, p.bx) - ex - 75) / 100), cols);
        const c1 = cl(Math.floor((Math.max(p.ax, p.bx) + ex + 75) / 100), cols);
        const r0 = cl(Math.floor((Math.min(p.ay, p.by) - ex - 75) / 100), rows);
        const r1 = cl(Math.floor((Math.max(p.ay, p.by) + ex + 75) / 100), rows);
        for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) bucket[r * cols + c].push(i);
      };
      for (const [c, r] of roadCells) {
        const cx = c * 100 + 50;
        const cy = r * 100 + 50;
        // 길과 이어지지 않은 울림등(공터 한가운데)은 광장만 그림
        if (kAt(c, r) === K.LANTERN && !N4.some(([dc, dr]) => isRoad(kAt(c + dc, r + dr)))) continue;
        addPrim({ k: 0, ax: cx, ay: cy, bx: cx, by: cy });
        if (isRoad(kAt(c + 1, r))) addPrim({ k: 0, ax: cx, ay: cy, bx: cx + 100, by: cy });
        if (isRoad(kAt(c, r + 1))) addPrim({ k: 0, ax: cx, ay: cy, bx: cx, by: cy + 100 });
        // 공터로 들어가는 길 끝만 벌어지게(공터 옆을 나란히 지나는 길은 그대로 → 가장자리에 톱니가 생기지 않음)
        const nRoad = N4.filter(([dc, dr]) => isRoad(kAt(c + dc, r + dr))).length;
        for (const [dc, dr] of N4) if (kAt(c + dc, r + dr) === K.OPEN && (nRoad <= 1 || isRoad(kAt(c - dc, r - dr)))) addPrim({ k: 1, ax: cx, ay: cy, bx: cx + dc * 58, by: cy + dr * 58 });
        if (kAt(c, r) === K.SPAWN) {
          if (c === 0) addPrim({ k: 0, ax: cx, ay: cy, bx: cx - 120, by: cy });
          else if (c === cols - 1) addPrim({ k: 0, ax: cx, ay: cy, bx: cx + 120, by: cy });
          else if (r === 0) addPrim({ k: 0, ax: cx, ay: cy, bx: cx, by: cy - 120 });
          else if (r === rows - 1) addPrim({ k: 0, ax: cx, ay: cy, bx: cx, by: cy + 120 });
        }
        if (isRoad(kAt(c + 1, r)) && isRoad(kAt(c, r + 1)) && isRoad(kAt(c + 1, r + 1))) addPrim({ k: 2, ax: cx + 50, ay: cy + 50, bx: cx + 50, by: cy + 50 });
      }
      const rf = new Float32Array(G.N);
      const dm = new Float32Array(G.N);
      let kk = 0;
      for (let j = 0; j < G.ny; j++) {
        const y = G.y0 + j * GS;
        for (let i = 0; i < G.nx; i++, kk++) {
          const x = G.x0 + i * GS;
          const list = bucket[cl(Math.floor(y / 100), rows) * cols + cl(Math.floor(x / 100), cols)];
          let best = -90;
          let dmin = 999;
          for (let q = 0; q < list.length; q++) {
            const p = prims[list[q]];
            let v;
            let d;
            if (p.k === 2) {
              const dx = Math.max(0, Math.abs(x - p.ax) - 50);
              const dy = Math.max(0, Math.abs(y - p.ay) - 50);
              d = Math.sqrt(dx * dx + dy * dy);
              v = HW - d;
            } else {
              const vx = p.bx - p.ax;
              const vy = p.by - p.ay;
              const L2 = vx * vx + vy * vy;
              let t = L2 ? ((x - p.ax) * vx + (y - p.ay) * vy) / L2 : 0;
              if (p.k === 1 && t > 1) continue;
              const tc = t < 0 ? 0 : t > 1 ? 1 : t;
              const qx = p.ax + vx * tc - x;
              const qy = p.ay + vy * tc - y;
              d = Math.sqrt(qx * qx + qy * qy);
              v = HW - d;
              if (p.k === 1 && t > 0) {
                // 공터로 들어가는 길: 끝이 벌어지며 흐려짐
                v += 13 * t * t - Math.max(0, t - 0.62) * 70 * (0.25 + vn(x / 9, y / 9, 77));
              }
            }
            if (v > best) best = v;
            if (d < dmin) dmin = d;
          }
          rf[kk] = best < -40 ? best : best + 9 * (fbm(x / 48, y / 48, 31, 2) * 2 - 1) + 3 * (vn(x / 9, y / 9, 37) * 2 - 1);
          dm[kk] = dmin;
        }
      }
      F.road = rf;
      F.roadD = dm;
    }
    /** 맨땅인가 (풀·장식 자리) */
    const wild = (x, y, m = 0) => val('road', x, y, -99) < -11 - m && val('water', x, y, -99) < -12 - m && val('lava', x, y, -99) < -14 - m &&
      val('open', x, y, -99) < -6 - m && val('build', x, y, -99) < -5 - m && val('cliff', x, y, -99) < -3 - m;

    /* =====================================================
     * 1. 맨땅 장식 (풀포기·꽃·돌멩이·눈더미…)
     * ===================================================== */
    {
      const bk = Buckets();
      const GD = 21;
      for (let gy = 0; gy * GD < H + GD; gy++) {
        for (let gx = 0; gx * GD < W + GD; gx++) {
          const x = (gx + rnd(gx, gy, 601)) * GD;
          const y = (gy + rnd(gx, gy, 602)) * GD;
          if (!wild(x, y)) continue;
          const inTree = val('tree', x, y, -99) > -4;
          const inRub = val('rubble', x, y, -99) > -8;
          const v = rnd(gx, gy, 603);
          const s = 0.8 + rnd(gx, gy, 604) * 0.5;
          groundDeco(bk, region, P, x, y, v, s, inTree, inRub, rnd(gx, gy, 605));
        }
      }
      body.push(bk.out());
    }

    /* =====================================================
     * 2. 숲 바닥 · 자갈 바닥
     * ===================================================== */
    if (F.tree) {
      body.push(fillP(contour(F.tree, -7), P.forest, 0.8));
      body.push(fillP(contour(F.tree, 14), P.forestD, 0.7));
      const bk = Buckets();
      for (const [c, r] of cellsWhere((k) => k === K.TREE)) {
        for (let i = 0; i < 5; i++) {
          const x = c * 100 + rnd(c, r, 611 + i) * 100;
          const y = r * 100 + rnd(c, r, 621 + i) * 100;
          if (region === 2) bk.add(fillA('#ffffff', 0.85), ell(x, y, 7, 3));
          else bk.add(fillA(P.litter, 0.6), ellR(x, y, 3.4, 1.8, rnd(c, r, 631 + i) * 180));
        }
      }
      body.push(bk.out());
    }
    if (F.rubble) {
      const rub = ST.coral ? '#d8c99c' : P.rubble;
      if (!ST.coral) body.push(fillP(contour(F.rubble, 2), rub, 0.3));
      body.push(fillP(contour(F.rubble, 12), rub, ST.coral ? 0.25 : 0.5));
      const bk = Buckets();
      for (const [c, r] of cellsWhere((k, cc, rr) => (k === K.ROCK || k === K.PILLAR) && !inCliff(cc, rr))) {
        for (let i = 0; i < 6; i++) {
          const a = rnd(c, r, 641 + i) * Math.PI * 2;
          const rr0 = 28 + rnd(c, r, 651 + i) * 22;
          const x = c * 100 + 50 + Math.cos(a) * rr0;
          const y = r * 100 + 60 + Math.sin(a) * rr0 * 0.8;
          pebble(bk, P, x, y, 2.2 + rnd(c, r, 661 + i) * 2.4);
        }
      }
      body.push(bk.out());
    }

    /* =====================================================
     * 3. 공터: 밟혀 평평해진 빈터 (걸을 수도, 지을 수도 있음)
     * ===================================================== */
    if (F.open) {
      const ice = !!ST.ice;
      const oCol = ice ? '#c7e3f3' : P.open;
      const oL = ice ? '#e4f3fb' : P.openL;
      const oD = ice ? '#9cc6e0' : P.openD;
      body.push(fillP(contour(F.open, -8), oD, 0.32));
      const dO = contour(F.open, 0);
      body.push(fillP(dO, oCol));
      let s = '';
      const M0 = G.make((x, y) => fbm(x / 95, y / 95, 711, 3));
      s += fillP(pathD(G.loops(maskF(M0, F.open, -4), 0.57), 0.5), oL, 0.6);
      s += fillP(pathD(G.loops(maskF(M0, F.open, -4, true), 0.4, true), 0.5), oD, 0.28);
      s += fillP(pathD(G.loops(maskF(M0, F.open, -4, true), 0.33, true), 0.5), oD, 0.25);
      const M1 = maskF(G.make((x, y) => fbm(x / 28, y / 28, 731, 2)), F.open, -4);
      s += fillP(pathD(G.loops(M1, 0.67), 0.4), oD, 0.2);
      const bk = Buckets();
      const openCells = cellsWhere((k) => k === K.OPEN);
      for (const [c, r] of openCells) {
        const n = 3 + Math.floor(rnd(c, r, 721) * 4);
        for (let i = 0; i < n; i++) {
          const x = c * 100 + 8 + rnd(c, r, 722 + i) * 84;
          const y = r * 100 + 8 + rnd(c, r, 732 + i) * 84;
          const v = rnd(c, r, 742 + i);
          openDeco(bk, region, P, x, y, v, ice, oD, oL);
        }
        if (ice) {
          // 얼음 금: 칸을 넘어 이어지게 칸 모서리 근처에서 시작
          if (rnd(c, r, 751) < 0.55) {
            let x = c * 100 + rnd(c, r, 752) * 100;
            let y = r * 100 + rnd(c, r, 753) * 100;
            let a = rnd(c, r, 754) * Math.PI * 2;
            let d = `M${f(x)} ${f(y)}`;
            for (let i = 0; i < 4; i++) { a += (rnd(c, r, 755 + i) - 0.5) * 1.6; x += Math.cos(a) * 16; y += Math.sin(a) * 16; d += `L${f(x)} ${f(y)}`; }
            bk.add(strokeA('#ffffff', 2.2, 0.85), d);
            bk.add(strokeA('#8fb9d6', 1.6, 0.6), d.replace(/(-?[\d.]+) (-?[\d.]+)/g, (m, a1, b1) => `${f(+a1 + 1.6)} ${f(+b1 + 1.6)}`));
          }
        }
      }
      s += bk.out();
      body.push(`<g clip-path="${clip(dO)}">${s}</g>`);
      // 아주 옅은 칸 표시: 공터 네 칸이 만나는 모서리에 작은 십자
      let cross = '';
      for (const [c, r] of openCells) {
        if (kAt(c + 1, r) === K.OPEN && kAt(c, r + 1) === K.OPEN && kAt(c + 1, r + 1) === K.OPEN) {
          const x = c * 100 + 100;
          const y = r * 100 + 100;
          cross += `M${x - 6} ${y}h12M${x} ${y - 6}v12`;
        }
      }
      body.push(P_(cross, strokeA(ice ? '#5f8fb5' : P.openMark, 3, 0.3)));
    }

    /* =====================================================
     * 4. 물: 젖은 흙 → 물가 → 거품 → 얕은 물 → 깊은 물
     * ===================================================== */
    if (F.water) {
      const A = F.water;
      body.push(fillP(contour(A, -11), P.shoreWet, 0.45));
      body.push(fillP(contour(A, -5.5), P.shore));
      body.push(fillP(contour(A, -2.5), h.mix(P.shore, P.shoreWet, 0.45)));
      body.push(fillP(contour(A, -0.5), P.foam, 0.9));
      const dW = contour(A, 2);
      const wG = def('water', (id) => `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${f(W * 0.35)}" y2="${H}"><stop offset="0" stop-color="${h.shade(P.waterL, 0.06)}"/><stop offset="1" stop-color="${h.shade(P.waterL, -0.1)}"/></linearGradient>`);
      body.push(fillP(dW, wG));
      let s = '';
      s += fillP(contour(A, 11), P.water, 0.9);
      s += fillP(contour(A, 26), P.waterD, 0.85);
      s += fillP(contour(A, 46), P.waterDeep, 0.7);
      // 물가 안쪽 그늘(왼쪽 위 둑이 가림) + 오른쪽 아래 둑의 밝은 반사
      s += `<path d="${BIG}${dW}" ${EO} fill="#06142a" fill-opacity="0.26" transform="translate(7 9)"/>`;
      s += `<path d="${BIG}${dW}" ${EO} fill="#ffffff" fill-opacity="0.12" transform="translate(-4 -5)"/>`;
      // 물가를 따라 도는 잔물결(거품 줄)
      s += P_(contour(A, 6.5), `${strokeA(P.foam, 2.4, 0.65)} stroke-dasharray="15 7 5 10"`);
      s += P_(contour(A, 15), `${strokeA(h.shade(P.waterL, 0.3), 2, 0.45)} stroke-dasharray="7 18"`);
      if (region === 4) {
        s += P_(contour(A, 30), `${strokeA('#ffffff', 2.6, 0.35)} stroke-dasharray="22 14 8 20"`);
        s += P_(contour(A, 52), `${strokeA('#ffffff', 2.4, 0.25)} stroke-dasharray="16 26"`);
      }
      const bk = Buckets();
      const bk2 = Buckets();
      for (const [c, r] of cellsWhere((k, cc, rr) => k === K.WATER || (bridgeAt(cc, rr) && !bridgeAt(cc, rr).lava))) {
        if (bridgeAt(c, r)) continue;
        const n = 2 + Math.floor(rnd(c, r, 801) * 2);
        for (let i = 0; i < n; i++) {
          const x = c * 100 + 14 + rnd(c, r, 802 + i) * 72;
          const y = r * 100 + 14 + rnd(c, r, 812 + i) * 72;
          const dep = G.at(A, x, y);
          if (dep < 14) continue;
          const w = 7 + rnd(c, r, 822 + i) * 7;
          bk.add(strokeA(h.shade(P.waterL, 0.35), 2.4, 0.6), `M${f(x - w)} ${f(y)}q${f(w / 2)} -4 ${f(w)} 0q${f(w / 2)} 4 ${f(w)} 0`);
        }
        if (rnd(c, r, 831) < 0.5) bk.add(fillA('#ffffff', 0.8), ellR(c * 100 + 20 + rnd(c, r, 832) * 60, r * 100 + 20 + rnd(c, r, 833) * 60, 4.5, 1.6, -12));
        // 지역 장식
        const v = rnd(c, r, 841);
        const x = c * 100 + 20 + rnd(c, r, 842) * 60;
        const y = r * 100 + 20 + rnd(c, r, 843) * 60;
        const dep = G.at(A, x, y);
        if (region === 1 && v < 0.42 && dep > 8 && dep < 40) {
          // 수련 잎(왼쪽 위 밝게, 아래로 작은 그림자)
          bk2.add(fillA('#0b2a44', 0.3), ell(x + 2, y + 3, 10, 7));
          bk2.add(`fill="#5aa64a" ${SO(2.2)}`, `M${f(x)} ${f(y)}l9 -3a10 7.5 0 1 0 0 6Z`);
          bk2.add(strokeA('#9cd46a', 2, 0.8), `M${f(x - 7)} ${f(y - 2)}q2 -4 6 -5`);
          if (v < 0.14) bk2.add(`fill="#ffc6d8" ${SO(1.6)}`, circ(x - 3, y - 1, 3.4));
        } else if (region === 2 && v < 0.5 && dep > 10) {
          // 얼음 조각
          bk2.add(fillA('#0b2a44', 0.25), `M${f(x - 10)} ${f(y + 4)}l5 -7h13l6 6l-5 6h-14Z`);
          bk2.add(`fill="#f2fbff" ${SO(2.2)}`, `M${f(x - 13)} ${f(y)}l5 -7h13l6 6l-5 6h-14Z`);
          bk2.add(fillA('#bcd6ea', 0.9), `M${f(x + 5)} ${f(y + 5)}l5 -6l1 1l-5 6Z`);
        } else if (region === 4 && v < 0.35 && dep > 16) {
          bk2.add(strokeA('#ffffff', 3, 0.75), `M${f(x - 12)} ${f(y)}q6 -7 12 0q6 7 12 0`);
        } else if (region === 5 && v < 0.35) {
          bk2.add(fillA(P.accent, 0.8), `M${f(x)} ${f(y - 5)}l2 4l4 1l-4 1l-2 4l-2 -4l-4 -1l4 -1Z`);
        }
      }
      s += bk.out() + bk2.out();
      body.push(`<g clip-path="${clip(dW)}">${s}</g>`);
      // 물가 갈대 (들판·해안)
      if (region === 1 || region === 4 || region === 3) {
        const bk3 = Buckets();
        const ls = G.loops(A, -1);
        let q = 0;
        for (const L of ls) {
          for (let i = 0; i < L.length; i += 6) {
            q++;
            const x = L[i];
            const y = L[i + 1];
            if (x < 0 || y < 0 || x > W || y > H) continue;
            if (rnd(q, 3, 861) > 0.22) continue;
            if (val('road', x, y, -99) > -14 || val('build', x, y, -99) > -6 || val('open', x, y, -99) > -4) continue;
            reeds(bk3, region, P, x, y + 2, rnd(q, 4, 862));
          }
        }
        body.push(bk3.out());
      }
    }

    /* =====================================================
     * 5. 용암: 그을린 땅 → 식은 딱지 테두리 → 빛나는 가장자리 → 녹은 몸통 + 떠다니는 딱지
     * ===================================================== */
    if (F.lava) {
      const A = F.lava;
      const blurF = def('lblur', (id) => h.blur(id, 10));
      const crustC = h.mix(P.crust, P.lavaD, 0.22);
      body.push(fillP(contour(A, -16), P.crust, 0.35));
      body.push(fillP(contour(A, -8), P.lava, 0.55).replace('/>', ` filter="${blurF}"/>`));
      body.push(fillP(contour(A, -3.5), P.crust));
      body.push(P_(contour(A, -3.5), `fill="none" stroke="${h.shade(P.crust, 0.35)}" stroke-width="3" stroke-opacity="0.75" transform="translate(-1.5 -2)"`));
      // 식은 테두리에서 바깥 바위로 뻗은 금 — 드물게, 꺾이고 갈라지게(안쪽 끝은 아직 빨갛게)
      {
        let ck = '';
        let hot = '';
        let q = 0;
        const walk = (x, y, n, seed, branch) => {
          let d = `M${f(x)} ${f(y)}`;
          for (let k = 0; k < n; k++) {
            const gx = G.at(A, x + 3, y) - G.at(A, x - 3, y);
            const gy = G.at(A, x, y + 3) - G.at(A, x, y - 3);
            const gl = Math.hypot(gx, gy) || 1;
            const step = 4 + rnd(seed, k, 1603) * 5;
            const jx = (rnd(seed, k, 1604) - 0.5) * 14;
            x += (-gx / gl) * step + (gy / gl) * jx;
            y += (-gy / gl) * step - (gx / gl) * jx;
            d += `L${f(x)} ${f(y)}`;
            if (branch && k === 1 && rnd(seed, 9, 1605) < 0.6) ck += walk(x, y, 2, seed * 7 + 3, false);
          }
          return d;
        };
        for (const L of G.loops(A, -3)) {
          for (let i = 0; i < L.length; i += 2) {
            q++;
            if (rnd(q, 11, 1601) > 0.035) continue;
            const n = 2 + Math.floor(rnd(q, 12, 1602) * 3);
            const d = walk(L[i], L[i + 1], n, q, true);
            ck += d;
            const m = /L(-?[\d.]+) (-?[\d.]+)/.exec(d);
            if (m) hot += `M${f(L[i])} ${f(L[i + 1])}L${m[1]} ${m[2]}`;
          }
        }
        body.push(P_(ck, strokeA(h.mix(P.crust, P.ground, 0.35), 2, 0.75)));
        body.push(P_(hot, strokeA(P.lava, 1.5, 0.85)));
      }
      body.push(fillP(contour(A, 0.5), P.lavaD));
      const d1 = contour(A, 3);
      body.push(fillP(d1, P.lava));
      let s = fillP(contour(A, 12), '#ffa23c', 0.85) + fillP(contour(A, 26), P.lavaL, 0.45);
      // 흐름 줄기
      const FL = G.make((x, y) => fbm(x / 64, y / 24, 1201, 2));
      s += P_(pathD(G.loops(maskF(FL, A, 0), 0.56), 0.4), strokeA(P.lavaL, 2.4, 0.8));
      s += P_(pathD(G.loops(maskF(FL, A, 0), 0.42), 0.4), strokeA('#fff4c0', 1.6, 0.55));
      // 식은 딱지: 둑 가까이 많고, 가운데엔 드문드문 떠다님
      const CR = new Float32Array(G.N);
      for (let k = 0; k < G.N; k++) {
        if (A[k] < 3) { CR[k] = -1; continue; }
        const x = G.x0 + (k % G.nx) * GS;
        const y = G.y0 + Math.floor(k / G.nx) * GS;
        CR[k] = fbm(x / 30, y / 30, 1211, 2) - 0.63 + Math.max(0, 18 - A[k]) / 55;
      }
      const dC = pathD(G.loops(CR, 0), 0.3);
      if (dC) {
        s += P_(dC, `fill="none" stroke="${P.lavaL}" stroke-width="5" stroke-opacity="0.85" ${EO}`);
        s += fillP(dC, crustC);
        const CK = maskF(G.make((x, y) => vn(x / 13, y / 13, 1221)), CR, -0.02);
        let cs = fillP(pathD(G.loops(CK, 0.62), 0.4), h.shade(crustC, 0.18), 0.8);
        cs += P_(pathD(G.loops(CK, 0.5), 0.4), strokeA(P.lava, 1.8, 0.85));
        s += `<g clip-path="${clip(dC)}">${cs}<path d="${BIG}${dC}" ${EO} fill="${P.lavaL}" fill-opacity="0.35" transform="translate(-2.5 -2.5)"/></g>`;
        s += P_(dC, `fill="none" stroke="${h.shade(crustC, 0.4)}" stroke-width="1.6" stroke-opacity="0.6" transform="translate(-1 -1.2)"`);
      }
      // 거품
      const bk = Buckets();
      for (const [c, r] of cellsWhere((k) => k === K.LAVA)) {
        if (rnd(c, r, 871) < 0.6) {
          const x = c * 100 + 25 + rnd(c, r, 872) * 50;
          const y = r * 100 + 25 + rnd(c, r, 873) * 50;
          bk.add(`fill="${P.lavaL}" stroke="${P.lavaD}" stroke-width="1.6"`, circ(x, y, 2.5 + rnd(c, r, 874) * 2));
        }
      }
      s += bk.out();
      body.push(`<g clip-path="${clip(d1)}">${s}</g>`);
    }

    /* =====================================================
     * 7. 길: 풀 그늘 → 진한 가장자리 → 흙 → 닳은 가운데 → 바퀴 자국·돌멩이·발자국
     * ===================================================== */
    if (F.road) {
      const A = F.road;
      body.push(fillP(contour(A, -8), P.roadAO, 0.3));
      body.push(fillP(contour(A, -1.5), P.roadEdge));
      body.push(fillP(contour(A, 1.5), P.roadD));
      const dR = contour(A, 5.5);
      body.push(fillP(dR, P.road));
      let s = '';
      // 닳아 밝은 가운데
      const wear = new Float32Array(G.N);
      for (let k = 0; k < G.N; k++) {
        const x = G.x0 + (k % G.nx) * GS;
        const y = G.y0 + Math.floor(k / G.nx) * GS;
        wear[k] = A[k] < 15 ? A[k] - 15 : Math.min(A[k] - 15, (fbm(x / 34, y / 34, 951, 2) - 0.5) * 90);
      }
      s += fillP(pathD(G.loops(wear, 0), 0.4), P.roadL, 0.55);
      if (region === 5) {
        s += pavingStones(roadCells, P, rnd);
      } else {
        // 바퀴 자국(길 뼈대에서 일정 거리, 군데군데 끊김)
        const dm = F.roadD;
        const rut = new Float32Array(G.N);
        for (let k = 0; k < G.N; k++) {
          const x = G.x0 + (k % G.nx) * GS;
          const y = G.y0 + Math.floor(k / G.nx) * GS;
          rut[k] = A[k] < 8 ? A[k] - 8 : Math.min(2.6 - Math.abs(dm[k] - 13), (vn(x / 42, y / 42, 961) - 0.34) * 22, A[k] - 8);
        }
        const rd = pathD(G.loops(rut, 0), 0.3);
        const rutCol = region === 2 ? '#8f7f70' : P.roadD;
        s += P_(rd, `${fillA(P.roadL, 0.55)} ${EO} transform="translate(1.4 1.8)"`);
        s += P_(rd, `${fillA(rutCol, 0.8)} ${EO}`);
      }
      // 길 안쪽 그늘: 왼쪽 위 둑이 드리움
      s += `<path d="${BIG}${dR}" ${EO} fill="${P.roadEdge}" fill-opacity="0.3" transform="translate(5 6)"/>`;
      const bk = Buckets();
      const GD = 15;
      for (let gy = 0; gy * GD < H; gy++) {
        for (let gx = 0; gx * GD < W; gx++) {
          const x = (gx + rnd(gx, gy, 971)) * GD;
          const y = (gy + rnd(gx, gy, 972)) * GD;
          const a = G.at(A, x, y);
          if (a < 8) continue;
          const v = rnd(gx, gy, 973);
          if (v < 0.075) pebble(bk, { stone: P.roadD, stoneL: P.roadL, stoneD: P.roadEdge }, x, y, 2 + rnd(gx, gy, 974) * 2.6);
          else if (region === 3 && v < 0.12) bk.add(strokeA(P.roadD, 2, 0.8), `M${f(x - 8)} ${f(y)}q4 -3 8 0t8 0`);
          else if (region === 4 && v < 0.1) bk.add(`fill="#fbf2e2" stroke="${P.roadEdge}" stroke-width="1.2" stroke-opacity="0.6"`, `M${f(x - 3.5)} ${f(y + 2)}q3.5 -8 7 0Z`);
          else if (region === 1 && v < 0.095 && a > 18) bk.add(strokeA('#6f9a3a', 2, 0.8), tuftD(x, y, 0.6));
        }
      }
      // 눈길 발자국
      if (region === 2) footprints(bk, roadCells, kAt, isRoad, rnd);
      s += bk.out();
      body.push(`<g clip-path="${clip(dR)}">${s}</g>`);
      // 길가로 비집고 들어온 풀/눈/돌
      const bk2 = Buckets();
      const ls = G.loops(A, -1.5);
      let q = 0;
      for (const L of ls) {
        for (let i = 0; i < L.length; i += 4) {
          q++;
          const x = L[i];
          const y = L[i + 1];
          if (x < -5 || y < -5 || x > W + 5 || y > H + 5) continue;
          if (rnd(q, 1, 981) > 0.5) continue;
          if (val('open', x, y, -99) > -10 || val('water', x, y, -99) > -14 || val('build', x, y, -99) > -4 || val('lava', x, y, -99) > -14) continue;
          edgeDeco(bk2, region, P, x, y, rnd(q, 2, 982));
        }
      }
      body.push(bk2.out());
    }

    /* =====================================================
     * 8. 건설지: 이웃한 건설 칸을 하나로 묶은 낮은 돌 축대, 윗면은 칸과 무관하게 깐 판석 + 옅은 칸 모서리 표시
     * ===================================================== */
    const buildCells = cellsWhere((k) => k === K.BUILD);
    if (F.build) body.push(drawTerrace(F.build, G, buildCells, P, region, rnd, def, clip, kAt, maskF(G.make((x, y) => fbm(x / 38, y / 38, 471, 2)), F.build, -12), val));

    /* =====================================================
     * 9. 다리
     * ===================================================== */
    for (const b of bridges.values()) body.push(drawBridge(b, bridgeAt, P, def));

    /* =====================================================
     * 10. 울림등 광장 (울림등은 렌더러가 그림)
     * ===================================================== */
    if (map.lantern) body.push(drawPlaza(map.lantern.c * 100 + 50, map.lantern.r * 100 + 58, P, def, rnd));

    /* =====================================================
     * 11. 절벽·성벽 (돋운 땅: 그림자 → 앞면 → 윗면 → 윗면 무늬)
     * ===================================================== */
    const HC = 20; // 절벽 높이
    if (F.cliff) body.push(drawCliffs(F.cliff, G, HC, P, region, def, clip, rnd, cellsWhere, inCliff, maskF(G.make((x, y) => fbm(x / 46, y / 46, 1301, 2)), F.cliff, -28)));

    /* =====================================================
     * 12. 물체 그림자 + 물체 (위→아래 순서로 겹치게)
     * ===================================================== */
    const tSyms = treeSyms(region, P, def);
    const rSyms = ST.coral ? coralSyms() : rockSyms(region, P, def);
    const pSyms = pillarSyms(region, P, def);
    const symIds = (arr) => arr.map((s) => { const id = h.uid('tr'); defs.push(`<g id="${id}">${s.g}</g>`); return { ...s, id }; });
    const TR = symIds(tSyms);
    const RK = symIds(rSyms);
    const PI = symIds(pSyms);
    const objs = [];
    let shadowD = '';
    const castShadow = (x, y, ht, half) => {
      // 오른쪽 아래로 드리운 그림자(키에 비례해 길게) + 밑동 그늘
      shadowD += ellR(x + ht * 0.2, y - 1 + ht * 0.03, half * 0.95, half * 0.42, 14);
      shadowD += ell(x + 3, y + 1, half * 0.62, Math.max(4, half * 0.2));
    };
    const place = (sym, x, y, sc, flip) => {
      objs.push({ y, s: `<use href="#${sym.id}" transform="translate(${f(x)} ${f(y)}) scale(${flip ? -f(sc * 100) / 100 : f(sc * 100) / 100} ${f(sc * 100) / 100})"/>` });
      castShadow(x, y, sym.top * sc, (sym.half || 34) * sc);
    };
    const rockG = def('rock', (id) => h.rg(id, [[0, P.stoneL], [0.5, P.stone], [1, P.stoneD]], 0.35, 0.25, 0.85));
    const nearWater = (c, r) => N4.filter(([dc, dr]) => kAt(c + dc, r + dr) === K.WATER).length;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (isAir(c, r)) continue;
        const k = kAt(c, r);
        const x0 = c * 100;
        const y0 = r * 100;
        const up = kAt(c, r - 1);
        const roomUp = r === 0 || (isObst(up) && up !== K.WATER && up !== K.LAVA) ? 22 : (isObst(up) ? 8 : -2);
        if (k === K.TREE) {
          const trees = TR.filter((t) => !t.bush && !t.coral);
          const bushes = TR.filter((t) => t.bush);
          const corals = TR.filter((t) => t.coral);
          const v = rnd(c, r, 91);
          const pick = (arr, kk) => arr[Math.floor(rnd(c, r, kk) * arr.length) % arr.length];
          const lift = inCliff(c, r) ? HC : 0; // 절벽 위 나무는 절벽 높이만큼 올림
          const fit = (sym, by, want) => Math.min(want, (by + lift - y0 + roomUp) / sym.top);
          const plc = (sym, x, by, sc, fl) => place(sym, x, by - lift, sc, fl);
          const flip = rnd(c, r, 92) < 0.5;
          if (region === 4 && corals.length && nearWater(c, r) >= 2) {
            const sym = corals[0];
            const by = y0 + 82;
            plc(sym, x0 + 50 + (rnd(c, r, 93) - 0.5) * 16, by, fit(sym, by, 1.05), flip);
          } else if (v < 0.58) {
            const sym = pick(trees, 94);
            const by = y0 + 86 + (rnd(c, r, 95) - 0.5) * 6;
            const dense = N4.every(([dc, dr]) => isObst(kAt(c + dc, r + dr)));
            plc(sym, x0 + 50 + (rnd(c, r, 96) - 0.5) * 14, by, fit(sym, by, (dense ? 1.04 : 0.94) + rnd(c, r, 97) * 0.2), flip);
          } else if (v < 0.86) {
            const a = pick(trees, 98);
            const b = pick(trees, 99);
            const by1 = y0 + 56;
            const by2 = y0 + 90;
            plc(a, x0 + 30 + rnd(c, r, 100) * 8, by1, fit(a, by1, 0.74), flip);
            plc(b, x0 + 66 + rnd(c, r, 101) * 6, by2, fit(b, by2, 0.8), !flip);
          } else {
            const a = pick(trees, 102);
            const bsh = bushes.length ? bushes[0] : a;
            const by1 = y0 + 74;
            plc(a, x0 + 38, by1, fit(a, by1, 0.8), flip);
            plc(bsh, x0 + 68, y0 + 92, 0.68, !flip);
          }
        } else if ((k === K.ROCK || k === K.PILLAR) && inCliff(c, r)) {
          // 절벽 윗면의 돌덩이 / 무너진 기둥 그루터기
          const topY = y0 + 72 - HC;
          if (k === K.PILLAR && rnd(c, r, 118) < 0.55) {
            const sym = PI[Math.floor(rnd(c, r, 119) * PI.length) % PI.length];
            place(sym, x0 + 50 + (rnd(c, r, 120) - 0.5) * 20, topY, Math.min(0.72, (topY - y0 + 20) / sym.top), rnd(c, r, 121) < 0.5);
          } else if (k === K.ROCK && rnd(c, r, 118) < 0.3 && !ST.coral) {
            const sym = RK[Math.floor(rnd(c, r, 119) * RK.length) % RK.length];
            place(sym, x0 + 34 + rnd(c, r, 120) * 32, topY, 0.48, rnd(c, r, 121) < 0.5);
          }
        } else if (k === K.ROCK) {
          const sym = RK[Math.floor(rnd(c, r, 111) * RK.length) % RK.length];
          const by = y0 + 80 + (rnd(c, r, 112) - 0.5) * 8;
          const sc = Math.min(1.08, 0.88 + rnd(c, r, 113) * 0.22, (by - y0 + roomUp) / sym.top);
          place(sym, x0 + 50 + (rnd(c, r, 114) - 0.5) * 12, by, sc, rnd(c, r, 115) < 0.5);
          if (ST.coral) {
            const s2 = RK[(Math.floor(rnd(c, r, 111) * RK.length) + 1) % RK.length];
            place(s2, x0 + (rnd(c, r, 117) < 0.5 ? 24 : 76), y0 + 92, 0.5, rnd(c, r, 119) < 0.5);
          } else if (rnd(c, r, 116) < 0.45) {
            const x = x0 + (rnd(c, r, 117) < 0.5 ? 18 : 82);
            objs.push({ y: y0 + 92, s: `<path d="${ell(x, y0 + 90, 8, 5.5)}" fill="${rockG}" ${SO(2.6)}/>` });
            shadowD += ell(x + 4, y0 + 92, 9, 4);
          }
        } else if (k === K.PILLAR) {
          const sym = PI[Math.floor(rnd(c, r, 121) * PI.length) % PI.length];
          const by = y0 + 84;
          const sc = Math.min(1, (by - y0 + roomUp) / sym.top);
          place(sym, x0 + 50 + (rnd(c, r, 122) - 0.5) * 8, by, sc, rnd(c, r, 123) < 0.5);
        }
      }
    }
    /* 지상 입구: 맵 가장자리 바위 언덕 + 어두운 동굴 */
    for (const s of map.spawns || []) {
      const o = drawCave(s, cols, rows, kAt, isRoad, P, def, rnd, region);
      objs.push({ y: s.r * 100 + 60, s: o.svg });
      shadowD += o.shadow;
    }
    body.push(`<path d="${shadowD}" fill="${P.shadow}" fill-opacity="${P.shadowOp}"/>`);
    objs.sort((a, b) => a.y - b.y);
    body.push(objs.map((o) => o.s).join(''));

    /* =====================================================
     * 13. 반딧불 (반딧불 습지)
     * ===================================================== */
    if (ST.fireflies && F.water) {
      const gG = def('ffly', (id) => h.rg(id, [[0, '#fff7a8', 0.9], [0.35, '#ffe46a', 0.35], [1, '#ffe46a', 0]], 0.5, 0.5, 0.5));
      let s = '';
      for (let i = 0; i < 26; i++) {
        const x = rnd(i, 1, 991) * W;
        const y = rnd(i, 2, 991) * H;
        const d = val('water', x, y, -99);
        if (d < -30 || d > 30) continue;
        s += `<circle cx="${f(x)}" cy="${f(y)}" r="9" fill="${gG}"/><circle cx="${f(x)}" cy="${f(y)}" r="2" fill="#fffbd0"/>`;
      }
      body.push(s);
    }

    /* =====================================================
     * 14. 하늘 입구: 바닥에 엷은 빛 웅덩이만 (소용돌이는 렌더러)
     * ===================================================== */
    if ((map.airSpawns || []).length) {
      const aG = def('air', (id) => h.rg(id, [[0, '#ffffff', 0.32], [0.6, '#e6e0ff', 0.12], [1, '#e6e0ff', 0]], 0.5, 0.5, 0.5));
      for (const a of map.airSpawns) body.push(`<ellipse cx="${a.c * 100 + 50}" cy="${a.r * 100 + 56}" rx="44" ry="36" fill="${aG}"/>`);
    }

    /* ---- 15. 가장자리 살짝 어둡게 ---- */
    const vG = def('vig', (id) => h.rg(id, [[0.62, OL, 0], [1, OL, region === 2 ? 0.16 : 0.24]], 0.5, 0.5, 0.75));
    body.push(`<rect width="${W}" height="${H}" fill="${vG}"/>`);

    return h.svg(`0 0 ${W} ${H}`, defs.join(''), body.join(''), `width="${W}" height="${H}"`);
  }

  /* =========================================================
   * 부품
   * ========================================================= */
  /** 돌멩이 하나(왼쪽 위 밝게, 아래 그늘) */
  function pebble(bk, P, x, y, r) {
    bk.add(fillA('#000000', 0.18), ell(x + r * 0.35, y + r * 0.45, r * 1.05, r * 0.7));
    bk.add(fillA(P.stone), ell(x, y, r, r * 0.72));
    bk.add(fillA(P.stoneL, 0.85), ell(x - r * 0.3, y - r * 0.25, r * 0.45, r * 0.3));
    bk.add(strokeA(P.stoneD, 1.2, 0.7), `M${f(x - r * 0.6)} ${f(y + r * 0.5)}Q${f(x)} ${f(y + r * 0.95)} ${f(x + r * 0.9)} ${f(y + r * 0.2)}`);
  }

  /** 맨땅 장식 */
  function groundDeco(bk, region, P, x, y, v, s, inTree, inRub, v2) {
    if (inTree) {
      if (region === 1 || region === 4) { if (v < 0.25) { bk.add(strokeA(P.tuft, 2.4, 0.9), tuftD(x, y, s)); } else if (v < 0.3) { bk.add(`fill="#e8d8b0" ${SO(1.4)}`, `M${f(x - 4)} ${f(y)}q4 -9 8 0Z`); bk.add(fillA(region === 1 ? '#d9533f' : '#e89a6a'), `M${f(x - 5)} ${f(y - 3)}q5 -8 10 0Z`); } }
      return;
    }
    if (inRub) { if (v < 0.25) pebble(bk, P, x, y, 2.4 * s); return; }
    if (region === 1) {
      if (v < 0.4) {
        bk.add(strokeA(P.tuft, 2.4, 0.85), tuftD(x, y, s));
        bk.add(strokeA(P.tuftL, 1.8, 0.8), tuftHiD(x, y, s));
      } else if (v < 0.5) {
        const col = P.flowers[Math.floor(v2 * 4) % 4];
        bk.add(fillA(col), circ(x - 3, y, 2.4) + circ(x + 2.5, y - 2, 2.4) + circ(x + 1, y + 2.6, 2.2));
        bk.add(fillA('#e6a21a'), circ(x, y, 1.3));
      } else if (v < 0.56) pebble(bk, P, x, y, 2.4 * s);
      else if (v < 0.62) bk.add(fillA(P.tuftL, 0.35), ell(x, y, 9 * s, 4 * s));
    } else if (region === 2) {
      if (v < 0.32) bk.add(strokeA('#b9cde2', 2.6, 0.75), `M${f(x - 11 * s)} ${f(y)}q${f(11 * s)} ${f(-6 * s)} ${f(22 * s)} 0`);
      else if (v < 0.42) bk.add(fillA('#ffffff'), `M${f(x)} ${f(y - 4)}l1.2 2.8l2.8 1.2l-2.8 1.2l-1.2 2.8l-1.2 -2.8l-2.8 -1.2l2.8 -1.2Z`);
      else if (v < 0.5) bk.add(strokeA('#9c8a66', 1.8, 0.8), `M${f(x - 3)} ${f(y)}l-2 -6M${f(x)} ${f(y)}v-7M${f(x + 3)} ${f(y)}l2 -5`);
      else if (v < 0.55) { pebble(bk, P, x, y, 3 * s); bk.add(fillA('#ffffff'), ell(x - 0.5, y - 2 * s, 3 * s, 1.5 * s)); }
    } else if (region === 3) {
      if (v < 0.25) { pebble(bk, P, x, y, 2 * s); pebble(bk, P, x + 6, y + 3, 1.5 * s); }
      else if (v < 0.4) { bk.add(strokeA(P.tuft, 2.2, 0.8), tuftD(x, y, s * 0.9)); bk.add(strokeA(P.tuftL, 1.6, 0.8), tuftHiD(x, y, s * 0.9)); }
      else if (v < 0.5) bk.add(strokeA(P.groundD, 2, 0.8), `M${f(x - 9)} ${f(y - 2)}l5 3l4 -3l5 4l4 -2`);
      else if (v < 0.56) bk.add(fillA(P.groundL, 0.5), ell(x, y, 8 * s, 3.5 * s));
    } else if (region === 4) {
      if (v < 0.42) {
        bk.add(strokeA(P.tuft, 2.4, 0.85), `M${f(x - 3)} ${f(y)}q-3 -6 -1 -11M${f(x + 1)} ${f(y)}q1 -7 5 -10M${f(x - 1)} ${f(y)}q-1 -5 -5 -7`);
        bk.add(strokeA(P.tuftL, 1.6, 0.7), `M${f(x - 4)} ${f(y - 4)}q-1 -3 0 -6`);
      } else if (v < 0.48) bk.add(`fill="#f3e8d0" stroke="${P.tuft}" stroke-width="1.2"`, `M${f(x - 3.5)} ${f(y + 2)}q3.5 -8 7 0Z`);
      else if (v < 0.54) bk.add(fillA(P.flowers[Math.floor(v2 * 3) % 3]), circ(x - 2, y, 2.2) + circ(x + 2, y - 1, 2.2));
      else if (v < 0.58) pebble(bk, P, x, y, 2.4 * s);
    } else {
      if (v < 0.15) pebble(bk, P, x, y, 2.6 * s);
      else if (v < 0.3) bk.add(`fill="${P.groundL}" stroke="${P.tuft}" stroke-width="1.4"`, `M${f(x - 7 * s)} ${f(y - 2)}l${f(9 * s)} -3l${f(5 * s)} 4l${f(-9 * s)} 3Z`);
      else if (v < 0.48) bk.add(strokeA(P.tuftL, 1.8, 0.7), `M${f(x - 3)} ${f(y)}l-2 -6M${f(x)} ${f(y)}v-7M${f(x + 3)} ${f(y)}l2 -5`);
      else if (v < 0.52) bk.add(fillA(P.accent, 0.85), circ(x, y, 1.6));
    }
  }

  /** 공터 장식 (옅게) */
  function openDeco(bk, region, P, x, y, v, ice, oD, oL) {
    if (ice) {
      if (v < 0.35) bk.add(fillA('#ffffff', 0.75), ellR(x, y, 12, 4, -8));
      else if (v < 0.5) bk.add(strokeA('#ffffff', 2, 0.7), `M${f(x - 8)} ${f(y)}l16 -3`);
      return;
    }
    if (region === 1) {
      if (v < 0.4) bk.add(strokeA(oD, 2, 0.55), tuftD(x, y, 0.6));
      else if (v < 0.5) bk.add(fillA(P.flowers[Math.floor(v * 40) % 4], 0.9), circ(x, y, 1.8));
      else if (v < 0.6) bk.add(fillA(oL, 0.7), ell(x, y, 8, 3));
    } else if (region === 2) {
      if (v < 0.4) bk.add(strokeA('#ffffff', 2.2, 0.75), `M${f(x - 9)} ${f(y)}q9 -4 18 0`);
      else if (v < 0.55) bk.add(fillA('#a9c6dc', 0.5), ellR(x, y, 2.4, 3.6, 10) + ellR(x + 5, y - 9, 2.4, 3.6, 10));
    } else if (region === 3) {
      if (v < 0.3) bk.add(strokeA(oD, 2, 0.5), `M${f(x - 10)} ${f(y)}q5 -3 10 0t10 0`);
      else if (v < 0.44) pebble(bk, { stone: '#c08a5a', stoneL: '#ecc796', stoneD: '#7a4524' }, x, y, 2 + v * 4);
      else if (v < 0.56) bk.add(strokeA('#9a6538', 1.8, 0.6), `M${f(x - 9)} ${f(y - 2)}l5 3l4 -3l5 4l5 -2`);
      else if (v < 0.64) bk.add(fillA('#9a6538', 0.18), ellR(x, y, 11, 6, v * 300));
    } else if (region === 4) {
      if (v < 0.42) bk.add(strokeA(oD, 2, 0.55), `M${f(x - 2)} ${f(y)}q-2 -5 0 -8M${f(x + 2)} ${f(y)}q2 -4 4 -6`);
      else if (v < 0.5) bk.add(fillA('#f3ead6', 0.9), `M${f(x - 3)} ${f(y + 1.5)}q3 -6 6 0Z`);
    } else {
      if (v < 0.35) bk.add(fillA(oD, 0.55), ell(x, y, 2.4, 1.7));
      else if (v < 0.42) bk.add(fillA(P.accent, 0.7), circ(x, y, 1.4));
      else if (v < 0.55) bk.add(strokeA(oD, 1.8, 0.45), `M${f(x - 9)} ${f(y)}l5 -2l4 2l6 -1`);
    }
  }

  /** 물가 갈대·바다풀 */
  function reeds(bk, region, P, x, y, v) {
    if (region === 3) { bk.add(strokeA('#6c8a3a', 2.2), `M${f(x)} ${f(y)}q-1 -6 -3 -9M${f(x + 3)} ${f(y)}q1 -6 3 -8`); return; }
    const dark = region === 1 ? '#3d6a24' : '#1f4d44';
    const lite = region === 1 ? '#8cc456' : '#6aa88c';
    bk.add(strokeA(dark, 2.6), `M${f(x - 3)} ${f(y)}q-2 -8 -5 -13M${f(x)} ${f(y)}q0 -10 2 -16M${f(x + 3)} ${f(y)}q2 -7 6 -11`);
    bk.add(strokeA(lite, 1.6, 0.8), `M${f(x - 4)} ${f(y - 5)}q-1 -3 -3 -6M${f(x)} ${f(y - 6)}q0 -4 1 -7`);
    if (region === 1 && v < 0.45) bk.add(`fill="#7a4a24" ${SO(1.4)}`, ellR(x + 2, y - 17, 2.2, 4.4, 8));
  }

  /** 길가 장식(가장자리를 덮는 풀/눈/돌) */
  function edgeDeco(bk, region, P, x, y, v) {
    if (region === 1 || region === 4) {
      const s = 0.75 + v * 0.45;
      bk.add(strokeA(region === 1 ? '#4a7a28' : P.tuft, 2.3, 0.9), tuftD(x, y + 2, s));
      bk.add(strokeA(region === 1 ? '#9fcb5a' : P.tuftL, 1.6, 0.8), tuftHiD(x, y + 2, s));
    } else if (region === 2) {
      if (v > 0.55) return;
      bk.add(fillA('#ffffff'), ell(x, y, 5 + v * 6, 2.6 + v * 1.5));
      bk.add(fillA('#c3d4e6', 0.8), `M${f(x - 4)} ${f(y + 2.2)}q4 1.6 8 0`);
    } else if (region === 3) {
      if (v < 0.5) bk.add(strokeA('#c79254', 2, 0.9), tuftD(x, y + 2, 0.7));
      else pebble(bk, PAL[3], x, y, 2.4);
    } else if (v < 0.4) {
      pebble(bk, PAL[5], x, y, 2.2 + v * 2.4);
    }
  }

  /** 눈길 발자국 (길 뼈대를 따라 좌우 번갈아) */
  function footprints(bk, roadCells, kAt, isRoad, rnd) {
    for (const [c, r] of roadCells) {
      const cx = c * 100 + 50;
      const cy = r * 100 + 50;
      for (const [dc, dr] of [[1, 0], [0, 1]]) {
        if (!isRoad(kAt(c + dc, r + dr))) continue;
        const deg = dc ? 0 : 90;
        for (let i = 0; i < 6; i++) {
          const t = 8 + i * 16 + (rnd(c, r, 1001 + i) - 0.5) * 3;
          const side = (i % 2 ? 1 : -1) * 5;
          const x = cx + dc * t + dr * side;
          const y = cy + dr * t + dc * side;
          bk.add(fillA('#7f7062', 0.45), ellR(x, y, 3.6, 2.2, deg));
        }
      }
    }
  }

  /** 판석 길 (깨진 대종): 세상 좌표의 엇갈린 돌 줄 → 칸 경계 없이 이어짐 */
  function pavingStones(roadCells, P, rnd) {
    const RH = 24;
    let joints = '';
    let tint = '';
    let tintD = '';
    const done = new Set();
    for (const [c, r] of roadCells) {
      for (let rr = Math.floor((r * 100 - 20) / RH); rr * RH < r * 100 + 120; rr++) {
        const key0 = `${rr}`;
        const y0 = rr * RH;
        const x0 = c * 100 - 20;
        const x1 = c * 100 + 120;
        const off = (rr % 2) * 19;
        for (let k = Math.floor((x0 - off) / 38) - 1; k * 38 + off < x1; k++) {
          const sx = k * 38 + off + (rnd(k, rr, 1011) - 0.5) * 10;
          const ex = (k + 1) * 38 + off + (rnd(k + 1, rr, 1011) - 0.5) * 10;
          const id = `${key0}:${k}`;
          if (done.has(id)) continue;
          done.add(id);
          joints += `M${f(sx)} ${y0}V${y0 + RH}M${f(sx)} ${y0}H${f(ex)}`;
          const v = rnd(k, rr, 1012);
          if (v < 0.25) tint += `M${f(sx + 2)} ${y0 + 2}H${f(ex - 2)}V${y0 + RH - 2}H${f(sx + 2)}Z`;
          else if (v > 0.8) tintD += `M${f(sx + 2)} ${y0 + 2}H${f(ex - 2)}V${y0 + RH - 2}H${f(sx + 2)}Z`;
        }
      }
    }
    return `<path d="${tint}" fill="${P.roadL}" fill-opacity="0.45"/><path d="${tintD}" fill="${P.roadD}" fill-opacity="0.5"/>` +
      `<path d="${joints}" ${strokeA(P.roadL, 1.8, 0.6)} transform="translate(1.5 1.5)"/><path d="${joints}" ${strokeA(P.roadEdge, 2.4, 0.55)}/>`;
  }

  /** 건설지 축대: 이어진 건설 칸 = 하나의 낮은 돌 축대(그림자 → 앞면 → 윗면).
   *  윗면은 크기·모양이 제각각인 판석을 칸 경계와 상관없이 깐 하나의 바닥(보로노이 돌깔기).
   *  칸은 아주 옅은 모서리 십자·가장자리 눈금으로만 표시 → 바둑판처럼 보이지 않지만 탑 자리는 보임 */
  function drawTerrace(A, G, cells, P, region, rnd, def, clip, kAt, CM, val) {
    const EO = 'fill-rule="evenodd"';
    const HT = 6;
    const L0 = 1.5;
    const loops = G.loops(A, L0);
    const base = pathD(loops, 0.3);
    const BIG = `M-60 -60H${G.nx * GS + 60}V${G.ny * GS + 60}H-60Z`;
    let s = '';
    // 그림자(오른쪽 아래) + 접지 그늘
    s += `<path d="${base}" ${EO} fill="${P.shadow}" fill-opacity="${f(P.shadowOp * 0.75)}" transform="translate(7 6)"/>`;
    s += `<path d="${base}" ${EO} fill="${P.shadow}" fill-opacity="${f(P.shadowOp * 0.5)}" transform="translate(2 2.5)"/>`;
    // 앞면
    s += `<path d="${base}" ${EO} fill="${P.slabSide}" stroke="${OL}" stroke-width="2.6" stroke-opacity="0.75"/>`;
    s += `<path d="${base}" ${EO} fill="${h.mix(P.slabSide, P.slabD, 0.45)}" transform="translate(0 ${-HT * 0.5})"/>`;
    // ---- 판석 깔기 (세상 좌표, 칸과 무관한 엇갈린 격자 + 흔들림, 군데군데 돌을 더하거나 빼서 크기가 들쭉날쭉) ----
    const SX = 40;
    const SY = 34;
    let minC = 1e9; let maxC = -1e9; let minR = 1e9; let maxR = -1e9;
    for (const [c, r] of cells) { minC = Math.min(minC, c); maxC = Math.max(maxC, c); minR = Math.min(minR, r); maxR = Math.max(maxR, r); }
    const gx0 = Math.floor((minC * 100 - 80) / SX);
    const gx1 = Math.ceil((maxC * 100 + 180) / SX);
    const gy0 = Math.floor((minR * 100 - 80) / SY);
    const gy1 = Math.ceil((maxR * 100 + 180) / SY);
    const GW = gx1 - gx0 + 1;
    const sites = [];
    const at = [];
    for (let gy = gy0; gy <= gy1; gy++) {
      for (let gx = gx0; gx <= gx1; gx++) {
        const list = [];
        const v = rnd(gx, gy, 1501);
        const bx = gx * SX + (gy & 1 ? SX / 2 : 0);
        const by = gy * SY;
        if (v > 0.1) list.push(sites.push([bx + (rnd(gx, gy, 1502) - 0.5) * SX * 0.7, by + (rnd(gx, gy, 1503) - 0.5) * SY * 0.7, gx, gy, 0]) - 1);
        if (v > 0.8) list.push(sites.push([bx + (rnd(gx, gy, 1504) - 0.5) * SX * 0.8 + SX * 0.3, by + (rnd(gx, gy, 1505) - 0.5) * SY * 0.6 + SY * 0.25, gx, gy, 1]) - 1);
        at[(gy - gy0) * GW + (gx - gx0)] = list;
      }
    }
    const clipHP = (poly, nx, ny, d) => {
      const out = [];
      for (let i = 0; i < poly.length; i++) {
        const p0 = poly[i];
        const p1 = poly[(i + 1) % poly.length];
        const d0 = nx * p0[0] + ny * p0[1] - d;
        const d1 = nx * p1[0] + ny * p1[1] - d;
        if (d0 <= 0) out.push(p0);
        if ((d0 <= 0) !== (d1 <= 0)) { const t = d0 / (d0 - d1); out.push([p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t]); }
      }
      return out;
    };
    const tones = [h.mix(P.slab, P.slabL, 0.45), P.slab, h.mix(P.slab, P.slabD, 0.3), h.mix(P.slab, P.slabD, 0.55)];
    const toneB = tones.map(() => '');
    let lit = '';
    let shd = '';
    const det = Buckets();
    const joints = [];
    for (let i = 0; i < sites.length; i++) {
      const [sx, sy, gx, gy] = sites[i];
      if (G.at(A, sx, sy) < -24) continue;
      let poly = [[sx - SX * 1.5, sy - SY * 1.5], [sx + SX * 1.5, sy - SY * 1.5], [sx + SX * 1.5, sy + SY * 1.5], [sx - SX * 1.5, sy + SY * 1.5]];
      for (let dy = -2; dy <= 2 && poly.length; dy++) {
        for (let dx = -2; dx <= 2 && poly.length; dx++) {
          const yy = gy + dy - gy0;
          const xx = gx + dx - gx0;
          if (yy < 0 || xx < 0 || xx >= GW || yy > gy1 - gy0) continue;
          for (const q of at[yy * GW + xx]) {
            if (q === i) continue;
            const nx = sites[q][0] - sx;
            const ny = sites[q][1] - sy;
            poly = clipHP(poly, nx, ny, nx * (sx + sites[q][0]) / 2 + ny * (sy + sites[q][1]) / 2);
          }
        }
      }
      if (poly.length < 3) continue;
      let cx = 0; let cy = 0;
      for (const [x, y] of poly) { cx += x; cy += y; }
      cx /= poly.length; cy /= poly.length;
      // 줄눈만큼 안쪽으로
      const pts = poly.map(([x, y]) => { const dx = x - cx; const dy = y - cy; const L = Math.hypot(dx, dy) || 1; const k = Math.max(0.2, 1 - 2.3 / L); return [cx + dx * k, cy + dy * k]; });
      for (const p of poly) if (rnd(Math.round(p[0]), Math.round(p[1]), 1510) < 0.04) joints.push(p);
      const tv = Math.floor(rnd(gx * 3 + sites[i][4], gy, 1506) * 4) % 4;
      toneB[tv] += roundPolyI(pts, 4.5);
      // 돌마다 빛: 왼쪽 위를 향한 변은 밝게, 오른쪽 아래를 향한 변은 어둡게
      for (let e = 0; e < pts.length; e++) {
        const p0 = pts[e];
        const p1 = pts[(e + 1) % pts.length];
        const ex = p1[0] - p0[0];
        const ey = p1[1] - p0[1];
        const L = Math.hypot(ex, ey);
        if (L < 6) continue;
        const nx = ey / L;
        const ny = -ex / L;
        const dot = (nx * cx > nx * p0[0] ? -1 : 1) * (-nx - ny) * 0.7071; // 바깥 법선 · 빛 방향
        const ins = (p) => [p[0] + (cx - p[0]) * 0.12, p[1] + (cy - p[1]) * 0.12];
        const a0 = ins([p0[0] + ex * 0.15, p0[1] + ey * 0.15]);
        const a1 = ins([p1[0] - ex * 0.15, p1[1] - ey * 0.15]);
        const seg = `M${Math.round(a0[0])} ${Math.round(a0[1])}L${Math.round(a1[0])} ${Math.round(a1[1])}`;
        if (dot > 0.3) lit += seg; else if (dot < -0.3) shd += seg;
      }
      // 판석 장식: 금·이끼·눈·모래·금빛 맥
      const m = rnd(gx * 3 + sites[i][4], gy, 1507);
      if (m < 0.12) {
        const d = `M${f(cx - 8)} ${f(cy - 4)}l5 4l4 -2l6 5`;
        det.add(strokeA(P.slabLine, 1.6, 0.65), d);
      } else if (m < 0.2) {
        if (region === 1 || region === 4) { det.add(fillA(P.moss, 0.85), circ(cx - 3, cy + 2, 4) + circ(cx + 2, cy + 3, 3)); det.add(fillA(P.mossL, 0.85), circ(cx - 4, cy, 1.6)); }
        else if (region === 2) det.add(fillA('#ffffff', 0.92), ellR(cx - 2, cy - 3, 9, 3.6, -8));
        else if (region === 3) det.add(fillA(P.moss, 0.8), ellR(cx, cy + 2, 10, 4, -12));
        else det.add(strokeA(P.moss, 1.6, 0.8), `M${f(cx - 7)} ${f(cy + 3)}l4 -5l3 3l5 -6`);
      }
    }
    // 윗면 조립
    const up = `translate(0 ${-HT})`;
    const topClip = clip(base, up);
    const jointC = region === 5 ? h.mix(P.moss, P.slabSide, 0.35) : h.mix(P.slabD, P.slabSide, 0.28);
    let t = `<path d="${base}" ${EO} fill="${jointC}" transform="${up}"/>`;
    let pav = '';
    tones.forEach((col, k) => { if (toneB[k]) pav += `<path d="${toneB[k]}" fill="${col}"/>`; });
    pav += `<path d="${lit}" ${strokeA(P.slabL, 2, 0.75)}/><path d="${shd}" ${strokeA(P.slabD, 2, 0.6)}/>`;
    pav += det.out();
    // 큰 얼룩(색 변화 / 눈·모래 쌓임)
    if (region === 2) pav += `<path d="${pathD(G.loops(CM, 0.74), 0.4)}" ${EO} fill="#ffffff" fill-opacity="0.6"/>`;
    else if (region === 3) pav += `<path d="${pathD(G.loops(CM, 0.68), 0.4)}" ${EO} fill="${P.moss}" fill-opacity="0.55"/>`;
    else pav += `<path d="${pathD(G.loops(CM, 0.64), 0.4)}" ${EO} fill="${P.slabL}" fill-opacity="0.25"/>`;
    pav += `<path d="${pathD(G.loops(CM.map((v) => (v === -9 ? 9 : v)), 0.36, true), 0.4)}" ${EO} fill="${P.slabD}" fill-opacity="0.2"/>`;
    // 줄눈 사이 풀/눈
    const jb = Buckets();
    for (const [x, y] of joints) {
      if (region === 1 || region === 4) jb.add(strokeA(region === 1 ? '#5c8a30' : P.tuft, 1.9, 0.9), tuftD(x, y + 2, 0.55));
      else if (region === 2) jb.add(fillA('#ffffff', 0.9), ell(x, y, 4, 2));
    }
    pav += jb.out();
    // 칸 표시: 네 칸이 만나는 모서리엔 작은 십자, 축대 가장자리에 걸친 칸 경계엔 짧은 눈금 (아주 옅게)
    const isB = (c, r) => kAt(c, r) === K.BUILD;
    let tick = '';
    for (const [c, r] of cells) {
      const x = c * 100 + 100;
      const y = r * 100 + 100;
      const R = isB(c + 1, r);
      const D = isB(c, r + 1);
      if (R && D && isB(c + 1, r + 1)) tick += `M${x - 9} ${y}h18M${x} ${y - 9}v18`;
      if (R) {
        if (!(isB(c, r - 1) && isB(c + 1, r - 1))) tick += `M${x} ${y - 100 + 7}v9`;
        if (!(D && isB(c + 1, r + 1))) tick += `M${x} ${y - 7}v-9`;
      }
      if (D) {
        if (!(isB(c - 1, r) && isB(c - 1, r + 1))) tick += `M${x - 100 + 7} ${y}h9`;
        if (!(R && isB(c + 1, r + 1))) tick += `M${x - 7} ${y}h-9`;
      }
    }
    pav += `<path d="${tick}" ${strokeA(P.slabL, 2.2, 0.7)} transform="translate(1.5 1.5)"/><path d="${tick}" ${strokeA(P.slabSide, 3.4, 0.7)}/>`;
    t += `<g transform="${up}">${pav}</g>`;
    // 테두리 빛: 바깥(여집합)을 오른쪽 아래로 밀면 왼쪽 위 안쪽 테가, 왼쪽 위로 밀면 오른쪽 아래 안쪽 테가 됨
    t += `<path d="${BIG}${base}" ${EO} fill="${P.slabL}" fill-opacity="0.75" transform="translate(3 ${-HT + 3})"/>`;
    t += `<path d="${BIG}${base}" ${EO} fill="${P.slabD}" fill-opacity="0.6" transform="translate(-3 ${-HT - 3})"/>`;
    s += `<g clip-path="${topClip}">${t}</g>`;
    s += `<path d="${base}" ${EO} fill="none" stroke="${OL}" stroke-width="2.2" stroke-opacity="0.55" transform="${up}"/>`;
    // 축대 가장자리: 덮어 자란 풀·눈, 굴러 나온 돌
    const bk = Buckets();
    let q = 0;
    for (const L of loops) {
      for (let i = 0; i < L.length; i += 3) {
        q++;
        const x = L[i];
        const y = L[i + 1];
        const v = rnd(q, 5, 1401);
        if (v > 0.5) continue;
        if (val('road', x, y, -99) > -6 || val('water', x, y, -99) > -4 || val('open', x, y, -99) > -4 || val('cliff', x, y, -99) > -6) continue;
        const gx = G.at(A, x + 3, y) - G.at(A, x - 3, y);
        const gy = G.at(A, x, y + 3) - G.at(A, x, y - 3);
        const gl = Math.hypot(gx, gy) || 1;
        const below = gy < -0.5 * gl; // 남쪽 가장자리(앞면 아래)
        if (v < 0.12) {
          const ox = x - (gx / gl) * 7;
          const oy = y - (gy / gl) * 7 + (below ? 3 : 0);
          pebble(bk, { stone: P.slab, stoneL: P.slabL, stoneD: P.slabSide }, ox, oy, 2.2 + rnd(q, 7, 1403) * 2.2);
        } else edgeDeco(bk, region, P, x + 1, below ? y + 2 : y - HT + 1, rnd(q, 6, 1402));
      }
    }
    s += bk.out();
    return s;
  }

  /** 다리 (물/용암 위 길 칸) — 세상 좌표로 직접 그려 빛 방향 유지 */
  function drawBridge(b, bridgeAt, P, def) {
    const cx = b.c * 100 + 50;
    const cy = b.r * 100 + 50;
    const along = b.dir === 'h'; // 길이 가로로 지나감
    const prevB = along ? bridgeAt(b.c - 1, b.r) : bridgeAt(b.c, b.r - 1);
    const nextB = along ? bridgeAt(b.c + 1, b.r) : bridgeAt(b.c, b.r + 1);
    const A0 = prevB ? -50 : -60;
    const A1 = nextB ? 50 : 60;
    const HWd = 36;
    // (u: 길 방향, v: 가로지름) → 세상 좌표
    const X = (u, v) => (along ? cx + u : cx + v);
    const Y = (u, v) => (along ? cy + v : cy + u);
    const rect = (u0, u1, v0, v1) => `M${f(Math.min(X(u0, v0), X(u1, v1)))} ${f(Math.min(Y(u0, v0), Y(u1, v1)))}H${f(Math.max(X(u0, v0), X(u1, v1)))}V${f(Math.max(Y(u0, v0), Y(u1, v1)))}H${f(Math.min(X(u0, v0), X(u1, v1)))}Z`;
    let s = '';
    s += `<path d="${rect(A0, A1, -HWd, HWd)}" fill="#04101e" fill-opacity="0.35" transform="translate(8 11)"/>`;
    if (!b.lava) {
      const woodG = def('plank', (id) => h.lg(id, [[0, h.shade(P.wood, 0.28)], [1, h.shade(P.wood, -0.05)]]));
      s += `<path d="${rect(A0, A1, -HWd, HWd)}" fill="${P.woodD}" ${SO(3)}/>`;
      let pl = '';
      let plD = '';
      let gaps = '';
      for (let u = A0 + 2; u < A1 - 2; u += 12) {
        const u1 = Math.min(A1 - 2, u + 10.5);
        const k = Math.round(u + cx * 3 + cy * 7);
        const j0 = ((k * 37) % 5) - 2;
        const d = rect(u, u1, -HWd + 2 + j0 * 0.6, HWd - 2 + j0 * 0.5);
        if (((k * 13) % 7) < 2) plD += d; else pl += d;
        gaps += along ? `M${f(X(u1 - 2, -HWd + 6))} ${f(Y(u1 - 2, -HWd + 6))}L${f(X(u1 - 2, HWd - 6))} ${f(Y(u1 - 2, HWd - 6))}` : `M${f(X(u1 - 2, -HWd + 6))} ${f(Y(u1 - 2, -HWd + 6))}L${f(X(u1 - 2, HWd - 6))} ${f(Y(u1 - 2, HWd - 6))}`;
      }
      s += `<path d="${pl}" fill="${woodG}"/><path d="${plD}" fill="${h.shade(P.wood, -0.12)}"/>`;
      s += `<path d="${gaps}" ${strokeA(P.woodD, 1.6, 0.5)}/>`;
      // 난간(가로대): 위/왼쪽은 밝게, 아래/오른쪽은 어둡게
      const railA = along ? `M${X(A0, -HWd)} ${Y(A0, -HWd)}L${X(A1, -HWd)} ${Y(A1, -HWd)}` : `M${X(A0, -HWd)} ${Y(A0, -HWd)}L${X(A1, -HWd)} ${Y(A1, -HWd)}`;
      const railB = `M${X(A0, HWd)} ${Y(A0, HWd)}L${X(A1, HWd)} ${Y(A1, HWd)}`;
      s += `<path d="${railA}${railB}" ${strokeA(OL, 11)}/><path d="${railA}" ${strokeA(h.shade(P.wood, 0.15), 6)}/><path d="${railB}" ${strokeA(P.woodD, 6)}/>`;
      s += `<path d="${railA}" ${strokeA(h.shade(P.wood, 0.45), 2, 0.8)} transform="translate(-1 -1.5)"/>`;
      const posts = [];
      if (!prevB) posts.push(A0 + 5);
      if (!nextB) posts.push(A1 - 5);
      for (const u of posts) {
        for (const v of [-HWd, HWd]) {
          const px = X(u, v);
          const py = Y(u, v);
          s += `<rect x="${f(px - 6.5)}" y="${f(py - 9)}" width="13" height="16" rx="3" fill="${P.wood}" ${SO(3)}/><path d="M${f(px - 3.5)} ${f(py - 6)}V${f(py + 3)}" ${strokeA(h.shade(P.wood, 0.4), 2, 0.8)}/>`;
        }
      }
    } else {
      const stG = def('bstone', (id) => h.lg(id, [[0, P.stoneL], [1, P.stone]]));
      s += `<path d="${rect(A0, A1, -HWd - 3, HWd + 3)}" fill="${stG}" ${SO(3)}/>`;
      let j = '';
      for (let u = A0 + 18; u < A1 - 4; u += 18) j += along ? `M${X(u, -HWd)} ${Y(u, -HWd)}V${Y(u, HWd)}` : `M${X(u, -HWd)} ${Y(u, -HWd)}H${X(u, HWd)}`;
      s += `<path d="${j}" ${strokeA(P.stoneD, 2.4, 0.7)}/>`;
    }
    return s;
  }

  /** 울림등 광장: 둥근 판석 바닥 + 연석 */
  function drawPlaza(cx, cy, P, def, rnd) {
    const R = 44;
    const pG = def('plaza', (id) => h.rg(id, [[0, h.shade(P.plaza, 0.3)], [0.7, P.plaza], [1, h.shade(P.plaza, -0.1)]], 0.38, 0.32, 0.8));
    let s = `<ellipse cx="${cx + 3}" cy="${cy + 5}" rx="${R + 5}" ry="${R * 0.86 + 5}" fill="#000" fill-opacity="0.22"/>`;
    s += `<ellipse cx="${cx + 1}" cy="${cy + 3}" rx="${R + 1}" ry="${R * 0.86 + 1}" fill="${P.plazaD}" ${SO(3)}/>`;
    s += `<ellipse cx="${cx}" cy="${cy}" rx="${R}" ry="${R * 0.86}" fill="${pG}"/>`;
    // 판석 줄눈: 고리 둘 + 방사선
    let j = `M${cx - R * 0.45} ${cy}a${R * 0.45} ${R * 0.39} 0 1 0 ${R * 0.9} 0a${R * 0.45} ${R * 0.39} 0 1 0 ${-R * 0.9} 0Z`;
    j += `M${cx - R * 0.76} ${cy}a${R * 0.76} ${R * 0.65} 0 1 0 ${R * 1.52} 0a${R * 0.76} ${R * 0.65} 0 1 0 ${-R * 1.52} 0Z`;
    for (let i = 0; i < 10; i++) {
      const a = ((i * 36 + 12) * Math.PI) / 180;
      const r0 = i % 2 ? 0.45 : 0.76;
      j += `M${f(cx + Math.cos(a) * R * r0)} ${f(cy + Math.sin(a) * R * r0 * 0.86)}L${f(cx + Math.cos(a) * R * 0.98)} ${f(cy + Math.sin(a) * R * 0.98 * 0.86)}`;
    }
    for (let i = 0; i < 6; i++) {
      const a = ((i * 60 + 30) * Math.PI) / 180;
      j += `M${f(cx + Math.cos(a) * R * 0.45)} ${f(cy + Math.sin(a) * R * 0.39)}L${f(cx + Math.cos(a) * R * 0.76)} ${f(cy + Math.sin(a) * R * 0.65)}`;
    }
    s += `<path d="${j}" ${strokeA('#ffffff', 1.6, 0.45)} transform="translate(1.2 1.2)"/><path d="${j}" ${strokeA(P.plazaD, 2.4, 0.9)}/>`;
    // 연석 하이라이트(왼쪽 위)
    s += `<path d="M${f(cx - R * 0.92)} ${f(cy - R * 0.2)}A${R} ${R * 0.86} 0 0 1 ${f(cx - R * 0.2)} ${f(cy - R * 0.84)}" ${strokeA('#ffffff', 3.4, 0.55)}/>`;
    s += `<path d="M${f(cx + R * 0.95)} ${f(cy + R * 0.12)}A${R} ${R * 0.86} 0 0 1 ${f(cx + R * 0.1)} ${f(cy + R * 0.85)}" ${strokeA('#000000', 3, 0.18)}/>`;
    s += `<path d="${[0, 1, 2, 3].map((i) => { const a = ((i * 90 + 45) * Math.PI) / 180; return circ(cx + Math.cos(a) * (R + 0.5), cy + Math.sin(a) * (R + 0.5) * 0.86, 3.4); }).join('')}" fill="#f2c14e" ${SO(1.6)}/>`;
    return s;
  }

  /** 절벽·성벽 (돋운 땅): 그림자 → 앞면(남쪽만 보임) → 윗면(왼쪽 위 밝은 테, 오른쪽 아래 어두운 테) → 윗면 무늬 */
  function drawCliffs(A, G, HC, P, region, def, clip, rnd, cellsWhere, inCliff, CM) {
    const EO = 'fill-rule="evenodd"';
    const L0 = 7;
    const loops = G.loops(A, L0);
    const base = pathD(loops, 0.3);
    const masonry = region === 1 || region === 5;
    let s = '';
    // 1) 오른쪽 아래로 드리운 그림자 + 밑동 접지 그늘
    s += `<path d="${base}" ${EO} fill="${P.shadow}" fill-opacity="${f(P.shadowOp)}" transform="translate(15 11)"/>`;
    s += `<path d="${base}" ${EO} fill="${P.shadow}" fill-opacity="${f(P.shadowOp * 0.75)}" transform="translate(5 4)"/>`;
    // 2) 앞면: 아래쪽 반은 더 어둡게(접지), 결·줄눈
    s += `<path d="${base}" ${EO} fill="${P.cliffFaceD}" stroke="${OL}" stroke-width="3"/>`;
    s += `<path d="${base}" ${EO} fill="${P.cliffFace}" transform="translate(0 ${-HC * 0.45})"/>`;
    if (region === 3) {
      s += `<path d="${base}" fill="none" stroke="${P.strata}" stroke-width="2.6" stroke-opacity="0.7" transform="translate(0 -5)"/>`;
      s += `<path d="${base}" fill="none" stroke="${P.cliffLine}" stroke-width="2" stroke-opacity="0.45" transform="translate(0 -10)"/>`;
    } else if (masonry) {
      s += `<path d="${base}" fill="none" stroke="${P.cliffLine}" stroke-width="2" stroke-opacity="0.6" transform="translate(0 -7.5)"/>`;
    } else if (region === 2) {
      s += `<path d="${base}" fill="none" stroke="#c9d8ea" stroke-width="2.2" stroke-opacity="0.55" transform="translate(0 -6)"/>`;
    }
    {
      let v = '';
      let q = 0;
      for (const L of loops) {
        for (let i = 0; i < L.length; i += 2) {
          q++;
          const x = L[i];
          const y = L[i + 1];
          if (G.at(A, x, y + 4) > L0 || G.at(A, x, y - 4) < L0) continue; // 남쪽을 향한 가장자리만
          if (masonry) {
            if (q % 3) continue;
            const off = (Math.floor(x / 16) % 2) * 7.5;
            v += `M${f(x)} ${f(y - 1.5 - off)}v-5.5`;
          } else if (region === 4) {
            if (q % 3) continue;
            v += `M${f(x)} ${f(y - 1)}v${-HC + 2}`;
          } else {
            if (rnd(q, 9, 1101) > 0.14) continue;
            v += `M${f(x)} ${f(y - 1)}l${f((rnd(q, 9, 1103) - 0.5) * 3)} ${f(-HC * (0.45 + rnd(q, 9, 1102) * 0.5))}`;
          }
        }
      }
      s += `<path d="${v}" ${strokeA(P.cliffLine, 2, 0.55)}/>`;
    }
    // 3) 윗면: 왼쪽 위 테는 밝게, 오른쪽 아래 테는 어둡게, 가운데는 본색 + 얼룩(눈은 테를 덮지 않음)
    const RB = 4;
    const topClip = clip(base, `translate(0 ${-HC})`);
    const inA = clip(base, `translate(${RB} ${-HC + RB})`);
    const inB = clip(base, `translate(${-RB} ${-HC - RB})`);
    let t = `<path d="${base}" ${EO} fill="${P.cliffTopL}" transform="translate(0 ${-HC})"/>`;
    t += `<path d="${base}" ${EO} fill="${P.cliffTopD}" transform="translate(${RB} ${-HC + RB})"/>`;
    let mid = `<rect x="-60" y="-60" width="${G.nx * GS + 120}" height="${G.ny * GS + 120}" fill="${P.cliffTop}"/>`;
    if (region === 2) {
      const sn = pathD(G.loops(CM, 0.3), 0.4);
      mid += `<path d="${sn}" ${EO} fill="#a7bad1" transform="translate(2 3)"/><path d="${sn}" ${EO} fill="#ffffff"/>`;
      mid += `<path d="${pathD(G.loops(CM, 0.6), 0.4)}" ${EO} fill="#e4edf6" fill-opacity="0.8"/>`;
    } else {
      mid += `<path d="${pathD(G.loops(CM, 0.6), 0.4)}" ${EO} fill="${P.cliffTopL}" fill-opacity="0.35"/>`;
      mid += `<path d="${pathD(G.loops(CM.map((v) => (v === -9 ? 9 : v)), 0.38, true), 0.4)}" ${EO} fill="${P.cliffTopD}" fill-opacity="0.4"/>`;
    }
    t += `<g clip-path="${inA}"><g clip-path="${inB}">${mid}</g></g>`;
    // 4) 윗면 무늬
    const bk = Buckets();
    for (const [c, r] of cellsWhere((k, cc, rr) => inCliff(cc, rr))) {
      const x0 = c * 100;
      const y0 = r * 100;
      if (masonry) {
        // 갓돌: 줄마다 엇갈린 돌
        for (let row = 0; row < 4; row++) {
          const yy = y0 + row * 25;
          const off = (row % 2) * 17;
          bk.add(strokeA(P.cliffLine, 2, 0.5), `M${x0} ${yy}H${x0 + 100}`);
          bk.add(strokeA(P.cliffTopL, 1.6, 0.55), `M${x0} ${yy + 2}H${x0 + 100}`);
          for (let xx = x0 + off; xx < x0 + 100; xx += 34) {
            const jx = f(xx + (rnd(c, r, 1111 + row * 7 + (xx - x0)) - 0.5) * 6);
            bk.add(strokeA(P.cliffLine, 2, 0.5), `M${jx} ${yy}v25`);
            bk.add(strokeA(P.cliffTopL, 1.4, 0.45), `M${f(jx + 2)} ${yy + 2}v21`);
          }
          if (rnd(c, r, 1150 + row) < 0.35) {
            const xx = x0 + rnd(c, r, 1160 + row) * 80;
            bk.add(fillA(P.cliffTopD, 0.35), `M${f(xx)} ${yy + 3}h${f(14 + rnd(c, r, 1170 + row) * 10)}v19h${f(-14)}Z`);
          }
        }
        if (region === 1) {
          for (let i = 0; i < 3; i++) {
            if (rnd(c, r, 1121 + i) > 0.5) continue;
            const x = x0 + 15 + rnd(c, r, 1124 + i) * 70;
            const y = y0 + 15 + rnd(c, r, 1127 + i) * 70;
            bk.add(fillA(h.shade(P.accent, -0.1), 0.9), circ(x - 5, y, 5) + circ(x + 2, y - 2, 6) + circ(x + 8, y + 1, 4));
            bk.add(fillA('#a9d36a', 0.85), circ(x, y - 4, 2.6));
          }
        } else {
          if (rnd(c, r, 1121) < 0.4) bk.add(strokeA(P.accent, 2.4, 0.8), `M${f(x0 + 30 + rnd(c, r, 1122) * 40)} ${y0 + 30}l6 8l-4 8l5 9`);
        }
      } else {
        for (let i = 0; i < 4; i++) {
          const x = x0 + 12 + rnd(c, r, 1131 + i) * 76;
          const y = y0 + 12 + rnd(c, r, 1135 + i) * 76;
          const v = rnd(c, r, 1139 + i);
          if (region === 2) {
            if (v < 0.5) bk.add(strokeA('#c3d3e6', 2.6, 0.8), `M${f(x - 11)} ${f(y)}q11 -5 22 0`);
            else if (v < 0.7) { bk.add(fillA('#7d90aa', 0.85), ell(x, y, 4.5, 2.8)); bk.add(fillA('#ffffff'), ell(x - 0.5, y - 2, 3.5, 1.4)); }
          } else if (region === 3) {
            if (v < 0.4) bk.add(strokeA(P.cliffLine, 2, 0.55), `M${f(x - 10)} ${f(y)}l6 3l5 -4l7 2`);
            else if (v < 0.7) bk.add(strokeA(P.cliffTopL, 2.4, 0.45), `M${f(x - 12)} ${f(y)}h24`);
            else bk.add(strokeA('#e0a868', 2, 0.85), tuftD(x, y, 0.7));
          } else if (region === 4) {
            if (v < 0.6) { bk.add(strokeA('#2a5446', 2.3, 0.85), tuftD(x, y, 0.8)); bk.add(strokeA('#8cc49a', 1.5, 0.7), tuftHiD(x, y, 0.8)); }
            else bk.add(fillA(P.stone, 0.8), ell(x, y, 4, 2.6));
          }
        }
      }
    }
    t += `<g transform="translate(0 ${-HC})">${bk.out()}</g>`;
    s += `<g clip-path="${topClip}">${t}</g>`;
    // 윗면 테두리 외곽선
    s += `<path d="${base}" ${EO} fill="none" stroke="${OL}" stroke-width="2.6" stroke-opacity="0.8" transform="translate(0 ${-HC})"/>`;
    return s;
  }

  /** 지상 입구 동굴 */
  function drawCave(s, cols, rows, kAt, isRoad, P, def, rnd, region) {
    const cx = s.c * 100 + 50;
    const cy = s.r * 100 + 50;
    let ox = 0;
    let oy = 0;
    if (s.c === 0) ox = -1; else if (s.c === cols - 1) ox = 1; else if (s.r === 0) oy = -1; else if (s.r === rows - 1) oy = 1;
    else {
      // 안쪽 입구: 길이 오는 쪽의 반대편이 바위
      let sx = 0;
      let sy = 0;
      for (const [dc, dr] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) if (isRoad(kAt(s.c + dc, s.r + dr))) { sx -= dc; sy -= dr; }
      if (Math.abs(sx) >= Math.abs(sy) && sx) ox = Math.sign(sx); else if (sy) oy = Math.sign(sy); else ox = 1;
    }
    // u = 바깥 방향, v = 옆 방향
    const T = (u, v) => [cx + ox * u - oy * v, cy + oy * u + ox * v];
    const mouthG = def('mouth', (id) => h.rg(id, [[0, '#06040b'], [0.55, '#140f1e'], [0.85, P.mist], [1, h.shade(P.mist, 0.25)]], 0.5, 0.5, 0.6));
    const hazeG = def('haze', (id) => h.rg(id, [[0, '#cfc6e8', 0.5], [1, '#cfc6e8', 0]], 0.5, 0.5, 0.5));
    // 바위 언덕: 원 여럿 (바깥쪽에 몰림)
    const blobs = [[46, -40, 24], [40, 40, 24], [30, -26, 22], [26, 28, 22], [52, 0, 28], [20, -44, 14], [18, 46, 14]];
    let moundO = '';
    let dark = '';
    let mid = '';
    let hi = '';
    let cap = '';
    let sh = '';
    for (const [u, v, r] of blobs) {
      const [x, y] = T(u, v);
      moundO += circ(x, y, r + 3.5);
      dark += circ(x, y, r);
      mid += circ(x - r * 0.13, y - r * 0.16, r * 0.84);
      hi += circ(x - r * 0.36, y - r * 0.4, r * 0.34);
      cap += ell(x - r * 0.2, y - r * 0.55, r * 0.55, r * 0.28);
      sh += circ(x + 9, y + 8, r);
    }
    const capCol = { 1: P.accent, 2: '#ffffff', 4: '#5f9c6a' }[region];
    let svg = `<path d="${moundO}" fill="${OL}"/><path d="${dark}" fill="${P.stoneD}"/><path d="${mid}" fill="${P.stone}"/>`;
    svg += `<path d="${hi}" fill="${P.stoneL}" fill-opacity="0.6"/>`;
    if (capCol) svg += `<path d="${cap}" fill="${capCol}" fill-opacity="${region === 2 ? 0.95 : 0.8}"/>`;
    // 입구(어두운 구멍) — 안쪽(−u)을 향함
    const [mx, my] = T(16, 0);
    const rx = oy ? 30 : 20;
    const ry = oy ? 18 : 30;
    svg += `<ellipse cx="${f(mx)}" cy="${f(my)}" rx="${rx + 4}" ry="${ry + 4}" fill="${h.shade(P.stoneD, -0.2)}" ${SO(3)}/>`;
    svg += `<ellipse cx="${f(mx)}" cy="${f(my)}" rx="${rx}" ry="${ry}" fill="${mouthG}"/>`;
    // 입구 위 돌출부(빛을 가림)
    svg += `<path d="M${f(mx - rx)} ${f(my - ry * 0.35)}A${rx} ${ry} 0 0 1 ${f(mx + rx * 0.7)} ${f(my - ry * 0.75)}" ${strokeA(P.stoneL, 3, 0.6)} transform="translate(0 -4)"/>`;
    const [hx, hy] = T(-2, 0);
    svg += `<ellipse cx="${f(hx)}" cy="${f(hy)}" rx="30" ry="24" fill="${hazeG}"/><path d="${ell(hx - 4, hy - 12, 13, 4.5)}${ell(hx + 8, hy + 12, 15, 4.5)}" fill="#e4def5" fill-opacity="0.3"/>`;
    return { svg, shadow: sh };
  }
  /* =========================================================
   * 지역 풍경 (400 × 160)
   * ========================================================= */
  /** 배경용 뭉게구름 */
  const cloud = (x, y, sc, col = '#ffffff', shadow = '#cfe3f0', op = 0.95) => `<g transform="translate(${x} ${y}) scale(${sc})"><path d="${circ(-18, 4, 12)}${circ(0, -4, 16)}${circ(18, 3, 12)}${ell(0, 8, 32, 8)}" fill="${col}" fill-opacity="${op}"/><path d="${ell(2, 12, 26, 3.5)}" fill="${shadow}" fill-opacity="0.8"/></g>`;
  /** 기호 하나를 풍경에 놓기 */
  const put = (sym, x, y, sc, flip) => `<g transform="translate(${x} ${y}) scale(${flip ? -sc : sc} ${sc})">${sym.g}</g>`;

  const SCENES = {
    /* 1 · 솔빛 들판: 맑은 하늘, 언덕 위 마을과 울림등, 굽은 흙길, 왼쪽 끝에 잿빛 안개 */
    1(x) {
      const { P, def, rnd, S } = x;
      const T = treeSyms(1, P, def);
      const sky = def('sky', (i) => h.lg(i, [[0, '#7cc6f0'], [0.6, '#cfeaf6'], [1, '#fff1bf']]));
      const sun = def('sun', (i) => h.rg(i, [[0, '#fffbe0'], [0.3, '#fff2a8', 0.9], [1, '#fff2a8', 0]], 0.5, 0.5, 0.5));
      const glowL = def('lglow', (i) => h.rg(i, [[0, '#fff3b0', 0.95], [0.4, '#ffd76a', 0.5], [1, '#ffd76a', 0]], 0.5, 0.5, 0.5));
      let s = `<rect width="400" height="160" fill="${sky}"/>`;
      s += `<circle cx="332" cy="38" r="46" fill="${sun}"/><circle cx="332" cy="38" r="15" fill="#fff6c4"/>`;
      s += cloud(78, 30, 1) + cloud(206, 20, 0.7) + cloud(390, 66, 0.55);
      // 먼 언덕 + 잿빛 안개
      s += `<path d="M0 94C40 80 80 82 120 90C170 76 220 74 270 86C320 76 360 78 400 86V160H0Z" fill="#bddc86"/>`;
      s += `<path d="${[[150, 84], [162, 82], [300, 80], [312, 82], [356, 82]].map(([a, b]) => circ(a, b, 5)).join('')}" fill="#8fbf5c"/>`;
      s += `<ellipse cx="10" cy="92" rx="100" ry="18" fill="${P.mist}" fill-opacity="0.35"/><ellipse cx="-10" cy="104" rx="70" ry="12" fill="${P.mist}" fill-opacity="0.3"/>`;
      // 가운데 언덕
      s += `<path d="M-5 116C60 98 120 100 175 108C235 94 300 92 405 104V165H-5Z" fill="#97c752" ${S()}/>`;
      s += `<path d="M190 104C230 96 290 94 340 98" ${strokeA('#c2e27c', 3, 0.8)}/>`;
      // 마을
      const house = (hx, hy, w, ht, roof) => `<rect x="${hx - w / 2}" y="${hy - ht}" width="${w}" height="${ht}" fill="#f4e4c0" ${S(2.2)}/>` +
        `<path d="M${hx - w / 2 - 4} ${hy - ht}L${hx} ${f(hy - ht - w * 0.6)}L${hx + w / 2 + 4} ${hy - ht}Z" fill="${roof}" ${S(2.2)}/>` +
        `<rect x="${hx - 3}" y="${hy - 9}" width="6" height="9" fill="#7a4a2a" ${S(1.6)}/><rect x="${hx + w / 2 - 9}" y="${hy - ht + 5}" width="5" height="5" fill="#ffd76a" ${S(1.4)}/>`;
      s += house(236, 101, 22, 15, '#e0663a') + house(306, 97, 18, 13, '#d9534a') + house(330, 99, 20, 14, '#e88a3a');
      // 울림등
      s += `<circle cx="272" cy="70" r="20" fill="${glowL}"/><path d="M272 99V76" ${strokeA(OL, 6)}/><path d="M272 99V76" ${strokeA('#7a5a3a', 3)}/>` +
        `<path d="M265 76H279L276 63H268Z" fill="#f2c14e" ${S(2)}/><path d="M266 63H278L272 57Z" fill="#a8723f" ${S(2)}/><circle cx="272" cy="70" r="3" fill="#fffbe0"/>`;
      s += house(260, 104, 20, 14, '#c9533a');
      // 앞 풀밭
      s += `<path d="M-5 142C70 134 150 140 230 148C300 142 360 134 405 138V165H-5Z" fill="#6fa83c" ${S()}/>`;
      // 굽은 흙길 (앞에서 마을까지 한 줄로)
      s += `<path d="M62 165C92 150 150 142 172 132C194 122 228 116 256 110L262 112C238 120 208 128 194 138C174 152 156 158 146 165Z" fill="${P.road}" ${S()}/>`;
      s += `<path d="M100 160C130 148 160 142 178 132M206 124C222 118 238 115 250 113" ${strokeA(P.roadL, 3, 0.8)}/>`;
      // 나무·덤불·꽃
      s += put(T[1], 352, 150, 0.95) + put(T[0], 384, 156, 0.8, true) + put(T[2], 16, 150, 0.8) + put(T[0], 46, 158, 0.9) + put(T[3], 320, 158, 0.6);
      s += put(T[0], 150, 104, 0.3) + put(T[2], 164, 106, 0.28) + put(T[1], 352, 98, 0.3);
      let fl = '';
      for (let i = 0; i < 40; i++) {
        const fx = 90 + rnd(i, 1) * 220;
        const fy = 146 + rnd(i, 2) * 12;
        if (fx < 186) continue;
        fl += `<circle cx="${f(fx)}" cy="${f(fy)}" r="${f(1.8 + rnd(i, 3) * 1.4)}" fill="${P.flowers[i % P.flowers.length]}"/>`;
      }
      s += fl;
      s += `<path d="${[[120, 150], [210, 152], [250, 156], [290, 150]].map(([a, b]) => `M${a - 4} ${b}l-2 -7M${a} ${b}v-9M${a + 4} ${b}l2 -6`).join('')}" ${strokeA('#4f8a2a', 2.2)}/>`;
      return s;
    },

    /* 2 · 서리 고개: 눈 덮인 봉우리 사이 고갯길, 먼 대종 탑, 얼어붙은 못, 눈 덮인 소나무 */
    2(x) {
      const { P, def, rnd, S } = x;
      const T = treeSyms(2, P, def);
      const sky = def('sky', (i) => h.lg(i, [[0, '#93c9ef'], [0.6, '#dbeffb'], [1, '#ffffff']]));
      const mFar = def('mfar', (i) => h.lg(i, [[0, '#c9dcef'], [1, '#e6f0f9']]));
      const mNear = def('mnear', (i) => h.lg(i, [[0, '#8eabc9'], [1, '#c0d4e8']], 'h'));
      let s = `<rect width="400" height="160" fill="${sky}"/>`;
      s += `<circle cx="96" cy="34" r="26" fill="#ffffff" fill-opacity="0.55"/><circle cx="96" cy="34" r="12" fill="#ffffff"/>`;
      const peaks = (list, fill, snow, stroke) => list.map(([px, py, w, base]) => {
        const hgt = base - py;
        return `<path d="M${px - w} ${base}L${px} ${py}L${px + w} ${base}Z" fill="${fill}" ${stroke}/>` +
          `<path d="M${px} ${py}L${f(px + w * 0.36)} ${f(py + hgt * 0.36)}L${f(px + w * 0.16)} ${f(py + hgt * 0.3)}L${f(px + w * 0.02)} ${f(py + hgt * 0.42)}L${f(px - w * 0.14)} ${f(py + hgt * 0.3)}L${f(px - w * 0.36)} ${f(py + hgt * 0.36)}Z" fill="${snow}" ${stroke}/>`;
      }).join('');
      s += peaks([[40, 56, 60, 110], [150, 46, 64, 110], [262, 40, 70, 110], [370, 50, 64, 110]], mFar, '#ffffff', '');
      // 고개 사이 먼 대종 탑
      s += `<path d="M196 98V74H200V68H206V74H210V98Z" fill="#8a87a8"/><path d="M199 76C199 72 207 72 207 76L208 80H198Z" fill="#c9a24a"/>`;
      s += peaks([[94, 58, 62, 118], [318, 54, 66, 118]], mNear, '#f8fcff', S(2.5));
      // 가운데 눈밭
      s += `<path d="M-5 114C70 98 140 104 205 110C270 100 330 96 405 106V165H-5Z" fill="#eef5fb" ${S()}/>`;
      s += `<path d="M30 112C70 104 110 104 150 108M250 104C290 98 330 98 370 102" ${strokeA('#c3d6ea', 3)}/>`;
      // 얼어붙은 못
      s += `<ellipse cx="86" cy="130" rx="46" ry="9" fill="#bde3f5" ${S(2.2)}/><path d="M60 128l14 3l10 -3M96 132l12 -2" ${strokeA('#ffffff', 2.2)}/>`;
      // 앞 눈더미
      s += `<path d="M-5 142C70 134 140 140 210 146C290 138 350 134 405 140V165H-5Z" fill="#ffffff" ${S()}/>`;
      // 고갯길 (앞 눈더미 위로 이어서)
      s += `<path d="M146 165C168 146 212 140 212 128C212 120 204 116 200 110L208 110C214 116 224 120 224 130C224 148 200 154 198 165Z" fill="${P.road}" ${S()}/>`;
      s += `<path d="M172 156C190 146 214 140 216 128" ${strokeA(P.roadL, 2.6, 0.8)}/>`;
      s += `<path d="M40 150C70 146 100 148 120 152M250 150C290 146 320 146 350 150" ${strokeA('#c9daec', 3)}/>`;
      s += put(T[1], 22, 152, 0.85) + put(T[0], 52, 158, 0.75, true) + put(T[2], 8, 160, 0.55) + put(T[0], 360, 150, 0.9) + put(T[1], 390, 158, 0.7) + put(T[2], 334, 160, 0.5, true);
      s += put(T[0], 136, 110, 0.28) + put(T[1], 148, 112, 0.24) + put(T[0], 262, 106, 0.26) + put(T[2], 276, 108, 0.24);
      let sn = '';
      for (let i = 0; i < 44; i++) sn += circ(rnd(i, 1) * 400, rnd(i, 2) * 150, 1.2 + rnd(i, 3) * 1.4);
      s += `<path d="${sn}" fill="#ffffff" fill-opacity="0.9"/>`;
      return s;
    },

    /* 3 · 붉은 협곡: 노을, 탁자 바위, 협곡 벽, 빛나는 용암 강, 선인장, 불티 */
    3(x) {
      const { P, def, rnd, S } = x;
      const T = treeSyms(3, P, def);
      const R = rockSyms(3, P, def);
      const sky = def('sky', (i) => h.lg(i, [[0, '#f9874a'], [0.55, '#ffb468'], [1, '#ffe2a4']]));
      const sun = def('sun', (i) => h.rg(i, [[0, '#fff6c8'], [0.25, '#ffe08a', 0.9], [1, '#ffb050', 0]], 0.5, 0.5, 0.5));
      const lava = def('lava', (i) => h.lg(i, [[0, P.lavaL], [0.5, P.lava], [1, P.lavaD]]));
      const cliff = def('cliff', (i) => h.lg(i, [[0, '#a94a2a'], [1, '#6e2c18']], 'h'));
      const blurF = def('blur', (i) => h.blur(i, 4));
      let s = `<rect width="400" height="160" fill="${sky}"/>`;
      s += `<circle cx="292" cy="86" r="70" fill="${sun}"/><circle cx="292" cy="86" r="22" fill="#fff0b4"/>`;
      s += `<path d="M84 30l6 4l6-4M104 40l5 3l5-3M250 26l5 3l5-3" ${strokeA('#6e2e1c', 2.4)}/>`;
      s += `<path d="M0 100H24L30 84H74L80 100H130L138 76H176L182 100H240L246 90H262L266 100H322L328 72H372L378 100H400V160H0Z" fill="#dc8c5a"/>`;
      s += `<path d="M-5 112H44L50 92H98L106 112H290L298 94H346L352 112H405V165H-5Z" fill="#b65a32" ${S()}/>`;
      s += `<path d="M52 100H96M300 102H344" ${strokeA('#e08a5a', 3)}/>`;
      // 협곡 바닥
      s += `<path d="M40 118C120 110 280 110 362 118V165H40Z" fill="#e6b676" ${S()}/>`;
      // 용암 강 (번짐 + 몸통 + 밝은 줄기)
      const river = 'M362 120C320 124 300 130 270 134C230 140 220 148 180 152C140 156 100 158 70 165H118C150 160 186 160 214 156C250 150 266 142 298 136C326 130 344 126 364 124Z';
      s += `<path d="${river}" fill="${P.lava}" filter="${blurF}" fill-opacity="0.9"/><path d="${river}" fill="${lava}" ${S(2.2)}/>`;
      s += `<path d="M330 126C300 132 276 138 250 144M200 154C170 158 140 160 120 163" ${strokeA('#fff3b0', 2.4, 0.9)}/>`;
      // 모래길
      s += `<path d="M150 118C150 124 120 132 100 140C80 148 60 156 50 165H12C30 154 60 144 84 136C110 128 136 122 140 118Z" fill="${P.road}" ${S()}/>`;
      // 협곡 벽
      s += `<path d="M-5 48L28 52L44 68L54 96L48 126L60 165H-5Z" fill="${cliff}" ${S()}/><path d="M0 70L36 68M0 96L48 100M0 124L46 128" ${strokeA('#c2643a', 3, 0.8)}/>`;
      s += `<path d="M405 58L372 62L360 82L350 110L356 140L346 165H405Z" fill="${cliff}" ${S()}/><path d="M405 80L364 84M405 108L352 112M405 136L356 138" ${strokeA('#c2643a', 3, 0.8)}/>`;
      s += put(T[0], 74, 152, 0.75) + put(T[1], 98, 158, 0.5, true) + put(T[3], 330, 160, 0.6) + put(R[0], 300, 160, 0.55) + put(T[2], 380, 150, 0.6);
      s += put(T[0], 170, 118, 0.25) + put(T[0], 238, 116, 0.22, true);
      let em = '';
      for (let i = 0; i < 18; i++) em += circ(120 + rnd(i, 1) * 240, 60 + rnd(i, 2) * 90, 1.2 + rnd(i, 3) * 1.4);
      s += `<path d="${em}" fill="#ffd27a" filter="${def('eglow', (i) => h.glow(i, 1.6))}"/>`;
      return s;
    },

    /* 4 · 폭풍 해안: 먹구름과 번개, 거친 바다, 절벽 위 등대, 젖은 모래사장, 야자수, 빗줄기 */
    4(x) {
      const { P, def, rnd, S } = x;
      const T = treeSyms(4, P, def);
      const R = rockSyms(4, P, def);
      const sky = def('sky', (i) => h.lg(i, [[0, '#15304b'], [0.5, '#2a536e'], [1, '#5f9998']]));
      const sea = def('sea', (i) => h.lg(i, [[0, '#2c7397'], [1, '#0f3a62']]));
      const beam = def('beam', (i) => h.lg(i, [[0, '#fff3b0', 0], [1, '#fff3b0', 0.55]], 'h'));
      const gl = def('bolt', (i) => h.glow(i, 3));
      const lampG = def('lamp', (i) => h.rg(i, [[0, '#fffbe0', 1], [0.4, '#ffe08a', 0.6], [1, '#ffe08a', 0]], 0.5, 0.5, 0.5));
      let s = `<rect width="400" height="160" fill="${sky}"/>`;
      // 먹구름
      s += cloud(70, 22, 1.5, '#223b57', '#16283e', 1) + cloud(180, 14, 1.8, '#2a4762', '#1a2f48', 1) + cloud(300, 26, 1.4, '#223b57', '#16283e', 1);
      s += `<path d="M40 30C80 24 120 26 150 30M210 22C240 18 270 20 300 24" ${strokeA('#5d84a0', 2.4, 0.6)}/>`;
      // 번개
      s += `<path d="M132 30L120 58H131L114 94L144 52H132L142 30Z" fill="#fff8c8" ${S(2)} filter="${gl}"/>`;
      // 등대 불빛
      s += `<path d="M380 24L232 2V48Z" fill="${beam}"/>`;
      // 바다
      s += `<rect y="92" width="400" height="70" fill="${sea}"/><path d="M0 93H400" ${strokeA('#8fd0cf', 2, 0.6)}/>`;
      let wv = '';
      [[100, 0.5, 2], [110, 0.6, 2.4], [122, 0.75, 2.8], [134, 0.85, 3]].forEach(([wy, op, sw], k) => {
        let d = '';
        for (let wx = (k % 2) * 18 - 10; wx < 400; wx += 36) d += `M${wx} ${wy}q9 -${4 + k} 18 0`;
        wv += `<path d="${d}" ${strokeA(k > 1 ? '#ffffff' : '#9fe0e8', sw, op)}/>`;
      });
      s += wv;
      // 절벽 + 등대
      s += `<path d="M405 62L378 64L364 78L354 100L342 120L336 144L405 165Z" fill="#2a4a55" ${S()}/><path d="M378 64L405 62V70L376 72Z" fill="#3f8f7a" ${S(2)}/>`;
      s += `<path d="M372 66L376 30H392L396 66Z" fill="#f4f1ea" ${S(2.4)}/><path d="M373.5 54H394.5M375 42H393" ${strokeA('#d9534a', 6)}/><path d="M372 66L376 30H392L396 66Z" fill="none" ${S(2.4)}/>`;
      s += `<circle cx="384" cy="24" r="16" fill="${lampG}"/><rect x="377" y="19" width="14" height="11" fill="#ffe08a" ${S(2)}/><path d="M374 19H394L384 10Z" fill="#d9534a" ${S(2)}/>`;
      // 부서지는 파도
      s += `<path d="${circ(338, 132, 9)}${circ(326, 136, 7)}${circ(348, 124, 7)}${circ(316, 140, 5)}" fill="#ffffff" fill-opacity="0.9"/>`;
      // 모래사장
      s += `<path d="M-5 136C80 128 180 132 260 140C320 146 360 150 405 152V165H-5Z" fill="${P.road}" ${S()}/>`;
      s += `<path d="M0 138C80 130 180 134 260 142C300 146 330 148 350 150" ${strokeA('#ffffff', 3, 0.85)}/>`;
      s += `<path d="${ell(150, 150, 3.5, 2.5)}${ell(220, 154, 3, 2)}${ell(110, 156, 2.6, 2)}" fill="${P.flowers[0]}" ${S(1.4)}/>`;
      s += put(T[0], 52, 152, 0.9) + put(T[1], 92, 156, 0.6) + put(R[1], 300, 158, 0.55) + put(R[0], 250, 160, 0.4, true);
      let rn = '';
      for (let i = 0; i < 46; i++) { const rx = rnd(i, 1) * 420 - 10; const ry = rnd(i, 2) * 150; rn += `M${f(rx)} ${f(ry)}l-5 12`; }
      s += `<path d="${rn}" ${strokeA('#cfe8f0', 1.8, 0.35)}/>`;
      return s;
    },

    /* 5 · 깨진 대종: 회보라 하늘, 부서진 종루에 매달린 금 간 대종, 금빛이 새고 안개가 흘러나옴 */
    5(x) {
      const { P, def, rnd, S } = x;
      const T = treeSyms(5, P, def);
      const PL = pillarSyms(5, P, def);
      const sky = def('sky', (i) => h.lg(i, [[0, '#37314c'], [0.55, '#665c82'], [1, '#b2a4c4']]));
      const halo = def('halo', (i) => h.rg(i, [[0, '#ffd77a', 0.6], [0.5, '#ffb84a', 0.18], [1, '#ffb84a', 0]], 0.5, 0.5, 0.5));
      const bronze = def('bell', (i) => h.lg(i, [[0, '#8a5a22'], [0.22, '#f6d488'], [0.5, '#cf9a3c'], [1, '#6e4618']], 'h'));
      const stoneG = def('post', (i) => h.lg(i, [[0, P.stoneL], [0.5, P.stone], [1, P.stoneD]], 'h'));
      const gl = def('crack', (i) => h.glow(i, 3));
      const mist = def('mist', (i) => h.lg(i, [[0, '#8f86ad', 0.65], [1, '#3a3350', 0]]));
      let s = `<rect width="400" height="160" fill="${sky}"/>`;
      s += `<circle cx="252" cy="68" r="96" fill="${halo}"/>`;
      // 먼 폐허
      s += `<path d="M0 104V82H10V72H18V88H30V96H44V78H52V104ZM80 104V90C80 80 100 80 100 90V104H94V92C94 88 86 88 86 92V104ZM330 104V84H338V76H346V92H358V104ZM372 104V88H380V80H390V104Z" fill="#5a5274"/>`;
      // 언덕
      s += `<path d="M-5 120C60 108 120 112 160 116C200 104 320 100 405 110V165H-5Z" fill="#4b4462" ${S()}/>`;
      // 종루: 기둥 둘 + 부러진 들보
      s += `<path d="M190 118V36H204V118Z" fill="${stoneG}" ${S()}/><path d="M298 118V48L304 42L312 50V118Z" fill="${stoneG}" ${S()}/>`;
      s += `<path d="M184 28H300L306 36L296 38H184Z" fill="#6a4a3a" ${S()}/><path d="M188 31H292" ${strokeA('#8e6a52', 2.4)}/>`;
      s += `<path d="M196 50H198M196 70H198M196 90H198M304 66H306M304 86H306" ${strokeA(P.stoneD, 3)}/>`;
      // 대종
      s += `<path d="M248 38V30" ${strokeA(OL, 6)}/>`;
      s += `<path d="M222 46C222 36 234 32 248 32C262 32 274 36 274 46C276 68 282 86 296 96C298 100 296 104 292 104H272L268 96L262 104H204C200 104 198 100 200 96C214 86 220 68 222 46Z" fill="${bronze}" ${S(3)}/>`;
      s += `<path d="M201 98H271M264 104H291" ${strokeA('#6e4618', 4)}/><path d="M221 54H275M219 60H277" ${strokeA('#7a5220', 2.4, 0.8)}/>`;
      s += `<path d="M230 44C232 38 238 36 244 35" ${strokeA('#fff0c0', 2.6, 0.8)}/>`;
      const crack = 'M262 104L255 90L265 80L251 66L258 56L246 44';
      s += `<path d="${crack}" ${strokeA('#ffe28c', 6)} filter="${gl}"/><path d="${crack}" ${strokeA('#fff6d0', 2)}/>`;
      // 흘러나오는 안개
      s += `<path d="M254 100C240 116 200 120 150 132C110 142 60 140 20 150L20 165H330C320 150 300 132 280 120C270 114 262 108 258 100Z" fill="${mist}"/>`;
      // 떠도는 종 조각
      s += `<path d="M266 98L276 96L272 106Z" fill="${bronze}" ${S(2)}/><path d="M316 70L324 66L326 76L318 78Z" fill="${bronze}" ${S(2)}/><path d="M176 64L184 60L186 70Z" fill="${bronze}" ${S(2)}/>`;
      // 판석길
      s += `<path d="M196 165C206 146 226 128 238 116H262C262 128 270 146 282 165Z" fill="${P.road}" ${S()}/>`;
      s += `<path d="M232 124H264M222 136H268M210 150H274M246 116V124M238 124L234 136M256 124L258 136M226 136L218 150M246 136V150M262 136L266 150M232 150L228 165M256 150L258 165" ${strokeA(P.roadEdge, 2, 0.6)}/>`;
      // 앞: 기둥 잔해, 고목
      s += put(PL[0], 70, 150, 0.6) + put(PL[1], 124, 146, 0.45) + put(PL[2], 354, 150, 0.55, true);
      s += put(T[0], 24, 156, 0.8) + put(T[1], 386, 158, 0.7, true) + put(T[2], 160, 160, 0.5);
      s += `<path d="M-5 150C60 144 140 148 200 156L190 165H-5ZM290 165C300 154 340 148 405 150V165Z" fill="#3a3449" ${S()}/>`;
      let mo = '';
      for (let i = 0; i < 20; i++) mo += circ(150 + rnd(i, 1) * 200, 30 + rnd(i, 2) * 90, 1 + rnd(i, 3) * 1.4);
      s += `<path d="${mo}" fill="#ffe28c" fill-opacity="0.85"/>`;
      return s;
    },
  };

  function regionBanner(regionId) {
    const id = PAL[regionId] ? +regionId : 1;
    const P = PAL[id];
    const defs = [];
    const memo = {};
    const def = (key, mk) => {
      if (!memo[key]) { const i = h.uid('rb'); defs.push(mk(i)); memo[key] = `url(#${i})`; }
      return memo[key];
    };
    const rnd = rndFactory(`banner${id}`);
    const S = (w = 2.5) => `stroke="${OL}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
    let s = SCENES[id]({ P, def, rnd, S });
    const vG = def('vig', (i) => h.rg(i, [[0.6, OL, 0], [1, OL, 0.3]], 0.5, 0.5, 0.72));
    s += `<rect width="400" height="160" fill="${vG}"/>`;
    return h.svg('0 0 400 160', defs.join(''), s);
  }

  RG.art.mapBackground = mapBackground;
  RG.art.regionBanner = regionBanner;
})();
