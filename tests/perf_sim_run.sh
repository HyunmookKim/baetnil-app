#!/bin/bash
# 뱃일 — 아이폰 시뮬레이터 한 대에서 앱을 세 번 켜며 효율을 잰다 (perf.js 가 잰다)
#   $1 기기 이름(| 로 여럿) · $2 결과 폴더
set -o pipefail
PAT="$1"; OUT="$2"
mkdir -p "$OUT"
: "${APP:?APP 가 없습니다}"; : "${BUNDLE_ID:=kr.baetnil.app}"
DEV=$(xcrun simctl list devices available -j | python3 -c "
import json,sys,re
d=json.load(sys.stdin)['devices']
for p in '$PAT'.split('|'):
  c=[(k,x['udid'],x['name']) for k,v in d.items() if 'iOS' in k for x in v if x['name'].startswith(p)]
  if c:
    c.sort(key=lambda t:[int(n) for n in re.findall(r'\d+',t[0])]); print(c[-1][1]); break
")
[ -n "$DEV" ] || { echo "::error::기기를 못 찾았습니다: $PAT"; exit 1; }
NAME=$(xcrun simctl list devices | grep "$DEV" | head -1 | sed 's/^ *//')
echo "기기: $NAME"; echo "$NAME" > "$OUT/device.txt"
xcrun simctl shutdown "$DEV" 2>/dev/null || true
xcrun simctl erase "$DEV"
xcrun simctl boot "$DEV"
xcrun simctl bootstatus "$DEV" -b
xcrun simctl install "$DEV" "$APP"
for s in location-always photos; do xcrun simctl privacy "$DEV" grant $s "$BUNDLE_ID" || true; done
xcrun simctl location "$DEV" set 34.7404,127.7449 || true
sleep 5
for i in 1 2 3; do
  T0=$(python3 -c 'import time;print(int(time.time()*1000))')
  xcrun simctl launch "$DEV" "$BUNDLE_ID" > /dev/null
  # perf.txt 에 「DONE {"몇번째":i}」 가 나올 때까지 기다린다 (최대 3분)
  for k in $(seq 1 180); do
    C=$(xcrun simctl get_app_container "$DEV" "$BUNDLE_ID" data 2>/dev/null)
    F="$C/Documents/perf.txt"
    if [ -f "$F" ] && grep -q "DONE-ASCII n=$i" "$F"; then break; fi
    sleep 1
  done
  T1=$(python3 -c 'import time;print(int(time.time()*1000))')
  echo "[baetnil-perf] LAUNCH {\"몇번째\":$i,\"켜서_DONE까지_ms\":$((T1-T0))}" >> "$OUT/launch.txt"
  xcrun simctl terminate "$DEV" "$BUNDLE_ID" || true
  sleep 3
done
C=$(xcrun simctl get_app_container "$DEV" "$BUNDLE_ID" data 2>/dev/null)
cp "$C/Documents/perf.txt" "$OUT/perf.txt" 2>/dev/null || echo "perf.txt 없음" > "$OUT/perf.txt"
cat "$OUT/perf.txt" "$OUT/launch.txt"
xcrun simctl shutdown "$DEV" 2>/dev/null || true
