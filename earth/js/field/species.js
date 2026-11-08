'use strict';

/*
 * 지상 장면에 나오는 생명체·무생명체 도감.
 * 각 항목: 언제(when)·어디서(habitat) 나오는지, 크기, 움직임, 그림(draw), 설명.
 * 그림 좌표: 발 닿는 곳이 (0, 0), 위쪽이 음수 y. 크기 1 = 그 생물의 기준 크기(size, m).
 * env.E 는 "진화 시계" — 실제 역사에서는 시간과 같고, 역사를 바꾸면 생물이 나타나는 때도 달라집니다.
 */
(function () {
  const EC = (window.EC = window.EC || {});
  EC.field = EC.field || {};

  /* ---------- 그리기 도우미 ---------- */
  const G = { L: [1, 1, 1] };
  const cl = (v) => Math.max(0, Math.min(255, v | 0));
  function c(rgb, a = 1, k = 1) {
    return `rgba(${cl(rgb[0] * k * G.L[0])},${cl(rgb[1] * k * G.L[1])},${cl(rgb[2] * k * G.L[2])},${a})`;
  }
  function lin(ctx, x0, y0, x1, y1, stops) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    for (const [o, col] of stops) g.addColorStop(o, col);
    return g;
  }
  function rad(ctx, x, y, r0, r1, stops) {
    const g = ctx.createRadialGradient(x, y, r0, x, y, r1);
    for (const [o, col] of stops) g.addColorStop(o, col);
    return g;
  }
  function ell(ctx, x, y, rx, ry, fill, rot = 0) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(1e-4, rx), Math.max(1e-4, ry), rot, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
  }
  function poly(ctx, pts, fill, stroke, lw) {
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
  }
  function line(ctx, x0, y0, x1, y1, col, w) {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    ctx.stroke();
  }
  function curve(ctx, pts, col, w) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    if (pts.length === 3) ctx.quadraticCurveTo(pts[1][0], pts[1][1], pts[2][0], pts[2][1]);
    else ctx.bezierCurveTo(pts[1][0], pts[1][1], pts[2][0], pts[2][1], pts[3][0], pts[3][1]);
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    ctx.stroke();
  }
  function shadow(ctx, rx, a = 0.28) {
    ell(ctx, 0, 0, rx, rx * 0.18, `rgba(0,0,0,${a})`);
  }
  /* 다리: 위 관절에서 아래로, 걷는 각도 */
  function leg(ctx, x, y, len, ang, w, col, knee = 0.25) {
    const kx = x + Math.sin(ang) * len * 0.5;
    const ky = y + Math.cos(ang) * len * 0.5;
    const fx = kx + Math.sin(ang - knee) * len * 0.5;
    const fy = Math.min(0, ky + Math.cos(ang - knee) * len * 0.5);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(kx, ky);
    ctx.lineTo(fx, fy);
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  }

  const between = (E, a, b) => E !== null && E >= a && E < b;
  const atLeast = (E, a) => E !== null && E >= a;

  /* ---------- 도감 ---------- */
  const SPECIES = [
    /* ===== 무생명체 ===== */
    {
      id: 'rock', name: '바위', kind: 'thing', icon: '🪨', habitat: ['land', 'sea'], size: [0.35, 1.6], count: [5, 10], dist: [6, 160], w: 0.62, h: 0.75,
      when: (e) => e.habitat !== 'lava' || true,
      info: '지구의 단단한 껍데기를 이루는 암석 조각입니다. 화산에서 굳은 현무암, 모래가 쌓여 굳은 사암, 땅속 깊은 곳에서 식은 화강암처럼 만들어진 방법에 따라 종류가 다릅니다.',
      setup(i, rng, e) {
        const n = 9;
        i.pts = [];
        for (let k = 0; k < n; k++) {
          const a = Math.PI + (k / (n - 1)) * Math.PI;
          const r = 0.45 + rng() * 0.2;
          i.pts.push([Math.cos(a) * r * 1.2, Math.min(0, Math.sin(a) * r * (1.2 + rng() * 0.4))]);
        }
        i.col = e.lava ? [40, 34, 32] : e.oxid > 0.5 ? [116, 106, 96] : [88, 86, 84];
        if (e.under) i.col = [96, 104, 100];
      },
      draw(ctx, t, i, e) {
        shadow(ctx, 0.62);
        poly(ctx, i.pts, lin(ctx, -0.4, -0.7, 0.4, 0, [[0, c(i.col, 1, 1.15)], [0.6, c(i.col, 1, 0.8)], [1, c(i.col, 1, 0.5)]]));
        ell(ctx, -0.12, -0.42, 0.22, 0.1, c(i.col, 0.35, 1.35), -0.3);
        line(ctx, -0.15, -0.45, 0.05, -0.2, c(i.col, 0.6, 0.4), 0.025);
        line(ctx, 0.05, -0.2, 0.2, -0.28, c(i.col, 0.6, 0.4), 0.02);
        if (e.under) ell(ctx, 0.05, -0.55, 0.35, 0.08, c([60, 120, 70], 0.6));
        if (e.lava) line(ctx, -0.3, -0.05, 0.35, -0.08, `rgba(255,${120 + 60 * Math.sin(t * 2) | 0},30,0.9)`, 0.04);
      },
    },
    {
      id: 'crystal', name: '석영 결정', kind: 'thing', icon: '💎', habitat: ['land'], size: [0.25, 0.4], count: [1, 1], dist: [2.5, 5], w: 0.5, h: 1,
      when: (e) => e.habitat === 'land' && !e.lava,
      info: '이산화규소(SiO₂)가 규칙적으로 쌓여 자란 육각기둥 모양의 광물입니다. 생명체가 아니지만, 원자가 정해진 모양으로 차곡차곡 쌓이며 "자랍니다". 지각에서 두 번째로 흔한 광물입니다.',
      setup(i, rng) {
        i.prisms = [];
        for (let k = 0; k < 5; k++) i.prisms.push({ a: (rng() - 0.5) * 0.9, l: 0.45 + rng() * 0.55, w: 0.07 + rng() * 0.05, x: (rng() - 0.5) * 0.3 });
      },
      draw(ctx, t, i) {
        shadow(ctx, 0.4, 0.2);
        for (const p of i.prisms) {
          ctx.save();
          ctx.translate(p.x, 0);
          ctx.rotate(p.a);
          const w = p.w;
          const l = p.l;
          poly(ctx, [[-w, 0], [-w, -l], [0, -l - w * 1.6], [w, -l], [w, 0]], lin(ctx, -w, 0, w, 0, [[0, c([210, 200, 235], 0.85)], [0.5, c([250, 248, 255], 0.95)], [1, c([170, 160, 205], 0.85)]]), c([255, 255, 255], 0.7), 0.012);
          line(ctx, 0, -l * 0.1, 0, -l - w * 1.4, c([255, 255, 255], 0.6), 0.01);
          ctx.restore();
        }
      },
    },
    {
      id: 'volcano', name: '화산', kind: 'thing', icon: '🌋', habitat: ['land'], size: [500, 1100], count: [1, 1], dist: [2500, 4200], w: 1.6, h: 1.3,
      when: (e) => (e.habitat === 'land' || e.habitat === 'lava') && (e.t < -2500 || e.lava),
      info: '땅속의 녹은 암석(마그마)이 뿜어져 나오는 산입니다. 어린 지구는 지금보다 훨씬 뜨거워서 화산 활동이 활발했고, 화산이 내뿜은 기체가 대기와 바다의 재료가 되었습니다.',
      draw(ctx, t, i, e) {
        poly(ctx, [[-1.6, 0], [-0.32, -0.95], [-0.16, -1], [0.16, -1], [0.32, -0.95], [1.6, 0]], lin(ctx, -1, -1, 1, 0, [[0, c([90, 78, 70])], [1, c([40, 34, 32])]]));
        const glow = 0.6 + 0.4 * Math.sin(t * 1.7);
        ell(ctx, 0, -0.99, 0.15, 0.03, `rgba(255,${120 + 60 * glow | 0},40,${0.8 * glow})`);
        line(ctx, 0.05, -0.97, 0.3, -0.55, 'rgba(255,110,30,0.7)', 0.02);
        line(ctx, -0.04, -0.97, -0.22, -0.6, 'rgba(255,90,20,0.6)', 0.015);
        for (let k = 0; k < 7; k++) {
          const f = (t * 0.05 + k / 7) % 1;
          ell(ctx, 0.05 + f * 0.5 + Math.sin(k + t * 0.3) * 0.05, -1.05 - f * 0.9, 0.12 + f * 0.35, 0.09 + f * 0.25, `rgba(70,64,62,${0.5 * (1 - f)})`);
        }
      },
    },
    {
      id: 'iceberg', name: '빙산', kind: 'thing', icon: '🧊', habitat: ['coast'], size: [12, 40], count: [1, 3], dist: [150, 900], w: 1, h: 0.8,
      when: (e) => e.coast && (e.T < 2 || e.snow),
      info: '빙하나 얼음판에서 떨어져 나온 거대한 얼음덩어리입니다. 얼음은 물보다 가벼워 떠 있지만, 부피의 약 90%는 물속에 잠겨 있습니다.',
      setup(i, rng) {
        i.pts = [[-1, 0]];
        for (let k = 1; k < 8; k++) i.pts.push([-1 + k * 0.25, -0.25 - rng() * 0.55]);
        i.pts.push([1, 0]);
      },
      draw(ctx, t, i) {
        const bob = Math.sin(t * 0.6 + i.phase) * 0.01;
        ctx.translate(0, bob);
        poly(ctx, [[-1.1, 0], [-0.7, 0.9], [0.8, 0.8], [1.1, 0]], c([140, 200, 220], 0.35));
        poly(ctx, i.pts, lin(ctx, -1, -0.8, 1, 0, [[0, c([250, 252, 255])], [1, c([170, 205, 225])]]));
      },
    },
    {
      id: 'meteor', name: '유성', kind: 'thing', icon: '☄️', habitat: ['sky'], size: [1, 1], count: [3, 5], dist: [0, 0], w: 0, h: 0,
      when: (e) => !e.under && e.t < -3850,
      info: '우주를 떠돌던 돌이 대기에 뛰어들어 타면서 빛나는 것입니다. 어린 지구에는 훨씬 많은 소행성과 혜성이 떨어졌습니다(후기 대폭격 가설).',
    },

    /* ===== 바다의 생명 ===== */
    {
      id: 'stromatolite', name: '스트로마톨라이트', kind: 'life', icon: '🪸', habitat: ['shore', 'sea'], size: [0.5, 1.2], count: [5, 9], dist: [3, 40], w: 0.8, h: 0.75,
      when: (e) => e.alive && e.stage >= e.S.photo && (e.under || e.coast) && e.depthOK,
      count2: (e) => (e.stage >= e.S.animals ? [1, 2] : [5, 9]),
      info: '남세균(시아노박테리아)이 햇빛을 받으며 만든 끈적한 막에 모래가 붙고, 그 위에 또 막이 자라기를 수천 년 되풀이해 생긴 층층이 쌓인 바위 기둥입니다. 35억 년 전부터 지구에 산소를 보탠 주인공으로, 지금도 오스트레일리아 샤크만에서 볼 수 있습니다.',
      setup(i, rng) {
        i.domes = [];
        for (let k = 0; k < 4; k++) i.domes.push({ x: (k - 1.5) * 0.38 + (rng() - 0.5) * 0.1, h: 0.4 + rng() * 0.45, w: 0.2 + rng() * 0.08 });
      },
      draw(ctx, t, i) {
        shadow(ctx, 0.8, 0.22);
        for (const d of i.domes) {
          ctx.beginPath();
          ctx.moveTo(d.x - d.w, 0);
          ctx.lineTo(d.x - d.w, -d.h + d.w * 0.6);
          ctx.quadraticCurveTo(d.x, -d.h - d.w * 0.5, d.x + d.w, -d.h + d.w * 0.6);
          ctx.lineTo(d.x + d.w, 0);
          ctx.closePath();
          ctx.fillStyle = lin(ctx, d.x - d.w, 0, d.x + d.w, 0, [[0, c([150, 140, 110])], [0.4, c([185, 172, 135])], [1, c([110, 104, 84])]]);
          ctx.fill();
          for (let y = -0.08; y > -d.h + 0.05; y -= 0.07) line(ctx, d.x - d.w, y, d.x + d.w, y - 0.015, c([100, 92, 70], 0.55), 0.012);
          ell(ctx, d.x, -d.h + d.w * 0.1, d.w * 0.9, d.w * 0.28, c([70, 110, 60], 0.85));
        }
      },
    },
    {
      id: 'seaweed', name: '해조류', kind: 'life', icon: '🌿', habitat: ['sea'], size: [0.8, 2.5], count: [5, 9], dist: [3, 40], w: 0.5, h: 1,
      when: (e) => e.under && e.alive && e.stage >= e.S.multicell && e.depthOK,
      info: '바다에서 광합성을 하는 다세포 조류입니다. 뿌리처럼 생긴 부착기로 바위에 붙어 햇빛 쪽으로 자랍니다. 약 10억 년 전 처음 나타난 다세포 생물의 후손입니다.',
      draw(ctx, t, i) {
        for (let k = 0; k < 4; k++) {
          const x = (k - 1.5) * 0.12;
          const sw = Math.sin(t * 0.9 + i.phase + k) * 0.15;
          const col = k % 2 ? c([80, 110, 40]) : c([110, 120, 45]);
          curve(ctx, [[x, 0], [x + sw * 0.5, -0.35], [x - sw * 0.3, -0.7], [x + sw, -1]], col, 0.05);
          for (let j = 1; j < 5; j++) ell(ctx, x + sw * (j / 5), -j * 0.2, 0.06, 0.025, col, sw + 0.5);
        }
      },
    },
    {
      id: 'dickinsonia', name: '디킨소니아', kind: 'life', icon: '🫓', habitat: ['sea'], size: [0.3, 0.9], count: [3, 6], dist: [2.5, 18], w: 0.55, h: 0.2, flat: true,
      when: (e) => e.under && e.stage === e.S.ediacaran,
      info: '약 5억 7천만 년 전 바다 밑에 살던 납작한 타원형 생물입니다. 입도, 눈도, 다리도 없이 바닥의 미생물 막을 몸으로 흡수해 먹었던 것으로 보이며, 가장 오래된 동물 가운데 하나로 여겨집니다.',
      draw(ctx, t, i) {
        ctx.scale(1, 0.4);
        ell(ctx, 0.04, 0.05, 0.52, 0.4, 'rgba(0,0,0,0.25)');
        ell(ctx, 0, -0.1, 0.5, 0.38, rad(ctx, -0.1, -0.2, 0.05, 0.55, [[0, c([225, 180, 130])], [1, c([170, 120, 80])]]));
        line(ctx, -0.48, -0.1, 0.48, -0.1, c([130, 85, 55], 0.8), 0.02);
        for (let k = -9; k <= 9; k++) {
          const x = k * 0.05;
          const yy = Math.sqrt(Math.max(0, 1 - (x / 0.5) ** 2)) * 0.36;
          line(ctx, x, -0.1 - yy, x, -0.1 + yy, c([140, 95, 60], 0.6), 0.012);
        }
      },
    },
    {
      id: 'charnia', name: '카르니아', kind: 'life', icon: '🪶', habitat: ['sea'], size: [0.3, 0.7], count: [3, 6], dist: [2.5, 20], w: 0.25, h: 1,
      when: (e) => e.under && e.stage === e.S.ediacaran,
      info: '깃털처럼 생긴 에디아카라 생물입니다. 바닥에 원반 모양 뿌리를 박고 서서 물속의 영양분을 걸러 먹었던 것으로 보입니다. 동물인지 아닌지 아직 논쟁 중입니다.',
      draw(ctx, t, i) {
        const sw = Math.sin(t * 0.7 + i.phase) * 0.06;
        ell(ctx, 0, 0, 0.12, 0.03, c([150, 110, 100]));
        line(ctx, 0, 0, sw * 0.4, -0.2, c([170, 130, 120]), 0.03);
        ctx.beginPath();
        ctx.moveTo(sw * 0.4, -0.2);
        ctx.quadraticCurveTo(0.22 + sw, -0.6, sw, -1);
        ctx.quadraticCurveTo(-0.22 + sw, -0.6, sw * 0.4, -0.2);
        ctx.fillStyle = lin(ctx, -0.2, 0, 0.2, 0, [[0, c([200, 140, 140])], [1, c([235, 190, 175])]]);
        ctx.fill();
        for (let k = 1; k < 10; k++) {
          const y = -0.2 - k * 0.08;
          const x = sw * (0.4 + k * 0.06);
          line(ctx, x - 0.15, y + 0.03, x, y, c([150, 95, 95], 0.6), 0.01);
          line(ctx, x + 0.15, y + 0.03, x, y, c([150, 95, 95], 0.6), 0.01);
        }
      },
    },
    {
      id: 'jellyfish', name: '해파리', kind: 'life', icon: '🪼', habitat: ['sea'], size: [0.35, 0.9], count: [3, 6], dist: [3, 18], w: 0.35, h: 1.1, swim: 'drift', alt: [0.5, 2.5],
      when: (e) => e.under && e.alive && e.stage >= e.S.ediacaran,
      info: '몸의 95% 이상이 물인 투명한 동물입니다. 뇌도 심장도 없이 우산 모양 몸을 오므렸다 펴며 헤엄칩니다. 5억 년이 넘는 긴 역사를 가진 가장 오래된 동물 무리 가운데 하나입니다.',
      draw(ctx, t, i) {
        const p = Math.sin(t * 2 + i.phase);
        const bw = 0.3 * (1 + p * 0.08);
        for (let k = 0; k < 7; k++) {
          const x = (k - 3) * 0.07;
          curve(ctx, [[x, -0.75], [x + Math.sin(t * 1.5 + k) * 0.06, -0.5], [x - Math.sin(t * 1.3 + k) * 0.06, -0.25], [x + Math.sin(t + k) * 0.05, -0.05]], c([230, 190, 230], 0.45), 0.012);
        }
        ctx.beginPath();
        ctx.ellipse(0, -0.78, bw, 0.25 * (1 - p * 0.06), 0, Math.PI, Math.PI * 2);
        ctx.closePath();
        ctx.fillStyle = rad(ctx, 0, -0.85, 0.02, 0.32, [[0, c([255, 230, 255], 0.75)], [1, c([200, 150, 220], 0.35)]]);
        ctx.fill();
        ell(ctx, 0, -0.82, 0.1, 0.05, c([255, 180, 220], 0.5));
      },
    },
    {
      id: 'trilobite', name: '삼엽충', kind: 'life', icon: '🪲', habitat: ['sea'], size: [0.12, 0.4], count: [5, 9], dist: [1.3, 7], w: 0.5, h: 0.25, flat: true, crawl: 0.04,
      when: (e) => e.under && e.stage >= e.S.animals && between(e.E, -538.8, -252),
      info: '고생대 바다를 2억 7천만 년 넘게 누빈 절지동물입니다. 몸이 세 갈래(가운데와 양옆)로 나뉘어 "삼엽충"이라 부릅니다. 방해석으로 된 수정체 눈을 가진, 눈이 있는 가장 오래된 동물 가운데 하나입니다.',
      draw(ctx, t, i) {
        const bob = Math.abs(Math.sin(t * 6 + i.phase)) * 0.01;
        ctx.translate(0, -bob);
        ctx.scale(1, 0.45);
        ell(ctx, 0.03, 0.06, 0.5, 0.3, 'rgba(0,0,0,0.25)');
        const body = c([120, 100, 80]);
        ctx.beginPath();
        ctx.moveTo(0.48, -0.15);
        ctx.quadraticCurveTo(0.5, -0.5, 0.25, -0.5);
        ctx.lineTo(-0.38, -0.36);
        ctx.quadraticCurveTo(-0.52, -0.15, -0.38, 0.06);
        ctx.lineTo(0.25, 0.2);
        ctx.quadraticCurveTo(0.5, 0.2, 0.48, -0.15);
        ctx.fillStyle = lin(ctx, 0, -0.5, 0, 0.2, [[0, c([150, 128, 100])], [1, c([90, 72, 56])]]);
        ctx.fill();
        ell(ctx, 0.36, -0.15, 0.16, 0.3, c([140, 118, 92]));
        line(ctx, 0.36, -0.15, 0.62, 0.15, body, 0.03);
        line(ctx, 0.36, -0.15, 0.62, -0.45, body, 0.03);
        ell(ctx, 0.36, -0.3, 0.04, 0.05, c([40, 35, 30]));
        ell(ctx, 0.36, 0.0, 0.04, 0.05, c([40, 35, 30]));
        ell(ctx, -0.05, -0.15, 0.4, 0.09, c([165, 142, 112]));
        for (let k = 0; k < 9; k++) {
          const x = 0.2 - k * 0.065;
          line(ctx, x, -0.42 + k * 0.012, x, 0.12 - k * 0.012, c([70, 55, 42], 0.7), 0.012);
        }
      },
    },
    {
      id: 'anomalocaris', name: '아노말로카리스', kind: 'life', icon: '🦐', habitat: ['sea'], size: [0.5, 1], count: [1, 3], dist: [3, 15], w: 0.55, h: 0.35, swim: 'swim', alt: [0.4, 2.5], speed: 0.5,
      when: (e) => e.under && e.stage >= e.S.animals && between(e.E, -538.8, -480),
      info: '캄브리아기 바다의 최상위 포식자입니다. 머리 앞의 가시 돋친 팔로 먹이를 붙잡고, 몸 양옆의 지느러미를 물결치듯 움직여 헤엄쳤습니다. 길이가 1m에 이르기도 했습니다.',
      draw(ctx, t, i) {
        const w = t * 5 + i.phase;
        for (let k = 0; k < 9; k++) {
          const x = 0.3 - k * 0.075;
          const f = Math.sin(w - k * 0.7) * 0.06;
          ell(ctx, x, -0.12 + f, 0.05, 0.12, c([200, 110, 80], 0.9), 0.4);
        }
        ell(ctx, 0, -0.15, 0.4, 0.1, lin(ctx, 0, -0.25, 0, -0.05, [[0, c([215, 120, 85])], [1, c([150, 70, 50])]]));
        poly(ctx, [[-0.38, -0.15], [-0.55, -0.25], [-0.52, -0.15], [-0.55, -0.05]], c([190, 100, 70]));
        line(ctx, 0.36, -0.2, 0.45, -0.3, c([60, 40, 30]), 0.02);
        ell(ctx, 0.46, -0.31, 0.03, 0.03, c([30, 25, 20]));
        const a = Math.sin(t * 2 + i.phase) * 0.2;
        curve(ctx, [[0.38, -0.12], [0.55, -0.15 + a * 0.2], [0.6, -0.02], [0.5, 0.02]], c([220, 140, 100]), 0.03);
      },
    },
    {
      id: 'fish', name: '물고기', kind: 'life', icon: '🐟', habitat: ['sea'], size: [0.2, 0.5], count: [6, 12], dist: [2.5, 20], w: 0.5, h: 0.35, swim: 'school', alt: [0.5, 5], speed: 1.2,
      when: (e) => e.under && e.stage >= e.S.animals && atLeast(e.E, -420),
      info: '등뼈를 가진 동물(척추동물)은 물고기에서 시작했습니다. 약 4억 2천만 년 전부터 턱과 지느러미를 가진 물고기들이 바다를 채웠고, 사람을 포함한 육지 척추동물도 그 후손입니다.',
      draw(ctx, t, i) {
        const tw = Math.sin(t * 9 + i.phase) * 0.08;
        poly(ctx, [[-0.32, -0.16], [-0.5, -0.3 + tw], [-0.46, -0.16], [-0.5, -0.02 + tw]], c([90, 120, 150]));
        ell(ctx, 0, -0.16, 0.36, 0.13, lin(ctx, 0, -0.29, 0, -0.03, [[0, c([70, 100, 135])], [0.55, c([170, 195, 210])], [1, c([225, 230, 235])]]));
        poly(ctx, [[-0.05, -0.27], [0.1, -0.36], [0.12, -0.27]], c([80, 110, 145]));
        ell(ctx, 0.24, -0.19, 0.03, 0.03, c([20, 20, 25]));
      },
    },
    {
      id: 'shark', name: '상어', kind: 'life', icon: '🦈', habitat: ['sea'], size: [1.5, 4], count: [0, 1], dist: [12, 40], w: 0.55, h: 0.4, swim: 'swim', alt: [2, 8], speed: 1.5,
      when: (e) => e.under && atLeast(e.E, -400) && e.depth > 15,
      info: '연골로 된 뼈대를 가진 물고기로, 4억 년 넘게 바다를 지켜 온 포식자입니다. 다섯 번의 대멸종을 모두 살아남았습니다.',
      draw(ctx, t, i) {
        const tw = Math.sin(t * 3 + i.phase) * 0.06;
        poly(ctx, [[-0.35, -0.15], [-0.55, -0.4 + tw], [-0.5, -0.15], [-0.52, -0.02 + tw]], c([90, 100, 110]));
        ctx.beginPath();
        ctx.moveTo(0.5, -0.16);
        ctx.quadraticCurveTo(0.3, -0.3, -0.38, -0.17);
        ctx.quadraticCurveTo(0.2, -0.04, 0.5, -0.16);
        ctx.fillStyle = lin(ctx, 0, -0.3, 0, -0.05, [[0, c([95, 105, 118])], [0.6, c([150, 158, 168])], [1, c([225, 228, 230])]]);
        ctx.fill();
        poly(ctx, [[0.0, -0.24], [-0.12, -0.42], [-0.15, -0.23]], c([85, 95, 108]));
        poly(ctx, [[0.12, -0.12], [0.0, -0.0], [-0.04, -0.12]], c([110, 120, 130]));
        ell(ctx, 0.36, -0.19, 0.018, 0.018, c([10, 10, 10]));
        for (let k = 0; k < 4; k++) line(ctx, 0.25 - k * 0.025, -0.2, 0.24 - k * 0.025, -0.13, c([60, 70, 80], 0.6), 0.006);
      },
    },
    {
      id: 'ammonite', name: '암모나이트', kind: 'life', icon: '🐚', habitat: ['sea'], size: [0.15, 0.6], count: [2, 5], dist: [3, 20], w: 0.45, h: 0.6, swim: 'drift', alt: [0.5, 4],
      when: (e) => e.under && atLeast(e.E, -400) && (e.E < -66 || e.dynasty === 'archosaur'),
      info: '나선형 껍데기를 가진 오징어의 먼 친척입니다. 껍데기 속 방에 기체를 채워 떠다녔습니다. 4억 년 가까이 번성했지만 공룡과 함께 6600만 년 전에 사라졌고, 화석으로 흔히 발견됩니다.',
      draw(ctx, t, i) {
        const bob = Math.sin(t + i.phase) * 0.02;
        ctx.translate(0, bob);
        ell(ctx, 0, -0.3, 0.3, 0.3, rad(ctx, -0.08, -0.38, 0.02, 0.32, [[0, c([240, 220, 180])], [1, c([170, 130, 90])]]));
        ctx.beginPath();
        for (let a = 0; a < Math.PI * 6; a += 0.15) {
          const r = 0.29 * Math.exp(-a * 0.16);
          const x = Math.cos(a) * r;
          const y = -0.3 + Math.sin(a) * r;
          if (a === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = c([120, 85, 55], 0.8);
        ctx.lineWidth = 0.018;
        ctx.stroke();
        for (let k = 0; k < 14; k++) {
          const a = k * 0.45;
          line(ctx, Math.cos(a) * 0.16, -0.3 + Math.sin(a) * 0.16, Math.cos(a) * 0.29, -0.3 + Math.sin(a) * 0.29, c([150, 110, 75], 0.5), 0.01);
        }
        for (let k = 0; k < 5; k++) curve(ctx, [[0.27, -0.25 + k * 0.03], [0.38, -0.2 + k * 0.04 + Math.sin(t * 2 + k) * 0.02], [0.42, -0.12 + k * 0.04]], c([200, 150, 130], 0.9), 0.018);
      },
    },
    {
      id: 'plesiosaur', name: '수장룡', kind: 'life', icon: '🦕', habitat: ['sea'], size: [3, 7], count: [0, 1], dist: [15, 45], w: 0.6, h: 0.55, swim: 'swim', alt: [2, 10], speed: 1.2,
      when: (e) => e.under && e.dynasty === 'archosaur' && atLeast(e.E, -200) && e.depth > 12,
      info: '공룡 시대 바다에 살던 파충류입니다. 긴 목과 네 개의 커다란 지느러미발로 물속을 날듯이 헤엄쳤습니다. 공룡이 아니라 공룡의 먼 친척입니다.',
      draw(ctx, t, i) {
        const fl = Math.sin(t * 2 + i.phase) * 0.4;
        const col = c([90, 105, 100]);
        ell(ctx, 0.12, -0.15, 0.12, 0.04, col, 0.6 + fl);
        ell(ctx, -0.15, -0.15, 0.1, 0.035, col, 0.6 - fl);
        ell(ctx, 0, -0.22, 0.26, 0.12, lin(ctx, 0, -0.34, 0, -0.1, [[0, c([95, 110, 105])], [1, c([170, 175, 160])]]));
        poly(ctx, [[-0.25, -0.24], [-0.5, -0.2], [-0.25, -0.18]], col);
        curve(ctx, [[0.22, -0.25], [0.35, -0.3], [0.45, -0.45], [0.55, -0.48]], col, 0.06);
        ell(ctx, 0.58, -0.48, 0.06, 0.03, col);
        ell(ctx, 0.6, -0.49, 0.01, 0.01, c([10, 10, 10]));
      },
    },
    {
      id: 'whale', name: '고래', kind: 'life', icon: '🐋', habitat: ['sea'], size: [8, 16], count: [0, 1], dist: [25, 60], w: 0.55, h: 0.35, swim: 'swim', alt: [4, 14], speed: 1.4,
      when: (e) => e.under && e.dynasty === 'mammal' && e.mammalAge >= 15 && e.depth > 15,
      info: '육지에 살던 포유류가 약 5천만 년 전 다시 바다로 돌아가 진화한 동물입니다. 지금도 공기로 숨을 쉬고 새끼에게 젖을 먹입니다. 대왕고래는 지구에 살았던 가장 큰 동물입니다.',
      draw(ctx, t, i) {
        const f = Math.sin(t * 1.2 + i.phase) * 0.06;
        ctx.beginPath();
        ctx.moveTo(0.5, -0.18);
        ctx.bezierCurveTo(0.48, -0.32, 0.0, -0.33, -0.38, -0.2 + f * 0.5);
        ctx.bezierCurveTo(0.0, -0.06, 0.4, -0.04, 0.5, -0.18);
        ctx.fillStyle = lin(ctx, 0, -0.33, 0, -0.06, [[0, c([45, 55, 70])], [0.7, c([70, 82, 98])], [1, c([170, 175, 180])]]);
        ctx.fill();
        poly(ctx, [[-0.36, -0.2 + f * 0.5], [-0.55, -0.3 + f], [-0.47, -0.2 + f * 0.6], [-0.55, -0.1 + f]], c([45, 55, 70]));
        ell(ctx, 0.15, -0.09, 0.14, 0.03, c([60, 70, 85]), 0.5);
        for (let k = 0; k < 5; k++) line(ctx, 0.4 - k * 0.04, -0.1, 0.1 - k * 0.04, -0.07, c([130, 135, 140], 0.6), 0.006);
        ell(ctx, 0.36, -0.2, 0.012, 0.012, c([10, 10, 10]));
      },
    },
    {
      id: 'coral', name: '산호', kind: 'life', icon: '🪸', habitat: ['sea'], size: [0.4, 1.2], count: [3, 6], dist: [3, 25], w: 0.6, h: 0.9,
      when: (e) => e.under && atLeast(e.E, -485) && e.T > 18 && e.depth < 40,
      info: '산호는 식물처럼 보이지만 작은 동물(폴립)이 모여 사는 군체입니다. 몸속에 사는 조류가 광합성으로 양분을 나눠 주고, 탄산칼슘 뼈대가 쌓여 산호초가 됩니다. 바다 생물의 4분의 1이 산호초에 기대어 삽니다.',
      setup(i, rng) { i.hue = rng() < 0.5 ? [235, 120, 90] : [225, 140, 190]; i.seedB = rng() * 100; },
      draw(ctx, t, i) {
        const br = (x, y, a, l, d) => {
          if (d > 4) return;
          const x2 = x + Math.sin(a) * l;
          const y2 = y - Math.cos(a) * l;
          line(ctx, x, y, x2, y2, c(i.hue, 1, 1 - d * 0.08), 0.07 - d * 0.012);
          br(x2, y2, a - 0.45 + Math.sin(i.seedB + d) * 0.15, l * 0.75, d + 1);
          br(x2, y2, a + 0.4, l * 0.72, d + 1);
        };
        br(-0.15, 0, -0.1, 0.32, 0);
        ell(ctx, 0.3, -0.12, 0.22, 0.13, rad(ctx, 0.25, -0.2, 0.02, 0.24, [[0, c([230, 200, 120])], [1, c([170, 140, 70])]]));
        for (let k = 0; k < 4; k++) line(ctx, 0.12, -0.1 - k * 0.03, 0.48, -0.12 - k * 0.025, c([140, 110, 60], 0.6), 0.01);
      },
    },

    /* ===== 육지의 식물 ===== */
    {
      id: 'earlyPlant', name: '쿡소니아 (초기 육상 식물)', kind: 'life', icon: '🌱', habitat: ['land'], size: [0.05, 0.12], count: [8, 14], dist: [1.5, 8], w: 0.4, h: 1,
      when: (e) => e.habitat === 'land' && e.plants && between(e.E, -470, -385) && e.wet,
      info: '처음으로 육지에 올라온 식물 무리입니다. 잎도 뿌리도 없이, 손가락 마디만 한 줄기가 Y자로 갈라지고 끝에 포자 주머니를 달았습니다. 물가의 축축한 땅에서만 살 수 있었습니다.',
      draw(ctx, t, i) {
        for (let k = 0; k < 6; k++) {
          const x = (k - 2.5) * 0.12;
          const sw = Math.sin(t + k + i.phase) * 0.03;
          const col = c([90, 140, 60]);
          line(ctx, x, 0, x + sw, -0.5, col, 0.03);
          line(ctx, x + sw, -0.5, x - 0.08 + sw, -0.85, col, 0.025);
          line(ctx, x + sw, -0.5, x + 0.08 + sw, -0.8, col, 0.025);
          ell(ctx, x - 0.08 + sw, -0.88, 0.035, 0.045, c([150, 120, 60]));
          ell(ctx, x + 0.08 + sw, -0.83, 0.035, 0.045, c([150, 120, 60]));
        }
      },
    },
    {
      id: 'fern', name: '고사리', kind: 'life', icon: '🌿', habitat: ['land'], size: [0.6, 1.6], count: [5, 10], dist: [2, 30], w: 0.7, h: 0.9,
      when: (e) => e.habitat === 'land' && e.plants && atLeast(e.E, -390) && e.moist > 0.3 && e.T > -2,
      info: '꽃 없이 포자로 번식하는 식물입니다. 뿌리·줄기·잎을 갖춘 관다발 식물로 약 3억 8천만 년 전부터 지구의 숲 바닥을 덮었고, 공룡도 고사리를 먹었습니다.',
      draw(ctx, t, i) {
        for (let k = 0; k < 7; k++) {
          const a = -1.2 + k * 0.4 + Math.sin(t * 0.8 + i.phase + k) * 0.04;
          const ex = Math.sin(a) * 0.65;
          const ey = -Math.cos(a) * 0.55 - 0.25;
          const mx = Math.sin(a) * 0.3;
          const my = -0.75;
          const col = c(k % 2 ? [60, 110, 45] : [80, 130, 55]);
          curve(ctx, [[0, 0], [mx, my], [ex, ey]], col, 0.025);
          for (let j = 1; j < 8; j++) {
            const u = j / 8;
            const px = (1 - u) * (1 - u) * 0 + 2 * (1 - u) * u * mx + u * u * ex;
            const py = 2 * (1 - u) * u * my + u * u * ey;
            const l = 0.11 * (1 - u * 0.7);
            line(ctx, px, py, px - l * 0.7, py - l * 0.4, col, 0.022);
            line(ctx, px, py, px + l * 0.7, py - l * 0.4, col, 0.022);
          }
        }
      },
    },
    {
      id: 'scaleTree', name: '인목 (레피도덴드론)', kind: 'life', icon: '🌴', habitat: ['land'], size: [18, 35], count: [5, 9], dist: [22, 150], w: 0.3, h: 1,
      when: (e) => e.habitat === 'land' && e.forests && between(e.E, -385, -250) && e.moist > 0.35,
      info: '석탄기 늪지 숲을 이룬 키 30m의 거대한 나무입니다. 줄기에 비늘 같은 마름모 무늬가 있어 "비늘나무"라고도 합니다. 이 숲이 땅에 묻혀 오늘날의 석탄이 되었습니다.',
      draw(ctx, t, i) {
        ctx.beginPath();
        ctx.moveTo(-0.035, 0);
        ctx.lineTo(-0.02, -0.82);
        ctx.lineTo(0.02, -0.82);
        ctx.lineTo(0.035, 0);
        ctx.fillStyle = lin(ctx, -0.04, 0, 0.04, 0, [[0, c([80, 75, 55])], [0.5, c([120, 110, 80])], [1, c([60, 55, 40])]]);
        ctx.fill();
        for (let y = -0.04; y > -0.8; y -= 0.04) line(ctx, -0.03, y, 0.03, y - 0.02, c([50, 45, 30], 0.5), 0.004);
        const sw = Math.sin(t * 0.4 + i.phase) * 0.01;
        const tips = [[-0.16, -0.95], [-0.06, -1.0], [0.06, -1.0], [0.16, -0.95]];
        for (const [x, y] of tips) {
          curve(ctx, [[0, -0.82], [x * 0.5, -0.88], [x + sw, y]], c([80, 75, 55]), 0.012);
          for (let k = 0; k < 9; k++) {
            const a = (k / 8) * Math.PI * 2;
            line(ctx, x + sw, y, x + sw + Math.cos(a) * 0.05, y + Math.sin(a) * 0.05, c([70, 115, 50]), 0.008);
          }
        }
      },
    },
    {
      id: 'conifer', name: '침엽수', kind: 'life', icon: '🌲', habitat: ['land'], size: [10, 26], count: [5, 12], dist: [20, 180], w: 0.25, h: 1,
      when: (e) => e.habitat === 'land' && e.forests && atLeast(e.E, -300) && e.T > -8 && e.moist > 0.25 && (e.biome !== 'rainforest'),
      info: '바늘처럼 가는 잎과 솔방울을 가진 겉씨식물입니다. 약 3억 년 전에 나타나 공룡 시대 숲의 주인공이었고, 지금도 추운 북쪽 숲을 덮고 있습니다.',
      draw(ctx, t, i) {
        line(ctx, 0, 0, 0, -0.25, c([90, 65, 45]), 0.04);
        const sw = Math.sin(t * 0.5 + i.phase) * 0.008;
        for (let k = 0; k < 6; k++) {
          const y0 = -0.15 - k * 0.14;
          const w = 0.24 - k * 0.035;
          poly(ctx, [[-w, y0], [sw * k, y0 - 0.26], [w, y0]], lin(ctx, -w, 0, w, 0, [[0, c([30, 60, 40])], [0.45, c([50, 90, 55])], [1, c([22, 45, 30])]]));
        }
      },
    },
    {
      id: 'cycad', name: '소철', kind: 'life', icon: '🌴', habitat: ['land'], size: [1.5, 4], count: [3, 7], dist: [6, 60], w: 0.6, h: 1,
      when: (e) => e.habitat === 'land' && e.plants && atLeast(e.E, -280) && e.T > 10 && (e.E < -66 || e.dynasty === 'archosaur' || e.tropical),
      info: '굵은 줄기 끝에 깃털 같은 단단한 잎을 펼친 겉씨식물입니다. 공룡 시대에 아주 흔해서 "살아 있는 화석"이라 불리며, 지금도 열대 지방에 남아 있습니다.',
      draw(ctx, t, i) {
        ctx.beginPath();
        ctx.moveTo(-0.09, 0);
        ctx.lineTo(-0.07, -0.45);
        ctx.lineTo(0.07, -0.45);
        ctx.lineTo(0.09, 0);
        ctx.fillStyle = lin(ctx, -0.09, 0, 0.09, 0, [[0, c([90, 75, 55])], [0.5, c([130, 110, 80])], [1, c([70, 58, 42])]]);
        ctx.fill();
        for (let y = -0.03; y > -0.44; y -= 0.05) {
          line(ctx, -0.08, y, 0, y - 0.03, c([60, 50, 35], 0.6), 0.008);
          line(ctx, 0.08, y, 0, y - 0.03, c([60, 50, 35], 0.6), 0.008);
        }
        for (let k = 0; k < 9; k++) {
          const a = -1.35 + k * 0.34 + Math.sin(t * 0.7 + i.phase + k) * 0.03;
          const ex = Math.sin(a) * 0.55;
          const ey = -0.45 - Math.cos(a) * 0.45 + Math.abs(Math.sin(a)) * 0.15;
          const col = c([55, 100, 45]);
          curve(ctx, [[0, -0.45], [ex * 0.5, -0.45 - Math.cos(a) * 0.4], [ex, ey]], col, 0.02);
          for (let j = 2; j < 9; j++) {
            const u = j / 9;
            const px = ex * u;
            const py = -0.45 + (ey + 0.45) * u - Math.sin(Math.PI * u) * 0.1;
            line(ctx, px, py, px + 0.05, py + 0.06, col, 0.012);
            line(ctx, px, py, px - 0.05, py + 0.06, col, 0.012);
          }
        }
      },
    },
    {
      id: 'broadleaf', name: '활엽수', kind: 'life', icon: '🌳', habitat: ['land'], size: [8, 22], count: [5, 11], dist: [18, 170], w: 0.45, h: 1,
      when: (e) => e.habitat === 'land' && e.forests && atLeast(e.E, -100) && e.T > 0 && e.moist > 0.32,
      info: '넓은 잎을 가진 속씨식물(꽃 피는 식물) 나무입니다. 약 1억 년 전부터 빠르게 퍼져 지금은 지구 식물의 대부분을 차지합니다. 열매를 맺어 동물에게 먹이를 주고 씨앗을 퍼뜨립니다.',
      setup(i, rng) { i.blobs = []; for (let k = 0; k < 9; k++) i.blobs.push([(rng() - 0.5) * 0.6, -0.55 - rng() * 0.38, 0.14 + rng() * 0.1]); },
      draw(ctx, t, i, e) {
        line(ctx, 0, 0, 0, -0.5, c([85, 62, 45]), 0.06);
        line(ctx, 0, -0.38, -0.15, -0.6, c([85, 62, 45]), 0.03);
        line(ctx, 0, -0.42, 0.16, -0.62, c([85, 62, 45]), 0.03);
        const sw = Math.sin(t * 0.5 + i.phase) * 0.01;
        const base = e.T < 8 ? [130, 120, 50] : e.tropical ? [35, 85, 35] : [55, 100, 45];
        for (const [x, y, r] of i.blobs) ell(ctx, x + sw, y, r, r * 0.85, rad(ctx, x - r * 0.4 + sw, y - r * 0.4, r * 0.1, r * 1.1, [[0, c(base, 1, 1.35)], [1, c(base, 1, 0.65)]]));
      },
    },
    {
      id: 'palm', name: '야자나무', kind: 'life', icon: '🌴', habitat: ['land'], size: [8, 16], count: [3, 6], dist: [14, 120], w: 0.5, h: 1,
      when: (e) => e.habitat === 'land' && e.plants && atLeast(e.E, -90) && e.tropical && (e.coast || e.moist > 0.4),
      info: '줄기에 가지가 없고 꼭대기에만 커다란 잎이 모여 나는 열대 식물입니다. 공룡 시대 끝 무렵 처음 나타났고, 열매(코코넛)는 바다를 떠다니며 섬과 섬으로 퍼집니다.',
      draw(ctx, t, i) {
        curve(ctx, [[0, 0], [0.06, -0.4], [0.02, -0.7], [0.1, -0.92]], c([125, 100, 70]), 0.045);
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2 + Math.sin(t * 0.6 + i.phase) * 0.05;
          const ex = 0.1 + Math.cos(a) * 0.38;
          const ey = -0.92 + Math.abs(Math.sin(a)) * 0.05 + 0.18;
          curve(ctx, [[0.1, -0.92], [0.1 + Math.cos(a) * 0.2, -1.02], [ex, ey]], c([50, 105, 45]), 0.03);
          for (let j = 2; j < 8; j++) {
            const u = j / 8;
            const px = 0.1 + (ex - 0.1) * u;
            const py = -0.92 - Math.sin(Math.PI * u) * 0.09 + (ey + 0.92) * u * u;
            line(ctx, px, py, px + 0.02, py + 0.08, c([55, 115, 50]), 0.012);
          }
        }
      },
    },
    {
      id: 'grass', name: '풀', kind: 'life', icon: '🌾', habitat: ['land'], size: [0.25, 0.6], count: [10, 18], dist: [1.4, 12], w: 0.5, h: 1,
      when: (e) => e.habitat === 'land' && e.plants && atLeast(e.E, -30) && (e.biome === 'grassland' || e.biome === 'savanna' || e.biome === 'tundra' || e.biome === 'forest'),
      info: '풀(벼과 식물)은 생각보다 늦게, 공룡이 사라진 뒤에야 널리 퍼졌습니다. 잘려도 밑동에서 다시 자라기 때문에 초원과 그 초원을 뜯어 먹는 동물들이 함께 진화했습니다.',
      draw(ctx, t, i, e) {
        const col = e.biome === 'savanna' ? [170, 150, 80] : e.biome === 'tundra' ? [130, 125, 85] : [100, 140, 55];
        for (let k = 0; k < 11; k++) {
          const x = (k - 5) * 0.045;
          const sw = Math.sin(t * 1.4 + i.phase + k * 0.6) * 0.08;
          const h = 0.6 + ((k * 37) % 11) / 25;
          ctx.beginPath();
          ctx.moveTo(x - 0.02, 0);
          ctx.quadraticCurveTo(x + sw * 0.5, -h * 0.6, x + sw + (k - 5) * 0.03, -h);
          ctx.quadraticCurveTo(x + sw * 0.5 + 0.01, -h * 0.6, x + 0.02, 0);
          ctx.fillStyle = c(col, 1, 0.8 + (k % 3) * 0.12);
          ctx.fill();
        }
      },
    },

    /* ===== 육지의 동물 ===== */
    {
      id: 'dragonfly', name: '메가네우라 (거대 잠자리)', kind: 'life', icon: '🪰', habitat: ['air'], size: [0.5, 0.7], count: [1, 3], dist: [3, 15], w: 0.5, h: 0.3, fly: 'flit', alt: [1, 4], speed: 2,
      when: (e) => e.habitat === 'land' && e.forests && between(e.E, -320, -250),
      info: '석탄기의 날개폭 70cm짜리 잠자리 친척입니다. 대기 중 산소가 지금보다 많아(30% 이상) 곤충이 이렇게 클 수 있었다는 설명이 유력합니다.',
      draw(ctx, t, i) {
        const fl = Math.sin(t * 30 + i.phase);
        line(ctx, -0.45, -0.15, 0.1, -0.15, c([60, 90, 110]), 0.035);
        ell(ctx, 0.14, -0.15, 0.06, 0.04, c([50, 80, 95]));
        ell(ctx, 0.21, -0.16, 0.04, 0.035, c([90, 140, 120]));
        for (const [x, s] of [[0.1, 1], [0.0, 0.9]]) {
          ell(ctx, x - 0.05, -0.15 - 0.12 * fl, 0.25 * s, 0.05, 'rgba(220,235,255,0.35)', -0.15);
          ell(ctx, x - 0.05, -0.15 + 0.05 * fl, 0.24 * s, 0.045, 'rgba(220,235,255,0.25)', 0.15);
        }
      },
    },
    {
      id: 'amphibian', name: '초기 양서류', kind: 'life', icon: '🦎', habitat: ['land'], size: [1, 2], count: [1, 3], dist: [5, 25], w: 0.55, h: 0.25, walk: 0.25,
      when: (e) => e.habitat === 'land' && e.stage >= e.S.tetrapods && between(e.E, -375, -200) && (e.wet || e.coast),
      info: '물고기에서 진화해 처음으로 육지를 걸은 척추동물의 후손입니다. 납작하고 넓은 머리, 옆으로 벌린 다리를 가졌고, 알은 물속에 낳았습니다. 개구리·도롱뇽의 먼 친척입니다.',
      draw(ctx, t, i) {
        shadow(ctx, 0.45);
        const s = Math.sin(t * 4 + i.phase) * (i.moving ? 0.5 : 0);
        const col = c([95, 100, 60]);
        leg(ctx, 0.2, -0.1, 0.16, 0.6 + s, 0.05, col, -0.8);
        leg(ctx, -0.22, -0.1, 0.16, 0.6 - s, 0.05, col, -0.8);
        ctx.beginPath();
        ctx.moveTo(-0.55, -0.08);
        ctx.quadraticCurveTo(-0.3, -0.14, -0.1, -0.17);
        ctx.quadraticCurveTo(0.25, -0.2, 0.42, -0.14);
        ctx.quadraticCurveTo(0.5, -0.1, 0.42, -0.06);
        ctx.quadraticCurveTo(0, -0.04, -0.55, -0.08);
        ctx.fillStyle = lin(ctx, 0, -0.2, 0, -0.05, [[0, c([110, 115, 70])], [1, c([160, 150, 100])]]);
        ctx.fill();
        for (let k = 0; k < 5; k++) ell(ctx, -0.25 + k * 0.12, -0.15, 0.025, 0.015, c([60, 65, 35], 0.7));
        ell(ctx, 0.36, -0.15, 0.015, 0.015, c([20, 20, 15]));
        leg(ctx, 0.18, -0.1, 0.16, 0.4 - s, 0.05, col, -0.8);
        leg(ctx, -0.24, -0.1, 0.16, 0.4 + s, 0.05, col, -0.8);
      },
    },
    {
      id: 'dimetrodon', name: '디메트로돈', kind: 'life', icon: '🦎', habitat: ['land'], size: [2.2, 3.5], count: [1, 3], dist: [8, 40], w: 0.55, h: 0.55, walk: 0.4,
      when: (e) => e.habitat === 'land' && e.dynasty === 'synapsid' && atLeast(e.E, -300),
      info: '등에 커다란 돛을 단 페름기의 포식자입니다. 공룡처럼 보이지만 사실은 공룡보다 포유류에 더 가까운 "단궁류"로, 사람의 아주 먼 친척입니다. 돛은 체온 조절에 쓰였다는 설명이 있습니다.',
      draw(ctx, t, i) {
        shadow(ctx, 0.45);
        const s = Math.sin(t * 3.5 + i.phase) * (i.moving ? 0.45 : 0);
        const dark = c([110, 70, 50]);
        leg(ctx, 0.18, -0.12, 0.15, 0.5 + s, 0.04, dark, -0.6);
        leg(ctx, -0.18, -0.12, 0.15, 0.5 - s, 0.04, dark, -0.6);
        ctx.beginPath();
        ctx.moveTo(-0.22, -0.18);
        for (let k = 0; k <= 10; k++) {
          const x = -0.22 + k * 0.045;
          const y = -0.18 - Math.sin((k / 10) * Math.PI) * 0.33;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(0.23, -0.18);
        ctx.closePath();
        ctx.fillStyle = lin(ctx, 0, -0.5, 0, -0.18, [[0, c([190, 110, 70])], [1, c([150, 80, 55])]]);
        ctx.fill();
        for (let k = 0; k <= 10; k++) {
          const x = -0.22 + k * 0.045;
          line(ctx, x, -0.18, x, -0.18 - Math.sin((k / 10) * Math.PI) * 0.33, c([90, 50, 35], 0.8), 0.008);
        }
        ctx.beginPath();
        ctx.moveTo(-0.55, -0.1);
        ctx.quadraticCurveTo(-0.3, -0.16, -0.1, -0.2);
        ctx.quadraticCurveTo(0.25, -0.22, 0.38, -0.2);
        ctx.quadraticCurveTo(0.5, -0.17, 0.45, -0.12);
        ctx.quadraticCurveTo(0.1, -0.08, -0.55, -0.1);
        ctx.fillStyle = lin(ctx, 0, -0.22, 0, -0.08, [[0, c([140, 95, 65])], [1, c([180, 140, 100])]]);
        ctx.fill();
        line(ctx, 0.38, -0.14, 0.46, -0.13, c([240, 230, 210], 0.9), 0.006);
        ell(ctx, 0.37, -0.18, 0.012, 0.012, c([20, 15, 10]));
        leg(ctx, 0.16, -0.12, 0.15, 0.35 - s, 0.04, dark, -0.6);
        leg(ctx, -0.2, -0.12, 0.15, 0.35 + s, 0.04, dark, -0.6);
      },
    },
    {
      id: 'sauropod', name: '용각류 (목 긴 공룡)', kind: 'life', icon: '🦕', habitat: ['land'], size: [16, 26], count: [1, 3], dist: [40, 170], w: 0.55, h: 0.55, walk: 0.9,
      when: (e) => e.habitat === 'land' && e.dinos && e.dinoAge >= 30 && e.plants && e.biome !== 'desert',
      info: '브라키오사우루스, 아파토사우루스 같은 거대한 초식 공룡입니다. 긴 목으로 높은 나무의 잎을 먹었고, 몸길이 25m, 몸무게 50톤이 넘는 종도 있었습니다. 땅을 걸은 동물 가운데 가장 컸습니다.',
      draw(ctx, t, i) {
        shadow(ctx, 0.4);
        const s = Math.sin(t * 1.6 + i.phase) * (i.moving ? 0.25 : 0);
        const col = [115, 120, 95];
        const far = c(col, 1, 0.7);
        line(ctx, 0.12, -0.18, 0.12 + Math.sin(-s) * 0.04, 0, far, 0.06);
        line(ctx, -0.15, -0.18, -0.15 + Math.sin(s) * 0.04, 0, far, 0.065);
        ctx.beginPath();
        ctx.moveTo(-0.55, -0.12);
        ctx.quadraticCurveTo(-0.35, -0.2, -0.2, -0.26);
        ctx.quadraticCurveTo(0.0, -0.33, 0.18, -0.27);
        ctx.quadraticCurveTo(0.3, -0.35, 0.38, -0.5);
        ctx.quadraticCurveTo(0.42, -0.58, 0.5, -0.56);
        ctx.quadraticCurveTo(0.53, -0.53, 0.46, -0.5);
        ctx.quadraticCurveTo(0.36, -0.36, 0.25, -0.18);
        ctx.quadraticCurveTo(0.0, -0.12, -0.2, -0.17);
        ctx.quadraticCurveTo(-0.38, -0.13, -0.55, -0.12);
        ctx.fillStyle = lin(ctx, 0, -0.35, 0, -0.12, [[0, c(col, 1, 1.1)], [1, c(col, 1, 0.75)]]);
        ctx.fill();
        ell(ctx, 0.49, -0.55, 0.008, 0.008, c([15, 15, 10]));
        line(ctx, 0.15, -0.18, 0.15 + Math.sin(s) * 0.04, 0, c(col, 1, 0.9), 0.065);
        line(ctx, -0.12, -0.19, -0.12 + Math.sin(-s) * 0.04, 0, c(col, 1, 0.9), 0.07);
      },
    },
    {
      id: 'theropod', name: '수각류 (육식 공룡)', kind: 'life', icon: '🦖', habitat: ['land'], size: [4, 12], count: [1, 2], dist: [20, 110], w: 0.55, h: 0.55, walk: 1.2,
      when: (e) => e.habitat === 'land' && e.dinos,
      info: '두 발로 걷는 육식 공룡 무리로, 티라노사우루스와 벨로키랍토르가 여기에 속합니다. 새는 이 무리의 작은 깃털 공룡에서 진화했습니다. 즉, 새는 살아 있는 공룡입니다.',
      draw(ctx, t, i) {
        shadow(ctx, 0.35);
        const s = Math.sin(t * 3 + i.phase) * (i.moving ? 0.5 : 0);
        const col = [120, 95, 60];
        const legf = (sw, k) => {
          ctx.beginPath();
          ctx.moveTo(-0.02, -0.33);
          ctx.quadraticCurveTo(0.06 + sw * 0.1, -0.2, -0.02 + sw * 0.15, -0.1);
          ctx.lineTo(0.04 + sw * 0.2, 0);
          ctx.strokeStyle = c(col, 1, k);
          ctx.lineWidth = 0.05;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.stroke();
        };
        legf(-s, 0.7);
        ctx.beginPath();
        ctx.moveTo(-0.55, -0.42);
        ctx.quadraticCurveTo(-0.3, -0.42, -0.05, -0.43);
        ctx.quadraticCurveTo(0.15, -0.46, 0.25, -0.52);
        ctx.quadraticCurveTo(0.3, -0.6, 0.42, -0.6);
        ctx.quadraticCurveTo(0.52, -0.58, 0.52, -0.54);
        ctx.lineTo(0.38, -0.5);
        ctx.quadraticCurveTo(0.3, -0.48, 0.25, -0.42);
        ctx.quadraticCurveTo(0.1, -0.3, -0.08, -0.32);
        ctx.quadraticCurveTo(-0.3, -0.38, -0.55, -0.42);
        ctx.fillStyle = lin(ctx, 0, -0.6, 0, -0.3, [[0, c(col, 1, 1.05)], [1, c([175, 155, 115])]]);
        ctx.fill();
        for (let k = 0; k < 5; k++) line(ctx, -0.25 + k * 0.08, -0.43, -0.22 + k * 0.08, -0.37, c([80, 60, 35], 0.6), 0.012);
        line(ctx, 0.4, -0.52, 0.5, -0.53, c([240, 235, 220], 0.9), 0.006);
        ell(ctx, 0.41, -0.57, 0.01, 0.01, c([15, 10, 5]));
        line(ctx, 0.2, -0.42, 0.25, -0.37, c(col, 1, 0.8), 0.018);
        legf(s, 0.95);
      },
    },
    {
      id: 'ceratops', name: '뿔공룡', kind: 'life', icon: '🦏', habitat: ['land'], size: [5, 8], count: [1, 3], dist: [25, 100], w: 0.55, h: 0.45, walk: 0.7,
      when: (e) => e.habitat === 'land' && e.dinos && e.dinoAge >= 140 && e.plants,
      info: '트리케라톱스로 대표되는 초식 공룡입니다. 머리 뒤의 커다란 뼈 프릴과 뿔로 몸을 지키고 짝에게 뽐냈습니다. 공룡 시대가 끝나기 직전까지 무리 지어 살았습니다.',
      draw(ctx, t, i) {
        shadow(ctx, 0.42);
        const s = Math.sin(t * 2.4 + i.phase) * (i.moving ? 0.35 : 0);
        const col = [125, 110, 80];
        line(ctx, 0.15, -0.15, 0.15 + Math.sin(-s) * 0.05, 0, c(col, 1, 0.7), 0.07);
        line(ctx, -0.22, -0.15, -0.22 + Math.sin(s) * 0.05, 0, c(col, 1, 0.7), 0.07);
        ell(ctx, -0.05, -0.24, 0.35, 0.14, lin(ctx, 0, -0.38, 0, -0.1, [[0, c(col, 1, 1.1)], [1, c(col, 1, 0.75)]]));
        poly(ctx, [[-0.38, -0.25], [-0.58, -0.18], [-0.38, -0.18]], c(col));
        ell(ctx, 0.3, -0.36, 0.13, 0.17, lin(ctx, 0.2, -0.5, 0.4, -0.2, [[0, c([150, 120, 85])], [1, c([110, 90, 65])]]), -0.3);
        ell(ctx, 0.4, -0.25, 0.1, 0.07, c(col));
        poly(ctx, [[0.49, -0.24], [0.56, -0.22], [0.49, -0.19]], c([90, 80, 60]));
        line(ctx, 0.41, -0.3, 0.55, -0.42, c([235, 225, 200]), 0.022);
        line(ctx, 0.47, -0.27, 0.53, -0.3, c([235, 225, 200]), 0.015);
        ell(ctx, 0.4, -0.29, 0.01, 0.01, c([15, 10, 5]));
        line(ctx, 0.18, -0.15, 0.18 + Math.sin(s) * 0.05, 0, c(col, 1, 0.95), 0.075);
        line(ctx, -0.19, -0.15, -0.19 + Math.sin(-s) * 0.05, 0, c(col, 1, 0.95), 0.075);
      },
    },
    {
      id: 'pterosaur', name: '익룡', kind: 'life', icon: '🦅', habitat: ['air'], size: [3, 8], count: [1, 3], dist: [30, 160], w: 0.6, h: 0.4, fly: 'soar', alt: [25, 90], speed: 6,
      when: (e) => !e.under && e.dinos && e.habitat === 'land',
      info: '공룡과 같은 시대에 하늘을 지배한 날아다니는 파충류입니다. 넷째 손가락이 아주 길게 늘어나 날개막을 받쳤습니다. 공룡도 새도 아닌 별개의 무리이며, 날개폭 10m가 넘는 종도 있었습니다.',
      draw(ctx, t, i) {
        const f = Math.sin(t * 2.2 + i.phase) * 0.25;
        const col = c([130, 110, 95]);
        poly(ctx, [[-0.05, -0.2], [-0.55, -0.2 - f], [-0.1, -0.13]], c([160, 120, 100], 0.9));
        ell(ctx, 0, -0.17, 0.14, 0.04, col);
        poly(ctx, [[0.12, -0.19], [0.36, -0.17], [0.12, -0.15]], col);
        poly(ctx, [[0.13, -0.19], [0.06, -0.3], [0.1, -0.18]], c([180, 100, 80]));
        poly(ctx, [[0.0, -0.2], [0.55, -0.2 - f * 1.1], [0.05, -0.13]], c([175, 135, 110], 0.95));
      },
    },
    {
      id: 'bird', name: '새', kind: 'life', icon: '🐦', habitat: ['air'], size: [0.4, 1.2], count: [2, 5], dist: [15, 120], w: 0.5, h: 0.3, fly: 'soar', alt: [10, 60], speed: 7,
      when: (e) => !e.under && e.birds && e.habitat === 'land',
      info: '깃털 달린 작은 육식 공룡에서 진화한, 지금도 살아 있는 공룡입니다. 6600만 년 전 대멸종 때 다른 공룡은 모두 사라졌지만 일부 새는 살아남아 1만 종이 넘게 퍼졌습니다.',
      draw(ctx, t, i) {
        const f = Math.sin(t * 6 + i.phase);
        const col = c([60, 60, 65]);
        ctx.beginPath();
        ctx.moveTo(-0.5, -0.2 - f * 0.18);
        ctx.quadraticCurveTo(-0.2, -0.28 - f * 0.05, 0, -0.18);
        ctx.quadraticCurveTo(0.2, -0.28 - f * 0.05, 0.5, -0.2 - f * 0.18);
        ctx.quadraticCurveTo(0.2, -0.2, 0, -0.14);
        ctx.quadraticCurveTo(-0.2, -0.2, -0.5, -0.2 - f * 0.18);
        ctx.fillStyle = col;
        ctx.fill();
      },
    },
    {
      id: 'smallMammal', name: '초기 포유류', kind: 'life', icon: '🐁', habitat: ['land'], size: [0.12, 0.2], count: [1, 3], dist: [2, 9], w: 0.5, h: 0.4, walk: 0.3,
      when: (e) => e.habitat === 'land' && e.mammalsOrigin && e.dynasty !== 'mammal' && e.plants,
      info: '공룡 시대 내내 몸집이 쥐만 했던 최초의 포유류입니다. 털로 체온을 유지하며 주로 밤에 움직여 공룡을 피했습니다. 공룡이 사라지자 이들의 후손이 지구 곳곳을 차지했습니다.',
      draw(ctx, t, i) {
        shadow(ctx, 0.35);
        const s = Math.sin(t * 14 + i.phase) * (i.moving ? 0.6 : 0);
        const col = c([105, 80, 60]);
        leg(ctx, 0.15, -0.12, 0.12, 0.3 + s, 0.05, col);
        leg(ctx, -0.18, -0.12, 0.12, 0.3 - s, 0.05, col);
        curve(ctx, [[-0.3, -0.18], [-0.45, -0.25], [-0.55, -0.12]], col, 0.025);
        ell(ctx, -0.02, -0.2, 0.28, 0.13, lin(ctx, 0, -0.33, 0, -0.07, [[0, c([120, 92, 70])], [1, c([175, 150, 125])]]));
        ell(ctx, 0.27, -0.24, 0.12, 0.08, c([115, 90, 68]));
        ell(ctx, 0.22, -0.33, 0.04, 0.05, c([150, 110, 100]));
        ell(ctx, 0.31, -0.26, 0.014, 0.014, c([10, 8, 5]));
        ell(ctx, 0.39, -0.23, 0.015, 0.012, c([60, 40, 40]));
      },
    },
    {
      id: 'deer', name: '사슴', kind: 'life', icon: '🦌', habitat: ['land'], size: [1.2, 1.8], count: [1, 4], dist: [12, 70], w: 0.5, h: 1, walk: 0.8,
      when: (e) => e.habitat === 'land' && e.dynasty === 'mammal' && e.mammalAge >= 30 && e.plants && e.T > -6 && e.biome !== 'desert',
      info: '공룡이 사라진 뒤 다양해진 발굽 포유류입니다. 수컷의 뿔은 해마다 떨어졌다가 다시 자랍니다. 풀과 나뭇잎을 먹는 초식 동물이 늘어나면서 초원과 숲의 모습도 함께 바뀌었습니다.',
      draw(ctx, t, i) {
        shadow(ctx, 0.3);
        const s = Math.sin(t * 4 + i.phase) * (i.moving ? 0.4 : 0);
        const col = [140, 100, 65];
        const lg2 = (x, a, k) => line(ctx, x, -0.48, x + Math.sin(a) * 0.08, 0, c(col, 1, k), 0.035);
        lg2(0.18, -s, 0.7);
        lg2(-0.2, s, 0.7);
        ell(ctx, 0, -0.55, 0.27, 0.12, lin(ctx, 0, -0.67, 0, -0.43, [[0, c(col, 1, 1.05)], [1, c([195, 170, 135])]]));
        ell(ctx, -0.27, -0.6, 0.04, 0.03, c([235, 230, 220]));
        line(ctx, 0.22, -0.6, 0.32, -0.82, c(col), 0.07);
        ell(ctx, 0.36, -0.84, 0.09, 0.05, c(col, 1, 1.05), 0.3);
        ell(ctx, 0.31, -0.92, 0.025, 0.05, c(col), -0.4);
        ell(ctx, 0.37, -0.86, 0.01, 0.01, c([10, 8, 5]));
        line(ctx, 0.32, -0.9, 0.26, -1.05, c([200, 180, 150]), 0.015);
        line(ctx, 0.28, -1.0, 0.2, -1.04, c([200, 180, 150]), 0.012);
        line(ctx, 0.35, -0.9, 0.4, -1.04, c([200, 180, 150]), 0.015);
        lg2(0.21, s, 0.95);
        lg2(-0.17, -s, 0.95);
      },
    },
    {
      id: 'mammoth', name: '매머드', kind: 'life', icon: '🦣', habitat: ['land'], size: [3, 4], count: [1, 3], dist: [25, 90], w: 0.55, h: 0.9, walk: 0.7,
      when: (e) => e.habitat === 'land' && e.dynasty === 'mammal' && e.mammalAge >= 61 && e.T < 9 && !e.civModern,
      info: '빙하기의 추운 초원을 누빈, 긴 털로 덮인 코끼리 친척입니다. 마지막 무리는 약 4천 년 전까지 북극해의 섬에 살았습니다. 얼어붙은 땅에서 거의 온전한 몸이 발견되기도 합니다.',
      draw(ctx, t, i) {
        shadow(ctx, 0.4);
        const s = Math.sin(t * 2 + i.phase) * (i.moving ? 0.3 : 0);
        const col = [95, 65, 45];
        const lg2 = (x, a, k) => line(ctx, x, -0.4, x + Math.sin(a) * 0.06, 0, c(col, 1, k), 0.11);
        lg2(0.15, -s, 0.7);
        lg2(-0.18, s, 0.7);
        ell(ctx, 0, -0.5, 0.36, 0.25, lin(ctx, 0, -0.75, 0, -0.25, [[0, c(col, 1, 1.1)], [1, c(col, 1, 0.75)]]));
        ell(ctx, 0.3, -0.68, 0.15, 0.17, c(col, 1, 1.05));
        for (let k = 0; k < 14; k++) line(ctx, -0.3 + k * 0.045, -0.4, -0.31 + k * 0.045, -0.27, c([70, 45, 30], 0.7), 0.012);
        curve(ctx, [[0.4, -0.62], [0.52, -0.5], [0.5, -0.25], [0.45, -0.15]], c(col, 1, 0.95), 0.06);
        curve(ctx, [[0.36, -0.55], [0.6, -0.5], [0.66, -0.7], [0.55, -0.8]], c([235, 225, 200]), 0.035);
        ell(ctx, 0.34, -0.72, 0.012, 0.012, c([10, 8, 5]));
        lg2(0.18, s, 0.95);
        lg2(-0.15, -s, 0.95);
      },
    },
    {
      id: 'human', name: '사람 (호모 사피엔스)', kind: 'life', icon: '🧍', habitat: ['land'], size: [1.6, 1.8], count: [1, 4], dist: [8, 45], w: 0.25, h: 1, walk: 1.1,
      when: (e) => e.habitat === 'land' && e.humans && !e.ice,
      info: '약 30만 년 전 아프리카에서 나타난 현생 인류입니다. 불과 도구와 말을 쓰며 무리 지어 사냥하고 채집하다가, 약 1만 2천 년 전부터 농사를 짓고 마을을 세우기 시작했습니다.',
      setup(i, rng, e) { i.cloth = e.civ ? [[150, 80, 60], [70, 90, 130], [180, 160, 110]][Math.floor(rng() * 3)] : [140, 110, 80]; },
      draw(ctx, t, i, e) {
        shadow(ctx, 0.16);
        const s = Math.sin(t * 5 + i.phase) * (i.moving ? 0.4 : 0);
        const skin = [170, 125, 95];
        line(ctx, 0, -0.5, Math.sin(-s) * 0.12, 0, c([60, 50, 45], 1, 0.75), 0.07);
        line(ctx, 0, -0.75, Math.sin(s) * 0.12 - 0.02, -0.45, c(skin, 1, 0.8), 0.05);
        poly(ctx, [[-0.08, -0.85], [0.08, -0.85], [0.1, -0.45], [-0.1, -0.45]], c(i.cloth));
        line(ctx, 0, -0.5, Math.sin(s) * 0.12, 0, c([60, 50, 45]), 0.07);
        ell(ctx, 0.01, -0.94, 0.07, 0.08, c(skin));
        ell(ctx, -0.01, -0.99, 0.07, 0.045, c([40, 30, 25]));
        line(ctx, 0, -0.75, Math.sin(-s) * 0.12 + 0.03, -0.45, c(skin), 0.05);
        if (!e.civ) line(ctx, 0.12, -1.1, 0.06, -0.1, c([120, 100, 70]), 0.025);
      },
    },
    {
      id: 'hut', name: '움집과 마을', kind: 'thing', icon: '🛖', habitat: ['land'], size: [3, 5], count: [2, 4], dist: [25, 90], w: 0.6, h: 1,
      when: (e) => e.habitat === 'land' && e.civ && !e.civModern && !e.ice,
      info: '농사를 지으며 한곳에 머물게 된 사람들이 지은 집입니다. 나무 기둥 위에 풀이나 갈대를 덮었습니다. 정착 생활은 곡식 저장, 인구 증가, 도시와 문자로 이어졌습니다.',
      draw(ctx, t, i) {
        shadow(ctx, 0.6);
        poly(ctx, [[-0.45, 0], [-0.45, -0.35], [0.45, -0.35], [0.45, 0]], lin(ctx, -0.45, 0, 0.45, 0, [[0, c([120, 95, 65])], [1, c([90, 70, 48])]]));
        poly(ctx, [[-0.6, -0.33], [0, -1], [0.6, -0.33]], lin(ctx, -0.5, -1, 0.5, -0.3, [[0, c([190, 160, 95])], [1, c([130, 105, 60])]]));
        for (let k = 0; k < 8; k++) line(ctx, -0.55 + k * 0.15, -0.36, -0.02 + k * 0.01, -0.95, c([110, 85, 45], 0.5), 0.01);
        poly(ctx, [[-0.1, 0], [-0.1, -0.24], [0.1, -0.24], [0.1, 0]], c([40, 30, 20]));
        for (let k = 0; k < 4; k++) {
          const f = (t * 0.15 + k / 4) % 1;
          ell(ctx, 0.05 + f * 0.2, -1.05 - f * 0.7, 0.06 + f * 0.15, 0.05 + f * 0.1, `rgba(200,200,205,${0.35 * (1 - f)})`);
        }
      },
    },
    {
      id: 'city', name: '도시', kind: 'thing', icon: '🏙️', habitat: ['land'], size: [80, 160], count: [1, 1], dist: [1500, 3200], w: 2, h: 1,
      when: (e) => e.habitat === 'land' && e.civModern && !e.ice,
      info: '오늘날 인류의 절반 이상이 도시에 삽니다. 도시는 밤에도 불을 밝혀 우주에서도 보이고, 지구의 기후와 생태계를 바꿀 만큼 큰 영향을 주고 있습니다.',
      setup(i, rng) { i.bld = []; let x = -2; while (x < 2) { const w = 0.1 + rng() * 0.18; i.bld.push([x, w, 0.25 + rng() * 0.75]); x += w + 0.02; } },
      draw(ctx, t, i, e) {
        const night = e.night;
        for (const [x, w, h] of i.bld) {
          poly(ctx, [[x, 0], [x, -h], [x + w, -h], [x + w, 0]], lin(ctx, x, -h, x + w, 0, [[0, c([120, 130, 145])], [1, c([70, 78, 92])]]));
          if (night > 0.2) {
            for (let yy = -0.05; yy > -h + 0.04; yy -= 0.06) {
              for (let xx = x + 0.025; xx < x + w - 0.02; xx += 0.045) {
                if (((xx * 97 + yy * 53) % 1 + 1) % 1 > 0.45) ell(ctx, xx, yy, 0.012, 0.015, `rgba(255,220,140,${night})`);
              }
            }
          }
        }
      },
    },
  ];

  /* 땅 모양·하늘처럼 그림이 따로 없는 "주변의 것들" (도감 목록에만 나옴) */
  const FEATURES = [
    { id: 'water', name: '바닷물', icon: '🌊', when: (e) => e.under || e.coast, info: '지구 표면의 70%를 덮은 짠물입니다. 약 44억 년 전 수증기가 비가 되어 내리며 생겼고, 생명은 바다에서 시작했습니다. 짠맛은 강물이 오랫동안 바위에서 녹여 온 소금 때문입니다.' },
    { id: 'sand', name: '모래', icon: '⏳', when: (e) => e.biome === 'desert' || e.coast, info: '바위가 바람과 물에 오랫동안 깎여 생긴 작은 알갱이입니다. 대부분 단단한 석영으로 되어 있어 끝까지 남습니다.' },
    { id: 'ice', name: '얼음', icon: '🧊', when: (e) => e.ice || e.snow || e.biome === 'tundra', info: '물이 얼어 생긴 고체입니다. 하얀 얼음은 햇빛을 되비춰 지구를 더 춥게 만듭니다. 그래서 얼음이 넓어지면 더 추워지고, 더 추워지면 얼음이 더 넓어지는 되먹임이 일어납니다.' },
    { id: 'lava', name: '용암', icon: '🔥', when: (e) => e.lava, info: '1000°C가 넘게 녹은 암석입니다. 식으면 검은 현무암이 되어 새로운 땅을 만듭니다. 어린 지구의 표면 전체가 한때 용암 바다였습니다.' },
    { id: 'mat', name: '미생물 매트', icon: '🦠', when: (e) => e.alive && e.stage >= e.S.microbe && e.stage < e.S.landPlants && (e.coast || e.under), info: '눈에 보이지 않는 세균들이 수십억 마리씩 모여 만든 얇은 막입니다. 식물이 나타나기 전 수십억 년 동안, 물가와 얕은 바다의 바닥을 덮은 것은 이런 미생물 막뿐이었습니다.' },
    { id: 'clouds', name: '구름', icon: '☁️', when: (e) => e.cloud > 0.15 && !e.under, info: '공기 속 수증기가 아주 작은 물방울이나 얼음 알갱이로 맺혀 떠 있는 것입니다. 구름은 햇빛을 가려 지구를 식히기도 하고, 열을 붙잡아 데우기도 합니다.' },
    { id: 'sun', name: '태양', icon: '☀️', when: (e) => !e.under && e.sunUp, info: '지구 생명의 에너지는 거의 모두 태양에서 옵니다. 태양은 1억 년마다 약 1%씩 밝아지고 있어서, 45억 년 전에는 지금보다 30% 정도 어두웠습니다.' },
    { id: 'moon', name: '달', icon: '🌙', when: (e) => !e.under && e.moon, info: '약 45억 년 전 거대 충돌로 생긴 지구의 위성입니다. 처음에는 지금보다 열 배 넘게 가까워 하늘에서 훨씬 크게 보였고, 해마다 약 3.8cm씩 멀어지고 있습니다.' },
    { id: 'mountain', name: '산', icon: '⛰️', when: (e) => e.mountain, info: '판과 판이 부딪치며 땅이 구겨지고 솟아올라 생깁니다. 히말라야는 인도가 아시아와 부딪쳐 생긴 산맥으로, 지금도 해마다 몇 mm씩 높아지고 있습니다.' },
  ];

  EC.field.SPECIES = SPECIES;
  EC.field.FEATURES = FEATURES;
  EC.field.G = G;
})();
