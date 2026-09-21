// 4.86 — 앱을 덮으면 밀어 둔 것이 올라가는가 · 다시 나오면 받아오는가
//
// ★ 사장님 지적 — 「폰에서 수정한 게 컴퓨터에서 안 보인다」
//   ① 고친 것은 1.2초 뒤에 올리게 밀어 둔다. 그 사이에 앱을 덮으면 안드로이드가
//     타이머를 얼려서 영영 안 돈다 → 그 기록은 폰에만 남는다.
//   ② 컴퓨터는 켤 때 딱 한 번만 받아왔다 → 창을 띄워 둔 채로는 영영 안 받는다.
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
  else{bad++;console.log('★ 실패: '+n+(w!==undefined?' — '+JSON.stringify(w).slice(0,200):''));} };

(async()=>{
  await new Promise(r=>server.listen(0,r));
  const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const ctx=await br.newContext({ locale:'ko-KR',viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const pg=await ctx.newPage();
  const errs=[]; pg.on('pageerror',e=>errs.push(String(e).slice(0,140)));
  await pg.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'networkidle'});
  await pg.waitForTimeout(900);
  // 가짜 클라우드 — 몇 번 올리고 몇 번 받았는지만 센다
  await pg.evaluate(()=>{
    window.__push = 0; window.__pull = 0;
    window.tell = ()=>Promise.resolve(); window.ask = ()=>Promise.resolve(true);
    try{ skipWelcome(); }catch(_){}
    unlocked = true;
    cloud = {
      push: async ()=>{ window.__push++; return { ok:null }; },
      pull: async ()=>{ window.__pull++; return { seeded:true, colls:{} }; },
      pullColl: async ()=>({ mode:'full', rows:[], n:0, u:'' })
    };
    // 이 검사가 보는 것은 「언제 보내는가」 다. 등급 판정은 다른 검사(colltest)가 본다.
    window.canPush = ()=>true;
    pullDone = true; lastPullAt = Date.now();
  });

  // ── ① 고치자마자 앱을 덮는다 (1.2초를 안 기다린다)
  await pg.evaluate(()=>{
    window.__push = 0;
    maint.push({ id:'zz1', grp:'기타', name:'덮기 시험', months:12, unit:'m',
                 lastDate:'', note:'', photos:[], pin:null, history:[], seed:false });
    save();                       // → schedulePush() 가 1.2초 뒤로 밀어 둔다
  });
  await pg.waitForTimeout(150);   // 1.2초가 되기 전에
  T('★ 아직 안 올라갔다 (밀어 둔 상태)', await pg.evaluate(()=>window.__push) === 0);
  T('★ 밀어 둔 것이 있다고 기억한다', await pg.evaluate(()=>pushPending) === true);
  await pg.evaluate(()=>{ appHidden(); });      // 앱을 덮는다
  await pg.waitForTimeout(600);
  T('★★★ 덮는 순간 그 자리에서 올린다 (타이머가 얼어도 안 잃는다)',
    await pg.evaluate(()=>window.__push) >= 1, await pg.evaluate(()=>window.__push));

  // ── ② 다시 앞으로 나오면 받아온다 — 다만 1분 안에는 다시 안 받는다
  await pg.evaluate(()=>{ window.__pull = 0; lastPullAt = Date.now(); });
  await pg.evaluate(()=>appVisible());
  await pg.waitForTimeout(400);
  T('★ 방금 받았으면 또 안 받는다 (읽기 값을 안 흘린다)',
    await pg.evaluate(()=>window.__pull) === 0);
  await pg.evaluate(()=>{ lastPullAt = Date.now() - 120000; });   // 2분 전에 받았다면
  await pg.evaluate(()=>appVisible());
  await pg.waitForTimeout(600);
  T('★★★ 오래됐으면 다시 앞으로 나올 때 받아온다 (창을 띄워 둔 컴퓨터)',
    await pg.evaluate(()=>window.__pull) === 1, await pg.evaluate(()=>window.__pull));

  // ── ③ 보기 전용이면 덮어도 안 올린다 (남의 배를 건드리지 않는다)
  await pg.evaluate(()=>{ window.__push = 0; pushPending = true; unlocked = false; appHidden(); });
  await pg.waitForTimeout(400);
  T('★ 보기 전용이면 덮어도 안 올린다', await pg.evaluate(()=>window.__push) === 0);

  T('화면에서 터진 곳이 없다', errs.length===0, errs.slice(0,3));
  console.log(`\n합계: ${ok}개 통과 / ${bad}개 실패`);
  await br.close(); server.close(); process.exit(bad?1:0);
})();
