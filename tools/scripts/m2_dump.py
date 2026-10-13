"""Per-unit plain-text dump of course M2 (N5, Units 1-12) for content authoring.

    python tools/scripts/m2_dump.py [unit ...]

Reads raw/m2/{act,tab}, downloads the PDFs linked from the P1 drill (raw/m2/pdf),
writes m2dump/U<n>.md with: reading-guide PDF text, P1 tab (vocab + grammar list),
each P3 grammar video tab, P4 kanji tab, essay theme."""
import json
import re
import sys
import time
from pathlib import Path

import requests
from bs4 import BeautifulSoup, NavigableString
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "raw" / "m2"
OUT = ROOT / "m2dump"
OUTLINE = json.loads((ROOT / "outline_m2.json").read_text(encoding="utf-8"))


def soup_of(path):
    d = json.loads(Path(path).read_text(encoding="utf-8"))
    s = BeautifulSoup(d.get("data") or d.get("html") or "", "html.parser")
    for t in s(["script", "style", "iframe"]):
        t.decompose()
    return s


def render(el):
    """html -> readable text: tables as | rows |, list items as -, headings as #"""
    lines = []

    def cell(td):
        parts = []
        for node in td.descendants:
            if isinstance(node, NavigableString):
                parts.append(str(node))
            elif node.name == "br":
                parts.append(" / ")
            elif node.name in ("p", "li") and parts:
                parts.append(" / ")
        t = re.sub(r"\s+", " ", "".join(parts)).replace("\xa0", " ")
        return re.sub(r"(\s*/\s*)+", " / ", t).strip(" /")

    def walk(el):
        for ch in el.children:
            if isinstance(ch, NavigableString):
                t = re.sub(r"\s+", " ", str(ch)).strip()
                if t:
                    lines.append(t)
            elif ch.name == "table":
                for tr in ch.find_all("tr"):
                    lines.append("| " + " | ".join(cell(td) for td in tr.find_all(["td", "th"])) + " |")
                lines.append("")
            elif ch.name == "img":
                lines.append(f"[IMG {ch.get('src')}]")
            elif ch.name in ("p", "h1", "h2", "h3", "h4", "h5", "h6", "li"):
                before = len(lines)
                walk(ch)
                seg = " ".join(lines[before:])
                del lines[before:]
                seg = re.sub(r"\s+", " ", seg).replace("\xa0", " ").strip()
                if seg:
                    lines.append(("- " if ch.name == "li" else "# " if ch.name[0] == "h" else "") + seg)
            else:
                walk(ch)
    walk(el)
    return "\n".join(lines)


def act_html(aid):
    return json.loads((RAW / "act" / f"{aid}.json").read_text(encoding="utf-8")).get("data", "")


def pdf_text(url):
    name = url.rsplit("/", 1)[1]
    p = RAW / "pdf" / name
    if not p.exists():
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(requests.get(url, timeout=60).content)
        time.sleep(0.2)
    try:
        r = PdfReader(str(p))
        return name, "\n".join((pg.extract_text() or "") for pg in r.pages)
    except Exception as e:  # noqa: BLE001
        return name, f"(pdf error: {e})"


def unit_section(n):
    return next(s for s in OUTLINE if s["title"].strip() == f"Unit {n}")


def dump(n):
    sec = unit_section(n)
    md = [f"# Unit {n}\n"]
    for les in sec["lessons"]:
        lt = les["title"]
        md.append(f"\n\n## {lt}\n")
        for a in les["activities"]:
            if not a["url"].endswith("/activity"):
                continue
            aid = a["id"]
            html = act_html(aid)
            pdfs = re.findall(r'https?://storage\.googleapis\.com/[^"\']+\.pdf', html)
            vid = re.search(r'data-file-url="([^"]+)"', html)
            md.append(f"\n### {a['title']}  (activity {aid})")
            if vid:
                md.append(f"video: {vid.group(1)}")
            for u in dict.fromkeys(pdfs):
                name, txt = pdf_text(u)
                md.append(f"\n#### PDF {name}\n{txt.strip()}\n")
            tab = RAW / "tab" / f"{aid}.json"
            if "ビデオ" in a["title"] and tab.exists():
                txt = render(soup_of(tab))
                if "No introduction" not in txt:
                    md.append("\n#### Introduce tab\n" + txt)
            if "エッセイ" in lt and "テスト" in a["title"]:
                s = soup_of(RAW / "act" / f"{aid}.json")
                box = s.select_one(".ck-content") or s
                md.append("\n#### Essay theme\n" + render(box)[:1500])
    OUT.mkdir(exist_ok=True)
    (OUT / f"U{n}.md").write_text("\n".join(md), encoding="utf-8")
    print(f"U{n}: {sum(len(x) for x in md)} chars")


if __name__ == "__main__":
    units = [int(x) for x in sys.argv[1:]] or range(1, 13)
    for n in units:
        dump(n)
