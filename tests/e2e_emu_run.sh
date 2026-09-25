#!/bin/bash
# 뱃일 — 안드로이드 에뮬레이터 한 대에서 전체 기능 검사 (5.15)
#   $1 APK · $2 결과 폴더
APK="$1"; OUT="$2"; PKG=kr.baetnil.app
mkdir -p "$OUT"
adb wait-for-device
{ adb shell getprop ro.build.version.release; adb shell getprop ro.product.model; adb shell wm size; adb shell wm density; } > "$OUT/device.txt"
adb uninstall $PKG >/dev/null 2>&1 || true
adb install -r -g "$APK"
adb shell pm grant $PKG android.permission.ACCESS_BACKGROUND_LOCATION 2>/dev/null || true
adb shell pm grant $PKG android.permission.POST_NOTIFICATIONS 2>/dev/null || true
adb shell settings put secure show_ime_with_hard_keyboard 1   # 에뮬레이터에서도 화면 키보드가 뜨게
# 여수 앞바다를 천천히 도는 위치 (항적 검사용) — 뒤에서 계속 흘려 준다
( while true; do
    for p in "127.7449 34.7404" "127.7500 34.7380" "127.7560 34.7340" "127.7620 34.7300" "127.7680 34.7260" \
             "127.7740 34.7220" "127.7800 34.7180" "127.7860 34.7140" "127.7920 34.7100" "127.7980 34.7060"; do
      adb emu geo fix $p >/dev/null 2>&1; sleep 2
    done
  done ) &
GEO=$!
export OUT PKG
python3 "$(dirname "$0")/e2e_emu_loop.py"; RC=$?
kill $GEO 2>/dev/null || true
adb shell am force-stop $PKG
exit $RC
