'use strict';

/* =========================================================
 * 하늘 사냥꾼 — 픽셀 화면 그리기
 *
 * 모든 것을 225×400 픽셀 버퍼(SH.render.ctx)에 그린 다음 present() 로
 * 번짐 없이(최근접) 화면 캔버스에 크게 늘려 옮깁니다.
 * 게임 좌표(450×800)는 절반으로 줄여 픽셀 좌표가 됩니다.
 * ========================================================= */

SH.render = (() => {
  const PW = 225, PH = 400, K = 0.5;
  let view = null, vctx = null, buf = null, ctx = null;
  const bg = { kind: null, props: [], tiles: null, scroll: 0, embers: [], rain: [], bolt: 0, boltX: 0, nextBolt: 5, fade: 0, t: 0 };
  let notice = null;
  let bossLag = 1;
  const title = { t: 0, mobs: [] };
  const R = Math.random;
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
    const o = (y * w + x) * 4;
    d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = c[3];
  }
  /** 0..1 값을 색 단계로 (단계 사이를 바이어 디더링) */
  function ramp(cols, v, x, y) {
    const n = cols.length - 1;
    const f = Math.max(0, Math.min(0.9999, v)) * n;
    const i = Math.floor(f);
    return bayer(x, y) < f - i ? cols[Math.min(n, i + 1)] : cols[i];
  }
  const TAU = Math.PI * 2;

  /* =========================================================
   * 배경
   * ========================================================= */
  function skyTile() {
    const cols = ['#3672d8', '#4589e6', '#5aa0ef', '#71b6f5', '#8ccaf8', '#a9dcfa', '#c8ecfc'].map(hex);
    return canvasFrom(PW, PH, (d, w, h) => {
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) put(d, w, x, y, ramp(cols, y / h, x, y));
    });
  }

  function seaTile() {
    const base = ['#0f3468', '#14457f', '#1a5696', '#2167aa'].map(hex);
    const crest = hex('#7fbcec'), white = hex('#d8f2ff'), shadow = hex('#0f3468');
    return canvasFrom(PW, PH, (d, w, h) => {
      for (let y = 0; y < h; y++) {
        const v = (y / h) * TAU;
        for (let x = 0; x < w; x++) {
          const n = 0.5 + 0.22 * Math.sin(x * 0.045 + v * 2) + 0.16 * Math.sin(x * 0.11 - v * 3 + 1.3) + 0.1 * Math.sin(x * 0.23 + v * 5);
          put(d, w, x, y, ramp(base, n, x, y));
        }
      }
      // 물결
      for (let i = 0; i < 150; i++) {
        const x0 = Math.floor(R() * w), y0 = Math.floor(R() * h), len = 3 + Math.floor(R() * 5);
        for (let k = 0; k < len; k++) {
          const x = (x0 + k) % w;
          const yy = (y0 + (k === 0 || k === len - 1 ? 1 : 0)) % h;
          put(d, w, x, yy, k === 1 ? white : crest);
          put(d, w, x, (yy + 1) % h, shadow);
        }
      }
    });
  }

  function lavaTiles() {
    const rock = ['#170810', '#221018', '#2e1620', '#3a1e26'].map(hex);
    const glow = hex('#4a1410');
    const L = ['#8a1c0e', '#d23a16', '#ff6a1a', '#ffa62a', '#ffe58a'].map(hex);
    const rivers = [[42, 18, 1, 0.3, 8], [132, 26, 2, 2.1, 10], [200, 14, 1, 4.2, 6]];
    const make = (shift) => canvasFrom(PW, PH, (d, w, h) => {
      for (let y = 0; y < h; y++) {
        const v = (y / h) * TAU;
        for (let x = 0; x < w; x++) {
          const n = 0.45 + 0.2 * Math.sin(x * 0.07 + v * 3) + 0.18 * Math.sin(x * 0.19 - v * 4 + 2) + 0.12 * Math.sin(x * 0.41 + v * 7);
          put(d, w, x, y, ramp(rock, n, x, y));
        }
        for (const [x0, amp, k, ph, wd] of rivers) {
          const cx = x0 + Math.sin(v * k + ph) * amp + Math.sin(v * (k + 2)) * 5;
          const half = wd / 2 + Math.sin(v * 5 + ph) * 1.5;
          for (let x = Math.floor(cx - half - 4); x <= Math.ceil(cx + half + 4); x++) {
            if (x < 0 || x >= w) continue;
            const dist = Math.abs(x + 0.5 - cx) / half;
            if (dist > 1) {
              if (dist < 1 + 4 / half && bayer(x, y) < 0.55) put(d, w, x, y, glow);
              continue;
            }
            const lvl = Math.min(4, Math.floor((1 - dist) * 5 + ((shift + y * 0.25) % 1 > 0.5 && dist < 0.4 ? 1 : 0)));
            put(d, w, x, y, L[Math.max(0, lvl)]);
          }
        }
      }
      // 갈라진 틈
      const crack = hex('#ff5a1a'), crackD = hex('#6a1a10');
      const rnd = SH.rng(99);
      for (let i = 0; i < 30; i++) {
        let x = rnd() * w, y = rnd() * h;
        for (let s = 0; s < 9; s++) {
          const xi = Math.floor(x) % w, yi = Math.floor(y) % h;
          put(d, w, (xi + w) % w, yi, s % 3 === 1 ? crack : crackD);
          x += (rnd() - 0.5) * 3;
          y += 1 + rnd();
        }
      }
    });
    return [make(0), make(0.5)];
  }

  function overlay(fn, color) {
    const c = hex(color);
    return canvasFrom(PW, PH, (d, w, h) => {
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (bayer(x, y) < fn(x, y)) put(d, w, x, y, c);
    });
  }
  let stormOverlay = null, lavaOverlay = null, dimOverlay = null, dimLight = null;
  function getOverlays() {
    if (!stormOverlay) {
      stormOverlay = overlay((x, y) => Math.max(0, 0.7 - y / 140), '#081430');
      lavaOverlay = overlay((x, y) => {
        const dx = (x - PW / 2) / (PW / 2), dy = (y - PH * 0.55) / (PH * 0.6);
        return Math.max(0, Math.hypot(dx, dy) - 0.75) * 1.6;
      }, '#0a0306');
      dimOverlay = overlay(() => 0.62, '#0c0820');
      dimLight = overlay(() => 0.4, '#0c0820');
    }
  }

  function prop(name, layer, sp, top) {
    const inf = SH.pix.info(name) || { w: 40, h: 20 };
    return { name, layer, sp, x: 10 + R() * (PW - 20), y: top ? -inf.h - R() * 160 : R() * PH, h: inf.h };
  }

  function setBg(kind) {
    if (bg.kind === kind) return;
    if (bg.kind) bg.fade = 1;
    bg.kind = kind;
    bg.props = [];
    bg.scroll = 0;
    getOverlays();
    if (kind === 'sky') {
      bg.tiles = [skyTile()];
      bg.props.push(prop('island', 0, 12, false), prop('island', 0, 12, true));
      for (const [n, l, s] of [['cloud3', 1, 20], ['cloud1', 1, 20], ['cloud3', 1, 20], ['cloud0', 2, 42], ['cloud2', 2, 42], ['cloud1', 2, 42]]) bg.props.push(prop(n, l, s, false));
    } else if (kind === 'sea') {
      bg.tiles = [seaTile()];
      bg.props.push(prop('rock', 0, 35, false), prop('rock', 0, 35, true));
      bg.rain = [];
      for (let i = 0; i < 45; i++) bg.rain.push({ x: R() * (PW + 60), y: R() * PH, s: 230 + R() * 120 });
    } else if (kind === 'lava') {
      bg.tiles = lavaTiles();
      bg.embers = [];
      for (let i = 0; i < 40; i++) bg.embers.push({ x: R() * PW, y: R() * PH, s: 14 + R() * 30, ph: R() * TAU });
    }
  }

  function updateBg(dt, slow) {
    const k = slow ? 0.6 : 1;
    bg.t += dt;
    const sp = bg.kind === 'sea' ? 35 : 28;
    bg.scroll = (bg.scroll + dt * sp * k) % PH;
    for (const p of bg.props) {
      p.y += p.sp * dt * k;
      if (p.y - p.h / 2 > PH) {
        p.y = -p.h / 2 - R() * 140;
        p.x = 10 + R() * (PW - 20);
      }
    }
    if (bg.kind === 'sea') {
      for (const r of bg.rain) {
        r.y += r.s * dt;
        r.x -= r.s * 0.3 * dt;
        if (r.y > PH + 4) { r.y = -4; r.x = R() * (PW + 60); }
      }
      bg.nextBolt -= dt;
      if (bg.nextBolt <= 0) { bg.bolt = 1; bg.boltX = 20 + R() * (PW - 40); bg.nextBolt = (slow ? 3 : 6) + R() * 5; }
      bg.bolt = Math.max(0, bg.bolt - dt * 3);
    } else if (bg.kind === 'lava') {
      for (const e of bg.embers) {
        e.y -= e.s * dt;
        e.ph += dt * 3;
        if (e.y < -2) { e.y = PH + 2; e.x = R() * PW; }
      }
    }
    if (bg.fade > 0) bg.fade = Math.max(0, bg.fade - dt * 1.5);
  }

  function drawBg() {
    if (bg.kind === 'sky') {
      ctx.drawImage(bg.tiles[0], 0, 0);
      for (let layer = 0; layer < 3; layer++) for (const p of bg.props) if (p.layer === layer) SH.pix.draw(ctx, p.name, p.x, p.y);
      return;
    }
    const tile = bg.tiles[bg.kind === 'lava' ? Math.floor(bg.t * 3) % 2 : 0];
    const y = Math.floor(bg.scroll);
    ctx.drawImage(tile, 0, y - PH);
    ctx.drawImage(tile, 0, y);
    for (const p of bg.props) SH.pix.draw(ctx, p.name, p.x, p.y);
    if (bg.kind === 'sea') {
      ctx.drawImage(stormOverlay, 0, 0);
      ctx.fillStyle = '#9cc4f0';
      for (const r of bg.rain) {
        const x = Math.round(r.x), yy = Math.round(r.y);
        ctx.fillRect(x, yy, 1, 1);
        ctx.fillRect(x - 1, yy + 1, 1, 1);
        ctx.fillRect(x - 1, yy + 2, 1, 1);
      }
      if (bg.bolt > 0.5) {
        ctx.fillStyle = '#fff8c0';
        let x = bg.boltX;
        for (let yy = 0; yy < 90; yy += 3) {
          ctx.fillRect(Math.round(x), yy, 2, 3);
          x += (R() - 0.5) * 6;
        }
      }
    } else {
      ctx.drawImage(lavaOverlay, 0, 0);
      for (const e of bg.embers) {
        ctx.fillStyle = Math.sin(e.ph) > 0 ? '#ffb02e' : '#ff6a1a';
        ctx.fillRect(Math.round(e.x + Math.sin(e.ph) * 2), Math.round(e.y), 1, 1);
      }
    }
  }

  /* =========================================================
   * 글자·창
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
    ctx.drawImage(light ? dimLight : dimOverlay, 0, 0);
  }

  /** 줄무늬 띠 (경고) */
  function hazard(y, t) {
    ctx.fillStyle = '#1b1230';
    ctx.fillRect(0, y, PW, 9);
    ctx.fillStyle = '#ffd84a';
    const off = Math.floor(t * 30) % 12;
    for (let x = -12; x < PW + 12; x += 12) {
      for (let j = 0; j < 7; j++) ctx.fillRect(x + off + j, y + 1 + j, 5, 1);
    }
  }

  /** 그림이 없으면 대신 네모 */
  function spr(name, x, y, o, fb) {
    if (SH.pix.draw(ctx, name, x, y, o)) return;
    ctx.fillStyle = (o && o.flash) ? '#fff' : fb || '#ff00ff';
    const s = (o && o.fbs) || 8;
    ctx.fillRect(Math.round(x - s / 2), Math.round(y - s / 2), s, s);
  }

  /* =========================================================
   * 게임 물체
   * ========================================================= */
  /* 기계 보스: 몸통(모습별) + 포탑 + 코어 방어막 */
  function drawBoss(g) {
    const e = g.boss;
    if (!e) return;
    const x = e.x * K, y = e.y * K;
    const ph = g.bossPhase;
    let flash = e.flash > 0;
    if (e.inv > 0 && Math.floor(g.time * 20) % 2) flash = true;
    if (e.state === 'dying') {
      if (Math.floor(g.time * 16) % 2) flash = true;
      if (e.st > 2.8 && Math.floor(g.time * 24) % 2) return;
    }
    const blink = Math.floor(g.time * (ph.berserk ? 8 : 3)) & 1;
    spr('titan', x, y, { frame: ph.look * 2 + blink, flash, fbs: 60 }, '#5e6e8c');
    for (const p of Object.values(e.parts)) {
      const px = x + p.ox * K, py = y + p.oy * K;
      if (p.alive) {
        spr('turret', px, py, { frame: SH.turretFrame ? SH.turretFrame(p.ang) : 4, flash: p.flash > 0 || flash, fbs: 12 }, '#8e9ebc');
        if (e.state === 'fight' && p.hp < p.maxHp) {
          const w = 16, r = p.hp / p.maxHp;
          ctx.fillStyle = '#0e1220'; ctx.fillRect(Math.round(px - w / 2) - 1, Math.round(py + 13), w + 2, 3);
          ctx.fillStyle = r > 0.3 ? '#ffd84a' : '#e8384f'; ctx.fillRect(Math.round(px - w / 2), Math.round(py + 14), Math.max(1, Math.round(w * r)), 1);
        }
      } else {
        spr('turretWreck', px, py, { frame: Math.floor(g.time * 6), fbs: 10 }, '#3a4660');
        if (Math.random() < 0.08) SH.fx.anim('puff', px + (Math.random() - 0.5) * 6, py - 4, 10);
      }
    }
    // 코어 방어막
    if (ph.shield && e.state === 'fight' && Math.floor(g.time * 10) % 3) {
      SH.fx.pixelCircle(ctx, x, y + g.def.core.oy * K, 21 + (Math.floor(g.time * 6) & 1), '#8fd4ff', 1);
    }
  }

  /* 레이저: 경고(위험 구역 점선) → 광선 */
  function drawBeams(g) {
    for (const bm of g.beams) {
      const ox = bm.x * K, oy = bm.y * K;
      if (!bm.on) {
        const blink = Math.floor(bm.t * 12) & 1;
        const lo = Math.min(bm.a0, bm.a1), hi = Math.max(bm.a0, bm.a1);
        const steps = Math.max(2, Math.ceil((hi - lo) / 0.06));
        ctx.fillStyle = blink ? '#ff3b4e' : '#ffb0a0';
        for (let i = 0; i <= steps; i++) {
          const a = lo + ((hi - lo) * i) / steps;
          const ux = Math.cos(a), uy = Math.sin(a);
          for (let d = 14 + ((i * 3 + Math.floor(bm.t * 30)) % 6); d < 460; d += 6) ctx.fillRect(Math.round(ox + ux * d), Math.round(oy + uy * d), 1, 1);
        }
        // 시작 방향은 굵게
        const ux = Math.cos(bm.a0), uy = Math.sin(bm.a0);
        ctx.fillStyle = '#ff3b4e';
        for (let d = 10; d < 460; d += 2) ctx.fillRect(Math.round(ox + ux * d), Math.round(oy + uy * d), 1, 1);
        if (blink) SH.pix.text(ctx, '!', ox, oy + 12, { color: '#ffd84a', scale: 2, align: 'center' });
      } else {
        const ux = Math.cos(bm.ang), uy = Math.sin(bm.ang);
        const w = Math.max(3, Math.round(bm.width * K));
        const fl = Math.floor(g.time * 30) & 1;
        const layers = [[w + 2, '#e8384f'], [w, fl ? '#ff8a8a' : '#ff6a6a'], [Math.max(1, w - 4), '#ffd0d0'], [Math.max(1, w - 6), '#ffffff']];
        for (const [lw, c] of layers) {
          ctx.fillStyle = c;
          for (let d = 4; d < 470; d += 1) ctx.fillRect(Math.round(ox + ux * d - lw / 2), Math.round(oy + uy * d - lw / 2), lw, lw);
        }
        SH.pix.draw(ctx, 'boom', ox, oy, { frame: 1 + (Math.floor(g.time * 20) % 2) });
      }
    }
  }

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
        if (Math.random() < 0.3) SH.fx.anim('puff', b.x * K - Math.cos(b.rot) * 5, b.y * K - Math.sin(b.rot) * 5, 14);
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
   * HUD
   * ========================================================= */
  function drawHud(g, best) {
    T('SCORE', 4, 5, { color: '#ffd84a' });
    T(SH.fmt(g.score), 4, 15, { color: '#ffffff' });
    T('HI', 98, 5, { color: '#ff7aa8' });
    T(SH.fmt(Math.max(best, g.score)), 98, 15, { color: '#ffe3ee' });
    const lives = Math.max(0, g.lives);
    if (lives > 5) {
      spr('icon_life', 8, 28, { fbs: 6 }, '#ffffff');
      T('×' + lives, 15, 28, { color: '#ffffff' });
    } else for (let i = 0; i < lives; i++) spr('icon_life', 8 + i * 10, 28, { fbs: 6 }, '#ffffff');
    for (let i = 0; i < g.bombs; i++) spr('icon_bomb', 70 + i * 10, 28, { fbs: 6 }, '#ffd84a');
    const w = SH.WEAPONS[g.weapon];
    T(SH.fx.WNAME[g.weapon], 136, 28, { color: w.light });
    for (let i = 0; i < SH.MAX_POWER; i++) {
      ctx.fillStyle = '#1b1230';
      ctx.fillRect(136 + i * 6, 34, 5, 4);
      ctx.fillStyle = i < g.power ? w.color : '#3a3058';
      ctx.fillRect(137 + i * 6, 35, 3, 2);
    }
    if (g.loop > 0) T(`LOOP ${g.loop + 1}`, 168, 15, { color: '#ff9ac2' });

    const e = g.boss;
    if (e && e.state !== 'dying') {
      const ph = g.bossPhase;
      const fillIn = e.state === 'enter' ? Math.min(1, e.st / 3) : 1;
      const ratio = Math.max(0, e.hp / e.maxHp) * fillIn;
      bossLag = ratio > bossLag ? ratio : bossLag + (ratio - bossLag) * 0.05;
      const x = 4, y = 50, w2 = PW - 8;
      T(g.def.name, x, y - 5, { color: ph.berserk ? '#ff5a5a' : '#ff8a8a', size: 10 });
      if (e.state === 'fight') T(fmtTime(g.fightT), PW - 4, y - 5, { color: '#ffffff', align: 'right' });
      ctx.fillStyle = '#1b1230';
      ctx.fillRect(x, y, w2, 6);
      ctx.fillStyle = '#3a2050';
      ctx.fillRect(x + 1, y + 1, w2 - 2, 4);
      if (ph.shield) {
        ctx.fillStyle = '#5e6e8c';
        ctx.fillRect(x + 1, y + 1, Math.round((w2 - 2) * ratio), 4);
        for (let i = 0; i < w2 - 2; i += 4) { ctx.fillStyle = '#8fd4ff'; ctx.fillRect(x + 1 + i + (Math.floor(g.time * 8) % 4), y + 2, 1, 2); }
        T('SHIELD', PW / 2, y + 12, { color: '#8fd4ff', align: 'center' });
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
    } else bossLag = 1;
  }

  function fmtTime(sec) {
    const m = Math.floor(sec / 60), r = Math.floor(sec % 60);
    return `${m}:${String(r).padStart(2, '0')}`;
  }

  /* =========================================================
   * 안내 (스테이지 시작 · 경고 · 클리어 · 짧은 알림)
   * ========================================================= */
  function drawBanners(g) {
    if (g.phase === 'intro') {
      const u = g.phaseT;
      if (u < 1.95 && !(u > 1.6 && Math.floor(u * 20) % 2)) {
        const slide = Math.max(0, 1 - u / 0.35) * 120;
        dimBand(PH * 0.36 - 26, 56);
        T(g.stage.en, PW / 2 - slide, PH * 0.36 - 10, { color: '#ffd84a', scale: 3, align: 'center', shadow: '#8a3a10' });
        T(g.stage.name, PW / 2 + slide, PH * 0.36 + 16, { color: '#ffffff', align: 'center', size: 12 });
        if (g.loop > 0) T(`LOOP ${g.loop + 1}`, PW / 2, PH * 0.36 + 38, { color: '#c9a8ff', align: 'center' });
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
        const y = Math.round(PH * 0.4);
        hazard(y - 36, u);
        hazard(y + 28, -u);
        if (Math.floor(u * 4) % 2 === 0) T('WARNING', PW / 2, y - 14, { color: '#ff3b4e', scale: 3, align: 'center', shadow: '#5a0a1a' });
        const boss = g.def;
        if (boss) {
          T(boss.title, PW / 2, y + 6, { color: '#ffd0d6', align: 'center', size: 10 });
          T(boss.name, PW / 2, y + 19, { color: '#ffffff', align: 'center', size: 12 });
        }
      }
    } else if (g.phase === 'clear' && g.tally) {
      const u = g.phaseT;
      if (u > 0.6 && u < 5.4) {
        const Tl = g.tally;
        const x0 = 18, y0 = 108, w = PW - 36, h = 130;
        win(x0, y0, w, h);
        T('MISSION CLEAR!', PW / 2, y0 + 14, { color: '#ffd84a', scale: 2, align: 'center', shadow: '#8a3a10' });
        const rows = [['격파 보너스', Tl.clearBonus], [`시간 보너스 ${fmtTime(Tl.fightTime)}`, Tl.timeBonus], ['노미스 보너스', Tl.noMiss], ['남은 폭탄', Tl.bombBonus]];
        rows.forEach(([label, v], i) => {
          const show = Math.min(1, Math.max(0, (u - 1.0 - i * 0.45) / 0.4));
          if (show <= 0) return;
          const yy = y0 + 38 + i * 15;
          T(label, x0 + 10, yy, { color: '#e8e0ff', size: 10 });
          T(v ? '+' + SH.fmt(v * show) : '-', x0 + w - 10, yy, { color: v ? '#ffffff' : '#8f86b0', align: 'right' });
        });
        const tot = Math.min(1, Math.max(0, (u - 2.5) / 0.5));
        if (tot > 0) {
          ctx.fillStyle = '#5a5680';
          ctx.fillRect(x0 + 10, y0 + 100, w - 20, 1);
          T('TOTAL', x0 + 10, y0 + 113, { color: '#ffd84a' });
          T('+' + SH.fmt(Tl.total * tot), x0 + w - 10, y0 + 113, { color: '#ffd84a', align: 'right' });
        }
      }
    }
    if (notice) {
      const a = notice.t < notice.dur - 0.4 || Math.floor(notice.t * 20) % 2;
      if (a) {
        const ny = 166;
        T(notice.title, PW / 2, ny + 9, { color: notice.color, align: 'center', size: notice.ascii ? undefined : 11 });
        if (notice.sub) T(notice.sub, PW / 2, ny + 22, { color: '#ffffff', align: 'center', size: 10 });
      }
    }
  }

  function dimBand(y, h) {
    getOverlays();
    ctx.drawImage(dimOverlay, 0, y, PW, h, 0, y, PW, h);
  }

  function showNotice(title, sub, color, dur) {
    notice = { title, sub, color: color || '#ffffff', t: 0, dur: dur || 2, ascii: !/[^\x00-\x7f]/.test(title) };
  }

  /* =========================================================
   * 한 장면
   * ========================================================= */
  function drawGame(g, dt, opts) {
    setBg(g.stage.bg);
    updateBg(dt, g.phase === 'boss' || g.phase === 'warning');
    if (notice && dt > 0) {
      notice.t += dt;
      if (notice.t >= notice.dur) notice = null;
    }
    const st = SH.fx.state;
    ctx.save();
    if (st.shake > 0.5) ctx.translate(Math.round((R() - 0.5) * st.shake), Math.round((R() - 0.5) * st.shake));
    drawBg();
    if (bg.kind === 'sea' && bg.bolt > 0.6) {
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = '#e8f0ff';
      ctx.fillRect(0, 0, PW, PH);
      ctx.globalAlpha = 1;
    }
    drawBoss(g);
    drawPlayerBullets(g);
    drawItems(g);
    drawPlayer(g);
    SH.fx.draw(ctx);
    drawBeams(g);
    drawEnemyBullets(g);
    ctx.restore();

    const ph = g.bossPhase;
    if (ph && ph.berserk && g.boss && g.boss.state === 'fight' && Math.floor(g.time * 3) % 2) {
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
    if (!opts || !opts.noHud) drawHud(g, (opts && opts.best) || 0);
    if (!opts || !opts.frozen) drawBanners(g);
  }

  /** 타이틀 배경: 하늘이 흐르고, 강철 요새가 버티고 있고, 비행기가 맞서 날아감 */
  function drawTitle(dt, noBoss) {
    title.t += dt;
    setBg('sky');
    updateBg(dt, false);
    drawBg();
    const t = title.t;
    if (!noBoss) {
      const bx = PW / 2 + Math.sin(t * 0.4) * 10, by = 290 + Math.sin(t * 0.9) * 3;
      SH.pix.draw(ctx, 'titan', bx, by, { frame: Math.floor(t * 3) & 1 });
      for (const s2 of [-1, 1]) SH.pix.draw(ctx, 'turret', bx + s2 * 48, by + 13, { frame: 4 + Math.round(Math.sin(t * 0.7 + s2) * 2) });
    }
    const px = PW / 2 + Math.sin(t * 0.8) * 34, py = PH * 0.9 + Math.sin(t * 1.3) * 3;
    const bank = Math.cos(t * 0.8);
    SH.pix.draw(ctx, 'flame', px, py + 15, { frame: Math.floor(t * 20) });
    SH.pix.draw(ctx, 'player', px, py, { frame: bank > 0.5 ? 2 : bank < -0.5 ? 0 : 1 });
    SH.fx.update(dt);
    SH.fx.draw(ctx);
  }

  function reset() {
    notice = null;
    bossLag = 1;
  }

  return {
    PW, PH, K, init, resize, present, drawGame, drawTitle, showNotice, reset, win, dim, T, spr, hazard, fmtTime,
    get ctx() { return ctx; },
  };
})();
