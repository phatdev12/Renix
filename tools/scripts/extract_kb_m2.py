"""Vocabulary + kanji tables of course M2 (Units 1-12) -> kb_raw_m2.json.

Per unit: vocab_p1 = main list (first ことば table of the Part-2 video tab),
vocab_ext = "BẢNG TỪ VỰNG MỞ RỘNG" tables, kanji = Kanji tables of the Part-4 video tab."""
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from bs4 import BeautifulSoup  # noqa: E402

from extract_kb import cell, kanji_tables  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "raw" / "m2"
OUTLINE = json.loads((ROOT / "outline_m2.json").read_text(encoding="utf-8"))


def tab_soup(aid):
    p = RAW / "tab" / f"{aid}.json"
    if not p.exists():
        return None
    return BeautifulSoup(json.loads(p.read_text(encoding="utf-8"))["data"], "html.parser")


def vocab_tables(soup):
    out = []
    for table in soup.find_all("table"):
        rows = table.find_all("tr")
        head = [" ".join(cell(td)) for td in rows[0].find_all("td")]
        if not any("ことば" in h for h in head):
            continue
        col = {}
        for i, hd in enumerate(head):
            if "ことば" in hd:
                col["kana"] = i
            elif "漢字" in hd:
                col["kanji"] = i
            elif "ベトナム" in hd or "TIẾNG VIỆT" in hd:
                col["vi"] = i
        items = []
        for tr in rows[1:]:
            tds = tr.find_all("td")
            get = lambda k: " ".join(cell(tds[col[k]])) if k in col and col[k] < len(tds) else ""
            kana = get("kana")
            if not kana:
                continue
            items.append({"kana": kana, "kanji": get("kanji"), "vi": get("vi")})
        prev = table.find_previous(["h2", "h3", "h4", "h5", "p"])
        title = prev.get_text(" ", strip=True) if prev else ""
        out.append({"title": title, "items": items})
    return out


def video_ids(sec):
    """activity ids of the P1 / P2 / P4 videos of a unit section"""
    ids = {"text": [], "vocab": None, "kanji": None}
    for les in sec["lessons"]:
        t = les["title"]
        for a in les["activities"]:
            if "ビデオ" not in a["title"]:
                continue
            if "マスターテクスト" in t:
                ids["text"].append(int(a["id"]))
            elif "ことば" in t:
                ids["vocab"] = int(a["id"])
            elif "かんじ" in t:
                ids["kanji"] = int(a["id"])
    return ids


def main():
    out = {}
    for sec in OUTLINE:
        m = re.fullmatch(r"Unit (\d+)", sec["title"].strip())
        if not m:
            continue
        u = int(m.group(1))
        ids = video_ids(sec)
        vs = tab_soup(ids["vocab"]) if ids["vocab"] else None
        if vs is None:
            print(u, "no vocab tab yet")
            continue
        tables = vocab_tables(vs)
        main_v = tables[0]["items"] if tables else []
        ext = [it for t in tables[1:] for it in t["items"]]
        ks = tab_soup(ids["kanji"]) if ids["kanji"] else None
        k = kanji_tables(ks) if ks is not None else []
        out[u] = {"vocab_p1": main_v, "vocab_ext": ext, "kanji": k, "videos": ids}
        print(u, "vocab", len(main_v), "ext", len(ext), "kanji", [len(x["items"]) for x in k], "videos", ids)
    (ROOT / "kb_raw_m2.json").write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()
