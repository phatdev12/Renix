/* Question cards of the LMS bank (single, order/dragtext, blanks, matching, short).
   Shared by the bank player (bank.ts) and the mock exam (exam.ts) — a module without page side effects. */
import { h, esc, ic, kanaInput } from './dom';
import { sameAns, toHira } from './text';
import type { Question } from './types';
import { lightbox } from './ui';

export const PARTS: Record<number, string> = { 1: 'マスターテクスト', 2: 'ことば', 3: 'ぶんぽう', 4: 'かんじ', 5: 'エッセイ' };
export const TYPE_VI: Record<string, string> = { single: 'Trắc nghiệm', order: 'Sắp xếp câu', dragtext: 'Sắp xếp / điền', blanks: 'Điền vào chỗ trống', matching: 'Nối đáp án', short: 'Luyện gõ' };

/** a question as shown: bank data plus where it came from (mix / exam) */
export type Q = Question & { _src?: string; _part?: string; sec?: string };

export const keyed = (q: Q) => q.ans != null && !q.needs_audio;

type Field = HTMLInputElement | HTMLSelectElement;

// ------------------------------------------------------------------ helpers for answers
function slotValue(el: Field) { return el.tagName === 'SELECT' ? el.value : el.value.trim(); }
function blankExpected(q: Q, slot: string) {
  const a = q.ans && q.ans[String(slot)];
  return a == null ? null : a;
}
function confBadge(q: Q) {
  if (q.needs_audio) return h('span', { class: 'tag' }, ic('headphones'), 'câu nghe');
  if (q.verified) return h('span', { class: 'tag ok conf', title: 'Đáp án từ bài làm 10/10 trên LMS' }, ic('checkCircle'), 'xác nhận');
  if (q.ans == null) return h('span', { class: 'tag' }, 'chưa có đáp án');
  if (q.confidence === 'medium') return h('span', { class: 'tag warn conf', title: 'AI chưa chắc chắn hoàn toàn — xem ghi chú' }, 'tin cậy TB');
  if (q.confidence === 'low') return h('span', { class: 'tag bad conf' }, 'tin cậy thấp');
  return h('span', { class: 'tag pri conf', title: 'Đáp án do AI giải' }, 'tham khảo');
}

// ------------------------------------------------------------------ question renderers
/** check() → true / false / null (no key); reveal(res) shows the explanation */
export interface Renderer {
  el: HTMLElement;
  answered: () => boolean;
  check: () => boolean | null;
  reveal?: (res: boolean | null) => void;
  correctText?: () => string;
  state?: () => unknown;
  promptHandled?: boolean;
}

function qSingle(q: Q): Renderer {
  const box = h('div', { class: 'qopts' });
  let chosen: number | null = null;
  const btns = () => Array.from(box.children) as HTMLButtonElement[];
  (q.options || []).forEach((o, i) => box.appendChild(h('button', { class: 'opt', lang: 'ja', onclick: () => {
    if (box.dataset.locked) return;
    chosen = i;
    btns().forEach((b, j) => b.classList.toggle('sel', j === i));
    btns().forEach((b, j) => { b.style.borderColor = j === i ? 'var(--primary)' : ''; b.style.background = j === i ? 'var(--primary-soft)' : ''; });
  } }, h('span', { class: 'ok-key' }, 'ABCDEFG'[i]), h('span', { html: o }))));
  return {
    el: box,
    answered: () => chosen != null,
    check() {
      box.dataset.locked = '1';
      btns().forEach((b, j) => {
        b.disabled = true; b.style.borderColor = ''; b.style.background = '';
        if (q.ans != null && j === q.ans) b.classList.add('correct');
        else if (j === chosen) b.classList.add(q.ans == null ? 'dim' : 'wrong');
        else b.classList.add('dim');
        if (q.lms != null && j === q.lms) b.appendChild(h('span', { class: 'tag warn', style: { marginLeft: 'auto' } }, 'LMS chấm đúng'));
      });
      return q.ans == null ? null : chosen === q.ans;
    },
    state: () => chosen,
  };
}

function qOrder(q: Q): Renderer {
  const chips = q.chips || [];
  const wrap = h('div');
  if (q.image) {
    const src = q.image;
    wrap.appendChild(h('img', { src, class: 'q-img', style: { maxHeight: '300px', display: 'block', margin: '8px 0', borderRadius: '8px', background: '#fff', border: '1px solid var(--line)', cursor: 'zoom-in' }, onclick: () => lightbox(src) }));
  }
  const ans = h('div', { class: 'chips-ans', title: 'Bấm vào từ để bỏ ra' });
  const pool = h('div', { class: 'chips-pool' });
  const reuse = new Set(q.reuse || []);
  const picked: number[] = [];
  const need = q.type === 'dragtext' ? (q.nslots || (q.ans ? q.ans.length : chips.length)) : chips.length;
  function paint() {
    ans.innerHTML = '';
    if (!picked.length) ans.appendChild(h('span', { class: 'muted small', style: { alignSelf: 'center', padding: '0 6px' } }, 'Bấm các từ bên dưới theo thứ tự'));
    picked.forEach((ci, pos) => ans.appendChild(h('button', { class: 'wchip', lang: 'ja', onclick: () => { if (wrap.dataset.locked) return; picked.splice(pos, 1); paint(); } }, chips[ci])));
    pool.innerHTML = '';
    chips.forEach((c, ci) => pool.appendChild(h('button', { class: 'wchip' + (reuse.has(ci) ? ' reuse' : '') + (!reuse.has(ci) && picked.includes(ci) ? ' used' : ''), lang: 'ja', title: reuse.has(ci) ? 'Có thể dùng nhiều lần' : '',
      onclick: () => { if (wrap.dataset.locked || picked.length >= need) return; picked.push(ci); paint(); } }, c)));
  }
  paint();
  wrap.append(ans, h('div', { class: 'tiny muted', style: { margin: '6px 2px 4px' } }, need ? `${need} ô` + (reuse.size ? ' · viền nét đứt = dùng lại được' : '') : ''), pool);
  return {
    el: wrap,
    answered: () => picked.length > 0,
    check() {
      wrap.dataset.locked = '1';
      if (q.ans == null) return null;
      const a = (q.ans as number[]).map((i) => chips[i]).join('|');
      const b = picked.map((i) => chips[i]).join('|');
      const ok = a === b;
      ans.classList.add(ok ? 'ok' : 'bad');
      return ok;
    },
    correctText: () => (q.ans ? (q.ans as number[]).map((i) => chips[i]).join(' ／ ') : ''),
  };
}

function qBlanks(q: Q): Renderer {
  const choices: Record<string, { slot: number; choices?: string[] }> = {};
  (q.slotChoices || []).forEach((s) => { choices[s.slot] = s; });
  const parts = String(q.prompt || '').split('<hr class="qsep">');
  const hasInst = parts.length > 1 && parts[1].replace(/<[^>]+>/g, '').trim();
  const body = hasInst ? parts.slice(1).join('<hr class="qsep">') : q.prompt;
  const html = (hasInst ? `<div class="qinst">${parts[0]}</div>` : '') + body.replace(/\((\d+):\s*\.{5,}\s*\)|\[\[(\d+)\]\]/g, (_m, a, b) => `<span class="slot" data-slot="${a || b}"></span>`);
  const prompt = h('div', { class: 'qprompt', lang: 'ja', html });
  const inputs: Field[] = [];
  prompt.querySelectorAll<HTMLElement>('.slot').forEach((sp) => {
    const n = sp.dataset.slot!;
    const c = choices[n];
    let el: Field;
    if (c && c.choices) {
      el = h('select', { 'data-slot': n }, h('option', { value: '' }, '— ' + n + ' —'), c.choices.map((x) => h('option', { value: x }, x)));
    } else {
      el = h('input', { 'data-slot': n, placeholder: '(' + n + ')', size: '10' });
      kanaInput(el);
    }
    sp.appendChild(el);
    inputs.push(el);
  });
  return {
    el: prompt, promptHandled: true,
    answered: () => inputs.some((i) => slotValue(i)),
    check() {
      let any = false, all = true;
      inputs.forEach((el) => {
        el.disabled = true;
        const exp = blankExpected(q, el.dataset.slot!);
        if (exp == null) { return; }
        any = true;
        const v = slotValue(el);
        const list: unknown[] = ([] as unknown[]).concat(exp);
        const ok = !!v && (list.some((x) => sameAns(v, x, false)) || list.some((x) => sameAns(v, x, true))
          || list.some((x) => /^[a-z]+$/i.test(String(x)) && sameAns(v, toHira(String(x), false), true))
          || list.some((x) => String(x).toLowerCase() === 'x' && /^[x×✕]$/i.test(v)));
        el.classList.add(ok ? 'ok' : 'bad');
        if (!ok) all = false;
        el.parentNode!.appendChild(h('span', { class: 'exp', lang: 'ja' }, list.join(' / ')));
      });
      return q.needs_audio || !any ? null : all;
    },
  };
}

function qMatching(q: Q): Renderer {
  const t = h('table', { class: 'ctable', style: { marginTop: '8px' } });
  const sels: HTMLSelectElement[] = [];
  const sections = q.sections || [];
  sections.forEach((s) => {
    const sel = h('select', { class: 'input', style: { height: '34px', maxWidth: '100%' } }, h('option', { value: '' }, '— chọn —'), s.choices.map((c, j) => h('option', { value: String(j) }, c)));
    sels.push(sel);
    t.appendChild(h('tr', null, h('td', { class: 'jp', lang: 'ja', style: { whiteSpace: 'normal' } }, s.label), h('td', null, sel)));
  });
  return {
    el: h('div', { class: 'scroll-x' }, t),
    answered: () => sels.some((s) => s.value !== ''),
    check() {
      if (!Array.isArray(q.ans)) { sels.forEach((s) => { s.disabled = true; }); return null; }
      let all = true;
      sels.forEach((s, i) => {
        s.disabled = true;
        const exp = q.ans[i];
        if (exp == null) return;
        const ok = s.value === String(exp);
        s.classList.add(ok ? 'ok' : 'bad');
        if (!ok) { all = false; s.parentNode!.appendChild(h('div', { class: 'small', style: { color: 'var(--ok)' } }, '→ ' + sections[i].choices[exp])); }
      });
      return all;
    },
  };
}

function qShort(q: Q): Renderer {
  const ta = h('textarea', { class: 'input', rows: '2', style: { width: '100%', font: '18px/1.7 var(--font-jp)' }, placeholder: 'Gõ lại câu trong ảnh (romaji tự chuyển hiragana)…' });
  kanaInput(ta);
  return {
    el: ta,
    answered: () => !!ta.value.trim(),
    check() {
      ta.disabled = true;
      if (q.ans == null) return null;
      const ok = sameAns(ta.value, q.ans, false) || sameAns(ta.value, q.ans, true);
      ta.classList.add(ok ? 'ok' : 'bad');
      return ok;
    },
  };
}

export interface QItem { card: HTMLElement; r: Renderer & { reveal: (res: boolean | null) => void }; q: Q; done?: boolean | null }

export function questionCard(q: Q, n: number, _partTitle: string, o?: { source?: string }): QItem {
  const opts = o || {};
  const card = h('div', { class: 'card qcard', id: 'q-' + n });
  card.appendChild(h('div', { class: 'qhead' }, h('span', { class: 'qn' }, n), h('span', { class: 'tag' }, TYPE_VI[q.type] || q.type), confBadge(q),
    opts.source ? h('span', { class: 'tag', lang: 'ja' }, opts.source) : null));
  let r: Renderer;
  if (q.type === 'blanks') r = qBlanks(q);
  else {
    const parts = String(q.prompt || '').split('<hr class="qsep">');
    if (parts.length > 1 && parts[1].replace(/<[^>]+>/g, '').trim()) {
      card.appendChild(h('div', { class: 'qinst', lang: 'ja', html: parts[0] }));
      card.appendChild(h('div', { class: 'qprompt', lang: 'ja', html: parts.slice(1).join('<hr class="qsep">') }));
    } else card.appendChild(h('div', { class: 'qprompt', lang: 'ja', html: q.prompt || '' }));
    r = q.type === 'single' ? qSingle(q) : q.type === 'matching' ? qMatching(q) : (q.type === 'order' || q.type === 'dragtext') ? qOrder(q) : qShort(q);
  }
  card.appendChild(r.el);
  card.querySelectorAll<HTMLImageElement>('.qprompt img').forEach((img) => { img.onclick = () => lightbox(img.src); });
  const fb = h('div');
  card.appendChild(fb);
  r.reveal = (res) => {
    fb.innerHTML = '';
    const cls = res === true ? 'ok' : res === false ? 'bad' : '';
    const parts: (Node | string)[] = [];
    if (res === true) parts.push(h('span', { class: 'ex-t' }, ic('checkCircle'), 'Đúng'), '  ');
    else if (res === false) parts.push(h('span', { class: 'ex-t' }, ic('xCircle'), 'Chưa đúng'), '  ');
    if (q.type === 'single' && q.ans != null && res === false) parts.push(h('span', null, '· Đáp án: ', h('b', { lang: 'ja', html: String(q.options![q.ans]).replace(/<\/?p>/g, ' ').trim() })));
    if ((q.type === 'order' || q.type === 'dragtext') && q.ans) parts.push(h('div', { lang: 'ja' }, 'Đáp án: ', h('b', null, r.correctText!())));
    if (q.sentence) parts.push(h('div', { lang: 'ja' }, '→ ', h('b', null, q.sentence)));
    if (q.type === 'short' && q.ans) parts.push(h('div', { lang: 'ja' }, 'Câu đúng: ', h('b', null, q.ans)));
    if (q.explain) parts.push(h('div', { html: esc(q.explain), style: { marginTop: '4px' } }));
    if (q.note && !q.needs_audio) parts.push(h('div', { class: 'small muted', style: { marginTop: '6px', display: 'flex', gap: '6px' } }, ic('pin'), h('span', null, q.note)));
    if (q.needs_audio) parts.push(h('div', { class: 'small muted', style: { display: 'flex', gap: '6px' } }, ic('headphones'), h('span', null, 'Câu nghe — không có đáp án, hãy nghe audio rồi tự đối chiếu.')));
    if (!parts.length) return;
    fb.appendChild(h('div', { class: 'explain ' + cls }, parts));
  };
  return { card, r: r as QItem['r'], q };
}
