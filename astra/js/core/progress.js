'use strict';

/* =========================================================
 * 성장 — 레벨·경험치, 능력치 계산, 스킬/무기/모듈, 보상, 랭크
 * (DOM 없음)
 * ========================================================= */
window.AZ = window.AZ || {};

AZ.progress = (() => {
  const MAX_LEVEL = 30;

  /* ── 챕터별 기준값 (밸런스의 뼈대) ── */
  const refLevel = (c) => 1 + 2.4 * (c - 1);
  const refHp = (c) => 500 + 40 * refLevel(c);
  const refAtk = (c) => (40 + 4 * refLevel(c)) * (1 + 0.08 * (c - 1));
  /** 보스 공격 1단위 피해 = 기준 체력의 10% */
  const refDmg = (c) => refHp(c) * 0.1;
  /** 평균적인 플레이어가 보스를 잡는 데 걸리는 시간(초) */
  const refTime = (c) => 70 + 7 * c;
  const bossHp = (c, mul) => Math.round(5.0 * refAtk(c) * refTime(c) * (mul || 1) / 10) * 10;
  const parTime = (c) => Math.round(refTime(c) * 0.8);

  const expToNext = (lv) => 100 + 60 * lv;

  function addExp(save, amount) {
    const before = save.level;
    save.exp += Math.round(amount);
    while (save.level < MAX_LEVEL && save.exp >= expToNext(save.level)) {
      save.exp -= expToNext(save.level);
      save.level += 1;
      save.sp += 1;
    }
    if (save.level >= MAX_LEVEL) save.exp = 0;
    return save.level - before;
  }

  /** 전투에 쓰는 최종 능력치 */
  function computeStats(save) {
    const D = AZ.data;
    const lv = save.level;
    const learned = new Set(save.learned);
    const wid = save.weapon in D.weapons ? save.weapon : 'blade';
    const wdef = D.weapons[wid];
    const wlv = save.weapons[wid] || 1;

    const s = {
      level: lv,
      baseHp: 500 + 40 * lv,
      baseAtk: 40 + 4 * lv,
      hpPct: 0, atkPct: 0,
      crit: wdef.crit, critDmg: 0.5,
      dmgReduce: 0, breakMul: 0, weakMul: 0,
      perfectMul: 0, iframe: 0, zeroDur: 0, cdMul: 0, focusMul: 0,
      lifesteal: 0, allyMul: 0, allyHp: 0, ultMul: 0, comboAmp: 0,
      afterimage: 0, startFocus: 0,
    };
    for (const mid of save.equippedModules) {
      const m = mid && D.modules[mid];
      if (!m) continue;
      for (const [k, v] of Object.entries(m.stats)) s[k] = (s[k] || 0) + v;
    }
    if (learned.has('atkUp')) s.atkPct += 0.12;
    if (learned.has('critUp')) { s.crit += 0.12; s.critDmg += 0.2; }
    if (learned.has('hpUp')) s.hpPct += 0.2;
    if (learned.has('ironWill')) s.dmgReduce += 0.12;
    if (learned.has('perfectUp')) s.perfectMul += 0.5;
    if (learned.has('zeroSync')) s.zeroDur += 1;
    if (learned.has('cdr')) s.cdMul += 0.15;

    const weaponMul = wdef.atk * (1 + D.weaponLevelBonus * (wlv - 1));
    return {
      level: lv,
      maxHp: Math.round(s.baseHp * (1 + s.hpPct)),
      atk: s.baseAtk * (1 + s.atkPct) * weaponMul,
      crit: Math.min(0.75, s.crit),
      critDmg: 1 + s.critDmg,
      dmgReduce: Math.min(0.6, s.dmgReduce),
      breakMul: 1 + s.breakMul,
      weakMul: 1.3 + s.weakMul,
      perfectWindow: 0.17 * (1 + s.perfectMul),
      iframe: 0.3 + s.iframe,
      zeroDur: 3 + s.zeroDur,
      cdMul: Math.max(0.5, 1 - s.cdMul),
      focusMul: 1 + s.focusMul,
      lifesteal: s.lifesteal,
      allyMul: 1 + s.allyMul,
      allyHp: 1 + s.allyHp,
      ultMul: 1 + s.ultMul,
      comboAmp: s.comboAmp,
      comboMaster: learned.has('comboMaster'),
      lastStand: learned.has('lastStand'),
      afterimage: s.afterimage > 0,
      startFocus: s.startFocus,
      weaponId: wid,
      weapon: wdef,
      weaponLevel: wlv,
      skills: save.equippedSkills.map((id) => (id && learned.has(id) ? id : null)),
    };
  }

  /* ── 스킬 트리 ── */
  function nodeInfo(id) {
    const S = AZ.data.skills;
    for (const br of S.branches) {
      const idx = br.nodes.indexOf(id);
      if (idx >= 0) return { branch: br, index: idx, cost: S.tierCost[idx], prev: idx > 0 ? br.nodes[idx - 1] : null };
    }
    return null;
  }
  function canLearn(save, id) {
    const info = nodeInfo(id);
    if (!info) return { ok: false, why: '없는 스킬' };
    if (save.learned.includes(id)) return { ok: false, why: '이미 배움' };
    if (info.prev && !save.learned.includes(info.prev)) return { ok: false, why: '앞 단계를 먼저 배워야 합니다' };
    if (save.sp < info.cost) return { ok: false, why: `SP 가 ${info.cost} 필요합니다` };
    return { ok: true, cost: info.cost };
  }
  function learn(save, id) {
    const c = canLearn(save, id);
    if (!c.ok) return c;
    save.sp -= c.cost;
    save.learned.push(id);
    // 빈 슬롯이 있으면 자동 장착
    const node = AZ.data.skills.nodes[id];
    if (node.type === 'active' && !save.equippedSkills.includes(id)) {
      const empty = save.equippedSkills.indexOf(null);
      if (empty >= 0) save.equippedSkills[empty] = id;
    }
    return { ok: true };
  }
  function equipSkill(save, slot, id) {
    if (slot < 0 || slot > 2) return false;
    if (id !== null) {
      const node = AZ.data.skills.nodes[id];
      if (!node || node.type !== 'active' || !save.learned.includes(id)) return false;
      const other = save.equippedSkills.indexOf(id);
      if (other >= 0) save.equippedSkills[other] = save.equippedSkills[slot];
    }
    save.equippedSkills[slot] = id;
    return true;
  }

  /* ── 무기 / 모듈 ── */
  function upgradeCost(save, wid) {
    const lv = save.weapons[wid] || 0;
    if (!lv || lv >= AZ.data.weaponMaxLevel) return null;
    return AZ.data.weaponUpgradeCost[lv];
  }
  function upgradeWeapon(save, wid) {
    const cost = upgradeCost(save, wid);
    if (cost == null || save.credits < cost) return false;
    save.credits -= cost;
    save.weapons[wid] += 1;
    return true;
  }
  function equipWeapon(save, wid) {
    if (!save.weapons[wid]) return false;
    save.weapon = wid;
    return true;
  }
  function equipModule(save, slot, mid) {
    if (slot < 0 || slot > 2) return false;
    if (mid !== null) {
      if (!save.modules.includes(mid)) return false;
      const other = save.equippedModules.indexOf(mid);
      if (other >= 0) save.equippedModules[other] = save.equippedModules[slot];
    }
    save.equippedModules[slot] = mid;
    return true;
  }

  /* ── 파티 구성 ── */
  function partyFor(save, chapterId) {
    const f = save.flags || {};
    const liaAway = chapterId >= 8 && chapterId <= 9 && f.liaTrusted === false;
    return { lia: !liaAway, zero: chapterId >= 8 && f.zeroSpared === true };
  }

  /* ── 랭크 ── */
  function rankScore(result, chapterId) {
    const par = parTime(chapterId);
    let score = 100;
    score -= Math.max(0, (result.time - par) / par) * 60;
    score -= (result.damageTaken / Math.max(1, result.maxHp)) * 22;
    score += Math.min(15, result.zeroFrames * 2 + result.breaks * 3);
    return Math.round(Math.max(0, Math.min(120, score)));
  }
  function rankFromScore(score) {
    if (score >= 90) return 'S';
    if (score >= 75) return 'A';
    if (score >= 55) return 'B';
    if (score >= 35) return 'C';
    return 'D';
  }

  function checkChallenge(ch, result) {
    const c = ch.challenge;
    if (!c) return false;
    const v = c.stat === 'rankScore' ? result.score : result[c.stat] || 0;
    if (c.op === '>=') return v >= c.value;
    if (c.op === '<=') return v <= c.value;
    return false;
  }

  /** 보스 기록 저장 → { rank, score, newBest, place } */
  function recordBoss(save, bossId, chapterId, result) {
    const score = rankScore(result, chapterId);
    const rank = rankFromScore(score);
    const cx = save.codex[bossId] || (save.codex[bossId] = { seen: true, defeated: false, clears: 0, best: null });
    cx.seen = true;
    cx.defeated = true;
    cx.clears += 1;
    const newBest = cx.best == null || result.time < cx.best;
    if (newBest) cx.best = result.time;
    const list = save.records[bossId] || (save.records[bossId] = []);
    const entry = { time: Math.round(result.time * 100) / 100, rank, score, diff: save.difficulty, date: Date.now() };
    list.push(entry);
    list.sort((a, b) => a.time - b.time);
    if (list.length > 5) list.length = 5;
    const place = list.indexOf(entry) + 1;
    return { rank, score, newBest, place: place || null };
  }

  /** 챕터 첫 클리어 보상 지급 → 화면에 보여 줄 문자열 목록 */
  function grantChapterRewards(save, chapterId) {
    const D = AZ.data;
    const ch = D.chapters[chapterId - 1];
    const out = [];
    const first = !save.cleared[chapterId];
    save.cleared[chapterId] = true;
    save.unlockedChapter = Math.max(save.unlockedChapter, Math.min(10, chapterId + 1));
    if (!first) return out;
    save.sp += 1;
    out.push('스킬 포인트 +1 (첫 클리어)');
    const r = ch.reward || {};
    if (r.weapon && !save.weapons[r.weapon]) {
      save.weapons[r.weapon] = 1;
      out.push(`새 무기: ${D.weapons[r.weapon].name}`);
    }
    const mods = (r.modules || []).slice();
    if (r.choiceModule) {
      const flag = save.flags[r.choiceModule.flag];
      let pick = flag ? r.choiceModule.yes : r.choiceModule.no;
      if (save.modules.includes(pick)) pick = flag ? r.choiceModule.no : r.choiceModule.yes;
      mods.push(pick);
    }
    for (const m of mods) {
      if (m && !save.modules.includes(m)) {
        save.modules.push(m);
        const empty = save.equippedModules.indexOf(null);
        if (empty >= 0) save.equippedModules[empty] = m;
        out.push(`전술 모듈: ${D.modules[m].name}`);
      }
    }
    return out;
  }

  function addMemory(save, id) {
    if (!id || save.memories.includes(id)) return false;
    save.memories.push(id);
    return true;
  }

  /** 챕터 경험치/크레딧 (보스) */
  const bossExp = (c) => 400 + 180 * c;
  const bossCredits = (c) => 300 + 120 * c;

  return {
    MAX_LEVEL, refLevel, refHp, refAtk, refDmg, refTime, bossHp, parTime, expToNext, addExp,
    computeStats, nodeInfo, canLearn, learn, equipSkill, upgradeCost, upgradeWeapon, equipWeapon,
    equipModule, partyFor, rankScore, rankFromScore, checkChallenge, recordBoss, grantChapterRewards,
    addMemory, bossExp, bossCredits,
  };
})();
