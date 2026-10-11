"""Load the site in headless Edge, visit routes, report console errors, save screenshots.
usage: shot.py <outdir> <route> [<route> ...]   (route like "#/vocab")"""
import sys, pathlib
from playwright.sync_api import sync_playwright
out = pathlib.Path(sys.argv[1]); out.mkdir(parents=True, exist_ok=True)
routes = sys.argv[2:] or ['#/']
url = pathlib.Path('D:/Nix/index.html').as_uri()
W = int(__import__('os').environ.get('W', '1366')); H = int(__import__('os').environ.get('H', '900'))
with sync_playwright() as p:
    b = p.chromium.launch(channel='msedge', headless=True)
    pg = b.new_page(viewport={'width': W, 'height': H}, device_scale_factor=1)
    errs = []
    pg.on('console', lambda m: errs.append(f'[{m.type}] {m.text}') if m.type in ('error', 'warning') else None)
    pg.on('pageerror', lambda e: errs.append(f'[pageerror] {e}'))
    pg.on('requestfailed', lambda r: errs.append(f'[reqfail] {r.url[-80:]} {r.failure}'))
    pg.goto(url + routes[0]); pg.wait_for_timeout(900)
    for i, r in enumerate(routes):
        if i: pg.evaluate(f"location.hash = {r[1:]!r}"); pg.wait_for_timeout(900)
        name = r.strip('#/').replace('/', '_').replace('?', '_') or 'home'
        full = os = None
        pg.screenshot(path=str(out / f'{name}.png'), full_page=bool(int(__import__('os').environ.get('FULL', '0'))))
        print('shot', r)
    for e in errs: print(e)
    b.close()
