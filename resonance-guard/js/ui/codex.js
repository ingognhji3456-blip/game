'use strict';

/* =========================================================
 * 도감 · 수호대 · 기술 나무
 * ========================================================= */
(() => {
  const { el, round } = RG.util;
  const UI = RG.ui;
  const D = () => RG.data;
  const P = () => RG.progress;

  function topBar(title, back) {
    return el('header', { class: 'top-bar' }, [
      el('button', { class: 'icon-btn', title: '뒤로', onclick: back || (() => UI.show('world', {})) }, [UI.icon('back')]),
      el('h2', { text: title }),
    ]);
  }

  /* =====================================================
   * 도감
   * ===================================================== */
  let codexTab = 'towers';
  UI.register('codex', {
    enter(sec, data) {
      if (data.tab) codexTab = data.tab;
      sec.innerHTML = '';
      const tabs = el('nav', { class: 'tabs' });
      for (const [id, name] of [['towers', '탑'], ['enemies', '적'], ['resonance', '공명'], ['rules', '특성·상태']]) {
        tabs.appendChild(el('button', { class: `tab ${codexTab === id ? 'on' : ''}`, onclick: () => { codexTab = id; UI.show('codex', {}); } }, [name]));
      }
      const body = el('div', { class: 'codex-body' });
      if (codexTab === 'towers') towersTab(body);
      else if (codexTab === 'enemies') enemiesTab(body);
      else if (codexTab === 'resonance') resonanceTab(body);
      else rulesTab(body);
      sec.append(topBar('도감'), tabs, body);
    },
  });

  /** 뽑기로 얻은 탑만 도감에 보임 (2026-11-10 개정) */
  function towerUnlocked(t) { return P().ownsTower(t); }

  function towersTab(body) {
    const grid = el('div', { class: 'codex-grid' });
    for (const t of D().towerOrder) {
      const td = D().towers[t];
      const open = towerUnlocked(t);
      const card = el('button', { class: `codex-card el-${td.element} ${open ? '' : 'locked'}`, onclick: () => open && towerDetail(t) }, [
        open ? UI.towerImg(t, 3, null, 'cc-img') : el('span', { class: 'cc-q', text: '?' }),
        el('b', { text: open ? td.name : '???' }),
        el('span', { class: 'dim small', text: open ? D().elements[td.element].name : `${td.unlock}에서 해금` }),
      ]);
      grid.appendChild(card);
    }
    body.appendChild(grid);
  }

  function towerDetail(t) {
    const td = D().towers[t];
    const box = el('div', { class: 'tower-detail' });
    const row = el('div', { class: 'td-levels' });
    for (const [lv, br] of [[1], [2], [3], [4, 'A'], [4, 'B']]) {
      const spec = RG.stats.specOf(t, lv, br);
      row.appendChild(el('div', { class: 'td-level' }, [
        UI.towerImg(t, lv, br || null, 'td-img'),
        el('b', { text: br ? `${br} · ${spec.name}` : `Lv${lv}` }),
        el('span', { class: 'small dim', text: `${spec.cost} 골드` }),
        br ? el('span', { class: 'small', text: spec.desc }) : null,
      ]));
    }
    box.append(el('p', { text: td.desc }), UI.elementBadge(td.element), row);
    UI.modal(box, { title: td.name, buttons: [{ text: '닫기', primary: true }], className: 'wide' });
  }

  function enemiesTab(body) {
    const grid = el('div', { class: 'codex-grid' });
    for (const e of D().enemyOrder) {
      const ed = D().enemies[e];
      const seen = P().seen('enemies', e);
      grid.appendChild(el('button', { class: `codex-card ${seen ? '' : 'locked'} ${ed.boss ? 'boss' : ''}`, onclick: () => seen && enemyDetail(e) }, [
        seen ? UI.enemyImg(e, 'cc-img') : el('span', { class: 'cc-q', text: '?' }),
        el('b', { text: seen ? ed.name : '???' }),
        el('span', { class: 'dim small', text: `${D().regions[ed.region - 1].name}${ed.boss ? ' · 보스' : ''}` }),
      ]));
    }
    body.appendChild(grid);
  }

  function enemyDetail(e) {
    const ed = D().enemies[e];
    const box = el('div', { class: 'enemy-detail' }, [
      UI.enemyImg(e, 'ed-img'),
      el('p', { text: ed.desc }),
      el('p', { class: 'small', text: `체력 ${ed.hp} · 속도 ${ed.speed}칸/초 · 갑옷 ${round(ed.armor * 100)}% · 현상금 ${ed.bounty} · ${ed.boss ? '등불에 닿으면 즉시 패배' : `불꽃 ${ed.lives}개`}` }),
    ]);
    for (const k of Object.keys(ed.traits).filter((x) => D().traits[x])) box.appendChild(el('div', { class: 'trait-row' }, [UI.icon(D().traits[k].icon, 'small'), el('div', {}, [el('b', { text: D().traits[k].name }), el('span', { text: D().traits[k].desc })])]));
    const aff = Object.entries(ed.affinity);
    if (aff.length) box.appendChild(el('div', { class: 'aff-list' }, aff.map(([e2, a]) => el('span', { class: `aff-chip aff-${a}` }, [UI.elementBadge(e2), D().affinities[a].name]))));
    UI.modal(box, { title: ed.name, buttons: [{ text: '닫기', primary: true }] });
  }

  function resonanceTab(body) {
    const order = D().elementOrder;
    body.appendChild(el('p', { class: 'dim', text: '서로 이웃한(대각선 포함) 탑의 원소 짝에 따라 생기는 효과입니다. 같은 효과는 한 탑에 한 번만 적용되므로 여러 원소를 섞을수록 강해집니다.' }));
    const table = el('div', { class: 'res-table' });
    table.appendChild(el('span', { class: 'rt-corner' }));
    for (const e of order) table.appendChild(el('span', { class: `rt-head el-${e}` }, [UI.icon(e, 'tiny'), D().elements[e].name]));
    for (const a of order) {
      table.appendChild(el('span', { class: `rt-head el-${a}` }, [UI.icon(a, 'tiny'), D().elements[a].name]));
      for (const b of order) {
        const key = RG.stats.resKey(a, b);
        const res = D().resonance[key];
        const cell = el('span', { class: `rt-cell ${a === b ? 'pure' : ''}`, text: res.name });
        UI.tooltipFor(cell, () => `<b>${res.name}</b><br>${res.desc}`);
        cell.addEventListener('click', () => UI.toast(`${res.name}: ${res.desc}`, 'info', 2800));
        table.appendChild(cell);
      }
    }
    body.appendChild(table);
    const list = el('div', { class: 'res-list' });
    for (const res of Object.values(D().resonance)) list.appendChild(el('div', { class: 'res-row' }, [el('b', { text: res.name }), el('span', { text: res.desc })]));
    body.appendChild(list);
  }

  function rulesTab(body) {
    body.appendChild(el('div', { class: 'sec-title', text: '적 특성' }));
    for (const t of Object.values(D().traits)) body.appendChild(el('div', { class: 'trait-row' }, [UI.icon(t.icon, 'small'), el('div', {}, [el('b', { text: t.name }), el('span', { text: t.desc })])]));
    body.appendChild(el('div', { class: 'sec-title', text: '상태 이상' }));
    for (const s of Object.values(D().statuses)) body.appendChild(el('div', { class: 'trait-row' }, [UI.icon(s.icon, 'small'), el('div', {}, [el('b', { text: s.name }), el('span', { text: s.desc })])]));
    body.appendChild(el('div', { class: 'sec-title', text: '원소 친화' }));
    for (const a of Object.values(D().affinities)) body.appendChild(el('div', { class: 'trait-row' }, [el('div', {}, [el('b', { text: a.name }), el('span', { text: a.desc })])]));
  }

  /* =====================================================
   * 수호대
   * ===================================================== */
  let heroSel = 'kara';
  let heroBack = null; // 뒤로 갈 곳 (로비에서 왔으면 로비)
  /*
   * 수호대 (2026-11-10 개편): 예전엔 작은 초상화 목록 + 글자 줄이 전부였음.
   * 영웅 고르기 줄(원소 색 테두리, 잠긴 영웅은 실루엣과 합류 맵) + 영웅 원소 색으로 꾸민 무대
   * (큰 초상화·숨 쉬는 전신 그림·누르면 공격 자세와 말풍선) + 능력치 막대 + 기술·패시브 카드 + 다음 출정 대표 정하기.
   */
  UI.register('heroes', {
    enter(sec, data) {
      if (data.hero && D().heroes[data.hero]) heroSel = data.hero;
      if (data.back) heroBack = data.back;
      else if (!data.hero) heroBack = null;
      sec.innerHTML = '';
      const unlocked = P().heroesFor(P().frontier());
      const lead = unlocked.includes(P().get().lastHero) ? P().get().lastHero : unlocked[0];
      const back = heroBack && heroBack.screen ? () => UI.show(heroBack.screen, heroBack.data || {}) : null;
      const bar = topBar('수호대', back);
      bar.appendChild(el('span', { class: 'hx-count' }, [UI.icon('hero', 'tiny'), `영웅 ${unlocked.length} / ${D().heroOrder.length}`]));
      const roster = el('nav', { class: 'hx-roster', 'aria-label': '영웅 고르기' });
      for (const h of D().heroOrder) {
        const hd = D().heroes[h];
        const open = unlocked.includes(h);
        roster.appendChild(el('button', {
          class: `hx-pick ${heroSel === h ? 'on' : ''} ${open ? '' : 'locked'}`,
          style: `--hc:${hd.color};--ec:${D().elements[hd.element].color}`,
          'aria-pressed': heroSel === h ? 'true' : 'false',
          title: open ? `${hd.name} · ${hd.title}` : `${hd.unlock}에서 합류`,
          onclick: () => { if (heroSel !== h) { heroSel = h; UI.sfx('click'); UI.show('heroes', { hero: h }); } },
        }, [
          el('span', { class: 'hx-pick-face' }, open
            ? [UI.portrait(h, 'normal', 'hx-pick-img')]
            : [RG.art.hero ? UI.svgImg(RG.art.hero(h, 'idle0'), 'hx-pick-shadow', '') : null, UI.icon('lock', 'hx-lock')]), // 잠긴 영웅: 배경 없는 전신 실루엣
          el('b', { text: open ? hd.name : hd.unlock }),
          open && h === lead ? el('i', { class: 'hx-lead-dot', title: '다음 출정 대표' }, [UI.icon('star', 'tiny')]) : null,
        ]));
      }
      const open = unlocked.includes(heroSel);
      const main = el('div', { class: 'hx-main' }, [heroStage(heroSel, open, heroSel === lead), heroInfo(heroSel, open)]);
      sec.append(bar, el('div', { class: 'hx-body' }, [roster, main]));
      // 고른 영웅이 고르기 줄 안에 보이게
      requestAnimationFrame(() => { const on = roster.querySelector('.hx-pick.on'); if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest', inline: 'center' }); });
    },
  });

  /** 무대: 원소 색 배경 + 큰 초상화 + 전신 그림(숨쉬기) + 이름판 + 말풍선 */
  function heroStage(h, open, isLead) {
    const hd = D().heroes[h];
    const ec = D().elements[hd.element].color;
    const stage = el('div', { class: `hx-stage ${open ? '' : 'locked'}`, style: `--hc:${hd.color};--ec:${ec}` });
    const portrait = UI.portrait(h, 'normal', 'hx-portrait');
    const pose = (p) => (RG.art.hero ? UI.svgImg(RG.art.hero(h, p), `hx-body-img hx-${p}`, '') : null);
    const figure = el('div', { class: 'hx-figure' }, [pose('idle0'), pose('idle1'), pose('attack')]);
    const lines = hd.lines.select.concat(hd.lines.win);
    let li = 0;
    const bubble = el('div', { class: 'hx-bubble', text: open ? lines[0] : '' });
    const art = el('div', { class: 'hx-art' }, [
      el('div', { class: 'hx-rays' }),
      RG.art.elementGem ? UI.svgImg(RG.art.elementGem(hd.element), 'hx-gem', '') : null,
      open ? el('div', { class: 'hx-portrait-ring' }, [portrait]) : el('div', { class: 'hx-mystery', text: '?' }),
      el('div', { class: 'hx-pedestal' }),
      figure,
      open ? bubble : null,
    ]);
    if (open) {
      // 무대를 누르면: 공격 자세 + 기쁜 얼굴 + 다음 대사
      let tm = 0;
      const urlN = portrait.src;
      let urlH = null;
      art.addEventListener('click', () => {
        li = (li + 1) % lines.length;
        bubble.textContent = lines[li];
        bubble.classList.remove('pop'); void bubble.offsetWidth; bubble.classList.add('pop');
        figure.classList.add('strike');
        if (!urlH) urlH = RG.art.sprites.dataUrl(RG.art.portrait(h, 'happy'));
        portrait.src = urlH;
        UI.sfx('heroAttack', { vol: 0.4 });
        clearTimeout(tm);
        tm = setTimeout(() => { figure.classList.remove('strike'); portrait.src = urlN; }, 700);
      });
      art.setAttribute('role', 'button');
      art.setAttribute('tabindex', '0');
      art.setAttribute('aria-label', `${hd.name} — 눌러서 대사 듣기`);
      art.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); art.click(); } });
    }
    const chips = open ? roleChips(hd) : [];
    const plate = el('div', { class: 'hx-plate' }, [
      el('div', { class: 'hx-name' }, [el('h3', { text: open ? hd.name : '???' }), el('span', { class: 'hx-title', text: hd.title })]),
      el('div', { class: 'hx-tags' }, [UI.elementBadge(hd.element), ...chips.map((c) => el('span', { class: 'hx-chip', text: c }))]),
      open
        ? el('button', {
          class: `btn hx-lead ${isLead ? 'is-lead' : 'btn-primary'}`,
          disabled: isLead ? true : null,
          onclick: () => { P().get().lastHero = h; P().save(); UI.sfx('upgrade'); UI.toast(`${hd.name}, 다음 출정에 함께합니다`, 'good'); UI.show('heroes', { hero: h }); },
        }, [UI.icon('star', 'tiny'), isLead ? '다음 출정 대표' : '다음 출정에 데려가기'])
        : el('div', { class: 'hx-unlock' }, [UI.icon('lock', 'tiny'), el('span', {}, [el('b', { text: hd.unlock }), ` ${(D().maps.find((m) => m.id === hd.unlock) || {}).name || ''}에서 합류합니다`])]),
    ]);
    stage.append(art, plate);
    return stage;
  }

  /** 영웅 특징 몇 개 (근접·붙잡기·공중 등) */
  function roleChips(hd) {
    const out = [hd.melee ? '근접' : `원거리 ${hd.range}칸`];
    out.push(hd.block ? `붙잡기 ${hd.block}명` : '붙잡지 않음');
    out.push(hd.targets === 'both' ? '공중도 공격' : '지상만 공격');
    if (hd.splash) out.push('주변까지 타격');
    if (hd.chain) out.push(`연쇄 ${hd.chain.count}번`);
    if (hd.crit) out.push(`치명타 ${Math.round(hd.crit.chance * 100)}%`);
    return out;
  }

  /** 오른쪽: 소개 · 능력치 막대 · 기술 · 패시브 · 대사 */
  function heroInfo(h, open) {
    const hd = D().heroes[h];
    const info = el('div', { class: 'hx-info', style: `--ec:${D().elements[hd.element].color}` });
    if (!open) {
      info.append(
        el('p', { class: 'hx-bio dim', text: '아직 만나지 못한 수호자입니다. 모험을 이어 가면 합류합니다.' }),
        heroStats(hd, false),
        el('div', { class: 'hx-card hx-skill locked' }, [el('span', { class: 'hx-card-ico' }, [UI.icon('lock', 'hx-ci')]), el('div', { class: 'hx-card-body' }, [el('span', { class: 'hx-kind', text: '기술' }), el('b', { text: '???' }), el('span', { class: 'dim', text: '합류하면 볼 수 있습니다.' })])]),
      );
      return info;
    }
    const ec = D().elements[hd.element].color;
    const card = (kind, icon, name, desc, chips, cls) => el('div', { class: `hx-card ${cls}`, style: `--ec:${ec}` }, [
      el('span', { class: 'hx-card-ico' }, [UI.icon(icon, 'hx-ci')]),
      el('div', { class: 'hx-card-body' }, [
        el('span', { class: 'hx-kind', text: kind }),
        el('b', { text: name }),
        el('span', { class: 'hx-desc', text: desc }),
        chips.length ? el('div', { class: 'hx-mini' }, chips.map((c) => el('span', { text: c }))) : null,
      ]),
    ]);
    const quotes = el('div', { class: 'hx-quotes' }, hd.lines.select.slice(0, 2).concat(hd.lines.win.slice(0, 1)).map((q) => el('q', { text: q })));
    info.append(
      el('p', { class: 'hx-bio', text: hd.bio }),
      heroStats(hd, true),
      card('기술', 'skill', hd.skill.name, hd.skill.desc, skillChips(hd.skill), 'hx-skill'),
      card('패시브', hd.element, hd.passive.name, hd.passive.desc, passiveChips(hd.passive), 'hx-passive'),
      el('div', { class: 'hx-sec' }, [el('span', { class: 'hx-kind', text: '대사' }), quotes]),
    );
    return info;
  }

  /** 능력치 막대: 영웅 여섯 중 가장 높은 값을 가득으로 */
  function heroStats(hd, open) {
    const all = D().heroOrder.map((k) => D().heroes[k]);
    const max = (f) => Math.max(...all.map(f));
    const dps = (x) => x.damage / x.interval;
    const rows = [
      ['hp', '체력', hd.hp / max((x) => x.hp), String(hd.hp)],
      ['damage', '공격', dps(hd) / max(dps), `${hd.damage} / ${hd.interval}초`],
      ['range', '사거리', (hd.melee ? 0.75 : hd.range) / max((x) => (x.melee ? 0.75 : x.range)), hd.melee ? '근접' : `${hd.range}칸`],
      ['speed', '이동', hd.speed / max((x) => x.speed), `${hd.speed}칸/초`],
      ['armor', '방어', (hd.armor || 0) / max((x) => x.armor || 0), `${Math.round((hd.armor || 0) * 100)}%`],
      ['hero', '붙잡기', (hd.block || 0) / max((x) => x.block || 0), hd.block ? `${hd.block}명` : '없음'],
    ];
    return el('div', { class: 'hx-stats' }, rows.map(([ic, name, k, val]) => el('div', { class: 'hx-stat' }, [
      UI.icon(ic, 'hx-si'),
      el('span', { class: 'hx-sn', text: name }),
      el('span', { class: 'hx-bar' }, [el('i', { style: `width:${open ? Math.max(4, Math.round(k * 100)) : 0}%` })]),
      el('b', { text: open ? val : '?' }),
    ])));
  }
  function skillChips(s) {
    const c = [`재사용 ${s.cooldown}초`];
    if (s.delay) c.push(`${s.delay}초 뒤`);
    if (s.radius) c.push(`반경 ${s.radius}칸`);
    if (s.damage) c.push(`피해 ${s.damage}`);
    if (s.heal) c.push(`회복 ${s.heal}`);
    if (s.burn) c.push(`화상 ${s.burn.dur}초`);
    if (s.freeze) c.push(`빙결 ${s.freeze}초`);
    if (s.blind) c.push(`실명 ${s.blind}초`);
    if (s.duration) c.push(`${s.duration}초 지속`);
    if (s.wallHp) c.push(`벽 체력 ${s.wallHp}`);
    if (s.execute) c.push(`체력 ${Math.round(s.execute * 100)}% 이하 처치`);
    return c;
  }
  function passiveChips(p) {
    const c = [];
    if (p.threshold) c.push(`체력 ${Math.round(p.threshold * 100)}% 이하`);
    if (p.reduce) c.push(`받는 피해 −${Math.round(p.reduce * 100)}%`);
    if (p.detect) c.push(`탐지 ${p.detect}칸`);
    if (p.regen) c.push(`초당 회복 ${Math.round(p.regen * 100)}%`);
    if (p.critChance) c.push(`치명타 ${Math.round(p.critChance * 100)}% · ${p.critMult}배`);
    if (p.every) c.push(`${p.every}번에 1번`);
    if (p.bountyPct) c.push(`현상금 +${Math.round(p.bountyPct * 100)}%`);
    return c;
  }

  /* =====================================================
   * 기술 나무
   * ===================================================== */
  UI.register('tree', {
    enter(sec) {
      sec.innerHTML = '';
      const head = topBar('기술 나무');
      head.appendChild(el('div', { class: 'top-stars' }, [UI.icon('star'), el('b', { text: String(P().starsFree()) }), el('small', { text: ` 남음 / 모은 별 ${P().starsTotal()}` })]));
      head.appendChild(el('button', { class: 'btn small', onclick: () => UI.confirmBox('찍은 칸을 모두 되돌릴까요? (별은 모두 돌려받습니다)', () => { P().resetSkills(); UI.show('tree', {}); }) }, ['초기화']));
      const grid = el('div', { class: 'tree-grid' });
      for (const br of D().skillBranches) {
        const col = el('div', { class: 'tree-col' }, [el('div', { class: 'tree-head' }, [UI.icon(br.icon, 'small'), el('b', { text: br.name })])]);
        for (const s of D().skills.filter((k) => k.branch === br.id).sort((a, b) => a.tier - b.tier)) {
          const has = P().get().skills.includes(s.id);
          const can = P().canLearn(s.id);
          col.appendChild(el('button', {
            class: `tree-node ${has ? 'has' : ''} ${can ? 'can' : ''}`,
            onclick: () => {
              if (has) return;
              if (!can) { UI.toast(P().starsFree() < s.cost ? '별이 부족합니다' : '앞 칸을 먼저 찍어야 합니다', 'warn'); return; }
              P().learn(s.id); UI.sfx('upgrade'); UI.show('tree', {});
            },
          }, [el('b', { text: s.name }), el('span', { text: s.desc }), el('em', {}, [UI.icon('star', 'tiny'), String(s.cost)])]));
        }
        grid.appendChild(col);
      }
      sec.append(head, el('p', { class: 'dim tree-note', text: '기술 나무는 캠페인과 무한 모드에 적용되고, 도전에는 적용되지 않습니다. 캠페인은 기술 나무 없이도 별 셋을 받을 수 있게 만들어져 있습니다.' }), grid);
    },
  });
})();
