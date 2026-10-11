/* LMS question bank (large: imported only by the pages that need it). */
import raw from '../data/bank.json';
import { D } from './data';
import type { Quiz } from './types';

export const BANK = raw as unknown as Quiz[];
export const Bank = {
  all: BANK,
  list(units?: number[]): Quiz[] { const set = new Set(units || D.sel()); return BANK.filter((q) => set.has(q.unit)); },
  quiz(id: string | number): Quiz | undefined { return BANK.find((q) => q.id === String(id)); },
};
