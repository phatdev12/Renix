import pathlib, sys, random
from playwright.sync_api import sync_playwright
url = pathlib.Path('D:/Nix/index.html').as_uri()
out = pathlib.Path(sys.argv[1]); out.mkdir(exist_ok=True)


def run(pg, js):
    return pg.evaluate(js)


with sync_playwright() as p:
    b = p.chromium.launch(channel='msedge', headless=True)
    pg = b.new_page(viewport={'width': 1280, 'height': 950})
    errs = []
    pg.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)))
    pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
    pg.on('dialog', lambda d: d.accept())
    pg.goto(url + '#/'); pg.wait_for_timeout(500)

    # --- exam
    run(pg, "location.hash='#/exam'"); pg.wait_for_timeout(400)
    pg.locator('button:has-text("Bắt đầu")').click(); pg.wait_for_timeout(600)
    n = pg.locator('.qcard').count()
    for i in range(n):
        c = pg.locator('.qcard').nth(i)
        k = c.locator('.opt').count()
        if k:
            c.locator('.opt').nth(random.randrange(k)).click()
        else:
            for j in range(c.locator('.chips-pool .wchip').count()):
                w = c.locator('.chips-pool .wchip').nth(j)
                if 'used' not in (w.get_attribute('class') or ''):
                    w.click()
    pg.locator('button:has-text("Nộp bài")').first.click(); pg.wait_for_timeout(600)
    print('exam questions:', n, '| result:', pg.locator('.result-big').first.inner_text())
    pg.screenshot(path=str(out / 'exam_result.png'))

    # --- vocab quiz: answer 10 by clicking first option
    run(pg, "location.hash='#/vocab/quiz'"); pg.wait_for_timeout(400)
    for i in range(10):
        pg.locator('.opt').first.click(); pg.wait_for_timeout(50)
        pg.keyboard.press('Enter'); pg.wait_for_timeout(60)
    print('vocab quiz result:', pg.locator('.result-big').inner_text() if pg.locator('.result-big').count() else 'NO RESULT')

    # --- vocab typing quiz with correct answer from data
    run(pg, "localStorage.setItem('nix.vquizUi', JSON.stringify({type:'type', n:10})); location.hash='#/vocab'")
    run(pg, "location.hash='#/vocab/quiz'"); pg.wait_for_timeout(400)
    prompt = pg.locator('.q-prompt').inner_text()
    kana = pg.evaluate("(p) => { const v = U.D.vocab().find(x => x.vi === p); return v ? v.kana : null; }", prompt)
    pg.locator('.answer-input').fill(kana or 'x'); pg.keyboard.press('Enter'); pg.wait_for_timeout(100)
    print('typing quiz:', prompt, '->', kana, '|', pg.locator('.feedback').inner_text()[:40])

    # --- kanji reading quiz
    run(pg, "localStorage.setItem('nix.kquizUi', JSON.stringify({type:'read', n:10})); location.hash='#/kanji'")
    run(pg, "location.hash='#/kanji/quiz'"); pg.wait_for_timeout(400)
    print('kanji read q:', pg.locator('.q-prompt').inner_text(), '| options:',
          [pg.locator('.opt').nth(i).inner_text().replace('\n', ' ') for i in range(pg.locator('.opt').count())])

    # --- conj drill wrong answer feedback
    run(pg, "localStorage.setItem('nix.conjDrill', JSON.stringify({forms:['te'], set:'all', mode:'type', showG:true})); location.hash='#/conj'")
    run(pg, "location.hash='#/conj/drill'"); pg.wait_for_timeout(400)
    verb = pg.locator('.conj-q').inner_text().split('\n')[-1]
    pg.locator('.answer-input').click(); pg.keyboard.type('zzz'); pg.keyboard.press('Enter'); pg.wait_for_timeout(150)
    print('conj wrong:', verb, '|', pg.locator('.feedback').inner_text()[:150].replace('\n', ' | '))
    pg.screenshot(path=str(out / 'conj_feedback.png'))

    # --- flashcards: flip + grade 3 cards
    run(pg, "location.hash='#/vocab/flash'"); pg.wait_for_timeout(400)
    for i in range(3):
        pg.keyboard.press('Space'); pg.wait_for_timeout(600)
        if i == 0:
            pg.screenshot(path=str(out / 'flash_back.png'))
        pg.keyboard.press('2'); pg.wait_for_timeout(100)
    print('srs entries:', run(pg, "Object.keys(U.SRS.all()).length"))

    # --- search
    pg.locator('#search').fill('kekkon'); pg.wait_for_timeout(350)
    print('search kekkon:', pg.locator('.sr-item').count(), '| first:', pg.locator('.sr-item').first.inner_text().replace('\n', ' '))
    pg.locator('#search').fill('nghiên cứu'); pg.wait_for_timeout(350)
    print('search nghien cuu:', pg.locator('.sr-item').count(), '| first:', pg.locator('.sr-item').first.inner_text().replace('\n', ' '))
    pg.screenshot(path=str(out / 'search.png'))
    pg.keyboard.press('Escape')

    # --- unit filter: only 16
    run(pg, "location.hash='#/vocab'"); pg.wait_for_timeout(300)
    pg.locator('#unit-filter .chip', has_text='16').click(); pg.wait_for_timeout(300)
    print('filter 16 -> vocab head:', pg.locator('.page-head .jp-sub').inner_text(), '| top:', pg.locator('#top-units').inner_text())
    pg.locator('#unit-filter .chip', has_text='Tất cả').click(); pg.wait_for_timeout(200)

    # --- essay detection
    run(pg, "location.hash='#/essay/13'"); pg.wait_for_timeout(300)
    pg.locator('.essay-area').fill('わたしは、毎朝、七時に起きます。起きたら、すぐに歯をみがいて、朝ごはんを食べます。新聞を読みながら食べます。')
    pg.wait_for_timeout(500)
    on = pg.locator('.check-item.on')
    print('essay checks:', on.count(), '/', pg.locator('.check-item').count(), [on.nth(i).inner_text() for i in range(on.count())])

    # --- grammar cards / kanji modal screenshots
    for gid in ['17-1', '15-2', '14-1', '13-3', '15-6']:
        run(pg, f"location.hash='#/grammar/{gid}'"); pg.wait_for_timeout(500)
        pg.screenshot(path=str(out / f'grammar_{gid}.png'))
    run(pg, "location.hash='#/kanji/続'"); pg.wait_for_timeout(1800)
    pg.screenshot(path=str(out / 'kanji_modal.png'))
    pg.keyboard.press('Escape')

    # --- dark mode text page with active sentence
    run(pg, "document.documentElement.setAttribute('data-theme','dark'); location.hash='#/text/16'"); pg.wait_for_timeout(500)
    pg.locator('.sent').nth(2).click(); pg.wait_for_timeout(500)
    pg.screenshot(path=str(out / 'dark_text.png'))
    run(pg, "document.documentElement.removeAttribute('data-theme')")
    print('errors:', errs[:10])

    # --- mobile
    m = b.new_page(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    merrs = []
    m.on('pageerror', lambda e: merrs.append(str(e)))
    m.goto(url + '#/'); m.wait_for_timeout(500); m.screenshot(path=str(out / 'm_home.png'))
    m.evaluate("location.hash='#/write/曲'"); m.wait_for_timeout(500); m.screenshot(path=str(out / 'm_write.png'))
    m.evaluate("location.hash='#/text/17'"); m.wait_for_timeout(500); m.screenshot(path=str(out / 'm_text.png'))
    m.locator('#btn-menu').click(); m.wait_for_timeout(400); m.screenshot(path=str(out / 'm_menu.png'))
    print('mobile errors:', merrs)
    b.close()
