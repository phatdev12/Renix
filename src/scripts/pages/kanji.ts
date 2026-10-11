/* Kanji — grid, detail modal, quizzes */
import { D } from '../../lib/data';
import { A, B, esc, h, ic } from '../../lib/dom';
import { definePage } from '../../lib/page';
import { Prog } from '../../lib/progress';
import { href } from '../../lib/routes';
import { Store } from '../../lib/store';
import { confusables, hiraToKata, ruby, toHira } from '../../lib/text';
import type { Kanji, KanjiExample, WithUnit } from '../../lib/types';
import { debounce, sample, shuffle, uniq } from '../../lib/util';
import * as W from '../../lib/widgets';
import { uTag } from '../../lib/widgets';

type K = WithUnit<Kanji>;
const hv = (k: Kanji) => { const m = k.hv.filter((x) => !x.rare); return (m.length ? m : k.hv).map((x) => x.t).join(' / '); };


function tile(k: K, hide: boolean) {
  const lvl = Prog.kanjiLevel(k.c);
  return h('div', { class: 'ktile', style: { '--c': `var(--u${k.u})` }, title: hv(k) + ' – ' + k.meaning, onclick: () => W.kanjiModal(k.c) },
    lvl ? h('span', { class: 'kdone' + (lvl === 2 ? '' : ' part'), title: lvl === 2 ? 'Đã viết đúng hoàn toàn' : 'Đã luyện viết' }, ic(lvl === 2 ? 'check' : 'pencil')) : null,
    k.list === 'n4' ? h('span', { class: 'tag badge-n4 kbadge' }, 'N4') : null,
    h('div', { class: 'kc', lang: 'ja' }, k.c),
    h('div', { class: 'kh', style: hide ? { visibility: 'hidden' } : null }, hv(k)),
    h('div', { class: 'km', style: hide ? { visibility: 'hidden' } : null }, k.meaning));
}

function renderGrid(main: HTMLElement) {
  const st: { list: string; hide: boolean } = Object.assign({ list: 'all', hide: false }, Store.get('kanjiUi', {}));
  const save = () => Store.set('kanjiUi', st);
  const all = D.kanji();
  const q = h('input', { class: 'input', type: 'search', placeholder: 'Tìm: chữ, Hán Việt, nghĩa, âm đọc…' }) as HTMLInputElement;
  const lSeg = h('div', { class: 'seg' });
  [['all', 'Tất cả'], ['unit', 'Của bài'], ['n4', 'N4 bổ sung']].forEach(([k, t]) => lSeg.appendChild(h('button', { class: st.list === k ? 'on' : '', onclick: () => { st.list = k; save(); paint(); Array.from(lSeg.children).forEach((b, i) => b.classList.toggle('on', ['all', 'unit', 'n4'][i] === k)); } }, t)));
  const hide: HTMLElement = B('', st.hide ? 'eyeOff' : 'eye', 'Che nghĩa', () => { st.hide = !st.hide; save(); hide.classList.toggle('primary', st.hide); hide.replaceChild(ic(st.hide ? 'eyeOff' : 'eye'), hide.firstChild!); paint(); }, { title: 'Che Hán Việt và nghĩa để tự kiểm tra' });
  hide.classList.toggle('primary', st.hide);
  main.appendChild(W.pageHead('Kanji', 'かんじ', [A('sm primary', 'target', 'Trắc nghiệm', href('kanji', 'quiz')), A('sm', 'brush', 'Tập viết', href('write'))], all.length + ' chữ'));
  main.appendChild(h('div', { class: 'filters' }, q, lSeg, hide));
  const out = h('div');
  main.appendChild(out);
  q.addEventListener('input', debounce(paint, 120));
  function match(k: K) {
    if (st.list !== 'all' && k.list !== st.list) return false;
    const s = q.value.trim().toLowerCase();
    if (!s) return true;
    const fold = (x: string) => x.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
    const hay = fold([k.c, hv(k), k.meaning, k.on.map((x) => x.t).join(' '), k.kun.map((x) => x.t).join(' '), k.ex.map((e) => e.w + e.r).join(' ')].join(' '));
    return hay.includes(fold(s)) || hay.includes(toHira(s, false)) || hay.includes(hiraToKata(toHira(s, false)));
  }
  function paint() {
    out.innerHTML = '';
    D.sel().forEach((u) => {
      const unit = D.unit(u);
      const list = all.filter((k) => k.u === u && match(k));
      if (!list.length) return;
      out.appendChild(h('div', { class: 'section-title' }, h('h2', null, 'Unit ' + u), h('span', { class: 'jp-sub', lang: 'ja', html: ruby(unit.title) }), h('span', { class: 'small muted num' }, list.length + ' chữ'), h('div', { class: 'line' }),
        unit.videos.kanji ? B('sm', 'video', 'Video', () => W.videoModal(unit.videos.kanji, 'Video Kanji · Unit ' + u)) : null,
        A('sm', 'brush', 'Viết cả bài', href('write', { unit: u }))));
      out.appendChild(h('div', { class: 'kgrid' }, list.map((k) => tile(k, st.hide))));
    });
    if (!out.children.length) out.appendChild(h('div', { class: 'empty' }, h('div', { class: 'big' }, ic('search')), 'Không tìm thấy chữ nào'));
  }
  paint();
}

function renderQuiz(main: HTMLElement) {
  const st: { type: string; n: number } = Object.assign({ type: 'hv', n: 15 }, Store.get('kquizUi', {}));
  const types = [['hv', 'Hán Việt'], ['char', 'Mặt chữ'], ['read', 'Cách đọc'], ['mean', 'Nghĩa từ']];
  const tSeg = h('div', { class: 'seg' });
  types.forEach(([k, t]) => tSeg.appendChild(h('button', { class: st.type === k ? 'on' : '', onclick: () => { st.type = k; Store.set('kquizUi', st); start(); } }, t)));
  const nSel: HTMLSelectElement = h('select', { class: 'input', onchange: () => { st.n = parseInt(nSel.value, 10); Store.set('kquizUi', st); start(); } }, [10, 15, 25, 0].map((n) => h('option', { value: n, selected: st.n === n }, n ? n + ' câu' : 'Tất cả')));
  main.appendChild(W.pageHead('Trắc nghiệm Kanji', 'かんじクイズ', [A('sm', 'arrowLeft', 'Bảng Kanji', href('kanji'))]));
  main.appendChild(h('div', { class: 'row', style: { justifyContent: 'center', marginBottom: '18px' } }, tSeg, nSel));
  const stage = h('div');
  main.appendChild(stage);
  let runner: { stop: () => void } | null = null;
  function start() {
    Array.from(tSeg.children).forEach((b, i) => b.classList.toggle('on', types[i][0] === st.type));
    const ks = D.kanji();
    const exs: (KanjiExample & { k: K })[] = [];
    ks.forEach((k) => k.ex.forEach((e) => { if (e.r && /[一-鿿]/.test(e.w)) exs.push(Object.assign({ k }, e)); }));
    let qs: W.QuizQ[];
    if (st.type === 'hv' || st.type === 'char') {
      const items = st.n ? sample(ks, Math.min(st.n, ks.length)) : shuffle(ks);
      qs = items.map((k) => {
        const m = W.mcq(ks, k, (x) => (st.type === 'hv' ? hv(x) : x.c), 4);
        return st.type === 'hv'
          ? { prompt: `<span style="font-family:var(--font-mincho);font-size:64px">${esc(k.c)}</span>`, sub: 'Âm Hán Việt của chữ này là?', options: m.options.map((x) => esc(hv(x))), answer: m.answer, explain: `${esc(k.c)} – ${esc(hv(k))}: ${esc(k.meaning)}`, tag: uTag(k.u).outerHTML }
          : { prompt: `<b>${esc(hv(k))}</b><div class="small muted">${esc(k.meaning)}</div>`, promptCls: 'vi', sub: 'Chọn chữ Hán đúng', options: m.options.map((x) => `<span style="font-family:var(--font-mincho);font-size:30px">${esc(x.c)}</span>`), answer: m.answer, tag: uTag(k.u).outerHTML };
      });
    } else {
      const items = st.n ? sample(exs, Math.min(st.n, exs.length)) : shuffle(exs);
      qs = items.map((e) => {
        const reading = e.r.split('・')[0];
        if (st.type === 'read') {
          const conf = shuffle(confusables(reading)).slice(0, 2);
          const others = shuffle(uniq(exs.map((x) => x.r.split('・')[0]).filter((r) => r !== reading && !conf.includes(r) && Math.abs(r.length - reading.length) <= 2))).slice(0, 3 - conf.length);
          const opts = shuffle([reading].concat(conf, others));
          return { prompt: `<span style="font-family:var(--font-mincho)">${esc(e.w)}</span>`, sub: 'Chọn cách đọc đúng', options: opts.map(esc), optCls: 'jp', answer: opts.indexOf(reading), explain: `<span lang="ja">${ruby(e.ruby)}</span> – ${esc(e.vi)}`, sayAfter: reading, tag: uTag(e.k.u).outerHTML };
        }
        const m = W.mcq(exs, e, (x) => x.vi, 4);
        return { prompt: ruby(e.ruby), sub: 'Nghĩa của từ này là?', options: m.options.map((x) => esc(x.vi)), answer: m.answer, say: reading, explain: `<span lang="ja">${ruby(e.ruby)}</span>（${esc(reading)}）`, tag: uTag(e.k.u).outerHTML };
      });
    }
    if (runner) runner.stop();
    runner = W.runQuiz(stage, qs, { onAnswer: (_q, ok) => Prog.tally('kanji', ok), onRestart: start });
  }
  start();
  return () => runner && runner.stop();
}

function render(main: HTMLElement, args: string[]) {
  if (args[0] === 'quiz') return renderQuiz(main);
  if (args[0]) { renderGrid(main); setTimeout(() => W.kanjiModal(args[0]), 50); return; }
  return renderGrid(main);
}

definePage(render);
