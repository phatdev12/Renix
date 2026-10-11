"""Align known master-text sentences (or vocab words) to a Whisper transcript.

usage: align_asr.py UNIT t|v
  t: master text video  -> vwork/t{U}/align.json  (one entry per sentence of src/data/units.json)
  v: vocabulary video   -> vwork/v{U}/align.json  (one entry per vocab word)

Both sides are reduced to hiragana with pykakasi (so kanji/kana choices and the
converter's own quirks cancel out), aligned character-by-character with an
edit-distance DP, and each item's span is taken from the timestamps of the ASR
characters it matched.  Cut points are then snapped to the energy envelope.
"""
import json, re, subprocess, sys, wave, pathlib, os
import numpy as np
import pykakasi
SITE_ROOT = os.environ.get('NIX_SITE') or pathlib.Path(__file__).resolve().parents[3].as_posix()

UNIT = int(sys.argv[1]); KIND = sys.argv[2]
W = pathlib.Path(f'vwork/{KIND}{UNIT}')
ASR = sys.argv[3] if len(sys.argv) > 3 else 'asr.json'
OUT = sys.argv[4] if len(sys.argv) > 4 else 'align.json'
RE = re.compile(r'\{([^|{}]+)\|([^{}]+)\}')
KKS = pykakasi.kakasi()
PUNCT = re.compile(r'[\s、。，．,.!！?？「」『』（）()…・〜～~ー\-―－:：;；"\'“”]')


def hira(text):
    s = ''.join(x['hira'] for x in KKS.convert(text))
    s = re.sub(r'[ァ-ヶ]', lambda m: chr(ord(m.group()) - 0x60), s)
    s = s.translate(str.maketrans('０１２３４５６７８９ぁぃぅぇぉっゃゅょゎ', '0123456789あいうえおつやゆよわ'))
    return PUNCT.sub('', s)


def roma(text):
    s = ''.join(x['hepburn'] for x in KKS.convert(text)).lower()
    s = s.translate(str.maketrans('ＡＢＣＤＥＦＧＨＩＪＫＬＭＮＯＰＱＲＳＴＵＶＷＸＹＺａｂｃｄｅｆｇｈｉｊｋｌｍｎｏｐｑｒｓｔｕｖｗｘｙｚ', 'abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz'))
    s = re.sub(r'[^a-z0-9]', '', s)
    # loanword spelling noise: doubled consonants and epenthetic u (poppu ~ pop)
    s = re.sub(r'([bcdfghjklmnpqrstvwxyz])', r'', s)
    return re.sub(r'([bcdfghjkmpqstvz])u(?=[bcdfghjkmpqstvz]|$)', r'', s)


def load_units():
    return json.load(open(SITE_ROOT + '/src/data/units.json', encoding='utf-8'))


def items_for(unit):
    out = []
    if KIND == 't':
        k = 0
        for sec in unit['sections']:
            for p in sec['paragraphs']:
                for s in p:
                    out.append({'k': k, 'jp': RE.sub(r'\1', s['jp']), 'spk': sec['speaker']}); k += 1
    else:
        for v in unit['vocab']:
            strip = lambda x: re.sub(r'(?<![A-Za-zＡ-Ｚａ-ｚ])[NＮ](?![A-Za-zＡ-Ｚａ-ｚ])', '', re.sub(r'[～〜]', '', x))
            word = strip(v['kana'])
            kj = strip(v.get('kanji') or '')
            out.append({'id': v['id'], 'jp': word, 'kanji': kj, 'hk': hira(kj) if kj else '', 'r': roma(word)})
    for it in out:
        it['h'] = hira(it['jp'])
    return out


def asr_chars():
    """hiragana stream of the transcript with a (start, end) time per character.
    Readings are computed on whole segments (context-dependent kanji readings), then
    each token's kana are spread over the time span of the original characters."""
    segs = json.load(open(W / ASR, encoding='utf-8'))
    chars, times = [], []
    for sg in segs:
        oc, ot = [], []
        for w in sg['words']:
            ww = w['w']; n = max(1, len(ww))
            for i, c in enumerate(ww):
                oc.append(c); ot.append((w['s'] + (w['e'] - w['s']) * i / n, w['s'] + (w['e'] - w['s']) * (i + 1) / n))
        text = ''.join(oc)
        if not text: continue
        pos = 0
        for tok in KKS.convert(text):
            orig = tok['orig']
            k = text.find(orig, pos)
            if k < 0: k = min(pos, len(text) - 1)
            span = ot[k:k + max(1, len(orig))] or [ot[-1]]
            pos = k + len(orig)
            h = hira(tok['hira'])
            if not h: continue
            t0, t1 = span[0][0], span[-1][1]
            for i, c in enumerate(h):
                chars.append(c)
                times.append((t0 + (t1 - t0) * i / len(h), t0 + (t1 - t0) * (i + 1) / len(h)))
    return ''.join(chars), times


def align(a, b):
    """global alignment of a (ours) to b (asr); returns list map a_index -> b_index or -1.
    b-side gaps are free at both ends (semi-global)"""
    n, m = len(a), len(b)
    INF = 10 ** 9
    D = np.zeros((n + 1, m + 1), dtype=np.int32)
    D[1:, 0] = np.arange(1, n + 1) * 2
    D[0, :] = 0  # free leading asr
    P = np.zeros((n + 1, m + 1), dtype=np.int8)  # 1 diag, 2 up (a gap), 3 left (b gap)
    for i in range(1, n + 1):
        ai = a[i - 1]
        row, prev = D[i], D[i - 1]
        for j in range(1, m + 1):
            d = prev[j - 1] + (0 if ai == b[j - 1] else 2)
            u = prev[j] + 2
            l = row[j - 1] + 1
            if d <= u and d <= l: row[j] = d; P[i, j] = 1
            elif u <= l: row[j] = u; P[i, j] = 2
            else: row[j] = l; P[i, j] = 3
    j = int(np.argmin(D[n]))  # free trailing asr
    i = n
    mp = [-1] * n
    while i > 0 and j > 0:
        p = P[i, j]
        if p == 1:
            if a[i - 1] == b[j - 1]: mp[i - 1] = j - 1
            i -= 1; j -= 1
        elif p == 2: i -= 1
        else: j -= 1
    return mp


def envelope():
    w = wave.open(str(W / 'a16.wav')); sr = w.getframerate()
    x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
    hop = int(sr * 0.01); n = len(x) // hop
    db = 20 * np.log10(np.sqrt((x[:n * hop].reshape(n, hop) ** 2).mean(1) + 1e-12))
    return np.convolve(db, np.ones(3) / 3, mode='same')


def soften(db, soft, st, en, lo, hi, floor=None):
    """extend [st, en] over soft onsets/offsets (vowel starts, devoiced endings) that are
    below the speech threshold but above the noise floor, without crossing lo/hi.
    A dip (stop / geminate closure, <= 270 ms) is crossed when a SHORT burst of sound
    (<= 300 ms, e.g. the final ト of ロボット or the initial い of いくじ) lies beyond it
    and the dip does not fall clearly below the background level (an edited-in silence
    marks a boundary between separate sounds)."""
    fl = floor if floor is not None else soft - 6
    def walk(j, step, limit):
        inside = lambda x: (step < 0 and x > limit) or (step > 0 and x < limit)
        while True:
            nj = j + step
            if not inside(nj): return j
            if db[nj] > soft: j = nj; continue
            # dip: find the next frame above soft within 220 ms
            dip_min, k, hit = db[nj], nj, None
            for t in range(27):
                k = nj + step * t
                if not inside(k): break
                if db[k] > soft + 1: hit = k; break
                dip_min = min(dip_min, db[k])
            if hit is None or dip_min < fl - 7: return j
            # the sound beyond the dip must be a short burst (fades back within 300 ms)
            m = hit; dur = 0
            while inside(m + step) and db[m + step] > soft and dur < 31: m += step; dur += 1
            if dur >= 30: return j
            j = m
    j0 = int(round(st * 100)); k0 = int(round(en * 100))
    j = walk(j0, -1, max(int(lo * 100), j0 - 35))
    k = walk(k0, +1, min(int(hi * 100), k0 + 45, len(db) - 1))
    return j / 100, k / 100


def levels(db):
    """noise floor / speech peak, ignoring digitally silent frames (scene cuts)"""
    live = db[db > -100]
    return np.percentile(live, 20), np.percentile(live, 95)


def pad_quiet(db, quiet, t, step, maxpad, bound):
    """move from t (s) in direction step over frames quieter than `quiet`, at most maxpad
    seconds and never past bound: padding then covers only silence/background, so a
    sound effect or the next word right after a short pause is never included"""
    i = int(round(t * 100))
    lim = int(round((t + step * maxpad) * 100))
    lim = max(lim, int(round(bound * 100))) if step < 0 else min(lim, int(round(bound * 100)), len(db) - 1)
    stopped = False
    while (step < 0 and i > lim) or (step > 0 and i < lim):
        if db[i + step] >= quiet: stopped = True; break
        i += step
    t_out = i / 100
    if stopped:  # keep 40 ms clear of the sound that follows (or precedes)
        t_out = t + step * max(0.0, abs(t_out - t) - 0.04)
    return t_out


def speech_regions(db, thr):
    on = db > thr
    R, j, n = [], 0, len(on)
    while j < n:
        if on[j]:
            k = j
            while k < n and on[k]: k += 1
            if R and j * 0.01 - R[-1][1] < 0.12: R[-1][1] = k * 0.01
            else: R.append([j * 0.01, k * 0.01])
            j = k
        else: j += 1
    return [r for r in R if r[1] - r[0] >= 0.05]


def main_vocab(unit, items):
    """Vocab videos say each word on its own, then an example sentence. Group speech into
    utterances (pauses >= 0.35 s), give each utterance the transcript characters whose time
    falls inside it, and pick for every word the utterance whose text is closest to it."""
    import difflib
    segs = json.load(open(W / ASR, encoding='utf-8'))
    # phrases: transcript words split at spaces, sentence ends and time gaps
    P = []
    for sg in segs:
        cur = None
        for w in sg['words']:
            brk = cur is None or w['w'][:1] in (' ', '　') or cur['t'][-1:] in ('。', '、', '？', '！') or w['s'] - cur['e'] > 0.25
            if brk:
                if cur: P.append(cur)
                cur = {'t': w['w'].strip(), 's': w['s'], 'e': w['e']}
            else:
                cur['t'] += w['w']; cur['e'] = w['e']
        if cur: P.append(cur)
    for p in P: p['h'] = hira(p['t']); p['r'] = roma(p['t'])
    db = envelope()
    floor, peak = levels(db)
    R = speech_regions(db, floor + 0.35 * (peak - floor))
    soft = max(floor + 0.35 * (peak - floor) - 6, floor + 3)
    onsets = [r[0] for r in R]; offsets = [r[1] for r in R]
    used = set()
    res = []
    for it in items:
        o = {k: it[k] for k in it if k not in ('h', 'hk', 'r')}
        best = (0, 0, None)
        cands = [(q,) for q in range(len(P))] + [(q, q + 1) for q in range(len(P) - 1)
                 if len(P[q]['h']) <= 3 and len(P[q + 1]['h']) <= 3 and P[q + 1]['s'] - P[q]['e'] < 1.6]
        for qs in cands:
            if any(q in used for q in qs): continue
            ph = ''.join(P[q]['h'] for q in qs); pr = ''.join(P[q]['r'] for q in qs)
            if not ph: continue
            # the phrase must be the word itself (citation form), not a longer sentence
            if len(ph) > 1.5 * len(it['h']) + 1: continue
            r = difflib.SequenceMatcher(None, it['h'], ph).ratio()
            if it.get('hk'): r = max(r, difflib.SequenceMatcher(None, it['hk'], ph).ratio())
            if it.get('r') and pr: r = max(r, 0.97 * difflib.SequenceMatcher(None, it['r'], pr).ratio())
            key = (round(r, 3), -abs(len(ph) - len(it['h'])) - 0.5 * (len(qs) - 1))
            if key > best[:2]: best = (key[0], key[1], qs)
        r, _, qs = best
        o['score'] = round(r, 2)
        if qs is None or r < (0.84 if len(it['h']) >= 3 else 0.99):
            o['start'] = o['end'] = None; res.append(o); continue
        used.update(qs)
        q = qs[-1]
        p = {'t': ''.join(P[x]['t'] for x in qs), 's': P[qs[0]]['s'], 'e': P[qs[-1]]['e']}
        o['heard'] = p['t']
        # snap to the speech envelope: the speech regions overlapping the phrase
        regs = [rg for rg in R if rg[1] > p['s'] - 0.3 and rg[0] < p['e'] + 0.1]
        if regs:
            st, en = max(regs[0][0], p['s'] - 0.45), min(regs[-1][1], p['e'] + 0.45)
        else:
            st, en = p['s'] - 0.1, p['e'] + 0.1
        # a citation-form word is short: if the span is far longer than its morae need,
        # it swallowed the tail of the previous sentence -> restart at a later onset
        expect = 0.2 * len(it['h']) + 0.45
        if en - st > 1.8 * expect:
            later = [t for t in onsets if st < t <= en - 0.12 and en - t <= 1.8 * expect]
            if not later: later = [max([t for t in onsets if t < en - 0.05] or [st])]
            st = min(later)
        prev_p = P[qs[0] - 1]['e'] if qs[0] else 0.0
        next_p = P[q + 1]['s'] if q + 1 < len(P) else len(db) * 0.01
        st, en = soften(db, soft, st, en, min(prev_p, st - 0.05) if prev_p < st else st - 0.3, max(next_p, en + 0.05) if next_p > en else en + 0.35, floor)
        o['start'], o['end'] = round(st, 2), round(en, 2)
        # generous pre/post-roll (only music around a citation word), never past mid-gap
        lo_b = (st + prev_p) / 2 if prev_p < st else st - 0.06
        hi_b = (en + next_p) / 2 if next_p > en else en + 0.08
        o['cut_s'] = round(max(lo_b, min(st - 0.04, pad_quiet(db, soft + 1, st, -1, 0.3, lo_b))), 2)
        o['cut_e'] = round(min(hi_b, max(en + 0.06, pad_quiet(db, soft + 1, en, +1, 0.32, hi_b))), 2)
        res.append(o)
    miss = [o for o in res if o['start'] is None]
    U = [[p['s'], p['e']] for p in P]; texts = [p['t'] for p in P]
    print(f'{KIND}{UNIT}: {len(res)} words, {len(miss)} unmatched, {len(P)} phrases')
    for o in res:
        if o['start'] is None: print(f"  {o['id']:>6} ----  best {o['score']:.2f} {o['jp']}")
        else: print(f"  {o['id']:>6} {o['cut_s']:7.2f}-{o['cut_e']:7.2f} ({o['cut_e'] - o['cut_s']:4.1f}s) {o['score']:.2f} {o['jp']} <- {o['heard']}")
    json.dump({'unit': UNIT, 'kind': KIND, 'items': res, 'utterances': [[round(a, 2), round(b2, 2), t] for (a, b2), t in zip(U, texts)]},
              open(W / OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)


def main():
    nix = load_units()
    unit = next(u for u in nix['units'] if u['id'] == UNIT)
    items = items_for(unit)
    if KIND == 'v':
        return main_vocab(unit, items)
    b, bt = asr_chars()
    a = ''.join(it['h'] for it in items)
    ranges, pos = [], 0
    for it in items:
        ranges.append((pos, pos + len(it['h']))); pos += len(it['h'])
    mp = align(a, b)
    db = envelope()
    floor, peak = levels(db)
    thr = floor + 0.35 * (peak - floor)
    # speech regions (10 ms frames), tiny gaps merged
    on = db > thr
    R, j, n = [], 0, len(on)
    while j < n:
        if on[j]:
            k = j
            while k < n and on[k]: k += 1
            if R and j * 0.01 - R[-1][1] < 0.12: R[-1][1] = k * 0.01
            else: R.append([j * 0.01, k * 0.01])
            j = k
        else: j += 1
    R = [r for r in R if r[1] - r[0] >= 0.05]
    res = []
    for it, (r0, r1) in zip(items, ranges):
        pos_m = [i for i in range(r0, r1) if mp[i] >= 0]
        # keep the largest run of matches that is contiguous on the ASR side: stray matches
        # into an extra sentence of the video (e.g. a shared word) must not stretch the span
        if pos_m:
            runs, cur = [], [pos_m[0]]
            for p in pos_m[1:]:
                if mp[p] - mp[cur[-1]] > 6: runs.append(cur); cur = [p]
                else: cur.append(p)
            runs.append(cur)
            pos_m = max(runs, key=len)
        cov = len(pos_m) / max(1, r1 - r0)
        o = {k: it[k] for k in it if k != 'h'}
        o['cov'] = round(cov, 2)
        if cov < 0.5 or not pos_m:
            o['start'] = o['end'] = None; res.append(o); continue
        # robust core: char start times, skipping the first matched char (its word may span the pause before it)
        ts = [bt[mp[i]][0] for i in pos_m]
        core_s = ts[1] if len(ts) > 2 else ts[0]
        core_e = ts[-1]
        o['core'] = [round(core_s, 2), round(core_e, 2)]
        o['asr_end'] = round(bt[mp[pos_m[-1]]][1], 2)
        o['asr_start'] = round(bt[mp[pos_m[0]]][0], 2)
        o['_chars'] = [bt[mp[i]] for i in pos_m]
        res.append(o)
    def region_at(t, after=True):
        for q, r in enumerate(R):
            if r[0] - 0.05 <= t <= r[1] + 0.05: return q
        if after:
            for q, r in enumerate(R):
                if r[0] > t: return q
            return len(R) - 1
        for q in range(len(R) - 1, -1, -1):
            if R[q][1] < t: return q
        return 0
    got = [o for o in res if 'core' in o]
    # 1) each speech region votes for the sentence whose recognised characters overlap it most
    owner = [None] * len(R)
    for q, r in enumerate(R):
        best, bw = None, 0.0
        for gi, o in enumerate(got):
            if o['_chars'][-1][1] < r[0] - 1 or o['_chars'][0][0] > r[1] + 1: continue
            w = sum(max(0.0, min(r[1], e) - max(r[0], s_)) for s_, e in o['_chars'])
            if w > bw: best, bw = gi, w
        if bw >= 0.04: owner[q] = best
    # 2) regions nobody voted for (Whisper timed a word late/early, soft endings): give them to
    #    the nearest owned neighbour when the pause is short; long pauses = music / effects
    for q in range(len(R)):
        if owner[q] is not None: continue
        cands = []
        for d in (-1, 1):
            t = q + d
            while 0 <= t < len(R) and owner[t] is None: t += d
            if 0 <= t < len(R):
                gap = R[q][0] - R[t][1] if d < 0 else R[t][0] - R[q][1]
                if gap <= 0.7: cands.append((gap, owner[t]))
        if cands: owner[q] = min(cands)[1]
    for gi, o in enumerate(got):
        mine = [q for q in range(len(R)) if owner[q] == gi]
        if mine:
            # largest contiguous block of this sentence's regions
            blocks, cur = [], [mine[0]]
            for q in mine[1:]:
                if any(owner[t] not in (None, gi) for t in range(cur[-1] + 1, q)): blocks.append(cur); cur = [q]
                else: cur.append(q)
            blocks.append(cur)
            blk = max(blocks, key=lambda bl: sum(R[t][1] - R[t][0] for t in bl))
            st, en = R[blk[0]][0], R[blk[-1]][1]
        else:  # fall back: regions around the recognised core
            qs = region_at(o['core'][0], True); qe = max(qs, region_at(o['core'][1], False))
            st, en = R[qs][0], R[qe][1]
        # sound effects glued to the speech: never run far past the recognised syllables
        en = min(en, max(o['asr_end'], o['core'][1]) + 0.45)
        st = max(st, min(o['asr_start'], o['core'][0]) - 0.9)
        # a soft (devoiced) ending that Whisper heard just after the loud part: keep it
        # (also a quiet tail — e.g. the audio fading out at the end of a video — as long as
        #  there is real sound there and no other sentence's speech)
        gap_db = db[int(en * 100):int(o['asr_end'] * 100) + 1]
        nxt_core = got[gi + 1]['core'][0] if gi + 1 < len(got) else 1e9
        if 0 < o['asr_end'] - en <= 0.7 and len(gap_db) and gap_db.max() > max(thr - 6, floor + 3) and o['asr_end'] < nxt_core - 0.1:
            en = o['asr_end']
        o['start'], o['end'] = round(st, 2), round(max(en, st + 0.3), 2)
    soft = max(thr - 6, floor + 3)
    for i, o in enumerate(got):
        lo = got[i - 1]['end'] if i else 0.0
        hi = got[i + 1]['start'] if i + 1 < len(got) else len(db) * 0.01
        # sound effects can follow the last syllable: never extend far past it
        hi = min(hi, max(o['asr_end'], o['core'][1]) + 0.5)
        o['start'], o['end'] = soften(db, soft, o['start'], min(o['end'], hi), lo, hi, floor)
    for i, o in enumerate(got):
        prev_end = got[i - 1]['end'] if i else 0.0
        next_start = got[i + 1]['start'] if i + 1 < len(got) else len(db) * 0.01
        lo_b = max(prev_end + 0.05, (prev_end + o['start']) / 2)
        hi_b = min(next_start - 0.05, (o['end'] + next_start) / 2 + 0.1, max(o['asr_end'], o['core'][1]) + 0.75)
        o['cut_s'] = round(max(lo_b, min(o['start'] - 0.04, pad_quiet(db, soft + 1, o['start'], -1, 0.25, lo_b))), 2)
        o['cut_e'] = round(min(hi_b, max(o['end'] + 0.06, pad_quiet(db, soft + 1, o['end'], +1, 0.3, hi_b))), 2)
    for o in res: o.pop('_chars', None)
    miss = [o for o in res if o['start'] is None]
    print(f'{KIND}{UNIT}: {len(res)} items, {len(miss)} unmatched, asr chars {len(b)}, ours {len(a)}')
    for o in res:
        lab = o.get('k', o.get('id'))
        if o['start'] is None:
            print(f"  {lab!s:>6} ---- cov {o['cov']:.2f} {o['jp']}")
        else:
            print(f"  {lab!s:>6} {o['cut_s']:7.2f}-{o['cut_e']:7.2f} ({o['cut_e'] - o['cut_s']:4.1f}s) cov {o['cov']:.2f} {o['jp'][:30]}")
    json.dump({'unit': UNIT, 'kind': KIND, 'items': res}, open(W / OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)


main()
