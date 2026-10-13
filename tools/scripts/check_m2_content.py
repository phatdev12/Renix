"""Validate tools/content/m2/U<n>.json: python check_m2_content.py <n>
Checks shape, furigana markup (no bare kanji, reading reconstruction), grammar video ids,
and prints the kana reading of every text sentence next to the PDF kana lines for comparison."""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
n = int(sys.argv[1])
d = json.loads((ROOT / "content" / "m2" / f"U{n}.json").read_text(encoding="utf-8"))
outline = json.loads((ROOT / "outline_m2.json").read_text(encoding="utf-8"))
act_ids = {int(a["id"]) for s in outline for l in s["lessons"] for a in l["activities"]}
KANJI = re.compile(r"[一-鿿々]")
errors = []


def strip(s):
    return re.sub(r"\{([^|{}]+)\|([^{}]+)\}", r"\1", s)


def reading(s):
    return re.sub(r"\{([^|{}]+)\|([^{}]+)\}", r"\2", s)


def check_markup(s, where):
    if re.search(r"\{[^|{}]*\}", s) or s.count("{") != s.count("}"):
        errors.append(f"{where}: bad braces: {s}")
    if KANJI.search(re.sub(r"\{[^{}]*\}", "", s)):
        errors.append(f"{where}: kanji without furigana: {s}")
    for k, r in re.findall(r"\{([^|{}]+)\|([^{}]+)\}", s):
        if not KANJI.search(k):
            errors.append(f"{where}: ruby on non-kanji: {{{k}|{r}}}")
        if re.search(r"[一-鿿々]", r):
            errors.append(f"{where}: kanji in reading: {{{k}|{r}}}")


for key in ("text", "grammar", "essay", "verbs"):
    if key not in d:
        errors.append(f"missing key {key}")
t = d.get("text", {})
check_markup(t.get("title", ""), "title")
for si, sec in enumerate(t.get("sections", [])):
    if sec.get("speaker") not in ("li", "akio", "nishiyama") and sec.get("speaker") not in d.get("speakers", {}):
        errors.append(f"section {si}: unknown speaker {sec.get('speaker')}")
    for pi, p in enumerate(sec.get("paragraphs", [])):
        for i, s in enumerate(p):
            w = f"s{si} p{pi} #{i}"
            if not s.get("jp") or not s.get("vi"):
                errors.append(f"{w}: empty jp/vi")
            check_markup(s.get("jp", ""), w)
for g in d.get("grammar", []):
    w = f"grammar {g.get('no')}"
    for f in ("no", "group", "title", "meaning", "usage", "formulas", "examples"):
        if f not in g:
            errors.append(f"{w}: missing {f}")
    if g.get("video") is not None and g["video"] not in act_ids:
        errors.append(f"{w}: video {g['video']} is not an activity id of M2")
    if g.get("table") not in (None, "te", "ta", "nai", "jisho", "kanou"):
        errors.append(f"{w}: bad table {g.get('table')}")
    for e in g.get("examples", []):
        check_markup(e.get("jp", ""), w + " example")
for v in d.get("verbs", []):
    if not v.get("m", "").endswith("ます") or v.get("g") not in (1, 2, 3):
        errors.append(f"verb {v}: m must end with ます, g in 1/2/3")

print("=== readings of the text (compare with the PDF kana lines in the dump)")
for sec in t.get("sections", []):
    print("--", sec.get("speaker"))
    for p in sec.get("paragraphs", []):
        for s in p:
            print("  ", reading(s["jp"]), "   <=", strip(s["jp"]))
print("=== grammar:", [(g.get("no"), g.get("title"), g.get("video")) for g in d.get("grammar", [])])
print("=== verbs:", len(d.get("verbs", [])), " essay:", d.get("essay", {}).get("vi"))
print("ERRORS:", len(errors))
for e in errors:
    print("  -", e)
sys.exit(1 if errors else 0)
