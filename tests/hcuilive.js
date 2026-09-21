// 진짜 브라우저에서 — 한국·일본 밖 자리에서 **조화상수 물때가 화면에 뜨는가**.
//   hclive.js 는 셈만 본다. 여기서는 앱을 실제로 띄워서 날씨 화면을 그려 본다.
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
const T=(n,c,w)=>{ if(c){ok++;console.log('통과: '+n);} else {bad++;console.log('★ 실패: '+n+(w!==undefined?' — '+JSON.stringify(w).slice(0,220):''));} };

(async ()=>{
  await new Promise(r=>server.listen(0,r));
  const br = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await br.newContext({ locale:'ko-KR', viewport:{width:390,height:800}, isMobile:true, hasTouch:true });
  const pg = await ctx.newPage();
  const errs=[]; pg.on('pageerror', e=>errs.push(String(e)));
  await pg.goto('http://127.0.0.1:'+server.address().port+'/', { waitUntil:'networkidle' });
  await pg.waitForTimeout(900);

  // 꾸러미가 진짜 브라우저에서 풀리는가 (atob · 한글 이름 · 속도)
  const 풀기 = await pg.evaluate(()=>{
    const t0 = performance.now();
    const rows = hcAll();
    return { n: rows ? rows.length : 0, ms: Math.round(performance.now()-t0),
             보기: rows && rows[0] ? rows[0].name : '' };
  });
  T('브라우저에서 꾸러미가 풀린다 — ' + 풀기.n + '곳 · ' + 풀기.ms + 'ms', 풀기.n > 1000, 풀기);
  T('푸는 데 2초를 안 넘는다', 풀기.ms < 2000, 풀기);

  // 샌프란시스코 앞바다에 배를 놓고 날씨 화면을 그린다
  const 본 = await pg.evaluate(async ()=>{
    try{ skipWelcome(); }catch(_){}
    const realFetch = window.fetch;
    window.fetch = async (u, o) => {
      const s = String(u);
      if(s.indexOf('open-meteo') < 0) return realFetch(u, o);
      const times=[]; const d0=new Date(); d0.setMinutes(0,0,0);
      const p=n=>String(n).padStart(2,'0');
      for(let i=-24;i<72;i++){ const d=new Date(d0.getTime()+i*3600e3);
        times.push(d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+'T'+p(d.getHours())+':00'); }
      const body = s.indexOf('marine') >= 0
        ? { hourly:{ time:times, wave_height:times.map(()=>0.8), wave_period:times.map(()=>6),
                     wave_direction:times.map(()=>240), sea_level_height_msl:times.map((x,i)=>Math.sin(i/2)) } }
        : { hourly:{ time:times, temperature_2m:times.map(()=>17),
            wind_speed_10m:times.map(()=>10), wind_direction_10m:times.map(()=>270),
            wind_gusts_10m:times.map(()=>14), visibility:times.map(()=>20000),
            precipitation:times.map(()=>0), weather_code:times.map(()=>0),
            apparent_temperature:times.map(()=>17) }, daily:{ sunrise:[], sunset:[] } };
      return { ok:true, json: async()=>body };
    };
    wxCur = { id:'sf', name:'금문교 앞', lat:37.807, lon:-122.465 };
    wxSet('bt_wxcur', wxCur);
    const TA = tideSource();
    return { hc: !!(TA && TA.hc), est: !!(TA && TA.est), 이름: TA && TA.spot && TA.spot.name,
             km: TA && TA.spot ? Math.round(TA.spot.dist) : null, safe: TA && TA.safe,
             점: TA ? TA.pts.length : 0,
             첫점: TA && TA.pts[0] ? { 높이: +TA.pts[0].v.toFixed(2), 만조: TA.pts[0].hi } : null };
  });
  T('★★★ 샌프란시스코에서 조화상수 물때가 잡힌다', 본.hc === true, 본);
  T('★★★ 어림(Open-Meteo)으로 안 내려간다', 본.est === false, 본);
  T('관측소 이름과 거리를 안다 — ' + 본.이름 + ' ' + 본.km + 'km', !!본.이름 && 본.km <= 5, 본);
  T('다리·수심에 써도 된다고 표가 섰다', 본.safe === true, 본);
  T('만조·간조 점이 넉넉하다 — ' + 본.점, 본.점 >= 20, 본);
  T('높이가 해도 기준면 위 값이다 (음수로 처박히지 않는다)', 본.첫점 && 본.첫점.높이 > -1, 본);

  // 날씨 화면을 실제로 그려 본다
  const 화면 = await pg.evaluate(async ()=>{
    switchTab('home'); setHomeSub('weather');
    await new Promise(r=>setTimeout(r,1500));
    const tx = document.body.innerText;
    return { 조화상수: /조화상수/.test(tx), 어긋: /30분쯤/.test(tx),
             출처: /Neaps tide database/.test(document.body.innerHTML),
             만조: /만조/.test(tx), 글: tx.slice(0,0) };
  }).catch(e=>({err:String(e)}));
  T('날씨 화면에 「조화상수」라고 적힌다', 화면.조화상수 === true, 화면);
  T('★★★ 「30분쯤 어긋난다」는 말이 화면에 없다', 화면.어긋 === false, 화면);
  T('★★★ 출처(Neaps tide database)가 화면에 붙는다', 화면.출처 === true, 화면);

  // 태평양 한가운데 — 관측소가 없다
  const 먼바다 = await pg.evaluate(()=>{
    wxCur = { id:'p', name:'태평양', lat:0, lon:-140 };
    const TA = tideSource();
    return { hc: !!(TA && TA.hc), est: !!(TA && TA.est) };
  });
  T('★★★ 관측소가 없는 바다에서는 조화상수를 안 쓴다', 먼바다.hc === false, 먼바다);

  T('화면이 깨진 곳이 없다', errs.length === 0, errs.slice(0,3));
  console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
  await br.close(); server.close();
  process.exit(bad ? 1 : 0);
})();
