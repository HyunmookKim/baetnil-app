// 항적 자동 기록 — 셈이 맞고, 웹에서는 안 돌고, 껍데기에서는 도는가.
//
// ★ 왜 이 검사가 있나
//   웹앱은 화면이 뒤로 가는 순간 위치가 끊긴다. 그래서 항적은 껍데기 앱에서만 돈다.
//   여기서 제일 위험한 것은 「웹에서도 반쯤 도는」 것이다 —
//   토막 난 항적을 그려 놓으면 사람이 그걸 믿고 항로를 되짚는다.
//
//   그리고 거리 필터와 직선 간소화가 실제로 점을 줄이는지, 선 모양은 안 망가지는지 본다.
//   1분 간격이 아니라 50m 간격으로 잡는 까닭은 배 속도가 제각각이기 때문이다 —
//   요트 6노트면 30초에 한 점, 25노트 모터보트면 4초에 한 점이 된다.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const FILE = process.argv[2] || 'work.html';
// 인자가 절대경로면 그대로 쓴다 (검사 폴더 밖의 앱도 볼 수 있게).
const rel = f => path.isAbsolute(f) ? f : path.join(__dirname, f);
const src = fs.readFileSync(rel(FILE), 'utf8');
const server = http.createServer((rq, rs) => {
  const f = rq.url === '/' ? rel(FILE) : path.join(__dirname, rq.url.split('?')[0]);
  fs.readFile(f, (e, d) => { if(e){ rs.writeHead(404); rs.end(); return; }
    if(f.endsWith('.woff2')) rs.setHeader('Content-Type', 'font/woff2');
    rs.writeHead(200); rs.end(d); });
});
let ok = 0, bad = 0;
const T = (n, c, w) => { if(c){ ok++; console.log('통과: ' + n); }
  else { bad++; console.log('★ 실패: ' + n + (w !== undefined ? ' — ' + JSON.stringify(w).slice(0,240) : '')); } };
function grab(name){
  const i = src.indexOf('function ' + name + '(');
  if(i < 0) return '';
  let d = 0, j = src.indexOf('{', i);
  for(; j < src.length; j++){ if(src[j]==='{') d++; else if(src[j]==='}'){ d--; if(!d){ j++; break; } } }
  return src.slice(i, j);
}

// ── ① 있어야 할 것
{
  T('시작하는 곳이 있다 (trkStart)', !!grab('trkStart'));
  T('끝내는 곳이 있다 (trkStop)', !!grab('trkStop'));
  T('점을 담는 곳이 있다 (trkPush)', !!grab('trkPush'));
  T('직선 간소화가 있다 (trkSimplify)', !!grab('trkSimplify'));
  T('앱을 다시 켰을 때 이어 붙이는 곳이 있다 (trkResume)', !!grab('trkResume'));
  T('거리가 50m 로 박혀 있다', /TRK_DIST\s*=\s*50\b/.test(src), (src.match(/TRK_DIST\s*=\s*\d+/)||[])[0]);
  T('★ 시작할 때 로그인·동의를 먼저 본다',
    /locMay\s*\(/.test(grab('trkStart')), grab('trkStart').slice(0,400));
  T('★ 끝낼 때 확인자료에 한 줄 남긴다 (점마다가 아니다)',
    /lgTrack\(/.test(grab('trkStop')) && !/lgAdd\(/.test(grab('trkPush')),
    grab('trkStop').slice(-300));
  T('★ 클라우드로는 끝낼 때 한 번만 올린다',
    /schedulePush\(\)/.test(grab('trkStop')) && !/schedulePush\(\)/.test(grab('trkPush')));
  T('기록 중인 것을 폰에 남긴다 (앱이 죽어도 안 잃는다)',
    /localStorage\.setItem\(TRK_KEY/.test(grab('trkKeep')));
  T('★ 껍데기 앱에서는 서비스워커를 안 켠다',
    /isNativePlatform[\s\S]{0,80}serviceWorker\.register|serviceWorker[\s\S]{0,200}isNativePlatform/.test(src));
}

(async () => {
  await new Promise(r => server.listen(0, r));
  const br = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await br.newContext({ locale:'ko-KR', viewport:{ width:390, height:844 }, isMobile:true, hasTouch:true,
    permissions:['geolocation'], geolocation:{ latitude:34.7404, longitude:127.7357 } });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(String(e).slice(0,140)));
  await pg.goto('http://127.0.0.1:' + server.address().port + '/', { waitUntil:'networkidle' });
  await pg.waitForTimeout(900);
  await pg.evaluate(() => { window.__al = [];
    window.alert = m => window.__al.push(String(m).replace(/\n+/g,' / '));
    window.confirm = () => true;
    // ★ 앱은 alert/confirm 을 안 쓴다 — 자기 창(tell/ask)을 띄우고 답을 기다린다.
    //   안 가로채면 trkStart 가 그 창 앞에서 영원히 멈춘다(4.50 에서 잡음).
    window.tell = m => { window.__al.push(String(m).replace(/\n+/g,' / ')); return Promise.resolve(); };
    window.ask  = m => { window.__al.push(String(m).replace(/\n+/g,' / ')); return Promise.resolve(true); };
    window.__user = { uid:'u', email:'t@t', name:'시험' };
    try{ skipWelcome(); }catch(_){} unlocked = true; openBoatSetup(); });
  await pg.waitForTimeout(400);
  await pg.evaluate(() => { document.getElementById('nbName').value = '시험호'; createBoat(); });
  await pg.waitForTimeout(1500);
  await pg.evaluate(() => { locSet(true); });

  // ── ② 간소화 — 직선은 줄고, 꺾인 곳은 남는다
  const sim = await pg.evaluate(() => {
    // 여수 앞바다에서 동쪽으로 곧게 2km, 그다음 남쪽으로 꺾어 2km
    const mk = [];
    const la0 = 34.74, lo0 = 127.73;
    const dLo = 1 / (111.320 * Math.cos(la0 * Math.PI / 180));   // 1km 당 경도
    const dLa = 1 / 110.54;                                       // 1km 당 위도
    for(let i = 0; i <= 40; i++) mk.push({ la: la0, lo: +(lo0 + dLo * (i * 0.05)).toFixed(6), t:'' });
    for(let i = 1; i <= 40; i++) mk.push({ la: +(la0 - dLa * (i * 0.05)).toFixed(6), lo: +(lo0 + dLo * 2).toFixed(6), t:'' });
    const out = trkSimplify(mk, 25);
    // 꺾인 자리가 남았는가 — 모서리 좌표에 가까운 점이 있어야 한다
    const corner = out.some(p => Math.abs(p.la - la0) < 1e-6 && Math.abs(p.lo - (lo0 + dLo*2)) < 1e-5);
    return { 원래: mk.length, 줄인뒤: out.length, 모서리남음: corner,
             처음같나: out[0].lo === mk[0].lo, 끝같나: out[out.length-1].la === mk[mk.length-1].la };
  });
  T('★★ 직선 구간의 가운데 점이 버려진다', sim.줄인뒤 < sim.원래 / 4, sim);
  T('★★ 꺾인 자리는 남는다 (선 모양이 안 망가진다)', sim.모서리남음 === true, sim);
  T('처음과 끝은 반드시 남는다', sim.처음같나 && sim.끝같나, sim);

  // 점이 둘 이하면 그대로 둔다
  const few = await pg.evaluate(() => ({
    빈것: trkSimplify([], 25).length,
    한개: trkSimplify([{la:34.7,lo:127.7}], 25).length,
    두개: trkSimplify([{la:34.7,lo:127.7},{la:34.8,lo:127.8}], 25).length,
    쓰레기: trkSimplify([{la:34.7,lo:127.7},{la:'x',lo:null},{la:34.8,lo:127.8}], 25).length }));
  T('점이 모자라면 그대로 둔다', few.빈것 === 0 && few.한개 === 1 && few.두개 === 2, few);
  T('★ 망가진 좌표는 버린다', few.쓰레기 === 2, few);

  // ── ③ ★★ 웹에서는 아예 안 돈다
  const web = await pg.evaluate(async () => {
    const r = await trkStart('v1');
    return { 시작됐나: r, 기록중: trkOn(), 네이티브: isNative() };
  });
  // ★ 4.25 부터 trkStart 는 참·거짓 대신 「왜 안 켜졌는지」 를 글자로 돌려준다 ('' 면 켜진 것).
  //   조용히 false 만 돌려주다가 배에서 한 항해를 통째로 날렸기 때문이다.
  T('★★ 웹에서는 항적이 시작되지 않는다', !!web.시작됐나 && web.기록중 === false, web);
  T('★ 그때 까닭을 말해 준다', /웹에서는/.test(String(web.시작됐나)), web.시작됐나);
  T('웹에서는 네이티브가 아니라고 안다', web.네이티브 === false, web);

  // ★★ 담장을 따로 시험한다.
  //   플러그인이 아예 없어서 막히는 것과, 「웹이니까 안 한다」 로 막히는 것은 다르다.
  //   플러그인은 있는데 네이티브가 아닌 경우를 만들어 봐야 그 담장을 진짜로 본 것이다.
  //   (사보타주에서 isNative 담장을 빼도 안 잡혀서 이 검사를 넣었다.)
  const fakeWeb = await pg.evaluate(async () => {
    let 불렸나 = false;
    window.Capacitor = {
      isNativePlatform: () => false,          // 웹이다
      Plugins: { BackgroundGeolocation: {     // 그런데 플러그인은 있다
        addWatcher: async () => { 불렸나 = true; return 'x'; },
        removeWatcher: async () => {}, openSettings: async () => {}
      } }
    };
    const r = await trkStart('v1');
    const out = { 시작됐나: r, 기록중: trkOn(), 플러그인불렸나: 불렸나 };
    delete window.Capacitor;
    return out;
  });
  T('★★ 플러그인이 있어도 웹이면 시작 안 한다', !!fakeWeb.시작됐나, fakeWeb);
  T('★★ 그때 폰에 「알려 달라」 를 걸지도 않는다', fakeWeb.플러그인불렸나 === false, fakeWeb);

  // ── ④ 껍데기인 척하고 돌려 본다 (가짜 플러그인)
  await pg.evaluate(() => {
    window.__watchers = {};
    window.Capacitor = {
      isNativePlatform: () => true,
      Plugins: { BackgroundGeolocation: {
        addWatcher: async (opt, cb) => {
          const id = 'w' + (Object.keys(window.__watchers).length + 1);
          window.__watchers[id] = { opt, cb, live:true };
          window.__lastOpt = opt;
          return id;
        },
        removeWatcher: async ({ id }) => { if(window.__watchers[id]) window.__watchers[id].live = false; },
        openSettings: async () => { window.__settings = true; }
      } }
    };
    voyage = [{ id:'v1', date:'2026-08-22', title:'시험 항해', from:'여수', to:'',
                timeOut:'09:00', timeIn:'', logs:[], pub:true }];
    saveMR();
  });

  const st = await pg.evaluate(async () => {
    const r = await trkStart('v1');
    return { 시작됐나: r, 기록중: trkOn(),
             거리필터: (window.__lastOpt || {}).distanceFilter,
             알림글: (window.__lastOpt || {}).backgroundMessage || '',
             권한요청: (window.__lastOpt || {}).requestPermissions,
             묵은것: (window.__lastOpt || {}).stale,
             저장됨: !!localStorage.getItem('bt_trk') };
  });
  T('★★ 껍데기에서는 항적이 시작된다', st.시작됐나 === '' && st.기록중 === true, st);
  // ★ 4.52 — 폰에게 걸러 달라고 맡기지 않는다.
  //   「50m 움직였나」를 폰이 기지국 좌표로 판정하면 가만히 있어도 움직였다 하고,
  //   진짜 GPS 점은 걸러져 안 온다. 우리가 못 받은 점은 되살릴 수 없다.
  //   그래서 폰에게는 우리 저장 간격(TRK_DIST)보다 촘촘히 달라고 한다.
  const _ask  = Number((src.match(/TRK_ASK\s*=\s*(\d+)/)  || [])[1]);
  const _dist = Number((src.match(/TRK_DIST\s*=\s*(\d+)/) || [])[1]);
  T('★★ 폰에는 우리 저장 간격보다 촘촘히 달라고 건다',
    st.거리필터 === _ask && _ask > 0 && _ask < _dist, { 건값: st.거리필터, ask:_ask, dist:_dist });
  T('★ 상시 알림 글이 들어간다 (안드로이드는 이게 없으면 백그라운드가 안 된다)',
    String(st.알림글).length > 0, st.알림글);
  T('권한을 스스로 요청한다', st.권한요청 === true, st);
  T('묵은 위치는 안 받는다', st.묵은것 === false, st);
  T('기록 중인 것을 폰에 남긴다', st.저장됨 === true, st);

  // 점을 흘려 넣는다 — 50m 못 미치는 것은 버려져야 한다
  const push = await pg.evaluate(() => {
    const w = Object.values(window.__watchers).find(x => x.live);
    const la0 = 34.74, lo0 = 127.73;
    const dLo = 1 / (111.320 * Math.cos(la0 * Math.PI / 180));
    // ★ 4.52 — 시각을 실제처럼 벌려 준다. 같은 밀리초에 100m 를 가면 그건 배가 아니다.
    let __t = Date.now();
    const send = (km) => { __t += 40000; w.cb({ latitude: la0, longitude: lo0 + dLo * km,
                                accuracy: 5, time: __t }, null); };
    send(0);          // 첫 점
    send(0.010);      // 10m — 버려진다
    send(0.020);      // 20m — 버려진다
    send(0.100);      // 100m — 담는다
    send(0.105);      // 5m 더 — 버려진다
    send(0.300);      // 200m 더 — 담는다
    return { 점수: trkNow.pts.length };
  });
  T('★★ 50m 못 미치게 움직인 것은 안 담는다 (정박 중 선이 안 자란다)', push.점수 === 3, push);

  // 오류가 오면 멈추고 설정을 열어 준다
  const errCase = await pg.evaluate(async () => {
    const w = Object.values(window.__watchers).find(x => x.live);
    window.__settings = false;
    w.cb(null, { code:'NOT_AUTHORIZED', message:'no' });
    await new Promise(r => setTimeout(r, 300));
    return { 기록중: trkOn(), 설정열림: !!window.__settings };
  });
  T('★ 권한이 없으면 멈춘다', errCase.기록중 === false, errCase);
  T('★ 그때 설정을 열어 준다 (「설정 가서 켜세요」 로 끝내지 않는다)',
    errCase.설정열림 === true, errCase);

  // ── ⑤ 끝내면 항해에 저장되고 확인자료에 한 줄 남는다
  const fin = await pg.evaluate(async () => {
    try{ localStorage.removeItem('bt_loclog'); }catch(e){}
    lgReset();
    await trkStart('v1');
    const w = Object.values(window.__watchers).find(x => x.live);
    const la0 = 34.74, lo0 = 127.73;
    const dLo = 1 / (111.320 * Math.cos(la0 * Math.PI / 180));
    const dLa = 1 / 110.54;
    // ★ 꺾인 항로로 보낸다. 곧게만 가면 간소화가 점 둘로 줄이는 것이 맞아서
    //   「선이 항적을 따라가는가」 를 볼 수가 없다 (검사가 처음에 여기서 걸렸다).
    // ★ 4.79 — 여태 점 사이를 1초로 두고 있었다. 100m 를 1초면 194노트다.
    //   배가 낼 수 없는 속도라, 입항 때 알아서 다듬는 문(trkClean)이 이 점들을
    //   통째로 걷어냈다. 검사 자료가 틀렸던 것이지 앱이 틀린 것이 아니다.
    //   15초로 고친다 — 100m/15초 = 13노트, 실제로 배가 내는 속도다.
    let n = 0;
    const STEP = 15000;
    for(let i = 0; i <= 15; i++)   // 동쪽으로 1.5km
      w.cb({ latitude: la0, longitude: lo0 + dLo * (i * 0.1), accuracy:5, time: Date.now() + (n++)*STEP }, null);
    for(let i = 1; i <= 15; i++)   // 남쪽으로 꺾어 1.5km
      w.cb({ latitude: la0 - dLa * (i * 0.1), longitude: lo0 + dLo * 1.5, accuracy:5, time: Date.now() + (n++)*STEP }, null);
    for(let i = 1; i <= 15; i++)   // 다시 동쪽으로 1.5km
      w.cb({ latitude: la0 - dLa * 1.5, longitude: lo0 + dLo * (1.5 + i * 0.1), accuracy:5, time: Date.now() + (n++)*STEP }, null);
    const before = trkNow.pts.length;
    const pts = await trkStop();
    const it = voyage.find(v => v.id === 'v1');
    const rows = lgList();
    return { 담은점: before, 저장된점: (it.trk || []).length, 돌려준점: (pts || []).length,
             기록중: trkOn(), 지워짐: !localStorage.getItem('bt_trk'),
             확인자료: rows.map(r => r.k + ':' + r.w + ':' + (r.n || 0)) };
  });
  T('★ 끝내면 항해에 저장된다', fin.저장된점 >= 2, fin);
  T('★★ 저장할 때 직선 구간이 줄어든다', fin.저장된점 < fin.담은점, fin);
  T('끝내면 기록 중 표시가 지워진다', fin.기록중 === false && fin.지워짐 === true, fin);
  T('★★ 확인자료에 항적이 한 줄만 남는다 (점마다가 아니다)',
    fin.확인자료.filter(x => /항적/.test(x)).length === 1, fin.확인자료);
  T('★ 그 한 줄에 점 개수가 들어간다',
    fin.확인자료.some(x => /항적/.test(x) && Number(x.split(':').pop()) === fin.담은점),
    fin.확인자료);

  // ── ⑥ 지도에 그릴 때 — 선과 점을 따로 넘긴다
  //   ★ 처음에는 자동 항적을 이름표 점들 사이에 시각 순으로 끼워 넣었다.
  //     그러면 자정을 넘긴 항해나 도착 시각을 나중에 고친 경우 순서가 어긋나
  //     선이 도착점에서 바다로 튀어나간다. 그래서 선과 점을 갈랐다.
  const draw = await pg.evaluate(() => {
    const it = voyage.find(v => v.id === 'v1');
    it.posOut = { lat:34.7400, lon:127.7300 };
    it.posIn  = { lat:34.7264, lon:127.7628 };
    it.timeIn = '12:00';
    saveMR();
    const pts = trkPoints(it), line = trkLine(it);
    return { 점: pts.length, 선: line ? line.length : 0,
             처음이름: pts[0] && pts[0].label,
             끝이름: pts[pts.length-1] && pts[pts.length-1].label };
  });
  T('★★ 자동 항적이 「선」 으로 따로 나온다', draw.선 >= 2, draw);
  T('★★ 점은 이름표 있는 것만 (수백 개면 도면이 안 보인다)', draw.점 === 2, draw);
  T('출발·도착 이름표가 그대로 남는다',
    /출발|Depart|Отход/.test(String(draw.처음이름)) &&
    /도착|Arriv|Приход/.test(String(draw.끝이름)), draw);

  // ★★ 시각이 어긋나도 선이 안 튄다 — 이것이 끼워 넣기를 버린 까닭이다
  const cross = await pg.evaluate(() => {
    const it = voyage.find(v => v.id === 'v1');
    it.date = '2026-08-22'; it.timeOut = '23:30'; it.timeIn = '01:10';   // 자정을 넘김
    saveMR();
    const line = trkLine(it);
    // 선의 차례가 저장된 차례 그대로인가
    const same = line && it.trk.every((p, i) =>
      Math.abs(line[i].lat - p.la) < 1e-9 && Math.abs(line[i].lon - p.lo) < 1e-9);
    return { 같은차례: !!same, 점수: trkPoints(it).length };
  });
  T('★★ 자정을 넘긴 항해에서도 선의 차례가 안 흔들린다', cross.같은차례 === true, cross);
  T('그때도 이름표 점은 둘 그대로다', cross.점수 === 2, cross);

  // 지도를 실제로 켜서 선이 그려지는지 본다
  const paint = await pg.evaluate(() => {
    const it = voyage.find(v => v.id === 'v1');
    openMR('voyage', 'v1');
    return new Promise(res => setTimeout(() => {
      const el = document.getElementById('trkMap');
      const svg = el ? el.querySelector('svg.mov path') : null;
      res({ 지도: !!el, 선있나: !!svg,
            꺾임수: svg ? (svg.getAttribute('d') || '').split('L').length - 1 : 0,
            점개수: el ? el.querySelectorAll('.mdot').length : -1 });
    }, 900));
  });
  await pg.waitForTimeout(300);
  T('★★ 지도에 선이 그려진다', paint.지도 && paint.선있나, paint);
  T('★★ 선은 항적을 따라간다 (점 둘만 잇는 것이 아니다)', paint.꺾임수 >= 2, paint);
  T('★★ 화면에 찍히는 점은 둘뿐이다', paint.점개수 === 2, paint);

  // ── ⑦ 앱을 다시 켰을 때 이어 붙인다
  const res = await pg.evaluate(async () => {
    await trkStart('v1');
    const w = Object.values(window.__watchers).find(x => x.live);
    w.cb({ latitude:34.74, longitude:127.73, accuracy:5, time:Date.now() }, null);
    const before = trkNow.pts.length;
    // 앱이 죽었다고 치자 — 메모리는 날아가고 폰에 남은 것만 있다
    trkNow = null;
    trkResume();
    await new Promise(r => setTimeout(r, 300));
    return { 이어졌나: trkOn(), 점: trkNow ? trkNow.pts.length : 0, 전: before,
             워처다시: !!(trkNow && trkNow.id) };
  });
  T('★★ 앱이 죽었다 살아나도 항적을 이어 간다', res.이어졌나 === true && res.점 === res.전, res);
  T('그때 폰에 다시 「알려 달라」 를 건다', res.워처다시 === true, res);
  await pg.evaluate(async () => { await trkStop(); });

  T('앱이 터지지 않았다', errs.length === 0, errs.slice(0,2));
  console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
  await br.close(); server.close();
  process.exit(bad ? 1 : 0);
})();
