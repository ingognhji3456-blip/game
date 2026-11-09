'use strict';

/* 적 그림 — 1지역 솔빛 들판 · 2지역 서리 고개 (공용 도구: enemies.js) */
(() => {
  const { H, OL, sh, GREY, GREY_L, MISTC, HALO, GREEN, ICE, ICE_L, EMBER, EMBER_L, VOLT, SEA, BELL, GOLD, BRONZE, make, g, zig } = RG.art._en;
  const D = RG.art._en.D;

  /* =========================================================
   * 1지역 · 솔빛 들판
   * ========================================================= */

  D.mist_rat = (f) => {
    const c = make(3.5);
    const s = f ? -1 : 1;
    const legC = sh(GREY, -0.25);
    const tail = f ? 'M24 74C12 74 6 64 10 54C13 46 10 40 5 37' : 'M24 74C10 76 4 66 8 56C11 48 9 42 4 40';
    const tip = f ? [[8, 35, 5], [14, 29, 4], [6, 26, 3.5], [18, 22, 2.5]] : [[7, 38, 5], [12, 31, 4], [6, 28, 3.5], [16, 25, 2.5]];
    return c.out(
      c.limb(tail, 4.5, sh(GREY, -0.1)) +
      c.mist(tip, MISTC, 0.85) +
      c.leg(38, 76, -3 * s, 6, legC) + c.leg(68, 76, 3 * s, 6, legC) +
      g(
        c.P('M22 80C17 62 33 46 54 47C66 48 74 53 80 59C86 63 91 68 95 74C92 79 85 82 77 83C60 87 34 88 22 80Z', c.body(GREY)) +
        c.En(54, 79, 20, 5, GREY_L, 0.55) +
        c.E(68, 50, 10, 10, c.body(GREY)) + c.En(68.5, 51, 5.5, 6, '#c9a6b4') +
        c.eye(80, 63, 3.6) +
        c.E(94, 73.5, 3, 2.6, '#d99fb2') +
        c.shine(40, 56, 9, 4),
        f ? 'translate(0 -1)' : ''
      ) +
      c.leg(44, 78, 3 * s, 6, GREY) + c.leg(74, 78, -3 * s, 6, GREY)
    );
  };

  D.ash_boar = (f) => {
    const c = make(3);
    const s = f ? -1 : 1;
    const legF = sh('#857b78', -0.3);
    const legN = '#857b78';
    const mane = f
      ? 'M20 48C19 42 22 38 26 36L23 27L32 33L33 22L41 31L46 20L50 30L57 22L59 31L67 26L66 35L73 35L71 43Z'
      : 'M20 48C19 42 22 38 26 36L21 28L31 32L31 23L40 30L44 21L49 29L56 21L58 30L66 24L66 34L74 33L71 43Z';
    return c.out(
      c.leg(30, 70, -4 * s, 9, legF) + c.leg(62, 70, 4 * s, 9, legF) +
      g(
        c.limb('M17 56C10 55 9 48 14 47', 3, '#857b78') +
        c.E(44, 58, 30, 22, c.body('#8b817d')) +
        c.En(46, 74, 22, 5, sh('#8b817d', 0.3), 0.5) +
        c.mist(f ? [[22, 24, 3], [36, 17, 2.5], [54, 16, 2.5], [68, 21, 2]] : [[20, 25, 2.5], [38, 15, 3], [56, 17, 2], [70, 19, 2.5]], MISTC, 0.7) +
        c.P(mane, c.lin([[0, '#f4f2fb'], [1, '#a9a3c0']])) +
        c.P('M60 46C70 41 80 46 84 54L92 61C96 64 96 72 92 75L80 77C69 79 61 72 59 63Z', c.body('#8b817d', 0.3)) +
        c.P('M64 46L61 33L73 42Z', sh('#8b817d', -0.15)) +
        c.E(93, 68, 3.5, 5.5, '#b9a2a2') +
        c.En(93.5, 66, 1, 1.4, OL) + c.En(93.5, 70.5, 1, 1.4, OL) +
        c.P('M80 74L90 71L94 57L87 62L79 66Z', c.lin([[0, '#e4e0d6'], [1, '#9c978c']], 'h')) +
        c.L('M88 64L84 69', '#7d7870', 1.5) +
        c.eye(76, 55, 3.2) +
        c.shine(32, 50, 10, 5, 0.3),
        f ? 'translate(0 -1)' : ''
      ) +
      c.leg(36, 72, 4 * s, 9, legN) + c.foot(36 + 4 * s, 5, 2.5, '#3d3540') +
      c.leg(68, 72, -4 * s, 9, legN) + c.foot(68 - 4 * s, 5, 2.5, '#3d3540')
    );
  };

  D.mist_crow = (f) => {
    const c = make(3.5);
    const crow = '#4c4858';
    const wing = 'M0 0C-10-11-26-15-42-12L-35-6L-44-1L-35 3L-42 8L-31 9L-33 14L-20 11C-11 10-4 6 0 0Z';
    const puffs = c.mist([[-44, -6, 4.5], [-47, 2, 4], [-42, 9, 3.5], [-52, -1, 2.5]], MISTC, 0.8);
    const wingG = (a, col, sc = 1) => `<g transform="translate(50 50) rotate(${a}) scale(${sc})">${c.P(wing, col)}${puffs}</g>`;
    const bob = f ? 3 : -1;
    return c.out(
      g(
        wingG(f ? -12 : 82, sh(crow, -0.3), 0.8) +
        c.P('M30 60L7 51L11 61L7 72L32 67Z', sh(crow, -0.1)) +
        c.P('M21 61C27 47 45 42 60 44C72 45 79 49 83 54C78 62 66 66 54 66C42 68 28 67 21 61Z', c.body(crow, 0.35)) +
        c.E(74, 46, 13, 12, c.body(crow, 0.35)) +
        c.P('M84 41L97 48L84 53Z', c.lin([[0, '#d6ceb0'], [1, '#8f8770']])) +
        c.eye(78, 44, 3.8) +
        wingG(f ? -40 : 50, c.body(sh(crow, 0.12), 0.35)),
        `translate(0 ${bob})`
      )
    );
  };

  D.straw_husk = (f) => {
    const c = make(3);
    const s = f ? -1 : 1;
    const straw = '#d8bc6a';
    const tuft = (x, y, dir) => c.L(`M${x} ${y}l${7 * dir} -5M${x} ${y}l${8 * dir} 0M${x} ${y}l${7 * dir} 5`, straw, 3);
    const rot = f ? 3 : -3;
    return c.out(
      c.leg(46, 70, -5 * s, 7, sh(straw, -0.25), 0, 0) +
      c.leg(56, 70, 5 * s, 7, straw, 0, 0) +
      c.L(`M${56 + 5 * s} 85l-4 4M${56 + 5 * s} 85l4 4M${46 - 5 * s} 85l-4 4`, sh(straw, -0.2), 2.5) +
      g(
        c.L('M18 38L86 44', OL, 9) + c.L('M18 38L86 44', '#8a6a48', 4.5) +
        tuft(18, 38, -1) + tuft(86, 44, 1) +
        c.P('M28 34L42 32L44 50L30 48Z', '#7f8b70') +
        c.P('M60 35L76 38L74 54L60 52Z', '#7f8b70') +
        c.P('M38 34C44 30 60 30 66 35L68 58L71 72L64 68L58 74L52 68L45 74L40 67L34 71L37 58Z', c.body('#88957a', 0.3)) +
        c.L('M40 46l6 2M60 60l5-2', sh('#88957a', -0.35), 1.6) +
        c.E(53, 52, 7.5, 8, '#2b2236') +
        c.L('M53 52m-3 0a3 3 0 1 1 3 3a5 5 0 0 1-5-5', MISTC, 1.8) +
        c.mist([[50, 47, 2], [57, 46, 1.6]], MISTC, 0.7),
        `rotate(${rot} 52 50)`
      ) +
      g(
        c.P('M41 28C40 16 46 11 53 11C61 11 66 17 65 28C64 34 58 37 53 37C47 37 42 34 41 28Z', c.body('#b9a682', 0.3)) +
        c.L('M48 13l3 3m6-3l-2 4', sh(straw, -0.1), 2) +
        c.eye(53, 23, 2.8) + c.eye(61, 23, 2.6) +
        c.L('M51 31l2 2l2-2l2 2l2-2l2 2', OL, 1.6) +
        c.E(52, 13, 21, 4.5, c.body('#857560', 0.2)) +
        c.P('M41 13C43 7 48 3 57 2C56 6 59 9 63 13Z', c.body('#857560', 0.3)) +
        c.L('M43 11L62 11', '#a3463a', 2.2),
        f ? 'translate(0 -1) rotate(-2 53 30)' : 'rotate(2 53 30)'
      )
    );
  };

  D.vine_leech = (f) => {
    const c = make(3);
    const base = '#6f7b68';
    const segs = [];
    const N = 8;
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1);
      const x = 14 + t * 66;
      const r = 8 + Math.sin(t * Math.PI * 0.85) * 7;
      const hump = Math.max(0, Math.cos((t - (f ? 0.55 : 0.38)) * Math.PI * 2.4)) * 14;
      segs.push([H.n(x), H.n(90 - 1.5 - r - hump), H.n(r)]);
    }
    let body = '';
    const grad = c.body(base, 0.35);
    segs.forEach(([x, y, r]) => { body += c.E(x, y, r * 1.05, r, grad); });
    const vein = `M${segs.map(([x, y, r]) => `${x} ${H.n(y - r * 0.35)}`).join('L')}`;
    const [hx, hy, hr] = segs[N - 1];
    const leaf = (x, y, a) => g(c.P('M0 0C2-8 8-12 14-12C12-6 8-1 0 0Z', c.body('#7fae4f', 0.3)), `translate(${x} ${y}) rotate(${a})`);
    return c.out(
      body +
      c.L(vein, GREEN, 5, ` opacity=".35" ${c.soft()}`) +
      c.L(vein, sh(GREEN, 0.25), 2) +
      leaf(segs[3][0], segs[3][1] - segs[3][2] + 2, -20) +
      leaf(segs[5][0], segs[5][1] - segs[5][2] + 2, 10) +
      c.E(hx + hr * 0.8, hy + 2, 4.5, 6, '#4a3a4e') + c.En(hx + hr * 0.9, hy + 2, 2, 3.4, '#d6b6c4') +
      c.eye(hx + 1, hy - hr * 0.45, 2.6) + c.eye(hx + 6, hy - hr * 0.3, 2.3) +
      c.shine(segs[2][0] - 2, segs[2][1] - segs[2][2] * 0.5, 4, 2, 0.35)
    );
  };

  D.spore_sac = (f) => {
    const c = make(3);
    const s = f ? -1 : 1;
    const cap = '#86739a';
    const sac = '#b3a8ba';
    const spot = '#e4dcec';
    return c.out(
      c.leg(40, 74, -3 * s, 8, sh(sac, -0.4)) + c.leg(60, 74, 3 * s, 8, sh(sac, -0.2)) +
      g(
        c.P('M50 28C72 28 85 42 83 59C81 74 68 82 50 82C32 82 19 74 17 59C15 42 28 28 50 28Z', c.body(sac)) +
        c.En(30, 62, 4, 3, sh(sac, -0.18)) + c.En(42, 73, 3.5, 2.4, sh(sac, -0.18)) + c.En(24, 50, 2.6, 2, sh(sac, -0.18)) +
        c.P('M20 40C20 22 34 11 50 11C66 11 80 22 80 40C74 44 68 38 62 42C56 38 46 43 40 39C34 43 26 38 20 40Z', c.body(cap)) +
        c.En(34, 24, 5, 3.6, spot) + c.En(52, 18, 4, 3, spot) + c.En(66, 28, 4, 3, spot) + c.En(28, 35, 2.6, 2, spot) + c.En(48, 32, 2.6, 2, spot) +
        c.mist(f ? [[47, 6, 3.6], [56, 3, 2.6], [40, 4, 2]] : [[53, 6, 3.6], [44, 3, 2.6], [60, 4, 2]], '#d4e89a', 0.9) +
        c.spark(f ? 60 : 38, 8, 1.3, '#c8e07a') +
        c.eye(63, 54, 3.8) + c.eye(75, 53, 3.3) +
        c.L('M64 65q6 4 11-1', OL, 2.2) +
        c.shine(30, 44, 7, 3, 0.35),
        `rotate(${4 * s} 50 86)`
      )
    );
  };

  D.sporeling = (f) => {
    const c = make(3.5);
    const cap = '#86739a';
    const spot = '#e4dcec';
    const y = f ? 5 : 0;
    return c.out(
      c.leg(40, 76, f ? -7 : -3, 8, '#8c8296') + c.leg(60, 76, f ? 7 : 3, 8, '#b0a7b8') +
      g(
        c.P('M32 48C30 64 32 79 50 80C68 79 70 64 68 48Z', c.body('#bdb5c4', 0.3)) +
        c.eye(55, 61, 4.2) + c.eye(67, 60, 3.6) +
        c.P(f ? 'M7 50C7 26 28 14 50 14C72 14 93 26 93 50C80 57 20 57 7 50Z' : 'M11 50C11 24 30 9 50 9C70 9 89 24 89 50C76 57 24 57 11 50Z', c.body(cap)) +
        c.En(34, 30, 6.5, 5, spot) + c.En(58, 22, 5, 4, spot) + c.En(74, 38, 4.5, 3.5, spot) + c.En(22, 44, 3, 2.4, spot) +
        c.shine(28, 24, 7, 3.5, 0.4),
        `translate(0 ${y})`
      )
    );
  };

  D.rust_knight = (f) => {
    const c = make(3);
    const s = f ? -1 : 1;
    const rust = '#8c766a';
    const rustD = sh(rust, -0.35);
    const orange = '#c0683c';
    const plate = c.body(rust, 0.35);
    const sword =
      c.P('M-3.5 5L3.5 5L3.5 24L1.5 29L-0.5 26L-3.5 28Z', c.lin([[0, '#d2ccc8'], [1, '#7a706c']], 'h')) +
      c.En(1, 14, 1.6, 2, orange, 0.9) +
      c.P('M-9 2L9 2L9 6L-9 6Z', rustD) + c.P('M-2-6L2-6L2 2L-2 2Z', '#5a4232');
    return c.out(
      c.leg(44, 66, -6 * s, 9, rustD) + c.foot(44 - 6 * s + 2, 6, 3, sh(rustD, -0.2)) +
      g(
        c.mist(f ? [[44, 9, 3.5], [36, 6, 3], [28, 7, 2.4], [21, 4, 1.8]] : [[44, 9, 3.5], [37, 8, 3], [30, 4, 2.4], [23, 6, 1.8]], MISTC, 0.8) +
        c.limb('M42 40L32 54L36 64', 7, rustD) +
        c.mist([[42, 66, 4], [56, 67, 3.5], [36, 62, 2.5]], MISTC, 0.7) +
        c.P('M36 36C42 32 62 32 68 37L66 62C60 66 44 66 38 62Z', plate) +
        c.L('M52 36L52 63', sh(rust, -0.45), 1.8) +
        c.En(44, 46, 3.4, 2.6, orange, 0.85) + c.En(60, 56, 2.6, 2, orange, 0.85) + c.En(40, 56, 1.8, 1.4, orange, 0.85) +
        c.P('M37 60L67 60L69 70L35 70Z', c.body(sh(rust, -0.08), 0.3)) +
        c.L('M43 61L42 70M52 61V70M61 61L62 70', sh(rust, -0.45), 1.6) +
        c.mist([[52, 32, 4], [46, 31, 3], [58, 30, 2.6]], MISTC, 0.75) +
        c.P('M40 12C46 7 62 7 68 13L68 32C62 36 46 36 40 32Z', c.body(rust, 0.4)) +
        c.P('M54 20L70 20L70 25L54 25Z', '#241b2c') +
        c.eye(63, 22.5, 2.2, false) + c.eye(57.5, 22.5, 1.8, false) +
        c.L('M46 13L46 31', sh(rust, -0.4), 1.6) +
        c.En(62, 29, 2.4, 1.6, orange, 0.85) +
        c.shine(46, 17, 3, 5, 0.4, 0),
        f ? 'translate(0 -1)' : ''
      ) +
      c.leg(58, 66, 6 * s, 9, rust) + c.foot(58 + 6 * s + 2, 6, 3, rustD) +
      g(
        g(sword, `translate(78 51) rotate(${f ? -38 : -26})`) +
        c.P('M58 34C65 30 74 33 74 40L71 45L59 43Z', c.body(sh(rust, 0.05), 0.4)) +
        c.limb('M68 41L73 50L78 51', 7, rust) +
        c.E(78, 51, 4, 4, rustD),
        f ? 'translate(0 -1)' : ''
      )
    );
  };

  D.hollow_elder = (f) => {
    const c = make(3);
    const bark = '#7b6b60';
    const barkD = sh(bark, -0.35);
    const leaf = '#7c9168';
    const s = f ? 1 : -1;
    const root = (x, y, dx, w, col, lift) => c.limb(`M${x} ${y}Q${x + dx * 0.4} ${y + 10} ${x + dx} ${H.n(90 - w / 2 - 3 - lift)}`, w, col);
    const clump = (x, y, r, col) => c.E(x, y, r, r * 0.8, col);
    const leafG = c.body(leaf, 0.3);
    const moss = '#93b062';
    return c.out(
      root(36, 72, -20 + 3 * s, 8, barkD, f ? 2 : 0) + root(62, 72, 20 + 3 * s, 8, barkD, f ? 0 : 2) +
      g(
        c.limb('M30 46C20 42 14 36 12 26M18 38L8 36', 7, barkD) +
        c.limb(f ? 'M68 44C80 44 86 38 90 30M84 40L94 42' : 'M68 44C80 46 88 42 92 34M86 44L95 48', 7, bark) +
        c.L(f ? 'M86 40l1 8M90 33l2 7' : 'M88 44l0 8M92 38l2 7', moss, 2.5) + c.L('M16 34l-1 8M12 28l-2 6', moss, 2.5) +
        c.limb('M40 22L32 6M34 12L26 10M60 20L70 4M66 10L74 12', 3.5, barkD) +
        clump(25, 25, 14, sh(leaf, -0.28)) + clump(75, 23, 14, sh(leaf, -0.28)) +
        clump(50, 18, 17, leafG) + clump(33, 15, 11, leafG) + clump(68, 13, 11, leafG) +
        c.En(44, 11, 6, 3, '#c9dca8', 0.55) + c.En(64, 8, 4, 2, '#c9dca8', 0.5) + c.En(24, 20, 4, 2, '#c9dca8', 0.4) +
        c.L('M38 22q3 2 6 0M54 26q3 2 6 0M28 30q3 2 6 0M66 22q3 2 6 0M46 16q3 2 6 0M74 30q3 2 6 0', sh(leaf, -0.35), 1.6) +
        c.P('M30 30C36 26 64 26 70 30C72 46 72 62 76 76L66 82L56 78L48 82L38 78L26 80C30 64 30 46 30 30Z', c.body(bark, 0.3, -0.4)) +
        c.L('M36 34C34 50 36 64 34 76M44 30C42 40 43 46 42 50M66 34C67 46 66 56 70 74M60 76C60 72 62 70 64 70', barkD, 2) +
        c.Pn('M30 32C36 28 50 27 56 28C46 32 40 40 38 52C36 40 34 34 30 32Z', '#ffffff', 0.12) +
        c.P('M40 50C40 40 50 38 56 40C64 42 66 52 64 64C62 72 56 76 50 75C42 74 39 62 40 50Z', c.rad([[0, '#d9d6e6'], [0.35, '#6e6880'], [1, '#1e1828']], 0.52, 0.55, 0.55)) +
        g(c.L('M0 0m-2 0a2 2 0 1 1 4 0a4 4 0 0 1-8 0a6 6 0 0 1 12 0a8.5 8.5 0 0 1-17 0', MISTC, 2.2, ' opacity=".85"'), `translate(52 58) rotate(${f ? 40 : 0})`) +
        c.P('M42 38L50 31L55 37Q49 40 42 38Z', '#2b2236') + c.P('M57 37L64 31L70 38Q63 40 57 37Z', '#2b2236') +
        c.eye(50, 35.5, 3, false) + c.eye(64, 35.5, 3, false) +
        c.En(29, 56, 6, 3, moss, 0.95) + c.En(71, 64, 5, 2.5, moss, 0.95) + c.En(34, 30, 7, 2.6, moss, 0.9) +
        c.P('M70 50C76 47 81 49 81 54L70 55Z', '#b7a58c') + c.P('M72 57C76 55 79 57 79 60L72 60Z', '#b7a58c') +
        c.mist([[46, 74, 3], [58, 76, 2.5], [52, 80, 2]], MISTC, 0.6),
        f ? 'translate(0 -1)' : ''
      ) +
      root(44, 76, -8 - 3 * s, 9, bark, f ? 0 : 1.5) + root(56, 76, 8 - 3 * s, 9, bark, f ? 1.5 : 0) +
      c.P('M28 78C28 74 34 74 34 78Z', '#d8c8b0') + c.L('M31 78V81', '#d8c8b0', 2) +
      c.P('M66 80C66 77 71 77 71 80Z', '#c9a88a') + c.L('M68.5 80V82', '#c9a88a', 2)
    );
  };

  /* =========================================================
   * 2지역 · 서리 고개
   * ========================================================= */
  D.frost_wolf = (f) => {
    const c = make(3);
    const fur = '#d2d7e1';
    const furD = sh(fur, -0.32);
    const L = f ? [5, 1, -4, -8] : [-11, -6, 8, 13];
    let spikes = '';
    const spk = c.lin([[0, '#ffffff'], [1, '#7fdcff']]);
    for (let i = 0; i < 5; i++) {
      const x = 27 + i * 9;
      const y = 44 - Math.sin((i / 4) * Math.PI) * 3;
      spikes += c.P(`M${x - 5} ${y + 4}L${x - 8} ${y - 11}L${x + 5} ${y + 2}Z`, spk);
    }
    return c.out(
      c.leg(28, 62, L[0], 6.5, furD, 0, -4) + c.leg(64, 62, L[2], 6.5, furD, 0, 3) +
      g(
        spikes +
        c.P('M20 52C10 48 4 38 6 26C11 31 17 36 25 44Z', c.body(fur, 0.3)) +
        c.P('M6 26L2 18L10 24ZM9 31L4 26L12 29Z', ICE) +
        c.P('M16 56C16 45 27 40 40 41C52 42 58 38 67 40C76 42 80 50 78 58C76 66 68 70 58 69L34 69C24 69 16 64 16 56Z', c.body(fur, 0.35, -0.3)) +
        c.P('M68 56L74 66L70 64L68 70L64 62Z', '#eef1f6') +
        c.P('M66 38L64 25L72 34Z', furD) +
        c.P('M63 46C64 36 71 31 78 31C84 32 88 37 90 41L97 47C98 51 95 54 90 54L80 56C72 58 65 54 63 46Z', c.body(fur, 0.35, -0.3)) +
        c.P('M71 36L73 22L80 33Z', fur) + c.Pn('M73 32L74 26L77 31Z', ICE, 0.8) +
        c.E(96.5, 48, 2, 1.8, OL) + c.L('M88 53L94 52', OL, 1.6) +
        c.En(77, 42, 5, 3.5, '#9aa3b4', 0.6) +
        c.eye(80, 41, 3) +
        c.mist(f ? [[93, 59, 3], [88, 63, 2.5], [97, 63, 2]] : [[95, 58, 3.4], [90, 62, 2.5], [84, 64, 2]], ICE_L, 0.85) +
        c.shine(34, 48, 9, 3.5, 0.5),
        f ? 'translate(0 -2)' : ''
      ) +
      c.leg(32, 63, L[1], 7, fur, 0, -4) + c.leg(68, 63, L[3], 7, fur, 0, 3)
    );
  };

  D.snow_wisp = (f) => {
    const c = make(3.5);
    const wing = 'M0 0C-4-12-14-22-26-22C-24-12-14-3 0 0Z';
    const wingFill = c.lin([[0, '#ffffff', 0.95], [1, ICE, 0.55]]);
    const wings = (a, sc) => g(c.P(wing, wingFill), `translate(46 47) rotate(${a}) scale(${sc})`);
    const rot = f ? 12 : 0;
    let arms = '';
    for (let k = 0; k < 6; k++) {
      const a = ((k * 60 - 90 + rot) * Math.PI) / 180;
      const p = (r, da = 0) => `${H.n(50 + Math.cos(a + da) * r)} ${H.n(52 + Math.sin(a + da) * r)}`;
      arms += `M50 52L${p(32)}M${p(20)}L${p(29, 0.45)}M${p(20)}L${p(29, -0.45)}`;
    }
    const bob = f ? 2 : -1;
    return c.out(
      g(
        `<circle cx="50" cy="52" r="30" fill="${ICE}" opacity=".45" stroke="none" ${c.soft()}/>` +
        wings(f ? -52 : -14, 1.15) + wings(f ? -20 : 18, 1.3) +
        c.limb(arms, 5.5, '#dff7ff') +
        c.L(arms, ICE, 2) +
        c.E(50, 52, 15, 15, c.body('#bfefff', 0.6, -0.2)) +
        c.eye(54, 50, 3.6) + c.eye(63, 50, 3.2) +
        c.shine(44, 45, 5, 3, 0.7),
        `translate(0 ${bob})`
      )
    );
  };

  D.ice_tortoise = (f) => {
    const c = make(3);
    const skin = '#8b92a0';
    const skinD = sh(skin, -0.3);
    const s = f ? -1 : 1;
    const ice = c.lin([[0, '#f4fdff'], [0.45, '#9fe6ff'], [1, '#3aa6d4']]);
    return c.out(
      c.leg(30, 72, -2 * s, 12, skinD) + c.leg(64, 72, 2 * s, 12, skinD) +
      g(
        c.P('M20 72L9 76L20 79Z', skin) +
        c.P('M15 66L20 48L28 42L32 25L42 31L50 9L58 25L67 21L72 38L80 45L85 66Z', ice) +
        c.Pn('M20 48L28 42L32 25L42 31L50 9L46 40L38 44L30 52Z', '#ffffff', 0.45) +
        c.L('M50 9L46 40L32 25M46 40L67 21M46 40L72 38M46 40L38 44L28 42M38 44L30 60M46 40L58 56', '#ffffff', 1.8, ' opacity=".8"') +
        c.L('M58 56L72 38M58 56L80 45', '#2a86b4', 1.4, ' opacity=".6"') +
        c.P('M11 70C13 60 87 60 89 70C82 79 18 79 11 70Z', c.body('#7d8696', 0.3)) +
        c.L('M24 64L22 76M38 63L37 77M52 63V77M66 63L67 77M78 64L80 76', sh('#7d8696', -0.4), 1.6) +
        c.P(f ? 'M78 66C80 58 88 56 93 60C97 64 96 71 92 73C87 76 80 74 78 70Z' : 'M76 67C78 59 86 57 91 61C95 65 94 72 90 74C85 77 78 75 76 71Z', c.body(skin, 0.35)) +
        c.eye(f ? 87 : 85, f ? 63 : 64, 3) + c.L(f ? 'M87 70L94 69' : 'M85 71L92 70', OL, 1.6) +
        c.shine(36, 34, 4, 9, 0.6, 20),
        f ? 'translate(0 -1)' : ''
      ) +
      c.leg(38, 74, 2 * s, 12, skin) + c.leg(72, 74, -2 * s, 12, skin)
    );
  };

  D.avalanche_golem = (f) => {
    const c = make(3);
    const rock = '#7f8797';
    const rockD = sh(rock, -0.3);
    const snow = c.lin([[0, '#ffffff'], [1, '#bfe6f5']]);
    const s = f ? -1 : 1;
    const dots = f ? [[86, 60, 1.6], [16, 64, 1.4], [74, 82, 1.4], [28, 80, 1.6], [90, 74, 1.2]] : [[84, 52, 1.4], [18, 56, 1.6], [78, 76, 1.6], [26, 72, 1.4], [92, 66, 1.2]];
    return c.out(
      c.limb(`M32 40Q22 52 ${22 - 3 * s} 66`, 11, rockD) + c.E(21 - 3 * s, 70, 9, 8, rockD) +
      c.leg(40, 70, -4 * s, 13, rockD) +
      g(
        c.P('M22 44C20 26 36 16 54 17C72 18 82 30 80 46C78 62 68 72 52 73C36 73 24 62 22 44Z', c.body(rock, 0.35)) +
        c.L('M34 50L40 56L38 64M62 52L70 60M48 40L54 46', rockD, 2) +
        c.P('M22 38C23 23 39 15 54 16C69 17 80 26 81 40C75 35 70 40 64 35C58 40 52 33 46 38C40 33 33 40 22 38Z', snow) +
        c.Pn('M30 38C30 42 34 44 34 40ZM58 38C58 44 62 44 62 39Z', '#ffffff', 0.9) +
        c.P('M58 25C58 16 66 12 74 13C82 15 85 24 81 31C77 36 65 36 60 31Z', c.body(rock, 0.3)) +
        c.P('M57 22C59 14 67 10 75 12C80 14 84 19 84 24C79 21 75 25 71 22C67 25 62 21 57 22Z', snow) +
        c.P('M65 25L82 24L81 30L65 30Z', '#241b2c') +
        c.eye(71, 27.5, 2.2, false) + c.eye(78, 27, 2, false) +
        c.mist(dots, '#ffffff', 0.9),
        f ? 'translate(0 -1)' : ''
      ) +
      c.leg(60, 70, 4 * s, 13, rock) +
      c.limb(`M72 40Q86 50 ${82 + 4 * s} 64`, 12, rock) + c.E(83 + 4 * s, 70, 10, 9, c.body(rock, 0.3)) +
      c.P(`M${75 + 4 * s} 64C${78 + 4 * s} 59 ${88 + 4 * s} 59 ${91 + 4 * s} 64C${86 + 4 * s} 63 ${80 + 4 * s} 66 ${75 + 4 * s} 64Z`, snow)
    );
  };

  D.snowball_golem = (f) => {
    const c = make(3.5);
    const stone = '#7d8594';
    const rock = (x, y, sc, col) => g(c.P('M-9-3L-4-9L5-8L10-1L7 7L-3 9L-9 4Z', c.body(col, 0.3)), `translate(${x} ${y}) scale(${sc})`);
    const r = f ? 25 : 0;
    const a = f ? 6 : -6;
    return c.out(
      c.limb(`M30 60L16 ${60 + a}`, 7, sh(stone, -0.3)) + rock(13, 60 + a, 1.05, sh(stone, -0.25)) +
      c.E(48, 59, 30, 29, c.body('#eef6fb', 0.3, -0.28)) +
      g(c.L('M30 44C34 40 40 38 46 38M24 64C28 72 36 78 46 80M60 78C66 76 72 70 74 64', '#9fd3ea', 2.4) +
        c.E(30, 56, 2.5, 2, stone) + c.E(44, 76, 2, 1.6, stone), `rotate(${r} 48 59)`) +
      c.E(57, 51, 4.6, 5.4, '#2b2236') + c.E(70, 50, 4.2, 5, '#2b2236') +
      c.eye(57.5, 51, 2.4, false) + c.eye(70.5, 50, 2.2, false) +
      c.L('M58 64Q64 68 70 63', '#2b2236', 2.4) +
      c.shine(34, 42, 8, 4, 0.7) +
      c.limb(`M72 70L84 ${72 - a}`, 7, stone) + rock(87, 72 - a, 1.2, stone) +
      c.mist(f ? [[20, 86, 3], [12, 84, 2]] : [[22, 86, 2.5], [14, 82, 2]], '#ffffff', 0.85)
    );
  };

  D.yeti_shaman = (f) => {
    const c = make(3);
    const fur = '#d8dbe4';
    const furD = sh(fur, -0.3);
    const face = '#62607a';
    const s = f ? -1 : 1;
    const flame = f ? 'M84 4C89 9 92 13 90 18C88 22 80 22 78 18C76 13 81 10 84 4Z' : 'M83 3C88 7 93 12 91 18C89 22 81 22 79 18C77 13 79 8 83 3Z';
    return c.out(
      c.foot(36 - 3 * s, 10, 4.5, furD) +
      g(
        c.limb(`M30 46Q20 58 ${22 - 2 * s} 70`, 10, furD) + c.E(22 - 2 * s, 72, 6, 6, furD) +
        c.P('M27 86C21 84 19 77 23 71C17 67 17 59 23 55C19 49 23 41 31 41C35 35 44 32 52 32L62 32C72 34 78 42 76 50C82 54 82 62 76 66C80 72 78 80 72 82C70 87 64 88 58 86L40 86C34 88 30 88 27 86Z', c.body(fur, 0.3, -0.32)) +
        c.L('M30 62q-3 4-1 8M40 74q-2 4 0 8M62 72q2 4 0 8M66 58q3 3 2 7', furD, 2) +
        c.P('M26 47C34 39 56 37 73 43L72 51L68 56L64 51L60 57L56 51L52 57L48 51L44 57L40 51L36 56L32 51L27 54Z', c.body('#55688a', 0.3)) +
        c.E(42, 46, 2.2, 2.8, '#e8e0cc') + c.E(52, 46, 2.2, 2.8, ICE) + c.E(62, 46, 2.2, 2.8, '#e8e0cc') +
        c.P('M50 22C46 14 48 7 54 4C52 9 54 15 57 20Z', '#e8e0cc') +
        c.P('M44 34C40 20 48 10 60 10C72 10 79 20 77 32C75 40 66 44 58 44C50 44 46 40 44 34Z', c.body(fur, 0.35, -0.3)) +
        c.L('M50 14l-3 5M56 11l-1 5M46 24l-3 3', furD, 2) +
        c.P('M60 22C66 18 76 20 79 26C81 33 77 40 70 41C64 41 60 37 59 31Z', c.body(face, 0.3)) +
        c.P('M60 23C66 19 75 21 79 26L60 27Z', sh(face, -0.3)) +
        c.eye(66, 28, 2.7) + c.eye(74, 28, 2.4) +
        c.P('M66 36L67.5 39L69 36ZM72 36L73 39L74.5 36Z', '#ffffff') +
        c.P('M64 14C67 7 74 4 80 7C75 8 72 11 70 16Z', '#e8e0cc'),
        f ? 'translate(0 -1)' : ''
      ) +
      c.foot(58 + 3 * s, 10, 4.5, fur) +
      g(
        c.limb('M79 87L84 22', 4.5, '#e3dccb') +
        c.E(81.5, 62, 3.5, 2.5, '#e3dccb') +
        c.E(84, 24, 6, 5, c.body('#e8e0cc', 0.3)) + c.En(82, 24, 1.3, 1.6, OL) + c.En(86.5, 24, 1.3, 1.6, OL) +
        `<path d="${flame}" fill="${ICE}" stroke="none" opacity=".7" ${c.soft()}/>` +
        c.P(flame, c.lin([[0, '#ffffff'], [0.5, ICE], [1, '#2a86b4']])) +
        c.limb('M66 48Q74 54 81 52', 10, fur) + c.E(82, 52, 6, 6, c.body(fur, 0.3)),
        f ? 'translate(0 -1)' : ''
      )
    );
  };

  D.rime_wraith = (f) => {
    const c = make(3);
    const cloth = c.lin([[0, '#f4fdff', 0.95], [0.5, '#a9e4f7', 0.8], [1, '#5fb8dc', 0.55]]);
    const hem = f ? 'L22 84L31 79L37 88L46 80L54 89L62 80L70 87L75 78L83 82' : 'L24 86L32 80L39 87L47 81L55 88L62 81L69 88L75 79L81 85';
    return c.out(
      g(
        c.mist(f ? [[30, 88, 3], [64, 89, 2.5]] : [[40, 89, 2.5], [74, 88, 3]], ICE_L, 0.7) +
        c.P(`M38 26C32 40 30 56 26 72${hem}L76 68C72 56 70 44 68 36Z`, cloth) +
        c.L('M40 50l6 4l-2 6M56 66l4-5l6 2M36 70l4 3', '#ffffff', 1.6, ' opacity=".8"') +
        c.P('M48 9C62 9 72 19 73 33C73 39 70 44 66 46L44 46C36 40 34 30 36 22C38 14 42 9 48 9Z', cloth) +
        c.E(61, 31, 9, 10, c.rad([[0, '#3a3450'], [1, '#141020']], 0.6, 0.5, 0.6)) +
        c.eye(59, 30, 2.6, false) + c.eye(66, 30, 2.3, false) +
        c.P(f ? 'M60 48C68 48 76 50 84 54L80 62C74 60 66 60 60 58Z' : 'M60 48C68 50 76 54 82 60L76 66C72 62 66 60 60 58Z', cloth) +
        c.L(f ? 'M83 56l7-2M82 59l7 1M81 61l5 4' : 'M81 62l7 0M79 64l6 3M77 66l3 5', '#e6f8ff', 2.5) +
        c.shine(46, 18, 4, 7, 0.6, 20),
        `rotate(${f ? 2 : -2} 50 90)`
      )
    );
  };

  D.ice_shieldbearer = (f) => {
    const c = make(3);
    const armor = '#8a90a2';
    const armorD = sh(armor, -0.32);
    const s = f ? -1 : 1;
    const ice = c.lin([[0, '#f4fdff', 0.95], [0.5, '#8fdcff', 0.88], [1, '#2a8cc0', 0.88]], 'd');
    return c.out(
      c.leg(42, 66, -6 * s, 9, armorD) + c.foot(42 - 6 * s + 2, 6, 3, sh(armorD, -0.2)) +
      g(
        c.limb('M24 88L30 12', 4, '#8a6a48') + c.P('M27 14L31 2L35 15Z', c.lin([[0, '#ffffff'], [1, ICE]])) +
        c.limb('M34 42L28 54', 7, armorD) +
        c.P('M32 38C36 32 54 32 58 36L58 64L32 64Z', c.body(armor, 0.35)) +
        c.P('M32 60L58 60L60 70L30 70Z', sh(armor, -0.12)) +
        c.mist([[34, 35, 4], [40, 33, 4], [47, 33, 4], [54, 34, 4]], '#eef2f8', 1) +
        c.P('M32 22C32 12 40 7 46 7C54 7 60 13 60 22L60 32L32 32Z', c.body(armor, 0.4)) +
        c.P('M46 2L50 8L42 8Z', ICE) +
        c.P('M44 19L60 19L60 25L44 25Z', '#241b2c') +
        c.eye(50, 22, 2, false) + c.eye(56, 22, 1.8, false),
        f ? 'translate(0 -1)' : ''
      ) +
      c.leg(52, 66, 6 * s, 9, armor) + c.foot(52 + 6 * s + 2, 6, 3, armorD) +
      g(
        c.P('M60 27L80 22L90 34L89 62L75 85L60 77L56 42Z', ice) +
        c.Pn('M60 27L80 22L74 40L62 46Z', '#ffffff', 0.5) +
        c.L('M68 32L73 44L66 52L74 62L70 72M73 44L83 47', OL, 2.2) +
        c.L('M69 33L74 44L67 52L75 62', '#ffffff', 0.9) +
        c.L('M60 27L80 22L90 34', '#ffffff', 1.4, ' opacity=".8"'),
        f ? 'translate(0 -1)' : ''
      )
    );
  };

  D.whitehorn = (f) => {
    const c = make(3);
    const fur = '#dde1ea';
    const furD = sh(fur, -0.32);
    const hoof = '#4a4458';
    const s = f ? -1 : 1;
    const legH = (x, y, dx, col, bend) => {
      const fy = 90 - 3.25 - 3 - 3;
      return c.leg(x, y, dx, 6.5, col, 3, bend) + c.P(`M${x + dx - 4} ${fy + 1}L${x + dx + 4} ${fy + 1}L${x + dx + 5} 88.5L${x + dx - 4} 88.5Z`, hoof);
    };
    const iceG = c.lin([[0, '#ffffff'], [1, '#7fdcff']]);
    const frost = (x) => c.P(`M${x - 9} 88.5L${x - 7} 80L${x - 4} 88.5ZM${x + 5} 88.5L${x + 8} 78L${x + 11} 88.5Z`, iceG);
    const tip = (x, y, a, l) => g(c.P(`M0 3L${l} 0L0 -3L-2 0Z`, iceG), `translate(${x} ${y}) rotate(${a})`);
    const antler = (dx, dy, col, tipF) => {
      const t = (x, y) => [x + dx, y + dy];
      const p = (pts) => pts.map(([x, y]) => t(x, y).join(' '));
      const beam = `M${p([[80, 24]])}C${p([[76, 15], [68, 12], [56, 11]]).join(' ')}M${p([[75, 17]])}L${p([[78, 9]])}M${p([[68, 13]])}L${p([[67, 7]])}M${p([[60, 11.5]])}L${p([[55, 6]])}M${p([[79, 20]])}L${p([[88, 14]])}`;
      return c.limb(beam, 4.5, col) +
        (tipF ? tip(...t(78, 9), -80, 7) + tip(...t(67, 7), -95, 6.5) + tip(...t(55, 6), -125, 7) + tip(...t(88, 14), -40, 7) + tip(...t(56, 11), 180, 7) : '');
    };
    return c.out(
      legH(28, 62, 5 * s, furD, -3) + legH(64, 62, -5 * s, furD, 2) +
      g(
        `<ellipse cx="72" cy="16" rx="20" ry="9" fill="${ICE}" opacity=".45" stroke="none" ${c.soft()}/>` +
        antler(-5, 1, '#7fb8d4', false) +
        c.P('M18 50C10 48 8 42 12 40C16 42 18 44 20 46Z', '#ffffff') +
        c.P('M16 54C16 44 24 38 36 38L60 38C70 38 76 44 76 52C76 62 70 68 60 68L32 68C22 68 16 62 16 54Z', c.body(fur, 0.35, -0.3)) +
        c.Pn('M24 60C30 64 50 66 64 62C60 66 34 68 24 60Z', '#9fb4c8', 0.5) +
        c.L('M30 50q6-6 12 0t12 0M40 58q5-4 10 0', '#a9d8ee', 2, ' opacity=".8"') +
        c.P('M60 46C63 36 70 28 76 26L87 32C83 38 78 46 76 56Z', c.body(fur, 0.3, -0.3)) +
        c.P('M64 38C70 40 74 46 76 56C72 58 70 54 68 52C66 54 62 50 60 48Z', '#f6f8fc') +
        c.P('M76 24L67 17L78 20Z', furD) +
        c.P('M73 27C76 21 85 20 89 24L97 31C98 35 96 37 92 37L84 39C78 39 74 35 73 30Z', c.body(fur, 0.35, -0.3)) +
        c.E(96, 32.5, 1.8, 1.6, OL) +
        c.En(83, 29, 5, 3.4, '#a9b8cc', 0.55) +
        c.eye(84, 28.5, 2.8) +
        antler(0, 0, '#d8f5ff', true) +
        c.shine(34, 44, 10, 3.5, 0.55, -5),
        f ? 'translate(0 -1)' : ''
      ) +
      legH(32, 63, -5 * s, fur, -3) + legH(68, 63, 5 * s, fur, 2) +
      frost(32 - 5 * s) + frost(68 + 5 * s) +
      c.mist(f ? [[96, 41, 2.5], [92, 44, 2]] : [[97, 40, 2], [93, 43, 2.5]], ICE_L, 0.8)
    );
  };

})();
