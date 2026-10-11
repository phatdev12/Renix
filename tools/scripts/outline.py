"""Parse the course sidebar into sections -> lessons -> activities (JSON)."""
import json
import re
import sys
from pathlib import Path

from lxml import html as LH


def text(el):
    return re.sub(r"\s+", " ", el.text_content()).strip()


def main(src, out):
    doc = LH.fromstring(Path(src).read_text(encoding="utf-8"))
    sections = []
    for sec in doc.cssselect("#sidebar-course-student .student-section"):
        head = sec.cssselect(".toggle-section")[0]
        sid = head.get("data-id")
        title = text(head.cssselect(".text-sidebar")[0])
        lessons = []
        for lw in sec.cssselect(f".student-lesson-{sid}"):
            lh = lw.cssselect(".toggle-lesson")
            if not lh:
                continue
            lh = lh[0]
            lid = lh.get("data-id")
            ltitle = text(lh.cssselect(".text-lesson-sidebar")[0])
            info = lh.cssselect(".display-info")
            acts = []
            for a in lw.cssselect(".show-activity-detail"):
                row = a.getparent().getparent()
                icons = [i.get("class") for i in row.getparent().cssselect("i")]
                acts.append({
                    "id": a.get("data-activity-id"),
                    "title": text(a),
                    "url": a.get("data-show-activity"),
                    "icons": icons,
                })
            lessons.append({"id": lid, "title": ltitle,
                            "info": info[0].get("data-url") if info else None,
                            "activities": acts})
        sections.append({"id": sid, "title": title, "lessons": lessons})
    Path(out).write_text(json.dumps(sections, ensure_ascii=False, indent=1), encoding="utf-8")
    for s in sections:
        print(f"== {s['title']} (section {s['id']}) lessons={len(s['lessons'])}")
        if not re.search(r"Unit 1[3-7]\b", s["title"]):
            continue
        for l in s["lessons"]:
            print(f"   - [{l['id']}] {l['title']}  ({len(l['activities'])} acts)")
            for a in l["activities"]:
                print(f"        * {a['id']:>5} {a['title']}  {a['url'].split('/activity/')[1] if a['url'] else ''}  {a['icons']}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
