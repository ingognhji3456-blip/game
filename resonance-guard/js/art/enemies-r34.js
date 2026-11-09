'use strict';

/* 적 그림 — 3지역 잿빛 사막 · 4지역 폭풍 해안 (공용 도구: enemies.js) */
(() => {
  const { H, OL, sh, GREY, GREY_L, MISTC, HALO, GREEN, ICE, ICE_L, EMBER, EMBER_L, VOLT, SEA, BELL, GOLD, BRONZE, make, g, zig } = RG.art._en;
  const D = RG.art._en.D;

  /* =========================================================
   * 3지역 · 붉은 협곡
   * ========================================================= */
  D.cinder_lizard = (f) => {
    const c = make(3.5);
    const red = '#ab5a50';
    const redD = sh(red, -0.35);
    const s = f ? -1 : 1;
    const lleg = (x, y, dx, col) => c.limb(`M${x} ${y}L${x + dx * 0.5} ${y + 4}L${x + dx} 83.25`, 6.5, col);
    let spikes = '';
    [[32, 63], [40, 58], [48, 55], [56, 54], [64, 53], [72, 51]].forEach(([x, y], i) => {
      const h = i % 2 ? 10 : 14;
      spikes += c.P(`M${x - 4} ${y + 3}Q${x - 4} ${y - h * 0.5} ${x - 1} ${y - h}Q${x + 1} ${y - h * 0.4} ${x + 4} ${y + 2}Z`, c.lin([[0, EMBER_L], [1, EMBER]]));
    });
    return c.out(
      lleg(40, 74, -8 * s, redD) + lleg(70, 72, 8 * s, redD) +
      g(
        spikes +
        c.P('M5 46C8 62 17 67 27 65C37 57 50 53 62 54C68 49 76 47 84 48C92 49 97 55 96 62C95 68 89 71 82 71L72 73C64 79 50 81 36 79C25 78 12 68 5 46Z', c.body(red, 0.35)) +
        c.Pn('M30 76C42 79 60 78 70 74C62 79 44 81 30 76Z', EMBER_L, 0.6) +
        c.En(46, 70, 3, 2, redD, 0.7) + c.En(56, 67, 2.4, 1.6, redD, 0.7) + c.En(26, 72, 2.4, 1.6, redD, 0.7) +
        c.eye(83, 57, 3.6) + c.L('M86 66L95 64', OL, 1.8) +
        c.spark(f ? 44 : 52, f ? 38 : 36, 1.8, EMBER) + c.spark(f ? 60 : 38, f ? 34 : 42, 1.4, EMBER) + c.spark(f ? 30 : 66, f ? 44 : 32, 1.2, EMBER_L) +
        c.shine(48, 64, 8, 2.5, 0.4, -8),
        f ? 'translate(0 -1)' : ''
      ) +
      lleg(34, 76, 8 * s, red) + lleg(74, 73, -8 * s, red)
    );
  };

  D.sand_burrower = (f) => {
    const c = make(3);
    const shell = '#b39a7a';
    const sand = '#d9bb84';
    const hx = 61;
    const hy = f ? 36 : 33;
    const segs = [];
    for (let i = 0; i < 6; i++) {
      const t = i / 6;
      const x = 30 + t * 27 - Math.sin(t * Math.PI) * 6;
      const y = 80 - t * (80 - hy - 6) - Math.sin(t * Math.PI) * 6;
      segs.push(c.E(H.n(x), H.n(y), H.n(14 - t * 2), H.n(12.5 - t * 1.5), c.body(i % 2 ? shell : sh(shell, -0.08), 0.3)));
    }
    const jaw = (a) => g(c.P('M0 0C9-5 18-3 21 6C16 2 10 2 2 6Z', c.lin([[0, '#efe3c8'], [1, '#8a7258']])), `translate(${hx + 9} ${hy + 5}) rotate(${a}) scale(1.1)`);
    const jawB = (a) => g(c.P('M0 0C9 5 18 3 21-6C16-2 10-2 2-6Z', c.lin([[0, '#8a7258'], [1, '#efe3c8']])), `translate(${hx + 9} ${hy + 8}) rotate(${a}) scale(1.1)`);
    return c.out('<g transform="translate(5 0)">' +
      segs.join('') +
      c.L('M30 66l-6 4M40 58l-6 2M48 48l-6 0', OL, 2.5) +
      jaw(f ? -4 : -18) + jawB(f ? 4 : 18) +
      c.E(hx, hy, 15, 13, c.body(sh(shell, 0.05), 0.35)) +
      c.P(`M${hx - 12} ${hy - 4}C${hx - 6} ${hy - 14} ${hx + 8} ${hy - 14} ${hx + 13} ${hy - 4}C${hx + 4} ${hy - 7} ${hx - 4} ${hy - 7} ${hx - 12} ${hy - 4}Z`, sh(shell, -0.25)) +
      c.eye(hx + 4, hy, 2.8) + c.eye(hx + 11, hy + 1, 2.4) +
      c.P('M6 88.5C10 78 24 72 38 73C52 74 60 80 66 88.5Z', c.body(sand, 0.3, -0.25)) +
      c.En(22, 82, 2, 1.2, sh(sand, -0.3)) + c.En(40, 79, 2, 1.2, sh(sand, -0.3)) + c.En(52, 84, 1.6, 1, sh(sand, -0.3)) +
      c.mist(f ? [[44, 64, 1.6], [56, 54, 1.3], [64, 72, 1.5]] : [[46, 60, 1.4], [58, 58, 1.6], [62, 68, 1.2]], sand, 1) +
      c.shine(hx - 6, hy - 4, 4, 2, 0.4) + '</g>'
    );
  };

  D.magma_brute = (f) => {
    const c = make(3);
    const rock = '#5b5360';
    const rockD = sh(rock, -0.3);
    const s = f ? -1 : 1;
    const crack = (d, w = 2.4) => `<path d="${d}" fill="none" stroke="${EMBER}" stroke-width="${w * 2.6}" opacity=".55" ${c.soft()}/>` + c.L(d, EMBER_L, w);
    return c.out(
      c.limb(`M30 36Q20 48 ${18 - 3 * s} 60`, 13, rockD) + c.E(16 - 3 * s, 66, 10, 9, rockD) + crack(`M${12 - 3 * s} 64l4 3l3-2`, 1.6) +
      c.leg(40, 68, -4 * s, 13, rockD) +
      g(
        c.P('M22 34C26 20 44 14 58 15C74 16 84 26 82 40C80 56 72 70 56 72L40 72C28 68 20 52 22 34Z', c.body(rock, 0.32, -0.4)) +
        crack('M34 28L40 38L35 48L43 58L40 66') + crack('M60 26L55 35L62 43L57 53') + crack('M72 46L65 55L71 63') + crack('M26 46L31 50', 1.8) +
        c.P('M54 22C54 12 62 8 70 9C78 11 81 20 78 27C73 32 61 32 56 28Z', c.body(rock, 0.3)) +
        c.P('M60 17L78 16L77 22L60 22Z', '#241b2c') +
        c.eye(66, 19.5, 2.2, false) + c.eye(73, 19, 2, false) +
        crack('M64 27L74 26', 1.8),
        f ? 'translate(0 -1)' : ''
      ) +
      c.leg(60, 68, 4 * s, 13, rock) +
      c.limb(`M72 34Q86 46 ${84 + 3 * s} 58`, 14, rock) + c.E(85 + 3 * s, 64, 11, 10, c.body(rock, 0.3)) +
      crack(`M${80 + 3 * s} 60l5 4l5-3M${86 + 3 * s} 64l-1 6`, 1.8) +
      c.spark(85 + 3 * s, f ? 82 : 78, 1.6, EMBER)
    );
  };

  D.thermal_vulture = (f) => {
    const c = make(3);
    const body = '#6a5c5a';
    const wing = 'M0 0C-12-14-30-18-46-14C-42-10-49-6-44-2C-50 1-46 5-41 6C-46 10-40 13-33 12C-35 16-27 17-21 14C-13 12-6 8 0 0Z';
    const wf = c.lin([[0, '#ffe08a'], [0.3, EMBER], [0.65, '#7a4a40'], [1, '#5a4a4a']], 'h');
    const wfD = c.lin([[0, '#e8a050'], [0.3, '#c0502e'], [0.65, '#5a3a36'], [1, '#463a3c']], 'h');
    const wingG = (a, fill, sc) => g(c.P(wing, fill), `translate(48 50) rotate(${a}) scale(${sc})`);
    const bob = f ? 3 : -1;
    return c.out(
      g(
        wingG(f ? -14 : 80, wfD, 0.82) +
        c.P('M28 58L8 52L13 58L7 64L14 66L10 72L30 66Z', c.lin([[0, EMBER], [1, '#5a4a4a']], 'h')) +
        c.P('M22 60C28 48 42 44 56 45C66 46 72 50 74 56C70 64 60 67 50 67C38 68 28 66 22 60Z', c.body(body, 0.3)) +
        c.P('M60 48C66 42 74 42 78 46C76 52 70 56 62 56Z', '#efeaf0') +
        c.limb('M72 48Q78 40 80 34', 6, '#c9b4b0') +
        c.E(83, 32, 8.5, 7, c.body('#cbb6b2', 0.3)) +
        c.P('M89 28C95 28 98 32 96 38C95 35 93 34 90 35Z', '#e4d8bc') +
        c.eye(84, 30, 2.8) +
        wingG(f ? -42 : 46, wf, 1),
        `translate(0 ${bob})`
      )
    );
  };

  D.dune_raider = (f) => {
    const c = make(3);
    const cloth = '#cfae7a';
    const grey = '#8a8698';
    const s = f ? -1 : 1;
    const blade = 'M0 0C8-4 16-14 18-28C13-20 6-11-3-5Z';
    return c.out(
      g(
        c.leg(46, 62, -12 * s, 8, sh(grey, -0.3), 0, 4 * s) +
        c.P(f ? 'M42 22C32 22 24 18 16 22C24 24 22 28 18 32C28 28 36 30 44 28Z' : 'M42 22C32 24 24 24 16 30C24 30 23 33 21 37C30 31 37 31 44 28Z', c.body(cloth, 0.2)) +
        c.limb(`M44 40Q36 48 ${30 + 4 * s} 54`, 7, sh(grey, -0.3)) +
        c.P('M38 38C42 32 58 32 62 38L62 60L36 60Z', c.body(grey, 0.3)) +
        c.P('M36 52L62 52L66 66L56 63L50 68L44 63L34 66Z', c.body(sh(cloth, -0.15), 0.3)) +
        c.P('M38 40L62 48L62 54L38 46Z', '#a3463a') +
        c.P('M42 14C46 6 60 5 66 12C70 18 70 28 66 34L46 34C40 28 38 20 42 14Z', c.body(cloth, 0.35)) +
        c.P('M54 17L69 17L69 23L54 23Z', '#241b2c') +
        c.eye(60, 20, 2.2, false) + c.eye(66, 20, 2, false) +
        c.P('M53 23L70 23C70 29 66 33 60 34L52 34Z', sh(cloth, -0.12)) +
        c.leg(54, 62, 12 * s, 8, grey, 0, 4 * s) +
        g(c.P(blade, c.lin([[0, '#f2f0f6'], [1, '#8a8a9c']])) + c.P('M-4-1L4 4L2 7L-6 2Z', GOLD), `translate(74 44) rotate(${f ? 10 : -6})`) +
        c.limb('M58 40Q66 46 72 45', 7, grey) + c.E(73, 45, 3.6, 3.6, sh(grey, -0.2)),
        'rotate(6 50 90)'
      )
    );
  };

  D.obsidian_beetle = (f) => {
    const c = make(3);
    const obs = '#2e2838';
    const s = f ? 1 : -1;
    const bleg = (x, dx, col, ph) => {
      const d = (ph ? s : -s) * 4;
      return c.limb(`M${x} 66L${x + dx + d} 72L${x + dx * 1.4 + d} 84`, 4.5, col);
    };
    return c.out(
      bleg(34, -6, '#1c1726', 0) + bleg(52, 2, '#1c1726', 1) + bleg(68, 8, '#1c1726', 0) +
      c.P('M72 52C80 48 90 52 93 60C95 66 90 72 82 71L72 68Z', c.body('#3c3446', 0.4)) +
      c.P('M84 54C86 44 90 37 96 32C95 41 93 48 92 56Z', c.lin([[0, '#6a5a80'], [1, '#2a2434']])) +
      c.eye(86, 61, 2.8) +
      `<path d="M18 68C30 74 70 74 80 68" fill="none" stroke="${EMBER}" stroke-width="5" opacity=".6" ${c.soft()}/>` +
      c.P('M14 66C14 44 30 30 50 30C68 30 82 42 82 60L82 66C70 72 26 72 14 66Z', c.body(obs, 0.5, -0.3)) +
      c.Pn('M22 54L30 38L44 33L36 48Z', '#d9ccff', 0.55) + c.Pn('M50 33L64 36L56 46Z', '#d9ccff', 0.35) + c.Pn('M70 48L78 56L72 62Z', '#d9ccff', 0.25) +
      c.L('M48 31C48 44 50 56 52 70', '#6a5a80', 2) +
      c.L('M14 66C26 72 70 72 82 66', EMBER, 1.6) +
      bleg(38, -7, '#4a4058', 1) + bleg(56, 2, '#4a4058', 0) + bleg(72, 9, '#4a4058', 1)
    );
  };

  D.flame_spirit = (f) => {
    const c = make(3);
    const outer = f
      ? 'M52 84C32 84 22 70 26 56C28 48 34 44 32 32C40 38 42 42 42 46C44 34 40 22 30 12C46 16 56 28 58 40C62 36 62 30 60 24C72 32 80 48 76 64C72 78 64 84 52 84Z'
      : 'M52 84C32 84 22 70 25 56C27 47 31 42 26 30C36 36 40 41 41 46C43 32 44 20 38 8C52 16 58 30 58 40C63 37 66 32 66 26C76 36 80 50 76 64C72 78 64 84 52 84Z';
    const inner = f
      ? 'M52 78C40 78 34 70 36 60C38 52 44 48 46 40C50 46 52 50 52 54C56 50 58 46 58 42C66 50 68 62 64 70C62 76 58 78 52 78Z'
      : 'M52 78C40 78 34 70 36 60C38 52 42 48 42 40C48 44 52 50 52 54C57 50 59 46 60 40C67 50 68 62 64 70C62 76 58 78 52 78Z';
    return c.out(
      `<ellipse cx="52" cy="58" rx="28" ry="28" fill="${EMBER}" opacity=".45" stroke="none" ${c.soft()}/>` +
      c.mist(f ? [[30, 12, 3.5], [24, 6, 2.5]] : [[37, 8, 3.5], [30, 4, 2.4]], '#b9b4c6', 0.8) +
      c.P(outer, c.lin([[0, '#ffb35a'], [0.5, EMBER], [1, '#c8402a']])) +
      c.P(inner, c.lin([[0, '#fff3b0'], [1, '#ffc24a']]), ' stroke="none"') +
      c.E(53, 64, 4.6, 5.6, '#3a2230') + c.E(65, 63, 4.2, 5.2, '#3a2230') +
      c.eye(53.5, 64, 2.4, false) + c.eye(65.5, 63, 2.2, false)
    );
  };

  D.canyon_slinger = (f) => {
    const c = make(3);
    const cloth = '#c9a272';
    const grey = '#8a8698';
    const s = f ? -1 : 1;
    const stone = f ? [46, 9] : [90, 13];
    return c.out(
      c.leg(44, 66, -6 * s, 8, sh(grey, -0.3)) + c.foot(44 - 6 * s + 2, 5.5, 3, '#5a4a48') +
      g(
        c.limb(`M42 46Q34 54 ${36 + 3 * s} 60`, 7, sh(grey, -0.3)) +
        c.P('M38 44C40 38 58 38 62 44L64 68L36 68Z', c.body(grey, 0.3)) +
        c.P('M34 46C40 40 60 40 66 46L62 62L56 58L50 64L44 58L38 62Z', c.body(cloth, 0.3)) +
        c.E(42, 64, 5, 4.5, c.body('#8a6a48', 0.3)) +
        c.P(f ? 'M42 20C34 20 28 16 22 20C28 22 26 26 24 28C32 26 38 26 42 24Z' : 'M42 20C34 22 28 22 22 28C28 28 28 31 26 34C33 29 38 28 42 24Z', '#a3463a') +
        c.E(54, 28, 14, 13, c.body(grey, 0.35)) +
        c.P('M40 24C42 14 64 12 68 22C60 20 48 20 40 24Z', '#a3463a') +
        c.P('M56 23L69 23L69 30L56 30Z', '#2b2236') +
        c.eye(61, 26.5, 2.4, false) + c.eye(67, 26.5, 2.1, false) +
        c.L('M58 35q4 2 7 0', OL, 1.6),
        f ? 'translate(0 -1)' : ''
      ) +
      c.leg(56, 66, 6 * s, 8, grey) + c.foot(56 + 6 * s + 2, 5.5, 3, '#5a4a48') +
      `<ellipse cx="68" cy="12" rx="23" ry="6.5" fill="none" stroke="#fff" stroke-width="2.2" stroke-dasharray="4 5" opacity=".65"/>` +
      c.L(`M76 21L${stone[0]} ${stone[1]}`, '#6a4a30', 2) +
      c.limb('M60 46Q74 42 76 24', 6.5, grey) + c.E(76, 22, 3.6, 3.6, sh(grey, -0.2)) +
      c.E(stone[0], stone[1], 4.5, 4, c.body('#9a8a80', 0.35))
    );
  };

  D.pyre_worm = (f) => {
    const c = make(3);
    const rock = '#4e4552';
    const lava = EMBER;
    const bez = (t, a, b, cc, d) => (1 - t) ** 3 * a + 3 * (1 - t) ** 2 * t * b + 3 * (1 - t) * t * t * cc + t ** 3 * d;
    const hx = f ? 61 : 60;
    const hy = f ? 35 : 32;
    let segs = '';
    const N = 7;
    const plate = c.body(rock, 0.35, -0.35);
    for (let i = 0; i < N; i++) {
      const t = i / N;
      const x = H.n(bez(t, 32, 12, 30, hx - 8));
      const y = H.n(bez(t, 84, 48, 12, hy + 6));
      const r = H.n(17 - t * 4);
      segs += c.E(x + 2, y + 2, r + 1.5, r + 1.5, lava) + c.E(x, y, r, r - 0.5, plate) +
        c.L(`M${H.n(x - r * 0.5)} ${H.n(y - r * 0.55)}l${H.n(r * 0.3)} ${H.n(r * 0.3)}`, sh(rock, -0.35), 2);
    }
    const crack = (d, w = 2) => `<path d="${d}" fill="none" stroke="${lava}" stroke-width="${w * 2.6}" opacity=".55" ${c.soft()}/>` + c.L(d, EMBER_L, w);
    const jaw = f ? 9 : 5;
    return c.out(
      `<ellipse cx="34" cy="86" rx="32" ry="6" fill="${lava}" opacity=".6" stroke="none" ${c.soft()}/>` +
      c.E(34, 86, 26, 4, '#2a1a24') +
      segs +
      `<g transform="translate(${hx} ${hy}) scale(1.25) translate(${-hx} ${-hy})">` +
      c.P(`M${hx + 8} ${hy + 4}L${hx + 26} ${hy + 4 + jaw}C${hx + 22} ${hy + 14 + jaw} ${hx + 8} ${hy + 16 + jaw} ${hx} ${hy + 10}Z`, c.body(rock, 0.3)) +
      c.P(`M${hx + 9} ${hy + 5}L${hx + 22} ${hy + 5 + jaw * 0.7}L${hx + 9} ${hy + 9 + jaw * 0.5}Z`, c.lin([[0, '#fff1a0'], [1, lava]]), ' stroke="none"') +
      c.P(`M${hx - 14} ${hy}C${hx - 12} ${hy - 14} ${hx + 6} ${hy - 20} ${hx + 18} ${hy - 12}C${hx + 26} ${hy - 7} ${hx + 30} ${hy} ${hx + 28} ${hy + 4}L${hx + 8} ${hy + 6}C${hx} ${hy + 12} ${hx - 12} ${hy + 10} ${hx - 14} ${hy}Z`, c.body(sh(rock, 0.08), 0.4)) +
      c.P(`M${hx - 6} ${hy - 12}L${hx - 10} ${hy - 20}L${hx} ${hy - 15}ZM${hx + 4} ${hy - 16}L${hx + 4} ${hy - 23}L${hx + 11} ${hy - 16}Z`, c.body(sh(rock, -0.1), 0.3)) +
      c.P(`M${hx + 20} ${hy + 4}l2-5l3 5ZM${hx + 14} ${hy + 5}l2-4l2 4Z`, '#efe6d0') +
      crack(`M${hx - 8} ${hy - 4}L${hx - 2} ${hy + 1}L${hx + 4} ${hy - 2}`) +
      c.eye(hx + 10, hy - 6, 3) + c.eye(hx + 18, hy - 4, 2.6) + c.eye(hx + 3, hy - 4, 2) + '</g>' +
      c.P('M6 88.5L10 78L18 76L22 82L20 88.5ZM50 88.5L54 80L62 79L66 84L66 88.5Z', c.body('#6a5c5a', 0.3)) +
      c.P('M24 88.5L27 82L33 82L34 88.5Z', c.body('#6a5c5a', 0.3)) +
      c.spark(f ? 84 : 80, f ? 62 : 58, 1.8, lava) + c.spark(26, f ? 60 : 66, 1.4, lava) + c.spark(f ? 90 : 92, f ? 50 : 44, 1.2, EMBER_L)
    );
  };

  /* =========================================================
   * 4지역 · 폭풍 해안
   * ========================================================= */
  D.rock_crab = (f) => {
    const c = make(3);
    const shell = '#7f7f8e';
    const shellD = sh(shell, -0.35);
    const s = f ? 1 : -1;
    const cleg = (x, dx, col, ph) => {
      const d = (ph ? s : -s) * 3;
      return c.limb(`M${x} 70L${x + dx + d} 76L${x + dx * 1.4 + d} 85.5`, 5.5, col);
    };
    const claw = 'M0 0C-2-10 6-16 14-14L12-7L17-4C15 4 6 7 0 0Z';
    const barn = (x, y, r) => c.P(`M${x - r} ${y + r * 0.5}L${x - r * 0.5} ${y - r * 0.7}L${x + r * 0.5} ${y - r * 0.7}L${x + r} ${y + r * 0.5}Z`, '#d8d4cc') +
      c.En(x, y - r * 0.6, r * 0.4, r * 0.22, '#3a3444');
    return c.out(
      cleg(24, -9, shellD, 0) + cleg(38, -5, shellD, 1) + cleg(54, 4, shellD, 0) +
      '<g transform="translate(0 5)">' +
      c.limb('M58 38L60 24', 3.5, shellD) + c.limb('M66 40L70 26', 3.5, shellD) +
      c.eye(60, 22, 3.2) + c.eye(70, 24, 3) +
      c.limb('M68 48L76 38', 6, shellD) +
      g(c.P(claw, c.body(shellD, 0.3)), `translate(75 36) rotate(${f ? -50 : -64}) scale(1.05)`) +
      c.P('M10 60C10 42 26 32 44 32C62 32 76 42 76 58C76 68 62 74 44 74C26 74 10 68 10 60Z', c.body(shell, 0.4, -0.35)) +
      c.Pn('M14 62C26 71 62 71 72 62C68 70 58 74 44 74C30 74 18 70 14 62Z', SEA, 0.4) +
      barn(28, 44, 4) + barn(42, 38, 3.4) + barn(56, 42, 3.6) + barn(20, 54, 2.8) +
      c.En(36, 54, 4, 2.6, '#5e9a8a', 0.7) + c.En(62, 56, 3, 2, '#5e9a8a', 0.7) +
      c.L('M16 62C26 66 44 68 60 65', shellD, 1.8) + '</g>' +
      cleg(32, 8, shell, 1) + cleg(46, 10, shell, 0) + cleg(60, 12, shell, 1) +
      c.limb('M66 66L75 62', 7, shell) +
      g(c.P(claw, c.body(shell, 0.4)) + c.En(5, -6, 3, 1.8, '#ffffff', 0.45), `translate(75 62) rotate(${f ? -6 : -18}) scale(1.3)`)
    );
  };

  D.volt_jelly = (f) => {
    const c = make(3);
    const bell = f
      ? 'M26 50C24 30 36 18 50 18C64 18 76 30 74 50C69 54 64 50 58 54C53 50 47 54 42 50C36 54 31 50 26 50Z'
      : 'M21 48C19 30 33 20 50 20C67 20 81 30 79 48C73 53 67 48 61 52C55 48 45 52 39 48C33 53 27 48 21 48Z';
    const bx = [30, 40, 50, 60, 70];
    let tent = '';
    let sparks = '';
    bx.forEach((x, i) => {
      const w = (i % 2 ? 1 : -1) * (f ? 4 : -4);
      const ex = x + w * 0.6 + (f ? 0 : 0);
      tent += `M${x} 51C${x + w} 60 ${x - w} 70 ${H.n(ex)} 80`;
      sparks += c.spark(H.n(ex), 82, 1.6, '#fff3a0');
    });
    const bolt = (x, y) => c.L(zig([[x - 4, y - 3], [x, y], [x - 3, y + 2], [x + 2, y + 6]]), '#fff3a0', 1.8);
    return c.out(
      `<ellipse cx="50" cy="40" rx="32" ry="26" fill="${VOLT}" opacity=".4" stroke="none" ${c.soft()}/>` +
      c.limb(tent, 3.2, '#c9bfff') +
      sparks + bolt(bx[0] + (f ? -2 : 3), 86) + bolt(bx[4] + (f ? 3 : -2), 86) +
      c.P(bell, c.rad([[0, '#ffffff', 0.95], [0.35, '#c4b8ff', 0.85], [1, '#5b4bc0', 0.85]], 0.38, 0.3, 0.8)) +
      c.Pn(f ? 'M42 34C42 28 58 28 58 34C58 40 42 40 42 34Z' : 'M40 34C40 27 60 27 60 34C60 41 40 41 40 34Z', '#fff3a0', 0.5) +
      c.L(f ? 'M44 34L50 31L49 35L56 33' : 'M42 35L49 31L48 36L57 33', '#fffbe0', 1.6) +
      c.eye(56, 42, 3) + c.eye(66, 41, 2.7) +
      c.shine(36, 28, 6, 3.5, 0.7)
    );
  };

  D.spray_sprite = (f) => {
    const c = make(3.5);
    const water = c.rad([[0, '#ffffff', 0.95], [0.35, '#9eeaf0', 0.92], [1, '#2a98b0', 0.92]], 0.4, 0.3, 0.8);
    const fin = 'M0 0C-4-12-14-20-26-22C-22-14-20-6-14 2Z';
    const finF = c.lin([[0, '#e8fbff', 0.9], [1, SEA, 0.75]]);
    const fins = (a, sc) => g(c.P(fin, finF) + c.L('M-4-4L-16-16M-8-1L-20-10', '#ffffff', 1.2, ' opacity=".8"'), `translate(48 40) rotate(${a}) scale(${sc})`);
    const bob = f ? 2 : -1;
    return c.out(
      g(
        c.mist(f ? [[10, 56, 3], [4, 62, 2], [14, 66, 2]] : [[8, 52, 2.5], [6, 60, 2.5], [16, 64, 1.8]], '#bdf2f6', 0.85) +
        fins(f ? -10 : 30, 0.85) +
        c.P('M12 50C24 42 38 34 54 34C71 34 82 45 82 58C82 71 70 80 56 80C42 80 32 72 26 62C22 56 18 53 12 50Z', water) +
        c.P(f ? 'M36 74L28 84L42 80Z' : 'M38 75L32 86L44 80Z', finF) +
        c.eye(62, 55, 3.8) + c.eye(73, 54, 3.4) +
        c.L('M66 66q4 3 8 0', OL, 1.8) +
        c.shine(46, 44, 8, 4, 0.7) +
        fins(f ? -30 : 12, 1),
        `translate(0 ${bob})`
      )
    );
  };

  D.drowned_corsair = (f) => {
    const c = make(3);
    const bone = '#dcd6c6';
    const coat = '#3f5a62';
    const weed = '#5e9a6a';
    const s = f ? -1 : 1;
    return c.out(
      c.leg(44, 64, -6 * s, 6, sh(bone, -0.25)) + c.foot(44 - 6 * s + 2, 6, 3.5, '#3a2e34') +
      g(
        c.limb(`M40 40Q32 52 ${34 + 3 * s} 62`, 6.5, sh(coat, -0.3)) + c.E(34 + 3 * s, 64, 3, 3, sh(bone, -0.2)) +
        c.P('M36 36C40 32 60 32 64 36L68 70L58 66L52 72L46 66L32 70Z', c.body(coat, 0.3)) +
        c.P('M46 36L56 36L56 60L46 60Z', '#2b2236') +
        c.L('M47 42H55M47 48H55M47 54H55', bone, 2.2) +
        c.limb('M42 36C40 46 44 52 40 60', 3, weed) +
        c.P('M44 22C44 12 50 8 57 8C65 8 71 14 71 22C71 28 69 30 67 32L67 36L52 36L52 32C46 30 44 27 44 22Z', c.body(bone, 0.25)) +
        c.E(58, 22, 3.8, 4.2, '#241b2c') + c.E(66.5, 22, 3.4, 4, '#241b2c') +
        c.eye(58, 22, 2, false) + c.eye(66.5, 22, 1.8, false) +
        c.P('M62 26L63.5 29L61 29Z', '#241b2c') +
        c.L('M55 33V36M59 33V36M63 33V36', '#241b2c', 1.4) +
        c.P('M45 12C46 3 66 2 70 11Z', c.body('#3a3040', 0.3)) +
        c.P('M35 18C38 9 47 12 56 11C65 10 72 6 80 12C75 18 66 15 57 16C48 17 41 21 35 18Z', c.body('#3a3040', 0.3)) +
        c.L('M36 17C40 11 48 13 56 12C64 11 72 8 79 12', GOLD, 1.6) +
        c.limb('M44 10C40 16 42 22 38 28', 3, weed) + c.L('M60 6l4 3', weed, 2.5),
        f ? 'translate(0 -1)' : ''
      ) +
      c.leg(56, 64, 6 * s, 6, bone) + c.foot(56 + 6 * s + 2, 6, 3.5, '#4a3c42') +
      g(
        c.limb('M60 40Q68 46 72 48', 7, coat) +
        c.P('M70 44L76 46L75 52L69 50Z', bone) +
        c.limb('M75 49L80 50C86 52 86 60 80 61', 3.2, '#b0703e'),
        f ? 'translate(0 -1) rotate(-5 60 40)' : 'rotate(4 60 40)'
      )
    );
  };

  D.coral_colossus = (f) => {
    const c = make(3);
    const stone = '#7c8e93';
    const stoneD = sh(stone, -0.3);
    const coral = '#df8f84';
    const s = f ? -1 : 1;
    const shell = (x, y, r, a) => g(c.P(`M0 ${r * 0.3}L${-r} ${-r * 0.5}C${-r * 0.6} ${-r * 1.1} ${r * 0.6} ${-r * 1.1} ${r} ${-r * 0.5}Z`, c.body('#ece2d4', 0.2)) +
      c.L(`M0 ${r * 0.3}L${-r * 0.5} ${-r * 0.8}M0 ${r * 0.3}L0 ${-r * 0.9}M0 ${r * 0.3}L${r * 0.5} ${-r * 0.8}`, '#b4a08c', 1.4), `translate(${x} ${y}) rotate(${a})`);
    return c.out(
      c.limb('M30 30L22 10M24 16L14 12M22 10L26 2M38 26L42 8M40 14L48 10', 5.5, coral) +
      c.limb('M64 24L72 6M68 14L78 12', 5, '#a87fc0') +
      c.limb(`M30 38Q18 50 ${18 - 3 * s} 62`, 12, stoneD) + c.E(17 - 3 * s, 67, 9, 8, stoneD) +
      c.leg(40, 70, -4 * s, 13, stoneD) +
      g(
        c.P('M20 40C20 24 36 16 52 16C70 16 82 28 80 46C78 62 70 72 54 72L40 72C28 68 20 56 20 40Z', c.body(stone, 0.35)) +
        c.En(30, 50, 5, 3.5, coral, 0.8) + c.En(46, 62, 4, 3, coral, 0.8) + c.En(64, 54, 3, 2.4, '#a87fc0', 0.8) +
        c.En(36, 40, 3.4, 2.6, '#5fa3a0', 0.85) + c.En(56, 66, 2.6, 2, '#5fa3a0', 0.85) + c.En(28, 60, 2.2, 1.8, '#5fa3a0', 0.85) +
        shell(36, 26, 8, -20) +
        c.P('M58 24C58 16 66 12 74 14C80 16 82 24 79 30C74 34 62 34 59 30Z', c.body(stone, 0.3)) +
        c.E(68, 23, 3.6, 4, '#241b2c') + c.E(76, 22.5, 3.2, 3.8, '#241b2c') +
        c.eye(68, 23, 2.1, false) + c.eye(76, 22.5, 1.9, false) +
        c.mist(f ? [[86, 14, 2], [90, 8, 1.5], [84, 4, 1.2]] : [[88, 16, 1.8], [86, 9, 1.5], [91, 4, 1.2]], '#ffffff', 0.7),
        f ? 'translate(0 -1)' : ''
      ) +
      c.leg(60, 70, 4 * s, 13, stone) +
      c.limb(`M72 34Q86 46 ${84 + 3 * s} 58`, 13, stone) + c.E(85 + 3 * s, 64, 10, 9, c.body(stone, 0.3)) +
      shell(74, 34, 7, 20) +
      c.En(80 + 3 * s, 60, 3, 2, '#d8d4cc', 0.9) + c.En(89 + 3 * s, 61, 2.4, 1.6, '#d8d4cc', 0.9) + c.En(85 + 3 * s, 67, 3, 2.2, coral, 0.85)
    );
  };

  D.volt_eel = (f) => {
    const c = make(3);
    const body = '#45506a';
    const path = f ? 'M11 80C22 88 32 70 46 76S68 82 76 62' : 'M11 82C22 72 32 88 46 80S66 68 76 60';
    const bolts = f
      ? [[20, 80], [34, 76], [48, 79], [62, 80]]
      : [[20, 80], [34, 84], [48, 81], [62, 74]];
    const bolt = ([x, y]) => c.L(zig([[x - 3, y - 5], [x + 1, y - 1], [x - 2, y + 1], [x + 2, y + 5]]), '#fff3a0', 2.2);
    return c.out(
      c.P(f ? 'M12 80L4 72L5 87Z' : 'M12 84L4 76L5 89Z', VOLT) +
      `<path d="${path}" fill="none" stroke-width="24"/>` +
      `<path d="${path}" fill="none" stroke="${c.lin([[0, sh(body, 0.35)], [1, sh(body, -0.3)]])}" stroke-width="18"/>` +
      `<path d="${path}" fill="none" stroke="${VOLT}" stroke-width="8" opacity=".55" ${c.soft()}/>` +
      bolts.map(bolt).join('') +
      c.P(f ? 'M66 58C72 48 86 46 94 52C99 57 97 64 90 66L72 70Z' : 'M66 56C72 46 86 44 94 50C99 55 97 62 90 64L72 68Z', c.body(body, 0.35)) +
      c.P(f ? 'M68 56C70 46 76 42 82 45L78 54Z' : 'M68 54C70 44 76 40 82 43L78 52Z', VOLT) +
      c.eye(84, f ? 54 : 52, 3.4) + c.L(f ? 'M88 62L97 59' : 'M88 60L97 57', OL, 1.8) +
      c.spark(f ? 30 : 40, f ? 66 : 70, 1.4, '#fff3a0') + c.spark(f ? 56 : 18, f ? 68 : 70, 1.2, '#fff3a0')
    );
  };

  D.mist_mariner = (f) => {
    const c = make(3);
    const cloak = c.lin([[0, '#b9c4cc', 0.95], [0.6, '#7d8f9a', 0.85], [1, '#6b7f8c', 0.5]]);
    const hem = f ? 'L24 84L32 80L40 86L48 80L56 86L64 80L72 84' : 'L26 86L34 80L42 85L50 80L58 86L66 81L73 85';
    return c.out(
      g(
        c.mist(f ? [[28, 88, 3.5], [44, 88, 3], [62, 88, 3.5]] : [[32, 88, 3], [50, 88, 3.5], [68, 88, 3]], MISTC, 0.75) +
        c.P(`M36 30C30 44 28 62 24 80${hem}L70 60C68 48 66 38 64 32Z`, cloak) +
        c.L('M40 50l2 14M58 54l1 14', '#5d6f7c', 1.6) +
        c.P('M44 10C56 6 70 14 70 28C70 36 66 42 62 44L42 44C36 38 34 28 36 20C38 14 40 12 44 10Z', cloak) +
        c.P('M48 9C52 4 62 4 66 10L64 14C58 10 52 10 48 13Z', '#3a4a66') +
        c.E(59, 28, 8, 9, c.rad([[0, '#3a3450'], [1, '#141020']], 0.6, 0.5, 0.6)) +
        c.eye(58, 27, 2.4, false) + c.eye(64, 27, 2.1, false) +
        c.P('M42 50L82 46L83 52L42 56Z', c.lin([[0, '#8a6a48'], [1, '#5a4232']])) +
        c.P('M66 45L86 44L86 50L66 51Z', c.lin([[0, '#c9ccd6'], [1, '#6a6e80']])) +
        c.L('M84 47L92 47', OL, 3.5) + c.P('M90 42L97 47L90 52L92 47Z', '#c9ccd6') +
        c.L('M60 54C58 62 66 64 66 58', '#c8b48c', 2) +
        c.limb('M54 42Q58 48 62 52', 6, '#8a9aa6') + c.E(62, 52, 3.4, 3.4, '#dfe8ee'),
        `rotate(${f ? 1.5 : -1.5} 50 90)`
      )
    );
  };

  D.tide_caller = (f) => {
    const c = make(3);
    const robe = '#4f6a8a';
    const scale = '#8ea2b0';
    const s = f ? -1 : 1;
    return c.out(
      c.foot(42 - 3 * s, 6, 3, '#5a6878') + c.foot(58 + 3 * s, 6, 3, '#6a7888') +
      g(
        c.P('M36 40C40 34 60 34 64 40L72 84L60 80L50 85L40 80L28 84Z', c.body(robe, 0.3)) +
        c.P('M44 38L56 38L54 84L46 84Z', sh(robe, 0.2)) +
        c.L('M46 46l8 0M46 56l8 0', VOLT, 2) +
        c.P(f ? 'M46 14L42 2L50 8L54 0L58 9L64 4L64 14Z' : 'M46 14L41 3L50 9L53 1L58 10L65 5L64 14Z', c.lin([[0, '#9fe0d8'], [1, SEA]])) +
        c.P('M38 28C38 16 48 11 58 11C70 11 77 20 77 28C77 38 69 44 58 44C48 44 38 38 38 28Z', c.body(scale, 0.35)) +
        c.L('M46 26q-3 5 0 10M50 27q-3 5 0 10', sh(scale, -0.4), 1.8) +
        c.En(54, 18, 3, 2, '#ffffff', 0.35) + c.En(46, 22, 2, 1.4, '#ffffff', 0.3) +
        c.eye(63, 23, 4.4) +
        c.P('M71 32C78 26 84 19 90 19C94 23 94 30 90 34C85 36 78 36 71 36Z', c.body('#e9d6c4', 0.25)) +
        c.L('M78 30q4-6 8-6M83 34q2-5 6-7', '#c49a8a', 1.6) +
        c.limb('M54 46Q66 48 74 38', 6, robe) + c.E(75, 37, 3.4, 3.4, scale),
        f ? 'translate(0 -1)' : ''
      ) +
      c.L(f ? 'M89 12q5 5 0 10M93 8q7 8 0 17' : 'M90 13q4 4 0 8M94 9q6 7 0 15', '#bff4ee', 2.4, ' opacity=".9"')
    );
  };

  D.tempest_whale = (f) => {
    const c = make(3);
    const skin = '#4e5878';
    const belly = '#9aa2bc';
    const cloud = '#6a6684';
    const fluke = 'M0 0C-6-10-14-14-21-12C-16-6-14-2-12 0C-14 2-16 6-21 12C-14 14-6 10 0 0Z';
    const bolt = (pts) => `<path d="${zig(pts)}" fill="none" stroke="${VOLT}" stroke-width="5" opacity=".7" ${c.soft()}/>` + c.L(zig(pts), '#fff6c0', 2);
    const ty = f ? 62 : 38;
    return c.out(
      c.cloud([[26, 32, 8], [36, 25, 10], [50, 20, 10], [64, 19, 9], [77, 22, 8], [88, 28, 6]], c.body(cloud, 0.35, -0.2)) +
      c.En(48, 15, 6, 2.4, '#a9a4c4', 0.7) + c.En(66, 14, 4, 2, '#a9a4c4', 0.7) +
      c.limb(`M30 52C26 52 24 ${ty < 50 ? 46 : 56} 21 ${ty}`, 11, skin) +
      g(c.P(fluke, c.body(skin, 0.3)), `translate(23 ${ty}) rotate(${f ? 30 : -30}) scale(1.02)`) +
      c.limb(f ? 'M54 62L44 54' : 'M54 62L46 72', 7, sh(skin, -0.3)) +
      c.P('M22 50C28 32 46 25 65 25C82 25 96 36 97 50C98 60 92 66 82 70C66 77 44 76 31 68C26 64 23 58 22 50Z', c.body(skin, 0.35, -0.35)) +
      c.P('M30 62C42 71 66 73 82 68C90 65 95 60 97 52C89 58 75 61 60 61C48 61 38 61 30 62Z', c.lin([[0, belly], [1, sh(belly, -0.25)]])) +
      c.L('M38 65L41 68M48 66L51 70M58 67L61 71M68 67L71 70M78 65L80 68', sh(belly, -0.35), 1.6) +
      bolt([[36, 65], [46, 62], [52, 67], [64, 63], [72, 68], [84, 62]]) +
      c.L('M97 52C89 57 81 59 73 58', OL, 2) +
      c.En(42, 36, 2.2, 1.6, '#c8cce0', 0.7) + c.En(54, 33, 2.6, 2, '#c8cce0', 0.7) + c.En(66, 33, 1.8, 1.4, '#c8cce0', 0.7) +
      c.eye(81, 48, 3.2) +
      c.shine(52, 37, 12, 3.5, 0.35, -8) +
      c.limb(f ? 'M62 66Q66 75 58 80' : 'M62 66Q72 73 74 80', 8, sh(skin, -0.1)) +
      c.cloud([[20, 74, 7], [30, 79, 8], [43, 82, 8], [56, 82, 7], [68, 80, 6]], c.body(cloud, 0.3, -0.25)) +
      c.En(30, 76, 5, 2, '#a9a4c4', 0.6) + c.En(44, 79, 5, 2, '#a9a4c4', 0.6) +
      bolt(f ? [[36, 88], [33, 93], [38, 95], [35, 99]] : [[50, 88], [47, 93], [52, 95], [49, 99]])
    );
  };

})();
