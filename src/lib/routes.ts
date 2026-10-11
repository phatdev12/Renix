/* Site map: the sections of the rail and URL helpers (shared by Astro components and client code). */

export interface NavItem { key: string; icon: string; label: string; jp: string }

export const NAV: NavItem[] = [
  { key: '', icon: 'home', label: 'Tổng quan', jp: 'ホーム' },
  { key: 'text', icon: 'book', label: 'Bài khóa', jp: 'ほんぶん' },
  { key: 'vocab', icon: 'cards', label: 'Từ vựng', jp: 'ことば' },
  { key: 'grammar', icon: 'puzzle', label: 'Ngữ pháp', jp: 'ぶんぽう' },
  { key: 'kanji', icon: 'kanji', label: 'Kanji', jp: 'かんじ' },
  { key: 'write', icon: 'brush', label: 'Tập viết', jp: 'かく' },
  { key: 'conj', icon: 'repeat', label: 'Động từ', jp: 'どうし' },
  { key: 'bank', icon: 'clipboard', label: 'Đề luyện', jp: 'ドリル' },
  { key: 'exam', icon: 'timer', label: 'Thi thử', jp: 'しけん' },
  { key: 'essay', icon: 'edit', label: 'Viết luận', jp: 'さくぶん' },
  { key: 'progress', icon: 'chart', label: 'Tiến độ', jp: 'きろく' },
];

export const navItem = (key: string) => NAV.find((n) => n.key === key) || NAV[0];

/** href('bank', 2026) → "/bank/2026/", href() → "/", href('vocab', { focus: '13-1' }) → "/vocab/?focus=13-1" */
export function href(...parts: (string | number | Record<string, string | number> | null | undefined)[]): string {
  let q = '';
  const segs: string[] = [];
  for (const p of parts) {
    if (p == null || p === '') continue;
    if (typeof p === 'object') {
      const sp = new URLSearchParams();
      for (const k in p) if (p[k] != null && p[k] !== '') sp.set(k, String(p[k]));
      const s = sp.toString();
      if (s) q = '?' + s;
    } else segs.push(encodeURIComponent(String(p)));
  }
  return '/' + segs.map((s) => s + '/').join('') + q;
}

/** navigate to another page of the site */
export function go(url: string) { location.href = url; }
