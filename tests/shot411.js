const { chromium } = require('playwright');
const http=require('http'), fs=require('fs'), path=require('path');
const FILE='work.html';
const server=http.createServer((rq,rs)=>{const f=path.join(__dirname,rq.url==='/'?FILE:rq.url.split('?')[0]);
  fs.readFile(f,(e,d)=>{if(e){rs.writeHead(404);rs.end();return;}
    if(f.endsWith('.woff2'))rs.setHeader('Content-Type','font/woff2');rs.writeHead(200);rs.end(d);});});
(async()=>{
  await new Promise(r=>server.listen(0,r));
  const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const ctx=await br.newContext({ locale:'ko-KR',viewport:{width:390,height:844},isMobile:true,hasTouch:true,
    timezoneId:'Asia/Seoul',permissions:['geolocation'],geolocation:{latitude:34.7404,longitude:127.7357}});
  const pg=await ctx.newPage();
  await pg.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'networkidle'});
  await pg.waitForTimeout(900);
  await pg.evaluate(()=>{window.alert=()=>{};window.confirm=()=>true;
    try{skipWelcome();}catch(_){}unlocked=true;openBoatSetup();});
  await pg.waitForTimeout(400);
  await pg.evaluate(()=>{document.getElementById('nbName').value='시험호';createBoat();});
  await pg.waitForTimeout(1500);
  // 며칠에 걸쳐 쓴 것처럼 기록을 심는다
  await pg.evaluate(()=>{
    const D=864e5, now=Date.now();
    const mk=(d,h,k,w,ex)=>Object.assign({id:'x'+Math.random().toString(36).slice(2,8),
      ts:new Date(now-d*D-h*36e5).toISOString(),k,w},ex||{});
    lgRows=[ mk(0,1,'수집','항해일지 도착 위치'),
             mk(0,5,'수집','항해 항적 기록',{n:214,from:new Date(now-8*36e5).toISOString(),to:new Date(now-5*36e5).toISOString()}),
             mk(0,9,'수집','항해일지 출발 위치'),
             mk(1,3,'제공','정박지 자리를 커뮤니티에 올림'),
             mk(1,4,'수집','정박지 자리 잡기'),
             mk(2,2,'수집','지금 있는 곳 날씨·물때'),
             mk(4,6,'수집','홈포트 위치 잡기') ];
    lgSave(); openLocLog();
  });
  await pg.waitForTimeout(700);
  await pg.screenshot({path:'loclog_ko.png'});
  await pg.evaluate(()=>{ setLang && setLang('en'); });
  await pg.waitForTimeout(900);
  await pg.evaluate(()=>{ openLocLog(); });
  await pg.waitForTimeout(700);
  await pg.screenshot({path:'loclog_en.png'});
  await pg.evaluate(()=>{ setLang && setLang('ko'); openDrawer(); });
  await pg.waitForTimeout(600);
  await pg.screenshot({path:'loclog_drawer.png'});
  await br.close(); server.close();
  console.log('찍었다');
})();
