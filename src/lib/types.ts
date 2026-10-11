/* Shapes of the generated study data (src/data/*.json, written by tools/scripts/build.py). */

export interface Reading { t: string; rare?: boolean }

export interface Vocab {
  id: string;
  kana: string;
  kanji: string;
  ruby: string;
  vi: string;
  pre: string;
  note: string;
}

export interface KanjiExample { w: string; r: string; vi: string; ruby: string; rare?: boolean }

export interface Kanji {
  c: string;
  list: string;
  hv: Reading[];
  on: Reading[];
  kun: Reading[];
  meaning: string;
  ex: KanjiExample[];
  strokes: number;
  fix?: string;
}

export interface Example { jp: string; vi: string; src?: string }

export interface Grammar {
  id: string;
  no: string;
  group: string;
  title: string;
  sub?: string;
  meaning: string;
  usage: string[];
  formulas: string[];
  examples: Example[];
  extra?: string[];
  notes?: string[];
  table?: string;
  video?: string;
  videoTitle?: string;
  fix?: string;
  diagram?: string;
  focus?: string;
}

export interface Sentence { jp: string; vi: string; sh?: boolean }

export interface Section {
  speaker: string;
  heading?: string;
  headingVi?: string;
  paragraphs: Sentence[][];
}

export interface Guide { speaker: string; label: string; pages: string[] }

export interface Essay { title: string; vi: string; use: string[]; ideas: string[] }

export interface Unit {
  id: number;
  title: string;
  titleVi: string;
  titleNote?: string | null;
  sections: Section[];
  videos: Record<string, string>;
  guides: Guide[];
  pdfs: Record<string, string>;
  pdfPages: Record<string, string[]>;
  vocab: Vocab[];
  grammar: Grammar[];
  kanji: Kanji[];
  essay: Essay;
}

export interface Speaker { name: string; vi: string }

export interface Course {
  built: string;
  course: { name: string; book: string; source: string };
  speakers: Record<string, Speaker>;
  units: Unit[];
  model: { title: string; label: string; paragraphs: string[] };
}

/** One question of an LMS quiz (several types share the record). */
export interface Question {
  n: number;
  type: 'single' | 'blanks' | 'matching' | 'dragtext' | 'order' | 'short' | string;
  key: string;
  prompt: string;
  options?: string[];
  ans?: any;
  explain?: string;
  confidence?: string;
  verified?: boolean;
  note?: string;
  lms?: any;
  slots?: number[];
  slotChoices?: { slot: number; short?: boolean; choices?: string[] }[];
  needs_audio?: boolean;
  sections?: { label: string; choices: string[] }[];
  chips?: string[];
  reuse?: number[];
  nslots?: number;
  sentence?: string;
  image?: string;
}

export interface QuizPart { title: string; questions: Question[] }

export interface Quiz {
  id: string;
  unit: number;
  part: number;
  lesson: string;
  name: string;
  kind: string;
  parts: QuizPart[];
}

export interface Verb { m: string; k: string; g: number; vi: string; ruby: string; u?: number }

export interface StrokeData { s: string[]; n: [number, number][] }

/** Items flattened across units carry their unit id. */
export type WithUnit<T> = T & { u: number };
