#!/usr/bin/env python3
# 뱃일 — 안드로이드 에뮬레이터 검사의 바깥쪽 손 (5.15)
#   아이폰의 e2e_sim_loop.py 와 같은 일을 안드로이드에서 한다. 앱 안의 검사 파일(e2e.js)이 남기는 줄을
#   logcat 에서 읽고, 앱 안에서는 못 하는 일을 대신한다.
#     SHOT <이름>   → 화면 사진 (adb screencap)
#     TAP x y dpr w h → 화면의 그 자리를 손가락처럼 누른다 (키보드를 띄우려고)
#     BG <초>       → 홈으로 나갔다가 <초> 뒤 다시 앱으로
#     NATIVE <이름> → 6초 뒤 사진, 그리고 앱을 껐다 다시 켠다
#     DONE          → 끝
import os, subprocess, time, re, sys

OUT = os.environ['OUT']; PKG = os.environ.get('PKG', 'kr.baetnil.app'); MODE = os.environ.get('MODE', 'full')
LIMIT = 50 * 60
TAG = '[baetnil-e2e] '
os.makedirs(OUT, exist_ok=True)

def sh(*a):
    return subprocess.run(list(a), capture_output=True, text=True)

LOG = os.path.join(OUT, 'logcat.txt')
subprocess.run(['adb', 'logcat', '-c'])
lc = subprocess.Popen(['adb', 'logcat', '-v', 'brief'], stdout=open(LOG, 'w'), stderr=subprocess.STDOUT)
pos = [0]

def read_new():
    out = []
    with open(LOG, 'r', errors='replace') as fh:
        fh.seek(pos[0]); data = fh.read(); pos[0] = fh.tell()
    for line in data.splitlines():
        # ★ 앱이 console.log 로 남긴 줄(Capacitor/Console)만 본다.
        #   같은 줄이 파일 쓰기 부품 호출 기록(V/Capacitor … methodData)에도 찍히는데,
        #   그쪽은 뒤에 \n","encoding":"utf8"} 이 붙어 숫자 읽기가 깨진다 (1회째에 여기서 멈춤).
        if 'Capacitor/Console' not in line or TAG not in line: continue
        m = line[line.index(TAG) + len(TAG):]
        out.append(m.strip())
    return out

def shot(name):
    safe = re.sub(r'[^0-9A-Za-z._-]+', '_', name)[:60]
    p = os.path.join(OUT, safe + '.png')
    with open(p, 'wb') as fh:
        subprocess.run(['adb', 'exec-out', 'screencap', '-p'], stdout=fh)
    return p

def launch(fresh=False):
    if fresh: sh('adb', 'shell', 'am', 'force-stop', PKG); time.sleep(1)
    r = sh('adb', 'shell', 'am', 'start', '-n', PKG + '/.MainActivity')
    print('앱 켬: ' + (r.stdout.strip() + r.stderr.strip())[:200], flush=True)

def webview_box():
    # 웹뷰가 화면의 어디에 있는가 (가장자리까지 꽉 차게 그리면 0,0 부터)
    sh('adb', 'shell', 'uiautomator', 'dump', '/sdcard/ui.xml')
    x = sh('adb', 'shell', 'cat', '/sdcard/ui.xml').stdout
    m = re.search(r'class="android\.webkit\.WebView"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', x)
    if not m: return None
    return tuple(int(v) for v in m.groups())

results = []; done = False; stuck = 0; seen = set()
launch()
# ★ 앱이 두 벌 떠 있으면(화면을 다시 만드는 사이 옛 웹뷰가 살아 있음) 검사 결과를 믿을 수 없다 — 알리고 다시 켠다
time.sleep(15)
with open(LOG, 'r', errors='replace') as fh: _l = fh.read()
if _l.count('Starting BridgeActivity') > 1:
    print('!! 앱 화면이 켜지자마자 다시 만들어졌습니다 — 끄고 다시 켭니다', flush=True)
    results.append('INFO 켜자마자 화면이 다시 만들어짐(%d번) — 다시 켬' % _l.count('Starting BridgeActivity'))
    launch(fresh=True)
t0 = time.time(); last = time.time()
while time.time() - t0 < LIMIT:
    lines = read_new()
    if lines: last = time.time()
    for m in lines:
        if m in seen and not m.startswith(('SHOT ', 'TAP ')): continue
        seen.add(m)
        print('  ' + m, flush=True)
        if m.startswith('SHOT '):
            time.sleep(0.8); shot(m[5:].strip())
        elif m.startswith('TAP '):
            nums = [float(v) for v in re.findall(r'-?\d+(?:\.\d+)?', m)[:5]]
            if len(nums) < 5:
                print('  !! TAP 줄을 못 읽음: ' + m, flush=True); continue
            x, y, dpr, w, h = nums
            box = webview_box()
            if box:
                L, T, R, B = box
                sx = (R - L) / w if w else dpr; sy = (B - T) / h if h else dpr
                px, py = int(L + x * sx), int(T + y * sy)
            else:
                px, py = int(x * dpr), int(y * dpr)
            print('  → 누름 %d,%d (웹뷰 %s)' % (px, py, box), flush=True)
            sh('adb', 'shell', 'input', 'tap', str(px), str(py))
        elif m.startswith('BG '):
            sec = int(re.findall(r'\d+', m)[0])
            sh('adb', 'shell', 'input', 'keyevent', 'KEYCODE_HOME')
            time.sleep(2); shot('bg-away')
            time.sleep(sec)
            launch(); time.sleep(2); shot('bg-back')
        elif m.startswith('NATIVE '):
            nm = m[7:].strip()
            time.sleep(6); shot('native-' + nm)
            time.sleep(1); launch(fresh=True)
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
        launch(fresh=True); last = time.time()
    time.sleep(0.5)

lc.terminate()
ok = [r for r in results if r.startswith('OK ')]
bad = [r for r in results if r.startswith('FAIL')]
with open(os.path.join(OUT, 'result.txt'), 'w') as fh:
    fh.write('\n'.join(results) + '\n')
summ = os.environ.get('GITHUB_STEP_SUMMARY')
if summ:
    with open(summ, 'a') as fh:
        dev = open(os.path.join(OUT, 'device.txt')).read().strip() if os.path.exists(os.path.join(OUT, 'device.txt')) else ''
        fh.write('\n### 안드로이드 %s\n\n통과 %d · 실패 %d · %s\n\n' % (dev.replace('\n', ' '), len(ok), len(bad), '끝까지 감' if done else '**끝까지 못 감**'))
        for r in results:
            fh.write('- ' + ('✅ ' if r.startswith('OK') else ('❌ ' if r.startswith('FAIL') else '')) + r + '\n')
print('통과 %d · 실패 %d · 끝=%s' % (len(ok), len(bad), done))
sys.exit(0 if (done and not bad) else 1)
