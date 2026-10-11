/* Course data filtered by the units the learner picked in the top bar. */
import { ALL_UNITS, UNITS, unitById } from './course';
import { Settings } from './store';
import type { Grammar, Kanji, Sentence, Unit, Vocab, WithUnit } from './types';

export type SentenceRef = Sentence & { u: number; si: number; pi: number; i: number; speaker: string };

export const D = {
  units: UNITS,
  unit: (id: number | string) => unitById(id) as Unit,
  sel(): number[] {
    const s = (Settings.get('units') || []).filter((u) => unitById(u));
    return (s.length ? s : ALL_UNITS).slice().sort((a, b) => a - b);
  },
  vocab(units?: number[]): WithUnit<Vocab>[] {
    const out: WithUnit<Vocab>[] = [];
    (units || D.sel()).forEach((u) => D.unit(u).vocab.forEach((v) => out.push(Object.assign({ u }, v))));
    return out;
  },
  kanji(units?: number[]): WithUnit<Kanji>[] {
    const out: WithUnit<Kanji>[] = [];
    (units || D.sel()).forEach((u) => D.unit(u).kanji.forEach((k) => out.push(Object.assign({ u }, k))));
    return out;
  },
  grammar(units?: number[]): WithUnit<Grammar>[] {
    const out: WithUnit<Grammar>[] = [];
    (units || D.sel()).forEach((u) => D.unit(u).grammar.forEach((g) => out.push(Object.assign({ u }, g))));
    return out;
  },
  kanjiInfo(c: string): WithUnit<Kanji> | null {
    for (const u of UNITS) { const k = u.kanji.find((x) => x.c === c); if (k) return Object.assign({ u: u.id }, k); }
    return null;
  },
  vocabById(id: string): WithUnit<Vocab> | null {
    const u = unitById(id.split('-')[0]);
    const v = u && u.vocab.find((x) => x.id === id);
    return u && v ? Object.assign({ u: u.id }, v) : null;
  },
  sentences(units?: number[]): SentenceRef[] {
    const out: SentenceRef[] = [];
    (units || D.sel()).forEach((u) => D.unit(u).sections.forEach((sec, si) => sec.paragraphs.forEach((p, pi) =>
      p.forEach((s, i) => out.push(Object.assign({ u, si, pi, i, speaker: sec.speaker }, s))))));
    return out;
  },
};
