#!/bin/bash
# 검사 전부 돌리기.
# ★ 검사마다 두 번째 인자가 다르다(규칙 파일·창고 규칙·백업 파일…).
#   예전에 일일이 손으로 적다가 restoretest 에 규칙 파일을 넘겨 놓고
#   '검사가 깨졌다' 고 헤맸다. 기본값이 다 들어 있으니 첫 인자만 준다.
cd "$(dirname "$0")"
SRC="${1:-work.html}"
# ★ sw.js 는 검사들이 저마다 다른 자리에서 찾는다. 검사 폴더에 옛것이 남아 있으면
#   APP_VER 와 CACHE 가 어긋난 것을 못 잡는다 — 실제로 4.42 에서 그럴 뻔했다.
#   그래서 돌리기 전에 본체 옆의 sw.js 를 여기로 끌어온다.
SWSRC="$(dirname "$SRC")/sw.js"
if [ -f "$SWSRC" ] && [ "$SWSRC" != "./sw.js" ]; then cp -f "$SWSRC" ./sw.js; fi
# ★ 검사 폴더에 work.html 을 남겨 두지 않는다.
#   __dirname 으로 파일을 찾는 옛 검사들이 그 옛 파일을 보고 「다 지났다」고 한다.
#   4.44 에서 journey 가 실제로 4.41 짜리를 보고 있었다. 있으면 지운다.
if [ -f ./work.html ] && [ "$SRC" != "./work.html" ] && [ "$SRC" != "work.html" ]; then rm -f ./work.html; fi
FAILED=""
for t in $(ls *test*.js | grep -v collecttest); do
  # ★ 멈춰 버리는 검사가 하나만 있어도 전체가 안 끝난다 (4.50 에서 trktest 가 18분 잡아먹었다).
  #   4분을 넘기면 자르고 「멈춤」 으로 적는다.
  OUT=$(TZ=Asia/Seoul timeout 240 node "$t" "$SRC" 2>&1); RC=$?
  if [ $RC -eq 124 ]; then OUT="$OUT
★ 실패: 검사가 4분 안에 안 끝났습니다 (멈춤)"; fi
  if [ $RC -ne 0 ]; then
    FAILED="$FAILED $t"
    echo "=== $t"
    echo "$OUT" | grep '★' | cut -c1-110 | head -6
  fi
done
for one in "syncsim.js $SRC" "collecttest.js ../../repo/scripts/collect_kr.js $SRC"; do
  set -- $one
  OUT=$(TZ=Asia/Seoul timeout 240 node "$@" 2>&1) || {
    FAILED="$FAILED $1"; echo "=== $1"; echo "$OUT" | grep '★' | cut -c1-110 | head -6; }
done
echo "실패:${FAILED:- 없음}"
# ★ 처음 오는 사람의 길(journey.js)은 브라우저를 띄우므로 여기 안 넣는다.
#   판을 내기 전에 따로 한 번 돌린다:  node journey.js
