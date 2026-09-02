"""Parse cjkvi-ids into top-level operand lists, resolving nested composites."""
import json, re

IDC = {'⿰':2,'⿱':2,'⿲':3,'⿳':3,'⿴':2,'⿵':2,'⿶':2,'⿷':2,'⿸':2,'⿹':2,'⿺':2,'⿻':2}

def load():
    raw = {}
    for line in open('ids.txt', encoding='utf-8'):
        if line.startswith('#'): continue
        f = line.rstrip('\n').split('\t')
        if len(f) < 3: continue
        ch = f[1]
        if len(ch) != 1: continue
        cands = [re.sub(r'\[[A-Z]+\]$', '', x) for x in f[2:] if not x.startswith('^')]
        cands = [x for x in cands if '(' not in x and '&' not in x and '?' not in x]
        if cands: raw.setdefault(ch, cands[0])
    return raw

def operands(expr):
    """Split one IDS expression into its top-level operands.
       ⿰𠦝月 -> ['𠦝','月'];  ⿰氵⿱廿⿻口夫 -> ['氵','⿱廿⿻口夫']"""
    if not expr or expr[0] not in IDC: return None
    def take(i):
        """returns (subexpr, next_index)"""
        c = expr[i]
        if c in IDC:
            start = i
            i += 1
            for _ in range(IDC[c]):
                _, i = take(i)
            return expr[start:i], i
        return c, i + 1
    i = 1
    out = []
    for _ in range(IDC[expr[0]]):
        try:
            sub, i = take(i)
        except IndexError:
            return None
        out.append(sub)
    if i != len(expr): return None
    return out

def flatten(expr, raw, depth=0):
    """Operand list where every operand is a single character."""
    ops = operands(expr)
    if ops is None: return None
    out = []
    for o in ops:
        if len(o) == 1:
            out.append(o)
        elif depth < 4:
            sub = flatten(o, raw, depth + 1)
            if sub is None: return None
            out.extend(sub)
        else:
            return None
    return out

if __name__ == '__main__':
    raw = load()
    print('ids entries', len(raw))
    for t in ['朝','協','街','卵','母','州','楽','乗','拝','岩','石','漢','森','林','回','日','月','口','山','時','旭','議']:
        e = raw.get(t)
        print(t, e, '->', flatten(e, raw) if e else None)
