// 날씨가 늦게 뜨던 것 (5.20) — 사장님: 「오늘창에서 날씨불러오는게 존나 느리던데, 날씨창으로 들어가도 존나 느리게 뜸」
// 잰 것: claude/뱃일-날씨-늦게뜸-잰것.md
//   ① 로그인이 확인되는 순간(wxReload) 날씨를 비우고 다시 안 불러서, 오늘 화면이 75초 넘게 「받는 중」 이었다.
//   ② 담아 둔 날씨가 한 시간이 지났으면 새로 받을 때까지 아무것도 안 보여 줬다.
//   ③ 날씨 화면은 물때 파일(421KB)·조류·조석 모형을 다 받은 뒤에야 날씨를 그렸다.
// 여기서는 날씨 서버를 4초, 물때 파일을 6초 늦게 대답하게 하고, 그 사이에 화면에 무엇이 보이는지 본다.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const FILE = path.resolve(process.argv[2] || 'work.html');
const ROOT = path.dirname(FILE);
const server = http.createServer((rq,rs)=>{
  const u = rq.url.split('?')[0];
  const f = u === '/' ? FILE : path.join(ROOT, u);
  fs.readFile(f,(e,d)=>{ if(e){rs.writeHead(404);rs.end();return;} rs.writeHead(200); rs.end(d); });
});
let ok=0,bad=0;
const T=(n,c,w)=>{ if(c){ok++;console.log('통과: '+n);} else {bad++;console.log('★ 실패: '+n+(w!==undefined?' — '+JSON.stringify(w).slice(0,260):''));} };
const sleep = ms => new Promise(r=>setTimeout(r,ms));

function fakeWx(u){
  const times = []; const d0 = new Date(); d0.setMinutes(0,0,0); d0.setHours(0);
  for(let i=0;i<120;i++){ const d=new Date(d0.getTime()+i*3600e3); const p=n=>String(n).padStart(2,'0');
    times.push(d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+'T'+p(d.getHours())+':00'); }
  if(/marine/.test(u)) return { utc_offset_seconds:32400, hourly:{ time:times, wave_height:times.map(()=>0.6), wave_period:times.map(()=>5), wave_direction:times.map(()=>150), sea_level_height_msl:times.map(()=>0) } };
  return { utc_offset_seconds:32400, timezone:'Asia/Seoul', hourly:{ time:times, temperature_2m:times.map(()=>22), apparent_temperature:times.map(()=>22),
    precipitation:times.map(()=>0), weather_code:times.map(()=>1), wind_speed_10m:times.map(()=>9), wind_direction_10m:times.map(()=>150),
    wind_gusts_10m:times.map(()=>14), visibility:times.map(()=>20000) }, daily:{ time:[], sunrise:[], sunset:[] } };
}

(async ()=>{
  await new Promise(r=>server.listen(0,r));
  const url = 'http://127.0.0.1:'+server.address().port+'/';
  const br = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await br.newContext({ locale:'ko-KR', viewport:{width:390,height:844}, isMobile:true, hasTouch:true, timezoneId:'Asia/Seoul' });
  let wxDelay = 4000, wxFail = false, wxCalls = 0;
  await ctx.route(/open-meteo/, async r => { wxCalls++; await sleep(wxDelay);
    if(wxFail) return r.abort(); r.fulfill({ status:200, contentType:'application/json', body: JSON.stringify(fakeWx(r.request().url())) }); });
  await ctx.route(/tide\.json/, async r => { await sleep(6000); r.fulfill({ status:404, body:'' }); });
  await ctx.route(/googleapis|gstatic|firebaseio|firestore/, r=>r.abort());
  await ctx.addInitScript(()=>{ try{ localStorage.setItem('bt_setup','done'); localStorage.setItem('bt_welcome','done'); }catch(_){} });
  const pg = await ctx.newPage();
  const errs=[]; pg.on('pageerror', e=>errs.push(String(e)));
  pg.on('dialog', d=>d.accept());
  await pg.goto(url, { waitUntil:'domcontentloaded' });
  await sleep(1500);
  // 지점 하나와, 3시간 전에 받아 둔 날씨를 폰에 담아 둔다
  await pg.evaluate(async (w)=>{
    try{ skipWelcome(); }catch(_){}
    wxCur = { id:'s1', name:'여수 원형 마리나', lat:34.74, lon:127.68 };
    wxSet(pKey('bt_wxcur'), wxCur); wxSpots = [wxCur]; wxSet(pKey('bt_spots'), wxSpots);
    await idbSet('wxcache', { key: wxPtKey(34.74,127.68), at: Date.now() - 3*3600e3, w: w.w, m: w.m });
  }, { w: fakeWx('forecast'), m: fakeWx('marine') });
  // 오늘 화면의 「지금 나갈 수 있나」 칸만 본다
  const homeTxt = () => pg.evaluate(()=>{ const H = document.getElementById('homeList'); if(!H) return '';
    const t = H.innerText; const i = t.indexOf('출항 가능 여부'); return i < 0 ? '(날씨 칸 없음) ' + t.slice(0,80) : t.slice(i, i + 160); });

  // ── ① 켜자마자 — 담아 둔 날씨가 곧바로, 「3시간 전 예보」 로
  wxCalls = 0;
  await pg.goto(url, { waitUntil:'domcontentloaded' });
  await sleep(1800);
  await pg.evaluate(()=>{ try{ skipWelcome(); }catch(_){} homeSub='today'; switchTab('home'); });
  await sleep(300);
  let h = await homeTxt();
  T('★ 켜고 2초 — 날씨 서버가 아직 대답 전인데 오늘 화면에 담아 둔 날씨가 떠 있다', /출항해도 좋습니다|주의|출항하지 마세요/.test(h) && /9kt/.test(h), h.slice(0,200));
  T('★ 옛 예보라는 것을 밝힌다 (3시간 전 예보)', /3시간 전 예보/.test(h), h.slice(0,200));
  T('뒤에서 새 예보를 받으러 갔다', wxCalls > 0, wxCalls);
  await sleep(4500);
  h = await homeTxt();
  T('★ 새 예보가 오면 바꿔 그리고 「n시간 전」 을 뗀다', /9kt/.test(h) && !/시간 전 예보/.test(h), h.slice(0,200));

  // ── ② 로그인 확인 순간 날씨를 비워도(wxReload) 오늘 화면이 스스로 다시 채운다
  await pg.evaluate(()=>{ wxReload(); renderHome(); });
  await sleep(800);
  h = await homeTxt();
  T('★ 날씨를 비운 뒤에도 1초 안에 다시 뜬다 (5.19 는 75초가 지나도 「받는 중」)', /9kt/.test(h) && !/받는 중/.test(h), h.slice(0,200));

  // ── ③ 날씨 화면 — 물때 파일이 6초 늦어도 날씨는 먼저 그린다
  const t0 = Date.now();
  await pg.evaluate(()=>{ WX_AUX && Object.keys(WX_AUX).forEach(k=>delete WX_AUX[k]); tideLoaded = false; tideCache = null;
    try{ idbSet('tidecache', null); }catch(_){} homeSub='weather'; switchTab('home'); });
  let painted = 0;
  for(let i=0;i<40 && !painted;i++){ await sleep(100);
    const w = await pg.evaluate(()=>{ const L = document.getElementById('weatherList'); return L ? L.innerText : ''; });
    if(/풍속/.test(w)) painted = Date.now() - t0; }
  T('★ 날씨 화면 — 물때 파일을 기다리지 않고 날씨 표를 먼저 그린다 (2초 안)', painted > 0 && painted < 2000, painted);

  // ── ④ 담아 둔 것도 없고 받지도 못하면 「못 받았다」 고 말한다
  await pg.evaluate(async ()=>{ await idbSet('wxcache', null); wxData = null; homeSub='today'; switchTab('home'); });
  wxFail = true; wxDelay = 200;
  await pg.evaluate(()=>{ wxTryAt = 0; wxFailed = false; wxCur = { id:'s2', name:'거문도', lat:34.03, lon:127.31 }; renderHome(); });
  await sleep(2500);
  h = await homeTxt();
  T('★ 못 받았으면 「받지 못했습니다」 와 [다시 시도] (영영 「받는 중」 이 아니다)', /불러오지 못했습니다/.test(h) && /다시 시도/.test(h), h.slice(0,200));

  T('오류가 없다', errs.length === 0, errs.slice(0,3));
  await br.close(); server.close();
  console.log(`\n통과 ${ok} · 실패 ${bad}`);
  process.exit(bad ? 1 : 0);
})().catch(e=>{ console.log('★ 실패: 검사가 멈춤 — '+e); process.exit(1); });
