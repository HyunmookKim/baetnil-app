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
 * ★ 못 받으면(인터넷 없음·오류) 읽는 도중 오류가 나 사진이 실패로 끝난다 — 그 뒤는 예전 길(imgFromCache)이 그대로 받는다.
 * ★ 끝까지 받은 것만 파일로 남긴다(.part 로 받다가 다 받으면 이름을 바꾼다).
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
        InputStream in;
        if (f.exists() && f.length() > 0) {
            try { f.setLastModified(System.currentTimeMillis()); } catch (Exception ignored) {}
            in = new FileInputStream(f);
        } else {
            // ★ 여기서 다 받고 나서 돌려주면 안 된다 — 이 자리는 웹뷰가 모든 요청을 물어보는 곳이라,
            //   사진 한 장을 받는 동안 다른 요청까지 기다리게 될 수 있다.
            //   그래서 곧바로 돌려주고, 웹뷰가 읽어 갈 때 인터넷에서 받으면서 같은 내용을 파일에도 쓴다.
            in = new TeeStream(url, f, this);
        }
        Map<String, String> h = new HashMap<>();
        h.put("Access-Control-Allow-Origin", "*");          // fetch(mode:'cors') 로 챙기는 길(keepPhoto)도 받게
        h.put("Cache-Control", "public, max-age=31536000, immutable");
        String type = url.toLowerCase().contains(".png") ? "image/png" : "image/jpeg";
        return new WebResourceResponse(type, null, 200, "OK", h, in);
    }

    /** 읽는 쪽(웹뷰)이 읽을 때 인터넷에서 받고, 받은 것을 파일에도 쓴다. 끝까지 받았을 때만 파일로 남긴다. */
    static final class TeeStream extends InputStream {
        private final String url; private final File to; private final File part; private final BaetnilWebViewClient owner;
        private HttpURLConnection c; private InputStream src; private FileOutputStream out; private boolean done;
        TeeStream(String url, File to, BaetnilWebViewClient owner) {
            this.url = url; this.to = to; this.part = new File(to.getParentFile(), to.getName() + "." + System.nanoTime() + ".part");
            this.owner = owner;   // ↑ 이름에 시각을 넣는다 — 같은 사진을 동시에 받아도 서로 안 덮게
        }
        private void open() throws java.io.IOException {
            if (src != null) return;
            c = (HttpURLConnection) new URL(url).openConnection();
            c.setConnectTimeout(15000); c.setReadTimeout(30000); c.setInstanceFollowRedirects(true);
            int code = c.getResponseCode();
            if (code != 200) throw new java.io.IOException("HTTP " + code);
            src = c.getInputStream();
            try { out = new FileOutputStream(part); } catch (Exception e) { out = null; }
        }
        @Override public int read() throws java.io.IOException {
            byte[] b = new byte[1]; int n = read(b, 0, 1); return n <= 0 ? -1 : (b[0] & 0xff);
        }
        @Override public int read(byte[] b, int off, int len) throws java.io.IOException {
            try {
                open();
                int n = src.read(b, off, len);
                if (n > 0 && out != null) { try { out.write(b, off, n); } catch (Exception e) { dropPart(); } }
                if (n < 0) finish();
                return n;
            } catch (java.io.IOException e) { dropPart(); throw e; }
        }
        private void finish() {
            if (done) return; done = true;
            try { if (out != null) { out.close(); out = null; if (part.length() > 0 && part.renameTo(to)) owner.trim(); } } catch (Exception ignored) {}
            try { if (part.exists()) part.delete(); } catch (Exception ignored) {}
        }
        private void dropPart() {
            try { if (out != null) out.close(); } catch (Exception ignored) {}
            out = null;
            try { part.delete(); } catch (Exception ignored) {}
        }
        @Override public void close() throws java.io.IOException {
            // 끝까지 안 읽고 닫으면(화면을 넘김 등) 반쯤 받은 것은 버린다
            if (!done) dropPart();
            try { if (src != null) src.close(); } catch (Exception ignored) {}
            try { if (c != null) c.disconnect(); } catch (Exception ignored) {}
        }
    }

    /** 넘치면 오래 안 본 것부터 버린다 */
    synchronized void trim() {
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
