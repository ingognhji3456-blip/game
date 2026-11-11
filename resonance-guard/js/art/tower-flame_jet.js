'use strict';

/* =========================================================
 * 탑 그림 — 🔥 화염 분사기 `flame_jet` (2차 탑, 2026-11-11). 설계: docs/design/towers.md F4
 *  같은 화부(가죽 앞치마·보호 안경)가 풀무로 바람을 넣어 분사관 끝에서 불길을 뿜음.
 *  idle: 풀무가 벌어져 있고 관 끝에 작은 불씨 · aim: 풀무를 눌러 화덕·불씨가 커짐
 *  fire: 관 끝에서 부채꼴 불길이 확 뿜어지고 관이 반동으로 살짝 뒤로
 *  4A 용의 숨결: 놋쇠 용 머리 분사구가 달린 높은 탑 · 4B 불꽃 회오리: 분사구 여섯 개가 빙 둘러 달린 회전 화로
 * ========================================================= */
(() => {
  const { f, M, STONE, fine, poly, cyl, frus, ring, band, flame, aura, spark, plat, masonryCyl, metalBand, gem } = RG.art._tw;
  const A = RG.art._tw.A;
  const { man, footShade, smoke, embers, motion, planks, beam, OP, rnd } = A;
  const T = RG.art._tw.T;
  const D2R = Math.PI / 180;
  const BRASS = '#d9a441';
  const COPPER = A.COPPER;
  const CLAY = '#b8693e';

  /* ---------- 부품 ---------- */
  /** 부채꼴 불길 — 시작 (x,y), 길이 L, 벌어짐 sp(도), 방향 ang(도, 0=오른쪽) */
  function jet(c, x, y, L, sp, ang = 0, k = 1) {
    const tongue = (len, w, col, seed) => {
      const pts = [];
      const n = 7;
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const a = (-w / 2 + w * t) * D2R;
        const r = len * (0.78 + 0.22 * Math.sin(t * Math.PI) + (i % 2 ? -0.12 : 0.05) * (0.6 + rnd(seed + i) * 0.8));
        pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r * 0.9]);
      }
      let d = `M${f(x)} ${f(y - 1.4 * k)}`;
      pts.forEach((p, i) => { d += i ? `Q${f((p[0] + pts[i - 1][0]) / 2 + 2)} ${f((p[1] + pts[i - 1][1]) / 2)} ${f(p[0])} ${f(p[1])}` : `L${f(p[0])} ${f(p[1])}`; });
      return `${d}L${f(x)} ${f(y + 1.4 * k)}Z`;
    };
    let s = aura(c, x + L * 0.5, y, L * 0.7, L * 0.42, '#ff8a3d', 0.55);
    s += c.p(tongue(L, sp, '#ff5a2a', 3), c.fo(), 2.4);
    s += c.p(tongue(L * 0.72, sp * 0.62, '#ffc85a', 9), '#ffc85a', 0);
    s += c.p(tongue(L * 0.42, sp * 0.34, '#fff4c0', 15), '#fff6d0', 0);
    s += embers(c, [[x + L * 0.95, y - L * 0.3, 2.2 * k], [x + L * 1.05, y + L * 0.18, 1.8 * k], [x + L * 0.7, y - L * 0.42, 1.6 * k]], '#ffd27a');
    return ang ? `<g transform="rotate(${f(ang)} ${f(x)} ${f(y)})">${s}</g>` : s;
  }
  /** 관 끝 불씨(늘 타는 작은 불) */
  const pilot = (c, x, y, big) => aura(c, x + 2, y, big ? 9 : 6, big ? 8 : 5, '#ffb347', big ? 0.75 : 0.5) + flame(c, x + 2.5, y + 2.5, big ? 8 : 5.5, big ? 12 : 8);
  /** 분사관 — 화덕 쪽 (x1,y1) → 끝 (x2,y2), 굵기 w, 끝은 나팔 모양 */
  function nozzle(c, x1, y1, x2, y2, w, col, o = {}) {
    const h = c.h;
    const L = Math.hypot(x2 - x1, y2 - y1);
    const ux = (x2 - x1) / L;
    const uy = (y2 - y1) / L;
    const nx = -uy;
    const ny = ux;
    const P = (t, s) => `${f(x1 + ux * t + nx * s)} ${f(y1 + uy * t + ny * s)}`;
    let s = c.p(`M${P(0, -w / 2)}L${P(L - 4, -w / 2)}L${P(L, -w * 0.85)}L${P(L, w * 0.85)}L${P(L - 4, w / 2)}L${P(0, w / 2)}Z`, c.vg(col, 0.35, -0.3), 2.4);
    s += c.ln(`M${P(2, -w * 0.18)}L${P(L - 5, -w * 0.18)}`, h.shade(col, 0.55), 1.3, 0.8);
    /* 이음 띠 */
    for (const t of o.rings || [L * 0.35, L * 0.7]) s += c.p(`M${P(t - 1.2, -w * 0.62)}L${P(t + 1.2, -w * 0.62)}L${P(t + 1.2, w * 0.62)}L${P(t - 1.2, w * 0.62)}Z`, c.vg(o.ring || BRASS, 0.4, -0.25), 1.6);
    s += c.e(x2, y2, 1.4, w * 0.85, '#2a1a1a', 1.4);
    return s;
  }
  /** 가죽 풀무 — 손잡이 쪽 (x,y), 벌어짐 open(0~1). 돌려줌 { s, handle } */
  function bellows(c, x, y, open) {
    const h = c.h;
    const a = 8 + open * 14;
    const top = [x - 12 * Math.cos(a * D2R), y - 12 * Math.sin(a * D2R)];
    const s0 = c.p(`M${f(x + 10)} ${f(y)}L${f(x - 12)} ${f(y + 3)}L${f(top[0])} ${f(top[1])}Z`, c.vg('#8a4a2a', 0.2, -0.3), 2.2);
    let s = s0;
    /* 주름 */
    s += c.ln(`M${f(x + 4)} ${f(y - 1)}L${f(x - 9)} ${f(y + 0.5 - open * 4)}M${f(x + 6)} ${f(y - 0.5)}L${f(x - 6)} ${f(y - open * 6)}`, h.shade('#8a4a2a', -0.4), 1.2, 0.8);
    /* 위·아래 널빤지 */
    s += c.ol(`M${f(x + 10)} ${f(y)}L${f(top[0])} ${f(top[1])}`, M.wood, 2.2) + c.ol(`M${f(x + 10)} ${f(y + 1)}L${f(x - 13)} ${f(y + 3.5)}`, M.woodD, 2.2);
    s += c.ci(x + 10, y + 0.5, 1.6, c.sg(M.ironL), 1.2);
    const handle = [top[0] - 4 * Math.cos(a * D2R), top[1] - 4 * Math.sin(a * D2R)];
    s += c.ol(`M${f(top[0])} ${f(top[1])}L${f(handle[0])} ${f(handle[1])}`, M.woodD, 2);
    return { s, handle };
  }
  /** 화부 — 엉덩이 (x,y), 땅 gy, 손은 풀무 손잡이 hand */
  function stoker(c, x, y, gy, k, pose, hand, G0 = {}) {
    const W = (px, py) => [(px - x) / k, (py - y) / k];
    const hn = W(hand[0], hand[1]);
    const P = man(c, {
      x, y, k, lean: pose === 'aim' ? 10 : pose === 'fire' ? -6 : 2,
      near: { e: [hn[0] - 4, hn[1] + 5], h: hn }, far: { e: [hn[0] + 1, hn[1] + 4.4], h: [hn[0] + 2.4, hn[1] - 0.6] },
      legs: { near: [x - 3 * k, gy], far: [x + 3.6 * k, gy] },
      tunic: G0.tunic || '#e8d8b8', apron: '#6a3a22', head: 'goggles', headCol: G0.headCol || '#5a3424', glove: '#4a2a1a',
      pants: '#4a3a34', boot: '#3a2a24', squint: pose !== 'idle', shout: pose === 'fire', belt: '#3a2418',
    });
    return P;
  }

  /* ---------- 단계별 ---------- */
  function lv1(c, pose) {
    const h = c.h;
    let o = plat(c, 1);
    o += footShade(c, 50, 103, 30, 6);
    /* 진흙 화덕(둥근 가마) */
    const kx = 52;
    o += c.p(`M${kx - 16} 104C${kx - 18} 86 ${kx - 13} 66 ${kx} 64C${kx + 13} 66 ${kx + 18} 86 ${kx + 16} 104Z`, c.cg(CLAY), 3);
    o += c.ln(`M${kx - 14} 92Q${kx} 96 ${kx + 14} 92M${kx - 12} 78Q${kx} 82 ${kx + 12} 78`, c.dk(CLAY, 0.4), 1.4, 0.8);
    o += c.ln(`M${kx - 9} 70Q${kx - 13} 80 ${kx - 13} 92`, c.lt(CLAY, 0.5), 1.5, 0.7);
    /* 굴뚝 */
    o += cyl(c, kx - 3, 56, 66, 4, 1.3, c.cg(h.shade(CLAY, -0.1)), c.dk(CLAY, 0.5), 2.2);
    if (pose !== 'idle') o += smoke(c, kx - 4, 48 - (pose === 'fire' ? 4 : 0), pose === 'fire' ? 6 : 4.5, '#cfc4bc', 0.8);
    /* 불 아궁이 */
    const glow = pose === 'idle' ? 0.5 : 0.95;
    o += aura(c, kx, 96, 12, 8, '#ff9a3d', glow);
    o += c.p(`M${kx - 6} 104V98Q${kx} 90 ${kx + 6} 98V104Z`, c.vg(h.mix('#ff9a3d', '#3a1a10', pose === 'idle' ? 0.45 : 0.1), 0.3, -0.3), 2);
    o += flame(c, kx, 103, 7, pose === 'idle' ? 6 : 9);
    /* 분사관 + 불씨 / 불길 */
    const rec = pose === 'fire' ? -2.5 : 0;
    const tip = [84 + rec, 79];
    o += nozzle(c, kx + 8, 77, tip[0], tip[1], 4.6, COPPER, { rings: [10] });
    if (pose === 'fire') o += jet(c, tip[0] + 1, tip[1], 27, 48, 4);
    else o += pilot(c, tip[0], tip[1], pose === 'aim');
    if (pose === 'aim') o += embers(c, [[tip[0] + 6, tip[1] - 9, 1.8], [tip[0] - 2, tip[1] - 12, 1.4]], '#ffd27a');
    /* 풀무 + 화부 */
    const B = bellows(c, 32, 96, pose === 'idle' ? 1 : pose === 'aim' ? 0.15 : 0.75);
    const S = stoker(c, 17, 89, 107, 1.2, pose, B.handle);
    o += S.back + S.legs + S.farArm + S.farHand + S.body + B.s + S.nearArm + S.nearHand;
    return o;
  }

  function lv23(c, pose, L3) {
    const h = c.h;
    const st = STONE.fire;
    let o = plat(c, L3 ? 3 : 2, { stone: st });
    o += footShade(c, 52, 103, 32, 7);
    /* 뒤 연료통(구리) */
    const tank = (x, y1, y2, r) => cyl(c, x, y1, y2, r, r * 0.3, c.cg(COPPER), c.vg(h.shade(COPPER, 0.25), 0.3, -0.1), 2.6) + c.ln(ring(x, (y1 + y2) / 2, r, r * 0.3), h.shade(COPPER, -0.4), 1.4) + c.ci(x - r * 0.3, y1 + 4, 0.9, '#fff', 0, ' opacity="0.7"');
    o += tank(36, 66, 98, 7.5);
    if (L3) o += tank(24, 72, 100, 6);
    /* 돌 화덕 탑 */
    const tx = 54;
    o += masonryCyl(c, tx, 62, 104, 15, 4.5, st, { ch: 7, bw: 10, seed: L3 ? 61 : 59 });
    if (L3) o += metalBand(c, tx, 70, 73.5, 15, 4.5, BRASS) + metalBand(c, tx, 90, 93.5, 15, 4.5, BRASS);
    o += c.e(tx, 62, 15, 4.5, c.vg(h.shade(st, 0.2), 0.2, -0.05), 2.6);
    /* 꼭대기 갓(돔) + 굴뚝 */
    o += c.p(`M${tx - 15} 62Q${tx - 14} ${L3 ? 48 : 51} ${tx} ${L3 ? 46 : 49}Q${tx + 14} ${L3 ? 48 : 51} ${tx + 15} 62Q${tx} 67 ${tx - 15} 62Z`, c.cg(L3 ? BRASS : COPPER), 3);
    o += cyl(c, tx - 4, L3 ? 36 : 40, L3 ? 48 : 51, 3.6, 1.1, c.cg(M.iron), '#2a2228', 2.2);
    if (L3) o += c.ci(tx + 6, 52, 2.4, c.sg('#ff6b3d'), 1.6);
    if (pose !== 'idle') o += smoke(c, tx - 5, (L3 ? 30 : 34) - (pose === 'fire' ? 3 : 0), pose === 'fire' ? 6.5 : 5, '#cfc4bc', 0.8);
    /* 아궁이 */
    o += aura(c, tx, 96, 11, 8, '#ff9a3d', pose === 'idle' ? 0.5 : 0.95);
    o += c.p(`M${tx - 6} 104V97Q${tx} 89 ${tx + 6} 97V104Z`, c.vg(h.mix('#ff9a3d', '#3a1a10', pose === 'idle' ? 0.4 : 0.05), 0.3, -0.3), 2);
    o += flame(c, tx, 103, 7, pose === 'idle' ? 6 : 9);
    /* 연료관(통 → 탑) */
    o += c.ol(`M36 78Q42 74 ${tx - 14} 76`, COPPER, 2);
    /* 분사관 */
    const rec = pose === 'fire' ? -2.5 : 0;
    const tip = [(L3 ? 84 : 83) + rec, L3 ? 74 : 76];
    o += nozzle(c, tx + 12, L3 ? 73 : 75, tip[0], tip[1], L3 ? 5.4 : 5, L3 ? BRASS : COPPER, { ring: L3 ? M.gold : BRASS });
    if (L3) o += c.ol(`M${tx + 16} 70V64`, M.iron, 1.4) + c.ci(tx + 16, 62, 2, c.sg('#e8e0d0'), 1.4); // 압력계
    if (pose === 'fire') o += jet(c, tip[0] + 1, tip[1], L3 ? 21 : 23, 50, 6, 1.05);
    else o += pilot(c, tip[0], tip[1], pose === 'aim');
    /* 풀무 + 화부 (Lv3: 붉은 앞치마 줄·놋쇠 장식) */
    const B = bellows(c, 30, 98, pose === 'idle' ? 1 : pose === 'aim' ? 0.15 : 0.75);
    const S = stoker(c, 14, 90, 107, 1.2, pose, B.handle, L3 ? { tunic: '#f0e0c0', headCol: '#c23a22' } : {});
    o += S.back + S.legs + S.farArm + S.farHand + S.body + B.s + S.nearArm + S.nearHand;
    return o;
  }

  /* 4A 용의 숨결: 높은 돌탑 꼭대기에 오른쪽을 보는 놋쇠 용 머리 */
  function dragon(c, pose) {
    const h = c.h;
    const st = '#9a8476';
    let o = plat(c, 4, { stone: st, trim: '#ff6b3d' });
    o += footShade(c, 50, 99, 34, 8);
    o += masonryCyl(c, 46, 50, 99, 16, 4.8, STONE.fire, { ch: 7, bw: 10, seed: 71 });
    o += metalBand(c, 46, 60, 64, 16, 4.8, BRASS) + metalBand(c, 46, 84, 88, 16, 4.8, BRASS);
    /* 구리 관이 탑을 감아 오름 */
    o += c.ol('M30 96Q24 84 32 76Q40 70 34 60Q30 54 38 50', COPPER, 2.4);
    o += aura(c, 46, 94, 9, 6, '#ff9a3d', pose === 'idle' ? 0.45 : 0.9);
    o += c.p('M40 99V92Q46 85 52 92V99Z', c.vg(h.mix('#ff9a3d', '#3a1a10', pose === 'idle' ? 0.4 : 0.05), 0.3, -0.3), 2);
    /* 용 머리 (목 → 머리 → 위턱·아래턱을 벌린 입) */
    const lift = pose === 'aim' ? -2 : pose === 'fire' ? 1 : 0;
    const open = pose === 'fire' ? 1 : pose === 'aim' ? 0.6 : 0.25;
    const Y = (y) => y + lift;
    const jaw = 4 + open * 6; // 아래턱 벌어짐
    /* 목(비늘 띠) */
    o += c.p(`M30 54C26 ${Y(42)} 32 ${Y(32)} 42 ${Y(28)}L52 ${Y(30)}C46 ${Y(36)} 44 ${Y(44)} 46 54Z`, c.cg(BRASS), 3);
    o += c.ln(`M31 50Q32 ${Y(44)} 37 ${Y(40)}M33 46Q35 ${Y(38)} 40 ${Y(35)}`, h.shade(BRASS, -0.42), 1.4, 0.8);
    /* 아래턱 + 입속 */
    o += c.p(`M50 ${Y(38)}L72 ${Y(38) + jaw}Q76 ${Y(40) + jaw} 72 ${Y(43) + jaw}L54 ${Y(46)}Q48 ${Y(45)} 50 ${Y(38)}Z`, c.cg(h.shade(BRASS, -0.08)), 2.8);
    o += c.p(`M54 ${Y(37)}L72 ${Y(36) + jaw * 0.5}L72 ${Y(38) + jaw}L54 ${Y(41)}Z`, c.vg('#8a1a1a', 0.2, -0.3), 0);
    o += c.ln(`M60 ${Y(38) + jaw * 0.3}L62 ${Y(36) + jaw * 0.6}L64 ${Y(38) + jaw * 0.6}L66 ${Y(37) + jaw * 0.8}L68 ${Y(39) + jaw * 0.8}`, '#fff6e0', 1.3);
    /* 위턱(주둥이) + 머리 */
    o += c.p(`M40 ${Y(30)}C42 ${Y(22)} 50 ${Y(18)} 58 ${Y(22)}L76 ${Y(28)}Q80 ${Y(31)} 76 ${Y(34)}L56 ${Y(38)}Q46 ${Y(40)} 40 ${Y(30)}Z`, c.cg(BRASS), 3);
    o += c.ln(`M60 ${Y(36)}L62 ${Y(38.5)}L64 ${Y(36)}L66 ${Y(38)}L68 ${Y(35.5)}L70 ${Y(37.4)}L72 ${Y(35)}`, '#fff6e0', 1.3);
    o += c.ln(`M48 ${Y(23)}Q56 ${Y(22)} 66 ${Y(27)}`, h.shade(BRASS, 0.5), 1.4, 0.8);
    o += c.ln(`M44 ${Y(33)}Q50 ${Y(35)} 56 ${Y(34)}`, h.shade(BRASS, -0.45), 1.3, 0.8);
    /* 콧구멍 · 눈썹뼈 · 눈 · 뿔 · 수염 */
    o += c.e(74, Y(29.5), 1.4, 0.9, '#2a1a10', 0);
    o += c.p(`M52 ${Y(24)}Q58 ${Y(21)} 63 ${Y(25)}L60 ${Y(27)}Q56 ${Y(25)} 52 ${Y(26.5)}Z`, c.vg(h.shade(BRASS, -0.15), 0.2, -0.3), 1.8);
    const eyeC = pose === 'idle' ? '#ffb347' : '#fff3b0';
    o += aura(c, 57, Y(28), 4.5, 3, '#ff6b3d', pose === 'idle' ? 0.45 : 0.95) + c.e(57.5, Y(28), 2.4, 1.6, eyeC, 1.4) + c.e(58.2, Y(28), 0.7, 1.2, '#3a1a0a', 0);
    o += c.p(`M46 ${Y(24)}Q38 ${Y(12)} 34 ${Y(8)}Q42 ${Y(12)} 50 ${Y(22)}Z`, c.vg('#f6e2b0', 0.3, -0.25), 2) + c.p(`M42 ${Y(28)}Q32 ${Y(20)} 28 ${Y(18)}Q36 ${Y(24)} 44 ${Y(31)}Z`, c.vg('#f6e2b0', 0.3, -0.25), 1.8);
    o += c.ln(`M70 ${Y(33)}Q74 ${Y(40)} 70 ${Y(46)}M66 ${Y(34)}Q68 ${Y(42)} 64 ${Y(48)}`, '#c8462c', 1.4, 0.9);
    /* 입 안 불빛 · 콧김 · 불길 */
    const mouth = [70, Y(37) + jaw * 0.4];
    if (pose === 'idle') o += smoke(c, 80, Y(22), 3.2, '#cfc4bc', 0.7) + aura(c, mouth[0] - 6, mouth[1], 6, 3.5, '#ff9a3d', 0.55);
    if (pose === 'aim') o += aura(c, mouth[0] - 4, mouth[1], 10, 6, '#ffb347', 0.9) + flame(c, mouth[0] - 2, mouth[1] + 2.5, 7, 9) + embers(c, [[82, Y(22), 1.8], [86, Y(30), 1.6]], '#ffd27a');
    if (pose === 'fire') o += jet(c, mouth[0], mouth[1], 24, 34, 12, 1.1);
    /* 등 지느러미(목 뒤) */
    o += c.p(`M29 50Q21 ${Y(42)} 27 ${Y(36)}Q26 ${Y(44)} 31 ${Y(42)}Q28 ${Y(48)} 29 50Z`, c.vg('#c8462c', 0.2, -0.3), 2) + c.p(`M33 ${Y(36)}Q27 ${Y(28)} 33 ${Y(24)}Q32 ${Y(31)} 37 ${Y(31)}Z`, c.vg('#c8462c', 0.2, -0.3), 2);
    return o;
  }

  /* 4B 불꽃 회오리: 넓은 원통 화로 둘레에 분사구 여섯 개(앞쪽 넷이 보임) */
  function whirl(c, pose) {
    const h = c.h;
    const st = STONE.fire;
    let o = plat(c, 4, { stone: '#9a8476', trim: '#ff6b3d' });
    o += footShade(c, 50, 99, 38, 9);
    const cx = 50;
    const yt = 62;
    const yb = 99;
    const rx = 27;
    const ry = 8.1;
    /* 뒤쪽 분사구(통 뒤로 살짝) */
    const ang = pose === 'fire' ? 18 : pose === 'aim' ? 8 : 0; // 돌아감(분사구 위치가 조금 돈 것처럼)
    const nozz = (deg, front) => {
      const a = (deg + ang) * D2R;
      const x = cx + Math.sin(a) * rx;
      const y = 74 + Math.cos(a) * ry;
      const ox = x + Math.sin(a) * 8;
      const oy = y + Math.cos(a) * 2.6;
      let s = nozzle(c, x, y, ox, oy, 4, BRASS, { rings: [] });
      if (pose === 'fire' && front) s += jet(c, ox, oy, Math.abs(Math.sin(a)) > 0.7 ? 9 : 13, 34, Math.atan2(Math.cos(a) * 2.6 + 1.2, Math.sin(a) * 8) / D2R, 0.75);
      else if (front) s += pilot(c, ox - 1, oy, pose === 'aim');
      return { s, z: Math.cos(a) };
    };
    const all = [0, 60, 120, 180, 240, 300].map((d) => nozz(d, Math.cos((d + ang) * D2R) > -0.2));
    o += all.filter((q) => q.z < 0).map((q) => q.s).join('');
    o += masonryCyl(c, cx, yt, yb, rx, ry, st, { ch: 7, bw: 11, seed: 81 });
    o += metalBand(c, cx, 70, 78, rx, ry, BRASS);
    o += c.e(cx, yt, rx, ry, c.vg(h.shade(st, 0.15), 0.2, -0.05), 2.6);
    /* 윗면 화구(불빛) + 가운데 굴뚝 */
    o += c.e(cx, yt, rx * 0.7, ry * 0.7, c.vg('#3a1a10', -0.1, 0.2), 2);
    o += aura(c, cx, yt - 2, rx * 0.8, 10, '#ff9a3d', pose === 'idle' ? 0.45 : 0.9);
    o += flame(c, cx - 8, yt + 2, 9, pose === 'idle' ? 9 : 14) + flame(c, cx + 9, yt + 2, 8, pose === 'idle' ? 8 : 12);
    o += cyl(c, cx, 34, 60, 5, 1.6, c.cg(M.iron), '#2a2228', 2.4) + metalBand(c, cx, 40, 43, 5, 1.6, BRASS, { rivets: false });
    o += cyl(c, cx, 30, 34, 7, 2.2, c.cg(BRASS), '#2a2228', 2.2);
    if (pose !== 'idle') o += smoke(c, cx, 22 - (pose === 'fire' ? 3 : 0), pose === 'fire' ? 7 : 5.5, '#cfc4bc', 0.8);
    /* 앞 분사구 */
    o += all.filter((q) => q.z >= 0).sort((a, b) => a.z - b.z).map((q) => q.s).join('');
    /* 회전 표시(aim·fire) */
    if (pose !== 'idle') o += motion(c, `M${cx - 30} 90Q${cx} 104 ${cx + 30} 90`, '#ffd27a', 1.8, 0.7);
    o += gem(c, cx, 95, 3, 4, '#ff6b3d', pose !== 'idle');
    return o;
  }

  T.flame_jet = {
    /* 불길이 나오는 곳: 관 끝(1~3), 용의 입(A), 화로 가운데(B) */
    muzzle: [[85, 79], [84, 76], [85, 74], [72, 39], [50, 74]],
    draw(c, v, pose = 'idle') {
      c = fine(c);
      if (v === 1) return lv1(c, pose);
      if (v === 2) return lv23(c, pose, false);
      if (v === 3) return lv23(c, pose, true);
      if (v === 'A') return dragon(c, pose);
      return whirl(c, pose);
    },
  };
})();
