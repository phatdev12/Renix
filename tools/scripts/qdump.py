"""Write a readable per-unit dump of all quiz questions for solving."""
import json
import re
from pathlib import Path

import os

ROOT = Path(__file__).resolve().parent.parent
KEY = os.environ.get("NIX_KEY", "")
SUFFIX = "_" + KEY if KEY else ""
MEDIA_ABS = (ROOT / "qmedia").resolve()


def h2t(h):
    h = re.sub(r'<img[^>]*src="media/q/([^"]+)"[^>]*>', lambda m: f" [IMAGE: {MEDIA_ABS / m.group(1)}] ", h)
    h = re.sub(r'<source[^>]*src="media/q/([^"]+)"[^>]*>', lambda m: f" [AUDIO: {m.group(1)}] ", h)
    h = re.sub(r"<br\s*/?>|</p>|</li>|</tr>", "\n", h)
    h = re.sub(r"</td>", " | ", h)
    h = re.sub(r"<[^>]+>", "", h)
    h = h.replace("&nbsp;", " ").replace("&lt;", "<").replace("&gt;", ">").replace("&amp;", "&")
    h = re.sub(r"[ \t]+", " ", h)
    return re.sub(r"\n\s*\n+", "\n", h).strip()


def main():
    quizzes = json.loads((ROOT / f"quizzes{SUFFIX}.json").read_text(encoding="utf-8"))
    keys = json.loads((ROOT / f"verified_keys{SUFFIX}.json").read_text(encoding="utf-8"))
    out_dir = ROOT / ("qdump" + SUFFIX)
    out_dir.mkdir(exist_ok=True)
    by_unit = {}
    for qz in quizzes:
        by_unit.setdefault(qz["unit"], []).append(qz)
    for unit, qzs in sorted(by_unit.items()):
        lines = [f"# Unit {unit} — quiz questions\n"]
        for qz in qzs:
            lines.append(f"\n## QUIZ {qz['id']}  {qz['name']}  ({qz['lesson']})")
            for pi, part in enumerate(qz["parts"]):
                lines.append(f"\n### PART {pi}: {part['title']}")
                for q in part["questions"]:
                    key = f"{qz['id']}/{pi}/{q['n']}"
                    lines.append(f"\n--- KEY {key}  type={q['type']}")
                    if q.get("prompt"):
                        lines.append(h2t(q["prompt"]))
                    if q["type"] in ("single", "multi"):
                        for i, o in enumerate(q["options"]):
                            lines.append(f"  [{i}] {h2t(o)}")
                        if key in keys and keys[key].get("verified"):
                            lines.append(f"  (VERIFIED ANSWER: {keys[key]['answer']})")
                    if q["type"] in ("order", "dragtext"):
                        if q.get("image"):
                            lines.append(f"  [IMAGE: {MEDIA_ABS / q['image'].split('/')[-1]}]")
                        for i, c in enumerate(q["chips"]):
                            lines.append(f"  chip[{i}] {c}")
                        if q["type"] == "dragtext":
                            lines.append(f"  slots: {q['nslots']}")
                    if q["type"] == "blanks":
                        lines.append(f"  slots: {q['slots']}")
                        for sc in q.get("slotChoices", []):
                            if sc.get("short"):
                                lines.append(f"  slot {sc['slot']}: free text answer")
                            else:
                                lines.append(f"  slot {sc['slot']} choose from: {sc['choices']}")
                    if q["type"] == "matching":
                        for s in q["sections"]:
                            lines.append(f"  section {s['label']} choose from labels: {s['choices']}")
        (out_dir / f"U{unit}.md").write_text("\n".join(lines), encoding="utf-8")
        print(unit, sum(len(p["questions"]) for qz in qzs for p in qz["parts"]), "questions")


if __name__ == "__main__":
    main()
