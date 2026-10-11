"""Extract verified answers from the student's own reviewed submissions."""
import json
import re
from pathlib import Path

from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent.parent
Q = ROOT / "raw" / "quiz"


def norm(s):
    s = re.sub(r"<[^>]+>", "", s)
    return re.sub(r"[\s　]+", "", s).replace("\xa0", "")


def main():
    index = json.loads((Q / "index.json").read_text(encoding="utf-8"))
    quizzes = {q["id"]: q for q in json.loads((ROOT / "quizzes.json").read_text(encoding="utf-8"))}
    keys = {}
    for meta in index:
        for sub in meta["reviews"]:
            h = json.loads((Q / f"review_{sub}.json").read_text(encoding="utf-8"))["data"]
            soup = BeautifulSoup(h, "html.parser")
            for qd in soup.select("div.questions"):
                badge = qd.select_one(".badge-question")
                ok = "bg-success" in (badge.get("class") or [])
                prompt = qd.select_one(".ck-content")
                chosen = [norm(inp.find_next("label").decode_contents())
                          for inp in qd.select("input.checkbox-answer[checked]")]
                keys.setdefault(meta["quiz"], []).append(
                    {"prompt": norm(prompt.decode_contents()) if prompt else "", "ok": ok, "chosen": chosen})
    out = {}
    for qid, entries in keys.items():
        qz = quizzes[qid]
        for pi, part in enumerate(qz["parts"]):
            for q in part["questions"]:
                if q["type"] != "single":
                    continue
                p = norm(q["prompt"])
                opts = [norm(o) for o in q["options"]]
                wrong = set()
                for e in entries:
                    if e["prompt"] != p:
                        continue
                    for c in e["chosen"]:
                        if c in opts:
                            if e["ok"]:
                                out[f"{qid}/{pi}/{q['n']}"] = {"answer": opts.index(c), "verified": True}
                            else:
                                wrong.add(opts.index(c))
                if f"{qid}/{pi}/{q['n']}" not in out and wrong:
                    out[f"{qid}/{pi}/{q['n']}"] = {"wrong": sorted(wrong)}
    (ROOT / "verified_keys.json").write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    print(len(out), "keys;", sum(1 for v in out.values() if v.get("verified")), "verified")


if __name__ == "__main__":
    main()
