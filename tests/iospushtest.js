// 아이폰 알림(푸시) 검사 — 2026-09-15 에 찾아낸 두 구멍을 다시 안 나게 못 박는다
//
// ★ 구멍 ①  AppDelegate 가 애플이 건네준 기기 열쇠를 Capacitor 로 안 넘겼다.
//            넘기는 줄이 없으면 알림 부품은 아무 말 없이 계속 기다린다.
// ★ 구멍 ②  @capacitor/push-notifications 가 아이폰에서 주는 열쇠는
//            **애플 기기 토큰**인데, 서버는 파이어베이스로 보낸다.
//            파이어베이스는 제 열쇠(FCM 토큰)만 받는다 → 영영 안 온다.
//            그래서 아이폰에서는 FirebaseMessaging 부품으로 열쇠를 받아야 한다.
const fs = require('fs');
const path = require('path');
const APP = process.argv[2] || 'work.html';
const h = fs.readFileSync(APP, 'utf8');
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : (fail++, console.log('★ 실패:', n)); };

function fn(name, src){
  const s = src || h;
  let i = s.indexOf('async function ' + name + '(');
  if(i < 0) i = s.indexOf('function ' + name + '(');
  if(i < 0) return '';
  let d = 0, st = false;
  for(let j = i; j < s.length; j++){
    const c = s[j];
    if(c === '{'){ d++; st = true; }
    else if(c === '}'){ d--; if(st && d === 0) return s.slice(i, j + 1); }
  }
  return s.slice(i);
}

// ── 1. 앱 — 파이어베이스 부품으로 받는 길이 있다
t('fcmFire() 가 있다', /function fcmFire\(\)/.test(h));
t('fcmFire() 가 FirebaseMessaging 를 본다',
  /Capacitor\.Plugins\.FirebaseMessaging/.test(fn('fcmFire')));

const reg = fn('fcmRegister');
t('fcmRegister 가 부품이 있으면 그쪽으로 간다',
  /const F = fcmFire\(\)/.test(reg) && /if\(F\) return fcmRegisterFire\(F\)/.test(reg));

const rf = fn('fcmRegisterFire');
t('fcmRegisterFire 가 있다', !!rf);
t('열쇠를 getToken 으로 받는다', /await F\.getToken\(\)/.test(rf));
t('받은 열쇠를 서버에 적는다', /fcmGot\(r && r\.token\)/.test(rf));
t('열쇠가 바뀌면 다시 적는다', /addListener\('tokenReceived'/.test(rf));
t('켜 둔 채로 온 알림을 직접 띄운다', /addListener\('notificationReceived'/.test(rf));
t('허락을 묻고 거절이면 denied 로 적는다',
  /requestPermissions\(\)/.test(rf) && /why:'denied'/.test(rf));
// ★ 옛 길(안드로이드)을 지우지 않았다 — 부품이 없으면 그대로 간다
t('옛 길(PushNotifications)이 그대로 있다',
  /const P = fcmPlugin\(\);/.test(reg) && /addListener\('registration'/.test(reg));
t('부품이 둘 다 없을 때만 「알림 기능 없음」 이라고 한다',
  /if\(!fcmPlugin\(\) && !fcmFire\(\)\) return 'noplug';/.test(h));

// ── 2. 아이폰 껍데기 — 두 파일이 제자리에 있나
//     (검사 폴더에서 돌리므로 여러 자리를 훑는다. 없으면 「못 찾음」 으로 적는다)
function findUp(rel){
  let d = path.resolve(path.dirname(APP));
  for(let i = 0; i < 6; i++){
    const p = path.join(d, rel);
    if(fs.existsSync(p)) return p;
    const q = path.join(d, 'baetnil-app', rel);
    if(fs.existsSync(q)) return q;
    d = path.dirname(d);
  }
  return '';
}
const adPath = findUp(path.join('ios','App','App','AppDelegate.swift'));
if(adPath){
  const ad = fs.readFileSync(adPath, 'utf8');
  t('AppDelegate 가 받은 기기 열쇠를 넘겨 준다',
    /didRegisterForRemoteNotificationsWithDeviceToken/.test(ad)
    && /capacitorDidRegisterForRemoteNotifications/.test(ad));
  t('AppDelegate 가 실패도 넘겨 준다',
    /didFailToRegisterForRemoteNotificationsWithError/.test(ad)
    && /capacitorDidFailToRegisterForRemoteNotifications/.test(ad));
} else {
  console.log('· AppDelegate.swift 를 못 찾아 건너뜁니다');
}
const entPath = findUp(path.join('ios','App','App','App.entitlements'));
if(entPath){
  const en = fs.readFileSync(entPath, 'utf8');
  t('자격 파일에 알림이 켜져 있다', /aps-environment/.test(en));
  t('스토어 판이라 production 이다', /<string>production<\/string>/.test(en));
  t('애플 로그인 자격을 안 지웠다', /com\.apple\.developer\.applesignin/.test(en));
} else {
  console.log('· App.entitlements 를 못 찾아 건너뜁니다');
}

console.log(`\n${pass}/${pass+fail} 통과`);
process.exit(fail ? 1 : 0);
