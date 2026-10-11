import { h } from './dom';

export function toast(msg: string, ms?: number) {
  const root = document.getElementById('toast-root');
  if (!root) return;
  const t = h('div', { class: 'toast' }, msg);
  root.appendChild(t);
  setTimeout(() => { t.style.transition = 'opacity .3s'; t.style.opacity = '0'; setTimeout(() => t.remove(), 320); }, ms || 2200);
}
