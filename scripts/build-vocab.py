"""kanji -> the words that use it, each with an example sentence.

Vocabulary: open-anki-jlpt-decks (MIT) -- JLPT N5..N1 word lists.
Sentences:  the Tanaka Corpus as republished by the Tatoeba Project
            (CC BY 2.0 FR), via mwhirls/tatoeba-json, which carries a
            word-level index so a sentence can be matched to a headword
            rather than to a substring.
"""
import csv, json, re, unicodedata
from collections import defaultdict

KANJI = re.compile(r'[一-鿿㐀-䶿]')

# ── vocabulary ────────────────────────────────────────────────────────────
words = {}
for lvl in (5, 4, 3, 2, 1):
    with open(f'vocab_n{lvl}.csv', encoding='utf-8') as fh:
        for row in csv.DictReader(fh):
            expr = (row.get('expression') or '').strip()
            # entries carry editorial marks: 〜, (…), ～
            expr = re.sub(r'[〜～]', '', expr)
            expr = re.sub(r'\s*\([^)]*\)\s*', '', expr).strip()
            if not expr or not KANJI.search(expr): continue
            meaning = (row.get('meaning') or '').strip().strip(',').strip()
            reading = re.sub(r'[〜～]|\s*\([^)]*\)\s*', '', (row.get('reading') or '')).strip()
            if expr in words: continue
            words[expr] = {'w': expr, 'r': reading, 'm': meaning, 'l': f'N{lvl}'}
print('vocab entries with kanji:', len(words))

# ── sentences, indexed by the headwords Tatoeba tags them with ────────────
by_head = defaultdict(list)
data = json.load(open('tato/jpn-eng-examples.json'))
for s in data:
    jp, en = s.get('text') or '', s.get('translation') or ''
    if not jp or not en: continue
    if not (8 <= len(jp) <= 46): continue          # long enough to be useful, short enough to read
    for w in s.get('words') or []:
        hw = w.get('headword')
        if hw and KANJI.search(hw):
            by_head[hw].append((jp, en))
print('headwords with a usable sentence:', len(by_head))

def pick(entry):
    """Shortest sentence tagged with this word, preferring one that shows the
       written form rather than a kana spelling of it."""
    cands = by_head.get(entry['w']) or []
    if not cands: return None
    exact = [c for c in cands if entry['w'] in c[0]]
    best = min(exact or cands, key=lambda c: len(c[0]))
    return {'jp': best[0], 'en': best[1]}

for entry in words.values():
    s = pick(entry)
    if s: entry['s'] = s
print('words with a sentence:', sum(1 for w in words.values() if w.get('s')))

# ── index by kanji ────────────────────────────────────────────────────────
LEVEL = {'N5': 0, 'N4': 1, 'N3': 2, 'N2': 3, 'N1': 4}
index = defaultdict(list)
for entry in words.values():
    for ch in set(KANJI.findall(entry['w'])):
        index[ch].append(entry)

out = {}
for ch, entries in index.items():
    entries.sort(key=lambda e: (not e.get('s'), LEVEL[e['l']], len(e['w'])))
    out[ch] = entries[:8]
print('kanji covered:', len(out))
json.dump(out, open('out_vocab.json', 'w'), ensure_ascii=False, separators=(',', ':'))
import os; print('bytes', os.path.getsize('out_vocab.json'))
for t in ['岩', '森', '朝', '漢', '時']:
    print('\n', t, json.dumps(out.get(t, [])[:3], ensure_ascii=False))
