// 5.58 — 날씨 서버가 들쭉날쭉할 때 (사장님 2026-11-18 「어제부터 날씨안된다」 → 「1~3번 지금 해서 올려라」)
//   ① 예보를 못 받으면 한 번 더 묻는다   ② 담아 둔 예보는 그 예보가 다룬 시각이 남아 있는 동안 보여 준다
//   ③ 예보는 못 받았어도 물결을 받았으면 물결·물때는 보여 준다 (바람 칸은 「자료 없음」)
// 사용: node wxflakylive.js ../www/index.html
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const FILE = path.resolve(process.argv[2] || '../www/index.html');
const ROOT = path.dirname(FILE);
const server = http.createServer((rq,rs)=>{
  const u = rq.url.split('?')[0];
  const f = u === '/' ? FILE : path.join(ROOT, u);
  fs.readFile(f,(e,d)=>{ if(e){rs.writeHead(404);rs.end();return;} rs.writeHead(200); rs.end(d); });
});
let ok=0,bad=0;
const T=(n,c,w)=>{ if(c){ok++;console.log('통과: '+n);} else {bad++;console.log('★ 실패: '+n+(w!==undefined?' — '+JSON.stringify(w).slice(0,300):''));} };
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
  const br = await chromium.launch();
  for(const lang of ['ko-KR','en-US','ru-RU','ja-JP']){
  const L = lang.slice(0,2);
  const ctx = await br.newContext({ locale:lang, viewport:{width:390,height:844}, isMobile:true, hasTouch:true, timezoneId:'Asia/Seoul' });
  // 예보 서버: mode 로 흉내 — 'ok' 정상 · 'once' 첫 번만 실패 · 'down' 늘 실패 · '400' 잘못된 물음
  let mode = 'ok', fc = 0, mc = 0, once = 0;
  await ctx.route(/api\.open-meteo\.com/, async r => { fc++;
    if(mode === 'down') return r.abort();
    if(mode === 'once' && once++ === 0) return r.abort();
    if(mode === '400') return r.fulfill({ status:400, contentType:'application/json', body:'{"error":true,"reason":"x"}' });
    r.fulfill({ status:200, contentType:'application/json', body: JSON.stringify(fakeWx(r.request().url())) }); });
  let marDown = false;
  await ctx.route(/marine-api\.open-meteo\.com/, async r => { mc++; if(marDown) return r.abort(); r.fulfill({ status:200, contentType:'application/json', body: JSON.stringify(fakeWx(r.request().url())) }); });
  await ctx.route(/tide\.json/, r => r.fulfill({ status:404, body:'' }));
  await ctx.route(/googleapis|gstatic|firebaseio|firestore|openstreetmap|openseamap/, r=>r.abort());
  await ctx.addInitScript((L)=>{ try{ localStorage.setItem('bt_setup','done'); localStorage.setItem('bt_welcome','done'); localStorage.setItem('bt_lang', L); }catch(_){} }, L);
  const pg = await ctx.newPage();
  const errs=[]; pg.on('pageerror', e=>errs.push(String(e)));
  await pg.goto(url, { waitUntil:'domcontentloaded' });
  await sleep(1500);
  const setup = async (cacheAgeH, oldDays) => pg.evaluate(async ({ageH, w, m, oldDays})=>{
    // 다룬 시각을 며칠 앞으로 옮긴다 (다 지난 예보 흉내)
    if(oldDays){ const mv = o => { o.hourly.time = o.hourly.time.map(s => { const d = new Date(s + ':00'); d.setDate(d.getDate() - oldDays);
        const p = n => String(n).padStart(2,'0'); return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+'T'+p(d.getHours())+':00'; }); }; mv(w); mv(m); }
    try{ skipWelcome(); }catch(_){}
    wxCur = { id:'s1', name:'여수 원형 마리나', lat:34.74, lon:127.68 };
    wxSet(pKey('bt_wxcur'), wxCur); wxSpots = [wxCur]; wxSet(pKey('bt_spots'), wxSpots);
    wxData = null; wxTryAt = 0; wxFailed = false; Object.keys(WX_BG).forEach(k=>delete WX_BG[k]);
    await idbSet('wxcache', ageH == null ? null : { key: wxPtKey(34.74,127.68), at: Date.now() - ageH*3600e3, w, m });
  }, { ageH: cacheAgeH, w: fakeWx('forecast'), m: fakeWx('marine'), oldDays: oldDays || 0 });
  const wxScreen = async () => { await pg.evaluate(()=>{ homeSub='weather'; switchTab('home'); }); await sleep(1500);
    return pg.evaluate(()=>{ const E = document.getElementById('weatherList'); return E ? E.innerText : ''; }); };
  const st = () => pg.evaluate(()=>({ noWx: !!(wxData && wxData.w && wxData.w._noWx), wind: wxData && wxData.w && wxData.w.hourly ? wxData.w.hourly.wind_speed_10m[0] : 'none' }));
  const cached = () => pg.evaluate(async ()=>{ const c = await idbGet('wxcache'); return c ? { noWx: !!(c.w && c.w._noWx), at: c.at } : null; });

  // ① 한 번 실패해도 다시 물어 받는다
  await setup(null); mode = 'once'; once = 0; fc = 0;
  let w = await wxScreen(); let s = await st();
  T(L+' ① 첫 물음이 실패해도 한 번 더 물어 예보를 받는다', s.wind === 9 && !s.noWx && fc === 2, { s, fc, w: w.slice(0,120) });

  // ② 예보 서버가 멈춤 + 20시간 전에 받아 둔 예보 → 그것을 보여 준다 (전에는 12시간이면 버렸다)
  await setup(20); mode = 'down'; fc = 0;
  w = await wxScreen(); s = await st();
  T(L+' ② 20시간 전 예보라도 다룬 시각이 남았으면 보여 준다', s.wind === 9 && !s.noWx, { s, w: w.slice(0,160) });
  const age = await pg.evaluate(()=>wxAgeText());
  T(L+' ② 언제 것인지 밝힌다 (n시간 전 예보)', /20/.test(age), age);
  T(L+' ② 서버가 멈춰도 「불러오지 못했습니다」 가 아니다', !w.includes(await pg.evaluate(()=>t('날씨를 불러오지 못했습니다.'))), w.slice(0,160));
  const c2 = await cached();
  T(L+' ② 담아 둔 진짜 예보를 껍데기로 덮지 않았다', c2 && c2.noWx === false, c2);

  // ②-b 두 서버가 다 멈춰도(바다에서 인터넷이 끊긴 것과 같다) 20시간 전 예보를 보여 준다
  await setup(20); mode = 'down'; marDown = true;
  w = await wxScreen(); s = await st(); marDown = false;
  T(L+' ②-b 인터넷이 끊겨도 20시간 전 예보를 보여 준다', s.wind === 9 && !s.noWx, { s, w: w.slice(0,160) });

  // ③ 담아 둔 것도 없고 예보 서버가 멈춤 → 물결·물때는 보여 주고, 위에 알린다
  await setup(null); mode = 'down'; fc = 0; mc = 0;
  w = await wxScreen(); s = await st();
  const msg = await pg.evaluate(()=>({ fail: t('날씨 데이터를 받지 못했습니다'), whole: t('날씨를 불러오지 못했습니다.'), retry: t('다시 시도') }));
  T(L+' ③ 예보 없이도 화면이 그려진다 (물결만)', s.noWx === true && !w.includes(msg.whole), { s, w: w.slice(0,200) });
  T(L+' ③ 위에 「날씨 데이터를 받지 못했습니다」 + 다시 시도', w.includes(msg.fail) && w.includes(msg.retry), w.slice(0,200));
  T(L+' ③ 예보 서버에는 두 번 물었다 (다시 묻기 1번)', fc >= 2, fc);
  const waveShown = await pg.evaluate(()=>{ const E = document.getElementById('weatherList'); return E ? /0[.,]6/.test(E.innerText) : false; });
  T(L+' ③ 물결 값(0.6m)이 화면에 있다', waveShown, w.slice(0,300));
  const c3 = await cached();
  T(L+' ③ 껍데기는 폰에 담지 않는다', !c3 || c3.noWx === false, c3);
  // 오늘 화면도 무너지지 않는다
  await pg.evaluate(()=>{ homeSub='today'; switchTab('home'); }); await sleep(800);
  const home = await pg.evaluate(()=>{ const H = document.getElementById('homeList'); return H ? H.innerText.length : 0; });
  T(L+' ③ 오늘 화면도 그려진다', home > 50, home);

  // ④ 예보 서버가 돌아오면 다시 시도로 진짜 예보가 온다
  mode = 'ok';
  await pg.evaluate(()=>{ homeSub='weather'; switchTab('home'); }); await sleep(600);
  await pg.evaluate(()=>{ const b=[...document.querySelectorAll('#weatherList button')].find(x=>x.textContent.trim()===t('다시 시도')); if(b) b.click(); });
  await sleep(1500); s = await st();
  T(L+' ④ 서버가 돌아오면 [다시 시도] 로 진짜 예보', s.wind === 9 && !s.noWx, s);

  // ⑤ 다룬 시각이 다 지난 예보(6일 전)는 안 쓴다
  await setup(24*6 + 1, 6); mode = 'down';
  w = await wxScreen(); s = await st();
  T(L+' ⑤ 다 지난 예보는 안 쓴다 (물결만 보여 준다)', s.noWx === true, s);

  // ⑥ 400(잘못 물음)은 다시 묻지 않는다
  await setup(null); mode = '400'; fc = 0;
  await wxScreen();
  T(L+' ⑥ 400 은 다시 묻지 않는다', fc === 1, fc);

  T(L+' 오류가 없다', errs.length === 0, errs.slice(0,3));
  await ctx.close();
  }
  await br.close(); server.close();
  console.log(`\n합계: ${ok}개 통과 / ${bad}개 실패`);
  process.exit(bad ? 1 : 0);
})().catch(e=>{ console.log('★ 실패: 검사가 멈춤 — '+e); process.exit(1); });
