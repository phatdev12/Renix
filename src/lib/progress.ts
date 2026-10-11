/* Learning records in localStorage: SRS boxes for vocab, starred items, kanji/quiz/exam results. */
import { Store } from './store';
import { pct } from './util';

export interface SrsRec { b: number; ok: number; ng: number; due: number; seen: number }
export interface KanjiRec { n: number; best: number | null; last: number; lastMis: number }
export interface QuizRec { n: number; best: number; last: number; lastPct: number }
export interface ExamRec { score: number; total: number; [k: string]: any }

// ------------------------------------------------------------------ SRS (Leitner boxes)
const DAY = 864e5;
const INTERVALS = [0, 0.4 * DAY, 1 * DAY, 3 * DAY, 7 * DAY, 16 * DAY];
export const SRS = {
  all(): Record<string, SrsRec> { return Store.get('srs', {}); },
  get(id: string): SrsRec | null { return this.all()[id] || null; },
  box(id: string): number { const r = this.get(id); return r ? r.b : 0; },
  grade(id: string, good: boolean): SrsRec {
    return Store.update<Record<string, SrsRec>>('srs', (all) => {
      const r = all[id] || ({ b: 0, ok: 0, ng: 0 } as SrsRec);
      if (good) { r.b = Math.min(5, (r.b || 0) + 1); r.ok = (r.ok || 0) + 1; }
      else { r.b = 1; r.ng = (r.ng || 0) + 1; }
      r.due = Date.now() + (good ? INTERVALS[r.b] : 5 * 60 * 1000);
      r.seen = Date.now();
      all[id] = r;
      return all;
    }, {})[id];
  },
  isDue(id: string) { const r = this.get(id); return !!r && r.due <= Date.now(); },
  dueList(ids: string[]) { const all = this.all(), now = Date.now(); return ids.filter((id) => all[id] && all[id].due <= now); },
  newList(ids: string[]) { const all = this.all(); return ids.filter((id) => !all[id]); },
  learned(ids: string[]) { const all = this.all(); return ids.filter((id) => all[id] && all[id].b >= 3).length; },
};

// ------------------------------------------------------------------ starred items
export const Star = {
  all(): Record<string, number> { return Store.get('star', {}); },
  has(id: string) { return !!this.all()[id]; },
  toggle(id: string) {
    return !!Store.update<Record<string, number>>('star', (s) => { if (s[id]) delete s[id]; else s[id] = Date.now(); return s; }, {})[id];
  },
};

// ------------------------------------------------------------------ progress records
export const Prog = {
  kanji(c: string): KanjiRec | null { return Store.get<Record<string, KanjiRec>>('kanji', {})[c] || null; },
  saveKanji(c: string, mistakes: number) {
    Store.update<Record<string, KanjiRec>>('kanji', (all) => {
      const r = all[c] || ({ n: 0, best: null } as KanjiRec);
      r.n += 1; r.last = Date.now(); r.lastMis = mistakes;
      r.best = r.best == null ? mistakes : Math.min(r.best, mistakes);
      all[c] = r; return all;
    }, {});
  },
  kanjiLevel(c: string) { const r = Prog.kanji(c); if (!r) return 0; return r.best === 0 ? 2 : 1; },
  quiz(id: string): QuizRec | null { return Store.get<Record<string, QuizRec>>('bank', {})[id] || null; },
  saveQuiz(id: string, ok: number, total: number) {
    Store.update<Record<string, QuizRec>>('bank', (all) => {
      const r = all[id] || ({ n: 0, best: 0 } as QuizRec);
      const p = pct(ok, total);
      r.n += 1; r.last = Date.now(); r.lastPct = p; r.best = Math.max(r.best, p);
      all[id] = r; return all;
    }, {});
  },
  addExam(rec: ExamRec) { Store.update<ExamRec[]>('exam', (a) => { a.push(rec); return a.slice(-50); }, []); },
  exams(): ExamRec[] { return Store.get('exam', []); },
  conj(form: string, ok: boolean) {
    Store.update<any>('conj', (c) => {
      c.n = (c.n || 0) + 1; c.ok = (c.ok || 0) + (ok ? 1 : 0);
      c.f = c.f || {}; const f = c.f[form] || { n: 0, ok: 0 }; f.n++; if (ok) f.ok++; c.f[form] = f;
      return c;
    }, {});
  },
  tally(kind: string, ok: boolean) {
    Store.update<Record<string, { n: number; ok: number }>>('tally', (t) => { const r = t[kind] || { n: 0, ok: 0 }; r.n++; if (ok) r.ok++; t[kind] = r; return t; }, {});
  },
};
