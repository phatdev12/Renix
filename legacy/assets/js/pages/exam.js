/* Thi thử — mixed mock exam with timer */
(function (G) {
  'use strict';
  const { h, esc, ic, B, ruby, D, Store, Prog, uTag, shuffle, sample, uniq, pct, fmtTime, fmtDate, toast, modal } = G.U;
  const W = G.W;

  const SECTIONS = [
    { id: 'vocab', label: 'Từ vựng', icon: 'cards' },
    { id: 'kanji', label: 'Kanji', icon: 'kanji' },
    { id: 'grammar', label: 'Ngữ pháp', icon: 'puzzle', tip: 'Câu ngữ pháp từ đề LMS' },
    { id: 'conj', label: 'Chia động từ', icon: 'repeat' },
    { id: 'reading', label: 'Đọc hiểu', icon: 'book', tip: 'Câu đọc hiểu bài khóa từ đề LMS' },
    { id: 'order', label: 'Sắp xếp câu', icon: 'sort', tip: 'Câu sắp xếp từ đề LMS' },
  ];
  const wordHtml = (v) => ruby(v.ruby) + (v.note ? `<span class="muted small">${esc(v.note)}</span>` : '');

  function bankPool(units, pred) {
    const set = new Set(units), out = [];
    (G.BANK || []).forEach((b) => {
      if (!set.has(b.unit)) return;
      b.parts.forEach((p) => p.questions.forEach((q) => { if (q.ans != null && !q.needs_audio && pred(q, b)) out.push(Object.assign({ _src: b.name }, q)); }));
    });
    return out;
  }

  function build(units, secs, n) {
    const per = {};
    const active = SECTIONS.filter((s) => secs.includes(s.id));
    active.forEach((s, i) => { per[s.id] = Math.floor(n / active.length) + (i < n % active.length ? 1 : 0); });
    const qs = [];
    const vocab = D.vocab(units);
    const kanji = D.kanji(units);
    if (per.vocab) {
      sample(vocab, per.vocab).forEach((v, i) => {
        if (i % 2 === 0 || !v.kanji || !/[一-鿿]/.test(v.kanji)) {
          const m = W.mcq(vocab, v, (x) => x.vi, 4);
          qs.push({ sec: 'vocab', type: 'single', prompt: `<p>「<b>${wordHtml(v)}</b>」の いみは？</p>`, options: m.options.map((x) => esc(x.vi)), ans: m.answer, explain: `${v.kanji || v.kana}（${v.kana}）: ${v.vi}` });
        } else {
          const conf = shuffle(G.KanjiTools.confusables(v.kana)).slice(0, 2);
          const others = shuffle(uniq(vocab.map((x) => x.kana).filter((r) => r !== v.kana && !conf.includes(r)))).slice(0, 3 - conf.length);
          const opts = shuffle([v.kana].concat(conf, others));
          qs.push({ sec: 'vocab', type: 'single', prompt: `<p>「<b style="font-family:var(--font-mincho)">${esc(v.kanji)}</b>」の よみかたは？</p>`, options: opts.map(esc), ans: opts.indexOf(v.kana), explain: `${v.kanji}（${v.kana}）: ${v.vi}` });
        }
      });
    }
    if (per.kanji) {
      const exs = [];
      kanji.forEach((k) => k.ex.forEach((e) => { if (e.r && !e.rare && /[一-鿿]/.test(e.w)) exs.push(Object.assign({ k }, e)); }));
      shuffle(exs).slice(0, per.kanji).forEach((e, i) => {
        const reading = e.r.split('・')[0];
        if (i % 3 === 2) {
          const m = W.mcq(kanji, e.k, (x) => x.hv.map((y) => y.t).join('/'), 4);
          qs.push({ sec: 'kanji', type: 'single', prompt: `<p>Âm Hán Việt của chữ <b style="font-family:var(--font-mincho);font-size:28px">${esc(e.k.c)}</b> là?</p>`, options: m.options.map((x) => esc(x.hv.map((y) => y.t).join(' / '))), ans: m.answer, explain: `${e.k.c}: ${e.k.hv.map((y) => y.t).join('/')} – ${e.k.meaning}` });
        } else {
          const conf = shuffle(G.KanjiTools.confusables(reading)).slice(0, 2);
          const others = shuffle(uniq(exs.map((x) => x.r.split('・')[0]).filter((r) => r !== reading && !conf.includes(r)))).slice(0, 3 - conf.length);
          const opts = shuffle([reading].concat(conf, others));
          qs.push({ sec: 'kanji', type: 'single', prompt: `<p>「<b style="font-family:var(--font-mincho)">${esc(e.w)}</b>」の よみかたは？</p>`, options: opts.map(esc), ans: opts.indexOf(reading), explain: `${e.w}（${reading}）: ${e.vi}` });
        }
      });
    }
    if (per.grammar) {
      const pool = bankPool(units, (q, b) => b.part === 3 && q.type === 'single' && q.confidence !== 'low');
      sample(pool, per.grammar).forEach((q) => qs.push(Object.assign({ sec: 'grammar' }, q)));
    }
    if (per.reading) {
      const pool = bankPool(units, (q, b) => b.part === 1 && q.type === 'single' && q.confidence !== 'low');
      sample(pool, per.reading).forEach((q) => qs.push(Object.assign({ sec: 'reading' }, q)));
    }
    if (per.order) {
      const pool = bankPool(units, (q) => (q.type === 'order' || q.type === 'dragtext') && q.confidence === 'high');
      sample(pool, per.order).forEach((q) => qs.push(Object.assign({ sec: 'order' }, q)));
    }
    if (per.conj) {
      const unitsSet = new Set(units);
      let vs = (G.VERBS || []).filter((v) => !v.u || unitsSet.has(v.u));
      const forms = ['jisho', 'nai', 'ta', 'te', 'kanou'];
      for (let i = 0; i < per.conj; i++) {
        let v, f, t = 0;
        do { v = shuffle(vs)[0]; f = shuffle(forms)[0]; t++; } while (f === 'kanou' && v.nopot && t < 30);
        const right = G.Conj.conj(v.k, v.g, f);
        const wrong = G.ConjTools.wrongForms(v, f).slice(0, 3);
        const opts = shuffle([right].concat(wrong));
        const fm = G.Conj.FORMS.find((x) => x.id === f);
        qs.push({ sec: 'conj', type: 'single', prompt: `<p><b>${ruby(v.ruby)}</b> → <b style="color:var(--accent)">${esc(fm.jp)}</b> <span class="small muted">(${esc(fm.vi)})</span></p>`, options: opts.map(esc), ans: opts.indexOf(right), explain: G.Conj.rule(v, f) });
      }
    }
    // keep sections grouped (like a real paper), shuffle inside each
    const order = SECTIONS.map((s) => s.id);
    return qs.sort((a, b) => order.indexOf(a.sec) - order.indexOf(b.sec));
  }

  function render(main) {
    const st = Object.assign({ secs: SECTIONS.map((s) => s.id), n: 30, min: 30 }, Store.get('examUi', {}));
    const save = () => Store.set('examUi', st);
    const units = D.sel();
    main.appendChild(W.pageHead('Thi thử', 'もぎしけん'));
    const layout = h('div', { class: 'exam-cfg' });
    const cfg = h('div', { class: 'card' });
    cfg.appendChild(h('h3', null, ic('sliders'), 'Tạo đề', h('span', { class: 'spacer' }), W.unitBadges(units)));
    const chips = h('div', { class: 'sec-chips' });
    SECTIONS.forEach((s) => {
      const lab = h('label', { class: 'sec-chip' + (st.secs.includes(s.id) ? ' on' : ''), title: s.tip || '' },
        h('input', { type: 'checkbox', checked: st.secs.includes(s.id), onchange: (e) => { st.secs = e.target.checked ? uniq(st.secs.concat(s.id)) : st.secs.filter((x) => x !== s.id); lab.classList.toggle('on', e.target.checked); save(); } }),
        ic(s.icon), s.label);
      chips.appendChild(lab);
    });
    cfg.appendChild(chips);
    const nSel = h('select', { class: 'input', onchange: () => { st.n = parseInt(nSel.value, 10); save(); } }, [15, 20, 30, 40, 50].map((n) => h('option', { value: n, selected: st.n === n }, n + ' câu')));
    const tSel = h('select', { class: 'input', onchange: () => { st.min = parseInt(tSel.value, 10); save(); } }, [0, 15, 20, 30, 45, 60].map((m) => h('option', { value: m, selected: st.min === m }, m ? m + ' phút' : 'Không giới hạn')));
    cfg.appendChild(h('div', { class: 'cfg-row' }, h('span', { class: 'lbl' }, 'Số câu'), nSel, h('span', { class: 'lbl' }, 'Thời gian'), tSel, h('span', { class: 'spacer' }), B('primary lg', 'play', 'Bắt đầu', () => start())));
    layout.appendChild(cfg);
    const hist = Prog.exams().slice(-10);
    layout.appendChild(h('div', { class: 'card' }, h('h3', null, ic('chart'), 'Lịch sử'),
      hist.length ? W.lineChart(hist.map((x) => { const d = new Date(x.ts); return { v: pct(x.score, x.total), label: d.getDate() + '/' + (d.getMonth() + 1), title: fmtDate(x.ts) + ' · ' + x.score + '/' + x.total }; }))
        : h('div', { class: 'ch-empty' }, 'Chưa có bài thi nào')));
    main.appendChild(layout);
    const pools = {
      vocab: [D.vocab(units).length, 'từ'],
      kanji: [D.kanji(units).reduce((s, k) => s + k.ex.filter((e) => e.r && !e.rare && /[一-鿿]/.test(e.w)).length, 0), 'từ ví dụ'],
      grammar: [bankPool(units, (q, b) => b.part === 3 && q.type === 'single' && q.confidence !== 'low').length, 'câu LMS'],
      conj: [(G.VERBS || []).filter((v) => !v.u || units.includes(v.u)).length, 'động từ'],
      reading: [bankPool(units, (q, b) => b.part === 1 && q.type === 'single' && q.confidence !== 'low').length, 'câu LMS'],
      order: [bankPool(units, (q) => (q.type === 'order' || q.type === 'dragtext') && q.confidence === 'high').length, 'câu LMS'],
    };
    main.appendChild(h('div', { class: 'sec-label', style: { marginTop: '24px' } }, 'Kho câu hỏi'));
    main.appendChild(h('div', { class: 'pool-grid' }, SECTIONS.map((s) => h('div', { class: 'card pool' }, h('span', { class: 'pi' }, ic(s.icon)),
      h('div', null, h('b', null, String(pools[s.id][0])), h('span', null, s.label + ' · ' + pools[s.id][1]))))));
    let timer = null;
    function start() {
      if (!st.secs.length) { toast('Chọn ít nhất 1 phần thi'); return; }
      const qs = build(units, st.secs, st.n);
      if (!qs.length) { toast('Không đủ câu hỏi cho phạm vi này'); return; }
      main.innerHTML = '';
      const t0 = Date.now();
      const clockT = h('span', null, st.min ? fmtTime(st.min * 60) : '0:00');
      const clock = h('span', { class: 'timer' }, ic('clock'), clockT);
      const progress = h('span', { class: 'score-line' });
      const head = h('div', { class: 'player-head' }, h('div', { class: 'row' }, h('b', null, 'Thi thử · ' + qs.length + ' câu'), W.unitBadges(units), h('span', { class: 'spacer' }), progress, clock,
        B('sm accent', 'send', 'Nộp bài', () => submit(false))));
      main.appendChild(head);
      const items = [];
      let lastSec = null, n = 0;
      qs.forEach((q) => {
        if (q.sec !== lastSec) { const s = SECTIONS.find((x) => x.id === q.sec); main.appendChild(h('div', { class: 'section-title' }, h('h2', null, s.label), h('div', { class: 'line' }))); lastSec = q.sec; }
        n++;
        const it = G.BankUI.questionCard(q, n, '', { source: q._src });
        items.push(it);
        main.appendChild(it.card);
      });
      main.appendChild(h('div', { class: 'center', style: { margin: '22px 0' } }, B('primary lg', 'send', 'Nộp bài', () => submit(false))));
      let submitted = false;
      timer = setInterval(() => {
        const el = (Date.now() - t0) / 1000;
        if (st.min) {
          const left = st.min * 60 - el;
          clockT.textContent = fmtTime(left);
          clock.classList.toggle('low', left < 120);
          if (left <= 0) submit(true);
        } else clockT.textContent = fmtTime(el);
        progress.textContent = items.filter((it) => it.r.answered()).length + '/' + items.length + ' đã làm';
      }, 500);
      function submit(auto) {
        if (submitted) return;
        if (!auto) {
          const left = items.filter((it) => !it.r.answered()).length;
          if (left && !window.confirm(`Còn ${left} câu chưa làm. Nộp bài?`)) return;
        }
        submitted = true;
        clearInterval(timer);
        main.querySelectorAll('button').forEach((x) => { if (/Nộp bài/.test(x.textContent)) x.remove(); });
        const secs = {};
        let ok = 0;
        items.forEach((it) => {
          const res = it.r.check(); it.r.reveal(res);
          const s = it.q.sec; secs[s] = secs[s] || [0, 0]; secs[s][1]++;
          if (res === true) { ok++; secs[s][0]++; }
        });
        const rec = { ts: Date.now(), score: ok, total: items.length, units, secs, dur: Math.round((Date.now() - t0) / 1000) };
        Prog.addExam(rec);
        const p = pct(ok, items.length);
        const summary = h('div', { class: 'card', style: { marginBottom: '16px' } },
          h('div', { class: 'row', style: { gap: '24px', alignItems: 'center' } }, W.gauge(p, 'điểm'),
            h('div', { style: { flex: '1', minWidth: '240px' } },
              h('div', { class: 'num', style: { fontSize: '18px', fontWeight: 600 } }, `${ok} / ${items.length} câu đúng`),
              h('div', { class: 'small muted', style: { marginBottom: '12px' } }, (auto ? 'Hết giờ — tự động nộp · ' : '') + 'Thời gian ' + fmtTime(rec.dur)),
              h('div', { class: 'sec-score' }, Object.keys(secs).map((s) => {
                const sd = SECTIONS.find((x) => x.id === s);
                return h('div', null, h('div', { class: 'row' }, ic(sd.icon), sd.label, h('span', { class: 'spacer' }), h('span', { class: 'num' }, secs[s][0] + '/' + secs[s][1])), h('div', { class: 'bar ok' }, h('i', { style: { width: pct(secs[s][0], secs[s][1]) + '%' } })));
              })))),
          h('div', { class: 'row', style: { marginTop: '16px' } }, B('primary', 'rotate', 'Làm đề mới', () => G.App.rerender()), h('span', { class: 'small muted' }, 'Kéo xuống để xem giải thích từng câu')));
        head.after(summary);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
    return () => clearInterval(timer);
  }

  G.Pages.register('exam', { title: 'Thi thử', render });
})(window);
