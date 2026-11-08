'use strict';

/*
 * 우주 그리기.
 * 카메라는 "10의 거듭제곱" 방식입니다: 보는 거리를 로그(L = log10 광년)로 다루어 태양계(10⁻⁵광년)부터
 * 우주 거대 구조(10¹⁰광년)까지 한 번에 확대·축소합니다.
 * 층마다(우주 거대 구조 · 은하 · 이웃 별 · 태양계) 원점과 단위를 따로 두고, 카메라 기준 위치를
 * 64비트(자바스크립트)로 계산한 뒤 GPU에 넘겨 아주 큰 거리에서도 떨림 없이 그립니다.
 */
(function () {
  const UC = (window.UC = window.UC || {});
  const G = UC.gl;
  const SH = UC.shaders;

  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

  class Renderer {
    constructor(canvas) {
      this.canvas = canvas;
      const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, stencil: false, premultipliedAlpha: false, powerPreference: 'high-performance' });
      if (!gl) throw new Error('WebGL2 없음');
      this.gl = gl;
      this.fmt = G.hdrFormat(gl);
      this.floatTex = !!gl.getExtension('EXT_color_buffer_float') || true;
      this.scale = 1;
      this.P = {
        star: G.program(gl, SH.STAR_VS, SH.POINT_FS, 'star'),
        web: G.program(gl, SH.WEB_VS, SH.POINT_FS, 'web'),
        simple: G.program(gl, SH.SIMPLE_VS, SH.POINT_FS, 'simple'),
        belt: G.program(gl, SH.BELT_VS, SH.POINT_FS, 'belt'),
        neb: G.program(gl, SH.NEB_VS, SH.POINT_FS, 'neb'),
        line: G.program(gl, SH.LINE_VS, SH.LINE_FS, 'line'),
        body: G.program(gl, SH.BODY_VS, SH.BODY_FS, 'body'),
        down: G.program(gl, SH.QUAD_VS, SH.DOWN_FS, 'down'),
        blur: G.program(gl, SH.QUAD_VS, SH.BLUR_FS, 'blur'),
        comp: G.program(gl, SH.QUAD_VS, SH.COMPOSITE_FS, 'composite'),
        civ: G.program(gl, SH.CIV_VS, SH.CIV_FS, 'civ'),
        line2: G.program(gl, SH.LINE2_VS, SH.LINE2_FS, 'line2'),
      };
      this.emptyVao = gl.createVertexArray();
      this.quad = G.vao(gl, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), [[0, 2]]);
      this.targets = null;
      this.simTex = null;
      this.simBuf = null;
      this.view = null;
    }

    /* ---------- 데이터 올리기 ---------- */
    setWeb(web) {
      const gl = this.gl;
      const n = web.count;
      const d = new Float32Array(n * 8);
      for (let i = 0; i < n; i++) {
        d.set(web.attrQ.subarray(i * 4, i * 4 + 4), i * 8);
        d.set(web.attrP.subarray(i * 4, i * 4 + 4), i * 8 + 4);
      }
      this.webVao = G.vao(gl, d, [[0, 4], [1, 4]]);
      /* 층 전체 밝기를 1로 맞춤 (지금 우주 기준) */
      let sum = 0;
      for (let i = 0; i < n; i++) sum += Math.pow(Math.max(web.attrQ[i * 4 + 3], 0.15), 0.9) * (0.4 + web.attrP[i * 4 + 3]);
      this.webNorm = 1 / sum;
    }

    setGalaxies(mw, m31) {
      const gl = this.gl;
      const lay = [[0, 4], [1, 4], [2, 4], [3, 4], [4, 4]];
      this.mw = { g: mw, v: G.vao(gl, mw.data, lay, gl.DYNAMIC_DRAW) };
      this.m31 = { g: m31, v: G.vao(gl, m31.data, lay, gl.DYNAMIC_DRAW) };
    }

    /* 충돌 계산 입자에 묶은 뒤 (오프셋이 생긴 뒤) 다시 올림 */
    refreshGalaxies() {
      const gl = this.gl;
      for (const o of [this.mw, this.m31]) {
        gl.bindBuffer(gl.ARRAY_BUFFER, o.v.buf);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, o.g.data);
      }
    }

    setLocalStars(stars) {
      const gl = this.gl;
      const d = new Float32Array(stars.length * 7);
      stars.forEach((s, i) => d.set([s.pos[0], s.pos[1], s.pos[2], s.col[0], s.col[1], s.col[2], s.lum], i * 7));
      this.localVao = G.vao(gl, d, [[0, 3], [1, 4]], gl.DYNAMIC_DRAW);
      this.localData = d;
    }

    setSolar(belts, orbits) {
      const gl = this.gl;
      const d = new Float32Array(belts.length * 5);
      belts.forEach((b, i) => d.set([b.a, b.th, b.z, b.s, b.kind], i * 5));
      this.beltVao = G.vao(gl, d, [[0, 4], [1, 1]]);
      this.beltCount = belts.length;
      this.orbitVaos = orbits.map((pts) => G.vao(gl, pts, [[0, 3]]));
      /* 행성상 성운 껍질 */
      const r = UC.util.rng(5);
      const n = 14000;
      const nd = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) {
        const u = r() * 2 - 1;
        const t = r() * Math.PI * 2;
        const s = Math.sqrt(1 - u * u);
        nd.set([s * Math.cos(t), s * Math.sin(t), u, Math.pow(r(), 0.35)], i * 4);
      }
      this.nebVao = G.vao(gl, nd, [[0, 4]]);
    }

    /* ---------- 크기 ---------- */
    resize(cssW, cssH, dpr) {
      const gl = this.gl;
      const w = Math.max(16, Math.round(cssW * dpr * this.scale));
      const h = Math.max(16, Math.round(cssH * dpr * this.scale));
      this.cssW = cssW;
      this.cssH = cssH;
      if (this.canvas.width !== w || this.canvas.height !== h) {
        this.canvas.width = w;
        this.canvas.height = h;
      }
      if (this.targets && this.targets.w === w && this.targets.h === h) return;
      if (this.targets) for (const k of ['scene', 'b1', 'b2', 'b2b', 'b3', 'b3b']) G.freeTarget(gl, this.targets[k]);
      const f = this.fmt;
      const T = (ww, hh) => G.makeTarget(gl, Math.max(1, ww), Math.max(1, hh), f);
      this.targets = {
        w, h,
        scene: T(w, h),
        b1: T(w >> 1, h >> 1),
        b2: T(w >> 2, h >> 2),
        b2b: T(w >> 2, h >> 2),
        b3: T(w >> 3, h >> 3),
        b3b: T(w >> 3, h >> 3),
      };
    }

    /* ---------- 카메라 ---------- */
    /* 층 하나의 모델-뷰 행렬: origin(광년, 64비트), unit(광년/단위), rot(3x3 열 우선, 층 좌표 → 세계) */
    mv(origin, unit, rot) {
      const c = this.view.cam;
      const R = c.R, U = c.U, F = c.F;
      const t = sub(origin, c.eye).map((x) => x / unit);
      const rows = [R, U, [-F[0], -F[1], -F[2]]];
      const m = new Float32Array(16);
      const L = rot || [1, 0, 0, 0, 1, 0, 0, 0, 1];
      for (let col = 0; col < 3; col++) {
        const v = [L[col * 3], L[col * 3 + 1], L[col * 3 + 2]];
        for (let row = 0; row < 3; row++) m[col * 4 + row] = dot(rows[row], v);
      }
      for (let row = 0; row < 3; row++) m[12 + row] = dot(rows[row], t);
      m[15] = 1;
      return m;
    }

    /* 세계 좌표(광년) → 층 단위 뷰 좌표 (64비트) */
    toView(p, unit) {
      const c = this.view.cam;
      const d = sub(p, c.eye);
      return [dot(c.R, d) / unit, dot(c.U, d) / unit, -dot(c.F, d) / unit];
    }

    proj(near, far) {
      const c = this.view.cam;
      const f = 1 / Math.tan(c.fovY / 2);
      const a = this.cssW / this.cssH;
      const m = new Float32Array(16);
      m[0] = f / a;
      m[5] = f;
      m[10] = (far + near) / (near - far);
      m[11] = -1;
      m[14] = (2 * far * near) / (near - far);
      return m;
    }

    /* 화면 좌표 (CSS 픽셀). 카메라 뒤면 null */
    project(p) {
      if (!this.view) return null;
      const v = this.toView(p, 1);
      if (v[2] >= 0) return null;
      const c = this.view.cam;
      const k = this.cssH / (2 * Math.tan(c.fovY / 2));
      return { x: this.cssW / 2 + (v[0] / -v[2]) * k, y: this.cssH / 2 - (v[1] / -v[2]) * k, depth: -v[2] };
    }

    /* ---------- 그리기 ---------- */
    render(view) {
      this.view = view;
      const gl = this.gl;
      const T = this.targets;
      const W = T.w;
      const H = T.h;
      const c = view.cam;
      const projPx = H / (2 * Math.tan(c.fovY / 2));
      const pxScale = W / this.cssW;
      const kpix = 0.1 * W * H;
      const D = c.D;

      gl.bindFramebuffer(gl.FRAMEBUFFER, T.scene.fb);
      gl.viewport(0, 0, W, H);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND);

      const opaque = view.plasma.a > 0.999;
      const w = view.w;
      const minPx = 0.8 * pxScale;

      /* --- 우주 거대 구조 --- */
      if (!opaque && w.web > 0.001 && this.webVao) {
        const unit = 1e6;
        const p = this.P.web;
        const Du = D / unit;
        gl.useProgram(p.p);
        gl.blendFunc(gl.ONE, gl.ONE);
        G.setUniforms(gl, p, Object.assign({
          uMV: this.mv([0, 0, 0], unit), uP: this.proj(Du * 1e-4, Du * 1e6),
          uFluxK: kpix * Math.pow(UC.util.clamp(Du, 30, 3000), 2) * this.webNorm * 1.6 * view.web.exposure * Math.pow(Math.min(1, view.web.u.uG), 1.5), uProj: projPx, uMinPx: minPx, uMaxPx: 24 * pxScale,
          uAlpha: w.web, uNear: Du * 0.02, uTauG: view.tauG,
        }, view.web.u));
        gl.bindVertexArray(this.webVao.vao);
        gl.drawArrays(gl.POINTS, 0, this.webVao.count);
      }

      /* --- 은하 --- */
      if (!opaque && w.galaxy > 0.001 && this.mw) this.drawGalaxies(view, projPx, pxScale, kpix, minPx);

      /* --- 은하 문명 --- */
      if (!opaque && view.civ) this.drawCiv(view, projPx, pxScale);

      /* --- 이웃 별 --- */
      if (!opaque && w.local > 0.001 && this.localVao) {
        const p = this.P.simple;
        gl.useProgram(p.p);
        gl.blendFunc(gl.ONE, gl.ONE);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.localVao.buf);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.localData);
        G.setUniforms(gl, p, {
          uMV: this.mv(view.sunWorld, 1), uP: this.proj(D * 1e-5, D * 1e7),
          uFluxK: kpix * Math.pow(Math.max(D, 3), 2) * 0.012, uProj: projPx, uMinPx: 1.3 * pxScale, uMaxPx: 10 * pxScale,
          uAlpha: w.local, uWorldR: 0.05,
        });
        gl.bindVertexArray(this.localVao.vao);
        gl.drawArrays(gl.POINTS, 0, this.localVao.count);
      }

      /* --- 태양계 --- */
      if (!opaque && w.solar > 0.001) this.drawSolar(view, projPx, pxScale);

      /* --- 블룸 + 합성 --- */
      gl.disable(gl.BLEND);
      gl.bindVertexArray(this.emptyVao);
      const pass = (prog, target, u) => {
        gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fb : null);
        gl.viewport(0, 0, target ? target.w : W, target ? target.h : H);
        gl.useProgram(prog.p);
        G.setUniforms(gl, prog, u);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      };
      const bind = (unit, tex) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex); };
      bind(0, T.scene.tex);
      pass(this.P.down, T.b1, { uSrc: { i: 0 }, uTexel: [1 / W, 1 / H], uKnee: 0.6 });
      bind(0, T.b1.tex);
      pass(this.P.down, T.b2, { uSrc: { i: 0 }, uTexel: [1 / T.b1.w, 1 / T.b1.h], uKnee: 0 });
      bind(0, T.b2.tex);
      pass(this.P.blur, T.b2b, { uSrc: { i: 0 }, uDir: [1 / T.b2.w, 0], uRes: [T.b2.w, T.b2.h] });
      bind(0, T.b2b.tex);
      pass(this.P.blur, T.b2, { uSrc: { i: 0 }, uDir: [0, 1 / T.b2.h], uRes: [T.b2.w, T.b2.h] });
      bind(0, T.b2.tex);
      pass(this.P.down, T.b3, { uSrc: { i: 0 }, uTexel: [1 / T.b2.w, 1 / T.b2.h], uKnee: 0 });
      bind(0, T.b3.tex);
      pass(this.P.blur, T.b3b, { uSrc: { i: 0 }, uDir: [1 / T.b3.w, 0], uRes: [T.b3.w, T.b3.h] });
      bind(0, T.b3b.tex);
      pass(this.P.blur, T.b3, { uSrc: { i: 0 }, uDir: [0, 1 / T.b3.h], uRes: [T.b3.w, T.b3.h] });

      bind(0, T.scene.tex);
      bind(1, T.b1.tex);
      bind(2, T.b2.tex);
      bind(3, T.b3.tex);
      const pl = view.plasma;
      const th = Math.tan(c.fovY / 2);
      pass(this.P.comp, null, {
        uScene: { i: 0 }, uB1: { i: 1 }, uB2: { i: 2 }, uB3: { i: 3 },
        uRes: [W, H], uExposure: view.exposure, uBloom: view.bloom,
        uPlasma: pl.a, uPlasmaCol: pl.col, uPlasmaScale: pl.scale, uBirth: pl.birth, uCMB: pl.cmb, uCMBCol: pl.cmbCol,
        uFlash: pl.flash, uTime: view.wallT,
        uCamR: c.R, uCamU: c.U, uCamF: c.F, uTan: [th * (this.cssW / this.cssH), th],
      });
    }

    drawGalaxies(view, projPx, pxScale, kpix, minPx) {
      const gl = this.gl;
      const p = this.P.star;
      const g = view.gal;
      const c = view.cam;
      const Deff = UC.util.clamp(c.D, 1.5e4, 4e5);
      gl.useProgram(p.p);
      const sim = g.sim;
      if (sim) {
        if (!this.simTex) {
          this.simW = 128;
          this.simH = Math.ceil(sim.pos.length / 3 / this.simW);
          this.simBuf = new Float32Array(this.simW * this.simH * 4);
          this.simTex = gl.createTexture();
          gl.bindTexture(gl.TEXTURE_2D, this.simTex);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, this.simW, this.simH, 0, gl.RGBA, gl.FLOAT, null);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        }
        const n = sim.pos.length / 3;
        for (let i = 0; i < n; i++) {
          this.simBuf[i * 4] = sim.pos[i * 3];
          this.simBuf[i * 4 + 1] = sim.pos[i * 3 + 1];
          this.simBuf[i * 4 + 2] = sim.pos[i * 3 + 2];
        }
        gl.activeTexture(gl.TEXTURE4);
        gl.bindTexture(gl.TEXTURE_2D, this.simTex);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, this.simW, this.simH, gl.RGBA, gl.FLOAT, this.simBuf);
      }
      const base = Object.assign({
        uMVw: this.mv([0, 0, 0], 1), uP: this.proj(c.D * 1e-5, c.D * 1e7),
        uFluxK: kpix * Deff * Deff * view.gal.exposure, uProj: projPx, uMinPx: minPx, uMaxPx: UC.util.lerp(3, 48, UC.util.smoothstep(3.3, 4.6, c.L)) * pxScale,
        uSim: sim ? 1 : 0, uSimTex: { i: 4 }, uTauG: view.tauG, uWall: view.wallT,
        uNear: Math.max(c.D * 0.03, 120 + 780 * (1 - UC.util.smoothstep(3.3, 4.3, c.L))), uAlpha: view.w.galaxy,
      }, g.u);
      const draws = [
        [this.mw, this.mv([0, 0, 0], 1), g.mwAlpha],
        [this.m31, this.mv(g.m31Center, 1, UC.galaxy.M31_ROT), g.m31Alpha],
      ];
      for (const dust of [0, 1]) {
        if (dust) gl.blendFunc(gl.ZERO, gl.ONE_MINUS_SRC_COLOR);
        else gl.blendFunc(gl.ONE, gl.ONE);
        for (const [o, mv, alpha] of draws) {
          if (alpha <= 0.001) continue;
          G.setUniforms(gl, p, Object.assign({}, base, { uMV: mv, uDustPass: dust, uAlpha: view.w.galaxy * alpha }));
          gl.bindVertexArray(o.v.vao);
          if (dust) gl.drawArrays(gl.POINTS, o.g.stars, o.g.dust);
          else gl.drawArrays(gl.POINTS, 0, o.g.stars);
        }
      }
      /* 블랙홀 시대의 마지막 블랙홀 */
      if (g.bh > 0.001) {
        const v = this.toView(g.bhPos, 1);
        if (v[2] < 0) {
          const pr = projPx / -v[2];
          const rad = Math.max(0.002, 22 * pxScale / pr);
          this.body(v, rad, { uKind: 4, uColor: [1, 0.62, 0.32], uIntensity: 2.2 * g.bh, uTime: view.wallT }, c.D);
        }
      }
    }


    /* 은하 문명: 매 프레임 바뀌는 작은 버퍼 */
    dynVao(key, data, layout) {
      const gl = this.gl;
      let o = this[key];
      if (!o) {
        const v = gl.createVertexArray();
        gl.bindVertexArray(v);
        const b = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, b);
        const stride = layout.reduce((a, l) => a + l[1], 0) * 4;
        let off = 0;
        for (const [loc, size] of layout) {
          gl.enableVertexAttribArray(loc);
          gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, off);
          off += size * 4;
        }
        gl.bindVertexArray(null);
        o = this[key] = { vao: v, buf: b, stride: stride / 4 };
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, o.buf);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
      return { vao: o.vao, count: data.length / o.stride };
    }

    drawCiv(view, projPx, pxScale) {
      const gl = this.gl;
      const c = view.cam;
      const d = view.civ;
      const mv = this.mv([0, 0, 0], 1);
      const P = this.proj(c.D * 1e-5, c.D * 1e7);
      const lay = [[0, 3], [1, 4], [2, 2]];
      const p = this.P.civ;
      gl.useProgram(p.p);
      const base = { uMV: mv, uP: P, uProj: projPx, uPx: pxScale, uMaxPx: 180 * pxScale };
      const draw = (key, data, mode, blend) => {
        if (!data || !data.length) return;
        const v = this.dynVao(key, data, lay);
        if (blend === 'alpha') gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        else gl.blendFunc(gl.ONE, gl.ONE);
        G.setUniforms(gl, p, Object.assign({ uMode: mode }, base));
        gl.bindVertexArray(v.vao);
        gl.drawArrays(gl.POINTS, 0, v.count);
      };
      draw('civHalo', d.halo, 0, 'alpha');
      if (d.lines && d.lines.length) {
        const lp = this.P.line2;
        gl.useProgram(lp.p);
        gl.blendFunc(gl.ONE, gl.ONE);
        const v = this.dynVao('civLines', d.lines, [[0, 3], [1, 4]]);
        G.setUniforms(gl, lp, { uMV: mv, uP: P });
        gl.bindVertexArray(v.vao);
        gl.drawArrays(gl.LINES, 0, v.count);
        gl.useProgram(p.p);
      }
      draw('civDots', d.dots, 1, 'add');
      draw('civFlash', d.flash, 2, 'add');
    }

    body(center, radius, u, D, blend) {
      const gl = this.gl;
      const p = this.P.body;
      gl.useProgram(p.p);
      if (blend === 'add') gl.blendFunc(gl.ONE, gl.ONE);
      else gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      const near = Math.max(1e-9, Math.abs(center[2]) * 1e-3);
      G.setUniforms(gl, p, Object.assign({
        uCenter: center, uRadius: radius, uP: this.proj(near, Math.abs(center[2]) * 1e3 + radius * 10),
        uKind: 0, uIntensity: 1, uGlow: 0, uBands: 0, uSeed: 0, uTime: 0, uEarth: 0, uColor: [1, 1, 1], uLight: [0, 0, 1],
        uSpin: [0, 1, 0], uRingU: [1, 0, 0], uRingV: [0, 1, 0],
      }, u));
      gl.bindVertexArray(this.quad.vao);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    drawSolar(view, projPx, pxScale) {
      const gl = this.gl;
      const S = UC.solar;
      const s = view.solar;
      const c = view.cam;
      const unit = S.AU_LY;
      const Du = c.D / unit;
      const rot = s.eclRot;
      const mv = this.mv(view.sunWorld, unit, rot);
      const P = this.proj(Du * 1e-5, Du * 1e7);
      const a = view.w.solar;

      /* 원반·소행성대·카이퍼 벨트 */
      if (this.beltVao && (s.belt > 0 || s.disk > 0 || s.cloud > 0)) {
        const p = this.P.belt;
        gl.useProgram(p.p);
        gl.blendFunc(gl.ONE, gl.ONE);
        G.setUniforms(gl, p, {
          uMV: mv, uP: P, uWall: view.wallT, uOrbitSec: S.ORBIT_SECONDS, uMass: s.mass, uBelt: s.belt, uDisk: s.disk, uCloud: s.cloud,
          uAlpha: a * (1 + 2 * s.cloud), uProj: projPx, uSunL: s.sunL, uPlA: s.plA, uPlB: s.plB, uRip: s.rip,
        });
        gl.bindVertexArray(this.beltVao.vao);
        gl.drawArrays(gl.POINTS, 0, this.beltCount);
      }
      /* 행성상 성운 */
      if (this.nebVao && s.nebula > 0.001) {
        const p = this.P.neb;
        gl.useProgram(p.p);
        gl.blendFunc(gl.ONE, gl.ONE);
        G.setUniforms(gl, p, { uMV: mv, uP: P, uR: s.nebulaR, uNeb: s.nebula, uAlpha: a, uProj: projPx });
        gl.bindVertexArray(this.nebVao.vao);
        gl.drawArrays(gl.POINTS, 0, this.nebVao.count);
      }
      /* 궤도 */
      if (this.orbitVaos && s.orbitAlpha > 0.001) {
        const p = this.P.line;
        gl.useProgram(p.p);
        gl.blendFunc(gl.ONE, gl.ONE);
        s.planets.forEach((pl, i) => {
          if (!pl.st.exists) return;
          const k = pl.st.a * s.rip;
          const m = this.mv(view.sunWorld, unit, rot.map((x) => x * k));
          const hot = pl.p.earth ? 1.6 : 1;
          const al = s.orbitAlpha * a * pl.st.fadeIn * 0.16;
          G.setUniforms(gl, p, { uMV: m, uP: P, uColor: [0.45 * al * hot, 0.6 * al * hot, 0.95 * al] });
          gl.bindVertexArray(this.orbitVaos[i].vao);
          gl.drawArrays(gl.LINE_LOOP, 0, this.orbitVaos[i].count);
        });
      }

      /* 태양 */
      const sun = s.sun;
      const sunV = this.toView(view.sunWorld, unit);
      if (sun.exists && sunV[2] < 0) {
        const pr = projPx / -sunV[2];
        const trueR = sun.R * S.RSUN_AU;
        const rad = Math.max(trueR, (sun.phase === 'wd' || sun.phase === 'black' ? 2.2 : 3.6) * pxScale / pr);
        const col = UC.util.blackbody(sun.T).map((x) => Math.pow(x, 2.2));
        const inten = s.sunI;
        this.body(sunV, rad * 7, { uKind: 2, uColor: col, uIntensity: inten * 0.22 * a }, c.D, 'add');
        this.body(sunV, rad, { uKind: 1, uColor: col, uIntensity: inten * a, uTime: view.wallT, uSeed: 3 }, c.D);
      }

      /* 행성 */
      for (const pl of s.planets) {
        if (!pl.st.exists) continue;
        const v = this.toView(pl.world, unit);
        if (v[2] >= 0) continue;
        const pr = projPx / -v[2];
        const trueR = pl.p.R / 1.496e8;
        const rad = Math.max(trueR, pl.p.minPx * pxScale * 0.8 / pr);
        const toSun = sub(sunV, v);
        const l = Math.hypot(toSun[0], toSun[1], toSun[2]) || 1;
        const light = toSun.map((x) => x / l);
        const al = a * pl.st.fadeIn;
        if (pl.p.rings) {
          this.body(v, rad, { uKind: 3, uColor: [0.92, 0.84, 0.66], uIntensity: 1.1 * al, uRingU: pl.ringU.map((x) => x * rad * 2.3), uRingV: pl.ringV.map((x) => x * rad * 2.3), uCenter: v, uRadius: rad }, c.D);
        }
        this.body(v, rad, {
          uKind: 0, uColor: pl.st.color, uLight: light, uIntensity: 1.25 * al, uGlow: pl.st.glow * al,
          uBands: pl.p.bands ? 1 : 0, uSeed: pl.seed, uTime: view.wallT, uEarth: pl.p.earth ? s.earthBlue : 0, uSpin: pl.spin,
        }, c.D);
      }
    }
  }

  UC.Renderer = Renderer;
})();
