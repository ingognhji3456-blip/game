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

  function towerUnlocked(t) {
    const u = D().towers[t].unlock;
    const i = P().mapIndex(u);
    if (i < 0) return false;          // 아직 데이터가 없는 지역
    if (i === 0) return true;
    return P().mapRec(D().maps[i - 1].id).cleared;
  }

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
  UI.register('heroes', {
    enter(sec, data) {
      if (data.hero) heroSel = data.hero;
      sec.innerHTML = '';
      const unlocked = P().heroesFor(P().frontier());
      const list = el('div', { class: 'hero-list' });
      for (const h of D().heroOrder) {
        const open = unlocked.includes(h);
        list.appendChild(el('button', { class: `hl-item ${heroSel === h ? 'on' : ''} ${open ? '' : 'locked'}`, onclick: () => { if (open) { heroSel = h; UI.sfx('click'); UI.show('heroes', {}); } } }, [
          open ? UI.portrait(h, 'normal', 'hl-portrait') : el('span', { class: 'hp-q', text: '?' }),
          el('b', { text: open ? D().heroes[h].name : '???' }),
        ]));
      }
      const hd = D().heroes[heroSel];
      const open = unlocked.includes(heroSel);
      const detail = el('div', { class: 'hero-detail' });
      if (open) {
        const faces = el('div', { class: 'hd-faces' }, ['normal', 'happy', 'worried'].map((m) => UI.portrait(heroSel, m, 'hd-face')));
        detail.append(
          faces,
          el('h3', {}, [hd.name, el('small', { text: ` · ${hd.title}` })]),
          UI.elementBadge(hd.element),
          el('p', { text: hd.bio }),
          el('div', { class: 'stat-list' }, [
            row('hp', '체력', String(hd.hp)), row('damage', '공격', `${hd.damage} / ${hd.interval}초`), row('range', '사거리', hd.melee ? '근접' : `${hd.range}칸`),
            row('hero', '붙잡기', hd.block ? `${hd.block}명` : '없음'), row('speed', '이동', `${hd.speed}칸/초`), row('target', '대상', hd.targets === 'both' ? '지상·공중' : '지상'),
          ]),
          el('div', { class: 'skill-box' }, [el('b', { text: `기술 · ${hd.skill.name}` }), el('span', { text: hd.skill.desc }), el('small', { class: 'dim', text: `재사용 ${hd.skill.cooldown}초` })]),
          el('div', { class: 'skill-box' }, [el('b', { text: `패시브 · ${hd.passive.name}` }), el('span', { text: hd.passive.desc })]),
          el('div', { class: 'quotes' }, [...hd.lines.select, ...hd.lines.win].map((q) => el('q', { text: q }))),
        );
      } else detail.appendChild(el('p', { class: 'dim', text: `${hd.unlock}에서 만날 수 있습니다.` }));
      sec.append(topBar('수호대'), el('div', { class: 'heroes-body' }, [list, detail]));
    },
  });
  function row(ic, name, val) { return el('div', { class: 'stat-row' }, [UI.icon(ic, 'tiny'), el('span', { text: name }), el('b', { text: val })]); }

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
