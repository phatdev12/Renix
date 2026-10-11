/* Text helpers shared by server and client: ruby markup, kana conversion, answer matching. */
export const esc = (s: unknown) =>
  String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

// ------------------------------------------------------------------ ruby  {漢字|かんじ}
export const RUBY_RE = /\{([^|{}]+)\|([^{}]+)\}/g;
export const ruby = (s: unknown) => esc(s).replace(RUBY_RE, '<ruby>$1<rt>$2</rt></ruby>');
export const plain = (s: unknown) => String(s || '').replace(RUBY_RE, '$1');
export const reading = (s: unknown) => String(s || '').replace(RUBY_RE, '$2');
/** text for speech: keep kanji (natural prosody) but read number+counter groups as kana */
export const speechText = (s: unknown) =>
  String(s || '').replace(RUBY_RE, (_m, b: string, r: string) => (/[0-9０-９]/.test(b) ? r : b)).replace(/[➡→]/g, '、');

// ------------------------------------------------------------------ romaji → kana
const R2K: Record<string, string> = {
  a: 'あ', i: 'い', u: 'う', e: 'え', o: 'お',
  ka: 'か', ki: 'き', ku: 'く', ke: 'け', ko: 'こ', ga: 'が', gi: 'ぎ', gu: 'ぐ', ge: 'げ', go: 'ご',
  sa: 'さ', si: 'し', shi: 'し', su: 'す', se: 'せ', so: 'そ', za: 'ざ', zi: 'じ', ji: 'じ', zu: 'ず', ze: 'ぜ', zo: 'ぞ',
  ta: 'た', ti: 'ち', chi: 'ち', tu: 'つ', tsu: 'つ', te: 'て', to: 'と', da: 'だ', di: 'ぢ', du: 'づ', de: 'で', do: 'ど',
  na: 'な', ni: 'に', nu: 'ぬ', ne: 'ね', no: 'の', ha: 'は', hi: 'ひ', hu: 'ふ', fu: 'ふ', he: 'へ', ho: 'ほ',
  ba: 'ば', bi: 'び', bu: 'ぶ', be: 'べ', bo: 'ぼ', pa: 'ぱ', pi: 'ぴ', pu: 'ぷ', pe: 'ぺ', po: 'ぽ',
  ma: 'ま', mi: 'み', mu: 'む', me: 'め', mo: 'も', ya: 'や', yu: 'ゆ', yo: 'よ',
  ra: 'ら', ri: 'り', ru: 'る', re: 'れ', ro: 'ろ', wa: 'わ', wo: 'を', wi: 'うぃ', we: 'うぇ',
  kya: 'きゃ', kyu: 'きゅ', kyo: 'きょ', gya: 'ぎゃ', gyu: 'ぎゅ', gyo: 'ぎょ',
  sha: 'しゃ', shu: 'しゅ', sho: 'しょ', she: 'しぇ', sya: 'しゃ', syu: 'しゅ', syo: 'しょ',
  ja: 'じゃ', ju: 'じゅ', jo: 'じょ', je: 'じぇ', jya: 'じゃ', jyu: 'じゅ', jyo: 'じょ', zya: 'じゃ', zyu: 'じゅ', zyo: 'じょ',
  cha: 'ちゃ', chu: 'ちゅ', cho: 'ちょ', che: 'ちぇ', tya: 'ちゃ', tyu: 'ちゅ', tyo: 'ちょ', cya: 'ちゃ', cyu: 'ちゅ', cyo: 'ちょ',
  dya: 'ぢゃ', dyu: 'ぢゅ', dyo: 'ぢょ', nya: 'にゃ', nyu: 'にゅ', nyo: 'にょ', hya: 'ひゃ', hyu: 'ひゅ', hyo: 'ひょ',
  bya: 'びゃ', byu: 'びゅ', byo: 'びょ', pya: 'ぴゃ', pyu: 'ぴゅ', pyo: 'ぴょ', mya: 'みゃ', myu: 'みゅ', myo: 'みょ',
  rya: 'りゃ', ryu: 'りゅ', ryo: 'りょ', fa: 'ふぁ', fi: 'ふぃ', fe: 'ふぇ', fo: 'ふぉ', thi: 'てぃ', dhi: 'でぃ', tsa: 'つぁ',
  va: 'ゔぁ', vi: 'ゔぃ', vu: 'ゔ', ve: 'ゔぇ', vo: 'ゔぉ',
  xa: 'ぁ', xi: 'ぃ', xu: 'ぅ', xe: 'ぇ', xo: 'ぉ', la: 'ぁ', li: 'ぃ', lu: 'ぅ', le: 'ぇ', lo: 'ぉ',
  xya: 'ゃ', xyu: 'ゅ', xyo: 'ょ', lya: 'ゃ', lyu: 'ゅ', lyo: 'ょ', xtu: 'っ', ltu: 'っ', xtsu: 'っ', xwa: 'ゎ',
};
const PREFIXES = new Set<string>();
Object.keys(R2K).forEach((k) => { for (let i = 1; i < k.length; i++) PREFIXES.add(k.slice(0, i)); });
const PUNCT: Record<string, string> = { ',': '、', '.': '。', '-': 'ー', '?': '？', '!': '！', '[': '「', ']': '」', '~': '〜' };
// live=true keeps an unfinished tail (e.g. "n", "ky") unconverted
export function toHira(src: unknown, live?: boolean): string {
  const s = String(src);
  let out = '', i = 0;
  while (i < s.length) {
    const c = s[i].toLowerCase();
    if (!/[a-z]/.test(c)) { out += PUNCT[c] || s[i]; i++; continue; }
    const n1 = (s[i + 1] || '').toLowerCase();
    if (c === 'n') {
      if (n1 === 'n') { out += 'ん'; i += 2; continue; }
      if (n1 === "'") { out += 'ん'; i += 2; continue; }
      if (!n1) { if (live) { out += s[i]; i++; continue; } out += 'ん'; i++; continue; }
      if (!/[aiueoy]/.test(n1)) { out += 'ん'; i++; continue; }
    }
    if (c === n1 && /[bcdfghjkmpqrstvwxz]/.test(c)) { out += 'っ'; i++; continue; }
    let hit = false;
    for (let L = 4; L >= 1; L--) {
      const chunk = s.slice(i, i + L).toLowerCase();
      if (chunk.length === L && R2K[chunk]) { out += R2K[chunk]; i += L; hit = true; break; }
    }
    if (hit) continue;
    const rest = s.slice(i).toLowerCase();
    if (live && PREFIXES.has(rest)) { out += s.slice(i); break; }
    out += s[i]; i++;
  }
  return out;
}
export const kataToHira = (s: unknown) => String(s || '').replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
export const hiraToKata = (s: unknown) => String(s || '').replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));

// ------------------------------------------------------------------ comparing typed answers
export function normAns(s: unknown, loose?: boolean): string {
  let t = String(s == null ? '' : s).normalize('NFKC');
  t = t.replace(/[\s　]+/g, '');
  if (loose) {
    t = t.replace(/[。、．，,.!！?？「」『』・〜～ー\-]/g, '');
    t = kataToHira(t).toLowerCase();
  }
  return t;
}
export function sameAns(input: unknown, expected: unknown, loose?: boolean): boolean {
  const list = Array.isArray(expected) ? expected : [expected];
  const a = normAns(input, loose);
  return list.some((e) => e != null && normAns(e, loose) === a && a !== '');
}

// ------------------------------------------------------------------ distractor readings
// plausible wrong readings: long vowels, small っ, voicing, small ゃゅょ
const VOICE: Record<string, string> = { か: 'が', き: 'ぎ', く: 'ぐ', け: 'げ', こ: 'ご', さ: 'ざ', し: 'じ', す: 'ず', せ: 'ぜ', そ: 'ぞ', た: 'だ', ち: 'ぢ', つ: 'づ', て: 'で', と: 'ど', は: 'ば', ひ: 'び', ふ: 'ぶ', へ: 'べ', ほ: 'ぼ' };
const UNVOICE: Record<string, string> = {}; Object.keys(VOICE).forEach((k) => { UNVOICE[VOICE[k]] = k; });
export function confusables(r: string): string[] {
  const out = new Set<string>();
  for (let i = 0; i < r.length; i++) {
    const c = r[i], n = r[i + 1];
    if (n === 'う' && /[おこそとのほもよろごぞどぼぽょ]/.test(c)) out.add(r.slice(0, i + 1) + r.slice(i + 2));
    else if (/[こそとのほもよろごぞどぼょ]/.test(c) && n !== 'う') out.add(r.slice(0, i + 1) + 'う' + r.slice(i + 1));
    if (c === 'っ') out.add(r.slice(0, i) + 'つ' + r.slice(i + 1));
    if (c === 'つ' && i < r.length - 1) out.add(r.slice(0, i) + 'っ' + r.slice(i + 1));
    if (VOICE[c]) out.add(r.slice(0, i) + VOICE[c] + r.slice(i + 1));
    if (UNVOICE[c]) out.add(r.slice(0, i) + UNVOICE[c] + r.slice(i + 1));
    if (/[ゃゅょ]/.test(c)) out.add(r.slice(0, i) + ({ ゃ: 'や', ゅ: 'ゆ', ょ: 'よ' } as Record<string, string>)[c] + r.slice(i + 1));
  }
  out.delete(r);
  return Array.from(out);
}
