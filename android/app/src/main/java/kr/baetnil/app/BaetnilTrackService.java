package kr.baetnil.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.IBinder;
import android.os.PowerManager;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStreamWriter;
import java.nio.charset.StandardCharsets;

/**
 * 뱃일 — 항적 점을 **자바 쪽에 쌓아 두는 전경 서비스** (5.3)
 *
 * ★★★ 왜 이것을 만들었나 — 사장님 백업을 세어 보고 (2026-09-17)
 *
 *   점 190개를 하나씩 셌다. 결론은 하나였다 — **점이 안 들어온다.**
 *     8/28  137점 / 150분 = 시간당 55개 · 32초에 한 점   ← 화면을 켜 두셨던 날
 *     9/14   21점 /  85분 = 시간당 15개
 *     9/15    7점 / 123분 = 시간당  3개 · 한 번은 70분 동안 한 점도 없음
 *     9/17    7점 /  41분 = 시간당 10개
 *   살아남은 점의 정확도는 절반이 5m 안이다. **우리 거르개가 버린 것이 아니다.**
 *   그리고 14분 빈 뒤 다음 점이 **20초** 만에 들어온다 — 위성은 잡혀 있었고
 *   **앱이 자고 있었다**는 자국이다.
 *
 * ★ 까닭 — 뱃일은 캐퍼시터 앱이다. 겉은 자바, 화면은 웹뷰다.
 *   여태 쓰던 위치 부품(@capacitor-community/background-geolocation)은
 *   받은 자리를 **쌓아 두지 않고 곧바로 웹뷰의 자바스크립트로 넘긴다.**
 *   화면을 끄면 안드로이드가 그 웹뷰를 얼린다. 자바는 살아 있고 GPS 도 도는데
 *   **받을 쪽이 자고 있어서 그 점들이 그대로 버려진다.**
 *   4.125 의 웨이크락으로 반쯤 막았지만, 웹뷰는 웨이크락과 따로 얼 수 있다.
 *
 * ★ 그래서 이 서비스는 **웹뷰를 거치지 않는다.**
 *   위치를 받는 즉시 앱 안쪽 파일에 한 줄씩 적어 둔다. 웹뷰가 자고 있어도 쌓인다.
 *   웹뷰가 깨면 drain() 으로 통째로 가져가고 파일을 비운다.
 *
 * ★ 부품은 그대로 둔다 — 깨어 있는 동안은 그쪽이 곧바로 그려 주는 편이 낫다.
 *   같은 자리가 두 번 들어와도 앱의 30m 문에서 걸러지므로 겹치지 않는다.
 *
 * ★ 구글 심사가 필요한 권한은 하나도 안 쓴다 (ACCESS_BACKGROUND_LOCATION 없음).
 *   사람이 앱 안에서 [기록 시작] 을 눌러야만 켜지는 location 유형 전경 서비스다.
 */
public class BaetnilTrackService extends Service implements LocationListener {

    public static final String FILE = "baetnil-track.ndjson";
    public static final String CH_ID = "baetnil-track";
    private static final int NOTI_ID = 4125;

    /** 파일이 한없이 자라지 않게 — 한 줄 100바이트쯤이니 2만 줄이면 2MB 안쪽이다 */
    private static final long MAX_BYTES = 4L * 1024 * 1024;

    /** GPS 에게 몇 밀리초마다 달라고 할 것인가. 0m 로 두고 우리가 고른다. */
    private static final long ASK_MS = 2000L;

    private LocationManager lm = null;
    private PowerManager.WakeLock lock = null;
    private static volatile boolean running = false;

    public static boolean isRunning() { return running; }

    @Override public IBinder onBind(Intent i) { return null; }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String title = (intent != null && intent.getStringExtra("title") != null)
                     ? intent.getStringExtra("title") : "항해 기록 중";
        String text  = (intent != null && intent.getStringExtra("text") != null)
                     ? intent.getStringExtra("text") : "항적을 기록하고 있습니다.";
        try { startForeground(NOTI_ID, buildNoti(title, text), typeFlag()); }
        catch (Exception e) {
            // ★ 전경으로 못 올라가면 서비스가 곧 죽는다. 조용히 죽지 않고 스스로 멈춘다.
            stopSelf(); return START_NOT_STICKY;
        }
        keepAwake();
        askLocations();
        running = true;
        // ★ START_STICKY — 안드로이드가 메모리 때문에 죽여도 다시 살린다.
        return START_STICKY;
    }

    private int typeFlag() {
        if (Build.VERSION.SDK_INT >= 29) return ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION;
        return 0;
    }

    private Notification buildNoti(String title, String text) {
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26 && nm != null) {
            NotificationChannel ch = new NotificationChannel(CH_ID, "항해 기록", NotificationManager.IMPORTANCE_LOW);
            ch.setShowBadge(false);
            nm.createNotificationChannel(ch);
        }
        PendingIntent open = null;
        try {
            Intent i = getPackageManager().getLaunchIntentForPackage(getPackageName());
            if (i != null) {
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                int f = (Build.VERSION.SDK_INT >= 23)
                      ? (PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE)
                      : PendingIntent.FLAG_UPDATE_CURRENT;
                open = PendingIntent.getActivity(this, 0, i, f);
            }
        } catch (Exception ignored) {}
        Notification.Builder b = (Build.VERSION.SDK_INT >= 26)
                ? new Notification.Builder(this, CH_ID) : new Notification.Builder(this);
        b.setContentTitle(title)
         .setContentText(text)
         .setSmallIcon(android.R.drawable.ic_menu_mylocation)
         .setOngoing(true)
         .setOnlyAlertOnce(true);
        if (open != null) b.setContentIntent(open);
        return b.build();
    }

    /** 기록하는 동안만 CPU 를 깨워 둔다. 화면은 꺼진 채다. */
    private void keepAwake() {
        try {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm == null) return;
            if (lock == null) {
                lock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "baetnil:trksvc");
                lock.setReferenceCounted(false);
            }
            if (!lock.isHeld()) lock.acquire();
        } catch (Exception ignored) {}
    }

    private void askLocations() {
        try {
            lm = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
            if (lm == null) return;
            // ★ 5.10 — GPS 로 잡은 위치만 받는다.
            //   예전에는 예비로 기지국·와이파이 위치(NETWORK_PROVIDER)도 받았는데,
            //   그 위치는 수백 m~수 km 씩 틀려서 항적에 이상한 위치가 섞이는 원인이었다.
            //   OsmAnd 도 항적이 흔들리면 위치 공급원을 GPS(Android API)로 바꾸라고 안내한다.
            try { lm.requestLocationUpdates(LocationManager.GPS_PROVIDER, ASK_MS, 0f, this); }
            catch (Exception ignored) {}
        } catch (Exception ignored) {}
    }

    @Override
    public void onLocationChanged(Location l) {
        if (l == null) return;
        append(line(l));
    }

    // 옛 안드로이드가 찾는 빈 문들 (없으면 기기에 따라 터진다)
    @Override public void onProviderEnabled(String p) {}
    @Override public void onProviderDisabled(String p) {}
    public void onStatusChanged(String p, int s, Bundle e) {}

    private String line(Location l) {
        StringBuilder s = new StringBuilder(128);
        s.append("{\"t\":").append(l.getTime())
         .append(",\"la\":").append(l.getLatitude())
         .append(",\"lo\":").append(l.getLongitude());
        if (l.hasAccuracy()) s.append(",\"ac\":").append(l.getAccuracy());
        if (l.hasSpeed())    s.append(",\"sp\":").append(l.getSpeed());
        if (l.hasBearing())  s.append(",\"br\":").append(l.getBearing());
        s.append(",\"pv\":\"").append(l.getProvider() == null ? "" : l.getProvider()).append("\"");
        if (Build.VERSION.SDK_INT >= 31) {
            try { if (l.isMock()) s.append(",\"mk\":1"); } catch (Exception ignored) {}
        }
        s.append("}\n");
        return s.toString();
    }

    /** 한 줄 덧붙이기. 웹뷰가 자고 있어도 여기는 돈다. */
    private synchronized void append(String s) {
        try {
            File f = new File(getFilesDir(), FILE);
            if (f.exists() && f.length() > MAX_BYTES) {
                // ★ 넘치면 통째로 버리지 않는다 — 뒤쪽(최근)만 남긴다.
                //   여기서 다 지우면 지나온 길이 통째로 사라진다.
                trimHalf(f);
            }
            FileOutputStream o = new FileOutputStream(f, true);
            OutputStreamWriter w = new OutputStreamWriter(o, StandardCharsets.UTF_8);
            w.write(s); w.flush(); w.close(); o.close();
        } catch (Exception ignored) {}
    }

    private void trimHalf(File f) {
        try {
            byte[] all = new byte[(int) f.length()];
            java.io.FileInputStream in = new java.io.FileInputStream(f);
            int read = in.read(all); in.close();
            if (read <= 0) return;
            int half = read / 2;
            while (half < read && all[half] != '\n') half++;   // 줄 가운데서 자르지 않는다
            if (half >= read) return;
            FileOutputStream o = new FileOutputStream(f, false);
            o.write(all, half + 1, read - half - 1);
            o.flush(); o.close();
        } catch (Exception ignored) {}
    }

    @Override
    public void onDestroy() {
        running = false;
        try { if (lm != null) lm.removeUpdates(this); } catch (Exception ignored) {}
        try { if (lock != null && lock.isHeld()) lock.release(); } catch (Exception ignored) {}
        super.onDestroy();
    }
}
