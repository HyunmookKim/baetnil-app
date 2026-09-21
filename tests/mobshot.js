const { chromium } = require('playwright');
const http=require('http'), fs=require('fs'), path=require('path');
const FILE = process.argv[2] || 'work.html';
const srv = http.createServer((q,r)=>{ const f=path.join(__dirname, q.url==='/'?FILE:q.url.split('?')[0]);
  fs.readFile(f,(e,d)=>{ if(e){r.writeHead(404);r.end();return;} r.writeHead(200); r.end(d); }); });
(async()=>{
  await new Promise(r=>srv.listen(0,r));
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const p=await(await b.newContext({ locale:'ko-KR',viewport:{width:390,height:844},isMobile:true,hasTouch:true})).newPage();
  await p.goto('http://127.0.0.1:'+srv.address().port+'/',{waitUntil:'networkidle'});
  await p.waitForTimeout(900);
  await p.evaluate(()=>{ window.__user={uid:'u',email:'t@t',name:'시험'};
    window.tell=()=>Promise.resolve(); window.ask=()=>Promise.resolve(true);
    try{skipWelcome();}catch(_){} unlocked=true; openBoatSetup(); });
  await p.waitForTimeout(400);
  await p.evaluate(()=>{ document.getElementById('nbName').value='여수 SHUNSHINE'; createBoat(); });
  await p.waitForTimeout(1500);
  // 서류·예비품 자료를 넣어 오늘 화면 카드를 띄운다
  await p.evaluate(()=>{
    const d = n => { const x=new Date(); x.setDate(x.getDate()+n);
      const p2=v=>String(v).padStart(2,'0'); return x.getFullYear()+'-'+p2(x.getMonth()+1)+'-'+p2(x.getDate()); };
    vdocs = [ {id:'d1', title:'선박검사증서', dkind:'선박검사증서', expiry:d(-5)},
              {id:'d2', title:'보험증권', dkind:'보험증권', expiry:d(40)} ];
    items = [ {id:1, lockerId:'gal_sh2', name:'임펠러', qty:'0', unit:'개', min:1, note:'', photos:[]},
              {id:2, lockerId:'gal_sh2', name:'연료필터', qty:'1', unit:'개', min:2, note:'', photos:[]} ];
    saveMR(); switchTab('home'); renderHome();
  });
  await p.waitForTimeout(700);
  await p.screenshot({ path:'mob_home.png' });
  // MOB 화면
  await p.evaluate(()=>{ trkNow = { vid:'v', pts:[{la:34.7212,lo:127.6634,t:new Date().toISOString()}] };
    mobMark(); });
  await p.waitForTimeout(900);
  await p.evaluate(()=>{ // 배가 조금 움직인 척 — 방위·거리가 나오는지
    trkNow.pts.push({la:34.7250,lo:127.6700,t:new Date().toISOString()}); mobPaint(); });
  await p.waitForTimeout(300);
  await p.screenshot({ path:'mob_panel.png' });
  await b.close(); srv.close();
  console.log('찍음');
})();
