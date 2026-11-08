'use strict';

/* WebGL2 래퍼: 셰이더 컴파일, 판 마스크 텍스처, 카메라, 그리기, 화면 좌표 → 지구 위치 */
(function () {
  const EC = (window.EC = window.EC || {});
  const Q = EC.q;

  const TILT = 23.44;
  const SUN_DIR = Q.norm([0.86, 0.16, 0.48]);

  function compile(gl, type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(sh);
      gl.deleteShader(sh);
      throw new Error('셰이더 컴파일 실패: ' + log);
    }
    return sh;
  }

  class Globe {
    constructor(canvas) {
      this.canvas = canvas;
      const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'high-performance', preserveDrawingBuffer: true });
      if (!gl) throw new Error('이 브라우저는 WebGL2 를 지원하지 않습니다.');
      this.gl = gl;
      const prog = gl.createProgram();
      gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, EC.render.VERT));
      gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, EC.render.FRAG));
      gl.bindAttribLocation(prog, 0, 'aPos');
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('셰이더 연결 실패: ' + gl.getProgramInfoLog(prog));
      this.prog = prog;
      gl.useProgram(prog);

      const vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

      this.loc = {};
      const n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < n; i++) {
        const info = gl.getActiveUniform(prog, i);
        const name = info.name.replace(/\[0\]$/, '');
        this.loc[name] = gl.getUniformLocation(prog, info.name);
      }

      this.camera = { yaw: 0.55, pitch: 0.28, dist: 3.4 };
      this.spin = 0;
      this.scale = 1;
      this.sunDir = SUN_DIR;
      this.plateMats = new Float32Array(9 * 8);
      this.earthMat = new Float32Array(9);
    }

    setMask(bytes, W, H, layers) {
      const gl = this.gl;
      const tex = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D_ARRAY, tex);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, gl.R8, W, H, layers, 0, gl.RED, gl.UNSIGNED_BYTE, bytes);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.uniform1i(this.loc.uMask, 0);
    }

    resize(cssW, cssH, dpr) {
      const w = Math.max(1, Math.round(cssW * dpr * this.scale));
      const h = Math.max(1, Math.round(cssH * dpr * this.scale));
      if (this.canvas.width !== w || this.canvas.height !== h) {
        this.canvas.width = w;
        this.canvas.height = h;
      }
      this.cssW = cssW;
      this.cssH = cssH;
    }

    /* 지구 고정 좌표 → 세계 좌표 회전 */
    earthToWorldQ() {
      const tilt = Q.axisAngle([0, 0, 1], TILT);
      const spin = Q.axisAngle([0, 1, 0], (this.spin * 180) / Math.PI);
      return Q.mul(tilt, spin);
    }

    cameraBasis() {
      const c = this.camera;
      const pos = [c.dist * Math.cos(c.pitch) * Math.sin(c.yaw), c.dist * Math.sin(c.pitch), c.dist * Math.cos(c.pitch) * Math.cos(c.yaw)];
      const fwd = Q.norm([-pos[0], -pos[1], -pos[2]]);
      const right = Q.norm(Q.cross(fwd, [0, 1, 0]));
      const up = Q.cross(right, fwd);
      return { pos, fwd, right, up, tanHalf: Math.tan((38 * Math.PI) / 360) };
    }

    /* 화면 좌표(CSS px) → 지구 고정 좌표의 단위 벡터 (지구를 안 맞히면 null) */
    pick(x, y) {
      const cam = this.cameraBasis();
      const u = (x - this.cssW / 2) / this.cssH;
      const v = -(y - this.cssH / 2) / this.cssH;
      const k = 2 * cam.tanHalf;
      const rd = Q.norm([
        cam.fwd[0] + (u * cam.right[0] + v * cam.up[0]) * k,
        cam.fwd[1] + (u * cam.right[1] + v * cam.up[1]) * k,
        cam.fwd[2] + (u * cam.right[2] + v * cam.up[2]) * k,
      ]);
      const ro = cam.pos;
      const b = Q.dot(ro, rd);
      const c = Q.dot(ro, ro) - 1;
      const h = b * b - c;
      if (h < 0) return null;
      const t = -b - Math.sqrt(h);
      if (t < 0) return null;
      const pw = [ro[0] + rd[0] * t, ro[1] + rd[1] * t, ro[2] + rd[2] * t];
      return Q.rotate(Q.conj(this.earthToWorldQ()), pw);
    }

    /* 한 지점의 지평 좌표계(동·위·북)를 세계 좌표로 */
    localFrame(dirEarth) {
      const up = Q.norm(this.toWorld(dirEarth));
      const axis = this.toWorld([0, 1, 0]);
      let east = Q.cross(axis, up);
      if (Q.len(east) < 1e-6) east = [1, 0, 0];
      east = Q.norm(east);
      const north = Q.cross(up, east);
      return { up, east, north };
    }

    /* 지구 고정 방향이 세계에서 어디인지 */
    toWorld(dir) {
      return Q.rotate(this.earthToWorldQ(), dir);
    }

    render(u) {
      const gl = this.gl;
      const L = this.loc;
      gl.useProgram(this.prog);
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      const cam = this.cameraBasis();
      gl.uniform2f(L.uRes, this.canvas.width, this.canvas.height);
      gl.uniform1f(L.uTime, u.time);
      gl.uniform3fv(L.uCamPos, cam.pos);
      gl.uniform3fv(L.uCamRight, cam.right);
      gl.uniform3fv(L.uCamUp, cam.up);
      gl.uniform3fv(L.uCamFwd, cam.fwd);
      gl.uniform1f(L.uTanHalfFov, cam.tanHalf);

      Q.toMat3(Q.conj(this.earthToWorldQ()), this.earthMat);
      gl.uniformMatrix3fv(L.uEarthRot, false, this.earthMat);
      gl.uniform3fv(L.uSunDir, this.sunDir);

      u.plateRots.forEach((r, i) => Q.toMat3(Q.conj(r), this.plateMats, i * 9));
      gl.uniformMatrix3fv(L.uPlateInv, false, this.plateMats);
      gl.uniform1fv(L.uLayerVis, u.layerVis);

      const f1 = ['uDetail', 'uSunAng', 'uSunIntensity', 'uShrink', 'uSeaShift', 'uOcean', 'uLava', 'uHeat', 'uIceLat', 'uTempG', 'uVeg', 'uMats', 'uWet', 'uSand',
        'uFuture', 'uCloud', 'uCloudSpin', 'uAtmoDensity', 'uHaze', 'uCity', 'uMoonR', 'uMoonLava', 'uMeteor', 'uDust', 'uFlash', 'uExposure'];
      for (const k of f1) if (L[k]) gl.uniform1f(L[k], u[k]);
      const f3 = ['uBetaR', 'uBetaM', 'uMieAbs', 'uSunColor', 'uRock', 'uOceanDeep', 'uOceanShallow', 'uCloudColor', 'uAtmoColor', 'uHazeColor', 'uMoonPos', 'uMeteorA', 'uMeteorB', 'uPick'];
      for (const k of f3) if (L[k]) gl.uniform3fv(L[k], u[k]);
      gl.uniform4fv(L.uFx, u.fx);
      gl.uniform4fv(L.uFxP, u.fxP);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
  }

  EC.Globe = Globe;
  EC.Globe.SUN_DIR = SUN_DIR;
})();
