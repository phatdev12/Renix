"""Build the static data files for the review site.

Inputs (scratchpad): outline.json, raw/act, kb_raw.json, content/*.json,
quizzes.json, answers/U*.json, verified_keys.json, kvg.json, pdfimg/, qmedia/, raw/pdf/
Output (site dir, argv[1]): src/data/*.json, public/media/{q,guides,pdf}/
(media paths inside the data are absolute: /media/…, served from public/ by Astro)
"""
import json
import re
import shutil
import sys
from pathlib import Path

from bs4 import BeautifulSoup, NavigableString

ROOT = Path(__file__).resolve().parent.parent
SITE = Path(sys.argv[1]).resolve()
# courses merged into one site: M2 (N5, Unit 1-12) and M3 (N4, Unit 13-17)
COURSES = [
    {"key": "n5", "short": "N5", "level": "N5", "name": "M2 – N5: Tiếng Nhật cơ sở 1", "book": "NEJ Vol.1 テーマで学ぶ基礎日本語",
     "units": list(range(1, 13))},
    {"key": "n4", "short": "N4", "level": "N4", "name": "M3 – N4: Tiếng Nhật cơ sở 2", "book": "NEJ Vol.2 テーマで学ぶ基礎日本語",
     "units": [13, 14, 15, 16, 17]},
]
UNITS = [13, 14, 15, 16, 17]          # M3 units (hand-written content in content/*.json)
M2_UNITS = list(range(1, 13))         # M2 units (content/m2/U<n>.json + kb_raw_m2.json)
KANJI_RE = r"[一-鿿々〆ヶ]"


def load(p):
    return json.loads((ROOT / p).read_text(encoding="utf-8"))


# ---------------------------------------------------------------- furigana
def align(kanji, kana):
    """Return ruby markup {漢字|かな} for a word given kanji and kana forms."""
    if not kanji or kanji == kana or not re.search(KANJI_RE, kanji):
        return kanji or kana
    runs = re.findall(KANJI_RE + "+|[^一-鿿々〆ヶ]+", kanji)
    pat = "".join("(.+?)" if re.match(KANJI_RE, r) else re.escape(r) for r in runs)
    m = re.fullmatch(pat, kana)
    if not m:
        return "{%s|%s}" % (kanji, kana)
    out, gi = "", 1
    for r in runs:
        if re.match(KANJI_RE, r):
            out += "{%s|%s}" % (r, m.group(gi))
            gi += 1
        else:
            out += r
    return out


# ---------------------------------------------------------------- vocab
VOCAB_FIX = {
    "とくいな": {"vi": "tâm đắc, sở trường (giỏi)"},
    "はかせかてい": {"note": "（bài khóa đọc: はくしかてい）"},
    "はかせごう": {"note": "（bài khóa đọc: はくしごう）"},
    "だいたい": {"kanji": ""},
}


def build_vocab(unit, raw, ext=(), start=0):
    """raw = main list; ext = extended list (marked "mở rộng")"""
    out = []
    for i, v in enumerate(list(raw) + list(ext)):
        is_ext = i >= len(raw)
        kana, kanji, vi = v["kana"].strip(), v["kanji"].strip(), v["vi"].strip()
        kana = re.sub(r"\s+", "", kana)
        fix = VOCAB_FIX.get(kana, {})
        kanji = fix.get("kanji", kanji)
        vi = fix.get("vi", vi)
        note = ""
        m = re.search(r"[（(]([^）)]*)[）)]", kana)
        if m and not kana.startswith(("（", "(")):
            note = "（%s）" % m.group(1)
            kana = (kana[:m.start()] + kana[m.end():]).strip()
        lead = ""
        m = re.match(r"^[（(]([^）)]*)[）)]", kana)
        if m:
            lead = "（%s）" % m.group(1)
            kana = kana[m.end():]
            km = re.match(r"^[（(]([^）)]*)[）)]", kanji)
            if km:
                kanji = kanji[km.end():]
        k2 = re.sub(r"[（(][^）)]*[）)]", "", kanji).strip()
        ruby = align(k2, kana) if k2 else kana
        item = {"id": f"{unit}-{start + i + 1}", "kana": kana, "kanji": k2, "ruby": ruby,
                "vi": vi, "pre": lead, "note": fix.get("note", note)}
        if is_ext:
            item["ext"] = True
        out.append(item)
    return out


# ---------------------------------------------------------------- kanji
KANJI_FIX = {
    "昼": {"hv": [{"t": "TRÚ"}], "fix": "Tài liệu gốc ghi Hán Việt là NOÃN (nhầm với 暖); âm đúng của 昼 là TRÚ."},
    "料": {"hv": [{"t": "LIỆU"}], "fix": "Tài liệu gốc ghi LIÊU; âm đúng là LIỆU (nguyên liệu, tài liệu)."},
    "続": {"hv": [{"t": "TỤC"}], "fix": "Tài liệu gốc ghi TIẾP; âm Hán Việt đúng của 続 (續) là TỤC (liên tục, thủ tục)."},
    "員": {"on": [{"t": "イン"}], "fix": "Tài liệu gốc viết âm On bằng hiragana (いん); chuẩn là katakana イン."},
}
EX_FIX = {"たんじょび": "たんじょうび"}


def split_marks(items):
    out = []
    for raw in items:
        for part in re.split(r"\s*/\s*", raw):
            part = part.strip().strip("、,")
            if not part or part.upper() == "X":
                continue
            rare = "*" in part
            t = re.sub(r"\*\s*", "", part).strip()
            out.append({"t": t, "rare": rare} if rare else {"t": t})
    return out


def split_top(s):
    """split on '/' that is not inside parentheses"""
    parts, depth, cur = [], 0, ""
    for ch in s:
        if ch in "（(":
            depth += 1
        elif ch in "）)":
            depth = max(0, depth - 1)
        if ch in "/／" and depth == 0:
            parts.append(cur)
            cur = ""
        else:
            cur += ch
    parts.append(cur)
    return [p.strip() for p in parts if p.strip()]


def parse_kun(items):
    out = []
    for raw in [" / ".join(items)]:
        for part in split_top(raw):
            part = part.strip()
            if not part or part.upper() == "X":
                continue
            rare_all = part.lstrip().startswith("*")
            m = re.match(r"^\*?\s*([^（(]+?)\s*[（(](.*)[）)]\s*$", part)
            if m:
                inner = [x.strip() for x in re.split(r"[、,・/]", m.group(2)) if x.strip()]
                for x in inner:
                    rare = rare_all or "*" in x
                    t = re.sub(r"\*\s*", "", x).strip()
                    if t:
                        out.append({"t": t, "rare": True} if rare else {"t": t})
            else:
                t = re.sub(r"\*\s*", "", part).strip()
                out.append({"t": t, "rare": True} if rare_all else {"t": t})
    # de-duplicate
    seen, res = set(), []
    for k in out:
        if k["t"] not in seen:
            seen.add(k["t"])
            res.append(k)
    return res


def parse_examples(items):
    out = []
    for raw in items:
        s = re.sub(r"^[①②➀➁③④➂➃\s]+", "", raw).strip()
        rare = s.startswith("*")
        s = s.lstrip("* ").strip()
        m = re.match(r"^(.+?)\s*[：:]\s*([^\s(（]+(?:・[^\s(（]+)?)\s*[(（](.*?)[)）]*\s*$", s)
        if not m:
            out.append({"w": s, "r": "", "vi": "", "ruby": s, **({"rare": True} if rare else {})})
            continue
        w, r, vi = m.group(1).strip().lstrip("* "), m.group(2).strip(), m.group(3).strip()
        if w.startswith("*"):
            rare = True
            w = w.lstrip("* ")
        r = EX_FIX.get(r, r)
        reading_for_ruby = r.split("・")[0]
        rb = align(w, reading_for_ruby) if re.search(KANJI_RE, w) else w
        e = {"w": w, "r": r, "vi": vi, "ruby": rb}
        if rare:
            e["rare"] = True
        out.append(e)
    return out


def build_kanji(unit, lists, kvg):
    out = []
    for lst in lists:
        kind = "n4" if "JLPT" in lst["title"] else "unit"
        for it in lst["items"]:
            c = it["char"].strip()
            k = {"c": c, "list": kind,
                 "hv": split_marks(it["hv"]),
                 "on": split_marks(it["on"]),
                 "kun": parse_kun(it["kun"]),
                 "meaning": " / ".join(x.strip() for x in it["meaning"] if x.strip()),
                 "ex": parse_examples(it["examples"]),
                 "strokes": len(kvg.get(c, {}).get("s", []))}
            if c in KANJI_FIX:
                k.update(KANJI_FIX[c])
            out.append(k)
    return out


# ---------------------------------------------------------------- videos / guides
def video_map():
    vm = {}
    for f in list((ROOT / "raw" / "act").glob("*.json")) + list((ROOT / "raw" / "m2" / "act").glob("*.json")):
        h = json.loads(f.read_text(encoding="utf-8"))["data"]
        m = re.search(r'data-file-url="([^"]+)"', h)
        t = re.search(r"<h1[^>]*>(.*?)</h1>", h, re.S)
        if m:
            vm[int(f.stem)] = {"url": m.group(1), "title": re.sub(r"\s+", " ", t.group(1)).strip() if t else ""}
    return vm


VIDEO_IDS = {13: {"text": 240, "vocab": 241, "kanji": 248}, 14: {"text": 252, "vocab": 253, "kanji": 258},
             15: {"text": 265, "vocab": 266, "kanji": 281}, 16: {"text": 285, "vocab": 286, "kanji": 294},
             17: {"text": 301, "vocab": 302, "kanji": 307}}

GUIDES = {
    13: [("li", "Unit-13_Huong-dan-luyen-phat-am---Li"), ("akio", "Unit-13_Huong-dan-luyen-phat-am---Akio")],
    14: [("li", "Unit-14_Huong-dan-luyen-phat-am---Li"), ("akio", "Unit-14_Huong-dan-luyen-phat-am---Akio"),
         ("nishiyama", "Unit-14_Huong-dan-luyen-phat-am---Nishiyama")],
    15: [("li", "Unit-15_Huong-dan-luyen-phat-am---Li"), ("akio", "Unit-15_Huong-dan-luyen-phat-am---Akio")],
    16: [("li", "Unit-16_Huong-dan-luyen-phat-am---LiA", "A. できる言語"),
         ("li", "Unit-16_Huong-dan-luyen-phat-am---Li-B", "B. 食べられるもの"),
         ("nishiyama", "Unit-16_Huong-dan-luyen-phat-am---Nishiyama", "C. できる料理")],
    17: [("li", "Unit-17_Huong-dan-luyen-phat-am---Li"), ("akio", "Unit-17_Huong-dan-luyen-phat-am---Akio"),
         ("nishiyama", "Unit-17_Huong-dan-luyen-phat-am---Nishiyama")],
}
PDFS = {13: {"yomimono": "Unit-13_Yomimono", "shadowing": "Unit-13_Huong-dan-luyen-Shadowing-2", "model": "Unit13"},
        14: {"yomimono": "U14---Yomimono-1", "shadowing": "Unit-14_Huong-dan-luyen-shadowing"},
        15: {"yomimono": "Unit-15_Yomimono", "shadowing": "Unit-15_Huong-dan-luyen-shadowing"},
        16: {"yomimono": "Unit-16_Yomimono", "shadowing": "Unit-16_Huong-dan-luyen-shadowing"},
        17: {"yomimono": "Unit-17_Yomimono", "shadowing": "Unit-17_Huong-dan-luyen-shadowing"}}


def pages(stem):
    found = []
    for src in (ROOT / "pdfimg", ROOT / "pdfimg_m2", SITE / "public" / "media" / "guides"):
        if src.exists():
            found += [f"/media/guides/{p.name}" for p in src.glob(stem + "_p*.png")]
    return sorted(set(found), key=lambda s: int(re.search(r"_p(\d+)\.png$", s).group(1)))


# ---------------------------------------------------------------- course M2 (N5) helpers
def m2_outline_unit(u):
    outline = load("outline_m2.json")
    return next(s for s in outline if s["title"].strip() == f"Unit {u}")


def m2_guides(u):
    """PDF reading guides linked from the [UnP1]ドリル activity: speaker guessed from the kana text."""
    from pypdf import PdfReader
    sec = m2_outline_unit(u)
    out, pdfs = [], {}
    for les in sec["lessons"]:
        if "マスターテクスト" not in les["title"]:
            continue
        for a in les["activities"]:
            if "ドリル" not in a["title"] or not a["url"].endswith("/activity"):
                continue
            h = json.loads((ROOT / "raw" / "m2" / "act" / f"{a['id']}.json").read_text(encoding="utf-8"))["data"]
            for url in dict.fromkeys(re.findall(r'https?://storage\.googleapis\.com/[^"\']+\.pdf', h)):
                name = url.rsplit("/", 1)[1]
                f = ROOT / "raw" / "m2" / "pdf" / name
                if not f.exists():
                    continue
                try:
                    txt = "".join((pg.extract_text() or "") for pg in PdfReader(str(f)).pages)
                except Exception:  # noqa: BLE001
                    txt = ""
                head = re.sub(r"\s+", "", txt)[:80]
                spk = "akio" if "あきお" in head else "nishiyama" if "にしやま" in head else "li" if ("りあいりん" in head or "リ" in head or "り" in head[:12]) else "li"
                stem = name[:-4]
                out.append({"speaker": spk, "label": "", "pages": pages(stem), "pdf": f"/media/pdf/{name}"})
                pdfs[stem] = name
    return out


def m2_unit(u, kb, kvg, vm):
    c = load(f"content/m2/U{u}.json")
    k = kb[str(u)]
    g = []
    for item in c["grammar"]:
        item = dict(item)
        item["id"] = f"{u}-{item['no']}"
        vid = item.pop("video", None)
        if vid in vm:
            item["video"] = vm[vid]["url"]
            item["videoTitle"] = vm[vid]["title"]
        for f in ("sub", "table", "titleNote"):
            if item.get(f) is None:
                item.pop(f, None)
        g.append(item)
    vids = k.get("videos", {})
    videos = {}
    if vids.get("text"):
        videos["text"] = vm[vids["text"][0]]["url"] if vids["text"][0] in vm else None
        if len(vids["text"]) > 1 and vids["text"][1] in vm:
            videos["textB"] = vm[vids["text"][1]]["url"]
    for key in ("vocab", "kanji"):
        if vids.get(key) in vm:
            videos[key] = vm[vids[key]]["url"]
    videos = {a: b for a, b in videos.items() if b}
    guides = m2_guides(u)
    t = c["text"]
    unit = {
        "id": u, "course": "n5",
        "title": t["title"], "titleVi": t["titleVi"], "titleNote": t.get("titleNote"),
        "sections": t["sections"],
        "videos": videos,
        "guides": [{"speaker": x["speaker"], "label": x["label"], "pages": x["pages"]} for x in guides],
        "pdfs": {("guide%d" % i if i else "guide"): x["pdf"] for i, x in enumerate(guides)},
        "pdfPages": {},
        "vocab": build_vocab(u, k["vocab_p1"], k.get("vocab_ext", [])),
        "grammar": g,
        "kanji": build_kanji(u, k["kanji"], kvg),
        "essay": c["essay"],
    }
    return unit, c.get("speakers", {}), c.get("verbs", [])


# ---------------------------------------------------------------- quiz bank
ALLOWED = {"p", "br", "strong", "b", "em", "i", "u", "span", "ruby", "rt", "img", "audio", "source",
           "ol", "ul", "li", "table", "tbody", "thead", "tr", "td", "th", "figure", "div", "sup", "sub",
           "h1", "h2", "h3", "h4", "h5", "h6", "s", "mark", "small"}
ATTRS = {"img": {"src", "alt"}, "source": {"src", "type"}, "audio": {"controls"}, "td": {"colspan", "rowspan"},
         "th": {"colspan", "rowspan"}}


def sanitize(html):
    soup = BeautifulSoup(html or "", "html.parser")
    for t in soup.find_all(True):
        if t.name not in ALLOWED:
            if t.name in ("script", "style", "iframe", "object", "embed", "form", "input", "button"):
                t.decompose()
            else:
                t.unwrap()
            continue
        keep = ATTRS.get(t.name, set())
        for a in list(t.attrs):
            if a not in keep:
                del t[a]
        if t.name in ("img", "source") and not str(t.get("src", "")).startswith("media/q/"):
            t.decompose()
        if t.name == "audio":
            t["controls"] = ""
            t["preload"] = "none"
    s = str(soup)
    s = re.sub(r"(<p>\s*-{5,}\s*</p>)", '<hr class="qsep">', s)
    return s.replace("\xa0", " ").strip()


PART_RE = re.compile(r"Part\s*(\d)")

# The student's own 10/10 attempt shows the LMS accepting answers that contradict
# the reading text for these two questions; keep the text-based answer and say so.
LMS_OVERRIDE = {
    "2026/1/3": {"ans": 1, "lms": 3, "explain": "Bài đọc: 「10時に学校を出たら、12時ごろにうちに着きます。そんなときは、1時か2時に、寝ます」 — những hôm làm thí nghiệm đến khuya, Akio ngủ lúc 1 hoặc 2 giờ.", "note": "Bài khóa ghi「そんなときは、1時か2時に、寝ます」nên đáp án đúng theo bài là「1時か2時に、寝ます」. Tuy nhiên trong lần làm đạt 10/10 của bạn, LMS lại chấm「1時に、寝ます」là đúng — có vẻ hệ thống cài nhầm đáp án."},
    "2026/1/4": {"ans": 3, "lms": 0, "explain": "Bài đọc: 「朝ごはんが終わったら、歯をみがきます。そして、8時に学校に行きます」 — ăn sáng xong Akio đánh răng.", "note": "Bài khóa ghi「朝ごはんが終わったら、歯をみがきます」nên đáp án đúng theo bài là「歯を磨きます」. Tuy nhiên trong lần làm đạt 10/10 của bạn, LMS lại chấm「シャワーをします」là đúng — có vẻ hệ thống cài nhầm đáp án."},
}


def strip_label(s):
    return re.sub(r"^[（(]\s*|\s*[）)]$", "", str(s).strip()).strip()


def norm_order(ans, chips, reuse):
    if not isinstance(ans, list):
        return ans
    out = []
    for a in ans:
        if isinstance(a, int):
            out.append(a)
            continue
        cand = [i for i, c in enumerate(chips) if c == a]
        pref = [i for i in cand if i in (reuse or [])] or cand
        if not pref:
            raise ValueError(f"chip text not found: {a} in {chips}")
        out.append(pref[0])
    return out


def norm_matching(ans, sections):
    if not isinstance(ans, dict):
        return ans
    res, seen = [], {}
    labels = [s["label"] for s in sections]
    for s in sections:
        lab = s["label"]
        seen[lab] = seen.get(lab, 0) + 1
        keys = [f"{lab} #{seen[lab]}"] if labels.count(lab) > 1 else []
        keys += [lab, lab.rstrip(".．"), strip_label(lab), strip_label(lab).rstrip(".．")]
        v = next((ans[k] for k in keys if k in ans), None)
        if v is None:
            res.append(None)
            continue
        def variants(x):
            x = str(x).strip()
            return {x, strip_label(x), "(%s)" % x}
        hit = [i for i, c in enumerate(s["choices"]) if variants(c) & variants(v)]
        res.append(hit[0] if hit else None)
        if not hit:
            print("   matching value not in choices:", lab, v, s["choices"])
    return res


def build_bank():
    quizzes = load("quizzes.json")
    verified = load("verified_keys.json")
    if (ROOT / "quizzes_m2.json").exists():
        quizzes = load("quizzes_m2.json") + quizzes
    if (ROOT / "verified_keys_m2.json").exists():
        verified = {**load("verified_keys_m2.json"), **verified}
    answers = {}
    for p in [ROOT / "answers" / f"U{u}.json" for u in UNITS] + [ROOT / "answers" / "m2" / f"U{u}.json" for u in M2_UNITS]:
        if p.exists():
            answers.update(json.loads(p.read_text(encoding="utf-8")))
    bank, stats = [], {"q": 0, "keyed": 0, "audio": 0, "missing": 0}
    for qz in quizzes:
        pm = PART_RE.search(qz["lesson"])
        part = int(pm.group(1)) if pm else 0
        kind = "test" if "テスト" in qz["name"] else "drill"
        parts = []
        for pi, p in enumerate(qz["parts"]):
            qs = []
            for q in p["questions"]:
                key = f"{qz['id']}/{pi}/{q['n']}"
                item = {k: v for k, v in q.items() if k not in ("prompt", "options")}
                item["key"] = key
                item["prompt"] = sanitize(q.get("prompt", ""))
                if "options" in q:
                    item["options"] = [sanitize(o) for o in q["options"]]
                a = answers.get(key)
                if a is None:
                    stats["missing"] += 1
                else:
                    item["ans"] = a.get("answer")
                    for f in ("sentence", "explain", "confidence", "note"):
                        if a.get(f):
                            item[f] = a[f]
                    if a.get("needs_audio"):
                        item["needs_audio"] = True
                        item["ans"] = None
                        item.pop("note", None)
                        stats["audio"] += 1
                v = verified.get(key)
                if v and v.get("verified"):
                    item["ans"] = v["answer"]
                    item["verified"] = True
                    item["confidence"] = "high"
                if key in LMS_OVERRIDE:
                    o = LMS_OVERRIDE[key]
                    item["ans"], item["lms"], item["note"], item["explain"] = o["ans"], o["lms"], o["note"], o["explain"]
                    item.pop("verified", None)
                if q["type"] in ("order", "dragtext") and item.get("ans") is not None:
                    item["ans"] = norm_order(item["ans"], q["chips"], q.get("reuse"))
                if q["type"] == "matching" and item.get("ans") is not None:
                    item["ans"] = norm_matching(item["ans"], q["sections"])
                if item.get("ans") is not None:
                    stats["keyed"] += 1
                stats["q"] += 1
                qs.append(item)
            title = re.sub(r"^Part\s+[IVX]+\s*-\s*", "", p["title"]).strip()
            parts.append({"title": title, "questions": qs})
        bank.append({"id": qz["id"], "unit": qz["unit"], "part": part, "lesson": qz["lesson"],
                     "name": qz["name"], "kind": kind, "parts": parts})
    bank.sort(key=lambda b: (b["unit"], b["part"], b["kind"] == "test", b["name"]))
    return bank, stats


# ---------------------------------------------------------------- main
def write_json(name, obj):
    """src/data/<name>.json; relative media paths (also inside question HTML) become absolute /media/…"""
    p = SITE / "src" / "data" / (name + ".json")
    p.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(obj, ensure_ascii=False, separators=(",", ":"))
    p.write_text(re.sub(r'(?<=")media/', "/media/", text), encoding="utf-8")
    print(f"  src/data/{name}.json: {p.stat().st_size // 1024} KB")


def copy_dir(src, dst):
    if not src.exists():
        return 0
    dst.mkdir(parents=True, exist_ok=True)
    n = 0
    for f in src.iterdir():
        if f.is_file():
            t = dst / f.name
            if not t.exists() or t.stat().st_size != f.stat().st_size:
                shutil.copy2(f, t)
                n += 1
    return n


def main():
    kb = load("kb_raw.json")
    kvg = load("kvg.json")
    texts = load("content/texts.json")
    grammar = load("content/grammar.json")
    essays = load("content/essays.json")
    verbs = load("content/verbs.json")
    vm = video_map()
    speakers = dict(texts["speakers"])

    units = []
    kb2 = load("kb_raw_m2.json") if (ROOT / "kb_raw_m2.json").exists() else {}
    m2_verbs = []
    for u in M2_UNITS:
        if str(u) not in kb2 or not (ROOT / "content" / "m2" / f"U{u}.json").exists():
            print(f"U{u}: (M2) no data yet, skipped")
            continue
        unit, spk, vb = m2_unit(u, kb2, kvg, vm)
        units.append(unit)
        speakers.update(spk)
        for v in vb:
            m2_verbs.append(dict(v, u=u))
    for u in UNITS:
        t = texts["units"][str(u)]
        g = []
        for gi, item in enumerate(grammar[str(u)]):
            item = dict(item)
            item["id"] = f"{u}-{item['no']}"
            vid = item.pop("video", None)
            if vid in vm:
                item["video"] = vm[vid]["url"]
                item["videoTitle"] = vm[vid]["title"]
            g.append(item)
        units.append({
            "id": u, "course": "n4",
            "title": t["title"], "titleVi": t["titleVi"], "titleNote": t.get("titleNote"),
            "sections": t["sections"],
            "videos": {k: vm[v]["url"] for k, v in VIDEO_IDS[u].items() if v in vm},
            "guides": [{"speaker": x[0], "label": x[2] if len(x) > 2 else "", "pages": pages(x[1])} for x in GUIDES[u]],
            "pdfs": {k: f"/media/pdf/{v}.pdf" for k, v in PDFS[u].items()},
            "pdfPages": {k: pages(v) for k, v in PDFS[u].items()},
            "vocab": build_vocab(u, kb[str(u)]["vocab_p1"]),
            "grammar": g,
            "kanji": build_kanji(u, kb[str(u)]["kanji"], kvg),
            "essay": essays["topics"][str(u)],
            **({"model": essays["model13"]} if u == 13 else {}),
        })

    # verbs: M3 list (hand-written) + verbs of the M2 units, de-duplicated by ます-form
    seen = {v["m"] for v in verbs}
    for v in m2_verbs:
        if v["m"] not in seen:
            seen.add(v["m"])
            verbs.append(v)
    verbs.sort(key=lambda v: (v.get("u", 99), v["m"]))
    for v in verbs:
        v["ruby"] = align(v["k"], v["m"])

    bank, stats = build_bank()
    print("bank:", stats)

    nix = {"built": "2026-10-12",
           "course": {"name": "M2 – N5 Tiếng Nhật cơ sở 1 · M3 – N4 Tiếng Nhật cơ sở 2", "book": "NEJ Vol.1–2 テーマで学ぶ基礎日本語",
                      "source": "digital.nix.edu.vn"},
           "courses": COURSES,
           "speakers": speakers, "units": units}
    print("writing to", SITE)
    write_json("units", nix)
    write_json("kanjivg", kvg)
    write_json("verbs", verbs)
    write_json("bank", bank)
    media = SITE / "public" / "media"
    print("  media/q new:", copy_dir(ROOT / "qmedia", media / "q"))
    print("  media/guides new:", copy_dir(ROOT / "pdfimg", media / "guides") + copy_dir(ROOT / "pdfimg_m2", media / "guides"))
    print("  media/pdf new:", copy_dir(ROOT / "raw" / "pdf", media / "pdf") + copy_dir(ROOT / "raw" / "m2" / "pdf", media / "pdf"))
    # bài đọc chuyên ngành (M17 SE Unit 13-18)
    se_src = ROOT / "content" / "se" / "se.json"
    if se_src.exists():
        se_raw = load("content/se/se_raw.json")
        se = []
        for k, v in sorted(json.loads(se_src.read_text(encoding="utf-8")).items(), key=lambda kv: int(kv[0])):
            vocab = []
            for w in se_raw[k]["vocab"]:
                r = w["r"] if not re.fullmatch(r"[－—-]?", w["r"]) else ""
                vocab.append({"w": w["w"], "r": r, "hv": w["hv"], "vi": w["vi"], "ruby": align(w["w"], r) if r and re.search(KANJI_RE, w["w"]) else w["w"]})
            se.append({"id": int(k), **v, "vocab": vocab})
        write_json("se", se)

    # sanity report
    for u in units:
        bad = [v["kana"] for v in u["vocab"] if v["kanji"] and "{" not in v["ruby"]]
        nostroke = [k["c"] for k in u["kanji"] if not k["strokes"]]
        print(f"U{u['id']}: vocab {len(u['vocab'])} grammar {len(u['grammar'])} kanji {len(u['kanji'])}"
              f" guides {[len(x['pages']) for x in u['guides']]} videos {list(u['videos'])}"
              + (f" RUBY? {bad}" if bad else "") + (f" NOSTROKE {nostroke}" if nostroke else ""))


if __name__ == "__main__":
    main()
