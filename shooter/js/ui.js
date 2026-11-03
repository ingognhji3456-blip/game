'use strict';

/* =========================================================
 * 하늘 사냥꾼 — 저장 + 게임 화면 안의 메뉴 (모두 픽셀로 캔버스에 그림)
 *
 * 화면(screen): title help settings ranking | pause | over results | ending
 *               null 이면 게임 플레이 중
 * 버튼은 매 프레임 그리면서 등록하고(즉시 모드), 터치/클릭/키보드로 고릅니다.
 * ========================================================= */

SH.save = (() => {
  const KEY = 'skyHunter.v2';
  const DEFAULT = { best: 0, bestStage: 0, cleared: 0, ranks: [], settings: { sfx: 0.8, music: 0.6, shake: true, vibrate: true, sens: 1.3 } };
  function load() {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { d = null; }
    const out = JSON.parse(JSON.stringify(DEFAULT));
    if (d && typeof d === 'object') {
      for (const k of ['best', 'bestStage', 'cleared']) if (typeof d[k] === 'number') out[k] = d[k];
      if (Array.isArray(d.ranks)) out.ranks = d.ranks.filter((r) => r && typeof r.score === 'number').slice(0, 5);
      if (d.settings) Object.assign(out.settings, d.settings);
    }
    return out;
  }
  function store(d) {
    try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { /* 저장 불가 */ }
  }
  /** 순위표에 넣고 몇 등인지 (순위 밖이면 -1) */
  function addRank(d, entry) {
    d.ranks.push(entry);
    d.ranks.sort((a, b) => b.score - a.score);
    d.ranks = d.ranks.slice(0, 5);
    return d.ranks.indexOf(entry);
  }
  return { load, store, addRank };
})();

SH.ui = (() => {
  const R = () => SH.render;
  const SW = 480, SHT = 225; // 가로 화면 (메뉴는 가운데 480×225 영역 기준, 위아래 여백은 render.MENU_Y)
  let screen = 'title';
  let settingsBack = 'title';
  let t = 0;
  const btns = [];
  let focus = 0;
  let pressed = -1;
  let act = {};
  let data = null;
  let touch = false;
  let keyNav = false;
  let over = { count: 10, last: 10 };
  let result = null; // { score, rank, isNew, cleared, pct, missiles }
  let ending = { t: 0 };
  const sens = [[1, '보통'], [1.3, '빠르게'], [1.6, '아주 빠르게']];

  function go(s) {
    screen = s;
    t = 0;
    focus = 0;
    pressed = -1;
  }

  /* ---------------- 버튼 ---------------- */
  function button(label, x, y, w, h, onAct, o) {
    const i = btns.length;
    btns.push({ x, y, w, h, act: onAct, side: o && o.side });
    const isFocus = i === focus;
    const down = i === pressed;
    R().win(x, y + (down ? 1 : 0), w, h, { hot: isFocus });
    const blinkOff = o && o.blink && Math.floor(t * 2.5) % 2;
    R().T(label, x + w / 2, y + h / 2 + (down ? 1 : 0), {
      color: blinkOff ? '#ff8a2a' : isFocus ? '#ffd84a' : '#ffffff', align: 'center', size: (o && o.size) || 11, scale: (o && o.scale) || 1,
    });
    if (isFocus && (keyNav || (o && o.cursor))) R().spr('cursor', x - 6, y + h / 2, { frame: Math.floor(t * 4) }, '#ffd84a');
  }

  /** 버튼 목록을 세로로 */
  function column(items, x, y, w, h, gap) {
    items.forEach(([label, fn, o], i) => button(label, x, y + i * (h + gap), w, h, fn, o));
  }
  /** 버튼 목록을 가로로 */
  function row(items, x, y, w, h, gap) {
    items.forEach(([label, fn, o], i) => button(label, x + i * (w + gap), y, w, h, fn, o));
  }

  /* ---------------- 화면들 (가로 화면) ---------------- */
  function drawTitle(dt) {
    R().drawTitle(dt);
    const T = R().T;
    if (!SH.pix.draw(R().ctx, 'logo', SW / 2, 40)) T('하늘 사냥꾼', SW / 2, 40, { color: '#ffd84a', size: 24, align: 'center', shadow: '#8a3a10' });
    T('강철 요새 타이탄과의 결전', SW / 2, 74, { color: '#ffffff', align: 'center', size: 11 });
    for (let i = 0; i < 5; i++) {
      const sx = [110, 370, 84, 396, 240][i], sy = [24, 30, 70, 76, 8][i];
      SH.pix.draw(R().ctx, 'star', sx, sy, { frame: Math.floor(t * 3 + i) });
    }
    button('게임 시작', SW / 2 - 60, 96, 120, 24, () => act.start(), { cursor: true, blink: true, size: 12 });
    row([
      ['조작법', () => go('help')],
      ['설정', () => { settingsBack = 'title'; go('settings'); }],
      ['랭킹', () => go('ranking')],
    ], SW / 2 - 105, 130, 66, 18, 6);
    if (data.best) T(`최고 점수 ${SH.fmt(data.best)}`, SW / 2, 160, { color: '#ffe3ee', align: 'center', size: 10 });
    T('방향키 이동 · X 폭탄 · Esc 일시정지 · Enter 시작', SW / 2, 213, { color: '#ffffff', align: 'center', size: 10 });
  }

  function drawHelp(dt) {
    R().drawTitle(dt);
    R().dim(true);
    const T = R().T, ctx = R().ctx;
    const x = 8, y = 6, w = SW - 16, h = SHT - 12;
    R().win(x, y, w, h);
    T('조작법', SW / 2, y + 12, { color: '#ffd84a', scale: 2, align: 'center', shadow: '#8a3a10' });
    // 왼쪽: 조작 · 요령
    let yy = y + 32;
    const L = x + 12;
    const line = (s, c, xx) => { T(s, xx || L, yy, { color: c || '#e8e0ff', size: 10 }); yy += 13; };
    T('조작', L, yy, { color: '#ffd84a', size: 11 }); yy += 13;
    line('이동: 방향키 / WASD', '#ffffff');
    line('천천히: Shift · 공격: 자동 발사', '#ffffff');
    line('폭탄: X / Space · 일시정지: Esc', '#ffffff');
    line('(휴대폰은 화면을 끌어서 이동)', '#b5aed6');
    line('가운데 빨간 점에 맞으면 한 대!', '#ff9ac2');
    yy += 4;
    T('요령', L, yy, { color: '#ffd84a', size: 11 }); yy += 13;
    line('먼저 양쪽 포탑을 부숴야 코어가 열려요');
    line('빨간 점선 = 무기가 겨눈 곳, 빛이 모이면 발사');
    line('벽에서 나오는 레이저포도 부술 수 있어요');
    line('단계마다 보스가 새 무기를 꺼내요');
    // 오른쪽: 아이템
    yy = y + 32;
    const Rx = x + 268;
    T('아이템', Rx, yy, { color: '#ffd84a', size: 11 }); yy += 15;
    const f = Math.floor(t * 6);
    SH.pix.draw(ctx, 'item_spread', Rx + 6, yy, { frame: f });
    SH.pix.draw(ctx, 'item_laser', Rx + 20, yy, { frame: f });
    SH.pix.draw(ctx, 'item_homing', Rx + 34, yy, { frame: f });
    T('파워업 (색 = 무기)', Rx + 46, yy, { color: '#e8e0ff', size: 10 }); yy += 16;
    for (const [n, s] of [['item_bomb', '폭탄 +1'], ['item_life', '비행기 +1'], ['item_shield', '한 번 막아 줌'], ['gem', '보석: 점수!']]) {
      SH.pix.draw(ctx, n, Rx + 6, yy, { frame: f });
      T(s, Rx + 20, yy, { color: '#e8e0ff', size: 10 });
      yy += 16;
    }
    button('뒤로', SW / 2 - 40, y + h - 24, 80, 18, () => go('title'), { cursor: true });
  }

  function settingRow(label, value, y, dec, inc) {
    const x = SW / 2 - 116, w = 232, h = 20;
    const i = btns.length;
    button('', x, y, w, h, inc, { side: { dec, inc } });
    const T = R().T;
    T(label, x + 10, y + 10, { color: i === focus ? '#ffd84a' : '#ffffff', size: 11 });
    T('◀', x + w - 82, y + 10, { color: '#c9a8ff' });
    T(value, x + w - 46, y + 10, { color: '#ffffff', align: 'center', size: 10 });
    T('▶', x + w - 14, y + 10, { color: '#c9a8ff' });
  }

  function drawSettings(dt, inGame) {
    if (inGame) { act.drawGameFrozen(); R().dim(); } else { R().drawTitle(dt); R().dim(true); }
    const st = data.settings;
    const T = R().T;
    R().win(SW / 2 - 130, 8, 260, SHT - 16);
    T('설정', SW / 2, 22, { color: '#ffd84a', scale: 2, align: 'center', shadow: '#8a3a10' });
    const pct = (v) => `${Math.round(v * 100)}%`;
    const vol = (k) => [() => { st[k] = Math.max(0, Math.round((st[k] - 0.1) * 10) / 10); act.settings(); SH.audio.sfx('gem'); }, () => { st[k] = Math.min(1, Math.round((st[k] + 0.1) * 10) / 10); act.settings(); SH.audio.sfx('gem'); }];
    const [sd, si] = vol('sfx');
    settingRow('효과음', pct(st.sfx), 38, sd, si);
    const [md, mi] = vol('music');
    settingRow('음악', pct(st.music), 62, md, mi);
    const tog = (k) => () => { st[k] = !st[k]; act.settings(); };
    settingRow('화면 흔들림', st.shake ? '켬' : '끔', 86, tog('shake'), tog('shake'));
    settingRow('진동', st.vibrate ? '켬' : '끔', 110, tog('vibrate'), tog('vibrate'));
    const si2 = Math.max(0, sens.findIndex((s) => s[0] === st.sens));
    const setSens = (d) => () => { st.sens = sens[(si2 + d + sens.length) % sens.length][0]; act.settings(); };
    settingRow('터치 감도', sens[si2][1], 134, setSens(-1), setSens(1));
    T('◀ ▶ (또는 ←→ 키) 로 바꿔요', SW / 2, 166, { color: '#b5aed6', align: 'center', size: 10 });
    button('뒤로', SW / 2 - 40, 182, 80, 20, () => go(settingsBack), { cursor: true });
  }

  function drawRanking(dt) {
    R().drawTitle(dt);
    R().dim(true);
    const T = R().T;
    R().win(SW / 2 - 110, 8, 220, SHT - 16);
    T('순위', SW / 2, 24, { color: '#ffd84a', scale: 2, align: 'center', shadow: '#8a3a10' });
    const names = ['1위', '2위', '3위', '4위', '5위'];
    const cols = ['#ffd84a', '#d8d4ec', '#e2aa6c', '#ffffff', '#ffffff'];
    for (let i = 0; i < 5; i++) {
      const r = data.ranks[i];
      const y = 50 + i * 22;
      T(names[i], SW / 2 - 92, y, { color: cols[i], size: 10 });
      if (r) {
        T(SH.fmt(r.score), SW / 2 + 40, y, { color: '#ffffff', align: 'right' });
        T(r.cleared ? '격파!' : `${r.pct || 0}%`, SW / 2 + 92, y, { color: r.cleared ? '#ffd84a' : '#b5aed6', align: 'right', size: 10 });
      } else T('- - - - -', SW / 2 + 40, y, { color: '#5a5680', align: 'right' });
    }
    button('뒤로', SW / 2 - 40, 180, 80, 20, () => go('title'), { cursor: true });
  }

  function drawPause() {
    act.drawGameFrozen();
    R().dim();
    const T = R().T;
    R().win(SW / 2 - 70, 30, 140, 166);
    T('일시정지', SW / 2, 46, { color: '#ffd84a', scale: 2, align: 'center', shadow: '#8a3a10' });
    column([
      ['계속하기', () => act.resume(), { cursor: true }],
      ['설정', () => { settingsBack = 'pause'; go('settings'); }],
      ['처음부터', () => act.start()],
      ['타이틀로', () => act.toTitle()],
    ], SW / 2 - 50, 64, 100, 22, 6);
  }

  function drawOver(dt) {
    act.drawGameFrozen();
    R().dim(true);
    const T = R().T;
    T('게임 오버', SW / 2, 34, { color: '#ff3b4e', scale: 3, align: 'center', shadow: '#5a0a1a' });
    over.count -= dt;
    const n = Math.max(0, Math.ceil(over.count));
    if (n !== over.last) { over.last = n; SH.audio.sfx('click'); }
    if (over.count <= 0) { finish(); return; }
    T('이어서 할까요?', SW / 2, 72, { color: '#ffffff', scale: 2, align: 'center' });
    T(String(n), SW / 2, 110, { color: '#ffd84a', scale: 5, align: 'center', shadow: '#8a3a10' });
    row([
      ['이어하기', () => act.continueGame(), { cursor: true }],
      ['그만하기', () => finish()],
    ], SW / 2 - 92, 146, 86, 22, 12);
    T('이어하면 지금 자리에서 다시! (점수 유지)', SW / 2, 186, { color: '#d8d4ec', align: 'center', size: 10 });
  }

  function finish() {
    result = act.record(false);
    go('results');
  }

  function drawResults() {
    act.drawGameFrozen();
    R().dim();
    const T = R().T;
    const r = result || { score: 0 };
    R().win(SW / 2 - 100, 8, 200, SHT - 16);
    T('결과', SW / 2, 24, { color: '#ffd84a', scale: 2, align: 'center', shadow: '#8a3a10' });
    const rows = [
      ['점수', SH.fmt(r.score), '#ffffff'],
      ['최고 점수', SH.fmt(data.best), '#ffe3ee'],
      ['보스 파괴율', r.cleared ? '격파!' : `${r.pct || 0}%`, '#ffffff'],
      ['미사일 격추', SH.fmt(r.missiles || 0), '#ffffff'],
    ];
    rows.forEach(([k, v, c], i) => {
      T(k, SW / 2 - 84, 46 + i * 15, { color: '#c9a8ff', size: 10 });
      T(v, SW / 2 + 84, 46 + i * 15, { color: c, align: 'right' });
    });
    if (r.rank >= 0 && Math.floor(t * 3) % 2 === 0) T(r.isNew ? '신기록!' : `${r.rank + 1}위 기록!`, SW / 2, 114, { color: '#ff7aa8', align: 'center', scale: r.isNew ? 2 : 1 });
    column([
      ['다시 하기', () => act.start(), { cursor: true }],
      ['타이틀로', () => act.toTitle()],
    ], SW / 2 - 60, 134, 120, 22, 8);
  }

  function drawEnding(dt) {
    ending.t += dt;
    R().drawTitle(dt, true);
    const T = R().T;
    if (Math.random() < dt * 3) {
      // 불꽃놀이 (세계 좌표: 화면 오른쪽 위쪽 = 세계 위쪽)
      const x = 20 + Math.random() * 440, y = 20 + Math.random() * 120;
      SH.fx.anim('boomBig', x, y, 14);
      SH.fx.ring(x, y, 2, 30 + Math.random() * 20, 0.6, ['#ffd84a', '#ff7aa8', '#8fd4ff', '#a6f070'][Math.floor(Math.random() * 4)], 1);
      SH.audio.sfx('bossBoom');
    }
    const e = ending.t;
    T('축하합니다!', SW / 2, 18, { color: '#ffd84a', scale: 2, align: 'center', shadow: '#8a3a10' });
    if (e > 0.8) T('강철 요새 타이탄을 무너뜨렸다!', SW / 2, 40, { color: '#ffffff', align: 'center', size: 12 });
    if (e > 1.6) T('요새는 멈추고, 하늘에 다시 평화가 찾아왔어요.', SW / 2, 56, { color: '#e8e0ff', align: 'center', size: 10 });
    if (e > 2.4) T('…하지만 더 단단해진 요새가 다시 오는데?', SW / 2, 69, { color: '#ff9ac2', align: 'center', size: 10 });
    if (e > 3) {
      const r = result || { score: 0 };
      R().win(SW / 2 - 90, 82, 180, 74);
      const g = act.game();
      const rows = [['점수', SH.fmt(r.score)], ['걸린 시간', fmtTime(g ? g.stats.time : 0)], ['격추당함', String(g ? g.stats.deaths : 0)], ['이어하기', String(g ? g.continues : 0)]];
      rows.forEach(([k, v], i) => {
        T(k, SW / 2 - 78, 95 + i * 15, { color: '#c9a8ff', size: 10 });
        T(v, SW / 2 + 78, 95 + i * 15, { color: '#ffffff', align: 'right' });
      });
      if (r.isNew && Math.floor(t * 3) % 2 === 0) T('신기록!', SW / 2, 168, { color: '#ff7aa8', align: 'center', scale: 2 });
      row([
        [`${g ? g.loop + 2 : 2}회차 도전!`, () => act.nextLoop(), { cursor: true }],
        ['타이틀로', () => act.toTitle()],
      ], SW / 2 - 96, 184, 90, 22, 12);
    }
  }

  function fmtTime(s) {
    const m = Math.floor(s / 60), r = Math.floor(s % 60);
    return `${m}:${String(r).padStart(2, '0')}`;
  }

  /* ---------------- 게임 중 버튼 (일시정지 · 폭탄) ---------------- */
  const playBtn = { pause: { x: 460, y: 0, w: 20, h: 20 }, bomb: { x: 440, y: 228, w: 34, h: 34 } };
  let bombDown = 0, pauseDown = 0;
  function drawPlayButtons(g, dt) {
    if (bombDown > 0) bombDown -= dt;
    if (pauseDown > 0) pauseDown -= dt;
    R().spr('btn_pause', 470, 10, { frame: pauseDown > 0 ? 1 : 0, fbs: 14 }, '#3a3058');
    if (touch) {
      const b = playBtn.bomb;
      R().spr('btn_bomb', b.x + b.w / 2, b.y + b.h / 2, { frame: bombDown > 0 ? 1 : 0, fbs: 26, alpha: g.bombs > 0 ? 1 : 0.45 }, '#ff8a2a');
      R().T(String(g.bombs), b.x + b.w - 2, b.y + b.h - 4, { color: g.bombs ? '#ffd84a' : '#9a96b8', align: 'center' });
    }
  }
  const inside = (r, x, y, pad) => x >= r.x - pad && x <= r.x + r.w + pad && y >= r.y - pad && y <= r.y + r.h + pad;
  /** 게임 중 터치·클릭이 버튼 위면 처리하고 true */
  function playHit(x, y) {
    if (inside(playBtn.pause, x, y, 4)) { pauseDown = 0.15; act.pause(); return true; }
    if (touch && inside(playBtn.bomb, x, y, 6)) { bombDown = 0.15; act.bomb(); return true; }
    return false;
  }

  /* ---------------- 그리기 진입점 ---------------- */
  function draw(dt) {
    t += dt;
    btns.length = 0;
    const c = R().ctx;
    c.save();
    c.translate(0, R().MENU_Y);
    switch (screen) {
      case 'title': drawTitle(dt); break;
      case 'help': drawHelp(dt); break;
      case 'settings': drawSettings(dt, settingsBack === 'pause'); break;
      case 'ranking': drawRanking(dt); break;
      case 'pause': drawPause(); break;
      case 'over': drawOver(dt); break;
      case 'results': drawResults(); break;
      case 'ending': drawEnding(dt); break;
      default:
    }
    c.restore();
    if (focus >= btns.length) focus = Math.max(0, btns.length - 1);
  }

  /* ---------------- 입력 ---------------- */
  function hitIndex(x, y) {
    for (let i = btns.length - 1; i >= 0; i--) if (inside(btns[i], x, y, 2)) return i;
    return -1;
  }
  function pointerDown(x, y, isTouch) {
    y -= R().MENU_Y;
    if (isTouch) touch = true;
    keyNav = false;
    const i = hitIndex(x, y);
    pressed = i;
    if (i >= 0) focus = i;
  }
  function pointerUp(x, y) {
    y -= R().MENU_Y;
    const i = hitIndex(x, y);
    const p = pressed;
    pressed = -1;
    if (i < 0 || i !== p) return;
    const b = btns[i];
    SH.audio.sfx('click');
    if (b.side) {
      // 왼쪽(이름) 누르면 다음 값, ◀ 쪽이면 줄이기, ▶ 쪽이면 늘리기
      const rel = (x - b.x) / b.w;
      if (rel >= 0.45 && rel < 0.75) b.side.dec();
      else b.side.inc();
      return;
    }
    b.act();
  }
  function key(code) {
    keyNav = true;
    const n = btns.length;
    if (!n) return;
    if (code === 'ArrowUp' || code === 'KeyW') { focus = (focus - 1 + n) % n; SH.audio.sfx('click'); }
    else if (code === 'ArrowDown' || code === 'KeyS') { focus = (focus + 1) % n; SH.audio.sfx('click'); }
    else if (code === 'ArrowLeft' || code === 'KeyA') {
      const b = btns[focus];
      if (b && b.side) { b.side.dec(); SH.audio.sfx('click'); } else { focus = (focus - 1 + n) % n; SH.audio.sfx('click'); }
    } else if (code === 'ArrowRight' || code === 'KeyD') {
      const b = btns[focus];
      if (b && b.side) { b.side.inc(); SH.audio.sfx('click'); } else { focus = (focus + 1) % n; SH.audio.sfx('click'); }
    } else if (code === 'Enter' || code === 'Space' || code === 'KeyZ') {
      const b = btns[focus];
      if (b) { SH.audio.sfx('click'); b.act(); }
    } else if (code === 'Escape') {
      if (screen === 'help' || screen === 'ranking') go('title');
      else if (screen === 'settings') go(settingsBack);
      else if (screen === 'pause') act.resume();
    }
  }

  function init(actions, save) {
    act = actions;
    data = save;
    touch = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  }

  return {
    init, draw, go, key, pointerDown, pointerUp, playHit, drawPlayButtons,
    get screen() { return screen; },
    set touch(v) { touch = v; },
    showOver() { over = { count: 10, last: 10 }; go('over'); },
    showEnding(r) { result = r; ending = { t: 0 }; go('ending'); },
    setResult(r) { result = r; },
  };
})();
