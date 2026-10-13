"""Parse quiz sample sheets (raw/quiz/sample_*.html) into structured JSON.

Output: quizzes.json  (list of quizzes -> parts -> questions)
Media:  base64 images are written to qmedia/<sha1>.<ext>; remote media URLs
        are recorded so they can be downloaded later.
"""
import base64
import hashlib
import json
import re
from pathlib import Path

from bs4 import BeautifulSoup, NavigableString

import os

ROOT = Path(__file__).resolve().parent.parent
KEY = os.environ.get("NIX_KEY", "")          # "" = course M3 (raw/quiz), "m2" = course M2 (raw/m2/quiz)
Q = ROOT / "raw" / (KEY + "/quiz" if KEY else "quiz")
SUFFIX = "_" + KEY if KEY else ""
MEDIA = ROOT / "qmedia"
REMOTE = set()


def save_data_uri(uri):
    m = re.match(r"data:image/(\w+);base64,(.*)", uri, re.S)
    if not m:
        return uri
    ext = {"jpeg": "jpg"}.get(m.group(1), m.group(1))
    raw = base64.b64decode(m.group(2))
    name = hashlib.sha1(raw).hexdigest()[:16] + "." + ext
    MEDIA.mkdir(exist_ok=True)
    p = MEDIA / name
    if not p.exists():
        p.write_bytes(raw)
    return "media/q/" + name


def remote_name(url):
    base = url.rsplit("/", 1)[1]
    if re.search(r"\.(png|jpe?g|gif|webp|mp3|m4a|wav)$", base, re.I):
        return base
    return hashlib.sha1(url.encode()).hexdigest()[:16] + ".png"


def localize(el):
    """Rewrite media sources inside el; returns el."""
    for img in el.find_all("img"):
        src = img.get("src", "")
        if src.startswith("data:"):
            img["src"] = save_data_uri(src)
        elif src.startswith("http"):
            REMOTE.add(src)
            img["src"] = "media/q/" + remote_name(src)
        for a in ("style", "width", "height", "class"):
            img.attrs.pop(a, None)
    for src in el.find_all("source"):
        s = src.get("src", "")
        if s.startswith("http"):
            REMOTE.add(s)
            src["src"] = "media/q/" + remote_name(s)
    for au in el.find_all("audio"):
        # drop the visible file-name text node inside <audio>
        for t in list(au.children):
            if isinstance(t, NavigableString):
                t.extract()
    return el


def clean_html(el):
    if el is None:
        return ""
    localize(el)
    for t in el.find_all(True):
        if t.name not in ("img", "source", "audio"):
            for a in ("style", "class", "dir", "id"):
                t.attrs.pop(a, None)
    h = el.decode_contents()
    h = re.sub(r"\s*\n\s*", " ", h).strip()
    h = h.replace("\xa0", " ")
    return h


def text(el):
    return re.sub(r"\s+", " ", el.get_text(" ", strip=True)).replace("\xa0", " ").strip()


def add_chips(out, box):
    """Single-use chips first (indices stable), reusable chips appended."""
    spans = box.find_all("span") if box else []
    single = [text(s) for s in spans if "nice-input-border" in (s.get("class") or [])]
    reuse = [text(s) for s in spans if "border-blue" in (s.get("class") or []) and text(s)]
    out["chips"] = single + reuse
    if reuse:
        out["reuse"] = list(range(len(single), len(single) + len(reuse)))


def parse_question(q):
    first = next((c for c in q.children if getattr(c, "name", None)), None)
    if first is not None and first.name == "table":
        head_t = text(first.find("tr"))
    else:
        head_t = text(first) if first is not None else ""
    m = re.match(r"\((\d+)\)\s*(.*)", head_t)
    num = int(m.group(1)) if m else None
    kind = m.group(2).strip() if m else head_t
    out = {"n": num}
    if kind.startswith("Single choice"):
        out["type"] = "single"
        rows = q.find("table").find_all("tr")
        out["prompt"] = clean_html(rows[1].find("strong") or rows[1].td) if len(rows) > 1 else ""
        out["options"] = [clean_html(td) for td in q.select("td.single-choice-answer-content")]
    elif kind.startswith("Multiple choice"):
        out["type"] = "multi"
        rows = q.find("table").find_all("tr")
        out["prompt"] = clean_html(rows[1].find("strong") or rows[1].td) if len(rows) > 1 else ""
        out["options"] = [clean_html(td) for td in q.select("td[class*=answer-content]")]
    elif kind.startswith("Short answer"):
        out["type"] = "short"
        rows = q.find("table").find_all("tr")
        out["prompt"] = clean_html(rows[1].find("strong") or rows[1].td) if len(rows) > 1 else ""
    elif kind.startswith("Fill in the blanks"):
        out["type"] = "blanks"
        body = q.find("div", class_="ml-2")
        lis = []
        if body:
            for ul in body.find_all("ul"):
                for li in ul.find_all("li"):
                    mm = re.match(r"Section \[(\d+)\] choose one from:\s*(.*)", text(li))
                    if mm:
                        lis.append({"slot": int(mm.group(1)),
                                    "choices": [c.strip() for c in re.findall(r"\(([^)]*)\)", mm.group(2))]})
                    mm = re.match(r"Section \[(\d+)\] is a short answer", text(li))
                    if mm:
                        lis.append({"slot": int(mm.group(1)), "short": True})
                if lis:
                    ul.decompose()
        out["prompt"] = clean_html(body)
        out["slots"] = sorted(set(int(x) for x in re.findall(r"\((\d+):\s*\.{5,}\s*\)", out["prompt"])))
        if lis:
            out["slotChoices"] = lis
    elif kind.startswith("Drag answers to picture"):
        out["type"] = "order"
        box = q.find("div", class_="ml-3")
        instr = box.find("p") if box else None
        out["prompt"] = clean_html(instr) if instr else ""
        img = box.find("img") if box else None
        out["image"] = localize(img.parent).find("img")["src"] if img else None
        chips_box = box.find("div", class_="mt-5") if box else None
        add_chips(out, chips_box)
    elif kind.startswith("Drag and drop answers to text"):
        out["type"] = "dragtext"
        box = q.find("div", class_="ml-3")
        chips_box = box.find("div", class_="bg-gray-f3") if box else None
        add_chips(out, chips_box)
        if chips_box:
            chips_box.decompose()
        out["prompt"] = clean_html(box.find("div")) if box else ""
        out["nslots"] = out["prompt"].count("[..........]")
    elif kind.startswith("Matching answers"):
        out["type"] = "matching"
        out["prompt"] = clean_html(q.find("div", class_="my-3"))
        secs = []
        for tr in q.find_all("tr"):
            tds = tr.find_all("td")
            if len(tds) == 3 and "Section" in text(tds[0]):
                secs.append({"label": text(tds[1]),
                             "choices": [text(p) for p in tds[2].find_all("p")]})
        out["sections"] = secs
    else:
        out["type"] = "unknown:" + kind
        out["prompt"] = clean_html(q)
    return out


def parse(path):
    soup = BeautifulSoup(path.read_text(encoding="utf-8"), "html.parser")
    body = soup.body
    title = text(body.find("div", class_="text-center"))
    parts = []
    for hdr in body.find_all("div", style=re.compile("background-color: #2063af")):
        ptitle = text(hdr)
        cont = hdr.find_next_sibling("div")
        qs = []
        for q in cont.find_all("div", recursive=False):
            if "separator" in (q.get("class") or []):
                continue
            qs.append(parse_question(q))
        parts.append({"title": ptitle, "questions": qs})
    return {"title": title, "parts": parts}


def main():
    index = {x["quiz"]: x for x in json.loads((Q / "index.json").read_text(encoding="utf-8"))}
    out = []
    for qid, meta in index.items():
        p = Q / f"sample_{qid}.html"
        if not p.exists():
            print("no sample sheet for quiz", qid, meta["title"])
            continue
        d = parse(p)
        um = re.search(r"\d+", meta["unit"])
        d.update({"id": qid, "unit": int(um.group()) if um else 0,
                  "lesson": meta["lesson"], "name": meta["title"]})
        out.append(d)
    (ROOT / f"quizzes{SUFFIX}.json").write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    (ROOT / f"qmedia_remote{SUFFIX}.txt").write_text("\n".join(sorted(REMOTE)), encoding="utf-8")
    import collections
    c = collections.Counter(q["type"] for d in out for p in d["parts"] for q in p["questions"])
    print(c, "remote media:", len(REMOTE), "local imgs:", len(list(MEDIA.glob("*"))))


if __name__ == "__main__":
    main()
