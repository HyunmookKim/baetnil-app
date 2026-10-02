package kr.baetnil.app;

import android.content.Context;
import android.net.Uri;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;

import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebViewClient;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;
import java.util.Map;

/**
 * 뱃일 — 사진을 폰에 챙겨 두고 그것부터 쓴다 (5.32, 2026-10-02)
 *
 * ★ 왜 — 사장님: 「사용자가 나 혼자였는데 135원 나온거면 어마어마하게 많이 나온건데 뭐지?」
 *   요금은 전부 사진 창고에서 사진을 받은 횟수(ReadObject)였다 — 하루 5천~1만4천 번.
 *   · 앱 안에서는 서비스워커를 끈다(index.html). 그래서 웹에서 하던 「한 번 받은 사진 챙겨 두기」 가 앱에서는 없었다.
 *   · 사진은 화면에 뜰 때마다 웹뷰가 인터넷에서 받았다. 4.82 이전 사진 1,900장은 「저장하지 마라」 설정이었다.
 *   · 안드로이드 웹뷰의 자체 저장 공간은 작다(크로미엄 개발자 모임: 디스크 20MB). 사진 백여 장이면 밀려난다.
 *
 * ★ 다른 앱이 하는 것 — 파이어베이스 공식 이미지 도구(FirebaseUI Storage + Glide)는 사진을 경로별로 폰 디스크에
 *   챙겨 두고 다시 볼 때 그것을 쓴다(Glide 기본 디스크 저장 250MB). 여기서도 그렇게 한다 —
 *   웹뷰가 사진 창고 주소를 부르면 가로채서, 폰에 있으면 그것을 주고, 없을 때만 한 번 받아 챙겨 둔다.
 *
 * ★ 사진 주소는 올릴 때마다 새로 짓는다(시각+난수, index.html __photos.put). 같은 주소가 다른 사진이 되는 일이
 *   없으므로 챙겨 둔 것을 다시 확인할 필요가 없다.
 * ★ 안 되면(인터넷 없음·오류) null 을 돌려 웹뷰에 맡긴다 — 그 뒤는 예전 길(imgFromCache)이 그대로 받는다.
 */
public class BaetnilWebViewClient extends BridgeWebViewClient {

    static final String HOST = "firebasestorage.googleapis.com";
    static final String BUCKET_PATH = "/v0/b/baetnil.firebasestorage.app/o/";
    static final String DIR = "baetnil_photos";
    static final long MAX_BYTES = 250L * 1024 * 1024;     // Glide 기본 디스크 저장 크기와 같다
    private final Context ctx;

    public BaetnilWebViewClient(Bridge bridge) {
        super(bridge);
        this.ctx = bridge.getContext().getApplicationContext();
    }

    @Override
    public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
        try {
            if (isPhoto(req)) {
                WebResourceResponse r = photo(req.getUrl().toString());
                if (r != null) return r;
            }
        } catch (Exception ignored) {}
        return super.shouldInterceptRequest(view, req);
    }

    static boolean isPhoto(WebResourceRequest req) {
        if (req == null || req.getUrl() == null) return false;
        if (!"GET".equalsIgnoreCase(req.getMethod())) return false;
        Uri u = req.getUrl();
        if (!"https".equals(u.getScheme()) || !HOST.equals(u.getHost())) return false;
        String p = u.getPath();
        if (p == null || !p.startsWith(BUCKET_PATH)) return false;
        return "media".equals(u.getQueryParameter("alt"));
    }

    private File dir() {
        File d = new File(ctx.getCacheDir(), DIR);
        if (!d.exists()) d.mkdirs();
        return d;
    }

    static String key(String url) throws Exception {
        MessageDigest md = MessageDigest.getInstance("SHA-1");
        byte[] h = md.digest(url.getBytes("UTF-8"));
        StringBuilder s = new StringBuilder(h.length * 2);
        for (byte b : h) s.append(String.format("%02x", b));
        return s.toString();
    }

    private WebResourceResponse photo(String url) throws Exception {
        File f = new File(dir(), key(url));
        if (!f.exists() || f.length() == 0) {
            if (!download(url, f)) return null;
            trim();
        } else {
            try { f.setLastModified(System.currentTimeMillis()); } catch (Exception ignored) {}
        }
        InputStream in = new FileInputStream(f);
        Map<String, String> h = new HashMap<>();
        h.put("Access-Control-Allow-Origin", "*");          // fetch(mode:'cors') 로 챙기는 길(keepPhoto)도 받게
        h.put("Cache-Control", "public, max-age=31536000, immutable");
        String type = url.toLowerCase().contains(".png") ? "image/png" : "image/jpeg";
        return new WebResourceResponse(type, null, 200, "OK", h, in);
    }

    /** 한 번 받아 챙겨 둔다. 다 받은 뒤에만 이름을 바꿔 넣는다 — 반쯤 받은 사진이 남지 않게. */
    static boolean download(String url, File to) {
        HttpURLConnection c = null;
        File tmp = new File(to.getParentFile(), to.getName() + ".part");
        try {
            c = (HttpURLConnection) new URL(url).openConnection();
            c.setConnectTimeout(15000);
            c.setReadTimeout(30000);
            c.setInstanceFollowRedirects(true);
            if (c.getResponseCode() != 200) return false;
            try (InputStream in = c.getInputStream(); FileOutputStream out = new FileOutputStream(tmp)) {
                byte[] buf = new byte[16384];
                int n;
                while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
            }
            if (tmp.length() == 0) { tmp.delete(); return false; }
            return tmp.renameTo(to);
        } catch (Exception e) {
            try { tmp.delete(); } catch (Exception ignored) {}
            return false;
        } finally {
            if (c != null) try { c.disconnect(); } catch (Exception ignored) {}
        }
    }

    /** 넘치면 오래 안 본 것부터 버린다 */
    private void trim() {
        try {
            File[] fs = dir().listFiles();
            if (fs == null) return;
            long sum = 0;
            for (File x : fs) sum += x.length();
            if (sum <= MAX_BYTES) return;
            Arrays.sort(fs, Comparator.comparingLong(File::lastModified));
            for (File x : fs) {
                if (sum <= MAX_BYTES * 9 / 10) break;
                sum -= x.length();
                x.delete();
            }
        } catch (Exception ignored) {}
    }
}
