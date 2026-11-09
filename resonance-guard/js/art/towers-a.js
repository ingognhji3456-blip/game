'use strict';

/* 탑 그림 — 🔥 불 · ❄ 얼음 · ⚡ 폭풍 (공용 도구: towers.js) */
(() => {
  const { OL, SC, VKEYS, f, M, STONE, ELEM, Ctx, poly, cyl, frus, ring, band, vseam, flame, crystal, orb, aura, spark, bolt, flag, cone, person, bow, plat, house, shard } = RG.art._tw;
  const T = RG.art._tw.T;

  /* ---------- 🔥 불씨 궁수탑 ---------- */
  T.ember_archer = {
    muzzle: [[72, 33], [69, 46], [67, 18], [79, 35], [67, 34]],
    draw(c, v) {
      const h = c.h;
      const st = STONE.fire;
      if (v === 1) {
        let o = plat(c, 1);
        // 뒷다리
        o += c.ol('M38 102L40 58M62 102L60 58', h.shade(M.wood, -0.25), 4.5);
        // 앞다리 + 버팀대
        o += c.ol('M33 76L66 100M67 76L34 100', M.wood, 3.2);
        o += c.ol('M29 109L31 58M71 109L69 58', M.wood, 5.5);
        // 뒷벽 + 궁수
        o += c.r(25, 40, 50, 10, h.shade(M.wood, -0.35), 1.5);
        o += person(c, 45, 43, 1.35, '#7a3b2a', '#9b3d24');
        o += bow(c, 60, 33, 13);
        // 앞 난간
        o += c.r(22, 48, 56, 16, c.vg(M.plank), 2);
        o += c.ln('M33 50V62M44 50V62M56 50V62M67 50V62M23 55H77', h.shade(M.plank, -0.35), 1.5);
        // 모서리 기둥
        o += c.p('M20 66V36L24 30L28 36V66Z', c.cg(M.wood), 2.6) + c.p('M72 66V36L76 30L80 36V66Z', c.cg(M.wood), 2.6);
        // 원소 포인트: 횃불
        o += c.r(73, 24, 6, 6, M.iron, 1, 2) + flame(c, 76, 25, 11, 16);
        return o;
      }
      if (v === 2) {
        let o = plat(c, 2, { stone: st });
        // 돌 받침(아래층)
        o += frus(c, 50, 70, 104, 24, 30, c.cg(st), null);
        o += c.ln(`${ring(50, 80, 26.5, 7.6)}${ring(50, 92, 28, 8.2)}M44 72V80M58 72V80M38 84V92M50 85V94M62 84V92M44 97V105M57 97V105`, h.shade(st, -0.38), 1.5);
        o += c.e(50, 70, 24, 7, c.vg(h.shade(st, 0.2)));
        // 나무 기둥 + 궁수
        o += c.ol('M31 70V30M69 70V30', M.wood, 4);
        o += person(c, 45, 54, 1.15, '#7a3b2a', '#9b3d24');
        o += bow(c, 59, 46, 11);
        // 난간
        o += c.r(24, 56, 52, 14, c.vg(M.plank), 2);
        o += c.ln('M37 58V68M50 58V68M63 58V68', h.shade(M.plank, -0.35), 1.5);
        // 지붕(원소 색 기와) + 등
        o += cone(c, 50, 30, 68, 28, '#c8462c', 0.22);
        o += c.ci(50, 3, 3, M.gold, 2);
        o += c.ol('M74 32V37', M.iron, 1.6) + c.ci(74, 40.5, 4, c.sg('#ffb347'), 2);
        return o;
      }
      if (v === 3) {
        let o = plat(c, 3, { stone: st });
        o += aura(c, 34, 12, 22, 20, '#ff9a3d', 0.55);
        // 석탑
        o += frus(c, 50, 40, 104, 25, 31, c.cg(st), null);
        o += c.ln(`${ring(50, 58, 26.5, 7.7)}${ring(50, 76, 28, 8.2)}${ring(50, 92, 30, 8.8)}`, h.shade(st, -0.38), 1.5);
        o += c.ln('M40 43V57M60 43V57M47 61V75M33 61V75M67 61V75M40 79V91M60 79V91M48 95V104', h.shade(st, -0.38), 1.5);
        o += band(c, 50, 64, 68, 27.5, 8, c.vg(M.gold, 0.35, -0.25));
        // 창문(불빛)
        o += c.p('M45 92V82Q50 76 55 82V92Z', c.vg('#ffb347', 0.3, -0.2), 2.4);
        // 성가퀴
        o += cyl(c, 50, 30, 40, 30, 9, c.cg(h.shade(st, 0.05)), c.vg(h.shade(st, -0.15), -0.2, 0.1));
        o += person(c, 44, 26, 1.05, '#7a3b2a', '#9b3d24');
        o += bow(c, 56, 18, 12);
        o += c.p('M20 30V20H28V26H36V20H44V30Z', c.cg(st), 2.4) + c.p('M56 30V20H64V26H72V20H80V30Z', c.cg(st), 2.4);
        o += band(c, 50, 30, 35, 30, 9, c.vg(M.bronze, 0.3, -0.2), 2.4);
        // 붉은 깃발 + 화로
        o += flag(c, 76, 22, 22, '#e0442a', 1, 16);
        o += c.p('M20 20L34 20L31 27H23Z', c.vg(M.iron, 0.3, -0.3), 2.4) + flame(c, 27, 20, 16, 22);
        return o;
      }
      if (v === 'A') {
        // 화염 저격대 — 높고 가는 첨탑, 긴 활을 든 저격수
        const dst = '#7d6a66';
        let o = plat(c, 4, { stone: dst, trim: '#e0442a' });
        o += aura(c, 62, 34, 26, 24, '#ff8a3d', 0.5);
        o += frus(c, 50, 52, 99, 15, 22, c.cg(dst), null);
        o += c.ln(`${ring(50, 66, 17, 5)}${ring(50, 82, 19.5, 5.8)}`, h.shade(dst, -0.4), 1.5);
        o += c.ln('M44 56V65M57 56V65M50 70V81M41 86V97M59 86V97', h.shade(dst, -0.4), 1.5);
        o += band(c, 50, 74, 78, 18.5, 5.5, c.vg(M.gold, 0.35, -0.25));
        o += c.p('M45 98V90Q50 84 55 90V99Z', c.vg('#ffb347'), 2.2);
        // 위쪽 기둥 + 뾰족 지붕
        o += cyl(c, 50, 22, 52, 11, 3.3, c.cg(dst), null);
        o += cone(c, 50, 24, 30, 24, '#c8462c');
        o += c.ci(50, 2, 2.6, M.gold, 2);
        // 저격수 + 난간
        o += person(c, 45, 42, 1.1, '#5a2a22', '#c23a22');
        o += cyl(c, 50, 50, 56, 22, 6.5, c.cg(M.bronze), null);
        o += c.e(50, 50, 22, 6.5, 'none', 2.4);
        // 긴 활
        o += c.ln('M58 14L53 37L58 60', '#f4ead8', 1.4);
        o += c.ol('M58 14Q76 37 58 60', '#4a2a1a', 2.8);
        o += c.ol('M53 37L76 35', M.rope, 1.6) + spark(c, 79, 34.5, 7, '#ffb347', 1.6) + c.ci(79, 34.5, 2, '#fff3b0', 0);
        return o;
      }
      // 'B' 연사 궁수대 — 넓은 2층 망루, 궁수 셋
      const bst = '#b09a8a';
      let o = plat(c, 4, { stone: bst, trim: '#e0442a' });
      // 1층(돌)
      o += c.p('M10 100V64H90V100Q50 112 10 100Z', c.cg(bst), 3);
      o += c.ln('M10 78Q50 86 90 78M30 65V78M70 65V78M40 82V96M60 82V96', h.shade(bst, -0.38), 1.5);
      o += c.p('M43 103V90Q50 83 57 90V104Z', c.vg('#5a3a2a', 0.1, -0.3), 2.4);
      // 2층 궁수 셋
      o += c.r(8, 32, 84, 12, h.shade(M.wood, -0.35), 1.5);
      o += c.ol('M12 64V22M88 64V22', M.wood, 4);
      o += person(c, 24, 42, 0.95, '#7a3b2a', '#9b3d24') + person(c, 50, 41, 1, '#7a3b2a', '#c23a22') + person(c, 76, 42, 0.95, '#7a3b2a', '#9b3d24');
      o += bow(c, 33, 35, 9, M.woodD, true, false) + bow(c, 59, 34, 9) + bow(c, 85, 35, 9, M.woodD, true, false);
      o += c.r(6, 46, 88, 18, c.vg(M.plank), 2);
      o += c.ln('M20 48V62M35 48V62M50 48V62M65 48V62M80 48V62M7 54H93', h.shade(M.plank, -0.35), 1.5);
      // 넓은 지붕 + 처마 등
      o += c.p('M2 24L18 2H82L98 24Q50 30 2 24Z', c.vg('#c8462c', 0.25, -0.25), 3);
      o += c.ln('M20 23L28 4M40 25L44 3M60 25L56 3M80 23L72 4', h.shade('#c8462c', -0.4), 1.5);
      o += c.ol('M7 24V28M93 24V28', M.iron, 1.6) + c.ci(7, 32, 4, c.sg('#ffb347'), 2) + c.ci(93, 32, 4, c.sg('#ffb347'), 2);
      return o;
    },
  };

  /* ---------- 🔥 화염 박격포 ---------- */
  /* 포신(세운 상태로 그린 뒤 기울임): 바닥 (x,y), 길이 L, 반지름 r */
  function mortarBarrel(c, x, y, L, r, ang, o = {}) {
    const h = c.h;
    const col = o.col || M.iron;
    const t = y - L;
    let b = c.ci(x, y, r * 1.12, c.sg(col), 3);
    b += frus(c, x, t + 4, y, r * 0.86, r, c.cg(col), null);
    (o.bands || []).forEach((k) => { b += band(c, x, y - L * k - 2, y - L * k + 2, r * (0.9 + 0.1 * (1 - k)), r * 0.3, c.vg(o.trim || h.shade(col, 0.25), 0.3, -0.3), 2); });
    if (o.dragon) {
      // 용 머리(세운 좌표): 왼쪽 = 기울이면 위쪽
      const R = r;
      const D = o.dragon;
      const P = (px, py) => `${f(x + px * R)} ${f(t + py * R)}`;
      b += cyl(c, x, t + 1, t + 8, R * 1.15, R * 0.38, c.cg(D), null) + c.e(x, t + 1, R * 1.0, R * 0.33, '#2a1610', 2.2);
      b += c.p(`M${P(-0.9, 0.5)}C${P(-1.4, 0.3)} ${P(-1.9, 0.1)} ${P(-2.3, -0.4)}C${P(-1.8, -0.1)} ${P(-1.4, 0)} ${P(-1.0, 0.1)}Z`, c.vg('#f6e7c8', 0.2, -0.3), 2.2);
      b += c.p(`M${P(-1.15, 0.9)}C${P(-1.35, 0.3)} ${P(-1.1, -0.5)} ${P(-0.55, -1.0)}L${P(0.1, -1.25)}L${P(0.0, -0.75)}L${P(-0.35, -0.5)}Q${P(-0.5, 0)} ${P(-0.35, 0.5)}Z`, c.cg(D), 2.6);
      b += c.p(`M${P(1.15, 0.9)}C${P(1.3, 0.4)} ${P(1.1, -0.2)} ${P(0.75, -0.6)}L${P(0.3, -0.3)}Q${P(0.4, 0.1)} ${P(0.35, 0.5)}Z`, c.cg(h.shade(D, -0.1)), 2.4);
      b += c.e(x - R * 0.8, t + R * 0.15, R * 0.2, R * 0.14, '#ffe14a', 1.6);
      b += flame(c, x, t + 2, R * 0.9, R * 1.3);
    } else if (o.plain !== false) {
      b += cyl(c, x, t, t + 6, r * 1.12, r * 0.38, c.cg(h.shade(col, 0.1)), null);
      b += c.e(x, t, r * 0.8, r * 0.26, '#2a1610', 2.2);
      b += c.e(x, t + 0.5, r * 0.55, r * 0.17, '#ff8a2a', 0) + c.e(x, t + 0.4, r * 0.28, r * 0.09, '#fff1a8', 0);
    }
    return `<g transform="rotate(${ang} ${x} ${y})">${b}</g>`;
  }
  function sandbag(c, x, y, k = 1) {
    return c.e(x, y, 9 * k, 5.5 * k, c.vg(M.sand, 0.25, -0.25), 2.4) + c.ln(`M${f(x - 3 * k)} ${f(y - 4 * k)}Q${f(x - 1 * k)} ${f(y)} ${f(x - 3 * k)} ${f(y + 4 * k)}`, c.h.shade(M.sand, -0.35), 1.4);
  }
  T.flame_mortar = {
    muzzle: [[70, 58], [72, 50], [80, 42], [20, 22], [50, 22]],
    draw(c, v) {
      const h = c.h;
      const st = STONE.fire;
      if (v === 1) {
        let o = plat(c, 1);
        o += sandbag(c, 26, 92) + sandbag(c, 74, 92);
        o += c.r(34, 84, 32, 18, c.vg(M.wood), 2, 3) + c.ln('M34 92H66', h.shade(M.wood, -0.35), 1.5);
        o += mortarBarrel(c, 50, 88, 36, 14, 32, { bands: [0.45] });
        o += c.p('M40 96L44 80H50L52 96Z', c.cg(M.wood), 2.4) + c.ci(47, 84, 2.4, M.ironL, 1.6);
        o += sandbag(c, 20, 104) + sandbag(c, 37, 109) + sandbag(c, 55, 110) + sandbag(c, 72, 106) + sandbag(c, 84, 99, 0.85);
        o += spark(c, 79, 44, 4, '#ffb347', 1.4);
        return o;
      }
      if (v === 2 || v === 3) {
        const L3 = v === 3;
        let o = plat(c, v, { stone: st });
        if (L3) o += aura(c, 74, 40, 26, 24, '#ff8a3d', 0.55);
        // 둥근 돌 포대
        o += cyl(c, 50, 84, 104, 38, 11.4, c.cg(st), c.vg(h.shade(st, 0.22)));
        o += c.e(50, 84, 31, 9, '#4a3a32', 0);
        // 포탄 더미(달군 쇠)
        o += orb(c, 26, 82, 5.5, '#c8502a', 2.2) + orb(c, 36, 84, 5.5, '#c8502a', 2.2) + orb(c, 31, 77, 5.5, '#e0662e', 2.2);
        o += mortarBarrel(c, 54, 90, L3 ? 44 : 42, 15, 32, L3 ? { bands: [0.3, 0.62], trim: M.gold, dragon: '#b8402a' } : { bands: [0.45] });
        // 앞 테두리
        o += c.p(`M12 84A38 11.4 0 0 0 88 84L81 84A31 9 0 0 1 19 84Z`, c.vg(h.shade(st, 0.18)), 2.6);
        o += c.ln(`${ring(50, 95, 38, 11.4)}${vseam(50, 84, 95, 38, 11.4, -40)}${vseam(50, 84, 95, 38, 11.4, 40)}${vseam(50, 95, 104, 38, 11.4, 0)}${vseam(50, 95, 104, 38, 11.4, -70)}${vseam(50, 95, 104, 38, 11.4, 70)}`, h.shade(st, -0.38), 1.5);
        if (L3) {
          o += band(c, 50, 86, 89.5, 38, 11.4, c.vg(M.gold, 0.35, -0.25));
          o += flag(c, 18, 82, 30, '#e0442a', -1, 14);
        } else {
          o += spark(c, 80, 40, 4.5, '#ffb347', 1.4) + spark(c, 70, 34, 3, '#ffd94a', 0);
        }
        return o;
      }
      if (v === 'A') {
        // 용암 투석기 — 거대한 투석기와 용암 바구니
        let o = plat(c, 4, { stone: '#8a7468', trim: '#e0442a' });
        o += aura(c, 24, 28, 26, 24, '#ff7a2a', 0.6);
        // 차대
        o += c.r(14, 82, 72, 12, c.vg(M.wood), 2, 3) + c.ln('M14 88H86', h.shade(M.wood, -0.35), 1.5);
        // 뒤쪽 A자 틀
        o += c.ol('M40 86L56 46L74 86', h.shade(M.wood, -0.3), 5);
        // 팔(왼쪽 위로) + 평형추
        o += c.ol('M80 72L22 32', M.wood, 6);
        o += c.r(70, 66, 20, 18, c.vg(h.shade(STONE.fire, -0.15)), 2, 3) + c.ln('M70 75H90', OL, 1.5);
        o += c.ol('M80 70L80 66', M.iron, 2);
        // 앞쪽 A자 틀 + 굴대
        o += c.ol('M34 90L54 50L72 90', M.wood, 5) + c.ol('M42 74H64', M.wood, 3.5);
        o += c.ci(55, 48, 5, c.sg(M.ironL), 2.4);
        // 용암 바구니
        o += c.p('M8 28Q8 42 20 43Q32 42 32 28Z', c.vg(M.iron, 0.3, -0.3), 3);
        o += c.ln('M10 34Q20 38 30 34', '#ffb347', 1.5);
        o += c.p('M9 28Q12 16 20 18Q24 12 28 19Q34 20 31 28Z', c.vg('#ffd94a', 0.2, -0.1), 2.4);
        o += c.e(20, 24, 7, 3.5, '#fff1a8', 0) + c.p('M30 32Q34 40 32 46Q30 40 28 36Z', '#ff8a2a', 1.8);
        // 바퀴
        o += c.ci(22, 98, 9, c.sg(M.wood), 3) + c.ci(22, 98, 3, M.iron, 2) + c.ci(78, 98, 9, c.sg(M.wood), 3) + c.ci(78, 98, 3, M.iron, 2);
        return o;
      }
      // 'B' 연발 포대 — 포신 셋이 돌아가는 포대
      let o = plat(c, 4, { stone: '#9a8478', trim: '#e0442a' });
      o += aura(c, 50, 24, 40, 18, '#ff8a3d', 0.45);
      o += cyl(c, 50, 70, 99, 30, 9, c.cg(M.iron), c.vg(h.shade(M.iron, 0.25)));
      o += c.e(50, 70, 23, 6.5, '#2c2430', 0);
      o += mortarBarrel(c, 50, 78, 52, 10, -26, { bands: [0.35, 0.7], trim: M.gold });
      o += mortarBarrel(c, 50, 78, 52, 10, 26, { bands: [0.35, 0.7], trim: M.gold });
      o += mortarBarrel(c, 50, 80, 58, 11, 0, { bands: [0.35, 0.7], trim: M.gold });
      o += c.p('M20 70A30 9 0 0 0 80 70L73 70A23 6.5 0 0 1 27 70Z', c.vg(h.shade(M.iron, 0.3)), 2.4);
      o += band(c, 50, 80, 85, 30, 9, c.vg(M.gold, 0.35, -0.25));
      o += c.ln([-60, -30, 0, 30, 60].map((d) => vseam(50, 88, 96, 30, 9, d)).join(''), h.shade(M.iron, -0.45), 2);
      return o;
    },
  };

  /* ---------- 🔥 대장간 ---------- */
  /* 박공 집: 앞벽 x1~x2, 처마 높이 yw, 꼭대기 ya, 바닥 yb, 지붕 깊이 d */
  function anvil(c, x, y, k = 1) {
    return c.p(`M${f(x - 9 * k)} ${f(y - 9 * k)}H${f(x + 10 * k)}Q${f(x + 6 * k)} ${f(y - 5 * k)} ${f(x + 3 * k)} ${f(y - 5 * k)}L${f(x + 5 * k)} ${f(y)}H${f(x - 5 * k)}L${f(x - 3 * k)} ${f(y - 5 * k)}Q${f(x - 7 * k)} ${f(y - 5 * k)} ${f(x - 9 * k)} ${f(y - 9 * k)}Z`, c.vg(M.iron, 0.4, -0.2), 2.4);
  }
  function glowDoor(c, x, yb, w, ht) {
    return c.p(`M${f(x - w / 2)} ${f(yb)}V${f(yb - ht + w / 2)}Q${f(x)} ${f(yb - ht - w * 0.15)} ${f(x + w / 2)} ${f(yb - ht + w / 2)}V${f(yb)}Z`, c.vg('#ffc65a', 0.3, -0.35), 2.6) +
      c.e(x, yb - 3, w * 0.32, 2.5, '#fff1a8', 0, ' opacity="0.9"');
  }
  T.forge = {
    muzzle: [[64, 26], [66, 20], [66, 4], [50, 6], [50, 30]],
    draw(c, v) {
      const h = c.h;
      const st = STONE.fire;
      if (v === 1) {
        let o = plat(c, 1);
        // 굴뚝
        o += c.r(58, 30, 13, 40, c.cg(M.rough), 1, 3) + c.ln('M58 42H71M58 54H71M64 30V42M62 42V54', h.shade(M.rough, -0.4), 1.4);
        o += flame(c, 64.5, 31, 11, 14) + spark(c, 74, 20, 3, '#ffb347', 0) + spark(c, 56, 18, 2.5, '#ffd94a', 0);
        o += house(c, 28, 72, 72, 54, 104, c.vg(M.plank, 0.2, -0.2), '#8a5a34');
        o += c.ln('M39 64V102M50 58V104M61 64V102', h.shade(M.plank, -0.35), 1.4);
        o += glowDoor(c, 50, 104, 16, 22);
        o += anvil(c, 22, 108, 0.9);
        return o;
      }
      if (v === 2 || v === 3) {
        const L3 = v === 3;
        let o = plat(c, v, { stone: st });
        if (L3) o += aura(c, 68, 14, 24, 22, '#ff8a3d', 0.55);
        o += c.r(58, L3 ? 18 : 24, 15, 44, c.cg(h.shade(st, -0.1)), 1, 3) + c.ln(`M58 ${L3 ? 30 : 36}H73M58 48H73M65 ${L3 ? 18 : 24}V${L3 ? 30 : 36}M62 ${L3 ? 30 : 36}V48`, h.shade(st, -0.45), 1.4);
        if (L3) o += c.r(56, 16, 19, 5, c.vg(M.gold, 0.35, -0.3), 1, 2.4);
        o += flame(c, 65.5, L3 ? 17 : 25, L3 ? 15 : 12, L3 ? 22 : 16) + spark(c, 77, L3 ? 6 : 14, 3, '#ffb347', 0) + spark(c, 56, L3 ? 4 : 12, 2.5, '#ffd94a', 0);
        o += house(c, 24, 76, 68, 46, 104, c.vg(st, 0.25, -0.2), '#c8462c', 13);
        o += c.ln('M24 80H76M24 92H76M36 68V80M64 68V80M30 80V92M70 80V92M38 92V104M62 92V104', h.shade(st, -0.38), 1.4);
        o += glowDoor(c, 50, 104, 18, 26);
        o += c.r(28, 70, 9, 9, c.vg('#ffc65a', 0.3, -0.3), 1, 2.2) + c.r(63, 70, 9, 9, c.vg('#ffc65a', 0.3, -0.3), 1, 2.2);
        if (L3) {
          // 금속 모서리 + 망치 간판
          o += c.r(21, 66, 5, 40, c.vg(M.gold, 0.35, -0.25), 1, 2.2) + c.r(74, 66, 5, 40, c.vg(M.gold, 0.35, -0.25), 1, 2.2);
          o += c.ol('M50 46V52', M.iron, 1.6);
          o += c.ci(50, 59, 7.5, c.vg(M.wood, 0.3, -0.2), 2.4) + c.p('M46 55H54V59H51.5V64H48.5V59H46Z', M.iron, 1.4);
          o += flag(c, 15, 104, 34, '#e0442a', -1, 12);
        }
        o += anvil(c, 84, 110, 0.9);
        return o;
      }
      if (v === 'A') {
        // 용광로 — 병 모양 큰 화로, 높은 굴뚝
        const fs = '#8a6a5e';
        let o = plat(c, 4, { stone: '#7a6660', trim: '#e0442a' });
        o += aura(c, 50, 16, 26, 16, '#ff7a2a', 0.65) + aura(c, 50, 92, 30, 16, '#ff9a3d', 0.6);
        o += c.r(42, 18, 16, 32, c.cg(M.iron), 1, 3) + c.r(39, 16, 22, 6, c.vg(M.ironL, 0.3, -0.3), 1, 2.6);
        o += flame(c, 50, 17, 18, 15);
        o += c.p('M50 34C66 34 70 46 78 60C86 74 86 90 82 100Q50 110 18 100C14 90 14 74 22 60C30 46 34 34 50 34Z', c.cg(fs), 3);
        o += c.ln('M27 55Q50 62 73 55M19 76Q50 85 81 76', OL, 4) + c.ln('M27 55Q50 62 73 55M19 76Q50 85 81 76', M.ironL, 2);
        o += c.ln('M34 44Q50 48 66 44', h.shade(fs, -0.4), 1.5);
        o += c.p('M36 104V92Q50 76 64 92V105Z', c.vg('#ffd25a', 0.4, -0.3), 3);
        o += c.e(50, 99, 9, 3.5, '#fff1a8', 0);
        o += c.ci(31, 66, 4, c.sg('#ff8a2a'), 2) + c.ci(69, 66, 4, c.sg('#ff8a2a'), 2);
        return o;
      }
      // 'B' 무기고 — 성가퀴 건물, 방패와 칼, 창 받침
      const ast = '#a89488';
      let o = plat(c, 4, { stone: '#8c7a70', trim: '#e0442a' });
      // 창 받침(뒤)
      o += c.ol('M10 96V26M18 98V34M82 98V34M90 96V26', M.woodD, 2.4);
      o += [[10, 26], [18, 34], [82, 34], [90, 26]].map(([x, y]) => c.p(`M${x} ${y - 9}L${x + 3.5} ${y}H${x - 3.5}Z`, c.vg(M.silver, 0.3, -0.2), 2)).join('');
      // 굴뚝
      o += c.r(64, 22, 11, 24, c.cg(h.shade(ast, -0.15)), 1, 3) + flame(c, 69.5, 23, 10, 13);
      // 본관
      o += c.p('M20 100V48H80V100Q50 108 20 100Z', c.cg(ast), 3);
      o += c.p('M18 50V38H28V44H38V38H48V44H58V38H68V44H78V38H82V50Z', c.cg(h.shade(ast, 0.08)), 3);
      o += band(c, 50, 48, 53, 30, 2, c.vg(M.gold, 0.35, -0.25), 2.4);
      o += c.ln('M20 72H80M20 86H80M32 58V72M68 58V72M26 72V86M74 72V86M30 86V100M70 86V100', h.shade(ast, -0.38), 1.5);
      // 문
      o += c.p('M41 102V88Q50 80 59 88V103Z', c.vg('#5a3a2a', 0.1, -0.3), 2.6) + c.ln('M41 92H59M41 97H59', M.ironL, 1.6);
      // 방패 + 엇갈린 칼
      o += c.ol('M33 56L67 82M67 56L33 82', M.silver, 3);
      o += c.p('M50 54C56 56 60 56 62 55V66C62 74 56 78 50 81C44 78 38 74 38 66V55C40 56 44 56 50 54Z', c.vg('#d8462c', 0.3, -0.25), 2.6);
      o += c.ln('M50 59V76M44 65H56', M.gold, 2);
      return o;
    },
  };

  /* ---------- ❄ 서리 결정탑 ---------- */
  /* 얼음 송곳/가시 — 위 끝 (x,yt), 아래 yb, 너비 w */
  /* 발톱 받침 */
  const claws = (c, y, sp, ht, col) => c.ol(`M${50 - sp} ${y}Q${50 - sp - 6} ${y - ht * 0.5} ${50 - sp + 2} ${y - ht}M${50 + sp} ${y}Q${50 + sp + 6} ${y - ht * 0.5} ${50 + sp - 2} ${y - ht}`, col, 3.4);
  T.frost_crystal = {
    muzzle: [[50, 44], [50, 38], [50, 34], [50, 6], [80, 24]],
    draw(c, v) {
      const h = c.h;
      const E = c.E;
      const st = STONE.frost;
      if (v === 1) {
        let o = plat(c, 1);
        o += frus(c, 50, 76, 104, 11, 17, c.cg(M.rough), c.vg(h.shade(M.rough, 0.2)));
        o += c.ln('M44 82L47 90L44 96M56 84L54 92', h.shade(M.rough, -0.4), 1.5);
        o += aura(c, 50, 48, 22, 24, E.color, 0.55);
        o += c.e(50, 74, 9, 2.6, h.shade(E.color, 0.4), 0, ' opacity="0.8"');
        o += crystal(c, 50, 46, 24, 42, E.color);
        return o;
      }
      if (v === 2 || v === 3) {
        const L3 = v === 3;
        let o = plat(c, v, { stone: st, trim: M.silver });
        o += aura(c, 50, 38, L3 ? 34 : 26, L3 ? 34 : 28, E.color, L3 ? 0.6 : 0.45);
        if (L3) o += c.e(50, 42, 38, 11, 'none', 0, ` stroke="${E.light}" stroke-width="${c.sw(2)}" opacity="0.8"`);
        o += frus(c, 50, 72, 104, 12, 18, c.cg(st), null);
        o += c.ln(`${ring(50, 84, 14.5, 4.3)}${ring(50, 95, 16.5, 5)}M47 74V84M53 86V95M46 97V105`, h.shade(st, -0.38), 1.5);
        if (L3) o += band(c, 50, 88, 92, 16, 4.8, c.vg(M.silver, 0.35, -0.25));
        o += cyl(c, 50, 66, 73, 16, 4.8, c.cg(L3 ? M.silver : h.shade(st, 0.1)), c.vg(h.shade(st, 0.25)));
        o += claws(c, 68, 12, 18, L3 ? M.silver : h.shade(st, 0.05));
        o += crystal(c, 50, L3 ? 36 : 40, L3 ? 30 : 26, L3 ? 54 : 46, E.color);
        o += crystal(c, 78, L3 ? 36 : 44, 9, 15, E.light, 2.2);
        if (L3) o += crystal(c, 18, 44, 8, 14, E.light, 2.2) + crystal(c, 70, 56, 7, 12, E.color, 2);
        return o;
      }
      if (v === 'A') {
        // 빙결 첨탑 — 뾰족한 얼음 첨탑
        let o = plat(c, 4, { stone: '#8ea2b6' });
        o += aura(c, 50, 30, 30, 34, E.color, 0.55);
        o += shard(c, 28, 44, 98, 18, E.light) + shard(c, 73, 34, 98, 20, E.light);
        o += shard(c, 50, 2, 100, 30, E.color, 3);
        o += shard(c, 36, 70, 104, 13, E.color) + shard(c, 63, 66, 104, 14, E.color);
        o += c.p('M22 100Q30 92 40 99Q50 94 60 99Q70 92 78 100Q50 110 22 100Z', c.vg('#ffffff', 0, -0.15), 2.4);
        o += spark(c, 44, 22, 4) + spark(c, 62, 48, 3);
        return o;
      }
      // 'B' 얼음 송곳탑 — 고드름 다발을 장전한 결정 포대
      let o = plat(c, 4, { stone: '#9aaec2', trim: M.silver });
      o += aura(c, 70, 34, 30, 28, E.color, 0.5);
      o += cyl(c, 50, 76, 99, 27, 8, c.cg(STONE.frost), c.vg(h.shade(STONE.frost, 0.25)));
      o += band(c, 50, 86, 90, 27, 8, c.vg(M.silver, 0.35, -0.25));
      o += c.ol('M34 78L40 58M66 78L60 58', M.silver, 4);
      let g = '';
      g += shard(c, 43, 26, 80, 11, E.light) + shard(c, 57, 22, 80, 11, E.light);
      g += shard(c, 36, 32, 84, 12, E.color) + shard(c, 50, 14, 84, 14, E.color, 3) + shard(c, 64, 30, 84, 12, E.color);
      g += c.r(30, 62, 40, 7, c.vg(M.silver, 0.35, -0.3), 2, 2.4) + c.ci(50, 65.5, 3, E.light, 1.8);
      o += `<g transform="rotate(30 50 74)">${g}</g>`;
      o += crystal(c, 50, 80, 14, 18, E.color, 2.4);
      return o;
    },
  };

  /* ---------- ❄ 빙창 투척기 ---------- */
  T.ice_ballista = {
    muzzle: [[50, 22], [50, 14], [50, 10], [50, 2], [50, 22]],
    draw(c, v) {
      const h = c.h;
      const E = c.E;
      const st = STONE.frost;
      const spear = (y1, y2, hw, hh) => c.ol(`M50 ${y1}V${y2}`, '#e6f6ff', 3.2) + crystal(c, 50, y2 - hh * 0.3, hw, hh, E.color);
      if (v === 1) {
        let o = plat(c, 1);
        o += c.ol('M30 106L48 76M70 106L52 76', M.wood, 4.5) + c.ol('M50 100V78', h.shade(M.wood, -0.25), 4.5);
        o += c.r(45, 50, 10, 40, c.cg(M.wood), 2, 2.6);
        o += c.ln('M12 68L50 84L88 68', '#f4ead8', 1.6);
        o += c.ol('M12 68Q28 46 50 55Q72 46 88 68', M.wood, 4.6);
        o += spear(84, 40, 13, 24);
        return o;
      }
      if (v === 2 || v === 3) {
        const L3 = v === 3;
        let o = plat(c, v, { stone: st, trim: M.silver });
        if (L3) o += aura(c, 50, 24, 20, 22, E.color, 0.6);
        o += cyl(c, 50, 84, 104, 22, 6.6, c.cg(st), c.vg(h.shade(st, 0.25)));
        o += c.ln(`${ring(50, 94, 22, 6.6)}${vseam(50, 84, 94, 22, 6.6, -40)}${vseam(50, 84, 94, 22, 6.6, 20)}${vseam(50, 94, 104, 22, 6.6, -10)}${vseam(50, 94, 104, 22, 6.6, 50)}`, h.shade(st, -0.38), 1.5);
        if (L3) o += band(c, 50, 86, 89.5, 22, 6.6, c.vg(M.silver, 0.35, -0.25));
        o += c.p('M34 86V74Q50 82 66 74V86Q50 92 34 86Z', c.vg(M.iron, 0.35, -0.25), 2.6);
        o += c.r(44.5, 44, 11, 46, c.cg(M.wood), 2, 2.6) + c.ln('M44.5 58H55.5M44.5 74H55.5', M.ironL, 2.4);
        o += c.ln('M8 64L50 84L92 64', '#f4ead8', 1.6);
        const bc = L3 ? M.silver : M.wood;
        o += c.ol('M8 64Q26 38 50 48Q74 38 92 64', bc, 5.5);
        o += c.ol('M18 52Q34 40 50 46Q66 40 82 52', L3 ? M.gold : M.iron, 1.8);
        o += crystal(c, 9, 60, 9, 14, E.light, 2.2) + crystal(c, 91, 60, 9, 14, E.light, 2.2);
        o += spear(84, 32, 15, 28);
        o += c.ci(68, 88, 7, c.sg(L3 ? M.gold : M.iron), 2.4) + c.ln('M68 82V94M62 88H74', OL, 1.6);
        if (L3) o += flag(c, 22, 92, 30, E.color, -1, 12);
        return o;
      }
      if (v === 'A') {
        // 빙창 사수 — 높은 발사대, 겹활, 송곳 창
        let o = plat(c, 4, { stone: '#8ea2b6', trim: M.silver });
        o += aura(c, 50, 14, 18, 18, E.color, 0.6);
        o += cyl(c, 50, 82, 99, 20, 6, c.cg(STONE.frost), c.vg(h.shade(STONE.frost, 0.25)));
        o += c.ol('M40 84L44 26M60 84L56 26', M.silver, 4) + c.ol('M42 60H58M43 42H57', M.silver, 2.4);
        o += c.ln('M14 66L50 80L86 66M20 46L50 58L80 46', '#f4ead8', 1.4);
        o += c.ol('M14 66Q30 50 50 56Q70 50 86 66', M.silver, 4.5) + c.ol('M20 46Q34 32 50 38Q66 32 80 46', M.silver, 4);
        o += c.ol('M50 82V20', '#e6f6ff', 3.4);
        // 송곳(나선) 머리
        o += c.p('M50 0L58 22H42Z', c.vg(E.color, 0.5, -0.2), 2.6) + c.ln('M45 18L56 14M47 11L54 8', E.dark, 1.6);
        o += crystal(c, 14, 64, 8, 12, E.light, 2) + crystal(c, 86, 64, 8, 12, E.light, 2);
        return o;
      }
      // 'B' 빙하 파쇄기 — 아주 넓은 두 겹 활, 뭉툭한 얼음 덩이 머리
      let o = plat(c, 4, { stone: '#9aaec2', trim: M.silver });
      o += aura(c, 50, 30, 30, 18, E.color, 0.55);
      o += cyl(c, 50, 80, 99, 30, 9, c.cg(STONE.frost), c.vg(h.shade(STONE.frost, 0.25)));
      o += crystal(c, 24, 86, 12, 18, E.light, 2.2) + crystal(c, 76, 86, 12, 18, E.light, 2.2);
      o += c.r(43, 42, 14, 46, c.cg(M.iron), 2, 2.8) + c.ln('M43 56H57M43 72H57', M.silver, 2.4);
      o += c.ln('M7 64L50 82L93 64', '#f4ead8', 1.6);
      o += c.ol('M7 64Q22 34 50 46Q78 34 93 64', M.iron, 6.5) + c.ol('M12 58Q26 36 50 44Q74 36 88 58', M.silver, 2.4);
      o += c.ol('M50 82V40', '#e6f6ff', 3.6);
      o += crystal(c, 40, 32, 14, 20, E.light, 2.4) + crystal(c, 60, 32, 14, 20, E.light, 2.4) + crystal(c, 50, 26, 20, 30, E.color, 3);
      return o;
    },
  };

  /* ---------- ❄ 겨울 종 ---------- */
  /* 종 — 꼭대기 (x,y), 너비 w, 높이 ht */
  function bell(c, x, y, w, ht, col, rim = true) {
    const P = (px, py) => `${f(x + px * w)} ${f(y + py * ht)}`;
    let o = c.ol(`M${P(-0.08, 0.08)}Q${P(0, -0.1)} ${P(0.08, 0.08)}`, c.h.shade(col, -0.2), 2.4);
    o += c.p(`M${P(-0.27, 0.16)}C${P(-0.28, -0.02)} ${P(0.28, -0.02)} ${P(0.27, 0.16)}C${P(0.3, 0.5)} ${P(0.38, 0.74)} ${P(0.5, 0.88)}Q${P(0.52, 1)} ${P(0, 1)}Q${P(-0.52, 1)} ${P(-0.5, 0.88)}C${P(-0.38, 0.74)} ${P(-0.3, 0.5)} ${P(-0.27, 0.16)}Z`, c.cg(col), 3);
    if (w >= 15) o += c.ln(`M${P(-0.36, 0.7)}Q${P(0, 0.8)} ${P(0.36, 0.7)}`, c.h.shade(col, -0.35), 1.8);
    if (rim) o += c.e(x, y + ht * 0.93, w * 0.42, w * 0.08, c.h.shade(col, -0.45), 0) + c.ci(x, y + ht * 0.97, w * 0.08, c.sg(M.silver), 2);
    if (w >= 15) o += c.ln(`M${P(-0.16, 0.2)}Q${P(-0.2, 0.5)} ${P(-0.3, 0.76)}`, '#fff', 2, 0.7);
    return o;
  }
  /* 고드름 줄 */
  function icicles(c, x1, x2, y, n, len, col) {
    let d = '';
    const step = (x2 - x1) / n;
    for (let i = 0; i < n; i++) {
      const a = x1 + i * step + step * 0.15;
      const L = len * (i % 2 ? 0.65 : 1);
      d += `M${f(a)} ${f(y)}L${f(a + step * 0.35)} ${f(y + L)}L${f(a + step * 0.7)} ${f(y)}Z`;
    }
    return c.p(d, c.vg(col, 0.4, -0.1), 1.8);
  }
  /* 눈 덮인 박공 지붕 */
  function snowRoof(c, x1, x2, ya, yb, col) {
    const cx = (x1 + x2) / 2;
    return c.p(`M${x1} ${yb}L${cx} ${ya}L${x2} ${yb}Q${cx} ${yb + 6} ${x1} ${yb}Z`, c.vg(col, 0.2, -0.25), 3) +
      c.p(`M${f(x1 + (cx - x1) * 0.3)} ${f(yb - (yb - ya) * 0.3)}L${cx} ${ya}L${f(x2 - (x2 - cx) * 0.3)} ${f(yb - (yb - ya) * 0.3)}Q${f(cx + 8)} ${f(ya + (yb - ya) * 0.45)} ${f(cx + 3)} ${f(ya + (yb - ya) * 0.38)}Q${f(cx - 4)} ${f(ya + (yb - ya) * 0.55)} ${f(cx - 9)} ${f(ya + (yb - ya) * 0.42)}Z`, '#f6fbff', 2.2);
  }
  T.winter_bell = {
    muzzle: [[50, 64], [50, 66], [50, 66], [50, 66], [50, 60]],
    draw(c, v) {
      const h = c.h;
      const E = c.E;
      const st = STONE.frost;
      if (v === 1) {
        let o = plat(c, 1);
        o += c.ol('M28 106V40M72 106V40', M.wood, 5.5) + c.ol('M30 92L44 104M70 92L56 104', M.wood, 3);
        o += c.r(20, 36, 60, 8, c.vg(M.plank), 2, 2.8);
        o += c.p('M18 37L50 24L82 37Z', c.vg('#8a5a34', 0.2, -0.2), 2.8) + c.p('M30 32L50 24L70 32Q50 30 30 32Z', '#f6fbff', 0);
        o += c.ol('M50 44V48', M.rope, 2);
        o += bell(c, 50, 47, 32, 36, E.color);
        return o;
      }
      if (v === 2 || v === 3) {
        const L3 = v === 3;
        let o = plat(c, v, { stone: st, trim: M.silver });
        if (L3) o += aura(c, 50, 70, 34, 30, E.color, 0.5) + c.e(50, 96, 34, 9, 'none', 0, ` stroke="${E.light}" stroke-width="${c.sw(2.4)}" opacity="0.8"`);
        o += c.r(20, 44, 13, 62, c.cg(st), 2, 3) + c.r(67, 44, 13, 62, c.cg(st), 2, 3);
        o += c.ln('M20 60H33M20 76H33M20 92H33M67 60H80M67 76H80M67 92H80M26 44V60M73 60V76M26 76V92', h.shade(st, -0.38), 1.5);
        if (L3) o += c.r(18, 70, 17, 5, c.vg(M.silver, 0.35, -0.25), 1, 2.2) + c.r(65, 70, 17, 5, c.vg(M.silver, 0.35, -0.25), 1, 2.2);
        o += c.r(16, 38, 68, 10, c.vg(h.shade(st, 0.1)), 2, 3);
        o += c.ol('M50 48V52', M.silver, 2);
        o += bell(c, 50, 51, 34, 40, E.color);
        o += snowRoof(c, 12, 88, L3 ? 10 : 14, 40, '#6f8fb0');
        if (L3) {
          o += icicles(c, 14, 86, 44, 9, 9, E.light);
          o += crystal(c, 50, 4, 10, 16, E.color, 2.2);
        }
        return o;
      }
      if (v === 'A') {
        // 정적의 종 — 두꺼운 얼음 아치 안의 커다란 종, 고요히 얼어 있음
        let o = plat(c, 4, { stone: '#8ea2b6', trim: M.silver });
        o += aura(c, 50, 64, 44, 40, E.light, 0.45);
        o += c.p('M10 100V48C10 18 28 4 50 4C72 4 90 18 90 48V100H76V50C76 30 66 18 50 18C34 18 24 30 24 50V100Z', c.vg(E.light, 0.35, -0.2), 3);
        o += c.ln('M10 70H24M76 70H90M12 40L25 44M88 40L75 44M30 12L36 22M70 12L64 22M50 4V18', h.shade(E.color, -0.1), 1.6);
        o += c.ol('M50 18V24', M.silver, 2.4);
        o += bell(c, 50, 22, 56, 66, h.mix(E.color, '#ffffff', 0.25));
        o += icicles(c, 28, 72, 82, 8, 7, '#ffffff');
        return o;
      }
      // 'B' 서리 장막 — 3층 탑, 층마다 작은 종, 고드름 장막
      let o = plat(c, 4, { stone: '#9aaec2', trim: M.silver });
      o += aura(c, 50, 56, 42, 44, E.color, 0.4);
      o += c.r(42, 20, 16, 50, c.cg(STONE.frost), 1, 3);
      o += c.r(30, 64, 40, 38, c.cg(STONE.frost), 2, 3) + c.p('M38 102V82Q50 68 62 82V102Z', c.vg(E.dark, 0.1, -0.3), 2.6);
      o += bell(c, 50, 76, 20, 24, E.color);
      o += snowRoof(c, 26, 74, 6, 26, '#6f8fb0');
      o += snowRoof(c, 18, 82, 26, 46, '#6f8fb0');
      o += snowRoof(c, 8, 92, 46, 68, '#6f8fb0') + icicles(c, 12, 88, 71, 7, 9, E.light);
      o += bell(c, 12, 70, 12, 14, E.color, false) + bell(c, 88, 70, 12, 14, E.color, false);
      o += crystal(c, 50, 7, 9, 12, E.color, 2.2);
      return o;
    },
  };

  /* ---------- ⚡ 번개 막대 ---------- */
  const COPPER = '#d0803e';
  /* 코일: 기둥(x)을 감는 앞쪽 고리들 */
  function coil(c, x, y1, y2, rx, n, col = COPPER, w = 2.6) {
    const step = (y2 - y1) / n;
    let d = '';
    for (let i = 0; i < n; i++) {
      const y = y1 + i * step;
      d += `M${f(x - rx)} ${f(y)}Q${f(x)} ${f(y + step * 1.6)} ${f(x + rx)} ${f(y + step * 0.5)}`;
    }
    return c.ol(d, col, w);
  }
  /* 지그재그 전기 줄기 */
  function zap(c, pts, col, w = 2) {
    const d = `M${pts.map((p) => `${f(p[0])} ${f(p[1])}`).join('L')}`;
    return c.ln(d, col, w + 2.4, 0.45) + c.ln(d, '#ffffff', w * 0.6) ;
  }
  T.lightning_rod = {
    muzzle: [[50, 14], [50, 12], [50, 8], [50, 6], [50, 18]],
    draw(c, v) {
      const h = c.h;
      const E = c.E;
      const st = STONE.storm;
      if (v === 1) {
        let o = plat(c, 1);
        o += c.ol('M36 104L46 88M64 104L54 88', M.wood, 3.4);
        o += c.r(44, 38, 12, 68, c.cg(M.wood), 2, 3);
        o += coil(c, 50, 52, 80, 9, 5);
        o += c.ol('M50 38V20', M.ironL, 2.6) + c.ci(50, 18, 4, c.sg(COPPER), 2.2);
        o += aura(c, 50, 16, 16, 14, E.color, 0.7) + spark(c, 50, 16, 9, E.light, 2) + spark(c, 50, 16, 4, '#fff', 0);
        return o;
      }
      if (v === 2 || v === 3) {
        const L3 = v === 3;
        let o = plat(c, v, { stone: st });
        if (L3) o += aura(c, 50, 14, 24, 22, E.color, 0.65);
        o += frus(c, 50, 72, 104, 12, 18, c.cg(st), c.vg(h.shade(st, 0.25)));
        o += c.ln(`${ring(50, 84, 14.5, 4.3)}${ring(50, 95, 16.5, 5)}M46 74V84M54 86V95M47 97V105`, h.shade(st, -0.38), 1.5);
        if (L3) o += band(c, 50, 88, 92, 16, 4.8, c.vg(M.gold, 0.35, -0.25));
        o += c.r(45.5, L3 ? 22 : 26, 9, 50, c.cg(M.iron), 2, 2.8);
        o += c.ol('M28 46H72', M.iron, 3);
        o += [30, 70].map((x) => c.e(x, 40, 5, 2, c.vg(E.light), 2) + c.e(x, 44, 5, 2, c.vg(E.light), 2)).join('');
        o += coil(c, 50, L3 ? 50 : 52, 70, L3 ? 10 : 8.5, L3 ? 6 : 5);
        if (L3) {
          o += c.ol('M43 22Q40 14 45 8M57 22Q60 14 55 8', M.gold, 2.4);
          o += orb(c, 50, 14, 7.5, E.color, 2.6) + spark(c, 50, 14, 4, '#fff', 0);
          o += zap(c, [[62, 10], [68, 14], [66, 18], [74, 22]], E.color) + zap(c, [[38, 12], [33, 8], [34, 4]], E.color);
        } else {
          o += c.ol('M50 26V18', M.ironL, 2.4) + c.ci(50, 16, 4.2, c.sg(COPPER), 2.2);
          o += aura(c, 50, 14, 14, 12, E.color, 0.7) + spark(c, 50, 14, 8, E.light, 2) + spark(c, 30, 36, 3, E.light, 0) + spark(c, 70, 36, 3, E.light, 0);
        }
        return o;
      }
      if (v === 'A') {
        // 폭풍 첨탑 — 세 갈래 왕관, 사이를 잇는 번개
        let o = plat(c, 4, { stone: '#85839c' });
        o += aura(c, 50, 22, 42, 22, E.color, 0.55);
        o += frus(c, 50, 64, 99, 13, 21, c.cg(STONE.storm), c.vg(h.shade(STONE.storm, 0.25)));
        o += band(c, 50, 80, 84, 17, 5, c.vg(M.gold, 0.35, -0.25));
        o += c.ol('M46 64Q30 50 20 22M54 64Q70 50 80 22', M.iron, 3.6);
        o += c.r(46, 12, 8, 54, c.cg(M.iron), 2, 2.8);
        o += coil(c, 50, 30, 60, 9, 6);
        o += orb(c, 20, 18, 6, E.color, 2.4) + orb(c, 80, 18, 6, E.color, 2.4) + orb(c, 50, 9, 6.5, E.color, 2.4);
        o += zap(c, [[25, 17], [32, 12], [36, 17], [44, 10]], E.light) + zap(c, [[56, 10], [63, 16], [67, 11], [75, 17]], E.light);
        o += zap(c, [[22, 26], [26, 34], [22, 40]], E.light) + zap(c, [[78, 26], [74, 34], [79, 41]], E.light);
        return o;
      }
      // 'B' 뇌격탑 — 굵은 기둥, 고리, 커다란 구
      let o = plat(c, 4, { stone: '#85839c' });
      o += aura(c, 50, 22, 32, 28, E.color, 0.65);
      o += frus(c, 50, 42, 99, 14, 24, c.cg(M.iron), null);
      o += coil(c, 50, 54, 90, 18, 6, COPPER, 3.4);
      o += c.e(50, 42, 24, 7.5, c.vg(h.shade(COPPER, 0.1)), 3) + c.e(50, 41, 15, 4.2, h.shade(COPPER, -0.45), 0);
      o += c.p('M44 40V34H56V40Z', M.iron, 2.4);
      o += orb(c, 50, 20, 16, E.color, 3);
      o += bolt(c, 46, 9, 0.9, '#fff', 1.6);
      o += zap(c, [[34, 22], [24, 28], [28, 34], [18, 42]], E.light) + zap(c, [[66, 18], [76, 24], [72, 30], [84, 36]], E.light);
      return o;
    },
  };

  /* ---------- ⚡ 바람 포탑 ---------- */
  /* 풍차 날개 — 중심 (x,y), 반지름 R, 날개 n개, 시작 각 rot */
  function rotor(c, x, y, R, sail, n = 4, rot = 45, trim = null) {
    let o = '';
    for (let i = 0; i < n; i++) {
      const a = ((rot + (i * 360) / n) * Math.PI) / 180;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const px = -sa;
      const py = ca;
      const P = (r, s) => [x + ca * r + px * s, y + sa * r + py * s];
      o += c.p(poly([P(R * 0.22, 1), P(R, 1.5), P(R, R * 0.3), P(R * 0.3, R * 0.2)]), c.vg(sail, 0.35, -0.15), 2.4);
      if (trim) o += c.ln(`M${poly([P(R * 0.95, 2), P(R * 0.95, R * 0.28)]).slice(1, -1)}`, trim, 2);
      o += c.ol(`M${f(x)} ${f(y)}L${f(P(R * 1.02, 0)[0])} ${f(P(R * 1.02, 0)[1])}`, M.woodD, 2);
    }
    return o + c.ci(x, y, R * 0.13 + 2, c.sg(M.bronze), 2.4);
  }
  /* 나팔 포신 — (x,y)에서 오른쪽으로 길이 L, 기울기 ang */
  function hornBarrel(c, x, y, L, r, ang, col) {
    const b = c.p(`M${x} ${y - r}L${x + L * 0.75} ${y - r * 0.8}Q${x + L * 0.9} ${y - r * 0.8} ${x + L} ${y - r * 1.7}V${y + r * 1.7}Q${x + L * 0.9} ${y + r * 0.8} ${x + L * 0.75} ${y + r * 0.8}L${x} ${y + r}Z`, c.vg(col, 0.4, -0.3), 3) +
      c.e(x + L, y, r * 0.55, r * 1.7, c.h.shade(col, -0.5), 2.4) + c.e(x + L, y, r * 0.3, r * 1.1, c.E.light, 0, ' opacity="0.7"') +
      c.ln(`M${x + L * 0.25} ${y - r}V${y + r}M${x + L * 0.55} ${y - r * 0.9}V${y + r * 0.9}`, c.h.shade(col, -0.4), 1.8);
    return `<g transform="rotate(${ang} ${x} ${y})">${b}</g>`;
  }
  T.gale_cannon = {
    muzzle: [[80, 70], [84, 66], [86, 62], [50, 4], [50, 6]],
    draw(c, v) {
      const h = c.h;
      const E = c.E;
      const st = STONE.storm;
      const sail = h.mix(E.light, '#ffffff', 0.3);
      if (v === 1) {
        let o = plat(c, 1);
        o += c.ol('M40 84V48', M.woodD, 3.4);
        o += rotor(c, 40, 46, 26, sail);
        o += frus(c, 46, 80, 104, 14, 18, c.cg(M.wood), c.vg(M.plank));
        o += c.ln('M40 84V108M52 84V108', h.shade(M.wood, -0.35), 1.4);
        o += hornBarrel(c, 44, 80, 34, 6, -14, M.bronze);
        return o;
      }
      if (v === 2 || v === 3) {
        const L3 = v === 3;
        let o = plat(c, v, { stone: st });
        if (L3) o += aura(c, 86, 62, 16, 16, E.color, 0.6);
        o += c.ol('M38 80V40', M.iron, 3.6);
        o += rotor(c, 38, 38, L3 ? 34 : 30, sail, 4, 45, L3 ? E.color : null);
        o += cyl(c, 46, 76, 104, 20, 6, c.cg(st), c.vg(h.shade(st, 0.25)));
        o += c.ln(`${ring(46, 88, 20, 6)}${vseam(46, 76, 88, 20, 6, -30)}${vseam(46, 76, 88, 20, 6, 30)}${vseam(46, 88, 104, 20, 6, 0)}`, h.shade(st, -0.38), 1.5);
        if (L3) o += band(c, 46, 79, 82.5, 20, 6, c.vg(M.gold, 0.35, -0.25));
        o += hornBarrel(c, 46, 74, 40, 7, -14, L3 ? M.gold : M.bronze);
        if (L3) o += c.ln('M88 50Q96 56 90 64M92 44Q102 54 96 68', E.light, 2.4, 0.9);
        return o;
      }
      if (v === 'A') {
        // 회오리 탑 — 꼭대기에 회오리 깔때기
        let o = plat(c, 4, { stone: '#85839c' });
        o += aura(c, 50, 30, 42, 32, E.color, 0.45);
        o += frus(c, 50, 58, 99, 15, 22, c.cg(STONE.storm), null);
        o += c.ln(`${ring(50, 72, 17, 5)}${ring(50, 86, 19.5, 5.8)}M45 61V71M56 74V85M44 89V98`, h.shade(STONE.storm, -0.38), 1.5);
        o += band(c, 50, 64, 67, 16, 4.8, c.vg(M.gold, 0.35, -0.25));
        o += c.e(50, 58, 15, 4.5, c.vg(h.shade(STONE.storm, 0.2)));
        o += c.p('M44 58C40 46 30 30 12 8Q50 0 88 8C70 30 60 46 56 58Q50 61 44 58Z', c.vg(E.light, 0.4, -0.05), 3, ' opacity="0.95"');
        o += c.ln('M16 12Q50 20 84 12M24 24Q50 31 74 22M33 36Q50 42 66 35M40 47Q50 51 60 46', E.color, 2.6);
        o += c.ln('M30 16Q46 22 62 18M38 30Q50 34 58 30', '#fff', 1.8, 0.9);
        o += c.r(16, 40, 6, 4, M.woodD, 1, 1.6) + c.r(78, 30, 5, 5, M.rough, 1, 1.6);
        return o;
      }
      // 'B' 하늘 사냥꾼 — 하늘을 향한 쌍포신과 날개
      let o = plat(c, 4, { stone: '#85839c' });
      o += aura(c, 50, 14, 22, 18, E.color, 0.55);
      o += c.p('M44 70C30 64 14 50 6 26C20 34 30 38 40 44Z', c.vg(sail, 0.3, -0.15), 3) + c.p('M56 70C70 64 86 50 94 26C80 34 70 38 60 44Z', c.vg(sail, 0.3, -0.15), 3);
      o += c.ln('M40 60C28 54 18 44 12 34M60 60C72 54 82 44 88 34', E.color, 2);
      o += cyl(c, 50, 74, 99, 24, 7, c.cg(STONE.storm), c.vg(h.shade(STONE.storm, 0.25)));
      o += band(c, 50, 84, 88, 24, 7, c.vg(M.gold, 0.35, -0.25));
      o += c.p('M34 76Q34 58 50 56Q66 58 66 76Q50 82 34 76Z', c.vg(M.iron, 0.35, -0.25), 3);
      o += cyl(c, 43, 10, 64, 6, 2, c.cg(M.bronze), null) + cyl(c, 57, 10, 64, 6, 2, c.cg(M.bronze), null);
      o += c.e(43, 10, 6, 2.2, h.shade(M.bronze, -0.5), 2.4) + c.e(57, 10, 6, 2.2, h.shade(M.bronze, -0.5), 2.4);
      o += c.r(36, 28, 28, 6, c.vg(M.gold, 0.35, -0.3), 2, 2.4) + c.r(36, 48, 28, 6, c.vg(M.gold, 0.35, -0.3), 2, 2.4);
      o += c.ci(50, 68, 5, c.sg(E.color), 2.2);
      return o;
    },
  };

  /* ---------- ⚡ 축전기 ---------- */
  /* 유리관 — 가운데 x, 위 y1, 아래 y2, 반지름 r */
  function tube(c, x, y1, y2, r, col, k = 1) {
    const h = c.h;
    let o = cyl(c, x, y1, y2, r, r * 0.3, h.mix(c.E.light, '#ffffff', 0.4), null, 0);
    o = `<g opacity="0.55">${o}</g>`;
    const m = (y1 + y2) / 2;
    const L = y2 - y1;
    o += c.ln(`M${f(x - 1)} ${f(y1 + 2)}L${f(x + r * 0.5)} ${f(y1 + L * 0.3)}L${f(x - r * 0.5)} ${f(m)}L${f(x + r * 0.4)} ${f(y1 + L * 0.72)}L${f(x)} ${f(y2 - 2)}`, col, 4.4 * k, 0.55);
    o += c.ln(`M${f(x - 1)} ${f(y1 + 2)}L${f(x + r * 0.5)} ${f(y1 + L * 0.3)}L${f(x - r * 0.5)} ${f(m)}L${f(x + r * 0.4)} ${f(y1 + L * 0.72)}L${f(x)} ${f(y2 - 2)}`, '#fff', 1.6 * k);
    o += c.p(`M${f(x - r)} ${f(y1)}V${f(y2)}A${f(r)} ${f(r * 0.3)} 0 0 0 ${f(x + r)} ${f(y2)}V${f(y1)}`, 'none', 2.8);
    o += c.ln(`M${f(x - r * 0.6)} ${f(y1 + 3)}V${f(y2 - 3)}`, '#fff', 2, 0.6);
    return o;
  }
  const cap = (c, x, y, r, col = M.bronze) => cyl(c, x, y - 3, y + 3, r, r * 0.3, c.cg(col), c.vg(c.h.shade(col, 0.2)));
  T.dynamo = {
    muzzle: [[50, 48], [50, 22], [50, 22], [50, 24], [50, 16]],
    draw(c, v) {
      const h = c.h;
      const E = c.E;
      const st = STONE.storm;
      if (v === 1) {
        let o = plat(c, 1);
        o += c.ol('M26 106V40M74 106V40', M.wood, 5) + c.r(20, 36, 60, 7, c.vg(M.plank), 2, 2.6);
        o += aura(c, 50, 78, 24, 26, E.color, 0.55);
        o += c.ol('M50 50V43', COPPER, 2);
        o += tube(c, 50, 62, 100, 16, E.color, 0.9);
        o += cap(c, 50, 61, 17) + c.ol('M50 58V52', COPPER, 2) + c.ci(50, 50, 4, c.sg(COPPER), 2);
        return o;
      }
      if (v === 2 || v === 3) {
        const L3 = v === 3;
        let o = plat(c, v, { stone: st });
        o += aura(c, 50, 62, L3 ? 30 : 22, L3 ? 40 : 34, E.color, L3 ? 0.65 : 0.5);
        o += cyl(c, 50, 90, 104, 24, 7, c.cg(st), c.vg(h.shade(st, 0.25)));
        if (L3) o += band(c, 50, 93, 97, 24, 7, c.vg(M.gold, 0.35, -0.25));
        else o += c.ln(`${vseam(50, 90, 104, 24, 7, -30)}${vseam(50, 90, 104, 24, 7, 30)}`, h.shade(st, -0.38), 1.5);
        const side = L3 ? (x) => cap(c, x, 90, 7) + tube(c, x, 62, 88, 6, E.color, 0.6) + cap(c, x, 62, 7) + c.ol(`M${x} 59V54`, COPPER, 1.8) + c.ci(x, 53, 2.6, c.sg(COPPER), 1.8)
          : (x) => cyl(c, x, 66, 90, 6, 1.8, c.cg(M.iron), c.vg(M.ironL)) + coil(c, x, 68, 88, 6, 5, COPPER, 2);
        o += side(25) + side(75);
        if (L3) o += c.ol('M31 70H40M60 70H69', COPPER, 2);
        o += cap(c, 50, 88, 15) + tube(c, 50, 38, 86, 12, E.color) + cap(c, 50, 37, 15);
        o += c.ol('M50 34V26', COPPER, 2.2) + c.ci(50, 24, 4.2, c.sg(COPPER), 2.2);
        if (L3) o += spark(c, 50, 24, 8, E.light, 1.8) + spark(c, 50, 24, 3, '#fff', 0);
        return o;
      }
      if (v === 'A') {
        // 과충전 코일 — 겹겹이 쌓인 구리 원반, 빛나는 핵
        let o = plat(c, 4, { stone: '#85839c' });
        o += aura(c, 50, 30, 30, 30, E.color, 0.65);
        o += c.r(45, 36, 10, 60, c.cg(M.iron), 1, 2.6);
        [[88, 34], [72, 28], [57, 22], [43, 16]].forEach(([y, r]) => { o += cyl(c, 50, y - 3, y + 3, r, r * 0.3, c.cg(COPPER), c.vg(h.shade(COPPER, 0.25))) + c.e(50, y - 3, r * 0.6, r * 0.18, 'none', 0, ` stroke="${h.shade(COPPER, -0.35)}" stroke-width="${c.sw(1.5)}"`); });
        o += orb(c, 50, 26, 10, E.color, 2.8) + spark(c, 50, 26, 5, '#fff', 0);
        o += zap(c, [[60, 22], [70, 16], [68, 10], [78, 6]], E.light) + zap(c, [[40, 22], [30, 16], [32, 10], [22, 6]], E.light);
        return o;
      }
      // 'B' 방전 코일 — 두 뿔 사이를 오르는 번개
      let o = plat(c, 4, { stone: '#85839c' });
      o += aura(c, 50, 30, 38, 30, E.color, 0.55);
      o += cap(c, 50, 96, 18) + tube(c, 50, 66, 94, 14, E.color) + cap(c, 50, 64, 18);
      o += c.ol('M42 62C38 46 28 30 18 8M58 62C62 46 72 30 82 8', COPPER, 4);
      o += c.ci(18, 8, 4, c.sg(COPPER), 2) + c.ci(82, 8, 4, c.sg(COPPER), 2);
      o += zap(c, [[40, 48], [46, 44], [52, 50], [60, 46]], E.color, 2.4) + zap(c, [[33, 34], [42, 30], [50, 36], [58, 30], [67, 34]], E.color, 2.4) + zap(c, [[25, 18], [36, 14], [46, 20], [56, 14], [66, 20], [75, 16]], E.color, 2.4);
      o += zap(c, [[24, 92], [18, 98], [22, 102]], E.light) + zap(c, [[76, 92], [83, 98], [78, 103]], E.light);
      return o;
    },
  };

})();
