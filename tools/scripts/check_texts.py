import json, re, difflib, pypdf, unicodedata
files = {"13": "Unit-13_Yomimono.pdf", "14": "U14---Yomimono-1.pdf", "15": "Unit-15_Yomimono.pdf",
         "16": "Unit-16_Yomimono.pdf", "17": "Unit-17_Yomimono.pdf"}
T = json.load(open("content/texts.json", encoding="utf-8"))
def plain(s): return re.sub(r"\{([^|}]+)\|[^}]+\}", r"\1", s)
def norm(s):
    s = unicodedata.normalize("NFKC", s)
    return re.sub(r"[\s、。，,．.！!？?「」『』・＠@]", "", s)
for u, f in files.items():
    pdf = pypdf.PdfReader("raw/pdf/" + f).pages[0].extract_text()
    lines = pdf.split("\n")
    # drop pure-kana lines that sit right after a line ending in kanji (ruby lines)
    base = []
    for i, l in enumerate(lines):
        if i > 0 and re.fullmatch(r"[ぁ-ゖー\s]+", l.strip() or "x") and re.search(r"[一-鿿々]\s*$", lines[i-1]):
            continue
        base.append(l)
    src = norm("".join(base))
    mine = "".join(plain(s["jp"]) for sec in T["units"][u]["sections"] for p in sec["paragraphs"] for s in p)
    mine = norm(mine)
    # cut header of pdf to the first 12 chars of mine
    k = src.find(mine[:6]); src = src[k:] if k >= 0 else src
    sm = difflib.SequenceMatcher(None, src, mine, autojunk=False)
    print("== U", u, "ratio", round(sm.ratio(), 4))
    for op, a1, a2, b1, b2 in sm.get_opcodes():
        if op != "equal":
            print("  ", op, repr(src[max(0,a1-6):a2+6]), "->", repr(mine[max(0,b1-6):b2+6]))
