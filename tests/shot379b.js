const { chromium } = require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const FILE=process.argv[2]||'work.html';
const server=http.createServer((rq,rs)=>{const f=path.join(__dirname,rq.url==='/'?FILE:rq.url.split('?')[0]);
  fs.readFile(f,(e,d)=>{if(e){rs.writeHead(404);rs.end();return;}rs.writeHead(200);rs.end(d);});});
(async()=>{
  await new Promise(r=>server.listen(0,r));
  const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await (await br.newContext({ locale:'ko-KR',viewport:{width:390,height:844},isMobile:true,hasTouch:true})).newPage();
  await pg.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'networkidle'});
  await pg.waitForTimeout(900);
  await pg.evaluate(()=>{
    try{skipWelcome();}catch(_){}
    window.__user={uid:'U1',name:'나'}; window.__cmt=null; window.__pub={};
    window.__tr={ async get(){ return { intro:
      '블라디보스토크에 있는 세일링 요트입니다.\n\n같이 타실 분을 늘 찾고 있습니다. 초보자도 환영합니다.',
      lang:'ko', n:90 }; } };
    switchTab('community'); try{setComSub('explore');}catch(_){}
  });
  await pg.waitForTimeout(700);
  await pg.evaluate(()=>{
    boatPageData={ id:'B9', name:'Мечта', typeName:'세일링 요트', port:'Владивосток',
      intro:[{t:'text',v:'Парусная яхта во Владивостоке.'},
             {t:'text',v:'Всегда ищем компанию. Новички тоже приветствуются.'}],
      voyage:[], spec:{} };
    boatPageTab='intro'; paintBoatPage();
  });
  await pg.waitForTimeout(1400);
  await pg.screenshot({path:'v_tr_boat1.png'});
  await pg.click("#mrPanel button[onclick*=\"trGo('boatPublic','B9')\"]");
  await pg.waitForTimeout(900);
  await pg.screenshot({path:'v_tr_boat2.png'});
  await br.close(); server.close();
})();
