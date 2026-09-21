#!/bin/bash
cd "$(dirname "$0")"
SRC="${1:-../../work.html}"
F=""
for t in $(ls *live*.js); do
  OUT=$(TZ=Asia/Seoul timeout 300 node "$t" "$SRC" 2>&1); RC=$?
  if [ $RC -ne 0 ]; then F="$F $t"; echo "=== $t"; echo "$OUT" | grep '★' | cut -c1-120 | head -6; fi
done
echo "살아있는 검사 실패:${F:- 없음}"
