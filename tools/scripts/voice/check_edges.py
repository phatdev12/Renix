"""Flag clips whose cut point lies inside loud sound (possible truncation)."""
import json, wave
import numpy as np
bad = 0; total = 0
for u in (13, 14, 15, 16, 17):
    for kind in ('t', 'v'):
        w = wave.open(f'vwork/{kind}{u}/a16.wav'); sr = w.getframerate()
        x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
        hop = int(sr * 0.01); n = len(x) // hop
        db = 20 * np.log10(np.sqrt((x[:n * hop].reshape(n, hop) ** 2).mean(1) + 1e-12))
        live = db[db > -100]
        floor, peak = np.percentile(live, 20), np.percentile(live, 95)
        loud = floor + 0.5 * (peak - floor)
        for o in json.load(open(f'vwork/{kind}{u}/align.json', encoding='utf-8'))['items']:
            if o.get('cut_s') is None: continue
            total += 1
            for edge in ('cut_s', 'cut_e'):
                i = int(o[edge] * 100)
                # sound just outside the clip = something was cut off
                lv = db[max(0, i - 5):i].max() if edge == 'cut_s' else db[i:i + 5].max()
                if lv > loud:
                    bad += 1
                    print(f"{kind}{u} {o.get('k', o.get('id'))} {edge}={o[edge]} level {lv:.0f} dB (loud>{loud:.0f}) {o['jp'][:20]}")
print('clips', total, 'loud edges', bad)
