/* Renix service worker (template). The build (src/pwa/integration.mjs) fills in the version and
   the precache list and writes it to dist/sw.js.
   - Pages: network first (the local server answers at once or not at all), cached copy when it is down.
   - Built assets, icons and voice clips: precached, cache first.
   - Other media (quiz images, PDFs, guides): cached the first time they are opened.
   - Google Fonts: served from cache, refreshed in the background. */
const VERSION = '__VERSION__';
const PRECACHE = /*__PRECACHE__*/ [];
const CORE = 'renix-core-' + VERSION;
const MEDIA = 'renix-media';
const FONTS = 'renix-fonts';

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CORE);
    for (let i = 0; i < PRECACHE.length; i += 32) await c.addAll(PRECACHE.slice(i, i + 32));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('renix-core-') && k !== CORE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    if (url.pathname.startsWith('/media/')) e.respondWith(media(req, url));
    else if (req.mode === 'navigate') e.respondWith(page(req, url));
    else e.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
  } else if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(font(req, e));
  }
});

/** /text/13 and /text/13/?x both map to the precached '/text/13/' */
const pageKey = (url) => (url.pathname.endsWith('/') || /\.\w+$/.test(url.pathname) ? url.pathname : url.pathname + '/');

async function page(req, url) {
  try {
    return await fetch(req);
  } catch (err) {
    const hit = (await caches.match(pageKey(url))) || (await caches.match('/'));
    if (hit) return hit;
    throw err;
  }
}

async function media(req, url) {
  let res = await caches.match(url.pathname);
  if (!res) {
    try {
      res = await fetch(url.pathname); // whole file, even if the player asked for a range
    } catch {
      return Response.error();
    }
    if (!res.ok) return res;
    const copy = res.clone();
    caches.open(MEDIA).then((c) => c.put(url.pathname, copy));
  }
  const range = req.headers.get('range');
  return range ? partial(res, range) : res;
}

/** <audio> asks for byte ranges; answer them from the cached whole file. */
async function partial(res, range) {
  const buf = await res.arrayBuffer();
  const size = buf.byteLength;
  const m = /bytes=(\d*)-(\d*)/.exec(range) || [];
  let start = m[1] ? +m[1] : 0;
  let end = m[2] ? Math.min(+m[2], size - 1) : size - 1;
  if (!m[1] && m[2]) { start = Math.max(0, size - +m[2]); end = size - 1; }
  if (start > end || start >= size) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
  return new Response(buf.slice(start, end + 1), {
    status: 206,
    headers: {
      'Content-Type': res.headers.get('Content-Type') || 'application/octet-stream',
      'Content-Range': `bytes ${start}-${end}/${size}`,
      'Content-Length': String(end - start + 1),
      'Accept-Ranges': 'bytes',
    },
  });
}

async function font(req, e) {
  const c = await caches.open(FONTS);
  const hit = await c.match(req);
  const net = fetch(req).then((r) => {
    if (r.ok || r.type === 'opaque') c.put(req, r.clone());
    return r;
  });
  if (hit) {
    e.waitUntil(net.catch(() => {}));
    return hit;
  }
  return net;
}
