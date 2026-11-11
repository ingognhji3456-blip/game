'use strict';

/* =========================================================
 * 보스 패턴 — 설계: docs/design/enemies.md (👑 항목), DESIGN.md §7.2.5(경고)
 * update(game, e, api)는 매 틱 보스마다 불립니다.
 * ========================================================= */
RG.bosses = (() => {
  const D = () => RG.data;

  function timer(e, key, every, first) {
    const tm = e.boss.timers;
    if (tm[key] == null) tm[key] = first != null ? first : every;
    tm[key] -= 1 / 30;
    if (tm[key] <= 0) { tm[key] += every; return true; }
    return false;
  }

  function summon(game, e, api, s) {
    for (let i = 0; i < s.n; i++) api.spawnEnemy(s.type, null, { from: e, index: i });
    api.ev('bossAbility', { enemyId: e.id, ability: 'summon', x: e.x, y: e.y });
  }

  function phaseCheck(game, e, api, ph) {
    if (!ph || e.boss.phase >= 1) return false;
    if (e.hp / e.maxHp > ph.at) return false;
    e.boss.phase = 1;
    api.ev('bossPhase', { enemyId: e.id, phase: 2, x: e.x, y: e.y });
    return true;
  }

  /** 경고 후 탑 멈춤 예약 */
  function warnTowers(game, e, api, towers, dur, ability) {
    if (!towers.length) return;
    const st = game.state;
    const warn = D().rules.bossWarn;
    const alert = { id: `${e.id}:${st.tick}`, towerIds: towers.map((t) => t.id), at: st.time + warn, dur, ability, x: e.x, y: e.y };
    st.alerts.push(alert);
    api.ev('bossAbility', { enemyId: e.id, ability: `${ability}Warn`, x: e.x, y: e.y, targets: alert.towerIds });
  }

  /** 예약된 경고 처리 (sim이 매 틱 호출) */
  function resolveAlerts(game, api) {
    const st = game.state;
    if (!st.alerts.length) return;
    st.alerts = st.alerts.filter((a) => {
      if (st.time < a.at) return true;
      if (a.veil) { // 별 가리기: 그 순간 원 안의 탑 사거리 감소
        const R2 = a.veil.radius * a.veil.radius;
        const hit = [];
        for (const t of st.towers) if ((t.x - a.x) ** 2 + (t.y - a.y) ** 2 <= R2) { t.veilUntil = st.time + a.dur; t.veilPct = a.veil.pct; hit.push(t.id); }
        st.veilEnd = Math.max(st.veilEnd || 0, st.time + a.dur);
        if (api.markStats) api.markStats();
        api.ev('bossAbility', { ability: 'veil', x: a.x, y: a.y, targets: hit, radius: a.veil.radius });
        return false;
      }
      for (const id of a.towerIds) {
        const t = st.towers.find((x) => x.id === id);
        if (t) api.disableTower(t, a.dur, a.ability);
      }
      api.ev('bossAbility', { ability: a.ability, x: a.x, y: a.y, targets: a.towerIds });
      return false;
    });
  }

  const BOSSES = {
    hollow_elder(game, e, api, bd) {
      if (timer(e, 'summon', bd.summon.every, 10)) summon(game, e, api, bd.summon);
      if (phaseCheck(game, e, api, bd.phase)) {
        e.bossArmor = bd.phase.armor;
        e.speedMul = bd.phase.speedMul;
      }
    },

    whitehorn(game, e, api, bd) {
      if (timer(e, 'breath', bd.breath.every, 8)) {
        const st = game.state;
        const list = st.towers.filter((t) => (t.x - e.x) ** 2 + (t.y - e.y) ** 2 <= bd.breath.range ** 2)
          .sort((a, b) => ((a.x - e.x) ** 2 + (a.y - e.y) ** 2) - ((b.x - e.x) ** 2 + (b.y - e.y) ** 2) || a.id - b.id)
          .slice(0, bd.breath.towers);
        warnTowers(game, e, api, list, bd.breath.dur, 'breath');
      }
      if (phaseCheck(game, e, api, bd.phase)) {
        summon(game, e, api, bd.phase.summon);
        e.speedMul = bd.phase.speedMul;
      }
    },

    pyre_worm(game, e, api, bd) {
      const st = game.state;
      const dv = bd.dive;
      if (e.boss.diving) {
        if (st.time >= e.boss.diveEnd) {
          e.boss.diving = false;
          e.burrowed = false;
          api.advance(e, dv.tiles);
          for (const u of st.units) {
            if (u.dead || u.kind === 'drone') continue;
            if ((u.x - e.x) ** 2 + (u.y - e.y) ** 2 <= dv.stunRadius ** 2) { u.stunUntil = st.time + dv.stun; }
          }
          api.ev('bossAbility', { enemyId: e.id, ability: 'emerge', x: e.x, y: e.y });
        }
      } else if (timer(e, 'dive', dv.every, 6)) {
        e.boss.diving = true;
        e.boss.diveEnd = st.time + dv.under;
        e.burrowed = true;
        api.releaseEnemy(e);
        api.ev('bossAbility', { enemyId: e.id, ability: 'dive', x: e.x, y: e.y });
      }
      if (phaseCheck(game, e, api, bd.phase)) summon(game, e, api, bd.phase.summon);
    },

    tempest_whale(game, e, api, bd) {
      const st = game.state;
      if (timer(e, 'bolt', bd.bolt.every, 7) && st.towers.length) {
        // 가장 가까운 탑을 지나는 직선 위의 탑들
        const near = st.towers.slice().sort((a, b) => ((a.x - e.x) ** 2 + (a.y - e.y) ** 2) - ((b.x - e.x) ** 2 + (b.y - e.y) ** 2) || a.id - b.id)[0];
        const dx = near.x - e.x;
        const dy = near.y - e.y;
        const L = Math.sqrt(dx * dx + dy * dy) || 1;
        const ux = dx / L;
        const uy = dy / L;
        const onLine = st.towers.filter((t) => {
          const px = t.x - e.x;
          const py = t.y - e.y;
          const along = px * ux + py * uy;
          const perp = Math.abs(px * uy - py * ux);
          return along >= -0.5 && along <= L + 6 && perp <= bd.bolt.width;
        }).sort((a, b) => ((a.x - e.x) ** 2 + (a.y - e.y) ** 2) - ((b.x - e.x) ** 2 + (b.y - e.y) ** 2) || a.id - b.id).slice(0, bd.bolt.towers);
        warnTowers(game, e, api, onLine, bd.bolt.dur, 'bolt');
      }
      if (phaseCheck(game, e, api, bd.phase)) summon(game, e, api, bd.phase.summon);
    },

    bellkeeper(game, e, api, bd) {
      const st = game.state;
      if (timer(e, 'blink', bd.blink.every, 5)) {
        const fx = e.x;
        const fy = e.y;
        api.advance(e, bd.blink.tiles);
        api.ev('bossAbility', { enemyId: e.id, ability: 'blink', x: e.x, y: e.y, fromX: fx, fromY: fy });
      }
      if (timer(e, 'ward', bd.ward.every, 4)) {
        for (const o of st.enemies) {
          if (o.dead || o === e) continue;
          if ((o.x - e.x) ** 2 + (o.y - e.y) ** 2 > bd.ward.radius ** 2) continue;
          if (st.time < o.st.purifyUntil) continue;
          const amt = o.maxHp * bd.ward.pct;
          if (amt > o.shield) { o.shield = amt; o.maxShield = Math.max(o.maxShield, amt); }
        }
        api.ev('enemyShield', { x: e.x, y: e.y, radius: bd.ward.radius });
      }
      if (phaseCheck(game, e, api, bd.phase)) summon(game, e, api, bd.phase.summon);
    },

    gloom_monarch(game, e, api, bd) {
      const st = game.state;
      // ① 별 가리기: 경고(원) 뒤 반경 안 탑의 사거리 −40% (5초)
      if (timer(e, 'veil', bd.veil.every, 6)) {
        const V = bd.veil;
        const alert = { id: `${e.id}:${st.tick}`, towerIds: [], at: st.time + D().rules.bossWarn, dur: V.dur, ability: 'veil', x: e.x, y: e.y, veil: V };
        st.alerts.push(alert);
        api.ev('warnArea', { x: e.x, y: e.y, radius: V.radius, dur: D().rules.bossWarn, element: 'dark' });
        api.ev('bossAbility', { enemyId: e.id, ability: 'veilWarn', x: e.x, y: e.y });
      }
      // ② 70%: 나방 떼 · ③ 35%: 순간이동 + 가장 많이 맞은 원소에 면역
      const phases = bd.phases;
      const idx = e.boss.phase;
      if (idx < phases.length && e.hp / e.maxHp <= phases[idx].at) {
        const ph = phases[idx];
        e.boss.phase = idx + 1;
        if (ph.blink) { const fx = e.x; const fy = e.y; api.advance(e, ph.blink); api.ev('bossAbility', { enemyId: e.id, ability: 'blink', x: e.x, y: e.y, fromX: fx, fromY: fy }); }
        let immune = null;
        if (ph.adaptImmune && e.boss.els) {
          immune = Object.keys(e.boss.els).sort((a, b) => e.boss.els[b] - e.boss.els[a] || (a < b ? -1 : 1))[0] || null;
          if (immune) e.immuneEls = [immune];
        }
        if (ph.summon) summon(game, e, api, ph.summon);
        api.ev('bossPhase', { enemyId: e.id, phase: idx + 2, x: e.x, y: e.y, immune: immune ? [immune] : undefined });
      }
    },

    the_silence(game, e, api, bd) {
      const phases = bd.phases;
      const idx = e.boss.phase;
      if (idx < phases.length && e.hp / e.maxHp <= phases[idx].at) {
        const ph = phases[idx];
        e.boss.phase = idx + 1;
        e.immuneEls = ph.immune.slice();
        api.freezeLinks(ph.freezeLinks);
        summon(game, e, api, ph.summon);
        api.ev('bossPhase', { enemyId: e.id, phase: idx + 2, x: e.x, y: e.y, immune: ph.immune });
      }
    },
  };

  function update(game, e, api) {
    const bd = D().enemies[e.type].bossData;
    const fn = BOSSES[e.type];
    if (fn && bd) fn(game, e, api, bd);
  }

  return { update, resolveAlerts, BOSSES };
})();
