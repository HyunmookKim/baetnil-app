#!/bin/bash
# 뱃일 — 시뮬레이터 한 대에서 검사 파일(e2e.js)이 이끄는 전체 검사를 돌린다 (6.0)
#   $1 기기 이름(| 로 여럿) · $2 full|quick · $3 결과 폴더
set -o pipefail
PAT="$1"; MODE="$2"; OUT="$3"
mkdir -p "$OUT"
: "${APP:?APP 가 없습니다}"; : "${BUNDLE_ID:=kr.baetnil.app}"
DEV=$(xcrun simctl list devices available -j | python3 -c "
import json,sys,re
d=json.load(sys.stdin)['devices']
pats='$PAT'.split('|')
for p in pats:
  c=[(k,x['udid'],x['name']) for k,v in d.items() if 'iOS' in k for x in v if x['name'].startswith(p)]
  if c:
    c.sort(key=lambda t:[int(n) for n in re.findall(r'\d+',t[0])])
    print(c[-1][1]); break
")
[ -n "$DEV" ] || { echo "::error::기기를 못 찾았습니다: $PAT"; xcrun simctl list devices available | head -60; exit 1; }
NAME=$(xcrun simctl list devices | grep "$DEV" | head -1 | sed 's/^ *//')
echo "기기: $NAME ($MODE)"; echo "$NAME" > "$OUT/device.txt"
xcrun simctl shutdown "$DEV" 2>/dev/null || true
xcrun simctl erase "$DEV"
xcrun simctl boot "$DEV"
xcrun simctl bootstatus "$DEV" -b
xcrun simctl install "$DEV" "$APP"
for s in location-always photos calendar reminders; do xcrun simctl privacy "$DEV" grant $s "$BUNDLE_ID" || true; done
xcrun simctl location "$DEV" set 34.7404,127.7449 || true
if [ "$MODE" = full ]; then
  # 여수 앞바다를 초속 5m(약 10노트)로 도는 길 — 항적 검사용
  xcrun simctl location "$DEV" start --speed=5 --interval=1 \
    34.7404,127.7449 34.7380,127.7500 34.7340,127.7560 34.7300,127.7620 34.7260,127.7680 \
    34.7220,127.7740 34.7180,127.7800 34.7140,127.7860 34.7100,127.7920 34.7060,127.7980 \
    34.7020,127.8040 34.6980,127.8100 34.6940,127.8160 34.6900,127.8220 34.6860,127.8280 || true
fi
xcrun simctl spawn "$DEV" log stream --style compact --level debug --predicate 'process == "App"' > "$OUT/oslog.txt" 2>&1 &
LOGPID=$!
export DEV OUT BUNDLE_ID MODE
python3 "$(dirname "$0")/e2e_sim_loop.py"; RC=$?
kill $LOGPID 2>/dev/null || true
xcrun simctl location "$DEV" clear 2>/dev/null || true
xcrun simctl shutdown "$DEV" 2>/dev/null || true
exit $RC
