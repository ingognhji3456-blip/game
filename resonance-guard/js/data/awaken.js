'use strict';

/* =========================================================
 * 탑 각성 (Lv5) — 설계: docs/design/awaken.md · 규칙: js/core/awaken.js
 * 조각 강화 5단계를 채운 탑은 "각성": 판 안에서 Lv4(분기) 다음에 Lv5 각성 강화를 할 수 있음(도전 모드 제외).
 * 각성은 고른 분기를 그대로 두고, 공통 강화(공격 탑: 피해 ×1.3·사거리 ×1.08) + 탑마다 고유 능력.
 * patch(s, branch)는 분기 spec의 복사본 s를 고침 — 판(sim)이 읽는 필드만 씀:
 *   기존: onHit(burn·slow·freezeEvery·curse·spreadCurse·shred·stun·knockback·blind·purify·halt·veil·execute),
 *         multishot·shells·chain·pierce·splash·zone·rain·strike·smite·breath·beam·sweep·orbit·roller·blizzard·spikes·snare·harvest·chrono·aura·soldiers
 *   새로(각성용): echo(N번째 공격마다 한 번 더), onHit.awBurst({n, radius, pct}: N번 맞힐 때마다 주변 폭발)
 * ========================================================= */
RG.data.awaken = {
  costMult: 1.25,                     // 각성 비용 = 분기 비용 × 1.25 (10 단위)
  base: { damage: 1.3, range: 1.08 }, // 공격 탑 공통 강화
  towers: {
    /* ---------- 🔥 불 ---------- */
    ember_archer: {
      name: '불새 화살', desc: '세 번째 공격마다 한 번 더 쏩니다. 화상이 두 배로 강해집니다.',
      patch: (s) => { s.echo = 3; if (s.onHit && s.onHit.burn) s.onHit.burn.dps *= 2; },
    },
    flame_mortar: {
      name: '화산 포격', desc: '포탄을 한 발 더 쏘고, 불바다가 20% 넓고 1초 더 남습니다.',
      patch: (s) => { s.shells = (s.shells || 1) + 1; s.spread = s.spread || 0.8; s.zone.radius *= 1.2; s.zone.dur += 1; },
    },
    forge: {
      name: '전설의 대장장이', desc: '이웃 탑 피해 보너스가 1.5배가 되고, 이웃 탑 공격 속도도 15% 높입니다.',
      patch: (s) => { s.aura.damagePct *= 1.5; s.aura.speedPct = (s.aura.speedPct || 0) + 0.15; },
    },
    flame_jet: {
      name: '지옥불', desc: '사거리 +0.4, 화상 두 배. 네 번 맞힐 때마다 불꽃이 터져 주변(0.9칸)에 60% 피해.',
      patch: (s) => { s.range += 0.4; s.onHit.burn.dps *= 2; s.onHit.awBurst = { n: 4, radius: 0.9, pct: 0.6 }; },
    },
    phoenix_nest: {
      name: '불사조 군단', desc: '불사조가 한 마리 더 날고, 화상이 1.5배.',
      patch: (s) => { s.orbit.birds += 1; s.onHit.burn.dps *= 1.5; },
    },
    /* ---------- ❄ 얼음 ---------- */
    frost_crystal: {
      name: '절대 영도', desc: '두 번 맞힐 때마다 적을 1.2초 얼리고, 둔화가 15%p 강해집니다. 세 번 맞힐 때마다 얼음 파편이 튀어 주변(0.9칸)에 60% 피해.',
      patch: (s) => { s.onHit.freezeEvery = { n: 2, dur: 1.2 }; s.onHit.slow.pct = Math.min(0.8, s.onHit.slow.pct + 0.15); s.onHit.awBurst = { n: 3, radius: 0.9, pct: 0.6 }; },
    },
    ice_ballista: {
      name: '쌍빙창', desc: '두 번째 공격마다 창을 한 번 더 쏘고, 꿰뚫린 적은 세 번에 한 번 얼어붙습니다(0.8초).',
      patch: (s) => { s.echo = 2; s.onHit.freezeEvery = { n: 3, dur: 0.8 }; },
    },
    winter_bell: {
      name: '영겁의 종', desc: '둔화 70%, 세 번 울릴 때마다 적을 1.5초 얼리고, 종소리가 0.4칸 더 멀리 갑니다.',
      patch: (s) => { s.range += 0.4; s.onHit.slow.pct = 0.7; s.onHit.freezeEvery = { n: 3, dur: 1.5 }; },
    },
    icicle_cloud: {
      name: '빙하기', desc: '고드름이 더 많이 떨어지고(우박 +4·빙하 창 +1), 맞은 적의 갑옷을 깎습니다(10%, 최대 30%).',
      patch: (s) => { s.rain.count += s.rain.count > 1 ? 4 : 1; s.onHit.shred = { pct: 0.1, max: 0.3, dur: 4 }; },
    },
    blizzard_keep: {
      name: '만년 빙하', desc: '눈보라를 하나 더 부르고, 얼음이 깨질 때 피해가 1.5배.',
      patch: (s) => { s.blizzard.count += 1; s.blizzard.shatter *= 1.5; },
    },
    /* ---------- ⚡ 폭풍 ---------- */
    lightning_rod: {
      name: '천둥왕', desc: '연쇄 번개는 4번 더 튀고, 한 방 번개는 맞은 적 주변(1.2칸)에 50% 번개를 터뜨립니다. 맞은 적은 잠깐 기절.',
      patch: (s) => {
        if (s.chain) s.chain.count += 4; else { s.onHit = s.onHit || {}; s.onHit.awBurst = { n: 1, radius: 1.2, pct: 0.5 }; }
        s.onHit = s.onHit || {};
        s.onHit.stun = { chance: s.onHit.stun ? s.onHit.stun.chance : 0.3, dur: (s.onHit.stun ? s.onHit.stun.dur : 0.3) + 0.2 };
      },
    },
    gale_cannon: {
      name: '폭풍 대포', desc: '네 번째 공격마다 한 번 더 쏘고, 비행 적에게 주는 피해가 더 커집니다(+1배). 밀쳐 내기 1.5배.',
      patch: (s) => { s.echo = 4; s.onHit.flyingMult = (s.onHit.flyingMult || 1) + 1; if (s.onHit.knockback) s.onHit.knockback *= 1.5; if (s.cyclone) s.cyclone.every = Math.max(4, s.cyclone.every - 2); },
    },
    dynamo: {
      name: '뇌신 코일', desc: '이웃 탑 공격 속도 보너스가 1.5배, 이웃 탑이 세 번 공격할 때마다 번개(60)를 더합니다. 방전은 두 배.',
      patch: (s) => {
        s.aura.speedPct *= 1.5;
        s.aura.zapEvery = { n: 3, damage: s.aura.zapEvery ? s.aura.zapEvery.damage * 2.4 : 60 };
        if (s.discharge) s.discharge.damage *= 2;
      },
    },
    thunder_cloud: {
      name: '천둥 폭풍', desc: '번개가 더 떨어지고(천둥신 +1·폭풍 전선 +2), 기절 확률이 20%p 높아집니다.',
      patch: (s) => { s.strike.count += s.strike.count > 1 ? 2 : 1; s.onHit.stun.chance = Math.min(1, s.onHit.stun.chance + 0.2); },
    },
    storm_eye: {
      name: '대폭풍', desc: '회오리가 더 크고(반경 +20%) 2칸 더 멀리 휩쓸며, 휘말린 적을 더 세게 밀어냅니다.',
      patch: (s) => { s.roller.radius *= 1.2; s.roller.length += 2; s.roller.push *= 1.3; },
    },
    /* ---------- 🪨 대지 ---------- */
    stone_barracks: {
      name: '대지의 군대', desc: '병사가 한 명 더 나오고, 병사 체력·공격력이 1.5배, 다시 나오는 시간이 절반.',
      patch: (s) => { const so = s.soldiers; so.count += 1; so.hp *= 1.5; so.damage *= 1.5; so.respawn *= 0.5; },
    },
    quake_hammer: {
      name: '대지 붕괴', desc: '내려치는 범위 +0.6칸, 갑옷을 최대 50%까지 깎고, 가시 대지는 피해 두 배·지진 망치는 기절 0.8초.',
      patch: (s) => {
        s.range += 0.6; s.onHit.shred.max = 0.5; s.onHit.shred.pct = 0.15;
        if (s.onHit.stun) s.onHit.stun.dur = 0.8;
        if (s.zone) { s.zone.dps *= 2; s.zone.radius += 0.4; }
      },
    },
    crystal_mine: {
      name: '황금 광맥', desc: '수입이 1.6배. 깊은 광맥은 늘어나는 수입 한도가 두 배, 보석 세공소는 현상금 범위·보너스가 1.5배.',
      patch: (s) => { s.income = Math.round(s.income * 1.6); if (s.incomeGrowthMax) { s.incomeGrowthMax *= 2; s.incomeGrowth *= 1.5; } if (s.bountyAura) { s.bountyAura.radius *= 1.5; s.bountyAura.pct *= 1.5; } },
    },
    thorn_garden: {
      name: '가시 숲', desc: '가시 덤불을 두 개 더 깔 수 있고, 덤불 피해가 1.5배, 덤불이 더 넓습니다.',
      patch: (s) => { s.spikes.max += 2; s.spikes.dps *= 1.5; s.spikes.radius += 0.15; },
    },
    titan_boulder: {
      name: '거신의 분노', desc: '바위를 더 굴리고(산사태 +2·철구 +1), 깔린 적은 0.3초 더 기절합니다.',
      patch: (s) => { s.roller.count += s.roller.count > 1 ? 2 : 1; s.roller.stun += 0.3; },
    },
    /* ---------- ✨ 빛 ---------- */
    sun_lens: {
      name: '태양의 창', desc: '오래 비출수록 커지는 피해가 더 커집니다(집광기는 최대 배율 1.6배, 프리즘은 빛줄기 +1·최대 배율 1.3배).',
      patch: (s) => { if (s.beam.beams > 1) { s.beam.beams += 1; s.beam.maxMult *= 1.3; } else s.beam.maxMult *= 1.6; },
    },
    sanctuary: {
      name: '빛의 성역', desc: '치유가 두 배, 치유 범위 +1칸, 이웃 탑 사거리 보너스 +10%p, 쓰러진 병사가 빨리 다시 나옵니다.',
      patch: (s) => { s.heal.hps *= 2; s.heal.radius += 1; s.aura.rangePct += 0.1; s.respawnMul = Math.min(s.respawnMul || 1, 0.4); s.detect = (s.detect || 3) + 1; },
    },
    radiance_spire: {
      name: '새벽빛', desc: '세 번째 공격마다 한 번 더 빛을 터뜨리고, 실명 +1.5초, 맞은 적의 보호막을 벗깁니다.',
      patch: (s) => { s.echo = 3; s.onHit.blind += 1.5; s.onHit.purify = Math.max(s.onHit.purify || 0, 3); },
    },
    lighthouse: {
      name: '등대의 눈', desc: '빛줄기가 하나 더 돌고, 비춘 적은 3초 동안 모든 피해를 25% 더 받습니다.',
      patch: (s) => { s.sweep.beams += 1; s.sweep.mark = { pct: Math.max(0.25, s.sweep.mark ? s.sweep.mark.pct : 0), dur: 3 }; },
    },
    judgment_spire: {
      name: '최후의 심판', desc: '심판이 하나 더 내리고, 현재 체력에 비례한 피해가 1.5배.',
      patch: (s) => { s.smite.count += 1; s.smite.pct *= 1.5; s.smite.bossPct *= 1.5; },
    },
    chrono_spire: {
      name: '영원의 시계', desc: '시간을 멈추는 주기가 2번 짧아지고 1초 더 멈춥니다. 세 번째 공격마다 시간을 겹쳐 한 번 더 쏩니다.',
      patch: (s) => { s.chrono.every = Math.max(3, s.chrono.every - 2); s.chrono.stop += 1; s.echo = 3; },
    },
    /* ---------- 🌑 어둠 ---------- */
    hex_spire: {
      name: '파멸의 저주', desc: '저주가 15%p 강해지고, 체력 18% 아래의 적을 처형하며, 저주가 주변으로 번집니다. 세 번째 공격마다 한 번 더 쏩니다.',
      patch: (s) => { s.echo = 3; s.onHit.curse.pct += 0.15; s.onHit.execute = Math.max(s.onHit.execute || 0, 0.18); s.onHit.spreadCurse = s.onHit.spreadCurse || { radius: 1.3, damage: 30 }; s.onHit.spreadCurse.damage *= 1.5; },
    },
    void_orb: {
      name: '사건의 지평선', desc: '공허 구역이 15% 넓고 0.5초 더 남으며, 안에 갇힌 적은 더 느려집니다.',
      patch: (s) => { s.zone.radius *= 1.15; s.zone.dur += 0.5; s.zone.slowPct = Math.min(0.8, s.zone.slowPct + 0.08); },
    },
    shadow_snare: {
      name: '그림자 감옥', desc: '덫을 두 개 더 깔 수 있고, 1초 더 묶으며, 덫 피해가 1.5배.',
      patch: (s) => { s.snare.maxTraps += 2; s.snare.root += 1; s.snare.damage *= 1.5; },
    },
    dread_bell: {
      name: '공포의 군주', desc: '공포가 1초 더 이어지고, 종소리를 들은 적은 받는 피해가 20% 늘어납니다(저주).',
      patch: (s) => { s.fear.dur += 1; s.onHit = s.onHit || {}; s.onHit.curse = { pct: Math.max(0.2, s.onHit.curse ? s.onHit.curse.pct + 0.08 : 0), dur: 4 }; },
    },
    soul_reaper: {
      name: '명계의 문', desc: '모을 수 있는 영혼 +10, 영혼 폭풍 피해 1.5배·범위 +0.5칸. 다섯 번 맞힐 때마다 영혼이 터져 주변(1.1칸)에 70% 피해.',
      patch: (s) => { s.harvest.max += 10; s.harvest.storm *= 1.5; s.harvest.radius += 0.5; s.onHit = s.onHit || {}; s.onHit.awBurst = { n: 5, radius: 1.1, pct: 0.7 }; },
    },
    shadow_dragon: {
      name: '멸망의 흑룡', desc: '숨결이 한 줄기 더, 숨결이 더 굵어지고(+0.2칸), 저주가 10%p 강해집니다.',
      patch: (s) => { s.breath.count += 1; s.breath.width += 0.2; s.onHit.curse.pct += 0.1; },
    },
  },
};
