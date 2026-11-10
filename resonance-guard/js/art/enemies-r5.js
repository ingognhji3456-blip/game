'use strict';

/* =========================================================
 * 적 그림 — 5지역 깨진 대종 (공용 도구: enemies.js)
 * 동작 개정(docs/design/animation.md §2.2·§2.5·§2.6):
 *   적마다 walk0~3(걸음 한 바퀴) · aim(휘두르기 직전) · attack(때리는 순간) · die0~2(죽음) 9장.
 *   인물형은 "관절 표"(자세 → 골반 위치·몸 기울기·발목·손·무기 각도)를 두고
 *   같은 그리기 함수가 표를 읽어 그립니다. 팔·다리는 두 마디(역운동학)로 이어 그립니다.
 *   빛은 왼쪽 위. 몸통의 형태 그림자·팔이 드리운 그늘은 그리고, 바닥 그림자는 그리지 않음(렌더러 몫).
 * ========================================================= */
(() => {
  const { H, OL, EMBER, ICE, VOLT, BELL, GOLD, BRONZE, g } = RG.art._en;
  const D = RG.art._en.D;
  const MOTION = RG.art._en.MOTION || (RG.art._en.MOTION = {});
  const n = H.n;

  /* =========================================================
   * 4차 다듬기(animation.md §7) — 이 파일 전용 그리기 문맥 mk()
   *  · 선(§7.1): 그림 전체를 두 번 그림. ① 실루엣 판: 모든 단단한 도형을 윤곽색(OL)으로 굵게 칠해
   *    바깥 윤곽만 남김 ② 색 판: 도형마다 "그 자리 색의 어두운 변형"으로 가는 안쪽 선(외곽의 60%).
   *    → 바깥은 진한 윤곽, 안쪽 이음매·주름은 색이 비친 가는 선(스티커 느낌이 사라짐).
   *    실루엣 판에서 빠지는 것: 외곽선 없는 도형(stroke="none"), 반투명(opacity), 빛 번짐(filter),
   *    선만 있는 도형(fill="none"), class="x".
   *  · 명암(§7.2): 몸통 그라데이션은 밝은 면(따뜻한 햇빛 섞음) → 바탕 → 그늘(색을 틀어 푸른/붉은 보라 쪽)
   *    → 가장자리 반사광(보랏빛 폐허가 비친 빛) 네 단계. 빛은 늘 왼쪽 위.
   * ========================================================= */
  const SUN = '#fff4dc';      // 왼쪽 위 햇빛
  const AMB = '#b4a2ee';      // 보랏빛 폐허에서 되비치는 반사광
  const SH_COOL = '#1e1646';  // 차가운 색의 그늘(푸른 보라)
  const SH_WARM = '#4a1634';  // 따뜻한 색의 그늘(붉은 보라)
  const BASE = {};            // 그라데이션 id → 바탕색 (안쪽 선 색·명암 계산용)
  const hexOf = (col) => {
    if (!col || col === 'none') return null;
    if (col[0] === '#') return col;
    const m = /^url\(#([^)]+)\)$/.exec(col);
    return m ? BASE[m[1]] || null : null;
  };
  const isWarm = (hex) => { const [r, , b] = H.hexToRgb(hex); return r - b > 22; };
  /** 색을 틀어 어둡게(따뜻한 색은 붉은 보라, 차가운 색은 푸른 보라 쪽) */
  const dk = (col, t) => { const h = hexOf(col) || '#8a849c'; return H.mix(h, isWarm(h) ? SH_WARM : SH_COOL, Math.min(1, t)); };
  /** 햇빛을 섞어 밝게 */
  const lt = (col, t) => H.mix(hexOf(col) || '#8a849c', SUN, Math.min(1, t));
  /** shade 대신: −는 색을 튼 그늘, +는 햇빛 */
  const sh = (col, amt) => (amt >= 0 ? lt(col, amt) : dk(col, -amt * 1.05));
  /** 안쪽 선 색: 그 자리 색의 어두운 변형 */
  const lineC = (col) => H.mix(dk(col, 0.62), OL, 0.2);
  /** 반사광 색: 그늘에 보랏빛 폐허 빛이 비침 */
  const rimC = (col, t = 0.5) => H.mix(dk(col, 0.2), AMB, t);
  const LINE_DEF = '#3e3352';

  function mk(ow = 2.5) {
    const defs = [];
    const kid = H.uid('k');
    let softId = null;
    let glowId = null;
    const reg = (id, col) => { BASE[id] = hexOf(col) || col; return `url(#${id})`; };
    /** 안쪽 선: x에 stroke=가 있으면 그대로, 선만 있는 도형은 윤곽색, 나머지는 채움색의 어두운 변형 */
    const sk = (fill, x = '') => {
      if (/(^|\s)stroke="/.test(x)) return x;
      if (fill === 'none') return ` stroke="${OL}"${x}`;
      const h = hexOf(fill);
      return ` stroke="${h ? lineC(h) : LINE_DEF}"${x}`;
    };
    const c = {
      ow,
      body(b, hi = 0.4, lo = -0.36, cx = 0.34, cy = 0.28, r = 0.9) {
        const id = H.uid('e');
        const S = dk(b, -lo * 1.12);
        defs.push(H.rg(id, [[0, lt(b, hi * 0.95)], [0.46, b], [0.8, S], [1, H.mix(S, AMB, 0.34)]], cx, cy, r));
        return reg(id, b);
      },
      lin(stops, dir = 'v') {
        const id = H.uid('e');
        defs.push(H.lg(id, stops, dir));
        return reg(id, stops[Math.floor((stops.length - 1) / 2)][1]);
      },
      tri(b, dir = 'v') {
        const id = H.uid('e');
        defs.push(H.lg(id, [[0, lt(b, 0.35)], [0.55, b], [1, dk(b, 0.42)]], dir));
        return reg(id, b);
      },
      rad(stops, cx = 0.5, cy = 0.5, r = 0.5) {
        const id = H.uid('e');
        defs.push(H.rg(id, stops, cx, cy, r));
        return reg(id, stops[Math.floor((stops.length - 1) / 2)][1]);
      },
      soft() {
        if (!softId) { softId = H.uid('ef'); defs.push(H.blur(softId, 2.2)); }
        return `filter="url(#${softId})"`;
      },
      glow() {
        if (!glowId) { glowId = H.uid('eg'); defs.push(H.glow(glowId, 1.6)); }
        return `filter="url(#${glowId})"`;
      },
      P: (d, fill, x = '') => `<path d="${d}" fill="${fill}"${sk(fill, x)}/>`,
      Pn: (d, fill, op) => `<path d="${d}" fill="${fill}" stroke="none"${op != null ? ` opacity="${op}"` : ''}/>`,
      E: (cx, cy, rx, ry, fill, x = '') => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}"${sk(fill, x)}/>`,
      En: (cx, cy, rx, ry, fill, op) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="none"${op != null ? ` opacity="${op}"` : ''}/>`,
      L: (d, col = OL, w = 2, x = '') => `<path d="${d}" fill="none" stroke="${col}" stroke-width="${w}"${x}/>`,
      limb(d, w, col) {
        return `<path d="${d}" fill="none" stroke="${OL}" stroke-width="${w + 2 * ow * 0.75}"/><path d="${d}" fill="none" stroke="${col}" stroke-width="${w}"/>`;
      },
      eye(x, y, r, ring = true) {
        return `<circle cx="${x}" cy="${y}" r="${n(r * 2.1)}" fill="#f2f8ff" opacity=".55" stroke="none" ${c.soft()}/>` +
          `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff"${ring ? ` stroke="${OL}" stroke-width="${n(Math.max(1.4, ow * 0.6))}"` : ' stroke="none"'}/>`;
      },
      spark(x, y, r, col) {
        return `<circle cx="${x}" cy="${y}" r="${n(r * 2.2)}" fill="${col}" opacity=".55" stroke="none" ${c.soft()}/>` +
          `<circle cx="${x}" cy="${y}" r="${r}" fill="${lt(col, 0.55)}" stroke="none"/>`;
      },
      mist(pts, col = '#ebe8f4', op = 0.75) {
        return `<g fill="${col}" stroke="none" opacity="${op}">${pts.map(([x, y, r]) => `<circle cx="${n(x)}" cy="${n(y)}" r="${n(r)}"/>`).join('')}</g>`;
      },
      cloud(pts, fill, op) {
        const cs = pts.map(([x, y, r]) => `<circle cx="${n(x)}" cy="${n(y)}" r="${n(r)}"/>`).join('');
        return `<g${op != null ? ` opacity="${op}"` : ''}><g fill="${OL}" stroke="${OL}" stroke-width="${ow * 1.6}">${cs}</g><g fill="${fill}" stroke="none">${cs}</g></g>`;
      },
      shine(cx, cy, rx, ry, op = 0.45, rot = -25) {
        return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#fff" stroke="none" opacity="${op}" transform="rotate(${rot} ${cx} ${cy})"/>`;
      },
      out(body) {
        const ws = n(ow * 1.42);
        const css = `<style>.${kid} *{fill:${OL}!important;stroke:${OL}!important;stroke-width:${ws}px!important}` +
          `.${kid} [stroke="none"],.${kid} [opacity],.${kid} [filter],.${kid} [fill="none"],.${kid} .x{display:none}</style>`;
        return H.svg('0 0 100 100', defs.join(''),
          `${css}<g class="${kid}" stroke-linejoin="round" stroke-linecap="round">${body}</g>` +
          `<g stroke="${LINE_DEF}" stroke-width="${n(ow * 0.6)}" stroke-linejoin="round" stroke-linecap="round">${body}</g>`);
      },
    };
    return c;
  }
  const make = mk;

  /* ---------- 좌표 도우미 ---------- */
  const RAD = Math.PI / 180;
  const pt = (p) => `${n(p[0])} ${n(p[1])}`;
  /** 점 p에서 각도 a(도, 0=오른쪽, 90=아래)로 l만큼 */
  const pol = (p, a, l) => [p[0] + Math.cos(a * RAD) * l, p[1] + Math.sin(a * RAD) * l];
  const mid = (a, b, t = 0.5) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const angOf = (a, b) => Math.atan2(b[1] - a[1], b[0] - a[0]) / RAD;
  const tr = (p, a = 0, s = 1) => `translate(${pt(p)})${a ? ` rotate(${n(a)})` : ''}${s !== 1 ? ` scale(${n(s)})` : ''}`;
  const SHADE = '#1c1426';
  /** 안쪽 세부(문양·끈·구슬)는 가는 외곽선 — 굵은 외곽선에 묻히지 않게 */
  const TH = ' stroke-width="1.3"';

  /**
   * 두 마디 관절(역운동학): 시작 s에서 끝 e까지 마디 길이 l1·l2.
   * 관절(무릎·팔꿈치)은 pref 방향 쪽으로 굽음. 닿지 않으면 곧게 편 채 끝을 향함.
   */
  function ik(s, e, l1, l2, pref) {
    const dx = e[0] - s[0];
    const dy = e[1] - s[1];
    const dist = Math.hypot(dx, dy) || 0.001;
    const d = Math.min(Math.max(dist, Math.abs(l1 - l2) + 0.01), l1 + l2 - 0.01);
    const ux = dx / dist;
    const uy = dy / dist;
    const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
    const m = [s[0] + ux * a, s[1] + uy * a];
    const c1 = [m[0] - uy * h, m[1] + ux * h];
    const c2 = [m[0] + uy * h, m[1] - ux * h];
    const d1 = (c1[0] - m[0]) * pref[0] + (c1[1] - m[1]) * pref[1];
    const d2 = (c2[0] - m[0]) * pref[0] + (c2[1] - m[1]) * pref[1];
    return d1 >= d2 ? c1 : c2;
  }

  /** 끝이 둥근 마디(굵기가 r1→r2로 줄어듦). 외곽선은 감싸는 <g>가 붙임 */
  function seg(c, a, b, r1, r2, fill, x = '') {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const L = Math.hypot(dx, dy) || 0.001;
    const nx = -dy / L;
    const ny = dx / L;
    const p1 = [a[0] + nx * r1, a[1] + ny * r1];
    const p2 = [b[0] + nx * r2, b[1] + ny * r2];
    const p3 = [b[0] - nx * r2, b[1] - ny * r2];
    const p4 = [a[0] - nx * r1, a[1] - ny * r1];
    return c.P(`M${pt(p1)}L${pt(p2)}A${n(r2)} ${n(r2)} 0 0 0 ${pt(p3)}L${pt(p4)}A${n(r1)} ${n(r1)} 0 0 0 ${pt(p1)}Z`, fill, x);
  }
  /** 외곽선 없는 마디(그늘·하이라이트용) */
  function segN(c, a, b, r1, r2, fill, op) {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const L = Math.hypot(dx, dy) || 0.001;
    const nx = -dy / L;
    const ny = dx / L;
    const p1 = [a[0] + nx * r1, a[1] + ny * r1];
    const p2 = [b[0] + nx * r2, b[1] + ny * r2];
    const p3 = [b[0] - nx * r2, b[1] - ny * r2];
    const p4 = [a[0] - nx * r1, a[1] - ny * r1];
    return c.Pn(`M${pt(p1)}L${pt(p2)}A${n(r2)} ${n(r2)} 0 0 0 ${pt(p3)}L${pt(p4)}A${n(r1)} ${n(r1)} 0 0 0 ${pt(p1)}Z`, fill, op);
  }

  /** 몸 좌표계: 골반 (px,py)에서 lean(도, +는 앞으로 숙임)만큼 기울어짐. p(x,y) → 화면 좌표 */
  function frameOf(px, py, lean) {
    const cs = Math.cos(lean * RAD);
    const sn = Math.sin(lean * RAD);
    return { t: tr([px, py], lean), p: (x, y) => [px + x * cs - y * sn, py + x * sn + y * cs] };
  }

  /** 쥔 주먹: 자루 방향 a에 직각으로 감싼 손가락 + 손등 하이라이트 */
  function fist(c, p, r, fill, a = 0) {
    return g(
      c.P(`M${n(-r)} ${n(-r * 0.9)}Q${n(-r)} ${n(-r * 1.25)} 0 ${n(-r * 1.2)}Q${n(r * 1.05)} ${n(-r * 1.15)} ${n(r * 1.05)} 0Q${n(r * 1.05)} ${n(r * 1.15)} 0 ${n(r * 1.2)}Q${n(-r)} ${n(r * 1.25)} ${n(-r)} ${n(r * 0.9)}Z`, fill) +
      c.L(`M${n(r * 0.35)} ${n(-r * 0.9)}V${n(r * 0.9)}`, sh(fill, -0.4), 1.5),
      tr(p, a));
  }

  /**
   * 장화·발: 발목 a, 발 길이 len, 발목~바닥 h, 기울기 tilt(+: 발끝이 아래로).
   * 땅에 닿은 발은 발목 y = 88.5 − h (바닥 외곽선이 y=90).
   */
  function boot(c, a, len, h, tilt, fill, plate = false) {
    const t = h * 0.55;
    const d = `M${n(-len * 0.26)} ${n(-t)}L${n(len * 0.16)} ${n(-t)}C${n(len * 0.3)} ${n(h * 0.15)} ${n(len * 0.66)} ${n(h * 0.25)} ${n(len * 0.74)} ${n(h * 0.72)}Q${n(len * 0.76)} ${n(h)} ${n(len * 0.56)} ${n(h)}L${n(-len * 0.3)} ${n(h)}Q${n(-len * 0.36)} ${n(h * 0.2)} ${n(-len * 0.26)} ${n(-t)}Z`;
    const sole = c.Pn(`M${n(-len * 0.3)} ${n(h - 1.6)}L${n(len * 0.66)} ${n(h - 1.6)}L${n(len * 0.6)} ${n(h)}L${n(-len * 0.3)} ${n(h)}Z`, SHADE, 0.45);
    const lam = plate ? c.L(`M${n(len * 0.05)} ${n(-t * 0.2)}Q${n(len * 0.3)} ${n(h * 0.25)} ${n(len * 0.55)} ${n(h * 0.35)}`, sh(fill, -0.35), 1.5) : '';
    return g(c.P(d, fill) + lam + sole, tr(a, tilt));
  }

  /** 땅에 닿은 발목 높이 */
  const groundAnkle = (h) => 88.5 - h;

  /** 다리 하나: 엉덩이 hip, 발목 [x, 들림, 기울기], 마디 길이, 굵기, 색. knee 반환 */
  function leg(c, hip, foot, o) {
    const ankle = foot.length > 3 ? [foot[0], foot[3]] : [foot[0], groundAnkle(o.h) - foot[1]];
    const knee = ik(hip, ankle, o.l1, o.l2, o.pref || [1, -0.2]);
    let s = seg(c, hip, knee, o.r1, o.r2, o.thigh) + seg(c, knee, ankle, o.r2, o.r3, o.shin);
    if (o.shade !== false) s += segN(c, mid(knee, ankle, 0.1), ankle, o.r2 * 0.5, o.r3 * 0.5, SHADE, 0.18);
    if (o.kneecap) s += o.kneecap(knee, angOf(hip, knee));
    s += boot(c, ankle, o.len, o.h, foot[2] || 0, o.boot, o.plate);
    return { svg: s, knee, ankle };
  }

  /** 팔 하나: 어깨 s → 손 hand. 팔꿈치 반환 */
  function arm(c, s, hand, o) {
    const el = ik(s, hand, o.l1, o.l2, o.pref || [-0.4, 1]);
    const svg = seg(c, s, el, o.r1, o.r2, o.upper) + seg(c, el, hand, o.r2, o.r3, o.fore);
    return { svg, el };
  }

  /** 2차 베지어 위의 점들 (꼬리·목·촉수 뼈대) */
  function bez(p0, p1, p2, k = 10) {
    const out = [];
    for (let i = 0; i <= k; i++) {
      const t = i / k;
      const u = 1 - t;
      out.push([u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]]);
    }
    return out;
  }
  /** 뼈대 점들을 따라 굵기가 r0→r1로 줄어드는 매끈한 띠(꼬리·목·촉수). rf(i,t)로 굵기를 바꿀 수 있음 */
  function ribbon(c, pts, r0, r1, fill, x = '', rf = null) {
    const L = [];
    const R = [];
    const k = pts.length - 1;
    for (let i = 0; i <= k; i++) {
      const a = pts[Math.max(0, i - 1)];
      const b = pts[Math.min(k, i + 1)];
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const l = Math.hypot(dx, dy) || 1;
      const r = rf ? rf(i / k) : r0 + (r1 - r0) * (i / k);
      L.push([pts[i][0] - (dy / l) * r, pts[i][1] + (dx / l) * r]);
      R.push([pts[i][0] + (dy / l) * r, pts[i][1] - (dx / l) * r]);
    }
    const re = Math.max(rf ? rf(1) : r1, 0.3);
    const rs = Math.max(rf ? rf(0) : r0, 0.3);
    return c.P(`M${L.map(pt).join('L')}A${n(re)} ${n(re)} 0 0 0 ${R.slice().reverse().map(pt).join('L')}A${n(rs)} ${n(rs)} 0 0 0 ${pt(L[0])}Z`, fill, x);
  }

  /** 움직임 선(잔상) */
  const streaks = (c, lines, col = '#f2eefa', w = 2, op = 0.7) =>
    `<g fill="none" stroke="${col}" stroke-width="${w}" opacity="${op}" stroke-linecap="round">${lines.map((d) => `<path d="${d}"/>`).join('')}</g>`;
  /** 휘두른 자국(초승달 모양 빛) */
  const swoosh = (c, d, col = '#f2eefa', op = 0.55) => c.Pn(d, col, op);
  /** 재·안개 알갱이 */
  const motes = (c, pts, col = '#b8b0c8', op = 0.8) => `<g fill="${col}" stroke="none" opacity="${op}">${pts.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('')}</g>`;
  /** 마무리: 발 기준점(50,90)을 중심으로 k배 키워 내보냄 */
  const fin = (c, s, k = 1) => c.out(k === 1 ? s : g(s, `translate(50 90) scale(${k}) translate(-50 -90)`));
  /** 납작하게 눕힌 물건(땅에 놓인 방패 등): 중심 p, 각도 a, 세로 눌림 sy */
  const flat = (body, p, a, sy) => `<g transform="translate(${pt(p)}) scale(1 ${sy})"><g transform="rotate(${n(a)})">${body}</g></g>`;

  /* ---------- 4차 다듬기 세부 도우미 (§7.2·§7.3) ---------- */
  /** 반짝점(금속·보석·눈·물기): 외곽선 없는 흰 점 */
  const spec = (x, y, r = 0.8, op = 0.95) => `<circle cx="${n(x)}" cy="${n(y)}" r="${n(r)}" fill="#ffffff" stroke="none" opacity="${op}"/>`;
  /** 반사광 띠: 그늘 쪽 가장자리에 보랏빛 폐허 빛이 비친 가는 밝은 선 */
  const rimL = (c, d, col, w = 1.2, op = 0.85) => c.L(d, rimC(col), w, ` opacity="${op}"`);
  /** 접촉 그늘(맞닿는 곳의 작고 진한 그늘) */
  const ao = (c, d, op = 0.3) => c.Pn(d, SHADE, op);
  /** 안쪽 가는 선(이음매·주름): 그 자리 색의 어두운 변형 */
  const inl = (c, d, col, w = 1.1, x = '') => c.L(d, lineC(col), w, x);
  /** 빛 번짐 원(색 빛) */
  const bloom = (c, x, y, r, col, op = 0.4) => `<circle cx="${n(x)}" cy="${n(y)}" r="${n(r)}" fill="${col}" opacity="${n(op)}" stroke="none" ${c.soft()}/>`;

  /* ==== BEGIN grey_legionnaire ==== */
  /* =========================================================
   * 33 · 회색 군단병 — 얼굴 없는 통투구·회색 판갑·종 문양 방패·창. 발맞춰 행진.
   * 가까운 팔(오른팔)=창, 먼 팔(왼팔)=방패. 가까운 다리 = 오른다리.
   * 죽음: 맞고 뒤로 휘청 → 무릎 꿇고 방패·창을 떨굼 → 속 빈 갑옷이 와르르 무너져 투구가 굴러감.
   * ========================================================= */
  const LEGION = {
    //       골반          기울기  가까운 발 [발목x,들림,기울기(,발목y)]  먼 발      창 손      창 각도  방패 [x,y,각도]  머리 기울기
    walk0: { p: [43, 63.5], lean: 2, nf: [53, 0, 0], ff: [34, 1.5, 24], hand: [37, 57], spear: -95, sh: [60, 57, 3], head: 0 },
    walk1: { p: [43, 61.6], lean: 2, nf: [43, 0, 0], ff: [48, 7, 14], hand: [39, 56], spear: -92, sh: [61, 55, 1], head: 0 },
    walk2: { p: [43, 63.5], lean: 2, nf: [33, 1.5, 24], ff: [53, 0, 0], hand: [41, 57], spear: -88, sh: [62, 57, -1], head: 0 },
    walk3: { p: [43, 61.6], lean: 2, nf: [48, 7, 14], ff: [43, 0, 0], hand: [39, 56], spear: -92, sh: [61, 55, 1], head: 0 },
    aim: { p: [40, 64], lean: -9, nf: [30, 0, 6], ff: [55, 0, 0], hand: [30, 23], spear: -9, sh: [61, 53, -6], head: -4 },
    attack: { p: [42, 65.5], lean: 14, nf: [25, 1, 26], ff: [58, 0, 0], hand: [56, 47], spear: 9, sh: [57, 64, 12], head: 4 },
    die0: { p: [41, 63], lean: -17, nf: [30, 5, 22], ff: [50, 0, 0], hand: [26, 47], spear: -128, sh: [57, 63, 20], head: -18 },
    die1: { p: [41, 73], lean: 12, nf: [27, 0, 62, 86], ff: [55, 0, 0], hand: [46, 74], spear: null, sh: null, head: 34 },
  };

  function drawLegionnaire(fr) {
    const c = make(2.5);
    const steel = '#9694ad';
    const steelL = sh(steel, 0.32);
    const steelD = sh(steel, -0.3);
    const mail = '#5a4f88';       // 갑옷 밑 누빔옷(보랏빛 남색) — 회색 판갑과 색 대비
    const FAR = -0.2;
    const P = LEGION[fr];
    const legO = (far) => ({
      l1: 13, l2: 13, r1: 4.6, r2: 3.6, r3: 3, h: 4.6, len: 11, plate: true,
      thigh: c.body(sh(mail, far ? FAR : 0), 0.3, -0.3), shin: c.body(sh(steel, far ? FAR : 0), 0.38, -0.3),
      boot: c.body(sh(steelD, far ? FAR : 0), 0.32, -0.3),
      kneecap: (k, a) => g(c.P('M-3.6 -2.6Q0 -5 3.6 -2.6L3.2 2.4Q0 4 -3.2 2.4Z', c.body(sh(steelL, far ? FAR : 0), 0.45, -0.25)) +
        inl(c, 'M-3 0.6Q0 2 3 0.6', steel, 0.8) + spec(-1.3, -2, 0.8), tr(k, a - 90)),
    });

    /* 창: 쥔 곳 기준 뒤 20 · 앞 37. 나뭇결 자루 + 가죽 감개, 등날이 선 창날(위는 밝고 아래는 어두움), 금 소켓·물미 */
    const spear = (hand, a) => {
      const butt = pol(hand, a + 180, 20);
      const neck = pol(hand, a, 28);
      const off = (p, k) => pol(p, a + 90, k);
      return seg(c, butt, neck, 1.8, 1.7, c.lin([[0, '#a88660'], [0.5, '#7c5c40'], [1, '#4e3828']], 'h')) +
        c.L(`M${pt(off(pol(butt, a, 3), -0.5))}L${pt(off(pol(butt, a, 13), -0.5))}M${pt(off(pol(hand, a, 5), 0.4))}L${pt(off(pol(hand, a, 18), 0.4))}`, '#c9a67a', 0.7, ' opacity=".7"') +
        c.L(`M${pt(pol(hand, a + 180, 3.6))}L${pt(pol(hand, a + 180, 8.4))}`, '#3a2a22', 2.6) +
        c.L(`M${pt(off(pol(hand, a + 180, 4), -1.1))}L${pt(off(pol(hand, a + 180, 5), 1.1))}M${pt(off(pol(hand, a + 180, 6), -1.1))}L${pt(off(pol(hand, a + 180, 7), 1.1))}`, '#7a5a40', 0.8) +
        g(c.P('M-1 -2.8L3 -3.6Q9 -3.8 11.4 0Q9 3.8 3 3.6L-1 2.8Z', c.lin([[0, '#fbfaff'], [0.48, '#cfcce0'], [0.5, '#8e8aa8'], [1, '#5c5878']])) +
          c.L('M2.4 0H10.6', '#ffffff', 0.7, ' opacity=".75"') + c.L('M3 -2.9Q8.6 -3.1 10.6 -0.4', '#ffffff', 0.6, ' opacity=".6"') +
          c.P('M-2.6 -2.8L0.8 -2.8L0.8 2.8L-2.6 2.8Z', c.body(GOLD, 0.35, -0.3), TH) + inl(c, 'M-0.9 -2.6V2.6', GOLD, 0.7) +
          spec(7.6, -1.6, 0.7), tr(neck, a)) +
        c.E(n(butt[0]), n(butt[1]), 2, 2, c.body(GOLD, 0.3, -0.3)) + spec(butt[0] - 0.6, butt[1] - 0.7, 0.55);
    };

    /* 방패: 휜 강철 면(가로 그라데이션) + 금 테두리(빗면 밝음·어두움) + 종 문양(좌우 대칭) + 리벳 반짝점 + 긁힌 자국·찍힌 홈 */
    const shield = () =>
      c.P('M-9.5 -16Q-9.5 -18.5 -6.5 -18.5L6.5 -18.5Q9.5 -18.5 9.5 -16L9.5 16Q9.5 18.5 6.5 18.5L-6.5 18.5Q-9.5 18.5 -9.5 16Z', c.lin([[0, '#d6d3e6'], [0.3, '#a9a5c0'], [0.75, '#6e6a8a'], [1, '#4a4664']], 'h')) +
      c.Pn('M3.5 -18L9 -16L9 16L3.5 18Z', SHADE, 0.18) +
      rimL(c, 'M8.4 -14.6V14.6', '#55516a', 1.1, 0.7) +
      c.L('M-7 -15.5H7V15.5H-7Z', GOLD, 2) + c.L('M-7.6 15V-16.1H6.4', '#fff0b8', 0.7, ' opacity=".85"') + c.L('M7.6 -15V16.1H-6.4', dk(GOLD, 0.45), 0.8) +
      c.P('M0 -9C-3.6 -9 -4.6 -5.6 -4.6 -2L-6 2.6L6 2.6L4.6 -2C4.6 -5.6 3.6 -9 0 -9Z', c.body(GOLD, 0.4, -0.38), TH) +
      inl(c, 'M-4.8 0.4H4.8', GOLD, 0.8) + inl(c, 'M0 -9V-10.6', GOLD, 1.2) +
      c.E(0, 4.8, 1.8, 1.8, c.body(GOLD, 0.25), TH) + c.L('M-3 -6Q-2.5 -7.8 -0.5 -8', '#fff6d0', 1.3) + spec(-2.4, -6.4, 0.6) +
      [[-5, -12.5], [5, -12.5], [-5, 12.5], [5, 12.5], [0, -14.4], [0, 14.4]].map(([x, y]) => c.En(x, y, 1.1, 1.1, dk(GOLD, 0.2)) + spec(x - 0.35, y - 0.4, 0.4)).join('') +
      inl(c, 'M-8.4 7L-5 9L-6 12M3 9.6L5.6 11', '#6e6a8a', 0.9) + c.En(-2.6, 10.6, 1.3, 0.8, SHADE, 0.25);

    /* 통투구: 가로 눈 틈만 하얗게 빛남(lit=false면 꺼진 빈 투구), 금 볏(빗면 선), 숨구멍, 리벳, 반사광 */
    const helm = (lit = true) =>
      c.P('M-9 -9C-10 -16 -3 -18.5 2 -18.5C9 -18.5 11.5 -13 11.5 -6L11.5 3.5C8 6 -4 6 -8.5 3.5Z', c.body(steel, 0.5, -0.38)) +
      rimL(c, 'M10.6 -10C11 -6 11 -1 10.4 2.6', steel, 1.1) +
      c.P('M-7 -14.5C-6.5 -25 6.5 -27.5 10.5 -15.5L6.6 -14.6C4.6 -19.6 -1 -20 -2.6 -13.6Z', c.body(GOLD, 0.45, -0.38)) +
      c.L('M-4.6 -17.6C-2.6 -22.6 4.6 -23.6 7.6 -18.6', '#fff3c4', 1.3, ' opacity=".85"') +
      inl(c, 'M-5.2 -14.8C-4.6 -21.6 4 -24.4 8.6 -16.6', GOLD, 0.8) + spec(-1.6, -21.4, 0.7) +
      c.L('M-8.6 -4.5C-3 -3 5 -3 11.4 -4.5', steelD, 1.4) +
      ao(c, 'M-8.6 -4C-3 -2.5 5 -2.5 11.4 -4L11.4 3.5C8 6 -4 6 -8.6 3.5Z', 0.2) +
      (lit
        ? `<path d="M3.2 -8.4H11.4" stroke="#e8e4ff" stroke-width="7" opacity=".55" ${c.soft()}/>` + c.L('M3.5 -8.4H11', '#ffffff', 2.4) + spec(10.4, -8.4, 0.9)
        : c.L('M3.5 -8.4H11', '#241c30', 2.4)) +
      c.En(5.6, -2, 0.55, 0.55, '#2a2236') + c.En(7.6, -1.8, 0.55, 0.55, '#2a2236') + c.En(9.6, -1.8, 0.55, 0.55, '#2a2236') +
      c.En(-1, 0.6, 0.9, 0.9, steelD) + c.En(3.4, 1.2, 0.9, 0.9, steelD) + c.En(7.8, 1.2, 0.9, 0.9, steelD) +
      c.shine(-3.5, -11, 2.2, 4.6, 0.55, 15) + spec(-4.4, -13.2, 0.9);

    /* 흉갑(몸 좌표: 골반 (0,0), 위가 −): 가운데 능선(밝음/어두움), 배판 겹침, 금 테 + 리벳, 반사광, 찍힌 자국 */
    const cuirass = () =>
      c.P('M-9.5 -1C-11.5 -8 -11.5 -18 -8.5 -23C-3 -26.5 6 -26.5 9.5 -23C12.5 -17 12.5 -8 9.5 -1Z', c.body(steel, 0.48, -0.4)) +
      c.L('M3.5 -24.5C5.5 -17 5.5 -8 3.8 -1.5', steelD, 1.5) +
      c.L('M3 -24C4.6 -17 4.6 -9 3.6 -3', steelL, 1.1, ' opacity=".7"') +
      c.Pn('M5 -24C10 -23 12.5 -17 12 -9L9.5 -1L5 -1.5C6 -8 6 -17 5 -24Z', SHADE, 0.18) +
      inl(c, 'M-10 -8.6C-4 -6.8 4 -6.8 11.4 -8.8', steel, 1) + c.L('M-10 -7.8C-4 -6 4 -6 11 -8', steelL, 0.7, ' opacity=".6"') +
      rimL(c, 'M11.2 -19C12 -14 12 -8 10.4 -2.4', steel, 1.2) +
      c.L('M-8 -21.5C-3 -24 5 -24.2 9 -21.8', GOLD, 2) + c.L('M-7.6 -22.3C-3 -24.7 5 -24.9 8.6 -22.6', '#fff0b8', 0.6, ' opacity=".8"') +
      [-5, -0.6, 3.8].map((x) => c.En(x, -22.6 - (x < 0 ? 0.2 : 0), 0.55, 0.55, dk(GOLD, 0.3))).join('') +
      inl(c, 'M6.6 -15l1.6 1.4', steel, 0.8) +
      c.shine(-5, -16, 2.4, 5, 0.45, 10) + spec(-5.8, -18.6, 0.9);
    /* 허리띠 + 판 치마(태싯) + 앞에 늘어진 보랏빛 천(금 단 장식) */
    const skirt = () =>
      c.P('M-10 -4.5L10.2 -4.5L10.6 -0.5L-10.4 -0.5Z', c.lin([[0, '#6a5240'], [1, '#3a2a24']]), TH) +
      inl(c, 'M-9.6 -3.3H10.2', '#6a5240', 0.6, ' stroke-dasharray="1.2 1.2"') +
      c.P('M-11 -0.5L11 -0.5L12.6 10L-12.4 10Z', c.body(sh(steel, -0.06), 0.36, -0.32)) +
      inl(c, 'M-5 0L-5.6 10M0.5 0V10M6 0L6.5 10', steel, 1.1) + c.L('M-4.2 0.4L-4.7 9.6M1.3 0.4V9.6M6.8 0.4L7.2 9.6', steelL, 0.6, ' opacity=".55"') +
      ao(c, 'M-11 6L12.2 6L12.6 10L-12.4 10Z', 0.2) + ao(c, 'M-11 -0.5L11 -0.5L11.2 1.4L-11.2 1.4Z', 0.35) +
      [-8, -2.3, 3.3, 9].map((x) => c.En(x, 3.6, 0.9, 0.9, dk(GOLD, 0.15)) + spec(x - 0.3, 3.3, 0.35)).join('') +
      c.P('M-3.4 -0.6L3.4 -0.6L4.4 12.6L0.6 14.6L-3.4 12.4Z', c.body(mail, 0.35, -0.35)) +
      c.L('M-3 11.2L0.6 13L4 11.4', GOLD, 1) + inl(c, 'M0.4 0L0.8 12', mail, 0.8) +
      c.P('M1.5 -5.2L5.5 -5.2L5.5 0.2L1.5 0.2Z', c.body(GOLD, 0.35, -0.32), TH) + inl(c, 'M2.6 -2.5H4.4', GOLD, 0.8) + spec(2.3, -4.3, 0.45);
    const pauldronAt = (p, a) => g(
      c.P('M-6 -3C-6 -8 2 -9.5 6 -5L5.5 2C2 0 -3 0 -6 2Z', c.body(steelL, 0.38, -0.38)) +
      c.L('M-5.5 -1C-2 -3 2 -3 5.5 -1', steelD, 1.2) + c.L('M-5.6 -3.4C-2 -7.2 2.6 -7.6 5.4 -4.6', GOLD, 1) +
      rimL(c, 'M5.2 -3.6L5 1.2', steelL, 0.9) + spec(-2.6, -5.6, 0.7), tr(p, a));

    let s = '';
    if (fr === 'die2') {
      /* 남은 모습: 속 빈 갑옷 더미. 창은 땅에, 방패는 눕고, 흉갑은 뒤로 넘어지고, 투구는 앞으로 굴러감 */
      s += spear([30, 86.4], -2);
      s += flat(shield(), [36, 84], 90, 0.5);
      s += seg(c, [22, 85], [33, 86.5], 3.2, 2.8, c.body(sh(steel, -0.1), 0.3)) + boot(c, [17, 84.5], 11, 4, -70, c.body(steelD, 0.3), true);
      s += g(skirt(), tr([52, 82], -84, 0.95));
      s += g(cuirass() + c.P('M-4 -27L6 -27L6.5 -23L-4.5 -23Z', mail), tr([48, 84], -78, 0.95));
      s += pauldronAt([44, 78], -40);
      s += g(helm(false), tr([72, 80], 96));
      s += seg(c, [61, 87], [70, 86.5], 3.4, 3, c.body(steel, 0.3));
      s += c.mist([[46, 70, 3], [51, 64, 2.4], [56, 58, 1.8], [72, 70, 2.2], [75, 64, 1.6]], '#cfc8dc', 0.55);
      s += motes(c, [[40, 74, 1], [60, 72, 0.9], [66, 66, 0.8], [50, 58, 0.7]], '#efeaf8', 0.8);
      return fin(c, s, 1.06);
    }

    const B = frameOf(P.p[0], P.p[1], P.lean);
    const farHip = B.p(3, -1);
    const nearHip = B.p(-2.5, 1);
    const farSh = B.p(5.5, -22.5);
    const nearSh = B.p(-6.5, -21);
    const lf = leg(c, farHip, P.ff, legO(true));
    const ln = leg(c, nearHip, P.nf, legO(false));
    const shC = P.sh ? [P.sh[0], P.sh[1]] : null;
    // 먼 팔(방패 팔): 위팔만 보이고 아래팔·손은 방패 뒤 손잡이를 쥠
    const farHand = shC || B.p(14, -6);
    const farArm = arm(c, farSh, farHand, { l1: 11, l2: 10, r1: 3.6, r2: 3, r3: 2.8, upper: sh(mail, FAR), fore: c.body(sh(steel, FAR), 0.3), pref: [-0.2, 1] });
    const torso = g(
      c.P('M6 -23C9 -26 13 -25 13.5 -21L12 -17L6 -18Z', c.body(sh(steel, FAR), 0.3)) +
      cuirass() + skirt() +
      c.P('M-4 -27L6 -27L6.5 -23L-4.5 -23Z', mail, TH) +
      c.Pn('M-4 -24.5L6.5 -24.5L6.5 -23L-4.5 -23Z', SHADE, 0.3) +
      g(helm(fr !== 'die1'), tr([1.5, -31], P.head)),
      B.t);
    const nearArm = arm(c, nearSh, P.hand, { l1: 12, l2: 11, r1: 3.8, r2: 3.2, r3: 2.9, upper: mail, fore: c.body(steel, 0.35, -0.3), pref: fr === 'aim' || fr === 'die0' ? [-1, 0.2] : [-0.5, 1] });

    if (fr === 'die1') {
      // 떨어지는 창(뒤로 넘어감)과 앞으로 엎어지는 방패
      s += spear(pol([62, 87], -142, 20), -142);
    }
    s += lf.svg + (shC ? farArm.svg : '') + ln.svg + torso;
    if (!shC) s += farArm.svg + fist(c, farHand, 2.8, c.body(sh(steel, FAR), 0.3), 60);
    if (shC) s += g(shield(), tr(shC, P.sh[2]));
    if (fr === 'die1') s += g(shield(), tr([75, 70.5], 44));
    // 팔이 몸통에 드리운 그늘(빛이 왼쪽 위 → 오른쪽 아래로)
    s += segN(c, [nearSh[0] + 2.5, nearSh[1] + 3], [nearArm.el[0] + 2.5, nearArm.el[1] + 2], 3, 2.4, SHADE, 0.16);
    if (P.spear != null) s += spear(P.hand, P.spear);
    s += nearArm.svg + pauldronAt(nearSh, angOf(nearSh, nearArm.el) - 90) + fist(c, P.hand, 3, c.body(steel, 0.3, -0.3), (P.spear == null ? 70 : P.spear) + 90);

    if (fr === 'aim') {
      const tip = pol(P.hand, P.spear, 37);
      s += c.spark(n(tip[0]), n(tip[1]), 1.5, '#ffffff');
    }
    if (fr === 'attack') {
      const tip = pol(P.hand, P.spear, 37);
      s += streaks(c, [`M${pt(pol(tip, 189, 20).map((v, i) => v - (i ? 4 : 0)))}L${pt(pol(tip, 189, 34).map((v, i) => v - (i ? 4 : 0)))}`,
        `M${pt(pol(tip, 189, 16).map((v, i) => v + (i ? 4.5 : 0)))}L${pt(pol(tip, 189, 27).map((v, i) => v + (i ? 4.5 : 0)))}`], '#efeaff', 1.6, 0.55);
      s += c.spark(n(tip[0]), n(tip[1]), 1.8, '#ffffff');
    }
    if (fr === 'die0') {
      // 가슴판에 금이 가며 잿빛 김이 새어 나옴
      const hit = B.p(4, -15);
      s += c.L(`M${pt(hit)}l3 -3l-1 -3l3 -2M${pt(hit)}l2 3l4 1`, '#f4f0ff', 1.6) + c.mist([[hit[0] + 6, hit[1] - 3, 2.6], [hit[0] + 9, hit[1] - 7, 2], [hit[0] + 4, hit[1] - 8, 1.6]], '#d8d2e6', 0.7);
    }
    if (fr === 'die1') {
      // 목 틈으로 잿빛 김이 빠져나감
      const nk = B.p(1, -27);
      s += c.mist([[nk[0] - 1, nk[1] - 5, 2.6], [nk[0] - 4, nk[1] - 10, 2.2], [nk[0] - 2, nk[1] - 15, 1.6]], '#d8d2e6', 0.65);
    }
    return fin(c, s, 1.06);
  }
  D.grey_legionnaire = (fr) => drawLegionnaire(LEGION[fr] || fr === 'die2' ? fr : 'walk0');
  D.grey_legionnaire.frames = true;
  // 발맞춘 행진: 보폭 일정, 위아래는 작게, 몸은 곧음
  MOTION.grey_legionnaire = { gait: 'march', bob: 0.02, tilt: 1.5, deathFx: 'mist', deathTime: 0.8 };
  /* ==== END grey_legionnaire ==== */

  /* ==== BEGIN hush_monk ==== */
  /* =========================================================
   * 34 · 침묵 수도사 — 두건 달린 회색 법복, 입을 가린 천, 목에 큰 염주,
   *   손에는 추를 천으로 묶은 "소리 없는 종". 발이 법복 밑으로 살짝 보이는 조용한 종종걸음.
   * aim: 종을 머리 위로 들고 다른 손 검지를 입가리개에 댐("쉿").
   * attack: 종을 앞으로 휘둘러 침묵의 물결(소리 없는 고리)을 내보냄.
   * 죽음: 몸이 꺾이며 종을 놓침 → 법복이 속부터 재로 비어 내려앉음 → 빈 법복 더미와 굴러간 종.
   * ========================================================= */
  const MONK = {
    //       골반         기울기  가까운 발         먼 발            종 손      종 각도(0=아래로 매달림)  먼 손(염주)   머리
    walk0: { p: [46, 61.5], lean: 6, nf: [55, 0, 0], ff: [38, 1.2, 22], hand: [38, 57], bell: 10, fh: [57, 51], head: 2 },
    walk1: { p: [46, 60.2], lean: 6, nf: [46, 0, 0], ff: [50, 4.5, 12], hand: [41, 56.5], bell: 2, fh: [57, 50], head: 2 },
    walk2: { p: [46, 61.5], lean: 6, nf: [37, 1.2, 22], ff: [55, 0, 0], hand: [45, 57], bell: -9, fh: [58, 51], head: 2 },
    walk3: { p: [46, 60.2], lean: 6, nf: [50, 4.5, 12], ff: [46, 0, 0], hand: [41, 56.5], bell: 2, fh: [57, 50], head: 2 },
    aim: { p: [44, 61], lean: -7, nf: [36, 0, 4], ff: [55, 0, 0], hand: [39, 33], bell: 138, fh: [55, 41], head: -6 },
    attack: { p: [46, 62], lean: 15, nf: [33, 1, 20], ff: [59, 0, 0], hand: [62, 49], bell: -100, fh: [32, 60], head: 8 },
    die0: { p: [45, 65], lean: 26, nf: [40, 0, 0], ff: [55, 0, 0], hand: [50, 74], bell: null, fh: [55, 52], head: 30 },
  };

  function drawMonk(fr) {
    const c = make(2.5);
    const robe = '#8a84a2';
    const robeD = sh(robe, -0.28);
    const robeL = sh(robe, 0.28);
    const mantle = '#5e507e';     // 어깨 망토: 짙은 자두빛(몸통 회색과 대비)
    const sash = '#6c3a5c';       // 허리 끈: 바랜 포도주빛
    const veil = '#e6e0ec';
    const skin = '#b5aec4';
    const bead = '#5e4434';       // 나무 염주
    const bronze = '#c9a85a';
    const trim = '#b89a5c';       // 법복 단의 바랜 금실
    const P = MONK[fr];

    /* 소리 없는 종: 쥔 곳(0,0)에서 +y로 매달림. 추는 흰 천으로 묶여 입 밖으로 늘어짐 */
    const bell = (loose = false) => g(
      c.P('M-1.3 -2.5L1.3 -2.5L1.4 4.5L-1.4 4.5Z', '#6a5040', TH) +
      c.E(0, 5.2, 2.4, 1.3, c.body(sh(bronze, -0.1), 0.3), TH) +
      c.P('M-3.4 6C-3.6 9 -5 12.5 -6.6 15.2Q0 17.6 6.6 15.2C5 12.5 3.6 9 3.4 6Q0 4.6 -3.4 6Z', c.body(bronze, 0.45, -0.38)) +
      c.Pn('M1.6 6.2C2.8 9 3.8 12.5 5.6 15.4Q4 16.2 2.2 16.4C2.4 12.8 2 9 1.6 6.2Z', SHADE, 0.22) +
      inl(c, 'M-5.4 13.4Q0 15.2 5.4 13.4', bronze, 1) + inl(c, 'M-3.6 7.6Q0 6.6 3.6 7.6', bronze, 0.7) +
      c.L('M-2.4 7.4Q-3.2 9.8 -4.2 12', '#fff2c0', 1.2, ' opacity=".9"') + spec(-2.6, 8.4, 0.6) +
      c.En(2.6, 12.6, 1.2, 0.8, '#6fa89a', 0.7) + c.En(-1, 14.6, 0.9, 0.5, '#6fa89a', 0.6) +
      (loose
        ? c.P('M-0.9 16L0.9 16L1.3 19L-1.3 19Z', '#e8e2f0', TH) + c.L('M1 17.4Q4.6 19.4 7.6 18', '#e8e2f0', 1.4)
        : c.P('M-4.5 9.2Q0 10.6 4.5 9.2L4.8 11.4Q0 12.8 -4.8 11.4Z', '#f1ecf8', ' stroke-width="1.1"') +
          c.P('M-1.1 16L1.1 16L1.7 21.2Q0 22.4 -1.7 21.2Z', '#f1ecf8', ' stroke-width="1.1"')),
      'scale(1.3)');

    /* 두건 + 얼굴(어둠 속 하얀 눈) + 입가리개. 머리 좌표: 머리 중심 (0,0) */
    const hood = (eyes = 1, empty = false) =>
      c.P('M-10 6C-12 -2 -13 -8 -15 -12C-9 -13 -6 -14 0 -14C8 -14.5 12.5 -8 12 0L12.5 7C8 10 -4 10.5 -10 6Z', c.body(robe, 0.4, -0.36)) +
      inl(c, 'M-13 -11C-9 -8 -7 -3 -6.6 2', robe, 1.1) + c.L('M-12.4 -11.8C-8.6 -9 -6.6 -4 -6 1', robeL, 0.7, ' opacity=".6"') +
      c.P('M2 -9.5C6.5 -10 10.5 -7 11 -2L11.6 6.2L1.6 6.8C3.6 2 3.6 -5 2 -9.5Z', c.rad([[0, '#3e3656'], [0.6, '#1c1428'], [1, '#0e0816']], 0.7, 0.45, 0.75)) +
      c.L('M1.2 -9.8C3.4 -4.6 3.4 2 1 6.8', robeL, 1.1, ' opacity=".8"') +
      (empty ? '' :
        bloom(c, 8.4, -3.4, 4.2, '#d8d0ff', 0.45 * eyes) +
        c.eye(6.6, -3.4, 1.65 * eyes, false) + c.eye(10.2, -3.2, 1.4 * eyes, false) +
        c.P('M2.6 -0.4C5.6 -1.8 9.6 -1.6 12.4 -0.8L13 5.4Q10.4 9.6 6 8.8Q3 8 2.2 6.6Z', c.body(veil, 0.32, -0.3), ' stroke-width="1.4"') +
        inl(c, 'M2.8 0.6C5.6 -0.6 9.6 -0.4 12.4 0.4', veil, 0.9) +
        inl(c, 'M6.2 0.4Q7 4 5.8 8.2M9.8 0.6Q10.6 4 9.6 8.4', veil, 0.8) + c.L('M5.2 0.6Q5.8 4 4.8 7.6', '#ffffff', 0.6, ' opacity=".7"')) +
      c.L('M-6 -9C-2 -12 3 -12.4 7 -10.6', robeL, 1.3, ' opacity=".75"') +
      inl(c, 'M-9 2C-6 5 -2 6.4 2 6.6', robe, 1.2) + rimL(c, 'M-9.4 4.6C-5.6 7.6 1 8.6 6 7.8', robe, 1) +
      c.shine(-3, -8, 1.6, 3.2, 0.3, 20);

    /* 염주(목에 건 큰 구슬, 가운데 하나는 금빛) — 몸 좌표 */
    const beadsNeck = () => [[-6, -17.5], [-2.6, -15.8], [1.2, -15.2], [5, -16], [8.2, -17.6]].map(([x, y], i) =>
      c.E(x, y, 1.9, 1.9, i === 2 ? c.body(GOLD, 0.35) : c.body(bead, 0.35), TH)).join('');

    let s = '';

    if (fr === 'die2' || fr === 'die1') {
      /* 빈 법복이 내려앉음(die1: 반쯤 무너져 재가 쏟아짐, die2: 납작한 천 더미) */
      const d1 = fr === 'die1';
      const pile = d1
        ? 'M22 88.5C22 80 28 70 36 64C40 56 46 50 52 50C58 50 62 56 63 63C70 68 76 78 77 88.5Z'
        : 'M14 88.5C16 84 24 80 34 79C42 76 52 76 60 78C70 79 80 82 84 88.5Z';
      s += c.P(pile, c.body(robe, 0.35, -0.38));
      s += d1
        ? c.L('M34 70Q38 80 36 88M48 58Q46 72 50 88M60 66Q64 76 64 88', robeD, 1.6) + c.P('M30 72Q46 76 66 71L67 75Q46 80 29 76Z', '#5a4a6a')
        : c.L('M26 83Q34 81 40 84M48 80Q56 82 62 81M68 83Q74 84 78 87', robeD, 1.6) + c.P('M24 84Q46 81 74 84L74 87Q46 84 24 87Z', '#5a4a6a');
      // 쭈그러진 빈 두건 (눈빛 꺼짐)
      s += g(hood(0, true), d1 ? tr([56, 50], 40, 0.95) : tr([50, 80], 82, 0.85));
      if (d1) {
        // 소매에서 재가 쏟아짐
        s += seg(c, [36, 64], [26, 76], 3.8, 5.4, c.body(robe, 0.3)) + c.E(25, 77.5, 4.6, 2.4, '#2a2236');
        s += c.cloud([[60, 40, 3.4], [57, 33, 2.8], [61, 27, 2.2], [57, 22, 1.6]], '#8a8494', 0.75);
        s += motes(c, [[24, 81, 1.6], [22, 85, 1.3], [27, 86, 1.1], [64, 34, 1.1], [54, 28, 1], [63, 20, 0.9], [44, 46, 1.2], [66, 44, 0.9]], '#5a5460', 0.9);
        s += g(bell(false), tr([66, 83], -80));
      } else {
        s += motes(c, [[40, 72, 1.3], [50, 66, 1.1], [58, 60, 0.9], [46, 56, 0.8], [64, 70, 1]], '#7a7484', 0.8);
        // 구르던 종이 멈추고 천이 풀림 — 처음으로 작은 소리
        s += g(bell(true), tr([64, 83.5], -88));
        s += `<path d="M90 76q3 3 0 6M93.5 74q4 5 0 10" fill="none" stroke="${GOLD}" stroke-width="1.6" opacity=".7"/>`;
        s += [[30, 86], [36, 87.4], [44, 87.6]].map(([x, y]) => c.E(x, y, 1.8, 1.6, c.body(bead, 0.35), TH)).join('');
      }
      return fin(c, s, 1.06);
    }

    const B = frameOf(P.p[0], P.p[1], P.lean);
    const nearSh = B.p(-6, -19.5);
    const farSh = B.p(6.5, -20.5);
    const legO = (far) => ({ l1: 12.5, l2: 12, r1: 3.6, r2: 3, r3: 2.4, h: 3.6, len: 9, thigh: sh(robeD, far ? -0.2 : 0), shin: sh('#5a5468', far ? -0.2 : 0), boot: c.body(sh('#4a4458', far ? -0.15 : 0), 0.3), shade: false });
    const lf = leg(c, B.p(2.5, -0.5), P.ff, legO(true));
    const ln = leg(c, B.p(-2.5, 0.5), P.nf, legO(false));

    // 법복 자락: 앞으로 내디딘 다리가 천을 밀어냄
    const xs = [lf.ankle[0], ln.ankle[0]];
    const back = Math.min(...xs) - 5.5;
    const front = Math.max(...xs) + 6;
    const lifted = Math.max(P.nf[1], P.ff[1]);
    const hemB = [back, 84.6];
    const hemF = [front, 83.6 - lifted * 0.5];
    const wB = B.p(-10, -1);
    const wF = B.p(10.5, -2);
    const sB = B.p(-9, -19);
    const sF = B.p(9, -20);
    const kneeF = (P.nf[0] > P.ff[0] ? ln.knee : lf.knee);
    const robePath = `M${pt(sB)}C${pt(B.p(-12, -12))} ${pt(B.p(-12, -5))} ${pt(wB)}C${pt([wB[0] - 3, wB[1] + 10])} ${pt([back - 1, 78])} ${pt(hemB)}` +
      `Q${n(back + (front - back) * 0.25)} ${n(87)} ${n(back + (front - back) * 0.42)} ${n(85.4)}Q${n(back + (front - back) * 0.62)} ${n(87.2)} ${n(back + (front - back) * 0.8)} ${n(85)}Q${n(front - 1)} ${n(85.6)} ${pt(hemF)}` +
      `C${n(kneeF[0] + 4)} ${n(kneeF[1] + 6)} ${n(kneeF[0] + 4.5)} ${n(kneeF[1] - 3)} ${pt([wF[0] + 1, wF[1] + 4])}` +
      `C${pt(B.p(13, -8))} ${pt(B.p(12, -16))} ${pt(sF)}Z`;
    const torso =
      c.P(robePath, c.body(robe, 0.35, -0.38)) +
      c.L(`M${pt(B.p(-4, 2))}Q${n(back + 5)} 76 ${n(back + (front - back) * 0.3)} 85.4M${pt(B.p(3, 2))}Q${n(kneeF[0] - 1)} ${n(kneeF[1] + 4)} ${n(back + (front - back) * 0.62)} 86`, robeD, 1.6) +
      c.Pn(`M${pt(B.p(6, -18))}C${pt(B.p(12, -12))} ${pt(B.p(12, -4))} ${pt([wF[0] + 1, wF[1] + 4])}C${n(kneeF[0] + 4.5)} ${n(kneeF[1] - 3)} ${n(kneeF[0] + 4)} ${n(kneeF[1] + 6)} ${pt(hemF)}L${n(front - 6)} 85Q${n(kneeF[0])} ${n(kneeF[1] + 2)} ${pt(B.p(5, -2))}Z`, SHADE, 0.18) +
      g(
        // 어깨 망토(겹친 천) + 염주 + 허리 끈
        c.P('M-10 -18C-8 -23 8 -24 11 -18L12 -11C6 -8 -4 -8 -10.5 -11Z', c.body(mantle, 0.3, -0.3)) +
        c.L('M-8 -12C-3 -10 5 -10 10.5 -12', sh(mantle, -0.3), 1.4) +
        beadsNeck() +
        c.P('M-10.5 -4L10.8 -5L11 -1.6L-10.6 -0.8Z', '#5a4a6a') +
        c.P('M5 -3C6 0 6 4 5 8L7.6 8C8.4 4 8.2 0 7.4 -3Z', '#5a4a6a', TH) + c.E(6.3, 9.2, 1.9, 1.5, '#5a4a6a', TH),
        B.t) +
      g(hood(1), tr(B.p(3.5, -29), P.lean + P.head));

    // 먼 팔(염주 손 / 쉿 손): 몸 앞에 있으니 몸통 다음에 그림
    const armSvg = (s0, hand, far) => {
      const el = ik(s0, hand, 11, 10, fr === 'aim' && far ? [1, 0.4] : [-0.5, 1]);
      const col = sh(robe, far ? -0.18 : 0);
      const cuff = pol(hand, angOf(hand, el), 3.4);
      const a = angOf(el, cuff);
      const w1 = pol(cuff, a + 90, 6.2);
      const w2 = pol(cuff, a - 90, 6.2);
      const e1 = pol(el, a + 90, 3.9);
      const e2 = pol(el, a - 90, 3.9);
      return seg(c, s0, el, 4.6, 4, col) +
        c.P(`M${pt(e1)}L${pt(w1)}Q${pt(pol(cuff, a, 1.8))} ${pt(w2)}L${pt(e2)}Z`, c.body(col, 0.3, -0.3)) +
        c.L(`M${pt(pol(el, a + 90, 1))}L${pt(pol(cuff, a + 90, 2.4))}`, sh(col, -0.3), 1.3);
    };

    s += lf.svg + ln.svg + torso;
    // 먼 손
    const fh = P.fh;
    s += armSvg(farSh, fh, true);
    if (fr === 'aim') {
      // 검지를 세워 입가리개에 댐
      s += g(c.P('M-2.4 -2C-2.4 -3.6 2.4 -3.6 2.6 -1.6L2.6 2.4C1 3.6 -1.6 3.6 -2.4 2Z', skin) + c.P('M0.6 -2.8L1.2 -9.6Q2.6 -10.4 3 -9.2L2.6 -2.2Z', skin), tr(fh, 8));
    } else if (fr === 'attack') {
      // 뒤로 뻗은 손에서 염주가 흔들림
      s += fist(c, fh, 2.4, skin, 30) + [[-3, 4], [-4.6, 8], [-3.4, 12], [0, 14]].map(([x, y], i) => c.E(n(fh[0] + x), n(fh[1] + y), 1.8, 1.8, i === 3 ? c.body(GOLD, 0.3) : c.body(bead, 0.35), TH)).join('');
    } else {
      // 가슴 앞에서 염주를 굴림
      s += fist(c, fh, 2.4, skin, 80) + [[1.2, 3.6], [0.4, 7], [-1.6, 9.8], [-4.2, 11]].map(([x, y], i) => c.E(n(fh[0] + x), n(fh[1] + y), 1.8, 1.8, i === 3 ? c.body(GOLD, 0.3) : c.body(bead, 0.35), TH)).join('');
    }
    // 가까운 팔이 몸에 드리운 그늘
    s += segN(c, [nearSh[0] + 3, nearSh[1] + 3], [P.hand[0] + 3, P.hand[1] - 3], 3, 3, SHADE, 0.14);
    // 가까운 팔 + 종
    if (P.bell != null) s += g(bell(false), tr(P.hand, P.bell));
    s += armSvg(nearSh, P.hand, false);
    s += fist(c, P.hand, 2.5, skin, (P.bell == null ? 0 : P.bell) + 90);

    if (fr === 'aim') {
      // 종 둘레에 모이는 고요한 빛
      const top = pol(P.hand, P.bell + 90, 17);
      s += `<circle cx="${n(top[0])}" cy="${n(top[1])}" r="9" fill="#d8d0ff" opacity=".35" stroke="none" ${c.soft()}/>`;
      s += `<circle cx="${n(top[0])}" cy="${n(top[1])}" r="11" fill="none" stroke="#e6e0ff" stroke-width="1.6" stroke-dasharray="3 4" opacity=".8"/>`;
    }
    if (fr === 'attack') {
      // 침묵의 물결: 종 입에서 앞으로 퍼지는 소리 없는 고리(끊긴 점선)
      const m = pol(P.hand, P.bell + 90, 20);
      const arc = (r, w, op) => {
        const a1 = pol(m, -48, r);
        const a2 = pol(m, 48, r);
        return `<path d="M${pt(a1)}A${r} ${r} 0 0 1 ${pt(a2)}" fill="none" stroke="#e6e0ff" stroke-width="${w}" stroke-dasharray="${n(r * 0.5)} ${n(r * 0.22)}" opacity="${op}" stroke-linecap="round"/>`;
      };
      s += `<ellipse cx="${n(m[0] + 8)}" cy="${n(m[1])}" rx="12" ry="14" fill="#cfc6ff" opacity=".25" stroke="none" ${c.soft()}/>`;
      s += arc(6, 2.6, 0.95) + arc(11, 2.2, 0.75) + arc(16, 1.8, 0.55);
    }
    if (fr === 'die0') {
      // 놓친 종이 떨어짐
      s += g(bell(false), tr([61, 66], -62));
      s += c.mist([[44, 44, 2.4], [40, 40, 1.8], [50, 41, 1.6]], '#cfc8dc', 0.6);
    }
    return fin(c, s, 1.06);
  }
  D.hush_monk = (fr) => drawMonk(MONK[fr] || fr === 'die1' || fr === 'die2' ? fr : 'walk0');
  D.hush_monk.frames = true;
  // 조용한 종종걸음: 거의 튀지 않고 법복 자락만 살짝 흔들림
  MOTION.hush_monk = { gait: 'shuffle', bob: 0.012, tilt: 0, sway: 0.01, deathFx: 'ash', deathTime: 0.9 };
  /* ==== END hush_monk ==== */

  /* ==== BEGIN void_stalker ==== */
  /* =========================================================
   * 35 · 공허 추적자 — 몸이 잘 보이지 않는 네발 그림자 짐승(표범 같은 몸, 긴 다리, 채찍 꼬리).
   *   몸 가장자리는 연기처럼 풀리고, 자홍빛 공허의 금이 흐름. 눈은 하얀 틈.
   * 걸음: 대각선 다리 짝이 함께 움직이는 낮은 속보(어깨를 낮춘 채 미끄러지듯).
   * aim: 몸을 바짝 낮추고 앞발을 뒤로 젖혀 발톱을 세움 / attack: 몸을 길게 뻗어 앞발로 할퀴기(세 줄 자국).
   * 죽음: 맞고 몸을 뒤틀며 연기가 터짐 → 옆으로 쓰러지며 뒷몸부터 공허로 풀림 → 검은 웅덩이와 꺼져 가는 눈.
   * ========================================================= */
  const STALK = {
    //       허리          몸 기울기  가까운 앞발 [x,들림,발톱]  먼 앞발   가까운 뒷발  먼 뒷발   머리 [각도, 입 벌림]  꼬리 [굽음, 높이]
    walk0: { w: [50, 60.5], lean: 2, nF: [76, 0], fF: [62, 0], nH: [27, 0], fH: [45, 0], head: [8, 0], tail: [8, 36] },
    walk1: { w: [50, 59], lean: 1, nF: [69, 0], fF: [71, 6], nH: [35, 6], fH: [38, 0], head: [6, 0], tail: [6, 32] },
    walk2: { w: [50, 60.5], lean: 2, nF: [61, 0], fF: [77, 0], nH: [43, 0], fH: [28, 0], head: [8, 0], tail: [10, 38] },
    walk3: { w: [50, 59], lean: 1, nF: [70, 6], fF: [70, 0], nH: [36, 0], fH: [39, 6], head: [6, 0], tail: [6, 32] },
    aim: { w: [45, 66], lean: 8, nF: [60, 20, 1], fF: [71, 0], nH: [29, 0], fH: [34, 0], head: [16, 12], tail: [2, 24] },
    attack: { w: [45, 57], lean: -9, nF: [81, 30, 1], fF: [71, 5], nH: [16, 0], fH: [22, 2], head: [-6, 22], tail: [14, 42] },
    die0: { w: [47, 58], lean: -16, nF: [64, 4], fF: [70, 0], nH: [34, 0], fH: [40, 0], head: [-38, 16], tail: [-6, 30] },
  };

  function drawStalker(fr) {
    const c = make(2.5);
    const dk = '#2c2440';
    const dkL = '#4c3f6a';
    const VOID = '#d14fc0';
    const rim = '#8c7cc0';
    const P = STALK[fr];
    const smoke = (pts, op = 0.55) => c.mist(pts, '#4a3c66', op);

    /* 머리: 머리 좌표 (0,0)=두개골 가운데, +x가 주둥이. open=입 벌림 각도 */
    const head = (open, eyes = 1) => {
      const jaw = g(c.P('M-2 3C2 4.6 8 5 13 4.2L12.6 6.4C8 8 1 7.6 -3 5.6Z', c.body(sh(dk, -0.1), 0.3)) +
        (open > 4 ? c.P('M3 4.6L4 7L5 4.8M8 4.8L9 7.2L10 4.8', '#f2eefa', ' stroke-width="1"') : ''), `rotate(${n(open)} -2 3)`);
      return jaw +
        (open > 4 ? c.P('M0 2.6C4 3.4 9 3.6 13 3.2L12 5C8 5.8 3 5.6 -1 4.8Z', '#160c1e', ' stroke-width="1.2"') : '') +
        c.P('M-6 2C-8 -3 -5 -8 1 -8.6C5 -9 8 -7 10 -5L15 -2C16.6 -1 16.4 2 14.4 3.2C10 4.4 3 4.6 -2 4.6Z', c.body(dk, 0.38, -0.3)) +
        c.P('M-3 -6.6L-10 -13.4L-1.4 -9.4Z', c.body(dkL, 0.3), TH) +
        c.P('M1 -8L-4 -15.6L4.4 -9Z', c.body(dk, 0.35)) +
        c.L('M-1.2 -7.6C3 -8.6 7 -7.4 10 -5', rim, 1.4, ' opacity=".85"') +
        `<ellipse cx="7" cy="-3.6" rx="5.6" ry="3.4" fill="${VOID}" opacity="${n(0.4 * eyes)}" stroke="none" ${c.soft()}/>` +
        c.P('M3.6 -3.2L10.6 -4.8L10 -2.6L4.4 -1.8Z', '#ffffff', ` stroke="none" ${c.glow()}${eyes < 1 ? ` opacity="${eyes}"` : ''}`) +
        c.L('M13 0.4L15.2 0.2', '#160c1e', 1.4);
    };

    /* 앞다리: 어깨 s → 손목 → 발. 팔꿈치는 뒤로 굽음 */
    const foreleg = (s, f, far, claws = 0) => {
      const lift = f[1] || 0;
      const paw = [f[0], 86.4 - lift];
      const wrist = claws ? [paw[0] - 4, paw[1] + 1.5] : [paw[0] - 1.6, paw[1] - 5];
      const el = ik(s, wrist, 12, 11.5, [-1, 0.25]);
      const col = far ? sh(dk, -0.25) : dk;
      let out = seg(c, s, el, 4.6, 3, c.body(col, 0.3, -0.3)) + seg(c, el, wrist, 3, 2.2, col) + seg(c, wrist, paw, 2.2, 2.6, col);
      const ca = claws ? angOf(wrist, paw) : 0;
      out += g(c.P('M-3 -2.2C0 -3.4 3 -2.6 3.8 0C3.6 2 1 2.6 -3 2Z', col) +
        (claws
          ? c.P('M3 -2.6L11.6 -6L4 -0.6ZM3.6 -0.4L13 0.6L3.8 1.6ZM3 1.8L10.6 6.6L2.6 2.8Z', '#f6f0ff', ' stroke-width="1.2"')
          : c.P('M3.2 1.6L5.6 2.4L3.4 0.4ZM2 2L4 3.2L1.6 1.6Z', '#efe8fa', ' stroke-width="0.9"')), tr(paw, ca));
      return out;
    };
    /* 뒷다리: 엉덩이 s → 무릎(앞으로) → 발목(뒤꿈치) → 발 */
    const hindleg = (s, f, far) => {
      const lift = f[1] || 0;
      const paw = [f[0], 86.4 - lift];
      const hock = [paw[0] - 3.6, paw[1] - 8.4 + lift * 0.3];
      const kn = ik(s, hock, 11.5, 11, [1, 0.1]);
      const col = far ? sh(dk, -0.25) : dk;
      return seg(c, s, kn, 6.2, 3.4, c.body(col, 0.32, -0.3)) + seg(c, kn, hock, 3.2, 2.2, col) + seg(c, hock, paw, 2.2, 2.4, col) +
        g(c.P('M-3 -2C0 -3 3 -2.4 3.8 0C3.6 2 1 2.4 -3 2Z', col) + c.P('M3.2 1.4L5.4 2.2L3.4 0.2Z', '#efe8fa', ' stroke-width="0.9"'), tr(paw, 0));
    };

    let s = '';
    if (fr === 'die1' || fr === 'die2') {
      if (fr === 'die1') {
        // 옆으로 쓰러짐: 뒷몸은 이미 연기로 풀려 투명해짐
        s += smoke([[18, 70, 5], [26, 64, 4.4], [12, 62, 3.2], [22, 56, 2.6], [8, 72, 3.6]], 0.6);
        s += `<g opacity=".55">${ribbon(c, bez([40, 78], [24, 74], [12, 66]), 7, 2, c.body(dk, 0.3))}</g>`;
        s += c.P('M30 86C30 78 38 72 50 72C62 72 72 74 76 80C78 84 76 88 70 88.5L34 88.5C31 88.5 30 87.5 30 86Z', c.body(dk, 0.35, -0.3));
        s += c.L('M38 76C46 74 56 75 66 77', rim, 1.4, ' opacity=".8"') + c.L('M40 82C48 80 56 83 64 81', VOID, 1.8, ' opacity=".85"');
        s += seg(c, [62, 84], [76, 87], 2.4, 2, dk) + seg(c, [54, 85], [64, 88], 2.4, 2, sh(dk, -0.2));
        s += g(head(14, 0.7), tr([80, 80], 70));
        s += smoke([[46, 66, 2.6], [56, 64, 2.2], [36, 68, 2.4]], 0.5);
      } else {
        // 공허 웅덩이와 꺼져 가는 눈
        s += c.E(50, 86.6, 26, 3.4, c.rad([[0, '#3a2a54'], [0.7, '#1c1428'], [1, '#120c1c']], 0.4, 0.4, 0.7));
        s += c.L('M32 86.6Q42 85.4 50 86.4M56 86Q64 85.6 70 87', VOID, 1.6, ' opacity=".7"');
        s += smoke([[38, 80, 3], [48, 76, 2.6], [58, 79, 2.8], [44, 70, 2], [54, 66, 1.6], [62, 72, 1.8]], 0.45);
        s += c.P('M60 84.4L66 83.6L65.6 85L60.4 85.4Z', '#ffffff', ` stroke="none" opacity=".55" ${c.glow()}`);
      }
      return fin(c, s, 1.04);
    }

    const B = frameOf(P.w[0], P.w[1], P.lean);
    // 몸 곳곳(몸 좌표)
    const nSh = B.p(13, 0);
    const fSh = B.p(16, -2);
    const nHip = B.p(-14, -1);
    const fHip = B.p(-11, -3);
    const neckBase = B.p(17, -5);
    const ha = P.head[0];
    const headC = pol(neckBase, -14 + ha, 11);

    // 꼬리(채찍처럼, 끝은 연기)
    const rump = B.p(-21, -3);
    const tailEnd = [rump[0] - 16, rump[1] - P.tail[1] + 22];
    const tailCtl = [rump[0] - 6, rump[1] + P.tail[0]];
    s += smoke([[tailEnd[0] - 2, tailEnd[1] - 1, 2.6], [tailEnd[0] - 6, tailEnd[1] - 4, 2], [tailEnd[0] - 9, tailEnd[1] - 1, 1.6]], 0.6);
    s += ribbon(c, bez(rump, tailCtl, tailEnd), 3.2, 0.8, c.body(dk, 0.3, -0.3));
    // 먼 쪽 다리
    s += foreleg(fSh, P.fF, true) + hindleg(fHip, P.fH, true);
    // 몸통
    s += g(
      c.P('M-21 -2C-21 -8 -16 -10.5 -10 -9.5C-2 -8.6 6 -11.6 14 -10.6C20 -9.6 23 -4 21.6 2C20.4 7 16.4 9.4 12 9.2C6.4 8.6 2 4.6 -4 5.2C-10 5.8 -16 6.4 -19 3.4Z', c.body(dk, 0.36, -0.32)) +
      // 등의 연기 갈기(실루엣)
      c.P('M-12 -9.6L-10 -15L-7.4 -9.4ZM-4 -9L-1 -15.6L1.6 -9.6ZM5 -10.6L8.4 -16.4L10.4 -10.4Z', c.body(sh(dk, 0.1), 0.3), TH) +
      c.L('M-19 -6C-14 -10 -6 -9 0 -9.4C6 -10 12 -11.4 18 -9', rim, 1.4, ' opacity=".8"') +
      c.L('M-14 -2C-8 -4 -2 0 4 -2.6M-6 3C0 1 6 4 12 1.4', VOID, 1.8, ' opacity=".85"') +
      c.L('M8 -6C10 -2 12 2 12 6', sh(dk, -0.4), 1.5) +
      c.Pn('M-18 2C-12 5.6 -4 4.6 2 4.4C6 6 10 9 14 9.2L12 9.2C6.4 8.6 2 4.6 -4 5.2C-10 5.8 -16 6.4 -19 3.4Z', SHADE, 0.35),
      B.t);
    // 목 + 머리
    s += ribbon(c, [B.p(10, -6), mid(B.p(14, -7), headC, 0.3), mid(neckBase, headC, 0.75)], 6, 4.2, c.body(dk, 0.34, -0.3));
    s += g(head(P.head[1]), tr(headC, ha));
    // 가까운 쪽 다리
    s += hindleg(nHip, P.nH, false);
    s += foreleg(nSh, P.nF, false, P.nF[2] || 0);
    // 몸에서 풀려 나가는 연기(은신)
    s += smoke([[B.p(-20, 0)[0] - 3, B.p(-20, 0)[1], 2.4], [B.p(-6, 7)[0], B.p(-6, 7)[1] + 2, 2], [B.p(4, 9)[0], B.p(4, 9)[1] + 2, 1.6]], 0.5);

    if (fr === 'aim') {
      // 땅을 움켜쥔 뒷발 먼지 + 세운 발톱의 빛
      const claw = [P.nF[0] + 4, 86.4 - P.nF[1]];
      s += c.spark(n(claw[0] + 4), n(claw[1] - 2), 1.3, '#f2d8ff');
      s += smoke([[24, 86, 2.4], [30, 87, 1.8]], 0.4);
    }
    if (fr === 'attack') {
      // 세 줄 할퀸 자국(자홍빛 테두리)
      const cx = 91;
      const cy = 58;
      const slash = (dx, dy) => `<path d="M${cx - 6 + dx} ${cy - 13 + dy}Q${cx + 4 + dx} ${cy - 3 + dy} ${cx + 1 + dx} ${cy + 13 + dy}Q${cx + 1 + dx} ${cy + 1 + dy} ${cx - 6 + dx} ${cy - 13 + dy}Z" fill="#fff" stroke="${VOID}" stroke-width="1.3" opacity=".9"/>`;
      s += `<ellipse cx="${cx - 1}" cy="${cy}" rx="7" ry="14" fill="${VOID}" opacity=".3" stroke="none" ${c.soft()}/>`;
      s += slash(-4, -2) + slash(0, 0) + slash(4, 2);
    }
    if (fr === 'die0') {
      // 맞은 자리에서 연기가 터짐
      const hit = B.p(-2, -4);
      s += smoke([[hit[0], hit[1] - 8, 4], [hit[0] - 7, hit[1] - 12, 3], [hit[0] + 6, hit[1] - 13, 3], [hit[0] - 2, hit[1] - 18, 2.2]], 0.7);
      s += c.L(`M${pt(hit)}l-3 -4l2 -3M${pt(hit)}l4 -3`, '#f4d8ff', 1.6);
    }
    return fin(c, s, 1.04);
  }
  D.void_stalker = (fr) => drawStalker(STALK[fr] || fr === 'die1' || fr === 'die2' ? fr : 'walk0');
  D.void_stalker.frames = true;
  // 낮게 깔린 속보: 위아래는 거의 없고 몸이 좌우로 살짝 흔들림
  MOTION.void_stalker = { gait: 'prowl', bob: 0.012, tilt: 1, sway: 0.015, deathFx: 'ash', deathTime: 0.6 };
  /* ==== END void_stalker ==== */

  /* ==== BEGIN ashen_paladin ==== */
  /* =========================================================
   * 36 · 잿빛 성기사 — 금 간 하얀 판갑, 깨진 후광(빛 잃은 금빛 고리), 해진 회색 망토,
   *   먼 팔에 금 간 연 모양 방패, 가까운 손에 빛을 잃은 성검. 무겁고 느린 걸음.
   * walk: 칼을 어깨에 걸치고 걷기 / aim: 방패를 앞세우고 칼을 머리 뒤로 높이 젖힘 /
   * attack: 몸을 실어 앞으로 내려베기(칼끝이 앞 아래, 베인 자국).
   * 죽음: 방패가 먼저 팔에서 빠져 떨어짐 → 칼을 땅에 꽂고 무릎 꿇음 → 빈 갑옷이 무너지고 꽂힌 칼에 망토만 걸림.
   * ========================================================= */
  const PALA = {
    //       골반         기울기  가까운 발         먼 발            칼 손      칼 각도   방패 [x,y,각도]  머리
    walk0: { p: [44, 62], lean: 3, nf: [54, 0, 0], ff: [35, 1.5, 22], hand: [41, 53], sword: -112, sh: [62, 58, 4], head: 0 },
    walk1: { p: [44, 60.4], lean: 3, nf: [44, 0, 0], ff: [49, 6, 14], hand: [42, 52], sword: -110, sh: [63, 56, 2], head: 0 },
    walk2: { p: [44, 62], lean: 3, nf: [34, 1.5, 22], ff: [54, 0, 0], hand: [43, 53], sword: -108, sh: [64, 58, 0], head: 0 },
    walk3: { p: [44, 60.4], lean: 3, nf: [49, 6, 14], ff: [44, 0, 0], hand: [42, 52], sword: -110, sh: [63, 56, 2], head: 0 },
    aim: { p: [42, 62.5], lean: -10, nf: [33, 0, 4], ff: [56, 0, 0], hand: [44, 24], sword: -158, sh: [63, 52, -4], head: -6 },
    attack: { p: [45, 64.5], lean: 16, nf: [29, 1, 24], ff: [61, 0, 0], hand: [64, 50], sword: 50, sh: [55, 62, 14], head: 6 },
    die0: { p: [42, 62], lean: -14, nf: [32, 4, 20], ff: [52, 0, 0], hand: [37, 61], sword: 138, sh: null, head: -16 },
    die1: { p: [41, 73], lean: 8, nf: [27, 0, 62, 86], ff: [55, 0, 0], hand: [57, 48], sword: 90, sh: null, head: 26 },
  };

  function drawPaladin(fr) {
    const c = make(2.6);
    const plate = '#d6d2ca';
    const plateL = sh(plate, 0.4);
    const plateD = sh(plate, -0.3);
    const under = '#6e6880';
    const FAR = -0.22;
    const P = PALA[fr];
    const crk = (d, w = 1.4) => c.L(d, '#5a5468', w);

    /* 성검: 쥔 곳(0,0)에서 +x로 칼날. 빛을 잃은 회백색 칼날, 바랜 금 코등이 */
    const sword = (p, a) => g(
      c.P('M-8.6 -1.6L-1 -1.6L-1 1.6L-8.6 1.6Z', '#4a3a30', TH) +
      c.L('M-7 -1.6L-6 1.6M-4.6 -1.6L-3.6 1.6M-2.2 -1.6L-1.2 1.6', '#7a6250', 1) +
      c.E(-9.6, 0, 2.2, 2.2, c.body('#b89a50', 0.3, -0.3), TH) +
      c.P('M0.4 -7L3.4 -7L3.4 7L0.4 7Z', c.body('#b89a50', 0.35, -0.3), TH) +
      c.E(1.9, 0, 1.4, 1.4, '#e8e2f0', ' stroke="none"') +
      c.P('M3.4 -2.5L36 -2.1L42 0L36 2.1L3.4 2.5Z', c.lin([[0, '#f0eef4'], [0.5, '#c4c2cc'], [1, '#8a8698']])) +
      c.L('M5 0L35 0', '#8a8698', 1.2) +
      c.L('M14 -2.3L16 0L14.6 2.3M26 -2.2L27 -0.6', '#5a5468', 1.1) +
      c.L('M6 -1.6L30 -1.4', '#fff', 1, ' opacity=".55"'),
      tr(p, a));

    /* 연 모양 방패: 금 간 흰 면 + 바랜 금 테 + 가운데 종·햇살 문양(좌우 대칭) */
    const shield = (cracked = 1) =>
      c.P('M-11 -15C-4 -18 4 -18 11 -15L10.4 2C9 10 4 16 0 19C-4 16 -9 10 -10.4 2Z', c.lin([[0, '#f2f0ea'], [0.4, plate], [1, plateD]], 'h')) +
      c.Pn('M3 -17C6 -17 9 -16 11 -15L10.4 2C9 10 4 16 0 19C2 12 3.6 2 3 -17Z', SHADE, 0.16) +
      c.L('M-8.8 -13C-3 -15.4 3 -15.4 8.8 -13L8.2 1.6C7 8 3.4 13 0 15.6C-3.4 13 -7 8 -8.2 1.6Z', '#b89a50', 1.6) +
      c.P('M0 -8.6L1.6 -3.4L6 -3L2.4 0L3.6 5L0 2.2L-3.6 5L-2.4 0L-6 -3L-1.6 -3.4Z', c.body('#c9ae64', 0.3, -0.3), TH) +
      (cracked ? crk('M-6 -12L-2.6 -6L-5 -1L-1.4 5M4 9L6.6 4.4', 1.5) : '');

    /* 투구(머리 좌표): 둥근 통투구, 금빛 세로 띠 + 가로 눈 틈(하얀 눈빛), 금 간 자국 */
    const helm = (lit = 1) =>
      c.P('M-9.6 -8C-10 -16 -3 -19.6 2 -19.6C9.6 -19.6 12.4 -14 12.4 -6L12.4 4C8 7 -4 7 -9.4 4Z', c.body(plate, 0.45, -0.34)) +
      c.Pn('M-9.4 -2C-3 0 6 0 12.4 -2L12.4 4C8 7 -4 7 -9.4 4Z', SHADE, 0.16) +
      c.P('M5.6 -19.2L8.6 -18.8L8.8 5.6L5.8 5.8Z', c.body('#c9ae64', 0.3, -0.3), TH) +
      c.P('M2.6 -9.6L12.6 -9.6L12.6 -6.2L2.6 -6.2Z', '#241b2c', TH) +
      (lit ? `<path d="M4 -7.9H12" stroke="#fff" stroke-width="4.4" opacity="${0.5 * lit}" ${c.soft()}/>` + c.L('M4 -7.9H6.4M9 -7.9H12', '#ffffff', 1.8, lit < 1 ? ` opacity="${lit}"` : '') : '') +
      c.En(0, 1.6, 1, 1, plateD) + c.En(-4.6, 1, 1, 1, plateD) +
      crk('M-4 -18L-2.4 -12L-5.6 -7') +
      c.shine(-4, -12, 2.4, 4.6, 0.55, 15);

    /* 깨진 후광 */
    const halo = (cx, cy, op = 1, broken = 0) =>
      `<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="16" ry="16" fill="none" stroke="${GOLD}" stroke-width="6" stroke-dasharray="${broken ? '10 12 14 16' : '20 6 28 8'}" opacity="${n(0.32 * op)}" ${c.soft()}/>` +
      `<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="16" ry="16" fill="none" stroke="#f6e4a8" stroke-width="2.4" stroke-dasharray="${broken ? '10 12 14 16' : '20 6 28 8'}" opacity="${n(0.85 * op)}"/>`;

    const cuirass = () =>
      c.P('M-11 -1C-13 -9 -13 -19 -10 -24.5C-4 -28 7 -28 11 -24.5C14 -18 14 -9 11 -1Z', c.body(plate, 0.45, -0.36)) +
      c.Pn('M5 -26C11 -25 14 -18 13.6 -9L11 -1L5.4 -1.4C6.6 -9 6.6 -18 5 -26Z', SHADE, 0.18) +
      c.P('M2 -21L5.4 -21L5.4 -5L2 -5Z', c.body('#c9ae64', 0.3, -0.3), TH) + c.P('M-3 -15.4L10.4 -15.4L10.4 -12L-3 -12Z', c.body('#c9ae64', 0.3, -0.3), TH) +
      crk('M-6 -24L-4 -17L-7.6 -12L-4.6 -5') + crk('M9.6 -9L7 -5.4') +
      c.shine(-6, -17, 2.6, 5.6, 0.5, 10);
    const skirt = () =>
      c.P('M-11.4 -4L11.4 -4.6L11.8 -0.6L-11.8 -0.4Z', '#5a4a3e', TH) +
      c.P('M-12.4 -0.5L12.4 -0.5L14 10.6L-13.6 10.6Z', c.body(sh(plate, -0.06), 0.35, -0.32)) +
      c.L('M-6 0L-6.6 10.6M0.6 0V10.6M7 0L7.6 10.6', plateD, 1.5) +
      c.Pn('M-12 6.6L13.4 6.6L14 10.6L-13.6 10.6Z', SHADE, 0.2) +
      c.P('M-2 -0.4L3.4 -0.4L4.4 13L0.6 15L-3 13Z', '#7a7488', TH);
    const pauldronAt = (p, a, far) => g(
      c.P('M-7.6 -3C-7.6 -10 3 -12 7.6 -6L7 3C3 0.6 -3.4 0.6 -7.6 3Z', c.body(sh(plateL, far ? FAR : -0.05), 0.35, -0.35)) +
      c.L('M-7 0C-2.4 -2.6 2.6 -2.6 7 -0.4', plateD, 1.5) + c.L('M-6.6 -3.6C-2 -6.4 2.6 -6.2 6.6 -3.6', '#b89a50', 1.4), tr(p, a));
    const legO = (far) => ({
      l1: 12.6, l2: 12.6, r1: 5.2, r2: 4, r3: 3.4, h: 5, len: 12.4, plate: true,
      thigh: c.body(sh(plate, far ? FAR - 0.06 : -0.06), 0.3), shin: c.body(sh(plate, far ? FAR : 0), 0.4, -0.3),
      boot: c.body(sh(plateD, far ? FAR : 0), 0.3, -0.3),
      kneecap: (k, a) => g(c.P('M-4 -3Q0 -5.6 4 -3L3.6 2.6Q0 4.4 -3.6 2.6Z', c.body(sh(plateL, far ? FAR : 0), 0.4, -0.2)) + c.E(0, 0, 1.2, 1.2, '#b89a50', TH), tr(k, a - 90)),
    });

    let s = '';
    if (fr === 'die2') {
      // 꽂힌 칼에 망토가 걸리고, 빈 갑옷은 발치에 무너짐. 후광 조각은 땅에.
      s += c.P('M52 50C46 52 42 62 40 74C39 80 40 86 42 88.5L66 88.5C66 82 64 72 60 60C58 54 56 51 52 50Z', c.body('#7a7488', 0.25, -0.3));
      s += c.L('M48 60L44 86M56 62L58 86', sh('#7a7488', -0.3), 1.5) + c.P('M42 88.5L44 84L47 88.5L51 85L54 88.5L58 84.6L62 88.5Z', '#7a7488', TH);
      s += sword([54, 46.2], 90);
      s += g(cuirass(), tr([30, 86], -82, 0.9));
      s += g(helm(0), tr([74, 81], 100, 0.95));
      s += pauldronAt([66, 85], 170, false) + boot(c, [22, 84], 12, 4.4, -80, c.body(plateD, 0.3), true);
      s += `<path d="M78 87.4A8 3 0 0 1 92 86.6M14 86.6A6 2.4 0 0 1 24 87.2" fill="none" stroke="#c9ae64" stroke-width="2" opacity=".8"/>`;
      s += motes(c, [[40, 70, 1.1], [62, 64, 0.9], [36, 60, 0.8], [66, 56, 0.8], [48, 40, 0.8]], '#7a7484', 0.8);
      return fin(c, s, 1.08);
    }

    const B = frameOf(P.p[0], P.p[1], P.lean);
    const farHip = B.p(3.4, -1);
    const nearHip = B.p(-3, 1);
    const farSh = B.p(6.4, -23.4);
    const nearSh = B.p(-7.4, -22);
    const headP = B.p(1.4, -33);

    // 망토(맨 뒤): 어깨에서 등 뒤로 늘어지고 끝은 해짐
    const capeTop1 = B.p(-9, -24);
    const capeTop2 = B.p(5, -26);
    const swing = fr === 'attack' ? -10 : fr === 'aim' ? -2 : fr === 'die0' ? 6 : fr === 'walk1' || fr === 'walk3' ? -3 : 0;
    const hemY = fr === 'die1' ? 86 : 82;
    const hx = P.p[0] - 18 + swing;
    s += c.P(`M${pt(capeTop2)}C${n(capeTop2[0] - 6)} ${n(capeTop2[1] + 12)} ${n(hx + 10)} ${n(hemY - 20)} ${n(hx + 12)} ${hemY}L${n(hx + 9)} ${n(hemY - 3)}L${n(hx + 6)} ${n(hemY + 1)}L${n(hx + 3)} ${n(hemY - 4)}L${n(hx)} ${n(hemY - 1)}L${n(hx - 2)} ${n(hemY - 5)}C${n(hx - 2)} ${n(hemY - 22)} ${n(capeTop1[0] - 6)} ${n(capeTop1[1] + 10)} ${pt(capeTop1)}Z`, c.body('#7a7488', 0.25, -0.35));
    s += c.L(`M${n(capeTop1[0] - 1)} ${n(capeTop1[1] + 8)}Q${n(hx + 2)} ${n(hemY - 22)} ${n(hx + 4)} ${n(hemY - 6)}`, sh('#7a7488', -0.3), 1.5);
    // 후광(머리 뒤)
    if (fr !== 'die1') s += halo(headP[0] - 3, headP[1] - 6, fr === 'die0' ? 0.6 : 1, fr === 'die0' ? 1 : 0);

    const lf = leg(c, farHip, P.ff, legO(true));
    const ln = leg(c, nearHip, P.nf, legO(false));
    const shC = P.sh ? [P.sh[0], P.sh[1]] : null;
    const farHand = shC || (fr === 'die1' ? [P.hand[0] + 1, P.hand[1] - 4] : B.p(16, -6));
    const farArm = arm(c, farSh, farHand, { l1: 11.6, l2: 10.6, r1: 4.2, r2: 3.6, r3: 3.2, upper: sh(under, FAR), fore: c.body(sh(plate, FAR), 0.35), pref: [-0.2, 1] });
    const torso = g(
      cuirass() + skirt() +
      c.P('M-4.6 -28.6L6.6 -28.6L7 -24.4L-5 -24.4Z', under, TH) +
      g(helm(fr === 'die1' ? 0.25 : 1), tr([1.4, -33], P.head)),
      B.t);
    const nearArm = arm(c, nearSh, P.hand, { l1: 12, l2: 11.2, r1: 4.4, r2: 3.8, r3: 3.4, upper: under, fore: c.body(plate, 0.4, -0.3), pref: fr === 'aim' ? [-1, 0.1] : [-0.5, 1] });

    s += lf.svg;
    if (fr === 'die0') s += farArm.svg;
    else if (shC) s += farArm.svg;
    s += pauldronAt(farSh, angOf(farSh, farArm.el) - 90, true);
    s += ln.svg + torso;
    if (shC) s += g(shield(), tr(shC, P.sh[2]));
    if (fr === 'die0') {
      // 방패가 먼저 팔에서 빠져 떨어짐
      s += g(shield(), tr([68, 72], 34));
      s += fist(c, farHand, 3, c.body(sh(plate, FAR), 0.3), 40);
    }
    if (fr === 'die1') {
      // 방패는 뒤에 쓰러져 있음
      s = flat(shield(), [26, 85], 90, 0.45) + s;
    }
    s += segN(c, [nearSh[0] + 2.6, nearSh[1] + 3], [nearArm.el[0] + 2.6, nearArm.el[1] + 2], 3.4, 2.6, SHADE, 0.16);
    s += sword(P.hand, P.sword);
    s += nearArm.svg + pauldronAt(nearSh, angOf(nearSh, nearArm.el) - 90, false) + fist(c, P.hand, 3.3, c.body(plate, 0.35, -0.3), P.sword + 90);
    if (fr === 'die1') s += farArm.svg + fist(c, farHand, 3.1, c.body(sh(plate, FAR), 0.3), 0);

    if (fr === 'aim') {
      const tip = pol(P.hand, P.sword, 41);
      s += c.spark(n(tip[0]), n(tip[1]), 1.5, '#f1dc9a');
    }
    if (fr === 'attack') {
      // 위에서 앞 아래로 그은 반달 자국
      s += swoosh(c, 'M44 10C70 12 92 36 96 78C90 50 72 26 46 18Z', '#f4ecd0', 0.6);
      s += swoosh(c, 'M50 14C72 18 88 38 92 66C86 46 70 28 52 21Z', '#ffffff', 0.5);
      s += motes(c, [[92, 86, 1.4], [86, 87, 1.1], [98, 85, 1]], '#d8d0c0', 0.8);
    }
    if (fr === 'die0') {
      const hit = B.p(5, -16);
      s += c.L(`M${pt(hit)}l4 -3l-1 -4M${pt(hit)}l3 4l4 0`, '#fff', 1.6) + c.mist([[hit[0] + 7, hit[1] - 5, 2.6], [hit[0] + 4, hit[1] - 10, 2]], '#e8e2d8', 0.7);
    }
    if (fr === 'die1') {
      // 후광 조각이 떨어지고 투구 틈으로 잿빛 김
      s += `<path d="M30 30A12 12 0 0 1 38 22M46 18A12 12 0 0 1 54 22" fill="none" stroke="#c9ae64" stroke-width="2" opacity=".75"/>`;
      s += c.mist([[headP[0] + 4, headP[1] - 10, 2.4], [headP[0] + 1, headP[1] - 15, 1.8]], '#e0dad0', 0.6);
    }
    return fin(c, s, 1.08);
  }
  D.ashen_paladin = (fr) => drawPaladin(PALA[fr] || fr === 'die2' ? fr : 'walk0');
  D.ashen_paladin.frames = true;
  // 무거운 갑옷 걸음: 발을 디딜 때마다 몸이 조금 기울고 가라앉음
  MOTION.ashen_paladin = { gait: 'walk', bob: 0.025, tilt: 2.5, deathFx: 'sparks', deathTime: 1.0 };
  /* ==== END ashen_paladin ==== */

  /* ==== BEGIN echo_shade ==== */
  /* =========================================================
   * 37 · 메아리 그림자 — 윤곽이 여러 겹 겹쳐 보이는 그림자 사람. 다리 대신 해진 연기 꼬리로 떠서 흘러감.
   *   길고 가는 팔, 세 갈래 갈고리 손가락, 하얀 눈. 뒤·앞에 반투명한 "메아리"가 한 박자 늦게 따라옴.
   * walk: 둥실 흘러가기(꼬리가 S자로 흔들림, 메아리가 엇갈려 따라옴) / aim: 두 손을 뒤로 젖히고 메아리가 넓게 퍼짐 /
   * attack: 앞으로 덮치며 두 손으로 할퀴기 — 앞선 메아리가 먼저 휘두름.
   * 죽음: 맞자 메아리가 떨어져 나감 → 몸이 세 겹으로 갈라져 흩어짐 → 작은 메아리 둘만 남아 꺼짐.
   * ========================================================= */
  const SHADE_P = {
    //       골반          기울기  꼬리 끝 [x,y]  꼬리 굽음   가까운 손   먼 손     머리   메아리 [뒤dx, 앞dx, 투명]
    walk0: { p: [50, 60], lean: 8, tail: [30, 86], bend: -8, nh: [46, 70], fh: [64, 66], head: 4, echo: [-11, 8, 0.4] },
    walk1: { p: [50, 58.5], lean: 9, tail: [27, 84], bend: 4, nh: [43, 69], fh: [66, 64], head: 6, echo: [-9, 10, 0.36] },
    walk2: { p: [50, 60], lean: 8, tail: [31, 86.5], bend: 9, nh: [48, 70], fh: [62, 67], head: 4, echo: [-12, 7, 0.4] },
    walk3: { p: [50, 61], lean: 7, tail: [28, 85], bend: -3, nh: [45, 71], fh: [64, 66], head: 2, echo: [-10, 9, 0.36] },
    aim: { p: [46, 60], lean: -6, tail: [26, 86], bend: -6, nh: [28, 40], fh: [38, 34], head: -4, echo: [-15, 14, 0.42] },
    attack: { p: [52, 61], lean: 22, tail: [24, 82], bend: 10, nh: [82, 56], fh: [84, 46], head: 12, echo: [-6, 14, 0.5] },
    die0: { p: [47, 60], lean: -18, tail: [36, 86], bend: -10, nh: [34, 50], fh: [58, 44], head: -24, echo: [-18, 18, 0.5] },
  };

  function drawShade(fr) {
    const c = make(2.5);
    const body = '#4c4462';
    const bodyD = sh(body, -0.25);
    const rim = '#9f90d8';
    const ECHO = '#6a5a9a';
    const ECHO_L = '#c4b6ff';

    /* 그림자 사람 하나(본체·메아리 공용). P: 자세, fill·far·rim 색, eyes: 눈빛 세기 */
    const fig = (P, o) => {
      const B = frameOf(P.p[0], P.p[1], P.lean);
      const fill = o.fill;
      const farC = o.far;
      const T = P.tail;
      const wB = B.p(-6, -1);
      const wF = B.p(7, -1);
      const ctlB = [mid(wB, T)[0] + P.bend - 4, mid(wB, T)[1] + 2];
      const ctlF = [mid(wF, T)[0] + P.bend + 6, mid(wF, T)[1] + 4];
      const nSh = B.p(-6, -19);
      const fSh = B.p(6, -20.4);
      const claw = (hand, el, col) => {
        const a = angOf(el, hand);
        return g(c.P('M-1.6 -2.4C1.4 -3 3 -1.6 3.2 0C3 1.6 1.4 3 -1.6 2.4Z', col) +
          c.P('M2.6 -1.4Q7 -4.6 10.4 -3.6Q7.4 -2.8 3.4 -0.2ZM3.2 -0.2Q8 0 11.6 1.6Q7.4 1.6 3 1ZM2.6 1.2Q6.4 3.6 8.6 6.2Q5.6 4.6 2.2 2.4Z', col, ' stroke-width="1.2"'), tr(hand, a));
      };
      const armF = (s0, hand, col) => {
        const el = ik(s0, hand, 11.5, 11, [-0.6, 0.9]);
        return seg(c, s0, el, 3.2, 2.4, col) + seg(c, el, hand, 2.4, 1.8, col) + claw(hand, el, col);
      };
      let out = armF(fSh, P.fh, farC);
      out += c.P(`M${pt(B.p(-8, -21))}C${pt(B.p(-11, -14))} ${pt(B.p(-8, -6))} ${pt(wB)}Q${pt(ctlB)} ${pt(T)}L${n(T[0] + 6)} ${n(T[1] - 4)}L${n(T[0] + 5)} ${n(T[1] + 0.6)}L${n(T[0] + 11)} ${n(T[1] - 5)}L${n(T[0] + 11)} ${n(T[1] - 1)}Q${pt(ctlF)} ${pt(wF)}C${pt(B.p(10, -8))} ${pt(B.p(11, -15))} ${pt(B.p(7, -22))}C${pt(B.p(4, -25))} ${pt(B.p(-4, -25))} ${pt(B.p(-8, -21))}Z`, fill);
      if (o.detail) {
        out += c.L(`M${pt(B.p(-7, -19))}C${pt(B.p(-9, -12))} ${pt(B.p(-7, -6))} ${pt(B.p(-5, -2))}`, rim, 1.5, ' opacity=".8"');
        out += c.L(`M${pt(B.p(-3, -14))}C${pt(B.p(1, -12))} ${pt(B.p(5, -12))} ${pt(B.p(8, -14))}M${pt(B.p(-2, -6))}C${pt(B.p(2, -4))} ${pt(B.p(4, -4))} ${pt(B.p(7, -6))}`, '#8f7fc0', 1.4, ' opacity=".7"');
        out += c.Pn(`M${pt(B.p(4, -22))}C${pt(B.p(10, -16))} ${pt(B.p(10, -8))} ${pt(wF)}Q${pt(ctlF)} ${n(T[0] + 11)} ${n(T[1] - 1)}L${n(T[0] + 8)} ${n(T[1] - 3)}Q${pt(mid(ctlF, ctlB))} ${pt(B.p(2, -1))}C${pt(B.p(5, -8))} ${pt(B.p(5, -16))} ${pt(B.p(4, -22))}Z`, SHADE, 0.25);
      }
      // 머리: 매끈한 달걀형 + 뒤로 흩날리는 연기 머리카락
      const hc = B.p(2, -31);
      out += g(
        c.P('M-1 -9C-7 -10.6 -11 -7 -17 -10.4C-14 -6 -11 -4.6 -8 -3.6C-11.6 -2.6 -13.6 0 -17.6 -0.6C-13 2.8 -8.6 3 -5.6 2Z', fill, ' stroke-width="2"') +
        c.P('M-6.6 1C-7.6 -6 -3 -9.6 1.6 -9.6C7 -9.6 9.6 -5 9 0.6C8.6 5.6 5 8.4 1 8.4C-3.4 8.4 -6 5.6 -6.6 1Z', fill) +
        (o.detail ? c.L('M-4.4 -4.6C-2.4 -7.6 1 -8.4 3.6 -8', rim, 1.4, ' opacity=".8"') : '') +
        (o.eyes ? c.eye(3.6, -0.6, 1.9 * o.eyes, false) + c.eye(7.6, -0.4, 1.6 * o.eyes, false) : ''),
        tr(hc, P.lean + P.head));
      out += armF(nSh, P.nh, fill);
      return out;
    };
    const echo = (P, dx, dy, op, dash = false) =>
      `<g opacity="${n(op)}" stroke="${ECHO_L}"${dash ? ' stroke-dasharray="4 3"' : ''} transform="translate(${n(dx)} ${n(dy)})">${fig(P, { fill: ECHO, far: ECHO, eyes: 0.6 })}</g>`;

    let s = '';
    if (fr === 'die1') {
      // 세 겹으로 갈라져 흩어짐(가운데는 옅어짐)
      const P = { p: [50, 60], lean: 4, tail: [34, 86], bend: 0, nh: [40, 68], fh: [62, 66], head: 0 };
      s += echo(P, -20, -6, 0.42, true) + echo(P, 18, -4, 0.42, true);
      s += `<g opacity=".7">${fig(P, { fill: c.body(body, 0.35, -0.3), far: bodyD, eyes: 0.6, detail: true })}</g>`;
      s += c.L('M46 30L52 40L47 50L53 62', '#efeaff', 1.8, ' opacity=".9"');
      s += motes(c, [[30, 40, 1.2], [70, 38, 1.1], [24, 60, 1], [76, 58, 1], [50, 22, 0.9]], ECHO_L, 0.8);
      return fin(c, s, 1.02);
    }
    if (fr === 'die2') {
      // 작은 메아리 둘이 양쪽으로 갈라져 꺼져 감
      const P = { p: [50, 62], lean: 10, tail: [36, 86], bend: 4, nh: [46, 72], fh: [62, 68], head: 6 };
      s += `<g transform="translate(-14 26) scale(0.7)">${echo(P, 0, 0, 0.45, true)}</g>`;
      s += `<g transform="translate(36 30) scale(0.62)">${echo(P, 0, 0, 0.35, true)}</g>`;
      s += c.mist([[44, 82, 3], [52, 80, 2.6], [58, 84, 2.2], [48, 74, 1.8]], '#8a7cb8', 0.4);
      s += motes(c, [[40, 70, 1], [60, 66, 0.9], [52, 60, 0.8]], ECHO_L, 0.7);
      return fin(c, s, 1.02);
    }

    const P = SHADE_P[fr];
    const [eb, ef, eo] = P.echo;
    // 뒤 메아리(한 박자 늦음) — 걷기에서는 이전 자세를 씀
    const order = ['walk0', 'walk1', 'walk2', 'walk3'];
    const k = order.indexOf(fr);
    const Pprev = k >= 0 ? SHADE_P[order[(k + 3) % 4]] : P;
    const Pnext = k >= 0 ? SHADE_P[order[(k + 1) % 4]] : P;
    s += echo(Pprev, eb, 1, eo, fr === 'die0');
    if (fr === 'attack') {
      // 앞선 메아리가 먼저 덮침
      s += echo(P, ef, -2, eo);
    } else {
      s += echo(Pnext, ef, -1, eo * 0.8, fr === 'die0');
    }
    s += fig(P, { fill: c.body(body, 0.38, -0.3), far: bodyD, eyes: 1, detail: true });

    if (fr === 'aim') {
      s += `<ellipse cx="34" cy="38" rx="9" ry="8" fill="${ECHO_L}" opacity=".3" stroke="none" ${c.soft()}/>`;
    }
    if (fr === 'attack') {
      const cx = 88;
      const cy = 52;
      s += `<ellipse cx="${cx}" cy="${cy}" rx="8" ry="15" fill="${ECHO_L}" opacity=".3" stroke="none" ${c.soft()}/>`;
      s += [-4, 0, 4].map((d) => `<path d="M${cx - 6 + d} ${cy - 14 + d * 0.5}Q${cx + 4 + d} ${cy - 2} ${cx + d} ${cy + 14 - d * 0.5}Q${cx + d} ${cy} ${cx - 6 + d} ${cy - 14 + d * 0.5}Z" fill="#f6f2ff" stroke="${ECHO_L}" stroke-width="1.2" opacity=".9"/>`).join('');
    }
    if (fr === 'die0') {
      s += c.L('M50 28L54 36L49 44', '#efeaff', 1.8, ' opacity=".9"');
      s += motes(c, [[36, 30, 1.2], [64, 28, 1], [30, 50, 1]], ECHO_L, 0.8);
    }
    return fin(c, s, 1.02);
  }
  D.echo_shade = (fr) => drawShade(SHADE_P[fr] || fr === 'die1' || fr === 'die2' ? fr : 'walk0');
  D.echo_shade.frames = true;
  // 둥실 흘러감: 걸음 대신 천천히 오르내리고 좌우로 일렁임
  MOTION.echo_shade = { gait: 'float', bob: 0.04, tilt: 0, sway: 0.03, squash: 0.03, deathFx: 'mist', deathTime: 0.8 };
  /* ==== END echo_shade ==== */

  /* ==== BEGIN bellshard_golem ==== */
  /* =========================================================
   * 38 · 종 조각 골렘 — 깨진 대종의 청동 조각이 모여 선 골렘. 몸통은 금 간 종(입이 아래),
   *   틈으로 보랏빛 울림 심장이 비침. 관절은 조각 사이에 뜬 보랏빛 고리로 이어짐.
   *   주먹은 두꺼운 종 테두리 조각. 걸을 때마다 "둥" 하고 둔탁한 울림.
   * walk: 무겁게 쿵쿵(한 발을 높이 들었다 내리찍음) / aim: 종 조각 주먹을 뒤로 높이 감아올림 /
   * attack: 주먹을 땅에 내리꽂음(충격 고리·금·파편).
   * 죽음: 맞은 자리에서 금이 번지며 빛이 샘 → 몸통이 두 쪽으로 갈라져 무너지며 마지막 종소리 → 청동 조각 더미.
   * ========================================================= */
  const GOLEM = {
    //       골반(종 입 가운데)  기울기  가까운 발       먼 발           가까운 주먹  먼 주먹    머리 기울기  울림
    walk0: { p: [48, 66], lean: 3, nf: [60, 0, 0], ff: [36, 0, 0], nh: [30, 74], fh: [74, 68], head: 0, dong: 'n' },
    walk1: { p: [48, 63.5], lean: 0, nf: [50, 0, 0], ff: [48, 9, 6], nh: [33, 72], fh: [72, 70], head: 0 },
    walk2: { p: [48, 66], lean: -3, nf: [36, 0, 0], ff: [60, 0, 0], nh: [38, 74], fh: [66, 68], head: 0, dong: 'f' },
    walk3: { p: [48, 63.5], lean: 0, nf: [50, 9, 6], ff: [48, 0, 0], nh: [34, 72], fh: [71, 70], head: 0 },
    aim: { p: [46, 66], lean: -10, nf: [34, 0, 0], ff: [62, 0, 0], nh: [22, 24], fh: [74, 58], head: -6 },
    attack: { p: [46, 67], lean: 18, nf: [30, 1, 14], ff: [60, 0, 0], nh: [75, 80], fh: [64, 74], head: 10 },
    die0: { p: [46, 65], lean: -12, nf: [38, 0, 0], ff: [58, 0, 0], nh: [26, 58], fh: [72, 74], head: -20 },
  };

  function drawGolem(fr) {
    const c = make(2.7);
    const br = BRONZE;
    const brD = sh(BRONZE, -0.3);
    const brL = sh(BRONZE, 0.35);
    const pat = '#6fa89a';
    const glow = '#c8b8ff';
    const P = GOLEM[fr];
    const brF = (amt = 0) => c.body(sh(br, amt), 0.38, -0.4);

    /* 관절: 조각 사이에 뜬 보랏빛 고리 */
    const joint = (p, r) => `<circle cx="${n(p[0])}" cy="${n(p[1])}" r="${n(r * 1.8)}" fill="${BELL}" opacity=".55" stroke="none" ${c.soft()}/>` +
      c.E(n(p[0]), n(p[1]), r, r, c.rad([[0, '#ffffff'], [0.5, glow], [1, '#6a5a9a']], 0.4, 0.4, 0.6), TH);
    /* 종 테두리 주먹: 손목 방향 a, 바깥쪽(주먹 면)이 +x */
    const fistB = (p, a, far) => g(
      c.P('M-5 -6.4L5 -7.4C9 -7 11.4 -4 11.6 0C11.4 4 9 7 5 7.4L-5 6.4Z', brF(far ? -0.2 : 0)) +
      c.P('M6.4 -7.2C10.6 -6.6 13 -3.6 13 0C13 3.6 10.6 6.6 6.4 7.2L5 7.4C9 7 11.4 4 11.6 0C11.4 -4 9 -7 5 -7.4Z', c.body(sh(brD, far ? -0.2 : 0), 0.3), TH) +
      c.L('M-2 -5.6L-2.4 5.4', pat, 1.6) + c.L('M2 -4L4 -1L2 2', SHADE, 1.3) +
      c.Pn('M-5 2.6L11 3C10 5.6 8 7 5 7.4L-5 6.4Z', SHADE, 0.25),
      tr(p, a));
    const limbSeg = (a, b, r1, r2, far) => seg(c, a, b, r1, r2, brF(far ? -0.22 : -0.05)) +
      c.L(`M${pt(mid(a, b, 0.25))}L${pt(mid(a, b, 0.7))}`, pat, 1.6, ' opacity=".8"');
    const armG = (s0, hand, far) => {
      const el = ik(s0, hand, 15, 14, fr === 'aim' && !far ? [-0.6, -1] : [-0.7, 0.7]);
      const u1 = pol(s0, angOf(s0, el), 3);
      const u2 = pol(el, angOf(el, s0), 3);
      const f1 = pol(el, angOf(el, hand), 3);
      return limbSeg(u1, u2, 6, 5, far) + limbSeg(f1, pol(hand, angOf(hand, el), 4), 5, 5.6, far) + joint(s0, 3.4) + joint(el, 3) +
        fistB(hand, angOf(el, hand), far);
    };
    const legG = (hip, foot, far) => {
      const ankle = [foot[0], groundAnkle(5) - foot[1]];
      const kn = ik(hip, ankle, 12, 12, [1, -0.2]);
      return limbSeg(pol(hip, angOf(hip, kn), 2.4), pol(kn, angOf(kn, hip), 2.6), 7, 6, far) +
        limbSeg(pol(kn, angOf(kn, ankle), 2.6), ankle, 6, 5.4, far) + joint(kn, 3.2) +
        boot(c, ankle, 16, 5, foot[2] || 0, brF(far ? -0.3 : -0.15), true);
    };

    /* 몸통 종(몸 좌표: 종 입 가운데 (0,0), 위가 −). crack: 금이 번진 정도 */
    const bellBody = (crack = 0) =>
      c.P('M-6 -40C-14 -40 -17.6 -32 -18.4 -21C-19.2 -11 -22 -5 -25 -2L25 -2C22 -5 19.2 -11 18.4 -21C17.6 -32 14 -40 6 -40Z', c.body(br, 0.42, -0.42)) +
      c.Pn('M8 -39.6C14 -38 17 -31 18 -21C18.8 -11 21.4 -5 24.6 -2L12 -2C13.6 -10 13 -24 8 -39.6Z', SHADE, 0.22) +
      c.L('M-17 -29C-6 -31.4 6 -31.4 17 -29M-19.6 -11C-6 -13 6 -13 19.6 -11', brD, 1.8) +
      c.L('M-16.6 -27.6C-6 -30 6 -30 16.6 -27.6', brL, 1.2, ' opacity=".6"') +
      c.L('M-10 -38C-11 -30 -12 -24 -12.6 -14M-4 -39C-4.6 -32 -5 -26 -5.4 -18', pat, 2, ' opacity=".85"') +
      c.P('M-26 -4L26 -4L27.4 1.6L-27.4 1.6Z', c.body(brD, 0.35, -0.3), TH) +
      c.L('M-25.6 -2.4H25.6', brL, 1.2, ' opacity=".5"') +
      // 깨진 자리: 뚫린 구멍 사이로 울림 심장
      c.P('M4 -26L12 -28L14 -20L9 -14L3 -17Z', '#1c1428', TH) +
      `<circle cx="8.6" cy="-21" r="6" fill="${glow}" opacity=".8" stroke="none" ${c.soft()}/>` + c.E(8.6, -21, 2.6, 2.6, '#ffffff', ' stroke="none"') +
      `<path d="M-14 -36L-10 -28L-14 -22L-9 -16" fill="none" stroke="${glow}" stroke-width="3.4" opacity=".55" ${c.soft()}/>` + c.L('M-14 -36L-10 -28L-14 -22L-9 -16', '#f4f0ff', 1.4) +
      (crack > 0 ? `<path d="M-9 -16L-4 -8L-10 -2M12 -28L18 -34M14 -20L22 -14" fill="none" stroke="${glow}" stroke-width="4" opacity=".6" ${c.soft()}/>` + c.L('M-9 -16L-4 -8L-10 -2M12 -28L18 -34M14 -20L22 -14', '#ffffff', 1.6) : '') +
      c.shine(-12, -32, 2.6, 6, 0.4, 12);
    /* 머리: 종 꼭지(고리) + 눈 틈이 있는 작은 투구 조각 */
    const headG = (lit = 1) =>
      c.E(0, -10, 4.2, 3.6, 'none', ' stroke-width="3.6"') + c.E(0, -10, 4.2, 3.6, 'none', ` stroke="${brL}" stroke-width="1.6"`) +
      c.P('M-8 4C-8.6 -3 -4.6 -7 1 -7C6.6 -7 9.6 -3 9.4 3L9.6 6L-8 6Z', c.body(br, 0.42, -0.36)) +
      c.P('M0.6 -1.4L9.4 -1.4L9.4 2.4L0.6 2.4Z', '#1c1428', TH) +
      (lit ? `<path d="M2 0.5H9" stroke="#fff" stroke-width="4" opacity="${0.55 * lit}" ${c.soft()}/>` + c.L('M2.2 0.5H4.4M6.4 0.5H8.8', '#ffffff', 1.8) : '') +
      c.L('M-6 -3C-3 -5.4 1 -5.8 4 -5', brL, 1.2, ' opacity=".7"');
    const dong = (x) => `<path d="M${x - 9} 80Q${x - 13} 86 ${x - 9} 90M${x + 9} 80Q${x + 13} 86 ${x + 9} 90M${x - 14} 77Q${x - 20} 85 ${x - 14} 91M${x + 14} 77Q${x + 20} 85 ${x + 14} 91" fill="none" stroke="${glow}" stroke-width="1.8" opacity=".75"/>` +
      motes(c, [[x - 6, 87, 1.2], [x + 7, 87.4, 1], [x - 10, 88, 0.9]], '#a89a84', 0.85);

    let s = '';
    if (fr === 'die1' || fr === 'die2') {
      if (fr === 'die1') {
        // 몸통이 두 쪽으로 갈라져 기울고, 틈에서 빛과 마지막 종소리
        s += `<circle cx="50" cy="56" r="40" fill="none" stroke="${glow}" stroke-width="2.4" opacity=".55"/><circle cx="50" cy="56" r="30" fill="none" stroke="${glow}" stroke-width="2" opacity=".7"/>`;
        s += legG([40, 70], [36, 0, 0], true) + legG([56, 72], [64, 0, 0], false);
        s += `<ellipse cx="50" cy="58" rx="10" ry="18" fill="${glow}" opacity=".7" stroke="none" ${c.soft()}/>`;
        s += g(c.P('M-6 -40C-14 -40 -17.6 -32 -18.4 -21C-19.2 -11 -22 -5 -25 -2L2 -2L6 -14L0 -22L5 -30L2 -40Z', c.body(br, 0.42, -0.42)) + c.L('M-17 -29C-10 -30.6 -4 -31 1 -30.6M-19.6 -11C-10 -12.6 -4 -12.8 1 -12.6', brD, 1.8) + c.L('M-10 -38C-11 -30 -12 -24 -12.6 -14', pat, 2, ' opacity=".85"') + c.P('M-26 -4L2 -4L2 1.6L-27.4 1.6Z', c.body(brD, 0.35, -0.3), TH), tr([40, 72], -24));
        s += g(c.P('M2 -40C10 -40 16 -32 17 -21C18 -11 21 -5 24 -2L2 -2L6 -14L0 -22L5 -30Z', c.body(br, 0.4, -0.42)) + c.L('M4 -29C10 -30.6 14 -30 17 -28.6', brD, 1.8) + c.L('M6 -38C8 -30 9 -22 10 -12', pat, 2, ' opacity=".8"'), tr([60, 72], 26));
        s += g(headG(0.3), tr([70, 30], 50, 1.1));
        s += fistB([20, 84], 160, true) + fistB([84, 84], 10, false);
        s += motes(c, [[30, 40, 1.4], [66, 36, 1.2], [76, 50, 1.6], [24, 60, 1.2]], brL, 0.9);
      } else {
        // 청동 조각 더미와 꺼져 가는 빛
        s += `<ellipse cx="50" cy="82" rx="16" ry="6" fill="${glow}" opacity=".35" stroke="none" ${c.soft()}/>`;
        s += c.P('M22 88.5L26 80L36 76L42 82L40 88.5Z', brF(-0.1)) + c.P('M38 88.5L44 74L56 72L62 80L60 88.5Z', brF(0)) + c.P('M58 88.5L62 78L74 80L78 88.5Z', brF(-0.15));
        s += c.L('M28 82L34 79M46 78L54 76M64 82L70 81', pat, 1.8) + c.L('M44 74L56 72', brL, 1.2, ' opacity=".6"');
        s += fistB([18, 84], 170, true) + g(headG(0), tr([84, 84], 96, 0.9));
        s += c.P('M44 86C44 82 56 82 56 86', 'none', ` stroke="${glow}" stroke-width="1.6" opacity=".7"`);
        s += `<path d="M36 64Q30 72 36 80M64 64Q70 72 64 80" fill="none" stroke="${glow}" stroke-width="1.6" opacity=".45"/>`;
        s += motes(c, [[46, 66, 1], [54, 62, 0.8], [50, 56, 0.7]], glow, 0.8);
      }
      return fin(c, s, 1.04);
    }

    const B = frameOf(P.p[0], P.p[1], P.lean);
    const nSh = B.p(-17, -28);
    const fSh = B.p(16, -30);
    s += armG(fSh, P.fh, true);
    s += legG(B.p(9, -3), P.ff, true) + legG(B.p(-8, -2), P.nf, false);
    s += g(bellBody(fr === 'die0' ? 1 : 0) + g(headG(fr === 'die0' ? 0.5 : 1), tr([5, -43], P.head)), B.t);
    s += segN(c, [nSh[0] + 4, nSh[1] + 4], [nSh[0] + 8, nSh[1] + 18], 4, 3, SHADE, 0.18);
    s += armG(nSh, P.nh, false);
    if (P.dong) s += dong(P.dong === 'n' ? P.nf[0] + 2 : P.ff[0] + 2);
    if (fr === 'aim') {
      s += `<circle cx="${P.nh[0]}" cy="${P.nh[1]}" r="11" fill="${glow}" opacity=".3" stroke="none" ${c.soft()}/>`;
      s += `<path d="M${P.nh[0] + 12} ${P.nh[1] - 6}A14 14 0 0 1 ${P.nh[0] + 14} ${P.nh[1] + 10}" fill="none" stroke="${glow}" stroke-width="1.6" opacity=".7"/>`;
    }
    if (fr === 'attack') {
      // 내리꽂은 주먹: 땅 충격 고리 + 갈라진 땅 + 튀는 돌
      const x = P.nh[0] + 6;
      s = `<ellipse cx="${x}" cy="88" rx="20" ry="5" fill="none" stroke="${glow}" stroke-width="2" opacity=".7"/><ellipse cx="${x}" cy="88" rx="12" ry="3" fill="none" stroke="#fff" stroke-width="1.8" opacity=".8"/>` + s;
      s += c.L(`M${x - 4} 89L${x - 12} 87.6L${x - 18} 89M${x + 4} 89L${x + 10} 87.4`, '#3a2e26', 1.6);
      s += c.P(`M${x - 14} 76L${x - 11} 73L${x - 9} 76Z`, '#a89a84', TH) + c.P(`M${x + 10} 72L${x + 14} 70L${x + 14} 74Z`, '#a89a84', TH) + c.P(`M${x + 4} 66L${x + 6} 63L${x + 8} 66Z`, '#a89a84', TH);
      s += streaks(c, [`M${x - 6} 52L${x - 4} 64`, `M${x + 2} 50L${x + 2} 62`, `M${x + 10} 54L${x + 8} 64`], glow, 1.8, 0.6);
    }
    if (fr === 'die0') {
      s += c.P('M78 30L84 26L86 32Z', brF(0), TH) + c.P('M80 44L86 42L85 48Z', brF(-0.1), TH);
      s += `<circle cx="52" cy="42" r="14" fill="#fff" opacity=".25" stroke="none" ${c.soft()}/>`;
    }
    return fin(c, s, 1.04);
  }
  D.bellshard_golem = (fr) => drawGolem(GOLEM[fr] || fr === 'die1' || fr === 'die2' ? fr : 'walk0');
  D.bellshard_golem.frames = true;
  // 쿵쿵 걸음: 위아래는 작지만 디딜 때마다 몸이 크게 기울어짐(무게)
  MOTION.bellshard_golem = { gait: 'stomp', bob: 0.02, tilt: 4, sway: 0, squash: 0.02, deathFx: 'shatter', deathTime: 1.0 };
  /* ==== END bellshard_golem ==== */

  /* ==== BEGIN silent_drake ==== */
  /* =========================================================
   * 39 · 침묵의 비룡 — 회색 비늘의 작은 비룡(날개 달린 앞다리 없는 용). 금빛 뿔, 하얀 눈,
   *   연보랏빛 날개막, 배는 바랜 금빛 비늘판, 꼬리 끝은 금빛 가시. 소리 없이 날갯짓.
   * walk(날기): 날개 위 → 가운데 → 아래 → 가운데, 날개가 내려칠 때 몸이 떠오름.
   * aim: 목을 S자로 젖히고 입을 벌리며 날개를 높이 펼침 / attack: 내리 덮치며 목을 뻗어 물기(이빨), 날개는 뒤로.
   * 죽음: 맞고 목이 꺾이며 날개 한쪽이 접힘 → 날개를 접고 머리부터 곤두박질 → 땅에 처박혀 날개가 구겨진 채 누움.
   * ========================================================= */
  const DRAKE = {
    //       가슴        몸 기울기  날개 각도 [먼, 가까운]  펼침   목 [굽음, 머리 각도]  입    꼬리 굽음  다리
    walk0: { c: [54, 57], lean: -4, wing: [-122, -100], spread: 1, neck: [0, 6], jaw: 4, tail: 6, legs: 0 },
    walk1: { c: [54, 55], lean: -2, wing: [-158, -140], spread: 1, neck: [2, 8], jaw: 4, tail: 0, legs: 0 },
    walk2: { c: [54, 50], lean: 0, wing: [140, 154], spread: 0.85, neck: [4, 10], jaw: 4, tail: -6, legs: 0 },
    walk3: { c: [54, 53], lean: -2, wing: [-168, -150], spread: 1, neck: [2, 8], jaw: 4, tail: 0, legs: 0 },
    aim: { c: [50, 59], lean: -22, wing: [-128, -106], spread: 1.05, neck: [-14, -22], jaw: 30, tail: -2, legs: 1 },
    attack: { c: [54, 56], lean: 18, wing: [-176, -170], spread: 0.8, neck: [12, 22], jaw: 38, tail: -12, legs: 2 },
    die0: { c: [52, 52], lean: -14, wing: [-120, 160], spread: 0.7, neck: [-18, -48], jaw: 20, tail: 14, legs: 0 },
    die1: { c: [52, 64], lean: 62, wing: [-170, -176], spread: 0.25, neck: [10, 30], jaw: 10, tail: -26, legs: 0 },
  };

  function drawDrake(fr) {
    const c = make(2.5);
    const scale = '#837f96';
    const scaleD = sh(scale, -0.3);
    const memb = '#a094bf';
    const belly = '#cdbd88';
    const P = DRAKE[fr];

    /* 날개: 뿌리 r에서 팔뼈가 각도 a로, 손목에서 손가락뼈 셋이 퍼지고 그 사이 막 */
    const wing = (r, a, sp, far, back) => {
      const w = pol(r, a, 17);
      const sg = a < 0 ? -1 : 1; // 손가락은 늘 꼬리 쪽으로 부채꼴
      const f1 = pol(w, a + sg * 4, 25);
      const f2 = pol(w, a + sg * (4 + 40 * sp), 23);
      const f3 = pol(w, a + sg * (4 + 82 * sp), 19);
      const m = (p, q, k) => pol(mid(p, q), angOf(p, q) + 90, k);
      const col = far ? sh(memb, -0.3) : memb;
      const bone = far ? sh(scaleD, -0.2) : scaleD;
      const sc = sg < 0 ? 1 : -1;
      return c.P(`M${pt(r)}L${pt(w)}L${pt(f1)}Q${pt(m(f1, f2, 3.6 * sc))} ${pt(f2)}Q${pt(m(f2, f3, 3.2 * sc))} ${pt(f3)}Q${pt(m(f3, back, 4 * sc))} ${pt(back)}Z`, c.lin([[0, sh(col, 0.15)], [1, sh(col, -0.3)]])) +
        c.L(`M${pt(w)}L${pt(f2)}M${pt(w)}L${pt(f3)}`, bone, 1.6) +
        seg(c, r, w, 2.8, 2.2, c.body(far ? sh(scale, -0.3) : scale, 0.3)) + seg(c, w, f1, 2, 1.2, bone) +
        c.P(`M${pt(pol(w, a - 120, 1.4))}L${pt(pol(w, a - 70, 5.6))}L${pt(pol(w, a - 40, 1.4))}Z`, GOLD, TH);
    };
    /* 머리(머리 좌표: 두개골 가운데 (0,0), 주둥이가 +x). jaw: 아래턱 벌림 각도 */
    const head = (jaw, eyes = 1) =>
      g(c.P('M-3 2C2 3.6 9 4 14 3.2L13.4 5.8C8 7.4 1 7 -4 4.8Z', c.body(sh(scale, -0.1), 0.3)) +
        (jaw > 12 ? c.P('M4 3.6L5 6.4L6 3.8M9 3.6L10 6.2L11 3.6', '#f6f2ff', ' stroke-width="1"') : ''), `rotate(${n(jaw)} -3 2.6)`) +
      (jaw > 12 ? c.P('M-2 2.4C3 3 8 3.2 13.4 2.8L12 4.6C7 5.4 2 5.2 -3 4.4Z', '#2a1630', ' stroke-width="1.2"') : '') +
      c.P('M-7 2C-8.6 -3 -5 -7.6 1 -7.6C5 -7.6 8 -6 10 -4.4L16 -1.6C17.4 -0.8 17 1.8 15.4 2.6C11 3.8 3 4 -3 3.8Z', c.body(scale, 0.4, -0.3)) +
      c.P('M-3 -6L-12 -12.6L-1 -8.6Z', c.lin([[0, '#fff1c0'], [1, GOLD]]), TH) + c.P('M1.6 -7.4L-4 -15.6L5 -8Z', c.lin([[0, '#fff1c0'], [1, GOLD]]), TH) +
      c.L('M-2 -1C2 -0.4 6 0 10 -0.6', scaleD, 1.2) +
      (eyes ? c.eye(6, -3.6, 1.9 * eyes, false) : c.L('M4.6 -3.6L7.6 -3.6', '#2a2236', 1.6)) +
      c.L('M14.2 0.2L16 0', '#2a2236', 1.3) +
      c.L('M-4 -5C0 -7 4 -7 8 -5.6', '#d8d4e4', 1.2, ' opacity=".7"');

    const body = (B) => {
      const tailBase = B.p(-15, 0);
      const tEnd = B.p(-42, 6 + P.tail);
      const tCtl = B.p(-30, -4 - P.tail);
      let out = ribbon(c, bez(tailBase, tCtl, tEnd, 12), 5, 1.2, c.body(scale, 0.3, -0.3));
      const ta = angOf(tCtl, tEnd);
      out += g(c.P('M0 0L6 -4L12 0L6 4Z', c.lin([[0, '#fff1c0'], [1, GOLD]]), TH), tr(tEnd, ta));
      // 다리(접었거나 앞으로 뻗음)
      const hip = B.p(-8, 5);
      const legEnd = P.legs === 2 ? B.p(6, 16) : P.legs === 1 ? B.p(0, 17) : B.p(-14, 14);
      const kn = ik(hip, legEnd, 7, 7, [1, 0.2]);
      out += seg(c, hip, kn, 3.6, 2.6, scaleD) + seg(c, kn, legEnd, 2.4, 1.8, scaleD) +
        g(c.P('M0 -1.6L4 -2.6L2 0L4.4 1.2L1 1.6Z', '#efe8d8', ' stroke-width="1"'), tr(legEnd, P.legs ? 20 : 70));
      out += g(
        c.P('M-17 0C-16 -6 -8 -8.6 2 -8.4C10 -8.2 15 -6 17 -1C17.6 4 13 8.4 4 8.6C-6 8.8 -15 6.4 -17 0Z', c.body(scale, 0.4, -0.34)) +
        c.P('M-12 5C-4 9 6 9.4 14 4.6C12 8 4 10 -3 9.6C-8 9.2 -11 7.6 -12 5Z', c.body(belly, 0.3, -0.3), TH) +
        c.L('M-6 7.6L-5.4 9.4M-1 8.2L-0.6 9.8M4 8L4.4 9.6M9 6.6L9.6 8', sh(belly, -0.35), 1.1) +
        c.L('M-14 -3C-6 -7 4 -7.4 14 -4', '#d8d4e4', 1.3, ' opacity=".6"') +
        c.P('M-6 -8L-4 -12L-2 -8.2ZM1 -8.4L3 -12.4L5 -8.2ZM8 -7.6L10 -11L11.6 -6.6Z', scaleD, TH) +
        c.Pn('M-14 3C-6 6 6 6.4 15 2L13 6C6 9 -6 9 -14 5Z', SHADE, 0.2),
        B.t);
      return out;
    };

    let s = '';
    if (fr === 'die2') {
      // 땅에 처박힘: 옆으로 누워 날개가 구겨지고, 먼지
      const B = frameOf(52, 81, 8);
      s += g(c.P('M0 0L-8 -12L-4 -11L-14 -18L-12 -10L-22 -12L-18 -4C-12 0 -6 1 0 0Z', c.lin([[0, sh(memb, -0.2)], [1, sh(memb, -0.45)]])) + c.L('M0 0L-8 -12M-2 0L-14 -18', scaleD, 1.4), tr([46, 78], -10));
      s += ribbon(c, bez([36, 84], [22, 86], [12, 82], 10), 4.6, 1.2, c.body(scale, 0.3, -0.3)) + g(c.P('M0 0L6 -4L12 0L6 4Z', c.lin([[0, '#fff1c0'], [1, GOLD]]), TH), tr([12, 82], 200));
      s += g(c.P('M-17 0C-16 -6 -8 -8.6 2 -8.4C10 -8.2 15 -6 17 -1C17.6 4 13 7 4 7.6C-6 7.8 -15 6 -17 0Z', c.body(scale, 0.4, -0.34)) +
        c.P('M-12 4.4C-4 8 6 8.2 14 4C12 6.8 4 8.6 -3 8.4C-8 8 -11 6.6 -12 4.4Z', c.body(belly, 0.3, -0.3), TH), B.t);
      s += ribbon(c, bez([64, 80], [70, 82], [73, 85], 8), 4.4, 3.2, c.body(scale, 0.35, -0.3));
      s += g(head(14, 0), tr([78, 84.4], 14));
      s += g(c.P('M0 0L10 -14L13 -6L22 -10L18 0L26 2C16 6 6 5 0 0Z', c.lin([[0, memb], [1, sh(memb, -0.3)]])) + c.L('M0 0L10 -14M2 1L22 -10', scaleD, 1.4), tr([54, 80], 6));
      s += motes(c, [[30, 86, 1.6], [40, 87, 1.2], [70, 87, 1.4], [92, 86, 1.2], [60, 84, 1]], '#a89a8c', 0.85);
      return fin(c, s, 1.04);
    }

    const B = frameOf(P.c[0], P.c[1], P.lean);
    const rootF = B.p(4, -7);
    const rootN = B.p(0, -6);
    s += wing(rootF, P.wing[0], P.spread, true, B.p(-12, -3));
    s += body(B);
    // 목 + 머리
    const nb = B.p(13, -4);
    const ha = P.neck[1];
    const hc = pol(nb, -55 + P.neck[0] + P.lean * 0.5, 15);
    const nctl = pol(nb, -20 + P.neck[0] * 0.5 + P.lean, 9);
    s += ribbon(c, bez(B.p(9, -2), nctl, hc, 8), 6, 3.8, c.body(scale, 0.38, -0.3));
    s += c.L(`M${pt(pol(B.p(10, 1), 0, 1))}Q${pt(pol(nctl, 60, 3))} ${pt(pol(hc, 100, 3))}`, belly, 2, ' opacity=".9"');
    s += g(head(P.jaw, fr === 'die1' ? 0.5 : 1), tr(hc, ha));
    s += wing(rootN, P.wing[1], P.spread, false, B.p(-13, -1));

    if (fr === 'aim') {
      const m = pol(hc, ha + 20, 14);
      s += `<circle cx="${n(m[0])}" cy="${n(m[1])}" r="5" fill="#e6e0ff" opacity=".45" stroke="none" ${c.soft()}/>`;
    }
    if (fr === 'attack') {
      // 덮치는 궤적과 물어뜯는 자국
      s += streaks(c, ['M20 30L40 42', 'M14 42L34 50', 'M22 22L38 32'], '#efeaff', 1.8, 0.55);
      const m = pol(hc, ha + 14, 18);
      s += `<path d="M${n(m[0] - 3)} ${n(m[1] - 7)}Q${n(m[0] + 4)} ${n(m[1])} ${n(m[0] - 3)} ${n(m[1] + 7)}" fill="none" stroke="#fff" stroke-width="2" opacity=".85"/>`;
    }
    if (fr === 'die0') {
      s += motes(c, [[40, 40, 1.4], [44, 34, 1.1], [36, 46, 1], [60, 36, 1.2]], '#c8c4d4', 0.9);
      s += c.L('M48 44l3 -4l-1 -3M48 44l4 2', '#fff', 1.6);
    }
    if (fr === 'die1') {
      s += streaks(c, ['M60 20L56 6', 'M70 24L68 10', 'M50 26L46 14'], '#efeaff', 1.6, 0.5);
    }
    return fin(c, s, 1.04);
  }
  D.silent_drake = (fr) => drawDrake(DRAKE[fr] || fr === 'die2' ? fr : 'walk0');
  D.silent_drake.frames = true;
  // 소리 없는 날갯짓: 높이 떠서 크게 오르내림
  MOTION.silent_drake = { gait: 'fly', bob: 0.04, tilt: 3, hover: 0.5, deathFx: 'crumble', deathTime: 0.9 };
  /* ==== END silent_drake ==== */

  /* ==== BEGIN resonance_eater ==== */
  /* =========================================================
   * 40 · 울림 포식자 — 해파리 같은 그림자. 반투명한 보랏빛 갓, 하얀 눈, 갓 아래 가장자리 주름,
   *   소리굽쇠(두 갈래) 모양 촉수 넷. 곁을 지나는 공명 선(금빛 실)이 끊겨 빨려 듦.
   * walk(떠다님): 갓이 펴졌다 오므라들며 앞으로 밀고 나감(촉수는 한 박자 늦게 따라옴).
   * aim: 갓을 뒤로 젖혀 아래 입(이빨 고리)을 크게 벌리고 소리굽쇠를 앞으로 세움 /
   * attack: 앞으로 덮치며 입을 탁 닫아 공명 실을 삼킴.
   * 죽음: 갓이 움푹 꺼지며 촉수가 뻗침 → 갓이 찢어지며 삼킨 울림(금빛 음표)이 터져 나옴 → 납작한 막과 소리굽쇠만 남음.
   * ========================================================= */
  const EATER = {
    //       갓 가운데     기울기  가로·세로 비   입 벌림  촉수 끝 흔들림 [4개 dx]           촉수 길이
    walk0: { c: [50, 40], tilt: 0, sx: 1.08, sy: 0.9, open: 0, sway: [-4, -2, 2, 4], len: 40 },
    walk1: { c: [51, 37], tilt: 4, sx: 0.98, sy: 1.02, open: 0, sway: [-7, -6, -4, -2], len: 42 },
    walk2: { c: [52, 34], tilt: 6, sx: 0.88, sy: 1.14, open: 0, sway: [-10, -9, -8, -7], len: 46 },
    walk3: { c: [51, 37], tilt: 3, sx: 0.98, sy: 1.02, open: 0, sway: [-6, -4, -2, 0], len: 43 },
    aim: { c: [46, 38], tilt: -18, sx: 1.06, sy: 1, open: 1, sway: [6, 10, 14, 18], len: 40 },
    attack: { c: [56, 44], tilt: 20, sx: 1.04, sy: 0.92, open: 0.15, sway: [14, 16, 18, 20], len: 36 },
    die0: { c: [48, 44], tilt: -10, sx: 1.16, sy: 0.74, open: 0.4, sway: [-14, -6, 6, 14], len: 36 },
  };

  function drawEater(fr) {
    const c = make(2.5);
    const shadow = '#3e3652';
    const fork = '#cfc8da';
    const P = EATER[fr];

    /* 소리굽쇠 끝: 자루 끝 p, 각도 a(갈래가 벌어지는 방향) */
    const tfork = (p, a, glow = 0) => g(
      (glow ? `<circle cx="0" cy="6" r="6" fill="${GOLD}" opacity="${n(0.35 * glow)}" stroke="none" ${c.soft()}/>` : '') +
      c.limb('M0 -1V2.4M-3.2 9.6V5.4Q-3.2 2.4 0 2.4Q3.2 2.4 3.2 5.4V9.6', 2.4, fork) +
      c.L('M-3.2 9V5.6M3.2 9V5.6', '#ffffff', 0.9, ' opacity=".7"'),
      tr(p, a - 90));
    /* 공명 실(금빛, 끊겨 흐려짐) */
    const thread = (d, op = 0.6) => `<path d="${d}" fill="none" stroke="${GOLD}" stroke-width="1.8" stroke-dasharray="6 4 2 5" opacity="${op}" stroke-linecap="round"/>`;

    /* 갓(갓 좌표: 가운데 (0,0)). open: 입 벌림 0~1, dent: 움푹 꺼짐 */
    const dome = (open, dent = 0, eyes = 1) => {
      const top = dent ? 'C-26 -8 -16 -14 -8 -12C-4 -6 4 -6 8 -12C16 -14 26 -8 24 10' : 'C-26 -8 -14 -20 0 -20C14 -20 26 -8 24 10';
      const lip = 10 - open * 7;
      let out = '';
      if (open > 0.05) {
        // 갓 아래로 드러난 입: 어둠 + 이빨 고리
        out += c.E(10, 11 + open * 3, 14, 3 + open * 9, c.rad([[0, '#120a1c'], [0.8, '#2a1a3a'], [1, '#4a2a50']], 0.5, 0.45, 0.6));
        const teeth = [];
        for (let i = 0; i < 9; i++) {
          const t = (i / 8) * Math.PI;
          const x = 10 - Math.cos(t) * 12;
          const y = 11 + open * 3 + Math.sin(t) * (2.4 + open * 8);
          teeth.push(`M${n(x - 1.5)} ${n(y)}L${n(x)} ${n(y - 3.4)}L${n(x + 1.5)} ${n(y)}Z`);
        }
        out += c.P(teeth.join(''), '#efe8f6', ' stroke-width="0.9"');
        out += `<ellipse cx="10" cy="${n(10 + open * 2)}" rx="6" ry="${n(2 + open * 3)}" fill="${GOLD}" opacity="${n(0.35 * open)}" stroke="none" ${c.soft()}/>`;
      }
      out += c.P(`M-24 10${top}Q18 ${n(lip + 5)} 12 ${n(lip + 1)}Q6 ${n(lip + 5)} 0 ${n(lip + 1)}Q-6 15 -12 11Q-18 15 -24 10Z`, c.rad([[0, '#9a8fbc', 0.96], [0.45, shadow, 0.95], [1, '#1c1628', 0.97]], 0.36, 0.28, 0.85));
      out += `<ellipse cx="-2" cy="-2" rx="11" ry="8" fill="#8f7fc0" opacity=".45" stroke="none" ${c.soft()}/>`;
      out += c.L('M-20 6C-12 2 -2 1.6 6 3', '#8f7fc0', 1.6, ' opacity=".8"');
      out += c.L(`M-22 9Q-17 12 -12 9.6Q-6 12.4 0 ${n(lip + 0.4)}Q6 ${n(lip + 3.4)} 12 ${n(lip)}`, '#6a5a9a', 1.5);
      out += c.Pn('M8 -17C18 -14 24 -6 23 8L16 9C18 0 16 -10 8 -17Z', SHADE, 0.25);
      out += c.E(10, -5, 7, 4.6, '#140c1e', TH);
      out += c.eye(8.4, -5, 1.9 * eyes, false) + c.eye(13.6, -4.6, 1.6 * eyes, false);
      out += c.shine(-10, -12, 4.6, 2.6, 0.4);
      out += c.L('M-16 -10C-10 -16 -2 -18 6 -17', '#d8d0f0', 1.3, ' opacity=".55"');
      return out;
    };
    const toW = (P0, lx, ly) => {
      const a = P0.tilt * RAD;
      const x = lx * P0.sx;
      const y = ly * P0.sy;
      return [P0.c[0] + x * Math.cos(a) - y * Math.sin(a), P0.c[1] + x * Math.sin(a) + y * Math.cos(a)];
    };
    const tentacles = (P0, glow = 0) => {
      let out = '';
      const roots = [-15, -5, 5, 15];
      roots.forEach((lx, i) => {
        const r = toW(P0, lx, 12);
        const endX = r[0] + P0.sway[i];
        const endY = Math.min(80, r[1] + P0.len - Math.abs(P0.sway[i]) * 0.5);
        const end = [endX, endY];
        const ctl = [r[0] + P0.sway[i] * -0.4 + (i % 2 ? 3 : -3), (r[1] + endY) / 2];
        const pts = bez(r, ctl, end, 10);
        out += ribbon(c, pts, 2.8, 1.6, c.body(sh(shadow, i % 2 ? -0.1 : 0), 0.3, -0.3));
        out += tfork(end, angOf(pts[8], end), glow);
      });
      return out;
    };
    const domeAt = (P0, open, dent, eyes) => g(dome(open, dent, eyes), `translate(${pt(P0.c)}) rotate(${n(P0.tilt)}) scale(${n(P0.sx)} ${n(P0.sy)})`);

    let s = '';
    if (fr === 'die1') {
      // 갓이 찢어지며 삼킨 울림이 금빛 음표로 터져 나옴
      const P0 = { c: [50, 62], tilt: 0, sx: 1.2, sy: 0.6, open: 0, sway: [-16, -8, 8, 16], len: 18 };
      s += tentacles(P0);
      s += g(c.P('M-24 10C-26 -2 -18 -10 -10 -11L-4 -2L-8 4L-2 8L-12 11Q-18 15 -24 10Z', c.body(shadow, 0.35, -0.3)) +
        c.P('M24 10C26 -2 18 -10 8 -11L4 -3L9 3L3 9L12 11Q18 15 24 10Z', c.body(shadow, 0.3, -0.35)) +
        c.eye(12, -2, 1.4, false), `translate(50 62) scale(1.2 0.9)`);
      s += `<ellipse cx="50" cy="56" rx="10" ry="12" fill="${GOLD}" opacity=".45" stroke="none" ${c.soft()}/>`;
      const note = (x, y, sc) => g(c.P('M0 0V-9L5 -11V-2', 'none', ` stroke="${GOLD}" stroke-width="1.8"`) + c.E(-1.6, 0.4, 2.2, 1.6, GOLD, ' stroke-width="1"') + c.E(3.4, -1.6, 2.2, 1.6, GOLD, ' stroke-width="1"'), tr([x, y], -10, sc));
      s += note(42, 40, 1) + note(58, 30, 0.9) + note(66, 44, 0.8) + note(34, 30, 0.7);
      s += motes(c, [[46, 24, 1.2], [54, 18, 1], [62, 22, 0.9], [38, 46, 1]], '#ffe9a8', 0.9);
      return fin(c, s, 1.02);
    }
    if (fr === 'die2') {
      // 납작해진 반투명 막과 땅에 떨어진 소리굽쇠
      s += c.P('M24 88.5C26 84 36 80 50 80C64 80 74 84 76 88.5Z', c.rad([[0, '#6a5a8a', 0.8], [1, '#2a2238', 0.85]], 0.4, 0.3, 0.8));
      s += c.L('M30 86Q40 83 50 84Q60 83 70 86', '#8f7fc0', 1.4, ' opacity=".7"');
      s += c.eye(58, 84, 1, false);
      s += tfork([18, 86], 175) + tfork([84, 85], 5) + tfork([30, 87.6], 160) + tfork([72, 87.4], 20);
      s += motes(c, [[44, 70, 1.1], [52, 62, 0.9], [60, 70, 1], [48, 52, 0.8]], '#ffe9a8', 0.8);
      return fin(c, s, 1.02);
    }

    // 주변 공명 실(끊겨 빨려 드는 금빛 선)
    if (fr.startsWith('walk')) {
      s += thread('M4 58Q16 52 26 56', 0.45) + thread('M78 22Q86 18 96 24', 0.4);
    }
    if (fr === 'aim') s += thread('M96 66Q80 60 66 54', 0.8) + thread('M98 40Q84 42 70 46', 0.7);
    s += tentacles(P, fr === 'aim' ? 1 : 0);
    s += domeAt(P, P.open, fr === 'die0' ? 1 : 0, 1);

    if (fr === 'aim') {
      const m = toW(P, 10, 16);
      s += `<circle cx="${n(m[0])}" cy="${n(m[1])}" r="9" fill="#d8d0ff" opacity=".3" stroke="none" ${c.soft()}/>`;
    }
    if (fr === 'attack') {
      // 탁 닫히는 입 + 끊겨 삼켜지는 실 조각
      const m = toW(P, 12, 12);
      s += streaks(c, [`M${n(m[0] + 6)} ${n(m[1] - 6)}L${n(m[0] + 14)} ${n(m[1] - 10)}`, `M${n(m[0] + 8)} ${n(m[1])}L${n(m[0] + 17)} ${n(m[1])}`, `M${n(m[0] + 6)} ${n(m[1] + 6)}L${n(m[0] + 14)} ${n(m[1] + 10)}`], '#f2eefa', 1.8, 0.75);
      s += thread(`M${n(m[0] + 4)} ${n(m[1] + 2)}L${n(m[0] + 16)} ${n(m[1] + 6)}`, 0.9) + motes(c, [[m[0] + 18, m[1] + 4, 1.2], [m[0] + 22, m[1] - 2, 1], [m[0] + 20, m[1] + 10, 0.9]], GOLD, 0.9);
    }
    if (fr === 'die0') {
      s += c.L('M44 30l2 5l-3 4M56 30l-2 5', '#f4f0ff', 1.6) + motes(c, [[32, 30, 1.2], [70, 32, 1.2], [50, 22, 1]], '#ffe9a8', 0.85);
    }
    return fin(c, s, 1.02);
  }
  D.resonance_eater = (fr) => drawEater(EATER[fr] || fr === 'die1' || fr === 'die2' ? fr : 'walk0');
  D.resonance_eater.frames = true;
  // 떠서 밀고 나감: 갓이 오므라들 때 쑥 나아가는 맥박
  MOTION.resonance_eater = { gait: 'float', bob: 0.05, tilt: 0, sway: 0.02, squash: 0.06, deathFx: 'mist', deathTime: 0.8 };
  /* ==== END resonance_eater ==== */

  /* ==== BEGIN bellkeeper ==== */
  /* =========================================================
   * 👑 보스 5 · 종지기 — 등에 큰 청동 종을 가죽끈으로 진 키 큰 회색 인물(초상화와 같은 모습).
   *   회색 두건 안에 종 모양 흰 가면(꼭지·오른쪽 금·하늘빛 눈 틈, 가면 아래 작은 추 구슬),
   *   손에는 대종을 치던 긴 종메(나무 자루 + 청동 테를 두른 메머리).
   * walk: 종메를 지팡이처럼 짚으며 엄숙하게 걷기(종이 등에서 흔들림) /
   * aim(보호막·순간이동 준비): 종메를 앞 위로 치켜들고 메머리에 결계 고리가 모임, 등의 종이 빛남 /
   * attack(능력·타격): 종메를 앞으로 내리쳐 종소리 고리가 퍼지고, 뒤에 순간이동 잔상.
   * 죽음: 가면에 금이 번지며 휘청 → 무릎 꿇고 가면이 반쪽 떨어짐(따뜻한 눈빛), 종이 등에서 내려앉음 →
   *   땅에 선 종에 법복이 기대 걸리고, 깨진 가면과 종메가 앞에 놓임. 종이 마지막으로 나직이 울림.
   * ========================================================= */
  const KEEPER = {
    //       골반          기울기  가까운 발      먼 발          종메 바닥 [x,y]  가까운 손   먼 손      머리   종 흔들림
    // 걷기·die0: 종메는 먼 손(앞쪽 팔)이 앞으로 짚음(두건 뒤로 지나감) / aim·attack: 두 손으로 몸 앞에서 휘두름
    walk0: { p: [44, 57], lean: 3, nf: [54, 0, 0], ff: [36, 1.2, 20], foot: [73, 89], nh: [39, 57], fh: [66, 50], head: 2, bell: -3 },
    walk1: { p: [44, 55.6], lean: 3, nf: [45, 0, 0], ff: [49, 5, 12], foot: [69, 89], nh: [40, 56], fh: [65, 49], head: 2, bell: 0 },
    walk2: { p: [44, 57], lean: 3, nf: [35, 1.2, 20], ff: [54, 0, 0], foot: [65, 89], nh: [41, 57], fh: [64, 50], head: 2, bell: 3 },
    walk3: { p: [44, 55.6], lean: 3, nf: [49, 5, 12], ff: [45, 0, 0], foot: [75, 83], nh: [40, 56], fh: [66, 49], head: 2, bell: 0 },
    aim: { p: [42, 57], lean: -7, nf: [34, 0, 4], ff: [55, 0, 0], foot: [26, 74], nh: [52, 39], fh: [57, 33], head: -8, bell: -6, two: true },
    attack: { p: [46, 58], lean: 14, nf: [32, 1, 18], ff: [60, 0, 0], foot: [22, 32], nh: [48.5, 53], fh: [55, 58], head: 8, bell: 6, two: true },
    die0: { p: [42, 57], lean: -14, nf: [33, 4, 18], ff: [52, 0, 0], foot: [82, 86], nh: [33, 48], fh: [62, 54], head: -18, bell: -10 },
    die1: { p: [42, 70], lean: 10, nf: [28, 0, 62, 86], ff: [55, 0, 0], foot: null, nh: [54, 66], fh: [58, 60], head: 28, bell: 0 },
  };

  function drawKeeper(fr) {
    const c = make(2.6);
    const robe = '#6e6e7c';
    const robeD = sh(robe, -0.28);
    const hoodC = '#8a8a96';
    const mask = '#ece6da';
    const strap = '#6a5a40';
    const bellC = '#b08a4a';
    const wood = '#6a4e36';
    const glow = '#cfeaff';
    const P = KEEPER[fr];

    /* 등의 큰 종(종 좌표: 꼭지 아래 (0,0), 입이 +y). 금은 오른쪽 */
    const bigBell = (lit = 0) =>
      c.E(0, -4, 4, 3.4, 'none', ' stroke-width="3.4"') + c.E(0, -4, 4, 3.4, 'none', ` stroke="#8a6a3a" stroke-width="1.6"`) +
      c.P('M-7 0C-14 0 -17 8 -17.6 18C-18.2 28 -21 34 -25 38L25 38C21 34 18.2 28 17.6 18C17 8 14 0 7 0Z', c.body(bellC, 0.42, -0.42)) +
      c.Pn('M7 0.6C13 2 16.4 9 17 18C17.6 28 20.6 34 24.6 38L12 38C13.4 28 13 12 7 0.6Z', SHADE, 0.22) +
      c.L('M-16.6 8C-6 6 6 6 16.6 8M-19.8 31C-6 29 6 29 19.8 31', '#7a5a2a', 1.8) +
      c.P('M-26 36L26 36L27 40.6L-27 40.6Z', c.body(sh(bellC, -0.25), 0.35), TH) +
      c.L('M10 2L6 10L11 16L7 24', OL, 2) + c.L('M10 2.6L6.4 10L11 16', '#efe2c0', 1, ' opacity=".7"') +
      c.En(-10, 22, 3, 2.4, '#6fa89a', 0.7) + c.En(-4, 34, 2.4, 1.6, '#6fa89a', 0.7) +
      (lit ? `<ellipse cx="0" cy="22" rx="20" ry="16" fill="#ffe6a8" opacity="${n(0.3 * lit)}" stroke="none" ${c.soft()}/>` : '') +
      c.shine(-10, 10, 2.6, 6, 0.45, 8);
    /* 종 모양 가면(가면 좌표: 가운데 (0,0)). split: 반쪽이 떨어진 모습, eyes: 눈빛 */
    const maskG = (eyes = 1, warm = false, split = false) => {
      const col = warm ? '#ffd88a' : glow;
      const slit = (x, s) => `M${x - 2.2} ${n(1.2 + s * 0.2)}Q${x} ${n(0.2)} ${x + 2.2} ${n(1.2 - s * 0.2)}`;
      const shape = split
        ? 'M0 -11C-4 -11 -6 -8 -6.2 -3C-6.4 2 -7.6 5 -9 7.6C-9.6 9 -9 10 -7.6 10L1 10L2 4L-0.6 -1L2 -6L0.6 -11Z'
        : 'M0 -11C-4 -11 -6 -8 -6.2 -3C-6.4 2 -7.6 5 -9 7.6C-9.6 9 -9 10 -7.6 10H7.6C9 10 9.6 9 9 7.6C7.6 5 6.4 2 6.2 -3C6 -8 4 -11 0 -11Z';
      return c.P(shape, c.body(mask, 0.3, -0.25)) +
        c.P('M-1.4 -11a1.4 1.4 0 0 1 2.8 0z', '#cfc6b6', TH) +
        c.L('M-7.6 8.6H7.6', '#b8b0a2', 1.3) +
        (split ? '' : c.L('M3.6 -9L2.2 -5L4 -2L2.6 2', OL, 1.4)) +
        (eyes ? `<circle cx="1" cy="1" r="6" fill="${col}" opacity="${n(0.3 * eyes)}" stroke="none" ${c.soft()}/>` + c.L(slit(-2.6, -1), OL, 2.6) + c.L(slit(-2.6, -1), col, 1.4) + (split ? '' : c.L(slit(3.2, 1), OL, 2.6) + c.L(slit(3.2, 1), col, 1.4)) : '') +
        c.E(0, 12.4, 1.6, 1.6, c.body('#6a6a78', 0.3), TH);
    };
    /* 종메: 바닥 f에서 각도 a로 길이 L, 끝에 메머리(자루와 직각인 원통) */
    const mallet = (f, a, L = 74, ward = 0) => {
      const top = pol(f, a, L);
      const hd = g(
        c.P('M-7.4 -3.6L7.4 -3.6L7.4 3.6L-7.4 3.6Z', c.lin([[0, '#a07a4a'], [0.5, '#7a5a34'], [1, '#4a3420']])) +
        c.P('M-8.8 -4.4L-5.4 -4.4L-5.4 4.4L-8.8 4.4ZM5.4 -4.4L8.8 -4.4L8.8 4.4L5.4 4.4Z', c.body(bellC, 0.35, -0.3), TH) +
        c.L('M-3.6 -3.4L-2.4 3.4M-0.6 -3.4L0.6 3.4M2.4 -3.4L3.6 3.4', '#3a2a1c', 1.1),
        tr(top, a + 90));
      return (ward ? `<circle cx="${n(top[0])}" cy="${n(top[1])}" r="13" fill="${glow}" opacity="${n(0.3 * ward)}" stroke="none" ${c.soft()}/>` +
        `<circle cx="${n(top[0])}" cy="${n(top[1])}" r="11" fill="none" stroke="${glow}" stroke-width="2" opacity=".9"/>` +
        `<circle cx="${n(top[0])}" cy="${n(top[1])}" r="7" fill="none" stroke="#ffffff" stroke-width="1.4" stroke-dasharray="3 3" opacity=".9"/>` : '') +
        seg(c, f, pol(f, a, L - 2), 1.9, 2.2, c.lin([[0, sh(wood, 0.2)], [1, sh(wood, -0.3)]], 'h')) +
        c.L(`M${pt(pol(f, a, L - 14))}L${pt(pol(f, a, L - 10))}M${pt(pol(f, a, 30))}L${pt(pol(f, a, 33))}`, '#3a2a1c', 2.6) +
        hd;
    };
    const sleeveArm = (s0, hand, far, pref = [-0.5, 1]) => {
      const el = ik(s0, hand, 12, 11, pref);
      const col = far ? sh(robe, -0.2) : robe;
      const cuff = pol(hand, angOf(hand, el), 3.4);
      const a = angOf(el, cuff);
      return seg(c, s0, el, 4.6, 4, col) +
        c.P(`M${pt(pol(el, a + 90, 4))}L${pt(pol(cuff, a + 90, 6.4))}Q${pt(pol(cuff, a, 2))} ${pt(pol(cuff, a - 90, 6.4))}L${pt(pol(el, a - 90, 4))}Z`, c.body(col, 0.3, -0.3)) +
        c.L(`M${pt(pol(el, a + 90, 1))}L${pt(pol(cuff, a + 90, 2.6))}`, sh(col, -0.3), 1.3);
    };
    const hand = (p, a, far) => fist(c, p, 2.8, c.body(far ? sh(hoodC, -0.2) : hoodC, 0.3, -0.3), a);

    let s = '';
    if (fr === 'die2') {
      // 땅에 선 종 + 기대어 걸린 빈 법복 + 깨진 가면 반쪽 둘 + 종메. 종이 나직이 울림(금빛 고리)
      s += `<path d="M14 54Q6 66 14 78M86 54Q94 66 86 78M8 48Q-2 66 8 84M92 48Q102 66 92 84" fill="none" stroke="#ffe6a8" stroke-width="1.8" opacity=".6"/>`;
      s += g(bigBell(0.6), tr([50, 48], 0, 1));
      s += c.P('M30 88.5C30 80 32 70 38 64C42 60 48 60 52 64C54 70 56 80 58 88.5Z', c.body(robe, 0.3, -0.35));
      s += c.L('M38 70Q36 80 37 88M46 66Q46 78 48 88', robeD, 1.5);
      s += g(c.P('M-10 6C-12 -4 -8 -12 0 -13C8 -13.6 12 -8 11.6 0L12 6C8 9 -4 9.6 -10 6Z', c.body(hoodC, 0.35, -0.3)) + c.P('M1 -9C5 -9.6 9 -7 10 -2L10.6 5L0.6 6C2.6 2 2.6 -4 1 -9Z', '#2a2632'), tr([40, 60], -40, 0.9));
      s += mallet([14, 87], -4, 66);
      s += g(maskG(0, false, true), tr([66, 82], 70, 0.95)) + g(maskG(0, false, true), tr([78, 84], -100, 0.95));
      s += motes(c, [[44, 40, 1], [56, 34, 0.9], [62, 44, 0.8], [50, 26, 0.8]], '#ffe9a8', 0.8);
      return fin(c, s, 1.02);
    }

    const B = frameOf(P.p[0], P.p[1], P.lean);
    const nSh = B.p(-7, -24);
    const fSh = B.p(7, -25.6);
    const headP = B.p(4, -34);

    // 1) 등의 종(맨 뒤) — die1에서는 등에서 내려와 뒤 땅에 놓임
    if (fr === 'die1') s += g(bigBell(0.3), tr([28, 55.6], -6, 0.8));
    else s += g(bigBell(fr === 'aim' ? 1 : 0), tr(B.p(-12, -44), P.lean + P.bell, 0.8));
    // 2) 다리(법복 밑으로 발만)
    const legO = (far) => ({ l1: 15, l2: 14.4, r1: 4, r2: 3.4, r3: 2.8, h: 4, len: 11, thigh: sh(robeD, far ? -0.2 : 0), shin: sh('#4a4a56', far ? -0.2 : 0), boot: c.body(sh('#3a3448', far ? -0.15 : 0), 0.3), shade: false });
    const lf = leg(c, B.p(3, 0), P.ff, legO(true));
    const ln = leg(c, B.p(-3, 1), P.nf, legO(false));
    // 3) 먼 팔(뒤)
    const farA = sleeveArm(fSh, P.fh, true, fr === 'aim' ? [0.4, 1] : [-0.3, 1]);
    // 4) 법복
    const xs = [lf.ankle[0], ln.ankle[0]];
    const back = Math.min(...xs) - 6;
    const front = Math.max(...xs) + 7;
    const kneeF = P.nf[0] > P.ff[0] ? ln.knee : lf.knee;
    const lifted = Math.max(P.nf[1], P.ff[1]);
    const hemB = [back, 85.4];
    const hemF = [front, 84.4 - lifted * 0.5];
    const wB = B.p(-11, 0);
    const wF = B.p(11, -1);
    const kneel = fr === 'die1';
    const robePath = kneel
      ? `M${pt(B.p(-10, -24))}C${pt(B.p(-13, -14))} ${pt(B.p(-13, -6))} ${pt(wB)}C${n(wB[0] - 4)} ${n(wB[1] + 8)} 22 82 20 88.5L66 88.5C66 82 64 76 ${pt([wF[0] + 2, wF[1] + 4])}C${pt(B.p(14, -10))} ${pt(B.p(13, -18))} ${pt(B.p(10, -25))}Z`
      : `M${pt(B.p(-10, -24))}C${pt(B.p(-13, -14))} ${pt(B.p(-13, -6))} ${pt(wB)}C${n(wB[0] - 3)} ${n(wB[1] + 12)} ${n(back - 1)} 78 ${pt(hemB)}` +
        `Q${n(back + (front - back) * 0.25)} 88 ${n(back + (front - back) * 0.45)} 86Q${n(back + (front - back) * 0.65)} 88 ${n(back + (front - back) * 0.82)} 85.8Q${n(front - 1)} 86.4 ${pt(hemF)}` +
        `C${n(kneeF[0] + 5)} ${n(kneeF[1] + 6)} ${n(kneeF[0] + 5)} ${n(kneeF[1] - 4)} ${pt([wF[0] + 1, wF[1] + 4])}C${pt(B.p(14, -10))} ${pt(B.p(13, -18))} ${pt(B.p(10, -25))}Z`;
    const robeSvg = c.P(robePath, c.body(robe, 0.32, -0.38)) +
      c.L(`M${pt(B.p(-5, 2))}Q${n(back + 5)} 76 ${n(back + (front - back) * 0.3)} 86.4M${pt(B.p(4, 2))}Q${n(kneeF[0])} ${n(kneeF[1] + 5)} ${n(back + (front - back) * 0.64)} 86.8`, robeD, 1.6) +
      c.Pn(`M${pt(B.p(6, -24))}C${pt(B.p(13, -16))} ${pt(B.p(13, -6))} ${pt([wF[0] + 1, wF[1] + 4])}L${pt([wF[0] - 4, wF[1] + 6])}C${pt(B.p(7, -6))} ${pt(B.p(7, -16))} ${pt(B.p(5, -24))}Z`, SHADE, 0.2) +
      g(
        // 가죽끈(V자로 어깨에서 허리로) + 허리띠 + 버클
        c.P('M-9 -24L-5.4 -24.6L4 -1L0.4 -0.6Z', c.body(strap, 0.3, -0.3), TH) + c.P('M9 -25.6L12 -24.4L5.6 -1L2.6 -1.2Z', c.body(sh(strap, -0.1), 0.3, -0.3), TH) +
        c.L('M-6 -20L-4.4 -16M9.2 -20L8 -16', '#c9b48a', 1.2) +
        c.P('M-11.4 -4L11.6 -5L11.8 -1L-11.6 0Z', '#4a3e34', TH) + c.P('M1 -5.4L5 -5.6L5 -0.6L1 -0.4Z', c.body(GOLD, 0.3, -0.3), TH),
        B.t);
    // 5) 두건 + 가면
    const hoodSvg = g(
      c.P('M-11 7C-13 -4 -9 -13.6 0 -14.6C9 -15.2 13.6 -9 13 0L13.6 8C9 11 -4 11.4 -11 7Z', c.body(hoodC, 0.36, -0.32)) +
      c.P('M1.4 -10.4C6.6 -11 10.8 -7.6 11.6 -2L12.2 7.4L1.2 8C3.4 3 3.4 -5 1.4 -10.4Z', '#2a2632', TH) +
      c.L('M-9 3C-6 6.4 -2 7.6 2 7.8', sh(hoodC, -0.3), 1.5) +
      c.L('M-6.6 -10C-2.6 -13 2 -13.4 6 -12', sh(hoodC, 0.35), 1.3, ' opacity=".7"'),
      tr(headP, P.lean + P.head));
    const maskP = pol(headP, P.lean + P.head - 6, 7);
    const maskSvg = g(maskG(fr === 'die1' ? 1 : fr === 'die0' ? 0.6 : fr === 'aim' ? 1.4 : 1, fr === 'die1', fr === 'die1'), `${tr(maskP, P.lean + P.head * 0.5)} scale(0.86 1.02)`);

    // 그리기 순서
    const L = 78;
    const sa = P.foot ? angOf(P.foot, P.two ? P.nh : P.fh) : 0;
    const malletSvg = P.foot ? mallet(P.foot, sa, L, fr === 'aim' ? 1 : 0) : mallet([70, 87.6], 178, 66);
    const nearA = sleeveArm(nSh, P.nh, false, fr === 'aim' ? [-0.6, 0.8] : [-0.5, 1]);
    if (fr === 'die1') s = malletSvg + s;
    s += lf.svg + ln.svg;
    s += farA;
    if (P.foot && !P.two) s += malletSvg + hand(P.fh, sa + 90, true);
    s += robeSvg + hoodSvg + maskSvg;
    s += segN(c, [nSh[0] + 3, nSh[1] + 3], [P.nh[0] + 2, P.nh[1] - 2], 3.4, 3, SHADE, 0.14);
    if (P.two) s += malletSvg + hand(P.fh, sa + 90, true);
    s += nearA + hand(P.nh, P.two ? sa + 90 : 70, false);
    if (fr === 'die1') s += hand(P.fh, 60, true);

    if (fr === 'attack') {
      // 종소리 고리(메머리에서) + 순간이동 잔상(뒤)
      const top = pol(P.foot, sa, L);
      s = `<g opacity=".28" transform="translate(-20 -2)"><path d="${robePath}" fill="#cfeaff" stroke="#cfeaff"/></g>` + s;
      s += streaks(c, ['M8 40L24 40', 'M4 52L22 52', 'M10 64L24 64'], glow, 2, 0.6);
      s += `<circle cx="${n(top[0])}" cy="${n(top[1])}" r="7" fill="#fff" opacity=".6" stroke="none" ${c.soft()}/>`;
      s += [7, 11, 15].map((r, i) => `<circle cx="${n(top[0])}" cy="${n(top[1])}" r="${r}" fill="none" stroke="${i ? glow : '#ffffff'}" stroke-width="${2.4 - i * 0.5}" opacity="${n(0.9 - i * 0.22)}"/>`).join('');
    }
    if (fr === 'die0') {
      s += c.mist([[maskP[0] + 8, maskP[1] - 6, 2.6], [maskP[0] + 12, maskP[1] - 10, 2]], '#e6e2ea', 0.7);
    }
    if (fr === 'die1') {
      // 떨어지는 가면 반쪽
      s += g(maskG(0, false, true), tr([70, 80], 150, 0.62));
    }
    return fin(c, g(s, 'translate(3 0)'), 0.95);
  }
  D.bellkeeper = (fr) => drawKeeper(KEEPER[fr] || fr === 'die2' ? fr : 'walk0');
  D.bellkeeper.frames = true;
  // 엄숙한 걸음: 느리고 크게 가라앉았다 올라옴, 몸이 살짝 좌우로 기움
  MOTION.bellkeeper = { gait: 'walk', bob: 0.03, tilt: 2, sway: 0.01, deathFx: 'shatter', deathTime: 1.2 };
  /* ==== END bellkeeper ==== */

  /* ==== BEGIN the_silence ==== */
  /* =========================================================
   * 👑 최종 보스 · 침묵 — 대종의 금 간 틈에서 흘러나온 거대한 잿빛 형체.
   *   아래는 땅에 고인 잿빛 안개, 위로 굽은 거대한 어깨 망토와 긴 팔(세 갈래 갈고리 손),
   *   얼굴 대신 앞을 향한 깨진 종의 입(속은 텅 빈 어둠, 깊숙이 작은 하얀 눈 둘).
   *   몸 곳곳의 금에서 희미한 빛, 둘레를 떠도는 청동 조각, 빨려 드는 여섯 원소의 빛.
   * walk(흘러옴): 안개 밑동이 굴러가며 몸이 좌우로 일렁이고 팔이 번갈아 흔들림, 조각이 돎.
   * aim(능력 준비·페이즈 전환): 몸을 일으켜 두 팔을 활짝 벌리고, 여섯 원소의 실이 종 입으로 빨려 듦.
   * attack(공명 정지): 앞으로 덮치며 종 입에서 소리 없는 충격 고리 — 원소의 실이 회색으로 얼어 끊김.
   * 죽음: 종 얼굴의 금이 터지며 빛이 샘 → 몸이 재로 흩어지고 속에서 여섯 빛이 터져 나옴 →
   *   땅에 놓인 깨진 종과, 그 위로 다시 울리는 듯한 금빛 고리.
   * ========================================================= */
  const SIL = {
    //       흔들림  들림   가까운 팔 끝  먼 팔 끝    머리 [x,y,각도]       입빛   조각 회전
    walk0: { sw: 0, up: 0, nc: [14, 76], fc: [84, 74], head: [60, 30, -6], mouth: 0.6, orb: 0 },
    walk1: { sw: 2, up: 1.2, nc: [18, 74], fc: [82, 76], head: [61, 29, -4], mouth: 0.6, orb: 1 },
    walk2: { sw: 0, up: 0, nc: [20, 77], fc: [86, 72], head: [60, 30, -8], mouth: 0.6, orb: 2 },
    walk3: { sw: -2, up: 1.2, nc: [16, 74], fc: [84, 75], head: [59, 29, -5], mouth: 0.6, orb: 3 },
    aim: { sw: -2, up: 5, nc: [8, 26], fc: [92, 24], head: [57, 26, -22], mouth: 1, orb: 1 },
    attack: { sw: 4, up: -2, nc: [22, 66], fc: [90, 54], head: [63, 34, 8], mouth: 1.4, orb: 2 },
    die0: { sw: -4, up: 2, nc: [8, 48], fc: [90, 36], head: [57, 28, -30], mouth: 0.3, orb: 0 },
  };
  const ELEM6 = [EMBER, ICE, VOLT, '#8fcf5a', '#ffe48a', '#d14fc0'];

  function drawSilence(fr) {
    const c = make(2.6);
    const ash = '#6c6582';
    const ashD = sh(ash, -0.3);
    const mantle = '#827a98';
    const bronze = sh(BRONZE, -0.08);
    const crackC = '#efeaff';
    const P = SIL[fr];

    const crack = (d, op = 1) => `<path d="${d}" fill="none" stroke="#d8ccff" stroke-width="4.4" opacity="${n(0.5 * op)}" ${c.soft()}/>` + c.L(d, crackC, 1.7, op < 1 ? ` opacity="${n(op)}"` : '');
    const shard = (x, y, a, sc = 1) => g(c.P('M-6 -4L6 -6L5 4L-4 6Z', c.body(bronze, 0.4, -0.45)) + c.L('M-3 -3L3 -4', sh(bronze, 0.4), 1.2, ' opacity=".7"'), tr([x, y], a, sc));
    /* 깨진 종 얼굴(종 좌표: 입이 +x를 향함, 꼭지가 −x). eyes: 눈빛, open: 입 속 빛 */
    const bellFace = (eyes = 1, open = 0.6, broken = 0) =>
      c.E(-21, 0, 4.4, 5, 'none', ' stroke-width="3.6"') + c.E(-21, 0, 4.4, 5, 'none', ` stroke="${sh(bronze, 0.3)}" stroke-width="1.6"`) +
      c.P('M-17 -6C-17 -13 -9 -16 0 -17C6 -17.6 10 -19 13 -22L16 -20L15 -12L16 -4L16 4L15 12L16 20L13 22C10 19 6 17.6 0 17C-9 16 -17 13 -17 6Z', c.body(bronze, 0.42, -0.45)) +
      c.Pn('M-10 8C-4 13 4 15 13 18L13 22C10 19 6 17.6 0 17C-9 16 -17 13 -17 6Z', SHADE, 0.25) +
      c.L('M-12 -12C-12 -4 -12 4 -12 12M2 -16C3 -6 3 6 2 16', sh(bronze, -0.45), 1.8) +
      c.L('M-14 -10C-13 -14 -8 -15 -3 -15.6', '#f6e2a0', 1.4, ' opacity=".6"') +
      c.En(-6, 8, 2.6, 1.8, '#6fa89a', 0.7) + c.En(4, -11, 2, 1.4, '#6fa89a', 0.7) +
      // 입(테두리 + 텅 빈 속)
      c.E(15, 0, 6.4, 22, c.body(sh(bronze, 0.12), 0.35, -0.3)) +
      c.E(16, 0, 4.4, 18.6, c.rad([[0, '#3a2a50'], [0.7, '#140c20'], [1, '#05030a']], 0.5, 0.5, 0.6)) +
      (open > 0.7 ? `<ellipse cx="17" cy="0" rx="4" ry="${n(10 * open)}" fill="#d8ccff" opacity="${n(0.22 * open)}" stroke="none" ${c.soft()}/>` : '') +
      c.P('M12 -14L17 -10L14 -6L19 -3L18 4L13 -1Z', '#140c20', TH) +
      (eyes ? c.eye(17, -4.6, 1.8 * eyes, false) + c.eye(17.6, 4.4, 1.6 * eyes, false) : '') +
      c.L('M-2 -16.6L-6 -8L0 -2L-5 6', OL, 2.2) + c.L('M-2 -16L-5.6 -8L0 -2', crackC, 1.1, ' opacity=".9"') +
      (broken ? crack('M-5 6L2 10L-2 16M0 -2L8 -6L12 -12', 1) : '');
    /* 갈고리 손: 손목 p, 방향 a */
    const claw = (p, a, fill) => g(
      c.P('M-4 -4C0 -6 4 -5 6 -2C6 2 4 5 -4 4Z', fill) +
      c.P('M4 -3Q12 -10 18 -9Q12 -6 6 -1ZM5 -0.5Q14 -1 20 2Q13 2.6 5 2ZM4 2Q10 7 14 12Q8 9 2 4Z', fill, ' stroke-width="1.8"') +
      c.L('M14 -8.6L17.6 -9M17 1.8L19.6 2M12 10L13.6 11.6', '#e8e2f2', 1.3, ' opacity=".8"'),
      tr(p, a));
    const armS = (s0, end, far, pref) => {
      const el = ik(s0, end, 20, 19, pref);
      const col = far ? c.body(mantle, 0.3, -0.35) : c.body(ashD, 0.3, -0.3);
      return ribbon(c, [s0, mid(s0, el, 0.5), el], 7.4, 5.4, col) + ribbon(c, [el, mid(el, end), end], 5.4, 3.6, col) +
        claw(end, angOf(el, end), far ? c.body(mantle, 0.3) : ashD);
    };
    const orbit = (k) => {
      const pts = [[12, 36, 20], [28, 14, -30], [90, 26, 50], [94, 58, 10], [6, 60, -20]];
      return pts.map(([x, y, a], i) => {
        const t = ((k + i) % 4) * (Math.PI / 2);
        return shard(n(x + Math.cos(t) * 2.4), n(y + Math.sin(t) * 2.4), a + k * 12, i % 2 ? 0.85 : 1);
      }).join('');
    };
    const motesE = (k, pull = 0) => ELEM6.map((col, i) => {
      const base = [[8, 22], [22, 8], [94, 18], [6, 84], [86, 6], [96, 86]][i];
      const x = base[0] + (pull ? 0 : ((k + i) % 2 ? 1.6 : -1.6));
      const y = base[1] + (pull ? 0 : ((k + i) % 2 ? -1.4 : 0));
      return c.spark(n(x), n(y), 1.6, col);
    }).join('');

    let s = '';
    if (fr === 'die1') {
      // 재로 흩어지는 몸, 속에서 여섯 빛이 터져 나옴, 종 얼굴은 기울어 떨어짐
      s += `<ellipse cx="50" cy="52" rx="34" ry="30" fill="#fff6dc" opacity=".35" stroke="none" ${c.soft()}/>`;
      s += c.cloud([[16, 84, 5], [28, 80, 8], [44, 78, 9], [60, 78, 9], [74, 80, 7], [86, 84, 5]], c.body('#9a94ac', 0.3, -0.2), 0.8);
      s += `<g opacity=".7">${c.P('M22 78C20 64 24 50 34 44L66 42C78 46 82 60 80 78Z', c.body(mantle, 0.3, -0.35))}</g>`;
      s += crack('M34 50L42 60L36 70M64 48L58 58L66 70M50 44L52 56', 1);
      s += ELEM6.map((col, i) => {
        const a = -150 + i * 24;
        const p1 = pol([50, 56], a, 10);
        const p2 = pol([50, 56], a, 40);
        return `<path d="M${pt(p1)}L${pt(p2)}" stroke="${col}" stroke-width="3.2" opacity=".85" stroke-linecap="round"/>` + c.spark(n(p2[0]), n(p2[1]), 1.8, col);
      }).join('');
      s += motes(c, [[18, 50, 1.6], [26, 40, 1.3], [80, 44, 1.5], [84, 56, 1.2], [14, 66, 1.2], [90, 70, 1]], '#7a7488', 0.85);
      s += g(bellFace(0.4, 0.3, 1), tr([62, 42], 30, 0.8));
      s += shard(14, 30, 40) + shard(88, 28, -20, 0.8) + shard(30, 70, 60);
      return fin(c, s, 0.92);
    }
    if (fr === 'die2') {
      // 땅에 놓인 깨진 종 + 다시 울리는 금빛 고리 + 흩어지는 재
      s += `<ellipse cx="50" cy="74" rx="32" ry="16" fill="#ffe6a8" opacity=".35" stroke="none" ${c.soft()}/>`;
      s += [14, 22, 30].map((r, i) => `<ellipse cx="50" cy="76" rx="${r * 1.4}" ry="${r * 0.55}" fill="none" stroke="${GOLD}" stroke-width="${2 - i * 0.4}" opacity="${n(0.8 - i * 0.2)}"/>`).join('');
      s += c.cloud([[22, 86, 3.6], [34, 85, 4.6], [66, 85, 4.6], [78, 86, 3.6]], c.body('#9a94ac', 0.3, -0.2), 0.6);
      s += g(bellFace(0, 0, 1), `translate(50 64) rotate(90) scale(0.9)`);
      s += ELEM6.map((col, i) => c.spark(n(26 + i * 9.6), n(40 + (i % 2 ? -6 : 4)), 1.6, col)).join('');
      s += motes(c, [[30, 60, 1.2], [70, 58, 1.1], [44, 50, 0.9], [58, 46, 0.9]], '#8a8494', 0.8);
      return fin(c, s, 1.02);
    }

    const sw = P.sw;
    const up = P.up;
    // 뒤 빛 무리 + 원소 빛
    s += `<ellipse cx="54" cy="44" rx="40" ry="34" fill="${BELL}" opacity="${fr === 'aim' ? 0.5 : 0.32}" stroke="none" ${c.soft()}/>`;
    const k = P.orb;
    if (fr === 'aim') {
      // 여섯 원소의 실이 종 입으로 빨려 듦
      const m = pol([P.head[0], P.head[1]], P.head[2], 14);
      s += ELEM6.map((col, i) => {
        const b = [[6, 40], [18, 6], [96, 40], [4, 70], [80, 4], [98, 70]][i];
        return `<path d="M${b[0]} ${b[1]}Q${n((b[0] + m[0]) / 2)} ${n((b[1] + m[1]) / 2 + (i % 2 ? 8 : -8))} ${pt(m)}" fill="none" stroke="${col}" stroke-width="2" opacity=".75" stroke-dasharray="5 3"/>` + c.spark(b[0], b[1], 1.6, col);
      }).join('');
    } else if (fr === 'attack') {
      // 얼어 끊긴 회색 실
      s += ['M4 30L20 36', 'M8 12L22 20', 'M96 14L84 20', 'M2 62L16 60', 'M70 4L72 14'].map((d) => `<path d="${d}" fill="none" stroke="#b8b4c4" stroke-width="2.4" stroke-dasharray="4 3"/>`).join('');
    } else {
      s += motesE(k);
    }
    // 먼 쪽(뒤) 팔
    const nShoulder = [20 + sw, 42 - up];
    const fShoulder = [80 + sw, 40 - up];
    s += armS(nShoulder, P.nc, false, fr === 'aim' ? [-1, 0.4] : [-1, 0.2]);
    // 몸통(아래는 안개 밑동)
    s += c.P(`M${30 + sw} 56C${28 + sw * 0.6} 66 26 76 22 84L78 84C74 76 ${72 + sw * 0.6} 66 ${70 + sw} 56Z`, c.body(ash, 0.25, -0.35));
    s += crack(`M${44 + sw * 0.6} 62L48 70L44 78`);
    const roll = fr.startsWith('walk') ? ['walk0', 'walk1', 'walk2', 'walk3'].indexOf(fr) : 0;
    const base = [[15, 85, 4], [24, 82, 6.4], [38, 81, 8], [54, 81, 8], [68, 82, 7], [81, 84, 5]].map(([x, y, r], i) => [x + ((roll + i) % 2 ? 1.6 : -1.2), y + ((roll + i) % 3 === 0 ? -0.8 : 0), r]);
    s += c.cloud(base, c.body('#9a94ac', 0.3, -0.2));
    s += c.mist(base.map(([x, y, r]) => [x - 2, y - r * 0.4, r * 0.4]), '#d4cfe2', 0.45);
    // 어깨 망토(해진 끝)
    const m0 = `M${10 + sw} ${54 - up}C${11 + sw} ${41 - up} ${24 + sw} ${32 - up} ${40 + sw} ${32 - up}L${74 + sw} ${32 - up}C${88 + sw} ${34 - up} ${94 + sw} ${44 - up} ${92 + sw} ${56 - up}`;
    const hem = [86, 82, 74, 66, 58, 50, 42, 34, 26, 18].map((x, i) => `L${x + sw} ${(i % 2 ? 61 : 53) - up + (i % 3 === 0 ? 1 : 0)}`).join('');
    s += c.P(`${m0}${hem}Z`, c.body(mantle, 0.32, -0.36));
    s += c.Pn(`M${60 + sw} ${33 - up}C${80 + sw} ${34 - up} ${92 + sw} ${44 - up} ${92 + sw} ${56 - up}L${86 + sw} ${53 - up}L${82 + sw} ${61 - up}L${74 + sw} ${53 - up}C${74 + sw} ${44 - up} ${68 + sw} ${38 - up} ${60 + sw} ${33 - up}Z`, SHADE, 0.2);
    s += c.L(`M${16 + sw} ${46 - up}C${22 + sw} ${38 - up} ${30 + sw} ${35 - up} ${40 + sw} ${34 - up}`, '#c8c0dc', 1.5, ' opacity=".6"');
    s += crack(`M${28 + sw} ${38 - up}L${33 + sw} ${45 - up}L${29 + sw} ${52 - up}`) + crack(`M${76 + sw} ${40 - up}L${71 + sw} ${47 - up}L${76 + sw} ${53 - up}`);
    s += c.mist([[24 + sw, 36 - up, 3], [34 + sw, 33 - up, 3], [84 + sw, 38 - up, 2.6]], '#d9d4e8', 0.5);
    // 청동 조각
    s += orbit(k);
    // 머리(깨진 종 얼굴)
    s += g(bellFace(fr === 'die0' ? 0.5 : 1, P.mouth, fr === 'die0' ? 1 : 0), tr([P.head[0] + sw, P.head[1] - up], P.head[2], 0.86));
    // 가까운 쪽 팔(앞)
    s += armS(fShoulder, P.fc, true, fr === 'aim' ? [1, 0.4] : [1, 0.2]);

    if (fr === 'attack') {
      // 소리 없는 충격 고리(회색 점선) — 종 입에서 앞으로
      const m = pol([P.head[0] + sw, P.head[1] - up], P.head[2], 18);
      s += `<ellipse cx="${n(m[0] + 4)}" cy="${n(m[1])}" rx="12" ry="22" fill="#e8e4f0" opacity=".3" stroke="none" ${c.soft()}/>`;
      s += [8, 14, 20].map((r, i) => {
        const a1 = pol(m, -60, r);
        const a2 = pol(m, 60, r);
        return `<path d="M${pt(a1)}A${r} ${r} 0 0 1 ${pt(a2)}" fill="none" stroke="#f2eefa" stroke-width="${3 - i * 0.6}" stroke-dasharray="${n(r * 0.4)} ${n(r * 0.2)}" opacity="${n(0.95 - i * 0.22)}" stroke-linecap="round"/>`;
      }).join('');
    }
    if (fr === 'die0') {
      s += `<ellipse cx="56" cy="24" rx="16" ry="14" fill="#fff" opacity=".3" stroke="none" ${c.soft()}/>`;
      s += motes(c, [[40, 16, 1.4], [72, 12, 1.2], [80, 30, 1.1]], '#c8c0dc', 0.85);
    }
    return fin(c, s, 0.92);
  }
  D.the_silence = (fr) => drawSilence(SIL[fr] || fr === 'die1' || fr === 'die2' ? fr : 'walk0');
  D.the_silence.frames = true;
  // 땅을 미끄러지듯 흘러옴: 위아래보다 크게 일렁이고 늘었다 줄었다 함
  MOTION.the_silence = { gait: 'float', bob: 0.015, tilt: 1.5, sway: 0.03, squash: 0.03, deathFx: 'sparks', deathTime: 1.2 };
  /* ==== END the_silence ==== */
})();
