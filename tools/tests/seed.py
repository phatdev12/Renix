"""Seed realistic progress into localStorage of the Astro site (no globals there, so write raw records)."""
import json, time

def seed_js():
    units = json.load(open('D:/Nix/src/data/units.json', encoding='utf-8'))['units']
    ids = [v['id'] for u in units for v in u['vocab']]
    now = int(time.time() * 1000)
    day = 864e5
    iv = [0, 0.4 * day, 1 * day, 3 * day, 7 * day, 16 * day]
    srs = {}
    for i, vid in enumerate(ids[:46]):
        b = min(5, (i % 5) + 1)
        srs[vid] = {'b': b, 'ok': b, 'ng': 0, 'due': now + iv[b] - (2 * day if i % 7 == 0 else 0), 'seen': now}
    kanji = {c: {'n': 1, 'best': i % 3, 'last': now, 'lastMis': i % 3} for i, c in enumerate('半授業図音映専系計昼夜朝')}
    bank = {'1880': {'n': 1, 'best': 85, 'last': now, 'lastPct': 85}, '2026': {'n': 1, 'best': 100, 'last': now, 'lastPct': 100},
            '1921': {'n': 1, 'best': 63, 'last': now, 'lastPct': 63}}
    exam = [{'ts': now - (5 - i) * day, 'score': s, 'total': t, 'units': [13, 14, 15, 16, 17], 'secs': {}} for i, (s, t) in enumerate([[14, 30], [18, 30], [21, 30], [19, 30], [25, 30]])]
    conj = {'n': 20, 'ok': 15, 'f': {'te': {'n': 7, 'ok': 5}, 'nai': {'n': 7, 'ok': 5}, 'kanou': {'n': 6, 'ok': 5}}}
    tally = {'vocab': {'n': 20, 'ok': 16}}
    exam_date = time.strftime('%Y-%m-%d', time.localtime(time.time() + 9 * 86400))
    data = {'srs': srs, 'kanji': kanji, 'bank': bank, 'exam': exam, 'conj': conj, 'tally': tally}
    lines = ['localStorage.clear();']
    for k, v in data.items():
        lines.append(f"localStorage.setItem('nix.{k}', {json.dumps(json.dumps(v))});")
    lines.append(f"localStorage.setItem('nix.settings', JSON.stringify({{theme: THEME, examDate: '{exam_date}'}}));")
    return '(THEME) => {' + '\n'.join(lines) + '}'
