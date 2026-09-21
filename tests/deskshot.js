const { chromium } = require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const server=http.createServer((rq,rs)=>{const f=path.join(__dirname,rq.url==='/'?'work.html':rq.url.split('?')[0]);
 fs.readFile(f,(e,d)=>{if(e){rs.writeHead(404);rs.end();return;}
  if(f.endsWith('.woff2'))rs.setHeader('Content-Type','font/woff2');rs.writeHead(200);rs.end(d);});});
(async()=>{
 await new Promise(r=>server.listen(0,r));
 const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const ctx=await br.newContext({ locale:'ko-KR',viewport:{width:1440,height:900}});
 const pg=await ctx.newPage();
 await pg.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'networkidle'});
 await pg.waitForTimeout(900);
 await pg.evaluate(()=>{try{skipWelcome();}catch(_){}
   window.__user={uid:'U1',email:'a@b.c',name:'김선장'}; me=window.__user;
   boats=[{id:'B1',name:'테스트호',type:'sail',port:'여수 웅천마리나',maker:'Beneteau',model:'First 45',year:2007,loa:13.7}];
   seedRanks(boats[0]); boats[0].members={U1:ownerRank(boats[0]).id};
   currentBoatId='B1'; window.currentBoatId='B1'; unlocked=true;
   try{ dgImgs={plan:DG_BUILTIN.sail.plan, side:DG_BUILTIN.sail.side}; }catch(_){}
   try{ lockers=[]; lkAdd({x:10,y:10,w:14,h:9},'갤리','싱크대 아래'); lkAdd({x:66,y:70,w:12,h:8},'선미','선미 창고'); }catch(_){}
   try{ go('today'); }catch(_){}
 });
 await pg.waitForTimeout(700);
 await pg.screenshot({path:'desk_today.png'});
 await pg.evaluate(()=>{ try{ go('stow'); }catch(_){ try{ openStow(); }catch(_){} } });
 await pg.waitForTimeout(700);
 await pg.screenshot({path:'desk_stow.png'});
 console.log(await pg.evaluate(()=>JSON.stringify({
   w:innerWidth, body:Math.round(document.body.getBoundingClientRect().width),
   scrollW:document.documentElement.scrollWidth })));
 await br.close(); server.close();
})();
