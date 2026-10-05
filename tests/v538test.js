// 5.38 — 위치 받는 방식 (사장님 승인 2026-10-05 「그래」)
// 안드로이드: ① 위성만 ② 2초→5초 ③ 받는 곳 하나로 ④ 멈추면 위성 끄기(Traccar) ⑤ 전경 서비스 그대로
// 아이폰: ① 배터리 Best·충전 BestForNavigation ② 5m ③ maritime 은 빌드 도구에 없어 아직 ④ iOS 17+ liveUpdates ⑤ 다시 켜지는 장치 그대로
const fs = require('fs'), path = require('path');
const SRC = process.argv[2] || path.join(__dirname, '..', 'www', 'index.html');
const src = fs.readFileSync(SRC, 'utf8');
const R = p => { try{ return fs.readFileSync(path.join(__dirname, '..', p), 'utf8'); }catch(_){ return ''; } };
const svc = R('android/app/src/main/java/kr/baetnil/app/BaetnilTrackService.java');
const plug = R('android/app/src/main/java/kr/baetnil/app/BaetnilTrack.java');
const rcv = R('android/app/src/main/java/kr/baetnil/app/BaetnilMotionReceiver.java');
const man = R('android/app/src/main/AndroidManifest.xml');
const gradle = R('android/app/build.gradle');
const swift = R('ios/App/App/BaetnilTrack.swift');
let ok = 0, bad = 0;
const T = (n, c, w) => { if(c){ ok++; console.log('통과: ' + n); }
  else { bad++; console.log('★ 실패: ' + n + (w !== undefined ? ' — ' + String(w).slice(0, 200) : '')); } };
function grab(name){
  const a = src.indexOf('function ' + name + '(');
  if(a < 0) return '';
  let d = 0, j = src.indexOf('{', a);
  for(; j < src.length; j++){ if(src[j] === '{') d++; else if(src[j] === '}'){ d--; if(!d){ j++; break; } } }
  return src.slice(a, j);
}

// ── 안드로이드
T('A① 위성(GPS_PROVIDER)만 받는다', /requestLocationUpdates\(LocationManager\.GPS_PROVIDER, ASK_MS, 0f, this\)/.test(svc) && !/NETWORK_PROVIDER, ASK_MS/.test(svc));
T('A② 받는 간격 5초 (SeaPeople·OsmAnd 남기는 간격)', /ASK_MS = 5000L/.test(svc));
T('A④ 「가만히 있음」 60초 뒤 끈다 (Traccar stopTimeoutSeconds)', /STOP_TIMEOUT_MS = 60000L/.test(svc));
T('A④ 100m 를 벗어나면 다시 켠다 (Traccar stationaryRadiusMeters)', /STATIONARY_M\s*= 100f/.test(svc) && /distanceTo\(anchor\) > STATIONARY_M/.test(svc));
T('A④ 쉬는 동안 60초마다 위치 하나 (Traccar heartbeat)', /BEAT_MS\s*= 60000L/.test(svc) && /setAndAllowWhileIdle\(AlarmManager\.ELAPSED_REALTIME_WAKEUP/.test(svc));
T('A④ 활동 인식으로 STILL 을 받는다', /ActivityRecognition\.getClient\(this\)\s*\.requestActivityTransitionUpdates/.test(svc) && /DetectedActivity\.STILL/.test(svc));
T('A④ 쉬면 위치 받기를 끄고 웨이크락을 놓는다', /private void pause\(\)[\s\S]{0,400}removeUpdates\(this\)[\s\S]{0,200}lock\.release\(\)/.test(svc));
T('A④ 다시 켜면 웨이크락·위치 받기를 다시', /private void resume\(\)[\s\S]{0,400}keepAwake\(\);[\s\S]{0,40}askLocations\(\);/.test(svc));
T('A④ 권한이 없으면 감지를 건너뛴다 (Traccar 와 같다)', /if \(motionOn \|\| !motionAllowed\(\)\) return;/.test(svc));
T('A④ 활동 인식 결과를 받는 인텐트는 안드로이드 12+ 에서 MUTABLE', /FLAG_MUTABLE/.test(svc));
T('A④ 끝낼 때 감지·알람을 다 거둔다', /public void onDestroy\(\)[\s\S]{0,400}beatCancel\(\);[\s\S]{0,60}beatEnd\(\);[\s\S]{0,60}motionStop\(\);/.test(svc));
T('A④ 리시버: STILL 들어감 → 쉼, 나옴·다른 움직임 → 다시', /still && enter\) BaetnilTrackService\.onMotion\(true\)/.test(rcv) && /onMotion\(false\)/.test(rcv) && /ACT_BEAT\.equals\(a\)\) \{ BaetnilTrackService\.onBeat\(\)/.test(rcv));
T('A④ 명세에 리시버(밖에서 못 부름)', /android:name="\.BaetnilMotionReceiver"\s*android:exported="false"/.test(man));
T('A④ 명세에 신체 활동 권한', /android\.permission\.ACTIVITY_RECOGNITION/.test(man) && /com\.google\.android\.gms\.permission\.ACTIVITY_RECOGNITION/.test(man));
T('A④ 「항상 허용」 권한은 여전히 안 쓴다 (구글 심사 — 4.130)', !/<uses-permission android:name="android\.permission\.ACCESS_BACKGROUND_LOCATION"/.test(man));
T('A④ 구글 위치 서비스 부품', /play-services-location/.test(gradle));
T('A④ 부품에 신체 활동 권한 묻기(askMotion)·상태(still·pauses)', /public void askMotion\(PluginCall call\)/.test(plug) && /r\.put\("still"/.test(plug) && /r\.put\("pauses"/.test(plug));
T('A⑤ 위치 종류 전경 서비스 그대로', /FOREGROUND_SERVICE_TYPE_LOCATION/.test(svc) && /foregroundServiceType="location"/.test(man));

// ── 아이폰
T('I① 배터리일 때 Best · 충전 중 BestForNavigation (OsmAnd·Organic Maps · 애플 안내)',
  /plugged \? kCLLocationAccuracyBestForNavigation : kCLLocationAccuracyBest/.test(swift) && /batteryStateDidChangeNotification/.test(swift));
T('I② 5m 그대로', /m\.distanceFilter = 5\b/.test(swift));
T('I④ iOS 17+ 는 애플 liveUpdates (멈추면 쉬고 움직이면 다시)', /if #available\(iOS 17\.0, \*\) \{[\s\S]{0,200}liveStart\(\)/.test(swift) && /CLLocationUpdate\.liveUpdates\(\.otherNavigation\)/.test(swift));
T('I④ 그 아래는 예전 방식', /\} else \{\s*lm\?\.startUpdatingLocation\(\)\s*\}/.test(swift));
T('I④ liveUpdates 가 끊기면 예전 방식으로 이어 받는다', /catch \{[\s\S]{0,300}startUpdatingLocation\(\)/.test(swift));
T('I④ 끝낼 때 liveUpdates 를 멈춘다', /liveStop\(\)/.test(swift) && /\.cancel\(\)/.test(swift));
T('I⑤ 큰 위치 변화 알림·백그라운드 세션 그대로', /startMonitoringSignificantLocationChanges/.test(swift) && /CLBackgroundActivitySession\(\)/.test(swift));
T('I③ maritime 은 아직 안 쓴다 (빌드 도구 Xcode 26.6 에 없음 — 넣으면 빌드가 깨진다)', !/\.maritime/.test(swift.replace(/\/\/[^\n]*/g, '')));
T('I 상태에 still·pauses', /"still": still, "pauses": stills/.test(swift));

// ── 앱 쪽
const at = grab('trkAttach');
T('J③ 기록 장치가 켜지면 부품 위치 받기를 내린다', /trkNow\.nat && trkNow\.id != null\)\{\s*try\{ await G\.removeWatcher/.test(at), at.slice(-600));
T('J③ 화면이 보이는 동안 5초마다 가져와 그린다', /if\(trkNow && trkNow\.nat\) trkLiveDrainOn\(\)/.test(at) && /visibilityState === 'visible'\) trkBufDrain\(\)/.test(grab('trkLiveDrainOn')) && /\}, TRK_OSM_MS\)/.test(grab('trkLiveDrainOn')));
T('J③ 멈출 때 그 타이머를 끈다', /trkLiveDrainOff\(\)/.test(grab('trkStop')));
T('J 안드로이드 신체 활동 권한을 묻는다 (거절해도 기록은 된다)', /P0\.askMotion === 'function'\) await P0\.askMotion\(\)/.test(at));
T('J④ 기록 장치가 돌면 앱 쪽 웨이크락을 안 잡는다 (쉬는 동안 CPU 가 깨어 있지 않게)',
  /if\(!\(trkNow && trkNow\.nat\)\)\{ try\{ await trkAwakeOn\(\); \}catch\(_\)\{\} \}/.test(grab('trkStart')) &&
  /if\(!\(trkNow && trkNow\.nat\)\)\{ try\{ trkAwakeOn\(\); \}catch\(_\)\{\} \}/.test(grab('trkResume')));
T('J 쉰 횟수·분을 항해에 남긴다', /it\.trkStat\.stills = /.test(grab('trkStop')) && /it\.trkStat\.stillMin = /.test(grab('trkStop')));

T('판 5.38', /const APP_VER = '5\.38';/.test(src));
console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
process.exit(bad ? 1 : 0);
