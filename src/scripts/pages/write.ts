/* Tập viết — handwriting practice */
import { D } from '../../lib/data';
import { B, h, ic } from '../../lib/dom';
import { KanjiWriter as KW } from '../../lib/kanjiwriter';
import { definePage, rerender } from '../../lib/page';
import type { Query } from '../../lib/page';
import { Prog } from '../../lib/progress';
import { href } from '../../lib/routes';
import { Store } from '../../lib/store';
import { ruby } from '../../lib/text';
import { speakBtn } from '../../lib/tts';
import type { Kanji } from '../../lib/types';
import { modal, toast } from '../../lib/ui';
import * as W from '../../lib/widgets';

const uTag = W.uTag;
type Item = Kanji & { u: number; extra?: boolean };
const blank = (c: string, u: number): Item => ({ c, u, extra: true, list: '', hv: [], on: [], kun: [], ex: [], meaning: '', strokes: 0 });
const hv = (k: Item) => { const m = (k.hv || []).filter((x) => !x.rare); return (m.length ? m : k.hv || []).map((x) => x.t).join(' / '); };

function render(main: HTMLElement, args: string[], query: Query) {
  const st = Object.assign({ mode: 'trace', len: 'normal', extra: false }, Store.get('writeUi', {}));
  const save = () => Store.set('writeUi', st);
  const units = query.unit ? [parseInt(query.unit, 10)] : D.sel();
  let list: Item[] = D.kanji(units).filter((k) => KW.has(k.c));
  if (st.extra) {
    const have = new Set(list.map((k) => k.c));
    D.vocab(units).forEach((v) => Array.from(v.kanji || '').forEach((c) => { if (/[一-鿿]/.test(c) && !have.has(c) && KW.has(c)) { have.add(c); list.push(blank(c, v.u)); } }));
  }
  let idx = Math.max(0, list.findIndex((k) => k.c === args[0]));
  if (args[0] && idx === 0 && list[0] && list[0].c !== args[0] && KW.has(args[0])) { list.unshift(Object.assign(blank(args[0], 0), D.kanjiInfo(args[0]) || {})); idx = 0; }
  let session: { results: { c: string; m: number }[] } | null = null;

  const extra = h('label', { class: 'check small', title: 'Thêm các chữ Hán xuất hiện trong từ vựng' }, h('input', { type: 'checkbox', checked: st.extra, onchange: (e: Event) => { st.extra = (e.target as HTMLInputElement).checked; save(); rerender(); } }), '+ chữ trong từ vựng');
  main.appendChild(W.pageHead('Tập viết', 'かんじをかく', [extra, B('sm primary', 'repeat', 'Luyện liên tục', startSession, { title: 'Viết lần lượt ' + list.length + ' chữ, không có nét mờ' })],
    list.length + ' chữ' + (query.unit ? ' · Unit ' + query.unit : '')));
  if (query.unit) main.appendChild(h('div', { class: 'row', style: { marginTop: '-8px', marginBottom: '12px' } }, h('span', { class: 'tag u' + query.unit }, 'Chỉ Unit ' + query.unit), h('a', { class: 'small', href: href('write') }, 'Bỏ lọc')));
  if (!list.length) { main.appendChild(h('div', { class: 'empty' }, 'Không có chữ nào.')); return; }

  const strip = h('div', { class: 'kstrip' });
  main.appendChild(strip);
  const layout = h('div', { class: 'write-layout' });
  main.appendChild(layout);
  const left = h('div', { class: 'card' });
  const right = h('div', { class: 'card' });
  layout.append(left, right);

  const modeSeg = h('div', { class: 'seg' });
  const MODES: [string, string, string][] = [['view', 'eye', 'Xem nét'], ['trace', 'pencil', 'Tô theo'], ['test', 'target', 'Tự viết'], ['free', 'brush', 'Tự do']];
  MODES.forEach(([k, icon, t]) => modeSeg.appendChild(h('button', { class: st.mode === k ? 'on' : '', onclick: () => { st.mode = k; save(); session = null; load(); } }, ic(icon), t)));
  const lenSel: HTMLSelectElement = h('select', { class: 'input', title: 'Độ khó khi chấm nét', onchange: () => { st.len = lenSel.value; save(); load(); } },
    [['easy', 'Chấm dễ'], ['normal', 'Chấm vừa'], ['hard', 'Chấm khó']].map(([v, t]) => h('option', { value: v, selected: st.len === v }, t)));
  const pad = h('div');
  const msg = h('div', { class: 'kw-msg' });
  const ctrls = h('div', { class: 'kw-ctrls' });
  left.append(h('div', { class: 'write-top' }, modeSeg, lenSel), pad, msg, ctrls);

  let w: KW | null = null;
  function paintStrip() {
    strip.innerHTML = '';
    list.forEach((k, i) => {
      const lvl = Prog.kanjiLevel(k.c);
      strip.appendChild(h('button', { class: i === idx ? 'on' : '', lang: 'ja', title: (hv(k) || '') + (k.extra ? ' (trong từ vựng)' : ''), onclick: () => { idx = i; session = null; load(); } },
        k.c, h('span', { class: 'd' + (lvl === 2 ? ' m' : lvl === 1 ? ' p' : '') })));
    });
    const cur = strip.children[idx] as HTMLElement | undefined;
    if (cur) cur.scrollIntoView({ inline: 'center', block: 'nearest' });
  }
  function info(k: Item) {
    right.innerHTML = '';
    const rec = Prog.kanji(k.c);
    right.append(
      h('div', { class: 'kinfo-head' }, h('div', { class: 'kc', lang: 'ja' }, k.c),
        h('div', null, h('div', { class: 'kbig-hv' }, hv(k) || '—'), h('div', { style: { color: 'var(--ink-2)' } }, k.meaning || ''),
          h('div', { class: 'row', style: { gap: '4px', marginTop: '6px' } }, k.u ? uTag(k.u) : null, h('span', { class: 'tag' }, KW.strokeCount(k.c) + ' nét'), k.list === 'n4' ? h('span', { class: 'tag badge-n4' }, 'N4') : null))),
      k.on && k.on.length + k.kun.length ? h('dl', { class: 'kread', style: { marginTop: '14px' } }, h('dt', null, 'On'), h('dd', null, W.readingChips(k.on, 'on')), h('dt', null, 'Kun'), h('dd', null, W.readingChips(k.kun, 'kun'))) : null,
      k.ex && k.ex.length ? h('div', null, h('div', { class: 'glabel' }, 'Ví dụ'), k.ex.slice(0, 3).map((e) => h('div', { class: 'kex' }, speakBtn(e.r || ''), h('span', { class: 'w', lang: 'ja', html: ruby(e.ruby) }), h('span', { class: 'small muted' }, e.vi)))) : null,
      h('div', { class: 'glabel' }, 'Thứ tự nét'), KW.filmstrip(k.c),
      h('div', { class: 'row', style: { marginTop: '14px' } },
        h('span', { class: 'small muted num' }, rec ? `Đã luyện ${rec.n} lần · tốt nhất: sai ${rec.best}` : 'Chưa luyện'), h('span', { class: 'spacer' }),
        B('sm', 'info', 'Chi tiết', () => W.kanjiModal(k.c))));
  }
  function setMsg(t: string, cls?: string) { msg.textContent = t; msg.className = 'kw-msg ' + (cls || ''); }
  function load() {
    Array.from(modeSeg.children).forEach((b, i) => b.classList.toggle('on', MODES[i][0] === st.mode));
    const k = list[idx];
    if (w) w.stop();
    // keep the address on the current character (reload / share lands on the same one)
    args[0] = k.c;
    const url = href('write', k.c, query.unit ? { unit: query.unit } : null);
    if (location.pathname + location.search !== url) history.replaceState(history.state, '', url);
    paintStrip();
    info(k);
    const kw = w = new KW(pad, k.c, {
      leniency: st.len, numbers: true, onMessage: setMsg,
      onComplete: (r) => {
        if (st.mode === 'test' || session) Prog.saveKanji(k.c, r.mistakes);
        paintStrip();
        if (session) {
          session.results.push({ c: k.c, m: r.mistakes });
          setTimeout(() => { if (!session) return; if (idx < list.length - 1) { idx++; load(); } else endSession(); }, 1100);
        }
      },
    });
    ctrls.innerHTML = '';
    const mode = session ? 'test' : st.mode;
    if (mode === 'view') {
      kw.animate({ numbers: true });
      ctrls.append(B('sm', 'rotate', 'Phát lại', () => kw.animate({ numbers: true })), B('sm icon', 'left', null, () => kw.showStep(Math.max(1, (kw.step || 1) - 1)), { title: 'Nét trước' }),
        B('sm icon', 'right', null, () => kw.showStep(Math.min(kw.count, (kw.step || 0) + 1)), { title: 'Nét sau' }), B('sm', 'turtle', 'Chậm', () => kw.animate({ numbers: true, speed: 0.5 })));
      setMsg(`${kw.count} nét — xem kỹ thứ tự và hướng viết`);
    } else if (mode === 'free') {
      kw.free();
      let cmp = false;
      ctrls.append(B('sm', 'undo', 'Xoá nét', () => kw.undoFree()), B('sm', 'eraser', 'Xoá hết', () => kw.free()),
        B('sm', 'eye', 'So sánh', (e: MouseEvent) => { cmp = !cmp; kw.compare(cmp); (e.currentTarget as HTMLElement).classList.toggle('primary', cmp); }), B('sm', 'play', 'Xem nét', () => { st.mode = 'view'; save(); load(); }));
    } else {
      kw.quiz({ trace: mode === 'trace' });
      ctrls.append(B('sm', 'bulb', 'Gợi ý', () => kw.hint(), { title: 'Phím H' }), B('sm', 'rotate', 'Làm lại', () => load()),
        B('sm', 'play', 'Xem nét', () => kw.animate({ numbers: true }).then(() => kw.quiz({ trace: mode === 'trace' }))));
    }
    const nextB = B('sm primary', null, 'Chữ tiếp', () => { if (idx < list.length - 1) { idx++; load(); } else if (session) endSession(); }, { title: 'Phím →' });
    nextB.appendChild(ic('arrowRight'));
    ctrls.append(nextB);
    if (session) ctrls.prepend(h('span', { class: 'tag acc' }, `Liên tục ${idx + 1}/${list.length}`), B('sm', 'stop', 'Dừng', endSession));
  }
  function startSession() { session = { results: [] }; idx = 0; load(); toast('Viết lần lượt từng chữ — không có nét mờ'); }
  function endSession() {
    if (!session) return;
    const res = session.results; session = null;
    const perfect = res.filter((r) => r.m === 0).length;
    modal({ title: 'Kết quả luyện viết', body: h('div', null,
      h('div', { class: 'row', style: { marginBottom: '14px' } }, h('div', { class: 'stat' }, h('b', null, String(res.length)), h('span', null, 'chữ đã viết')), h('div', { class: 'stat', style: { marginLeft: '24px' } }, h('b', { style: { color: 'var(--ok)' } }, String(perfect)), h('span', null, 'hoàn hảo'))),
      h('div', { class: 'kgrid' }, res.map((r) => h('div', { class: 'ktile', onclick: () => { idx = list.findIndex((k) => k.c === r.c); load(); } },
        h('div', { class: 'kc', lang: 'ja' }, r.c), h('div', { class: 'kh', style: { color: r.m ? 'var(--bad)' : 'var(--ok)' } }, r.m ? 'sai ' + r.m : 'hoàn hảo'))))) });
    load();
  }
  const onKey = (e: KeyboardEvent) => {
    if (/INPUT|TEXTAREA|SELECT/.test((document.activeElement && document.activeElement.tagName) || '')) return;
    if (e.key === 'ArrowRight' && idx < list.length - 1) { idx++; load(); }
    else if (e.key === 'ArrowLeft' && idx > 0) { idx--; load(); }
    else if (e.key.toLowerCase() === 'h' && w) w.hint();
  };
  document.addEventListener('keydown', onKey);
  load();
  return () => { document.removeEventListener('keydown', onKey); if (w) w.stop(); };
}

definePage(render);
