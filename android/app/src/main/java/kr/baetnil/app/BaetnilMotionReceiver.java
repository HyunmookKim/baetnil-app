package kr.baetnil.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import com.google.android.gms.location.ActivityTransition;
import com.google.android.gms.location.ActivityTransitionEvent;
import com.google.android.gms.location.ActivityTransitionResult;
import com.google.android.gms.location.DetectedActivity;

/**
 * 뱃일 — 멈춤 감지·쉬는 동안 위치 확인을 기록 장치에 넘기는 문 (5.38)
 *
 * ★ Traccar(traccar-client-sdk ActivityRecognitionDetector · AlarmHeartbeatTrigger) 와 같은 꼴:
 *   · 「가만히 있음(STILL)」 에 들어가면 → 기록 장치가 60초를 재고 위성을 끈다
 *   · 「가만히 있음」 에서 나오거나 다른 움직임(차·자전거·걷기·뛰기)에 들어가면 → 다시 켠다
 *   · 쉬는 동안 60초마다 → 위치를 한 번 받아 100m 를 벗어났는지 본다
 */
public class BaetnilMotionReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent i) {
        if (i == null) return;
        String a = i.getAction();
        if (BaetnilTrackService.ACT_BEAT.equals(a)) { BaetnilTrackService.onBeat(); return; }
        if (!BaetnilTrackService.ACT_MOTION.equals(a)) return;
        try {
            if (!ActivityTransitionResult.hasResult(i)) return;
            ActivityTransitionResult r = ActivityTransitionResult.extractResult(i);
            if (r == null) return;
            for (ActivityTransitionEvent e : r.getTransitionEvents()) {
                boolean still = e.getActivityType() == DetectedActivity.STILL;
                boolean enter = e.getTransitionType() == ActivityTransition.ACTIVITY_TRANSITION_ENTER;
                if (still && enter) BaetnilTrackService.onMotion(true);
                else if (still || enter) BaetnilTrackService.onMotion(false);   // 가만히 있음에서 나왔다 · 다른 움직임에 들어갔다
            }
        } catch (Exception | Error ignored) {}
    }
}
