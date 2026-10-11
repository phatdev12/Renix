"""Render downloaded HTML (tabs, lesson descriptions, activity bodies) into
plain text per unit so the content can be reviewed."""
import json
import re
from pathlib import Path

from bs4 import BeautifulSoup, NavigableString

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "raw"
OUT = ROOT / "text"
UNITS = re.compile(r"Unit (1[3-7])\b")


def cell_text(el):
    parts = []
    for node in el.descendants:
        if isinstance(node, NavigableString):
            parts.append(str(node))
        elif node.name == "br":
            parts.append(" / ")
        elif node.name in ("p", "li") and parts:
            parts.append(" / ")
    t = re.sub(r"\s+", " ", "".join(parts)).strip(" /")
    return t.replace("\xa0", " ").strip()


def render(html):
    soup = BeautifulSoup(html, "html.parser")
    for t in soup(["script", "style"]):
        t.decompose()
    lines = []

    def walk(el):
        for ch in el.children:
            if isinstance(ch, NavigableString):
                t = str(ch).strip()
                if t:
                    lines.append(t)
                continue
            if ch.name == "table":
                for tr in ch.find_all("tr"):
                    cells = [cell_text(td) for td in tr.find_all(["td", "th"])]
                    lines.append("| " + " | ".join(cells) + " |")
                lines.append("")
            elif ch.name == "img":
                lines.append(f"[IMG {ch.get('src')}]")
            elif ch.name in ("audio", "video", "source", "iframe"):
                lines.append(f"[{ch.name.upper()} {ch.get('src')}]")
                walk(ch)
            elif ch.name in ("p", "h1", "h2", "h3", "h4", "h5", "li", "div", "figure", "ul", "ol", "blockquote"):
                before = len(lines)
                walk(ch)
                if ch.name in ("p", "h1", "h2", "h3", "h4", "h5", "li"):
                    seg = " ".join(lines[before:])
                    del lines[before:]
                    seg = re.sub(r"\s+", " ", seg).strip()
                    if seg:
                        prefix = "- " if ch.name == "li" else ("# " if ch.name.startswith("h") else "")
                        lines.append(prefix + seg)
            else:
                walk(ch)
    walk(soup)
    text = "\n".join(lines)
    return re.sub(r"\n{3,}", "\n\n", text).replace("\xa0", " ")


def main():
    OUT.mkdir(exist_ok=True)
    outline = json.loads((ROOT / "outline.json").read_text(encoding="utf-8"))
    for sec in outline:
        m = UNITS.search(sec["title"])
        if not m:
            continue
        buf = [f"######## {sec['title']}"]
        for les in sec["lessons"]:
            buf.append(f"\n================ {les['title']} (lesson {les['id']})")
            lf = RAW / "lesson" / f"{les['id']}.json"
            if lf.exists():
                d = json.loads(lf.read_text(encoding="utf-8"))
                buf.append("---- [lesson description]")
                buf.append(render(d.get("html") or ""))
            for a in les["activities"]:
                buf.append(f"\n-------- {a['title']} (activity {a['id']}) {a['url'].rsplit('/', 1)[-1]}")
                af = RAW / "act" / f"{a['id']}.json"
                if af.exists():
                    d = json.loads(af.read_text(encoding="utf-8"))
                    h = d.get("data") or ""
                    vids = re.findall(r'data-file-url="([^"]+)"', h)
                    for v in vids:
                        buf.append(f"[MEDIA {v}]")
                    soup = BeautifulSoup(h, "html.parser")
                    # activity body without nav/tabs chrome
                    for sel in [".ul-tabs", ".btn-student-courses", ".mark-complete", ".msg-not-complete"]:
                        for e in soup.select(sel):
                            e.decompose()
                    body = render(str(soup))
                    if len(body) > 200:
                        buf.append("---- [activity body]")
                        buf.append(body)
                tf = RAW / "tab" / f"{a['id']}.json"
                if tf.exists():
                    d = json.loads(tf.read_text(encoding="utf-8"))
                    if d.get("data"):
                        buf.append("---- [introduce tab]")
                        buf.append(render(d["data"]))
        (OUT / f"U{m.group(1)}.txt").write_text("\n".join(buf), encoding="utf-8")
        print("wrote", f"U{m.group(1)}.txt")


if __name__ == "__main__":
    main()
