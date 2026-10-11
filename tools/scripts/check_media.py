import json, re, os
d = json.load(open('quizzes.json', encoding='utf-8'))
refs = set()
def walk(x):
    if isinstance(x, dict):
        for v in x.values(): walk(v)
    elif isinstance(x, list):
        for v in x: walk(v)
    elif isinstance(x, str):
        refs.update(re.findall(r'media/q/([A-Za-z0-9_.\-]+)', x))
walk(d)
missing = [r for r in refs if not os.path.exists('qmedia/' + r)]
unused = [f for f in os.listdir('qmedia') if f not in refs]
print('refs', len(refs), 'missing', missing, 'unused', len(unused), unused[:5])
