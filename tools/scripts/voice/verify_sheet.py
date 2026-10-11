"""Contact sheet to verify an alignment: for every sentence show the subtitle strip
at its start (+0.4 s) and near its end, labelled with the expected sentence.
usage: verify_sheet.py UNIT [kind] [crop=x0,y0,x1,y1 in 640x360]"""
import json, sys, pathlib
from PIL import Image, ImageDraw, ImageFont

UNIT = int(sys.argv[1]); KIND = sys.argv[2] if len(sys.argv) > 2 else 't'
crop = tuple(int(v) for v in (sys.argv[3] if len(sys.argv) > 3 else '0,270,470,360').split(','))
W = pathlib.Path(f'vwork/{KIND}{UNIT}')
A = json.load(open(W / 'align.json', encoding='utf-8'))
font = ImageFont.truetype('C:/Windows/Fonts/YuGothM.ttc', 15) if pathlib.Path('C:/Windows/Fonts/YuGothM.ttc').exists() else ImageFont.load_default()
frames = sorted(W.glob('f_*.jpg'))
cw, chh = crop[2] - crop[0], crop[3] - crop[1]
rows = [dict(o, i=o.get('k', o.get('id')), start=o['cut_s'], end=o['cut_e']) for o in (A.get('items') or A['sents']) if o.get('cut_s') is not None]
lab = 24
sheet = Image.new('RGB', (cw * 2 + 8, len(rows) * (chh + lab)), (20, 20, 30))
d = ImageDraw.Draw(sheet)
for k, o in enumerate(rows):
    y = k * (chh + lab)
    text = o.get('jp') or o.get('w', '')
    d.text((4, y + 3), f"{o['i']}  {o['start']:.1f}-{o['end']:.1f}s  {text}", fill=(255, 230, 120), font=font)
    for c, t in enumerate([o['start'] + 0.4, max(o['start'] + 0.4, o['end'] - 0.3)]):
        fi = min(len(frames) - 1, int(t * 4))
        im = Image.open(frames[fi]).crop(crop)
        sheet.paste(im, (c * (cw + 8), y + lab))
out = W / 'verify.jpg'
sheet.save(out, quality=82)
print(out, sheet.size)
