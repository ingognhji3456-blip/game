'use strict';

/* 아래쪽 타임라인: 지질 시대 색띠, 사건 표시, 재생 위치. 끌어서 시간 이동, 표시를 누르면 그 사건으로 */
(function () {
  const EC = (window.EC = window.EC || {});
  const U = EC.util;

  const KIND_COLOR = {
    astro: '#b39dff',
    geo: '#d6b07a',
    climate: '#7cc4ff',
    life: '#7ee0a1',
    extinction: '#ffcf6b',
    intervention: '#ff7a5c',
    human: '#ffffff',
  };

  const TICKS = [
    [-4000, '40억 년 전'], [-2000, '20억'], [-541, '5억'], [-252, '2.5억'], [-66, '6,600만'], [-2.58, '258만'],
    [-0.3, '30만'], [0, '현재'], [250, '2.5억 년 후'], [1000, '10억'], [5000, '50억'],
  ];

  class Timeline {
    constructor(el, app) {
      this.el = el;
      this.canvas = el.querySelector('canvas');
      this.tip = el.querySelector('.tl-tip');
      this.ctx = this.canvas.getContext('2d');
      this.app = app;
      this.events = [];
      this.hover = null;
      this.dirty = true;
      this.pad = 8;
      this.down = null;
      this.bind();
    }

    setEvents(list) {
      this.events = list;
      this.dirty = true;
    }

    xOf(t) {
      return this.pad + EC.time.toS(t) * (this.w - this.pad * 2);
    }

    tOf(x) {
      return EC.time.fromS((x - this.pad) / (this.w - this.pad * 2));
    }

    resize() {
      const r = this.el.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.w = r.width;
      this.h = r.height;
      this.canvas.width = Math.round(r.width * dpr);
      this.canvas.height = Math.round(r.height * dpr);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.dirty = true;
    }

    nearest(x, maxDist) {
      let best = null;
      let bd = maxDist;
      for (const e of this.events) {
        const d = Math.abs(this.xOf(e.t) - x) - (e.major ? 1.5 : 0);
        if (d < bd) { bd = d; best = e; }
      }
      return best;
    }

    bind() {
      const el = this.el;
      const pos = (ev) => {
        const r = el.getBoundingClientRect();
        return ev.clientX - r.left;
      };
      el.addEventListener('pointerdown', (ev) => {
        el.setPointerCapture(ev.pointerId);
        const x = pos(ev);
        this.down = { x, moved: false, marker: this.nearest(x, ev.pointerType === 'touch' ? 9 : 6) };
        this.app.beginScrub();
        if (!this.down.marker) this.app.seek(this.tOf(x));
      });
      el.addEventListener('pointermove', (ev) => {
        const x = pos(ev);
        if (this.down) {
          if (Math.abs(x - this.down.x) > 4) this.down.moved = true;
          if (this.down.moved || !this.down.marker) this.app.seek(this.tOf(x));
        }
        this.hover = { x, marker: this.down ? null : this.nearest(x, 6) };
        this.showTip();
        this.dirty = true;
      });
      const end = (ev) => {
        if (!this.down) return;
        const d = this.down;
        this.down = null;
        if (!d.moved && d.marker) this.app.jumpToEvent(d.marker);
        this.app.endScrub();
        if (ev.pointerType === 'touch') { this.hover = null; this.showTip(); }
      };
      el.addEventListener('pointerup', end);
      el.addEventListener('pointercancel', end);
      el.addEventListener('pointerleave', () => {
        if (!this.down) { this.hover = null; this.showTip(); this.dirty = true; }
      });
    }

    showTip() {
      const tip = this.tip;
      if (!this.hover) { tip.hidden = true; return; }
      const m = this.hover.marker;
      const x = m ? this.xOf(m.t) : this.hover.x;
      const t = m ? m.t : this.tOf(this.hover.x);
      let html = `<small>${U.escapeHtml(U.formatTime(t))}</small>`;
      if (m) {
        const pre = m.kind === 'intervention' ? '당신의 개입 · ' : m.prevented ? '막은 사건 · ' : '';
        html = `<b>${U.escapeHtml(pre + m.title)}</b><br>${html}`;
      }
      tip.innerHTML = html;
      tip.hidden = false;
      const half = tip.offsetWidth / 2;
      tip.style.left = `${U.clamp(x, half + 4, this.w - half - 4)}px`;
    }

    draw(t) {
      if (!this.w) this.resize();
      if (!this.dirty && this.lastT === t) return;
      this.dirty = false;
      this.lastT = t;
      const c = this.ctx;
      const W = this.w;
      const H = this.h;
      c.clearRect(0, 0, W, H);

      const trackY = Math.round(H * 0.38);
      const trackH = 5;
      const cy = trackY + trackH / 2;
      const px = this.xOf(t);

      /* 지질 시대 색으로 칠한 트랙: 지나온 곳은 진하게 */
      for (const e of EC.data.eons) {
        const x0 = this.xOf(e.from);
        const x1 = this.xOf(e.to);
        c.fillStyle = e.color;
        c.globalAlpha = 0.28;
        c.fillRect(x0, trackY, x1 - x0 - 1, trackH);
        if (px > x0) {
          c.globalAlpha = 0.95;
          c.fillRect(x0, trackY, Math.min(px, x1) - x0 - (px >= x1 ? 1 : 0), trackH);
        }
      }
      c.globalAlpha = 1;

      const hoverM = this.hover && this.hover.marker;
      for (const e of this.events) {
        const x = this.xOf(e.t);
        const color = KIND_COLOR[e.kind] || '#fff';
        const hot = e === hoverM;
        c.globalAlpha = hot ? 1 : e.t <= t ? 0.9 : 0.5;
        if (e.kind === 'intervention') {
          const r = hot ? 6 : 4.5;
          c.fillStyle = color;
          c.beginPath();
          c.moveTo(x, cy - r); c.lineTo(x + r, cy); c.lineTo(x, cy + r); c.lineTo(x - r, cy);
          c.closePath();
          c.fill();
        } else if (e.kind === 'extinction') {
          c.strokeStyle = e.prevented ? '#7d8597' : color;
          c.lineWidth = hot ? 2.5 : 1.6;
          c.beginPath();
          c.moveTo(x, trackY - 7);
          c.lineTo(x, trackY + trackH + 5);
          c.stroke();
        } else {
          c.fillStyle = color;
          c.beginPath();
          c.arc(x, trackY - 7, hot ? 3.5 : e.major ? 2.4 : 1.5, 0, Math.PI * 2);
          c.fill();
        }
      }
      c.globalAlpha = 1;

      c.font = '10px sans-serif';
      c.textBaseline = 'alphabetic';
      c.fillStyle = 'rgba(200,210,235,0.5)';
      let lastX = -999;
      for (const [tt, label] of TICKS) {
        const x = this.xOf(tt);
        const w = c.measureText(label).width;
        if (x - w / 2 < lastX + 10 || x + w / 2 > W) continue;
        c.fillText(label, Math.max(0, x - w / 2), H - 9);
        lastX = x + w / 2;
      }

      c.fillStyle = '#fff';
      c.shadowColor = 'rgba(140,200,255,0.9)';
      c.shadowBlur = 12;
      c.beginPath();
      c.arc(px, cy, 7, 0, Math.PI * 2);
      c.fill();
      c.shadowBlur = 0;

      this.el.setAttribute('aria-valuenow', String(Math.round(EC.time.toS(t) * 1000)));
      this.el.setAttribute('aria-valuetext', U.formatTime(t));
    }
  }

  function roundRect(c, x, y, w, h, r) {
    r = Math.min(r, h / 2, w / 2);
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  EC.ui = EC.ui || {};
  EC.ui.Timeline = Timeline;
  EC.ui.KIND_COLOR = KIND_COLOR;
})();
