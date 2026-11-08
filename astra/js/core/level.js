'use strict';

/* =========================================================
 * 스테이지 지도 — 출발 지점에서 보스 구역까지 이어지는 길
 *   - 구역(area): 축에 맞춘 직사각형 발판 (출발 / 교전 / 보상 / 보스)
 *   - 길(seg): 두 점 사이의 넓은 길 (방향 전환, 오르막 경사로)
 *   - 교전(encounter): 구역에 들어서면 방벽이 닫히고 적이 나타남
 * 보스 구역은 (0,0)~(arenaW, arenaH), 높이 0. 나머지는 그 남쪽(아래)으로 이어지고
 * 출발 지점일수록 낮아서, 플레이어는 위로 올라가며 보스에게 다가갑니다.
 * DOM 없음 (Node 테스트에서 사용).
 * ========================================================= */
window.AZ = window.AZ || {};

AZ.level = (() => {
  function seeded(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /**
   * 챕터마다 다른(하지만 항상 같은) 지역 지도를 만듭니다. 흐름(플레이어 기준):
   *   지역 입구 → 탐험 구역 → 일반 전투 ① → 분기점 ─┬─ 일반 전투 ② ─────────┐
   *                                                └─ 숨겨진 연구실 → 보물 ─┴→ 스토리 이벤트
   *   → 중간 보스전 → 체크포인트 → 최종 전투 구역 → 챕터 보스
   * 보스 구역에서 거꾸로(남쪽으로) 내려가며 만들고, 출발점일수록 낮습니다(위로 오르는 길).
   * waves: 챕터의 웨이브 3개 → 전투 ①, ②, 최종 전투
   */
  function generate(chapterId, aw, ah, waves) {
    const rng = seeded(chapterId * 7919 + 101);
    const R = (a, b) => a + rng() * (b - a);
    const sgn = () => (rng() < 0.5 ? -1 : 1);
    const L = { id: `lv${chapterId}-${aw}x${ah}`, areas: [], segs: [], encounters: [], pickups: [], events: [], props: [], aw, ah };
    const WD = 300;
    const area = (kind, cx, y0, w, h, z, extra) => {
      const a = Object.assign({ id: `${kind}${L.areas.length}`, kind, x0: cx - w / 2, y0, x1: cx + w / 2, y1: y0 + h, z }, extra || {});
      L.areas.push(a);
      return a;
    };
    const seg = (ax, ay, az, bx, by, bz, extra) => {
      const sg = Object.assign({ ax, ay, az, bx, by, bz, w: WD }, extra || {});
      L.segs.push(sg);
      return sg;
    };
    /** 두 점 사이를 ㄱ자/S자로 꺾어 잇는 길 (각 꺾임점 반환) */
    const wind = (ax, ay, az, bx, by, bz, extra) => {
      const pts = [[ax, ay]];
      const midY = (ay + by) / 2;
      if (Math.abs(bx - ax) > 40) { pts.push([ax, midY]); pts.push([bx, midY]); } else if (rng() < 0.7) {
        const off = sgn() * R(260, 420);
        pts.push([ax, ay + (by - ay) * 0.3]); pts.push([ax + off, ay + (by - ay) * 0.3]); pts.push([ax + off, ay + (by - ay) * 0.7]); pts.push([bx, ay + (by - ay) * 0.7]);
      }
      pts.push([bx, by]);
      for (let i = 0; i < pts.length - 1; i++) {
        const z0 = az + (bz - az) * (i / (pts.length - 1));
        const z1 = az + (bz - az) * ((i + 1) / (pts.length - 1));
        seg(pts[i][0], pts[i][1], z0, pts[i + 1][0], pts[i + 1][1], z1, extra);
      }
      return pts;
    };
    const cxOf = (a) => (a.x0 + a.x1) / 2;
    const cyOf = (a) => (a.y0 + a.y1) / 2;

    // ── 보스 구역 (0,0)~(aw,ah) ──
    const boss = area('boss', aw / 2, 0, aw, ah, 0, { id: 'boss' });
    // ── 최종 전투 구역 ──
    const fx = aw / 2 + R(-220, 220);
    const fin = area('fight', fx, ah + R(380, 460), 900, 620, -100, { id: 'final', label: '최종 전투 구역' });
    const r1 = wind(aw / 2, ah - 60, 0, fx, fin.y0 + 60, -100);
    // ── 체크포인트 ──
    const cpx = fx + sgn() * R(150, 380);
    const cp = area('checkpoint', cpx, fin.y1 + R(380, 480), 560, 440, -170, { id: 'checkpoint', label: '체크포인트' });
    const r2 = wind(fx, fin.y1 - 40, -100, cpx, cp.y0 + 40, -170);
    // ── 중간 보스전 ──
    const mx = cpx + sgn() * R(120, 300);
    const mid = area('fight', mx, cp.y1 + R(360, 440), 1040, 720, -230, { id: 'midboss', label: '중간 보스' });
    const r3 = wind(cpx, cp.y1 - 40, -170, mx, mid.y0 + 40, -230);
    // ── 스토리 이벤트 (두 갈래 길이 다시 만나는 곳) ──
    const sx = aw / 2 + R(-120, 120);
    const story = area('story', sx, mid.y1 + R(380, 460), 660, 480, -300, { id: 'story', label: '스토리 이벤트' });
    const r4 = wind(mx, mid.y1 - 40, -230, sx, story.y0 + 40, -300);
    // ── 두 갈래 ──
    const side = sgn(); // 숨겨진 연구실이 있는 쪽
    const ax = sx - side * R(720, 820); // 일반 전투 ② (본길)
    const hx = sx + side * R(720, 820); // 숨겨진 연구실 / 보물
    const b2 = area('fight', ax, story.y1 + R(420, 520), 880, 620, -400, { id: 'battle2', label: '일반 전투 ②' });
    const t = area('treasure', hx, story.y1 + R(260, 320), 520, 420, -170, { id: 'treasure', label: '보물' });
    const lab = area('lab', hx, t.y1 + R(380, 460), 720, 540, -400, { id: 'lab', label: '숨겨진 연구실' });
    const pY = Math.max(b2.y1, lab.y1) + R(380, 460);
    const bp = area('branch', sx, pY, 760, 520, -470, { id: 'branch', label: '분기점' });
    // 본길: 분기점 → 전투 ② → 스토리
    const rA1 = wind(bp.x0 + 140, bp.y0 + 40, -470, ax, b2.y1 - 40, -400);
    const rA2 = wind(ax, b2.y0 + 40, -400, story.x0 + 120, story.y1 - 40, -300);
    // 옆길: 분기점 → 연구실 → (오르막) 보물 → 스토리
    wind(bp.x1 - 140, bp.y0 + 40, -470, hx, lab.y1 - 40, -400, { branch: true });
    seg(hx, lab.y0 + 40, -400, hx, t.y1 - 40, -170, { branch: true, w: 260 });
    wind(hx, t.y0 + 40, -170, story.x1 - 120, story.y1 - 40, -300, { branch: true });
    // ── 일반 전투 ① ──
    const b1x = sx + R(-200, 200);
    const b1 = area('fight', b1x, bp.y1 + R(380, 460), 900, 620, -540, { id: 'battle1', label: '일반 전투 ①' });
    const r5 = wind(b1x, b1.y0 + 40, -540, sx, bp.y1 - 40, -470);
    // ── 탐험 구역 ──
    const exX = b1x + sgn() * R(150, 360);
    const ex = area('explore', exX, b1.y1 + R(400, 480), 1000, 700, -600, { id: 'explore', label: '탐험 구역' });
    const r6 = wind(exX, ex.y0 + 40, -600, b1x, b1.y1 - 40, -540);
    // ── 지역 입구 ──
    const enX = exX + R(-150, 150);
    const en = area('start', enX, ex.y1 + R(360, 440), 760, 520, -660, { id: 'start', label: '지역 입구' });
    const r7 = wind(enX, en.y0 + 40, -660, exX, ex.y1 - 40, -600);
    L.start = { x: enX, y: en.y1 - 150 };

    // ── 길 안내 경로 (출발 → 보스, 본길) ──
    const rev = (pts) => pts.slice().reverse();
    const route = [[L.start.x, L.start.y]];
    const add = (pts) => { for (const q of pts) route.push(q); };
    add(r7.slice().reverse().length ? r7.slice() : []);
    route.push([cxOf(ex), cyOf(ex)]);
    add(r6.slice());
    route.push([cxOf(b1), cyOf(b1)]);
    add(r5.slice());
    route.push([cxOf(bp), cyOf(bp)]);
    add(rA1.slice());
    route.push([cxOf(b2), cyOf(b2)]);
    add(rA2.slice());
    route.push([cxOf(story), cyOf(story)]);
    add(rev(r4));
    route.push([cxOf(mid), cyOf(mid)]);
    add(rev(r3));
    route.push([cxOf(cp), cyOf(cp)]);
    add(rev(r2));
    route.push([cxOf(fin), cyOf(fin)]);
    add(rev(r1));
    route.push([aw / 2, ah * 0.45]);
    L.route = route;

    // ── 교전 ──
    const wv = waves || [];
    const w0 = wv[0] || [['hound', 2]];
    const w1 = wv[1] || w0;
    const w2 = wv[2] || w1;
    const strongest = (list) => {
      const E = (AZ.data && AZ.data.enemies) || {};
      let best = list[0][0];
      for (const [type] of list) if ((E[type] ? E[type].hp : 0) > (E[best] ? E[best].hp : 0)) best = type;
      return best;
    };
    L.encounters.push({ id: 'battle1', order: 0, area: b1, wave: w0, entry: { x: cxOf(b1), y: b1.y1 - 80 } });
    L.encounters.push({ id: 'battle2', order: 1, area: b2, wave: w1, optional: true, route: 'main' });
    L.encounters.push({ id: 'lab', order: 1, area: lab, wave: [[w0[0][0], 2], [strongest(w1), 1]], optional: true, route: 'side' });
    L.encounters.push({ id: 'midboss', order: 2, area: mid, wave: [[strongest(w1.concat(w2)), 1]], escorts: [[w0[0][0], 2]], elite: true, entry: { x: cxOf(mid), y: mid.y1 - 80 } });
    L.encounters.push({ id: 'final', order: 3, area: fin, wave: w2, entry: { x: cxOf(fin), y: fin.y1 - 80 } });
    L.events.push({ id: 'story', kind: 'story', area: story });
    L.events.push({ id: 'checkpoint', kind: 'checkpoint', area: cp });

    // ── 줍는 것 ──
    L.pickups.push({ kind: 'memory', x: cxOf(t), y: cyOf(t) - 30 });
    for (let i = 0; i < 3; i++) L.pickups.push({ kind: 'credit', amount: 60, x: ex.x0 + 160 + i * ((ex.x1 - ex.x0 - 320) / 2), y: ex.y0 + R(140, ex.y1 - ex.y0 - 140) });
    L.pickups.push({ kind: 'heal', x: ex.x1 - 120, y: ex.y1 - 120 });
    L.pickups.push({ kind: 'heal', x: cxOf(mid), y: cyOf(mid), hidden: true, area: mid.id });
    L.pickups.push({ kind: 'heal', x: cxOf(b2), y: cyOf(b2), hidden: true, area: b2.id });

    // ── 상호작용: NPC, 보물 상자, 관문 단말기 ──
    L.objects = [
      { kind: 'npc', x: ex.x0 + 170, y: cyOf(ex) - 60, area: ex.id },
      { kind: 'chest', x: cxOf(t) + 110, y: cyOf(t) + 60, area: t.id, label: '보물 상자', verb: '열기' },
      { kind: 'gate', x: cxOf(fin) + 220, y: fin.y0 + 90, area: fin.id, label: '관문 단말기', verb: '관문 개방' },
    ];
    L.gate = { y: fin.y0, x0: fin.x0, x1: fin.x1 };
    // 구역 → 지역 번호 (1~7, 8 = 보스)
    L.regionOf = { start: 1, explore: 1, battle1: 2, branch: 2, battle2: 3, lab: 4, treasure: 4, story: 5, midboss: 6, checkpoint: 6, final: 7, boss: 8 };

    // ── 장식 배치용 정보 ──
    L.props.push({ kind: 'beacon', x: cxOf(cp), y: cyOf(cp), area: cp.id });
    L.props.push({ kind: 'labRoom', area: lab.id });
    L.props.push({ kind: 'chest', x: cxOf(t) + 90, y: cyOf(t) + 50 });
    L.props.push({ kind: 'crates', area: ex.id });
    L.props.push({ kind: 'gate', area: en.id });

    let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
    const grow = (x, y, m) => { bx0 = Math.min(bx0, x - m); by0 = Math.min(by0, y - m); bx1 = Math.max(bx1, x + m); by1 = Math.max(by1, y + m); };
    for (const a of L.areas) { grow(a.x0, a.y0, 0); grow(a.x1, a.y1, 0); }
    for (const sg of L.segs) { grow(sg.ax, sg.ay, sg.w); grow(sg.bx, sg.by, sg.w); }
    L.bounds = { x0: bx0, y0: by0, x1: bx1, y1: by1 };
    L.bossEntry = { x: aw / 2, y: ah + 160 };
    L.checkpointPos = { x: cxOf(cp), y: cyOf(cp) };
    void boss;
    return L;
  }

  /* ───────── 기하 도우미 ───────── */
  function rectSegDist(a, s) {
    // 길(선분)과 직사각형 사이의 최소 거리 (대략: 선분 위 점들 표본)
    let best = Infinity;
    for (let i = 0; i <= 16; i++) {
      const t = i / 16;
      const x = s.ax + (s.bx - s.ax) * t;
      const y = s.ay + (s.by - s.ay) * t;
      const dx = Math.max(a.x0 - x, 0, x - a.x1);
      const dy = Math.max(a.y0 - y, 0, y - a.y1);
      best = Math.min(best, Math.hypot(dx, dy));
    }
    return best;
  }
  function rectRectGap(a, b) {
    const dx = Math.max(a.x0 - b.x1, 0, b.x0 - a.x1);
    const dy = Math.max(a.y0 - b.y1, 0, b.y0 - a.y1);
    return Math.hypot(dx, dy);
  }
  function segProj(s, x, y) {
    const dx = s.bx - s.ax;
    const dy = s.by - s.ay;
    const len2 = dx * dx + dy * dy || 1;
    let t = ((x - s.ax) * dx + (y - s.ay) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const px = s.ax + dx * t;
    const py = s.ay + dy * t;
    return { t, px, py, d: Math.hypot(x - px, y - py) };
  }
  const inArea = (a, x, y, m) => x >= a.x0 + m && x <= a.x1 - m && y >= a.y0 + m && y <= a.y1 - m;

  /** 이 점의 바닥 높이 */
  function floorZ(L, x, y) {
    if (!L) return 0;
    let best = null;
    let bd = Infinity;
    for (const a of L.areas) {
      if (inArea(a, x, y, 0)) return a.z;
      const dx = Math.max(a.x0 - x, 0, x - a.x1);
      const dy = Math.max(a.y0 - y, 0, y - a.y1);
      const d = Math.hypot(dx, dy);
      if (d < bd) { bd = d; best = a.z; }
    }
    let bs = null;
    for (const s of L.segs) {
      const p = segProj(s, x, y);
      if (p.d <= s.w / 2 + 1) {
        const z = s.az + (s.bz - s.az) * p.t;
        if (bs == null || z > bs) bs = z;
      } else if (p.d - s.w / 2 < bd) {
        bd = p.d - s.w / 2;
        best = s.az + (s.bz - s.az) * p.t;
      }
    }
    return bs != null ? bs : best || 0;
  }

  /** 걸을 수 있는 곳 안쪽으로 밀어 넣기. lock: 이 구역 밖으로는 못 나감 */
  function constrain(L, x, y, r, lock) {
    if (lock) {
      return { x: Math.max(lock.x0 + r, Math.min(lock.x1 - r, x)), y: Math.max(lock.y0 + r, Math.min(lock.y1 - r, y)) };
    }
    for (const a of L.areas) if (inArea(a, x, y, r)) return { x, y };
    for (const s of L.segs) if (segProj(s, x, y).d <= s.w / 2 - r) return { x, y };
    let best = null;
    let bd = Infinity;
    for (const a of L.areas) {
      const cx = Math.max(a.x0 + r, Math.min(a.x1 - r, x));
      const cy = Math.max(a.y0 + r, Math.min(a.y1 - r, y));
      const d = Math.hypot(cx - x, cy - y);
      if (d < bd) { bd = d; best = { x: cx, y: cy }; }
    }
    for (const s of L.segs) {
      const p = segProj(s, x, y);
      const lim = Math.max(0, s.w / 2 - r);
      const k = p.d > 0 ? Math.min(1, lim / p.d) : 0;
      const cx = p.px + (x - p.px) * k;
      const cy = p.py + (y - p.py) * k;
      const d = Math.hypot(cx - x, cy - y);
      if (d < bd) { bd = d; best = { x: cx, y: cy }; }
    }
    return best || { x, y };
  }

  /** 이 점이 길·구역 위인가 (여유 m) */
  function onLevel(L, x, y, m) {
    for (const a of L.areas) if (x >= a.x0 - m && x <= a.x1 + m && y >= a.y0 - m && y <= a.y1 + m) return true;
    for (const s of L.segs) if (segProj(s, x, y).d <= s.w / 2 + m) return true;
    return false;
  }

  /** 길 안내: 플레이어 위치에서 경로를 따라 ahead 만큼 앞선 점 */
  function guide(L, x, y, ahead) {
    const R = L.route;
    if (!R || R.length < 2) return null;
    let bi = 0;
    let bt = 0;
    let bd = Infinity;
    for (let i = 0; i < R.length - 1; i++) {
      const p = segProj({ ax: R[i][0], ay: R[i][1], bx: R[i + 1][0], by: R[i + 1][1] }, x, y);
      if (p.d < bd) { bd = p.d; bi = i; bt = p.t; }
    }
    let left = ahead;
    let i = bi;
    let px = R[i][0] + (R[i + 1][0] - R[i][0]) * bt;
    let py = R[i][1] + (R[i + 1][1] - R[i][1]) * bt;
    const pts = [[px, py]];
    while (left > 0 && i < R.length - 1) {
      const nx = R[i + 1][0];
      const ny = R[i + 1][1];
      const d = Math.hypot(nx - px, ny - py);
      if (d >= left) {
        px += (nx - px) * (left / d);
        py += (ny - py) * (left / d);
        pts.push([px, py]);
        left = 0;
        break;
      }
      left -= d;
      px = nx;
      py = ny;
      pts.push([px, py]);
      i += 1;
    }
    // 남은 경로 길이
    let remain = Math.hypot(R[bi + 1][0] - x, R[bi + 1][1] - y);
    for (let j = bi + 1; j < R.length - 1; j++) remain += Math.hypot(R[j + 1][0] - R[j][0], R[j + 1][1] - R[j][1]);
    return { x: px, y: py, pts, remain };
  }

  return { generate, floorZ, constrain, onLevel, inArea, segProj, guide };
})();
