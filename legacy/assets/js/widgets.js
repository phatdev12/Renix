/* widgets.js — reusable UI pieces shared by several pages (+ small SVG charts). */
(function (G) {
  'use strict';
  const { h, esc, ic, B, ruby, plain, speechText, TTS, speakBtn, D, uTag, toast, modal, lightbox, shuffle, Prog, sameAns, kanaInput } = G.U;

  // ------------------------------------------------------------------ grammar formula → coloured chips
  function tokClass(t) {
    const s = t.replace(/^[（(]/, '');
    if (/^(普通形|ふつう形|辞書形|じしょ形|可能形|V可能形|ます形)/.test(s) || /^V可能/.test(s)) return 'f';
    if (/^V/.test(s)) return 'v';
    if (/^N/.test(s)) return 'n';
    if (/^(Adj|A[い な]|Aな|Aい)/.test(s) || /^A$/.test(s)) return 'a';
    return 'g';
  }
  function tokNode(t) {
    // split a trailing/embedded parenthetical note "（bỏ ます）" into a small label
    const m = t.match(/^(.*?)([（(][^）)]*[）)])(.*)$/);
    const cls = 'tok ' + tokClass(t);
    if (m && /[a-zàáảãạăâđèéêìíòóôơùúưỳýỷỹỵ]/i.test(m[2])) {
      return h('span', { class: cls }, h('span', { lang: 'ja', html: ruby(m[1] + m[3]) }), h('small', null, m[2].slice(1, -1)));
    }
    return h('span', { class: cls, lang: 'ja', html: ruby(t) });
  }
  function formula(str) {
    const box = h('div', { class: 'formula' });
    const parts = String(str).split(/\s*＋\s*/);
    parts.forEach((p, i) => {
      if (i) box.appendChild(h('span', { class: 'tok-plus' }, '+'));
      // inside a part, spaces separate sub-tokens (e.g. "N₁（người cho）は N₂ に")
      const subs = p.split(/\s+(?![^（(]*[）)])/).flatMap((s) => s.split(/(?<=、)(?=[VNA])/)).filter(Boolean);
      subs.forEach((s) => box.appendChild(tokNode(s)));
    });
    return box;
  }
  const legend = () => h('div', { class: 'legend' },
    h('span', { class: 'lg-solid' }, 'Mẫu câu'), h('span', { class: 'lg-line' }, 'Chỗ điền: V · N · A'), h('span', { class: 'lg-dash' }, 'Thể của động từ'));

  // ------------------------------------------------------------------ example sentence row
  function example(ex) {
    return h('div', { class: 'ex' },
      speakBtn(speechText(ex.jp)),
      h('div', null,
        h('div', { class: 'exj', lang: 'ja', html: ruby(ex.jp) }),
        h('div', { class: 'exv' }, ex.vi, ex.src === 'text' ? h('span', { class: 'src', title: 'Câu trích từ bài khóa' }, 'bài khóa') : null),
        ex.fix ? h('div', { class: 'fixnote' }, ic('pencil'), ex.fix) : null));
  }

  // ------------------------------------------------------------------ conjugation tables
  const pickV = (m, g) => (G.VERBS || []).find((v) => v.m === m && (g == null || v.g === g));
  function cell(v, form, mark) {
    const t = G.Conj.table(v)[form];
    if (!t) return h('td', { class: 'jp muted' }, '—');
    const [a, b] = G.Conj.splitEnding(v.k, t.kanji);
    const td = h('td', { class: 'jp' });
    td.appendChild(h('span', { lang: 'ja', html: ruby(G.U.D && v.ruby ? rubyStem(v, a) : esc(a)) }));
    td.appendChild(h('span', { class: mark === false ? '' : 'end', lang: 'ja' }, b));
    td.appendChild(speakBtn(t.kanji));
    return td;
  }
  // reuse the verb's ruby for the unchanged part when possible
  function rubyStem(v, a) {
    const r = v.ruby || v.k;
    // walk the ruby string and cut it at the same plain length as a
    let out = '', len = 0;
    const re = /\{([^|{}]+)\|([^{}]+)\}|([^{}])/g; let m;
    while ((m = re.exec(r)) && len < a.length) {
      if (m[1]) { if (len + m[1].length <= a.length) { out += m[0]; len += m[1].length; } else break; }
      else { out += m[3]; len += 1; }
    }
    return len === a.length ? out : a;
  }
  function conjTable(kind) {
    const wrap = h('div', { class: 'table-wrap' });
    const t = h('table', { class: 'ctable' });
    wrap.appendChild(t);
    const row = (...cells) => h('tr', null, ...cells);
    const th = (...x) => h('th', null, ...x);
    if (kind === 'te') {
      t.appendChild(row(th('Nhóm'), th('Đuôi ます'), th('→ て / た'), th('Ví dụ')));
      const rows = [
        ['I', 'い・ち・り', 'って／った', ['かいます', 'まちます', 'かえります']],
        ['I', 'み・び・に', 'んで／んだ', ['よみます', 'あそびます']],
        ['I', 'き', 'いて／いた', ['かきます']],
        ['I', 'ぎ', 'いで／いだ', ['いそぎます']],
        ['I', 'し', 'して／した', ['はなします']],
        ['I', 'ngoại lệ', 'いきます → いって', ['いきます']],
        ['II', 'mọi đuôi', 'bỏ ます + て／た', ['たべます', 'みます']],
        ['III', 'bất quy tắc', 'します→して・きます→きて', ['します', 'きます']],
      ];
      rows.forEach((r) => {
        const ex = h('td', { class: 'jp' });
        r[3].forEach((m, i) => {
          const v = pickV(m, r[0] === 'I' ? 1 : r[0] === 'II' ? 2 : 3) || pickV(m);
          if (!v) return;
          const te = G.Conj.conj(v.k, v.g, 'te');
          ex.appendChild(h('span', { lang: 'ja', html: (i ? '、' : '') + ruby(v.ruby) + ' → ' + esc(te) }));
        });
        t.appendChild(row(h('td', { class: 'grp' }, r[0]), h('td', { class: 'jp' }, r[1]), h('td', { class: 'jp end' }, r[2]), ex));
      });
    } else if (kind === 'jisho' || kind === 'kanou') {
      const form = kind === 'jisho' ? 'jisho' : 'kanouMasu';
      const groups = kind === 'jisho'
        ? [[1, ['かきます', 'よみます', 'とります', 'すいます', 'いそぎます', 'あそびます', 'まちます', 'はなします'], '〜い段 ます → 〜う段'],
          [2, ['たべます', 'ねます', 'みます', 'きます'], '〜ます → 〜る'],
          [3, ['します', 'きます'], 'します→する・来ます→来る']]
        : [[1, ['あいます', 'いきます', 'ききます', 'とります', 'かします', 'よびます'], '〜い段 ます → 〜え段 ます'],
          [2, ['ねます', 'たべます', 'みます'], '〜ます → 〜られます'],
          [3, ['きます', 'します'], '来ます→来られます・します→できます']];
      t.appendChild(row(th('Nhóm'), th('ます形'), th(kind === 'jisho' ? '辞書形' : '可能形'), th('Quy tắc')));
      groups.forEach(([g, list, rule]) => {
        list.forEach((m, i) => {
          const v = pickV(m, g);
          if (!v) return;
          t.appendChild(h('tr', null,
            i === 0 ? h('td', { class: 'grp', rowspan: String(list.length) }, ['', 'I', 'II', 'III'][g]) : null,
            h('td', { class: 'jp', lang: 'ja', html: ruby(v.ruby) }),
            cell(v, form),
            i === 0 ? h('td', { class: 'small', rowspan: String(list.length), lang: 'ja' }, rule) : null));
        });
      });
    } else if (kind === 'futsuu') {
      t.appendChild(row(th(''), th('Hiện tại (+)'), th('Hiện tại (−)'), th('Quá khứ (+)'), th('Quá khứ (−)')));
      const data = [
        ['Động từ', [['{行|い}きます', '{行|い}く'], ['{行|い}きません', '{行|い}かない'], ['{行|い}きました', '{行|い}った'], ['{行|い}きませんでした', '{行|い}かなかった']]],
        ['Tính từ い', [['{高|たか}いです', '{高|たか}い'], ['{高|たか}くないです', '{高|たか}くない'], ['{高|たか}かったです', '{高|たか}かった'], ['{高|たか}くなかったです', '{高|たか}くなかった']]],
        ['Tính từ な', [['ひまです', 'ひまだ'], ['ひまじゃありません', 'ひまじゃない'], ['ひまでした', 'ひまだった'], ['ひまじゃありませんでした', 'ひまじゃなかった']]],
        ['Danh từ', [['{学生|がくせい}です', '{学生|がくせい}だ'], ['{学生|がくせい}じゃありません', '{学生|がくせい}じゃない'], ['{学生|がくせい}でした', '{学生|がくせい}だった'], ['{学生|がくせい}じゃありませんでした', '{学生|がくせい}じゃなかった']]],
      ];
      data.forEach(([label, cells]) => {
        t.appendChild(row(h('td', { class: 'grp', style: { fontFamily: 'var(--font-ui)', fontSize: '13px' } }, label), ...cells.map(([pol, pl]) =>
          h('td', { class: 'jp' }, h('div', { class: 'muted small', lang: 'ja', html: ruby(pol) }), h('div', { lang: 'ja' }, h('span', { html: '→ ' }), h('b', { class: 'end', html: ruby(pl) }))))));
      });
    }
    return wrap;
  }

  // ------------------------------------------------------------------ giving / receiving diagram (Unit 17)
  function giveDiagram(focus) {
    const person = (label, me) => h('div', { class: 'person' }, h('div', { class: 'p' + (me ? ' me' : ''), lang: 'ja' }, label), h('span', null, me ? 'tôi' : ''));
    const flow = (from, to, rev) => h('div', { class: 'give-flow' }, from, h('div', { class: 'arrow' + (rev ? ' rev' : '') }, h('span', { class: 'gift' }, ic('gift'))), to);
    const box = (key, title, vi, fl, ex, honor) => h('div', { class: 'give-box' + (focus === key ? ' focus' : '') },
      h('h4', { lang: 'ja' }, title), h('div', { class: 'small muted' }, vi), fl,
      h('div', { class: 'sent-ex', lang: 'ja', html: ruby(ex) }), h('div', { class: 'honor', html: honor }));
    return h('div', { class: 'give' },
      box('ageru', 'あげます', 'Tôi / người khác → cho người khác', flow(person('わたし', true), person('Aさん')),
        'わたしは {友|とも}だちに {本|ほん}を あげました。', 'Người nhận là bề trên → <b lang="ja">さしあげます</b>'),
      box('kureru', 'くれます', 'Người khác → cho TÔI (gia đình tôi)', flow(person('Aさん'), person('わたし', true)),
        '{友|とも}だちは わたしに {本|ほん}を くれました。', 'Người cho là bề trên → <b lang="ja">くださいます</b>'),
      box('morau', 'もらいます', 'Tôi NHẬN từ người khác (に／から)', flow(person('わたし', true), person('Aさん'), true),
        'わたしは {友|とも}だちに／から {本|ほん}を もらいました。', 'Người cho là bề trên → <b lang="ja">いただきます</b>'));
  }

  // ------------------------------------------------------------------ noun modification diagram (Unit 15)
  function meishiDiagram() {
    const line = (pre, clause, noun, post, vi) => h('div', { style: { margin: '10px 0' } },
      h('div', { class: 'mod-demo' }, pre ? h('span', { lang: 'ja', html: ruby(pre) }) : null,
        h('span', { class: 'mod-clause', lang: 'ja', html: ruby(clause) }), h('span', { class: 'mod-arrow' }, '→'),
        h('span', { class: 'mod-noun', lang: 'ja', html: ruby(noun) }), post ? h('span', { lang: 'ja', html: ruby(post) }) : null),
      h('div', { class: 'small muted' }, vi));
    return h('div', null,
      line('これは', 'リさんが{住|す}んでいた', '{家|いえ}', 'です。', 'Danh từ làm vị ngữ — “Đây là ngôi nhà mà Li đã ở.”'),
      line('', 'リさんが{住|す}んでいた', '{家|いえ}', 'は{古|ふる}いです。', 'Danh từ làm chủ ngữ — “Ngôi nhà mà Li đã ở thì cũ.”'),
      line('わたしは', 'リさんが{住|す}んでいた', '{家|いえ}', 'を{買|か}いました。', 'Danh từ làm tân ngữ — “Tôi đã mua ngôi nhà mà Li từng ở.”'),
      h('div', { class: 'small', style: { color: 'var(--ink-2)' } }, h('span', { class: 'mod-clause', style: { padding: '0 6px' } }, 'nét đứt'), ' = mệnh đề thể thông thường đứng TRƯỚC danh từ; chủ ngữ trong mệnh đề dùng ', h('b', { lang: 'ja' }, 'が'), '.'));
  }

  // ------------------------------------------------------------------ kanji detail (modal or inline)
  function readingChips(list, kind) {
    const box = h('div');
    if (!list || !list.length) { box.appendChild(h('span', { class: 'muted' }, '—')); return box; }
    list.forEach((r) => {
      let html = esc(r.t);
      if (kind === 'kun') html = html.replace(/\.(.+)$/, '<span class="ok">$1</span>').replace(/^([^<]*)<span/, '$1<span');
      box.appendChild(h('span', { class: 'rd' + (r.rare ? ' rare' : ''), lang: 'ja', title: r.rare ? 'Âm ít dùng' : '', html }));
    });
    return box;
  }
  function kanjiPanel(c, opts) {
    opts = opts || {};
    const k = D.kanjiInfo(c);
    const wrap = h('div', { class: 'kdetail' });
    const left = h('div');
    const pad = h('div');
    left.appendChild(pad);
    const msg = h('div', { class: 'kw-msg' });
    let w = null;
    if (G.KanjiWriter.has(c)) {
      w = new G.KanjiWriter(pad, c, { numbers: true, onMessage: (t, cls) => { msg.textContent = t; msg.className = 'kw-msg ' + cls; } });
      setTimeout(() => w.animate({ numbers: true }), 120);
      left.appendChild(h('div', { class: 'kw-ctrls' },
        B('sm', 'rotate', 'Xem lại', () => w.animate({ numbers: true })),
        B('sm icon', 'left', null, () => w.showStep(Math.max(1, (w.step || 1) - 1)), { title: 'Nét trước' }),
        B('sm icon', 'right', null, () => w.showStep(Math.min(w.count, (w.step || 0) + 1)), { title: 'Nét sau' }),
        G.U.A('sm primary', 'brush', 'Tập viết', '#/write/' + encodeURIComponent(c), { onclick: () => opts.close && opts.close() })));
      left.appendChild(msg);
    } else {
      pad.appendChild(h('div', { class: 'card center', style: { font: '700 120px/1.2 var(--font-mincho)' }, lang: 'ja' }, c));
    }
    const right = h('div');
    if (k) {
      right.appendChild(h('div', { class: 'row', style: { gap: '8px' } }, h('span', { class: 'kbig-hv' }, k.hv.map((x, i) => h('span', { class: x.rare ? 'rd-hv-rare' : '', title: x.rare ? 'Âm Hán Việt ít dùng' : '' }, (i ? ' / ' : '') + x.t))), uTag(k.u),
        k.list === 'n4' ? h('span', { class: 'tag badge-n4' }, 'N4') : null, h('span', { class: 'tag' }, (k.strokes || '?') + ' nét')));
      right.appendChild(h('div', { style: { fontSize: '17px', margin: '6px 0 14px', color: 'var(--ink-2)' } }, k.meaning));
      right.appendChild(h('dl', { class: 'kread', title: 'Viền nét đứt = âm ít dùng · phần chữ nhạt = okurigana' }, h('dt', null, 'On'), h('dd', null, readingChips(k.on, 'on')), h('dt', null, 'Kun'), h('dd', null, readingChips(k.kun, 'kun'))));
      if (k.fix) right.appendChild(h('div', { class: 'note fix small', style: { marginTop: '12px' } }, ic('pencil'), k.fix));
      right.appendChild(h('div', { class: 'glabel' }, 'Ví dụ'));
      k.ex.forEach((e) => right.appendChild(h('div', { class: 'kex' }, speakBtn(e.r || plain(e.ruby)),
        h('span', { class: 'w', lang: 'ja', html: ruby(e.ruby) }), h('span', { class: 'muted small' }, e.vi),
        e.rare ? h('span', { class: 'tag', title: 'Từ mở rộng (dấu * trong tài liệu)' }, 'mở rộng') : null)));
    } else {
      right.appendChild(h('p', { class: 'muted' }, 'Chữ ngoài danh sách Kanji Unit 13–17.'));
      const vs = D.vocab(G.U.ALL_UNITS).filter((v) => v.kanji.includes(c));
      if (vs.length) {
        right.appendChild(h('div', { class: 'glabel' }, 'Trong từ vựng'));
        vs.forEach((v) => right.appendChild(h('div', { class: 'kex' }, speakBtn(v.kana), h('span', { class: 'w', lang: 'ja', html: ruby(v.ruby) }), h('span', { class: 'muted small' }, v.vi))));
      }
    }
    if (G.KanjiWriter.has(c)) {
      right.appendChild(h('div', { class: 'glabel' }, 'Thứ tự nét'));
      right.appendChild(G.KanjiWriter.filmstrip(c));
    }
    wrap.append(left, right);
    wrap._writer = w;
    return wrap;
  }
  function kanjiModal(c) {
    const m = modal({ titleHtml: `<span lang="ja" style="font-family:var(--font-mincho);font-size:20px">${esc(c)}</span>`, wide: true,
      body: (b, close) => b.appendChild(kanjiPanel(c, { close })),
      onClose: () => { const p = m && m.body.querySelector('.kdetail'); if (p && p._writer) p._writer.stop(); } });
    return m;
  }
  // wrap kanji chars of a plain string with clickable spans
  function kanjiClickable(html) {
    return html.replace(/(<rt>[^<]*<\/rt>)|([一-鿿々])/g, (m, rt, k) => (rt ? rt : `<span class="kj" data-k="${k}">${k}</span>`));
  }

  // ------------------------------------------------------------------ small SVG charts
  const SVGNS = 'http://www.w3.org/2000/svg';
  let uidN = 0;
  const uid = (p) => (p || 'g') + (++uidN);
  function sv(tag, attrs, parent) {
    const e = document.createElementNS(SVGNS, tag);
    if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  // colours go through style so CSS variables (theme tokens) work inside the gradient
  function gradient(defs, id, c1, c2, vertical, o1, o2) {
    const g = sv('linearGradient', Object.assign({ id }, vertical ? { x1: 0, y1: 0, x2: 0, y2: 1 } : { x1: 0, y1: 0, x2: 1, y2: 0 }), defs);
    sv('stop', { offset: '0%', style: `stop-color:${c1};stop-opacity:${o1 == null ? 1 : o1}` }, g);
    sv('stop', { offset: '100%', style: `stop-color:${c2};stop-opacity:${o2 == null ? 1 : o2}` }, g);
    return `url(#${id})`;
  }
  // tiny trend line (values in [min,max])
  function spark(values, opts) {
    opts = opts || {};
    const W = 140, H = 34, n = values.length;
    const max = opts.max != null ? opts.max : Math.max(1, ...values), min = opts.min != null ? opts.min : 0;
    const color = opts.color || 'var(--ink)';
    const svg = sv('svg', { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'none', class: 'spark' });
    if (n < 2) return svg;
    const pts = values.map((v, i) => [(i / (n - 1)) * W, H - 3 - ((v - min) / (max - min || 1)) * (H - 8)]);
    const defs = sv('defs', null, svg);
    const fill = gradient(defs, uid('sp'), color, color, true, 0.22, 0);
    const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
    sv('path', { d: d + ` L${W} ${H} L0 ${H} Z`, fill }, svg);
    sv('path', { d, fill: 'none', stroke: color, 'stroke-width': 2, 'vector-effect': 'non-scaling-stroke', 'stroke-linejoin': 'round' }, svg);
    return svg;
  }
  // charts are drawn at their real pixel width so text stays crisp and the same size in any card
  function dynChart(draw) {
    const box = h('div', { class: 'chart dyn' });
    box._draw = draw;
    let tries = 0;
    const first = () => { if (!paintDyn(box) && ++tries < 30) requestAnimationFrame(first); };
    requestAnimationFrame(first);
    return box;
  }
  function paintDyn(box) {
    const w = Math.round(box.clientWidth);
    if (!w) return false;
    if (w === box._w) return true;
    box._w = w;
    const old = box.querySelector(':scope > svg');
    if (old) old.remove();
    box.appendChild(box._draw(w));
    return true;
  }
  window.addEventListener('resize', G.U.debounce(() => document.querySelectorAll('.chart.dyn').forEach(paintDyn), 120));

  // grouped vertical bars, values 0..100
  function barChart(cats, series, opts) {
    opts = opts || {};
    const H = opts.h || 168, L = 28, R = 6, T = 10, Bm = 24;
    const box = dynChart((W) => {
      const svg = sv('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H });
      const defs = sv('defs', null, svg);
      const grid = sv('g', { class: 'ch-grid' }, svg);
      const axis = sv('g', { class: 'ch-axis' }, svg);
      const ih = H - T - Bm;
      [0, 25, 50, 75, 100].forEach((v) => {
        const y = T + ih - (v / 100) * ih;
        sv('line', { x1: L, x2: W - R, y1: y, y2: y, 'stroke-dasharray': v ? '3 4' : '' }, grid);
        const t = sv('text', { x: L - 6, y: y + 3.5, 'text-anchor': 'end' }, axis); t.textContent = v;
      });
      const gw = (W - L - R) / cats.length;
      const bw = Math.max(5, Math.min(14, gw / (series.length + 1.6)));
      const fills = series.map((s) => gradient(defs, uid('bc'), s.color, s.color2 || s.color, true));
      cats.forEach((c, ci) => {
        const cx = L + gw * ci + gw / 2;
        series.forEach((s, si) => {
          const v = Math.max(0, Math.min(100, s.values[ci] || 0));
          const bh = Math.max(2, (v / 100) * ih);
          const x = cx - (series.length * bw + (series.length - 1) * 4) / 2 + si * (bw + 4);
          const r = sv('rect', { x, y: T + ih - bh, width: bw, height: bh, rx: 3, fill: fills[si], opacity: v ? 1 : .35 }, svg);
          const tt = sv('title', null, r); tt.textContent = `${s.name} · Unit ${c}: ${Math.round(v)}%`;
        });
        const t = sv('text', { x: cx, y: H - 6, 'text-anchor': 'middle', class: 'ch-lbl' }, axis); t.textContent = c;
      });
      return svg;
    });
    box.prepend(h('div', { class: 'ch-legend' }, series.map((s) => h('span', { style: { '--c': s.color } }, s.name))));
    return box;
  }
  // ring of segments [{v, c, label}]
  function donut(segs, big, small) {
    const R = 54, SW = 13, C = 2 * Math.PI * R;
    const total = segs.reduce((s, x) => s + x.v, 0);
    const box = h('div', { class: 'donut' });
    const svg = sv('svg', { viewBox: '0 0 136 136' });
    sv('circle', { cx: 68, cy: 68, r: R, fill: 'none', stroke: 'var(--surface-3)', 'stroke-width': SW }, svg);
    let acc = 0;
    const gap = segs.filter((s) => s.v > 0).length > 1 ? 2.5 : 0;
    segs.forEach((s) => {
      if (!s.v || !total) return;
      const len = (s.v / total) * C;
      sv('circle', { cx: 68, cy: 68, r: R, fill: 'none', stroke: s.c, 'stroke-width': SW, 'stroke-dasharray': `${Math.max(0.5, len - gap)} ${C}`, 'stroke-dashoffset': -acc }, svg);
      acc += len;
    });
    box.append(svg, h('div', { class: 'dv' }, h('b', null, big), h('span', null, small)));
    return box;
  }
  // 270° gauge for 0..100
  function gauge(value, small) {
    const R = 52, SW = 10, C = 2 * Math.PI * R, arc = C * 0.75;
    const v = Math.max(0, Math.min(100, value || 0));
    const box = h('div', { class: 'gauge' });
    const svg = sv('svg', { viewBox: '0 0 132 132' });
    const defs = sv('defs', null, svg);
    const fill = gradient(defs, uid('ga'), 'var(--g3)', 'var(--ink)');
    const g = sv('g', { transform: 'rotate(135 66 66)' }, svg);
    sv('circle', { cx: 66, cy: 66, r: R, fill: 'none', stroke: 'var(--surface-3)', 'stroke-width': SW, 'stroke-dasharray': `${arc} ${C}`, 'stroke-linecap': 'round' }, g);
    if (v > 0) sv('circle', { cx: 66, cy: 66, r: R, fill: 'none', stroke: fill, 'stroke-width': SW, 'stroke-dasharray': `${(arc * v) / 100} ${C}`, 'stroke-linecap': 'round' }, g);
    // ticks
    for (let i = 0; i <= 10; i++) {
      const a = (135 + 27 * i) * Math.PI / 180;
      sv('line', { x1: 66 + Math.cos(a) * 38, y1: 66 + Math.sin(a) * 38, x2: 66 + Math.cos(a) * 41, y2: 66 + Math.sin(a) * 41, stroke: 'var(--line-2)', 'stroke-width': 1.5, 'stroke-linecap': 'round' }, svg);
    }
    box.append(svg, h('div', { class: 'gv' }, h('b', null, String(Math.round(v))), h('span', null, small || '')));
    return box;
  }
  // line chart of percentages [{v, label, title}]
  function lineChart(points, opts) {
    opts = opts || {};
    const H = opts.h || 150, L = 28, R = 12, T = 16, Bm = 22;
    return dynChart((W) => {
      const svg = sv('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H });
      const defs = sv('defs', null, svg);
      const grid = sv('g', { class: 'ch-grid' }, svg);
      const axis = sv('g', { class: 'ch-axis' }, svg);
      const ih = H - T - Bm;
      [0, 50, 100].forEach((v) => {
        const y = T + ih - (v / 100) * ih;
        sv('line', { x1: L, x2: W - R, y1: y, y2: y, 'stroke-dasharray': v ? '3 4' : '' }, grid);
        const t = sv('text', { x: L - 6, y: y + 3.5, 'text-anchor': 'end' }, axis); t.textContent = v;
      });
      const n = points.length;
      const xs = (i) => (n === 1 ? (L + W - R) / 2 : L + 12 + (i / (n - 1)) * (W - L - R - 24));
      const ys = (v) => T + ih - (Math.max(0, Math.min(100, v)) / 100) * ih;
      const d = points.map((p, i) => (i ? 'L' : 'M') + xs(i).toFixed(1) + ' ' + ys(p.v).toFixed(1)).join(' ');
      if (n > 1) {
        const fill = gradient(defs, uid('lc'), 'var(--ink)', 'var(--ink)', true, 0.16, 0);
        sv('path', { d: d + ` L${xs(n - 1)} ${T + ih} L${xs(0)} ${T + ih} Z`, fill }, svg);
        sv('path', { d, fill: 'none', stroke: 'var(--ink)', 'stroke-width': 2, 'stroke-linejoin': 'round' }, svg);
      }
      points.forEach((p, i) => {
        const c = sv('circle', { cx: xs(i), cy: ys(p.v), r: 3.8, fill: 'var(--bg)', stroke: p.v >= 50 ? 'var(--ink)' : 'var(--bad)', 'stroke-width': 2 }, svg);
        if (p.title) { const tt = sv('title', null, c); tt.textContent = p.title; }
        const t = sv('text', { x: xs(i), y: ys(p.v) - 8, 'text-anchor': 'middle', class: 'ch-val' }, svg); t.textContent = Math.round(p.v);
        if (p.label) { const l = sv('text', { x: xs(i), y: H - 5, 'text-anchor': 'middle', class: 'ch-lbl' }, axis); l.textContent = p.label; }
      });
      return svg;
    });
  }
  const ring = (p) => h('div', { class: 'ring', style: { '--p': p }, 'data-v': p + '%' });

  // ------------------------------------------------------------------ generic quiz runner
  // q: {prompt (html), promptCls, sub (html), options [html], answer idx, optCls, explain (html), say (text), accept [..] (input mode), loose, kana}
  function runQuiz(host, questions, opts) {
    opts = opts || {};
    let i = 0, score = 0;
    const results = [];
    const box = h('div', { class: 'qbox fade-in' });
    host.innerHTML = '';
    host.appendChild(box);
    let keyHandler = null;
    function done() {
      document.removeEventListener('keydown', keyHandler);
      const wrong = results.filter((r) => !r.ok);
      box.innerHTML = '';
      const p = Math.round((score / questions.length) * 100);
      box.appendChild(h('div', { class: 'card result-card fade-in' },
        gauge(p, 'điểm'),
        h('div', { class: 'num', style: { fontSize: '17px' } }, `${score} / ${questions.length} câu đúng`),
        h('div', { class: 'row', style: { justifyContent: 'center', marginTop: '14px' } },
          wrong.length ? B('primary', 'rotate', 'Làm lại câu sai (' + wrong.length + ')', () => runQuiz(host, wrong.map((r) => r.q), opts)) : null,
          opts.onRestart ? B('', 'shuffle', 'Bài mới', opts.onRestart) : null)));
      if (wrong.length) {
        const list = h('div', { class: 'card', style: { marginTop: '14px' } }, h('h3', null, ic('xCircle'), 'Câu sai'));
        wrong.forEach((r) => list.appendChild(h('div', { style: { padding: '10px 0', borderTop: '1px solid var(--line)' } },
          h('div', { html: r.q.prompt, class: r.q.promptCls === 'vi' ? '' : 'jp', style: { fontSize: '17px' } }),
          h('div', { class: 'small', style: { marginTop: '4px' } }, h('span', { class: 'tag ok' }, 'Đáp án'), ' ', h('span', { lang: 'ja', html: r.q.options ? r.q.options[r.q.answer] : esc([].concat(r.q.accept)[0]) }),
            r.given != null ? h('span', { class: 'muted' }, '   · bạn chọn: ', h('span', { lang: 'ja', html: r.given })) : null),
          r.q.explain ? h('div', { class: 'small muted', html: r.q.explain }) : null)));
        box.appendChild(list);
      }
      if (opts.onFinish) opts.onFinish({ score, total: questions.length, results });
    }
    function show() {
      if (i >= questions.length) return done();
      const q = questions[i];
      box.innerHTML = '';
      box.appendChild(h('div', { class: 'q-prog' }, h('span', { class: 'small muted' }, `${i + 1}/${questions.length}`),
        h('div', { class: 'bar' }, h('i', { style: { width: (i / questions.length) * 100 + '%' } })), h('span', { class: 'score' }, ic('check'), String(score))));
      const card = h('div', { class: 'card' });
      box.appendChild(card);
      if (q.tag) card.appendChild(h('div', { class: 'row', style: { justifyContent: 'center' }, html: q.tag }));
      card.appendChild(h('div', { class: 'q-prompt ' + (q.promptCls || ''), lang: q.promptCls === 'vi' ? 'vi' : 'ja', html: q.prompt }));
      if (q.say) card.appendChild(h('div', { class: 'center', style: { marginBottom: '6px' } }, B('sm', 'volume', 'Nghe', () => TTS.speak(q.say))));
      if (q.sub) card.appendChild(h('div', { class: 'q-sub', html: q.sub }));
      const fb = h('div');
      let answered = false;
      const next = B('primary', null, i + 1 < questions.length ? 'Câu tiếp' : 'Xem kết quả', () => { i++; show(); }, { style: { marginTop: '14px' } });
      next.appendChild(ic('arrowRight'));
      function finish(ok, givenHtml) {
        answered = true;
        if (ok) score++;
        results.push({ q, ok, given: ok ? null : givenHtml });
        if (opts.onAnswer) opts.onAnswer(q, ok);
        fb.appendChild(h('div', { class: 'feedback ' + (ok ? 'ok' : 'bad') },
          h('span', { class: 'fb-t' }, ic(ok ? 'checkCircle' : 'xCircle'), ok ? 'Chính xác' : 'Chưa đúng'),
          !ok && q.accept ? h('span', null, '  · Đáp án: ', h('b', { lang: 'ja' }, [].concat(q.accept)[0])) : null,
          q.explain ? h('div', { class: 'small', html: q.explain, style: { marginTop: '4px' } }) : null));
        fb.appendChild(h('div', { class: 'center' }, next));
        next.focus();
        if (q.sayAfter) TTS.speak(q.sayAfter);
      }
      if (q.options) {
        const opts2 = h('div', { class: 'opts' });
        q.options.forEach((o, k) => {
          const b = h('button', { class: 'opt ' + (q.optCls || ''), lang: q.optCls === 'jp' ? 'ja' : null, onclick: () => {
            if (answered) return;
            const ok = k === q.answer;
            Array.from(opts2.children).forEach((x, j) => { x.disabled = true; if (j === q.answer) x.classList.add('correct'); else if (j === k) x.classList.add('wrong'); else x.classList.add('dim'); });
            finish(ok, o);
          } }, h('span', { class: 'ok-key' }, String(k + 1)), h('span', { html: o }));
          opts2.appendChild(b);
        });
        card.appendChild(opts2);
      } else {
        const inp = h('input', { class: 'input answer-input', placeholder: q.kana ? 'romaji / かな' : 'Đáp án…' });
        if (q.kana) kanaInput(inp);
        const go = B('primary', 'check', 'Kiểm tra', () => check());
        function check() {
          if (answered) { i++; show(); return; }
          if (!inp.value.trim()) return;
          const ok = sameAns(inp.value, q.accept, q.loose !== false);
          inp.classList.add(ok ? 'ok' : 'bad');
          inp.disabled = true; go.disabled = true;
          finish(ok, esc(inp.value));
        }
        inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); check(); } });
        card.appendChild(h('div', { class: 'row', style: { justifyContent: 'center' } }, inp, go));
        setTimeout(() => inp.focus(), 30);
      }
      card.appendChild(fb);
      if (q.autoSay) TTS.speak(q.autoSay);
    }
    keyHandler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= 9) { const b = box.querySelectorAll('.opt')[n - 1]; if (b && !b.disabled) b.click(); }
      else if (e.key === 'Enter') { const b = box.querySelector('.feedback ~ div .btn.primary, .feedback + div .btn.primary'); if (b) b.click(); }
    };
    document.addEventListener('keydown', keyHandler);
    show();
    return { stop: () => document.removeEventListener('keydown', keyHandler) };
  }

  // distractor helper: pick n other items with different key
  function distractors(pool, item, keyFn, n) {
    const key = keyFn(item);
    const seen = new Set([key]);
    const out = [];
    for (const x of shuffle(pool)) {
      const k = keyFn(x);
      if (!k || seen.has(k)) continue;
      seen.add(k); out.push(x);
      if (out.length >= n) break;
    }
    return out;
  }
  function mcq(pool, item, keyFn, n) {
    const ds = distractors(pool, item, keyFn, (n || 4) - 1);
    const all = shuffle([item].concat(ds));
    return { options: all, answer: all.indexOf(item) };
  }

  // ------------------------------------------------------------------ misc widgets
  function videoModal(url, title) {
    const src = (G.LOCAL_MEDIA || {})[url] || url;
    modal({ title: title || 'Video bài giảng', wide: true, body: h('video', { src, controls: true, autoplay: true, playsinline: true }) });
  }
  function videoBox(url, title) {
    const local = (G.LOCAL_MEDIA || {})[url];
    const src = local || url;
    const d = h('details', { class: 'box' }, h('summary', null, ic('video'), title || 'Video bài giảng', h('span', { class: 'tag', title: local ? 'Đã tải về máy' : 'Cần Internet' }, local ? 'offline' : 'online')));
    const body = h('div', { class: 'box-body' });
    d.appendChild(body);
    d.addEventListener('toggle', () => {
      if (d.open && !body.firstChild) body.appendChild(h('video', { src, controls: true, preload: 'metadata', playsinline: true }));
    });
    return d;
  }
  // Sets the top-bar title and returns a slim bar with a meta label + actions.
  function pageHead(title, jp, actions, meta) {
    if (G.App && G.App.title) G.App.title(title, jp);
    if (!actions && !meta) return document.createDocumentFragment();
    return h('div', { class: 'page-bar' }, meta ? h('span', { class: 'meta' }, meta) : null,
      actions ? h('div', { class: 'actions' }, actions) : null);
  }
  function unitBadges(units) { return h('span', { class: 'row', style: { gap: '4px' } }, units.map((u) => uTag(u))); }
  // unit switcher pills (used by text & essay pages)
  function unitSwitch(active, href) {
    return h('div', { class: 'unit-switch' }, D.units.map((u) => h('a', { class: 'chip u' + (u.id === active ? ' on' : ''), style: { '--c': `var(--u${u.id})` }, href: href + u.id }, h('span', { class: 'dot' }), 'Unit ' + u.id)));
  }
  const infoTip = (text) => h('span', { class: 'info-tip', title: text, tabindex: '0' }, ic('info'));

  G.W = { formula, legend, example, conjTable, giveDiagram, meishiDiagram, kanjiPanel, kanjiModal, kanjiClickable,
    readingChips, runQuiz, mcq, distractors, videoBox, videoModal, pageHead, unitBadges, unitSwitch, infoTip,
    spark, barChart, donut, gauge, lineChart, ring };
})(window);
