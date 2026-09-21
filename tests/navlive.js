// 4.87 — 뒤로 가면 「바로 이전 화면」 으로 간다
//
// ★ 사장님 지적 — 「뒤로가기하면 지금 보던 탭이 꺼져 버리고 이전 탭으로 간다.
//   뒤로가기하면 바로 이전 화면이 나와야지」
//   여태 뒤로가기는 「오늘이 아니면 오늘로」 한 걸음뿐이었다. 하위 갈래(장비 안의
//   정기점검 같은 것)는 아예 안 적혀 있어서 통째로 건너뛰었다.
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
  await pg.evaluate(()=>{ window.tell=()=>Promise.resolve(); window.ask=()=>Promise.resolve(true);
    try{skipWelcome();}catch(_){} unlocked=true; openBoatSetup(); });
  await pg.waitForTimeout(400);
  await pg.evaluate(()=>{ document.getElementById('nbName').value='시험호'; createBoat(); });
  await pg.waitForTimeout(1500);

  const 자리 = () => pg.evaluate(()=>navSpot());
  const 뒤로 = async () => { await pg.evaluate(()=>navDoBack()); await pg.waitForTimeout(450); };

  // 사장님이 실제로 걸으신 길: 오늘 → 내 배(적재표) → 장비 → 장비 안 정기점검
  await pg.evaluate(()=>switchTab('home'));           await pg.waitForTimeout(400);
  await pg.evaluate(()=>{ setBoatSubTab('stow'); });  await pg.waitForTimeout(500);
  await pg.evaluate(()=>{ setBoatSubTab('gear'); });  await pg.waitForTimeout(500);
  await pg.evaluate(()=>{ setGearSub('maint'); });    await pg.waitForTimeout(500);
  const 지금 = await 자리();
  T('★ 지금은 장비 › 정기점검이다', /^boat\|gear\|/.test(지금) && /\|maint\|/.test(지금), 지금);

  await 뒤로();
  const s1 = await 자리();
  T('★★★ 한 번 뒤로 — 장비(정기점검 아님)로 온다. 오늘로 안 튄다',
    s1.split('|')[0] === 'boat' && s1.split('|')[1] === 'gear' && s1.split('|')[3] === 'gear', s1);

  await 뒤로();
  const s2 = await 자리();
  T('★★★ 두 번 뒤로 — 적재표로 온다 (그 탭의 첫 자리)', /^boat\|stow\|/.test(s2), s2);

  await 뒤로();
  const s3 = await 자리();
  T('★★★ 그 탭의 첫 자리에서 한 번 더 뒤로 — 오늘로 온다', /^home\|/.test(s3), s3);

  // 커뮤니티 안의 하위 갈래도 같은 규칙
  await pg.evaluate(()=>{ setComSub('spots'); });   await pg.waitForTimeout(500);
  await pg.evaluate(()=>{ setComSub('market'); });  await pg.waitForTimeout(500);
  await 뒤로();
  T('★★ 커뮤니티 하위 갈래도 한 걸음씩 물린다',
    /\|spots\|/.test(await 자리()), await 자리());

  // ★ 탭을 옮긴 것은 뒤로 가기로 안 물린다 (구글이 정한 것) —
  //   대신 그 탭으로 돌아가면 보던 자리가 그대로 있다.
  await pg.evaluate(()=>{ setBoatSubTab('gear'); setGearSub('maint'); });
  await pg.waitForTimeout(600);
  await pg.evaluate(()=>{ switchTab('community'); }); await pg.waitForTimeout(500);
  await pg.evaluate(()=>{ switchTab('boat'); });      await pg.waitForTimeout(600);
  T('★★★ 탭을 오갔다 와도 그 탭에서 보던 자리가 그대로다',
    (await 자리()).split('|')[3] === 'maint', await 자리());

  // 화면(기록 창)이 떠 있으면 그것이 먼저다 — 자리보다 위다
  await pg.evaluate(()=>{ setBoatSubTab('gear'); }); await pg.waitForTimeout(500);
  await pg.evaluate(()=>{ const g=gearNew(); g.name='엔진'; maint.push(g); saveMR();
    openMR('gear', g.id); });
  await pg.waitForTimeout(500);
  T('★ 기록 창이 떠 있다', await pg.evaluate(()=>!!mrOpenType));
  await 뒤로();
  T('★★ 뒤로 가면 기록 창부터 닫는다 (자리보다 위다)',
    !(await pg.evaluate(()=>!!mrOpenType)) && /^boat\|gear\|/.test(await 자리()));

  // ══ 4.91 — 목록↔도면도 한 걸음이다 (사장님 지적) ═══════════════════
  //   「뒤로가기 누르면 그냥 뒤로가는 게 아니라 그 탭이 닫힌다」
  //   자리를 셀 때 목록/도면을 안 세고 있어서, 도면으로 옮겨도 자국이 안 남았다.
  //   그래서 뒤로 가면 「이 탭에서 움직인 적 없다」로 보고 탭을 나가 버렸다.
  //   ★ 실제로 걸어 보고 잡은 것이다. 코드만 읽어서는 안 보였다.
  for(const [이름, 밟기, 되돌] of [
      ['장비',   ()=>{ setBoatSubTab('gear'); setGearSub('gear'); mrToggleView(gearScreenKind()); }, ()=>mrViewOf('gear')],
      ['수리',   ()=>{ setBoatSubTab('repair'); mrToggleView('repair'); },                          ()=>mrViewOf('repair')],
      ['적재표', ()=>{ setBoatSubTab('stow'); toggleView(); },                                       ()=>view] ]){
    const r = await pg.evaluate(async (a2)=>{
      for(const k in navTrails) delete navTrails[k];
      switchTab('home');
      eval('(' + a2.f + ')()');
      const 전탭 = curTab, 전자리 = eval('(' + a2.g + ')()');
      const 길이 = (navTrails[curTab]||[]).length, kind = navBackKind();
      navDoBack();
      return { 전탭, 전자리, 길이, kind, 후탭: curTab, 후자리: eval('(' + a2.g + ')()') };
    }, { f: 밟기.toString(), g: 되돌.toString() });
    await pg.waitForTimeout(300);
    T('★★★ ' + 이름 + ' — 목록↔도면을 옮기면 자국이 남는다', r.길이 >= 2, r);
    T('★★★ ' + 이름 + ' — 뒤로 가도 탭이 안 닫힌다 (오늘로 안 튄다)', r.후탭 === r.전탭, r);
    T('★★★ ' + 이름 + ' — 뒤로 가면 보던 자리로 돌아온다', r.후자리 !== r.전자리, r);
  }

  T('화면에서 터진 곳이 없다', errs.length===0, errs.slice(0,3));
  console.log(`\n합계: ${ok}개 통과 / ${bad}개 실패`);
  await br.close(); server.close(); process.exit(bad?1:0);
})();
