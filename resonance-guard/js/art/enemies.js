'use strict';

/* =========================================================
 * 적 그림 — 40종 + 보스 6종 (SVG 문자열)
 * 규격: docs/ARCHITECTURE.md §5
 *   RG.art.enemy(type, frame) — viewBox 0 0 100 100, 발 (50,90), 오른쪽을 바라봄
 *   frame 0·1: 걷기/날갯짓 2프레임. 그림자는 그리지 않음(렌더러 몫).
 * 외형: docs/design/enemies.md — 잿빛 몸 + 하얗게 빛나는 눈 + 지역 원소 색 포인트
 * ========================================================= */
(() => {
  const H = RG.art._h;
  const OL = H.OL;
  const sh = H.shade;

  /* ---------- 팔레트 ---------- */
  const GREY = '#8e8a9b';     // 안개에 물든 몸
  const GREY_L = '#c3c0cd';
  const MISTC = '#ebe8f4';    // 안개 김
  const HALO = '#f2f8ff';     // 눈 빛 번짐
  const GREEN = '#9fd45f';    // 1지역 들판
  const ICE = '#5fd4ff';      // 2지역 서리
  const ICE_L = '#c8f2ff';
  const EMBER = '#ff7a3d';    // 3지역 불씨
  const EMBER_L = '#ffc46b';
  const VOLT = '#9b8cff';     // 4지역 번개
  const SEA = '#3fbcb0';      // 4지역 바다
  const BELL = '#9a90b4';     // 5지역 대종(잿빛 보라)
  const GOLD = '#e2b650';
  const BRONZE = '#b48a4a';

  /* ---------- 그리기 문맥 ----------
   * 한 장의 SVG마다 하나. defs(그라데이션·필터) id는 uid로 고유하게.
   * 전체를 외곽선 스타일 <g>로 감싸므로, 각 도형은 fill만 주면 외곽선이 붙음.
   */
  function make(ow = 3) {
    const defs = [];
    let softId = null;
    let glowId = null;
    const c = {
      ow,
      /** 몸통용 방사형 그라데이션 (빛은 왼쪽 위) */
      body(base, hi = 0.4, lo = -0.36, cx = 0.34, cy = 0.28, r = 0.9) {
        const id = H.uid('e');
        defs.push(H.rg(id, [[0, sh(base, hi)], [0.5, base], [1, sh(base, lo)]], cx, cy, r));
        return `url(#${id})`;
      },
      /** 선형 그라데이션 */
      lin(stops, dir = 'v') {
        const id = H.uid('e');
        defs.push(H.lg(id, stops, dir));
        return `url(#${id})`;
      },
      tri(base, dir = 'v') {
        const id = H.uid('e');
        defs.push(H.tri(id, base, dir));
        return `url(#${id})`;
      },
      rad(stops, cx = 0.5, cy = 0.5, r = 0.5) {
        const id = H.uid('e');
        defs.push(H.rg(id, stops, cx, cy, r));
        return `url(#${id})`;
      },
      /** 부드러운 흐림 필터 속성 (빛 번짐, 안개용) */
      soft() {
        if (!softId) { softId = H.uid('ef'); defs.push(H.blur(softId, 2.2)); }
        return `filter="url(#${softId})"`;
      },
      glow() {
        if (!glowId) { glowId = H.uid('eg'); defs.push(H.glow(glowId, 1.6)); }
        return `filter="url(#${glowId})"`;
      },
      /* --- 도형 (외곽선 자동) --- */
      P: (d, fill, x = '') => `<path d="${d}" fill="${fill}"${x}/>`,
      /** 외곽선 없는 도형 */
      Pn: (d, fill, op) => `<path d="${d}" fill="${fill}" stroke="none"${op != null ? ` opacity="${op}"` : ''}/>`,
      E: (cx, cy, rx, ry, fill, x = '') => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}"${x}/>`,
      En: (cx, cy, rx, ry, fill, op) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="none"${op != null ? ` opacity="${op}"` : ''}/>`,
      /** 선만 (금, 무늬) */
      L: (d, col = OL, w = 2, x = '') => `<path d="${d}" fill="none" stroke="${col}" stroke-width="${w}"${x}/>`,
      /** 외곽선 있는 굵은 선 (다리, 꼬리, 팔) */
      limb(d, w, col) {
        return `<path d="${d}" fill="none" stroke-width="${w + 2 * ow}"/><path d="${d}" fill="none" stroke="${col}" stroke-width="${w}"/>`;
      },
      /** 엉덩이(x,y)에서 땅으로 내려오는 다리. 발바닥 외곽선이 정확히 y=90에 닿음 */
      leg(x, y, dx, w, col, lift = 0, bend = 0) {
        const fy = H.n(90 - w / 2 - ow - lift);
        const fx = x + dx;
        const d = bend ? `M${x} ${y}Q${H.n((x + fx) / 2 + bend)} ${H.n((y + fy) / 2)} ${fx} ${fy}` : `M${x} ${y}L${fx} ${fy}`;
        return c.limb(d, w, col);
      },
      /** 땅에 닿는 발(타원) — 바닥이 y=90 */
      foot(x, rx, ry, fill, lift = 0) {
        return c.E(x, H.n(90 - ry - ow / 2 - lift), rx, ry, fill);
      },
      /** 하얗게 빛나는 눈 */
      eye(x, y, r, ring = true) {
        return `<circle cx="${x}" cy="${y}" r="${H.n(r * 2)}" fill="${HALO}" opacity=".5" stroke="none" ${c.soft()}/>` +
          `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff"${ring ? ` stroke-width="${H.n(Math.max(1.6, ow * 0.7))}"` : ' stroke="none"'}/>`;
      },
      /** 빛나는 점(불씨, 전기 등) */
      spark(x, y, r, col) {
        return `<circle cx="${x}" cy="${y}" r="${H.n(r * 2.2)}" fill="${col}" opacity=".55" stroke="none" ${c.soft()}/>` +
          `<circle cx="${x}" cy="${y}" r="${r}" fill="${sh(col, 0.55)}" stroke="none"/>`;
      },
      /** 안개 김: [[x,y,r], ...] */
      mist(pts, col = MISTC, op = 0.75) {
        return `<g fill="${col}" stroke="none" opacity="${op}">${pts.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('')}</g>`;
      },
      /** 구름·안개 덩어리: 원들을 하나의 외곽선으로 합침 [[x,y,r], ...] */
      cloud(pts, fill, op) {
        const cs = pts.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('');
        return `<g${op != null ? ` opacity="${op}"` : ''}><g fill="${OL}" stroke-width="${ow * 2}">${cs}</g><g fill="${fill}" stroke="none">${cs}</g></g>`;
      },
      /** 왼쪽 위 반짝임 */
      shine(cx, cy, rx, ry, op = 0.45, rot = -25) {
        return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#fff" stroke="none" opacity="${op}" transform="rotate(${rot} ${cx} ${cy})"/>`;
      },
      out(body) {
        return H.svg('0 0 100 100', defs.join(''),
          `<g stroke="${OL}" stroke-width="${ow}" stroke-linejoin="round" stroke-linecap="round">${body}</g>`);
      },
    };
    return c;
  }

  const g = (body, t = '') => (t ? `<g transform="${t}">${body}</g>` : body);
  /** 지그재그 번개 경로 */
  const zig = (pts) => `M${pts.map((p) => p.join(' ')).join('L')}`;

  /* 지역 파일(enemies-*.js)이 쓰는 공용 도구와 적 목록 */
  RG.art._en = { H, OL, sh, GREY, GREY_L, MISTC, HALO, GREEN, ICE, ICE_L, EMBER, EMBER_L, VOLT, SEA, BELL, GOLD, BRONZE, make, g, zig, D: {}, MOTION: {} };
  /**
   * 몬스터별 움직임·죽음 연출 (렌더러가 읽음, docs/design/animation.md §2.5)
   * MOTION[type] = { gait, bob, tilt, sway, squash, hover, deathFx, deathTime }
   */
  RG.art.ENEMY_MOTION = RG.art._en.MOTION;
})();
