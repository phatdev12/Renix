/* Tổng quan — dashboard */
import { BANK, Bank } from '../../lib/bank';
import { D } from '../../lib/data';
import { A, B, h, ic } from '../../lib/dom';
import { KanjiWriter } from '../../lib/kanjiwriter';
import { definePage } from '../../lib/page';
import { Prog, SRS } from '../../lib/progress';
import { go, href } from '../../lib/routes';
import { Settings, Store } from '../../lib/store';
import { plain, ruby } from '../../lib/text';
import { speakBtn } from '../../lib/tts';
import { pct } from '../../lib/util';
import * as W from '../../lib/widgets';
import { setExamDate } from '../shell';

function unitStats(u: number) {
  const unit = D.unit(u);
  const vIds = unit.vocab.map((v) => v.id);
  const kan = unit.kanji.map((k) => k.c);
  const quizzes = BANK.filter((q) => q.unit === u);
  const vLearn = SRS.learned(vIds);
  const kDone = kan.filter((c) => Prog.kanji(c)).length;
  const qDone = quizzes.filter((q) => Prog.quiz(q.id)).length;
  const parts = [vIds.length ? vLearn / vIds.length : 0, kan.length ? kDone / kan.length : 0, quizzes.length ? qDone / quizzes.length : 0];
  return { vIds, kan, quizzes, vLearn, kDone, qDone, overall: Math.round((parts.reduce((a, b) => a + b, 0) / 3) * 100) };
}
const status = (p: number) => (p >= 70 ? ['Tốt', 'ok'] : p >= 35 ? ['Khá', 'warn'] : ['Cần ôn', 'bad']);

function countdownCard() {
  const card = h('div', { class: 'card cd-card' }) as unknown as HTMLElement & { _paint: () => void };
  const paint = () => {
    card.innerHTML = '';
    const d = Settings.get('examDate');
    const left = h('div');
    if (!d) {
      left.append(h('div', { class: 'cd-nums' }, h('span', { style: { fontSize: '15px', color: 'var(--ink)' } }, 'Chưa đặt ngày thi')),
        h('div', { class: 'cd-sub' }, B('sm', 'calendar', 'Đặt ngày', setExamDate)));
    } else {
      const ms = new Date(d + 'T00:00:00').getTime() - Date.now();
      if (ms <= 0) {
        const today = new Date().toISOString().slice(0, 10) === d;
        left.append(h('div', { class: 'cd-nums' }, h('b', null, today ? 'Hôm nay' : 'Đã thi')), h('div', { class: 'cd-sub' }, today ? 'Bình tĩnh, tự tin nhé!' : d.split('-').reverse().join('/')));
      } else {
        const dd = Math.floor(ms / 864e5), hh = Math.floor(ms / 36e5) % 24, mm = Math.floor(ms / 6e4) % 60;
        left.append(h('div', { class: 'cd-nums' }, h('b', null, String(dd)), h('span', null, 'ngày'), h('b', null, String(hh).padStart(2, '0')), h('span', null, 'giờ'), h('b', null, String(mm).padStart(2, '0')), h('span', null, 'phút')),
          h('div', { class: 'cd-sub' }, 'đến ngày thi · ' + d.split('-').reverse().join('/')));
      }
    }
    card.append(left, h('button', { class: 'cd-icon', title: 'Đặt ngày thi', onclick: setExamDate, style: { cursor: 'pointer' } }, ic('calendar')));
  };
  paint();
  card._paint = paint;
  return card;
}

function render(main: HTMLElement) {
    const vocab = D.vocab();
  const vIds = vocab.map((v) => v.id);
  const kAll = D.kanji();
  const qAll = Bank.list();
  const due = SRS.dueList(vIds).length;
  const fresh = SRS.newList(vIds).length;
  const vLearn = SRS.learned(vIds);
  const kDone = kAll.filter((k) => Prog.kanji(k.c)).length;
  const qDone = qAll.filter((q) => Prog.quiz(q.id));
  // coverage-weighted quiz score: quizzes not done yet count as 0
  const qAvg = qAll.length ? Math.round(qAll.reduce((s, q) => s + ((Prog.quiz(q.id) || {}).best || 0), 0) / qAll.length) : 0;
  const exams = Prog.exams();
  const lastExam = exams.length ? pct(exams[exams.length - 1].score, exams[exams.length - 1].total) : null;
  const conj = Store.get('conj', {});

  const dash = h('div', { class: 'dash' });
  const left = h('div', { class: 'dash-col dash-left' });
  const center = h('div', { class: 'dash-col dash-center' });
  const right = h('div', { class: 'dash-col dash-right' });
  dash.append(left, center, right);
  main.appendChild(dash);

  // ---------------- left: countdown + what to study today (with progress)
  const cd = countdownCard();
  left.appendChild(cd);
  left.appendChild(h('div', { class: 'sec-label' }, 'Ôn hôm nay'));
  const nextQuiz = qAll.find((q) => !Prog.quiz(q.id));
  const todo = (icon: string, label: string, sub: string, n: string, unit: string, p: number | null, link: string) => h('a', { href: link },
    h('span', { class: 'ti' }, ic(icon)),
    h('span', { class: 'tl' }, label, h('small', null, sub), p == null ? null : h('div', { class: 'bar' }, h('i', { style: { width: p + '%' } }))),
    h('span', { class: 'tn' }, n, unit ? h('small', null, unit) : null));
  left.appendChild(h('div', { class: 'card today' },
    todo('cards', due ? 'Thẻ từ đến hạn' : 'Từ mới', `Đã thuộc ${vLearn}/${vIds.length} từ`, String(due || fresh), due ? 'thẻ' : 'từ', pct(vLearn, vIds.length), href('vocab', 'flash')),
    todo('brush', 'Kanji chưa viết', `Đã viết ${kDone}/${kAll.length} chữ`, String(kAll.length - kDone), 'chữ', pct(kDone, kAll.length), href('write')),
    todo('clipboard', 'Đề chưa làm', nextQuiz ? 'Tiếp: ' + nextQuiz.name : 'Đã làm hết', String(qAll.length - qDone.length), 'bài', pct(qDone.length, qAll.length), nextQuiz ? href('bank', nextQuiz.id) : href('bank')),
    todo('timer', 'Thi thử', exams.length ? exams.length + ' lần · lần gần nhất' : 'Chưa thi lần nào', lastExam == null ? '—' : lastExam + '%', '', lastExam, href('exam')),
    todo('repeat', 'Chia động từ', 'て・た・ない・辞書・可能', conj.n ? pct(conj.ok, conj.n) + '%' : '—', conj.n ? 'đúng' : '', conj.n ? pct(conj.ok, conj.n) : null, href('conj', 'drill'))));

  // ---------------- center: kanji of the day, drawn stroke by stroke
  const stage = h('div', { class: 'stage' });
  center.appendChild(stage);
  const withStrokes = kAll.filter((k) => KanjiWriter.has(k.c));
  const dayN = Math.floor((Date.now() - new Date().getTimezoneOffset() * 6e4) / 864e5);
  let offset = 0;
  let writer: KanjiWriter | null = null;
  function paintStage() {
    if (writer) writer.stop();
    stage.innerHTML = '';
    if (!withStrokes.length) return;
    const todoK = withStrokes.filter((k) => !Prog.kanji(k.c));
    const pool = todoK.length ? todoK : withStrokes;
    const k = pool[(dayN + offset) % pool.length];
    const pad = h('div', { class: 'kotd-pad', title: 'Xem chi tiết', onclick: () => W.kanjiModal(k.c) });
    stage.append(h('div', { class: 'stage-halo' }), pad, h('div', { class: 'platform' }, h('i', { class: 'p1' }), h('i', { class: 'p2' })));
    writer = new KanjiWriter(pad, k.c, { numbers: false });
    writer.animate({ loop: true, speed: 0.85 });
    const reads = k.on.filter((r) => !r.rare).slice(0, 2).concat(k.kun.filter((r) => !r.rare).slice(0, 2));
    const ex = k.ex.find((e) => e.r && !e.rare);
    stage.appendChild(h('div', { class: 'kotd-info' },
      h('div', { class: 'kotd-label' }, 'Hán tự hôm nay · Unit ' + k.u),
      h('div', { class: 'kotd-hv' }, k.hv.filter((x) => !x.rare).map((x) => x.t).join(' / ') || k.hv.map((x) => x.t).join(' / ')),
      h('div', { class: 'kotd-mean' }, k.meaning),
      reads.length ? h('div', { class: 'kotd-reads' }, Array.from(W.readingChips(reads, 'kun').childNodes)) : null,
      h('div', { class: 'row', style: { justifyContent: 'center', marginTop: '8px', gap: '8px' } },
        A('primary', 'brush', 'Tập viết chữ này', href('write', k.c)),
        B('', 'shuffle', 'Chữ khác', () => { offset++; paintStage(); }),
        ex ? speakBtn(ex.r.split('・')[0], 'Nghe: ' + plain(ex.ruby)) : null)));
  }
  paintStage();

  // ---------------- right: readiness + vocabulary memory
  const pV = pct(vLearn, vIds.length), pK = pct(kDone, kAll.length);
  const comps = [pV, pK, qAvg].concat(lastExam == null ? [] : [lastExam]);
  const ready = Math.round(comps.reduce((a, b) => a + b, 0) / comps.length);
  const srow = (icon: string, label: string, p: number) => { const [t, c] = status(p); return h('div', { class: 'status-row' }, ic(icon), label, h('b', { class: c }, t)); };
  right.appendChild(h('div', { class: 'sec-label', style: { marginTop: '0' } }, 'Mức sẵn sàng', h('a', { class: 'more', href: href('progress') }, 'Chi tiết')));
  right.appendChild(h('div', { class: 'card ready' }, W.gauge(ready, 'điểm'),
    h('div', { class: 'status-rows' }, srow('cards', 'Từ vựng', pV), srow('kanji', 'Kanji', pK), srow('clipboard', 'Đề luyện', qAvg))));

  const cnt = [0, 0, 0, 0];
  vIds.forEach((id) => { const b = SRS.box(id); cnt[b === 0 ? 0 : b <= 2 ? 1 : b <= 4 ? 2 : 3]++; });
  const segs: W.Seg[] = [
    { v: cnt[0], c: 'var(--g0)', label: 'Chưa học' },
    { v: cnt[1], c: 'var(--g3)', label: 'Đang học' },
    { v: cnt[2], c: 'var(--g2)', label: 'Đã thuộc' },
    { v: cnt[3], c: 'var(--g1)', label: 'Nhớ lâu' },
  ];
  right.appendChild(h('div', { class: 'sec-label' }, 'Ghi nhớ từ vựng'));
  right.appendChild(h('div', { class: 'card donut-wrap' }, W.donut(segs, String(vIds.length), 'từ'),
    h('div', { class: 'legend-rows' }, segs.map((s) => h('div', { style: { '--c': s.c } }, h('i'), s.label || '', h('b', null, String(s.v)), h('small', null, pct(s.v, vIds.length) + '%'))))));

  // ---------------- units
  main.appendChild(h('div', { class: 'sec-label', style: { marginTop: '30px' } }, 'Các Unit'));
  main.appendChild(h('div', { class: 'unit-row' }, D.units.map((u) => {
    const st = unitStats(u.id);
    const mini = (label: string, a: number, b: number) => h('div', null, h('span', null, label + ' ', h('b', null, a), '/' + b), h('div', { class: 'bar' }, h('i', { style: { width: pct(a, b) + '%' } })));
    return h('div', { class: 'card unit-tile', onclick: () => go(href('text', u.id)) },
      W.ring(st.overall),
      h('div', { class: 'un' }, 'Unit ' + u.id),
      h('div', { class: 'ut', lang: 'ja', html: ruby(u.title) }),
      h('div', { class: 'uv' }, u.titleVi),
      h('div', { class: 'unit-mini' }, mini('Từ', st.vLearn, st.vIds.length), mini('Kanji', st.kDone, st.kan.length), mini('Đề', st.qDone, st.quizzes.length)));
  })));

  const timer = setInterval(() => cd._paint(), 30000);
  return () => { clearInterval(timer); if (writer) writer.stop(); };
}

definePage(render);
