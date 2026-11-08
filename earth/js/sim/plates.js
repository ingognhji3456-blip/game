'use strict';

/*
 * 판의 움직임: 각 판의 회전(현재 위치 → t 시점 위치)을 쿼터니언으로 계산합니다.
 * 키프레임 형식 (EC.data.plateKeys):
 *   { t, present: true }                       현재 위치 그대로
 *   { t, pos: [위도, 경도, 회전각] }           판의 기준점(ref)을 그 위치로 옮기고, 그 자리에서 반시계로 회전
 *   { t, euler: [극 위도, 극 경도, 각도] }     지질학식 유한 회전
 *   { t, attach: '판', rel: {pos|euler} }      다른 판에 붙어서 함께 움직임 (rel 은 그 판의 현재 좌표계 기준)
 * 같은 판에 붙은 키프레임 두 개 사이에서는 계속 붙어 있습니다.
 */
(function () {
  const EC = (window.EC = window.EC || {});
  const Q = EC.q;

  const layers = () => EC.data.layers;
  const keysOf = (plate) => EC.data.plateKeys[plate];

  let refCache = null;
  function refOf(plate) {
    if (!refCache) {
      refCache = {};
      for (const l of layers()) if (!refCache[l.plate] && l.id === l.plate) refCache[l.plate] = l.ref;
    }
    return refCache[plate];
  }

  function relRotation(plate, spec) {
    if (spec.euler) return Q.euler(spec.euler[0], spec.euler[1], spec.euler[2]);
    if (spec.pos) {
      const ref = refOf(plate);
      const c0 = Q.vec(ref[0], ref[1]);
      const c1 = Q.vec(spec.pos[0], spec.pos[1]);
      return Q.mul(Q.axisAngle(c1, spec.pos[2] || 0), Q.fromTo(c0, c1));
    }
    return Q.IDENTITY;
  }

  function resolveKey(plate, key, memo) {
    if (key.present) return Q.IDENTITY;
    if (key.attach) return Q.mul(rotationOf(key.attach, key.t, memo), relRotation(plate, key.rel));
    return relRotation(plate, key);
  }

  const sameAttach = (a, b) => a.attach && b.attach && a.attach === b.attach && JSON.stringify(a.rel) === JSON.stringify(b.rel);

  function rotationOf(plate, t, memo) {
    const mk = plate + '@' + t;
    if (memo && memo[mk]) return memo[mk];
    const keys = keysOf(plate);
    let q;
    if (t <= keys[0].t) q = resolveKey(plate, keys[0], memo);
    else if (t >= keys[keys.length - 1].t) q = resolveKey(plate, keys[keys.length - 1], memo);
    else {
      let i = 0;
      while (i < keys.length - 2 && keys[i + 1].t <= t) i++;
      const a = keys[i];
      const b = keys[i + 1];
      if (sameAttach(a, b)) {
        q = Q.mul(rotationOf(a.attach, t, memo), relRotation(plate, a.rel));
      } else {
        const u = (t - a.t) / (b.t - a.t);
        const e = b.ease === false ? u : u * u * (3 - 2 * u) * 0.35 + u * 0.65;
        q = Q.slerp(resolveKey(plate, a, memo), resolveKey(plate, b, memo), e);
      }
    }
    if (memo) memo[mk] = q;
    return q;
  }

  /* 층마다 [쿼터니언] — 층은 자기 판의 회전을 따릅니다 */
  function layerRotations(t) {
    const memo = {};
    return layers().map((l) => rotationOf(l.plate, t, memo));
  }

  /* 층이 보이는 정도(젊은 화산섬은 생기기 전엔 안 보임) */
  function layerVisibility(t) {
    return layers().map((l) => {
      if (l.youngerThan === undefined) return 1;
      return EC.util.smoothstep(l.youngerThan - 3, l.youngerThan + 3, t);
    });
  }

  /* 현재 좌표(위도/경도)로 적힌 판 위의 한 점이 t 시점에 어디 있는지 (지구 고정 좌표 단위 벡터) */
  function pointAt(plate, lat, lon, t) {
    return Q.rotate(rotationOf(plate, t, {}), Q.vec(lat, lon));
  }

  EC.plates = { rotationOf, layerRotations, layerVisibility, pointAt };
})();
