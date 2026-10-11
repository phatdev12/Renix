/* kanjiwriter.js — stroke-order animation and handwriting practice using
   KanjiVG stroke data (window.KVG = {char: {s: [pathD...], n: [[x,y]...]}}).
   Coordinates are KanjiVG's 109×109 grid. */
(function (G) {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const SIZE = 109;
  const N = 32; // resample points per stroke

  function sv(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  function polyLen(p) { let s = 0; for (let i = 1; i < p.length; i++) s += dist(p[i - 1], p[i]); return s; }
  function resample(p, n) {
    if (p.length === 1) return Array.from({ length: n }, () => p[0].slice());
    const L = [0];
    for (let i = 1; i < p.length; i++) L.push(L[i - 1] + dist(p[i - 1], p[i]));
    const total = L[L.length - 1];
    if (total === 0) return Array.from({ length: n }, () => p[0].slice());
    const out = [];
    let j = 0;
    for (let k = 0; k < n; k++) {
      const t = (total * k) / (n - 1);
      while (j < L.length - 2 && L[j + 1] < t) j++;
      const seg = L[j + 1] - L[j] || 1;
      const a = (t - L[j]) / seg;
      out.push([p[j][0] + (p[j + 1][0] - p[j][0]) * a, p[j][1] + (p[j + 1][1] - p[j][1]) * a]);
    }
    return out;
  }
  // moving-average smoothing removes hand/touch jitter before measuring
  function smoothPts(p, k) {
    k = k || 2;
    if (p.length < 2 * k + 1) return p;
    return p.map((_, i) => {
      let sx = 0, sy = 0, n = 0;
      for (let j = Math.max(0, i - k); j <= Math.min(p.length - 1, i + k); j++) { sx += p[j][0]; sy += p[j][1]; n++; }
      return [sx / n, sy / n];
    });
  }
  function avgDist(U, E) { let s = 0; for (let i = 0; i < U.length; i++) s += dist(U[i], E[i]); return s / U.length; }
  function avgDistRev(U, E) { let s = 0; const n = U.length; for (let i = 0; i < n; i++) s += dist(U[n - 1 - i], E[i]); return s / n; }
  function smooth(pts) {
    if (!pts.length) return '';
    const f = (v) => v.toFixed(1);
    if (pts.length < 3) return 'M' + pts.map((p) => f(p[0]) + ' ' + f(p[1])).join(' L');
    let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
      d += ` Q${f(pts[i][0])} ${f(pts[i][1])} ${f(mx)} ${f(my)}`;
    }
    const l = pts[pts.length - 1];
    return d + ` L${f(l[0])} ${f(l[1])}`;
  }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // hidden measuring SVG shared by all writers
  let measurer = null;
  function measure(d) {
    if (!measurer) {
      measurer = sv('svg', { width: '0', height: '0', style: 'position:absolute;left:-9999px;top:-9999px', 'aria-hidden': 'true' });
      document.body.appendChild(measurer);
    }
    const p = sv('path', { d }, measurer);
    const len = p.getTotalLength();
    const pts = [];
    for (let i = 0; i < N; i++) { const q = p.getPointAtLength((len * i) / (N - 1)); pts.push([q.x, q.y]); }
    p.remove();
    return { len, pts };
  }
  const cache = {};
  function meta(char) {
    if (cache[char]) return cache[char];
    const d = G.KVG && G.KVG[char];
    if (!d) return null;
    cache[char] = { strokes: d.s, nums: d.n || [], m: d.s.map(measure) };
    return cache[char];
  }

  const LENIENCY = { easy: 1.35, normal: 1, hard: 0.78 };
  let glowN = 0;

  class KanjiWriter {
    constructor(host, char, opts) {
      this.host = host;
      this.char = char;
      this.opts = Object.assign({ grid: true, numbers: false, leniency: 'normal', speed: 1,
        onStroke: null, onComplete: null, onMessage: null }, opts || {});
      this.k = meta(char);
      this.token = 0;
      this.mode = 'view';
      this.build();
    }

    build() {
      this.host.innerHTML = '';
      this.wrap = document.createElement('div');
      this.wrap.className = 'kw';
      this.host.appendChild(this.wrap);
      const svg = this.svg = sv('svg', { viewBox: `0 0 ${SIZE} ${SIZE}`, role: 'img', 'aria-label': 'Ô viết chữ ' + this.char }, this.wrap);
      const grid = this.gGrid = sv('g', { class: 'grid' }, svg);
      sv('rect', { x: 0.5, y: 0.5, width: SIZE - 1, height: SIZE - 1, rx: 6 }, grid);
      sv('line', { x1: SIZE / 2, y1: 2, x2: SIZE / 2, y2: SIZE - 2 }, grid);
      sv('line', { x1: 2, y1: SIZE / 2, x2: SIZE - 2, y2: SIZE / 2 }, grid);
      // soft neon glow for drawn strokes (disabled by CSS in the light theme)
      const fid = 'kwglow' + (++glowN);
      const f = sv('filter', { id: fid, x: '-25%', y: '-25%', width: '150%', height: '150%' }, sv('defs', {}, svg));
      sv('feGaussianBlur', { stdDeviation: '1.4', result: 'b' }, f);
      const mg = sv('feMerge', {}, f); sv('feMergeNode', { in: 'b' }, mg); sv('feMergeNode', { in: 'SourceGraphic' }, mg);
      const glow = { filter: `url(#${fid})` };
      this.gOutline = sv('g', { class: 'outline' }, svg);
      this.gAnim = sv('g', Object.assign({ class: 'anim' }, glow), svg);
      this.gDone = sv('g', Object.assign({ class: 'done' }, glow), svg);
      this.gHint = sv('g', Object.assign({ class: 'hint' }, glow), svg);
      this.gUser = sv('g', Object.assign({ class: 'user' }, glow), svg);
      this.gFree = sv('g', Object.assign({ class: 'free' }, glow), svg);
      this.gNums = sv('g', { class: 'nums' }, svg);
      this.gDot = sv('g', {}, svg);
      if (!this.k) {
        const t = sv('text', { x: SIZE / 2, y: SIZE / 2 + 4, 'text-anchor': 'middle', 'font-size': '8', fill: 'currentColor' }, svg);
        t.textContent = 'Chưa có dữ liệu nét cho chữ này';
        return;
      }
      this.k.strokes.forEach((d) => sv('path', { d }, this.gOutline));
      this.bindPointer();
    }

    // ---------------------------------------------------------------- helpers
    clear(layers) {
      (layers || [this.gAnim, this.gDone, this.gHint, this.gUser, this.gFree, this.gNums, this.gDot]).forEach((g) => { while (g.firstChild) g.removeChild(g.firstChild); });
      this.gDone.classList.remove('all-ok');
    }
    setOutline(on) { this.gOutline.style.display = on ? '' : 'none'; }
    showNumbers(upto) {
      while (this.gNums.firstChild) this.gNums.removeChild(this.gNums.firstChild);
      if (!this.k) return;
      this.k.nums.forEach((p, i) => {
        if (upto != null && i >= upto) return;
        const t = sv('text', { x: p[0], y: p[1] }, this.gNums);
        t.textContent = i + 1;
      });
    }
    msg(text, cls) { if (this.opts.onMessage) this.opts.onMessage(text, cls || ''); }
    stop() { this.token++; this.drawing = false; }
    get count() { return this.k ? this.k.strokes.length : 0; }

    // ---------------------------------------------------------------- viewing
    showAll() { this.stop(); this.mode = 'view'; this.clear(); this.setOutline(false); this.k && this.k.strokes.forEach((d) => sv('path', { d }, this.gDone)); if (this.opts.numbers) this.showNumbers(); }
    showStep(k) {
      this.stop(); this.mode = 'view'; this.clear(); this.setOutline(true);
      if (!this.k) return;
      k = Math.max(0, Math.min(this.count, k));
      this.k.strokes.forEach((d, i) => { if (i < k) sv('path', { d, class: i === k - 1 ? 'cur' : '' }, this.gAnim); });
      if (k > 0) this.startDot(k - 1);
      this.showNumbers(k);
      this.step = k;
    }
    startDot(i) {
      while (this.gDot.firstChild) this.gDot.removeChild(this.gDot.firstChild);
      const p = this.k.m[i].pts[0];
      sv('circle', { cx: p[0], cy: p[1], r: 2.6, class: 'startdot' }, this.gDot);
    }
    async animate(opts) {
      opts = opts || {};
      if (!this.k) return;
      const tok = ++this.token;
      this.mode = 'view'; this.drawing = false;
      this.clear(); this.setOutline(opts.outline !== false);
      if (opts.numbers || this.opts.numbers) this.showNumbers(0);
      const speed = opts.speed || this.opts.speed || 1;
      for (let i = 0; i < this.count; i++) {
        if (tok !== this.token) return;
        await this.drawStroke(this.gAnim, i, speed, tok, 'cur');
        if (tok !== this.token) return;
        const last = this.gAnim.lastChild; if (last) last.setAttribute('class', '');
        if (opts.numbers || this.opts.numbers) this.showNumbers(i + 1);
        if (opts.onStep) opts.onStep(i + 1);
        await sleep(140 / speed);
      }
      if (opts.loop && tok === this.token) { await sleep(1300); if (tok === this.token) this.animate(opts); }
    }
    drawStroke(layer, i, speed, tok, cls) {
      return new Promise((resolve) => {
        const m = this.k.m[i];
        const p = sv('path', { d: this.k.strokes[i], class: cls || '' }, layer);
        const len = m.len + 1;
        p.style.strokeDasharray = `${len} ${len}`;
        p.style.strokeDashoffset = String(len);
        const dur = Math.max(220, Math.min(950, m.len * 10)) / (speed || 1);
        const t0 = performance.now();
        const tick = (t) => {
          if (tok !== this.token) { resolve(); return; }
          const a = Math.min(1, (t - t0) / dur);
          const e = a < 0.5 ? 2 * a * a : 1 - Math.pow(-2 * a + 2, 2) / 2;
          p.style.strokeDashoffset = String(len * (1 - e));
          if (a < 1) requestAnimationFrame(tick); else { p.style.strokeDasharray = ''; p.style.strokeDashoffset = ''; resolve(); }
        };
        requestAnimationFrame(tick);
      });
    }

    // ---------------------------------------------------------------- practice
    quiz(opts) {
      opts = opts || {};
      this.stop();
      this.clear();
      this.mode = 'quiz';
      this.trace = !!opts.trace;
      this.setOutline(this.trace);
      this.idx = 0;
      this.mistakes = 0;
      this.per = new Array(this.count).fill(0);
      this.drawing = true;
      if (this.trace) this.startDot(0);
      this.msg(this.trace ? 'Tô theo nét mờ, bắt đầu từ chấm tròn.' : `Viết nét 1 / ${this.count}`, '');
    }
    free() {
      this.stop(); this.clear(); this.mode = 'free'; this.setOutline(false); this.drawing = true; this.freeStrokes = [];
      this.msg('Viết tự do — bấm "So sánh" để xem chữ mẫu.', '');
    }
    undoFree() { if (this.mode !== 'free') return; const l = this.gFree.lastChild; if (l) l.remove(); }
    compare(on) { this.setOutline(on); }

    async hint() {
      if (this.mode !== 'quiz' || this.idx >= this.count) return;
      this.per[this.idx]++; this.mistakes++;
      const tok = this.token;
      while (this.gHint.firstChild) this.gHint.removeChild(this.gHint.firstChild);
      await this.drawStroke(this.gHint, this.idx, 0.8, tok);
      await sleep(500);
      if (tok === this.token) while (this.gHint.firstChild) this.gHint.removeChild(this.gHint.firstChild);
    }

    bindPointer() {
      const svg = this.svg;
      const pt = (e) => {
        const r = svg.getBoundingClientRect();
        return [((e.clientX - r.left) / r.width) * SIZE, ((e.clientY - r.top) / r.height) * SIZE];
      };
      svg.addEventListener('pointerdown', (e) => {
        if (!this.drawing) return;
        e.preventDefault();
        try { svg.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
        this.cur = [pt(e)];
        this.curPath = sv('path', { d: smooth(this.cur) }, this.mode === 'free' ? this.gFree : this.gUser);
      });
      svg.addEventListener('pointermove', (e) => {
        if (!this.cur) return;
        e.preventDefault();
        const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
        for (const ev of evs) {
          const p = pt(ev);
          if (dist(p, this.cur[this.cur.length - 1]) > 0.7) this.cur.push(p);
        }
        this.curPath.setAttribute('d', smooth(this.cur));
      });
      const end = (e) => {
        if (!this.cur) return;
        const pts = this.cur; const path = this.curPath;
        this.cur = null; this.curPath = null;
        if (this.mode === 'quiz') this.judge(pts, path);
      };
      svg.addEventListener('pointerup', end);
      svg.addEventListener('pointercancel', end);
    }

    judge(pts, path) {
      if (this.idx >= this.count) { path.remove(); return; }
      const res = this.match(pts, this.idx);
      if (res.ok) {
        path.remove();
        const p = sv('path', { d: this.k.strokes[this.idx], class: 'flash' }, this.gDone);
        setTimeout(() => p.setAttribute('class', ''), 350);
        this.idx++;
        if (this.opts.onStroke) this.opts.onStroke(this.idx, this.count);
        if (this.idx >= this.count) return this.finish();
        if (this.trace) this.startDot(this.idx);
        this.msg(`Đúng · nét ${this.idx + 1} / ${this.count}`, 'ok');
        return;
      }
      this.mistakes++; this.per[this.idx]++;
      path.setAttribute('class', 'bad');
      setTimeout(() => path.remove(), 650);
      const why = res.reason === 'reverse' ? 'Ngược chiều nét — viết lại đúng hướng'
        : res.reason === 'order' ? `Sai thứ tự — đó là nét ${res.which + 1}, hãy viết nét ${this.idx + 1} trước`
          : res.reason === 'short' ? 'Nét quá ngắn hoặc quá dài'
            : 'Chưa đúng vị trí / hình dạng nét';
      this.msg(why, 'bad');
      if (this.per[this.idx] >= 3 && this.per[this.idx] % 3 === 0) this.hint();
    }

    match(user, idx) {
      const L = LENIENCY[this.opts.leniency] || 1;
      const exp = this.k.m[idx];
      user = smoothPts(user, 2);
      const U = resample(user, N);
      const E = exp.pts;
      const ulen = polyLen(user);
      const dFwd = avgDist(U, E);
      const dRev = avgDistRev(U, E);
      const tiny = exp.len < 16;
      const s = dist(U[0], E[0]), e = dist(U[N - 1], E[N - 1]);
      const ratio = ulen / Math.max(exp.len, 1);
      const lenOk = tiny ? ulen < 40 * L : ratio > 0.42 / L && ratio < 2.2 * L;
      // overall direction (start→end) must roughly agree for strokes long enough to have one
      const ev = [E[N - 1][0] - E[0][0], E[N - 1][1] - E[0][1]], uv = [U[N - 1][0] - U[0][0], U[N - 1][1] - U[0][1]];
      const en = Math.hypot(ev[0], ev[1]), un = Math.hypot(uv[0], uv[1]);
      const dirOk = en < 10 || un < 6 || (ev[0] * uv[0] + ev[1] * uv[1]) / (en * un) > 0.2;
      const shapeOk = dFwd < 14 * L && s < 21 * L && e < 21 * L && dirOk;
      // is this stroke clearly closer to a later stroke?
      let best = idx, bestD = dFwd;
      for (let j = idx + 1; j < this.count; j++) {
        const dj = avgDist(U, this.k.m[j].pts);
        if (dj < bestD) { best = j; bestD = dj; }
      }
      if (shapeOk && lenOk && !(best !== idx && bestD < dFwd * 0.7)) return { ok: true };
      if (!tiny && dRev < 14 * L && dRev < dFwd) return { ok: false, reason: 'reverse' };
      if (best !== idx && bestD < 12 * L) return { ok: false, reason: 'order', which: best };
      if (shapeOk && !lenOk) return { ok: false, reason: 'short' };
      return { ok: false, reason: 'shape' };
    }

    finish() {
      this.drawing = false;
      while (this.gDot.firstChild) this.gDot.removeChild(this.gDot.firstChild);
      this.gDone.classList.add('all-ok');
      const m = this.mistakes;
      this.msg(m === 0 ? 'Hoàn hảo — không sai nét nào!' : `Hoàn thành · sai ${m} lần`, m === 0 ? 'ok' : '');
      if (this.opts.onComplete) this.opts.onComplete({ mistakes: m, per: this.per.slice() });
    }

    destroy() { this.stop(); this.host.innerHTML = ''; }
  }

  // small static diagram: strokes 1..k with stroke k highlighted
  KanjiWriter.filmstrip = function (char, max) {
    const k = meta(char);
    const box = document.createElement('div');
    box.className = 'filmstrip';
    if (!k) return box;
    const n = Math.min(k.strokes.length, max || 40);
    for (let i = 0; i < n; i++) {
      const svg = sv('svg', { viewBox: `0 0 ${SIZE} ${SIZE}`, title: 'Nét ' + (i + 1) });
      const g = sv('g', { fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '4.5' }, svg);
      for (let j = 0; j <= i; j++) sv('path', { d: k.strokes[j], stroke: j === i ? 'var(--accent)' : 'var(--ink)' }, g);
      const p = k.m[i].pts[0];
      sv('circle', { cx: p[0], cy: p[1], r: 4, fill: 'var(--accent)', opacity: '.6' }, svg);
      box.appendChild(svg);
    }
    return box;
  };
  KanjiWriter.has = (c) => !!(G.KVG && G.KVG[c]);
  KanjiWriter.strokeCount = (c) => (G.KVG && G.KVG[c] ? G.KVG[c].s.length : 0);

  G.KanjiWriter = KanjiWriter;
})(window);
