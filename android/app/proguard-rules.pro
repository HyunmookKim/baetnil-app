# 뱃일 — R8(코드 줄이기·이름 정리) 규칙 (5.33, 2026-10-03)
#
# ★ 플레이 콘솔 「DEX 코드 최적화가 기준점 미만입니다 · 난독화(3%)」 때문에 release 에서 R8 을 켰다(app/build.gradle).
# ★ 넓게 지키는 규칙(-keep class ** { *; } · -keep class com.getcapacitor.** 같은 것)은 넣지 않는다 —
#   그러면 줄이기·이름 정리가 거의 안 되어 플레이 기준(25%)을 못 넘는다(캡고 글).
# ★ 캐퍼시터 부품은 캐퍼시터가 넣어 주는 규칙이 지킨다:
#     -keep @com.getcapacitor.annotation.CapacitorPlugin public class * { @PluginMethod public <methods>; … }
#     -keep public class * extends com.getcapacitor.Plugin { *; }
#   웹뷰에서 부르는 @JavascriptInterface 는 proguard-android-optimize.txt 가 지킨다.
# ★ 앱 설정(AndroidManifest)에 적힌 화면·서비스(MainActivity·BaetnilTrackService)는 빌드 도구가 알아서 지킨다.

# 오류 보고에서 몇째 줄인지 보이게 (파일 이름은 감춘다)
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
