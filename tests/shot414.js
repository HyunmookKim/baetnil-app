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
  await pg.evaluate(()=>{
    lockers=[{id:'L1',zone:'선수',label:'선수 창고',x:10,y:8,w:32,h:22},
             {id:'L2',zone:'선수',label:'앵커 락커',x:52,y:8,w:32,h:22},
             {id:'L3',zone:'중앙',label:'세일 락커',x:10,y:38,w:32,h:22},
             {id:'L4',zone:'중앙',label:'갤리 하부장',x:52,y:38,w:32,h:22},
             {id:'L5',zone:'선미',label:'라자렛',x:10,y:68,w:32,h:22},
             {id:'L6',zone:'선미',label:'코크핏 락커',x:52,y:68,w:32,h:22}];
    items=[{id:1,name:'구명조끼',qty:6,unit:'개',lockerId:'L3',zone:'중앙',locker:'세일 락커',parentId:null,photos:[],note:''},
           {id:2,name:'공구 상자',box:true,lockerId:'L5',zone:'선미',locker:'라자렛',parentId:null,photos:[],note:''},
           {id:3,name:'예비 임펠러',qty:2,unit:'개',lockerId:'L5',zone:'선미',locker:'라자렛',parentId:2,photos:[],note:''}];
    save(); switchTab('boat'); setBoatSubTab('stow'); refreshBoxes();
  });
  await pg.waitForTimeout(1000);
  await pg.evaluate(()=>{ openLocker('L3'); });
  await pg.waitForTimeout(700);
  await pg.evaluate(()=>{ toggleMove(1); });
  await pg.waitForTimeout(600);
  await pg.screenshot({path:'mv_panel.png'});
  await pg.evaluate(()=>{ mvFromMap(1); });
  await pg.waitForTimeout(800);
  await pg.screenshot({path:'mv_pick.png'});
  const b = await pg.$('#bx_L5');
  if(b){ await b.click(); await pg.waitForTimeout(900); }
  await pg.screenshot({path:'mv_box.png'});
  await br.close(); server.close(); console.log('ok');
})();
