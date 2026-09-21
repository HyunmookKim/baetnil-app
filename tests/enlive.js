// 영어로 켜고 화면을 돌며 남은 한국어를 찾는다.
// ★ 글자 검사(korscantest)는 '사전을 거치나' 만 본다. 여기서는 진짜 화면을 본다.
//   배 이름·정박지 이름·사람이 쓴 글처럼 옮기면 안 되는 것은 빼고 센다.
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

// 옮기면 안 되는 것 — 사람·배·항구 이름, 씨앗 자료
const OKWORD = new Set(['시험호','여수','전남','경남','부산','목포','통영','제주','인천','속초',
  '소호','국동항','돌산항','낭도항','안도항','연도항','초도항','여수엑스포','마리나','뱃일',
  '선수','갤리','기관실','선미','창고','조리대','엔진실','충전','기타','엔진','선체','세일']);
const leftover = txt => {
  const out = [];
  (txt.match(/[가-힣]+/g) || []).forEach(w => { if(!OKWORD.has(w)) out.push(w); });
  return [...new Set(out)];
};

(async()=>{
  await new Promise(r=>server.listen(0,r));
  const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const ctx=await br.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,locale:'en-US'});
  const pg=await ctx.newPage();
  const errs=[]; pg.on('pageerror',e=>errs.push(String(e).slice(0,140)));
  await pg.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'networkidle'});
  await pg.waitForTimeout(600);
  await pg.evaluate(()=>localStorage.setItem('bt_lang','en'));
  await pg.reload({waitUntil:'networkidle'});
  await pg.waitForTimeout(1000);

  // ── 로그인 화면 — 여기가 18개로 제일 많았다
  const login = await pg.evaluate(()=>{
    const out = {};
    const P = document.getElementById('mrPanel');
    out.화면 = P ? P.innerText : '';
    // 로그인 오류 안내를 하나씩 띄워 본다
    const codes = ['auth/invalid-email','auth/missing-password','auth/weak-password',
      'auth/email-already-in-use','auth/wrong-password','auth/too-many-requests',
      'auth/network-request-failed','auth/popup-closed-by-user','auth/popup-blocked',
      'auth/unauthorized-domain','auth/operation-not-allowed','auth/user-disabled','auth/xyz'];
    out.오류 = codes.map(c => t(authMsg({ code:c })));
    // 실제 화면에 넣어 본다 — 로그인 화면을 먼저 열어야 칸이 있다
    try{ openAccount(); }catch(_){}
    acMsg(authMsg({ code:'auth/invalid-email' }));
    const el = document.getElementById('acMsg');
    out.한줄 = el ? el.textContent : '(칸 없음)';
    return out;
  });
  T('로그인 오류 안내가 영어로 나온다',
    login.한줄 === 'Please check the email format.', login.한줄);
  const badLogin = leftover(login.오류.join(' '));
  T('로그인 오류 13가지에 한국어가 안 남는다 — ' + badLogin.length + '개', badLogin.length===0, badLogin);

  // ── 배 등록 화면의 GPS 안내
  const gps = await pg.evaluate(()=>{
    try{ skipWelcome(); }catch(_){}
    unlocked = true; openBoatSetup();
    return null;
  });
  await pg.waitForTimeout(600);
  const gpsTxt = await pg.evaluate(()=>{
    const el = document.getElementById('setupHint');
    // 세 갈래를 다 찍어 본다
    const out = [];
    if(el){
      const say = m => { el.innerHTML = esc(t(m)); out.push(el.textContent); };
      say('지도를 눌러 홈포트 위치를 지정해 주세요. 날씨·물때가 이 자리를 기준으로 표시됩니다.');
      say('현재 위치를 홈포트로 잡았습니다. 다르면 지도를 눌러 옮겨 주세요.');
      say('위치를 가져오지 못했습니다. 지도를 눌러 홈포트 위치를 지정해 주세요.');
    }
    return out;
  });
  T('배 등록 GPS 안내 셋이 영어로 나온다', leftover(gpsTxt.join(' ')).length===0, gpsTxt);

  // ── 정기점검 목록 (상태·칩·줄 설명)
  await pg.evaluate(()=>{
    document.getElementById('nbName').value='Test Boat'; createBoat(); });
  await pg.waitForTimeout(1100);
  await pg.evaluate(()=>{
    const p=n=>String(n).padStart(2,'0');
    const d=o=>{const x=new Date(Date.now()+o*864e5);
      return x.getFullYear()+'-'+p(x.getMonth()+1)+'-'+p(x.getDate());};
    maint=[{id:'m1',name:'Engine oil',grp:'Engine',months:12,unit:'m',lastDate:d(-400)},
           {id:'m2',name:'Anode',grp:'Hull',months:1,unit:'m',lastDate:d(-20)},
           {id:'m3',name:'No record',grp:'',months:6,unit:'m',lastDate:''}];
    saveMR(); switchTab('boat'); setMntSub('maint'); });   // 4.85 — 정기점검은 장비 안이다
  await pg.waitForTimeout(900);
  const mt = await pg.evaluate(()=>document.getElementById('gearWrap').innerText);
  T('정기점검 목록에 한국어가 안 남는다', leftover(mt).length===0, leftover(mt));

  // ── 권한·클라우드 안내
  const guard = await pg.evaluate(()=>({
    권한: [adminGuard('x','remove'), banGuard('x'), boatModGuard()].map(x=>t(x)),
    클라우드: [{code:'resource-exhausted'},{code:'permission-denied'},
               {code:'unauthenticated'},{code:'nope'}].map(e=>t(cloudErrHelp(e))),
    상태줄: [{code:'resource-exhausted'},{code:'permission-denied'},
             {code:'unauthenticated'},{code:'nope'}].map(e=>t(cloudErrText(e)))
  }));
  T('권한 안내가 영어로 나온다', leftover(guard.권한.join(' ')).length===0, guard.권한);
  T('클라우드 안내가 영어로 나온다', leftover(guard.클라우드.join(' ')).length===0, leftover(guard.클라우드.join(' ')));
  T('동기화 상태줄이 영어로 나온다', leftover(guard.상태줄.join(' ')).length===0, guard.상태줄);

  // ── 물품 화면 (+ 추가 / 수정 완료 / 전체 N개)
  await pg.evaluate(()=>{ switchTab('boat'); setBoatSubTab('stow');
    lockers=[{id:'L1',zone:'Bow',label:'Fore locker',x:10,y:10,w:30,h:20}];
    items=[{id:'i1',name:'Life jacket',qty:6,unit:'ea',lockerId:'L1',photos:[],note:''}];
    saveMR(); if(typeof refreshBoxes==='function') refreshBoxes();
    if(typeof renderList==='function') renderList();
    if(typeof updateFoot==='function') updateFoot(); });
  await pg.waitForTimeout(800);
  const stow = await pg.evaluate(()=>{
    const f=document.getElementById('pf'), a=document.getElementById('addBtn');
    return { 아래줄:f?f.textContent:'', 단추:a?a.textContent:'' }; });
  T('물품 아래줄이 영어다', leftover(stow.아래줄).length===0, stow.아래줄);
  T('「+ 추가」 단추가 영어다', leftover(stow.단추).length===0, stow.단추);

  // ── 날씨 경고 카드
  const wx = await pg.evaluate(()=>{
    const b=curBoat(); b.spec=Object.assign({},b.spec,{maxWind:22,maxGust:28,maxWave:1.4});
    const d=document.createElement('div');
    d.innerHTML = boatWxCard({wind:24.7,gust:31.1,wave:1.8,period:6,vis:20000});
    return d.innerText; });
  T('날씨 경고 카드가 영어다', leftover(wx).length===0, leftover(wx));
  T('소수점 찌꺼기도 없다', !/\.\d{5}/.test(wx), wx.slice(0,120));

  T('앱이 터지지 않았다', errs.length===0, errs.slice(0,2));
  console.log('\n합계: '+ok+'개 통과 / '+bad+'개 실패');
  await br.close(); server.close();
  process.exit(bad?1:0);
})();
