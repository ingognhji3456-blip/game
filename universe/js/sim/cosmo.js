'use strict';

/*
 * 우주의 팽창: 프리드만 방정식을 시간에 따라 풀어 우주의 크기(척도 인자 a), 팽창 속도(H),
 * 배경 온도, 구조가 자라는 정도(성장 인자 D), 관측 가능한 우주의 반지름을 구합니다.
 *
 *   H² = H0² ( Ωr a⁻⁴ + Ωm a⁻³ + ρ_암흑에너지(a) )        (평탄한 우주)
 *
 * 값은 플랑크 위성 관측(H0 = 67.7 km/s/Mpc, Ωm = 0.31)을 따랐습니다.
 * 개입하면 그 순간부터 암흑 에너지가 바뀝니다.
 *   rip     : w = -1.5 인 "유령 에너지" — 팽창할수록 더 강해져 유한한 시간 뒤 모든 것이 찢어짐 (빅 립)
 *   crunch  : 암흑 에너지가 끌어당기는 쪽(음의 우주 상수)으로 — 팽창이 멈추고 다시 쪼그라듦 (빅 크런치)
 *   restore : 지금과 같은 우주 상수로 되돌림
 * 시간 단위는 년, 거리 단위는 광년(빛의 속도 = 1)입니다.
 */
(function () {
  const UC = (window.UC = window.UC || {});
  const U = UC.util;

  const H0_KMS = 67.7;
  const KM_PER_MPC = 3.08568e19;
  const H0 = (H0_KMS / KM_PER_MPC) * U.YEAR_S; // 1/년
  const OM = 0.31;
  const OR = 9.1e-5;
  const OL = 1 - OM - OR;
  const T_CMB0 = 2.7255;
  const W_RIP = -1.5;
  const TAU0 = 1; // 이보다 이른 때는 복사 시대 공식 a ∝ √t
  const X_RIP = 230; // a 가 10¹⁰⁰ 배를 넘으면 찢어진 것으로
  const X_CRUNCH = -27; // a 가 지금의 2×10⁻¹² 배가 되면 끝난 것으로

  const x0 = (tau) => 0.5 * Math.log(2 * H0 * Math.sqrt(OR) * tau);

  function deRho(seg, x) {
    if (seg.type === 'rip') return seg.rhoI * Math.exp(-3 * (1 + W_RIP) * (x - seg.xI));
    if (seg.type === 'crunch') return -seg.C;
    return OL;
  }
  const deW = (seg) => (seg.type === 'rip' ? W_RIP : -1);
  const E2 = (seg, x) => OR * Math.exp(-4 * x) + OM * Math.exp(-3 * x) + deRho(seg, x);

  function activate(seg, prev, x) {
    seg.xI = x;
    const rhoPrev = deRho(prev, x);
    if (seg.type === 'rip') seg.rhoI = Math.max(rhoPrev, OL);
    if (seg.type === 'crunch') seg.C = 0.8 * (OM * Math.exp(-3 * x) + OR * Math.exp(-4 * x)) + Math.max(rhoPrev, 0) * 0;
  }

  /* interventions: [{ t: 우주 나이(년), type: 'rip'|'crunch'|'restore' }] */
  function integrate(interventions) {
    const segs = [{ tau: -Infinity, type: 'base' }];
    for (const iv of (interventions || []).filter((v) => /^(rip|crunch|restore)$/.test(v.type)).sort((a, b) => a.t - b.t)) {
      segs.push({ tau: Math.max(iv.t, TAU0 * 2), type: iv.type });
    }
    const out = { tau: [], x: [], D: [], chi: [], H: [], seg: [], segs, tEnd: Infinity, endType: null, tTurn: null };
    let tau = TAU0;
    let x = x0(TAU0);
    let D = Math.exp(x);
    let Dp = D / (2 * TAU0);
    let chi = (2 * TAU0) / Math.exp(x);
    let s = 1;
    let si = 0;
    const push = (H) => {
      out.tau.push(tau); out.x.push(x); out.D.push(D); out.chi.push(chi); out.H.push(H); out.seg.push(si);
    };

    const deriv = (seg, y, sgn) => {
      const e2 = Math.max(E2(seg, y[0]), 0);
      const H = sgn * H0 * Math.sqrt(e2);
      return [H, y[2], -2 * H * y[2] + 1.5 * H0 * H0 * OM * Math.exp(-3 * y[0]) * y[1], Math.exp(-y[0])];
    };

    push(s * H0 * Math.sqrt(E2(segs[0], x)));
    for (let step = 0; step < 60000; step++) {
      while (si + 1 < segs.length && segs[si + 1].tau <= tau * (1 + 1e-12)) {
        activate(segs[si + 1], segs[si], x);
        si++;
      }
      const seg = segs[si];
      const e2 = E2(seg, x);
      const Habs = H0 * Math.sqrt(Math.max(e2, 0));
      const Hm = H0 * Math.sqrt(OM * Math.exp(-3 * x) + OR * Math.exp(-4 * x));
      const pending = si + 1 < segs.length;

      /* 더 풀 필요가 없는 때: 암흑 에너지만 남아 일정하게 팽창 */
      if (!pending && s > 0 && seg.type !== 'rip' && seg.type !== 'crunch' && tau > 5e10 && OM * Math.exp(-3 * x) < 1e-12 * OL) break;
      if (x > X_RIP) {
        out.tEnd = tau + 1 / (0.75 * Habs);
        out.endType = 'rip';
        break;
      }
      if (x < X_CRUNCH && s < 0) {
        out.tEnd = tau + 0.5 / Habs;
        out.endType = 'crunch';
        break;
      }

      let dt = Math.min(0.015 * tau, 0.02 / Math.max(Habs, 1e-30), 0.02 / Hm);
      if (pending) dt = Math.min(dt, Math.max(segs[si + 1].tau - tau, 1e-6 * tau));
      const y = [x, D, Dp, chi];
      const k1 = deriv(seg, y, s);
      const y2 = y.map((v, i) => v + 0.5 * dt * k1[i]);
      const k2 = deriv(seg, y2, s);
      const y3 = y.map((v, i) => v + 0.5 * dt * k2[i]);
      const k3 = deriv(seg, y3, s);
      const y4 = y.map((v, i) => v + dt * k3[i]);
      const k4 = deriv(seg, y4, s);
      const yn = y.map((v, i) => v + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
      tau += dt;
      [x, D, Dp, chi] = yn;

      /* 팽창이 멈추는 순간: 그 뒤로는 쪼그라듦 */
      if (s > 0 && E2(seg, x) <= 1e-9 * (OM * Math.exp(-3 * x))) {
        let lo = x - Math.abs(k1[0] * dt) - 1e-9;
        let hi = x + 1e-6;
        if (E2(seg, lo) > 0) {
          for (let i = 0; i < 80; i++) {
            const mid = 0.5 * (lo + hi);
            if (E2(seg, mid) > 0) lo = mid;
            else hi = mid;
          }
          x = lo - 1e-9;
        }
        s = -1;
        out.tTurn = tau;
      }
      push(s * H0 * Math.sqrt(Math.max(E2(seg, x), 0)));
    }

    out.tau = Float64Array.from(out.tau);
    out.x = Float64Array.from(out.x);
    out.D = Float64Array.from(out.D);
    out.chi = Float64Array.from(out.chi);
    out.H = Float64Array.from(out.H);
    out.seg = Uint8Array.from(out.seg);
    return out;
  }

  /* ---------- 실제 우주(개입 없음) ---------- */
  const BASE = integrate([]);
  function tauWhereX(run, xTarget) {
    for (let i = 1; i < run.x.length; i++) {
      if ((run.x[i - 1] - xTarget) * (run.x[i] - xTarget) <= 0) {
        const f = (xTarget - run.x[i - 1]) / (run.x[i] - run.x[i - 1] || 1);
        return run.tau[i - 1] + f * (run.tau[i] - run.tau[i - 1]);
      }
    }
    return null;
  }
  const T_NOW = tauWhereX(BASE, 0);
  const D_NORM = (function () {
    const i = U.bisectRight(BASE.tau, T_NOW);
    const f = (T_NOW - BASE.tau[i]) / (BASE.tau[i + 1] - BASE.tau[i]);
    return BASE.D[i] + f * (BASE.D[i + 1] - BASE.D[i]);
  })();

  /* ---------- 어떤 순간의 우주 ---------- */
  function stateAt(run, tau) {
    run = run || BASE;
    const n = run.tau.length;
    let x;
    let D;
    let H;
    let chi;
    let si;
    let ended = false;
    if (tau >= run.tEnd) {
      ended = true;
      tau = run.tEnd;
    }
    if (tau <= TAU0) {
      x = x0(Math.max(tau, 1e-60));
      H = 1 / (2 * Math.max(tau, 1e-60));
      D = run.D[0] * Math.exp(x - run.x[0]);
      chi = (2 * Math.max(tau, 1e-60)) / Math.exp(x);
      si = 0;
    } else if (tau >= run.tau[n - 1]) {
      const tL = run.tau[n - 1];
      x = run.x[n - 1];
      H = run.H[n - 1];
      D = run.D[n - 1];
      chi = run.chi[n - 1];
      si = run.seg[n - 1];
      if (!run.endType && tau > tL) {
        const dt = tau - tL;
        chi += (Math.exp(-x) * (1 - Math.exp(-H * dt))) / H;
        x += H * dt;
      }
    } else {
      const i = U.bisectRight(run.tau, tau);
      const f = (tau - run.tau[i]) / (run.tau[i + 1] - run.tau[i]);
      x = run.x[i] + f * (run.x[i + 1] - run.x[i]);
      D = run.D[i] + f * (run.D[i + 1] - run.D[i]);
      chi = run.chi[i] + f * (run.chi[i + 1] - run.chi[i]);
      H = run.H[i] + f * (run.H[i + 1] - run.H[i]);
      si = run.seg[i];
    }
    const seg = run.segs[si];
    const rr = OR * Math.exp(-4 * x);
    const rm = OM * Math.exp(-3 * x);
    const rd = deRho(seg, x);
    const tot = rr + rm + Math.abs(rd);
    const accel = rd * (1 + 3 * deW(seg)) + rm + 2 * rr < 0;
    const comps = { r: rr / tot, m: rm / tot, de: Math.abs(rd) / tot };
    const dominant = comps.r > comps.m && comps.r > comps.de ? 'r' : comps.m > comps.de ? 'm' : 'de';
    return {
      tau,
      x,
      log10a: x / Math.LN10,
      a: Math.exp(x),
      H,
      Hkms: (H / H0) * H0_KMS,
      T: T_CMB0 * Math.exp(-x),
      D: D / D_NORM,
      horizon: Math.exp(x) * chi,
      comps,
      dominant,
      accel,
      contracting: H < 0,
      deType: seg.type,
      ended,
      endType: run.endType,
      tEnd: run.tEnd,
    };
  }

  /* 빅 립 직전에 묶여 있던 것들이 풀리는 때 (Caldwell 등 2003): 공전 주기 P 인 계는 립 P·√(2|1+3w|)/(6π|1+w|) 전에 찢어짐 */
  const RIP_K = Math.sqrt(2 * Math.abs(1 + 3 * W_RIP)) / (6 * Math.PI * Math.abs(1 + W_RIP));
  const ripLead = (periodYears) => periodYears * RIP_K;

  /* 감속하던 팽창이 가속으로 바뀐 때 */
  let T_ACCEL = null;
  for (let i = 1; i < BASE.tau.length && T_ACCEL === null; i++) {
    if (BASE.tau[i] > 1e9 && stateAt(BASE, BASE.tau[i]).accel) T_ACCEL = BASE.tau[i];
  }

  UC.cosmo = {
    H0, H0_KMS, OM, OR, OL, T_CMB0, W_RIP, TAU0,
    BASE, T_NOW, integrate, stateAt, tauWhereX, ripLead,
    T_RECOMB: tauWhereX(BASE, Math.log(T_CMB0 / 3000)),
    T_EQ: tauWhereX(BASE, Math.log(OR / OM)),
    T_DE: tauWhereX(BASE, Math.log(OM / OL) / 3),
    T_ACCEL,
  };
})();
