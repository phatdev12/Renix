"""PWA check: manifest + service worker install, then pages, voice clips (byte ranges) and an
already-opened quiz image keep working with the network cut. Needs `npm run preview` on port 4321."""
from playwright.sync_api import sync_playwright

URL = 'http://localhost:4321'

with sync_playwright() as p:
    b = p.chromium.launch(channel='msedge', headless=True)
    ctx = b.new_context()
    pg = ctx.new_page()
    errors = []
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.goto(URL + '/')
    man = pg.evaluate("fetch(document.querySelector('link[rel=manifest]').href).then(r => r.json())")
    assert man['short_name'] == 'Renix', man
    pg.wait_for_function('navigator.serviceWorker.controller !== null', timeout=60000)
    n = pg.evaluate("caches.keys().then(ks => Promise.all(ks.map(k => caches.open(k).then(c => c.keys()).then(r => [k, r.length]))))")
    print('caches', n)
    Q = '/media/q/00ae3c8a0d864d09.png'
    pg.evaluate(f"fetch('{Q}').then(r => r.blob())")  # opened once online -> cached on first use
    pg.wait_for_timeout(500)
    clips = pg.evaluate(r"""fetch('/sw.js').then(r => r.text()).then(v =>
        JSON.parse(v.match(/const PRECACHE = (\[.*?\]);/)[1]).filter(u => u.endsWith('.mp3')))""")
    ctx.set_offline(True)
    assert pg.evaluate(f"fetch('{Q}').then(r => r.status)") == 200
    print('quiz image offline ok')
    for path in ['/', '/vocab/', '/text/13', '/kanji/', '/bank/', '/progress/']:
        pg.goto(URL + path)
        pg.wait_for_function("document.querySelector('#main').children.length > 0", timeout=10000)
        print('offline ok', path, '|', pg.title())
    clip = pg.evaluate("""async (u) => {
        const r = await fetch(u, { headers: { Range: 'bytes=100-199' } });
        const full = await fetch(u);
        return [r.status, r.headers.get('content-range'), (await r.arrayBuffer()).byteLength, full.status];
    }""", clips[0])
    print('voice clips precached:', len(clips))
    print('voice clip offline (range status, content-range, bytes, full status):', clip)
    assert clip[0] == 206 and clip[2] == 100 and clip[3] == 200
    played = pg.evaluate("""async (u) => {
        const a = new Audio(u); a.muted = true;
        await new Promise((ok, bad) => { a.onloadedmetadata = ok; a.onerror = () => bad(a.error && a.error.code); });
        return a.duration;
    }""", clips[1])
    print('audio element offline, duration', played)
    print('page errors:', errors or 'none')
    b.close()
