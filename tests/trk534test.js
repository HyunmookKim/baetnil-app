// 5.34 — 아이폰: 앱이 꺼져도 항적 기록이 다시 살아나게 (사장님: 「아이폰 항적 그리기 이거 아이폰 똑바로 되는 거 맞아?」, 2026-10-03)
//   안드로이드는 START_STICKY 로 기록 장치가 스스로 다시 산다. 아이폰도 같게:
//   ① 기록 중인지 폰에 적어 두고 ② 큰 위치 변화 알림·백그라운드 위치 세션(iOS 17)을 쥐고
//   ③ 앱이 켜질 때 AppDelegate 가 웹 화면보다 먼저 다시 켠다.
//   ★ 같이 — 앱에 기록 중인 항해가 없는데 장치만 돌면 끈다 · 항해 시작 전에 찍힌 점은 안 받는다.
const fs = require('fs');
const src = fs.readFileSync(process.argv[2] || '../www/index.html', 'utf8');
let ok = 0, bad = 0;
const T = (n, c, w) => { if(c){ ok++; console.log('통과: ' + n); } else { bad++; console.log('★ 실패: ' + n + (w !== undefined ? ' — ' + JSON.stringify(w).slice(0, 300) : '')); } };
const grabK = (js, kw, name) => { const i = js.indexOf(kw + name + '('); if(i < 0) return '';
  let d = 0, st = js.indexOf('{', i);
  for(let j = st; j < js.length; j++){ if(js[j] === '{') d++; else if(js[j] === '}'){ d--; if(!d) return js.slice(i, j + 1); } }
  return ''; };
const grab = n => grabK(src, 'function ', n), agrab = n => grabK(src, 'async function ', n);

// ── 아이폰 네이티브
const I = fs.readFileSync(__dirname + '/../ios/App/App/BaetnilTrack.swift', 'utf8');
const D = fs.readFileSync(__dirname + '/../ios/App/App/AppDelegate.swift', 'utf8');
T('아이폰: 기록 장치가 플러그인 밖 한 벌(BaetnilTrackRec.shared)이다', /final class BaetnilTrackRec/.test(I) && /static let shared = BaetnilTrackRec\(\)/.test(I));
T('아이폰: 플러그인 start 는 그 한 벌을 켠다', /BaetnilTrackRec\.shared\.begin\(\)/.test(I));
T('아이폰: 플러그인 stop 은 그 한 벌을 끈다', /BaetnilTrackRec\.shared\.end\(\)/.test(I));
T('아이폰: 기록 중인지 폰에 적어 둔다 (켤 때 true · 끌 때 false)',
  /set\(true, forKey: BaetnilTrackRec\.ON_KEY\)/.test(I) && /set\(false, forKey: BaetnilTrackRec\.ON_KEY\)/.test(I));
T('아이폰: 큰 위치 변화 알림을 켜고 끈다', /startMonitoringSignificantLocationChanges\(\)/.test(I) && /stopMonitoringSignificantLocationChanges\(\)/.test(I));
T('아이폰: iOS 17 부터 백그라운드 위치 세션을 쥐고, 끌 때 놓는다',
  /if #available\(iOS 17\.0, \*\)[\s\S]{0,200}CLBackgroundActivitySession\(\)/.test(I) && /CLBackgroundActivitySession\)\?\.invalidate\(\)/.test(I));
T('아이폰: 앱이 켜질 때 AppDelegate 가 가장 먼저 이어 붙인다',
  /didFinishLaunchingWithOptions[\s\S]{0,700}BaetnilTrackRec\.shared\.resumeIfNeeded\(\)[\s\S]{0,40}return true/.test(D));
{
  const r = grabK(I, 'func ', 'resumeIfNeeded');
  T('아이폰: 이어 붙이기는 기록 중이었을 때만', /bool\(forKey: BaetnilTrackRec\.ON_KEY\) else \{ return \}/.test(r));
  T('아이폰: 그사이 권한을 껐으면 이어 붙이지 않는다', /guard authOK\(\) else \{ return \}/.test(r));
  const a = grabK(I, 'func ', 'authOK');
  T('아이폰: 정확한 위치가 꺼졌으면 이어 붙이지 않는다', /reducedAccuracy/.test(a));
}
T('아이폰: 예전 설정 그대로 (.otherNavigation · 멈춰도 안 끔 · 뒤에서도 받음 · 5m)',
  /activityType = \.otherNavigation/.test(I) && /pausesLocationUpdatesAutomatically = false/.test(I)
  && /allowsBackgroundLocationUpdates = true/.test(I) && /distanceFilter = 5\b/.test(I));
T('아이폰: 상태에 「스스로 이어 붙였나」 를 같이 준다', /"relaunch": relaunch/.test(I));
T('아이폰: 플러그인에는 위치 받는 곳이 따로 없다 (두 벌이 돌지 않게)',
  !/class BaetnilTrack: CAPPlugin, CAPBridgedPlugin, CLLocationManagerDelegate/.test(I));
{
  const P = fs.readFileSync(__dirname + '/../ios/App/App/Info.plist', 'utf8');
  T('아이폰: 백그라운드 위치(UIBackgroundModes location)가 그대로 있다', /<key>UIBackgroundModes<\/key>\s*<array>[\s\S]*?<string>location<\/string>/.test(P));
}
// 안드로이드는 이미 스스로 다시 산다
{
  const S = fs.readFileSync(__dirname + '/../android/app/src/main/java/kr/baetnil/app/BaetnilTrackService.java', 'utf8');
  T('안드로이드: 기록 장치는 START_STICKY (꺼져도 다시 산다)', /return START_STICKY;/.test(S));
}

// ── 웹 쪽 겉모양
T('항해 시작보다 1분 넘게 앞선 점은 안 받는다', /Number\(q\.t\) < f0 - TRK_BEFORE_MS/.test(agrab('trkBufDrain')) && /const TRK_BEFORE_MS = 60000;/.test(src));
T('기록 중인 항해가 없는데 장치가 돌면 끈다', /if\(!trkNow\)\{[\s\S]{0,500}st && st\.running[\s\S]{0,80}await trkBufStop\(\)/.test(agrab('trkResume')));
T('버린 수·스스로 이어 붙인 것을 항해 기록(trkStat)에 남긴다', /it\.trkStat\.old = /.test(agrab('trkStop')) && /it\.trkStat\.relaunch = true/.test(agrab('trkStop')));

// ── 실제로 돌려 본다 — 가져오는 문
function harness(){
  const C = k => { const m = src.match(new RegExp('const ' + k + '\\s*=\\s*([\\d.]+)')); return m ? m[1] : 'undefined'; };
  const env = `
    const TRK_BEFORE_MS=${C('TRK_BEFORE_MS')}, TRK_ACC=${C('TRK_ACC')}, TRK_GPS_ACC=${C('TRK_GPS_ACC')}, TRK_DIST=${C('TRK_DIST')},
          TRK_MAX=99999, TRK_TOL=1, TRK_STILL_MS=${C('TRK_STILL_MS')};
    ${require('./trkspd_pre.js')(src)}
    ${grab('trkTooFast')}
    const hav=(a,b,c,d)=>{const R=6371,r=x=>x*Math.PI/180,dLa=r(c-a),dLo=r(d-b);
      const q=Math.sin(dLa/2)**2+Math.cos(r(a))*Math.cos(r(c))*Math.sin(dLo/2)**2;return 2*R*Math.asin(Math.sqrt(q));};
    let trkNow = null, trkDraining = false, BUF = [], RUN = false, STOPS = 0, DRAINS = 0;
    const trkP = () => ({ drain: async () => { DRAINS++; const pts = BUF; BUF = []; return { pts }; },
                          status: async () => ({ running: RUN, bytes: 0 }), stop: async () => { RUN = false; STOPS++; } });
    const trkKeep=()=>{}, trkFlush=()=>{}, trkLive=()=>{}, trkBufMark=()=>{}, trkSimplify=a=>a;
    const isNative=()=>true, mobFabSync=()=>{}, trkDropIfGone=async()=>false, trkSmoothReset=()=>{}, trkAttach=async()=>true, trkAwakeOn=async()=>{};
    let LOADED = null; const trkLoad=()=>{ trkNow = LOADED; };
    ${agrab('trkBufDrain')}
    ${agrab('trkBufStop')}
    ${agrab('trkBufStatRaw')}
    ${agrab('trkResume')}
    return {
      start(fromMs){ trkNow = { vid:'v', from:new Date(fromMs).toISOString(), pts:[], id:null, nat:true }; BUF = []; },
      feed(a){ BUF = BUF.concat(a); }, drain: () => trkBufDrain(), get: () => trkNow,
      resume: () => trkResume(), setLoaded(v){ LOADED = v; }, setRun(v){ RUN = v; },
      stat: () => ({ RUN, STOPS, DRAINS, BUF: BUF.length }) };`;
  return new Function(env)();
}
(async () => {
  let h = null, err = '';
  try{ h = harness(); }catch(e){ err = e.message; }
  T('검사 틀이 돈다' + (err ? ' — ' + err : ''), !!h);
  if(!h) return;
  const t0 = Date.parse('2026-10-03T03:00:00Z');
  const pt = (sec, i) => ({ t: t0 + sec * 1000, la: 34.70 + i * 0.0003, lo: 127.70 + i * 0.0003, ac: 5, sp: 3, br: 45, pv: 'ios' });
  // 지난 항해 찌꺼기(시작 10분 전·2분 전) + 시작 30초 전(시계 차이 봐줌) + 시작 뒤 20점
  h.start(t0);
  const 찌꺼기 = [pt(-600, 0), pt(-120, 1)];
  const 봐줌 = [pt(-30, 2)];
  const 진짜 = []; for(let i = 0; i < 20; i++) 진짜.push(pt(10 + i * 10, 3 + i));
  h.feed(찌꺼기.concat(봐줌, 진짜));
  await h.drain();
  const N = h.get();
  const ts = N.pts.map(p => Date.parse(p.t));
  T('항해 시작 1분보다 앞선 지난 점 둘은 안 들어간다', ts.every(x => x >= t0 - 60000) && N.old === 2, { old: N.old, first: ts[0] - t0 });
  T('시작 30초 전 점(시계 차이)은 들어간다', ts.includes(t0 - 30000), ts.slice(0, 3).map(x => x - t0));
  T('시작 뒤 점은 다 들어간다 (21점)', N.pts.length === 21, N.pts.length);
  // 앱이 꺼졌다 켜지며 장치가 이어 붙인 뒤 — 꺼져 있던 동안 쌓인 점이 시각 차례로 이어진다
  const 꺼진동안 = []; for(let i = 0; i < 30; i++) 꺼진동안.push(pt(400 + i * 10, 30 + i));
  h.feed(꺼진동안);
  await h.drain();
  T('꺼져 있던 동안 쌓인 30점이 이어 붙는다 (51점)', h.get().pts.length === 51, h.get().pts.length);

  // trkResume — 앱에 기록 중인 항해가 없다
  h.setLoaded(null); h.setRun(true); h.feed([pt(9999, 99)]);
  await h.resume();
  let s = h.stat();
  T('기록 중인 항해가 없는데 장치가 돌고 있으면 끈다', s.STOPS === 1 && s.RUN === false, s);
  T('그때 장치에 남은 점은 비운다 (다음 항해에 섞이지 않게)', s.BUF === 0, s);
  h.setRun(false);
  await h.resume();
  T('장치가 안 돌고 있으면 아무것도 안 한다', h.stat().STOPS === 1, h.stat());
  // trkResume — 기록 중인 항해가 있으면 끄지 않는다
  h.setLoaded({ vid:'v9', from:new Date(t0).toISOString(), pts:[], id:null }); h.setRun(true);
  await h.resume();
  T('기록 중인 항해가 있으면 장치를 끄지 않는다', h.stat().STOPS === 1 && h.stat().RUN === true, h.stat());
})().catch(e => T('돌려 보다 터졌다 — ' + e.message, false)).finally(() => {
  console.log('\n' + ok + ' 통과 · ' + bad + ' 실패');
  process.exit(bad ? 1 : 0);
});
