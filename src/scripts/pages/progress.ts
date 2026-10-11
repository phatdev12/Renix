/* Tiến độ — statistics, backup/restore */
import { BANK } from '../../lib/bank';
import * as C from '../../lib/conjugate';
import { ALL_UNITS } from '../../lib/course';
import { D } from '../../lib/data';
import { A, B, h, ic } from '../../lib/dom';
import type { Child } from '../../lib/dom';
import { definePage, rerender } from '../../lib/page';
import { Prog, SRS } from '../../lib/progress';
import type { KanjiRec } from '../../lib/progress';
import { href } from '../../lib/routes';
import { Store } from '../../lib/store';
import { toast } from '../../lib/ui';
import { fmtDate, pct } from '../../lib/util';
import * as W from '../../lib/widgets';

const uTag = W.uTag;
const LEVEL_C = ['var(--g0)', 'var(--g5)', 'var(--g4)', 'var(--g3)', 'var(--g2)', 'var(--g1)'];
const LEVEL_N = ['Chưa học', 'Mức 1', 'Mức 2', 'Mức 3', 'Mức 4', 'Mức 5'];

function kpi(icon: string, color: string, label: string, big: string, small: string, foot: Child) {
  return h('div', { class: 'card kpi', style: { '--c': color } }, h('div', { class: 'kpi-l' }, ic(icon), label),
    h('div', { class: 'kpi-v' }, h('b', null, big), small ? h('small', null, small) : null), foot);
}

function render(main: HTMLElement) {
  main.appendChild(W.pageHead('Tiến độ', 'きろく'));
  const units = ALL_UNITS;
  const vAll = D.vocab(units).map((v) => v.id);
  const kAll = D.kanji(units);
  const bank = BANK;
  const vLearn = SRS.learned(vAll);
  const kDone = kAll.filter((k) => Prog.kanji(k.c)).length;
  const kPerfect = kAll.filter((k) => Prog.kanjiLevel(k.c) === 2).length;
  const done = bank.filter((q) => Prog.quiz(q.id));
  const avgBest = done.length ? Math.round(done.reduce((s, q) => s + Prog.quiz(q.id)!.best, 0) / done.length) : 0;
  const exams = Prog.exams();
  const bestExam = exams.length ? Math.max(...exams.map((x) => pct(x.score, x.total))) : null;

  main.appendChild(h('div', { class: 'kpi-row' },
    kpi('cards', 'var(--u13)', 'Từ đã thuộc', String(vLearn), '/' + vAll.length, h('div', { class: 'kpi-f' }, h('div', { class: 'bar' }, h('i', { style: { width: pct(vLearn, vAll.length) + '%' } })), pct(vLearn, vAll.length) + '%')),
    kpi('brush', 'var(--accent)', 'Kanji đã viết', String(kDone), '/' + kAll.length, h('div', { class: 'kpi-f' }, h('div', { class: 'bar acc' }, h('i', { style: { width: pct(kDone, kAll.length) + '%' } })), kPerfect + ' hoàn hảo')),
    kpi('clipboard', 'var(--cyan)', 'Đề đã làm', String(done.length), '/' + bank.length, h('div', { class: 'kpi-f' }, h('div', { class: 'bar' }, h('i', { style: { width: pct(done.length, bank.length) + '%' } })), 'TB ' + avgBest + '%')),
    kpi('timer', 'var(--u17)', 'Thi thử', String(exams.length), 'lần', h('div', { class: 'kpi-f' }, bestExam == null ? 'Chưa thi' : 'Cao nhất ' + bestExam + '%'))));

  // vocab levels per unit
  const vc = h('div', { class: 'card' }, h('h3', null, ic('cards'), 'Ghi nhớ từ vựng'));
  const vb = h('div', { class: 'u-bars' });
  units.forEach((u) => {
    const ids = D.unit(u).vocab.map((v) => v.id);
    const cnt = [0, 0, 0, 0, 0, 0];
    ids.forEach((id) => { cnt[SRS.box(id)]++; });
    vb.appendChild(h('div', { class: 'u-bar' }, uTag(u),
      h('div', { class: 'stack' }, cnt.map((c, b) => c ? h('i', { title: `${LEVEL_N[b]}: ${c} từ`, style: { width: (c / ids.length) * 100 + '%', background: LEVEL_C[b] } }) : null)),
      h('span', { class: 'v' }, h('b', null, String(SRS.learned(ids))), '/' + ids.length + ' thuộc')));
  });
  vc.append(vb, h('div', { class: 'legend', style: { marginTop: '14px' } }, LEVEL_N.map((t, i) => h('span', { class: 'sw', style: { '--c': LEVEL_C[i] } }, t))));

  // kanji per unit
  const kc = h('div', { class: 'card' }, h('h3', null, ic('brush'), 'Luyện viết Kanji'));
  const kb = h('div', { class: 'u-bars' });
  units.forEach((u) => {
    const ks = D.unit(u).kanji;
    const d = ks.filter((k) => Prog.kanji(k.c)).length;
    const pf = ks.filter((k) => Prog.kanjiLevel(k.c) === 2).length;
    kb.appendChild(h('div', { class: 'u-bar' }, uTag(u),
      h('div', { class: 'stack' }, pf ? h('i', { title: pf + ' chữ viết hoàn hảo', style: { width: (pf / ks.length) * 100 + '%', background: 'var(--g1)' } }) : null,
        d - pf ? h('i', { title: (d - pf) + ' chữ đã luyện', style: { width: ((d - pf) / ks.length) * 100 + '%', background: 'var(--g3)' } }) : null),
      h('span', { class: 'v' }, h('b', null, String(d)), '/' + ks.length + ' · ' + pf + ' ✓')));
  });
  kc.append(kb, h('div', { class: 'legend', style: { marginTop: '14px' } }, h('span', { class: 'sw', style: { '--c': 'var(--g1)' } }, 'Hoàn hảo'), h('span', { class: 'sw', style: { '--c': 'var(--g3)' } }, 'Đã luyện')));
  const weak = Object.entries(Store.get<Record<string, KanjiRec>>('kanji', {})).filter(([, r]) => r.lastMis > 0).sort((a, b) => b[1].lastMis - a[1].lastMis).slice(0, 12);
  if (weak.length) kc.append(h('div', { class: 'glabel' }, 'Hay viết sai'), h('div', { class: 'weak-list' }, weak.map(([c, r]) => h('a', { href: href('write', c), title: 'Luyện lại' }, h('b', { lang: 'ja' }, c), h('span', null, '−' + r.lastMis)))));

  // quizzes
  const qc = h('div', { class: 'card' }, h('h3', null, ic('clipboard'), 'Đề luyện LMS', h('span', { class: 'spacer' }), h('span', { class: 'small muted num' }, done.length + '/' + bank.length)));
  if (!done.length) qc.appendChild(h('div', { class: 'ch-empty' }, 'Chưa làm bài nào', A('sm primary', 'play', 'Làm bài', href('bank'))));
  else {
    const t = h('table', { class: 'vtable' }, h('tr', null, h('th', null, 'Bài'), h('th', null, 'Tốt nhất'), h('th', null, 'Lần'), h('th', null, 'Gần nhất')));
    done.forEach((q) => { const r = Prog.quiz(q.id)!; t.appendChild(h('tr', null, h('td', { lang: 'ja' }, h('a', { href: href('bank', q.id) }, q.name)), h('td', null, h('span', { class: 'best ' + (r.best >= 80 ? 'ok' : r.best >= 50 ? 'warn' : 'bad') }, r.best + '%')), h('td', { class: 'num' }, r.n), h('td', { class: 'small muted num' }, fmtDate(r.last)))); });
    qc.appendChild(h('div', { class: 'scroll-x' }, t));
  }

  // misc stats
  const tally: Record<string, { n: number; ok: number }> = Store.get('tally', {});
  const conj: { n?: number; ok?: number; f?: Record<string, { n: number; ok: number }> } = Store.get('conj', {});
  const sc = h('div', { class: 'card' }, h('h3', null, ic('chart'), 'Trắc nghiệm & thi thử'),
    h('div', { class: 'grid-3' },
      h('div', { class: 'stat' }, h('b', null, tally.vocab ? pct(tally.vocab.ok, tally.vocab.n) + '%' : '—'), h('span', null, 'Từ vựng' + (tally.vocab ? ` · ${tally.vocab.n} câu` : ''))),
      h('div', { class: 'stat' }, h('b', null, tally.kanji ? pct(tally.kanji.ok, tally.kanji.n) + '%' : '—'), h('span', null, 'Kanji' + (tally.kanji ? ` · ${tally.kanji.n} câu` : ''))),
      h('div', { class: 'stat' }, h('b', null, conj.n ? pct(conj.ok || 0, conj.n) + '%' : '—'), h('span', null, 'Chia động từ' + (conj.n ? ` · ${conj.n} câu` : '')))));
  if (conj.f) {
    sc.appendChild(h('div', { class: 'glabel' }, 'Theo thể'));
    sc.appendChild(h('div', { class: 'row', style: { gap: '6px' } }, Object.entries(conj.f).map(([f, r]) => { const fm = C.FORMS.find((x) => x.id === f); return h('span', { class: 'tag ' + (pct(r.ok, r.n) >= 80 ? 'ok' : pct(r.ok, r.n) >= 50 ? 'warn' : 'bad'), lang: 'ja' }, (fm ? fm.jp : f) + ' ' + pct(r.ok, r.n) + '%'); })));
  }
  if (exams.length) {
    sc.appendChild(h('div', { class: 'glabel' }, 'Thi thử'));
    sc.appendChild(W.lineChart(exams.slice(-10).map((x) => { const d = new Date(x.ts); return { v: pct(x.score, x.total), label: d.getDate() + '/' + (d.getMonth() + 1), title: fmtDate(x.ts) + ' · ' + x.score + '/' + x.total + ' · Unit ' + x.units.join(', ') }; })));
  }

  // data
  const dc = h('div', { class: 'card' }, h('h3', null, ic('database'), 'Dữ liệu học tập', W.infoTip('Tiến độ lưu trong trình duyệt trên máy này (localStorage). Nên sao lưu trước khi xoá dữ liệu trình duyệt hoặc đổi máy.')),
    h('div', { class: 'row' },
      B('', 'download', 'Sao lưu', exportData, { title: 'Tải file .json' }),
      h('label', { class: 'btn' }, ic('upload'), 'Khôi phục', h('input', { type: 'file', accept: '.json,application/json', hidden: true, onchange: importData })),
      h('span', { class: 'spacer' }),
      B('bad', 'trash', 'Xoá tiến độ', resetData)));

  main.append(h('div', { class: 'grid-2' }, vc, kc), h('div', { class: 'grid-2', style: { marginTop: '16px' } }, qc, sc), h('div', { style: { marginTop: '16px' } }, dc));
  main.appendChild(h('div', { class: 'foot-note' }, 'Nội dung: lớp M3 – N4 Tiếng Nhật cơ sở 2 (digital.nix.edu.vn) · Thứ tự nét: KanjiVG © Ulrich Apel (CC BY-SA 3.0)'));
}

function exportData() {
  const data = { app: 'nix-review', ts: Date.now(), data: Store.dump() };
  const b = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
  const a = h('a', { href: URL.createObjectURL(b), download: 'on-tap-tieng-nhat-tien-do-' + new Date().toISOString().slice(0, 10) + '.json' });
  document.body.appendChild(a); a.click(); a.remove();
}
function importData(e: Event) {
  const input = e.target as HTMLInputElement;
  const f = input.files && input.files[0];
  if (!f) return;
  const rd = new FileReader();
  rd.onload = () => {
    try {
      const obj = JSON.parse(String(rd.result));
      if (obj.app !== 'nix-review' || !obj.data) throw new Error('File không đúng định dạng');
      if (!window.confirm('Ghi đè tiến độ hiện tại bằng dữ liệu trong file?')) return;
      Object.entries(obj.data as Record<string, string>).forEach(([k, v]) => localStorage.setItem(k, v));
      toast('Đã khôi phục tiến độ'); location.reload();
    } catch (err) { toast('Không đọc được file: ' + (err as Error).message, 4000); }
  };
  rd.readAsText(f);
}
function resetData() {
  if (!window.confirm('Xoá toàn bộ tiến độ học (thẻ từ, kanji, điểm bài làm…)? Không hoàn tác được.')) return;
  Object.keys(Store.dump()).forEach((k) => { if (k !== 'nix.settings') localStorage.removeItem(k); });
  toast('Đã xoá tiến độ'); rerender();
}

definePage(render);
