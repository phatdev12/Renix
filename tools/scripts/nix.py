"""Tiny helper to log in to digital.nix.edu.vn and fetch pages.

Credentials are read from env vars NIX_EMAIL / NIX_PASS (never stored on disk).
Session cookies are cached in ../session/cookies.json.
"""
import json
import os
import re
import sys
import time
from pathlib import Path

import requests

BASE = "https://digital.nix.edu.vn"
HERE = Path(__file__).resolve().parent
SESSION_DIR = HERE.parent / "session"
COOKIE_FILE = SESSION_DIR / "cookies.json"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/128.0 Safari/537.36")


def _save(s):
    SESSION_DIR.mkdir(parents=True, exist_ok=True)
    COOKIE_FILE.write_text(json.dumps(requests.utils.dict_from_cookiejar(s.cookies)))


def _load(s):
    if COOKIE_FILE.exists():
        s.cookies.update(json.loads(COOKIE_FILE.read_text()))


def csrf(html):
    m = re.search(r'name="csrf-token" content="([^"]+)"', html)
    return m.group(1) if m else None


def login(s):
    email, pw = os.environ.get("NIX_EMAIL"), os.environ.get("NIX_PASS")
    if not email or not pw:
        sys.exit("Need NIX_EMAIL / NIX_PASS env vars to log in")
    r = s.get(BASE + "/login")
    token = csrf(r.text)
    r = s.post(BASE + "/login", data={"_token": token, "email": email,
                                      "password": pw, "remember": "on"},
               allow_redirects=True)
    if "/login" in r.url and 'name="password"' in r.text:
        sys.exit("Login failed (still on login page)")
    _save(s)
    return r


def session():
    s = requests.Session()
    s.headers["User-Agent"] = UA
    _load(s)
    r = s.get(BASE + "/dashboard", allow_redirects=True)
    if 'name="password"' in r.text:
        login(s)
    return s


def fetch(s, path, out=None):
    url = path if path.startswith("http") else BASE + "/" + path.lstrip("/")
    r = s.get(url, allow_redirects=True)
    if 'name="password"' in r.text and "/login" in r.url:
        login(s)
        r = s.get(url, allow_redirects=True)
    _save(s)
    if out:
        Path(out).parent.mkdir(parents=True, exist_ok=True)
        Path(out).write_bytes(r.content)
    return r


COURSE = os.environ.get("NIX_COURSE", "learning/m3-n4-tieng-nhat-co-so-2")
_token = None


def token(s):
    global _token
    if _token is None:
        _token = csrf(fetch(s, COURSE).text)
    return _token


def post_activity(s, url, out=None):
    """Load an activity the same way the site's JS does (POST, JSON reply)."""
    url = url if url.startswith("http") else BASE + "/" + url.lstrip("/")
    r = s.post(url, headers={"X-CSRF-TOKEN": token(s),
                             "X-Requested-With": "XMLHttpRequest",
                             "Accept": "application/json, text/javascript, */*; q=0.01",
                             "Referer": BASE + "/" + COURSE})
    _save(s)
    if out:
        Path(out).parent.mkdir(parents=True, exist_ok=True)
        Path(out).write_bytes(r.content)
    return r


def get_json(s, url, params=None, out=None):
    url = url if url.startswith("http") else BASE + "/" + url.lstrip("/")
    r = s.get(url, params=params, headers={"X-CSRF-TOKEN": token(s),
                                           "X-Requested-With": "XMLHttpRequest",
                                           "Accept": "application/json, text/javascript, */*; q=0.01",
                                           "Referer": BASE + "/" + COURSE})
    if out:
        Path(out).parent.mkdir(parents=True, exist_ok=True)
        Path(out).write_bytes(r.content)
    return r


def show_tab(s, activity_id, tab="introduce", class_id=19, out=None):
    return get_json(s, f"api/{COURSE}/show-tab",
                    {"tab": tab, "id": activity_id, "class_id": class_id}, out)


if __name__ == "__main__":
    cmd = sys.argv[1]
    s = session()
    if cmd == "tab":
        r = show_tab(s, sys.argv[2], out=sys.argv[3] if len(sys.argv) > 3 else None)
        print(r.status_code, r.headers.get("content-type"), len(r.content))
    if cmd == "fetch":
        r = fetch(s, sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else None)
        print(r.status_code, r.url, len(r.content))
    elif cmd == "post":
        r = post_activity(s, sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else None)
        print(r.status_code, r.headers.get("content-type"), len(r.content))
    elif cmd == "whoami":
        r = fetch(s, "/dashboard")
        print(r.status_code, r.url)
        m = re.search(r"<title>(.*?)</title>", r.text, re.S)
        print(m.group(1).strip() if m else "")
