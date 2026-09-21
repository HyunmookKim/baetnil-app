const { chromium } = require('playwright');
const http=require('http'), fs=require('fs'), path=require('path');
const FILE = process.argv[2] || 'work.html';
const srv = http.createServer((q,r)=>{ const f=path.join(__dirname, q.url==='/'?FILE:q.url.split('?')[0]);
  fs.readFile(f,(e,d)=>{ if(e){r.writeHead(404);r.end();return;} r.writeHead(200); r.end(d); }); });
(async()=>{
  await new Promise(r=>srv.listen(0,r));
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const p=await(await b.newContext({ locale:'ko-KR',viewport:{width:390,height:844},isMobile:true,hasTouch:true})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,140)));
  await p.goto('http://127.0.0.1:'+srv.address().port+'/',{waitUntil:'networkidle'});
  await p.waitForTimeout(900);
  await p.evaluate(()=>{ window.tell=()=>Promise.resolve(); window.ask=()=>Promise.resolve(true);
    try{skipWelcome();}catch(_){} unlocked=true; openBoatSetup(); });
  await p.waitForTimeout(400);
  await p.evaluate(()=>{ document.getElementById('nbName').value='여수 SHUNSHINE'; createBoat(); });
  await p.waitForTimeout(1500);
  await p.evaluate(()=>{
    const b2 = curBoat(); setPub(b2,'voyage',true);
    voyage = [{ id:'v1', date:'2026-08-28', title:'개도 한 바퀴', kind:'출조',
      timeOut:'16:43', timeIn:'18:20', posOut:{lat:34.7387,lon:127.6790},
      posIn:{lat:34.5000,lon:127.4000}, logs:[], photos:[] }];
    saveMR(); switchTab('voyage');
  });
  await p.waitForTimeout(600);
  await p.evaluate(()=>openMR('voyage','v1'));
  await p.waitForTimeout(700);
  await p.screenshot({ path:'trip_panel.png' });
  console.log(errs.length ? ('★ 오류: '+errs.join(' | ')) : '오류 없음');
  await b.close(); srv.close();
})();
