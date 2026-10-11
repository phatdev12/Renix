/* app.js — router, floating navigation rail, top bar (title, search, unit filter, toggles), settings. */
(function (G) {
  'use strict';
  const { h, $, esc, ic, ruby, plain, Settings, Bus, D, TTS, toast, modal, uTag, ALL_UNITS } = G.U;
  const P = G.Pages;

  const NAV = [
    ['', 'home', 'Tổng quan', 'ホーム'],
    ['text', 'book', 'Bài khóa', 'ほんぶん'],
    ['vocab', 'cards', 'Từ vựng', 'ことば'],
    ['grammar', 'puzzle', 'Ngữ pháp', 'ぶんぽう'],
    ['kanji', 'kanji', 'Kanji', 'かんじ'],
    ['write', 'brush', 'Tập viết', 'かく'],
    ['conj', 'repeat', 'Động từ', 'どうし'],
    ['bank', 'clipboard', 'Đề luyện', 'ドリル'],
    ['exam', 'timer', 'Thi thử', 'しけん'],
    ['essay', 'edit', 'Viết luận', 'さくぶん'],
    ['progress', 'chart', 'Tiến độ', 'きろく'],
  ];

  let cleanup = null;
  let current = '';

  function parseHash() {
    const raw = decodeURIComponent((location.hash || '#/').slice(1));
    const [path, qs] = raw.split('?');
    const parts = path.split('/').filter(Boolean);
    const query = {};
    (qs || '').split('&').filter(Boolean).forEach((kv) => { const [k, v] = kv.split('='); query[k] = v == null ? '' : v; });
    return { page: parts[0] || '', args: parts.slice(1), query };
  }

  // The rail is built once; a route change only moves the active pill, so it can glide between items.
  function buildNav() {
    const nav = $('#nav');
    nav.innerHTML = '';
    nav.append(h('span', { class: 'nav-ind', 'aria-hidden': 'true' }), h('span', { class: 'nav-hov', 'aria-hidden': 'true' }));
    NAV.forEach(([key, icon, label, jp]) => nav.appendChild(h('a', { href: '#/' + key, 'aria-label': label, dataset: { k: key, label, jp } },
      h('span', { class: 'ni' }, ic(icon)), h('span', { class: 'nl' }, label), h('span', { class: 'nj', lang: 'ja' }, jp))));
    setupNavHover(nav);
  }
  const pillTo = (pill, a) => { pill.style.transform = `translateY(${a.offsetTop}px)`; pill.style.height = a.offsetHeight + 'px'; };
  function markNav() {
    const nav = $('#nav');
    let act = null;
    nav.querySelectorAll('a').forEach((a) => {
      const on = a.dataset.k === current;
      a.classList.toggle('active', on);
      if (on) { a.setAttribute('aria-current', 'page'); act = a; } else a.removeAttribute('aria-current');
    });
    const ind = nav.querySelector('.nav-ind');
    ind.classList.toggle('on', !!act);
    if (act) pillTo(ind, act);
    // enable the glide only after the first placement
    if (!nav.classList.contains('glide')) requestAnimationFrame(() => requestAnimationFrame(() => nav.classList.add('glide')));
  }
  // hover: a pill slides behind the icon and a glass label slides out beside it
  function setupNavHover(nav) {
    const tip = $('#nav-tip');
    const hov = nav.querySelector('.nav-hov');
    let cur = null, hideT = 0;
    const show = (a) => {
      clearTimeout(hideT);
      if (a === cur) return;
      cur = a;
      if (!hov.classList.contains('on')) { hov.classList.add('jump'); pillTo(hov, a); void hov.offsetWidth; hov.classList.remove('jump'); hov.classList.add('on'); } else pillTo(hov, a);
      const r = a.getBoundingClientRect();
      tip.replaceChildren(h('span', { class: 'tt' }, h('b', null, a.dataset.label), h('small', { lang: 'ja' }, a.dataset.jp)));
      if (!tip.classList.contains('show')) { tip.classList.add('jump'); tip.style.top = r.top + r.height / 2 + 'px'; void tip.offsetWidth; tip.classList.remove('jump'); tip.classList.add('show'); }
      else tip.style.top = r.top + r.height / 2 + 'px';
    };
    const hide = (now) => {
      clearTimeout(hideT);
      hideT = setTimeout(() => { cur = null; tip.classList.remove('show'); hov.classList.remove('on'); }, now ? 0 : 90);
    };
    nav.addEventListener('mouseover', (e) => { const a = e.target.closest('a'); if (a) show(a); });
    nav.addEventListener('mouseleave', () => hide());
    nav.addEventListener('focusin', (e) => { const a = e.target.closest('a'); if (a && a.matches(':focus-visible')) show(a); });
    nav.addEventListener('focusout', () => hide());
    nav.addEventListener('scroll', () => hide(true), { passive: true });
    window.addEventListener('resize', G.U.debounce(() => { hide(true); markNav(); }, 120));
  }

  // ------------------------------------------------------------------ top bar
  function setTitle(main, sub) {
    $('#tt-main').textContent = main || '';
    $('#tt-sub').textContent = sub || '';
  }

  function renderUnitFilter() {
    const sel = new Set(D.sel());
    const all = sel.size === ALL_UNITS.length;
    ['#unit-filter', '#unit-filter-m'].forEach((id) => {
      const box = $(id);
      box.innerHTML = '';
      box.appendChild(h('button', { class: 'all' + (all ? ' on' : ''), title: 'Ôn tất cả Unit', onclick: () => Settings.set('units', ALL_UNITS.slice()) }, 'Tất cả'));
      ALL_UNITS.forEach((u) => {
        box.appendChild(h('button', {
          class: sel.has(u) && !all ? 'on' : '', title: 'Unit ' + u + ' — ' + D.unit(u).titleVi,
          onclick: () => {
            let s = new Set(D.sel());
            if (all) s = new Set([u]);
            else if (s.has(u)) { s.delete(u); if (!s.size) s = new Set(ALL_UNITS); }
            else s.add(u);
            Settings.set('units', Array.from(s).sort());
          },
        }, String(u)));
      });
    });
  }

  function daysLeft() {
    const d = Settings.get('examDate');
    if (!d) return null;
    const t = new Date(d + 'T00:00:00');
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return Math.round((t - today) / 864e5);
  }
  function setExamDate() {
    modal({ title: 'Ngày thi giữa kỳ', body: (b, close) => {
      const inp = h('input', { type: 'date', class: 'input', value: Settings.get('examDate') || '', style: { width: '100%' } });
      b.append(inp,
        h('div', { class: 'row', style: { marginTop: '14px' } },
          G.U.B('primary', 'check', 'Lưu', () => { Settings.set('examDate', inp.value); close(); G.App.rerender(); toast('Đã lưu ngày thi'); }),
          G.U.B('ghost', 'trash', 'Xoá ngày', () => { Settings.set('examDate', ''); close(); G.App.rerender(); })));
      setTimeout(() => inp.focus(), 30);
    } });
  }
  function paintTheme() {
    const dark = Settings.get('theme') !== 'light';
    const b = $('#btn-theme');
    b.innerHTML = '';
    b.appendChild(ic(dark ? 'moon' : 'sun'));
    b.title = dark ? 'Giao diện tối · bấm để đổi sang sáng' : 'Giao diện sáng · bấm để đổi sang tối';
  }
  function applyFuri() {
    const on = Settings.get('furi') !== false;
    document.documentElement.classList.toggle('furi-off', !on);
    $('#btn-furi').classList.toggle('on', on);
    $('#btn-furi').title = on ? 'Furigana: bật' : 'Furigana: tắt';
  }

  function voiceDialog() {
    modal({ title: 'Giọng đọc', body: (b) => {
      const list = TTS.voices;
      const sel = h('select', { class: 'input', style: { width: '100%' } });
      if (!list.length) sel.appendChild(h('option', { value: '' }, '(Không có giọng tiếng Nhật)'));
      list.forEach((v) => sel.appendChild(h('option', { value: v.name, selected: TTS.voice && TTS.voice.name === v.name }, v.name)));
      sel.onchange = () => { Settings.set('voice', sel.value); TTS.pick(); TTS.speak('こんにちは。日本語の勉強をがんばりましょう。'); };
      const rate = h('input', { type: 'range', min: '0.5', max: '1.3', step: '0.05', value: String(Settings.get('rate')), style: { width: '100%', accentColor: 'var(--primary)' } });
      const rv = h('b', { class: 'num' }, Settings.get('rate') + '×');
      rate.oninput = () => { rv.textContent = rate.value + '×'; Settings.set('rate', parseFloat(rate.value)); };
      const cc = TTS.clipCount();
      const real = h('label', { class: 'check', style: { marginBottom: '6px' } }, h('input', { type: 'checkbox', checked: Settings.get('realVoice') !== false, onchange: (e) => Settings.set('realVoice', e.target.checked) }),
        h('span', null, h('b', null, 'Giọng thật'), ' từ video của lớp'));
      b.append(
        real, h('div', { class: 'small muted', style: { margin: '0 0 6px 24px' } }, `${cc.text} câu bài khóa · ${cc.vocab} từ vựng. Phần còn lại dùng giọng máy bên dưới.`),
        h('div', { class: 'glabel' }, 'Giọng máy'), sel,
        h('div', { class: 'glabel' }, 'Tốc độ giọng máy · ', rv), rate,
        h('div', { class: 'row', style: { marginTop: '16px' } }, G.U.B('primary', 'volume', 'Nghe thử', () => TTS.speak('わたしは、毎朝、七時半に起きます。')),
          h('span', { class: 'small muted' }, 'Hay nhất: Microsoft Nanami (Edge)')));
      if (!list.length) b.appendChild(h('p', { class: 'small muted', style: { marginTop: '12px' } }, 'Windows → Settings → Time & language → Language & region → thêm 日本語 và bật Text-to-speech.'));
    } });
  }

  // ------------------------------------------------------------------ search
  function buildIndex() {
    const idx = [];
    D.units.forEach((u) => {
      u.vocab.forEach((v) => idx.push({ t: 'Từ vựng', key: [v.kana, v.kanji, v.vi].join(' '), main: v.ruby, sub: v.vi, u: u.id, go: '#/vocab?focus=' + v.id }));
      u.kanji.forEach((k) => idx.push({ t: 'Kanji', key: [k.c, k.hv.map((x) => x.t).join(' '), k.meaning, k.on.map((x) => x.t).join(' '), k.kun.map((x) => x.t).join(' ')].join(' '), main: k.c, sub: k.hv.map((x) => x.t).join('/') + ' · ' + k.meaning, u: u.id, kanji: k.c }));
      u.grammar.forEach((g) => idx.push({ t: 'Ngữ pháp', key: [g.title, g.meaning, (g.formulas || []).join(' ')].join(' '), main: g.title, sub: g.meaning, u: u.id, go: '#/grammar/' + g.id }));
      u.sections.forEach((s) => s.paragraphs.forEach((p) => p.forEach((x) => idx.push({ t: 'Câu trong bài khóa', key: plain(x.jp) + ' ' + G.U.reading(x.jp) + ' ' + x.vi, main: x.jp, sub: x.vi, u: u.id, go: '#/text/' + u.id }))));
    });
    return idx;
  }
  let INDEX = null;
  const fold = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
  function search(q) {
    INDEX = INDEX || buildIndex();
    const qq = fold(q.trim());
    const hira = G.U.toHira(q.trim(), false);
    if (!qq) return [];
    const res = INDEX.filter((x) => { const k = fold(x.key); return k.includes(qq) || (hira !== q && k.includes(hira)); });
    const order = ['Kanji', 'Từ vựng', 'Ngữ pháp', 'Câu trong bài khóa'];
    res.sort((a, b) => order.indexOf(a.t) - order.indexOf(b.t));
    return res.slice(0, 40);
  }
  function setupSearch() {
    const inp = $('#search'), box = $('#search-results');
    let items = [], selIdx = -1;
    const close = () => { box.hidden = true; selIdx = -1; };
    const go = (x) => {
      close(); inp.blur(); document.body.classList.remove('search-open');
      if (x.kanji) { G.W.kanjiModal(x.kanji); return; }
      location.hash = x.go;
    };
    const render = () => {
      const q = inp.value;
      items = search(q);
      box.innerHTML = '';
      if (!q.trim()) { close(); return; }
      if (!items.length) { box.appendChild(h('div', { class: 'sr-group' }, 'Không có kết quả')); box.hidden = false; return; }
      let last = '';
      items.forEach((x, i) => {
        if (x.t !== last) { box.appendChild(h('div', { class: 'sr-group' }, x.t)); last = x.t; }
        box.appendChild(h('a', { class: 'sr-item' + (i === selIdx ? ' sel' : ''), href: x.go || 'javascript:void(0)', onclick: (e) => { e.preventDefault(); go(x); } },
          h('span', { class: 'sr-main', lang: 'ja', html: x.t === 'Ngữ pháp' ? esc(x.main) : ruby(x.main) }), h('span', { class: 'sr-sub' }, x.sub), uTag(x.u)));
      });
      box.hidden = false;
    };
    inp.addEventListener('input', G.U.debounce(render, 120));
    inp.addEventListener('focus', () => { if (inp.value.trim()) render(); });
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); selIdx = Math.max(0, Math.min(items.length - 1, selIdx + (e.key === 'ArrowDown' ? 1 : -1))); render(); }
      else if (e.key === 'Enter') { const x = items[selIdx >= 0 ? selIdx : 0]; if (x) go(x); }
      else if (e.key === 'Escape') { close(); inp.blur(); document.body.classList.remove('search-open'); }
    });
    document.addEventListener('click', (e) => { if (!e.target.closest('.search') && !e.target.closest('#btn-search')) { close(); document.body.classList.remove('search-open'); } });
    document.addEventListener('keydown', (e) => { if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); document.body.classList.add('search-open'); inp.focus(); } });
    $('#btn-search').onclick = () => { const open = document.body.classList.toggle('search-open'); if (open) setTimeout(() => inp.focus(), 20); };
  }

  // ------------------------------------------------------------------ routing
  function route() {
    const { page, args, query } = parseHash();
    const def = P.get(page) || P.get('');
    current = P.get(page) ? page : '';
    if (cleanup) { try { cleanup(); } catch (e) { console.error(e); } cleanup = null; }
    TTS.stop();
    const main = $('#main');
    main.innerHTML = '';
    document.body.classList.remove('nav-open', 'search-open');
    markNav();
    const nav = NAV.find((n) => n[0] === current) || NAV[0];
    setTitle(nav[2], nav[3]);
    try {
      const r = def.render(main, args, query);
      if (typeof r === 'function') cleanup = r;
    } catch (e) {
      console.error(e);
      main.appendChild(h('div', { class: 'note warn' }, 'Có lỗi khi hiển thị trang: ' + e.message));
    }
    document.title = (def.title ? def.title + ' · ' : '') + 'Renix';
    window.scrollTo(0, 0);
  }

  G.App = { rerender: () => route(), title: setTitle, daysLeft, setExamDate };

  function boot() {
    if (!G.NIX || !G.NIX.units) { document.body.innerHTML = '<p style="padding:20px">Không tải được dữ liệu (data/units.js).</p>'; return; }
    if (Settings.get('theme') !== 'light' && Settings.get('theme') !== 'dark') Settings.set('theme', 'dark');
    TTS.init();
    buildNav();
    $('#btn-menu').appendChild(ic('menu'));
    $('#btn-search').appendChild(ic('search'));
    $('#btn-voice').appendChild(ic('volume'));
    renderUnitFilter();
    paintTheme();
    applyFuri();
    setupSearch();
    $('#btn-theme').onclick = () => {
      const t = Settings.get('theme') === 'light' ? 'dark' : 'light';
      Settings.set('theme', t);
      document.documentElement.setAttribute('data-theme', t);
      paintTheme();
    };
    $('#btn-furi').onclick = () => { Settings.set('furi', !(Settings.get('furi') !== false)); applyFuri(); };
    $('#btn-voice').onclick = voiceDialog;
    $('#btn-menu').onclick = () => document.body.classList.toggle('nav-open');
    $('#scrim').onclick = () => document.body.classList.remove('nav-open');
    Bus.on('settings', ({ key }) => {
      if (key === 'units') { renderUnitFilter(); route(); }
    });
    window.addEventListener('hashchange', route);
    route();
  }

  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', boot) : boot();
})(window);
