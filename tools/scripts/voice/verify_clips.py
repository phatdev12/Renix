"""Round-trip check: transcribe every cut clip again and compare with the expected text.
usage: verify_clips.py SITE_DIR  -> vwork/clipcheck.json + report"""
import json, re, subprocess, sys, pathlib, difflib, time, os
import numpy as np
from faster_whisper import WhisperModel
import pykakasi
SITE_ROOT = os.environ.get('NIX_SITE') or pathlib.Path(__file__).resolve().parents[3].as_posix()

SITE = pathlib.Path(sys.argv[1])
KKS = pykakasi.kakasi()
PUNCT = re.compile(r'[\s、。，．,.!！?？「」『』（）()…・〜～~ー\-―－:：;；"\'“”]')
RE = re.compile(r'\{([^|{}]+)\|([^{}]+)\}')


def hira(t):
    s = ''.join(x['hira'] for x in KKS.convert(t))
    s = re.sub(r'[ァ-ヶ]', lambda m: chr(ord(m.group()) - 0x60), s)
    s = s.translate(str.maketrans('０１２３４５６７８９ぁぃぅぇぉっゃゅょゎ', '0123456789あいうえおつやゆよわ'))
    return PUNCT.sub('', s)


def load(path):
    p = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-ac', '1', '-ar', '16000', '-f', 's16le', '-'], capture_output=True)
    return np.frombuffer(p.stdout, dtype=np.int16).astype(np.float32) / 32768


N = json.load(open(SITE_ROOT + '/src/data/units.json', encoding='utf-8'))
V = json.load(open(SITE_ROOT + '/src/data/voice.json', encoding='utf-8'))
jobs = []
for u in N['units']:
    k = 0
    for sec in u['sections']:
        for p in sec['paragraphs']:
            for s in p:
                f = V['text'].get(str(u['id']), {}).get(str(k))
                if f: jobs.append(('t', f"{u['id']}#{k}", RE.sub(r'\1', s['jp']), RE.sub(r'\2', s['jp']), f))
                k += 1
    for v in u['vocab']:
        f = V['vocab'].get(v['id'])
        if f: jobs.append(('v', v['id'], v.get('kanji') or v['kana'], v['kana'], f))
model = WhisperModel('small', device='cpu', compute_type='int8', cpu_threads=8, download_root='models')
out = []
t0 = time.time()
for kind, key, text, reading, f in jobs:
    audio = load(SITE / 'public' / f.lstrip('/'))
    segs, _ = model.transcribe(audio, language='ja', beam_size=5, temperature=0, condition_on_previous_text=False, vad_filter=False)
    heard = ''.join(s.text for s in segs).strip()
    exp = hira(re.sub(r'[～〜]|(?<![A-Za-z])N(?![A-Za-z])', '', reading))
    got = hira(heard)
    r = difflib.SequenceMatcher(None, exp, got).ratio()
    r2 = difflib.SequenceMatcher(None, hira(re.sub(r'[～〜]|(?<![A-Za-z])N(?![A-Za-z])', '', text)), got).ratio()
    out.append({'kind': kind, 'key': key, 'text': text, 'heard': heard, 'score': round(max(r, r2), 2), 'dur': round(len(audio) / 16000, 2),
                'extra': len(got) - len(exp)})
json.dump(out, open('vwork/clipcheck.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
print(f'{len(out)} clips checked in {time.time() - t0:.0f}s')
bad = [o for o in out if o['score'] < 0.8]
print('low-score clips:', len(bad))
for o in sorted(out, key=lambda o: o['score'])[:40]:
    print(f"  {o['score']:.2f} {o['key']:>7} {o['dur']:5.2f}s  {o['text'][:28]}  <-  {o['heard'][:40]}")
