'use strict';

/* =========================================================
 * 하늘 사냥꾼 — 보스 패턴 (DOM 없음)
 *
 * 패턴 하나 = 제너레이터 함수. `yield 초` 로 기다리며 차례대로
 *   ① 무기를 겨누고(aim: 조준선이 보임) ② 충전하고(charge: 빛이 모임) ③ 그 무기의 총구에서 쏩니다.
 * 벽 레이저포(gun)는 화면 밖에서 미끄러져 나와 쏘고 다시 들어갑니다. 보스가 신호기로 불러야 나옵니다.
 *
 * 쓰는 도구 (game.js 의 Game 메서드):
 *   g.W(name) 무기   g.avail(name) 쓸 수 있나   g.aim(w, 회전속도) 플레이어 쪽으로   g.point(w, 각도, 회전속도)
 *   g.charge(w, 초)  g.orb(w, 각도차, 속도, 색, 옵션)  g.orbAt(x, y, 각도, 속도, 색, 옵션)  g.beam(w, 옵션)
 *   g.missileFrom(w, 각도, 속도)  g.gun(가장자리, 위치, 계획)  g.run(제너레이터)  g.hold(초)  g.idle(w)
 * ========================================================= */

(() => {
  const HALF_PI = Math.PI / 2;
  const TAU = Math.PI * 2;

  /** 신호기를 깜빡여 벽 레이저포를 부름 (보스가 부른다는 걸 보여 줌) */
  function* signal(g) {
    const a = g.W('antenna');
    a.state = 'charge';
    a.charge = 0;
    a.chargeDur = 0.5;
    g.emit('call', {});
    yield 0.5;
    g.idle(a);
  }
  /** 부른 레이저포가 모두 들어갈 때까지 */
  function* waitGuns(guns) {
    while (guns.some((x) => !x.gone)) yield 0.1;
  }
  function* charge(g, ws, t) {
    for (const w of [].concat(ws)) g.charge(w, t);
    yield t;
  }
  const shuffle = (g, a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(g.rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const pick = (g, a) => a[Math.floor(g.rng() * a.length)];
  const clampY = (y) => Math.max(230, Math.min(505, y)); // 벽 레이저포가 나올 수 있는 높이 (내가 있는 아래쪽)

  /* ---------------- 벽 레이저포 쏘는 방법 ---------------- */
  const FIRE = {
    /** 굵은 레이저 한 줄 */
    beam: (width, dur) => function* (g, gun) {
      g.beam(gun, { width, dur });
      yield dur;
    },
    /** 겨눈 쪽으로 세 갈래 탄을 여러 번 */
    burst: (times, every) => function* (g, gun) {
      for (let i = 0; i < times; i++) {
        for (let k = -1; k <= 1; k++) g.orb(gun, k * 0.2, 210, 'orange');
        yield every;
      }
    },
  };

  /* =========================================================
   * 패턴
   * ========================================================= */
  const P = {
    /* ---------- 1단계: 포탑 ---------- */
    /** 포탑이 번갈아 겨누고 3연사 */
    *turretBurst(g) {
      const ws = shuffle(g, ['turretL', 'turretR'].filter((n) => g.avail(n)).map((n) => g.W(n)));
      const fan = g.rng() < 0.5;
      for (const w of ws) {
        g.aim(w, 3.2);
        yield 0.45;
        yield* charge(g, w, 0.35);
        w.state = 'fire';
        for (let i = 0; i < 3 && w.alive; i++) {
          if (fan) for (let k = -2; k <= 2; k++) g.orb(w, k * 0.16, 190, 'orange');
          else for (let k = 0; k < 3; k++) g.orb(w, 0, 160 + k * 45, 'orange');
          yield 0.24;
        }
        g.idle(w);
        yield 0.2;
      }
    },
    /** 두 포탑이 포신을 크게 휘두르며 연속 사격 (교차 또는 바깥으로) */
    *turretSweep(g) {
      const ws = ['turretL', 'turretR'].filter((n) => g.avail(n)).map((n) => g.W(n));
      const out = g.rng() < 0.5;
      for (const w of ws) {
        const L = w.ox < 0;
        w.sw = out ? [L ? 0.95 : 2.2, L ? 2.6 : 0.54] : [L ? 2.6 : 0.54, L ? 0.95 : 2.2];
        g.point(w, w.sw[0], 5);
      }
      yield 0.55;
      yield* charge(g, ws, 0.3);
      const dur = 1.6;
      for (let t = 0; t < dur; t += 0.08) {
        for (const w of ws) {
          if (!w.alive) continue;
          w.state = 'fire';
          w.target = null;
          w.ang = SH.lerp(w.sw[0], w.sw[1], t / dur);
          g.orb(w, 0, 215, 'red');
        }
        yield 0.08;
      }
      ws.forEach((w) => g.idle(w));
    },

    /* ---------- 발사구 · 배기구 ---------- */
    /** 양옆 발사구에서 플라스마 구체가 자라다가 던져짐 → 터지며 원형 탄 */
    *orbToss(g) {
      const ws = ['emitL', 'emitR'].filter((n) => g.avail(n)).map((n) => g.W(n));
      if (!ws.length) return;
      yield* charge(g, ws, 0.9);
      const n = g.B.phase >= 1 ? 3 : 1;
      for (const w of ws) {
        const [mx, my] = g.muzzle(w);
        const a = Math.atan2(g.player.y - my, g.player.x - mx);
        for (let k = 0; k < n; k++) g.orbAt(mx, my, a + (k - (n - 1) / 2) * 0.4, 120, 'purple', { big: true, split: { at: 1.0, n: 10, speed: 112, kind: 'purple' } });
        w.recoil = 1;
        g.emit('muzzle', { x: mx, y: my, big: true });
      }
      ws.forEach((w) => g.idle(w));
      yield 0.4;
    },
    /** 등 쪽 배기구가 증기를 뿜다가 작은 탄을 흩뿌림 */
    *ventRain(g) {
      const ws = ['ventL', 'ventR'].filter((n) => g.avail(n)).map((n) => g.W(n));
      if (!ws.length) return;
      yield* charge(g, ws, 0.55);
      for (let t = 0; t < 2; t += 0.09) {
        for (const w of ws) { w.state = 'fire'; g.orb(w, (g.rng() * 2 - 1) * 0.85, 140 + g.rng() * 70, 'blue', { quiet: true }); }
        yield 0.09;
      }
      ws.forEach((w) => g.idle(w));
    },

    /* ---------- 벽 레이저포 (보스가 부름) ---------- */
    /** 내 높이의 양쪽 벽에서 레이저포가 나와 조준 → 레이저 */
    *wallSnipe(g) {
      yield* signal(g);
      const y = clampY(g.player.y + (g.rng() - 0.5) * 60);
      const off = g.rng() < 0.5 ? -60 : 60;
      const plan = { aim: 0.8, charge: 0.45, fire: FIRE.beam(12, 0.55) };
      const guns = [g.gun('L', y, plan), g.gun('R', clampY(y + off), plan)];
      yield* waitGuns(guns);
    },
    /** 레이저포 넷이 번갈아 나와 세 갈래 탄 */
    *wallCrossfire(g) {
      yield* signal(g);
      const ys = shuffle(g, [250, 320, 390, 460]);
      let edge = g.rng() < 0.5 ? 'L' : 'R';
      const guns = [];
      for (const y of ys) {
        guns.push(g.gun(edge, y, { aim: 0.55, charge: 0.3, fire: FIRE.burst(3, 0.33) }));
        edge = edge === 'L' ? 'R' : 'L';
        yield 0.35;
      }
      yield* waitGuns(guns);
    },
    /** 벽 양쪽에서 가로 레이저가 층층이 — 틈으로 위아래 피하기 */
    *gridLasers(g) {
      yield* signal(g);
      const n = g.B.phase >= 2 ? 4 : 3;
      const rows = shuffle(g, [235, 305, 375, 445, 505]).slice(0, n).sort((a, b) => a - b);
      let edge = g.rng() < 0.5 ? 'L' : 'R';
      const guns = [];
      rows.forEach((y, i) => {
        guns.push(g.gun(edge, y, { fixed: edge === 'L' ? 0 : Math.PI, aim: 1.0 + i * 0.28, charge: 0.35, fire: FIRE.beam(14, 0.7) }));
        edge = edge === 'L' ? 'R' : 'L';
      });
      yield* waitGuns(guns);
    },
    /** 화면 구석 여기저기서 하나씩 튀어나와 빠르게 저격 */
    *wallSniper(g) {
      yield* signal(g);
      const guns = [];
      let last = null;
      for (let i = 0; i < 3; i++) {
        let edge = pick(g, ['L', 'R', 'BL', 'BR']);
        if (edge === last) edge = edge === 'L' ? 'R' : 'L';
        last = edge;
        const pos = edge === 'L' || edge === 'R' ? clampY(250 + g.rng() * 230) : 0;
        guns.push(g.gun(edge, pos, { slide: 0.3, aim: 0.5, charge: 0.25, fire: FIRE.beam(7, 0.3) }));
        yield 0.75;
      }
      yield* waitGuns(guns);
    },

    /* ---------- 코어 ---------- */
    /** 드러난 코어가 빛나다가 원형 탄 세 겹 */
    *coreRing(g) {
      const c = g.W('core');
      yield* charge(g, c, 0.6);
      const off = g.rng() * TAU;
      for (let r = 0; r < 3; r++) {
        c.state = 'fire';
        for (let i = 0; i < 18; i++) g.orb(c, off + r * 0.17 + (i * TAU) / 18, 118, 'purple', { abs: true, quiet: i > 0 });
        yield 0.42;
      }
      g.idle(c);
    },
    /** 코어가 돌면서 나선 탄 */
    *coreSpiral(g) {
      const c = g.W('core');
      g.hold(3.4);
      yield* charge(g, c, 0.5);
      const dir = g.rng() < 0.5 ? 1 : -1;
      let k = 0;
      for (let t = 0; t < 2.6; t += 0.07, k++) {
        c.state = 'fire';
        for (let j = 0; j < 3; j++) g.orb(c, dir * k * 0.2 + (j * TAU) / 3, 125, 'purple', { abs: true, quiet: j > 0 });
        yield 0.07;
      }
      g.idle(c);
    },
    /** 폭주한 코어의 양방향 나선 */
    *overloadSpiral(g) {
      const c = g.W('core');
      g.hold(3.8);
      yield* charge(g, c, 0.5);
      let k = 0;
      for (let t = 0; t < 3; t += 0.07, k++) {
        c.state = 'fire';
        for (let j = 0; j < 3; j++) {
          g.orb(c, k * 0.21 + (j * TAU) / 3, 135, 'red', { abs: true, quiet: j > 0 });
          g.orb(c, -k * 0.21 + (j * TAU) / 3 + Math.PI / 3, 115, 'orange', { abs: true, quiet: true });
        }
        yield 0.07;
      }
      g.idle(c);
    },

    /* ---------- 주포 (2단계에 개방) ---------- */
    /** 주포가 나를 겨누고 충전 → 천천히 따라오는 굵은 레이저 */
    *mainBeam(g) {
      if (!g.avail('cannon')) return;
      const c = g.W('cannon');
      const twice = g.B.phase >= 3 && g.rng() < 0.45;
      g.hold(twice ? 6 : 4.4);
      for (let shot = 0; shot < (twice ? 2 : 1); shot++) {
        g.aim(c, 1.8);
        yield twice ? 0.4 : 0.6;
        c.turn = 0.6;
        yield* charge(g, c, twice ? 0.7 : 1.0);
        c.state = 'fire';
        c.turn = 0.26 * g.diff.speed;
        const dur = twice ? 0.9 : 1.5;
        g.beam(c, { width: 22, dur });
        yield dur;
        c.state = 'cool';
        c.target = null;
        yield 0.5;
      }
      g.idle(c);
    },
    /** 주포가 넓은 부채꼴을 쓸어냄 (쓸고 갈 구역을 미리 보여 줌) */
    *mainSweep(g) {
      if (!g.avail('cannon')) return;
      const c = g.W('cannon');
      g.hold(3.6);
      const [mx, my] = g.muzzle(c);
      const base = Math.atan2(g.player.y - my, g.player.x - mx);
      const dir = g.rng() < 0.5 ? 1 : -1;
      const a0 = Math.max(0.35, Math.min(Math.PI - 0.35, base - dir * 0.6));
      const a1 = Math.max(0.35, Math.min(Math.PI - 0.35, base + dir * 0.6));
      c.sweep = [a0, a1];
      g.point(c, a0, 3);
      yield 0.5;
      yield* charge(g, c, 0.9);
      c.state = 'fire';
      g.beam(c, { width: 22, dur: 1.6, from: a0, to: a1 });
      yield 1.6;
      c.sweep = null;
      c.state = 'cool';
      yield 0.5;
      g.idle(c);
    },
    /** 주포 + 벽 레이저포 동시에 */
    *beamAmbush(g) {
      g.run(P.wallSnipe(g));
      yield 0.3;
      yield* P.mainBeam(g);
    },
    /** 마지막 일격: 오래 충전한 거대한 레이저, 그동안 벽 포대가 몰아붙임 */
    *finalCharge(g) {
      if (!g.avail('cannon')) return;
      const c = g.W('cannon');
      g.hold(6.2);
      g.aim(c, 1.2);
      yield 0.5;
      c.big = true;
      g.charge(c, 2.0);
      g.emit('bigCharge', {});
      g.run((function* () {
        yield* signal(g);
        const guns = [g.gun('L', 420, { aim: 0.5, charge: 0.25, fire: FIRE.burst(3, 0.3) }), g.gun('R', 560, { aim: 0.6, charge: 0.25, fire: FIRE.burst(3, 0.3) })];
        yield* waitGuns(guns);
      })());
      yield 2.0;
      c.state = 'fire';
      c.turn = 0.22 * g.diff.speed;
      g.beam(c, { width: 46, dur: 2.0 });
      yield 2.0;
      c.big = false;
      c.state = 'cool';
      c.target = null;
      yield 0.8;
      g.idle(c);
    },
    /** 벽 양쪽에서 가로 레이저 넷이 한꺼번에 — 사이 틈에 들어가기 */
    *laserCage(g) {
      yield* signal(g);
      const shift = (g.rng() - 0.5) * 40;
      const rows = [245, 330, 415, 500].map((y) => clampY(y + shift));
      let edge = g.rng() < 0.5 ? 'L' : 'R';
      const guns = rows.map((y) => {
        const gun = g.gun(edge, y, { fixed: edge === 'L' ? 0 : Math.PI, aim: 1.15, charge: 0.35, fire: FIRE.beam(14, 1.0) });
        edge = edge === 'L' ? 'R' : 'L';
        return gun;
      });
      yield 0.8;
      const c = g.W('core');
      yield* charge(g, c, 0.4);
      for (let i = 0; i < 14; i++) g.orb(c, (i * TAU) / 14, 100, 'red', { abs: true, quiet: i > 0 });
      g.idle(c);
      yield* waitGuns(guns);
    },

    /* ---------- 미사일 포드 (3단계에 개방) ---------- */
    /** 등 뒤 포드 뚜껑이 열리고 미사일이 솟아올라 휘어져 쫓아옴 (쏘면 터짐) */
    *missileSalvo(g) {
      const ps = ['podL', 'podR'].filter((n) => g.avail(n)).map((n) => g.W(n));
      if (!ps.length) return;
      for (const p of ps) { p.state = 'open'; }
      g.emit('hatch', {});
      yield 0.5;
      const n = g.B.phase >= 3 ? 8 : 6;
      for (let i = 0; i < n; i++) {
        const p = ps[i % ps.length];
        g.missileFrom(p, -HALF_PI + (p.ox < 0 ? -0.7 : 0.7) + (g.rng() - 0.5) * 0.4, 170);
        yield 0.16;
      }
      yield 0.3;
      for (const p of ps) p.state = 'close';
      yield 0.4;
      ps.forEach((p) => g.idle(p));
    },
  };

  /** 이 패턴을 쓸 무기가 있나 */
  const NEEDS = {
    turretBurst: ['turretL', 'turretR'], turretSweep: ['turretL', 'turretR'], orbToss: ['emitL', 'emitR'], ventRain: ['ventL', 'ventR'],
    mainBeam: ['cannon'], mainSweep: ['cannon'], beamAmbush: ['cannon'], finalCharge: ['cannon'], missileSalvo: ['podL', 'podR'],
  };

  /* =========================================================
   * 단계가 바뀔 때: 폭발하며 부서지고(다른 모습으로 바뀜), 새 무기를 꺼냄
   * ========================================================= */
  function* transform(g, next) {
    const B = g.B;
    const def = SH.BOSS;
    B.state = 'transform';
    // 이번에 부서지는 무기는 그 자리에서 폭발
    for (const w of Object.values(B.w)) {
      if (w.lose === next && w.alive) {
        w.alive = false;
        const [x, y] = g.wpos(w);
        g.emit('partBreak', { x, y });
      }
    }
    for (let i = 0; i < 10; i++) {
      g.emit('bossBoom', { x: B.x + (g.rng() - 0.5) * def.hull.rx * 1.8, y: B.y + (g.rng() - 0.5) * def.hull.ry * 1.6 });
      if (i === 5) {
        B.look = def.phases[next].look;
        g.emit('armorFall', { x: B.x, y: B.y, look: B.look });
      }
      yield 0.14;
    }
    // 새 무기 등장 (안에서 밀려 나옴)
    for (const w of Object.values(B.w)) if (w.unlock === next) { w.reveal = 0; w.alive = true; }
    yield 0.9;
    B.state = 'fight';
    B.inv = 0;
  }

  SH.BOSS_PATTERNS = P;
  SH.BOSS_NEEDS = NEEDS;
  SH.bossTransform = transform;
  SH.bossGunPlans = FIRE;
})();
