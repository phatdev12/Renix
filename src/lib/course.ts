/* The course data (units, vocab, kanji, grammar, master texts) — static, bundled at build time. */
import raw from '../data/units.json';
import seRaw from '../data/se.json';
import type { Course, CourseInfo, SeUnit, Unit } from './types';

export const COURSE = raw as unknown as Course;
export const UNITS: Unit[] = COURSE.units;
export const ALL_UNITS: number[] = UNITS.map((u) => u.id);
/** the courses the units come from, in order (N5 Unit 1–12, N4 Unit 13–17) */
export const COURSES: CourseInfo[] = COURSE.courses;
const byId = new Map<number, Unit>(UNITS.map((u) => [u.id, u]));
export const unitById = (id: number | string) => byId.get(Number(id));
export const courseOf = (unit: number | string): CourseInfo | undefined => {
  const u = unitById(unit);
  return u && COURSES.find((c) => c.key === u.course);
};
/** bài đọc chuyên ngành (M17), Unit 13–18 */
export const SE: SeUnit[] = seRaw as unknown as SeUnit[];
export const seById = (id: number | string) => SE.find((s) => s.id === Number(id));
