'use strict';

/* =========================================================
 * 탑 뽑기 화면 — 공명석으로 탑을 뽑고, 중복은 강화. 규칙: js/core/gacha.js
 * 왼쪽: 울림 제단(뽑기 버튼·확률·천장) / 오른쪽: 내 탑 모음(등급별, 강화 단계)
 * 탑은 네 상태: 가짐 · 최종 강화(뽑기에서 빠짐) · 뽑기에 들어 있음(아직 없음) · 잠김(앞 지역을 깨면 한꺼번에 들어옴)
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

  /** 강화 단계 점 5개 (최종 강화면 금빛 '최종') */
  function pips(rank) {
    if (G().isFinal(rank)) return el('span', { class: 'rank-final', 'aria-label': '최종 강화' }, ['★ 최종']);
    const box = el('span', { class: 'rank-pips', 'aria-label': `강화 +${Math.max(0, rank)}` });
    for (let i = 1; i <= G().MAX_RANK; i++) box.appendChild(el('i', { class: i <= rank ? 'on' : '' }));
    return box;
  }
  /** 이 탑이 뽑기에 들어오는 조건 글 (앞 지역 이름) */
  function openText(t) {
    const r = P().towerRegion(t);
    const prev = D().regions[r - 2];
    return prev ? `${prev.name}${josa(prev.name, '을', '를')} 깨면 뽑기에 들어옵니다` : '처음부터 뽑기에 있습니다';
  }
  /** 잠긴 탑 카드의 짧은 글: '<앞 지역> 클리어' */
  function lockText(t) { const prev = D().regions[P().towerRegion(t) - 2]; return prev ? `${prev.name} 클리어` : ''; }
  const josa = (w, a, b) => { const c = w.charCodeAt(w.length - 1) - 0xac00; return c >= 0 && c <= 11171 && c % 28 ? a : b; };

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
        if (sec.querySelector('.gc-reveal')) return; // 결과 창이 떠 있는 동안 (Enter를 한 번 더 눌러도) 또 뽑지 않음
        const res = P().pullGacha(kind);
        if (!res.ok) { UI.toast(res.reason, 'warn'); UI.sfx('error'); return; }
        UI.sfx('click');
        if (res.returned) UI.toast(`뽑을 탑이 다 떨어져 공명석 ${res.returned}을 돌려받았습니다`, 'good');
        reveal(sec, res.results, () => UI.show('gacha', { keepBack: true }));
      };
      const pullBtn = (kind, label, sub, enabled, cls = '') => el('button', { class: `btn gc-pull ${cls}`, disabled: !enabled, onclick: () => doPull(kind) }, [el('b', { text: label }), el('span', { class: 'gc-cost' }, sub)]);
      const pool = P().gachaPool();
      const rates = G().ratesFor(pool);
      const toEpic = Math.max(1, G().PITY - (g.pity || 0));
      const toLegend = Math.max(1, G().PITY_LEGEND - (g.pityL || 0));
      const legendLocked = D().towerOrder.filter((t) => G().TIER[G().rarityOf(t)] >= G().TIER.legendary && !P().towerOpen(t)).sort((a, b) => P().towerRegion(a) - P().towerRegion(b));
      // 아직 잠긴 탑 중 가장 먼저 열리는 지역 묶음
      const locked = D().towerOrder.filter((t) => !P().towerOpen(t));
      const nextR = locked.length ? Math.min(...locked.map((t) => P().towerRegion(t))) : 0;
      const nextBatch = locked.filter((t) => P().towerRegion(t) === nextR);
      const epicLocked = D().towerOrder.filter((t) => G().rarityOf(t) === 'epic' && !P().towerOpen(t)).sort((a, b) => P().towerRegion(a) - P().towerRegion(b)); // 가장 먼저 열리는 것부터
      const finals = D().towerOrder.filter((t) => P().towerFinal(t)).length;
      const empty = pool.length === 0;
      const altar = el('div', { class: 'gc-altar' }, [
        el('div', { class: 'gc-shrine', 'aria-hidden': 'true' }, [
          el('div', { class: 'gc-rays' }),
          el('div', { class: 'gc-ring r1' }), el('div', { class: 'gc-ring r2' }),
          UI.svgImg(RG.art.icon('crystal'), 'gc-core', ''),
          el('div', { class: 'gc-orbit' }, D().elementOrder.map((e, i) => (RG.art.elementGem ? UI.svgImg(RG.art.elementGem(e), `gc-gem g${i}`, '') : UI.icon(e, `gc-gem g${i}`)))),
        ]),
        el('div', { class: 'gc-buttons' }, [
          pullBtn('one', '1회 뽑기', [UI.icon('crystal', 'tiny'), String(C.one)], !empty && g.crystals >= C.one),
          pullBtn('ten', '10회 뽑기', [UI.icon('crystal', 'tiny'), String(C.ten), el('small', { text: rates.rare || rates.epic ? ' 희귀 이상 1개 확정' : '' })], !empty && g.crystals >= C.ten, 'gc-ten'),
          empty ? el('p', { class: 'gc-empty', text: nextBatch.length ? '지금 뽑기의 탑을 모두 최종 강화했어요! 다음 지역을 깨면 새 탑이 들어옵니다.' : '모든 탑을 최종 강화했어요! 전설의 수호자입니다.' }) : null,
        ]),
        el('div', { class: 'gc-rules' }, [
          el('p', { class: 'gc-pool' }, ['뽑기에 든 탑 ', el('b', { text: `${pool.length}종` }), ` / ${D().towerOrder.length}`, finals ? el('span', { class: 'gc-finals', text: ` · 최종 강화 ${finals}종(뽑기에서 빠짐)` }) : null,
            nextBatch.length ? el('span', { class: 'dim', text: ` · ${D().regions[nextR - 2].name}${josa(D().regions[nextR - 2].name, '을', '를')} 깨면 새 탑 ${nextBatch.length}종이 한꺼번에 들어옴` }) : null]),
          el('div', { class: 'gc-rates' }, G().ORDER.map((r) => el('span', { class: rates[r] ? '' : 'off' }, [rarityBadge(r), ` ${rates[r] ? `${Math.round(rates[r] * 1000) / 10}%` : '아직 없음'}`]))),
          rates.epic ? el('p', {}, [`영웅 이상 확정까지 `, el('b', { text: `${toEpic}회` })]) : el('p', { class: 'dim', text: epicLocked.length ? `영웅 등급 탑은 ${openText(epicLocked[0]).replace('뽑기에 들어옵니다', '뽑기에 들어옵니다.')}` : '' }),
          rates.legendary || rates.mythic ? el('p', {}, [`전설 이상 확정까지 `, el('b', { class: 'gc-legend-pity', text: `${toLegend}회` })]) : el('p', { class: 'dim', text: legendLocked.length ? `전설·신화 탑은 ${openText(legendLocked[0]).replace('뽑기에 들어옵니다', '뽑기에 들어옵니다.')}` : '' }),
          el('p', { class: 'dim', text: `같은 탑이 또 나오면 그 탑이 강화됩니다(+1~+${G().MAX_RANK}, 단계마다 +${Math.round(G().RANK_PCT * 100)}%). +${G().MAX_RANK}에서 한 번 더 나오면 ★최종 강화(+${Math.round(G().FINAL_BONUS * 100)}%)가 되고, 그 탑은 뽑기에서 빠집니다. 최종 강화한 탑은 맵에 지을 때 같은 값으로 Lv2부터 지어집니다(강화는 도전 모드에서는 쓰지 않음).` }),
          el('p', { class: 'dim', text: `공명석은 맵 첫 클리어 ${G().REWARD.firstClear}, 새 별마다 ${G().REWARD.perStar}, 승리 ${G().REWARD.win}로 모입니다. 솔빛 들판의 탑은 처음부터 뽑기에 있고, 지역을 다 깨면 다음 지역의 탑이 한꺼번에 들어옵니다(바로 주지는 않습니다).` }),
        ]),
      ]);

      /* ---------- 내 탑 모음 ---------- */
      const coll = el('div', { class: 'gc-collection' });
      const owned = P().ownedTowers().length;
      coll.appendChild(el('div', { class: 'gc-coll-head' }, [el('b', { text: '내 탑' }), el('span', { class: 'dim', text: ` ${owned}/${D().towerOrder.length}` })]));
      for (const r of G().ORDER.slice().reverse()) {
        const list = D().towerOrder.filter((t) => G().rarityOf(t) === r);
        const grid = el('div', { class: 'gc-grid' });
        for (const t of list) {
          const has = P().ownsTower(t);
          const open = P().towerOpen(t);
          const rank = P().towerRank(t);
          const fin = has && G().isFinal(rank);
          const td = D().towers[t];
          const state = fin ? 'owned final' : has ? 'owned' : open ? 'missing' : 'locked';
          const rlabel = G().rankLabel(rank);
          const card = el('div', { class: `gc-card rar-${r} el-${td.element} ${state}`, tabindex: '0', 'aria-label': `${has || open ? td.name : '잠긴 탑'} ${fin ? '최종 강화 · 뽑기에서 빠짐' : has ? `강화 ${rlabel}` : open ? '뽑기에서 나올 수 있음' : openText(t)}` }, [
            UI.towerImg(t, fin ? 4 : has ? Math.min(3, 1 + Math.floor(rank / 2)) : 1, fin ? 'A' : null, 'gc-img'),
            el('span', { class: 'gc-name', text: has || open ? td.name : '???' }),
            has ? pips(rank) : open ? el('span', { class: 'gc-q in', text: '뽑기에 있음' }) : el('span', { class: 'gc-q' }, [UI.icon('lock', 'tiny'), ` ${lockText(t)}`]),
            has && rank > 0 ? el('em', { class: `gc-rank ${fin ? 'fin' : ''}`, text: fin ? '★' : `+${rank}` }) : null,
          ]);
          UI.tooltipFor(card, () => (has || open ? `<b>${td.name}</b> <span style="color:${G().RARITIES[r].color}">${G().RARITIES[r].name}</span><br>${td.desc}<br>` : `<b>잠긴 탑</b> <span style="color:${G().RARITIES[r].color}">${G().RARITIES[r].name}</span><br>`)
            + (fin ? `<span class="good">★ 최종 강화: ${UI.rankText(t, rank)}</span><br><span class="good">맵에 같은 값으로 Lv2부터 지어집니다</span><br><span class="dim">뽑기에서 더 나오지 않습니다</span>` : has ? (rank > 0 ? `<span class="good">강화 +${rank}: ${UI.rankText(t, rank)}</span>${rank === G().MAX_RANK ? '<br><span class="dim">한 번 더 뽑으면 최종 강화!</span>' : ''}` : '강화 +0') : open ? '<span class="dim">뽑기에서 나올 수 있습니다</span>' : `<span class="dim">${openText(t)}</span>`));
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
    const best = results.reduce((b, r) => (G().TIER[r.rarity] > G().TIER[b] ? r.rarity : b), 'common');
    const ov = el('div', { class: `gc-reveal best-${best} n${results.length > 1 ? 'many' : 'one'}`, role: 'dialog', 'aria-label': '뽑기 결과' });
    const flash = el('div', { class: 'gc-flash' });
    const row = el('div', { class: 'gc-rcards' });
    const cards = results.map((r, i) => {
      const td = D().towers[r.type];
      const tag = r.isNew ? el('em', { class: 'gc-tag new', text: 'NEW!' }) : r.isFinal ? el('em', { class: 'gc-tag final', text: '★ 최종 강화!' }) : r.refund ? el('em', { class: 'gc-tag refund' }, [UI.icon('crystal', 'tiny'), `+${r.refund}`]) : el('em', { class: 'gc-tag up', text: `강화 +${r.rank}` });
      const card = el('button', { class: `gc-rcard rar-${r.rarity} ${r.isFinal ? 'is-final' : ''}`, style: `--i:${i}`, 'aria-label': `${i + 1}번째 카드` }, [
        el('span', { class: 'gc-face back' }, [UI.svgImg(RG.art.icon('crystal'), 'gc-back-icon', '')]),
        el('span', { class: 'gc-face front' }, [
          rarityBadge(r.rarity),
          UI.towerImg(r.type, r.isFinal ? 4 : 1, r.isFinal ? 'A' : null, 'gc-rimg'),
          el('b', { class: 'gc-rname', text: td.name }),
          tag,
          r.isFinal ? el('small', { class: 'gc-rsub', text: '이제 Lv2부터 지어요' }) : null,
        ]),
      ]);
      card.addEventListener('click', () => flip(card, r));
      return card;
    });
    cards.forEach((c) => row.appendChild(c));
    const skip = el('button', { class: 'btn gc-skip', onclick: () => cards.forEach((c, i) => flip(c, results[i])) }, ['모두 열기']);
    const ok = el('button', { class: 'btn btn-primary gc-ok hidden', onclick: () => { clearTimers(); restore(); ov.remove(); done(); } }, ['확인']);
    const summary = el('div', { class: 'gc-summary' });
    ov.append(flash, el('div', { class: 'gc-rtitle', text: results.length > 1 ? `${results.length}회 뽑기` : '뽑기' }), row, summary, el('div', { class: 'gc-rbtns' }, [skip, ok]));
    sec.appendChild(ov);
    // 결과 창 뒤의 화면은 초점·누르기를 받지 않음, 초점은 "모두 열기"로. Esc: 처음엔 모두 열기, 다 열렸으면 확인
    const behind = [...sec.children].filter((x) => x !== ov);
    behind.forEach((x) => { x.inert = true; });
    const restore = () => behind.forEach((x) => { x.inert = false; });
    skip.focus({ preventScroll: true });
    ov.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      e.preventDefault(); e.stopPropagation();
      if (opened < cards.length) skip.click(); else ok.click();
    });
    let opened = 0;
    let lastFlash = -1e9;
    function flip(card, r) {
      if (card.classList.contains('open')) return;
      card.classList.add('open');
      opened++;
      const tier = G().TIER[r.rarity];
      UI.sfx(tier >= G().TIER.legendary ? 'win' : r.isFinal || tier === G().TIER.epic ? 'unlock' : r.isNew ? 'star' : r.rarity === 'rare' ? 'upgrade' : 'build', { vol: tier >= G().TIER.legendary ? 0.7 : 0.6 });
      // 화면 번쩍임: 0.4초에 한 번까지(광과민 기준 초당 3회 이하), 효과 줄이기면 카드마다 대신 마지막에 한 번만(가장 높은 등급)
      const now = performance.now();
      if ((tier >= G().TIER.epic || r.isFinal) && !UI.getSettings().reduceFx && now - lastFlash >= 400) { lastFlash = now; flash.className = `gc-flash fl-${r.rarity}`; void flash.offsetWidth; flash.classList.add('go'); }
      if (opened === cards.length) finish();
    }
    function finish() {
      if (UI.getSettings().reduceFx && G().TIER[best] >= G().TIER.epic) { flash.className = `gc-flash soft fl-${best}`; void flash.offsetWidth; flash.classList.add('go'); }
      skip.classList.add('hidden');
      ok.classList.remove('hidden');
      const nNew = results.filter((r) => r.isNew).length;
      const nFinal = results.filter((r) => r.isFinal).length;
      const nUp = results.filter((r) => !r.isNew && !r.refund && !r.isFinal).length;
      const ref = results.reduce((s, r) => s + r.refund, 0);
      summary.textContent = [nNew ? `새 탑 ${nNew}개` : '', nUp ? `강화 ${nUp}번` : '', nFinal ? `★ 최종 강화 ${nFinal}개 (뽑기에서 빠짐)` : '', ref ? `공명석 ${ref} 돌려받음` : ''].filter(Boolean).join(' · ');
      setTimeout(() => ok.focus(), 50);
    }
    // 하나씩 자동으로 (눌러서 먼저 열 수도 있음)
    const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    cards.forEach((c, i) => revealTimers.push(setTimeout(() => flip(c, results[i]), (reduce ? 120 : 520) + i * (reduce ? 60 : 230))));
  }
})();
