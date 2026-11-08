'use strict';

/* =========================================================
 * 전투 월드 — 엔티티, 시간, 피해 판정, 위험 지역(경고 공격), 투사체, 동료
 * DOM 없음. 연출·소리는 W.events 에 쌓아 두면 화면 쪽이 가져갑니다.
 *   이벤트: { type: 'sfx'|'shake'|'text'|'spark'|'slash'|'ring'|'burst'|'banner'|'bark'|'flash'|'beam'|'trail'|'cutin', ... }
 * ========================================================= */
window.AZ = window.AZ || {};

AZ.battle = (() => {
  const U = AZ.util;

  /* ───────────── 생성 ───────────── */

  /**
   * cfg: { chapterId, mode: 'wave'|'boss', bossId?, waves?, difficulty, stats, party: {lia, zero},
   *        arena?: [w,h], memoryId? }
   */
  function create(cfg) {
    const D = AZ.data;
    const P = AZ.progress;
    const ch = D.chapters[cfg.chapterId - 1];
    const diff = D.difficulties[cfg.difficulty] || D.difficulties.normal;
    const [aw, ah] = cfg.arena || ch.arena || [1700, 1100];
    const W = {
      cfg, ch, diff,
      mode: cfg.mode,
      w: aw, h: ah,
      t: 0,
      state: 'intro', stateT: 0,
      events: [],
      enemies: [],
      allies: [],
      hazards: [],
      bullets: [],
      pickups: [],
      boss: null,
      hitstop: 0,
      slow: 1, slowT: 0,
      zero: 0, zeroMax: 0,
      timeStop: 0,
      enemyScale: 1,
      scan: 0,
      allyFocus: 0,
      cmdCd: [0, 0, 0],
      waveIdx: -1, waveDelay: 0,
      chainUsedThisBreak: false,
      ref: { atk: P.refAtk(cfg.chapterId), dmg: P.refDmg(cfg.chapterId) * diff.dmg },
      stats: {
        time: 0, damageTaken: 0, hitsTaken: 0, zeroFrames: 0, breaks: 0, maxCombo: 0,
        weakHits: 0, scans: 0, countered: 0, dmgDealt: 0, kills: 0, exp: 0, credits: 0, byKind: {},
      },
      memoryFound: false,
      found: { chest: false },
      result: null,
    };
    W.bounds = { x0: 0, y0: 0, x1: aw, y1: ah };
    W.player = AZ.player.create(W, cfg.stats);
    W.player.x = aw / 2;
    W.player.y = ah * 0.72;
    W.player.facing = -Math.PI / 2;
    if (cfg.mode === 'stage') setupStage(W, cfg);

    if (cfg.party && cfg.party.lia) W.allies.push(makeAlly(W, 'lia'));
    if (cfg.party && cfg.party.zero) W.allies.push(makeAlly(W, 'zero'));

    if (cfg.mode === 'boss') {
      W.boss = AZ.ai.spawnBoss(W, cfg.bossId);
    } else if (cfg.mode === 'stage') {
      // 보스는 플레이어가 보스 구역에 들어서면 startBoss() 로 등장
    } else {
      W.waves = cfg.waves || ch.waves;
      W.waveDelay = 0.6;
    }
    return W;
  }

  /* ───────────── 스테이지 (지역 입구 → … → 챕터 보스) ───────────── */
  function setupStage(W, cfg) {
    const L = AZ.level.generate(cfg.chapterId, W.w, W.h, cfg.waves || W.ch.waves);
    W.level = L;
    W.bounds = { x0: L.bounds.x0 - 300, y0: L.bounds.y0 - 300, x1: L.bounds.x1 + 300, y1: L.bounds.y1 + 300 };
    const cp = cfg.checkpoint || 0;
    const enc = L.encounters.map((e) => Object.assign({}, e, { state: 'idle', spawned: false }));
    const events = L.events.map((e) => Object.assign({}, e, { done: false }));
    const objects = (L.objects || []).map((o) => Object.assign({}, o, { used: false }));
    const mapInfo = (AZ.data.maps && AZ.data.maps[W.ch.theme]) || {};
    for (const o of objects) if (o.kind === 'npc') { o.name = (mapInfo.npc && mapInfo.npc.name) || '생존자'; o.lines = (mapInfo.npc && mapInfo.npc.lines) || []; }
    W.stage = { enc, events, objects, active: null, lock: null, bossTriggered: false, bossPhase: false, objective: null, cleared: 0, cpReached: false, gateOpen: cp === 'boss', near: null, region: '', regionKey: null };
    const p = W.player;
    if (cp === 'cp' || cp === 'boss') {
      for (const e of enc) if (e.id !== 'final' || cp === 'boss') e.state = 'cleared';
      for (const e of events) e.done = true;
      W.stage.cpReached = true;
      W.stage.cleared = cp === 'boss' ? 3 : 2;
      const at = cp === 'boss' ? L.bossEntry : L.checkpointPos;
      p.x = at.x;
      p.y = at.y + (cp === 'boss' ? 60 : 0);
    } else {
      p.x = L.start.x;
      p.y = L.start.y;
    }
    p.facing = -Math.PI / 2;
    for (const k of L.pickups) {
      if (k.kind === 'memory' && cfg.memoryCollected) continue;
      if (cp && k.kind !== 'memory' && k.kind !== 'credit') continue;
      W.pickups.push(Object.assign({ t: 0, permanent: true }, k));
    }
  }

  const STAGE_MILESTONES = [
    ['battle1', '일반 전투 ①'], ['story', '합류 지점'], ['midboss', '중간 보스'], ['checkpoint', '체크포인트'], ['final', '최종 전투 구역'],
  ];

  function updateStage(W, dt) {
    if (W.mode !== 'stage' || W.state !== 'fight' || W.ending) return;
    const st = W.stage;
    const p = W.player;
    const L = W.level;
    if (st.active) {
      const e = st.active;
      const alive = W.enemies.some((m) => !m.dead && m.kind === 'enemy' && !m.clone);
      if (e.spawned && !alive) {
        e.state = 'cleared';
        st.active = null;
        st.lock = null;
        if (!e.optional) st.cleared += 1;
        for (const k of W.pickups) if (k.area === e.area.id) k.hidden = false;
        const sub = e.id === 'lab' ? '숨겨진 연구실 확보 — 위쪽 보물을 찾아보세요' : e.elite ? '중간 보스 격파 — 체크포인트로' : e.id === 'final' ? '보스 구역으로 올라가세요' : '길을 따라 계속';
        ev(W, { type: 'banner', kind: 'chance', text: e.elite ? '정예 격파' : '구역 확보', sub });
        sfx(W, 'victory', { vol: 0.45 });
      }
    } else if (!st.bossTriggered) {
      for (const e of st.enc) {
        if (e.state !== 'idle' || !AZ.level.inArea(e.area, p.x, p.y, 70)) continue;
        // 두 갈래 중 하나를 고르면 다른 갈래의 교전은 사라짐
        if (e.optional) for (const o of st.enc) if (o !== e && o.optional && o.order === e.order && o.state === 'idle') o.state = 'skipped';
        e.state = 'active';
        st.active = e;
        st.lock = e.area;
        spawnEncounter(W, e);
        ev(W, { type: 'banner', kind: 'warn', text: e.elite ? '중간 보스' : e.id === 'lab' ? '연구실 경비 병기' : e.id === 'final' ? '최종 전투 구역' : '교전 구역', sub: '방벽 봉쇄 — 적을 모두 쓰러뜨려라' });
        sfx(W, 'alarm', { vol: 0.5 });
        break;
      }
      for (const evn of st.events) {
        if (evn.done || !AZ.level.inArea(evn.area, p.x, p.y, 60)) continue;
        evn.done = true;
        if (evn.kind === 'story') {
          W.hold = true;
          ev(W, { type: 'storyEvent' });
        } else if (evn.kind === 'checkpoint') {
          st.cpReached = true;
          const amt = Math.round(p.maxHp * 0.4);
          p.hp = Math.min(p.maxHp, p.hp + amt);
          for (const a of W.allies) { if (a.down > 0) { a.down = 0; a.hp = a.maxHp * 0.6; } else a.hp = Math.min(a.maxHp, a.hp + a.maxHp * 0.4); }
          text(W, p.x, p.y - 60, `+${amt}`, '#7cf7a0', 22);
          ev(W, { type: 'banner', kind: 'chance', text: '체크포인트', sub: '진행 상황 저장 · 체력 회복' });
          ev(W, { type: 'ring', x: p.x, y: p.y, r0: 20, r1: 260, color: '#7cf7d4', t: 0.6 });
          sfx(W, 'heal');
        }
      }
      const bossArea = L.areas[0];
      if (!st.active && !W.hold && AZ.level.inArea(bossArea, p.x, p.y, 120)) {
        st.bossTriggered = true;
        st.lock = bossArea;
        W.hold = true;
        ev(W, { type: 'bossApproach' });
      }
    }
    // 지금 있는 지역 이름
    const here = L.areas.find((a) => AZ.level.inArea(a, p.x, p.y, 0));
    if (here && here.id !== st.regionKey) {
      st.regionKey = here.id;
      const n = L.regionOf[here.id] || 1;
      const names = ((AZ.data.maps && AZ.data.maps[W.ch.theme]) || {}).regions || [];
      const name = n >= 8 ? AZ.data.bosses[W.cfg.bossId].name : names[n - 1] || here.label || '';
      const label = `${W.ch.id}-${n} ${name}`;
      if (label !== st.region) {
        st.region = label;
        if (W.stats.time > 1 && !(st.active && st.active.area === here)) ev(W, { type: 'region', text: label, sub: here.label && here.kind !== 'boss' ? here.label : '' });
      }
    }
    // 가까운 상호작용 대상
    st.near = null;
    let nd = 120;
    for (const o of st.objects) {
      if (o.used && o.kind !== 'npc') continue;
      const d = U.dist(p.x, p.y, o.x, o.y);
      if (d < nd) { nd = d; st.near = o; }
    }
    // 다음 목표 (안내 표시)
    st.objective = null;
    if (!st.active && !st.bossTriggered) {
      for (const [id, label] of STAGE_MILESTONES) {
        const e = st.enc.find((q) => q.id === id);
        const evn = st.events.find((q) => q.id === id);
        const a = e ? e.area : evn ? evn.area : null;
        const done = e ? e.state === 'cleared' : evn ? evn.done : true;
        if (a && !done) { st.objective = { x: (a.x0 + a.x1) / 2, y: (a.y0 + a.y1) / 2, label }; break; }
      }
      if (!st.objective) {
        const gate = st.objects.find((o) => o.kind === 'gate');
        st.objective = !st.gateOpen && gate ? { x: gate.x, y: gate.y, label: '관문 단말기' } : { x: L.aw / 2, y: L.ah * 0.5, label: '보스 구역' };
      }
    }
  }

  function interact(W) {
    const st = W.stage;
    const o = st && st.near;
    if (!o || st.active) return;
    const p = W.player;
    if (o.kind === 'npc') {
      W.hold = true;
      ev(W, { type: 'npcTalk', name: o.name, lines: o.lines });
      o.used = true;
    } else if (o.kind === 'chest' && !o.used) {
      o.used = true;
      W.found.chest = true;
      W.stats.credits += 250;
      ev(W, { type: 'banner', kind: 'memory', text: '숨겨진 보물', sub: '크레딧 +250 · 장비 획득' });
      ev(W, { type: 'burst', x: o.x, y: o.y, z: 30, r: 120, color: '#ffe066' });
      text(W, p.x, p.y - 70, '+250 ◈', '#ffe066', 24);
      sfx(W, 'pickup');
      sfx(W, 'levelup', { vol: 0.5 });
    } else if (o.kind === 'gate' && !o.used) {
      const fin = st.enc.find((e) => e.id === 'final');
      if (fin && fin.state !== 'cleared') { text(W, o.x, o.y - 80, '구역을 먼저 확보하라', '#ff9aa8', 16); sfx(W, 'uiBack'); return; }
      o.used = true;
      st.gateOpen = true;
      ev(W, { type: 'banner', kind: 'warn', text: 'ASTRA 관문 개방', sub: '보스 구역으로 가는 길이 열렸다' });
      ev(W, { type: 'ring', x: o.x, y: o.y, r0: 10, r1: 400, color: '#ff5470', t: 0.8 });
      sfx(W, 'alarm');
      shake(W, 8);
    }
  }

  function spawnEncounter(W, e) {
    const a = e.area;
    const p = W.player;
    let n = 0;
    const place = () => {
      let x;
      let y;
      let tries = 0;
      do {
        const side = (n + tries) % 4;
        const m = 70;
        if (side === 0) { x = U.rand(a.x0 + m, a.x1 - m); y = a.y0 + m; } else if (side === 1) { x = a.x1 - m; y = U.rand(a.y0 + m, a.y1 - m); } else if (side === 2) { x = U.rand(a.x0 + m, a.x1 - m); y = a.y1 - m; } else { x = a.x0 + m; y = U.rand(a.y0 + m, a.y1 - m); }
        tries++;
      } while (tries < 8 && U.dist(x, y, p.x, p.y) < 260);
      return [x, y];
    };
    if (e.elite) {
      const [type] = e.wave[0];
      const el = AZ.ai.spawnMinion(W, type, (a.x0 + a.x1) / 2, a.y0 + (a.y1 - a.y0) * 0.35, { delay: 0.8, elite: true });
      ev(W, { type: 'burst', x: el.x, y: el.y, z: 30, r: 160, color: el.def.color, big: true });
      for (const [t2, c2] of e.escorts || []) for (let i = 0; i < c2; i++) { const [x, y] = place(); AZ.ai.spawnMinion(W, t2, x, y, { delay: 1 + n * 0.15 }); n += 1; }
    } else {
      for (const [type, count] of e.wave) {
        for (let i = 0; i < count; i++) {
          const [x, y] = place();
          AZ.ai.spawnMinion(W, type, x, y, { delay: 0.35 + n * 0.12 });
          n += 1;
        }
      }
    }
    e.spawned = true;
  }

  /** 보스 구역 진입 연출이 끝나면 호출 — 같은 자리에서 보스 등장 */
  function startBoss(W) {
    const st = W.stage;
    W.hold = false;
    if (!st || st.bossPhase) return;
    st.bossPhase = true;
    st.lock = W.level.areas[0];
    W.stageStats = Object.assign({}, W.stats);
    const keep = { exp: W.stats.exp, credits: W.stats.credits, kills: W.stats.kills };
    W.stats = Object.assign({
      time: 0, damageTaken: 0, hitsTaken: 0, zeroFrames: 0, breaks: 0, maxCombo: 0,
      weakHits: 0, scans: 0, countered: 0, dmgDealt: 0, byKind: {},
    }, keep);
    W.boss = AZ.ai.spawnBoss(W, W.cfg.bossId);
    W.boss.spawnT = 0.9;
    W.state = 'intro';
    W.stateT = 0.4;
    ev(W, { type: 'burst', x: W.boss.x, y: W.boss.y, z: 40, r: W.boss.r * 3, color: W.boss.def.color, big: true });
    shake(W, 14);
  }

  function makeAlly(W, kind) {
    const s = W.player.stats;
    const a = {
      id: U.nextId(), kind: 'ally', ally: kind, team: 'player',
      x: W.player.x + (kind === 'lia' ? -70 : 70), y: W.player.y + 40, z: kind === 'lia' ? 34 : 0,
      vx: 0, vy: 0, r: kind === 'lia' ? 14 : 20,
      facing: -Math.PI / 2,
      maxHp: Math.round(s.maxHp * (kind === 'lia' ? 0.45 : 0.8) * s.allyHp),
      hp: 0, down: 0, flash: 0, shield: 0, shieldT: 0,
      atkT: 1 + Math.random(), anim: 'idle', animT: 0, dodgeT: 0,
      comboN: 0, moveT: 0,
    };
    a.hp = a.maxHp;
    return a;
  }

  /* ───────────── 이벤트 도우미 ───────────── */
  const ev = (W, e) => { W.events.push(e); };
  const sfx = (W, name, opts) => ev(W, { type: 'sfx', name, opts });
  const text = (W, x, y, str, color, size, extra) =>
    ev(W, Object.assign({ type: 'text', x, y, str, color: color || '#fff', size: size || 22 }, extra || {}));
  const shake = (W, amt) => ev(W, { type: 'shake', amt });
  const bark = (W, group, key) => ev(W, { type: 'bark', group, key });

  /* ───────────── 판정 도우미 ───────────── */
  function inShape(h, x, y, r) {
    switch (h.shape) {
      case 'circle':
        return U.dist2(h.x, h.y, x, y) < (h.r + r) * (h.r + r);
      case 'ring': {
        const d = U.dist(h.x, h.y, x, y);
        return d > h.r0 - r && d < h.r1 + r;
      }
      case 'sector': {
        const d = U.dist(h.x, h.y, x, y);
        if (d > h.r + r) return false;
        if (d < r + 6) return true;
        const tol = Math.asin(Math.min(1, r / d));
        return Math.abs(U.angleDiff(h.ang, U.angleTo(h.x, h.y, x, y))) <= h.arc / 2 + tol;
      }
      case 'line': {
        const ex = h.x + Math.cos(h.ang) * h.len;
        const ey = h.y + Math.sin(h.ang) * h.len;
        return U.segDist2(x, y, h.x, h.y, ex, ey) < (h.w / 2 + r) * (h.w / 2 + r);
      }
      case 'outside':
        return U.dist(h.x, h.y, x, y) > h.r - r;
      case 'all': {
        if (h.safe) {
          for (const s of h.safe) if (U.dist(s.x, s.y, x, y) < s.r - r * 0.5) return false;
        }
        return true;
      }
      default:
        return false;
    }
  }

  /* ───────────── 위험 지역(적의 경고 공격) ───────────── */

  /**
   * 위험 지역을 만듭니다. opts:
   *   warn(경고 시간), life(판정 유지, 기본 0.12), dmg(피해 단위 배율), kb(넉백), tick(지속 판정 간격),
   *   owner, follow(위치 따라감), update(h,W,dt), onActive(h,W), color, noPerfect, safe(안전 지대 목록),
   *   label(경고 글자), pull(끌어당김 세기), silent
   */
  function addHazard(W, shape, geo, opts) {
    const o = opts || {};
    let warn = o.warn != null ? o.warn : 0.8;
    warn *= W.diff.warn;
    if (W.scan > 0) warn *= 1.15;
    const h = Object.assign({
      id: U.nextId(), shape, t: 0, warn, warnMax: warn, life: o.life != null ? o.life : 0.12,
      dmg: o.dmg != null ? o.dmg : 1, kb: o.kb != null ? o.kb : 160, tick: o.tick || 0,
      owner: o.owner || null, follow: o.follow || null, update: o.update || null, onActive: o.onActive || null,
      color: o.color || null, noPerfect: !!o.noPerfect, label: o.label || null, pull: o.pull || 0,
      silent: !!o.silent, hits: new Map(), active: false, done: false, fade: 0, allyDodge: Math.random() < 0.82,
      hitAllies: o.hitAllies !== false, visual: o.visual || null, safe: o.safe || null,
    }, geo);
    W.hazards.push(h);
    return h;
  }

  function updateHazards(W, edt) {
    for (const h of W.hazards) {
      if (h.done) {
        h.fade -= edt;
        continue;
      }
      if (edt <= 0) continue;
      h.t += edt;
      if (h.follow && !h.follow.dead) {
        h.x = h.follow.x + (h.fx || 0);
        h.y = h.follow.y + (h.fy || 0);
      }
      if (h.update) h.update(h, W, edt);
      if (!h.active && h.t >= h.warn) {
        h.active = true;
        h.activeAt = W.t;
        if (h.onActive) h.onActive(h, W);
        if (!h.silent && h.dmg > 0) ev(W, { type: 'hazardHit', h });
      }
      if (h.active) {
        if (h.pull) applyPull(W, h, edt);
        if (h.dmg > 0) hazardHits(W, h);
        if (h.t >= h.warn + h.life) {
          h.done = true;
          h.fade = 0.25;
        }
      }
    }
    W.hazards = W.hazards.filter((h) => !h.done || h.fade > 0);
  }

  function applyPull(W, h, edt) {
    const targets = [W.player, ...W.allies];
    for (const t of targets) {
      if (t.dead || t.down > 0) continue;
      if (t === W.player && t.state === 'dodge') continue;
      const d = U.dist(h.x, h.y, t.x, t.y);
      if (d > (h.pullR || h.r * 2.2) || d < 4) continue;
      const a = U.angleTo(t.x, t.y, h.x, h.y);
      t.x += Math.cos(a) * h.pull * edt;
      t.y += Math.sin(a) * h.pull * edt;
    }
  }

  function hazardHits(W, h) {
    const p = W.player;
    const targets = [p];
    if (h.hitAllies) for (const a of W.allies) targets.push(a);
    for (const t of targets) {
      if (t.dead || t.down > 0) continue;
      const last = h.hits.get(t.id);
      if (last != null && (!h.tick || W.t - last < h.tick)) continue;
      let inside = inShape(h, t.x, t.y, t.r);
      // 회피를 시작한 자리도 판정(막 피한 순간 = 완벽 회피)
      if (!inside && t === p && p.state === 'dodge' && p.dodgeOrigin && p.dodgeT <= p.stats.perfectWindow) {
        inside = inShape(h, p.dodgeOrigin.x, p.dodgeOrigin.y, t.r);
      }
      if (!inside) continue;
      h.hits.set(t.id, W.t);
      const src = h.owner || h;
      hurt(W, t, h.dmg * W.ref.dmg, { x: h.x, y: h.y, kb: h.kb, perfectable: !h.noPerfect, source: src, hazard: h, counterHit: !!h.counterHit });
    }
  }

  /* ───────────── 투사체 ───────────── */

  /** b: { x,y, ang, speed, r, team:'enemy'|'player', dmg(적) | mv,brk(아군), life, homing, color, pierce, air, kind } */
  function addBullet(W, b) {
    const o = Object.assign({
      id: U.nextId(), r: 10, life: 3, t: 0, team: 'enemy', pierce: false, hitSet: new Set(), color: '#ff5470',
      kind: 'orb', homing: 0, delay: 0,
    }, b);
    o.vx = Math.cos(o.ang) * o.speed;
    o.vy = Math.sin(o.ang) * o.speed;
    W.bullets.push(o);
    return o;
  }

  function updateBullets(W, dt, edt) {
    const p = W.player;
    for (const b of W.bullets) {
      const bdt = b.team === 'enemy' ? edt : dt;
      if (bdt <= 0) continue;
      if (b.delay > 0) {
        b.delay -= bdt;
        if (b.follow) { b.x = b.follow.x; b.y = b.follow.y - 20; }
        continue;
      }
      b.t += bdt;
      if (b.homing) {
        const tgt = b.team === 'enemy' ? p : (b.target && !b.target.dead ? b.target : nearestEnemy(W, b.x, b.y, 700));
        if (tgt) {
          const cur = Math.atan2(b.vy, b.vx);
          const want = U.angleTo(b.x, b.y, tgt.x, tgt.y);
          const na = U.turnToward(cur, want, b.homing * bdt);
          const sp = Math.hypot(b.vx, b.vy);
          b.vx = Math.cos(na) * sp;
          b.vy = Math.sin(na) * sp;
        }
      }
      if (b.accel) {
        const sp = Math.hypot(b.vx, b.vy);
        const ns = sp + b.accel * bdt;
        b.vx *= ns / sp;
        b.vy *= ns / sp;
      }
      b.x += b.vx * bdt;
      b.y += b.vy * bdt;
      if (b.t > b.life || b.x < W.bounds.x0 - 80 || b.y < W.bounds.y0 - 80 || b.x > W.bounds.x1 + 80 || b.y > W.bounds.y1 + 80) {
        b.dead = true;
        continue;
      }
      if (b.team === 'enemy') {
        const targets = [p, ...W.allies];
        for (const t of targets) {
          if (t.dead || t.down > 0 || b.hitSet.has(t.id)) continue;
          let inside = U.dist2(b.x, b.y, t.x, t.y) < (b.r + t.r) * (b.r + t.r);
          if (!inside) continue;
          b.hitSet.add(t.id);
          const res = hurt(W, t, (b.dmg || 1) * W.ref.dmg, { x: b.x - b.vx * 0.05, y: b.y - b.vy * 0.05, kb: b.kb || 90, perfectable: true, source: b.owner || b });
          if (res !== 'evaded' && !b.pierce) { b.dead = true; break; }
        }
      } else {
        for (const e of W.enemies) {
          if (e.dead || e.untargetable || b.hitSet.has(e.id)) continue;
          if (U.dist2(b.x, b.y, e.x, e.y) < (b.r + e.r) * (b.r + e.r)) {
            b.hitSet.add(e.id);
            hitEnemy(W, e, { mv: b.mv, brk: b.brk, x: b.x - b.vx * 0.05, y: b.y - b.vy * 0.05, air: b.air !== false,
              kind: b.kind === 'ally' ? 'ally' : 'proj', crit: b.crit, fx: b.fx || 'spark', color: b.color, allyKind: b.allyKind });
            if (!b.pierce) { b.dead = true; break; }
          }
        }
      }
    }
    W.bullets = W.bullets.filter((b) => !b.dead);
  }

  /* ───────────── 플레이어 쪽이 맞을 때 ───────────── */

  /** 반환: 'evaded' | 'perfect' | 'hit' | 'blocked' */
  function hurt(W, t, amount, o) {
    const p = W.player;
    if (W.state !== 'fight') return 'evaded';
    if (t === p) {
      if (p.state === 'stance') {
        AZ.player.onCounterStance(W, o.source);
        return 'perfect';
      }
      if (p.iframe > 0 || p.state === 'ult') {
        if (o.perfectable && p.state === 'dodge' && p.dodgeT <= p.stats.perfectWindow && !p.perfectUsed) {
          p.perfectUsed = true;
          triggerZeroFrame(W, 'dodge');
          return 'perfect';
        }
        if (p.state === 'dodge' && Math.random() < 0.5) text(W, p.x, p.y - 50, 'MISS', '#9ad0ff', 16);
        return 'evaded';
      }
    }
    if (t.kind === 'ally' && (t.down > 0 || t.dead)) return 'evaded';
    let dmg = amount * (0.92 + Math.random() * 0.16);
    if (t === p) dmg *= 1 - p.stats.dmgReduce;
    // 방벽
    if (t.shield > 0) {
      const absorbed = Math.min(t.shield, dmg);
      t.shield -= absorbed;
      dmg -= absorbed;
      if (absorbed > 0) ev(W, { type: 'spark', x: t.x, y: t.y, z: 30, color: '#7ce8ff', n: 6 });
      if (dmg <= 0) {
        sfx(W, 'shield', { vol: 0.5 });
        text(W, t.x, t.y - 46, '방벽', '#7ce8ff', 16);
        return 'blocked';
      }
    }
    dmg = Math.max(1, Math.round(dmg));
    t.hp -= dmg;
    t.flash = 0.18;
    // 넉백
    const a = U.angleTo(o.x, o.y, t.x, t.y);
    const kb = o.kb || 100;
    if (t === p) {
      W.stats.damageTaken += dmg;
      W.stats.hitsTaken += 1;
      if (o.source && o.source.kind === 'boss' && o.source.bossId === 'zero' && o.counterHit) W.stats.countered += 1;
      AZ.player.onHurt(W, dmg, a, kb);
      text(W, t.x, t.y - 56, String(dmg), '#ff5470', 24, { hurt: true });
      shake(W, Math.min(14, 5 + dmg / W.ref.dmg * 4));
      ev(W, { type: 'flash', color: 'rgba(255,40,70,0.22)', t: 0.18 });
      W.hitstop = Math.max(W.hitstop, 0.05);
      sfx(W, 'hurt');
      if (t.hp <= 0) {
        t.hp = 0;
        AZ.player.onDeath(W);
      } else if (t.hp < t.maxHp * 0.3 && !p.lowHpBarked) {
        p.lowHpBarked = true;
        bark(W, 'lia', 'lowHp');
      }
    } else {
      t.vx += Math.cos(a) * kb * 0.6;
      t.vy += Math.sin(a) * kb * 0.6;
      text(W, t.x, t.y - 50, String(dmg), '#ff9aa8', 16);
      if (t.hp <= 0) {
        t.hp = 0;
        t.down = t.ally === 'lia' ? 12 : 15;
        text(W, t.x, t.y - 70, t.ally === 'lia' ? '리아 다운 — 재기동 중' : '제로 다운', '#ffb35c', 18);
        bark(W, 'lia', 'allyDown');
        sfx(W, 'glitch');
      }
    }
    return 'hit';
  }

  /* ───────────── ZERO FRAME ───────────── */
  function triggerZeroFrame(W, cause) {
    const p = W.player;
    const dur = p.stats.zeroDur;
    W.zero = dur;
    W.zeroMax = dur;
    W.stats.zeroFrames += 1;
    p.counterReady = 1.4;
    AZ.player.gainFocus(W, 25);
    p.chain = Math.min(100, p.chain + 20);
    sfx(W, 'perfect');
    sfx(W, 'zeroFrame');
    ev(W, { type: 'banner', kind: 'zero', text: 'ZERO FRAME', sub: '적의 시간이 느려진다 — 약점 노출!' });
    ev(W, { type: 'flash', color: 'rgba(120,220,255,0.5)', t: 0.25 });
    ev(W, { type: 'ring', x: p.x, y: p.y, r0: 10, r1: 260, color: '#9ae6ff', t: 0.5 });
    W.hitstop = Math.max(W.hitstop, 0.08);
    if (W.stats.zeroFrames === 1 || Math.random() < 0.35) bark(W, 'lia', 'zeroFrame');
    if (p.stats.afterimage && p.dodgeOrigin && cause === 'dodge') {
      const o = p.dodgeOrigin;
      ev(W, { type: 'burst', x: o.x, y: o.y, z: 20, r: 140, color: '#b0f0ff' });
      sfx(W, 'explosion', { vol: 0.6 });
      for (const e of W.enemies) {
        if (e.dead || e.untargetable) continue;
        if (U.dist(o.x, o.y, e.x, e.y) < 140 + e.r) {
          hitEnemy(W, e, { mv: 3.0, brk: 12, x: o.x, y: o.y, air: true, kind: 'skill', fx: 'burst' });
        }
      }
    }
  }

  /* ───────────── 적이 맞을 때 ───────────── */

  /** 약점/방패 판정 */
  function hitAngleInfo(W, e, ax, ay) {
    const def = e.def || {};
    const res = { weak: false, shielded: false };
    if (W.zero > 0 || e.broken || e.exposed > 0) { res.weak = true; return res; }
    const rel = Math.abs(U.angleDiff(e.facing, U.angleTo(e.x, e.y, ax, ay)));
    const weak = def.weak || {};
    if (weak.back && !weak.exposedOnly && rel > Math.PI - weak.back / 2) res.weak = true;
    if (def.shield && rel < def.shield / 2 && !e.shieldDown) res.shielded = true;
    return res;
  }

  /**
   * o: { mv, brk, x, y (공격이 온 위치), air, kind:'melee'|'proj'|'skill'|'ally'|'ult', crit(강제), fx, color, noCombo }
   * 반환: { dmg, weak, crit, shielded } 또는 null(빗나감)
   */
  function hitEnemy(W, e, o) {
    const p = W.player;
    const s = p.stats;
    if (e.dead || e.untargetable) return null;
    if (e.airborne && !o.air) {
      if (!e.missT || W.t - e.missT > 0.6) {
        e.missT = W.t;
        text(W, e.x, e.y - e.r - (e.z || 0) - 20, '닿지 않음', '#9ab0c8', 15);
      }
      return null;
    }
    // 세라의 환영: 한 대 맞으면 사라짐
    if (e.clone) {
      e.hp = 0;
      killEnemy(W, e);
      ev(W, { type: 'burst', x: e.x, y: e.y, z: (e.z || 0) + 24, r: 60, color: '#d8c8ff' });
      sfx(W, 'glitch', { vol: 0.5 });
      return { dmg: 0, weak: false, crit: false, shielded: false };
    }
    const info = hitAngleInfo(W, e, o.x, o.y);
    const isAlly = o.kind === 'ally';
    let dmg = s.atk * (o.mv || 1);
    if (isAlly) dmg *= s.allyMul * (W.allyFocus > 0 ? 1.4 : 1);
    let crit = false;
    if (!isAlly) {
      crit = !!o.crit || Math.random() < s.crit;
      if (p.blinkCrit > 0 && o.kind !== 'proj') { crit = true; p.blinkCrit = 0; dmg *= 1.5; }
      if (crit) dmg *= s.critDmg;
      // 콤보 보너스
      const comboBonus = Math.min(p.combo, 30) * 0.005 + (s.comboAmp ? Math.min(p.combo, 50) / 50 * s.comboAmp : 0);
      dmg *= 1 + comboBonus + (s.comboMaster && p.combo >= 30 ? 0.15 : 0);
      if (s.lastStand && p.hp < p.maxHp * 0.35) dmg *= 1.25;
    }
    if (info.weak) dmg *= s.weakMul + (W.scan > 0 ? 0.25 : 0);
    if (e.broken) dmg *= 1.5;
    if (W.zero > 0) dmg *= 1.2;
    if (o.kind === 'ult') dmg *= s.ultMul;
    if (e.def && e.def.armorMul && !info.weak) dmg *= e.def.armorMul;
    if (info.shielded) dmg *= 0.15;
    if (e.dmgTakenMul) dmg *= e.dmgTakenMul;
    dmg *= 0.95 + Math.random() * 0.1;
    dmg = Math.max(1, Math.round(dmg));

    e.hp -= dmg;
    e.flash = 0.12;
    W.stats.dmgDealt += dmg;
    W.stats.byKind[o.kind || 'melee'] = (W.stats.byKind[o.kind || 'melee'] || 0) + dmg;
    if (info.weak && !isAlly) W.stats.weakHits += 1;

    // 브레이크
    let brk = (o.brk || 0) * s.breakMul;
    if (info.weak) brk *= 1.5;
    if (info.shielded) brk *= o.kind === 'melee' && o.mv >= 2 ? 0.6 : 0.2;
    if (isAlly && W.allyFocus > 0) brk *= 2;
    if (e.airborne && (o.kind === 'proj' || o.kind === 'ally')) brk *= 1.5;
    if (e.kind === 'boss') damageBreak(W, e, brk);
    else if (!e.broken && brk > 0) {
      e.stagger = (e.stagger || 0) + brk;
      if (e.stagger >= e.maxHp / Math.max(1, W.ref.atk) * 3 && !e.superArmor) {
        e.stagger = 0;
        e.stun = 0.5;
        e.brain.gen = null;
        cancelOwnedWarnings(W, e);
      }
    }

    // 플레이어 쪽 보상
    if (!isAlly && !o.noCombo && o.kind !== 'ult') {
      p.combo += 1;
      p.comboT = 2.6;
      if (p.combo > W.stats.maxCombo) W.stats.maxCombo = p.combo;
      AZ.player.gainFocus(W, o.kind === 'melee' ? (o.mv >= 2 ? 2.6 : 1.1) : 0.7);
      p.chain = Math.min(100, p.chain + (o.kind === 'melee' ? 1.2 : 0.6));
      if (s.lifesteal > 0) p.hp = Math.min(p.maxHp, p.hp + dmg * s.lifesteal);
    }

    // 연출
    const ex = e.x;
    const ey = e.y;
    const color = info.shielded ? '#ffe066' : info.weak ? '#7cf7ff' : crit ? '#ffe066' : '#ffffff';
    const label = info.shielded ? '방어됨' : null;
    if (W.settingsDamageNumbers !== false) {
      text(W, ex + U.rand(-14, 14), ey - e.r - (e.z || 0) - 16, String(dmg), color, crit ? 30 : info.weak ? 26 : 20,
        { crit, weak: info.weak, ally: isAlly });
    }
    if (label) text(W, ex, ey - e.r - (e.z || 0) - 44, label, '#ffe066', 15);
    else if (info.weak && (!e.weakTextT || W.t - e.weakTextT > 1.2)) {
      e.weakTextT = W.t;
      text(W, ex, ey - e.r - (e.z || 0) - 46, 'WEAK', '#7cf7ff', 16, { tag: true });
    }
    ev(W, { type: 'spark', x: ex + (o.x - ex) * Math.min(0.8, e.r / Math.max(1, Math.hypot(o.x - ex, o.y - ey))), y: ey + (o.y - ey) * Math.min(0.8, e.r / Math.max(1, Math.hypot(o.x - ex, o.y - ey))), z: (e.z || 0) + Math.min(60, e.r * 0.9 + 10), color: o.color || (info.weak ? '#7cf7ff' : '#cfefff'), n: crit ? 14 : 8, big: o.mv >= 2 });
    if (info.shielded) sfx(W, 'clang', { vol: 0.6 });
    else sfx(W, info.weak ? 'hitWeak' : crit ? 'crit' : 'hit', { vol: isAlly ? 0.35 : 0.7, pitch: 0.9 + Math.random() * 0.2 });
    if (o.mv >= 2 && !isAlly) {
      W.hitstop = Math.max(W.hitstop, o.kind === 'ult' ? 0.04 : 0.07);
      shake(W, 6);
    } else if (!isAlly) {
      W.hitstop = Math.max(W.hitstop, 0.025);
    }
    // 넉백(작은 적)
    if (e.kind !== 'boss' && !e.superArmor) {
      const a = U.angleTo(o.x, o.y, e.x, e.y);
      const kb = o.mv >= 2 ? 260 : 90;
      e.vx += Math.cos(a) * kb;
      e.vy += Math.sin(a) * kb;
    }

    if (e.kind === 'boss') AZ.ai.onBossDamaged(W, e, dmg, o);
    if (e.hp <= 0) killEnemy(W, e);
    return { dmg, weak: info.weak, crit, shielded: info.shielded };
  }

  function damageBreak(W, e, amount) {
    if (e.broken || e.dead || amount <= 0) return;
    e.brk -= amount;
    e.brkIdle = 0;
    if (e.brk <= 0) breakBoss(W, e);
  }

  function breakBoss(W, e) {
    e.brk = 0;
    e.broken = true;
    e.breakT = 6;
    e.brain.gen = null;
    e.dash = null;
    W.stats.breaks += 1;
    W.chainUsedThisBreak = false;
    cancelOwnedWarnings(W, e);
    AZ.player.gainFocus(W, 8);
    sfx(W, 'break');
    shake(W, 12);
    W.hitstop = Math.max(W.hitstop, 0.12);
    ev(W, { type: 'banner', kind: 'break', text: 'BREAK!', sub: W.allies.some((a) => a.down <= 0) ? '연계 공격 가능 — [F]' : '방어 붕괴 — 받는 피해 증가' });
    ev(W, { type: 'burst', x: e.x, y: e.y, z: (e.z || 0) + e.r * 0.8, r: e.r * 2.4, color: '#ffe066' });
    ev(W, { type: 'flash', color: 'rgba(255,230,120,0.35)', t: 0.2 });
    bark(W, e.bossId, 'broken');
    if (Math.random() < 0.6) bark(W, 'lia', 'break');
    AZ.ai.onBossBroken(W, e);
  }

  function cancelOwnedWarnings(W, e) {
    for (const h of W.hazards) {
      if (h.owner === e && !h.active && !h.done && !h.keepOnBreak) {
        h.done = true;
        h.fade = 0.2;
      }
    }
  }

  function killEnemy(W, e) {
    if (e.dead) return;
    e.dead = true;
    e.hp = 0;
    e.deadT = 0;
    cancelOwnedWarnings(W, e);
    if (e.kind === 'boss') {
      AZ.ai.onBossDeath(W, e);
      return;
    }
    if (!e.def.clone) {
      W.stats.kills += 1;
      W.stats.exp += e.def.exp * (1 + 0.25 * (W.cfg.chapterId - 1));
      W.stats.credits += e.def.credits * (1 + 0.2 * (W.cfg.chapterId - 1));
      ev(W, { type: 'burst', x: e.x, y: e.y, z: (e.z || 0) + 20, r: e.r * 2.2, color: e.def.color });
      sfx(W, 'explosion', { vol: 0.45, pitch: 1.2 });
      if (Math.random() < 0.12) W.pickups.push({ kind: 'heal', x: e.x, y: e.y, t: 0 });
    }
  }

  /* ───────────── 주변 탐색 ───────────── */
  function nearestEnemy(W, x, y, maxD) {
    let best = null;
    let bd = maxD != null ? maxD * maxD : Infinity;
    for (const e of W.enemies) {
      if (e.dead || e.untargetable || e.clone) continue;
      const d = U.dist2(x, y, e.x, e.y);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }
  function livingEnemies(W) {
    return W.enemies.filter((e) => !e.dead);
  }

  /* ───────────── 동료 AI ───────────── */
  function updateAllies(W, dt) {
    const p = W.player;
    for (const a of W.allies) {
      a.flash = Math.max(0, a.flash - dt);
      a.animT += dt;
      if (a.shieldT > 0) { a.shieldT -= dt; if (a.shieldT <= 0) a.shield = 0; }
      if (a.down > 0) {
        a.down -= dt;
        if (a.down <= 0) {
          a.hp = Math.round(a.maxHp * 0.5);
          text(W, a.x, a.y - 60, a.ally === 'lia' ? '리아 재기동' : '제로 복귀', '#7cf7d4', 18);
          sfx(W, 'heal', { vol: 0.5 });
        }
        continue;
      }
      // 위험 지역 피하기
      let avoid = null;
      for (const h of W.hazards) {
        if (h.done || h.active || !h.hitAllies || !h.allyDodge || h.dmg <= 0) continue;
        if (inShape(h, a.x, a.y, a.r + 12)) { avoid = h; break; }
      }
      let tx;
      let ty;
      let speed;
      const tgt = p.target && !p.target.dead && !p.target.untargetable ? p.target : nearestEnemy(W, a.x, a.y, 900);
      if (avoid) {
        let ang;
        if (avoid.shape === 'line') ang = avoid.ang + Math.PI / 2 * (U.angleDiff(avoid.ang, U.angleTo(avoid.x, avoid.y, a.x, a.y)) > 0 ? 1 : -1);
        else if (avoid.shape === 'outside') ang = U.angleTo(a.x, a.y, avoid.x, avoid.y);
        else ang = U.angleTo(avoid.x, avoid.y, a.x, a.y);
        tx = a.x + Math.cos(ang) * 200;
        ty = a.y + Math.sin(ang) * 200;
        speed = 420;
      } else if (a.ally === 'lia') {
        const side = p.facing + Math.PI * 0.75;
        tx = p.x + Math.cos(side) * 70;
        ty = p.y + Math.sin(side) * 70;
        speed = 300;
      } else {
        // 제로: 대상에게 붙어서 베기
        if (tgt) {
          const d = U.dist(a.x, a.y, tgt.x, tgt.y);
          const want = tgt.r + 40;
          const ang = U.angleTo(tgt.x, tgt.y, a.x, a.y) + Math.sin(W.t * 0.7 + a.id) * 0.6;
          tx = tgt.x + Math.cos(ang) * want;
          ty = tgt.y + Math.sin(ang) * want;
          speed = d > 250 ? 420 : 260;
        } else {
          tx = p.x + 60;
          ty = p.y + 30;
          speed = 260;
        }
      }
      const d = U.dist(a.x, a.y, tx, ty);
      const acting = (a.anim === 'cast' || a.anim === 'attack') && a.animT < 0.3;
      if (d > 6) {
        const ang = U.angleTo(a.x, a.y, tx, ty);
        const step = Math.min(d, speed * dt * (d < 60 ? d / 60 : 1));
        a.x += Math.cos(ang) * step;
        a.y += Math.sin(ang) * step;
        if (!acting) a.anim = 'move';
      } else if (!acting) a.anim = 'idle';
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      a.vx *= Math.pow(0.02, dt);
      a.vy *= Math.pow(0.02, dt);
      clampToArena(W, a);
      if (tgt) a.facing = U.angleTo(a.x, a.y, tgt.x, tgt.y);

      // 공격
      a.atkT -= dt * (W.allyFocus > 0 ? 1.5 : 1);
      if (tgt && a.atkT <= 0 && W.state === 'fight') {
        if (a.ally === 'lia') {
          a.atkT = 1.1;
          a.anim = 'cast';
          a.animT = 0;
          addBullet(W, { x: a.x, y: a.y - a.z, ang: U.angleTo(a.x, a.y, tgt.x, tgt.y), speed: 900, r: 8, team: 'player',
            mv: 0.32, brk: 1, life: 1.2, color: '#9ae6ff', kind: 'ally', allyKind: 'lia', homing: 3, target: tgt, air: true });
          sfx(W, 'shot', { vol: 0.25, pitch: 1.4 });
        } else if (U.dist(a.x, a.y, tgt.x, tgt.y) < tgt.r + 70 && !tgt.airborne) {
          a.comboN = (a.comboN + 1) % 4;
          a.atkT = a.comboN === 3 ? 1.1 : 0.42;
          a.anim = 'attack';
          a.animT = 0;
          hitEnemy(W, tgt, { mv: a.comboN === 3 ? 0.7 : 0.3, brk: a.comboN === 3 ? 5 : 2, x: a.x, y: a.y, kind: 'ally', air: false, color: '#ff6b8a' });
          ev(W, { type: 'slash', x: a.x, y: a.y, ang: a.facing, range: 80, arc: 2.2, fx: a.comboN % 2 ? 'slashL' : 'slashR', color: '#ff3355', ally: true });
        } else {
          a.atkT = 0.2;
        }
      }
    }
  }

  function clampToArena(W, e) {
    if (W.level && e.kind !== 'boss') {
      const q = AZ.level.constrain(W.level, e.x, e.y, Math.min(e.r, 30) * 0.8, W.stage && W.stage.lock);
      e.x = q.x;
      e.y = q.y;
      const gt = W.level.gate;
      if (gt && W.stage && !W.stage.gateOpen && !W.stage.lock && e.y < gt.y + 24 && e.y > gt.y - 400 && e.x > gt.x0 - 200 && e.x < gt.x1 + 200) e.y = gt.y + 24;
      return;
    }
    const m = e.r + 10;
    e.x = U.clamp(e.x, m, W.w - m);
    e.y = U.clamp(e.y, m, W.h - m);
  }

  /** 겹친 몸 밀어내기 */
  function separate(W) {
    const p = W.player;
    const bodies = W.enemies.filter((e) => !e.dead && !e.untargetable && !e.airborne && !e.ghost);
    for (const e of bodies) {
      if (p.dead) break;
      if (p.state === 'dodge' || p.state === 'ult') continue;
      const d = U.dist(p.x, p.y, e.x, e.y);
      const min = p.r + e.r;
      if (d < min && d > 0.01) {
        const push = (min - d);
        const a = U.angleTo(e.x, e.y, p.x, p.y);
        const share = e.kind === 'boss' || e.superArmor ? 1 : 0.5;
        p.x += Math.cos(a) * push * share;
        p.y += Math.sin(a) * push * share;
        if (share < 1) {
          e.x -= Math.cos(a) * push * 0.5;
          e.y -= Math.sin(a) * push * 0.5;
        }
      }
    }
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const a = bodies[i];
        const b = bodies[j];
        const d = U.dist(a.x, a.y, b.x, b.y);
        const min = a.r + b.r;
        if (d < min && d > 0.01) {
          const push = (min - d) / 2;
          const ang = U.angleTo(b.x, b.y, a.x, a.y);
          const wa = a.kind === 'boss' ? 0 : 1;
          const wb = b.kind === 'boss' ? 0 : 1;
          a.x += Math.cos(ang) * push * wa * (wb ? 1 : 2);
          a.y += Math.sin(ang) * push * wa * (wb ? 1 : 2);
          b.x -= Math.cos(ang) * push * wb * (wa ? 1 : 2);
          b.y -= Math.sin(ang) * push * wb * (wa ? 1 : 2);
        }
      }
    }
    clampToArena(W, p);
    for (const e of bodies) clampToArena(W, e);
  }

  /* ───────────── 웨이브 ───────────── */
  function updateWaves(W, dt) {
    if (W.mode !== 'wave' || W.state !== 'fight') return;
    const alive = W.enemies.some((e) => !e.dead && !e.def.clone);
    if (alive) return;
    if (W.waveIdx >= W.waves.length - 1) {
      // 모든 웨이브 끝 → 기억 파편 등장
      if (!W.memorySpawned) {
        W.memorySpawned = true;
        W.pickups.push({ kind: 'memory', x: W.w / 2, y: W.h / 2, t: 0 });
        ev(W, { type: 'banner', kind: 'info', text: 'AREA CLEAR', sub: '기억 파편 반응 — 회수하세요' });
        sfx(W, 'victory', { vol: 0.5 });
      }
      return;
    }
    W.waveDelay -= dt;
    if (W.waveDelay > 0) return;
    W.waveIdx += 1;
    W.waveDelay = 1.2;
    const wave = W.waves[W.waveIdx];
    let n = 0;
    for (const [type, count] of wave) {
      for (let i = 0; i < count; i++) {
        const side = n % 4;
        let x;
        let y;
        if (side === 0) { x = U.rand(120, W.w - 120); y = 90; } else if (side === 1) { x = W.w - 90; y = U.rand(120, W.h - 120); } else if (side === 2) { x = U.rand(120, W.w - 120); y = W.h - 90; } else { x = 90; y = U.rand(120, W.h - 120); }
        // 플레이어 바로 옆에 나오지 않게
        if (U.dist(x, y, W.player.x, W.player.y) < 300) { x = W.w - x; y = W.h - y; }
        AZ.ai.spawnMinion(W, type, x, y, { delay: 0.2 + n * 0.12 });
        n += 1;
      }
    }
    ev(W, { type: 'banner', kind: 'wave', text: `WAVE ${W.waveIdx + 1} / ${W.waves.length}`, sub: '' });
    sfx(W, 'alarm', { vol: 0.5 });
  }

  function updatePickups(W, dt) {
    const p = W.player;
    for (const k of W.pickups) {
      k.t += dt;
      if (k.taken || k.hidden) continue;
      const d = U.dist(p.x, p.y, k.x, k.y);
      // 가까우면 끌려옴
      if (d < 160 && (k.kind === 'heal' || (k.kind === 'credit' && !k.big))) {
        const a = U.angleTo(k.x, k.y, p.x, p.y);
        k.x += Math.cos(a) * 300 * dt;
        k.y += Math.sin(a) * 300 * dt;
      }
      if (d < p.r + 26) {
        k.taken = true;
        if (k.kind === 'heal') {
          const amt = Math.round(p.maxHp * 0.12);
          p.hp = Math.min(p.maxHp, p.hp + amt);
          text(W, p.x, p.y - 60, `+${amt}`, '#7cf7a0', 20);
          sfx(W, 'heal', { vol: 0.6 });
        } else if (k.kind === 'credit') {
          W.stats.credits += k.amount || 50;
          text(W, p.x, p.y - 60, `+${k.amount || 50} ◈`, '#9fe8ff', k.big ? 26 : 20);
          sfx(W, 'pickup', { vol: 0.5, pitch: k.big ? 0.8 : 1.3 });
          if (k.big) ev(W, { type: 'banner', kind: 'memory', text: '보물 획득', sub: `크레딧 +${k.amount}` });
        } else if (k.kind === 'memory') {
          W.memoryFound = true;
          sfx(W, 'pickup');
          ev(W, { type: 'flash', color: 'rgba(200,230,255,0.6)', t: 0.4 });
          ev(W, { type: 'banner', kind: 'memory', text: '기억 파편 회수', sub: W.mode === 'stage' ? '갈림길 끝의 기억' : '' });
          if (W.mode !== 'stage') endBattle(W, 'victory', 1.4);
        }
      }
    }
    W.pickups = W.pickups.filter((k) => !k.taken && (k.permanent || k.t < 30));
  }

  function endBattle(W, outcome, delay) {
    if (W.ending) return;
    W.ending = { outcome, t: delay || 0 };
  }

  /** 히트스톱 동안 눌린 버튼을 다음 프레임으로 넘김 */
  function mergeInput(a, b) {
    if (!b) return a || null;
    if (!a) return Object.assign({}, b, { skills: (b.skills || []).slice(), cmds: (b.cmds || []).slice() });
    const out = Object.assign({}, b);
    for (const k of ['attack', 'heavy', 'dodge', 'ult', 'chain']) out[k] = !!(a[k] || b[k]);
    out.skills = [0, 1, 2].map((i) => !!((a.skills && a.skills[i]) || (b.skills && b.skills[i])));
    out.cmds = [0, 1, 2].map((i) => !!((a.cmds && a.cmds[i]) || (b.cmds && b.cmds[i])));
    return out;
  }

  /* ───────────── 메인 스텝 ───────────── */
  function step(W, realDt, input) {
    const dtCap = Math.min(realDt, 1 / 30);
    W.stateT += dtCap;
    if (W.state === 'done') return;
    if (W.hold) return;

    if (W.state === 'intro') {
      if (W.stateT >= (W.boss ? 1.4 : 0.8)) {
        W.state = 'fight';
        W.stateT = 0;
        ev(W, { type: 'banner', kind: 'start', text: W.boss ? 'ENGAGE' : 'MISSION START', sub: W.boss ? '' : W.mode === 'stage' ? '길을 따라 보스 구역으로' : '' });
        if (W.boss) bark(W, W.boss.bossId, 'start');
      }
    }

    if (W.hitstop > 0) {
      W.hitstop -= dtCap;
      W.pendingInput = mergeInput(W.pendingInput, input);
      return;
    }
    if (W.pendingInput) {
      input = mergeInput(W.pendingInput, input);
      W.pendingInput = null;
    }
    // 느린 화면(처치 연출)
    if (W.slowT > 0) {
      W.slowT -= dtCap;
      if (W.slowT <= 0) W.slow = 1;
    }
    const dt = dtCap * W.slow;
    W.t += dt;
    if (W.state === 'fight' && !W.ending) W.stats.time += dt;

    if (W.zero > 0) {
      W.zero -= dt;
      if (W.zero <= 0) { W.zero = 0; ev(W, { type: 'zeroEnd' }); }
    }
    if (W.timeStop > 0) W.timeStop -= dt;
    W.enemyScale = W.timeStop > 0 ? 0 : W.zero > 0 ? 0.25 : 1;
    const edt = dt * W.enemyScale;
    if (W.scan > 0) W.scan -= dt;
    if (W.allyFocus > 0) W.allyFocus -= dt;
    for (let i = 0; i < 3; i++) if (W.cmdCd[i] > 0) W.cmdCd[i] -= dt;

    const controllable = W.state === 'fight' && !W.ending;
    if (controllable && input && input.interact && W.stage) interact(W);
    AZ.player.update(W, dt, controllable ? input : null);
    if (W.state === 'fight' || W.state === 'intro') {
      updateAllies(W, dt);
    }
    AZ.ai.update(W, dt, edt);
    updateHazards(W, edt);
    updateBullets(W, dt, edt);
    separate(W);
    updateWaves(W, dt);
    updateStage(W, dt);
    updatePickups(W, dt);

    if (W.ending) {
      W.ending.t -= dtCap;
      if (W.ending.t <= 0) {
        W.state = W.ending.outcome;
        W.stateT = 0;
        W.result = Object.assign({}, W.stats, { outcome: W.ending.outcome, maxHp: W.player.maxHp, memoryFound: W.memoryFound });
        W.result.chest = W.found.chest;
        if (W.stage) {
          W.result.stageTime = (W.stageStats ? W.stageStats.time : 0) + W.stats.time;
          W.result.checkpoint = W.stage.bossTriggered ? 'boss' : W.stage.cpReached ? 'cp' : 0;
        }
      }
    }
  }

  return {
    create, step, startBoss, addHazard, addBullet, hurt, hitEnemy, damageBreak, breakBoss, triggerZeroFrame,
    killEnemy, nearestEnemy, livingEnemies, inShape, clampToArena, endBattle, cancelOwnedWarnings,
    ev, sfx, text, shake, bark, hitAngleInfo,
  };
})();
