"""For every quiz (ドリル/テスト) of Units 13-17, download (read-only):
  * the quiz landing page (submission history; this never starts an attempt)
  * the "sample from HTML" question sheet
  * the review page of every past submission
Starting a new attempt needs a separate confirmed click on the site, which
this script never performs."""
import json
import re
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import nix  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
Q = ROOT / "raw" / "quiz"
UNITS = re.compile(r"Unit 1[3-7]\b")


def main():
    outline = json.loads((ROOT / "outline.json").read_text(encoding="utf-8"))
    s = nix.session()
    index = []
    for sec in outline:
        if not UNITS.search(sec["title"]):
            continue
        for les in sec["lessons"]:
            for a in les["activities"]:
                if not a["url"].endswith("/quiz"):
                    continue
                qid = a["id"]
                page = Q / f"{qid}.json"
                if not page.exists():
                    nix.post_activity(s, a["url"], out=page)
                    time.sleep(0.4)
                h = json.loads(page.read_text(encoding="utf-8")).get("data", "")
                sample = Q / f"sample_{qid}.html"
                if not sample.exists():
                    m = re.search(r'href="([^"]*download-quiz-pdf/\d+\?html=1)"', h)
                    if m:
                        nix.fetch(s, m.group(1), sample)
                        time.sleep(0.4)
                reviews = re.findall(r'data-review-submission="([^"]+/review-quiz-submission/(\d+))"', h)
                scores = re.findall(r'<p>\s*([\d.]+/10)\s*</p>', h)
                for url, sub in reviews:
                    out = Q / f"review_{sub}.json"
                    if not out.exists():
                        nix.get_json(s, url, out=out)
                        time.sleep(0.4)
                index.append({"quiz": qid, "title": a["title"], "lesson": les["title"],
                              "unit": sec["title"], "sample": sample.exists(),
                              "reviews": [sub for _, sub in reviews], "scores": scores})
                print(f"{qid:>5} {a['title']:<22} sample={sample.exists()} reviews={len(reviews)} scores={scores}")
    (Q / "index.json").write_text(json.dumps(index, ensure_ascii=False, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()
