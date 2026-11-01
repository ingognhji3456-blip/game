'use strict';

/* =========================================================
 * 지도 화면 — 세로 스크롤 분기 지도
 * ========================================================= */
(() => {
  const el = CB.util.el;
  const NODE_NAMES = { combat: '전투', elite: '정예', rest: '휴식처', shop: '상점', event: '미지의 장소', treasure: '보물', boss: '보스' };
  const NODE_DESC = {
    combat: '평범한 적과 싸웁니다.',
    elite: '강력한 적이 지키고 있습니다. 유물을 얻을 수 있습니다.',
    rest: '체력을 회복하거나 카드를 강화합니다.',
    shop: '골드로 카드·유물·물약을 삽니다.',
    event: '무슨 일이 일어날지 모릅니다.',
    treasure: '보물 상자가 놓여 있습니다.',
    boss: '이 막의 주인이 기다립니다.',
  };
  const ROW_H = 92;

  function build(run, { interactive, onSelect }) {
    const map = run.map;
    const rows = map.rows.length;
    const height = (rows + 1) * ROW_H + 190;
    const avail = new Set(interactive ? CB.run.availableNodes(run).map((n) => n.id) : []);
    const visitedPath = new Set();
    CB.run.allNodes(run).forEach((n) => { if (n.visited) visitedPath.add(n.id); });

    const scroller = el('div', { class: 'map-scroller' });
    const canvas = el('div', { class: 'map-canvas', style: { height: `${height}px` } });
    scroller.appendChild(canvas);

    const pos = (node) => {
      if (node.type === 'boss') return { x: 50, y: 70 };
      return { x: node.x * 100, y: height - 90 - node.row * ROW_H };
    };

    // 연결선
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('class', 'map-lines');
    svg.setAttribute('viewBox', `0 0 100 ${height}`);
    svg.setAttribute('preserveAspectRatio', 'none');
    for (const node of CB.run.allNodes(run)) {
      for (const nextId of node.next) {
        const next = CB.run.findNode(run, nextId);
        if (!next) continue;
        const a = pos(node);
        const b = pos(next);
        const path = document.createElementNS(svgNS, 'path');
        const midY = (a.y + b.y) / 2;
        path.setAttribute('d', `M${a.x} ${a.y} C${a.x} ${midY} ${b.x} ${midY} ${b.x} ${b.y}`);
        let cls = 'map-line';
        if (node.visited && next.visited) cls += ' walked';
        else if (node.id === run.currentNodeId && avail.has(next.id)) cls += ' open';
        path.setAttribute('class', cls);
        path.setAttribute('vector-effect', 'non-scaling-stroke');
        svg.appendChild(path);
      }
    }
    canvas.appendChild(svg);

    // 칸
    for (const node of CB.run.allNodes(run)) {
      const p = pos(node);
      const classes = ['map-node', `type-${node.type}`];
      if (node.visited) classes.push('visited');
      if (node.id === run.currentNodeId) classes.push('current');
      if (avail.has(node.id)) classes.push('available');
      else if (!node.visited) classes.push('locked');
      const btn = el('button', {
        class: classes.join(' '),
        style: { left: `${p.x}%`, top: `${p.y}px` },
        'aria-label': NODE_NAMES[node.type],
        html: CB.art.mapNode(node.type),
      });
      if (node.type === 'boss') {
        const bossId = (node.enemies || [])[0];
        const def = CB.data.enemies[bossId];
        btn.innerHTML = `<div class="boss-portrait">${CB.art.enemy(bossId)}</div><div class="boss-label">${def ? CB.ui.esc(def.name) : '보스'}</div>`;
      }
      CB.ui.tooltip.bind(btn, () => {
        let extra = '';
        if (node.type === 'boss') {
          const def = CB.data.enemies[(node.enemies || [])[0]];
          if (def) extra = `<p><b>${CB.ui.esc(def.name)}</b></p>`;
        }
        return `<span class="tt-title">${NODE_NAMES[node.type]}</span><p>${NODE_DESC[node.type]}</p>${extra}`;
      });
      if (avail.has(node.id) && onSelect) {
        btn.addEventListener('click', () => onSelect(node.id));
        btn.addEventListener('mouseenter', () => CB.ui.sfx('hover'));
      }
      canvas.appendChild(btn);
      if (node.id === run.currentNodeId) {
        canvas.appendChild(el('div', { class: 'map-you', style: { left: `${p.x}%`, top: `${p.y}px` }, html: '<span>📍</span>' }));
      }
    }
    return { scroller, canvas, height, pos };
  }

  function legend() {
    const box = el('div', { class: 'map-legend panel' });
    box.appendChild(el('div', { class: 'legend-title', text: '범례' }));
    for (const type of ['combat', 'elite', 'event', 'rest', 'shop', 'treasure']) {
      box.appendChild(el('div', { class: 'legend-row', html: `<span class="legend-icon">${CB.art.mapNode(type)}</span>${NODE_NAMES[type]}` }));
    }
    return box;
  }

  function scrollToCurrent(scroller, run, built) {
    const cur = run.currentNodeId ? CB.run.findNode(run, run.currentNodeId) : null;
    const y = cur ? built.pos(cur).y : built.height;
    requestAnimationFrame(() => {
      scroller.scrollTop = Math.max(0, y - scroller.clientHeight * 0.62);
    });
  }

  CB.ui.map = {
    NODE_NAMES,
    render(container, run, opts = {}) {
      container.innerHTML = '';
      const wrap = el('div', { class: 'map-screen' });
      const header = el('div', { class: 'map-header' }, [
        el('div', { class: 'map-act', text: `${run.act}막` }),
        el('div', { class: 'map-act-name title-ornament', text: CB.ui.ACT_NAMES[run.act] || '' }),
        el('div', { class: 'map-hint', text: opts.interactive ? '빛나는 칸을 골라 나아가세요' : '' }),
      ]);
      const built = build(run, opts);
      wrap.appendChild(header);
      wrap.appendChild(built.scroller);
      wrap.appendChild(legend());
      container.appendChild(wrap);
      scrollToCurrent(built.scroller, run, built);
    },
    peek(run) {
      const built = build(run, { interactive: false });
      built.scroller.classList.add('peek');
      const h = CB.ui.modal.open({ title: `${run.act}막 · ${CB.ui.ACT_NAMES[run.act] || ''}`, el: built.scroller, dismissable: true, className: 'map-modal', buttons: [{ label: '닫기', kind: 'secondary' }] });
      scrollToCurrent(built.scroller, run, built);
      return h;
    },
  };
})();
