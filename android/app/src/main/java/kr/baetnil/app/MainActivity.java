package kr.baetnil.app;

import android.os.Bundle;
import android.view.ViewGroup;
import android.webkit.WebView;
import androidx.core.graphics.Insets;
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

        // ★★★ 5.15 — 키보드가 입력칸을 가리던 것 (안드로이드 15 이상).
        //   앱이 안드로이드 16 기준(targetSdk 36)이라 화면을 가장자리까지 꽉 채워 그린다.
        //   그러면 키보드가 떠도 웹뷰가 줄지 않아, 아래쪽 칸(로그인 비밀번호 등)이 키보드 밑에 숨는다
        //   (에뮬레이터 검사에서 확인: 키보드가 떴는데 보이는 높이 915/924 그대로. Capacitor 이슈 #8166).
        //   키보드가 차지한 만큼만 웹뷰 아래를 비운다. 키보드가 없으면 0 — 5.14 모양 그대로다.
        // ★★★ 에뮬레이터 검사 6·7회째 — 머리줄 글씨가 시계·배터리 줄에 겹쳤다.
        //   이 여백 처리기를 웹뷰에 걸면 웹뷰가 스스로 받던 화면 가장자리 정보(시계 줄 높이 등)를 더는 못 받아서,
        //   웹 화면의 위쪽 여백(env(safe-area-inset-top))이 0 이 됐다. (8회째: 처리기를 안 걸면 49 로 제대로 나옴)
        //   그래서 여백만 정한 뒤 받은 정보를 웹뷰에게 그대로 넘겨준다(ViewCompat.onApplyWindowInsets).
        //   (Capacitor 7 은 기본값이 「disable」 이라 원래 웹뷰에 여백을 걸지 않는다 — 5.14 도 그랬다.)
        try {
            WebView wv = getBridge() != null ? getBridge().getWebView() : null;
            if (wv != null) {
                ViewCompat.setOnApplyWindowInsetsListener(wv, (v, insets) -> {
                    Insets ime = insets.getInsets(WindowInsetsCompat.Type.ime());
                    int bottom = Math.max(0, ime.bottom);
                    ViewGroup.LayoutParams lp = v.getLayoutParams();
                    if (lp instanceof ViewGroup.MarginLayoutParams) {
                        ViewGroup.MarginLayoutParams mlp = (ViewGroup.MarginLayoutParams) lp;
                        if (mlp.bottomMargin != bottom) {
                            mlp.bottomMargin = bottom;
                            v.setLayoutParams(mlp);
                        }
                    }
                    return ViewCompat.onApplyWindowInsets(v, insets);
                });
                ViewCompat.requestApplyInsets(wv);
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
