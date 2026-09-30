package kr.baetnil.app;

import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebView;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // ★★★ 4.125 — 항해 기록 동안 CPU 를 깨워 두는 부품을 등록한다.
        //   ★ 반드시 super.onCreate 앞이다. 뒤에 두면 등록되기 전에 웹뷰가 떠서
        //     자바스크립트가 「그런 부품 없다」 를 보게 된다.
        registerPlugin(BaetnilWake.class);
        // ★★★ 5.3 — 항적 점을 자바 쪽에 쌓아 두는 부품 (BaetnilTrackService 머리말 참조).
        //   화면을 꺼서 웹뷰가 얼어도 점이 파일에 쌓이고, 깨어나면 통째로 가져간다.
        registerPlugin(BaetnilTrack.class);
        super.onCreate(savedInstanceState);

        // ★★★ 5.16 — 키보드가 뜨면 화면은 그대로 두고, 누른 칸만 스크롤로 키보드 위에 올린다.
        //   아이폰 앱·아이폰 사파리·안드로이드 크롬(108 부터)이 모두 이렇게 한다.
        //   키보드가 화면 아래를 덮고, 아래 탭 줄은 키보드에 가려진다.
        //   ★ 5.15 에서는 웹뷰를 키보드만큼 줄였다 → 아래 탭 줄이 키보드 위로 따라 올라왔다(사장님 지적). 그 방식은 버린다.
        //   안드로이드 15 이상(targetSdk 36)은 시스템이 칸을 올려 주지 않으므로(Capacitor 이슈 #8166),
        //   여기서는 키보드 높이만 재서 웹 화면에 알려 주고(__kbd), 스크롤은 웹 화면이 한다(index.html 끝).
        // ★ 처리기는 웹뷰가 아니라 웹뷰를 담은 바깥 틀에 건다 — 웹뷰에 걸면 웹뷰가 스스로 받던
        //   시계 줄 높이 정보가 막혀 머리줄이 시계 줄에 겹친다(에뮬레이터 검사 10회째: 위 여백 0).
        //   받은 정보는 손대지 않고 그대로 안쪽(웹뷰)으로 흘려보낸다.
        try {
            final WebView wv = getBridge() != null ? getBridge().getWebView() : null;
            final View host = (wv != null && wv.getParent() instanceof View) ? (View) wv.getParent() : null;
            if (wv != null && host != null) {
                final int[] last = { -1 };
                // ★★★ 5.22 — 안드로이드 14 이하도 15 이상과 똑같이 그린다 (시계 줄 밑까지, 키보드는 화면을 줄이지 않고 덮음).
                //   5.20 에 넣은 시계 줄 부품이 켜질 때 웹 화면을 시계 줄 밑까지 깐다(overlaysWebView 기본 true).
                //   15 이상은 원래 그렇고, 웹뷰가 시계 줄 높이를 env(safe-area-inset-top) 로 알려 준다.
                //   14 이하는 웹뷰가 그 높이를 0 으로 알려 줘서 머리줄이 시계 줄에 겹쳤다(에뮬레이터 안드로이드 14, 5.20).
                //   ★ 5.21 에서는 14 이하만 5.19 처럼 시계 줄 아래부터 그리게 되돌렸는데, 그러면 키보드가 뜰 때
                //     화면이 줄어 아래 탭 줄이 키보드 위로 올라온다 — 사장님이 5.16 에서 정하신 것
                //     (「키보드 뜨면 그냥 화면 잘라지게 해야지. 밑에 화면을 위로 올리지 않는다」)과 어긋난다(에뮬레이터 #22·#24).
                //   그래서 14 이하도 15 이상처럼 그리고, 시계 줄 높이만 여기서 재서 웹 화면에 알려 준다(__sat).
                //   안드로이드 공식 안내도 모든 버전에서 화면 끝까지 그려 버전마다 같게 보이게 하라고 한다(enableEdgeToEdge).
                final int[] lastSat = { -1 };
                // 시계 줄 높이 — 창 전체가 받은 여백에서 읽고, 없으면 시스템 값(status_bar_height)을 쓴다.
                //   (웹뷰를 담은 틀에는 0 으로 올 때가 있다 — 에뮬레이터 안드로이드 14 #25: 머리줄 위 여백 0)
                final Runnable sendSat = () -> {
                    try {
                        int sat = 0;
                        WindowInsetsCompat ri = ViewCompat.getRootWindowInsets(getWindow().getDecorView());
                        if (ri != null) sat = ri.getInsets(WindowInsetsCompat.Type.statusBars()).top;
                        if (sat <= 0) {
                            int id = getResources().getIdentifier("status_bar_height", "dimen", "android");
                            if (id > 0) sat = getResources().getDimensionPixelSize(id);
                        }
                        if (sat > 0) {
                            lastSat[0] = sat;
                            wv.evaluateJavascript("window.__sat&&window.__sat(" + sat + ")", null);
                        }
                    } catch (Exception ignored) {}
                };
                ViewCompat.setOnApplyWindowInsetsListener(host, (v, insets) -> {
                    boolean shown = insets.isVisible(WindowInsetsCompat.Type.ime());
                    int px = shown ? Math.max(0, insets.getInsets(WindowInsetsCompat.Type.ime()).bottom) : 0;
                    if (px != last[0]) {
                        last[0] = px;
                        try { wv.evaluateJavascript("window.__kbd&&window.__kbd(" + px + ")", null); } catch (Exception ignored) {}
                    }
                    if (Build.VERSION.SDK_INT < 35) host.post(sendSat);
                    return insets;
                });
                ViewCompat.requestApplyInsets(host);
                // 웹 화면이 아직 덜 읽혔을 때 보낸 값은 사라지므로 몇 번 더 보낸다(같은 값이면 웹에서 아무 일도 안 난다).
                if (Build.VERSION.SDK_INT < 35) {
                    host.postDelayed(sendSat, 1500);
                    host.postDelayed(sendSat, 4000);
                    host.postDelayed(sendSat, 9000);
                    // 화면 파일을 다시 읽으면(새로 고침) 웹에 넣은 값이 사라지므로, 다 읽을 때마다 다시 보낸다
                    //   (에뮬레이터 안드로이드 14 #26: 키보드가 뜨기 전까지 머리줄 위 여백 0).
                    getBridge().addWebViewListener(new WebViewListener() {
                        @Override
                        public void onPageLoaded(WebView webView) {
                            host.post(sendSat);
                            host.postDelayed(sendSat, 800);
                        }
                    });
                }
            }
        } catch (Exception ignored) {}
    }

    // ★★★ 5.15 — 화면이 다시 만들어질 때 옛 웹뷰를 확실히 닫는다.
    //   안드로이드가 설정 변경(테마·글자 크기 등)으로 화면을 새로 만들 때, 화면이 채 붙기도 전에 닫히면
    //   Capacitor 는 옛 웹뷰를 닫지 않는다(창에서 떨어질 때만 닫는다). 그러면 옛 앱이 안 보이는 채로
    //   계속 돌아 앱이 두 벌이 된다 — 에뮬레이터 검사 2회째에서 모든 줄이 두 번씩, 한쪽은 폭 0 으로 찍혔다.
    //   두 벌이면 항적·저장·서버 연결이 두 번씩 일어날 수 있다.
    @Override
    public void onDestroy() {
        WebView wv = null;
        try { wv = getBridge() != null ? getBridge().getWebView() : null; } catch (Exception ignored) {}
        super.onDestroy();
        if (wv != null) {
            try {
                wv.stopLoading();
                wv.loadUrl("about:blank");
                if (wv.getParent() instanceof ViewGroup) ((ViewGroup) wv.getParent()).removeView(wv);
                wv.removeAllViews();
                wv.destroy();
            } catch (Exception ignored) {}
        }
    }
}
