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
        el('span', { class: 'dim small', text: open ? `${D().elements[td.element].name}${P().towerFinal(t) ? ' · ★최종 강화(Lv2부터 지음)' : P().towerRank(t) > 0 ? ` · 강화 +${P().towerRank(t)}` : ''}` : P().towerOpen(t) ? '뽑기에서 얻을 수 있음' : `${(D().regions[P().towerRegion(t) - 2] || {}).name || ''} 클리어 후 뽑기에` }),
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
  let heroTapped = false; // 무대를 한 번이라도 눌렀나 ('눌러 보세요' 안내는 그 뒤로 숨김)
  let heroTab = 'info';    // 오른쪽 패널: 'info' 소개 · 'grow' 성장(인연·재능·장신구)
  let gearSlot = 0;        // 장신구를 끼울 칸
  /** 받침 고르기: 받침이 있으면 a, 없으면 b (예: 과/와, 을/를, 이/가) */
  const josa = (word, a, b) => { const c = word.charCodeAt(word.length - 1) - 0xac00; return c >= 0 && c <= 11171 && c % 28 ? a : b; };
  /** 꾸미기용 그림 (화면 읽기 프로그램이 내부 이름을 읽지 않게 alt는 비움) */
  const deco = (svg, cls) => UI.svgImg(svg, cls, '');
  // 영웅 기술이 닿는 적 (시뮬 규칙 그대로: 내려찍기는 지상만, 벽은 지상 적만 막음, 나머지는 공중도)
  const SKILL_HITS = { flame_slam: '지상 적만', earth_wall: '지상 적을 막음', dawn_prayer: '지상·공중', frost_volley: '지상·공중', thunder_drone: '지상·공중', shadow_strike: '비행 적도 가능' };
  const SKILL_ICON = { flame_slam: 'burn', frost_volley: 'freeze', dawn_prayer: 'healer', thunder_drone: 'shock', earth_wall: 'shield', shadow_strike: 'dash' };
  const SKILL_TARGET = { point: '고른 곳', enemy: '적 하나', path: '길 한 칸' };
  /*
   * 수호대 (2026-11-10 개편): 예전엔 작은 초상화 목록 + 글자 줄이 전부였음.
   * 영웅 고르기 줄(원소 색 테두리, 잠긴 영웅은 전신 실루엣과 합류 맵) + 영웅 원소 색으로 꾸민 무대
   * (왼쪽 큰 초상화 · 오른쪽 숨 쉬는 전신 그림, 누르면 공격 자세와 대사) + 능력치 막대 + 기술·패시브 카드 + 출정 영웅 정하기.
   * 독립 검토(디자인 3·코드·문구) 지적 반영.
   */
  UI.register('heroes', {
    enter(sec, data) {
      if (data.back) heroBack = data.back;
      else if (!data.hero) heroBack = null;
      sec.innerHTML = '';
      const unlocked = P().heroesFor(P().frontier());
      const lead = unlocked.includes(P().get().lastHero) ? P().get().lastHero : unlocked[0];
      if (data.tab) heroTab = data.tab;
      if (data.hero && D().heroes[data.hero]) heroSel = data.hero;
      else heroSel = lead; // 새로 들어올 때는 출정 영웅부터 (처음부터 다시 뒤 잠긴 영웅에 머물지 않게)
      const back = heroBack && heroBack.screen ? () => UI.show(heroBack.screen, heroBack.data || {}) : null;
      const bar = topBar('수호대', back);
      bar.appendChild(el('span', { class: 'hx-count', 'aria-label': `영웅 ${unlocked.length}명 합류 (전체 ${D().heroOrder.length}명)` }, [deco(RG.art.icon('hero'), 'icon hx-count-ico'), `영웅 ${unlocked.length} / ${D().heroOrder.length}`]));
      const roster = el('nav', { class: 'hx-roster', 'aria-label': '영웅 고르기' });
      for (const h of D().heroOrder) {
        const hd = D().heroes[h];
        const open = unlocked.includes(h);
        const join = joinText(hd);
        roster.appendChild(el('button', {
          class: `hx-pick ${heroSel === h ? 'on' : ''} ${open ? '' : 'locked'}`,
          style: `--hc:${hd.color};--ec:${D().elements[hd.element].color}`,
          'aria-pressed': heroSel === h ? 'true' : 'false',
          'aria-label': open ? `${hd.name}${h === lead ? ' · 출정 영웅' : ''}` : `잠긴 영웅 · ${join}`,
          title: open ? `${hd.name} · ${hd.title}` : join,
          onclick: () => { if (heroSel !== h) { UI.sfx('click'); UI.show('heroes', { hero: h, focus: 'pick' }); } },
        }, [
          el('span', { class: 'hx-pick-face' }, open
            ? [deco(RG.art.portrait(h, 'normal'), 'hx-pick-img')]
            : [RG.art.hero ? deco(RG.art.hero(h, 'idle0'), 'hx-pick-shadow') : null, deco(RG.art.icon('lock'), 'icon hx-lock'), el('small', { class: 'hx-pick-map', text: hd.unlock })]), // 잠긴 영웅: 배경 없는 전신 실루엣
          el('b', { text: open ? hd.name : '???' }),
          open && h === lead ? el('i', { class: 'hx-lead-dot' }, [deco(RG.art.icon('star'), 'icon')]) : null,
        ]));
      }
      const open = unlocked.includes(heroSel);
      const main = el('div', { class: 'hx-main' }, [heroStage(heroSel, open, heroSel === lead), heroInfo(heroSel, open)]);
      sec.append(bar, el('div', { class: 'hx-body' }, [roster, main]));
      requestAnimationFrame(() => {
        const on = roster.querySelector('.hx-pick.on');
        if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest', inline: 'center' });
        // 다시 그린 뒤 키보드 위치를 되돌림 (매번 맨 위부터 다시 탭하지 않게)
        if (data.focus === 'pick' && on) on.focus({ preventScroll: true });
        else if (data.focus === 'lead') { const f = sec.querySelector('.hx-lead, .hx-lead-badge'); if (f) f.focus({ preventScroll: true }); }
        else if (data.focus) { const f = sec.querySelector(`[data-focus="${data.focus}"]`); if (f) f.focus({ preventScroll: true }); }
        if (data.scroll != null) { const inf = sec.querySelector('.hx-info'); if (inf) inf.scrollTop = data.scroll; }
      });
    },
  });

  /** 합류 조건: 합류 맵 바로 앞 맵을 깨면 합류 */
  function joinPrev(hd) { const i = P().mapIndex(hd.unlock); return i > 0 ? D().maps[i - 1] : null; }
  function joinText(hd) {
    const prev = joinPrev(hd);
    return prev ? `${prev.id} ${prev.name}${josa(prev.name, '을', '를')} 깨면 합류` : `${hd.unlock}에서 합류`;
  }

  /** 무대: 원소 색 배경 + 왼쪽 큰 초상화 + 오른쪽 전신 그림(숨쉬기) + 말풍선 + 이름판 */
  function heroStage(h, open, isLead) {
    const hd = D().heroes[h];
    const ec = D().elements[hd.element].color;
    const stage = el('div', { class: `hx-stage ${open ? '' : 'locked'}`, style: `--hc:${hd.color};--ec:${ec}` });
    const pose = (p) => (RG.art.hero ? deco(RG.art.hero(h, p), `hx-body-img hx-${p}`) : null);
    const figure = el('div', { class: 'hx-figure' }, open ? [pose('idle0'), pose('idle1'), pose('attack')] : [pose('idle0')]);
    const wrap = el('div', { class: 'hx-artwrap' });
    const art = el('div', { class: 'hx-art' }, [
      el('div', { class: 'hx-rays' }),
      RG.art.elementGem ? deco(RG.art.elementGem(hd.element), 'hx-gem') : null,
      open ? el('div', { class: 'hx-portrait-ring' }, [deco(RG.art.portrait(h, 'normal'), 'hx-portrait')]) : el('div', { class: 'hx-mystery', 'aria-hidden': 'true', text: '?' }),
      el('div', { class: 'hx-pedestal' }),
      figure,
    ]);
    wrap.appendChild(art);
    if (open) {
      const lines = hd.lines.select;
      let li = 0;
      const bubbleId = `hx-bubble-${h}`;
      // 말풍선은 누르는 칸(버튼) 바깥에 두어 화면 읽기 프로그램이 새 대사를 읽을 수 있게
      const bubble = el('div', { class: 'hx-bubble', id: bubbleId, 'aria-live': 'polite', text: lines[0] });
      const hint = heroTapped ? null : el('span', { class: 'hx-tap', 'aria-hidden': 'true' }, [deco(RG.art.icon('play'), 'icon'), '눌러 보세요']);
      wrap.appendChild(bubble);
      if (hint) wrap.appendChild(hint);
      const portrait = art.querySelector('.hx-portrait');
      const urlN = portrait.src;
      let urlH = null;
      let tm = 0;
      art.addEventListener('click', () => {
        heroTapped = true;
        if (hint) hint.remove();
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
      art.setAttribute('aria-label', `${hd.name}에게 말 걸기`);
      art.setAttribute('aria-describedby', bubbleId);
      art.addEventListener('keydown', (e) => { if (e.repeat) return; if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); art.click(); } });
    }
    // 이야기상 다음 맵에 정해진 영웅이 있으면 출정 준비에서 그 영웅이 먼저 골라짐 — 숨기지 않고 알려 줌
    const fd = D().maps.find((m) => m.id === P().frontier());
    const forced = fd && fd.hero && fd.hero !== h && !P().mapRec(fd.id).cleared && P().heroesFor(fd.id).includes(fd.hero) ? fd : null;
    let action;
    const prev = joinPrev(hd);
    if (!open) {
      action = el('div', { class: 'hx-unlock' }, [deco(RG.art.icon('lock'), 'icon tiny'), prev
        ? el('span', {}, [el('b', { text: `${prev.id} ${prev.name}` }), `${josa(prev.name, '을', '를')} 깨면 ${hd.unlock}에서 합류합니다`])
        : el('span', {}, [el('b', { text: hd.unlock }), '에서 합류합니다'])]);
    }
    else if (isLead) action = el('span', { class: 'hx-lead-badge', tabindex: '-1' }, [deco(RG.art.icon('star'), 'icon tiny'), '출정 영웅']);
    else {
      action = el('button', {
        class: 'btn hx-lead',
        onclick: () => {
          P().get().lastHero = h; P().save(); UI.sfx('upgrade');
          UI.toast(`다음 출정은 ${hd.name}${josa(hd.name, '과', '와')} 함께!`, 'good');
          UI.show('heroes', { hero: h, focus: 'lead' });
        },
      }, [deco(RG.art.icon('star'), 'icon tiny'), '이 영웅으로 출정']);
    }
    const note = open
      ? el('p', { class: 'hx-note', text: forced ? `${forced.id}에서는 이야기에 따라 ${D().heroes[forced.hero].name}${josa(D().heroes[forced.hero].name, '이', '가')} 먼저 함께합니다 · 출정 준비에서 바꿀 수 있어요` : '전투에는 영웅 한 명이 함께합니다 · 출정 준비에서도 바꿀 수 있어요' })
      : null;
    const plate = el('div', { class: 'hx-plate' }, [
      el('div', { class: 'hx-name' }, [el('h3', { text: open ? hd.name : '???' }), el('span', { class: 'hx-title', text: hd.title })]),
      el('div', { class: 'hx-tags' }, [UI.elementBadge(hd.element), ...(open ? roleChips(hd) : []).map((c) => el('span', { class: 'hx-chip', text: c }))]),
      el('div', { class: 'hx-act' }, [action]),
      note,
    ]);
    stage.append(wrap, plate);
    return stage;
  }

  /** 영웅 특징 칩 — 능력치 막대에 없는 것만 (공중 공격 여부, 범위·연쇄·치명) */
  function roleChips(hd) {
    const out = [hd.targets === 'both' ? '지상·공중 공격' : '지상 적만 공격'];
    if (hd.splash) out.push('주변까지 타격');
    if (hd.chain) out.push(`연쇄 ${hd.chain.count}명 더`);
    if (hd.crit) out.push(`치명타 ${Math.round(hd.crit.chance * 100)}%`);
    return out;
  }

  /** 오른쪽: 소개 · 능력치 막대 · 기술 · 패시브 · 대사 */
  function heroInfo(h, open) {
    const hd = D().heroes[h];
    const ec = D().elements[hd.element].color;
    const info = el('div', { class: `hx-info ${open ? '' : 'locked'}`, style: `--ec:${ec}` });
    const card = (kind, icon, name, desc, chips, cls) => el('div', { class: `hx-card ${cls}` }, [
      el('span', { class: 'hx-card-ico' }, [deco(RG.art.icon(icon), 'icon hx-ci')]),
      el('div', { class: 'hx-card-body' }, [
        el('span', { class: 'hx-kind', text: kind }),
        el('b', { text: name }),
        el('span', { class: 'hx-desc', text: desc }),
        chips.length ? el('div', { class: 'hx-mini' }, chips.map((c) => el('span', { text: c }))) : null,
      ]),
    ]);
    if (!open) {
      info.append(
        el('p', { class: 'hx-bio', text: '아직 만나지 못한 영웅입니다. 어떤 힘을 가졌는지는 합류하면 알 수 있어요.' }),
        heroStats(hd, false),
        card('기술', 'lock', '???', '합류하면 볼 수 있습니다.', [], 'hx-skill locked'),
        card('패시브', 'lock', '???', '합류하면 볼 수 있습니다.', [], 'hx-passive locked'),
      );
      return info;
    }
    // 소개 / 성장 탭
    const tabs = el('div', { class: 'hx-tabs', role: 'tablist' }, [['info', '소개'], ['grow', '성장']].map(([id, name]) => el('button', {
      class: `hx-tab ${heroTab === id ? 'on' : ''}`, role: 'tab', 'aria-selected': heroTab === id ? 'true' : 'false', 'data-focus': `tab-${id}`,
      onclick: () => { if (heroTab !== id) { UI.sfx('click'); heroTab = id; UI.show('heroes', { hero: h, focus: `tab-${id}` }); } },
    }, [name, id === 'grow' ? el('small', { class: 'hx-tab-lv', text: `인연 Lv${P().bondOf(h).level}` }) : null])));
    info.appendChild(tabs);
    if (heroTab === 'grow') { info.appendChild(growthPanel(h)); return info; }
    // 대사: 말풍선이 돌려 보여 주는 인사말 말고, 상황별 한마디
    const said = [['기술을 쓸 때', hd.lines.skill], ['쓰러질 때', hd.lines.down], ['다시 일어날 때', hd.lines.revive], ['이겼을 때', hd.lines.win]]
      .filter(([, l]) => l && l.length).map(([when, l]) => el('div', { class: 'hx-line' }, [el('span', { class: 'hx-when', text: when }), el('q', { text: l[0] })]));
    info.append(
      el('p', { class: 'hx-bio', text: hd.bio }),
      heroStats(hd, true),
      card('기술', SKILL_ICON[hd.skill.id] || 'skill', hd.skill.name, hd.skill.desc, skillChips(hd.skill), 'hx-skill'),
      card('패시브', hd.element, hd.passive.name, hd.passive.desc, passiveChips(hd.passive), 'hx-passive'),
      el('div', { class: 'hx-sec' }, [el('span', { class: 'hx-kind', text: '대사' }), el('div', { class: 'hx-lines' }, said)]),
    );
    return info;
  }

  /* ---------- 성장: 인연 레벨 · 재능 나무 · 장신구 (docs/design/hero-growth.md) ---------- */
  function growthPanel(h) {
    const hd = D().heroes[h];
    const G = D().growth;
    const GW = RG.growth;
    const bond = P().bondOf(h);
    const talents = P().talentsOf(h);
    const pts = GW.points(bond.level);
    const left = pts - talents.length;
    const keep = (focus) => { const inf = document.querySelector('#screen-heroes .hx-info'); UI.show('heroes', { hero: h, focus, scroll: inf ? inf.scrollTop : 0 }); };
    const wrap = el('div', { class: 'gr-panel' });

    // 인연
    wrap.appendChild(el('div', { class: 'gr-bond' }, [
      el('div', { class: 'gr-bond-lv' }, [el('small', { text: '인연' }), el('b', { text: `Lv ${bond.level}` })]),
      el('div', { class: 'gr-bond-mid' }, [
        el('div', { class: 'gr-bond-bar', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(bond.need || 1), 'aria-valuenow': String(bond.max ? 1 : bond.into) }, [el('i', { style: `width:${bond.max ? 100 : Math.round((bond.into / bond.need) * 100)}%` })]),
        el('span', { class: 'gr-bond-txt', text: bond.max ? '인연 최고 레벨!' : `다음 레벨까지 ${bond.need - bond.into} (판을 끝내면 승리 3 · 새 별마다 2 · 패배 1)` }),
      ]),
    ]));

    // 재능
    const resetBtn = el('button', {
      class: 'btn small gr-reset', 'data-focus': 'reset', disabled: talents.length ? null : '',
      onclick: () => { UI.sfx('click'); P().resetTalents(h); keep('reset'); },
    }, ['초기화']);
    wrap.appendChild(el('div', { class: 'gr-head' }, [el('span', { class: 'hx-kind', text: '재능' }), el('span', { class: `gr-pts ${left > 0 ? 'has' : ''}`, text: `남은 점수 ${left} / ${pts}` }), resetBtn]));
    const tree = el('div', { class: 'gr-tree' });
    for (const b of G.branches) {
      const col = el('div', { class: `gr-col gr-${b.key}` }, [el('div', { class: 'gr-col-h' }, [deco(RG.art.icon(b.icon), 'icon tiny'), b.name])]);
      for (const id of GW.branchIds(h, b.key)) {
        const n = GW.node(h, id);
        const taken = talents.includes(id);
        const can = !taken && GW.canTake(h, talents, id, bond.level).ok;
        col.appendChild(el('button', {
          class: `gr-node ${taken ? 'on' : ''} ${can ? 'can' : ''} ${n.unique ? 'uniq' : ''}`, 'data-focus': `t-${id}`,
          'aria-pressed': taken ? 'true' : 'false', 'aria-label': `${n.name}: ${n.desc}${taken ? ' · 찍음' : can ? ' · 찍을 수 있음' : ''}`,
          onclick: () => {
            if (taken) return;
            const r = P().takeTalent(h, id);
            if (!r.ok) { UI.sfx('error'); UI.toast(r.reason, 'warn'); return; }
            UI.sfx('upgrade');
            keep(`t-${id}`);
          },
        }, [el('b', { text: n.name }), el('span', { text: n.desc }), n.unique ? el('em', { text: `${hd.name}만의 재능` }) : null]));
      }
      tree.appendChild(col);
    }
    wrap.appendChild(tree);

    // 장신구
    const owned = P().ownedGear();
    const rec = P().heroRec(h);
    const crystals = P().gachaState().crystals;
    wrap.appendChild(el('div', { class: 'gr-head' }, [el('span', { class: 'hx-kind', text: '장신구' }), el('span', { class: 'gr-pts', text: `공명석 ${crystals}` })]));
    const slots = el('div', { class: 'gr-slots' });
    [0, 1].forEach((i) => {
      const id = rec.gear[i] && rec.gear[i] in owned ? rec.gear[i] : null;
      const gd = id ? G.gear[id] : null;
      slots.appendChild(el('button', {
        class: `gr-slot ${gearSlot === i ? 'sel' : ''} ${id ? `r-${gd.rarity}` : 'empty'}`, 'data-focus': `slot-${i}`,
        'aria-label': id ? `${i + 1}번 칸: ${gd.name} — 누르면 빼기` : `${i + 1}번 칸: 비어 있음 — 아래에서 장신구를 고르면 여기에 낍니다`,
        onclick: () => {
          UI.sfx('click');
          if (id) { P().equipGear(h, i, null); gearSlot = i; } else gearSlot = i;
          keep(`slot-${i}`);
        },
      }, id ? [deco(RG.art.gearIcon(id), 'gr-ico'), el('div', { class: 'gr-slot-t' }, [el('b', { text: `${gd.name}${owned[id] ? ` +${owned[id]}` : ''}` }), el('span', { text: GW.gearText(id, owned[id], hd.element) }), gd.element === hd.element ? el('em', { text: '같은 원소 +25%' }) : null])]
        : [el('span', { class: 'gr-slot-plus', text: '+' }), el('div', { class: 'gr-slot-t' }, [el('b', { text: '빈 칸' }), el('span', { text: '아래 장신구를 누르면 낍니다' })])]));
    });
    wrap.appendChild(slots);
    const ids = G.gearOrder.filter((id) => id in owned);
    if (!ids.length) {
      wrap.appendChild(el('p', { class: 'gr-empty', text: '아직 장신구가 없습니다. 도전 모드를 처음 깨거나 무한 모드에서 10·20·30·40웨이브를 처음 넘기면 얻습니다.' }));
    } else {
      const inv = el('div', { class: 'gr-inv' });
      for (const id of ids) {
        const gd = G.gear[id];
        const plus = owned[id];
        const on = rec.gear.indexOf(id);
        const cost = GW.upgradeCost(id, plus);
        inv.appendChild(el('div', { class: `gr-item r-${gd.rarity} ${on >= 0 ? 'worn' : ''}` }, [
          el('button', {
            class: 'gr-item-main', 'data-focus': `g-${id}`,
            'aria-label': `${gd.name} ${G.gearRarities[gd.rarity].name}${plus ? ` +${plus}` : ''}: ${GW.gearText(id, plus, hd.element)}${on >= 0 ? ' · 끼는 중(누르면 빼기)' : ''}`,
            onclick: () => {
              UI.sfx('click');
              if (on >= 0) P().equipGear(h, on, null);
              else {
                const slot = rec.gear[gearSlot] ? (rec.gear[1 - gearSlot] ? gearSlot : 1 - gearSlot) : gearSlot;
                P().equipGear(h, slot, id);
              }
              keep(`g-${id}`);
            },
          }, [
            deco(RG.art.gearIcon(id), 'gr-ico'),
            el('div', { class: 'gr-item-t' }, [
              el('b', { text: `${gd.name}${plus ? ` +${plus}` : ''}` }),
              el('small', { class: 'gr-rar', text: `${G.gearRarities[gd.rarity].name} · ${D().elements[gd.element].name}` }),
              el('span', { text: GW.gearText(id, plus, hd.element) }),
            ]),
            on >= 0 ? el('i', { class: 'gr-worn', text: '끼는 중' }) : null,
          ]),
          el('button', {
            class: 'btn small gr-up', 'data-focus': `up-${id}`, disabled: cost == null || crystals < cost ? '' : null,
            'aria-label': cost == null ? `${gd.name} 최대 강화` : `${gd.name} 강화 — 공명석 ${cost}`,
            onclick: () => {
              const r = P().upgradeGear(id);
              if (!r.ok) { UI.sfx('error'); UI.toast(r.reason, 'warn'); return; }
              UI.sfx('upgrade');
              UI.toast(`${gd.name} +${r.plus}!`, 'good');
              keep(`up-${id}`);
            },
          }, cost == null ? ['최대'] : [deco(RG.art.icon('upgrade'), 'icon tiny'), String(cost)]),
        ]));
      }
      wrap.appendChild(inv);
    }
    wrap.appendChild(el('p', { class: 'gr-note', text: '재능과 장신구는 다음 출정부터 적용됩니다 · 도전 모드에서는 쓰이지 않습니다 · 같은 장신구를 여러 영웅이 함께 낄 수 있어요' }));
    return wrap;
  }

  /** 능력치 막대: 영웅 여섯 중 가장 높은 값을 가득으로 (레벨 1 기준) */
  function heroStats(hd, open) {
    const all = D().heroOrder.map((k) => D().heroes[k]);
    const max = (f) => Math.max(...all.map(f));
    const dps = (x) => x.damage / x.interval;
    const reach = (x) => (x.melee ? 0.75 : x.range);
    const rows = [
      ['hp', '체력', hd.hp / max((x) => x.hp), String(hd.hp), ''],
      ['damage', '초당 피해', dps(hd) / max(dps), String(Math.round(dps(hd))), `한 번에 ${hd.damage} · ${hd.interval}초마다`],
      ['range', '사거리', reach(hd) / max(reach), hd.melee ? '근접' : `${hd.range}칸`, ''],
      ['speed', '이동 속도', hd.speed / max((x) => x.speed), `${hd.speed}칸/초`, ''],
      ['armor', '갑옷', (hd.armor || 0) / max((x) => x.armor || 0), `${Math.round((hd.armor || 0) * 100)}%`, '받는 피해를 이만큼 줄임'],
      ['hero', '붙잡기', (hd.block || 0) / max((x) => x.block || 0), hd.block ? `${hd.block}명` : '없음', '한 번에 막아 세우는 적 수'],
    ];
    const maxLv = D().heroXp ? D().heroXp.length : 5;
    return el('div', { class: 'hx-stats' }, [
      ...rows.map(([ic, name, k, val, tip]) => el('div', { class: 'hx-stat', title: open && tip ? tip : null }, [
        deco(RG.art.icon(ic), 'icon hx-si'),
        el('span', { class: 'hx-sn', text: name }),
        el('span', { class: 'hx-bar' }, [el('i', { style: `width:${open && k > 0 ? Math.max(4, Math.round(k * 100)) : 0}%` })]),
        el('b', { text: open ? val : '?' }),
      ])),
      open ? el('p', { class: 'hx-cap', text: `레벨 1 기준 · 막대는 영웅 ${all.length}명 중 비교 · 전투에서 적을 물리치면 Lv${maxLv}까지 레벨마다 +${Math.round(D().heroLevelBonus.stat * 100)}%` }) : null,
    ]);
  }
  function skillChips(s) {
    const c = [];
    if (SKILL_TARGET[s.target]) c.push(SKILL_TARGET[s.target]);
    if (SKILL_HITS[s.id]) c.push(SKILL_HITS[s.id]);
    c.push(`재사용 대기 ${s.cooldown}초`);
    if (s.delay) c.push(`${s.delay}초 뒤 떨어짐`);
    if (s.radius) c.push(`반경 ${s.radius}칸`);
    if (s.damage) c.push(`피해 ${s.damage}`);
    if (s.heal) c.push(`회복 ${s.heal}`);
    if (s.burn) c.push(`화상 초당 ${s.burn.dps} · ${s.burn.dur}초`);
    if (s.freeze) c.push(`빙결 ${s.freeze}초`);
    if (s.blind) c.push(`실명 ${s.blind}초`);
    if (s.duration) c.push(`${s.duration}초 동안`);
    if (s.drone) c.push(`번개 ${s.drone.damage} · ${s.drone.interval}초마다`, `사거리 ${s.drone.range}칸`, `연쇄 ${s.drone.chain.count}명 더`);
    if (s.wallHp) c.push(`벽 체력 ${s.wallHp}`);
    if (s.execute) c.push(`체력 ${Math.round(s.execute * 100)}% 이하 즉시 처치`);
    if (s.bossMult) c.push(`보스 피해 ${s.bossMult}배`);
    return c;
  }
  /** 패시브 칩은 설명에 없는 숫자만 */
  function passiveChips(p) {
    const c = [];
    if (p.critMult) c.push(`치명타 피해 ${p.critMult}배`);
    if (p.radius) c.push(`주변 ${p.radius}칸 탑`);
    if (p.every) c.push(`${p.every}번째 공격마다`);
    if (p.damage) c.push(`번개 피해 ${p.damage}`);
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
