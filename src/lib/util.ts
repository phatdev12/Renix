/* Small generic helpers. */
export const shuffle = <T>(a: readonly T[]): T[] => {
  const r = a.slice();
  for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; }
  return r;
};
export const sample = <T>(a: readonly T[], n: number): T[] => shuffle(a).slice(0, n);
export const pick = <T>(a: readonly T[]): T => a[Math.floor(Math.random() * a.length)];
export const uniq = <T>(a: Iterable<T>): T[] => Array.from(new Set(a));
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const debounce = <A extends any[]>(fn: (...a: A) => void, ms: number) => {
  let t: ReturnType<typeof setTimeout>;
  return (...a: A) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
};
export const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
export const fmtDate = (ts: number) => {
  const d = new Date(ts);
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' + d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
};
export const fmtTime = (s: number) => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
