// 3.98 — 진짜 브라우저에서 네 가지가 고쳐졌는지 눈으로 확인한다.
// ★ 글자 검사(fix398test.js)만으로는 '고쳤다' 고 말할 수 없다. 넷 다 화면에서 난 흠이다.
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
  const errs=[]; pg.on('pageerror',e=>errs.push(String(e).slice(0,150)));
  await pg.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'networkidle'});
  await pg.waitForTimeout(900);

  await pg.evaluate(()=>{ window.__al=[];
    window.alert=m=>window.__al.push(String(m).replace(/\n+/g,' / '));
    window.confirm=()=>true;
    // ★ 앱은 alert/confirm 을 안 쓴다 — 자기 창(tell/ask)으로 말한다.
    window.tell=m=>{ window.__al.push(String(m).replace(/\n+/g,' / ')); return Promise.resolve(); };
    // ★ 4.101 — 칸이 잘못된 것은 큰 창이 아니라 **그 칸 아래 빨간 한 줄**이다.
    //   여기서는 손으로 불러서 칸이 없으므로, 말이 나갔는지만 본다.
    window.fieldErr=(el,m)=>{ window.__al.push(String(m).replace(/\n+/g,' / ')); return false; };
    window.formErr=(k,m)=>{ window.__al.push(String(m).replace(/\n+/g,' / ')); return false; };
    window.ask =m=>{ window.__al.push(String(m).replace(/\n+/g,' / ')); return Promise.resolve(true); };
    try{skipWelcome();}catch(_){} unlocked=true; openBoatSetup(); });
  await pg.waitForTimeout(500);
  await pg.evaluate(()=>{ document.getElementById('nbName').value='시험호'; createBoat(); });
  await pg.waitForTimeout(1100);

  // ── ② 출항 전 점검 — 체크하면 오늘 화면 숫자가 따라 오르는가
  await pg.evaluate(()=>{ switchTab('home'); setHomeSub('check'); });
  await pg.waitForTimeout(900);
  const stat = ()=>pg.evaluate(()=>{const e=document.querySelector('#checkList .stat');
    return e?e.innerText.replace(/\n/g,' '):'(없음)';});
  const card = ()=>pg.evaluate(()=>{ setHomeSub('today'); renderHome();
    // ★ 4.49 부터 오늘 카드 제목은 「출항 전 점검」 이 아니라 목록 자기 이름이다.
    //   글자를 못 박지 않고 카드의 단추(점검하기)를 표식으로 잡는다.
    const W=document.getElementById('homeList').innerText; const i=W.indexOf('점검하기');
    return i<0?'(카드 없음)':(W.slice(i,i+40).replace(/\n/g,' | ')); });
  const n0 = await stat();
  await pg.evaluate(()=>{ document.querySelectorAll('#checkList .ckrow')[0].click(); });
  await pg.waitForTimeout(500);
  const n1 = await stat();
  const c1 = await card();
  await pg.evaluate(()=>{ setHomeSub('check'); });
  await pg.waitForTimeout(600);
  await pg.evaluate(()=>{ [...document.querySelectorAll('#checkList .ckrow')].slice(1,4).forEach(r=>r.click()); });
  await pg.waitForTimeout(600);
  const n2 = await stat();
  const c2 = await card();
  T('점검 탭이 센다 (전 → 1개)', n0 !== n1, [n0, n1]);
  T('★ 오늘 카드도 따라 오른다 (1개)', /1 \//.test(c1), c1);
  T('★ 오늘 카드가 4개도 따라 오른다', /4 \//.test(c2), [n2, c2]);
  T('점검 탭과 오늘 카드 숫자가 같다',
    (n2.split(' ')[0] === c2.replace(/.*\| (\d+) \/.*/,'$1')), [n2, c2]);

  // ── ① 내 할 일 — 진짜로 뜨는가
  const my = await pg.evaluate(()=>{
    window.__user={uid:'me'}; me={uid:'me',name:'나',email:'a@b.c'};
    const b=curBoat(); b.members={me:'owner'};
    can = () => true;
    const p=n=>String(n).padStart(2,'0');
    const d=o=>{const x=new Date(Date.now()+o*864e5);
      return x.getFullYear()+'-'+p(x.getMonth()+1)+'-'+p(x.getDate());};
    maint=[{id:'m1',name:'엔진오일 교체',grp:'엔진',months:12,unit:'m',lastDate:d(-400),who:'me'},
           {id:'m2',name:'',grp:'',months:6,unit:'m',lastDate:'',who:'me'}];
    saveMR();
    const o={};
    try{ openMyTasks(); o.열림=true; }catch(e){ o.열림=false; o.오류=String(e); }
    const P=document.getElementById('mrPanel');
    o.화면 = P?P.innerText.replace(/\n{2,}/g,'\n').slice(0,300):null;
    return o; });
  await pg.waitForTimeout(500);
  T('내 할 일이 터지지 않는다', my.열림 === true, my.오류);
  T('내 할 일 화면에 항목이 보인다', /엔진오일 교체/.test(my.화면||''), my.화면);
  T('이름 없는 항목은 「(이름 없음)」 으로 뜬다', /\(이름 없음\)/.test(my.화면||''), my.화면);
  T('기한 지남 표시가 뜬다', /기한 지남/.test(my.화면||''), my.화면);

  // ── ③ 마지막 항해 — 예정이 아니라 다녀온 것
  const last = await pg.evaluate(()=>{
    const p=n=>String(n).padStart(2,'0');
    const d=o=>{const x=new Date(Date.now()+o*864e5);
      return x.getFullYear()+'-'+p(x.getMonth()+1)+'-'+p(x.getDate());};
    voyage=[{id:'v1',date:d(-1),title:'개도 한 바퀴',from:'여수',to:'여수',logs:[],pub:true},
            {id:'v2',date:d(+14),title:'',plan:true,from:'여수',to:'거문도',logs:[],pub:true}];
    saveMR(); setHomeSub('today'); renderHome();
    const W=document.getElementById('homeList').innerText; const i=W.indexOf('마지막 항해');
    return i<0?'(카드 없음)':W.slice(i,i+60).replace(/\n/g,' | '); });
  // ★ 4.115 — 오늘 화면도 항해일지 목록과 같은 문(voyName)을 쓴다.
  //   제목을 쓰신 항해는 제목이 먼저다 — 「여수 → 여수」 보다 「개도 한 바퀴」 가
  //   사람에게 더 많은 것을 알려 준다. 예정(v2)이 아니라 다녀온 것(v1)인지를 본다.
  T('★ 마지막 항해가 다녀온 항해다', /개도 한 바퀴/.test(last) && !/거문도/.test(last), last);
  T('예정 항해가 마지막으로 뜨지 않는다', !/거문도/.test(last), last);

  // ── ④ 소수점 찌꺼기
  const wx = await pg.evaluate(()=>{
    const b=curBoat(); b.spec=Object.assign({},b.spec,{maxGust:28,maxWind:22,maxWave:1.4});
    const html = boatWxCard({ wind:24.700000000000003, gust:31.099999999999998,
                              wave:1.7999999999999998, period:6, vis:20000 });
    const d=document.createElement('div'); d.innerHTML=html;
    return d.innerText.replace(/\n+/g,' | '); });
  T('★ 소수점 찌꺼기가 사라졌다', !/\.\d{6}/.test(wx), wx);
  T('돌풍이 31kt 로 다듬어졌다', /31kt/.test(wx), wx);
  T('파고는 한 자리로 (1.8m)', /1\.8m/.test(wx), wx);
  T('「기준」 도 함께 나온다', /기준/.test(wx), wx);

  // ── ⑤ 숫자 검사
  const num = await pg.evaluate(()=>{
    const o={}; const b=curBoat();
    const before = JSON.stringify(b.spec);
    window.__al=[];
    setBoatSpec('draft', '999999');   o.흘수_큰값 = b.spec.draft;
    setBoatSpec('maxWind', '-5');     o.한계풍속_음수 = b.spec.maxWind;
    setBoatSpec('loa', '13.7');       o.전장_정상 = b.spec.loa;
    o.말 = window.__al.slice();
    // 기록 칸
    runs=[{id:'u1',date:'2026-07-20',hours:'3.5',purpose:'충전'}];
    fuel=[{id:'f1',date:'2026-05-01',liters:'180',cost:'315000',full:true}];
    saveMR(); mrOpenType='run'; mrOpenId='u1';
    window.__al=[];
    mrField('hours','-5');   o.가동시간_음수 = runs[0].hours;
    mrOpenType='fuel'; mrOpenId='f1';
    mrField('liters','999999'); o.주유량_큰값 = fuel[0].liters;
    mrField('liters','120');    o.주유량_정상 = fuel[0].liters;
    o.말2 = window.__al.slice();
    o.총가동 = engineHours().total;
    return o; });
  T('★ 흘수 999999 는 안 들어간다', num.흘수_큰값 !== 999999, num.흘수_큰값);
  T('★ 한계 풍속 -5 는 안 들어간다', num.한계풍속_음수 !== -5, num.한계풍속_음수);
  T('정상값(전장 13.7)은 들어간다', num.전장_정상 === 13.7, num.전장_정상);
  T('막을 때 까닭을 말해 준다', (num.말||[]).length >= 2, num.말);
  T('★ 가동시간 -5 는 안 들어간다', num.가동시간_음수 !== '-5', num.가동시간_음수);
  T('★ 주유량 999999 는 안 들어간다', num.주유량_큰값 !== '999999', num.주유량_큰값);
  T('정상값(120L)은 들어간다', num.주유량_정상 === '120', num.주유량_정상);
  T('총 가동시간이 음수로 안 간다', num.총가동 >= 0, num.총가동);

  T('앱이 터지지 않았다', errs.length === 0, errs.slice(0,2));
  console.log('\n합계: '+ok+'개 통과 / '+bad+'개 실패');
  await br.close(); server.close();
  process.exit(bad?1:0);
})();
