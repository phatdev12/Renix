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
  /** from the LMS "bảng từ vựng mở rộng" (extended list) */
  ext?: boolean;
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
  /** course key: 'n5' (M2, Unit 1–12) or 'n4' (M3, Unit 13–17) */
  course: string;
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
  /** sample essay of this unit (only some units) */
  model?: ModelEssay;
}

export interface ModelEssay { title: string; label: string; paragraphs: string[] }

export interface CourseInfo { key: string; name: string; short: string; level: string; book: string; units: number[] }

export interface Speaker { name: string; vi: string }

export interface Course {
  built: string;
  course: { name: string; book: string; source: string };
  courses: CourseInfo[];
  speakers: Record<string, Speaker>;
  units: Unit[];
}

/** Bài đọc chuyên ngành (M17 – SE readings), src/data/se.json */
export interface SeVocab { w: string; r: string; hv: string; vi: string; ruby: string }
export interface SeSection { speaker: string; paragraphs: Sentence[][] }
export interface SeUnit {
  id: number;
  heading: string;
  headingVi: string;
  intro: Sentence;
  sections: SeSection[];
  vocab: SeVocab[];
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
