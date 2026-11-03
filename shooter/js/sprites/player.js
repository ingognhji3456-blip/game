'use strict';

/* =========================================================
 * 픽셀 그림 — 내 비행기 · 내 탄 · 아이템 · 적 탄
 * ========================================================= */

(() => {
  const k = '#1b1230';

  /* ---------------- 도우미 ---------------- */
  /** 글자 그림 회전 (시계 방향 90°) */
  const rot90 = (rows) => {
    const n = rows.length, m = rows[0].length;
    const out = [];
    for (let x = 0; x < m; x++) {
      let s = '';
      for (let y = n - 1; y >= 0; y--) s += rows[y][x];
      out.push(s);
    }
    return out;
  };
  /** 기울이기: 위쪽 줄일수록 dir 쪽으로 밀기 */
  const shear = (rows, dir, amount) => {
    const h = rows.length, w = rows[0].length;
    return rows.map((r, y) => {
      const s = Math.round((h / 2 - y) * amount) * dir;
      let out = '';
      for (let x = 0; x < w; x++) { const sx = x - s; out += sx >= 0 && sx < w ? r[sx] : '.'; }
      return out;
    });
  };
  /** 빛이 왼쪽 위에서 오는 공 */
  function ball(P, cx, cy, r, cols) {
    const [dark, base, light] = cols;
    for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++) {
      for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
        const nx = (x + 0.5 - cx) / r, ny = (y + 0.5 - cy) / r;
        const d = nx * nx + ny * ny;
        if (d > 1.02) continue;
        const v = -(nx * 0.62 + ny * 0.78) * 0.8 + (1 - d) * 0.35;
        P.set(x, y, v > 0.32 ? light : v > -0.28 ? base : dark);
      }
    }
  }

  /* =========================================================
   * 비행기 (0 = 왼쪽으로 기울기, 1 = 수평, 2 = 오른쪽)
   * ========================================================= */
  const PL = {
    w: '#ffffff', l: '#d8d4ec', g: '#9a96b8', d: '#5a5680',
    b: '#3a86f0', B: '#1c3f9a', c: '#8fd4ff', C: '#e0f7ff', r: '#e8384f', R: '#8e1c3a', y: '#ffd84a',
  };
  SH.pix.paint('player', 25, 27, 3, (P, f) => {
    const bank = f - 1;
    const cx = 12;
    const shL = bank < 0 ? 3 : 0; // 기울어진 쪽 날개는 짧고 어둡게
    const shR = bank > 0 ? 3 : 0;
    const wing = (side, sh) => {
      const s = side;
      const tip = 12 - sh;
      // 주날개
      P.poly([cx + s * 2, 9.5, cx + s * tip, 15.5, cx + s * tip, 19, cx + s * 3, 18], sh ? PL.B : PL.b);
      // 앞날개 가장자리 빛
      for (let i = 2; i <= tip; i++) P.set(cx + s * i, Math.round(9.5 + (i - 2) * (6 / (tip - 2))) + 0, sh ? PL.b : PL.c);
      // 뒷날개 그림자
      for (let i = 3; i <= tip; i++) P.set(cx + s * i, 18, PL.B);
      // 날개 끝 빨강
      for (let y = 15; y <= 18; y++) { P.set(cx + s * tip, y, y === 15 ? PL.r : PL.R); P.set(cx + s * (tip - 1), y, y < 18 ? PL.r : PL.R); }
      // 노란 표시
      P.set(cx + s * (tip - 4), 15, PL.y);
      P.set(cx + s * (tip - 5), 15, PL.y);
      // 앞날개(카나드)
      P.poly([cx + s * 2, 7, cx + s * 6, 10.5, cx + s * 2, 10.5], sh ? PL.B : PL.b);
      P.set(cx + s * 3, 8, sh ? PL.b : PL.c);
      // 꼬리날개
      P.poly([cx + s * 2, 20.5, cx + s * (7 - (sh ? 1 : 0)), 24, cx + s * (7 - (sh ? 1 : 0)), 25.5, cx + s * 2, 25.5], sh ? PL.B : PL.b);
      P.set(cx + s * 3, 21, sh ? PL.b : PL.c);
    };
    wing(-1, shL);
    wing(1, shR);
    // 동체
    const hw = [0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 2, 2, 2, 2, 2, 2];
    for (let y = 0; y < hw.length; y++) {
      for (let x = -hw[y]; x <= hw[y]; x++) {
        const side = x + bank * 0.6;
        P.set(cx + x, y, side <= -1 ? PL.w : side < 0.5 ? PL.w : side < 1.5 ? PL.l : PL.g);
      }
    }
    // 빨간 코 띠
    for (let x = -1; x <= 1; x++) P.set(cx + x, 4, x < 1 ? PL.r : PL.R);
    // 조종석
    P.set(cx - 1, 8, PL.C); P.set(cx, 8, PL.c); P.set(cx + 1, 8, PL.c);
    P.set(cx - 1, 9, PL.c); P.set(cx, 9, PL.C); P.set(cx + 1, 9, PL.b);
    P.set(cx - 1, 10, PL.c); P.set(cx, 10, PL.b); P.set(cx + 1, 10, PL.B);
    P.set(cx, 11, PL.B);
    // 엔진
    for (const s of [-1, 1]) { P.set(cx + s * 2, 25, PL.d); P.set(cx + s * 2, 26, PL.d); P.set(cx + s, 25, PL.g); }
    P.set(cx, 25, PL.g);
    P.outline(k);
  });

  /* 엔진 불꽃 (노즐 두 개) */
  const flameRows = (len) => {
    const rows = [];
    for (let y = 0; y < 9; y++) {
      let r = '';
      for (let x = 0; x < 9; x++) {
        const nz = x === 2 || x === 6;
        const side = x === 1 || x === 3 || x === 5 || x === 7;
        let ch = '.';
        if (nz && y < len) ch = y < 2 ? 'w' : y < len - 2 ? 'c' : 'b';
        else if (side && y < Math.max(1, len - 4)) ch = y < 2 ? 'c' : 'b';
        r += ch;
      }
      rows.push(r);
    }
    return rows;
  };
  SH.pix.sprite('flame', {
    palette: { w: '#ffffff', c: '#8fd4ff', b: '#3a86f0' },
    frames: [flameRows(7), flameRows(9), flameRows(6)],
  });

  /* 방패: 점선처럼 디더링한 고리 */
  SH.pix.paint('shield', 33, 33, 2, (P, f) => {
    for (let y = 0; y < 33; y++) {
      for (let x = 0; x < 33; x++) {
        const d = Math.hypot(x + 0.5 - 16.5, y + 0.5 - 16.5);
        if (d > 15.6 && d < 16.6 && ((x + y + f) % 2 === 0 || (x < 14 && y < 14))) P.set(x, y, x < 16 && y < 16 ? '#e0f7ff' : '#8fd4ff');
        else if (d > 14.2 && d < 15.2 && (x + y + f) % 4 === 0) P.set(x, y, '#3a86f0');
      }
    }
    P.set(8, 9, '#ffffff'); P.set(9, 8, '#ffffff');
  });

  /* =========================================================
   * 내 탄
   * ========================================================= */
  const bolt = [
    '..Y..',
    '.YwY.',
    '.ywy.',
    '.ywy.',
    '.ywy.',
    '.oyo.',
    '.oyo.',
    '..o..',
    '..O..',
  ];
  SH.pix.sprite('shot_spread', {
    palette: { w: '#ffffff', Y: '#fff4a8', y: '#ffd84a', o: '#ff8a2a', O: '#b8501c' },
    frames: [bolt, shear(bolt, -1, 0.3), shear(bolt, 1, 0.3)],
  });
  SH.pix.sprite('shot_homing', {
    palette: { w: '#ffffff', Y: '#e0ffd8', y: '#a6f070', o: '#45c44a', O: '#23703a' },
    frames: [bolt],
  });

  SH.pix.paint('shot_laser', 11, 20, 5, (P, f) => {
    const w = [3, 5, 7, 9, 11][f];
    const cols = ['#1c3f9a', '#3a86f0', '#8fd4ff', '#e0f7ff', '#ffffff'];
    const x0 = Math.floor((11 - w) / 2);
    for (let y = 0; y < 20; y++) {
      for (let i = 0; i < w; i++) {
        const dist = Math.abs(i - (w - 1) / 2) / ((w + 1) / 2); // 0 가운데 → 1 가장자리
        let lvl = Math.min(4, Math.floor((1 - dist) * 5));
        if (y === 0 && dist > 0.3) continue;
        if (y === 1 && dist > 0.7) continue;
        if (y >= 17) { lvl -= y - 16; if (lvl < 0) continue; if (y === 19 && (i + y) % 2) continue; }
        P.set(x0 + i, y, cols[Math.max(0, lvl)]);
      }
    }
  });

  const missileUp = [
    '....k....',
    '...kwk...',
    '...kEk...',
    '...kek...',
    '...kek...',
    '..kGeGk..',
    '..kGkGk..',
    '...kyk...',
    '....o....',
  ];
  const missileUR = [
    '.......k.',
    '......kwk',
    '.....kEk.',
    '....kek..',
    '..kkek...',
    '.kGek....',
    '..kGk....',
    '.yk......',
    'o........',
  ];
  const r1 = rot90(missileUp), r2 = rot90(r1), r3 = rot90(r2);
  const d1 = rot90(missileUR), d2 = rot90(d1), d3 = rot90(d2);
  SH.pix.sprite('missile', {
    palette: { k, w: '#ffffff', E: '#a6f070', e: '#45c44a', G: '#23703a', y: '#ffd84a', o: '#ff8a2a' },
    frames: [missileUp, missileUR, r1, d1, r2, d2, r3, d3],
  });

  /* =========================================================
   * 아이템
   * ========================================================= */
  const P_LETTER = ['wwww.', 'ww.ww', 'wwww.', 'ww...', 'ww...'];
  function powerOrb(cols) {
    return (P, f) => {
      ball(P, 6.5, 6.5, 5.6, cols);
      P.stamp(P_LETTER, { w: '#ffffff' }, 4, 4);
      P.set(3, 3, '#ffffff');
      P.outline(k);
      if (f) { P.set(1, 2, '#ffffff'); P.set(11, 10, '#ffffff'); }
    };
  }
  SH.pix.paint('item_spread', 13, 13, 2, powerOrb(['#b8501c', '#ff8a2a', '#ffd84a']));
  SH.pix.paint('item_laser', 13, 13, 2, powerOrb(['#1c3f9a', '#3a86f0', '#8fd4ff']));
  SH.pix.paint('item_homing', 13, 13, 2, powerOrb(['#23703a', '#45c44a', '#a6f070']));

  SH.pix.paint('item_bomb', 13, 13, 2, (P, f) => {
    ball(P, 6.5, 6.5, 5.6, ['#b8501c', '#ff8a2a', '#ffd84a']);
    ball(P, 6, 7.5, 3.3, ['#1b1230', '#2e2848', '#5a5680']);
    P.set(5, 6, '#9a96b8');
    P.set(8, 4, '#5a5680');
    P.set(9, 3, '#5a5680');
    P.set(10, 2, f ? '#ffffff' : '#ffd84a');
    if (f) { P.set(11, 2, '#ffd84a'); P.set(10, 1, '#ffd84a'); }
    P.outline(k);
  });

  SH.pix.sprite('item_life', {
    palette: { k, r: '#e8384f', R: '#8e1c3a', p: '#ff7aa8', P: '#ffc4dc', w: '#ffffff' },
    frames: [[
      '.............',
      '..kkk...kkk..',
      '.kpppk.kpprk.',
      'kpPwppkpppprk',
      'kpwpppppppprk',
      'kppppppppprrk',
      'kppppppppprRk',
      '.kppppppprRk.',
      '..kppppprRk..',
      '...kppprRk...',
      '....kprRk....',
      '.....kRk.....',
      '......k......',
    ], [
      '.............',
      '..kkk...kkk..',
      '.kpppk.kpprk.',
      'kpPPppkpppprk',
      'kpPwppppppprk',
      'kppppppppprrk',
      'kppppppppprRk',
      '.kppppppprRk.',
      '..kppppprRk..',
      '...kppprRk...',
      '....kprRk....',
      '.....kRk.....',
      '......k......',
    ]],
  });

  const SHIELD = [
    '.............',
    '.kkkkkkkkkkk.',
    '.kCCCCCcccbk.',
    '.kCwCcwcccBk.',
    '.kCcccwcccBk.',
    '.kccwwwwwcBk.',
    '.kccccwccbBk.',
    '.kccccwccbBk.',
    '..kcccwcbBk..',
    '..kbcccccBk..',
    '...kbbcbBk...',
    '....kbBBk....',
    '.....kkk.....',
  ];
  SH.pix.sprite('item_shield', {
    palette: { k, c: '#8fd4ff', C: '#e0f7ff', b: '#3a86f0', B: '#1c3f9a', w: '#ffffff' },
    frames: [SHIELD, SHIELD.map((r, y) => (y === 9 ? '..kbccccwBk..' : y === 3 ? '.kCCCcwcccBk.' : r))],
  });

  SH.pix.sprite('gem', {
    palette: { k, C: '#e0f7ff', c: '#8fd4ff', b: '#3a86f0', B: '#1c3f9a', w: '#ffffff' },
    frames: [[
      '...k...',
      '..kCk..',
      '.kCcck.',
      'kCwccbk',
      'kccccbk',
      '.kcbbk.',
      '..kbk..',
      '..kBk..',
      '...k...',
    ], [
      '...k...',
      '..kCk..',
      '..kcck.',
      '.kCwck.',
      '.kccbk.',
      '..kcbk.',
      '..kbk..',
      '..kBk..',
      '...k...',
    ], [
      '...k...',
      '...k...',
      '..kCk..',
      '..kwk..',
      '..kck..',
      '..kbk..',
      '..kbk..',
      '...k...',
      '...k...',
    ], [
      '...k...',
      '..kCk..',
      '.kCck..',
      '.kcwbk.',
      '.kccbk.',
      '.kcbk..',
      '..kbk..',
      '..kBk..',
      '...k...',
    ]],
  });

  SH.pix.sprite('bigGem', {
    palette: { k, y: '#ffd84a', Y: '#fff4a8', o: '#ff8a2a', O: '#b8501c', w: '#ffffff' },
    frames: [[
      '.....k.....',
      '....kYk....',
      '....kYk....',
      'kkkkYwykkkk',
      'kYYYywyyyok',
      '.kyyyyyyok.',
      '..kyyyyok..',
      '..kyyoyok..',
      '.kyok.kook.',
      '.kok...kOk.',
      '.kk.....kk.',
    ], [
      '.....k.....',
      '....kwk....',
      '....kYk....',
      'kkkkYwykkkk',
      'kwYYywyyyok',
      '.kyyyyyyok.',
      '..kyyyyok..',
      '..kyyoyok..',
      '.kyok.kook.',
      '.kok...kOk.',
      '.kk.....kk.',
    ]],
  });

  SH.pix.sprite('spark', {
    palette: { w: '#ffffff', y: '#fff4a8', o: '#ffd84a' },
    frames: [[
      '..y..',
      '..w..',
      'ywwwy',
      '..w..',
      '..y..',
    ], [
      '.....',
      '.o.o.',
      '..w..',
      '.o.o.',
      '.....',
    ]],
  });

  /* =========================================================
   * 적 탄 (색 8가지 × 작은 탄 / 큰 탄)
   * ========================================================= */
  const ORB = [[
    '..kkk..',
    '.kaaak.',
    'kabbbak',
    'kabwbak',
    'kabbbak',
    '.kaaak.',
    '..kkk..',
  ], [
    '..kkk..',
    '.kabak.',
    'kabwbak',
    'kawwwak',
    'kabwbak',
    '.kabak.',
    '..kkk..',
  ]];
  const BIG = [[
    '....kkkkk....',
    '..kkaaaaakk..',
    '.kaaabbbaaak.',
    '.kabbbbbbbak.',
    'kaabwwbbbbaak',
    'kabbwwwbbbbak',
    'kabbbwwwbbbak',
    'kabbbbwwbbbak',
    'kaabbbbbbbaak',
    '.kabbbbbbbak.',
    '.kaaabbbaaak.',
    '..kkaaaaakk..',
    '....kkkkk....',
  ], [
    '....kkkkk....',
    '..kkaaaaakk..',
    '.kaaaaaaaaak.',
    '.kaabbbbbaak.',
    'kaabwwbbbbaak',
    'kaabwwwwbbaak',
    'kaabbwwwwbaak',
    'kaabbbwwwbaak',
    'kaabbbbbbbaak',
    '.kaabbbbbaak.',
    '.kaaaaaaaaak.',
    '..kkaaaaakk..',
    '....kkkkk....',
  ]];
  const BULLET = {
    pink: ['#ff4f9a', '#ffc4dc'], red: ['#ff2f3a', '#ffc0b8'], orange: ['#ff8a1f', '#ffd8a8'], yellow: ['#ffc61a', '#fff4a8'],
    green: ['#3fcf45', '#c8ffc0'], blue: ['#2f8fff', '#c4e4ff'], purple: ['#9a4dff', '#e2ccff'], white: ['#a8a2d8', '#f4f0ff'],
  };
  for (const [name, [a, b]] of Object.entries(BULLET)) {
    SH.pix.sprite('orb_' + name, { palette: { k, a, b, w: '#ffffff' }, frames: ORB });
    SH.pix.sprite('big_' + name, { palette: { k, a, b, w: '#ffffff' }, frames: BIG });
  }
})();
