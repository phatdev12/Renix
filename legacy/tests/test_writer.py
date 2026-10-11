"""Simulate handwriting on the KanjiWriter: correct strokes (with jitter), reversed and out-of-order strokes."""
import json, math, random, pathlib, sys
from playwright.sync_api import sync_playwright
url = pathlib.Path('D:/Nix/index.html').as_uri()
CHARS = sys.argv[1:] or ['半', '験', '曲', '集', '飯', '働', '親', '誕']
random.seed(7)
with sync_playwright() as p:
    b = p.chromium.launch(channel='msedge', headless=True)
    pg = b.new_page(viewport={'width': 1366, 'height': 1000})
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(url + '#/')
    pg.evaluate("localStorage.setItem('nix.writeUi', JSON.stringify({mode:'test', len:'normal'}))")
    summary = []
    for ch in CHARS:
        pg.evaluate(f"location.hash = '#/write/{ch}'"); pg.wait_for_timeout(500)
        box = pg.locator('.kw svg').bounding_box()
        # sampled stroke points (109 grid) from the page's own KVG data
        pts = pg.evaluate("""(c) => { const s = window.KVG[c].s; const svg = document.createElementNS('http://www.w3.org/2000/svg','svg'); document.body.appendChild(svg);
            const out = s.map(d => { const p = document.createElementNS('http://www.w3.org/2000/svg','path'); p.setAttribute('d', d); svg.appendChild(p);
              const L = p.getTotalLength(); const a = []; for (let i=0;i<=20;i++){ const q = p.getPointAtLength(L*i/20); a.push([q.x,q.y]); } return a; }); svg.remove(); return out; }""", ch)
        def draw(seq, jitter=1.6):
            sx = lambda x: box['x'] + x / 109 * box['width']; sy = lambda y: box['y'] + y / 109 * box['height']
            ox, oy = random.uniform(-2.5, 2.5), random.uniform(-2.5, 2.5)   # whole-stroke offset (hand placement)
            seq = [(x + ox + random.uniform(-jitter, jitter), y + oy + random.uniform(-jitter, jitter)) for x, y in seq]
            pg.mouse.move(sx(seq[0][0]), sy(seq[0][1])); pg.mouse.down()
            for x, y in seq[1:]: pg.mouse.move(sx(x), sy(y), steps=2)
            pg.mouse.up(); pg.wait_for_timeout(60)
            return pg.locator('.kw-msg').inner_text()
        res = []
        # 1) out-of-order: draw the last stroke first (if >2 strokes)
        if len(pts) > 2:
            m = draw(pts[-1]); res.append(('order', 'Sai thứ tự' in m or 'Chưa đúng' in m or 'Ngược' in m, m[:50]))
        # 2) reversed first stroke (only meaningful for long strokes)
        L0 = sum(math.dist(pts[0][i], pts[0][i+1]) for i in range(20))
        if L0 > 25:
            m = draw(list(reversed(pts[0]))); res.append(('reverse', 'Ngược' in m, m[:50]))
        # 3) correct strokes in order
        oks = 0
        for i, s in enumerate(pts):
            m = draw(s)
            ok = ('Đúng' in m) or ('Hoàn' in m) or ('hoàn hảo' in m.lower())
            if not ok:  # one retry, as a user would
                m = draw(s); ok = ('Đúng' in m) or ('Hoàn' in m)
            oks += ok
        final = pg.locator('.kw-msg').inner_text()
        summary.append((ch, len(pts), oks, [r[:2] for r in res], final[:40]))
    for s in summary: print(s)
    print('errors:', errs)
    b.close()
