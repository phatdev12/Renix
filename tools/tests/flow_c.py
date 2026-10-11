"""Flows for the write + conj pages of the Astro site (dev server at http://localhost:4321).
- handwriting: draw KanjiVG strokes with the mouse (jitter), wrong order / reversed strokes rejected, result saved
- writer navigation: →/← keys, "Chữ tiếp" button, URL follows the character (keeps ?unit=), reload lands on it
- conj: table↔drill switch, drill typed answer (right + wrong) and multiple choice update nix.conj"""
import json, math, random, sys, urllib.parse
from playwright.sync_api import sync_playwright

BASE = 'http://localhost:4321'
KVG = json.load(open('D:/Nix/src/data/kanjivg.json', encoding='utf-8'))
CHARS = sys.argv[1:] or ['半', '験', '曲', '集', '飯', '働', '親', '誕']
random.seed(7)
fails = []
def check(cond, label):
    print(('OK   ' if cond else 'FAIL ') + label)
    if not cond: fails.append(label)

with sync_playwright() as p:
    b = p.chromium.launch(channel='msedge', headless=True)
    pg = b.new_page(viewport={'width': 1366, 'height': 1000})
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.goto(BASE + '/')
    pg.evaluate("localStorage.clear(); localStorage.setItem('nix.writeUi', JSON.stringify({mode:'test', len:'normal'}))")

    # ---------------------------------------------------------------- handwriting
    for ch in CHARS:
        pg.goto(BASE + '/write/' + urllib.parse.quote(ch) + '/'); pg.wait_for_timeout(500)
        box = pg.locator('.kw svg').bounding_box()
        pts = pg.evaluate("""(s) => { const svg = document.createElementNS('http://www.w3.org/2000/svg','svg'); document.body.appendChild(svg);
            const out = s.map(d => { const p = document.createElementNS('http://www.w3.org/2000/svg','path'); p.setAttribute('d', d); svg.appendChild(p);
              const L = p.getTotalLength(); const a = []; for (let i=0;i<=20;i++){ const q = p.getPointAtLength(L*i/20); a.push([q.x,q.y]); } return a; }); svg.remove(); return out; }""", KVG[ch]['s'])
        def draw(seq, jitter=1.6):
            sx = lambda x: box['x'] + x / 109 * box['width']; sy = lambda y: box['y'] + y / 109 * box['height']
            ox, oy = random.uniform(-2.5, 2.5), random.uniform(-2.5, 2.5)
            seq = [(x + ox + random.uniform(-jitter, jitter), y + oy + random.uniform(-jitter, jitter)) for x, y in seq]
            pg.mouse.move(sx(seq[0][0]), sy(seq[0][1])); pg.mouse.down()
            for x, y in seq[1:]: pg.mouse.move(sx(x), sy(y), steps=2)
            pg.mouse.up(); pg.wait_for_timeout(60)
            return pg.locator('.kw-msg').inner_text()
        res = []
        if len(pts) > 2:
            m = draw(pts[-1]); res.append('Sai thứ tự' in m or 'Chưa đúng' in m or 'Ngược' in m)
        L0 = sum(math.dist(pts[0][i], pts[0][i + 1]) for i in range(20))
        if L0 > 25:
            m = draw(list(reversed(pts[0]))); res.append('Ngược' in m)
        oks = 0
        for s in pts:
            m = draw(s)
            ok = ('Đúng' in m) or ('Hoàn' in m)
            if not ok:
                m = draw(s); ok = ('Đúng' in m) or ('Hoàn' in m)
            oks += ok
        final = pg.locator('.kw-msg').inner_text()
        rec = pg.evaluate(f"(JSON.parse(localStorage.getItem('nix.kanji')||'{{}}'))[{json.dumps(ch)}] || null")
        check(oks == len(pts) and all(res) and 'Hoàn' in final and rec and rec['n'] >= 1,
              f'write {ch}: {oks}/{len(pts)} strokes accepted, rejects {res}, final "{final[:30]}", saved {rec}')

    # ---------------------------------------------------------------- writer navigation
    pg.goto(BASE + '/write/'); pg.wait_for_timeout(500)
    first = pg.locator('.kstrip button.on').inner_text()[:1]
    check(urllib.parse.unquote(pg.evaluate('location.pathname')) == f'/write/{first}/', f'/write/ → URL follows first char {first}')
    pg.keyboard.press('ArrowRight'); pg.wait_for_timeout(300)
    second = pg.locator('.kstrip button.on').inner_text()[:1]
    check(second != first and urllib.parse.unquote(pg.evaluate('location.pathname')) == f'/write/{second}/', f'→ moves to {second}, URL updated')
    pg.keyboard.press('ArrowLeft'); pg.wait_for_timeout(300)
    check(pg.locator('.kstrip button.on').inner_text()[:1] == first, '← moves back')
    pg.locator('button:has-text("Chữ tiếp")').click(); pg.wait_for_timeout(300)
    check(pg.locator('.kstrip button.on').inner_text()[:1] == second, '"Chữ tiếp" moves on')
    pg.reload(); pg.wait_for_timeout(600)
    check(pg.locator('.kstrip button.on').inner_text()[:1] == second and pg.locator('.kinfo-head .kc').inner_text() == second, 'reload lands on the same char')
    pg.goto(BASE + '/write/?unit=15'); pg.wait_for_timeout(500)
    pg.keyboard.press('ArrowRight'); pg.wait_for_timeout(300)
    c15 = pg.locator('.kstrip button.on').inner_text()[:1]
    check(urllib.parse.unquote(pg.evaluate('location.pathname + location.search')) == f'/write/{c15}/?unit=15', f'?unit=15 kept in URL ({c15})')
    check(pg.locator('a:has-text("Bỏ lọc")').get_attribute('href') == '/write/', '"Bỏ lọc" → /write/')

    # ---------------------------------------------------------------- conj
    pg.goto(BASE + '/conj/'); pg.wait_for_timeout(500)
    check(pg.locator('table.ctable tr').count() > 50, 'conj table rows')
    pg.locator('.page-bar .seg button:has-text("Luyện chia")').click(); pg.wait_for_url('**/conj/drill/'); pg.wait_for_timeout(500)
    check(pg.locator('.conj-q').count() == 1, 'switch to /conj/drill/')
    answer_js = """async () => {
      const C = await import('/src/lib/conjugate.ts'); const W = await import('/src/lib/widgets.ts'); const T = await import('/src/lib/text.ts');
      const html = document.querySelector('.conj-q').innerHTML; const jp = document.querySelector('.conj-target b').textContent;
      const v = W.VERBS.find((x) => T.ruby(x.ruby) === html && document.querySelector('.conj-q').nextElementSibling.textContent === x.vi);
      const f = C.FORMS.find((x) => x.jp === jp); return { kana: C.conj(v.m, v.g, f.id), kanji: C.conj(v.k, v.g, f.id) }; }"""
    pg.evaluate("localStorage.setItem('nix.conjDrill', JSON.stringify({forms:['jisho','nai','ta','te','kanou'], set:'all', mode:'type', showG:true})); localStorage.removeItem('nix.conj')")
    pg.reload(); pg.wait_for_timeout(500)
    ans = pg.evaluate(answer_js)
    pg.locator('.answer-input').fill(ans['kana']); pg.keyboard.press('Enter'); pg.wait_for_timeout(200)
    check(pg.locator('.feedback.ok').count() == 1, f'typed right answer {ans["kana"]} → Chính xác')
    pg.keyboard.press('Enter'); pg.wait_for_timeout(300)
    pg.locator('.answer-input').fill('zzz'); pg.keyboard.press('Enter'); pg.wait_for_timeout(200)
    check(pg.locator('.feedback.bad').count() == 1, 'typed wrong answer → Chưa đúng')
    c = pg.evaluate("JSON.parse(localStorage.getItem('nix.conj'))")
    check(c['n'] == 2 and c['ok'] == 1, f'nix.conj after typing {c}')
    pg.locator('.conj-settings .seg button:has-text("Chọn")').click(); pg.wait_for_timeout(300)
    ans = pg.evaluate(answer_js)
    opts = pg.locator('.opt')
    texts = [opts.nth(i).inner_text() for i in range(opts.count())]
    k = next(i for i, t in enumerate(texts) if ans['kanji'] in t)
    pg.keyboard.press(str(k + 1)); pg.wait_for_timeout(200)
    check(pg.locator('.opt.correct').count() == 1 and pg.locator('.feedback.ok').count() == 1, f'choice via key {k + 1} correct')
    c = pg.evaluate("JSON.parse(localStorage.getItem('nix.conj'))")
    check(c['n'] == 3 and c['ok'] == 2, f'nix.conj after choice {c}')
    check('Tổng 2/3' in pg.locator('.small.muted.num').last.inner_text(), 'stat line shows total')
    pg.locator('.page-bar .seg button:has-text("Bảng chia")').click(); pg.wait_for_url('**/conj/'); pg.wait_for_timeout(300)
    check(pg.locator('table.ctable').count() >= 1, 'switch back to /conj/')

    check(not errs, f'no JS errors {errs[:5]}')
    b.close()
print('FAILED:', fails if fails else 'none')
