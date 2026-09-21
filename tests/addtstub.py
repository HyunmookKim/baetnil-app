#!/usr/bin/env python3
# 검사에서 사전 t() 를 부르는 곳이 늘었다. 검사는 사전 없이 함수만 떼어 돌리므로
# '그대로 돌려주는' 가짜 t 를 넣어 준다.
import io, sys, subprocess, glob, os
LINE = ("// 사전은 앱 안에 있다. 검사는 함수만 떼어 돌리므로 그대로 돌려주는 가짜를 쓴다.\n"
        "globalThis.t = globalThis.t || (x => x);\n"
        "globalThis.tsub = globalThis.tsub || ((k, v) => { let o = String(k);\n"
        "  for(const n in v) o = o.split('{'+n+'}').join(String(v[n] == null ? '' : v[n])); return o; });\n")
done=[]
for f in sorted(glob.glob('*test*.js')) + ['syncsim.js']:
    if not os.path.exists(f): continue
    s = io.open(f, encoding='utf-8').read()
    if 'globalThis.t =' in s or 'globalThis.t=' in s: continue
    r = subprocess.run(['node', f, 'work.html'], capture_output=True, text=True,
                       env={**os.environ, 'TZ':'Asia/Seoul'})
    if 't is not defined' not in (r.stderr + r.stdout) and 'tsub is not defined' not in (r.stderr + r.stdout):
        continue
    lines = s.split('\n')
    k = 0
    while k < len(lines) and (lines[k].startswith('#!') or lines[k].startswith('//') or not lines[k].strip()):
        k += 1
    lines.insert(k, LINE.rstrip('\n'))
    io.open(f,'w',encoding='utf-8').write('\n'.join(lines))
    done.append(f)
print('가짜 t 넣음:', len(done)); print(' '.join(done))
