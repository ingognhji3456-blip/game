'use strict';

/* =========================================================
 * 장면 그림 (SVG 문자열) — 타이틀(로비) 풍경과 월드 지도
 * 규격: docs/ARCHITECTURE.md §5, 다듬기 기준: docs/design/animation.md §7
 *
 *   RG.art.TITLE                    타이틀 장면 좌표 { w, h, lantern:[x,y] }
 *   RG.art.titleLayer(name)         'sky' | 'far' | 'mid' | 'village' | 'front' → viewBox 0 0 1600 1000 (층마다 한 장, 시차용)
 *   RG.art.titleCloud(i)            떠다니는 노을 구름 0~3 → viewBox 0 0 600 220
 *   RG.art.titleRays()              울림등 빛줄기 → viewBox 0 0 1000 1000 (가운데가 등불)
 *   RG.art.logoFlourish()           로고 아래 금빛 장식 → viewBox 0 0 640 60
 *   RG.art.elementGem(el)           원소 보석 → viewBox 0 0 64 64
 *   RG.art.WORLD                    월드 지도 좌표 { w, h, nodes:{id:[x,y]}, regions:[...], road }
 *   RG.art.worldMap()               월드 지도 그림 → viewBox 0 0 2400 1000
 *   RG.art.worldFog(i)              잠긴 지역을 덮는 잿빛 안개 → viewBox 0 0 600 1000
 *   RG.art.mapMedallion(region, state, kind)  지도 노드 메달 → viewBox 0 0 100 100
 *   RG.art.starBar(n)               별 0~3개 띠 → viewBox 0 0 84 30
 *   RG.art.regionEmblem(id)         지역 문장 → viewBox 0 0 64 64
 *
 * 화면 전체로 보이는 그림이라 전투 그림과 달리
 *   - 먼 것은 윤곽선 없이 대기 원근(하늘색에 섞임), 가까운 것만 진한 바깥 윤곽(안쪽 선은 그 자리 색의 어두운 변형)
 *   - 명암은 세 단계 + 색을 튼 그늘 + 빛 쪽 반사광(rim). 타이틀은 해 질 녘 역광(노을 + 울림등), 지도는 왼쪽 위 빛.
 * 무작위는 시드 난수(prng)만 씁니다 → 늘 같은 그림.
 * ========================================================= */
(() => {
  const Math = globalThis.Math;
  const h = RG.art._h;
  const OL = h.OL;
  const f = (v) => Math.round(v * 10) / 10;
  const f2 = (v) => Math.round(v * 100) / 100;
  const { mix, shade } = h;
  const EL = () => RG.data.elements;
  const RAINBOW = ['dark', 'storm', 'frost', 'earth', 'light', 'fire'];

  /* ---------------- 공용 도우미 ---------------- */
  /** 시드 난수 (mulberry32) */
  function prng(seed) {
    let s = (typeof seed === 'number' ? seed : [...String(seed)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7)) >>> 0;
    if (!s) s = 1;
    return () => {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** defs 모음 + SVG 감싸기 */
  function bag() {
    const defs = [];
    const stops = (list) => list.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a != null && a !== 1 ? ` stop-opacity="${f2(a)}"` : ''}/>`).join('');
    const tfs = (tf) => (tf ? ` gradientTransform="${tf}"` : '');
    return {
      /** 비율 좌표 선형 그라데이션 */
      lg(list, x1 = 0, y1 = 0, x2 = 0, y2 = 1) { const id = h.uid('sc'); defs.push(`<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops(list)}</linearGradient>`); return `url(#${id})`; },
      /** 장면 좌표 선형 그라데이션 */
      lgu(x1, y1, x2, y2, list) { const id = h.uid('sc'); defs.push(`<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}">${stops(list)}</linearGradient>`); return `url(#${id})`; },
      /** 비율 좌표 방사형 */
      rg(list, cx = 0.5, cy = 0.5, r = 0.5) { const id = h.uid('sc'); defs.push(`<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">${stops(list)}</radialGradient>`); return `url(#${id})`; },
      /** 장면 좌표 방사형 (sy: 세로 눌림) */
      rgu(cx, cy, r, list, sy = 1) {
        const id = h.uid('sc');
        const tf = sy !== 1 ? `translate(${f(cx)} ${f(cy)}) scale(1 ${sy}) translate(${f(-cx)} ${f(-cy)})` : '';
        defs.push(`<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}"${tfs(tf)}>${stops(list)}</radialGradient>`);
        return `url(#${id})`;
      },
      blur(std) { const id = h.uid('sb'); defs.push(`<filter id="${id}" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="${std}"/></filter>`); return `url(#${id})`; },
      add(s) { defs.push(s); },
      svg(w, hh, body, extra = '') { return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${hh}" ${extra}><defs>${defs.join('')}</defs>${body}</svg>`; },
    };
  }

  /** 점들을 지나는 부드러운 곡선 (Catmull-Rom → 3차 베지어) */
  function smooth(pts, closed = false, k = 1) {
    const n = pts.length;
    if (n < 2) return '';
    const P = (i) => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
    let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
    const segs = closed ? n : n - 1;
    for (let i = 0; i < segs; i++) {
      const p0 = P(i - 1); const p1 = P(i); const p2 = P(i + 1); const p3 = P(i + 2);
      d += `C${f(p1[0] + ((p2[0] - p0[0]) / 6) * k)} ${f(p1[1] + ((p2[1] - p0[1]) / 6) * k)} ${f(p2[0] - ((p3[0] - p1[0]) / 6) * k)} ${f(p2[1] - ((p3[1] - p1[1]) / 6) * k)} ${f(p2[0])} ${f(p2[1])}`;
    }
    return closed ? `${d}Z` : d;
  }
  /** 이어진 곡선 위의 점 (smooth와 같은 곡선) — 길이 재기·점 찍기용 */
  function sampleSmooth(pts, per = 16) {
    const n = pts.length;
    const P = (i) => pts[Math.max(0, Math.min(n - 1, i))];
    const out = [];
    for (let i = 0; i < n - 1; i++) {
      const p0 = P(i - 1); const p1 = P(i); const p2 = P(i + 1); const p3 = P(i + 2);
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      for (let s = 0; s < per; s++) {
        const t = s / per; const u = 1 - t;
        out.push([u * u * u * p1[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p2[0], u * u * u * p1[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p2[1]]);
      }
    }
    out.push(pts[n - 1]);
    return out;
  }
  /** 울퉁불퉁한 덩어리(구름·덤불·바위) 경로 */
  function blob(cx, cy, rx, ry, R, n = 9, jit = 0.18) {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const k = 1 + (R() - 0.5) * 2 * jit;
      pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
    }
    return smooth(pts, true);
  }
  /** 사인 합으로 만든 부드러운 능선 → 아래로 닫힌 면 */
  function hills(x0, x1, base, waves, R, bottom = 1000, step = 40) {
    const ph = waves.map(() => R() * Math.PI * 2);
    const pts = [];
    for (let x = x0; x <= x1 + 0.1; x += step) {
      let y = base;
      waves.forEach(([amp, len], i) => { y -= amp * Math.sin((x / len) * Math.PI * 2 + ph[i]); });
      pts.push([x, y]);
    }
    const top = smooth(pts);
    return { d: `${top}L${f(x1)} ${bottom}L${f(x0)} ${bottom}Z`, top, pts };
  }
  const yAt = (pts, x) => {
    for (let i = 1; i < pts.length; i++) if (pts[i][0] >= x) { const [ax, ay] = pts[i - 1]; const [bx, by] = pts[i]; return ay + ((by - ay) * (x - ax)) / (bx - ax || 1); }
    return pts[pts.length - 1][1];
  };
  const circ = (x, y, r) => `M${f(x - r)} ${f(y)}a${f(r)} ${f(r)} 0 1 0 ${f(r * 2)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-r * 2)} 0Z`;
  const ell = (x, y, rx, ry) => `M${f(x - rx)} ${f(y)}a${f(rx)} ${f(ry)} 0 1 0 ${f(rx * 2)} 0a${f(rx)} ${f(ry)} 0 1 0 ${f(-rx * 2)} 0Z`;
  const line = (d, c, w, op = 1, extra = '') => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${f(w)}" stroke-linecap="round" stroke-linejoin="round"${op < 1 ? ` stroke-opacity="${f2(op)}"` : ''}${extra}/>`;
  const fill = (d, c, op = 1, extra = '') => `<path d="${d}" fill="${c}"${op < 1 ? ` fill-opacity="${f2(op)}"` : ''}${extra}/>`;
  const ol = (w = 3, c = OL) => ` stroke="${c}" stroke-width="${f(w)}" stroke-linejoin="round" stroke-linecap="round"`;
  /** 4갈래 반짝임 */
  const sparkle = (x, y, r) => `M${f(x)} ${f(y - r)}Q${f(x)} ${f(y)} ${f(x + r)} ${f(y)}Q${f(x)} ${f(y)} ${f(x)} ${f(y + r)}Q${f(x)} ${f(y)} ${f(x - r)} ${f(y)}Q${f(x)} ${f(y)} ${f(x)} ${f(y - r)}Z`;

  /** 침엽수 실루엣 (밑 중심 x,y, 높이 hh) */
  function pinePath(x, y, hh, R, tiers = 3) {
    const w = hh * 0.42;
    let d = '';
    for (let t = 0; t < tiers; t++) {
      const top = y - hh + (hh * 0.78 * t) / tiers;
      const bot = y - hh * 0.18 - (hh * 0.62 * (tiers - 1 - t)) / tiers * 0.55;
      const ww = w * (0.55 + (0.45 * (t + 1)) / tiers) * (0.92 + R() * 0.16);
      d += `M${f(x)} ${f(top)}L${f(x + ww)} ${f(bot)}Q${f(x)} ${f(bot - hh * 0.06)} ${f(x - ww)} ${f(bot)}Z`;
    }
    d += `M${f(x - hh * 0.04)} ${f(y - hh * 0.2)}h${f(hh * 0.08)}V${f(y)}h${f(-hh * 0.08)}Z`;
    return d;
  }
  /** 둥근 나무 덩어리 (겹친 원 여러 개) */
  function crownCircles(x, y, r, R, n = 6) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const a = Math.PI + (i / (n - 1)) * Math.PI;
      const rr = r * (0.5 + R() * 0.25);
      out.push([x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.55 - r * 0.1, rr]);
    }
    out.push([x, y - r * 0.15, r * 0.72]);
    return out;
  }

  /* =====================================================
   * 타이틀 장면 — 해 질 녘 솔빛 마을, 가운데 울림등
   * ===================================================== */
  const TW = 1600;
  const TH = 1000;
  const LAN = [800, 486];
  RG.art.TITLE = { w: TW, h: TH, lantern: LAN.slice() };

  const DUSK = {
    sky: [[0, '#0b0924'], [0.16, '#1b1648'], [0.3, '#3a2468'], [0.42, '#6e3277'], [0.5, '#a9437c'], [0.57, '#de6a72'], [0.63, '#f69a6c'], [0.69, '#ffc47e'], [0.76, '#ffe3aa']],
    horizon: '#ffd9a0',
    rim: '#ffb27a',
    rimHot: '#ffd8a0',
    win: '#ffd57a',
    winCore: '#fff3c4',
  };
  const elColors = () => RAINBOW.map((k) => EL()[k].color);

  function titleSky() {
    const B = bag();
    const R = prng('title-sky');
    const sky = B.lgu(0, 0, 0, TH, DUSK.sky);
    let s = `<rect width="${TW}" height="${TH}" fill="${sky}"/>`;
    // 노을 빛 덩어리 (가운데 지평선)
    s += `<rect width="${TW}" height="${TH}" fill="${B.rgu(800, 690, 820, [[0, '#fff6d6', 0.95], [0.1, '#ffe2a0', 0.85], [0.3, '#ffa872', 0.42], [0.62, '#d0587c', 0.14], [1, '#d0587c', 0]], 0.5)}"/>`;
    // 오로라: 여섯 원소 색 띠 (아주 옅게)
    const aur = B.lgu(0, 0, TW, 0, elColors().map((c, i) => [f2(i / 5), c, 0.9]));
    const blurA = B.blur(16);
    const ribbon = (y0, thick, amp, len, ph) => {
      const top = []; const bot = [];
      for (let x = -100; x <= TW + 100; x += 80) {
        const y = y0 + amp * Math.sin((x / len) * Math.PI * 2 + ph) + amp * 0.4 * Math.sin((x / (len * 0.37)) * Math.PI * 2 + ph * 2);
        top.push([x, y]);
        bot.unshift([x, y + thick * (0.6 + 0.4 * Math.sin((x / (len * 0.6)) * Math.PI * 2 + ph))]);
      }
      return smooth(top.concat(bot), true);
    };
    s += `<g filter="${blurA}" opacity="0.34">${fill(ribbon(150, 70, 40, 900, 0.6), aur, 0.85)}${fill(ribbon(230, 46, 30, 700, 2.1), aur, 0.6)}</g>`;
    s += `<g opacity="0.22">${line(smooth([[-50, 160], [300, 110], [650, 175], [1000, 120], [1300, 170], [1650, 130]]), '#ffffff', 3, 0.5, ` filter="${B.blur(3)}"`)}</g>`;
    // 별
    let st = '';
    for (let i = 0; i < 190; i++) {
      const x = R() * TW; const y = Math.pow(R(), 1.5) * 500;
      const r = 0.7 + R() * R() * 2;
      const a = Math.max(0, 1 - y / 540) * (0.35 + R() * 0.65);
      const c = R() < 0.18 ? '#ffd9b0' : R() < 0.45 ? '#cfe0ff' : '#ffffff';
      st += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${c}" opacity="${f2(a)}"/>`;
    }
    s += st;
    const glowS = B.blur(2.2);
    [[1180, 70, 9], [420, 260, 7], [1460, 210, 8], [610, 90, 6], [980, 230, 6], [140, 320, 6]].forEach(([x, y, r]) => {
      s += `<circle cx="${x}" cy="${y}" r="${r * 1.4}" fill="#dfe8ff" opacity="0.35" filter="${glowS}"/>${fill(sparkle(x, y, r), '#ffffff', 0.95)}`;
    });
    // 초승달 (같은 하늘 그라데이션으로 파낸 모양)
    s += `<circle cx="250" cy="150" r="150" fill="${B.rgu(250, 150, 150, [[0, '#dfe6ff', 0.32], [1, '#dfe6ff', 0]])}"/>`;
    s += `<circle cx="250" cy="150" r="42" fill="${B.lgu(210, 110, 290, 190, [[0, '#fffbe8'], [1, '#ffd9a8']])}"/><circle cx="268" cy="138" r="38" fill="${sky}"/>`;
    // 지평선 근처 얇은 구름띠 (아래가 노을빛)
    const streak = (x, y, w, hh, a) => {
      const g = B.lgu(0, y - hh, 0, y + hh, [[0, '#7d3f7e', 0.0], [0.45, '#b4507e', a * 0.7], [0.8, '#ffa77a', a], [1, '#ffd9a0', a]]);
      return fill(ell(x, y, w, hh), g);
    };
    s += streak(330, 520, 260, 9, 0.65) + streak(560, 548, 200, 7, 0.55) + streak(1130, 510, 300, 10, 0.6) + streak(1380, 545, 220, 7, 0.5) + streak(860, 470, 180, 6, 0.4);
    return B.svg(TW, TH, s, 'preserveAspectRatio="xMidYMax slice"');
  }

  /** 산 하나: 꼭대기(px,py), 밑너비 w, 바닥 by → 몸통·빛 면·눈 경로 */
  function mountain(px, py, w, by, R, litRight = true, snow = 0.32) {
    const L = []; const Rr = [];
    const N = 6;
    const jx = w * 0.05; const jy = (by - py) * 0.06;
    for (let i = 0; i <= N; i++) { const t = i / N; L.push([px - (w / 2) * (1 - t) + (i && i < N ? (R() - 0.5) * jx : 0), by - (by - py) * t + (i && i < N ? (R() - 0.5) * jy : 0)]); }
    for (let i = 1; i <= N; i++) { const t = i / N; Rr.push([px + (w / 2) * t + (i < N ? (R() - 0.5) * jx : 0), py + (by - py) * t + (i < N ? (R() - 0.5) * jy : 0)]); }
    const body = `M${L.map((p) => `${f(p[0])} ${f(p[1])}`).join('L')}L${Rr.map((p) => `${f(p[0])} ${f(p[1])}`).join('L')}Z`;
    // 빛 면: 꼭대기에서 아래로 지그재그 능선
    const spine = [[px, py]];
    for (let i = 1; i <= 5; i++) spine.push([px + (litRight ? 1 : -1) * w * (0.02 + R() * 0.08) * (i % 2 ? 1 : 0.3), py + ((by - py) * i) / 5]);
    const side = litRight ? Rr : L.slice().reverse();
    const lit = `M${spine.map((p) => `${f(p[0])} ${f(p[1])}`).join('L')}L${side.slice().reverse().map((p) => `${f(p[0])} ${f(p[1])}`).join('L')}Z`;
    // 눈: 위쪽 일부, 아래 가장자리는 들쭉날쭉
    const sy = py + (by - py) * snow;
    const lx = px - (w / 2) * snow; const rx = px + (w / 2) * snow;
    let sd = `M${f(px)} ${f(py - 1)}L${f(rx)} ${f(sy)}`;
    const teeth = 5;
    for (let i = 1; i <= teeth; i++) { const t = i / teeth; const x = rx + (lx - rx) * t; sd += `L${f(x + (rx - lx) / teeth / 2)} ${f(sy + (by - py) * (0.06 + R() * 0.08))}L${f(x)} ${f(sy - (i < teeth ? (by - py) * R() * 0.03 : 0))}`; }
    sd += 'Z';
    return { body, lit, snow: sd };
  }

  function titleFar() {
    const B = bag();
    const R = prng('title-far');
    const haze = DUSK.horizon;
    let s = '';
    // 가장 먼 낮은 능선
    const far0 = hills(-40, TW + 40, 640, [[14, 900], [8, 260]], R, 760, 40);
    s += fill(far0.d, B.lgu(0, 600, 0, 700, [[0, '#c27a93'], [1, '#e8a294']]));
    s += line(far0.top, '#ffe0b0', 2.4, 0.7);
    // 왼쪽: 서리 고개 설산
    const peaks = [[-30, 430, 430], [150, 352, 400], [330, 290, 440], [520, 372, 380], [665, 462, 300]];
    const mBody = B.lgu(0, 280, 0, 720, [[0, '#6a5a9e'], [1, '#9c78a8']]);
    const mLit = B.lgu(0, 280, 0, 720, [[0, '#a688c4'], [1, '#d896a6']]);
    let bodies = ''; let lits = ''; let snows = ''; let snowLit = '';
    for (const [x, y, w] of peaks) {
      const m = mountain(x, y, w, 720, R, true, 0.34);
      bodies += m.body; lits += m.lit; snows += m.snow;
      const m2 = mountain(x, y, w, 720, prng(`snow${x}`), true, 0.34);
      snowLit += m2.lit;
    }
    s += fill(bodies, mBody) + fill(lits, mLit, 0.85);
    const snowClip = h.uid('clip');
    B.add(`<clipPath id="${snowClip}"><path d="${snows}"/></clipPath>`);
    s += fill(snows, '#b9b6e8') + `<g clip-path="url(#${snowClip})">${fill(lits, '#ffd9cf')}</g>`;
    s += `<g clip-path="url(#${snowClip})">${line(lits, '#fff4e4', 2, 0.8)}</g>`;
    // 설산 아래 안개(대기 원근)
    s += `<rect x="-40" y="420" width="760" height="320" fill="${B.lgu(0, 470, 0, 720, [[0, haze, 0], [1, haze, 0.75]])}"/>`;
    // 가운데 오른쪽: 먼 고원 위 깨진 대종 (여정의 끝)
    const pl = smooth([[1000, 704], [1030, 650], [1066, 622], [1110, 616], [1156, 622], [1190, 654], [1214, 704]]);
    s += fill(`${pl}Z`, B.lgu(0, 610, 0, 700, [[0, '#b98aa6'], [1, '#d99aa0']])) + line(smooth([[1030, 650], [1066, 622], [1110, 616]]), '#ffd9b8', 2, 0.8);
    const bx = 1110; const by = 618;
    const bs = (d) => d;
    let belfry = `M${bx - 32} ${by}V${by - 44}h8V${by}ZM${bx + 24} ${by}V${by - 38}l4 -4 4 6V${by}Z`;
    belfry += `M${bx - 36} ${by - 46}L${bx + 22} ${by - 50}l6 4 -4 2L${bx - 36} ${by - 41}Z`;
    s += fill(bs(belfry), '#9a7096');
    const bell = `M${bx - 13} ${by - 36}C${bx - 13} ${by - 43} ${bx + 13} ${by - 43} ${bx + 13} ${by - 36}C${bx + 14} ${by - 25} ${bx + 16} ${by - 18} ${bx + 21} ${by - 13}H${bx - 21}C${bx - 16} ${by - 18} ${bx - 14} ${by - 25} ${bx - 13} ${by - 36}Z`;
    s += fill(bell, '#a07898') + line(`M${bx + 3} ${by - 13}l-3 -7 4 -6 -3 -7`, '#ffd98a', 2.2, 0.95, ` filter="${B.blur(1.4)}"`) + line(`M${bx + 3} ${by - 13}l-3 -7 4 -6 -3 -7`, '#fff3c8', 1);
    // 대종에서 흘러나오는 잿빛 안개 기둥
    const plume = B.lgu(0, 420, 0, 610, [[0, '#c6b6d4', 0], [0.5, '#b8a6c8', 0.3], [1, '#ac9ac0', 0.5]]);
    s += `<g filter="${B.blur(7)}">${fill(smooth([[bx - 14, by - 18], [bx - 26, by - 70], [bx - 6, by - 116], [bx - 30, by - 170], [bx + 8, by - 200], [bx + 32, by - 156], [bx + 16, by - 110], [bx + 30, by - 64], [bx + 14, by - 18]], true), plume)}</g>`;
    // 오른쪽: 붉은 협곡 메사
    const mesas = [[1262, 560, 104, 180], [1372, 590, 76, 140], [1206, 612, 60, 110]];
    for (const [x, y, tw, bw] of mesas.sort((a, b) => a[1] - b[1])) {
      const by2 = 712;
      const body = `M${x - bw / 2} ${by2}L${x - tw / 2 - 6} ${y + 14}L${x - tw / 2} ${y}H${x + tw / 2}L${x + tw / 2 + 4} ${y + 12}L${x + bw / 2} ${by2}Z`;
      s += fill(body, B.lgu(0, y, 0, by2, [[0, '#a84a62'], [1, '#d07a7e']]));
      s += fill(`M${x - bw / 2} ${by2}L${x - tw / 2 - 6} ${y + 14}L${x - tw / 2} ${y}H${x - tw / 2 + tw * 0.42}L${x - bw * 0.08} ${by2}Z`, B.lgu(0, y, 0, by2, [[0, '#ff9e80'], [1, '#f0a08a']]), 0.85);
      s += fill(`M${x + tw / 2} ${y}L${x + tw / 2 + 4} ${y + 12}L${x + bw / 2} ${by2}H${x + bw * 0.3}Z`, '#7a3458', 0.55);
      let strata = '';
      for (let k = 1; k < 5; k++) { const yy = y + ((by2 - y) * k) / 5.5; strata += `M${f(x - tw / 2 - (bw - tw) * 0.5 * (k / 5.5) + 4)} ${f(yy)}L${f(x + tw / 2 + (bw - tw) * 0.5 * (k / 5.5) - 4)} ${f(yy + (R() - 0.5) * 4)}`; }
      s += line(strata, '#8a3a5a', 2, 0.4) + line(`M${x - tw / 2} ${y}H${x + tw / 2}`, '#ffd0a8', 2.6, 0.95);
    }
    // 맨 오른쪽: 폭풍 해안 — 바다, 절벽, 등대, 먹구름
    s += `<rect x="1360" y="640" width="280" height="80" fill="${B.lgu(0, 640, 0, 720, [[0, '#f0a284'], [1, '#8a6aa2']])}"/>`;
    let wv = '';
    for (let i = 0; i < 9; i++) wv += `M${f(1380 + R() * 220)} ${f(652 + i * 6)}h${f(14 + R() * 26)}`;
    s += line(wv, '#ffe2c0', 1.6, 0.6);
    s += fill('M1470 720L1478 610L1500 590L1540 584L1570 596L1600 590L1640 600V720Z', '#5c4778');
    s += fill('M1478 610L1500 590L1540 584L1546 600L1500 610Z', '#c07a8a', 0.8);
    s += fill(`M1530 586L1534 548H1546L1550 586Z`, '#e8dcec') + fill('M1531 572h18v5h-18zM1533 558h14v4h-14z', '#c75a6e');
    s += `<circle cx="1540" cy="544" r="22" fill="${B.rgu(1540, 544, 22, [[0, '#fff6c8', 1], [0.5, '#ffe08a', 0.5], [1, '#ffe08a', 0]])}"/>`;
    s += fill('M1540 544L1380 512L1384 566Z', B.lgu(1540, 0, 1380, 0, [[0, '#fff3b8', 0.55], [1, '#fff3b8', 0]]));
    const stormC = B.lgu(0, 360, 0, 520, [[0, '#2a2552'], [0.7, '#4a3a6c'], [1, '#a35e86']]);
    let sc = '';
    const RC = prng('stormcloud');
    for (let i = 0; i < 9; i++) sc += circ(1390 + i * 30 + RC() * 20, 470 - Math.sin((i / 8) * Math.PI) * 40 + RC() * 14, 34 + RC() * 22);
    s += `<g opacity="0.92">${fill(sc, stormC)}</g>`;
    s += line('M1480 470L1466 512L1480 510L1462 560', '#efe6ff', 5, 0.35, ` filter="${B.blur(3)}"`) + line('M1480 470L1466 512L1480 510L1462 560', '#ffffff', 2, 0.95);
    // 먼 곳 전체를 노을빛 안개로 살짝 덮음
    s += `<rect y="560" width="${TW}" height="200" fill="${B.lgu(0, 560, 0, 740, [[0, haze, 0], [1, haze, 0.5]])}"/>`;
    return B.svg(TW, TH, s, 'preserveAspectRatio="xMidYMax slice"');
  }

  function titleMid() {
    const B = bag();
    const R = prng('title-mid');
    let s = '';
    // 뒤 언덕 (푸른 보라) + 숲 실루엣
    const back = hills(-40, TW + 40, 692, [[22, 760], [12, 300]], R, 1000, 40);
    s += fill(back.d, B.lgu(0, 640, 0, 820, [[0, '#55588e'], [1, '#3c4774']]));
    let pines = '';
    for (let x = -20; x < TW + 20; x += 9 + R() * 14) {
      if (x > 690 && x < 910) continue;
      const y = yAt(back.pts, x) + 6;
      pines += pinePath(x, y, 18 + R() * 26, R, 3);
    }
    s += fill(pines, '#3a4374');
    s += line(back.top, '#f2a88c', 2.2, 0.55);
    // 앞쪽 언덕 (청록) + 밭
    const front = hills(-40, TW + 40, 772, [[18, 900], [10, 340]], prng('mid-front'), 1000, 40);
    const fg = B.lgu(0, 730, 0, 900, [[0, '#355a6c'], [1, '#22384e']]);
    s += fill(front.d, fg);
    // 밭 고랑 (언덕 왼쪽·오른쪽)
    let rows = '';
    for (const [x0, x1] of [[120, 560], [1080, 1480]]) {
      for (let k = 0; k < 7; k++) {
        const y0 = yAt(front.pts, x0) + 16 + k * 11; const y1 = yAt(front.pts, x1) + 16 + k * 11;
        rows += `M${x0 + k * 14} ${f(y0)}Q${(x0 + x1) / 2} ${f((y0 + y1) / 2 - 10)} ${x1 - k * 14} ${f(y1)}`;
      }
    }
    s += line(rows, '#4d7a6e', 3, 0.55) + line(rows, '#1c3044', 1.4, 0.35, ' transform="translate(0 3)"');
    s += line(front.top, '#ffb886', 2.6, 0.6);
    // 강: 지평선에서 오른쪽 앞으로 굽이침, 노을이 비침
    const riverTop = [[905, 712], [950, 722], [1010, 740], [1090, 760], [1210, 780], [1360, 800], [1500, 820], [1650, 834]];
    const riverBot = [[1650, 884], [1500, 860], [1350, 836], [1200, 814], [1080, 790], [990, 762], [930, 734], [895, 716]];
    const riv = B.lgu(0, 690, 0, 840, [[0, '#ffe2a8'], [0.4, '#f49a7a'], [1, '#8a5a9a']]);
    s += fill(`${smooth(riverTop)}L${riverBot.map((p) => `${p[0]} ${p[1]}`).join('L')}Z`, riv);
    let glint = '';
    for (let i = 0; i < 22; i++) { const t = R(); const x = 930 + t * 680; const y = 726 + t * 110 + R() * 22; glint += `M${f(x)} ${f(y)}h${f(6 + R() * 18)}`; }
    s += line(glint, '#fff4d6', 1.8, 0.7);
    s += line(smooth([[895, 716], [930, 734], [990, 762], [1080, 790], [1200, 814], [1350, 836], [1500, 860], [1650, 884]]), '#1c2c44', 3, 0.7);
    // 풍차 (왼쪽 언덕)
    const wx = 420; const wy = yAt(front.pts, 420) + 8;
    s += fill(`M${wx - 18} ${wy}L${wx - 10} ${wy - 64}H${wx + 10}L${wx + 18} ${wy}Z`, '#2c3a5a', 1, ol(2, '#161a30'));
    s += fill(`M${wx - 14} ${wy - 62}Q${wx} ${wy - 84} ${wx + 14} ${wy - 62}Z`, '#3a2f4e', 1, ol(2, '#161a30'));
    s += fill(`M${wx - 4} ${wy - 34}h8v10h-8z`, DUSK.win) + `<circle cx="${wx}" cy="${wy - 29}" r="14" fill="${B.rgu(wx, wy - 29, 14, [[0, DUSK.win, 0.5], [1, DUSK.win, 0]])}"/>`;
    s += line(`M${wx + 10} ${wy - 64}L${wx + 10} ${wy}`, DUSK.rim, 2, 0.6);
    const hub = [wx, wy - 66];
    let blades = '';
    [20, 110, 200, 290].forEach((a) => {
      const r = (a * Math.PI) / 180; const c = Math.cos(r); const sn = Math.sin(r);
      const px = -sn; const py = c;
      const p = (d, o) => `${f(hub[0] + c * d + px * o)} ${f(hub[1] + sn * d + py * o)}`;
      blades += `M${p(6, -2)}L${p(58, -2)}L${p(58, 9)}L${p(12, 7)}Z`;
    });
    s += fill(blades, '#3a3352', 1, ol(1.6, '#161a30')) + `<circle cx="${hub[0]}" cy="${hub[1]}" r="4" fill="#5a4a6a"/>`;
    // 앞 언덕의 둥근 나무 무리
    const trees = [[200, 0], [262, 4], [598, 6], [1040, 2], [1112, 6], [1190, 0], [1530, 4]];
    for (const [x, dy] of trees) {
      const y = yAt(front.pts, x) + 10 + dy;
      const cs = crownCircles(x, y - 22, 20 + R() * 8, R, 5);
      let rim = ''; let body = '';
      for (const [cx, cy, r] of cs) { rim += circ(cx + (x < 800 ? 2.5 : -2.5), cy - 1.5, r); body += circ(cx, cy, r); }
      s += fill(`M${x - 3} ${y}h6v-18h-6z`, '#1d2538') + fill(rim, DUSK.rim, 0.75) + fill(body, '#26405a');
    }
    // 뒤 언덕 중간 가운데로 이어지는 길 흔적 (울림등 뒤 → 지평선)
    s += line(smooth([[800, 770], [850, 744], [930, 728], [1000, 706]]), '#d6a48a', 6, 0.55) + line(smooth([[800, 770], [850, 744], [930, 728], [1000, 706]]), '#ffe0c0', 2, 0.4);
    return B.svg(TW, TH, s, 'preserveAspectRatio="xMidYMax slice"');
  }

  /** 집 하나 (정면 박공 + 탑 쪽으로 보이는 옆면) */
  function house(B, x, by, w, wh, rh, side, roof, R) {
    const dp = w * 0.55; const lift = dp * 0.32;
    const s0 = side;
    const fx0 = x - w / 2; const fx1 = x + w / 2;
    const ex = s0 > 0 ? fx1 : fx0;
    let o = '';
    const outline = ol(2.4, '#151027');
    // 옆벽
    const sideWall = `M${f(ex)} ${f(by)}V${f(by - wh)}L${f(ex + s0 * dp)} ${f(by - wh - lift)}V${f(by - lift)}Z`;
    o += fill(sideWall, '#c08a74', 1, outline);
    o += fill(sideWall, B.lgu(ex, 0, ex + s0 * dp, 0, [[0, '#ffcc8a', 0.55], [1, '#ffcc8a', 0]]));
    // 옆 지붕 (탑 쪽이라 등불 빛을 받음)
    const ridge0 = [x, by - wh - rh]; const ridge1 = [x + s0 * dp, by - wh - rh - lift];
    const sideRoof = `M${f(ridge0[0])} ${f(ridge0[1])}L${f(ridge1[0])} ${f(ridge1[1])}L${f(ex + s0 * (dp + 5))} ${f(by - wh - lift + 3)}L${f(ex + s0 * 5)} ${f(by - wh + 3)}Z`;
    o += fill(sideRoof, mix(roof, '#ff9a6a', 0.35), 1, outline);
    let tiles = '';
    for (let k = 1; k < 4; k++) { const t = k / 4; tiles += `M${f(ridge0[0] + (ex + s0 * 5 - ridge0[0]) * t)} ${f(ridge0[1] + (by - wh + 3 - ridge0[1]) * t)}L${f(ridge1[0] + (ex + s0 * (dp + 5) - ridge1[0]) * t)} ${f(ridge1[1] + (by - wh - lift + 3 - ridge1[1]) * t)}`; }
    o += line(tiles, shade(roof, -0.35), 1.6, 0.7);
    o += line(`M${f(ridge0[0])} ${f(ridge0[1])}L${f(ridge1[0])} ${f(ridge1[1])}`, '#ffd2a0', 2, 0.85);
    // 옆벽 창
    const wx = ex + s0 * dp * 0.5 - 5; const wy = by - wh * 0.62 - lift * 0.5;
    o += `<circle cx="${f(wx + 5)}" cy="${f(wy + 6)}" r="16" fill="${B.rgu(wx + 5, wy + 6, 16, [[0, DUSK.win, 0.55], [1, DUSK.win, 0]])}"/>`;
    o += fill(`M${f(wx)} ${f(wy)}h10v13h-10z`, DUSK.win, 1, ol(1.6, '#5a3020')) + fill(`M${f(wx + 1.5)} ${f(wy + 1.5)}h4v4h-4z`, DUSK.winCore);
    // 정면 벽 + 박공
    const front = `M${f(fx0)} ${f(by)}V${f(by - wh)}L${f(x)} ${f(by - wh - rh + 6)}L${f(fx1)} ${f(by - wh)}V${f(by)}Z`;
    o += fill(front, B.lgu(fx0, 0, fx1, 0, s0 > 0 ? [[0, '#6e5470'], [1, '#9a7484']] : [[0, '#9a7484'], [1, '#6e5470']]), 1, outline);
    // 목조 뼈대 (안쪽 선은 색을 튼 어두운 색)
    o += line(`M${f(fx0 + 2)} ${f(by - wh)}H${f(fx1 - 2)}M${f(fx0 + 3)} ${f(by - wh * 0.45)}H${f(fx1 - 3)}M${f(fx0 + 3)} ${f(by - wh)}L${f(x - w * 0.18)} ${f(by - wh * 0.45)}M${f(fx1 - 3)} ${f(by - wh)}L${f(x + w * 0.18)} ${f(by - wh * 0.45)}`, '#4a2f3c', 2.2, 0.9);
    // 문 + 창
    o += fill(`M${f(x - w * 0.12)} ${f(by)}V${f(by - wh * 0.36)}Q${f(x)} ${f(by - wh * 0.5)} ${f(x + w * 0.12)} ${f(by - wh * 0.36)}V${f(by)}Z`, '#3a2232', 1, ol(1.5, '#151027'));
    if (R() < 0.6) o += fill(`M${f(x - w * 0.1)} ${f(by - 2)}V${f(by - wh * 0.34)}Q${f(x)} ${f(by - wh * 0.46)} ${f(x + w * 0.1)} ${f(by - wh * 0.34)}V${f(by - 2)}Z`, DUSK.win, 0.85);
    const gw = Math.max(6, w * 0.14);
    o += `<circle cx="${f(x)}" cy="${f(by - wh - rh * 0.38)}" r="${f(gw * 1.6)}" fill="${B.rgu(x, by - wh - rh * 0.38, gw * 1.6, [[0, DUSK.win, 0.5], [1, DUSK.win, 0]])}"/>`;
    o += fill(`M${f(x - gw / 2)} ${f(by - wh - rh * 0.38 - gw / 2)}h${f(gw)}v${f(gw)}h${f(-gw)}z`, DUSK.win, 1, ol(1.4, '#5a3020'));
    // 정면 지붕 가장자리 (두꺼운 박공널)
    o += line(`M${f(fx0 - 5)} ${f(by - wh + 3)}L${f(x)} ${f(by - wh - rh)}L${f(fx1 + 5)} ${f(by - wh + 3)}`, '#151027', 7.5);
    o += line(`M${f(fx0 - 4)} ${f(by - wh + 2)}L${f(x)} ${f(by - wh - rh + 1)}L${f(fx1 + 4)} ${f(by - wh + 2)}`, shade(roof, -0.2), 4);
    o += line(s0 > 0 ? `M${f(x)} ${f(by - wh - rh + 1)}L${f(fx1 + 4)} ${f(by - wh + 2)}` : `M${f(x)} ${f(by - wh - rh + 1)}L${f(fx0 - 4)} ${f(by - wh + 2)}`, '#ffb88a', 1.6, 0.85);
    // 굴뚝 + 연기
    if (R() < 0.55) {
      const cx = x + s0 * dp * 0.55; const cy = by - wh - rh * 0.7 - lift * 0.5;
      o += fill(`M${f(cx - 4)} ${f(cy + 10)}V${f(cy - 8)}h9V${f(cy + 6)}Z`, '#4a3446', 1, ol(1.6, '#151027'));
      o += `<g filter="${B.blur(3)}">${fill(smooth([[cx - 2, cy - 10], [cx - 12, cy - 34], [cx + 2, cy - 58], [cx - 8, cy - 86], [cx + 8, cy - 92], [cx + 20, cy - 58], [cx + 8, cy - 32], [cx + 8, cy - 10]], true), '#d2b4c8', 0.3)}</g>`;
    }
    return o;
  }

  function titleVillage() {
    const B = bag();
    const R = prng('title-village');
    const [lx, ly] = LAN;
    let s = '';
    // 등불 빛 번짐 (마을 뒤)
    s += `<circle cx="${lx}" cy="${ly}" r="420" fill="${B.rgu(lx, ly, 420, [[0, '#ffe7a8', 0.55], [0.25, '#ffc070', 0.32], [0.6, '#ff9a70', 0.1], [1, '#ff9a70', 0]])}"/>`;
    // 마을 언덕
    const mound = smooth([[470, 840], [560, 800], [680, 780], [800, 774], [920, 778], [1040, 796], [1130, 840]]);
    s += fill(`${mound}L1130 1000H470Z`, B.lgu(0, 770, 0, 900, [[0, '#3a4c64'], [1, '#22324a']]));
    s += line(mound, '#ffc890', 2.6, 0.7);
    s += `<ellipse cx="${lx}" cy="790" rx="260" ry="46" fill="${B.rgu(lx, 790, 260, [[0, '#ffcf8a', 0.5], [1, '#ffcf8a', 0]], 0.18)}"/>`;
    // 집 (뒤 → 앞)
    const roofs = ['#b04a44', '#a8583a', '#8e4a5a', '#b8643c', '#9a3e4a'];
    const houses = [
      [612, 768, 40, 26, 26], [690, 762, 36, 24, 22], [910, 760, 38, 26, 24], [985, 768, 44, 28, 26],
      [560, 800, 54, 36, 32], [648, 792, 50, 34, 30], [952, 792, 52, 36, 32], [1040, 802, 56, 36, 32],
      [604, 832, 64, 42, 36], [996, 830, 66, 42, 38],
    ];
    houses.forEach(([x, by, w, wh, rh], i) => { s += house(B, x, by, w, wh, rh, x < lx ? 1 : -1, roofs[i % roofs.length], R); });
    // 마을 나무
    for (const [x, y, r] of [[526, 812, 22], [1084, 816, 24], [722, 786, 16], [880, 784, 15]]) {
      const cs = crownCircles(x, y - r, r, R, 5);
      let rim = ''; let body = '';
      for (const [cx, cy, rr] of cs) { rim += circ(cx + (x < lx ? 2.5 : -2.5), cy - 1.5, rr); body += circ(cx, cy, rr); }
      s += fill(`M${x - 3} ${y}h6v-${r}h-6z`, '#1d2034') + fill(rim, '#ffc080', 0.8) + fill(body, '#2a4256', 1, ol(2, '#141a2c'));
    }
    // ---- 울림등 탑 ----
    const out = ol(3, '#130f22');
    const stone = B.lgu(lx - 34, 0, lx + 34, 0, [[0, '#8a6a74'], [0.35, '#b08a86'], [0.7, '#7a6276'], [1, '#4e3e5e']]);
    // 받침 계단
    s += fill(`M${lx - 54} 800V786H${lx + 54}V800Z`, '#5a4a62', 1, out) + fill(`M${lx - 46} 786V774H${lx + 46}V786Z`, '#7a6474', 1, out);
    s += line(`M${lx - 52} 787H${lx + 52}M${lx - 44} 775H${lx + 44}`, '#ffd2a0', 1.6, 0.7);
    // 몸통
    const shaft = `M${lx - 34} 774L${lx - 27} 552H${lx + 27}L${lx + 34} 774Z`;
    s += fill(shaft, stone, 1, out);
    let blocks = '';
    for (let k = 0; k < 11; k++) {
      const y = 774 - k * 20; const half = 34 - (k * 7) / 11;
      blocks += `M${f(lx - half + 2)} ${y}H${f(lx + half - 2)}`;
      const off = k % 2 ? 0 : 10;
      for (let bx2 = -half + 12 + off; bx2 < half - 6; bx2 += 20) blocks += `M${f(lx + bx2)} ${y}v-20`;
    }
    s += line(blocks, '#5a4058', 1.6, 0.75);
    s += fill(shaft, B.lgu(0, 552, 0, 774, [[0, '#ffd9a0', 0.4], [0.4, '#ffd9a0', 0.08], [1, '#000000', 0.15]]));
    s += line(`M${lx - 33} 770L${lx - 26.5} 556`, '#ffc890', 2, 0.8) + line(`M${lx + 33} 770L${lx + 26.5} 556`, '#ff9a7a', 1.6, 0.6);
    // 문 + 새어 나오는 빛
    s += fill(`M${lx - 12} 774V748Q${lx} 734 ${lx + 12} 748V774Z`, DUSK.win, 1, ol(2, '#3a2010'));
    s += `<ellipse cx="${lx}" cy="776" rx="44" ry="10" fill="${B.rgu(lx, 776, 44, [[0, '#ffe2a0', 0.7], [1, '#ffe2a0', 0]], 0.25)}"/>`;
    s += fill(`M${lx - 4} 690h8v18h-8zM${lx - 4} 630h8v16h-8z`, DUSK.win, 1, ol(1.5, '#3a2010'));
    // 발코니
    s += fill(`M${lx - 50} 556L${lx - 44} 544H${lx + 44}L${lx + 50} 556Z`, '#6a5060', 1, out);
    s += fill(`M${lx - 30} 556l6 14h48l6 -14z`, '#4e3c52', 1, ol(2, '#130f22'));
    s += line(`M${lx - 46} 545H${lx + 46}`, '#ffd8a0', 2, 0.8);
    // 등불 방: 금빛 기둥 4개 + 빛나는 심지
    const coreR = 30;
    s += `<circle cx="${lx}" cy="${ly}" r="120" fill="${B.rgu(lx, ly, 120, [[0, '#fffbe6', 0.95], [0.25, '#ffe9a6', 0.7], [0.6, '#ffc46a', 0.22], [1, '#ffc46a', 0]])}"/>`;
    const gold = B.lgu(0, 0, 1, 0, [[0, '#7a4a1a'], [0.35, '#ffe39a'], [0.6, '#d8a040'], [1, '#6a3e14']]);
    s += fill(`M${lx - 40} 544V430h7V544ZM${lx + 33} 544V430h7V544Z`, gold, 1, ol(2, '#2a1606'));
    s += fill(`M${lx - 15} 544V432h4V544ZM${lx + 11} 544V432h4V544Z`, gold, 0.9, ol(1.4, '#2a1606'));
    s += `<circle cx="${lx}" cy="${ly}" r="${coreR + 10}" fill="${B.rgu(lx, ly, coreR + 10, [[0, '#ffffff', 1], [0.55, '#fff3c0', 1], [0.85, '#ffd270', 0.6], [1, '#ffb050', 0]])}"/>`;
    // 심지 둘레 여섯 원소 결정
    RAINBOW.forEach((k, i) => {
      const a = (-90 + i * 60) * (Math.PI / 180);
      const cx = lx + Math.cos(a) * 46; const cy = ly + Math.sin(a) * 30;
      const c = EL()[k];
      s += `<circle cx="${f(cx)}" cy="${f(cy)}" r="12" fill="${B.rgu(cx, cy, 12, [[0, c.light, 0.9], [1, c.color, 0]])}"/>`;
      s += fill(`M${f(cx)} ${f(cy - 8)}L${f(cx + 5)} ${f(cy)}L${f(cx)} ${f(cy + 8)}L${f(cx - 5)} ${f(cy)}Z`, c.color, 1, ol(1.4, c.dark)) + fill(`M${f(cx)} ${f(cy - 7)}L${f(cx - 4)} ${f(cy)}L${f(cx)} ${f(cy + 1)}Z`, c.light, 0.9);
    });
    // 지붕 + 꼭대기 장식
    s += fill(`M${lx - 58} 432L${lx} 372L${lx + 58} 432Q${lx} 442 ${lx - 58} 432Z`, B.lgu(0, 372, 0, 440, [[0, '#4c3a6a'], [1, '#2c2244']]), 1, out);
    s += fill(`M${lx - 58} 432L${lx} 372L${lx - 6} 434Q${lx - 34} 438 ${lx - 58} 432Z`, '#ffb880', 0.28);
    s += line(`M${lx - 56} 431Q${lx} 441 ${lx + 56} 431`, gold, 4) + line(`M${lx - 58} 432L${lx} 372L${lx + 58} 432`, '#ffd8a0', 1.6, 0.6);
    s += fill(`M${lx - 4} 376V352h8V376Z`, gold, 1, ol(1.6, '#2a1606')) + `<circle cx="${lx}" cy="346" r="8" fill="${gold}"${ol(1.8, '#2a1606')}/>`;
    s += `<circle cx="${lx - 2}" cy="344" r="2.4" fill="#fffbe0"/>`;
    // 축제 등불 줄 (여섯 원소 색)
    const strings = [[[lx - 46, 548], [612, 742]], [[lx - 46, 548], [560, 768]], [[lx + 46, 548], [985, 742]], [[lx + 46, 548], [1040, 770]], [[lx - 40, 470], [690, 738]], [[lx + 40, 470], [910, 736]]];
    let sl = ''; let lamps = '';
    strings.forEach(([a, b], si) => {
      const mx = (a[0] + b[0]) / 2; const my = Math.max(a[1], b[1]) + 30;
      sl += `M${a[0]} ${a[1]}Q${mx} ${my} ${b[0]} ${b[1]}`;
      const n = 6;
      for (let k = 1; k < n; k++) {
        const t = k / n; const u = 1 - t;
        const x = u * u * a[0] + 2 * u * t * mx + t * t * b[0];
        const y = u * u * a[1] + 2 * u * t * my + t * t * b[1] + 6;
        const c = EL()[RAINBOW[(k + si * 2) % 6]];
        lamps += `<circle cx="${f(x)}" cy="${f(y)}" r="11" fill="${B.rgu(x, y, 11, [[0, c.light, 0.7], [1, c.color, 0]])}"/>`;
        lamps += fill(ell(x, y, 3.8, 5), c.light, 1, ol(1.2, c.dark));
      }
    });
    s += line(sl, '#20182e', 1.6, 0.9) + lamps;
    // 탑 위 심지 빛 꽃 (위에 한 번 더)
    s += `<circle cx="${lx}" cy="${ly}" r="70" fill="${B.rgu(lx, ly, 70, [[0, '#ffffff', 0.85], [0.4, '#fff1c0', 0.4], [1, '#ffe0a0', 0]])}"/>`;
    return B.svg(TW, TH, s, 'preserveAspectRatio="xMidYMax slice"');
  }

  function titleFront() {
    const B = bag();
    const R = prng('title-front');
    let s = '';
    const dark = B.lgu(0, 820, 0, 1000, [[0, '#1c2a40'], [1, '#0c1222']]);
    // 길: 화면 아래에서 마을 문까지
    const roadL = [[560, 1010], [640, 940], [700, 880], [760, 830], [788, 800]];
    const roadR = [[812, 800], [840, 832], [900, 884], [980, 944], [1080, 1010]];
    const road = `${smooth(roadL)}L${smooth(roadR).slice(1)}Z`;
    s += fill(road, B.lgu(0, 800, 0, 1000, [[0, '#d9a07a'], [0.35, '#9a6a6a'], [1, '#3e2c40']]));
    s += line(smooth(roadL), '#2a1c30', 4, 0.8) + line(smooth(roadR), '#2a1c30', 4, 0.8);
    s += line(smooth([[800, 806], [790, 860], [800, 920], [820, 1000]]), '#ffd8b0', 3, 0.22);
    let ruts = '';
    for (let i = 0; i < 26; i++) { const t = R(); const y = 812 + t * 180; const half = 12 + t * 230; const x = 800 + (R() - 0.5) * half * 1.6; ruts += ell(x, y, 2 + t * 6, 1.2 + t * 3); }
    s += fill(ruts, '#5a3c48', 0.55);
    // 왼쪽·오른쪽 앞 언덕
    const leftTop = [[-60, 846], [80, 838], [240, 860], [400, 888], [540, 930], [640, 1010]];
    const rightTop = [[960, 1010], [1060, 930], [1200, 884], [1360, 856], [1500, 836], [1660, 830]];
    const lt = smooth(leftTop); const rt = smooth(rightTop);
    s += fill(`${lt}L640 1010L-60 1010Z`, dark) + fill(`${rt}L1660 1010L960 1010Z`, dark);
    s += line(lt, '#ffb27a', 3, 0.7) + line(rt, '#ffb27a', 3, 0.7);
    // 풀잎 (윤곽 위)
    let grass = ''; let grassRim = '';
    const blades = (pts, step) => {
      const sp = sampleSmooth(pts, 10);
      for (let i = 0; i < sp.length; i += step) {
        const [x, y] = sp[i]; const hh = 8 + R() * 16; const lean = (R() - 0.5) * 10;
        grass += `M${f(x - 3)} ${f(y + 2)}Q${f(x + lean * 0.3)} ${f(y - hh * 0.5)} ${f(x + lean)} ${f(y - hh)}Q${f(x + 1)} ${f(y - hh * 0.4)} ${f(x + 3)} ${f(y + 2)}Z`;
        if (R() < 0.6) grassRim += `M${f(x + lean)} ${f(y - hh)}Q${f(x + 2)} ${f(y - hh * 0.4)} ${f(x + 3)} ${f(y + 1)}`;
      }
    };
    blades(leftTop, 1); blades(rightTop, 1);
    s += fill(grass, '#1c2a40') + line(grassRim, '#ffb886', 1.2, 0.6);
    // 들꽃 (빛을 받는 작은 점)
    let fl = '';
    const flowerCols = ['#ffd27a', '#ff9db5', '#c8b6ff', '#fff2c8', '#9fe0ff'];
    for (const [pts, n] of [[leftTop, 34], [rightTop, 34]]) {
      const sp = sampleSmooth(pts, 10);
      for (let i = 0; i < n; i++) {
        const p = sp[Math.floor(R() * sp.length)];
        const x = p[0] + (R() - 0.5) * 20; const y = p[1] + 6 + R() * 50;
        const c = flowerCols[Math.floor(R() * flowerCols.length)];
        fl += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(1.8 + R() * 2.2)}" fill="${c}" opacity="${f2(0.55 + R() * 0.45)}"/>`;
      }
    }
    s += fl;
    // 울타리 말뚝 (길 가)
    let fence = ''; let fenceRim = '';
    for (let i = 0; i < 6; i++) {
      for (const sgn of [-1, 1]) {
        const t = i / 6; const y = 840 + t * 150; const x = 800 + sgn * (40 + t * 300);
        const hh = 18 + t * 30; const w = 3 + t * 4;
        fence += `M${f(x - w)} ${f(y)}V${f(y - hh)}l${f(w)} -4l${f(w)} 4V${f(y)}Z`;
        fenceRim += `M${f(x - sgn * w)} ${f(y - hh)}V${f(y)}`;
      }
    }
    s += fill(fence, '#2a2036', 1, ol(1.6, '#0d0a18')) + line(fenceRim, '#ffb886', 1.4, 0.6);
    s += line(smooth([[760, 832], [690, 880], [600, 940], [520, 1000]]), '#2a2036', 3, 0.9) + line(smooth([[840, 832], [910, 880], [1000, 940], [1080, 1000]]), '#2a2036', 3, 0.9);
    // 이정표 + 작은 등불
    const px = 612; const py = 948;
    s += fill(`M${px - 5} ${py}V${py - 120}h10V${py}Z`, '#3a2a36', 1, ol(2.4, '#0d0a18'));
    s += fill(`M${px - 2} ${py - 112}h54l12 11 -12 11h-54z`, '#5a3e3e', 1, ol(2.2, '#0d0a18')) + fill(`M${px + 2} ${py - 84}h-50l-12 10 12 10h50z`, '#4a3440', 1, ol(2.2, '#0d0a18'));
    s += line(`M${px + 2} ${py - 106}h46M${px - 2} ${py - 78}h-42`, '#ffc890', 1.4, 0.55);
    s += line(`M${px + 5} ${py - 60}h16v8`, '#1a1222', 2);
    s += `<circle cx="${px + 21}" cy="${py - 40}" r="34" fill="${B.rgu(px + 21, py - 40, 34, [[0, '#ffe2a0', 0.75], [1, '#ffb060', 0]])}"/>`;
    s += fill(`M${px + 14} ${py - 50}h14l-2 18h-10z`, DUSK.win, 1, ol(1.8, '#2a1606')) + fill(`M${px + 16} ${py - 47}h4v8h-4z`, '#ffffff', 0.85);
    // 앞 큰 나무 (역광 실루엣 + 테두리 빛)
    const bigTree = (tx, ty, sc, flip) => {
      const Rt = prng(`bigtree${tx}`);
      const sgn = flip ? -1 : 1;
      let o = '';
      const trunk = `M${f(tx - 26 * sc)} ${ty}C${f(tx - 18 * sc)} ${f(ty - 160 * sc)} ${f(tx - 30 * sc)} ${f(ty - 260 * sc)} ${f(tx - 6 * sc)} ${f(ty - 380 * sc)}L${f(tx + 14 * sc)} ${f(ty - 380 * sc)}C${f(tx + 10 * sc)} ${f(ty - 250 * sc)} ${f(tx + 24 * sc)} ${f(ty - 150 * sc)} ${f(tx + 34 * sc)} ${ty}Z`;
      const br = `M${f(tx)} ${f(ty - 260 * sc)}C${f(tx + sgn * 60 * sc)} ${f(ty - 300 * sc)} ${f(tx + sgn * 110 * sc)} ${f(ty - 330 * sc)} ${f(tx + sgn * 170 * sc)} ${f(ty - 340 * sc)}`;
      o += fill(trunk, '#0f1424') + line(br, '#0f1424', 14 * sc);
      o += line(`M${f(tx + sgn * 30 * sc)} ${ty}C${f(tx + sgn * 20 * sc)} ${f(ty - 160 * sc)} ${f(tx + sgn * 28 * sc)} ${f(ty - 260 * sc)} ${f(tx + sgn * 12 * sc)} ${f(ty - 370 * sc)}`, '#ff9a6a', 2.4, 0.55);
      const clusters = [[0, -420, 150], [sgn * 120, -380, 120], [sgn * 200, -330, 90], [-sgn * 90, -360, 110], [sgn * 40, -520, 110], [-sgn * 30, -300, 80], [sgn * 230, -420, 80]];
      let rim = ''; let body = ''; let mid = '';
      for (const [dx, dy, r] of clusters) {
        const cx = tx + dx * sc; const cy = ty + dy * sc; const rr = r * sc;
        for (let k = 0; k < 7; k++) {
          const a = (k / 7) * Math.PI * 2 + Rt();
          const px2 = cx + Math.cos(a) * rr * 0.55; const py2 = cy + Math.sin(a) * rr * 0.45; const r2 = rr * (0.42 + Rt() * 0.2);
          rim += circ(px2 + sgn * 4, py2 - 3, r2); body += circ(px2, py2, r2);
          if (Rt() < 0.5) mid += circ(px2 - sgn * r2 * 0.2, py2 + r2 * 0.2, r2 * 0.7);
        }
      }
      o += fill(rim, '#ff9e70', 0.75) + fill(body, '#121a2c') + fill(mid, '#0b1020', 0.6);
      return o;
    };
    s += bigTree(90, 1000, 1.05, false) + bigTree(1520, 1000, 0.95, true);
    // 아래 가장자리를 어둡게 (글자·단추 뒤 대비)
    s += `<rect y="860" width="${TW}" height="140" fill="${B.lgu(0, 860, 0, 1000, [[0, '#090612', 0], [1, '#090612', 0.65]])}"/>`;
    return B.svg(TW, TH, s, 'preserveAspectRatio="xMidYMax slice"');
  }

  const TITLE_LAYERS = { sky: titleSky, far: titleFar, mid: titleMid, village: titleVillage, front: titleFront };
  RG.art.titleLayer = function titleLayer(name) { return (TITLE_LAYERS[name] || titleSky)(); };

  /** 노을 구름 (아래가 빛을 받음) */
  RG.art.titleCloud = function titleCloud(i = 0) {
    const B = bag();
    const R = prng(`title-cloud${i}`);
    const wispy = i >= 2;
    const n = wispy ? 7 : 9;
    const puffs = [];
    for (let k = 0; k < n; k++) {
      const t = k / (n - 1);
      const x = 70 + t * 460 + (R() - 0.5) * 20;
      const bump = Math.sin(t * Math.PI);
      const r = (wispy ? 22 : 30) + bump * (wispy ? 26 : 46) * (0.7 + R() * 0.5);
      puffs.push([x, 160 - r * 0.55 - bump * (wispy ? 10 : 22), r]);
    }
    const base = ell(300, 158, 240, wispy ? 16 : 24);
    let rim = ''; let body = ''; let top = '';
    for (const [x, y, r] of puffs) { rim += circ(x, y + 4, r); body += circ(x, y, r); top += circ(x - r * 0.22, y - r * 0.28, r * 0.62); }
    rim += ell(300, 162, 240, wispy ? 16 : 24);
    const g = B.lgu(0, 40, 0, 190, [[0, '#4e3a78'], [0.45, '#8a4a80'], [0.8, '#e2777e'], [1, '#ffb28a']]);
    let s = `<g transform="${wispy ? 'scale(1 0.8) translate(0 40)' : ''}">`;
    s += fill(rim, '#ffd4a0', 0.9) + fill(body + base, g) + fill(top, '#3e2e66', 0.45);
    s += '</g>';
    return B.svg(600, 220, s);
  };

  /** 울림등 빛줄기 (가운데가 등불) */
  RG.art.titleRays = function titleRays() {
    const B = bag();
    const R = prng('title-rays');
    const g = B.rgu(500, 500, 500, [[0, '#fff4c8', 0.55], [0.25, '#ffdc90', 0.3], [0.6, '#ffb070', 0.08], [1, '#ffb070', 0]]);
    let d = '';
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2 + R() * 0.2;
      const w = 0.025 + R() * 0.05;
      const len = 330 + R() * 170;
      d += `M500 500L${f(500 + Math.cos(a - w) * len)} ${f(500 + Math.sin(a - w) * len)}L${f(500 + Math.cos(a + w) * len)} ${f(500 + Math.sin(a + w) * len)}Z`;
    }
    return B.svg(1000, 1000, fill(d, g));
  };

  /** 로고 아래 금빛 장식 */
  RG.art.logoFlourish = function logoFlourish() {
    const B = bag();
    const gold = B.lgu(0, 18, 0, 44, [[0, '#fff3c0'], [0.45, '#f6c45a'], [1, '#9a5a1c']]);
    const half = (sgn) => {
      const p = (x, y) => `${f(320 + sgn * x)} ${f(y)}`;
      return `M${p(26, 30)}C${p(70, 22)} ${p(110, 22)} ${p(150, 30)}C${p(190, 38)} ${p(230, 38)} ${p(262, 30)}C${p(280, 26)} ${p(292, 28)} ${p(300, 30)}`
        + `M${p(150, 30)}C${p(160, 16)} ${p(182, 12)} ${p(192, 22)}C${p(198, 28)} ${p(190, 34)} ${p(184, 30)}`
        + `M${p(96, 26)}C${p(104, 40)} ${p(124, 44)} ${p(132, 36)}C${p(136, 30)} ${p(128, 26)} ${p(124, 30)}`;
    };
    let s = line(half(1) + half(-1), '#3a1a06', 6.5) + line(half(1) + half(-1), gold, 3);
    s += fill('M320 14L334 30L320 46L306 30Z', '#3a1a06', 1, ol(4, '#3a1a06'));
    s += fill('M320 14L334 30L320 46L306 30Z', B.lg([[0, '#fffbe0'], [0.5, '#ffd76a'], [1, '#c07a20']], 0, 0, 1, 1));
    s += fill('M320 19L328 30L320 41Z', '#ffffff', 0.5);
    s += `<circle cx="300" cy="30" r="3.2" fill="${gold}"/><circle cx="340" cy="30" r="3.2" fill="${gold}"/>`;
    return B.svg(640, 60, s);
  };

  /** 원소 보석 (금 테두리 + 깎은 면 + 안의 상징) */
  RG.art.elementGem = function elementGem(key) {
    const B = bag();
    const c = EL()[key] || EL().light;
    const hue = key === 'fire' || key === 'light' ? '#c0305a' : '#3a2a9a';
    const deep = mix(c.dark, hue, 0.35);
    const bez = B.lg([[0, '#fff2b8'], [0.4, '#e8b048'], [1, '#7a4614']], 0, 0, 1, 1);
    let s = `<circle cx="32" cy="32" r="29" fill="${B.rg([[0, c.light, 0.55], [1, c.color, 0]], 0.5, 0.5, 0.5)}"/>`;
    s += fill(h.polyPath(32, 32, 22, 8, -67.5), bez, 1, ol(3, '#2a1606'));
    const P = (r, a) => [32 + Math.cos(((a - 90) * Math.PI) / 180) * r, 32 + Math.sin(((a - 90) * Math.PI) / 180) * r];
    const outer = []; const inner = [];
    for (let i = 0; i < 8; i++) { outer.push(P(18, i * 45 + 22.5)); inner.push(P(9.5, i * 45 + 22.5)); }
    const tones = [c.light, mix(c.light, c.color, 0.4), c.color, mix(c.color, deep, 0.5), deep, mix(c.color, deep, 0.7), c.color, mix(c.light, c.color, 0.2)];
    for (let i = 0; i < 8; i++) {
      const a = outer[i]; const b = outer[(i + 1) % 8]; const ci = inner[(i + 1) % 8]; const di = inner[i];
      s += fill(`M${f(a[0])} ${f(a[1])}L${f(b[0])} ${f(b[1])}L${f(ci[0])} ${f(ci[1])}L${f(di[0])} ${f(di[1])}Z`, tones[i]);
    }
    s += fill(`M${inner.map((p) => `${f(p[0])} ${f(p[1])}`).join('L')}Z`, B.rg([[0, '#ffffff'], [0.5, c.light], [1, c.color]], 0.38, 0.32, 0.8));
    s += fill(`M${outer.map((p) => `${f(p[0])} ${f(p[1])}`).join('L')}Z`, 'none', 1, ol(1.4, deep));
    const sym = {
      fire: 'M32 22C36 27 38 30 36 35C35 38 33 40 32 40C29 40 27 38 27 35C27 32 29 31 30 28C31 31 33 31 32 22Z',
      frost: 'M32 22L36 31L32 41L28 31Z',
      storm: 'M34 21L27 33H32L29 42L37 29H32Z',
      earth: 'M24 39L30 28L33 33L36 27L41 39Z',
      light: h.starPath(32, 31.5, 9, 4, 4, -90),
      dark: 'M35 22A10 10 0 1 0 39 37A8 8 0 1 1 35 22Z',
    }[key] || '';
    s += fill(sym, '#ffffff', 0.9, ol(1.2, deep));
    s += `<path d="${sparkle(24, 23, 4)}" fill="#ffffff"/>`;
    return B.svg(64, 64, s);
  };

  /* =====================================================
   * 월드 지도 — 지역마다 한 장의 그림 지도(위에서 내려다봄, 빛은 왼쪽 위)
   *   RG.art.REGION_NODES[r]  맵 6개 + 무한 맵 1개 자리 (viewBox 1600×900 좌표)
   *   RG.art.regionMap(r)     그 지역 그림 (길·지형·꾸밈)
   * ===================================================== */
  const MW = 1600;
  const MH = 900;
  const BASE_NODES = [[180, 690], [440, 560], [700, 690], [960, 545], [1210, 660], [1430, 450], [1180, 250]];
  RG.art.REGION_NODES = {};
  for (let r = 1; r <= 6; r++) {
    // 지역마다 조금씩 다르게: 짝수 지역은 위아래를 뒤집고, 살짝 흔듦
    const R = prng(`nodes-${r}`);
    RG.art.REGION_NODES[r] = BASE_NODES.map(([x, y], i) => {
      let yy = r % 2 === 0 ? MH - y + 20 : y;
      if (i === 6) yy = r % 2 === 0 ? 640 : 250;
      return [Math.round(x + (R() - 0.5) * 50), Math.round(yy + (R() - 0.5) * 50)];
    });
  }
  const PAL = {
    1: { g0: '#7fb24e', g1: '#5f9a3c', g2: '#a8cf66', road: '#d9b47a', roadD: '#9c7442', edge: '#3f6a2a', water: '#3f8fd0', waterL: '#8fd0f0' },
    2: { g0: '#e6eef8', g1: '#c4d4ea', g2: '#ffffff', road: '#c9b89c', roadD: '#8a7a64', edge: '#7d8fb0', water: '#5d9ad6', waterL: '#cdeaff' },
    3: { g0: '#d98a52', g1: '#b8653a', g2: '#f0b277', road: '#f3d8a0', roadD: '#a8703c', edge: '#7a3a22', water: '#ff7a2a', waterL: '#ffd27a' },
    4: { g0: '#7fae8e', g1: '#5e8e78', g2: '#a8cfa0', road: '#ead7a4', roadD: '#9a8458', edge: '#355e5a', water: '#2a6aa8', waterL: '#8fd8f0' },
    5: { g0: '#7a6e9a', g1: '#5c5280', g2: '#a597c8', road: '#e8c66a', roadD: '#8a6a2a', edge: '#2e2648', water: '#3a2a6a', waterL: '#c9a6ff' },
    6: { g0: '#2a2868', g1: '#1a1848', g2: '#4a44a0', road: '#fff0c0', roadD: '#c8a85a', edge: '#4a3a7a', water: '#100e38', waterL: '#c8d8ff' },
  };

  function nearRoad(samples, x, y, d) {
    const d2 = d * d;
    for (const [px, py] of samples) { const dx = px - x; const dy = py - y; if (dx * dx + dy * dy < d2) return true; }
    return false;
  }

  /** 위에서 본 둥근 나무 (그림자 → 몸통 → 밝은 면) */
  function treeTop(x, y, r, col, R) {
    let s = fill(ell(x + r * 0.35, y + r * 0.45, r * 1.05, r * 0.7), '#1a1030', 0.28);
    const pts = crownCircles(x, y, r, R, 5);
    s += pts.map(([cx, cy, rr]) => fill(circ(cx, cy, rr), col, 1, ol(2.2, shade(col, -0.55)))).join('');
    s += pts.map(([cx, cy, rr]) => fill(circ(cx - rr * 0.25, cy - rr * 0.3, rr * 0.5), shade(col, 0.28), 0.8)).join('');
    return s;
  }
  function pineTop(x, y, hh, col, R, snow) {
    let s = fill(ell(x + hh * 0.25, y + 2, hh * 0.36, hh * 0.12), '#1a1030', 0.3);
    s += fill(pinePath(x, y, hh, R), col, 1, ol(2, shade(col, -0.55)));
    s += fill(`M${f(x)} ${f(y - hh)}L${f(x - hh * 0.2)} ${f(y - hh * 0.45)}L${f(x)} ${f(y - hh * 0.55)}Z`, shade(col, 0.3), 0.7);
    if (snow) s += fill(`M${f(x)} ${f(y - hh)}L${f(x + hh * 0.13)} ${f(y - hh * 0.74)}Q${f(x)} ${f(y - hh * 0.8)} ${f(x - hh * 0.13)} ${f(y - hh * 0.74)}Z`, '#ffffff', 0.95);
    return s;
  }
  /** 산(위에서 비스듬히): 왼쪽 빛 면·오른쪽 그늘 면·눈 */
  function peak(x, y, w, hh, col, snow, R) {
    const top = [x + (R() - 0.5) * w * 0.15, y - hh];
    let s = fill(`M${f(x - w * 0.55)} ${f(y)}L${f(top[0])} ${f(top[1])}L${f(x + w * 0.7)} ${f(y + 4)}Z`, '#1a1030', 0.25, ` transform="translate(${f(w * 0.18)} 6)"`);
    s += fill(`M${f(x - w * 0.5)} ${f(y)}L${f(top[0])} ${f(top[1])}L${f(x + w * 0.5)} ${f(y)}Z`, shade(col, -0.25), 1, ol(2.6, shade(col, -0.6)));
    s += fill(`M${f(x - w * 0.5)} ${f(y)}L${f(top[0])} ${f(top[1])}L${f(top[0] + w * 0.06)} ${f(y - hh * 0.35)}L${f(x - w * 0.05)} ${f(y)}Z`, shade(col, 0.18));
    if (snow) s += fill(`M${f(top[0])} ${f(top[1])}L${f(top[0] - w * 0.17)} ${f(top[1] + hh * 0.34)}L${f(top[0] - w * 0.06)} ${f(top[1] + hh * 0.28)}L${f(top[0])} ${f(top[1] + hh * 0.4)}L${f(top[0] + w * 0.08)} ${f(top[1] + hh * 0.3)}L${f(top[0] + w * 0.17)} ${f(top[1] + hh * 0.34)}Z`, '#ffffff', 0.96, ol(1.4, '#9fb4d8'));
    return s;
  }
  /** 평평한 꼭대기 바위 언덕(메사) */
  function mesa(x, y, w, hh, col, R) {
    const topY = y - hh;
    const tw = w * (0.7 + R() * 0.15);
    let s = fill(ell(x + w * 0.25, y + 6, w * 0.6, w * 0.16), '#1a0a10', 0.3);
    s += fill(`M${f(x - w / 2)} ${f(y)}L${f(x - tw / 2)} ${f(topY + 8)}L${f(x + tw / 2)} ${f(topY + 8)}L${f(x + w / 2)} ${f(y)}Q${f(x)} ${f(y + w * 0.1)} ${f(x - w / 2)} ${f(y)}Z`, shade(col, -0.3), 1, ol(2.6, shade(col, -0.65)));
    for (let i = 1; i < 4; i++) s += line(`M${f(x - w / 2 + (w - tw) / 2 * (i / 4) )} ${f(y - (y - topY - 8) * (i / 4))}Q${f(x)} ${f(y - (y - topY - 8) * (i / 4) + 6)} ${f(x + w / 2 - (w - tw) / 2 * (i / 4))} ${f(y - (y - topY - 8) * (i / 4))}`, shade(col, -0.5), 1.6, 0.6);
    s += fill(ell(x, topY + 8, tw / 2, tw * 0.16), shade(col, 0.12), 1, ol(2.4, shade(col, -0.6)));
    s += fill(ell(x - tw * 0.12, topY + 6, tw * 0.28, tw * 0.07), shade(col, 0.32), 0.7);
    return s;
  }
  function house2(x, y, w, roof, R) {
    const hh = w * 0.55;
    let s = fill(`M${f(x - w / 2 + 6)} ${f(y + 4)}h${f(w)}l8 6h${f(-w)}Z`, '#1a1030', 0.3);
    s += fill(`M${f(x - w / 2)} ${f(y)}V${f(y - hh * 0.55)}H${f(x + w / 2)}V${f(y)}Z`, '#e9dcc2', 1, ol(2, '#5a4636'));
    s += fill(`M${f(x - w / 2 - 4)} ${f(y - hh * 0.5)}L${f(x)} ${f(y - hh * 1.2)}L${f(x + w / 2 + 4)} ${f(y - hh * 0.5)}Z`, roof, 1, ol(2, shade(roof, -0.55)));
    s += fill(`M${f(x - w / 2 - 4)} ${f(y - hh * 0.5)}L${f(x)} ${f(y - hh * 1.2)}L${f(x - 2)} ${f(y - hh * 0.5)}Z`, shade(roof, 0.22), 0.8);
    s += `<rect x="${f(x - w * 0.12)}" y="${f(y - hh * 0.4)}" width="${f(w * 0.24)}" height="${f(hh * 0.25)}" fill="#ffd57a" stroke="#5a4636" stroke-width="1.4"/>`;
    return s;
  }
  function ruinWall(x, y, w, col, R) {
    let s = fill(`M${f(x - w / 2 + 6)} ${f(y + 3)}h${f(w)}l6 8h${f(-w)}Z`, '#0e0820', 0.35);
    let d = `M${f(x - w / 2)} ${f(y)}`;
    const n = 5;
    for (let i = 0; i <= n; i++) d += `L${f(x - w / 2 + (w * i) / n)} ${f(y - 18 - R() * 26)}`;
    d += `L${f(x + w / 2)} ${f(y)}Z`;
    s += fill(d, col, 1, ol(2.4, shade(col, -0.6)));
    for (let i = 0; i < 3; i++) s += line(`M${f(x - w / 2 + 4)} ${f(y - 8 - i * 9)}H${f(x + w / 2 - 4)}`, shade(col, -0.35), 1.3, 0.6);
    s += fill(`M${f(x - w / 2)} ${f(y)}L${f(x - w / 2)} ${f(y - 20)}L${f(x - w / 2 + 8)} ${f(y - 22)}L${f(x - w / 2 + 8)} ${f(y)}Z`, shade(col, 0.25), 0.7);
    return s;
  }

  RG.art.regionMap = function regionMap(r) {
    r = Math.max(1, Math.min(6, Number(r) || 1));
    const B = bag();
    const R = prng(`region-map-${r}`);
    const P = PAL[r];
    const nodes = RG.art.REGION_NODES[r];
    const roadPts = nodes.slice(0, 6);
    const start = [-40, roadPts[0][1] + (r % 2 ? 40 : -40)];
    const pts = [start, ...roadPts];
    const samples = sampleSmooth(pts, 24);
    const side = smooth([roadPts[4], [(roadPts[4][0] + nodes[6][0]) / 2 + 60, (roadPts[4][1] + nodes[6][1]) / 2], nodes[6]]);
    const sideS = sampleSmooth([roadPts[4], [(roadPts[4][0] + nodes[6][0]) / 2 + 60, (roadPts[4][1] + nodes[6][1]) / 2], nodes[6]], 16);
    const allS = samples.concat(sideS);
    let s = '';
    // 바탕: 지역 색 + 빛(왼쪽 위 밝게, 오른쪽 아래 어둡게)
    s += `<rect width="${MW}" height="${MH}" fill="${B.lgu(0, 0, MW, MH, [[0, P.g2], [0.45, P.g0], [1, P.g1]])}"/>`;
    // 땅 얼룩(색 변화)
    for (let i = 0; i < 70; i++) {
      const x = R() * MW; const y = R() * MH; const rx = 40 + R() * 140;
      s += fill(blob(x, y, rx, rx * (0.4 + R() * 0.4), R, 9, 0.25), R() < 0.5 ? P.g2 : P.g1, 0.16 + R() * 0.14);
    }
    let deco = '';
    const place = (n, min, fn, area = [0, 0, MW, MH]) => {
      let k = 0; let tries = 0;
      while (k < n && tries < n * 30) {
        tries++;
        const x = area[0] + R() * (area[2] - area[0]); const y = area[1] + R() * (area[3] - area[1]);
        if (nearRoad(allS, x, y, min) || nodes.some(([nx, ny]) => Math.hypot(nx - x, ny - y) < min + 30)) continue;
        deco += fn(x, y); k++;
      }
    };
    const items = [];
    const add = (y, svg) => items.push([y, svg]);
    if (r === 1) {
      // 밭(조각보) + 강 + 숲 + 마을 + 풍차
      const fieldCols = ['#c8d86a', '#e6c860', '#9cc858', '#d8b45a', '#b4d06e'];
      for (let i = 0; i < 26; i++) {
        const x = R() * MW; const y = R() * MH;
        if (nearRoad(allS, x, y, 110)) continue;
        const w = 70 + R() * 90; const hh = 40 + R() * 50; const a = (R() - 0.5) * 30;
        const c = fieldCols[i % fieldCols.length];
        let g = fill(`M${f(x - w / 2)} ${f(y - hh / 2)}h${f(w)}v${f(hh)}h${f(-w)}Z`, c, 0.95, ol(2, shade(c, -0.45)));
        for (let j = 1; j < 5; j++) g += line(`M${f(x - w / 2 + 4)} ${f(y - hh / 2 + (hh * j) / 5)}h${f(w - 8)}`, shade(c, -0.25), 1.6, 0.6);
        s += `<g transform="rotate(${f(a)} ${f(x)} ${f(y)})">${g}</g>`;
      }
      const river = smooth([[1650, 80], [1300, 150], [1050, 90], [800, 210], [560, 140], [300, 260], [-50, 200]]);
      s += line(river, '#2a5a88', 64, 1) + line(river, P.water, 54) + line(river, P.waterL, 14, 0.5, ` stroke-dasharray="40 60"`);
      place(60, 70, (x, y) => { add(y, treeTop(x, y, 16 + R() * 12, R() < 0.5 ? '#3f8a3a' : '#4f9a40', R)); return ''; });
      place(5, 100, (x, y) => { for (let j = 0; j < 3; j++) add(y + j * 4, house2(x + j * 48 - 48, y + (j % 2) * 14, 42, ['#c8543a', '#d8743a', '#b84a3a'][j], R)); return ''; }, [200, 300, 1500, 880]);
      // 풍차
      place(2, 110, (x, y) => { add(y, `${fill(ell(x + 14, y + 4, 26, 8), '#1a1030', 0.3)}${fill(`M${f(x - 14)} ${f(y)}L${f(x - 9)} ${f(y - 54)}H${f(x + 9)}L${f(x + 14)} ${f(y)}Z`, '#efe2c8', 1, ol(2.2, '#5a4636'))}${fill(`M${f(x - 12)} ${f(y - 52)}L${f(x)} ${f(y - 70)}L${f(x + 12)} ${f(y - 52)}Z`, '#b84a3a', 1, ol(2, '#5a2214'))}${[20, 110, 200, 290].map((a) => line(`M${f(x)} ${f(y - 56)}l${f(Math.cos(a * Math.PI / 180) * 42)} ${f(Math.sin(a * Math.PI / 180) * 42)}`, '#7a5a3a', 5) + line(`M${f(x)} ${f(y - 56)}l${f(Math.cos(a * Math.PI / 180) * 42)} ${f(Math.sin(a * Math.PI / 180) * 42)}`, '#f6efe0', 2.4)).join('')}<circle cx="${f(x)}" cy="${f(y - 56)}" r="4" fill="#5a3a24"/>`); return ''; }, [100, 300, 1500, 860]);
    } else if (r === 2) {
      const lake = blob(1250, 160, 220, 90, R, 11, 0.2);
      s += fill(lake, '#7a9cc8', 1, ol(4, '#4e6a98')) + fill(lake, P.waterL, 0.85, ' transform="translate(-8 -8) scale(0.98)" transform-origin="1250 160"');
      for (let i = 0; i < 8; i++) s += line(`M${f(1100 + R() * 300)} ${f(110 + R() * 100)}l${f(30 + R() * 40)} ${f((R() - 0.5) * 30)}`, '#ffffff', 2, 0.7);
      place(16, 120, (x, y) => { add(y, peak(x, y, 120 + R() * 90, 110 + R() * 80, '#8a9ec4', true, R)); return ''; }, [0, 0, MW, 520]);
      place(70, 60, (x, y) => { add(y, pineTop(x, y, 34 + R() * 20, '#2f6a5a', R, true)); return ''; });
      for (let i = 0; i < 60; i++) s += fill(circ(R() * MW, R() * MH, 1.5 + R() * 2.5), '#ffffff', 0.8);
    } else if (r === 3) {
      const crack = smooth([[-40, 120], [300, 200], [620, 130], [900, 260], [1250, 190], [1650, 300]]);
      s += line(crack, '#3a1208', 46) + line(crack, P.water, 26) + line(crack, P.waterL, 8, 0.9);
      s += `<path d="${crack}" fill="none" stroke="#ffb040" stroke-width="70" stroke-opacity="0.25" filter="${B.blur(14)}"/>`;
      place(12, 120, (x, y) => { add(y, mesa(x, y, 130 + R() * 90, 60 + R() * 50, '#c8603a', R)); return ''; });
      place(40, 50, (x, y) => { add(y, fill(ell(x, y, 14 + R() * 10, 8 + R() * 5), '#9a4a2a', 1, ol(2, '#5a2214')) + fill(ell(x - 4, y - 3, 6, 3), '#e08a5a', 0.8)); return ''; });
      for (let i = 0; i < 14; i++) { const x = R() * MW; const y = 500 + R() * 400; if (nearRoad(allS, x, y, 80)) continue; s += line(`M${f(x - 60)} ${f(y)}q60 -20 120 0`, '#f6c890', 4, 0.6); }
    } else if (r === 4) {
      // 바다(오른쪽 아래), 모래 띠, 절벽, 등대, 난파선
      const coast = smooth([[1650, 300], [1500, 360], [1470, 520], [1330, 640], [1150, 740], [900, 800], [620, 860], [300, 930]]);
      const sea = `${coast}L1650 950L1650 380Z`;
      s += fill(sea, P.water, 1);
      s += `<path d="${coast}" fill="none" stroke="#f0e2b0" stroke-width="40"/>`;
      s += `<path d="${coast}" fill="none" stroke="${P.waterL}" stroke-width="10" stroke-dasharray="30 26" transform="translate(16 18)" opacity="0.85"/>`;
      for (let i = 0; i < 40; i++) { const x = 1000 + R() * 620; const y = 520 + R() * 400; if (y < 900 - (x - 300) * 0.48) continue; s += line(`M${f(x)} ${f(y)}q10 -8 20 0q10 8 20 0`, '#cfefff', 2.2, 0.75); }
      // 작은 섬 둘 + 난파선
      for (const [ix, iy, ir] of [[1560, 700, 46], [1420, 850, 34]]) s += fill(blob(ix, iy, ir, ir * 0.6, R, 9, 0.2), '#f0e2b0', 1, ol(2.4, '#9a8458')) + fill(blob(ix - 4, iy - 4, ir * 0.62, ir * 0.36, R, 8, 0.2), '#5e9a6a', 1, ol(1.8, '#2e5a3a'));
      s += `<g transform="translate(1290 800) rotate(-14)">${fill('M-40 0Q0 18 40 0L32 -10H-32Z', '#6a4a2e', 1, ol(2.4, '#2a1a10'))}${line('M-6 -10V-56', '#4a3020', 4)}${fill('M-4 -54L22 -40L-4 -30Z', '#e6dcc4', 0.9, ol(1.6, '#5a4a3a'))}</g>`;
      place(14, 90, (x, y) => { add(y, mesa(x, y, 100 + R() * 70, 40 + R() * 30, '#6a8a80', R)); return ''; }, [0, 0, 1300, 600]);
      place(40, 60, (x, y) => { add(y, treeTop(x, y, 13 + R() * 8, '#2f7a5a', R)); return ''; }, [0, 0, 1300, 750]);
      add(470, `<g>${fill(ell(1505, 470, 30, 10), '#1a1030', 0.3)}${fill('M1490 470L1494 380L1516 380L1520 470Z', '#f4efe4', 1, ol(2.4, '#5a4a4a'))}${fill('M1494 410h22v14h-22Z', '#c84a3a')}${fill('M1488 380h34l-6 -18h-22Z', '#3a3a5a', 1, ol(2, '#1a1030'))}<circle cx="1505" cy="372" r="8" fill="#fff3c4"/><path d="M1505 372L1640 330L1640 410Z" fill="#fff3c4" opacity="0.35"/></g>`);
    } else if (r === 6) {
      // 밤하늘 위 구름 섬: 별·별자리, 구름 덩어리, 별다리 활, 오른쪽 위 별종 첨탑과 그믐달
      for (let i = 0; i < 160; i++) s += fill(circ(R() * MW, R() * MH, 0.8 + R() * 2.2), i % 4 ? '#ffffff' : '#ffe7a8', 0.5 + R() * 0.45);
      for (let i = 0; i < 26; i++) s += fill(sparkle(R() * MW, R() * MH, 3 + R() * 5), '#ffe7a8', 0.85);
      s += line(smooth([[120, 120], [260, 70], [380, 140], [520, 90]]), '#c8d8ff', 2, 0.45) + line(smooth([[1000, 820], [1120, 760], [1260, 800]]), '#c8d8ff', 2, 0.45);
      const cloudIsland = (x, y, w, hh) => {
        let g = fill(ell(x + w * 0.1, y + hh * 0.5, w * 0.55, hh * 0.35), '#0a0828', 0.35);
        const pts = [];
        for (let i = 0; i < 7; i++) pts.push([x - w * 0.5 + (w * i) / 6, y + (R() - 0.5) * hh * 0.3, hh * (0.45 + R() * 0.35)]);
        g += pts.map(([cx, cy, rr]) => fill(circ(cx, cy, rr), '#d8d2f4', 1, ol(2.4, '#6a60a8'))).join('');
        g += pts.map(([cx, cy, rr]) => fill(circ(cx - rr * 0.25, cy - rr * 0.3, rr * 0.55), '#ffffff', 0.75)).join('');
        return g;
      };
      place(16, 110, (x, y) => { add(y, cloudIsland(x, y, 120 + R() * 120, 40 + R() * 30)); return ''; });
      // 별다리 활 두 개 (하나는 놓이고 하나는 사라지는 중)
      s += line(smooth([[300, 860], [520, 760], [740, 840]]), '#ffe7a8', 10, 0.85) + line(smooth([[300, 860], [520, 760], [740, 840]]), '#fff8e0', 3);
      s += line(smooth([[900, 120], [1100, 60], [1300, 130]]), '#ffe7a8', 8, 0.4, ' stroke-dasharray="14 18"');
      // 별종 첨탑 (무한 맵 옆)
      const bx = nodes[6][0] + 170; const by = nodes[6][1] + 60;
      add(by, `<g>${fill(ell(bx + 18, by + 8, 60, 14), '#0a0828', 0.4)}${fill(`M${bx - 26} ${by}L${bx - 14} ${by - 150}L${bx - 6} ${by - 166}H${bx + 6}L${bx + 14} ${by - 150}L${bx + 26} ${by}Z`, B.lgu(bx - 26, 0, bx + 26, 0, [[0, '#d6d0f4'], [0.5, '#a69ed0'], [1, '#5a5290']]), 1, ol(3, '#2c2656'))}${line(`M${bx - 20} ${by - 40}H${bx + 20}M${bx - 17} ${by - 90}H${bx + 17}`, '#6a62a0', 2.4)}<circle cx="${bx}" cy="${by - 190}" r="46" fill="#ffe7a8" opacity="0.25"/>${fill(`M${bx} ${by - 214}C${bx - 18} ${by - 214} ${bx - 22} ${by - 196} ${bx - 22} ${by - 184}C${bx - 22} ${by - 176} ${bx - 28} ${by - 172} ${bx - 30} ${by - 170}H${bx + 30}C${bx + 28} ${by - 172} ${bx + 22} ${by - 176} ${bx + 22} ${by - 184}C${bx + 22} ${by - 196} ${bx + 18} ${by - 214} ${bx} ${by - 214}Z`, B.lgu(bx - 22, 0, bx + 22, 0, [[0, '#fff4c8'], [0.5, '#e8c070'], [1, '#9a7030']]), 1, ol(3, '#4a3410'))}</g>`);
      s += `<circle cx="1480" cy="110" r="70" fill="#ffe7a8" opacity="0.18"/>` + fill('M1480 70A40 40 0 1 0 1508 140A31 31 0 1 1 1480 70Z', '#fff4d0', 1, ol(2.4, '#8a7a4a'));
    } else {
      // 보랏빛 폐허: 깨진 담, 기둥, 금빛 균열, 가운데 깨진 대종
      // 금빛 균열 그물 + 보랏빛 안개
      const veins = [[[-40, 300], [400, 260], [800, 380], [1200, 300], [1650, 420]], [[300, -20], [360, 200], [300, 420], [420, 640], [380, 920]], [[1050, -20], [1000, 220], [1120, 470], [1060, 700], [1140, 920]], [[-40, 760], [300, 820], [700, 780], [1000, 860]]];
      const vb = B.blur(10);
      for (const v of veins) { const d = smooth(v); s += `<path d="${d}" fill="none" stroke="#ffd27a" stroke-width="26" stroke-opacity="0.22" filter="${vb}"/>` + line(d, '#3a2a10', 7, 0.7) + line(d, '#ffe9a0', 3, 0.95); }
      const fogB = B.blur(26);
      for (let i = 0; i < 9; i++) s += fill(blob(R() * MW, R() * MH, 120 + R() * 120, 50 + R() * 40, R), '#c8a6ff', 0.16, ` filter="${fogB}"`);
      place(22, 90, (x, y) => { add(y, ruinWall(x, y, 90 + R() * 80, '#8e82b4', R)); return ''; });
      place(26, 60, (x, y) => { add(y, `${fill(ell(x + 8, y + 2, 14, 5), '#0e0820', 0.35)}${fill(`M${f(x - 8)} ${f(y)}V${f(y - 40 - R() * 20)}h16V${f(y)}Z`, '#b7aedb', 1, ol(2, '#3a2e5a'))}${fill(`M${f(x - 8)} ${f(y - 2)}V${f(y - 38)}h5V${f(y - 2)}Z`, '#e4defa', 0.7)}`); return ''; });
      const bx = nodes[6][0] + 150; const by = nodes[6][1] + 40;
      add(by, `<g>${fill(ell(bx + 20, by + 8, 90, 20), '#0e0820', 0.4)}${fill(`M${bx - 70} ${by}Q${bx - 64} ${by - 110} ${bx} ${by - 118}Q${bx + 64} ${by - 110} ${bx + 70} ${by}Z`, B.lgu(bx - 70, 0, bx + 70, 0, [[0, '#f6d27a'], [0.5, '#c8902e'], [1, '#7a4e18']]), 1, ol(3.4, '#3a2208'))}${line(`M${bx - 10} ${by - 112}L${bx + 6} ${by - 70}L${bx - 8} ${by - 40}L${bx + 10} ${by}`, '#2a1406', 4)}${line(`M${bx - 10} ${by - 112}L${bx + 6} ${by - 70}L${bx - 8} ${by - 40}L${bx + 10} ${by}`, '#d8b4ff', 2)}${fill(ell(bx, by, 70, 14), '#5a3a14', 1, ol(3, '#3a2208'))}</g>`);
      for (let i = 0; i < 70; i++) s += fill(sparkle(R() * MW, R() * MH, 2 + R() * 5), i % 3 ? '#e4d0ff' : '#ffe9a0', 0.75);
    }
    // 꾸밈은 아래쪽(y가 큰) 것이 앞에
    items.sort((a, b) => a[0] - b[0]);
    // 길: 그늘 → 테두리 → 흙 → 가운데 밝은 길 → 점선 바퀴 자국
    const road = smooth(pts);
    const roadLayer = (d, wd) => line(d, '#1a1030', wd + 18, 0.22, ' transform="translate(6 8)"') + line(d, P.edge, wd + 10) + line(d, P.roadD, wd + 4) + line(d, P.road, wd) + line(d, shade(P.road, 0.25), wd * 0.35, 0.7) + line(d, P.roadD, 2.2, 0.55, ' stroke-dasharray="8 14"');
    s += roadLayer(road, 34);
    s += line(side, P.edge, 22, 0.9, ' stroke-dasharray="2 20"') + line(side, P.road, 10, 0.9, ' stroke-dasharray="18 14"');
    // 나무·산 등은 길 위에
    s += deco + items.map((x) => x[1]).join('');
    // 노드 자리 받침(밝은 원판) — 메달은 화면(DOM)이 그림
    for (const [x, y] of nodes) s += fill(ell(x + 6, y + 10, 52, 20), '#1a1030', 0.3) + fill(ell(x, y + 4, 48, 18), shade(P.road, 0.15), 1, ol(3, P.roadD));
    // 가장자리 어둡게 + 빛
    s += `<rect width="${MW}" height="${MH}" fill="${B.rgu(MW / 2, MH / 2, MW * 0.7, [[0.6, '#000000', 0], [1, '#0c0618', 0.55]], 0.7)}"/>`;
    s += `<rect width="${MW}" height="${MH}" fill="${B.lgu(0, 0, MW, MH, [[0, '#fff6d0', 0.18], [0.5, '#fff6d0', 0], [1, '#20103a', 0.18]])}"/>`;
    return B.svg(MW, MH, s);
  };
})();
