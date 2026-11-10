'use strict';

/* =========================================================
 * 렌더러 — 캔버스 하나에 맵과 모든 것을 그립니다.
 * 순서: ARCHITECTURE.md §6
 * ========================================================= */
RG.render = (() => {
  let canvas = null;
  let ctx = null;
  let game = null;
  let T = 40;            // 1칸 = T CSS px
  let ox = 0;
  let oy = 0;
  let dpr = 1;
  let W = 0;
  let H = 0;
  let bg = null;         // 바탕 오프스크린 캔버스
  let bgFor = '';
  let time = 0;
  let shadeLayer = null;  // 바탕 + 탑 그림자 (탑이 바뀔 때만 다시 그림)
  let shadeFor = '';
  let shadeBaked = false; // 이번 프레임에 탑 그림자를 층에서 그렸는지
  let manyEnemies = false; // 적이 아주 많으면 적의 드리운 그림자 대신 발밑 그늘만 (성능)
  const overlay = { hover: null, selectedTower: null, ghost: null, selectedEnemy: null, heroSelected: false, skill: null, rally: null, showPaths: true };
  const REGION_BASE = { 1: '#5d7a3c', 2: '#c9d8e6', 3: '#b9774a', 4: '#3f7f86', 5: '#5d5672' };

  const X = (x) => ox + x * T;
  const Y = (y) => oy + y * T;
  const lerp = (a, b, k) => a + (b - a) * k;

  function attach(cv, g) {
    canvas = cv;
    ctx = canvas.getContext('2d');
    game = g;
    corpses = [];
    projStart.clear();
    shadeFor = '';
    bg = null;
    bgFor = '';
    resize();
  }

  function detach() { game = null; }

  function resize() {
    if (!canvas || !game) return;
    const rect = canvas.parentElement.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2); // 2배 넘는 화면은 2배로 (휴대폰에서 채우기 비용을 줄임, 선명도 차이는 거의 없음)
    W = Math.max(100, rect.width);
    H = Math.max(80, rect.height);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    const m = game.map;
    T = Math.max(8, Math.floor(Math.min(W / m.cols, H / m.rows)));
    ox = Math.floor((W - m.cols * T) / 2);
    oy = Math.floor((H - m.rows * T) / 2);
    buildBackground();
  }

  function buildBackground() {
    const m = game.map;
    const key = `${m.id}:${T}:${dpr}`;
    if (bgFor === key) return;
    bgFor = key;
    const w = Math.round(m.cols * T * dpr);
    const h = Math.round(m.rows * T * dpr);
    let svg = null;
    try { svg = RG.art.mapBackground ? RG.art.mapBackground(m) : null; } catch (e) { svg = null; }
    if (!svg) { bg = null; return; }
    const img = new Image();
    img.onload = () => {
      if (bgFor !== key) return;
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      cv.getContext('2d').drawImage(img, 0, 0, w, h);
      bg = cv;
    };
    img.src = RG.art.sprites.dataUrl(RG.art.sprites.sized(svg, w, h));
  }

  function screenToWorld(px, py) { return { x: (px - ox) / T, y: (py - oy) / T }; }
  function worldToScreen(x, y) { return { x: X(x), y: Y(y) }; }
  const tileSize = () => T;

  /* ---------------- 그리기 도우미 ---------------- */
  function sprite(key, cx, cy, w, h, ax, ay, flip, alpha) {
    const s = RG.art.sprites.get(key);
    if (!s) return false;
    const a0 = ctx.globalAlpha;
    if (alpha != null && alpha !== 1) ctx.globalAlpha = a0 * alpha;
    if (flip) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(-1, 1);
      ctx.drawImage(s.canvas, -w * ax, -h * ay, w, h);
      ctx.restore();
    } else {
      ctx.drawImage(s.canvas, cx - w * ax, cy - h * ay, w, h);
    }
    ctx.globalAlpha = a0;
    return true;
  }

  /* ---------------- 그림자 (빛은 늘 왼쪽 위) ---------------- */
  // 발밑 그늘: 가장자리가 부드러운 타원 (한 번 그려 두고 늘려 씀)
  let blobCanvas = null;
  function blob() {
    if (blobCanvas) return blobCanvas;
    blobCanvas = document.createElement('canvas');
    blobCanvas.width = 128; blobCanvas.height = 64;
    const c2 = blobCanvas.getContext('2d');
    const g = c2.createRadialGradient(64, 32, 2, 64, 32, 62);
    g.addColorStop(0, 'rgba(12,7,20,1)'); g.addColorStop(0.55, 'rgba(12,7,20,0.75)'); g.addColorStop(1, 'rgba(12,7,20,0)');
    c2.fillStyle = g;
    c2.save(); c2.scale(1, 0.5); c2.beginPath(); c2.arc(64, 64, 64, 0, Math.PI * 2); c2.fill(); c2.restore();
    return blobCanvas;
  }
  function shadow(x, y, rx, ry, a = 0.32) {
    const a0 = ctx.globalAlpha;
    ctx.globalAlpha = a0 * Math.min(1, a * 1.6);
    const w = Math.max(4, rx * T * 2.2);
    const h = Math.max(2, ry * T * 2.2);
    ctx.drawImage(blob(), X(x) - w / 2 + T * 0.03, Y(y) - h / 2 + T * 0.01, w, h);
    ctx.globalAlpha = a0;
  }
  // 드리운 그림자: 그림 모양 그대로 오른쪽 아래로 눕힘 (그림마다 한 번 만들어 둠)
  const shadowCache = new Map();
  function shadowCanvas(key) {
    if (shadowCache.has(key)) return shadowCache.get(key);
    const s = RG.art.sprites.get(key);
    if (!s) return null;
    // 흐림 필터 대신 작게 줄여 두었다가 늘려 그려 가장자리를 부드럽게 (필터는 느리고 일부 브라우저에 없음)
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(s.canvas.width / 3));
    cv.height = Math.max(1, Math.round(s.canvas.height / 3));
    const c2 = cv.getContext('2d');
    c2.imageSmoothingQuality = 'high';
    c2.drawImage(s.canvas, 0, 0, cv.width, cv.height);
    c2.globalCompositeOperation = 'source-in';
    c2.fillStyle = '#140c1e';
    c2.fillRect(0, 0, cv.width, cv.height);
    shadowCache.set(key, cv);
    return cv;
  }
  /** (cx, by) = 바닥 기준점, w·h·ax·ay = 그림 배치, lift = 땅에서 뜬 높이(비행) */
  function castShadow(key, cx, by, w, h, ax, ay, flip, alpha, lift = 0) {
    if (!shadowsOn) return;
    const cv = shadowCanvas(key);
    if (!cv) return;
    ctx.save();
    ctx.globalAlpha *= alpha;
    // (cx+lift·0.55, by)로 옮긴 뒤 기울임: 높이 H인 점 → 오른쪽으로 0.6H, 아래로 0.4H (좌우 반전이면 x축을 뒤집음)
    ctx.transform(flip ? -1 : 1, 0, -0.6, -0.4, cx + lift * 0.55, by);
    ctx.drawImage(cv, -w * ax, -h * ay, w, h);
    ctx.restore();
  }
  let shadowsOn = true;

  function bar(cx, top, w, ratio, color, shieldRatio, elite) {
    const h = Math.max(3, Math.round(T * 0.09));
    const x = Math.round(cx - w / 2);
    const y = Math.round(top);
    ctx.fillStyle = 'rgba(15,10,25,0.85)';
    ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = '#3a2a33';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, Math.max(0, w * ratio), h);
    if (shieldRatio > 0) {
      ctx.fillStyle = 'rgba(190,232,255,0.9)';
      ctx.fillRect(x, y, Math.max(0, w * Math.min(1, shieldRatio)), Math.max(2, h * 0.5));
    }
    if (elite) {
      ctx.fillStyle = '#ffd34d';
      ctx.beginPath();
      ctx.moveTo(x - 6, y - 1); ctx.lineTo(x - 2, y + h / 2); ctx.lineTo(x - 6, y + h + 1); ctx.closePath();
      ctx.fill();
    }
  }

  function elColor(el) { return (RG.data.elements[el] || { color: '#fff' }).color; }

  /* ---------------- 바탕·경로 ---------------- */
  /*
   * 탑 그림자 층: 탑은 움직이지 않으므로 발밑 그늘·드리운 그림자(쉬는 자세 모양)를 바탕과 한 장에 구워 둠.
   * 탑을 짓고·올리고·팔 때만 다시 그림 → 매 프레임 탑 40개의 그림자를 그리지 않음.
   */
  function towerShadeLayer() {
    const st = game.state;
    const m = game.map;
    const A = RG.art.sprites;
    let key = `${bgFor}|${shadowsOn ? 1 : 0}`;
    for (const t of st.towers) key += `|${t.id}:${t.type}:${t.level}:${t.branch || ''}:${t.building ? 1 : 0}:${A.get(A.towerKey(t.type, t.level, t.branch, 'idle')) ? 1 : 0}`;
    if (key === shadeFor && shadeLayer) return shadeLayer;
    shadeFor = key;
    if (!shadeLayer || shadeLayer.width !== bg.width || shadeLayer.height !== bg.height) {
      shadeLayer = document.createElement('canvas');
      shadeLayer.width = bg.width;
      shadeLayer.height = bg.height;
    }
    const c2 = shadeLayer.getContext('2d');
    c2.setTransform(1, 0, 0, 1, 0, 0);
    c2.globalAlpha = 1;
    c2.clearRect(0, 0, shadeLayer.width, shadeLayer.height);
    c2.drawImage(bg, 0, 0);
    c2.setTransform(bg.width / (m.cols * T), 0, 0, bg.height / (m.rows * T), 0, 0);
    const keep = { ctx, ox, oy };
    ctx = c2; ox = 0; oy = 0;
    try {
      for (const t of st.towers) shadow(t.x, t.r + 0.8, 0.36, 0.12, 0.28);
      for (const t of st.towers) castShadow(A.towerKey(t.type, t.level, t.branch, 'idle'), X(t.x), Y(t.r + 0.82), T, T * 1.3, 0.5, 112 / 130, false, t.building ? 0.2 : 0.42);
    } finally {
      ctx = keep.ctx; ox = keep.ox; oy = keep.oy;
    }
    return shadeLayer;
  }

  function drawBackground() {
    const m = game.map;
    shadeBaked = false;
    if (bg) {
      const layer = towerShadeLayer();
      ctx.drawImage(layer || bg, X(0), Y(0), m.cols * T, m.rows * T);
      shadeBaked = !!layer;
    }
    else {
      ctx.fillStyle = REGION_BASE[m.def.region] || '#556';
      ctx.fillRect(X(0), Y(0), m.cols * T, m.rows * T);
      // 그림이 없을 때도 칸이 읽히게
      for (let r = 0; r < m.rows; r++) {
        for (let c = 0; c < m.cols; c++) {
          const k = m.kinds[r * m.cols + c];
          const G = RG.grid.T;
          let col = null;
          if (k === G.PATH || k === G.SPAWN || k === G.LANTERN) col = '#c8a874';
          else if (k === G.OPEN) col = '#93b86a';
          else if (k === G.BUILD) col = '#6f9447';
          else if (k === G.WATER) col = '#3f7fb0';
          else col = '#3e4a33';
          ctx.fillStyle = col;
          ctx.fillRect(X(c) + 0.5, Y(r) + 0.5, T - 1, T - 1);
        }
      }
    }
  }

  function drawPortals() {
    const m = game.map;
    for (const s of m.spawns) {
      const cx = X(s.x);
      const cy = Y(s.y);
      ctx.save();
      const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, T * 0.55);
      g.addColorStop(0, 'rgba(30,24,40,0.9)');
      g.addColorStop(0.6, 'rgba(90,84,110,0.45)');
      g.addColorStop(1, 'rgba(160,150,180,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, cy, T * 0.55, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(220,214,240,0.35)';
      ctx.lineWidth = Math.max(1, T * 0.04);
      for (let i = 0; i < 3; i++) {
        const a = time * 1.6 + (i * Math.PI * 2) / 3;
        ctx.beginPath(); ctx.arc(cx, cy, T * (0.18 + 0.1 * i), a, a + 1.6); ctx.stroke();
      }
      ctx.restore();
    }
    for (const s of m.airSpawns) {
      const cx = X(s.x);
      const cy = Y(s.y);
      ctx.save();
      ctx.strokeStyle = 'rgba(235,235,255,0.55)';
      ctx.lineWidth = Math.max(1, T * 0.05);
      for (let i = 0; i < 3; i++) {
        const a = -time * 2 + (i * Math.PI * 2) / 3;
        ctx.beginPath(); ctx.arc(cx, cy, T * (0.2 + 0.09 * i), a, a + 2); ctx.stroke();
      }
      ctx.restore();
    }
  }

  /** 준비 단계: 지상 경로 화살표와 비행 경로 점선 */
  function drawPathPreview() {
    const st = game.state;
    const m = game.map;
    if (!overlay.showPaths) return;
    if (st.wave.started && !(st.wave.countdown !== null && st.wave.countdown > 0 && st.enemies.length === 0)) return;
    ctx.save();
    ctx.globalAlpha = 0.55 + 0.25 * Math.sin(time * 3);
    ctx.fillStyle = '#fff6d8';
    for (const s of m.spawns) {
      let c = s.c;
      let r = s.r;
      let guard = 0;
      let k = 0;
      while (guard++ < 200) {
        const nx = RG.grid.nextStep(m, game.flow, game.blocked, c, r, 0);
        if (!nx) break;
        if (k % 2 === 0) {
          const ax = X(c + 0.5);
          const ay = Y(r + 0.5);
          const bx = X(nx.c + 0.5);
          const by = Y(nx.r + 0.5);
          const ang = Math.atan2(by - ay, bx - ax);
          const mx = (ax + bx) / 2;
          const my = (ay + by) / 2;
          const s2 = T * 0.14;
          ctx.beginPath();
          ctx.moveTo(mx + Math.cos(ang) * s2, my + Math.sin(ang) * s2);
          ctx.lineTo(mx + Math.cos(ang + 2.4) * s2, my + Math.sin(ang + 2.4) * s2);
          ctx.lineTo(mx + Math.cos(ang - 2.4) * s2, my + Math.sin(ang - 2.4) * s2);
          ctx.closePath();
          ctx.fill();
        }
        c = nx.c; r = nx.r; k += 1;
      }
    }
    // 비행 경로
    const air = m.airSpawns.length ? m.airSpawns : [];
    ctx.setLineDash([T * 0.15, T * 0.15]);
    ctx.strokeStyle = 'rgba(235,240,255,0.75)';
    ctx.lineWidth = Math.max(1.5, T * 0.04);
    for (const a of air) {
      ctx.beginPath(); ctx.moveTo(X(a.x), Y(a.y)); ctx.lineTo(X(m.lantern.x), Y(m.lantern.y)); ctx.stroke();
    }
    ctx.restore();
  }

  /* ---------------- 장판·덫 ---------------- */
  function drawZones() {
    const st = game.state;
    for (const z of st.zones) {
      const cx = X(z.x);
      const cy = Y(z.y);
      const R = z.radius * T;
      const fade = Math.min(1, (z.until - st.time) / 0.4);
      ctx.save();
      ctx.globalAlpha = 0.85 * fade;
      if (z.kind === 'fire') {
        const g = ctx.createRadialGradient(cx, cy, 1, cx, cy, R);
        g.addColorStop(0, 'rgba(255,214,120,0.75)');
        g.addColorStop(0.55, 'rgba(255,107,61,0.45)');
        g.addColorStop(1, 'rgba(160,40,20,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.ellipse(cx, cy, R, R * 0.8, 0, 0, Math.PI * 2); ctx.fill();
        if (Math.random() < 0.25) RG.fx.burst(z.x + (Math.random() - 0.5) * z.radius, z.y + (Math.random() - 0.5) * z.radius * 0.6, '#ffb070', 1, 0.6, 0.5, 0.05, -1.5);
      } else if (z.kind === 'void') {
        const g = ctx.createRadialGradient(cx, cy, 1, cx, cy, R);
        g.addColorStop(0, 'rgba(20,6,30,0.9)');
        g.addColorStop(0.7, 'rgba(110,31,102,0.55)');
        g.addColorStop(1, 'rgba(209,79,192,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.ellipse(cx, cy, R, R * 0.8, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(242,184,234,0.6)';
        ctx.lineWidth = Math.max(1, T * 0.03);
        for (let i = 0; i < 3; i++) {
          const a = -time * 2.5 + i * 2.1;
          ctx.beginPath(); ctx.ellipse(cx, cy, R * (0.4 + i * 0.18), R * 0.8 * (0.4 + i * 0.18), 0, a, a + 1.4); ctx.stroke();
        }
      } else if (z.kind === 'thorn') {
        ctx.fillStyle = 'rgba(74,122,38,0.35)';
        ctx.beginPath(); ctx.ellipse(cx, cy, R, R * 0.8, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#9fd36a';
        ctx.strokeStyle = '#2b4a17';
        ctx.lineWidth = 1;
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2;
          const rr = R * (0.45 + 0.4 * ((i * 37) % 10) / 10);
          const sx = cx + Math.cos(a) * rr;
          const sy = cy + Math.sin(a) * rr * 0.8;
          ctx.beginPath(); ctx.moveTo(sx - T * 0.05, sy); ctx.lineTo(sx, sy - T * 0.16); ctx.lineTo(sx + T * 0.05, sy); ctx.closePath(); ctx.fill(); ctx.stroke();
        }
      }
      ctx.restore();
    }
    for (const tr of st.traps) {
      const cx = X(tr.x);
      const cy = Y(tr.y);
      ctx.save();
      ctx.globalAlpha = 0.7 + 0.2 * Math.sin(time * 4 + tr.id);
      ctx.strokeStyle = '#d14fc0';
      ctx.fillStyle = 'rgba(40,10,40,0.55)';
      ctx.lineWidth = Math.max(1.5, T * 0.05);
      ctx.beginPath(); ctx.ellipse(cx, cy, T * 0.3, T * 0.22, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + time;
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a) * T * 0.26, cy + Math.sin(a) * T * 0.19);
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  /* ---------------- 공명 선 ---------------- */
  function drawLinks() {
    const st = game.state;
    const byId = new Map(st.towers.map((t) => [t.id, t]));
    ctx.save();
    ctx.lineCap = 'round';
    for (const t of st.towers) {
      for (const id of t.links) {
        if (id < t.id) continue;
        const n = byId.get(id);
        if (!n) continue;
        const ax = X(t.x);
        const ay = Y(t.y + 0.15);
        const bx = X(n.x);
        const by = Y(n.y + 0.15);
        const g = ctx.createLinearGradient(ax, ay, bx, by);
        g.addColorStop(0, elColor(RG.data.towers[t.type].element));
        g.addColorStop(1, elColor(RG.data.towers[n.type].element));
        const pulse = 0.5 + 0.5 * Math.sin(time * 3 + (t.id + n.id) * 0.7);
        ctx.globalAlpha = 0.35 + 0.35 * pulse;
        ctx.strokeStyle = g;
        ctx.lineWidth = Math.max(2, T * 0.09);
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
        ctx.globalAlpha = 0.6 + 0.4 * pulse;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = Math.max(1, T * 0.025);
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
        // 흐르는 빛 구슬
        const k = (time * 0.7 + (t.id * 0.13)) % 1;
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = 0.9;
        ctx.beginPath(); ctx.arc(lerp(ax, bx, k), lerp(ay, by, k), Math.max(1.5, T * 0.05), 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
  }

  /* ---------------- 오버레이(사거리·미리보기) ---------------- */
  function rangeCircle(x, y, r, color, dash) {
    ctx.save();
    ctx.fillStyle = color.replace('A', '0.12');
    ctx.strokeStyle = color.replace('A', '0.85');
    ctx.lineWidth = Math.max(1.5, T * 0.035);
    if (dash) ctx.setLineDash([T * 0.12, T * 0.08]);
    ctx.beginPath(); ctx.arc(X(x), Y(y), r * T, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  function drawOverlayUnder() {
    const st = game.state;
    // 마우스가 올라간 칸
    if (overlay.hover && !overlay.ghost) {
      const { c, r } = overlay.hover;
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = Math.max(1, T * 0.03);
      ctx.strokeRect(X(c) + 1.5, Y(r) + 1.5, T - 3, T - 3);
      ctx.restore();
    }
    // 고른 탑의 사거리
    const sel = overlay.selectedTower != null ? st.towers.find((t) => t.id === overlay.selectedTower) : null;
    if (sel && sel.calc) {
      const c = sel.calc;
      if (c.range) rangeCircle(sel.x, sel.y, c.range, 'rgba(255,240,200,A)');
      if (c.minRange) rangeCircle(sel.x, sel.y, c.minRange, 'rgba(255,120,100,A)', true);
      if (c.rallyRange) rangeCircle(sel.x, sel.y, c.rallyRange, 'rgba(180,230,140,A)', true);
      if (c.detect) rangeCircle(sel.x, sel.y, c.detect, 'rgba(255,230,140,A)', true);
      if (c.bountyAura) rangeCircle(sel.x, sel.y, c.bountyAura.radius, 'rgba(255,211,77,A)', true);
      if (c.aura || c.role === 'support') {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.setLineDash([T * 0.1, T * 0.08]);
        ctx.lineWidth = Math.max(1, T * 0.03);
        ctx.strokeRect(X(sel.c - 1) + 2, Y(sel.r - 1) + 2, T * 3 - 4, T * 3 - 4);
        ctx.restore();
      }
      if (sel.rally) {
        ctx.save();
        ctx.fillStyle = '#9fd36a';
        ctx.strokeStyle = '#1c1426';
        ctx.lineWidth = 2;
        const fx = X(sel.rally.x);
        const fy = Y(sel.rally.y);
        ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx, fy - T * 0.45); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(fx, fy - T * 0.45); ctx.lineTo(fx + T * 0.3, fy - T * 0.35); ctx.lineTo(fx, fy - T * 0.25); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.restore();
      }
    }
    // 건설 미리보기
    const gh = overlay.ghost;
    if (gh) {
      const td = RG.data.towers[gh.type];
      const spec = td.levels[0];
      const x = gh.c + 0.5;
      const y = gh.r + 0.5;
      ctx.save();
      ctx.fillStyle = gh.ok ? 'rgba(140,255,160,0.22)' : 'rgba(255,90,90,0.28)';
      ctx.fillRect(X(gh.c), Y(gh.r), T, T);
      ctx.restore();
      if (spec.range) rangeCircle(x, y, spec.range * (1 + ((game.meta && game.meta.rangePct) || 0)), gh.ok ? 'rgba(200,255,210,A)' : 'rgba(255,140,140,A)');
      if (spec.rallyRange) rangeCircle(x, y, spec.rallyRange, 'rgba(180,230,140,A)', true);
      if (spec.detect) rangeCircle(x, y, spec.detect, 'rgba(255,230,140,A)', true);
      for (const l of gh.links || []) {
        ctx.save();
        ctx.strokeStyle = elColor(td.element);
        ctx.globalAlpha = 0.9;
        ctx.setLineDash([T * 0.1, T * 0.06]);
        ctx.lineWidth = Math.max(2, T * 0.07);
        ctx.beginPath(); ctx.moveTo(X(x), Y(y + 0.15)); ctx.lineTo(X(l.c + 0.5), Y(l.r + 0.65)); ctx.stroke();
        ctx.restore();
      }
    }
    // 영웅 기술 조준
    if (overlay.skill && overlay.hover) {
      const { x, y } = overlay.skillPos || { x: overlay.hover.c + 0.5, y: overlay.hover.r + 0.5 };
      rangeCircle(x, y, overlay.skill.radius || 0.6, 'rgba(255,230,160,A)');
    }
    if (overlay.rally && overlay.hover) {
      const t = st.towers.find((q) => q.id === overlay.rally);
      if (t) rangeCircle(t.x, t.y, t.calc.rallyRange, 'rgba(180,230,140,A)', true);
    }
  }

  /* ---------------- 동작 자세 고르기 (docs/design/animation.md) ---------------- */
  /** 자세 그림이 준비됐으면 그 키, 아니면 준비를 시작하고 대신할 키 */
  function poseSprite(key, fallback, make, w, h) {
    return RG.art.sprites.ensure(key, make, w, h) ? key : fallback;
  }
  // 적 그림 이름은 매 프레임 수백 번 쓰이므로 만들어 둔 문자열을 다시 씀 (쓰레기 수거 부담 줄이기)
  const WALK = ['walk0', 'walk1', 'walk2', 'walk3'];
  const ekeyCache = new Map();
  function ekey(type, frame) {
    let m = ekeyCache.get(type);
    if (!m) { m = {}; ekeyCache.set(type, m); }
    return m[frame] || (m[frame] = RG.art.sprites.enemyKey(type, frame));
  }
  /** 탑: 쏜 직후 0.14초 fire, 다음 발사 직전 aim(시위 당김·힘 모음), 그 밖 idle. 지원·광산·병영은 일하는 모습 반복 */
  function towerPose(t) {
    if (t.building || t.disabled) return 'idle';
    const td = RG.data.towers[t.type];
    if (td.role !== 'attack') {
      const ph = (time * 0.75 + t.id * 0.37) % 3;
      return ph < 1.7 ? 'idle' : ph < 2.55 ? 'aim' : 'fire';
    }
    if (td.kind === 'beam') return t.beamState && t.beamState.length ? 'fire' : 'idle';
    if (t.anim > 0.11) return 'fire';
    const iv = (t.calc && t.calc.interval) || 1;
    if (t.cd > 0 && t.cd <= Math.max(0.22, iv * 0.4)) return 'aim';
    return 'idle';
  }
  /** 적: 걷기 4장 한 바퀴, 붙잡혀 싸울 때·던질 때는 aim → attack */
  function enemyFrame(e, moving) {
    if (e.attackAnim > 0.08 || e.castAnim > 0.1) return 'attack';
    if (e.aiming) return 'aim';
    if (e.flying) return WALK[Math.floor(time * 8 + e.id * 0.7) % 4]; // 날갯짓은 늘 함
    if (!moving) return 'walk0';
    // walkT는 걸어온 거리(칸). 보폭은 몸 크기에 비례 → 작은 적은 종종걸음
    const stride = 0.45 + e.size * 0.55;
    return WALK[Math.floor((e.walkT / stride) * 4) % 4];
  }
  /** 영웅: 기술 cast, 공격 attack, 곧 공격 aim, 걷기 4장, 서 있을 땐 숨쉬기 2장 */
  function heroPose(h, moving) {
    if (h.castAnim > 0) return 'cast';
    if (h.attackAnim > 0.12) return 'attack';
    if (moving) return `walk${Math.floor(time * 8) % 4}`;
    const iv = (RG.data.heroes[h.heroId] || {}).interval || 1;
    if (h.cd > 0 && h.cd <= Math.max(0.2, iv * 0.35)) return 'aim';
    return Math.floor(time * 1.25 + h.id * 0.3) % 2 ? 'idle1' : 'idle0';
  }

  /* ---------------- 탑 ---------------- */
  function drawTower(t) {
    const cx = X(t.x);
    const baseY = Y(t.r + 0.82);
    const w = T;
    const h = T * 1.3;
    let sy = 1;
    if (t.anim > 0) sy = 1 - 0.025 * (t.anim / 0.25); // 쏠 때 아주 살짝 눌림 (동작은 그림 자세가 맡음)
    const pose = towerPose(t);
    const key = poseSprite(RG.art.sprites.towerKey(t.type, t.level, t.branch, pose), RG.art.sprites.towerKey(t.type, t.level, t.branch, 'idle'),
      () => RG.art.tower(t.type, t.level, t.branch, pose), RG.art.sprites.TW, RG.art.sprites.TH);
    if (!shadeBaked) castShadow(key, cx, baseY, w, h, 0.5, 112 / 130, false, t.building ? 0.2 : 0.42);
    ctx.save();
    if (t.building) ctx.globalAlpha = 0.55;
    if (sy !== 1) { ctx.translate(cx, baseY); ctx.scale(1 + (1 - sy) * 0.5, sy); ctx.translate(-cx, -baseY); }
    const ok = sprite(key, cx, baseY, w, h, 0.5, 112 / 130, false);
    if (!ok) {
      ctx.fillStyle = elColor(RG.data.towers[t.type].element);
      ctx.fillRect(cx - T * 0.3, baseY - T * 0.7, T * 0.6, T * 0.7);
    }
    ctx.restore();
    if (t.disabled) {
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = t.silenced ? '#6a6380' : '#bfe8ff';
      ctx.beginPath(); ctx.ellipse(cx, baseY - T * 0.35, T * 0.42, T * 0.55, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      icon(t.silenced ? 'silence' : 'freeze', cx, baseY - T * 1.0, T * 0.4);
      ctx.restore();
    } else if (t.dampened) {
      icon('dampen', cx + T * 0.32, baseY - T * 0.95, T * 0.3);
    }
    if (t.building) {
      const k = 1 - Math.max(0, t.buildUntil - game.state.time) / game.rules.buildTime;
      ctx.save();
      ctx.strokeStyle = '#ffe68a';
      ctx.lineWidth = Math.max(2, T * 0.06);
      ctx.beginPath(); ctx.arc(cx, baseY - T * 0.4, T * 0.3, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k); ctx.stroke();
      ctx.restore();
    }
    if (overlay.selectedTower === t.id) {
      ctx.save();
      ctx.strokeStyle = '#fff3c4';
      ctx.lineWidth = Math.max(2, T * 0.05);
      ctx.beginPath(); ctx.ellipse(cx, baseY, T * 0.46, T * 0.18, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
  }

  const iconCache = new Map();
  function icon(name, cx, cy, size) {
    let img = iconCache.get(name);
    if (!img && RG.art.icon) {
      img = new Image();
      img.src = RG.art.sprites.dataUrl(RG.art.sprites.sized(RG.art.icon(name), 64, 64));
      iconCache.set(name, img);
    }
    if (img && img.complete && img.naturalWidth) ctx.drawImage(img, cx - size / 2, cy - size / 2, size, size);
  }

  /* ---------------- 울림등 ---------------- */
  function drawLantern() {
    const st = game.state;
    const L = game.map.lantern;
    const ratio = st.lives / st.maxLives;
    const cx = X(L.x);
    const baseY = Y(L.r + 0.82);
    ctx.save();
    const glow = ctx.createRadialGradient(cx, baseY - T * 0.7, 2, cx, baseY - T * 0.7, T * (0.6 + ratio * 0.9));
    glow.addColorStop(0, `rgba(255,236,170,${0.25 + 0.35 * ratio + 0.05 * Math.sin(time * 3)})`);
    glow.addColorStop(1, 'rgba(255,220,140,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(cx, baseY - T * 0.7, T * (0.6 + ratio * 0.9), 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    castShadow(RG.art.sprites.lanternKey(ratio), cx, baseY, T, T * 1.3, 0.5, 112 / 130, false, 0.42);
    sprite(RG.art.sprites.lanternKey(ratio), cx, baseY, T, T * 1.3, 0.5, 112 / 130, false);
  }

  /* ---------------- 죽는 연출 (docs/design/animation.md §2.5) ---------------- */
  let corpses = [];
  const DEATH_FX = {
    mist: ['#c9c3d6', 14, 1.6, 0.7, 0.08, -0.6], shatter: ['#dfeef5', 12, 3, 0.5, 0.06, 3], burst: ['#b5d86a', 16, 3, 0.5, 0.07, 1],
    spores: ['#d8e48a', 18, 1.4, 0.9, 0.06, -0.4], ash: ['#5a5560', 14, 1.2, 0.8, 0.07, -0.5], splash: ['#7cc8f0', 16, 2.6, 0.5, 0.06, 3],
    sparks: ['#ffe066', 14, 3.2, 0.4, 0.05, 0], crumble: ['#9c8f7c', 14, 2, 0.6, 0.07, 3.5], feathers: ['#e8e4f0', 10, 1.2, 1.0, 0.07, 0.6],
    embers: ['#ff9a3c', 14, 2, 0.7, 0.06, -0.8],
  };
  /** 게임 화면이 이벤트를 넘겨줌 (js/ui/game.js) */
  function onEvents(events) {
    for (const ev of events) {
      if (ev.type !== 'kill' || !ev.enemyType) continue;
      const mo = (RG.art.ENEMY_MOTION && RG.art.ENEMY_MOTION[ev.enemyType]) || {};
      const ed = RG.data.enemies[ev.enemyType] || {};
      const dur = mo.deathTime || (ed.boss ? 1.2 : 0.7);
      if (corpses.length > 60) corpses.shift();
      corpses.push({ type: ev.enemyType, x: ev.x, y: ev.y, dir: ev.dir || 1, size: ev.size || ed.size || 0.7, flying: !!ev.flying, hover: mo.hover != null ? mo.hover : 0.42, t: 0, dur });
      const fx = DEATH_FX[mo.deathFx];
      if (fx) RG.fx.burst(ev.x, ev.y - (ev.size || 0.7) * 0.35, fx[0], ed.boss ? fx[1] * 3 : fx[1], fx[2], fx[3], fx[4], fx[5]);
    }
  }
  function drawCorpse(c) {
    const k = c.t / c.dur;
    const frame = k < 0.3 ? 'die0' : k < 0.62 ? 'die1' : 'die2';
    const alpha = k > 0.7 ? Math.max(0, 1 - (k - 0.7) / 0.3) : 1;
    const size = c.size * T;
    const cx = X(c.x);
    const groundY = Y(c.y);
    const lift = c.flying ? c.hover * T * Math.max(0, 1 - k / 0.6) : 0; // 비행 적은 떨어짐
    const big = (RG.data.enemies[c.type] || {}).size >= 1.4 ? 288 : 168;
    const key = poseSprite(RG.art.sprites.enemyKey(c.type, frame), RG.art.sprites.enemyKey(c.type, 'walk0'), () => RG.art.enemy(c.type, frame), big, big);
    if (!manyEnemies) castShadow(key, cx, groundY, size, size, 0.5, 0.9, c.dir < 0, 0.22 * alpha, lift);
    sprite(key, cx, groundY - lift, size, size, 0.5, 0.9, c.dir < 0, alpha);
  }

  /* ---------------- 적 ---------------- */
  function enemyScreen(e, alpha) {
    const x = lerp(e.px, e.x, alpha);
    const y = lerp(e.py, e.y, alpha);
    return { x, y };
  }

  function drawEnemy(e, alpha) {
    const st = game.state;
    const ed = RG.data.enemies[e.type];
    const { x, y } = enemyScreen(e, alpha);
    const size = e.size * T;
    const cx = X(x);
    let cy = Y(y);
    if (e.burrowed) {
      ctx.save();
      ctx.fillStyle = '#b68b5c';
      ctx.strokeStyle = '#3a2716';
      ctx.lineWidth = Math.max(1, T * 0.03);
      ctx.beginPath(); ctx.ellipse(cx, cy, size * 0.45, size * 0.2, 0, Math.PI, 0); ctx.fill(); ctx.stroke();
      ctx.restore();
      return;
    }
    const frozen = st.time < e.ccUntil && e.ccKind === 'freeze';
    const lifted = st.time < e.ccUntil && e.ccKind === 'lift';
    const moving = !e.blockedBy && !(st.time < e.ccUntil) ;
    const frame = enemyFrame(e, moving);
    // 몬스터별 움직임 (그림 파일의 MOTION, docs/design/animation.md §2.5)
    const mo = (RG.art.ENEMY_MOTION && RG.art.ENEMY_MOTION[e.type]) || {};
    const stride = 0.45 + e.size * 0.55;
    const ph = e.flying ? time * 5 + e.id : (e.walkT / stride) * Math.PI * 2;
    let lift = 0;
    let rot = 0;
    let sxk = 1;
    let syk = 1;
    let dx = 0;
    if (e.flying) lift = T * (mo.hover != null ? mo.hover : 0.42) + Math.sin(time * 4 + e.id) * T * 0.04;
    else if (moving) {
      if (mo.hop) lift = Math.pow(Math.max(0, Math.sin(ph / 2)), 0.7) * mo.hop * T;
      else lift = Math.abs(Math.sin(ph)) * (mo.bob != null ? mo.bob : 0.05) * T;
      if (mo.tilt && !manyEnemies) rot = Math.sin(ph) * mo.tilt * Math.PI / 180; // 기울인 그림은 그리기 비용이 커서, 적이 아주 많을 땐 생략
      if (mo.sway) dx = Math.sin(ph / 2) * mo.sway * T;
    }
    if (mo.squash) { syk = 1 + Math.sin(ph * (moving || e.flying ? 1 : 0.3) + (moving ? 0 : time * 2)) * mo.squash; sxk = 1 / syk; }
    if (lifted) lift += T * 0.35 + Math.sin(time * 10) * T * 0.04;
    const groundY = cy;
    cy -= lift;
    const alphaS = (e.stealth && !e.revealed) ? 0.35 + 0.1 * Math.sin(time * 6) : 1;
    const hurt = st.time - e.lastHurt < 0.08;
    const flip = e.dir < 0;
    const big = ed.size >= 1.4 ? 288 : 168;
    const k0 = ekey(e.type, frame);
    const key = RG.art.sprites.get(k0) ? k0 : poseSprite(k0, ekey(e.type, 'walk0'), () => RG.art.enemy(e.type, frame), big, big);
    if (!manyEnemies || ed.boss || ed.size >= 1.4) castShadow(key, cx + dx, groundY, size, size, 0.5, 0.9, flip, (e.flying ? 0.16 : 0.32) * alphaS, lift);
    const motion = rot || sxk !== 1 || syk !== 1 || dx;
    if (motion) { ctx.save(); ctx.translate(cx + dx, cy); ctx.rotate(rot); ctx.scale(sxk, syk); ctx.translate(-cx, -cy); }
    const ok = sprite(key, cx, cy, size, size, 0.5, 0.9, flip, alphaS);
    if (!ok) {
      ctx.fillStyle = '#9a94a8';
      ctx.beginPath(); ctx.arc(cx, cy - size * 0.4, size * 0.35, 0, Math.PI * 2); ctx.fill();
    }
    if (hurt && ok) {
      ctx.save();
      ctx.globalAlpha = 0.45 * alphaS;
      ctx.globalCompositeOperation = 'lighter';
      sprite(key, cx, cy, size, size, 0.5, 0.9, flip, 1);
      ctx.restore();
    }
    if (motion) ctx.restore();
    // 상태 표시
    const top = cy - size * 0.92;
    if (frozen) {
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#bfefff';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(cx - size * 0.42, cy - size * 0.85, size * 0.84, size * 0.82, size * 0.1) : ctx.rect(cx - size * 0.42, cy - size * 0.85, size * 0.84, size * 0.82);
      ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    if (st.time < e.ccUntil && e.ccKind === 'stun') {
      ctx.save();
      ctx.fillStyle = '#ffe066';
      for (let i = 0; i < 3; i++) {
        const a = time * 6 + (i * Math.PI * 2) / 3;
        ctx.beginPath(); ctx.arc(cx + Math.cos(a) * size * 0.3, top - 2 + Math.sin(a) * size * 0.08, Math.max(1.5, T * 0.04), 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
    if (st.time < e.ccUntil && e.ccKind === 'root') {
      ctx.save();
      ctx.strokeStyle = '#d14fc0';
      ctx.lineWidth = Math.max(1.5, T * 0.04);
      ctx.beginPath(); ctx.ellipse(cx, Y(y), size * 0.4, size * 0.14, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    if (e.shield > 0) {
      ctx.save();
      ctx.globalAlpha = 0.3 + 0.15 * Math.sin(time * 4 + e.id);
      ctx.strokeStyle = '#bfe8ff';
      ctx.fillStyle = 'rgba(160,215,255,0.18)';
      ctx.lineWidth = Math.max(1.5, T * 0.035);
      ctx.beginPath(); ctx.ellipse(cx, cy - size * 0.42, size * 0.5, size * 0.52, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    if (st.time < e.st.slowUntil && !frozen) {
      ctx.save();
      ctx.strokeStyle = 'rgba(140,220,255,0.8)';
      ctx.lineWidth = Math.max(1, T * 0.03);
      ctx.beginPath(); ctx.ellipse(cx, Y(y) + 1, size * 0.36, size * 0.12, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    if (e.st.burns.length && Math.random() < 0.3) RG.fx.burst(x + (Math.random() - 0.5) * e.size * 0.6, y - e.size * 0.5, RG.fx.colorOf(e.st.burns[0].element), 1, 0.5, 0.45, 0.05, -1.6);
    if (e.st.curse && st.time < e.st.curse.until) icon('curse', cx + size * 0.38, top + 2, Math.max(10, T * 0.26));
    // 체력 막대
    const showBar = e.hp < e.maxHp || e.shield > 0 || ed.elite || ed.boss || overlay.selectedEnemy === e.id;
    if (showBar) {
      const bw = Math.max(18, size * (ed.boss ? 1.1 : 0.85));
      bar(cx, top - Math.max(4, T * 0.12), bw, e.hp / e.maxHp, ed.boss ? '#ff5f6d' : '#7ee36a', e.maxShield ? e.shield / e.maxHp : 0, ed.elite && !ed.boss);
    }
    if (overlay.selectedEnemy === e.id) {
      ctx.save();
      ctx.strokeStyle = '#ffe68a';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(cx, Y(y), size * 0.5, size * 0.18, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
  }

  /* ---------------- 유닛 ---------------- */
  function drawUnit(u, alpha) {
    const st = game.state;
    if (u.dead) return;
    const x = lerp(u.px, u.x, alpha);
    const y = lerp(u.py, u.y, alpha);
    const cx = X(x);
    const cy = Y(y);
    const flip = u.dir < 0;
    if (u.kind === 'hero') {
      const moving = u.walking;
      const pose = heroPose(u, moving);
      const size = T * 0.95;
      const bob = moving ? Math.abs(Math.sin(time * 9)) * T * 0.04 : Math.sin(time * 2.2) * T * 0.012;
      if (overlay.heroSelected) {
        ctx.save();
        ctx.strokeStyle = '#ffe68a';
        ctx.lineWidth = Math.max(2, T * 0.05);
        ctx.beginPath(); ctx.ellipse(cx, cy, T * 0.42, T * 0.16, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }
      const hk = poseSprite(RG.art.sprites.heroKey(u.heroId, pose), RG.art.sprites.heroKey(u.heroId, 'idle0'), () => RG.art.hero(u.heroId, pose), 160, 160);
      castShadow(hk, cx, cy, size, size, 0.5, 0.9, flip, 0.32, bob);
      sprite(hk, cx, cy - bob, size, size, 0.5, 0.9, flip, 1);
      if (u.stunUntil > st.time) icon('stun', cx, cy - size * 1.0, T * 0.3);
      bar(cx, cy - size * 0.98, Math.max(22, T * 0.8), u.hp / u.maxHp, '#6fd3ff', 0, false);
      // 레벨
      ctx.save();
      ctx.font = `800 ${Math.max(9, Math.round(T * 0.22))}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#1c1426';
      ctx.fillStyle = '#ffe68a';
      const lx = cx - Math.max(22, T * 0.8) / 2 - T * 0.12;
      ctx.strokeText(String(u.level), lx, cy - size * 0.9);
      ctx.fillText(String(u.level), lx, cy - size * 0.9);
      ctx.restore();
      return;
    }
    if (u.kind === 'soldier') {
      const size = T * 0.62;
      const walking = (Math.abs(u.x - u.px) + Math.abs(u.y - u.py)) > 0.001;
      const pose = u.attackAnim > 0.1 ? 'attack' : u.engaged && u.cd <= 0.3 ? 'aim' : walking ? (Math.floor(time * 6 + u.id) % 2 ? 'walk1' : 'walk0') : 'idle';
      const bob = walking ? Math.abs(Math.sin(time * 10 + u.id)) * T * 0.03 : 0;
      const look = u.look || 'stone_soldier';
      const uk = poseSprite(RG.art.sprites.unitKey(look, pose), RG.art.sprites.unitKey(look, 'idle'), () => RG.art.unit(look, pose), 128, 128);
      castShadow(uk, cx, cy, size, size, 0.5, 0.9, flip, 0.3, bob);
      sprite(uk, cx, cy - bob, size, size, 0.5, 0.9, flip, 1);
      if (u.hp < u.maxHp) bar(cx, cy - size * 1.0, Math.max(14, T * 0.5), u.hp / u.maxHp, '#b8e986', 0, false);
      return;
    }
    if (u.kind === 'wall') {
      const size = T * 1.0;
      sprite(RG.art.sprites.unitKey('rock_wall', 'idle'), cx, cy + T * 0.1, size, size, 0.5, 0.9, false, 1);
      bar(cx, cy - size * 0.8, Math.max(20, T * 0.7), u.hp / u.maxHp, '#b8e986', 0, false);
      return;
    }
    if (u.kind === 'drone') {
      const size = T * 0.6;
      const hover = Math.sin(time * 5) * T * 0.05;
      shadow(x, y, 0.2, 0.07, 0.25);
      const dp = u.cd > u.interval - 0.15 ? 'attack' : u.cd < 0.25 ? 'aim' : 'idle';
      sprite(poseSprite(RG.art.sprites.unitKey('drone', dp), RG.art.sprites.unitKey('drone', 'idle'), () => RG.art.unit('drone', dp), 128, 128), cx, cy - T * 0.5 + hover, size, size, 0.5, 0.6, false, 1);
    }
  }

  /* ---------------- 투사체·광선 ---------------- */
  /*
   * 쏘는 곳: 그림의 활 끝·포구·수정 끝(RG.art.TOWER_MUZZLE, 기준점에서 칸 단위).
   * 규칙(시뮬레이션)은 탑 가운데에서 쏘므로, 그림에서만 처음 잠깐 쏘는 곳에서 나오게 보정하고 곧 규칙 위치로 합칩니다.
   */
  const projStart = new Map(); // 투사체 id → { ox, oy, born }
  function muzzleOf(t) {
    const m = RG.art.TOWER_MUZZLE && RG.art.TOWER_MUZZLE[t.type];
    if (!m) return null;
    const o = m[t.level >= 4 ? (t.branch === 'B' ? 4 : 3) : Math.max(0, (t.level || 1) - 1)] || m[0];
    return { x: t.x + o[0], y: t.r + 0.82 + o[1] };
  }
  function muzzleOffset(p, st) {
    const tw = p.src && p.src.tower;
    if (!tw) return null;
    let o = projStart.get(p.id);
    if (!o) {
      const mz = muzzleOf(tw);
      if (!mz) return null;
      const y0 = tw.y - (p.kind === 'shell' || p.kind === 'orb' ? 0.4 : 0.35);
      o = { ox: mz.x - tw.x, oy: mz.y - y0, born: st.time };
      projStart.set(p.id, o);
    }
    const k = p.kind === 'shell' ? Math.min(1, p.t / Math.max(0.05, p.flight * 0.45)) : Math.min(1, Math.max(0, st.time - o.born) / 0.22);
    const w = 1 - k * k * (3 - 2 * k);
    return w > 0 ? { x: o.ox * w, y: o.oy * w } : null;
  }

  function drawProjectiles(alpha) {
    const st = game.state;
    ctx.save();
    if (projStart.size > st.projectiles.length * 2 + 64) {
      const live = new Set(st.projectiles.map((q) => q.id));
      for (const id of projStart.keys()) if (!live.has(id)) projStart.delete(id);
    }
    for (const p of st.projectiles) {
      let x = lerp(p.px, p.x, alpha);
      let y = lerp(p.py, p.y, alpha);
      const mo = muzzleOffset(p, st);
      if (mo) { x += mo.x; y += mo.y; }
      const col = RG.fx.colorOf(p.element);
      const sx = X(x);
      const sy = Y(y);
      if (p.kind === 'shell') {
        const h = (p.h || 0) * T;
        shadow(x, y + 0.1, 0.12, 0.05, 0.3);
        ctx.fillStyle = '#2a2230';
        ctx.beginPath(); ctx.arc(sx, sy - h, Math.max(3, T * 0.12), 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = col;
        ctx.globalAlpha = 0.8;
        ctx.beginPath(); ctx.arc(sx, sy - h, Math.max(2, T * 0.07), 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
        continue;
      }
      const dx = p.x - p.px;
      const dy = p.y - p.py;
      const L = Math.hypot(dx, dy) || 1;
      if (p.kind === 'arrow' || (p.kind === 'heroShot' && (p.heroId === 'sio'))) {
        const len = T * 0.36;
        ctx.strokeStyle = '#5a3d22';
        ctx.lineWidth = Math.max(1.5, T * 0.04);
        ctx.beginPath(); ctx.moveTo(sx - (dx / L) * len, sy - (dy / L) * len); ctx.lineTo(sx, sy); ctx.stroke();
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(sx, sy, Math.max(2, T * 0.06), 0, Math.PI * 2); ctx.fill();
        continue;
      }
      if (p.kind === 'gust') {
        ctx.strokeStyle = 'rgba(240,240,255,0.9)';
        ctx.lineWidth = Math.max(1.5, T * 0.04);
        ctx.beginPath(); ctx.arc(sx, sy, T * 0.12, time * 12, time * 12 + 4.5); ctx.stroke();
        continue;
      }
      if (p.kind === 'orb') {
        ctx.fillStyle = '#1a0820';
        ctx.strokeStyle = '#d14fc0';
        ctx.lineWidth = Math.max(1.5, T * 0.04);
        ctx.beginPath(); ctx.arc(sx, sy, T * 0.15, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        continue;
      }
      // bolt / heroShot
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, T * 0.16);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.4, col);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(sx, sy, T * 0.16, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = col;
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = Math.max(1, T * 0.05);
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx - (dx / L) * T * 0.3, sy - (dy / L) * T * 0.3); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // 광선
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (const b of st.beams) {
      const k = (b.mult - 1) / Math.max(0.01, b.max - 1);
      const bt = st.towers.find((q) => q.id === b.towerId);
      const mz = bt && muzzleOf(bt);
      const bx = mz ? mz.x : b.x1;
      const by = mz ? mz.y : b.y1;
      ctx.strokeStyle = 'rgba(255,214,110,0.55)';
      ctx.lineWidth = Math.max(2, T * (0.06 + 0.14 * k));
      ctx.beginPath(); ctx.moveTo(X(bx), Y(by)); ctx.lineTo(X(b.x2), Y(b.y2) - T * 0.3); ctx.stroke();
      ctx.strokeStyle = '#fffbe8';
      ctx.lineWidth = Math.max(1, T * (0.02 + 0.05 * k));
      ctx.stroke();
    }
    ctx.restore();
  }

  /* ---------------- 보스 경고 ---------------- */
  function drawAlerts() {
    const st = game.state;
    for (const a of st.alerts) {
      for (const id of a.towerIds) {
        const t = st.towers.find((q) => q.id === id);
        if (!t) continue;
        const k = Math.max(0, (a.at - st.time) / RG.data.rules.bossWarn);
        ctx.save();
        ctx.globalAlpha = 0.5 + 0.5 * Math.abs(Math.sin(time * 10));
        ctx.strokeStyle = '#ff5a5a';
        ctx.lineWidth = Math.max(2, T * 0.06);
        ctx.beginPath(); ctx.arc(X(t.x), Y(t.y), T * (0.45 + 0.2 * k), 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = '#ff5a5a';
        ctx.font = `900 ${Math.max(12, Math.round(T * 0.5))}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('!', X(t.x), Y(t.y) - T * 0.85);
        ctx.restore();
      }
    }
  }

  /* ---------------- 한 프레임 ---------------- */
  function frame(alpha, dt) {
    if (!game || !ctx) return;
    time += dt;
    RG.fx.update(dt);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const base = REGION_BASE[game.map.def.region] || '#556';
    const g0 = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.2, W / 2, H / 2, Math.max(W, H) * 0.75);
    g0.addColorStop(0, RG.art._h.mix(base, '#141019', 0.55));
    g0.addColorStop(1, '#0d0a12');
    ctx.fillStyle = g0;
    ctx.fillRect(0, 0, W, H);
    // 맵 테두리
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(X(0) - 4, Y(0) - 4, game.map.cols * T + 8, game.map.rows * T + 8);
    ctx.strokeStyle = 'rgba(233,196,122,0.55)';
    ctx.lineWidth = 2;
    ctx.strokeRect(X(0) - 3, Y(0) - 3, game.map.cols * T + 6, game.map.rows * T + 6);
    const [sx, sy] = RG.fx.shakeOffset(T);
    ctx.save();
    ctx.translate(sx, sy);
    drawBackground();
    drawPortals();
    drawZones();
    drawPathPreview();
    drawOverlayUnder();
    drawLinks();
    RG.fx.drawUnder(ctx, X, Y, T);

    const st = game.state;
    // 그림자
    if (!shadeBaked) for (const t of st.towers) shadow(t.x, t.r + 0.8, 0.36, 0.12, 0.28);
    let alive = 0;
    for (const e of st.enemies) if (!e.dead) alive++;
    manyEnemies = alive > 60;
    if (manyEnemies) {
      // 적이 아주 많을 때: 발밑 그늘을 한 경로로 모아 한 번에 칠함 (땅·비행 두 번)
      for (const fly of [false, true]) {
        ctx.beginPath();
        for (const e of st.enemies) {
          if (e.burrowed || !!e.flying !== fly) continue;
          const p = enemyScreen(e, alpha);
          const ex = X(p.x) + T * 0.03;
          const ey = Y(p.y) + T * 0.01;
          const rx = Math.max(2, e.size * 0.32 * T);
          ctx.moveTo(ex + rx, ey);
          ctx.ellipse(ex, ey, rx, Math.max(1, e.size * 0.11 * T), 0, 0, Math.PI * 2);
        }
        ctx.fillStyle = fly ? 'rgba(12,7,20,0.22)' : 'rgba(12,7,20,0.36)';
        ctx.fill();
      }
    } else {
      for (const e of st.enemies) {
        if (e.burrowed) continue;
        const p = enemyScreen(e, alpha);
        shadow(p.x, p.y, e.size * 0.32, e.size * 0.11, e.flying ? 0.18 : 0.3);
      }
    }
    for (const u of st.units) if (!u.dead && u.kind !== 'drone') shadow(lerp(u.px, u.x, alpha), lerp(u.py, u.y, alpha), u.kind === 'wall' ? 0.45 : 0.22, 0.08, 0.3);

    // y 순서로
    const list = [];
    for (const t of st.towers) list.push([t.r + 0.82, 0, t]);
    list.push([game.map.lantern.r + 0.82, 1, null]);
    for (const e of st.enemies) if (!e.flying) list.push([lerp(e.py, e.y, alpha), 2, e]);
    for (const u of st.units) if (!u.dead) list.push([lerp(u.py, u.y, alpha), 3, u]);
    for (const c of corpses) c.t += dt;
    corpses = corpses.filter((c) => c.t < c.dur);
    for (const c of corpses) list.push([c.y - 0.001, 4, c]);
    list.sort((a, b) => a[0] - b[0]);
    for (const [, kind, obj] of list) {
      if (kind === 0) drawTower(obj);
      else if (kind === 1) drawLantern();
      else if (kind === 2) drawEnemy(obj, alpha);
      else if (kind === 4) drawCorpse(obj);
      else drawUnit(obj, alpha);
    }
    // 비행 적은 위에
    const flyers = st.enemies.filter((e) => e.flying).sort((a, b) => a.y - b.y);
    for (const e of flyers) drawEnemy(e, alpha);
    // 건설 미리보기 탑 그림
    const gh = overlay.ghost;
    if (gh) {
      ctx.save();
      ctx.globalAlpha = 0.65;
      sprite(RG.art.sprites.towerKey(gh.type, 1, null, 'idle'), X(gh.c + 0.5), Y(gh.r + 0.82), T, T * 1.3, 0.5, 112 / 130, false);
      ctx.restore();
    }
    drawProjectiles(alpha);
    RG.fx.draw(ctx, X, Y, T);
    drawAlerts();
    RG.fx.drawTexts(ctx, X, Y, T);
    ctx.restore();
  }

  return { attach, detach, resize, frame, onEvents, muzzleOf, setShadows: (on) => { shadowsOn = !!on; }, screenToWorld, worldToScreen, overlay, tileSize, get T() { return T; } };
})();
