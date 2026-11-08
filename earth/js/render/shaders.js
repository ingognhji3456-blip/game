'use strict';

/*
 * 지구를 그리는 셰이더. 화면 전체를 덮는 삼각형 하나에 광선을 쏘아
 * 지구·구름·대기·달·태양·별을 한 번에 계산합니다 (텍스처 이미지 없이 모두 절차적으로 생성).
 */
(function () {
  const EC = (window.EC = window.EC || {});
  EC.render = EC.render || {};

  EC.render.VERT = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

  EC.render.FRAG = `#version 300 es
precision highp float;
precision highp sampler2DArray;
out vec4 fragColor;

uniform vec2 uRes;
uniform float uTime;
uniform vec3 uCamPos, uCamRight, uCamUp, uCamFwd;
uniform float uTanHalfFov;
uniform mat3 uEarthRot;          // 세계 → 지구 고정 좌표
uniform vec3 uSunDir, uSunColor;
uniform float uSunAng, uSunIntensity;

uniform sampler2DArray uMask;
uniform mat3 uPlateInv[8];       // 지구 고정 좌표 → 각 판의 현재 좌표
uniform float uLayerVis[8];

uniform float uShrink, uSeaShift, uOcean, uLava, uHeat, uIceLat, uTempG, uVeg, uMats, uWet, uSand, uFuture;
uniform vec3 uRock, uOceanDeep, uOceanShallow;
uniform float uCloud, uCloudSpin;
uniform vec3 uCloudColor;
uniform vec3 uAtmoColor, uHazeColor;
uniform float uAtmoDensity, uHaze;
uniform float uCity;
uniform vec3 uMoonPos;
uniform float uMoonR, uMoonLava;
uniform vec4 uFx[4];             // xyz: 지구 고정 방향, w: 진행도(0~1, 음수면 없음)
uniform vec4 uFxP[4];            // x: 종류(1 충돌, 2 화산), y: 크기
uniform vec3 uMeteorA, uMeteorB;
uniform float uMeteor, uDust, uFlash, uExposure;
uniform vec3 uPick;              // 고른 위치 표시 (지구 고정 방향), 길이 0이면 없음

const float PI = 3.14159265359;
const float ATMO_R = 1.028;

/* ---------- 잡음 (Ashima / Gustavson simplex) ---------- */
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 10.0) * x); }
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
  vec4 m = max(0.5 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 105.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
float fbm3(vec3 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 3; i++) { s += a * snoise(p); p = p * 2.03 + vec3(1.7, 9.2, 3.1); a *= 0.5; } return s; }
float fbm4(vec3 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * snoise(p); p = p * 2.03 + vec3(1.7, 9.2, 3.1); a *= 0.5; } return s; }
float fbm5(vec3 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * snoise(p); p = p * 2.03 + vec3(1.7, 9.2, 3.1); a *= 0.5; } return s; }
float ridge4(vec3 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { float n = 1.0 - abs(snoise(p)); s += a * n * n; p = p * 2.1 + vec3(3.3, 1.1, 7.7); a *= 0.5; } return s; }
float sq(float x) { return x * x; }
float hash13(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }

vec2 sphereHit(vec3 ro, vec3 rd, vec3 c, float r) {
  vec3 oc = ro - c;
  float b = dot(oc, rd);
  float cc = dot(oc, oc) - r * r;
  float h = b * b - cc;
  if (h < 0.0) return vec2(-1.0);
  h = sqrt(h);
  return vec2(-b - h, -b + h);
}

vec3 rotY(vec3 p, float a) { float c = cos(a), s = sin(a); return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z); }

/* ---------- 대륙 ---------- */
float plateField(vec3 q, out float overlap) {
  float best = -1.0;
  float sum = 0.0;
  for (int i = 0; i < 8; i++) {
    if (uLayerVis[i] < 0.01) continue;
    vec3 v = uPlateInv[i] * q;
    float lon = atan(v.x, v.z);
    float lat = asin(clamp(v.y, -1.0, 1.0));
    vec2 uv = vec2(lon / (2.0 * PI) + 0.5, 0.5 - lat / PI);
    float s = (texture(uMask, vec3(uv, float(i))).r * 255.0 - 128.0) / 127.0;
    s = mix(-1.0, s, uLayerVis[i]);
    best = max(best, s);
    sum += max(s, 0.0);
  }
  overlap = sum - max(best, 0.0);
  return best;
}

float cloudField(vec3 q) {
  vec3 p = rotY(q, uCloudSpin);
  vec3 w = vec3(fbm3(p * 1.7 + 1.3), fbm3(p * 1.7 + 7.1), fbm3(p * 1.7 + 4.7));
  float c = fbm5(p * 3.2 + w * 1.1);
  float alat = abs(asin(clamp(p.y, -1.0, 1.0))) * 180.0 / PI;
  float band = 0.14 * (1.0 - smoothstep(0.0, 9.0, alat)) - 0.16 * exp(-sq((alat - 24.0) / 9.0)) + 0.1 * smoothstep(38.0, 55.0, alat) * (1.0 - smoothstep(70.0, 88.0, alat));
  float cov = clamp(uCloud + band * step(0.05, uCloud) * (1.0 - smoothstep(0.85, 1.0, uCloud)), 0.0, 1.0);
  float v = c * 0.55 + 0.5;
  return smoothstep(1.0 - cov, 1.0 - cov + 0.28, v) * smoothstep(0.0, 0.05, uCloud);
}

/* ---------- 배경: 별, 은하수, 태양 ---------- */
vec3 background(vec3 rd) {
  vec3 col = vec3(0.0);
  for (int l = 0; l < 2; l++) {
    float sc = l == 0 ? 80.0 : 210.0;
    vec3 p = rd * sc;
    vec3 cell = floor(p);
    vec3 f = fract(p) - 0.5;
    float h = hash13(cell + float(l) * 17.0);
    if (h > 0.982) {
      vec3 off = vec3(hash13(cell + 1.3), hash13(cell + 2.7), hash13(cell + 5.1)) - 0.5;
      float d = length(f - off * 0.6);
      float b = smoothstep(0.09, 0.0, d) * (h - 0.982) / 0.018;
      vec3 tint = mix(vec3(0.7, 0.8, 1.0), vec3(1.0, 0.85, 0.7), hash13(cell + 9.0));
      col += b * tint * (l == 0 ? 1.6 : 0.8) * (0.8 + 0.2 * sin(uTime * 2.0 + h * 50.0));
    }
  }
  float mw = exp(-sq(dot(rd, normalize(vec3(0.35, 0.85, 0.4))) / 0.16));
  col += vec3(0.05, 0.05, 0.075) * mw * (0.25 + 0.75 * smoothstep(0.0, 0.7, fbm4(rd * 9.0)));
  float ang = acos(clamp(dot(rd, uSunDir), -1.0, 1.0));
  float disk = smoothstep(uSunAng * 1.03, uSunAng * 0.97, ang);
  float limb = 1.0 - 0.45 * sq(clamp(ang / uSunAng, 0.0, 1.0));
  col += uSunColor * uSunIntensity * (disk * 9.0 * limb + exp(-ang / (uSunAng * 1.6)) * 0.9 + exp(-ang * 3.0) * 0.06);
  return col;
}

/* ---------- 지표 ---------- */
vec3 shadeEarth(vec3 pw, vec3 rd, out float dustOut) {
  vec3 n = normalize(pw);
  vec3 q = uEarthRot * n;
  float lat = asin(clamp(q.y, -1.0, 1.0));
  float alat = abs(lat) * 180.0 / PI;

  float ov;
  float s = plateField(q, ov);
  float n1 = fbm5(q * 3.0 + 11.0);
  float n2 = fbm4(q * 11.0 + 3.0);
  /* coast: 대륙 지각인지(> 0), basin: 지각 성장과 무관한 지형 높이(미래에 바다가 마를 때 씀) */
  float basin = s + n1 * 0.2 + n2 * 0.065 + uSeaShift;
  float coast = s + (n1 * 0.2 + n2 * 0.065) * (1.0 + uShrink * 0.9) - uShrink + uSeaShift;
  float w = fwidth(coast) * 0.9 + 1e-4;
  float dry = smoothstep(-w, w, coast);
  float level = mix(-1.6, 0.0, uOcean);
  float landPart = smoothstep(level - w, level + w, basin);
  float landAmt = uFuture > 0.5 ? max(dry, landPart) : dry;
  float waterPresent = uFuture > 0.5 ? 1.0 : smoothstep(0.0, 0.25, uOcean);
  float land = 1.0 - (1.0 - landAmt) * waterPresent;
  float inland = clamp(coast, 0.0, 1.5);
  float mount = ridge4(q * 5.0 + 7.0);
  float mtn = mount * (0.22 + 1.9 * clamp(ov, 0.0, 0.6)) * smoothstep(0.02, 0.3, inland);
  float depth = uFuture > 0.5 ? clamp(level - basin, 0.0, 2.0) : clamp(-coast, 0.0, 2.0);

  float tempLocal = uTempG + 12.0 - 44.0 * sin(lat) * sin(lat) - mtn * 22.0;
  float moist = 0.55 + 0.45 * n2 + 0.35 * fbm3(q * 4.0 + 21.0)
    - 0.95 * smoothstep(0.12, 0.85, inland)
    + 0.45 * (1.0 - smoothstep(0.0, 14.0, alat))
    - 0.55 * exp(-sq((alat - 24.0) / 9.0))
    + 0.15 * smoothstep(38.0, 58.0, alat) + uWet;
  moist = clamp(moist, 0.0, 1.0);

  /* 맨땅 */
  vec3 bare = mix(uRock, uRock * 0.62 + vec3(0.04), 0.5 + 0.5 * n2);
  bare = mix(bare, vec3(0.80, 0.66, 0.46), uSand * smoothstep(0.38, 0.1, moist));
  /* 식생 */
  vec3 rain = vec3(0.07, 0.24, 0.07), savanna = vec3(0.46, 0.45, 0.20), temperate = vec3(0.16, 0.32, 0.11);
  vec3 boreal = vec3(0.10, 0.21, 0.12), tundra = vec3(0.40, 0.40, 0.32), desertV = vec3(0.78, 0.65, 0.45);
  vec3 wetC = mix(boreal, rain, smoothstep(6.0, 22.0, tempLocal));
  vec3 midC = mix(tundra, mix(temperate, savanna, smoothstep(18.0, 26.0, tempLocal)), smoothstep(-2.0, 8.0, tempLocal));
  vec3 veg = mix(midC, wetC, smoothstep(0.45, 0.8, moist));
  veg = mix(desertV, veg, smoothstep(0.12, 0.38, moist));
  float vegAmt = uVeg * smoothstep(-8.0, 3.0, tempLocal) * (1.0 - smoothstep(42.0, 55.0, tempLocal));
  vec3 landCol = mix(bare, veg, vegAmt);
  landCol = mix(landCol, vec3(0.22, 0.30, 0.17), uMats * (1.0 - smoothstep(0.0, 0.18, inland)) * 0.55);
  landCol = mix(landCol, vec3(0.40, 0.38, 0.36), smoothstep(0.35, 0.85, mtn) * 0.55);
  vec3 seabed = mix(vec3(0.30, 0.27, 0.25), vec3(0.74, 0.71, 0.64), smoothstep(-0.25, 0.45, n1 + n2 * 0.3) * 0.55);
  landCol = mix(seabed, landCol, dry);

  /* 얼음 */
  float iceEdge = uIceLat + n1 * 7.0 + n2 * 2.5;
  float ice = smoothstep(iceEdge - 1.2, iceEdge + 1.2, alat);
  float peakSnow = smoothstep(-4.0, -14.0, tempLocal) * smoothstep(0.25, 0.6, mtn);
  float landIce = max(ice, peakSnow);
  float seaIce = smoothstep(iceEdge + 0.8, iceEdge + 3.0, alat);
  vec3 iceCol = vec3(0.86, 0.90, 0.95) * (0.92 + 0.08 * n2);

  /* 바다 */
  vec3 oceanCol = mix(uOceanShallow, uOceanDeep, smoothstep(0.0, 0.32, depth));

  vec3 albedo = mix(mix(oceanCol, iceCol * 0.95, seaIce), mix(landCol, iceCol, landIce), land);
  float water = (1.0 - land) * (1.0 - seaIce);
  vec3 emit = vec3(0.0);

  /* 마그마 바다 / 녹아내리는 지표 */
  float molten = max(uLava, uHeat);
  if (molten > 0.001) {
    float veins = 1.0 - smoothstep(0.0, 0.11, abs(snoise(q * 6.0 + vec3(0.0, uTime * 0.015, 0.0))));
    veins = max(veins, 1.0 - smoothstep(0.0, 0.07, abs(snoise(q * 17.0 + 4.0))));
    vec3 crust = vec3(0.09, 0.07, 0.065) * (0.7 + 0.6 * (n2 * 0.5 + 0.5));
    float pool = smoothstep(0.5, 1.0, molten) * smoothstep(-0.1, 0.5, n1);
    albedo = mix(albedo, crust, smoothstep(0.0, 0.6, molten));
    water *= 1.0 - smoothstep(0.0, 0.5, molten);
    emit += vec3(1.0, 0.28, 0.04) * (veins * 1.3 + pool * 0.9) * molten * (0.85 + 0.15 * sin(uTime * 1.3 + n1 * 9.0));
  }

  /* 충돌·분출 효과 */
  float dust = uDust;
  for (int i = 0; i < 4; i++) {
    float age = uFx[i].w;
    if (age < 0.0) continue;
    float a = acos(clamp(dot(q, uFx[i].xyz), -1.0, 1.0));
    float size = uFxP[i].y;
    if (uFxP[i].x < 1.5) {
      float flash = exp(-age * 16.0) * exp(-a * a / (0.03 * size * size)) * 25.0;
      float fireball = exp(-age * 2.5) * exp(-a * a / (0.006 * size * size)) * 7.0;
      float ringR = sqrt(age) * 0.9 * size;
      float ring = exp(-sq((a - ringR) / (0.012 + 0.02 * size))) * (1.0 - age) * 2.5;
      float crater = exp(-a * a / (0.0016 * size * size)) * (1.0 - age * 0.8) * 3.0;
      emit += vec3(1.0, 0.92, 0.75) * flash + vec3(1.0, 0.42, 0.08) * (fireball + crater) + vec3(1.0, 0.6, 0.3) * ring;
      float d = smoothstep(ringR * 1.5 + 0.06, ringR * 0.9, a) * smoothstep(0.0, 0.12, age) * (1.0 - age) * min(1.0, size * 0.55);
      dust = max(dust, d);
    } else {
      float field = smoothstep(0.13 * size, 0.0, a) * (0.35 + 0.65 * smoothstep(-0.2, 0.5, snoise(q * 28.0)));
      emit += vec3(1.0, 0.3, 0.05) * field * 3.0 * (1.0 - age * 0.6) * smoothstep(0.0, 0.05, age);
      float ash = smoothstep(0.5 * size * (0.25 + age), 0.0, a) * (1.0 - age) * smoothstep(0.0, 0.1, age);
      dust = max(dust, ash * 0.85);
    }
  }
  dustOut = dust;

  /* 산의 기복: 해 쪽으로 조금 옮긴 곳의 높이와 비교해 비탈 명암을 만듭니다 */
  vec3 sunE = uEarthRot * uSunDir;
  vec3 ts = sunE - q * dot(sunE, q);
  float tsl = length(ts);
  float relief = 1.0;
  if (tsl > 1e-3 && land > 0.01) {
    vec3 qOff = normalize(q + ts / tsl * 0.0045);
    float mOff = ridge4(qOff * 5.0 + 7.0);
    relief = clamp(1.0 + (mount - mOff) * 9.0 * smoothstep(0.02, 0.3, inland) * (0.35 + 2.0 * clamp(ov, 0.0, 0.5)) * (1.0 - molten), 0.45, 1.6);
  }

  /* 조명 */
  float ndlRaw = dot(n, uSunDir);
  float ndl = max(ndlRaw, 0.0) * mix(1.0, relief, land);
  float dayMask = smoothstep(-0.12, 0.12, ndlRaw);
  vec3 sunCol = uSunColor * uSunIntensity;
  vec3 col = albedo * sunCol * ndl * (1.0 - dust * 0.75);
  col += albedo * uAtmoColor * 0.05 * uAtmoDensity * dayMask;
  vec3 hv = normalize(uSunDir - rd);
  float fres = 0.02 + 0.98 * pow(1.0 - max(dot(n, -rd), 0.0), 5.0);
  float spec = pow(max(dot(n, hv), 0.0), 220.0) * 2.0 + pow(max(dot(n, hv), 0.0), 24.0) * 0.06;
  col += sunCol * spec * water * (0.25 + fres) * smoothstep(0.0, 0.1, ndlRaw) * (1.0 - dust);

  /* 구름 */
  float cl = uCloud > 0.001 ? cloudField(q) : 0.0;
  vec3 cloudCol = mix(uCloudColor, vec3(0.38, 0.30, 0.24), dust * 0.8);
  float cdiff = smoothstep(-0.15, 0.6, ndlRaw);
  col = mix(col, cloudCol * sunCol * (0.012 + cdiff * 0.95), cl * 0.92);

  /* 밤의 도시 불빛 */
  if (uCity > 0.001) {
    float mask = land * (1.0 - landIce) * smoothstep(0.15, 0.45, moist) * smoothstep(-4.0, 6.0, tempLocal) * (1.0 - smoothstep(0.4, 1.0, inland));
    float c1 = sq(max(0.0, snoise(q * 38.0)));
    float c2 = pow(max(0.0, snoise(q * 85.0 + 3.0)), 3.0);
    float region = smoothstep(-0.1, 0.45, fbm3(q * 5.0 + 40.0));
    float lights = (c1 * 0.7 + c2 * 1.4) * region * mask * uCity * (1.0 - cl * 0.7);
    col += vec3(1.0, 0.72, 0.38) * lights * 1.6 * (1.0 - dayMask);
  }

  /* 대기 산란 (가장자리일수록 두꺼움) */
  float mu = max(dot(n, -rd), 0.0);
  float rim = pow(1.0 - mu, 2.2);
  float sunsetK = smoothstep(-0.25, 0.1, ndlRaw) * (1.0 - smoothstep(0.05, 0.45, ndlRaw));
  vec3 scatter = mix(uAtmoColor, vec3(1.0, 0.45, 0.2), sunsetK * 0.7);
  float lightA = smoothstep(-0.2, 0.35, ndlRaw);
  col = col * (1.0 - rim * 0.35 * uAtmoDensity) + scatter * sunCol * (0.05 + rim * 0.9) * lightA * uAtmoDensity * 0.55;
  col = mix(col, uHazeColor * sunCol * (0.15 + 0.85 * cdiff), uHaze * (0.55 + 0.45 * rim));

  col += emit * (1.0 - cl * 0.6);
  col += vec3(1.0, 0.95, 0.85) * uFlash * 3.0;

  if (dot(uPick, uPick) > 0.5) {
    float a = acos(clamp(dot(q, uPick), -1.0, 1.0));
    float ring = smoothstep(0.004, 0.0, abs(a - 0.045)) * (0.6 + 0.4 * sin(uTime * 6.0));
    col += vec3(1.0, 0.85, 0.4) * ring * 1.5;
  }
  return col;
}

vec3 shadeMoon(vec3 p) {
  vec3 n = normalize(p - uMoonPos);
  vec3 toEarth = normalize(-uMoonPos);
  vec3 side = normalize(cross(vec3(0.0, 1.0, 0.0), toEarth));
  vec3 up = cross(toEarth, side);
  vec3 mq = vec3(dot(n, side), dot(n, up), dot(n, toEarth));
  float maria = smoothstep(0.05, 0.35, fbm4(mq * 1.6 + 5.0));
  float crat = pow(1.0 - abs(snoise(mq * 9.0)), 6.0) * 0.25;
  vec3 alb = mix(vec3(0.58), vec3(0.30), maria) * (0.85 + 0.25 * fbm3(mq * 14.0)) + crat;
  float ndl = max(dot(n, uSunDir), 0.0);
  vec3 col = alb * ndl * uSunColor * uSunIntensity * 0.9;
  col += alb * 0.012;
  if (uMoonLava > 0.001) {
    float veins = 1.0 - smoothstep(0.0, 0.12, abs(snoise(mq * 5.0 + 2.0)));
    col = mix(col, vec3(0.08, 0.06, 0.05) * ndl, uMoonLava * 0.6);
    col += vec3(1.0, 0.35, 0.06) * (veins * 1.6 + 0.25) * uMoonLava;
  }
  return col;
}

float meteorGlow(vec3 ro, vec3 rd, out float tRay) {
  vec3 a = uMeteorA, b = uMeteorB;
  vec3 ab = b - a;
  vec3 ao = ro - a;
  float abab = dot(ab, ab), abrd = dot(ab, rd), aoab = dot(ao, ab), aord = dot(ao, rd);
  float den = abab - abrd * abrd;
  float sp = den > 1e-8 ? clamp((aoab - aord * abrd) / den, 0.0, 1.0) : 1.0;
  vec3 pt = a + ab * sp;
  tRay = max(dot(pt - ro, rd), 0.0);
  float d = length(ro + rd * tRay - pt);
  float wdt = 0.004 + 0.012 * sp;
  return exp(-d * d / (wdt * wdt)) * (0.25 + 0.75 * sp * sp) + exp(-d * d / (wdt * wdt * 30.0)) * sp * 0.25;
}

/* 지구 바깥 대기 테두리 */
vec3 halo(vec3 ro, vec3 rd, float tM) {
  float tc = -dot(ro, rd);
  vec3 pc = ro + rd * tc;
  float b = length(pc);
  if (b <= 0.97 || b >= ATMO_R + 0.06 || tc <= 0.0 || tc >= tM) return vec3(0.0);
  vec3 nc = pc / b;
  float ndl = dot(nc, uSunDir);
  float light = smoothstep(-0.35, 0.3, ndl);
  float thick = exp(-max(b - 1.0, 0.0) / (0.011 * max(uAtmoDensity, 0.3)));
  float forward = pow(max(dot(rd, uSunDir), 0.0), 8.0) * 1.5;
  float sunsetK = smoothstep(-0.35, 0.0, ndl) * (1.0 - smoothstep(0.0, 0.35, ndl));
  vec3 c = mix(uAtmoColor, vec3(1.0, 0.45, 0.18), sunsetK * 0.8);
  c = mix(c, uHazeColor, uHaze * 0.7);
  return c * uSunColor * uSunIntensity * thick * light * (0.65 + forward) * uAtmoDensity * 0.9;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  vec3 rd = normalize(uCamFwd + (uv.x * uCamRight + uv.y * uCamUp) * 2.0 * uTanHalfFov);
  vec3 ro = uCamPos;

  vec2 he = sphereHit(ro, rd, vec3(0.0), 1.0);
  vec2 hm = uMoonR > 0.0 ? sphereHit(ro, rd, uMoonPos, uMoonR) : vec2(-1.0);
  float tE = he.x > 0.0 ? he.x : 1e9;
  float tM = hm.x > 0.0 ? hm.x : 1e9;

  /* 지구 가장자리 계단 현상을 줄이기 위한 픽셀 크기 */
  float tc = -dot(ro, rd);
  float bdist = length(ro + rd * tc);
  float pixW = 2.0 * uTanHalfFov / uRes.y * max(tc, 0.1) * 1.2;

  vec3 col;
  float dust = 0.0;
  if (tE < tM && tE < 1e8) {
    col = shadeEarth(ro + rd * tE, rd, dust);
    float aa = clamp((1.0 - bdist) / pixW, 0.0, 1.0);
    if (aa < 1.0) col = mix(background(rd) + halo(ro, rd, tM), col, aa);
  } else if (tM < 1e8) {
    col = shadeMoon(ro + rd * tM);
  } else {
    col = background(rd) + halo(ro, rd, tM);
  }

  if (uMeteor > 0.001) {
    float tr;
    float g = meteorGlow(ro, rd, tr);
    if (tr < min(tE, tM)) col += vec3(1.0, 0.8, 0.55) * g * uMeteor * 4.0;
  }

  col *= uExposure;
  col = (col * (2.51 * col + 0.03)) / (col * (2.43 * col + 0.59) + 0.14);
  col = pow(clamp(col, 0.0, 1.0), vec3(1.0 / 2.2));
  float vig = 1.0 - 0.22 * dot(uv, uv);
  fragColor = vec4(col * vig, 1.0);
}
`;
})();
