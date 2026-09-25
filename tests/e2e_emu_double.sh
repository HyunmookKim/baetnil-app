#!/bin/bash
# 뱃일 — 안드로이드: 켜자마자 화면이 다시 만들어져도 앱이 한 벌만 도는가 (5.15)
#   켜고 곧바로 화면 밀도(글자·화면 크기 설정)를 바꿔 안드로이드가 화면을 새로 만들게 한다(설정 변경).
#   (4회째: 글자 크기만 바꿔서는 화면이 다시 안 만들어졌다 → 밀도를 바꾼다)
#   옛 웹뷰가 안 닫히면 검사 파일의 「OK 부팅」 이 두 번 찍힌다.
#   $1 APK · $2 결과 폴더
APK="$1"; OUT="$2"; PKG=kr.baetnil.app
mkdir -p "$OUT"
adb shell 'while [ "$(getprop sys.boot_completed)" != 1 ]; do sleep 1; done'
sleep 60
adb uninstall $PKG >/dev/null 2>&1 || true
adb install -r -g "$APK" >/dev/null
adb logcat -c
adb shell am start -n $PKG/.MainActivity >/dev/null
sleep 0.4
adb shell wm density 360
sleep 3
adb shell wm density reset
sleep 45
adb logcat -d > "$OUT/double-logcat.txt"
adb shell wm density reset
adb shell am force-stop $PKG
adb uninstall $PKG >/dev/null 2>&1 || true
STARTS=$(grep -c "Starting BridgeActivity" "$OUT/double-logcat.txt")
BOOTS=$(grep "Capacitor/Console" "$OUT/double-logcat.txt" | grep -c "baetnil-e2e\] OK 부팅")
ZERO=$(grep "Capacitor/Console" "$OUT/double-logcat.txt" | grep -c "baetnil-e2e\] INFO 폭")
echo "화면 새로 만든 수=$STARTS · 앱 부팅 줄=$BOOTS" | tee "$OUT/double.txt"
if [ "$STARTS" -lt 2 ]; then echo "INFO 화면이 다시 만들어지지 않아 이번에는 확인 못 함" | tee -a "$OUT/double.txt"; exit 0; fi
if [ "$BOOTS" -gt 1 ]; then echo "FAIL 앱이 두 벌 돎" | tee -a "$OUT/double.txt"; exit 1; fi
echo "OK 한 벌만 돎" | tee -a "$OUT/double.txt"; exit 0
