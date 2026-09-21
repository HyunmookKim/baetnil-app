const { chromium } = require('playwright');
const http=require('http'), fs=require('fs'), path=require('path');
const FILE = process.argv[2] || 'work.html';
const TAG  = process.argv[3] || 'now';
const server = http.createServer((rq,rs)=>{
  const f = path.join(__dirname, rq.url==='/'?FILE:rq.url.split('?')[0]);
  fs.readFile(f,(e,d)=>{ if(e){rs.writeHead(404);rs.end();return;}
    if(f.endsWith('.woff2')) rs.setHeader('Content-Type','font/woff2');
    rs.writeHead(200); rs.end(d); });
});
(async()=>{
  await new Promise(r=>server.listen(0,r));
  const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const ctx=await br.newContext({ locale:'ko-KR',viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const pg=await ctx.newPage();
  pg.on('pageerror',e=>console.log('터짐: '+String(e).slice(0,120)));
  await pg.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'networkidle'});
  await pg.waitForTimeout(900);
  await pg.evaluate(()=>{ window.alert=()=>{}; window.confirm=()=>true;
    try{skipWelcome();}catch(_){} unlocked=true; openBoatSetup(); });
  await pg.waitForTimeout(400);
  await pg.evaluate(()=>{ document.getElementById('nbName').value='시험호'; createBoat(); });
  await pg.waitForTimeout(1200);
  await pg.evaluate(()=>{
    const p=n=>String(n).padStart(2,'0');
    const d=o=>{const x=new Date(Date.now()+o*864e5);
      return x.getFullYear()+'-'+p(x.getMonth()+1)+'-'+p(x.getDate());};
    maint=[{id:'m1',name:'엔진오일 교체',grp:'엔진',months:12,unit:'m',lastDate:d(-400)},
           {id:'m2',name:'아노드 교환',grp:'선체',months:1,unit:'m',lastDate:d(-20)}];
    lockers=[{id:'L1',zone:'선수',label:'선수 창고',x:10,y:10,w:30,h:20}];
    items=[{id:'i1',name:'구명조끼',qty:6,unit:'개',lockerId:'L1',photos:[],note:''}];
    voyage=[{id:'v1',date:d(-1),title:'개도 한 바퀴',from:'여수',to:'여수',depH:'08:00',arrH:'15:20',
             logs:[{id:'g1',time:'09:30',kind:'세일 올림',text:'제노아 폄'},
                   {id:'g2',time:'12:10',kind:'포인트',text:'개도 남쪽'}],pub:true}];
    saveMR();
  });
  const shots = [
    ['home',  ()=>{ switchTab('home'); setHomeSub('today'); }],
    ['check', ()=>{ switchTab('home'); setHomeSub('check'); }],
    ['maint', ()=>{ switchTab('boat'); setBoatSubTab('maint'); }],
    ['stow',  ()=>{ switchTab('boat'); setBoatSubTab('stow'); if(!lkEdit) toggleLkEdit(); }],
    ['voy',   ()=>{ switchTab('voyage'); }],
  ];
  for(const [n,f] of shots){
    await pg.evaluate(s=>{ (new Function(s))(); }, '('+f.toString()+')()');
    await pg.waitForTimeout(800);
    await pg.screenshot({path: path.join(__dirname,'s402_'+TAG+'_'+n+'.png')});
  }
  await pg.evaluate(()=>{ switchTab('voyage'); });
  await pg.waitForTimeout(500);
  await pg.evaluate(()=>{ openMR('voyage','v1'); });
  await pg.waitForTimeout(900);
  await pg.evaluate(()=>{ const el=document.getElementById('mrPanel');
    const s=[...el.querySelectorAll('.logkind')][0]; if(s) s.scrollIntoView({block:'center'}); });
  await pg.waitForTimeout(400);
  await pg.screenshot({path: path.join(__dirname,'s402_'+TAG+'_log.png')});
  // 머리줄 높이
  const h = await pg.evaluate(()=>{ const e=document.querySelector('header');
    return e ? Math.round(e.getBoundingClientRect().height) : null; });
  console.log('머리줄 높이: '+h+'px');
  await br.close(); server.close();
})();
