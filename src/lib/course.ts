/* The course data (units, vocab, kanji, grammar, master texts) — static, bundled at build time. */
import raw from '../data/units.json';
import type { Course, Unit } from './types';

export const COURSE = raw as unknown as Course;
export const UNITS: Unit[] = COURSE.units;
export const ALL_UNITS: number[] = UNITS.map((u) => u.id);
const byId = new Map<number, Unit>(UNITS.map((u) => [u.id, u]));
export const unitById = (id: number | string) => byId.get(Number(id));
