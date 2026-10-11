import json, re, sys
b = json.load(open('D:/Nix/src/data/bank.json', encoding='utf-8'))
ids = sys.argv[1].split(',')
def t(h):
    h = re.sub(r'<hr[^>]*>', ' | ', h or '')
    h = re.sub(r'<img[^>]*>', '[IMG]', h)
    h = re.sub(r'<[^>]+>', ' ', h)
    return re.sub(r'\s+', ' ', h).replace('正しい答えを選びましょう。(Hãy chọn đáp án đúng.)', '').strip()
for qz in b:
    if qz['id'] not in ids: continue
    print('=====', qz['id'], qz['name'])
    for pi, p in enumerate(qz['parts']):
        for q in p['questions']:
            a = q.get('ans')
            if q['type'] == 'single':
                opts = [t(o) for o in q['options']]
                print(f"{q['key']} {t(q['prompt'])[:90]}\n    ✔ {opts[a] if a is not None else None}   ✗ {' / '.join(o for i,o in enumerate(opts) if i!=a)[:110]}\n    » {q.get('explain','')[:150]} [{q.get('confidence')}]")
            else:
                print(f"{q['key']} [{q['type']}] {t(q['prompt'])[:120]}\n    ✔ {a if q['type']!='order' and q['type']!='dragtext' else [q['chips'][i] for i in a] if a else a} {q.get('sentence','')}\n    » {q.get('explain','')[:150]} [{q.get('confidence')}]")
