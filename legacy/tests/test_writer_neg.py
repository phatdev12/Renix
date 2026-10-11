"""Negative test: before each correct stroke, try a wrong stroke (another stroke of the same kanji, or the
reversed stroke). Count how often the writer wrongly accepts it."""
import math, random, pathlib, sys
from playwright.sync_api import sync_playwright
url = pathlib.Path('D:/Nix/index.html').as_uri()
random.seed(5)
JIT = 0.8
with sync_playwright() as p:
    b = p.chromium.launch(channel='msedge', headless=True)
    pg = b.new_page(viewport={'width': 1366, 'height': 1000})
    pg.goto(url + '#/')
    pg.evaluate("localStorage.setItem('nix.writeUi', JSON.stringify({mode:'test', len:'normal'}))")
    chars = pg.evaluate("NIX.units.flatMap(u => u.kanji.map(k => k.c))")
    random.shuffle(chars); chars = chars[:30]
    stats = {'wrong_tested': 0, 'wrong_accepted': 0, 'rev_tested': 0, 'rev_accepted': 0}
    accepted_examples = []
    for ch in chars:
        pg.evaluate(f"location.hash = '#/write/{ch}'"); pg.wait_for_timeout(250)
        box = pg.locator('.kw svg').bounding_box()
        pts = pg.evaluate("""(c) => { const s = window.KVG[c].s; const svg = document.createElementNS('http://www.w3.org/2000/svg','svg'); document.body.appendChild(svg);
            const out = s.map(d => { const p = document.createElementNS('http://www.w3.org/2000/svg','path'); p.setAttribute('d', d); svg.appendChild(p);
              const L = p.getTotalLength(); const n = Math.max(5, Math.round(L/4)); const a = []; for (let i=0;i<=n;i++){ const q = p.getPointAtLength(L*i/n); a.push([q.x,q.y]); } return a; }); svg.remove(); return out; }""", ch)
        sx = lambda x: box['x'] + x / 109 * box['width']; sy = lambda y: box['y'] + y / 109 * box['height']
        def draw(s):
            seq = [(x + random.uniform(-JIT, JIT), y + random.uniform(-JIT, JIT)) for x, y in s]
            pg.mouse.move(sx(seq[0][0]), sy(seq[0][1])); pg.mouse.down()
            for x, y in seq[1:]: pg.mouse.move(sx(x), sy(y))
            pg.mouse.up()
            m = pg.locator('.kw-msg').inner_text()
            return ('Đúng' in m) or ('Hoàn' in m)
        def plen(s): return sum(math.dist(s[k], s[k+1]) for k in range(len(s)-1))
        def avgd(a, b2):
            # compare resampled shapes to decide if 'wrong' stroke is genuinely different
            def rs(s, n=16):
                L=[0]
                for k in range(1,len(s)): L.append(L[-1]+math.dist(s[k-1],s[k]))
                T=L[-1] or 1; out=[]; j=0
                for k in range(n):
                    t=T*k/(n-1)
                    while j<len(L)-2 and L[j+1]<t: j+=1
                    seg=(L[j+1]-L[j]) or 1; a2=(t-L[j])/seg
                    out.append((s[j][0]+(s[j+1][0]-s[j][0])*a2, s[j][1]+(s[j+1][1]-s[j][1])*a2))
                return out
            A, B = rs(a), rs(b2)
            return sum(math.dist(x, y) for x, y in zip(A, B)) / len(A)
        for i, s in enumerate(pts):
            others = [j for j in range(len(pts)) if j != i and avgd(pts[j], s) > 18]
            if others:
                j = random.choice(others)
                stats['wrong_tested'] += 1
                if draw(pts[j]):
                    stats['wrong_accepted'] += 1; accepted_examples.append((ch, i+1, 'drew', j+1))
                    continue  # writer advanced already
            if plen(s) > 25:
                stats['rev_tested'] += 1
                if draw(list(reversed(s))):
                    stats['rev_accepted'] += 1; accepted_examples.append((ch, i+1, 'reversed'))
                    continue
            if not draw(s): draw(s)
    print(stats)
    print('false accepts:', accepted_examples[:20])
    b.close()
