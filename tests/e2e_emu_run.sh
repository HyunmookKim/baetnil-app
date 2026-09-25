#!/bin/bash
# 뱃일 — 안드로이드 에뮬레이터 한 대에서 전체 기능 검사 (5.15)
#   $1 APK · $2 결과 폴더
APK="$1"; OUT="$2"; PKG=kr.baetnil.app
mkdir -p "$OUT"
adb wait-for-device
{ adb shell getprop ro.build.version.release; adb shell getprop ro.product.model; adb shell wm size; adb shell wm density; } > "$OUT/device.txt"
# ★ 에뮬레이터가 막 켜진 뒤 한동안 화면 설정(테마 덮개)이 바뀌며 앱 화면을 다시 만든다.
#   그 사이에 앱을 켜면 앱이 두 벌 돌았다(2회째 — 모든 줄이 두 번씩, 한쪽은 폭 0).
#   부팅이 끝나고 조용해질 때까지 기다린다.
adb shell 'while [ "$(getprop sys.boot_completed)" != 1 ]; do sleep 1; done'
sleep 60
adb uninstall $PKG >/dev/null 2>&1 || true
adb install -r -g "$APK"
adb shell pm grant $PKG android.permission.ACCESS_BACKGROUND_LOCATION 2>/dev/null || true
adb shell pm grant $PKG android.permission.POST_NOTIFICATIONS 2>/dev/null || true
adb shell settings put secure show_ime_with_hard_keyboard 1   # 에뮬레이터에서도 화면 키보드가 뜨게
# 여수 앞바다에서 남쪽으로 꾸준히 나아가는 위치 (항적 검사용) — 2초마다 약 22m.
# ★ 4회째: 열 점을 빙빙 돌게 했더니 같은 자리로 되돌아와 점이 안 늘었다 → 한 방향으로만 간다.
( LAT=34.7404; LON=127.7449
  while true; do
    LAT=$(python3 -c "print(round($LAT-0.0002,6))"); LON=$(python3 -c "print(round($LON+0.00005,6))")
    adb emu geo fix $LON $LAT >/dev/null 2>&1; sleep 2
  done ) &
GEO=$!
export OUT PKG
python3 "$(dirname "$0")/e2e_emu_loop.py"; RC=$?
kill $GEO 2>/dev/null || true
adb shell am force-stop $PKG
exit $RC
