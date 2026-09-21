// 4.87 — 사장님 지적 셋
//  ① 장비에 연결한 수리는 장비 핀을 따라간다 (제 핀을 지웠다고 사라지면 안 된다)
//     이름표는 **수리 제목**이다 — 장비 이름이 아니다
//  ② 장비 통의 도면은 한 장이다 — 장비와 정기점검이 함께 보인다
//  ③ 창 안에서 다른 기록으로 건너갔으면 뒤로 가기는 **바로 앞 기록**으로 간다
const { chromium } = require('playwright');
const http=require('http'), fs=require('fs'), path=require('path');
const FILE = process.argv[2] || 'work.html';
const server = http.createServer((rq,rs)=>{
  const f = ((rq.url === '/' && path.isAbsolute(FILE)) ? FILE : path.join(__dirname, rq.url === '/' ? FILE : rq.url.split('?')[0]));
  fs.readFile(f,(e,d)=>{ if(e){rs.writeHead(404);rs.end();return;}
    if(f.endsWith('.woff2')) rs.setHeader('Content-Type','font/woff2');
    rs.writeHead(200); rs.end(d); });
});
let ok=0,bad=0;
const T=(n,c,w)=>{ if(c){ok++;console.log('통과: '+n);}
  else{bad++;console.log('★ 실패: '+n+(w!==undefined?' — '+JSON.stringify(w).slice(0,240):''));} };
const PNG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

(async()=>{
  await new Promise(r=>server.listen(0,r));
  const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const ctx=await br.newContext({ locale:'ko-KR',viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const pg=await ctx.newPage();
  const errs=[]; pg.on('pageerror',e=>errs.push(String(e).slice(0,140)));
  await pg.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'networkidle'});
  await pg.waitForTimeout(900);
  await pg.evaluate(()=>{ window.__al=[];
    window.tell=m=>{ window.__al.push(String(m)); return Promise.resolve(); };
    window.ask =m=>{ window.__al.push(String(m)); return Promise.resolve(true); };
    try{skipWelcome();}catch(_){} unlocked=true; openBoatSetup(); });
  await pg.waitForTimeout(400);
  await pg.evaluate(()=>{ document.getElementById('nbName').value='시험호'; createBoat(); });
  await pg.waitForTimeout(1500);
  await pg.evaluate(p=>{ dgImgs={plan:p,side:p};
    if(typeof dgSmall!=='undefined') dgSmall={plan:p,side:p}; mrMapKind='plan'; }, PNG);

  await pg.evaluate(()=>{
    maint = [];
    const g = gearNew(); g.name='빌지펌프'; g.pin={map:'plan',x:40,y:40}; maint.push(g);
    maint.push({ id:'m1', grp:'기타', name:'물탱크 물채움', months:2, unit:'w', lastDate:'',
                 note:'', photos:[], pin:{map:'plan',x:70,y:70}, history:[], seed:false });
    repair = [{ id:'r1', title:'빌지펌프 소리 남', status:'open', grp:'', note:'',
                photos:[], pin:null, gearId:String(g.id), created:today() }];
    saveMR();
  });

  // ── ① 수리 도면 — 제 핀이 없어도 장비 자리에 뜬다
  await pg.evaluate(()=>{ goMaint('repair'); repairView='map'; renderMR(); });
  await pg.waitForTimeout(700);
  const r1 = await pg.evaluate(()=>{
    const p = document.querySelector('#mrPan .mpin');
    return { 개수: document.querySelectorAll('#mrPan .mpin').length,
             왼쪽: p && parseFloat(p.style.left), 위: p && parseFloat(p.style.top) };
  });
  T('★★★ 장비에 매인 수리가 장비 자리에 뜬다 (제 핀이 없어도)',
    r1.개수 === 1 && r1.왼쪽 === 40 && r1.위 === 40, r1);
  await pg.evaluate(()=>{ pinTap('repair','r1'); });
  await pg.waitForTimeout(500);
  const 이름 = await pg.evaluate(()=>{ const e=document.querySelector('#mrPan .mtip');
    return e ? e.textContent : null; });
  T('★★★ 이름표가 수리 제목이다 (장비 이름이 아니다)',
    !!이름 && /빌지펌프 소리 남/.test(이름), 이름);

  await pg.evaluate(()=>{ repair[0].pin={map:'plan',x:10,y:10}; saveMR(); renderMR(); });
  await pg.waitForTimeout(600);
  T('★ 제 핀을 찍으면 그것이 이긴다',
    (await pg.evaluate(()=>parseFloat(document.querySelector('#mrPan .mpin').style.left))) === 10);

  // ── ② 장비 통의 도면 — 장비와 정기점검이 함께
  await pg.evaluate(()=>{ closeMR(); setBoatSubTab('gear'); setGearSub('maint');
    mrViewSet('maint','map'); renderGearWrap(); });
  await pg.waitForTimeout(800);
  const r2 = await pg.evaluate(()=>{
    const ps = [...document.querySelectorAll('#mrPan .mpin')];
    let n = ps.length;
    document.querySelectorAll('#mrPan .mclu').forEach(e=>{ n += Number(e.textContent)||0; });
    return { 셈: n, 그림: ps.map(e=>e.textContent) };
  });
  // ★ 4.91 — 사장님이 두 번 말씀하셨다: 「도면에서 그냥 장비만 나오게 하라」.
  //   4.87 에서 둘을 함께 그렸던 것을 물렸다. 한자리에 핀이 겹쳐 서기 때문이다.
  T('★★★ 장비 도면에는 장비만 있다 (정기점검은 안 나온다)', r2.셈 === 1, r2);
  T('★★ 정기점검 그림(🔧)이 장비 도면에 없다', r2.그림.indexOf('🔧') < 0, r2);

  // ── ③ 뒤로 가기는 바로 앞 기록으로
  await pg.evaluate(()=>{ closeMR(); const g=gearRows()[0]; openMR('gear', g.id); });
  await pg.waitForTimeout(400);
  await pg.evaluate(()=>{ openMR('maint','m1'); });
  await pg.waitForTimeout(400);
  T('★ 지금은 정기점검 창이다', (await pg.evaluate(()=>mrOpenType+':'+mrOpenId)) === 'maint:m1');
  T('★ 앞 기록을 기억하고 있다', (await pg.evaluate(()=>mrBack.length)) === 1);
  await pg.evaluate(()=>closeTopScreen());
  await pg.waitForTimeout(500);
  const 뒤 = await pg.evaluate(()=>({ 갈래:mrOpenType, 남은:mrBack.length }));
  T('★★★ 뒤로 가면 목록이 아니라 바로 앞 장비로 돌아온다',
    뒤.갈래 === 'gear' && 뒤.남은 === 0, 뒤);
  await pg.evaluate(()=>closeMR());
  await pg.waitForTimeout(300);
  T('★ 「목록」 으로 나가면 자국도 지운다', (await pg.evaluate(()=>mrBack.length)) === 0);

  T('화면에서 터진 곳이 없다', errs.length===0, errs.slice(0,3));
  console.log(`\n합계: ${ok}개 통과 / ${bad}개 실패`);
  await br.close(); server.close(); process.exit(bad?1:0);
})();
