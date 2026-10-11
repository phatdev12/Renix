/* Bài khóa — master text reader with translation, TTS, shadowing and recording */
(function (G) {
  'use strict';
  const { h, ic, B, ruby, speechText, D, TTS, Store, Settings, lightbox, toast, esc, modal, speakBtn } = G.U;
  const W = G.W;

  function render(main, args) {
    const sel = D.sel();
    const uid = parseInt(args[0], 10) || sel[0];
    const unit = D.unit(uid) || D.units[0];
    const speakers = G.NIX.speakers;
    const st = Object.assign({ furi: 'show', vi: false, onlySh: false }, Store.get('textUi', {}));
    const save = () => Store.set('textUi', { furi: st.furi, vi: st.vi, onlySh: st.onlySh });
    let token = 0;
    let recorder = null, recChunks = [], recUrl = null;
    G.App.title('Bài khóa · Unit ' + unit.id, 'マスターテクスト');

    // ----- flat sentence list
    const sents = [];
    unit.sections.forEach((sec, si) => sec.paragraphs.forEach((p, pi) => p.forEach((s, i) => sents.push(Object.assign({ si, pi, i, speaker: sec.speaker }, s)))));
    sents.forEach((s, k) => { s.k = k; });
    let cur = -1;

    // ----- header
    main.appendChild(W.unitSwitch(unit.id, '#/text/'));
    main.appendChild(h('div', { class: 'text-hero' },
      h('h1', { class: 'text-title', lang: 'ja', html: ruby(unit.title) }),
      h('div', { class: 'text-sub', style: { paddingBottom: '14px' } }, unit.titleVi, unit.titleNote ? h('span', { class: 'tiny', title: unit.titleNote }, ' *') : null)));

    // ----- toolbar
    const segFuri = h('div', { class: 'seg', title: 'Furigana' });
    [['show', 'ふりがな'], ['hover', 'Rê chuột'], ['hide', 'Ẩn']].forEach(([k, label]) => segFuri.appendChild(h('button', { class: st.furi === k ? 'on' : '', lang: k === 'show' ? 'ja' : null, onclick: () => { st.furi = k; save(); applyUi(); } }, label)));
    const btnVi = B('sm', 'message', 'Dịch', () => { st.vi = !st.vi; save(); applyUi(); }, { title: 'Hiện bản dịch tiếng Việt' });
    const btnSh = B('sm', 'target', 'Đoạn nộp', () => { st.onlySh = !st.onlySh; save(); applyUi(); }, { title: 'Chỉ hiện đoạn phải quay video shadowing nộp LMS' });
    const btnPlay = B('sm primary', 'play', 'Nghe cả bài', () => playAll(false));
    const btnShadow = B('sm accent', 'wave', 'Shadowing', () => playAll(true), { title: 'Nghe từng câu, nhại lại trong khoảng lặng.\nCách luyện: nghe 1–2 lần không nhìn chữ → đọc theo với furigana → shadowing ở 0.75× → ẩn chữ, chỉ nghe → ghi âm rồi nghe lại.' });
    const btnStop = B('sm', 'stop', 'Dừng', stopAll, { hidden: true });
    // one speed control for both the recorded voice and speech synthesis
    const nClips = sents.filter((x) => TTS.hasClip(speechText(x.jp))).length;
    const curRate = String(nClips ? (Settings.get('clipRate') || 1) : Settings.get('rate'));
    const rate = h('select', { class: 'input', title: 'Tốc độ đọc', onchange: () => { const v = parseFloat(rate.value); Settings.set('rate', v); Settings.set('clipRate', v); } },
      ['0.6', '0.75', '0.9', '1', '1.15'].map((r) => h('option', { value: r, selected: curRate === r }, r + '×')));
    const voiceTag = nClips ? h('span', { class: 'tag hide-sm', title: `Giọng đọc thật lấy từ video bài đọc của lớp (${nClips}/${sents.length} câu). Câu còn lại dùng giọng máy.` }, ic('mic'), 'Giọng thật') : null;
    main.appendChild(h('div', { class: 'toolbar' }, btnPlay, btnShadow, btnStop, rate, voiceTag, h('span', { class: 'spacer' }), segFuri, btnVi, btnSh));

    const layout = h('div', { class: 'text-layout' });
    const body = h('div', { class: 'text-main textbody' });
    const side = h('div', { class: 'text-side' });
    layout.append(body, side);
    main.appendChild(layout);

    // ----- body
    const sentEls = [];
    const viEls = [];
    unit.sections.forEach((sec, si) => {
      if (sec.heading) body.appendChild(h('div', { class: 'heading-jp', lang: 'ja' }, h('span', { html: ruby(sec.heading) }), sec.headingVi ? h('span', { class: 'hv' }, sec.headingVi) : null));
      const spk = speakers[sec.speaker];
      body.appendChild(h('div', { class: 'speaker', title: spk.vi }, h('div', { class: 'avatar ' + sec.speaker, lang: 'ja' }, spk.name[0]), h('b', { lang: 'ja' }, spk.name)));
      sec.paragraphs.forEach((p, pi) => {
        const para = h('p', { class: 'para', lang: 'ja' });
        const vi = h('div', { class: 'para-vi' });
        p.forEach((s, i) => {
          const k = sents.find((x) => x.si === si && x.pi === pi && x.i === i).k;
          const el = h('span', { class: 'sent' + (s.sh ? ' sh' : ''), html: ruby(s.jp), onclick: () => { if (!btnStop.hidden) stopAll(); select(k, true); } });
          sentEls[k] = el;
          para.appendChild(el);
          const v = h('span', { onclick: () => select(k, true) }, s.vi + ' ');
          viEls[k] = v;
          vi.appendChild(v);
        });
        body.appendChild(para);
        body.appendChild(vi);
      });
    });

    // ----- side: current sentence
    const dock = h('div', { class: 'card dock' });
    const dockPos = h('span', { class: 'dock-pos' });
    const dockTags = h('span', { class: 'row', style: { gap: '4px', flexWrap: 'nowrap' } });
    const dockJp = h('div', { class: 'dock-jp', lang: 'ja' });
    const dockVi = h('div', { class: 'dock-vi' });
    const recBtn = B('sm', 'mic', 'Ghi âm', toggleRec, { title: 'Ghi âm giọng bạn để so sánh' });
    const playRec = B('sm', 'play', 'Giọng mình', () => { if (recUrl) new Audio(recUrl).play(); }, { hidden: true });
    const dockFull = h('div', { hidden: true },
      h('div', { class: 'row', style: { gap: '4px', flexWrap: 'nowrap' } }, dockPos, dockTags, h('span', { class: 'spacer' }),
        h('button', { class: 'icon-btn sm', title: 'Câu trước (←)', onclick: () => select(Math.max(0, cur - 1), true) }, ic('left')),
        h('button', { class: 'icon-btn sm', title: 'Nghe lại (Space)', onclick: () => speakCur() }, ic('volume')),
        h('button', { class: 'icon-btn sm', title: 'Câu sau (→)', onclick: () => select(Math.min(sents.length - 1, cur + 1), true) }, ic('right')),
        h('button', { class: 'icon-btn sm', title: 'Đóng', onclick: () => { closeDock(); } }, ic('x'))),
      dockJp, dockVi,
      h('div', { class: 'row', style: { marginTop: '10px', gap: '6px' } }, recBtn, playRec, B('sm', 'turtle', '0.7×', () => speakCur(0.7), { title: 'Đọc chậm' })));
    const dockEmpty = h('div', { class: 'dock-empty' }, ic('volume'), 'Bấm vào một câu để nghe, xem nghĩa và chữ Hán.');
    dock.append(dockEmpty, dockFull);
    side.appendChild(dock);

    // ----- side: resources
    const nGuide = unit.guides.reduce((s, g) => s + g.pages.length, 0);
    const res = h('div', { class: 'res-list' });
    if (unit.videos.text) res.appendChild(h('button', { onclick: () => W.videoModal(unit.videos.text, 'Video bài đọc · Unit ' + unit.id) }, ic('video'), 'Video bài đọc', h('span', { class: 'tag' }, (G.LOCAL_MEDIA || {})[unit.videos.text] ? 'offline' : 'online')));
    if (nGuide) res.appendChild(h('button', { onclick: showGuides }, ic('music'), 'Ngữ điệu (pitch)', h('span', { class: 'tag' }, nGuide + ' trang')));
    if (unit.pdfs.yomimono) res.appendChild(h('a', { href: unit.pdfs.yomimono, target: '_blank' }, ic('file'), 'PDF bài đọc', ic('external', 'muted')));
    if (unit.pdfs.shadowing) res.appendChild(h('a', { href: unit.pdfs.shadowing, target: '_blank' }, ic('file'), 'PDF shadowing', ic('external', 'muted')));
    res.appendChild(h('button', { onclick: showVocab }, ic('cards'), 'Từ vựng của bài', h('span', { class: 'tag' }, unit.vocab.length + ' từ')));
    side.appendChild(h('div', { class: 'card' }, h('h3', null, ic('layers'), 'Tư liệu'), res));


    function showGuides() {
      modal({ title: 'Ngữ điệu · Unit ' + unit.id, wide: true, body: (b) => {
        b.appendChild(h('p', { class: 'small muted', style: { marginTop: 0 } }, 'Gạch trên chữ = đọc cao · vạch dọc = chỗ hạ giọng (OJAD). Bấm ảnh để phóng to.'));
        unit.guides.forEach((g) => {
          b.appendChild(h('div', { class: 'glabel', lang: 'ja' }, speakers[g.speaker].name + (g.label ? ' · ' + g.label : '')));
          b.appendChild(h('div', { class: 'guide-grid' }, g.pages.map((src, i) => h('img', { src, alt: 'Trang ' + (i + 1), loading: 'lazy', onclick: () => lightbox(src, speakers[g.speaker].name + ' – trang ' + (i + 1)) }))));
        });
      } });
    }
    function showVocab() {
      modal({ title: 'Từ vựng · Unit ' + unit.id, body: h('div', { class: 'grid-2', style: { gap: '4px 16px' } }, unit.vocab.map((v) =>
        h('div', { class: 'row', style: { flexWrap: 'nowrap', gap: '6px', padding: '4px 0', borderBottom: '1px solid var(--line)' } }, speakBtn(v.kana), h('span', { lang: 'ja', style: { fontSize: '17px' }, html: esc(v.pre || '') + ruby(v.ruby) }), h('span', { class: 'small muted', style: { marginLeft: 'auto', textAlign: 'right' } }, v.vi)))) });
    }

    function applyUi() {
      body.classList.toggle('furi-hover', st.furi === 'hover');
      Array.from(segFuri.children).forEach((b, i) => b.classList.toggle('on', ['show', 'hover', 'hide'][i] === st.furi));
      body.querySelectorAll('rt').forEach((rt) => { rt.style.display = st.furi === 'hide' ? 'none' : ''; });
      body.querySelectorAll('.para-vi').forEach((x) => { x.hidden = !st.vi; });
      btnVi.classList.toggle('primary', st.vi);
      body.classList.toggle('only-shadow', st.onlySh);
      btnSh.classList.toggle('primary', st.onlySh);
    }
    function mark(k) {
      sentEls.forEach((e, j) => e && e.classList.toggle('active', j === k));
      viEls.forEach((e, j) => e && e.classList.toggle('active', j === k));
    }
    function closeDock() { cur = -1; mark(-1); dockFull.hidden = true; dockEmpty.hidden = false; dock.classList.remove('live'); }
    function select(k, speak) {
      cur = k;
      const s = sents[k];
      mark(k);
      dockEmpty.hidden = true; dockFull.hidden = false; dock.classList.add('live');
      dockJp.innerHTML = W.kanjiClickable(ruby(s.jp));
      dockVi.textContent = s.vi;
      dockPos.textContent = `Câu ${k + 1}/${sents.length}`;
      dockPos.title = speakers[s.speaker].name;
      dockTags.innerHTML = '';
      if (s.sh) dockTags.appendChild(h('span', { class: 'tag acc', title: 'Đoạn phải quay video shadowing nộp LMS' }, 'nộp'));
      dockTags.appendChild(TTS.hasClip(speechText(s.jp)) ? h('span', { class: 'tag', title: 'Giọng thật từ video bài đọc' }, ic('mic')) : h('span', { class: 'tag', title: 'Giọng máy (câu này không có trong video)' }, ic('volume')));
      sentEls[k].scrollIntoView({ block: 'center', behavior: 'smooth' });
      if (speak) speakCur();
    }
    function speakCur(rate) { if (cur >= 0) return TTS.speak(speechText(sents[cur].jp), rate ? { rate } : null); return Promise.resolve(); }
    dockJp.addEventListener('click', (e) => { const k = e.target.closest('.kj'); if (k) W.kanjiModal(k.dataset.k); });

    async function playAll(shadow) {
      const tok = ++token;
      btnStop.hidden = false; btnPlay.disabled = true; btnShadow.disabled = true;
      const list = sents.filter((s) => !st.onlySh || s.sh);
      if (shadow) toast('Nghe từng câu rồi nhại lại trong khoảng lặng', 3000);
      for (const s of list) {
        if (tok !== token) break;
        select(s.k, false);
        const t0 = performance.now();
        await TTS.speak(speechText(s.jp));
        if (tok !== token) break;
        const dur = performance.now() - t0;
        await new Promise((r) => setTimeout(r, shadow ? Math.max(1400, dur * 1.15) : 350));
      }
      if (tok === token) stopAll();
    }
    function stopAll() { token++; TTS.stop(); btnStop.hidden = true; btnPlay.disabled = false; btnShadow.disabled = false; }

    async function toggleRec() {
      if (recorder && recorder.state === 'recording') { recorder.stop(); return; }
      if (!navigator.mediaDevices || !window.MediaRecorder) { toast('Trình duyệt không hỗ trợ ghi âm.'); return; }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        recChunks = [];
        recorder = new MediaRecorder(stream);
        recorder.ondataavailable = (e) => recChunks.push(e.data);
        recorder.onstop = () => {
          stream.getTracks().forEach((t) => t.stop());
          if (recUrl) URL.revokeObjectURL(recUrl);
          recUrl = URL.createObjectURL(new Blob(recChunks, { type: recorder.mimeType }));
          recBtn.lastChild.textContent = 'Ghi lại'; recBtn.classList.remove('bad');
          playRec.hidden = false;
          new Audio(recUrl).play();
        };
        recorder.start();
        recBtn.lastChild.textContent = 'Đang ghi… dừng'; recBtn.classList.add('bad');
      } catch (e) { toast('Không truy cập được micro: ' + e.message, 4000); }
    }

    applyUi();
    const onKey = (e) => {
      if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
      if (e.key === 'ArrowRight' && cur < sents.length - 1) { e.preventDefault(); select(cur + 1, true); }
      else if (e.key === 'ArrowLeft' && cur > 0) { e.preventDefault(); select(cur - 1, true); }
      else if (e.key === ' ' && cur >= 0) { e.preventDefault(); speakCur(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { stopAll(); document.removeEventListener('keydown', onKey); if (recorder && recorder.state === 'recording') recorder.stop(); };
  }

  G.Pages.register('text', { title: 'Bài khóa', render });
})(window);
