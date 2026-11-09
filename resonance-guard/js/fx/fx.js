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

  function burst(x, y, color, n, speed = 2.2, life = 0.5, size = 0.06, gravity = 0) {
    for (let i = 0; i < n && parts.length < MAX_PARTS; i++) {
      const a = rnd() * Math.PI * 2;
      const s = speed * (0.3 + rnd() * 0.7);
      parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - speed * 0.3, life, max: life, size: size * (0.6 + rnd() * 0.8), color, g: gravity });
    }
  }
  function ring(x, y, radius, color, life = 0.45, width = 0.08) { rings.push({ x, y, r: radius, color, life, max: life, w: width }); }
  function text(x, y, str, color, big) {
    if (texts.length >= MAX_TEXTS) texts.shift();
    texts.push({ x: x + (rnd() - 0.5) * 0.2, y, str, color, life: big ? 1.1 : 0.8, max: big ? 1.1 : 0.8, big: !!big });
  }
  function bolt(points, color, life = 0.16, width = 0.06, jag = 0.16) {
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
  function line(ax, ay, bx, by, color, life = 0.14, width = 0.07) { bolts.push({ pts: [[ax, ay], [bx, by]], color, life, max: life, w: width, straight: true }); }

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
          break;
        case 'chain':
          bolt(e.points, colorOf(e.element), e.small ? 0.12 : 0.18, e.small ? 0.04 : 0.07);
          break;
        case 'fire':
          if (e.kind === 'ballista') line(e.x, e.y - 0.4, e.tx, e.ty, '#c8f2ff', 0.16, 0.09);
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
    for (const list of [rings, bolts, texts, areas]) {
      for (let i = list.length - 1; i >= 0; i--) { list[i].life -= dt; if (list[i].life <= 0) list.splice(i, 1); }
    }
    for (const t of texts) t.y -= dt * (t.big ? 0.9 : 1.2);
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
    for (const p of parts) {
      ctx.globalAlpha = Math.min(1, p.life / p.max * 1.5);
      ctx.fillStyle = p.color;
      const s = Math.max(1.2, p.size * T);
      ctx.fillRect(X(p.x) - s / 2, Y(p.y) - s / 2, s, s);
    }
    ctx.restore();
  }

  function drawTexts(ctx, X, Y, T) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const t of texts) {
      const a = Math.min(1, t.life / t.max * 2);
      ctx.globalAlpha = a;
      const fs = Math.round(Math.max(11, T * (t.big ? 0.42 : 0.3)));
      ctx.font = `800 ${fs}px system-ui, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
      ctx.lineWidth = Math.max(2.5, fs * 0.22);
      ctx.strokeStyle = 'rgba(20,14,30,0.9)';
      ctx.strokeText(t.str, X(t.x), Y(t.y));
      ctx.fillStyle = t.color;
      ctx.fillText(t.str, X(t.x), Y(t.y));
    }
    ctx.restore();
  }

  function clear() { parts.length = 0; rings.length = 0; bolts.length = 0; texts.length = 0; areas.length = 0; shake = 0; }

  return { onEvents, update, draw, drawUnder, drawTexts, shakeOffset, clear, settings, burst, ring, text, colorOf, lightOf };
})();
