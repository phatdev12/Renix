"""Cut the aligned clips out of the class videos and write src/data/voice.json.

usage: cut_clips.py SITE_DIR
For every unit: vwork/t{U}/align.json (master text sentences) and vwork/v{U}/align.json
(vocabulary words). Clips are mono MP3 (64 kbps, 44.1 kHz) with 25 ms fades and
loudness normalised so all clips play at the same level.
"""
import json, re, subprocess, sys, pathlib

SITE = pathlib.Path(sys.argv[1])
OUT = SITE / 'public' / 'media' / 'voice'
UNITS = [13, 14, 15, 16, 17]


TARGET_MEAN = -21.0   # dB, mean level of every clip
PEAK_CEIL = -1.0      # dB


def cut(src, start, end, dst):
    """two passes: measure the clip level, then cut with fades + a gain that brings
    its mean level to TARGET_MEAN without letting peaks exceed PEAK_CEIL"""
    dur = max(0.2, end - start)
    fade = min(0.03, dur / 4); fade_out = min(0.07, dur / 4)
    base = ['ffmpeg', '-v', 'info', '-hide_banner', '-y', '-ss', f'{start:.3f}', '-t', f'{dur:.3f}', '-i', str(src), '-vn', '-ac', '1']
    m = subprocess.run(base + ['-af', 'volumedetect', '-f', 'null', '-'], capture_output=True, text=True, encoding='utf-8', errors='replace').stderr
    mean = float(re.search(r'mean_volume:\s*(-?[\d.]+)', m).group(1))
    peak = float(re.search(r'max_volume:\s*(-?[\d.]+)', m).group(1))
    gain = min(TARGET_MEAN - mean, PEAK_CEIL - peak)
    af = f"volume={gain:.2f}dB,afade=t=in:st=0:d={fade},afade=t=out:st={dur - fade_out:.3f}:d={fade_out},aresample=44100"
    subprocess.run(['ffmpeg', '-v', 'error'] + base[3:] + ['-af', af, '-c:a', 'libmp3lame', '-b:a', '64k', str(dst)], check=True)
    return gain


def main():
    data = {'text': {}, 'vocab': {}}
    jobs = []
    n = 0
    for u in UNITS:
        for kind in ('t', 'v'):
            al = pathlib.Path(f'vwork/{kind}{u}/align.json')
            if not al.exists(): continue
            items = json.load(open(al, encoding='utf-8'))['items']
            src = pathlib.Path(f'vids/{kind}{u}.mp4')
            d = OUT / f'{kind}{u}'
            d.mkdir(parents=True, exist_ok=True)
            for o in items:
                if o.get('cut_s') is None: continue
                if kind == 't':
                    name = f"{o['k'] + 1:02d}.mp3"
                    data['text'].setdefault(str(u), {})[str(o['k'])] = f'/media/voice/t{u}/{name}'
                else:
                    name = f"{o['id'].split('-')[1].zfill(2)}.mp3"
                    data['vocab'][o['id']] = f'/media/voice/v{u}/{name}'
                jobs.append((src, o['cut_s'], o['cut_e'], d / name))
                n += 1
    from concurrent.futures import ThreadPoolExecutor
    with ThreadPoolExecutor(8) as ex:
        gains = list(ex.map(lambda j: cut(*j), jobs))
    print(f'gain applied: min {min(gains):.1f} dB, max {max(gains):.1f} dB')
    # text: unit -> sentence index (reading order) -> mp3; vocab: vocab id -> mp3 (do not edit by hand)
    (SITE / 'src' / 'data' / 'voice.json').write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    total = sum(f.stat().st_size for f in OUT.rglob('*.mp3'))
    print(f'{n} clips, {total / 1e6:.1f} MB -> {OUT}')


main()
