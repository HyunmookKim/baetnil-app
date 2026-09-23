#!/bin/bash
# 뱃일 — 안드로이드 에뮬레이터에서 앱을 세 번 켜며 효율을 잰다 (perf.js 가 잰다)
#   $1 APK · $2 결과 폴더
set -x
APK="$1"; OUT="$2"; PKG=kr.baetnil.app
mkdir -p "$OUT"
adb wait-for-device
adb shell getprop ro.build.version.release > "$OUT/device.txt"
adb shell getprop ro.product.model >> "$OUT/device.txt"
adb shell dumpsys package com.google.android.webview 2>/dev/null | grep -m1 versionName >> "$OUT/device.txt" || true
adb install -r -g "$APK"
adb logcat -c
for i in 1 2 3; do
  adb shell am force-stop $PKG
  sleep 2
  # am start -W — 안드로이드가 잰 「화면이 뜨기까지」 시간 (TotalTime)
  adb shell am start -W -n $PKG/.MainActivity | tee -a "$OUT/am_start.txt"
  for k in $(seq 1 180); do
    if adb logcat -d | grep -q "DONE-ASCII n=$i"; then break; fi
    sleep 1
  done
done
adb logcat -d | grep "baetnil-perf" | sed 's/.*\[baetnil-perf\]/[baetnil-perf]/' | sed 's/" *-- From line.*//' > "$OUT/perf.txt"
adb logcat -d > "$OUT/logcat-all.txt"
cat "$OUT/perf.txt"; grep -E "TotalTime|WaitTime" "$OUT/am_start.txt"
adb shell am force-stop $PKG
exit 0
