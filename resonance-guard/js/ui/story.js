'use strict';

/* =========================================================
 * 이야기 장면 — 초상화와 대화 상자, 글자가 한 자씩 나타남
 * ========================================================= */
(() => {
  const { el } = RG.util;
  const UI = RG.ui;
  let timer = 0;

  UI.register('story', {
    enter(sec, data) {
      const sc = RG.data.story[data.id];
      if (!sc) { if (data.then) data.then(); return; }
      RG.progress.markSeen('story', data.id);
      sec.innerHTML = '';
      const bg = el('div', { class: 'story-bg' }, [UI.svgImg(RG.art.regionBanner ? RG.art.regionBanner(sc.region || 1) : '', 'story-banner')]);
      const title = el('div', { class: 'story-title', text: sc.title });
      const stageL = el('div', { class: 'story-portrait left' });
      const stageR = el('div', { class: 'story-portrait right' });
      const nameEl = el('div', { class: 'story-name' });
      const textEl = el('div', { class: 'story-text' });
      const hint = el('div', { class: 'story-hint', text: '눌러서 계속 ▶' });
      const box = el('div', { class: 'story-box' }, [nameEl, textEl, hint]);
      const skip = el('button', { class: 'btn small story-skip', onclick: (e) => { e.stopPropagation(); done(); } }, ['건너뛰기']);
      sec.append(bg, title, stageL, stageR, box, skip);
      let i = -1;
      let typing = false;
      let full = '';
      const sides = {};   // 화자별 위치 기억
      let nextSide = 'left';

      function show(line) {
        clearInterval(timer);
        const who = line.who;
        const spk = RG.data.speakers[who] || { name: who };
        nameEl.textContent = spk.name;
        nameEl.classList.toggle('hidden', who === 'narration');
        box.classList.toggle('narration', who === 'narration');
        if (who !== 'narration') {
          if (!sides[who]) { sides[who] = nextSide; nextSide = nextSide === 'left' ? 'right' : 'left'; }
          const slot = sides[who] === 'left' ? stageL : stageR;
          const other = sides[who] === 'left' ? stageR : stageL;
          slot.innerHTML = '';
          slot.appendChild(UI.portrait(who, line.mood || 'normal', 'story-face'));
          slot.classList.add('speaking');
          other.classList.remove('speaking');
        } else { stageL.classList.remove('speaking'); stageR.classList.remove('speaking'); }
        full = line.text;
        textEl.textContent = '';
        typing = true;
        let k = 0;
        timer = setInterval(() => {
          k += 2;
          textEl.textContent = full.slice(0, k);
          if (k % 6 === 0) UI.sfx('dialog', { vol: 0.25 });
          if (k >= full.length) { clearInterval(timer); typing = false; }
        }, 28);
      }
      function advance() {
        if (typing) { clearInterval(timer); textEl.textContent = full; typing = false; return; }
        i += 1;
        if (i >= sc.lines.length) { done(); return; }
        show(sc.lines[i]);
      }
      function done() {
        clearInterval(timer);
        sec.onclick = null;
        document.removeEventListener('keydown', onKey);
        if (data.then) data.then(); else UI.show('world', {});
      }
      function onKey(e) {
        if (UI.currentId() !== 'story') return;
        if (e.key === 'Escape') done();
        else if ((e.key === ' ' || e.key === 'Enter') && e.target && e.target.closest && e.target.closest('.story-skip')) return; // 건너뛰기 버튼은 그대로 눌림
        else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); advance(); }
      }
      sec.onclick = () => advance();
      document.addEventListener('keydown', onKey);
      advance();
    },
    leave() { clearInterval(timer); },
  });
})();
