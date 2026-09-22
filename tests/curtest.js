// ★★★ 5.10 — 조류 (국립해양조사원 조류예보 · 시계열)
//   사장님: 「무조건 자료 찾아내라」. 여태 「한계 조류」 는 늘 「자료 없음」 이었다.
//   current.json 을 받아, 10km 안 가장 가까운 조류예보 지점의 시간별 조류를 날씨 화면에 보여 주고,
//   배 경고(한계 조류)에도 쓴다. 출처(공공누리 제1유형)를 화면에 적는다.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const __ARG  = process.argv[2];
const __BASE = __ARG ? path.dirname(path.resolve(__ARG)) : __dirname;
const __MAIN = __ARG ? path.basename(__ARG) : 'work.html';
const src = fs.readFileSync(path.join(__BASE, __MAIN), 'utf8');
const server = http.createServer((rq,rs)=>{
  const f = path.join(__BASE, rq.url === '/' ? __MAIN : rq.url.split('?')[0]);
  fs.readFile(f,(e,d)=>{ if(e){rs.writeHead(404);rs.end();return;} rs.writeHead(200); rs.end(d); });
});
let ok=0,bad=0;
const T=(n,c,w)=>{ if(c){ok++;console.log('통과: '+n);} else {bad++;console.log('★ 실패: '+n+(w!==undefined?' — '+JSON.stringify(w).slice(0,240):''));} };

T('★ 조류 거리 한도가 10km 다 (CUR_NEAR_KM)', /const CUR_NEAR_KM = 10;/.test(src));
T('★★ 조류 출처(국립해양조사원 조류예보)를 화면에 적는다', /해양수산부 국립해양조사원 조류예보/.test(src) && /curRowV && CN \?/.test(src));
T('★ 영어·러시아어·일본어 출처 문장이 있다', (src.match(/조류 — \{spot\} 조류예보 지점\(\{km\}km\) · 해양수산부 국립해양조사원 조류예보'/g) || []).length >= 3);
T('★★ 바람 화살표가 불어 가는 쪽을 가리킨다 (➤ 는 기본이 동쪽 → dir+90)', /rotate\(\$\{dir\+90\}deg\)/.test(src) && !/rotate\(\$\{dir\+180\}deg\)/.test(src));
T('★★ 조류 화살표가 흘러가는 쪽을 가리킨다 (dir-90)', /rotate\(\$\{c\.dir-90\}deg\)/.test(src));

// 오늘부터 이틀치 가짜 자료 — 여수 앞바다 관측소 하나, 멀리 하나
function kstDay(ms){ const k = new Date(ms + 9*3600e3); return k.getUTCFullYear()+'-'+String(k.getUTCMonth()+1).padStart(2,'0')+'-'+String(k.getUTCDate()).padStart(2,'0'); }
const now = Date.now();
const d0 = kstDay(now), d1 = kstDay(now + 86400e3);
const hrs = Array.from({length:24}, (_, h) => 50 + h);     // 50~73 cm/s
const dirs = Array.from({length:24}, (_, h) => h < 12 ? '북동' : '남서');
const CUR = { updated: new Date().toISOString(), source:'x', unit:'cm/s', days:[d0,d1], spots:[
  { c:'TEST1', n:'여수해협', la:34.7400, lo:127.7400, v:{ [d0]:hrs, [d1]:hrs }, dir:{ [d0]:dirs, [d1]:dirs } },
  { c:'TEST2', n:'먼곳',     la:35.5000, lo:129.5000, v:{ [d0]:hrs }, dir:{ [d0]:dirs } } ] };

(async ()=>{
  await new Promise(r=>server.listen(0,r));
  const url = 'http://127.0.0.1:'+server.address().port+'/';
  const br = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await br.newContext({ locale:'ko-KR', timezoneId:'Asia/Seoul', viewport:{width:390,height:800}, isMobile:true, hasTouch:true });
  const pg = await ctx.newPage();
  await pg.route('**/*.json*', r => {
    if(/current\.json/.test(r.request().url())) return r.fulfill({ status:200, contentType:'application/json', body: JSON.stringify(CUR) });
    return r.fulfill({ status:200, body:'{}' });
  });
  await pg.goto(url, { waitUntil:'domcontentloaded' });
  await pg.waitForTimeout(1200);

  const r = await pg.evaluate(async () => {
    await loadCur();
    const out = {};
    out.가까움 = curNearAt(34.7450, 127.7450);          // 약 0.7km
    out.멂 = curNearAt(34.6000, 127.5000);              // 25km 넘게
    out.ne = curNearAt(34.7450, 127.7450) ? curAt(Date.now(), curNearAt(34.7450, 127.7450)) : null;
    out.deg = [curDirDeg('북'), curDirDeg('동'), curDirDeg('남서'), curDirDeg('북북서'), curDirDeg('엉뚱')];
    // 시각 확인 — KST 3시의 값은 53 cm/s
    const k = new Date(); k.setHours(3, 10, 0, 0);
    out.h3 = curAt(k.getTime(), curNearAt(34.7450, 127.7450));
    // 배 경고에 쓰는 값
    wxCur = { id:'t', name:'여수', lat:34.7450, lon:127.7450 };
    out.kr = krCurrentKt(k.getTime());
    wxCur = { id:'t2', name:'먼곳', lat:34.6000, lon:127.5000 };
    out.kr멂 = krCurrentKt(k.getTime());
    return out;
  });
  T('★★ 10km 안 관측소를 잡는다', r.가까움 && r.가까움.s.c === 'TEST1' && r.가까움.dist < 1, r.가까움 && r.가까움.dist);
  T('★★ 10km 밖이면 조류를 안 쓴다', r.멂 === null, r.멂);
  T('★ 지금 시각의 조류가 나온다 (kt)', r.ne && r.ne.kt > 0.9 && r.ne.kt < 1.5, r.ne);
  T('★ 16방위를 각도로 바꾼다', JSON.stringify(r.deg) === JSON.stringify([0, 90, 225, 337.5, null]), r.deg);
  T('★★ 한국 시간 3시의 값을 읽는다 (53cm/s = 1.03kt)', r.h3 && Math.abs(r.h3.kt - 53 * 0.0194384) < 0.001 && r.h3.dir === 45, r.h3);
  T('★★ 배 경고(한계 조류)에 조류가 들어간다', r.kr != null && Math.abs(r.kr - 53 * 0.0194384) < 0.001, r.kr);
  T('★★ 10km 밖이면 배 경고에 조류를 안 넣는다 (지어내지 않는다)', r.kr멂 === null, r.kr멂);

  // 날씨 화면에 줄과 출처가 그려지는가
  const html = await pg.evaluate(async () => {
    const N = 48, t0 = new Date(); t0.setMinutes(0, 0, 0);
    const pad = n => String(n).padStart(2, '0');
    const times = Array.from({length:N}, (_, i) => { const d = new Date(t0.getTime() + i*3600e3);
      return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())+'T'+pad(d.getHours())+':00'; });
    const mk = v => Array(N).fill(v);
    wxCur = { id:'t', name:'여수', lat:34.7450, lon:127.7450 };
    wxData = { key: wxCur.lat+','+wxCur.lon, utc_offset_seconds: 32400,
      w: { utc_offset_seconds: 32400, hourly: { time: times, wind_speed_10m: mk(8), wind_gusts_10m: mk(12), wind_direction_10m: mk(0),
        temperature_2m: mk(20), precipitation: mk(0), visibility: mk(20000) } },
      m: { hourly: { wave_height: mk(0.5), wave_period: mk(5) } } };
    try{ await renderWeather(); }catch(e){ return 'ERR ' + e.message; }
    const L = document.getElementById('weatherList');
    return L ? L.innerHTML : '';
  });
  T('★★★ 날씨 화면에 조류 줄이 그려진다', /<div class="wlbl">조류<\/div>/.test(html), String(html).slice(0, 200));
  T('★★ 조류 값(kt)이 칸에 들어간다', /color:#7FC8C2">1\.\d</.test(html));
  T('★★ 출처와 관측소·거리가 화면에 적힌다', /조류 — .*여수해협.* 조류예보 지점\(0\.\d+km\) · 해양수산부 국립해양조사원 조류예보/.test(html), (html.match(/조류 — [^<]*/) || [])[0]);
  T('★ 바람 화살표: 북풍(0°)이면 90° 로 돌린다 (아래쪽 = 남쪽으로 분다)', /rotate\(90deg\)/.test(html));

  await br.close(); server.close();
  console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
  process.exit(bad ? 1 : 0);
})().catch(e => { console.log('★ 실패: 검사가 터졌다 — ' + e.message); process.exit(1); });
