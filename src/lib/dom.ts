/* Tiny DOM builders used by the client-rendered parts of every page. */
import { iconSvg } from './icons';
import { esc, ruby, toHira } from './text';

export type Child = Node | string | number | null | undefined | false | Child[];
export type Attrs = Record<string, any> | null;

export function append<T extends Node>(el: T, kids: Child[]): T {
  for (const k of (kids as any[]).flat(Infinity)) {
    if (k == null || k === false || k === '') continue;
    el.appendChild(k instanceof Node ? k : document.createTextNode(String(k)));
  }
  return el;
}

/** h('div', { class, style: {...}, onclick, dataset, html }, ...children) */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs?: Attrs, ...kids: Child[]): HTMLElementTagNameMap[K];
export function h(tag: string, attrs?: Attrs, ...kids: Child[]): HTMLElement;
export function h(tag: string, attrs?: Attrs, ...kids: Child[]): HTMLElement {
  const el = document.createElement(tag);
  if (attrs) {
    for (const k in attrs) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') {
        for (const p in v) {
          if (p.slice(0, 2) === '--') el.style.setProperty(p, v[p]);
          else (el.style as any)[p] = v[p];
        }
      } else if (k === 'html') el.innerHTML = v;
      else if (k === 'text') el.textContent = v;
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    }
  }
  return append(el, kids);
}

export const $ = <T extends Element = HTMLElement>(s: string, r?: ParentNode) => (r || document).querySelector(s) as T;
export const $$ = <T extends Element = HTMLElement>(s: string, r?: ParentNode) => Array.from((r || document).querySelectorAll(s)) as T[];

export { esc };

const tpl = typeof document !== 'undefined' ? document.createElement('template') : null;
/** An <svg class="ic"> element. */
export function ic(name: string, cls?: string): SVGElement {
  tpl!.innerHTML = iconSvg(name, cls);
  return tpl!.content.firstChild as SVGElement;
}

/** <button class="btn …"> with an optional leading icon */
export const B = (cls: string, icon: string | null, label: Child, onclick?: ((e: MouseEvent) => void) | null, extra?: Attrs) =>
  h('button', Object.assign({ class: 'btn ' + (cls || ''), type: 'button', onclick }, extra || {}), icon ? ic(icon) : null, label);

/** same look, as a link */
export const A = (cls: string, icon: string | null, label: Child, href: string, extra?: Attrs) =>
  h('a', Object.assign({ class: 'btn ' + (cls || ''), href }, extra || {}), icon ? ic(icon) : null, label);

/** element whose innerHTML is ruby markup */
export const rubyNode = (s: string, cls?: string, tag?: string) => h(tag || 'span', { class: cls || '', lang: 'ja', html: ruby(s) });

/** attach romaji→hiragana live conversion to an <input>/<textarea> */
export function kanaInput<T extends HTMLInputElement | HTMLTextAreaElement>(el: T): T {
  el.setAttribute('lang', 'ja');
  el.setAttribute('autocomplete', 'off');
  el.setAttribute('autocapitalize', 'off');
  el.setAttribute('spellcheck', 'false');
  let composing = false;
  el.addEventListener('compositionstart', () => { composing = true; });
  el.addEventListener('compositionend', () => { composing = false; });
  el.addEventListener('input', () => {
    if (composing || el.dataset.raw === '1') return;
    const v = el.value;
    if (!/[a-zA-Z]/.test(v)) return;
    const atEnd = el.selectionStart === v.length;
    const conv = toHira(v, true);
    if (conv !== v) { el.value = conv; if (atEnd) el.setSelectionRange(conv.length, conv.length); }
  });
  el.addEventListener('blur', () => { if (/[a-zA-Z]/.test(el.value) && el.dataset.raw !== '1') el.value = toHira(el.value, false); });
  return el;
}
