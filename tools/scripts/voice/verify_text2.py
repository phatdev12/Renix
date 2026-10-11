"""Compact check sheet for text clips: subtitle strip 0.35 s before each clip ends,
two items per row, labelled with the expected sentence."""
import json, sys, pathlib
from PIL import Image, ImageDraw, ImageFont
UNIT = int(sys.argv[1])
W = pathlib.Path(f'vwork/t{UNIT}')
A = json.load(open(W / 'align.json', encoding='utf-8'))['items']
font = ImageFont.truetype('C:/Windows/Fonts/YuGothM.ttc', 14)
frames = sorted(W.glob('f_*.jpg'))
rows = [o for o in A if o.get('cut_s') is not None]
cw, chh, lab = 470, 70, 20
per = 2
sheet = Image.new('RGB', (per * (cw + 8), ((len(rows) + per - 1) // per) * (chh + lab)), (20, 20, 30))
d = ImageDraw.Draw(sheet)
for k, o in enumerate(rows):
    x0 = (k % per) * (cw + 8); y = (k // per) * (chh + lab)
    d.text((x0 + 3, y + 2), f"{o['k']} {o['cut_s']:.1f}-{o['cut_e']:.1f} c{o['cov']:.2f} {o['jp'][:30]}", fill=(255, 230, 120), font=font)
    t = max(o['cut_s'] + 0.4, o['cut_e'] - 0.35)
    im = Image.open(frames[min(len(frames) - 1, int(t * 4))]).crop((0, 285, 470, 355))
    sheet.paste(im, (x0, y + lab))
sheet.save(W / 'verify2.jpg', quality=78)
print(W / 'verify2.jpg', sheet.size, 'missing:', [o['k'] for o in A if o.get('cut_s') is None])
