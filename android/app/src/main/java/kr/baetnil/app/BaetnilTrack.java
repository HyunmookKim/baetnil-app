package kr.baetnil.app;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;

/**
 * 뱃일 — 쌓아 둔 항적 점을 웹뷰가 가져가는 문 (5.3)
 *
 * ★ 자세한 까닭은 BaetnilTrackService 머리말에 있다.
 *   여기는 문 넷뿐이다 — start · drain · stop · status.
 *
 * ★ drain() 은 **가져가면서 비운다.** 두 번 가져가 같은 점이 두 번 담기지 않는다.
 *   가져간 것을 앱이 못 담고 죽으면 그 몇 점은 잃는다. 대신 파일이 한없이 자라지 않는다.
 *   (점은 어차피 30m 문에서 다시 걸러지므로, 몇 점을 잃어도 선은 이어진다)
 */
@CapacitorPlugin(name = "BaetnilTrack")
public class BaetnilTrack extends Plugin {

    private boolean noPermission() {
        Context c = getContext();
        return ContextCompat.checkSelfPermission(c, Manifest.permission.ACCESS_FINE_LOCATION)
                   != PackageManager.PERMISSION_GRANTED
            && ContextCompat.checkSelfPermission(c, Manifest.permission.ACCESS_COARSE_LOCATION)
                   != PackageManager.PERMISSION_GRANTED;
    }

    /** 위성 위치를 받을 수 없는 까닭. 받을 수 있으면 null */
    private String noSatellite() {
        Context c = getContext();
        try {
            if (!c.getPackageManager().hasSystemFeature(PackageManager.FEATURE_LOCATION_GPS)) return "no-gps";
        } catch (Exception ignored) {}
        if (ContextCompat.checkSelfPermission(c, Manifest.permission.ACCESS_FINE_LOCATION)
                != PackageManager.PERMISSION_GRANTED) return "coarse";
        try {
            android.location.LocationManager lm =
                (android.location.LocationManager) c.getSystemService(Context.LOCATION_SERVICE);
            if (lm == null) return "no-gps";
            if (!lm.getAllProviders().contains(android.location.LocationManager.GPS_PROVIDER)) return "no-gps";
            if (!lm.isProviderEnabled(android.location.LocationManager.GPS_PROVIDER)) return "gps-off";
        } catch (Exception ignored) {}
        return null;
    }

    /** 기록을 켠다 — 사람이 앱 안에서 [기록 시작] 을 눌렀을 때만 불린다 */
    @PluginMethod
    public void start(PluginCall call) {
        JSObject r = new JSObject();
        if (noPermission()) {
            // ★ 권한이 없으면 켜지 않는다. 켜 봐야 안드로이드가 곧 죽인다.
            r.put("started", false); r.put("why", "no-permission");
            call.resolve(r); return;
        }
        // ★★★ 5.32 — 위성 위치를 받을 수 없으면 켜지 않고 까닭을 돌려준다 (사장님 결정, 2026-10-02:
        //   「안된다고 안내해야지 그건 아예 원래 안되는거니까」). 앱이 사람 말로 바꿔 알려 준다.
        //   · no-gps  — 위성 위치 장치가 없는 기기 (안드로이드 공식: FEATURE_LOCATION_GPS)
        //   · coarse  — 「대략적인 위치」 만 허락됨. GPS_PROVIDER 는 정확한 위치 권한이 있어야 쓸 수 있다
        //   · gps-off — 위치 설정에서 GPS 공급원이 꺼져 있음
        String sat = noSatellite();
        if (sat != null) {
            r.put("started", false); r.put("why", sat);
            call.resolve(r); return;
        }
        try {
            Intent i = new Intent(getContext(), BaetnilTrackService.class);
            i.putExtra("title", call.getString("title", "항해 기록 중"));
            i.putExtra("text",  call.getString("text",  "항적을 기록하고 있습니다."));
            if (Build.VERSION.SDK_INT >= 26) ContextCompat.startForegroundService(getContext(), i);
            else getContext().startService(i);
            r.put("started", true);
        } catch (Exception e) {
            r.put("started", false); r.put("why", String.valueOf(e.getMessage()));
        }
        call.resolve(r);      // ★ 못 켜도 막지 않는다 — 부품 쪽 기록은 그대로 돈다
    }

    /** 쌓인 점을 통째로 가져가고 파일을 비운다 */
    @PluginMethod
    public void drain(PluginCall call) {
        JSObject r = new JSObject();
        JSArray out = new JSArray();
        int bad = 0;
        synchronized (BaetnilTrack.class) {
            File f = new File(getContext().getFilesDir(), BaetnilTrackService.FILE);
            if (f.exists()) {
                try {
                    FileInputStream in = new FileInputStream(f);
                    BufferedReader br = new BufferedReader(new InputStreamReader(in, StandardCharsets.UTF_8));
                    String line;
                    while ((line = br.readLine()) != null) {
                        line = line.trim();
                        if (line.length() < 2) continue;
                        try { out.put(new JSObject(new JSONObject(line).toString())); }
                        catch (Exception e) { bad++; }     // ★ 한 줄이 깨져도 나머지는 살린다
                    }
                    br.close(); in.close();
                } catch (Exception ignored) {}
                try { f.delete(); } catch (Exception ignored) {}
            }
        }
        r.put("pts", out);
        r.put("bad", bad);
        call.resolve(r);
    }

    /** 입항을 적었다 — 서비스를 내린다 */
    @PluginMethod
    public void stop(PluginCall call) {
        JSObject r = new JSObject();
        try {
            getContext().stopService(new Intent(getContext(), BaetnilTrackService.class));
            r.put("stopped", true);
        } catch (Exception e) {
            r.put("stopped", false); r.put("why", String.valueOf(e.getMessage()));
        }
        call.resolve(r);
    }

    /** 지금 돌고 있나 · 몇 바이트 쌓였나 (앱이 스스로 확인할 수 있어야 한다) */
    @PluginMethod
    public void status(PluginCall call) {
        JSObject r = new JSObject();
        r.put("running", BaetnilTrackService.isRunning());
        long n = 0;
        try {
            File f = new File(getContext().getFilesDir(), BaetnilTrackService.FILE);
            if (f.exists()) n = f.length();
        } catch (Exception ignored) {}
        r.put("bytes", n);
        call.resolve(r);
    }
}
