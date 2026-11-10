'use strict';

/* =========================================================
 * 탑 그림 — 🔥 불 · ❄ 얼음 · ⚡ 폭풍 (공용 도구: towers.js)
 * 설계: docs/design/animation.md (자세·개연성 점검표·건물다운 탑), docs/design/towers.md
 *
 * draw(c, v, pose): v = 1|2|3|'A'|'B', pose = 'idle'|'aim'|'fire'
 *  - 공격 탑: idle(쉼) → aim(쏘기 직전: 시위를 끝까지 당김·불씨·빛을 모음) → fire(놓음·섬광·반동)
 *  - 지원 탑(대장간·축전기): 일하는 모습이 idle → aim → fire 로 반복
 *  - 같은 탑은 단계가 올라도 같은 사람·장치(장비가 좋아짐). 4A/4B는 설명대로 다른 모양.
 *  - muzzle(단계별 5개)은 aim/fire 자세의 활 끝·포구·수정 끝과 맞춤.
 *  - 빛은 늘 왼쪽 위. 처마·난간 아래와 땅에 닿는 곳은 짙게. 땅 그림자는 그리지 않음(렌더러 몫).
 * ========================================================= */
(() => {
  const { f, M, STONE, poly, cyl, frus, ring, band, vseam, flame, crystal, orb, aura, spark, bolt, flag, plat, shard, fine, rn: rnS, roundPoly, toneAt, masonry, flagTop, gem, metalBand } = RG.art._tw;
  const T = RG.art._tw.T;
  const OLC = RG.art._tw.OL;

  /* =========================================================
   * 기초 도구
   * ========================================================= */
  const D2R = Math.PI / 180;
  const rotP = (p, o, deg) => {
    const a = deg * D2R;
    const dx = p[0] - o[0];
    const dy = p[1] - o[1];
    return [o[0] + dx * Math.cos(a) - dy * Math.sin(a), o[1] + dx * Math.sin(a) + dy * Math.cos(a)];
  };
  const P2 = (p) => `${f(p[0])} ${f(p[1])}`;
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const pl = (arr) => `M${arr.map(P2).join('L')}`;
  const G = (body, tr) => (tr ? `<g transform="${tr}">${body}</g>` : body);
  const OP = (body, a) => `<g opacity="${a}">${body}</g>`;
  /** 결정적 난수 0~1 (같은 그림은 늘 같은 모양) */
  const rnd = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  /** 경로 문자열의 좌표쌍(M·L·Q·C·Z만)을 함수 W로 옮김 */
  const tpath = (d, W) => d.replace(/([MLQCZ])([^MLQCZ]*)/g, (m, cmd, args) => {
    const n = args.trim() ? args.trim().split(/[\s,]+/).map(Number) : [];
    let out = cmd;
    for (let i = 0; i + 1 < n.length; i += 2) out += `${i ? ' ' : ''}${P2(W(n[i], n[i + 1]))}`;
    return out;
  });
  /** 두 마디 관절: 시작 s, 끝 t, 길이 L1·L2, 굽는 쪽 bend(+1 시계 방향) → 가운데 관절 */
  function joint(s, t, L1, L2, bend) {
    let dx = t[0] - s[0];
    let dy = t[1] - s[1];
    let d = Math.hypot(dx, dy);
    const mx = (L1 + L2) * 0.999;
    if (d > mx) { dx *= mx / d; dy *= mx / d; d = mx; }
    d = Math.max(d, Math.abs(L1 - L2) + 0.01);
    const a = Math.acos(Math.max(-1, Math.min(1, (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d))));
    const b = Math.atan2(dy, dx) + bend * a;
    return [s[0] + Math.cos(b) * L1, s[1] + Math.sin(b) * L1];
  }
  /** 외곽선 있는 마디 선(팔·다리·장대): 점들, 마디별 색, 마디별 굵기(틀 좌표) */
  function limb(c, pts, cols, ws) {
    const wo = Math.max(...ws) * c.s + 2.6;
    let o = c.ln(pl(pts), OLC, wo);
    for (let i = 0; i < pts.length - 1; i++) o += c.ln(pl([pts[i], pts[i + 1]]), cols[i], ws[i] * c.s);
    return o;
  }

  /* =========================================================
   * 사람 — 엉덩이 가운데 (x,y), 크기 k(1 = 머리 반지름 4.6, 엉덩이~정수리 25).
   * 오른쪽(3/4)을 봄: 가까운 어깨(오른팔)는 화면 왼쪽, 먼 어깨(왼팔)는 화면 오른쪽.
   * 팔은 몸 좌표(k 단위, 엉덩이 원점, 위가 −)로 { e: 팔꿈치, h: 손, open: 손을 폄 }.
   * 다리 legs: { far, near } = 발이 땅에 닿는 점(세계 좌표). 없으면 난간 뒤(허리 아래 안 보임).
   * 돌려주는 값: 부품 문자열 + fh/nh(손 위치) + W(몸 좌표 → 세계 좌표) + draw({far, mid, near, front})
   * ========================================================= */
  function man(c, P) {
    const h = c.h;
    const k = P.k || 1;
    const lean = P.lean || 0;
    const hip = [P.x, P.y];
    const W = (lx, ly) => rotP([P.x + lx * k, P.y + ly * k], hip, lean);
    const TP = (d) => tpath(d, W);
    const skin = P.skin || M.skin;
    const tun = P.tunic;
    const tunD = h.shade(tun, -0.3);
    const sleeve = P.sleeve || tun;
    const fore = P.fore || sleeve;
    const glove = P.glove || skin;
    const Sn = W(-3.3, -12.4);
    const Sf = W(3.2, -12.9);
    /* 팔 */
    const armPts = (S, A) => [S, W(...A.e), W(...A.h)];
    const handAt = (A, pts, col) => {
      const H = pts[2];
      if (A.open) {
        const E = pts[1];
        const ang = Math.atan2(H[1] - E[1], H[0] - E[0]) / D2R;
        return G(c.e(H[0] + 0.8 * k, H[1], 2.7 * k, 1.65 * k, col, 2) + c.e(H[0] - 0.4 * k, H[1] - 1.5 * k, 1.2 * k, 0.85 * k, col, 1.6) + c.ln(`M${f(H[0] + 0.4 * k)} ${f(H[1] - 0.2 * k)}h${f(2 * k)}`, c.inkc(col, 0.45), 1, 0.8), `rotate(${f(ang)} ${f(H[0])} ${f(H[1])})`);
      }
      return c.ci(H[0], H[1], 2.05 * k, c.sg(col), 2) + c.ln(`M${f(H[0] - 1 * k)} ${f(H[1] - 0.2 * k)}h${f(1.5 * k)}`, c.inkc(col, 0.45), 1.2, 0.85);
    };
    const fp = armPts(Sf, P.far);
    const np = armPts(Sn, P.near);
    const farArm = limb(c, fp, [h.shade(sleeve, -0.28), h.shade(fore, -0.22)], [3.3 * k, 3 * k]);
    const nearArm = limb(c, np, [sleeve, fore], [3.4 * k, 3.05 * k])
      + (P.bracer ? c.ln(pl([lerp(np[1], np[2], 0.35), lerp(np[1], np[2], 0.78)]), P.bracer, 3.3 * k * c.s) : '');
    const farHand = handAt(P.far, fp, h.shade(glove, -0.12));
    const nearHand = handAt(P.near, np, glove);
    /* 다리 */
    let legs = '';
    if (P.legs) {
      const pants = P.pants || h.shade(tun, -0.35);
      const boot = P.boot || M.woodD;
      const one = (hp, foot, dark) => {
        const A = [foot[0], foot[1] - 1.3 * k];
        const K = joint(hp, A, 6.4 * k, 6.2 * k, -1);
        const pc = dark ? h.shade(pants, -0.25) : pants;
        const bc = dark ? h.shade(boot, -0.2) : boot;
        return limb(c, [hp, K, A], [pc, pc], [3.7 * k, 3.3 * k])
          + c.p(`M${f(A[0] - 1.8 * k)} ${f(A[1] - 2.2 * k)}L${f(A[0] + 1.6 * k)} ${f(A[1] - 2.2 * k)}Q${f(A[0] + 1.9 * k)} ${f(A[1] - 0.2 * k)} ${f(A[0] + 4 * k)} ${f(A[1] + 0.1 * k)}Q${f(A[0] + 4.9 * k)} ${f(A[1] + 1.3 * k)} ${f(A[0] + 4.1 * k)} ${f(foot[1])}L${f(A[0] - 1.9 * k)} ${f(foot[1])}Z`, c.vg(bc, 0.25, -0.2), 2.2);
      };
      legs = one(W(2.2, -0.4), P.legs.far, true) + one(W(-2.4, 0), P.legs.near, false);
    }
    /* 등(망토·화살통) */
    let back = '';
    if (P.cape) back += c.p(TP('M-4.6 -14.8Q-9.6 -7 -11 3.5Q-6 6.2 -1 4.2L2.4 -14.6Z'), c.vg(P.cape, 0.1, -0.3), 2.4);
    if (P.quiver) {
      back += c.p(TP('M-10.6 -6.4L-8.4 -20.4L-5.2 -19.8L-7.4 -5.8Z'), c.cg(P.quiver), 2.2)
        + c.ln(TP('M-10 -9.4L-7 -8.9M-8.9 -17L-5.8 -16.5'), h.shade(P.quiver, -0.4), 1.5)
        + c.ol(TP('M-7.6 -20L-8.6 -24.6M-6.2 -19.8L-5.8 -24.8'), '#e8cf9a', 1.5)
        + c.p(TP('M-8.4 -23.4L-10.6 -26.4L-9 -27.6L-8.2 -25.2ZM-6 -23.6L-6.6 -27.4L-4.6 -27.6L-5.2 -24.2Z'), P.fletch || '#e0442a', 1.6);
    }
    /* 몸통 */
    let body = '';
    body += c.p(TP('M-5 -14.4Q0 -16 4.4 -14.6Q6.2 -12.5 5.8 -9L4.6 -2L5.2 1.8Q0 3.2 -5.2 1.8L-4.7 -2L-5.9 -9Q-6.2 -12.6 -5 -14.4Z'), c.vg(tun, 0.22, -0.22), 2.6);
    body += c.p(TP('M2.4 -15Q6.2 -12.5 5.8 -9L4.6 -2L5.2 1.8Q3.6 2.5 2 2.6Q3.2 -6 2.4 -15Z'), c.dk(tun, 0.42), 0, ' opacity="0.5"');
    body += c.ln(TP('M5.3 -11.6Q5.5 -8.4 4.5 -3.4'), h.mix(tun, '#c4d2f0', 0.55), 1, 0.75);
    body += c.ln(TP('M-4.2 -13.4Q-4.9 -10 -4.2 -6'), c.lt(tun, 0.5), 1, 0.7);
    if (P.chest) body += c.p(TP('M-4.6 -13.6Q0 -15 4.2 -13.8Q5.4 -11 4.9 -7.6Q0 -6.2 -4.9 -7.6Q-5.4 -11 -4.6 -13.6Z'), c.vg(P.chest, 0.35, -0.2), 1.6, c.ink(P.chest))
      + c.ln(TP('M-3 -9.8Q0 -9 3.2 -9.6'), c.inkc(P.chest, 0.4), 1.2, 0.8) + c.ln(TP('M-3.4 -12.6Q-1 -13.6 1.6 -13.4'), c.lt(P.chest, 0.6), 1, 0.8);
    if (P.apron) body += c.p(TP('M-3.6 -11.6L3.8 -11.8L5 3.6Q0 5 -4.8 3.6Z'), c.vg(P.apron, 0.2, -0.25), 1.6, c.ink(P.apron))
      + c.ln(TP('M-3.4 -11.4L-1.6 -15.2M3.6 -11.6L2.6 -15.4'), c.inkc(P.apron, 0.45), 1.4) + c.ln(TP('M-1.2 -6Q-0.6 -1 -1.6 3'), c.inkc(P.apron, 0.35), 1, 0.7);
    else body += c.ln(TP('M-1.6 -15.2L1 -12.6L3.2 -15'), c.inkc(tun, 0.5), 1.3) + c.ln(TP('M-2.4 -1Q-1.6 0.8 -2.6 2.2M1.6 -7.4Q2.4 -5 1.8 -3.6'), c.inkc(tun, 0.4), 1.1, 0.75);
    if (P.belt !== false) body += c.p(TP('M-4.85 -3.4L4.75 -3.4L4.95 -0.9L-5.05 -0.9Z'), P.belt || M.woodD, 1.4, c.ink(P.belt || M.woodD, 0.5)) + c.r(W(2.2, -3.4)[0], W(2.2, -3.4)[1], 1.6 * k, 2.4 * k, M.gold, 0.3, 1, c.ink(M.gold)) + c.ci(W(2.6, -2.8)[0], W(2.6, -2.8)[1], 0.35 * k, '#fff', 0, ' opacity="0.8"');
    if (P.trim) body += c.ln(TP('M-5 -14.4Q0 -16 4.4 -14.6'), P.trim, 1.8);
    /* 목 + 머리 */
    const HC = W(1.2, -20.4);
    body += c.p(TP('M-0.4 -17L2.2 -17L2.5 -14.6L-0.7 -14.6Z'), c.dk(skin, 0.25), 1.2, c.ink(skin));
    /* 머리(조금 크게 — 작은 크기에서도 얼굴·모자가 읽히게) */
    const hs = P.hs || 1.1;
    let head = '';
    head += c.ci(HC[0], HC[1], 4.6 * k, c.sg(skin), 2.6);
    const gear = P.head || 'hair';
    const gc = P.headCol || '#6a3a24';
    const ear = W(-0.6, -19.8);
    if (gear !== 'hood' && gear !== 'fur') head += c.e(ear[0], ear[1], 1.1 * k, 1.5 * k, c.dk(skin, 0.12), 1.2, c.ink(skin));
    /* 얼굴: 눈(오른쪽을 봄)·코·입 */
    const eye = W(3.7, -20.9);
    head += c.e(eye[0], eye[1], 0.75 * k, 1.05 * k, '#2a1a2e', 0) + c.ci(eye[0] + 0.2 * k, eye[1] - 0.4 * k, 0.28 * k, '#ffffff', 0, ' opacity="0.9"');
    const ck = W(3.4, -18.4);
    head += c.e(ck[0], ck[1], 1.1 * k, 0.7 * k, '#e8826a', 0, ' opacity="0.45"');
    if (P.squint) head += c.ln(TP('M2.7 -22L4.6 -21.5'), '#2a1a2e', 1.5);
    else head += c.ln(TP('M2.6 -22.6Q3.8 -23.3 4.9 -22.6'), h.shade(gc, -0.2), 1.5, 0.9);
    head += c.p(TP('M5.6 -20.6Q6.6 -19.4 5.7 -18.6Z'), c.dk(skin, 0.1), 1.1, c.ink(skin));
    head += c.ln(TP(P.shout ? 'M4.2 -17.6L5.2 -17.2' : 'M3.9 -17.4Q4.6 -17 5.2 -17.4'), '#6a2a2a', 1.5);
    if (P.beard) head += c.p(TP('M0.2 -18.6Q0.6 -14.4 3.8 -14.4Q6.4 -14.8 6.2 -18.2Q5 -17 3.4 -17.6Q1.8 -17.2 0.2 -18.6Z'), c.vg(P.beard, 0.2, -0.2), 1.6, c.ink(P.beard, 0.5)) + c.ln(TP('M2 -16.6Q3 -15.4 4.4 -15.6'), c.lt(P.beard, 0.4), 1, 0.7);
    if (gear === 'hood') {
      head += c.p(TP('M5.8 -22.4Q5 -26.9 0.8 -26.8Q-4.4 -26.6 -5.4 -21.8Q-6.2 -17.6 -5 -14.8L-1.6 -15.2Q-2.8 -18 -2 -21.2Q0.6 -24.2 5.8 -22.4Z'), c.vg(gc, 0.2, -0.25), 2.4);
      head += c.p(TP('M-4.2 -25Q-7.6 -25.4 -8.6 -21.6Q-6.6 -22.6 -5.4 -21.6Z'), h.shade(gc, -0.15), 2);
      head += c.p(TP('M-5.8 -16Q0 -18 5.2 -15.6Q6 -13.2 4.2 -12.2Q0 -13.4 -5.8 -12.4Q-6.6 -14.2 -5.8 -16Z'), c.vg(gc, 0.15, -0.25), 2.2);
    } else if (gear === 'helm') {
      head += c.p(TP('M-3.8 -22.4Q-3.8 -27.6 1.4 -27.6Q6.6 -27.6 6.4 -22.4Z'), c.vg(gc, 0.45, -0.2), 2.4);
      head += c.p(TP('M-4.4 -23.1L6.8 -23.1L6.8 -21.6L-4.4 -21.6Z'), c.dk(gc, 0.15), 1.8);
      head += c.p(TP('M5 -21.8L6.1 -21.8L5.9 -19L5.2 -19Z'), c.dk(gc, 0.1), 1.1, c.ink(gc));
      head += c.ci(...W(-2.6, -22.35), 0.45 * k, c.lt(gc, 0.6), 0) + c.ci(...W(1.2, -22.35), 0.45 * k, c.lt(gc, 0.6), 0);
      head += c.ln(TP('M-1.8 -25.6Q0 -26.8 2.2 -26.8'), '#fff', 1.5, 0.6);
      if (P.plume) head += c.p(TP('M0.4 -27.2Q-3 -31.6 -8.4 -29.8Q-5.2 -28.8 -4.2 -26.6Z'), c.vg(P.plume, 0.2, -0.2), 1.8);
    } else if (gear === 'cap') {
      head += c.p(TP('M-3.9 -21.8Q-3.6 -26.7 1.3 -26.6Q5.8 -26.4 6 -22.8L7.8 -22L-3.9 -21.4Z'), c.vg(gc, 0.25, -0.25), 2.2);
      head += c.ln(TP('M-2 -25.2Q0.6 -26 3.4 -25.4'), c.lt(gc, 0.4), 1.2, 0.7);
    } else if (gear === 'goggles') {
      head += c.p(TP('M-3.9 -21Q-3.6 -25.9 1.3 -25.8Q5.8 -25.6 6 -21.4L-3.9 -20.6Z'), c.vg(gc, 0.25, -0.25), 2.2);
      head += c.ln(TP('M-4 -22.4L5.6 -23.4'), '#3a2a24', 1.8);
      const g1 = W(4.3, -23.6);
      head += c.ci(g1[0], g1[1], 1.7 * k, c.sg('#ffd27a'), 1.6) + c.ci(g1[0] - 0.5 * k, g1[1] - 0.5 * k, 0.45 * k, '#ffffff', 0);
    } else if (gear === 'fur') {
      head += c.p(TP('M-4.4 -23.4Q-4.6 -29.8 1.2 -29.6Q6.8 -29.4 6.4 -23.4Z'), c.vg(gc, 0.25, -0.25), 2.4);
      head += c.p(TP('M-5.6 -24.4Q-5.8 -22.4 -4.6 -21.7Q1 -22.7 6.8 -21.9Q7.8 -23 7.2 -24.6Q1 -25.8 -5.6 -24.4Z'), c.vg(P.furCol || '#f2ece0', 0.2, -0.2), 2);
      head += c.p(TP('M-4.8 -21.8Q-6 -17 -4.4 -14.8L-1.8 -15.4Q-2.4 -18 -2 -21.6Z'), c.vg(P.furCol || '#f2ece0', 0.2, -0.2), 1.4, c.ink(P.furCol || '#f2ece0', 0.45));
      head += c.ln(TP('M-3.6 -24.2L-3.2 -22.8M-0.8 -24.6L-0.6 -23M2.2 -24.6L2.2 -23M5 -24.2L4.8 -22.8'), c.inkc(P.furCol || '#f2ece0', 0.3), 0.9, 0.8);
    } else if (gear === 'band') {
      head += c.p(TP('M-3.8 -19.4Q-4.8 -25.8 1.2 -25.8Q5.8 -25.8 6 -22.6Q3 -23.2 0.4 -22.6Q-1.4 -21.6 -1.6 -18.6Z'), c.vg(gc, 0.2, -0.25), 2.2);
      head += c.p(TP('M-4.2 -23.5L5.8 -24.3L5.9 -22.8L-4.1 -22Z'), P.bandCol || '#c23a22', 1.2, c.ink(P.bandCol || '#c23a22')) + c.p(TP('M-4 -22.9Q-6.6 -22.3 -7.4 -19.7Q-5.6 -20.5 -4.2 -21.7Z'), P.bandCol || '#c23a22', 1.6);
    } else if (gear === 'bald') {
      head += c.ln(TP('M-2 -23.6Q0.6 -25 3 -24.6'), '#fff', 1.5, 0.5);
      head += c.p(TP('M-3.8 -19.2Q-4.6 -22.4 -2.8 -23.4Q-2 -21.2 -1.6 -18.6Z'), c.vg(gc, 0.2, -0.2), 1.6);
    } else {
      head += c.p(TP('M-3.8 -19.4Q-4.8 -25.8 1.2 -25.8Q5.8 -25.8 6 -22.4Q3 -23.4 0.4 -22.6Q-1.4 -21.6 -1.6 -18.6Z'), c.vg(gc, 0.2, -0.25), 2.2);
    }
    body += hs === 1 ? head : G(head, `matrix(${hs} 0 0 ${hs} ${f(HC[0] * (1 - hs))} ${f(HC[1] * (1 - hs))})`);
    const out = { back, legs, farArm, farHand, body, nearArm, nearHand, fh: fp[2], nh: np[2], fe: fp[1], ne: np[1], W, k, head: HC };
    out.draw = (o = {}) => back + legs + farArm + (o.far || '') + farHand + body + (o.mid || '') + nearArm + (o.near || '') + nearHand + (o.front || '');
    return out;
  }

  /* =========================================================
   * 활과 화살
   * ========================================================= */
  /** 활 — 손잡이 (x,y), 반높이 hh, 기울기 ang(0 = 세움, 배가 오른쪽), st: 'rest'|'draw'|'snap', nock: 당긴 시위 점(세계 좌표) */
  function bowArt(c, x, y, hh, o = {}) {
    const h = c.h;
    const st = o.st || 'rest';
    const col = o.col || M.woodD;
    const drawn = st === 'draw';
    const bend = hh * (drawn ? 0.4 : 0.3);
    const tx = x - hh * (drawn ? 0.3 : 0.16);
    const ty = hh * (drawn ? 0.93 : 1);
    const rc = o.recurve ? hh * 0.14 : 0;
    const limbD = `M${f(x)} ${f(y)}C${f(x + bend)} ${f(y - hh * 0.25)} ${f(x + bend * 0.85)} ${f(y - ty * 0.78)} ${f(tx)} ${f(y - ty)}${rc ? `Q${f(tx - rc * 0.3)} ${f(y - ty - rc)} ${f(tx + rc)} ${f(y - ty - rc * 1.2)}` : ''}` +
      `M${f(x)} ${f(y)}C${f(x + bend)} ${f(y + hh * 0.25)} ${f(x + bend * 0.85)} ${f(y + ty * 0.78)} ${f(tx)} ${f(y + ty)}${rc ? `Q${f(tx - rc * 0.3)} ${f(y + ty + rc)} ${f(tx + rc)} ${f(y + ty + rc * 1.2)}` : ''}`;
    let s = '';
    /* 시위 */
    const strCol = '#efe2c4';
    const T1 = [tx, y - ty];
    const T2 = [tx, y + ty];
    let nock = o.nock;
    if (nock && o.ang) nock = rotP(nock, [x, y], -o.ang);
    if (drawn && nock) s += c.ln(pl([T1, nock, T2]), OLC, 2.8) + c.ln(pl([T1, nock, T2]), strCol, 1.5);
    else {
      s += c.ln(pl([T1, T2]), OLC, 2.8) + c.ln(pl([T1, T2]), strCol, 1.5);
      if (st === 'snap') s += c.ln(`M${f(tx - 2.6)} ${f(y - ty * 0.75)}Q${f(tx - 4.4)} ${f(y)} ${f(tx - 2.6)} ${f(y + ty * 0.75)}M${f(tx + 2.4)} ${f(y - ty * 0.6)}Q${f(tx + 3.8)} ${f(y)} ${f(tx + 2.4)} ${f(y + ty * 0.6)}`, '#fff', 1.5, 0.75);
    }
    s += c.ol(limbD, col, o.w || 2.4);
    if (o.trim) s += c.ln(`M${f(x + bend * 0.62)} ${f(y - hh * 0.5)}L${f(x + bend * 0.7)} ${f(y - hh * 0.36)}M${f(x + bend * 0.62)} ${f(y + hh * 0.5)}L${f(x + bend * 0.7)} ${f(y + hh * 0.36)}`, o.trim, 2.2);
    s += c.ci(tx + rc, y - ty - rc * 1.2, 1.3, o.trim || h.shade(col, 0.3), 1.4) + c.ci(tx + rc, y + ty + rc * 1.2, 1.3, o.trim || h.shade(col, 0.3), 1.4);
    s += c.r(x - 1.2 + bend * 0.04, y - hh * 0.13, 3, hh * 0.26, o.grip || '#5a3020', 1, 1.6);
    return G(s, o.ang ? `rotate(${f(o.ang)} ${f(x)} ${f(y)})` : '');
  }
  /** 화살 — 시위 쪽 (x1,y1) → 촉 (x2,y2). fire: 불씨 촉 */
  function arrowArt(c, x1, y1, x2, y2, o = {}) {
    const h = c.h;
    const L = Math.hypot(x2 - x1, y2 - y1);
    const ang = Math.atan2(y2 - y1, x2 - x1) / D2R;
    const sc = o.k || 1;
    let s = c.ol(`M${f(x1)} ${f(y1)}H${f(x1 + L - 2.5 * sc)}`, o.shaft || '#e8cf9a', 1.5);
    s += c.p(`M${f(x1)} ${f(y1)}L${f(x1 + 4.6 * sc)} ${f(y1)}L${f(x1 + 3.2 * sc)} ${f(y1 - 2.6 * sc)}L${f(x1 - 0.6 * sc)} ${f(y1 - 2.6 * sc)}Z`, o.fletch || '#e0442a', 1.4)
      + c.p(`M${f(x1)} ${f(y1)}L${f(x1 + 4.6 * sc)} ${f(y1)}L${f(x1 + 3.2 * sc)} ${f(y1 + 2.4 * sc)}L${f(x1 - 0.6 * sc)} ${f(y1 + 2.4 * sc)}Z`, h.shade(o.fletch || '#e0442a', -0.2), 1.4);
    const hx = x1 + L;
    s += c.p(`M${f(hx + 1.2 * sc)} ${f(y1)}L${f(hx - 3.6 * sc)} ${f(y1 - 2.4 * sc)}L${f(hx - 2.6 * sc)} ${f(y1)}L${f(hx - 3.6 * sc)} ${f(y1 + 2.4 * sc)}Z`, o.head || M.ironL, 1.6);
    if (o.fire) {
      s = aura(c, hx - 1, y1, 10 * sc, 8 * sc, '#ff9a3d', 0.85) + s;
      s += G(flame(c, hx - 2.4 * sc, y1 + 0.6, 7.5 * sc, 10 * sc), `rotate(-90 ${f(hx - 2.4 * sc)} ${f(y1 + 0.6)})`);
    }
    return G(s, Math.abs(ang) > 0.5 ? `rotate(${f(ang)} ${f(x1)} ${f(y1)})` : '');
  }
  /** 날아가는 불화살 자국 — 시작 (x,y), 길이 L, 기울기 ang(도) */
  function arrowTrail(c, x, y, L, ang = 0, k = 1) {
    const s = c.p(`M${f(x)} ${f(y)}Q${f(x + L * 0.5)} ${f(y - 2.6 * k)} ${f(x + L)} ${f(y - 0.6 * k)}L${f(x + L)} ${f(y + 0.6 * k)}Q${f(x + L * 0.5)} ${f(y + 2.6 * k)} ${f(x)} ${f(y)}Z`, c.fo(), 0, ' opacity="0.85"')
      + c.ln(`M${f(x + L * 0.2)} ${f(y)}L${f(x + L * 0.95)} ${f(y)}`, '#fff3b0', 1.6)
      + c.ln(`M${f(x + L * 0.1)} ${f(y - 4.4 * k)}L${f(x + L * 0.55)} ${f(y - 4.4 * k)}M${f(x + L * 0.25)} ${f(y + 4.6 * k)}L${f(x + L * 0.7)} ${f(y + 4.6 * k)}`, '#fff', 1.5, 0.6)
      + spark(c, x + L, y, 4.2 * k, '#ffd94a', 1.4);
    return G(s, ang ? `rotate(${f(ang)} ${f(x)} ${f(y)})` : '');
  }

  /* =========================================================
   * 건물 재료
   * ========================================================= */
  /** 돌을 쌓은 원기둥·원뿔대 벽: 위 yt(반지름 rt) ~ 아래 yb(반지름 rb). 돌 한 줄 높이 ch
   *  돌 하나하나(자리에 따른 밝기 + 색 흔들림 + 모서리 빛·그늘), 줄눈은 돌 색의 어두운 변형 — towers.js masonry */
  function stoneWall(c, cx, yt, yb, rt, rb, col, o = {}) {
    const kE = o.kE || 0.3;
    let s = masonry(c, cx, yt, yb, rt, rb, kE, col, { ch: o.ch || 7, bw: o.bw || 13, seed: o.seed || 1, moss: o.moss, rough: o.rough });
    if (o.top) s += c.e(cx, yt, rt, rt * kE, o.top, 3);
    return s;
  }
  /** 둥근 돌담(포대·우물 같은 고리 벽): part 'back' = 담 윗면 + 안쪽 바닥(먼저), 'front' = 앞 담(안의 것을 가림) */
  function ringWall(c, cx, yt, yb, rx, th, col, part, o = {}) {
    const h = c.h;
    const kE = o.kE || 0.3;
    const ry = rx * kE;
    const ri = rx - th;
    const riy = ri * kE;
    if (part === 'back') {
      return c.e(cx, yt, rx, ry, c.vg(h.shade(col, 0.25), 0.2, -0.05), 2.6)
        + c.e(cx, yt, ri, riy, c.vg(o.floor || c.dk(col, 0.55), -0.1, 0.15), 2.2, c.ink(col))
        /* 안쪽 담 그늘(앞 담 안쪽 면이 아니라 뒤 담 안쪽 면) */
        + c.p(`M${f(cx - ri)} ${f(yt)}A${f(ri)} ${f(riy)} 0 0 1 ${f(cx + ri)} ${f(yt)}A${f(ri)} ${f(riy * 0.55)} 0 0 0 ${f(cx - ri)} ${f(yt)}Z`, c.dk(col, 0.35), 0);
    }
    let s = masonry(c, cx, yt, yb, rx, rx, kE, col, { ch: o.ch || 6, bw: o.bw || 12, seed: o.seed || 31, moss: o.moss });
    s += c.p(`M${f(cx - rx)} ${f(yt)}A${f(rx)} ${f(ry)} 0 0 0 ${f(cx + rx)} ${f(yt)}H${f(cx + ri)}A${f(ri)} ${f(riy)} 0 0 1 ${f(cx - ri)} ${f(yt)}Z`, c.vg(h.shade(col, 0.3), 0.2, -0.1), 2.2);
    s += c.ln(`M${f(cx - ri * 0.7)} ${f(yt + riy * 0.72 + 1)}A${f(ri)} ${f(riy)} 0 0 0 ${f(cx + ri * 0.2)} ${f(yt + riy + 1)}`, c.lt(col, 0.6), 1, 0.7);
    return s;
  }
  /** 돌을 쌓은 평평한 벽(사각형): 줄마다 엇갈린 돌 하나하나(색 흔들림 + 윗·왼 모서리 빛, 아래·오른 모서리 그늘)
   *  o.fill 이 있으면 원기둥처럼 좌우 명암을 크게(둥근 벽), 없으면 은은하게(평평한 벽). ow 0 = 외곽선 없음 */
  function stoneRect(c, x, y, w, ht, col, o = {}) {
    const h = c.h;
    const ch = o.ch || 7;
    const seed = o.seed || 3;
    const n = Math.max(1, Math.round(ht / ch));
    const dy = ht / n;
    const g = 0.5;
    const round = o.fill && o.fill !== 'none';
    let s = c.r(x, y, w, ht, o.mortar || c.dk(col, 0.55), o.rx || 0, 0);
    let hi = '';
    let lo = '';
    for (let i = 0; i < n; i++) {
      const y1 = y + i * dy;
      const bw = o.bw || 11;
      let xx = x + (i % 2 ? bw * 0.5 : 0) + rnd(seed + i) * 3;
      const xs = [x];
      while (xx < x + w - 3) { if (xx > x + 3) xs.push(xx); xx += bw * (0.8 + rnd(seed * 3 + i + xx) * 0.4); }
      xs.push(x + w);
      for (let j = 0; j < xs.length - 1; j++) {
        const a = xs[j] + (j ? g : 0);
        const b = xs[j + 1] - (j < xs.length - 2 ? g : 0);
        const t = y1 + (i ? g : 0);
        const bt = y1 + dy - (i < n - 1 ? g : 0);
        if (b - a < 0.8) continue;
        const u = ((a + b) / 2 - x) / w;
        const tone = toneAt(h, col, round ? u : 0.28 + u * 0.4);
        const fill = tintStoneA(h, tone, rnd(seed * 11 + i * 7 + j));
        s += c.r(a, t, b - a, bt - t, fill, Math.min(0.8, (b - a) * 0.2), 0);
        if (b - a > 2.2) {
          if (u < 0.85) hi += `M${f(a + 0.5)} ${f(bt - 0.6)}V${f(t + 0.55)}H${f(b - 0.6)}`;
          lo += `M${f(a + 0.6)} ${f(bt - 0.5)}H${f(b - 0.5)}V${f(t + 0.7)}`;
        }
      }
    }
    if (hi) s += c.ln(hi, c.lt(col, 0.5), 1, 0.7);
    if (lo) s += c.ln(lo, c.dk(col, 0.5), 1, 0.55);
    if (o.ow !== 0) s += c.r(x, y, w, ht, 'none', o.rx || 0, o.ow == null ? 3 : o.ow);
    return s;
  }
  /** 돌 색 흔들림(푸른·누런·보랏빛) */
  const TINT_A = ['#9aa8c8', '#c8b07a', '#a08ab0', '#ffffff', '#3a2a40'];
  const tintStoneA = (h, col, q) => (q < 0.5 ? col : h.mix(col, TINT_A[Math.floor((q - 0.5) * 10) % 5], q > 0.9 ? 0.1 : 0.16));
  /** 통나무·들보 (x1,y1)→(x2,y2), 굵기 w(틀 좌표). end: 잘린 끝 나이테 */
  function beam(c, x1, y1, x2, y2, w, col, o = {}) {
    const h = c.h;
    const L = Math.hypot(x2 - x1, y2 - y1);
    const nx = -(y2 - y1) / L;
    const ny = (x2 - x1) / L;
    let s = limb(c, [[x1, y1], [x2, y2]], [col], [w]);
    const g = w * 0.22;
    s += c.ln(`M${f(x1 + nx * g + (x2 - x1) * 0.08)} ${f(y1 + ny * g + (y2 - y1) * 0.08)}L${f(x1 + nx * g + (x2 - x1) * 0.55)} ${f(y1 + ny * g + (y2 - y1) * 0.55)}M${f(x1 - nx * g + (x2 - x1) * 0.4)} ${f(y1 - ny * g + (y2 - y1) * 0.4)}L${f(x1 - nx * g + (x2 - x1) * 0.92)} ${f(y1 - ny * g + (y2 - y1) * 0.92)}`, h.shade(col, -0.38), 1.5, 0.75);
    if (o.light !== false) s += c.ln(`M${f(x1 + nx * w * 0.32 + (x2 - x1) * 0.1)} ${f(y1 + ny * w * 0.32 + (y2 - y1) * 0.1)}L${f(x1 + nx * w * 0.32 + (x2 - x1) * 0.9)} ${f(y1 + ny * w * 0.32 + (y2 - y1) * 0.9)}`, h.shade(col, 0.35), 1.5, 0.6);
    if (o.end) s += c.e(x2, y2, w * 0.5, w * 0.36, h.shade(col, 0.3), 1.8) + c.e(x2, y2, w * 0.22, w * 0.15, 'none', 0, ` stroke="${h.shade(col, -0.3)}" stroke-width="${c.sw(1.5)}"`);
    return s;
  }
  /** 밧줄 감개 — (x,y)에 너비 w, 높이 ht */
  function lash(c, x, y, w = 6, ht = 4) {
    let d = '';
    for (let t = 0.25; t < 1; t += 0.25) d += `M${f(x - w / 2 + w * t - 0.8)} ${f(y - ht / 2 + 0.4)}L${f(x - w / 2 + w * t + 0.8)} ${f(y + ht / 2 - 0.4)}`;
    return c.r(x - w / 2, y - ht / 2, w, ht, c.vg(M.rope, 0.3, -0.25), 1, 1.6) + c.ln(d, c.inkc(M.rope, 0.45), 1, 0.9) + c.ln(`M${f(x - w / 2 + 1)} ${f(y - ht / 2 + 0.8)}H${f(x + w / 2 - 1)}`, c.lt(M.rope, 0.5), 0.8, 0.8);
  }
  /** 널빤지 판(난간·벽): 세로 널(vert) 또는 가로 널 + 나뭇결 + 못 */
  function planks(c, x, y, w, ht, col, o = {}) {
    const h = c.h;
    const n = o.n || Math.max(2, Math.round((o.vert ? w : ht) / 7));
    let s = c.r(x, y, w, ht, c.vg(col, 0.22, -0.22), o.rx || 1.5, o.ow || 2.6);
    let d = '';
    let g = '';
    let nails = '';
    for (let i = 1; i < n; i++) {
      if (o.vert) { const xx = x + (w * i) / n; d += `M${f(xx)} ${f(y + 1)}V${f(y + ht - 1)}`; }
      else { const yy = y + (ht * i) / n; d += `M${f(x + 1)} ${f(yy)}H${f(x + w - 1)}`; }
    }
    for (let i = 0; i < n; i++) {
      if (o.vert) {
        const xx = x + (w * (i + 0.5)) / n;
        g += `M${f(xx - 0.6)} ${f(y + ht * 0.2)}Q${f(xx + 0.8)} ${f(y + ht * 0.45)} ${f(xx - 0.2)} ${f(y + ht * (0.6 + rnd(i) * 0.25))}`;
        if (o.nails !== false) nails += c.ci(xx, y + 2.2, 0.75, M.iron, 0) + c.ci(xx, y + ht - 2.2, 0.75, M.iron, 0);
      } else {
        const yy = y + (ht * (i + 0.5)) / n;
        g += `M${f(x + w * (0.1 + rnd(i) * 0.15))} ${f(yy - 0.4)}Q${f(x + w * 0.35)} ${f(yy + 0.9)} ${f(x + w * (0.55 + rnd(i + 3) * 0.2))} ${f(yy)}`;
        if (o.nails !== false) nails += c.ci(x + 2.4, yy, 0.75, M.iron, 0) + c.ci(x + w - 2.4, yy, 0.75, M.iron, 0);
      }
    }
    s += c.ln(d, h.shade(col, -0.42), 1.5) + c.ln(g, h.shade(col, -0.25), 1.5, 0.6) + nails;
    if (o.under) s += c.r(x + 1.5, y + ht - 2.6, w - 3, 2.2, '#1c1426', 0, 0, ' opacity="0.25"');
    return s;
  }
  /** 기와 원뿔 지붕 — 아래 가운데 (x,y), 너비 w, 높이 ht. 기와 줄과 처마 물결 */
  function tileCone(c, x, y, w, ht, col, o = {}) {
    const h = c.h;
    const r = w / 2;
    const kE = o.kE || 0.26;
    let s = c.p(`M${f(x - r)} ${f(y)}L${f(x)} ${f(y - ht)}L${f(x + r)} ${f(y)}A${f(r)} ${f(r * kE)} 0 0 1 ${f(x - r)} ${f(y)}Z`, c.cg(col), 3);
    const dk = h.shade(col, -0.38);
    let d = '';
    const rows = o.rows || 4;
    for (let i = 1; i <= rows; i++) {
      const t = i / (rows + 0.6);
      const yy = y - ht + ht * t;
      const rr = r * t;
      d += ring(x, yy, rr, rr * kE);
      const nT = 5 + i * 2;
      for (let j = 0; j < nT; j++) {
        const a = -1.35 + ((j + (i % 2 ? 0.5 : 0)) / nT) * 2.7;
        if (Math.abs(a) > 1.4) continue;
        const t0 = (i - 1) / (rows + 0.6);
        const xa = x + rr * Math.sin(a);
        const xb = x + r * t0 * Math.sin(a);
        d += `M${f(xa)} ${f(yy + rr * kE * Math.cos(a))}L${f(xb)} ${f(y - ht + ht * t0 + r * t0 * kE * Math.cos(a))}`;
      }
    }
    s += c.ln(d, dk, 1.5, 0.75);
    /* 처마 물결 */
    let sc = '';
    const nS = o.scallops || 9;
    for (let j = 0; j < nS; j++) {
      const a1 = -1.45 + (j / nS) * 2.9;
      const a2 = -1.45 + ((j + 1) / nS) * 2.9;
      const p1 = [x + r * Math.sin(a1), y + r * kE * Math.cos(a1)];
      const p2 = [x + r * Math.sin(a2), y + r * kE * Math.cos(a2)];
      sc += `M${P2(p1)}Q${f((p1[0] + p2[0]) / 2)} ${f((p1[1] + p2[1]) / 2 + 2.6)} ${P2(p2)}`;
    }
    s += c.ln(sc, OLC, 2.2) + c.ln(`M${f(x - r * 0.55)} ${f(y - ht * 0.25)}L${f(x - 1.2)} ${f(y - ht + 3)}`, h.shade(col, 0.4), 1.6, 0.7);
    return s;
  }
  /** 불 켜진 아치 창 — 가운데 x, 아래 yb, 너비 w, 높이 ht (창턱 그늘 포함)
   *  창틀은 벽 안쪽 부품이라 진한 윤곽색 대신 돌 색의 어두운 변형, 둘레 벽에 불빛이 번짐 */
  function litWindow(c, x, yb, w, ht, glow = '#ffc65a', o = {}) {
    const fr = o.frame || '#7a6a60';
    let s = aura(c, x, yb - ht * 0.45, w * 1.25, ht * 0.85, glow, 0.38);
    s += c.p(`M${f(x - w / 2 - 1.4)} ${f(yb + 1)}V${f(yb - ht + w / 2)}Q${f(x)} ${f(yb - ht - w * 0.32 - 1.6)} ${f(x + w / 2 + 1.4)} ${f(yb - ht + w / 2)}V${f(yb + 1)}Z`, c.vg(fr, 0.15, -0.2), 1.8, c.ink(fr, 0.65));
    s += c.p(`M${f(x - w / 2)} ${f(yb)}V${f(yb - ht + w / 2)}Q${f(x)} ${f(yb - ht - w * 0.25)} ${f(x + w / 2)} ${f(yb - ht + w / 2)}V${f(yb)}Z`, c.vg(c.h.mix(glow, '#fff6d0', 0.35), 0.3, -0.35), 1.4, c.ink(fr, 0.75));
    /* 안쪽 위 그늘(창 깊이) */
    s += c.p(`M${f(x - w / 2)} ${f(yb - ht + w / 2)}Q${f(x)} ${f(yb - ht - w * 0.25)} ${f(x + w / 2)} ${f(yb - ht + w / 2)}V${f(yb - ht + w / 2 + 2)}Q${f(x)} ${f(yb - ht - w * 0.25 + 2.4)} ${f(x - w / 2)} ${f(yb - ht + w / 2 + 2)}Z`, c.dk(glow, 0.55), 0, ' opacity="0.55"');
    if (o.bars !== false) s += c.ln(`M${f(x)} ${f(yb - ht - w * 0.1)}V${f(yb)}M${f(x - w / 2)} ${f(yb - ht * 0.45)}H${f(x + w / 2)}`, c.dk(glow, 0.65), 1.3, 0.85);
    s += c.r(x - w / 2 - 2, yb, w + 4, 2.2, c.vg(c.lt(fr, 0.3), 0.3, -0.2), 0.6, 1.3, c.ink(fr, 0.65)) + c.r(x - w / 2 - 1, yb + 2.2, w + 2, 1.8, '#1c1426', 0, 0, ' opacity="0.3"');
    return s;
  }
  /** 처마 등불(걸이 끝 (x,y)에 매달림) — 쇠 뚜껑·유리·불꽃 + 둘레에 따뜻한 빛 */
  function lantern(c, x, y, k = 1) {
    const P = (a, b) => `${f(x + a * k)} ${f(y + b * k)}`;
    let s = aura(c, x, y + 6 * k, 10 * k, 10 * k, '#ffb347', 0.5);
    s += c.p(`M${P(-3.2, 2.6)}L${P(3.2, 2.6)}L${P(2.5, 10)}L${P(-2.5, 10)}Z`, c.vg('#ffe08a', 0.45, -0.2), 1.8);
    s += c.e(x, y + 6.8 * k, 1.1 * k, 2 * k, '#fff6c8', 0);
    s += c.ln(`M${P(-1.1, 2.8)}L${P(-0.9, 9.8)}M${P(1.1, 2.8)}L${P(0.9, 9.8)}`, c.inkc(M.iron, 0.3), 1, 0.85);
    s += c.p(`M${P(-4.2, 3)}L${P(0, -0.6)}L${P(4.2, 3)}Z`, c.vg(M.iron, 0.4, -0.25), 1.8) + c.r(x - 3 * k, y + 9.6 * k, 6 * k, 1.8 * k, M.iron, 0.5, 1.4);
    s += c.ci(x - 1.4 * k, y + 1.7 * k, 0.45 * k, '#ffffff', 0, ' opacity="0.7"');
    return s;
  }
  /** 받침 위 탑 발치의 접지 그늘(받침 윗면에만) */
  const footShade = (c, x, y, rx, ry, a = 0.28) => c.e(x, y, rx, ry, '#1c1426', 0, ` opacity="${a}"`);
  /** 원기둥을 도는 금속 띠(안쪽 부품: 진한 윤곽 대신 띠 색의 어두운 변형) + 윗모서리 반짝 띠 + 리벳 */
  function bandI(c, cx, y1, y2, rx, ry, col, o = {}) {
    let s = band(c, cx, y1, y2, rx, ry, c.cg(col), 1.6) ;
    s = s.replace('/>', `${c.ink(col, 0.62)}/>`);
    s += c.ln(ring(cx, y1 + 0.8, rx * 0.97, ry * 0.97), c.lt(col, 0.65), 0.9, 0.85);
    if (o.rivets !== false && rx > 8) {
      [-60, -30, 0, 30, 60].forEach((dg) => {
        const a = dg * D2R;
        s += c.ci(cx + rx * Math.sin(a), (y1 + y2) / 2 + ry * Math.cos(a), Math.min(0.9, (y2 - y1) * 0.22), dg < 20 ? c.lt(col, 0.6) : c.dk(col, 0.3), 0);
      });
    }
    return s;
  }

  /* =========================================================
   * 효과
   * ========================================================= */
  /** 연기 덩어리 — 가운데 (x,y), 크기 r */
  function smoke(c, x, y, r, col = '#d8d0c8', a = 0.9) {
    const h = c.h;
    const sg = c.def(`sm${col}`, (id) => c.rgc(id, [[0, h.shade(col, 0.45)], [0.55, col], [1, h.shade(col, -0.28)]], 0.38, 0.3, 0.8));
    const d = `M${f(x - r * 1.15)} ${f(y + r * 0.45)}Q${f(x - r * 1.35)} ${f(y - r * 0.2)} ${f(x - r * 0.7)} ${f(y - r * 0.35)}Q${f(x - r * 0.55)} ${f(y - r * 1.05)} ${f(x + r * 0.1)} ${f(y - r * 0.95)}Q${f(x + r * 0.75)} ${f(y - r * 1.1)} ${f(x + r * 0.85)} ${f(y - r * 0.35)}Q${f(x + r * 1.4)} ${f(y - r * 0.1)} ${f(x + r * 1.15)} ${f(y + r * 0.45)}Q${f(x)} ${f(y + r * 0.8)} ${f(x - r * 1.15)} ${f(y + r * 0.45)}Z`;
    return OP(c.p(d, sg, 2.2) + c.ln(`M${f(x - r * 0.5)} ${f(y - r * 0.2)}Q${f(x - r * 0.1)} ${f(y - r * 0.55)} ${f(x + r * 0.35)} ${f(y - r * 0.45)}`, h.shade(col, 0.55), 1.5, 0.8), a);
  }
  /** 포구 섬광 — 가운데 (x,y), 크기 r, 방향 ang(도, 0=오른쪽) */
  function muzzleFlash(c, x, y, r, ang = 0, col = '#ffb347') {
    const pts = [];
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const rr = i % 2 ? r * 0.45 : r * (i % 4 ? 0.8 : 1.15);
      pts.push([x + Math.cos(a) * rr * (Math.cos(a) > 0 ? 1.35 : 0.8), y + Math.sin(a) * rr * 0.85]);
    }
    return aura(c, x, y, r * 1.8, r * 1.6, col, 0.7) + G(c.p(poly(pts), c.vg('#ffd94a', 0.3, -0.1), 2) + c.ci(x + r * 0.15, y, r * 0.38, '#fff8d0', 0), ang ? `rotate(${f(ang)} ${f(x)} ${f(y)})` : '');
  }
  /** 불티 점들 */
  const embers = (c, list, col = '#ffb347') => list.map(([x, y, r]) => spark(c, x, y, r || 2.6, col, 0)).join('');
  /** 소리·파동 고리(앞쪽 반원 둘) — 가운데 (x,y), 반지름들 */
  const soundRings = (c, x, y, rs, col, w = 2.6, ky = 0.75) => rs.map((r, i) => c.ln(`M${f(x - r * 0.55)} ${f(y - r * ky)}Q${f(x - r * 1.15)} ${f(y)} ${f(x - r * 0.55)} ${f(y + r * ky)}M${f(x + r * 0.55)} ${f(y - r * ky)}Q${f(x + r * 1.15)} ${f(y)} ${f(x + r * 0.55)} ${f(y + r * ky)}`, col, w, f(0.95 - i * 0.22))).join('');
  /** 움직임 줄(바람·휘두름) */
  const motion = (c, d, col = '#ffffff', w = 1.8, a = 0.75) => c.ln(d, col, w, a);

  /* =========================================================
   * 🔥 불씨 궁수탑 — 같은 궁수가 단계마다 장비가 좋아짐
   *  idle: 활을 비스듬히 내리고 한 손은 난간에
   *  aim : 먼 팔(왼손)로 활대를 앞으로 뻗고, 가까운 손(오른손)이 시위를 뺨까지 당김 + 불붙은 화살
   *  fire: 시위가 튕겨 곧게 펴짐(떨림 줄), 화살 없음 → 불꽃 자국, 오른손이 귀 뒤로 빠짐
   * ========================================================= */
  /* 궁수 자세 표(몸 좌표, k 단위): 먼 팔 e·h, 가까운 팔 e·h, 몸 기울기, 활 기울기 */
  const ARCHER = {
    idle: { far: { e: [4.6, -7.4], h: [9, -8.8] }, near: { e: [-4.9, -7.2], h: [-1.4, -5.6] }, lean: 0, bow: 38 },
    aim: { far: { e: [8.7, -15], h: [14.2, -16.9] }, near: { e: [-5.8, -16.8], h: [1, -16.7] }, lean: -4, bow: 0 },
    fire: { far: { e: [8.9, -14.8], h: [14.6, -16.5] }, near: { e: [-7.8, -15], h: [-2.8, -18.8], open: true }, lean: 3, bow: 7 },
  };
  /** 궁수 + 활 + 화살. 돌려줌: { pre: 난간 뒤, post: 난간 앞, tip: 화살촉(aim) } */
  function archer(c, x, y, k, pose, G0 = {}) {
    const A = ARCHER[pose];
    const P = man(c, {
      x, y, k, lean: A.lean, far: A.far, near: A.near,
      tunic: G0.tunic || '#f2dca6', head: G0.head || 'hood', headCol: G0.headCol || '#e8402a', chest: G0.chest, trim: G0.trim,
      bracer: G0.bracer, cape: G0.cape, quiver: G0.quiver || M.wood, fletch: '#e0442a', plume: G0.plume, squint: pose === 'aim',
      glove: G0.glove,
    });
    const hh = 13 * k * (G0.long || 1);
    const gx = P.fh[0];
    const gy = P.fh[1];
    const bowOpt = { col: G0.bowCol || M.woodD, trim: G0.bowTrim, recurve: G0.recurve, w: G0.long ? 2.8 : 2.4 };
    if (pose === 'idle') {
      const bw = bowArt(c, gx, gy, hh, { ...bowOpt, ang: A.bow });
      return { pre: P.draw({ far: bw }), post: '', tip: null };
    }
    if (pose === 'aim') {
      const nock = P.nh;
      const tip = [gx + 6.2 * k * (G0.long ? 1.25 : 1), gy - 0.25 * k];
      const bw = bowArt(c, gx, gy, hh, { ...bowOpt, st: 'draw', nock });
      const ar = arrowArt(c, nock[0], nock[1], tip[0], tip[1], { fire: true, k: k * 0.8 });
      c.tip = tip;
      return { pre: P.back + P.farArm + P.body, post: bw + P.farHand + ar + P.nearArm + P.nearHand, tip };
    }
    const bw = bowArt(c, gx, gy, hh, { ...bowOpt, st: 'snap', ang: A.bow });
    const tr = arrowTrail(c, gx + 3 * k, gy - 0.6 * k, 15 * k * (G0.trail || 1), -2, k * 0.8);
    return { pre: P.back + P.farArm + P.body, post: bw + P.farHand + P.nearArm + P.nearHand + tr, tip: null };
  }
  /** 횃불(쇠 받침 + 불꽃) — 받침 위 (x,y) */
  const torch = (c, x, y, s = 1) => c.p(`M${f(x - 3.4 * s)} ${f(y - 4 * s)}H${f(x + 3.4 * s)}L${f(x + 2 * s)} ${f(y)}H${f(x - 2 * s)}Z`, c.vg(M.iron, 0.35, -0.3), 2) + flame(c, x, y - 3.4 * s, 9 * s, 13 * s) + embers(c, [[x + 4 * s, y - 15 * s, 1.6 * s], [x - 3 * s, y - 18 * s, 1.3 * s]]);

  /** 성가퀴(톱니 담) — 가운데 (cx, y=안쪽 바닥 높이), 반지름 r. part: 'back'(안쪽 뒷벽) | 'front'(앞 담 + 앞 톱니) */
  function parapet(c, cx, y, r, col, part) {
    const h = c.h;
    const ry = r * 0.3;
    const hb = 7;
    if (part === 'back') {
      let o = c.e(cx, y, r, ry, c.vg(h.shade(col, -0.45), 0, -0.1), 2.4);
      o += c.p(`M${f(cx - r)} ${f(y)}V${f(y - hb)}A${f(r)} ${f(ry)} 0 0 1 ${f(cx + r)} ${f(y - hb)}V${f(y)}A${f(r)} ${f(ry)} 0 0 0 ${f(cx - r)} ${f(y)}Z`, c.vg(h.shade(col, -0.18), 0.1, -0.15), 2.4);
      [-62, -24, 24, 62].forEach((d) => {
        const a = d * D2R;
        const x = cx + r * Math.sin(a);
        const yy = y - hb - ry * Math.cos(a);
        o += stoneRect(c, x - 4.5, yy - 7, 9, 7.6, h.shade(col, -0.1), { ch: 4, bw: 5, seed: d + 50, ow: 2.2 });
      });
      return o;
    }
    let o = stoneWall(c, cx, y, y + 10, r, r, col, { ch: 5, bw: 11, seed: 2 });
    o += c.ln(ring(cx, y, r, ry), h.shade(col, 0.35), 1.6);
    [-80, -50, 50, 80].forEach((d) => {
      const a = d * D2R;
      const x = cx + r * Math.sin(a);
      const yy = y + ry * Math.cos(a);
      o += stoneRect(c, x - 4.6, yy - 8, 9.2, 8.6, col, { ch: 4.3, bw: 5, seed: d + 90, ow: 2.4 });
    });
    return o;
  }

  T.ember_archer = {
    /* 화살촉(aim) 위치 — 아래 그림의 tip 과 같게 맞춤 */
    muzzle: [[77, 23], [67, 39], [68, 29], [66, 40], [62, 41]],
    draw(c, v, pose = 'idle') {
      const h = c.h;
      const st = STONE.fire;
      const red = '#c8462c';
      if (v === 1) {
        /* 통나무 망루: 네 기둥 + X자 버팀대(밧줄로 묶음) + 사다리 + 널빤지 마루와 난간 */
        let o = plat(c, 1);
        const lg = M.wood;
        const lgD = h.shade(M.wood, -0.3);
        o += footShade(c, 50, 104, 30, 7);
        o += beam(c, 37, 101, 38, 60, 5, lgD) + beam(c, 63, 101, 62, 60, 5, lgD);
        /* 사다리(가운데 뒤) */
        o += limb(c, [[44, 103], [45.5, 70]], [lgD], [2.4]) + limb(c, [[54, 103], [53.5, 70]], [lgD], [2.4]);
        o += c.ln('M44.4 97H53.8M44.8 90H53.7M45 83H53.6M45.3 76H53.5', h.shade(lgD, 0.2), 2.2);
        /* 앞 기둥 + 버팀대 */
        o += beam(c, 29, 98, 71, 72, 3.6, lg, { light: false }) + beam(c, 71, 98, 29, 72, 3.6, lg, { light: false });
        o += beam(c, 25, 108, 27, 66, 6, lg) + beam(c, 75, 108, 73, 66, 6, lg);
        o += lash(c, 50, 85, 6, 5) + lash(c, 27.6, 74, 7, 4) + lash(c, 72.4, 74, 7, 4) + lash(c, 27, 97, 7, 4) + lash(c, 73, 97, 7, 4);
        /* 마루 들보 */
        o += planks(c, 18, 66, 64, 6, M.plank, { n: 1, nails: false }) + c.r(19, 72, 62, 2.6, '#1c1426', 0, 0, ' opacity="0.3"');
        /* 뒤 난간 */
        o += beam(c, 33, 66, 33, 38, 3.6, lgD) + beam(c, 67, 66, 67, 38, 3.6, lgD) + beam(c, 31, 42, 69, 42, 3, lgD, { light: false });
        const A = archer(c, 47, 51, 1.78, pose, { chest: '#a8502e' });
        o += A.pre;
        /* 앞 난간(가로 널) + 모서리 기둥 */
        o += planks(c, 21, 44, 58, 22, M.plank, { n: 3, under: true });
        o += beam(c, 22, 68, 22, 36, 5, lg, { end: true }) + beam(c, 78, 68, 78, 36, 5, lg, { end: true });
        o += A.post;
        o += torch(c, 22, 33, 1);
        return o;
      }
      if (v === 2) {
        /* 돌 받침 위 나무 망대 + 기와 지붕 + 처마 등불 */
        let o = plat(c, 2, { stone: st });
        o += footShade(c, 50, 104, 30, 8);
        o += stoneWall(c, 50, 76, 104, 23, 28, st, { ch: 7, moss: true, seed: 4 });
        o += litWindow(c, 50, 97, 8, 11, '#ffb347', { frame: h.shade(st, -0.2) });
        /* 뒤 기둥 + 뒤 난간 */
        o += beam(c, 30, 74, 30, 15, 3.6, h.shade(M.wood, -0.3)) + beam(c, 70, 74, 70, 15, 3.6, h.shade(M.wood, -0.3));
        o += beam(c, 29, 52, 71, 52, 3, h.shade(M.wood, -0.3), { light: false });
        const A = archer(c, 45, 62, 1.32, pose, { chest: '#9a5a30', bracer: '#5a3020' });
        o += A.pre;
        o += planks(c, 21, 54, 58, 19, M.plank, { n: 3, under: true });
        o += c.r(19, 72, 62, 4.4, c.vg(h.shade(M.wood, -0.1), 0.2, -0.3), 1, 2.4) + c.ln('M24 74.2H76', h.shade(M.wood, -0.45), 1.5);
        o += beam(c, 22, 77, 22, 16, 4.6, M.wood) + beam(c, 78, 77, 78, 16, 4.6, M.wood);
        o += A.post;
        /* 지붕 + 처마 밑 그늘 + 등불 */
        o += c.e(50, 17.5, 33, 6, '#1c1426', 0, ' opacity="0.3"');
        o += tileCone(c, 50, 15, 72, 17, red, { rows: 3, scallops: 9, kE: 0.2 });
        o += c.ci(50, -1.6, 2.4, M.gold, 2);
        o += c.ol('M16 20V24', M.iron, 1.6) + lantern(c, 16, 24);
        return o;
      }
      if (v === 3) {
        /* 석탑: 돌 쌓기 + 금 띠 + 성가퀴(톱니 담) 사이 궁수 + 화로 + 붉은 깃발 */
        let o = plat(c, 3, { stone: st });
        o += footShade(c, 50, 104, 31, 8.5);
        o += flag(c, 70, 30, 26, '#e0442a', 1, 14);
        o += stoneWall(c, 50, 48, 104, 26, 30, st, { ch: 7, moss: true, seed: 9 });
        o += bandI(c, 50, 66, 69.5, 27.6, 8.3, M.gold);
        o += litWindow(c, 50, 92, 9, 13, '#ffb347', { frame: h.shade(st, -0.2) });
        o += c.r(34, 78, 3.4, 8, '#2c2024', 1, 1.6) + c.r(62.6, 78, 3.4, 8, '#2c2024', 1, 1.6);
        o += parapet(c, 50, 40, 30.5, st, 'back');
        const A = archer(c, 45, 51, 1.38, pose, { head: 'helm', headCol: '#b4bcc8', chest: '#9a5a30', bracer: '#5a3020', cape: '#d8402a', bowTrim: M.gold, recurve: true });
        o += A.pre;
        o += parapet(c, 50, 40, 30.5, st, 'front');
        o += A.post;
        /* 화로(왼쪽 앞 톱니 위) */
        o += c.p('M13 35H27L25 30H15Z', c.vg(M.iron, 0.35, -0.3), 2.2) + c.ol('M20 35V39', M.iron, 1.6) + flame(c, 20, 31, 12, 16) + embers(c, [[26, 12, 1.6], [14, 15, 1.4]]);
        return o;
      }
      if (v === 'A') {
        /* 화염 저격대: 높고 가는 돌 첨탑(미나렛) — 중간 발코니에 긴 활을 든 저격수 */
        const dst = '#a08c84';
        let o = plat(c, 4, { stone: dst, trim: '#e0442a' });
        o += footShade(c, 50, 99, 24, 6.5);
        /* 몸통(아래) */
        o += stoneWall(c, 50, 66, 99, 17, 22, dst, { ch: 6.5, bw: 10, seed: 11, moss: true });
        o += bandI(c, 50, 80, 83, 19.8, 5.9, M.gold);
        o += litWindow(c, 50, 99, 8, 9, '#ffb347', { frame: h.shade(dst, -0.2), bars: false });
        o += c.r(48, 70, 4, 7, '#2c2024', 1.5, 1.6);
        /* 발코니 위로 솟은 가는 첨탑 + 화살 구멍 */
        o += stoneWall(c, 50, 30, 62, 9, 11, dst, { ch: 6, bw: 8, seed: 12 });
        o += c.r(48, 34, 4, 8, '#2c2024', 1.5, 1.6);
        o += bandI(c, 50, 30, 33, 9.6, 2.9, M.gold);
        o += tileCone(c, 50, 31, 26, 27, '#c8462c', { rows: 3, scallops: 6 });
        o += c.ol('M50 4.5V1', M.gold, 1.6) + c.ci(50, 3, 2.2, M.gold, 1.8);
        /* 발코니 바닥 + 돌 까치발 */
        o += c.p('M29 66L35 74H39L36 65Z', c.vg(dst, 0.2, -0.3), 2) + c.p('M71 66L65 74H61L64 65Z', c.vg(dst, 0.2, -0.3), 2);
        o += c.e(50, 60, 23, 6.8, c.vg(h.shade(dst, -0.25), 0, -0.2), 2.4);
        const A = archer(c, 45, 58, 1.2, pose, { tunic: '#f0d49a', headCol: '#c8281a', chest: '#4a2a28', bracer: '#2a1a1a', cape: '#a02418', long: 1.4, bowCol: '#4a2a1a', bowTrim: M.gold, recurve: true, trim: M.gold });
        o += A.pre;
        o += cyl(c, 50, 60, 67, 23, 6.8, c.cg(M.bronze), null);
        o += c.ln('M30 63.4V69M38 65V71.6M50 65.6V72.4M62 65V71.6M70 63.4V69', h.shade(M.bronze, -0.4), 1.5);
        o += c.ln(ring(50, 60, 23, 6.8), h.shade(M.bronze, 0.4), 1.6);
        o += A.post;
        return o;
      }
      /* 'B' 연사 궁수대: 넓은 2층 망루, 궁수 셋(가운데는 대장) */
      const bst = '#b09a8a';
      let o = plat(c, 4, { stone: bst, trim: '#e0442a' });
      o += footShade(c, 50, 99, 38, 9);
      o += stoneRect(c, 12, 72, 76, 28, bst, { ch: 7, bw: 12, seed: 21, fill: c.cg(bst) });
      o += c.p('M12 100Q50 108 88 100V96Q50 104 12 96Z', '#1c1426', 0, ' opacity="0.25"');
      o += c.p('M42 101V90Q50 83 58 90V102Z', c.vg('#5a3a2a', 0.1, -0.3), 2.4) + c.ln('M42 94H58M50 85V102', h.shade('#5a3a2a', -0.4), 1.5);
      o += litWindow(c, 25, 90, 7, 8, '#ffb347', { frame: h.shade(bst, -0.2) }) + litWindow(c, 75, 90, 7, 8, '#ffb347', { frame: h.shade(bst, -0.2) });
      /* 2층 마루 + 뒤 기둥 */
      o += beam(c, 10, 70, 10, 24, 4, h.shade(M.wood, -0.3)) + beam(c, 90, 70, 90, 24, 4, h.shade(M.wood, -0.3)) + beam(c, 8, 48, 92, 48, 3, h.shade(M.wood, -0.3), { light: false });
      const As = [archer(c, 16, 59, 1.02, pose, { chest: '#a8502e' }), archer(c, 44, 58.5, 1.06, pose, { head: 'helm', headCol: '#b4bcc8', chest: '#9a5a30', cape: '#d8402a' }), archer(c, 71, 59, 1.02, pose, { trail: 0.6, chest: '#a8502e' })];
      if (As[1].tip) c.tip = As[1].tip;
      o += As.map((a) => a.pre).join('');
      o += planks(c, 6, 54, 88, 15, M.plank, { n: 2, under: true });
      o += c.ln('M20 55V68M35 55V68M50 55V68M65 55V68M80 55V68', h.shade(M.plank, -0.4), 1.5);
      o += planks(c, 5, 69, 90, 5, h.shade(M.plank, -0.1), { n: 1, nails: false }) + c.r(12, 74, 76, 2.4, '#1c1426', 0, 0, ' opacity="0.35"');
      o += beam(c, 7, 74, 7, 24, 4.6, M.wood) + beam(c, 93, 74, 93, 24, 4.6, M.wood);
      o += As.map((a) => a.post).join('');
      /* 넓은 기와 지붕 + 처마 등불 */
      o += c.p('M4 23Q50 30 96 23V27Q50 34 4 27Z', '#1c1426', 0, ' opacity="0.3"');
      o += c.p('M1 23L17 3H83L99 23Q50 29 1 23Z', c.vg(red, 0.25, -0.25), 3);
      o += c.ln('M8 16Q50 21 92 16M13 9.5Q50 13.5 87 9.5', h.shade(red, -0.4), 1.5, 0.8);
      o += c.ln('M20 22L27 4M35 24L39 3M50 25V3M65 24L61 3M80 22L73 4', h.shade(red, -0.4), 1.5, 0.7);
      o += c.ln('M2 23Q50 29 98 23', OLC, 2.4);
      o += c.ol('M17 3H83', h.shade(red, -0.2), 2.4);
      o += c.ol('M7 24V27M93 24V27', M.iron, 1.4) + lantern(c, 7, 27, 0.95) + lantern(c, 93, 27, 0.95);
      return o;
    },
  };

  /* =========================================================
   * 🔥 화염 박격포 — 포수 한 사람이 포를 다룸
   *  idle: 포신을 낮춰 두고, 포수는 화승대(불씨 막대)를 세워 듦
   *  aim : 포신을 높이 세우고, 포수가 몸을 숙여 화승대를 점화구에 댐(불꽃)
   *  fire: 포구 섬광 + 연기 + 포탄이 날아감, 포신이 뒤로 밀림, 포수는 귀를 막고 몸을 젖힘
   * ========================================================= */
  const GUNNER = {
    idle: { near: { e: [-5.2, -6.8], h: [-4.2, -2.2] }, far: { e: [6.6, -7.8], h: [3.8, -3.2] }, lean: 0 },
    aim: { near: { e: [1.8, -8.4], h: [7.4, -9.6] }, far: { e: [7.4, -9.2], h: [6.4, -16.4] }, lean: 12 },
    fire: { near: { e: [-6.8, -15], h: [-1.4, -19.6], open: true }, far: { e: [7.6, -15.4], h: [5, -21], open: true }, lean: -12 },
  };
  /** 포신 — 약실 공(축) (x,y), 길이 L, 반지름 r, 기울기 ang(0 = 세움, +는 오른쪽으로). 돌려줌 { s, mouth, hole } */
  function mortarGun(c, x, y, L, r, ang, o = {}) {
    const h = c.h;
    const col = o.col || M.iron;
    const t = y - L;
    let b = c.ci(x, y, r * 1.12, c.sg(col), 3);
    b += frus(c, x, t + 4, y, r * 0.86, r, c.cg(col), null);
    (o.bands || [0.45]).forEach((k) => { b += bandI(c, x, y - L * k - 2, y - L * k + 2, r * (0.9 + 0.1 * (1 - k)), r * 0.3, o.trim || h.shade(col, 0.25)); });
    b += c.ln(`M${f(x - r * 0.62)} ${f(y - L * 0.2)}L${f(x - r * 0.55)} ${f(t + 8)}`, '#ffffff', 1.6, 0.35);
    b += c.ci(x - r * 0.45, y - r * 0.72, r * 0.16, '#2a1610', 1.5);
    if (o.dragon) {
      const R = r;
      const D = o.dragon;
      const Pp = (px, py) => `${f(x + px * R)} ${f(t + py * R)}`;
      b += cyl(c, x, t + 1, t + 8, R * 1.15, R * 0.38, c.cg(D), null) + c.e(x, t + 1, R * 1.0, R * 0.33, '#2a1610', 2.2);
      b += c.p(`M${Pp(-0.9, 0.5)}C${Pp(-1.4, 0.3)} ${Pp(-1.9, 0.1)} ${Pp(-2.3, -0.4)}C${Pp(-1.8, -0.1)} ${Pp(-1.4, 0)} ${Pp(-1.0, 0.1)}Z`, c.vg('#f6e7c8', 0.2, -0.3), 2.2);
      b += c.p(`M${Pp(-1.15, 0.9)}C${Pp(-1.35, 0.3)} ${Pp(-1.1, -0.5)} ${Pp(-0.55, -1.0)}L${Pp(0.1, -1.25)}L${Pp(0.0, -0.75)}L${Pp(-0.35, -0.5)}Q${Pp(-0.5, 0)} ${Pp(-0.35, 0.5)}Z`, c.cg(D), 2.6);
      b += c.p(`M${Pp(1.15, 0.9)}C${Pp(1.3, 0.4)} ${Pp(1.1, -0.2)} ${Pp(0.75, -0.6)}L${Pp(0.3, -0.3)}Q${Pp(0.4, 0.1)} ${Pp(0.35, 0.5)}Z`, c.cg(h.shade(D, -0.1)), 2.4);
      b += c.e(x - R * 0.8, t + R * 0.15, R * 0.2, R * 0.14, o.hot ? '#fff3b0' : '#ffe14a', 1.6);
      if (o.hot) b += flame(c, x, t + 2, R * 0.9, R * 1.3);
    } else {
      b += cyl(c, x, t, t + 6, r * 1.12, r * 0.38, c.cg(h.shade(col, 0.1)), null);
      b += c.e(x, t, r * 0.8, r * 0.26, '#2a1610', 2.2);
      if (o.hot) b += c.e(x, t + 0.5, r * 0.55, r * 0.17, '#ff8a2a', 0) + c.e(x, t + 0.4, r * 0.28, r * 0.09, '#fff1a8', 0);
    }
    const s = G(b, `rotate(${f(ang)} ${f(x)} ${f(y)})`);
    return { s, mouth: rotP([x, t - 1], [x, y], ang), hole: rotP([x - r * 0.45, y - r * 0.72], [x, y], ang), dir: ang - 90 };
  }
  /** 모래주머니 */
  function sandbag(c, x, y, k = 1) {
    return c.e(x, y, 9 * k, 5.5 * k, c.vg(M.sand, 0.25, -0.25), 2.4) + c.ln(`M${f(x - 3 * k)} ${f(y - 4 * k)}Q${f(x - 1 * k)} ${f(y)} ${f(x - 3 * k)} ${f(y + 4 * k)}M${f(x + 4 * k)} ${f(y - 3.6 * k)}L${f(x + 6 * k)} ${f(y - 4.6 * k)}`, c.h.shade(M.sand, -0.35), 1.5);
  }
  /** 포탄 더미 */
  const shells = (c, x, y, k = 1, col = '#4a4450') => orb(c, x - 5 * k, y, 4 * k, col, 2) + orb(c, x + 3 * k, y + 0.5 * k, 4 * k, col, 2) + orb(c, x - 1 * k, y - 5.6 * k, 4 * k, col, 2);
  /** 화승대 — 손 (hx,hy)에서 끝 (tx,ty) 쪽으로, 끝에 불씨 */
  function linstock(c, hx, hy, tx, ty, lit = true) {
    const L = Math.hypot(tx - hx, ty - hy);
    const ux = (tx - hx) / L;
    const uy = (ty - hy) / L;
    const bx = hx - ux * 7;
    const by = hy - uy * 7;
    let s = c.ol(`M${f(bx)} ${f(by)}L${f(tx - ux * 2)} ${f(ty - uy * 2)}`, M.wood, 1.8);
    s += c.ol(`M${f(tx - ux * 3 - uy * 2.2)} ${f(ty - uy * 3 + ux * 2.2)}L${f(tx - uy * 1.6)} ${f(ty + ux * 1.6)}`, M.iron, 1.5);
    if (lit) s += aura(c, tx, ty, 5, 5, '#ff9a3d', 0.8) + c.ci(tx, ty, 1.8, '#ffd94a', 1.5);
    return s;
  }
  /** 포수 + 화승대 — 엉덩이 (x,y), 발 높이 gy. tgt: 점화구(aim) */
  function gunner(c, x, y, gy, k, pose, G0, tgt) {
    const A = GUNNER[pose];
    const legs = pose === 'fire' ? { near: [x - 4.4 * k, gy], far: [x + 3.4 * k, gy] } : pose === 'aim' ? { near: [x - 4 * k, gy], far: [x + 5.6 * k, gy] } : { near: [x - 2.6 * k, gy], far: [x + 3.2 * k, gy] };
    const P = man(c, {
      x, y, k, lean: A.lean, far: A.far, near: A.near, legs: G0.legs === false ? null : legs,
      tunic: G0.tunic || '#f8873a', head: G0.head || 'cap', headCol: G0.headCol || '#5a3a24', apron: G0.apron, chest: G0.chest, glove: G0.glove || '#6a4630',
      pants: '#4a3a34', boot: '#3a2a24', beard: G0.beard, shout: pose === 'fire', squint: pose !== 'idle',
    });
    let pole = '';
    if (pose === 'idle') pole = linstock(c, P.nh[0], P.nh[1], P.nh[0] - 0.4, P.nh[1] - 20 * k);
    else if (pose === 'aim') pole = linstock(c, P.nh[0], P.nh[1], tgt[0], tgt[1]);
    const puff = pose === 'idle' ? OP(c.ci(P.nh[0] + 1, P.nh[1] - 24 * k, 2.2, '#d8d0c8', 0) + c.ci(P.nh[0] + 3, P.nh[1] - 28 * k, 2.8, '#d8d0c8', 0), 0.6) : '';
    return { s: P.draw({ near: pole }) + puff, P };
  }
  /** 쏘는 순간 효과: 섬광 + 연기 + 날아가는 포탄 */
  function mortarBlast(c, g, k = 1, shell = true) {
    const [mx, my] = g.mouth;
    const d = g.dir * D2R;
    const ux = Math.cos(d);
    const uy = Math.sin(d);
    let s = smoke(c, mx - 10 * k, my + 4 * k, 9 * k, '#b4aaa2', 0.92) + smoke(c, mx + 10 * k, my + 3 * k, 8.5 * k, '#c4bcb4', 0.92) + smoke(c, mx + ux * 7 * k, my + uy * 7 * k - 3, 7 * k, '#d8d0c8', 0.8);
    s += muzzleFlash(c, mx + ux * 5 * k, my + uy * 5 * k, 10 * k, g.dir);
    if (shell) {
      const sx = mx + ux * 20 * k;
      const sy = my + uy * 20 * k;
      s += c.p(`M${f(sx - ux * 12 * k - uy * 2.4)} ${f(sy - uy * 12 * k + ux * 2.4)}L${f(sx)} ${f(sy)}L${f(sx - ux * 12 * k + uy * 2.4)} ${f(sy - uy * 12 * k - ux * 2.4)}Z`, c.fo(), 0, ' opacity="0.85"');
      s += orb(c, sx, sy, 4.2 * k, '#e0662e', 2);
    }
    return s;
  }

  T.flame_mortar = {
    /* 포구(aim) 위치 — 4A는 투석기 바구니가 놓이는 꼭대기, 4B는 가운데 포신 */
    muzzle: [[77, 56], [77, 48], [79, 43], [64, 18], [57, 26]],
    draw(c, v, pose = 'idle') {
      const h = c.h;
      const st = STONE.fire;
      const ANG = { idle: 60, aim: 24, fire: 28 };
      const ang = ANG[pose];
      const rec = pose === 'fire' ? 2.6 : 0;
      if (v === 1) {
        /* 나무 포상 + 모래주머니 + 포탄 더미, 포수 한 사람 */
        let o = plat(c, 1);
        o += footShade(c, 58, 100, 24, 6);
        o += sandbag(c, 30, 92, 0.9) + sandbag(c, 47, 89, 0.9) + sandbag(c, 80, 92, 0.9);
        o += planks(c, 44, 92, 34, 12, M.plank, { n: 2 });
        const g = mortarGun(c, 61, 88 + rec, 34, 13, ang, { hot: pose !== 'idle' });
        o += g.s;
        /* 포 받침 볼(앞판) + 축 */
        o += c.p('M50 104L53 86Q61 80 69 86L72 104Z', c.vg(M.wood, 0.25, -0.25), 2.6) + c.ln('M55 92H67M54.4 98H67.6', h.shade(M.wood, -0.4), 1.5);
        o += c.ci(61, 88 + rec, 3.2, c.sg(M.ironL), 2) + c.ci(61, 88 + rec, 1.1, OLC, 0);
        const G1 = gunner(c, 28, 88, 106, 1.4, pose, {}, g.hole);
        o += G1.s;
        o += shells(c, 84, 104, 0.9);
        o += sandbag(c, 18, 106, 0.85) + sandbag(c, 70, 110, 0.85);
        if (pose === 'aim') o += spark(c, g.hole[0], g.hole[1] - 1, 5, '#ffd94a', 1.4) + embers(c, [[g.hole[0] + 4, g.hole[1] - 6, 1.6], [g.hole[0] - 3, g.hole[1] - 7, 1.3]]);
        if (pose === 'fire') o += mortarBlast(c, g, 1) + smoke(c, 46, 100, 4.5, '#cfc6be', 0.6) + smoke(c, 76, 101, 4.5, '#cfc6be', 0.6);
        return o;
      }
      if (v === 2 || v === 3) {
        /* 둥근 돌 포대(고리 담) 안의 포, 포수는 담 안 왼쪽에 섬 */
        const L3 = v === 3;
        let o = plat(c, v, { stone: st });
        if (L3) o += flag(c, 18, 84, 32, '#e0442a', -1, 14);
        o += ringWall(c, 50, 86, 104, 38, 5, st, 'back');
        /* 안쪽: 포탄 더미 + 포 + 받침 */
        o += shells(c, 76, 84, 0.85, L3 ? '#5a4040' : '#4a4450');
        const g = mortarGun(c, 58, 86 + rec, L3 ? 40 : 38, L3 ? 14 : 13.5, L3 && pose === 'idle' ? 46 : ang, L3 ? { bands: [0.3, 0.62], trim: M.gold, dragon: '#b8402a', hot: pose !== 'idle' } : { hot: pose !== 'idle' });
        o += g.s;
        o += c.p('M47 98L50 84Q58 78 66 84L69 98Z', c.vg(L3 ? h.shade(M.wood, -0.1) : M.wood, 0.25, -0.25), 2.6) + c.ln('M51 90H65', h.shade(M.wood, -0.4), 1.5);
        o += c.ci(58, 86 + rec, 3.2, c.sg(L3 ? M.gold : M.ironL), 2) + c.ci(58, 86 + rec, 1.1, OLC, 0);
        const G1 = gunner(c, 27, 88, 106, 1.3, pose, L3 ? { head: 'helm', headCol: '#a8b0bc', chest: '#9a5a30', beard: '#7a3a20' } : { head: 'goggles', headCol: '#5a3a24' }, g.hole);
        o += G1.s;
        o += ringWall(c, 50, 86, 104, 38, 5, st, 'front', { seed: L3 ? 37 : 33, moss: !L3 });
        if (L3) o += bandI(c, 50, 92, 95.5, 38, 11.4, M.gold);
        if (pose === 'aim') o += spark(c, g.hole[0], g.hole[1] - 1, 5, '#ffd94a', 1.4) + embers(c, [[g.hole[0] + 4, g.hole[1] - 6, 1.6], [g.hole[0] - 3, g.hole[1] - 7, 1.3]]);
        if (pose === 'fire') o += mortarBlast(c, g, 1.05) + smoke(c, 70, 90, 4.5, '#cfc6be', 0.55);
        return o;
      }
      if (v === 'A') return lavaCatapult(c, pose);
      return tripleMortar(c, pose);
    },
  };

  /* ---------- 4A 용암 투석기: 비틀림 투석기 + 용암 바구니 + 방아쇠 줄을 잡은 일꾼 ----------
   *  idle: 팔을 뒤로 눕혀 걸어 둠, 바구니의 용암이 은은함
   *  aim : 용암이 크게 타오르고, 일꾼이 방아쇠 줄을 잡고 몸을 젖힘(줄 팽팽)
   *  fire: 팔이 앞 받침대까지 튀어 올라 섬, 용암 덩이가 날아감, 일꾼은 줄을 당긴 채 */
  function lavaCatapult(c, pose) {
    const h = c.h;
    const wd = M.wood;
    const wdD = h.shade(M.wood, -0.3);
    let o = plat(c, 4, { stone: '#8a7468', trim: '#e0442a' });
    o += footShade(c, 54, 99, 34, 8);
    /* 차대(양옆 들보) + 뒤 바퀴 */
    o += c.ci(30, 96, 8.5, c.sg(wdD), 2.6) + c.ci(30, 96, 2.6, M.iron, 1.8);
    o += beam(c, 22, 90, 86, 90, 6, wdD);
    /* 앞 받침틀(A자) + 멈춤 들보(가죽 덧댐) */
    o += beam(c, 58, 90, 70, 44, 4.6, wdD) + beam(c, 82, 90, 70, 44, 4.6, wdD);
    /* 팔: 축 (60,84). idle/aim은 뒤로 누움(바구니 왼쪽 아래), fire는 앞으로 섬 */
    const pv = [60, 84];
    const armAng = pose === 'fire' ? -78 : -160;
    const armL = 48;
    const tip = [pv[0] + Math.cos(armAng * D2R) * armL, pv[1] + Math.sin(armAng * D2R) * armL];
    const bend = pose === 'aim' ? 2.5 : 0;
    const mid = [(pv[0] + tip[0]) / 2 + bend * Math.sin(armAng * D2R), (pv[1] + tip[1]) / 2 + bend];
    o += limb(c, [pv, mid, tip], [wd, wd], [5.4, 4.6]);
    o += c.ln(pl([lerp(pv, mid, 0.2), lerp(mid, tip, 0.8)]), h.shade(wd, 0.35), 1.5, 0.6);
    o += lash(c, ...lerp(pv, tip, 0.35), 5, 5);
    /* 바구니 + 용암 */
    const bx = tip[0];
    const by = tip[1];
    const basket = (full, hot) => {
      let s = c.p(`M${f(bx - 9)} ${f(by - 3)}Q${f(bx - 9)} ${f(by + 8)} ${f(bx)} ${f(by + 8.5)}Q${f(bx + 9)} ${f(by + 8)} ${f(bx + 9)} ${f(by - 3)}Z`, c.vg(M.iron, 0.3, -0.3), 2.6);
      s += c.ln(`M${f(bx - 8)} ${f(by + 2)}Q${f(bx)} ${f(by + 5)} ${f(bx + 8)} ${f(by + 2)}`, hot ? '#ffb347' : h.shade(M.iron, -0.4), 1.5);
      if (full) {
        s = aura(c, bx, by - 4, hot ? 20 : 13, hot ? 18 : 11, '#ff7a2a', hot ? 0.8 : 0.55) + s;
        s += c.p(`M${f(bx - 8.5)} ${f(by - 3)}Q${f(bx - 6)} ${f(by - 10)} ${f(bx)} ${f(by - 8)}Q${f(bx + 5)} ${f(by - 12)} ${f(bx + 8.5)} ${f(by - 3)}Z`, c.vg('#ffd94a', 0.2, -0.15), 2.2);
        s += c.e(bx - 1, by - 6, 4, 1.8, '#fff1a8', 0);
        if (hot) s += flame(c, bx - 1, by - 7, 14, 18) + embers(c, [[bx + 9, by - 18, 1.8], [bx - 10, by - 14, 1.6], [bx + 4, by - 24, 1.4]]);
        s += c.p(`M${f(bx + 7)} ${f(by + 1)}Q${f(bx + 10)} ${f(by + 7)} ${f(bx + 8)} ${f(by + 11)}Q${f(bx + 6)} ${f(by + 6)} ${f(bx + 5)} ${f(by + 3)}Z`, '#ff8a2a', 1.6);
      }
      return s;
    };
    o += basket(pose !== 'fire', pose === 'aim');
    /* 축(굵은 쇠 바퀴통 + 비틀린 밧줄 다발) */
    o += c.ci(pv[0], pv[1], 6, c.sg(M.ironL), 2.4) + c.ln(`M${f(pv[0] - 3.6)} ${f(pv[1] - 3)}L${f(pv[0] + 3.6)} ${f(pv[1] + 3)}M${f(pv[0] - 3.6)} ${f(pv[1] + 3)}L${f(pv[0] + 3.6)} ${f(pv[1] - 3)}`, M.rope, 1.6);
    o += c.ol('M70 44L70 40', M.iron, 2) + c.r(62, 38, 16, 6, c.vg('#8a4a2a', 0.3, -0.3), 2, 2.4);
    o += beam(c, 52, 66, 86, 66, 3.2, wd, { light: false });
    /* 앞 바퀴 */
    o += c.ci(78, 98, 9, c.sg(wd), 2.6) + c.ci(78, 98, 3, M.iron, 1.8) + c.ln('M78 89.6V106.4M69.6 98H86.4', h.shade(wd, -0.4), 1.5);
    /* 방아쇠 줄 + 일꾼(왼쪽 아래) */
    const A = pose === 'idle'
      ? { near: { e: [-4.8, -7], h: [-2, -3] }, far: { e: [6.4, -7.6], h: [9.4, -5.4] }, lean: 2 }
      : { near: { e: [2.6, -10.6], h: [8, -11.6] }, far: { e: [6.2, -11.4], h: [11.6, -12.2] }, lean: -14 };
    const k = 1.25;
    const P = man(c, {
      x: 37, y: 90, k, lean: A.lean, far: A.far, near: A.near, legs: pose === 'idle' ? { near: [34, 107], far: [42, 107] } : { near: [31, 107], far: [44, 107] },
      tunic: '#f8873a', head: 'band', headCol: '#4a2a1a', bandCol: '#ffd04a', glove: '#6a4630', pants: '#4a3a34', boot: '#3a2a24', squint: pose !== 'idle', shout: pose === 'fire',
    });
    const rope = pose === 'idle' ? `M${P2(P.fh)}Q${f(P.fh[0] + 10)} ${f(P.fh[1] + 10)} ${f(pv[0] - 6)} ${f(pv[1] + 2)}` : `M${P2(P.nh)}L${P2(P.fh)}L${f(pv[0] - 6)} ${f(pv[1] + 2)}`;
    o += P.draw({ far: c.ol(rope, M.rope, 1.4) });
    if (pose === 'fire') {
      /* 날아가는 용암 덩이 + 흩날리는 불티 + 먼지 */
      o += c.p(`M${f(bx - 2)} ${f(by + 14)}Q${f(bx - 6)} ${f(by + 2)} ${f(bx + 2)} ${f(by - 6)}L${f(bx + 8)} ${f(by - 2)}Q${f(bx + 2)} ${f(by + 4)} ${f(bx + 4)} ${f(by + 14)}Z`, c.fo(), 0, ' opacity="0.8"');
      o += aura(c, bx + 6, by - 9, 16, 14, '#ff7a2a', 0.8) + c.p(`M${f(bx - 2)} ${f(by - 6)}Q${f(bx)} ${f(by - 16)} ${f(bx + 8)} ${f(by - 15)}Q${f(bx + 16)} ${f(by - 12)} ${f(bx + 13)} ${f(by - 4)}Q${f(bx + 8)} ${f(by + 1)} ${f(bx - 2)} ${f(by - 6)}Z`, c.vg('#ffd94a', 0.2, -0.15), 2.4);
      o += c.e(bx + 5, by - 10, 3.6, 2, '#fff1a8', 0) + embers(c, [[bx - 8, by + 4, 1.8], [bx + 16, by + 4, 1.6], [bx - 4, by + 16, 1.5]]);
      o += motion(c, `M${f(bx - 24)} ${f(by + 30)}Q${f(bx - 22)} ${f(by + 8)} ${f(bx - 8)} ${f(by - 4)}M${f(bx - 30)} ${f(by + 40)}Q${f(bx - 30)} ${f(by + 18)} ${f(bx - 18)} ${f(by + 4)}`, '#fff', 1.8, 0.7);
      o += smoke(c, 44, 96, 4.5, '#cfc6be', 0.6) + smoke(c, 88, 94, 4, '#cfc6be', 0.55);
    }
    return o;
  }

  /* ---------- 4B 연발 포대: 포신 셋을 단 쇠 포탑, 포수가 손잡이를 돌려 방향을 맞춤 ----------
   *  idle: 포신 셋을 낮게 펼쳐 둠, 손잡이 아래
   *  aim : 포탑을 돌려 포신을 세움(손잡이 위), 점화구 셋에 불꽃
   *  fire: 섬광 셋 + 연기 + 반동, 포수 귀 막음 */
  function tripleMortar(c, pose) {
    const h = c.h;
    let o = plat(c, 4, { stone: '#9a8478', trim: '#e0442a' });
    o += footShade(c, 56, 99, 30, 8);
    const rec = pose === 'fire' ? 2.4 : 0;
    const base = pose === 'idle' ? 30 : pose === 'aim' ? 6 : 9;
    const iron = '#5c5866';
    /* 포탑 몸통(쇠 드럼, 리벳) */
    o += cyl(c, 58, 72, 99, 26, 7.8, c.cg(iron), null);
    o += c.ln([-60, -30, 0, 30, 60].map((d) => vseam(58, 74, 98, 26, 7.8, d + (pose === 'idle' ? 0 : 15))).join(''), h.shade(iron, -0.45), 1.6);
    o += [-70, -35, 0, 35, 70].map((d) => { const a = (d + (pose === 'idle' ? 0 : 15)) * D2R; return c.ci(58 + 26 * Math.sin(a), 77 + 7.8 * Math.cos(a), 1.2, M.ironL, 0); }).join('');
    o += bandI(c, 58, 86, 90, 26, 7.8, M.gold);
    o += c.e(58, 72, 26, 7.8, c.vg(h.shade(iron, 0.3), 0.2, -0.05), 2.6) + c.e(58, 72, 18, 5.4, '#2c2430', 0);
    /* 포신 셋(뒤 → 앞) */
    const gs = [-24, 24, 0].map((d, i) => mortarGun(c, 57 + d * 0.3, 78 + rec + (i === 2 ? 2 : 0), i === 2 ? 42 : 36, i === 2 ? 10.5 : 9, base + d * 0.75, { bands: [0.35, 0.7], trim: M.gold, hot: pose !== 'idle' }));
    o += gs.map((g) => g.s).join('');
    o += c.p('M34 72A26 7.8 0 0 0 82 72L76 72A18 5.4 0 0 1 40 72Z', c.vg(h.shade(iron, 0.35)), 2.2);
    /* 돌리는 손잡이(톱니바퀴 + 손잡이) */
    const ca = pose === 'idle' ? 120 : pose === 'aim' ? -60 : -20;
    const cx = 30;
    const cy = 82;
    const hx = cx + Math.cos(ca * D2R) * 8;
    const hy = cy + Math.sin(ca * D2R) * 8;
    o += c.ci(cx, cy, 7, c.sg(M.bronze), 2.4) + c.ln([0, 45, 90, 135].map((d) => { const a = (d + ca) * D2R; return `M${f(cx - Math.cos(a) * 5)} ${f(cy - Math.sin(a) * 5)}L${f(cx + Math.cos(a) * 5)} ${f(cy + Math.sin(a) * 5)}`; }).join(''), h.shade(M.bronze, -0.4), 1.5);
    o += c.ol(`M${f(cx)} ${f(cy)}L${f(hx)} ${f(hy)}`, M.iron, 2) + c.ci(hx, hy, 2.2, M.wood, 1.6);
    o += c.ol('M37 82H40', M.iron, 2.2);
    /* 포수(왼쪽): 손잡이를 쥠, fire는 귀를 막음 */
    const k = 1.2;
    const A = pose === 'fire' ? GUNNER.fire : null;
    const hand = rotP([hx, hy], [15, 90], 0);
    const toL = (p) => [(p[0] - 15) / k, (p[1] - 90) / k];
    const leanG = pose === 'aim' ? 8 : 0;
    const Pl = (p) => toL(rotP(p, [15, 90], -leanG));
    const P = man(c, {
      x: 15, y: 90, k, lean: A ? A.lean : leanG,
      far: A ? A.far : { e: Pl([hand[0] - 3, hand[1] + 6]), h: Pl(hand) },
      near: A ? A.near : { e: Pl([hand[0] - 9, hand[1] + 4]), h: Pl([hand[0] - 2, hand[1] + 1]) },
      legs: { near: [11, 106], far: [21, 106] },
      tunic: '#f8873a', head: 'goggles', headCol: '#5a3a24', glove: '#6a4630', pants: '#4a3a34', boot: '#3a2a24', squint: pose !== 'idle', shout: pose === 'fire',
    });
    o += P.draw();
    if (pose === 'aim') o += gs.map((g) => spark(c, g.hole[0], g.hole[1] - 1, 3.6, '#ffd94a', 1.5)).join('');
    if (pose === 'fire') o += gs.map((g, i) => mortarBlast(c, g, i === 2 ? 0.9 : 0.75, true)).join('');
    return o;
  }

  /* =========================================================
   * 🔥 대장간 (지원) — 일하는 모습이 idle → aim → fire 로 반복
   *  idle: 대장장이가 집게로 달군 쇠를 모루에 대고, 망치는 모루에 걸쳐 쉼
   *  aim : 망치를 머리 위 뒤로 높이 듦(몸이 뒤로 감김)
   *  fire: 달군 쇠를 내리침 → 불티가 사방으로 튐, 몸이 앞으로 실림
   * ========================================================= */
  /** 망치 — 손 (hx,hy)에서 머리 (tx,ty)까지 자루, 머리 크기 s */
  function hammerArt(c, hx, hy, tx, ty, s = 1, col = M.iron) {
    const L = Math.hypot(tx - hx, ty - hy);
    const ux = (tx - hx) / L;
    const uy = (ty - hy) / L;
    const ang = Math.atan2(uy, ux) / D2R;
    let o = c.ol(`M${f(hx - ux * 3)} ${f(hy - uy * 3)}L${f(tx)} ${f(ty)}`, M.wood, 2.2);
    const head = c.r(-3.4 * s, -6 * s, 6.8 * s, 12 * s, c.vg(col, 0.4, -0.25), 1.2 * s, 2.4)
      + c.r(-3.4 * s, -6 * s, 6.8 * s, 2.6 * s, c.h.shade(col, 0.3), 0.8, 1.6) + c.ln(`M${f(-1.6 * s)} ${f(-3 * s)}V${f(3 * s)}`, '#fff', 1.5, 0.5);
    o += G(head, `translate(${f(tx)} ${f(ty)}) rotate(${f(ang)})`);
    return o;
  }
  /** 모루(뿔이 오른쪽) + 나무 그루터기 — 윗면 왼쪽 끝 (x,y), 크기 k */
  function anvilArt(c, x, y, k = 1) {
    const h = c.h;
    const P = (a, b) => `${f(x + a * k)} ${f(y + b * k)}`;
    let o = c.p(`M${P(3, 6)}L${P(1, 16)}Q${P(9, 18)} ${P(17, 16)}L${P(15, 6)}Z`, c.cg(M.woodD), 2.4) + c.e(x + 9 * k, y + 6 * k, 7 * k, 2 * k, h.shade(M.wood, 0.1), 1.8);
    o += c.p(`M${P(0, 0)}L${P(16, 0)}Q${P(22, 0)} ${P(26, -1)}Q${P(21, 2.6)} ${P(15, 3)}L${P(13, 4)}L${P(14, 7)}L${P(3, 7)}L${P(4, 4)}L${P(1, 3)}Q${P(-1, 2)} ${P(0, 0)}Z`, c.vg(M.iron, 0.45, -0.25), 2.4);
    o += c.ln(`M${P(1.5, 0.9)}L${P(15, 0.9)}`, '#fff', 1.5, 0.45);
    return o;
  }
  /** 달군 쇠 막대 — (x,y), 길이 L, hot: 더 밝게 */
  const hotBar = (c, x, y, L, hot) => (hot ? aura(c, x + L / 2, y, L * 0.9, 7, '#ff9a3d', 0.75) : '') + c.r(x, y - 1.6, L, 3.2, c.vg(hot ? '#ffe08a' : '#ff9a3d', 0.3, -0.2), 1.2, 1.6);
  /** 집게 — 손 (hx,hy)에서 끝 (tx,ty) */
  function tongs(c, hx, hy, tx, ty) {
    const L = Math.hypot(tx - hx, ty - hy);
    const nx = -(ty - hy) / L;
    const ny = (tx - hx) / L;
    return c.ol(`M${f(hx - nx * 1.2)} ${f(hy - ny * 1.2)}L${f(tx - nx * 0.6)} ${f(ty - ny * 0.6)}M${f(hx + nx * 1.2)} ${f(hy + ny * 1.2)}L${f(tx + nx * 1.6)} ${f(ty + ny * 1.6)}`, M.iron, 1.5);
  }
  /** 불티가 터지는 모양(내리친 곳) */
  function strikeSparks(c, x, y, r = 1) {
    let d = '';
    [-160, -130, -100, -70, -40, -15, -175].forEach((a, i) => {
      const L = (9 + (i % 3) * 4) * r;
      const ca = Math.cos(a * D2R);
      const sa = Math.sin(a * D2R);
      d += `M${f(x + ca * 3 * r)} ${f(y + sa * 3 * r)}L${f(x + ca * L)} ${f(y + sa * L)}`;
    });
    return aura(c, x, y, 16 * r, 13 * r, '#ffb347', 0.8) + c.ln(d, '#ff9a3d', 3.2) + c.ln(d, '#fff3b0', 1.5) + spark(c, x, y - 1, 6 * r, '#fff8d0', 1.4) + embers(c, [[x - 14 * r, y - 12 * r, 1.8], [x + 12 * r, y - 14 * r, 1.6], [x + 3 * r, y - 19 * r, 1.5]]);
  }
  /* 대장장이 자세: 망치 손(가까운 팔)·집게 손(먼 팔) */
  const SMITH = {
    idle: { near: { e: [0.6, -6.2], h: [7, -5.2] }, far: { e: [8.2, -9.6], h: [12.6, -7.6] }, lean: 4 },
    aim: { near: { e: [-7.4, -18.6], h: [-2.6, -26.4] }, far: { e: [8, -10], h: [12.6, -7.6] }, lean: -7 },
    fire: { near: { e: [5.2, -11.6], h: [11, -6.6] }, far: { e: [8.6, -8.6], h: [13.2, -6.4] }, lean: 10 },
  };
  /** 대장장이 + 망치 + 집게 + 모루. hip (x,y), 발 높이 gy, 모루 윗면 왼쪽 (ax,ay) */
  function smith(c, x, y, gy, k, pose, ax, ay, G0 = {}) {
    const A = SMITH[pose];
    const P = man(c, {
      x, y, k, lean: A.lean, near: A.near, far: A.far,
      legs: pose === 'fire' ? { near: [x - 3.4 * k, gy], far: [x + 5 * k, gy] } : { near: [x - 3 * k, gy], far: [x + 3.6 * k, gy] },
      tunic: G0.tunic || '#f6eedc', sleeve: G0.tunic || '#f6eedc', fore: M.skin, glove: G0.glove || '#6a4a30', apron: G0.apron || '#8a4a26',
      head: G0.head || 'bald', headCol: G0.headCol || '#6a3a24', beard: G0.beard || '#6a3a24', bandCol: G0.bandCol, pants: '#4a3a34', boot: '#3a2a24',
      squint: pose !== 'idle', shout: pose === 'fire', belt: '#4a2a1a',
    });
    const ak = G0.ak || 1;
    const work = [ax + 10 * ak, ay - 1.8];
    /* 망치 머리 위치 */
    let head;
    if (pose === 'idle') head = [ax + 3 * ak, ay - 3.5];
    else if (pose === 'aim') head = [P.nh[0] - 9 * k, P.nh[1] - 9.5 * k];
    else head = [work[0] - 1, work[1] - 4.5];
    const ham = hammerArt(c, P.nh[0], P.nh[1], head[0], head[1], k * (G0.hs || 0.9), G0.hamCol);
    const tg = tongs(c, P.fh[0], P.fh[1], work[0] + 5, work[1]);
    const anv = anvilArt(c, ax, ay, ak);
    const bar = hotBar(c, work[0], work[1], 10 * ak, pose === 'fire');
    const fx = pose === 'fire' ? strikeSparks(c, work[0] + 3, work[1] - 2, G0.sp || 1) : '';
    /* 순서: 모루 → 사람(먼 팔·집게) → 쇠 → 망치·가까운 팔 */
    return anv + P.back + P.legs + P.farArm + tg + P.farHand + bar + P.body + (pose === 'aim' ? ham + P.nearArm + P.nearHand : P.nearArm + ham + P.nearHand) + fx;
  }
  /** 박공 집 — 앞벽 x1~x2, 처마 yw, 꼭대기 ya, 바닥 yb, 지붕 깊이 d. o.wall: 'wood'|'stone' */
  function gableHouse(c, x1, x2, yw, ya, yb, o = {}) {
    const h = c.h;
    const cx = (x1 + x2) / 2;
    const d = o.d || 12;
    const roof = o.roof || '#8a5a34';
    const wcol = o.col || M.plank;
    let s = '';
    /* 지붕 경사면(뒤로 보이는 면) + 기와 줄 */
    s += c.p(poly([[x1 - 4, yw + 2], [cx, ya - 2], [cx, ya - 2 - d], [x1 - 4, yw + 2 - d]]), c.vg(h.shade(roof, 0.12), 0.2, -0.1), 3);
    s += c.p(poly([[x2 + 4, yw + 2], [cx, ya - 2], [cx, ya - 2 - d], [x2 + 4, yw + 2 - d]]), c.vg(h.shade(roof, -0.15), 0.1, -0.2), 3);
    let tl = '';
    for (let i = 1; i < 4; i++) {
      const t = i / 4;
      tl += `M${f(x1 - 4 + (cx - x1 + 4) * 0)} ${f(yw + 2 - d * t)}L${f(cx)} ${f(ya - 2 - d * t)}L${f(x2 + 4)} ${f(yw + 2 - d * t)}`;
    }
    for (let i = 1; i < 6; i++) {
      const t = i / 6;
      const lx = x1 - 4 + (cx - x1 + 4) * t;
      const ly = yw + 2 + (ya - yw - 4) * t;
      const rx = x2 + 4 - (x2 + 4 - cx) * t;
      tl += `M${f(lx)} ${f(ly)}L${f(lx)} ${f(ly - d)}M${f(rx)} ${f(ly)}L${f(rx)} ${f(ly - d)}`;
    }
    s += c.ln(tl, h.shade(roof, -0.45), 1.5, 0.7);
    /* 앞벽 */
    const wallD = `M${x1} ${yb}V${yw}L${cx} ${ya}L${x2} ${yw}V${yb}Q${cx} ${yb + 4} ${x1} ${yb}Z`;
    if (o.wall === 'stone') {
      s += c.p(wallD, c.cg(wcol), 3);
      s += stoneRect(c, x1, yw, x2 - x1, yb - yw, wcol, { ch: 7, bw: 10, seed: o.seed || 41, ow: 0, fill: 'none' });
      /* 박공은 회벽 + 나무 틀 */
      s += c.p(`M${x1 + 1.5} ${yw}L${cx} ${ya + 2.5}L${x2 - 1.5} ${yw}Z`, c.vg('#e8dcc4', 0.1, -0.15), 0);
      s += c.ln(`M${x1 + 2} ${yw + 0.5}H${x2 - 2}M${cx} ${ya + 3}V${yw}M${f(cx - (cx - x1) * 0.5)} ${f(yw - (yw - ya) * 0.48)}L${cx} ${yw}L${f(cx + (x2 - cx) * 0.5)} ${f(yw - (yw - ya) * 0.48)}`, M.woodD, 2.2);
    } else {
      s += c.p(wallD, c.vg(wcol, 0.2, -0.2), 3);
      let pd = '';
      let gd = '';
      for (let xx = x1 + 7; xx < x2 - 2; xx += 7) {
        const top = xx < cx ? yw - (yw - ya) * ((xx - x1) / (cx - x1)) : yw - (yw - ya) * ((x2 - xx) / (x2 - cx));
        pd += `M${f(xx)} ${f(top + 2)}V${f(yb - 1)}`;
        gd += `M${f(xx - 3.4)} ${f(yb - 8 - rnd(xx) * 10)}Q${f(xx - 2.2)} ${f(yb - 18)} ${f(xx - 3.6)} ${f(yb - 24 - rnd(xx + 1) * 6)}`;
      }
      s += c.ln(pd, h.shade(wcol, -0.42), 1.5) + c.ln(gd, h.shade(wcol, -0.25), 1.5, 0.6);
      s += c.ol(`M${x1 + 1} ${yw + 1}H${x2 - 1}`, M.woodD, 2.4);
    }
    /* 처마 밑 그늘 + 처마 끝 */
    s += c.p(`M${x1} ${yw + 0.5}L${cx} ${ya + 0.5}L${x2} ${yw + 0.5}V${yw + 4}L${cx} ${ya + 4}L${x1} ${yw + 4}Z`, '#1c1426', 0, ' opacity="0.28"');
    s += c.ol(`M${f(x1 - 5)} ${f(yw + 3)}L${f(cx)} ${f(ya - 3)}L${f(x2 + 5)} ${f(yw + 3)}`, roof, 4.5);
    s += c.p(`M${x1} ${yb - 4}H${x2}V${yb}Q${cx} ${yb + 4} ${x1} ${yb}Z`, '#1c1426', 0, ' opacity="0.25"');
    return s;
  }
  /** 불빛 문(대장간 화덕이 보임) */
  function forgeDoor(c, x, yb, w, ht, hot) {
    let s = c.p(`M${f(x - w / 2)} ${f(yb)}V${f(yb - ht + w / 2)}Q${f(x)} ${f(yb - ht - w * 0.15)} ${f(x + w / 2)} ${f(yb - ht + w / 2)}V${f(yb)}Z`, c.vg(hot ? '#ffd27a' : '#ffb347', 0.3, -0.35), 2.6);
    s += c.p(`M${f(x - w * 0.32)} ${f(yb)}Q${f(x - w * 0.3)} ${f(yb - ht * 0.42)} ${f(x)} ${f(yb - ht * 0.45)}Q${f(x + w * 0.3)} ${f(yb - ht * 0.42)} ${f(x + w * 0.32)} ${f(yb)}Z`, '#2a1610', 0, ' opacity="0.55"');
    s += c.e(x, yb - 3, w * 0.24, 2.4, hot ? '#fff8d0' : '#fff1a8', 0);
    return s;
  }
  /** 굴뚝 — 가운데 x, 위 yt, 아래 yb, 너비 w. 연기·불꽃은 일하는 자세에 따라 */
  function chimney(c, x, yt, yb, w, col, pose, o = {}) {
    let s = stoneRect(c, x - w / 2, yt, w, yb - yt, col, { ch: 5, bw: 6, seed: o.seed || 7, ow: 3 });
    s += c.r(x - w / 2 - 1.6, yt - 1, w + 3.2, 4, c.vg(o.cap || c.h.shade(col, 0.15), 0.3, -0.3), 1, 2.4);
    s += c.p(`M${f(x - w / 2 + 1)} ${f(yt + 3)}H${f(x + w / 2 - 1)}V${f(yt + 7)}H${f(x - w / 2 + 1)}Z`, '#1c1426', 0, ' opacity="0.3"');
    const big = pose === 'fire';
    s += flame(c, x, yt - 0.5, w * (big ? 1 : 0.75), w * (big ? 1.5 : 1));
    s += OP(c.ci(x - 2, yt - w * 1.15, w * 0.28, '#8a8088', 0) + c.ci(x + 3, yt - w * 1.5, w * 0.34, '#8a8088', 0), 0.45);
    if (pose !== 'idle') s += embers(c, [[x + w * 0.7, yt - w * 1.2, 2], [x - w * 0.6, yt - w * 1.5, 1.6], [x + w * 0.2, yt - w * 2, 1.5]]);
    return s;
  }

  T.forge = {
    /* 불씨가 이웃으로 날아가는 점(모루 위 내리치는 곳) */
    muzzle: [[71, 84], [72, 84], [73, 82], [50, 22], [78, 84]],
    draw(c, v, pose = 'idle') {
      const h = c.h;
      const st = STONE.fire;
      if (v === 1) {
        /* 작은 나무 대장간 + 거친 돌 굴뚝, 앞마당에서 대장장이가 모루질 */
        let o = plat(c, 1);
        o += footShade(c, 44, 102, 28, 6);
        o += chimney(c, 30, 40, 80, 11, M.rough, pose, { seed: 3 });
        o += gableHouse(c, 16, 62, 72, 52, 102, { roof: '#8a5a34', col: M.plank, d: 11 });
        o += forgeDoor(c, 39, 102, 14, 20, pose === 'fire');
        o += c.r(50, 76, 8, 8, c.vg('#ffc65a', 0.3, -0.3), 1, 2) + c.ln('M54 76V84M50 80H58', M.woodD, 1.5);
        /* 물통 */
        o += cyl(c, 18, 98, 108, 6, 2, c.cg(M.wood), '#5a8ab0', 2.2) + c.ln(ring(18, 102, 6, 2), M.iron, 1.5);
        o += smith(c, 41, 90.5, 108, 1.4, pose, 64, 92);
        return o;
      }
      if (v === 2 || v === 3) {
        /* 돌 대장간 + 붉은 기와, Lv3는 금속 모서리·망치 간판·깃발 */
        const L3 = v === 3;
        let o = plat(c, v, { stone: st });
        o += footShade(c, 46, 102, 30, 7);
        if (L3) o += flag(c, 14, 98, 36, '#e0442a', -1, 12);
        o += chimney(c, 64, L3 ? 21 : 25, 70, 13, h.shade(st, -0.1), pose, { seed: 5, cap: L3 ? M.gold : null });
        o += gableHouse(c, 18, 70, 68, 44, 102, { wall: 'stone', col: st, roof: '#c8462c', d: 13, seed: L3 ? 45 : 43 });
        o += forgeDoor(c, 36, 102, 15, 22, pose === 'fire');
        o += litWindow(c, 58, 84, 8, 9, '#ffc65a', { frame: h.shade(st, -0.25) });
        if (L3) {
          o += c.r(16, 66, 4.4, 38, c.vg(M.gold, 0.35, -0.25), 1, 2.2) + c.r(67.6, 66, 4.4, 38, c.vg(M.gold, 0.35, -0.25), 1, 2.2);
          o += c.ol('M44 44V50', M.iron, 1.6) + c.ci(44, 56, 6.5, c.vg(M.wood, 0.3, -0.2), 2.4) + c.p('M40.6 52.6H47.4V56H45.2V60.4H42.8V56H40.6Z', M.iron, 1.4);
        }
        o += smith(c, 43, 91, 108, 1.32, pose, 66, 91, L3 ? { head: 'band', headCol: '#6a3a24', bandCol: '#c23a22', apron: '#5a3420', glove: '#4a2a1a', hs: 1.05, hamCol: '#7a8290' } : { head: 'band', headCol: '#6a3a24', bandCol: '#c23a22' });
        if (L3) o += c.r(64, 101, 4, 4, M.gold, 0.5, 1.4);
        return o;
      }
      if (v === 'A') return blastFurnace(c, pose);
      return armory(c, pose);
    },
  };

  /* ---------- 4A 용광로: 병 모양 큰 화로 + 풀무를 밟아 바람을 넣는 일꾼 ----------
   *  idle: 풀무 손잡이 중간, 화로 불빛 은은
   *  aim : 손잡이를 높이 들어 올림(풀무가 부풂)
   *  fire: 손잡이를 내리눌러 풀무가 납작 → 화로 꼭대기·문에서 불길이 치솟음 */
  function blastFurnace(c, pose) {
    const h = c.h;
    const fs = '#8a6a5e';
    let o = plat(c, 4, { stone: '#7a6660', trim: '#e0442a' });
    o += footShade(c, 54, 99, 34, 8);
    const roar = pose === 'fire';
    o += aura(c, 56, 16, roar ? 30 : 22, roar ? 22 : 14, '#ff7a2a', roar ? 0.8 : 0.55);
    /* 굴뚝 + 불길 */
    o += stoneRect(c, 48, 22, 16, 18, h.shade(fs, -0.1), { ch: 5, bw: 7, seed: 61 }) + c.r(45, 20, 22, 5, c.vg(M.ironL, 0.3, -0.3), 1, 2.4);
    o += flame(c, 56, 21, roar ? 22 : 15, roar ? 20 : 12);
    if (roar) o += embers(c, [[42, 6, 2], [70, 8, 1.8], [62, 3, 1.6], [34, 14, 1.5]]);
    /* 병 모양 화로(돌 쌓기 + 쇠 띠) */
    o += c.p('M56 36C72 36 76 48 84 62C92 76 92 90 88 99Q56 108 24 99C20 90 20 76 28 62C36 48 40 36 56 36Z', c.cg(fs), 3);
    let mortar = '';
    [44, 52, 68, 84, 92].forEach((y, i) => { const w = y < 60 ? 14 + (y - 44) * 0.9 : 30 - Math.abs(y - 76) * 0.18; mortar += `M${f(56 - w)} ${f(y)}Q56 ${f(y + 4)} ${f(56 + w)} ${f(y)}`; for (let j = -2; j <= 2; j++) { const xx = 56 + (j + (i % 2 ? 0.5 : 0)) * w * 0.42; if (Math.abs(xx - 56) < w - 2) mortar += `M${f(xx)} ${f(y + 1.5)}V${f(y + 8)}`; } });
    o += c.ln(mortar, h.shade(fs, -0.42), 1.5, 0.85);
    o += c.ln('M33 55Q56 62 79 55M25 76Q56 85 87 76', OLC, 4.6) + c.ln('M33 55Q56 62 79 55M25 76Q56 85 87 76', M.ironL, 2.2);
    o += [36, 46, 56, 66, 76].map((x) => c.ci(x, x < 56 ? 81 - (56 - x) * 0.12 : 81 - (x - 56) * 0.12, 1, M.silver, 0)).join('');
    /* 아궁이 문 */
    o += c.p('M42 104V93Q56 78 70 93V105Z', c.vg(roar ? '#fff0a0' : '#ffd25a', 0.4, -0.3), 3);
    o += c.e(56, 99, 9, 3.5, '#fff1a8', 0);
    if (roar) o += flame(c, 56, 100, 16, 14) + aura(c, 56, 96, 22, 12, '#ff9a3d', 0.7);
    o += c.ci(37, 66, 3.6, c.sg('#ff8a2a'), 2) + c.ci(75, 66, 3.6, c.sg('#ff8a2a'), 2);
    /* 풀무(앞 왼쪽 바닥) — 오른쪽 끝 주둥이가 화로로 들어감, 왼쪽 위판이 손잡이로 열고 닫힘 */
    const open = pose === 'aim' ? 1 : pose === 'idle' ? 0.5 : 0.08;
    const by = 104;
    const lx = 22;
    const rx = 44;
    const top = by - 3 - open * 15;
    const hEnd = [lx - 6, top - 6 - open * 6];
    /* 일꾼: 풀무 뒤 왼쪽에서 손잡이를 잡음 */
    const k = 1.18;
    const hip = [12, 88.5];
    const lean = pose === 'aim' ? -6 : pose === 'fire' ? 18 : 6;
    const toL = (p) => { const q = rotP(p, hip, -lean); return [(q[0] - hip[0]) / k, (q[1] - hip[1]) / k]; };
    const P = man(c, {
      x: hip[0], y: hip[1], k, lean, legs: { near: [8, 104], far: [16.5, 104] },
      near: { e: toL([hEnd[0] - 7, hEnd[1] + (pose === 'aim' ? 5 : -2)]), h: toL([hEnd[0] - 1.5, hEnd[1] + 0.8]) },
      far: { e: toL([hEnd[0] + 1, hEnd[1] + (pose === 'aim' ? 8 : 3)]), h: toL([hEnd[0] + 1.6, hEnd[1] - 0.4]) },
      tunic: '#f6eedc', fore: M.skin, glove: '#6a4a30', apron: '#8a4a26', head: 'goggles', headCol: '#5a3a24', beard: '#6a3a24', pants: '#4a3a34', boot: '#3a2a24', squint: pose !== 'idle', shout: roar,
    });
    o += P.draw();
    o += c.ol(`M${rx} ${by - 3}L52 ${by - 6}`, M.iron, 2.6);
    o += c.p(`M${lx} ${by}L${rx} ${by - 2}L${rx} ${by - 5}L${lx} ${f(top)}Z`, c.vg('#8a5a34', 0.25, -0.25), 2.4);
    o += c.ln(`M${f(lx + 6)} ${f(by - 0.5 - (by - top) * 0.72)}L${rx - 3} ${by - 4}M${f(lx + 11)} ${f(by - 0.6 - (by - top) * 0.5)}L${rx - 2} ${by - 3.6}`, h.shade('#8a5a34', -0.4), 1.5);
    o += c.ol(`M${lx} ${f(top)}L${rx} ${by - 5}`, M.woodD, 2);
    o += c.r(lx - 2, by - 1, rx - lx + 4, 3, c.vg(M.woodD, 0.2, -0.2), 1, 2);
    o += c.ol(`M${lx} ${f(top)}L${f(hEnd[0])} ${f(hEnd[1])}`, M.wood, 2);
    o += P.nearArm + P.nearHand;
    const bx = rx;
    if (roar) o += motion(c, `M${bx + 2} ${by - 10}Q${bx + 8} ${by - 12} ${bx + 12} ${by - 16}M${bx - 2} ${by - 13}Q${bx + 4} ${by - 17} ${bx + 7} ${by - 22}`, '#fff', 1.6, 0.75);
    return o;
  }

  /* ---------- 4B 무기고: 무기 걸이 + 숫돌 바퀴에 칼을 가는 무기장 ----------
   *  idle: 칼을 세워 날을 살핌(반짝임)
   *  aim : 칼을 숫돌 위로 들어 올리고 발판을 밟을 준비(바퀴가 돌기 시작)
   *  fire: 칼날을 돌아가는 숫돌에 댐 → 불티가 부채꼴로 쏟아짐 + 날 끝 반짝(치명타) */
  function armory(c, pose) {
    const h = c.h;
    const ast = '#a89488';
    let o = plat(c, 4, { stone: '#8c7a70', trim: '#e0442a' });
    o += footShade(c, 50, 99, 36, 8);
    /* 창 걸이(뒤) */
    o += c.ol('M10 98V30M18 100V38M84 100V38M92 98V30', M.woodD, 2.2);
    o += [[10, 30], [18, 38], [84, 38], [92, 30]].map(([x, y]) => c.p(`M${x} ${y - 9}L${x + 3.5} ${y}H${x - 3.5}Z`, c.vg(M.silver, 0.3, -0.2), 2)).join('');
    o += beam(c, 6, 60, 22, 60, 2.6, M.wood, { light: false }) + beam(c, 80, 60, 96, 60, 2.6, M.wood, { light: false });
    /* 굴뚝 + 본관(돌 쌓기, 성가퀴) */
    o += chimney(c, 70, 20, 48, 10, h.shade(ast, -0.15), pose === 'idle' ? 'idle' : 'aim', { seed: 9 });
    o += stoneRect(c, 22, 48, 56, 52, ast, { ch: 7, bw: 11, seed: 71 });
    o += c.p('M20 50V38H29V43H38V38H47V43H56V38H65V43H74V38H80V50Z', c.cg(h.shade(ast, 0.08)), 2.8);
    o += c.r(20, 48, 60, 4, c.vg(M.gold, 0.35, -0.25), 1, 2.2) + c.r(22, 52, 56, 3, '#1c1426', 0, 0, ' opacity="0.28"');
    o += c.p('M22 100Q50 106 78 100V96Q50 102 22 96Z', '#1c1426', 0, ' opacity="0.25"');
    /* 문(쇠 띠) + 방패와 엇갈린 칼 */
    o += c.p('M28 101V86Q36 78 44 86V101Z', c.vg('#5a3a2a', 0.1, -0.3), 2.6) + c.ln('M28 90H44M28 95H44', M.ironL, 1.6) + c.ci(41, 93, 1.2, M.gold, 0);
    o += c.ol('M48 56L72 76M72 56L48 76', M.silver, 2.4);
    o += c.p('M60 54C64 56 67 56 69 55V64C69 70 65 74 60 76C55 74 51 70 51 64V55C53 56 56 56 60 54Z', c.vg('#d8462c', 0.3, -0.25), 2.4) + c.ln('M60 58V72M55 63H65', M.gold, 1.8);
    /* 숫돌(앞 오른쪽): 돌 바퀴 + 나무 틀 + 물받이 */
    const wx = 70;
    const wy = 90;
    const spin = pose === 'idle' ? 0 : pose === 'aim' ? 25 : 55;
    o += beam(c, wx - 9, 106, wx - 3, 88, 3, M.wood) + beam(c, wx + 9, 106, wx + 3, 88, 3, M.wood);
    o += c.ci(wx, wy, 10, c.sg('#b8b0a4'), 2.6);
    o += c.ln([0, 60, 120].map((d) => { const a = (d + spin) * D2R; return `M${f(wx + Math.cos(a) * 3)} ${f(wy + Math.sin(a) * 3)}L${f(wx + Math.cos(a) * 8.5)} ${f(wy + Math.sin(a) * 8.5)}`; }).join(''), '#8a8278', 1.5);
    o += c.ci(wx, wy, 2.6, c.sg(M.iron), 1.8);
    if (pose !== 'idle') o += motion(c, `M${wx - 12} ${wy - 6}A13 13 0 0 1 ${wx - 4} ${wy - 12.6}M${wx + 12} ${wy + 6}A13 13 0 0 1 ${wx + 4} ${wy + 12.6}`, '#fff', 1.8, 0.8);
    o += c.p(`M${wx - 8} ${wy + 9}H${wx + 8}L${wx + 6} ${wy + 14}H${wx - 6}Z`, c.vg(M.wood, 0.2, -0.2), 2) + c.e(wx, wy + 9.4, 7, 1.4, '#5a8ab0', 0);
    /* 무기장 */
    const k = 1.2;
    const hip = [47, 90];
    const lean = pose === 'fire' ? 10 : pose === 'aim' ? -3 : 0;
    const toL = (p) => { const q = rotP(p, hip, -lean); return [(q[0] - hip[0]) / k, (q[1] - hip[1]) / k]; };
    let grip;
    let tip;
    if (pose === 'idle') { grip = [56, 82]; tip = [57, 56]; }
    else if (pose === 'aim') { grip = [56, 70]; tip = [76, 66]; }
    else { grip = [58, 84]; tip = [wx + 3, wy - 10.5]; }
    const P = man(c, {
      x: hip[0], y: hip[1], k, lean, legs: pose === 'fire' ? { near: [44, 107], far: [54, 107] } : { near: [45, 107], far: [52, 107] },
      near: { e: toL([grip[0] - 8, grip[1] + (pose === 'aim' ? 3 : -1)]), h: toL([grip[0] - 2.5, grip[1] + 1]) },
      far: { e: toL([grip[0] + 1, grip[1] + 7]), h: toL([grip[0] + 1, grip[1]]) },
      tunic: '#d8442c', sleeve: '#d8442c', fore: '#d8442c', glove: '#3a2a24', chest: '#c4ccd8', head: 'helm', headCol: '#b4bcc8', plume: '#ffd04a', beard: '#4a2a1a',
      pants: '#3a2a34', boot: '#2a1a24', squint: pose !== 'idle',
    });
    /* 칼: 손잡이(쥔 곳 아래로) + 날 */
    const L = Math.hypot(tip[0] - grip[0], tip[1] - grip[1]);
    const ux = (tip[0] - grip[0]) / L;
    const uy = (tip[1] - grip[1]) / L;
    const sword = c.ol(`M${f(grip[0] - ux * 4)} ${f(grip[1] - uy * 4)}L${f(grip[0] + ux * 2)} ${f(grip[1] + uy * 2)}`, '#5a3020', 2) +
      c.ol(`M${f(grip[0] + ux * 2 - uy * 4)} ${f(grip[1] + uy * 2 + ux * 4)}L${f(grip[0] + ux * 2 + uy * 4)} ${f(grip[1] + uy * 2 - ux * 4)}`, M.gold, 1.6) +
      c.p(`M${f(grip[0] + ux * 3 - uy * 1.8)} ${f(grip[1] + uy * 3 + ux * 1.8)}L${f(tip[0])} ${f(tip[1])}L${f(grip[0] + ux * 3 + uy * 1.8)} ${f(grip[1] + uy * 3 - ux * 1.8)}Z`, c.vg(M.silver, 0.45, -0.15), 2) +
      c.ln(`M${f(grip[0] + ux * 5)} ${f(grip[1] + uy * 5)}L${f(tip[0] - ux * 4)} ${f(tip[1] - uy * 4)}`, '#fff', 1.5, 0.7);
    o += P.draw({ near: sword });
    if (pose === 'idle') o += spark(c, tip[0] + 1, tip[1] + 6, 4.5, '#fff', 1.4);
    if (pose === 'fire') {
      let d = '';
      [-10, 5, 20, 35, 50].forEach((a, i) => { const L2 = 12 + (i % 2) * 6; d += `M${f(tip[0] + 1)} ${f(tip[1] + 1)}L${f(tip[0] + 1 + Math.cos(a * D2R) * L2)} ${f(tip[1] + 1 + Math.sin(a * D2R) * L2)}`; });
      o += aura(c, tip[0] + 6, tip[1] + 4, 14, 11, '#ffb347', 0.75) + c.ln(d, '#ff9a3d', 3) + c.ln(d, '#fff3b0', 1.5);
      o += spark(c, tip[0] - 9, tip[1] - 3, 5, '#fff8d0', 1.4) + spark(c, 52, 44, 4, M.gold, 1.5);
    }
    return o;
  }

  /* =========================================================
   * ❄ 서리 결정탑 — 돌 받침 위에 떠 있는 결정(조작하는 사람 없음: 결정이 스스로 쏨)
   *  idle: 결정이 은은하게 떠 있고 작은 결정들이 제자리에서 돎
   *  aim : 결정이 떠오르며 밝아지고, 빛줄기와 서리 알갱이가 안으로 모임, 작은 결정이 가까이 당겨짐
   *  fire: 결정 끝에서 섬광, 얼음 화살이 오른쪽 위로 날아가고 작은 결정은 밖으로 튕김, 결정은 살짝 가라앉음
   * ========================================================= */
  /** 모이는 빛줄기 — 가운데 (x,y), 안쪽 r1 ~ 바깥 r2 */
  function gather(c, x, y, r1, r2, col, n = 8, rot = 10) {
    let d = '';
    for (let i = 0; i < n; i++) {
      const a = (rot + (i * 360) / n) * D2R;
      d += `M${f(x + Math.cos(a) * r2)} ${f(y + Math.sin(a) * r2 * 0.9)}L${f(x + Math.cos(a) * r1)} ${f(y + Math.sin(a) * r1 * 0.9)}`;
    }
    return c.ln(d, col, 2.6, 0.55) + c.ln(d, '#ffffff', 1.5, 0.9);
  }
  /** 서리 알갱이(작은 눈송이 점) */
  const frostMotes = (c, list, col = '#ffffff') => list.map(([x, y, r]) => spark(c, x, y, r || 2.2, col, 0)).join('');
  /** 퍼지는 고리(앞쪽 타원) */
  const burstRing = (c, x, y, rx, ry, col, w = 2.4, a = 0.8) => c.e(x, y, rx, ry, 'none', 0, ` stroke="${col}" stroke-width="${c.sw(w)}" opacity="${a}"`);
  /** 날아가는 얼음 화살 — 시작 (x,y), 방향 ang(도), 길이 L */
  function iceBolt(c, x, y, ang, L, col, k = 1) {
    const s = c.p(`M${f(x - L)} ${f(y - 1.6 * k)}L${f(x)} ${f(y - 0.6 * k)}L${f(x)} ${f(y + 0.6 * k)}L${f(x - L)} ${f(y + 1.6 * k)}Z`, '#ffffff', 0, ' opacity="0.55"')
      + c.p(`M${f(x + 7 * k)} ${f(y)}L${f(x)} ${f(y - 3.2 * k)}L${f(x - 3 * k)} ${f(y)}L${f(x)} ${f(y + 3.2 * k)}Z`, c.vg(col, 0.5, -0.1), 1.8)
      + motion(c, `M${f(x - L * 0.8)} ${f(y - 5 * k)}H${f(x - L * 0.2)}M${f(x - L * 0.9)} ${f(y + 5 * k)}H${f(x - L * 0.35)}`, '#ffffff', 1.5, 0.7);
    return G(s, `rotate(${f(ang)} ${f(x)} ${f(y)})`);
  }
  /** 떠 있는 결정 + 작은 결정들 + 자세별 효과. 돌려줌 { s, tip } */
  function frostCore(c, x, y, w, ht, pose, n = 0, orbitR = 18, boltAng = -32, gr = 1.55) {
    const E = c.E;
    const dy = pose === 'aim' ? -3.5 : pose === 'fire' ? 1.5 : 0;
    const cy = y + dy;
    const tip = [x, cy - ht / 2];
    let s = '';
    s += aura(c, x, cy, w * (pose === 'idle' ? 1.1 : 1.5), ht * (pose === 'idle' ? 0.75 : 0.95), pose === 'idle' ? E.color : E.light, pose === 'idle' ? 0.5 : 0.85);
    if (pose === 'aim') s += gather(c, x, cy - ht * 0.1, w * 0.85, w * gr, E.light, 8, 22);
    /* 작은 결정: idle 제자리 · aim 안으로 · fire 밖으로 */
    const orb2 = [];
    for (let i = 0; i < n; i++) {
      const a = (-150 + (i * 300) / Math.max(1, n - 1)) * D2R;
      const rr = orbitR * (pose === 'aim' ? 0.72 : pose === 'fire' ? 1.3 : 1);
      orb2.push([x + Math.cos(a) * rr, cy + 4 + Math.sin(a) * rr * 0.45, i]);
    }
    const back = orb2.filter((p) => p[1] < cy + 4);
    const front = orb2.filter((p) => p[1] >= cy + 4);
    const mini = (p) => crystal(c, p[0], p[1], 7, 12, p[2] % 2 ? E.light : E.color, 2) + (pose === 'fire' ? motion(c, `M${f(p[0] - (p[0] - x) * 0.25)} ${f(p[1] - (p[1] - cy) * 0.25)}L${f(p[0] - (p[0] - x) * 0.55)} ${f(p[1] - (p[1] - cy) * 0.55)}`, '#ffffff', 1.5, 0.7) : '');
    s += back.map(mini).join('');
    s += crystal(c, x, cy, w, ht, pose === 'idle' ? E.color : h2(c, E.color, E.light), 3);
    s += c.ln(`M${f(x - w * 0.12)} ${f(cy - ht * 0.32)}L${f(x - w * 0.22)} ${f(cy + ht * 0.2)}`, '#ffffff', 1.8, 0.85);
    if (pose === 'aim') s += c.e(x, cy - ht * 0.05, w * 0.22, ht * 0.26, '#ffffff', 0, ' opacity="0.75"') + frostMotes(c, [[x - w * 1.1, cy + 2, 2.4], [x + w * 1.15, cy - 6, 2.2], [x - w * 0.7, cy - ht * 0.75, 2]]);
    if (pose === 'fire') {
      s += aura(c, tip[0], tip[1], w * 1.2, w * 1.1, '#ffffff', 0.9) + spark(c, tip[0], tip[1], w * 0.75, '#ffffff', 1.6) + spark(c, tip[0], tip[1], w * 0.32, E.light, 0);
      s += iceBolt(c, tip[0] + w * 1.6 * Math.cos(boltAng * D2R) + 3, tip[1] + w * 1.7 * Math.sin(boltAng * D2R), boltAng, w * 1.6, E.color);
    }
    s += front.map(mini).join('');
    return { s, tip };
  }
  /** 두 색 가운데 */
  const h2 = (c, a, b) => c.h.mix(a, b, 0.45);
  /** 발톱 받침 — 가운데 50, 바닥 y, 벌어짐 sp, 높이 ht */
  const clawPair = (c, y, sp, ht, col, glow) => c.ol(`M${50 - sp} ${y}Q${50 - sp - 6} ${y - ht * 0.5} ${50 - sp + 2} ${y - ht}M${50 + sp} ${y}Q${50 + sp + 6} ${y - ht * 0.5} ${50 + sp - 2} ${y - ht}`, col, 3.4) + (glow ? c.ci(50 - sp + 2, y - ht, 1.8, '#ffffff', 0) + c.ci(50 + sp - 2, y - ht, 1.8, '#ffffff', 0) : '');
  /** 받침 위 눈 덮개 */
  const snowCap = (c, x, y, rx, ry) => c.p(`M${f(x - rx)} ${f(y)}Q${f(x - rx * 0.6)} ${f(y - ry * 1.3)} ${f(x)} ${f(y - ry)}Q${f(x + rx * 0.6)} ${f(y - ry * 1.3)} ${f(x + rx)} ${f(y)}Q${f(x + rx * 0.6)} ${f(y + ry * 0.9)} ${f(x + rx * 0.2)} ${f(y + ry * 0.5)}Q${f(x - rx * 0.3)} ${f(y + ry * 1.1)} ${f(x - rx)} ${f(y)}Z`, c.vg('#ffffff', 0, -0.12), 2);

  T.frost_crystal = {
    muzzle: [[50, 28], [50, 17], [50, 13], [50, 10], [79, 23]],
    draw(c, v, pose = 'idle') {
      const h = c.h;
      const E = c.E;
      const st = STONE.frost;
      if (v === 1) {
        /* 거친 돌을 쌓은 받침 + 떠 있는 결정 */
        let o = plat(c, 1);
        o += footShade(c, 50, 104, 20, 5);
        o += stoneWall(c, 50, 76, 104, 12, 17, M.rough, { ch: 7, bw: 9, seed: 81, moss: true });
        o += c.e(50, 76, 13.5, 4.2, c.vg(h.shade(M.rough, 0.25), 0.2, -0.1), 2.6);
        o += snowCap(c, 46, 75.5, 8, 2.6);
        o += c.e(50, 74, 9, 2.4, h.shade(E.color, 0.4), 0, ' opacity="0.7"');
        const C = frostCore(c, 50, 50, 22, 38, pose);
        o += C.s;
        if (pose === 'fire') o += burstRing(c, 50, 74, 18, 5, E.light, 2.2, 0.7);
        return o;
      }
      if (v === 2 || v === 3) {
        /* 다듬은 돌기둥 + 발톱 받침(Lv3 은) + 둘레를 도는 작은 결정 */
        const L3 = v === 3;
        let o = plat(c, v, { stone: st, trim: M.silver });
        o += footShade(c, 50, 104, 22, 6);
        if (L3) o += burstRing(c, 50, 44, 36, 10, E.light, 2, pose === 'aim' ? 0.95 : 0.6);
        o += stoneWall(c, 50, 72, 104, 12, 18, st, { ch: 6.4, bw: 8, seed: L3 ? 85 : 83, moss: !L3 });
        if (L3) o += bandI(c, 50, 88, 92, 16, 4.8, M.silver);
        o += cyl(c, 50, 66, 73, 16, 4.8, c.cg(L3 ? M.silver : h.shade(st, 0.1)), c.vg(h.shade(st, 0.25)));
        o += c.ln([-50, -20, 10, 40].map((d) => vseam(50, 67.5, 72, 16, 4.8, d)).join(''), h.shade(L3 ? M.silver : st, -0.4), 1.5);
        o += snowCap(c, 44, 66, 9, 2.4);
        o += clawPair(c, 68, 12, 18, L3 ? M.silver : h.shade(st, 0.05), pose === 'aim');
        const C = frostCore(c, 50, L3 ? 39 : 40, L3 ? 26 : 23, L3 ? 46 : 40, pose, L3 ? 3 : 1, L3 ? 26 : 24);
        o += C.s;
        if (pose === 'fire') o += burstRing(c, 50, 66, 22, 6, E.light, 2.2, 0.7);
        return o;
      }
      if (v === 'A') {
        /* 빙결 첨탑: 얼음에 덮인 돌 오벨리스크 + 둘레의 얼음 가시. 끝이 결정 */
        let o = plat(c, 4, { stone: '#8ea2b6' });
        o += footShade(c, 50, 99, 24, 6);
        const glow = pose !== 'idle';
        o += aura(c, 50, 30, 30, 36, E.color, glow ? 0.65 : 0.4);
        if (pose === 'aim') o += c.e(50, 99, 36, 10, 'none', 0, ` stroke="${E.light}" stroke-width="${c.sw(2.6)}" opacity="0.9"`) + frostMotes(c, [[18, 92, 2.4], [82, 90, 2.4], [30, 80, 2], [72, 76, 2]]);
        o += shard(c, 27, 46, 99, 17, E.light) + shard(c, 74, 38, 99, 19, E.light);
        /* 돌 오벨리스크(얼음이 덮음) */
        o += c.p('M40 99L44 41L50 31L56 41L60 99Q50 102 40 99Z', c.cg('#8a9cb0'), 3);
        o += c.ln('M41 84H59M42 70H58M42.8 56H57.2M43.6 42H56.4M46 91V99M54 77V84M47 63V70M53 49V56', h.shade('#8a9cb0', -0.4), 1.5, 0.85);
        /* 서리 룬(빛나면 밝게) */
        o += c.ln('M50 48V60M46 52L54 56M54 52L46 56M50 74V82M47 76L53 80', glow ? '#ffffff' : E.dark, glow ? 2 : 1.6, glow ? 0.95 : 0.7);
        if (glow) o += c.ln('M50 48V60M46 52L54 56M54 52L46 56M50 74V82M47 76L53 80', E.light, 4, 0.4);
        o += c.p('M44 42L50 31L56 42Q53 47 50 44Q47 48 44 42Z', c.vg('#f2fbff', 0.1, -0.15), 2.2);
        o += shard(c, 36, 70, 102, 12, E.color) + shard(c, 64, 64, 102, 13, E.color);
        o += c.p('M22 100Q30 93 40 99Q50 95 60 99Q70 93 78 100Q50 108 22 100Z', c.vg('#ffffff', 0, -0.15), 2.4);
        /* 꼭대기 결정 */
        const C = frostCore(c, 50, 23, 14, 20, pose, 0, 18, -6, 1.3);
        o += C.s;
        if (pose === 'fire') o += burstRing(c, 50, 99, 40, 11, '#ffffff', 2.6, 0.85) + frostMotes(c, [[16, 86, 3], [84, 84, 3], [12, 100, 2.4], [88, 102, 2.4]]);
        return o;
      }
      /* 'B' 얼음 송곳탑: 돌 받침 + 은 장전틀(고드름 다발) + 뒤의 동력 결정 */
      let o = plat(c, 4, { stone: '#9aaec2', trim: M.silver });
      o += footShade(c, 50, 99, 30, 8);
      const ang = pose === 'idle' ? 46 : pose === 'aim' ? 28 : 32;
      const rec = pose === 'fire' ? 2.4 : 0;
      /* 뒤 결정(동력) */
      o += crystal(c, 30, 52, 14, 24, pose === 'idle' ? E.color : E.light, 2.4) + aura(c, 30, 52, 14, 18, E.light, pose === 'idle' ? 0.35 : 0.8);
      o += c.ol('M30 64Q34 74 44 76', M.silver, 2);
      if (pose !== 'idle') o += c.ln('M30 64Q34 74 44 76', '#ffffff', 1.5, 0.9);
      /* 받침(돌 쌓기 + 은 띠) */
      o += stoneWall(c, 50, 76, 99, 27, 29, STONE.frost, { ch: 6, bw: 11, seed: 91 });
      o += c.e(50, 76, 27, 8.1, c.vg(h.shade(STONE.frost, 0.25), 0.2, -0.05), 2.6);
      o += bandI(c, 50, 86, 90, 27.6, 8.3, M.silver);
      o += snowCap(c, 40, 76, 10, 2.6);
      /* 장전틀(축 52,74에서 기울임): 은 틀 + 고드름 셋(가운데 큰 것은 fire에서 날아감) */
      const px = 52;
      const py = 74 + rec;
      let g = '';
      g += c.ol(`M${px - 12} ${py}L${px - 12} ${py - 34}M${px + 12} ${py}L${px + 12} ${py - 34}`, M.silver, 3);
      g += shard(c, px - 7, py - 46, py - 4, 10, E.light) + shard(c, px + 7, py - 48, py - 4, 10, E.light);
      if (pose !== 'fire') g += shard(c, px, py - 58, py - 2, 13, pose === 'aim' ? h2(c, E.color, '#ffffff') : E.color, 3);
      g += c.r(px - 15, py - 8, 30, 7, c.vg(M.silver, 0.35, -0.3), 2, 2.4) + c.r(px - 14, py - 36, 28, 4, c.vg(M.silver, 0.35, -0.3), 1.5, 2.2);
      g += c.ci(px, py - 4.5, 2.6, E.light, 1.6);
      o += G(g, `rotate(${ang} ${px} ${py})`);
      o += c.ci(px, py, 4.4, c.sg(M.silver), 2.2);
      const mouth = rotP([px, py - 58], [px, py], ang);
      if (pose === 'aim') o += aura(c, mouth[0], mouth[1], 9, 9, E.light, 0.85) + spark(c, mouth[0], mouth[1], 5, '#ffffff', 1.4) + frostMotes(c, [[mouth[0] - 10, mouth[1] + 4, 2], [mouth[0] + 6, mouth[1] + 10, 2]]);
      if (pose === 'fire') {
        o += aura(c, mouth[0] - 4, mouth[1] + 6, 14, 12, '#ffffff', 0.8) + spark(c, mouth[0] - 4, mouth[1] + 6, 8, '#ffffff', 1.6);
        const d = (ang - 90) * D2R;
        const ex = mouth[0] + Math.cos(d) * 8;
        const ey = mouth[1] + Math.sin(d) * 8;
        o += G(shard(c, ex, ey - 18, ey + 18, 10, E.color, 2.4), `rotate(${ang} ${f(ex)} ${f(ey)})`);
        o += motion(c, `M${f(ex - 22)} ${f(ey + 20)}L${f(ex - 8)} ${f(ey + 6)}M${f(ex - 14)} ${f(ey + 26)}L${f(ex - 2)} ${f(ey + 14)}`, '#ffffff', 1.8, 0.8);
      }
      return o;
    },
  };

  /* =========================================================
   * ❄ 빙창 쇠뇌 — 옆에서 본 큰 쇠뇌(오른쪽을 겨눔) + 뒤에서 다루는 사수
   *  idle: 시위가 풀려 앞에 있고 얼음 창은 홈에 놓여 있음, 사수는 개머리에 손을 얹음
   *  aim : 사수가 감개(윈치)를 돌려 시위를 걸쇠까지 당김 — 활 팔이 뒤로 휨, 창 머리에 냉기가 모임
   *  fire: 방아쇠를 당김 → 시위가 앞으로 튕기고 활 팔이 앞으로, 창은 서리 자국을 남기며 날아감
   * ========================================================= */
  /** 쇠뇌 본체(축 (px,py), 앙각 elev도). 돌려줌 { s, W(로컬→세계), mouth, winch, trig } */
  function ballistaArt(c, B) {
    const h = c.h;
    const E = c.E;
    const st = B.state;
    const drawn = st === 'draw';
    const W = (lx, ly) => rotP([B.px + lx, B.py + ly], [B.px, B.py], -B.elev);
    const TP = (d) => tpath(d, W);
    const sc = B.L || 1;
    const rear = -24 * sc;
    const front = 30 * sc;
    const H = B.H || 22;
    const nutX = -13 * sc;
    const stock = B.stockCol || M.wood;
    const fit = B.fitCol || M.iron;
    const bowc = B.bowCol || M.woodD;
    let s = '';
    /* 활 팔(먼 쪽 = 위) */
    const tipX = drawn ? front - 15 : st === 'snap' ? front + 2 : front - 2;
    const arm = (sgn, k2, off = 0) => {
      const ty = sgn * H * k2;
      const bx = front - 4 - off;
      const cx = bx + (drawn ? 2 : 7);
      return `M${bx} ${sgn * 2.5}Q${cx} ${ty * 0.55} ${tipX - off} ${ty}`;
    };
    const arms = B.arms || 1;
    const bowFar = arm(-1, 1) + (arms > 1 ? arm(-1, 0.8, 5) : '');
    const bowNear = arm(1, 0.85) + (arms > 1 ? arm(1, 0.68, 5) : '');
    const tipF = [tipX, -H];
    const tipN = [tipX, H * 0.85];
    /* 시위 */
    const nut = [nutX, -3.2];
    const strD = drawn ? `M${P2(tipF)}L${P2(nut)}L${P2(tipN)}` : `M${P2(tipF)}L${P2(tipN)}`;
    s += c.ol(TP(bowFar), h.shade(bowc, -0.15), 3);
    /* 개머리(받침 목재) + 홈 + 쇠 띠 */
    s += c.p(TP(`M${rear} -3.6L${front} -3.2L${front + 2} 3L${rear + 3} 4.6Q${rear - 2} 4 ${rear} -3.6Z`), c.vg(stock, 0.25, -0.25), 2.6);
    s += c.ln(TP(`M${rear + 4} -1.6L${front - 2} -1.4`), h.shade(stock, -0.45), 1.5);
    s += c.ln(TP(`M${rear + 6} 1.8L${front - 8} 2`), h.shade(stock, 0.3), 1.5, 0.6);
    [rear + 8, 4, front - 6].forEach((x) => { s += c.p(TP(`M${x - 1.6} -3.8L${x + 1.6} -3.8L${x + 1.6} 4.2L${x - 1.6} 4.2Z`), c.vg(fit, 0.35, -0.25), 1.6); });
    /* 걸쇠(nut) + 방아쇠 */
    s += c.ci(...W(nut[0], 0), 2.6, c.sg(fit), 1.8);
    const trigA = st === 'snap' ? 22 : 0;
    const trig = rotP(W(nutX + 2, 9), W(nutX + 2, 3), -trigA);
    s += c.ol(`M${P2(W(nutX + 2, 3))}L${P2(trig)}`, fit, 1.6);
    /* 창(얼음): idle은 홈에 앞쪽으로 놓임, aim은 걸쇠까지 */
    let mouth = W(front + 14, -4.5);
    if (st !== 'snap') {
      const b0 = drawn ? nutX + 1 : nutX + 5;
      const b1 = drawn ? front + 10 : front + 8;
      s += c.ol(TP(`M${b0} -4.6L${b1 - 4} -4.6`), B.shaft || '#d8eef8', 2.2);
      s += c.p(TP(`M${b0} -4.6L${b0 + 5} -4.6L${b0 + 3} -8L${b0 - 1} -8Z`), E.dark, 1.4);
      mouth = W(b1 + 6, -4.6);
      const hc = W(b1, -4.6);
      if (B.head === 'drill') s += G(c.p(`M${f(hc[0] + 10)} ${f(hc[1])}L${f(hc[0] - 2)} ${f(hc[1] - 4.6)}L${f(hc[0] - 2)} ${f(hc[1] + 4.6)}Z`, c.vg(E.color, 0.5, -0.2), 2) + c.ln(`M${f(hc[0])} ${f(hc[1] - 3.6)}L${f(hc[0] + 2)} ${f(hc[1] + 3)}M${f(hc[0] + 3.6)} ${f(hc[1] - 2.4)}L${f(hc[0] + 5.4)} ${f(hc[1] + 1.8)}`, E.dark, 1.5), `rotate(${f(-B.elev)} ${f(hc[0])} ${f(hc[1])})`);
      else if (B.head === 'block') s += G(crystal(c, hc[0] + 3, hc[1], 13, 15, E.light, 2.4) + crystal(c, hc[0] + 4, hc[1], 8, 10, E.color, 1.8), `rotate(${f(90 - B.elev)} ${f(hc[0] + 3)} ${f(hc[1])})`);
      else s += G(crystal(c, hc[0] + 2, hc[1], 8, 13, E.color, 2), `rotate(${f(90 - B.elev)} ${f(hc[0] + 2)} ${f(hc[1])})`);
      if (drawn) s += aura(c, mouth[0] - 3, mouth[1], 9, 8, E.light, 0.85) + spark(c, mouth[0] - 2, mouth[1] - 1, 4.4, '#ffffff', 1.4);
    }
    /* 시위(창 위에) + 가까운 활 팔 */
    s += c.ln(TP(strD), OLC, 2.8) + c.ln(TP(strD), '#efe2c4', 1.5);
    if (st === 'snap') s += motion(c, TP(`M${tipX + 3} ${-H * 0.7}Q${tipX + 5} 0 ${tipX + 3} ${H * 0.6}M${tipX - 3} ${-H * 0.55}Q${tipX - 4.4} 0 ${tipX - 3} ${H * 0.5}`), '#ffffff', 1.5, 0.75);
    s += c.ol(TP(bowNear), bowc, 3.2);
    if (B.tipCrystal) s += crystal(c, ...W(tipF[0], tipF[1] - 3), 6, 9, E.light, 1.8) + crystal(c, ...W(tipN[0], tipN[1] + 3), 6, 9, E.light, 1.8);
    else s += c.ci(...W(tipF[0], tipF[1]), 1.6, fit, 1.4) + c.ci(...W(tipN[0], tipN[1]), 1.6, fit, 1.4);
    s += c.p(TP(`M${front - 6} -4.6L${front} -4.6L${front} 4.4L${front - 6} 4.4Z`), c.vg(fit, 0.35, -0.25), 2);
    /* 감개(윈치) — 뒤 끝 */
    const wc = W(rear + 3, 1);
    const wa = (B.winchA || 0) * D2R;
    s += c.ci(wc[0], wc[1], 4.4, c.sg(fit), 2) + c.ln(`M${f(wc[0] - Math.cos(wa) * 3.4)} ${f(wc[1] - Math.sin(wa) * 3.4)}L${f(wc[0] + Math.cos(wa) * 3.4)} ${f(wc[1] + Math.sin(wa) * 3.4)}`, h.shade(fit, -0.4), 1.5);
    const hand = [wc[0] + Math.cos(wa + Math.PI / 2) * 7, wc[1] + Math.sin(wa + Math.PI / 2) * 7];
    s += c.ol(`M${P2(wc)}L${P2(hand)}`, fit, 1.6) + c.ci(hand[0], hand[1], 1.8, M.woodD, 1.4);
    if (st === 'snap') {
      const d0 = W(front + 8, -4.6);
      s += G(c.p(`M${f(d0[0])} ${f(d0[1] - 1.4)}L${f(d0[0] + 20)} ${f(d0[1] - 0.4)}L${f(d0[0] + 20)} ${f(d0[1] + 0.4)}L${f(d0[0])} ${f(d0[1] + 1.4)}Z`, '#ffffff', 0, ' opacity="0.6"') + c.ln(`M${f(d0[0] + 3)} ${f(d0[1] - 5)}H${f(d0[0] + 16)}M${f(d0[0] + 6)} ${f(d0[1] + 5)}H${f(d0[0] + 18)}`, E.light, 1.8, 0.85) + frostMotes(c, [[d0[0] + 5, d0[1] - 9, 2.4], [d0[0] + 13, d0[1] + 8, 2], [d0[0] + 20, d0[1] - 3, 2.2]]), `rotate(${f(-B.elev)} ${f(d0[0])} ${f(d0[1])})`);
      s += aura(c, d0[0], d0[1], 8, 8, E.light, 0.75);
    }
    return { s, W, mouth, winch: hand, wc, trig, rear: W(rear, 0) };
  }
  /* 사수 자세: idle(개머리에 손) · aim(두 손으로 감개 손잡이) · fire(가까운 손이 방아쇠, 먼 손은 개머리 잡음) */
  function crossbowman(c, x, y, gy, k, pose, B, G0 = {}) {
    const lean = pose === 'aim' ? -10 : pose === 'fire' ? 6 : 0;
    const hip = [x, y];
    const toL = (p) => { const q = rotP(p, hip, -lean); return [(q[0] - x) / k, (q[1] - y) / k]; };
    let near;
    let far;
    if (pose === 'idle') {
      const rest = B.W(-14, -3.6);
      near = { e: toL([x - 5 * k, y - 6 * k]), h: toL([x - 2.4 * k, y - 2.6 * k]) };
      far = { e: toL([rest[0] - 6, rest[1] + 5]), h: toL([rest[0] - 1, rest[1] + 0.5]) };
    } else if (pose === 'aim') {
      near = { e: toL([B.winch[0] - 8, B.winch[1] + 3]), h: toL([B.winch[0] - 1.5, B.winch[1] + 0.8]) };
      far = { e: toL([B.winch[0] - 2, B.winch[1] + 8]), h: toL([B.winch[0] + 1.5, B.winch[1] - 0.6]) };
    } else {
      const grip = B.W(-20, -2);
      near = { e: toL([B.trig[0] - 7, B.trig[1] + 3]), h: toL([B.trig[0] - 1, B.trig[1] + 0.6]) };
      far = { e: toL([grip[0] - 4, grip[1] + 6]), h: toL([grip[0] + 1, grip[1] + 0.6]) };
    }
    const legs = pose === 'aim' ? { near: [x - 5 * k, gy], far: [x + 4 * k, gy] } : { near: [x - 3 * k, gy], far: [x + 3.6 * k, gy] };
    const P = man(c, {
      x, y, k, lean, near, far, legs,
      tunic: G0.tunic || '#eca43a', sleeve: G0.tunic || '#eca43a', head: G0.head || 'fur', headCol: G0.headCol || '#d0402e', furCol: G0.fur || '#f6f0e4',
      chest: G0.chest, glove: G0.glove || '#5a3a24', pants: G0.pants || '#3a3a4a', boot: G0.boot || '#4a3424', belt: '#3a2a24', cape: G0.cape, plume: G0.plume,
      squint: pose !== 'idle', beard: G0.beard,
    });
    return P;
  }
  /** 받침 기둥(나무 세 다리) — 축 (x,y), 바닥 gy */
  const tripod = (c, x, y, gy, col) => beam(c, x - 12, gy, x - 1, y + 3, 4, c.h.shade(col, -0.25)) + beam(c, x + 13, gy, x + 1, y + 3, 4, col) + beam(c, x + 2, gy + 4, x, y + 3, 4.4, col) + lash(c, x, y + 6, 7, 5);
  /** 축 갈퀴(쇠) */
  const pivotFork = (c, x, y, col = M.iron) => c.p(`M${x - 5} ${y + 9}L${x - 4} ${y - 1}L${x - 1.4} ${y - 1}L${x - 1} ${y + 4}H${x + 1}L${x + 1.4} ${y - 1}L${x + 4} ${y - 1}L${x + 5} ${y + 9}Z`, c.vg(col, 0.35, -0.25), 2) + c.ci(x, y, 2.4, c.sg(M.ironL), 1.6);

  T.ice_ballista = {
    /* 창 머리(aim) 위치 */
    muzzle: [[88, 58], [90, 53], [90, 53], [87, 22], [94, 54]],
    draw(c, v, pose = 'idle') {
      const h = c.h;
      const E = c.E;
      const st = STONE.frost;
      const state = pose === 'idle' ? 'rest' : pose === 'aim' ? 'draw' : 'snap';
      const rec = pose === 'fire' ? -2.4 : 0;
      if (v === 1) {
        /* 나무 세 다리 받침 + 나무 쇠뇌, 털모자 사수 */
        let o = plat(c, 1);
        o += footShade(c, 50, 104, 26, 6);
        const elev = pose === 'idle' ? 6 : 16;
        const B = ballistaArt(c, { px: 48 + rec, py: 74, elev, state, H: 20, L: 0.9, winchA: pose === 'aim' ? 100 : 0 });
        o += tripod(c, 48, 74, 106, M.wood);
        const P = crossbowman(c, 16, 90.5, 107, 1.32, pose, B);
        o += P.back + P.legs + P.farArm + P.farHand + P.body;
        o += pivotFork(c, 48 + rec, 74) + B.s;
        o += P.nearArm + P.nearHand;
        o += cyl(c, 78, 100, 108, 5, 1.6, c.cg(M.wood), h.shade(E.light, 0.2), 2) + c.ln('M74 104H82', M.iron, 1.5);
        return o;
      }
      if (v === 2 || v === 3) {
        /* 다듬은 돌 받침 + 쇠(Lv3 은) 장식, Lv3는 활 끝 결정·깃발 */
        const L3 = v === 3;
        let o = plat(c, v, { stone: st, trim: M.silver });
        o += footShade(c, 50, 104, 26, 6);
        if (L3) o += flag(c, 9, 100, 36, E.color, -1, 9);
        o += stoneWall(c, 50, 82, 104, 18, 21, st, { ch: 6.6, bw: 10, seed: L3 ? 105 : 103, moss: !L3 });
        o += c.e(50, 82, 18, 5.4, c.vg(h.shade(st, 0.25), 0.2, -0.05), 2.6);
        if (L3) o += bandI(c, 50, 90, 93.5, 19.4, 5.8, M.silver);
        o += snowCap(c, 43, 81.6, 9, 2.4);
        o += c.p('M45 82L46 72H54L55 82Z', c.vg(M.iron, 0.3, -0.25), 2.2);
        const elev = pose === 'idle' ? 6 : 17;
        const B = ballistaArt(c, { px: 50 + rec, py: 70, elev, state, H: L3 ? 24 : 22, L: 0.9, fitCol: L3 ? M.silver : M.iron, bowCol: L3 ? '#5a4a5a' : M.woodD, tipCrystal: L3, winchA: pose === 'aim' ? 100 : 0 });
        const P = crossbowman(c, 16, 89, 107, 1.28, pose, B, L3 ? { head: 'helm', headCol: '#d4dce6', chest: M.silver, tunic: '#d84a32', cape: '#a02a24' } : { head: 'fur', chest: '#8a5a3a' });
        o += P.back + P.legs + P.farArm + P.farHand + P.body;
        o += pivotFork(c, 50 + rec, 70, L3 ? M.silver : M.iron) + B.s;
        o += P.nearArm + P.nearHand;
        return o;
      }
      if (v === 'A') {
        /* 빙창 사수: 높은 발사대(가파른 앙각) + 겹활 + 나선 송곳 창, 판금 갑옷 사수 */
        let o = plat(c, 4, { stone: '#8ea2b6', trim: M.silver });
        o += footShade(c, 54, 99, 26, 6);
        o += stoneWall(c, 54, 74, 99, 15, 19, STONE.frost, { ch: 6, bw: 9, seed: 111 });
        o += c.e(54, 74, 15, 4.5, c.vg(h.shade(STONE.frost, 0.25), 0.2, -0.05), 2.4);
        o += bandI(c, 54, 84, 87, 16.6, 5, M.silver);
        /* 높은 쇠 기둥 + 계단 */
        o += beam(c, 48, 74, 51, 50, 4, h.shade(M.silver, -0.2)) + beam(c, 60, 74, 57, 50, 4, M.silver) + beam(c, 49, 62, 59, 62, 2.6, M.silver, { light: false });
        o += c.p('M18 99V93H30V87H40V99Z', c.vg(h.shade(STONE.frost, -0.05), 0.2, -0.2), 2.4) + c.ln('M18 93H30M30 87H40', h.shade(STONE.frost, 0.35), 1.5);
        const elev = pose === 'idle' ? 18 : 34;
        const B = ballistaArt(c, { px: 54 + rec * 0.6, py: 50 - rec * 0.4, elev, state, H: 22, L: 0.9, arms: 2, fitCol: M.silver, bowCol: '#4a5a6a', head: 'drill', tipCrystal: true, winchA: pose === 'aim' ? 100 : 0 });
        const P = crossbowman(c, 26, 70.5, 87, 1.22, pose, B, { head: 'helm', headCol: '#d4dce6', plume: E.color, chest: M.silver, tunic: '#d84a32', cape: '#9a2a24', glove: '#9aa3ae', boot: '#5a6470' });
        o += P.back + P.legs + P.farArm + P.farHand + P.body;
        o += pivotFork(c, 54 + rec * 0.6, 50 - rec * 0.4, M.silver) + B.s;
        o += P.nearArm + P.nearHand;
        return o;
      }
      /* 'B' 빙하 파쇄기: 낮고 넓은 받침 + 아주 넓은 두 겹 활 + 뭉툭한 얼음덩이 머리, 덩치 큰 사수 */
      let o = plat(c, 4, { stone: '#9aaec2', trim: M.silver });
      o += footShade(c, 52, 99, 34, 8);
      o += stoneWall(c, 52, 80, 99, 30, 32, STONE.frost, { ch: 6.4, bw: 12, seed: 121 });
      o += c.e(52, 80, 30, 9, c.vg(h.shade(STONE.frost, 0.25), 0.2, -0.05), 2.6);
      o += bandI(c, 52, 88, 92, 31, 9.3, M.silver);
      o += crystal(c, 26, 88, 10, 15, E.light, 2.2) + crystal(c, 80, 88, 10, 15, E.light, 2.2);
      o += c.p('M46 80L47 68H59L60 80Z', c.vg(M.iron, 0.3, -0.25), 2.4);
      const elev = pose === 'idle' ? 2 : 10;
      const B = ballistaArt(c, { px: 53 + rec, py: 66, elev, state, H: 30, L: 0.88, arms: 2, fitCol: M.iron, stockCol: h.shade(M.wood, -0.1), bowCol: '#3a4a5a', head: 'block', winchA: pose === 'aim' ? 100 : 0 });
      const P = crossbowman(c, 16, 86, 104, 1.38, pose, B, { head: 'fur', headCol: '#8a3a24', fur: '#f2ece0', tunic: '#d8742c', chest: '#7a4a2a', beard: '#9a5a2c', glove: '#3a2a24' });
      o += P.back + P.legs + P.farArm + P.farHand + P.body;
      o += pivotFork(c, 53 + rec, 66) + B.s;
      o += P.nearArm + P.nearHand;
      return o;
    },
  };

  /* =========================================================
   * ❄ 겨울 종 — 종지기가 밧줄로 종을 흔들어 울림
   *  idle: 종이 곧게 매달려 있고, 종지기는 밧줄을 가슴께에서 느슨히 쥠
   *  aim : 종지기가 밧줄을 힘껏 당겨 내림 → 종이 한쪽으로 크게 젖혀짐(추는 처져 있음)
   *  fire: 종이 반대로 넘어가며 추가 테를 때림 → 서리빛 소리 고리가 퍼지고, 밧줄이 올라가 팔이 위로
   * ========================================================= */
  /** 종 몸(꼭대기 (x,y), 너비 w, 높이 ht) — 회전 전 */
  function bellBody(c, x, y, w, ht, col, o = {}) {
    const h = c.h;
    const P = (px, py) => `${f(x + px * w)} ${f(y + py * ht)}`;
    let s = c.p(`M${P(-0.27, 0.16)}C${P(-0.28, -0.02)} ${P(0.28, -0.02)} ${P(0.27, 0.16)}C${P(0.3, 0.5)} ${P(0.38, 0.74)} ${P(0.5, 0.88)}Q${P(0.52, 1)} ${P(0, 1)}Q${P(-0.52, 1)} ${P(-0.5, 0.88)}C${P(-0.38, 0.74)} ${P(-0.3, 0.5)} ${P(-0.27, 0.16)}Z`, c.cg(col), 3);
    s += c.ln(`M${P(-0.36, 0.7)}Q${P(0, 0.8)} ${P(0.36, 0.7)}M${P(-0.3, 0.3)}Q${P(0, 0.36)} ${P(0.3, 0.3)}`, h.shade(col, -0.35), 1.6);
    s += c.e(x, y + ht * 0.93, w * 0.42, w * 0.08, h.shade(col, -0.55), 0);
    s += c.ln(`M${P(-0.15, 0.2)}Q${P(-0.2, 0.5)} ${P(-0.3, 0.76)}`, '#fff', 2, 0.7);
    if (o.frost) s += c.p(`M${P(-0.27, 0.16)}C${P(-0.28, -0.02)} ${P(0.28, -0.02)} ${P(0.27, 0.16)}Q${P(0.2, 0.26)} ${P(0.1, 0.2)}Q${P(0, 0.3)} ${P(-0.1, 0.2)}Q${P(-0.2, 0.26)} ${P(-0.27, 0.16)}Z`, c.vg('#ffffff', 0, -0.12), 1.6);
    /* 머리(멍에에 거는 고리) */
    s += c.p(`M${P(-0.1, 0.04)}Q${P(-0.1, -0.1)} ${P(0, -0.1)}Q${P(0.1, -0.1)} ${P(0.1, 0.04)}Z`, h.shade(col, -0.2), 2);
    return s;
  }
  /** 흔들리는 종 + 추 + 멍에·지레. 축 (x,y)(종 꼭대기), 각 ang(+ 시계 방향). 돌려줌 { s, lever, mouth } */
  function swingBell(c, x, y, w, ht, col, ang, pose, o = {}) {
    const h = c.h;
    const yoke = c.r(x - w * 0.42, y - 5, w * 0.84, 5, c.vg(o.yoke || M.woodD, 0.25, -0.25), 1.5, 2.4) + c.ci(x, y - 2.5, 2, c.sg(M.ironL), 1.4);
    const lv = o.lever ? c.ol(`M${f(x - w * 0.4)} ${f(y - 2.5)}L${f(x - w * 0.4 - o.lever)} ${f(y - 2.5)}`, o.yoke || M.woodD, 2.2) : '';
    let s = G(lv + yoke + bellBody(c, x, y, w, ht, col, o), ang ? `rotate(${f(ang)} ${f(x)} ${f(y)})` : '');
    /* 추: idle·aim은 아래로 처짐, fire는 앞선 테를 때림 */
    const piv = rotP([x, y + ht * 0.3], [x, y], ang);
    let cl;
    if (pose === 'fire') cl = rotP([x + Math.sign(ang || 1) * -w * 0.38, y + ht * 0.86], [x, y], ang);
    else cl = [piv[0], piv[1] + ht * 0.66];
    const stub = lerp(cl, piv, 0.22);
    s += c.ol(`M${P2(stub)}L${P2(cl)}`, M.iron, 1.4) + c.ci(cl[0], cl[1], w * 0.09, c.sg(M.iron), 1.8);
    const mouth = rotP([x, y + ht * 0.9], [x, y], ang);
    const lever = o.lever ? rotP([x - w * 0.4 - o.lever, y - 2.5], [x, y], ang) : null;
    if (pose === 'fire') s += spark(c, cl[0], cl[1], w * 0.2, '#ffffff', 1.4);
    return { s, lever, mouth, center: rotP([x, y + ht * 0.55], [x, y], ang) };
  }
  /** 고드름 줄 */
  function icicleRow(c, x1, x2, y, n, len, col) {
    let d = '';
    const step = (x2 - x1) / n;
    for (let i = 0; i < n; i++) {
      const a = x1 + i * step + step * 0.15;
      const L = len * (i % 2 ? 0.65 : 1);
      d += `M${f(a)} ${f(y)}L${f(a + step * 0.35)} ${f(y + L)}L${f(a + step * 0.7)} ${f(y)}Z`;
    }
    return c.p(d, c.vg(col, 0.4, -0.1), 1.8);
  }
  /** 눈 덮인 박공 지붕(널판 지붕 + 눈) */
  function snowGable(c, x1, x2, ya, yb, col) {
    const h = c.h;
    const cx = (x1 + x2) / 2;
    let s = c.p(`M${x1} ${yb}L${cx} ${ya}L${x2} ${yb}Q${cx} ${yb + 6} ${x1} ${yb}Z`, c.vg(col, 0.2, -0.25), 3);
    let d = '';
    for (let i = 1; i < 6; i++) { const t = i / 6; d += `M${f(x1 + (cx - x1) * t)} ${f(yb - (yb - ya) * t + 1)}L${f(x1 + (cx - x1) * t + 2)} ${f(yb + 4 - 2 * t)}M${f(x2 - (x2 - cx) * t)} ${f(yb - (yb - ya) * t + 1)}L${f(x2 - (x2 - cx) * t - 2)} ${f(yb + 4 - 2 * t)}`; }
    s += c.ln(d, h.shade(col, -0.35), 1.5, 0.75);
    s += c.p(`M${f(x1 + (cx - x1) * 0.25)} ${f(yb - (yb - ya) * 0.25)}L${cx} ${ya}L${f(x2 - (x2 - cx) * 0.25)} ${f(yb - (yb - ya) * 0.25)}Q${f(cx + 8)} ${f(ya + (yb - ya) * 0.5)} ${f(cx + 3)} ${f(ya + (yb - ya) * 0.4)}Q${f(cx - 4)} ${f(ya + (yb - ya) * 0.6)} ${f(cx - 9)} ${f(ya + (yb - ya) * 0.45)}Z`, '#f6fbff', 2.2);
    return s;
  }
  /* 종지기(털모자·목도리·두꺼운 외투) — 손이 밧줄 위에 */
  function ringer(c, x, y, gy, k, pose, G0 = {}) {
    const A = {
      idle: { near: { e: [-2.6, -7.6], h: [3.2, -12.2] }, far: { e: [6.8, -8.8], h: [4.6, -14.6] }, lean: 0, legs: [[x - 2.8 * k, gy], [x + 3.4 * k, gy]] },
      aim: { near: { e: [-2.4, -5.2], h: [4, -4.6] }, far: { e: [7.2, -6.6], h: [5.4, -7.4] }, lean: 12, legs: [[x - 4.4 * k, gy], [x + 4.6 * k, gy]] },
      fire: { near: { e: [-3.6, -18.6], h: [2.8, -24.6], open: false }, far: { e: [7.8, -19.2], h: [4.6, -27.4] }, lean: -8, legs: [[x - 2.6 * k, gy], [x + 3.6 * k, gy]] },
    }[pose];
    return man(c, {
      x, y, k, lean: A.lean, near: A.near, far: A.far, legs: { near: A.legs[0], far: A.legs[1] },
      tunic: G0.tunic || '#d83c34', head: G0.head || 'fur', headCol: G0.headCol || '#d83c34', furCol: '#f6f0e4', glove: G0.glove || '#5a3424',
      pants: '#3a3a4a', boot: '#4a3424', belt: '#3a2a24', trim: G0.trim || '#f2ece0', cape: G0.cape, chest: G0.chest, squint: pose !== 'idle', shout: pose === 'fire',
    });
  }
  /** 종지기 + 밧줄(지레 끝 → 두 손 → 바닥으로 늘어진 꼬리) */
  function ringerRope(c, P, lever, gy) {
    const a = P.fh;
    const b = P.nh;
    const tail = [b[0] - 2, Math.min(gy - 1, b[1] + 16)];
    const rope = `M${P2(lever)}L${P2(a)}L${P2(b)}Q${f(b[0] - 1)} ${f((b[1] + tail[1]) / 2)} ${P2(tail)}`;
    return P.back + P.legs + P.farArm + P.body + c.ol(rope, M.rope, 1.6) + P.farHand + P.nearArm + P.nearHand;
  }
  /** 울림 효과: 소리 고리 + 서리 알갱이 */
  const ringOut = (c, x, y, r, col, k = 1) => soundRings(c, x, y, [r, r * 1.4, r * 1.8], col, 2.6) + frostMotes(c, [[x - r * 1.5, y - r * 0.9, 2.4 * k], [x + r * 1.6, y - r * 0.5, 2.4 * k], [x - r * 1.2, y + r * 0.9, 2 * k], [x + r * 1.3, y + r, 2 * k]]);

  T.winter_bell = {
    /* 파동이 퍼지는 가운데(종 가운데) */
    muzzle: [[56, 71], [52, 71], [52, 72], [50, 55], [51, 88]],
    draw(c, v, pose = 'idle') {
      const h = c.h;
      const E = c.E;
      const st = STONE.frost;
      const ANG = { idle: 0, aim: -30, fire: 26 };
      const ang = ANG[pose];
      if (v === 1) {
        /* 나무 종틀(두 기둥 + 들보 + 버팀대) + 눈 덮인 작은 지붕, 왼쪽에 종지기 */
        let o = plat(c, 1);
        o += footShade(c, 54, 104, 26, 6);
        o += beam(c, 34, 106, 34, 42, 5, M.wood) + beam(c, 78, 106, 78, 42, 5, h.shade(M.wood, -0.1));
        o += beam(c, 34, 92, 44, 104, 3, M.wood, { light: false }) + beam(c, 78, 92, 68, 104, 3, M.wood, { light: false });
        o += planks(c, 28, 40, 56, 7, M.plank, { n: 1 });
        o += lash(c, 34, 50, 6, 4) + lash(c, 78, 50, 6, 4);
        o += snowGable(c, 24, 88, 22, 41, '#8a5a34');
        const B = swingBell(c, 56, 52, 30, 34, E.color, ang, pose, { lever: 10 });
        o += B.s;
        const P = ringer(c, 19, 90.5, 107, 1.32, pose);
        o += ringerRope(c, P, B.lever, 107);
        if (pose === 'fire') o += ringOut(c, B.center[0], B.center[1], 16, E.light);
        if (pose === 'aim') o += motion(c, `M${f(B.mouth[0] + 16)} ${f(B.mouth[1] - 10)}Q${f(B.mouth[0] + 20)} ${f(B.mouth[1])} ${f(B.mouth[0] + 14)} ${f(B.mouth[1] + 6)}`, '#ffffff', 1.8, 0.7);
        return o;
      }
      if (v === 2 || v === 3) {
        /* 다듬은 돌기둥 종루 + 눈 지붕(Lv3: 은 띠·고드름·결정 장식, 은빛 종) */
        const L3 = v === 3;
        let o = plat(c, v, { stone: st, trim: M.silver });
        o += footShade(c, 52, 104, 30, 7);
        o += stoneRect(c, 66, 44, 13, 62, st, { ch: 7, bw: 7, seed: 133 });
        o += stoneRect(c, 25, 44, 13, 62, st, { ch: 7, bw: 7, seed: 131 });
        if (L3) o += c.r(23, 70, 17, 5, c.vg(M.silver, 0.35, -0.25), 1, 2.2) + c.r(64, 70, 17, 5, c.vg(M.silver, 0.35, -0.25), 1, 2.2);
        o += stoneRect(c, 21, 38, 62, 10, h.shade(st, 0.1), { ch: 5, bw: 10, seed: 137, rx: 2 });
        o += c.r(25, 48, 54, 3, '#1c1426', 0, 0, ' opacity="0.3"');
        const B = swingBell(c, 52, 51, L3 ? 32 : 30, L3 ? 38 : 36, L3 ? h.mix(E.color, M.silver, 0.45) : E.color, ang, pose, { lever: 10, yoke: L3 ? M.silver : M.woodD, frost: L3 });
        o += B.s;
        o += snowGable(c, 15, 89, L3 ? 12 : 15, 40, '#6f8fb0');
        if (L3) o += icicleRow(c, 17, 87, 44, 9, 8, E.light) + crystal(c, 52, 7, 9, 13, E.color, 2.2);
        const P = ringer(c, 21, 89.5, 107, 1.28, pose, L3 ? { tunic: '#c8302a', headCol: '#c8302a', chest: M.silver, cape: '#7a2420' } : {});
        o += ringerRope(c, P, B.lever, 107);
        if (pose === 'fire') o += ringOut(c, B.center[0], B.center[1], L3 ? 19 : 17, E.light);
        if (pose === 'aim') o += motion(c, `M${f(B.mouth[0] + 17)} ${f(B.mouth[1] - 12)}Q${f(B.mouth[0] + 21)} ${f(B.mouth[1])} ${f(B.mouth[0] + 15)} ${f(B.mouth[1] + 6)}`, '#ffffff', 1.8, 0.7);
        return o;
      }
      if (v === 'A') {
        /* 정적의 종: 두꺼운 얼음 아치 안의 커다란 종(무거워서 조금만 흔들림), 울리면 하얗고 넓은 고요의 고리 */
        let o = plat(c, 4, { stone: '#8ea2b6', trim: M.silver });
        o += footShade(c, 50, 99, 36, 8);
        const angA = { idle: 0, aim: -13, fire: 11 }[pose];
        o += aura(c, 50, 60, 42, 36, E.light, pose === 'fire' ? 0.6 : 0.35);
        o += c.p('M10 100V48C10 18 28 4 50 4C72 4 90 18 90 48V100H76V50C76 30 66 18 50 18C34 18 24 30 24 50V100Z', c.vg(E.light, 0.35, -0.2), 3);
        o += c.ln('M10 66H24M76 66H90M10 84H24M76 84H90M12 40L25 44M88 40L75 44M30 12L36 22M70 12L64 22M50 4V18M17 52V66M83 52V66M17 84V100M83 84V100', h.shade(E.color, -0.1), 1.6, 0.8);
        o += c.ln('M14 30Q16 22 22 16', '#ffffff', 2, 0.8);
        o += c.ol('M50 18V22', M.silver, 2.4);
        const B = swingBell(c, 50, 25, 40, 52, h.mix(E.color, '#ffffff', 0.3), angA, pose, { lever: 6, yoke: M.silver, frost: true });
        o += B.s;
        o += icicleRow(c, 26, 74, 19, 8, 6, '#ffffff');
        const P = ringer(c, 12, 86.5, 104, 1.18, pose, { tunic: '#c8302a', headCol: '#c8302a', head: 'hood', glove: '#5a3424', trim: '#f6f0e4' });
        o += ringerRope(c, P, B.lever, 104);
        if (pose === 'fire') o += soundRings(c, B.center[0], B.center[1], [28, 38, 48], '#ffffff', 3, 0.7) + frostMotes(c, [[20, 30, 2.6], [82, 28, 2.6], [88, 70, 2.4], [16, 74, 2.4]]);
        if (pose === 'aim') o += c.ln('M36 28Q50 22 64 28', '#ffffff', 2, 0.8);
        return o;
      }
      /* 'B' 서리 장막: 3층 탑 — 처마마다 작은 종, 아래층 큰 종을 종지기가 당김. 울리면 서리 장막(안개)이 퍼짐 */
      let o = plat(c, 4, { stone: '#9aaec2', trim: M.silver });
      o += footShade(c, 54, 99, 32, 8);
      o += aura(c, 50, 60, 42, 44, E.color, pose === 'fire' ? 0.55 : 0.3);
      o += stoneRect(c, 42, 22, 16, 48, STONE.frost, { ch: 6, bw: 8, seed: 141 });
      o += stoneRect(c, 32, 66, 38, 36, STONE.frost, { ch: 7, bw: 10, seed: 143 });
      o += c.p('M40 102V84Q51 72 62 84V102Z', c.vg(E.dark, 0.1, -0.35), 2.6);
      const sAng = { idle: 0, aim: -26, fire: 22 }[pose];
      const B = swingBell(c, 51, 80, 18, 20, E.color, sAng, pose, { lever: 6 });
      o += B.s;
      o += snowGable(c, 28, 74, 6, 25, '#6f8fb0');
      o += snowGable(c, 20, 82, 26, 45, '#6f8fb0');
      o += snowGable(c, 10, 92, 46, 67, '#6f8fb0') + icicleRow(c, 14, 88, 70, 7, 8, E.light);
      const small = (x, y) => swingBell(c, x, y, 11, 13, E.color, sAng * 0.8, pose).s;
      o += c.ol('M14 66V70M88 66V70M24 45V49M78 45V49', M.silver, 1.4) + small(14, 70) + small(88, 70) + small(24, 49) + small(78, 49);
      o += crystal(c, 51, 6, 8, 11, E.color, 2.2);
      const P = ringer(c, 21, 90, 107, 1.2, pose, {});
      o += ringerRope(c, P, B.lever, 107);
      if (pose === 'fire') {
        /* 서리 장막: 땅을 따라 퍼지는 반투명 안개 */
        o += OP(c.p('M2 104Q8 92 20 96Q28 86 40 92Q50 84 62 92Q72 86 82 94Q94 90 98 102Q86 112 70 108Q50 116 30 108Q12 112 2 104Z', c.vg('#ffffff', 0, -0.1), 2.2), 0.7);
        o += ringOut(c, B.center[0], B.center[1], 14, E.light) + soundRings(c, 50, 50, [34], E.light, 2.2);
      }
      return o;
    },
  };

  /* =========================================================
   * ⚡ 번개 막대 — 구리 코일을 감은 막대(장치)
   *  idle: 꼭대기 구리 공에 작은 불꽃만 튐, 코일은 구릿빛
   *  aim : 코일이 아래부터 빛나며 불꽃이 감겨 오르고, 꼭대기 공 둘레에 전기가 모임
   *  fire: 꼭대기에서 굵은 번개가 오른쪽 위로 뻗음(갈래 포함), 코일은 다시 어두워짐
   * ========================================================= */
  const COPPER = '#d0803e';
  /** 코일: 기둥(x)을 감는 앞쪽 고리들. glow: 빛나는 정도(0~1) */
  function coilWind(c, x, y1, y2, rx, n, glow = 0, col = COPPER, w = 2.6) {
    const step = (y2 - y1) / n;
    let d = '';
    for (let i = 0; i < n; i++) {
      const y = y1 + i * step;
      d += `M${f(x - rx)} ${f(y)}Q${f(x)} ${f(y + step * 1.6)} ${f(x + rx)} ${f(y + step * 0.5)}`;
    }
    let s = c.ol(d, col, w);
    s += c.ln(d.split('M').filter(Boolean).map((seg, i) => (i % 2 ? '' : `M${seg}`)).join(''), c.h.shade(col, 0.45), 1.5, 0.7);
    if (glow > 0) s += c.ln(d, c.E.light, w + 3, f(0.35 * glow)) + c.ln(d, '#ffffff', 1.5, f(0.9 * glow));
    return s;
  }
  /** 번개 줄기(지그재그) — 시작 (x,y) → 끝 (ex,ey), 마디 n, 흔들림 j, 굵기 w */
  function arcPath(x, y, ex, ey, n, j, seed) {
    const pts = [[x, y]];
    const L = Math.hypot(ex - x, ey - y);
    const nx = -(ey - y) / L;
    const ny = (ex - x) / L;
    for (let i = 1; i < n; i++) {
      const t = i / n;
      const o = (rnd(seed + i) - 0.5) * 2 * j * (i % 2 ? 1 : -1);
      pts.push([x + (ex - x) * t + nx * o, y + (ey - y) * t + ny * o]);
    }
    pts.push([ex, ey]);
    return pts;
  }
  function zapArc(c, x, y, ex, ey, o = {}) {
    const E = c.E;
    const w = o.w || 2.4;
    const pts = arcPath(x, y, ex, ey, o.n || 6, o.j || 4, o.seed || 7);
    const d = pl(pts);
    let s = c.ln(d, o.col || E.color, w + 4, 0.45) + c.ln(d, o.col || E.light, w + 1.2, 0.9) + c.ln(d, '#ffffff', Math.max(1.5, w * 0.6));
    if (o.branch) {
      const m = pts[Math.floor(pts.length / 2)];
      const b = [m[0] + o.branch[0], m[1] + o.branch[1]];
      const bd = pl(arcPath(m[0], m[1], b[0], b[1], 3, 2.5, (o.seed || 7) + 9));
      s += c.ln(bd, o.col || E.color, w + 2, 0.45) + c.ln(bd, '#ffffff', 1.5);
    }
    return s;
  }
  /** 꼭대기 구리 공 + 자세별 전기 */
  function rodTip(c, x, y, r, pose, o = {}) {
    const E = c.E;
    let s = '';
    if (pose === 'aim') {
      s += aura(c, x, y, r * 3.4, r * 3.2, E.color, 0.85);
      s += zapArc(c, x - r * 2.6, y + r * 0.6, x - r * 0.8, y - r * 0.4, { n: 3, j: 2, w: 1.6, seed: 3 }) + zapArc(c, x + r * 2.6, y + r * 0.2, x + r * 0.9, y - r * 0.5, { n: 3, j: 2, w: 1.6, seed: 5 }) + zapArc(c, x - r * 0.4, y - r * 2.2, x, y - r, { n: 3, j: 2, w: 1.6, seed: 8 });
    } else if (pose === 'idle') s += aura(c, x, y, r * 2.2, r * 2, E.color, 0.55);
    s += orb(c, x, y, r, o.col || COPPER, 2.2);
    if (pose === 'idle') s += spark(c, x + r * 0.9, y - r * 0.9, r * 0.9, E.light, 1.5);
    if (pose === 'aim') s += c.ci(x, y, r * 0.55, '#ffffff', 0, ' opacity="0.85"');
    if (pose === 'fire') s += aura(c, x, y, r * 4, r * 3.6, '#ffffff', 0.75) + spark(c, x, y, r * 2, '#ffffff', 1.6);
    return s;
  }
  /** 사기 절연 고리(애자) — (x,y), 너비 w */
  const insulator = (c, x, y, w = 9) => c.e(x, y, w / 2, w * 0.2, c.vg('#e8e4f0', 0.3, -0.2), 1.8) + c.e(x, y + w * 0.35, w * 0.45, w * 0.18, c.vg('#d8d2e4', 0.3, -0.2), 1.8);

  T.lightning_rod = {
    muzzle: [[50, 15], [50, 13], [50, 9], [50, 9], [50, 6]],
    draw(c, v, pose = 'idle') {
      const h = c.h;
      const E = c.E;
      const st = STONE.storm;
      const glow = pose === 'aim' ? 1 : 0;
      /* 자세에 따른 모양 바뀜(32px에서도 읽히게): aim 은 팔·갈퀴가 펼쳐지고 꼭대기가 늘어나며 단자 사이에 번개가 이어짐 */
      const lift = pose === 'aim' ? 6 : 0;
      if (v === 1) {
        /* 나무 기둥(쐐기 버팀) + 구리 코일 + 땅에 박은 접지줄 + 꼭대기 구리 수염(aim: 활짝 펼침) */
        let o = plat(c, 1);
        o += footShade(c, 50, 104, 16, 4);
        o += beam(c, 34, 106, 46, 82, 3.6, h.shade(M.wood, -0.2)) + beam(c, 66, 106, 54, 82, 3.6, M.wood);
        o += c.r(44, 36, 12, 70, c.cg(M.wood), 2, 3);
        o += c.ln('M47 42Q48 60 47 80M53 50Q52 70 53 98', c.inkc(M.wood, 0.45), 1.3, 0.8) + c.e(48, 66, 1.2, 2, c.dk(M.wood, 0.4), 0);
        o += lash(c, 50, 84, 14, 4);
        /* 코일: aim 에서 위로 뛰어오름 */
        const cy = pose === 'aim' ? -5 : 0;
        o += coilWind(c, 50, 50 + cy, 78 + cy, 9.5, 5, glow);
        o += c.ol('M56 92Q66 100 72 106', COPPER, 1.6) + c.p('M70 104L76 104L73 110Z', M.iron, 1.4);
        const top = 19 - lift;
        o += c.ol(`M50 36V${top + 3}`, M.ironL, 2.6);
        /* 구리 수염 셋: idle 공을 감싸 오므림 · aim 활짝 · fire 반쯤 */
        const sp = pose === 'aim' ? 52 : pose === 'fire' ? 30 : 10;
        const base = [50, top + 6];
        const tips = [-90 - sp, -90 + sp, -90].map((d) => [base[0] + Math.cos(d * D2R) * 13, base[1] + Math.sin(d * D2R) * 13]);
        o += c.ol(tips.slice(0, 2).map((t) => `M${P2(base)}Q${f((base[0] + t[0]) / 2)} ${f(Math.min(base[1], t[1]) - 2)} ${P2(t)}`).join(''), COPPER, 1.8);
        o += tips.slice(0, 2).map((t) => c.ci(t[0], t[1], 1.8, c.sg(COPPER), 1.4)).join('');
        o += rodTip(c, 50, top, 4.4, pose);
        if (pose === 'aim') {
          o += tips.slice(0, 2).map((t, i) => zapArc(c, t[0], t[1], 50 + (i ? 3 : -3), top, { n: 3, j: 1.8, w: 1.8, seed: 15 + i })).join('');
          o += zapArc(c, 41, 72 + cy, 43, 54 + cy, { n: 4, j: 2.5, w: 1.6, seed: 11 }) + zapArc(c, 59, 66 + cy, 57, 50 + cy, { n: 4, j: 2.5, w: 1.6, seed: 13 });
          c.tip = [50, top];
        }
        if (pose === 'fire') o += zapArc(c, 52, 16, 86, 2, { n: 7, j: 4, w: 2.8, seed: 21, branch: [10, 12] });
        return o;
      }
      if (v === 2 || v === 3) {
        /* 돌 받침(돌 쌓기) + 쇠 막대 + 경첩 팔(끝에 사기 애자) + 코일, Lv3는 금 갈퀴와 원소 공
         * idle: 팔이 아래로 접힘 · aim: 팔이 Y자로 번쩍 들리고 애자에서 꼭대기 공으로 번개가 이어짐, 꼭대기 막대가 늘어남 · fire: 팔이 반쯤 내려오며 벼락 */
        const L3 = v === 3;
        let o = plat(c, v, { stone: st });
        o += footShade(c, 50, 104, 20, 5);
        o += stoneWall(c, 50, 72, 104, 12, 18, st, { ch: 6.4, bw: 8, seed: L3 ? 153 : 151, moss: !L3 });
        o += c.e(50, 72, 12, 3.6, c.vg(h.shade(st, 0.25), 0.2, -0.05), 2.4);
        if (L3) o += bandI(c, 50, 88, 92, 16, 4.8, M.gold);
        const rTop = L3 ? 26 : 30;
        o += c.r(45.5, rTop, 9, 74 - rTop, c.cg(M.iron), 2, 2.8);
        o += c.ln(`M47.5 ${rTop + 6}V68`, '#ffffff', 1.5, 0.35) + c.ci(48, 64, 0.8, c.lt(M.iron, 0.6), 0) + c.ci(48, 40, 0.8, c.lt(M.iron, 0.6), 0);
        o += coilWind(c, 50, L3 ? 52 : 54, 70, L3 ? 10 : 8.5, L3 ? 6 : 5, glow);
        /* 경첩 팔 */
        const ang = pose === 'aim' ? 44 : pose === 'fire' ? 18 : -14;
        const AL = 22;
        const piv = [[45, 47], [55, 47]];
        const tipA = piv.map((p0, i) => { const sx = i ? 1 : -1; return [p0[0] + sx * Math.cos(ang * D2R) * AL, p0[1] - Math.sin(ang * D2R) * AL]; });
        tipA.forEach((t, i) => {
          const p0 = piv[i];
          o += c.ol(`M${P2(p0)}L${P2(t)}`, M.iron, 2.6) + c.ln(`M${P2(lerp(p0, t, 0.15))}L${P2(lerp(p0, t, 0.85))}`, c.lt(M.iron, 0.5), 0.9, 0.7);
          o += c.ol(`M${f(t[0])} ${f(t[1] + 1)}Q${f((t[0] + 50) / 2)} ${f(Math.max(t[1], 56) + 8)} ${f(50 + (i ? 6 : -6))} ${L3 ? 54 : 56}`, COPPER, 1.3);
          o += insulator(c, t[0], t[1] - 3.4, 8);
        });
        o += c.r(42.5, 44, 15, 6.4, c.vg(M.iron, 0.35, -0.3), 1.5, 2.2) + c.ci(45, 47, 1.3, c.sg(M.ironL), 1.2) + c.ci(55, 47, 1.3, c.sg(M.ironL), 1.2);
        /* 꼭대기(늘어나는 막대) */
        const top = (L3 ? 15 : 17) - lift;
        o += c.ol(`M50 ${rTop}V${top + 3}`, M.ironL, 2.4) + (lift ? c.r(47.6, rTop - 3, 4.8, 3, c.vg(M.iron, 0.3, -0.3), 0.8, 1.4) : '');
        if (L3) {
          const gs = pose === 'aim' ? 11 : pose === 'fire' ? 6 : 0;
          o += c.ol(`M44 ${top + 11}Q${38 - gs} ${top + 3} ${43 - gs} ${top - 5}M56 ${top + 11}Q${62 + gs} ${top + 3} ${57 + gs} ${top - 5}`, M.gold, 2.4);
          o += c.ci(43 - gs, top - 5, 1.6, c.sg(M.gold), 1.3) + c.ci(57 + gs, top - 5, 1.6, c.sg(M.gold), 1.3);
          o += rodTip(c, 50, top, 6.5, pose, { col: E.color });
          if (pose === 'aim') o += zapArc(c, 43 - gs, top - 5, 45, top - 1, { n: 2, j: 1.5, w: 1.6, seed: 39 }) + zapArc(c, 57 + gs, top - 5, 55, top - 1, { n: 2, j: 1.5, w: 1.6, seed: 41 });
        } else o += rodTip(c, 50, top, 4.4, pose);
        if (pose === 'aim') {
          o += tipA.map((t, i) => zapArc(c, t[0], t[1] - 6, 50 + (i ? 4 : -4), top + 2, { n: 4, j: 2.4, w: 2.2, seed: 31 + i * 2 })).join('');
          o += tipA.map((t) => spark(c, t[0], t[1] - 6, 3.6, '#ffffff', 1.2)).join('');
          c.tip = [50, top];
        }
        if (pose === 'fire') o += zapArc(c, 53, top - 3, 90, L3 ? 0 : 2, { n: 7, j: 4, w: 3, seed: L3 ? 37 : 35, branch: [8, 14] });
        return o;
      }
      if (v === 'A') {
        /* 폭풍 첨탑: 돌 받침 + 쇠 기둥 + 세 갈래 왕관(공 셋) — 공 사이로 번개가 이어짐 */
        let o = plat(c, 4, { stone: '#85839c' });
        o += footShade(c, 50, 99, 22, 6);
        o += aura(c, 50, 22, 42, 22, E.color, pose === 'idle' ? 0.35 : 0.6);
        o += stoneWall(c, 50, 64, 99, 13, 21, STONE.storm, { ch: 6.4, bw: 8, seed: 161 });
        o += c.e(50, 64, 13, 3.9, c.vg(h.shade(STONE.storm, 0.25), 0.2, -0.05), 2.4);
        o += bandI(c, 50, 80, 84, 17, 5, M.gold);
        o += c.ol('M46 64Q30 52 20 28M54 64Q70 52 80 28', M.iron, 3.6);
        o += insulator(c, 28, 46, 8) + insulator(c, 72, 46, 8);
        o += c.r(46, 20, 8, 46, c.cg(M.iron), 2, 2.8);
        o += coilWind(c, 50, 32, 60, 9, 6, glow);
        o += rodTip(c, 20, 24, 5.4, pose, { col: E.color }) + rodTip(c, 80, 24, 5.4, pose, { col: E.color }) + rodTip(c, 50, 15, 6, pose, { col: E.color });
        if (pose !== 'idle') o += zapArc(c, 25, 22, 45, 16, { n: 4, j: 3, w: 1.8, seed: 41 }) + zapArc(c, 55, 16, 75, 22, { n: 4, j: 3, w: 1.8, seed: 43 });
        if (pose === 'fire') o += zapArc(c, 84, 22, 98, 12, { n: 3, j: 2, w: 2.4, seed: 45 }) + zapArc(c, 16, 22, 2, 12, { n: 3, j: 2, w: 2.4, seed: 47 }) + zapArc(c, 54, 11, 76, 4, { n: 4, j: 2.5, w: 2.6, seed: 49 }) + zapArc(c, 84, 28, 97, 44, { n: 3, j: 2, w: 2, seed: 51 });
        return o;
      }
      /* 'B' 뇌격탑: 굵은 쇠 기둥 + 큰 구리 고리 + 커다란 구 — 쌓았다가 한 번에 굵은 벼락 */
      let o = plat(c, 4, { stone: '#85839c' });
      o += footShade(c, 50, 99, 26, 7);
      o += aura(c, 50, 22, 32, 28, E.color, pose === 'aim' ? 0.85 : 0.5);
      o += frus(c, 50, 42, 99, 14, 24, c.cg(M.iron), null);
      o += c.ln([-50, -15, 20, 55].map((d) => vseam(50, 50, 96, 19, 5, d)).join(''), h.shade(M.iron, -0.45), 1.5);
      o += [56, 72, 88].map((y) => c.ci(36 + (y - 42) * 0.12, y, 1.3, M.ironL, 0) + c.ci(64 - (y - 42) * 0.12, y, 1.3, M.ironL, 0)).join('');
      o += coilWind(c, 50, 54, 90, 18, 6, glow, COPPER, 3.4);
      o += c.e(50, 42, 24, 7.5, c.vg(h.shade(COPPER, 0.1)), 3) + c.e(50, 41, 15, 4.2, h.shade(COPPER, -0.45), 0);
      o += c.p('M44 40V34H56V40Z', M.iron, 2.4);
      const R = pose === 'aim' ? 17 : pose === 'fire' ? 14 : 15.5;
      o += orb(c, 50, 20, R, E.color, 3);
      if (pose === 'idle') o += bolt(c, 46, 10, 0.85, '#fff', 1.6);
      if (pose === 'aim') o += c.ci(50, 20, R * 0.5, '#ffffff', 0, ' opacity="0.8"') + c.e(50, 20, R + 7, (R + 7) * 0.35, 'none', 0, ` stroke="${E.light}" stroke-width="${c.sw(2.4)}" opacity="0.9"`) + zapArc(c, 30, 30, 36, 22, { n: 3, j: 2, w: 1.6, seed: 55 }) + zapArc(c, 70, 28, 64, 18, { n: 3, j: 2, w: 1.6, seed: 57 });
      if (pose === 'fire') o += aura(c, 50, 20, 30, 26, '#ffffff', 0.7) + zapArc(c, 60, 16, 98, 30, { n: 6, j: 5, w: 5, seed: 59, branch: [6, -12] }) + spark(c, 50, 20, 10, '#ffffff', 1.6);
      return o;
    },
  };

  /* =========================================================
   * ⚡ 바람 포탑 — 풍차 날개가 풀무를 눌러 바람을 모으는 나팔 대포(장치)
   *  idle: 날개가 멈춰 있고 풀무는 부풀어 있음
   *  aim : 날개가 빠르게 돌고(흐림 줄) 풀무가 눌려 납작, 나팔 입으로 바람이 빨려 듦(소용돌이)
   *  fire: 나팔에서 돌풍이 터져 나감(소용돌이 줄·나뭇잎), 포신이 뒤로 밀림
   * ========================================================= */
  /** 풍차 날개 — 축 (x,y), 반지름 R, 날개 n, 시작 각 rot, spin: 흐림 정도(0~2) */
  function rotorArt(c, x, y, R, sail, rot = 45, o = {}) {
    const h = c.h;
    const n = o.n || 4;
    const spin = o.spin || 0;
    let s = '';
    if (spin) {
      s += c.e(x, y, R * 1.02, R * 1.02, h.shade(sail, 0.2), 0, ` opacity="${f(0.18 + 0.1 * spin)}"`);
      const arcs = [];
      for (let i = 0; i < n; i++) {
        const a0 = (rot + (i * 360) / n + 8) * D2R;
        const a1 = a0 + (30 + 18 * spin) * D2R;
        arcs.push(`M${f(x + Math.cos(a0) * R * 0.92)} ${f(y + Math.sin(a0) * R * 0.92)}A${f(R * 0.92)} ${f(R * 0.92)} 0 0 1 ${f(x + Math.cos(a1) * R * 0.92)} ${f(y + Math.sin(a1) * R * 0.92)}`);
      }
      s += c.ln(arcs.join(''), '#ffffff', 2, 0.8);
    }
    for (let i = 0; i < n; i++) {
      const a = ((rot + (i * 360) / n) * Math.PI) / 180;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const Pq = (r, sd) => [x + ca * r - sa * sd, y + sa * r + ca * sd];
      const blade = c.p(poly([Pq(R * 0.22, 1), Pq(R, 1.5), Pq(R, R * 0.3), Pq(R * 0.3, R * 0.2)]), c.vg(sail, 0.35, -0.15), 2.2)
        + c.ln(`M${P2(Pq(R * 0.45, 1.4))}L${P2(Pq(R * 0.45, R * 0.24))}M${P2(Pq(R * 0.72, 1.5))}L${P2(Pq(R * 0.72, R * 0.27))}`, h.shade(sail, -0.3), 1.5, 0.8)
        + (o.trim ? c.ln(`M${P2(Pq(R * 0.95, 2))}L${P2(Pq(R * 0.95, R * 0.28))}`, o.trim, 2) : '');
      s += spin ? OP(blade, f(1 - spin * 0.25)) : blade;
      s += c.ol(`M${f(x)} ${f(y)}L${P2(Pq(R * 1.02, 0))}`, M.woodD, 1.8);
    }
    return s + c.ci(x, y, R * 0.13 + 2, c.sg(M.bronze), 2.2) + c.ci(x, y, 1.2, OLC, 0);
  }
  /** 나팔 포신 — 뒤 (x,y)에서 오른쪽 길이 L, 반지름 r, 기울기 ang(− 위로). 돌려줌 { s, mouth, dir } */
  function hornGun(c, x, y, L, r, ang, col) {
    const h = c.h;
    let b = c.p(`M${x} ${y - r}L${x + L * 0.72} ${y - r * 0.8}Q${x + L * 0.9} ${y - r * 0.8} ${x + L} ${y - r * 1.8}V${y + r * 1.8}Q${x + L * 0.9} ${y + r * 0.8} ${x + L * 0.72} ${y + r * 0.8}L${x} ${y + r}Z`, c.vg(col, 0.45, -0.3), 3);
    b += c.e(x + L, y, r * 0.55, r * 1.8, h.shade(col, -0.5), 2.4) + c.e(x + L + 0.4, y, r * 0.3, r * 1.15, '#1c1426', 0, ' opacity="0.6"');
    b += c.ln(`M${x + L * 0.22} ${y - r}V${y + r}M${x + L * 0.5} ${y - r * 0.92}V${y + r * 0.92}`, h.shade(col, -0.45), 2.2);
    b += [0.22, 0.5].map((t) => c.ci(x + L * t, y - r * 0.55, 0.9, h.shade(col, 0.5), 0) + c.ci(x + L * t, y + r * 0.45, 0.9, h.shade(col, 0.5), 0)).join('');
    b += c.ln(`M${x + 2} ${y - r * 0.5}L${x + L * 0.7} ${y - r * 0.42}`, '#ffffff', 1.5, 0.55);
    return { s: G(b, `rotate(${ang} ${x} ${y})`), mouth: rotP([x + L, y], [x, y], ang), dir: ang };
  }
  /** 소용돌이(나선) 경로 — 가운데 (x,y), 바깥 반지름 r, 감은 수 turns */
  function spiralD(x, y, r, turns = 1.6, a0 = 0) {
    let d = '';
    const n = Math.round(turns * 12);
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const a = a0 + t * turns * Math.PI * 2;
      const rr = r * (1 - t * 0.85);
      d += `${i ? 'L' : 'M'}${f(x + Math.cos(a) * rr)} ${f(y + Math.sin(a) * rr * 0.8)}`;
    }
    return d;
  }
  /** 돌풍 — 입 (x,y), 방향 dir(도), 크기 k: 부푼 바람 덩이 + 끝이 말린 바람 줄 */
  function gustBurst(c, x, y, dir, k = 1) {
    const E = c.E;
    const cl = c.h.mix(E.light, '#ffffff', 0.5);
    const P = (a, b) => `${f(x + a * k)} ${f(y + b * k)}`;
    let s = c.p(`M${P(0, -4)}Q${P(10, -9)} ${P(18, -11)}Q${P(22, -16)} ${P(27, -12)}Q${P(33, -10)} ${P(31, -4)}Q${P(35, 0)} ${P(31, 4)}Q${P(33, 10)} ${P(27, 12)}Q${P(22, 16)} ${P(18, 11)}Q${P(10, 9)} ${P(0, 4)}Z`, cl, 2.2, ' opacity="0.8"');
    const lines = `M${P(2, -2)}Q${P(12, -6)} ${P(22, -6)}M${P(2, 2)}Q${P(12, 6)} ${P(22, 6)}`;
    s += c.ln(lines, E.color, 2.4) + c.ln(spiralD(x + 24 * k, y - 4 * k, 5 * k, 1.3, Math.PI) + spiralD(x + 24 * k, y + 5 * k, 4.4 * k, 1.3, 0), E.color, 2);
    s += motion(c, `M${P(30, -18)}Q${P(36, -16)} ${P(40, -10)}M${P(30, 18)}Q${P(36, 16)} ${P(40, 10)}`, '#ffffff', 1.8, 0.85);
    return G(s, dir ? `rotate(${f(dir)} ${f(x)} ${f(y)})` : '');
  }
  /** 빨려 드는 바람(소용돌이) — 입 앞 (x,y) */
  function intake(c, x, y, dir, k = 1) {
    const E = c.E;
    const cx = x + 9 * k;
    const sp = spiralD(cx, y, 9 * k, 1.7, -Math.PI / 2);
    return aura(c, x + 2 * k, y, 9 * k, 9 * k, E.light, 0.85) + G(c.ln(sp, E.color, 3.6, 0.5) + c.ln(sp, '#ffffff', 1.6, 0.95), dir ? `rotate(${f(dir)} ${f(x)} ${f(y)})` : '');
  }
  /** 풀무 상자 — 경첩 (x,y)(오른쪽), 길이 L, 벌어짐 open(0~1) */
  function bellowsBox(c, x, y, L, open, col = '#8a5a34') {
    const h = c.h;
    const top = y - 3 - open * 10;
    let s = c.p(`M${x - L} ${y + 2}L${x} ${y}L${x} ${y - 3}L${x - L} ${f(top)}Z`, c.vg(col, 0.25, -0.25), 2.4);
    s += c.ln(`M${f(x - L * 0.7)} ${f(y + 1.4 - (y + 2 - top) * 0.7)}L${x - 2} ${y - 2}M${f(x - L * 0.4)} ${f(y + 1 - (y + 2 - top) * 0.42)}L${x - 1} ${y - 1.6}`, h.shade(col, -0.4), 1.5);
    s += c.ol(`M${x - L} ${f(top)}L${x} ${y - 3}`, M.woodD, 2) + c.ol(`M${x - L} ${y + 2}L${x} ${y}`, M.woodD, 2);
    return { s, top: [x - L, top] };
  }

  T.gale_cannon = {
    muzzle: [[72, 70], [74, 65], [74, 65], [50, 10], [50, 27]],
    draw(c, v, pose = 'idle') {
      const h = c.h;
      const E = c.E;
      const st = STONE.storm;
      const sail = h.mix(E.light, '#ffffff', 0.35);
      const spin = pose === 'aim' ? 1 : pose === 'fire' ? 2 : 0;
      const rot = pose === 'idle' ? 45 : pose === 'aim' ? 70 : 20;
      const rec = pose === 'fire' ? -3 : 0;
      const open = pose === 'idle' ? 1 : pose === 'aim' ? 0.1 : 0.4;
      if (v === 1 || v === 2 || v === 3) {
        /* Lv1 나무 · Lv2 돌 · Lv3 돌 + 금 나팔 — 풍차 기둥(왼쪽 뒤) + 풀무 + 나팔 포신 */
        const L1 = v === 1;
        const L3 = v === 3;
        let o = plat(c, v, L1 ? {} : { stone: st });
        o += footShade(c, 48, 104, 22, 6);
        const mx = 30;
        const my = L1 ? 48 : 42;
        const R = L1 ? 23 : L3 ? 28 : 26;
        /* 풍차 기둥 */
        o += L1 ? beam(c, mx, 96, mx, my, 4, M.woodD) + beam(c, mx - 10, 104, mx - 1, 80, 3, h.shade(M.wood, -0.2)) : beam(c, mx, 92, mx, my, 4, M.iron);
        o += rotorArt(c, mx, my, R, sail, rot, { spin, trim: L3 ? E.color : null });
        /* 받침 몸통 */
        if (L1) {
          o += planks(c, 34, 82, 30, 22, M.plank, { n: 4, vert: true });
          o += c.p('M32 82H66L64 78H34Z', c.vg(M.wood, 0.25, -0.2), 2.2);
        } else {
          o += stoneWall(c, 47, 78, 104, 19, 20, st, { ch: 6.5, bw: 9, seed: L3 ? 175 : 173, moss: !L3 });
          o += c.e(47, 78, 19, 5.7, c.vg(h.shade(st, 0.25), 0.2, -0.05), 2.4);
          if (L3) o += bandI(c, 47, 82, 85.5, 19.4, 5.8, M.gold);
        }
        /* 풀무(포신 뒤) + 크랭크 막대(날개 축 → 풀무) */
        const bw = bellowsBox(c, 46, L1 ? 79 : 75, 15, open);
        o += c.ol(`M${mx} ${my}L${f(bw.top[0] + 3)} ${f(bw.top[1])}`, M.ironL, 1.4);
        o += bw.s;
        const g = hornGun(c, 47 + rec, L1 ? 76 : 71, L1 ? 25 : 27, L1 ? 6 : 7, -14, L3 ? M.gold : M.bronze);
        o += g.s;
        o += c.ci(47 + rec, L1 ? 76 : 71, 3.4, c.sg(M.ironL), 2);
        if (pose === 'aim') o += intake(c, g.mouth[0] + 2, g.mouth[1], g.dir, L1 ? 0.8 : 0.9);
        if (pose === 'fire') o += gustBurst(c, g.mouth[0] + 1, g.mouth[1], g.dir, L1 ? 0.74 : 0.76);

        return o;
      }
      if (v === 'A') {
        /* 회오리 탑: 돌 탑 위의 회오리 깔때기(풍차 날개 넷이 둘레에서 돎) */
        let o = plat(c, 4, { stone: '#85839c' });
        o += footShade(c, 50, 99, 24, 6);
        o += aura(c, 50, 30, 42, 32, E.color, pose === 'idle' ? 0.3 : 0.55);
        o += stoneWall(c, 50, 60, 99, 15, 22, STONE.storm, { ch: 6.5, bw: 9, seed: 181 });
        o += bandI(c, 50, 66, 69, 16.6, 5, M.gold);
        o += litWindow(c, 50, 90, 7, 9, E.light, { frame: h.shade(STONE.storm, -0.25) });
        o += c.e(50, 60, 15, 4.5, c.vg(h.shade(STONE.storm, 0.2)), 2.4);
        /* 깔때기: idle 넓고 느슨 · aim 좁고 빠름 · fire 회오리를 내보냄 */
        const tight = pose === 'aim' ? 0.75 : 1;
        const top = pose === 'aim' ? 10 : 8;
        const wTop = 38 * tight;
        o += c.p(`M44 60C40 48 ${f(50 - wTop * 0.7)} 30 ${f(50 - wTop)} ${top}Q50 ${top - 7} ${f(50 + wTop)} ${top}C${f(50 + wTop * 0.7)} 30 60 48 56 60Q50 63 44 60Z`, c.vg(E.light, 0.4, -0.05), 3, ' opacity="0.95"');
        const lines = pose === 'idle' ? [16, 30, 44] : [14, 22, 30, 38, 46, 52];
        o += c.ln(lines.map((y) => { const t = (60 - y) / (60 - top); const w2 = 6 + (wTop - 6) * t; return `M${f(50 - w2)} ${f(y)}Q50 ${f(y + 5)} ${f(50 + w2 * 0.9)} ${f(y - 2)}`; }).join(''), E.color, 2.4);
        o += c.ln(`M${f(50 - wTop * 0.6)} ${top + 6}Q50 ${top + 11} ${f(50 + wTop * 0.4)} ${top + 7}`, '#ffffff', 1.8, 0.9);
        if (pose !== 'idle') o += c.r(50 - wTop * 0.7, 30, 5, 4, M.woodD, 1, 1.4) + c.r(50 + wTop * 0.5, 22, 4, 4, M.rough, 1, 1.4) + c.p(`M${f(50 - wTop * 0.4)} 16q3 -2 4 1q-3 2 -4 -1Z`, '#8ac06a', 1.5);
        if (pose === 'aim') o += motion(c, `M${f(50 + wTop + 4)} 20Q${f(50 + wTop + 8)} 30 ${f(50 + wTop - 2)} 40M${f(50 - wTop - 4)} 24Q${f(50 - wTop - 8)} 34 ${f(50 - wTop + 2)} 44`, '#ffffff', 2, 0.85);
        if (pose === 'fire') {
          /* 떨어져 나가는 작은 회오리 */
          const tx = 82;
          o += c.p(`M${tx - 2} 52C${tx - 4} 44 ${tx - 9} 36 ${tx - 12} 26Q${tx} 22 ${tx + 12} 26C${tx + 9} 36 ${tx + 4} 44 ${tx + 2} 52Z`, c.vg(E.light, 0.4, -0.05), 2.4, ' opacity="0.9"');
          o += c.ln(`M${tx - 9} 32Q${tx} 35 ${tx + 9} 31M${tx - 6} 40Q${tx} 42 ${tx + 6} 39M${tx - 3} 47Q${tx} 48 ${tx + 3} 46`, E.color, 2);
          o += motion(c, `M58 34Q66 30 70 34M60 44Q66 42 72 46`, '#ffffff', 1.8, 0.8);
        }
        return o;
      }
      /* 'B' 하늘 사냥꾼: 하늘을 향한 쌍포신 + 날개(바람받이) — 비행 적 전문 */
      let o = plat(c, 4, { stone: '#85839c' });
      o += footShade(c, 50, 99, 26, 7);
      const wingUp = pose === 'aim' ? -10 : pose === 'fire' ? 8 : 0;
      const wing = (sx) => {
        const d = `M${50 + sx * 6} 70C${50 + sx * 20} 64 ${50 + sx * 36} ${50 + wingUp} ${50 + sx * 44} ${26 + wingUp}C${50 + sx * 30} ${34 + wingUp * 0.6} ${50 + sx * 20} ${38 + wingUp * 0.4} ${50 + sx * 10} 44Z`;
        return c.p(d, c.vg(sail, 0.3, -0.15), 3) + c.ln(`M${50 + sx * 10} 60C${50 + sx * 22} 54 ${50 + sx * 32} ${44 + wingUp * 0.7} ${50 + sx * 38} ${34 + wingUp}M${50 + sx * 10} 52C${50 + sx * 18} 48 ${50 + sx * 26} ${42 + wingUp * 0.5} ${50 + sx * 30} ${38 + wingUp * 0.8}`, E.color, 2);
      };
      o += wing(-1) + wing(1);
      o += stoneWall(c, 50, 74, 99, 24, 25, STONE.storm, { ch: 6.2, bw: 10, seed: 191 });
      o += c.e(50, 74, 24, 7.2, c.vg(h.shade(STONE.storm, 0.25), 0.2, -0.05), 2.4);
      o += bandI(c, 50, 84, 88, 24.6, 7.4, M.gold);
      o += c.p('M34 76Q34 58 50 56Q66 58 66 76Q50 82 34 76Z', c.vg(M.iron, 0.35, -0.25), 3) + c.ln('M38 66Q50 62 62 66', '#ffffff', 1.5, 0.5);
      const by = pose === 'fire' ? 3 : 0;
      o += cyl(c, 43, 29 + by, 64, 6, 2, c.cg(M.bronze), null) + cyl(c, 57, 29 + by, 64, 6, 2, c.cg(M.bronze), null);
      o += c.e(43, 29 + by, 6.4, 2.4, h.shade(M.bronze, -0.5), 2.4) + c.e(57, 29 + by, 6.4, 2.4, h.shade(M.bronze, -0.5), 2.4);
      o += c.r(36, 39 + by, 28, 6, c.vg(M.gold, 0.35, -0.3), 2, 2.4) + c.r(36, 50, 28, 6, c.vg(M.gold, 0.35, -0.3), 2, 2.4);
      o += c.ci(50, 68, 5, c.sg(pose === 'idle' ? E.color : '#ffffff'), 2.2);
      if (pose === 'aim') o += intake(c, 43, 27, -90, 0.6) + intake(c, 57, 27, -90, 0.6);
      if (pose === 'fire') o += gustBurst(c, 43, 31, -98, 0.58) + gustBurst(c, 57, 31, -82, 0.58);
      return o;
    },
  };

  /* =========================================================
   * ⚡ 축전기 (지원) — 바퀴를 돌려 전기를 모으고 이웃 탑으로 흘려보냄(장치), idle → aim → fire 반복
   *  idle: 바퀴가 멈춰 있고 유리관 속 번개가 가늘게 일렁임
   *  aim : 바퀴가 빠르게 돌고(흐림) 유리관이 밝아지며 코일에 불꽃이 감김
   *  fire: 번쩍! 꼭대기에서 양옆(이웃 탑 쪽)으로 전기가 튀고, 바퀴는 계속 돎
   * ========================================================= */
  /** 유리관 — 가운데 x, 위 y1, 아래 y2, 반지름 r, 안의 번개 밝기 k(0.5~1.6) */
  function glassTube(c, x, y1, y2, r, k = 1) {
    const h = c.h;
    const E = c.E;
    let o = OP(cyl(c, x, y1, y2, r, r * 0.3, h.mix(E.light, '#ffffff', 0.4), null, 0), f(0.45 + 0.15 * Math.min(1, k)));
    if (k > 1) o += aura(c, x, (y1 + y2) / 2, r * 1.8, (y2 - y1) * 0.7, E.light, 0.7);
    const m = (y1 + y2) / 2;
    const L = y2 - y1;
    const d = `M${f(x - 1)} ${f(y1 + 2)}L${f(x + r * 0.5)} ${f(y1 + L * 0.3)}L${f(x - r * 0.5)} ${f(m)}L${f(x + r * 0.4)} ${f(y1 + L * 0.72)}L${f(x)} ${f(y2 - 2)}`;
    o += c.ln(d, E.color, 3.4 * k, 0.6) + c.ln(d, '#ffffff', Math.max(1.5, 1.4 * k));
    if (k > 1.2) o += c.ln(`M${f(x + 1)} ${f(y1 + 3)}L${f(x - r * 0.45)} ${f(y1 + L * 0.4)}L${f(x + r * 0.5)} ${f(y1 + L * 0.62)}L${f(x - 1)} ${f(y2 - 3)}`, '#ffffff', 1.5, 0.85);
    o += c.p(`M${f(x - r)} ${f(y1)}V${f(y2)}A${f(r)} ${f(r * 0.3)} 0 0 0 ${f(x + r)} ${f(y2)}V${f(y1)}`, 'none', 2.8);
    o += c.ln(`M${f(x - r * 0.6)} ${f(y1 + 3)}V${f(y2 - 3)}`, '#fff', 2, 0.6);
    return o;
  }
  const capRing = (c, x, y, r, col = M.bronze) => cyl(c, x, y - 3, y + 3, r, r * 0.3, c.cg(col), c.vg(c.h.shade(col, 0.2))) + c.ln(`M${f(x - r * 0.6)} ${f(y + 1)}L${f(x - r * 0.6)} ${f(y + 3.4)}M${f(x)} ${f(y + 1.6)}V${f(y + 4)}M${f(x + r * 0.6)} ${f(y + 1)}V${f(y + 3.4)}`, c.h.shade(col, -0.4), 1.5);
  /** 바퀴(살 여섯) — 가운데 (x,y), 반지름 r, 돌아감 spin */
  function flywheel(c, x, y, r, spin, rot = 0, col = M.iron) {
    const h = c.h;
    let s = c.ci(x, y, r, 'none', 3) + c.ci(x, y, r, 'none', 0, ` stroke="${h.shade(col, 0.15)}" stroke-width="${c.sw(2.4)}"`);
    let d = '';
    for (let i = 0; i < 6; i++) { const a = (rot + i * 60) * D2R; d += `M${f(x)} ${f(y)}L${f(x + Math.cos(a) * r)} ${f(y + Math.sin(a) * r)}`; }
    s = OP(c.ln(d, OLC, 3.4) + c.ln(d, h.shade(col, 0.2), 1.6), spin ? 0.55 : 1) + s;
    if (spin) s = c.ci(x, y, r, h.shade(col, 0.5), 0, ' opacity="0.25"') + s + c.ln(`M${f(x - r * 0.8)} ${f(y - r * 0.6)}A${f(r)} ${f(r)} 0 0 1 ${f(x + r * 0.3)} ${f(y - r * 0.95)}M${f(x + r * 0.8)} ${f(y + r * 0.6)}A${f(r)} ${f(r)} 0 0 1 ${f(x - r * 0.3)} ${f(y + r * 0.95)}`, '#ffffff', 1.8, 0.85);
    return s + c.ci(x, y, r * 0.24, c.sg(M.bronze), 1.8);
  }

  T.dynamo = {
    /* 이웃으로 흘려보내는 전기가 나가는 점(꼭대기 단자) */
    muzzle: [[50, 47], [50, 22], [50, 22], [50, 24], [50, 14]],
    draw(c, v, pose = 'idle') {
      const h = c.h;
      const E = c.E;
      const st = STONE.storm;
      const spin = pose !== 'idle';
      const k = pose === 'idle' ? 0.8 : pose === 'aim' ? 1.25 : 1.6;
      const rot = pose === 'fire' ? 25 : 0;
      const outArcs = (x, y, span, seed) => zapArc(c, x - 3, y, x - span, y + 10, { n: 5, j: 3.5, w: 2.2, seed }) + zapArc(c, x + 3, y, x + span, y + 8, { n: 5, j: 3.5, w: 2.2, seed: seed + 4 }) + aura(c, x, y, 14, 12, '#ffffff', 0.85) + spark(c, x, y, 8, '#ffffff', 1.6);
      if (v === 1) {
        /* 나무 틀 + 유리관 + 손잡이 바퀴(가죽 띠로 이어짐) */
        let o = plat(c, 1);
        o += footShade(c, 50, 104, 26, 6);
        o += beam(c, 30, 106, 30, 40, 4.6, M.wood) + beam(c, 70, 106, 70, 40, 4.6, h.shade(M.wood, -0.1));
        o += planks(c, 24, 35, 52, 7, M.plank, { n: 1 });
        o += aura(c, 50, 80, 22, 24, E.color, pose === 'idle' ? 0.4 : 0.65);
        o += c.ol('M50 42V48', COPPER, 2);
        o += capRing(c, 50, 101, 17) + glassTube(c, 50, 62, 99, 15, k) + capRing(c, 50, 61, 17);
        o += c.ol('M50 58V52', COPPER, 2) + c.ci(50, 50, 4, c.sg(COPPER), 2);
        o += coilWind(c, 50, 64, 72, 15.5, 2, pose === 'aim' ? 1 : 0);
        /* 바퀴(오른쪽 앞) + 띠 */
        o += c.ol('M74 100Q66 104 62 101M74 88Q66 86 62 96', '#5a3a24', 1.4);
        o += flywheel(c, 80, 94, 9, spin, rot);
        o += c.ol('M80 94L86 86', M.iron, 1.6) + c.ci(86, 86, 1.8, M.wood, 1.4);
        if (pose === 'fire') o += outArcs(50, 50, 30, 61);
        return o;
      }
      if (v === 2 || v === 3) {
        /* 돌 받침 + 가운데 큰 유리관 + 옆 코일(Lv2)/옆 유리관(Lv3) + 뒤 바퀴 */
        const L3 = v === 3;
        let o = plat(c, v, { stone: st });
        o += footShade(c, 50, 104, 28, 7);
        o += aura(c, 50, 62, L3 ? 30 : 22, L3 ? 40 : 34, E.color, pose === 'idle' ? 0.4 : 0.65);
        o += flywheel(c, 82, 72, 11, spin, rot);
        o += stoneWall(c, 50, 90, 104, 24, 25, st, { ch: 7, bw: 10, seed: L3 ? 205 : 203 });
        o += c.e(50, 90, 24, 7, c.vg(h.shade(st, 0.25), 0.2, -0.05), 2.4);
        if (L3) o += bandI(c, 50, 93, 97, 24.4, 7.3, M.gold);
        o += c.ol('M82 72L70 90', '#5a3a24', 1.4);
        const side = L3
          ? (x) => capRing(c, x, 90, 7) + glassTube(c, x, 64, 88, 6, k * 0.8) + capRing(c, x, 63, 7) + c.ol(`M${x} 60V55`, COPPER, 1.8) + c.ci(x, 54, 2.6, c.sg(COPPER), 1.8)
          : (x) => cyl(c, x, 66, 90, 6, 1.8, c.cg(M.iron), c.vg(M.ironL)) + coilWind(c, x, 68, 88, 6.4, 5, pose === 'aim' ? 1 : 0, COPPER, 2);
        o += side(25) + side(75);
        o += c.ol('M31 72H38M62 72H69', COPPER, 2);
        o += capRing(c, 50, 88, 15) + glassTube(c, 50, 38, 86, 12, k) + capRing(c, 50, 37, 15);
        o += c.ol('M50 34V27', COPPER, 2.2) + c.ci(50, 24, 4.2, c.sg(COPPER), 2.2);
        if (pose === 'aim') o += zapArc(c, 31, 66, 38, 58, { n: 3, j: 2, w: 1.5, seed: 71 }) + zapArc(c, 69, 66, 62, 58, { n: 3, j: 2, w: 1.5, seed: 73 });
        if (pose === 'fire') o += outArcs(50, 24, 34, 75);
        else if (L3) o += spark(c, 50, 24, 6, E.light, 1.6);
        return o;
      }
      if (v === 'A') {
        /* 과충전 코일: 겹겹이 쌓인 구리 원반(돌아감) + 빛나는 핵 */
        let o = plat(c, 4, { stone: '#85839c' });
        o += footShade(c, 50, 99, 30, 7);
        o += aura(c, 50, 30, 30, 30, E.color, pose === 'idle' ? 0.45 : 0.75);
        o += c.r(45, 36, 10, 60, c.cg(M.iron), 1, 2.6);
        o += c.ln('M47.5 40V92', '#ffffff', 1.5, 0.35);
        [[88, 34], [72, 28], [57, 22], [43, 16]].forEach(([y, r], i) => {
          o += cyl(c, 50, y - 3, y + 3, r, r * 0.3, c.cg(COPPER), c.vg(h.shade(COPPER, 0.25)));
          const a0 = (pose === 'idle' ? -40 : pose === 'aim' ? 10 : 50) + i * 30;
          o += c.ln([a0, a0 + 60, a0 + 120, a0 + 180, a0 + 240, a0 + 300].map((d) => ((d % 360) + 540) % 360 - 180).filter((d) => Math.abs(d) < 78).map((d) => vseam(50, y - 3, y + 1.6, r, r * 0.3, d)).join(''), h.shade(COPPER, -0.45), 1.6);
          if (spin) o += c.ln(`M${f(50 - r * 0.9)} ${f(y + r * 0.3)}Q50 ${f(y + r * 0.42)} ${f(50 + r * 0.5)} ${f(y + r * 0.36)}`, '#ffffff', 1.6, 0.8);
        });
        if (pose === 'aim') o += zapArc(c, 22, 72, 30, 58, { n: 3, j: 2, w: 1.6, seed: 81 }) + zapArc(c, 78, 72, 70, 58, { n: 3, j: 2, w: 1.6, seed: 83 });
        o += orb(c, 50, 26, pose === 'aim' ? 11 : 10, E.color, 2.8) + spark(c, 50, 26, pose === 'idle' ? 4 : 6, '#fff', 0);
        if (pose === 'fire') o += outArcs(50, 26, 36, 85) + zapArc(c, 44, 20, 26, 4, { n: 4, j: 3, w: 2, seed: 89 }) + zapArc(c, 56, 20, 74, 4, { n: 4, j: 3, w: 2, seed: 91 });
        return o;
      }
      /* 'B' 방전 코일: 두 뿔 사이를 기어오르는 번개(야곱의 사다리) — 꼭대기에 닿으면 주변 땅으로 방전 */
      let o = plat(c, 4, { stone: '#85839c' });
      o += footShade(c, 50, 99, 26, 7);
      o += aura(c, 50, 36, 38, 30, E.color, pose === 'idle' ? 0.35 : 0.6);
      o += capRing(c, 50, 96, 18) + glassTube(c, 50, 66, 94, 14, k) + capRing(c, 50, 64, 18);
      o += c.ol('M42 62C38 46 28 30 18 10M58 62C62 46 72 30 82 10', COPPER, 4);
      o += insulator(c, 30, 34, 7) + insulator(c, 70, 34, 7);
      o += c.ci(18, 10, 4, c.sg(COPPER), 2) + c.ci(82, 10, 4, c.sg(COPPER), 2);
      /* 기어오르는 번개: idle 아래 · aim 가운데 · fire 꼭대기 */
      const ly = pose === 'idle' ? 54 : pose === 'aim' ? 36 : 16;
      const half = 9 + (60 - ly) * 0.62;
      o += zapArc(c, 50 - half, ly, 50 + half, ly - 2, { n: 6, j: 3.5, w: pose === 'idle' ? 1.8 : 2.6, seed: 93 });
      if (pose !== 'idle') o += OP(zapArc(c, 50 - half + 6, ly + 12, 50 + half - 6, ly + 10, { n: 5, j: 3, w: 1.5, seed: 95 }), 0.5);
      if (pose === 'fire') {
        o += aura(c, 50, 16, 34, 12, '#ffffff', 0.7);
        o += zapArc(c, 20, 14, 6, 60, { n: 5, j: 4, w: 2.2, seed: 97 }) + zapArc(c, 80, 14, 94, 60, { n: 5, j: 4, w: 2.2, seed: 99 });
        o += zapArc(c, 30, 98, 10, 108, { n: 3, j: 2.4, w: 2, seed: 101 }) + zapArc(c, 70, 98, 90, 108, { n: 3, j: 2.4, w: 2, seed: 103 });
      }
      return o;
    },
  };

  /* 9종 모두 섬세한 명암(세 단계 + 색을 튼 그늘 + 반사광)으로 그림 — docs/design/animation.md §7.2 */
  ['ember_archer', 'flame_mortar', 'forge', 'frost_crystal', 'ice_ballista', 'winter_bell', 'lightning_rod', 'gale_cannon', 'dynamo'].forEach((id) => {
    const d0 = T[id].draw;
    T[id].draw = (c, v, pose) => d0(fine(c), v, pose);
  });
})();
