'use strict';

/* WebGL2 도우미: 셰이더, 버퍼, 텍스처, 프레임버퍼 */
(function () {
  const UC = (window.UC = window.UC || {});

  function compile(gl, type, src, name) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(s);
      gl.deleteShader(s);
      throw new Error(`${name} 셰이더 오류: ${log}`);
    }
    return s;
  }

  /* 프로그램 + 유니폼 위치 캐시 */
  function program(gl, vs, fs, name) {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs, `${name}/vs`));
    gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs, `${name}/fs`));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(`${name} 링크 오류: ${gl.getProgramInfoLog(p)}`);
    const loc = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(p, i);
      const key = info.name.replace(/\[0\]$/, '');
      loc[key] = gl.getUniformLocation(p, info.name);
    }
    return { p, loc, name };
  }

  /* 유니폼 한꺼번에: 값의 모양으로 종류를 고름 (정수는 {i: n}) */
  function setUniforms(gl, prog, u) {
    for (const k in u) {
      const l = prog.loc[k];
      if (l === undefined || l === null) continue;
      const v = u[k];
      if (typeof v === 'number') gl.uniform1f(l, v);
      else if (v && v.i !== undefined) gl.uniform1i(l, v.i);
      else if (v.length === 2) gl.uniform2fv(l, v);
      else if (v.length === 3) gl.uniform3fv(l, v);
      else if (v.length === 4) gl.uniform4fv(l, v);
      else if (v.length === 9) gl.uniformMatrix3fv(l, false, v);
      else if (v.length === 16) gl.uniformMatrix4fv(l, false, v);
      else gl.uniform1fv(l, v);
    }
  }

  function makeTex(gl, w, h, fmt) {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, fmt.internal, w, h, 0, fmt.format, fmt.type, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }

  function makeTarget(gl, w, h, fmt) {
    const tex = makeTex(gl, w, h, fmt);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { tex, fb, w, h, ok };
  }

  function freeTarget(gl, t) {
    if (!t) return;
    gl.deleteTexture(t.tex);
    gl.deleteFramebuffer(t.fb);
  }

  /* 밝기가 1을 넘는 빛을 담을 수 있는 형식을 고름 */
  function hdrFormat(gl) {
    const ext = gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float');
    if (ext) {
      const f = { internal: gl.RGBA16F, format: gl.RGBA, type: gl.HALF_FLOAT, hdr: true };
      const t = makeTarget(gl, 4, 4, f);
      freeTarget(gl, t);
      if (t.ok) return f;
    }
    return { internal: gl.RGBA8, format: gl.RGBA, type: gl.UNSIGNED_BYTE, hdr: false };
  }

  /* 정점 속성 묶음: layout = [[location, size], ...] (float, 한 버퍼에 이어서) */
  function vao(gl, data, layout, usage) {
    const v = gl.createVertexArray();
    gl.bindVertexArray(v);
    const b = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, data, usage || gl.STATIC_DRAW);
    const stride = layout.reduce((a, l) => a + l[1], 0) * 4;
    let off = 0;
    for (const [loc, size] of layout) {
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, off);
      off += size * 4;
    }
    gl.bindVertexArray(null);
    return { vao: v, buf: b, count: data.length / (stride / 4) };
  }

  UC.gl = { compile, program, setUniforms, makeTex, makeTarget, freeTarget, hdrFormat, vao };
})();
