// 4.85 — 도면과 핀이 갈래마다 제자리로 가는가 (사장님 지적 세 가지)
//
//  ① 「장비」 에서 핀 지정을 눌렀는데 엉뚱한 화면이 떴다
//     — 4.85 에서 정기점검이 장비 안으로 들어가고 장비에 제 도면이 생겼는데
//       핀 지정은 옛 구조(정비 화면)를 그대로 보고 있었다.
//  ② 도면을 보면서 바로 넣는 단추가 없었다
//     — 「도면상에서 추가하는 거면 먼저 핀을 도면에서 찍고 그다음에 내용을 넣도록 해라」
//  ③ 도면에 다 고친 수리까지 다 찍혀서 지금 손볼 곳이 안 보였다
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
    window.tell=m=>{ window.__al.push(String(m).replace(/\n+/g,' / ')); return Promise.resolve(); };
    window.ask =m=>{ window.__al.push(String(m).replace(/\n+/g,' / ')); return Promise.resolve(true); };
    try{skipWelcome();}catch(_){} unlocked=true; openBoatSetup(); });
  await pg.waitForTimeout(400);
  await pg.evaluate(()=>{ document.getElementById('nbName').value='시험호'; createBoat(); });
  await pg.waitForTimeout(1500);
  // 도면 두 장을 넣어 둔다
  await pg.evaluate(p=>{ dgImgs={plan:p,side:p};
    if(typeof dgSmall!=='undefined') dgSmall={plan:p,side:p}; mrMapKind='plan'; }, PNG);

  // ── ① 장비에서 핀 지정 → 장비 도면이 떠야 한다
  await pg.evaluate(()=>{ const g=gearNew(); g.name='빌지펌프'; maint.push(g);
    saveMR(); setBoatSubTab('gear'); setGearSub('gear'); });
  await pg.waitForTimeout(700);
  await pg.evaluate(()=>{ const g=gearRows()[0]; openMR('gear', g.id); });
  await pg.waitForTimeout(400);
  await pg.evaluate(()=>{ pinStart(); });
  await pg.waitForTimeout(700);
  const r1 = await pg.evaluate(()=>({
    화면: curScreen(), 갈래: gearView, 통: boatSubTab,
    도면보임: (document.getElementById('mrMapWrap')||{}).style?.display !== 'none',
    그림: !!document.querySelector('#mrMap img'),
    잡힘: !!pinTarget, 핀갈래: mrPinKind() }));
  T('★ 장비에서 핀 지정 — 장비 화면 그대로다 (정기점검으로 안 튄다)',
    r1.화면==='gear' && r1.통==='gear' && r1.갈래==='gear', r1);
  T('★ 도면이 실제로 떠 있다', r1.도면보임 && r1.그림, r1);
  T('★ 찍을 핀이 장비 갈래다', r1.핀갈래==='gear' && r1.잡힘, r1);

  // 진짜로 도면을 눌러 핀이 박히는지
  const box = await pg.$('#mrMap img');
  const bb = await box.boundingBox();
  await pg.mouse.click(bb.x+bb.width*0.5, bb.y+bb.height*0.5);
  await pg.waitForTimeout(600);
  T('★ 장비 핀이 실제로 박힌다', await pg.evaluate(()=>!!(gearRows()[0].pin)),
    await pg.evaluate(()=>gearRows()[0].pin));

  // ── ② 도면을 보면서 「+ 추가」 — 자리를 먼저 찍고 기록이 만들어진다
  await pg.evaluate(()=>{ closeMR(); setGearSub('maint'); mrViewSet('maint','map'); renderGearWrap(); });
  await pg.waitForTimeout(600);
  const 전 = await pg.evaluate(()=>maintRows().length);
  await pg.evaluate(()=>{ pinAddStart('maint'); });
  await pg.waitForTimeout(300);
  T('★ 「+ 추가」 가 자리부터 물어본다', await pg.evaluate(()=>!!(pinTarget && pinTarget.새로)));
  const bb2 = await (await pg.$('#mrMap img')).boundingBox();
  await pg.mouse.click(bb2.x+bb2.width*0.3, bb2.y+bb2.height*0.7);
  await pg.waitForTimeout(700);
  const r2 = await pg.evaluate(()=>{
    const rows = maintRows();
    const last = rows[rows.length-1];
    return { 늘었나: rows.length, 핀: last && last.pin, 열렸나: mrOpenType+'/'+(mrOpenId!=null) };
  });
  T('★ 자리를 찍으면 기록이 새로 생긴다', r2.늘었나 === 전+1, r2);
  T('★ 그 기록에 찍은 자리가 들어 있다', !!(r2.핀 && r2.핀.map), r2);
  T('★ 곧바로 내용을 적는 창이 열린다', r2.열렸나 === 'maint/true', r2);

  // ── ③ 도면에 다 고친 수리는 안 나온다
  await pg.evaluate(()=>{
    closeMR();
    repair = [
      { id:'r1', title:'빌지펌프 소리', status:'open',  grp:'', note:'', photos:[], created:today(), pin:{map:'plan',x:20,y:20} },
      { id:'r2', title:'선실 등 교체', status:'done', grp:'', note:'', photos:[], created:today(), doneDate:today(), pin:{map:'plan',x:60,y:60} }
    ];
    saveMR(); showDone = false; goMaint('repair'); repairView='map'; renderMR();
  });
  await pg.waitForTimeout(700);
  // 핀 하나 = .mpin 하나. 여럿이 겹치면 .mclu 로 묶여 숫자가 뜬다 — 그 수도 함께 센다.
  const 핀수 = () => pg.evaluate(()=>{
    let n = document.querySelectorAll('#mrPan .mpin').length;
    document.querySelectorAll('#mrPan .mclu').forEach(e => { n += Number(e.textContent) || 0; });
    return n;
  });
  const n1 = await 핀수();
  T('★ 다 고친 수리는 도면에 안 찍힌다 (1개만)', n1 === 1, n1);
  // ★ 4.134 에서 자리가 옮겨졌다 — 단추 하나짜리 줄을 없애면서
  //   「도면/목록」·「완료된 수리」 가 갈래 띠(#mntBar3) 안으로 들어갔다.
  //   id(repairDoneBtn)도 같이 없어졌다. 그래서 id 가 아니라
  //   「그 띠 안에 toggleDone() 을 부르는 단추가 하나 있다」 로 잡는다.
  const 단추 = ()=> pg.evaluate(()=>{
    const bs = [...document.querySelectorAll('#repairWrap #mntBar3 button')]
      .filter(b => /toggleDone/.test(b.getAttribute('onclick') || ''));
    const b = bs[0];
    const r = b ? b.getBoundingClientRect() : null;
    return { 수: bs.length, 글: b ? (b.textContent||'').trim() : null,
             보임: !!(r && r.width > 0 && r.height > 0),
             켜짐: !!(b && b.classList.contains('on')),
             높이: r ? Math.round(r.height) : 0,
             // 갈래 띠 밖에 옛 단추가 남아 있으면 안 된다 (줄이 또 생긴다)
             밖에: [...document.querySelectorAll('#repairWrap button')]
                     .filter(b2 => /toggleDone/.test(b2.getAttribute('onclick')||'')
                                && !b2.closest('#mntBar3')).length };
  });
  const btn = await 단추();
  T('★ 「완료된 수리」 단추가 도면에 나와 있다', btn.수 === 1 && btn.보임 && /완료/.test(btn.글||''), btn);
  T('★ 그 단추는 갈래 띠 안에만 있다 (아래 줄에 또 안 만든다)', btn.밖에 === 0, btn);
  T('★ 아직 안 눌렀으니 꺼져 있다', btn.켜짐 === false, btn);
  // 진짜 손가락으로 누른다 — 띠 안으로 들어가면서 깔리지 않았는지까지 본다
  await pg.locator('#repairWrap #mntBar3 button', { hasText:'완료' }).first().click();
  await pg.waitForTimeout(600);
  const n2 = await 핀수();
  T('★ 누르면 다 고친 것까지 보인다 (2개)', n2 === 2, { 전:n1, 후:n2 });
  const btn2 = await 단추();
  T('★ 켜 놓으면 단추도 켜진 꼴로 보인다', btn2.켜짐 === true, btn2);
  await pg.locator('#repairWrap #mntBar3 button', { hasText:'완료' }).first().click();
  await pg.waitForTimeout(500);
  T('★ 다시 누르면 도로 감춘다', (await 핀수()) === 1);
  T('★ 다시 끄면 단추도 꺼진 꼴로 돌아온다', (await 단추()).켜짐 === false);
  // ★ 도면을 볼 때만 뜻이 있는 단추다 — 목록으로 가면 없어야 한다
  await pg.evaluate(()=>{ repairView='list'; renderMR(); });
  await pg.waitForTimeout(500);
  T('★ 목록으로 가면 그 단추는 안 나온다', (await 단추()).수 === 0);
  await pg.evaluate(()=>{ repairView='map'; renderMR(); });
  await pg.waitForTimeout(500);
  T('★ 도면으로 돌아오면 다시 나온다', (await 단추()).수 === 1);

  T('화면에서 터진 곳이 없다', errs.length===0, errs.slice(0,3));
  console.log(`\n합계: ${ok}개 통과 / ${bad}개 실패`);
  await br.close(); server.close(); process.exit(bad?1:0);
})();
