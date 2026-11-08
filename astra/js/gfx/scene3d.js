'use strict';

/* =========================================================
 * 3D 배경 — WebGL 로 그리는 챕터별 맵 (전투 화면 뒤에 깔리는 층)
 *   - AZ.gfx.cam3d : 3D 층과 2D 전투 층이 함께 쓰는 원근 카메라
 *   - AZ.gfx.scene3d : 하늘·도시·바닥·움직이는 배경·조명 변화
 * 좌표: 게임 (x, y, 높이 z) → GL (X = x, Y = z, Z = y)
 * WebGL 이 없으면 available = false 이고 2D 배경으로 돌아갑니다.
 * ========================================================= */
window.AZ = window.AZ || {};
AZ.gfx = AZ.gfx || {};

/* ───────────── 공용 원근 카메라 ───────────── */
AZ.gfx.cam3d = (() => {
  const VW = 1280;
  const VH = 720;
  const view = new Float32Array(16);
  const proj = new Float32Array(16);
  const vp = new Float32Array(16);
  const st = { eye: [0, 0, 0], target: [0, 0, 0], f: 1, shakeX: 0, shakeY: 0, pitch: 0.5, yaw: 0, dist: 1400, fov: 0.6 };

  function perspective(out, fovy, aspect, near, far) {
    const f = 1 / Math.tan(fovy / 2);
    const nf = 1 / (near - far);
    out.fill(0);
    out[0] = f / aspect;
    out[5] = f;
    out[10] = (far + near) * nf;
    out[11] = -1;
    out[14] = 2 * far * near * nf;
  }
  function lookAt(out, e, c, up) {
    let zx = e[0] - c[0], zy = e[1] - c[1], zz = e[2] - c[2];
    let l = Math.hypot(zx, zy, zz) || 1;
    zx /= l; zy /= l; zz /= l;
    let xx = up[1] * zz - up[2] * zy, xy = up[2] * zx - up[0] * zz, xz = up[0] * zy - up[1] * zx;
    l = Math.hypot(xx, xy, xz) || 1;
    xx /= l; xy /= l; xz /= l;
    const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    out[0] = xx; out[1] = yx; out[2] = zx; out[3] = 0;
    out[4] = xy; out[5] = yy; out[6] = zy; out[7] = 0;
    out[8] = xz; out[9] = yz; out[10] = zz; out[11] = 0;
    out[12] = -(xx * e[0] + xy * e[1] + xz * e[2]);
    out[13] = -(yx * e[0] + yy * e[1] + yz * e[2]);
    out[14] = -(zx * e[0] + zy * e[1] + zz * e[2]);
    out[15] = 1;
  }
  function mul(out, a, b) {
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        out[j * 4 + i] = a[i] * b[j * 4] + a[4 + i] * b[j * 4 + 1] + a[8 + i] * b[j * 4 + 2] + a[12 + i] * b[j * 4 + 3];
      }
    }
  }

  /** o: { tx, ty (게임 좌표 바라보는 점), pitch, yaw, dist, fov, shakeX, shakeY, lookZ } */
  function set(o) {
    st.pitch = o.pitch; st.yaw = o.yaw || 0; st.dist = o.dist; st.fov = o.fov;
    const cp = Math.cos(o.pitch);
    const lz = o.lookZ || 0;
    st.target = [o.tx, lz, o.ty];
    st.eye = [o.tx + Math.sin(st.yaw) * cp * o.dist, lz + Math.sin(o.pitch) * o.dist, o.ty + Math.cos(st.yaw) * cp * o.dist];
    lookAt(view, st.eye, st.target, [0, 1, 0]);
    perspective(proj, o.fov, VW / VH, 8, 40000);
    mul(vp, proj, view);
    st.f = 1 / Math.tan(o.fov / 2);
    st.shakeX = o.shakeX || 0;
    st.shakeY = o.shakeY || 0;
  }

  /** 게임 좌표 → 화면 { x, y, k(월드 1 = k 픽셀), fy(바닥 세로 축소율), w(깊이) } */
  function project(x, y, z) {
    const m = vp;
    const Y = z || 0;
    const cx = m[0] * x + m[4] * Y + m[8] * y + m[12];
    const cy = m[1] * x + m[5] * Y + m[9] * y + m[13];
    const cw = m[3] * x + m[7] * Y + m[11] * y + m[15];
    if (cw < 5) return { x: -99999, y: -99999, k: 0.0001, fy: 0.5, w: cw, behind: true };
    const sx = (cx / cw * 0.5 + 0.5) * VW + st.shakeX;
    const sy = (0.5 - cy / cw * 0.5) * VH + st.shakeY;
    const k = (VH / 2) * st.f / cw;
    // 바닥에서 y 로 1 만큼 떨어진 점으로 세로 축소율 계산
    const cy2 = cy + m[9];
    const cw2 = cw + m[11];
    const sy2 = (0.5 - cy2 / cw2 * 0.5) * VH + st.shakeY;
    return { x: sx, y: sy, k, fy: Math.max(0.15, Math.min(1, (sy2 - sy) / k)), w: cw };
  }

  return { set, project, vp, view, proj, st, VW, VH };
})();

/* ───────────── 3D 장면 ───────────── */
AZ.gfx.scene3d = (() => {
  const C = AZ.gfx.cam3d;
  let gl = null;
  let canvas = null;
  let ok = false;
  let highp = false;
  const P = {}; // 프로그램
  let scene = null;
  let failed = false;
  const mood = { tint: [1, 1, 1], alarm: 0, zero: 0, stop: 0, flash: 0, boss: [0, 0, 0], bossAmt: 0 };
  const moodTarget = Object.assign({}, mood, { tint: [1, 1, 1], boss: [0, 0, 0] });
  const flashes = []; // 먼 폭발
  let dynBuf = null;

  /* ───────── 셰이더 ───────── */
  const COMMON = `
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); f = f*f*(3.0-2.0*f);
    return mix(mix(hash(i), hash(i+vec2(1.0,0.0)), f.x), mix(hash(i+vec2(0.0,1.0)), hash(i+vec2(1.0,1.0)), f.x), f.y); }
  float fbm(vec2 p){ float v = 0.0; float a = 0.5; for (int i = 0; i < 4; i++){ v += a*noise(p); p *= 2.03; a *= 0.5; } return v; }
  uniform vec4 uMood;   // tint rgb, alarm
  uniform vec4 uMood2;  // zero, stop, flash, bossAmt
  uniform vec3 uBossCol;
  vec3 applyMood(vec3 c, float t){
    c *= uMood.rgb;
    c = mix(c, c * (vec3(0.55) + uBossCol), uMood2.w * 0.35);
    float g = dot(c, vec3(0.299, 0.587, 0.114));
    c = mix(c, vec3(g) * vec3(0.7, 0.9, 1.35), uMood2.x * 0.75);
    c = mix(c, vec3(g) * vec3(0.95, 0.82, 1.25), uMood2.y * 0.8);
    c += vec3(1.0, 0.1, 0.15) * uMood.a * (0.06 + 0.06 * sin(t * 6.0));
    c += uMood2.z;
    return c;
  }`;

  const PREC = () => (highp ? 'precision highp float;\n' : 'precision mediump float;\n');

  const MESH_VS = `
  attribute vec3 aPos; attribute vec3 aCenter; attribute vec3 aNormal; attribute vec4 aColor; attribute vec4 aEmit; attribute vec4 aAnim; attribute vec2 aUV;
  uniform mat4 uVP; uniform float uTime; uniform vec2 uShake; uniform float uOutline;
  varying vec3 vWorld; varying vec3 vNormal; varying vec4 vColor; varying vec4 vEmit; varying vec2 vUV; varying float vSeed; varying float vFade;
  vec3 rotY(vec3 p, float a){ float c = cos(a); float s = sin(a); return vec3(c*p.x + s*p.z, p.y, -s*p.x + c*p.z); }
  vec3 rotX(vec3 p, float a){ float c = cos(a); float s = sin(a); return vec3(p.x, c*p.y - s*p.z, s*p.y + c*p.z); }
  vec3 rotZ(vec3 p, float a){ float c = cos(a); float s = sin(a); return vec3(c*p.x - s*p.y, s*p.x + c*p.y, p.z); }
  void main(){
    vec3 p = aPos; vec3 n = aNormal; vec3 c = aCenter;
    float ty = aAnim.x; float t = uTime * aAnim.y + aAnim.w;
    if (ty > 0.5 && ty < 1.5) { p = rotY(p, t); n = rotY(n, t); }
    else if (ty > 1.5 && ty < 2.5) { c += vec3(cos(t) * aAnim.z, sin(t * 0.7) * 30.0, sin(t) * aAnim.z * 0.5); p = rotY(p, -t); n = rotY(n, -t); }
    else if (ty > 2.5 && ty < 3.5) { c.y += sin(t) * aAnim.z; }
    else if (ty > 3.5 && ty < 4.5) { p = rotX(rotY(p, t), t * 0.6); n = rotX(rotY(n, t), t * 0.6); c.y += sin(t * 0.5) * aAnim.z; }
    else if (ty > 4.5 && ty < 5.5) { c.x += (fract(t) - 0.5) * aAnim.z; }
    else if (ty > 5.5 && ty < 6.5) { p = rotZ(p, t); n = rotZ(n, t); }
    else if (ty > 6.5) { p = rotX(p, t); n = rotX(n, t); }
    vec3 w = c + p;
    // 외곽선 패스: 캐릭터 면을 법선 방향으로 부풀림 (앞면은 잘라 내고 뒷면만 그림)
    if (uOutline > 0.0) {
      if ((aColor.a > 9.5 && aColor.a < 11.5) || (aColor.a > 5.5 && aColor.a < 6.5)) w += normalize(n) * uOutline;
      else { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); return; }
    }
    vWorld = w; vNormal = n; vColor = aColor; vEmit = aEmit; vUV = aUV;
    vFade = ty < 0.5 ? aAnim.z : 0.0;
    vSeed = fract(sin(dot(aCenter.xz + aCenter.y, vec2(12.9898, 78.233))) * 43758.5453);
    gl_Position = uVP * vec4(w, 1.0);
    gl_Position.xy += uShake * gl_Position.w;
  }`;

  const MESH_FS = () => PREC() + COMMON + `
  uniform vec3 uEye; uniform vec3 uFog; uniform float uFogDen; uniform vec3 uAbyss; uniform float uAbyssY;
  uniform vec3 uLightDir; uniform vec3 uKey; uniform vec3 uAmb; uniform float uTime;
  varying vec3 vWorld; varying vec3 vNormal; varying vec4 vColor; varying vec4 vEmit; varying vec2 vUV; varying float vSeed; varying float vFade;
  float bayer2(vec2 a){ a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
  float bayer4(vec2 a){ return bayer2(0.5 * a) * 0.25 + bayer2(a); }
  vec3 billboard(vec2 uv, float seed, vec3 col){
    float typ = floor(seed * 5.0);
    float inner = step(0.05, uv.x) * step(uv.x, 0.95) * step(0.05, uv.y) * step(uv.y, 0.95);
    vec3 c = col * 0.12;
    if (typ < 1.0) { c += col * (0.45 + 0.55 * sin((uv.y * 10.0 + uTime * 1.2) * 3.1416)) * 0.7; }
    else if (typ < 2.0) { float r = length(uv - 0.5); c += col * smoothstep(0.34, 0.31, r) * smoothstep(0.2, 0.23, r) * 1.6; c += col * 0.5 * step(r, 0.12); float a = atan(uv.y - 0.5, uv.x - 0.5); c += col * 0.6 * step(0.92, fract(a * 1.2732 + uTime * 0.3)) * step(r, 0.3); }
    else if (typ < 3.0) { vec2 g = floor(uv * vec2(5.0, 9.0)); float on = step(0.42, hash(g + floor(uTime * 0.7) + seed * 17.0)); c += col * on * step(0.15, fract(uv.x * 5.0)) * step(0.22, fract(uv.y * 9.0)); }
    else if (typ < 4.0) { c += col * (0.35 + 0.65 * uv.y) * (0.6 + 0.4 * step(0.5, fract(uv.y * 36.0 - uTime))); float fig = smoothstep(0.22, 0.2, length((uv - vec2(0.5, 0.62)) * vec2(1.0, 0.8))) + smoothstep(0.3, 0.28, abs(uv.x - 0.5)) * step(uv.y, 0.42); c += vec3(1.0) * fig * 0.25; }
    else { float s = sin(uv.x * 20.0 + uTime * 2.0) * 0.5 + 0.5; c += mix(col, col.bgr, uv.x) * (0.4 + 0.6 * s) * 0.8; }
    c = c * inner + col * (1.0 - inner) * 1.6;
    c *= 0.82 + 0.18 * step(0.08, fract(uTime * 0.29 + seed * 7.0));
    return c * 1.35;
  }
  uniform vec4 uFocus; // 플레이어 화면 위치(px), 반경(px), 카메라와의 거리
  uniform float uOutline;
  void main(){
    // 반투명(등장·사망·잔상): 점무늬로 비우기
    if (vFade > 0.0 && bayer4(gl_FragCoord.xy) < vFade) discard;
    if (uOutline > 0.0) { gl_FragColor = vec4(0.025, 0.03, 0.06, 1.0); return; }
    // 카메라와 플레이어 사이를 가리는 구조물은 점무늬로 비쳐 보이게
    if (uFocus.z > 0.0 && vColor.a < 9.5 && distance(vWorld, uEye) < uFocus.w - 90.0) {
      vec2 sd = gl_FragCoord.xy - uFocus.xy;
      float r = length(sd * vec2(1.0, 0.75)) / uFocus.z;
      float th = smoothstep(1.0, 0.55, r) * 0.82;
      vec2 fc = mod(floor(gl_FragCoord.xy), 2.0);
      float bayer = (fc.x * 2.0 + fc.y + 0.5) / 4.0;
      if (bayer < th) discard;
    }
    vec3 n = normalize(vNormal);
    float kind = vColor.a;
    vec3 base = vColor.rgb;
    float diff = max(dot(n, uLightDir), 0.0);
    float rim = pow(1.0 - abs(dot(n, normalize(uEye - vWorld))), 3.0);
    vec3 col = base * (uAmb + uKey * diff) + base * rim * 0.35;
    vec3 emit = vec3(0.0);
    if (kind > 0.5 && kind < 1.5) {
      if (abs(n.y) < 0.5) {
        vec2 cs = vec2(15.0, 19.0);
        vec2 cell = floor(vUV / cs);
        vec2 f = fract(vUV / cs);
        float win = step(0.2, f.x) * step(f.x, 0.8) * step(0.22, f.y) * step(f.y, 0.78);
        float h = hash(cell + vSeed * 91.7);
        float lit = step(1.0 - vEmit.a, h);
        float alt = step(0.82, hash(cell * 1.31 + 7.7));
        vec3 wc = mix(vEmit.rgb, vec3(1.0, 0.82, 0.55), alt * 0.7);
        emit += win * lit * wc * (0.7 + 0.3 * sin(uTime * 1.7 + h * 50.0));
        // 층마다 띠
        float band = step(0.965, fract(vUV.y / 140.0 + vSeed));
        emit += band * vEmit.rgb * 0.6;
      } else {
        col *= 0.7;
        col += base * 0.25 * step(0.9, hash(floor(vWorld.xz / 9.0)));
      }
    } else if (kind > 1.5 && kind < 2.5) {
      float pulse = 1.0;
      if (vEmit.a > 1.5) pulse = 0.55 + 0.45 * sin(uTime * 3.0 + vSeed * 30.0);
      emit = vEmit.rgb * min(vEmit.a, 1.4) * pulse * 1.3;
      col *= 0.15;
    } else if (kind > 2.5 && kind < 3.5) {
      emit = billboard(vUV, vSeed, vEmit.rgb);
      col *= 0.1;
    } else if (kind > 4.5 && kind < 5.5) {
      // 콘크리트: 골재 얼룩, 거푸집 이음매, 타이 구멍, 빗물 자국
      vec2 w2 = abs(n.y) > 0.5 ? vWorld.xz : vUV;
      col *= 0.8 + 0.26 * noise(w2 / 31.0) + 0.12 * (noise(w2 / 2.6) - 0.5);
      if (abs(n.y) < 0.5) {
        vec2 f = fract(vUV / vec2(120.0, 60.0));
        col *= 1.0 - (smoothstep(0.012, 0.0, f.x) + smoothstep(0.022, 0.0, f.y) * 0.7) * 0.32;
        vec2 th = (f - vec2(0.5)) * vec2(120.0, 60.0);
        col *= 1.0 - smoothstep(2.6, 1.6, length(vec2(abs(th.x) - 30.0, th.y))) * 0.45;
        float streak = smoothstep(0.5, 0.85, noise(vec2(vUV.x / 7.0, vUV.y / 300.0)));
        col *= 1.0 - streak * 0.28;
        col *= 0.92 + 0.08 * smoothstep(0.0, 40.0, mod(vUV.y, 600.0));
      } else {
        col *= 1.0 - smoothstep(0.62, 0.8, noise(vWorld.xz / 18.0)) * 0.25;
      }
    } else if (kind > 5.5 && kind < 6.5) {
      // 도장한 강철: 결, 판 이음매, 볼트, 반사광, 녹
      vec3 V = normalize(uEye - vWorld);
      col *= 0.86 + 0.22 * noise(vec2(vUV.x / 1.2, vUV.y / 36.0));
      vec2 f = fract(vUV / vec2(80.0, 50.0));
      col *= 1.0 - (step(f.x, 0.014) + step(f.y, 0.02)) * 0.4;
      vec2 bq = (fract(vUV / vec2(20.0, 50.0)) - vec2(0.5, 0.1)) * vec2(20.0, 50.0);
      col += vec3(0.07) * smoothstep(2.2, 1.2, length(bq));
      float spec = pow(max(dot(n, normalize(uLightDir + V)), 0.0), 36.0);
      col += uKey * spec * 0.55;
      float rust = smoothstep(0.62, 0.86, noise(vWorld.xz / 70.0 + vec2(vWorld.y / 90.0)));
      col = mix(col, col * vec3(1.3, 0.72, 0.42), rust * 0.55);
    } else if (kind > 6.5 && kind < 7.5) {
      // 경고 줄무늬 (노랑·검정 사선)
      float d = fract((vUV.x + vUV.y + vWorld.y) / 30.0);
      vec3 hz = mix(vec3(0.92, 0.68, 0.08), vec3(0.05, 0.05, 0.06), step(0.5, d));
      col = hz * (uAmb + uKey * diff + 0.25) * (0.82 + 0.18 * noise(vWorld.xz / 6.0 + vUV / 5.0));
    } else if (kind > 7.5 && kind < 8.5) {
      // 도로 표지판: 흰 테두리와 글자 줄 (재귀 반사)
      vec2 uv = vUV;
      float inner = step(0.05, uv.x) * step(uv.x, 0.95) * step(0.09, uv.y) * step(uv.y, 0.91);
      float core = step(0.075, uv.x) * step(uv.x, 0.925) * step(0.13, uv.y) * step(uv.y, 0.87);
      float border = inner * (1.0 - core);
      float row = floor(uv.y * 3.0);
      float lr = 0.3 + 0.45 * hash(vec2(row, vSeed * 17.0));
      float fr = fract(uv.y * 3.0);
      float txt = step(0.3, fr) * step(fr, 0.7) * step(0.14, uv.x) * step(uv.x, 0.14 + lr) * step(0.3, fract(uv.x * 11.0 + hash(vec2(row, 5.0)))) * core;
      float arrow = step(abs(fr - 0.5), (uv.x - 0.72) * 2.0) * step(uv.x, 0.86) * core * step(row, 0.5);
      col = base * (uAmb * 1.6 + uKey * 0.6);
      float wht = clamp(border + txt + arrow, 0.0, 1.0);
      col = mix(col, vec3(0.75), wht);
      emit += vEmit.rgb * vEmit.a * (0.25 + wht * 0.6);
      col *= 1.0 - (1.0 - inner) * 0.6;
    } else if (kind > 8.5 && kind < 9.5) {
      // 유리: 어두운 바탕에 하늘이 비침
      vec3 V = normalize(uEye - vWorld);
      vec3 r = reflect(-V, n);
      col = base * 0.35 + mix(uAmb * 0.25, uKey * 0.7 + vec3(0.05, 0.06, 0.1), clamp(r.y * 0.6 + 0.4, 0.0, 1.0)) * 0.55;
      col += uKey * pow(max(dot(n, normalize(uLightDir + V)), 0.0), 60.0) * 0.9;
    } else if (kind > 10.5 && kind < 11.5) {
      // 캐릭터의 금속(은색 갑옷): 셀 셰이딩 + 강한 반사광 + 하늘 반사
      vec3 V = normalize(uEye - vWorld);
      vec3 Ld = normalize(vec3(0.35, 0.85, 0.55));
      float d = dot(n, Ld);
      float band = 0.55 + 0.35 * smoothstep(-0.1, 0.05, d) + 0.25 * smoothstep(0.55, 0.65, d);
      float spec = smoothstep(0.82, 0.9, dot(reflect(-Ld, n), V));
      float env = clamp(reflect(-V, n).y * 0.5 + 0.5, 0.0, 1.0);
      float rimc = pow(1.0 - max(dot(n, V), 0.0), 2.4);
      col = base * band * 1.08 + base * env * 0.25 + vec3(1.0) * spec * 0.55 + (uKey * 0.5 + vec3(0.35, 0.45, 0.6)) * rimc * 0.6;
      emit = vEmit.rgb * vEmit.a;
    } else if (kind > 9.5) {
      // 캐릭터: 셀 셰이딩(두 단계 명암) + 테두리 빛 + 자체 발광 (12 는 외곽선 없는 얼굴 부분)
      vec3 V = normalize(uEye - vWorld);
      float d = dot(n, normalize(vec3(0.35, 0.85, 0.55)));
      float band = 0.52 + 0.3 * smoothstep(-0.1, 0.05, d) + 0.2 * smoothstep(0.6, 0.7, d);
      float rimc = pow(1.0 - max(dot(n, V), 0.0), 2.6);
      col = base * band * (vec3(0.98) + uKey * 0.35) + base * 0.1;
      col += (uKey * 0.6 + vec3(0.3, 0.42, 0.6)) * rimc * (0.55 + dot(base, vec3(0.33)) * 0.6);
      emit = vEmit.rgb * vEmit.a;
    } else if (kind > 3.5) {
      vec2 f = fract(vUV / vec2(60.0, 48.0));
      float seam = step(f.x, 0.03) + step(f.y, 0.04);
      col *= 0.85 + 0.15 * hash(floor(vUV / vec2(60.0, 48.0)) + vSeed);
      col *= 1.0 - seam * 0.45;
      emit += vEmit.rgb * vEmit.a * step(0.97, fract(vUV.y / 96.0 + vSeed)) * 1.2;
      emit += vEmit.rgb * 0.5 * step(0.985, hash(floor(vUV / vec2(30.0, 24.0)) + vSeed * 3.0));
    }
    float al = uMood.a * (0.55 + 0.45 * sin(uTime * 6.0));
    emit = mix(emit, vec3(length(emit)) * vec3(1.0, 0.18, 0.22), al * 0.55);
    vec3 c = col + emit;
    float d = distance(vWorld, uEye);
    float fog = 1.0 - exp(-d * uFogDen);
    float hf = clamp((uAbyssY - vWorld.y) / max(1.0, abs(uAbyssY) + 900.0), 0.0, 1.0);
    vec3 fc = mix(uFog, uAbyss, hf);
    float keep = min(1.0, length(emit)) * 0.45;
    c = mix(c, fc, clamp((fog + hf * 0.6) * (1.0 - keep), 0.0, 1.0));
    gl_FragColor = vec4(applyMood(c, uTime), 1.0);
  }`;

  const ADD_FS = () => PREC() + COMMON + `
  uniform vec3 uEye; uniform float uFogDen; uniform float uTime;
  varying vec3 vWorld; varying vec3 vNormal; varying vec4 vColor; varying vec4 vEmit; varying vec2 vUV; varying float vSeed;
  void main(){
    float kind = vColor.a;
    float a = 1.0;
    if (kind < 0.5) { float x = abs(vUV.x * 2.0 - 1.0); a = (1.0 - x * x) * (1.0 - x) * smoothstep(1.0, 0.75, vUV.y) * smoothstep(0.0, 0.05, vUV.y); }
    else if (kind < 1.5) { float r = length(vUV * 2.0 - 1.0); a = pow(max(0.0, 1.0 - r), 2.0); }
    else if (kind < 2.5) { float v = abs(vUV.y * 2.0 - 1.0); a = pow(max(0.0, 1.0 - v), 1.5); }
    else { float x = abs(vUV.x * 2.0 - 1.0); a = (1.0 - x) * (1.0 - vUV.y) * (1.0 - vUV.y); }
    float flick = 0.85 + 0.15 * sin(uTime * 5.0 + vSeed * 20.0);
    float d = distance(vWorld, uEye);
    float vis = exp(-d * uFogDen * 0.55);
    vec3 c = vEmit.rgb * vEmit.a * a * flick * vis;
    gl_FragColor = vec4(applyMood(c, uTime) - uMood2.z, 1.0);
  }`;

  const FLOOR_VS = `
  attribute vec3 aPos;
  uniform mat4 uVP; uniform vec2 uShake;
  varying vec3 vWorld;
  void main(){ vWorld = aPos; gl_Position = uVP * vec4(aPos, 1.0); gl_Position.xy += uShake * gl_Position.w; }`;

  const FLOOR_FS = () => PREC() + COMMON + `
  uniform vec3 uEye; uniform vec3 uFog; uniform float uFogDen; uniform float uTime;
  uniform vec4 uArena; uniform vec3 uBaseA; uniform vec3 uBaseB; uniform vec4 uGrid; uniform vec3 uEdge;
  uniform float uPattern; uniform float uWet; uniform float uMode; uniform vec4 uFrame;
  uniform vec4 uLights[8]; uniform vec3 uLightCol[8];
  uniform vec3 uNeon0; uniform vec3 uNeon1; uniform vec3 uNeon2;
  varying vec3 vWorld;
  void main(){
    vec2 p = vWorld.xz;
    vec3 c;
    if (uMode > 0.5 && uMode < 1.5) {
      // 아래 깊은 곳의 도시 불빛
      vec2 cell = floor(p / 40.0);
      float h = hash(cell);
      float street = step(0.92, fract(p.x / 320.0)) + step(0.92, fract(p.y / 280.0));
      c = uBaseA * (0.4 + 0.3 * noise(p / 300.0));
      c += mix(uNeon0, uNeon1, step(0.5, hash(cell * 2.1))) * step(0.86, h) * 0.9;
      c += uNeon2 * street * 0.35;
    } else if (uMode > 1.5 && uMode < 2.5) {
      // 구름 바다
      float n = fbm(p / 420.0 + vec2(uTime * 0.01, 0.0));
      c = mix(uBaseB, uBaseA, smoothstep(0.35, 0.8, n));
    } else {
      vec2 d0 = p - uFrame.xy;
      vec2 q = vec2(dot(d0, vec2(uFrame.w, -uFrame.z)), dot(d0, uFrame.zw));
      float inside = step(0.0, q.x) * step(q.x, uArena.z) * step(0.0, q.y) * step(q.y, uArena.w);
      float n1 = noise(p / 90.0);
      float n2 = noise(p / 23.0);
      c = mix(uBaseB, uBaseA, 0.55 + 0.45 * n1) * (0.88 + 0.24 * n2);
      // 무늬
      if (uPattern < 0.5) {
        float crack = smoothstep(0.035, 0.0, abs(noise(p / 140.0) - 0.5)) * smoothstep(0.3, 0.7, noise(p / 400.0 + 3.0));
        c *= 1.0 - crack * 0.55;
        vec2 tile = fract(p / 160.0);
        c *= 0.92 + 0.08 * step(0.03, tile.x) * step(0.03, tile.y);
      } else if (uPattern < 1.5) {
        vec2 tile = fract(p / vec2(120.0, 80.0));
        float seam = step(tile.x, 0.02) + step(tile.y, 0.03);
        c *= (0.9 + 0.12 * hash(floor(p / vec2(120.0, 80.0)))) * (1.0 - seam * 0.5);
        c += uEdge * 0.25 * step(0.985, hash(floor(p / 40.0))) ;
      } else if (uPattern < 2.5) {
        vec2 r = vec2(1.0, 1.7320508);
        vec2 h1 = mod(p / 46.0, r) - r * 0.5;
        vec2 h2 = mod(p / 46.0 - r * 0.5, r) - r * 0.5;
        vec2 g = dot(h1, h1) < dot(h2, h2) ? h1 : h2;
        float e = max(abs(g.x), dot(abs(g), normalize(vec2(1.0, 1.7320508))));
        c *= 0.85 + 0.15 * smoothstep(0.5, 0.45, e);
        c += uEdge * 0.35 * smoothstep(0.46, 0.5, e);
      } else if (uPattern < 3.5) {
        vec2 g = fract(p / 64.0);
        vec2 id = floor(p / 64.0);
        float tr = step(0.5, hash(id)) * smoothstep(0.06, 0.0, abs(g.y - 0.5)) + step(0.5, hash(id + 5.0)) * smoothstep(0.06, 0.0, abs(g.x - 0.5));
        float node = smoothstep(0.12, 0.08, length(g - 0.5)) * step(0.6, hash(id + 9.0));
        float flow = 0.5 + 0.5 * sin(p.x / 30.0 + p.y / 40.0 - uTime * 3.0);
        c += uEdge * (tr * (0.25 + 0.4 * flow) + node * 0.9);
      } else if (uPattern < 4.5) {
        vec2 cell = floor(p / 70.0);
        vec2 f = fract(p / 70.0) - 0.5;
        float d = 1.0;
        for (int i = -1; i <= 1; i++) for (int j = -1; j <= 1; j++) {
          vec2 o = vec2(float(i), float(j));
          vec2 pt = o + vec2(hash(cell + o), hash(cell + o + 13.0)) - 0.5 - f;
          d = min(d, length(pt));
        }
        c *= 0.8 + 0.4 * d;
        c += uEdge * 0.5 * smoothstep(0.08, 0.0, d - 0.04) ;
      } else if (uPattern > 6.5 && uPattern < 7.5) {
        // 고가 도로 노면: 골재, 보수 자국, 균열, 바퀴 자국, 차선, 신축 이음, 배수구
        float W = uArena.z;
        vec3 asp = mix(vec3(0.15, 0.15, 0.16), (uBaseA + uBaseB) * 0.5, 0.25);
        c = asp * (0.74 + 0.5 * noise(p / 2.0) * noise(p / 8.0)) * (0.9 + 0.2 * noise(p / 70.0));
        vec2 pg = vec2(q.x / 110.0, q.y / 170.0);
        vec2 pf = fract(pg);
        float pin = step(0.12, pf.x) * step(pf.x, 0.88) * step(0.18, pf.y) * step(pf.y, 0.82) * step(0.78, hash(floor(pg) + 4.0));
        c = mix(c, c * 0.7, pin);
        float cr = smoothstep(0.022, 0.0, abs(noise(p / 52.0) - 0.5)) * smoothstep(0.45, 0.72, noise(p / 230.0 + 5.0));
        c *= 1.0 - cr * 0.6;
        float lc = q.x < W * 0.5 ? W * 0.27 : W * 0.73;
        float trk = smoothstep(16.0, 0.0, abs(abs(q.x - lc) - 30.0));
        c *= 1.0 + 0.1 * trk;
        c *= 1.0 - 0.3 * trk * smoothstep(0.62, 0.8, noise(vec2(q.x / 5.0, q.y / 90.0)));
        float wear = 0.55 + 0.45 * noise(p / 6.0);
        float edgeL = smoothstep(3.0, 1.2, abs(q.x - 34.0)) + smoothstep(3.0, 1.2, abs(W - 34.0 - q.x));
        float cen = smoothstep(2.6, 1.0, abs(q.x - W * 0.5)) * step(0.5, fract(q.y / 130.0));
        c = mix(c, vec3(0.6, 0.6, 0.56), clamp(edgeL + cen, 0.0, 1.0) * wear * 0.8);
        float ex = min(q.x, W - q.x);
        c *= 0.7 + 0.3 * smoothstep(4.0, 26.0, ex);
        vec2 dg = vec2(ex - 16.0, mod(q.y, 260.0) - 130.0);
        float grate = step(abs(dg.x), 7.0) * step(abs(dg.y), 15.0);
        c = mix(c, vec3(0.04) + 0.07 * step(0.5, fract(dg.y / 4.0)), grate);
        float jy = abs(mod(q.y, 560.0) - 280.0);
        c = mix(c, vec3(0.3, 0.31, 0.34) * (0.75 + 0.25 * step(0.5, fract(q.x / 9.0))), smoothstep(7.0, 6.0, jy));
        c *= 1.0 - smoothstep(1.6, 0.0, abs(jy - 7.0)) * 0.55;
      } else if (uPattern > 7.5 && uPattern < 8.5) {
        // 교차로·광장: 아스팔트 + 둘레의 보도블록과 연석, 횡단보도, 정지선, 맨홀
        float Wd = uArena.z;
        float Hd = uArena.w;
        vec3 asp = mix(vec3(0.15, 0.15, 0.16), (uBaseA + uBaseB) * 0.5, 0.25);
        c = asp * (0.74 + 0.5 * noise(p / 2.0) * noise(p / 8.0)) * (0.9 + 0.2 * noise(p / 80.0));
        float cr = smoothstep(0.022, 0.0, abs(noise(p / 60.0) - 0.5)) * smoothstep(0.45, 0.72, noise(p / 260.0 + 2.0));
        c *= 1.0 - cr * 0.6;
        float ex = min(min(q.x, Wd - q.x), min(q.y, Hd - q.y));
        float wear = 0.55 + 0.45 * noise(p / 6.0);
        float bandH = step(96.0, q.y) * step(q.y, 170.0) + step(Hd - 170.0, q.y) * step(q.y, Hd - 96.0);
        float bandV = step(96.0, q.x) * step(q.x, 170.0) + step(Wd - 170.0, q.x) * step(q.x, Wd - 96.0);
        float cw = bandH * step(Wd * 0.28, q.x) * step(q.x, Wd * 0.72) * step(0.5, fract(q.x / 36.0));
        cw += bandV * step(Hd * 0.28, q.y) * step(q.y, Hd * 0.72) * step(0.5, fract(q.y / 36.0));
        float midL = smoothstep(2.6, 1.0, abs(q.x - Wd * 0.5)) * step(0.5, fract(q.y / 130.0)) * step(190.0, ex);
        c = mix(c, vec3(0.6, 0.6, 0.56), clamp(cw + midL, 0.0, 1.0) * wear * 0.8);
        vec2 mc = vec2(Wd * 0.62, Hd * 0.4);
        float md = length(q - mc);
        c *= 1.0 - smoothstep(19.0, 17.0, md) * 0.35;
        c += vec3(0.05) * smoothstep(2.0, 0.0, abs(md - 18.0)) + vec3(0.03) * step(md, 17.0) * step(0.5, fract((q.x + q.y) / 5.0));
        float walk = smoothstep(80.0, 78.0, ex);
        vec2 tl = fract(p / vec2(42.0, 21.0) + vec2(0.5 * step(0.5, fract(p.y / 42.0)), 0.0));
        vec3 sw = vec3(0.3, 0.29, 0.3) * (0.82 + 0.2 * hash(floor(p / vec2(42.0, 21.0)))) * (1.0 - 0.4 * (step(tl.x, 0.04) + step(tl.y, 0.08)));
        c = mix(c, sw, walk);
        c = mix(c, vec3(0.42, 0.42, 0.43) * (0.85 + 0.2 * noise(p / 4.0)), smoothstep(70.0, 72.0, ex) * smoothstep(82.0, 80.0, ex));
      } else if (uPattern > 8.5 && uPattern < 9.5) {
        // 강철 바닥: 줄무늬 철판, 판 이음매와 볼트, 긁힘·녹, 가장자리 경고선
        vec3 stl = mix(vec3(0.2, 0.21, 0.23), (uBaseA + uBaseB) * 0.5, 0.35);
        vec2 g = p / 120.0;
        vec2 pf = fract(g);
        vec2 d2 = p / 10.0;
        vec2 cell = floor(d2);
        vec2 fq = fract(d2) - 0.5;
        float flip = mod(cell.x + cell.y, 2.0);
        vec2 rq = flip > 0.5 ? vec2(fq.x + fq.y, fq.x - fq.y) : vec2(fq.x - fq.y, fq.x + fq.y);
        float dia = smoothstep(0.14, 0.06, abs(rq.y)) * smoothstep(0.5, 0.36, abs(rq.x));
        c = stl * (0.84 + 0.16 * hash(floor(g))) * (0.9 + 0.3 * dia) * (0.9 + 0.15 * noise(p / 3.0));
        c *= 1.0 - 0.5 * (step(pf.x, 0.012) + step(pf.y, 0.012));
        vec2 cd = min(pf, 1.0 - pf) * 120.0;
        c += vec3(0.1) * smoothstep(3.0, 1.8, length(cd - 7.0));
        c = mix(c, c * vec3(1.25, 0.78, 0.5), smoothstep(0.62, 0.86, fbm(p / 90.0)) * 0.55);
        float ed2 = min(min(q.x, uArena.z - q.x), min(q.y, uArena.w - q.y));
        float hz = step(ed2, 24.0) * step(6.0, ed2);
        c = mix(c, mix(vec3(0.72, 0.52, 0.07), vec3(0.04), step(0.5, fract((p.x + p.y) / 42.0))), hz * 0.85);
      } else if (uPattern > 9.5 && uPattern < 10.5) {
        // 석재 바닥: 엇갈린 큰 판석, 줄눈, 마모, 둘레 띠
        vec2 sp = p / vec2(150.0, 110.0);
        sp.x += 0.5 * mod(floor(sp.y), 2.0);
        vec2 sf = fract(sp);
        vec2 sid = floor(sp);
        c = mix(uBaseB, uBaseA, 0.3 + 0.6 * hash(sid)) * (0.84 + 0.22 * fbm(p / 36.0));
        vec2 gm = min(sf, 1.0 - sf) * vec2(150.0, 110.0);
        c *= 1.0 - 0.5 * smoothstep(2.2, 0.6, min(gm.x, gm.y));
        float cr = smoothstep(0.02, 0.0, abs(noise(p / 48.0) - 0.5)) * smoothstep(0.5, 0.75, noise(p / 200.0 + 8.0));
        c *= 1.0 - cr * 0.5;
        float ed2 = min(min(q.x, uArena.z - q.x), min(q.y, uArena.w - q.y));
        float band = step(ed2, 40.0);
        vec2 bf = fract(p / 60.0);
        c = mix(c, uBaseB * 0.8 * (1.0 - 0.4 * (step(bf.x, 0.04) + step(bf.y, 0.04))), band * 0.85);
      } else if (uPattern > 5.5) {
        // 보스 전투 무대: 동심원, 방사선, 가운데 문장
        vec2 cc = uArena.zw * 0.5;
        vec2 dd = q - cc;
        float r = length(dd);
        float ang = atan(dd.y, dd.x);
        float R0 = min(uArena.z, uArena.w) * 0.47;
        vec2 tile = fract(p / vec2(120.0, 80.0));
        c *= 0.9 + 0.1 * step(0.03, tile.x) * step(0.04, tile.y);
        float disk = smoothstep(R0 + 4.0, R0, r);
        c = mix(c, c * 0.75 + uBaseA * 0.35, disk);
        float rings = smoothstep(3.5, 0.0, abs(mod(r, 150.0) - 75.0)) * disk;
        float sp = abs(fract(ang * 24.0 / 6.2832) - 0.5);
        float spoke = smoothstep(0.035, 0.0, sp * r / 300.0) * step(170.0, r) * disk;
        float rim = smoothstep(8.0, 0.0, abs(r - R0)) + smoothstep(3.0, 0.0, abs(r - R0 + 26.0)) * 0.6;
        float emb = smoothstep(4.0, 0.0, abs(r - 120.0)) + smoothstep(3.0, 0.0, abs(r - 60.0)) * 0.7;
        float hexr = max(abs(dd.x) * 0.866 + abs(dd.y) * 0.5, abs(dd.y));
        emb += smoothstep(3.0, 0.0, abs(hexr - 95.0)) * 0.8;
        float pulse = 0.75 + 0.25 * sin(uTime * 2.0 - r / 90.0);
        c += uEdge * (rings * 0.22 + spoke * 0.18 + rim * 0.9 + emb * 0.6) * pulse;
      } else {
        // 도시의 아스팔트 도로: 차선, 중앙선, 인도, 횡단보도, 맨홀, 얼룩
        float roadW = uMode > 2.5 ? uArena.z : uArena.z;
        c *= 0.82 + 0.36 * noise(p / 5.0) * noise(p / 29.0);
        c *= 0.86 + 0.14 * smoothstep(0.3, 0.65, noise(p / 75.0 + 9.0));
        float ex = min(q.x, roadW - q.x);
        float walk = smoothstep(96.0, 92.0, ex);
        float lane = abs(fract((q.x - roadW * 0.5) / 300.0 + 0.5) - 0.5) * 300.0;
        float dash = step(0.42, fract(q.y / 130.0));
        float mid = abs(q.x - roadW * 0.5);
        vec3 paint = vec3(0.0);
        paint += vec3(0.9, 0.9, 0.82) * smoothstep(5.0, 3.0, lane) * dash * step(30.0, mid) * 0.32;
        paint += vec3(1.0, 0.72, 0.18) * smoothstep(3.5, 1.5, abs(mid - 9.0)) * 0.45;
        float zz = step(60.0, mod(q.y, 900.0)) * step(mod(q.y, 900.0), 170.0);
        paint += vec3(0.85) * zz * step(0.55, fract(q.x / 56.0)) * 0.18 * (1.0 - walk);
        vec2 mc = floor(p / 280.0);
        vec2 mo = (vec2(hash(mc), hash(mc + 3.0)) * 0.6 + 0.2) * 280.0;
        float md = length(fract(p / 280.0) * 280.0 - mo);
        float hasM = step(0.55, hash(mc + 7.0));
        c *= 1.0 - smoothstep(22.0, 20.0, md) * 0.3 * hasM;
        paint += vec3(0.3) * smoothstep(2.5, 0.0, abs(md - 21.0)) * hasM * 0.35;
        c += paint * (0.75 + 0.25 * noise(p / 11.0)) * (1.0 - walk);
        vec2 tl = fract(p / 46.0);
        vec3 side = uBaseA * 1.25 * (0.9 + 0.15 * step(0.05, tl.x) * step(0.05, tl.y));
        c = mix(c, side, walk);
        c += uEdge * smoothstep(3.0, 0.0, abs(ex - 94.0)) * 0.55;
      }
      // 격자
      vec2 gl = abs(fract(p / 100.0) - 0.5) * 100.0;
      float line = smoothstep(48.6, 50.0, max(gl.x, gl.y));
      c += uGrid.rgb * uGrid.a * line * inside;
      // 젖은 바닥에 비친 네온
      float refl = 0.0;
      vec3 rc = vec3(0.0);
      float s1 = pow(max(0.0, sin(p.x / 47.0 + 1.3)), 24.0);
      float s2 = pow(max(0.0, sin(p.x / 83.0 + 4.1)), 30.0);
      float s3 = pow(max(0.0, sin(p.x / 61.0 + 2.2)), 28.0);
      float fadeZ = uMode > 2.5 ? 0.8 : smoothstep(uArena.w * 1.05, -200.0, q.y);
      float ripple = 0.75 + 0.25 * noise(vec2(p.x / 8.0, p.y / 40.0 + uTime * 0.6));
      rc = (uNeon0 * s1 + uNeon1 * s2 + uNeon2 * s3) * fadeZ * ripple;
      float puddle = smoothstep(0.55, 0.7, noise(p / 130.0 + 7.0));
      c += rc * uWet * (0.35 + 0.65 * puddle);
      c = mix(c, c * 0.6 + uBaseA * 0.2, puddle * uWet * 0.3);
      // 경기장 가장자리
      float ed = min(min(q.x, uArena.z - q.x), min(q.y, uArena.w - q.y));
      if (uPattern < 4.5) c += uEdge * (smoothstep(26.0, 0.0, ed) * 0.8 + smoothstep(3.0, 0.0, abs(ed - 34.0)) * 0.5) * inside;
      else if (uPattern < 6.5) c += uEdge * smoothstep(10.0, 0.0, ed) * 0.35 * inside;
      if (uMode > 2.5 && uPattern < 4.5) c *= 0.55 + 0.45 * inside;
    }
    // 빛 웅덩이
    for (int i = 0; i < 8; i++) {
      vec4 L = uLights[i];
      if (L.w <= 0.0) continue;
      float dd = distance(p, L.xy);
      c += uLightCol[i] * L.w * pow(max(0.0, 1.0 - dd / L.z), 2.0);
    }
    float d = distance(vWorld, uEye);
    c = mix(c, uFog, 1.0 - exp(-d * uFogDen));
    gl_FragColor = vec4(applyMood(c, uTime), 1.0);
  }`;

  const SKY_VS = `
  attribute vec2 aPos; varying vec2 vUV;
  void main(){ vUV = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

  const SKY_FS = () => PREC() + COMMON + `
  uniform vec3 uTop; uniform vec3 uMid; uniform vec3 uBot; uniform float uTime; uniform float uPar; uniform vec2 uRes;
  uniform vec4 uMoon; uniform vec3 uMoonCol; uniform float uStars; uniform float uFx; uniform vec3 uFxA; uniform vec3 uFxB; uniform float uFxAmt;
  varying vec2 vUV;
  void main(){
    vec2 uv = vUV;
    float asp = uRes.x / uRes.y;
    vec2 su = vec2(uv.x + uPar, uv.y);
    vec3 c = mix(uBot, uMid, smoothstep(0.0, 0.5, uv.y));
    c = mix(c, uTop, smoothstep(0.5, 1.0, uv.y));
    // 별
    vec2 sp = floor(su * uRes / 2.5);
    float star = step(0.996, hash(sp)) * (0.5 + 0.5 * sin(uTime * 2.0 + hash(sp + 3.0) * 30.0));
    c += vec3(0.85, 0.9, 1.0) * star * uStars * smoothstep(0.25, 0.75, uv.y);
    // 효과
    if (uFx > 0.5 && uFx < 1.5) {
      float n = fbm(su * vec2(3.0, 2.0) + vec2(uTime * 0.005, 0.0));
      c += uFxA * smoothstep(0.45, 0.9, n) * 0.45 * uFxAmt + uFxB * smoothstep(0.6, 1.0, fbm(su * 5.0 + 4.0)) * 0.25 * uFxAmt;
    } else if (uFx > 1.5 && uFx < 2.5) {
      vec2 cc = vec2(0.62, 0.78);
      vec2 d = (uv - cc) * vec2(asp, 1.0);
      float r = length(d);
      float a = atan(d.y, d.x);
      float sw = a + log(r + 0.001) * 3.0 - uTime * (0.25 + 0.35 * uFxAmt);
      float bands = fbm(vec2(sw * 2.0, r * 6.0)) ;
      float disk = smoothstep(0.75, 0.05, r) * (0.5 + 0.8 * bands);
      c += mix(uFxB, uFxA, smoothstep(0.0, 0.5, r)) * disk * (0.9 + 0.6 * uFxAmt);
      c = mix(c, vec3(0.0), smoothstep(0.075 + 0.02 * uFxAmt, 0.04, r));
      c += uFxB * smoothstep(0.02, 0.0, abs(r - 0.085 - 0.02 * uFxAmt)) * 1.4;
    } else if (uFx > 2.5 && uFx < 3.5) {
      vec2 pc = vec2(0.3 - uPar * 0.6, 0.62);
      vec2 d = (uv - pc) * vec2(asp, 1.0);
      float r = length(d);
      float R = 0.62;
      float body = smoothstep(R, R - 0.004, r);
      float lat = d.y / R;
      float land = fbm(vec2(d.x * 4.0 + uTime * 0.01, d.y * 7.0));
      vec3 pcol = mix(uFxA * 0.6, uFxA, smoothstep(0.45, 0.6, land));
      pcol = mix(pcol, vec3(0.95), smoothstep(0.62, 0.75, fbm(d * 9.0 + 2.0)) * 0.6);
      float light = clamp(dot(normalize(vec3(d / R, sqrt(max(0.0, 1.0 - dot(d / R, d / R))))), normalize(vec3(0.6, 0.5, 0.6))), 0.0, 1.0);
      c = mix(c, pcol * (0.15 + 0.95 * light), body);
      c += uFxB * smoothstep(R + 0.06, R, r) * (1.0 - body) * 0.8;
      c += uFxB * body * pow(1.0 - light, 4.0) * 0.0 + uFxB * body * smoothstep(R - 0.05, R, r) * 0.5;
      lat = lat;
    } else if (uFx > 3.5 && uFx < 4.5) {
      float n = fbm(su * vec2(4.0, 6.0) + vec2(uTime * 0.008, 0.0));
      float cl = smoothstep(0.42, 0.75, n) * smoothstep(0.15, 0.6, 1.0 - uv.y + 0.3);
      c = mix(c, uFxA, cl * 0.85);
      vec2 sd = (uv - vec2(0.18, 0.92)) * vec2(asp, 1.0);
      c += uFxB * exp(-length(sd) * 6.0) * 0.9;
    } else if (uFx > 4.5) {
      float panel = step(0.97, fract(uv.y * 9.0)) + step(0.985, fract(su.x * 14.0));
      c *= 1.0 - panel * 0.35;
      c += uFxA * step(0.985, fract(uv.y * 9.0 + 0.012)) * 0.5 * step(0.5, hash(vec2(floor(su.x * 14.0), floor(uv.y * 9.0))));
    }
    // 달
    if (uMoon.z > 0.0) {
      vec2 d = (uv - uMoon.xy + vec2(uPar * 0.3, 0.0)) * vec2(asp, 1.0);
      float r = length(d);
      float R = uMoon.z;
      vec3 mc = uMoonCol * (0.7 + 0.3 * fbm(d / R * 3.0 + 1.0));
      float sh = clamp(dot(normalize(vec3(d / R, sqrt(max(0.0, 1.0 - dot(d / R, d / R))))), normalize(vec3(-0.5, 0.4, 0.75))), 0.0, 1.0);
      c = mix(c, mc * (0.25 + 0.85 * sh), smoothstep(R, R * 0.985, r));
      c += uMoonCol * 0.45 * exp(-max(r - R, 0.0) / (R * 0.55)) * step(R * 0.99, r);
      if (uMoon.w > 0.5) {
        vec2 e = d * vec2(1.0, 4.2);
        float rr = abs(length(e) - R * 1.6);
        c += uMoonCol * smoothstep(0.012, 0.0, rr) * 0.5 * step(0.0, d.y + R * 0.02 * 0.0) * (r > R || d.y < 0.0 ? 1.0 : 0.0);
      }
    }
    gl_FragColor = vec4(applyMood(c, uTime), 1.0);
  }`;

  const PART_VS = `
  attribute vec3 aBase; attribute vec3 aVel; attribute vec4 aParam; attribute vec4 aColor;
  uniform mat4 uVP; uniform float uTime; uniform vec2 uShake; uniform float uPx;
  varying vec4 vColor; varying float vEnd;
  void main(){
    float life = aParam.x;
    float tt = mod(uTime + aParam.z * life, life);
    vec3 p = aBase + aVel * tt - aVel * 0.035 * aParam.w;
    vec4 cp = uVP * vec4(p, 1.0);
    cp.xy += uShake * cp.w;
    gl_Position = cp;
    gl_PointSize = clamp(aParam.y * uPx / max(cp.w, 1.0), 1.0, 64.0);
    float fade = smoothstep(0.0, 0.12, tt / life) * smoothstep(1.0, 0.75, tt / life);
    vColor = vec4(aColor.rgb, aColor.a * fade);
    vEnd = aParam.w;
  }`;

  const PART_FS = () => PREC() + COMMON + `
  uniform float uTime; uniform float uLines;
  varying vec4 vColor; varying float vEnd;
  void main(){
    float a = vColor.a;
    if (uLines < 0.5) { vec2 d = gl_PointCoord - 0.5; a *= smoothstep(0.5, 0.0, length(d)); }
    else a *= 1.0 - vEnd * 0.8;
    gl_FragColor = vec4(applyMood(vColor.rgb * a, uTime) - uMood2.z, 1.0);
  }`;

  const DYN_VS = `
  attribute vec3 aPos; attribute vec4 aColor; attribute float aSize;
  uniform mat4 uVP; uniform vec2 uShake; uniform float uPx;
  varying vec4 vColor;
  void main(){ vec4 cp = uVP * vec4(aPos, 1.0); cp.xy += uShake * cp.w; gl_Position = cp; gl_PointSize = clamp(aSize * uPx / max(cp.w, 1.0), 1.0, 256.0); vColor = aColor; }`;

  const DYN_FS = () => PREC() + `
  varying vec4 vColor;
  void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d); float a = smoothstep(0.5, 0.0, r); a = a * a; gl_FragColor = vec4(vColor.rgb * vColor.a * a + vec3(1.0) * vColor.a * smoothstep(0.18, 0.0, r) * 0.6, 1.0); }`;

  /* ───────── GL 도우미 ───────── */
  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(s);
      gl.deleteShader(s);
      throw new Error('셰이더 컴파일 실패: ' + log);
    }
    return s;
  }
  /* 캐릭터 발밑 그림자 (곱하기 합성) */
  const SHADOW_VS = `
  attribute vec3 aPos; attribute vec3 aUA;
  uniform mat4 uVP; uniform vec2 uShake;
  varying vec3 vU;
  void main(){ vU = aUA; gl_Position = uVP * vec4(aPos, 1.0); gl_Position.xy += uShake * gl_Position.w; }`;
  const SHADOW_FS = () => PREC() + `
  varying vec3 vU;
  void main(){ float r = length(vU.xy); float a = smoothstep(1.0, 0.2, r) * vU.z; gl_FragColor = vec4(vec3(1.0 - a), 1.0); }`;

  function program(vs, fs, attrs) {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
    attrs.forEach((a, i) => gl.bindAttribLocation(p, i, a));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('셰이더 연결 실패: ' + gl.getProgramInfoLog(p));
    const u = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(p, i);
      const name = info.name.replace(/\[0\]$/, '');
      u[name] = gl.getUniformLocation(p, info.name);
    }
    return { p, u, attrs };
  }
  function bindAttribs(prog, layout, stride) {
    let off = 0;
    for (let i = 0; i < 8; i++) gl.disableVertexAttribArray(i);
    layout.forEach((size, i) => {
      gl.enableVertexAttribArray(i);
      gl.vertexAttribPointer(i, size, gl.FLOAT, false, stride * 4, off * 4);
      off += size;
    });
  }
  const hex = (h) => {
    const n = parseInt(h.slice(1), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  };
  const scl = (c, k) => [c[0] * k, c[1] * k, c[2] * k];

  /* ───────── 메시 만들기 ───────── */
  const MESH_LAYOUT = [3, 3, 3, 4, 4, 4, 2];
  const MESH_STRIDE = 23;
  class Mesh {
    constructor() { this.v = []; }
    vert(p, c, n, col, emit, anim, uv) {
      this.v.push(p[0], p[1], p[2], c[0], c[1], c[2], n[0], n[1], n[2], col[0], col[1], col[2], col[3], emit[0], emit[1], emit[2], emit[3], anim[0], anim[1], anim[2], anim[3], uv[0], uv[1]);
    }
    /** 사각형 면 (네 꼭짓점은 중심 기준 오프셋) */
    face(c, a, b, cc, d, n, col, emit, anim, uvs) {
      this.vert(a, c, n, col, emit, anim, uvs[0]);
      this.vert(b, c, n, col, emit, anim, uvs[1]);
      this.vert(cc, c, n, col, emit, anim, uvs[2]);
      this.vert(a, c, n, col, emit, anim, uvs[0]);
      this.vert(cc, c, n, col, emit, anim, uvs[2]);
      this.vert(d, c, n, col, emit, anim, uvs[3]);
    }
    /**
     * 상자. c: 중심 [x,y,z] (GL 좌표), s: [w,h,d]
     * o: { color:'#hex'|[r,g,b], kind 0~4, emit:'#hex', ea(강도/창 밀도), anim:[type,speed,radius,phase], rot(Y 회전), taper(아랫면 배율), skipBottom, top(윗면만 다른 색) }
     */
    box(c, s, o) {
      const col = [...(Array.isArray(o.color) ? o.color : hex(o.color || '#222233')), o.kind || 0];
      const em = [...(o.emit ? (Array.isArray(o.emit) ? o.emit : hex(o.emit)) : [0, 0, 0]), o.ea != null ? o.ea : 0.3];
      const an = o.anim || [0, 0, 0, 0];
      const w = s[0] / 2, h = s[1] / 2, d = s[2] / 2;
      const tb = o.taper != null ? o.taper : 1;
      const rot = o.rot || 0;
      const cr = Math.cos(rot), sr = Math.sin(rot);
      const R = (x, y, z) => [cr * x + sr * z, y, -sr * x + cr * z];
      const RN = (x, y, z) => R(x, y, z);
      const P = (sx, sy, sz) => {
        const k = sy < 0 ? tb : 1;
        return R(sx * w * k, sy * h, sz * d * k);
      };
      const wuv = o.uvScale || 1;
      const U = (u, v) => [u * wuv, v * wuv];
      const W2 = s[0], H2 = s[1], D2 = s[2];
      const base = c[1] - h;
      // +Z (카메라 쪽)
      this.face(c, P(-1, -1, 1), P(1, -1, 1), P(1, 1, 1), P(-1, 1, 1), RN(0, 0, 1), col, em, an, [U(0, base), U(W2, base), U(W2, base + H2), U(0, base + H2)]);
      // -Z
      this.face(c, P(1, -1, -1), P(-1, -1, -1), P(-1, 1, -1), P(1, 1, -1), RN(0, 0, -1), col, em, an, [U(0, base), U(W2, base), U(W2, base + H2), U(0, base + H2)]);
      // +X
      this.face(c, P(1, -1, 1), P(1, -1, -1), P(1, 1, -1), P(1, 1, 1), RN(1, 0, 0), col, em, an, [U(0, base), U(D2, base), U(D2, base + H2), U(0, base + H2)]);
      // -X
      this.face(c, P(-1, -1, -1), P(-1, -1, 1), P(-1, 1, 1), P(-1, 1, -1), RN(-1, 0, 0), col, em, an, [U(0, base), U(D2, base), U(D2, base + H2), U(0, base + H2)]);
      // 위
      const tc = o.top ? [...hex(o.top), o.kind === 1 ? 0 : col[3]] : col;
      this.face(c, P(-1, 1, 1), P(1, 1, 1), P(1, 1, -1), P(-1, 1, -1), RN(0, 1, 0), tc, em, an, [U(0, 0), U(W2, 0), U(W2, D2), U(0, D2)]);
      if (!o.skipBottom) this.face(c, P(-1, -1, -1), P(1, -1, -1), P(1, -1, 1), P(-1, -1, 1), RN(0, -1, 0), col, em, an, [U(0, 0), U(W2, 0), U(W2, D2), U(0, D2)]);
    }
    /** 꼭짓점 8개로 된 덩어리 (윗면 4: t0..t3, 아랫면 4: b0..b3, 같은 순서) — 경사 발판 */
    block(t, b, o) {
      const col = [...hex(o.color || '#222233'), o.kind || 0];
      const em = [...(o.emit ? hex(o.emit) : [0, 0, 0]), o.ea != null ? o.ea : 0.3];
      const an = o.anim || [0, 0, 0, 0];
      const c = [0, 0, 0];
      const nrm = (a, b2, d) => {
        const ux = b2[0] - a[0], uy = b2[1] - a[1], uz = b2[2] - a[2];
        const vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
        let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        const l = Math.hypot(nx, ny, nz) || 1;
        return [nx / l, ny / l, nz / l];
      };
      const quadF = (a, b2, cc, d) => {
        let n = nrm(a, b2, d);
        // 바깥을 향하게
        const mx = (a[0] + cc[0]) / 2, my = (a[1] + cc[1]) / 2, mz = (a[2] + cc[2]) / 2;
        const cx = (t[0][0] + b[2][0]) / 2, cy = (t[0][1] + b[2][1]) / 2, cz = (t[0][2] + b[2][2]) / 2;
        if (n[0] * (mx - cx) + n[1] * (my - cy) + n[2] * (mz - cz) < 0) { n = n.map((v) => -v); const tmp = b2; b2 = d; d = tmp; }
        const L = Math.hypot(cc[0] - a[0], cc[2] - a[2]);
        this.face(c, a, b2, cc, d, n, col, em, an, [[0, a[1]], [L, b2[1]], [L, cc[1]], [0, d[1]]]);
      };
      quadF(t[0], t[1], t[2], t[3]);
      quadF(b[3], b[2], b[1], b[0]);
      for (let i = 0; i < 4; i++) {
        const j = (i + 1) % 4;
        quadF(b[i], b[j], t[j], t[i]);
      }
    }
    /** 카메라(+Z) 쪽을 보는 판 — 광고판·화면. uv 0~1 */
    quad(c, w, h, o) {
      const col = [...hex(o.color || '#000000'), o.kind != null ? o.kind : 3];
      const em = [...(Array.isArray(o.emit) ? o.emit : hex(o.emit || '#66e0ff')), o.ea != null ? o.ea : 1];
      const an = o.anim || [0, 0, 0, 0];
      const rot = o.rot || 0;
      const cr = Math.cos(rot), sr = Math.sin(rot);
      const R = (x, y) => [cr * x, y, -sr * x];
      const n = [sr, 0, cr];
      this.face(c, R(-w / 2, -h / 2), R(w / 2, -h / 2), R(w / 2, h / 2), R(-w / 2, h / 2), n, col, em, an, [[0, 0], [1, 0], [1, 1], [0, 1]]);
    }
    /** 두 점 사이의 각진 막대 (철골, 다리) */
    beam(a, b, t, o) {
      const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
      const len = Math.hypot(dx, dy, dz) || 1;
      const ax = [dx / len, dy / len, dz / len];
      let up = Math.abs(ax[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
      let s1 = [ax[1] * up[2] - ax[2] * up[1], ax[2] * up[0] - ax[0] * up[2], ax[0] * up[1] - ax[1] * up[0]];
      const l1 = Math.hypot(...s1) || 1;
      s1 = s1.map((v) => v / l1);
      const s2 = [ax[1] * s1[2] - ax[2] * s1[1], ax[2] * s1[0] - ax[0] * s1[2], ax[0] * s1[1] - ax[1] * s1[0]];
      const c = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
      const col = [...hex(o.color || '#2a3040'), o.kind || 0];
      const em = [...(o.emit ? hex(o.emit) : [0, 0, 0]), o.ea != null ? o.ea : 0.3];
      const an = o.anim || [0, 0, 0, 0];
      const corner = (u, i, j) => [ax[0] * u * len / 2 + (s1[0] * i + s2[0] * j) * t / 2, ax[1] * u * len / 2 + (s1[1] * i + s2[1] * j) * t / 2, ax[2] * u * len / 2 + (s1[2] * i + s2[2] * j) * t / 2];
      const sides = [[1, 1, -1, 1, s2], [-1, 1, -1, -1, s1.map((v) => -v)], [-1, -1, 1, -1, s2.map((v) => -v)], [1, -1, 1, 1, s1]];
      const uvs = [[0, 0], [len, 0], [len, t], [0, t]];
      sides.forEach(([i0, j0, i1, j1, n]) => this.face(c, corner(-1, i0, j0), corner(1, i0, j0), corner(1, i1, j1), corner(-1, i1, j1), n, col, em, an, uvs));
    }
    /** 고리 (축: 'y' 수평 고리 / 'z' 정면 고리) — 각진 막대로 이어 붙임 */
    ring(c, R, t, axis, seg, o) {
      const pts = [];
      for (let i = 0; i <= seg; i++) {
        const a = (i / seg) * Math.PI * 2;
        pts.push(axis === 'y' ? [c[0] + Math.cos(a) * R, c[1], c[2] + Math.sin(a) * R] : axis === 'x' ? [c[0], c[1] + Math.sin(a) * R, c[2] + Math.cos(a) * R] : [c[0] + Math.cos(a) * R, c[1] + Math.sin(a) * R, c[2]]);
      }
      for (let i = 0; i < seg; i++) this.beam(pts[i], pts[i + 1], t, o);
    }
    /** 더하기 혼합용 빛 판 (kind: 0 기둥빛, 1 원형 빛, 2 띠, 3 탐조등) */
    glow(c, w, h, color, strength, kind, o) {
      const oo = o || {};
      const col = [0, 0, 0, kind];
      const em = [...hex(color), strength];
      const an = oo.anim || [0, 0, 0, 0];
      const rot = oo.rot || 0;
      const cr = Math.cos(rot), sr = Math.sin(rot);
      const base = oo.fromBottom ? 0 : -h / 2;
      const tilt = oo.tilt || 0;
      const R = (x, y) => {
        // 기울기(탐조등)
        const yy = y * Math.cos(tilt);
        const zz = y * Math.sin(tilt);
        return [cr * x + sr * zz, yy, -sr * x + cr * zz];
      };
      const n = [sr, 0, cr];
      this.face(c, R(-w / 2, base), R(w / 2, base), R(w / 2, base + h), R(-w / 2, base + h), n, col, em, an, [[0, 0], [1, 0], [1, 1], [0, 1]]);
      if (oo.cross) {
        const R2 = (x, y) => [sr * x, y, cr * x];
        this.face(c, R2(-w / 2, base), R2(w / 2, base), R2(w / 2, base + h), R2(-w / 2, base + h), [cr, 0, -sr], col, em, an, [[0, 0], [1, 0], [1, 1], [0, 1]]);
      }
    }
    /** 수평 원판 빛 (바닥 위 고리 등) */
    glowFlat(c, r, color, strength, kind, o) {
      const col = [0, 0, 0, kind];
      const em = [...hex(color), strength];
      const an = (o && o.anim) || [0, 0, 0, 0];
      this.face(c, [-r, 0, r], [r, 0, r], [r, 0, -r], [-r, 0, -r], [0, 1, 0], col, em, an, [[0, 0], [1, 0], [1, 1], [0, 1]]);
    }
    upload() {
      const data = new Float32Array(this.v);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      return { buf, count: data.length / MESH_STRIDE };
    }
  }

  /* ───────── 입자 ───────── */
  const PART_LAYOUT = [3, 3, 4, 4];
  const PART_STRIDE = 14;
  class Parts {
    constructor() { this.points = []; this.lines = []; }
    /** 상자 영역 안에서 계속 흐르는 입자. o: { box:[x0,y0,z0,x1,y1,z1], vel:[vx,vy,vz], n, size, color, alpha, lines } */
    add(o, rng) {
      const arr = o.lines ? this.lines : this.points;
      const col = hex(o.color);
      const life = o.life || 4;
      for (let i = 0; i < o.n; i++) {
        const b = [o.box[0] + rng() * (o.box[3] - o.box[0]), o.box[1] + rng() * (o.box[4] - o.box[1]), o.box[2] + rng() * (o.box[5] - o.box[2])];
        const ph = rng();
        const v = o.vel.map((x) => x * (0.8 + rng() * 0.4));
        const size = o.size * (0.6 + rng() * 0.8);
        const a = o.alpha != null ? o.alpha : 0.8;
        if (o.lines) {
          arr.push(b[0], b[1], b[2], v[0], v[1], v[2], life, size, ph, 0, col[0], col[1], col[2], a);
          arr.push(b[0], b[1], b[2], v[0], v[1], v[2], life, size, ph, 1, col[0], col[1], col[2], a);
        } else {
          arr.push(b[0], b[1], b[2], v[0], v[1], v[2], life, size, ph, 0, col[0], col[1], col[2], a);
        }
      }
    }
    upload() {
      const mk = (arr) => {
        if (!arr.length) return null;
        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arr), gl.STATIC_DRAW);
        return { buf, count: arr.length / PART_STRIDE };
      };
      return { points: mk(this.points), lines: mk(this.lines) };
    }
  }

  /* ───────── 장면 구성 도우미 ───────── */
  function makeRng(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
  const range = (rng, a, b) => a + rng() * (b - a);

  /** 경기장 발판: 두께, 가장자리 빛, 난간, 아래 기둥 */
  function platform(M, A, o) {
    const W = A.w, H = A.h;
    const th = o.thick || 70;
    const S = A.struct;
    if (S) {
      // 사실적인 구조: 콘크리트(또는 강철·석재) 슬래브와 받침
      const mat = S.style === 'metal' ? { color: S.dark, kind: 6 } : { color: S.conc, kind: 5 };
      M.box([W / 2, -th / 2 - 1, H / 2], [W + 60, th, H + 60], mat);
      if (S.style === 'stone') {
        M.box([W / 2, -th - 140, H / 2], [W + 40, 280, H + 40], { color: S.dark, kind: 5, taper: 0.5 });
        octPrism(M, W / 2, -th - 280, H / 2, Math.min(W, H) * 0.3, 700, 0.06, 0.4, { color: S.dark, kind: 5 });
      } else {
        for (const [x, z] of [[W * 0.15, H * 0.2], [W * 0.85, H * 0.2], [W * 0.15, H * 0.85], [W * 0.85, H * 0.85], [W * 0.5, H * 0.5]]) pier(M, S, x, z, -th - 1, 260, 0, 1, Math.random);
      }
      return;
    }
    M.box([W / 2, -th / 2 - 1, H / 2], [W + 8, th, H + 8], { color: o.side || '#14182a', kind: 4, emit: o.edge, ea: 0.6 });
    // 가장자리 빛 띠
    const e = o.edge || '#5fa8ff';
    M.box([W / 2, -6, H + 5], [W + 10, 6, 4], { color: e, kind: 2, emit: e, ea: 1.1 });
    M.box([W / 2, -6, -5], [W + 10, 6, 4], { color: e, kind: 2, emit: e, ea: 1.1 });
    M.box([-5, -6, H / 2], [4, 6, H + 10], { color: e, kind: 2, emit: e, ea: 1.1 });
    M.box([W + 5, -6, H / 2], [4, 6, H + 10], { color: e, kind: 2, emit: e, ea: 1.1 });
    if (o.rail === true) {
      const rc = o.railColor || '#2a3350';
      const step = 140;
      const post = (x, z) => M.box([x, 16, z], [8, 32, 8], { color: rc });
      for (let x = 0; x <= W; x += step) { post(x, -2); }
      for (let z = 0; z <= H; z += step) { post(-2, z); post(W + 2, z); }
      M.box([W / 2, 33, -2], [W, 3, 3], { color: o.railGlow || e, kind: 2, emit: o.railGlow || e, ea: 0.9 });
      M.box([-2, 33, H / 2], [3, 3, H], { color: o.railGlow || e, kind: 2, emit: o.railGlow || e, ea: 0.9 });
      M.box([W + 2, 33, H / 2], [3, 3, H], { color: o.railGlow || e, kind: 2, emit: o.railGlow || e, ea: 0.9 });
    }
    if (o.pillars !== false) {
      const depth = o.pillarDepth || 2400;
      for (const [x, z] of [[W * 0.15, H * 0.2], [W * 0.85, H * 0.2], [W * 0.15, H * 0.85], [W * 0.85, H * 0.85], [W * 0.5, H * 0.5]]) {
        M.box([x, -th - depth / 2, z], [90, depth, 90], { color: o.side || '#14182a', kind: 4, emit: e, ea: 0.8 });
      }
    }
  }

  /** 도시 빌딩들 — 협곡 구도: 양옆은 높은 벽, 가운데 앞쪽은 낮게(하늘·달이 보이게), 멀리는 스카이라인 */
  function city(M, A, rng, o) {
    const W = A.w, H = A.h;
    const n = Math.round((o.count || 70) * (A.level ? 2.2 : 1));
    const base = o.base != null ? o.base : -1800;
    const placed = [];
    const nearZ = o.nearZ || -1050;
    const farZ = o.farZ || -3600;
    const zone = () => {
      const r = rng();
      const sideGap = o.sideGap != null ? o.sideGap : 560;
      const south = A.level ? A.level.bounds.y1 : H + 400;
      if (r < 0.45) return ['north', range(rng, -2400, W + 2400), range(rng, nearZ, farZ)];
      if (r < 0.72) return ['left', range(rng, -2600, -sideGap), range(rng, -1400, south)];
      return ['right', range(rng, W + sideGap, W + 2600), range(rng, -1400, south)];
    };
    for (let i = 0; i < n; i++) {
      const [where, x, z] = zone();
      const w = range(rng, o.wMin || 110, o.wMax || 260);
      const d = range(rng, o.wMin || 110, o.wMax || 260);
      if (placed.some((p) => Math.abs(p[0] - x) < (p[2] + w) / 2 + 10 && Math.abs(p[1] - z) < (p[3] + d) / 2 + 10)) continue;
      if (o.corridor && where === 'north' && x + w / 2 > o.corridor[0] && x - w / 2 < o.corridor[1]) continue;
      if (blocked(A, x, z, Math.max(w, d) / 2 + 120)) continue;
      placed.push([x, z, w, d]);
      let top = range(rng, o.hMin || 100, o.hMax || 900);
      if (where === 'north') {
        const far = Math.min(1, Math.max(0, (-z - 600) / 3000));
        const centre = Math.abs(x - W / 2) < W * 0.75 ? 1 : 0;
        // 가운데 앞쪽은 낮게 → 하늘이 열린 협곡
        top = top * (o.corridor ? 0.55 + far * 0.7 : centre ? -0.15 + far * 1.0 : 0.6 + far * 0.5);
      } else {
        top = top * (0.9 + rng() * 0.5);
      }
      const hgt = top - base;
      const body = pick(rng, o.body || ['#0e0d22', '#121530', '#0b0c1c']);
      const win = pick(rng, o.win || ['#7aa6ff', '#ff7ad9', '#66e0ff']);
      M.box([x, base + hgt / 2, z], [w, hgt, d], { color: body, kind: 1, emit: win, ea: o.winDensity || range(rng, 0.18, 0.45), rot: o.rotate ? range(rng, -0.3, 0.3) : 0, top: o.roof || '#1a1c33' });
      // 부서진 꼭대기 / 첨탑
      if (o.broken && rng() < 0.45) {
        const bh = range(rng, 40, 160);
        M.box([x + range(rng, -w * 0.2, w * 0.2), top + bh / 2, z + range(rng, -d * 0.2, d * 0.2)], [w * range(rng, 0.3, 0.6), bh, d * range(rng, 0.3, 0.6)], { color: body, kind: 1, emit: win, ea: 0.1, rot: range(rng, -0.3, 0.3) });
      } else if (rng() < 0.5) {
        const sh = range(rng, 60, 260);
        M.box([x, top + sh / 2, z], [w * 0.3, sh, d * 0.3], { color: body, kind: 1, emit: win, ea: 0.25 });
        M.box([x, top + sh + 40, z], [4, 80, 4], { color: '#888', kind: 0 });
        M.box([x, top + sh + 82, z], [8, 8, 8], { color: '#ff2a3a', kind: 2, emit: '#ff2a3a', ea: 2 });
      }
      // 경기장을 향한 면 (북쪽은 +Z, 왼쪽은 +X, 오른쪽은 -X)
      const face = where === 'left' ? { dx: w / 2 + 3, dz: 0, rot: Math.PI / 2, span: d } : where === 'right' ? { dx: -w / 2 - 3, dz: 0, rot: -Math.PI / 2, span: d } : { dx: 0, dz: d / 2 + 3, rot: 0, span: w };
      const neon = pick(rng, o.neon || ['#ff3df0', '#3dd8ff', '#a35bff']);
      if (rng() < (o.neonRate || 0.55)) {
        const off = (rng() < 0.5 ? -1 : 1) * (face.span / 2 - 6);
        const sx = face.rot === 0 ? off : 0;
        const sz = face.rot === 0 ? 0 : off;
        const len = Math.min(hgt * 0.5, 900);
        M.box([x + face.dx + sx, top - len / 2 - 20, z + face.dz + sz], face.rot === 0 ? [6, len, 4] : [4, len, 6], { color: neon, kind: 2, emit: neon, ea: 1.2 });
      }
      if (rng() < 0.5) M.box([x + face.dx * 0.98, top - 6, z + face.dz * 0.98], face.rot === 0 ? [w + 2, 5, 4] : [4, 5, d + 2], { color: neon, kind: 2, emit: neon, ea: 1.1 });
      // 광고판
      if (rng() < (o.billboardRate || 0.35) && top > 40) {
        const bw = Math.min(face.span * 0.85, range(rng, 90, 220));
        const bh = bw * range(rng, 0.6, 1.5);
        const by = Math.max(base + bh, top - bh / 2 - range(rng, 20, 160));
        M.quad([x + face.dx * 1.04, by, z + face.dz * 1.04], bw, bh, { emit: pick(rng, o.neon || ['#ff3df0', '#3dd8ff']), ea: 1, rot: face.rot });
      }
    }
    return placed;
  }

  /**
   * 경기장에서 북쪽의 랜드마크까지 이어지는 길 (도로·다리·회랑)
   * o: { x0, x1, len, lamp(색|null), edge, side, cars, broken(끊어진 조각들), y }
   */
  function road(M, G, R, A, rng, o) {
    const W = A.w;
    const x0 = o.x0 != null ? o.x0 : W * 0.12;
    const x1 = o.x1 != null ? o.x1 : W * 0.88;
    const len = o.len || 5200;
    const edge = o.edge || '#7a5cff';
    const segs = [];
    if (o.broken) {
      let z = -1;
      while (z > -len) {
        const l = range(rng, 380, 900);
        segs.push([z, Math.max(-len, z - l)]);
        z -= l + range(rng, 160, 360);
      }
    } else segs.push([-1, -len]);
    const S = A.struct;
    for (const [za, zb] of segs) {
      const zl = za - zb;
      const zc = (za + zb) / 2;
      if (S) {
        // 고가 도로: 콘크리트 슬래브 + 상자형 거더 + 양쪽 방호벽(또는 난간)
        M.box([(x0 + x1) / 2, -16, zc], [x1 - x0 + 60, 30, zl], S.style === 'metal' ? { color: S.dark, kind: 6 } : { color: S.conc, kind: 5 });
        M.box([(x0 + x1) / 2, -66, zc], [(x1 - x0) * 0.6, 70, zl], { color: S.dark, kind: S.style === 'metal' ? 6 : 5, taper: o.broken ? 0.7 : 1 });
        for (const [ex, sgn] of [[x0, -1], [x1, 1]]) {
          const P = (t, off, dz) => [ex + sgn * off, dz, za - t];
          edgeRun(M, S, P, 0, zl, 0, -1, Math.random);
        }
        for (let z = za - 200; z > zb + 100; z -= 420) pier(M, S, (x0 + x1) / 2, z, -101, x1 - x0, 0, -1, Math.random);
        continue;
      }
      M.box([(x0 + x1) / 2, -45, zc], [x1 - x0 + 20, 90, zl], { color: o.side || '#14142a', kind: 4, emit: edge, ea: 0.6, skipBottom: true, taper: o.broken ? 0.7 : 1 });
      M.box([x0 - 6, 10, zc], [8, 20, zl], { color: edge, kind: 2, emit: edge, ea: 0.9 });
      M.box([x1 + 6, 10, zc], [8, 20, zl], { color: edge, kind: 2, emit: edge, ea: 0.9 });
    }
    if (o.lamp && S) {
      for (let z = -160; z > -len; z -= 360) {
        if (!segs.some(([za, zb]) => z < za - 40 && z > zb + 40)) continue;
        streetLight(M, G, S, x0 - 14, z, 0, 1, 0);
        streetLight(M, G, S, x1 + 14, z - 180, 0, -1, 0);
      }
    } else if (o.lamp) {
      for (let z = -120; z > -len; z -= 320) {
        if (!segs.some(([za, zb]) => z < za && z > zb)) continue;
        for (const [x, dir] of [[x0 - 20, 1], [x1 + 20, -1]]) {
          M.box([x, 85, z], [8, 170, 8], { color: '#2a2a40' });
          M.box([x + dir * 30, 170, z], [64, 6, 8], { color: '#2a2a40' });
          M.box([x + dir * 56, 164, z], [22, 6, 14], { color: o.lamp, kind: 2, emit: o.lamp, ea: 2.2 });
          G.glowFlat([x + dir * 56, 2, z], 110, o.lamp, 0.28, 1);
        }
      }
    }
    if (o.cars) {
      // 오가는 차의 불빛: 한쪽 끝에서 출발해 길을 따라 반복 (경기장 안으로 넘어오지 않음)
      const spd = 420;
      const life = (len - 200) / spd;
      const n = o.cars;
      for (const f of [0.62, 0.8]) R.add({ box: [x0 + (x1 - x0) * f - 6, 12, -len, x0 + (x1 - x0) * f + 6, 14, -len], vel: [0, 0, spd], n, size: 24, color: '#fff4d8', alpha: 1, life }, rng);
      for (const f of [0.2, 0.38]) R.add({ box: [x0 + (x1 - x0) * f - 6, 12, -200, x0 + (x1 - x0) * f + 6, 14, -200], vel: [0, 0, -spd], n, size: 20, color: '#ff3355', alpha: 1, life }, rng);
    }
    return { x0, x1, len, segs };
  }

  /** 하늘을 나는 비행선 */
  function ships(M, rng, o) {
    for (let i = 0; i < (o.n || 5); i++) {
      const cx = range(rng, -800, 2600);
      const cz = range(rng, -2600, -900);
      const cy = range(rng, o.yMin || 200, o.yMax || 700);
      const r = range(rng, 500, 1400);
      const sp = range(rng, 0.03, 0.08) * (rng() < 0.5 ? 1 : -1);
      const anim = [2, sp, r, rng() * 6.28];
      const body = o.body || '#1c2036';
      const L = range(rng, 70, 160);
      M.box([cx, cy, cz], [L, L * 0.22, L * 0.35], { color: body, kind: 4, emit: o.light || '#ff4dd8', ea: 0.8, anim });
      M.box([cx, cy - L * 0.06, cz], [L * 0.6, 3, L * 0.38], { color: o.light || '#ff4dd8', kind: 2, emit: o.light || '#ff4dd8', ea: 1.4, anim });
      M.box([cx, cy, cz], [6, 6, L * 0.5], { color: o.engine || '#66e0ff', kind: 2, emit: o.engine || '#66e0ff', ea: 2.2, anim });
    }
  }

  /** 탐조등 */
  function searchlights(M, rng, o, A) {
    for (let i = 0; i < (o.n || 3); i++) {
      const x = range(rng, -600, A.w + 600);
      const z = range(rng, -1800, -600);
      M.glow([x, o.y || -200, z], 70, 2600, o.color || '#9ad8ff', o.strength || 0.18, 3, { fromBottom: true, tilt: range(rng, 0.25, 0.5), anim: [1, range(rng, 0.15, 0.35) * (rng() < 0.5 ? 1 : -1), 0, rng() * 6.28] });
    }
  }

  function lamps(M, A, color, n) {
    const pts = [];
    const W = A.w, H = A.h;
    const list = [[-40, -40], [W + 40, -40], [-40, H + 40], [W + 40, H + 40], [W / 2, -60], [-60, H / 2], [W + 60, H / 2]].slice(0, n || 7);
    for (const [x, z] of list) {
      M.box([x, 60, z], [10, 120, 10], { color: '#20263a' });
      M.box([x, 124, z], [26, 8, 26], { color, kind: 2, emit: color, ea: 1.6 });
      pts.push([x, z]);
    }
    return pts;
  }

  /** 홀로그램 기둥 (경기장 모서리) */
  function holos(M, A, color) {
    const W = A.w, H = A.h;
    for (const [x, z] of [[-90, 120], [W + 90, 120], [-90, H - 160], [W + 90, H - 160]]) {
      M.box([x, 8, z], [40, 16, 40], { color: '#20263a', kind: 4, emit: color, ea: 0.6 });
    }
  }
  function holoGlows(G, A, color) {
    const W = A.w, H = A.h;
    for (const [x, z] of [[-90, 120], [W + 90, 120], [-90, H - 160], [W + 90, H - 160]]) {
      G.glow([x, 16, z], 50, 220, color, 0.55, 0, { fromBottom: true, cross: true });
    }
  }

  /* ───────── 스테이지 지형 (길·구역·장식) ───────── */
  /** 이 점이 스테이지 길 위나, 카메라와 길 사이(남쪽 그늘)에 있는가 → 건물을 두면 안 됨 */
  function blocked(A, x, z, m) {
    const L = A.level;
    if (!L) return false;
    if (AZ.level.onLevel(L, x, z, m)) return true;
    for (const p of A.levelSamples) {
      if (p[1] < z && z - p[1] < 1500 && Math.abs(p[0] - x) < m + 260) return true;
    }
    return false;
  }
  function levelSamples(L) {
    const pts = [];
    for (const a of L.areas) for (let x = a.x0; x <= a.x1; x += 160) pts.push([x, a.y1]);
    for (const sg of L.segs) for (let i = 0; i <= 6; i++) pts.push([sg.ax + (sg.bx - sg.ax) * (i / 6), sg.ay + (sg.by - sg.ay) * (i / 6)]);
    return pts;
  }

  /** 스테이지 길 둘레에 장식 흩뿌리기 (길과 시야를 가리지 않게) */
  function along(A, rng, n, m, fn) {
    const L = A.level;
    if (!L) return;
    const b = L.bounds;
    for (let i = 0; i < n; i++) {
      const x = range(rng, b.x0 - 1700, b.x1 + 1700);
      const z = range(rng, b.y0 + 300, b.y1 + 200);
      if (blocked(A, x, z, m)) continue;
      fn(x, z, AZ.level.floorZ(L, x, z));
    }
  }

  /* ───────── 사실적인 구조물 ─────────
   * 테마마다 재질이 다릅니다.
   *   road : 고가 도로 — 아스팔트 노면, 콘크리트 슬래브·거더·T자 교각, 저지 방호벽(반사판), 코브라형 가로등, 버려진 차·라바콘
   *   metal: 강철 데크 — 줄무늬 철판, 노란 안전 난간과 발끝막이, I형 보·가새, 투광등, 컨테이너·드럼통
   *   stone: 석재 — 엇갈린 판석, 난간 기둥(발루스터), 떠 있는 바위 받침, 등롱, 부서진 기둥 */
  const STRUCT = {
    ruins: { style: 'road', conc: '#57555e', dark: '#2e2d35', barrier: '#7a7880', pole: '#4a4d56', lamp: '#ffc27a' },
    city: { style: 'road', conc: '#5e5852', dark: '#322d2a', barrier: '#7c766e', pole: '#4c4846', lamp: '#ffb35c' },
    highway: { style: 'road', conc: '#504a4c', dark: '#2a2427', barrier: '#6e6669', pole: '#463c40', lamp: '#ff9a70' },
    warfront: { style: 'road', conc: '#5c544c', dark: '#302a24', barrier: '#7a7268', pole: '#4a443e', lamp: '#ffd08a' },
    lab: { style: 'metal', conc: '#46505a', dark: '#262c34', rail: '#c8a23a', pole: '#3a424c', lamp: '#bff4ff' },
    skyport: { style: 'metal', conc: '#58626e', dark: '#2a303a', rail: '#d0d6de', pole: '#4a525e', lamp: '#e6f2ff' },
    core: { style: 'metal', conc: '#304058', dark: '#18202e', rail: '#6aaee8', pole: '#2a3548', lamp: '#a8dcff' },
    sky: { style: 'stone', conc: '#d8dde6', dark: '#a0aabb', pole: '#c8ccd4', lamp: '#fff0c4' },
    archive: { style: 'stone', conc: '#5e507c', dark: '#30264a', pole: '#4a3e66', lamp: '#e6ccff' },
    void: { style: 'stone', conc: '#4a3e60', dark: '#241c34', pole: '#3a3050', lamp: '#ff9af0', broken: true },
  };
  const PATTERN = { road: { area: 8, seg: 7 }, metal: { area: 9, seg: 9 }, stone: { area: 10, seg: 10 } };
  const rotFor = (ux, uy) => Math.atan2(-uy, ux);

  /** 두 줄(위 4점·아래 4점)로 된 띠 — P(t, 바깥쪽 거리, 높이) 좌표계에서 */
  function strip(M, P, ta, tb, inB, outB, inT, outT, hB, hT, o) {
    M.block([P(ta, inT, hT), P(tb, inT, hT), P(tb, outT, hT), P(ta, outT, hT)], [P(ta, inB, hB), P(tb, inB, hB), P(tb, outB, hB), P(ta, outB, hB)], o);
  }

  /** 가장자리 처리 (방호벽 / 안전 난간 / 석재 난간). P 의 off 는 걷는 곳 가장자리에서 바깥쪽으로 */
  function edgeRun(M, S, P, t0, t1, ux, uy, rng) {
    const L = t1 - t0;
    if (L < 20) return;
    if (S.style === 'road') {
      const n = Math.max(1, Math.round(L / 110));
      const st = L / n;
      for (let i = 0; i < n; i++) {
        const ta = t0 + i * st + 1.5;
        const tb = t0 + (i + 1) * st - 1.5;
        strip(M, P, ta, tb, -1, 25, 4, 20, 0, 13, { color: S.barrier, kind: 5 });
        strip(M, P, ta, tb, 4, 20, 7.5, 16.5, 13, 34, { color: S.barrier, kind: 5 });
        if (i % 2 === 0) M.box(P((ta + tb) / 2, 5.4, 25), [9, 4, 2], { color: '#ffb000', kind: 2, emit: '#ffb03a', ea: 0.8, rot: rotFor(ux, uy) });
      }
    } else if (S.style === 'metal') {
      strip(M, P, t0, t1, 0, 4, 0, 4, 0, 9, { color: '#222222', kind: 7 });
      const n = Math.max(1, Math.round(L / 70));
      for (let i = 0; i <= n; i++) M.box(P(t0 + (L * i) / n, 6, 24), [5, 48, 5], { color: S.rail, kind: 6 });
      M.beam(P(t0, 6, 48), P(t1, 6, 48), 5, { color: S.rail, kind: 6 });
      M.beam(P(t0, 6, 28), P(t1, 6, 28), 4, { color: S.rail, kind: 6 });
    } else {
      const pieces = S.broken ? Math.max(1, Math.round(L / 120)) : 1;
      for (let k = 0; k < pieces; k++) {
        if (S.broken && rng() < 0.3) continue;
        const ta = t0 + (L * k) / pieces + (S.broken ? 3 : 0);
        const tb = t0 + (L * (k + 1)) / pieces - (S.broken ? 3 : 0);
        strip(M, P, ta, tb, -2, 22, -2, 22, 0, 9, { color: S.dark, kind: 5 });
        strip(M, P, ta, tb, -4, 24, -4, 24, 36, 44, { color: S.conc, kind: 5 });
        const nb = Math.max(1, Math.round((tb - ta) / 24));
        for (let i = 0; i < nb; i++) M.box(P(ta + ((tb - ta) * (i + 0.5)) / nb, 10, 22.5), [7, 27, 7], { color: S.conc, kind: 5, taper: 1.35 });
      }
    }
  }

  /** 가로등 — (x, y) 기둥 자리, (ix, iy) 길 안쪽 방향 */
  function streetLight(M, G, S, x, y, z, ix, iy) {
    if (S.style === 'road') {
      const H = 240;
      M.box([x, z + H / 2, y], [9, H, 9], { color: S.pole, kind: 6 });
      M.box([x, z + 7, y], [17, 14, 17], { color: S.pole, kind: 6 });
      const ex = x + ix * 78;
      const ey = y + iy * 78;
      M.beam([x, z + H - 8, y], [ex, z + H + 6, ey], 6, { color: S.pole, kind: 6 });
      M.box([ex + ix * 8, z + H + 4, ey + iy * 8], [36, 9, 16], { color: S.pole, kind: 6, rot: rotFor(ix, iy) });
      M.box([ex + ix * 8, z + H - 1, ey + iy * 8], [28, 3, 12], { color: S.lamp, kind: 2, emit: S.lamp, ea: 1.8, rot: rotFor(ix, iy) });
      G.glowFlat([ex + ix * 14, z + 2.5, ey + iy * 14], 170, S.lamp, 0.2, 1);
      G.glow([ex + ix * 8, z + H - 2, ey + iy * 8], 46, 46, S.lamp, 0.55, 1);
    } else if (S.style === 'metal') {
      const H = 170;
      M.box([x, z + H / 2, y], [10, H, 10], { color: S.pole, kind: 6 });
      M.box([x + ix * 10, z + H, y + iy * 10], [26, 16, 22], { color: S.pole, kind: 6, rot: rotFor(ix, iy) });
      M.box([x + ix * 23, z + H - 2, y + iy * 23], [3, 12, 18], { color: S.lamp, kind: 2, emit: S.lamp, ea: 1.8, rot: rotFor(ix, iy) });
      G.glowFlat([x + ix * 90, z + 2.5, y + iy * 90], 150, S.lamp, 0.18, 1);
      G.glow([x + ix * 23, z + H, y + iy * 23], 40, 40, S.lamp, 0.5, 1);
    } else {
      const H = 110;
      M.box([x, z + H / 2, y], [14, H, 14], { color: S.dark, kind: 5, taper: 1.3 });
      M.box([x, z + H + 12, y], [18, 22, 18], { color: S.lamp, kind: 2, emit: S.lamp, ea: 1.3 });
      M.box([x, z + H + 26, y], [26, 5, 26], { color: S.dark, kind: 5 });
      G.glowFlat([x, z + 2.5, y], 130, S.lamp, 0.18, 1);
      G.glow([x, z + H + 12, y], 60, 60, S.lamp, 0.45, 1);
    }
  }

  /** 교각 — (x, y) 위치, top: 데크 아랫면 높이, across: 데크 폭, (ux, uy): 데크 방향 */
  function pier(M, S, x, y, top, across, ux, uy, rng) {
    const ax = -uy;
    const ay = ux;
    if (S.style === 'road') {
      M.box([x, top - 16, y], [across * 0.86, 32, 46], { color: S.conc, kind: 5, rot: rotFor(ax, ay), taper: 0.8 });
      octPrism(M, x, top - 32, y, 30, 2600, 1.06, 0, { color: S.conc, kind: 5 });
    } else if (S.style === 'metal') {
      const cols = [-1, 1].map((sg) => [x + ax * sg * across * 0.3, y + ay * sg * across * 0.3]);
      for (const [px, py] of cols) M.box([px, top - 1300, py], [28, 2600, 28], { color: S.dark, kind: 6 });
      M.box([x, top - 14, y], [across * 0.78, 28, 24], { color: S.dark, kind: 6, rot: rotFor(ax, ay) });
      for (let k = 0; k < 3; k++) {
        const z0 = top - 40 - k * 260;
        M.beam([cols[0][0], z0, cols[0][1]], [cols[1][0], z0 - 240, cols[1][1]], 7, { color: S.dark, kind: 6 });
        M.beam([cols[1][0], z0, cols[1][1]], [cols[0][0], z0 - 240, cols[0][1]], 7, { color: S.dark, kind: 6 });
      }
    } else {
      octPrism(M, x, top, y, across * 0.3, 420 + rng() * 260, 0.1, rng() * 3, { color: S.dark, kind: 5 });
    }
  }

  /* 소품 */
  function car(M, G, x, y, z, ux, uy, rng, wreck) {
    const col = wreck ? '#2a2522' : pick(rng, ['#7a2020', '#203a6a', '#c8c8c8', '#262628', '#b08a30', '#3a5a3a', '#5a5a62']);
    const r = rotFor(ux, uy);
    const nx = -uy;
    const ny = ux;
    const at = (f, s2, h) => [x + ux * f + nx * s2, z + h, y + uy * f + ny * s2];
    M.box(at(0, 0, 17), [92, 20, 40], { color: col, kind: 6, rot: r });
    M.box(at(-6, 0, 35), [50, 16, 36], { color: '#0a0e14', kind: 9, rot: r });
    M.box(at(-6, 0, 44), [44, 3, 34], { color: col, kind: 6, rot: r });
    for (const f of [-30, 30]) for (const s2 of [-20, 20]) M.box(at(f, s2, 8), [17, 16, 6], { color: '#101012', rot: r });
    if (!wreck) {
      for (const s2 of [-14, 14]) M.box(at(-46.5, s2, 20), [2, 5, 8], { color: '#ff2030', kind: 2, emit: '#ff2030', ea: rng() < 0.5 ? 1.2 : 0.3, rot: r });
      if (rng() < 0.35) for (const s2 of [-14, 14]) M.box(at(46.5, s2, 20), [2, 5, 8], { color: '#fff0c8', kind: 2, emit: '#fff0c8', ea: 1.0, rot: r });
    } else if (rng() < 0.5) {
      G.glow(at(10, 0, 30), 60, 70, '#ff7a2a', 0.45, 0, { fromBottom: true, cross: true });
    }
  }
  function cone(M, x, y, z) {
    M.box([x, z + 1, y], [16, 2, 16], { color: '#141414' });
    M.box([x, z + 15, y], [5, 26, 5], { color: '#ff6a1a', taper: 3 });
    M.box([x, z + 15, y], [9, 4, 9], { color: '#e8e8e8' });
  }
  function jerseyUnit(M, S, x, y, z, ux, uy, len) {
    const nx = -uy;
    const ny = ux;
    const P = (t, off, dz) => [x + ux * (t - len / 2) + nx * (off - 12), z + dz, y + uy * (t - len / 2) + ny * (off - 12)];
    strip(M, P, 0, len, -1, 25, 4, 20, 0, 13, { color: S.barrier || S.conc, kind: 5 });
    strip(M, P, 0, len, 4, 20, 7.5, 16.5, 13, 34, { color: S.barrier || S.conc, kind: 5 });
  }
  function signPost(M, x, y, z, color) {
    M.box([x, z + 70, y], [5, 140, 5], { color: '#5a5e66', kind: 6 });
    M.quad([x, z + 140, y + 3], 70, 40, { color: color || '#1f6a3c', kind: 8, emit: '#ffffff', ea: 0.3 });
  }
  function rubble(M, S, x, y, z, rng, n) {
    for (let i = 0; i < (n || 5); i++) {
      const s2 = range(rng, 8, 26);
      M.box([x + range(rng, -40, 40), z + s2 * 0.35, y + range(rng, -30, 30)], [s2 * 1.4, s2 * 0.8, s2], { color: S.conc, kind: 5, rot: rng() * 3, taper: 1.2 });
    }
  }
  function crateStack(M, S, x, y, z, rng) {
    const col = pick(rng, ['#2a4a6a', '#6a3a1a', '#3a5a3a', '#5a5a60', '#6a5a20']);
    const r = rng() * 0.5;
    M.box([x, z + 22, y], [60, 44, 44], { color: col, kind: 6, rot: r });
    if (rng() < 0.6) M.box([x + 6, z + 62, y - 4], [44, 36, 36], { color: pick(rng, ['#2a4a6a', '#5a5a60', '#6a3a1a']), kind: 6, rot: r + 0.3 });
  }
  function barrels(M, x, y, z, rng) {
    for (let i = 0; i < 3; i++) {
      const col = pick(rng, ['#b08a20', '#2a4a8a', '#7a3a20', '#3a3e44']);
      octPrism(M, x + (i % 2) * 26 - 13, z + 36, y + Math.floor(i / 2) * 24, 12, 36, 1, rng(), { color: col, kind: 6 });
    }
  }
  function console2(M, x, y, z, glow) {
    M.box([x, z + 22, y], [44, 44, 26], { color: '#2a3038', kind: 6 });
    M.quad([x, z + 34, y + 13.5], 36, 18, { emit: glow, ea: 1 });
  }
  function brokenColumn(M, S, x, y, z, rng) {
    const h = range(rng, 40, 170);
    octPrism(M, x, z + h, y, 20, h, 1.1, rng(), { color: S.conc, kind: 5 });
    M.box([x, z + 6, y], [52, 12, 52], { color: S.dark, kind: 5 });
  }

  /** 구역 둘레 가장자리를 따라 장식 위치 고르기 (가운데 길과 입구는 피함) */
  function edgeSpots(a, L, rng, n) {
    const out = [];
    for (let k = 0; k < n * 6 && out.length < n; k++) {
      const side = Math.floor(rng() * 4);
      const inset = range(rng, 40, 100);
      let x;
      let y;
      let ux = 1;
      let uy = 0;
      if (side === 0) { x = range(rng, a.x0 + 80, a.x1 - 80); y = a.y0 + inset; } else if (side === 1) { x = range(rng, a.x0 + 80, a.x1 - 80); y = a.y1 - inset; } else if (side === 2) { x = a.x0 + inset; y = range(rng, a.y0 + 80, a.y1 - 80); ux = 0; uy = 1; } else { x = a.x1 - inset; y = range(rng, a.y0 + 80, a.y1 - 80); ux = 0; uy = 1; }
      const nearSeg = L.segs.some((sg) => AZ.level.segProj(sg, x, y).d < sg.w / 2 + 70);
      if (nearSeg || out.some((q) => Math.hypot(q.x - x, q.y - y) < 120)) continue;
      out.push({ x, y, ux, uy, side });
    }
    return out;
  }

  function levelGeometry(M, G, R, A, rng, cfg) {
    const L = A.level;
    const S = STRUCT[A.theme] || STRUCT.ruins;
    const pat = PATTERN[S.style];
    const floors = [];
    const slabMat = S.style === 'metal' ? { color: S.dark, kind: 6 } : { color: S.conc, kind: 5 };
    const segOpen = (x, y, pad, skip) => L.segs.some((sg) => sg !== skip && AZ.level.segProj(sg, x, y).d < sg.w / 2 + pad);
    const areaOpen = (x, y, pad, skip) => L.areas.some((q) => q !== skip && AZ.level.inArea(q, x, y, -pad));
    /** 직선 위에서 막혀야 할 구간 */
    const runs = (ax, ay, ux, uy, len, isOpen) => {
      const out = [];
      const n = Math.max(2, Math.ceil(len / 12));
      let st = null;
      for (let i = 0; i <= n; i++) {
        const t = (len * i) / n;
        const o = isOpen(ax + ux * t, ay + uy * t);
        if (!o && st == null) st = t;
        if ((o || i === n) && st != null) { const e = o ? t - len / n : t; if (e - st > 24) out.push([st, e]); st = null; }
      }
      return out;
    };

    // ── 구역: 슬래브, 거더, 교각, 가장자리, 가로등 ──
    for (const a of L.areas) {
      const w = a.x1 - a.x0;
      const h = a.y1 - a.y0;
      const cx = a.x0 + w / 2;
      const cy = a.y0 + h / 2;
      const boss = a.kind === 'boss';
      if (!boss) {
        M.box([cx, a.z - 21, cy], [w + 60, 40, h + 60], Object.assign({ skipBottom: S.style === 'stone' }, slabMat));
        if (S.style === 'road') {
          for (const f of [0.18, 0.5, 0.82]) M.box([a.x0 + w * f, a.z - 76, cy], [54, 70, h + 20], { color: S.dark, kind: 5 });
        } else if (S.style === 'metal') {
          for (let f = 0.1; f < 0.95; f += 0.2) M.box([a.x0 + w * f, a.z - 71, cy], [16, 60, h + 30], { color: S.dark, kind: 6 });
          for (let f = 0.15; f < 0.95; f += 0.35) M.box([cx, a.z - 56, a.y0 + h * f], [w + 30, 30, 12], { color: S.dark, kind: 6 });
        } else {
          M.box([cx, a.z - 41 - 90, cy], [w + 50, 180, h + 50], { color: S.dark, kind: 5, taper: 0.55 });
          octPrism(M, cx, a.z - 220, cy, Math.min(w, h) * 0.32, 520, 0.08, rng() * 3, { color: S.dark, kind: 5 });
        }
        if (S.style !== 'stone') {
          const nx2 = Math.max(1, Math.round(w / 460));
          const ny2 = Math.max(1, Math.round(h / 460));
          for (let i = 0; i <= nx2; i++) for (let j = 0; j <= ny2; j++) {
            if ((i > 0 && i < nx2) && (j > 0 && j < ny2)) continue;
            const px = a.x0 + 90 + ((w - 180) * i) / nx2;
            const py = a.y0 + 90 + ((h - 180) * j) / ny2;
            pier(M, S, px, py, a.z - 111, 160, 0, 1, rng);
          }
        }
        floors.push({ kind: 'area', area: a, frame: [a.x0, a.y0, 0, 1], size: [w, h], y: a.z, pattern: pat.area });
      }
      // 가장자리 (구간마다 길이 들어오는 곳은 비움)
      const edges = [
        [a.x0, a.y0, 1, 0, w, 0, -1], [a.x1, a.y1, -1, 0, w, 0, 1], [a.x0, a.y1, 0, -1, h, -1, 0], [a.x1, a.y0, 0, 1, h, 1, 0],
      ];
      for (const [ex, ey, ux, uy, len, onx, ony] of edges) {
        const open = (x, y) => segOpen(x + onx * 12, y + ony * 12, 30) || areaOpen(x + onx * 12, y + ony * 12, 24, a);
        const P = (t, off, dz) => [ex + ux * t + onx * off, a.z + dz, ey + uy * t + ony * off];
        for (const [t0, t1] of runs(ex, ey, ux, uy, len, open)) {
          edgeRun(M, S, P, t0, t1, ux, uy, rng);
          if (!boss && ony !== 1) {
            const nl = Math.floor((t1 - t0) / 380);
            for (let k = 0; k <= nl; k++) {
              if (nl === 0 && t1 - t0 < 200) break;
              const t = t0 + 40 + (k * (t1 - t0 - 80)) / Math.max(1, nl);
              const [lx, , ly] = P(t, 14, 0);
              streetLight(M, G, S, lx, ly, a.z, -onx, -ony);
            }
          }
        }
      }
    }

    // ── 길 (경사로 포함): 노면, 슬래브, 거더, 교각, 가장자리, 가로등 ──
    let longest = null;
    L.segs.forEach((sg, i) => {
      const dx = sg.bx - sg.ax;
      const dy = sg.by - sg.ay;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len;
      const uy = dy / len;
      const nx = uy;
      const ny = -ux;
      const hw = sg.w / 2;
      const ext = hw;
      const off = -0.6 - i * 0.03;
      const zf = (t) => sg.az + (sg.bz - sg.az) * Math.max(0, Math.min(1, t / len)) + off;
      const P = (t, o2, dz) => [sg.ax + ux * t + nx * o2, zf(t) + dz, sg.ay + uy * t + ny * o2];
      const W2 = hw + 30;
      const pieces = sg.az === sg.bz ? [[-ext, len + ext]] : [[-ext, 0], [0, len], [len, len + ext]];
      for (const [ta, tb] of pieces) {
        floors.push({ kind: 'seg', frame: [sg.ax - ux * ext - nx * W2, sg.ay - uy * ext - ny * W2, ux, uy], size: [W2 * 2, len + ext * 2], quad: [P(ta, -W2, 0), P(tb, -W2, 0), P(tb, W2, 0), P(ta, W2, 0)], pattern: pat.seg });
        strip(M, P, ta, tb, -W2, W2, -W2, W2, -31, -1, slabMat);
        if (S.style === 'road') strip(M, P, ta, tb, -hw * 0.62, hw * 0.62, -hw * 0.7, hw * 0.7, -100, -31, { color: S.dark, kind: 5 });
        else if (S.style === 'metal') for (const sgn of [-1, 1]) strip(M, P, ta, tb, sgn * hw * 0.5 - 6, sgn * hw * 0.5 + 6, sgn * hw * 0.5 - 6, sgn * hw * 0.5 + 6, -90, -31, { color: S.dark, kind: 6 });
        else strip(M, P, ta, tb, -hw * 0.45, hw * 0.45, -W2, W2, -120, -31, { color: S.dark, kind: 5 });
      }
      // 교각 (구역 위가 아닌 곳)
      const np = Math.max(1, Math.round(len / 400));
      for (let k = 0; k < np; k++) {
        const t = (len * (k + 0.5)) / np;
        const [px, pz, py] = P(t, 0, 0);
        if (areaOpen(px, py, 40)) continue;
        pier(M, S, px, py, pz - (S.style === 'stone' ? 100 : 100), W2 * 2, ux, uy, rng);
      }
      // 가장자리
      for (const sgn of [1, -1]) {
        const ex0 = sg.ax - ux * ext + nx * sgn * hw;
        const ey0 = sg.ay - uy * ext + ny * sgn * hw;
        const open = (x, y) => areaOpen(x + nx * sgn * 12, y + ny * sgn * 12, 30) || segOpen(x + nx * sgn * 12, y + ny * sgn * 12, 4, sg);
        const Ps = (t, o2, dz) => P(t - ext, sgn * (hw + o2), dz);
        const rs = runs(ex0, ey0, ux, uy, len + ext * 2, open);
        for (const [t0, t1] of rs) {
          edgeRun(M, S, Ps, t0, t1, ux, uy, rng);
          const nl = ny * sgn > 0.5 ? 0 : Math.floor((t1 - t0) / 360);
          for (let k = 0; k < nl; k++) {
            if ((k + i) % 2) continue;
            const t = t0 + 180 + k * 360;
            const [lx, lz, ly] = Ps(t, 14, 0);
            streetLight(M, G, S, lx, ly, lz, -nx * sgn, -ny * sgn);
          }
        }
      }
      if (sg.az === sg.bz && !sg.branch && (!longest || len > longest.len)) longest = { sg, len, ux, uy, nx, ny, hw, P };
    });

    // ── 길 위의 표지 구조물 (가장 긴 길 가운데) ──
    if (longest && S.style !== 'stone') {
      const { len, nx, ny, hw, P } = longest;
      const t = len * 0.5;
      const [lx, lz, ly] = P(t, -(hw + 22), 0);
      const [rx, , ry] = P(t, hw + 22, 0);
      const H = S.style === 'road' ? 250 : 200;
      M.box([lx, lz + H / 2, ly], [14, H, 14], { color: S.pole, kind: 6 });
      M.box([rx, lz + H / 2, ry], [14, H, 14], { color: S.pole, kind: 6 });
      M.beam([lx, lz + H, ly], [rx, lz + H, ry], 18, { color: S.pole, kind: 6 });
      M.beam([lx, lz + H - 24, ly], [rx, lz + H - 24, ry], 8, { color: S.pole, kind: 6 });
      const mx = (lx + rx) / 2;
      const my = (ly + ry) / 2;
      if (S.style === 'road') {
        M.quad([mx - nx * hw * 0.45, lz + H - 12, my - ny * hw * 0.45 + 12], hw * 0.8, 70, { color: '#1f6a3c', kind: 8, emit: '#ffffff', ea: 0.3 });
        M.quad([mx + nx * hw * 0.45, lz + H - 12, my + ny * hw * 0.45 + 12], hw * 0.8, 70, { color: '#1f4a8a', kind: 8, emit: '#ffffff', ea: 0.3 });
      } else {
        M.box([mx, lz + H - 12, my], [hw * 1.4, 22, 10], { color: '#222222', kind: 7 });
      }
    }

    // ── 구역 장식 ──
    const byId = {};
    for (const a of L.areas) byId[a.id] = a;
    for (const a of L.areas) {
      if (a.kind === 'boss' || a.id === 'checkpoint') continue;
      const n = a.id === 'explore' ? 9 : a.id === 'start' ? 5 : a.id === 'story' || a.id === 'treasure' ? 3 : 5;
      for (const sp of edgeSpots(a, L, rng, n)) {
        const z = a.z;
        const roll = rng();
        if (S.style === 'road') {
          if (roll < 0.34) car(M, G, sp.x, sp.y, z, sp.ux * (rng() < 0.5 ? 1 : -1) + range(rng, -0.25, 0.25), sp.uy + range(rng, -0.25, 0.25), rng, a.kind === 'fight' && rng() < 0.6);
          else if (roll < 0.58) for (let k = 0; k < 4; k++) cone(M, sp.x + sp.ux * k * 34, sp.y + sp.uy * k * 34, z);
          else if (roll < 0.76) jerseyUnit(M, S, sp.x, sp.y, z, sp.ux + range(rng, -0.4, 0.4), sp.uy + range(rng, -0.4, 0.4), 100);
          else if (roll < 0.9) rubble(M, S, sp.x, sp.y, z, rng, 6);
          else if (sp.side !== 1) signPost(M, sp.x, sp.y, z, rng() < 0.5 ? '#1f6a3c' : '#1f4a8a');
          else cone(M, sp.x, sp.y, z);
        } else if (S.style === 'metal') {
          if (roll < 0.4) crateStack(M, S, sp.x, sp.y, z, rng);
          else if (roll < 0.65) barrels(M, sp.x, sp.y, z, rng);
          else if (roll < 0.85) console2(M, sp.x, sp.y, z, S.lamp);
          else rubble(M, S, sp.x, sp.y, z, rng, 4);
        } else {
          if (roll < 0.5) brokenColumn(M, S, sp.x, sp.y, z, rng);
          else if (roll < 0.75) rubble(M, S, sp.x, sp.y, z, rng, 6);
          else {
            M.box([sp.x, z + 14, sp.y], [64, 28, 64], { color: S.dark, kind: 5 });
            G.glow([sp.x, z + 28, sp.y], 70, 60, A.theme === 'sky' ? '#bfffd8' : cfg.floor.edge, 0.35, 1);
          }
        }
      }
    }

    // ── 특별한 장소 ──
    for (const pr of L.props) {
      if (pr.kind === 'beacon') {
        const a = byId[pr.area];
        M.box([pr.x, a.z + 18, pr.y], [70, 36, 70], { color: S.dark, kind: S.style === 'metal' ? 6 : 5 });
        M.box([pr.x, a.z + 40, pr.y], [40, 8, 40], { color: '#7cf7d4', kind: 2, emit: '#7cf7d4', ea: 1.3 });
        G.glow([pr.x, a.z + 40, pr.y], 70, 900, '#7cf7d4', 0.6, 0, { fromBottom: true, cross: true });
        M.ring([pr.x, a.z + 3, pr.y], 120, 6, 'y', 24, { color: '#7cf7d4', kind: 2, emit: '#7cf7d4', ea: 1.0, anim: [1, 0.5, 0, 0] });
      } else if (pr.kind === 'labRoom') {
        const a = byId[pr.area];
        const w = a.x1 - a.x0;
        const h = a.y1 - a.y0;
        const wall = S.style === 'metal' ? { color: S.conc, kind: 6 } : { color: S.conc, kind: 5 };
        M.box([a.x0 + w / 2, a.z + 80, a.y0 - 8], [w, 160, 16], wall);
        for (let i = 0; i < 3; i++) M.box([a.x0 + w * (0.25 + i * 0.25), a.z + 92, a.y0 + 0.5], [w * 0.18, 46, 2], { color: '#0a1018', kind: 9 });
        M.box([a.x0 - 8, a.z + 60, a.y0 + h * 0.35], [16, 120, h * 0.7], wall);
        M.box([a.x1 + 8, a.z + 60, a.y0 + h * 0.35], [16, 120, h * 0.7], wall);
        M.box([a.x0 + w / 2, a.z + 163, a.y0 - 8], [w + 20, 8, 22], { color: '#222222', kind: 7 });
        for (let i = 0; i < 4; i++) {
          const x = a.x0 + 90 + i * ((w - 180) / 3);
          M.box([x, a.z + 46, a.y0 + 40], [50, 92, 40], { color: '#2a323c', kind: 6 });
          octPrism(M, x, a.z + 110, a.y0 + 40, 16, 18, 1, 0, { color: '#66e0ff', kind: 2, emit: '#66e0ff', ea: 1.2 });
          M.quad([x, a.z + 60, a.y0 + 60.5], 34, 24, { emit: '#66e0ff', ea: 1 });
        }
      } else if (pr.kind === 'chest') {
        const t = L.areas.find((q) => q.kind === 'treasure');
        M.box([pr.x, t.z + 18, pr.y], [66, 36, 42], { color: '#3a3428', kind: 6 });
        M.box([pr.x, t.z + 39, pr.y], [68, 8, 44], { color: '#4a4232', kind: 6 });
        M.box([pr.x, t.z + 26, pr.y + 21.5], [40, 3, 1], { color: '#ffe066', kind: 2, emit: '#ffe066', ea: 1.4 });
        G.glow([pr.x, t.z + 5, pr.y], 120, 240, '#ffe066', 0.35, 0, { fromBottom: true, cross: true });
      } else if (pr.kind === 'gate') {
        const a = byId[pr.area];
        const cx = (a.x0 + a.x1) / 2;
        const y = a.y0 + 30;
        const H = 300;
        M.box([a.x0 + 50, a.z + H / 2, y], [40, H, 40], { color: S.style === 'stone' ? S.conc : S.pole, kind: S.style === 'stone' ? 5 : 6 });
        M.box([a.x1 - 50, a.z + H / 2, y], [40, H, 40], { color: S.style === 'stone' ? S.conc : S.pole, kind: S.style === 'stone' ? 5 : 6 });
        M.box([cx, a.z + H, y], [a.x1 - a.x0 - 60, 34, 34], { color: S.style === 'stone' ? S.conc : S.pole, kind: S.style === 'stone' ? 5 : 6 });
        if (S.style === 'road') {
          M.quad([cx - 160, a.z + H - 50, y + 18], 260, 80, { color: '#1f6a3c', kind: 8, emit: '#ffffff', ea: 0.3 });
          M.quad([cx + 160, a.z + H - 50, y + 18], 260, 80, { color: '#1f4a8a', kind: 8, emit: '#ffffff', ea: 0.3 });
        } else if (S.style === 'metal') {
          M.box([cx, a.z + H - 30, y + 18], [a.x1 - a.x0 - 120, 20, 4], { color: '#222222', kind: 7 });
        }
      }
    }
    // 관문 단말기와 관문 기둥
    const gate = (L.objects || []).find((o) => o.kind === 'gate');
    if (gate && L.gate) {
      const fin = L.areas.find((q) => q.id === 'final');
      M.box([gate.x, fin.z + 45, gate.y], [44, 90, 30], { color: '#2a2e36', kind: 6 });
      M.quad([gate.x, fin.z + 72, gate.y + 15.5], 34, 22, { emit: '#ff5470', ea: 1 });
      for (const x of [L.gate.x0 + 30, L.gate.x1 - 30]) {
        M.box([x, fin.z + 150, L.gate.y], [44, 300, 44], { color: '#3a3e46', kind: 6 });
        for (let k = 0; k < 3; k++) M.box([x, fin.z + 40 + k * 100, L.gate.y], [46, 18, 46], { color: '#222222', kind: 7 });
        M.box([x, fin.z + 306, L.gate.y], [24, 12, 24], { color: '#ff3355', kind: 2, emit: '#ff3355', ea: 2.2 });
      }
    }
    // 보스 무대를 비추는 조명탑 (북쪽·양옆)
    const aw = A.w;
    const ah = A.h;
    for (let i = 0; i < 6; i++) {
      const ang = Math.PI + ((i + 0.5) / 6) * Math.PI;
      const x = aw / 2 + Math.cos(ang) * aw * 0.64;
      const z = ah / 2 + Math.sin(ang) * ah * 0.74;
      if (z > ah * 0.75) continue;
      const ix = (aw / 2 - x);
      const iy = (ah / 2 - z);
      const im = Math.hypot(ix, iy) || 1;
      if (S.style === 'stone') {
        octPrism(M, x, 560, z, 34, 1500, 1.6, 0.3, { color: S.conc, kind: 5 });
        M.box([x, 600, z], [30, 80, 30], { color: S.lamp, kind: 2, emit: S.lamp, ea: 1.6, taper: 2 });
        G.glow([x, 600, z + 5], 160, 160, S.lamp, 0.35, 1);
      } else {
        M.box([x, -200, z], [46, 1600, 46], { color: S.pole, kind: 6, taper: 2.2 });
        M.box([x + (ix / im) * 20, 610, z + (iy / im) * 20], [120, 70, 18], { color: S.pole, kind: 6, rot: rotFor(-iy / im, ix / im) });
        for (let k = 0; k < 4; k++) M.box([x + (ix / im) * 30 + (-iy / im) * (k - 1.5) * 26, 610, z + (iy / im) * 30 + (ix / im) * (k - 1.5) * 26], [20, 50, 4], { color: '#fff6e0', kind: 2, emit: '#fff6e0', ea: 1.6, rot: rotFor(-iy / im, ix / im) });
        G.glow([x + (ix / im) * 34, 610, z + (iy / im) * 34], 200, 120, '#fff2d8', 0.35, 1);
        M.box([x, 660, z], [10, 10, 10], { color: '#ff3355', kind: 2, emit: '#ff3355', ea: 2.2 });
      }
    }
    return floors;
  }

  /* ───────── 맵별 구성 ─────────
   * build(M: 불투명 메시, G: 빛(더하기) 메시, R: 입자, A: {w,h}, rng) → 설정 객체
   */
  const BUILDERS = {
    /* 1장 네온 폐허 도시 — 도시 한가운데를 지나는 고가 도로 위의 전투 */
    ruins(M, G, R, A, rng) {
      const W = A.w, H = A.h;
      platform(M, A, { side: '#151530', edge: '#7a5cff', rail: false, pillarDepth: 2600 });
      const rd = road(M, G, R, A, rng, { x0: W * 0.12, x1: W * 0.88, len: 5600, lamp: '#c9a4ff', edge: '#7a5cff', cars: 24 });
      city(M, A, rng, { count: 130, base: -2200, hMin: 120, hMax: 1300, broken: true, neon: ['#ff3df0', '#3dd8ff', '#a35bff', '#5f7bff'], billboardRate: 0.55, corridor: [rd.x0 - 140, rd.x1 + 140], farZ: -5200, sideGap: 520 });
      // 아래를 가로지르는 또 다른 고가도로
      const yb = -420;
      M.box([W / 2, yb, -1500], [W + 6000, 30, 110], { color: '#1a1a38', kind: 4, emit: '#ff3df0', ea: 0.9 });
      M.box([W / 2, yb + 20, -1446], [W + 6000, 5, 4], { color: '#ff3df0', kind: 2, emit: '#ff3df0', ea: 1.4 });
      M.box([W / 2, yb + 20, -1554], [W + 6000, 5, 4], { color: '#3dd8ff', kind: 2, emit: '#3dd8ff', ea: 1.4 });
      for (let x = -2900; x < W + 3000; x += 420) M.box([x, (yb - 2200) / 2, -1500], [50, yb + 2200, 50], { color: '#16163a', kind: 4 });
      // 하늘의 거대 구조물(고리)
      M.ring([W * 0.5, 1700, -7600], 1700, 70, 'z', 48, { color: '#2a2a55', kind: 4, emit: '#9a7aff', ea: 1.0 });
      M.ring([W * 0.5, 1700, -7600], 1350, 30, 'z', 48, { color: '#2a2a55', kind: 2, emit: '#ff3df0', ea: 0.8, anim: [6, 0.03, 0, 0] });
      G.glow([W * 0.5, 1700, -7550], 4200, 4200, '#7a5cff', 0.1, 1);
      ships(M, rng, { n: 8, light: '#ff4dd8', engine: '#66e0ff', yMin: 250, yMax: 900 });
      searchlights(G, rng, { n: 5, color: '#9ab8ff', y: -600 }, A);
      holos(M, A, '#3dd8ff');
      holoGlows(G, A, '#3dd8ff');
      R.add({ box: [-900, -200, -2600, W + 900, 1100, H + 300], vel: [-40, -900, 0], n: 1100, size: 1, color: '#9ab8ff', alpha: 0.35, lines: true, life: 1.5 }, rng);
      if (A.level) R.add({ box: [A.level.bounds.x0 - 700, -900, A.level.bounds.y0, A.level.bounds.x1 + 700, 600, A.level.bounds.y1], vel: [-40, -900, 0], n: 2200, size: 1, color: '#9ab8ff', alpha: 0.35, lines: true, life: 1.5 }, rng);
      R.add({ box: [-1600, -2000, -4000, W + 1600, -100, -200], vel: [0, 60, 0], n: 160, size: 26, color: '#ff3df0', alpha: 0.35, life: 10 }, rng);
      return {
        sky: { top: '#03030c', mid: '#160c36', bot: '#4a2580', stars: 1, moon: [0.8, 0.84, 0.12, 0], moonCol: '#d0dcff', fx: 1, fxA: '#5a3aa0', fxB: '#2a4aa0', fxAmt: 1 },
        fog: '#342066', fogDen: 0.00017, abyss: '#4a1d8a', abyssY: -400,
        light: { dir: [0.3, 0.8, 0.5], key: '#5560a0', amb: '#2a2a50' },
        floor: { a: '#2c2850', b: '#181530', grid: '#7a68ff', gridA: 0, edge: '#9a7aff', pattern: 5, wet: 1.15, neon: ['#ff3df0', '#3dd8ff', '#a35bff'] },
        abyssFloor: { mode: 1, a: '#140c30', y: -2200, neon: ['#ff3df0', '#3dd8ff', '#ffb35c'] },
        roadFloor: rd,
        lights: [[W * 0.12, H * 0.3, 260, 0.3, '#c9a4ff'], [W * 0.88, H * 0.3, 260, 0.3, '#c9a4ff'], [W * 0.12, H * 0.75, 260, 0.3, '#c9a4ff'], [W * 0.88, H * 0.75, 260, 0.3, '#c9a4ff'], [W * 0.5, -150, 500, 0.2, '#ff3df0']],
      };
    },

    /* 2장 붕괴된 도심 */
    city(M, G, R, A, rng) {
      const W = A.w;
      platform(M, A, { side: '#1d1a22', edge: '#ff9b3d' });
      const rd = road(M, G, R, A, rng, { x0: W * 0.15, x1: W * 0.85, len: 4800, lamp: '#ffb35c', edge: '#ff9b3d', side: '#1d1a22', cars: 5 });
      const placed = city(M, A, rng, { count: 110, base: -1800, hMin: 80, hMax: 900, broken: true, rotate: true, body: ['#16141c', '#1c1820', '#121018'], win: ['#ffb35c', '#ffd8a0', '#66e0ff'], winDensity: 0.12, neon: ['#ff9b3d', '#66e0ff'], neonRate: 0.25, billboardRate: 0.15, corridor: [rd.x0 - 140, rd.x1 + 140], farZ: -4600 });
      // 도로 위 부서진 차
      for (let i = 0; i < 9; i++) {
        const x = range(rng, rd.x0 + 40, rd.x1 - 40);
        const z = range(rng, -rd.len * 0.8, -200);
        M.box([x, 20, z], [64, 40, 130], { color: '#1a1416', kind: 4, emit: '#ff7a2a', ea: 0.5, rot: range(rng, -0.6, 0.6) });
        if (rng() < 0.5) G.glow([x, 20, z + 70], 120, 160, '#ff7a2a', 0.45, 1);
      }
      // 불타는 곳과 연기
      for (let i = 0; i < 12; i++) {
        const p = pick(rng, placed);
        if (!p) break;
        G.glow([p[0], range(rng, -600, 300), p[1] + p[3] / 2 + 10], range(rng, 160, 320), range(rng, 200, 400), '#ff7a2a', 0.5, 1);
        R.add({ box: [p[0] - 40, 0, p[1] - 40, p[0] + 40, 600, p[1] + 40], vel: [20, 120, 0], n: 18, size: 260, color: '#3a3038', alpha: 0.5, life: 8 }, rng);
        R.add({ box: [p[0] - 60, -400, p[1] - 40, p[0] + 60, 200, p[1] + 40], vel: [0, 140, 0], n: 20, size: 14, color: '#ffb35c', alpha: 0.9, life: 3 }, rng);
      }
      ships(M, rng, { n: 3, light: '#ffb35c', engine: '#66e0ff', yMin: 300, yMax: 700 });
      searchlights(G, rng, { n: 3, color: '#ffd8a0', strength: 0.12 }, A);
      const L = lamps(M, A, '#ffb35c');
      R.add({ box: [-600, -100, -1500, A.w + 600, 900, A.h + 300], vel: [60, -60, 0], n: 300, size: 6, color: '#c8b8a8', alpha: 0.5, life: 8 }, rng);
      return {
        sky: { top: '#0c0a14', mid: '#3a2a3a', bot: '#a0583a', stars: 0.2, moon: [0.22, 0.84, 0.07, 0], moonCol: '#ffd8b0', fx: 4, fxA: '#4a3c48', fxB: '#ff9a5a', fxAmt: 1 },
        fog: '#4a3438', fogDen: 0.00034, abyss: '#7a3a20', abyssY: -200,
        light: { dir: [-0.4, 0.7, 0.5], key: '#a07050', amb: '#30282e' },
        floor: { a: '#302a2c', b: '#181416', grid: '#ffb35c', gridA: 0, edge: '#ff9b3d', pattern: 5, wet: 0.55, neon: ['#ff9b3d', '#66e0ff', '#ffd8a0'] },
        abyssFloor: { mode: 1, a: '#1c1010', y: -1800, neon: ['#ff7a2a', '#ffb35c', '#66e0ff'] },
        roadFloor: rd,
        lights: L.map(([x, z]) => [x, z, 240, 0.3, '#ffb35c']),
      };
    },

    /* 3장 지하 에너지 연구소 */
    lab(M, G, R, A, rng) {
      platform(M, A, { side: '#101c24', edge: '#5ff7e0', pillars: false, thick: 30 });
      const W = A.w, H = A.h;
      const rd = road(M, G, R, A, rng, { x0: W * 0.32, x1: W * 0.68, len: 780, edge: '#5ff7e0', side: '#101c24' });
      // 벽과 천장 구조
      M.box([W / 2, 500, -1500], [W + 4000, 1600, 60], { color: '#0e1c26', kind: 4, emit: '#5ff7e0', ea: 0.5 });
      M.box([-1300, 500, H / 2 - 400], [60, 1600, H + 2400], { color: '#0e1c26', kind: 4, emit: '#5ff7e0', ea: 0.5 });
      M.box([W + 1300, 500, H / 2 - 400], [60, 1600, H + 2400], { color: '#0e1c26', kind: 4, emit: '#5ff7e0', ea: 0.5 });
      // 거대한 에너지 코어
      const cx = W / 2, cz = -1050;
      M.box([cx, 60, cz], [520, 120, 520], { color: '#13222e', kind: 4, emit: '#66e0ff', ea: 0.9 });
      for (let i = 0; i < 3; i++) M.ring([cx, 260 + i * 240, cz], 300 - i * 30, 26, 'y', 28, { color: '#1a2c3a', kind: 2, emit: '#66e0ff', ea: 1.2, anim: [1, 0.3 * (i % 2 ? 1 : -1), 0, 0] });
      G.glow([cx, 120, cz + 10], 380, 1500, '#66e0ff', 0.9, 0, { fromBottom: true, cross: true });
      G.glow([cx, 120, cz + 10], 140, 1500, '#e8ffff', 0.9, 0, { fromBottom: true, cross: true });
      G.glow([cx, 600, cz - 20], 1800, 1800, '#2a9ad8', 0.25, 1);
      // 기계 장치와 모니터
      for (let i = 0; i < 26; i++) {
        const side = rng() < 0.5 ? -1 : 1;
        const x = side < 0 ? range(rng, -1250, -180) : range(rng, W + 180, W + 1250);
        const z = range(rng, -1400, H - 100);
        const h = range(rng, 80, 420);
        M.box([x, h / 2, z], [range(rng, 80, 220), h, range(rng, 80, 220)], { color: '#142430', kind: 4, emit: pick(rng, ['#5ff7e0', '#66e0ff', '#ff5470']), ea: 0.8 });
      }
      for (let i = 0; i < 14; i++) {
        const x = range(rng, -1100, W + 1100);
        if (x > cx - 450 && x < cx + 450) continue;
        M.quad([x, range(rng, 250, 650), -1465], range(rng, 160, 280), range(rng, 100, 170), { emit: pick(rng, ['#5ff7e0', '#66e0ff', '#9ad8ff']), ea: 1 });
      }
      // 파이프
      for (let i = 0; i < 6; i++) M.box([W / 2, range(rng, 700, 1100), range(rng, -1400, -300)], [W + 3000, 30, 30], { color: '#1c2a34', kind: 4 });
      // 레이저 방어 장치
      for (let i = 0; i < 4; i++) G.glow([range(rng, -900, W + 900), 300, -1300], 14, 1600, '#ff3355', 0.55, 2, { rot: 0, anim: [6, range(rng, 0.3, 0.6), 0, rng() * 6] });
      R.add({ box: [-900, 0, -1400, W + 900, 900, H], vel: [0, 30, 0], n: 260, size: 10, color: '#66e0ff', alpha: 0.6, life: 9 }, rng);
      along(A, rng, 90, 160, (x, z, fz) => {
        const h = range(rng, 200, 900);
        M.box([x, fz - 600 + h / 2, z], [range(rng, 90, 240), h, range(rng, 90, 240)], { color: '#132430', kind: 4, emit: pick(rng, ['#5ff7e0', '#66e0ff', '#ff5470']), ea: 0.9 });
        if (rng() < 0.3) G.glow([x, fz - 600, z + 2], 60, h + 200, '#66e0ff', 0.35, 0, { fromBottom: true });
      });
      if (A.level) R.add({ box: [A.level.bounds.x0 - 1200, -900, A.level.bounds.y0, A.level.bounds.x1 + 1200, 300, A.level.bounds.y1], vel: [0, 60, 0], n: 300, size: 10, color: '#66e0ff', alpha: 0.6, life: 12 }, rng);
      return {
        sky: { top: '#020a10', mid: '#06161e', bot: '#0b2a32', stars: 0, moon: [0, 0, 0, 0], moonCol: '#000000', fx: 5, fxA: '#5ff7e0', fxB: '#000000', fxAmt: 1 },
        fog: '#08202a', fogDen: 0.00034, abyss: '#08202a', abyssY: -400,
        light: { dir: [0, 1, 0.4], key: '#3a6a78', amb: '#14303a' },
        floor: { a: '#1a2e34', b: '#0c181c', grid: '#5ff7e0', gridA: 0.18, edge: '#5ff7e0', pattern: 1, wet: 0.45, neon: ['#66e0ff', '#5ff7e0', '#9ad8ff'] },
        abyssFloor: { mode: 1, a: '#06181e', y: -1700, neon: ['#5ff7e0', '#66e0ff', '#9ad8ff'] },
        roadFloor: rd,
        lights: [[W / 2, -200, 900, 0.45, '#66e0ff'], [-200, H / 2, 400, 0.2, '#5ff7e0'], [W + 200, H / 2, 400, 0.2, '#5ff7e0']],
      };
    },

    /* 4장 기계 요새 */
    highway(M, G, R, A, rng) {
      platform(M, A, { side: '#22121a', edge: '#ff3355' });
      const W = A.w;
      const rd = road(M, G, R, A, rng, { x0: W * 0.3, x1: W * 0.7, len: 2120, lamp: '#ff3355', edge: '#ff3355', side: '#22121a' });
      // 거대한 요새
      const fx = W / 2, fz = -2400;
      M.box([fx, -200, fz], [2200, 1800, 500], { color: '#1a0e14', kind: 4, emit: '#ff2a3a', ea: 1.1 });
      M.box([fx, 900, fz], [900, 1400, 400], { color: '#1e1016', kind: 4, emit: '#ff2a3a', ea: 1.0, taper: 1.3 });
      for (const dx of [-900, -500, 500, 900]) M.box([fx + dx, 700, fz + 60], [160, 1500, 160], { color: '#1c0e14', kind: 4, emit: '#ff2a3a', ea: 0.9, taper: 1.6 });
      for (const dx of [-900, -500, 500, 900]) M.box([fx + dx, 1500, fz + 60], [40, 300, 40], { color: '#1c0e14', kind: 4, taper: 3 });
      M.box([fx, 300, fz + 210], [26, 1700, 10], { color: '#ff2a3a', kind: 2, emit: '#ff2a3a', ea: 2 });
      M.box([fx, 1150, fz + 212], [240, 26, 10], { color: '#ff2a3a', kind: 2, emit: '#ff2a3a', ea: 2 });
      M.ring([fx, 1150, fz + 215], 110, 16, 'z', 24, { color: '#ff2a3a', kind: 2, emit: '#ff2a3a', ea: 2 });
      G.glow([fx, -500, fz + 230], 300, 2000, '#ff2a3a', 0.7, 0, { fromBottom: true });
      G.glow([fx, 1150, fz + 240], 900, 900, '#ff2a3a', 0.35, 1);
      // 기계 벽과 포탑
      city(M, A, rng, { count: 70, base: -1800, hMin: 100, hMax: 700, body: ['#1a0e14', '#140a10', '#200f16'], win: ['#ff3355', '#ff7a3d'], winDensity: 0.1, neon: ['#ff2a3a', '#ff7a3d'], neonRate: 0.4, billboardRate: 0.05, farZ: -2000, corridor: [W * 0.1, W * 0.9] });
      for (let i = 0; i < 8; i++) {
        const x = range(rng, -1400, W + 1400);
        const z = range(rng, -1900, -700);
        M.box([x, 200, z], [120, 80, 120], { color: '#24121a', kind: 4, emit: '#ff3355', ea: 1.4 });
        M.beam([x, 230, z], [x + range(rng, -80, 80), 330, z + 160], 26, { color: '#2a161e', kind: 4 });
      }
      // 떠 있는 함선
      for (let i = 0; i < 4; i++) {
        const x = range(rng, -800, W + 800), y = range(rng, 700, 1300), z = range(rng, -3200, -1500);
        M.box([x, y, z], [range(rng, 300, 600), 90, 160], { color: '#1a0c12', kind: 4, emit: '#ff3355', ea: 1.4, taper: 0.5, anim: [3, 0.4, 40, rng() * 6] });
      }
      const L = lamps(M, A, '#ff3355');
      R.add({ box: [-800, -1200, -2500, W + 800, 600, A.h], vel: [0, 160, 0], n: 300, size: 12, color: '#ff5a3a', alpha: 0.8, life: 6 }, rng);
      return {
        sky: { top: '#12020a', mid: '#4a0a24', bot: '#c0306a', stars: 0.3, moon: [0.82, 0.84, 0.1, 0], moonCol: '#ff8aa0', fx: 1, fxA: '#a01a4a', fxB: '#ff5a3a', fxAmt: 1 },
        fog: '#4a1028', fogDen: 0.0003, abyss: '#7a0c24', abyssY: -300,
        light: { dir: [0.2, 0.8, 0.6], key: '#a04050', amb: '#301018' },
        floor: { a: '#2e1e24', b: '#160c10', grid: '#ff3355', gridA: 0.05, edge: '#ff3355', pattern: 1, wet: 0.6, neon: ['#ff3355', '#ff7a3d', '#ff2a3a'] },
        roadFloor: rd,
        abyssFloor: { mode: 1, a: '#1c060c', y: -1800, neon: ['#ff2a3a', '#ff7a3d', '#ff3355'] },
        lights: L.map(([x, z]) => [x, z, 260, 0.35, '#ff3355']),
      };
    },

    /* 5장 천공 도시 */
    sky(M, G, R, A, rng) {
      platform(M, A, { side: '#cfd8e8', edge: '#9ad8ff', pillarDepth: 900 });
      const W = A.w, H = A.h;
      const rd = road(M, G, R, A, rng, { x0: W * 0.38, x1: W * 0.62, len: 2420, lamp: '#ffe9a8', edge: '#ffe9a8', side: '#e8ecf4' });
      // 떠 있는 섬들
      for (let i = 0; i < 16; i++) {
        const x = range(rng, -2600, W + 2600);
        const z = range(rng, -4200, -700);
        if (x > -300 && x < W + 300 && z > -900) continue;
        const r = range(rng, 200, 520);
        const y = range(rng, -500, 500);
        const anim = [3, range(rng, 0.15, 0.3), range(rng, 10, 30), rng() * 6];
        M.box([x, y - r * 0.45, z], [r * 2, r * 0.9, r * 1.6], { color: '#8a7a6a', kind: 0, taper: 0.15, anim, top: '#5a8a5a' });
        // 흰 탑들
        const tn = 2 + Math.floor(rng() * 5);
        for (let t = 0; t < tn; t++) {
          const th = range(rng, 120, 700);
          const tx = x + range(rng, -r * 0.7, r * 0.7), tz = z + range(rng, -r * 0.5, r * 0.5);
          M.box([tx, y + th / 2, tz], [range(rng, 40, 110), th, range(rng, 40, 110)], { color: '#e8ecf4', kind: 1, emit: '#9ad8ff', ea: 0.3, anim, taper: 1.2 });
          M.box([tx, y + th + 40, tz], [20, 80, 20], { color: '#ffe9a8', kind: 0, taper: 4, anim });
        }
      }
      // 공중 다리
      M.box([W + 600, -20, H * 0.3], [1400, 22, 70], { color: '#e8ecf4', kind: 4, emit: '#ffe9a8', ea: 0.6 });
      M.box([-700, -20, H * 0.6], [1400, 22, 70], { color: '#e8ecf4', kind: 4, emit: '#ffe9a8', ea: 0.6 });
      // 중앙 거대 성
      const cx = W * 0.55, cz = -3000;
      M.box([cx, -200, cz], [1400, 500, 1100], { color: '#8a7a6a', kind: 0, taper: 0.2, top: '#6a8a6a' });
      for (let t = 0; t < 12; t++) {
        const th = t === 0 ? 2000 : range(rng, 300, 1200);
        const tx = cx + (t === 0 ? 0 : range(rng, -550, 550)), tz = cz + (t === 0 ? 0 : range(rng, -400, 400));
        M.box([tx, 50 + th / 2, tz], [t === 0 ? 180 : range(rng, 60, 140), th, t === 0 ? 180 : range(rng, 60, 140)], { color: '#eef0f6', kind: 1, emit: '#9ad8ff', ea: 0.35, taper: 1.4 });
        M.box([tx, 50 + th + 80, tz], [30, 160, 30], { color: '#ffe9a8', kind: 0, taper: 6 });
      }
      ships(M, rng, { n: 4, body: '#e8ecf4', light: '#ffe9a8', engine: '#9ad8ff', yMin: 100, yMax: 700 });
      along(A, rng, 26, 420, (x, z, fz) => {
        const r = range(rng, 160, 380);
        const y = fz + range(rng, -500, 100);
        const anim = [3, range(rng, 0.15, 0.3), range(rng, 10, 30), rng() * 6];
        M.box([x, y - r * 0.45, z], [r * 2, r * 0.9, r * 1.6], { color: '#8a7a6a', kind: 0, taper: 0.15, anim, top: '#5a8a5a' });
        for (let t = 0; t < 3; t++) {
          const th = range(rng, 100, 500);
          M.box([x + range(rng, -r * 0.6, r * 0.6), y + th / 2, z + range(rng, -r * 0.4, r * 0.4)], [range(rng, 40, 90), th, range(rng, 40, 90)], { color: '#eef0f6', kind: 1, emit: '#9ad8ff', ea: 0.3, anim, taper: 1.2 });
        }
      });
      R.add({ box: [-1500, -900, -3000, W + 1500, -300, H + 600], vel: [30, 0, 0], n: 90, size: 900, color: '#ffffff', alpha: 0.18, life: 30 }, rng);
      R.add({ box: [-600, 0, -1200, W + 600, 700, H], vel: [20, 10, 0], n: 120, size: 6, color: '#ffffff', alpha: 0.7, life: 8 }, rng);
      return {
        sky: { top: '#2a6ad8', mid: '#7ab4f0', bot: '#dcefff', stars: 0, moon: [0, 0, 0, 0], moonCol: '#000000', fx: 4, fxA: '#ffffff', fxB: '#fff4d0', fxAmt: 1 },
        fog: '#b8d8f4', fogDen: 0.0002, abyss: '#e8f4ff', abyssY: -400,
        light: { dir: [-0.5, 0.8, 0.4], key: '#fff0d8', amb: '#7a90b0' },
        floor: { a: '#c8d0dc', b: '#9aa6b8', grid: '#5a8ad8', gridA: 0.06, edge: '#5ab4ff', pattern: 2, wet: 0.15, neon: ['#9ad8ff', '#ffe9a8', '#ffffff'] },
        roadFloor: rd,
        abyssFloor: { mode: 2, a: '#ffffff', b: '#a8c8ec', y: -1100 },
        lights: [[W / 2, H / 2, 900, 0.12, '#fff4d0']],
      };
    },

    /* 6장 기억 공간 */
    archive(M, G, R, A, rng) {
      platform(M, A, { side: '#1a1236', edge: '#c9a4ff', pillars: false, thick: 50 });
      const W = A.w, H = A.h;
      const rd = road(M, G, R, A, rng, { x0: W * 0.38, x1: W * 0.62, len: 1250, edge: '#ff7ad9', side: '#1a1236' });
      // 빛의 고리 문
      const cx = W / 2, cz = -1500;
      for (let i = 0; i < 5; i++) {
        M.ring([cx, 500, cz - i * 260], 520 + i * 160, 18, 'z', 40, { color: '#c9a4ff', kind: 2, emit: i % 2 ? '#ff7ad9' : '#c9a4ff', ea: 1.4, anim: [6, (i % 2 ? 1 : -1) * 0.15, 0, i] });
      }
      G.glow([cx, 500, cz - 300], 1600, 1600, '#c9a4ff', 0.4, 1);
      G.glow([cx, 500, cz - 320], 500, 500, '#ffffff', 0.6, 1);
      // 떠다니는 파편
      for (let i = 0; i < 70; i++) {
        const x = range(rng, -2200, W + 2200);
        const z = range(rng, -3200, H + 200);
        if (x > -200 && x < W + 200 && z > -300) continue;
        const s = range(rng, 30, 180);
        M.box([x, range(rng, -900, 900), z], [s, s * range(rng, 0.3, 1.5), s * range(rng, 0.3, 1.2)], { color: '#2a1e4a', kind: 4, emit: pick(rng, ['#c9a4ff', '#ff7ad9', '#7ce8ff']), ea: 1.0, anim: [4, range(rng, 0.1, 0.4), range(rng, 20, 80), rng() * 6] });
      }
      // 기억의 화면
      for (let i = 0; i < 12; i++) {
        M.quad([range(rng, -1600, W + 1600), range(rng, 100, 800), range(rng, -2400, -500)], range(rng, 140, 260), range(rng, 90, 160), { emit: pick(rng, ['#c9a4ff', '#ff7ad9', '#9ad8ff']), ea: 0.9, anim: [3, range(rng, 0.2, 0.5), 30, rng() * 6] });
      }
      // 다리 아래로 흩어지는 빛의 계단
      for (let i = 0; i < 10; i++) M.box([cx + (i % 2 ? 700 : -700), -200 - i * 90, -200 - i * 140], [260, 14, 90], { color: '#c9a4ff', kind: 2, emit: '#c9a4ff', ea: 0.7, anim: [3, 0.3, 20, i] });
      R.add({ box: [-1500, -1000, -2500, W + 1500, 1200, H + 400], vel: [0, 40, 0], n: 600, size: 8, color: '#e2d4ff', alpha: 0.7, life: 12 }, rng);
      along(A, rng, 110, 160, (x, z, fz) => {
        const sz = range(rng, 30, 200);
        M.box([x, fz + range(rng, -600, 700), z], [sz, sz * range(rng, 0.3, 1.5), sz * range(rng, 0.3, 1.2)], { color: '#2a1e4a', kind: 4, emit: pick(rng, ['#c9a4ff', '#ff7ad9', '#7ce8ff']), ea: 1.0, anim: [4, range(rng, 0.1, 0.4), range(rng, 20, 80), rng() * 6] });
        if (rng() < 0.15) M.quad([x, fz + range(rng, 100, 500), z], range(rng, 120, 220), range(rng, 80, 140), { emit: pick(rng, ['#c9a4ff', '#ff7ad9']), ea: 0.9, anim: [3, 0.3, 30, rng() * 6] });
      });
      if (A.level) R.add({ box: [A.level.bounds.x0 - 1200, -1000, A.level.bounds.y0, A.level.bounds.x1 + 1200, 800, A.level.bounds.y1], vel: [0, 40, 0], n: 500, size: 8, color: '#e2d4ff', alpha: 0.7, life: 12 }, rng);
      return {
        sky: { top: '#05020e', mid: '#1c0a3a', bot: '#4a1f7a', stars: 0.8, moon: [0, 0, 0, 0], moonCol: '#000000', fx: 1, fxA: '#a35bff', fxB: '#ff7ad9', fxAmt: 1.3 },
        fog: '#2a1450', fogDen: 0.00028, abyss: '#5a2a9a', abyssY: -200,
        light: { dir: [0.2, 0.9, 0.4], key: '#6a50a0', amb: '#2a1e48' },
        floor: { a: '#30245a', b: '#160e2e', grid: '#c9a4ff', gridA: 0.05, edge: '#c9a4ff', pattern: 4, wet: 0.7, neon: ['#c9a4ff', '#ff7ad9', '#7ce8ff'] },
        roadFloor: rd,
        lights: [[W / 2, -100, 1000, 0.4, '#c9a4ff']],
      };
    },

    /* 7장 궤도 우주 정거장 */
    skyport(M, G, R, A, rng) {
      platform(M, A, { side: '#1c2230', edge: '#ffb35c', pillars: false, thick: 40 });
      const W = A.w, H = A.h;
      const rd = road(M, G, R, A, rng, { x0: W * 0.25, x1: W * 0.75, len: 1550, lamp: '#ffb35c', edge: '#ffb35c', side: '#1c2230' });
      // 거대한 유리창 틀 (아치)
      const fz = -1700;
      for (let i = -3; i <= 3; i++) {
        const x = W / 2 + i * 700;
        M.beam([x, -400, fz], [x + i * 120, 1600, fz - 300], 70, { color: '#3a4458', kind: 4, emit: '#9ad8ff', ea: 0.6 });
      }
      M.beam([-2000, 1500, fz - 280], [W + 2000, 1500, fz - 280], 80, { color: '#3a4458', kind: 4, emit: '#9ad8ff', ea: 0.6 });
      M.beam([-2000, 300, fz - 40], [W + 2000, 300, fz - 40], 50, { color: '#3a4458', kind: 4 });
      // 정거장 고리와 골조
      M.ring([W / 2 + 900, 900, -3200], 900, 70, 'z', 36, { color: '#4a5468', kind: 4, emit: '#9ad8ff', ea: 1.0, anim: [6, 0.05, 0, 0] });
      M.box([W / 2 + 900, 900, -3200], [180, 180, 180], { color: '#4a5468', kind: 4, emit: '#66e0ff', ea: 1.6 });
      G.glow([W / 2 + 900, 900, -3150], 500, 500, '#66e0ff', 0.6, 1);
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2;
        M.beam([W / 2 + 900, 900, -3200], [W / 2 + 900 + Math.cos(a) * 900, 900 + Math.sin(a) * 900, -3200], 40, { color: '#4a5468', kind: 4, anim: [0, 0, 0, 0] });
      }
      // 옆 데크와 격납고
      for (let i = 0; i < 18; i++) {
        const side = rng() < 0.5 ? -1 : 1;
        const x = side < 0 ? range(rng, -1300, -200) : range(rng, W + 200, W + 1300);
        const z = range(rng, -1500, H);
        const h = range(rng, 40, 300);
        M.box([x, h / 2 - 40, z], [range(rng, 120, 300), h, range(rng, 120, 300)], { color: '#2a3244', kind: 4, emit: pick(rng, ['#ffb35c', '#9ad8ff']), ea: 0.8 });
      }
      // 떠다니는 잔해
      for (let i = 0; i < 30; i++) {
        const s = range(rng, 20, 90);
        M.box([range(rng, -2000, W + 2000), range(rng, -600, 1200), range(rng, -3000, -900)], [s, s * 0.6, s * 0.8], { color: '#3a4458', kind: 4, anim: [4, range(rng, 0.1, 0.3), 40, rng() * 6] });
      }
      ships(M, rng, { n: 4, body: '#3a4458', light: '#ffb35c', engine: '#66e0ff', yMin: 300, yMax: 1000 });
      along(A, rng, 70, 220, (x, z, fz) => {
        const h = range(rng, 200, 900);
        M.box([x, fz - 300 + h / 2, z], [range(rng, 120, 360), h, range(rng, 120, 360)], { color: '#2a3244', kind: 4, emit: pick(rng, ['#ffb35c', '#9ad8ff']), ea: 0.8 });
        if (rng() < 0.4) M.beam([x, fz + h - 300, z], [x + range(rng, -400, 400), fz + h - 200, z + range(rng, -300, 300)], 30, { color: '#3a4458', kind: 4 });
      });
      R.add({ box: [-1500, -800, -2500, W + 1500, 1200, H], vel: [10, 5, 0], n: 200, size: 5, color: '#ffffff', alpha: 0.6, life: 20 }, rng);
      const L = lamps(M, A, '#ffb35c', 4);
      return {
        sky: { top: '#000004', mid: '#040818', bot: '#0a1430', stars: 1.4, moon: [0, 0, 0, 0], moonCol: '#000000', fx: 3, fxA: '#3a7ad8', fxB: '#7ab8ff', fxAmt: 1 },
        fog: '#0a1428', fogDen: 0.00016, abyss: '#0a1830', abyssY: -800,
        light: { dir: [0.6, 0.5, 0.6], key: '#a0b8e0', amb: '#1c2438' },
        floor: { a: '#303a4c', b: '#182030', grid: '#ffb35c', gridA: 0.06, edge: '#ffb35c', pattern: 1, wet: 0.35, neon: ['#9ad8ff', '#ffb35c', '#66e0ff'] },
        roadFloor: rd,
        lights: L.map(([x, z]) => [x, z, 260, 0.3, '#ffb35c']),
        pad: true,
      };
    },

    /* 8장 최후의 방어선 */
    warfront(M, G, R, A, rng) {
      platform(M, A, { side: '#1e1a1e', edge: '#7ce8ff' });
      const W = A.w;
      const rd = road(M, G, R, A, rng, { x0: W * 0.15, x1: W * 0.85, len: 4400, lamp: '#7ce8ff', edge: '#7ce8ff', side: '#1e1a1e' });
      city(M, A, rng, { count: 110, base: -1800, hMin: 100, hMax: 1000, broken: true, body: ['#16141a', '#1c1820', '#121016'], win: ['#ffd8a0', '#7ce8ff'], winDensity: 0.22, neon: ['#7ce8ff', '#ffb35c'], neonRate: 0.35, billboardRate: 0.1, corridor: [rd.x0 - 140, rd.x1 + 140], farZ: -4400 });
      // 바리케이드
      for (let i = 0; i < 7; i++) {
        const z = -300 - i * 520;
        for (const f of [0.25, 0.5, 0.75]) if (rng() < 0.6) M.box([rd.x0 + (rd.x1 - rd.x0) * f + range(rng, -60, 60), 22, z], [160, 44, 36], { color: '#2a2628', kind: 4, emit: '#ffb35c', ea: 0.9, rot: range(rng, -0.3, 0.3) });
      }
      // 도시를 감싼 방어막 (돔)
      const dc = [W / 2, -600, -3600];
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI;
        M.ring([dc[0], dc[1], dc[2]], 2600, 14, 'z', 40, { color: '#7ce8ff', kind: 2, emit: '#7ce8ff', ea: 0.5, anim: [7, 0, 0, a] });
      }
      G.glow([dc[0], 600, dc[2] + 200], 5200, 2800, '#4ab8ff', 0.14, 1);
      // 대공 포화
      for (let i = 0; i < 6; i++) G.glow([range(rng, -1500, W + 1500), -500, range(rng, -2600, -900)], 18, 3000, pick(rng, ['#ffb35c', '#7ce8ff']), 0.45, 0, { fromBottom: true, tilt: range(rng, -0.4, 0.4), anim: [1, range(rng, 0.2, 0.5), 0, rng() * 6] });
      ships(M, rng, { n: 6, body: '#1a1a22', light: '#ff3355', engine: '#ffb35c', yMin: 400, yMax: 1100 });
      const L = lamps(M, A, '#7ce8ff');
      R.add({ box: [-800, -1200, -2600, W + 800, 800, A.h], vel: [30, 150, 0], n: 360, size: 12, color: '#ffb35c', alpha: 0.8, life: 6 }, rng);
      R.add({ box: [-600, 0, -1200, W + 600, 900, A.h], vel: [40, -40, 0], n: 200, size: 6, color: '#c0b8b0', alpha: 0.5, life: 10 }, rng);
      return {
        sky: { top: '#0a0408', mid: '#3a1410', bot: '#c0501a', stars: 0.2, moon: [0.8, 0.85, 0.11, 0], moonCol: '#ffb070', fx: 4, fxA: '#3a2420', fxB: '#ff8a3a', fxAmt: 1 },
        fog: '#4a2418', fogDen: 0.0003, abyss: '#8a3a14', abyssY: -200,
        light: { dir: [0.4, 0.7, 0.5], key: '#a06040', amb: '#2c1e1e' },
        floor: { a: '#322c2a', b: '#181412', grid: '#7ce8ff', gridA: 0, edge: '#7ce8ff', pattern: 5, wet: 0.5, neon: ['#ffb35c', '#7ce8ff', '#ff7a3d'] },
        roadFloor: rd,
        abyssFloor: { mode: 1, a: '#1c0c08', y: -1600, neon: ['#ff7a3d', '#ffb35c', '#7ce8ff'] },
        lights: L.map(([x, z]) => [x, z, 240, 0.28, '#7ce8ff']),
        explosions: true,
      };
    },

    /* 9장 ASTRA 코어 */
    core(M, G, R, A, rng) {
      platform(M, A, { side: '#0e1a2e', edge: '#66e0ff', pillarDepth: 1800 });
      const W = A.w, H = A.h;
      const rd = road(M, G, R, A, rng, { x0: W * 0.3, x1: W * 0.7, len: 1650, lamp: '#9ad8ff', edge: '#66e0ff', side: '#0e1a2e' });
      // 코어 탑
      const cx = W / 2, cz = -2300;
      M.box([cx, -400, cz], [1200, 1600, 1200], { color: '#0e1c34', kind: 4, emit: '#66e0ff', ea: 1.2, taper: 1.4 });
      M.box([cx, 1200, cz], [520, 2000, 520], { color: '#12223e', kind: 4, emit: '#9ad8ff', ea: 1.2, taper: 1.8 });
      M.box([cx, 2600, cz], [160, 1000, 160], { color: '#12223e', kind: 4, emit: '#ffffff', ea: 1.4, taper: 3 });
      for (let i = 0; i < 4; i++) M.ring([cx, 500 + i * 450, cz], 700 - i * 100, 22, 'y', 40, { color: '#66e0ff', kind: 2, emit: '#9ad8ff', ea: 1.4, anim: [1, (i % 2 ? 1 : -1) * 0.25, 0, 0] });
      G.glow([cx, -800, cz + 20], 300, 6000, '#9ad8ff', 0.8, 0, { fromBottom: true, cross: true });
      G.glow([cx, -800, cz + 20], 90, 6000, '#ffffff', 1.0, 0, { fromBottom: true, cross: true });
      G.glow([cx, 1400, cz - 50], 3400, 3400, '#3a8ad8', 0.22, 1);
      // 데이터 블록 건물
      city(M, A, rng, { count: 80, base: -1600, hMin: 100, hMax: 900, body: ['#0c1830', '#0e1c38', '#0a142a'], win: ['#66e0ff', '#9ad8ff'], winDensity: 0.4, neon: ['#66e0ff', '#ffffff'], neonRate: 0.5, billboardRate: 0.15, farZ: -3200, corridor: [W * 0.05, W * 0.95] });
      R.add({ box: [-1500, -1600, -2600, W + 1500, 200, H], vel: [0, 260, 0], n: 700, size: 8, color: '#9ad8ff', alpha: 0.8, life: 7 }, rng);
      R.add({ box: [-1500, -1600, -2600, W + 1500, 400, H], vel: [0, 500, 0], n: 300, size: 1, color: '#66e0ff', alpha: 0.5, lines: true, life: 4 }, rng);
      return {
        sky: { top: '#01030a', mid: '#061630', bot: '#0e3a6a', stars: 0.8, moon: [0, 0, 0, 0], moonCol: '#000000', fx: 1, fxA: '#2a6ad8', fxB: '#66e0ff', fxAmt: 0.8 },
        fog: '#0a2244', fogDen: 0.00026, abyss: '#14508a', abyssY: -300,
        light: { dir: [0, 1, 0.3], key: '#4a7ab0', amb: '#122440' },
        floor: { a: '#16294a', b: '#0a1830', grid: '#66e0ff', gridA: 0.06, edge: '#66e0ff', pattern: 3, wet: 0.6, neon: ['#66e0ff', '#9ad8ff', '#ffffff'] },
        roadFloor: rd,
        abyssFloor: { mode: 1, a: '#06142a', y: -1600, neon: ['#66e0ff', '#9ad8ff', '#ffffff'] },
        lights: [[W / 2, -300, 1100, 0.4, '#9ad8ff']],
      };
    },

    /* 10장 붕괴한 차원 */
    void(M, G, R, A, rng) {
      platform(M, A, { side: '#1a1438', edge: '#bfe6ff', pillars: false, thick: 120 });
      const W = A.w, H = A.h;
      const rd = road(M, G, R, A, rng, { x0: W * 0.3, x1: W * 0.7, len: 3800, edge: '#c9a4ff', side: '#1a1438', broken: true });
      // 떠다니는 거대 파편과 부서진 건물
      for (let i = 0; i < 45; i++) {
        const x = range(rng, -2600, W + 2600);
        const z = range(rng, -4200, H + 300);
        if (x > -250 && x < W + 250 && z > -400) continue;
        const s = range(rng, 80, 520);
        M.box([x, range(rng, -1200, 1400), z], [s * range(rng, 0.3, 1), s, s * range(rng, 0.3, 1)], { color: pick(rng, ['#1e1838', '#241c44', '#181430']), kind: rng() < 0.5 ? 1 : 4, emit: pick(rng, ['#c9a4ff', '#ff7ad9', '#7ce8ff']), ea: 0.5, anim: [4, range(rng, 0.04, 0.15), range(rng, 30, 120), rng() * 6] });
      }
      // 발판 아래 매달린 바위
      M.box([W / 2, -420, H / 2], [W * 0.9, 600, H * 0.8], { color: '#1e1838', kind: 0, taper: 0.2 });
      // 수정
      for (let i = 0; i < 16; i++) {
        const side = rng() < 0.5 ? -1 : 1;
        const x = side < 0 ? range(rng, -500, -60) : range(rng, W + 60, W + 500);
        const z = range(rng, -300, H + 100);
        const h = range(rng, 60, 300);
        M.box([x, h / 2 - 20, z], [h * 0.25, h, h * 0.25], { color: '#bfe6ff', kind: 2, emit: pick(rng, ['#bfe6ff', '#c9a4ff']), ea: 0.7, taper: 0.3, rot: rng() * 3 });
      }
      R.add({ box: [-2000, -1500, -3500, W + 2000, 1500, H + 400], vel: [-60, 30, 40], n: 700, size: 9, color: '#e2d4ff', alpha: 0.7, life: 14 }, rng);
      along(A, rng, 80, 200, (x, z, fz) => {
        const sz = range(rng, 80, 420);
        M.box([x, fz + range(rng, -900, 900), z], [sz * range(rng, 0.3, 1), sz, sz * range(rng, 0.3, 1)], { color: pick(rng, ['#1e1838', '#241c44', '#181430']), kind: rng() < 0.5 ? 1 : 4, emit: pick(rng, ['#c9a4ff', '#ff7ad9', '#7ce8ff']), ea: 0.5, anim: [4, range(rng, 0.04, 0.15), range(rng, 30, 120), rng() * 6] });
      });
      if (A.level) R.add({ box: [A.level.bounds.x0 - 1500, -1500, A.level.bounds.y0, A.level.bounds.x1 + 1500, 1200, A.level.bounds.y1], vel: [-60, 30, 40], n: 600, size: 9, color: '#e2d4ff', alpha: 0.7, life: 14 }, rng);
      return {
        sky: { top: '#02000a', mid: '#12062e', bot: '#3a145a', stars: 1, moon: [0, 0, 0, 0], moonCol: '#000000', fx: 2, fxA: '#a35bff', fxB: '#e8d8ff', fxAmt: 0.6 },
        fog: '#20104a', fogDen: 0.00022, abyss: '#4a1a8a', abyssY: -300,
        light: { dir: [0.3, 0.7, 0.6], key: '#7a6ab0', amb: '#241c48' },
        floor: { a: '#302a5a', b: '#16122e', grid: '#bfe6ff', gridA: 0.04, edge: '#bfe6ff', pattern: 4, wet: 0.9, neon: ['#c9a4ff', '#7ce8ff', '#ff7ad9'] },
        roadFloor: rd,
        lights: [[W / 2, -200, 1200, 0.3, '#c9a4ff']],
        vortex: true,
      };
    },
  };

  /* ───────── 장면 만들기 ───────── */
  /* ───────── 월드맵: 챕터마다 하늘에 떠 있는 섬 ─────────
   * 게임 좌표 (x 좌우, y 앞뒤, z 높이). 1장은 앞쪽 아래, 10장은 가장 멀고 높은 곳.
   * 섬 위치는 render.drawWorldMap 이 노드 버튼 자리를 계산할 때도 씁니다. */
  const WORLD = [
    { x: 0, y: 0, z: 0, r: 190 },
    { x: 360, y: -470, z: 70, r: 170 },
    { x: -20, y: -940, z: 150, r: 180 },
    { x: -380, y: -1390, z: 240, r: 175 },
    { x: -40, y: -1860, z: 330, r: 185 },
    { x: 360, y: -2310, z: 430, r: 175 },
    { x: 20, y: -2780, z: 520, r: 185 },
    { x: -370, y: -3230, z: 620, r: 180 },
    { x: -30, y: -3700, z: 730, r: 190 },
    { x: 340, y: -4170, z: 860, r: 215 },
  ];
  WORLD.forEach((I, i) => { I.bob = 10 + (i % 3) * 3; I.ph = i * 1.7; I.spd = 0.55 + (i % 4) * 0.06; });
  const ISLE = {
    ruins: { deck: '#1d1a3a', rock: '#181428', neon: '#a35bff', acc: ['#ff3df0', '#3dd8ff'] },
    city: { deck: '#2c2228', rock: '#221a1c', neon: '#ff8a3d', acc: ['#ffb35c', '#ff5a3d'] },
    lab: { deck: '#12262e', rock: '#0e1a20', neon: '#3dffd8', acc: ['#3dd8ff', '#7cf7ff'] },
    highway: { deck: '#2c121a', rock: '#1e0e14', neon: '#ff3d5a', acc: ['#ff2a4a', '#ffb35c'] },
    sky: { deck: '#b9cce4', rock: '#5a6a88', neon: '#9fd8ff', acc: ['#ffffff', '#9fd8ff'] },
    archive: { deck: '#26163f', rock: '#1a1030', neon: '#c48aff', acc: ['#ff9af0', '#9a7aff'] },
    skyport: { deck: '#1c2434', rock: '#141a26', neon: '#66e0ff', acc: ['#ffffff', '#ffb35c'] },
    warfront: { deck: '#30201a', rock: '#22160f', neon: '#ffb35c', acc: ['#ff6a2a', '#66e0ff'] },
    core: { deck: '#0e1c36', rock: '#0a1428', neon: '#3da8ff', acc: ['#7cf7ff', '#ffffff'] },
    void: { deck: '#1c1032', rock: '#140a24', neon: '#ff5cf0', acc: ['#7a5cff', '#ff3df0'] },
  };

  /** 팔각 기둥 (윗면 반지름 R, 아랫면 R*tb, 높이 h) — 사다리꼴 셋으로 */
  function octPrism(M, X, Yt, Z, R, h, tb, rot, o) {
    const v = (k, rr, y) => { const a = rot + Math.PI / 8 + k * Math.PI / 4; return [X + Math.cos(a) * rr, y, Z + Math.sin(a) * rr]; };
    const T = (k) => v(k, R, Yt);
    const B = (k) => v(k, R * tb, Yt - h);
    for (const q of [[0, 1, 2, 3], [7, 0, 3, 4], [4, 5, 6, 7]]) M.block(q.map(T), q.map(B), o);
  }

  function island(M, G, I, theme, state, rng) {
    const th = ISLE[theme] || ISLE.ruins;
    const X = I.x, Y = I.z, Z = I.y, r = I.r;
    const dim = state === 'locked';
    const bob = [3, I.spd, I.bob, I.ph];
    const neon = dim ? '#56607a' : th.neon;
    const acc = dim ? ['#4a5068', '#4a5068'] : th.acc;
    const E = (k) => (dim ? k * 0.25 : k);
    // 윗판 (사각 + 마름모 = 팔각) 과 아래로 좁아지는 암반
    octPrism(M, X, Y, Z, r * 0.8, 26, 0.97, 0, { color: th.deck, kind: 4, anim: bob });
    octPrism(M, X, Y - 26, Z, r * 0.78, 110, 0.62, 0.3, { color: th.rock, anim: bob });
    octPrism(M, X, Y - 136, Z, r * 0.5, 150, 0.45, 0.9, { color: th.rock, anim: bob });
    octPrism(M, X, Y - 286, Z, r * 0.24, 150, 0.06, 1.5, { color: th.rock, anim: bob });
    // 아래로 늘어진 빛나는 결정
    for (let k = 0; k < 5; k++) {
      const a = k * 1.26 + rng();
      const d = r * (0.35 + rng() * 0.25);
      M.box([X + Math.cos(a) * d, Y - 150 - rng() * 70, Z + Math.sin(a) * d], [14, 70 + rng() * 60, 14], { color: neon, kind: 2, emit: neon, ea: E(1.1), taper: 0.05, rot: a, anim: bob });
    }
    // 가장자리 빛 띠
    const rim = [];
    for (let k = 0; k <= 8; k++) { const a = Math.PI / 8 + k * Math.PI / 4; rim.push([X + Math.cos(a) * r * 0.8, Y + 2, Z + Math.sin(a) * r * 0.8]); }
    for (let k = 0; k < 8; k++) M.beam(rim[k], rim[k + 1], 6, { color: neon, kind: 2, emit: neon, ea: E(1.4), anim: bob });
    G.glowFlat([X, Y + 3, Z], r * 0.95, neon, E(0.22), 1, { anim: bob });
    G.glow([X, Y - 260, Z], r * 3.2, r * 1.6, neon, E(0.07), 1, { anim: bob });
    // 테마 소품
    const P = (dx, dz) => [X + dx, Y, Z + dz];
    const tower = (dx, dz, w, h, col, em, o) => M.box([X + dx, Y + h / 2, Z + dz], [w, h, w * (0.8 + rng() * 0.4)], Object.assign({ color: col, kind: 1, emit: em, ea: dim ? 0.15 : 0.55, anim: bob }, o || {}));
    switch (theme) {
      case 'ruins':
        for (let k = 0; k < 7; k++) { const a = rng() * 6.28; const d = rng() * r * 0.5; tower(Math.cos(a) * d, Math.sin(a) * d, 26 + rng() * 22, 60 + rng() * 170, '#1a1834', pick(rng, acc)); }
        M.ring([X, Y + 120, Z - r * 0.3], 70, 7, 'z', 20, { color: '#2a2a55', kind: 2, emit: neon, ea: E(1.2), anim: [6, 0.4, 0, 0] });
        break;
      case 'city':
        for (let k = 0; k < 7; k++) { const a = rng() * 6.28; const d = rng() * r * 0.52; tower(Math.cos(a) * d, Math.sin(a) * d, 30 + rng() * 20, 50 + rng() * 120, '#2a2024', '#ffb35c', { rot: (rng() - 0.5) * 0.4 }); }
        for (let k = 0; k < 3; k++) G.glow(P((rng() - 0.5) * r, (rng() - 0.5) * r), 90, 120, '#ff6a2a', E(0.5), 0, { fromBottom: true, cross: true, anim: bob });
        break;
      case 'lab':
        for (let k = 0; k < 5; k++) M.ring([X, Y + 10 + k * 22, Z], r * (0.55 - k * 0.1), 8, 'y', 16, { color: '#163a44', kind: 2, emit: neon, ea: E(0.7), anim: bob });
        M.box([X, Y + 70, Z], [36, 140, 36], { color: '#3dffd8', kind: 2, emit: '#3dffd8', ea: E(1.6), anim: [1, 0.6, 0, 0] });
        G.glow([X, Y, Z], 120, 260, neon, E(0.45), 0, { fromBottom: true, cross: true, anim: bob });
        break;
      case 'highway':
        for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; M.box([X + Math.cos(a) * r * 0.55, Y + 30, Z + Math.sin(a) * r * 0.55], [k % 2 ? 22 : r * 1.0, 60, k % 2 ? r * 1.0 : 22], { color: '#2a141c', kind: 4, emit: neon, ea: E(0.8), anim: bob }); }
        for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + 0.78; tower(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55, 34, 90, '#341620', '#ff2a4a'); }
        M.box([X, Y + 50, Z], [70, 100, 70], { color: '#3a1822', kind: 4, emit: '#ff2a4a', ea: E(1.0), anim: bob });
        break;
      case 'sky':
        for (let k = 0; k < 6; k++) { const a = rng() * 6.28; const d = rng() * r * 0.45; tower(Math.cos(a) * d, Math.sin(a) * d, 22 + rng() * 14, 120 + rng() * 200, '#e8f2ff', '#9fd8ff', { taper: 1.6 }); }
        for (let k = 0; k < 4; k++) G.glow(P((rng() - 0.5) * r * 2.4, (rng() - 0.5) * r * 1.4), 240, 90, '#ffffff', E(0.16), 1, { anim: bob });
        break;
      case 'archive':
        for (let k = 0; k < 3; k++) M.ring([X, Y + 110 + k * 30, Z], 50 + k * 26, 5, 'z', 20, { color: '#3a2060', kind: 2, emit: k % 2 ? acc[0] : neon, ea: E(1.3), anim: [1, 0.3 + k * 0.2, 0, k] });
        for (let k = 0; k < 6; k++) M.box([X + (rng() - 0.5) * r, Y + 40 + rng() * 140, Z + (rng() - 0.5) * r], [18, 18, 18], { color: '#e2d4ff', kind: 2, emit: '#e2d4ff', ea: E(1.4), anim: [4, 0.6 + rng(), 12, rng() * 6] });
        break;
      case 'skyport':
        M.box([X, Y + 30, Z], [r * 1.0, 50, 60], { color: '#2a3446', kind: 1, emit: '#66e0ff', ea: E(0.5), anim: bob });
        M.box([X, Y + 30, Z], [60, 50, r * 1.0], { color: '#2a3446', kind: 1, emit: '#66e0ff', ea: E(0.5), anim: bob });
        M.beam(P(r * 0.3, -r * 0.2), [X + r * 0.3, Y + 210, Z - r * 0.2], 8, { color: '#5a6a88', anim: bob });
        M.ring([X + r * 0.3, Y + 210, Z - r * 0.2], 40, 4, 'y', 14, { color: '#c8d8ff', kind: 2, emit: '#ffffff', ea: E(1.0), anim: [1, 0.8, 0, 0] });
        G.glow([X - r * 0.4, Y + 40, Z], 60, 60, '#ffb35c', E(0.6), 1, { anim: bob });
        break;
      case 'warfront':
        for (let k = 0; k < 6; k++) { const a = rng() * 6.28; const d = rng() * r * 0.42; tower(Math.cos(a) * d, Math.sin(a) * d, 30, 50 + rng() * 90, '#2c2018', '#ffb35c'); }
        for (let k = 0; k < 6; k++) { const ang = (k / 6) * Math.PI / 2; M.ring([X, Y + Math.sin(ang) * r * 0.7, Z], Math.cos(ang) * r * 0.7, 3, 'y', 24, { color: '#66e0ff', kind: 2, emit: '#66e0ff', ea: E(0.55), anim: bob }); }
        break;
      case 'core':
        M.box([X, Y + 160, Z], [56, 320, 56], { color: '#0e2244', kind: 1, emit: '#3da8ff', ea: E(0.9), anim: bob });
        M.box([X, Y + 340, Z], [20, 60, 20], { color: '#7cf7ff', kind: 2, emit: '#7cf7ff', ea: E(2.0), anim: bob });
        G.glow([X, Y + 300, Z], 70, 900, '#7cf7ff', E(0.5), 0, { fromBottom: true, cross: true, anim: bob });
        for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + 0.4; tower(Math.cos(a) * r * 0.42, Math.sin(a) * r * 0.42, 28, 90 + rng() * 60, '#0e1c36', '#3da8ff'); }
        break;
      case 'void':
        for (let k = 0; k < 9; k++) M.box([X + (rng() - 0.5) * r * 1.6, Y + 30 + rng() * 220, Z + (rng() - 0.5) * r * 1.4], [20 + rng() * 40, 30 + rng() * 60, 16 + rng() * 30], { color: '#2a1848', kind: 2, emit: pick(rng, [neon, acc[0]]), ea: E(0.9), anim: [4, 0.3 + rng() * 0.4, 20, rng() * 6] });
        M.ring([X, Y + 150, Z], 90, 6, 'z', 24, { color: '#3a1a5a', kind: 2, emit: '#ff5cf0', ea: E(1.5), anim: [6, -0.5, 0, 0] });
        G.glow([X, Y + 150, Z], 340, 340, '#7a5cff', E(0.25), 1);
        break;
      default: break;
    }
    // 노드 표지: 위로 뻗는 빛
    const beacon = state === 'cleared' ? '#ffd27a' : state === 'open' ? th.neon : '#4a5468';
    G.glow([X, Y, Z], 46, 420, beacon, state === 'locked' ? 0.12 : 0.42, 0, { fromBottom: true, cross: true, anim: bob });
  }

  /** 섬 사이를 잇는 빛의 길 (위로 휘어진 곡선) */
  function skyPath(M, G, A, B, lit) {
    const a = [A.x, A.z + 4, A.y];
    const b = [B.x, B.z + 4, B.y];
    const d = Math.hypot(b[0] - a[0], b[2] - a[2]);
    const ux = (b[0] - a[0]) / d, uz = (b[2] - a[2]) / d;
    a[0] += ux * A.r * 0.62; a[2] += uz * A.r * 0.62;
    b[0] -= ux * B.r * 0.62; b[2] -= uz * B.r * 0.62;
    const lift = 70 + d * 0.05;
    const pts = [];
    for (let i = 0; i <= 14; i++) {
      const t = i / 14;
      pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t + Math.sin(t * Math.PI) * lift, a[2] + (b[2] - a[2]) * t]);
    }
    const col = lit ? '#7cf7ff' : '#3a4660';
    for (let i = 0; i < 14; i++) M.beam(pts[i], pts[i + 1], lit ? 7 : 5, { color: col, kind: 2, emit: col, ea: lit ? 1.5 : 0.35 });
    if (lit) for (let i = 1; i < 14; i += 2) G.glow(pts[i], 50, 50, '#7cf7ff', 0.35, 1);
  }

  /** 월드맵 장면. A.opts.status: 챕터별 'cleared' | 'open' | 'locked' */
  function buildWorld(M, G, R, A, rng) {
    const st = (A.opts && A.opts.status) || [];
    const themes = (A.opts && A.opts.themes) || ['ruins', 'city', 'lab', 'highway', 'sky', 'archive', 'skyport', 'warfront', 'core', 'void'];
    WORLD.forEach((I, i) => island(M, G, I, themes[i], st[i] || 'locked', rng));
    for (let i = 0; i < WORLD.length - 1; i++) skyPath(M, G, WORLD[i], WORLD[i + 1], st[i + 1] && st[i + 1] !== 'locked');
    // 작은 바위 조각들
    for (let k = 0; k < 70; k++) {
      const x = (rng() - 0.5) * 3200, y = 600 - rng() * 5400, z = -250 + rng() * 1300;
      if (WORLD.some((I) => Math.hypot(I.x - x, I.y - y) < I.r * 1.6)) continue;
      const s2 = 10 + rng() * 40;
      M.box([x, z, y], [s2 * 1.4, s2, s2 * 1.2], { color: '#1a1830', taper: 0.4, rot: rng() * 6, anim: [3, 0.4 + rng() * 0.4, 10 + rng() * 14, rng() * 6] });
    }
    // 저 끝의 ASTRA (거대한 고리)
    M.ring([200, 1500, -7200], 1500, 60, 'z', 56, { color: '#1a2a55', kind: 2, emit: '#5aa8ff', ea: 0.9 });
    M.ring([200, 1500, -7200], 1180, 26, 'z', 56, { color: '#1a2a55', kind: 2, emit: '#9a7aff', ea: 0.7, anim: [6, 0.02, 0, 0] });
    G.glow([200, 1500, -7150], 3600, 3600, '#3a6aff', 0.08, 1);
    // 구름 바다
    for (let k = 0; k < 26; k++) {
      const x = (rng() - 0.5) * 5200, y = 1400 - rng() * 7600;
      G.glowFlat([x, -560 - rng() * 200, y], 500 + rng() * 700, pick(rng, ['#3a2a7a', '#1a3a7a', '#5a2a6a']), 0.12, 1);
    }
    R.add({ box: [-1800, -500, -5200, 1800, 1300, 900], vel: [0, 18, 0], n: 520, size: 5, color: '#9ab8ff', alpha: 0.45, life: 9 }, rng);
    R.add({ box: [-1800, -500, -5200, 1800, 1300, 900], vel: [6, 10, 0], n: 140, size: 9, color: '#ff9af0', alpha: 0.35, life: 11 }, rng);
    return {
      noArena: true,
      sky: { top: '#02030c', mid: '#0d1036', bot: '#2c1a5a', stars: 1, moon: [0.84, 0.82, 0.055, 0], moonCol: '#d8e4ff', fx: 1, fxA: '#4a2aa0', fxB: '#1a4aa0', fxAmt: 1.1 },
      fog: '#0c0c2a', fogDen: 0.00007, abyss: '#1c1044', abyssY: -480,
      light: { dir: [0.35, 0.85, 0.45], key: '#7a86c8', amb: '#34345e' },
      floor: { a: '#000000', b: '#000000', grid: '#000000', gridA: 0, edge: '#000000', pattern: 0, wet: 0, neon: ['#000000', '#000000', '#000000'] },
      lights: [],
    };
  }

  function build(themeId, aw, ah, level, opts) {
    const builder = themeId === 'world' ? buildWorld : BUILDERS[themeId] || BUILDERS.ruins;
    const A = { w: aw, h: ah, level: level || null, levelSamples: level ? levelSamples(level) : [], opts: opts || null, theme: themeId, struct: STRUCT[themeId] || null };
    const rng = makeRng(themeId.length * 7919 + aw);
    const M = new Mesh();
    const G = new Mesh();
    const R = new Parts();
    const cfg = builder(M, G, R, A, rng);
    const levelFloors = level ? levelGeometry(M, G, R, A, rng, cfg) : [];
    // 바닥들
    const floors = [];
    const quad = (x0, z0, x1, z1, y) => new Float32Array([x0, y, z0, x1, y, z0, x1, y, z1, x0, y, z0, x1, y, z1, x0, y, z1]);
    const mkBuf = (arr) => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW); return b; };
    if (cfg.abyssFloor) {
      const af = cfg.abyssFloor;
      floors.push({ buf: mkBuf(quad(-5000, -6000, aw + 5000, ah + 3000, af.y)), mode: af.mode, a: hex(af.a), b: hex(af.b || af.a), neon: (af.neon || ['#ffffff', '#ffffff', '#ffffff']).map(hex), pattern: 0 });
    }
    if (cfg.outerFloor) {
      const of = cfg.outerFloor;
      floors.push({ buf: mkBuf(quad(-of.size, -of.size, aw + of.size, ah + 600, -1)), mode: 3, a: hex(of.a), b: hex(of.b), neon: cfg.floor.neon.map(hex), pattern: of.pattern, outer: true });
    }
    if (cfg.roadFloor) {
      const rf = cfg.roadFloor;
      for (const [za, zb] of rf.segs || [[-1, -rf.len]]) floors.push({ buf: mkBuf(quad(rf.x0, zb, rf.x1, za, 0)), mode: 3.5, road: true });
    }
    for (const lf of levelFloors) {
      if (lf.kind === 'area') {
        const a = lf.area;
        floors.push({ buf: mkBuf(quad(a.x0, a.y0, a.x1, a.y1, a.z)), mode: 3.6, piece: true, frame: lf.frame, size: lf.size, pattern: lf.pattern });
      } else {
        const t = lf.quad;
        floors.push({ buf: mkBuf(new Float32Array([...t[0], ...t[1], ...t[2], ...t[0], ...t[2], ...t[3]])), mode: 3.6, piece: true, frame: lf.frame, size: lf.size, pattern: lf.pattern });
      }
    }
    if (!cfg.noArena) floors.push({ buf: mkBuf(quad(0, 0, aw, ah, 0)), mode: 0, arena: true, pattern: level ? 6 : null });
    scene = {
      themeId, A, cfg, levelId: level ? level.id : null, optKey: (opts && opts.key) || null,
      opaque: M.upload(), add: G.upload(), parts: R.upload(), floors,
      fog: hex(cfg.fog), abyss: hex(cfg.abyss),
      sky: Object.assign({}, cfg.sky, { top: hex(cfg.sky.top), mid: hex(cfg.sky.mid), bot: hex(cfg.sky.bot), moonCol: hex(cfg.sky.moonCol), fxA: hex(cfg.sky.fxA), fxB: hex(cfg.sky.fxB) }),
      floor: Object.assign({}, cfg.floor, { a: hex(cfg.floor.a), b: hex(cfg.floor.b), grid: hex(cfg.floor.grid), edge: hex(cfg.floor.edge), neon: cfg.floor.neon.map(hex) }),
      light: { dir: norm(cfg.light.dir), key: hex(cfg.light.key), amb: hex(cfg.light.amb) },
      lights: cfg.lights || [],
      vortexBoost: 0,
    };
    flashes.length = 0;
    return scene;
  }
  function H0(A) { return A.h; }
  function norm(v) { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); }

  function freeScene() {
    if (!scene || !gl) return;
    const del = (b) => { if (b) gl.deleteBuffer(b); };
    del(scene.opaque.buf);
    del(scene.add.buf);
    if (scene.parts.points) del(scene.parts.points.buf);
    if (scene.parts.lines) del(scene.parts.lines.buf);
    for (const f of scene.floors) del(f.buf);
    scene = null;
  }

  /* ───────── 초기화 ───────── */
  function init(c) {
    canvas = c;
    try {
      gl = c.getContext('webgl', { antialias: true, alpha: false, depth: true, powerPreference: 'high-performance', preserveDrawingBuffer: false })
        || c.getContext('experimental-webgl');
    } catch (e) {
      gl = null;
    }
    if (!gl) return false;
    try {
      const fp = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
      highp = !!(fp && fp.precision > 0);
      P.mesh = program(MESH_VS, MESH_FS(), ['aPos', 'aCenter', 'aNormal', 'aColor', 'aEmit', 'aAnim', 'aUV']);
      P.add = program(MESH_VS, ADD_FS(), ['aPos', 'aCenter', 'aNormal', 'aColor', 'aEmit', 'aAnim', 'aUV']);
      P.floor = program(FLOOR_VS, FLOOR_FS(), ['aPos']);
      P.sky = program(SKY_VS, SKY_FS(), ['aPos']);
      P.part = program(PART_VS, PART_FS(), ['aBase', 'aVel', 'aParam', 'aColor']);
      P.dyn = program(DYN_VS, DYN_FS(), ['aPos', 'aColor', 'aSize']);
      P.shadow = program(SHADOW_VS, SHADOW_FS(), ['aPos', 'aUA']);
      dynBufs.mesh = gl.createBuffer();
      dynBufs.glow = gl.createBuffer();
      dynBufs.shadow = gl.createBuffer();
      P.skyBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, P.skyBuf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      dynBuf = gl.createBuffer();
      c.addEventListener('webglcontextlost', (e) => { e.preventDefault(); ok = false; failed = true; }, false);
      ok = true;
    } catch (e) {
      if (typeof console !== 'undefined') console.warn('3D 배경을 쓸 수 없어 2D 배경으로 그립니다:', e.message);
      ok = false;
      failed = true;
    }
    return ok;
  }

  function ensure(themeId, aw, ah, level, opts) {
    if (!ok) return false;
    const lid = level ? level.id : null;
    const key = (opts && opts.key) || null;
    if (!scene || scene.themeId !== themeId || scene.A.w !== aw || scene.A.h !== ah || scene.levelId !== lid || scene.optKey !== key) {
      freeScene();
      build(themeId, aw, ah, level, opts);
    }
    return true;
  }

  /** 매 프레임 바뀌는 캐릭터·몬스터 (js/gfx/models3d.js 가 만듦) */
  const dynBufs = {};
  let dynamic = null;
  function setDynamic(d) { dynamic = d; }

  /** 가림 방지 초점: (x, y) 논리 화면 좌표, r 반경(논리 px), d 카메라~플레이어 거리. r = 0 이면 끔 */
  const focus = { x: 0, y: 0, r: 0, d: 0 };
  function setFocus(x, y, r, d) {
    const k = canvas ? canvas.width / C.VW : 1;
    focus.x = x * k;
    focus.y = canvas ? canvas.height - y * k : 0;
    focus.r = r * k;
    focus.d = d || 0;
  }

  /* ───────── 조명 변화 / 사건 ───────── */
  function setMood(m) {
    if (m.tint) moodTarget.tint = m.tint.slice();
    for (const k of ['alarm', 'zero', 'stop', 'bossAmt']) if (m[k] != null) moodTarget[k] = m[k];
    if (m.boss) moodTarget.boss = m.boss.slice();
    if (m.flash) mood.flash = Math.max(mood.flash, m.flash);
    if (m.vortex != null && scene) scene.vortexBoost = m.vortex;
  }
  function updateMood(dt) {
    const k = Math.min(1, dt * 3);
    for (let i = 0; i < 3; i++) {
      mood.tint[i] += (moodTarget.tint[i] - mood.tint[i]) * k;
      mood.boss[i] += (moodTarget.boss[i] - mood.boss[i]) * k;
    }
    mood.alarm += (moodTarget.alarm - mood.alarm) * k;
    mood.bossAmt += (moodTarget.bossAmt - mood.bossAmt) * k;
    mood.zero += (moodTarget.zero - mood.zero) * Math.min(1, dt * 8);
    mood.stop += (moodTarget.stop - mood.stop) * Math.min(1, dt * 8);
    mood.flash = Math.max(0, mood.flash - dt * 2.5);
  }
  /** 먼 곳의 폭발 (전투 중 맵 연출) */
  function explode(n) {
    if (!scene) return;
    const A = scene.A;
    for (let i = 0; i < (n || 1); i++) {
      flashes.push({
        x: A.w / 2 + (Math.random() - 0.5) * 4200, y: -200 + Math.random() * 900, z: -800 - Math.random() * 2600,
        t: -Math.random() * 1.5, life: 1.2 + Math.random(), size: 900 + Math.random() * 1400,
        color: Math.random() < 0.5 ? [1, 0.55, 0.2] : [1, 0.8, 0.5],
      });
    }
  }

  /* ───────── 그리기 ───────── */
  function resize(w, h) {
    if (!canvas) return;
    canvas.width = w;
    canvas.height = h;
  }

  function common(prog, t) {
    const u = prog.u;
    gl.uniform4f(u.uMood, mood.tint[0], mood.tint[1], mood.tint[2], mood.alarm);
    gl.uniform4f(u.uMood2, mood.zero, mood.stop, mood.flash, mood.bossAmt);
    if (u.uBossCol) gl.uniform3fv(u.uBossCol, mood.boss);
    if (u.uTime) gl.uniform1f(u.uTime, t);
    if (u.uVP) gl.uniformMatrix4fv(u.uVP, false, C.vp);
    if (u.uShake) gl.uniform2f(u.uShake, (C.st.shakeX / C.VW) * 2, -(C.st.shakeY / C.VH) * 2);
    if (u.uEye) gl.uniform3fv(u.uEye, C.st.eye);
  }

  function render(t, dt) {
    if (!ok || !scene) return;
    updateMood(dt || 0);
    const s = scene;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.disable(gl.BLEND);
    gl.depthMask(true);
    gl.clearColor(s.fog[0], s.fog[1], s.fog[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // 하늘
    gl.disable(gl.DEPTH_TEST);
    gl.useProgram(P.sky.p);
    common(P.sky, t);
    const sk = s.sky;
    const u = P.sky.u;
    gl.uniform3fv(u.uTop, sk.top);
    gl.uniform3fv(u.uMid, sk.mid);
    gl.uniform3fv(u.uBot, sk.bot);
    gl.uniform1f(u.uPar, (C.st.target[0] / Math.max(1, s.A.w) - 0.5) * 0.06 + C.st.yaw * 0.25);
    gl.uniform2f(u.uRes, canvas.width, canvas.height);
    gl.uniform4f(u.uMoon, sk.moon[0], sk.moon[1], sk.moon[2], sk.moon[3]);
    gl.uniform3fv(u.uMoonCol, sk.moonCol);
    gl.uniform1f(u.uStars, sk.stars);
    gl.uniform1f(u.uFx, sk.fx);
    gl.uniform3fv(u.uFxA, sk.fxA);
    gl.uniform3fv(u.uFxB, sk.fxB);
    gl.uniform1f(u.uFxAmt, sk.fxAmt + (s.vortexBoost || 0));
    gl.bindBuffer(gl.ARRAY_BUFFER, P.skyBuf);
    for (let i = 0; i < 8; i++) gl.disableVertexAttribArray(i);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    // 바닥
    gl.useProgram(P.floor.p);
    common(P.floor, t);
    const fu = P.floor.u;
    gl.uniform3fv(fu.uFog, s.fog);
    gl.uniform1f(fu.uFogDen, s.cfg.fogDen);
    gl.uniform4f(fu.uArena, 0, 0, s.A.w, s.A.h);
    const lightArr = new Float32Array(32);
    const lightCol = new Float32Array(24);
    const dyn = s.dynLights || [];
    const all = s.lights.concat(dyn).slice(0, 8);
    all.forEach((L, i) => {
      lightArr.set([L[0], L[1], L[2], L[3]], i * 4);
      const c = typeof L[4] === 'string' ? hex(L[4]) : L[4];
      lightCol.set(c, i * 3);
    });
    gl.uniform4fv(fu.uLights, lightArr);
    gl.uniform3fv(fu.uLightCol, lightCol);
    for (const f of s.floors) {
      const fl = f.arena || f.road || f.piece ? s.floor : null;
      if (f.road) { gl.uniform4f(fu.uArena, 0, 0, s.cfg.roadFloor.x1 - s.cfg.roadFloor.x0, s.cfg.roadFloor.len); gl.uniform4f(fu.uFrame, s.cfg.roadFloor.x0, -s.cfg.roadFloor.len, 0, 1); }
      else if (f.piece) { gl.uniform4f(fu.uArena, 0, 0, f.size[0], f.size[1]); gl.uniform4f(fu.uFrame, f.frame[0], f.frame[1], f.frame[2], f.frame[3]); }
      else { gl.uniform4f(fu.uArena, 0, 0, s.A.w, s.A.h); gl.uniform4f(fu.uFrame, 0, 0, 0, 1); }
      const a = fl ? fl.a : f.a;
      const b = fl ? fl.b : f.b;
      const neon = fl ? fl.neon : f.neon;
      gl.uniform3fv(fu.uBaseA, a);
      gl.uniform3fv(fu.uBaseB, b);
      gl.uniform4f(fu.uGrid, ...(fl ? fl.grid : [0, 0, 0]), fl ? fl.gridA : 0);
      gl.uniform3fv(fu.uEdge, fl ? fl.edge : s.floor.edge);
      gl.uniform1f(fu.uPattern, f.pattern != null ? f.pattern : fl ? fl.pattern : 0);
      gl.uniform1f(fu.uWet, fl ? fl.wet : 0.1);
      gl.uniform1f(fu.uMode, f.mode);
      gl.uniform3fv(fu.uNeon0, neon[0]);
      gl.uniform3fv(fu.uNeon1, neon[1]);
      gl.uniform3fv(fu.uNeon2, neon[2]);
      gl.bindBuffer(gl.ARRAY_BUFFER, f.buf);
      for (let i = 0; i < 8; i++) gl.disableVertexAttribArray(i);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    // 불투명 구조물
    gl.useProgram(P.mesh.p);
    common(P.mesh, t);
    const mu = P.mesh.u;
    gl.uniform3fv(mu.uFog, s.fog);
    gl.uniform1f(mu.uFogDen, s.cfg.fogDen);
    gl.uniform3fv(mu.uAbyss, s.abyss);
    gl.uniform1f(mu.uAbyssY, s.cfg.abyssY);
    gl.uniform3fv(mu.uLightDir, s.light.dir);
    gl.uniform4f(mu.uFocus, focus.x, focus.y, focus.r, focus.d);
    gl.uniform1f(mu.uOutline, 0);
    gl.uniform3fv(mu.uKey, s.light.key);
    gl.uniform3fv(mu.uAmb, s.light.amb);
    gl.bindBuffer(gl.ARRAY_BUFFER, s.opaque.buf);
    bindAttribs(P.mesh, MESH_LAYOUT, MESH_STRIDE);
    gl.drawArrays(gl.TRIANGLES, 0, s.opaque.count);
    const dy = dynamic;
    // 캐릭터 그림자 (곱하기)
    if (dy && dy.shadowCount) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.DST_COLOR, gl.ZERO);
      gl.depthMask(false);
      gl.useProgram(P.shadow.p);
      common(P.shadow, t);
      gl.bindBuffer(gl.ARRAY_BUFFER, dynBufs.shadow);
      gl.bufferData(gl.ARRAY_BUFFER, dy.shadow, gl.DYNAMIC_DRAW);
      bindAttribs(P.shadow, [3, 3], 6);
      gl.drawArrays(gl.TRIANGLES, 0, dy.shadowCount);
      gl.disable(gl.BLEND);
      gl.depthMask(true);
    }
    // 캐릭터·몬스터 (불투명)
    if (dy && dy.meshCount) {
      gl.useProgram(P.mesh.p);
      gl.bindBuffer(gl.ARRAY_BUFFER, dynBufs.mesh);
      gl.bufferData(gl.ARRAY_BUFFER, dy.mesh, gl.DYNAMIC_DRAW);
      bindAttribs(P.mesh, MESH_LAYOUT, MESH_STRIDE);
      gl.enable(gl.CULL_FACE);
      gl.cullFace(gl.FRONT);
      gl.uniform1f(mu.uOutline, dy.outline || 1.1);
      gl.drawArrays(gl.TRIANGLES, 0, dy.meshCount);
      gl.disable(gl.CULL_FACE);
      gl.uniform1f(mu.uOutline, 0);
      gl.drawArrays(gl.TRIANGLES, 0, dy.meshCount);
    }

    // 빛 (더하기)
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.depthMask(false);
    if (s.add.count) {
      gl.useProgram(P.add.p);
      common(P.add, t);
      gl.uniform1f(P.add.u.uFogDen, s.cfg.fogDen);
      gl.bindBuffer(gl.ARRAY_BUFFER, s.add.buf);
      bindAttribs(P.add, MESH_LAYOUT, MESH_STRIDE);
      gl.drawArrays(gl.TRIANGLES, 0, s.add.count);
    }
    if (dy && dy.glowCount) {
      gl.useProgram(P.add.p);
      common(P.add, t);
      gl.uniform1f(P.add.u.uFogDen, s.cfg.fogDen);
      gl.bindBuffer(gl.ARRAY_BUFFER, dynBufs.glow);
      gl.bufferData(gl.ARRAY_BUFFER, dy.glow, gl.DYNAMIC_DRAW);
      bindAttribs(P.add, MESH_LAYOUT, MESH_STRIDE);
      gl.drawArrays(gl.TRIANGLES, 0, dy.glowCount);
    }
    // 입자
    const px = (canvas.height / 2) * C.st.f;
    gl.useProgram(P.part.p);
    common(P.part, t);
    gl.uniform1f(P.part.u.uPx, px);
    if (s.parts.points) {
      gl.uniform1f(P.part.u.uLines, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, s.parts.points.buf);
      bindAttribs(P.part, PART_LAYOUT, PART_STRIDE);
      gl.drawArrays(gl.POINTS, 0, s.parts.points.count);
    }
    if (s.parts.lines) {
      gl.uniform1f(P.part.u.uLines, 1);
      gl.bindBuffer(gl.ARRAY_BUFFER, s.parts.lines.buf);
      bindAttribs(P.part, PART_LAYOUT, PART_STRIDE);
      gl.drawArrays(gl.LINES, 0, s.parts.lines.count);
    }
    // 먼 폭발
    if (s.cfg.explosions && Math.random() < (dt || 0) * 0.5) explode(1);
    for (const f of flashes) f.t += dt || 0;
    for (let i = flashes.length - 1; i >= 0; i--) if (flashes[i].t > flashes[i].life) flashes.splice(i, 1);
    const live = flashes.filter((f) => f.t > 0);
    if (live.length) {
      const arr = new Float32Array(live.length * 2 * 8);
      let o = 0;
      for (const f of live) {
        const k = f.t / f.life;
        const a = (1 - k) * (k < 0.1 ? k / 0.1 : 1);
        arr.set([f.x, f.y, f.z, f.color[0], f.color[1], f.color[2], a, f.size * (0.4 + k)], o); o += 8;
        arr.set([f.x, f.y + 40, f.z + 10, 1, 1, 0.9, a * 0.8, f.size * 0.3 * (1 - k)], o); o += 8;
      }
      gl.useProgram(P.dyn.p);
      common(P.dyn, t);
      gl.uniform1f(P.dyn.u.uPx, px);
      gl.bindBuffer(gl.ARRAY_BUFFER, dynBuf);
      gl.bufferData(gl.ARRAY_BUFFER, arr, gl.DYNAMIC_DRAW);
      bindAttribs(P.dyn, [3, 4, 1], 8);
      gl.drawArrays(gl.POINTS, 0, live.length * 2);
    }
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  }

  return {
    init, ensure, render, resize, setMood, explode, setFocus, setDynamic,
    get available() { return ok && !failed; },
    get scene() { return scene; },
    BUILDERS, WORLD,
  };
})();
