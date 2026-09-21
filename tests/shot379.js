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
    window.__user={uid:'U1',name:'나'}; window.__cmt=null;
    window.__tr={ async get(){ return { title:'부산의 좋은 정박지',
      body:'수심은 4미터입니다.\n\n바닥은 모래라 잘 물립니다. 남서풍이 불면 조금 흔들립니다.',
      lang:'ko', n:80 }; } };
    talkList=[{id:'T1',kind:'free',region:'그 밖',title:'Хорошая стоянка в Пусане',
      blocks:[{t:'text',v:'Глубина четыре метра.'},
              {t:'text',v:'Дно песчаное, держит хорошо. При юго-западном ветре немного качает.'}],
      body:'Глубина четыре метра.\n\nДно песчаное, держит хорошо. При юго-западном ветре немного качает.',
      by:'U9',byName:'Иван',ts:'2026-08-01T00:00:00.000Z',likeN:2}];
    talkCmts.T1=[];
    switchTab('community'); try{setComSub('talk');}catch(_){}
  });
  await pg.waitForTimeout(600);
  await pg.evaluate(()=>{ openTalk('T1');
  });
  await pg.waitForTimeout(500);
  await pg.screenshot({path:'v_tr_before.png'});
  await pg.click("#mrPanel button[onclick*=\"trGo('community','T1')\"]");
  await pg.waitForTimeout(700);
  await pg.screenshot({path:'v_tr_after.png'});
  await br.close(); server.close();
})();
