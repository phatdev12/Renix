/* Viết luận — essay helper */
(function (G) {
  'use strict';
  const { h, esc, ic, B, A, ruby, plain, speechText, D, Store, TTS, toast } = G.U;
  const W = G.W;

  // patterns to detect in the draft (per unit)
  const CHECKS = {
    13: [['～たら', /(った|んだ|いた|いだ|した|かった|だった|た)ら/], ['V₁て、V₂', /[てで]、/], ['V₁てから、V₂', /[てで]から/], ['V₁ながら', /ながら/], ['Nだけ', /だけ/]],
    14: [['趣味は Vることです', /ことです/], ['Vるのが Adj', /のが/], ['Vるのは Adj', /のは/], ['Vることが できます', /ことが?でき/], ['それで', /それで/]],
    15: [['～つもりです', /つもり/], ['～と思います', /と(思|おも)/], ['～だろうと思います', /だろう/], ['～かもしれません', /かもしれ/], ['～かどうか', /かどうか/], ['V₁ないで、V₂', /ないで/], ['Vなくてもいい', /なくても/], ['Nに なります', /にな[りるっ]/], ['Vるまでに', /までに/]],
    16: [['可能形', /(え|け|げ|せ|て|ね|べ|め|れ)(ます|ません|る|ない)|られ|でき/], ['Vるまえに／Nのまえに', /(る|の)(まえ|前)に/], ['～ので', /ので/], ['～ようになりました', /ようにな/], ['だから／ですから', /(だ|です)から、/], ['Vます＋方', /[いきしちにひみりぎびえけせてねべめれ](方|かた)/], ['なんでも', /(なん|何)でも/]],
    17: [['あげます／さしあげます', /あげ/], ['もらいます／いただきます', /もらい|いただき/], ['くれます／くださいます', /くれ|くださ(い|っ)/], ['どれも／みんな', /どれも|みんな/]],
  };

  function render(main, args) {
    const sel = D.sel();
    const uid = parseInt(args[0], 10) || sel[0];
    const unit = D.unit(uid) || D.units[0];
    const e = unit.essay;
    main.appendChild(W.pageHead('Viết luận', 'さくぶん'));
    main.appendChild(W.unitSwitch(unit.id, '#/essay/'));
    const layout = h('div', { class: 'essay-layout' });
    main.appendChild(layout);
    const left = h('div', { class: 'card' });
    const right = h('div', { class: 'col', style: { gap: '14px' } });
    layout.append(left, right);

    left.append(h('div', { class: 'glabel', style: { marginTop: 0 } }, 'Đề gợi ý'),
      h('h2', { lang: 'ja', style: { margin: '2px 0', fontSize: '22px' }, html: ruby(e.title) }), h('div', { class: 'muted', style: { marginBottom: '14px' } }, e.vi));
    const key = 'essay.' + unit.id;
    const ta = h('textarea', { class: 'input essay-area', lang: 'ja', placeholder: 'わたしは、毎朝、六時に起きます。…', spellcheck: 'false', title: 'Tự lưu trên máy' });
    ta.value = Store.get(key, '');
    const counter = h('span', { class: 'essay-count' });
    const checklist = h('div');
    function update() {
      const txt = ta.value;
      Store.set(key, txt);
      const chars = txt.replace(/\s/g, '').length;
      counter.textContent = chars + ' ký tự';
      checklist.innerHTML = '';
      (CHECKS[unit.id] || []).forEach(([label, re]) => {
        const on = re.test(txt);
        checklist.appendChild(h('div', { class: 'check-item' + (on ? ' on' : '') }, h('span', { class: 'box' }, on ? ic('check') : null), h('span', { lang: 'ja' }, label)));
      });
    }
    ta.addEventListener('input', G.U.debounce(update, 250));
    left.append(ta,
      h('div', { class: 'row', style: { marginTop: '10px', gap: '6px' } }, counter, h('span', { class: 'spacer' }),
        B('sm', 'volume', 'Nghe', () => { if (ta.value.trim()) TTS.speak(ta.value); }),
        B('sm', 'download', '.txt', () => { const b = new Blob([ta.value], { type: 'text/plain;charset=utf-8' }); const a = h('a', { href: URL.createObjectURL(b), download: `Unit ${unit.id}_Sakubun.txt` }); document.body.appendChild(a); a.click(); a.remove(); }, { title: 'Tải bài viết về máy' }),
        B('sm', 'copy', 'Sao chép', () => { navigator.clipboard && navigator.clipboard.writeText(ta.value).then(() => toast('Đã sao chép')); })));

    right.append(
      h('div', { class: 'card' }, h('h3', null, ic('puzzle'), 'Mẫu nên dùng', W.infoTip('Tự đánh dấu khi bài viết có dùng mẫu đó')), checklist,
        h('div', { class: 'glabel' }, 'Ý tưởng'), h('ul', { class: 'usage' }, e.ideas.map((x) => h('li', null, x))),
        h('div', { style: { marginTop: '12px' } }, A('sm', 'puzzle', 'Xem lại ngữ pháp', '#/grammar'))));
    right.appendChild(h('details', { class: 'box', style: { margin: 0 } }, h('summary', null, ic('bulb'), 'Mẹo viết bài'),
      h('div', { class: 'box-body' }, h('ol', { class: 'steps' },
        h('li', null, h('span', null, h('b', null, 'Bố cục 3 phần'), ': mở bài → thân bài (2–3 ý) → kết bài')),
        h('li', null, h('span', null, h('b', null, 'Một thể'), ': toàn bài です・ます (hoặc toàn bài thể thường)')),
        h('li', null, h('span', null, h('b', null, 'Từ nối'), ': そして、それから、でも、だから、それで…')),
        h('li', null, h('span', null, h('b', null, 'Nộp bài'), ': viết tay → gõ lại & nhờ góp ý → bản hoàn chỉnh → phiếu phản tư → nộp 3 file ở Part 5'))))));
    const m = G.NIX.model;
    right.appendChild(h('details', { class: 'box', style: { margin: 0 }, open: unit.id === 13 }, h('summary', null, ic('file'), 'Bài mẫu · ', h('span', { lang: 'ja', html: ruby(m.title) })),
      h('div', { class: 'box-body model' }, h('p', { class: 'small muted', style: { fontFamily: 'var(--font-ui)' } }, m.label),
        m.paragraphs.map((p) => h('p', { lang: 'ja', html: ruby(p) })),
        B('sm', 'volume', 'Nghe bài mẫu', () => TTS.speak(m.paragraphs.map(speechText).join(''))))));
    update();
    return () => TTS.stop();
  }

  G.Pages.register('essay', { title: 'Viết luận', render });
})(window);
