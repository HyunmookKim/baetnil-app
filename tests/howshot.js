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
  // ★ 손으로 만든 base64 는 깨지기 쉽다 — 브라우저에서 진짜 그림을 그려 쓴다
  const png = await p.evaluate(()=>{
    const c=document.createElement('canvas'); c.width=640; c.height=360;
    const g=c.getContext('2d');
    g.fillStyle='#12324a'; g.fillRect(0,0,640,360);
    g.fillStyle='#8ab4d8'; g.fillRect(40,60,560,240);
    g.fillStyle='#0b1420'; g.font='bold 34px sans-serif'; g.fillText('해수펌프 커버', 90, 200);
    return c.toDataURL('image/jpeg',0.85);
  });
  await p.evaluate((pic)=>{
    maint = [{ id:'m1', grp:'추진', name:'해수펌프 임펠러 교체', months:12, unit:'m',
      lastDate:'2026-08-01', note:'김사장 010-1234-5678', photos:[], pin:null, history:[],
      hard:3, work:1.5, cost:'35000', used:'임펠러 A-3 · 육각렌치 6mm', pub:true,
      how:[{v:'해수 씨콕을 잠근다. 안 잠그면 커버를 여는 순간 물이 들어온다.', p:pic},
           {v:'펌프 커버 볼트 6개를 푼다. 아래 두 개가 잘 안 보인다.', p:pic},
           {v:'임펠러를 빼고 날개가 부러진 것이 없는지 센다. 없으면 열교환기에 가 있다.', p:''}] }];
    saveMR(); switchTab('boat'); setBoatSubTab('maint');
  }, png);
  await p.waitForTimeout(700);
  await p.evaluate(()=>openMR('maint','m1'));
  await p.waitForTimeout(700);
  await p.evaluate(()=>{ const el=document.getElementById('mrPanel');
    const y=[...el.querySelectorAll('.secl')].find(x=>/정비 절차/.test(x.textContent));
    if(y) y.scrollIntoView({block:'start'}); });
  await p.waitForTimeout(400);
  await p.screenshot({ path:'how_panel.png' });
  console.log(errs.length ? ('★ 오류: '+errs.join(' | ')) : '오류 없음');
  await b.close(); srv.close();
})();
