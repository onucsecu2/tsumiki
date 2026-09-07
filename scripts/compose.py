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
CANON = d.get('canon') or {}
JUNK = set('①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳')

def named(ch):
    """Must match partName() in the UI, or a part passes here and then renders
       with an empty label — which is what 'unnamed radical' looked like."""
    c = C.get(ch) or {}
    return bool(c.get('wk') or (K.get(ch) or {}).get('m') or c.get('m') or c.get('en'))

def normalise(parts):
    return [CANON.get(p, p) for p in parts]

def covers(parts, total):
    """Reject a decomposition whose strokes demonstrably don't add up.

       KanjiVG tags 鳥 with only 灬 (4 of 11 strokes) and 石 with only 口 (3 of
       5); presenting either as the character's parts is a lie of omission. A
       one-stroke discrepancy is a counting convention (芽 = 艹 3 + 牙 4 against
       an official 8), so that much slack is allowed. Parts with no stroke data
       can't be checked and get the benefit of the doubt — that is what keeps
       漢 = 氵 + 𦰩, where 𦰩 has no KanjiVG entry."""
    ns = [sn(p) for p in parts]
    if not all(ns): return True
    return abs(sum(ns) - total) <= 1

def usable(parts):
    """A decomposition is only worth drawing if every piece is a real character
       we can name. cjkvi marks unencoded shapes with circled digits and IDS
       fragments; a node labelled with neither a name nor a glyph teaches
       nothing, so such a decomposition is rejected in favour of the next
       candidate rather than shown."""
    if not parts: return False
    for p in parts:
        if len(p) != 1 or p in JUNK or any(c in IDC for c in p): return False
        if not named(p): return False
    return True

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
    # Candidates in order of preference; the first one every part of which we
    # can name and draw wins. Falling through to the next beats showing a node
    # labelled with nothing.
    candidates = []
    if exact(wk, k['s']) or wk_agrees:
        candidates.append((wk, 'wk'))
    if ids_ok:
        candidates.append(([o for o in ids_top if o != ch], 'ids'))
    if ids_flat and all(o != ch for o in ids_flat):
        candidates.append((ids_flat, 'ids_flat'))
    if exact(kvg, k['s']):
        candidates.append((kvg, 'kvg'))
    if not ids_atomic:
        if wk: candidates.append((list(wk), 'wk'))
        if kvg: candidates.append((kvg, 'kvg'))

    # Prefer the *coarsest* valid split. WaniKani lists every radical it
    # teaches, which for 国 is 口 + 王 + 丶 — strokes that add up, but not a
    # top-level structure. IDS says ⿴囗玉, two parts, which is what "one piece
    # added at a time" means. The finer detail is still reachable by recursing
    # into 玉. Source order only breaks ties.
    ranked = []
    for i, (parts, tag) in enumerate(candidates):
        parts = normalise(parts)
        if usable(parts) and covers(parts, k['s']):
            ranked.append((len(set(parts)), i, parts, tag))
    ranked.sort()  # fewest distinct parts, then source preference
    chosen, src = (ranked[0][2], ranked[0][3]) if ranked else (None, None)

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
    # No ghost inputs. Every decomposition that survives here has parts we can
    # name and draw; a stroke shortfall against them is a counting convention
    # (芽 = 艹 3 + 牙 4 against an official 8), and a node reading "unnamed
    # strokes" teaches nothing. The field stays supported downstream in case a
    # future source needs it.

print(stats)
json.dump(d, open('out_kanji.json', 'w'), ensure_ascii=False, separators=(',', ':'))
for t in ['岩','石','漢','林','森','回','朝','時','旭','議','母','州','協','街','楽','日','山']:
    k = K[t]
    print(t, k.get('src'), k.get('parts'), 'atom' if k.get('atom') else '', 'gap=%s' % k.get('gap') if k.get('gap') else '')
