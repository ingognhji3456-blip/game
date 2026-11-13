'use strict';

/* =========================================================
 * 첫 판(1-1) 단계별 안내 — 손가락이 실제 버튼·칸을 가리키고, 그 행동을 하면 다음 단계로
 *   탑 고르기 → 놓기 → 웨이브 호출 → (골드가 모이면) 강화 → 이웃에 하나 더(공명) → 끝
 * - 판을 멈추지 않음(첫 웨이브는 호출하기 전엔 오지 않음). 마우스·터치·키보드 어느 쪽으로 해도 행동만 보고 넘어감.
 * - 화면을 막지 않음: 말풍선·손가락은 누를 수 없고(pointer-events 없음), "건너뛰기"만 누를 수 있음.
 * - 순서를 건너뛰어도 됨: 이미 해 둔 단계는 바로 넘어감.
 * - 한 번 끝내거나 건너뛰면 다시 안 나옴(진행 기록 seen.tips 'tutorial'). 설정의 "튜토리얼 다시 보기"로 되살림.
 * 판 화면(js/ui/game.js)이 enter에서 shouldRun/start, 매 프레임 tick, leave에서 stop을 부름.
 * ========================================================= */
(() => {
  const { el } = RG.util;
  const UI = RG.ui;
  const G = () => RG.ui.game;

  let on = false;
  let root = null;       // #screen-game
  let layer = null;      // 안내 층 (말풍선·손가락·고리)
  let bubble = null;
  let hand = null;
  let ring = null;
  let stepIdx = 0;
  let spot = null;       // 첫 탑 추천 칸
  let spot2 = null;      // 공명용 이웃 칸
  let endT = 0;
  let onDone = null;
  let lastKey = '';

  const near = (map, c, r, R) => {
    const T = RG.grid.T;
    let n = 0;
    for (let rr = Math.floor(r - R); rr <= Math.ceil(r + R); rr++) for (let cc = Math.floor(c - R); cc <= Math.ceil(c + R); cc++) {
      if (cc < 0 || rr < 0 || cc >= map.cols || rr >= map.rows) continue;
      if (map.kinds[rr * map.cols + cc] === T.PATH && Math.hypot(cc - c, rr - r) <= R) n++;
    }
    return n;
  };
  /** 길이 사거리에 가장 많이 들어오는 빈 건설지 (filter로 후보 제한) */
  function bestTile(g, filter) {
    const m = g.map;
    const R = (RG.stats.specOf('ember_archer', 1).range || 2.5);
    let best = null;
    for (let r = 0; r < m.rows; r++) for (let c = 0; c < m.cols; c++) {
      if (m.kinds[r * m.cols + c] !== RG.grid.T.BUILD || g.tileTower(c, r)) continue;
      if (filter && !filter(c, r)) continue;
      const s = near(m, c, r, R) * 10 - Math.abs(c - m.cols / 2) * 0.1;
      if (!best || s > best.s) best = { c, r, s };
    }
    return best;
  }

  /** 지금 판 상태 요약 */
  function snap() {
    const g = G().game;
    const st = g.state;
    const tw = st.towers;
    const first = tw.find((t) => RG.data.towers[t.type].role === 'attack') || tw[0] || null;
    return {
      g, st, tw, first,
      picking: !!G().placing,
      waveStarted: st.wave.started,
      maxLevel: tw.reduce((a, t) => Math.max(a, t.level), 0),
      links: tw.reduce((a, t) => a + t.links.length, 0) / 2,
      selected: G().selected,
      upCost: first && first.level < 3 ? g.upgradeCost(first) : Infinity,
      cardCost: RG.stats.costOf('ember_archer', 1, null, g.meta),
    };
  }

  const card = () => (root && (root.querySelector('.tower-card[data-type="ember_archer"]:not(.banned)') || root.querySelector('.tower-card:not(.banned)'))) || null;
  /** 탑 목록이 전장의 어느 쪽에 있나 (데스크톱·휴대폰 세로는 아래, 휴대폰 가로는 오른쪽) */
  function dockSide() {
    const c = card();
    const st = root && root.querySelector('.stage');
    if (!c || !st) return '아래';
    const a = c.getBoundingClientRect();
    const b = st.getBoundingClientRect();
    return a.left >= b.right - 4 ? '오른쪽' : a.right <= b.left + 4 ? '왼쪽' : '아래';
  }

  /* 단계: text(s) — 말풍선 글, target(s) — 가리킬 곳(DOM 요소 또는 {c,r} 칸), done(s) — 끝났나 */
  const STEPS = [
    {
      id: 'pick', title: '탑 고르기',
      text: () => `${dockSide()} 탑 목록에서 <b>불씨 궁수탑</b>을 누르세요. <small>키보드: 숫자 1 · 끌어다 놓아도 돼요</small>`,
      target: () => card(),
      done: (s) => s.picking || s.tw.length > 0,
    },
    {
      id: 'place', title: '탑 놓기',
      text: (s) => (s.picking ? '반짝이는 <b>건설지</b>를 누르면 지어집니다. 길이 사거리에 많이 들어오는 자리일수록 좋아요. <small>키보드: 방향키 · Enter</small>'
        : '먼저 탑 목록에서 <b>탑을 고르세요</b>. 그다음 반짝이는 건설지를 누르면 지어져요.'),
      target: (s) => (s.picking ? spot : card()),
      ring: () => spot,
      done: (s) => s.tw.length > 0,
    },
    {
      id: 'wave', title: '전투 시작',
      text: () => '준비가 되면 <b>웨이브 호출</b>을 누르세요. 다음 웨이브를 일찍 부르면 보너스 골드를 받아요. <small>키보드: Space</small>',
      target: () => root && root.querySelector('.btn-call'),
      done: (s) => s.waveStarted,
    },
    {
      id: 'upgrade', title: '강화',
      text: (s) => (s.st.gold < s.upCost ? '적을 잡으면 <b>골드</b>가 쌓여요. 골드가 모이면 탑을 강화해 볼게요.'
        : s.selected && s.first && s.selected.kind === 'tower' && s.selected.id === s.first.id ? '<b>강화</b>를 누르세요. 강화할수록 공격이 세지고 모양도 바뀌어요. <small>키보드: U</small>'
          : '골드가 모였어요! 지은 <b>탑을 누르세요</b>.'),
      target: (s) => {
        if (!s.first || s.st.gold < s.upCost) return null;
        if (s.selected && s.selected.kind === 'tower' && s.selected.id === s.first.id) return root && root.querySelector('.info-panel .btn-up:not([disabled])');
        return { c: s.first.c, r: s.first.r };
      },
      done: (s) => s.maxLevel >= 2,
    },
    {
      id: 'resonance', title: '공명',
      text: (s) => (s.st.gold < s.cardCost ? '이웃한 탑끼리는 <b>공명</b>합니다. 골드가 모이면 바로 옆에 하나 더 지어 볼게요.'
        : '반짝이는 칸에 탑을 <b>하나 더</b> 지어 보세요. 이웃(대각선 포함)한 탑은 원소 짝에 따라 공명 효과가 생겨요.'),
      target: (s) => (s.st.gold < s.cardCost ? null : (s.picking ? spot2 : card())),
      ring: (s) => (s.st.gold < s.cardCost ? null : spot2),
      done: (s) => s.links >= 1,
    },
    {
      id: 'end', title: '준비 끝!',
      text: () => '잘했어요! 이제 등불을 끝까지 지켜 내세요. <b>공명 연결 2개를 동시에</b> 만들면 과제 별도 받아요.',
      target: () => null,
      done: () => endT <= 0,
    },
  ];

  function shouldRun(game, opts, data) {
    if (data.resume || opts.mode !== 'normal' || game.def.id !== '1-1') return false;
    // 예전 기록(이미 탑 짓기 안내를 본 사람)에게는 억지로 보여 주지 않음 — 설정에서 다시 보기를 누르면 둘 다 지워짐
    return !RG.progress.seen('tips', 'tutorial') && !RG.progress.seen('tips', 'build');
  }

  function start(sec, done) {
    stop();
    root = sec;
    onDone = done || null;
    on = true;
    stepIdx = 0;
    endT = 4.5;
    lastKey = '';
    const g = G().game;
    spot = bestTile(g);
    spot2 = null;
    // (이 안내가 탑 짓기·웨이브 호출 팁을 대신함 — '봤음' 표시는 끝내거나 건너뛸 때. 도중에 나가거나 다시 시작하면 다음에 처음부터)
    hand = el('div', { class: 'tut-hand', 'aria-hidden': 'true' }, [el('span', { text: '👆' })]);
    ring = el('div', { class: 'tut-ring', 'aria-hidden': 'true' });
    const skip = el('button', { class: 'btn small tut-skip', type: 'button', onclick: () => finish(true) }, ['건너뛰기']);
    bubble = el('div', { class: 'tut-bubble', role: 'status', 'aria-live': 'polite' }, [
      el('div', { class: 'tut-head' }, [el('b', { class: 'tut-title' }), el('span', { class: 'tut-dots' }), skip]),
      el('p', { class: 'tut-text' }),
    ]);
    layer = el('div', { class: 'tut-layer' }, [ring, hand, bubble]);
    root.appendChild(layer);
  }

  function markDone() { for (const id of ['tutorial', 'build', 'callWave']) RG.progress.markSeen('tips', id); }
  function finish(skipped) {
    if (!on) return;
    markDone();
    const cb = onDone;
    stop();
    if (skipped) UI.toast('안내를 건너뛰었어요. 설정에서 다시 볼 수 있어요.', 'info', 2600);
    if (cb) cb();
  }

  function stop() {
    on = false;
    if (layer && layer.parentNode) layer.parentNode.removeChild(layer);
    layer = bubble = hand = ring = null;
  }

  /** 칸 → 안내 층 좌표 (가운데, 칸 크기) */
  function tileBox(t) {
    const cv = root.querySelector('.game-canvas');
    if (!cv) return null;
    const rc = cv.getBoundingClientRect();
    const rr = root.getBoundingClientRect();
    const p = RG.render.worldToScreen(t.c + 0.5, t.r + 0.5);
    const T = RG.render.tileSize();
    return { x: rc.left - rr.left + p.x, y: rc.top - rr.top + p.y, w: T, h: T };
  }
  function elBox(e) {
    const r = e.getBoundingClientRect();
    if (!r.width && !r.height) return null;
    const rr = root.getBoundingClientRect();
    return { x: r.left - rr.left + r.width / 2, y: r.top - rr.top + r.height / 2, w: r.width, h: r.height };
  }

  function tick(dt) {
    if (!on || !layer) return;
    const g = G().game;
    if (!g || g.state.result) {
      // 판이 끝남: 결과 화면 위로 다음 팁을 띄우지 않음. 강화 단계까지 왔으면 배운 것으로, 아니면 다음에 다시
      if (stepIdx >= STEPS.findIndex((x) => x.id === 'upgrade')) markDone();
      stop();
      return;
    }
    const s = snap();
    // 이미 해 둔 단계는 바로 넘김
    while (stepIdx < STEPS.length - 1 && STEPS[stepIdx].done(s)) stepIdx += 1;
    const step = STEPS[stepIdx];
    if (step.id === 'resonance' && (!spot2 || g.tileTower(spot2.c, spot2.r))) {
      const anchors = s.tw.filter((t) => RG.data.towers[t.type].role === 'attack');
      spot2 = bestTile(g, (c, r) => anchors.some((t) => Math.max(Math.abs(t.c - c), Math.abs(t.r - r)) === 1));
    }
    if (step.id === 'end') {
      endT -= dt;
      if (endT <= 0) { finish(false); return; }
    }
    // 글 (바뀔 때만 다시 씀)
    const text = step.text(s);
    const key = `${step.id}|${text}`;
    if (key !== lastKey) {
      lastKey = key;
      bubble.querySelector('.tut-title').textContent = step.title;
      bubble.querySelector('.tut-text').innerHTML = text;
      bubble.querySelector('.tut-dots').textContent = `${Math.min(stepIdx + 1, STEPS.length - 1)}/${STEPS.length - 1}`;
      bubble.classList.remove('pop'); void bubble.offsetWidth; bubble.classList.add('pop');
    }
    // 가리킬 곳
    const tg = step.target(s);
    const box = !tg ? null : tg.nodeType ? elBox(tg) : tileBox(tg);
    if (box) {
      hand.style.display = '';
      hand.style.transform = `translate(${Math.round(box.x)}px, ${Math.round(box.y + Math.min(box.h, 60) * 0.25)}px)`;
    } else hand.style.display = 'none';
    const rg = step.ring && step.ring(s);
    const rbox = rg ? tileBox(rg) : null;
    if (rbox) {
      ring.style.display = '';
      ring.style.width = ring.style.height = `${Math.round(rbox.w)}px`;
      ring.style.transform = `translate(${Math.round(rbox.x - rbox.w / 2)}px, ${Math.round(rbox.y - rbox.h / 2)}px)`;
    } else ring.style.display = 'none';
    // 말풍선: 보통은 전장 아래쪽(위쪽엔 맵 이름·새 적 알림·보스 막대가 뜸), 가리키는 칸이 전장 아래쪽이면 위로
    const stage = root.querySelector('.stage');
    if (stage) {
      const sr = elBox(stage);
      if (sr) {
        const inX = box && Math.abs(box.x - sr.x) < sr.w / 2;
        const inStage = inX && Math.abs(box.y - sr.y) < sr.h / 2;
        const low = !(inStage && !(tg && tg.nodeType) && box.y > sr.y + sr.h * 0.1); // 버튼(정보 창 등)을 가리킬 땐 늘 아래, 옆으로만 비킴
        // 가로: 가리키는 것이 전장 위(가로 범위 안)에 있으면 반대쪽 끝에 붙임 — 휴대폰에서 오른쪽 탑 정보 창의 강화 버튼을 덮지 않게
        const align = inX && box.x > sr.x + sr.w * 0.08 ? 'l' : inX && box.x < sr.x - sr.w * 0.08 ? 'r' : 'c';
        bubble.classList.toggle('al-l', align === 'l');
        bubble.classList.toggle('al-r', align === 'r');
        bubble.style.left = `${Math.round(align === 'l' ? sr.x - sr.w / 2 + 8 : align === 'r' ? sr.x + sr.w / 2 - 8 : sr.x)}px`;
        bubble.style.top = low ? '' : `${Math.round(sr.y - sr.h / 2 + 8)}px`;
        bubble.style.bottom = low ? `${Math.round(root.getBoundingClientRect().height - (sr.y + sr.h / 2) + 8)}px` : '';
      }
    }
  }

  /** 설정 "튜토리얼 다시 보기": 다음에 1-1을 시작하면 다시 나옴 */
  function reset() {
    const seen = RG.progress.get().seen.tips;
    for (const id of ['tutorial', 'build', 'callWave']) { const i = seen.indexOf(id); if (i >= 0) seen.splice(i, 1); }
    RG.progress.save();
  }

  RG.ui.tutorial = {
    shouldRun, start, stop, tick, reset,
    get active() { return on; },
    get step() { return on ? STEPS[stepIdx].id : null; },
    /** 시험용: 지금 추천 칸 */
    get spots() { return { spot, spot2 }; },
  };
})();
