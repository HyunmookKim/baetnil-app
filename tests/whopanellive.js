// 5.21 — 「함께 탄 사람 선택」·「알릴 사람 선택」 이 적재표 화면을 통째로 지우던 것
// 사장님이 보내 주신 오류 신고(2026-09-29, 앱 5.18, 안드로이드, 보던 곳 boat/stow):
//   Uncaught TypeError: Cannot set properties of null (setting 'innerHTML')
//     at renderPanelItems ← openLocker
// 까닭: 항해 기록의 사람 선택 화면(planWhoPaint)이 적재표 화면(#panel)의 속을 innerHTML 로 덮어써서
//   물품 목록(#pitems)·물품 칸(.pform)·칸 이름(#pz·#pl)이 앱을 다시 켤 때까지 사라졌다.
//   그 뒤 적재 화면에서 칸을 누르면 목록 자리가 없어 앱이 죽었다.
const { chromium } = require('playwright');
const http=require('http'), fs=require('fs'), path=require('path');
const FILE = path.resolve(process.argv[2] || 'work.html');
const ROOT = path.dirname(FILE);
const server = http.createServer((rq,rs)=>{ const u=rq.url.split('?')[0]; const f = u==='/'?FILE:path.join(ROOT,u);
  fs.readFile(f,(e,d)=>{ if(e){rs.writeHead(404);rs.end();return;} rs.writeHead(200); rs.end(d); }); });
let ok=0,bad=0;
const T=(n,c,w)=>{ if(c){ok++;console.log('통과: '+n);} else {bad++;console.log('★ 실패: '+n+(w!==undefined?' — '+JSON.stringify(w).slice(0,260):''));} };
(async()=>{
  await new Promise(r=>server.listen(0,r));
  const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const ctx=await br.newContext({ locale:'ko-KR',viewport:{width:411,height:960},isMobile:true,hasTouch:true});
  await ctx.route(/googleapis|gstatic|firebaseio|firestore|open-meteo/, r=>r.abort());
  const pg=await ctx.newPage();
  const errs=[]; pg.on('pageerror',e=>errs.push(String(e).slice(0,200)));
  await pg.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'domcontentloaded'});
  await pg.waitForTimeout(1500);
  await pg.evaluate(()=>{ window.tell=()=>Promise.resolve(); window.ask=()=>Promise.resolve(true);
    try{skipWelcome();}catch(_){} unlocked=true; openBoatSetup(); });
  await pg.waitForTimeout(400);
  await pg.evaluate(()=>{ document.getElementById('nbName').value='시험호'; createBoat(); });
  await pg.waitForTimeout(1500);
  await pg.evaluate(()=>{
    if(!lockers.length) lockers = [{ id:'bow', zone:'선수', label:'창고', x:43, y:5.5, w:14, h:3.5 }];
    const lk = lockers[0].id; items.length=0;
    for(let i=1;i<=2;i++) items.push({ id:900+i, name:'물건'+i, qty:1, lockerId:lk, photos:[], box:false, parentId:null, unit:'' });
    save();
  });
  // 항해 기록 하나를 만들고 「함께 탄 사람 선택」 을 연다
  const vid = await pg.evaluate(()=>{
    const v = { id: Date.now(), date: new Date().toISOString().slice(0,10), from:'여수', to:'거문도' };
    voyage.push(v); saveMR(); return v.id; });
  await pg.evaluate((vid)=>{ openMR('voyage', vid); }, vid);
  await pg.waitForTimeout(300);
  const whoTxt = await pg.evaluate((vid)=>{ openVoyCrew(vid); const P=document.getElementById('panel'); return P ? P.innerText.slice(0,120) : ''; }, vid);
  T('함께 탄 사람 선택 화면이 뜬다', /동승자 선택/.test(whoTxt), whoTxt);
  await pg.waitForTimeout(200);
  // ★ 5.36 — 머리줄에 ← 가 함께 있다. 이름만 본다.
  const head = await pg.evaluate(()=>((document.querySelector('#hNav .htit')||document.getElementById('hNav')||{}).innerText)||'');
  T('머리줄 이름도 「함께 탄 사람 선택」 (가려 둔 적재표 칸 이름이 올라오지 않는다)', head.trim() === '동승자 선택', head);
  // 완료 → 기록으로 돌아간다
  await pg.evaluate(()=>planWhoDone()); await pg.waitForTimeout(300);
  // 알릴 사람 선택도 한 번 열고 뒤로(닫기)로 나간다
  await pg.evaluate((vid)=>{ openMR('voyage', vid); openPlanWho(); }, vid); await pg.waitForTimeout(200);
  await pg.evaluate(()=>closeTopScreen()); await pg.waitForTimeout(200);
  const still = await pg.evaluate(()=>({ pitems: !!document.getElementById('pitems'), pform: !!document.querySelector('#panel .pform'),
    fName: !!document.getElementById('fName'), pz: !!document.getElementById('pz'), pl: !!document.getElementById('pl') }));
  T('★★ 사람 선택을 닫은 뒤에도 적재표 화면의 목록·물품 칸·칸 이름이 그대로 있다', still.pitems && still.pform && still.fName && still.pz && still.pl, still);
  // 적재 화면에서 칸을 누른다 — 사장님 폰에서 앱이 죽은 자리
  const r = await pg.evaluate(()=>{ let e=''; try{ setBoatSubTab('stow'); openLocker(lockers[0].id); }catch(x){ e=String(x); }
    const P=document.getElementById('panel');
    return { e, open: P.classList.contains('open'), txt: (document.getElementById('pitems')||{}).innerText || '',
      whoLeft: /동승자|알릴 사람/.test(P.innerText) }; });
  T('★★★ 그 뒤 적재 화면에서 칸을 눌러도 앱이 죽지 않는다', !r.e, r.e);
  T('★★ 칸의 물품이 목록에 나온다', r.open && /물건1/.test(r.txt) && /물건2/.test(r.txt), r);
  T('사람 선택 화면이 적재표 칸 안에 남아 있지 않다', !r.whoLeft, r);
  // 사람 선택이 떠 있는 동안 다시 그리기(구름 동기화)가 와도 사람 선택이 지워지지 않는다
  const r2 = await pg.evaluate((vid)=>{ closePanel(); openMR('voyage', vid); openVoyCrew(vid);
    try{ repaintNow(); }catch(_){}
    return /동승자 선택/.test(document.getElementById('panel').innerText); }, vid);
  T('사람 선택이 떠 있는 동안 화면을 다시 그려도 사람 선택이 그대로 보인다', r2, r2);
  await pg.evaluate(()=>planWhoDone());
  T('오류가 없다', errs.length === 0, errs.slice(0,3));
  await br.close(); server.close();
  console.log(`\n통과 ${ok} · 실패 ${bad}`); process.exit(bad?1:0);
})().catch(e=>{ console.log('★ 실패: 검사가 멈춤 — '+e); process.exit(1); });
