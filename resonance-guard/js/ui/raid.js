'use strict';

/* =========================================================
 * 조각 레이드 화면 — 설계: docs/design/raid.md · 규칙: js/core/raid.js · 데이터: js/data/raid.js
 * 왼쪽: 내 탑(조각 강화 단계·모은 조각·깬 난이도) / 오른쪽: 고른 탑의 조각 강화, 난이도 1~5, 영웅, 레이드 시작
 * 레이드 판에서는 고른 탑만 지을 수 있음(영웅은 함께). 이기면 그 탑의 조각, 조각으로 그 탑을 강화(캠페인·무한·레이드, 도전 제외).
 * 결과 화면(RG.ui.raidResult)도 여기서: 얻은 조각, 다음 강화까지, 다시·다음 난이도·레이드로
 * ========================================================= */
(() => {
  const { el, escapeHtml: esc, withJosa: wj } = RG.util;
  const UI = RG.ui;
  const D = () => RG.data;
  const P = () => RG.progress;
  const RD = () => RG.data.raid;

  let pickTower = null;
  let pickDiff = {};   // 탑마다 마지막으로 고른 난이도
  let pickHero = null;

  const ROLE = { attack: '공격', support: '지원', barracks: '병영', economy: '경제' };

  /** 조각 강화 단계의 효과 글 (그 탑 역할에 맞는 것만) */
  function effectText(type, lv) {
    if (lv <= 0) return '효과 없음';
    const b = RG.raid.shardBonus(lv);
    const role = D().towers[type].role;
    const pct = Math.round(b.pct * 100);
    const out = [role === 'support' ? `지원 효과 +${pct}%` : role === 'economy' ? `수입 +${pct}%` : role === 'barracks' ? `병사 체력·공격력 +${pct}%` : `공격력 +${pct}%`];
    if (role === 'attack' && b.rangePct) out.push(`사거리 +${Math.round(b.rangePct * 100)}%`);
    if (role === 'attack' && b.speedPct) out.push(`공격 속도 +${Math.round(b.speedPct * 100)}%`);
    if (RG.raid.isSupport(type)) out.push(`레이드 영웅 강화 +${pct}%`);
    if (lv >= RD().shard.buildAt) out.push('한 단계 높게 설치 (값은 그대로)');
    return out.join(' · ');
  }
  RG.ui.shardEffectText = effectText;

  /** 지을 때 단계 (sim.js startLevel과 같음): 뽑기 최종 강화 +1, 조각 마지막 단계 +1, Lv3까지 */
  const buildLv = (t) => Math.min(3, 1 + (RG.gacha.isFinal(P().towerRank(t)) ? 1 : 0) + (P().shardLvOf(t) >= RD().shard.buildAt ? 1 : 0));

  /** 조각 단계 배지 ◆n (0이면 없음) */
  function lvBadge(lv, cls = '') { return lv > 0 ? el('em', { class: `shard-lv ${cls}`, title: `조각 강화 ${lv}단계`, text: `◆${lv}` }) : null; }
  RG.ui.shardBadge = lvBadge;

  /** 다음 단계까지 막대 */
  function progressBar(type) {
    const lv = P().shardLvOf(type);
    const cost = RG.raid.shardCost(lv);
    const have = P().shardsOf(type);
    if (cost == null) return el('span', { class: 'rd-bar max' }, [el('i', { style: 'width:100%' }), el('b', { text: '최대' })]);
    return el('span', { class: `rd-bar ${have >= cost ? 'ready' : ''}`, title: `조각 ${have}/${cost}` }, [el('i', { style: `width:${Math.min(100, (have / cost) * 100)}%` }), el('b', { text: `${have}/${cost}` })]);
  }

  /** 웨이브에 나오는 적 (보기용) */
  function enemiesOf(type, d, heroId) {
    const set = [];
    for (const w of RG.grid.parseWaves(RG.raid.waves(type, d, heroId))) for (const g of w.groups) if (!set.includes(g.e)) set.push(g.e);
    return set;
  }

  /** 레이드 시작 opts (캠페인과 같은 성장: 기술 나무·뽑기 강화·조각 강화·영웅 성장) */
  function raidOpts(type, d, heroId) {
    const opts = Object.assign({
      mode: 'normal', heroId, skills: P().get().skills.slice(), seed: (Math.random() * 1e9) >>> 0,
      towerRanks: P().towerRanks(), finalLv2: true, branches: P().branchesUnlocked(),
    }, RG.raid.setup(type, d, heroId));
    const sl = P().shardLevels();
    if (sl) opts.shardLv = sl;
    const growth = heroId ? P().heroGrowth(heroId) : null;
    if (growth) opts.heroGrowth = growth;
    return opts;
  }
  RG.ui.raidOpts = raidOpts;

  function start(type, d, heroId) {
    try { if (RG.audio) RG.audio.init(); } catch (e) { /* 무시 */ }
    UI.sfx('click');
    if (heroId) { P().get().lastHero = heroId; P().save(); }
    pickTower = type; pickDiff[type] = d; pickHero = heroId;
    UI.show('game', { opts: raidOpts(type, d, heroId) });
  }

  UI.register('raid', {
    enter(sec, data = {}) {
      UI.music('worldmap');
      sec.innerHTML = '';
      const back = () => UI.show(data.back || 'world', data.backData || {});
      const head = el('header', { class: 'top-bar' }, [
        el('button', { class: 'icon-btn', title: '돌아가기', 'aria-label': '돌아가기', onclick: back }, [UI.icon('back')]),
        el('h2', {}, [UI.icon('shard', 'tiny'), ' 조각 레이드']),
        el('span', { class: 'dim rd-head-note', text: '탑 하나만으로 막아 내면 그 탑의 조각을 얻습니다' }),
      ]);
      if (!P().raidOpen()) {
        const def = D().maps.find((m) => m.id === RD().unlockAfter);
        sec.append(head, el('div', { class: 'rd-locked' }, [UI.icon('lock', 'big-ico'), el('p', { text: `${def.id} ${def.name}을(를) 지켜 내면 열립니다.` })]));
        return;
      }
      const owned = P().ownedTowers();
      if (data.tower && owned.includes(data.tower)) pickTower = data.tower;
      if (!pickTower || !owned.includes(pickTower)) pickTower = owned[0];
      const heroes = P().heroesFor(P().frontier());
      if (data.hero && heroes.includes(data.hero)) pickHero = data.hero;
      if (!pickHero || !heroes.includes(pickHero)) pickHero = heroes.includes(P().get().lastHero) ? P().get().lastHero : heroes[0];
      const type = pickTower;
      const maxD = P().raidMaxDiff(type);
      let d = data.d || pickDiff[type] || maxD;
      d = Math.max(1, Math.min(maxD, d));
      pickDiff[type] = d;
      const td = D().towers[type];
      const support = RG.raid.isSupport(type);
      const rerender = (patch) => UI.show('raid', Object.assign({ back: data.back, backData: data.backData, tower: pickTower, d: pickDiff[pickTower], hero: pickHero }, patch));

      /* ---------- 내 탑 목록 ---------- */
      const list = el('div', { class: 'rd-list', role: 'listbox', 'aria-label': '레이드할 탑' });
      for (const t of owned) {
        const lv = P().shardLvOf(t);
        const best = P().raidBest(t);
        const cost = RG.raid.shardCost(lv);
        const canUp = cost != null && P().shardsOf(t) >= cost;
        list.appendChild(el('button', {
          class: `rd-tower rar-${RG.gacha.rarityOf(t)} ${t === type ? 'on' : ''}`, role: 'option', 'aria-selected': t === type ? 'true' : 'false',
          'aria-label': `${D().towers[t].name} — 조각 강화 ${lv}단계, 깬 난이도 ${best}`,
          onclick: () => { UI.sfx('click'); rerender({ tower: t, d: pickDiff[t] || P().raidMaxDiff(t) }); },
        }, [
          el('span', { class: 'rd-timg' }, [UI.towerImg(t, buildLv(t), null, 'mini'), lvBadge(lv)]),
          el('span', { class: 'rd-tname', text: D().towers[t].name }),
          progressBar(t),
          el('span', { class: 'rd-pips', 'aria-hidden': 'true' }, RD().difficulty.map((_, i) => el('i', { class: i < best ? 'on' : '' }))),
          canUp ? el('span', { class: 'rd-up-dot', title: '조각 강화 가능', text: '▲' }) : null,
        ]));
      }
      const missing = D().towerOrder.length - owned.length;
      const listWrap = el('section', { class: 'rd-left' }, [
        el('div', { class: 'sec-title', text: `내 탑 (${owned.length}/${D().towerOrder.length})` }),
        list,
        missing > 0 ? el('p', { class: 'small dim', text: `아직 없는 탑 ${missing}종은 뽑기에서 얻으면 레이드할 수 있어요.` }) : null,
      ]);

      /* ---------- 고른 탑 ---------- */
      const lv = P().shardLvOf(type);
      const cost = RG.raid.shardCost(lv);
      const have = P().shardsOf(type);
      const upgrade = () => {
        const r = P().upgradeShard(type);
        if (!r.ok) { UI.toast(r.reason, 'warn'); UI.sfx('error'); return; }
        UI.sfx('unlock');
        UI.toast(`${td.name} 조각 강화 ${r.lv}단계! ${effectText(type, r.lv)}`, 'good', 2600);
        rerender({});
      };
      const shardBox = el('div', { class: 'rd-shard' }, [
        el('div', { class: 'rd-shard-head' }, [
          UI.icon('shard', 'small'),
          el('b', { text: `조각 강화 ${lv}/${RD().shard.max}단계` }),
          el('span', { class: 'rd-have', text: `조각 ${have}개` }),
        ]),
        el('div', { class: 'rd-steps', 'aria-hidden': 'true' }, Array.from({ length: RD().shard.max }, (_, i) => el('i', { class: i < lv ? 'on' : '' }))),
        el('p', { class: 'rd-eff' }, [el('span', { class: 'dim', text: '지금 ' }), effectText(type, lv)]),
        cost != null ? el('p', { class: 'rd-eff next' }, [el('span', { class: 'dim', text: `${lv + 1}단계 ` }), effectText(type, lv + 1)]) : null,
        el('div', { class: 'rd-shard-act' }, [
          progressBar(type),
          cost != null ? el('button', { class: `btn small ${have >= cost ? 'btn-primary' : ''}`, disabled: have < cost, onclick: upgrade }, [`강화 (조각 ${cost})`]) : el('span', { class: 'good', text: '최대 단계' }),
        ]),
        el('p', { class: 'small dim', text: '조각 강화는 캠페인·무한·레이드에 적용됩니다 (도전 모드 제외). 뽑기 강화와 따로 쌓여요.' }),
      ]);

      // 난이도
      const diffRow = el('div', { class: 'rd-diffs', role: 'radiogroup', 'aria-label': '난이도' });
      RD().difficulty.forEach((df, i) => {
        const n = i + 1;
        const open = n <= maxD;
        const cleared = P().raidBest(type) >= n;
        const map = D().raidMaps.find((m) => m.id === df.map);
        diffRow.appendChild(el('button', {
          class: `rd-diff ${n === d ? 'on' : ''} ${open ? '' : 'locked'} ${cleared ? 'cleared' : ''}`, role: 'radio', 'aria-checked': n === d ? 'true' : 'false',
          tabindex: open ? null : '-1', 'aria-disabled': open ? null : 'true',
          title: open ? `${df.name} · ${map.name} · 웨이브 ${df.waves}` : '앞 난이도를 이 탑으로 먼저 깨야 합니다',
          onclick: () => { if (!open) { UI.toast('앞 난이도를 이 탑으로 먼저 깨야 합니다', 'warn'); return; } UI.sfx('click'); rerender({ d: n }); },
        }, [
          el('b', { text: open ? df.name : '잠김' }),
          el('span', { class: 'rd-rw' }, [UI.icon('shard', 'tiny'), cleared ? `${df.reward}` : `${df.reward * RD().firstClearMult}`]),
          cleared ? el('small', { class: 'good', text: '✓ 깸' }) : open ? el('small', { class: 'gold', text: `첫 클리어 ×${RD().firstClearMult}` }) : el('small', { class: 'dim', text: '앞 난이도 먼저' }),
        ]));
      });
      const df = RD().difficulty[d - 1];
      const map = D().raidMaps.find((m) => m.id === df.map);

      // 영웅
      const heroRow = el('div', { class: 'hero-pick rd-heroes' });
      for (const h of heroes) {
        const hd = D().heroes[h];
        heroRow.appendChild(el('button', {
          class: `hp-item ${pickHero === h ? 'on' : ''}`, title: `${hd.name} — ${hd.title}`,
          onclick: () => { UI.sfx('click'); rerender({ hero: h }); },
        }, [UI.portrait(h, pickHero === h ? 'happy' : 'normal', 'hp-portrait'), el('span', { text: hd.name })]));
      }
      const hd = D().heroes[pickHero];

      // 적
      const enemyRow = el('div', { class: 'chip-row' });
      for (const e of enemiesOf(type, d, pickHero)) {
        const chip = el('span', { class: 'e-chip' }, [UI.enemyImg(e, 'mini')]);
        UI.tooltipFor(chip, () => `<b>${esc(D().enemies[e].name)}</b><br>${esc(D().enemies[e].desc)}`);
        enemyRow.appendChild(chip);
      }
      const air = RG.raid.canAir(type, pickHero);
      const rules = [
        `${td.name}만 지을 수 있습니다 · 영웅은 함께`,
        support ? `지원 탑 레이드: ${wj(hd ? hd.name : '영웅', '이/가')} 싸웁니다. 영웅 곁(${RD().supportHero.radius}칸 안)에 지은 ${td.name}마다 영웅 피해·기술 +${Math.round(RD().supportHero.perTower * 100)}% (탑 단계가 높을수록 더, 가장 센 ${RD().supportHero.max}개까지)` : null,
        !air ? (support ? `${wj(hd ? hd.name : '영웅', '은/는')} 공중을 못 쳐서 비행 적은 나오지 않습니다` : `${wj(td.name, '은/는')} 공중을 못 쳐서 비행 적은 나오지 않습니다`) : null,
        support ? '영웅의 원소에 면역인 적은 나오지 않습니다' : `${td.name}의 원소에 면역인 적은 나오지 않습니다`,
      ].filter(Boolean);
      const run = RG.save.get(RG.save.KEYS.run, null);
      const resume = run && run.opts && run.opts.raid && run.opts.raid.tower === type && run.opts.raid.d === d;
      const detail = el('section', { class: 'rd-right' }, [
        el('div', { class: 'rd-title' }, [
          el('span', { class: 'rd-big' }, [UI.towerImg(type, buildLv(type), null, 'rd-big-img'), lvBadge(lv, 'big')]),
          el('div', {}, [
            el('h3', { text: td.name }),
            el('p', { class: 'dim small', text: `${RG.gacha.RARITIES[RG.gacha.rarityOf(type)].name} · ${D().elements[td.element].name} · ${ROLE[td.role] || td.role}` }),
            el('p', { class: 'small', text: td.desc }),
            buildLv(type) > 1 ? el('p', { class: 'small good', text: `맵에 같은 값으로 Lv${buildLv(type)}부터 지어집니다` }) : null,
          ]),
        ]),
        shardBox,
        el('div', { class: 'sec-title', text: '난이도' }), diffRow,
        el('p', { class: 'rd-mapline' }, [UI.icon('map', 'tiny'), ` ${map.name} · 웨이브 ${df.waves} · 시작 골드 ${RG.raid.setup(type, d, pickHero).raid.startGold}`]),
        el('ul', { class: 'rd-rules' }, rules.map((r) => el('li', { text: r }))),
        el('div', { class: 'sec-title', text: '나오는 적' }), enemyRow,
        el('div', { class: 'sec-title', text: '영웅' }), heroRow,
        el('div', { class: 'brief-actions' }, [
          resume ? el('button', { class: 'btn', onclick: () => UI.show('game', { resume: run }) }, [`이어하기 (웨이브 ${run.wave})`]) : null,
          el('button', { class: 'btn btn-primary btn-big', 'data-autofocus': '', onclick: () => start(type, d, pickHero) }, [resume ? '새로 시작' : '레이드 시작!']),
        ]),
      ]);
      sec.append(head, el('div', { class: 'rd-body' }, [listWrap, detail]));
      // 고른 탑이 목록에서 보이게
      requestAnimationFrame(() => { const on = list.querySelector('.rd-tower.on'); if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest', inline: 'nearest' }); });
    },
  });

  /* =====================================================
   * 레이드 결과 (result 화면이 data.raid면 여기로)
   * ===================================================== */
  RG.ui.raidResult = function raidResult(sec, data) {
    const win = data.result === 'win';
    const R = data.raid;
    const type = R.tower;
    const td = D().towers[type];
    const df = RD().difficulty[R.d - 1];
    const box = el('div', { class: `result-box ${win ? 'win' : 'lose'}` });
    const hero = data.opts.heroId;
    if (hero) box.appendChild(UI.portrait(hero, win ? 'happy' : 'worried', 'result-portrait'));
    box.appendChild(el('h2', { text: win ? '레이드를 막아 냈다!' : data.timeout ? '시간이 너무 오래 걸렸다…' : '등불이 꺼졌다…' }));
    box.appendChild(el('p', { class: 'dim', text: `조각 레이드 · ${td.name} · ${df.name} (${data.waves}/${data.totalWaves}웨이브)` }));
    const rr = data.rec;
    const lv = P().shardLvOf(type);
    const cost = RG.raid.shardCost(lv);
    const got = el('div', { class: 'reward-box rd-reward' }, [
      el('div', { class: 'rw-total' }, [UI.towerImg(type, 1, null, 'mini'), UI.icon('shard', 'small'), el('b', { text: `+${rr.shards}` }), el('span', { text: `${td.name} 조각` })]),
      el('div', { class: 'rw-lines dim', text: win ? (rr.firstClear ? `${df.name} 첫 클리어 ×${RD().firstClearMult}` : `${df.name} 클리어`) : rr.shards ? '절반 넘게 버텨 위로 조각' : '절반을 넘기면 지더라도 조각 1개' }),
      el('div', { class: 'rd-result-bar' }, [progressBar(type), cost != null ? el('span', { class: P().shardsOf(type) >= cost ? 'good' : 'dim', text: P().shardsOf(type) >= cost ? ' 조각 강화를 할 수 있어요!' : ` 다음 강화까지 ${cost - P().shardsOf(type)}개` }) : el('span', { class: 'good', text: ' 최대 단계' })]),
      win && rr.firstClear && R.d < RD().difficulty.length ? el('p', { class: 'good', text: `${RD().difficulty[R.d].name} 난이도가 열렸습니다` }) : null,
    ]);
    box.appendChild(got);
    if (rr.shards > 0) setTimeout(() => UI.sfx('star'), 500);
    const bd = rr.bond;
    if (bd && bd.gain > 0) {
      const hn = D().heroes[bd.heroId].name;
      box.appendChild(el('div', { class: 'growth-box' }, [el('div', { class: `gb-bond ${bd.levelUp ? 'up' : ''}` }, [
        UI.portrait(bd.heroId, bd.levelUp ? 'happy' : 'normal', 'mini-portrait'),
        el('span', { text: bd.levelUp ? `${hn} 인연 Lv${bd.after}! 재능 점수 +${bd.after - bd.before}` : `${hn} 인연 +${bd.gain}` }),
      ])]));
    }
    if (RG.ui.resultStats) box.appendChild(RG.ui.resultStats(data, hero));
    const nextD = win && R.d < RD().difficulty.length && P().raidMaxDiff(type) > R.d ? R.d + 1 : null;
    const btns = el('div', { class: 'result-buttons' }, [
      el('button', { class: 'btn', 'data-autofocus': nextD ? null : '', onclick: () => UI.show('game', { opts: raidOpts(type, R.d, hero) }) }, ['다시 하기']),
      el('button', { class: 'btn', onclick: () => UI.show('raid', { tower: type, d: nextD || R.d, hero }) }, ['레이드로']),
      nextD ? el('button', { class: 'btn btn-primary', 'data-autofocus': '', onclick: () => UI.show('game', { opts: raidOpts(type, nextD, hero) }) }, [`다음 난이도 (${RD().difficulty[nextD - 1].name})`]) : null,
    ]);
    box.appendChild(btns);
    sec.appendChild(box);
  };
})();
