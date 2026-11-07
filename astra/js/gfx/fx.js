'use strict';

/* =========================================================
 * 전투 연출 — 전투 월드의 이벤트(W.events)를 받아
 * 파티클, 베기 궤적, 충격파, 광선, 떠오르는 숫자, 배너, 컷인, 전투 대사를 그립니다.
 * ========================================================= */
window.AZ = window.AZ || {};
AZ.gfx = AZ.gfx || {};

AZ.gfx.fx = (() => {
  const U = AZ.util;
  const YS = 0.62;
  let S = null;
  let settings = { shake: true, flashes: true, damageNumbers: true };
  const imgCache = {};

  function reset() {
    S = {
      parts: [], texts: [], slashes: [], rings: [], beams: [], trails: [], bursts: [], muzzles: [], scans: [],
      banner: null, bannerQ: [], cutin: null, bark: null, barkT: 0, flash: null, shake: 0,
      glitch: 0, freeze: 0, skillName: null, bossDown: null, lastBark: {},
    };
  }
  reset();

  function setSettings(s) { settings = Object.assign(settings, s || {}); }

  function img(key) {
    if (typeof Image === 'undefined') return null;
    if (imgCache[key]) return imgCache[key];
    const src = AZ.data.assets && AZ.data.assets[key];
    if (!src) return null;
    const im = new Image();
    im.src = src;
    imgCache[key] = im;
    return im;
  }

  /* ───────────── 이벤트 소비 ───────────── */
  function consume(W) {
    const evs = W.events;
    for (let i = 0; i < evs.length; i++) handle(W, evs[i]);
    evs.length = 0;
  }

  function spawnSparks(x, y, z, color, n, big) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * U.TAU;
      const sp = (big ? 260 : 170) * (0.4 + Math.random());
      S.parts.push({ x, y, z: z + U.rand(-6, 6), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: U.rand(60, 260),
        life: U.rand(0.25, 0.5), t: 0, color, size: big ? U.rand(2.5, 4.5) : U.rand(1.5, 3), kind: 'spark' });
    }
    if (S.parts.length > 700) S.parts.splice(0, S.parts.length - 700);
  }

  function handle(W, e) {
    switch (e.type) {
      case 'sfx':
        if (AZ.audio) AZ.audio.sfx(e.name, e.opts);
        break;
      case 'shake':
        if (settings.shake) S.shake = Math.min(26, Math.max(S.shake, e.amt));
        break;
      case 'text':
        if (!settings.damageNumbers && /^\d+$/.test(e.str) && !e.hurt) break;
        S.texts.push(Object.assign({ t: 0, life: e.crit ? 1.0 : 0.8, vy: -60, z: 0 }, e));
        if (S.texts.length > 70) S.texts.splice(0, S.texts.length - 70);
        break;
      case 'spark':
        spawnSparks(e.x, e.y, e.z != null ? e.z : 24, e.color, e.n || 8, e.big);
        break;
      case 'slash':
        S.slashes.push(Object.assign({ t: 0, life: e.heavy ? 0.26 : 0.18 }, e));
        break;
      case 'ring':
        S.rings.push(Object.assign({ t: 0, life: e.t || 0.4 }, e));
        break;
      case 'burst':
        S.bursts.push(Object.assign({ t: 0, life: e.big ? 0.8 : 0.45 }, e));
        spawnSparks(e.x, e.y, e.z != null ? e.z : 24, e.color, e.big ? 40 : 16, true);
        for (let i = 0; i < (e.big ? 14 : 6); i++) {
          const a = Math.random() * U.TAU;
          const sp = U.rand(30, 120);
          S.parts.push({ x: e.x, y: e.y, z: e.z != null ? e.z : 24, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: U.rand(10, 60),
            life: U.rand(0.6, 1.2), t: 0, color: 'rgba(120,130,160,0.5)', size: U.rand(10, 24) * (e.big ? 1.6 : 1), kind: 'smoke' });
        }
        break;
      case 'beam':
        S.beams.push(Object.assign({ t: 0, life: e.t || 0.3 }, e));
        break;
      case 'trail':
        S.trails.push(Object.assign({ t: 0, life: 0.35 }, e));
        break;
      case 'muzzle':
        S.muzzles.push(Object.assign({ t: 0, life: 0.08 }, e));
        break;
      case 'scan':
        S.scans.push({ x: e.x, y: e.y, t: 0, life: 0.9 });
        break;
      case 'banner':
        if (e.kind === 'zero' || e.kind === 'break' || e.kind === 'phase') S.banner = Object.assign({ t: 0, life: 1.5 }, e);
        else if (S.banner && S.banner.t < 0.6) S.bannerQ.push(Object.assign({ t: 0, life: 1.4 }, e));
        else S.banner = Object.assign({ t: 0, life: 1.4 }, e);
        if (S.bannerQ.length > 3) S.bannerQ.shift();
        break;
      case 'cutin':
        S.cutin = Object.assign({ t: 0, life: 1.25 }, e);
        break;
      case 'bark':
        doBark(W, e.group, e.key);
        break;
      case 'flash':
        if (settings.flashes) S.flash = { color: e.color, t: 0, life: e.t || 0.2 };
        break;
      case 'glitch':
        S.glitch = Math.max(S.glitch, e.t || 0.5);
        break;
      case 'astraFreeze':
        S.freeze = e.t;
        break;
      case 'skillName':
        S.skillName = { name: e.name, t: 0, life: 0.9 };
        break;
      case 'bossDown':
        S.bossDown = { name: e.name, t: 0, life: 2.6 };
        break;
      case 'hazardHit': {
        const h = e.h;
        const v = h.visual;
        if (h.shape === 'circle' && h.r > 50) {
          const big = ['meteor', 'fist', 'missile', 'fireball', 'star', 'debris'].includes(v);
          if (big || Math.random() < 0.5) {
            S.bursts.push({ x: h.x, y: h.y, r: h.r * 1.1, color: hazardColor(h), t: 0, life: 0.4, ground: true });
            spawnSparks(h.x, h.y, 10, hazardColor(h), big ? 14 : 6, true);
          }
        } else if (h.shape === 'all') {
          S.flash = settings.flashes ? { color: 'rgba(255,255,255,0.6)', t: 0, life: 0.5 } : null;
        }
        break;
      }
      default:
        break;
    }
  }

  function hazardColor(h) {
    const v = h.visual;
    if (v === 'fire' || v === 'fireball' || v === 'missile' || v === 'meteor') return '#ff8a3d';
    if (v === 'red' || v === 'afterimage') return '#ff3355';
    if (v === 'star' || v === 'halo' || v === 'wave' || v === 'finale') return '#bfe6ff';
    if (v === 'code' || v === 'firewall' || v === 'hex' || v === 'echo') return '#66e0ff';
    if (v === 'gravity' || v === 'buster' || v === 'orbitalLine') return '#c06bff';
    if (v === 'pillar' || v === 'distort') return '#ff7ad9';
    return '#ff4d6d';
  }

  /* 전투 대사 */
  function doBark(W, group, key) {
    const story = AZ.data.story;
    if (!story || !story.battle || !story.battle[group]) return;
    const list = story.battle[group][key];
    if (!list || !list.length) return;
    const hasLia = W.allies.some((a) => a.ally === 'lia');
    const hasZero = W.allies.some((a) => a.ally === 'zero');
    const pool = list.filter((b) => (b.who !== 'lia' || hasLia) && (b.who !== 'zero' || group !== 'zeroAlly' || hasZero));
    if (!pool.length) return;
    const now = W.t;
    const important = key === 'start' || key === 'defeat' || key === 'phase2';
    if (!important && S.bark && S.bark.t < 2.2) return;
    if (!important && S.lastBark[group + key] && now - S.lastBark[group + key] < 8) return;
    S.lastBark[group + key] = now;
    const b = U.pick(pool);
    S.bark = { who: b.who, text: b.text, t: 0, life: Math.max(2.6, b.text.length * 0.09 + 1.4) };
  }

  /* ───────────── 갱신 ───────────── */
  function update(dt) {
    const step = (arr) => {
      for (const o of arr) o.t += dt;
      for (let i = arr.length - 1; i >= 0; i--) if (arr[i].t >= arr[i].life) arr.splice(i, 1);
    };
    for (const p of S.parts) {
      p.t += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      if (p.kind === 'spark') {
        p.vz -= 700 * dt;
        p.vx *= Math.pow(0.1, dt);
        p.vy *= Math.pow(0.1, dt);
        if (p.z < 0) { p.z = 0; p.vz *= -0.3; }
      } else {
        p.vx *= Math.pow(0.3, dt);
        p.vy *= Math.pow(0.3, dt);
      }
    }
    for (let i = S.parts.length - 1; i >= 0; i--) if (S.parts[i].t >= S.parts[i].life) S.parts.splice(i, 1);
    for (const t of S.texts) { t.t += dt; t.z += -t.vy * dt * (1 - t.t / t.life); }
    for (let i = S.texts.length - 1; i >= 0; i--) if (S.texts[i].t >= S.texts[i].life) S.texts.splice(i, 1);
    step(S.slashes); step(S.rings); step(S.beams); step(S.trails); step(S.bursts); step(S.muzzles); step(S.scans);
    if (S.banner) {
      S.banner.t += dt;
      if (S.banner.t >= S.banner.life) S.banner = S.bannerQ.shift() || null;
    }
    if (S.cutin) { S.cutin.t += dt; if (S.cutin.t >= S.cutin.life) S.cutin = null; }
    if (S.bark) { S.bark.t += dt; if (S.bark.t >= S.bark.life) S.bark = null; }
    if (S.flash) { S.flash.t += dt; if (S.flash.t >= S.flash.life) S.flash = null; }
    if (S.skillName) { S.skillName.t += dt; if (S.skillName.t >= S.skillName.life) S.skillName = null; }
    if (S.bossDown) { S.bossDown.t += dt; if (S.bossDown.t >= S.bossDown.life) S.bossDown = null; }
    S.shake = Math.max(0, S.shake - dt * 40);
    S.glitch = Math.max(0, S.glitch - dt);
    S.freeze = Math.max(0, S.freeze - dt);
  }

  function shakeOffset() {
    if (S.shake <= 0) return { x: 0, y: 0 };
    return { x: (Math.random() * 2 - 1) * S.shake, y: (Math.random() * 2 - 1) * S.shake * 0.7 };
  }

  /* ───────────── 월드 좌표 연출 (카메라 변환이 걸린 상태) ─────────────
   * proj(x, y, z) → 화면 좌표. zoom: 카메라 배율 */
  function drawWorldBelow(g, proj, zoom) {
    // 바닥에 닿는 것: 충격파, 지면 폭발
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (const r of S.rings) {
      const k = r.t / r.life;
      const rad = U.lerp(r.r0, r.r1, U.ease.outCubic(k)) * zoom;
      const c = proj(r.x, r.y, 0);
      g.save();
      g.translate(c.x, c.y);
      g.scale(1, YS);
      g.globalAlpha = (1 - k) * 0.9;
      g.strokeStyle = r.color;
      g.lineWidth = (r.thick ? 14 : 6) * (1 - k * 0.6) * zoom;
      g.beginPath();
      g.arc(0, 0, Math.max(1, rad), 0, U.TAU);
      g.stroke();
      g.globalAlpha = (1 - k) * 0.25;
      g.fillStyle = r.color;
      g.fill();
      g.restore();
    }
    for (const b of S.bursts) {
      if (!b.ground) continue;
      const k = b.t / b.life;
      const c = proj(b.x, b.y, 0);
      g.save();
      g.translate(c.x, c.y);
      g.scale(1, YS);
      const grd = g.createRadialGradient(0, 0, 0, 0, 0, b.r * zoom);
      grd.addColorStop(0, `rgba(255,255,255,${0.7 * (1 - k)})`);
      grd.addColorStop(0.4, colorA(b.color, 0.5 * (1 - k)));
      grd.addColorStop(1, colorA(b.color, 0));
      g.fillStyle = grd;
      g.beginPath();
      g.arc(0, 0, b.r * zoom * (0.6 + k * 0.5), 0, U.TAU);
      g.fill();
      g.restore();
    }
    for (const s of S.scans) {
      const k = s.t / s.life;
      const c = proj(s.x, s.y, 0);
      g.save();
      g.translate(c.x, c.y);
      g.scale(1, YS);
      g.globalAlpha = 1 - k;
      g.strokeStyle = '#7cf7ff';
      g.lineWidth = 3;
      g.beginPath();
      g.arc(0, 0, k * 900 * zoom, 0, U.TAU);
      g.stroke();
      g.restore();
    }
    g.restore();
  }

  function drawWorldAbove(g, proj, zoom) {
    g.save();
    g.globalCompositeOperation = 'lighter';
    // 잔상 궤적
    for (const tr of S.trails) {
      const k = tr.t / tr.life;
      const a = proj(tr.x0, tr.y0, 26);
      const b = proj(tr.x1, tr.y1, 26);
      g.globalAlpha = (1 - k) * 0.85;
      g.strokeStyle = tr.color;
      g.lineCap = 'round';
      g.lineWidth = 18 * (1 - k) * zoom;
      g.beginPath();
      g.moveTo(a.x, a.y);
      g.lineTo(b.x, b.y);
      g.stroke();
      g.lineWidth = 5 * (1 - k) * zoom;
      g.strokeStyle = '#ffffff';
      g.stroke();
    }
    // 광선
    for (const bm of S.beams) {
      const k = bm.t / bm.life;
      const a = proj(bm.x, bm.y, 26);
      const ex = bm.x + Math.cos(bm.ang) * bm.len;
      const ey = bm.y + Math.sin(bm.ang) * bm.len;
      const b = proj(ex, ey, 26);
      const w = bm.w * zoom * (1 - k * 0.7);
      g.globalAlpha = 1 - k;
      g.lineCap = 'round';
      g.strokeStyle = colorA(bm.color, 0.45);
      g.lineWidth = w * 1.8;
      g.beginPath();
      g.moveTo(a.x, a.y);
      g.lineTo(b.x, b.y);
      g.stroke();
      g.strokeStyle = bm.color;
      g.lineWidth = w;
      g.stroke();
      g.strokeStyle = '#ffffff';
      g.lineWidth = w * 0.35;
      g.stroke();
    }
    // 베기 궤적
    for (const s of S.slashes) drawSlash(g, s, proj, zoom);
    // 공중 폭발
    for (const b of S.bursts) {
      if (b.ground) continue;
      const k = b.t / b.life;
      const c = proj(b.x, b.y, b.z != null ? b.z : 24);
      const r = b.r * zoom * (0.4 + U.ease.outCubic(k) * 0.8);
      const grd = g.createRadialGradient(c.x, c.y, 0, c.x, c.y, r);
      grd.addColorStop(0, `rgba(255,255,255,${0.95 * (1 - k)})`);
      grd.addColorStop(0.35, colorA(b.color, 0.75 * (1 - k)));
      grd.addColorStop(1, colorA(b.color, 0));
      g.globalAlpha = 1;
      g.fillStyle = grd;
      g.beginPath();
      g.arc(c.x, c.y, r, 0, U.TAU);
      g.fill();
      if (b.big) {
        g.strokeStyle = colorA(b.color, 0.8 * (1 - k));
        g.lineWidth = 4 * zoom;
        g.beginPath();
        g.ellipse(c.x, c.y + 20, r * 1.3, r * 1.3 * YS, 0, 0, U.TAU);
        g.stroke();
      }
    }
    for (const m of S.muzzles) {
      const c = proj(m.x, m.y, 28);
      const k = m.t / m.life;
      g.globalAlpha = 1 - k;
      const grd = g.createRadialGradient(c.x, c.y, 0, c.x, c.y, 26 * zoom);
      grd.addColorStop(0, '#ffffff');
      grd.addColorStop(1, colorA(m.color, 0));
      g.fillStyle = grd;
      g.beginPath();
      g.arc(c.x, c.y, 26 * zoom, 0, U.TAU);
      g.fill();
    }
    // 파티클
    for (const p of S.parts) {
      const k = p.t / p.life;
      const c = proj(p.x, p.y, p.z);
      if (p.kind === 'smoke') {
        g.globalCompositeOperation = 'source-over';
        g.globalAlpha = (1 - k) * 0.35;
        g.fillStyle = p.color;
        g.beginPath();
        g.arc(c.x, c.y, p.size * (0.6 + k) * zoom, 0, U.TAU);
        g.fill();
        g.globalCompositeOperation = 'lighter';
      } else {
        g.globalAlpha = 1 - k;
        g.fillStyle = p.color;
        const sz = p.size * zoom;
        g.fillRect(c.x - sz / 2, c.y - sz / 2, sz, sz);
        g.globalAlpha = (1 - k) * 0.4;
        g.fillRect(c.x - sz, c.y - sz, sz * 2, sz * 2);
      }
    }
    g.restore();

    // 떠오르는 글자
    g.save();
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (const t of S.texts) {
      const k = t.t / t.life;
      const c = proj(t.x, t.y, t.z);
      const pop = t.t < 0.1 ? 1 + (1 - t.t / 0.1) * 0.6 : 1;
      const size = t.size * pop * Math.min(1.2, Math.max(0.8, zoom));
      g.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
      g.font = `${t.crit || t.tag ? '900 italic' : '800'} ${size}px "Pretendard","Noto Sans KR","Apple SD Gothic Neo","Malgun Gothic",sans-serif`;
      g.lineWidth = 4;
      g.strokeStyle = 'rgba(5,8,20,0.85)';
      g.strokeText(t.str, c.x, c.y);
      g.fillStyle = t.color;
      g.fillText(t.str, c.x, c.y);
    }
    g.restore();
  }

  function drawSlash(g, s, proj, zoom) {
    const k = s.t / s.life;
    const c = proj(s.x, s.y, 28);
    const range = s.range * zoom;
    g.save();
    g.translate(c.x, c.y);
    g.scale(1, YS);
    g.globalAlpha = 1 - k * k;
    const color = s.color || '#9ae6ff';
    if (s.fx === 'thrust') {
      g.rotate(s.ang);
      const len = range * (0.6 + 0.4 * U.ease.outCubic(Math.min(1, k * 3)));
      const grd = g.createLinearGradient(0, 0, len, 0);
      grd.addColorStop(0, colorA(color, 0));
      grd.addColorStop(0.7, colorA(color, 0.9));
      grd.addColorStop(1, '#ffffff');
      g.fillStyle = grd;
      g.beginPath();
      g.moveTo(10, -14 * zoom);
      g.lineTo(len, 0);
      g.lineTo(10, 14 * zoom);
      g.closePath();
      g.fill();
      g.restore();
      return;
    }
    const full = s.arc >= 6.2 || s.fx === 'spin';
    const arc = full ? U.TAU : Math.min(U.TAU, s.arc * 1.1);
    const dir = s.fx === 'slashL' ? -1 : 1;
    const sweep = U.ease.outCubic(Math.min(1, k * 2.6));
    const a0 = s.ang - (arc / 2) * dir;
    const a1 = a0 + arc * sweep * dir;
    const inner = range * (s.heavy ? 0.45 : 0.6);
    const thick = range - inner;
    const draw = (start, end, d) => {
      g.beginPath();
      g.arc(0, 0, range, start, end, d < 0);
      g.arc(0, 0, inner + thick * 0.55 * (1 - k), end, start, d > 0);
      g.closePath();
    };
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = colorA(color, 0.55);
    draw(a0, a1, dir);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.85)';
    g.beginPath();
    g.arc(0, 0, range, a0, a1, dir < 0);
    g.arc(0, 0, range - 5 * zoom, a1, a0, dir > 0);
    g.closePath();
    g.fill();
    if (s.fx === 'cross') {
      g.rotate(Math.PI / 2);
      g.fillStyle = colorA(color, 0.45);
      draw(a0, a1, -dir);
      g.fill();
    }
    if (s.fx === 'smash' && k < 0.6) {
      g.strokeStyle = colorA(color, 0.7 * (1 - k));
      g.lineWidth = 6 * zoom;
      g.beginPath();
      g.arc(Math.cos(s.ang) * range * 0.6, Math.sin(s.ang) * range * 0.6, range * 0.5 * (0.5 + k), 0, U.TAU);
      g.stroke();
    }
    g.restore();
  }

  /* ───────────── 화면 좌표 연출 ───────────── */
  const FONT = '"Pretendard","Noto Sans KR","Apple SD Gothic Neo","Malgun Gothic",sans-serif';

  function drawScreen(g, W, VW, VH) {
    // 번쩍임
    if (S.flash) {
      const k = S.flash.t / S.flash.life;
      g.save();
      g.globalAlpha = 1 - k;
      g.fillStyle = S.flash.color;
      g.fillRect(0, 0, VW, VH);
      g.restore();
    }
    if (S.banner) drawBanner(g, S.banner, VW, VH);
    if (S.cutin) drawCutin(g, S.cutin, VW, VH);
    if (S.bark) drawBark(g, S.bark, VW);
    if (S.skillName) {
      const k = S.skillName.t / S.skillName.life;
      g.save();
      g.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
      g.font = `800 20px ${FONT}`;
      g.textAlign = 'right';
      g.fillStyle = '#e8f4ff';
      g.strokeStyle = 'rgba(0,0,0,0.6)';
      g.lineWidth = 4;
      g.strokeText(S.skillName.name, VW - 40, VH - 250 - k * 10);
      g.fillText(S.skillName.name, VW - 40, VH - 250 - k * 10);
      g.restore();
    }
    if (S.bossDown) {
      const k = S.bossDown.t / S.bossDown.life;
      g.save();
      g.globalAlpha = k < 0.15 ? k / 0.15 : k > 0.8 ? (1 - k) / 0.2 : 1;
      g.textAlign = 'center';
      g.fillStyle = 'rgba(0,0,0,0.45)';
      g.fillRect(0, VH / 2 - 60, VW, 120);
      g.font = `900 italic 58px ${FONT}`;
      const grd = g.createLinearGradient(0, VH / 2 - 30, 0, VH / 2 + 20);
      grd.addColorStop(0, '#ffffff');
      grd.addColorStop(1, '#9ad8ff');
      g.fillStyle = grd;
      g.fillText('TARGET DOWN', VW / 2, VH / 2 + 4);
      g.font = `700 18px ${FONT}`;
      g.fillStyle = '#cfe6ff';
      g.fillText(`${S.bossDown.name} 격파`, VW / 2, VH / 2 + 38);
      g.restore();
    }
  }

  const BANNER_STYLE = {
    zero: { c1: '#ffffff', c2: '#7ce8ff', bar: 'rgba(40,140,220,0.35)', size: 64 },
    break: { c1: '#fff7c0', c2: '#ffb33d', bar: 'rgba(220,160,40,0.3)', size: 68 },
    phase: { c1: '#ffffff', c2: '#ff4d6d', bar: 'rgba(200,30,60,0.3)', size: 52 },
    warn: { c1: '#ffffff', c2: '#ff6b7a', bar: 'rgba(160,20,40,0.42)', size: 34 },
    chance: { c1: '#ffffff', c2: '#7cf7d4', bar: 'rgba(20,140,120,0.35)', size: 34 },
    wave: { c1: '#ffffff', c2: '#9ab8ff', bar: 'rgba(40,60,140,0.35)', size: 40 },
    start: { c1: '#ffffff', c2: '#9ad8ff', bar: 'rgba(40,80,160,0.35)', size: 48 },
    info: { c1: '#ffffff', c2: '#9ad8ff', bar: 'rgba(40,80,160,0.35)', size: 40 },
    memory: { c1: '#ffffff', c2: '#e2d4ff', bar: 'rgba(120,90,200,0.35)', size: 38 },
    cmd: { c1: '#ffffff', c2: '#7ce8ff', bar: 'rgba(30,110,160,0.32)', size: 28 },
    skill: { c1: '#ffffff', c2: '#c9a4ff', bar: 'rgba(90,60,160,0.3)', size: 30 },
  };

  function drawBanner(g, b, VW, VH) {
    const st = BANNER_STYLE[b.kind] || BANNER_STYLE.info;
    const k = b.t / b.life;
    const inK = Math.min(1, b.t / 0.18);
    const outK = k > 0.75 ? (1 - k) / 0.25 : 1;
    const small = st.size < 40;
    const cy = small ? 168 : VH * 0.36;
    g.save();
    g.globalAlpha = outK;
    const barH = small ? 54 : st.size + 44;
    const w = VW * U.ease.outCubic(inK);
    g.fillStyle = st.bar;
    g.fillRect(VW / 2 - w / 2, cy - barH / 2, w, barH);
    g.fillStyle = st.c2;
    g.globalAlpha = outK * 0.8;
    g.fillRect(VW / 2 - w / 2, cy - barH / 2, w, 2);
    g.fillRect(VW / 2 - w / 2, cy + barH / 2 - 2, w, 2);
    g.globalAlpha = outK;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const slide = (1 - U.ease.outBack(inK)) * 60;
    g.font = `900 italic ${st.size}px ${FONT}`;
    const grd = g.createLinearGradient(0, cy - st.size / 2, 0, cy + st.size / 2);
    grd.addColorStop(0, st.c1);
    grd.addColorStop(1, st.c2);
    g.lineWidth = 6;
    g.strokeStyle = 'rgba(0,0,0,0.5)';
    const ty = cy - (b.sub ? (small ? 6 : 10) : 0);
    g.strokeText(b.text, VW / 2 + slide, ty);
    g.fillStyle = grd;
    g.fillText(b.text, VW / 2 + slide, ty);
    if (b.sub) {
      g.font = `700 ${small ? 14 : 18}px ${FONT}`;
      g.fillStyle = '#e8f4ff';
      g.fillText(b.sub, VW / 2 - slide * 0.5, cy + (small ? 16 : st.size / 2 + 6));
    }
    if (b.kind === 'zero') {
      // 시계 문양
      g.globalCompositeOperation = 'lighter';
      g.strokeStyle = 'rgba(124,232,255,0.5)';
      g.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        g.beginPath();
        g.arc(VW / 2, cy - 4, 120 + i * 40 + k * 60, 0, U.TAU);
        g.stroke();
      }
    }
    g.restore();
  }

  function drawCutin(g, c, VW, VH) {
    const k = c.t / c.life;
    const inK = U.ease.outCubic(Math.min(1, c.t / 0.2));
    const outK = k > 0.8 ? (1 - k) / 0.2 : 1;
    g.save();
    g.globalAlpha = outK;
    const cy = VH * 0.5;
    const h = 170;
    // 기울어진 띠
    g.translate(0, cy);
    g.transform(1, -0.08, 0, 1, 0, 0);
    g.fillStyle = 'rgba(4,10,30,0.82)';
    g.fillRect(-20, -h / 2, VW * inK + 40, h);
    const accent = c.who === 'zero' ? '#ff3355' : c.who === 'lia' ? '#7ce8ff' : '#ffe066';
    g.fillStyle = accent;
    g.fillRect(-20, -h / 2, VW * inK + 40, 4);
    g.fillRect(-20, h / 2 - 4, VW * inK + 40, 4);
    // 속도선
    g.globalAlpha = outK * 0.35;
    g.strokeStyle = accent;
    for (let i = 0; i < 14; i++) {
      const y = -h / 2 + ((i * 37 + c.t * 900) % h);
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(VW, y);
      g.stroke();
    }
    g.globalAlpha = outK;
    // 초상화
    const drawPortrait = (key, x) => {
      const im = img(key);
      if (im && im.complete && im.naturalWidth) {
        const ph = h - 8;
        const pw = ph * (im.naturalWidth / im.naturalHeight);
        g.save();
        g.beginPath();
        g.rect(x, -h / 2 + 4, pw, h - 8);
        g.clip();
        g.drawImage(im, x, -h / 2 + 4, pw, ph);
        g.restore();
        return pw;
      }
      return 0;
    };
    const px = VW * 0.08 + (1 - inK) * -300;
    let pw = drawPortrait(c.who, px);
    if (c.who2) pw += drawPortrait(c.who2, px + pw + 6) + 6;
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.font = `900 italic 54px ${FONT}`;
    g.fillStyle = '#ffffff';
    g.fillText(c.title, px + pw + 40 + (1 - inK) * 200, -16);
    g.font = `800 20px ${FONT}`;
    g.fillStyle = accent;
    g.fillText(c.sub, px + pw + 44 + (1 - inK) * 260, 34);
    g.restore();
  }

  const NAMES = { kai: '카이온', lia: '리아', zero: '제로', astra: 'ASTRA', sera: '세라', protocol: '프로토콜', system: 'SYSTEM', narr: '' };
  const PORTRAIT_KEY = { kai: 'kai', lia: 'lia', zero: 'zero', astra: 'astra', sera: 'boss_sera', protocol: 'boss_protocol' };

  function drawBark(g, b, VW) {
    const k = b.t / b.life;
    const a = b.t < 0.2 ? b.t / 0.2 : k > 0.85 ? (1 - k) / 0.15 : 1;
    g.save();
    g.globalAlpha = a;
    g.font = `700 17px ${FONT}`;
    const tw = g.measureText(b.text).width;
    const w = Math.min(VW - 200, tw + 110);
    const x = VW / 2 - w / 2;
    const y = 92;
    g.fillStyle = 'rgba(5,10,26,0.72)';
    roundRect(g, x, y, w, 46, 10);
    g.fill();
    const accent = b.who === 'zero' ? '#ff3355' : b.who === 'system' ? '#ff6b7a' : b.who === 'lia' ? '#7ce8ff' : '#c9d8ff';
    g.fillStyle = accent;
    g.fillRect(x, y + 8, 3, 30);
    const key = PORTRAIT_KEY[b.who];
    const im = key ? img(key) : null;
    let tx = x + 16;
    if (im && im.complete && im.naturalWidth) {
      g.save();
      g.beginPath();
      g.arc(x + 32, y + 23, 18, 0, U.TAU);
      g.clip();
      const s = 36 / Math.min(im.naturalWidth, im.naturalHeight);
      g.drawImage(im, x + 32 - (im.naturalWidth * s) / 2, y + 23 - (im.naturalHeight * s) / 2.6, im.naturalWidth * s, im.naturalHeight * s);
      g.restore();
      g.strokeStyle = accent;
      g.lineWidth = 2;
      g.beginPath();
      g.arc(x + 32, y + 23, 18, 0, U.TAU);
      g.stroke();
      tx = x + 60;
    }
    g.textBaseline = 'middle';
    g.textAlign = 'left';
    g.font = `800 13px ${FONT}`;
    g.fillStyle = accent;
    g.fillText(NAMES[b.who] || '', tx, y + 14);
    g.font = `700 16px ${FONT}`;
    g.fillStyle = '#eef6ff';
    g.fillText(b.text, tx, y + 32);
    g.restore();
  }

  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  /** '#rrggbb' → rgba 문자열 */
  const colorCache = {};
  function colorA(hex, a) {
    if (!hex || hex[0] !== '#') return hex;
    let c = colorCache[hex];
    if (!c) {
      const n = parseInt(hex.slice(1), 16);
      c = colorCache[hex] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    return `rgba(${c[0]},${c[1]},${c[2]},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
  }

  return {
    reset, consume, update, drawWorldBelow, drawWorldAbove, drawScreen, shakeOffset, setSettings,
    colorA, roundRect, img, hazardColor, NAMES, PORTRAIT_KEY, FONT,
    get state() { return S; },
  };
})();
