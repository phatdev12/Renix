"""Download the remote quiz media listed in qmedia_remote*.txt into qmedia/ (names as parse_quizzes expects)."""
import sys
import time
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parent))
from parse_quizzes import remote_name  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
MEDIA = ROOT / "qmedia"
MEDIA.mkdir(exist_ok=True)
lst = ROOT / (sys.argv[1] if len(sys.argv) > 1 else "qmedia_remote.txt")
n = 0
for url in lst.read_text(encoding="utf-8").split():
    p = MEDIA / remote_name(url)
    if p.exists():
        continue
    try:
        r = requests.get(url, timeout=60)
        if r.status_code == 200:
            p.write_bytes(r.content)
            n += 1
        else:
            print("fail", r.status_code, url)
    except Exception as e:  # noqa: BLE001
        print("fail", e, url)
    time.sleep(0.15)
print("downloaded", n)
