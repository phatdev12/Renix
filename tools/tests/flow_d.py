"""Flow test for the Astro bank / exam / progress pages (dev or preview server on :4321).
usage: flow_d.py [outdir]"""
import json, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from playwright.sync_api import sync_playwright
from seed import seed_js

BASE = 'http://localhost:4321'
out = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else pathlib.Path(__file__).parent.parent / 'shots_astro'); out.mkdir(parents=True, exist_ok=True)
BANK = json.load(open('D:/Nix/src/data/bank.json', encoding='utf-8'))
fails, notes = [], []
def ok(cond, msg):
    (notes if cond else fails).append(('ok   ' if cond else 'FAIL ') + msg)

def flat(qz):
    return [q for p in qz['parts'] for q in p['questions']]
def keyed(q):
    return q.get('ans') is not None and not q.get('needs_audio')

def answer(card, q, right=True):
    t = q['type']
    if t == 'single':
        i = q['ans'] if right else (q['ans'] + 1) % len(q['options'])
        card.locator('.opt').nth(i).click()
    elif t in ('order', 'dragtext'):
        seq = q['ans'] if right else list(reversed(q['ans']))
        if not right and seq == q['ans']: seq = [q['ans'][0]]
        for i in seq: card.locator('.chips-pool .wchip').nth(i).click()
    elif t == 'matching':
        for si, a in enumerate(q['ans']):
            if a is None: continue
            v = a if right else (a + 1) % len(q['sections'][si]['choices'])
            card.locator('select').nth(si).select_option(str(v))
    elif t == 'blanks':
        for el in card.locator('[data-slot]:is(input,select)').all():
            slot = el.get_attribute('data-slot')
            exp = q['ans'].get(slot) if isinstance(q['ans'], dict) else None
            if exp is None: continue
            exp = exp[0] if isinstance(exp, list) else exp
            val = str(exp) if right else 'zzz'
            if el.evaluate('e => e.tagName') == 'SELECT':
                if right: el.select_option(val)
                else: el.select_option(index=1 if el.locator('option').nth(1).get_attribute('value') != str(exp) else 2)
            else:
                el.evaluate("(e, v) => { e.dataset.raw = '1'; e.value = v; e.dispatchEvent(new Event('input')); }", val)
    elif t == 'short':
        card.locator('textarea').evaluate("(e, v) => { e.dataset.raw = '1'; e.value = v; }", q['ans'] if right else 'ちがう')

with sync_playwright() as p:
    b = p.chromium.launch(channel='msedge', headless=True)
    ctx = b.new_context(viewport={'width': 1280, 'height': 1000}, accept_downloads=True)
    pg = ctx.new_page()
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.on('response', lambda r: errs.append(f'HTTP {r.status} {r.url}') if r.status >= 400 else None)
    pg.on('dialog', lambda d: d.accept())
    pg.goto(BASE + '/'); pg.evaluate(seed_js(), 'dark')
    store = lambda k: pg.evaluate(f"JSON.parse(localStorage.getItem('nix.{k}') || 'null')")

    # ---- practice mode: one keyed question of every type, right and wrong
    for t in ['single', 'order', 'dragtext', 'blanks', 'matching', 'short']:
        found = None
        for qz in BANK:
            qs = flat(qz)
            for i, q in enumerate(qs):
                if q['type'] == t and keyed(q) and (t != 'blanks' or isinstance(q['ans'], dict)):
                    found = (qz, i, q); break
            if found: break
        if not found: notes.append(f'skip {t}: no keyed question'); continue
        qz, i, q = found
        for right in (True, False):
            pg.goto(f"{BASE}/bank/{qz['id']}/"); pg.wait_for_timeout(500)
            card = pg.locator('.qcard').nth(i)
            answer(card, q, right)
            card.locator('button:has-text("Kiểm tra")').click()
            cls = card.locator('.explain').get_attribute('class') or ''
            ok(('ok' in cls.split()) == right, f"{t} {qz['id']} q{i+1} {'right' if right else 'wrong'} → explain class '{cls}'")

    # ---- practice: whole quiz answered correctly → nix.bank saved at 100%
    qz = next(z for z in BANK if z['id'] == '1943')
    pg.evaluate("localStorage.removeItem('nix.bank')")
    pg.goto(f"{BASE}/bank/1943/"); pg.wait_for_timeout(500)
    qs = flat(qz)
    for i, q in enumerate(qs):
        card = pg.locator('.qcard').nth(i)
        if keyed(q): answer(card, q, True)
        btn = card.locator('button:has-text("Kiểm tra"), button:has-text("Xem hướng dẫn")')
        if btn.count(): btn.first.click()
    rec = (store('bank') or {}).get('1943')
    ok(rec is not None and rec['best'] == 100, f'practice 1943 all right → nix.bank = {rec}')

    # ---- test mode: submit a quiz, result modal + record
    pg.evaluate("localStorage.setItem('nix.bankUi', JSON.stringify({mode:'test'}))")
    qz = next(z for z in BANK if z['id'] == '1880')
    pg.goto(f"{BASE}/bank/1880/"); pg.wait_for_timeout(500)
    qs = flat(qz)
    for i, q in enumerate(qs):
        if keyed(q): answer(pg.locator('.qcard').nth(i), q, i % 4 != 0)
    pg.locator('.player-head button:has-text("Nộp bài")').click(); pg.wait_for_timeout(400)
    modal = pg.locator('.modal').inner_text() if pg.locator('.modal').count() else ''
    rec = (store('bank') or {}).get('1880')
    ok('câu đúng' in modal and rec is not None, f'test mode 1880 submit → modal "{modal[:40].strip()}" rec {rec}')
    pg.screenshot(path=str(out / 'd_bank_test_submit.png'))
    pg.evaluate("localStorage.setItem('nix.bankUi', JSON.stringify({mode:'practice'}))")

    # ---- mode switch on the page re-renders
    pg.goto(f"{BASE}/bank/2026/"); pg.wait_for_timeout(400)
    pg.locator('.seg button:has-text("Làm bài")').click(); pg.wait_for_timeout(300)
    ok(pg.locator('.player-head button:has-text("Nộp bài")').count() == 1 and store('bankUi')['mode'] == 'test', 'mode switch → test mode')
    pg.locator('.seg button:has-text("Luyện tập")').click(); pg.wait_for_timeout(300)

    # ---- mix quiz survives a real page load
    pg.goto(f"{BASE}/bank/"); pg.wait_for_timeout(500)
    pg.locator('button:has-text("Trộn 20 câu")').click(); pg.wait_for_url('**/bank/mix/'); pg.wait_for_timeout(500)
    n1 = pg.locator('.qcard').count(); keys1 = store('bankMix')
    title = pg.locator('#tt-sub').inner_text()
    pg.reload(); pg.wait_for_timeout(500)
    ok(n1 == 20 and pg.locator('.qcard').count() == 20 and store('bankMix') == keys1 and 'Trộn ngẫu nhiên 20 câu' in title, f'mix: {n1} cards, title "{title}", same after reload')

    # ---- list filter
    pg.goto(f"{BASE}/bank/?unit=15&part=3"); pg.wait_for_timeout(400)
    rows = pg.locator('.bank-row').count()
    expect = sum(1 for z in BANK if z['unit'] == 15 and z['part'] == 3)
    ok(rows == expect and pg.locator('a:has-text("Xem tất cả")').count() == 1, f'filter unit 15 part 3: {rows} rows (expected {expect})')

    # ---- exam: build, answer, submit → nix.exam grows
    before = len(store('exam') or [])
    pg.goto(f"{BASE}/exam/"); pg.wait_for_timeout(500)
    pg.locator('.cfg-row select').first.select_option('15')
    pg.locator('button:has-text("Bắt đầu")').click(); pg.wait_for_timeout(500)
    ncards = pg.locator('.qcard').count()
    for i in range(0, ncards, 2):
        c = pg.locator('.qcard').nth(i)
        if c.locator('.opt').count(): c.locator('.opt').first.click()
    pg.locator('.player-head button:has-text("Nộp bài")').click(); pg.wait_for_timeout(500)
    ex = store('exam') or []
    ok(ncards == 15 and len(ex) == before + 1 and ex[-1]['total'] == 15 and pg.locator('.sec-score').count() == 1,
       f'exam: {ncards} questions, records {before}→{len(ex)}, last {ex[-1]["score"] if ex else None}/{ex[-1]["total"] if ex else None}')
    pg.screenshot(path=str(out / 'd_exam_result.png'))
    pg.locator('button:has-text("Làm đề mới")').click(); pg.wait_for_timeout(300)
    ok(pg.locator('button:has-text("Bắt đầu")').count() == 1, 'exam: "Làm đề mới" back to config')

    # ---- progress: export → reset → import round trip
    pg.goto(f"{BASE}/progress/"); pg.wait_for_timeout(500)
    srs_before = store('srs')
    with pg.expect_download() as dl:
        pg.locator('button:has-text("Sao lưu")').click()
    path = out / 'backup.json'; dl.value.save_as(str(path))
    data = json.load(open(path, encoding='utf-8'))
    ok(data.get('app') == 'nix-review' and 'nix.srs' in data['data'], f'export: {len(data["data"])} keys, file {dl.value.suggested_filename}')
    pg.locator('button:has-text("Xoá tiến độ")').click(); pg.wait_for_timeout(400)
    ok(store('srs') is None and store('settings') is not None, 'reset: progress cleared, settings kept')
    pg.locator('label:has-text("Khôi phục") input[type=file]').set_input_files(str(path)); pg.wait_for_timeout(1200)
    ok(store('srs') == srs_before, 'import: srs restored')
    # a backup made by the old file:// site has the same shape
    legacy = {'app': 'nix-review', 'ts': 0, 'data': {'nix.star': json.dumps({'13-1': 1}), 'nix.kanji': json.dumps({'半': {'n': 2, 'best': 0, 'last': 0, 'lastMis': 0}})}}
    lp = out / 'legacy_backup.json'; lp.write_text(json.dumps(legacy), encoding='utf-8')
    pg.locator('label:has-text("Khôi phục") input[type=file]').set_input_files(str(lp)); pg.wait_for_timeout(1200)
    ok((store('star') or {}).get('13-1') == 1 and (store('kanji') or {}).get('半', {}).get('n') == 2, 'import legacy-format backup')
    pg.screenshot(path=str(out / 'd_progress.png'), full_page=True)

    # ---- every quiz page: no JS errors / missing media
    n0 = len(errs)
    for qz in BANK:
        pg.goto(f"{BASE}/bank/{qz['id']}/"); pg.wait_for_load_state('networkidle')
        if pg.locator('.qcard').count() != len(flat(qz)): fails.append(f"FAIL {qz['id']}: {pg.locator('.qcard').count()} cards vs {len(flat(qz))}")
    ok(len(errs) == n0, f'all {len(BANK)} quiz pages load (media + script) without errors')
    b.close()

for x in notes + fails: print(x)
print('errors:', errs[:20])
print('RESULT:', 'PASS' if not fails and not errs else 'FAIL')
