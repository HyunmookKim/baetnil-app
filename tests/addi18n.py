#!/usr/bin/env python3
# add_en.json / add_ru.json / add_ja.json 을 사전에 끼워 넣는다.
#  쓰는 법: python3 addi18n.py 3.90-①
import io, json, re, sys, os
P=os.environ.get('I18N_TARGET','work.html'); s=io.open(P,encoding='utf-8').read()
tag = sys.argv[1] if len(sys.argv)>1 else ''
def q(x):
    return "'" + x.replace("\\","\\\\").replace("'","\\'").replace("\n","\\n") + "'"
def blockspan(lang):
    i=s.index("\n  "+lang+": {")
    d=0;k=s.index('{', i)
    j=k
    while j<len(s):
        if s[j]=='{': d+=1
        elif s[j]=='}':
            d-=1
            if d==0: break
        j+=1
    return k, j     # '{' 자리, 닫는 '}' 자리
tot=0
for lang in ('en','ru','ja'):
    f='add_'+lang+'.json'
    if not os.path.exists(f): continue
    add=json.load(io.open(f,encoding='utf-8'))
    k,j=blockspan(lang)
    have=set(x.replace("\\'","'").replace("\\n","\n").replace("\\\\","\\")
             for x in re.findall(r"'((?:[^'\\]|\\.)*)'\s*:", s[k:j]))
    lines=[]
    for src,dst in add.items():
        if src in have: continue
        lines.append('    ' + q(src) + ':' + q(dst) + ',')
    if not lines: print(lang,'더할 것 없음'); continue
    ins = '\n\n    // ── ' + tag + '\n' + '\n'.join(lines) + '\n  '
    s = s[:j] + ins + s[j:]
    tot += len(lines); print(lang, len(lines), '개 넣음')
io.open(P,'w',encoding='utf-8').write(s)
print('-- 모두', tot)
