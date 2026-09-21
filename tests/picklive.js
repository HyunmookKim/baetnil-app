// 4.93 — 길게 누르기 말고도 눈에 보이는 길을 낸다
//
// ★ 애플 지침 —「길게 누르기가 유일한 길이면 안 된다. 차림표의 모든 항목은
//   눈에 보이는 다른 길로도 닿을 수 있어야 한다」
//   여태 여러 개 고르기는 「빈 곳을 길게 누르기」 뿐이었는데, 빈 곳에는 아무 표시가 없다.
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
  else{bad++;console.log('★ 실패: '+n+(w!==undefined?' — '+JSON.stringify(w).slice(0,220):''));} };

(async()=>{
  await new Promise(r=>server.listen(0,r));
  const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await (await br.newContext({ locale:'ko-KR',viewport:{width:390,height:844},isMobile:true,hasTouch:true})).newPage();
  const errs=[]; pg.on('pageerror',e=>errs.push(String(e).slice(0,140)));
  await pg.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'networkidle'});
  await pg.waitForTimeout(900);
  await pg.evaluate(()=>{ window.tell=()=>Promise.resolve(); window.ask=()=>Promise.resolve(true);
    try{skipWelcome();}catch(_){} unlocked=true; openBoatSetup(); });
  await pg.waitForTimeout(400);
  await pg.evaluate(()=>{ document.getElementById('nbName').value='시험호'; createBoat(); });
  await pg.waitForTimeout(1500);

  // 물품 셋을 한 칸에 넣고 그 칸을 연다
  await pg.evaluate(()=>{
    // 칸이 없으면 시험용으로 하나 만든다
    if(!lockers.length) lockers = [{ id:'bow', zone:'선수', label:'창고', x:43, y:5.5, w:14, h:3.5 }];
    const lk = lockers[0].id;
    items.length = 0;
    for(let i=1;i<=3;i++)
      items.push({ id:900+i, name:'물건'+i, qty:1, lockerId:lk, photos:[], box:false, parentId:null, unit:'' });
    save();
    setBoatSubTab('stow');
    selected = lk; inBox = null;
    try{ openLocker(lk); }catch(_){ renderPanelItems(); }
  });
  await pg.waitForTimeout(600);

  // ══ ① 도구줄에 「선택」 이 보인다 ═══════════════════════════════════
  const 단추 = await pg.evaluate(()=>{
    const b = document.getElementById('pickTab');
    return b ? { 있나:true, 글:b.textContent.trim(),
                 보임: getComputedStyle(b).display !== 'none' } : { 있나:false };
  });
  T('★★★ 도구줄에 「선택」 단추가 있다', 단추.있나 && 단추.글 === '선택', 단추);
  T('★★ 눈에 보인다', 단추.보임, 단추);

  // ══ ② 눌러서 고르기로 들어간다 (빈 곳 길게 안 눌러도) ══════════════
  const 들어감 = await pg.evaluate(()=>{
    document.getElementById('pickTab').click();
    return { pickOn, 켜짐: document.getElementById('pickTab').classList.contains('on'),
             체크칸: document.querySelectorAll('.pickdot').length,
             띠: !!document.querySelector('.pickbar') };
  });
  T('★★★ 「선택」 을 누르면 고르기로 들어간다', 들어감.pickOn === true, 들어감);
  T('★★★ 줄마다 체크 칸이 생긴다', 들어감.체크칸 === 3, 들어감);
  T('★★★ 아래에 이동·합침·지우기 띠가 뜬다', 들어감.띠, 들어감);
  T('★★ 단추가 켜진 것으로 보인다 (화면이 거짓말 안 한다)', 들어감.켜짐, 들어감);

  const 고르기 = await pg.evaluate(()=>{
    pickToggle(901); pickToggle(902);
    return { 고른수: pickSet.size,
             글: (document.querySelector('.picktop')||{}).textContent };
  });
  T('★★★ 눌러서 여러 개를 고를 수 있다', 고르기.고른수 === 2, 고르기);
  T('★★ 몇 개 골랐는지 보여 준다', /2/.test(고르기.글||''), 고르기);

  const 나옴 = await pg.evaluate(()=>{
    pickEnd();
    return { pickOn, 켜짐: document.getElementById('pickTab').classList.contains('on') };
  });
  T('★★ 「취소」 로 나온다', 나옴.pickOn === false, 나옴);
  T('★★ 나오면 단추 불도 꺼진다', 나옴.켜짐 === false, 나옴);

  // ══ ③ 줄마다 ⋮ — 길게 안 눌러도 차림표에 닿는다 ═══════════════════
  const 점 = await pg.evaluate(()=>{
    renderPanelItems();
    const ds = [...document.querySelectorAll('.itdots')];
    return { 수: ds.length, 글: ds[0] ? ds[0].textContent.trim() : null,
             넓이: ds[0] ? Math.round(ds[0].getBoundingClientRect().width) : 0,
             높이: ds[0] ? Math.round(ds[0].getBoundingClientRect().height) : 0 };
  });
  T('★★★ 줄마다 ⋮ 가 있다', 점.수 === 3, 점);
  T('★★ 그림이 ⋮ 다', 점.글 === '⋮', 점);
  T('★★ 손가락으로 누를 만한 크기다 (34px 이상)', 점.넓이 >= 34 && 점.높이 >= 34, 점);

  // ⋮ 를 누르면 차림표가 뜬다
  const 차림표 = await pg.evaluate(async ()=>{
    let 뜬것 = null;
    const 원래 = window.tellShow;
    window.tellShow = o => { 뜬것 = (o.btns||[]).map(b=>b.name); return Promise.resolve(null); };
    document.querySelector('.itdots').click();
    await new Promise(r=>setTimeout(r,150));
    window.tellShow = 원래;
    return 뜬것;
  });
  T('★★★ ⋮ 를 누르면 차림표가 뜬다', Array.isArray(차림표) && 차림표.length > 0, 차림표);
  T('★★★ 차림표에 「선택」 이 있다', (차림표||[]).indexOf('선택') >= 0, 차림표);

  // ══ ④ 잠그면 고치는 단추는 안 보인다 ═══════════════════════════════
  const 잠금 = await pg.evaluate(()=>{
    unlocked = false; renderPanelItems();
    const r = { 점: document.querySelectorAll('.itdots').length };
    unlocked = true; renderPanelItems();
    return r;
  });
  T('★★★ 잠그면 ⋮ 가 안 보인다', 잠금.점 === 0, 잠금);

  // ══ ⑤ 고르는 중에는 ⋮ 가 안 나온다 (누를 것이 겹치면 안 된다) ══════
  const 겹침 = await pg.evaluate(()=>{
    pickStart(null);
    const n = document.querySelectorAll('.itdots').length;
    pickEnd();
    return n;
  });
  T('★★ 고르는 중에는 ⋮ 가 안 나온다', 겹침 === 0, 겹침);

  T('★ 화면 오류가 없다', errs.length === 0, errs);
  console.log('\n통과 '+ok+' · 실패 '+bad);
  await br.close(); server.close(); process.exit(bad?1:0);
})();
