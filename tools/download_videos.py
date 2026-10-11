"""Tải (tuỳ chọn) toàn bộ video bài giảng Unit 13–17 về máy để xem offline.

    python tools/download_videos.py            # tải tất cả (~1,3 GB)
    python tools/download_videos.py 13 15      # chỉ tải Unit 13 và 15

Video được lưu vào public/media/video/, và file src/data/local-media.json được cập nhật để
website tự động phát bản trên máy thay vì phát trực tuyến (chạy lại "npm run build" sau khi tải).
Cần: Python 3 + thư viện requests (pip install requests).
"""
import json
import sys
from pathlib import Path

import requests

SITE = Path(__file__).resolve().parent.parent
OUT = SITE / "public" / "media" / "video"
MAP_JSON = SITE / "src" / "data" / "local-media.json"


def load_units():
    return json.loads((SITE / "src" / "data" / "units.json").read_text(encoding="utf-8"))["units"]


def collect(units, only):
    vids = []
    for u in units:
        if only and u["id"] not in only:
            continue
        names = {"text": "bài khóa", "vocab": "từ vựng", "kanji": "kanji"}
        for k, url in u["videos"].items():
            vids.append((u["id"], f"Unit {u['id']} – video {names.get(k, k)}", url))
        for g in u["grammar"]:
            if g.get("video"):
                vids.append((u["id"], f"Unit {u['id']} – ngữ pháp {g['no']}", g["video"]))
    seen, out = set(), []
    for v in vids:
        if v[2] not in seen:
            seen.add(v[2])
            out.append(v)
    return out


def load_map():
    if not MAP_JSON.exists():
        return {}
    return json.loads(MAP_JSON.read_text(encoding="utf-8") or "{}")


def save_map(m):
    # online video URL -> local file (served from public/)
    MAP_JSON.write_text(json.dumps(m, ensure_ascii=False, indent=1), encoding="utf-8")


def main():
    only = {int(a) for a in sys.argv[1:] if a.isdigit()}
    vids = collect(load_units(), only)
    OUT.mkdir(parents=True, exist_ok=True)
    m = load_map()
    total = 0
    for i, (u, label, url) in enumerate(vids, 1):
        name = url.rsplit("/", 1)[1]
        dest = OUT / name
        rel = "/media/video/" + name
        if dest.exists() and dest.stat().st_size > 0:
            print(f"[{i}/{len(vids)}] đã có: {label}")
            m[url] = rel
            continue
        print(f"[{i}/{len(vids)}] đang tải: {label} …", end="", flush=True)
        try:
            with requests.get(url, stream=True, timeout=60) as r:
                r.raise_for_status()
                tmp = dest.with_suffix(".part")
                with open(tmp, "wb") as f:
                    for chunk in r.iter_content(1 << 20):
                        f.write(chunk)
                tmp.replace(dest)
            size = dest.stat().st_size
            total += size
            m[url] = rel
            print(f" xong ({size / 1e6:.1f} MB)")
        except Exception as e:  # keep going with the rest
            print(" lỗi:", e)
        save_map(m)
    save_map(m)
    print(f"Hoàn tất. Đã tải thêm {total / 1e9:.2f} GB. Chạy lại \"npm run build\" rồi mở website để dùng video trên máy.")


if __name__ == "__main__":
    main()
