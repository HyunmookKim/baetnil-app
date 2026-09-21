#!/usr/bin/env python3
# 앱이 사전에 물어보는 열쇠를 모두 모은다.
import io, re, json
s=io.open('work.html',encoding='utf-8').read()
DI=s.index('const I18N = {'); DE=s.index('\n};\n',DI)
HAN=re.compile(r'[가-힣]')
def un(x):
    return x.replace("\\\\","\x00").replace("\\'","'").replace("\\n","\n").replace("\x00","\\")
keys=set()
for m in re.finditer(r"(?<![A-Za-z0-9_$.])(?:t|tsub|errSay)\('((?:[^'\\]|\\.)*)'", s):
    if DI <= m.start() < DE: continue
    k=un(m.group(1))
    if HAN.search(k): keys.add(k)
for m in re.finditer(r'data-t(?:ph|t|al|alt)?="([^"]*)"', s):
    if HAN.search(m.group(1)): keys.add(m.group(1))
# 상수 목록의 이름들 — t() 로 감싼 것은 위에서 잡힌다
# openForm / needEdit / setHeadTitle 로 넘기는 한국어
for pat in (r"\bsetHeadTitle\('((?:[^'\\]|\\.)*)'", r"\bsetSync\('((?:[^'\\]|\\.)*)'", r"\b(?:needEdit|guardEdit)\('((?:[^'\\]|\\.)*)'"):
    for m in re.finditer(pat, s):
        k=un(m.group(1))
        if HAN.search(k): keys.add(k)
# openForm(...) 안의 title/sub/label/okText/placeholder/name/text
for m in re.finditer(r'\bopenForm\s*\(', s):
    d=1; j=m.end()
    while j<len(s) and d>0:
        ch=s[j]
        if ch in "'\"`":
            q=ch; j+=1
            while j<len(s):
                if s[j]=='\\': j+=2; continue
                if s[j]==q: break
                j+=1
        elif ch=='(': d+=1
        elif ch==')': d-=1
        j+=1
    seg=s[m.end():j-1]
    for mm in re.finditer(r"\b(title|sub|label|okText|placeholder|name|text)\s*:\s*'((?:[^'\\]|\\.)*)'", seg):
        k=un(mm.group(2))
        if HAN.search(k): keys.add(k)

# 그리는 자리에서 사전을 거치는 목록들 — 그 안의 한국어도 열쇠다
DRAWN = ['RICH_TOOLS','BOAT_SPEC','RIDE_TRIP','RIDE_WANT','RIDE_COST','SORT_MODES',
         'BOAT_TYPES','FISH_SPECIES','FISH_BAITS','FISH_RIGS','TIDE_WEST','TIDE_SOUTH',
         'DIRS','SPOT_BOTTOM','REGIONS','LOG_KINDS','LOG_KINDS_COMMON','LOG_KINDS_BY_TYPE',
         'RUN_PURPOSES','HAT_BUILTIN','SPOT_SEED_FROM']
for nm in DRAWN:
    m=re.search(r'^const '+nm+r'\s*=\s*', s, re.M)
    if not m: print('X 없음', nm); continue
    j=m.end()
    if s[j] in '[{':
        op=s[j]; cl=']' if op=='[' else '}'; d=0; k=j
        while k<len(s):
            if s[k]==op: d+=1
            elif s[k]==cl:
                d-=1
                if d==0: k+=1; break
            k+=1
    else:
        k=s.index('\n', j)
    for mm in re.finditer(r"'((?:[^'\\\n]|\\.)*)'", s[j:k]):
        v=un(mm.group(1))
        if HAN.search(v): keys.add(v)
keys=sorted(keys)
io.open('keys.json','w',encoding='utf-8').write(json.dumps(keys, ensure_ascii=False, indent=0))
print(len(keys), '개')
# 사전에 이미 있는 것
blk=s[DI:DE]
def have(lang):
    i=blk.index(lang+': {'); d=0; k=i
    while k<len(blk):
        if blk[k]=='{': d+=1
        elif blk[k]=='}':
            d-=1
            if d==0: break
        k+=1
    seg=blk[i:k]
    return set(un(x) for x in re.findall(r"'((?:[^'\\]|\\.)*)'\s*:", seg))
en=have('en'); ru=have('ru')
print('en 있음', len(en), '/ ru 있음', len(ru))
miss_en=[k for k in keys if k not in en]
miss_ru=[k for k in keys if k not in ru]
io.open('miss_en.json','w',encoding='utf-8').write(json.dumps(miss_en, ensure_ascii=False, indent=0))
io.open('miss_ru.json','w',encoding='utf-8').write(json.dumps(miss_ru, ensure_ascii=False, indent=0))
print('en 모자람', len(miss_en), '/ ru 모자람', len(miss_ru))
# 사전에 있는데 앱이 안 쓰는 것
print('안 쓰는 en 항목', len([k for k in en if k not in keys]))
