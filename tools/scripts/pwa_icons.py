"""Build the Renix app icons (favicon + PWA) from one design.

The "R" is outlined from Be Vietnam Pro Bold (the site's UI font), so the SVG does not depend on
installed fonts. PNGs are rendered with Playwright (Edge, like the tests).

    python tools/scripts/pwa_icons.py path/to/BeVietnamPro-Bold.ttf

Writes public/icon.svg, public/icons/icon-{192,512}.png, icon-maskable-512.png, apple-touch-icon.png.
"""
import sys
from pathlib import Path

from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
PUB = ROOT / 'public'


def glyph_path(ttf: str, ch: str, box: float, cap: float) -> str:
    """SVG path of `ch`, scaled to cap height `cap` and centred in a `box`-sized square."""
    font = TTFont(ttf)
    gs = font.getGlyphSet()
    g = gs[font.getBestCmap()[ord(ch)]]
    bp = BoundsPen(gs)
    g.draw(bp)
    x0, y0, x1, y1 = bp.bounds
    k = cap / (y1 - y0)
    dx = (box - (x1 - x0) * k) / 2 - x0 * k
    dy = (box + (y1 - y0) * k) / 2 + y0 * k  # font y grows up, SVG y grows down
    sp = SVGPathPen(gs, ntos=lambda v: f'{v:.1f}'.rstrip('0').rstrip('.'))
    g.draw(TransformPen(sp, (k, 0, 0, -k, dx, dy)))
    return sp.getCommands()


def svg(path: str, rounded: bool) -> str:
    r = 112 if rounded else 0
    rim = (f'<rect x="1.5" y="1.5" width="509" height="509" rx="{r - 1.5}" fill="none" '
           'stroke="#fff" stroke-opacity=".16" stroke-width="3"/>') if rounded else ''
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">'
        '<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">'
        '<stop offset="0" stop-color="#2c2c31"/><stop offset="1" stop-color="#0b0b0d"/></linearGradient></defs>'
        f'<rect width="512" height="512" rx="{r}" fill="url(#g)"/>{rim}'
        f'<path fill="#f4f4f5" d="{path}"/></svg>'
    )


def main(ttf: str) -> None:
    icon = svg(glyph_path(ttf, 'R', 512, 250), rounded=True)
    # maskable: full-bleed square, glyph inside the 80% safe zone
    mask = svg(glyph_path(ttf, 'R', 512, 200), rounded=False)
    (PUB / 'icon.svg').write_text(icon, encoding='utf-8')
    out = PUB / 'icons'
    out.mkdir(exist_ok=True)
    jobs = [(icon, 192, 'icon-192.png'), (icon, 512, 'icon-512.png'),
            (mask, 512, 'icon-maskable-512.png'), (mask, 180, 'apple-touch-icon.png')]
    with sync_playwright() as p:
        b = p.chromium.launch(channel='msedge', headless=True)
        pg = b.new_page()
        for src, size, name in jobs:
            pg.set_viewport_size({'width': size, 'height': size})
            pg.set_content('<style>html,body{margin:0;background:transparent}svg{display:block;width:100vw;height:100vh}</style>' + src)
            pg.screenshot(path=str(out / name), omit_background=True)
            print('wrote', name)
        b.close()


if __name__ == '__main__':
    main(sys.argv[1])
