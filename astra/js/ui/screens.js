'use strict';

/* =========================================================
 * 화면(DOM) — 타이틀, 난이도, 작전 터미널, 장비, 스킬 트리, 보스 도감, 기억 기록,
 * 전투 기록, 설정, 결과, 실패, 엔딩/크레딧, 일시정지, 챕터 카드, 보스 등장 연출
 * ========================================================= */
window.AZ = window.AZ || {};
AZ.ui = AZ.ui || {};

AZ.ui.screens = (() => {
  const U = AZ.util;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const G = () => AZ.game;
  const D = () => AZ.data;
  const P = () => AZ.progress;
  const sfx = (n, o) => { if (AZ.audio) AZ.audio.sfx(n, o); };

  let host = null;
  let current = null;
  let screenEl = null;
  const iconCache = {};

  function init(stage) {
    host = document.createElement('div');
    host.className = 'screens';
    stage.appendChild(host);
    screenEl = document.createElement('div');
    screenEl.className = 'screen hidden';
    host.appendChild(screenEl);
    host.addEventListener('click', onClick);
    host.addEventListener('input', onInput);
    host.addEventListener('change', onInput);
    host.addEventListener('mouseover', (e) => {
      const b = e.target.closest('button:not([disabled]), .hov');
      if (b && b !== host._lastHover) { host._lastHover = b; sfx('ui', { vol: 0.15, pitch: 1.4 }); }
    });
  }

  /** 스킬 아이콘 → data URL */
  function iconURL(icon, color, size) {
    const key = icon + (color || '') + (size || 48);
    if (iconCache[key]) return iconCache[key];
    const s = size || 48;
    const c = document.createElement('canvas');
    c.width = s * 2;
    c.height = s * 2;
    const g = c.getContext('2d');
    g.scale(2, 2);
    AZ.gfx.render.drawIcon(g, icon, s / 2, s / 2, s * 0.62, color || '#e8f4ff');
    iconCache[key] = c.toDataURL();
    return iconCache[key];
  }

  function show(name, html, cls) {
    current = name;
    screenEl.className = `screen scr-${name} ${cls || ''}`;
    screenEl.innerHTML = html;
    screenEl.scrollTop = 0;
    host.classList.remove('hidden');
  }
  function hide() {
    current = null;
    screenEl.className = 'screen hidden';
    screenEl.innerHTML = '';
  }

  /* ───────── 공용 조각 ───────── */
  const topbar = (title, sub) => `
    <div class="topbar">
      <button class="btn ghost back" data-act="hub">◀ 작전 터미널</button>
      <div class="tb-title"><b>${esc(title)}</b><span>${esc(sub || '')}</span></div>
      <div class="tb-res">${resBadge()}</div>
    </div>`;
  function resBadge() {
    const s = G().save;
    if (!s) return '';
    return `<span class="res">Lv.<b>${s.level}</b></span><span class="res sp">SP <b>${s.sp}</b></span><span class="res cr">◈ <b>${s.credits.toLocaleString()}</b></span>`;
  }

  /* ───────── 타이틀 ───────── */
  function title() {
    menuTheme = 'ruins';
    const has = AZ.save.hasSave();
    show('title', `
      <div class="title-art" style="background-image:url(${D().assets.keyart})"></div>
      <div class="title-fade"></div>
      <div class="title-logo">
        <div class="logo-main">ASTRA</div>
        <div class="logo-sub">: ZERO PROTOCOL</div>
        <div class="logo-kr">아스트라 : 제로 프로토콜</div>
        <div class="logo-tag">모든 것이, 다시 시작되는 곳…</div>
      </div>
      <div class="title-menu">
        ${has ? '<button class="btn primary big" data-act="continue">이어하기</button>' : ''}
        <button class="btn ${has ? '' : 'primary'} big" data-act="newgame">새 게임</button>
        <button class="btn big" data-act="settings-title">설정</button>
        <button class="btn big ghost" data-act="howto">조작법</button>
      </div>
      <div class="title-foot">“이 세계의 진실, 그리고… 우리의 기억은?”<br><span>원작 기획: ASTRA : ZERO PROTOCOL 게임 기획 요약 · 모든 연출과 음악은 브라우저에서 실시간으로 그려지고 합성됩니다</span></div>`);
  }

  function howto(back) {
    show('howto', `
      <div class="panel howto">
        <h2>조작법</h2>
        <div class="howto-grid">
          <div><h3>키보드 · 마우스</h3>
            <table>
              <tr><td>이동</td><td><kbd>W A S D</kbd> / 방향키</td></tr>
              <tr><td>공격 (누르고 있으면 연속)</td><td><kbd>J</kbd> / 마우스 왼쪽</td></tr>
              <tr><td>강공격</td><td><kbd>K</kbd> / 마우스 오른쪽</td></tr>
              <tr><td>회피</td><td><kbd>Space</kbd> / <kbd>Shift</kbd></td></tr>
              <tr><td>스킬 1·2·3</td><td><kbd>U</kbd> <kbd>I</kbd> <kbd>O</kbd> (또는 <kbd>1</kbd><kbd>2</kbd><kbd>3</kbd>)</td></tr>
              <tr><td>궁극기</td><td><kbd>L</kbd> (또는 <kbd>4</kbd>)</td></tr>
              <tr><td>연계 공격</td><td><kbd>F</kbd></td></tr>
              <tr><td>전술 명령 분석·엄호·집중</td><td><kbd>Z</kbd> <kbd>X</kbd> <kbd>C</kbd></td></tr>
              <tr><td>일시정지</td><td><kbd>Esc</kbd> / <kbd>P</kbd></td></tr>
              <tr><td>대화 넘기기</td><td><kbd>Enter</kbd> / <kbd>Space</kbd> / 클릭</td></tr>
            </table>
          </div>
          <div><h3>게임패드 · 터치</h3>
            <table>
              <tr><td>게임패드</td><td>왼쪽 스틱 이동 · <b>X</b> 공격 · <b>Y</b> 강공격 · <b>A</b> 회피 · <b>B</b> 연계 · <b>LB/RB/LT</b> 스킬 · <b>RT</b> 궁극기 · <b>L3/R3/Select</b> 전술 명령</td></tr>
              <tr><td>터치</td><td>화면 왼쪽을 끌어 이동, 오른쪽 버튼으로 공격·회피·스킬. 가로 화면을 권장합니다.</td></tr>
            </table>
            <h3>전투의 핵심</h3>
            <ul>
              <li><b>ZERO FRAME</b> — 공격이 닿기 직전에 회피하면 발동. 적의 시간이 느려지고 모든 공격이 약점 공격이 됩니다. 직후 공격하면 <b>반격</b>.</li>
              <li><b>브레이크</b> — 강공격·스킬·약점 공격으로 보스의 노란 게이지를 깎으면 6초간 무방비. 이때 <b>연계 공격</b>이 공짜!</li>
              <li><b>약점</b> — 보스 발밑의 하늘색 호(등 뒤)나 "WEAK" 표시를 노리세요. <b>분석</b> 명령이 약점과 공격 방향을 보여 줍니다.</li>
              <li>붉은 경고 지역은 곧 공격이 떨어지는 곳. 흰색으로 바뀌면 직전입니다.</li>
            </ul>
          </div>
        </div>
        <div class="row center"><button class="btn primary" data-act="${back || 'title'}">돌아가기</button></div>
      </div>`);
  }

  /* ───────── 새 게임: 난이도 ───────── */
  function newGame() {
    const diffs = D().difficulties;
    show('newgame', `
      <div class="panel narrow">
        <h2>새 게임 — 난이도 선택</h2>
        <p class="muted">난이도는 작전 터미널의 설정에서 언제든 바꿀 수 있습니다.</p>
        <div class="diff-cards">
          ${Object.entries(diffs).map(([id, d]) => `
            <button class="diff-card ${id === 'normal' ? 'rec' : ''}" data-act="start-new" data-diff="${id}">
              <b>${esc(d.name)}</b><span>${esc(d.desc)}</span>${id === 'normal' ? '<em>권장</em>' : ''}
            </button>`).join('')}
        </div>
        ${AZ.save.hasSave() ? '<p class="warn">⚠ 새 게임을 시작하면 기존 저장 데이터가 지워집니다.</p>' : ''}
        <div class="row center"><button class="btn ghost" data-act="title">돌아가기</button></div>
      </div>`);
  }

  /* ───────── 작전 터미널 ───────── */
  let hubSel = null;
  let menuTheme = 'ruins';
  function hub(selChapter) {
    const s = G().save;
    const st = P().computeStats(s);
    const chs = D().chapters;
    if (selChapter != null) hubSel = selChapter;
    if (hubSel == null || hubSel > s.unlockedChapter) hubSel = Math.min(s.unlockedChapter, 10);
    menuTheme = chs[hubSel - 1].theme;
    const story = D().story || {};
    const line = pickHubLine(s);
    const expNeed = P().expToNext(s.level);
    const ch = chs[hubSel - 1];
    const boss = D().bosses[ch.boss];
    const cx = s.codex[ch.boss];
    const best = s.chapterBest[ch.id];
    const rec = (s.records[ch.boss] || [])[0];
    const memIds = (story.memories || []).filter((m) => m.chapter === ch.id).map((m) => m.id);
    const memGot = memIds.filter((id) => s.memories.includes(id)).length;
    const party = P().partyFor(s, ch.id);
    const map = AZ.gfx.render.can3d;
    const rw = [];
    if (!s.cleared[ch.id]) {
      if (ch.reward.weapon) rw.push(`무기 「${D().weapons[ch.reward.weapon].name}」`);
      for (const m of ch.reward.modules || []) rw.push(`모듈 「${D().modules[m].name}」`);
      if (ch.reward.choiceModule) rw.push('선택에 따른 모듈 1개');
      rw.push('SP +1');
    }
    show('hub', `
      <div class="hub-bg" style="background-image:url(${D().assets.keyart})"></div>
      <div class="hub">
        <div class="hub-left panel">
          <div class="hub-kai">
            <img src="${D().assets.kai}" alt="">
            <div>
              <b>카이온</b><span>전직 ASTRA 관리자</span>
              <div class="lv">Lv.${s.level}<small>${s.level >= P().MAX_LEVEL ? 'MAX' : `${s.exp} / ${expNeed}`}</small></div>
              <div class="xpbar"><i style="width:${s.level >= P().MAX_LEVEL ? 100 : Math.round(s.exp / expNeed * 100)}%"></i></div>
            </div>
          </div>
          <div class="statgrid">
            <div><span>체력</span><b>${st.maxHp}</b></div>
            <div><span>공격력</span><b>${Math.round(st.atk)}</b></div>
            <div><span>치명타</span><b>${Math.round(st.crit * 100)}%</b></div>
            <div><span>무기</span><b>${esc(st.weapon.name)} +${st.weaponLevel - 1}</b></div>
            <div><span>SP</span><b class="sp">${s.sp}</b></div>
            <div><span>크레딧</span><b class="cr">◈ ${s.credits.toLocaleString()}</b></div>
          </div>
          <div class="hub-menu">
            <button class="btn" data-act="loadout">⚔ 장비 · 모듈</button>
            <button class="btn ${s.sp > 0 ? 'notify' : ''}" data-act="skills">✦ 스킬 트리${s.sp > 0 ? ` <em>SP ${s.sp}</em>` : ''}</button>
            <button class="btn" data-act="codex">◉ 보스 도감</button>
            <button class="btn" data-act="memories">❖ 기억 기록 <em>${s.memories.length}/20</em></button>
            <button class="btn" data-act="records">⏱ 전투 기록 · 랭킹</button>
            <button class="btn" data-act="settings">⚙ 설정</button>
            <button class="btn ghost" data-act="howto-hub">? 조작법</button>
            <button class="btn ghost" data-act="title">타이틀로</button>
          </div>
        </div>
        <div class="hub-center ${map ? 'map' : ''}">
          <div class="hub-head"><b>${map ? '월드맵' : '작전 터미널'}</b><span>${esc(D().difficulties[s.difficulty].name)} · 플레이 ${U.fmtDuration(s.playTime)}${s.endings.length ? ` · 엔딩 ${s.endings.length}/3` : ''}</span></div>
          ${map ? `<div class="world-map">
            ${chs.map((c) => {
              const st = wmState(s, c.id);
              const r = (s.records[c.boss] || [])[0];
              const mp = D().maps && D().maps[c.theme];
              return `<button class="wm-node ${st} ${c.id === hubSel ? 'sel' : ''}" ${st === 'locked' ? 'disabled' : ''} data-act="sel-ch" data-ch="${c.id}" aria-label="챕터 ${c.id}">
                <i>${st === 'locked' ? '🔒' : String(c.id).padStart(2, '0')}</i>
                <span>${st === 'locked' ? '미개방 지역' : `${esc(c.name)}${c.id === hubSel && mp ? `<small>${esc(mp.name)}</small>` : ''}`}</span>
                ${st === 'cleared' ? `<em class="r${r ? r.rank : ''}">${r ? r.rank : '✓'}</em>` : st === 'open' ? '<em class="new">NEW</em>' : ''}
              </button>`;
            }).join('')}
            <div class="wm-hint">섬을 고르면 지역 정보가 열립니다 · ← → 로 이동</div>
          </div>` : `<div class="chapter-list">
            ${chs.map((c) => {
              const locked = c.id > s.unlockedChapter;
              const cleared = !!s.cleared[c.id];
              const r = (s.records[c.boss] || [])[0];
              return `<button class="ch-item ${locked ? 'locked' : ''} ${cleared ? 'cleared' : ''} ${c.id === hubSel ? 'sel' : ''}" ${locked ? 'disabled' : ''} data-act="sel-ch" data-ch="${c.id}">
                <span class="ch-no">${String(c.id).padStart(2, '0')}</span>
                <span class="ch-name">${locked ? '???' : esc(c.name)}</span>
                ${cleared ? `<span class="ch-rank r${r ? r.rank : ''}">${r ? r.rank : '✓'}</span>` : locked ? '<span class="ch-lock">🔒</span>' : '<span class="ch-new">NEW</span>'}
              </button>`;
            }).join('')}
          </div>`}
        </div>
        <div class="hub-right panel">
          <div class="ch-detail">
            <div class="cd-head"><span>CHAPTER ${ch.id}</span><b>${esc(ch.name)}</b></div>
            <p class="cd-sum">${esc((story.chapterSummaries || {})[ch.id] || '')}</p>
            ${D().maps && D().maps[ch.theme] ? `<div class="cd-map"><b>맵 · ${esc(D().maps[ch.theme].name)}</b>${D().maps[ch.theme].tags.slice(0, 2).map((t) => `<span>${esc(t)}</span>`).join('')}</div>` : ''}
            <div class="cd-boss">
              <img src="${D().assets['boss_' + ch.boss]}" alt="" class="${cx && cx.seen ? '' : 'unknown'}">
              <div><span>목표</span><b>${cx && cx.seen ? esc(boss.name) : '???'}</b><small>${cx && cx.seen ? esc(boss.title) : '미확인 개체'}</small></div>
            </div>
            <ul class="cd-info">
              <li><span>파티</span><b>카이온${party.lia ? ' · 리아' : ''}${party.zero ? ' · 제로' : ''}</b></li>
              <li><span>보스 최고 기록</span><b>${rec ? `${U.fmtTime(rec.time)} (${rec.rank})` : '—'}</b></li>
              <li><span>챕터 최고 기록</span><b>${best ? U.fmtTime(best) : '—'}</b></li>
              <li><span>기억 파편</span><b>${memGot} / ${memIds.length || 2}</b></li>
              <li><span>도전 과제</span><b class="${cx && s.memories.includes(memIds[1]) ? 'ok' : ''}">${esc(ch.challenge.desc)}</b></li>
              ${rw.length ? `<li><span>첫 클리어 보상</span><b>${rw.map(esc).join(', ')}</b></li>` : ''}
            </ul>
            <div class="cd-actions">
              <button class="btn primary big" data-act="sortie" data-ch="${ch.id}">출격 ▶</button>
              ${s.cleared[ch.id] ? `<button class="btn" data-act="boss-only" data-ch="${ch.id}">보스전만</button>` : ''}
            </div>
          </div>
        </div>
        <div class="hub-lia">
          ${line.who === 'system' ? '<div class="sys-badge">SYS</div>' : `<img src="${D().assets[line.who === 'zero' ? 'zero' : 'lia']}" alt="">`}
          <div><b>${line.who === 'zero' ? '제로' : line.who === 'system' ? 'SYSTEM' : '리아'}</b><p>${esc(line.text)}</p></div>
        </div>
      </div>`);
  }

  const wmState = (s, id) => (s.cleared[id] ? 'cleared' : id <= s.unlockedChapter ? 'open' : 'locked');
  /** 월드맵을 그릴 때 필요한 정보 (작전 터미널이 월드맵 모드일 때만) */
  function worldMap() {
    if (current !== 'hub' || !screenEl.querySelector('.world-map')) return null;
    const s = G().save;
    const chs = D().chapters;
    return { sel: hubSel, status: chs.map((c) => wmState(s, c.id)), themes: chs.map((c) => c.theme) };
  }
  /** 3D 섬 위치에 노드 버튼을 맞춤 (pos: 논리 좌표 1280×720) */
  function placeWorld(pos) {
    const box = screenEl.querySelector('.world-map');
    if (!box) return;
    const stageRect = host.parentNode.getBoundingClientRect();
    const sc = stageRect.width / 1280 || 1;
    const r = box.getBoundingClientRect();
    const ox = (r.left - stageRect.left) / sc;
    const oy = (r.top - stageRect.top) / sc;
    const bw = r.width / sc;
    const bh = r.height / sc;
    const nodes = box.querySelectorAll('.wm-node');
    nodes.forEach((n, i) => {
      const p = pos[i];
      if (!p) return;
      const x = p.x - ox;
      const y = p.y - oy;
      const vis = !p.behind && x > 10 && x < bw - 10 && y > 16 && y < bh - 30;
      n.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${U.clamp(0.55 + p.k * 0.8, 0.6, 1.15).toFixed(3)})`;
      n.style.opacity = vis ? '' : '0';
      n.style.pointerEvents = vis ? '' : 'none';
      n.style.zIndex = String(Math.round(p.y));
    });
  }
  function hubStep(d) {
    const s = G().save;
    const n = U.clamp((hubSel || 1) + d, 1, Math.min(s.unlockedChapter, 10));
    if (n !== hubSel) { sfx('ui'); hub(n); }
  }

  function pickHubLine(s) {
    const list = ((D().story || {}).hub || []).filter((l) => {
      if (l.minChapter > s.unlockedChapter) return false;
      if (l.flag && s.flags[l.flag] !== true) return false;
      if (l.who === 'lia' && s.unlockedChapter >= 8 && s.unlockedChapter <= 9 && s.flags.liaTrusted === false && !s.cleared[9]) return false;
      return true;
    });
    if (!list.length) return { who: 'lia', text: '준비되면 출격해요. 저는 언제나 곁에 있을게요.' };
    // 최근 챕터 대사를 더 자주
    const maxCh = Math.max(...list.map((l) => l.minChapter));
    const recent = list.filter((l) => l.minChapter >= maxCh - 1);
    return U.pick(Math.random() < 0.65 && recent.length ? recent : list);
  }

  /* ───────── 장비 ───────── */
  function loadout() {
    const s = G().save;
    const st = P().computeStats(s);
    const W = D().weapons;
    const M = D().modules;
    show('loadout', `
      ${topbar('장비 · 전술 모듈', '무기를 고르고 강화하세요. 모듈은 3개까지 장착합니다.')}
      <div class="lo">
        <div class="lo-weapons panel">
          <h3>무기</h3>
          ${D().weaponOrder.map((id) => {
            const w = W[id];
            const lv = s.weapons[id];
            const cost = P().upgradeCost(s, id);
            const eq = s.weapon === id;
            if (!lv) {
              return `<div class="wp locked"><div class="wp-sw" style="--c:#445"></div><div class="wp-info"><b>???</b><small>${w.unlockAfter}장 클리어 시 획득</small></div></div>`;
            }
            return `<div class="wp ${eq ? 'eq' : ''}">
              <div class="wp-sw" style="--c:${w.color}"></div>
              <div class="wp-info"><b>${esc(w.name)} <em>+${lv - 1}</em></b><small>${esc(w.desc)}</small>
                <div class="wp-stats">공격 배율 ×${(w.atk * (1 + D().weaponLevelBonus * (lv - 1))).toFixed(2)} · 치명 ${Math.round(w.crit * 100)}% · 콤보 ${w.combo.length}단</div></div>
              <div class="wp-act">
                ${eq ? '<span class="tag">장착 중</span>' : `<button class="btn small" data-act="equip-w" data-id="${id}">장착</button>`}
                ${cost != null ? `<button class="btn small ${s.credits >= cost ? 'gold' : ''}" ${s.credits >= cost ? '' : 'disabled'} data-act="up-w" data-id="${id}">강화 ◈${cost}</button>` : '<span class="tag max">MAX</span>'}
              </div>
            </div>`;
          }).join('')}
        </div>
        <div class="lo-mods panel">
          <h3>전술 모듈 <small>장착 슬롯</small></h3>
          <div class="mod-slots">
            ${[0, 1, 2].map((i) => {
              const id = s.equippedModules[i];
              const m = id && M[id];
              return `<div class="mod-slot ${m ? 'on' : ''}" ${m ? `data-act="unequip-m" data-slot="${i}" title="클릭해서 해제"` : ''}>
                ${m ? `<i style="color:${m.color}">${m.icon}</i><b>${esc(m.name)}</b><small>${esc(m.desc)}</small>` : '<span>빈 슬롯</span>'}</div>`;
            }).join('')}
          </div>
          <h3>보유 모듈 <small>${s.modules.length} / ${Object.keys(M).length}</small></h3>
          <div class="mod-grid">
            ${Object.keys(M).map((id) => {
              const m = M[id];
              const own = s.modules.includes(id);
              const eq = s.equippedModules.includes(id);
              if (!own) return '<div class="mod locked"><i>?</i><b>미획득</b></div>';
              return `<button class="mod ${eq ? 'eq' : ''}" data-act="${eq ? 'unequip-mid' : 'equip-m'}" data-id="${id}">
                <i style="color:${m.color}">${m.icon}</i><b>${esc(m.name)}</b><small>${esc(m.desc)}</small>${eq ? '<em>장착</em>' : ''}</button>`;
            }).join('')}
          </div>
        </div>
        <div class="lo-stats panel">
          <h3>전투 능력치</h3>
          <ul class="stats">
            <li><span>최대 체력</span><b>${st.maxHp}</b></li>
            <li><span>공격력</span><b>${Math.round(st.atk)}</b></li>
            <li><span>치명타율</span><b>${Math.round(st.crit * 100)}%</b></li>
            <li><span>치명타 피해</span><b>${Math.round(st.critDmg * 100)}%</b></li>
            <li><span>약점 피해</span><b>${Math.round(st.weakMul * 100)}%</b></li>
            <li><span>브레이크 피해</span><b>${Math.round(st.breakMul * 100)}%</b></li>
            <li><span>받는 피해 감소</span><b>${Math.round(st.dmgReduce * 100)}%</b></li>
            <li><span>완벽 회피 판정</span><b>${st.perfectWindow.toFixed(2)}초</b></li>
            <li><span>ZERO FRAME</span><b>${st.zeroDur.toFixed(1)}초</b></li>
            <li><span>스킬 재사용</span><b>${Math.round(st.cdMul * 100)}%</b></li>
            <li><span>집중 획득</span><b>${Math.round(st.focusMul * 100)}%</b></li>
            ${st.lifesteal ? `<li><span>흡수</span><b>${Math.round(st.lifesteal * 100)}%</b></li>` : ''}
            ${st.allyMul > 1 ? `<li><span>동료 피해</span><b>${Math.round(st.allyMul * 100)}%</b></li>` : ''}
          </ul>
        </div>
      </div>`);
  }

  /* ───────── 스킬 트리 ───────── */
  let skillSel = null;
  function skills(sel) {
    const s = G().save;
    const S = D().skills;
    if (sel !== undefined) skillSel = sel;
    const node = skillSel ? S.nodes[skillSel] : null;
    const info = skillSel ? P().nodeInfo(skillSel) : null;
    const can = skillSel ? P().canLearn(s, skillSel) : null;
    const learned = skillSel && s.learned.includes(skillSel);
    show('skills', `
      ${topbar('스킬 트리', '레벨이 오르거나 챕터를 처음 클리어하면 SP 를 얻습니다.')}
      <div class="sk">
        <div class="sk-tree panel">
          ${S.branches.map((br) => `
            <div class="sk-branch" style="--bc:${br.color}">
              <h3>${esc(br.name)}</h3>
              ${br.nodes.map((id, idx) => {
                const n = S.nodes[id];
                const has = s.learned.includes(id);
                const avail = !has && P().canLearn(s, id).ok;
                const prevOk = idx === 0 || s.learned.includes(br.nodes[idx - 1]);
                return `${idx ? `<div class="sk-link ${has ? 'on' : ''}"></div>` : ''}
                  <button class="sk-node ${has ? 'has' : ''} ${avail ? 'avail' : ''} ${prevOk ? '' : 'far'} ${skillSel === id ? 'sel' : ''} ${n.type}" data-act="sel-skill" data-id="${id}">
                    <img src="${iconURL(n.icon, has ? '#ffffff' : prevOk ? '#cfe0ff' : '#5a6480')}" alt="">
                    <span>${esc(n.name)}</span><small>${n.type === 'active' ? '액티브' : '패시브'} · SP ${S.tierCost[idx]}</small>
                  </button>`;
              }).join('')}
            </div>`).join('')}
        </div>
        <div class="sk-side panel">
          <h3>장착 스킬 <small>전투에서 ${['U', 'I', 'O'].join(' · ')}</small></h3>
          <div class="sk-slots">
            ${[0, 1, 2].map((i) => {
              const id = s.equippedSkills[i];
              const n = id && S.nodes[id];
              return `<div class="sk-slot ${n ? 'on' : ''}">
                <span class="key">${['U', 'I', 'O'][i]}</span>
                ${n ? `<img src="${iconURL(n.icon, '#ffffff')}" alt=""><b>${esc(n.name)}</b><small>${n.cd}초</small><button class="x" data-act="unequip-s" data-slot="${i}" title="해제">×</button>` : '<b class="muted">비어 있음</b>'}
              </div>`;
            }).join('')}
          </div>
          <div class="sk-ult"><img src="${iconURL('ult', '#ffe066')}" alt=""><div><b>${esc(S.ultimate.name)}</b><small>궁극기 (L) — ${esc(S.ultimate.desc)}</small></div></div>
          ${node ? `
            <div class="sk-detail">
              <div class="sd-head"><img src="${iconURL(node.icon, '#ffffff')}" alt=""><div><b>${esc(node.name)}</b><small>${esc(info.branch.name)} · ${node.type === 'active' ? `액티브 · 재사용 ${node.cd}초` : '패시브'}</small></div></div>
              <p>${esc(node.desc)}</p>
              ${learned
                ? (node.type === 'active'
                  ? `<div class="row">${[0, 1, 2].map((i) => `<button class="btn small ${s.equippedSkills[i] === skillSel ? 'gold' : ''}" data-act="equip-s" data-id="${skillSel}" data-slot="${i}">${['U', 'I', 'O'][i]} 슬롯에 장착</button>`).join('')}</div>`
                  : '<span class="tag">습득 완료 — 항상 적용</span>')
                : `<button class="btn primary" ${can.ok ? '' : 'disabled'} data-act="learn" data-id="${skillSel}">배우기 (SP ${info.cost})</button>${can.ok ? '' : `<p class="warn">${esc(can.why)}</p>`}`}
            </div>` : '<p class="muted">노드를 눌러 자세히 보세요.</p>'}
        </div>
      </div>`);
  }

  /* ───────── 보스 도감 ───────── */
  let codexSel = null;
  function codex(sel) {
    const s = G().save;
    const B = D().bosses;
    if (sel !== undefined) codexSel = sel;
    const order = D().bossOrder;
    if (!codexSel) codexSel = order.find((id) => s.codex[id] && s.codex[id].seen) || order[0];
    const b = B[codexSel];
    const cx = s.codex[codexSel] || {};
    const lore = ((D().story || {}).bossLore || {})[codexSel] || '';
    const recs = s.records[codexSel] || [];
    show('codex', `
      ${topbar('보스 도감', '분석 기록 — 처치하면 공략 메모가 열립니다.')}
      <div class="cx">
        <div class="cx-grid panel">
          ${order.map((id, i) => {
            const c = s.codex[id];
            return `<button class="cx-card ${c && c.seen ? '' : 'unknown'} ${c && c.defeated ? 'done' : ''} ${codexSel === id ? 'sel' : ''}" ${c && c.seen ? '' : 'disabled'} data-act="sel-codex" data-id="${id}">
              <img src="${D().assets['boss_' + id]}" alt="">
              <span>${String(i + 1).padStart(2, '0')}. ${c && c.seen ? esc(B[id].name) : '???'}</span>
            </button>`;
          }).join('')}
        </div>
        <div class="cx-detail panel">
          ${cx.seen ? `
            <div class="cx-hero"><img src="${D().assets['boss_' + codexSel]}" alt=""><div class="scan"></div></div>
            <div class="cx-name"><b>${esc(b.name)}</b><span>${esc(b.title)}</span></div>
            <p class="cx-lore">${esc(lore)}</p>
            <h4>분석 메모</h4>
            ${cx.defeated ? `<ul class="cx-tips">${b.tips.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : '<p class="muted">처치하면 공략 메모가 해금됩니다.</p>'}
            <div class="cx-meta"><span>처치 ${cx.clears || 0}회</span><span>최고 기록 ${cx.best ? U.fmtTime(cx.best) : '—'}</span></div>
            ${recs.length ? `<table class="rank-table small"><tr><th>#</th><th>기록</th><th>랭크</th><th>난이도</th></tr>${recs.map((r, i) => `<tr><td>${i + 1}</td><td>${U.fmtTime(r.time)}</td><td class="r${r.rank}">${r.rank}</td><td>${esc((D().difficulties[r.diff] || {}).name || '')}</td></tr>`).join('')}</table>` : ''}
            ${cx.defeated ? `<button class="btn primary" data-act="boss-replay" data-id="${codexSel}">재도전 (보스전)</button>` : ''}
          ` : '<p class="muted">아직 만나지 못한 개체입니다.</p>'}
        </div>
      </div>`);
  }

  /* ───────── 기억 기록 ───────── */
  let memSel = null;
  function memories(sel) {
    const s = G().save;
    const list = (D().story || {}).memories || [];
    if (sel !== undefined) memSel = sel;
    const m = list.find((x) => x.id === memSel && s.memories.includes(x.id));
    show('memories', `
      ${topbar('기억 기록', `회수한 기억 ${s.memories.length} / ${list.length}`)}
      <div class="mem">
        <div class="mem-list panel">
          ${list.map((x, i) => {
            const got = s.memories.includes(x.id);
            const second = list.filter((y) => y.chapter === x.chapter).indexOf(x) === 1;
            const ch = D().chapters[x.chapter - 1];
            return `<button class="mem-item ${got ? 'got' : ''} ${memSel === x.id ? 'sel' : ''}" ${got ? '' : 'disabled'} data-act="sel-mem" data-id="${x.id}">
              <span class="no">${String(i + 1).padStart(2, '0')}</span>
              <b>${got ? esc(x.title) : '봉인된 기억'}</b>
              <small>${got ? `${x.chapter}장 · ${esc(ch.name)}` : second ? `${x.chapter}장 도전 과제: ${esc(ch.challenge.desc)}` : `${x.chapter}장 숨겨진 구역(갈림길)의 보물 옆에서 회수`}</small>
            </button>`;
          }).join('')}
        </div>
        <div class="mem-read panel">
          ${m ? `<div class="mem-title">${esc(m.title)}</div><p class="mem-text">${esc(m.text)}</p>` : '<p class="muted">기억을 골라 다시 떠올려 보세요.</p>'}
        </div>
      </div>`);
  }

  /* ───────── 전투 기록 ───────── */
  function records() {
    const s = G().save;
    const B = D().bosses;
    const order = D().bossOrder;
    let total = 0;
    let all = true;
    for (const id of order) {
      const r = (s.records[id] || [])[0];
      if (r) total += r.time; else all = false;
    }
    const endings = (D().story || {}).endings || {};
    show('records', `
      ${topbar('전투 기록 · 클리어 시간 랭킹', '보스별 상위 5개 기록 (이 기기에 저장)')}
      <div class="rec">
        <div class="rec-sum panel">
          <div><span>보스 최고 기록 합계</span><b>${all ? U.fmtTime(total) : `${U.fmtTime(total)} <small>(미완)</small>`}</b></div>
          <div><span>총 플레이 시간</span><b>${U.fmtDuration(s.playTime)}</b></div>
          <div><span>첫 엔딩까지</span><b>${s.firstClearTime ? U.fmtDuration(s.firstClearTime) : '—'}</b></div>
          <div><span>기억 파편</span><b>${s.memories.length} / 20</b></div>
          <div class="endings"><span>엔딩</span>${['dawn', 'stars', 'eternal'].map((id) => `<em class="${s.endings.includes(id) ? 'got' : ''}">${s.endings.includes(id) ? esc((endings[id] || {}).title || id) : '???'}</em>`).join('')}</div>
        </div>
        <div class="rec-grid">
          ${order.map((id, i) => {
            const list = s.records[id] || [];
            const seen = s.codex[id] && s.codex[id].seen;
            return `<div class="rec-card panel">
              <div class="rc-head"><span>${String(i + 1).padStart(2, '0')}</span><b>${seen ? esc(B[id].name) : '???'}</b><small>목표 ${U.fmtTime(P().parTime(B[id].chapter))}</small></div>
              ${list.length ? `<table class="rank-table"><tr><th>#</th><th>기록</th><th>랭크</th><th>난이도</th><th>날짜</th></tr>${list.map((r, k) => `<tr><td>${k + 1}</td><td>${U.fmtTime(r.time)}</td><td class="r${r.rank}">${r.rank}</td><td>${esc((D().difficulties[r.diff] || {}).name || '')}</td><td>${new Date(r.date).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}</td></tr>`).join('')}</table>` : '<p class="muted">기록 없음</p>'}
            </div>`;
          }).join('')}
        </div>
      </div>`);
  }

  /* ───────── 설정 ───────── */
  function settings(from) {
    const st = G().settings;
    const s = G().save;
    const slider = (key, label) => `<label class="set-row"><span>${label}</span><input type="range" min="0" max="100" value="${Math.round(st[key] * 100)}" data-set="${key}"><b>${Math.round(st[key] * 100)}</b></label>`;
    const toggle = (key, label) => `<label class="set-row"><span>${label}</span><input type="checkbox" ${st[key] ? 'checked' : ''} data-set="${key}"></label>`;
    show('settings', `
      <div class="panel narrow settings">
        <h2>설정</h2>
        <div class="set-group"><h3>소리</h3>
          ${slider('master', '전체 음량')}${slider('music', '배경음악')}${slider('sfx', '효과음')}${toggle('muted', '음소거')}
        </div>
        <div class="set-group"><h3>화면</h3>
          ${toggle('bg3d', '3D 배경 (느리면 끄기)')}${toggle('shake', '화면 흔들림')}${toggle('flashes', '번쩍임 효과')}${toggle('damageNumbers', '피해 숫자 표시')}
          <label class="set-row"><span>대사 속도</span><select data-set="textSpeed">
            ${[[0.6, '느림'], [1, '보통'], [1.6, '빠름'], [3, '매우 빠름']].map(([v, n]) => `<option value="${v}" ${Number(st.textSpeed) === v ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        </div>
        <div class="set-group"><h3>조작</h3>
          <label class="set-row"><span>터치 조작 버튼</span><select data-set="touch">
            ${[['auto', '자동 (터치하면 표시)'], ['on', '항상 표시'], ['off', '끄기']].map(([v, n]) => `<option value="${v}" ${st.touch === v ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
          ${toggle('autoAim', '자동 조준 (가까운 적을 향해 공격)')}
        </div>
        ${s ? `<div class="set-group"><h3>게임</h3>
          <label class="set-row"><span>난이도</span><select data-set="difficulty">
            ${Object.entries(D().difficulties).map(([id, d]) => `<option value="${id}" ${s.difficulty === id ? 'selected' : ''}>${d.name}</option>`).join('')}</select></label>
          <div class="set-row"><span>저장 데이터</span><button class="btn small danger" data-act="reset-save">초기화</button></div>
        </div>` : ''}
        <div class="row center"><button class="btn primary" data-act="${from === 'title' ? 'title' : from === 'pause' ? 'pause-back' : 'hub'}">확인</button></div>
      </div>`);
  }

  /* ───────── 결과 ───────── */
  function results(r) {
    show('results', `
      <div class="res-wrap">
        <div class="res-left">
          <div class="res-label">${r.boss ? 'MISSION COMPLETE' : 'AREA CLEAR'}</div>
          <div class="res-title">${esc(r.title)}</div>
          ${r.rank ? `<div class="res-rank r${r.rank}">${r.rank}<small>RANK</small></div>` : ''}
          ${r.newBest ? '<div class="res-best">NEW RECORD!</div>' : ''}
          ${r.place ? `<div class="res-place">이 보스 기록 ${r.place}위</div>` : ''}
        </div>
        <div class="res-right panel">
          <ul class="res-stats">
            <li><span>클리어 시간</span><b>${U.fmtTime(r.time)}</b>${r.par ? `<small>목표 ${U.fmtTime(r.par)}</small>` : ''}</li>
            <li><span>받은 피해</span><b>${Math.round(r.damageTaken).toLocaleString()}</b><small>피격 ${r.hitsTaken}회</small></li>
            <li><span>ZERO FRAME</span><b>${r.zeroFrames}회</b></li>
            <li><span>브레이크</span><b>${r.breaks}회</b></li>
            <li><span>최대 콤보</span><b>${r.maxCombo}</b></li>
            <li><span>약점 공격</span><b>${r.weakHits}회</b></li>
          </ul>
          <div class="res-gain">
            <div><span>EXP</span><b>+${Math.round(r.exp).toLocaleString()}</b></div>
            <div><span>크레딧</span><b>◈ +${Math.round(r.credits).toLocaleString()}</b></div>
          </div>
          ${r.levelUp ? `<div class="res-lvup">LEVEL UP!  Lv.${r.level} <small>SP +${r.levelUp}</small></div>` : ''}
          ${r.challenge != null ? `<div class="res-ch ${r.challenge ? 'ok' : ''}"><span>도전 과제</span><b>${esc(r.challengeDesc)}</b><em>${r.challenge ? '달성' : '미달성'}</em></div>` : ''}
          ${(r.rewards || []).length ? `<ul class="res-rewards">${r.rewards.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
          ${(r.memories || []).map((m) => `<div class="res-mem">❖ 기억 파편 「${esc(m)}」 회수</div>`).join('')}
          <div class="row right"><button class="btn primary big" data-act="results-next">계속 ▶</button></div>
        </div>
      </div>`);
  }

  function defeat(info) {
    const tips = [
      '공격이 닿기 직전에 회피하면 ZERO FRAME 이 발동합니다.',
      '보스의 노란 브레이크 게이지는 강공격과 약점 공격으로 빨리 깎입니다.',
      '"분석"(Z) 명령은 약점과 공격 방향을 보여 줍니다.',
      '작전 터미널에서 무기를 강화하거나 모듈을 바꿔 보세요.',
      '체력이 부족하면 스킬 트리의 "나노 수복"이나 "위상 방벽"을 고려하세요.',
      '어렵다면 설정에서 난이도를 "스토리"로 낮출 수 있습니다.',
    ];
    show('defeat', `
      <div class="panel narrow defeat">
        <div class="def-title">MISSION FAILED</div>
        <p class="def-sub">${esc(info.title)} — 작전 실패</p>
        <p class="tip">TIP · ${esc(U.pick(tips))}</p>
        <div class="row center">
          <button class="btn primary big" data-act="retry">다시 도전</button>
          <button class="btn" data-act="defeat-hub">작전 터미널로</button>
        </div>
      </div>`);
  }

  function credits(endingId, isNew) {
    const e = ((D().story || {}).endings || {})[endingId] || { title: endingId };
    const s = G().save;
    show('credits', `
      <div class="credits">
        <div class="cr-ending">ENDING — ${esc(e.title)}</div>
        ${isNew ? '<div class="cr-new">새로운 엔딩을 기록했습니다</div>' : ''}
        <div class="cr-roll">
          <h1>ASTRA : ZERO PROTOCOL</h1>
          <p>아스트라 : 제로 프로토콜</p>
          <h3>원작 기획</h3><p>ASTRA : ZERO PROTOCOL 게임 기획 요약</p>
          <h3>주요 인물</h3><p>카이온 · 리아 · 제로 · 아스트라</p>
          <h3>보스</h3><p>${D().bossOrder.map((id) => esc(D().bosses[id].name)).join(' · ')}</p>
          <h3>엔딩 수집</h3><p>${s.endings.length} / 3</p>
          <h3>플레이 시간</h3><p>${U.fmtDuration(s.playTime)}</p>
          <p class="cr-last">지금, 그 여정이 시작됩니다.</p>
        </div>
        <div class="row center"><button class="btn primary" data-act="credits-done">작전 터미널로</button></div>
      </div>`);
  }

  /* ───────── 오버레이: 일시정지 / 확인 / 토스트 / 연출 ───────── */
  let overlay = null;
  function ensureOverlay() {
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.className = 'overlay hidden';
    host.parentNode.appendChild(overlay);
    overlay.addEventListener('click', onClick);
    overlay.addEventListener('input', onInput);
    overlay.addEventListener('change', onInput);
    return overlay;
  }
  function pause(info) {
    const o = ensureOverlay();
    o.className = 'overlay pause';
    o.innerHTML = `
      <div class="panel narrow">
        <h2>일시정지</h2>
        <p class="muted">${esc(info.title || '')}</p>
        <div class="col">
          <button class="btn primary big" data-act="resume">계속하기</button>
          <button class="btn" data-act="pause-retry">체크포인트부터 다시</button>
          <button class="btn" data-act="pause-settings">설정</button>
          <button class="btn" data-act="pause-howto">조작법</button>
          <button class="btn ghost" data-act="pause-quit">작전 포기 (터미널로)</button>
        </div>
      </div>`;
  }
  function pauseSettings() {
    const o = ensureOverlay();
    const st = G().settings;
    const slider = (key, label) => `<label class="set-row"><span>${label}</span><input type="range" min="0" max="100" value="${Math.round(st[key] * 100)}" data-set="${key}"><b>${Math.round(st[key] * 100)}</b></label>`;
    const toggle = (key, label) => `<label class="set-row"><span>${label}</span><input type="checkbox" ${st[key] ? 'checked' : ''} data-set="${key}"></label>`;
    o.innerHTML = `<div class="panel narrow settings"><h2>설정</h2>
      ${slider('master', '전체 음량')}${slider('music', '배경음악')}${slider('sfx', '효과음')}${toggle('muted', '음소거')}
      ${toggle('shake', '화면 흔들림')}${toggle('flashes', '번쩍임 효과')}${toggle('damageNumbers', '피해 숫자 표시')}${toggle('autoAim', '자동 조준')}
      <div class="row center"><button class="btn primary" data-act="pause-back">돌아가기</button></div></div>`;
  }
  function pauseHowto() {
    const o = ensureOverlay();
    o.innerHTML = `<div class="panel narrow"><h2>조작법</h2>
      <p><kbd>WASD</kbd> 이동 · <kbd>J</kbd> 공격 · <kbd>K</kbd> 강공격 · <kbd>Space</kbd> 회피<br>
      <kbd>U</kbd><kbd>I</kbd><kbd>O</kbd> 스킬 · <kbd>L</kbd> 궁극기 · <kbd>F</kbd> 연계 · <kbd>Z</kbd><kbd>X</kbd><kbd>C</kbd> 전술 명령</p>
      <p class="muted">공격이 닿기 직전에 회피 → ZERO FRAME → 바로 공격하면 반격.<br>노란 게이지를 깎아 BREAK → 연계 공격(F)이 공짜.</p>
      <div class="row center"><button class="btn primary" data-act="pause-back">돌아가기</button></div></div>`;
  }
  function hideOverlay() {
    if (overlay) { overlay.className = 'overlay hidden'; overlay.innerHTML = ''; }
  }

  let confirmCb = null;
  function confirm(msg, cb, okLabel) {
    const o = ensureOverlay();
    confirmCb = cb;
    o.className = 'overlay';
    o.innerHTML = `<div class="panel narrow"><p class="confirm-msg">${esc(msg)}</p>
      <div class="row center"><button class="btn danger" data-act="confirm-ok">${esc(okLabel || '확인')}</button><button class="btn" data-act="confirm-no">취소</button></div></div>`;
  }

  let toastEl = null;
  function toast(msg, kind) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toasts';
      host.parentNode.appendChild(toastEl);
    }
    const t = document.createElement('div');
    t.className = 'toast ' + (kind || '');
    t.textContent = msg;
    toastEl.appendChild(t);
    setTimeout(() => t.classList.add('out'), 2600);
    setTimeout(() => t.remove(), 3200);
  }

  /** 챕터 카드 / 보스 등장 — Promise */
  let cardEl = null;
  function card(kind, data) {
    if (!cardEl) {
      cardEl = document.createElement('div');
      cardEl.className = 'cardfx hidden';
      host.parentNode.appendChild(cardEl);
    }
    return new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        cardEl.className = 'cardfx hidden';
        cardEl.innerHTML = '';
        cardEl.onclick = null;
        resolve();
      };
      if (kind === 'chapter') {
        cardEl.className = 'cardfx chapter';
        cardEl.innerHTML = `
          <div class="cc-line"></div>
          <div class="cc-no">CHAPTER ${data.id}</div>
          <div class="cc-name">${esc(data.name)}</div>
          <div class="cc-sum">${esc(data.summary || '')}</div>`;
        if (AZ.audio) AZ.audio.sfx('skill', { pitch: 0.7, vol: 0.6 });
        setTimeout(finish, 3000);
      } else {
        const b = D().bosses[data.bossId];
        cardEl.className = 'cardfx boss';
        cardEl.style.setProperty('--bc', b.color);
        cardEl.innerHTML = `
          <div class="bi-stripes top"><span>WARNING · WARNING · WARNING · WARNING · WARNING · WARNING · WARNING ·</span></div>
          <div class="bi-art"><img src="${D().assets['boss_' + data.bossId]}" alt=""><div class="scan"></div></div>
          <div class="bi-text"><small>${String(b.chapter).padStart(2, '0')} · TARGET</small><b>${esc(b.name)}</b><span>${esc(b.title)}</span></div>
          <div class="bi-stripes bottom"><span>· HOSTILE · HOSTILE · HOSTILE · HOSTILE · HOSTILE · HOSTILE · HOSTILE</span></div>`;
        if (AZ.audio) { AZ.audio.sfx('alarm', { vol: 0.6 }); AZ.audio.duck(0.6, 2.4); setTimeout(() => AZ.audio.sfx('roar', { vol: 0.7 }), 500); }
        setTimeout(finish, 2700);
      }
      cardEl.onclick = finish;
    });
  }

  /* ───────── 입력 처리 ───────── */
  function onInput(e) {
    const t = e.target;
    const key = t.dataset && t.dataset.set;
    if (!key) return;
    const st = G().settings;
    if (t.type === 'range') {
      st[key] = Number(t.value) / 100;
      const b = t.parentNode.querySelector('b');
      if (b) b.textContent = t.value;
    } else if (t.type === 'checkbox') st[key] = t.checked;
    else if (key === 'textSpeed') st[key] = Number(t.value);
    else if (key === 'difficulty') {
      if (G().save) { G().save.difficulty = t.value; G().persist(); }
      return;
    } else st[key] = t.value;
    G().applySettings();
    if (e.type === 'change' && t.type === 'range') sfx('ui');
  }

  function onClick(e) {
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled) return;
    const act = b.dataset.act;
    const game = G();
    const s = game.save;
    const id = b.dataset.id;
    const big = ['sortie', 'boss-only', 'start-new', 'continue', 'results-next', 'retry', 'boss-replay', 'learn', 'up-w'];
    sfx(big.includes(act) ? 'uiConfirm' : act === 'hub' || act.endsWith('back') ? 'uiBack' : 'ui');
    switch (act) {
      case 'continue': game.continueGame(); break;
      case 'newgame': newGame(); break;
      case 'start-new': game.newGame(b.dataset.diff); break;
      case 'title': game.toTitle(); break;
      case 'howto': howto('title'); break;
      case 'howto-hub': howto('hub'); break;
      case 'settings-title': settings('title'); break;
      case 'settings': settings('hub'); break;
      case 'hub': hub(); break;
      case 'sel-ch': hub(Number(b.dataset.ch)); break;
      case 'sortie': game.startChapter(Number(b.dataset.ch), false); break;
      case 'boss-only': game.startChapter(Number(b.dataset.ch), true); break;
      case 'loadout': loadout(); break;
      case 'equip-w': P().equipWeapon(s, id); game.persist(); loadout(); break;
      case 'up-w': if (P().upgradeWeapon(s, id)) { game.persist(); sfx('levelup', { vol: 0.5 }); } loadout(); break;
      case 'equip-m': {
        const slot = s.equippedModules.indexOf(null);
        if (slot >= 0) P().equipModule(s, slot, id);
        else { P().equipModule(s, 2, id); toast('슬롯이 가득 차 마지막 슬롯을 교체했습니다.'); }
        game.persist();
        loadout();
        break;
      }
      case 'unequip-m': P().equipModule(s, Number(b.dataset.slot), null); game.persist(); loadout(); break;
      case 'unequip-mid': P().equipModule(s, s.equippedModules.indexOf(id), null); game.persist(); loadout(); break;
      case 'skills': skills(); break;
      case 'sel-skill': skills(id); break;
      case 'learn': {
        const r = P().learn(s, id);
        if (r.ok) { sfx('levelup', { vol: 0.5 }); game.persist(); } else toast(r.why);
        skills(id);
        break;
      }
      case 'equip-s': P().equipSkill(s, Number(b.dataset.slot), id); game.persist(); skills(id); break;
      case 'unequip-s': P().equipSkill(s, Number(b.dataset.slot), null); game.persist(); skills(); break;
      case 'codex': codex(); break;
      case 'sel-codex': codex(id); break;
      case 'boss-replay': game.startBossReplay(id); break;
      case 'memories': memories(); break;
      case 'sel-mem': memories(id); break;
      case 'records': records(); break;
      case 'reset-save':
        confirm('저장 데이터를 모두 지울까요? 되돌릴 수 없습니다.', () => { AZ.save.clear(); game.toTitle(); toast('저장 데이터를 지웠습니다.'); }, '지우기');
        break;
      case 'results-next': game.resultsNext(); break;
      case 'retry': game.retry(); break;
      case 'defeat-hub': game.toHub(); break;
      case 'credits-done': game.toHub(); break;
      case 'resume': game.resume(); break;
      case 'pause-retry': game.retryFromPause(); break;
      case 'pause-settings': pauseSettings(); break;
      case 'pause-howto': pauseHowto(); break;
      case 'pause-back': if (game.paused) pause({ title: game.battleTitle() }); else game.toTitle(); break;
      case 'pause-quit': game.quitBattle(); break;
      case 'confirm-ok': { const cb = confirmCb; confirmCb = null; hideOverlay(); if (cb) cb(); break; }
      case 'confirm-no': confirmCb = null; hideOverlay(); break;
      default: break;
    }
  }

  return {
    init, hide, title, newGame, hub, loadout, skills, codex, memories, records, settings, results, defeat, credits,
    pause, hideOverlay, confirm, toast, card, howto, iconURL,
    get current() { return current; },
    get menuTheme() { return menuTheme; },
    get worldMap() { return worldMap(); },
    placeWorld, hubStep,
  };
})();
