"""usage: shot.py <outdir> <path>[,<path>…] [d|m] [dark|light] — screenshots of the Astro preview (http://localhost:4321)."""
import pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from playwright.sync_api import sync_playwright
from seed import seed_js

BASE = 'http://localhost:4321'
out = pathlib.Path(sys.argv[1]); out.mkdir(parents=True, exist_ok=True)
paths = sys.argv[2].split(',')
mode = sys.argv[3] if len(sys.argv) > 3 else 'd'
theme = sys.argv[4] if len(sys.argv) > 4 else 'dark'
vw, vh = (1440, 900) if mode == 'd' else (390, 844)
with sync_playwright() as p:
    b = p.chromium.launch(channel='msedge', headless=True)
    pg = b.new_page(viewport={'width': vw, 'height': vh})
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.goto(BASE + '/'); pg.evaluate(seed_js(), theme)
    for path in paths:
        pg.goto(BASE + path); pg.wait_for_timeout(900)
        name = (mode + '_' + theme + '_' + (path.strip('/').replace('/', '_').replace('?', '_') or 'home'))[:80]
        pg.screenshot(path=str(out / (name + '.png')))
    print('errors:', errs)
    b.close()
