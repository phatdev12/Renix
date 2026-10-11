/* Client-side page lifecycle. Each Astro page loads one script that calls definePage(render);
   the render function fills #main and may return a cleanup. It re-runs when the unit filter changes. */
import { h } from './dom';
import { Bus } from './store';
import { TTS } from './tts';

export type Query = Record<string, string>;
export type Cleanup = (() => void) | void;
export type Render = (main: HTMLElement, args: string[], query: Query) => Cleanup;

let rerun: (() => void) | null = null;

/** Top-bar title (the server already rendered the page's default one). */
export function setTitle(main: string, sub?: string, doc?: boolean) {
  const a = document.getElementById('tt-main');
  const b = document.getElementById('tt-sub');
  if (a) a.textContent = main || '';
  if (b) b.textContent = sub || '';
  if (doc) document.title = main + ' · Renix';
}

export function definePage(render: Render) {
  const main = document.getElementById('main')!;
  let args: string[] = [];
  try { args = JSON.parse(main.dataset.args || '[]').map(String); } catch (e) { /* none */ }
  const query: Query = Object.fromEntries(new URLSearchParams(location.search));
  let cleanup: Cleanup = undefined;
  const stop = () => {
    if (cleanup) { try { cleanup(); } catch (e) { console.error(e); } cleanup = undefined; }
    TTS.stop();
  };
  const run = () => {
    stop();
    main.replaceChildren();
    try {
      cleanup = render(main, args, query);
    } catch (e) {
      console.error(e);
      main.appendChild(h('div', { class: 'note warn' }, 'Có lỗi khi hiển thị trang: ' + (e as Error).message));
    }
  };
  rerun = () => { run(); window.scrollTo(0, 0); };
  Bus.on('settings', ({ key }) => { if (key === 'units') run(); });
  window.addEventListener('pagehide', stop);
  // back/forward cache: the page comes back without re-running scripts — refresh what changed meanwhile
  window.addEventListener('pageshow', (e) => { if (e.persisted) run(); });
  run();
}

/** Render the current page again from scratch (e.g. after the exam date or progress was reset). */
export function rerender() { if (rerun) rerun(); }
