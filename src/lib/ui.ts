/* Modal dialog and image lightbox (rendered into #overlay-root). */
import { append, esc, h, ic } from './dom';
import type { Child } from './dom';
import { TTS } from './tts';
export { toast } from './toast';

export interface ModalOpts {
  title?: string;
  titleHtml?: string;
  wide?: boolean;
  cls?: string;
  body?: Child | ((body: HTMLElement, close: () => void) => void);
  onClose?: () => void;
}
export interface ModalRef { close: () => void; body: HTMLElement; box: HTMLElement }

export function modal(opts: ModalOpts): ModalRef {
  const root = document.getElementById('overlay-root')!;
  const body = h('div', { class: 'modal-body' });
  const box = h('div', { class: 'modal' + (opts.wide ? ' wide' : '') + (opts.cls ? ' ' + opts.cls : ''), role: 'dialog', 'aria-modal': 'true' },
    h('div', { class: 'modal-head' }, h('h3', { html: opts.titleHtml || esc(opts.title || '') }), h('span', { class: 'spacer' }),
      h('button', { class: 'icon-btn sm', 'aria-label': 'Đóng', onclick: () => close() }, ic('x'))),
    body);
  const ov = h('div', { class: 'overlay', onclick: (e: Event) => { if (e.target === ov) close(); } }, box);
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
  function close() { document.removeEventListener('keydown', onKey); ov.remove(); TTS.stop(); if (opts.onClose) opts.onClose(); }
  document.addEventListener('keydown', onKey);
  if (typeof opts.body === 'function') opts.body(body, close); else if (opts.body) append(body, [opts.body as Child]);
  root.appendChild(ov);
  return { close, body, box };
}

export function lightbox(src: string, title?: string) {
  modal({ title: title || 'Xem ảnh', wide: true, cls: 'lightbox', body: h('img', { src, alt: title || '' }) });
}
