/* Đề luyện LMS — the original ドリル/テスト questions with answer keys */
(function (G) {
  'use strict';
  const { h, esc, ic, B, A, ruby, D, Store, Prog, uTag, pct, fmtDate, lightbox, sameAns, kanaInput, shuffle, toast, modal } = G.U;
  const W = G.W;
  const PARTS = { 1: 'マスターテクスト', 2: 'ことば', 3: 'ぶんぽう', 4: 'かんじ', 5: 'エッセイ' };
  const TYPE_VI = { single: 'Trắc nghiệm', order: 'Sắp xếp câu', dragtext: 'Sắp xếp / điền', blanks: 'Điền vào chỗ trống', matching: 'Nối đáp án', short: 'Luyện gõ' };

  const qCount = (qz) => qz.parts.reduce((s, p) => s + p.questions.length, 0);
  const keyed = (q) => q.ans != null && !q.needs_audio;

  // ------------------------------------------------------------------ list
  function renderList(main, query) {
    let list = D.bank();
    if (query.unit) list = list.filter((q) => q.unit === parseInt(query.unit, 10));
    if (query.part) list = list.filter((q) => q.part === parseInt(query.part, 10));
    const total = list.reduce((s, q) => s + qCount(q), 0);
    main.appendChild(W.pageHead('Đề luyện LMS', 'ドリル・テスト', [B('sm', 'shuffle', 'Trộn 20 câu', () => mixQuiz(list), { title: 'Trộn ngẫu nhiên 20 câu có đáp án' })], list.length + ' bài · ' + total + ' câu'));
    if (query.unit || query.part) main.appendChild(h('div', { class: 'row', style: { marginTop: '-6px', marginBottom: '14px' } }, ic('filter', 'muted'),
      query.unit ? h('span', { class: 'tag u' + query.unit }, 'Unit ' + query.unit) : null, query.part ? h('span', { class: 'tag', lang: 'ja' }, 'Part ' + query.part + ' ' + PARTS[query.part]) : null,
      h('a', { class: 'small', href: '#/bank' }, 'Xem tất cả')));
    main.appendChild(h('div', { class: 'bank-legend' }, 'Đáp án:',
      h('span', { class: 'tag ok', title: 'Lấy từ bài làm 10/10 của bạn trên LMS' }, ic('checkCircle'), 'xác nhận'),
      h('span', { class: 'tag pri', title: 'Do AI giải và kiểm tra lại' }, 'tham khảo'),
      h('span', { class: 'tag warn', title: 'AI chưa chắc chắn hoàn toàn — nên xem kỹ' }, 'tin cậy TB'),
      h('span', { class: 'tag', title: 'Câu nghe: cần nghe audio, không có đáp án' }, ic('headphones'), 'câu nghe'),
      W.infoTip('Xác nhận = từ bài làm 10/10 của bạn trên LMS. Tham khảo = AI giải và kiểm tra lại, có ghi mức tin cậy. Câu nghe cần audio nên không có đáp án.')));
    const units = D.sel().filter((u) => list.some((q) => q.unit === u));
    units.forEach((u) => {
      const unit = D.unit(u);
      const card = h('div', { class: 'card bank-unit', style: { '--c': `var(--u${u})` } });
      card.appendChild(h('div', { class: 'bank-unit-head' }, h('span', { class: 'un' }, 'Unit ' + u), h('span', { class: 'jp-sub', lang: 'ja', html: ruby(unit.title) })));
      list.filter((q) => q.unit === u).forEach((qz) => {
        const n = qCount(qz);
        const nk = qz.parts.reduce((s, p) => s + p.questions.filter(keyed).length, 0);
        const na = qz.parts.reduce((s, p) => s + p.questions.filter((q) => q.needs_audio).length, 0);
        const types = Array.from(new Set(qz.parts.flatMap((p) => p.questions.map((q) => q.type))));
        const rec = Prog.quiz(qz.id);
        card.appendChild(h('div', { class: 'bank-row' },
          h('span', { class: 'bank-kind ' + (qz.kind === 'test' ? 'test' : 'drill') }, qz.kind === 'test' ? 'テスト' : 'ドリル'),
          h('div', { style: { minWidth: 0 } }, h('div', { class: 'bn', lang: 'ja' }, 'Part ' + qz.part + ' · ' + (PARTS[qz.part] || '') + (/[①②③]/.test(qz.name) ? ' ' + qz.name.match(/[①②③]/)[0] : '')),
            h('div', { class: 'bs' }, h('span', { class: 'num' }, n + ' câu'), '·', h('span', null, types.map((t) => TYPE_VI[t]).join(', ')),
              na ? h('span', { title: na + ' câu nghe' }, ic('headphones'), ' ' + na) : null, nk < n - na ? h('span', null, '· ' + (n - na - nk) + ' câu chưa có đáp án') : null)),
          h('span', { class: 'spacer' }),
          rec ? h('span', { class: 'best ' + (rec.best >= 80 ? 'ok' : rec.best >= 50 ? 'warn' : 'bad'), title: 'Tốt nhất · lần gần nhất ' + fmtDate(rec.last) }, rec.best + '%') : null,
          A('sm', rec ? 'rotate' : 'play', rec ? 'Làm lại' : 'Làm bài', '#/bank/' + qz.id)));
      });
      main.appendChild(card);
    });
  }

  function mixQuiz(list) {
    const pool = [];
    list.forEach((qz) => qz.parts.forEach((p) => p.questions.forEach((q) => { if (keyed(q) && q.type !== 'short') pool.push({ q, title: p.title, qz }); })));
    const pickN = shuffle(pool).slice(0, 20);
    Store.set('bankMix', pickN.map((x) => x.q.key));
    location.hash = '#/bank/mix';
  }

  // ------------------------------------------------------------------ helpers for answers
  function slotValue(el) { return el.tagName === 'SELECT' ? el.value : el.value.trim(); }
  function blankExpected(q, slot) {
    const a = q.ans && q.ans[String(slot)];
    return a == null ? null : a;
  }
  function confBadge(q) {
    if (q.needs_audio) return h('span', { class: 'tag' }, ic('headphones'), 'câu nghe');
    if (q.verified) return h('span', { class: 'tag ok conf', title: 'Đáp án từ bài làm 10/10 trên LMS' }, ic('checkCircle'), 'xác nhận');
    if (q.ans == null) return h('span', { class: 'tag' }, 'chưa có đáp án');
    if (q.confidence === 'medium') return h('span', { class: 'tag warn conf', title: 'AI chưa chắc chắn hoàn toàn — xem ghi chú' }, 'tin cậy TB');
    if (q.confidence === 'low') return h('span', { class: 'tag bad conf' }, 'tin cậy thấp');
    return h('span', { class: 'tag pri conf', title: 'Đáp án do AI giải' }, 'tham khảo');
  }

  // ------------------------------------------------------------------ question renderers
  // each returns {el, check() -> true/false/null, reveal(), answered()}
  function qSingle(q) {
    const box = h('div', { class: 'qopts' });
    let chosen = null;
    q.options.forEach((o, i) => box.appendChild(h('button', { class: 'opt', lang: 'ja', onclick: () => {
      if (box.dataset.locked) return;
      chosen = i;
      Array.from(box.children).forEach((b, j) => b.classList.toggle('sel', j === i));
      Array.from(box.children).forEach((b, j) => { b.style.borderColor = j === i ? 'var(--primary)' : ''; b.style.background = j === i ? 'var(--primary-soft)' : ''; });
    } }, h('span', { class: 'ok-key' }, 'ABCDEFG'[i]), h('span', { html: o }))));
    return {
      el: box,
      answered: () => chosen != null,
      check() {
        box.dataset.locked = '1';
        Array.from(box.children).forEach((b, j) => {
          b.disabled = true; b.style.borderColor = ''; b.style.background = '';
          if (q.ans != null && j === q.ans) b.classList.add('correct');
          else if (j === chosen) b.classList.add(q.ans == null ? 'dim' : 'wrong');
          else b.classList.add('dim');
          if (q.lms != null && j === q.lms) b.appendChild(h('span', { class: 'tag warn', style: { marginLeft: 'auto' } }, 'LMS chấm đúng'));
        });
        return q.ans == null ? null : chosen === q.ans;
      },
      state: () => chosen,
    };
  }

  function qOrder(q) {
    const wrap = h('div');
    if (q.image) wrap.appendChild(h('img', { src: q.image, class: 'q-img', style: { maxHeight: '300px', display: 'block', margin: '8px 0', borderRadius: '8px', background: '#fff', border: '1px solid var(--line)', cursor: 'zoom-in' }, onclick: () => lightbox(q.image) }));
    const ans = h('div', { class: 'chips-ans', title: 'Bấm vào từ để bỏ ra' });
    const pool = h('div', { class: 'chips-pool' });
    const reuse = new Set(q.reuse || []);
    const picked = [];
    const need = q.type === 'dragtext' ? (q.nslots || (q.ans ? q.ans.length : q.chips.length)) : q.chips.length;
    function paint() {
      ans.innerHTML = '';
      if (!picked.length) ans.appendChild(h('span', { class: 'muted small', style: { alignSelf: 'center', padding: '0 6px' } }, 'Bấm các từ bên dưới theo thứ tự'));
      picked.forEach((ci, pos) => ans.appendChild(h('button', { class: 'wchip', lang: 'ja', onclick: () => { if (wrap.dataset.locked) return; picked.splice(pos, 1); paint(); } }, q.chips[ci])));
      pool.innerHTML = '';
      q.chips.forEach((c, ci) => pool.appendChild(h('button', { class: 'wchip' + (reuse.has(ci) ? ' reuse' : '') + (!reuse.has(ci) && picked.includes(ci) ? ' used' : ''), lang: 'ja', title: reuse.has(ci) ? 'Có thể dùng nhiều lần' : '',
        onclick: () => { if (wrap.dataset.locked || picked.length >= need) return; picked.push(ci); paint(); } }, c)));
    }
    paint();
    wrap.append(ans, h('div', { class: 'tiny muted', style: { margin: '6px 2px 4px' } }, need ? `${need} ô` + (reuse.size ? ' · viền nét đứt = dùng lại được' : '') : ''), pool);
    return {
      el: wrap,
      answered: () => picked.length > 0,
      check() {
        wrap.dataset.locked = '1';
        if (q.ans == null) return null;
        const a = q.ans.map((i) => q.chips[i]).join('|');
        const b = picked.map((i) => q.chips[i]).join('|');
        const ok = a === b;
        ans.classList.add(ok ? 'ok' : 'bad');
        return ok;
      },
      correctText: () => (q.ans ? q.ans.map((i) => q.chips[i]).join(' ／ ') : ''),
    };
  }

  function qBlanks(q) {
    const choices = {};
    (q.slotChoices || []).forEach((s) => { choices[s.slot] = s; });
    const parts = String(q.prompt || '').split('<hr class="qsep">');
    const hasInst = parts.length > 1 && parts[1].replace(/<[^>]+>/g, '').trim();
    const body = hasInst ? parts.slice(1).join('<hr class="qsep">') : q.prompt;
    const html = (hasInst ? `<div class="qinst">${parts[0]}</div>` : '') + body.replace(/\((\d+):\s*\.{5,}\s*\)|\[\[(\d+)\]\]/g, (m, a, b) => `<span class="slot" data-slot="${a || b}"></span>`);
    const prompt = h('div', { class: 'qprompt', lang: 'ja', html });
    const inputs = [];
    prompt.querySelectorAll('.slot').forEach((sp) => {
      const n = sp.dataset.slot;
      const c = choices[n];
      let el;
      if (c && c.choices) {
        el = h('select', { 'data-slot': n }, h('option', { value: '' }, '— ' + n + ' —'), c.choices.map((x) => h('option', { value: x }, x)));
      } else {
        el = h('input', { 'data-slot': n, placeholder: '(' + n + ')', size: '10' });
        kanaInput(el);
      }
      sp.appendChild(el);
      inputs.push(el);
    });
    return {
      el: prompt, promptHandled: true,
      answered: () => inputs.some((i) => slotValue(i)),
      check() {
        let any = false, all = true;
        inputs.forEach((el) => {
          el.disabled = true;
          const exp = blankExpected(q, el.dataset.slot);
          if (exp == null) { return; }
          any = true;
          const v = slotValue(el);
          const list = [].concat(exp);
          const ok = !!v && (list.some((x) => sameAns(v, x, false)) || list.some((x) => sameAns(v, x, true))
            || list.some((x) => /^[a-z]+$/i.test(String(x)) && sameAns(v, G.U.toHira(String(x), false), true))
            || list.some((x) => String(x).toLowerCase() === 'x' && /^[x×✕]$/i.test(v)));
          el.classList.add(ok ? 'ok' : 'bad');
          if (!ok) all = false;
          el.parentNode.appendChild(h('span', { class: 'exp', lang: 'ja' }, list.join(' / ')));
        });
        return q.needs_audio || !any ? null : all;
      },
    };
  }

  function qMatching(q) {
    const t = h('table', { class: 'ctable', style: { marginTop: '8px' } });
    const sels = [];
    q.sections.forEach((s, i) => {
      const sel = h('select', { class: 'input', style: { height: '34px', maxWidth: '100%' } }, h('option', { value: '' }, '— chọn —'), s.choices.map((c, j) => h('option', { value: String(j) }, c)));
      sels.push(sel);
      t.appendChild(h('tr', null, h('td', { class: 'jp', lang: 'ja', style: { whiteSpace: 'normal' } }, s.label), h('td', null, sel)));
    });
    return {
      el: h('div', { class: 'scroll-x' }, t),
      answered: () => sels.some((s) => s.value !== ''),
      check() {
        if (!Array.isArray(q.ans)) { sels.forEach((s) => { s.disabled = true; }); return null; }
        let all = true;
        sels.forEach((s, i) => {
          s.disabled = true;
          const exp = q.ans[i];
          if (exp == null) return;
          const ok = s.value === String(exp);
          s.classList.add(ok ? 'ok' : 'bad');
          if (!ok) { all = false; s.parentNode.appendChild(h('div', { class: 'small', style: { color: 'var(--ok)' } }, '→ ' + q.sections[i].choices[exp])); }
        });
        return all;
      },
    };
  }

  function qShort(q) {
    const ta = h('textarea', { class: 'input', rows: '2', style: { width: '100%', font: '18px/1.7 var(--font-jp)' }, placeholder: 'Gõ lại câu trong ảnh (romaji tự chuyển hiragana)…' });
    kanaInput(ta);
    return {
      el: ta,
      answered: () => !!ta.value.trim(),
      check() {
        ta.disabled = true;
        if (q.ans == null) return null;
        const ok = sameAns(ta.value, q.ans, false) || sameAns(ta.value, q.ans, true);
        ta.classList.add(ok ? 'ok' : 'bad');
        return ok;
      },
    };
  }

  function questionCard(q, n, partTitle, opts) {
    opts = opts || {};
    const card = h('div', { class: 'card qcard', id: 'q-' + n });
    card.appendChild(h('div', { class: 'qhead' }, h('span', { class: 'qn' }, n), h('span', { class: 'tag' }, TYPE_VI[q.type] || q.type), confBadge(q),
      opts.source ? h('span', { class: 'tag', lang: 'ja' }, opts.source) : null));
    let r;
    if (q.type === 'blanks') r = qBlanks(q);
    else {
      const parts = String(q.prompt || '').split('<hr class="qsep">');
      if (parts.length > 1 && parts[1].replace(/<[^>]+>/g, '').trim()) {
        card.appendChild(h('div', { class: 'qinst', lang: 'ja', html: parts[0] }));
        card.appendChild(h('div', { class: 'qprompt', lang: 'ja', html: parts.slice(1).join('<hr class="qsep">') }));
      } else card.appendChild(h('div', { class: 'qprompt', lang: 'ja', html: q.prompt || '' }));
      r = q.type === 'single' ? qSingle(q) : q.type === 'matching' ? qMatching(q) : (q.type === 'order' || q.type === 'dragtext') ? qOrder(q) : qShort(q);
    }
    card.appendChild(r.el);
    card.querySelectorAll('.qprompt img').forEach((img) => { img.onclick = () => lightbox(img.src); });
    const fb = h('div');
    card.appendChild(fb);
    r.reveal = (res) => {
      fb.innerHTML = '';
      const cls = res === true ? 'ok' : res === false ? 'bad' : '';
      const parts = [];
      if (res === true) parts.push(h('span', { class: 'ex-t' }, ic('checkCircle'), 'Đúng'), '  ');
      else if (res === false) parts.push(h('span', { class: 'ex-t' }, ic('xCircle'), 'Chưa đúng'), '  ');
      if (q.type === 'single' && q.ans != null && res === false) parts.push(h('span', null, '· Đáp án: ', h('b', { lang: 'ja', html: String(q.options[q.ans]).replace(/<\/?p>/g, ' ').trim() })));
      if ((q.type === 'order' || q.type === 'dragtext') && q.ans) parts.push(h('div', { lang: 'ja' }, 'Đáp án: ', h('b', null, r.correctText())));
      if (q.sentence) parts.push(h('div', { lang: 'ja' }, '→ ', h('b', null, q.sentence)));
      if (q.type === 'short' && q.ans) parts.push(h('div', { lang: 'ja' }, 'Câu đúng: ', h('b', null, q.ans)));
      if (q.explain) parts.push(h('div', { html: esc(q.explain), style: { marginTop: '4px' } }));
      if (q.note && !q.needs_audio) parts.push(h('div', { class: 'small muted', style: { marginTop: '6px', display: 'flex', gap: '6px' } }, ic('pin'), h('span', null, q.note)));
      if (q.needs_audio) parts.push(h('div', { class: 'small muted', style: { display: 'flex', gap: '6px' } }, ic('headphones'), h('span', null, 'Câu nghe — không có đáp án, hãy nghe audio rồi tự đối chiếu.')));
      if (!parts.length) return;
      fb.appendChild(h('div', { class: 'explain ' + cls }, parts));
    };
    return { card, r, q };
  }

  // ------------------------------------------------------------------ player
  function renderPlayer(main, id) {
    let qz;
    if (id === 'mix') {
      const keys = Store.get('bankMix', []);
      const all = {};
      (G.BANK || []).forEach((b) => b.parts.forEach((p) => p.questions.forEach((q) => { all[q.key] = { q, b, p }; })));
      const items = keys.map((k) => all[k]).filter(Boolean);
      qz = { id: 'mix', name: 'Trộn ngẫu nhiên ' + items.length + ' câu', unit: 0, parts: [{ title: 'Câu hỏi từ nhiều bài', questions: items.map((x) => Object.assign({ _src: x.b.name, _part: x.p.title }, x.q)) }] };
    } else qz = D.quiz(id);
    if (!qz) { main.appendChild(h('div', { class: 'empty' }, 'Không tìm thấy bài.', h('a', { href: '#/bank' }, ' Quay lại'))); return; }
    const st = Object.assign({ mode: 'practice' }, Store.get('bankUi', {}));
    const items = [];
    const head = h('div', { class: 'player-head' });
    G.App.title('Đề luyện LMS', qz.name);
    main.appendChild(h('div', { class: 'row', style: { marginBottom: '10px' } }, A('sm ghost', 'arrowLeft', 'Danh sách đề', '#/bank'), qz.unit ? uTag(qz.unit) : null));
    main.appendChild(h('h1', { class: 'player-title', lang: 'ja' }, qz.name));
    const modeSeg = h('div', { class: 'seg' });
    [['practice', 'Luyện tập', 'Chấm từng câu ngay'], ['test', 'Làm bài', 'Làm hết rồi nộp, chấm cuối']].forEach(([k, t, tip]) => modeSeg.appendChild(h('button', { class: st.mode === k ? 'on' : '', title: tip, onclick: () => { st.mode = k; Store.set('bankUi', st); G.App.rerender(); } }, t)));
    const navBox = h('div', { class: 'qnav' });
    const scoreEl = h('span', { class: 'score-line' });
    head.append(h('div', { class: 'row' }, modeSeg, h('span', { class: 'spacer' }), scoreEl,
      st.mode === 'test' ? B('sm accent', 'send', 'Nộp bài', submitAll) : B('sm', 'eye', 'Hiện đáp án', revealAll, { title: 'Hiện đáp án tất cả câu' })), h('div', { style: { marginTop: '10px' } }, navBox));
    main.appendChild(head);
    let n = 0;
    qz.parts.forEach((p) => {
      main.appendChild(h('div', { class: 'section-title' }, h('h3', { lang: 'ja', style: { margin: 0 } }, p.title), h('div', { class: 'line' })));
      p.questions.forEach((q) => {
        n++;
        const it = questionCard(q, n, p.title, { source: q._src });
        it.done = null;
        main.appendChild(it.card);
        if (st.mode === 'practice') {
          const btn = B('sm primary', q.needs_audio ? 'info' : 'check', q.needs_audio ? 'Xem hướng dẫn' : 'Kiểm tra', () => {
            if (it.done !== null) return;
            if (!it.r.answered() && !q.needs_audio) { toast('Hãy trả lời trước'); return; }
            const res = it.r.check(); it.done = res; it.r.reveal(res); btn.remove(); paintNav();
          }, { style: { marginTop: '12px' } });
          it.card.appendChild(btn);
        }
        items.push(it);
      });
    });
    function paintNav() {
      navBox.innerHTML = '';
      let ok = 0, checked = 0;
      items.forEach((it, i) => {
        if (it.done === true) ok++;
        if (it.done === true || it.done === false) checked++;
        navBox.appendChild(h('button', { class: it.done === true ? 'ok' : it.done === false ? 'bad' : '', title: 'Câu ' + (i + 1), onclick: () => { it.card.scrollIntoView({ block: 'center', behavior: 'smooth' }); } }, i + 1));
      });
      const gradable = items.filter((it) => keyed(it.q)).length;
      scoreEl.innerHTML = '';
      scoreEl.append(h('b', null, String(ok)), h('span', null, `/ ${checked} đã chấm`), h('span', { class: 'muted' }, `· ${gradable} có đáp án`));
      if (checked && checked === gradable && qz.id !== 'mix' && !paintNav.saved) { Prog.saveQuiz(qz.id, ok, gradable); paintNav.saved = true; toast(`Hoàn thành: ${ok}/${gradable} (${pct(ok, gradable)}%)`, 3500); }
    }
    function revealAll() { items.forEach((it) => { if (it.done === null) { const res = it.r.check(); it.done = res; it.r.reveal(res); const b = it.card.querySelector('.btn.primary'); if (b) b.remove(); } }); paintNav(); }
    function submitAll() {
      const unanswered = items.filter((it) => keyed(it.q) && !it.r.answered()).length;
      if (unanswered && !window.confirm(`Còn ${unanswered} câu chưa làm. Vẫn nộp bài?`)) return;
      items.forEach((it) => { if (it.done === null) { const res = it.r.check(); it.done = res; it.r.reveal(res); } });
      paintNav();
      const ok = items.filter((it) => it.done === true).length;
      const gradable = items.filter((it) => keyed(it.q)).length;
      modal({ title: 'Kết quả', body: h('div', { class: 'result-card', style: { padding: '6px 0' } }, W.gauge(pct(ok, gradable), 'điểm'), h('div', { class: 'num', style: { fontSize: '16px' } }, `${ok} / ${gradable} câu đúng`), h('p', { class: 'small muted' }, 'Kéo xuống để xem giải thích từng câu.')) });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    paintNav();
  }

  function render(main, args, query) {
    if (args[0]) return renderPlayer(main, args[0]);
    return renderList(main, query || {});
  }

  G.Pages.register('bank', { title: 'Đề luyện LMS', render });
  G.BankUI = { questionCard, keyed };
})(window);
