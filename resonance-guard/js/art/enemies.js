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

  /* ---------- 4차: 색을 틀어 밝히고 어둡게 (docs/design/animation.md §7.2) ----------
   * 밝은 면은 따뜻한 빛 쪽으로, 그늘은 검정이 아니라 푸른 보라(차가운 색·회색) 또는 붉은 보라(따뜻한 색) 쪽으로.
   */
  const LIGHT_W = '#fff4dc';
  const DARK_C = '#1d1d4a';   // 차가운 그늘(푸른 보라)
  const DARK_W = '#3b1534';   // 따뜻한 그늘(붉은 보라)
  function isWarm(c) {
    const [r, gg, b] = H.hexToRgb(c);
    const mx = Math.max(r, gg, b);
    const mn = Math.min(r, gg, b);
    if (mx - mn < 18) return false;          // 회색은 차갑게(안개 빛)
    let hue;
    if (mx === r) hue = ((gg - b) / (mx - mn)) * 60;
    else if (mx === gg) hue = (2 + (b - r) / (mx - mn)) * 60;
    else hue = (4 + (r - gg) / (mx - mn)) * 60;
    if (hue < 0) hue += 360;
    return hue < 75 || hue > 320;
  }
  /** amt −1~1: +는 따뜻한 빛으로 밝게, −는 색을 틀어 어둡게 */
  const hs = (c, amt) => (amt >= 0 ? H.mix(c, LIGHT_W, amt) : H.mix(c, isWarm(c) ? DARK_W : DARK_C, Math.min(1, -amt * 1.08)));
  /** 안쪽 선 색: 그 자리 색의 어두운 변형 (§7.1) */
  const ink = (c, amt = 0.55) => H.mix(c, isWarm(c) ? '#2a1024' : '#161230', amt);

  /** 바깥 윤곽(실루엣) 필터: 불투명한 부분만 골라 둥글게 부풀린 뒤 윤곽색으로 칠함. r = 윤곽이 면 밖으로 나오는 폭 */
  function silFilter(id, r) {
    const z = 1.4;                       // 흐림 문턱 0.08에 해당하는 거리 배수
    const sd = H.n(Math.max(0.3, r / z));
    const [R, G, B] = H.hexToRgb(OL).map((v) => H.n(v / 255 * 1000) / 1000);
    return `<filter id="${id}" x="-8%" y="-8%" width="116%" height="116%" color-interpolation-filters="sRGB">` +
      '<feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 24 -21.8"/>' +
      `<feGaussianBlur stdDeviation="${sd}"/>` +
      `<feColorMatrix type="matrix" values="0 0 0 0 ${R} 0 0 0 0 ${G} 0 0 0 0 ${B} 0 0 0 12 -0.96"/></filter>`;
  }

  /* ---------- 그리기 문맥 ----------
   * 한 장의 SVG마다 하나. defs(그라데이션·필터) id는 uid로 고유하게.
   * 전체를 외곽선 스타일 <g>로 감싸므로, 각 도형은 fill만 주면 외곽선이 붙음.
   * opt.fine (4차 섬세 모드, 고르는 파일만): 바깥 윤곽은 실루엣 필터로 진하게 한 번만, 도형마다 붙던 선은
   *   반투명 윤곽색(그 자리 색의 어두운 변형)으로 가늘게(ow×0.58) — 스티커처럼 보이던 안쪽 선이 사라짐.
   *   몸통 그라데이션(body·tri)도 색을 틀어 밝히고 어둡게(hs). 불투명도 0.9 이하인 도형(안개·궤적·빛)은 윤곽이 붙지 않음.
   *   opt.edge: 실루엣 윤곽 폭(기본 ow×0.5), opt.inner: 안쪽 선 진하기(기본 0.5)
   */
  function make(ow = 3, opt = null) {
    const fine = !!(opt && opt.fine);
    const shd = fine ? hs : sh;
    const defs = [];
    let softId = null;
    let glowId = null;
    const c = {
      ow,
      /** 몸통용 방사형 그라데이션 (빛은 왼쪽 위) */
      body(base, hi = 0.4, lo = -0.36, cx = 0.34, cy = 0.28, r = 0.9) {
        const id = H.uid('e');
        defs.push(H.rg(id, [[0, shd(base, hi)], [0.5, base], [1, shd(base, lo)]], cx, cy, r));
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
        defs.push(fine ? H.lg(id, [[0, hs(base, 0.35)], [0.55, base], [1, hs(base, -0.4)]], dir) : H.tri(id, base, dir));
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
      /** 하얗게 빛나는 눈 (fine: 선 대신 어두운 눈구멍과 대비로 — 가장 밝은 점이 되게) */
      eye(x, y, r, ring = true) {
        if (fine) {
          const so = H.n(r + Math.max(0.9, r * 0.36));
          return `<circle cx="${x}" cy="${y}" r="${H.n(r * 2.1)}" fill="${HALO}" opacity=".55" stroke="none" ${c.soft()}/>` +
            (ring ? `<circle cx="${x}" cy="${y}" r="${so}" fill="#1a1430" stroke="none"/>` : '') +
            `<circle cx="${x}" cy="${y}" r="${r}" fill="#ffffff" stroke="none"/>` +
            `<path d="M${H.n(x + r * 0.95)} ${H.n(y - r * 0.2)}A${r} ${r} 0 0 1 ${H.n(x - r * 0.2)} ${H.n(y + r * 0.95)}A${H.n(r * 0.8)} ${H.n(r * 0.8)} 0 0 0 ${H.n(x + r * 0.95)} ${H.n(y - r * 0.2)}Z" fill="#cfe2ff" stroke="none" opacity=".75"/>`;
        }
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
      fine,
      out(body) {
        if (fine) {
          const bid = H.uid('eb');
          const fid = H.uid('es');
          defs.push(silFilter(fid, (opt.edge != null ? opt.edge : ow * 0.5)));
          const a = opt.inner != null ? opt.inner : 0.5;
          return H.svg('0 0 100 100', defs.join(''),
            `<use href="#${bid}" filter="url(#${fid})"/>` +
            `<g id="${bid}" stroke="rgba(22,16,40,${a})" stroke-width="${H.n(ow * 0.58)}" stroke-linejoin="round" stroke-linecap="round">${body}</g>`);
        }
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
  RG.art._en = { H, OL, sh, hs, ink, isWarm, GREY, GREY_L, MISTC, HALO, GREEN, ICE, ICE_L, EMBER, EMBER_L, VOLT, SEA, BELL, GOLD, BRONZE, make, g, zig, D: {}, MOTION: {} };
  /**
   * 몬스터별 움직임·죽음 연출 (렌더러가 읽음, docs/design/animation.md §2.5)
   * MOTION[type] = { gait, bob, tilt, sway, squash, hover, deathFx, deathTime }
   */
  RG.art.ENEMY_MOTION = RG.art._en.MOTION;
})();
