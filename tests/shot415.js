const { chromium } = require('playwright');
const http=require('http'), fs=require('fs'), path=require('path');
const FILE='work.html';
const server=http.createServer((rq,rs)=>{const f=path.join(__dirname,rq.url==='/'?FILE:rq.url.split('?')[0]);
  fs.readFile(f,(e,d)=>{if(e){rs.writeHead(404);rs.end();return;}
    if(f.endsWith('.woff2'))rs.setHeader('Content-Type','font/woff2');rs.writeHead(200);rs.end(d);});});
(async()=>{
  await new Promise(r=>server.listen(0,r));
  const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const ctx=await br.newContext({ locale:'ko-KR',viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const pg=await ctx.newPage();
  await pg.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'networkidle'});
  await pg.waitForTimeout(900);
  await pg.evaluate(()=>{window.alert=()=>{};window.confirm=()=>true;
    window.__user={uid:'u',email:'t@t',name:'시험'};
    try{skipWelcome();}catch(_){}unlocked=true;openBoatSetup();});
  await pg.waitForTimeout(400);
  await pg.evaluate(()=>{document.getElementById('nbName').value='시험호';createBoat();});
  await pg.waitForTimeout(1500);
  await pg.evaluate(()=>{ openDrawer(); });
  await pg.waitForTimeout(700);
  await pg.screenshot({path:'l415_drawer.png'});
  await pg.evaluate(()=>{ closeDrawer(); locSet(true); openLegal('location'); });
  await pg.waitForTimeout(800);
  // 아래로 내려서 동의 칸을 본다
  await pg.evaluate(()=>{ const el=document.getElementById('mrPanel'); el.scrollTop = el.scrollHeight; window.scrollTo(0, document.body.scrollHeight); });
  await pg.waitForTimeout(600);
  await pg.screenshot({path:'l415_legal.png'});
  await br.close(); server.close(); console.log('ok');
})();
