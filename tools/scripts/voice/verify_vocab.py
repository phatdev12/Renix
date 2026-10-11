"""Contact sheet for vocab clips: full frames at clip start+0.15 s and at the middle."""
import json, sys, pathlib
from PIL import Image, ImageDraw, ImageFont
UNIT = int(sys.argv[1])
W = pathlib.Path(f'vwork/v{UNIT}')
A = json.load(open(W / 'align.json', encoding='utf-8'))
font = ImageFont.truetype('C:/Windows/Fonts/YuGothM.ttc', 15)
frames = sorted(W.glob('f_*.jpg'))
rows = [o for o in A['items'] if o.get('cut_s') is not None]
tw, th, lab = 300, 169, 22
sheet = Image.new('RGB', (tw * 4 + 12, ((len(rows) + 1) // 2) * (th + lab)), (20, 20, 30))
d = ImageDraw.Draw(sheet)
for k, o in enumerate(rows):
    x0 = (k % 2) * (tw * 2 + 12); y = (k // 2) * (th + lab)
    d.text((x0 + 4, y + 2), f"{o['id']} {o['cut_s']:.1f}-{o['cut_e']:.1f}s {o['jp']} ← {o.get('heard', '')}", fill=(255, 230, 120), font=font)
    for c, t in enumerate([o['cut_s'] + 0.15, (o['cut_s'] + o['cut_e']) / 2]):
        im = Image.open(frames[min(len(frames) - 1, int(t * 4))]).resize((tw, th))
        sheet.paste(im, (x0 + c * tw, y + lab))
sheet.save(W / 'verify.jpg', quality=80)
print(W / 'verify.jpg', sheet.size)
