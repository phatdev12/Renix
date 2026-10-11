"""Draw every stroke of every unit kanji through real pointer events; report first rejected stroke."""
import math, random, pathlib, sys
from playwright.sync_api import sync_playwright
url = pathlib.Path('D:/Nix/index.html').as_uri()
JIT = float(sys.argv[1]) if len(sys.argv) > 1 else 0.8
OFF = float(sys.argv[2]) if len(sys.argv) > 2 else 2.5
random.seed(11)
with sync_playwright() as p:
    b = p.chromium.launch(channel='msedge', headless=True)
    pg = b.new_page(viewport={'width': 1366, 'height': 1000})
    pg.goto(url + '#/')
    pg.evaluate("localStorage.setItem('nix.writeUi', JSON.stringify({mode:'test', len:'normal'}))")
    chars = pg.evaluate("NIX.units.flatMap(u => u.kanji.map(k => k.c))")
    fails, total_strokes, rejected = [], 0, 0
    for ch in chars:
        pg.evaluate(f"location.hash = '#/write/{ch}'"); pg.wait_for_timeout(250)
        box = pg.locator('.kw svg').bounding_box()
        pts = pg.evaluate("""(c) => { const s = window.KVG[c].s; const svg = document.createElementNS('http://www.w3.org/2000/svg','svg'); document.body.appendChild(svg);
            const out = s.map(d => { const p = document.createElementNS('http://www.w3.org/2000/svg','path'); p.setAttribute('d', d); svg.appendChild(p);
              const L = p.getTotalLength(); const n = Math.max(6, Math.round(L/2.5)); const a = []; for (let i=0;i<=n;i++){ const q = p.getPointAtLength(L*i/n); a.push([q.x,q.y]); } return a; }); svg.remove(); return out; }""", ch)
        sx = lambda x: box['x'] + x / 109 * box['width']; sy = lambda y: box['y'] + y / 109 * box['height']
        first_fail = None
        for i, s in enumerate(pts):
            total_strokes += 1
            ok = False
            for attempt in range(2):
                ox, oy = random.uniform(-OFF, OFF), random.uniform(-OFF, OFF)
                seq = [(x + ox + random.uniform(-JIT, JIT), y + oy + random.uniform(-JIT, JIT)) for x, y in s]
                pg.mouse.move(sx(seq[0][0]), sy(seq[0][1])); pg.mouse.down()
                for x, y in seq[1:]: pg.mouse.move(sx(x), sy(y))
                pg.mouse.up()
                m = pg.locator('.kw-msg').inner_text()
                ok = ('Đúng' in m) or ('Hoàn' in m)
                if ok: break
                rejected += 1
            if not ok:
                first_fail = (i + 1, m[:60]); break
        if first_fail: fails.append((ch, len(pts), first_fail))
    print(f'jitter={JIT} offset={OFF}: {len(chars)-len(fails)}/{len(chars)} kanji completed; strokes={total_strokes}; first-try rejections={rejected}')
    for f in fails: print('  FAIL', f)
    b.close()
