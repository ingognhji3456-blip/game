'use strict';

/*
 * 셰이더 모음.
 * 별·은하는 점 하나하나를 가우스 모양의 빛으로 더해 그립니다(가산 혼합). 입자 하나의 빛은 거리의 제곱에
 * 반비례해 퍼지므로, 멀리서 보면 은하 전체가 하나의 부드러운 빛이 되고 가까이 가면 별 하나하나가 보입니다.
 * 모든 빛은 1을 넘을 수 있는 HDR 버퍼에 모은 뒤, 번짐(블룸)과 톤 매핑을 거쳐 화면에 나옵니다.
 */
(function () {
  const UC = (window.UC = window.UC || {});

  const COMMON = `
vec3 blackbody(float K) {
  float t = clamp(K, 800.0, 40000.0) / 100.0;
  vec3 c;
  if (t <= 66.0) {
    c.r = 1.0;
    c.g = clamp((99.4708025861 * log(t) - 161.1195681661) / 255.0, 0.0, 1.0);
    c.b = t <= 19.0 ? 0.0 : clamp((138.5177312231 * log(t - 10.0) - 305.0447927307) / 255.0, 0.0, 1.0);
  } else {
    c.r = clamp(329.698727446 * pow(t - 60.0, -0.1332047592) / 255.0, 0.0, 1.0);
    c.g = clamp(288.1221695283 * pow(t - 60.0, -0.0755148492) / 255.0, 0.0, 1.0);
    c.b = 1.0;
  }
  return pow(c, vec3(2.2));
}
`;

  const NOISE = `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
float fbm3(vec3 p) {
  return snoise(p) * 0.55 + snoise(p * 2.03 + 7.1) * 0.3 + snoise(p * 4.1 - 3.3) * 0.15;
}
`;

  /* ---------- 은하의 별 ---------- */
  const STAR_VS = `#version 300 es
precision highp float;
precision highp sampler2D;
layout(location = 0) in vec4 aPosF;
layout(location = 1) in vec4 aPosE;
layout(location = 2) in vec4 aMisc;
layout(location = 3) in vec4 aSet;
layout(location = 4) in vec4 aOff;
uniform mat4 uMV;
uniform mat4 uMVw;
uniform mat4 uP;
uniform float uTauG, uSim, uFluxK, uProj, uMinPx, uMaxPx;
uniform float uSfr, uOld, uFade, uGas, uEvap, uRip, uNear, uDustPass, uDeg, uWall, uAlpha;
uniform vec3 uRipC;
uniform sampler2D uSimTex;
out vec3 vCol;
out float vK;
${COMMON}
void main() {
  float type = aPosF.w;
  float settle = smoothstep(aSet.x, aSet.y, uTauG);
  vec3 lp = mix(aPosE.xyz, aPosF.xyz, settle);
  bool isFlat = type == 2.0 || type == 3.0 || type == 4.0 || type == 7.0;
  if (isFlat) lp.y *= mix(4.0, 1.0, smoothstep(5.0, 10.0, uTauG));
  lp *= 1.0 + uEvap * aMisc.w * aMisc.w * 8.0;
  vec4 vp;
  if (uSim > 0.5) {
    int idx = int(aSet.z + 0.5);
    vec3 wp = texelFetch(uSimTex, ivec2(idx % 128, idx / 128), 0).xyz + aOff.xyz;
    wp = uRipC + (wp - uRipC) * uRip;
    wp *= 1.0 + uEvap * aMisc.w * aMisc.w * 8.0;
    vp = uMVw * vec4(wp, 1.0);
  } else {
    vp = uMV * vec4(lp * uRip, 1.0);
  }
  float birth = aPosE.w;
  float born = smoothstep(birth, birth + 0.3, uTauG);
  float age = max(uTauG - birth, 0.0);
  float temp = aMisc.z * 1000.0;
  float lum = aMisc.x;
  vec3 col;
  if (type == 4.0) {
    col = vec3(1.0, 0.3, 0.5);
    lum *= uSfr * 1.3;
  } else {
    if (type == 3.0) lum *= uSfr;
    else temp *= 1.0 + 1.3 * exp(-age / 0.5);
    temp = mix(temp, 2700.0, uOld);
    col = blackbody(temp);
    lum *= 1.0 + 1.5 * exp(-age / 0.6);
  }
  lum *= born * uFade;
  float gas = (1.0 - born) * uGas * aMisc.x * 0.6;
  vec3 light = col * lum + vec3(0.55, 0.2, 0.32) * gas;
  if (uDeg > 0.0) {
    float f = fract(sin(aMisc.w * 9137.0 + floor(uWall * 1.3 + aMisc.w * 13.0)) * 43758.5);
    light += vec3(1.0, 0.75, 0.55) * step(0.9994, f) * uDeg * 0.004;
  }
  float d = max(length(vp.xyz), 1e-6);
  float trueR = aMisc.y * (born < 0.5 ? 2.2 : 1.0) * uProj / d;
  float size = clamp(trueR, uMinPx, uMaxPx);
  float near = smoothstep(uNear, uNear * 3.0, d);
  gl_Position = uP * vp;
  gl_PointSize = size * 2.0;
  if (uDustPass > 0.5) {
    float cover = min(1.0, (trueR * trueR) / (uMinPx * uMinPx * 4.0));
    vK = 0.5 * born * cover * near * uAlpha * (1.0 - uOld * 0.8);
    vCol = vec3(1.0);
  } else {
    vCol = min(light * (uFluxK / (d * d)) / (size * size) * near * uAlpha, vec3(40.0));
    vK = 0.0;
  }
}`;

  const POINT_FS = `#version 300 es
precision highp float;
in vec3 vCol;
in float vK;
uniform float uDustPass;
out vec4 o;
void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(c, c);
  if (r2 > 1.0) discard;
  float a = exp(-r2 * 4.5);
  if (uDustPass > 0.5) o = vec4(vec3(0.75, 0.88, 1.0) * vK * a, 1.0);
  else o = vec4(vCol * a, 0.0);
}`;

  /* ---------- 우주 거대 구조 ---------- */
  const WEB_VS = `#version 300 es
precision highp float;
layout(location = 0) in vec4 aQ;
layout(location = 1) in vec4 aP;
uniform mat4 uMV;
uniform mat4 uP;
uniform float uD, uG, uTauG, uFluxK, uProj, uMinPx, uMaxPx, uGasVis, uOld, uFade, uLonely, uHideHome, uAlpha, uNear;
out vec3 vCol;
out float vK;
${COMMON}
void main() {
  vec3 x = (aQ.xyz + uD * aP.xyz) * uG;
  float dens = aQ.w;
  float g = clamp(uD, 0.0, 2.0);
  float dD = 1.0 + (dens - 1.0) * pow(g, 1.6);
  float r = aP.w;
  float tIgn = 0.15 + 3.2 * pow(1.0 - smoothstep(0.0, 25.0, dens), 2.0) * (0.35 + 0.65 * r);
  float lit = smoothstep(tIgn, tIgn + 0.45, uTauG);
  float temp = mix(16000.0, 5800.0, smoothstep(0.6, 11.0, uTauG));
  temp = mix(temp, 4300.0, smoothstep(8.0, 50.0, dens) * 0.8);
  temp = mix(temp, 2700.0, uOld);
  vec3 col = blackbody(temp);
  float lum = pow(max(dD, 0.15), 0.9) * (0.4 + r) * lit * uFade;
  float far = smoothstep(5.0, 22.0, length(aQ.xyz));
  lum *= 1.0 - uLonely * far;
  col = mix(col, vec3(1.0, 0.25, 0.08), uLonely * far * 0.8);
  vec3 gasC = vec3(0.6, 0.24, 0.34) * uGasVis * pow(max(dD, 0.0), 1.1) * 0.12;
  vec4 vp = uMV * vec4(x, 1.0);
  float hide = mix(1.0, smoothstep(1.5, 7.0, length(x)), uHideHome);
  float d = max(length(vp.xyz), 1e-9);
  float trueR = (0.05 + 0.05 * pow(max(dens, 0.1), 0.35)) * uG * uProj / d;
  float size = clamp(trueR, uMinPx, uMaxPx);
  gl_Position = uP * vp;
  gl_PointSize = size * 2.0;
  vCol = min((col * lum + gasC) * (uFluxK / (d * d)) / (size * size) * hide * uAlpha * smoothstep(uNear, uNear * 3.0, d), vec3(40.0));
  vK = 0.0;
}`;

  /* ---------- 이름난 별 / 태양계의 작은 천체 ---------- */
  const SIMPLE_VS = `#version 300 es
precision highp float;
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec4 aCol;
uniform mat4 uMV;
uniform mat4 uP;
uniform float uFluxK, uProj, uMinPx, uMaxPx, uAlpha, uWorldR;
out vec3 vCol;
out float vK;
void main() {
  vec4 vp = uMV * vec4(aPos, 1.0);
  float d = max(length(vp.xyz), 1e-12);
  float trueR = uWorldR * uProj / d;
  float size = clamp(trueR, uMinPx, uMaxPx);
  gl_Position = uP * vp;
  gl_PointSize = size * 2.0;
  vCol = min(aCol.rgb * aCol.a * (uFluxK / (d * d)) / (size * size) * uAlpha, vec3(30.0));
  vK = 0.0;
}`;

  /* 소행성대·카이퍼 벨트·원시 원반·원시 구름: 케플러 회전은 셰이더에서 */
  const BELT_VS = `#version 300 es
precision highp float;
layout(location = 0) in vec4 aOrb;
layout(location = 1) in float aKind;
uniform mat4 uMV;
uniform mat4 uP;
uniform float uWall, uOrbitSec, uMass, uBelt, uDisk, uCloud, uAgeG, uAlpha, uProj, uSunL, uRip;
uniform float uPlA[8];
uniform float uPlB[8];
out vec3 vCol;
out float vK;
float hash(float n) { return fract(sin(n) * 43758.5453); }
void main() {
  float a = aOrb.x / max(uMass, 0.5);
  float th = aOrb.y + uWall * 6.2831853 / (uOrbitSec * pow(aOrb.x, 1.5));
  vec3 p = vec3(a * cos(th), a * sin(th), aOrb.z);
  float vis;
  vec3 col;
  float px = 1.2;
  if (aKind < 0.5) {
    vis = uBelt * 0.22;
    col = vec3(0.75, 0.68, 0.6);
  } else if (aKind < 1.5) {
    vis = uBelt * 0.35;
    col = vec3(0.6, 0.7, 0.85);
  } else {
    /* 원시 원반: 행성이 자라며 길을 쓸어 냄 */
    float gap = 1.0;
    for (int i = 0; i < 8; i++) {
      float w = uPlA[i] * 0.08 + 0.05;
      gap *= 1.0 - uPlB[i] * exp(-pow((aOrb.x - uPlA[i]) / w, 2.0));
    }
    vis = uDisk * gap * 6.0 / (0.25 + aOrb.x * 0.12);
    float hot = exp(-aOrb.x / 1.5);
    col = mix(vec3(0.75, 0.42, 0.22), vec3(1.0, 0.85, 0.6), hot);
    px = 1.3;
    if (uCloud > 0.0) {
      float u = hash(aOrb.w * 91.7), v = hash(aOrb.w * 17.3 + 3.1);
      float ph = acos(2.0 * u - 1.0), lam = 6.2831853 * v;
      vec3 sph = vec3(sin(ph) * cos(lam), sin(ph) * sin(lam), cos(ph)) * (300.0 + 4000.0 * hash(aOrb.w * 7.7));
      p = mix(p, sph, uCloud);
      col = mix(col, vec3(0.5, 0.3, 0.42), uCloud);
      vis = max(vis, uCloud * 0.8);
    }
  }
  p *= uRip;
  vec4 vp = uMV * vec4(p, 1.0);
  gl_Position = uP * vp;
  gl_PointSize = px * 2.0;
  float lit = 0.4 + 0.6 * clamp(uSunL, 0.0, 3.0) / (1.0 + a * 0.15);
  vCol = col * vis * uAlpha * 0.18 * lit;
  vK = 0.0;
}`;

  /* 행성상 성운: 두 갈래로 부푼 빛나는 껍질 (안쪽은 청록, 가장자리는 붉은 수소·질소 빛) */
  const NEB_VS = `#version 300 es
precision highp float;
layout(location = 0) in vec4 aDir;
uniform mat4 uMV;
uniform mat4 uP;
uniform float uR, uNeb, uAlpha, uProj;
out vec3 vCol;
out float vK;
void main() {
  vec3 d = aDir.xyz;
  float lobe = 1.0 + 0.9 * d.z * d.z;
  float waist = 1.0 - 0.35 * exp(-d.z * d.z * 12.0);
  float shell = 0.55 + 0.45 * aDir.w;
  vec3 p = d * uR * lobe * waist * shell;
  vec4 vp = uMV * vec4(p, 1.0);
  float dist = max(length(vp.xyz), 1e-9);
  float size = clamp(uR * 0.06 * uProj / dist, 1.5, 9.0);
  gl_Position = uP * vp;
  gl_PointSize = size * 2.0;
  float rim = smoothstep(0.8, 1.0, shell);
  vec3 col = mix(vec3(0.2, 0.9, 0.85), vec3(1.0, 0.28, 0.32), rim * (0.6 + 0.4 * (1.0 - d.z * d.z)));
  vCol = col * uNeb * uAlpha * 0.5 / (size * size) * (0.4 + 0.6 * aDir.w);
  vK = 0.0;
}`;

  /* 궤도 선 */
  const LINE_VS = `#version 300 es
precision highp float;
layout(location = 0) in vec3 aPos;
uniform mat4 uMV;
uniform mat4 uP;
void main() { gl_Position = uP * (uMV * vec4(aPos, 1.0)); }`;
  const LINE_FS = `#version 300 es
precision highp float;
uniform vec3 uColor;
out vec4 o;
void main() { o = vec4(uColor, 0.0); }`;

  /* ---------- 행성·태양·빛무리·고리·블랙홀 (화면을 향한 사각형) ---------- */
  const BODY_VS = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aCorner;
uniform vec3 uCenter;
uniform float uRadius;
uniform mat4 uP;
uniform float uKind;
uniform vec3 uRingU, uRingV;
out vec2 vUV;
out vec3 vView;
void main() {
  vec3 p = uKind > 2.5 && uKind < 3.5 ? uCenter + aCorner.x * uRingU + aCorner.y * uRingV : uCenter + vec3(aCorner * uRadius, 0.0);
  vUV = aCorner;
  vView = p;
  gl_Position = uP * vec4(p, 1.0);
}`;

  const BODY_FS = `#version 300 es
precision highp float;
in vec2 vUV;
in vec3 vView;
uniform float uKind, uIntensity, uGlow, uBands, uSeed, uTime, uEarth, uRadius;
uniform vec3 uColor, uLight, uCenter, uSpin;
out vec4 o;
${NOISE}
void main() {
  float r2 = dot(vUV, vUV);
  float r = sqrt(r2);
  if (uKind < 0.5) {
    if (r > 1.0) discard;
    vec3 n = vec3(vUV, sqrt(max(0.0, 1.0 - r2)));
    float ndl = dot(n, uLight);
    float lat = dot(n, uSpin);
    vec3 base = uColor;
    if (uBands > 0.0) base *= 0.82 + 0.22 * sin(lat * 16.0 + 1.6 * snoise(n * 3.0 + uSeed));
    if (uEarth > 0.0) {
      float land = snoise(n * 2.4 + uSeed);
      base = mix(base, base * vec3(1.1, 0.95, 0.6) + vec3(0.05, 0.06, 0.0), smoothstep(0.15, 0.3, land) * uEarth);
      float cl = snoise(n * 5.0 + vec3(uTime * 0.05, 0.0, uSeed));
      base = mix(base, vec3(1.0), smoothstep(0.2, 0.6, cl) * 0.65);
    }
    float light = smoothstep(-0.08, 0.3, ndl) * (0.35 + 0.65 * max(ndl, 0.0)) + 0.025;
    vec3 col = base * light * uIntensity + uColor * uGlow * (0.6 + 0.4 * snoise(n * 6.0 + uTime * 0.1));
    col += uColor * pow(1.0 - n.z, 3.0) * 0.35 * smoothstep(-0.2, 0.4, ndl) * uIntensity;
    float aa = 1.0 - smoothstep(1.0 - 2.5 * fwidth(r), 1.0, r);
    o = vec4(col * aa, aa);
  } else if (uKind < 1.5) {
    if (r > 1.0) discard;
    float mu = sqrt(max(0.0, 1.0 - r2));
    float limb = 0.4 + 0.6 * mu;
    float gran = 0.9 + 0.1 * snoise(vec3(vUV * 18.0, uTime * 0.15 + uSeed));
    float aa = 1.0 - smoothstep(1.0 - 2.5 * fwidth(r), 1.0, r);
    o = vec4(uColor * uIntensity * limb * gran * aa, aa);
  } else if (uKind < 2.5) {
    float g = exp(-r * 5.0) * 0.7 + exp(-r * 14.0) * 0.6;
    g *= 1.0 - smoothstep(0.75, 1.0, r);
    o = vec4(uColor * uIntensity * g, 0.0);
  } else if (uKind < 3.5) {
    if (r < 0.5 || r > 1.0) discard;
    float band = 0.55 + 0.45 * sin(r * 70.0) * sin(r * 23.0 + 1.0);
    band *= smoothstep(0.5, 0.56, r) * (1.0 - smoothstep(0.93, 1.0, r)) * (r > 0.78 && r < 0.8 ? 0.15 : 1.0);
    /* 행성 뒤에 가려진 고리 */
    vec2 dp = vView.xy - uCenter.xy;
    if (vView.z < uCenter.z && dot(dp, dp) < uRadius * uRadius) discard;
    vec3 col = uColor * band * uIntensity;
    o = vec4(col * 0.8, 0.8 * band);
  } else {
    /* 블랙홀: 검은 그림자와 빛의 고리 */
    if (r > 1.0) discard;
    float ring = exp(-pow((r - 0.42) / 0.035, 2.0)) * 1.6 + exp(-pow((r - 0.5) / 0.12, 2.0)) * 0.35 * (0.7 + 0.3 * snoise(vec3(vUV * 6.0, uTime * 0.3)));
    float shadow = 1.0 - smoothstep(0.36, 0.4, r);
    vec3 col = uColor * ring * uIntensity;
    o = vec4(col, max(shadow, ring * 0.3));
  }
}`;

  /* ---------- 후처리 ---------- */
  const QUAD_VS = `#version 300 es
precision highp float;
const vec2 P[3] = vec2[3](vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0));
void main() { gl_Position = vec4(P[gl_VertexID], 0.0, 1.0); }`;

  const DOWN_FS = `#version 300 es
precision highp float;
uniform sampler2D uSrc;
uniform vec2 uTexel;
uniform float uKnee;
out vec4 o;
void main() {
  vec2 uv = gl_FragCoord.xy * uTexel * 2.0;
  vec2 h = uTexel * 0.5;
  vec3 c = texture(uSrc, uv + vec2(-h.x, -h.y)).rgb + texture(uSrc, uv + vec2(h.x, -h.y)).rgb +
           texture(uSrc, uv + vec2(-h.x, h.y)).rgb + texture(uSrc, uv + vec2(h.x, h.y)).rgb;
  c *= 0.25;
  if (uKnee > 0.0) {
    float l = max(c.r, max(c.g, c.b));
    c *= smoothstep(uKnee * 0.4, uKnee * 2.0, l);
  }
  o = vec4(c, 1.0);
}`;

  const BLUR_FS = `#version 300 es
precision highp float;
uniform sampler2D uSrc;
uniform vec2 uDir;
uniform vec2 uRes;
out vec4 o;
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec3 c = texture(uSrc, uv).rgb * 0.227027;
  c += texture(uSrc, uv + uDir * 1.3846153846).rgb * 0.3162162162;
  c += texture(uSrc, uv - uDir * 1.3846153846).rgb * 0.3162162162;
  c += texture(uSrc, uv + uDir * 3.2307692308).rgb * 0.0702702703;
  c += texture(uSrc, uv - uDir * 3.2307692308).rgb * 0.0702702703;
  o = vec4(c, 1.0);
}`;

  const COMPOSITE_FS = `#version 300 es
precision highp float;
uniform sampler2D uScene, uB1, uB2, uB3;
uniform vec2 uRes;
uniform float uExposure, uBloom, uPlasma, uCMB, uBirth, uTime, uFlash, uPlasmaScale, uHdr;
uniform vec3 uPlasmaCol, uCMBCol, uCamR, uCamU, uCamF;
uniform vec2 uTan;
out vec4 o;
${NOISE}
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec3 col = texture(uScene, uv).rgb;
  col += (texture(uB1, uv).rgb * 0.35 + texture(uB2, uv).rgb * 0.55 + texture(uB3, uv).rgb * 0.75) * uBloom;
  vec2 ndc = uv * 2.0 - 1.0;
  vec3 dir = normalize(uCamF + ndc.x * uTan.x * uCamR + ndc.y * uTan.y * uCamU);
  if (uCMB > 0.001) {
    float n = fbm3(dir * 5.0);
    col += uCMBCol * uCMB * (1.0 + 0.6 * n);
  }
  if (uPlasma > 0.001) {
    float n = fbm3(dir * uPlasmaScale + vec3(0.0, uTime * 0.04, 0.0));
    float n2 = snoise(dir * uPlasmaScale * 3.7 - vec3(uTime * 0.11));
    vec3 pc = uPlasmaCol * (0.75 + 0.55 * n + 0.2 * n2);
    float a = uPlasma;
    if (uBirth < 1.0) {
      float rr = length(ndc * vec2(uRes.x / uRes.y, 1.0));
      float rad = max(uBirth, 0.002) * 2.2;
      a *= 1.0 - smoothstep(rad * 0.55, rad, rr);
      pc *= 1.0 + 3.0 * exp(-rr / max(rad * 0.25, 0.002));
    }
    col = mix(col, pc, a);
  }
  col += vec3(uFlash);
  col *= uExposure;
  col = (col * (2.51 * col + 0.03)) / (col * (2.43 * col + 0.59) + 0.14);
  col = pow(clamp(col, 0.0, 1.0), vec3(1.0 / 2.2));
  col *= 1.0 - 0.16 * dot(ndc * 0.75, ndc * 0.75);
  col += (hash(gl_FragCoord.xy + fract(uTime) * 61.0) - 0.5) / 255.0;
  o = vec4(col, 1.0);
}`;


  /* ---------- 은하 문명: 영역의 빛, 별 점, 이주선, 전투 섬광 ---------- */
  const CIV_VS = `#version 300 es
precision highp float;
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec4 aCol;
layout(location = 2) in vec2 aSize;
uniform mat4 uMV;
uniform mat4 uP;
uniform float uProj, uMaxPx, uPx;
out vec4 vCol;
void main() {
  vec4 vp = uMV * vec4(aPos, 1.0);
  float d = max(length(vp.xyz), 1e-6);
  float size = clamp(aSize.x * uProj / d, aSize.y * uPx, uMaxPx);
  gl_Position = uP * vp;
  gl_PointSize = size * 2.0;
  vCol = aCol;
}`;
  const CIV_FS = `#version 300 es
precision highp float;
in vec4 vCol;
uniform float uMode;
out vec4 o;
void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(c, c);
  if (r2 > 1.0) discard;
  float r = sqrt(r2);
  if (uMode < 0.5) {
    float a = vCol.a * (1.0 - smoothstep(0.25, 1.0, r));
    o = vec4(vCol.rgb * a, a);
  } else if (uMode < 1.5) {
    o = vec4(vCol.rgb * vCol.a * (exp(-r2 * 6.0) + exp(-r2 * 40.0)), 0.0);
  } else {
    float ring = exp(-pow((r - 0.72) / 0.1, 2.0)) + exp(-r2 * 10.0) * 0.7;
    o = vec4(vCol.rgb * vCol.a * ring, 0.0);
  }
}`;
  const LINE2_VS = `#version 300 es
precision highp float;
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec4 aCol;
uniform mat4 uMV;
uniform mat4 uP;
out vec4 vCol;
void main() { vCol = aCol; gl_Position = uP * (uMV * vec4(aPos, 1.0)); }`;
  const LINE2_FS = `#version 300 es
precision highp float;
in vec4 vCol;
out vec4 o;
void main() { o = vec4(vCol.rgb * vCol.a, 0.0); }`;

  UC.shaders = {
    STAR_VS, POINT_FS, WEB_VS, SIMPLE_VS, BELT_VS, NEB_VS, LINE_VS, LINE_FS,
    BODY_VS, BODY_FS, QUAD_VS, DOWN_FS, BLUR_FS, COMPOSITE_FS,
    CIV_VS, CIV_FS, LINE2_VS, LINE2_FS,
  };
})();
