const { chromium } = require('playwright');
const http=require('http'), fs=require('fs'), path=require('path');
const FILE = process.argv[2] || 'work.html';
const srv = http.createServer((q,r)=>{ const f=path.join(__dirname, q.url==='/'?FILE:q.url.split('?')[0]);
  fs.readFile(f,(e,d)=>{ if(e){r.writeHead(404);r.end();return;} r.writeHead(200); r.end(d); }); });
(async()=>{
  await new Promise(r=>srv.listen(0,r));
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const ctx = await b.newContext({ locale:'ko-KR',viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
  await p.goto('http://127.0.0.1:'+srv.address().port+'/',{waitUntil:'networkidle'});
  await p.waitForTimeout(900);
  await p.evaluate(()=>{ window.__user={uid:'u',email:'t@t',name:'시험'};
    window.tell=()=>Promise.resolve(); window.ask=()=>Promise.resolve(true);
    try{skipWelcome();}catch(_){} unlocked=true; openBoatSetup(); });
  await p.waitForTimeout(400);
  await p.evaluate(()=>{ document.getElementById('nbName').value='여수 SHUNSHINE'; createBoat(); });
  await p.waitForTimeout(1500);

  // ① 빈 장비 화면
  await p.evaluate(()=>{ setBoatSubTab('gear'); });
  await p.waitForTimeout(500);
  await p.screenshot({ path:'gear_empty.png' });
  const empty = await p.evaluate(()=> document.getElementById('gearList').innerText.slice(0,80));

  // ② 장비를 몇 개 넣는다
  await p.evaluate(()=>{
    maint.push({ id:'g1', typ:'gear', name:'', sys:'추진', kind:'엔진', maker:'Yanmar',
                 model:'4JH4E', sn:'E1234', since:'2019-05-01', note:'', photos:[], pin:{map:'plan',x:44,y:60}, manual:'' });
    maint.push({ id:'g2', typ:'gear', name:'', sys:'추진', kind:'해수펌프', maker:'Jabsco',
                 model:'50080', sn:'', since:'', note:'', photos:[], pin:null, manual:'' });
    maint.push({ id:'g3', typ:'gear', name:'선수 윈들러스', sys:'계류·묘박', kind:'윈들러스',
                 maker:'Lewmar', model:'V700', sn:'', since:'', note:'', photos:[], pin:null, manual:'' });
    maint.push({ id:'g4', typ:'gear', name:'', sys:'', kind:'', maker:'', model:'', sn:'',
                 since:'', note:'', photos:[], pin:null, manual:'' });
    maint.push({ id:'m1', grp:'추진', name:'임펠러 교체', months:12, unit:'m', lastDate:'2025-06-01',
                 gearId:'g2', note:'', photos:[], pin:null, history:[] });
    repair.push({ id:'r1', grp:'추진', title:'냉각수 누수', status:'open', gearId:'g1',
                  note:'', photos:[], pin:null, created:'2026-07-02', doneDate:'' });
    items.push({ id:77, lockerId:'gal_sh2', name:'임펠러', qty:'2', unit:'개', gearId:'g2', note:'', photos:[] });
    saveMR(); renderGear();
  });
  await p.waitForTimeout(500);
  await p.screenshot({ path:'gear_list.png' });
  const list = await p.evaluate(()=> document.getElementById('gearList').innerText);

  // ③ 장비 상세
  await p.evaluate(()=> openMR('gear','g2'));
  await p.waitForTimeout(500);
  await p.screenshot({ path:'gear_one.png' });
  const one = await p.evaluate(()=> document.getElementById('mrPanel').innerText);

  // ④ 정비 창에 장비 칸이 뜨는가
  await p.evaluate(()=>{ closeMR(); setBoatSubTab('maint'); });
  await p.waitForTimeout(400);
  await p.evaluate(()=> openMR('maint','m1'));
  await p.waitForTimeout(400);
  await p.screenshot({ path:'gear_maint.png' });
  const mtxt = await p.evaluate(()=> document.getElementById('mrPanel').innerText);
  const sel = await p.evaluate(()=>{
    const s = [...document.querySelectorAll('#mrPanel select')].find(x=>/gearId/.test(x.getAttribute('onchange')||''));
    return s ? { picked: s.value, label: s.options[s.selectedIndex].text } : null;
  });

  // ⑤ 정비 목록에 장비가 안 섞이는가
  await p.evaluate(()=>{ closeMR(); renderMaintList(); });
  await p.waitForTimeout(300);
  const mlist = await p.evaluate(()=> document.getElementById('maintList').innerText);

  console.log(JSON.stringify({ empty, list, one: one.slice(0,700), mtxt: mtxt.slice(0,600), sel,
    mixed: mlist.split('\n').filter(x=>/윈들러스|4JH4E|Jabsco|E1234/.test(x)), gearCount: (maintText=>0)(0), errs }, null, 1));
  await b.close(); srv.close();
})();
