"""Download KanjiVG stroke data for the needed kanji and compact it to JSON.

Output kvg.json: {char: {"s": [path d, ...], "n": [[x, y], ...]}}  (109x109 grid)
"""
import json
import re
import sys
import time
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "raw" / "kanjivg"
URL = "https://raw.githubusercontent.com/KanjiVG/kanjivg/master/kanji/{}.svg"


def is_kanji(ch):
    return "一" <= ch <= "鿿" or ch == "々"


def needed():
    kb = json.loads((ROOT / "kb_raw.json").read_text(encoding="utf-8"))
    chars = []
    for u in kb.values():
        for lst in u["kanji"]:
            for it in lst["items"]:
                for ch in it["char"]:
                    if is_kanji(ch) and ch not in chars:
                        chars.append(ch)
    extra = []
    for u in kb.values():
        for v in u["vocab_p1"]:
            for ch in v["kanji"]:
                if is_kanji(ch) and ch not in chars and ch not in extra:
                    extra.append(ch)
    for t in sys.argv[1:]:
        for ch in t:
            if is_kanji(ch) and ch not in chars and ch not in extra:
                extra.append(ch)
    return chars, extra


def fetch(ch):
    CACHE.mkdir(parents=True, exist_ok=True)
    name = f"{ord(ch):05x}.svg"
    p = CACHE / name
    if not p.exists():
        r = requests.get(URL.format(f"{ord(ch):05x}"), timeout=30)
        if r.status_code != 200:
            return None
        p.write_bytes(r.content)
        time.sleep(0.1)
    return p.read_text(encoding="utf-8")


def parse(svg, ch):
    code = f"{ord(ch):05x}"
    strokes = re.findall(r'<path id="kvg:' + code + r'-s(\d+)"[^>]*\sd="([^"]+)"', svg)
    strokes = [d for _, d in sorted(strokes, key=lambda x: int(x[0]))]
    nums = re.findall(r'<text transform="matrix\(1 0 0 1 ([\d.]+) ([\d.]+)\)">(\d+)</text>', svg)
    nums = [[float(x), float(y)] for x, y, _ in sorted(nums, key=lambda t: int(t[2]))]
    return {"s": strokes, "n": nums}


def main():
    chars, extra = needed()
    out, missing = {}, []
    for ch in chars + extra:
        svg = fetch(ch)
        if svg is None:
            missing.append(ch)
            continue
        out[ch] = parse(svg, ch)
        if len(out[ch]["s"]) != len(out[ch]["n"]):
            print("stroke/number mismatch", ch, len(out[ch]["s"]), len(out[ch]["n"]))
    (ROOT / "kvg.json").write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print("unit kanji", len(chars), "extra", len(extra), "ok", len(out), "missing", missing)


if __name__ == "__main__":
    main()
