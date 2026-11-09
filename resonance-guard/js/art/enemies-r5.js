'use strict';

/* 적 그림 — 5지역 깨진 대종 (공용 도구: enemies.js) */
(() => {
  const { H, OL, sh, GREY, GREY_L, MISTC, HALO, GREEN, ICE, ICE_L, EMBER, EMBER_L, VOLT, SEA, BELL, GOLD, BRONZE, make, g, zig } = RG.art._en;
  const D = RG.art._en.D;

  /* =========================================================
   * 5지역 · 깨진 대종
   * ========================================================= */
  D.grey_legionnaire = (f) => {
    const c = make(3);
    const steel = '#8e8c9e';
    const steelD = sh(steel, -0.32);
    const s = f ? -1 : 1;
    const shieldF = c.lin([[0, '#a9a5bc'], [1, '#5e5a70']], 'h');
    return c.out(
      c.leg(42, 64, -5 * s, 9, steelD, f ? 0 : 3) + c.foot(42 - 5 * s + 2, 6, 3, sh(steelD, -0.2), f ? 0 : 3) +
      g(
        c.limb('M30 88L36 8', 3.5, '#6a5a4a') + c.P('M33 12L37 0L41 12L37 15Z', c.lin([[0, '#fff1c0'], [1, GOLD]])) +
        c.limb('M38 40L32 50', 7, steelD) +
        c.P('M34 36C38 31 58 31 62 36L62 62L34 62Z', c.body(steel, 0.35)) +
        c.L('M34 46H62', GOLD, 1.8) +
        c.P('M33 58L63 58L65 70L31 70Z', c.body(sh(steel, -0.1), 0.3)) +
        c.L('M40 59L39 70M48 59V70M56 59L57 70', steelD, 1.6) +
        c.P('M30 38C30 30 40 28 44 34L42 44L30 44Z', c.body(steel, 0.4)) +
        c.P('M38 22C38 11 46 5 54 5C63 5 69 11 69 22L69 32C63 37 44 37 38 32Z', c.body(steel, 0.45, -0.35)) +
        c.P('M50 4C52 0 60 0 62 4L60 8L52 8Z', GOLD) +
        `<path d="M54 22H69" stroke="#fff" stroke-width="5" opacity=".45" ${c.soft()}/>` + c.L('M55 22H68', '#ffffff', 2) +
        c.shine(45, 14, 3, 6, 0.45, 10),
        f ? 'translate(0 -1)' : ''
      ) +
      c.leg(54, 64, 5 * s, 9, steel, f ? 3 : 0) + c.foot(54 + 5 * s + 2, 6, 3, steelD, f ? 3 : 0) +
      g(
        c.P('M58 30L86 27L88 79L60 83Z', shieldF) +
        c.L('M62 33L83 31L85 75L64 78Z', GOLD, 2) +
        c.P('M73 44C69 44 68 48 68 54L66 58L82 57L80 53C80 47 78 44 73 44Z', GOLD) + c.E(74, 59, 2, 1.6, GOLD),
        f ? 'translate(0 -1)' : ''
      )
    );
  };

  D.hush_monk = (f) => {
    const c = make(3);
    const robe = '#8a849c';
    const s = f ? -1 : 1;
    const bell = (x, y) => c.L(`M${x} ${y - 9}V${y - 5}`, '#e8e2f0', 2.4) +
      c.P(`M${x - 6} ${y + 6}C${x - 6} ${y - 2} ${x - 4} ${y - 6} ${x} ${y - 6}C${x + 4} ${y - 6} ${x + 6} ${y - 2} ${x + 6} ${y + 6}L${x + 8} ${y + 8}L${x - 8} ${y + 8}Z`, c.body('#c9a85a', 0.35)) +
      c.L(`M${x - 6} ${y + 1}L${x + 6} ${y + 1}`, '#e8e2f0', 2.4);
    return c.out(
      c.foot(42 - 4 * s, 6, 3, '#4a4458') + c.foot(58 + 4 * s, 6, 3, '#5a5468') +
      g(
        c.P('M36 38C40 32 60 32 64 38L70 84L60 81L50 85L40 81L30 84Z', c.body(robe, 0.3)) +
        c.L('M48 50L46 82M58 54L60 80', sh(robe, -0.3), 1.6) +
        c.P('M38 52C46 56 56 56 64 52L64 57C56 61 46 61 38 57Z', '#5a4a78') +
        c.limb('M46 58L44 70', 2.5, '#5a4a78') +
        c.P('M38 24C38 12 48 6 57 6C67 6 74 14 74 25L74 36C68 42 44 42 38 36Z', c.body(robe, 0.4, -0.3)) +
        c.P('M60 14C64 12 72 13 75 17L76 34L60 34Z', c.rad([[0, '#3a3450'], [1, '#161020']], 0.6, 0.4, 0.7)) +
        c.P('M46 34L44 46L49 44L50 35Z', sh('#b9b1ca', -0.15)) +
        c.P('M44 26C54 22 70 22 77 25L77 33C70 36 54 37 45 34Z', c.body('#b9b1ca', 0.3)) +
        c.L('M60 24L57 35M70 24L67 35', sh('#b9b1ca', -0.25), 1.4) +
        c.eye(65.5, 20, 2, false) + c.eye(72.5, 20, 1.8, false) +
        c.E(44, 42, 2, 2, '#4a4458') + c.E(50, 44, 2, 2, '#4a4458') + c.E(56, 44, 2, 2, '#4a4458') + c.E(62, 42, 2, 2, '#4a4458'),
        f ? 'translate(0 -1)' : ''
      ) +
      g(
        c.limb('M60 44Q70 48 76 46', 7, robe) + c.E(77, 46, 3.4, 3.4, '#cfc8d6') +
        bell(78, 58),
        f ? 'translate(0 -1) rotate(-4 77 46)' : 'rotate(4 77 46)'
      )
    );
  };

  D.void_stalker = (f) => {
    const c = make(3);
    const dk = '#2c2440';
    const DARK = '#d14fc0';
    const L = f ? [6, 1, -5, -9] : [-12, -6, 9, 14];
    const smoke = f ? [[16, 40, 4], [8, 36, 3], [30, 34, 3], [44, 32, 2.5], [4, 30, 2]] : [[18, 38, 3.5], [10, 34, 3], [32, 32, 3.2], [46, 31, 2.4], [6, 28, 2.2]];
    return c.out(
      c.mist(smoke, '#5a4a78', 0.6) +
      g(
        c.leg(28, 60, L[0], 6, '#1c1628', 0, -4) + c.leg(64, 58, L[2], 6, '#1c1628', 0, 3) +
        c.limb(f ? 'M20 52C10 48 8 38 4 34' : 'M20 52C10 50 6 42 2 40', 4, dk) +
        c.P('M16 54C16 44 28 40 42 42C54 43 60 40 68 41C76 43 80 50 78 56C76 63 68 66 58 64L32 64C22 64 16 60 16 54Z', c.body(dk, 0.35, -0.3)) +
        c.L('M30 48C38 46 46 50 52 48M36 56C42 54 50 58 58 55', DARK, 2.2, ` opacity=".85"`) +
        c.P('M66 36L66 24L73 33Z', dk) +
        c.P('M62 44C64 36 72 32 80 34C88 36 94 42 95 47C90 52 80 54 72 52C66 50 62 48 62 44Z', c.body(dk, 0.35)) +
        c.P('M72 34L74 22L80 33Z', sh(dk, 0.1)) +
        c.E(84, 42, 9, 6, DARK, ` opacity=".35" stroke="none" ${c.soft()}`) +
        c.P('M78 41L88 39L87 43L79 44Z', '#ffffff', ` stroke="none" ${c.glow()}`) +
        c.leg(32, 61, L[1], 6.5, '#3a3054', 0, -4) + c.leg(68, 59, L[3], 6.5, '#3a3054', 0, 3),
        `${f ? 'translate(0 -2) ' : ''}`
      ) +
      c.mist(f ? [[70, 70, 2.5], [40, 70, 2]] : [[60, 70, 2], [30, 70, 2.5]], '#5a4a78', 0.5)
    );
  };

  D.ashen_paladin = (f) => {
    const c = make(3);
    const plate = '#d6d2ca';
    const plateD = sh(plate, -0.32);
    const s = f ? -1 : 1;
    const crk = (d) => c.L(d, '#5a5468', 1.6);
    return c.out(
      `<ellipse cx="46" cy="18" rx="17" ry="17" fill="none" stroke="${GOLD}" stroke-width="5" stroke-dasharray="18 7 26 9" opacity=".35" ${c.soft()}/>` +
      `<ellipse cx="46" cy="18" rx="17" ry="17" fill="none" stroke="#f1dc9a" stroke-width="2" stroke-dasharray="18 7 26 9" opacity=".8"/>` +
      c.P(f ? 'M30 34C24 50 20 66 14 82L22 78L26 84L32 78L38 82L40 40Z' : 'M30 34C24 50 18 66 12 80L20 77L23 84L30 78L36 83L40 40Z', c.body('#7a7488', 0.25)) +
      c.leg(40, 64, -6 * s, 10, plateD) + c.foot(40 - 6 * s + 2, 6.5, 3.2, sh(plateD, -0.2)) +
      g(
        c.limb('M36 38L28 52L32 62', 8, plateD) +
        c.P('M32 34C38 28 60 28 66 34L64 62C58 66 40 66 34 62Z', c.body(plate, 0.3, -0.35)) +
        crk('M44 34L46 42L42 48L46 56') + crk('M58 40L54 46') +
        c.P('M46 38L52 38L52 50L46 50Z', c.body(GOLD, 0.2, -0.3)) + c.P('M42 42L56 42L56 46L42 46Z', c.body(GOLD, 0.2, -0.3)) +
        c.P('M33 58L65 58L67 70L31 70Z', c.body(plateD, 0.3)) +
        c.P('M36 20C36 9 44 4 52 4C61 4 67 10 67 20L67 30C61 35 42 35 36 30Z', c.body(plate, 0.4, -0.35)) +
        c.P('M54 18L68 18L68 23L54 23Z', '#241b2c') +
        c.eye(61, 20.5, 2, false) + c.eye(66, 20.5, 1.7, false) +
        crk('M42 8L44 16L40 22') +
        c.P('M49 5C49 0 57 0 57 5Z', GOLD),
        f ? 'translate(0 -1)' : ''
      ) +
      c.leg(56, 64, 6 * s, 10, plate) + c.foot(56 + 6 * s + 2, 6.5, 3.2, plateD) +
      g(
        g(c.P('M-3.5 0L3.5 0L3.5 39L0 45L-3.5 39Z', c.lin([[0, '#c4c2cc'], [1, '#7e7a8c']], 'h')) +
          c.L('M0 8L-1 18L1 26', '#5a5468', 1.4) +
          c.P('M-11 0L11 0L11 4L-11 4Z', c.body('#b89a50', 0.3)) + c.P('M-2.5 4L2.5 4L2.5 12L-2.5 12Z', '#6a5a4a') + c.E(0, 14, 3.4, 3.4, '#b89a50'),
        `translate(78 46) rotate(${f ? 200 : 210})`) +
        c.P('M58 32C66 28 74 32 74 40L70 44L58 42Z', c.body(plate, 0.4)) +
        c.limb('M68 40L74 48L78 48', 8, plate) + c.E(78, 47, 4.4, 4.4, plateD),
        f ? 'translate(0 -1)' : ''
      )
    );
  };

  D.echo_shade = (f) => {
    const c = make(3);
    const s = f ? -1 : 1;
    const fig = (fill, legC) =>
      c.leg(44, 62, -6 * s, 7, legC) + c.leg(56, 62, 6 * s, 7, legC) +
      c.P('M36 40C38 34 46 32 50 32C56 32 64 34 66 40L66 68L60 63L55 69L50 64L45 69L40 63L36 68Z', fill) +
      c.limb(`M40 42Q30 52 ${34 - 3 * s} 62`, 6, legC) + c.limb(`M62 42Q72 50 ${74 + 3 * s} 58`, 6, legC) +
      c.P('M40 26C38 12 46 8 52 8C58 8 66 12 65 24C65 32 60 36 52 36C46 36 41 32 40 26ZM42 18C36 14 32 16 28 12C34 10 38 10 44 13Z', fill);
    const body = '#4c4462';
    return c.out(
      `<g opacity=".45" stroke="#c4b6ff" transform="translate(${f ? -12 : -9} ${f ? 1 : 0})">${fig('#6a5a9a', '#6a5a9a')}</g>` +
      `<g opacity=".35" stroke="#c4b6ff" transform="translate(${f ? 7 : 10} ${f ? -1 : 0})">${fig('#6a5a9a', '#6a5a9a')}</g>` +
      g(
        fig(c.body(body, 0.35, -0.3), sh(body, -0.2)) +
        c.L('M40 40C46 44 56 44 62 40', '#8f7fc0', 1.8, ' opacity=".8"') +
        c.eye(56, 21, 2.8) + c.eye(63, 21, 2.4) +
        c.L('M42 22C42 15 46 11 52 11', '#b8a8e8', 2, ' opacity=".7"'),
        f ? 'translate(0 -1)' : ''
      )
    );
  };

  D.bellshard_golem = (f) => {
    const c = make(3);
    const br = c.body(BRONZE, 0.35, -0.4);
    const brD = c.body(sh(BRONZE, -0.25), 0.3, -0.35);
    const pat = '#6fa89a';
    const s = f ? -1 : 1;
    const shard = (d, fill = br) => c.P(d, fill);
    return c.out(
      c.limb(`M32 38Q22 48 ${20 - 3 * s} 58`, 10, sh(BRONZE, -0.4)) + shard(`M${12 - 3 * s} 58L${28 - 3 * s} 56L${26 - 3 * s} 72L${14 - 3 * s} 70Z`, brD) +
      c.leg(40, 68, -4 * s, 12, sh(BRONZE, -0.4)) +
      g(
        `<ellipse cx="50" cy="46" rx="26" ry="24" fill="${BELL}" opacity=".7" stroke="none" ${c.soft()}/>` +
        c.E(50, 46, 24, 22, '#3a3248') +
        shard('M26 30C32 20 46 18 52 20L48 46L24 44Z') +
        shard('M56 20C68 22 78 30 78 42L54 46Z') +
        shard('M24 48L48 50L46 72L30 70C26 64 24 56 24 48Z', brD) +
        shard('M52 50L78 46C78 58 72 68 62 72L50 72Z') +
        c.L('M28 34C36 28 44 26 50 26M58 26C66 28 72 32 75 38', pat, 2.4) + c.L('M28 62L44 64M54 64L66 66', pat, 2.4) +
        c.L('M38 22L42 32L36 38', OL, 1.8) +
        `<circle cx="51" cy="48" r="5" fill="${BELL}" opacity=".9" stroke="none" ${c.soft()}/>` + c.E(51, 48, 2.6, 2.6, '#f2eefa', ' stroke="none"') +
        c.P('M54 8C54 2 66 2 66 8L68 20L52 20Z', br) + c.E(60, 3.5, 3, 2.2, br) +
        c.P('M48 22C48 18 72 18 72 22L74 24L46 24Z', brD) +
        c.P('M54 12L68 12L68 16L54 16Z', '#241b2c') + c.eye(60, 14, 1.6, false) + c.eye(65, 14, 1.4, false),
        f ? 'translate(0 -1)' : ''
      ) +
      c.leg(60, 68, 4 * s, 12, sh(BRONZE, -0.15)) +
      c.limb(`M70 36Q82 46 ${82 + 3 * s} 56`, 11, sh(BRONZE, -0.15)) +
      shard(`M${74 + 3 * s} 54L${92 + 3 * s} 52L${92 + 3 * s} 66C${88 + 3 * s} 72 ${78 + 3 * s} 72 ${74 + 3 * s} 66Z`) +
      c.L(`M${76 + 3 * s} 64L${90 + 3 * s} 63`, pat, 2.2)
    );
  };

  D.silent_drake = (f) => {
    const c = make(3);
    const scale = '#7f7b92';
    const memb = '#9c90b8';
    const wing = 'M0 0L-10-30L-16-24L-26-34L-30-24L-42-28L-40-16L-50-14C-40-4-20 2 0 0Z';
    const wingG = (a, fill, sc) => g(c.P(wing, fill) + c.L('M0 0L-10-30M-4-1L-26-34M-10-1L-42-28', sh(scale, -0.35), 1.8), `translate(48 44) rotate(${a}) scale(${sc})`);
    const bob = f ? 3 : -1;
    return c.out(
      g(
        wingG(f ? -60 : 18, c.lin([[0, sh(memb, -0.3)], [1, sh(memb, -0.5)]]), 0.8) +
        c.limb('M30 52C20 54 12 60 8 70', 6, scale) + c.P('M8 70L1 66L4 78L12 74Z', GOLD) +
        c.limb('M42 58L38 68M52 58L50 68', 5, sh(scale, -0.3)) +
        c.P('M26 50C30 40 44 38 56 40C66 42 72 46 74 52C70 60 60 62 48 62C38 62 30 58 26 50Z', c.body(scale, 0.35)) +
        c.P('M34 58C42 62 58 62 68 56C62 62 44 64 34 58Z', '#c8b880') +
        c.limb('M66 46Q74 38 78 34', 8, scale) +
        c.P('M74 32C78 24 88 24 94 30L98 34C96 38 90 40 84 40C78 40 74 38 74 32Z', c.body(scale, 0.35)) +
        c.P('M78 27L72 18L82 25ZM83 26L82 16L88 26Z', c.lin([[0, '#fff1c0'], [1, GOLD]])) +
        c.eye(86, 31, 2.6) + c.L('M90 37L97 35', OL, 1.4) +
        wingG(f ? -95 : -8, c.lin([[0, memb], [1, sh(memb, -0.25)]]), 1),
        `translate(0 ${bob})`
      )
    );
  };

  D.resonance_eater = (f) => {
    const c = make(3);
    const shadow = '#3e3652';
    const fork = '#bdb6c8';
    const xs = [32, 44, 56, 68];
    let tents = '';
    let forks = '';
    xs.forEach((x, i) => {
      const w = (i % 2 ? 1 : -1) * (f ? 3 : -3);
      const ex = x + w;
      tents += `M${x} 54C${x + w} 62 ${x - w} 68 ${ex} 74`;
      forks += `M${ex} 74L${ex} 77M${ex - 3.5} 85.5L${ex - 3.5} 79Q${ex - 3.5} 76 ${ex} 76Q${ex + 3.5} 76 ${ex + 3.5} 79L${ex + 3.5} 85.5`;
    });
    const bell = f
      ? 'M24 54C22 32 36 18 50 18C64 18 78 32 76 54C70 58 64 54 58 58C52 54 48 58 42 54C36 58 30 54 24 54Z'
      : 'M22 52C20 32 34 20 50 20C66 20 80 32 78 52C72 57 66 52 60 56C54 52 46 56 40 52C34 57 28 52 22 52Z';
    return c.out(
      `<ellipse cx="50" cy="48" rx="40" ry="30" fill="none" stroke="${BELL}" stroke-width="2.4" stroke-dasharray="10 9" opacity=".7"/>` +
      c.limb(tents, 4, shadow) +
      c.limb(forks, 2.8, fork) +
      c.P(bell, c.rad([[0, '#8a7fa8', 0.95], [0.5, shadow, 0.95], [1, '#1c1628', 0.95]], 0.4, 0.3, 0.8)) +
      c.L(f ? 'M30 44Q50 36 70 44' : 'M30 42Q50 34 70 42', '#8f7fc0', 2, ' opacity=".8"') +
      c.E(58, 34, 9, 6, '#160f20') +
      c.eye(55, 34, 2.6, false) + c.eye(63, 34, 2.3, false) +
      c.shine(36, 30, 5, 3, 0.35) +
      `<path d="M14 30q-4 6 0 12M86 30q4 6 0 12" fill="none" stroke="${GOLD}" stroke-width="2" opacity=".5"/>`
    );
  };

  D.bellkeeper = (f) => {
    const c = make(3);
    const robe = '#7c768e';
    const robeD = sh(robe, -0.3);
    const s = f ? -1 : 1;
    const br = c.body(BRONZE, 0.4, -0.4);
    const mask = '#d9d2c2';
    return c.out(
      c.foot(46 - 4 * s, 7, 3.2, '#3a3448') +
      g(
        c.E(33, 6, 4.5, 3.6, 'none', ` stroke-width="3.5"`) +
        c.P('M19 54C19 32 23 13 33 10C43 13 48 32 48 54L55 61L12 61Z', br) +
        c.P('M12 61L55 61L54 65L13 65Z', c.body(sh(BRONZE, -0.2), 0.3)) +
        c.L('M21 26C28 24 38 24 46 26M19 48C30 46 38 46 49 48', sh(BRONZE, -0.45), 2) +
        c.L('M24 30C24 40 22 48 23 56', '#f0d890', 2, ' opacity=".6"') +
        c.L('M38 10L36 20L41 27L37 36', OL, 2.2) + c.L('M38 11L36 20L41 27', '#d8ccff', 1, ' opacity=".7"') +
        c.En(30, 40, 4, 3, '#6fa89a', 0.7) + c.En(42, 52, 3, 2, '#6fa89a', 0.7) +
        c.P('M38 32C44 26 62 26 68 32L76 86L65 82L55 87L45 82L34 86Z', c.body(robe, 0.3)) +
        c.L('M50 40L48 82M62 44L64 82', robeD, 1.8) +
        c.L('M40 32L66 56M44 30L68 50', '#4a3a30', 3.5) +
        c.P('M38 60L72 60L73 66L37 66Z', '#5a4a78') +
        c.L('M44 66L42 74', '#5a4a78', 3) +
        c.L('M60 66V70', '#c9c0d8', 1.6) + c.P('M57 75C57 71 63 71 63 75L64 77L56 77Z', c.body(GOLD, 0.3)) +
        c.P('M48 28C48 14 56 7 65 7C75 7 82 14 82 26L82 38L50 40Z', c.body('#4a4458', 0.3)) +
        c.P('M62 10C62 6 74 6 74 10C75 16 75 23 78 28L83 33L55 33L59 28C62 23 61 16 62 10Z', c.body(mask, 0.35, -0.35)) +
        c.E(68, 6.5, 2.6, 2, c.body(mask, 0.3)) +
        c.L('M62.5 21L67 18.5M70.5 18.5L75 21', '#241b2c', 3.6) +
        `<path d="M62.5 21L67 18.5M70.5 18.5L75 21" stroke="#fff" stroke-width="4" opacity=".6" ${c.soft()}/>` + c.L('M62.5 21L67 18.5M70.5 18.5L75 21', '#ffffff', 1.6) +
        c.L('M70 8L68 14L71 17L69 24', '#6a6070', 1.4) +
        c.L('M58 29H80', sh(mask, -0.35), 1.6),
        f ? 'translate(0 -1)' : ''
      ) +
      c.foot(62 + 4 * s, 7, 3.2, '#4a4458') +
      c.mist(f ? [[34, 87, 3], [48, 89, 2.5], [70, 88, 3]] : [[38, 88, 2.5], [56, 89, 3], [74, 87, 2.5]], MISTC, 0.6) +
      g(
        c.limb('M86 87L87 12', 4.5, '#7a5a40') +
        c.P('M78 6L96 6L96 16L78 16Z', c.body('#8a6a48', 0.3)) + c.P('M84 5L90 5L90 17L84 17Z', '#c9c0d8') +
        c.limb('M66 40Q78 46 85 46', 8, robe) + c.E(86, 46, 4, 4, '#c9c0d8'),
        f ? 'translate(0 -1)' : ''
      )
    );
  };

  D.the_silence = (f) => {
    const c = make(3);
    const ash = '#6c6582';
    const ashD = sh(ash, -0.3);
    const mantle = '#827a98';
    const bronze = sh(BRONZE, -0.1);
    const br = c.body(bronze, 0.4, -0.45);
    const crack = (d) => `<path d="${d}" fill="none" stroke="#d8ccff" stroke-width="5" opacity=".5" ${c.soft()}/>` + c.L(d, '#f4f0ff', 1.8);
    const motes = [[EMBER, 8, 24], [ICE, 22, 8], [VOLT, 94, 22], ['#8fcf5a', 5, 80], ['#ffe48a', 86, 6], ['#d14fc0', 96, 84]];
    const shard = (x, y, a, sc = 1) => g(c.P('M-6-4L6-6L5 4L-4 6Z', br), `translate(${x} ${y}) rotate(${a}) scale(${sc})`);
    const sw = f ? 2 : 0;
    const claw = (x, y, a, fill) => g(c.P('M-6-5C-2-8 6-6 8-2L17 1L8 3L15 8L6 6L9 13L2 7L-5 6Z', fill), `translate(${x} ${y}) rotate(${a})`);
    const head =
      c.P('M-17 14C-16 2-14-12-8-18L-4-21L-1-17L2-22L8-18C14-12 16 2 17 14Z', br) +
      c.L('M-15 3C-6 1 6 1 15 3', sh(bronze, -0.5), 2) +
      c.En(-9, -5, 3, 7, '#f6e2a0', 0.35) +
      c.L('M3-20L0-10L5-4L1 5', OL, 2.4) + c.L('M3-19L0-10L5-4L1 4', '#efeaff', 1.1, ' opacity=".85"') +
      c.E(0, 15, 20, 8.5, c.body(sh(bronze, 0.12), 0.3)) +
      c.E(0, 16, 16, 6.2, c.rad([[0, '#3a2a50'], [0.7, '#140c20'], [1, '#05030a']], 0.5, 0.4, 0.6)) +
      c.P('M9 8L14 10L12 13L18 14L19 19L14 17L11 20Z', '#140c20', ' stroke-width="2"') +
      c.eye(-5, 16, 2, false) + c.eye(5, 16, 1.8, false);
    return c.out(
      `<ellipse cx="54" cy="40" rx="40" ry="34" fill="${BELL}" opacity=".35" stroke="none" ${c.soft()}/>` +
      motes.map(([col, x, y], i) => c.spark(x + (f ? (i % 2 ? 2 : -2) : 0), y + (f ? -2 : 0), 1.6, col)).join('') +
      c.limb(`M20 46Q8 56 ${10 - sw} 70`, 10, ashD) + claw(10 - sw, 72, 100, ashD) +
      c.P('M30 56C28 66 26 76 22 84L78 84C74 76 72 66 70 56Z', c.body(ash, 0.25, -0.35)) +
      crack('M44 62L48 70L44 78') +
      c.cloud(f ? [[16, 85, 4], [26, 82, 7], [40, 81, 8], [56, 81, 8], [70, 82, 7], [82, 85, 4]] : [[15, 85, 4], [24, 82, 6], [38, 81, 8], [54, 81, 8], [68, 82, 7], [81, 84, 5]], c.body('#9a94ac', 0.3, -0.2)) +
      c.P(f ? 'M10 54C11 41 24 32 40 32L74 32C88 34 94 44 92 56L86 52L82 61L74 54L66 63L58 55L50 64L42 55L34 63L26 54L18 61Z' : 'M10 54C11 41 24 32 40 32L74 32C88 34 94 44 92 56L86 53L81 61L74 55L66 62L58 56L50 63L42 56L34 62L26 55L18 60Z', c.body(mantle, 0.3, -0.35)) +
      crack('M28 38L33 45L29 52') + crack('M76 40L71 47L76 53') +
      c.mist([[24, 36, 3], [34, 33, 3], [84, 38, 2.6]], '#d9d4e8', 0.55) +
      shard(f ? 10 : 12, f ? 36 : 38, 20) + shard(f ? 28 : 30, f ? 16 : 14, -30, 0.85) + shard(f ? 88 : 90, f ? 26 : 28, 50, 0.9) +
      g(head, `translate(58 ${f ? 28 : 27}) rotate(${f ? -24 : -28}) scale(1.15)`) +
      c.limb(`M82 46Q92 56 ${88 + sw} 68`, 11, mantle) + claw(88 + sw, 70, 80, c.body(mantle, 0.3))
    );
  };
})();
