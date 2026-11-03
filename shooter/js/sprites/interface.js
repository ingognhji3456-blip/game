'use strict';

/* =========================================================
 * 픽셀 그림 — 화면 꾸밈 (제목 글자, HUD 아이콘, 버튼, 창 틀, 커서)
 * ========================================================= */

(() => {
  const k = '#1b1230';
  const M = '#010203';

  /* ---------------- 제목: 하늘 사냥꾼 (획을 사각형·굵은 선으로 조립) ---------------- */
  SH.pix.paint('logo', 160, 44, 1, (P) => {
    const R = (ox, x, y, w, h) => P.rect(ox + x, 4 + y, w, h, M);
    const L = (ox, x0, y0, x1, y1, t) => {
      for (let i = 0; i < t; i++) for (let j = 0; j < t; j++) P.line(ox + x0 + i, 4 + y0 + j, ox + x1 + i, 4 + y1 + j, M);
    };
    const RING = (ox, cx, cy, rx, ry, t) => {
      for (let y = Math.floor(cy - ry); y <= cy + ry; y++) {
        for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
          const o = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2;
          const i = ((x + 0.5 - cx) / (rx - t)) ** 2 + ((y + 0.5 - cy) / (ry - t)) ** 2;
          if (o <= 1 && i > 1) P.set(ox + x, 4 + y, M);
        }
      }
    };
    let ox = 3;
    // 하 = ㅎ + ㅏ
    R(ox, 6, 0, 6, 3); R(ox, 1, 5, 16, 4); RING(ox, 9, 21, 8.5, 8.5, 4);
    R(ox, 21, 0, 4, 32); R(ox, 25, 13, 3, 4);
    ox += 31;
    // 늘 = ㄴ + ㅡ + ㄹ
    R(ox, 2, 0, 4, 9); R(ox, 2, 6, 22, 3);
    R(ox, 0, 12, 26, 4);
    R(ox, 2, 19, 22, 3); R(ox, 21, 19, 3, 8); R(ox, 2, 24, 22, 3); R(ox, 2, 24, 3, 8); R(ox, 2, 29, 23, 3);
    ox += 37;
    // 사 = ㅅ + ㅏ
    L(ox, 8, 1, 0, 28, 4); L(ox, 9, 1, 16, 28, 4); R(ox, 8, 0, 3, 6);
    R(ox, 21, 0, 4, 32); R(ox, 25, 13, 3, 4);
    ox += 31;
    // 냥 = ㄴ + ㅑ + ㅇ
    R(ox, 2, 0, 4, 15); R(ox, 2, 12, 13, 4);
    R(ox, 19, 0, 4, 18); R(ox, 23, 3, 3, 3); R(ox, 23, 10, 3, 3);
    RING(ox, 13, 25.5, 9.5, 6.5, 3);
    ox += 30;
    // 꾼 = ㄲ + ㅜ + ㄴ
    R(ox, 0, 0, 10, 3); R(ox, 7, 0, 3, 9); R(ox, 13, 0, 11, 3); R(ox, 21, 0, 3, 9);
    R(ox, 0, 12, 26, 4); R(ox, 11, 16, 4, 6);
    R(ox, 2, 23, 4, 9); R(ox, 2, 29, 23, 3);

    // 그림자 → 색 → 테두리
    const W = P.w, H = P.h;
    const sh = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (P.get(x, y) === M) sh.push([x + 2, y + 2]);
    for (const [x, y] of sh) if (P.get(x, y) === null) P.set(x, y, '#8a3a10');
    const mask = new Set();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (P.get(x, y) === M) mask.add(y * W + x);
    const on = (x, y) => mask.has(y * W + x);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (!on(x, y)) continue;
        const yy = y - 4;
        let c = yy < 9 ? '#fff4a8' : yy < 16 ? '#ffd84a' : yy < 24 ? '#ffb02e' : '#ff8a2a';
        if (!on(x, y - 1)) c = '#ffffff';
        else if (!on(x, y + 1) && yy > 4) c = '#d0500e';
        P.set(x, y, c);
      }
    }
    P.outline(k, true);
  });

  /* ---------------- HUD 아이콘 ---------------- */
  SH.pix.sprite('icon_life', {
    palette: { k, w: '#ffffff', b: '#3a86f0', r: '#e8384f', c: '#8fd4ff' },
    frames: [[
      '....k....',
      '...kwk...',
      '...kck...',
      '.kkbwbkk.',
      'kbbbwbbbk',
      'krkkwkkrk',
      '...kwk...',
      '..kbkbk..',
      '..kk.kk..',
    ]],
  });
  SH.pix.sprite('icon_bomb', {
    palette: { k, d: '#2e2848', g: '#5a5680', w: '#9a96b8', y: '#ffd84a', o: '#ff8a2a', Y: '#ffffff' },
    frames: [[
      '......oY.',
      '.....k.y.',
      '...kkk...',
      '..kgddk..',
      '.kgwdddk.',
      '.kgdddddk',
      '.kddddddk',
      '..kddddk.',
      '...kkkk..',
    ]],
  });

  /* ---------------- 버튼 ---------------- */
  SH.pix.paint('btn_pause', 18, 18, 2, (P, f) => {
    const d = f ? 1 : 0;
    P.rect(1, 1 + d, 16, 16 - d, f ? '#141030' : '#2a2458');
    P.rect(2, 2 + d, 14, 1, f ? '#2a2458' : '#4a4290');
    for (let y = 3 + d; y < 16; y++) for (let x = 2; x < 16; x++) if ((x + y) % 2 === 0 && !f) P.set(x, y, '#241e4c');
    P.rect(6, 5 + d, 2, 8, '#ffffff');
    P.rect(10, 5 + d, 2, 8, '#ffffff');
    P.rect(6, 12 + d, 2, 1, '#c9a8ff');
    P.rect(10, 12 + d, 2, 1, '#c9a8ff');
    P.clear(1, 1 + d); P.clear(16, 1 + d); P.clear(1, 16); P.clear(16, 16);
    P.outline(k);
  });
  SH.pix.paint('btn_bomb', 32, 32, 2, (P, f) => {
    const d = f ? 1 : 0;
    P.circle(16, 16 + d, 14.5, f ? '#8e2a10' : '#c4471a');
    P.circle(15, 15 + d, 12.5, f ? '#c4471a' : '#ff8a2a');
    P.circle(13.5, 13 + d, 8, f ? '#ff8a2a' : '#ffb04a');
    // 폭탄
    P.circle(15, 18 + d, 6.5, '#2e2848');
    P.circle(13.5, 16.5 + d, 2.4, '#5a5680');
    P.set(12, 15 + d, '#9a96b8');
    P.rect(19, 10 + d, 3, 3, '#5a5680');
    P.line(21, 9 + d, 24, 6 + d, '#5a5680');
    P.set(25, 5 + d, '#ffffff'); P.set(26, 5 + d, '#ffd84a'); P.set(25, 4 + d, '#ffd84a'); P.set(24, 5 + d, '#ffd84a'); P.set(25, 6 + d, '#ffd84a');
    P.outline(k);
  });

  /* ---------------- 창 틀 (4칸 모서리 9분할) ---------------- */
  SH.pix.sprite('frame', {
    palette: { k, Y: '#fff4a8', y: '#ffd84a', O: '#b8501c', n: '#1e1840' },
    frames: [[
      '..kkkkkkkk..',
      '.kYYYYYYYYk.',
      'kYyyyyyyyyOk',
      'kYynnnnnnyOk',
      'kYynnnnnnyOk',
      'kYynnnnnnyOk',
      'kYynnnnnnyOk',
      'kYynnnnnnyOk',
      'kYynnnnnnyOk',
      'kYyyyyyyyyOk',
      '.kOOOOOOOOk.',
      '..kkkkkkkk..',
    ]],
  });

  SH.pix.sprite('cursor', {
    palette: { k, y: '#ffd84a', Y: '#fff4a8', o: '#e0a020' },
    frames: [[
      'kk......',
      'kYk.....',
      'kyYk....',
      'kyyYk...',
      'kyyok...',
      'kyok....',
      'kok.....',
      'kk......',
    ], [
      '.kk.....',
      '.kYk....',
      '.kyYk...',
      '.kyyYk..',
      '.kyyok..',
      '.kyok...',
      '.kok....',
      '.kk.....',
    ]],
  });

  SH.pix.sprite('star', {
    palette: { w: '#ffffff', y: '#fff4a8' },
    frames: [[
      '..y..',
      '..w..',
      'ywwwy',
      '..w..',
      '..y..',
    ], [
      '.....',
      '..y..',
      '.ywy.',
      '..y..',
      '.....',
    ]],
  });
})();
