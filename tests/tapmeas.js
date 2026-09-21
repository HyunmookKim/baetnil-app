// 손가락 크기 재기 — 화면을 돌며 누르는 것들의 크기를 잰다.
// 고치기 전에 어디가 얼마나 작은지 정확히 보려고 만들었다.
const { chromium } = require('playwright');
const http=require('http'), fs=require('fs'), path=require('path');
const FILE = process.argv[2] || 'work.html';
const server = http.createServer((rq,rs)=>{
  const f = path.join(__dirname, rq.url==='/'?FILE:rq.url.split('?')[0]);
  fs.readFile(f,(e,d)=>{ if(e){rs.writeHead(404);rs.end();return;}
    if(f.endsWith('.woff2')) rs.setHeader('Content-Type','font/woff2');
    rs.writeHead(200); rs.end(d); });
});

const PROBE = `(() => {
  const out = [];
  const vis = el => { const r = el.getBoundingClientRect();
    if(r.width < 1 || r.height < 1) return false;
    const st = getComputedStyle(el);
    return st.display!=='none' && st.visibility!=='hidden' && +st.opacity > .05; };
  const label = el => (el.innerText || el.value || el.getAttribute('aria-label') || el.title || '')
    .replace(/\\s+/g,' ').trim().slice(0,26);
  const where = el => { let p=el,s=[];
    for(let i=0;p&&i<3;i++,p=p.parentElement)
      s.push(p.tagName.toLowerCase()+(p.id?'#'+p.id:'')+
        (p.className&&typeof p.className==='string'?'.'+p.className.trim().split(/\\s+/).slice(0,2).join('.'):''));
    return s.join(' < '); };
  document.querySelectorAll('button,.btn,.minib,.tab,select,a[onclick],[role=button],input[type=checkbox],.fopt,.x,.ckdel,.helpb,.lkt,.hsub,.engb').forEach(el=>{
    if(!vis(el)) return;
    const r = el.getBoundingClientRect();
    if(r.height >= 44 && r.width >= 44) return;
    out.push({ t: label(el), h: Math.round(r.height), w: Math.round(r.width),
               x: Math.round(r.left), y: Math.round(r.top), s: where(el) });
  });
  // 가로로 넘치는 줄
  const wide = [];
  document.querySelectorAll('div,section').forEach(el=>{
    if(!vis(el)) return;
    if(el.scrollWidth > el.clientWidth + 4 && el.clientWidth > 100)
      wide.push({ id: el.id||el.className, sw: el.scrollWidth, cw: el.clientWidth });
  });
  return { small: out, wide };
})()`;

(async()=>{
  await new Promise(r=>server.listen(0,r));
  const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const ctx=await br.newContext({ locale:'ko-KR',viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const pg=await ctx.newPage();
  pg.on('pageerror',e=>console.log('  터짐: '+String(e).slice(0,110)));
  await pg.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'networkidle'});
  await pg.waitForTimeout(900);
  await pg.evaluate(()=>{ window.alert=()=>{}; window.confirm=()=>true;
    try{skipWelcome();}catch(_){} unlocked=true; openBoatSetup(); });
  await pg.waitForTimeout(500);
  await pg.evaluate(()=>{ document.getElementById('nbName').value='시험호'; createBoat(); });
  await pg.waitForTimeout(1200);
  // 씨앗 자료
  await pg.evaluate(()=>{
    const p=n=>String(n).padStart(2,'0');
    const d=o=>{const x=new Date(Date.now()+o*864e5);
      return x.getFullYear()+'-'+p(x.getMonth()+1)+'-'+p(x.getDate());};
    maint=[{id:'m1',name:'엔진오일 교체',grp:'엔진',months:12,unit:'m',lastDate:d(-400)},
           {id:'m2',name:'아노드',grp:'선체',months:1,unit:'m',lastDate:d(-20)}];
    lockers=[{id:'L1',zone:'선수',label:'선수 창고',x:10,y:10,w:30,h:20}];
    items=[{id:'i1',name:'구명조끼',qty:6,unit:'개',lockerId:'L1',photos:[],note:''}];
    voyage=[{id:'v1',date:d(-1),title:'개도 한 바퀴',from:'여수',to:'여수',
             logs:[{id:'g1',t:Date.now(),kind:'note',memo:'좋다'}],pub:true}];
    runs=[{id:'u1',date:d(-3),hours:'3.5',purpose:'충전'}];
    fuel=[{id:'f1',date:d(-9),liters:'180',cost:'315000',full:true}];
    saveMR();
  });

  const SCREENS = [
    ['홈·오늘',      ()=>{ switchTab('home'); setHomeSub('today'); }],
    ['홈·점검',      ()=>{ switchTab('home'); setHomeSub('check'); }],
    ['배·정기점검',  ()=>{ switchTab('boat'); setBoatSubTab('maint'); }],
    ['배·물품(도면)',()=>{ switchTab('boat'); setBoatSubTab('stow'); if(!lkEdit) toggleLkEdit(); }],
    ['배·기록',      ()=>{ switchTab('boat'); setBoatSubTab('log'); }],
    ['항해일지',     ()=>{ switchTab('voyage'); }],
    ['커뮤니티',     ()=>{ switchTab('com'); }],
  ];
  const all = {};
  for(const [name, fn] of SCREENS){
    await pg.evaluate(f=>{ try{ (new Function(f))(); }catch(e){ console.log(e); } }, '('+fn.toString()+')()');
    await pg.waitForTimeout(800);
    const r = await pg.evaluate(PROBE);
    all[name] = r;
    console.log('\n════ '+name+' ════');
    r.small.sort((a,b)=>(a.h*a.w)-(b.h*b.w)).forEach(o=>
      console.log('  '+String(o.w).padStart(4)+'×'+String(o.h).padStart(3)+'  '+
        (o.t||'(글자 없음)').padEnd(26)+'  '+o.s));
    r.wide.forEach(o=>console.log('  ↔ 넘침 '+o.sw+' > '+o.cw+'  '+o.id));
  }
  // 항해 기록 창 (중간기록 종류 select)
  await pg.evaluate(()=>{ switchTab('voyage'); });
  await pg.waitForTimeout(600);
  await pg.evaluate(()=>{ try{ openMR('voyage','v1'); }catch(e){ console.log(String(e)); } });
  await pg.waitForTimeout(900);
  const vr = await pg.evaluate(PROBE);
  console.log('\n════ 항해 기록 창 ════');
  vr.small.sort((a,b)=>(a.h*a.w)-(b.h*b.w)).forEach(o=>
    console.log('  '+String(o.w).padStart(4)+'×'+String(o.h).padStart(3)+'  '+
      (o.t||'(글자 없음)').padEnd(26)+'  '+o.s));

  fs.writeFileSync(path.join(__dirname,'tapmeas.json'), JSON.stringify(all,null,1));
  await br.close(); server.close();
})();
