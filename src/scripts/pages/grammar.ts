/* Ngữ pháp — visual grammar cards */
import { D } from '../../lib/data';
import { A, B, esc, h, ic } from '../../lib/dom';
import { definePage } from '../../lib/page';
import { href } from '../../lib/routes';
import { Store } from '../../lib/store';
import { ruby } from '../../lib/text';
import type { Grammar, WithUnit } from '../../lib/types';
import * as W from '../../lib/widgets';

function gcard(g: WithUnit<Grammar>, open: boolean) {
  const card = h('div', { class: 'card gcard' + (open ? ' open' : ''), id: 'g-' + g.id, style: { '--c': `var(--u${g.u})` } });
  const head = h('div', { class: 'gcard-head', onclick: () => { card.classList.toggle('open'); remember(); } },
    h('div', { class: 'gnum' }, g.no),
    h('div', { style: { minWidth: 0 } },
      h('div', { class: 'gtitle', lang: 'ja', html: ruby(g.title) + (g.sub ? ` <small>${esc(g.sub)}</small>` : '') }),
      h('div', { class: 'gmean' }, g.meaning),
      g.formulas && g.formulas.length ? h('div', { style: { marginTop: '10px' } }, g.formulas.slice(0, 1).map((f) => W.formula(f))) : null),
    h('span', { class: 'chev' }, ic('down')));
  card.appendChild(head);
  const body = h('div', { class: 'gbody' });
  if (g.group === 'B') body.appendChild(h('span', { class: 'tag pri' }, 'Cách nói hay dùng'));
  body.appendChild(h('div', { class: 'glabel' }, 'Cách dùng'));
  body.appendChild(h('ul', { class: 'usage' }, g.usage.map((u) => h('li', { html: ruby(u) }))));
  if (g.formulas && g.formulas.length > 1) {
    body.appendChild(h('div', { class: 'glabel' }, 'Cấu trúc'));
    g.formulas.forEach((f) => body.appendChild(W.formula(f)));
  }
  if (g.table) { body.appendChild(h('div', { class: 'glabel' }, 'Bảng chia')); body.appendChild(W.conjTable(g.table)); }
  if (g.fix) body.appendChild(h('div', { class: 'note fix small', style: { marginTop: '10px' } }, ic('pencil'), g.fix));
  if (g.diagram === 'give') { body.appendChild(h('div', { class: 'glabel' }, 'Sơ đồ cho – nhận')); body.appendChild(W.giveDiagram(g.focus)); }
  if (g.diagram === 'meishi') { body.appendChild(h('div', { class: 'glabel' }, 'Sơ đồ')); body.appendChild(W.meishiDiagram()); }
  (g.notes || []).forEach((n) => body.appendChild(h('div', { class: 'gnote' }, ic('pin'), h('span', { html: ruby(n) }))));
  if (g.examples && g.examples.length) {
    body.appendChild(h('div', { class: 'glabel' }, 'Ví dụ'));
    g.examples.forEach((ex) => body.appendChild(W.example(ex)));
  }
  if (g.extra && g.extra.length) {
    body.appendChild(h('div', { class: 'glabel' }, 'Ghi chú thêm'));
    g.extra.forEach((x) => body.appendChild(h('div', { class: 'extra' }, h('div', { class: 'extra-label', title: 'Ngoài tài liệu của lớp' }, '+ Bổ sung'), h('div', { html: ruby(x) }))));
  }
  const actions = h('div', { class: 'row', style: { marginTop: '16px', gap: '8px' } });
  if (g.video) actions.appendChild(B('sm', 'video', 'Video bài giảng', () => W.videoModal(g.video, g.videoTitle || 'Video bài giảng')));
  actions.appendChild(A('sm', 'clipboard', 'Bài tập Unit ' + g.u, href('bank', { unit: g.u, part: 3 })));
  body.appendChild(actions);
  card.appendChild(body);
  return card;
}
function remember() {
  const open = Array.from(document.querySelectorAll('.gcard.open')).map((c) => c.id.slice(2));
  Store.set('gramOpen', open);
}

function render(main: HTMLElement, args: string[]) {
  const focus = args[0];
  const list = D.grammar();
  const openSet = new Set<string>(Store.get('gramOpen', []));
  const all = B('sm', 'updown', 'Mở / thu tất cả', () => { const cards = main.querySelectorAll('.gcard'); const anyClosed = Array.from(cards).some((c) => !c.classList.contains('open')); cards.forEach((c) => c.classList.toggle('open', anyClosed)); remember(); });
  main.appendChild(W.pageHead('Ngữ pháp', 'ぶんぽう', [all, A('sm', 'repeat', 'Bảng chia động từ', href('conj'))], list.length + ' mẫu'));
  main.appendChild(W.legend());
  D.sel().forEach((u) => {
    const unit = D.unit(u);
    main.appendChild(h('div', { class: 'section-title' }, h('h2', null, 'Unit ' + u), h('span', { class: 'jp-sub', lang: 'ja', html: ruby(unit.title) }), h('div', { class: 'line' })));
    const items = list.filter((g) => g.u === u);
    const grid = h('div', { class: 'col' });
    items.forEach((g) => grid.appendChild(gcard(g, openSet.has(g.id) || g.id === focus)));
    main.appendChild(grid);
  });
  if (focus) setTimeout(() => { const el = document.getElementById('g-' + focus); if (el) { el.classList.add('open'); el.scrollIntoView({ block: 'start' }); window.scrollBy(0, -90); } }, 30);
}

definePage(render);
