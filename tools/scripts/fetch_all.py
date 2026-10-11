"""Download every non-quiz activity (+ its Introduce tab) and every Part
description for Units 13-17. Quiz URLs are skipped on purpose so no quiz
attempt is ever started on the student's account."""
import json
import re
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import nix  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "raw"
UNITS = re.compile(r"Unit 1[3-7]\b")


def main():
    outline = json.loads((ROOT / "outline.json").read_text(encoding="utf-8"))
    s = nix.session()
    for sec in outline:
        if not UNITS.search(sec["title"]):
            continue
        for les in sec["lessons"]:
            if les["info"]:
                out = RAW / "lesson" / f"{les['id']}.json"
                if not out.exists():
                    r = nix.get_json(s, les["info"], out=out)
                    print("lesson", les["id"], r.status_code, len(r.content))
                    time.sleep(0.4)
            for a in les["activities"]:
                if not a["url"].endswith("/activity"):
                    print("  skip quiz", a["id"], a["title"])
                    continue
                out = RAW / "act" / f"{a['id']}.json"
                if not out.exists():
                    r = nix.post_activity(s, a["url"], out=out)
                    print("  act", a["id"], a["title"], r.status_code, len(r.content))
                    time.sleep(0.4)
                out = RAW / "tab" / f"{a['id']}.json"
                if not out.exists():
                    r = nix.show_tab(s, a["id"], out=out)
                    print("  tab", a["id"], r.status_code, len(r.content))
                    time.sleep(0.4)


if __name__ == "__main__":
    main()
