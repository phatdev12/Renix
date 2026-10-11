/* conjugate.ts — Japanese verb conjugation from the polite ます form.
   Works on both kana and kanji spellings because only the final kana of the
   stem changes (書きます → 書く, 見ます → 見る, 来ます → 来る/来ない). */

import type { Verb } from './types';
import { esc, ruby } from './text';
import { shuffle, uniq } from './util';

export type FormId = 'masu' | 'jisho' | 'nai' | 'ta' | 'te' | 'nakatta' | 'kanou' | 'kanouMasu';
type FormMap = Record<string, string>;

const ROW: Record<string, [string, string, string]> = { // い段 kana → [あ段, う段, え段]
  'い': ['わ', 'う', 'え'], 'き': ['か', 'く', 'け'], 'ぎ': ['が', 'ぐ', 'げ'], 'し': ['さ', 'す', 'せ'],
  'ち': ['た', 'つ', 'て'], 'に': ['な', 'ぬ', 'ね'], 'び': ['ば', 'ぶ', 'べ'], 'み': ['ま', 'む', 'め'], 'り': ['ら', 'る', 'れ'],
};
const TE: FormMap = { 'い': 'って', 'ち': 'って', 'り': 'って', 'み': 'んで', 'び': 'んで', 'に': 'んで', 'き': 'いて', 'ぎ': 'いで', 'し': 'して' };

export const FORMS: { id: FormId; jp: string; vi: string }[] = [
  { id: 'masu', jp: 'ます形', vi: 'Thể lịch sự' },
  { id: 'jisho', jp: '辞書形', vi: 'Thể từ điển (Vる)' },
  { id: 'nai', jp: 'ない形', vi: 'Thể phủ định (Vない)' },
  { id: 'ta', jp: 'た形', vi: 'Thể quá khứ (Vた)' },
  { id: 'te', jp: 'て形', vi: 'Thể て (Vて)' },
  { id: 'nakatta', jp: 'なかった形', vi: 'Quá khứ phủ định (Vなかった)' },
  { id: 'kanou', jp: '可能形', vi: 'Thể khả năng' },
  { id: 'kanouMasu', jp: '可能形（ます）', vi: 'Thể khả năng – lịch sự' },
];

function stemOf(masu: string) {
  if (!/ます$/.test(masu)) throw new Error('not a masu form: ' + masu);
  return masu.slice(0, -2);
}
export function conj(masu: string, group: number, form: string): string | null {
  const stem = stemOf(masu);
  const last = stem.slice(-1);
  const head = stem.slice(0, -1);
  if (form === 'masu') return masu;
  if (group === 3) {
    // する-verbs: …します ; 来る: 来ます / きます / 持って来ます
    if (/し$/.test(stem)) {
      let pre = stem.slice(0, -1);
      // potential: を → が （料理をします → 料理ができる）
      if ((form === 'kanou' || form === 'kanouMasu') && /を$/.test(pre)) pre = pre.slice(0, -1) + 'が';
      return pre + ({ jisho: 'する', nai: 'しない', ta: 'した', te: 'して', nakatta: 'しなかった', kanou: 'できる', kanouMasu: 'できます' } as FormMap)[form];
    }
    // 来る: kanji 来 keeps its character, kana き changes
    const pre = stem.slice(0, -1);
    const k = last === '来';
    const map: FormMap = k
      ? { jisho: '来る', nai: '来ない', ta: '来た', te: '来て', nakatta: '来なかった', kanou: '来られる', kanouMasu: '来られます' }
      : { jisho: 'くる', nai: 'こない', ta: 'きた', te: 'きて', nakatta: 'こなかった', kanou: 'こられる', kanouMasu: 'こられます' };
    return pre + map[form];
  }
  if (group === 2) {
    return stem + ({ jisho: 'る', nai: 'ない', ta: 'た', te: 'て', nakatta: 'なかった', kanou: 'られる', kanouMasu: 'られます' } as FormMap)[form];
  }
  // group 1
  const r = ROW[last];
  if (!r) throw new Error('bad group-1 stem: ' + masu);
  const iku = /(い|行)き$/.test(stem) && (stem === 'いき' || /行き$/.test(stem) || /ていき$/.test(stem));
  const aru = stem === 'あり';
  switch (form) {
    case 'jisho': return head + r[1];
    case 'nai': return aru ? 'ない' : head + r[0] + 'ない';
    case 'nakatta': return aru ? 'なかった' : head + r[0] + 'なかった';
    case 'te': return head + (iku ? 'って' : TE[last]);
    case 'ta': return head + (iku ? 'った' : TE[last].replace('て', 'た').replace('で', 'だ'));
    case 'kanou': return head + r[2] + 'る';
    case 'kanouMasu': return head + r[2] + 'ます';
  }
  return null;
}

// explanation of the rule used (Vietnamese) — shown after a drill answer
export function rule(v: Verb, form: string): string {
  const stem = v.m.slice(0, -2);
  const last = stem.slice(-1);
  const g = v.g;
  const gtxt = g === 1 ? 'Nhóm I' : g === 2 ? 'Nhóm II' : 'Nhóm III';
  const f = FORMS.find((x) => x.id === form);
  if (g === 3) {
    if (/来ます$|^きます$|てきます$/.test(v.k) && v.k !== '着ます') return `${gtxt} (来ます – bất quy tắc): くる・こない・きた・きて・こられる.`;
    return `${gtxt} (します – bất quy tắc): する・しない・した・して・できる.`;
  }
  if (g === 2) {
    const add = ({ jisho: 'る', nai: 'ない', ta: 'た', te: 'て', nakatta: 'なかった', kanou: 'られる', kanouMasu: 'られます' } as FormMap)[form];
    return `${gtxt}: bỏ ます rồi thêm 「${add}」.`;
  }
  const r = ROW[last];
  if (!r) return gtxt;
  const iku = /^(いき|もっていき)$/.test(stem);
  switch (form) {
    case 'jisho': return `${gtxt}: âm cuối hàng い → hàng う (${last}→${r[1]}).`;
    case 'nai': case 'nakatta': {
      if (stem === 'あり') return 'Đặc biệt: あります → ない (không phải あらない).';
      return `${gtxt}: âm cuối hàng い → hàng あ (${last}→${r[0]}) rồi thêm 「${form === 'nai' ? 'ない' : 'なかった'}」.` + (last === 'い' ? ' Lưu ý: い → わ (không phải あ): かいます → かわない.' : '');
    }
    case 'te': case 'ta': {
      if (iku) return `Đặc biệt: 行きます → 行${form === 'te' ? 'って' : 'った'} (không phải 行いて).`;
      const t = TE[last];
      const grp = ({ 'って': 'い・ち・り', 'んで': 'み・び・に', 'いて': 'き', 'いで': 'ぎ', 'して': 'し' } as FormMap)[t];
      const out = form === 'te' ? t : t.replace('て', 'た').replace('で', 'だ');
      return `${gtxt}: đuôi ${grp}ます → ${out}.`;
    }
    case 'kanou': case 'kanouMasu':
      return `${gtxt}: âm cuối hàng い → hàng え (${last}→${r[2]}) rồi thêm 「${form === 'kanou' ? 'る' : 'ます'}」.`;
  }
  return gtxt;
}

// all forms for a verb record {m, k, g}; returns {form: {kana, kanji}}
export type ConjTable = Record<string, { kana: string | null; kanji: string | null } | null>;
export function table(v: Verb & { nopot?: boolean }): ConjTable {
  const out: ConjTable = {};
  FORMS.forEach((f) => {
    if ((f.id === 'kanou' || f.id === 'kanouMasu') && v.nopot) { out[f.id] = null; return; }
    out[f.id] = { kana: conj(v.m, v.g, f.id), kanji: conj(v.k, v.g, f.id) };
  });
  return out;
}

// split a conjugated word into [unchanged part, changed ending] relative to the stem
export function splitEnding(masu: string, word: string): [string, string] {
  const stem = masu.slice(0, -2);
  let i = 0;
  while (i < stem.length - 1 && i < word.length && stem[i] === word[i]) i++;
  return [word.slice(0, i), word.slice(i)];
}


// ------------------------------------------------------------------ drill helpers
export const drillForms = FORMS.filter((f) => !['masu', 'kanouMasu'].includes(f.id));

/** ruby HTML of a conjugated word with the changed ending underlined (.end) */
export function stemRuby(v: Verb, word: string): string {
  const [a, b] = splitEnding(v.k, word);
  // reuse widget logic: ruby for the unchanged part
  const r = v.ruby || v.k;
  let out = '', len = 0;
  const re = /\{([^|{}]+)\|([^{}]+)\}|([^{}])/g; let m: RegExpExecArray | null;
  while ((m = re.exec(r)) && len < a.length) {
    if (m[1]) { if (len + m[1].length <= a.length) { out += m[0]; len += m[1].length; } else break; }
    else { out += m[3]; len += 1; }
  }
  const head = len === a.length ? ruby(out) : esc(a);
  return head + `<span class="end">${esc(b)}</span>`;
}

/** plausible wrong answers for a drill question (other group, other ending, other form) */
export function wrongForms(v: Verb, form: string): string[] {
  const right = conj(v.k, v.g, form);
  const cands: (string | null)[] = [];
  if (v.g !== 3) {
    const other = v.g === 1 ? 2 : 1;
    try { cands.push(conj(v.k, other, form)); } catch (e) { /* stem not valid for other group */ }
  }
  const stem = v.k.slice(0, -2);
  const head = stem.slice(0, -1);
  if (form === 'te' || form === 'ta') {
    const suf = form === 'te' ? ['って', 'んで', 'いて', 'して'] : ['った', 'んだ', 'いた', 'した'];
    suf.forEach((s) => cands.push((v.g === 1 ? head : stem) + s));
    cands.push(stem + (form === 'te' ? 'て' : 'た'));
  }
  if (form === 'nai' || form === 'nakatta') cands.push(stem + (form === 'nai' ? 'ない' : 'なかった'));
  if (form === 'kanou') { cands.push(stem + 'られる'); cands.push(stem + 'れる'); }
  if (form === 'jisho') { cands.push(stem + 'る'); cands.push(stem + 'う'); }
  drillForms.forEach((f) => { if (f.id !== form) { try { const x = conj(v.k, v.g, f.id); if (x) cands.push(x); } catch (e) { /* ignore */ } } });
  return shuffle(uniq(cands.filter((x): x is string => !!x && x !== right)));
}

