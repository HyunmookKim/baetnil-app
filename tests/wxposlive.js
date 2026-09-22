// 진짜 브라우저에서 — 항해일지 날씨가 그 자리 날씨로 들어오는가.
// ★ 코드 검사(wxpostest.js)는 글자만 본다. 여기서는 실제로 돌려 본다.
//   특히 순서 — 위치는 비동기라, 브라우저에서 진짜로 늦게 들어온다.
//   전에는 그래서 날씨를 받을 때 좌표가 언제나 비어 있었다.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const FILE = process.argv[2] || 'work.html';
const server = http.createServer((rq,rs)=>{
  const f = ((rq.url === '/' && path.isAbsolute(FILE)) ? FILE : path.join(__dirname, rq.url === '/' ? FILE : rq.url.split('?')[0]));
  fs.readFile(f,(e,d)=>{ if(e){rs.writeHead(404);rs.end();return;}
    if(f.endsWith('.woff2')) rs.setHeader('Content-Type','font/woff2');
    rs.writeHead(200); rs.end(d); });
});
let ok=0,bad=0;
const T=(n,c,w)=>{ if(c){ok++;console.log('통과: '+n);} else {bad++;console.log('★ 실패: '+n+(w!==undefined?' — '+JSON.stringify(w).slice(0,180):''));} };

(async ()=>{
  await new Promise(r=>server.listen(0,r));
  const br = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await br.newContext({ locale:'ko-KR', viewport:{width:390,height:800}, isMobile:true, hasTouch:true });
  const pg = await ctx.newPage();
  const errs=[]; pg.on('pageerror', e=>errs.push(String(e)));
  await pg.goto('http://127.0.0.1:'+server.address().port+'/', { waitUntil:'networkidle' });
  await pg.waitForTimeout(900);

  // ── 받침대: 날씨 서버 흉내 + 위치 흉내(일부러 늦게 준다)
  await pg.evaluate(()=>{
    try{ skipWelcome(); }catch(_){}
    window.__asked = [];
    // open-meteo 를 가로챈다. 위도에 따라 다른 값을 준다.
    const realFetch = window.fetch;
    window.fetch = async (u, o) => {
      const s = String(u);
      if(s.indexOf('open-meteo') < 0) return realFetch(u, o);
      const la = parseFloat((s.match(/latitude=([\d.]+)/)||[])[1]);
      window.__asked.push(la);
      const H = t => ({ time:t, temperature_2m:t.map(()=>27),
        wind_speed_10m:t.map(()=> Math.round(la*100)%40),
        wind_direction_10m:t.map(()=>200), wind_gusts_10m:t.map(()=>10),
        visibility:t.map(()=>20000), precipitation:t.map(()=>0), weather_code:t.map(()=>0),
        apparent_temperature:t.map(()=>27) });
      const times = []; const d0 = new Date(); d0.setMinutes(0,0,0);
      for(let i=-24;i<72;i++){ const d=new Date(d0.getTime()+i*3600e3);
        const p=n=>String(n).padStart(2,'0');
        times.push(d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+'T'+p(d.getHours())+':00'); }
      const body = s.indexOf('marine') >= 0
        ? { hourly: { time:times, wave_height:times.map(()=> la > 34.72 ? 1.9 : 0.4),
                      wave_period:times.map(()=>5), wave_direction:times.map(()=>200) } }
        : { hourly: H(times), daily:{ sunrise:[], sunset:[] } };
      return { ok:true, json: async () => body };
    };
    // 위치 — 일부러 300ms 늦게 준다 (진짜 GPS 처럼)
    window.__nextPos = { lat:34.73893, lon:127.67897 };
    Object.defineProperty(navigator, 'geolocation', { configurable:true, value:{
      getCurrentPosition: (okf) => setTimeout(()=> okf({ coords:{
        latitude: window.__nextPos.lat, longitude: window.__nextPos.lon, accuracy: 5 } }), 300)
    }});
    // 날씨 지점은 엉뚱한 곳으로 잡아 둔다 — 이걸 쓰면 실패다
    wxCur = { id:'s1', name:'개도', lat:34.6250, lon:127.5900 };
    wxSet('bt_wxcur', wxCur);
    // ★ 4.1x 부터 위치는 「로그인 + 동의」 가 있어야 받는다(위치정보법).
    //   그 문을 안 열어 두면 앱이 옳게 거절하는데, 검사는 그것을 「좌표를 안 썼다」 로
    //   잘못 읽는다. 여기서 둘 다 켜 준다.
    window.__user = { uid:'u-test', email:'t@t' };
    try{ locSet(true); }catch(e){}
    window.tell = () => Promise.resolve();
    window.ask  = () => Promise.resolve(true);
  });

  // ── 항해 하나를 새로 만든다 (자동 기록 경로 그대로)
  await pg.evaluate(()=>{ unlocked = true; addVoyage(); });
  await pg.waitForTimeout(2500);

  let r = await pg.evaluate(()=>{
    const v = voyage[voyage.length-1];
    return { asked: window.__asked.slice(), wxOut: v.wxOut, posOut: v.posOut, id: v.id };
  });
  T('출항 — 고른 지점(34.625)이 아니라 잡힌 좌표(34.739)로 받았다',
    r.asked.length > 0 && r.asked.every(x => Math.abs(x - 34.739) < 0.01), r.asked);
  T('출항 — 위치가 먼저 들어오고 날씨가 그 뒤에 붙었다',
    !!(r.posOut && r.posOut.lat) && !!(r.wxOut && r.wxOut.pos === 1), { posOut:r.posOut, pos:r.wxOut && r.wxOut.pos });
  T('출항 — 파고가 그 자리 값(1.9m)이다', /1\.9m/.test((r.wxOut||{}).text||''), (r.wxOut||{}).text);

  // ── 중간 기록 — 다른 자리로 옮겨서
  await pg.evaluate(()=>{
    window.__asked = [];
    window.__nextPos = { lat:34.70033, lon:127.66658 };
    mrOpenType='voyage'; mrOpenId = voyage[voyage.length-1].id;
    logAdd();
  });
  await pg.waitForTimeout(2500);

  r = await pg.evaluate(()=>{
    const v = voyage[voyage.length-1]; const g = v.logs[v.logs.length-1];
    return { asked: window.__asked.slice(), wx:g.wx, pos:g.pos, out:v.wxOut };
  });
  T('중간기록 — 옮긴 자리(34.700)로 받았다',
    r.asked.length > 0 && r.asked.every(x => Math.abs(x - 34.700) < 0.01), r.asked);
  T('중간기록 — 출발과 파고가 다르다 (한 지점 돌려쓰기가 아니다)',
    /0\.4m/.test((r.wx||{}).text||'') && /1\.9m/.test((r.out||{}).text||''),
    [(r.out||{}).text, (r.wx||{}).text]);

  // ── 화면에 어떻게 보이는가
  await pg.evaluate(()=>{ openMR('voyage', voyage[voyage.length-1].id); });
  await pg.waitForTimeout(400);
  const seen = await pg.evaluate(()=> document.getElementById('mrPanel').innerText);
  T('화면에 「이 위치 예보」로 나온다', /이 위치 예보/.test(seen), seen.slice(0,220));
  T('화면에 「개도」가 위치처럼 덜렁 나오지 않는다', !/· 개도(?! 예보)/.test(seen), seen.slice(0,220));

  // ── 좌표를 못 잡는 사람은 어떻게 되나 (권한 거부)
  await pg.evaluate(()=>{
    window.__asked = [];
    Object.defineProperty(navigator, 'geolocation', { configurable:true, value:{
      getCurrentPosition: (okf, err) => setTimeout(()=> err({ code:1 }), 200) }});
    addVoyage();
  });
  await pg.waitForTimeout(2500);
  r = await pg.evaluate(()=>{
    const v = voyage[voyage.length-1];
    return { asked: window.__asked.slice(), wxOut:v.wxOut, posOut:v.posOut };
  });
  T('위치를 못 잡아도 날씨는 들어온다 (막히지 않는다)', !!(r.wxOut && r.wxOut.text), r.wxOut);
  T('그때는 고른 지점(34.625)으로 받는다',
    r.asked.length > 0 && r.asked.every(x => Math.abs(x - 34.625) < 0.01), r.asked);
  T('그때는 「개도 예보」로 나온다', (r.wxOut||{}).spot === '개도' && !(r.wxOut||{}).pos, r.wxOut);

  // ── 영어로도 말이 되는가
  await pg.evaluate(()=> localStorage.setItem('bt_lang','en'));
  await pg.reload({ waitUntil:'networkidle' }); await pg.waitForTimeout(900);
  const en = await pg.evaluate(()=>{
    try{ skipWelcome(); }catch(_){}
    unlocked = true; mrOpenType='voyage';
    const v = voyage.find(x=>x.wxOut && x.wxOut.pos);
    if(!v) return '';
    mrOpenId = v.id; openMR('voyage', v.id);
    return document.getElementById('mrPanel').innerText;
  });
  T('영어에서도 어디 예보인지 나온다', /forecast at this position/.test(en), en.slice(0,220));
  T('영어 화면에 새 열쇠의 한국어가 새지 않는다', !/이 자리|예보/.test(en),
    (en.match(/(이 자리|예보)/g)||[]));

  T('앱이 터지지 않았다', errs.length === 0, errs.slice(0,2));
  console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
  await br.close(); server.close();
  process.exit(bad ? 1 : 0);
})();
