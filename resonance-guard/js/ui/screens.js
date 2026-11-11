'use strict';

/* =========================================================
 * 화면 — 타이틀, 월드 지도, 출정 준비, 결과, 설정
 * ========================================================= */
(() => {
  const { el, escapeHtml: esc, round } = RG.util;
  const UI = RG.ui;
  const D = () => RG.data;
  const P = () => RG.progress;
  /** 중복 강화 효과 글 */
  function rankText(t, rank) {
    const role = RG.data.towers[t].role;
    const pct = Math.round((RG.gacha.rankMult(rank) - 1) * 100); // 최종 강화는 +50%
    return role === 'support' ? `지원 효과 +${pct}%` : role === 'economy' ? `수입 +${pct}%` : role === 'barracks' ? `병사 체력·공격력 +${pct}%` : `공격력 +${pct}%`;
  }
  RG.ui.rankText = rankText;
  /** 지금 뽑기를 할 수 있나 (공명석 100 이상) */
  const canPull = () => RG.progress.gachaState().crystals >= RG.gacha.COST.one;
  RG.ui.canPull = canPull;

  /* =====================================================
   * 타이틀
   * ===================================================== */
  UI.register('title', {
    enter(sec) {
      UI.music('title');
      sec.innerHTML = '';
      const run = RG.save.get(RG.save.KEYS.run, null);
      const has = P().hasSave() || !!run;
      const bg = titleScene();
      const logo = el('div', { class: 'logo' }, [
        el('div', { class: 'logo-orbs' }, D().elementOrder.map((e) => (RG.art.elementGem ? UI.svgImg(RG.art.elementGem(e), 'logo-orb', D().elements[e].name) : UI.icon(e, 'logo-orb')))),
        el('h1', { 'data-text': '공명 수호대', text: '공명 수호대' }),
        RG.art.logoFlourish ? UI.svgImg(RG.art.logoFlourish(), 'logo-flourish', '') : null,
        el('p', { class: 'logo-sub', text: '여섯 원소의 울림으로 등불을 지켜라' }),
      ]);
      const go = (fn) => () => { try { if (RG.audio) RG.audio.init(); } catch (e) { /* 무시 */ } UI.sfx('click'); fn(); };
      const menu = titleMenu(run, has, go);
      const corner = el('div', { class: 'title-corner' }, [
        el('button', { class: 'btn tc-btn', title: '설정', onclick: go(() => openSettings()) }, [UI.icon('settings', 'tc-ico'), el('span', { text: '설정' })]),
        el('button', { class: 'btn tc-btn', title: '만든 이', onclick: go(() => credits()) }, [UI.icon('crown', 'tc-ico'), el('span', { text: '만든 이' })]),
      ]);
      const foot = el('div', { class: 'title-foot' }, [
        has ? el('button', { class: 'btn btn-ghost small tf-reset', onclick: go(() => UI.confirmBox('모든 진행 상황(별, 기술 나무, 도감)을 지우고 처음부터 시작할까요?', () => { P().reset(); RG.save.remove(RG.save.KEYS.run); UI.show('title', {}); }, { danger: true, yes: '처음부터' })) }, ['처음부터 다시']) : null,
        el('span', { class: 'tf-note', text: '설치 없이 브라우저에서 · 그림과 소리는 모두 코드로 만들었습니다' }),
      ]);
      sec.append(bg, el('div', { class: 'title-wrap' }, [logo, menu]), corner, foot);
    },
  });

  /*
   * 로비 메뉴 (2026-11-10 개편): 예전엔 '월드 지도'만 크고 나머지는 작은 글자 버튼이라 눈에 띄지 않았음.
   * 가운데 금빛 큰 카드(모험 — 다음 스테이지·별 진행, 그 지역 풍경), 양옆에 큰 그림 카드 4장
   * (탑 뽑기·수호대·기술 나무·도감 — 저마다 색, 지금 상태 한 줄, 할 일이 있으면 배지).
   */
  function titleMenu(run, has, go) {
    const menu = el('div', { class: 'title-menu' });
    const maps = D().maps;
    const nextId = P().frontier();
    const nextDef = maps.find((m) => m.id === nextId) || maps[0];
    const allCleared = maps.every((m) => P().mapRec(m.id).cleared);
    const maxStars = maps.length * 5;
    const starsNow = P().starsTotal();
    // 가운데: 모험 카드 (이어할 판이 있으면 그 카드가 금빛, 지도 카드는 그 아래 보조)
    const mainCol = el('div', { class: 'tm-main' });
    const resumable = run && maps.concat(D().endless).some((m) => m.id === run.mapId);
    const bannerOf = (region) => (RG.art.regionBanner ? UI.svgImg(RG.art.regionBanner(region), 'tm-banner', '') : null);
    if (resumable) {
      const rd = maps.concat(D().endless).find((m) => m.id === run.mapId);
      mainCol.appendChild(el('button', { class: 'btn btn-primary btn-big tm-card tm-hero', onclick: go(() => UI.show('game', { resume: run })) }, [
        bannerOf(rd.region || 1),
        el('span', { class: 'tm-medal tm-medal-big' }, [UI.icon('play', 'tm-ico')]),
        el('span', { class: 'tm-text' }, [
          el('span', { class: 'tm-kicker', text: `하던 판 · ${run.mapId} 웨이브 ${run.wave}` }),
          el('b', { class: 'tm-title', text: '이어하기' }),
          el('span', { class: 'tm-sub', text: rd.name || '' }),
        ]),
        el('span', { class: 'tm-go', text: '이어서 ›' }),
      ]));
    }
    mainCol.appendChild(el('button', { class: `btn btn-big tm-card ${resumable ? 'tm-map-small' : 'btn-primary tm-hero'}`, onclick: go(() => UI.show('world', has ? { view: 'regions' } : {})) }, [
      resumable ? null : bannerOf(nextDef.region),
      el('span', { class: `tm-medal ${resumable ? '' : 'tm-medal-big'}` }, [UI.icon('map', 'tm-ico')]),
      el('span', { class: 'tm-text' }, [
        resumable ? null : el('span', { class: 'tm-kicker', text: '월드 지도' }),
        el('b', { class: 'tm-title', text: resumable ? '월드 지도' : has ? '모험 계속' : '모험 시작' }),
        el('span', { class: 'tm-sub', text: allCleared ? '모든 지역을 지켜 냈습니다 · 무한 모드와 도전에 나서 보세요' : `다음 · ${nextDef.id} ${nextDef.name}` }),
        has ? el('span', { class: 'tm-prog' }, [
          el('span', { class: 'tm-bar' }, [el('i', { style: `width:${Math.round(Math.min(1, starsNow / maxStars) * 100)}%` })]),
          el('span', { class: 'tm-stars' }, [UI.icon('star', 'tiny'), `${starsNow} / ${maxStars}`]),
        ]) : null,
      ]),
      resumable ? null : el('span', { class: 'tm-go', text: has ? '출발 ›' : '시작 ›' }),
    ]));
    // 양옆 카드 4장
    const g = P().gachaState();
    const nPull = Math.floor(g.crystals / RG.gacha.COST.one);
    const owned = P().ownedTowers().length;
    const heroes = P().heroesFor(nextId);
    const free = P().starsFree();
    const enemiesSeen = (P().get().seen.enemies || []).length;
    const enemiesAll = Object.keys(D().enemies).length;
    const lastHero = heroes.includes(P().get().lastHero) ? P().get().lastHero : heroes[heroes.length - 1] || D().heroOrder[0]; // 다음 출정 대표의 얼굴
    const tile = (cls, tone, medal, label, sub, badge, onclick) => el('button', { class: `btn tm-tile ${cls}`, style: `--tc:${tone}`, onclick }, [
      el('span', { class: 'tm-medal' }, [medal]),
      el('b', { class: 'tm-label', text: label }),
      el('span', { class: 'tm-sub', text: sub }),
      badge ? el('span', { class: 'tm-badge', text: badge }) : null,
    ]);
    const tiles = [
      tile(`btn-gacha tm-gacha ${canPull() ? 'ready' : ''}`, '#b07cff', UI.icon('crystal', 'tm-ico'), '탑 뽑기', `공명석 ${g.crystals} · 탑 ${owned}/${D().towerOrder.length}`, nPull >= 10 ? '10회 가능' : nPull ? `${nPull}회 가능` : '', go(() => UI.show('gacha', { back: { screen: 'title' } }))),
      tile('tm-heroes', '#ff7a6a', RG.art.portrait ? UI.portrait(lastHero, 'normal', 'tm-portrait') : UI.icon('hero', 'tm-ico'), '수호대', `영웅 ${heroes.length}/${D().heroOrder.length}`, '', go(() => UI.show('heroes', { back: { screen: 'title' } }))),
      tile('tm-tree', '#7ad46a', UI.icon('tree', 'tm-ico'), '기술 나무', free > 0 ? `쓸 수 있는 별 ★${free}` : `모은 별 ★${starsNow}`, free > 0 ? `★${free}` : '', go(() => UI.show('tree', {}))),
      tile('tm-codex', '#f2b24a', UI.icon('book', 'tm-ico'), '도감', `만난 적 ${enemiesSeen}/${enemiesAll}`, '', go(() => UI.show('codex', {}))),
    ];
    menu.append(tiles[0], tiles[1], mainCol, tiles[2], tiles[3]);
    return menu;
  }

  /**
   * 타이틀 풍경: 하늘 → 먼 산 → 언덕(+울림등 빛줄기) → 마을 → 앞 나무, 구름과 반딧불.
   * 층마다 다른 속도로 천천히 흔들리고(시차), 마우스를 움직이면 층이 조금씩 따라 움직임.
   * 화면이 가려지면(display:none) CSS 움직임은 멈춤. 움직임 줄이기 설정이면 거의 멈춤(css).
   */
  let sceneCache = null;
  function titleScene() {
    if (!RG.art.titleLayer) return el('div', { class: 'title-bg' }, [UI.svgImg(RG.art.regionBanner(1), 'title-banner')]);
    if (!sceneCache) {
      sceneCache = {};
      for (const n of ['sky', 'far', 'mid', 'village', 'front']) sceneCache[n] = RG.art.titleLayer(n);
      sceneCache.rays = RG.art.titleRays();
      sceneCache.clouds = [0, 1, 2, 3].map((i) => RG.art.titleCloud(i));
    }
    const [lx, ly] = RG.art.TITLE.lantern;
    const W = RG.art.TITLE.w;
    const H = RG.art.TITLE.h;
    const layer = (n) => el('div', { class: `ts-layer ts-${n}` }, [UI.svgImg(sceneCache[n], 'ts-img', '')]);
    const rays = el('div', { class: 'ts-rays', style: `left:${(lx / W) * 100}%;top:${(ly / H) * 100}%` }, [UI.svgImg(sceneCache.rays, 'ts-img', '')]);
    const clouds = el('div', { class: 'ts-clouds' }, sceneCache.clouds.map((svg, i) => UI.svgImg(svg, `ts-cloud ts-cloud-${i}`, '')));
    // 반딧불·불씨: 위치는 고정 시드(늘 같은 자리), 깜빡임만 CSS
    let seed = 11;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const motes = el('div', { class: 'ts-motes' });
    for (let i = 0; i < 26; i++) {
      const cols = ['#fff1a8', '#ffd27a', '#ffb7e0', '#b8e8ff', '#c8ffb0'];
      motes.appendChild(el('i', { style: `left:${f1(4 + rnd() * 92)}%;top:${f1(52 + rnd() * 44)}%;--c:${cols[i % cols.length]};--d:${f1(5 + rnd() * 7)}s;--dl:${f1(-rnd() * 10)}s;--dx:${f1(-30 + rnd() * 60)}px;--dy:${f1(-20 - rnd() * 50)}px` }));
    }
    const scene = el('div', { class: 'title-scene' }, [layer('sky'), clouds, layer('far'), layer('mid'), rays, layer('village'), motes, layer('front')]);
    const bg = el('div', { class: 'title-bg' }, [scene, el('div', { class: 'title-vignette' })]);
    // 마우스 시차 (손가락 화면은 생략) — 화면에 한 번만 붙임
    requestAnimationFrame(() => {
      const s0 = document.getElementById('screen-title');
      if (!s0 || s0.dataset.parallax) return;
      s0.dataset.parallax = '1';
      s0.addEventListener('pointermove', (e) => {
        if (e.pointerType !== 'mouse') return;
        const sc = s0.querySelector('.title-scene');
        if (!sc) return;
        sc.style.setProperty('--px', f1(e.clientX / window.innerWidth - 0.5));
        sc.style.setProperty('--py', f1(e.clientY / window.innerHeight - 0.5));
      });
    });
    return bg;
  }
  const f1 = (v) => Math.round(v * 100) / 100;

  function credits() {
    UI.modal(el('div', { class: 'credits' }, [
      el('p', { text: '공명 수호대 (Resonance Guard)' }),
      el('p', { class: 'dim', text: '기획·프로그램·그림·소리: Claude와 사용자의 공동 작업' }),
      el('p', { class: 'dim', text: '모든 그림은 SVG 코드로, 모든 소리는 WebAudio로 실시간 합성했습니다. 외부 파일을 쓰지 않습니다.' }),
    ]), { title: '만든 이', buttons: [{ text: '닫기', primary: true }] });
  }

  /* =====================================================
   * 설정
   * ===================================================== */
  function openSettings() {
    const s = UI.getSettings();
    const body = el('div', { class: 'settings' });
    const slider = (key, label) => {
      const input = el('input', { type: 'range', min: '0', max: '1', step: '0.05', value: String(s[key]) });
      input.addEventListener('input', () => UI.setSettings({ [key]: +input.value }));
      return el('label', { class: 'set-row' }, [el('span', { text: label }), input]);
    };
    const toggle = (key, label) => {
      const input = el('input', { type: 'checkbox' });
      input.checked = !!s[key];
      input.addEventListener('change', () => UI.setSettings({ [key]: input.checked }));
      return el('label', { class: 'set-row' }, [el('span', { text: label }), input]);
    };
    body.append(
      slider('master', '전체 음량'), slider('sfx', '효과음'), slider('music', '음악'),
      toggle('muted', '소리 끄기'), toggle('shake', '화면 흔들림'), toggle('numbers', '피해 숫자'), toggle('paths', '준비 중 길 미리보기'), toggle('bigText', '큰 글씨'),
    );
    UI.modal(body, { title: '설정', buttons: [{ text: '닫기', primary: true }] });
  }
  RG.ui.openSettings = openSettings;

  /* =====================================================
   * 월드 지도
   * ===================================================== */
  let worldRegion = null;
  let worldFitBound = false;
  let worldView = 'stages';     // 'regions' = 지역 고르기(펼침 패널), 'stages' = 한 지역의 그림 지도
  let regionPick = null;        // 지역 고르기에서 펼쳐진 지역
  const regionArt = {};         // 지역 그림 SVG (한 번만 만듦)
  const artOf = (r) => regionArt[r] || (regionArt[r] = RG.art.regionMap ? RG.art.regionMap(r) : RG.art.regionBanner(r));
  /** 지역 요약: 열림, 별, 클리어 수, 보스, 다음 맵 */
  function regionInfo(r) {
    const maps = D().maps.filter((m) => m.region === r);
    const open = maps.length > 0 && P().mapUnlocked(maps[0].id);
    const stars = maps.reduce((s, m) => s + P().mapStars(m.id), 0);
    const cleared = maps.filter((m) => P().mapRec(m.id).cleared).length;
    const bossMap = maps.find((m) => m.boss);
    const boss = Object.keys(D().enemies).find((k) => D().enemies[k].boss && D().enemies[k].region === r && (!bossMap || (bossMap.waves || []).join(' ').includes(k))) || Object.keys(D().enemies).find((k) => D().enemies[k].boss && D().enemies[k].region === r);
    return { maps, open, stars, maxStars: maps.length * 5, cleared, boss, bossDown: !!(bossMap && P().mapRec(bossMap.id).cleared), front: maps.some((m) => m.id === P().frontier()) };
  }

  /* 지역 고르기: 다섯 지역이 나란히 선 패널. 고른 지역이 크게 펼쳐지며 그림·진행·보스가 보이고, 한 번 더 누르면 들어감 */
  function regionSelect(sec, head) {
    const front = D().maps.find((m) => m.id === P().frontier());
    if (!regionPick) regionPick = worldRegion || (front ? front.region : 1);
    const wrap = el('div', { class: 'rg-select', role: 'listbox', 'aria-label': '지역 고르기' });
    const panels = [];
    let entering = false;
    const enter = (r) => {
      const info = regionInfo(r);
      if (!info.open) { UI.toast(info.maps.length ? '앞 지역을 먼저 지켜 내야 합니다' : '아직 갈 수 없는 지역입니다', 'warn'); UI.sfx('error'); return; }
      if (entering) return;
      entering = true;
      worldRegion = r; worldView = 'stages';
      UI.sfx('click');
      // 고른 패널이 화면 가득 펼쳐지며 그 지역 그림 지도로 들어감(다른 패널은 접혀 사라짐)
      const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduce) { UI.show('world', {}); return; }
      wrap.classList.add('entering');
      panels[r - 1].classList.add('zooming');
      setTimeout(() => { if (document.body.dataset.screen === 'world') UI.show('world', {}); }, 460);
    };
    const pick = (r, focus) => {
      if (regionPick === r) return;
      regionPick = r;
      UI.sfx('hover');
      panels.forEach((pn) => { const on = +pn.dataset.r === r; pn.classList.toggle('on', on); pn.setAttribute('aria-selected', on ? 'true' : 'false'); });
      if (focus) panels[r - 1].focus();
    };
    for (const reg of D().regions) {
      const info = regionInfo(reg.id);
      const on = reg.id === regionPick;
      const dots = el('div', { class: 'rg-dots' }, info.maps.map((m) => {
        const rec = P().mapRec(m.id);
        const st = P().mapUnlocked(m.id) ? (rec.cleared ? 'clear' : 'open') : 'lock';
        return el('span', { class: `rg-dot ${st} ${m.id === P().frontier() ? 'front' : ''} ${m.boss ? 'boss' : ''}`, title: `${m.id} ${m.name}` }, [el('b', { text: m.id.split('-')[1] }), rec.cleared ? el('i', { text: '★'.repeat(rec.stars || 0) }) : null]);
      }));
      const pct = info.maxStars ? Math.round((info.stars / info.maxStars) * 100) : 0;
      const pn = el('div', {
        class: `rg-panel theme-${reg.theme} ${on ? 'on' : ''} ${info.open ? '' : 'locked'} ${info.front ? 'front' : ''}`,
        role: 'option', tabindex: '0', 'aria-selected': on ? 'true' : 'false', 'aria-label': `${reg.id}. ${reg.name}${info.open ? ` 별 ${info.stars}/${info.maxStars}` : ' 잠김'}`,
        dataset: { r: String(reg.id) },
      }, [
        UI.svgImg(artOf(reg.id), 'rg-art', ''),
        el('div', { class: 'rg-shade' }),
        el('div', { class: 'rg-fog' }),
        // 접힌 모양: 세로 이름
        el('div', { class: 'rg-spine' }, [
          el('span', { class: 'rg-num', text: String(reg.id) }),
          el('b', { class: 'rg-vname', text: reg.name }),
          info.open ? el('span', { class: 'rg-vstar' }, [UI.icon('star', 'tiny'), String(info.stars)]) : UI.icon('lock', 'rg-vlock'),
        ]),
        // 펼친 모양
        el('div', { class: 'rg-body' }, [
          el('div', { class: 'rg-top' }, [
            el('span', { class: 'rg-kicker', text: `제${reg.id}지역${info.front ? ' · 지금 지키는 곳' : info.cleared === info.maps.length && info.maps.length ? ' · 모두 지켜 냄' : ''}` }),
            el('h3', { class: 'rg-name', text: reg.name }),
            el('p', { class: 'rg-desc', text: reg.desc }),
          ]),
          info.open ? dots : el('p', { class: 'rg-lockmsg' }, [UI.icon('lock', 'tiny'), ' 앞 지역의 보스를 쓰러뜨리면 열립니다']),
          el('div', { class: 'rg-foot' }, [
            el('div', { class: 'rg-stats' }, [
              el('div', { class: 'rg-bar' }, [el('i', { style: `width:${pct}%` })]),
              el('span', {}, [UI.icon('star', 'tiny'), el('b', { text: `${info.stars}` }), ` / ${info.maxStars}`, el('span', { class: 'dim', text: ` · 클리어 ${info.cleared}/${info.maps.length}` })]),
            ]),
            info.boss ? el('div', { class: `rg-boss ${info.bossDown ? 'down' : ''}` }, [UI.enemyImg(info.boss, 'rg-boss-img'), el('span', {}, [el('small', { text: info.bossDown ? '쓰러뜨린 보스' : '지역 보스' }), el('b', { text: info.open ? D().enemies[info.boss].name : '???' })])]) : null,
            el('button', { class: `btn btn-primary rg-go ${info.open ? '' : 'disabled'}`, tabindex: '-1', onclick: (e) => { e.stopPropagation(); enter(reg.id); } }, [info.open ? '들어가기 ▶' : '잠김']),
          ]),
        ]),
      ]);
      // 누르는 순간(포커스로 펼쳐지기 전)에 이미 펼쳐져 있었는지 기억 — 접힌 패널은 첫 누름에 펼치기만
      pn.addEventListener('pointerdown', () => { pn._wasOn = regionPick === reg.id; });
      pn.addEventListener('click', () => { const was = pn._wasOn != null ? pn._wasOn : regionPick === reg.id; pn._wasOn = null; if (was) enter(reg.id); else pick(reg.id); });
      pn.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { pick(Math.min(5, reg.id + 1), true); e.preventDefault(); }
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { pick(Math.max(1, reg.id - 1), true); e.preventDefault(); }
        else if (e.key === 'Enter' || e.key === ' ') { if (regionPick === reg.id) enter(reg.id); else pick(reg.id); e.preventDefault(); }
      });
      pn.addEventListener('focus', () => pick(reg.id));
      panels.push(pn);
      wrap.appendChild(pn);
    }
    sec.append(head, el('div', { class: 'rg-board' }, [wrap]));
    requestAnimationFrame(() => { if (UI.keyboardUser && UI.keyboardUser()) panels[regionPick - 1].focus(); });
  }

  UI.register('world', {
    enter(sec, data) {
      UI.music('worldmap');
      sec.innerHTML = '';
      const front = P().frontier();
      const frontMap = D().maps.find((m) => m.id === front);
      if (data.region) { worldRegion = data.region; worldView = 'stages'; }
      if (data.view) worldView = data.view;
      if (!worldRegion) worldRegion = frontMap ? frontMap.region : 1;
      if (worldView === 'regions' && !data.keepPick) regionPick = null;
      const head = el('header', { class: 'top-bar' }, [
        el('button', { class: 'icon-btn', title: worldView === 'regions' ? '타이틀' : '지역 고르기', 'aria-label': worldView === 'regions' ? '타이틀' : '지역 고르기', onclick: () => (worldView === 'regions' ? UI.show('title', {}) : UI.show('world', { view: 'regions' })) }, [UI.icon('back')]),
        el('h2', { text: '월드 지도' }),
        el('div', { class: 'top-stars' }, [UI.icon('star'), el('b', { text: String(P().starsTotal()) }), el('small', { text: ' / 150' })]),
        el('div', { class: 'top-actions' }, [
          el('button', { class: `btn small btn-gacha ${canPull() ? 'ready' : ''}`, onclick: () => UI.show('gacha', { back: { screen: 'world' } }) }, [UI.icon('crystal', 'tiny'), `뽑기 ${P().gachaState().crystals}`]),
          el('button', { class: 'btn small', onclick: () => UI.show('tree', {}) }, [UI.icon('tree', 'tiny'), `기술 나무${P().starsFree() > 0 ? ` (${P().starsFree()})` : ''}`]),
          el('button', { class: 'btn small', onclick: () => UI.show('heroes', {}) }, [UI.icon('hero', 'tiny'), '수호대']),
          el('button', { class: 'btn small', onclick: () => UI.show('codex', {}) }, [UI.icon('book', 'tiny'), '도감']),
          el('button', { class: 'icon-btn', title: '설정', onclick: openSettings }, [UI.icon('settings')]),
        ]),
      ]);
      if (worldView === 'regions') { regionSelect(sec, head); return; }
      // 한 지역 보기: 위쪽 탭 대신 "지역 고르기"로 돌아가는 단추 + 이전·다음 지역
      const go = (r) => { const info = regionInfo(r); if (!info.open) { UI.toast('앞 지역을 먼저 지켜 내야 합니다', 'warn'); return; } worldRegion = r; UI.sfx('click'); UI.show('world', {}); };
      const cur = regionInfo(worldRegion);
      const curReg = D().regions.find((r) => r.id === worldRegion);
      const tabs = el('nav', { class: 'wm-nav' }, [
        el('button', { class: 'btn wm-all', onclick: () => { regionPick = worldRegion; UI.show('world', { view: 'regions', keepPick: true }); } }, [UI.icon('map', 'tiny'), '지역 고르기']),
        el('button', { class: 'icon-btn wm-step', 'aria-label': '이전 지역', disabled: worldRegion <= 1, onclick: () => go(worldRegion - 1) }, ['◀']),
        el('div', { class: `wm-title theme-${curReg.theme}` }, [el('span', { class: 'rg-num', text: String(worldRegion) }), el('b', { text: curReg.name }), el('span', { class: 'wm-stars' }, [UI.icon('star', 'tiny'), `${cur.stars}/${cur.maxStars}`])]),
        el('button', { class: 'icon-btn wm-step', 'aria-label': '다음 지역', disabled: worldRegion >= D().regions.length || !regionInfo(worldRegion + 1).open, onclick: () => go(worldRegion + 1) }, ['▶']),
      ]);
      const reg = D().regions.find((r) => r.id === worldRegion);
      const maps = D().maps.filter((m) => m.region === worldRegion);
      const board = el('div', { class: `region-board theme-${reg.theme}` });
      // 그림 지도: 지역 그림 위에 메달(노드)을 길을 따라 놓음 (그림: js/art/scenes.js regionMap)
      const art = RG.art.regionMap ? UI.svgImg(RG.art.regionMap(reg.id), 'wm-art', reg.name) : UI.svgImg(RG.art.regionBanner(reg.id), 'wm-art', reg.name);
      const spots = (RG.art.REGION_NODES && RG.art.REGION_NODES[reg.id]) || [];
      const nodes = el('div', { class: 'map-nodes wm-map' }, [art]);
      const pos = (i) => { const p = spots[i] || [100 + i * 200, 450]; return `left:${(p[0] / 16).toFixed(2)}%;top:${(p[1] / 9).toFixed(2)}%`; };
      maps.forEach((m, i) => {
        const open = P().mapUnlocked(m.id);
        const rec = P().mapRec(m.id);
        const node = el('button', {
          class: `map-node ${open ? '' : 'locked'} ${rec.cleared ? 'cleared' : ''} ${m.id === front ? 'frontier' : ''} ${m.boss ? 'boss' : ''}`,
          style: pos(i),
          'aria-label': `${m.id} ${m.name}${open ? ` 별 ${rec.stars || 0}개` : ' 잠김'}`,
          onclick: () => { if (!open) { UI.toast('앞 맵을 먼저 지켜 내야 합니다', 'warn'); return; } UI.sfx('click'); UI.show('brief', { mapId: m.id }); },
        }, [
          el('span', { class: 'mn-medal' }, [
            el('span', { class: 'mn-id', text: m.id }),
            open ? null : UI.icon('lock', 'mn-lock'),
            m.boss ? el('span', { class: 'mn-boss', 'aria-hidden': 'true' }, [UI.icon('crown', 'mn-crown')]) : null,
          ]),
          open ? UI.stars(rec.stars || 0, 3, 'mn-stars') : null,
          el('span', { class: 'mn-name', text: m.name }),
          open && (rec.task || rec.challenge) ? el('span', { class: 'mn-extra' }, [rec.task ? '공명 ✓' : '', rec.challenge ? ' 도전 ✓' : '']) : null,
        ]);
        node.style.setProperty('--i', i);
        UI.tooltipFor(node, () => `<b>${m.id} ${m.name}</b><br>${open ? `★ ${rec.stars || 0}/3${rec.task ? ' · 공명 과제 ✓' : ''}${rec.challenge ? ' · 도전 ✓' : ''}${m.boss ? '<br>보스 맵' : ''}` : '앞 맵을 먼저 지켜 내야 합니다'}`);
        nodes.appendChild(node);
      });
      if (!maps.length) nodes.appendChild(el('p', { class: 'dim wm-empty', text: '이 지역은 아직 준비 중입니다.' }));
      // 무한 맵
      const endless = (D().endless || []).filter((e) => e.region === worldRegion);
      for (const e of endless) {
        const open = P().mapUnlocked(e.id);
        nodes.appendChild(el('button', { class: `map-node endless ${open ? '' : 'locked'}`, style: pos(6), 'aria-label': `무한 맵 ${e.name}`, onclick: () => { if (!open) { UI.toast('지역 보스를 쓰러뜨리면 열립니다', 'warn'); return; } UI.show('brief', { mapId: e.id }); } }, [
          el('span', { class: 'mn-medal' }, [el('span', { class: 'mn-id', text: '∞' }), open ? null : UI.icon('lock', 'mn-lock')]),
          el('span', { class: 'mn-name', text: e.name }),
          el('span', { class: 'mn-extra', text: open ? `최고 ${P().get().endless[e.id] || 0}웨이브` : '잠김' }),
        ]));
      }
      // 방향키로 메달 사이 옮기기
      nodes.addEventListener('keydown', (ev) => {
        const list = [...nodes.querySelectorAll('.map-node')];
        const i = list.indexOf(document.activeElement);
        if (i < 0) return;
        if (ev.key === 'ArrowRight' || ev.key === 'ArrowDown') { list[(i + 1) % list.length].focus(); ev.preventDefault(); }
        if (ev.key === 'ArrowLeft' || ev.key === 'ArrowUp') { list[(i - 1 + list.length) % list.length].focus(); ev.preventDefault(); }
      });
      const plate = el('div', { class: 'region-desc wm-plate' }, [
        RG.art.regionEmblem ? UI.svgImg(RG.art.regionEmblem(reg.id), 'wm-emblem', '') : null,
        el('div', {}, [el('h3', { text: `${reg.id}. ${reg.name}` }), el('p', { text: reg.desc })]),
      ]);
      const frame = el('div', { class: 'wm-frame' }, [nodes, plate]);
      board.appendChild(frame);
      // 지도 크기: 남은 자리에 16:9로 꽉 차게 (가로·세로 중 모자란 쪽에 맞춤)
      const fit = () => {
        const bw = board.clientWidth - 28; // 금빛 테두리(그림자 고리)가 잘리지 않게 여유
        const bh = board.clientHeight - 22;
        if (bw <= 0 || bh <= 0) return;
        const w = Math.min(bw, bh * 16 / 9);
        frame.style.width = `${Math.floor(w)}px`;
        frame.style.height = `${Math.floor(w * 9 / 16)}px`;
        frame.style.setProperty('--wm', `${Math.floor(w)}px`);
      };
      requestAnimationFrame(fit);
      if (!worldFitBound) { worldFitBound = true; window.addEventListener('resize', () => { const f0 = document.querySelector('#screen-world.active .wm-frame'); if (f0 && f0._fit) f0._fit(); }); }
      frame._fit = fit;
      sec.append(head, tabs, board);
      requestAnimationFrame(() => { fit(); const f0 = nodes.querySelector('.map-node.frontier') || nodes.querySelector('.map-node:not(.locked)'); if (f0 && UI.keyboardUser && UI.keyboardUser()) f0.focus(); });
    },
  });

  /* =====================================================
   * 출정 준비
   * ===================================================== */
  UI.register('brief', {
    enter(sec, data) {
      sec.innerHTML = '';
      const def = D().maps.find((m) => m.id === data.mapId) || D().endless.find((m) => m.id === data.mapId);
      const isEndless = !D().maps.includes(def);
      const rec = P().mapRec(def.id);
      let mode = data.mode || (isEndless ? 'endless' : 'normal');
      const heroes = P().heroesFor(def.id);
      let hero = data.hero || (heroes.includes(P().get().lastHero) ? P().get().lastHero : (def.hero && heroes.includes(def.hero) ? def.hero : heroes[0]));
      if (def.hero && !RG.progress.mapRec(def.id).cleared && heroes.includes(def.hero) && !data.hero) hero = def.hero;
      // 탑은 뽑기로 얻은 것 전부 (2026-11-10 개정: 예전엔 맵마다 해금)
      const towers = P().ownedTowers();
      // "붙잡기 없이" 도전에서 근접 영웅이 골라져 있으면 근접 아닌 영웅으로 바꿈 (영웅이 조용히 빠지지 않게)
      if (mode === 'challenge' && def.challenge && def.challenge.type === 'noBlock' && hero && D().heroes[hero].melee) {
        hero = heroes.find((h) => !D().heroes[h].melee) || null;
      }
      const pm = RG.grid.parseMap(def);

      const head = el('header', { class: 'top-bar' }, [
        el('button', { class: 'icon-btn', title: '지도', onclick: () => UI.show('world', {}) }, [UI.icon('back')]),
        el('h2', { text: `${def.id} ${def.name}` }),
        el('span', { class: 'dim', text: D().regions[def.region - 1].name }),
      ]);
      const preview = el('div', { class: 'brief-preview' }, [UI.svgImg(RG.art.mapBackground ? RG.art.mapBackground(pm) : RG.art.icon('map'), 'brief-map')]);
      // 입구·등불 표시
      const marks = el('div', { class: 'brief-marks' });
      const mk = (c, r, cls, text) => { const m = el('span', { class: `bm ${cls}`, text }); m.style.left = `${((c + 0.5) / pm.cols) * 100}%`; m.style.top = `${((r + 0.5) / pm.rows) * 100}%`; marks.appendChild(m); };
      for (const s of pm.spawns) mk(s.c, s.r, 'bm-spawn', '입구');
      mk(pm.lantern.c, pm.lantern.r, 'bm-lantern', '등불');
      preview.appendChild(marks);

      const waves = def.waves ? def.waves.length : 0;
      const info = el('div', { class: 'brief-info' }, [
        el('div', { class: 'brief-facts' }, [
          fact('wave', '웨이브', isEndless ? '끝없음' : String(waves)),
          fact('gold', '시작 골드', String(def.startGold)),
          fact('map', '종류', ({ fixed: '고정 길', maze: '길 만들기', mixed: '혼합' })[def.type] || def.type),
          isEndless ? fact('star', '최고 기록', `${P().get().endless[def.id] || 0}웨이브`) : fact('star', '별', `${P().mapStars(def.id)}/5`),
        ]),
      ]);
      // 모드
      const modes = el('div', { class: 'mode-tabs' });
      const addMode = (id, label, enabled, why) => {
        modes.appendChild(el('button', { class: `mode-tab ${mode === id ? 'on' : ''} ${enabled ? '' : 'locked'}`, onclick: () => { if (!enabled) { UI.toast(why, 'warn'); return; } UI.show('brief', { mapId: def.id, mode: id, hero }); } }, [label]));
      };
      if (!isEndless) {
        addMode('normal', '캠페인', true);
        addMode('challenge', '도전', !!rec.cleared, '캠페인을 먼저 클리어하세요');
      } else addMode('endless', '무한', true);
      info.appendChild(modes);
      if (mode === 'normal' && def.task) info.appendChild(el('div', { class: `brief-goal ${rec.task ? 'done' : ''}` }, [el('b', { text: '공명 과제' }), el('span', { text: def.task.text }), rec.task ? el('em', { text: ' ✓ 달성' }) : null]));
      if (mode === 'challenge' && def.challenge) info.appendChild(el('div', { class: `brief-goal challenge ${rec.challenge ? 'done' : ''}` }, [el('b', { text: '도전 규칙' }), el('span', { text: def.challenge.text }), el('small', { class: 'dim', text: ' · 기술 나무 효과 없음' }), rec.challenge ? el('em', { text: ' ✓ 클리어' }) : null]));

      // 영웅
      const heroRow = el('div', { class: 'hero-pick' });
      const noHero = mode === 'challenge' && def.challenge && def.challenge.type === 'noHero';
      if (noHero) heroRow.appendChild(el('p', { class: 'dim', text: '이 도전에서는 영웅을 데려갈 수 없습니다.' }));
      else {
        for (const h of D().heroOrder) {
          const unlocked = heroes.includes(h);
          const hd = D().heroes[h];
          const banned = mode === 'challenge' && def.challenge && def.challenge.type === 'noBlock' && hd.melee;
          heroRow.appendChild(el('button', {
            class: `hp-item ${hero === h ? 'on' : ''} ${unlocked && !banned ? '' : 'locked'}`,
            title: unlocked ? `${hd.name} — ${hd.title}` : '아직 만나지 못한 영웅',
            onclick: () => { if (!unlocked || banned) return; UI.sfx('click'); UI.show('brief', { mapId: def.id, mode, hero: h }); },
          }, [unlocked ? UI.portrait(h, hero === h ? 'happy' : 'normal', 'hp-portrait') : el('span', { class: 'hp-q', text: '?' }), el('span', { text: unlocked ? hd.name : '???' }),
            unlocked && P().bondOf(h).level > 1 ? el('i', { class: 'hp-bond', title: `인연 Lv${P().bondOf(h).level}`, text: P().bondOf(h).level }) : null]));
        }
      }
      const hd = hero && D().heroes[hero];
      const grow = hd && !noHero ? P().heroGrowth(hero) : null;
      const growNote = !grow ? null : mode === 'challenge' ? el('small', { class: 'dim', text: ' · 도전에서는 영웅 성장(재능·장신구)이 쓰이지 않습니다' })
        : el('small', { class: 'good', text: ` · 인연 Lv${grow.level} 재능 ${grow.talents.length}칸${grow.gear.length ? ` · 장신구 ${grow.gear.map(([id, pl]) => `${D().growth.gear[id].name}${pl ? `+${pl}` : ''}`).join(', ')}` : ''}` });
      const heroInfo = hd && !noHero ? el('p', { class: 'hero-blurb' }, [el('b', { text: `${hd.name} · ${hd.title}` }), ` — ${hd.skill.name}: ${hd.skill.desc}`, growNote]) : null;

      // 탑과 적
      const towerRow = el('div', { class: 'chip-row' });
      for (const t of towers) {
        const rank = P().towerRank(t);
        const fin = RG.gacha.isFinal(rank);
        const chip = el('span', { class: `t-chip rar-${RG.gacha.rarityOf(t)}` }, [UI.towerImg(t, fin && mode !== 'challenge' ? 2 : 1, null, 'mini'), rank > 0 ? el('em', { class: `rank${fin ? ' fin' : ''}`, text: fin ? '★' : `+${rank}` }) : null]);
        // 도전 모드는 뽑기 강화를 쓰지 않음(sim.js ranks)
        const rankNote = mode === 'challenge' ? (rank > 0 ? '<br><span class="dim">도전에서는 뽑기 강화가 적용되지 않습니다</span>' : '') : fin ? '<br><span class="good">맵에 같은 값으로 Lv2부터 지어집니다</span>' : '';
        UI.tooltipFor(chip, () => `<b>${esc(D().towers[t].name)}</b>${rank > 0 ? ` <span class="good">${RG.gacha.rankLabel(rank)} (${esc(rankText(t, rank))})</span>` : ''}${rankNote}<br>${esc(D().towers[t].desc)}`);
        towerRow.appendChild(chip);
      }
      const missing = D().towerOrder.length - towers.length;
      if (missing > 0) towerRow.appendChild(el('button', { class: 't-chip more', title: '탑 뽑기', onclick: () => UI.show('gacha', { back: { screen: 'brief', data: { mapId: def.id, mode, hero } } }) }, [el('b', { text: `+${missing}` }), el('small', { text: '뽑기' })]));
      const enemyRow = el('div', { class: 'chip-row' });
      const eset = new Set();
      for (const w of RG.grid.parseWaves(def.waves || [])) for (const g of w.groups) eset.add(g.e);
      if (isEndless) for (const e of D().regionPools[def.region] || []) eset.add(e);
      for (const e of eset) {
        const isNew = (def.newEnemies || []).includes(e);
        const chip = el('span', { class: `e-chip ${isNew ? 'new' : ''}` }, [UI.enemyImg(e, 'mini'), isNew ? el('em', { text: 'NEW' }) : null]);
        UI.tooltipFor(chip, () => `<b>${esc(D().enemies[e].name)}</b><br>${esc(D().enemies[e].desc)}`);
        enemyRow.appendChild(chip);
      }
      const run = RG.save.get(RG.save.KEYS.run, null);
      const resume = run && run.mapId === def.id && run.opts.mode === mode;
      const start = () => {
        try { if (RG.audio) RG.audio.init(); } catch (e) { /* 무시 */ }
        UI.sfx('click');
        if (hero) { P().get().lastHero = hero; P().save(); }
        const opts = {
          mapId: def.id, mode, heroId: noHero ? null : hero, skills: P().get().skills.slice(),
          seed: (Math.random() * 1e9) >>> 0, towers, towerRanks: P().towerRanks(), finalLv2: true, branches: P().branchesUnlocked(),
        };
        // 영웅 성장(인연 재능·장신구)은 시작 때 복사 — 도전 모드에서는 판이 쓰지 않음
        const growth = !noHero && hero && mode !== 'challenge' ? P().heroGrowth(hero) : null;
        if (growth) opts.heroGrowth = growth;
        const go = () => UI.show('game', { opts });
        const story = def.story && def.story.before;
        if (mode === 'normal' && story && D().story[story] && !P().seen('story', story)) UI.show('story', { id: story, then: go });
        else go();
      };
      const actions = el('div', { class: 'brief-actions' }, [
        resume ? el('button', { class: 'btn', onclick: () => UI.show('game', { resume: run }) }, [`이어하기 (웨이브 ${run.wave})`]) : null,
        el('button', { class: 'btn btn-primary btn-big', onclick: start }, [resume ? '새로 시작' : '출정!']),
      ]);
      info.append(
        el('div', { class: 'sec-title', text: '영웅' }), heroRow, heroInfo,
        el('div', { class: 'sec-title', text: `내 탑 (${towers.length}/${D().towerOrder.length})` }), towerRow,
        el('div', { class: 'sec-title', text: '나오는 적' }), enemyRow,
        actions,
      );
      sec.append(head, el('div', { class: 'brief-body' }, [preview, info]));
    },
  });

  function fact(icon, label, value) {
    return el('div', { class: 'fact' }, [UI.icon(icon, 'tiny'), el('span', { text: label }), el('b', { text: value })]);
  }

  /* =====================================================
   * 결과
   * ===================================================== */
  UI.register('result', {
    enter(sec, data) {
      sec.innerHTML = '';
      const win = data.result === 'win';
      UI.music(win ? 'victory' : 'defeat');
      UI.sfx(win ? 'win' : 'lose');
      const def = D().maps.find((m) => m.id === data.mapId) || D().endless.find((m) => m.id === data.mapId);
      const box = el('div', { class: `result-box ${win ? 'win' : 'lose'}` });
      const hero = data.opts.heroId;
      if (hero) box.appendChild(UI.portrait(hero, win ? 'happy' : 'worried', 'result-portrait'));
      box.appendChild(el('h2', { text: data.mode === 'endless' ? `${data.waves}웨이브까지 버텼다!` : win ? '등불을 지켜 냈다!' : data.timeout ? '시간이 너무 오래 걸렸다…' : '등불이 꺼졌다…' }));
      box.appendChild(el('p', { class: 'dim', text: `${def.id} ${def.name} · ${data.mode === 'challenge' ? `도전 (${def.challenge.text})` : data.mode === 'endless' ? '무한' : '캠페인'}` }));
      if (win && data.mode === 'normal') {
        const s = el('div', { class: 'result-stars' });
        for (let i = 0; i < 3; i++) {
          const star = UI.icon(i < data.rec.stars ? 'star' : 'star_empty', 'big-star');
          star.style.animationDelay = `${0.25 + i * 0.3}s`;
          s.appendChild(star);
          if (i < data.rec.stars) setTimeout(() => UI.sfx('star'), 300 + i * 300);
        }
        box.appendChild(s);
        box.appendChild(el('p', { text: `남은 등불 불꽃 ${data.lives}/${data.maxLives}` }));
        if (data.task) box.appendChild(el('p', { class: data.task.done ? 'good' : 'dim', text: `공명 과제 "${def.task.text}" ${data.task.done ? '달성!' : '미달성'}` }));
      }
      if (win && data.mode === 'challenge') box.appendChild(el('p', { class: 'good', text: '도전 클리어! ★+1' }));
      if (data.rec.newStars > 0) box.appendChild(el('p', { class: 'good', text: `새로 얻은 별 ★${data.rec.newStars} — 기술 나무에서 쓸 수 있습니다` }));
      // 해금
      // 공명석 + 뽑기에 새로 들어온 탑 (탑은 뽑기로만 얻음 — 스테이지가 열리면 뽑기에 들어올 뿐)
      const rw = data.rec.reward;
      if (rw && (rw.crystals || (rw.pooled && rw.pooled.length))) {
        const rb = el('div', { class: 'reward-box' }, [
          el('div', { class: 'rw-total' }, [UI.icon('crystal', 'small'), el('b', { text: `+${rw.crystals}` }), el('span', { text: '공명석' })]),
          el('div', { class: 'rw-lines dim', text: rw.lines.map(([k, v]) => `${k} +${v}`).join(' · ') }),
          rw.pooled && rw.pooled.length ? el('div', { class: 'rw-pool' }, [
            el('span', { class: 'rw-pool-t', text: rw.pooled.length > 1 ? `지역을 지켜 내서 뽑기에 새 탑 ${rw.pooled.length}종이 한꺼번에 들어왔습니다!` : '뽑기에 새 탑이 들어왔습니다' }),
            ...rw.pooled.map((t) => el('span', { class: `rw-pool-tower rar-${RG.gacha.rarityOf(t)}` }, [UI.towerImg(t, 1, null, 'mini'), el('b', { text: D().towers[t].name }), el('small', { text: RG.gacha.RARITIES[RG.gacha.rarityOf(t)].name })])),
          ]) : null,
        ]);
        box.appendChild(rb);
      }
      const un = data.rec.unlocks;
      if (un && (un.heroes.length || un.branches)) {
        const ul = el('div', { class: 'unlocks' });
        for (const h of un.heroes) ul.appendChild(el('div', { class: 'unlock' }, [UI.portrait(h, 'happy', 'mini-portrait'), el('span', { text: `새 영웅: ${D().heroes[h].name}` })]));
        if (un.branches) ul.appendChild(el('div', { class: 'unlock' }, [UI.icon('upgrade', 'small'), el('span', { text: '분기 강화(Lv4)가 열렸습니다!' })]));
        box.appendChild(ul);
        setTimeout(() => UI.sfx('unlock'), 1300);
      }
      // 영웅 인연 · 새 장신구 (docs/design/hero-growth.md)
      const bd = data.rec.bond;
      const gearGot = (data.rec.gear || []).filter((g) => g && (g.id || g.crystals));
      if ((bd && bd.gain > 0) || gearGot.length) {
        const gb = el('div', { class: 'growth-box' });
        if (bd && bd.gain > 0) {
          const hn = D().heroes[bd.heroId].name;
          gb.appendChild(el('div', { class: `gb-bond ${bd.levelUp ? 'up' : ''}` }, [
            UI.portrait(bd.heroId, bd.levelUp ? 'happy' : 'normal', 'mini-portrait'),
            el('span', { text: bd.levelUp ? `${hn} 인연 Lv${bd.after}! 재능 점수 +${bd.after - bd.before}` : `${hn} 인연 +${bd.gain}` }),
            bd.levelUp ? el('button', { class: 'btn small', onclick: () => UI.show('heroes', { hero: bd.heroId, tab: 'grow', back: { screen: 'world', data: {} } }) }, ['재능 찍기']) : null,
          ]));
        }
        for (const g of gearGot) {
          if (!g.id) { gb.appendChild(el('div', { class: 'gb-gear' }, [UI.icon('crystal', 'small'), el('span', { text: `장신구를 모두 최대로 강화해서 공명석 +${g.crystals}` })])); continue; }
          const gd = D().growth.gear[g.id];
          gb.appendChild(el('div', { class: `gb-gear r-${gd.rarity}` }, [
            UI.svgImg(RG.art.gearIcon(g.id), 'gb-ico', ''),
            el('span', { text: g.isNew ? `새 장신구: ${gd.name} (${D().growth.gearRarities[gd.rarity].name})` : `${gd.name} +${g.plus} (이미 가진 장신구라 강화됨)` }),
          ]));
        }
        box.appendChild(gb);
        if ((bd && bd.levelUp) || gearGot.some((g) => g.isNew)) setTimeout(() => UI.sfx('unlock'), 1600);
      }
      // 통계
      const dmg = Object.entries(data.stats.damage || {}).map(([id, v]) => [data.stats.towers.find((t) => String(t.id) === id), v]).filter(([t]) => t).sort((a, b) => b[1] - a[1]).slice(0, 6);
      const total = dmg.reduce((s, [, v]) => s + v, 0) + (data.stats.heroDamage || 0) || 1;
      const st = el('div', { class: 'result-stats' });
      st.appendChild(el('div', { class: 'sec-title', text: `처치 ${data.stats.kills} · 번 골드 ${Math.round(data.stats.gold)} · ${Math.floor(data.stats.time / 60)}분 ${Math.floor(data.stats.time % 60)}초` }));
      for (const [t, v] of dmg) {
        const name = t.level >= 4 ? D().towers[t.type].branches[t.branch].name : `${D().towers[t.type].name} Lv${t.level}`;
        st.appendChild(el('div', { class: 'dmg-row' }, [UI.towerImg(t.type, t.level, t.branch, 'mini'), el('span', { text: name }), el('div', { class: 'dmg-bar' }, [el('i', { style: { width: `${(v / total) * 100}%`, background: D().elements[D().towers[t.type].element].color } })]), el('b', { text: Math.round(v).toLocaleString() })]));
      }
      if (data.stats.heroDamage) st.appendChild(el('div', { class: 'dmg-row' }, [UI.portrait(hero, 'normal', 'mini-portrait'), el('span', { text: D().heroes[hero].name }), el('div', { class: 'dmg-bar' }, [el('i', { style: { width: `${(data.stats.heroDamage / total) * 100}%`, background: '#fff' } })]), el('b', { text: Math.round(data.stats.heroDamage).toLocaleString() })]));
      box.appendChild(st);
      // 버튼
      const next = P().nextMapId(def.id);
      const after = win && data.mode === 'normal' && def.story && def.story.after;
      const afterStory = after && D().story[after] && !P().seen('story', after);
      const goWorld = () => UI.show('world', {});
      const btns = el('div', { class: 'result-buttons' }, [
        el('button', { class: 'btn', onclick: () => UI.show('brief', { mapId: def.id, mode: data.mode, hero }) }, ['다시 하기']),
        el('button', { class: 'btn', onclick: () => (afterStory ? UI.show('story', { id: after, then: goWorld }) : goWorld()) }, ['월드 지도']),
        el('button', { class: `btn btn-gacha ${canPull() ? 'ready' : ''}`, onclick: () => UI.show('gacha', {}) }, [UI.icon('crystal', 'tiny'), '탑 뽑기']),
        win && next && data.mode === 'normal' ? el('button', { class: 'btn btn-primary', onclick: () => { const go = () => UI.show('brief', { mapId: next }); if (afterStory) UI.show('story', { id: after, then: go }); else go(); } }, ['다음 맵 ▶']) : null,
      ]);
      box.appendChild(btns);
      sec.appendChild(box);
    },
  });
})();
