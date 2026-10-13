"""Generic read-only downloader for one course of digital.nix.edu.vn.

    python tools/scripts/fetch_course.py <course-slug> <outline.json> <unit-regex> <raw-dir>

For every section whose title matches <unit-regex>, download:
  * lesson descriptions            -> <raw-dir>/lesson/<lesson id>.json
  * non-quiz activities (POST)     -> <raw-dir>/act/<id>.json  (+ Introduce tab -> tab/<id>.json)
  * quizzes: landing page (history), "sample from HTML" sheet, review of past
    submissions                    -> <raw-dir>/quiz/...
Quiz attempts are NEVER started: only pages the site shows before an attempt
and the review pages of attempts that already exist are read."""
import json
import os
import re
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
course, outline_file, unit_re, raw_dir = sys.argv[1:5]
os.environ["NIX_COURSE"] = course
import nix  # noqa: E402

RAW = Path(raw_dir)
UNITS = re.compile(unit_re)
PAUSE = 0.35


def main():
    outline = json.loads(Path(outline_file).read_text(encoding="utf-8"))
    s = nix.session()
    index = []
    for sec in outline:
        if not UNITS.search(sec["title"]):
            continue
        print("==", sec["title"], flush=True)
        for les in sec["lessons"]:
            if les["info"]:
                out = RAW / "lesson" / f"{les['id']}.json"
                if not out.exists():
                    r = nix.get_json(s, les["info"], out=out)
                    print("lesson", les["id"], r.status_code, len(r.content), flush=True)
                    time.sleep(PAUSE)
            for a in les["activities"]:
                if not a["url"]:
                    continue
                if a["url"].endswith("/quiz"):
                    qid = a["id"]
                    Q = RAW / "quiz"
                    page = Q / f"{qid}.json"
                    if not page.exists():
                        nix.post_activity(s, a["url"], out=page)
                        time.sleep(PAUSE)
                    h = json.loads(page.read_text(encoding="utf-8")).get("data", "")
                    sample = Q / f"sample_{qid}.html"
                    if not sample.exists():
                        m = re.search(r'href="([^"]*download-quiz-pdf/\d+\?html=1)"', h)
                        if m:
                            nix.fetch(s, m.group(1), sample)
                            time.sleep(PAUSE)
                    reviews = re.findall(r'data-review-submission="([^"]+/review-quiz-submission/(\d+))"', h)
                    scores = re.findall(r'<p>\s*([\d.]+/10)\s*</p>', h)
                    for url, sub in reviews:
                        out = Q / f"review_{sub}.json"
                        if not out.exists():
                            nix.get_json(s, url, out=out)
                            time.sleep(PAUSE)
                    index.append({"quiz": qid, "title": a["title"], "lesson": les["title"],
                                  "unit": sec["title"], "sample": sample.exists(),
                                  "reviews": [sub for _, sub in reviews], "scores": scores})
                    print(f"  quiz {qid:>5} {a['title']:<24} sample={sample.exists()} reviews={len(reviews)} {scores}", flush=True)
                    continue
                out = RAW / "act" / f"{a['id']}.json"
                if not out.exists():
                    r = nix.post_activity(s, a["url"], out=out)
                    print("  act", a["id"], a["title"], r.status_code, len(r.content), flush=True)
                    time.sleep(PAUSE)
                out = RAW / "tab" / f"{a['id']}.json"
                if not out.exists():
                    r = nix.show_tab(s, a["id"], out=out)
                    print("  tab", a["id"], r.status_code, len(r.content), flush=True)
                    time.sleep(PAUSE)
    (RAW / "quiz").mkdir(parents=True, exist_ok=True)
    (RAW / "quiz" / "index.json").write_text(json.dumps(index, ensure_ascii=False, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()
