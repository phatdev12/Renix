"""usage: check.py <path>[,<path>…] [base]
Loads every path at desktop (1440×900) and phone (390×844) width in dark and light theme with seeded
progress, and reports JS errors, failed requests and horizontal overflow. Default base: http://localhost:4321"""
import pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from playwright.sync_api import sync_playwright
from seed import seed_js

paths = sys.argv[1].split(',')
BASE = sys.argv[2] if len(sys.argv) > 2 else 'http://localhost:4321'
problems = []
with sync_playwright() as p:
    b = p.chromium.launch(channel='msedge', headless=True)
    for vw, vh, tag in [(1440, 900, 'd'), (390, 844, 'm')]:
        for theme in ['dark', 'light']:
            pg = b.new_page(viewport={'width': vw, 'height': vh})
            cur = {'path': ''}
            pg.on('pageerror', lambda e: problems.append(f"{tag}/{theme} {cur['path']}: pageerror {e}"))
            pg.on('console', lambda m: problems.append(f"{tag}/{theme} {cur['path']}: console {m.text}") if m.type == 'error' else None)
            pg.on('requestfailed', lambda r: problems.append(f"{tag}/{theme} {cur['path']}: requestfailed {r.url}"))
            pg.on('response', lambda r: problems.append(f"{tag}/{theme} {cur['path']}: HTTP {r.status} {r.url}") if r.status >= 400 else None)
            pg.goto(BASE + '/'); pg.evaluate(seed_js(), theme)
            for path in paths:
                cur['path'] = path
                pg.goto(BASE + path); pg.wait_for_timeout(700)
                if not pg.evaluate("document.getElementById('main').children.length"):
                    problems.append(f'{tag}/{theme} {path}: #main is empty')
                ov = pg.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
                if ov > 2: problems.append(f'{tag}/{theme} {path}: horizontal overflow {ov}px')
                note = pg.evaluate("(document.querySelector('#main .note.warn')||{}).textContent || ''")
                if 'Có lỗi' in note: problems.append(f'{tag}/{theme} {path}: {note}')
            pg.close()
    b.close()
print('problems:', len(problems))
for x in problems[:60]: print(' ', x)
