'use strict';

/* =========================================================
 * 효과 — 시뮬레이션 이벤트를 받아 파티클·고리·번개·떠오르는 글자를 만듭니다.
 * 좌표는 칸 단위(월드). 그리기는 RG.render가 ctx와 변환을 넘겨 줍니다.
 * ========================================================= */
RG.fx = (() => {
  const parts = [];      // 파티클
  const rings = [];      // 퍼지는 고리
  const bolts = [];      // 번개·선
  const texts = [];      // 떠오르는 글자
  const areas = [];      // 바닥 경고 원
  const drops = [];      // 떨어지는 고드름 (고드름 구름)
  let shake = 0;
  const settings = { numbers: true, shake: true };
  const MAX_PARTS = 900;
  const MAX_TEXTS = 60;

  const COLORS = () => RG.data.elements;
  function colorOf(el) {
    if (el === 'steam') return '#e8f4ff';
    const e = COLORS()[el];
    return e ? e.color : '#ffffff';
  }
  function lightOf(el) {
    if (el === 'steam') return '#ffffff';
    const e = COLORS()[el];
    return e ? e.light : '#ffffff';
  }

  const rnd = Math.random;   // 연출 전용(시뮬레이션과 무관)

  // 화면에 적이 아주 많을 때(렌더러가 알려 줌) 조각·글자 수를 줄여 느린 기기에서도 매끄럽게
  let lite = false;
  let lite2 = false; // 느린 기기의 가벼운 단계: 더 적게
  function setLite(v) { lite = !!v; lite2 = v === 2; }
  let gameSpeed = 1; // 판 배속 (판 시간에 맞춰야 하는 효과 — 고드름 낙하)
  function setSpeed(v) { gameSpeed = v > 0 ? v : 1; }
  function burst(x, y, color, n, speed = 2.2, life = 0.5, size = 0.06, gravity = 0) {
    const cap = lite2 ? 70 : lite ? 160 : MAX_PARTS; // 적이 아주 많으면 조각 수를 줄임(그래도 화면은 충분히 붐빔)
    for (let i = 0; i < n && parts.length < cap; i++) {
      const a = rnd() * Math.PI * 2;
      const s = speed * (0.3 + rnd() * 0.7);
      parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - speed * 0.3, life, max: life, size: size * (0.6 + rnd() * 0.8), color, g: gravity });
    }
  }
  // 적이 아주 많으면(가벼운 모드) 고리·번개는 한꺼번에 몇 개까지만 — 고리마다 선 긋기 호출이 따로 들어 휴대폰에서 비쌌음
  const LITE_RINGS = 18;
  const LITE_BOLTS = 10;
  function ring(x, y, radius, color, life = 0.45, width = 0.08) { if (lite && rings.length >= (lite2 ? 8 : LITE_RINGS)) return; rings.push({ x, y, r: radius, color, life, max: life, w: width }); }
  function text(x, y, str, color, big) {
    if (texts.length >= MAX_TEXTS) texts.shift();
    texts.push({ x: x + (rnd() - 0.5) * 0.2, y, str, color, life: big ? 1.1 : 0.8, max: big ? 1.1 : 0.8, big: !!big });
  }
  function bolt(points, color, life = 0.16, width = 0.06, jag = 0.16) {
    if (lite && bolts.length >= (lite2 ? 5 : LITE_BOLTS)) return;
    // 지그재그 미리 계산
    const pts = [];
    for (let i = 0; i < points.length - 1; i++) {
      const [ax, ay] = points[i];
      const [bx, by] = points[i + 1];
      const segs = Math.max(2, Math.round(Math.hypot(bx - ax, by - ay) / 0.35));
      for (let k = 0; k <= segs; k++) {
        const t = k / segs;
        const off = (k === 0 || k === segs) ? 0 : (rnd() - 0.5) * jag * 2;
        const nx = -(by - ay);
        const ny = bx - ax;
        const L = Math.hypot(nx, ny) || 1;
        pts.push([ax + (bx - ax) * t + (nx / L) * off, ay + (by - ay) * t + (ny / L) * off]);
      }
    }
    bolts.push({ pts, color, life, max: life, w: width });
  }
  function line(ax, ay, bx, by, color, life = 0.14, width = 0.07) { if (lite && bolts.length >= LITE_BOLTS) return; bolts.push({ pts: [[ax, ay], [bx, by]], color, life, max: life, w: width, straight: true }); }

  /** 시뮬레이션 이벤트 처리 */
  function onEvents(events, game) {
    for (const e of events) {
      switch (e.type) {
        case 'hit':
          if (e.dot) break;
          burst(e.x, e.y - 0.2, colorOf(e.element), e.beam ? 2 : 4, 1.6, 0.3, 0.05);
          if (settings.numbers && (e.amount >= 1)) text(e.x, e.y - 0.55, String(Math.round(e.amount)), e.crit ? '#ffe066' : '#ffffff', e.crit);
          break;
        case 'kill': {
          const big = e.boss;
          // 몬스터마다 죽는 효과가 따로 있으면(렌더러가 그림) 공통 효과는 작게
          const own = RG.art.ENEMY_MOTION && RG.art.ENEMY_MOTION[e.enemyType] && RG.art.ENEMY_MOTION[e.enemyType].deathFx;
          burst(e.x, e.y - 0.25, '#c9c3d6', big ? 60 : own ? 4 : 12, big ? 4 : 2.4, big ? 1.2 : 0.6, big ? 0.12 : 0.07, 2);
          burst(e.x, e.y - 0.25, '#ffffff', big ? 30 : own ? 2 : 5, 1.2, 0.8, 0.05, -1.2);
          if (e.bounty) text(e.x, e.y - 0.8, `+${e.bounty}`, '#ffd34d');
          if (big) { addShake(0.5); ring(e.x, e.y, 2.5, '#ffffff', 0.9, 0.15); }
          break;
        }
        case 'splash':
          ring(e.x, e.y, e.radius, colorOf(e.element), e.big ? 0.6 : 0.35, e.big ? 0.14 : 0.09);
          burst(e.x, e.y, colorOf(e.element), e.big ? 26 : 10, 2.6, 0.45, 0.07, 1.5);
          if (e.big) addShake(0.2);
          break;
        case 'pulse':
          ring(e.x, e.y, e.radius, colorOf(e.element), e.big ? 0.7 : 0.45, e.big ? 0.15 : 0.1);
          if (e.fear) ring(e.x, e.y, e.radius * 0.6, '#e9a6ff', 0.6, 0.06); // 공포의 종: 겹 소리 고리
          break;
        case 'cone': {
          // 화염 분사기: 분사관 끝에서 부채꼴로 퍼지는 불길 조각
          const tw = game && game.state.towers.find((q) => q.id === e.towerId);
          const mz = (tw && RG.render.muzzleOf && RG.render.muzzleOf(tw)) || { x: e.x, y: e.y - 0.4 };
          const full = e.cone >= 360;
          const spread = (full ? 360 : e.cone) * (Math.PI / 180);
          const n = lite ? (full ? 8 : 6) : (full ? 18 : 12);
          const cols = ['#fff1a8', '#ffc85a', '#ff8a3d', '#ff5a2a'];
          for (let i = 0; i < n && parts.length < (lite2 ? 70 : lite ? 160 : MAX_PARTS); i++) {
            const a = e.angle + (rnd() - 0.5) * spread;
            const sp = e.range * (2.2 + rnd() * 1.4);
            const life = 0.32 + rnd() * 0.12;
            parts.push({ x: full ? e.x : mz.x, y: full ? e.y - 0.25 : mz.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.8, life, max: life, size: 0.07 + rnd() * 0.08, color: cols[i % 4], g: -0.6 });
          }
          break;
        }
        case 'icicle':
          drops.push({ x: e.x, y: e.y, t: 0, delay: (e.delay || 0.35) / gameSpeed, big: !!e.big }); // 판에서 떨어지는 시간과 맞춤
          break;
        case 'icicleHit':
          burst(e.x, e.y - 0.1, '#dff6ff', e.big ? 22 : 8, e.big ? 2.6 : 1.8, 0.4, e.big ? 0.08 : 0.055, 2.5);
          ring(e.x, e.y, e.radius + 0.15, '#9fe4ff', 0.35, e.big ? 0.12 : 0.07);
          if (e.big) addShake(0.15);
          break;
        case 'strike':
          // 뇌운 탑: 하늘에서 내리꽂는 번개 (굵은 줄기 + 가는 곁가지)
          bolt([[e.x + (rnd() - 0.5) * 0.8, e.y - 5], [e.x + (rnd() - 0.5) * 0.3, e.y - 2.2], [e.x, e.y - 0.15]], '#c9b8ff', e.big ? 0.26 : 0.2, e.big ? 0.13 : 0.09, 0.3);
          if (!lite) bolt([[e.x + (rnd() - 0.5) * 0.4, e.y - 2.6], [e.x + (rnd() - 0.5) * 1.2, e.y - 1.2]], '#e6dcff', 0.14, 0.04, 0.2);
          ring(e.x, e.y, e.big ? 0.9 : 0.55, '#d9ccff', 0.3, e.big ? 0.14 : 0.08);
          burst(e.x, e.y - 0.1, '#efe8ff', e.big ? 18 : 7, 2.4, 0.3, 0.05);
          if (e.big) addShake(0.25);
          break;
        case 'thorns':
          burst(e.x, e.y, '#9fd36a', 10, 1.6, 0.45, 0.06, 1.2);
          ring(e.x, e.y, e.radius, '#6fae3c', 0.4, 0.07);
          break;
        case 'fear':
          text(e.x, e.y - 0.95, '!', '#e9a6ff', true);
          break;
        case 'chain':
          bolt(e.points, colorOf(e.element), e.small ? 0.12 : 0.18, e.small ? 0.04 : 0.07);
          break;
        case 'fire':
          if (e.kind === 'ballista') {
            const tw = game && game.state.towers.find((q) => q.id === e.towerId);
            const mz = tw && RG.render && RG.render.muzzleOf ? RG.render.muzzleOf(tw) : null;
            line(mz ? mz.x : e.x, mz ? mz.y : e.y - 0.4, e.tx, e.ty, '#c8f2ff', 0.16, 0.09);
          }
          break;
        case 'leak':
          if (game) {
            const L = game.map.lantern;
            ring(L.x, L.y, 1.2, e.shielded ? '#9ad7ff' : '#ff4a4a', 0.6, 0.15);
            if (!e.shielded) addShake(0.35);
          }
          break;
        case 'build': case 'upgrade': {
          const x = e.c + 0.5;
          const y = e.r + 0.5;
          ring(x, y + 0.3, 0.7, '#fff3c4', 0.5, 0.08);
          burst(x, y + 0.3, '#d9c7a0', 14, 1.8, 0.5, 0.07, 2);
          if (e.type === 'upgrade') burst(x, y - 0.3, '#ffe68a', 16, 1.5, 0.8, 0.05, -0.8);
          break;
        }
        case 'sell':
          burst(e.c + 0.5, e.r + 0.5, '#ffd34d', 16, 2, 0.6, 0.06, 1.5);
          text(e.c + 0.5, e.r, `+${e.value}`, '#ffd34d');
          break;
        case 'shieldBreak':
          burst(e.x, e.y - 0.3, '#bfe8ff', 14, 2.6, 0.5, 0.07, 2);
          break;
        case 'towerDisabled':
          if (game) {
            const t = game.state.towers.find((q) => q.id === e.towerId);
            if (t) burst(t.x, t.y - 0.3, e.reason === 'breath' ? '#bdefff' : '#c9b8ff', 10, 1.4, 0.6, 0.06);
          }
          break;
        case 'bossPhase':
          ring(e.x, e.y, 3, '#ffffff', 1, 0.2);
          addShake(0.6);
          break;
        case 'bossAbility':
          if (e.ability === 'emerge' || e.ability === 'blink') { ring(e.x, e.y, 1.4, '#ffb36b', 0.6, 0.15); burst(e.x, e.y, '#c9a27a', 24, 3, 0.7, 0.08, 2); addShake(0.3); }
          if (e.ability === 'breath' || e.ability === 'bolt') addShake(0.25);
          break;
        case 'trapTrigger':
          ring(e.x, e.y, 0.7, '#d14fc0', 0.4, 0.1);
          burst(e.x, e.y, '#6e1f66', 12, 1.6, 0.5, 0.06);
          break;
        case 'trap':
          line(e.fromX, e.fromY - 0.3, e.x, e.y, 'rgba(209,79,192,0.6)', 0.25, 0.04);
          break;
        case 'heroSkill':
          ring(e.x, e.y, 1.8, '#ffffff', 0.6, 0.12);
          break;
        case 'execute':
          text(e.x, e.y - 0.9, '처형!', '#ff7ad9', true);
          break;
        case 'gold':
          text(e.x, e.y - 0.7, `+${e.amount}`, '#ffd34d', true);
          burst(e.x, e.y - 0.3, '#ffd34d', 10, 1.4, 0.7, 0.06, -0.5);
          break;
        case 'immune':
          text(e.x, e.y - 0.6, '면역', '#b8b8c8');
          break;
        case 'absorb':
          text(e.x, e.y - 0.6, `+${Math.round(e.amount)}`, '#7dff9a');
          break;
        case 'revive':
          ring(e.x, e.y, 0.9, '#9fffc2', 0.6, 0.1);
          burst(e.x, e.y, '#9fffc2', 18, 1.2, 0.9, 0.06, -1);
          break;
        case 'warnArea':
          areas.push({ x: e.x, y: e.y, r: e.radius, life: e.dur, max: e.dur, color: colorOf(e.element) });
          break;
        case 'burrow': case 'unburrow':
          burst(e.x, e.y, '#c9a47a', 12, 1.6, 0.5, 0.07, 2);
          break;
        case 'cyclone':
          ring(e.x, e.y, e.radius, '#e7e4ff', 0.5, 0.12);
          burst(e.x, e.y, '#ffffff', 16, 2.4, 0.6, 0.05, -1);
          break;
        case 'enemyShot':
          line(e.x, e.y - 0.4, e.tx, e.ty - 0.3, '#c9a27a', 0.18, 0.05);
          break;
        case 'unitHit':
          if (e.amount > 0) burst(e.x, e.y - 0.3, '#ff9a9a', 3, 1, 0.25, 0.04);
          break;
        case 'heroDown':
          burst(e.x, e.y - 0.3, '#ffffff', 20, 2, 0.8, 0.06, -0.5);
          break;
        case 'heroLevel':
          if (game && game.state.hero) { const h = game.state.hero; ring(h.x, h.y, 1, '#ffe68a', 0.7, 0.1); text(h.x, h.y - 1.1, '레벨 업!', '#ffe68a', true); }
          break;
        case 'enemyHeal':
          ring(e.x, e.y, e.radius, '#7dff9a', 0.6, 0.06);
          break;
        case 'enemyShield':
          ring(e.x, e.y, e.radius, '#8fd6ff', 0.6, 0.06);
          break;
        case 'taskDone':
          break;
        default:
          break;
      }
    }
  }

  const TIMED = [rings, bolts, texts, areas];
  // 조각 묶음: 색마다 투명도 7단계 칸을 한 번 만들어 두고 매 프레임 다시 씀 (문자열 키·배열을 새로 만들지 않음)
  const pBuckets = new Map();
  const pOrder = [];
  let pFrame = 0;
  const fontCache = new Map();
  function addShake(v) { if (settings.shake) shake = Math.min(1, shake + v); }

  function update(dt) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life -= dt;
      if (p.life <= 0) { parts.splice(i, 1); continue; }
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.96; p.vy *= 0.96;
    }
    for (let k = 0; k < TIMED.length; k++) {
      const list = TIMED[k];
      for (let i = list.length - 1; i >= 0; i--) { list[i].life -= dt; if (list[i].life <= 0) list.splice(i, 1); }
    }
    for (const t of texts) t.y -= dt * (t.big ? 0.9 : 1.2);
    for (let i = drops.length - 1; i >= 0; i--) { drops[i].t += dt; if (drops[i].t >= drops[i].delay) drops.splice(i, 1); }
    shake = Math.max(0, shake - dt * 2.2);
  }

  function shakeOffset(T) {
    if (shake <= 0) return [0, 0];
    const m = shake * shake * T * 0.18;
    return [(rnd() - 0.5) * m, (rnd() - 0.5) * m];
  }

  /** 바닥 효과(경고 원) — 유닛 아래 */
  function drawUnder(ctx, X, Y, T) {
    for (const a of areas) {
      const k = 1 - a.life / a.max;
      ctx.save();
      ctx.globalAlpha = 0.25 + 0.35 * Math.abs(Math.sin(k * Math.PI * 4));
      ctx.strokeStyle = a.color;
      ctx.fillStyle = a.color;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(X(a.x), Y(a.y), a.r * T, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha *= 0.3;
      ctx.beginPath(); ctx.arc(X(a.x), Y(a.y), a.r * T * k, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }

  /** 위쪽 효과 */
  function draw(ctx, X, Y, T) {
    ctx.save();
    for (const r of rings) {
      const k = 1 - r.life / r.max;
      ctx.globalAlpha = Math.max(0, 1 - k) * 0.9;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = Math.max(1.5, r.w * T * (1 - k * 0.6));
      ctx.beginPath();
      ctx.arc(X(r.x), Y(r.y), Math.max(1, r.r * T * (0.35 + 0.65 * k)), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'lighter';
    for (const b of bolts) {
      const a = b.life / b.max;
      ctx.globalAlpha = a;
      ctx.strokeStyle = b.color;
      ctx.lineWidth = Math.max(1.5, b.w * T);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      b.pts.forEach(([x, y], i) => (i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y))));
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(1, b.w * T * 0.35);
      ctx.stroke();
    }
    // 떨어지는 고드름: 하늘(2.6칸 위)에서 맞을 자리로 가속하며 떨어짐
    if (drops.length) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      for (const d of drops) {
        const k = Math.min(1, d.t / d.delay);
        const y = d.y - 2.6 * (1 - k * k);
        const L = (d.big ? 0.7 : 0.38) * T;
        const W = (d.big ? 0.2 : 0.11) * T;
        const cx = X(d.x);
        const cy = Y(y);
        ctx.fillStyle = '#d8f4ff';
        ctx.strokeStyle = '#2a4a6a';
        ctx.lineWidth = Math.max(1, T * 0.025);
        ctx.beginPath(); ctx.moveTo(cx - W, cy - L); ctx.lineTo(cx + W, cy - L); ctx.lineTo(cx, cy); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.moveTo(cx - W * 0.45, cy - L * 0.9); ctx.lineTo(cx - W * 0.05, cy - L * 0.9); ctx.lineTo(cx - W * 0.1, cy - L * 0.35); ctx.closePath(); ctx.fill();
        // 떨어질 자리 그림자 (가까워질수록 진해짐)
        ctx.fillStyle = `rgba(20,40,70,${(0.15 + 0.35 * k).toFixed(2)})`;
        ctx.beginPath(); ctx.ellipse(X(d.x), Y(d.y), W * 1.6, W * 0.7, 0, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalCompositeOperation = 'lighter';
    }
    // 조각: 같은 색·비슷한 투명도(6단계)끼리 한 경로로 모아 한 번에 칠함 (조각마다 칠하면 수백 번)
    pFrame++;
    pOrder.length = 0;
    if (pBuckets.size > 64) pBuckets.clear();
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      const a = Math.min(1, p.life / p.max * 1.5);
      const q = Math.max(1, Math.round(a * 6));
      let bs = pBuckets.get(p.color);
      if (!bs) { bs = []; for (let j = 0; j <= 6; j++) bs.push({ color: p.color, a: j / 6, list: [], f: 0 }); pBuckets.set(p.color, bs); }
      const g = bs[q];
      if (g.f !== pFrame) { g.f = pFrame; g.list.length = 0; pOrder.push(g); } // 처음 나온 순서대로 칠함 (예전과 같은 순서)
      g.list.push(p);
    }
    for (let k = 0; k < pOrder.length; k++) {
      const g = pOrder[k];
      ctx.globalAlpha = g.a;
      ctx.fillStyle = g.color;
      ctx.beginPath();
      const l = g.list;
      for (let i = 0; i < l.length; i++) { const p = l[i]; const s = Math.max(1.2, p.size * T); ctx.rect(X(p.x) - s / 2, Y(p.y) - s / 2, s, s); }
      ctx.fill();
      l.length = 0;
    }
    pOrder.length = 0;
    ctx.restore();
  }

  function drawTexts(ctx, X, Y, T) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const from = lite ? Math.max(0, texts.length - (lite2 ? 6 : 12)) : 0; // 적이 아주 많으면 최근 글자만
    for (let i = from; i < texts.length; i++) {
      const t = texts[i];
      const a = Math.min(1, t.life / t.max * 2);
      ctx.globalAlpha = a;
      const fs = Math.round(Math.max(11, T * (t.big ? 0.42 : 0.3)));
      let font = fontCache.get(fs);
      if (!font) { font = `800 ${fs}px system-ui, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`; fontCache.set(fs, font); }
      if (ctx.font !== font) ctx.font = font;
      ctx.lineWidth = Math.max(2.5, fs * 0.22);
      ctx.strokeStyle = 'rgba(20,14,30,0.9)';
      ctx.strokeText(t.str, X(t.x), Y(t.y));
      ctx.fillStyle = t.color;
      ctx.fillText(t.str, X(t.x), Y(t.y));
    }
    ctx.restore();
  }

  function clear() { parts.length = 0; rings.length = 0; bolts.length = 0; texts.length = 0; areas.length = 0; drops.length = 0; shake = 0; }

  return { onEvents, update, draw, drawUnder, drawTexts, shakeOffset, clear, settings, burst, ring, text, colorOf, lightOf, setLite, setSpeed };
})();
