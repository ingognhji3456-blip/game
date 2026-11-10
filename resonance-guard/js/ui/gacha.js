'use strict';

/* =========================================================
 * 탑 뽑기 화면 — 공명석으로 탑을 뽑고, 중복은 강화. 규칙: js/core/gacha.js
 * 왼쪽: 울림 제단(뽑기 버튼·확률·천장) / 오른쪽: 내 탑 모음(등급별, 강화 단계)
 * 탑은 세 상태: 가짐 · 뽑기에 들어 있음(아직 없음) · 잠김(그 탑이 처음 나오는 스테이지가 열리면 뽑기에 들어옴)
 * 뽑으면 카드가 뒤집히며 하나씩 드러남(누르면 바로, "모두 열기"로 한꺼번에)
 * ========================================================= */
(() => {
  const { el } = RG.util;
  const UI = RG.ui;
  const D = () => RG.data;
  const P = () => RG.progress;
  const G = () => RG.gacha;

  let back = null;
  let revealTimers = [];

  function clearTimers() { revealTimers.forEach(clearTimeout); revealTimers = []; }

  function rarityBadge(r) {
    const R = G().RARITIES[r];
    return el('span', { class: `rar-badge rar-${r}`, text: R.name });
  }

  /** 강화 단계 점 5개 */
  function pips(rank) {
    const box = el('span', { class: 'rank-pips', 'aria-label': `강화 +${Math.max(0, rank)}` });
    for (let i = 1; i <= G().MAX_RANK; i++) box.appendChild(el('i', { class: i <= rank ? 'on' : '' }));
    return box;
  }

  UI.register('gacha', {
    leave() { clearTimers(); },
    enter(sec, data) {
      UI.music('worldmap');
      clearTimers();
      if (data && data.back) back = data.back;
      else if (!data || !data.keepBack) back = null;
      sec.innerHTML = '';
      const g = P().gachaState();
      const goBack = () => { const b = back; back = null; if (b) UI.show(b.screen, b.data || {}); else UI.show(P().hasSave() ? 'world' : 'title', {}); };

      const head = el('header', { class: 'top-bar' }, [
        el('button', { class: 'icon-btn', title: '돌아가기', 'aria-label': '돌아가기', onclick: goBack }, [UI.icon('back')]),
        el('h2', { text: '탑 뽑기' }),
        el('div', { class: 'gc-wallet' }, [
          el('span', { class: 'gc-coin', title: '공명석 — 맵을 클리어하고 별을 얻으면 모입니다' }, [UI.icon('crystal'), el('b', { text: g.crystals.toLocaleString() })]),
        ]),
      ]);

      /* ---------- 제단 ---------- */
      const C = G().COST;
      const doPull = (kind) => {
        const res = P().pullGacha(kind);
        if (!res.ok) { UI.toast(res.reason, 'warn'); UI.sfx('error'); return; }
        UI.sfx('click');
        reveal(sec, res.results, () => UI.show('gacha', { keepBack: true }));
      };
      const pullBtn = (kind, label, sub, enabled, cls = '') => el('button', { class: `btn gc-pull ${cls}`, disabled: !enabled, onclick: () => doPull(kind) }, [el('b', { text: label }), el('span', { class: 'gc-cost' }, sub)]);
      const pool = P().gachaPool();
      const rates = G().ratesFor(pool);
      const toEpic = Math.max(1, G().PITY - (g.pity || 0));
      const firstEpic = D().towerOrder.filter((t) => G().rarityOf(t) === 'epic').map((t) => D().towers[t].unlock).sort((a, b) => P().mapIndex(a) - P().mapIndex(b))[0];
      const nextLocked = D().towerOrder.filter((t) => !pool.includes(t)).map((t) => D().towers[t].unlock).sort((a, b) => P().mapIndex(a) - P().mapIndex(b))[0];
      const altar = el('div', { class: 'gc-altar' }, [
        el('div', { class: 'gc-shrine', 'aria-hidden': 'true' }, [
          el('div', { class: 'gc-rays' }),
          el('div', { class: 'gc-ring r1' }), el('div', { class: 'gc-ring r2' }),
          UI.svgImg(RG.art.icon('crystal'), 'gc-core', ''),
          el('div', { class: 'gc-orbit' }, D().elementOrder.map((e, i) => (RG.art.elementGem ? UI.svgImg(RG.art.elementGem(e), `gc-gem g${i}`, '') : UI.icon(e, `gc-gem g${i}`)))),
        ]),
        el('div', { class: 'gc-buttons' }, [
          pullBtn('one', '1회 뽑기', [UI.icon('crystal', 'tiny'), String(C.one)], g.crystals >= C.one),
          pullBtn('ten', '10회 뽑기', [UI.icon('crystal', 'tiny'), String(C.ten), el('small', { text: rates.rare || rates.epic ? ' 희귀 이상 1개 확정' : '' })], g.crystals >= C.ten, 'gc-ten'),
        ]),
        el('div', { class: 'gc-rules' }, [
          el('p', { class: 'gc-pool' }, ['뽑기에 든 탑 ', el('b', { text: `${pool.length}종` }), ` / ${D().towerOrder.length}`, nextLocked ? el('span', { class: 'dim', text: ` · 다음 탑은 ${nextLocked} 스테이지가 열리면 들어옴` }) : null]),
          el('div', { class: 'gc-rates' }, ['common', 'rare', 'epic'].map((r) => el('span', { class: rates[r] ? '' : 'off' }, [rarityBadge(r), ` ${rates[r] ? `${Math.round(rates[r] * 1000) / 10}%` : '아직 없음'}`]))),
          rates.epic ? el('p', {}, [`영웅 등급 확정까지 `, el('b', { text: `${toEpic}회` })]) : el('p', { class: 'dim', text: `영웅 등급 탑은 ${firstEpic} 스테이지가 열리면 뽑기에 들어옵니다.` }),
          el('p', { class: 'dim', text: `같은 탑이 또 나오면 그 탑이 강화됩니다(최대 +${G().MAX_RANK}, 단계마다 +${Math.round(G().RANK_PCT * 100)}%). +${G().MAX_RANK}에서 또 나오면 공명석 ${G().REFUND}을 돌려받습니다.` }),
          el('p', { class: 'dim', text: `공명석은 맵 첫 클리어 ${G().REWARD.firstClear}, 새 별마다 ${G().REWARD.perStar}, 승리 ${G().REWARD.win}로 모입니다. 스테이지가 열리면 그 스테이지의 새 탑이 뽑기에 들어옵니다(바로 주지는 않습니다).` }),
        ]),
      ]);

      /* ---------- 내 탑 모음 ---------- */
      const coll = el('div', { class: 'gc-collection' });
      const owned = P().ownedTowers().length;
      coll.appendChild(el('div', { class: 'gc-coll-head' }, [el('b', { text: '내 탑' }), el('span', { class: 'dim', text: ` ${owned}/${D().towerOrder.length}` })]));
      for (const r of ['epic', 'rare', 'common']) {
        const list = D().towerOrder.filter((t) => G().rarityOf(t) === r);
        const grid = el('div', { class: 'gc-grid' });
        for (const t of list) {
          const has = P().ownsTower(t);
          const open = pool.includes(t);
          const rank = P().towerRank(t);
          const td = D().towers[t];
          const state = has ? 'owned' : open ? 'missing' : 'locked';
          const card = el('div', { class: `gc-card rar-${r} el-${td.element} ${state}`, tabindex: '0', 'aria-label': `${has || open ? td.name : '잠긴 탑'} ${has ? `강화 +${rank}` : open ? '뽑기에서 나올 수 있음' : `${td.unlock} 스테이지가 열리면 뽑기에 들어옴`}` }, [
            UI.towerImg(t, has ? Math.min(3, 1 + Math.floor(rank / 2)) : 1, null, 'gc-img'),
            el('span', { class: 'gc-name', text: has || open ? td.name : '???' }),
            has ? pips(rank) : open ? el('span', { class: 'gc-q in', text: '뽑기에 있음' }) : el('span', { class: 'gc-q' }, [UI.icon('lock', 'tiny'), ` ${td.unlock}`]),
            has && rank > 0 ? el('em', { class: 'gc-rank', text: `+${rank}` }) : null,
          ]);
          UI.tooltipFor(card, () => (has || open ? `<b>${td.name}</b> <span style="color:${G().RARITIES[r].color}">${G().RARITIES[r].name}</span><br>${td.desc}<br>` : `<b>잠긴 탑</b> <span style="color:${G().RARITIES[r].color}">${G().RARITIES[r].name}</span><br>`)
            + (has ? (rank > 0 ? `<span class="good">강화 +${rank}: ${UI.rankText(t, rank)}</span>` : '강화 +0') : open ? '<span class="dim">뽑기에서 나올 수 있습니다</span>' : `<span class="dim">${td.unlock} 스테이지가 열리면 뽑기에 들어옵니다</span>`));
          grid.appendChild(card);
        }
        coll.appendChild(el('div', { class: 'gc-sec' }, [el('div', { class: 'gc-sec-title' }, [rarityBadge(r), el('span', { class: 'dim', text: ` 가짐 ${list.filter((t) => P().ownsTower(t)).length} · 뽑기에 ${list.filter((t) => pool.includes(t)).length} / ${list.length}` })]), grid]));
      }

      sec.append(head, el('div', { class: 'gc-body' }, [altar, coll]));
    },
  });

  /* ---------- 뽑기 결과: 카드 뒤집기 ---------- */
  function reveal(sec, results, done) {
    clearTimers();
    const best = results.some((r) => r.rarity === 'epic') ? 'epic' : results.some((r) => r.rarity === 'rare') ? 'rare' : 'common';
    const ov = el('div', { class: `gc-reveal best-${best} n${results.length > 1 ? 'many' : 'one'}`, role: 'dialog', 'aria-label': '뽑기 결과' });
    const flash = el('div', { class: 'gc-flash' });
    const row = el('div', { class: 'gc-rcards' });
    const cards = results.map((r, i) => {
      const td = D().towers[r.type];
      const tag = r.isNew ? el('em', { class: 'gc-tag new', text: 'NEW!' }) : r.refund ? el('em', { class: 'gc-tag refund' }, [UI.icon('crystal', 'tiny'), `+${r.refund}`]) : el('em', { class: 'gc-tag up', text: `강화 +${r.rank}` });
      const card = el('button', { class: `gc-rcard rar-${r.rarity}`, style: `--i:${i}`, 'aria-label': `${i + 1}번째 카드` }, [
        el('span', { class: 'gc-face back' }, [UI.svgImg(RG.art.icon('crystal'), 'gc-back-icon', '')]),
        el('span', { class: 'gc-face front' }, [
          rarityBadge(r.rarity),
          UI.towerImg(r.type, 1, null, 'gc-rimg'),
          el('b', { class: 'gc-rname', text: td.name }),
          tag,
        ]),
      ]);
      card.addEventListener('click', () => flip(card, r));
      return card;
    });
    cards.forEach((c) => row.appendChild(c));
    const skip = el('button', { class: 'btn gc-skip', onclick: () => cards.forEach((c, i) => flip(c, results[i])) }, ['모두 열기']);
    const ok = el('button', { class: 'btn btn-primary gc-ok hidden', onclick: () => { clearTimers(); ov.remove(); done(); } }, ['확인']);
    const summary = el('div', { class: 'gc-summary' });
    ov.append(flash, el('div', { class: 'gc-rtitle', text: results.length > 1 ? `${results.length}회 뽑기` : '뽑기' }), row, summary, el('div', { class: 'gc-rbtns' }, [skip, ok]));
    sec.appendChild(ov);
    let opened = 0;
    function flip(card, r) {
      if (card.classList.contains('open')) return;
      card.classList.add('open');
      opened++;
      UI.sfx(r.rarity === 'epic' ? 'unlock' : r.isNew ? 'star' : r.rarity === 'rare' ? 'upgrade' : 'build', { vol: 0.6 });
      if (r.rarity === 'epic') { flash.classList.remove('go'); void flash.offsetWidth; flash.classList.add('go'); }
      if (opened === cards.length) finish();
    }
    function finish() {
      skip.classList.add('hidden');
      ok.classList.remove('hidden');
      const nNew = results.filter((r) => r.isNew).length;
      const nUp = results.filter((r) => !r.isNew && !r.refund).length;
      const ref = results.reduce((s, r) => s + r.refund, 0);
      summary.textContent = [nNew ? `새 탑 ${nNew}개` : '', nUp ? `강화 ${nUp}번` : '', ref ? `공명석 ${ref} 돌려받음` : ''].filter(Boolean).join(' · ');
      setTimeout(() => ok.focus(), 50);
    }
    // 하나씩 자동으로 (눌러서 먼저 열 수도 있음)
    const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    cards.forEach((c, i) => revealTimers.push(setTimeout(() => flip(c, results[i]), (reduce ? 120 : 520) + i * (reduce ? 60 : 230))));
  }
})();
