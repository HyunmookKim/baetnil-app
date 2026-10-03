package kr.baetnil.app;

import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebView;
import androidx.activity.EdgeToEdge;
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
        // ★★★ 5.33 — 시계 줄 글자 색. 안드로이드에서는 @capacitor/status-bar 를 빼고 이것을 쓴다 (BaetnilBars 머리말 참조).
        registerPlugin(BaetnilBars.class);
        // ★★★ 5.34 — 안드로이드 14 이하도 15 이상처럼 화면 끝까지 그린다 (플레이 콘솔 권장 「일부 사용자에게는 더 넓은 화면이
        //   표시되지 않을 수 있음」 — 「이전 버전과의 호환성을 위해 EdgeToEdge.enable() 을 호출하세요」).
        //   안드로이드 공식 안내(「Display content edge-to-edge」)도 모든 버전에서 enableEdgeToEdge 를 불러 버전마다 같게 보이게 하라고 한다.
        //   15 이상은 targetSdk 36 이라 이미 그렇게 그려진다 — 건드리지 않는다.
        //   ★ 5.22·5.23 에 비슷하게 해 봤다가 에뮬레이터 안드로이드 14 가 멈춰 되돌렸다. 5.33 에서 그 멈춤은 앱이 아니라
        //     에뮬레이터 소프트웨어 그리기(swiftshader) 탓으로 밝혀졌다(화면 높이가 바뀌면 굳음 → swangle 로 바꾸니 통과).
        //   ★ 화면을 다시 만들기 전(super.onCreate 앞)에 불러야 첫 화면부터 그렇게 그린다.
        if (Build.VERSION.SDK_INT < 35) {
            try { EdgeToEdge.enable(this); } catch (Exception ignored) {}
        }
        super.onCreate(savedInstanceState);

        // ★★★ 5.32 — 사진을 폰에 챙겨 두고 그것부터 쓴다 (BaetnilWebViewClient 머리말 참조).
        //   캐퍼시터가 쓰는 웹뷰 처리기를 이어받은 것이라, 앱 파일(localhost)은 예전 그대로 캐퍼시터가 준다.
        try {
            if (getBridge() != null) getBridge().setWebViewClient(new BaetnilWebViewClient(getBridge()));
        } catch (Exception ignored) {}

        // ★ 5.21~5.33 의 「14 이하는 시계 줄 아래부터 그림(시스템 UI 표시 지우기 + 시계 줄 바탕색)」 은 5.34 에서 뺐다 —
        //   위 EdgeToEdge.enable 로 15 이상과 같게 그린다. 키보드가 떠도 화면이 줄지 않아 아래 탭 줄이 따라 올라오지 않는다
        //   (사장님 5.16 결정: 「키보드 뜨면 그냥 화면 잘라지게 해야지. 밑에 화면을 위로 올리지 않는다」).

        // ★★★ 5.27 — 5.26 에서 넣었던 「안드로이드 11~14 는 키보드가 떠도 화면을 줄이지 않음(ADJUST_NOTHING)」 을 물린다.
        //   에뮬레이터 안드로이드 14 검사(#32, e23dac1)에서 키보드가 떴는데 키보드 높이가 0 으로 왔다 —
        //   14 이하는 시계 줄 아래부터 그리므로(위 5.21), 화면을 안 줄이게 하면 안드로이드가 키보드 높이를
        //   앱에 알려 주지 않는다. 그러면 누른 칸이 키보드에 가려진다. 탭 줄이 올라오는 것보다 나쁘다.
        //   → 화면은 예전처럼 줄게 두고, 탭 줄은 웹 화면이 감춘다(index.html kbdrs — 5.26 에서 넣은 것 그대로).

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
                // ★★★ 5.34 — 시계 줄 높이(위)·내비게이션 줄 높이(아래)를 웹 화면에 알려 준다(기기 픽셀).
                //   · 위 — 14 이하만. 15 이상은 웹뷰가 env(safe-area-inset-top) 로 알려 준다(5.15 검사: 위 여백 49).
                //     14 이하 웹뷰는 그 값을 0 으로 준다(5.20 에뮬레이터 안드로이드 14: 머리줄이 시계 줄에 겹침).
                //   · 아래 — 모든 판. 화면 끝까지 그리면 아래 탭 줄이 세 단추·제스처 막대 밑으로 들어간다.
                //     웹뷰가 env(safe-area-inset-bottom) 를 주는지는 웹뷰 판마다 달라 앱이 잰 값을 쓴다(웹은 --sabn).
                //   창 전체가 받은 여백(getRootWindowInsets)에서 읽는다 — 웹뷰를 담은 틀에는 0 으로 올 때가 있다(5.22 #25).
                final int[] lastBars = { -1, -1 };
                final Runnable sendBars = () -> {
                    try {
                        WindowInsetsCompat ri = ViewCompat.getRootWindowInsets(getWindow().getDecorView());
                        if (ri == null) return;
                        int top = ri.getInsets(WindowInsetsCompat.Type.statusBars()).top;
                        int bot = ri.getInsets(WindowInsetsCompat.Type.navigationBars()).bottom;
                        if (Build.VERSION.SDK_INT < 35 && top <= 0) {
                            int id = getResources().getIdentifier("status_bar_height", "dimen", "android");
                            if (id > 0) top = getResources().getDimensionPixelSize(id);
                        }
                        if (Build.VERSION.SDK_INT < 35 && top > 0 && top != lastBars[0]) {
                            lastBars[0] = top;
                            wv.evaluateJavascript("window.__sat&&window.__sat(" + top + ")", null);
                        }
                        if (bot >= 0 && bot != lastBars[1]) {
                            lastBars[1] = bot;
                            wv.evaluateJavascript("window.__sab&&window.__sab(" + bot + ")", null);
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
                    host.post(sendBars);
                    return insets;
                });
                ViewCompat.requestApplyInsets(host);
                // 웹 화면이 덜 읽혔을 때 보낸 값은 사라지므로 몇 번 더 보내고, 화면 파일을 다시 읽을 때마다 다시 보낸다.
                //   (같은 값은 웹에서 아무 일도 안 한다 — 다시 읽은 뒤에는 lastBars 를 비워 꼭 보낸다)
                host.postDelayed(sendBars, 1500);
                host.postDelayed(sendBars, 4000);
                getBridge().addWebViewListener(new WebViewListener() {
                    @Override
                    public void onPageLoaded(WebView webView) {
                        lastBars[0] = -1; lastBars[1] = -1;
                        host.post(sendBars);
                        host.postDelayed(sendBars, 800);
                    }
                });
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
