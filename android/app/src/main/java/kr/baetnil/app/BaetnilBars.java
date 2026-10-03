package kr.baetnil.app;

import android.graphics.Color;
import android.os.Build;
import android.view.Window;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * 뱃일 — 폰 맨 위 시계 줄 글자 색(안드로이드) (5.33, 2026-10-03)
 *
 * ★ 왜 — 플레이 콘솔 권장 조치 「앱에서 더 넓은 화면용으로 지원 중단된 API 또는 파라미터를 사용합니다」(5032):
 *   android.view.Window.getStatusBarColor / setStatusBarColor —
 *   시작 위치는 com.capacitorjs.plugins.statusbar.StatusBar.<init>·getInfo·setBackgroundColor·setOverlaysWebView.
 *   즉 시계 줄 부품(@capacitor/status-bar 7.0.6)이 켜질 때부터 안드로이드 15 에서 지원 중단된 API 를 부른다.
 *
 * ★ 다른 앱·캐퍼시터 쪽이 하는 것 — 캐퍼시터 관리자(jcesarmobile, capacitor-plugins #2517):
 *   「더 넓은 화면(edge-to-edge)을 쓰면 status bar 부품을 빼라. 캐퍼시터 8 의 SystemBars 는 setAppearance 를 쓴다」.
 *   status-bar 부품은 고쳐지지 않았다(14 이하용 바탕색 때문에 남겨 둠).
 *   → 안드로이드에서만 그 부품을 빼고(capacitor.config.json android.includePlugins),
 *     SystemBars 와 같은 길(WindowInsetsControllerCompat.setAppearanceLightStatusBars)로 글자 색만 바꾼다.
 *     아이폰은 status-bar 부품을 그대로 쓴다(애플은 이 문제와 상관없음).
 *
 * ★ 안드로이드 14 이하는 시계 줄이 제 바탕색을 따로 가진다(5.21 — MainActivity 참조). 흰 화면에서 짙은 글자로
 *   바꾸면 바탕도 흰색이어야 시계가 보인다. 그 바탕색은 14 이하에서만 칠한다(15 부터는 쓰이지 않는 값이고 지원 중단).
 */
@CapacitorPlugin(name = "BaetnilBars")
public class BaetnilBars extends Plugin {

    /** light: 흰 바탕 화면이면 true(짙은 글자) · color: 14 이하 시계 줄 바탕색(#RRGGBB) */
    @PluginMethod
    public void setStyle(PluginCall call) {
        final boolean light = Boolean.TRUE.equals(call.getBoolean("light", false));
        final String color = call.getString("color");
        if (getActivity() == null) { call.resolve(); return; }
        getActivity().runOnUiThread(() -> {
            try {
                Window w = getActivity().getWindow();
                WindowInsetsControllerCompat c = WindowCompat.getInsetsController(w, w.getDecorView());
                c.setAppearanceLightStatusBars(light);
                if (Build.VERSION.SDK_INT < 35 && color != null && !color.isEmpty()) {
                    w.setStatusBarColor(Color.parseColor(color));
                }
            } catch (Exception ignored) {}
            call.resolve();
        });
    }
}
