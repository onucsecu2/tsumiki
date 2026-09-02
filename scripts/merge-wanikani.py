"""Layer WaniKani's decomposition + radical names on top of the KanjiVG build."""
import json, sys
from wknames_extra import EXTRA

IDS = set('⿰⿱⿲⿳⿴⿵⿶⿷⿸⿹⿺⿻')
d = json.load(open('out_kanji.json'))
K, C = d['kanji'], d['components']
g = json.load(open('wk_graph.json'))
k2r, r2k = g['kanjiToRadicals'], g['radicalToKanjis']
wkdump = json.load(open('wk_radicals.json'))
wkname = {x['character']: x['meaning'].title() for x in wkdump if x.get('character')}
wklevel = {x['character']: x['level'] for x in wkdump if x.get('character')}
wkname.update(EXTRA)

def is_ids(ch): return any(c in IDS for c in ch) or len(ch) > 1

# 1. WaniKani decomposition, where WK knows the kanji.
used = 0
for ch, k in K.items():
    parts = k2r.get(ch)
    if not parts: continue
    parts = [p for p in parts if p != ch]
    if not parts: continue
    k['wk'] = parts
    used += 1

# 2. Names + levels for every component we reference, WK forms included.
referenced = set()
for k in K.values():
    referenced.update(k.get('wk') or [])
    referenced.update(p['e'] for p in k['d'])
    referenced.update(k['comp'])
for ch in sorted(referenced):
    info = C.setdefault(ch, {'c': ch, 'n': 0})
    if ch in wkname: info['wk'] = wkname[ch]
    if ch in wklevel: info['wkl'] = wklevel[ch]
    if is_ids(ch): info['ids'] = True
    if ch in r2k: info['wkr'] = True   # WaniKani treats this as a radical

named = sum(1 for c in C.values() if c.get('wk') or c.get('jp') or c.get('m'))
print(f'WK decomposition on {used}/{len(K)} kanji; components {len(C)}, named {named}')
json.dump(d, open('out_kanji.json', 'w'), ensure_ascii=False, separators=(',', ':'))
for t in ['岩','石','漢','時','旭','親']:
    k = K.get(t)
    print(t, 'wk=', k.get('wk'), 'kvg=', [p['e'] for p in k['d']])
for t in ['丆','氵','𦰩','石','山']:
    print(t, json.dumps(C.get(t), ensure_ascii=False))
