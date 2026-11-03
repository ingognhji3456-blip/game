'use strict';

/* =========================================================
 * 하늘 사냥꾼 — 픽셀 화면 그리기 (가로 480×270)
 *
 * 모든 것을 480×270 픽셀 버퍼(SH.render.ctx)에 그린 다음 present() 로
 * 번짐 없이(최근접) 화면 캔버스에 크게 늘려 옮깁니다. (1080p 화면에서 꼭 4배)
 * 게임 좌표(960×540)는 절반으로 줄여 픽셀 좌표가 됩니다.
 * 보스는 위, 나는 아래에서 위로 쏘는 그대로이고, 화면만 가로로 넓습니다.
 *
 * 무대: 기계 요새 내부 (철판 바닥 · 양쪽 벽의 배관·조명·포문)
 * 보스: 몸통 그림 위에 무기(포탑·주포·포드)를 따로 그려 움직이고,
 *       조준 중에는 조준선, 충전 중에는 빛이 모이는 모습, 쏘면 총구 섬광이 보입니다.
 * ========================================================= */

SH.render = (() => {
  const PW = 480, PH = 270, K = 0.5;
  const TH = 400; // 바닥 무늬 한 장의 높이 (위아래가 이어짐)
  const WALL = 18; // 양쪽 벽 두께(픽셀)
  const MENU_Y = Math.round((PH - 225) / 2); // 메뉴는 가운데 225 높이 기준으로 그림
  let view = null, vctx = null, buf = null, ctx = null;
  const bg = { kind: null, tile: null, scroll: 0, t: 0, fade: 0, girders: [] };
  let notice = null;
  let bossLag = 1;
  const title = { t: 0 };
  const R = Math.random;
  const TAU = Math.PI * 2;
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
  const bayer = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];

  function init(canvas) {
    view = canvas;
    vctx = view.getContext('2d');
    buf = document.createElement('canvas');
    buf.width = PW;
    buf.height = PH;
    ctx = buf.getContext('2d');
    ctx.imageSmoothingEnabled = false;
  }

  function resize(devW, devH, cssW, cssH) {
    view.width = devW;
    view.height = devH;
    view.style.width = cssW + 'px';
    view.style.height = cssH + 'px';
  }

  function present() {
    vctx.imageSmoothingEnabled = false;
    vctx.drawImage(buf, 0, 0, view.width, view.height);
  }

  /** 메뉴의 위치 이동을 무시하고 화면 전체 기준으로 그리기 */
  function absolute(fn) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    fn();
    ctx.restore();
  }

  /* ---------------- 픽셀 도우미 ---------------- */
  function canvasFrom(w, h, fn) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const x = c.getContext('2d');
    const img = x.createImageData(w, h);
    fn(img.data, w, h);
    x.putImageData(img, 0, 0);
    return c;
  }
  const hex = (h) => SH.pix.rgba(h);
  function put(d, w, x, y, c) {
    if (x < 0 || x >= w || y < 0) return;
    const o = (y * w + x) * 4;
    d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = c[3];
  }
  function overlay(w, h, fn, color) {
    const c = hex(color);
    return canvasFrom(w, h, (d) => {
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (bayer(x, y) < fn(x, y)) put(d, w, x, y, c);
    });
  }
  let dimOverlay = null, dimLight = null, vignette = null;
  function getOverlays() {
    if (dimOverlay) return;
    dimOverlay = overlay(PW, PH, () => 0.62, '#0c0820');
    dimLight = overlay(PW, PH, () => 0.4, '#0c0820');
    vignette = overlay(PW, PH, (x, y) => {
      const dx = (x - PW / 2) / (PW * 0.55), dy = (y - PH * 0.55) / (PH * 0.62);
      return Math.max(0, Math.hypot(dx, dy) - 0.82) * 1.4;
    }, '#05060c');
  }

  /* =========================================================
   * 무대: 기계 요새 내부 (위아래가 이어지는 바닥·벽 한 장, 480×400)
   * ========================================================= */
  function hangarTile() {
    const C = {
      plate: hex('#2a3040'), plate2: hex('#30374a'), seam: hex('#161a26'), seamHi: hex('#3e465c'), rivet: hex('#566078'),
      grateHi: hex('#323a50'), glow: hex('#3a1a18'), glow2: hex('#5a2418'),
      line: hex('#8a7a2a'), trench: hex('#10131c'), cable1: hex('#a02a3a'), cable2: hex('#2a5aa0'), cable3: hex('#c88a1a'),
      wall: hex('#3a4258'), wallHi: hex('#56607a'), wallDk: hex('#232838'), pipe: hex('#6e7a96'), pipeHi: hex('#a8b4cc'),
      brass: hex('#9a7030'), brassHi: hex('#d0a050'), hazY: hex('#c8a020'), hazK: hex('#141824'), shadow: hex('#0e1018'),
      hatch: hex('#1a1e2a'),
    };
    return canvasFrom(PW, TH, (d, w, h) => {
      // 바닥 철판 (40×40)
      for (let y = 0; y < h; y++) {
        for (let x = WALL; x < w - WALL; x++) {
          const px = (x - WALL + 2) % 40, py = y % 40;
          const cell = Math.floor((x - WALL + 2) / 40) + Math.floor(y / 40) * 7;
          let c = cell % 3 === 0 ? C.plate2 : C.plate;
          if (px === 0 || py === 0) c = C.seam;
          else if (px === 39 || py === 39) c = C.seamHi;
          else if ((px === 3 || px === 36) && (py === 3 || py === 36)) c = C.rivet;
          else if (bayer(x, y) < 0.03) c = C.seam;
          put(d, w, x, y, c);
        }
      }
      // 격자 창 (아래에서 희미한 불빛)
      for (const [gx, gy] of [[1, 1], [3, 4], [0, 7], [8, 2], [6, 8], [10, 5]]) {
        const x0 = WALL + gx * 40 + 4, y0 = gy * 40 + 8;
        for (let y = 0; y < 24; y++) for (let x = 0; x < 28; x++) {
          put(d, w, x0 + x, (y0 + y) % h, y % 3 === 0 ? C.grateHi : (bayer(x, y) < 0.35 ? C.glow2 : C.glow));
        }
      }
      // 안내선 (점선)
      for (const lx of [158, 320]) for (let y = 0; y < h; y++) if (y % 16 < 9) { put(d, w, lx, y, C.line); put(d, w, lx + 1, y, C.line); }
      // 케이블 도랑
      for (const tx of [WALL + 8, w - WALL - 13]) {
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < 6; x++) put(d, w, tx + x, y, C.trench);
          put(d, w, tx + 1, y, C.cable1);
          put(d, w, tx + 3, y, C.cable2);
          if (y % 50 < 25) put(d, w, tx + 4, y, C.cable3);
        }
      }
      // 벽 + 벽과 바닥 경계의 경고 줄무늬
      for (const side of [0, 1]) {
        const x0 = side ? w - WALL : 0;
        for (let y = 0; y < h; y++) {
          for (let i = 0; i < WALL; i++) {
            const x = x0 + i;
            const inner = side ? i : WALL - 1 - i; // 0 = 바닥 쪽
            let c = C.wall;
            if (inner === 0) c = C.shadow;
            else if (inner === 1 || inner === 2) c = ((y + (side ? 0 : 3)) >> 2) % 2 ? C.hazY : C.hazK;
            else if (inner === WALL - 1) c = C.wallDk;
            else if (inner >= 4 && inner <= 6) c = inner === 5 ? C.pipeHi : C.pipe;
            else if (inner >= 9 && inner <= 11) c = inner === 10 ? C.brassHi : C.brass;
            else if (inner === 13 || inner === 15) c = y % 20 === 0 ? C.wallHi : C.wall;
            else if (bayer(x, y) < 0.08) c = C.wallDk;
            if (y % 60 === 0 && inner >= 4 && inner <= 11) c = C.wallDk;
            put(d, w, x, y, c);
          }
        }
        // 포문 (벽 레이저포가 숨는 곳)
        for (const hy of [40, 240]) {
          for (let y = 0; y < 26; y++) for (let i = 3; i < WALL - 1; i++) {
            const x = x0 + (side ? i : WALL - 1 - i);
            const edge = y === 0 || y === 25 || i === 3 || i === WALL - 2;
            put(d, w, x, hy + y, edge ? (((y + i) >> 1) % 2 ? C.hazY : C.hazK) : C.hatch);
          }
        }
      }
    });
  }

  function setBg(kind) {
    if (bg.kind === kind) return;
    if (bg.kind) bg.fade = 1;
    bg.kind = kind;
    bg.scroll = 0;
    getOverlays();
    bg.tile = hangarTile();
    bg.girders = [{ y: 40 }, { y: 200 }];
  }

  function updateBg(dt) {
    bg.t += dt;
    bg.scroll = (bg.scroll + dt * 24) % TH;
    for (const gd of bg.girders) {
      gd.y += dt * 24;
      if (gd.y > PH + 20) gd.y -= PH + 60;
    }
    if (bg.fade > 0) bg.fade = Math.max(0, bg.fade - dt * 1.5);
  }

  /** 벽 조명 (깜빡임 · 폭주 땐 붉은 경광등) */
  function drawLamps(alarm) {
    const t = bg.t;
    for (let i = 0; i < 4; i++) {
      const y = Math.floor((i * 100 + 70 + bg.scroll) % TH);
      if (y > PH + 6) continue;
      for (const x of [WALL - 8, PW - WALL + 6]) {
        const on = alarm ? Math.floor(t * 4 + i) % 2 === 0 : Math.floor(t * 0.7 + i * 1.3) % 7 !== 0;
        ctx.fillStyle = '#1a1e2a';
        ctx.fillRect(x - 1, y - 1, 4, 6);
        ctx.fillStyle = on ? (alarm ? '#ff3030' : '#ffd84a') : '#5a4a20';
        ctx.fillRect(x, y, 2, 4);
        if (on) {
          ctx.fillStyle = alarm ? '#4a1418' : '#343846';
          const dir = x < PW / 2 ? 1 : -1;
          for (let k = 0; k < 6; k++) for (let j = -2; j <= 6; j++) {
            const px = x + dir * (4 + k), py = y + j;
            if (((px + py) & 3) === 0 && Math.abs(j - 2) < 5 - k * 0.6) ctx.fillRect(px, py, 1, 1);
          }
        }
      }
    }
  }

  /** 들보 (머리 위를 지나가는 철골) */
  function drawGirders() {
    for (const gd of bg.girders) {
      const y = Math.round(gd.y);
      ctx.fillStyle = '#0e1018';
      for (let x = WALL; x < PW - WALL; x++) if (((x + y) & 1) === 0) { ctx.fillRect(x, y + 6, 1, 1); ctx.fillRect(x, y + 8, 1, 1); }
      ctx.fillStyle = '#1e2432';
      ctx.fillRect(0, y, PW, 5);
      ctx.fillStyle = '#3a4258';
      ctx.fillRect(0, y, PW, 1);
      ctx.fillStyle = '#141824';
      for (let x = 4; x < PW; x += 12) { ctx.fillRect(x, y + 1, 1, 3); ctx.fillRect(x + 6, y + 2, 1, 1); }
    }
  }

  function drawBg(alarm) {
    const y = Math.floor(bg.scroll);
    ctx.drawImage(bg.tile, 0, y - TH);
    ctx.drawImage(bg.tile, 0, y);
    drawLamps(alarm);
    drawGirders();
    ctx.drawImage(vignette, 0, 0);
  }

  /* =========================================================
   * 글자·창 (HUD 와 메뉴가 씀)
   * ========================================================= */
  const T = (str, x, y, o) => SH.pix.text(ctx, str, x, y, o);

  /** 9칸 창 (frame 그림을 잘라 늘림) */
  function win(x, y, w, h, o) {
    x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
    const img = SH.pix.has('frame') ? SH.pix.get('frame', 0) : null;
    if (!img) {
      ctx.fillStyle = '#1b1230'; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = o && o.hot ? '#ffd84a' : '#c9a8ff'; ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
      ctx.fillStyle = '#1e1840'; ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
      return;
    }
    const c = 4, m = 4;
    const iw = img.width - c * 2;
    ctx.drawImage(img, 0, 0, c, c, x, y, c, c);
    ctx.drawImage(img, c + iw, 0, c, c, x + w - c, y, c, c);
    ctx.drawImage(img, 0, c + iw, c, c, x, y + h - c, c, c);
    ctx.drawImage(img, c + iw, c + iw, c, c, x + w - c, y + h - c, c, c);
    ctx.drawImage(img, c, 0, m, c, x + c, y, w - c * 2, c);
    ctx.drawImage(img, c, c + iw, m, c, x + c, y + h - c, w - c * 2, c);
    ctx.drawImage(img, 0, c, c, m, x, y + c, c, h - c * 2);
    ctx.drawImage(img, c + iw, c, c, m, x + w - c, y + c, c, h - c * 2);
    ctx.drawImage(img, c, c, m, m, x + c, y + c, w - c * 2, h - c * 2);
    if (o && o.hot) {
      ctx.fillStyle = '#ffd84a';
      ctx.fillRect(x + 2, y + 1, w - 4, 1);
      ctx.fillRect(x + 2, y + h - 2, w - 4, 1);
      ctx.fillRect(x + 1, y + 2, 1, h - 4);
      ctx.fillRect(x + w - 2, y + 2, 1, h - 4);
    }
  }

  function dim(light) {
    getOverlays();
    absolute(() => ctx.drawImage(light ? dimLight : dimOverlay, 0, 0));
  }
  function dimBand(y, h) {
    getOverlays();
    ctx.drawImage(dimOverlay, 0, y, PW, h, 0, y, PW, h);
  }

  /** 줄무늬 띠 (경고) */
  function hazard(y, t) {
    ctx.fillStyle = '#1b1230';
    ctx.fillRect(0, y, PW, 9);
    ctx.fillStyle = '#ffd84a';
    const off = Math.floor(t * 30) % 12;
    for (let x = -12; x < PW + 12; x += 12) for (let j = 0; j < 7; j++) ctx.fillRect(x + off + j, y + 1 + j, 5, 1);
  }

  /** 그림 그리기 (그림이 없으면 대신 네모) */
  function spr(name, x, y, o, fb) {
    if (SH.pix.draw(ctx, name, x, y, o)) return;
    ctx.fillStyle = (o && o.flash) ? '#fff' : fb || '#ff00ff';
    const s = (o && o.fbs) || 8;
    ctx.fillRect(Math.round(x - s / 2), Math.round(y - s / 2), s, s);
  }

  /* =========================================================
   * 무기의 조준 · 충전 표시
   * ========================================================= */
  /** 조준선: 총구에서 겨눈 방향으로 점선. 충전 중이면 더 촘촘하고 밝게 */
  function sightLine(mx, my, ang, charging, t, color) {
    const ux = Math.cos(ang), uy = Math.sin(ang);
    const step = charging ? 2 : 4;
    const off = Math.floor(t * 40) % step;
    ctx.fillStyle = color || (charging && Math.floor(t * 16) % 2 ? '#ffd0d0' : '#ff3b4e');
    for (let d = 3 + off; d < 600; d += step) {
      const x = Math.round(mx + ux * d), y = Math.round(my + uy * d);
      if (x < -2 || x > PW + 2 || y < -2 || y > PH + 2) break;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  /** 충전: 둘레에서 빛 알갱이가 총구로 빨려 들고, 총구 빛이 커짐 */
  function chargeGlow(mx, my, u, t, cols, big) {
    const n = big ? 14 : 8;
    const R0 = big ? 30 : 15;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + t * 3 + i;
      const phase = (t * 1.6 + i / n) % 1;
      const r = R0 * (1 - phase) * (0.5 + 0.5 * (1 - u * 0.5));
      ctx.fillStyle = cols[i % cols.length];
      ctx.fillRect(Math.round(mx + Math.cos(a) * r), Math.round(my + Math.sin(a) * r), phase > 0.7 ? 2 : 1, phase > 0.7 ? 2 : 1);
    }
    const rr = (big ? 3 : 1.5) + u * (big ? 7 : 3.5) + (Math.floor(t * 20) & 1);
    SH.fx.pixelCircle(ctx, mx, my, rr + 1, cols[0], 1);
    ctx.fillStyle = cols[1];
    ctx.fillRect(Math.round(mx - rr / 2), Math.round(my - rr / 2), Math.round(rr), Math.round(rr));
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(Math.round(mx - 1), Math.round(my - 1), 2, 2);
  }
  const CHARGE = {
    red: ['#ff3b4e', '#ffb0a0'], purple: ['#9a4dff', '#e2ccff'], orange: ['#ff8a2a', '#fff4a8'],
  };

  function weaponTell(g, w, mx, my) {
    const t = g.time;
    if (w.state === 'aim' || w.state === 'charge') {
      if (w.kind === 'turret' || w.kind === 'cannon' || w.kind === 'gun') sightLine(mx, my, w.ang, w.state === 'charge', t);
    }
    if (w.state !== 'charge') return;
    const u = w.charge;
    if (w.kind === 'cannon') chargeGlow(mx, my, u, t, CHARGE.red, w.big);
    else if (w.kind === 'turret') chargeGlow(mx, my, u, t, CHARGE.orange, false);
    else if (w.kind === 'gun') chargeGlow(mx, my, u, t, CHARGE.red, false);
    else if (w.kind === 'emitter') {
      // 플라스마 구체가 자라남
      const r = 1 + u * 5 + (Math.floor(t * 18) & 1);
      ctx.fillStyle = '#44257e';
      ctx.fillRect(Math.round(mx - r - 1), Math.round(my - r - 1), Math.round(r * 2 + 2), Math.round(r * 2 + 2));
      SH.fx.pixelCircle(ctx, mx, my, r, '#c9a8ff', 2);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(Math.round(mx - 1), Math.round(my - 1), 2, 2);
      chargeGlow(mx, my, u, t, CHARGE.purple, false);
    } else if (w.kind === 'vent') {
      if (R() < 0.35) SH.fx.anim('puff', mx + (R() - 0.5) * 8, my - 2, 12);
      ctx.fillStyle = Math.floor(t * 12) & 1 ? '#8fd4ff' : '#3a86f0';
      ctx.fillRect(Math.round(mx - 4), Math.round(my - 1), 9, 2);
    } else if (w.kind === 'core') {
      SH.fx.pixelCircle(ctx, mx, my, 15 + u * 6 + (Math.floor(t * 20) & 1), g.bossPhase.berserk ? '#ff5a5a' : '#e2ccff', 1);
      chargeGlow(mx, my, u, t, g.bossPhase.berserk ? CHARGE.red : CHARGE.purple, false);
    } else if (w.kind === 'antenna') {
      // 신호: 퍼지는 고리
      const k = (t * 3) % 1;
      SH.fx.pixelCircle(ctx, mx, my, 3 + k * 16, Math.floor(t * 12) & 1 ? '#ff3b4e' : '#ffd84a', 1);
      ctx.fillStyle = '#ff3b4e';
      ctx.fillRect(Math.round(mx - 1), Math.round(my - 2), 3, 3);
    }
  }

  /* =========================================================
   * 보스: 몸통 + 무기
   * ========================================================= */
  function muzzlePx(g, w) {
    const [x, y] = g.muzzle(w);
    return [x * K, y * K];
  }
  function drawBoss(g) {
    const B = g.boss;
    if (!B) return;
    const bx = B.x * K, by = B.y * K;
    const ph = g.bossPhase;
    let flash = B.flash > 0;
    if (B.state === 'transform' && Math.floor(g.time * 18) % 2) flash = true;
    if (B.state === 'dying') {
      if (Math.floor(g.time * 16) % 2) flash = true;
      if (B.st > 2.8 && Math.floor(g.time * 24) % 2) return;
    }
    const blink = Math.floor(g.time * (ph.berserk ? 8 : 3)) & 1;
    spr('titan', bx, by, { frame: B.look * 2 + blink, flash, fbs: 60 }, '#5e6e8c');

    const pos = (w) => [bx + w.ox * K, by + w.oy * K];
    const Wp = B.w;
    // 1단계 포탑
    for (const n of ['turretL', 'turretR']) {
      const w = Wp[n];
      if (B.look > 0) continue;
      const [x, y] = pos(w);
      if (w.alive) {
        const rx = x - Math.cos(w.ang) * w.recoil * 2, ry = y - Math.sin(w.ang) * w.recoil * 2;
        spr('turret', rx, ry, { frame: SH.turretFrame(w.ang), flash: w.flash > 0 || flash, fbs: 12 }, '#8e9ebc');
        if (B.state === 'fight' && w.hp < w.maxHp) {
          const bw = 16, r = w.hp / w.maxHp;
          ctx.fillStyle = '#0e1220'; ctx.fillRect(Math.round(x - bw / 2) - 1, Math.round(y + 13), bw + 2, 3);
          ctx.fillStyle = r > 0.3 ? '#ffd84a' : '#e8384f'; ctx.fillRect(Math.round(x - bw / 2), Math.round(y + 14), Math.max(1, Math.round(bw * r)), 1);
        }
      } else {
        spr('turretWreck', x, y, { frame: Math.floor(g.time * 6), fbs: 10 }, '#3a4660');
        if (R() < 0.08) SH.fx.anim('puff', x + (R() - 0.5) * 6, y - 4, 10);
      }
    }
    // 미사일 포드 (3단계부터)
    for (const n of ['podL', 'podR']) {
      const w = Wp[n];
      if (!w.alive || B.phase < w.unlock) continue;
      const [x, y] = pos(w);
      const rise = (1 - w.reveal) * 6;
      spr('pod', x, y + rise, { frame: Math.min(3, Math.round(w.open * 3)), flash, alpha: w.reveal < 1 && Math.floor(g.time * 20) % 2 ? 0.5 : 1, fbs: 10 }, '#5e6e8c');
    }
    // 주포 (2단계부터, 안에서 밀려 나옴)
    const c = Wp.cannon;
    if (c.alive && B.phase >= c.unlock) {
      const [x, y] = pos(c);
      const slide = (1 - c.reveal) * -10;
      const rx = x - Math.cos(c.ang) * c.recoil * 3, ry = y + slide - Math.sin(c.ang) * c.recoil * 3;
      spr('cannon', rx, ry, { frame: SH.cannonFrame(c.ang), flash: flash || (c.state === 'cool' && Math.floor(g.time * 10) % 2), fbs: 14 }, '#8e9ebc');
      if (c.state === 'cool' && R() < 0.3) { const [mx, my] = muzzlePx(g, c); SH.fx.anim('puff', mx, my, 12); }
    }
    // 조준 · 충전 표시
    if (B.state === 'fight') {
      for (const w of Object.values(Wp)) {
        if (!w.alive || B.phase < w.unlock || (w.lose != null && B.phase >= w.lose)) continue;
        if (w.state === 'idle' || w.state === 'fire') continue;
        const [mx, my] = muzzlePx(g, w);
        weaponTell(g, w, mx, my);
      }
      // 주포가 쓸어낼 구역
      if (c.sweep && (c.state === 'aim' || c.state === 'charge')) {
        const [mx, my] = muzzlePx(g, c);
        const [a0, a1] = c.sweep;
        const steps = Math.ceil(Math.abs(a1 - a0) / 0.07);
        ctx.fillStyle = Math.floor(g.time * 10) & 1 ? '#ff3b4e' : '#8e1c3a';
        for (let i = 0; i <= steps; i++) {
          const a = a0 + ((a1 - a0) * i) / steps;
          for (let d = 18 + ((i * 3 + Math.floor(g.time * 30)) % 8); d < 560; d += 8) ctx.fillRect(Math.round(mx + Math.cos(a) * d), Math.round(my + Math.sin(a) * d), 1, 1);
        }
      }
    }
    // 1단계 코어 방어막
    if (ph.shield && B.state === 'fight' && Math.floor(g.time * 10) % 3) {
      SH.fx.pixelCircle(ctx, bx, by + g.def.core.oy * K, 20 + (Math.floor(g.time * 6) & 1), '#8fd4ff', 1);
    }
  }

  /* ---------------- 벽 레이저포 ---------------- */
  function lineThick(x0, y0, x1, y1, t) {
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      ctx.fillRect(Math.round(SH.lerp(x0, x1, u) - t / 2), Math.round(SH.lerp(y0, y1, u) - t / 2), t, t);
    }
  }
  function drawGuns(g) {
    for (const w of g.guns) {
      const x = w.x * K, y = w.y * K;
      // 벽에서 뻗어 나온 레일 팔
      const ex = w.edge === 'L' || w.edge === 'BL' ? -2 : PW + 2;
      const ey = w.edge === 'BL' || w.edge === 'BR' ? y + 10 : y;
      ctx.fillStyle = '#1a1e2a';
      lineThick(ex, ey, x, y, 4);
      ctx.fillStyle = '#56607a';
      lineThick(ex, ey - 1, x, y - 1, 1);
      ctx.fillStyle = '#c8a020';
      for (let i = 0; i < 3; i++) {
        const u = 0.2 + i * 0.25;
        ctx.fillRect(Math.round(SH.lerp(ex, x, u)), Math.round(SH.lerp(ey, y, u)) - 1, 1, 3);
      }
      spr('wallgun', x - Math.cos(w.ang) * w.recoil * 2, y - Math.sin(w.ang) * w.recoil * 2, { frame: SH.wallgunFrame(w.ang), flash: w.flash > 0, fbs: 10 }, '#6a4aa0');
      if (w.state === 'aim' || w.state === 'charge') {
        const [mx, my] = muzzlePx(g, w);
        weaponTell(g, w, mx, my);
      }
    }
  }

  /* ---------------- 레이저 (총구에서 나감) ---------------- */
  function drawBeams(g) {
    for (const bm of g.beams) {
      const ox = bm.x * K, oy = bm.y * K;
      const ux = Math.cos(bm.ang), uy = Math.sin(bm.ang);
      const grow = Math.min(1, bm.t / 0.08) * Math.min(1, (bm.dur - bm.t) / 0.12);
      const w = Math.max(1, Math.round(bm.width * K * grow));
      const fl = Math.floor(g.time * 30) & 1;
      const gunBeam = bm.src.kind === 'gun';
      const layers = gunBeam
        ? [[w + 2, '#7a2ac0'], [w, fl ? '#c9a8ff' : '#a070ff'], [Math.max(1, w - 3), '#f0e4ff'], [Math.max(1, w - 5), '#ffffff']]
        : [[w + 2, '#e8384f'], [w, fl ? '#ff8a8a' : '#ff6a6a'], [Math.max(1, w - 4), '#ffd0d0'], [Math.max(1, w - 6), '#ffffff']];
      for (const [lw, c] of layers) {
        ctx.fillStyle = c;
        for (let d = 2; d < 600; d += 1) {
          const x = ox + ux * d, y = oy + uy * d;
          if (x < -10 || x > PW + 10 || y < -10 || y > PH + 10) break;
          ctx.fillRect(Math.round(x - lw / 2), Math.round(y - lw / 2), lw, lw);
        }
      }
      SH.pix.draw(ctx, 'boom', ox, oy, { frame: 1 + (Math.floor(g.time * 20) % 2), scale: bm.width > 30 ? 2 : 1 });
    }
  }

  /* =========================================================
   * 나 · 탄 · 아이템
   * ========================================================= */
  function drawPlayerBullets(g) {
    for (const b of g.pb) {
      const x = b.x * K, y = b.y * K;
      if (b.kind === 'spread') spr('shot_spread', x, y, { frame: b.rot < -0.05 ? 1 : b.rot > 0.05 ? 2 : 0, fbs: 3 }, '#ffd84a');
      else if (b.kind === 'homing') spr('shot_homing', x, y, { fbs: 3 }, '#a6f070');
      else if (b.kind === 'laser') spr('shot_laser', x, y, { frame: (b.lv || 1) - 1, fbs: 4 }, '#8fd4ff');
      else if (b.kind === 'missile') {
        const dir = Math.round((((b.rot % TAU) + TAU) % TAU) / (Math.PI / 4)) % 8;
        spr('missile', x, y, { frame: dir, fbs: 4 }, '#45c44a');
      }
    }
  }

  function drawEnemyBullets(g) {
    const f = Math.floor(g.time * 8) & 1;
    for (const b of g.eb) {
      if (b.missile) {
        const dir = Math.round((((b.rot + Math.PI / 2) % TAU) + TAU) % TAU / (Math.PI / 4)) % 8;
        spr('emissile', b.x * K, b.y * K, { frame: dir, fbs: 5 }, '#e8384f');
        if (R() < 0.3) SH.fx.anim('puff', b.x * K - Math.cos(b.rot) * 5, b.y * K - Math.sin(b.rot) * 5, 14);
      } else spr((b.big ? 'big_' : 'orb_') + b.kind, b.x * K, b.y * K, { frame: f, fbs: b.big ? 10 : 5 }, '#ff4f9a');
    }
  }

  function drawItems(g) {
    for (const it of g.items) {
      const x = it.x * K, y = it.y * K;
      const t = it.t;
      switch (it.kind) {
        case 'gem': spr('gem', x, y, { frame: Math.floor(t * 10 + it.x), fbs: 4 }, '#8fd4ff'); break;
        case 'bigGem': spr('bigGem', x, y, { frame: Math.floor(t * 6), fbs: 6 }, '#ffd84a'); break;
        case 'spark': spr('spark', x, y, { frame: Math.floor(t * 16), fbs: 2 }, '#fff4a8'); break;
        case 'power': spr('item_' + it.wtype, x, y, { frame: Math.floor(t * 6), fbs: 10 }, SH.WEAPONS[it.wtype].color); break;
        default: spr('item_' + it.kind, x, y + (Math.floor(t * 4) % 2), { frame: Math.floor(t * 6), fbs: 10 }, '#ffffff');
      }
    }
  }

  function drawPlayer(g) {
    const p = g.player;
    if (p.dead) return;
    const x = p.x * K, y = p.y * K;
    const blink = p.inv > 0 && !p.entering && Math.floor(g.time * 15) % 2 === 0;
    if (!blink) {
      spr('flame', x, y + 15, { frame: Math.floor(g.time * 20), fbs: 3 }, '#8fd4ff');
      spr('player', x, y, { frame: p.bank < -0.35 ? 0 : p.bank > 0.35 ? 2 : 1, fbs: 12 }, '#ffffff');
    }
    if (p.shield > 0 && !(p.shield < 2 && Math.floor(g.time * 10) % 2)) spr('shield', x, y, { frame: Math.floor(g.time * 6), fbs: 1 }, '#8fd4ff');
    if (!p.entering && !p.exiting) {
      const cx = Math.round(x), cy = Math.round(y);
      ctx.fillStyle = '#ff3a7a';
      ctx.fillRect(cx - 1, cy - 1, 3, 3);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(cx, cy, 1, 1);
    }
  }

  /* =========================================================
   * HUD: 왼쪽 위 점수·목숨·폭탄 · 가운데 위 보스 체력 · 오른쪽 위 무기
   * ========================================================= */
  function drawHud(g, best) {
    T('점수', 22, 6, { color: '#ffd84a', size: 9 });
    T(SH.fmt(g.score), 46, 6, { color: '#ffffff' });
    T('최고', 22, 16, { color: '#ff7aa8', size: 9 });
    T(SH.fmt(Math.max(best, g.score)), 46, 16, { color: '#ffe3ee' });
    const lives = Math.max(0, g.lives);
    if (lives > 5) {
      spr('icon_life', 26, 25, { fbs: 6 }, '#ffffff');
      T('×' + lives, 33, 25, { color: '#ffffff' });
    } else for (let i = 0; i < lives; i++) spr('icon_life', 26 + i * 10, 25, { fbs: 6 }, '#ffffff');
    for (let i = 0; i < g.bombs; i++) spr('icon_bomb', 26 + i * 10, 35, { fbs: 6 }, '#ffd84a');
    const w = SH.WEAPONS[g.weapon];
    T(SH.fx.WNAME[g.weapon], PW - 28, 6, { color: w.light, align: 'right', size: 9 });
    for (let i = 0; i < SH.MAX_POWER; i++) {
      ctx.fillStyle = '#1b1230';
      ctx.fillRect(PW - 59 + i * 6, 12, 5, 4);
      ctx.fillStyle = i < g.power ? w.color : '#3a3058';
      ctx.fillRect(PW - 58 + i * 6, 13, 3, 2);
    }
    if (g.loop > 0) T(`${g.loop + 1}회차`, PW - 28, 24, { color: '#ff9ac2', align: 'right', size: 9 });

    const B = g.boss;
    if (B && B.state !== 'dying') {
      const ph = g.bossPhase;
      const fillIn = B.state === 'enter' ? Math.min(1, B.st / 3) : 1;
      const ratio = Math.max(0, B.hp / B.maxHp) * fillIn;
      bossLag = ratio > bossLag ? ratio : bossLag + (ratio - bossLag) * 0.05;
      const w2 = 190, x = (PW - w2) / 2, y = 3;
      ctx.fillStyle = '#1b1230';
      ctx.fillRect(x, y, w2, 6);
      ctx.fillStyle = '#3a2050';
      ctx.fillRect(x + 1, y + 1, w2 - 2, 4);
      if (ph.shield) {
        ctx.fillStyle = '#5e6e8c';
        ctx.fillRect(x + 1, y + 1, Math.round((w2 - 2) * ratio), 4);
        for (let i = 0; i < w2 - 2; i += 4) { ctx.fillStyle = '#8fd4ff'; ctx.fillRect(x + 1 + i + (Math.floor(g.time * 8) % 4), y + 2, 1, 2); }
      } else {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x + 1, y + 1, Math.round((w2 - 2) * bossLag), 4);
        ctx.fillStyle = ph.berserk ? '#ff3030' : '#e8384f';
        ctx.fillRect(x + 1, y + 1, Math.round((w2 - 2) * ratio), 4);
        ctx.fillStyle = '#ff8a9a';
        ctx.fillRect(x + 1, y + 1, Math.round((w2 - 2) * ratio), 1);
      }
      ctx.fillStyle = '#1b1230';
      for (const p of g.def.phases) if (p.until > 0) ctx.fillRect(x + Math.round(w2 * p.until), y, 1, 6);
      // 단계 표시 (■■□□) · 시간
      for (let i = 0; i < g.def.phases.length; i++) {
        ctx.fillStyle = '#1b1230';
        ctx.fillRect(x + w2 + 4 + i * 7, y, 6, 6);
        ctx.fillStyle = i < B.phase ? '#5a5680' : i === B.phase ? (ph.berserk ? '#ff3030' : '#ffd84a') : '#2a2448';
        ctx.fillRect(x + w2 + 5 + i * 7, y + 1, 4, 4);
      }
      if (B.state !== 'enter') T(fmtTime(g.fightT), x + w2 + 34, y + 3, { color: '#ffffff' });
      T(ph.shield ? `${g.def.name} · 방어막` : g.def.name, PW / 2, y + 13, { color: ph.shield ? '#8fd4ff' : ph.berserk ? '#ff5a5a' : '#ff8a8a', align: 'center', size: 9 });
    } else bossLag = 1;
  }

  function fmtTime(sec) {
    const m = Math.floor(sec / 60), r = Math.floor(sec % 60);
    return `${m}:${String(r).padStart(2, '0')}`;
  }

  /* =========================================================
   * 안내 (시작 · 경고 · 클리어 · 짧은 알림)
   * ========================================================= */
  function drawBanners(g) {
    const cy = Math.round(PH * 0.52);
    if (g.phase === 'intro') {
      const u = g.phaseT;
      if (u < 1.95 && !(u > 1.6 && Math.floor(u * 20) % 2)) {
        const slide = Math.max(0, 1 - u / 0.35) * 180;
        dimBand(cy - 30, 60);
        T(g.stage.en, PW / 2 - slide, cy - 12, { color: '#ffd84a', scale: 3, align: 'center', shadow: '#8a3a10' });
        T(g.stage.name, PW / 2 + slide, cy + 14, { color: '#ffffff', align: 'center', size: 12 });
        if (g.loop > 0) T(`${g.loop + 1}회차 · 더 강해진 요새`, PW / 2, cy + 32, { color: '#c9a8ff', align: 'center', size: 10 });
      }
    } else if (g.phase === 'warning') {
      const u = g.phaseT;
      if (u < 2.7) {
        if (Math.floor(u * 6) % 2 === 0) {
          ctx.fillStyle = '#ff1e3c';
          ctx.globalAlpha = 0.18;
          ctx.fillRect(0, 0, PW, PH);
          ctx.globalAlpha = 1;
        }
        hazard(cy - 40, u);
        hazard(cy + 32, -u);
        if (Math.floor(u * 4) % 2 === 0) T('경고!', PW / 2, cy - 16, { color: '#ff3b4e', scale: 3, align: 'center', shadow: '#5a0a1a' });
        T(g.def.title, PW / 2, cy + 6, { color: '#ffd0d6', align: 'center', size: 10 });
        T(g.def.name, PW / 2, cy + 20, { color: '#ffffff', align: 'center', size: 12 });
      }
    } else if (g.phase === 'clear' && g.tally) {
      const u = g.phaseT;
      if (u > 0.6 && u < 5.4) {
        const Tl = g.tally;
        const w = 240, h = 132, x0 = (PW - w) / 2, y0 = cy - h / 2;
        win(x0, y0, w, h);
        T('작전 성공!', PW / 2, y0 + 14, { color: '#ffd84a', scale: 2, align: 'center', shadow: '#8a3a10' });
        const rows = [['격파 보너스', Tl.clearBonus], [`시간 보너스 ${fmtTime(Tl.fightTime)}`, Tl.timeBonus], ['노미스 보너스', Tl.noMiss], ['남은 폭탄', Tl.bombBonus]];
        rows.forEach(([label, v], i) => {
          const show = Math.min(1, Math.max(0, (u - 1.0 - i * 0.45) / 0.4));
          if (show <= 0) return;
          const yy = y0 + 38 + i * 15;
          T(label, x0 + 12, yy, { color: '#e8e0ff', size: 10 });
          T(v ? '+' + SH.fmt(v * show) : '-', x0 + w - 12, yy, { color: v ? '#ffffff' : '#8f86b0', align: 'right' });
        });
        const tot = Math.min(1, Math.max(0, (u - 2.5) / 0.5));
        if (tot > 0) {
          ctx.fillStyle = '#5a5680';
          ctx.fillRect(x0 + 12, y0 + 100, w - 24, 1);
          T('합계', x0 + 12, y0 + 114, { color: '#ffd84a', size: 10 });
          T('+' + SH.fmt(Tl.total * tot), x0 + w - 12, y0 + 114, { color: '#ffd84a', align: 'right' });
        }
      }
    }
    if (notice) {
      const a = notice.t < notice.dur - 0.4 || Math.floor(notice.t * 20) % 2;
      if (a) {
        const ny = 128;
        const pop = Math.min(1, notice.t / 0.15);
        T(notice.title, PW / 2, ny, { color: notice.color, align: 'center', size: notice.ascii ? undefined : (notice.big ? 16 : 11) * (0.7 + 0.3 * pop) });
        if (notice.sub) T(notice.sub, PW / 2, ny + (notice.big ? 18 : 13), { color: '#ffffff', align: 'center', size: 10 });
      }
    }
  }

  function showNotice(title, sub, color, dur, big) {
    notice = { title, sub, color: color || '#ffffff', t: 0, dur: dur || 2, ascii: !/[^\x00-\x7f]/.test(title), big: !!big };
  }

  /* =========================================================
   * 한 장면
   * ========================================================= */
  function drawGame(g, dt, opts) {
    setBg(g.stage.bg);
    updateBg(dt);
    if (notice && dt > 0) {
      notice.t += dt;
      if (notice.t >= notice.dur) notice = null;
    }
    const ph = g.bossPhase;
    const alarm = !!(ph && ph.berserk && g.boss && g.boss.state !== 'dying');
    const st = SH.fx.state;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.save();
    if (st.shake > 0.5) ctx.translate(Math.round((R() - 0.5) * st.shake), Math.round((R() - 0.5) * st.shake));
    drawBg(alarm);
    drawBoss(g);
    drawGuns(g);
    drawPlayerBullets(g);
    drawItems(g);
    drawPlayer(g);
    SH.fx.draw(ctx);
    drawBeams(g);
    drawEnemyBullets(g);
    ctx.restore();

    if (alarm && Math.floor(g.time * 3) % 2) {
      ctx.globalAlpha = 0.1;
      ctx.fillStyle = '#ff1e3c';
      ctx.fillRect(0, 0, PW, PH);
      ctx.globalAlpha = 1;
    }
    if (g.bombT > 0 && Math.floor(g.time * 12) % 2) {
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = '#ffd84a';
      ctx.fillRect(0, 0, PW, PH);
      ctx.globalAlpha = 1;
    }
    if (st.flash > 0.02) {
      ctx.globalAlpha = Math.min(0.85, st.flash);
      ctx.fillStyle = st.flashColor;
      ctx.fillRect(0, 0, PW, PH);
      ctx.globalAlpha = 1;
    }
    if (bg.fade > 0) {
      ctx.globalAlpha = bg.fade;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, PW, PH);
      ctx.globalAlpha = 1;
    }
    SH.fx.drawText(ctx, (x, y) => [x, y]);
    if (!opts || !opts.noHud) drawHud(g, (opts && opts.best) || 0);
    if (!opts || !opts.frozen) drawBanners(g);
    ctx.restore();
  }

  /** 타이틀 배경: 요새 안, 오른쪽에 강철 요새가 버티고 왼쪽 아래에서 비행기가 맞서 날아감 */
  function drawTitle(dt, noBoss) {
    title.t += dt;
    absolute(() => {
      setBg('hangar');
      updateBg(dt);
      drawBg(false);
      const t = title.t;
      if (!noBoss) {
        const bx = 404 + Math.sin(t * 0.4) * 5, by = 176 + Math.sin(t * 0.9) * 3;
        SH.pix.draw(ctx, 'titan', bx, by, { frame: Math.floor(t * 3) & 1 });
        for (const s2 of [-1, 1]) SH.pix.draw(ctx, 'turret', bx + s2 * 50, by + 12, { frame: 4 + Math.round(Math.sin(t * 0.7 + s2) * 2) });
      }
      const px = 88 + Math.sin(t * 0.8) * 34, py = 226 + Math.sin(t * 1.3) * 3;
      const bank = Math.cos(t * 0.8);
      SH.pix.draw(ctx, 'flame', px, py + 15, { frame: Math.floor(t * 20) });
      SH.pix.draw(ctx, 'player', px, py, { frame: bank > 0.5 ? 2 : bank < -0.5 ? 0 : 1 });
      SH.fx.update(dt);
      SH.fx.draw(ctx);
      SH.fx.drawText(ctx, (x, y) => [x, y]);
    });
  }

  function reset() {
    notice = null;
    bossLag = 1;
  }

  return {
    PW, PH, SW: PW, SH: PH, K, MENU_Y, init, resize, present, drawGame, drawTitle, showNotice, reset, win, dim, T, spr, hazard, fmtTime,
    get ctx() { return ctx; },
  };
})();
