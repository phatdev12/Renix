/* Chia động từ — conjugation table and drill */
(function (G) {
  'use strict';
  const { h, esc, ic, B, ruby, D, Store, TTS, speakBtn, shuffle, pick, uniq, sameAns, kanaInput, Prog, pct } = G.U;
  const W = G.W;
  const C = G.Conj;
  const GN = ['', 'I', 'II', 'III'];
  const verbs = () => G.VERBS || [];
  const drillForms = C.FORMS.filter((f) => !['masu', 'kanouMasu'].includes(f.id));

  function stemRuby(v, word) {
    const [a, b] = C.splitEnding(v.k, word);
    // reuse widget logic: ruby for the unchanged part
    const r = v.ruby || v.k;
    let out = '', len = 0;
    const re = /\{([^|{}]+)\|([^{}]+)\}|([^{}])/g; let m;
    while ((m = re.exec(r)) && len < a.length) {
      if (m[1]) { if (len + m[1].length <= a.length) { out += m[0]; len += m[1].length; } else break; }
      else { out += m[3]; len += 1; }
    }
    const head = len === a.length ? ruby(out) : esc(a);
    return head + `<span class="end">${esc(b)}</span>`;
  }

  function renderTable(main) {
    const st = Object.assign({ g: 0, mine: false }, Store.get('conjTable', {}));
    const save = () => Store.set('conjTable', st);
    const gSeg = h('div', { class: 'seg' });
    [[0, 'Tất cả'], [1, 'Nhóm I'], [2, 'Nhóm II'], [3, 'Nhóm III']].forEach(([g, t]) => gSeg.appendChild(h('button', { class: st.g === g ? 'on' : '', onclick: () => { st.g = g; save(); paint(); Array.from(gSeg.children).forEach((b, i) => b.classList.toggle('on', i === g)); } }, t)));
    const mine = h('label', { class: 'check small', title: 'Chỉ động từ có trong từ vựng các Unit đang ôn' }, h('input', { type: 'checkbox', checked: st.mine, onchange: (e) => { st.mine = e.target.checked; save(); paint(); } }), 'Chỉ trong bài');
    const q = h('input', { class: 'input', type: 'search', placeholder: 'Tìm động từ (romaji / かな)…' });
    kanaInput(q);
    q.addEventListener('input', G.U.debounce(paint, 150));
    main.appendChild(h('div', { class: 'filters' }, q, gSeg, mine));
    main.appendChild(h('details', { class: 'box' }, h('summary', null, ic('sliders'), 'Quy tắc chia'),
      h('div', { class: 'box-body' },
        h('div', { class: 'grid-2' },
          h('div', null, h('div', { class: 'glabel' }, 'Cách nhận biết nhóm (từ thể ます)'),
            h('ul', { class: 'small' },
              h('li', null, h('b', { class: 'g1' }, 'Nhóm I'), ': âm trước ます thuộc hàng い — かきます, のみます, かえります…'),
              h('li', null, h('b', { class: 'g2' }, 'Nhóm II'), ': âm trước ます thuộc hàng え — たべます, ねます…; và một số động từ hàng い phải học thuộc: みます, おきます, きます (mặc), あびます, かります, できます.'),
              h('li', null, h('b', { class: 'g3' }, 'Nhóm III'), ': します (và N＋します), 来（き）ます.'))),
          h('div', null, h('div', { class: 'glabel' }, 'Thể て / た (Nhóm I)'), W.conjTable('te'))))));
    const out = h('div');
    main.appendChild(out);
    const myVerbs = () => {
      const kanas = new Set(D.vocab().map((v) => v.kana.replace(/（.*?）|\(.*?\)/g, '')));
      const units = new Set(D.sel());
      return verbs().filter((v) => (v.u && units.has(v.u)) || kanas.has(v.m));
    };
    function paint() {
      out.innerHTML = '';
      let list = st.mine ? myVerbs() : verbs();
      if (st.g) list = list.filter((v) => v.g === st.g);
      const s = q.value.trim();
      if (s) list = list.filter((v) => v.m.includes(s) || v.k.includes(s) || v.vi.toLowerCase().includes(s.toLowerCase()));
      const cols = ['jisho', 'nai', 'ta', 'te', 'kanou'];
      const t = h('table', { class: 'ctable' }, h('tr', null, h('th', null, 'ます形'), h('th', null, 'Nhóm'), ...cols.map((c) => h('th', { lang: 'ja' }, C.FORMS.find((f) => f.id === c).jp)), h('th', null, 'Nghĩa')));
      list.forEach((v) => {
        const tb = C.table(v);
        t.appendChild(h('tr', null,
          h('td', { class: 'jp', lang: 'ja', html: ruby(v.ruby) }),
          h('td', null, h('b', { class: 'g' + v.g }, GN[v.g])),
          ...cols.map((c) => tb[c] ? h('td', { class: 'jp', lang: 'ja', style: { cursor: 'pointer' }, title: 'Bấm để nghe', html: stemRuby(v, tb[c].kanji), onclick: () => TTS.speak(tb[c].kanji) }) : h('td', { class: 'muted' }, '—')),
          h('td', { class: 'small' }, v.vi)));
      });
      out.appendChild(h('div', { class: 'row small muted', style: { margin: '6px 2px 10px', gap: '8px' } }, list.length !== verbs().length ? h('span', { class: 'num' }, list.length + ' động từ ·') : null,
        h('span', null, 'bấm ô để nghe ·'), h('span', null, h('b', { class: 'end' }, 'gạch chân'), ' = đuôi thay đổi')));
      out.appendChild(h('div', { class: 'table-wrap' }, t));
    }
    paint();
  }

  // wrong-but-plausible answers for multiple choice
  function wrongForms(v, form) {
    const right = C.conj(v.k, v.g, form);
    const cands = [];
    if (v.g !== 3) {
      const other = v.g === 1 ? 2 : 1;
      try { cands.push(C.conj(v.k, other, form)); } catch (e) { /* stem not valid for other group */ }
    }
    const stem = v.k.slice(0, -2);
    const head = stem.slice(0, -1);
    if (form === 'te' || form === 'ta') {
      const suf = form === 'te' ? ['って', 'んで', 'いて', 'して'] : ['った', 'んだ', 'いた', 'した'];
      suf.forEach((s) => cands.push((v.g === 1 ? head : stem) + s));
      cands.push(stem + (form === 'te' ? 'て' : 'た'));
    }
    if (form === 'nai' || form === 'nakatta') cands.push(stem + (form === 'nai' ? 'ない' : 'なかった'));
    if (form === 'kanou') { cands.push(stem + 'られる'); cands.push(stem + 'れる'); }
    if (form === 'jisho') { cands.push(stem + 'る'); cands.push(stem + 'う'); }
    drillForms.forEach((f) => { if (f.id !== form) { try { const x = C.conj(v.k, v.g, f.id); if (x) cands.push(x); } catch (e) { /* ignore */ } } });
    return shuffle(uniq(cands.filter((x) => x && x !== right)));
  }

  function renderDrill(main) {
    const st = Object.assign({ forms: ['jisho', 'nai', 'ta', 'te', 'kanou'], set: 'all', mode: 'type', showG: true }, Store.get('conjDrill', {}));
    const save = () => Store.set('conjDrill', st);
    const settings = h('div', { class: 'card conj-settings qbox', style: { marginBottom: '14px' } });
    const fBox = h('div', { class: 'form-chips' });
    drillForms.forEach((f) => {
      const lab = h('label', { class: st.forms.includes(f.id) ? 'on' : '', title: f.vi }, h('input', { type: 'checkbox', checked: st.forms.includes(f.id), onchange: (e) => {
        st.forms = e.target.checked ? uniq(st.forms.concat(f.id)) : st.forms.filter((x) => x !== f.id);
        if (!st.forms.length) st.forms = ['te'];
        Array.from(fBox.children).forEach((l, i) => { l.classList.toggle('on', st.forms.includes(drillForms[i].id)); l.firstChild.checked = st.forms.includes(drillForms[i].id); });
        save(); next();
      } }), h('span', { lang: 'ja' }, f.jp));
      fBox.appendChild(lab);
    });
    const modeSeg = h('div', { class: 'seg' });
    [['type', 'keyboard', 'Gõ'], ['mc', 'list', 'Chọn']].forEach(([k, icon, t]) => modeSeg.appendChild(h('button', { class: st.mode === k ? 'on' : '', onclick: () => { st.mode = k; save(); Array.from(modeSeg.children).forEach((b, i) => b.classList.toggle('on', ['type', 'mc'][i] === k)); next(); } }, ic(icon), t)));
    const setSeg = h('div', { class: 'seg' });
    [['all', 'Tất cả'], ['unit', 'Trong bài']].forEach(([k, t]) => setSeg.appendChild(h('button', { class: st.set === k ? 'on' : '', onclick: () => { st.set = k; save(); Array.from(setSeg.children).forEach((b, i) => b.classList.toggle('on', ['all', 'unit'][i] === k)); next(); } }, t)));
    const showG = h('label', { class: 'check small' }, h('input', { type: 'checkbox', checked: st.showG, onchange: (e) => { st.showG = e.target.checked; save(); next(); } }), 'Hiện nhóm');
    settings.append(fBox, h('div', { class: 'row' }, modeSeg, setSeg, showG));
    main.appendChild(settings);
    const stage = h('div', { class: 'card qbox' });
    main.appendChild(stage);
    const statLine = h('div', { class: 'row', style: { justifyContent: 'center', marginTop: '12px' } });
    main.appendChild(statLine);
    let streak = 0, sessOk = 0, sessN = 0;

    function pool() {
      let list = verbs();
      if (st.set === 'unit') {
        const units = new Set(D.sel());
        const kanas = new Set(D.vocab().map((v) => v.kana));
        const mine = list.filter((v) => (v.u && units.has(v.u)) || kanas.has(v.m));
        if (mine.length >= 4) list = mine;
      }
      return list;
    }
    function next() {
      const forms = st.forms.slice();
      let v, form, tries = 0;
      do { v = pick(pool()); form = pick(forms); tries++; } while (((form === 'kanou' && v.nopot) || !v) && tries < 50);
      const f = C.FORMS.find((x) => x.id === form);
      const right = { kana: C.conj(v.m, v.g, form), kanji: C.conj(v.k, v.g, form) };
      stage.innerHTML = '';
      stage.append(
        h('div', { class: 'row', style: { justifyContent: 'center' } }, st.showG ? h('span', { class: 'tag pri' }, 'Nhóm ' + GN[v.g]) : null, v.u ? h('span', { class: 'tag u' + v.u }, 'U' + v.u) : null),
        h('div', { class: 'conj-q', lang: 'ja', html: ruby(v.ruby) }),
        h('div', { class: 'center muted' }, v.vi),
        h('div', { class: 'conj-target' }, '→ ', h('b', null, f.jp), '  ', h('span', { class: 'small muted' }, f.vi)));
      const fb = h('div');
      let done = false;
      function finish(ok, given) {
        done = true;
        sessN++; if (ok) { sessOk++; streak++; } else streak = 0;
        Prog.conj(form, ok);
        fb.innerHTML = '';
        const nextB = B('primary', null, 'Câu tiếp', next, { id: 'conj-next', title: 'Enter' });
        nextB.appendChild(ic('arrowRight'));
        fb.append(h('div', { class: 'feedback ' + (ok ? 'ok' : 'bad') },
          h('div', null, h('span', { class: 'fb-t' }, ic(ok ? 'checkCircle' : 'xCircle'), ok ? 'Chính xác' : 'Chưa đúng'), '  · ', h('b', { lang: 'ja', html: stemRuby(v, right.kanji) }), ' （', h('span', { lang: 'ja' }, right.kana), '）', speakBtn(right.kanji)),
          h('div', { class: 'rulebox', style: { marginTop: '6px' } }, ic('sliders'), h('span', null, C.rule(v, form)))),
          h('div', { class: 'center', style: { marginTop: '14px' } }, nextB));
        TTS.speak(right.kanji);
        paintStat();
        setTimeout(() => { const b = stage.querySelector('#conj-next'); if (b) b.focus(); }, 20);
      }
      if (st.mode === 'mc') {
        const wrong = wrongForms(v, form).slice(0, 3);
        const opts = shuffle([right.kanji].concat(wrong));
        const box = h('div', { class: 'opts' });
        opts.forEach((o, i) => box.appendChild(h('button', { class: 'opt jp', lang: 'ja', onclick: () => {
          if (done) return;
          const ok = o === right.kanji;
          Array.from(box.children).forEach((b, j) => { b.disabled = true; if (opts[j] === right.kanji) b.classList.add('correct'); else if (j === i) b.classList.add('wrong'); else b.classList.add('dim'); });
          finish(ok, o);
        } }, h('span', { class: 'ok-key' }, String(i + 1)), h('span', null, o))));
        stage.appendChild(box);
      } else {
        const inp = kanaInput(h('input', { class: 'input answer-input', placeholder: 'vd: kaite → かいて' }));
        const go = B('primary', 'check', 'Kiểm tra', check);
        function check() {
          if (done) { next(); return; }
          if (!inp.value.trim()) return;
          inp.value = G.U.toHira(inp.value, false);
          const ok = sameAns(inp.value, [right.kana, right.kanji], true);
          inp.classList.add(ok ? 'ok' : 'bad'); inp.disabled = true; go.disabled = true;
          finish(ok, inp.value);
        }
        inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); check(); } });
        stage.appendChild(h('div', { class: 'row', style: { justifyContent: 'center' } }, inp, go));
        setTimeout(() => inp.focus(), 30);
      }
      stage.appendChild(fb);
    }
    const onKey = (e) => {
      if (e.key === 'Enter' && document.activeElement && document.activeElement.id === 'conj-next') return;
      if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= 4) { const b = stage.querySelectorAll('.opt')[n - 1]; if (b && !b.disabled) b.click(); }
    };
    document.addEventListener('keydown', onKey);
    function paintStat() {
      const c = Store.get('conj', {});
      statLine.innerHTML = '';
      if (sessN) statLine.append(h('span', { class: 'tag pri' }, `Phiên này ${sessOk}/${sessN}`), h('span', { class: 'streak', title: 'Chuỗi trả lời đúng liên tiếp' }, ic('flame'), String(streak)));
      if (c.n) statLine.appendChild(h('span', { class: 'small muted num' }, `Tổng ${c.ok}/${c.n} · ${pct(c.ok, c.n)}%`));
    }
    paintStat();
    next();
    return () => document.removeEventListener('keydown', onKey);
  }

  function render(main, args) {
    const mode = args[0] === 'drill' ? 'drill' : 'table';
    const seg = h('div', { class: 'seg' });
    [['table', 'list', 'Bảng chia'], ['drill', 'target', 'Luyện chia']].forEach(([k, icon, t]) => seg.appendChild(h('button', { class: mode === k ? 'on' : '', onclick: () => { location.hash = k === 'drill' ? '#/conj/drill' : '#/conj'; } }, ic(icon), t)));
    main.appendChild(W.pageHead('Chia động từ', 'どうしのかつよう', seg, verbs().length + ' động từ'));
    return mode === 'drill' ? renderDrill(main) : renderTable(main);
  }

  G.Pages.register('conj', { title: 'Chia động từ', render });
  G.ConjTools = { wrongForms, stemRuby };
})(window);
