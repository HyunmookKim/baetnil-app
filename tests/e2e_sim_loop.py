#!/usr/bin/env python3
# 뱃일 — 시뮬레이터 검사의 바깥쪽 손 (6.0)
#   앱 안의 검사 파일(e2e.js)이 남기는 줄을 읽고, 앱 안에서는 못 하는 일을 대신한다.
#     SHOT <이름>   → 화면 사진
#     BG <초>       → 앱을 뒤로 보냈다가(설정 앱을 켬) <초> 뒤 다시 앞으로
#     NATIVE <이름> → 6초 뒤 사진, 그리고 앱을 껐다 다시 켠다(네이티브 창을 닫는 길)
#     DONE          → 끝
#   4분 넘게 아무 줄이 없으면 멈춘 것으로 보고 사진을 찍고 다시 켠다(두 번까지).
import os, subprocess, time, re, sys

DEV = os.environ['DEV']; OUT = os.environ['OUT']; BID = os.environ['BUNDLE_ID']; MODE = os.environ['MODE']
LIMIT = 45 * 60 if MODE == 'full' else 12 * 60
TAG = '[baetnil-e2e] '
logs = []

def sh(*a, **k):
    return subprocess.run(list(a), capture_output=True, text=True, **k)

def shot(name):
    safe = re.sub(r'[^0-9A-Za-z._-]+', '_', name)[:60]
    p = os.path.join(OUT, safe + '.png')
    sh('xcrun', 'simctl', 'io', DEV, 'screenshot', p)
    return p

def launch():
    n = len(logs) + 1
    f = os.path.join(OUT, 'app-log-%d.txt' % n)
    open(f, 'w').close()
    env = dict(os.environ, SIMCTL_CHILD_NSUnbufferedIO='YES')
    r = sh('xcrun', 'simctl', 'launch', '--terminate-running-process', '--stdout=' + f, '--stderr=' + f, DEV, BID, env=env)
    print('앱 켬 #%d: %s %s' % (n, r.stdout.strip(), r.stderr.strip()[:200]), flush=True)
    logs.append([f, 0])

def foreground():
    # 이미 떠 있는 앱을 끄지 않고 앞으로 부른다
    sh('xcrun', 'simctl', 'launch', DEV, BID)

def read_new():
    out = []
    for L in logs:
        try:
            with open(L[0], 'r', errors='replace') as fh:
                fh.seek(L[1]); data = fh.read(); L[1] = fh.tell()
        except FileNotFoundError:
            continue
        for line in data.splitlines():
            if TAG in line:
                out.append(line[line.index(TAG) + len(TAG):].strip())
    return out

results = []; done = False; stuck = 0; seen = set()
# 캐퍼시터가 console.log 를 표준 출력과 시스템 기록 두 곳에 남길 수 있다 — 둘 다 읽고, 같은 줄은 한 번만 친다
logs.append([os.path.join(OUT, 'oslog.txt'), 0])
launch()
t0 = time.time(); last = time.time()
while time.time() - t0 < LIMIT:
    lines = read_new()
    if lines: last = time.time()
    for m in lines:
        m = re.sub(r'\s+$', '', m)
        if m in seen: continue
        seen.add(m)
        print('  ' + m, flush=True)
        if m.startswith('SHOT '):
            shot(m[5:])
        elif m.startswith('BG '):
            sec = int(re.findall(r'\d+', m)[0])
            sh('xcrun', 'simctl', 'launch', DEV, 'com.apple.Preferences')
            time.sleep(2); shot('bg-away')
            time.sleep(sec)
            foreground(); time.sleep(2); shot('bg-back')
        elif m.startswith('NATIVE '):
            nm = m[7:].strip()
            time.sleep(6); shot('native-' + nm)
            time.sleep(1); launch()
        elif m.startswith('OK ') or m.startswith('FAIL '):
            results.append(m)
        elif m.startswith('DONE'):
            results.append(m); done = True
    if done: break
    if time.time() - last > 240:
        stuck += 1
        print('!! 4분 동안 아무 줄이 없습니다 — 멈춘 것으로 봅니다 (%d번째)' % stuck, flush=True)
        shot('stuck-%d' % stuck)
        results.append('FAIL (멈춤 %d) — 4분 동안 앱이 아무 줄도 안 남김' % stuck)
        if stuck > 2: break
        launch(); last = time.time()
    time.sleep(0.5)

ok = [r for r in results if r.startswith('OK ')]
bad = [r for r in results if r.startswith('FAIL')]
summ = os.environ.get('GITHUB_STEP_SUMMARY')
with open(os.path.join(OUT, 'result.txt'), 'w') as fh:
    fh.write('\n'.join(results) + '\n')
if summ:
    with open(summ, 'a') as fh:
        fh.write('\n### %s (%s)\n\n' % (open(os.path.join(OUT, 'device.txt')).read().strip(), MODE))
        fh.write('통과 %d · 실패 %d · %s\n\n' % (len(ok), len(bad), '끝까지 감' if done else '**끝까지 못 감**'))
        for r in results:
            fh.write('- ' + ('✅ ' if r.startswith('OK') else ('❌ ' if r.startswith('FAIL') else '')) + r + '\n')
print('통과 %d · 실패 %d · 끝=%s' % (len(ok), len(bad), done))
sys.exit(0 if (done and not bad) else 1)
