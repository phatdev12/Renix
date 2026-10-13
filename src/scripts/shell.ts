/* shell.ts — client behaviour of the layout: rail pill + hover labels, unit filter, theme / furigana /
   voice toggles and the search box. Runs once per page load, before the page's own script. */
import { ALL_UNITS, COURSES, UNITS } from '../lib/course';
import { D } from '../lib/data';
import { $, $$, B, esc, h } from '../lib/dom';
import { rerender } from '../lib/page';
import { go, href } from '../lib/routes';
import { Bus, Settings } from '../lib/store';
import { plain, reading, ruby, toHira } from '../lib/text';
import { TTS } from '../lib/tts';
import { modal, toast } from '../lib/ui';
import { debounce } from '../lib/util';
import { kanjiModal, uTag } from '../lib/widgets';

// ------------------------------------------------------------------ navigation rail
const pillTo = (pill: HTMLElement, a: HTMLElement) => {
  pill.style.transform = `translateY(${a.offsetTop}px)`;
  pill.style.height = a.offsetHeight + 'px';
};
/** The active pill starts where CSS put it (from --i); on resize (e.g. the mobile drawer) follow the real item. */
function placeActive() {
  const nav = $('#nav');
  const ind = nav.querySelector<HTMLElement>('.nav-ind')!;
  const act = nav.querySelector<HTMLElement>('a.active');
  if (act) pillTo(ind, act);
  if (!nav.classList.contains('glide')) requestAnimationFrame(() => requestAnimationFrame(() => nav.classList.add('glide')));
}
// hover: a pill slides behind the icon and a glass label slides out beside it
function setupNavHover() {
  const nav = $('#nav');
  const tip = $('#nav-tip');
  const hov = nav.querySelector<HTMLElement>('.nav-hov')!;
  let cur: HTMLElement | null = null;
  let hideT: ReturnType<typeof setTimeout> | undefined;
  const show = (a: HTMLElement) => {
    clearTimeout(hideT);
    if (a === cur) return;
    cur = a;
    if (!hov.classList.contains('on')) { hov.classList.add('jump'); pillTo(hov, a); void hov.offsetWidth; hov.classList.remove('jump'); hov.classList.add('on'); }
    else pillTo(hov, a);
    const r = a.getBoundingClientRect();
    tip.replaceChildren(h('span', { class: 'tt' }, h('b', null, a.dataset.label), h('small', { lang: 'ja' }, a.dataset.jp)));
    if (!tip.classList.contains('show')) {
      tip.classList.add('jump'); tip.style.top = r.top + r.height / 2 + 'px'; void tip.offsetWidth;
      tip.classList.remove('jump'); tip.classList.add('show');
    } else tip.style.top = r.top + r.height / 2 + 'px';
  };
  const hide = (now?: boolean) => {
    clearTimeout(hideT);
    hideT = setTimeout(() => { cur = null; tip.classList.remove('show'); hov.classList.remove('on'); }, now ? 0 : 90);
  };
  nav.addEventListener('mouseover', (e) => { const a = (e.target as Element).closest<HTMLElement>('a'); if (a) show(a); });
  nav.addEventListener('mouseleave', () => hide());
  nav.addEventListener('focusin', (e) => { const a = (e.target as Element).closest<HTMLElement>('a'); if (a && a.matches(':focus-visible')) show(a); });
  nav.addEventListener('focusout', () => hide());
  nav.addEventListener('scroll', () => hide(true), { passive: true });
  // leaving the page: drop the hover state so it is not part of the transition snapshot
  nav.addEventListener('click', () => hide(true));
  window.addEventListener('resize', debounce(() => { hide(true); placeActive(); }, 120));
}

// ------------------------------------------------------------------ unit filter
const courseUnits = (key: string) => UNITS.filter((u) => u.course === key).map((u) => u.id);
/** short description of the selection for the top-bar button: "Tất cả", "N5", "13–17", "1, 3, 5" */
export function unitSummary(sel: number[]): string {
  if (sel.length === ALL_UNITS.length) return 'Tất cả';
  for (const c of COURSES) { const cu = courseUnits(c.key); if (cu.length === sel.length && cu.every((u) => sel.includes(u))) return c.short; }
  const run = sel.length > 2 && sel.every((u, i) => i === 0 || u === sel[i - 1] + 1);
  return run ? `${sel[0]}–${sel[sel.length - 1]}` : sel.join(', ');
}
function paintUnitFilter() {
  const sel = D.sel();
  const set = new Set(sel);
  const all = sel.length === ALL_UNITS.length;
  $$<HTMLButtonElement>('[data-unit-filter] button').forEach((b) => {
    if (b.dataset.course) { const cu = courseUnits(b.dataset.course); b.classList.toggle('on', !all && cu.length === sel.length && cu.every((u) => set.has(u))); return; }
    const u = b.dataset.u!;
    b.classList.toggle('on', u === 'all' ? all : !all && set.has(Number(u)));
  });
  const btn = document.getElementById('unit-btn');
  if (btn) { btn.querySelector('b')!.textContent = unitSummary(sel); btn.classList.toggle('on', !all); }
}
function setupUnitFilter() {
  $$<HTMLButtonElement>('[data-unit-filter] button').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.u === 'all') { Settings.set('units', ALL_UNITS.slice()); return; }
    if (b.dataset.course) { Settings.set('units', courseUnits(b.dataset.course)); return; }
    const u = Number(b.dataset.u);
    const cur = D.sel();
    const all = cur.length === ALL_UNITS.length;
    let s = new Set(cur);
    if (all) s = new Set([u]);
    else if (s.has(u)) { s.delete(u); if (!s.size) s = new Set(ALL_UNITS); }
    else s.add(u);
    Settings.set('units', Array.from(s).sort((a, b2) => a - b2));
  }));
  // top bar: a compact button opens the grouped pills in a glass popover
  const btn = document.getElementById('unit-btn');
  const pop = document.getElementById('unit-pop');
  if (btn && pop) {
    const close = () => { pop.hidden = true; btn.setAttribute('aria-expanded', 'false'); };
    btn.addEventListener('click', (e) => { e.stopPropagation(); pop.hidden = !pop.hidden; btn.setAttribute('aria-expanded', String(!pop.hidden)); });
    pop.addEventListener('click', (e) => e.stopPropagation());
    document.addEventListener('click', close);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  }
  paintUnitFilter();
}

// ------------------------------------------------------------------ toggles
function applyTheme() {
  const t = Settings.get('theme') === 'light' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', t);
  // window title bar of the installed app follows the page background
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', t === 'dark' ? '#0b0b0d' : '#ececef');
  $('#btn-theme').title = t === 'dark' ? 'Giao diện tối · bấm để đổi sang sáng' : 'Giao diện sáng · bấm để đổi sang tối';
}
function applyFuri() {
  const on = Settings.get('furi') !== false;
  document.documentElement.classList.toggle('furi-off', !on);
  $('#btn-furi').classList.toggle('on', on);
  $('#btn-furi').title = on ? 'Furigana: bật' : 'Furigana: tắt';
}

/** exam date dialog (opened from the home countdown) */
export function setExamDate() {
  modal({
    title: 'Ngày thi giữa kỳ', body: (b, close) => {
      const inp = h('input', { type: 'date', class: 'input', value: Settings.get('examDate') || '', style: { width: '100%' } });
      b.append(inp,
        h('div', { class: 'row', style: { marginTop: '14px' } },
          B('primary', 'check', 'Lưu', () => { Settings.set('examDate', inp.value); close(); rerender(); toast('Đã lưu ngày thi'); }),
          B('ghost', 'trash', 'Xoá ngày', () => { Settings.set('examDate', ''); close(); rerender(); })));
      setTimeout(() => inp.focus(), 30);
    },
  });
}

function voiceDialog() {
  modal({
    title: 'Giọng đọc', body: (b) => {
      const list = TTS.voices;
      const sel = h('select', { class: 'input', style: { width: '100%' } });
      if (!list.length) sel.appendChild(h('option', { value: '' }, '(Không có giọng tiếng Nhật)'));
      list.forEach((v) => sel.appendChild(h('option', { value: v.name, selected: !!TTS.voice && TTS.voice.name === v.name }, v.name)));
      sel.onchange = () => { Settings.set('voice', sel.value); TTS.pick(); TTS.speak('こんにちは。日本語の勉強をがんばりましょう。'); };
      const rate = h('input', { type: 'range', min: '0.5', max: '1.3', step: '0.05', value: String(Settings.get('rate')), style: { width: '100%', accentColor: 'var(--primary)' } });
      const rv = h('b', { class: 'num' }, Settings.get('rate') + '×');
      rate.oninput = () => { rv.textContent = rate.value + '×'; Settings.set('rate', parseFloat(rate.value)); };
      const cc = TTS.clipCount();
      const real = h('label', { class: 'check', style: { marginBottom: '6px' } },
        h('input', { type: 'checkbox', checked: Settings.get('realVoice') !== false, onchange: (e: Event) => Settings.set('realVoice', (e.target as HTMLInputElement).checked) }),
        h('span', null, h('b', null, 'Giọng thật'), ' từ video của lớp'));
      b.append(
        real, h('div', { class: 'small muted', style: { margin: '0 0 6px 24px' } }, `${cc.text} câu bài khóa · ${cc.vocab} từ vựng. Phần còn lại dùng giọng máy bên dưới.`),
        h('div', { class: 'glabel' }, 'Giọng máy'), sel,
        h('div', { class: 'glabel' }, 'Tốc độ giọng máy · ', rv), rate,
        h('div', { class: 'row', style: { marginTop: '16px' } }, B('primary', 'volume', 'Nghe thử', () => TTS.speak('わたしは、毎朝、七時半に起きます。')),
          h('span', { class: 'small muted' }, 'Hay nhất: Microsoft Nanami (Edge)')));
      if (!list.length) b.appendChild(h('p', { class: 'small muted', style: { marginTop: '12px' } }, 'Windows → Settings → Time & language → Language & region → thêm 日本語 và bật Text-to-speech.'));
    },
  });
}

// ------------------------------------------------------------------ search
interface Hit { t: string; key: string; main: string; sub: string; u: number; go?: string; kanji?: string }
function buildIndex(): Hit[] {
  const idx: Hit[] = [];
  UNITS.forEach((u) => {
    u.vocab.forEach((v) => idx.push({ t: 'Từ vựng', key: [v.kana, v.kanji, v.vi].join(' '), main: v.ruby, sub: v.vi, u: u.id, go: href('vocab', { focus: v.id }) }));
    u.kanji.forEach((k) => idx.push({ t: 'Kanji', key: [k.c, k.hv.map((x) => x.t).join(' '), k.meaning, k.on.map((x) => x.t).join(' '), k.kun.map((x) => x.t).join(' ')].join(' '), main: k.c, sub: k.hv.map((x) => x.t).join('/') + ' · ' + k.meaning, u: u.id, kanji: k.c }));
    u.grammar.forEach((g) => idx.push({ t: 'Ngữ pháp', key: [g.title, g.meaning, (g.formulas || []).join(' ')].join(' '), main: g.title, sub: g.meaning, u: u.id, go: href('grammar', g.id) }));
    u.sections.forEach((s) => s.paragraphs.forEach((p) => p.forEach((x) => idx.push({ t: 'Câu trong bài khóa', key: plain(x.jp) + ' ' + reading(x.jp) + ' ' + x.vi, main: x.jp, sub: x.vi, u: u.id, go: href('text', u.id) }))));
  });
  return idx;
}
let INDEX: Hit[] | null = null;
const fold = (s: string) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
function search(q: string): Hit[] {
  INDEX = INDEX || buildIndex();
  const qq = fold(q.trim());
  const hira = toHira(q.trim(), false);
  if (!qq) return [];
  const res = INDEX.filter((x) => { const k = fold(x.key); return k.includes(qq) || (hira !== q && k.includes(hira)); });
  const order = ['Kanji', 'Từ vựng', 'Ngữ pháp', 'Câu trong bài khóa'];
  res.sort((a, b) => order.indexOf(a.t) - order.indexOf(b.t));
  return res.slice(0, 40);
}
function setupSearch() {
  const inp = $<HTMLInputElement>('#search'), box = $('#search-results');
  let items: Hit[] = [], selIdx = -1;
  const close = () => { box.hidden = true; selIdx = -1; };
  const open = (x: Hit) => {
    close(); inp.blur(); document.body.classList.remove('search-open');
    if (x.kanji) { kanjiModal(x.kanji); return; }
    if (x.go) go(x.go);
  };
  const render = () => {
    const q = inp.value;
    items = search(q);
    box.innerHTML = '';
    if (!q.trim()) { close(); return; }
    if (!items.length) { box.appendChild(h('div', { class: 'sr-group' }, 'Không có kết quả')); box.hidden = false; return; }
    let last = '';
    items.forEach((x, i) => {
      if (x.t !== last) { box.appendChild(h('div', { class: 'sr-group' }, x.t)); last = x.t; }
      box.appendChild(h('a', { class: 'sr-item' + (i === selIdx ? ' sel' : ''), href: x.go || '#', onclick: (e: Event) => { e.preventDefault(); open(x); } },
        h('span', { class: 'sr-main', lang: 'ja', html: x.t === 'Ngữ pháp' ? esc(x.main) : ruby(x.main) }), h('span', { class: 'sr-sub' }, x.sub), uTag(x.u)));
    });
    box.hidden = false;
  };
  inp.addEventListener('input', debounce(render, 120));
  inp.addEventListener('focus', () => { if (inp.value.trim()) render(); });
  inp.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); selIdx = Math.max(0, Math.min(items.length - 1, selIdx + (e.key === 'ArrowDown' ? 1 : -1))); render(); }
    else if (e.key === 'Enter') { const x = items[selIdx >= 0 ? selIdx : 0]; if (x) open(x); }
    else if (e.key === 'Escape') { close(); inp.blur(); document.body.classList.remove('search-open'); }
  });
  document.addEventListener('click', (e) => {
    const t = e.target as Element;
    if (!t.closest('.search') && !t.closest('#btn-search')) { close(); document.body.classList.remove('search-open'); }
  });
  document.addEventListener('keydown', (e) => {
    const tag = (document.activeElement && document.activeElement.tagName) || '';
    if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(tag)) { e.preventDefault(); document.body.classList.add('search-open'); inp.focus(); }
  });
  $('#btn-search').onclick = () => { const o = document.body.classList.toggle('search-open'); if (o) setTimeout(() => inp.focus(), 20); };
}

// ------------------------------------------------------------------ phone app shell
function setupAppNav() {
  const more = $('#tab-more');
  const setMenu = (open: boolean) => { document.body.classList.toggle('nav-open', open); more.setAttribute('aria-expanded', String(open)); };
  more.onclick = () => setMenu(!document.body.classList.contains('nav-open'));
  $('#scrim').onclick = () => setMenu(false);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });
  window.addEventListener('pageshow', () => setMenu(false));
  // back button: return to where the user came from inside the site, else up to the section
  const back = $<HTMLAnchorElement>('#btn-back');
  if (back) back.onclick = (e) => {
    let same = false;
    try { same = new URL(document.referrer).origin === location.origin; } catch { /* no referrer */ }
    if (same && history.length > 1) { e.preventDefault(); history.back(); }
  };
}

// ------------------------------------------------------------------ app (PWA)
interface InstallPrompt extends Event { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> }
function setupPwa() {
  if ('serviceWorker' in navigator) {
    // dev and preview share the origin: a worker left over from preview must not serve stale pages in dev
    if (import.meta.env.PROD) navigator.serviceWorker.register('/sw.js').catch(() => {});
    else navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister()));
  }
  // the browser offers installing once per page load; show the button only while it does
  const btn = $('#btn-install');
  let ask: InstallPrompt | null = null;
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); ask = e as InstallPrompt; btn.hidden = false; });
  btn.onclick = async () => {
    if (!ask) return;
    await ask.prompt();
    await ask.userChoice;
    ask = null; btn.hidden = true;
  };
  window.addEventListener('appinstalled', () => { btn.hidden = true; toast('Đã cài Renix'); });
}

// ------------------------------------------------------------------ boot
function boot() {
  if (Settings.get('theme') !== 'light' && Settings.get('theme') !== 'dark') Settings.set('theme', 'dark');
  TTS.init();
  placeActive();
  setupNavHover();
  setupUnitFilter();
  applyTheme();
  applyFuri();
  setupSearch();
  setupPwa();
  $('#btn-theme').onclick = () => { Settings.set('theme', Settings.get('theme') === 'light' ? 'dark' : 'light'); applyTheme(); };
  $('#btn-furi').onclick = () => { Settings.set('furi', !(Settings.get('furi') !== false)); applyFuri(); };
  $('#btn-voice').onclick = voiceDialog;
  setupAppNav();
  Bus.on('settings', ({ key }) => { if (key === 'units') paintUnitFilter(); });
  // settings changed on another page (back/forward cache, other tab): resync the chrome
  window.addEventListener('pageshow', (e) => {
    if (!e.persisted) return;
    document.body.classList.remove('nav-open', 'search-open');
    applyTheme(); applyFuri(); paintUnitFilter();
  });
}

boot();
