'use strict';

/*
 * 지상 장면: 지점·시대에 맞는 생명체·무생명체를 골라 땅 위에 배치하고, 움직이고, 화면에 그립니다.
 */
(function () {
  const EC = (window.EC = window.EC || {});
  EC.field = EC.field || {};
  const U = EC.util;
  const F = EC.field;

  /* 지점 정보 + 시대 상태 → 장면 조건 */
  function makeEnv(info, bio, st, look, run, t, P, sun, moon) {
    const S = EC.sim.S;
    const lastT = (id) => EC.look.lastEventT(run, id, t);
    let resetT = -1e9;
    for (const id of ['complexWiped', 'sterilized', 'complexEnd', 'lifeEnd']) {
      const x = lastT(id);
      if (x !== null) resetT = Math.max(resetT, x);
    }
    const after = (id) => {
      const x = lastT(id);
      return x !== null && x > resetT ? x : null;
    };
    const tDino = after('dinosaurs');
    const tMam = after('dynMammal');
    const under = bio.habitat === 'sea';
    const coast = P.uCoast > 0.5;
    const civModern = !!(st.civ && st.civT !== undefined && t >= st.civT + 0.0117);
    return {
      t,
      E: st.alive ? st.E : null,
      S,
      alive: st.alive,
      stage: st.stage,
      dynasty: st.dynasty,
      humans: st.humans,
      civ: st.civ,
      civModern,
      habitat: under ? 'sea' : bio.habitat === 'lava' ? 'lava' : 'land',
      under,
      biome: bio.id,
      biomeName: bio.name,
      mountain: !!bio.mountain,
      coast,
      T: info.tempLocal,
      tropical: info.tempLocal > 21,
      moist: info.moist,
      wet: info.moist > 0.42 || coast,
      plants: st.alive && st.stage >= S.landPlants && (look.uVeg || 0) > 0.05,
      forests: st.alive && st.stage >= S.forests && (look.uVeg || 0) > 0.2,
      dinos: st.dynasty === 'archosaur' && tDino !== null,
      dinoAge: tDino !== null ? t - tDino : -1,
      birds: after('birds') !== null,
      mammalsOrigin: after('mammalsOrigin') !== null,
      mammalAge: st.dynasty === 'mammal' && tMam !== null ? t - tMam : -1,
      snow: st.snow,
      ice: bio.id === 'ice',
      lava: bio.habitat === 'lava',
      oxid: U.smoothstep(0.2, 3, st.O2),
      depth: P.uDepth,
      depthOK: under ? P.uDepth < 60 : true,
      night: U.smoothstep(0.08, -0.12, sun[1]),
      sunUp: sun[1] > 0,
      moon: st.moonKm > 0 && moon[1] > 0,
      cloud: look.uCloud,
    };
  }

  function available(env) {
    return F.SPECIES.filter((sp) => {
      try { return sp.when(env); } catch (e) { return false; }
    });
  }

  function signature(env) {
    return available(env).map((s) => s.id).join(',') + '|' + env.habitat + env.biome + (env.coast ? 'c' : '');
  }

  function place(sp, env, P, rng, focusYaw) {
    const hab = sp.habitat;
    const inView = focusYaw !== undefined && rng() < 0.55;
    for (let tries = 0; tries < 24; tries++) {
      const r = U.lerp(sp.dist[0], sp.dist[1], Math.pow(rng(), 1.5));
      const a = inView ? focusYaw + (rng() - 0.5) * 1.3 : rng() * Math.PI * 2;
      const x = Math.sin(a) * r;
      const z = Math.cos(a) * r;
      const h = F.heightAt(P, x, z, r);
      if (hab.includes('coast')) {
        if (h < -2) return { x, y: 0, z, r };
        continue;
      }
      if (env.under) {
        if (!hab.includes('sea')) return null;
        const alt = sp.alt ? U.lerp(sp.alt[0], sp.alt[1], rng()) : 0;
        return { x, y: Math.min(h + alt, -0.5), z, r, alt };
      }
      if (hab.includes('air')) {
        const alt = U.lerp(sp.alt[0], sp.alt[1], rng());
        return { x, y: Math.max(h, 0) + alt, z, r, alt };
      }
      if (hab.includes('shore')) {
        if (env.coast && h > -1.2 && h < 0.8) return { x, y: h, z, r };
        continue;
      }
      if (hab.includes('land')) {
        if (env.coast && h < 0.4) continue;
        return { x, y: h, z, r };
      }
      return null;
    }
    return null;
  }

  class Scene {
    constructor() {
      this.items = [];
      this.meteors = [];
      this.hits = [];
      this.sig = '';
      this.selected = null;
    }

    compose(env, P, seed, focusYaw) {
      const rng = U.rng(seed);
      this.items = [];
      this.meteors = [];
      for (const sp of available(env)) {
        if (sp.habitat.includes('sky')) {
          for (let k = 0; k < 4; k++) this.meteors.push({ sp, phase: rng() * 10, per: 2.5 + rng() * 4, ax: rng(), ay: rng() * 0.3, ang: 0.4 + rng() * 0.5 });
          continue;
        }
        const cnt = sp.count2 ? sp.count2(env) : sp.count;
        const n = Math.round(U.lerp(cnt[0], cnt[1], rng()));
        for (let k = 0; k < n; k++) {
          const p = place(sp, env, P, rng, focusYaw);
          if (!p) continue;
          const it = {
            sp, x: p.x, y: p.y, z: p.z, alt: p.alt || 0,
            size: U.lerp(sp.size[0], sp.size[1], rng()),
            phase: rng() * 100,
            heading: rng() * Math.PI * 2,
            moving: false,
            moveTimer: rng() * 4,
            cx: p.x, cz: p.z, orbitR: 4 + rng() * 10, orbitA: rng() * Math.PI * 2,
            facing: rng() < 0.5 ? 1 : -1,
            vx: 0, vz: 0,
          };
          if (sp.setup) sp.setup(it, rng, env);
          this.items.push(it);
        }
      }
      this.sig = signature(env);
    }

    update(dt, env, P, rng) {
      for (const it of this.items) {
        const sp = it.sp;
        const speed = sp.walk || sp.crawl || sp.speed || 0;
        if (!speed) continue;
        let vx = 0;
        let vz = 0;
        if (sp.swim === 'school' || sp.fly === 'soar') {
          const w = (sp.speed || 1) / Math.max(it.orbitR, 1);
          it.orbitA += w * dt * (it.phase % 2 > 1 ? 1 : -1);
          const nx = it.cx + Math.cos(it.orbitA) * it.orbitR;
          const nz = it.cz + Math.sin(it.orbitA) * it.orbitR;
          vx = (nx - it.x) / Math.max(dt, 1e-3);
          vz = (nz - it.z) / Math.max(dt, 1e-3);
          it.x = nx;
          it.z = nz;
          it.moving = true;
        } else {
          it.moveTimer -= dt;
          if (it.moveTimer <= 0) {
            it.moving = sp.swim || sp.fly ? true : rng() < 0.6;
            it.moveTimer = 2 + rng() * 5;
            it.heading += (rng() - 0.5) * 1.6;
          }
          const r = Math.hypot(it.x, it.z);
          if (r > sp.dist[1] * 1.1 || r < sp.dist[0] * 0.8) {
            const toC = Math.atan2(-it.x, -it.z) + (r < sp.dist[0] * 0.8 ? Math.PI : 0);
            it.heading += Math.sin(toC - it.heading) * dt * 2;
          }
          if (it.moving) {
            vx = Math.sin(it.heading) * speed;
            vz = Math.cos(it.heading) * speed;
            const nx = it.x + vx * dt;
            const nz = it.z + vz * dt;
            if (!env.under && !sp.fly && env.coast && F.heightAt(P, nx, nz, Math.hypot(nx, nz)) < 0.4) {
              it.heading += Math.PI * 0.7;
            } else {
              it.x = nx;
              it.z = nz;
            }
          }
        }
        const h = F.heightAt(P, it.x, it.z, Math.hypot(it.x, it.z));
        if (env.under) it.y = Math.min(h + (it.alt || 0) + Math.sin(it.phase + performance.now() / 1500) * 0.2 * (sp.swim ? 1 : 0), -0.4);
        else if (sp.fly) it.y = Math.max(h, 0) + it.alt;
        else it.y = h;
        it.vx = vx;
        it.vz = vz;
      }
    }

    /* cam: { pos, right, up, fwd, tanHalf } (지평 좌표), light: [r,g,b] 배수 */
    draw(ctx, W, H, cam, P, env, time, light, fogK) {
      ctx.clearRect(0, 0, W, H);
      this.hits = [];
      const k0 = H / (2 * cam.tanHalf);

      if (this.meteors.length) {
        for (const m of this.meteors) {
          const f = ((time + m.phase) % m.per) / m.per;
          if (f > 0.35) continue;
          const u = f / 0.35;
          const x0 = W * m.ax;
          const y0 = H * (0.05 + m.ay);
          const len = H * 0.35;
          const x = x0 - Math.cos(m.ang) * len * u;
          const y = y0 + Math.sin(m.ang) * len * u;
          const g = ctx.createLinearGradient(x, y, x + Math.cos(m.ang) * 80, y - Math.sin(m.ang) * 80);
          g.addColorStop(0, `rgba(255,240,210,${0.9 * (1 - u)})`);
          g.addColorStop(1, 'rgba(255,200,150,0)');
          ctx.strokeStyle = g;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + Math.cos(m.ang) * 80, y - Math.sin(m.ang) * 80);
          ctx.stroke();
        }
      }

      const vis = [];
      for (const it of this.items) {
        const v = [it.x - cam.pos[0], it.y - cam.pos[1], it.z - cam.pos[2]];
        const zc = v[0] * cam.fwd[0] + v[1] * cam.fwd[1] + v[2] * cam.fwd[2];
        if (zc < 0.4) continue;
        const xc = v[0] * cam.right[0] + v[1] * cam.right[1] + v[2] * cam.right[2];
        const yc = v[0] * cam.up[0] + v[1] * cam.up[1] + v[2] * cam.up[2];
        const k = k0 / zc;
        const sx = W / 2 + xc * k;
        const sy = H / 2 - yc * k;
        const s = it.size * k;
        const hw = (it.sp.w || 0.5) * s;
        const hh = (it.sp.h || 1) * s;
        if (sx + hw < -20 || sx - hw > W + 20 || sy < -20 || sy - hh > H + 20) continue;
        if (hh < 1.2) continue;
        const dist = Math.hypot(v[0], v[1], v[2]);
        /* 언덕 뒤에 가려졌는지 */
        if (!env.under) {
          let hidden = false;
          const topY = it.y + it.size * (it.sp.h || 1) * 0.8;
          for (let f = 0.2; f < 0.95; f += 0.15) {
            const px = cam.pos[0] + v[0] * f;
            const pz = cam.pos[2] + v[2] * f;
            const lineY = cam.pos[1] + (topY - cam.pos[1]) * f;
            if (F.heightAt(P, px, pz, dist * f) > lineY + 0.3) { hidden = true; break; }
          }
          if (hidden) continue;
        }
        let facing = it.facing;
        if (it.vx || it.vz) {
          const sv = it.vx * cam.right[0] + it.vz * cam.right[2];
          if (Math.abs(sv) > 0.01) facing = sv > 0 ? 1 : -1;
          it.facing = facing;
        }
        vis.push({ it, zc, sx, sy, s, hw, hh, dist, facing });
      }
      vis.sort((a, b) => b.zc - a.zc);

      for (const o of vis) {
        const fog = env.under ? Math.exp(-o.dist * (0.022 + 0.02 * U.smoothstep(20, 80, env.depth))) : Math.exp(-o.dist * fogK * 0.9);
        ctx.save();
        ctx.translate(o.sx, o.sy);
        ctx.scale(o.s * o.facing, o.s);
        F.G.L = light;
        ctx.globalAlpha = U.clamp(fog, env.under ? 0.3 : 0.12, 1);
        try { o.it.sp.draw(ctx, time, o.it, env); } catch (e) { /* 그림 오류는 무시 */ }
        ctx.restore();
        this.hits.push({ it: o.it, x0: o.sx - o.hw, x1: o.sx + o.hw, y0: o.sy - o.hh, y1: o.sy + Math.max(4, o.s * 0.05), zc: o.zc });
        if (this.selected === o.it) {
          ctx.strokeStyle = 'rgba(255,220,140,0.9)';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 4]);
          ctx.strokeRect(o.sx - o.hw - 4, o.sy - o.hh - 4, o.hw * 2 + 8, o.hh + 8);
          ctx.setLineDash([]);
        }
      }

      /* 가까운 것 몇 개에 이름표 */
      const labeled = new Set();
      const placed = [];
      const cands = vis.filter((o) => o.hh > 26 && o.dist < 120).sort((a, b) => b.hh - a.hh);
      ctx.font = '600 12px -apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
      ctx.textBaseline = 'middle';
      let n = 0;
      for (const o of cands) {
        if (n >= 5) break;
        if (labeled.has(o.it.sp.id)) continue;
        labeled.add(o.it.sp.id);
        n++;
        const text = o.it.sp.name.replace(/ \(.*\)$/, '');
        const tw = ctx.measureText(text).width;
        const lx = U.clamp(o.sx, tw / 2 + 8, W - tw / 2 - 8);
        const ly = U.clamp(o.sy - o.hh - 14, 140, Math.max(140, o.sy - 18));
        const box = [lx - tw / 2 - 10, ly - 12, lx + tw / 2 + 10, ly + 12];
        if (placed.some((b) => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1])) continue;
        placed.push(box);
        ctx.fillStyle = 'rgba(8,12,22,0.62)';
        roundRect(ctx, lx - tw / 2 - 8, ly - 10, tw + 16, 20, 10);
        ctx.fill();
        ctx.fillStyle = o.it.sp.kind === 'life' ? '#bff0cf' : '#f2e2c4';
        ctx.fillText(text, lx - tw / 2, ly + 0.5);
      }
    }

    pick(x, y) {
      let best = null;
      for (const h of this.hits) {
        if (x >= h.x0 - 6 && x <= h.x1 + 6 && y >= h.y0 - 6 && y <= h.y1 + 6) {
          if (!best || h.zc < best.zc) best = h;
        }
      }
      return best ? best.it : null;
    }

    /* 도감 목록: 지금 장면에 있는 것 */
    guide(env) {
      const map = new Map();
      for (const it of this.items) {
        const g = map.get(it.sp.id) || { id: it.sp.id, name: it.sp.name, icon: it.sp.icon, kind: it.sp.kind, info: it.sp.info, count: 0 };
        g.count++;
        map.set(it.sp.id, g);
      }
      for (const m of this.meteors) if (!map.has(m.sp.id)) map.set(m.sp.id, { id: m.sp.id, name: m.sp.name, icon: m.sp.icon, kind: 'thing', info: m.sp.info, count: 1 });
      for (const f of F.FEATURES) {
        try { if (f.when(env)) map.set(f.id, { id: f.id, name: f.name, icon: f.icon, kind: 'feature', info: f.info, count: 0 }); } catch (e) { /* 무시 */ }
      }
      return [...map.values()];
    }

    nearestOf(id) {
      let best = null;
      for (const it of this.items) if (it.sp.id === id && (!best || Math.hypot(it.x, it.z) < Math.hypot(best.x, best.z))) best = it;
      return best;
    }
  }

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  F.makeEnv = makeEnv;
  F.available = available;
  F.signature = signature;
  F.Scene = Scene;
})();
