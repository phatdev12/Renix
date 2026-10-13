/* Đề luyện LMS — the original ドリル/テスト questions with answer keys */
import { BANK, Bank } from '../../lib/bank';
import { D } from '../../lib/data';
import { A, B, h, ic } from '../../lib/dom';
import { definePage, rerender, setTitle } from '../../lib/page';
import type { Query } from '../../lib/page';
import { Prog } from '../../lib/progress';
import { go, href } from '../../lib/routes';
import { Store } from '../../lib/store';
import { ruby } from '../../lib/text';
import type { Quiz } from '../../lib/types';
import { modal, toast } from '../../lib/ui';
import { fmtDate, pct, shuffle } from '../../lib/util';
import * as W from '../../lib/widgets';
import { PARTS, TYPE_VI, keyed, questionCard } from '../../lib/quiz-ui';
import type { Q, QItem } from '../../lib/quiz-ui';

const qCount = (qz: Quiz) => qz.parts.reduce((s, p) => s + p.questions.length, 0);

// ------------------------------------------------------------------ list
function renderList(main: HTMLElement, query: Query) {
  let list = Bank.list();
  if (query.unit) list = list.filter((q) => q.unit === parseInt(query.unit, 10));
  if (query.part) list = list.filter((q) => q.part === parseInt(query.part, 10));
  const total = list.reduce((s, q) => s + qCount(q), 0);
  main.appendChild(W.pageHead('Đề luyện LMS', 'ドリル・テスト', [B('sm', 'shuffle', 'Trộn 20 câu', () => mixQuiz(list), { title: 'Trộn ngẫu nhiên 20 câu có đáp án' })], list.length + ' bài · ' + total + ' câu'));
  if (query.unit || query.part) main.appendChild(h('div', { class: 'row', style: { marginTop: '-6px', marginBottom: '14px' } }, ic('filter', 'muted'),
    query.unit ? h('span', { class: 'tag u' + query.unit }, 'Unit ' + query.unit) : null, query.part ? h('span', { class: 'tag', lang: 'ja' }, 'Part ' + query.part + ' ' + PARTS[Number(query.part)]) : null,
    h('a', { class: 'small', href: href('bank') }, 'Xem tất cả')));
  main.appendChild(h('div', { class: 'bank-legend' }, 'Đáp án:',
    h('span', { class: 'tag ok', title: 'Lấy từ bài làm 10/10 của bạn trên LMS' }, ic('checkCircle'), 'xác nhận'),
    h('span', { class: 'tag pri', title: 'Do AI giải và kiểm tra lại' }, 'tham khảo'),
    h('span', { class: 'tag warn', title: 'AI chưa chắc chắn hoàn toàn — nên xem kỹ' }, 'tin cậy TB'),
    h('span', { class: 'tag', title: 'Câu nghe: cần nghe audio, không có đáp án' }, ic('headphones'), 'câu nghe'),
    W.infoTip('Xác nhận = từ bài làm 10/10 của bạn trên LMS. Tham khảo = AI giải và kiểm tra lại, có ghi mức tin cậy. Câu nghe cần audio nên không có đáp án.')));
  const units = D.sel().filter((u) => list.some((q) => q.unit === u));
  units.forEach((u) => {
    const unit = D.unit(u);
    const card = h('div', { class: 'card bank-unit', style: { '--c': 'var(--unit)' } });
    card.appendChild(h('div', { class: 'bank-unit-head' }, h('span', { class: 'un' }, 'Unit ' + u), h('span', { class: 'jp-sub', lang: 'ja', html: ruby(unit.title) })));
    list.filter((q) => q.unit === u).forEach((qz) => {
      const n = qCount(qz);
      const nk = qz.parts.reduce((s, p) => s + p.questions.filter(keyed).length, 0);
      const na = qz.parts.reduce((s, p) => s + p.questions.filter((q) => q.needs_audio).length, 0);
      const types = Array.from(new Set(qz.parts.flatMap((p) => p.questions.map((q) => q.type))));
      const rec = Prog.quiz(qz.id);
      const circled = qz.name.match(/[①②③]/);
      card.appendChild(h('div', { class: 'bank-row' },
        h('span', { class: 'bank-kind ' + (qz.kind === 'test' ? 'test' : 'drill') }, qz.kind === 'test' ? 'テスト' : 'ドリル'),
        h('div', { style: { minWidth: 0 } }, h('div', { class: 'bn', lang: 'ja' }, 'Part ' + qz.part + ' · ' + (PARTS[qz.part] || '') + (circled ? ' ' + circled[0] : '')),
          h('div', { class: 'bs' }, h('span', { class: 'num' }, n + ' câu'), '·', h('span', null, types.map((t) => TYPE_VI[t]).join(', ')),
            na ? h('span', { title: na + ' câu nghe' }, ic('headphones'), ' ' + na) : null, nk < n - na ? h('span', null, '· ' + (n - na - nk) + ' câu chưa có đáp án') : null)),
        h('span', { class: 'spacer' }),
        rec ? h('span', { class: 'best ' + (rec.best >= 80 ? 'ok' : rec.best >= 50 ? 'warn' : 'bad'), title: 'Tốt nhất · lần gần nhất ' + fmtDate(rec.last) }, rec.best + '%') : null,
        A('sm', rec ? 'rotate' : 'play', rec ? 'Làm lại' : 'Làm bài', href('bank', qz.id))));
    });
    main.appendChild(card);
  });
}

// the mixed quiz is a list of question keys kept in localStorage, so /bank/mix/ survives a page load
function mixQuiz(list: Quiz[]) {
  const pool: { q: Q; title: string; qz: Quiz }[] = [];
  list.forEach((qz) => qz.parts.forEach((p) => p.questions.forEach((q) => { if (keyed(q) && q.type !== 'short') pool.push({ q, title: p.title, qz }); })));
  const pickN = shuffle(pool).slice(0, 20);
  Store.set('bankMix', pickN.map((x) => x.q.key));
  go(href('bank', 'mix'));
}

// ------------------------------------------------------------------ player
function renderPlayer(main: HTMLElement, id: string) {
  let qz: (Omit<Quiz, 'parts'> & { parts: { title: string; questions: Q[] }[] }) | undefined;
  if (id === 'mix') {
    const keys: string[] = Store.get('bankMix', []);
    const all: Record<string, { q: Q; b: Quiz; p: Quiz['parts'][number] }> = {};
    BANK.forEach((b) => b.parts.forEach((p) => p.questions.forEach((q) => { all[q.key] = { q, b, p }; })));
    const items = keys.map((k) => all[k]).filter(Boolean);
    qz = { id: 'mix', name: 'Trộn ngẫu nhiên ' + items.length + ' câu', unit: 0, part: 0, lesson: '', kind: 'mix',
      parts: [{ title: 'Câu hỏi từ nhiều bài', questions: items.map((x) => Object.assign({ _src: x.b.name, _part: x.p.title }, x.q)) }] };
  } else qz = Bank.quiz(id);
  if (!qz) { main.appendChild(h('div', { class: 'empty' }, 'Không tìm thấy bài.', h('a', { href: href('bank') }, ' Quay lại'))); return; }
  const quiz = qz;
  const st = Object.assign({ mode: 'practice' }, Store.get('bankUi', {}));
  const items: QItem[] = [];
  const head = h('div', { class: 'player-head' });
  setTitle('Đề luyện LMS', quiz.name);
  main.appendChild(h('div', { class: 'row', style: { marginBottom: '10px' } }, A('sm ghost', 'arrowLeft', 'Danh sách đề', href('bank')), quiz.unit ? W.uTag(quiz.unit) : null));
  main.appendChild(h('h1', { class: 'player-title', lang: 'ja' }, quiz.name));
  const modeSeg = h('div', { class: 'seg' });
  ([['practice', 'Luyện tập', 'Chấm từng câu ngay'], ['test', 'Làm bài', 'Làm hết rồi nộp, chấm cuối']] as const).forEach(([k, t, tip]) => modeSeg.appendChild(h('button', { class: st.mode === k ? 'on' : '', title: tip, onclick: () => { st.mode = k; Store.set('bankUi', st); rerender(); } }, t)));
  const navBox = h('div', { class: 'qnav' });
  const scoreEl = h('span', { class: 'score-line' });
  head.append(h('div', { class: 'row' }, modeSeg, h('span', { class: 'spacer' }), scoreEl,
    st.mode === 'test' ? B('sm accent', 'send', 'Nộp bài', submitAll) : B('sm', 'eye', 'Hiện đáp án', revealAll, { title: 'Hiện đáp án tất cả câu' })), h('div', { style: { marginTop: '10px' } }, navBox));
  main.appendChild(head);
  let n = 0;
  quiz.parts.forEach((p) => {
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
  let saved = false;
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
    if (checked && checked === gradable && quiz.id !== 'mix' && !saved) { Prog.saveQuiz(quiz.id, ok, gradable); saved = true; toast(`Hoàn thành: ${ok}/${gradable} (${pct(ok, gradable)}%)`, 3500); }
  }
  function revealAll() {
    items.forEach((it) => { if (it.done === null) { const res = it.r.check(); it.done = res; it.r.reveal(res); const b = it.card.querySelector('.btn.primary'); if (b) b.remove(); } });
    paintNav();
  }
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

function render(main: HTMLElement, args: string[], query: Query) {
  if (args[0]) return renderPlayer(main, args[0]);
  return renderList(main, query || {});
}

definePage(render);
