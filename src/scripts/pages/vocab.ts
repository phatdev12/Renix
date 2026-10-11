/* Từ vựng — list, flashcards (SRS), quiz, matching game */
import { D } from '../../lib/data';
import { A, B, esc, h, ic } from '../../lib/dom';
import { iconSvg } from '../../lib/icons';
import { definePage } from '../../lib/page';
import type { Query } from '../../lib/page';
import { Prog, SRS, Star } from '../../lib/progress';
import { go, href } from '../../lib/routes';
import { Store } from '../../lib/store';
import { plain, ruby, toHira } from '../../lib/text';
import { TTS, speakBtn } from '../../lib/tts';
import type { Vocab, WithUnit } from '../../lib/types';
import { debounce, fmtTime, sample, shuffle } from '../../lib/util';
import * as W from '../../lib/widgets';
import { uTag } from '../../lib/widgets';

type V = WithUnit<Vocab>;

const say = (v: Vocab) => v.kana.replace(/[～〜]/g, '');        // text for speech
const wordHtml = (v: Vocab) => (v.pre ? `<span class="muted">${esc(v.pre)}</span>` : '') + ruby(v.ruby) + (v.note ? `<span class="muted small">${esc(v.note)}</span>` : '');
const boxes = (id: string) => { const b = SRS.box(id); return h('span', { class: 'boxes', title: 'Mức ghi nhớ ' + b + '/5' }, [1, 2, 3, 4, 5].map((i) => h('i', { class: i <= b ? 'f' : '' }))); };

// a sentence of the master text that contains the word (for context)
function contextSentence(v: V) {
  const stem = (s: string) => s.replace(/[～〜]/g, '').replace(/（.*?）|\(.*?\)/g, '').replace(/(します|ます|な|をします)$/, '');
  const keys = [v.kanji && stem(v.kanji), stem(v.kana)].filter((k) => k && k.length >= 2);
  if (!keys.length) return null;
  const sents = D.sentences([v.u]);
  return sents.find((s) => keys.some((k) => plain(s.jp).includes(k))) || null;
}

function header(main: HTMLElement, mode: string, count: number) {
  const seg = h('div', { class: 'seg' });
  [['', 'list', 'Danh sách'], ['flash', 'cards', 'Flashcard'], ['quiz', 'target', 'Trắc nghiệm'], ['match', 'grid', 'Ghép cặp']].forEach(([k, icon, t]) =>
    seg.appendChild(h('button', { class: mode === k ? 'on' : '', onclick: () => { if (k !== mode) go(href('vocab', k)); } }, ic(icon), t)));
  main.appendChild(W.pageHead('Từ vựng', 'ことば', [seg], count + ' từ'));
}
const segBtns = (seg: HTMLElement, keys: string[], k: string) => Array.from(seg.children).forEach((b, i) => b.classList.toggle('on', keys[i] === k));

// ------------------------------------------------------------------ list
function renderList(main: HTMLElement, query: Query) {
  const all = D.vocab();
  const st: { view: string; filter: string; q: string } = Object.assign({ view: 'cards', filter: 'all', q: '' }, Store.get('vocabUi', {}));
  const save = () => Store.set('vocabUi', { view: st.view, filter: st.filter });
  const q = h('input', { class: 'input', type: 'search', placeholder: 'Lọc: kana, kanji, nghĩa…' }) as HTMLInputElement;
  const fSeg = h('div', { class: 'seg' });
  const FK = ['all', 'star', 'weak'];
  ([['all', null, 'Tất cả'], ['star', 'star', 'Đánh dấu'], ['weak', null, 'Chưa thuộc']] as [string, string | null, string][]).forEach(([k, icon, t]) => fSeg.appendChild(h('button', { class: st.filter === k ? 'on' : '', onclick: () => { st.filter = k; save(); paint(); segBtns(fSeg, FK, k); } }, icon ? ic(icon) : null, t)));
  const vSeg = h('div', { class: 'seg' });
  const VK = ['cards', 'table'];
  [['cards', 'grid', 'Thẻ'], ['table', 'list', 'Bảng']].forEach(([k, icon, t]) => vSeg.appendChild(h('button', { class: st.view === k ? 'on' : '', title: t, onclick: () => { st.view = k; save(); paint(); segBtns(vSeg, VK, k); } }, ic(icon))));
  main.appendChild(h('div', { class: 'filters' }, q, fSeg, vSeg));
  const out = h('div');
  main.appendChild(out);
  q.addEventListener('input', debounce(paint, 120));

  function matches(v: V) {
    const s = q.value.trim().toLowerCase();
    if (st.filter === 'star' && !Star.has(v.id)) return false;
    if (st.filter === 'weak' && SRS.box(v.id) >= 3) return false;
    if (!s) return true;
    const hs = toHira(s, false);
    return [v.kana, v.kanji, v.vi.toLowerCase()].some((x) => x && (x.includes(s) || x.includes(hs)));
  }
  function starBtn(v: V) {
    const star: HTMLElement = h('button', { class: 'star' + (Star.has(v.id) ? ' on' : ''), title: 'Đánh dấu từ khó', onclick: () => star.classList.toggle('on', Star.toggle(v.id)) }, ic('star'));
    return star;
  }
  function card(v: V) {
    return h('div', { class: 'card vcard', id: 'v-' + v.id },
      h('div', { class: 'vw', lang: 'ja', html: wordHtml(v) }),
      v.kanji ? h('div', { class: 'vk', lang: 'ja' }, v.kana) : null,
      h('div', { class: 'vm' }, v.vi),
      h('div', { class: 'vf' }, uTag(v.u), boxes(v.id), h('span', { class: 'spacer' }), speakBtn(say(v)), starBtn(v)));
  }
  function paint() {
    out.innerHTML = '';
    let shown = 0;
    D.sel().forEach((u) => {
      const unit = D.unit(u);
      const list = all.filter((v) => v.u === u && matches(v));
      if (!list.length) return;
      shown += list.length;
      out.appendChild(h('div', { class: 'section-title' }, h('h2', null, 'Unit ' + u), h('span', { class: 'jp-sub', lang: 'ja', html: ruby(unit.title) }), h('span', { class: 'small muted num' }, list.length + ' từ'), h('div', { class: 'line' }),
        unit.videos.vocab ? B('sm', 'video', 'Video', () => W.videoModal(unit.videos.vocab, 'Video từ vựng · Unit ' + u)) : null));
      if (st.view === 'table') {
        const t = h('table', { class: 'vtable' }, h('tr', null, h('th', null, '#'), h('th', null, 'Từ'), h('th', null, 'Hiragana'), h('th', null, 'Nghĩa'), h('th', null, 'Nhớ'), h('th', null, '')));
        list.forEach((v, i) => t.appendChild(h('tr', { id: 'v-' + v.id }, h('td', { class: 'muted num' }, i + 1), h('td', { class: 'jp', lang: 'ja', html: wordHtml(v) }),
          h('td', { lang: 'ja' }, v.kana), h('td', null, v.vi), h('td', null, boxes(v.id)), h('td', null, h('span', { class: 'row', style: { gap: '2px', flexWrap: 'nowrap' } }, speakBtn(say(v)), starBtn(v))))));
        out.appendChild(h('div', { class: 'table-wrap' }, t));
      } else {
        out.appendChild(h('div', { class: 'grid-auto' }, list.map(card)));
      }
    });
    if (!shown) out.appendChild(h('div', { class: 'empty' }, h('div', { class: 'big' }, ic('search')), 'Không có từ phù hợp'));
  }
  paint();
  if (query.focus) {
    setTimeout(() => { const el = document.getElementById('v-' + query.focus); if (el) { el.scrollIntoView({ block: 'center' }); el.style.outline = '2px solid var(--accent)'; el.style.outlineOffset = '2px'; setTimeout(() => { el.style.outline = ''; }, 2500); } }, 50);
  }
}

// ------------------------------------------------------------------ flashcards
function renderFlash(main: HTMLElement) {
  const all = D.vocab();
  const st: { deck: string; dir: string; auto: boolean } = Object.assign({ deck: 'srs', dir: 'jv', auto: true }, Store.get('flashUi', {}));
  const save = () => Store.set('flashUi', st);
  const ids = all.map((v) => v.id);
  const due = SRS.dueList(ids), fresh = SRS.newList(ids);
  const decks: Record<string, () => V[]> = {
    srs: () => shuffle(all.filter((v) => due.includes(v.id))).concat(all.filter((v) => fresh.includes(v.id)).slice(0, 20)),
    all: () => shuffle(all),
    star: () => shuffle(all.filter((v) => Star.has(v.id))),
    weak: () => shuffle(all.filter((v) => SRS.box(v.id) < 3)),
  };
  const DK = ['srs', 'all', 'star', 'weak'];
  const ctrl = h('div', { class: 'row', style: { justifyContent: 'center', marginBottom: '18px' } });
  const dSeg = h('div', { class: 'seg' });
  ([['srs', null, `Hôm nay · ${due.length + Math.min(20, fresh.length)}`], ['all', null, 'Tất cả'], ['star', 'star', ''], ['weak', null, 'Chưa thuộc']] as [string, string | null, string][]).forEach(([k, icon, t]) =>
    dSeg.appendChild(h('button', { class: st.deck === k ? 'on' : '', title: k === 'srs' ? `${due.length} thẻ đến hạn + ${Math.min(20, fresh.length)} từ mới` : k === 'star' ? 'Từ đã đánh dấu' : '', onclick: () => { st.deck = k; save(); restart(); } }, icon ? ic(icon) : null, t)));
  const dirSeg = h('div', { class: 'seg' });
  [['jv', 'Nhật → Việt'], ['vj', 'Việt → Nhật']].forEach(([k, t]) => dirSeg.appendChild(h('button', { class: st.dir === k ? 'on' : '', onclick: () => { st.dir = k; save(); restart(); } }, t)));
  const auto = h('label', { class: 'check small', title: 'Tự đọc từ khi hiện thẻ' }, h('input', { type: 'checkbox', checked: st.auto, onchange: (e: Event) => { st.auto = (e.target as HTMLInputElement).checked; save(); } }), 'Tự đọc');
  ctrl.append(dSeg, dirSeg, auto);
  main.appendChild(ctrl);
  const stage = h('div', { class: 'flash-wrap' });
  main.appendChild(stage);
  let queue: V[] = [], idx = 0, flipped = false, stats = { ok: 0, ng: 0 }, relearn = new Set<string>();

  function restart() {
    segBtns(dSeg, DK, st.deck);
    segBtns(dirSeg, ['jv', 'vj'], st.dir);
    queue = decks[st.deck](); idx = 0; stats = { ok: 0, ng: 0 }; relearn = new Set();
    show();
  }
  function show() {
    stage.innerHTML = '';
    if (!queue.length) {
      stage.appendChild(h('div', { class: 'card empty' }, h('div', { class: 'big' }, ic('checkCircle')),
        h('p', null, st.deck === 'srs' ? 'Không còn thẻ đến hạn.' : 'Bộ thẻ trống.'),
        st.deck !== 'all' ? B('primary', 'cards', 'Ôn tất cả', () => { st.deck = 'all'; save(); restart(); }) : null));
      return;
    }
    if (idx >= queue.length) {
      stage.appendChild(h('div', { class: 'card result-card fade-in' }, W.gauge(Math.round((stats.ok / Math.max(1, stats.ok + stats.ng)) * 100), 'nhớ'),
        h('h2', { style: { margin: '6px 0 2px' } }, 'Xong phiên ôn'), h('p', { class: 'muted num' }, `Nhớ ${stats.ok} · Chưa nhớ ${stats.ng}`),
        h('div', { class: 'row', style: { justifyContent: 'center' } }, B('primary', 'rotate', 'Ôn tiếp', restart), A('', 'target', 'Trắc nghiệm', href('vocab', 'quiz')))));
      return;
    }
    const v = queue[idx];
    flipped = false;
    const ctx = contextSentence(v);
    const jpSide = [h('div', { class: 'big', lang: 'ja', html: wordHtml(v) }), v.kanji ? h('div', { class: 'muted', lang: 'ja' }, v.kana) : null];
    const viSide = [h('div', { class: 'mid' }, v.vi)];
    const front = h('div', { class: 'flash-face' }, uTag(v.u), ...(st.dir === 'jv' ? jpSide : viSide), h('div', { class: 'hint' }, h('kbd', null, 'Space'), 'lật thẻ'));
    const back = h('div', { class: 'flash-face flash-back' }, ...(st.dir === 'jv' ? viSide.concat([h('div', { lang: 'ja', style: { fontSize: '20px' }, html: wordHtml(v) })]) : jpSide.concat([h('div', { class: 'muted' }, v.vi)])),
      ctx ? h('div', { class: 'small', style: { marginTop: '10px', maxWidth: '460px' } }, h('div', { lang: 'ja', html: ruby(ctx.jp) }), h('div', { class: 'muted' }, ctx.vi)) : null,
      h('div', { class: 'row', style: { justifyContent: 'center' } }, speakBtn(say(v))));
    const fc = h('div', { class: 'flash' }, h('div', { class: 'flash-inner' }, front, back));
    fc.onclick = flip;
    stage.append(
      h('div', { class: 'q-prog' }, h('span', { class: 'small muted' }, `${idx + 1}/${queue.length}`), h('div', { class: 'bar ok' }, h('i', { style: { width: (idx / queue.length) * 100 + '%' } })), boxes(v.id)),
      fc,
      h('div', { class: 'flash-actions' },
        B('lg bad', 'x', 'Chưa nhớ', () => grade(false)),
        B('lg ok', 'check', 'Đã nhớ', () => grade(true))),
      h('div', { class: 'kbd-hint' }, h('span', null, h('kbd', null, '1'), h('kbd', null, '2'), 'chấm'), h('span', null, h('kbd', null, 'S'), 'nghe')));
    if (st.auto && st.dir === 'jv') TTS.speak(say(v));
  }
  function flip() {
    flipped = !flipped;
    const f = stage.querySelector('.flash');
    if (f) f.classList.toggle('flipped', flipped);
    if (flipped && st.auto && st.dir === 'vj') TTS.speak(say(queue[idx]));
  }
  function grade(good: boolean) {
    const v = queue[idx];
    SRS.grade(v.id, good);
    if (good) stats.ok++; else { stats.ng++; if (!relearn.has(v.id)) { relearn.add(v.id); queue.push(v); } }
    idx++;
    show();
  }
  const onKey = (e: KeyboardEvent) => {
    if (/INPUT|TEXTAREA|SELECT/.test((document.activeElement && document.activeElement.tagName) || '')) return;
    if (!queue[idx]) return;
    if (e.key === ' ') { e.preventDefault(); flip(); }
    else if (e.key === '1') grade(false);
    else if (e.key === '2') grade(true);
    else if (e.key.toLowerCase() === 's') TTS.speak(say(queue[idx]));
  };
  document.addEventListener('keydown', onKey);
  restart();
  return () => document.removeEventListener('keydown', onKey);
}

// ------------------------------------------------------------------ quiz
function renderQuiz(main: HTMLElement) {
  const all = D.vocab();
  const st: { type: string; n: number } = Object.assign({ type: 'jv', n: 10 }, Store.get('vquizUi', {}));
  const types = [['jv', 'Nhật → Việt'], ['vj', 'Việt → Nhật'], ['read', 'Cách đọc'], ['listen', 'Nghe'], ['type', 'Gõ từ']];
  const tSeg = h('div', { class: 'seg' });
  types.forEach(([k, t]) => tSeg.appendChild(h('button', { class: st.type === k ? 'on' : '', onclick: () => { st.type = k; Store.set('vquizUi', st); start(); } }, t)));
  const nSel: HTMLSelectElement = h('select', { class: 'input', style: { height: '40px' }, onchange: () => { st.n = parseInt(nSel.value, 10); Store.set('vquizUi', st); start(); } },
    [10, 20, 30, 0].map((n) => h('option', { value: n, selected: st.n === n }, n ? n + ' câu' : 'Tất cả')));
  main.appendChild(h('div', { class: 'row', style: { justifyContent: 'center', marginBottom: '18px' } }, tSeg, nSel));
  const stage = h('div');
  main.appendChild(stage);
  let runner: { stop: () => void } | null = null;
  function start() {
    segBtns(tSeg, types.map((t) => t[0]), st.type);
    let pool = all;
    if (st.type === 'read') pool = all.filter((v) => v.kanji && /[一-鿿]/.test(v.kanji));
    const items = st.n ? sample(pool, Math.min(st.n, pool.length)) : shuffle(pool);
    const qs: W.QuizQ[] = items.map((v): W.QuizQ => {
      const tag = uTag(v.u).outerHTML;
      if (st.type === 'jv' || st.type === 'listen') {
        const m = W.mcq(all, v, (x) => x.vi, 4);
        return { v, tag, prompt: st.type === 'listen' ? iconSvg('volume', 'big-ic') : wordHtml(v), sub: st.type === 'listen' ? 'Nghe và chọn nghĩa đúng' : null,
          autoSay: st.type === 'listen' ? say(v) : undefined, say: say(v), options: m.options.map((x) => esc(x.vi)), answer: m.answer,
          explain: `<span lang="ja">${wordHtml(v)}</span>（${esc(v.kana)}）= ${esc(v.vi)}`, sayAfter: st.type === 'jv' ? say(v) : undefined };
      }
      if (st.type === 'vj') {
        const m = W.mcq(all, v, (x) => x.kana, 4);
        return { v, tag, prompt: esc(v.vi), promptCls: 'vi', options: m.options.map((x) => wordHtml(x)), optCls: 'jp', answer: m.answer, sayAfter: say(v) };
      }
      if (st.type === 'read') {
        const m = W.mcq(pool, v, (x) => x.kana, 4);
        return { v, tag, prompt: `<span style="font-family:var(--font-mincho)">${esc(v.kanji)}</span>`, sub: 'Chọn cách đọc đúng', options: m.options.map((x) => esc(x.kana)), optCls: 'jp', answer: m.answer, explain: esc(v.vi), sayAfter: say(v) };
      }
      return { v, tag, prompt: esc(v.vi), promptCls: 'vi', sub: 'Gõ romaji — tự chuyển sang hiragana', accept: [v.kana, v.kana.replace(/[～〜]/g, ''), v.kanji].filter(Boolean), kana: true, loose: true, explain: `<span lang="ja">${wordHtml(v)}</span>`, sayAfter: say(v) };
    });
    if (runner) runner.stop();
    runner = W.runQuiz(stage, qs, {
      onAnswer: (q, ok) => { Prog.tally('vocab', ok); if (!ok) SRS.grade(q.v.id, false); },
      onRestart: start,
    });
  }
  start();
  return () => runner && runner.stop();
}

// ------------------------------------------------------------------ matching game
function renderMatch(main: HTMLElement) {
  const all = D.vocab();
  const stage = h('div');
  main.appendChild(stage);
  let timer: ReturnType<typeof setInterval> | undefined;
  function start() {
    clearInterval(timer);
    const words = shuffle(all);
    const rounds: V[][] = [];
    for (let i = 0; i < words.length; i += 6) rounds.push(words.slice(i, i + 6));
    let r = 0, mistakes = 0;
    const t0 = Date.now();
    stage.innerHTML = '';
    const info = h('div', { class: 'match-head' });
    const grid = h('div', { class: 'match-grid' });
    stage.append(info, grid);
    const clock = h('span', { class: 'timer' }, ic('clock'), h('span', null, '0:00'));
    timer = setInterval(() => { clock.lastChild!.textContent = fmtTime((Date.now() - t0) / 1000); }, 500);
    function paintInfo() {
      info.innerHTML = '';
      info.append(h('span', { class: 'tag pri' }, `Lượt ${r + 1}/${rounds.length}`), h('div', { class: 'bar', style: { flex: '1', minWidth: '80px' } }, h('i', { style: { width: (r / rounds.length) * 100 + '%' } })),
        h('span', { class: 'tag bad' }, 'Sai ' + mistakes), clock, B('sm', 'rotate', 'Chơi lại', start));
    }
    function round() {
      paintInfo();
      grid.innerHTML = '';
      const set = rounds[r];
      let left = set.length, sel: { t: { v: V; side: string }; el: HTMLElement } | null = null;
      const tiles = shuffle(set.map((v) => ({ v, side: 'jp' })).concat(set.map((v) => ({ v, side: 'vi' }))));
      tiles.forEach((t) => {
        // wrap in a span: the tile is a grid, and bare ruby/text nodes would each become a grid row
        const el = h('div', { class: 'tile' + (t.side === 'jp' ? ' jp' : ''), lang: t.side === 'jp' ? 'ja' : null }, h('span', { html: t.side === 'jp' ? wordHtml(t.v) : esc(t.v.vi) }));
        el.onclick = () => {
          if (el.classList.contains('done')) return;
          if (t.side === 'jp') TTS.speak(say(t.v));
          if (!sel) { sel = { t, el }; el.classList.add('sel'); return; }
          if (sel.el === el) { el.classList.remove('sel'); sel = null; return; }
          if (sel.t.v.id === t.v.id && sel.t.side !== t.side) {
            el.classList.add('done'); sel.el.classList.add('done'); sel = null; left--;
            if (!left) { r++; if (r < rounds.length) setTimeout(round, 350); else finish(); }
          } else {
            mistakes++; paintInfo();
            const a = sel!.el; a.classList.remove('sel'); a.classList.add('err'); el.classList.add('err');
            setTimeout(() => { a.classList.remove('err'); el.classList.remove('err'); }, 400);
            sel = null;
          }
        };
        grid.appendChild(el);
      });
    }
    function finish() {
      clearInterval(timer);
      const secs = Math.round((Date.now() - t0) / 1000);
      const key = 'match:' + D.sel().join(',');
      const best: Record<string, number> = Store.get('matchBest', {});
      const isBest = !best[key] || secs < best[key];
      if (isBest) { best[key] = secs; Store.set('matchBest', best); }
      stage.innerHTML = '';
      stage.appendChild(h('div', { class: 'card result-card fade-in' }, h('div', { class: 'empty', style: { padding: '0' } }, h('div', { class: 'big' }, ic('trophy'))),
        h('div', { class: 'result-big' }, fmtTime(secs)), h('p', { class: 'muted num' }, 'Sai ' + mistakes + ' lần'),
        isBest ? h('span', { class: 'tag ok' }, 'Kỷ lục mới') : h('span', { class: 'tag' }, 'Kỷ lục ' + fmtTime(best[key])),
        h('div', { style: { marginTop: '14px' } }, B('primary', 'rotate', 'Chơi lại', start))));
    }
    round();
  }
  start();
  return () => clearInterval(timer);
}

function render(main: HTMLElement, args: string[], query: Query) {
  const mode = args[0] || '';
  header(main, mode, D.vocab().length);
  if (mode === 'flash') return renderFlash(main);
  if (mode === 'quiz') return renderQuiz(main);
  if (mode === 'match') return renderMatch(main);
  return renderList(main, query || {});
}

definePage(render);
