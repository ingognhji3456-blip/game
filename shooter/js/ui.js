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
  const PW = 225, PH = 400;
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
  let result = null; // { score, rank, isNew, stage, kills, cleared }
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

  /* ---------------- 화면들 ---------------- */
  function drawTitle(dt) {
    R().drawTitle(dt);
    const T = R().T;
    if (!SH.pix.draw(R().ctx, 'logo', PW / 2, 74)) T('하늘 사냥꾼', PW / 2, 74, { color: '#ffd84a', size: 24, align: 'center', shadow: '#8a3a10' });
    T('SKY HUNTER', PW / 2, 106, { color: '#ffffff', align: 'center', shadow: '#1c3f9a' });
    T('VS IRON TITAN', PW / 2, 118, { color: '#ffd84a', align: 'center', shadow: '#8a3a10' });
    for (let i = 0; i < 5; i++) {
      const sx = [24, 196, 40, 182, 112][i], sy = [40, 52, 118, 124, 22][i];
      SH.pix.draw(R().ctx, 'star', sx, sy, { frame: Math.floor(t * 3 + i) });
    }
    button(touch ? 'TOUCH START' : 'PRESS START', 50, 146, 125, 28, () => act.start(), { cursor: true, blink: true });
    button('조작법', 14, 184, 62, 20, () => go('help'));
    button('설정', 81, 184, 62, 20, () => { settingsBack = 'title'; go('settings'); });
    button('랭킹', 148, 184, 62, 20, () => go('ranking'));
    if (data.best) T(`HI ${SH.fmt(data.best)}`, PW / 2, 222, { color: '#ffe3ee', align: 'center' });
    T(touch ? '화면을 끌어서 이동 · 자동 발사' : '방향키 이동 · X 폭탄 · 자동 발사', PW / 2, 390, { color: '#ffffff', align: 'center', size: 10 });
  }

  function drawHelp(dt) {
    R().drawTitle(dt);
    R().dim(true);
    const T = R().T, x = 8, y = 18, w = PW - 16, h = 362;
    R().win(x, y, w, h);
    T('HOW TO PLAY', PW / 2, y + 12, { color: '#ffd84a', scale: 2, align: 'center', shadow: '#8a3a10' });
    let yy = y + 32;
    const line = (s, c, ind) => { T(s, x + 10 + (ind || 0), yy, { color: c || '#e8e0ff', size: 10 }); yy += 13; };
    line(touch ? '이동: 화면 아무 데나 대고 끌기' : '이동: 방향키 / WASD (Shift 천천히)', '#ffffff');
    line(touch ? '(PC: 방향키 / WASD)' : '(마우스로 끌어도 돼요)', '#b5aed6', 8);
    line('공격: 총은 자동으로 쏴요', '#ffffff');
    line(touch ? '폭탄: 오른쪽 아래 버튼, 두 손가락 톡' : '폭탄: X 또는 스페이스', '#ffffff');
    line('비행기 가운데 빨간 점에 맞으면 한 대!', '#ff9ac2');
    yy += 6;
    T('ITEMS', x + 10, yy, { color: '#ffd84a' });
    yy += 14;
    const item = (spriteName, s, frameName) => {
      SH.pix.draw(R().ctx, spriteName, x + 18, yy, { frame: Math.floor(t * 6) });
      if (frameName) SH.pix.draw(R().ctx, frameName, x + 32, yy, { frame: Math.floor(t * 6) });
      T(s, x + (frameName ? 44 : 32), yy, { color: '#e8e0ff', size: 10 });
      yy += 17;
    };
    SH.pix.draw(R().ctx, 'item_spread', x + 18, yy, { frame: Math.floor(t * 6) });
    SH.pix.draw(R().ctx, 'item_laser', x + 32, yy, { frame: Math.floor(t * 6) });
    SH.pix.draw(R().ctx, 'item_homing', x + 46, yy, { frame: Math.floor(t * 6) });
    T('파워업! 색 = 무기', x + 58, yy, { color: '#e8e0ff', size: 10 });
    yy += 15;
    T('주황 확산탄 · 파랑 레이저 · 초록 유도탄', x + 12, yy, { color: '#b5aed6', size: 10 });
    yy += 17;
    item('item_bomb', '폭탄 +1 (탄을 모두 지움)');
    item('item_life', '비행기 +1');
    item('item_shield', '한 번 막아 주는 방패');
    item('gem', '보석: 점수! 점수가 쌓이면 1UP');
    yy += 2;
    T('TIPS', x + 10, yy, { color: '#ffd84a' });
    yy += 14;
    line('먼저 양쪽 포탑을 부숴야 코어가 열려요');
    line('빨간 점선 = 레이저가 지나갈 곳!');
    line('빨간 미사일은 쏴서 터뜨릴 수 있어요');
    line('포탑 파괴·단계 변화 때 파워 아이템!');
    button('뒤로', PW / 2 - 40, y + h - 28, 80, 20, () => go('title'), { cursor: true });
  }

  function settingRow(label, value, y, dec, inc) {
    const x = 20, w = PW - 40, h = 22;
    const i = btns.length;
    button('', x, y, w, h, inc, { side: { dec, inc } });
    const T = R().T;
    T(label, x + 10, y + 11, { color: i === focus ? '#ffd84a' : '#ffffff', size: 11 });
    T('◀', x + w - 82, y + 11, { color: '#c9a8ff' });
    T(value, x + w - 46, y + 11, { color: '#ffffff', align: 'center', size: 10 });
    T('▶', x + w - 14, y + 11, { color: '#c9a8ff' });
  }

  function drawSettings(dt, inGame) {
    if (inGame) { act.drawGameFrozen(); R().dim(); } else { R().drawTitle(dt); R().dim(true); }
    const st = data.settings;
    const T = R().T;
    R().win(10, 70, PW - 20, 250);
    T('SETTINGS', PW / 2, 86, { color: '#ffd84a', scale: 2, align: 'center', shadow: '#8a3a10' });
    const pct = (v) => `${Math.round(v * 100)}%`;
    const vol = (k) => [() => { st[k] = Math.max(0, Math.round((st[k] - 0.1) * 10) / 10); act.settings(); SH.audio.sfx('gem'); }, () => { st[k] = Math.min(1, Math.round((st[k] + 0.1) * 10) / 10); act.settings(); SH.audio.sfx('gem'); }];
    const [sd, si] = vol('sfx');
    settingRow('효과음', pct(st.sfx), 104, sd, si);
    const [md, mi] = vol('music');
    settingRow('음악', pct(st.music), 130, md, mi);
    const si2 = Math.max(0, sens.findIndex((s) => s[0] === st.sens));
    const setSens = (d) => () => { st.sens = sens[(si2 + d + sens.length) % sens.length][0]; act.settings(); };
    settingRow('드래그 감도', sens[si2][1], 156, setSens(-1), setSens(1));
    const tog = (k) => () => { st[k] = !st[k]; act.settings(); };
    settingRow('화면 흔들림', st.shake ? 'ON' : 'OFF', 182, tog('shake'), tog('shake'));
    settingRow('진동', st.vibrate ? 'ON' : 'OFF', 208, tog('vibrate'), tog('vibrate'));
    T('◀ ▶ 를 눌러 바꿔요', PW / 2, 244, { color: '#b5aed6', align: 'center', size: 10 });
    button('뒤로', PW / 2 - 40, 284, 80, 22, () => go(settingsBack), { cursor: true });
  }

  function drawRanking(dt) {
    R().drawTitle(dt);
    R().dim(true);
    const T = R().T;
    R().win(14, 70, PW - 28, 230);
    T('HIGH SCORES', PW / 2, 88, { color: '#ffd84a', scale: 2, align: 'center', shadow: '#8a3a10' });
    const names = ['1ST', '2ND', '3RD', '4TH', '5TH'];
    const cols = ['#ffd84a', '#d8d4ec', '#e2aa6c', '#ffffff', '#ffffff'];
    for (let i = 0; i < 5; i++) {
      const r = data.ranks[i];
      const y = 116 + i * 24;
      T(names[i], 30, y, { color: cols[i] });
      if (r) {
        T(SH.fmt(r.score), 140, y, { color: '#ffffff', align: 'right' });
        T(r.cleared ? 'CLEAR' : `${r.pct || 0}%`, PW - 30, y, { color: r.cleared ? '#ffd84a' : '#b5aed6', align: 'right' });
      } else T('- - - - -', 140, y, { color: '#5a5680', align: 'right' });
    }
    button('뒤로', PW / 2 - 40, 268, 80, 22, () => go('title'), { cursor: true });
  }

  function drawPause() {
    act.drawGameFrozen();
    R().dim();
    const T = R().T;
    R().win(42, 110, PW - 84, 170);
    T('PAUSE', PW / 2, 128, { color: '#ffd84a', scale: 2, align: 'center', shadow: '#8a3a10' });
    column([
      ['계속하기', () => act.resume(), { cursor: true }],
      ['설정', () => { settingsBack = 'pause'; go('settings'); }],
      ['처음부터', () => act.start()],
      ['타이틀로', () => act.toTitle()],
    ], 62, 146, PW - 124, 22, 6);
  }

  function drawOver(dt) {
    act.drawGameFrozen();
    R().dim(true);
    const T = R().T;
    T('GAME OVER', PW / 2, 110, { color: '#ff3b4e', scale: 3, align: 'center', shadow: '#5a0a1a' });
    over.count -= dt;
    const n = Math.max(0, Math.ceil(over.count));
    if (n !== over.last) { over.last = n; SH.audio.sfx('click'); }
    if (over.count <= 0) { finish(); return; }
    T('CONTINUE?', PW / 2, 160, { color: '#ffffff', scale: 2, align: 'center' });
    T(String(n), PW / 2, 206, { color: '#ffd84a', scale: 5, align: 'center', shadow: '#8a3a10' });
    button('이어하기', 30, 250, 78, 24, () => act.continueGame(), { cursor: true });
    button('그만하기', PW - 108, 250, 78, 24, () => finish());
    T('이어하면 지금 자리에서 다시! (점수 유지)', PW / 2, 290, { color: '#d8d4ec', align: 'center', size: 10 });
  }

  function finish() {
    result = act.record(false);
    go('results');
  }

  function drawResults(dt, title) {
    if (title) { R().drawTitle(dt); R().dim(true); } else { act.drawGameFrozen(); R().dim(); }
    const T = R().T;
    const r = result || { score: 0 };
    R().win(16, 80, PW - 32, 220);
    T(title ? 'CONGRATULATIONS!' : 'RESULT', PW / 2, 98, { color: '#ffd84a', scale: title ? 1 : 2, align: 'center', shadow: '#8a3a10' });
    const rows = [
      ['SCORE', SH.fmt(r.score), '#ffffff'],
      ['HI SCORE', SH.fmt(data.best), '#ffe3ee'],
      ['DAMAGE', r.cleared ? 'CLEAR!' : `${r.pct || 0}%`, '#ffffff'],
      ['MISSILES', SH.fmt(r.missiles || 0), '#ffffff'],
    ];
    rows.forEach(([k, v, c], i) => {
      T(k, 32, 122 + i * 16, { color: '#c9a8ff' });
      T(v, PW - 32, 122 + i * 16, { color: c, align: 'right' });
    });
    if (r.rank >= 0 && Math.floor(t * 3) % 2 === 0) T(r.isNew ? 'NEW RECORD!' : `RANK IN ${['1ST', '2ND', '3RD', '4TH', '5TH'][r.rank]}!`, PW / 2, 196, { color: '#ff7aa8', align: 'center', scale: r.isNew ? 2 : 1 });
    column([
      ['다시 하기', () => act.start(), { cursor: true }],
      ['타이틀로', () => act.toTitle()],
    ], 54, 218, PW - 108, 22, 8);
  }

  function drawEnding(dt) {
    ending.t += dt;
    R().drawTitle(dt, true);
    const T = R().T;
    if (Math.random() < dt * 3) {
      const x = 20 + Math.random() * (PW - 40), y = 30 + Math.random() * 150;
      SH.fx.anim('boomBig', x, y, 14);
      SH.fx.ring(x, y, 2, 30 + Math.random() * 20, 0.6, ['#ffd84a', '#ff7aa8', '#8fd4ff', '#a6f070'][Math.floor(Math.random() * 4)], 1);
      SH.audio.sfx('bossBoom');
    }
    const e = ending.t;
    T('CONGRATULATIONS!', PW / 2, 44, { color: '#ffd84a', scale: 2, align: 'center', shadow: '#8a3a10' });
    if (e > 0.8) T('강철 요새 타이탄을 무너뜨렸다!', PW / 2, 72, { color: '#ffffff', align: 'center', size: 12 });
    if (e > 1.6) T('하늘에 다시 평화가 찾아왔어요.', PW / 2, 90, { color: '#e8e0ff', align: 'center', size: 10 });
    if (e > 2.4) T('…하지만 더 단단해진 요새가 다시 오는데?', PW / 2, 104, { color: '#ff9ac2', align: 'center', size: 10 });
    if (e > 3) {
      const r = result || { score: 0 };
      R().win(24, 122, PW - 48, 86);
      const g = act.game();
      const rows = [['SCORE', SH.fmt(r.score)], ['TIME', fmtTime(g ? g.stats.time : 0)], ['DEATHS', String(g ? g.stats.deaths : 0)], ['CONTINUE', String(g ? g.continues : 0)]];
      rows.forEach(([k, v], i) => {
        T(k, 38, 136 + i * 16, { color: '#c9a8ff' });
        T(v, PW - 38, 136 + i * 16, { color: '#ffffff', align: 'right' });
      });
      if (r.isNew && Math.floor(t * 3) % 2 === 0) T('NEW RECORD!', PW / 2, 220, { color: '#ff7aa8', align: 'center', scale: 2 });
      column([
        [`LOOP ${g ? g.loop + 2 : 2} 도전!`, () => act.nextLoop(), { cursor: true }],
        ['타이틀로', () => act.toTitle()],
      ], 54, 238, PW - 108, 22, 8);
    }
  }

  function fmtTime(s) {
    const m = Math.floor(s / 60), r = Math.floor(s % 60);
    return `${m}:${String(r).padStart(2, '0')}`;
  }

  /* ---------------- 게임 중 버튼 (일시정지 · 폭탄) ---------------- */
  const playBtn = { pause: { x: 204, y: 1, w: 20, h: 20 }, bomb: { x: 186, y: 362, w: 36, h: 36 } };
  let bombDown = 0, pauseDown = 0;
  function drawPlayButtons(g, dt) {
    if (bombDown > 0) bombDown -= dt;
    if (pauseDown > 0) pauseDown -= dt;
    R().spr('btn_pause', 214, 11, { frame: pauseDown > 0 ? 1 : 0, fbs: 14 }, '#3a3058');
    if (touch) {
      const b = playBtn.bomb;
      R().spr('btn_bomb', b.x + b.w / 2, b.y + b.h / 2, { frame: bombDown > 0 ? 1 : 0, fbs: 26, alpha: g.bombs > 0 ? 1 : 0.45 }, '#ff8a2a');
      R().T(String(g.bombs), b.x + b.w - 2, b.y + b.h - 4, { color: g.bombs ? '#ffd84a' : '#9a96b8', align: 'center' });
    }
  }
  const inside = (r, x, y, pad) => x >= r.x - pad && x <= r.x + r.w + pad && y >= r.y - pad && y <= r.y + r.h + pad;
  /** 게임 중 터치가 버튼 위면 처리하고 true */
  function playHit(x, y) {
    if (inside(playBtn.pause, x, y, 4)) { pauseDown = 0.15; act.pause(); return true; }
    if (touch && inside(playBtn.bomb, x, y, 6)) { bombDown = 0.15; act.bomb(); return true; }
    return false;
  }

  /* ---------------- 그리기 진입점 ---------------- */
  function draw(dt) {
    t += dt;
    btns.length = 0;
    switch (screen) {
      case 'title': drawTitle(dt); break;
      case 'help': drawHelp(dt); break;
      case 'settings': drawSettings(dt, settingsBack === 'pause'); break;
      case 'ranking': drawRanking(dt); break;
      case 'pause': drawPause(); break;
      case 'over': drawOver(dt); break;
      case 'results': drawResults(dt, false); break;
      case 'ending': drawEnding(dt); break;
      default:
    }
    if (focus >= btns.length) focus = Math.max(0, btns.length - 1);
  }

  /* ---------------- 입력 ---------------- */
  function hitIndex(x, y) {
    for (let i = btns.length - 1; i >= 0; i--) if (inside(btns[i], x, y, 2)) return i;
    return -1;
  }
  function pointerDown(x, y, isTouch) {
    if (isTouch) touch = true;
    keyNav = false;
    const i = hitIndex(x, y);
    pressed = i;
    if (i >= 0) focus = i;
  }
  function pointerUp(x, y) {
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
