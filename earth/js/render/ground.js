'use strict';

/*
 * 지상 장면 셰이더: 땅(높이장 광선 행진), 하늘(대기 산란), 구름, 해·달·별, 물, 바닷속.
 * 지형 함수 terrainH 는 js/field/terrain.js 와 똑같아야 합니다 (생물을 땅 위에 세우기 위해).
 */
(function () {
  const EC = (window.EC = window.EC || {});
  EC.render = EC.render || {};

  EC.render.GROUND_FRAG = `#version 300 es
precision highp float;
out vec4 fragColor;

uniform vec2 uRes;
uniform float uTime;
uniform vec3 uCamPos, uCamRight, uCamUp, uCamFwd;
uniform float uTanHalfFov;

uniform vec3 uSunDir, uSunColor;
uniform float uSunAng, uSunI;
uniform vec3 uSunLight, uSkyZenith, uSkyHorizon;
uniform vec3 uMoonDir;
uniform float uMoonAng, uStars;
uniform vec3 uBetaR, uBetaM, uMieAbs;   // 1/km

uniform vec2 uSeed, uSeaDir;
uniform float uHillAmp, uHillFreq, uRough, uMtnAmp, uMtnNear, uDune, uCanopy, uBaseH, uCoast, uCoastDist;
uniform float uUnder, uDepth;
uniform vec3 uGrass, uRock, uSand, uSoil, uWaterDeep, uWaterShallow, uCloudColor;
uniform float uVeg, uSandAmt, uSnow, uSnowLine, uMats, uLava, uIce, uFogK, uCloud, uExposure, uFade, uSalt, uMaxH;

const float PI = 3.14159265359;
const float RP = 6371.0;
const float RAT = 6451.0;
const float HRk = 8.0;
const float HMk = 1.2;

${EC.render.NOISE}

float fbm2(vec2 p, int oct) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 10; i++) {
    if (i >= oct) break;
    s += a * snoise(vec3(p.x, 7.31, p.y));
    p = mat2(1.6, -1.2, 1.2, 1.6) * p + vec2(1.7, 9.2);
    a *= 0.5;
  }
  return s;
}
float ridged2(vec2 p, int oct) {
  float s = 0.0, a = 0.5, w = 1.0;
  for (int i = 0; i < 10; i++) {
    if (i >= oct) break;
    float n = 1.0 - abs(snoise(vec3(p.x, 3.71, p.y)));
    n *= n;
    s += a * n * w;
    w = min(1.0, n * 2.0);
    p = mat2(1.6, -1.2, 1.2, 1.6) * p + vec2(3.3, 7.7);
    a *= 0.5;
  }
  return s;
}

int octFor(float t) { return int(clamp(7.0 - log2(1.0 + t * 0.02), 3.0, 7.0)); }

float terrainH(vec2 p, int oct) {
  vec2 q = p + uSeed;
  float r = length(p);
  float near = smoothstep(3.0, 40.0, r);
  float seaMask = 0.0;
  float s = 0.0;
  if (uCoast > 0.5) {
    s = dot(p, uSeaDir) - uCoastDist;
    seaMask = smoothstep(-250.0, -40.0, s);
  }
  float h = uHillAmp * fbm2(q * uHillFreq, oct) * (0.3 + 0.7 * near);
  h += uRough * fbm2(q * 0.06, max(oct - 3, 2)) * (0.4 + 0.6 * near);
  if (uMtnAmp > 0.0 && r > uMtnNear) h += uMtnAmp * ridged2(q * 0.00045, min(oct, 6)) * smoothstep(uMtnNear, uMtnNear * 6.0, r) * (1.0 - seaMask);
  if (uDune > 0.0) {
    float d = sin(dot(q, vec2(0.011, 0.0045)) + fbm2(q * 0.0025, 3) * 2.6);
    h += uDune * 12.0 * (1.0 - d * d) * near * (1.0 - seaMask);
  }
  if (uCanopy > 0.0) h += uCanopy * 16.0 * smoothstep(90.0, 260.0, r) * (0.55 + 0.45 * fbm2(q * 0.035, 3)) * (1.0 - seaMask);
  h += uBaseH;
  if (uCoast > 0.5) h -= smoothstep(-150.0, 250.0, s) * (uBaseH + 30.0) + max(s, 0.0) * 0.015;
  return h;
}

/* ---------- 하늘 ---------- */
vec2 sphere2(vec3 ro, vec3 rd, float r) {
  float b = dot(ro, rd);
  float c = dot(ro, ro) - r * r;
  float h = b * b - c;
  if (h < 0.0) return vec2(-1.0);
  h = sqrt(h);
  return vec2(-b - h, -b + h);
}
vec3 ext(vec2 od) { return uBetaR * od.x + (uBetaM * 1.1 + uMieAbs) * od.y; }
vec2 lightODk(vec3 p) {
  vec2 a = sphere2(p, uSunDir, RAT);
  float g = sphere2(p, uSunDir, RP).x;
  if (g > 0.0) return vec2(1e5);
  float ds = a.y / 3.0;
  vec2 od = vec2(0.0);
  for (int i = 0; i < 3; i++) {
    vec3 s = p + uSunDir * ds * (float(i) + 0.5);
    float h = length(s) - RP;
    od += vec2(exp(-h / HRk), exp(-h / HMk)) * ds;
  }
  return od;
}
vec3 skyScatter(vec3 rd, out vec3 trans) {
  vec3 ro = vec3(0.0, RP + 0.002 + max(uCamPos.y, 0.0) * 0.001, 0.0);
  vec3 d = normalize(vec3(rd.x, max(rd.y, 0.004), rd.z));
  float tmax = sphere2(ro, d, RAT).y;
  const int N = 6;
  vec2 odV = vec2(0.0);
  vec3 sR = vec3(0.0), sM = vec3(0.0);
  float prev = 0.0;
  for (int i = 0; i < N; i++) {
    float f = (float(i) + 1.0) / float(N);
    float tt = tmax * f * f;
    float ds = tt - prev;
    vec3 p = ro + d * (prev + ds * 0.5);
    prev = tt;
    float h = length(p) - RP;
    vec2 dens = vec2(exp(-h / HRk), exp(-h / HMk)) * ds;
    odV += dens;
    vec3 att = exp(-ext(odV + lightODk(p)));
    sR += att * dens.x;
    sM += att * dens.y;
  }
  float mu = dot(d, uSunDir);
  float pR = 0.0596831 * (1.0 + mu * mu);
  float g = 0.76;
  float pM = 0.1193662 * ((1.0 - g * g) * (1.0 + mu * mu)) / ((2.0 + g * g) * pow(max(1.0 + g * g - 2.0 * g * mu, 1e-4), 1.5));
  trans = exp(-ext(odV));
  return (sR * uBetaR * pR + sM * uBetaM * pM) * uSunColor * uSunI;
}

float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }

vec3 sky(vec3 rd, bool full) {
  vec3 trans;
  vec3 col = skyScatter(rd, trans);
  if (!full) return col;
  /* 별 */
  if (uStars > 0.01 && rd.y > 0.0) {
    vec2 sp = vec2(atan(rd.x, rd.z), asin(rd.y)) * 160.0;
    vec2 cell = floor(sp);
    float h = hash12(cell);
    if (h > 0.985) {
      vec2 o = vec2(hash12(cell + 3.1), hash12(cell + 7.7)) - 0.5;
      float dd = length(fract(sp) - 0.5 - o * 0.6);
      col += smoothstep(0.12, 0.0, dd) * (h - 0.985) / 0.015 * uStars * 1.5 * trans * (0.8 + 0.2 * sin(uTime * 3.0 + h * 40.0));
    }
  }
  /* 해 */
  float sa = acos(clamp(dot(rd, uSunDir), -1.0, 1.0));
  if (rd.y > -0.02) {
    col += uSunColor * uSunI * 4.0 * smoothstep(uSunAng * 1.05, uSunAng * 0.95, sa) * trans;
    col += uSunColor * trans * uSunI * 0.02 * exp(-sa / max(uSunAng * 2.5, 0.02));
  }
  /* 달: 둥근 공으로 그려 위상(초승달·보름달)이 맞게 */
  float ma = acos(clamp(dot(rd, uMoonDir), -1.0, 1.0));
  if (ma < uMoonAng && rd.y > -0.02) {
    vec3 mr = normalize(cross(uMoonDir, vec3(0.0, 1.0, 0.0)));
    vec3 mu2 = cross(mr, uMoonDir);
    vec2 o = vec2(dot(rd, mr), dot(rd, mu2)) / sin(uMoonAng);
    float z = sqrt(max(0.0, 1.0 - dot(o, o)));
    vec3 nrm = normalize(o.x * mr + o.y * mu2 - z * uMoonDir);
    float lit = max(dot(nrm, uSunDir), 0.0);
    float maria = smoothstep(0.0, 0.4, fbm4(nrm * 2.0 + 3.0));
    vec3 mc = mix(vec3(0.62), vec3(0.36), maria) * (lit * uSunI * 0.06 + 0.004);
    float edge = smoothstep(1.0, 0.96, length(o));
    col = mix(col, mc + col * 0.15, edge * (0.85 + 0.15 * smoothstep(0.0, 0.3, uStars)));
  }
  /* 구름 */
  if (uCloud > 0.01 && rd.y > 0.0) {
    float tc = (2200.0 - uCamPos.y) / rd.y;
    vec2 cp = (uCamPos.xz + rd.xz * tc) * 0.00032 + uSeed * 0.0003 + vec2(uTime * 0.004, 0.0);
    float c = fbm2(cp, 6) * 0.6 + 0.5;
    float dens = smoothstep(1.0 - uCloud, 1.0 - uCloud + 0.25, c);
    float c2 = fbm2(cp + uSunDir.xz * 0.06, 4) * 0.6 + 0.5;
    float shade = 0.55 + 0.45 * smoothstep(0.7, 0.3, c2 - (1.0 - uCloud));
    vec3 cl = uCloudColor * (uSunLight * (0.4 + 0.6 * shade) * 1.2 + uSkyZenith * 0.8);
    float fade = exp(-tc * 0.00002);
    col = mix(col, cl, dens * fade * 0.92);
  }
  return col;
}

/* ---------- 땅 ---------- */
float castTerrain(vec3 ro, vec3 rd, float tmax) {
  /* 가장 높은 땅보다 위로 올라가는 광선은 일찍 끝냅니다 */
  if (rd.y > 0.0) {
    if (ro.y > uMaxH) return -1.0;
    tmax = min(tmax, (uMaxH - ro.y) / rd.y);
  }
  float t = 0.1;
  float lastT = 0.0;
  float lastD = 1.0;
  for (int i = 0; i < 110; i++) {
    vec3 p = ro + rd * t;
    float d = p.y - terrainH(p.xz, octFor(t));
    if (d < 0.0) {
      return lastT + (t - lastT) * lastD / max(lastD - d, 1e-4);
    }
    lastT = t;
    lastD = d;
    t += max(d * 0.45, 0.04 + t * 0.008);
    if (t > tmax) return -1.0;
  }
  /* 거의 수평인 광선은 걸음 수가 모자랄 수 있습니다. 여기까지 왔다면 땅 위를 스치는 중이므로
     하늘(구멍)로 그리지 않고 마지막 지점을 땅으로 칩니다. 이 거리면 안개에 거의 덮입니다. */
  return lastT;
}

float softShadow(vec3 p, vec3 l) {
  float res = 1.0;
  float t = 1.0;
  for (int i = 0; i < 14; i++) {
    vec3 q = p + l * t;
    if (q.y > uMaxH) break;
    float d = q.y - terrainH(q.xz, 3);
    res = min(res, 10.0 * d / t);
    if (res < 0.02) break;
    t += clamp(d * 0.8, 3.0, 200.0);
    if (t > 2500.0) break;
  }
  return clamp(res, 0.0, 1.0);
}

vec3 terrainNormal(vec3 p, float t) {
  float e = max(0.06, t * 0.0016);
  int o = max(octFor(t) - 1, 3);
  float hx = terrainH(p.xz + vec2(e, 0.0), o) - terrainH(p.xz - vec2(e, 0.0), o);
  float hz = terrainH(p.xz + vec2(0.0, e), o) - terrainH(p.xz - vec2(0.0, e), o);
  return normalize(vec3(-hx, 2.0 * e, -hz));
}

vec3 shadeGround(vec3 p, vec3 n, float t, out vec3 emit) {
  emit = vec3(0.0);
  float slope = 1.0 - n.y;
  float tex = fbm2(p.xz * 0.09 + uSeed, 4) * 0.5 + 0.5;
  float fine = snoise(vec3(p.xz * 1.7, 1.0)) * 0.5 + 0.5;
  vec3 soil = uSoil * (0.8 + 0.35 * tex);
  /* 풀밭: 큰 얼룩(마른 곳·젖은 곳)과 가까이 보이는 잔무늬 */
  float patchy = fbm2(p.xz * 0.012 + uSeed * 0.3, 3) * 0.5 + 0.5;
  float blades = t < 80.0 ? (snoise(vec3(p.xz * 3.1, 5.0)) * 0.5 + 0.5) * (1.0 - smoothstep(20.0, 80.0, t)) : 0.5;
  vec3 grass = uGrass * (0.62 + 0.45 * tex) * (0.8 + 0.35 * fine) * (0.75 + 0.5 * blades);
  grass = mix(grass, mix(uGrass, uSoil, 0.55) * 1.1, smoothstep(0.55, 0.85, patchy) * 0.6);
  float vegMask = uVeg * smoothstep(0.42, 0.18, slope) * smoothstep(0.2, 0.5, tex + 0.15);
  vec3 col = mix(soil, grass, vegMask);
  /* 멀리 보이는 숲: 나무 꼭대기들이 모인 짙은 초록 */
  if (uCanopy > 0.0) {
    float r = length(p.xz);
    float cm = uCanopy * smoothstep(80.0, 220.0, r);
    if (uCoast > 0.5) cm *= 1.0 - smoothstep(-250.0, -40.0, dot(p.xz, uSeaDir) - uCoastDist);
    float crowns = smoothstep(-0.3, 0.7, snoise(vec3(p.xz * 0.11, 3.0))) * 0.5 + smoothstep(-0.2, 0.8, snoise(vec3(p.xz * 0.37, 9.0))) * 0.5;
    crowns = mix(crowns, 0.5, smoothstep(250.0, 900.0, t));
    vec3 canopyC = uGrass * vec3(0.55, 0.7, 0.55) * (0.55 + 0.7 * crowns);
    col = mix(col, canopyC, cm * smoothstep(0.5, 0.25, slope));
  }
  float sandM = max(uSandAmt, uCoast > 0.5 ? smoothstep(3.0, 0.5, p.y) : 0.0);
  col = mix(col, uSand * (0.85 + 0.25 * fine), sandM * (1.0 - smoothstep(0.35, 0.6, slope)));
  float strata = 0.85 + 0.15 * sin(p.y * 0.9 + fbm2(p.xz * 0.02, 2) * 3.0);
  col = mix(col, uRock * strata * (0.8 + 0.3 * tex), smoothstep(0.32, 0.6, slope));
  if (uMats > 0.0) {
    float wet = uCoast > 0.5 ? smoothstep(4.0, 0.3, p.y) : uUnder;
    col = mix(col, mix(vec3(0.16, 0.22, 0.10), vec3(0.24, 0.14, 0.20), tex), uMats * wet * 0.75);
  }
  if (uSalt > 0.0) col = mix(col, vec3(0.78, 0.75, 0.70) * (0.9 + 0.1 * fine), uSalt * smoothstep(0.3, 0.6, tex));
  float snow = max(uSnow, smoothstep(uSnowLine, uSnowLine + 120.0, p.y + tex * 60.0));
  col = mix(col, vec3(0.86, 0.89, 0.94) * (0.92 + 0.08 * fine), snow * (1.0 - smoothstep(0.5, 0.75, slope) * (1.0 - uIce)));
  if (uIce > 0.0) {
    float crack = 1.0 - smoothstep(0.0, 0.03, abs(snoise(vec3(p.xz * 0.03, 2.0))));
    col = mix(col, vec3(0.55, 0.7, 0.85), crack * uIce * 0.5);
  }
  if (uLava > 0.0) {
    col = mix(col, vec3(0.06, 0.05, 0.05) * (0.7 + 0.6 * tex), uLava);
    /* 멀리 있는 가는 균열은 화면에서 깜빡이지 않도록 평균 빛으로 바꿉니다 */
    float w1 = 0.06 + t * 0.00012;
    float w2 = 0.04 + t * 0.0006;
    float c1 = (1.0 - smoothstep(0.0, w1, abs(snoise(vec3(p.xz * 0.025, uTime * 0.02))))) * (1.0 - smoothstep(600.0, 2500.0, t));
    float c2 = (1.0 - smoothstep(0.0, w2, abs(snoise(vec3(p.xz * 0.11, 4.0 + uTime * 0.03))))) * (1.0 - smoothstep(60.0, 300.0, t));
    float avg = 0.12 * smoothstep(300.0, 2500.0, t);
    emit = vec3(1.0, 0.3, 0.04) * (c1 * 3.0 + c2 * 1.5 + avg) * uLava * (0.7 + 0.3 * sin(uTime * 2.0 + p.x * 0.1));
  }
  return col;
}

vec3 underwaterFog(float depthBelowSurface) {
  return uWaterShallow * exp(-depthBelowSurface * 0.025) * (uSunLight * 0.8 + uSkyZenith * 0.6);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  vec3 rd = normalize(uCamFwd + (uv.x * uCamRight + uv.y * uCamUp) * 2.0 * uTanHalfFov);
  vec3 ro = uCamPos;
  vec3 col;

  if (uUnder > 0.5) {
    /* ---------- 바닷속 ---------- */
    float tSurf = rd.y > 0.0 ? -ro.y / rd.y : 1e9;
    float tT = castTerrain(ro, rd, 400.0);
    vec3 fogC = underwaterFog(-ro.y + 4.0);
    float k = 0.022 + 0.02 * smoothstep(20.0, 80.0, uDepth);
    if (tT > 0.0 && tT < tSurf) {
      vec3 p = ro + rd * tT;
      vec3 n = terrainNormal(p, tT);
      vec3 e;
      vec3 alb = shadeGround(p, n, tT, e);
      float caust = pow(1.0 - abs(snoise(vec3(p.xz * 0.35, uTime * 0.5))), 6.0) + pow(1.0 - abs(snoise(vec3(p.xz * 0.6 + 4.0, uTime * 0.7))), 8.0);
      float lightDepth = exp(-(-p.y) * 0.03);
      vec3 lit = (uSunLight * max(n.y, 0.0) * (0.6 + caust * 0.9) * lightDepth + uSkyZenith * 0.5 * lightDepth) * mix(vec3(1.0), uWaterShallow * 2.2, 0.6);
      col = alb * lit + e;
      col = mix(col, fogC, 1.0 - exp(-tT * k));
    } else if (tSurf < 1e8) {
      vec3 p = ro + rd * tSurf;
      float wv = snoise(vec3(p.xz * 0.15, uTime * 0.4)) * 0.5 + 0.5;
      float cosI = rd.y;
      float window = smoothstep(0.62, 0.72, cosI);
      vec3 surf = mix(fogC * 1.4, (uSunLight + uSkyZenith) * 1.2 * mix(vec3(1.0), uWaterShallow * 3.0, 0.4), window) * (0.8 + 0.4 * wv);
      surf += uSunLight * 2.0 * pow(max(dot(rd, uSunDir), 0.0), 40.0) * window;
      col = mix(surf, fogC, 1.0 - exp(-tSurf * k * 0.6));
    } else {
      col = fogC * (0.6 + 0.4 * smoothstep(-0.5, 0.5, rd.y));
    }
    /* 빛줄기 */
    float rays = pow(max(0.0, snoise(vec3(rd.x * 6.0 + uTime * 0.05, rd.z * 6.0, uTime * 0.1))), 3.0) * smoothstep(-0.1, 0.6, rd.y);
    col += uSunLight * rays * 0.12 * smoothstep(80.0, 5.0, uDepth);
  } else {
    /* ---------- 땅 위 ---------- */
    float tT = castTerrain(ro, rd, 6000.0);
    float tW = (uCoast > 0.5 && rd.y < 0.0) ? -ro.y / rd.y : 1e9;
    bool hitW = tW < 1e8 && (tT < 0.0 || tW < tT);
    vec3 fogC = uSkyHorizon + uSunColor * uSunI * 0.006 * pow(max(dot(rd, uSunDir), 0.0), 6.0);
    if (hitW) {
      vec3 p = ro + rd * tW;
      vec2 wp = p.xz * 0.25;
      float e = 0.5;
      float h0 = snoise(vec3(wp, uTime * 0.35));
      float hx = snoise(vec3(wp + vec2(e * 0.25, 0.0), uTime * 0.35));
      float hz = snoise(vec3(wp + vec2(0.0, e * 0.25), uTime * 0.35));
      float amp = 0.35 / (1.0 + tW * 0.01);
      vec3 n = normalize(vec3((h0 - hx) * amp * 4.0, 1.0, (h0 - hz) * amp * 4.0));
      vec3 rf = reflect(rd, n);
      rf.y = abs(rf.y);
      float fres = 0.02 + 0.98 * pow(1.0 - max(dot(n, -rd), 0.0), 5.0);
      fres = min(fres, 0.75);
      float floorH = terrainH(p.xz, 4);
      float depth = max(0.0, -floorH);
      vec3 under = mix(uWaterShallow * 1.6, uWaterDeep, smoothstep(0.5, 18.0, depth)) * (uSunLight * 0.7 + uSkyZenith * 0.6);
      vec3 refl = sky(rf, false) * 0.8 * mix(vec3(1.0), uWaterShallow * 3.5 + 0.25, 0.35);
      col = mix(under, refl, fres * 0.85);
      col += uSunLight * 3.0 * pow(max(dot(rf, uSunDir), 0.0), 400.0);
      float foam = smoothstep(0.6, 0.0, depth) * (0.5 + 0.5 * snoise(vec3(p.xz * 0.8, uTime)));
      col = mix(col, (uSunLight + uSkyZenith) * 0.8, foam * 0.5);
      col = mix(col, fogC, 1.0 - exp(-tW * uFogK));
    } else if (tT > 0.0) {
      vec3 p = ro + rd * tT;
      vec3 n = terrainNormal(p, tT);
      vec3 emit;
      vec3 alb = shadeGround(p, n, tT, emit);
      float ndl = max(dot(n, uSunDir), 0.0);
      float sh = ndl > 0.0 && uSunDir.y > -0.05 ? (tT < 1800.0 ? mix(softShadow(p + n * 0.3, uSunDir), 1.0, smoothstep(700.0, 1800.0, tT)) : 1.0) : 0.0;
      vec3 amb = mix(uSkyHorizon * 0.5, uSkyZenith, n.y * 0.5 + 0.5) * 0.8;
      col = alb * (uSunLight * ndl * sh + amb) + emit;
      col = mix(col, fogC, 1.0 - exp(-tT * uFogK));
    } else {
      col = sky(rd, true);
    }
  }

  col *= uExposure;
  col = (col * (2.51 * col + 0.03)) / (col * (2.43 * col + 0.59) + 0.14);
  col = pow(clamp(col, 0.0, 1.0), vec3(1.0 / 2.2));
  col *= uFade;
  float vig = 1.0 - 0.18 * dot(uv, uv);
  fragColor = vec4(col * vig, 1.0);
}
`;

  /* 지구 셰이더와 같은 WebGL 컨텍스트를 함께 씁니다 */
  class GroundRenderer {
    constructor(gl) {
      this.gl = gl;
      const mk = (type, src) => {
        const sh = gl.createShader(type);
        gl.shaderSource(sh, src);
        gl.compileShader(sh);
        if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error('지상 셰이더 컴파일 실패: ' + gl.getShaderInfoLog(sh));
        return sh;
      };
      const prog = gl.createProgram();
      gl.attachShader(prog, mk(gl.VERTEX_SHADER, EC.render.VERT));
      gl.attachShader(prog, mk(gl.FRAGMENT_SHADER, EC.render.GROUND_FRAG));
      gl.bindAttribLocation(prog, 0, 'aPos');
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('지상 셰이더 연결 실패: ' + gl.getProgramInfoLog(prog));
      this.prog = prog;
      this.loc = {};
      const n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < n; i++) {
        const info = gl.getActiveUniform(prog, i);
        this.loc[info.name.replace(/\[0\]$/, '')] = gl.getUniformLocation(prog, info.name);
      }
    }

    render(canvas, cam, u) {
      const gl = this.gl;
      const L = this.loc;
      gl.useProgram(this.prog);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(L.uRes, canvas.width, canvas.height);
      gl.uniform3fv(L.uCamPos, cam.pos);
      gl.uniform3fv(L.uCamRight, cam.right);
      gl.uniform3fv(L.uCamUp, cam.up);
      gl.uniform3fv(L.uCamFwd, cam.fwd);
      gl.uniform1f(L.uTanHalfFov, cam.tanHalf);
      for (const k in u) {
        const loc = L[k];
        if (!loc) continue;
        const v = u[k];
        if (typeof v === 'number') gl.uniform1f(loc, v);
        else if (v.length === 2) gl.uniform2fv(loc, v);
        else if (v.length === 3) gl.uniform3fv(loc, v);
      }
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
  }

  EC.GroundRenderer = GroundRenderer;
})();
