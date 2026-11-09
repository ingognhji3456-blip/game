'use strict';

/* 탑 그림 공개 함수 + 울림등 (공용 도구: towers.js, 탑 정의: towers-*.js) */
(() => {
  const { OL, SC, VKEYS, f, M, STONE, ELEM, Ctx, poly, cyl, frus, ring, band, vseam, flame, crystal, orb, aura, spark, bolt, flag, cone, person, bow, plat, house, shard } = RG.art._tw;
  const T = RG.art._tw.T;

  /* ---------- 기본(알 수 없는 탑) ---------- */
  T._placeholder = {
    muzzle: [[50, 40], [50, 36], [50, 30], [50, 26], [50, 26]],
    draw(c, v) {
      const g = '#9a9aa2';
      let o = plat(c, v === 'A' || v === 'B' ? 4 : v, { stone: '#a0a0a8' });
      const top = v === 'A' || v === 'B' ? 99 : 104;
      o += frus(c, 50, 50, top, 18, 24, c.cg(g), c.vg(c.h.shade(g, 0.2)));
      o += c.p('M44 70V62Q50 56 56 62V70Z', '#555', 2.4);
      o += c.ci(50, 36, 8, c.sg('#c8c8d0'), 3);
      return o;
    },
  };

  /* ---------------- 공개 함수 ---------------- */
  function vkey(level, branch) {
    if (level >= 4) return branch === 'B' ? 'B' : 'A';
    return level <= 1 ? 1 : level === 2 ? 2 : 3;
  }

  const wrap = (s, body) => `<g stroke="${OL}" stroke-width="${f(3 / s)}" stroke-linejoin="round" stroke-linecap="round"${s === 1 ? '' : ` transform="matrix(${s} 0 0 ${s} ${f(50 - 50 * s)} ${f(112 - 112 * s)})"`}>${body}</g>`;

  /** 탑 자세: idle(쉬는 중) · aim(쏘기 직전: 시위를 당김·힘을 모음) · fire(쏘는 순간: 놓음·반동·섬광) */
  RG.art.TOWER_POSES = ['idle', 'aim', 'fire'];

  RG.art.tower = function tower(type, level, branch, pose = 'idle') {
    const def = T[type] && type[0] !== '_' ? T[type] : T._placeholder;
    const v = vkey(Number(level) || 1, branch);
    const s = SC[v];
    const p = RG.art.TOWER_POSES.includes(pose) ? pose : 'idle';
    let c = Ctx(s, ELEM[type] || null);
    let body;
    try {
      body = def.draw(c, v, p);
    } catch (e) {
      if (RG.art._strict) throw e;
      c = Ctx(s, null);
      body = T._placeholder.draw(c, v);
    }
    return c.h.svg('0 0 100 130', c.defs.join(''), wrap(s, body));
  };

  /* 투사체 시작점: 틀 좌표 → 기준점 기준 칸 단위 */
  RG.art.TOWER_MUZZLE = {};
  Object.keys(T).forEach((id) => {
    if (id[0] === '_') return;
    RG.art.TOWER_MUZZLE[id] = T[id].muzzle.map(([x, y], i) => {
      const s = SC[VKEYS[i]];
      return [Math.round((x - 50) * s) / 100, Math.round((y - 112) * s) / 100];
    });
  });

  /* ---------------- 울림등 ---------------- */
  /*
   * 마을의 울림등: 흰 돌 받침 + 돌기둥 + 종 모양 지붕의 등불.
   * ratio(0~1)에 따라 빛 번짐 크기, 빛줄기 수, 유리·불꽃 밝기가 줄고,
   * 빛이 약하면 받침 둘레에 잿빛 안개가 낍니다.
   */
  RG.art.lantern = function lantern(ratio) {
    let r = Number(ratio);
    if (!Number.isFinite(r)) r = 1;
    r = Math.max(0, Math.min(1, r));
    const c = Ctx(1, 'light');
    const h = c.h;
    const ws = STONE.light;
    const glow = '#ffd77a';
    let o = '';
    // 빛 번짐 + 빛줄기
    if (r > 0.02) o += aura(c, 50, 42, 20 + 30 * r, 18 + 28 * r, glow, f(0.25 + 0.55 * r));
    const n = Math.floor(r * 8);
    let rays = '';
    for (let i = 0; i < n; i++) {
      const a = ((i * 360) / n - 67.5) * (Math.PI / 180);
      rays += `M${f(50 + Math.cos(a) * 25)} ${f(42 + Math.sin(a) * 23)}L${f(50 + Math.cos(a) * (32 + 10 * r))} ${f(42 + Math.sin(a) * (30 + 9 * r))}`;
    }
    if (rays) o += c.ln(rays, '#fff3c0', 3.2, f(0.4 + 0.5 * r));
    // 받침
    o += cyl(c, 50, 104, 112, 40, 12, c.cg(h.shade(ws, -0.12)), c.vg(ws, 0.2, -0.05));
    o += c.ln([-60, -20, 20, 60].map((d) => vseam(50, 104, 112, 40, 12, d)).join(''), h.shade(ws, -0.4), 1.5);
    o += cyl(c, 50, 95, 104, 29, 8.7, c.cg(ws), null);
    o += band(c, 50, 98, 101.5, 29, 8.7, c.vg(M.gold, 0.35, -0.25));
    o += c.e(50, 95, 29, 8.7, c.vg(h.shade(ws, 0.2), 0.2, 0));
    // 기둥
    o += cyl(c, 50, 62, 95, 7.5, 2.3, c.cg(ws), null);
    o += c.ln(`${ring(50, 72, 7.5, 2.3)}${ring(50, 86, 7.5, 2.3)}`, h.shade(ws, -0.35), 1.6);
    o += c.p('M38 64H62L58 58H42Z', c.vg(M.gold, 0.35, -0.25), 2.6);
    // 등불 몸통(유리)
    const gl = h.mix('#57536a', '#ffe9a0', r);
    const gg = c.def(`lg${gl}`, (id) => c.rgc(id, [[0, h.mix(gl, '#ffffff', 0.55 * r)], [0.6, gl], [1, h.shade(gl, -0.3)]], 0.5, 0.6, 0.6));
    o += frus(c, 50, 32, 57, 16, 12.5, gg, null);
    o += c.ln('M43.5 33.5L45 57.5M56.5 33.5L55 57.5', h.shade(M.bronze, -0.2), 2.6, 0.6);
    if (r > 0.02) o += flame(c, 50, 54, 6 + 4 * r, 6 + 14 * r);
    o += cyl(c, 50, 55, 59, 15, 4.5, c.cg(M.bronze), null) + c.e(50, 55, 15, 4.5, 'none', 2.4);
    // 종 모양 지붕
    o += c.p('M29 35Q33 31 37 29C37 18 43 12 50 12C57 12 63 18 63 29Q67 31 71 35Q50 41 29 35Z', c.cg(M.gold), 3);
    o += c.ln('M37 29Q50 33 63 29', h.shade(M.gold, -0.4), 1.6);
    o += c.ol('M50 12V7', M.bronze, 2) + c.ci(50, 5, 3, 'none', 2.4);
    // 처마 끝 작은 종
    o += c.ol('M30 36V39M70 36V39', M.bronze, 1.4) + c.p('M27 44Q27 38 30 38Q33 38 33 44Z', c.vg(M.gold, 0.3, -0.2), 1.8) + c.p('M67 44Q67 38 70 38Q73 38 73 44Z', c.vg(M.gold, 0.3, -0.2), 1.8);
    // 울림(소리 고리) — 빛이 충분할 때
    if (r >= 0.6) o += c.ln('M16 32Q12 42 16 52M84 32Q88 42 84 52M9 28Q4 42 9 56M91 28Q96 42 91 56', '#fff3c0', 2.2, f(0.5 * r));
    // 잿빛 안개 — 빛이 약할 때
    if (r < 0.6) {
      const a = f(Math.min(0.85, (0.6 - r) * 1.6));
      o += `<g opacity="${a}">${c.p('M6 112Q4 100 16 100Q20 92 30 98Q38 94 42 104Q30 110 18 114Q8 116 6 112Z', '#9c98a6', 2.4)}${c.p('M94 110Q98 98 86 98Q82 90 72 96Q64 94 62 104Q74 110 84 114Q92 114 94 110Z', '#9c98a6', 2.4)}${c.p('M30 124Q40 116 50 120Q62 114 72 122Q60 128 50 126Q40 130 30 124Z', '#8a8694', 2.2)}</g>`;
    }
    return h.svg('0 0 100 130', c.defs.join(''), wrap(1, o));
  };
})();

