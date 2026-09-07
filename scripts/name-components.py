"""Name every shape that could appear as a part, before composition picks one.

cjkvi-ids speaks in Chinese/Taiwan codepoints (糹 U+7CF9 for 糸, 每 U+6BCF for
毎). They look identical and carry none of our names, so they are rewritten to
the form the app knows — the learner sees the Japanese shape and can click it.
What is left gets a short gloss from Unihan kDefinition.
"""
import json, re
from ids_parse import IDC, load, operands, flatten

# Radical/variant forms, mapped to the form this app already names. Only same-
# shape substitutions belong here; Unihan's kSemanticVariant is a *meaning*
# link (亼→集) and would silently mangle decompositions, so it is not used.
HAND = {
    '糹': '糸', '纟': '糸', '辶': '辵', '⻌': '辵', '⻍': '辵', '每': '毎',
    '爫': '爪', '⺤': '爪', '彐': '彑', 'コ': '彐', '龰': '止', '⺀': '冫',
    '⺊': '卜', '龶': '土', '飠': '食', '钅': '金', '⻖': '阝', '⻏': '阝',
    '⺼': '月', '⺍': '⺌', '龸': '⺌', '习': '羽', '竞': '競',
    '𠮷': '吉', '录': '彔', '𠆢': '人', '亽': '𠆢', '𠂉': '𠂉',
}

def z_variants():
    out = {}
    for line in open('kZVariant.txt', encoding='utf-8'):
        if line.startswith('#'): continue
        f = line.split('\t')
        if len(f) < 3: continue
        try: src = chr(int(f[0].split()[0][2:], 16))
        except Exception: continue
        m = re.match(r'U\+([0-9A-F]+)', f[2].strip())
        if m: out.setdefault(src, chr(int(m.group(1), 16)))
    return out

def definitions():
    out = {}
    for line in open('kDefinition.txt', encoding='utf-8'):
        if line.startswith('#'): continue
        f = line.rstrip('\n').split('\t')
        if len(f) < 3: continue
        try: out[chr(int(f[0].split()[0][2:], 16))] = f[2]
        except Exception: pass
    return out

# Unihan often leads with an onomastic or meta sense; a learner wants the thing.
SKIP = ('variant', 'same as', 'non-classical', 'corrupted', 'old form',
        'standard form', 'used in', 'archaic', 'unknown', 'surname', 'name of',
        'a name', 'radical number', 'kanji radical', 'phonetic')

def short_gloss(text):
    text = re.sub(r'\([^)]*\)', '', text)
    for piece in re.split(r'[;,]', text):
        piece = piece.strip(' .')
        piece = re.sub(r'^(a|an|the|to|of)\s+', '', piece, flags=re.I)
        if 2 <= len(piece) <= 34 and not piece.lower().startswith(SKIP):
            return piece[0].upper() + piece[1:]
    return ''

def main():
    data = json.load(open('out_kanji.json'))
    K, C = data['kanji'], data['components']
    g = json.load(open('wk_graph.json'))
    k2r = g['kanjiToRadicals']
    RAW = load()
    zvar = z_variants()
    defs = definitions()

    # every shape any candidate decomposition could reach
    seen = set()
    for ch, k in K.items():
        seen.update(p for p in (k2r.get(ch) or []))
        seen.update(p['e'] for p in k['d'])
        expr = RAW.get(ch)
        if expr:
            seen.update(operands(expr) or [])
            seen.update(flatten(expr, RAW) or [])

    def named(ch):
        """Matches what partName() can actually print, so nothing passes the
           check here and then renders with a blank label."""
        c = C.get(ch) or {}
        return bool(c.get('wk') or (K.get(ch) or {}).get('m') or c.get('m') or c.get('en'))

    # 1. variant map, recorded so compose can rewrite parts
    canon = {}
    for ch in sorted(seen):
        if len(ch) != 1 or named(ch): continue
        for cand in (HAND.get(ch), zvar.get(ch)):
            if cand and named(cand):
                canon[ch] = cand
                break

    # 2. a gloss for everything else that is a real character
    glossed = 0
    for ch in sorted(seen):
        if len(ch) != 1 or ch in canon or named(ch): continue
        if any(c in IDC for c in ch): continue
        gloss = short_gloss(defs.get(ch, ''))
        if gloss:
            C.setdefault(ch, {'c': ch, 'n': 0})['m'] = [gloss]
            glossed += 1

    data['canon'] = canon
    unnamed = [c for c in sorted(seen) if len(c) == 1 and not named(c) and c not in canon]
    print(f'shapes reachable: {len(seen)} | variant rewrites: {len(canon)} | glossed: {glossed}')
    print(f'still nameless: {len(unnamed)} {unnamed[:20]}')
    json.dump(data, open('out_kanji.json', 'w'), ensure_ascii=False, separators=(',', ':'))

main()
