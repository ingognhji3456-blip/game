'use strict';

/* =========================================================
 * 적 & 조우 데이터
 * 적의 효과에서 target 'enemy' = 플레이어, 'self' = 자기 자신.
 * ========================================================= */
(() => {
  const dmg = (value, extra = {}) => ({ type: 'damage', value, ...extra });
  const blk = (value, target = 'self') => ({ type: 'block', value, target });
  const buff = (status, value, target = 'self') => ({ type: 'applyStatus', status, value, target });
  const debuff = (status, value) => ({ type: 'applyStatus', status, value, target: 'enemy' });
  const add = (card, count, to = 'discardPile') => ({ type: 'addCard', card, count, to });

  const enemies = {
    /* ================= 1막: 숲 ================= */
    slime: {
      name: '숲 슬라임', act: 1, rank: 'normal', hp: [14, 18], size: 'small',
      moves: {
        tackle: { name: '몸통 박치기', effects: [dmg(6)] },
        spit: { name: '산성 침', effects: [dmg(3), debuff('weak', 1)] },
        harden: { name: '굳히기', effects: [blk(5), dmg(3)] },
      },
      pattern: { type: 'random', weights: { tackle: 45, spit: 30, harden: 25 }, maxRepeat: 2 },
    },
    sporeling: {
      name: '포자 버섯', act: 1, rank: 'normal', hp: [12, 15], size: 'small',
      moves: {
        spores: { name: '포자 뿌리기', effects: [debuff('poison', 3)] },
        headbutt: { name: '박치기', effects: [dmg(5)] },
        swell: { name: '부풀기', effects: [buff('strength', 1), blk(3)] },
      },
      pattern: { type: 'cycle', order: ['headbutt', 'swell', 'spores'], opening: ['spores'] },
    },
    wolf: {
      name: '회색 늑대', act: 1, rank: 'normal', hp: [30, 34], size: 'medium',
      moves: {
        bite: { name: '물어뜯기', effects: [dmg(9)] },
        howl: { name: '울부짖기', effects: [buff('strength', 2), blk(4)] },
        rend: { name: '할퀴기', effects: [dmg(4, { times: 2 })] },
      },
      pattern: { type: 'random', weights: { bite: 40, howl: 20, rend: 40 }, maxRepeat: 1, opening: ['bite'] },
    },
    bandit: {
      name: '숲 도적', act: 1, rank: 'normal', hp: [32, 36], size: 'medium',
      moves: {
        stab: { name: '찌르기', effects: [dmg(8)] },
        smoke: { name: '연막', effects: [blk(8), debuff('weak', 1)] },
        flurry: { name: '난도질', effects: [dmg(3, { times: 3 })] },
      },
      pattern: { type: 'cycle', order: ['stab', 'flurry', 'smoke'] },
    },
    beetle: {
      name: '가시 딱정벌레', act: 1, rank: 'normal', hp: [22, 26], size: 'small',
      passives: [{ status: 'thorns', value: 2 }],
      moves: {
        charge: { name: '돌진', effects: [dmg(8)] },
        curl: { name: '몸 말기', effects: [blk(9)] },
        pinch: { name: '집게', effects: [dmg(5), debuff('frail', 1)] },
      },
      pattern: { type: 'cycle', order: ['charge', 'curl', 'pinch'] },
    },
    ogre: {
      name: '늪지 오우거', act: 1, rank: 'elite', hp: [74, 80], size: 'large',
      moves: {
        swing: { name: '곤봉 휘두르기', effects: [dmg(6, { times: 2 })] },
        grab: { name: '움켜쥐기', effects: [dmg(9), debuff('frail', 2)] },
        smash: { name: '대지 내려치기', effects: [dmg(17)] },
        roar: { name: '포효', effects: [buff('strength', 2), blk(6)] },
      },
      pattern: { type: 'cycle', order: ['swing', 'grab', 'smash', 'roar'] },
    },
    treant: {
      name: '고목 수호자', act: 1, rank: 'elite', hp: [64, 70], size: 'large',
      passives: [{ status: 'plating', value: 2 }],
      moves: {
        lash: { name: '뿌리 채찍', effects: [dmg(11)] },
        entangle: { name: '휘감기', effects: [dmg(4), debuff('weak', 2), debuff('frail', 2)] },
        bark: { name: '나무껍질 갑옷', effects: [blk(10), buff('regen', 3)] },
        quake: { name: '뿌리 지진', effects: [dmg(5, { times: 3 })] },
      },
      pattern: { type: 'cycle', order: ['entangle', 'lash', 'quake', 'bark'] },
    },
    golem: {
      name: '고대 골렘', act: 1, rank: 'boss', hp: [112, 112], size: 'large',
      moves: {
        stomp: { name: '진동 밟기', effects: [dmg(6, { times: 2 }), debuff('frail', 1)] },
        charge: { name: '마력 충전', effects: [blk(12), buff('strength', 2)] },
        smash: { name: '대지 분쇄', effects: [dmg(20)] },
        pebble: { name: '돌팔매', effects: [dmg(8), add('dazed', 1)] },
      },
      pattern: { type: 'cycle', order: ['stomp', 'charge', 'smash', 'pebble'] },
      phase2: {
        hpPct: 0.5, text: '골렘의 핵이 붉게 폭주한다!',
        onEnter: [buff('strength', 1), blk(10)],
        pattern: { type: 'cycle', order: ['quake', 'smash', 'pebble'] },
      },
    },

    /* ================= 2막: 폐허 ================= */
    skeleton: {
      name: '해골 병사', act: 2, rank: 'normal', hp: [34, 40], size: 'medium',
      moves: {
        slash: { name: '녹슨 칼날', effects: [dmg(11)] },
        shieldUp: { name: '방패 들기', effects: [blk(10), dmg(4)] },
        rattle: { name: '뼈 덜그럭', effects: [debuff('vulnerable', 2), dmg(5)] },
      },
      pattern: { type: 'random', weights: { slash: 45, shieldUp: 30, rattle: 25 }, maxRepeat: 2 },
    },
    wraith: {
      name: '원혼', act: 2, rank: 'normal', hp: [34, 38], size: 'medium',
      passives: [{ status: 'ward', value: 1 }],
      moves: {
        wail: { name: '통곡', effects: [debuff('weak', 2), debuff('frail', 2)] },
        drain: { name: '영혼 흡수', effects: [dmg(10, { lifesteal: true })] },
        chill: { name: '냉기의 손길', effects: [dmg(6, { times: 2 })] },
      },
      pattern: { type: 'cycle', order: ['wail', 'drain', 'chill'] },
    },
    zealot: {
      name: '어둠 신도', act: 2, rank: 'normal', hp: [46, 52], size: 'medium',
      moves: {
        prayer: { name: '검은 기도', effects: [blk(8, 'allAllies'), buff('strength', 1, 'allAllies')] },
        hex: { name: '저주 새기기', effects: [add('wound', 2)] },
        dagger: { name: '제물 단검', effects: [dmg(12)] },
      },
      pattern: { type: 'random', weights: { prayer: 30, hex: 25, dagger: 45 }, maxRepeat: 1, opening: ['hex'] },
    },
    gargoyle: {
      name: '석상 괴물', act: 2, rank: 'normal', hp: [44, 50], size: 'medium',
      passives: [{ status: 'plating', value: 3 }],
      moves: {
        dive: { name: '급강하', effects: [dmg(13)] },
        petrify: { name: '석화', effects: [blk(14)] },
        screech: { name: '날카로운 비명', effects: [debuff('vulnerable', 2), debuff('weak', 1)] },
      },
      pattern: { type: 'cycle', order: ['screech', 'dive', 'petrify', 'dive'] },
    },
    bat: {
      name: '흡혈 박쥐', act: 2, rank: 'normal', hp: [20, 24], size: 'small',
      moves: {
        bite: { name: '흡혈', effects: [dmg(5, { times: 2, lifesteal: true })] },
        screech: { name: '초음파', effects: [debuff('weak', 1), dmg(4)] },
      },
      pattern: { type: 'random', weights: { bite: 65, screech: 35 }, maxRepeat: 2 },
    },
    fallenKnight: {
      name: '몰락한 기사', act: 2, rank: 'elite', hp: [118, 126], size: 'large',
      passives: [{ status: 'ward', value: 2 }],
      moves: {
        cleave: { name: '대검 일섬', effects: [dmg(22)] },
        bash: { name: '방패 강타', effects: [dmg(10), blk(12)] },
        oath: { name: '타락한 맹세', effects: [buff('strength', 3), buff('ward', 1)] },
        combo: { name: '연속 베기', effects: [dmg(7, { times: 3 })] },
      },
      pattern: { type: 'cycle', order: ['bash', 'cleave', 'oath', 'combo'] },
    },
    bogWitch: {
      name: '늪 마녀', act: 2, rank: 'elite', hp: [100, 108], size: 'medium',
      moves: {
        hex: { name: '저주의 눈빛', effects: [debuff('weak', 2), debuff('vulnerable', 2)] },
        brew: { name: '독약 끓이기', effects: [debuff('poison', 7), blk(8)] },
        bolt: { name: '저주 화살', effects: [dmg(15)] },
        cackle: { name: '광기의 웃음', effects: [{ type: 'heal', value: 14 }, add('wound', 1)] },
      },
      pattern: { type: 'cycle', order: ['hex', 'bolt', 'brew', 'bolt', 'cackle'] },
    },
    lichKing: {
      name: '리치 왕', act: 2, rank: 'boss', hp: [180, 180], size: 'large',
      moves: {
        raise: { name: '망자 소생', effects: [{ type: 'summon', enemy: 'skeleton', count: 1 }, blk(10)] },
        soulRend: { name: '영혼 찢기', effects: [dmg(8, { times: 2 })] },
        frost: { name: '죽음의 서리', effects: [dmg(15), debuff('frail', 2)] },
        boneWard: { name: '뼈의 장벽', effects: [blk(14), buff('strength', 1)] },
      },
      pattern: { type: 'cycle', order: ['raise', 'soulRend', 'frost', 'boneWard'] },
      phase2: {
        hpPct: 0.5, text: '리치 왕이 불사의 의식을 시작한다!',
        onEnter: [buff('strength', 2), buff('ward', 2)],
        pattern: { type: 'cycle', order: ['doom', 'raise', 'soulRend', 'frost'] },
      },
    },

    /* ================= 3막: 심연 ================= */
    imp: {
      name: '화염 임프', act: 3, rank: 'normal', hp: [34, 38], size: 'small',
      moves: {
        fireball: { name: '화염구', effects: [dmg(11)] },
        ember: { name: '불씨 뿌리기', effects: [dmg(5), add('burn', 1)] },
        cackle: { name: '킬킬대기', effects: [buff('strength', 2), blk(5)] },
      },
      pattern: { type: 'random', weights: { fireball: 40, ember: 35, cackle: 25 }, maxRepeat: 1 },
    },
    salamander: {
      name: '용암 도롱뇽', act: 3, rank: 'normal', hp: [62, 68], size: 'medium',
      passives: [{ status: 'thorns', value: 3 }],
      moves: {
        bite: { name: '용암 물기', effects: [dmg(15)] },
        magma: { name: '마그마 피부', effects: [blk(12), buff('thorns', 1)] },
        tail: { name: '꼬리 후려치기', effects: [dmg(8, { times: 2 })] },
      },
      pattern: { type: 'cycle', order: ['bite', 'tail', 'magma'] },
    },
    shade: {
      name: '그림자', act: 3, rank: 'normal', hp: [52, 58], size: 'medium',
      passives: [{ status: 'ward', value: 2 }],
      moves: {
        claw: { name: '그림자 발톱', effects: [dmg(7, { times: 3 })] },
        fade: { name: '어둠 속으로', effects: [blk(16)] },
        dread: { name: '공포', effects: [debuff('weak', 2), debuff('vulnerable', 2), dmg(6)] },
      },
      pattern: { type: 'random', weights: { claw: 45, fade: 25, dread: 30 }, maxRepeat: 1, opening: ['dread'] },
    },
    sentinel: {
      name: '흑요석 파수꾼', act: 3, rank: 'normal', hp: [76, 82], size: 'large',
      passives: [{ status: 'plating', value: 4 }],
      moves: {
        charge: { name: '광선 충전', effects: [blk(10), buff('strength', 2)] },
        beam: { name: '파쇄 광선', effects: [dmg(20)] },
        pulse: { name: '흑요석 파동', effects: [dmg(8), add('dazed', 2)] },
      },
      pattern: { type: 'cycle', order: ['pulse', 'charge', 'beam'] },
    },
    abyssDemon: {
      name: '심연 악마', act: 3, rank: 'elite', hp: [165, 175], size: 'large',
      passives: [{ status: 'enrage', value: 1 }],
      moves: {
        hellfire: { name: '지옥불', effects: [dmg(8, { times: 3 }), add('burn', 1)] },
        devour: { name: '집어삼키기', effects: [dmg(20, { lifesteal: true })] },
        pact: { name: '어둠의 계약', effects: [buff('fervor', 2), blk(15)] },
        terror: { name: '공포의 군림', effects: [debuff('weak', 3), debuff('vulnerable', 3)] },
      },
      pattern: { type: 'cycle', order: ['terror', 'hellfire', 'pact', 'devour'] },
    },
    elderDragon: {
      name: '태고의 용', act: 3, rank: 'boss', hp: [320, 320], size: 'large',
      moves: {
        breath: { name: '화염 숨결', effects: [dmg(14), add('burn', 2)] },
        claw: { name: '용의 발톱', effects: [dmg(12, { times: 2 })] },
        gust: { name: '날개 돌풍', effects: [blk(22), debuff('weak', 2), debuff('vulnerable', 2)] },
        roar: { name: '태고의 포효', effects: [buff('strength', 3), debuff('frail', 2)] },
      },
      pattern: { type: 'cycle', order: ['roar', 'breath', 'claw', 'gust'] },
      phase2: {
        hpPct: 0.5, text: '태고의 용이 분노로 불타오른다!',
        onEnter: [buff('fervor', 2), { type: 'removeDebuffs' }],
        pattern: { type: 'cycle', order: ['inferno', 'claw', 'breath', 'gust'] },
      },
    },
  };

  // 2막 이후 사용 기술 (phase2 전용)
  enemies.golem.moves.quake = { name: '붕괴의 진동', effects: [dmg(6, { times: 3 })] };
  enemies.lichKing.moves.doom = { name: '파멸의 선고', effects: [dmg(26)] };
  enemies.elderDragon.moves.inferno = { name: '종말의 업화', effects: [dmg(34), add('burn', 2)] };

  for (const [id, enemy] of Object.entries(enemies)) {
    enemy.id = id;
    enemy.art = id;
  }
  CB.data.enemies = enemies;

  CB.data.encounters = {
    1: {
      easy: [['slime'], ['wolf'], ['beetle'], ['sporeling', 'sporeling']],
      normal: [
        ['slime', 'slime'], ['bandit'], ['wolf', 'sporeling'], ['beetle', 'slime'],
        ['bandit', 'sporeling'], ['slime', 'sporeling', 'slime'], ['wolf', 'beetle'],
      ],
      elite: [['ogre'], ['treant']],
      boss: [['golem']],
    },
    2: {
      easy: [['skeleton'], ['bat', 'bat'], ['wraith']],
      normal: [
        ['skeleton', 'bat'], ['zealot', 'skeleton'], ['gargoyle'], ['wraith', 'bat'],
        ['zealot', 'wraith'], ['bat', 'bat', 'bat'], ['gargoyle', 'bat'],
      ],
      elite: [['fallenKnight'], ['bogWitch', 'bat']],
      boss: [['lichKing']],
    },
    3: {
      easy: [['imp', 'imp'], ['shade'], ['salamander']],
      normal: [
        ['sentinel'], ['imp', 'salamander'], ['shade', 'imp'], ['salamander', 'shade'],
        ['imp', 'imp', 'imp'], ['sentinel', 'imp'],
      ],
      elite: [['abyssDemon'], ['sentinel', 'sentinel']],
      boss: [['elderDragon']],
    },
  };
})();
