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
  let backdrop = null;    // 맵 바깥 바탕 (화면 크기, 한 번 그려 둠)
  let baseFrame = null;   // 바깥 바탕 + 테두리 + 맵 층을 합친 한 장 (흔들림 없을 때)
  /** 맵 테두리: 바깥 그늘 띠 + 금빛 선 */
  function drawFrameBorder(c) {
    c.strokeStyle = 'rgba(0,0,0,0.45)';
    c.lineWidth = 4;
    c.strokeRect(X(0) - 2, Y(0) - 2, game.map.cols * T + 4, game.map.rows * T + 4);
    c.strokeStyle = 'rgba(233,196,122,0.55)';
    c.lineWidth = 2;
    c.strokeRect(X(0) - 3, Y(0) - 3, game.map.cols * T + 6, game.map.rows * T + 6);
  }
  let shadowBase = null;  // 바탕 + 탑·울림등 그림자 (탑을 짓고·올리고·팔 때만 다시 그림)
  let lightCv = null;     // 빛 고르기 그라데이션 두 장을 미리 겹친 투명 층 (크기가 바뀔 때만)
  let shadeLayer = null;  // shadowBase + 공명 선 + 빛 (흔들릴 때만 합쳐 씀 — 평소엔 baseFrame이 바로 합침)
  let shadeVer = 0;       // 그림자·공명 선이 바뀔 때마다 +1 (baseFrame·shadeLayer가 이 번호로 다시 합침)
  let shadeNeed = 2;      // 0 최신, 1 공명 선만 바뀜(다시 합치기만), 2 그림자부터 다시 그림
  let shadeBaked = false; // 이번 프레임에 탑 그림자를 층에서 그렸는지
  let manyEnemies = false;
  /*
   * 자동 화질: 느린 기기에서 프레임이 계속 늦으면(2초 동안 60% 넘게 초당 30장 아래) 그리는 해상도를 한 단계(0.5배) 낮춤.
   * 화면 배율 상한 2 → 1.5 → 1. 낮춘 뒤 6초 동안 거의 늦지 않으면 한 단계 다시 올림.
   */
  let dprCap = 2;
  let perfT = 0;
  let perfN = 0;
  let perfSlow = 0;
  let perfLast = 0; // 적이 아주 많으면 적의 드리운 그림자 대신 발밑 그늘만 (성능)
  const reducedMQ = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null; // 한 번만 만들고 .matches만 읽음(매 프레임 만들면 쓰레기가 쌓임)
  const hurtAt = new Map(); // 적 id → 마지막으로 맞은 번쩍임을 보인 시각(실제 시간)
  const overlay = { hover: null, keyCursor: false, selectedTower: null, ghost: null, selectedEnemy: null, heroSelected: false, skill: null, rally: null, showPaths: true };
  const REGION_BASE = { 1: '#5d7a3c', 2: '#c9d8e6', 3: '#b9774a', 4: '#3f7f86', 5: '#5d5672' };

  const X = (x) => ox + x * T;
  const Y = (y) => oy + y * T;
  const lerp = (a, b, k) => a + (b - a) * k;

  function attach(cv, g) {
    canvas = cv;
    // 불투명 캔버스: 브라우저가 매 프레임 캔버스를 뒤 배경과 섞지 않아도 됨(느린 기기에서 이득)
    ctx = canvas.getContext('2d', { alpha: false });
    trackTransform(ctx);
    game = g;
    corpses = [];
    projStart.clear();
    dprCap = 2; perfT = 0; perfN = 0; perfSlow = 0; perfLast = 0; perfWin = 0; perfRaised = false; perfNoRaise = false; slowFx = false;
    seenT.n = -1; shadeNeed = 2; linkPairs.length = 0; towerKeys.clear();
    ambientFor = '';
    bg = null;
    bgFor = '';
    resize();
  }

  function detach() { game = null; }

  function resize() {
    if (!canvas || !game) return;
    const rect = canvas.parentElement.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, dprCap); // 2배 넘는 화면은 2배로 (휴대폰에서 채우기 비용을 줄임, 선명도 차이는 거의 없음)
    W = Math.max(100, rect.width);
    H = Math.max(80, rect.height);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    if (ctx && ctx._xf) ctx._xf.reset(); // 크기를 바꾸면 캔버스 상태(변환·저장 더미)가 처음으로 돌아감
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
    // 화질만 낮아졌으면(같은 맵·같은 칸 크기) 이미 그린 바탕을 줄여 씀 — 큰 맵 SVG를 다시 그리는 것은 느린 기기에서 몇 초 걸림
    if (bg && bg._map === m.id && bg._T === T && bg.width >= w) {
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      const c2 = cv.getContext('2d');
      c2.imageSmoothingQuality = 'high';
      c2.drawImage(bg, 0, 0, w, h);
      cv._map = m.id; cv._T = T; cv._full = bg._full || bg;
      bg = cv;
      return;
    }
    // 화질이 다시 올라가면 가장 선명했던 바탕이 있으면 그것을 씀
    if (bg && bg._full && bg._full._map === m.id && bg._full._T === T && bg._full.width >= w) {
      const full = bg._full;
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      cv.getContext('2d').drawImage(full, 0, 0, w, h);
      cv._map = m.id; cv._T = T; cv._full = full;
      bg = cv;
      return;
    }
    let svg = null;
    try { svg = RG.art.mapBackground ? RG.art.mapBackground(m) : null; } catch (e) { svg = null; }
    if (!svg) { bg = null; return; }
    const img = new Image();
    img.onload = () => {
      if (bgFor !== key) return;
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      cv.getContext('2d').drawImage(img, 0, 0, w, h);
      cv._map = m.id; cv._T = T;
      bg = cv;
    };
    img.src = RG.art.sprites.dataUrl(RG.art.sprites.sized(svg, w, h));
  }

  function screenToWorld(px, py) { return { x: (px - ox) / T, y: (py - oy) / T }; }
  function worldToScreen(x, y) { return { x: X(x), y: Y(y) }; }
  const tileSize = () => T;

  /* ---------------- 그리기 도우미 ---------------- */
  /*
   * 화면 크기로 줄여 둔 그림: 168px 그림을 매 프레임 30px로 줄여 그리면 느린 기기에서 비용이 큼.
   * 그림·표시 크기(화면 배율 포함)마다 한 번만 고품질로 줄여 두고, 그 뒤엔 같은 크기로 그대로 찍음.
   */
  function fitted(s, w, h, flip) {
    const pw = Math.max(1, Math.round(w * dpr));
    const ph = Math.max(1, Math.round(h * dpr));
    if (pw * 1.3 >= s.canvas.width) return s.canvas; // 거의 같은 크기면 그대로
    let m = s._fit;
    if (!m) { m = new Map(); s._fit = m; }
    const k = (pw * 4096 + ph) * 2 + (flip ? 1 : 0); // 좌우 반전본도 따로 (그릴 때 뒤집으면 느린 길로 그려짐)
    let cv = m.get(k);
    if (!cv) {
      if (m.size > 6) m.clear(); // 크기가 자주 바뀌면(창 크기·화질) 오래된 것은 버림
      cv = s.canvas._bb ? fitCropped(s.canvas, pw, ph, flip, null) : null;
      if (!cv) {
        cv = document.createElement('canvas');
        cv.width = pw; cv.height = ph;
        const c2 = cv.getContext('2d');
        c2.imageSmoothingQuality = 'high'; // 고품질 축소 한 번 (임시 캔버스를 만들지 않음 — 시작 직후 수백 장을 만들 때 가벼움)
        if (flip) { c2.translate(pw, 0); c2.scale(-1, 1); }
        c2.drawImage(s.canvas, 0, 0, pw, ph);
        cv = cropOpaque(cv);
      }
      m.set(k, cv);
      toBitmap(m, k, cv);
    }
    return cv;
  }
  /*
   * 불러올 때 재 둔 불투명 범위(src._bb)로 잘라 줄이기 — 화소를 읽지 않음(전투 중 getImageData는 느림).
   * sh가 있으면 발밑 그늘(그림 칸 기준 가운데 gx,gy·크기 gw,gh·진하기 a)을 먼저 깔고 그 범위까지 포함.
   * 결과는 예전 cropOpaque와 같은 모양(_ox,_oy = 잘라 낸 위치, _fw,_fh = 줄인 전체 크기).
   */
  function fitCropped(src, pw, ph, flip, sh) {
    const bb = src._bb;
    const kx = pw / src.width;
    const ky = ph / src.height;
    // 그림 범위(줄인 크기 기준, 1화소 여유)
    let x0 = Math.max(0, Math.floor(bb[0] * kx) - 1);
    let x1 = Math.min(pw, Math.ceil((bb[2] + 1) * kx) + 1);
    const y0s = Math.max(0, Math.floor(bb[1] * ky) - 1);
    const y1s = Math.min(ph, Math.ceil((bb[3] + 1) * ky) + 1);
    if (flip) { const a = pw - x1; x1 = pw - x0; x0 = a; }
    let X0 = x0; let Y0 = y0s; let X1 = x1; let Y1 = y1s;
    if (sh) {
      X0 = Math.min(X0, Math.floor(sh.gx - sh.gw / 2) - 1); X1 = Math.max(X1, Math.ceil(sh.gx + sh.gw / 2) + 1);
      Y0 = Math.min(Y0, Math.floor(sh.gy - sh.gh / 2) - 1); Y1 = Math.max(Y1, Math.ceil(sh.gy + sh.gh / 2) + 1);
      X0 = Math.max(0, X0); Y0 = Math.max(0, Y0);
    }
    const cw = X1 - X0;
    const ch = Y1 - Y0;
    if (cw <= 0 || ch <= 0) return null;
    const out = document.createElement('canvas');
    out.width = cw; out.height = ch;
    const c2 = out.getContext('2d');
    c2.imageSmoothingQuality = 'high';
    if (sh) { c2.globalAlpha = sh.a; c2.drawImage(blob(), sh.gx - sh.gw / 2 - X0, sh.gy - sh.gh / 2 - Y0, sh.gw, sh.gh); c2.globalAlpha = 1; }
    // 원본 전체를 (-X0,-Y0)만큼 옮겨 줄여 그림 — 캔버스 밖은 그려지지 않음
    c2.translate(-X0, -Y0);
    if (flip) { c2.translate(pw, 0); c2.scale(-1, 1); }
    c2.drawImage(src, 0, 0, pw, ph);
    out._ox = X0; out._oy = Y0; out._fw = pw; out._fh = ph;
    return out;
  }
  /*
   * 줄여 둔 그림을 ImageBitmap(바뀌지 않는 그림)으로 바꿔 둠: 캔버스를 찍으면 찍을 때마다 그 캔버스의
   * 스냅숏을 확인하는 비용이 드는데(적 300마리면 프레임마다 수백 번), ImageBitmap은 그 과정이 없음.
   * 바꾸는 동안에는 캔버스를 그대로 쓰고, 끝나면 같은 자리를 바꿔 끼움(그림은 같음).
   */
  // 바꾸기는 줄을 세워 프레임마다 몇 장씩만 (판 시작 직후 수백 장이 한꺼번에 바뀌면 그 몇 초가 끊겼음)
  const bitmapQ = [];
  function toBitmap(m, k, cv) {
    if (typeof createImageBitmap !== 'function') return;
    bitmapQ.push(m, k, cv);
  }
  function pumpBitmaps(n) {
    let i = 0;
    for (; i < bitmapQ.length && n > 0; i += 3) {
      const m = bitmapQ[i];
      const k = bitmapQ[i + 1];
      const cv = bitmapQ[i + 2];
      if (m.get(k) !== cv) continue; // 이미 버려진 것
      n--;
      createImageBitmap(cv).then((bm) => {
        if (m.get(k) !== cv) { bm.close(); return; } // 그 사이 캐시가 비워졌으면 버림
        bm._ox = cv._ox; bm._oy = cv._oy; bm._fw = cv._fw; bm._fh = cv._fh;
        m.set(k, bm);
      }, () => {});
    }
    bitmapQ.splice(0, i);
  }
  /*
   * 투명한 여백 잘라내기: 그림 캔버스는 동작(점프·기울기)을 위해 둘레에 여백이 넉넉한데,
   * 여백도 매 프레임 한 화소씩 섞어 칠하므로 적 300마리면 칠할 화소의 절반 가까이가 빈 곳이었음.
   * 줄인 그림을 한 번 읽어 불투명한 부분만 남기고, 잘라낸 위치(_ox,_oy)만큼 옮겨 찍음 — 화면 결과는 같음.
   */
  function cropOpaque(cv) {
    const w = cv.width;
    const h = cv.height;
    cv._ox = 0; cv._oy = 0; cv._fw = w; cv._fh = h;
    let d;
    try { d = cv.getContext('2d').getImageData(0, 0, w, h).data; } catch (e) { return cv; } // 읽을 수 없는 그림이면 그대로
    let y0 = 0;
    let y1 = h - 1;
    const rowEmpty = (y) => { for (let i = y * w * 4 + 3, e = i + w * 4; i < e; i += 4) if (d[i]) return false; return true; };
    while (y0 <= y1 && rowEmpty(y0)) y0++;
    if (y0 > y1) return cv; // 다 투명(아직 그려지지 않음 등) — 그대로
    while (y1 > y0 && rowEmpty(y1)) y1--;
    let x0 = w;
    let x1 = -1;
    for (let y = y0; y <= y1; y++) {
      const row = y * w * 4 + 3;
      for (let x = 0; x < x0; x++) if (d[row + x * 4]) { x0 = x; break; }
      for (let x = w - 1; x > x1; x--) if (d[row + x * 4]) { x1 = x; break; }
    }
    const cw = x1 - x0 + 1;
    const ch = y1 - y0 + 1;
    if (cw * ch > w * h * 0.85) return cv; // 거의 꽉 찬 그림은 그대로
    const out = document.createElement('canvas');
    out.width = cw; out.height = ch;
    out.getContext('2d').drawImage(cv, x0, y0, cw, ch, 0, 0, cw, ch);
    out._ox = x0; out._oy = y0; out._fw = w; out._fh = h;
    return out;
  }
  /*
   * 발밑 그늘을 함께 구운 그림 (적이 아주 많을 때): 그늘을 따로 칠하면 적 300마리면 타원 300개를
   * 경로로 만들고 칠해야 해서 비쌌음. 그림 한 장에 그늘을 먼저 깔고 그 위에 몸을 그려 두면 찍기 한 번으로 끝.
   * sh = [그늘 가운데 x, y (그림 칸 왼쪽 위 기준, CSS 화소), 너비, 높이, 진하기]
   */
  function fittedSh(s, w, h, flip, sh) {
    const pw = Math.max(1, Math.round(w * dpr));
    const ph = Math.max(1, Math.round(h * dpr));
    const gx = Math.round(sh[0] * dpr);
    const gy = Math.round(sh[1] * dpr);
    const gw = Math.max(4, Math.round(sh[2] * dpr));
    const gh = Math.max(2, Math.round(sh[3] * dpr));
    let m = s._fit;
    if (!m) { m = new Map(); s._fit = m; }
    const k = -((((pw * 4096 + ph) * 2 + (flip ? 1 : 0)) * 512 + (gy & 511)) * 4 + (sh[4] > 0.4 ? 1 : 0)) - 1; // 음수: 그늘 없는 그림과 겹치지 않게
    let cv = m.get(k);
    if (!cv) {
      if (m.size > 6) m.clear();
      cv = s.canvas._bb ? fitCropped(s.canvas, pw, ph, flip, { gx, gy, gw, gh, a: sh[4] }) : null;
      if (!cv) {
        cv = document.createElement('canvas');
        cv.width = Math.max(pw, gx + (gw >> 1) + 2);
        cv.height = Math.max(ph, gy + (gh >> 1) + 2);
        const c2 = cv.getContext('2d');
        c2.imageSmoothingQuality = 'high';
        c2.globalAlpha = sh[4];
        c2.drawImage(blob(), gx - gw / 2, gy - gh / 2, gw, gh);
        c2.globalAlpha = 1;
        if (flip) { c2.translate(pw, 0); c2.scale(-1, 1); }
        c2.drawImage(s.canvas, 0, 0, pw, ph);
        cv = cropOpaque(cv);
      }
      m.set(k, cv);
      toBitmap(m, k, cv);
    }
    return cv;
  }
  function sprite(key, cx, cy, w, h, ax, ay, flip, alpha, sh) {
    const s = RG.art.sprites.get(key);
    if (!s) return false;
    const plain = plainTransform();
    if (sh && !plain) shadowAt(cx - w * ax + sh[0], cy - h * ay + sh[1], sh[2], sh[3], sh[4]); // 구운 그림을 못 쓰면 그늘만 따로
    const img = plain ? (sh ? fittedSh(s, w, h, flip, sh) : fitted(s, w, h, flip)) : fitted(s, w, h, false);
    const setA = alpha != null && alpha !== 1; // 투명도를 바꿀 때만 쓰고 되돌림 (그림마다 두 번씩 쓰던 것 — 적 300이면 프레임마다 600번)
    const a0 = setA ? ctx.globalAlpha : 1; // 읽기도 바꿀 때만 (캔버스 값 읽기도 매번 비용이 듦)
    if (setA) ctx.globalAlpha = a0 * alpha;
    if (img !== s.canvas && plain) {
      // 줄여 둔 그림(반전본 포함): 정수 화소 위치에 원래 크기 그대로 찍음 — 늘이기·반 화소·뒤집기 없이 가장 빠른 길
      const x0 = (Math.round((cx - w * ax) * dpr) + img._ox) / dpr;
      const y0 = (Math.round((cy - h * ay) * dpr) + img._oy) / dpr;
      ctx.drawImage(img, x0, y0, img.width / dpr, img.height / dpr);
    } else if (img !== s.canvas) {
      // 회전·눌림 중: 잘라낸 그림을 원래 칸(w×h) 안의 제자리에 늘여 그림
      const kx = w / img._fw;
      const ky = h / img._fh;
      ctx.save();
      ctx.translate(cx, cy);
      if (flip) ctx.scale(-1, 1);
      ctx.drawImage(img, -w * ax + img._ox * kx, -h * ay + img._oy * ky, img.width * kx, img.height * ky);
      ctx.restore();
    } else if (flip) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(-1, 1);
      ctx.drawImage(img, -w * ax, -h * ay, w, h);
      ctx.restore();
    } else {
      ctx.drawImage(img, cx - w * ax, cy - h * ay, w, h);
    }
    if (setA) ctx.globalAlpha = a0;
    return true;
  }
  /*
   * 화면 캔버스의 변환을 따라 적어 둠: 그림마다 getTransform()을 부르면 매번 새 행렬 객체가 생겨
   * (적 300마리면 프레임마다 수백 개) 쓰레기 수거가 잦아짐. 배율·이동만 있는 동안은 직접 셈하고,
   * 회전·기울임 등 모르는 변환이 끼면 예전처럼 getTransform으로 확인.
   */
  function trackTransform(c) {
    if (c._xf) return;
    const P = CanvasRenderingContext2D.prototype;
    const xf = {
      plain: true, s: 1, e: 0, f: 0, unknown: false, stack: [],
      reset() { this.plain = true; this.s = 1; this.e = 0; this.f = 0; this.unknown = false; this.stack.length = 0; },
    };
    c._xf = xf;
    c.save = function () { xf.stack.push(xf.plain, xf.s, xf.e, xf.f, xf.unknown); return P.save.call(this); };
    c.restore = function () {
      if (xf.stack.length) { xf.unknown = xf.stack.pop(); xf.f = xf.stack.pop(); xf.e = xf.stack.pop(); xf.s = xf.stack.pop(); xf.plain = xf.stack.pop(); }
      return P.restore.call(this);
    };
    c.setTransform = function (a, b, cc, d, e, f) {
      if (arguments.length >= 6) { xf.unknown = false; xf.plain = b === 0 && cc === 0 && a === d; xf.s = a; xf.e = e; xf.f = f; } else xf.unknown = true;
      return P.setTransform.apply(this, arguments);
    };
    c.resetTransform = function () { xf.unknown = false; xf.plain = true; xf.s = 1; xf.e = 0; xf.f = 0; return P.resetTransform.call(this); };
    c.translate = function (x, y) { if (xf.plain) { xf.e += x * xf.s; xf.f += y * xf.s; } return P.translate.call(this, x, y); };
    c.scale = function (x, y) { if (x !== 1 || y !== 1) xf.plain = false; return P.scale.call(this, x, y); };
    c.rotate = function (r) { if (r !== 0) xf.plain = false; return P.rotate.call(this, r); };
    c.transform = function () { xf.unknown = true; return P.transform.apply(this, arguments); };
  }
  /** 지금 변환이 화면 배율·이동뿐인가(흔들림 이동은 정수 화소로) — 회전·눌림이 있으면 일반 그리기 */
  function plainTransform() {
    const xf = ctx._xf;
    if (xf && !xf.unknown) return xf.plain && Math.abs(xf.s - dpr) < 1e-6 && Math.abs(xf.e - Math.round(xf.e)) < 1e-3 && Math.abs(xf.f - Math.round(xf.f)) < 1e-3;
    const t = ctx.getTransform();
    return t.b === 0 && t.c === 0 && Math.abs(t.a - dpr) < 1e-6 && Math.abs(t.d - dpr) < 1e-6 && Math.abs(t.e - Math.round(t.e)) < 1e-3 && Math.abs(t.f - Math.round(t.f)) < 1e-3;
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
  /*
   * 그늘을 표시 크기(화면 배율 포함)로 줄여 둔 그림: 128px 그늘 그림을 매 프레임 적·병사마다 늘이고 줄여 그리면
   * 느린 길(화소마다 샘플링)로 그려졌음. 크기마다 한 번만 줄여 두고 정수 화소 자리에 그대로 찍음.
   */
  const blobFit = new Map();
  function blobAt(x, y, w, h) {
    if (!ctx._xf || !plainTransform()) { ctx.drawImage(blob(), x - w / 2, y - h / 2, w, h); return; }
    const pw = Math.max(1, Math.round(w * dpr));
    const ph = Math.max(1, Math.round(h * dpr));
    const k = pw * 4096 + ph;
    let cv = blobFit.get(k);
    if (!cv) {
      if (blobFit.size > 48) blobFit.clear();
      cv = document.createElement('canvas');
      cv.width = pw; cv.height = ph;
      cv.getContext('2d').drawImage(blob(), 0, 0, pw, ph);
      blobFit.set(k, cv);
      toBitmap(blobFit, k, cv);
    }
    ctx.drawImage(cv, Math.round((x - w / 2) * dpr) / dpr, Math.round((y - h / 2) * dpr) / dpr, pw / dpr, ph / dpr);
  }
  /** 화면 좌표(CSS 화소)에 그늘 하나 — 가운데·너비·높이·진하기 */
  function shadowAt(x, y, w, h, a) {
    const a0 = ctx.globalAlpha;
    ctx.globalAlpha = a0 * a;
    blobAt(x, y, w, h);
    ctx.globalAlpha = a0;
  }
  function shadow(x, y, rx, ry, a = 0.32) {
    const a0 = ctx.globalAlpha;
    ctx.globalAlpha = a0 * Math.min(1, a * 1.6);
    const w = Math.max(4, rx * T * 2.2);
    const h = Math.max(2, ry * T * 2.2);
    blobAt(X(x) + T * 0.03, Y(y) + T * 0.01, w, h);
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
  /*
   * 드리운 그림자를 화면 화소 크기로 미리 기울여 둔 그림: 매 프레임 기울임 변환으로 작은 그림자 그림을 늘여 그리면
   * 화소마다 따로 샘플링하는 느린 길로 그려져, 적 수십 마리면 그림자만으로 프레임이 크게 늦었음.
   * 그림·크기·좌우마다 한 번만 기울여 그려 두고 그 뒤엔 정수 화소 자리에 그대로 찍음 (뜬 높이는 옆으로 옮기기만 하므로 같은 그림).
   */
  function skewedShadow(cv, w, h, ax, ay, flip) {
    const pw = Math.max(1, Math.round(w * dpr));
    const ph = Math.max(1, Math.round(h * dpr));
    const k = (((pw * 4096 + ph) * 2 + (flip ? 1 : 0)) * 1024 + Math.round(ay * 1000)) * 1024 + Math.round(ax * 1000);
    let m = cv._sk;
    if (!m) { m = new Map(); cv._sk = m; }
    let out = m.get(k);
    if (out) return out;
    if (m.size > 8) m.clear(); // 크기가 자주 바뀌면(창 크기·화질) 오래된 것은 버림
    const a = flip ? -1 : 1;
    // 기울인 네 모서리의 범위 (기준점 기준, 화면 화소)
    let x0 = Infinity; let x1 = -Infinity; let y0 = Infinity; let y1 = -Infinity;
    for (const x of [-w * ax, w * (1 - ax)]) {
      for (const y of [-h * ay, h * (1 - ay)]) {
        const sx = (a * x - 0.6 * y) * dpr;
        const sy = -0.4 * y * dpr;
        if (sx < x0) x0 = sx; if (sx > x1) x1 = sx; if (sy < y0) y0 = sy; if (sy > y1) y1 = sy;
      }
    }
    const bx = Math.floor(x0) - 1;
    const by = Math.floor(y0) - 1;
    out = document.createElement('canvas');
    out.width = Math.max(1, Math.ceil(x1) + 1 - bx);
    out.height = Math.max(1, Math.ceil(y1) + 1 - by);
    const c2 = out.getContext('2d');
    c2.setTransform(a * dpr, 0, -0.6 * dpr, -0.4 * dpr, -bx, -by);
    c2.drawImage(cv, -w * ax, -h * ay, w, h);
    out._ox = bx; out._oy = by;
    m.set(k, out);
    toBitmap(m, k, out);
    return out;
  }
  /** (cx, by) = 바닥 기준점, w·h·ax·ay = 그림 배치, lift = 땅에서 뜬 높이(비행) */
  function castShadow(key, cx, by, w, h, ax, ay, flip, alpha, lift = 0) {
    if (!shadowsOn) return;
    const cv = shadowCanvas(key);
    if (!cv) return;
    if (ctx._xf && plainTransform()) {
      const img = skewedShadow(cv, w, h, ax, ay, flip);
      const a0 = ctx.globalAlpha;
      ctx.globalAlpha = a0 * alpha;
      ctx.drawImage(img, (Math.round((cx + lift * 0.55) * dpr) + img._ox) / dpr, (Math.round(by * dpr) + img._oy) / dpr, img.width / dpr, img.height / dpr);
      ctx.globalAlpha = a0;
      return;
    }
    ctx.save();
    ctx.globalAlpha *= alpha;
    // (cx+lift·0.55, by)로 옮긴 뒤 기울임: 높이 H인 점 → 오른쪽으로 0.6H, 아래로 0.4H (좌우 반전이면 x축을 뒤집음)
    ctx.transform(flip ? -1 : 1, 0, -0.6, -0.4, cx + lift * 0.55, by);
    ctx.drawImage(cv, -w * ax, -h * ay, w, h);
    ctx.restore();
  }
  let shadowsOn = true;

  // 체력 막대 모으기: 항목 객체를 모아 두고 다시 씀 (매 프레임 수백 개를 새로 만들지 않음)
  let barOn = false; // 모으는 중인가 (frame에서 켜고 flushBars에서 끔)
  const barPool = [];
  let barN = 0;
  // 우리 편(병사·벽) 체력은 파랑 — 적(초록)과 같은 칸에 겹쳐도, 색약이어도 구별되게
  const ALLY_BAR = '#5aa8ff';
  function bar(cx, top, w, ratio, color, shieldRatio, elite) {
    if (barOn) {
      let b = barPool[barN];
      if (!b) { b = { x: 0, y: 0, w: 0, ratio: 0, color: '', shieldRatio: 0, elite: false }; barPool[barN] = b; }
      b.x = Math.round(cx - w / 2); b.y = Math.round(top); b.w = w; b.ratio = ratio; b.color = color; b.shieldRatio = shieldRatio; b.elite = !!elite;
      barN++;
      return;
    }
    drawBar(cx, top, w, ratio, color, shieldRatio, elite);
  }
  const barCols = [];
  /** 모은 체력 막대를 한꺼번에: 테두리 한 경로, 빈 칸 한 경로, 채운 칸은 색마다 한 경로 (막대마다 칠하면 수백 번) */
  function flushBars() {
    const n = barN;
    barOn = false;
    barN = 0;
    if (!n) return;
    const q = barPool;
    const h = Math.max(3, Math.round(T * 0.09));
    ctx.fillStyle = 'rgba(15,10,25,0.85)';
    ctx.beginPath();
    for (let i = 0; i < n; i++) { const b = q[i]; ctx.rect(b.x - 1, b.y - 1, b.w + 2, h + 2); }
    ctx.fill();
    if (!manyEnemies) {
      ctx.fillStyle = '#3a2a33';
      ctx.beginPath();
      for (let i = 0; i < n; i++) { const b = q[i]; ctx.rect(b.x, b.y, b.w, h); }
      ctx.fill();
    }
    // 색 종류는 몇 가지뿐 — 처음 나온 순서대로 색마다 한 경로
    barCols.length = 0;
    for (let i = 0; i < n; i++) if (barCols.indexOf(q[i].color) < 0) barCols.push(q[i].color);
    for (let c = 0; c < barCols.length; c++) {
      const col = barCols[c];
      ctx.fillStyle = col;
      ctx.beginPath();
      for (let i = 0; i < n; i++) { const b = q[i]; if (b.color === col) ctx.rect(b.x, b.y, Math.max(0, b.w * b.ratio), h); }
      ctx.fill();
    }
    let anyShield = false;
    let anyElite = false;
    for (let i = 0; i < n; i++) { if (q[i].shieldRatio > 0) anyShield = true; if (q[i].elite) anyElite = true; }
    if (anyShield) {
      ctx.fillStyle = 'rgba(190,232,255,0.9)';
      ctx.beginPath();
      for (let i = 0; i < n; i++) { const b = q[i]; if (b.shieldRatio > 0) ctx.rect(b.x, b.y, Math.max(0, b.w * Math.min(1, b.shieldRatio)), Math.max(2, h * 0.5)); }
      ctx.fill();
    }
    if (anyElite) {
      ctx.fillStyle = '#ffd34d';
      ctx.beginPath();
      for (let i = 0; i < n; i++) { const b = q[i]; if (!b.elite) continue; const x = b.x; const y = b.y; ctx.moveTo(x - 6, y - 1); ctx.lineTo(x - 2, y + h / 2); ctx.lineTo(x - 6, y + h + 1); ctx.closePath(); }
      ctx.fill();
    }
    for (let i = 0; i < n; i++) q[i].color = '';
  }
  function drawBar(cx, top, w, ratio, color, shieldRatio, elite) {
    const h = Math.max(3, Math.round(T * 0.09));
    const x = Math.round(cx - w / 2);
    const y = Math.round(top);
    ctx.fillStyle = 'rgba(15,10,25,0.85)';
    ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    if (!manyEnemies) { ctx.fillStyle = '#3a2a33'; ctx.fillRect(x, y, w, h); }
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
   * 세 장으로 나눠 둠 — 공명 선은 공명을 끊는 적·멈추게 하는 적이 탑 곁을 지날 때마다 바뀌는데(탑이 꽉 찬 후반 웨이브면
   * 초당 여러 번), 예전엔 그때마다 바탕·탑 그림자 88개·빛 그라데이션을 통째로 다시 그려 휴대폰에서 프레임이 크게 늦었음.
   *  - shadowBase: 바탕 + 탑·울림등 그림자. 탑을 짓고·올리고·팔 때(또는 바탕·그림자 설정이 바뀔 때)만 다시 그림.
   *  - lightCv: 빛 고르기 그라데이션 두 장을 미리 겹쳐 둔 투명 층. 크기가 바뀔 때만.
   *  - 공명 선이 바뀌면 shadowBase 위에 선을 긋고 lightCv를 덮어 합치기만 함 (평소엔 baseFrame에 바로, 흔들릴 때는 shadeLayer에).
   * 바뀜 확인은 매 프레임 탑 목록을 숫자·문자 비교로만 훑음 (예전처럼 탑마다 긴 문자열을 만들지 않음).
   */
  const seenT = { n: -1, id: [], type: [], lv: [], br: [], bld: [], nl: [], links: [], ready: 0, waiting: false };
  const linkPairs = []; // 공명 선 [탑, 이웃, 탑, 이웃, ...] (같은 짝은 한 번) — 공명 선이 바뀔 때만 다시 만듦
  /** 그림자를 구울 쉬는 자세 그림 중 준비된 수 (울림등 포함) — 다 준비되기 전에 구웠으면 준비될 때마다 다시 구움 */
  function shadeReady(ts) {
    const A = RG.art.sprites;
    let n = A.get(A.lanternKey(1)) ? 1 : 0;
    for (let i = 0; i < ts.length; i++) { const t = ts[i]; if (A.get(towerKeysOf(t).idle)) n++; }
    return n;
  }
  /** 탑 목록이 지난 프레임과 달라졌는지: 짓기·팔기·강화·분기·건설 끝 → 그림자부터, 공명 선만 → 다시 합치기만 */
  function syncTowers() {
    const ts = game.state.towers;
    const S = seenT;
    let stat = ts.length !== S.n;
    let link = stat;
    if (!stat) {
      let li = 0;
      for (let i = 0; i < ts.length; i++) {
        const t = ts[i];
        if (t.id !== S.id[i] || t.type !== S.type[i] || t.level !== S.lv[i] || t.branch !== S.br[i] || !!t.building !== S.bld[i]) { stat = true; link = true; break; }
        if (link) continue;
        const L = t.links;
        if (L.length !== S.nl[i]) { link = true; continue; }
        for (let j = 0; j < L.length; j++) if (L[j] !== S.links[li + j]) { link = true; break; }
        li += L.length;
      }
      if (!stat && S.waiting && shadeReady(ts) > S.ready) stat = true;
    }
    if (!stat && !link) return;
    S.n = ts.length;
    S.links.length = 0;
    for (let i = 0; i < ts.length; i++) {
      const t = ts[i];
      S.id[i] = t.id; S.type[i] = t.type; S.lv[i] = t.level; S.br[i] = t.branch; S.bld[i] = !!t.building; S.nl[i] = t.links.length;
      for (let j = 0; j < t.links.length; j++) S.links.push(t.links[j]);
    }
    S.id.length = S.type.length = S.lv.length = S.br.length = S.bld.length = S.nl.length = ts.length;
    linkPairs.length = 0;
    const byId = new Map();
    for (const t of ts) byId.set(t.id, t);
    for (const t of ts) for (const id of t.links) { if (id < t.id) continue; const n = byId.get(id); if (n) linkPairs.push(t, n); }
    if (stat) shadeNeed = 2; else if (!shadeNeed) shadeNeed = 1;
  }
  /** 바탕 + 탑·울림등 그림자 */
  function drawShadowBase() {
    const st = game.state;
    const m = game.map;
    const A = RG.art.sprites;
    if (!shadowBase || shadowBase.width !== bg.width || shadowBase.height !== bg.height) {
      shadowBase = document.createElement('canvas');
      shadowBase.width = bg.width;
      shadowBase.height = bg.height;
    }
    const c2 = shadowBase.getContext('2d');
    c2.setTransform(1, 0, 0, 1, 0, 0);
    c2.globalAlpha = 1;
    c2.clearRect(0, 0, shadowBase.width, shadowBase.height);
    c2.drawImage(bg, 0, 0);
    c2.setTransform(bg.width / (m.cols * T), 0, 0, bg.height / (m.rows * T), 0, 0);
    const keep = { ctx, ox, oy };
    ctx = c2; ox = 0; oy = 0;
    try {
      for (const t of st.towers) shadow(t.x, t.r + 0.8, 0.36, 0.12, 0.28);
      for (const t of st.towers) castShadow(towerKeysOf(t).idle, X(t.x), Y(t.r + 0.82), T, T * 1.3, 0.5, 112 / 130, false, t.building ? 0.2 : 0.42);
      const L = m.lantern;
      castShadow(A.lanternKey(1), X(L.x), Y(L.r + 0.82), T, T * 1.3, 0.5, 112 / 130, false, 0.42);
    } finally {
      ctx = keep.ctx; ox = keep.ox; oy = keep.oy;
    }
    seenT.ready = shadeReady(st.towers);
    seenT.waiting = seenT.ready < st.towers.length + 1;
  }
  /**
   * 빛 고르기: 왼쪽 위(빛이 오는 쪽)는 따뜻하게 살짝 밝게, 오른쪽 아래는 푸른 보랏빛으로 살짝 어둡게, 가장자리는 어둡게.
   * 두 그라데이션을 투명 층 한 장에 미리 겹쳐 둠(겹치는 순서가 같아 결과도 같음) — 합칠 때 그라데이션을 다시 칠하지 않고 한 번 찍기만.
   */
  function lightLayer() {
    const m = game.map;
    const W2 = m.cols * T;
    const H2 = m.rows * T;
    if (lightCv && lightCv.width === bg.width && lightCv.height === bg.height && lightCv._w === W2 && lightCv._h === H2) return lightCv;
    if (!lightCv || lightCv.width !== bg.width || lightCv.height !== bg.height) {
      lightCv = document.createElement('canvas');
      lightCv.width = bg.width;
      lightCv.height = bg.height;
    }
    const c2 = lightCv.getContext('2d');
    c2.setTransform(1, 0, 0, 1, 0, 0);
    c2.clearRect(0, 0, lightCv.width, lightCv.height);
    c2.setTransform(bg.width / W2, 0, 0, bg.height / H2, 0, 0);
    const lgr = c2.createLinearGradient(0, 0, W2, H2);
    lgr.addColorStop(0, 'rgba(255,232,180,0.08)');
    lgr.addColorStop(0.45, 'rgba(255,232,180,0)');
    lgr.addColorStop(1, 'rgba(38,22,72,0.10)');
    c2.fillStyle = lgr;
    c2.fillRect(0, 0, W2, H2);
    const vg = c2.createRadialGradient(W2 / 2, H2 / 2, Math.min(W2, H2) * 0.38, W2 / 2, H2 / 2, Math.hypot(W2, H2) * 0.55);
    vg.addColorStop(0, 'rgba(12,7,22,0)');
    vg.addColorStop(1, 'rgba(12,7,22,0.24)');
    c2.fillStyle = vg;
    c2.fillRect(0, 0, W2, H2);
    lightCv._w = W2; lightCv._h = H2;
    return lightCv;
  }
  /** 그림자 층이 최신이 되게 (바탕 그림이 없으면 false) — 프레임마다 한 번 */
  function updateShade() {
    if (!bg) return false;
    if (!shadowBase || shadowBase._bg !== bg || shadowBase._sh !== shadowsOn) shadeNeed = 2;
    if (shadeNeed === 2) { drawShadowBase(); shadowBase._bg = bg; shadowBase._sh = shadowsOn; }
    if (shadeNeed) { shadeVer++; shadeNeed = 0; }
    return true;
  }
  /** c2(변환 = CSS 화소)의 (x0, y0)에 맵 크기로: 그림자 층 → 공명 선 → 빛 */
  function composeMap(c2, x0, y0) {
    const m = game.map;
    c2.drawImage(shadowBase, x0, y0, m.cols * T, m.rows * T);
    const kx = ox; const ky = oy;
    ox = x0; oy = y0;
    try { bakeLinks(c2); } finally { ox = kx; oy = ky; }
    c2.drawImage(lightLayer(), x0, y0, m.cols * T, m.rows * T);
  }
  /** 바탕 + 탑 그림자 + 공명 선 + 빛을 합친 맵 크기 한 장 (흔들릴 때 — 평소엔 baseFrame이 바로 합침) */
  function towerShadeLayer() {
    if (shadeLayer && shadeLayer._v === shadeVer && shadeLayer.width === bg.width && shadeLayer.height === bg.height) return shadeLayer;
    if (!shadeLayer || shadeLayer.width !== bg.width || shadeLayer.height !== bg.height) {
      shadeLayer = document.createElement('canvas');
      shadeLayer.width = bg.width;
      shadeLayer.height = bg.height;
    }
    const m = game.map;
    const c2 = shadeLayer.getContext('2d');
    c2.setTransform(1, 0, 0, 1, 0, 0);
    c2.globalAlpha = 1;
    c2.clearRect(0, 0, shadeLayer.width, shadeLayer.height);
    c2.setTransform(bg.width / (m.cols * T), 0, 0, bg.height / (m.rows * T), 0, 0);
    composeMap(c2, 0, 0);
    shadeLayer._v = shadeVer;
    return shadeLayer;
  }

  function drawBackground(already) {
    const m = game.map;
    shadeBaked = false;
    if (already) { shadeBaked = true; return; } // 바탕 한 장(baseFrame)으로 이미 그림
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
    const lite = lowFx();
    for (const s of m.spawns) {
      const cx = X(s.x);
      const cy = Y(s.y);
      if (lite) { // 가벼운 단계: 그라데이션·도는 고리 없이 어두운 원 하나
        ctx.fillStyle = 'rgba(30,24,40,0.6)';
        ctx.beginPath(); ctx.arc(cx, cy, T * 0.4, 0, Math.PI * 2); ctx.fill();
        continue;
      }
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

  }

  /** 준비 단계: 적이 갈 길 화살표 (지상·비행 모두 같은 길) */
  function drawPathPreview() {
    const st = game.state;
    const m = game.map;
    if (!overlay.showPaths) return;
    if (st.wave.started && !(st.wave.countdown !== null && st.wave.countdown > 0 && st.enemies.length === 0)) return;
    // 공터에 놓을 탑 미리보기가 있으면 그 탑을 지은 뒤의 길을 보여 줌
    const gh = overlay.ghost;
    const flow = gh && gh.flow ? gh.flow : game.flow;
    const blocked = gh && gh.blocked ? gh.blocked : game.blocked;
    ctx.save();
    ctx.globalAlpha = 0.55 + 0.25 * Math.sin(time * 3);
    ctx.fillStyle = '#fff6d8';
    for (const s of m.spawns) {
      let c = s.c;
      let r = s.r;
      let guard = 0;
      let k = 0;
      while (guard++ < 200) {
        const nx = RG.grid.nextStep(m, flow, blocked, c, r, 0);
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
    ctx.restore();
  }

  /* ---------------- 6지역: 별다리 · 별빛 건설지 ---------------- */
  /**
   * 별다리: 열린 무리는 금빛 별빛 판자, 닫힌 무리는 옅은 점선 윤곽.
   * 닫히기 3초 전부터 열린 다리가 깜박이고 다리 가운데 위에 남은 초를 표시(읽을 수 있는 위협).
   * 별빛 건설지(*)는 칸 가운데 작은 금빛 별이 은은하게 반짝임(탑이 있으면 탑 밑에 가려짐).
   */
  function drawBridges() {
    const map = game.map;
    if (map.hasStars === undefined) { let any = false; for (let i = 0; i < map.kinds.length; i++) if (map.kinds[i] === RG.grid.T.STAR) { any = true; break; } map.hasStars = any; }
    if (!map.hasBridges && !map.hasStars) return;
    const st = game.state;
    const cols = map.cols;
    if (map.hasStars) {
      ctx.save();
      for (let i = 0; i < map.kinds.length; i++) {
        if (map.kinds[i] !== RG.grid.T.STAR) continue;
        const c = i % cols;
        const r = (i - c) / cols;
        if (game.tileTower(c, r)) continue;
        const cx = X(c + 0.5);
        const cy = Y(r + 0.5);
        const k = 0.6 + 0.4 * Math.sin(time * 2.4 + i * 1.7);
        const R = T * 0.16 * (0.85 + 0.15 * k);
        ctx.globalAlpha = 0.35 * k;
        ctx.fillStyle = '#fff4c0';
        ctx.beginPath(); ctx.arc(cx, cy, T * 0.36, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 0.95;
        ctx.fillStyle = '#ffe7a8';
        ctx.strokeStyle = '#6a5a2a';
        ctx.lineWidth = Math.max(1, T * 0.03);
        ctx.beginPath();
        for (let j = 0; j < 8; j++) { const a = (j / 8) * Math.PI * 2 - Math.PI / 2; const rr = j % 2 ? R * 0.4 : R; ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
        ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      ctx.restore();
    }
    if (!map.hasBridges || !st.bridge) return;
    const B = st.bridge;
    const left = B.next - st.time;
    const warn = left <= 3;
    const groups = [[map.bridgeA, B.phase === 0], [map.bridgeB, B.phase === 1]];
    ctx.save();
    for (const [tiles, open] of groups) {
      if (!tiles.length) continue;
      // 닫히기 직전 깜박임: 초당 2.5번 이하(광과민 기준), 효과 줄이기면 깜박이지 않음 — 남은 초 글자가 알려 줌
      const blink = open && warn && !RG.fx.settings.reduce ? 0.45 + 0.55 * Math.abs(Math.sin(time * 8)) : 1;
      let sx = 0;
      let sy = 0;
      for (const i of tiles) {
        const c = i % cols;
        const r = (i - c) / cols;
        sx += c; sy += r;
        const x0 = X(c);
        const y0 = Y(r);
        if (open) {
          ctx.globalAlpha = blink;
          ctx.fillStyle = 'rgba(255,231,168,0.85)';
          ctx.strokeStyle = '#7a6a3a';
          ctx.lineWidth = Math.max(1, T * 0.04);
          ctx.beginPath(); ctx.rect(x0 + T * 0.04, y0 + T * 0.12, T * 0.92, T * 0.76); ctx.fill(); ctx.stroke();
          ctx.strokeStyle = 'rgba(122,106,58,0.6)';
          ctx.beginPath();
          for (let k = 1; k < 4; k++) { ctx.moveTo(x0 + T * 0.04 + (T * 0.92 * k) / 4, y0 + T * 0.14); ctx.lineTo(x0 + T * 0.04 + (T * 0.92 * k) / 4, y0 + T * 0.86); }
          ctx.stroke();
          ctx.fillStyle = '#ffffff';
          ctx.globalAlpha = blink * (0.5 + 0.5 * Math.sin(time * 3 + i));
          ctx.beginPath(); ctx.arc(x0 + T * (0.3 + 0.4 * ((i * 37) % 10) / 10), y0 + T * 0.5, Math.max(1, T * 0.05), 0, Math.PI * 2); ctx.fill();
        } else {
          ctx.globalAlpha = 0.4;
          ctx.strokeStyle = '#ffe7a8';
          ctx.lineWidth = Math.max(1, T * 0.03);
          ctx.setLineDash([T * 0.08, T * 0.1]);
          ctx.beginPath(); ctx.rect(x0 + T * 0.08, y0 + T * 0.16, T * 0.84, T * 0.68); ctx.stroke();
          ctx.setLineDash([]);
        }
      }
      // 남은 초 (열린 다리가 곧 닫힘 · 닫힌 다리가 곧 열림)
      if (warn) {
        const cx = X(sx / tiles.length + 0.5);
        const cy = Y(sy / tiles.length + 0.5) - T * 0.55;
        ctx.globalAlpha = 1;
        ctx.font = `900 ${Math.round(Math.max(11, T * 0.36) * (RG.fx.settings.textScale || 1))}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#1a1238';
        const txt = `${open ? '닫힘' : '열림'} ${Math.ceil(left)}`;
        ctx.strokeText(txt, cx, cy);
        ctx.fillStyle = open ? '#ffb0a0' : '#c8f0ff';
        ctx.fillText(txt, cx, cy);
      }
    }
    ctx.restore();
  }

  /* ---------------- 장판·덫 ---------------- */
  const ZONE_FLAT = { fire: 'rgba(255,120,60,0.4)', lava: 'rgba(255,90,40,0.45)', void: 'rgba(110,31,102,0.5)', thorn: 'rgba(74,122,38,0.4)', blizzard: 'rgba(200,236,255,0.35)' };
  /*
   * 장판 바닥(움직이지 않는 타원 — 그라데이션이나 한 색): 종류·크기마다 한 번만 그려 두고 정수 화소 자리에 찍음.
   * 탑이 꽉 차면 장판이 여럿 깔리는데, 장판마다 매 프레임 그라데이션을 만들어 큰 타원을 칠하던 것이 비쌌음.
   * 위에서 도는 고리·눈송이·가시는 예전처럼 그때그때 그림.
   */
  const zoneDiscs = new Map();
  function zoneDisc(kind, cx, cy, R, alpha) {
    const pr = Math.max(1, Math.round(R * dpr));
    if (!plainTransform() || pr > 512) return false;
    const k = `${kind}|${pr}`;
    let cv = zoneDiscs.get(k);
    if (!cv) {
      if (zoneDiscs.size > 40) zoneDiscs.clear();
      const r = pr / dpr; // 그려 둘 반지름 (CSS 화소)
      const half = Math.ceil(r * dpr) + 2;
      cv = document.createElement('canvas');
      cv.width = half * 2; cv.height = half * 2;
      const c2 = cv.getContext('2d');
      c2.setTransform(dpr, 0, 0, dpr, half, half); // 가운데 = (0, 0)
      if (kind === 'blizzard') c2.fillStyle = 'rgba(200,236,255,0.28)';
      else if (kind === 'thorn') c2.fillStyle = 'rgba(74,122,38,0.35)';
      else {
        const g = c2.createRadialGradient(0, 0, 1, 0, 0, r);
        if (kind === 'void') { g.addColorStop(0, 'rgba(20,6,30,0.9)'); g.addColorStop(0.7, 'rgba(110,31,102,0.55)'); g.addColorStop(1, 'rgba(209,79,192,0)'); }
        else { g.addColorStop(0, 'rgba(255,214,120,0.75)'); g.addColorStop(0.55, 'rgba(255,107,61,0.45)'); g.addColorStop(1, 'rgba(160,40,20,0)'); }
        c2.fillStyle = g;
      }
      c2.beginPath(); c2.ellipse(0, 0, r, r * 0.8, 0, 0, Math.PI * 2); c2.fill();
      cv._ox = half; cv._oy = half; // ImageBitmap으로 바꿀 때 _ox·_oy만 옮겨 감
      zoneDiscs.set(k, cv);
      toBitmap(zoneDiscs, k, cv);
    }
    const a0 = ctx.globalAlpha;
    ctx.globalAlpha = alpha;
    ctx.drawImage(cv, (Math.round(cx * dpr) - cv._ox) / dpr, (Math.round(cy * dpr) - cv._oy) / dpr, cv.width / dpr, cv.height / dpr);
    ctx.globalAlpha = a0;
    return true;
  }
  function drawZones() {
    const st = game.state;
    const lite = lowFx();
    for (const z of st.zones) {
      const cx = X(z.x);
      const cy = Y(z.y);
      const R = z.radius * T;
      const fade = Math.min(1, (z.until - st.time) / 0.4);
      if (lite && ZONE_FLAT[z.kind]) { // 가벼운 단계: 무늬 없이 색 타원 하나
        ctx.globalAlpha = fade;
        ctx.fillStyle = ZONE_FLAT[z.kind];
        ctx.beginPath(); ctx.ellipse(cx, cy, R, R * 0.8, 0, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
        continue;
      }
      ctx.save();
      ctx.globalAlpha = 0.85 * fade;
      if (z.kind === 'blizzard') {
        // 눈보라: 옅은 하늘색 타원 + 도는 눈송이(한 경로) + 가장자리 바람 고리
        if (!zoneDisc('blizzard', cx, cy, R, ctx.globalAlpha)) {
          ctx.fillStyle = 'rgba(200,236,255,0.28)';
          ctx.beginPath(); ctx.ellipse(cx, cy, R, R * 0.8, 0, 0, Math.PI * 2); ctx.fill();
        }
        ctx.strokeStyle = 'rgba(235,248,255,0.7)';
        ctx.lineWidth = Math.max(1, T * 0.035);
        for (let i = 0; i < 2; i++) {
          const a = time * (2.2 + i) + i * 2;
          ctx.beginPath(); ctx.ellipse(cx, cy, R * (0.7 + 0.25 * i), R * 0.8 * (0.7 + 0.25 * i), 0, a, a + 2.2); ctx.stroke();
        }
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        const s0 = Math.max(1.5, T * 0.06);
        for (let i = 0; i < 18; i++) {
          const a = time * (1.6 + (i % 3) * 0.5) + i * 2.399;
          const rr = R * (0.15 + 0.8 * ((i * 53) % 17) / 17);
          const fx = cx + Math.cos(a) * rr;
          const fy = cy + Math.sin(a) * rr * 0.8 - T * 0.25 * ((i * 7) % 5) / 5;
          ctx.rect(fx - s0 / 2, fy - s0 / 2, s0, s0);
        }
        ctx.fill();
      } else if (z.kind === 'fire' || z.kind === 'lava') { // lava: 카라 고유 재능 '용암 자국'
        if (!zoneDisc('fire', cx, cy, R, ctx.globalAlpha)) {
          const g = ctx.createRadialGradient(cx, cy, 1, cx, cy, R);
          g.addColorStop(0, 'rgba(255,214,120,0.75)');
          g.addColorStop(0.55, 'rgba(255,107,61,0.45)');
          g.addColorStop(1, 'rgba(160,40,20,0)');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.ellipse(cx, cy, R, R * 0.8, 0, 0, Math.PI * 2); ctx.fill();
        }
        if (Math.random() < 0.25) RG.fx.burst(z.x + (Math.random() - 0.5) * z.radius, z.y + (Math.random() - 0.5) * z.radius * 0.6, '#ffb070', 1, 0.6, 0.5, 0.05, -1.5);
      } else if (z.kind === 'void') {
        if (!zoneDisc('void', cx, cy, R, ctx.globalAlpha)) {
          const g = ctx.createRadialGradient(cx, cy, 1, cx, cy, R);
          g.addColorStop(0, 'rgba(20,6,30,0.9)');
          g.addColorStop(0.7, 'rgba(110,31,102,0.55)');
          g.addColorStop(1, 'rgba(209,79,192,0)');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.ellipse(cx, cy, R, R * 0.8, 0, 0, Math.PI * 2); ctx.fill();
        }
        ctx.strokeStyle = 'rgba(242,184,234,0.6)';
        ctx.lineWidth = Math.max(1, T * 0.03);
        for (let i = 0; i < 3; i++) {
          const a = -time * 2.5 + i * 2.1;
          ctx.beginPath(); ctx.ellipse(cx, cy, R * (0.4 + i * 0.18), R * 0.8 * (0.4 + i * 0.18), 0, a, a + 1.4); ctx.stroke();
        }
      } else if (z.kind === 'thorn') {
        if (!zoneDisc('thorn', cx, cy, R, ctx.globalAlpha)) {
          ctx.fillStyle = 'rgba(74,122,38,0.35)';
          ctx.beginPath(); ctx.ellipse(cx, cy, R, R * 0.8, 0, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = '#9fd36a';
        ctx.strokeStyle = '#2b4a17';
        ctx.lineWidth = 1;
        // 가시 12개를 한 경로로 — 칠하기·선 긋기 호출을 24번 → 2번으로
        ctx.beginPath();
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2;
          const rr = R * (0.45 + 0.4 * ((i * 37) % 10) / 10);
          const sx = cx + Math.cos(a) * rr;
          const sy = cy + Math.sin(a) * rr * 0.8;
          ctx.moveTo(sx - T * 0.05, sy); ctx.lineTo(sx, sy - T * 0.16); ctx.lineTo(sx + T * 0.05, sy); ctx.closePath();
        }
        ctx.fill(); ctx.stroke();
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

  /* ---------------- 빛의 등대: 도는 빛줄기 ---------------- */
  // 등실(muzzle)에서 땅의 사거리 원까지 부채꼴 빛. 각도는 시뮬의 t.sweepA를 프레임 사이로 이어 그림
  const DT_SIM = 1 / 30; // 시뮬 한 틱 (sim.js DT)
  function drawSweeps(alpha) {
    const st = game.state;
    let any = false;
    for (const t of st.towers) {
      const c = t.calc;
      if (!c || c.kind !== 'sweep' || t.disabled || t.building || !c.sweep) continue;
      if (!any) { any = true; ctx.save(); ctx.globalCompositeOperation = 'lighter'; }
      const S = c.sweep;
      const a0 = (t.sweepA || 0) + S.speed * DT_SIM * alpha;
      const mz = muzzleOf(t) || { x: t.x, y: t.y - 0.6 };
      const ox0 = X(mz.x);
      const oy0 = Y(mz.y);
      const R = c.range;
      const n = S.beams || 1;
      for (let b = 0; b < n; b++) {
        const a = a0 + (b * Math.PI * 2) / n;
        const h = S.width / 2;
        // 그라데이션 대신 단색 부채꼴 두 겹(긴 것은 옅게, 짧은 것은 진하게) — 매 프레임 그라데이션 칠하기보다 가벼움
        for (let layer = 0; layer < 2; layer++) {
          const rr = layer ? R * 0.55 : R;
          const hh = layer ? h * 0.7 : h;
          ctx.fillStyle = layer ? 'rgba(255,248,214,0.22)' : (S.mark ? 'rgba(255,226,150,0.2)' : 'rgba(255,240,190,0.17)');
          ctx.beginPath();
          ctx.moveTo(ox0, oy0);
          for (let k = 0; k <= 4; k++) {
            const aa = a - hh + (2 * hh * k) / 4;
            ctx.lineTo(X(t.x + Math.cos(aa) * rr), Y(t.y + Math.sin(aa) * rr * 0.92));
          }
          ctx.closePath();
          ctx.fill();
        }
      }
    }
    if (any) ctx.restore();
  }

  /* ---------------- 불사조 (불사조 둥지) ---------------- */
  /** 불사조: 시뮬과 같은 꽃잎 길(RG.sim.orbitPos)로 그리고, 날아가는 쪽을 보며 날갯짓, 뒤로 불꽃 조각 */
  function drawOrbits(alpha) {
    const st = game.state;
    for (const t of st.towers) {
      const c = t.calc;
      if (!c || c.kind !== 'orbit' || !c.orbit || t.building) continue;
      const O = c.orbit;
      const a0 = (t.orbitA || 0) + (t.disabled ? 0 : O.speed * DT_SIM * alpha);
      const n = O.birds || 1;
      const sz = T * (0.85 + O.radius * 0.9);
      for (let i = 0; i < n; i++) {
        const [bx, by] = RG.sim.orbitPos(t, c, i, a0);
        const [nx, ny] = RG.sim.orbitPos(t, c, i, a0 + 0.08);
        const ang = Math.atan2(ny - by, nx - bx);
        const hy = by - 0.55; // 땅에서 조금 떠서 남
        const key = `fx:phoenix:${Math.floor(time * 9 + i * 2) % 2}`;
        const S = RG.art.sprites;
        if (!S.get(key)) { if (RG.art.fxSprite) S.load(key, () => RG.art.fxSprite('phoenix', key.endsWith('1') ? 1 : 0), 120, 120); continue; }
        // 땅 그림자
        ctx.fillStyle = 'rgba(30,10,10,0.22)';
        ctx.beginPath(); ctx.ellipse(X(bx), Y(by), sz * 0.3, sz * 0.1, 0, 0, Math.PI * 2); ctx.fill();
        ctx.save();
        ctx.translate(X(bx), Y(hy));
        const flip = Math.cos(ang) < 0;
        ctx.rotate(flip ? ang + Math.PI : ang);
        if (flip) ctx.scale(-1, 1);
        sprite(key, 0, 0, sz, sz, 0.5, 0.5, false);
        ctx.restore();
        if (!t.disabled && Math.random() < (manyEnemies ? 0.25 : 0.7)) RG.fx.burst(bx - Math.cos(ang) * 0.25, hy - Math.sin(ang) * 0.25, Math.random() < 0.5 ? '#ffb347' : '#ffe08a', 1, 0.5, 0.45, 0.06, -0.8);
      }
    }
  }

  /* ---------------- 구르는 것 (폭풍의 눈·거인의 바위) ---------------- */
  function drawRoller(R, alpha) {
    const x = lerp(R.px, R.x, alpha);
    const y = lerp(R.py, R.y, alpha);
    const cx = X(x);
    const cy = Y(y);
    const fadeIn = Math.min(1, (game.state.time - R.startAt) / 0.2);
    const left = R.length - R.travelled;
    const fade = Math.min(fadeIn, Math.max(0, left / 0.4));
    if (R.type === 'tornado') {
      // 회오리: 위로 넓어지는 타원 고리를 겹쳐 쌓고 돌림
      const H = T * (1.4 + R.radius * 1.2);
      const W = T * R.radius * 1.15;
      ctx.save();
      ctx.globalAlpha = 0.85 * fade;
      ctx.fillStyle = 'rgba(30,40,60,0.25)';
      ctx.beginPath(); ctx.ellipse(cx, cy, W * 0.9, W * 0.3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = Math.max(1.5, T * 0.06);
      const n = 6;
      const spin = time * 9;
      for (let i = 0; i < n; i++) {
        const k = i / (n - 1);
        const ry = cy - H * k;
        const rx = W * (0.35 + 0.85 * k) * (1 + 0.08 * Math.sin(spin + i));
        const sway = Math.sin(time * 3 + i * 0.7) * T * 0.12 * k;
        ctx.strokeStyle = i % 2 ? 'rgba(220,232,255,0.85)' : 'rgba(150,170,210,0.8)';
        const a = (spin + i * 1.3) % (Math.PI * 2);
        ctx.beginPath(); ctx.ellipse(cx + sway, ry, rx, rx * 0.3, 0, a, a + Math.PI * 1.5); ctx.stroke();
      }
      if (R.stun) { // 번개 회오리: 감기는 번개
        ctx.strokeStyle = 'rgba(200,180,255,0.9)';
        ctx.beginPath();
        for (let i = 0; i <= 5; i++) { const k = i / 5; const px = cx + Math.sin(spin * 1.7 + k * 9) * W * (0.4 + 0.6 * k); const py = cy - H * k; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
        ctx.stroke();
      }
      ctx.restore();
      if (Math.random() < (manyEnemies ? 0.2 : 0.6)) RG.fx.burst(x + (Math.random() - 0.5) * R.radius, y, '#d8dfe8', 1, 1.4, 0.4, 0.05, -1);
      return;
    }
    // 바위·철구: 구르는 그림(돌아감) + 그림자
    const size = T * R.radius * 2.1;
    const key = R.shred ? 'fx:ironball' : 'fx:boulder';
    const S = RG.art.sprites;
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.fillStyle = 'rgba(20,12,24,0.32)';
    ctx.beginPath(); ctx.ellipse(cx + T * 0.05, cy + size * 0.02, size * 0.5, size * 0.17, 0, 0, Math.PI * 2); ctx.fill();
    if (!S.get(key)) { if (RG.art.fxSprite) S.load(key, () => RG.art.fxSprite(R.shred ? 'ironball' : 'boulder', 0), 120, 120); ctx.fillStyle = '#8a7a66'; ctx.beginPath(); ctx.arc(cx, cy - size * 0.45, size * 0.45, 0, Math.PI * 2); ctx.fill(); ctx.restore(); return; }
    ctx.translate(cx, cy - size * 0.45);
    const dir = R.path[Math.min(R.path.length - 1, R.seg + 1)];
    const sgn = dir && dir.x < x - 0.01 ? -1 : 1;
    ctx.rotate(sgn * (R.spin / (R.radius * 1.05)));
    sprite(key, 0, 0, size, size, 0.5, 0.5, false);
    ctx.restore();
  }

  /* ---------------- 공명 선 ---------------- */
  /*
   * 공명 선(움직이지 않는 부분): 탑 그림자 층에 함께 구워 둠 — 공명 선이 바뀔 때만 다시 그림 (짝 목록은 syncTowers가 만듦).
   * 선 하나 = 두 원소 색 그라데이션 띠 + 흰 심. 탑이 꽉 차면 선이 백 개를 넘어 바뀔 때마다 그라데이션 선 수백 개를 긋는 것이
   * 비쌌으므로, 방향·두 색·화소 아래 자리(1/8 화소)마다 선 한 개를 작은 그림으로 그려 두고 정수 화소 자리에 찍음 — 같은 순서로 겹쳐 결과는 같음.
   */
  const linkSprites = new Map();
  function linkSprite(key, dc, dr, qx, qy, s, ca, cb) {
    let sp = linkSprites.get(key);
    if (sp) return sp;
    if (linkSprites.size > 1024) linkSprites.clear();
    const lw = Math.max(2, T * 0.09) * s;
    const lc = Math.max(1, T * 0.025) * s;
    const pad = Math.ceil(lw / 2) + 2;
    const step = T * s;
    const px = qx / 8;
    const py = qy / 8;
    const bx = px + dc * step;
    const by = py + dr * step;
    const x0 = Math.floor(Math.min(px, bx)) - pad;
    const y0 = Math.floor(Math.min(py, by)) - pad;
    sp = document.createElement('canvas');
    sp.width = Math.ceil(Math.max(px, bx)) + pad - x0;
    sp.height = Math.ceil(Math.max(py, by)) + pad - y0;
    const c2 = sp.getContext('2d');
    c2.translate(-x0, -y0);
    c2.lineCap = 'round';
    const g = c2.createLinearGradient(px, py, bx, by);
    g.addColorStop(0, ca);
    g.addColorStop(1, cb);
    c2.globalAlpha = 0.55;
    c2.strokeStyle = g;
    c2.lineWidth = lw;
    c2.beginPath(); c2.moveTo(px, py); c2.lineTo(bx, by); c2.stroke();
    c2.globalAlpha = 0.8;
    c2.strokeStyle = '#ffffff';
    c2.lineWidth = lc;
    c2.beginPath(); c2.moveTo(px, py); c2.lineTo(bx, by); c2.stroke();
    sp._ox = x0; sp._oy = y0;
    linkSprites.set(key, sp); // 층을 다시 합칠 때만 쓰므로 ImageBitmap으로 바꾸지 않음 (매 프레임 쓰는 그림이 먼저 바뀌게)
    return sp;
  }
  function bakeLinks(c) {
    if (!linkPairs.length) return;
    const m = c.getTransform();
    const s = m.a;
    if (!(s > 0) || m.b !== 0 || m.c !== 0 || Math.abs(m.d - s) > 1e-9) { strokeLinks(c); return; } // 회전·눌림이 끼면 예전처럼 그음
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalAlpha = 1;
    for (let i = 0; i < linkPairs.length; i += 2) {
      const t = linkPairs[i];
      const n = linkPairs[i + 1];
      const ax = s * X(t.x) + m.e;
      const ay = s * Y(t.y + 0.15) + m.f;
      const fx = Math.floor(ax);
      const fy = Math.floor(ay);
      const qx = Math.round((ax - fx) * 8);
      const qy = Math.round((ay - fy) * 8);
      const dc = Math.round(n.x - t.x);
      const dr = Math.round(n.y - t.y);
      const ca = elColor(RG.data.towers[t.type].element);
      const cb = elColor(RG.data.towers[n.type].element);
      const sp = linkSprite(`${s}|${T}|${dc}|${dr}|${qx}|${qy}|${ca}|${cb}`, dc, dr, qx, qy, s, ca, cb);
      c.drawImage(sp, fx + sp._ox, fy + sp._oy);
    }
    c.restore();
  }
  /** 공명 선을 바로 긋기 (변환이 화면 배율·이동만이 아닐 때) */
  function strokeLinks(c) {
    c.save();
    c.lineCap = 'round';
    for (let i = 0; i < linkPairs.length; i += 2) {
      const t = linkPairs[i];
      const n = linkPairs[i + 1];
      const ax = X(t.x); const ay = Y(t.y + 0.15); const bx = X(n.x); const by = Y(n.y + 0.15);
      const g = c.createLinearGradient(ax, ay, bx, by);
      g.addColorStop(0, elColor(RG.data.towers[t.type].element));
      g.addColorStop(1, elColor(RG.data.towers[n.type].element));
      c.globalAlpha = 0.55;
      c.strokeStyle = g;
      c.lineWidth = Math.max(2, T * 0.09);
      c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.stroke();
      c.globalAlpha = 0.8;
      c.strokeStyle = '#ffffff';
      c.lineWidth = Math.max(1, T * 0.025);
      c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.stroke();
    }
    c.restore();
  }
  /** 공명 선 위를 흐르는 빛 구슬: 모든 구슬을 한 경로로 모아 한 번에 칠함 (층이 없으면 선도 여기서) */
  function drawLinks() {
    if (!shadeBaked) bakeLinks(ctx);
    if (!linkPairs.length || lowFx()) return; // 가벼운 단계: 선 위를 도는 빛은 생략(선 자체는 바탕에 구워져 있음)
    const r = Math.max(1.5, T * 0.05);
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    for (let i = 0; i < linkPairs.length; i += 2) {
      const t = linkPairs[i];
      const n = linkPairs[i + 1];
      const k = (time * 0.7 + (t.id * 0.13)) % 1;
      const x = lerp(X(t.x), X(n.x), k);
      const y = lerp(Y(t.y + 0.15), Y(n.y + 0.15), k);
      ctx.moveTo(x + r, y);
      ctx.arc(x, y, r, 0, Math.PI * 2);
    }
    ctx.fill();
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

  /** 건설 미리보기 탑 그림: 지을 수 있으면 초록빛, 없으면 붉은빛을 입힌 사본 (탑 그림마다 한 번 만들어 둠) */
  const ghostTints = new Map();
  function ghostImage(key, ok) {
    const s = RG.art.sprites.get(key);
    if (!s) return null;
    const k = `${key}|${ok ? 1 : 0}`;
    let g = ghostTints.get(k);
    if (g && g.src === s.canvas) return g.canvas;
    const cv = document.createElement('canvas');
    cv.width = s.canvas.width;
    cv.height = s.canvas.height;
    const c2 = cv.getContext('2d');
    c2.drawImage(s.canvas, 0, 0);
    c2.globalCompositeOperation = 'source-atop';
    c2.fillStyle = ok ? 'rgba(120,255,150,0.22)' : 'rgba(255,60,60,0.5)';
    c2.fillRect(0, 0, cv.width, cv.height);
    g = { src: s.canvas, canvas: cv };
    ghostTints.set(k, g);
    return cv;
  }

  /** 키보드 커서: 탑·적 위에, 어떤 바탕에서도 보이게 검은 테 + 밝은 모서리 꺾쇠 */
  function drawKeyCursor(c, r) {
    const x = X(c); const y = Y(r); const L = T * 0.3;
    ctx.save();
    ctx.lineCap = 'round';
    for (const [w, col] of [[Math.max(3, T * 0.11), 'rgba(0,0,0,0.75)'], [Math.max(2, T * 0.055), '#fff2c4']]) {
      ctx.lineWidth = w;
      ctx.strokeStyle = col;
      ctx.beginPath();
      for (const [cx, cy, dx, dy] of [[x, y, 1, 1], [x + T, y, -1, 1], [x, y + T, 1, -1], [x + T, y + T, -1, -1]]) {
        ctx.moveTo(cx + dx * 2, cy + dy * (2 + L)); ctx.lineTo(cx + dx * 2, cy + dy * 2); ctx.lineTo(cx + dx * (2 + L), cy + dy * 2);
      }
      ctx.stroke();
    }
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
      const spec = td.levels[(game.startLevel ? game.startLevel(gh.type) : 1) - 1];
      const x = gh.c + 0.5;
      const y = gh.r + 0.5;
      ctx.save();
      ctx.fillStyle = gh.ok ? 'rgba(140,255,160,0.22)' : 'rgba(255,90,90,0.28)';
      ctx.fillRect(X(gh.c), Y(gh.r), T, T);
      ctx.strokeStyle = gh.ok ? 'rgba(170,255,185,0.9)' : 'rgba(255,120,120,0.9)';
      ctx.lineWidth = Math.max(1.5, T * 0.045);
      ctx.strokeRect(X(gh.c) + 1.5, Y(gh.r) + 1.5, T - 3, T - 3);
      if (!gh.ok) {
        // 색만으로 알리지 않게(색약): 못 짓는 칸은 굵은 ✕ (검은 테 + 밝은 선)
        const x0 = X(gh.c) + T * 0.24; const y0 = Y(gh.r) + T * 0.24; const x1 = X(gh.c) + T * 0.76; const y1 = Y(gh.r) + T * 0.76;
        ctx.lineCap = 'round';
        for (const [w, col] of [[Math.max(4, T * 0.13), 'rgba(20,6,10,0.8)'], [Math.max(2, T * 0.07), '#ffd0c8']]) {
          ctx.lineWidth = w; ctx.strokeStyle = col;
          ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.moveTo(x1, y0); ctx.lineTo(x0, y1); ctx.stroke();
        }
      }
      ctx.restore();
      if (spec.range) rangeCircle(x, y, spec.range * (1 + ((game.meta && game.meta.rangePct) || 0)), gh.ok ? 'rgba(200,255,210,A)' : 'rgba(255,140,140,A)', !gh.ok);
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
    if (td.kind === 'sweep') { const ph = (time * 1.1 + t.id * 0.37) % 2; return t.anim > 0 ? (ph < 1 ? 'fire' : 'aim') : ph < 1.4 ? 'idle' : 'aim'; } // 등대: 렌즈가 돌며 번쩍
    if (td.kind === 'orbit') return t.anim > 0 ? 'fire' : ((time * 0.9 + t.id * 0.37) % 2 < 1.3 ? 'idle' : 'aim'); // 불사조 둥지: 불사조가 적을 스치면 불꽃이 솟음
    const iv = (t.calc && t.calc.interval) || 1;
    // 효과 줄이기: 아주 빨리 쏘는 탑(실제로 0.34초보다 자주)은 발사 그림(총구 불꽃)을 건너뜀
    if (t.anim > 0.11) return RG.fx.settings.reduce && iv / Math.max(1, (RG.fx.getSpeed ? RG.fx.getSpeed() : 1)) < 0.34 ? 'aim' : 'fire';
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
  /** 각성한 탑(Lv5): 발밑 원소 빛 고리(천천히 숨쉬듯) + 머리 위 금빛 별, 가끔 오르는 불티 — 번쩍임 없음(효과 줄이기에도 안전) */
  // 각성 빛 고리의 그라데이션 타원: 원소 색·칸 크기마다 한 번만 그려 두고 정수 화소 자리에 찍음 (탑마다 매 프레임 그라데이션을 만들지 않음)
  const auraDiscs = new Map();
  function auraDisc(col) {
    const k = `${col}|${T}|${dpr}`;
    let cv = auraDiscs.get(k);
    if (cv) return cv;
    if (auraDiscs.size > 24) auraDiscs.clear();
    const hw = Math.ceil(T * 0.62 * dpr) + 2;
    const hh = Math.ceil(T * 0.26 * dpr) + 2;
    cv = document.createElement('canvas');
    cv.width = hw * 2; cv.height = hh * 2;
    const c2 = cv.getContext('2d');
    c2.setTransform(dpr, 0, 0, dpr, hw, hh);
    const g = c2.createRadialGradient(0, 0, T * 0.05, 0, 0, T * 0.62);
    g.addColorStop(0, '#fff3c8cc');
    g.addColorStop(0.45, col + 'aa');
    g.addColorStop(1, col + '00');
    c2.fillStyle = g;
    c2.beginPath(); c2.ellipse(0, 0, T * 0.62, T * 0.26, 0, 0, Math.PI * 2); c2.fill();
    cv._ox = hw; cv._oy = hh; // ImageBitmap으로 바꿀 때 _ox·_oy만 옮겨 감
    auraDiscs.set(k, cv);
    toBitmap(auraDiscs, k, cv);
    return cv;
  }
  function drawAwakenAura(t, cx, baseY, front) {
    const col = elColor(RG.data.towers[t.type].element);
    const k = 0.5 + 0.5 * Math.sin(time * 2.2 + t.id);
    ctx.save();
    if (!front) {
      ctx.globalAlpha = 0.55 + 0.25 * k;
      if (plainTransform()) {
        const cv = auraDisc(col);
        ctx.drawImage(cv, (Math.round(cx * dpr) - cv._ox) / dpr, (Math.round(baseY * dpr) - cv._oy) / dpr, cv.width / dpr, cv.height / dpr);
      } else {
        const g = ctx.createRadialGradient(cx, baseY, T * 0.05, cx, baseY, T * 0.62);
        g.addColorStop(0, '#fff3c8cc');
        g.addColorStop(0.45, col + 'aa');
        g.addColorStop(1, col + '00');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.ellipse(cx, baseY, T * 0.62, T * 0.26, 0, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 0.7;
      ctx.strokeStyle = '#ffd27a';
      ctx.lineWidth = Math.max(1, T * 0.035);
      ctx.beginPath(); ctx.ellipse(cx, baseY, T * (0.46 + 0.04 * k), T * (0.18 + 0.015 * k), 0, 0, Math.PI * 2); ctx.stroke();
    } else {
      // 머리 위 네 갈래 별
      const sx = cx;
      const sy = baseY - T * 1.18 - T * 0.04 * k;
      const R = T * (0.11 + 0.02 * k);
      ctx.globalAlpha = 0.95;
      ctx.fillStyle = '#ffe9a8';
      ctx.strokeStyle = '#7a4a10';
      ctx.lineWidth = Math.max(1, T * 0.02);
      ctx.beginPath();
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 - Math.PI / 2; const r = i % 2 ? R * 0.38 : R; ctx.lineTo(sx + Math.cos(a) * r, sy + Math.sin(a) * r); }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      if (!lowFx() && Math.random() < 0.06) RG.fx.burst(t.x + (Math.random() - 0.5) * 0.6, t.y + 0.2, col, 1, 0.9, 0.35, 0.04, -1.1);
    }
    ctx.restore();
  }

  /*
   * 탑마다 그림 이름(쉬기·겨누기·쏘기)을 한 번만 만들어 둠: 매 프레임 탑마다 이름 문자열 두 개와 그림 만드는 함수를 새로 만들면
   * 탑이 꽉 찬 판(88개)에서 그것만으로도 쓰레기·찾기 비용이 컸음. 단계·분기가 바뀌면 새로 만듦.
   */
  const towerKeys = new Map(); // 탑 id → { type, level, branch, idle, aim, fire }
  function towerKeysOf(t) {
    let k = towerKeys.get(t.id);
    if (!k || k.type !== t.type || k.level !== t.level || k.branch !== t.branch) {
      const A = RG.art.sprites;
      k = { type: t.type, level: t.level, branch: t.branch, idle: A.towerKey(t.type, t.level, t.branch, 'idle'), aim: A.towerKey(t.type, t.level, t.branch, 'aim'), fire: A.towerKey(t.type, t.level, t.branch, 'fire') };
      if (towerKeys.size > 512) towerKeys.clear();
      towerKeys.set(t.id, k);
    }
    return k;
  }
  /**
   * 쏠 때 눌림: 바닥(cx, by) 기준으로 가로 kx·세로 ky배 — 변환(save·scale·restore) 없이 줄여 둔 그림을 그 크기로 바로 찍음.
   * 예전처럼 변환을 걸고 sprite()로 그린 것과 같은 자리·같은 크기(같은 늘이기)로 그려짐.
   */
  function spriteSquish(key, cx, by, w, h, ax, ay, kx, ky) {
    const s = RG.art.sprites.get(key);
    if (!s) return false;
    if (!plainTransform()) {
      ctx.save();
      ctx.translate(cx, by); ctx.scale(kx, ky); ctx.translate(-cx, -by);
      sprite(key, cx, by, w, h, ax, ay, false);
      ctx.restore();
      return true;
    }
    const img = fitted(s, w, h, false);
    if (img === s.canvas) ctx.drawImage(img, cx - w * ax * kx, by - h * ay * ky, w * kx, h * ky);
    else {
      const fx = w / img._fw;
      const fy = h / img._fh;
      ctx.drawImage(img, cx + (img._ox * fx - w * ax) * kx, by + (img._oy * fy - h * ay) * ky, img.width * fx * kx, img.height * fy * ky);
    }
    return true;
  }

  function drawTower(t) {
    const cx = X(t.x);
    const baseY = Y(t.r + 0.82);
    const w = T;
    const h = T * 1.3;
    let sy = 1;
    if (t.anim > 0) sy = 1 - 0.025 * (t.anim / 0.25); // 쏠 때 아주 살짝 눌림 (동작은 그림 자세가 맡음)
    const pose = towerPose(t);
    const K = towerKeysOf(t);
    const pk = K[pose];
    // 준비된 자세 그림이면 바로 (아니면 준비를 시작하고 쉬는 자세로)
    const key = RG.art.sprites.get(pk) ? pk : poseSprite(pk, K.idle, () => RG.art.tower(t.type, t.level, t.branch, pose), RG.art.sprites.TW, RG.art.sprites.TH);
    if (!shadeBaked) castShadow(key, cx, baseY, w, h, 0.5, 112 / 130, false, t.building ? 0.2 : 0.42);
    if (t.level >= 5 && !t.building) drawAwakenAura(t, cx, baseY, false);
    // 쏠 때 눌림은 적이 아주 많으면 생략 — 늘여 그리면 화소마다 샘플링하는 느린 길로 그려짐(자세 그림이 동작을 보여 줌)
    const squish = sy !== 1 && !manyEnemies;
    if (t.building) { ctx.save(); ctx.globalAlpha = 0.55; }
    const ok = squish ? spriteSquish(key, cx, baseY, w, h, 0.5, 112 / 130, 1 + (1 - sy) * 0.5, sy) : sprite(key, cx, baseY, w, h, 0.5, 112 / 130, false);
    if (!ok) {
      ctx.fillStyle = elColor(RG.data.towers[t.type].element);
      ctx.fillRect(cx - T * 0.3, baseY - T * 0.7, T * 0.6, T * 0.7);
    }
    if (t.building) ctx.restore();
    if (t.level >= 5 && !t.building) drawAwakenAura(t, cx, baseY, true);
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
    if (t.veilUntil > game.state.time) {
      // 그믐달 군주 '별 가리기': 사거리가 줄어든 탑 위에 어두운 초승달
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = '#1a1238';
      ctx.strokeStyle = '#c8b8ff';
      ctx.lineWidth = Math.max(1, T * 0.03);
      const mx = cx + T * 0.3;
      const my = baseY - T * 1.0;
      const R = T * 0.16;
      ctx.beginPath(); ctx.arc(mx, my, R, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffe7a8';
      ctx.beginPath(); ctx.arc(mx - R * 0.35, my, R * 0.7, Math.PI * 0.5, Math.PI * 1.5); ctx.arc(mx - R * 0.1, my, R * 0.5, Math.PI * 1.5, Math.PI * 0.5, true); ctx.fill();
      ctx.restore();
    }
    if (t.boostUntil > game.state.time && !t.building) {
      // 도한의 담금질(주황 불티 고리) · 무진의 되울림 종(보랏빛 고리) — 공격 속도가 오른 탑
      const temper = t.temperUntil > game.state.time;
      ctx.save();
      ctx.globalAlpha = 0.55 + 0.25 * Math.sin(time * 9 + t.id);
      ctx.strokeStyle = temper ? '#ffb03a' : '#c8a8f0';
      ctx.lineWidth = Math.max(1.5, T * 0.05);
      ctx.beginPath(); ctx.ellipse(cx, baseY, T * 0.44, T * 0.17, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
      if (temper && !lowFx() && Math.random() < 0.12) RG.fx.burst(t.x + (Math.random() - 0.5) * 0.5, t.y - 0.6, '#ffd23a', 1, 0.8, 0.4, 0.05, -1.2);
    }
    if (t.calc && t.calc.harvest && t.souls > 0 && !t.building) {
      // 영혼 수확자: 모은 영혼을 탑 위에 도는 작은 보랏빛 점으로
      const H = t.calc.harvest;
      const r0 = T * 0.42;
      const dot = Math.max(1.5, T * 0.05);
      ctx.fillStyle = t.souls >= H.max - 2 ? '#f0d8ff' : '#c890ff';
      ctx.beginPath();
      for (let i = 0; i < t.souls; i++) {
        const a = time * 1.8 + (i / H.max) * Math.PI * 2;
        const px = cx + Math.cos(a) * r0;
        const py = baseY - T * 1.05 + Math.sin(a) * r0 * 0.35;
        ctx.moveTo(px + dot, py);
        ctx.arc(px, py, dot, 0, Math.PI * 2);
      }
      ctx.fill();
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

  const stunPts = []; // 기절 별 자리 (프레임마다 모아 한 번에 칠함)
  const isFrozenNow = (e) => game.state.time < e.ccUntil && e.ccKind === 'freeze';
  /** 공포 표시 '!!' — 칸 크기·화면 배율마다 한 번 구워 둠 (적이 많을 때 글자 그리기 수백 번을 피함) */
  let fearCv = null;
  function fearMark() {
    const fs = Math.max(10, Math.round(T * 0.3));
    const k = `${fs}|${dpr}`;
    if (fearCv && fearCv._k === k) return fearCv;
    const w = Math.ceil(fs * 1.3);
    const h = Math.ceil(fs * 1.3);
    const cv = document.createElement('canvas');
    cv.width = Math.ceil(w * dpr); cv.height = Math.ceil(h * dpr);
    const c2 = cv.getContext('2d');
    c2.scale(dpr, dpr);
    c2.font = `900 ${fs}px system-ui, sans-serif`;
    c2.textAlign = 'center';
    c2.textBaseline = 'alphabetic';
    c2.lineWidth = Math.max(2, T * 0.06);
    c2.lineJoin = 'round';
    c2.strokeStyle = '#2a0f30';
    c2.fillStyle = '#e9a6ff';
    c2.strokeText('!!', w / 2, h * 0.72); c2.fillText('!!', w / 2, h * 0.72);
    cv._k = k; cv._w = w; cv._h = h;
    fearCv = cv;
    return cv;
  }

  /** 시간 멈춤 표시(모래시계) — 칸 크기·배율마다 한 번 구움 */
  let clockCv = null;
  function clockMark() {
    const s0 = Math.max(10, Math.round(T * 0.34));
    const k = `${s0}|${dpr}`;
    if (clockCv && clockCv._k === k) return clockCv;
    const w = s0;
    const h = Math.round(s0 * 1.25);
    const cv = document.createElement('canvas');
    cv.width = Math.ceil(w * dpr); cv.height = Math.ceil(h * dpr);
    const c2 = cv.getContext('2d');
    c2.scale(dpr, dpr);
    c2.lineJoin = 'round';
    c2.fillStyle = '#ffe39a'; c2.strokeStyle = '#4a3010'; c2.lineWidth = Math.max(1.2, s0 * 0.09);
    c2.beginPath(); c2.moveTo(w * 0.15, h * 0.1); c2.lineTo(w * 0.85, h * 0.1); c2.lineTo(w * 0.5, h * 0.5); c2.lineTo(w * 0.85, h * 0.9); c2.lineTo(w * 0.15, h * 0.9); c2.lineTo(w * 0.5, h * 0.5); c2.closePath(); c2.fill(); c2.stroke();
    c2.fillStyle = '#fff8e0'; c2.beginPath(); c2.moveTo(w * 0.32, h * 0.82); c2.lineTo(w * 0.68, h * 0.82); c2.lineTo(w * 0.5, h * 0.62); c2.closePath(); c2.fill();
    cv._k = k; cv._w = w; cv._h = h;
    clockCv = cv;
    return cv;
  }

  const iconCache = new Map();
  /*
   * 상태 아이콘(멈춤·침묵·공명 끊김·저주·기절)은 SVG 그림이라 캔버스에 찍을 때마다 도형을 처음부터 다시 그림 —
   * 후반 웨이브엔 탑 수십 개·적 여럿에 매 프레임 붙어 비쌌음. 표시 크기(화면 배율 포함)마다 한 번만 그려 두고 그대로 찍음.
   */
  const iconFit = new Map(); // 이름 → (화소 크기 → 그려 둔 그림)
  function icon(name, cx, cy, size) {
    let img = iconCache.get(name);
    if (!img && RG.art.icon) {
      img = new Image();
      img.src = RG.art.sprites.dataUrl(RG.art.sprites.sized(RG.art.icon(name), 64, 64));
      iconCache.set(name, img);
    }
    if (!img || !img.complete || !img.naturalWidth) return;
    const px = Math.max(1, Math.round(size * dpr));
    if (!plainTransform() || px > 256) { ctx.drawImage(img, cx - size / 2, cy - size / 2, size, size); return; }
    let m = iconFit.get(name);
    if (!m) { m = new Map(); iconFit.set(name, m); }
    let cv = m.get(px);
    if (!cv) {
      if (m.size > 6) m.clear(); // 크기가 자주 바뀌면(창 크기·화질) 오래된 것은 버림
      cv = document.createElement('canvas');
      cv.width = px; cv.height = px;
      cv.getContext('2d').drawImage(img, 0, 0, px, px);
      m.set(px, cv);
      toBitmap(m, px, cv);
    }
    // 정수 화소 자리에 원래 크기 그대로 (늘이기·반 화소 없이 또렷하게)
    ctx.drawImage(cv, Math.round((cx - size / 2) * dpr) / dpr, Math.round((cy - size / 2) * dpr) / dpr, px / dpr, px / dpr);
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
    if (!shadeBaked) castShadow(RG.art.sprites.lanternKey(ratio), cx, baseY, T, T * 1.3, 0.5, 112 / 130, false, 0.42);
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
  const NO_MOTION = Object.freeze({});
  const shSpec = [0, 0, 0, 0, 0];
  /** 적이 아주 많을 때 이 적의 그늘을 그림에 구워 넣는가 (큰 적·보스는 드리운 그림자, 깡충 뛰는 적·띄워진 적은 따로 칠함) */
  function bakesShadow(e) {
    if (!manyEnemies || e.burrowed) return false;
    const ed = RG.data.enemies[e.type];
    if (ed.boss || ed.size >= 1.4) return false;
    const mo = RG.art.ENEMY_MOTION && RG.art.ENEMY_MOTION[e.type];
    if (mo && mo.hop) return false;
    if (game.state.time < e.ccUntil && e.ccKind === 'lift') return false;
    return true;
  }
  // 매 프레임 적마다 부르므로 같은 점 객체를 다시 씀 — 받은 쪽은 바로 읽고 넘김(보관하지 않음)
  const ePt = { x: 0, y: 0 };
  function enemyScreen(e, alpha) {
    ePt.x = lerp(e.px, e.x, alpha);
    ePt.y = lerp(e.py, e.y, alpha);
    return ePt;
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
    const mo = (RG.art.ENEMY_MOTION && RG.art.ENEMY_MOTION[e.type]) || NO_MOTION;
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
    let alphaS = (e.stealth && !e.revealed) ? 0.35 + 0.1 * Math.sin(time * 6) : 1;
    // 위상 망령: 순간이동 직전 일렁임 — 초당 2.5번 이하로, 효과 줄이기면 흐릿하게만 (발밑 점선 원은 아래에서)
    if (e.phaseWarn) { if (RG.fx.settings.reduce) alphaS *= 0.6; else { alphaS *= 0.45 + 0.4 * Math.abs(Math.sin(time * 8)); dx += Math.sin(time * 16) * T * 0.04; } }
    // 맞은 번쩍임: 한 적이 여러 탑에 맞아도 1초에 3번 정도까지(실제 시간), 효과 줄이기면 없음 — 체력 막대가 대신 알려 줌
    // 한 번 맞을 때마다 한 번만(멈춤 중에 되풀이하지 않게), 새로 맞아도 0.34초 안이면 건너뜀. 적이 아주 많으면 셈도 건너뜀
    let hurt = !manyEnemies && !RG.fx.settings.reduce && st.time - e.lastHurt < 0.08;
    if (hurt) {
      if (hurtAt.size > 400) hurtAt.clear();
      const h = hurtAt.get(e.id);
      if (!h || (h.hit !== e.lastHurt && time - h.at >= 0.34)) hurtAt.set(e.id, { hit: e.lastHurt, at: time });
      else if (h.hit !== e.lastHurt || time - h.at > 0.08) hurt = false; // 같은 맞음은 0.08초만 보이고, 너무 잦은 새 맞음은 건너뜀
    }
    const flip = e.dir < 0;
    const big = ed.size >= 1.4 ? 288 : 168;
    const k0 = ekey(e.type, frame);
    const key = RG.art.sprites.get(k0) ? k0 : poseSprite(k0, ekey(e.type, 'walk0'), () => RG.art.enemy(e.type, frame), big, big);
    if (!manyEnemies || ed.boss || ed.size >= 1.4) castShadow(key, cx + dx, groundY, size, size, 0.5, 0.9, flip, (e.flying ? 0.16 : 0.32) * alphaS, lift);
    const motion = !manyEnemies && (rot || sxk !== 1 || syk !== 1 || dx); // 적이 아주 많으면 변형 생략(성능), 튀기기는 유지
    if (motion) { ctx.save(); ctx.translate(cx + dx, cy); ctx.rotate(rot); ctx.scale(sxk, syk); ctx.translate(-cx, -cy); }
    let sh = null;
    if (bakesShadow(e)) {
      // 그늘을 구워 넣은 그림으로 (그늘 위치는 쉬는 높이 기준 — 걸음 튀기기 1~2화소만큼은 몸과 같이 움직임)
      const lift0 = e.flying ? T * (mo.hover != null ? mo.hover : 0.42) : 0;
      sh = shSpec;
      sh[0] = size * 0.5 + T * 0.03;
      sh[1] = size * 0.9 + lift0 + T * 0.01;
      sh[2] = Math.max(4, e.size * 0.32 * T * 2.2);
      sh[3] = Math.max(2, e.size * 0.11 * T * 2.2);
      sh[4] = e.flying ? 0.36 : 0.58;
    }
    const ok = sprite(key, cx, cy, size, size, 0.5, 0.9, flip, alphaS, sh);
    if (!ok) {
      ctx.fillStyle = '#9a94a8';
      ctx.beginPath(); ctx.arc(cx, cy - size * 0.4, size * 0.35, 0, Math.PI * 2); ctx.fill();
    }
    if (hurt && ok && !manyEnemies) {
      ctx.save();
      ctx.globalAlpha = 0.45 * alphaS;
      ctx.globalCompositeOperation = 'lighter';
      sprite(key, cx, cy, size, size, 0.5, 0.9, flip, 1);
      ctx.restore();
    }
    if (motion) ctx.restore();
    if (e.phaseWarn && RG.fx.settings.reduce) { ctx.save(); ctx.setLineDash([4, 3]); ctx.strokeStyle = '#c8b8ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(cx, groundY, size * 0.4, size * 0.14, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
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
      // 기절 별 셋: 모아 두었다가 모든 적을 그린 뒤 한 경로로 (바위·회오리가 한꺼번에 여럿을 기절시킴)
      for (let i = 0; i < 3; i++) {
        const a = time * 6 + (i * Math.PI * 2) / 3;
        stunPts.push(cx + Math.cos(a) * size * 0.3, top - 2 + Math.sin(a) * size * 0.08);
      }
    }
    if (st.time < e.ccUntil && e.ccKind === 'fear') {
      // 공포: 머리 위 보랏빛 '!' 두 개가 떨림
      const jx = Math.sin(time * 30 + e.id) * T * 0.03;
      const fm = fearMark();
      ctx.drawImage(fm, Math.round((cx + jx - fm._w / 2) * dpr) / dpr, Math.round((top - 2 - fm._h * 0.72) * dpr) / dpr, fm._w, fm._h);
    }
    if (st.time < e.ccUntil && e.ccKind === 'stop') {
      // 시간 멈춤: 금빛 모래시계 표시 (구워 둔 그림)
      const cm = clockMark();
      ctx.drawImage(cm, Math.round((cx - cm._w / 2) * dpr) / dpr, Math.round((top - cm._h * 0.9) * dpr) / dpr, cm._w, cm._h);
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
    if (st.time < e.st.slowUntil && !frozen && !manyEnemies) { // 적이 많으면 그늘 단계에서 한 번에 그림
      ctx.save();
      ctx.strokeStyle = 'rgba(140,220,255,0.8)';
      ctx.lineWidth = Math.max(1, T * 0.03);
      ctx.beginPath(); ctx.ellipse(cx, Y(y) + 1, size * 0.36, size * 0.12, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    if (e.st.burns.length && Math.random() < (manyEnemies ? 0.08 : 0.3)) RG.fx.burst(x + (Math.random() - 0.5) * e.size * 0.6, y - e.size * 0.5, RG.fx.colorOf(e.st.burns[0].element), 1, 0.5, 0.45, 0.05, -1.6);
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
      // 토리 거인 변신: 다른 그림(이끼 거인)을 크게. 나래(공중): 새가 그림 안에서 떠 있으므로 그림자만 작게
      const giant = u.giantUntil > st.time;
      const art = giant ? `${u.heroId}_giant` : u.heroId;
      const hdat = RG.data.heroes[u.heroId] || {};
      const size = T * (giant ? 1.6 : 0.95);
      const bob = hdat.flying ? Math.sin(time * 3.2 + u.id) * T * 0.05 : moving ? Math.abs(Math.sin(time * 9)) * T * 0.04 : Math.sin(time * 2.2) * T * 0.012;
      if (overlay.heroSelected) {
        ctx.save();
        ctx.strokeStyle = '#ffe68a';
        ctx.lineWidth = Math.max(2, T * 0.05);
        ctx.beginPath(); ctx.ellipse(cx, cy, T * 0.42, T * 0.16, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }
      const px = giant ? 256 : 160;
      const hk = poseSprite(RG.art.sprites.heroKey(art, pose), RG.art.sprites.heroKey(art, 'idle0'), () => RG.art.hero(art, pose), px, px);
      if (hdat.flying) shadow(x, y, 0.26, 0.09, 0.28);
      else castShadow(hk, cx, cy, size, size, 0.5, 0.9, flip, 0.32, bob);
      sprite(hk, cx, cy - bob, size, size, 0.5, 0.9, flip, 1);
      const top = giant ? size * 0.78 : size;
      if (u.stunUntil > st.time) icon('stun', cx, cy - top * 1.0, T * 0.3);
      bar(cx, cy - top * 0.98, Math.max(22, T * 0.8), u.hp / u.maxHp, '#6fd3ff', 0, false);
      // 레벨
      ctx.save();
      ctx.font = `800 ${Math.round(Math.max(9, T * 0.22) * (RG.fx.settings.textScale || 1))}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#1c1426';
      ctx.fillStyle = '#ffe68a';
      const lx = cx - Math.max(22, T * 0.8) / 2 - T * 0.12;
      ctx.strokeText(String(u.level), lx, cy - top * 0.9);
      ctx.fillText(String(u.level), lx, cy - top * 0.9);
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
      if (!manyEnemies) castShadow(uk, cx, cy, size, size, 0.5, 0.9, flip, 0.3, bob);
      sprite(uk, cx, cy - bob, size, size, 0.5, 0.9, flip, 1);
      if (u.hp < u.maxHp) bar(cx, cy - size * 1.0, Math.max(14, T * 0.5), u.hp / u.maxHp, ALLY_BAR, 0, false);
      return;
    }
    if (u.kind === 'snowman') {
      // 하루의 눈사람 친구: 사라질 때가 가까우면 깜박임
      const size = T * 0.66;
      const walking = (Math.abs(u.x - u.px) + Math.abs(u.y - u.py)) > 0.001;
      const pose = u.attackAnim > 0.1 ? 'attack' : u.engaged && u.cd <= 0.3 ? 'aim' : walking ? (Math.floor(time * 6 + u.id) % 2 ? 'walk1' : 'walk0') : 'idle';
      const uk = poseSprite(RG.art.sprites.unitKey('snowman', pose), RG.art.sprites.unitKey('snowman', 'idle'), () => RG.art.unit('snowman', pose), 128, 128);
      const fade = u.until - st.time < 2 ? (RG.fx.settings.reduce ? 0.6 : 0.55 + 0.45 * Math.abs(Math.sin(time * 8))) : 1;
      if (!manyEnemies) castShadow(uk, cx, cy, size, size, 0.5, 0.9, flip, 0.3, 0);
      sprite(uk, cx, cy, size, size, 0.5, 0.9, flip, fade);
      if (u.hp < u.maxHp) bar(cx, cy - size * 0.95, Math.max(14, T * 0.5), u.hp / u.maxHp, '#bfefff', 0, false);
      return;
    }
    if (u.kind === 'wall') {
      const size = T * 1.0;
      sprite(RG.art.sprites.unitKey('rock_wall', 'idle'), cx, cy + T * 0.1, size, size, 0.5, 0.9, false, 1);
      bar(cx, cy - size * 0.8, Math.max(20, T * 0.7), u.hp / u.maxHp, ALLY_BAR, 0, false);
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
    const arrows = [];
    const arrowHeads = new Map();
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
        // 화살은 모아 두었다가 끝에 한 번에 그림(자루 한 경로, 촉은 색마다 한 경로)
        const len = T * 0.36;
        arrows.push(sx - (dx / L) * len, sy - (dy / L) * len, sx, sy);
        let hl = arrowHeads.get(col);
        if (!hl) { hl = []; arrowHeads.set(col, hl); }
        hl.push(sx, sy);
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
    if (arrows.length) {
      ctx.strokeStyle = '#5a3d22';
      ctx.lineWidth = Math.max(1.5, T * 0.04);
      ctx.beginPath();
      for (let i = 0; i < arrows.length; i += 4) { ctx.moveTo(arrows[i], arrows[i + 1]); ctx.lineTo(arrows[i + 2], arrows[i + 3]); }
      ctx.stroke();
      const hr = Math.max(2, T * 0.06);
      for (const [col, hl] of arrowHeads) {
        ctx.fillStyle = col;
        ctx.beginPath();
        for (let i = 0; i < hl.length; i += 2) { ctx.moveTo(hl[i] + hr, hl[i + 1]); ctx.arc(hl[i], hl[i + 1], hr, 0, Math.PI * 2); }
        ctx.fill();
      }
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
        ctx.globalAlpha = RG.fx.settings.reduce ? 0.9 : 0.5 + 0.5 * Math.abs(Math.sin(time * 8)); // 빨간 경고: 초당 2.5번 이하, 줄이기면 고정
        ctx.strokeStyle = '#ff5a5a';
        ctx.lineWidth = Math.max(2, T * 0.06);
        ctx.beginPath(); ctx.arc(X(t.x), Y(t.y), T * (0.45 + 0.2 * k), 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = '#ff5a5a';
        ctx.font = `900 ${Math.round(Math.max(12, T * 0.5) * (RG.fx.settings.textScale || 1))}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('!', X(t.x), Y(t.y) - T * 0.85);
        ctx.restore();
      }
    }
  }

  /* ---------------- 지역 분위기 입자 ---------------- */
  /*
   * 1 솔빛 들판: 반딧불·꽃가루  2 서리 고개: 눈송이  3 붉은 협곡: 위로 오르는 불티
   * 4 폭풍 해안: 비스듬한 빗줄기·물보라  5 깨진 대종: 위로 떠오르는 보랏빛 티끌
   * 그림 전용(규칙과 무관), 칸 단위 좌표. 적이 아주 많으면 절반만 그림.
   */
  let ambient = [];
  let ambientFor = '';
  const AMB = {
    1: { n: 0.16, col: '#fff1a8', glow: true },
    2: { n: 0.30, col: '#ffffff' },
    3: { n: 0.18, col: '#ffb060', glow: true },
    4: { n: 0.26, col: '#d8f1ff' },
    5: { n: 0.16, col: '#dcb2ff', glow: true },
  };
  let ambSeed = 1;
  const arand = () => { ambSeed = (ambSeed * 16807) % 2147483647; return ambSeed / 2147483647; };
  function spawnAmbient(p, region, m, anywhere) {
    p.x = arand() * m.cols;
    p.y = anywhere ? arand() * m.rows : (region === 3 || region === 5 ? m.rows + 0.3 : -0.3);
    p.ph = arand() * Math.PI * 2;
    p.s = 0.6 + arand() * 0.8;
    p.life = 0;
    p.max = 3 + arand() * 5;
    if (region === 1) { p.vx = 0; p.vy = 0; }
    else if (region === 2) { p.vx = 0.15 + arand() * 0.2; p.vy = 0.45 + arand() * 0.45; }
    else if (region === 3) { p.vx = (arand() - 0.5) * 0.2; p.vy = -(0.35 + arand() * 0.5); }
    else if (region === 4) { p.vx = -1.6 - arand() * 0.6; p.vy = 4.2 + arand() * 1.5; if (!anywhere) p.x = arand() * (m.cols + 3); }
    else { p.vx = (arand() - 0.5) * 0.1; p.vy = -(0.12 + arand() * 0.2); }
  }
  function updateAmbient(dt) {
    const m = game.map;
    const region = m.def.region || 1;
    const reduce = RG.fx.settings.reduce || !!(reducedMQ && reducedMQ.matches);
    const key = `${m.id}|${reduce}`;
    if (ambientFor !== key) {
      ambientFor = key;
      ambSeed = 7 + m.cols * 31 + m.rows;
      const n = Math.round(m.cols * m.rows * (AMB[region] || AMB[1]).n * (reduce ? 0.4 : 1));
      ambient = [];
      for (let i = 0; i < n; i++) { const p = {}; spawnAmbient(p, region, m, true); p.life = arand() * p.max; ambient.push(p); }
    }
    const k = Math.min(dt, 0.1);
    for (const p of ambient) {
      p.life += k;
      p.ph += k * (region === 1 ? 1.3 : 2.2);
      if (region === 1) { p.x += Math.cos(p.ph * 0.7) * 0.25 * k; p.y += Math.sin(p.ph) * 0.18 * k; }
      else if (region === 2) { p.x += (p.vx + Math.sin(p.ph) * 0.12) * k; p.y += p.vy * k; }
      else if (region === 3) { p.x += (p.vx + Math.sin(p.ph * 1.7) * 0.08) * k; p.y += p.vy * k; }
      else if (region === 4) { p.x += p.vx * k; p.y += p.vy * k; }
      else { p.x += (p.vx + Math.sin(p.ph) * 0.05) * k; p.y += p.vy * k; }
      const out = p.y > m.rows + 0.5 || p.y < -0.6 || p.x < -0.6 || p.x > m.cols + 0.6;
      if (out || (region !== 2 && region !== 4 && p.life > p.max)) spawnAmbient(p, region, m, region === 1 || region === 5);
    }
  }
  function drawAmbient() {
    const m = game.map;
    const region = m.def.region || 1;
    const A = AMB[region] || AMB[1];
    const step = manyEnemies ? 2 : 1;
    ctx.save();
    ctx.beginPath();
    ctx.rect(X(0), Y(0), m.cols * T, m.rows * T);
    ctx.clip();
    if (region === 4) {
      // 빗줄기: 짧은 사선 한 번에
      ctx.strokeStyle = 'rgba(216,241,255,0.32)';
      ctx.lineWidth = Math.max(1, T * 0.025);
      ctx.beginPath();
      for (let i = 0; i < ambient.length; i += step) {
        const p = ambient[i];
        const x = X(p.x);
        const y = Y(p.y);
        ctx.moveTo(x, y);
        ctx.lineTo(x + p.vx * T * 0.07, y + p.vy * T * 0.07);
      }
      ctx.stroke();
    } else if (region === 2) {
      // 눈 위에서도 보이게 푸른 테두리를 먼저, 그 위에 흰 눈송이
      ctx.fillStyle = 'rgba(96,124,168,0.35)';
      for (let i = 0; i < ambient.length; i += step) {
        const p = ambient[i];
        const r = Math.max(1, T * 0.035 * p.s) + 2;
        ctx.fillRect(X(p.x) - r / 2, Y(p.y) - r / 2, r, r);
      }
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      for (let i = 0; i < ambient.length; i += step) {
        const p = ambient[i];
        const r = Math.max(1, T * 0.035 * p.s);
        ctx.fillRect(X(p.x) - r / 2, Y(p.y) - r / 2, r, r);
      }
    } else {
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < ambient.length; i += step) {
        const p = ambient[i];
        const fade = Math.min(1, p.life / 0.8, Math.max(0, (p.max - p.life) / 0.8));
        const tw = region === 1 ? 0.35 + 0.65 * Math.max(0, Math.sin(p.ph * 2.3)) : 0.6 + 0.4 * Math.sin(p.ph * 3);
        const a = fade * tw;
        if (a <= 0.02) continue;
        const x = X(p.x);
        const y = Y(p.y);
        const r = Math.max(1, T * 0.03 * p.s);
        ctx.globalAlpha = a * 0.22;
        ctx.fillStyle = A.col;
        ctx.beginPath(); ctx.arc(x, y, r * 3.2, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = a * 0.9;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
  }

  /* ---------------- 한 프레임 ---------------- */
  let perfWin = 0;
  /*
   * 가벼운 효과 단계: 가장 낮은 화질(배율 1)에서도 2초 동안 프레임의 60% 넘게 늦으면 이 판에서 켬.
   * 적이 많을 때(manyEnemies)만 적용 — 꾸밈 효과(공명 선 위를 도는 빛, 적 발밑 그늘·감속 고리, 장판 무늬,
   * 출구 소용돌이, 터지는 조각 수)를 줄이고 게임 정보(체력 막대·빛줄기·상태 표시)는 그대로 둠.
   */
  let slowFx = false;
  const lowFx = () => slowFx && manyEnemies;
  let perfRaised = false; // 이 판에서 화질을 다시 높인 적이 있는가
  let perfNoRaise = false; // 높였다가 다시 느려짐 → 이 판에서는 더 높이지 않음
  let perfLock = false; // 시험용: 화질 자동 조절을 멈춤 (RG.render.lockQuality)
  function watchSpeed() {
    if (perfLock) return;
    const now = performance.now();
    const gap = perfLast ? (now - perfLast) / 1000 : 0;
    perfLast = now;
    if (!gap || gap > 0.5) return; // 탭 전환·멈춤·그림 만들기 뒤 첫 프레임은 빼고
    perfT += gap;
    if (perfT < 0.6) return; // 불러온 직후는 그림을 만드느라 느릴 수 있음
    perfN++;
    perfWin += gap;
    if (gap > 1 / 30) perfSlow++;
    // 2초마다 판단 — 프레임 수가 아니라 시간으로 재야 아주 느릴 때도 빨리 반응함.
    // 화질을 바꿀 때마다 그림 캐시를 모두 다시 만들어 잠깐 멈추므로: 아주 느리면(평균 24fps 미만) 한 번에 가장 낮게,
    // 다시 높이는 것은 오래(20초) 부드러울 때만, 높였다가 다시 느려진 판에서는 더 높이지 않음(오르내림 반복 방지).
    // 낮추기는 빨리 판단(처음 1초, 그 뒤 2초마다) — 느린 휴대폰에서 판 시작 몇 초가 끊기지 않게
    if (perfWin >= (dprCap >= 2 && !perfRaised ? 1 : 2) && perfN >= 10 && perfSlow / perfN > 0.6 && dprCap > 1 && (window.devicePixelRatio || 1) > 1) {
      const avg = perfWin / perfN;
      dprCap = avg > 1 / 24 ? 1 : Math.max(1, dprCap - 0.5);
      if (perfRaised) perfNoRaise = true;
      resize();
      perfN = 0; perfSlow = 0; perfWin = 0;
    } else if (dprCap < 2 && !perfNoRaise && perfWin >= 20) {
      if (perfSlow / perfN < 0.03) { dprCap = Math.min(2, dprCap + 0.5); perfRaised = true; resize(); }
      perfN = 0; perfSlow = 0; perfWin = 0;
    } else if (perfWin >= 2 && perfN >= 12 && perfSlow / perfN > 0.6 && (dprCap <= 1 || (window.devicePixelRatio || 1) <= 1) && manyEnemies && !slowFx) {
      slowFx = true; // 화질을 더 낮출 수 없는데도 늦음 → 꾸밈 효과를 줄임
      perfN = 0; perfSlow = 0; perfWin = 0;
    } else if ((dprCap >= 2 || perfNoRaise) && perfWin >= 2) {
      perfN = 0; perfSlow = 0; perfWin = 0;
    } else if (dprCap < 2 && perfWin >= 2 && perfSlow / perfN > 0.1) {
      perfN = 0; perfSlow = 0; perfWin = 0; // 아직 부드럽지 않음 — 높이기 판단은 처음부터 다시
    }
  }

  // 그릴 것 목록 (y 순서) — 항목 객체를 모아 두고 다시 씀
  const dlPool = [];
  const dlOrder = [];
  const flyQ = [];
  let dlN = 0;
  function dlAdd(y, k, o) {
    let it = dlPool[dlN];
    if (!it) { it = { y: 0, k: 0, o: null }; dlPool[dlN] = it; }
    it.y = y; it.k = k; it.o = o;
    dlN++;
  }
  const byY = (a, b) => a.y - b.y;
  const byEnemyY = (a, b) => a.y - b.y;
  function frame(alpha, dt) {
    if (!game || !ctx) return;
    watchSpeed();
    if (bitmapQ.length) pumpBitmaps(4);
    time += dt;
    RG.fx.update(dt);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // 맵 바깥 바탕: 화면 크기의 그라데이션을 한 번 그려 두고 매 프레임 그대로 찍음(불투명 캔버스)
    const base = REGION_BASE[game.map.def.region] || '#556';
    const bk = `${base}|${canvas.width}x${canvas.height}`;
    if (!backdrop || backdrop._k !== bk) {
      backdrop = document.createElement('canvas');
      backdrop.width = canvas.width; backdrop.height = canvas.height;
      backdrop._k = bk;
      const c2 = backdrop.getContext('2d', { alpha: false });
      const g0 = c2.createRadialGradient(backdrop.width / 2, backdrop.height / 2, Math.min(backdrop.width, backdrop.height) * 0.2, backdrop.width / 2, backdrop.height / 2, Math.max(backdrop.width, backdrop.height) * 0.75);
      g0.addColorStop(0, RG.art._h.mix(base, '#141019', 0.55));
      g0.addColorStop(1, '#0d0a12');
      c2.fillStyle = g0;
      c2.fillRect(0, 0, backdrop.width, backdrop.height);
    }
    const [sx0, sy0] = RG.fx.shakeOffset(T);
    // 흔들림도 정수 화소로 (반 화소에 걸치면 모든 그림이 느린 길로 그려짐)
    const sx = Math.round(sx0 * dpr) / dpr;
    const sy = Math.round(sy0 * dpr) / dpr;
    // 바깥 바탕 + 테두리 + 맵(탑 그림자 포함)을 한 장으로 구워 두고 매 프레임 한 번만 찍음 (화면 크기 그림 두 번 → 한 번)
    syncTowers();
    const shaded = updateShade();
    let based = false;
    if (shaded && !sx && !sy) {
      const B = baseFrame;
      // 그림자·공명 선(shadeVer)·바깥 바탕·자리·크기가 그대로면 다시 굽지 않음 (매 프레임 긴 열쇠 문자열을 만들지 않음)
      if (!B || B._v !== shadeVer || B._bd !== backdrop || B._ox !== ox || B._oy !== oy || B._T !== T || B._dpr !== dpr) {
        if (!B || B.width !== canvas.width || B.height !== canvas.height) {
          baseFrame = document.createElement('canvas');
          baseFrame.width = canvas.width; baseFrame.height = canvas.height;
        }
        const c2 = baseFrame.getContext('2d', { alpha: false });
        c2.setTransform(1, 0, 0, 1, 0, 0);
        c2.globalAlpha = 1;
        c2.drawImage(backdrop, 0, 0); // 화면 크기 불투명 그림이 전체를 덮으므로 지우지 않아도 됨
        c2.setTransform(dpr, 0, 0, dpr, 0, 0);
        drawFrameBorder(c2);
        composeMap(c2, X(0), Y(0));
        baseFrame._v = shadeVer; baseFrame._bd = backdrop; baseFrame._ox = ox; baseFrame._oy = oy; baseFrame._T = T; baseFrame._dpr = dpr;
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(baseFrame, 0, 0);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      based = true;
    } else {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(backdrop, 0, 0);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawFrameBorder(ctx);
    }
    ctx.save();
    ctx.translate(sx, sy);
    drawBackground(based);
    drawBridges();
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
    RG.fx.setLite(alive > 120 ? (lowFx() ? 2 : 1) : 0);
    if (manyEnemies && lowFx()) {
      // 가벼운 단계: 그늘을 그림에 구운 적 말고는 발밑 그늘·감속 고리를 생략
    } else if (manyEnemies) {
      // 적이 아주 많을 때: 발밑 그늘을 한 경로로 모아 한 번에 칠함 (땅·비행 두 번)
      // (그늘 그림 300장을 찍는 것보다 이쪽이 조금 빠름 — 그리기 호출 하나하나의 고정 비용이 큼)
      for (const fly of [false, true]) {
        ctx.beginPath();
        for (const e of st.enemies) {
          if (e.burrowed || !!e.flying !== fly || bakesShadow(e)) continue; // 그늘을 그림에 구워 넣은 적은 건너뜀
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
      // 감속 고리도 한 경로로 (발밑에 깔림)
      ctx.beginPath();
      let slowN = 0;
      for (const e of st.enemies) {
        if (e.dead || e.burrowed || !(st.time < e.st.slowUntil) || isFrozenNow(e)) continue;
        const p = enemyScreen(e, alpha);
        const size = e.size * T;
        const ex = X(p.x);
        const ey = Y(p.y) + 1;
        ctx.moveTo(ex + size * 0.36, ey);
        ctx.ellipse(ex, ey, size * 0.36, size * 0.12, 0, 0, Math.PI * 2);
        slowN++;
      }
      if (slowN) {
        ctx.strokeStyle = 'rgba(140,220,255,0.8)';
        ctx.lineWidth = Math.max(1, T * 0.03);
        ctx.stroke();
      }
    } else {
      for (const e of st.enemies) {
        if (e.burrowed) continue;
        const p = enemyScreen(e, alpha);
        shadow(p.x, p.y, e.size * 0.32, e.size * 0.11, e.flying ? 0.18 : 0.3);
      }
    }
    for (const u of st.units) if (!u.dead && u.kind !== 'drone') shadow(lerp(u.px, u.x, alpha), lerp(u.py, u.y, alpha), u.kind === 'wall' ? 0.45 : 0.22, 0.08, 0.3);

    barOn = true; barN = 0; // 체력 막대는 모아 두었다가 모든 적을 그린 뒤 위에 한 번에
    stunPts.length = 0;
    // y 순서로 (그릴 것 목록은 매 프레임 새로 만들지 않고 다시 씀)
    dlN = 0;
    for (const t of st.towers) dlAdd(t.r + 0.82, 0, t);
    dlAdd(game.map.lantern.r + 0.82, 1, null);
    for (let i = 0; i < st.enemies.length; i++) { const e = st.enemies[i]; if (!e.flying) dlAdd(lerp(e.py, e.y, alpha), 2, e); }
    for (const u of st.units) if (!u.dead) dlAdd(lerp(u.py, u.y, alpha), 3, u);
    let cn = 0;
    for (let i = 0; i < corpses.length; i++) { const c = corpses[i]; c.t += dt; if (c.t < c.dur) corpses[cn++] = c; }
    corpses.length = cn;
    // 느린 기기에서 적이 아주 많으면 쓰러지는 모습은 최근 20개만 (나머지는 조용히 사라짐)
    for (let i = lowFx() ? Math.max(0, corpses.length - 20) : 0; i < corpses.length; i++) dlAdd(corpses[i].y - 0.001, 4, corpses[i]);
    for (const R of st.rollers) if (st.time >= R.startAt && !R.done) dlAdd(lerp(R.py, R.y, alpha) + 0.05, 5, R);
    dlOrder.length = dlN;
    for (let i = 0; i < dlN; i++) dlOrder[i] = dlPool[i];
    dlOrder.sort(byY);
    for (let i = 0; i < dlN; i++) {
      const it = dlOrder[i];
      const kind = it.k;
      const obj = it.o;
      if (kind === 0) drawTower(obj);
      else if (kind === 1) drawLantern();
      else if (kind === 2) drawEnemy(obj, alpha);
      else if (kind === 4) drawCorpse(obj);
      else if (kind === 5) drawRoller(obj, alpha);
      else drawUnit(obj, alpha);
      it.o = null;
    }
    // 비행 적은 위에
    flyQ.length = 0;
    for (let i = 0; i < st.enemies.length; i++) if (st.enemies[i].flying) flyQ.push(st.enemies[i]);
    flyQ.sort(byEnemyY);
    for (let i = 0; i < flyQ.length; i++) drawEnemy(flyQ[i], alpha);
    flyQ.length = 0;
    drawSweeps(alpha);
    drawOrbits(alpha);
    if (stunPts.length) {
      const r = Math.max(1.5, T * 0.04);
      ctx.fillStyle = '#ffe066';
      ctx.beginPath();
      for (let i = 0; i < stunPts.length; i += 2) { ctx.moveTo(stunPts[i] + r, stunPts[i + 1]); ctx.arc(stunPts[i], stunPts[i + 1], r, 0, Math.PI * 2); }
      ctx.fill();
      stunPts.length = 0;
    }
    flushBars();
    // 건설 미리보기 탑 그림
    const gh = overlay.ghost;
    if (gh) {
      ctx.save();
      const key = RG.art.sprites.towerKey(gh.type, game.startLevel ? game.startLevel(gh.type) : 1, null, 'idle');
      const tinted = ghostImage(key, gh.ok);
      ctx.globalAlpha = gh.ok ? 0.82 : 0.7;
      if (tinted) ctx.drawImage(tinted, X(gh.c + 0.5) - T * 0.5, Y(gh.r + 0.82) - T * 1.3 * (112 / 130), T, T * 1.3);
      else sprite(key, X(gh.c + 0.5), Y(gh.r + 0.82), T, T * 1.3, 0.5, 112 / 130, false);
      ctx.restore();
    }
    drawProjectiles(alpha);
    RG.fx.draw(ctx, X, Y, T);
    if (overlay.keyCursor && overlay.hover) drawKeyCursor(overlay.hover.c, overlay.hover.r);
    updateAmbient(dt);
    if (!manyEnemies) drawAmbient(); // 적이 아주 많을 땐 분위기 입자는 쉼
    drawAlerts();
    RG.fx.drawTexts(ctx, X, Y, T);
    ctx.restore();
  }

  return { attach, detach, resize, frame, onEvents, muzzleOf, setShadows: (on) => { shadowsOn = !!on; }, setQuality: (cap) => { dprCap = Math.max(1, Math.min(2, cap)); resize(); },
    /** 시험용: 화질을 고정(q)하고 자동 조절을 멈춤, slow=true면 꾸밈 줄이기도 켬. null이면 자동으로 되돌림 */
    /** 느린 기기라 꾸밈을 줄이는 중인가 (판 화면이 CSS 애니메이션도 멈춤) */
    get slow() { return slowFx; },
    lockQuality: (q, slow) => { perfLock = q != null; if (q != null) { dprCap = Math.max(1, Math.min(2, q)); slowFx = !!slow; resize(); } }, get quality() { return dprCap; }, screenToWorld, worldToScreen, overlay, tileSize, get T() { return T; } };
})();
