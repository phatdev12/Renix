/* Bài đọc chuyên ngành (M17 – N4 Tiếng Nhật chuyên ngành 2, SE Unit 13–18): reading with furigana,
   per-sentence translation and speech, shadowing, and the unit's technical vocabulary (with Hán Việt). */
import { SE, seById } from '../../lib/course';
import { B, h, ic } from '../../lib/dom';
import { definePage, setTitle } from '../../lib/page';
import { href } from '../../lib/routes';
import { Settings, Store } from '../../lib/store';
import { ruby, speechText } from '../../lib/text';
import { TTS, speakBtn } from '../../lib/tts';
import type { Sentence } from '../../lib/types';
import { toast } from '../../lib/ui';
import * as W from '../../lib/widgets';

type Sent = Sentence & { k: number; speaker: string };

function render(main: HTMLElement, args: string[]) {
  const unit = seById(parseInt(args[0], 10)) || SE[0];
  const st = Object.assign({ furi: 'show', vi: false, hideVi: false }, Store.get('seUi', {}));
  const save = () => Store.set('seUi', { furi: st.furi, vi: st.vi, hideVi: st.hideVi });
  let token = 0;
  setTitle('Chuyên ngành · Unit ' + unit.id, '読み物', true);

  const sents: Sent[] = [];
  unit.sections.forEach((sec) => sec.paragraphs.forEach((p) => p.forEach((s) => sents.push(Object.assign({ k: sents.length, speaker: sec.speaker }, s)))));
  let cur = -1;

  // ----- header
  main.appendChild(h('div', { class: 'unit-switch' }, SE.map((u) => h('a', { class: 'chip u' + (u.id === unit.id ? ' on' : ''), style: { '--c': 'var(--unit)' }, href: href('se', u.id) }, h('span', { class: 'dot' }), 'Unit ' + u.id))));
  main.appendChild(h('div', { class: 'text-hero' },
    h('h1', { class: 'text-title', lang: 'ja', html: ruby(unit.heading) }),
    h('div', { class: 'text-sub', style: { paddingBottom: '14px' } }, unit.headingVi, h('span', { class: 'tag', style: { marginLeft: '8px' }, title: 'M17 – N4 Tiếng Nhật chuyên ngành 2 · SE Unit ' + unit.id }, 'SE'))));

  // ----- toolbar
  const segFuri = h('div', { class: 'seg', title: 'Furigana' });
  [['show', 'ふりがな'], ['hover', 'Rê chuột'], ['hide', 'Ẩn']].forEach(([k, label]) => segFuri.appendChild(h('button', { class: st.furi === k ? 'on' : '', lang: k === 'show' ? 'ja' : null, onclick: () => { st.furi = k; save(); applyUi(); } }, label)));
  const btnVi = B('sm', 'message', 'Dịch', () => { st.vi = !st.vi; save(); applyUi(); }, { title: 'Hiện bản dịch tiếng Việt' });
  const btnPlay = B('sm primary', 'play', 'Nghe cả bài', () => playAll(false));
  const btnShadow = B('sm accent', 'wave', 'Shadowing', () => playAll(true), { title: 'Nghe từng câu, nhại lại trong khoảng lặng.' });
  const btnStop = B('sm', 'stop', 'Dừng', stopAll, { hidden: true });
  const rate: HTMLSelectElement = h('select', { class: 'input', title: 'Tốc độ đọc', onchange: () => Settings.set('rate', parseFloat(rate.value)) },
    ['0.6', '0.75', '0.9', '1', '1.15'].map((r) => h('option', { value: r, selected: String(Settings.get('rate')) === r }, r + '×')));
  main.appendChild(h('div', { class: 'toolbar' }, btnPlay, btnShadow, btnStop, rate, h('span', { class: 'spacer' }), segFuri, btnVi));

  const layout = h('div', { class: 'text-layout' });
  const body = h('div', { class: 'text-main textbody' });
  const side = h('div', { class: 'text-side' });
  layout.append(body, side);
  main.appendChild(layout);

  // ----- body
  body.appendChild(h('p', { class: 'se-intro', lang: 'ja' }, h('span', { html: ruby(unit.intro.jp) }), h('span', { class: 'vi' }, unit.intro.vi)));
  const sentEls: HTMLElement[] = [];
  const viEls: HTMLElement[] = [];
  let k = 0;
  const dialog = unit.sections.some((s) => s.speaker);
  unit.sections.forEach((sec) => {
    sec.paragraphs.forEach((p) => {
      const para = h('p', { class: 'para' + (dialog ? ' dialog' : ''), lang: 'ja' });
      if (dialog) para.appendChild(h('span', { class: 'who', html: ruby(sec.speaker) }));
      const txt = dialog ? h('span', null) : para;
      const vi = h('div', { class: 'para-vi' });
      p.forEach((s) => {
        const kk = k++;
        const el = h('span', { class: 'sent', html: ruby(s.jp), onclick: () => { if (!btnStop.hidden) stopAll(); select(kk, true); } });
        sentEls[kk] = el;
        txt.appendChild(el);
        const v = h('span', { onclick: () => select(kk, true) }, s.vi + ' ');
        viEls[kk] = v;
        vi.appendChild(v);
      });
      if (dialog) para.appendChild(txt);
      body.appendChild(para);
      body.appendChild(vi);
    });
  });

  // ----- side: current sentence
  const dock = h('div', { class: 'card dock' });
  const dockPos = h('span', { class: 'dock-pos' });
  const dockJp = h('div', { class: 'dock-jp', lang: 'ja' });
  const dockVi = h('div', { class: 'dock-vi' });
  const dockFull = h('div', { hidden: true },
    h('div', { class: 'row', style: { gap: '4px', flexWrap: 'nowrap' } }, dockPos, h('span', { class: 'spacer' }),
      h('button', { class: 'icon-btn sm', title: 'Câu trước (←)', onclick: () => select(Math.max(0, cur - 1), true) }, ic('left')),
      h('button', { class: 'icon-btn sm', title: 'Nghe lại (Space)', onclick: () => speakCur() }, ic('volume')),
      h('button', { class: 'icon-btn sm', title: 'Câu sau (→)', onclick: () => select(Math.min(sents.length - 1, cur + 1), true) }, ic('right')),
      h('button', { class: 'icon-btn sm', title: 'Đóng', onclick: () => closeDock() }, ic('x'))),
    dockJp, dockVi,
    h('div', { class: 'row', style: { marginTop: '10px', gap: '6px' } }, B('sm', 'turtle', '0.7×', () => speakCur(0.7), { title: 'Đọc chậm' })));
  const dockEmpty = h('div', { class: 'dock-empty' }, ic('volume'), 'Bấm vào một câu để nghe, xem nghĩa và chữ Hán.');
  dock.append(dockEmpty, dockFull);
  side.appendChild(dock);

  // ----- side: vocabulary of the reading
  const tbl = h('table', { class: 'se-vocab' + (st.hideVi ? ' hide-vi' : '') });
  tbl.appendChild(h('tr', null, h('th', null, 'Từ'), h('th', null, 'Hán Việt'), h('th', null, 'Nghĩa')));
  unit.vocab.forEach((v) => tbl.appendChild(h('tr', null,
    h('td', { class: 'w', lang: 'ja' }, h('div', { class: 'row', style: { gap: '4px', flexWrap: 'nowrap' } }, speakBtn(v.r && !/[－—-]/.test(v.r) ? v.r : v.w), h('span', { html: ruby(v.ruby) }))),
    h('td', { class: 'hv' }, v.hv.replace(/^[－—-]$/, '')),
    h('td', { class: 'vi', onclick: (e: Event) => (e.currentTarget as HTMLElement).classList.toggle('show') }, v.vi))));
  const btnHide = B('sm', 'eye', 'Che nghĩa', () => { st.hideVi = !st.hideVi; save(); tbl.classList.toggle('hide-vi', st.hideVi); btnHide.classList.toggle('primary', st.hideVi); tbl.querySelectorAll('.vi.show').forEach((x) => x.classList.remove('show')); }, { title: 'Tự kiểm tra: che nghĩa, bấm từng ô để xem' });
  btnHide.classList.toggle('primary', st.hideVi);
  side.appendChild(h('div', { class: 'card' }, h('h3', null, ic('cards'), 'Từ vựng của bài ', h('span', { class: 'tag' }, unit.vocab.length + ' từ'), h('span', { class: 'spacer' }), btnHide), h('div', { style: { overflowX: 'auto' } }, tbl)));

  function applyUi() {
    body.classList.toggle('furi-hover', st.furi === 'hover');
    Array.from(segFuri.children).forEach((b, i) => b.classList.toggle('on', ['show', 'hover', 'hide'][i] === st.furi));
    body.querySelectorAll<HTMLElement>('rt').forEach((rt) => { rt.style.display = st.furi === 'hide' ? 'none' : ''; });
    body.querySelectorAll<HTMLElement>('.para-vi').forEach((x) => { x.hidden = !st.vi; });
    btnVi.classList.toggle('primary', st.vi);
  }
  function mark(i: number) {
    sentEls.forEach((e, j) => e && e.classList.toggle('active', j === i));
    viEls.forEach((e, j) => e && e.classList.toggle('active', j === i));
  }
  function closeDock() { cur = -1; mark(-1); dockFull.hidden = true; dockEmpty.hidden = false; dock.classList.remove('live'); }
  function select(i: number, speak: boolean) {
    cur = i;
    const s = sents[i];
    mark(i);
    dockEmpty.hidden = true; dockFull.hidden = false; dock.classList.add('live');
    dockJp.innerHTML = W.kanjiClickable(ruby(s.jp));
    dockVi.textContent = s.vi;
    dockPos.textContent = `Câu ${i + 1}/${sents.length}` + (s.speaker ? ' · ' + s.speaker.replace(/\{([^|]+)\|[^}]+\}/g, '$1') : '');
    sentEls[i].scrollIntoView({ block: 'center', behavior: 'smooth' });
    if (speak) speakCur();
  }
  function speakCur(r?: number) { if (cur >= 0) return TTS.speak(speechText(sents[cur].jp), r ? { rate: r } : undefined); return Promise.resolve(); }
  dockJp.addEventListener('click', (e) => { const el = (e.target as Element).closest<HTMLElement>('.kj'); if (el) W.kanjiModal(el.dataset.k!); });

  async function playAll(shadow: boolean) {
    const tok = ++token;
    btnStop.hidden = false; btnPlay.disabled = true; btnShadow.disabled = true;
    if (shadow) toast('Nghe từng câu rồi nhại lại trong khoảng lặng', 3000);
    for (const s of sents) {
      if (tok !== token) break;
      select(s.k, false);
      const t0 = performance.now();
      await TTS.speak(speechText(s.jp));
      if (tok !== token) break;
      const dur = performance.now() - t0;
      await new Promise((r) => setTimeout(r, shadow ? Math.max(1400, dur * 1.15) : 350));
    }
    if (tok === token) stopAll();
  }
  function stopAll() { token++; TTS.stop(); btnStop.hidden = true; btnPlay.disabled = false; btnShadow.disabled = false; }

  applyUi();
  const onKey = (e: KeyboardEvent) => {
    if (/INPUT|TEXTAREA|SELECT/.test((document.activeElement && document.activeElement.tagName) || '')) return;
    if (e.key === 'ArrowRight' && cur < sents.length - 1) { e.preventDefault(); select(cur + 1, true); }
    else if (e.key === 'ArrowLeft' && cur > 0) { e.preventDefault(); select(cur - 1, true); }
    else if (e.key === ' ' && cur >= 0) { e.preventDefault(); speakCur(); }
  };
  document.addEventListener('keydown', onKey);
  return () => { stopAll(); document.removeEventListener('keydown', onKey); };
}

definePage(render);
