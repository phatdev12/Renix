"""Flow test for the vocab and kanji pages of the Astro site (dev/preview server at :4321)."""
import json, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from playwright.sync_api import sync_playwright
from seed import seed_js

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:4321'
out = pathlib.Path(__file__).parent.parent / 'shots_astro'; out.mkdir(exist_ok=True)
fails, errs, media = [], [], []
def ok(cond, msg):
    print(('PASS ' if cond else 'FAIL ') + msg)
    if not cond: fails.append(msg)

with sync_playwright() as p:
    b = p.chromium.launch(channel='msedge', headless=True)
    pg = b.new_page(viewport={'width': 1440, 'height': 900})
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.on('response', lambda r: media.append((r.status, r.url)) if '/media/' in r.url else None)
    pg.goto(BASE + '/'); pg.evaluate(seed_js(), 'dark')
    srs = lambda: json.loads(pg.evaluate("localStorage.getItem('nix.srs') || '{}'"))

    # --- mode switcher navigates between real pages
    pg.goto(BASE + '/vocab/'); pg.wait_for_timeout(500)
    pg.locator('.page-bar .seg button', has_text='Flashcard').click(); pg.wait_for_load_state(); pg.wait_for_timeout(500)
    ok(pg.url.endswith('/vocab/flash/'), 'seg → /vocab/flash/ (' + pg.url + ')')
    ok(pg.locator('#nav a.active').get_attribute('data-k') == 'vocab', 'rail marks vocab active')

    # --- flashcards: flip + grade
    before = srs()
    pg.locator('.flash').click(); pg.wait_for_timeout(300)
    ok('flipped' in (pg.locator('.flash').get_attribute('class') or ''), 'flashcard flips on click')
    prog0 = pg.locator('.q-prog .small').inner_text()
    pg.keyboard.press('2'); pg.wait_for_timeout(300)
    pg.keyboard.press('1'); pg.wait_for_timeout(300)
    after = srs()
    changed = [k for k in after if before.get(k) != after[k]]
    ok(len(changed) == 2, f'grading 2 cards updates nix.srs ({len(changed)} changed, progress {prog0} → {pg.locator(".q-prog .small").inner_text()})')
    pg.screenshot(path=str(out / 'b_flash.png'))

    # --- vocab quiz: answer 10 questions with the first option
    pg.evaluate("localStorage.setItem('nix.vquizUi', JSON.stringify({type:'jv', n:10}))")
    pg.goto(BASE + '/vocab/quiz/'); pg.wait_for_timeout(500)
    for i in range(10):
        pg.locator('.opt').first.click(); pg.wait_for_timeout(80)
        pg.keyboard.press('Enter'); pg.wait_for_timeout(80)
    ok(pg.locator('.result-card').count() == 1, 'vocab quiz reaches result card: ' + (pg.locator('.result-card .num').first.inner_text() if pg.locator('.result-card').count() else '-'))
    tally = json.loads(pg.evaluate("localStorage.getItem('nix.tally')"))
    ok(tally['vocab']['n'] == 30, 'vocab quiz tallies answers (n=%d)' % tally['vocab']['n'])

    # --- typing quiz: correct kana answer via romaji input → hiragana
    pg.evaluate("localStorage.setItem('nix.vquizUi', JSON.stringify({type:'type', n:10}))")
    pg.goto(BASE + '/vocab/quiz/'); pg.wait_for_timeout(500)
    vi = pg.locator('.q-prompt').inner_text().strip()
    units = json.load(open('D:/Nix/src/data/units.json', encoding='utf-8'))['units']
    kana = next(v['kana'] for u in units for v in u['vocab'] if v['vi'] == vi)
    pg.locator('.answer-input').fill(kana); pg.keyboard.press('Enter'); pg.wait_for_timeout(200)
    ok(pg.locator('.feedback.ok').count() == 1, f'typing quiz accepts {kana} for "{vi}"')

    # --- match game: solve the first round using the data
    pg.goto(BASE + '/vocab/match/'); pg.wait_for_timeout(500)
    tiles = pg.locator('.match-grid .tile')
    n = tiles.count()
    texts = [tiles.nth(i).inner_text().strip() for i in range(n)]
    pairs = 0
    for i in range(n):
        if 'done' in (tiles.nth(i).get_attribute('class') or '') or 'jp' not in (tiles.nth(i).get_attribute('class') or ''): continue
        jp = texts[i]
        v = next((v for u in units for v in u['vocab'] if v['kana'] in jp or (v['kanji'] and v['kanji'] in jp)), None)
        if not v: continue
        j = next((j for j in range(n) if texts[j] == v['vi'] and 'jp' not in (tiles.nth(j).get_attribute('class') or '') and 'done' not in (tiles.nth(j).get_attribute('class') or '')), None)
        if j is None: continue
        tiles.nth(i).click(); tiles.nth(j).click(); pg.wait_for_timeout(60)
        if 'done' in (tiles.nth(i).get_attribute('class') or ''): pairs += 1
    ok(pairs >= 3, f'match game pairs tiles ({pairs} pairs of {n // 2})')
    ok(pg.locator('.match-head .tag.pri').count() == 1, 'match head shows round: ' + pg.locator('.match-head').inner_text().replace('\n', ' '))

    # --- ?focus highlights the word (search result link)
    pg.goto(BASE + '/vocab/?focus=15-3'); pg.wait_for_timeout(400)
    outline = pg.evaluate("(document.getElementById('v-15-3')||{style:{}}).style.outline")
    ok('2px' in outline, 'focus=15-3 outlines #v-15-3 (' + outline + ')')
    ok(pg.evaluate("Math.abs(document.getElementById('v-15-3').getBoundingClientRect().top - innerHeight/2) < 300"), 'focused word scrolled into view')

    # --- star toggle persists
    pg.goto(BASE + '/vocab/'); pg.wait_for_timeout(400)
    st = pg.locator('#v-13-1 .star')
    st.click(); pg.wait_for_timeout(100)
    ok('13-1' in json.loads(pg.evaluate("localStorage.getItem('nix.star') || '{}'")), 'star toggle saves nix.star')
    pg.reload(); pg.wait_for_timeout(400)
    ok('on' in (pg.locator('#v-13-1 .star').get_attribute('class') or ''), 'star state survives reload')

    # --- vocab audio: real clip loads (no 404)
    media.clear()
    pg.locator('#v-13-2 .speak').click(); pg.wait_for_timeout(1200)
    voice = [m for m in media if '/media/voice/' in m[1]]
    ok(bool(voice) and all(s in (200, 206, 304) for s, _ in voice), 'vocab speak loads real clip: ' + str(voice[:2]))

    # --- unit filter re-renders the list
    pg.locator('#unit-filter button[data-u="16"]').click(); pg.wait_for_timeout(400)
    ok(pg.locator('.section-title h2').all_inner_texts() == ['Unit 16'], 'unit filter 16 → only Unit 16 section')
    pg.locator('#unit-filter button[data-u="all"]').click(); pg.wait_for_timeout(300)

    # --- kanji grid → modal
    pg.goto(BASE + '/kanji/'); pg.wait_for_timeout(500)
    pg.locator('.ktile').first.click(); pg.wait_for_timeout(800)
    ok(pg.locator('.modal .kdetail').count() == 1, 'kanji tile opens detail modal')
    href = pg.locator('.modal a.btn.primary').get_attribute('href')
    ok(href.startswith('/write/'), 'modal "Tập viết" links to ' + href)
    pg.keyboard.press('Escape')
    pg.goto(BASE + '/kanji/%E7%B6%9A/'); pg.wait_for_timeout(1500)
    ok(pg.locator('.modal .kdetail').count() == 1 and '続' in pg.locator('.modal-head').inner_text(), '/kanji/続/ opens modal for 続')
    pg.screenshot(path=str(out / 'b_kanji_modal.png'))

    # --- kanji quiz (reading) answering
    pg.evaluate("localStorage.setItem('nix.kquizUi', JSON.stringify({type:'read', n:10}))")
    pg.goto(BASE + '/kanji/quiz/'); pg.wait_for_timeout(500)
    ok(pg.locator('#tt-main').inner_text() == 'Trắc nghiệm Kanji', 'kanji quiz title')
    for i in range(10):
        pg.locator('.opt').first.click(); pg.wait_for_timeout(80)
        pg.keyboard.press('Enter'); pg.wait_for_timeout(80)
    ok(pg.locator('.result-card').count() == 1, 'kanji quiz reaches result card')
    ok(json.loads(pg.evaluate("localStorage.getItem('nix.tally')"))['kanji']['n'] == 10, 'kanji quiz tallies answers')

    bad = [m for m in media if m[0] >= 400]
    ok(not bad, 'no media 4xx: ' + str(bad[:3]))
    ok(not errs, 'no JS errors: ' + str(errs[:5]))
    b.close()
print('FAILS:', len(fails))
