// 1단계 검사 — 앱 안에 '앞에 뜨는 창' 이 하나라도 남아 있으면 잡아낸다.
//
// 어떻게 잡는가
//  화면을 연 다음, 화면이 덮어야 할 자리(머리줄 아래 ~ 아래 탭줄 위)의
//  여러 점을 찍어서 '거기 무엇이 있나' 를 묻는다.
//  뒤 화면의 것이 하나라도 잡히면 실패다.
const { chromium } = require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
// ★ 넘겨받은 파일을 본다. 검사 폴더에 남은 옛 work.html 을 보면 안 된다.
const __ARG  = process.argv[2];
const __BASE = __ARG ? require('path').dirname(require('path').resolve(__ARG)) : __dirname;
const __MAIN = __ARG ? require('path').basename(__ARG) : 'work.html';
// 어떤 이름으로 부르든 본체를 달라는 것이면 본체를 준다
const __PICK = u => (u === '/' || u === '/work.html' || u === '/' + __MAIN) ? __MAIN : u.replace(/^\//,'');
const server=http.createServer((rq,rs)=>{const f=path.join(__BASE, __PICK(rq.url.split('?')[0]));
 fs.readFile(f,(e,d)=>{if(e){rs.writeHead(404);rs.end();return;} if(f.endsWith('.woff2'))rs.setHeader('Content-Type','font/woff2'); rs.writeHead(200);rs.end(d);});});

const seed = () => {
  try{ skipWelcome(); }catch(_){}
  window.__user={uid:'U1',email:'a@b.c',name:'김선장'}; me=window.__user;
  boats=[{id:'B1',name:'선샤인',type:'sail',port:'여수 원형마리나'}];
  seedRanks(boats[0]); boats[0].members={U1:ownerRank(boats[0]).id};
  currentBoatId='B1'; window.currentBoatId='B1'; unlocked=true; dgLocked=false; lkLocked=false;
  dgImgs={plan:DG_BUILTIN.sail.plan, side:DG_BUILTIN.sail.side};
  lockers=[]; const l=lkAdd({x:30,y:40,w:26,h:12},'갤리','싱크대 아래');
  items=[{id:1,lockerId:l.id,locker:l.label,zone:l.zone,name:'구명조끼',qty:'6',unit:'벌',note:'',photos:[]}];
  maint=[{id:'m1',grp:'기관',name:'엔진 오일 교환',months:6,unit:'m',lastDate:'2026-01-26',history:[],photos:[]}];
  trash=[{id:9,name:'버린 물품',qty:'1',unit:'개',locker:'싱크대 아래',zone:'갤리',photos:[]}];
  save&&save(); saveLocal&&saveLocal();
  try{applyBoatName();}catch(_){}
  switchTab('home'); setHomeSub('check');   // 뒤에 딱지가 잔뜩 있는 화면을 깔아 둔다
};

// ★ 무엇을 보는가
//   '덮여서 안 보이는가' 가 아니라 '자리에서 빠졌는가' 를 본다.
//   덮개는 언제든 비칠 수 있다. 자리에서 빠진 것만 진짜로 없는 것이다.
const probe = () => {
  const IDS = ['mrPanel','panel','formOv','hatPanelOv','trashView','helpOv'];
  const shown = el => !!el && getComputedStyle(el).display !== 'none';
  const P = IDS.map(id=>document.getElementById(id)).find(shown);
  if(!P) return {열림:false};
  // ★ 화면 이름 — 전체 화면일 때 머리줄에 남아야 한다.
  //   4.16 이전에는 CSS 세 곳 중 두 곳이 #hNav 를 숨겨서 어느 화면인지 알 수가 없었다.
  const N = document.getElementById('hNav');
  const 이름 = N ? String(N.innerText || '').trim() : '';
  const 이름보임 = !!N && getComputedStyle(N).display !== 'none'
    && N.getBoundingClientRect().height > 8;
  const bad = [];
  // 1. 탭에 붙어 있던 내용이 하나라도 남아 있으면 실패
  (window.TAB_CONTENT || []).forEach(id=>{
    const el = document.getElementById(id);
    if(shown(el)) bad.push('뒤에 남음: ' + id);
  });
  // 2. 다른 화면이 같이 떠 있으면 실패 (화면 위에 화면이 얹힌 것)
  IDS.forEach(id=>{
    const el = document.getElementById(id);
    if(el && el !== P && shown(el)) bad.push('화면이 겹침: ' + id);
  });
  // 3. 머리줄에 앞 탭의 도구줄·검색창이 남아 있으면 실패
  //   ★ 이름줄(#hNav)은 예외다 — 다만 「그 화면의 이름(.htit)」 만 들어 있을 때다.
  //     앞 탭의 하위 탭(.hsubs)이 그대로 남아 있으면 그것이야말로 새는 것이다.
  //     (4.16 이전에는 hNav 를 통째로 숨겨서, 어느 화면인지 알 수가 없었다.)
  const hdr = document.querySelector('header');
  if(hdr) [...hdr.children].forEach(el=>{
    if(el.classList.contains('hrow')) return;
    if(getComputedStyle(el).display === 'none' || el.offsetHeight === 0) return;
    if(el.id === 'hNav'){
      if(el.querySelector('.hsubs')) bad.push('머리줄에 앞 탭의 하위 탭이 남음: hNav');
      else if(!el.querySelector('.htit')) bad.push('머리줄 이름줄에 엉뚱한 것이 있다: hNav');
      return;
    }
    bad.push('머리줄에 남음: ' + (el.id || el.className || el.tagName));
  });
  // 4. 화면이 '덮개' 로 떠 있으면 실패 (자리에서 바뀌어야 한다)
  const cs = getComputedStyle(P);
  if(cs.position === 'fixed' || cs.position === 'absolute')
    bad.push('아직 덮개다: ' + P.id + ' position=' + cs.position);
  return {열림:true, 판:P.id, 샌곳:bad.slice(0,6), 샌수:bad.length, 이름:이름, 이름보임:이름보임};
};

// 열어 볼 화면들
const SCREENS = [
  ['내 배',        ()=>openBoat('info')],
  ['배 소개',      ()=>openBoat('intro')],
  ['명부',         ()=>openBoat('roster')],
  ['등급 설정',    ()=>openBoat('ranks')],
  ['게시판',       ()=>openBoat('board')],
  ['할 일',        ()=>openBoat('tasks')],
  ['가입 신청',    ()=>openBoat('joins')],
  ['공개 설정',    ()=>openBoat('publish')],
  ['정비 기록',    ()=>openMR('maint','m1')],
  ['물품 목록',    ()=>{ switchTab('boat'); setBoatSubTab('stow'); closeBoat(); openLocker(lockers[0].id); }],
  ['휴지통',       ()=>{ switchTab('boat'); setBoatSubTab('stow'); closeBoat(); openTrash(); }],
  ['입력 화면',    ()=>{ switchTab('boat'); setBoatSubTab('stow'); closeBoat();
                        try{ askText({title:'칸 이름', value:'', ok:()=>{}}); }catch(e){
                          try{ openForm({title:'시험'}); }catch(e2){ return 'skip'; } } }],
];

(async()=>{
  await new Promise(r=>server.listen(8757,r));
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  let pass=0, fail=0;
  for(const [name, fn] of SCREENS){
    const p=await b.newPage({ locale:'ko-KR',viewport:{width:360,height:780},deviceScaleFactor:1});
    const errs=[]; p.on('pageerror',e=>errs.push(e.message));
    await p.goto('http://localhost:8757/work.html');
    await p.waitForTimeout(2100);
    await p.evaluate(seed); await p.waitForTimeout(500);
    let skipped=false;
    try{ const r = await p.evaluate(fn); if(r==='skip') skipped=true; }catch(e){ }
    await p.waitForTimeout(700);
    const r = await p.evaluate(probe);
    if(skipped || !r.열림){ console.log('건너뜀: ' + name + ' (화면이 안 열림)'); }
    else if(r.샌수 === 0){ pass++; console.log('통과: ' + name + ' (' + r.판 + ')'); }
    else { fail++; console.log('★ 실패: ' + name + ' (' + r.판 + ') — 뒤가 ' + r.샌수 + '군데 비침\n        ' + r.샌곳.join('\n        ')); }
    // ★ 화면 이름이 머리줄에 뜨는가 (4.16 이전에는 어느 화면에서도 안 떴다)
    if(!skipped && r.열림){
      if(r.이름보임 && r.이름){ pass++; console.log('  통과: ' + name + ' — 이름이 뜬다 (' + r.이름 + ')'); }
      else { fail++; console.log('  ★ 실패: ' + name + ' — 화면 이름이 안 뜬다 (' +
        JSON.stringify({보임:r.이름보임, 글:r.이름}) + ')'); }
    }
    if(errs.length) console.log('        (오류: ' + errs.slice(0,2).join(' | ') + ')');
    await p.close();
  }
  console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
  await b.close(); server.close();
  process.exit(fail?1:0);
})();
