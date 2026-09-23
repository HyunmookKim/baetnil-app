#!/usr/bin/env python3
# 뱃일 — 재기용: 화면 파일 안의 큰 스크립트를 바깥 파일로 옮긴 판을 만든다 (③ 확인용)
#   ★ 앱을 고치는 것이 아니다. 재기용 빌드에서만 쓴다 — 안드로이드 웹뷰가 바깥 파일은 담아 두는지 보려고.
#   사용: python3 tests/perf_variant.py <폴더(index.html 이 든 곳)>
import re, sys, os
d = sys.argv[1]
p = os.path.join(d, 'index.html')
s = open(p, encoding='utf-8').read()
n = 0
def rep(m):
    global n
    attrs, body = m.group(1), m.group(2)
    if 'src=' in attrs or 'type="module"' in attrs or len(body) < 100000:
        return m.group(0)
    n += 1
    name = 'app-code-%d.js' % n
    open(os.path.join(d, name), 'w', encoding='utf-8').write(body)
    return '<script%s src="%s"></script>' % (attrs, name)
s2 = re.sub(r'<script([^>]*)>(.*?)</script>', rep, s, flags=re.S)
open(p, 'w', encoding='utf-8').write(s2)
print('바깥으로 옮긴 스크립트', n, '개 · 화면 파일', len(s), '→', len(s2), '글자')
