"""Check the cross-page view transition: sample the rail pill position during a navigation."""
import pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from playwright.sync_api import sync_playwright
from seed import seed_js
out = pathlib.Path(sys.argv[1]); out.mkdir(parents=True, exist_ok=True)
with sync_playwright() as p:
    b = p.chromium.launch(channel='msedge', headless=True)
    pg = b.new_page(viewport={'width': 1440, 'height': 900})
    pg.goto('http://localhost:4321/'); pg.evaluate(seed_js(), 'dark')
    pg.goto('http://localhost:4321/'); pg.wait_for_timeout(800)
    print('vt supported:', pg.evaluate("'startViewTransition' in document && CSS.supports('view-transition-name: a')"))
    pg.locator('#nav a[data-k="exam"]').click()
    for i in range(6):
        pg.wait_for_timeout(80)
        pg.screenshot(path=str(out / f'vt_{i}.png'), clip={'x': 0, 'y': 150, 'width': 520, 'height': 650})
    pg.wait_for_timeout(600)
    r = pg.evaluate("(() => { const i = document.querySelector('#nav .nav-ind').getBoundingClientRect(); const a = document.querySelector('#nav a.active').getBoundingClientRect(); return [location.pathname, Math.round(i.top), Math.round(a.top)]; })()")
    print('after:', r)
    pg.screenshot(path=str(out / 'vt_end.png'), clip={'x': 0, 'y': 150, 'width': 520, 'height': 650})
    b.close()
