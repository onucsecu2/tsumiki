"""Decide the canonical composition of every kanji, once, at build time.

Sources, in priority order:
  1. WaniKani's radical list, when its strokes add up exactly. Pedagogically the
     best split (漢 = 氵 + 𦰩, 時 = 日 + 寺) and it matches what the user studies.
  2. CJKVI-IDS top-level operands, when each is a real character. IDS is a
     complete decomposition by construction, so it needs no stroke check --
     this is what removes the "unnamed strokes" placeholders (石 = 丆 + 口,
     朝 = 𠦝 + 月, 森 = 木 + 林).
  3. IDS again, with codepoint-less composite operands expanded one level.
  4. KanjiVG, when its strokes add up.
  5. WaniKani's list as-is, with repeats inferred from stroke arithmetic
     (林 = 木 x2) and any remainder shown as one ghost input.
A character both sources leave alone is a leaf -- you learn it whole.
"""
import json
from ids_parse import IDC, load, operands, flatten

d = json.load(open('out_kanji.json'))
K, C = d['kanji'], d['components']
g = json.load(open('wk_graph.json'))
k2r = g['kanjiToRadicals']
RAW = load()

def sn(ch):
    return (C.get(ch) or {}).get('n') or (K.get(ch) or {}).get('s') or 0

def exact(parts, total):
    ns = [sn(p) for p in parts]
    return bool(parts) and all(ns) and sum(ns) == total

stats = {k: 0 for k in ('wk', 'ids', 'ids_flat', 'kvg', 'repeat', 'ghost', 'leaf')}

for ch, k in K.items():
    for key in ('parts', 'atom', 'gap', 'src'):
        k.pop(key, None)
    wk = [p for p in (k2r.get(ch) or []) if p != ch]
    expr = RAW.get(ch)
    ids_top = operands(expr) if expr else None
    # cjkvi lists undecomposable characters as themselves ("母\t母"), so an
    # expression with no IDC operator means "this is a base shape".
    ids_atomic = not expr or expr[0] not in IDC
    ids_ok = ids_top and all(len(o) == 1 for o in ids_top)
    ids_flat = flatten(expr, RAW) if expr else None
    kvg = [p['e'] for p in k['d'] if p['e'] != ch]

    # WaniKani wins when its split is verifiable, or when its strokes can't be
    # checked (𦰩 has no KanjiVG entry) but it agrees with IDS on how many
    # pieces there are -- that keeps 漢 = 氵 + 𦰩 instead of 氵+廿+口+夫.
    wk_unverifiable = bool(wk) and not all(sn(p) for p in wk)
    wk_agrees = wk_unverifiable and ids_top is not None and len(ids_top) == len(wk)
    chosen, src = None, None
    if exact(wk, k['s']) or wk_agrees:
        chosen, src = wk, 'wk'
    elif ids_ok:
        chosen, src = [o for o in ids_top if o != ch], 'ids'
    elif ids_flat and all(o != ch for o in ids_flat):
        chosen, src = ids_flat, 'ids_flat'
    elif exact(kvg, k['s']):
        chosen, src = kvg, 'kvg'
    elif ids_atomic and not exact(kvg, k['s']):
        # IDS is a complete decomposition; if it lists none, this is a base
        # shape (母, 州, 乗) and any leftover from another source is noise.
        chosen, src = None, None
    elif wk:
        chosen, src = list(wk), 'wk'
    elif kvg:
        chosen, src = kvg, 'kvg'

    if not chosen:
        k['parts'] = []
        k['atom'] = True
        stats['leaf'] += 1
        continue

    if src == 'wk':
        ns = [sn(p) for p in chosen]
        if all(ns) and len(set(chosen)) == 1 and k['s'] % ns[0] == 0 and k['s'] // ns[0] > len(chosen):
            chosen = chosen[:1] * (k['s'] // ns[0])
            stats['repeat'] += 1

    k['parts'] = chosen
    k['src'] = src
    stats[src] += 1
    # A ghost input is a last resort. IDS decompositions are complete by
    # construction, so they never get one; elsewhere a shortfall of a single
    # stroke is a counting convention (芽 = 艹 3 + 牙 4 vs an official 8), not a
    # missing piece, so only a gap of 2+ is worth drawing.
    ns = [sn(p) for p in chosen]
    if src not in ('ids', 'ids_flat') and all(ns) and k['s'] - sum(ns) >= 2:
        k['gap'] = k['s'] - sum(ns)
        stats['ghost'] += 1

print(stats)
json.dump(d, open('out_kanji.json', 'w'), ensure_ascii=False, separators=(',', ':'))
for t in ['岩','石','漢','林','森','回','朝','時','旭','議','母','州','協','街','楽','日','山']:
    k = K[t]
    print(t, k.get('src'), k.get('parts'), 'atom' if k.get('atom') else '', 'gap=%s' % k.get('gap') if k.get('gap') else '')
