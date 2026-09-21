const { chromium } = require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const server=http.createServer((rq,rs)=>{const f=path.join(__dirname,rq.url==='/'?'work.html':rq.url.split('?')[0]);
 fs.readFile(f,(e,d)=>{if(e){rs.writeHead(404);rs.end();return;}
  if(f.endsWith('.woff2'))rs.setHeader('Content-Type','font/woff2');rs.writeHead(200);rs.end(d);});});
const sub=async(pg,name)=>{ await pg.evaluate(n=>{
  const b=[...document.querySelectorAll('.hsub')].find(e=>e.textContent.trim()===n); if(b) b.click(); }, name);
  await pg.waitForTimeout(1000); };
(async()=>{
 await new Promise(r=>server.listen(0,r));
 const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const pg=await(await br.newContext({ locale:'ko-KR',viewport:{width:390,height:820},isMobile:true,hasTouch:true,deviceScaleFactor:2})).newPage();
 await pg.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'networkidle'});
 await pg.waitForTimeout(1500);
 await pg.evaluate(()=>{ try{skipWelcome();}catch(_){}
   try{localStorage.removeItem('bt_seriesreq');}catch(_){}
   boats=[{id:'B1',name:'SHUNSHINE',type:'sail',port:'여수 웅천마리나',lat:34.7404,lon:127.7454}];
   seedRanks(boats[0]); boats[0].members={U1:ownerRank(boats[0]).id};
   currentBoatId='B1'; save&&save(); applyBoatName();
   window.__spots=null; window.__user=null; switchTab('home'); });
 await pg.waitForTimeout(1000);
 await pg.click('#tabCommunity'); await pg.waitForTimeout(800);
 await sub(pg,'정박지');
 await pg.screenshot({path:'v_spotoff.png'});
 // 연재
 await pg.evaluate(()=>{ window.__user={uid:'U9',email:'a@b.c',name:'김보통'}; adminMe=null;
   window.__series={list:async()=>[],put:async()=>{},del:async()=>{}}; });
 await sub(pg,'뉴스');
 await pg.evaluate(()=>{ newsSub='sr'; renderNews(); }); await pg.waitForTimeout(900);
 await pg.screenshot({path:'v_series.png'});
 await br.close(); server.close();
})();
