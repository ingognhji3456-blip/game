'use strict';

/* =========================================================
 * 전투 화면 그리기 — 배경, 바닥, 경고 표시, 엔티티, 투사체, 화면 효과, 전투 HUD
 * 논리 해상도 1280×720. 월드 y 는 0.62 배로 눌러 비스듬한 시점을 만듭니다.
 * ========================================================= */
window.AZ = window.AZ || {};
AZ.gfx = AZ.gfx || {};

AZ.gfx.render = (() => {
  const U = AZ.util;
  const VW = 1280;
  const VH = 720;
  const YS = 0.62;
  const FONT = '"Pretendard","Noto Sans KR","Apple SD Gothic Neo","Malgun Gothic",sans-serif';
  const FX = () => AZ.gfx.fx;

  const cam = { x: 0, y: 0, zoom: 1, sx: 0, sy: 0 };
  let floorCache = null;
  const skyCache = {};
  let buttons = [];
  let touchMode = false;
  let hudState = { bossHpTrail: 1, hpTrail: 1, comboPop: 0, lastCombo: 0, focusFull: 0 };
  const ghosts = [];
  const skip = {};

  /* ───────────── 테마 ───────────── */
  const THEMES = {
    ruins: { sky: ['#05060f', '#141a3a', '#2c2f63'], moon: '#bcd4ff', moonR: 120, city: '#121733', city2: '#1c2348', win: '#7aa6ff', floor: ['#1a2036', '#0e1222'], grid: 'rgba(110,170,255,0.10)', edge: '#5fa8ff', ash: true },
    city: { sky: ['#06030f', '#1c0f3a', '#3b1c5c'], moon: '#ffd0f0', moonR: 70, city: '#140d2a', city2: '#21153f', win: '#ff7ad9', win2: '#66e0ff', floor: ['#1b1830', '#0d0b1a'], grid: 'rgba(255,122,217,0.08)', edge: '#ff7ad9', neon: true },
    lab: { sky: ['#020a0c', '#062026', '#0b3a40'], moon: null, city: '#06181c', city2: '#0a242a', win: '#5ff7e0', floor: ['#16282c', '#0a1518'], grid: 'rgba(95,247,224,0.13)', edge: '#5ff7e0', indoor: true },
    highway: { sky: ['#0d0206', '#3a0a18', '#6e1a26'], moon: '#ff9a8a', moonR: 140, city: '#1c070d', city2: '#2c0d16', win: '#ff5470', floor: ['#221418', '#120a0c'], grid: 'rgba(255,84,112,0.10)', edge: '#ff5470', lanes: true },
    sky: { sky: ['#030818', '#0d2a5a', '#3a76b8'], moon: '#ffffff', moonR: 50, city: '#0e2448', city2: '#173866', win: '#bfe6ff', floor: ['#1c2a40', '#0e1626'], grid: 'rgba(160,210,255,0.12)', edge: '#9ad8ff', clouds: true, hex: true },
    archive: { sky: ['#06030f', '#1a0b33', '#341a5e'], moon: '#e2d4ff', moonR: 90, city: '#140a28', city2: '#20113c', win: '#c9a4ff', floor: ['#1d1533', '#0e0a1c'], grid: 'rgba(201,164,255,0.12)', edge: '#c9a4ff', cubes: true },
    skyport: { sky: ['#0a0414', '#3a1440', '#c0563a'], moon: '#ffd6a0', moonR: 110, city: '#1a0b1e', city2: '#2a1230', win: '#ffb35c', floor: ['#241a26', '#120c14'], grid: 'rgba(255,179,92,0.10)', edge: '#ffb35c', pad: true },
    warfront: { sky: ['#0c0303', '#3a0c06', '#7a2410'], moon: '#ff7a3d', moonR: 160, city: '#1a0806', city2: '#2a0e08', win: '#ff7a3d', floor: ['#241612', '#120a08'], grid: 'rgba(255,122,61,0.09)', edge: '#ff7a3d', ash: true, fire: true },
    core: { sky: ['#020610', '#0a1a33', '#12305a'], moon: null, city: '#081428', city2: '#0e2040', win: '#66e0ff', floor: ['#0f1c30', '#070e1a'], grid: 'rgba(102,224,255,0.16)', edge: '#66e0ff', circuit: true },
    void: { sky: ['#000004', '#070418', '#140a33'], moon: '#9ad8ff', moonR: 220, city: null, city2: null, win: '#ffffff', floor: ['#121a33', '#070a18'], grid: 'rgba(154,216,255,0.13)', edge: '#bfe6ff', rings: true, crystal: true },
  };

  /* ───────────── 오프스크린 캔버스 ───────────── */
  function makeCanvas(w, h) {
    if (typeof document === 'undefined') return null;
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function seeded(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** 하늘 + 원경 도시 (화면 크기) */
  function getSky(theme, scale) {
    const k = scale || 1;
    const key = theme + '@' + k.toFixed(3);
    if (skyCache[key]) return skyCache[key];
    const T = THEMES[theme] || THEMES.ruins;
    const c = makeCanvas(VW * 1.4 * k, VH * k);
    if (!c) return null;
    const g = c.getContext('2d');
    g.scale(k, k);
    const w = VW * 1.4;
    const grd = g.createLinearGradient(0, 0, 0, VH);
    grd.addColorStop(0, T.sky[0]);
    grd.addColorStop(0.55, T.sky[1]);
    grd.addColorStop(1, T.sky[2]);
    g.fillStyle = grd;
    g.fillRect(0, 0, w, VH);
    const rnd = seeded(theme.length * 977 + 13);
    // 별
    for (let i = 0; i < 260; i++) {
      const x = rnd() * w;
      const y = rnd() * VH * 0.6;
      const a = rnd() * 0.8 + 0.1;
      g.fillStyle = `rgba(220,235,255,${a})`;
      const s = rnd() < 0.08 ? 2 : 1;
      g.fillRect(x, y, s, s);
    }
    // 달/행성
    if (T.moon) {
      const mx = w * 0.72;
      const my = VH * 0.2;
      const r = T.moonR;
      const glow = g.createRadialGradient(mx, my, r * 0.6, mx, my, r * 2.4);
      glow.addColorStop(0, FX().colorA(T.moon, 0.35));
      glow.addColorStop(1, FX().colorA(T.moon, 0));
      g.fillStyle = glow;
      g.beginPath();
      g.arc(mx, my, r * 2.4, 0, U.TAU);
      g.fill();
      const body = g.createRadialGradient(mx - r * 0.4, my - r * 0.4, r * 0.1, mx, my, r);
      body.addColorStop(0, '#ffffff');
      body.addColorStop(0.5, T.moon);
      body.addColorStop(1, FX().colorA(T.sky[1], 1));
      g.fillStyle = body;
      g.beginPath();
      g.arc(mx, my, r, 0, U.TAU);
      g.fill();
      // 크레이터
      g.globalAlpha = 0.12;
      for (let i = 0; i < 14; i++) {
        g.fillStyle = '#1a2040';
        g.beginPath();
        g.arc(mx + (rnd() - 0.5) * r * 1.4, my + (rnd() - 0.5) * r * 1.4, rnd() * r * 0.18 + 3, 0, U.TAU);
        g.fill();
      }
      g.globalAlpha = 1;
      if (T.rings) {
        g.strokeStyle = 'rgba(190,230,255,0.45)';
        g.lineWidth = 3;
        for (let i = 0; i < 3; i++) {
          g.beginPath();
          g.ellipse(mx, my, r * (1.6 + i * 0.25), r * (0.28 + i * 0.05), -0.25, 0, U.TAU);
          g.stroke();
        }
      }
    }
    if (T.clouds) {
      for (let i = 0; i < 40; i++) {
        const x = rnd() * w;
        const y = VH * 0.55 + rnd() * VH * 0.4;
        const r = 40 + rnd() * 120;
        const cg = g.createRadialGradient(x, y, 0, x, y, r);
        cg.addColorStop(0, 'rgba(200,225,255,0.18)');
        cg.addColorStop(1, 'rgba(200,225,255,0)');
        g.fillStyle = cg;
        g.beginPath();
        g.arc(x, y, r, 0, U.TAU);
        g.fill();
      }
    }
    // 원경 도시 실루엣 2겹
    const layer = (color, base, hMin, hMax, density, win) => {
      if (!color) return;
      g.fillStyle = color;
      let x = 0;
      while (x < w) {
        const bw = 20 + rnd() * 60 * density;
        const bh = hMin + rnd() * (hMax - hMin);
        g.fillRect(x, base - bh, bw, bh + 400);
        if (rnd() < 0.3) {
          g.fillRect(x + bw * 0.4, base - bh - 30 - rnd() * 40, 3, 60);
        }
        if (win) {
          g.save();
          for (let wy = base - bh + 8; wy < base - 4; wy += 9) {
            for (let wx = x + 4; wx < x + bw - 4; wx += 7) {
              if (rnd() < 0.18) {
                g.fillStyle = FX().colorA(rnd() < 0.5 || !T.win2 ? T.win : T.win2, 0.35 + rnd() * 0.5);
                g.fillRect(wx, wy, 2, 3);
              }
            }
          }
          g.restore();
          g.fillStyle = color;
        }
        x += bw + rnd() * 6;
      }
    };
    const horizon = VH * 0.62;
    if (T.indoor) {
      // 실내: 벽 패널
      g.fillStyle = T.city;
      g.fillRect(0, VH * 0.2, w, VH);
      g.strokeStyle = FX().colorA(T.win, 0.25);
      for (let x = 0; x < w; x += 90) {
        g.strokeRect(x + 6, VH * 0.26, 78, VH * 0.3);
        g.fillStyle = FX().colorA(T.win, 0.08 + rnd() * 0.1);
        g.fillRect(x + 12, VH * 0.3, 66, 8);
      }
    } else {
      layer(T.city2, horizon - 30, 60, 220, 1.2, false);
      layer(T.city, horizon, 40, 170, 1, true);
    }
    if (T.cubes) {
      for (let i = 0; i < 30; i++) {
        g.strokeStyle = `rgba(201,164,255,${0.15 + rnd() * 0.3})`;
        const s = 6 + rnd() * 26;
        g.strokeRect(rnd() * w, rnd() * VH * 0.55, s, s);
      }
    }
    if (T.fire) {
      const fg = g.createLinearGradient(0, horizon - 120, 0, horizon + 40);
      fg.addColorStop(0, 'rgba(255,90,30,0)');
      fg.addColorStop(1, 'rgba(255,90,30,0.35)');
      g.fillStyle = fg;
      g.fillRect(0, horizon - 120, w, 160);
    }
    if (T.circuit) {
      g.strokeStyle = 'rgba(102,224,255,0.18)';
      for (let i = 0; i < 40; i++) {
        let x = rnd() * w;
        let y = rnd() * VH * 0.6;
        g.beginPath();
        g.moveTo(x, y);
        for (let j = 0; j < 4; j++) {
          if (rnd() < 0.5) x += (rnd() - 0.5) * 160; else y += (rnd() - 0.5) * 100;
          g.lineTo(x, y);
        }
        g.stroke();
      }
    }
    // 같은 테마의 다른 배율은 버림 (메모리 절약)
    for (const kk of Object.keys(skyCache)) if (kk.startsWith(theme + '@') && kk !== theme + '@1.000' && kk !== key) delete skyCache[kk];
    skyCache[key] = c;
    return c;
  }

  /** 경기장 바닥 (월드 크기, 비스듬히 눌린 상태) */
  function buildFloor(W, theme, scale) {
    const T = THEMES[theme] || THEMES.ruins;
    const fw = W.w;
    const fh = Math.ceil(W.h * YS);
    const c = makeCanvas(fw * scale, fh * scale);
    if (!c) return null;
    const g = c.getContext('2d');
    g.scale(scale, scale);
    const grd = g.createLinearGradient(0, 0, 0, fh);
    grd.addColorStop(0, T.floor[1]);
    grd.addColorStop(0.35, T.floor[0]);
    grd.addColorStop(1, T.floor[1]);
    g.fillStyle = grd;
    g.fillRect(0, 0, fw, fh);
    const rnd = seeded(theme.length * 31 + W.w);
    // 바닥 무늬
    g.save();
    if (T.hex) {
      g.strokeStyle = 'rgba(160,210,255,0.07)';
      const r = 40;
      for (let y = 0; y < W.h + r; y += r * 1.5) {
        for (let x = 0; x < W.w + r; x += r * Math.sqrt(3)) {
          const ox = x + ((y / (r * 1.5)) % 2 ? (r * Math.sqrt(3)) / 2 : 0);
          g.beginPath();
          for (let i = 0; i < 6; i++) {
            const a = (i / 6) * U.TAU + Math.PI / 6;
            const px = ox + Math.cos(a) * r;
            const py = (y + Math.sin(a) * r) * YS;
            if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
          }
          g.closePath();
          g.stroke();
        }
      }
    }
    // 격자
    g.strokeStyle = T.grid;
    g.lineWidth = 1;
    for (let x = 0; x <= W.w; x += 100) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, fh);
      g.stroke();
    }
    for (let y = 0; y <= W.h; y += 100) {
      g.beginPath();
      g.moveTo(0, y * YS);
      g.lineTo(fw, y * YS);
      g.stroke();
    }
    // 테마 장식
    if (T.lanes) {
      g.strokeStyle = 'rgba(255,220,180,0.18)';
      g.setLineDash([60, 50]);
      g.lineWidth = 4;
      for (const yy of [0.33, 0.66]) {
        g.beginPath();
        g.moveTo(0, W.h * yy * YS);
        g.lineTo(fw, W.h * yy * YS);
        g.stroke();
      }
      g.setLineDash([]);
    }
    if (T.pad) {
      g.strokeStyle = 'rgba(255,179,92,0.25)';
      g.lineWidth = 6;
      g.beginPath();
      g.ellipse(fw / 2, fh / 2, 300, 300 * YS, 0, 0, U.TAU);
      g.stroke();
      g.font = `900 120px ${FONT}`;
      g.textAlign = 'center';
      g.fillStyle = 'rgba(255,179,92,0.10)';
      g.save();
      g.translate(fw / 2, fh / 2);
      g.scale(1, YS);
      g.fillText('H', 0, 40);
      g.restore();
    }
    if (T.circuit || T.crystal) {
      g.strokeStyle = T.circuit ? 'rgba(102,224,255,0.14)' : 'rgba(190,230,255,0.12)';
      g.lineWidth = 2;
      for (let i = 0; i < 70; i++) {
        let x = rnd() * W.w;
        let y = rnd() * W.h;
        g.beginPath();
        g.moveTo(x, y * YS);
        for (let j = 0; j < 3; j++) {
          if (rnd() < 0.5) x += (rnd() - 0.5) * 240; else y += (rnd() - 0.5) * 240;
          g.lineTo(x, y * YS);
        }
        g.stroke();
        g.fillStyle = g.strokeStyle;
        g.fillRect(x - 3, y * YS - 2, 6, 4);
      }
    }
    if (T.ash || theme === 'ruins' || theme === 'highway' || theme === 'warfront' || theme === 'city') {
      // 금 간 자국과 잔해
      g.strokeStyle = 'rgba(0,0,0,0.35)';
      g.lineWidth = 2;
      for (let i = 0; i < 26; i++) {
        let x = rnd() * W.w;
        let y = rnd() * W.h;
        g.beginPath();
        g.moveTo(x, y * YS);
        for (let j = 0; j < 5; j++) {
          x += (rnd() - 0.5) * 90;
          y += (rnd() - 0.5) * 90;
          g.lineTo(x, y * YS);
        }
        g.stroke();
      }
      for (let i = 0; i < 40; i++) {
        g.fillStyle = `rgba(${rnd() < 0.5 ? '60,70,95' : '30,34,50'},0.7)`;
        const x = rnd() * W.w;
        const y = rnd() * W.h * YS;
        g.beginPath();
        g.ellipse(x, y, 4 + rnd() * 14, (3 + rnd() * 8) * YS * 1.4, rnd() * 3, 0, U.TAU);
        g.fill();
      }
    }
    // 중앙 문양
    g.save();
    g.translate(fw / 2, fh / 2);
    g.scale(1, YS);
    g.strokeStyle = FX().colorA(T.edge, 0.12);
    g.lineWidth = 2;
    for (const r of [180, 260]) {
      g.beginPath();
      g.arc(0, 0, r, 0, U.TAU);
      g.stroke();
    }
    g.restore();
    g.restore();
    // 가장자리 빛
    const edge = g.createLinearGradient(0, 0, 0, 40);
    edge.addColorStop(0, FX().colorA(T.edge, 0.4));
    edge.addColorStop(1, FX().colorA(T.edge, 0));
    g.fillStyle = edge;
    g.fillRect(0, 0, fw, 40);
    g.strokeStyle = FX().colorA(T.edge, 0.85);
    g.lineWidth = 3;
    g.strokeRect(1.5, 1.5, fw - 3, fh - 3);
    // 가장자리 어둡게
    const vg = g.createRadialGradient(fw / 2, fh / 2, Math.min(fw, fh) * 0.3, fw / 2, fh / 2, Math.max(fw, fh) * 0.7);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.45)');
    g.fillStyle = vg;
    g.fillRect(0, 0, fw, fh);
    return { canvas: c, w: fw, h: fh, scale, key: theme + W.w + 'x' + W.h };
  }

  /* ───────────── 카메라 ─────────────
   * persp = true : 3D 배경과 같은 원근 카메라 (AZ.gfx.cam3d)
   * persp = false: 예전 2D 비스듬한 평행 투영 (WebGL 이 없을 때)
   * proj() → { x, y, k(월드 1 = k 픽셀), fy(바닥 세로 축소율) } */
  let persp = false;
  let curLevel = null;
  const PERSP = { pitch: 0.26, fov: 0.86 };
  function proj(x, y, z) {
    if (persp) return AZ.gfx.cam3d.project(x, y, (z || 0) + (curLevel ? AZ.level.floorZ(curLevel, x, y) : 0));
    return {
      x: (x - cam.x) * cam.zoom + VW / 2 + cam.sx,
      y: ((y - cam.y) * YS - (z || 0)) * cam.zoom + VH / 2 + cam.sy,
      k: cam.zoom, fy: YS,
    };
  }
  function setPerspCamera(tx, ty) {
    const f = 1 / Math.tan(PERSP.fov / 2);
    const lz = curLevel ? AZ.level.floorZ(curLevel, tx, ty) : 0;
    cam.lz = cam.lz == null ? lz : U.lerp(cam.lz, lz, 0.12);
    AZ.gfx.cam3d.set({ tx, ty, pitch: PERSP.pitch, yaw: 0, fov: PERSP.fov, dist: (VH / 2) * f / cam.zoom, shakeX: cam.sx, shakeY: cam.sy, lookZ: cam.lz });
  }

  function updateCamera(W, dt, snap) {
    const p = W.player;
    let tx = p.x;
    let ty = p.y;
    const focus = W.boss && !W.boss.dead ? W.boss : null;
    if (focus) {
      tx += (focus.x - p.x) * 0.32;
      ty += (focus.y - p.y) * 0.32;
    }
    const big = focus && focus.def.big;
    const sh = FX().shakeOffset();
    cam.sx = sh.x;
    cam.sy = sh.y;
    if (persp) {
      cam.zoom = (big ? 1.0 : 1.14) * (touchMode ? 0.9 : 1);
      if (W.level && !(W.boss && !W.boss.dead)) {
        // 탐색 중: 플레이어와 길 앞쪽을 함께 보도록
        const gd = AZ.level.guide(W.level, p.x, p.y, 260);
        if (gd && !(W.stage && W.stage.active)) {
          let ox = (gd.x - p.x) * 0.45;
          let oy = (gd.y - p.y) * 0.45;
          const om = Math.hypot(ox, oy);
          if (om > 200) { ox *= 200 / om; oy *= 200 / om; }
          tx = p.x + ox; ty = p.y + oy;
        }
        if (W.stage && W.stage.active) { const a = W.stage.active.area; tx = p.x * 0.6 + (a.x0 + a.x1) * 0.2; ty = p.y * 0.6 + (a.y0 + a.y1) * 0.2; }
      } else {
        tx = U.clamp(tx, Math.min(W.w / 2, 520), Math.max(W.w / 2, W.w - 520));
        ty = U.clamp(ty, W.h * 0.3, W.h * 0.78);
      }
      // 체크포인트 재시작처럼 멀리 순간 이동했으면 바로 따라붙기
      if (snap || !(Math.hypot(cam.x - tx, cam.y - ty) < 900)) { cam.x = tx; cam.y = ty; cam.lz = null; } else {
        const k = Math.min(1, dt * 5);
        cam.x = U.lerp(cam.x, tx, k);
        cam.y = U.lerp(cam.y, ty, k);
      }
      // 플레이어는 화면 안에, 거대 보스는 머리까지 보이게
      for (let i = 0; i < 3; i++) {
        setPerspCamera(cam.x, cam.y);
        const pp = proj(p.x, p.y, 0);
        if (pp.behind) { cam.x = tx; cam.y = ty; cam.lz = null; break; }
        let dy = 0;
        if (pp.y > VH - 110) dy = (pp.y - (VH - 110)) / (pp.k * pp.fy);
        else if (pp.y < 300) dy = (pp.y - 300) / (pp.k * pp.fy);
        else if (focus) {
          const H = (focus.z || 0) + focus.r * (focus.def.big ? 3.4 : 2.8);
          const top = proj(focus.x, focus.y, H);
          if (top.y < 118) dy = Math.max((top.y - 118) / (top.k * 0.8), -(VH - 110 - pp.y) / (pp.k * pp.fy));
        }
        let dx = 0;
        if (pp.x < 220) dx = (pp.x - 220) / pp.k;
        else if (pp.x > VW - 220) dx = (pp.x - (VW - 220)) / pp.k;
        if (Math.abs(dy) < 0.5 && Math.abs(dx) < 0.5) break;
        cam.y += U.clamp(dy, -220, 220);
        cam.x += U.clamp(dx, -220, 220);
      }
      setPerspCamera(cam.x, cam.y);
      return;
    }
    cam.zoom = (big ? 0.88 : 0.96) * (touchMode ? 0.92 : 1);
    const halfW = VW / 2 / cam.zoom;
    const halfH = VH / 2 / cam.zoom / YS;
    const minX = halfW - 60;
    const maxX = W.w - halfW + 60;
    tx = minX > maxX ? W.w / 2 : U.clamp(tx, minX, maxX);
    const minY = halfH - 360;
    const maxY = W.h - halfH + 120;
    ty = minY > maxY ? W.h / 2 : U.clamp(ty, minY, maxY);
    if (focus) {
      const H = (focus.z || 0) + focus.r * (focus.def.big ? 3.4 : 2.8);
      const bossLimit = focus.y - ((120 - VH / 2) / cam.zoom + H) / YS;
      const playerLimit = p.y - (VH / 2 - 100) / (YS * cam.zoom);
      if (ty > bossLimit) ty = Math.max(bossLimit, playerLimit, minY);
    }
    if (snap) { cam.x = tx; cam.y = ty; } else {
      const k = Math.min(1, dt * 5);
      cam.x = U.lerp(cam.x, tx, k);
      cam.y = U.lerp(cam.y, ty, k);
    }
  }

  /* ───────────── 스테이지: 방벽, 길 안내, 목표 ───────────── */
  function drawStageGround(g, W, t) {
    const st = W.stage;
    if (!st) return;
    // 길 안내 화살표 (전투 중이 아닐 때)
    if (!st.active && !st.bossTriggered) {
      const gd = AZ.level.guide(W.level, W.player.x, W.player.y, 900);
      if (gd) {
        const pts = gd.pts;
        let acc = 0;
        const stepD = 110;
        let next = 80 - ((t * 120) % stepD);
        for (let i = 0; i < pts.length - 1; i++) {
          const [ax, ay] = pts[i];
          const [bx, by] = pts[i + 1];
          const L = Math.hypot(bx - ax, by - ay);
          while (next < acc + L) {
            const k = (next - acc) / L;
            const x = ax + (bx - ax) * k;
            const y = ay + (by - ay) * k;
            const ang = Math.atan2(by - ay, bx - ax);
            const fade = Math.min(1, next / 200) * Math.max(0, 1 - next / 900);
            const c = (dx, dy) => proj(x + Math.cos(ang) * dx - Math.sin(ang) * dy, y + Math.sin(ang) * dx + Math.cos(ang) * dy, 2);
            const a = c(26, 0);
            const b = c(-10, 26);
            const m = c(2, 0);
            const d = c(-10, -26);
            g.save();
            g.globalCompositeOperation = 'lighter';
            g.globalAlpha = 0.55 * fade;
            g.fillStyle = '#7cf7ff';
            g.beginPath();
            g.moveTo(a.x, a.y);
            g.lineTo(b.x, b.y);
            g.lineTo(m.x, m.y);
            g.lineTo(d.x, d.y);
            g.closePath();
            g.fill();
            g.restore();
            next += stepD;
          }
          acc += L;
        }
      }
    }
    // NPC
    for (const o of st.objects || []) if (o.kind === 'npc') drawNpc(g, W, o, t);
    // 관문: 단말기를 쓰기 전까지 붉은 에너지 벽
    const gate = W.level.gate;
    if (gate) {
      if (st.gateOpen) st.gateFade = Math.max(0, (st.gateFade == null ? 1 : st.gateFade) - 0.03);
      const a = st.gateOpen ? st.gateFade : 1;
      if (a > 0.01) energyWall(g, [[gate.x0, gate.y, gate.x1, gate.y]], '#ff2f5a', 150 * (0.4 + 0.6 * a), t, a);
    }
    // 봉쇄 방벽
    const lock = st.lock;
    if (lock && (st.active || st.bossPhase || st.bossTriggered)) {
      const col = st.bossTriggered ? '#ff3d6e' : '#ff9b3d';
      const edges = [[lock.x0, lock.y0, lock.x1, lock.y0], [lock.x1, lock.y0, lock.x1, lock.y1], [lock.x1, lock.y1, lock.x0, lock.y1], [lock.x0, lock.y1, lock.x0, lock.y0]];
      energyWall(g, edges, col, 90, t, 1);
    }
  }

  /** 바닥에서 솟은 빛의 벽 */
  function energyWall(g, edges, col, h, t, alpha) {
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = alpha;
    for (const [ax, ay, bx, by] of edges) {
      const n = 10;
      for (let i = 0; i < n; i++) {
        const x0 = ax + (bx - ax) * (i / n);
        const y0 = ay + (by - ay) * (i / n);
        const x1 = ax + (bx - ax) * ((i + 1) / n);
        const y1 = ay + (by - ay) * ((i + 1) / n);
        const p0 = proj(x0, y0, 0);
        const p1 = proj(x1, y1, 0);
        if (p0.behind || p1.behind) continue;
        const q1 = proj(x1, y1, h);
        const q0 = proj(x0, y0, h);
        const grd = g.createLinearGradient(p0.x, p0.y, q0.x, q0.y);
        grd.addColorStop(0, FX().colorA(col, 0.45));
        grd.addColorStop(1, FX().colorA(col, 0));
        g.fillStyle = grd;
        g.beginPath();
        g.moveTo(p0.x, p0.y);
        g.lineTo(p1.x, p1.y);
        g.lineTo(q1.x, q1.y);
        g.lineTo(q0.x, q0.y);
        g.closePath();
        g.fill();
        g.strokeStyle = FX().colorA(col, 0.8 + 0.2 * Math.sin(t * 8 + i));
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(p0.x, p0.y);
        g.lineTo(p1.x, p1.y);
        g.stroke();
      }
    }
    g.restore();
  }

  /** 탐험 구역의 인물: 망토 두른 실루엣 + 네온 테두리 */
  function drawNpc(g, W, o, t) {
    const b = proj(o.x, o.y, 0);
    if (b.behind || b.y < -80 || b.y > VH + 80) return;
    const k = b.k;
    const H = 74 * k;
    const sway = Math.sin(t * 1.6 + o.x) * 1.5 * k;
    g.save();
    g.fillStyle = 'rgba(0,0,0,0.4)';
    g.beginPath();
    g.ellipse(b.x, b.y, 22 * k, 22 * k * b.fy, 0, 0, U.TAU);
    g.fill();
    g.translate(b.x, b.y);
    // 망토
    g.fillStyle = '#1b1830';
    g.beginPath();
    g.moveTo(-15 * k, 0);
    g.quadraticCurveTo(-17 * k, -H * 0.55, -9 * k + sway, -H * 0.78);
    g.lineTo(9 * k + sway, -H * 0.78);
    g.quadraticCurveTo(17 * k, -H * 0.55, 15 * k, 0);
    g.closePath();
    g.fill();
    g.strokeStyle = '#ffb36b';
    g.lineWidth = Math.max(1, 1.6 * k);
    g.stroke();
    // 머리와 후드
    g.fillStyle = '#2a2440';
    g.beginPath();
    g.arc(sway, -H * 0.86, 10 * k, 0, U.TAU);
    g.fill();
    g.stroke();
    // 눈빛 고글
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = '#ffd08a';
    g.fillRect(sway - 6 * k, -H * 0.88, 12 * k, 2.6 * k);
    // 손에 든 등불
    const lx = 16 * k;
    const ly = -H * 0.42 + Math.sin(t * 2.2) * 2 * k;
    const grd = g.createRadialGradient(lx, ly, 0, lx, ly, 26 * k);
    grd.addColorStop(0, 'rgba(255,214,150,0.9)');
    grd.addColorStop(1, 'rgba(255,160,80,0)');
    g.fillStyle = grd;
    g.beginPath();
    g.arc(lx, ly, 26 * k, 0, U.TAU);
    g.fill();
    g.restore();
  }

  function drawObjective(g, W, t) {
    const st = W.stage;
    if (!st || !st.objective || st.active) return;
    const o = st.objective;
    const c = proj(o.x, o.y, 150 + Math.sin(t * 3) * 10);
    const gd = AZ.level.guide(W.level, W.player.x, W.player.y, 10);
    const dist = gd ? Math.round(gd.remain / 10) : 0;
    const onScreen = c.x > 40 && c.x < VW - 40 && c.y > 110 && c.y < VH - 60;
    let y = U.clamp(c.y, onScreen ? 120 : 160, VH - (onScreen ? 80 : 150));
    const x = U.clamp(c.x, onScreen ? 60 : 90, VW - (onScreen || y > 300 ? 60 : 200));
    g.save();
    const boss = o.label === '보스 구역';
    const col = boss ? '#ff5470' : '#7cf7ff';
    g.translate(x, y);
    if (onScreen) {
      g.fillStyle = col;
      g.beginPath();
      g.moveTo(0, 14);
      g.lineTo(-11, -4);
      g.lineTo(11, -4);
      g.closePath();
      g.fill();
    } else {
      const a = Math.atan2(c.y - VH / 2, c.x - VW / 2);
      g.rotate(a);
      g.fillStyle = col;
      g.beginPath();
      g.moveTo(16, 0);
      g.lineTo(-8, -11);
      g.lineTo(-8, 11);
      g.closePath();
      g.fill();
      g.rotate(-a);
    }
    g.textAlign = 'center';
    g.font = `900 14px ${FONT}`;
    g.lineWidth = 4;
    g.strokeStyle = 'rgba(0,0,0,0.7)';
    const label = boss && W.stage.cleared >= 3 ? `보스 구역 · ${dist}m` : `${o.label} · ${dist}m`;
    g.strokeText(label, 0, -14);
    g.fillStyle = '#ffffff';
    g.fillText(label, 0, -14);
    g.restore();
  }

  /** WebGL 이 없을 때: 길과 구역을 단순한 판으로 */
  function drawFlatLevel(g, W) {
    const L = W.level;
    g.save();
    g.fillStyle = '#1a1c30';
    g.strokeStyle = 'rgba(124,200,255,0.5)';
    g.lineWidth = 2;
    for (const sg of L.segs) {
      const a = Math.atan2(sg.by - sg.ay, sg.bx - sg.ax);
      const nx = -Math.sin(a) * sg.w / 2;
      const ny = Math.cos(a) * sg.w / 2;
      const pts = [proj(sg.ax + nx, sg.ay + ny, 0), proj(sg.bx + nx, sg.by + ny, 0), proj(sg.bx - nx, sg.by - ny, 0), proj(sg.ax - nx, sg.ay - ny, 0)];
      g.beginPath();
      polyTo(g, pts);
      g.fill();
    }
    for (const a of L.areas) {
      if (a.kind === 'boss') continue;
      const pts = [proj(a.x0, a.y0, 0), proj(a.x1, a.y0, 0), proj(a.x1, a.y1, 0), proj(a.x0, a.y1, 0)];
      g.beginPath();
      polyTo(g, pts);
      g.fill();
      g.stroke();
    }
    g.restore();
  }

  /** 상호작용 (NPC·장치) 안내 */
  function drawInteract(g, W, t) {
    const it = W.stage.near;
    const p = W.player;
    for (const o of W.stage.objects || []) {
      if (o.used && o.kind !== 'npc') continue;
      const d = Math.hypot(o.x - p.x, o.y - p.y);
      if (d > 760) continue;
      const c = proj(o.x, o.y, o.kind === 'npc' ? 96 : 70);
      if (c.behind) continue;
      g.save();
      g.textAlign = 'center';
      g.font = `900 13px ${FONT}`;
      g.globalAlpha = o === it ? 1 : 0.75 * U.clamp((760 - d) / 220, 0, 1);
      g.fillStyle = o.kind === 'npc' ? '#ffd6a0' : '#7cf7ff';
      g.fillText(o.kind === 'npc' ? o.name : o.label, c.x, c.y - 8 + Math.sin(t * 3) * 3);
      if (o === it) {
        const key = AZ.gfx.render.touchMode ? '터치' : 'E';
        g.fillStyle = 'rgba(4,10,26,0.8)';
        FX().roundRect(g, c.x - 62, c.y + 2, 124, 26, 8);
        g.fill();
        g.fillStyle = '#ffffff';
        g.font = `800 13px ${FONT}`;
        g.fillText(`[${key}] ${o.kind === 'npc' ? '대화' : o.verb || '작동'}`, c.x, c.y + 20);
      }
      g.restore();
    }
  }

  function drawMinimap(g, W) {
    const L = W.level;
    if (!L) return;
    const bx = VW - 168;
    const by = 118;
    const bw = 150;
    const bh = 150;
    const b = L.bounds;
    const sc = Math.min(bw / (b.x1 - b.x0), bh / (b.y1 - b.y0));
    const ox = bx + (bw - (b.x1 - b.x0) * sc) / 2;
    const oy = by + (bh - (b.y1 - b.y0) * sc) / 2;
    const T = (x, y) => [ox + (x - b.x0) * sc, oy + (y - b.y0) * sc];
    g.save();
    g.fillStyle = 'rgba(4,10,26,0.6)';
    FX().roundRect(g, bx - 8, by - 8, bw + 16, bh + 16, 10);
    g.fill();
    g.lineCap = 'round';
    for (const sgm of L.segs) {
      const [ax, ay] = T(sgm.ax, sgm.ay);
      const [ex, ey] = T(sgm.bx, sgm.by);
      g.strokeStyle = sgm.branch ? 'rgba(255,224,102,0.6)' : 'rgba(140,190,255,0.55)';
      g.lineWidth = Math.max(2, sgm.w * sc);
      g.beginPath();
      g.moveTo(ax, ay);
      g.lineTo(ex, ey);
      g.stroke();
    }
    const st = W.stage;
    for (const a of L.areas) {
      const [x0, y0] = T(a.x0, a.y0);
      const [x1, y1] = T(a.x1, a.y1);
      const e = st && st.enc.find((q) => q.area === a);
      g.fillStyle = a.kind === 'boss' ? 'rgba(255,61,110,0.5)' : a.kind === 'start' ? 'rgba(124,247,160,0.35)' : e && e.state === 'cleared' ? 'rgba(124,247,212,0.3)' : a.kind === 'reward' ? 'rgba(255,224,102,0.45)' : 'rgba(255,155,61,0.5)';
      g.fillRect(x0, y0, x1 - x0, y1 - y0);
    }
    const [px, py] = T(W.player.x, W.player.y);
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.arc(px, py, 3.5, 0, U.TAU);
    g.fill();
    g.restore();
  }

  /* ───────────── 바닥 위 도형 (점마다 투영 → 원근에서도 정확) ───────────── */
  function circlePts(cx, cy, r, a0, a1, n) {
    const pts = [];
    const steps = n || Math.max(16, Math.min(64, Math.round(r / 6)));
    for (let i = 0; i <= steps; i++) {
      const a = a0 + (a1 - a0) * (i / steps);
      pts.push(proj(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 0));
    }
    return pts;
  }
  function polyTo(g, pts, reverse) {
    const list = reverse ? pts.slice().reverse() : pts;
    list.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
    g.closePath();
  }
  function groundCircle(g, x, y, r) { g.beginPath(); polyTo(g, circlePts(x, y, r, 0, U.TAU)); }
  function linePts(h, len) {
    const ca = Math.cos(h.ang), sa = Math.sin(h.ang);
    const nx = -sa * h.w / 2, ny = ca * h.w / 2;
    const L = len != null ? len : h.len;
    return [proj(h.x + nx, h.y + ny, 0), proj(h.x + ca * L + nx, h.y + sa * L + ny, 0), proj(h.x + ca * L - nx, h.y + sa * L - ny, 0), proj(h.x - nx, h.y - ny, 0)];
  }
  function shapePath(g, h, W, scale) {
    const s = scale == null ? 1 : scale;
    g.beginPath();
    switch (h.shape) {
      case 'circle':
        polyTo(g, circlePts(h.x, h.y, h.r * s, 0, U.TAU));
        break;
      case 'ring':
        polyTo(g, circlePts(h.x, h.y, Math.max(1, h.r1), 0, U.TAU));
        polyTo(g, circlePts(h.x, h.y, Math.max(0.5, h.r0), 0, U.TAU), true);
        break;
      case 'sector': {
        const pts = [proj(h.x, h.y, 0)].concat(circlePts(h.x, h.y, h.r * s, h.ang - h.arc / 2, h.ang + h.arc / 2));
        polyTo(g, pts);
        break;
      }
      case 'line':
        polyTo(g, linePts(h, h.len * s));
        break;
      case 'outside':
      case 'all': {
        const m = 300;
        polyTo(g, [proj(-m, -m, 0), proj(W.w + m, -m, 0), proj(W.w + m, W.h + m, 0), proj(-m, W.h + m, 0)]);
        if (h.shape === 'outside') polyTo(g, circlePts(h.x, h.y, h.r, 0, U.TAU), true);
        if (h.safe) for (const sz of h.safe) polyTo(g, circlePts(sz.x, sz.y, sz.r, 0, U.TAU), true);
        break;
      }
      default:
        break;
    }
  }

  function drawHazards(g, W, t) {
    const scan = W.scan > 0;
    for (const h of W.hazards) {
      if (h.dmg <= 0 && h.visual !== 'aim') continue;
      const color = FX().hazardColor(h);
      let alpha = 1;
      if (h.done) alpha = Math.max(0, h.fade / 0.25);
      g.save();
      g.globalAlpha = alpha;
      if (h.visual === 'aim' || h.visual === 'snipe') {
        const k = Math.min(1, h.t / h.warn);
        const a = proj(h.x, h.y, 0);
        const b = proj(h.x + Math.cos(h.ang) * h.len, h.y + Math.sin(h.ang) * h.len, 0);
        g.strokeStyle = FX().colorA(color, 0.35 + k * 0.5);
        g.lineWidth = h.visual === 'snipe' ? 2 + k * 3 : 1.5;
        g.beginPath();
        g.moveTo(a.x, a.y);
        g.lineTo(b.x, b.y);
        g.stroke();
        if (h.active && h.visual === 'snipe') {
          g.fillStyle = 'rgba(255,255,255,0.8)';
          shapePath(g, h, W);
          g.fill();
        }
        g.restore();
        continue;
      }
      if (!h.active) {
        const k = Math.min(1, h.t / h.warn);
        const pulse = 0.5 + 0.5 * Math.sin(t * 18);
        shapePath(g, h, W);
        g.fillStyle = FX().colorA(color, (h.shape === 'all' || h.shape === 'outside' ? 0.1 : 0.14) + k * 0.16);
        g.fill('evenodd');
        if (h.shape === 'circle' || h.shape === 'line' || h.shape === 'sector') {
          shapePath(g, h, W, k);
          g.fillStyle = FX().colorA(color, 0.24);
          g.fill();
        }
        shapePath(g, h, W);
        g.strokeStyle = FX().colorA(k > 0.75 ? '#ffffff' : color, 0.6 + pulse * 0.35 * k + (scan ? 0.2 : 0));
        g.lineWidth = scan ? 3.5 : 2.5;
        if (scan) g.setLineDash([14, 8]);
        g.stroke();
        g.setLineDash([]);
        if (h.safe || h.shape === 'outside') {
          const list = h.safe ? h.safe : [{ x: h.x, y: h.y, r: h.r }];
          for (const s of list) {
            groundCircle(g, s.x, s.y, s.r);
            g.fillStyle = `rgba(80,255,160,${0.12 + pulse * 0.1})`;
            g.fill();
            g.strokeStyle = 'rgba(120,255,180,0.9)';
            g.lineWidth = 4;
            g.stroke();
          }
        }
      } else {
        const life = Math.max(0.05, h.life);
        const kk = Math.min(1, (h.t - h.warn) / life);
        const steady = h.tick > 0;
        shapePath(g, h, W);
        g.globalCompositeOperation = 'lighter';
        g.fillStyle = FX().colorA(color, steady ? 0.38 + 0.12 * Math.sin(t * 40) : 0.7 * (1 - kk) + 0.15);
        g.fill('evenodd');
        if (h.shape === 'line') {
          const core = Object.assign({}, h, { w: h.w * 0.36 });
          g.beginPath();
          polyTo(g, linePts(core));
          g.fillStyle = `rgba(255,255,255,${steady ? 0.55 : 0.8 * (1 - kk)})`;
          g.fill();
        }
      }
      g.restore();

      // 낙하물 / 라벨
      if (!h.active && !h.done) {
        const k = Math.min(1, h.t / h.warn);
        if (['missile', 'meteor', 'fireball', 'star', 'debris'].includes(h.visual)) {
          const z = (1 - k) * 520;
          const p = proj(h.x, h.y, z);
          const r = (h.visual === 'meteor' ? 26 : 14) * p.k;
          g.save();
          g.globalCompositeOperation = 'lighter';
          const grd = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 2.5);
          grd.addColorStop(0, '#ffffff');
          grd.addColorStop(0.3, color);
          grd.addColorStop(1, FX().colorA(color, 0));
          g.fillStyle = grd;
          g.beginPath();
          g.arc(p.x, p.y, r * 2.5, 0, U.TAU);
          g.fill();
          const tail = proj(h.x, h.y, z + 90);
          g.strokeStyle = FX().colorA(color, 0.5);
          g.lineWidth = r * 0.8;
          g.beginPath();
          g.moveTo(p.x, p.y);
          g.lineTo(tail.x, tail.y);
          g.stroke();
          g.restore();
        }
        if (h.label) {
          const p = proj(h.x, h.y, 0);
          const ly = h.shape === 'all' ? VH * 0.62 : p.y;
          const lx = h.shape === 'all' ? VW / 2 : p.x;
          g.save();
          g.textAlign = 'center';
          g.font = `900 ${h.shape === 'all' ? 30 : 15}px ${FONT}`;
          g.lineWidth = 4;
          g.strokeStyle = 'rgba(0,0,0,0.7)';
          const left = Math.max(0, h.warn - h.t);
          const str = h.warn >= 2 ? `${h.label}  ${left.toFixed(1)}` : h.label;
          g.strokeText(str, lx, ly);
          g.fillStyle = h.shape === 'outside' ? '#a0ffc8' : '#ffd0d8';
          g.fillText(str, lx, ly);
          g.restore();
        }
        if (scan && h.owner && h.owner.kind === 'boss' && (h.shape === 'circle' || h.shape === 'line' || h.shape === 'sector')) {
          const a = proj(h.owner.x, h.owner.y, 0);
          const b = h.shape === 'line' ? proj(h.x + Math.cos(h.ang) * Math.min(h.len, 300), h.y + Math.sin(h.ang) * Math.min(h.len, 300), 0) : proj(h.x, h.y, 0);
          g.save();
          g.strokeStyle = 'rgba(124,247,255,0.55)';
          g.setLineDash([6, 6]);
          g.lineWidth = 2;
          g.beginPath();
          g.moveTo(a.x, a.y);
          g.lineTo(b.x, b.y);
          g.stroke();
          g.restore();
        }
      }
    }
  }

  /* ───────────── 엔티티 ───────────── */
  function drawShadow(g, e) {
    const c = proj(e.x, e.y, 0);
    const r = e.r * c.k * (e.kind === 'boss' ? 1.15 : 1.05);
    const lift = Math.min(1, (e.z || 0) / 160);
    g.fillStyle = `rgba(0,0,0,${(persp ? 0.5 : 0.42) - lift * 0.2})`;
    g.beginPath();
    g.ellipse(c.x, c.y, r * (1 - lift * 0.3), r * c.fy * 0.8 * (1 - lift * 0.3), 0, 0, U.TAU);
    g.fill();
  }

  function placeholder(g, e, t) {
    const col = e.kind === 'player' ? '#5fd4ff' : e.kind === 'ally' ? (e.ally === 'zero' ? '#ff3355' : '#9ae6ff') : (e.def && e.def.color) || '#ff5470';
    const h = e.r * 3.2;
    g.fillStyle = '#0c1020';
    g.beginPath();
    g.ellipse(0, -h / 2, e.r, h / 2, 0, 0, U.TAU);
    g.fill();
    g.strokeStyle = col;
    g.lineWidth = 2;
    g.stroke();
    g.fillStyle = col;
    g.beginPath();
    g.arc(Math.cos(e.facing) * e.r * 0.5, -h * 0.75, e.r * 0.18 + Math.sin(t * 6) * 0.5, 0, U.TAU);
    g.fill();
  }

  const canFilter = typeof document !== 'undefined' && (() => {
    try {
      const c = document.createElement('canvas').getContext('2d');
      return c && 'filter' in c;
    } catch (e) {
      return false;
    }
  })();

  function drawEntity(g, e, W, t) {
    const c = proj(e.x, e.y, e.z || 0);
    g.save();
    g.translate(c.x, c.y);
    g.scale(c.k, c.k);
    let alpha = e.alpha != null ? e.alpha : 1;
    if (e.untargetable && e.kind === 'boss') alpha *= 0.35;
    if (e.spawnT > 0) alpha *= Math.max(0, 1 - e.spawnT / 0.5);
    if (e.kind === 'ally' && e.down > 0) alpha *= 0.55;
    if (e.dead && e.kind !== 'boss') alpha *= Math.max(0, 1 - e.deadT / 1.0);
    if (e.kind === 'player' && e.iframe > 0 && e.state === 'hurt') alpha *= 0.5 + 0.5 * Math.sin(t * 60);
    g.globalAlpha = alpha;
    if (e.flash > 0 && canFilter) g.filter = 'brightness(2.6)';
    try {
      if (AZ.gfx.sprites && AZ.gfx.sprites.draw) AZ.gfx.sprites.draw(g, e, W, t);
      else placeholder(g, e, t);
    } catch (err) {
      placeholder(g, e, t);
    }
    if (canFilter) g.filter = 'none';
    g.restore();
  }

  function drawSpawnRing(g, e) {
    if (!(e.spawnT > 0)) return;
    const c = proj(e.x, e.y, 0);
    const k = 1 - e.spawnT / 0.5;
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.strokeStyle = FX().colorA(e.def.color || '#ff5470', 1 - k);
    g.lineWidth = 3;
    g.beginPath();
    g.ellipse(c.x, c.y, e.r * 2 * (1 - k * 0.5) * c.k, e.r * 2 * c.fy * (1 - k * 0.5) * c.k, 0, 0, U.TAU);
    g.stroke();
    g.fillStyle = FX().colorA(e.def.color || '#ff5470', 0.25 * (1 - k));
    g.fillRect(c.x - e.r * c.k, c.y - 120 * c.k, e.r * 2 * c.k, 120 * c.k);
    g.restore();
  }

  /** 보스 약점/방패 표시 (바닥) */
  function drawBossMarkers(g, W, e, t) {
    if (e.dead) return;
    const c = proj(e.x, e.y, 0);
    const show = W.scan > 0 || W.zero > 0;
    const weak = e.def.weak || {};
    g.save();
    g.translate(c.x, c.y);
    g.scale(c.k, c.k * c.fy);
    if (weak.back && !weak.exposedOnly && !e.broken) {
      const a = e.facing + Math.PI;
      g.globalAlpha = show ? 0.75 + 0.25 * Math.sin(t * 8) : 0.28;
      g.strokeStyle = '#7cf7ff';
      g.lineWidth = show ? 8 : 4;
      g.beginPath();
      g.arc(0, 0, e.r + 18, a - weak.back / 2, a + weak.back / 2);
      g.stroke();
    }
    if (e.def.shield && !e.shieldDown && !e.broken) {
      g.globalAlpha = 0.6;
      g.strokeStyle = '#ffe066';
      g.lineWidth = 6;
      g.beginPath();
      g.arc(0, 0, e.r + 14, e.facing - e.def.shield / 2, e.facing + e.def.shield / 2);
      g.stroke();
    }
    g.restore();
  }

  function drawOverheadMarkers(g, W, e, t) {
    if (e.dead) return;
    const top = proj(e.x, e.y, (e.z || 0) + e.r * (e.kind === 'boss' ? (e.def.big ? 3.4 : 3.2) : 3.4));
    if (e.kind === 'boss') {
      if (e.alert > 0) {
        g.save();
        g.textAlign = 'center';
        g.font = `900 ${34 + Math.sin(t * 30) * 3}px ${FONT}`;
        g.fillStyle = '#ff4d6d';
        g.strokeStyle = 'rgba(0,0,0,0.6)';
        g.lineWidth = 5;
        g.strokeText('!', top.x, top.y - 10);
        g.fillText('!', top.x, top.y - 10);
        g.restore();
      }
      if (e.exposed > 0 || (W.zero > 0 && !e.broken)) {
        const core = proj(e.x, e.y, (e.z || 0) + e.r * 1.1);
        g.save();
        g.globalCompositeOperation = 'lighter';
        const pr = (20 + Math.sin(t * 10) * 4) * core.k;
        g.strokeStyle = '#7cf7ff';
        g.lineWidth = 3;
        g.beginPath();
        g.arc(core.x, core.y, pr, 0, U.TAU);
        g.stroke();
        g.beginPath();
        for (let i = 0; i < 4; i++) {
          const a = i * Math.PI / 2 + t * 2;
          g.moveTo(core.x + Math.cos(a) * pr * 1.3, core.y + Math.sin(a) * pr * 1.3);
          g.lineTo(core.x + Math.cos(a) * pr * 1.9, core.y + Math.sin(a) * pr * 1.9);
        }
        g.stroke();
        g.restore();
        g.save();
        g.textAlign = 'center';
        g.font = `900 14px ${FONT}`;
        g.fillStyle = '#7cf7ff';
        g.fillText('WEAK', core.x, core.y - pr * 2);
        g.restore();
      }
      if (e.stance > 0) {
        g.save();
        g.textAlign = 'center';
        g.font = `900 16px ${FONT}`;
        g.fillStyle = '#ff3355';
        g.strokeStyle = 'rgba(0,0,0,0.7)';
        g.lineWidth = 4;
        g.strokeText('반격 태세 — 공격 금지', top.x, top.y - 4);
        g.fillText('반격 태세 — 공격 금지', top.x, top.y - 4);
        g.restore();
      }
      if (e.broken) {
        g.save();
        g.textAlign = 'center';
        g.font = `900 italic 22px ${FONT}`;
        g.fillStyle = '#ffe066';
        g.strokeStyle = 'rgba(0,0,0,0.7)';
        g.lineWidth = 5;
        const s = `BREAK ${e.breakT.toFixed(1)}`;
        g.strokeText(s, top.x, top.y - 4);
        g.fillText(s, top.x, top.y - 4);
        g.restore();
      }
    } else if (e.kind === 'enemy' && !e.clone) {
      if (e.hp < e.maxHp && e.spawnT <= 0) {
        const w = Math.max(30, e.r * 2.2) * top.k;
        g.fillStyle = 'rgba(0,0,0,0.6)';
        g.fillRect(top.x - w / 2, top.y, w, 5);
        g.fillStyle = e.def.color || '#ff5470';
        g.fillRect(top.x - w / 2, top.y, w * Math.max(0, e.hp / e.maxHp), 5);
      }
    } else if (e.clone && W.scan > 0) {
      g.save();
      g.textAlign = 'center';
      g.font = `900 14px ${FONT}`;
      g.fillStyle = '#ff6b7a';
      g.fillText('FAKE', top.x, top.y);
      g.restore();
    }
  }

  function drawTargetMarker(g, W, t) {
    const p = W.player;
    const e = p.target;
    if (!e || e.dead || e.untargetable) return;
    const c = proj(e.x, e.y, 0);
    const r = (e.r + 12) * c.k;
    g.save();
    g.translate(c.x, c.y);
    g.scale(1, c.fy);
    g.rotate(t * 1.5);
    g.strokeStyle = e.kind === 'boss' ? 'rgba(255,90,120,0.8)' : 'rgba(255,255,255,0.6)';
    g.lineWidth = 3;
    for (let i = 0; i < 4; i++) {
      g.beginPath();
      g.arc(0, 0, r, i * Math.PI / 2 + 0.2, i * Math.PI / 2 + 0.9);
      g.stroke();
    }
    g.restore();
  }

  function drawShieldBubble(g, e, t) {
    if (!(e.shield > 0)) return;
    const c = proj(e.x, e.y, (e.z || 0) + e.r * 1.5);
    const r = e.r * 2.1 * c.k;
    g.save();
    g.globalCompositeOperation = 'lighter';
    const grd = g.createRadialGradient(c.x, c.y, r * 0.5, c.x, c.y, r);
    grd.addColorStop(0, 'rgba(124,232,255,0)');
    grd.addColorStop(0.85, `rgba(124,232,255,${0.18 + 0.06 * Math.sin(t * 6)})`);
    grd.addColorStop(1, 'rgba(180,245,255,0.5)');
    g.fillStyle = grd;
    g.beginPath();
    g.ellipse(c.x, c.y, r, r * 1.1, 0, 0, U.TAU);
    g.fill();
    g.restore();
  }

  function drawStanceAura(g, p, t) {
    if (p.state !== 'stance') return;
    const c = proj(p.x, p.y, 30);
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.strokeStyle = `rgba(150,230,255,${0.6 + 0.3 * Math.sin(t * 20)})`;
    g.lineWidth = 3;
    g.beginPath();
    g.arc(c.x, c.y, 44 * c.k, 0, U.TAU);
    g.stroke();
    g.restore();
  }

  /* ───────────── 투사체 / 줍는 것 ───────────── */
  function drawBullets(g, W, t) {
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (const b of W.bullets) {
      const c = proj(b.x, b.y, b.delay > 0 ? 40 : 26);
      const r = b.r * c.k;
      const ang = Math.atan2(b.vy * c.fy, b.vx);
      if (b.kind === 'crescent') {
        g.save();
        g.translate(c.x, c.y);
        g.rotate(ang);
        g.fillStyle = FX().colorA(b.color, 0.75);
        g.beginPath();
        g.arc(0, 0, r * 1.4, -1.3, 1.3);
        g.arc(-r * 0.6, 0, r * 1.2, 1.1, -1.1, true);
        g.closePath();
        g.fill();
        g.restore();
        continue;
      }
      if (b.kind === 'blade' || b.kind === 'shot') {
        g.save();
        g.translate(c.x, c.y);
        g.rotate(ang);
        g.fillStyle = FX().colorA(b.color, 0.5);
        g.fillRect(-r * 3.2, -r * 0.7, r * 4, r * 1.4);
        g.fillStyle = '#ffffff';
        g.fillRect(-r * 1.6, -r * 0.3, r * 2.4, r * 0.6);
        g.restore();
        continue;
      }
      const grd = g.createRadialGradient(c.x, c.y, 0, c.x, c.y, r * 2.2);
      grd.addColorStop(0, '#ffffff');
      grd.addColorStop(0.35, b.color);
      grd.addColorStop(1, FX().colorA(b.color, 0));
      g.fillStyle = grd;
      g.beginPath();
      g.arc(c.x, c.y, r * 2.2, 0, U.TAU);
      g.fill();
    }
    g.restore();
  }

  function drawPickups(g, W, t) {
    for (const k of W.pickups) {
      if (k.hidden || k.taken) continue;
      const bob = Math.sin(t * 3 + k.x) * 6;
      const c = proj(k.x, k.y, 26 + bob);
      if (c.behind || c.y < -60 || c.y > VH + 60) continue;
      const base = proj(k.x, k.y, 0);
      const s = U.clamp(c.k / 1.2, 0.3, 1.1);
      const far = Math.hypot(k.x - W.player.x, k.y - W.player.y);
      g.save();
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.beginPath();
      g.ellipse(base.x, base.y, 14 * base.k, 14 * base.k * base.fy, 0, 0, U.TAU);
      g.fill();
      g.globalCompositeOperation = 'lighter';
      if (k.kind === 'memory') {
        const pillar = g.createLinearGradient(0, c.y - 300, 0, base.y);
        pillar.addColorStop(0, 'rgba(200,180,255,0)');
        pillar.addColorStop(1, 'rgba(200,180,255,0.35)');
        g.fillStyle = pillar;
        g.fillRect(c.x - 18 * c.k, c.y - 300, 36 * c.k, base.y - c.y + 300);
        g.save();
        g.translate(c.x, c.y);
        g.rotate(t * 1.2);
        g.scale(s, s);
        g.fillStyle = '#e2d4ff';
        g.beginPath();
        g.moveTo(0, -24);
        g.lineTo(12, 0);
        g.lineTo(0, 24);
        g.lineTo(-12, 0);
        g.closePath();
        g.fill();
        g.restore();
        g.font = `800 14px ${FONT}`;
        g.textAlign = 'center';
        g.fillStyle = '#e2d4ff';
        if (far < 900) g.fillText('기억 파편', c.x, c.y - 40 * s);
      } else {
        g.translate(c.x, c.y);
        g.scale(s, s);
        const credit = k.kind === 'credit';
        const grd = g.createRadialGradient(0, 0, 0, 0, 0, 22);
        grd.addColorStop(0, '#ffffff');
        grd.addColorStop(0.4, credit ? '#8fe0ff' : '#5fff9a');
        grd.addColorStop(1, credit ? 'rgba(143,224,255,0)' : 'rgba(95,255,154,0)');
        g.fillStyle = grd;
        g.beginPath();
        g.arc(0, 0, 22, 0, U.TAU);
        g.fill();
        g.fillStyle = '#ffffff';
        if (credit) {
          g.beginPath();
          g.moveTo(0, -8); g.lineTo(6, 0); g.lineTo(0, 8); g.lineTo(-6, 0);
          g.closePath();
          g.fill();
        } else {
          g.fillRect(-2, -7, 4, 14);
          g.fillRect(-7, -2, 14, 4);
        }
      }
      g.restore();
    }
  }

  /* 화면 밖 경고 화살표 */
  function drawOffscreen(g, W) {
    const items = [];
    for (const h of W.hazards) {
      if (h.active || h.done || h.dmg <= 0 || h.shape === 'all' || h.shape === 'outside') continue;
      items.push({ x: h.x, y: h.y, color: '#ff4d6d' });
    }
    if (W.boss && !W.boss.dead) items.push({ x: W.boss.x, y: W.boss.y, color: '#ffffff', boss: true });
    for (const e of W.enemies) if (e.kind === 'enemy' && !e.dead && !e.clone) items.push({ x: e.x, y: e.y, color: '#ffb0c0', small: true });
    for (const it of items) {
      const c = proj(it.x, it.y, 0);
      if (c.x > 20 && c.x < VW - 20 && c.y > 20 && c.y < VH - 20) continue;
      const cx = U.clamp(c.x, 34, VW - 34);
      const cy = U.clamp(c.y, 90, VH - 34);
      const a = Math.atan2(c.y - VH / 2, c.x - VW / 2);
      g.save();
      g.translate(cx, cy);
      g.rotate(a);
      g.fillStyle = it.color;
      g.globalAlpha = it.boss ? 0.8 : 0.9;
      const sc = it.small ? 0.6 : 1;
      g.beginPath();
      g.moveTo(14 * sc, 0);
      g.lineTo(-8 * sc, -10 * sc);
      g.lineTo(-8 * sc, 10 * sc);
      g.closePath();
      g.fill();
      g.restore();
    }
  }

  /* ───────────── 화면 효과 ───────────── */
  const vignetteCache = {};
  /** 화면 가장자리 어둡게(색) — 미리 그려 둔 캔버스 */
  function getVignette(kind, k) {
    const key = kind + '@' + k.toFixed(3);
    if (vignetteCache[key]) return vignetteCache[key];
    const c = makeCanvas(VW * k, VH * k);
    if (!c) return null;
    const g = c.getContext('2d');
    g.scale(k, k);
    const grd = g.createRadialGradient(VW / 2, VH / 2, VH * (kind === 'red' ? 0.4 : 0.45), VW / 2, VH / 2, VH * (kind === 'red' ? 0.9 : 0.95));
    grd.addColorStop(0, 'rgba(0,0,0,0)');
    grd.addColorStop(1, kind === 'red' ? 'rgba(255,0,40,1)' : 'rgba(0,0,8,0.55)');
    g.fillStyle = grd;
    g.fillRect(0, 0, VW, VH);
    for (const kk of Object.keys(vignetteCache)) if (kk.startsWith(kind + '@')) delete vignetteCache[kk];
    vignetteCache[key] = c;
    return c;
  }
  function blitFull(g, c, alpha) {
    if (!c) return;
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = alpha;
    g.drawImage(c, 0, 0);
    g.restore();
  }

  function drawOverlays(g, W, t) {
    const fxs = FX().state;
    const k = g.getTransform ? g.getTransform().a : 1;
    blitFull(g, getVignette('dark', k), 1);

    const p = W.player;
    if (p.hp / p.maxHp < 0.3 && !p.dead) blitFull(g, getVignette('red', k), 0.25 + 0.15 * Math.sin(t * 6));
    // 색 바꾸기: 곱하기(빠름)로 차가운 색조
    const tint = (mul, amount, add) => {
      g.save();
      g.globalCompositeOperation = 'multiply';
      g.globalAlpha = amount;
      g.fillStyle = mul;
      g.fillRect(0, 0, VW, VH);
      g.restore();
      if (add) {
        g.save();
        g.globalCompositeOperation = 'screen';
        g.fillStyle = add;
        g.fillRect(0, 0, VW, VH);
        g.restore();
      }
    };
    if (W.zero > 0) {
      const kz = Math.min(1, (W.zeroMax - W.zero) / 0.2, W.zero / 0.3);
      if (!persp) tint('#6f8fd0', 0.75 * kz, `rgba(30,90,200,${0.12 * kz})`);
      else {
        g.save();
        g.fillStyle = `rgba(30,90,200,${0.08 * kz})`;
        g.fillRect(0, 0, VW, VH);
        g.restore();
      }
      // 속도선
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.strokeStyle = `rgba(150,220,255,${0.2 * kz})`;
      g.lineWidth = 2;
      g.beginPath();
      for (let i = 0; i < 26; i++) {
        const a = i * 0.8 + Math.floor(t * 12) * 0.37;
        const r0 = VH * (0.55 + ((i * 37) % 10) / 30);
        g.moveTo(VW / 2 + Math.cos(a) * r0, VH / 2 + Math.sin(a) * r0);
        g.lineTo(VW / 2 + Math.cos(a) * VW, VH / 2 + Math.sin(a) * VW);
      }
      g.stroke();
      g.restore();
    } else if (W.timeStop > 0 && !persp) {
      tint('#a294d8', 0.8, 'rgba(80,40,160,0.08)');
    }
    const desat = (amount, color) => { if (!persp) tint('#a8a8b8', amount, color); };
    if (fxs.freeze > 0) {
      desat(1, 'rgba(200,200,220,0.12)');
      g.save();
      g.textAlign = 'center';
      g.font = `900 italic 26px ${FONT}`;
      g.fillStyle = 'rgba(255,255,255,0.85)';
      g.fillText(`TIME STOP — ${fxs.freeze.toFixed(1)}`, VW / 2, VH * 0.8);
      g.restore();
    }
    if (W.scan > 0) {
      g.save();
      g.globalAlpha = Math.min(1, W.scan) * 0.5;
      g.fillStyle = 'rgba(124,247,255,0.05)';
      for (let y = (t * 60) % 6; y < VH; y += 6) g.fillRect(0, y, VW, 1);
      g.strokeStyle = '#7cf7ff';
      g.lineWidth = 3;
      g.globalAlpha = 0.6;
      const m = 20;
      const L = 40;
      for (const [x, y, dx, dy] of [[m, m + 70, 1, 1], [VW - m, m + 70, -1, 1], [m, VH - m, 1, -1], [VW - m, VH - m, -1, -1]]) {
        g.beginPath();
        g.moveTo(x, y + dy * L);
        g.lineTo(x, y);
        g.lineTo(x + dx * L, y);
        g.stroke();
      }
      g.restore();
    }
    if (fxs.glitch > 0 && g.canvas) {
      const c = g.canvas;
      const sx = c.width / VW;
      g.save();
      g.setTransform(1, 0, 0, 1, 0, 0);
      for (let i = 0; i < 7; i++) {
        const y = Math.random() * c.height;
        const h = 6 + Math.random() * 40 * sx;
        const off = (Math.random() - 0.5) * 60 * sx;
        try { g.drawImage(c, 0, y, c.width, h, off, y, c.width, h); } catch (e) { /* 무시 */ }
      }
      g.restore();
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = `rgba(255,60,200,${0.06 + Math.random() * 0.06})`;
      g.fillRect(0, 0, VW, VH);
      g.restore();
    }
  }

  /* ───────────── 아이콘 ───────────── */
  function drawIcon(g, icon, x, y, s, color) {
    g.save();
    g.translate(x, y);
    g.strokeStyle = color || '#e8f4ff';
    g.fillStyle = color || '#e8f4ff';
    g.lineWidth = Math.max(1.5, s * 0.09);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    const r = s / 2;
    g.beginPath();
    switch (icon) {
      case 'wave':
        for (const k of [0.35, 0.65, 0.95]) { g.moveTo(r * k, 0); g.arc(0, 0, r * k, 0, U.TAU); }
        g.stroke();
        break;
      case 'ray':
        g.moveTo(-r, r * 0.6); g.lineTo(r * 0.7, -r * 0.6); g.stroke();
        g.beginPath(); g.moveTo(r * 0.7, -r * 0.6); g.lineTo(r * 0.1, -r * 0.6); g.moveTo(r * 0.7, -r * 0.6); g.lineTo(r * 0.6, 0); g.stroke();
        g.beginPath(); g.moveTo(-r * 0.9, 0); g.lineTo(-r * 0.3, -r * 0.4); g.moveTo(-r * 0.4, r * 0.9); g.lineTo(r * 0.2, r * 0.4); g.stroke();
        break;
      case 'blades':
        for (let i = 0; i < 6; i++) {
          const a = i * Math.PI / 3;
          g.moveTo(Math.cos(a) * r * 0.25, Math.sin(a) * r * 0.25);
          g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        g.stroke();
        break;
      case 'barrier':
      case 'hp':
      case 'def':
        for (let i = 0; i < 6; i++) {
          const a = i * Math.PI / 3 - Math.PI / 2;
          if (i === 0) g.moveTo(Math.cos(a) * r, Math.sin(a) * r); else g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        g.closePath();
        g.stroke();
        if (icon === 'hp') { g.beginPath(); g.moveTo(0, -r * 0.4); g.lineTo(0, r * 0.4); g.moveTo(-r * 0.4, 0); g.lineTo(r * 0.4, 0); g.stroke(); }
        if (icon === 'def') { g.beginPath(); g.moveTo(-r * 0.4, 0); g.lineTo(-r * 0.1, r * 0.3); g.lineTo(r * 0.45, -r * 0.3); g.stroke(); }
        break;
      case 'counter':
        g.moveTo(-r, r); g.lineTo(r, -r); g.moveTo(r, r); g.lineTo(-r, -r); g.stroke();
        g.beginPath(); g.arc(0, 0, r * 0.35, 0, U.TAU); g.stroke();
        break;
      case 'repair':
        g.moveTo(0, -r); g.lineTo(0, r); g.moveTo(-r, 0); g.lineTo(r, 0); g.stroke();
        g.beginPath(); g.arc(0, 0, r * 0.9, 0, U.TAU); g.stroke();
        break;
      case 'blink':
        g.setLineDash([s * 0.12, s * 0.1]);
        g.moveTo(-r, r * 0.4); g.lineTo(r * 0.5, r * 0.4); g.stroke();
        g.setLineDash([]);
        g.beginPath(); g.arc(r * 0.6, -r * 0.3, r * 0.35, 0, U.TAU); g.stroke();
        break;
      case 'accel':
        for (const o of [-0.5, 0.1]) { g.moveTo(r * o, -r * 0.7); g.lineTo(r * (o + 0.5), 0); g.lineTo(r * o, r * 0.7); }
        g.stroke();
        break;
      case 'stop':
        g.arc(0, 0, r * 0.95, 0, U.TAU); g.stroke();
        g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -r * 0.6); g.moveTo(0, 0); g.lineTo(r * 0.4, r * 0.2); g.stroke();
        g.beginPath(); g.moveTo(-r * 0.9, -r * 0.9); g.lineTo(r * 0.9, r * 0.9); g.stroke();
        break;
      case 'ult':
        g.arc(0, 0, r * 0.9, 0, U.TAU); g.stroke();
        g.beginPath(); g.moveTo(-r * 0.8, r * 0.5); g.lineTo(r * 0.8, -r * 0.5); g.stroke();
        g.beginPath(); g.moveTo(0, -r * 0.5); g.lineTo(0, 0); g.lineTo(r * 0.35, r * 0.2); g.stroke();
        break;
      case 'chain':
        g.arc(-r * 0.35, 0, r * 0.45, 0, U.TAU); g.stroke();
        g.beginPath(); g.arc(r * 0.35, 0, r * 0.45, 0, U.TAU); g.stroke();
        break;
      case 'atk':
        g.moveTo(-r * 0.8, r * 0.8); g.lineTo(r * 0.7, -r * 0.7); g.moveTo(r * 0.2, -r * 0.7); g.lineTo(r * 0.7, -r * 0.7); g.lineTo(r * 0.7, -r * 0.2); g.stroke();
        break;
      case 'crit':
        g.moveTo(0, -r); g.lineTo(r * 0.25, -r * 0.25); g.lineTo(r, 0); g.lineTo(r * 0.25, r * 0.25); g.lineTo(0, r); g.lineTo(-r * 0.25, r * 0.25); g.lineTo(-r, 0); g.lineTo(-r * 0.25, -r * 0.25); g.closePath(); g.stroke();
        break;
      case 'combo':
        g.font = `900 ${s * 0.55}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('30+', 0, 1);
        break;
      case 'last':
        g.moveTo(-r * 0.7, r * 0.6); g.lineTo(0, -r * 0.8); g.lineTo(r * 0.7, r * 0.6); g.closePath(); g.stroke();
        g.beginPath(); g.moveTo(0, -r * 0.2); g.lineTo(0, r * 0.2); g.stroke();
        break;
      case 'eye':
        g.moveTo(-r, 0); g.quadraticCurveTo(0, -r, r, 0); g.quadraticCurveTo(0, r, -r, 0); g.stroke();
        g.beginPath(); g.arc(0, 0, r * 0.3, 0, U.TAU); g.fill();
        break;
      case 'zero':
        g.ellipse(0, 0, r * 0.55, r * 0.9, 0, 0, U.TAU); g.stroke();
        g.beginPath(); g.moveTo(-r * 0.6, r * 0.8); g.lineTo(r * 0.6, -r * 0.8); g.stroke();
        break;
      case 'cdr':
        g.arc(0, 0, r * 0.9, -Math.PI * 0.9, Math.PI * 0.6); g.stroke();
        g.beginPath(); g.moveTo(r * 0.9 * Math.cos(Math.PI * 0.6), r * 0.9 * Math.sin(Math.PI * 0.6)); g.lineTo(r * 0.2, r * 0.6); g.stroke();
        break;
      case 'scan':
        g.arc(0, 0, r * 0.85, 0, U.TAU); g.stroke();
        g.beginPath(); g.arc(0, 0, r * 0.3, 0, U.TAU); g.stroke();
        g.beginPath(); g.moveTo(-r, 0); g.lineTo(-r * 0.5, 0); g.moveTo(r, 0); g.lineTo(r * 0.5, 0); g.moveTo(0, -r); g.lineTo(0, -r * 0.5); g.moveTo(0, r); g.lineTo(0, r * 0.5); g.stroke();
        break;
      case 'cover':
        g.moveTo(0, -r); g.lineTo(r * 0.85, -r * 0.6); g.lineTo(r * 0.7, r * 0.3); g.lineTo(0, r); g.lineTo(-r * 0.7, r * 0.3); g.lineTo(-r * 0.85, -r * 0.6); g.closePath(); g.stroke();
        break;
      case 'focus':
        g.moveTo(-r, -r * 0.6); g.lineTo(0, 0); g.lineTo(-r, r * 0.6); g.moveTo(-r * 0.2, -r * 0.6); g.lineTo(r * 0.8, 0); g.lineTo(-r * 0.2, r * 0.6); g.stroke();
        break;
      default:
        g.arc(0, 0, r * 0.6, 0, U.TAU); g.stroke();
    }
    g.restore();
  }

  /* ───────────── HUD ───────────── */
  function bar(g, x, y, w, h, frac, color, back, trail) {
    g.fillStyle = back || 'rgba(0,0,0,0.55)';
    g.fillRect(x, y, w, h);
    if (trail != null && trail > frac) {
      g.fillStyle = 'rgba(255,255,255,0.75)';
      g.fillRect(x, y, w * U.clamp(trail, 0, 1), h);
    }
    g.fillStyle = color;
    g.fillRect(x, y, w * U.clamp(frac, 0, 1), h);
  }

  function portrait(g, key, x, y, r, ring, grey) {
    const im = FX().img(key);
    g.save();
    g.beginPath();
    g.arc(x, y, r, 0, U.TAU);
    g.fillStyle = '#0a1024';
    g.fill();
    g.clip();
    if (im && im.complete && im.naturalWidth) {
      const s = (r * 2.3) / Math.min(im.naturalWidth, im.naturalHeight);
      if (grey && 'filter' in g) g.filter = 'grayscale(1) brightness(0.6)';
      g.drawImage(im, x - (im.naturalWidth * s) / 2, y - r * 1.05, im.naturalWidth * s, im.naturalHeight * s);
      if ('filter' in g) g.filter = 'none';
    } else if (AZ.gfx.sprites && AZ.gfx.sprites.drawPortraitIcon) {
      g.translate(x, y);
      AZ.gfx.sprites.drawPortraitIcon(g, key, r * 2);
    }
    g.restore();
    g.strokeStyle = ring;
    g.lineWidth = 2.5;
    g.beginPath();
    g.arc(x, y, r, 0, U.TAU);
    g.stroke();
  }

  function txt(g, s, x, y, size, color, align, weight) {
    g.font = `${weight || 700} ${size}px ${FONT}`;
    g.textAlign = align || 'left';
    g.textBaseline = 'middle';
    g.fillStyle = color || '#e8f4ff';
    g.fillText(s, x, y);
  }

  function roundBtn(g, x, y, r, opts) {
    const o = opts || {};
    g.save();
    g.beginPath();
    g.arc(x, y, r, 0, U.TAU);
    g.fillStyle = o.bg || 'rgba(6,14,34,0.72)';
    g.fill();
    if (o.cdFrac > 0) {
      g.beginPath();
      g.moveTo(x, y);
      g.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + U.TAU * o.cdFrac);
      g.closePath();
      g.fillStyle = 'rgba(0,0,0,0.55)';
      g.fill();
    }
    g.lineWidth = o.ready ? 3 : 2;
    g.strokeStyle = o.ring || 'rgba(140,200,255,0.65)';
    g.beginPath();
    g.arc(x, y, r, 0, U.TAU);
    g.stroke();
    if (o.progress != null) {
      g.lineWidth = 4;
      g.strokeStyle = o.progressColor || '#ffe066';
      g.beginPath();
      g.arc(x, y, r + 4, -Math.PI / 2, -Math.PI / 2 + U.TAU * U.clamp(o.progress, 0, 1));
      g.stroke();
    }
    if (o.icon) drawIcon(g, o.icon, x, y, r * 1.0, o.iconColor || (o.disabled ? 'rgba(200,210,230,0.35)' : '#e8f4ff'));
    if (o.label) txt(g, o.label, x, y, o.labelSize || 14, o.disabled ? 'rgba(200,210,230,0.4)' : '#e8f4ff', 'center', 800);
    if (o.cdText) txt(g, o.cdText, x, y, Math.max(12, r * 0.55), '#ffffff', 'center', 900);
    if (o.key && !touchMode) {
      g.fillStyle = 'rgba(0,0,0,0.7)';
      g.fillRect(x + r * 0.45, y + r * 0.45, 18, 16);
      txt(g, o.key, x + r * 0.45 + 9, y + r * 0.45 + 8, 11, '#cfe6ff', 'center', 800);
    }
    if (o.locked) {
      g.strokeStyle = '#ff4d6d';
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(x - r * 0.6, y - r * 0.6);
      g.lineTo(x + r * 0.6, y + r * 0.6);
      g.moveTo(x + r * 0.6, y - r * 0.6);
      g.lineTo(x - r * 0.6, y + r * 0.6);
      g.stroke();
    }
    g.restore();
    if (o.id) buttons.push({ id: o.id, x, y, r: r + 6 });
  }

  function drawHud(g, W, t, dt, input) {
    buttons = [];
    const p = W.player;
    const D = AZ.data;
    // ── 좌상단: 파티 ──
    hudState.hpTrail = U.approach(hudState.hpTrail, p.hp / p.maxHp, dt * 0.5);
    if (hudState.hpTrail < p.hp / p.maxHp) hudState.hpTrail = p.hp / p.maxHp;
    g.fillStyle = 'rgba(4,10,26,0.55)';
    FX().roundRect(g, 14, 12, 330, 84, 12);
    g.fill();
    portrait(g, 'kai', 52, 54, 32, p.hp / p.maxHp < 0.3 ? '#ff4d6d' : '#7cc8ff');
    txt(g, '카이온', 94, 28, 15, '#ffffff', 'left', 800);
    txt(g, `Lv.${p.stats.level}`, 150, 28, 12, '#9ab8ff', 'left', 700);
    txt(g, `${Math.ceil(p.hp)} / ${p.maxHp}`, 334, 28, 12, '#cfe6ff', 'right', 700);
    bar(g, 94, 40, 240, 12, p.hp / p.maxHp, p.hp / p.maxHp < 0.3 ? '#ff4d6d' : '#46e08c', null, hudState.hpTrail);
    if (p.shield > 0) {
      g.fillStyle = 'rgba(124,232,255,0.75)';
      g.fillRect(94, 40, 240 * Math.min(1, p.shield / p.maxHp), 4);
    }
    // 회피 충전
    for (let i = 0; i < 3; i++) {
      const filled = i < p.dodgeCharges;
      const x = 100 + i * 20;
      g.save();
      g.translate(x, 66);
      g.rotate(Math.PI / 4);
      g.fillStyle = filled ? '#7ce8ff' : 'rgba(124,232,255,0.15)';
      g.fillRect(-5, -5, 10, 10);
      g.restore();
    }
    txt(g, '회피', 162, 66, 11, '#9ab8ff');
    // 버프
    let bx = 200;
    const buff = (label, color) => {
      g.fillStyle = 'rgba(0,0,0,0.5)';
      g.fillRect(bx, 58, 40, 16);
      txt(g, label, bx + 20, 66, 10, color, 'center', 800);
      bx += 44;
    };
    if (p.haste > 0) buff(`가속 ${Math.ceil(p.haste)}`, '#c9a4ff');
    if (p.shield > 0) buff('방벽', '#7ce8ff');
    if (p.blinkCrit > 0) buff('치명', '#ffe066');
    if (p.regen) buff('수복', '#46e08c');
    if (p.counterReady > 0) buff('반격!', '#9ae6ff');
    // 동료
    let ay = 116;
    for (const a of W.allies) {
      const key = a.ally;
      g.fillStyle = 'rgba(4,10,26,0.5)';
      FX().roundRect(g, 14, ay - 20, 230, 40, 10);
      g.fill();
      portrait(g, key, 36, ay, 16, a.ally === 'zero' ? '#ff3355' : '#7ce8ff', a.down > 0);
      txt(g, a.ally === 'lia' ? '리아' : '제로', 60, ay - 8, 13, '#ffffff', 'left', 800);
      if (a.down > 0) txt(g, `${a.ally === 'lia' ? '재기동' : '복귀'} ${Math.ceil(a.down)}초`, 236, ay - 8, 11, '#ffb35c', 'right');
      bar(g, 60, ay + 4, 176, 6, a.hp / a.maxHp, a.ally === 'zero' ? '#ff6b8a' : '#7ce8ff');
      ay += 46;
    }

    // ── 상단 중앙: 보스 ──
    const e = W.boss;
    if (e) {
      const bw = 540;
      const x0 = VW / 2 - bw / 2 + 20;
      hudState.bossHpTrail = U.approach(hudState.bossHpTrail, e.hp / e.maxHp, dt * 0.25);
      if (hudState.bossHpTrail < e.hp / e.maxHp) hudState.bossHpTrail = e.hp / e.maxHp;
      txt(g, e.def.name, x0, 22, 18, '#ffffff', 'left', 900);
      g.font = `900 18px ${FONT}`;
      const nw = g.measureText(e.def.name).width;
      txt(g, e.def.title, x0 + nw + 10, 23, 12, '#ffb0c0', 'left', 700);
      txt(g, `${Math.max(0, Math.ceil(e.hp / e.maxHp * 100))}%`, x0 + bw, 22, 13, '#ffd0d8', 'right', 800);
      bar(g, x0, 34, bw, 14, Math.max(0, e.hp / e.maxHp), e.broken ? '#ffb33d' : '#ff3d6e', null, hudState.bossHpTrail);
      g.strokeStyle = 'rgba(255,255,255,0.35)';
      g.strokeRect(x0 + 0.5, 34.5, bw - 1, 13);
      for (const th of e.def.phases || []) {
        g.fillStyle = '#ffffff';
        g.fillRect(x0 + bw * th - 1, 30, 2, 22);
      }
      // 브레이크 게이지
      const bf = e.broken ? e.breakT / 6 : e.brk / e.brkMax;
      bar(g, x0, 52, bw, 6, bf, e.broken ? `rgba(255,224,102,${0.6 + 0.4 * Math.sin(t * 16)})` : '#ffd166');
      txt(g, e.broken ? 'BREAK' : '브레이크 게이지', x0, 66, 10, '#ffd166', 'left', 800);
      if (e.exposed > 0 && !e.broken) txt(g, '약점 노출', x0 + bw, 66, 11, '#7cf7ff', 'right', 900);
      if (W.zero > 0) {
        bar(g, x0 + bw / 2 - 140, 76, 280, 5, W.zero / W.zeroMax, '#7ce8ff');
        txt(g, 'ZERO FRAME', x0 + bw / 2, 90, 12, '#bfefff', 'center', 900);
      }
    } else if (W.stage) {
      const st = W.stage;
      const elite = W.enemies.find((m) => m.elite && !m.dead && m.spawnT <= 0);
      if (elite) {
        const bw = 420;
        const x0 = VW / 2 - bw / 2;
        txt(g, elite.eliteName, x0, 24, 16, '#ffd0a0', 'left', 900);
        txt(g, '중간 보스', x0 + bw, 24, 12, '#ffb35c', 'right', 800);
        bar(g, x0, 36, bw, 12, elite.hp / elite.maxHp, '#ff9b3d');
      } else {
        const region = st.region ? st.region : '';
        txt(g, region, VW / 2, 24, 19, '#ffffff', 'center', 900);
        const alive = W.enemies.filter((m) => !m.dead && !m.clone && m.kind === 'enemy').length;
        const sub = st.active ? `교전 중 — 남은 적 ${alive}` : st.objective ? `목표: ${st.objective.label}` : '';
        txt(g, sub, VW / 2, 48, 13, st.active ? '#ffb0a0' : '#9fe8ff', 'center', 800);
      }
      drawMinimap(g, W);
    } else if (W.waves) {
      const alive = W.enemies.filter((m) => !m.dead && !m.clone).length;
      txt(g, W.memorySpawned ? '기억 파편을 회수하세요' : `WAVE ${Math.max(1, W.waveIdx + 1)} / ${W.waves.length}`, VW / 2, 26, 20, '#ffffff', 'center', 900);
      if (!W.memorySpawned) txt(g, `남은 적 ${alive}`, VW / 2, 50, 13, '#ffb0c0', 'center', 700);
    }

    // ── 우상단: 시간 ──
    txt(g, U.fmtTime(W.stats.time), VW - 20, 26, 20, '#ffffff', 'right', 800);
    txt(g, D.difficulties[W.cfg.difficulty] ? D.difficulties[W.cfg.difficulty].name : '', VW - 20, 48, 11, '#9ab8ff', 'right', 700);
    roundBtn(g, VW - 34, 82, 17, { id: 'pause', label: 'II', labelSize: 13 });

    // ── 하단 중앙: 집중 게이지 / 콤보 ──
    const fw = 380;
    const fx = VW / 2 - fw / 2;
    const fy = VH - 30;
    const full = p.focus >= 100;
    txt(g, '집중', fx - 10, fy + 5, 12, full ? '#ffe066' : '#cfe6ff', 'right', 800);
    g.fillStyle = 'rgba(0,0,0,0.55)';
    g.fillRect(fx, fy, fw, 10);
    const fg = g.createLinearGradient(fx, 0, fx + fw, 0);
    fg.addColorStop(0, '#ff9b3d');
    fg.addColorStop(1, '#ffe066');
    g.fillStyle = fg;
    g.fillRect(fx, fy, fw * p.focus / 100, 10);
    if (full) {
      g.strokeStyle = `rgba(255,230,120,${0.5 + 0.5 * Math.sin(t * 8)})`;
      g.lineWidth = 2;
      g.strokeRect(fx - 2, fy - 2, fw + 4, 14);
    }
    txt(g, full ? '궁극기 준비!' : `${Math.floor(p.focus)}%`, fx + fw + 10, fy + 5, 12, full ? '#ffe066' : '#cfe6ff', 'left', 800);
    if (p.combo !== hudState.lastCombo) {
      if (p.combo > hudState.lastCombo) hudState.comboPop = 1;
      hudState.lastCombo = p.combo;
    }
    hudState.comboPop = Math.max(0, hudState.comboPop - dt * 6);
    if (p.combo >= 3) {
      const cx = touchMode ? VW / 2 : VW - 300;
      const cy = touchMode ? 130 : VH - 150;
      const sc = 1 + hudState.comboPop * 0.25;
      g.save();
      g.translate(cx, cy);
      g.scale(sc, sc);
      g.globalAlpha = Math.min(1, p.comboT / 0.6);
      g.font = `900 italic 52px ${FONT}`;
      g.textAlign = 'right';
      const cg = g.createLinearGradient(0, -30, 0, 20);
      cg.addColorStop(0, '#ffffff');
      cg.addColorStop(1, p.combo >= 50 ? '#ffe066' : '#7cc8ff');
      g.lineWidth = 5;
      g.strokeStyle = 'rgba(0,0,20,0.6)';
      g.strokeText(String(p.combo), 0, 0);
      g.fillStyle = cg;
      g.fillText(String(p.combo), 0, 0);
      g.font = `900 italic 16px ${FONT}`;
      g.fillStyle = '#cfe6ff';
      g.fillText('COMBO', 0, 22);
      g.restore();
    }

    // ── 스킬 / 궁극기 / 연계 / 전술 명령 ──
    const skills = p.stats.skills;
    const keys = (input && input.keyLabels) || { skills: ['U', 'I', 'O'], ult: 'L', chain: 'F', cmds: ['Z', 'X', 'C'], attack: 'J', heavy: 'K', dodge: 'SPC' };
    const lay = touchMode ? TOUCH_LAYOUT : DESK_LAYOUT;
    for (let i = 0; i < 3; i++) {
      const id = skills[i];
      const node = id ? D.skills.nodes[id] : null;
      const [x, y, r] = lay.skills[i];
      const cd = p.cds[i];
      roundBtn(g, x, y, r, {
        id: 'skill' + i, icon: node ? node.icon : null, label: node ? null : '—',
        cdFrac: cd > 0 ? cd / p.cdMax[i] : 0, cdText: cd > 0 ? Math.ceil(cd) : null,
        ring: node ? (cd > 0 ? 'rgba(140,200,255,0.4)' : '#9ad8ff') : 'rgba(140,200,255,0.25)',
        key: keys.skills[i], locked: p.locks[i] > 0, disabled: !node,
      });
    }
    const [ux, uy, ur] = lay.ult;
    roundBtn(g, ux, uy, ur, {
      id: 'ult', icon: 'ult', progress: p.focus / 100, ready: full,
      bg: full ? `rgba(80,60,10,${0.75 + 0.15 * Math.sin(t * 6)})` : undefined,
      ring: full ? '#ffe066' : 'rgba(255,224,102,0.4)', iconColor: full ? '#fff3c0' : 'rgba(255,240,200,0.5)', key: keys.ult,
    });
    const chainReady = W.allies.some((a) => a.down <= 0) && ((W.boss && W.boss.broken && !W.chainUsedThisBreak) || p.chain >= 100);
    if (W.allies.length) {
      const [cx, cy, cr] = lay.chain;
      roundBtn(g, cx, cy, cr, {
        id: 'chain', icon: 'chain', progress: p.chain / 100, progressColor: '#ff7ad9', ready: chainReady,
        ring: chainReady ? '#ff7ad9' : 'rgba(255,122,217,0.4)', iconColor: chainReady ? '#ffd0f2' : 'rgba(255,210,240,0.45)', key: keys.chain,
        bg: chainReady ? `rgba(80,20,60,${0.75 + 0.15 * Math.sin(t * 7)})` : undefined,
      });
      if (chainReady && !touchMode) txt(g, '연계!', cx, cy - cr - 12, 12, '#ff9ef0', 'center', 900);
    }
    if (touchMode && W.stage && W.stage.near) roundBtn(g, VW / 2, VH - 90, 34, { id: 'interact', label: W.stage.near.kind === 'npc' ? '대화' : '작동', labelSize: 14, ring: '#7cf7ff' });
    if (touchMode) {
      const [ax, ay2, ar] = lay.attack;
      roundBtn(g, ax, ay2, ar, { id: 'attack', label: '공격', labelSize: 18 });
      const [hx, hy, hr] = lay.heavy;
      roundBtn(g, hx, hy, hr, { id: 'heavy', label: '강공격', labelSize: 13 });
      const [dx, dy, dr] = lay.dodge;
      roundBtn(g, dx, dy, dr, { id: 'dodge', label: '회피', labelSize: 15, ring: '#7ce8ff' });
    }
    // 전술 명령
    const cmdIcons = ['scan', 'cover', 'focus'];
    for (let i = 0; i < 3; i++) {
      const cmd = D.commands[i];
      const need = cmd.needs === 'lia' ? W.allies.some((a) => a.ally === 'lia' && a.down <= 0) : W.allies.some((a) => a.down <= 0);
      const cd = W.cmdCd[i];
      if (touchMode) {
        const [x, y, r] = lay.cmds[i];
        roundBtn(g, x, y, r, { id: 'cmd' + i, icon: cmdIcons[i], cdFrac: cd > 0 ? cd / cmd.cd : 0, disabled: !need || p.locks[3] > 0, ring: need ? '#7cf7d4' : 'rgba(124,247,212,0.25)' });
      } else {
        const x = 18 + i * 128;
        const y = VH - 58;
        g.save();
        g.fillStyle = 'rgba(4,12,28,0.7)';
        FX().roundRect(g, x, y, 122, 40, 8);
        g.fill();
        if (cd > 0) {
          g.fillStyle = 'rgba(124,247,212,0.12)';
          g.fillRect(x, y, 122 * (1 - cd / cmd.cd), 40);
        }
        g.strokeStyle = need && cd <= 0 && !(p.locks[3] > 0) ? '#7cf7d4' : 'rgba(124,247,212,0.25)';
        g.lineWidth = 1.5;
        FX().roundRect(g, x, y, 122, 40, 8);
        g.stroke();
        drawIcon(g, cmdIcons[i], x + 20, y + 20, 18, need ? '#bff7ea' : 'rgba(200,230,220,0.35)');
        txt(g, cmd.name, x + 36, y + 14, 13, need ? '#e8fff8' : 'rgba(200,230,220,0.4)', 'left', 800);
        txt(g, cd > 0 ? `${Math.ceil(cd)}초` : need ? (p.locks[3] > 0 ? '잠김' : '대기') : '불가', x + 36, y + 29, 10, '#9fd8c8');
        g.fillStyle = 'rgba(0,0,0,0.7)';
        g.fillRect(x + 100, y + 4, 18, 16);
        txt(g, keys.cmds[i], x + 109, y + 12, 11, '#cfe6ff', 'center', 800);
        g.restore();
        buttons.push({ id: 'cmd' + i, x: x + 61, y: y + 20, r: 30 });
      }
    }
    if (!touchMode) txt(g, '전술 명령', 18, VH - 70, 11, '#7cf7d4', 'left', 800);

    // 터치 조이스틱
    if (touchMode && input && input.stick) {
      const s = input.stick;
      g.save();
      g.globalAlpha = 0.5;
      g.strokeStyle = '#9ad8ff';
      g.lineWidth = 3;
      g.beginPath();
      g.arc(s.ox, s.oy, 64, 0, U.TAU);
      g.stroke();
      g.globalAlpha = 0.7;
      g.fillStyle = '#9ad8ff';
      g.beginPath();
      g.arc(s.ox + s.dx * 64, s.oy + s.dy * 64, 26, 0, U.TAU);
      g.fill();
      g.restore();
    } else if (touchMode) {
      g.save();
      g.globalAlpha = 0.18;
      g.strokeStyle = '#9ad8ff';
      g.lineWidth = 3;
      g.beginPath();
      g.arc(170, VH - 160, 64, 0, U.TAU);
      g.stroke();
      txt(g, '이동', 170, VH - 160, 14, '#9ad8ff', 'center', 800);
      g.restore();
    }
  }

  const DESK_LAYOUT = {
    ult: [VW - 84, VH - 92, 44],
    skills: [[VW - 196, VH - 56, 28], [VW - 186, VH - 128, 28], [VW - 132, VH - 182, 28]],
    chain: [VW - 60, VH - 196, 24],
  };
  const TOUCH_LAYOUT = {
    attack: [VW - 104, VH - 104, 58],
    dodge: [VW - 250, VH - 70, 40],
    heavy: [VW - 104, VH - 250, 38],
    skills: [[VW - 252, VH - 172, 32], [VW - 212, VH - 262, 32], [VW - 128, VH - 336, 30]],
    ult: [VW - 318, VH - 286, 36],
    chain: [VW - 348, VH - 172, 30],
    cmds: [[VW - 34, 130, 22], [VW - 34, 184, 22], [VW - 34, 238, 22]],
  };

  /* ───────────── 메인 ───────────── */
  /** 3D 배경의 조명 — 보스 등장·페이즈·필살기 충전·ZERO FRAME 에 따라 바뀜 */
  function moodFor(W) {
    const e = W.boss && !W.boss.dead ? W.boss : null;
    const charging = e && e.charging > 0;
    const bigWarn = W.hazards.some((h) => !h.active && !h.done && h.shape === 'all');
    const col = e ? hexRgb(e.def.color) : [0, 0, 0];
    return {
      tint: [1, 1, 1],
      boss: col.map((c) => c * 0.6),
      bossAmt: e ? (W.state === 'intro' ? 0.3 : 0.7) : 0,
      alarm: charging || bigWarn ? 1 : e && e.phase >= 2 ? 0.3 : 0,
      zero: W.zero > 0 ? 1 : 0,
      stop: W.timeStop > 0 || FX().state.freeze > 0 ? 1 : 0,
      vortex: e && e.bossId === 'astra' ? (e.phase - 1) * 0.5 : 0,
    };
  }
  const hexRgb = (h) => {
    const n = parseInt(String(h || '#000000').slice(1), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  };

  let use3d = true;
  function drawBattle(g, W, t, dt, input) {
    const theme = W.ch.theme;
    const S3 = AZ.gfx.scene3d;
    persp = !!(use3d && S3 && S3.available);
    curLevel = persp ? W.level || null : null;
    if (!W._camInit) {
      updateCamera(W, dt, true);
      W._camInit = true;
      hudState = { bossHpTrail: 1, hpTrail: 1, comboPop: 0, lastCombo: 0 };
      ghosts.length = 0;
    } else updateCamera(W, dt, false);
    if (persp) {
      S3.ensure(theme, W.w, W.h, W.level);
      S3.setMood(moodFor(W));
      const e = W.boss;
      if (e && W._lastPhase !== e.phase) {
        if (W._lastPhase) S3.explode(7);
        W._lastPhase = e.phase;
      }
      if (S3.scene) {
        const dl = [[W.player.x, W.player.y, 170, 0.22, [0.45, 0.8, 1]]];
        if (e && !e.dead) dl.push([e.x, e.y, e.r * 4, e.exposed > 0 || e.charging > 0 ? 0.5 : 0.25, hexRgb(e.def.color)]);
        S3.scene.dynLights = dl;
      }
      // 플레이어를 가리는 구조물은 비쳐 보이게
      const p = W.player;
      const pz = (curLevel ? AZ.level.floorZ(curLevel, p.x, p.y) : 0) + 40;
      const pp = AZ.gfx.cam3d.project(p.x, p.y, pz);
      const eye = AZ.gfx.cam3d.st.eye;
      S3.setFocus(pp.x, pp.y, pp.behind ? 0 : Math.max(70, 120 * pp.k), Math.hypot(eye[0] - p.x, eye[1] - pz, eye[2] - p.y));
      S3.render(t, dt);
      g.clearRect(0, 0, VW, VH);
    } else drawFlatBackground(g, W, theme);
    drawWorld(g, W, t, dt, input);
  }

  function drawFlatBackground(g, W, theme) {
    // 배경: 경기장 위로 보이는 하늘 띠만 1:1 로 복사 (확대/축소 없이 → 빠름)
    const k = g.getTransform ? g.getTransform().a : 1;
    const T = THEMES[theme] || THEMES.ruins;
    g.fillStyle = '#03040a';
    g.fillRect(0, 0, VW, VH);
    const arenaTop = proj(0, 0, 0).y;
    const sky = skip.sky ? null : getSky(theme, k);
    if (sky && arenaTop > 0) {
      const lw = VW * 1.4;
      const par = ((cam.x / W.w) - 0.5) * (lw - VW) * 0.8;
      const sxL = (lw - VW) / 2 + par;
      const offY = Math.min(0, arenaTop - VH * 0.62) * 0.5;
      const visH = Math.min(VH, arenaTop + 2);
      const srcY = Math.max(0, Math.round(-offY * k));
      const h = Math.min(Math.round(visH * k), sky.height - srcY);
      const sx = U.clamp(Math.round(sxL * k), 0, sky.width - Math.round(VW * k));
      if (h > 0) {
        g.save();
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.drawImage(sky, sx, srcY, Math.round(VW * k), h, 0, 0, Math.round(VW * k), h);
        g.restore();
      }
      if (offY < 0 && visH * k > h) {
        g.fillStyle = T.sky[2];
        g.fillRect(0, h / k, VW, visH - h / k);
      }
    }
    // 바닥: 화면 배율 그대로 만들어 둔 그림을 정수 픽셀 위치에 1:1 로 복사
    const fscale = Math.min(2, k * cam.zoom);
    const fkey = theme + W.w + 'x' + W.h;
    if (!floorCache || floorCache.key !== fkey || Math.abs(floorCache.scale - fscale) > 0.001) floorCache = buildFloor(W, theme, fscale);
    const tl = proj(0, 0, 0);
    if (floorCache && !skip.floor) {
      const br = proj(W.w, W.h, 0);
      if (Math.abs(fscale - k * cam.zoom) < 0.001) {
        g.save();
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.drawImage(floorCache.canvas, Math.round(tl.x * k), Math.round(tl.y * k));
        g.restore();
      } else {
        g.drawImage(floorCache.canvas, tl.x, tl.y, floorCache.w * cam.zoom, floorCache.h * cam.zoom);
      }
      // 경기장 앞 가장자리 두께
      g.fillStyle = 'rgba(8,12,26,0.95)';
      g.fillRect(tl.x, br.y, W.w * cam.zoom, 26 * cam.zoom);
      g.fillStyle = FX().colorA((THEMES[theme] || THEMES.ruins).edge, 0.5);
      g.fillRect(tl.x, br.y, W.w * cam.zoom, 2);
    }
  }

  function drawWorld(g, W, t, dt, input) {
    // 바닥 레이어
    if (W.level && !persp) drawFlatLevel(g, W);
    if (W.stage) drawStageGround(g, W, t);
    drawHazards(g, W, t);
    FX().drawWorldBelow(g, proj, cam.zoom);
    drawPickups(g, W, t);
    if (W.boss) drawBossMarkers(g, W, W.boss, t);
    drawTargetMarker(g, W, t);
    // 엔티티
    const list = [W.player, ...W.allies, ...W.enemies];
    for (const e of list) if (!(e.dead && e.kind === 'enemy' && e.deadT > 1)) drawShadow(g, e);
    for (const e of W.enemies) drawSpawnRing(g, e);
    list.sort((a, b) => a.y - b.y);
    // 회피 잔상
    const p = W.player;
    if (p.state === 'dodge' || (p.state === 'skill' && p.st && (p.st.kind === 'ray' || p.st.kind === 'counter')) || p.haste > 0) {
      ghosts.push({ x: p.x, y: p.y, t: 0, facing: p.facing });
      if (ghosts.length > 8) ghosts.shift();
    }
    for (const gh of ghosts) gh.t += dt;
    while (ghosts.length && ghosts[0].t > 0.25) ghosts.shift();
    for (const gh of ghosts) {
      const c = proj(gh.x, gh.y, 0);
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.3 * (1 - gh.t / 0.25);
      g.fillStyle = W.zero > 0 ? '#7ce8ff' : '#4a8cff';
      g.beginPath();
      g.ellipse(c.x, c.y - 30 * c.k, 12 * c.k, 30 * c.k, 0, 0, U.TAU);
      g.fill();
      g.restore();
    }
    for (const e of list) {
      if (e.dead && e.kind === 'enemy' && e.deadT > 1) continue;
      if (e.kind === 'boss' && e.dead && e.deadT > 3) continue;
      drawEntity(g, e, W, t);
      drawShieldBubble(g, e, t);
    }
    drawStanceAura(g, p, t);
    drawBullets(g, W, t);
    for (const e of W.enemies) drawOverheadMarkers(g, W, e, t);
    FX().drawWorldAbove(g, proj, cam.zoom);
    if (W.stage) { drawObjective(g, W, t); drawInteract(g, W, t); }
    drawOffscreen(g, W);
    // 화면 효과
    if (!skip.overlays) drawOverlays(g, W, t);
    // HUD (흔들림 없이)
    if (!skip.hud) drawHud(g, W, t, dt, input);
    FX().drawScreen(g, W, VW, VH);
    if (W.state === 'intro') {
      g.save();
      g.fillStyle = `rgba(0,0,0,${Math.max(0, 0.6 - W.stateT)})`;
      g.fillRect(0, 0, VW, VH);
      g.restore();
    }
  }

  /** 메뉴·대화 뒤의 3D 장면 (천천히 움직이는 카메라). 3D 를 못 쓰면 false */
  function drawCinematic(g, theme, t, dt, opt) {
    const S3 = AZ.gfx.scene3d;
    if (!(use3d && S3 && S3.available)) return false;
    if (S3.setFocus) S3.setFocus(0, 0, 0, 0);
    const o = opt || {};
    const aw = 1700;
    const ah = 1100;
    S3.ensure(theme, aw, ah);
    AZ.gfx.cam3d.set({
      tx: aw / 2 + Math.sin(t * 0.06) * 260, ty: ah * 0.35, pitch: o.pitch != null ? o.pitch : 0.16,
      yaw: Math.sin(t * 0.045) * 0.28, fov: 0.95, dist: o.dist || 1250, lookZ: o.lookZ != null ? o.lookZ : 260,
    });
    S3.setMood({ tint: [1, 1, 1], alarm: 0, zero: 0, stop: 0, bossAmt: 0, boss: [0, 0, 0], vortex: 0 });
    if (S3.scene) S3.scene.dynLights = [];
    S3.render(t, dt);
    g.clearRect(0, 0, VW, VH);
    return true;
  }

  /* ───────────── 월드맵 (작전 터미널) ─────────────
   * wm: { sel, status[], themes[] } → 섬마다 노드 버튼 자리 [{ x, y, k, behind }] */
  const wcam = { x: null, y: 0, z: 0 };
  function drawWorldMap(g, t, dt, wm) {
    const S3 = AZ.gfx.scene3d;
    if (!(use3d && S3 && S3.available)) return null;
    S3.ensure('world', 1, 1, null, { key: 'w:' + wm.status.join(','), status: wm.status, themes: wm.themes });
    S3.setFocus(0, 0, 0, 0);
    const WD = S3.WORLD;
    const I = WD[U.clamp(wm.sel - 1, 0, WD.length - 1)];
    // 고른 섬은 화면 아래쪽에, 앞으로 갈 섬들은 위로 보이게
    const tx = I.x * 0.75 + 30;
    const ty = I.y - 140;
    const tz = I.z + 40;
    if (wcam.x == null) { wcam.x = tx; wcam.y = ty; wcam.z = tz; }
    const k = Math.min(1, (dt || 0) * 2.4);
    wcam.x += (tx - wcam.x) * k;
    wcam.y += (ty - wcam.y) * k;
    wcam.z += (tz - wcam.z) * k;
    AZ.gfx.cam3d.set({ tx: wcam.x, ty: wcam.y, pitch: 0.52, yaw: Math.sin(t * 0.07) * 0.06, fov: 0.8, dist: 1650, lookZ: wcam.z });
    S3.setMood({ tint: [1, 1, 1], alarm: 0, zero: 0, stop: 0, bossAmt: 0, boss: [0, 0, 0], vortex: 0 });
    if (S3.scene) S3.scene.dynLights = [];
    S3.render(t, dt);
    g.clearRect(0, 0, VW, VH);
    return WD.map((W) => {
      const p = AZ.gfx.cam3d.project(W.x, W.y, W.z + Math.sin(t * W.spd + W.ph) * W.bob + 30);
      return { x: p.x, y: p.y, k: p.k, behind: !!p.behind };
    });
  }

  return {
    VW, VH, YS, drawBattle, drawCinematic, drawWorldMap, skip, PERSP,
    get can3d() { const S3 = AZ.gfx.scene3d; return !!(use3d && S3 && S3.available); },
    setUse3d: (v) => { use3d = !!v; },
    get persp() { return persp; }, drawIcon, proj, THEMES, getSky,
    setTouchMode: (v) => { touchMode = !!v; },
    get touchMode() { return touchMode; },
    get buttons() { return buttons; },
    TOUCH_LAYOUT, DESK_LAYOUT,
    resetCaches: () => { floorCache = null; },
  };
})();
