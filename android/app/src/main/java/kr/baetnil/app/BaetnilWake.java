package kr.baetnil.app;

import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * 뱃일 — 항해 기록 동안 CPU 를 깨워 두는 부품 (4.125)
 *
 * ★★★ 왜 이것이 필요한가 — 사장님이 겪으신 것
 *   「엔진 시동 걸고 화면을 꺼 놨는데 그 타이밍에 위치를 안 받는다」
 *
 * ★ 처음에는 「폰이 앱을 재운다」 고 보고 안내만 붙였다. 그것은 고친 것이 아니다.
 *   부품(@capacitor-community/background-geolocation 1.2.26) 소스를 열어 보고 알았다 —
 *
 *   · BackgroundGeolocationService 는 **웨이크락을 하나도 안 잡는다.**
 *   · 받은 자리는 쌓아 두지 않는다. 곧바로 웹뷰의 자바스크립트로 넘긴다
 *     (call.resolve → JS 콜백). 쌓아 두는 곳이 없다.
 *
 *   ★ 그래서 이렇게 된다 — 화면을 끄면 안드로이드가 웹뷰의 자바스크립트를 얼린다.
 *     전경 서비스는 살아 있고 GPS 도 돌지만, **넘겨받을 쪽이 자고 있어서
 *     그 자리들이 그대로 버려진다.** 알림이 떠 있어도 그렇다.
 *     사장님 항적이 14:10~14:30 사이에 비어 있던 것이 이것이다.
 *
 * ★ 달리기 기록 앱(스트라바·OsmAnd 따위)이 다 하는 그대로 한다 —
 *   기록하는 동안 **PARTIAL_WAKE_LOCK** 을 잡아 CPU 를 깨워 둔다. 화면은 그대로 꺼져 있다.
 *   ★ 값은 배터리다. 그래서 **출항부터 입항까지만** 잡고 바로 놓는다.
 */
@CapacitorPlugin(name = "BaetnilWake")
public class BaetnilWake extends Plugin {
    private PowerManager.WakeLock lock = null;

    private PowerManager pm() {
        return (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
    }

    /** 기록을 켤 때 — CPU 를 깨워 둔다 (화면은 꺼진 채로) */
    @PluginMethod
    public void keepAwake(PluginCall call) {
        JSObject r = new JSObject();
        try {
            if (lock == null) {
                lock = pm().newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "baetnil:track");
                // ★ 셈하지 않게 둔다. 두 번 잡았다가 한 번만 놓아 영영 안 풀리는 일을 막는다.
                lock.setReferenceCounted(false);
            }
            if (!lock.isHeld()) lock.acquire();
            r.put("held", lock.isHeld());
            call.resolve(r);
        } catch (Exception e) {
            r.put("held", false);
            r.put("why", String.valueOf(e.getMessage()));
            call.resolve(r);      // ★ 못 잡아도 기록은 이어져야 한다. 막지 않는다.
        }
    }

    /** 입항을 적을 때 — 놓아 준다. 안 놓으면 배터리를 계속 먹는다. */
    @PluginMethod
    public void letSleep(PluginCall call) {
        JSObject r = new JSObject();
        try {
            if (lock != null && lock.isHeld()) lock.release();
        } catch (Exception e) { /* 이미 풀린 것 — 그냥 둔다 */ }
        r.put("held", lock != null && lock.isHeld());
        call.resolve(r);
    }

    /** 지금 잡고 있나 — 앱이 스스로 확인할 수 있어야 한다 */
    @PluginMethod
    public void isHeld(PluginCall call) {
        JSObject r = new JSObject();
        r.put("held", lock != null && lock.isHeld());
        call.resolve(r);
    }

    /** 이 앱이 배터리 절전에서 빠져 있나 (삼성 「사용하지 않는 앱 절전」 따위) */
    @PluginMethod
    public void batteryFree(PluginCall call) {
        JSObject r = new JSObject();
        boolean free = true;
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                free = pm().isIgnoringBatteryOptimizations(getContext().getPackageName());
            }
        } catch (Exception e) { /* 못 물어보면 아는 척하지 않는다 */ }
        r.put("free", free);
        call.resolve(r);
    }

    /**
     * 배터리 절전 목록을 연다.
     * ★ 곧바로 묻는 창(ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)은 안 쓴다 —
     *   그건 구글이 따로 들여다보는 권한이라, 첫 심사에 쓸데없는 질문을 만든다.
     *   웨이크락을 잡고 있으면 절전은 두 번째 문제다. 목록을 열어 주는 것으로 충분하다.
     */
    @PluginMethod
    public void openBattery(PluginCall call) {
        try {
            Intent i = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
            call.resolve();
        } catch (Exception e) {
            try {
                Intent i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                i.setData(android.net.Uri.parse("package:" + getContext().getPackageName()));
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(i);
                call.resolve();
            } catch (Exception e2) { call.reject(String.valueOf(e2.getMessage())); }
        }
    }
}
