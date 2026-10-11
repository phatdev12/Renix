"""Merge the alignments made from the plain and the VAD Whisper transcripts.
usage: combine.py UNIT t|v   (reads align_a.json, align_b.json -> align.json)"""
import json, sys, pathlib
UNIT = int(sys.argv[1]); KIND = sys.argv[2]
W = pathlib.Path(f'vwork/{KIND}{UNIT}')
A = json.load(open(W / 'align_a.json', encoding='utf-8'))['items']
B = json.load(open(W / 'align_b.json', encoding='utf-8'))['items'] if (W / 'align_b.json').exists() else [dict(x, cut_s=None) for x in A]
out = []
for a, b in zip(A, B):
    ok_a, ok_b = a.get('cut_s') is not None, b.get('cut_s') is not None
    if KIND == 't':
        ka, kb = (a['cov'] if ok_a else -1), (b['cov'] if ok_b else -1)
        pick = a if ka >= kb else b
    else:
        ka, kb = (a['score'] if ok_a else -1), (b['score'] if ok_b else -1)
        if ka == kb and ok_a and ok_b:  # same score: the shorter (cleaner) clip
            pick = a if (a['cut_e'] - a['cut_s']) <= (b['cut_e'] - b['cut_s']) else b
        else:
            pick = a if ka >= kb else b
    pick = dict(pick, src='a' if pick is a else 'b')
    out.append(pick)
# never overlap neighbours in time: split at the quietest 10 ms frame between them
import wave
import numpy as np
w = wave.open(str(W / 'a16.wav')); sr = w.getframerate()
x16 = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
hop = int(sr * 0.01); nfr = len(x16) // hop
db = 20 * np.log10(np.sqrt((x16[:nfr * hop].reshape(nfr, hop) ** 2).mean(1) + 1e-12))
db = np.convolve(db, np.ones(5) / 5, mode='same')
got = sorted([o for o in out if o.get('cut_s') is not None], key=lambda o: o['cut_s'])
for x, y in zip(got, got[1:]):
    if x['cut_e'] > y['cut_s'] - 0.02:
        lo = max(x['start'] + 0.25, min(x['end'], y['start']) - 0.35)
        hi = min(y['end'] - 0.25, max(x['end'], y['start']) + 0.35)
        if hi <= lo: lo, hi = min(x['cut_e'], y['cut_s']), max(x['cut_e'], y['cut_s'])
        a, b = int(lo * 100), max(int(lo * 100) + 1, int(hi * 100))
        q = (a + int(np.argmin(db[a:b]))) / 100
        x['cut_e'], y['cut_s'] = round(q - 0.01, 2), round(q + 0.01, 2)
        x['split'] = y['split'] = True
json.dump({'unit': UNIT, 'kind': KIND, 'items': out}, open(W / 'align.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
miss = [o.get('k', o.get('id')) for o in out if o.get('cut_s') is None]
print(f'{KIND}{UNIT}: {len(out) - len(miss)}/{len(out)} matched; from vad: {sum(o["src"] == "b" for o in out if o.get("cut_s") is not None)}; missing {miss}')
