// 화면칸이 두 개 이상 동시에 보이는 순간을 잡는다 (이전 창이 이어져 나오는 증상)
const { chromium } = require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const F=process.argv[2]||'work.html';
const server=http.createServer((rq,rs)=>{const f=path.join(__dirname,rq.url==='/'?F:rq.url.split('?')[0]);
 fs.readFile(f,(e,d)=>{if(e){rs.writeHead(404);rs.end();return;}
  const ct=f.endsWith('.js')?'text/javascript':f.endsWith('.webmanifest')?'application/manifest+json':'text/html';
  rs.writeHead(200,{'Content-Type':ct}); rs.end(d);});});
(async()=>{
 await new Promise(r=>server.listen(0,r));
 const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const pg=await(await br.newContext({ locale:'ko-KR',viewport:{width:390,height:820},isMobile:true,hasTouch:true})).newPage();
 pg.on('console', m=>{ const t=m.text(); if(t.startsWith('[W]')) console.log(t); });
 await pg.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'domcontentloaded'});

 // 앱이 뜨자마자 감시를 건다
 await pg.evaluate(()=>{
   window.__log = [];
   const wrap = n => { const f = window[n]; if(typeof f!=='function' || f.__w) return;
     const g = function(){ window.__log.push({t:Date.now(), n, a:[...arguments].map(String).join(',')});
       return f.apply(this, arguments); };
     g.__w = true; window[n] = g; };
   window.__armWatch = () => {
     ['switchTab','setHomeSub','setBoatSubTab','setComSub','showPanel','closeBoat',
      'screenPush','screenPop','closeTopScreen','repaintNow','toggleView'].forEach(wrap);
     // 부모가 아닌 '내용칸' 만 본다
     const IDS = (window.TAB_CONTENT||[]).filter(id=>id!=='communityWrap');
     window.__bad = [];
     setInterval(()=>{
       const on = IDS.filter(id=>{ const e=document.getElementById(id);
         return e && getComputedStyle(e).display!=='none' && e.offsetHeight>0; });
       if(on.length>1){
         const key = on.join('+');
         if(!window.__bad.some(b=>b.key===key)){
           const last = window.__log.slice(-6).map(x=>x.n+'('+x.a+')').join(' → ');
           window.__bad.push({key, last});
           console.log('[W] 두 칸이 같이 보임: '+key+'   ← 직전: '+last);
         }
       }
     }, 60);
   };
 });
 await pg.evaluate(()=>window.__armWatch());
 await pg.waitForTimeout(4000);          // 앱 시작이 다 끝날 때까지 지켜본다

 await pg.evaluate(()=>{ try{skipWelcome();}catch(_){}
   boats=[{id:'B1',name:'S',type:'sail',port:'여수',lat:34.74,lon:127.74}];
   seedRanks(boats[0]); boats[0].members={U1:ownerRank(boats[0]).id};
   currentBoatId='B1'; save&&save(); applyBoatName(); });

 // 사람처럼 이리저리 눌러 본다
 const subClick = async n => { await pg.evaluate(x=>{
   const b=[...document.querySelectorAll('.hsub')].find(e=>e.textContent.trim()===x); if(b) b.click(); }, n);
   await pg.waitForTimeout(500); };
 const tabs = ['#tabHome','#tabBoat','#tabVoyage','#tabCommunity'];
 for(let r=0;r<3;r++){
   for(const t of tabs){ await pg.click(t); await pg.waitForTimeout(400); }
   await pg.click('#tabBoat'); await subClick('정기점검'); await subClick('적재표'); await subClick('연료');
   await pg.click('#tabCommunity'); await subClick('정박지'); await subClick('뉴스'); await subClick('글판');
   await pg.click('#tabHome'); await subClick('날씨 · 물때'); await subClick('출항 전 점검'); await subClick('오늘');
 }
 // 화면(screen)을 열었다 닫았다
 for(let r=0;r<2;r++){
   await pg.evaluate(()=>{ try{ openBoat(); }catch(_){} }); await pg.waitForTimeout(500);
   await pg.evaluate(()=>{ try{ closeTopScreen(); }catch(_){} }); await pg.waitForTimeout(400);
   await pg.goBack().catch(()=>{}); await pg.waitForTimeout(400);
 }
 const bad = await pg.evaluate(()=>window.__bad||[]);
 console.log(bad.length ? ('★ 겹친 경우 '+bad.length+'가지') : '겹친 적 없음');
 await br.close(); server.close();
})();
