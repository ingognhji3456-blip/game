'use strict';

/* 아래쪽 타임라인: 시대 색띠, 사건 표시, 재생 위치. 끌어서 시간 이동, 표시를 누르면 그 사건으로 */
(function () {
  const UC = (window.UC = window.UC || {});
  const U = UC.util;

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

    get scale() { return this.app.scale; }
    xOf(t) { return this.pad + this.scale.toS(t) * (this.w - this.pad * 2); }
    tOf(x) { return this.scale.fromS((x - this.pad) / (this.w - this.pad * 2)); }

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
      const pos = (ev) => ev.clientX - el.getBoundingClientRect().left;
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
      let html = `<small>${U.escapeHtml((this.app.shortText || UC.time.shortText)(t))}</small>`;
      if (m) {
        const pre = m.kind === 'intervention' ? '' : m.prevented ? '일어나지 않음 · ' : '';
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
      const tEnd = this.scale.tEnd;

      for (const e of this.app.ages || UC.data.AGES) {
        if (e.from >= tEnd) continue;
        const x0 = this.xOf(Math.max(e.from, this.scale.tStart));
        const x1 = this.xOf(Math.min(e.to, tEnd));
        c.fillStyle = e.color;
        c.globalAlpha = 0.28;
        c.fillRect(x0, trackY, Math.max(1, x1 - x0 - 1), trackH);
        if (px > x0) {
          c.globalAlpha = 0.95;
          c.fillRect(x0, trackY, Math.max(0, Math.min(px, x1) - x0 - (px >= x1 ? 1 : 0)), trackH);
        }
      }
      c.globalAlpha = 1;

      const KC = UC.data.KIND_COLOR;
      const hoverM = this.hover && this.hover.marker;
      for (const e of this.events) {
        const x = this.xOf(e.t);
        const color = KC[e.kind] || '#fff';
        const hot = e === hoverM;
        c.globalAlpha = e.prevented ? 0.25 : hot ? 1 : e.t <= t ? 0.9 : 0.5;
        if (e.kind === 'intervention') {
          const r = hot ? 6 : 4.5;
          c.fillStyle = color;
          c.beginPath();
          c.moveTo(x, cy - r); c.lineTo(x + r, cy); c.lineTo(x, cy + r); c.lineTo(x - r, cy);
          c.closePath();
          c.fill();
        } else if (e.kind === 'end') {
          c.strokeStyle = color;
          c.lineWidth = hot ? 2.5 : 1.6;
          c.beginPath();
          c.moveTo(x, trackY - 7);
          c.lineTo(x, trackY + trackH + 5);
          c.stroke();
        } else {
          c.fillStyle = e.prevented ? '#7d8597' : color;
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
      for (const [tt, label] of this.app.ticks || UC.time.TICKS) {
        if (tt > tEnd) continue;
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

      this.el.setAttribute('aria-valuenow', String(Math.round(this.scale.toS(t) * 1000)));
      this.el.setAttribute('aria-valuetext', (this.app.clockText || UC.time.clockText)(t));
    }
  }

  UC.ui = UC.ui || {};
  UC.ui.Timeline = Timeline;
})();
