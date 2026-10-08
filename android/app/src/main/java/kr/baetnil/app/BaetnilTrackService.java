package kr.baetnil.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.AlarmManager;
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
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.os.SystemClock;

import androidx.core.content.ContextCompat;

import com.google.android.gms.location.ActivityRecognition;
import com.google.android.gms.location.ActivityTransition;
import com.google.android.gms.location.ActivityTransitionRequest;
import com.google.android.gms.location.DetectedActivity;

import java.util.ArrayList;
import java.util.List;

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
 * ★ 5.38 — 이 서비스가 돌면 부품(background-geolocation)은 권한만 받고 내린다(위치를 받는 곳을 하나로).
 *   화면이 보이는 동안은 앱이 5초마다 drain() 으로 가져가 그린다.
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

    /** GPS 에게 몇 밀리초마다 달라고 할 것인가. 0m 로 두고 우리가 고른다.
     *  ★ 5.38 — 2초 → 5초. 앱이 5초마다 남기므로(OsmAnd) 받는 것도 맞춘다. SeaPeople 도 「5초마다 위치를 받는다」. */
    private static final long ASK_MS = 5000L;
    // ★ 5.40 — 기록 간격을 사람이 정한다(설정 › 항적 › 기록 간격, OsmAnd 값 1초~5분). 위 5초는 기본값.
    //   안드로이드가 앱을 다시 살리면(START_STICKY) 인텐트가 비어 온다 — 그때는 마지막에 받은 값을 쓴다.
    private static final long ASK_MS_MIN = 1000L, ASK_MS_MAX = 300000L;
    private static volatile long askMs = ASK_MS;

    // ══════════════════════════════════════════════════════════════════
    // ★★★ 5.38 — 배가 멈춰 있으면 위성을 끈다 (Traccar 방식 · 사장님 승인 2026-10-05 「그래」)
    //   배터리를 실제로 아끼는 방법은 위성을 끄는 것뿐이다(GPSLogger 안내). 위성이 켜져 있으면
    //   2초든 5초든 배터리 차이가 크지 않다.
    //   Traccar(traccar-client-sdk): 폰이 「가만히 있음(STILL)」 을 알리고 60초가 지나면 위치 받기를 끄고,
    //   움직임이 감지되거나 100m 를 벗어나면 다시 켠다. 웨이크락도 쉬는 동안은 놓는다.
    //   ★ 100m 를 벗어나는지는 Traccar 가 지오펜스로 보는데, 안드로이드 공식 문서가 지오펜스에
    //     ACCESS_BACKGROUND_LOCATION 을 요구한다(뱃일은 구글 심사 때문에 이 권한을 안 쓴다 — 4.130).
    //     그래서 Traccar 의 다른 장치인 「쉬는 동안 한 번씩 위치 확인(heartbeat)」 으로 100m 를 본다.
    //     간격 60초 = Traccar heartbeat 의 최소값 · GPSLogger 기본 간격.
    //   ★ 「신체 활동」 권한이 없으면 Traccar 처럼 멈춤 감지를 건너뛴다 — 예전처럼 늘 받는다.
    // ══════════════════════════════════════════════════════════════════
    public static final String ACT_MOTION = "kr.baetnil.app.TRK_MOTION";
    public static final String ACT_BEAT   = "kr.baetnil.app.TRK_BEAT";
    private static final long STOP_TIMEOUT_MS = 60000L;     // Traccar stopTimeoutSeconds 60
    private static final float STATIONARY_M   = 100f;       // Traccar stationaryRadiusMeters 100
    private static final long BEAT_MS         = 60000L;     // Traccar heartbeat 최소 60초 · GPSLogger 기본 60초
    private static final long BEAT_FIX_MS     = 30000L;     // Traccar fetchOnce — 30초 안에 위치 하나

    private static volatile BaetnilTrackService self = null;
    private final Handler h = new Handler(Looper.getMainLooper());
    private volatile boolean paused = false;
    private Location last = null;          // 마지막으로 받은 위치
    private Location anchor = null;        // 멈춘 자리
    private boolean motionOn = false;
    private PendingIntent motionPi = null;
    private PendingIntent beatPi = null;
    private PowerManager.WakeLock beatLock = null;
    private LocationListener beatL = null;
    private static volatile int pauses = 0;
    private static volatile long pausedMs = 0L, pausedAt = 0L;

    public static boolean isPaused() { return self != null && self.paused; }
    public static int pauseCount() { return pauses; }
    public static long pausedTotalMs() { return pausedMs + (pausedAt > 0 ? SystemClock.elapsedRealtime() - pausedAt : 0); }

    private LocationManager lm = null;
    private PowerManager.WakeLock lock = null;
    private static volatile boolean running = false;

    public static boolean isRunning() { return running; }

    @Override public IBinder onBind(Intent i) { return null; }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String title = (intent != null && intent.getStringExtra("title") != null)
                     ? intent.getStringExtra("title") : getString(R.string.trk_noti_title);
        String text  = (intent != null && intent.getStringExtra("text") != null)
                     ? intent.getStringExtra("text") : getString(R.string.trk_noti_text);
        try { startForeground(NOTI_ID, buildNoti(title, text), typeFlag()); }
        catch (Exception e) {
            // ★ 전경으로 못 올라가면 서비스가 곧 죽는다. 조용히 죽지 않고 스스로 멈춘다.
            stopSelf(); return START_NOT_STICKY;
        }
        if (!running) { pauses = 0; pausedMs = 0L; pausedAt = 0L; }   // 새 기록이면 쉰 횟수·시간을 새로 센다
        if (intent != null && intent.hasExtra("ms")) {
            long ms = intent.getLongExtra("ms", ASK_MS);
            askMs = Math.max(ASK_MS_MIN, Math.min(ASK_MS_MAX, ms));
        }
        self = this;
        // ★ 5.40 — 기록 도중에 간격을 바꾸면 다시 불린다. 쉬는 중이면 위성을 켜지 않는다(다시 켤 때 새 간격으로).
        if (!paused) { keepAwake(); askLocations(); }
        motionStart();
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
            NotificationChannel ch = new NotificationChannel(CH_ID,
                    // ★ 5.45 — 폰 설정 › 알림에 나오는 이름. 한국어로 박혀 있어 외국 폰에도 「항해 기록」 이 떴다
                    getString(R.string.capacitor_background_geolocation_notification_channel_name),
                    NotificationManager.IMPORTANCE_LOW);
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
            // 같은 받는 곳으로 다시 부르면 앞의 요청을 새 간격으로 바꾼다 (안드로이드 LocationManager)
            try { lm.requestLocationUpdates(LocationManager.GPS_PROVIDER, askMs, 0f, this); }
            catch (Exception ignored) {}
        } catch (Exception ignored) {}
    }

    @Override
    public void onLocationChanged(Location l) {
        if (l == null) return;
        last = l;
        append(line(l));
    }

    // ── 멈춤 감지 (Traccar ActivityRecognitionDetector 와 같은 꼴) ──
    private boolean motionAllowed() {
        if (Build.VERSION.SDK_INT >= 29) {
            return ContextCompat.checkSelfPermission(this, android.Manifest.permission.ACTIVITY_RECOGNITION)
                   == android.content.pm.PackageManager.PERMISSION_GRANTED;
        }
        return true;   // 안드로이드 9 이하는 설치할 때 받는 권한이다
    }

    private PendingIntent pi(String action, int code) {
        Intent i = new Intent(this, BaetnilMotionReceiver.class).setAction(action);
        int f = PendingIntent.FLAG_UPDATE_CURRENT;
        // ★ 활동 인식 결과는 구글 서비스가 인텐트에 붙여 넣는다 — 안드로이드 12+ 는 MUTABLE 이어야 받는다
        if (Build.VERSION.SDK_INT >= 31) f |= (ACT_MOTION.equals(action) ? PendingIntent.FLAG_MUTABLE : PendingIntent.FLAG_IMMUTABLE);
        else if (Build.VERSION.SDK_INT >= 23 && !ACT_MOTION.equals(action)) f |= PendingIntent.FLAG_IMMUTABLE;
        return PendingIntent.getBroadcast(this, code, i, f);
    }

    private void motionStart() {
        if (motionOn || !motionAllowed()) return;
        try {
            List<ActivityTransition> ts = new ArrayList<>();
            int[] kinds = { DetectedActivity.STILL, DetectedActivity.IN_VEHICLE, DetectedActivity.ON_BICYCLE,
                            DetectedActivity.RUNNING, DetectedActivity.WALKING };
            for (int k : kinds) {
                ts.add(new ActivityTransition.Builder().setActivityType(k)
                        .setActivityTransition(ActivityTransition.ACTIVITY_TRANSITION_ENTER).build());
                ts.add(new ActivityTransition.Builder().setActivityType(k)
                        .setActivityTransition(ActivityTransition.ACTIVITY_TRANSITION_EXIT).build());
            }
            motionPi = pi(ACT_MOTION, 7101);
            ActivityRecognition.getClient(this)
                .requestActivityTransitionUpdates(new ActivityTransitionRequest(ts), motionPi);
            motionOn = true;
        } catch (Exception | Error ignored) { motionOn = false; }
    }

    private void motionStop() {
        try { if (motionPi != null) ActivityRecognition.getClient(this).removeActivityTransitionUpdates(motionPi); }
        catch (Exception | Error ignored) {}
        motionOn = false;
    }

    private final Runnable goStill = new Runnable() { public void run() { pause(); } };

    /** 리시버가 부른다 — still=true 면 가만히 있음에 들어갔다, false 면 움직이기 시작했다 */
    static void onMotion(boolean still) {
        final BaetnilTrackService s = self;
        if (s == null) return;
        s.h.post(new Runnable() { public void run() {
            if (still) {
                if (!s.paused) { s.h.removeCallbacks(s.goStill); s.h.postDelayed(s.goStill, STOP_TIMEOUT_MS); }
            } else {
                s.h.removeCallbacks(s.goStill);
                if (s.paused) s.resume();
            }
        }});
    }

    static void onBeat() {
        final BaetnilTrackService s = self;
        if (s == null) return;
        s.h.post(new Runnable() { public void run() { s.beat(); } });
    }

    private void pause() {
        if (paused || !running) return;
        paused = true; pauses++; pausedAt = SystemClock.elapsedRealtime();
        anchor = last;
        try { if (lm != null) lm.removeUpdates(this); } catch (Exception ignored) {}
        try { if (lock != null && lock.isHeld()) lock.release(); } catch (Exception ignored) {}   // Traccar: 쉬는 동안은 웨이크락을 놓는다
        beatLater();
    }

    private void resume() {
        if (!paused) return;
        paused = false;
        if (pausedAt > 0) { pausedMs += SystemClock.elapsedRealtime() - pausedAt; pausedAt = 0L; }
        beatCancel();
        beatEnd();
        keepAwake();
        askLocations();
    }

    private void beatLater() {
        try {
            AlarmManager am = (AlarmManager) getSystemService(Context.ALARM_SERVICE);
            if (am == null) return;
            beatPi = pi(ACT_BEAT, 7102);
            long at = SystemClock.elapsedRealtime() + BEAT_MS;
            if (Build.VERSION.SDK_INT >= 23) am.setAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, at, beatPi);
            else am.set(AlarmManager.ELAPSED_REALTIME_WAKEUP, at, beatPi);
        } catch (Exception ignored) {}
    }

    private void beatCancel() {
        try {
            AlarmManager am = (AlarmManager) getSystemService(Context.ALARM_SERVICE);
            if (am != null && beatPi != null) am.cancel(beatPi);
        } catch (Exception ignored) {}
    }

    private final Runnable beatTimeout = new Runnable() { public void run() { beatEnd(); if (paused) beatLater(); } };

    /** 쉬는 동안 한 번 위치를 받아 본다 — 100m 를 벗어났으면 다시 켠다 */
    private void beat() {
        if (!paused || lm == null) return;
        try {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                if (beatLock == null) { beatLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "baetnil:trkbeat"); beatLock.setReferenceCounted(false); }
                beatLock.acquire(BEAT_FIX_MS + 5000L);
            }
        } catch (Exception ignored) {}
        beatL = new LocationListener() {
            @Override public void onLocationChanged(Location l) {
                if (l == null) return;
                last = l;
                append(line(l));
                boolean moved = anchor == null || l.distanceTo(anchor) > STATIONARY_M;
                h.removeCallbacks(beatTimeout);
                beatEnd();
                if (moved) resume(); else beatLater();
            }
            @Override public void onProviderEnabled(String p) {}
            @Override public void onProviderDisabled(String p) {}
            public void onStatusChanged(String p, int st, Bundle e) {}
        };
        try { lm.requestLocationUpdates(LocationManager.GPS_PROVIDER, 1000L, 0f, beatL, Looper.getMainLooper()); }
        catch (Exception e) { beatEnd(); beatLater(); return; }
        h.postDelayed(beatTimeout, BEAT_FIX_MS);
    }

    private void beatEnd() {
        try { if (lm != null && beatL != null) lm.removeUpdates(beatL); } catch (Exception ignored) {}
        beatL = null;
        try { if (beatLock != null && beatLock.isHeld()) beatLock.release(); } catch (Exception ignored) {}
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
        h.removeCallbacks(goStill);
        h.removeCallbacks(beatTimeout);
        beatCancel();
        beatEnd();
        motionStop();
        if (pausedAt > 0) { pausedMs += SystemClock.elapsedRealtime() - pausedAt; pausedAt = 0L; }
        paused = false;
        self = null;
        try { if (lm != null) lm.removeUpdates(this); } catch (Exception ignored) {}
        try { if (lock != null && lock.isHeld()) lock.release(); } catch (Exception ignored) {}
        super.onDestroy();
    }
}
