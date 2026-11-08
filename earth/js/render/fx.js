'use strict';

/* 화면 연출: 소행성이 날아와 부딪히는 장면, 화산 분출. 실제 시간(초)으로 재생됩니다. */
(function () {
  const EC = (window.EC = window.EC || {});
  const Q = EC.q;
  const U = EC.util;

  const PREROLL = 1.4;

  class FxManager {
    constructor() {
      this.list = [];
      this.fx = new Float32Array(16);
      this.fxP = new Float32Array(16);
      this.onImpact = null;
    }

    /* dir: 지구 고정 좌표 단위 벡터, kind: 'impact' | 'volcano', size: 0.3~5 */
    add(dir, kind, size, now) {
      const tangent = Q.norm(Q.cross(dir, Math.abs(dir[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]));
      const side = Q.cross(dir, tangent);
      const k = Math.random() * Math.PI * 2;
      const tan2 = [tangent[0] * Math.cos(k) + side[0] * Math.sin(k), tangent[1] * Math.cos(k) + side[1] * Math.sin(k), tangent[2] * Math.cos(k) + side[2] * Math.sin(k)];
      const start = kind === 'impact' ? now + PREROLL : now;
      this.list.push({ dir, kind, size, start, dur: kind === 'impact' ? 5 + size * 1.6 : 8, tan: tan2, fired: false });
      if (this.list.length > 8) this.list.shift();
    }

    clear() { this.list = []; }

    update(now, globe) {
      this.fx.fill(0);
      this.fxP.fill(0);
      for (let i = 0; i < 4; i++) this.fx[i * 4 + 3] = -1;
      let meteor = 0;
      let meteorA = [0, 0, 0];
      let meteorB = [0, 0, 0];
      let dust = 0;
      let flash = 0;
      this.list = this.list.filter((e) => now < e.start + e.dur);
      const active = this.list.slice(-4);
      active.forEach((e, i) => {
        if (now < e.start) {
          const k = 1 - (e.start - now) / PREROLL;
          const p = globe.toWorld(e.dir);
          const tw = globe.toWorld(e.tan);
          const a = [p[0] * 3.4 + tw[0] * 1.6, p[1] * 3.4 + tw[1] * 1.6, p[2] * 3.4 + tw[2] * 1.6];
          const kh = Math.pow(k, 1.7);
          const kt = Math.max(0, kh - 0.16);
          meteorB = [a[0] + (p[0] - a[0]) * kh, a[1] + (p[1] - a[1]) * kh, a[2] + (p[2] - a[2]) * kh];
          meteorA = [a[0] + (p[0] - a[0]) * kt, a[1] + (p[1] - a[1]) * kt, a[2] + (p[2] - a[2]) * kt];
          meteor = Math.max(meteor, U.smoothstep(0, 0.15, k) * Math.min(1.5, 0.5 + e.size * 0.3));
          return;
        }
        if (!e.fired) { e.fired = true; if (this.onImpact) this.onImpact(e); }
        const age = (now - e.start) / e.dur;
        this.fx[i * 4] = e.dir[0];
        this.fx[i * 4 + 1] = e.dir[1];
        this.fx[i * 4 + 2] = e.dir[2];
        this.fx[i * 4 + 3] = age;
        this.fxP[i * 4] = e.kind === 'impact' ? 1 : 2;
        this.fxP[i * 4 + 1] = e.size;
        if (e.kind === 'impact') {
          dust = Math.max(dust, U.smoothstep(0.05, 0.25, age) * (1 - age) * U.clamp(e.size - 0.6, 0, 1) * 0.55);
          flash = Math.max(flash, Math.exp(-age * e.dur * 6) * Math.min(1, e.size * 0.22));
        }
      });
      return { fx: this.fx, fxP: this.fxP, uMeteor: meteor, uMeteorA: meteorA, uMeteorB: meteorB, uDust: dust, uFlash: flash };
    }
  }

  EC.FxManager = FxManager;
})();
