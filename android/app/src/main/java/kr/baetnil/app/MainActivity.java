package kr.baetnil.app;

import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebView;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

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

        // ★★★ 5.21 — 안드로이드 14 이하에서 머리줄이 시계·배터리 줄 밑으로 들어가던 것 (5.20 에서 생김).
        //   5.20 에 넣은 시계 줄 부품(@capacitor/status-bar)은 켜질 때 기본값으로 「웹 화면을 시계 줄 밑까지 깐다」
        //   (overlaysWebView 기본 true). 안드로이드 15 이상은 원래 그렇게 그리고 웹 화면이 시계 줄 높이만큼 비워 두지만,
        //   14 이하에서는 웹 화면이 그 높이를 모른다 → 머리줄이 시계 줄에 겹쳤다(에뮬레이터 안드로이드 14 검사: 위 여백 0).
        //   14 이하에서는 5.19 까지처럼 시계 줄 아래부터 그리게 되돌린다. 15 이상은 손대지 않는다.
        //   시계 줄 바탕색은 웹 화면이 테마에 맞춰 칠한다(index.html statusBar).
        // ★ 5.22·5.23 에서 14 이하도 15 이상처럼 시계 줄 밑까지 그리고(키보드가 탭 줄을 밀어 올리지 않게),
        //   시계 줄 높이를 웹에 알려 주는 방식(__sat)을 해 봤다. 머리줄은 맞았지만(위 여백 49) 에뮬레이터 안드로이드 14 에서
        //   네 번 중 세 번 검사 도중 화면이 멈췄다(#20·#25·#27, 사진 0바이트). 이 방식(5.21)은 두 번 모두 끝까지 갔다(#22·#24).
        //   그래서 5.21 방식으로 되돌린다. 14 이하에서 키보드가 뜨면 화면이 줄어 탭 줄이 키보드 위로 올라오는 것은
        //   5.16~5.19 와 같다(15 이상은 가려짐) — 사장님께 여쭘.
        if (Build.VERSION.SDK_INT < 35) {
            try {
                View d = getWindow().getDecorView();
                d.setSystemUiVisibility(d.getSystemUiVisibility()
                        & ~View.SYSTEM_UI_FLAG_LAYOUT_STABLE & ~View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);
                getWindow().setStatusBarColor(0xFF122A44);
            } catch (Exception ignored) {}
        }

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
                ViewCompat.setOnApplyWindowInsetsListener(host, (v, insets) -> {
                    boolean shown = insets.isVisible(WindowInsetsCompat.Type.ime());
                    int px = shown ? Math.max(0, insets.getInsets(WindowInsetsCompat.Type.ime()).bottom) : 0;
                    if (px != last[0]) {
                        last[0] = px;
                        try { wv.evaluateJavascript("window.__kbd&&window.__kbd(" + px + ")", null); } catch (Exception ignored) {}
                    }
                    return insets;
                });
                ViewCompat.requestApplyInsets(host);
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
