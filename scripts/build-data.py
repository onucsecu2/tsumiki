import json, os, re, xml.etree.ElementTree as ET
KVG='http://kanjivg.tagaini.net'; SVG='{http://www.w3.org/2000/svg}'
meta=json.load(open('kanji.json'))
LEVELMAP={5:'N5',4:'N4',3:'N3',2:'N2',1:'N1'}
target={k:LEVELMAP[v['jlpt_new']] for k,v in meta.items() if v.get('jlpt_new') in LEVELMAP}
variants={}   # element -> original canonical form

def parse(ch):
    p='kvg/kanji/%05x.svg'%ord(ch)
    if not os.path.exists(p): return None
    src=open(p,encoding='utf-8').read()
    src=re.sub(r'<!DOCTYPE.*?\]>','',src,flags=re.S)
    src=re.sub(r'<!--.*?-->','',src,flags=re.S)
    src=src.replace('<svg ','<svg xmlns:kvg="%s" '%KVG,1)
    return ET.fromstring(src)

E=lambda g:g.get('{%s}element'%KVG)
O=lambda g:g.get('{%s}original'%KVG)
P=lambda g:g.get('{%s}position'%KVG)

def nstrokes(g): return sum(1 for _ in g.iter(SVG+'path'))

def direct_parts(node, depth=0):
    """children of node that carry an element; descend through unnamed groups"""
    res=[]
    for c in node:
        if c.tag!=SVG+'g': continue
        e=E(c)
        if e:
            res.append({'e':e,'p':P(c) or '','n':nstrokes(c)})
            if O(c): variants.setdefault(e,O(c))
        else:
            res.extend(direct_parts(c,depth+1))
    return res

def collect(ch):
    root=parse(ch)
    if root is None: return None
    grp=None
    for g in root.iter(SVG+'g'):
        if (g.get('id') or '').endswith('StrokePaths_%05x'%ord(ch)): grp=g;break
    if grp is None: return None
    strokes=[p.get('d') for p in grp.iter(SVG+'path') if p.get('d')]
    kids=[c for c in grp if c.tag==SVG+'g']
    top=kids[0] if len(kids)==1 else grp
    direct=direct_parts(top)
    if len(direct)<2:
        # fall back: go one level deeper inside the single part's siblings
        deeper=[]
        for c in top:
            if c.tag!=SVG+'g': continue
            e=E(c)
            sub=direct_parts(c)
            if e and len(sub)>=1 and nstrokes(c)>0: deeper.append({'e':e,'p':P(c) or '','n':nstrokes(c)})
            elif sub: deeper.extend(sub)
        if len(deeper)>len(direct): direct=deeper
    allc=[]
    for g in top.iter(SVG+'g'):
        e=E(g); o=O(g)
        if e and e!=ch and e not in allc: allc.append(e)
        if e and o: variants.setdefault(e,o)
    return strokes,direct,allc

RAD=json.load(open('radnames.json'))
out={};strokes_out={}
for ch,lvl in target.items():
    r=collect(ch); m=meta[ch]
    strokes,direct,allc = r if r else ([],[],[])
    mm=[x.lstrip('^') for x in (m.get('wk_meanings') or m.get('meanings') or [])][:4]
    out[ch]={'c':ch,'l':lvl,'s':m.get('strokes'),'g':m.get('grade'),'f':m.get('freq'),
             'm':mm,'on':(m.get('readings_on') or [])[:4],'kun':(m.get('readings_kun') or [])[:4],
             'd':direct,'comp':allc}
    strokes_out[ch]=strokes

# stroke paths + meanings for standalone components not in the JLPT set
extra=set()
for v in out.values():
    for c in v['comp']: extra.add(c)
    for d in v['d']: extra.add(d['e'])
comp_info={}
for c in sorted(extra):
    if len(c)!=1: continue
    info={'c':c}
    canon=variants.get(c)
    if canon: info['o']=canon
    src=meta.get(c) or (meta.get(canon) if canon else None)
    if src:
        info['m']=[x.lstrip('^') for x in (src.get('wk_meanings') or src.get('meanings') or [])][:3]
        info['s']=src.get('strokes')
    if c not in strokes_out:
        r=collect(c)
        if r: strokes_out[c]=r[0]
    info['n']=len(strokes_out.get(c,[]))
    r=RAD.get(c) or (RAD.get(canon) if canon else None)
    if r:
        info['jp']=r['jp']
        if r.get('en'): info['en']=r['en']
        if r.get('num'): info['num']=r['num']
    comp_info[c]=info

json.dump({'kanji':out,'components':comp_info},open('out_kanji.json','w'),ensure_ascii=False,separators=(',',':'))
json.dump(strokes_out,open('out_strokes.json','w'),ensure_ascii=False,separators=(',',':'))
print('kanji',len(out),'components',len(comp_info),'strokesets',len(strokes_out))
print('bytes',os.path.getsize('out_kanji.json'),os.path.getsize('out_strokes.json'))
for t in '漢語親休明時':
    print(t,json.dumps(out[t],ensure_ascii=False))
