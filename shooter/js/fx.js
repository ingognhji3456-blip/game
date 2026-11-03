'use strict';

/* =========================================================
 * 하늘 사냥꾼 — 픽셀 효과
 * 폭발 애니메이션, 파편, 픽셀 원(충격파), 떠오르는 글자, 화면 흔들림·번쩍임.
 * 게임 이벤트(logic 좌표)를 받아 화면 픽셀 좌표(절반)로 저장합니다.
 * ========================================================= */

SH.fx = (() => {
  const K = 0.5; // logic → 픽셀
  const MAX = 900;
  const parts = [];
  const state = { shake: 0, flash: 0, flashColor: '#ffffff', shakeOn: true };
  let hitThrottle = 0;
  let gemThrottle = 0;
  const R = Math.random;
  const add = (p) => { if (parts.length < MAX) parts.push(p); return p; };

  /* ---------------- 만들기 ---------------- */
  function anim(name, x, y, fps, delay) {
    const inf = SH.pix.info(name);
    if (!inf) return null;
    return add({ t: 'anim', name, x, y, fps, n: inf.n, age: -(delay || 0), life: inf.n / fps });
  }
  function debris(x, y, n, colors, speed, life) {
    for (let i = 0; i < n; i++) {
      const a = R() * Math.PI * 2, s = speed * (0.35 + R() * 0.8);
      add({ t: 'px', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, age: 0, life: life * (0.6 + R() * 0.7), color: colors[i % colors.length], size: R() < 0.3 ? 2 : 1, drag: 2.6 });
    }
  }
  function ring(x, y, r0, r1, life, color, thick) {
    add({ t: 'ring', x, y, r0, r1, life, age: 0, color, thick: thick || 1 });
  }
  function text(x, y, str, color, scale, life) {
    add({ t: 'text', x, y, x0: x, y0: y, str, color: color || '#ffffff', scale: scale || 1, life: life || 1, age: 0, vy: -22 });
  }
  function explosion(x, y, r, color, big) {
    if (big) {
      anim('boomBig', x, y, 16);
      for (let i = 0; i < 3; i++) anim('boom', x + (R() - 0.5) * r * 1.4, y + (R() - 0.5) * r * 1.4, 18, 0.05 + i * 0.07);
      debris(x, y, 18, [color, '#fff4a8', '#ff8a2a', '#ffffff'], 120, 0.7);
      ring(x, y, 3, r * 2.2, 0.35, '#fff4a8', 1);
    } else {
      anim('boom', x, y, 22);
      debris(x, y, 7, [color, '#fff4a8', '#ffffff'], 80, 0.45);
    }
  }
  /** 떨어져 나가는 쇳조각 (튀어 올랐다가 떨어지며 돔) */
  function chunks(x, y, n) {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (R() - 0.5) * 2.6, s = 50 + R() * 90;
      add({ t: 'chunk', x: x + (R() - 0.5) * 50, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, age: 0, life: 1.4 + R() * 0.6, spin: R() * 4, drag: 0.6 });
    }
  }
  function shake(v) { if (state.shakeOn) state.shake = Math.max(state.shake, v); }
  function flash(a, c) { state.flash = Math.max(state.flash, a); state.flashColor = c || '#ffffff'; }

  /* ---------------- 게임 이벤트 ---------------- */
  function onEvent(type, d) {
    const x = d && d.x != null ? d.x * K : 0, y = d && d.y != null ? d.y * K : 0;
    switch (type) {
      case 'hit':
        if (hitThrottle > 0) return;
        hitThrottle = 0.03;
        anim(d.armor ? 'pop' : 'hitSpark', x, y, 30);
        return;
      case 'partDestroyed':
        explosion(x, y, 14, '#ff8a2a', true);
        for (let i = 0; i < 4; i++) anim('boomBig', x + (R() - 0.5) * 24, y + (R() - 0.5) * 20, 14, i * 0.08);
        text(x, y - 18, '포탑 파괴!', '#ffd84a', 1, 1.4);
        flash(0.3, '#fff4c8');
        shake(6);
        return;
      case 'missileDown':
        anim('boom', x, y, 24);
        debris(x, y, 5, ['#e8384f', '#ffd84a', '#ffffff'], 70, 0.35);
        return;
      case 'laserFire':
        shake(d.big ? 7 : 3);
        return;
      case 'muzzle':
        anim(d.big ? 'boom' : 'hitSpark', x, y, d.big ? 28 : 34);
        return;
      case 'gunDown':
        explosion(x, y, 10, '#c9a8ff', true);
        text(x, y - 14, '파괴!', '#c9a8ff');
        shake(4);
        return;
      case 'partBreak':
        explosion(x, y, 10, '#ff8a2a', true);
        chunks(x, y, 6);
        shake(5);
        return;
      case 'armorFall':
        chunks(x, y + 20, 18);
        flash(0.5, '#fff4c8');
        shake(9);
        return;
      case 'kill':
        explosion(x, y, d.r * K, d.color || '#ffd84a', d.heavy);
        shake(d.heavy ? 3 : 1);
        return;
      case 'bossBoom':
        explosion(x, y, 12, '#ff8a2a', R() < 0.4);
        debris(x, y, 3, ['#5e6e8c', '#8e9ebc'], 90, 0.6);
        shake(2.5);
        return;
      case 'bossDie':
        for (let i = 0; i < 4; i++) ring(x, y, 4, 170, 0.5 + i * 0.2, i % 2 ? '#ffd84a' : '#ffffff', 2);
        explosion(x, y, 34, '#ffd84a', true);
        for (let i = 0; i < 12; i++) anim('boomBig', x + (R() - 0.5) * 120, y + (R() - 0.5) * 60, 14, i * 0.06);
        debris(x, y, 50, ['#ffffff', '#fff4a8', '#ffd84a', '#ff8a2a', '#8e9ebc'], 240, 1.1);
        flash(0.85);
        shake(10);
        return;
      case 'bossDefeated':
        text(x, y + 20, '격파!', '#ffd84a', 2, 2);
        return;
      case 'bossPhase':
        ring(x, y, 8, 120, 0.5, '#ff7aa8', 2);
        flash(0.25, '#ffc4dc');
        shake(4);
        return;
      case 'playerDie':
        explosion(x, y, 14, '#8fd4ff', true);
        ring(x, y, 4, 90, 0.6, '#c4e4ff', 2);
        flash(0.35, '#ff8a8a');
        shake(6);
        return;
      case 'bomb':
        for (let i = 0; i < 3; i++) ring(x, y, 6, 240 + i * 40, 0.7 + i * 0.22, i === 1 ? '#ffd84a' : '#ffffff', 3 - i);
        debris(x, y, 40, ['#ffd84a', '#fff4a8', '#ff8a2a', '#ffffff'], 260, 0.9);
        flash(0.55, '#fff4c8');
        shake(6);
        return;
      case 'shieldBreak':
        ring(x, y, 8, 55, 0.4, '#8fd4ff', 2);
        debris(x, y, 12, ['#e0f7ff', '#8fd4ff'], 120, 0.4);
        text(x, y - 16, '방패 깨짐!', '#8fd4ff');
        shake(3);
        return;
      case 'power': {
        const w = SH.WEAPONS[d.weapon];
        ring(x, y, 4, 30, 0.35, w.light, 1);
        if (d.maxed) text(x, y - 14, '+5000', '#ffd84a');
        else if (d.level >= SH.MAX_POWER) text(x, y - 14, '파워 최대!', w.light);
        else text(x, y - 14, d.changed ? `${WNAME[d.weapon]} ${d.level}단계` : '파워 업!', w.light);
        return;
      }
      case 'item':
        ring(x, y, 4, 26, 0.3, '#ffffff', 1);
        text(x, y - 14, d.kind === 'bomb' ? '폭탄 +1' : '방패!', d.kind === 'bomb' ? '#ffd84a' : '#8fd4ff');
        return;
      case 'extend':
        text(x, y - 16, '비행기 +1', '#ff7aa8', 1, 1.4);
        ring(x, y, 4, 40, 0.5, '#ff7aa8', 2);
        return;
      case 'gem':
        if (gemThrottle > 0 && !d.big) return;
        gemThrottle = 0.06;
        anim('hitSpark', x, y, 30);
        return;
      case 'cancel': {
        const pts = d.pts;
        const step = Math.max(2, Math.floor(pts.length / 120) * 2);
        for (let i = 0; i < pts.length; i += step) anim('pop', pts[i] * K, pts[i + 1] * K, 24, R() * 0.08);
        return;
      }
      case 'split':
        ring(x, y, 2, 12, 0.2, '#ffffff', 1);
        return;
      default:
    }
  }
  const WNAME = { spread: '확산탄', laser: '레이저', homing: '유도탄' };

  /* ---------------- 진행 ---------------- */
  function update(dt) {
    if (hitThrottle > 0) hitThrottle -= dt;
    if (gemThrottle > 0) gemThrottle -= dt;
    state.shake = state.shake > 0.3 ? state.shake * Math.pow(0.015, dt) : 0;
    state.flash = Math.max(0, state.flash - dt * 2);
    let j = 0;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      p.age += dt;
      if (p.age >= p.life) continue;
      if (p.t === 'px' || p.t === 'chunk') {
        const k = Math.max(0, 1 - p.drag * dt);
        p.vx *= k;
        p.vy = p.vy * k + (p.t === 'chunk' ? 160 : 40) * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      } else if (p.t === 'text') p.y += p.vy * dt * (p.age < 0.4 ? 1 : 0.2);
      parts[j++] = p;
    }
    parts.length = j;
  }

  /** 픽셀 원 (중점 원 알고리즘) */
  function pixelCircle(ctx, cx, cy, r, color, thick) {
    ctx.fillStyle = color;
    cx = Math.round(cx); cy = Math.round(cy);
    for (let t = 0; t < thick; t++) {
      const rr = Math.round(r) - t;
      if (rr <= 0) break;
      let x = rr, y = 0, err = 1 - rr;
      while (x >= y) {
        ctx.fillRect(cx + x, cy + y, 1, 1); ctx.fillRect(cx + y, cy + x, 1, 1);
        ctx.fillRect(cx - y, cy + x, 1, 1); ctx.fillRect(cx - x, cy + y, 1, 1);
        ctx.fillRect(cx - x, cy - y, 1, 1); ctx.fillRect(cx - y, cy - x, 1, 1);
        ctx.fillRect(cx + y, cy - x, 1, 1); ctx.fillRect(cx + x, cy - y, 1, 1);
        y++;
        if (err < 0) err += 2 * y + 1;
        else { x--; err += 2 * (y - x) + 1; }
      }
    }
  }

  function draw(ctx) {
    for (const p of parts) {
      if (p.age < 0) continue;
      const u = p.age / p.life;
      if (p.t === 'anim') {
        SH.pix.draw(ctx, p.name, p.x, p.y, { frame: Math.min(p.n - 1, Math.floor(p.age * p.fps)) });
      } else if (p.t === 'chunk') {
        if (u > 0.8 && (Math.floor(p.age * 30) & 1)) continue;
        SH.pix.draw(ctx, 'scrap', p.x, p.y, { frame: Math.floor(p.age * 10 + p.spin) });
      } else if (p.t === 'px') {
        if (u > 0.7 && (Math.floor(p.age * 30) & 1)) continue; // 꺼질 때 깜빡
        ctx.fillStyle = p.color;
        ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
      } else if (p.t === 'ring') {
        const r = p.r0 + (p.r1 - p.r0) * (1 - (1 - u) * (1 - u));
        if (u > 0.75 && (Math.floor(p.age * 30) & 1)) continue;
        pixelCircle(ctx, p.x, p.y, r, p.color, p.thick);
      }
    }
  }

  /** 떠오르는 글자는 화면(가로)에 똑바로. map: 세계 픽셀 → 화면 픽셀 */
  function drawText(ctx, map) {
    for (const p of parts) {
      if (p.t !== 'text' || p.age < 0) continue;
      const u = p.age / p.life;
      if (u > 0.75 && (Math.floor(p.age * 20) & 1)) continue;
      // 세계에서 위로 떠오르던 값(vy)을 화면에서도 위로: 처음 위치에서 떠오른 만큼 화면 y 를 줄임
      const [X, Y] = map(p.x0 != null ? p.x0 : p.x, p.y0 != null ? p.y0 : p.y);
      const rise = p.y0 != null ? p.y0 - p.y : 0;
      SH.pix.text(ctx, p.str, X, Y - rise, { color: p.color, align: 'center', scale: p.scale });
    }
  }

  function clear() {
    parts.length = 0;
    state.shake = 0;
    state.flash = 0;
  }

  return { onEvent, update, draw, drawText, text, ring, anim, debris, chunks, pixelCircle, state, clear, WNAME };
})();
