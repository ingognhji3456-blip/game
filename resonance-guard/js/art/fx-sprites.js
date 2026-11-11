'use strict';

/* =========================================================
 * 효과 그림 (2026-11-11) — 탑 그림과 따로 움직이는 것들. 100×100, 가운데 (50,50).
 *  phoenix (불사조 둥지의 불사조, 오른쪽을 봄, 0 = 날개 위 · 1 = 날개 아래)
 *  boulder (거인의 바위가 굴리는 바위) · ironball (거인의 철구)
 *  렌더러가 RG.art.fxSprite(name, frame)로 불러 회전시키며 그림.
 * ========================================================= */
(() => {
  const { f, Ctx, fine, flame, spark } = RG.art._tw;
  const wrap = (body) => `<g stroke="#1c1426" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">${body}</g>`;

  /** 불사조: 몸·머리 볏·불꽃 꼬리·불꽃 날개 */
  function phoenix(c, frame) {
    const h = c.h;
    const up = frame === 0;
    let s = c.e(50, 52, 40, 30, c.ag('#ffb347', 0.45), 0);
    // 꼬리(왼쪽으로 흘러가는 불꽃 깃)
    s += c.p('M44 54Q28 50 10 40Q20 52 8 58Q22 58 12 70Q28 64 44 60Z', c.vg('#ff6a2a', 0.3, -0.2), 2.4);
    s += c.p('M42 56Q30 54 18 48Q26 56 20 62Q30 60 42 59Z', '#ffd27a', 0, ' opacity="0.9"');
    // 먼 날개
    const farW = up ? 'M54 46Q50 30 56 14Q60 24 66 18Q66 28 74 24Q70 36 76 36Q68 44 62 47Z' : 'M54 56Q50 72 56 88Q60 78 66 84Q66 74 74 78Q70 66 76 66Q68 58 62 55Z';
    s += c.p(farW, c.vg('#e0482a', 0.2, -0.25), 2.2);
    // 몸
    s += c.p('M40 56Q42 44 56 44Q70 44 74 50Q70 60 56 62Q44 62 40 56Z', c.vg('#ff7a2a', 0.35, -0.25), 2.6);
    s += c.p('M46 56Q50 50 60 51Q66 53 68 55Q60 60 52 59Q47 58 46 56Z', '#ffd27a', 0, ' opacity="0.85"');
    // 머리 + 볏 + 부리 + 눈
    s += c.p('M66 46Q66 36 76 36Q84 37 84 44Q82 50 74 51Z', c.vg('#ff8a3a', 0.35, -0.2), 2.4);
    s += c.p('M70 37Q66 26 72 20Q72 28 77 30Q76 22 82 18Q80 28 80 37Z', c.vg('#ffb347', 0.4, -0.2), 2);
    s += c.p('M83 42L93 45L83 47Z', c.vg('#ffd040', 0.3, -0.2), 1.8);
    s += c.ci(77, 42, 2.2, '#2a1018', 0) + c.ci(77.6, 41.4, 0.8, '#ffffff', 0);
    // 가까운 날개
    const nearW = up ? 'M50 50Q34 34 32 6Q42 16 46 10Q48 22 56 14Q56 26 64 22Q62 34 70 34Q64 44 62 50Z' : 'M50 54Q34 70 32 98Q42 88 46 94Q48 82 56 90Q56 78 64 82Q62 70 70 70Q64 60 62 54Z';
    s += c.p(nearW, c.vg('#ff6a2a', 0.35, -0.2), 2.4);
    const vein = up ? 'M54 48Q42 30 40 12M56 46Q52 30 54 16M58 46Q60 34 64 26' : 'M54 56Q42 74 40 92M56 58Q52 74 54 88M58 58Q60 70 64 78';
    s += c.ln(vein, '#ffe08a', 1.4, 0.85);
    s += spark(c, 20, 44, 2.6, '#fff1a8', 0) + spark(c, 14, 64, 2.2, '#ffd27a', 0);
    return s;
  }

  /** 바위: 모난 돌덩이(굴러도 모양이 보이도록 금·이끼) */
  function boulder(c) {
    const h = c.h;
    let s = c.p('M50 14L72 20L86 40L84 64L68 82L44 86L22 74L14 50L22 28Z', c.vg('#a89a84', 0.25, -0.35), 3);
    s += c.p('M50 14L72 20L62 34L44 30Z', c.vg('#c8bca8', 0.3, -0.1), 0, ' opacity="0.9"');
    s += c.p('M22 28L44 30L36 52L14 50Z', '#b8ac98', 0, ' opacity="0.7"');
    s += c.p('M68 82L84 64L66 60L56 76Z', h.shade('#a89a84', -0.3), 0, ' opacity="0.8"');
    s += c.ln('M44 30L36 52L46 70M36 52L18 60M62 34L66 60L84 64M66 60L56 76', h.shade('#a89a84', -0.45), 1.8, 0.9);
    s += c.p('M24 72Q30 66 38 74Q32 80 24 72Z', '#6a8a4a', 1.4);
    s += c.ci(40, 24, 3, '#ffffff', 0, ' opacity="0.35"');
    return s;
  }
  /** 철구: 쇠공 + 리벳 띠 + 가시 */
  function ironball(c) {
    let s = '';
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const x1 = 50 + Math.cos(a) * 34;
      const y1 = 50 + Math.sin(a) * 34;
      const x2 = 50 + Math.cos(a) * 46;
      const y2 = 50 + Math.sin(a) * 46;
      const px = -Math.sin(a) * 5;
      const py = Math.cos(a) * 5;
      s += c.p(`M${f(x1 + px)} ${f(y1 + py)}L${f(x2)} ${f(y2)}L${f(x1 - px)} ${f(y1 - py)}Z`, c.vg('#8a93a0', 0.3, -0.2), 2);
    }
    s += c.ci(50, 50, 36, c.sg('#5c6370'), 3);
    s += c.p('M14 50Q50 64 86 50Q50 58 14 50Z', '#3a4048', 1.6);
    s += [20, 35, 50, 65, 80].map((x) => c.ci(x, 50 + Math.sin(((x - 14) / 72) * Math.PI) * 6, 2, '#a8b0bc', 1)).join('');
    s += c.e(38, 34, 10, 6, '#ffffff', 0, ' opacity="0.3"');
    return s;
  }

  RG.art.fxSprite = function fxSprite(name, frame = 0) {
    const c = fine(Ctx(1, name === 'phoenix' ? 'fire' : 'earth'));
    const body = name === 'phoenix' ? phoenix(c, frame) : name === 'ironball' ? ironball(c) : boulder(c);
    return c.h.svg('0 0 100 100', c.defs.join(''), wrap(body));
  };
})();
