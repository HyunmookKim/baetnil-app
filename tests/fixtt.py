#!/usr/bin/env python3
# t(`… ${esc(t('…'))} …`) 처럼 사전 안에 사전이 들어간 것을 되돌린다.
#  ★ 이러면 열쇠가 그때그때 달라져서 사전이 절대 안 맞는다.
import io, re
P='work.html'; s=io.open(P,encoding='utf-8').read()
n=0
while True:
    m=re.search(r"(?<![A-Za-z0-9_$.])t\(`((?:[^`\\]|\\.)*)`\)", s)
    if not m: break
    body=m.group(1)
    # 안쪽 ${esc(t('X'))} 를 X 로 되돌린다
    def back(mm):
        return mm.group(1).replace("\\'", "'")
    flat=re.sub(r"\$\{esc\(t\('((?:[^'\\]|\\.)*)'\)\)\}", back, body)
    flat=re.sub(r"\$\{t\('((?:[^'\\]|\\.)*)'\)\}", back, flat)
    if '${' in flat:
        print('!! 손으로 봐야 함:', flat[:90]); break
    flat=re.sub(r'\s+', ' ', flat).strip()
    q=flat.replace("\\","\\\\").replace("'","\\'")
    s=s[:m.start()] + "t('" + q + "')" + s[m.end():]
    n+=1
io.open(P,'w',encoding='utf-8').write(s)
print('되돌림', n, '곳')
