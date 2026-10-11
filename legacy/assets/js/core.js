/* core.js — shared helpers: DOM, ruby, storage, settings, data access, TTS,
   romaji→kana, answer normalisation, SRS, progress, toast/modal. */
(function (G) {
  'use strict';

  // ------------------------------------------------------------------ DOM
  function append(el, kids) {
    for (const k of kids.flat(Infinity)) {
      if (k == null || k === false || k === '') continue;
      el.appendChild(k instanceof Node ? k : document.createTextNode(String(k)));
    }
    return el;
  }
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        const v = attrs[k];
        if (v == null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'style' && typeof v === 'object') {
          for (const p in v) { if (p.slice(0, 2) === '--') el.style.setProperty(p, v[p]); else el.style[p] = v[p]; }
        }
        else if (k === 'html') el.innerHTML = v;
        else if (k === 'text') el.textContent = v;
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else if (k === 'dataset') Object.assign(el.dataset, v);
        else if (v === true) el.setAttribute(k, '');
        else el.setAttribute(k, v);
      }
    }
    return append(el, kids);
  }
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ic = (name, cls) => (G.I ? G.I(name, cls) : null);
  // <button class="btn …"> with an optional leading icon
  const B = (cls, icon, label, onclick, extra) => h('button', Object.assign({ class: 'btn ' + (cls || ''), type: 'button', onclick }, extra || {}), icon ? ic(icon) : null, label);
  // same look, as a link
  const A = (cls, icon, label, href, extra) => h('a', Object.assign({ class: 'btn ' + (cls || ''), href }, extra || {}), icon ? ic(icon) : null, label);

  // ------------------------------------------------------------------ ruby  {漢字|かんじ}
  const RUBY_RE = /\{([^|{}]+)\|([^{}]+)\}/g;
  const ruby = (s) => esc(s).replace(RUBY_RE, '<ruby>$1<rt>$2</rt></ruby>');
  const plain = (s) => String(s || '').replace(RUBY_RE, '$1');
  const reading = (s) => String(s || '').replace(RUBY_RE, '$2');
  // text for speech: keep kanji (natural prosody) but read number+counter groups as kana
  const speechText = (s) => String(s || '').replace(RUBY_RE, (m, b, r) => (/[0-9０-９]/.test(b) ? r : b)).replace(/[➡→]/g, '、');
  const rubyNode = (s, cls, tag) => h(tag || 'span', { class: cls || '', lang: 'ja', html: ruby(s) });

  // ------------------------------------------------------------------ storage
  const PFX = 'nix.';
  const Store = {
    get(k, d) {
      try { const v = localStorage.getItem(PFX + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; }
    },
    set(k, v) {
      try { localStorage.setItem(PFX + k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ }
    },
    update(k, fn, d) { const v = fn(Store.get(k, d)); Store.set(k, v); return v; },
    remove(k) { try { localStorage.removeItem(PFX + k); } catch (e) { /* ignore */ } },
    dump() {
      const out = {};
      try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.indexOf(PFX) === 0) out[k] = localStorage.getItem(k); } } catch (e) { /* ignore */ }
      return out;
    },
  };

  // ------------------------------------------------------------------ event bus
  const Bus = {
    h: {},
    on(ev, fn) { (this.h[ev] = this.h[ev] || []).push(fn); return () => { this.h[ev] = this.h[ev].filter((f) => f !== fn); }; },
    emit(ev, data) { (this.h[ev] || []).slice().forEach((f) => { try { f(data); } catch (e) { console.error(e); } }); },
  };

  // ------------------------------------------------------------------ settings
  const ALL_UNITS = (G.NIX ? G.NIX.units : []).map((u) => u.id);
  const DEF = { units: ALL_UNITS.slice(), furi: true, theme: 'dark', rate: 0.9, voice: '', examDate: '', realVoice: true };
  const Settings = {
    all() { return Object.assign({}, DEF, Store.get('settings', {})); },
    get(k) { return this.all()[k]; },
    set(k, v) {
      const s = this.all(); s[k] = v; Store.set('settings', s);
      Bus.emit('settings', { key: k, value: v });
    },
  };

  // ------------------------------------------------------------------ data access
  const NIX = G.NIX || { units: [] };
  const byId = {};
  NIX.units.forEach((u) => { byId[u.id] = u; });
  const D = {
    units: NIX.units,
    unit: (id) => byId[id],
    sel() {
      const s = (Settings.get('units') || []).filter((u) => byId[u]);
      return (s.length ? s : ALL_UNITS).slice().sort((a, b) => a - b);
    },
    vocab(units) {
      const out = [];
      (units || D.sel()).forEach((u) => byId[u].vocab.forEach((v) => out.push(Object.assign({ u }, v))));
      return out;
    },
    kanji(units) {
      const out = [];
      (units || D.sel()).forEach((u) => byId[u].kanji.forEach((k) => out.push(Object.assign({ u }, k))));
      return out;
    },
    grammar(units) {
      const out = [];
      (units || D.sel()).forEach((u) => byId[u].grammar.forEach((g) => out.push(Object.assign({ u }, g))));
      return out;
    },
    bank(units) { const set = new Set(units || D.sel()); return (G.BANK || []).filter((q) => set.has(q.unit)); },
    quiz(id) { return (G.BANK || []).find((q) => q.id === String(id)); },
    kanjiInfo(c) {
      for (const u of NIX.units) { const k = u.kanji.find((x) => x.c === c); if (k) return Object.assign({ u: u.id }, k); }
      return null;
    },
    vocabById(id) { const u = byId[id.split('-')[0]]; return u ? Object.assign({ u: u.id }, u.vocab.find((v) => v.id === id)) : null; },
    sentences(units) {
      const out = [];
      (units || D.sel()).forEach((u) => byId[u].sections.forEach((sec, si) => sec.paragraphs.forEach((p, pi) => p.forEach((s, i) => out.push(Object.assign({ u, si, pi, i, speaker: sec.speaker }, s))))));
      return out;
    },
  };
  const uColor = (u) => `var(--u${u})`;
  const uTag = (u) => h('span', { class: 'tag u' + u }, 'U' + u);

  // ------------------------------------------------------------------ misc
  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const sample = (a, n) => shuffle(a).slice(0, n);
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const uniq = (a) => Array.from(new Set(a));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
  const fmtDate = (ts) => { const d = new Date(ts); return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' + d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }); };
  const fmtTime = (s) => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

  // ------------------------------------------------------------------ kana tools
  const R2K = {
    a: 'あ', i: 'い', u: 'う', e: 'え', o: 'お',
    ka: 'か', ki: 'き', ku: 'く', ke: 'け', ko: 'こ', ga: 'が', gi: 'ぎ', gu: 'ぐ', ge: 'げ', go: 'ご',
    sa: 'さ', si: 'し', shi: 'し', su: 'す', se: 'せ', so: 'そ', za: 'ざ', zi: 'じ', ji: 'じ', zu: 'ず', ze: 'ぜ', zo: 'ぞ',
    ta: 'た', ti: 'ち', chi: 'ち', tu: 'つ', tsu: 'つ', te: 'て', to: 'と', da: 'だ', di: 'ぢ', du: 'づ', de: 'で', do: 'ど',
    na: 'な', ni: 'に', nu: 'ぬ', ne: 'ね', no: 'の', ha: 'は', hi: 'ひ', hu: 'ふ', fu: 'ふ', he: 'へ', ho: 'ほ',
    ba: 'ば', bi: 'び', bu: 'ぶ', be: 'べ', bo: 'ぼ', pa: 'ぱ', pi: 'ぴ', pu: 'ぷ', pe: 'ぺ', po: 'ぽ',
    ma: 'ま', mi: 'み', mu: 'む', me: 'め', mo: 'も', ya: 'や', yu: 'ゆ', yo: 'よ',
    ra: 'ら', ri: 'り', ru: 'る', re: 'れ', ro: 'ろ', wa: 'わ', wo: 'を', wi: 'うぃ', we: 'うぇ',
    kya: 'きゃ', kyu: 'きゅ', kyo: 'きょ', gya: 'ぎゃ', gyu: 'ぎゅ', gyo: 'ぎょ',
    sha: 'しゃ', shu: 'しゅ', sho: 'しょ', she: 'しぇ', sya: 'しゃ', syu: 'しゅ', syo: 'しょ',
    ja: 'じゃ', ju: 'じゅ', jo: 'じょ', je: 'じぇ', jya: 'じゃ', jyu: 'じゅ', jyo: 'じょ', zya: 'じゃ', zyu: 'じゅ', zyo: 'じょ',
    cha: 'ちゃ', chu: 'ちゅ', cho: 'ちょ', che: 'ちぇ', tya: 'ちゃ', tyu: 'ちゅ', tyo: 'ちょ', cya: 'ちゃ', cyu: 'ちゅ', cyo: 'ちょ',
    dya: 'ぢゃ', dyu: 'ぢゅ', dyo: 'ぢょ', nya: 'にゃ', nyu: 'にゅ', nyo: 'にょ', hya: 'ひゃ', hyu: 'ひゅ', hyo: 'ひょ',
    bya: 'びゃ', byu: 'びゅ', byo: 'びょ', pya: 'ぴゃ', pyu: 'ぴゅ', pyo: 'ぴょ', mya: 'みゃ', myu: 'みゅ', myo: 'みょ',
    rya: 'りゃ', ryu: 'りゅ', ryo: 'りょ', fa: 'ふぁ', fi: 'ふぃ', fe: 'ふぇ', fo: 'ふぉ', thi: 'てぃ', dhi: 'でぃ', tsa: 'つぁ',
    va: 'ゔぁ', vi: 'ゔぃ', vu: 'ゔ', ve: 'ゔぇ', vo: 'ゔぉ',
    xa: 'ぁ', xi: 'ぃ', xu: 'ぅ', xe: 'ぇ', xo: 'ぉ', la: 'ぁ', li: 'ぃ', lu: 'ぅ', le: 'ぇ', lo: 'ぉ',
    xya: 'ゃ', xyu: 'ゅ', xyo: 'ょ', lya: 'ゃ', lyu: 'ゅ', lyo: 'ょ', xtu: 'っ', ltu: 'っ', xtsu: 'っ', xwa: 'ゎ',
  };
  const PREFIXES = new Set();
  Object.keys(R2K).forEach((k) => { for (let i = 1; i < k.length; i++) PREFIXES.add(k.slice(0, i)); });
  const PUNCT = { ',': '、', '.': '。', '-': 'ー', '?': '？', '!': '！', '[': '「', ']': '」', '~': '〜' };
  // live=true keeps an unfinished tail (e.g. "n", "ky") unconverted
  function toHira(src, live) {
    const s = String(src);
    let out = '', i = 0;
    while (i < s.length) {
      const c = s[i].toLowerCase();
      if (!/[a-z]/.test(c)) { out += PUNCT[c] || s[i]; i++; continue; }
      const n1 = (s[i + 1] || '').toLowerCase();
      if (c === 'n') {
        if (n1 === 'n') { out += 'ん'; i += 2; continue; }
        if (n1 === "'") { out += 'ん'; i += 2; continue; }
        if (!n1) { if (live) { out += s[i]; i++; continue; } out += 'ん'; i++; continue; }
        if (!/[aiueoy]/.test(n1)) { out += 'ん'; i++; continue; }
      }
      if (c === n1 && /[bcdfghjkmpqrstvwxz]/.test(c)) { out += 'っ'; i++; continue; }
      let hit = false;
      for (let L = 4; L >= 1; L--) {
        const chunk = s.slice(i, i + L).toLowerCase();
        if (chunk.length === L && R2K[chunk]) { out += R2K[chunk]; i += L; hit = true; break; }
      }
      if (hit) continue;
      const rest = s.slice(i).toLowerCase();
      if (live && PREFIXES.has(rest)) { out += s.slice(i); break; }
      out += s[i]; i++;
    }
    return out;
  }
  const kataToHira = (s) => String(s || '').replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
  const hiraToKata = (s) => String(s || '').replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));
  // attach romaji→hiragana live conversion to an <input>/<textarea>
  function kanaInput(el) {
    el.setAttribute('lang', 'ja');
    el.setAttribute('autocomplete', 'off');
    el.setAttribute('autocapitalize', 'off');
    el.setAttribute('spellcheck', 'false');
    let composing = false;
    el.addEventListener('compositionstart', () => { composing = true; });
    el.addEventListener('compositionend', () => { composing = false; });
    el.addEventListener('input', () => {
      if (composing || el.dataset.raw === '1') return;
      const v = el.value;
      if (!/[a-zA-Z]/.test(v)) return;
      const atEnd = el.selectionStart === v.length;
      const conv = toHira(v, true);
      if (conv !== v) { el.value = conv; if (atEnd) el.setSelectionRange(conv.length, conv.length); }
    });
    el.addEventListener('blur', () => { if (/[a-zA-Z]/.test(el.value) && el.dataset.raw !== '1') el.value = toHira(el.value, false); });
    return el;
  }
  // normalisation for comparing typed answers
  function normAns(s, loose) {
    let t = String(s == null ? '' : s).normalize('NFKC');
    t = t.replace(/[\s　]+/g, '');
    if (loose) {
      t = t.replace(/[。、．，,.!！?？「」『』・〜～ー\-]/g, '');
      t = kataToHira(t).toLowerCase();
    }
    return t;
  }
  function sameAns(input, expected, loose) {
    const list = Array.isArray(expected) ? expected : [expected];
    const a = normAns(input, loose);
    return list.some((e) => e != null && normAns(e, loose) === a && a !== '');
  }

  // ------------------------------------------------------------------ real voice clips
  // Sentences of the master texts and vocabulary words have recordings cut from the
  // class videos (data/voice.js). Lookup is by normalised text, so any call that speaks
  // one of those exact texts (text page, vocab, grammar examples quoted from the text…)
  // gets the human voice; everything else falls back to speech synthesis.
  const vnorm = (s) => kataToHira(String(s || '').normalize('NFKC')).replace(/[\s、。，．,.!！?？「」『』（）()…・〜～]/g, '');
  let VMAP = null;
  function voiceMap() {
    if (VMAP) return VMAP;
    VMAP = {};
    const V = G.VOICE;
    if (!V || !G.NIX) return VMAP;
    G.NIX.units.forEach((u) => {
      const t = (V.text || {})[u.id] || {};
      let k = 0;
      u.sections.forEach((sec) => sec.paragraphs.forEach((p) => p.forEach((s) => {
        const f = t[k]; k++;
        if (!f) return;
        VMAP[vnorm(speechText(s.jp))] = f;
        VMAP[vnorm(plain(s.jp))] = f;
      })));
      u.vocab.forEach((v) => {
        const f = (V.vocab || {})[v.id];
        if (!f) return;
        VMAP[vnorm(v.kana.replace(/[～〜]/g, ''))] = f;
        if (v.kanji) VMAP[vnorm(v.kanji.replace(/[～〜]/g, ''))] = f;
      });
    });
    return VMAP;
  }
  const clipFor = (text) => (Settings.get('realVoice') === false ? null : voiceMap()[vnorm(text)] || null);

  // ------------------------------------------------------------------ TTS
  const TTS = {
    ok: 'speechSynthesis' in G,
    voices: [], voice: null, warned: false, cur: null, audio: null,
    clipFor,
    hasClip: (text) => !!clipFor(text),
    clipCount() { const V = G.VOICE || {}; return { text: Object.values(V.text || {}).reduce((s, x) => s + Object.keys(x).length, 0), vocab: Object.keys(V.vocab || {}).length }; },
    // play a recorded clip; resolves when it ends (or fails -> falls back to synthesis)
    playClip(url, text, opts) {
      return new Promise((resolve) => {
        this.stop();
        const a = this.audio || (this.audio = new Audio());
        a.preload = 'auto';
        let done = false;
        const fin = () => { if (!done) { done = true; a.onended = a.onerror = null; resolve(); } };
        a.onended = fin;
        a.onerror = () => { if (done) return; done = true; a.onended = a.onerror = null; this.synth(text, opts).then(resolve); };
        a.src = url;
        // recordings play at natural speed unless the reader picked a speed on the text page
        a.playbackRate = (opts && opts.rate) || Settings.get('clipRate') || 1;
        try { a.preservesPitch = true; } catch (e) { /* older engines */ }
        const pr = a.play();
        if (pr && pr.catch) pr.catch(() => a.onerror && a.onerror());
      });
    },
    init() {
      if (!this.ok) return;
      const load = () => {
        this.voices = speechSynthesis.getVoices().filter((v) => /^ja/i.test(v.lang));
        this.pick();
        Bus.emit('voices', this.voices);
      };
      load();
      try { speechSynthesis.addEventListener('voiceschanged', load); } catch (e) { speechSynthesis.onvoiceschanged = load; }
    },
    pick() {
      const pref = Settings.get('voice');
      const order = [/Nanami/i, /Google/i, /Keita/i, /Haruka/i, /Ayumi/i, /Kyoko/i, /Otoya/i, /Ichiro/i, /Sayaka/i];
      this.voice = this.voices.find((v) => v.name === pref) || null;
      if (!this.voice) for (const re of order) { this.voice = this.voices.find((v) => re.test(v.name)); if (this.voice) break; }
      if (!this.voice) this.voice = this.voices[0] || null;
    },
    speak(text, opts) {
      const clip = clipFor(text);
      if (clip) return this.playClip(clip, text, opts || {});
      return this.synth(text, opts);
    },
    synth(text, opts) {
      opts = opts || {};
      return new Promise((resolve) => {
        if (!this.ok) { this.warn(); resolve(); return; }
        if (!this.voices.length) { this.voices = speechSynthesis.getVoices().filter((v) => /^ja/i.test(v.lang)); this.pick(); }
        if (!this.voice && !this.warned) this.warn();
        this.stopClip();
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(String(text));
        u.lang = 'ja-JP';
        if (this.voice) u.voice = this.voice;
        u.rate = opts.rate || Settings.get('rate') || 0.9;
        let done = false;
        const fin = () => { if (!done) { done = true; resolve(); } };
        u.onend = fin; u.onerror = fin;
        this.cur = u;
        speechSynthesis.speak(u);
        // safety net: some engines never fire onend
        setTimeout(fin, 1500 + String(text).length * 450 / (u.rate || 1));
      });
    },
    stopClip() { if (this.audio) { const a = this.audio; a.pause(); if (a.onended) a.onended(); } },
    stop() { this.stopClip(); if (this.ok) speechSynthesis.cancel(); },
    warn() {
      this.warned = true;
      toast('Máy chưa có giọng đọc tiếng Nhật — hãy mở bằng Microsoft Edge.', 5000);
    },
  };
  // a small speaker button
  const speakBtn = (text, title) => h('button', {
    class: 'speak', title: title || 'Nghe', type: 'button', 'aria-label': title || 'Nghe',
    onclick: (e) => { e.stopPropagation(); TTS.speak(text); },
  }, ic('volume'));

  // ------------------------------------------------------------------ SRS (Leitner boxes)
  const DAY = 864e5;
  const INTERVALS = [0, 0.4 * DAY, 1 * DAY, 3 * DAY, 7 * DAY, 16 * DAY];
  const SRS = {
    all() { return Store.get('srs', {}); },
    get(id) { return this.all()[id] || null; },
    box(id) { const r = this.get(id); return r ? r.b : 0; },
    grade(id, good) {
      return Store.update('srs', (all) => {
        const r = all[id] || { b: 0, ok: 0, ng: 0 };
        if (good) { r.b = Math.min(5, (r.b || 0) + 1); r.ok = (r.ok || 0) + 1; }
        else { r.b = 1; r.ng = (r.ng || 0) + 1; }
        r.due = Date.now() + (good ? INTERVALS[r.b] : 5 * 60 * 1000);
        r.seen = Date.now();
        all[id] = r;
        return all;
      }, {})[id];
    },
    isDue(id) { const r = this.get(id); return !!r && r.due <= Date.now(); },
    dueList(ids) { const all = this.all(), now = Date.now(); return ids.filter((id) => all[id] && all[id].due <= now); },
    newList(ids) { const all = this.all(); return ids.filter((id) => !all[id]); },
    learned(ids) { const all = this.all(); return ids.filter((id) => all[id] && all[id].b >= 3).length; },
  };

  // ------------------------------------------------------------------ starred items
  const Star = {
    all() { return Store.get('star', {}); },
    has(id) { return !!this.all()[id]; },
    toggle(id) { return !!Store.update('star', (s) => { if (s[id]) delete s[id]; else s[id] = Date.now(); return s; }, {})[id]; },
  };

  // ------------------------------------------------------------------ progress records
  const Prog = {
    kanji(c) { return Store.get('kanji', {})[c] || null; },
    saveKanji(c, mistakes) {
      Store.update('kanji', (all) => {
        const r = all[c] || { n: 0, best: null };
        r.n += 1; r.last = Date.now(); r.lastMis = mistakes;
        r.best = r.best == null ? mistakes : Math.min(r.best, mistakes);
        all[c] = r; return all;
      }, {});
    },
    kanjiLevel(c) { const r = Prog.kanji(c); if (!r) return 0; return r.best === 0 ? 2 : 1; },
    quiz(id) { return Store.get('bank', {})[id] || null; },
    saveQuiz(id, ok, total) {
      Store.update('bank', (all) => {
        const r = all[id] || { n: 0, best: 0 };
        const p = pct(ok, total);
        r.n += 1; r.last = Date.now(); r.lastPct = p; r.best = Math.max(r.best, p);
        all[id] = r; return all;
      }, {});
    },
    addExam(rec) { Store.update('exam', (a) => { a.push(rec); return a.slice(-50); }, []); },
    exams() { return Store.get('exam', []); },
    conj(form, ok) {
      Store.update('conj', (c) => {
        c.n = (c.n || 0) + 1; c.ok = (c.ok || 0) + (ok ? 1 : 0);
        c.f = c.f || {}; const f = c.f[form] || { n: 0, ok: 0 }; f.n++; if (ok) f.ok++; c.f[form] = f;
        return c;
      }, {});
    },
    tally(kind, ok) { Store.update('tally', (t) => { const r = t[kind] || { n: 0, ok: 0 }; r.n++; if (ok) r.ok++; t[kind] = r; return t; }, {}); },
  };

  // ------------------------------------------------------------------ toast / modal / lightbox
  function toast(msg, ms) {
    const root = document.getElementById('toast-root');
    if (!root) return;
    const t = h('div', { class: 'toast' }, msg);
    root.appendChild(t);
    setTimeout(() => { t.style.transition = 'opacity .3s'; t.style.opacity = '0'; setTimeout(() => t.remove(), 320); }, ms || 2200);
  }
  function modal(opts) {
    const root = document.getElementById('overlay-root');
    const body = h('div', { class: 'modal-body' });
    const box = h('div', { class: 'modal' + (opts.wide ? ' wide' : '') + (opts.cls ? ' ' + opts.cls : ''), role: 'dialog', 'aria-modal': 'true' },
      h('div', { class: 'modal-head' }, h('h3', { html: opts.titleHtml || esc(opts.title || '') }), h('span', { class: 'spacer' }),
        h('button', { class: 'icon-btn sm', 'aria-label': 'Đóng', onclick: () => close() }, ic('x'))),
      body);
    const ov = h('div', { class: 'overlay', onclick: (e) => { if (e.target === ov) close(); } }, box);
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    function close() { document.removeEventListener('keydown', onKey); ov.remove(); TTS.stop(); if (opts.onClose) opts.onClose(); }
    document.addEventListener('keydown', onKey);
    if (typeof opts.body === 'function') opts.body(body, close); else if (opts.body) append(body, [opts.body]);
    root.appendChild(ov);
    return { close, body, box };
  }
  function lightbox(src, title) {
    modal({ title: title || 'Xem ảnh', wide: true, cls: 'lightbox', body: h('img', { src, alt: title || '' }) });
  }

  // ------------------------------------------------------------------ page registry
  G.Pages = {
    map: {},
    register(name, def) { this.map[name] = def; },
    get(name) { return Object.prototype.hasOwnProperty.call(this.map, name) ? this.map[name] : null; },
  };

  // ------------------------------------------------------------------ export
  G.U = {
    h, append, $, $$, esc, ic, B, A, ruby, plain, reading, speechText, rubyNode,
    Store, Bus, Settings, D, uColor, uTag,
    shuffle, sample, pick, uniq, clamp, debounce, pct, fmtDate, fmtTime,
    toHira, kataToHira, hiraToKata, kanaInput, normAns, sameAns,
    TTS, speakBtn, SRS, Star, Prog, toast, modal, lightbox, ALL_UNITS,
  };
})(window);
