"""Extract vocabulary and kanji tables from the Introduce tabs into JSON."""
import json
import re
from pathlib import Path

from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "raw"

# Introduce-tab activity ids: (P1 video = summary, P2 video = vocab, P4 video = kanji)
UNITS = {
    13: {"p1": 240, "p2": 241, "p4": 248},
    14: {"p1": 252, "p2": 253, "p4": 258},
    15: {"p1": 265, "p2": 266, "p4": 281},
    16: {"p1": 285, "p2": 286, "p4": 294},
    17: {"p1": 301, "p2": 302, "p4": 307},
}


def cell(td):
    for br in td.find_all("br"):
        br.replace_with("\n")
    parts = [p.get_text(" ", strip=False) for p in td.find_all("p")] or [td.get_text(" ", strip=False)]
    t = "\n".join(parts)
    t = t.replace("\xa0", " ")
    lines = [re.sub(r"[ \t]+", " ", x).strip() for x in t.split("\n")]
    return [x for x in lines if x]


def tab_soup(aid):
    d = json.loads((RAW / "tab" / f"{aid}.json").read_text(encoding="utf-8"))
    return BeautifulSoup(d["data"], "html.parser")


def vocab_table(soup):
    for table in soup.find_all("table"):
        rows = table.find_all("tr")
        head = [" ".join(cell(td)) for td in rows[0].find_all("td")]
        if "ことば" not in head:
            continue
        idx = {h: i for i, h in enumerate(head)}
        out = []
        for tr in rows[1:]:
            tds = tr.find_all("td")
            get = lambda h: " ".join(cell(tds[idx[h]])) if h in idx and idx[h] < len(tds) else ""
            out.append({"kana": get("ことば"), "kanji": get("漢字"), "vi": get("ベトナム語")})
        return out
    return []


def kanji_tables(soup):
    lists = []
    for table in soup.find_all("table"):
        rows = table.find_all("tr")
        head = [" ".join(cell(td)) for td in rows[0].find_all("td")]
        if "Kanji" not in head:
            continue
        title = table.find_previous(["h2", "h3", "h4", "p"])
        items = []
        for tr in rows[1:]:
            tds = tr.find_all("td")
            if len(tds) < 7:
                continue
            items.append({
                "char": " ".join(cell(tds[1])),
                "hv": cell(tds[2]),
                "on": cell(tds[3]),
                "kun": cell(tds[4]),
                "meaning": cell(tds[5]),
                "examples": cell(tds[6]),
            })
        lists.append({"title": title.get_text(" ", strip=True) if title else "", "items": items})
    return lists


def main():
    out = {}
    for u, ids in UNITS.items():
        v1 = vocab_table(tab_soup(ids["p1"]))
        v2 = vocab_table(tab_soup(ids["p2"]))
        k = kanji_tables(tab_soup(ids["p4"]))
        out[u] = {"vocab_p1": v1, "vocab_p2": v2, "kanji": k}
        print(u, "vocab", len(v1), len(v2), "kanji", [len(x["items"]) for x in k])
    (ROOT / "kb_raw.json").write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()
