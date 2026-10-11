"""Flow test for the text / essay / grammar pages of the Astro site (dev or preview at :4321).
usage: flow_a.py [outdir]"""
import pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from playwright.sync_api import sync_playwright
from seed import seed_js

BASE = 'http://localhost:4321'
out = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else 'shots_astro'); out.mkdir(parents=True, exist_ok=True)
fails = []
def check(cond, msg):
    print(('ok   ' if cond else 'FAIL ') + msg)
    if not cond: fails.append(msg)

with sync_playwright() as p:
    b = p.chromium.launch(channel='msedge', headless=True, args=['--autoplay-policy=no-user-gesture-required'])
    pg = b.new_page(viewport={'width': 1440, 'height': 900})
    errs, voice = [], []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.on('response', lambda r: voice.append((r.status, r.url)) if '/media/voice/' in r.url else None)
    pg.goto(BASE + '/'); pg.evaluate(seed_js(), 'dark')

    # ---- text page: sentence click → dock + real voice clip
    pg.goto(BASE + '/text/14/'); pg.wait_for_timeout(800)
    check(pg.locator('#tt-main').inner_text() == 'Bài khóa · Unit 14', 'text title: ' + pg.locator('#tt-main').inner_text())
    check(pg.title() == 'Bài khóa · Unit 14 · Renix', 'doc title: ' + pg.title())
    check(pg.locator('.unit-switch a.on').inner_text().strip() == 'Unit 14', 'unit switch marks Unit 14')
    pg.locator('.sent').nth(2).click(); pg.wait_for_timeout(1200)
    check(pg.locator('.dock-pos').inner_text().startswith('Câu 3/'), 'dock: ' + pg.locator('.dock-pos').inner_text())
    check(pg.locator('.sent.active').count() == 1, 'one active sentence')
    check(any(s == 200 or s == 206 for s, _ in voice), 'voice clip loaded: ' + str(voice[:2]))
    check(all(s < 400 for s, _ in voice), 'no failed voice requests')
    pg.keyboard.press('ArrowRight'); pg.wait_for_timeout(400)
    check(pg.locator('.dock-pos').inner_text().startswith('Câu 4/'), 'ArrowRight → next sentence')
    # kanji in the dock opens the kanji modal
    if pg.locator('.dock-jp .kj').count():
        pg.locator('.dock-jp .kj').first.click(); pg.wait_for_timeout(500)
        check(pg.locator('.modal .kdetail').count() == 1, 'kanji modal from dock')
        pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
    # play all advances on its own, stop works
    pg.locator('button:has-text("Nghe cả bài")').click()
    seen = []
    for i in range(6):
        pg.wait_for_timeout(1000); seen.append(pg.locator('.dock-pos').inner_text())
    check(len(set(seen)) >= 2, 'play-all advances: ' + str(seen))
    pg.locator('button:has-text("Dừng")').click(); pg.wait_for_timeout(200)
    check(pg.locator('button:has-text("Dừng")').is_hidden(), 'stop hides button')
    pg.locator('button:has-text("Shadowing")').click(); pg.wait_for_timeout(1500)
    check(pg.locator('.toast').count() >= 1, 'shadowing toast')
    pg.locator('button:has-text("Dừng")').click()
    # toolbar toggles
    pg.locator('button:has-text("Dịch")').click(); pg.wait_for_timeout(150)
    check(pg.locator('.para-vi:visible').count() > 0, 'translation shown')
    pg.locator('button:has-text("Dịch")').click()
    # resources
    pg.locator('button:has-text("Ngữ điệu")').click(); pg.wait_for_timeout(400)
    check(pg.locator('.modal .guide-grid img').count() > 0, 'pitch guide images')
    imgs_ok = pg.evaluate("Promise.all(Array.from(document.querySelectorAll('.modal .guide-grid img')).slice(0,2).map(i => i.decode().then(() => i.naturalWidth > 0, () => false)))")
    check(all(imgs_ok), 'guide images load')
    pg.keyboard.press('Escape')
    # unit switch link → another page
    pg.locator('.unit-switch a', has_text='Unit 17').click(); pg.wait_for_url('**/text/17/'); pg.wait_for_timeout(600)
    check(pg.locator('#tt-main').inner_text() == 'Bài khóa · Unit 17', 'unit switch navigates to 17')
    pg.locator('.sent').nth(1).click(); pg.wait_for_timeout(700)
    pg.screenshot(path=str(out / 'a_text17.png'))
    # /text/ with a unit filter picks the first selected unit
    pg.evaluate("localStorage.setItem('nix.settings', JSON.stringify(Object.assign(JSON.parse(localStorage.getItem('nix.settings')||'{}'), {units:[15,16]})))")
    pg.goto(BASE + '/text/'); pg.wait_for_timeout(600)
    check(pg.locator('#tt-main').inner_text() == 'Bài khóa · Unit 15', '/text/ uses first selected unit')
    pg.evaluate("localStorage.setItem('nix.settings', JSON.stringify(Object.assign(JSON.parse(localStorage.getItem('nix.settings')||'{}'), {units:[13,14,15,16,17]})))")

    # ---- grammar focus
    pg.goto(BASE + '/grammar/17-2/'); pg.wait_for_timeout(800)
    card = pg.locator('#g-17-2')
    check('open' in (card.get_attribute('class') or ''), 'focused grammar card open')
    top = pg.evaluate("document.getElementById('g-17-2').getBoundingClientRect().top")
    check(0 <= top < 300, f'focused card scrolled into view (top={top:.0f})')
    pg.screenshot(path=str(out / 'a_grammar_17-2.png'))
    pg.locator('#g-17-2 a:has-text("Bài tập Unit 17")').click(); pg.wait_for_timeout(500)
    check('/bank/' in pg.url and 'unit=17' in pg.url and 'part=3' in pg.url, 'exercise link → ' + pg.url)

    # ---- essay
    pg.goto(BASE + '/essay/13/'); pg.wait_for_timeout(700)
    check(pg.locator('.model p[lang=ja]').count() > 2, 'essay model text rendered (unit 13 open)')
    pg.locator('.essay-area').fill('わたしは、毎朝、七時に起きます。起きたら、すぐに歯をみがいて、朝ごはんを食べます。新聞を読みながら食べます。')
    pg.wait_for_timeout(500)
    on = pg.locator('.check-item.on').count()
    check(on >= 3, f'essay pattern checks: {on}/{pg.locator(".check-item").count()}')
    pg.goto(BASE + '/essay/13/'); pg.wait_for_timeout(500)
    check('七時' in pg.locator('.essay-area').input_value(), 'essay draft persisted')
    pg.locator('.unit-switch a', has_text='Unit 17').click(); pg.wait_for_url('**/essay/17/'); pg.wait_for_timeout(500)
    check(pg.locator('.check-item').count() == 4, 'essay unit 17 checks')

    check(not errs, 'no JS errors ' + str(errs[:5]))
    b.close()
print('FAILS:', len(fails))
