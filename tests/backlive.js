// 뒤로 가기(왼쪽 끝 쓸어 넘기기) 를 실제 브라우저에서 확인한다.
// ★ 앱이 통째로 닫히면 안 된다 — 화면만 닫혀야 한다.
const { chromium } = require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
// ★ 넘겨받은 파일을 본다. 검사 폴더에 남은 옛 work.html 을 보면 안 된다.
//   실제로 4.44 에서 이 검사가 4.41 짜리 옛 파일을 보고 「다 지났다」고 했다.
const __ARG  = process.argv[2];
const __BASE = __ARG ? require('path').dirname(require('path').resolve(__ARG)) : __dirname;
const __MAIN = __ARG ? require('path').basename(__ARG) : 'work.html';
const server=http.createServer((rq,rs)=>{const f=((rq.url === '/' && path.isAbsolute(__MAIN)) ? __MAIN : path.join(__BASE, rq.url === '/' ? __MAIN : rq.url.split('?')[0]));
 fs.readFile(f,(e,d)=>{if(e){rs.writeHead(404);rs.end();return;} if(f.endsWith('.woff2'))rs.setHeader('Content-Type','font/woff2'); rs.writeHead(200);rs.end(d);});});
const seed = () => {
  try{ skipWelcome(); }catch(_){}
  window.__user={uid:'U1',email:'a@b.c',name:'김선장'}; me=window.__user;
  boats=[{id:'B1',name:'선샤인',type:'sail',port:'여수'}]; seedRanks(boats[0]);
  boats[0].members={U1:ownerRank(boats[0]).id}; currentBoatId='B1'; window.currentBoatId='B1';
  unlocked=true; dgLocked=false; lkLocked=false;
  dgImgs={plan:DG_BUILTIN.sail.plan, side:DG_BUILTIN.sail.side};
  lockers=[]; const l=lkAdd({x:30,y:40,w:26,h:12},'갤리','싱크대 아래');
  items=[{id:1,lockerId:l.id,locker:l.label,zone:l.zone,name:'구명조끼',qty:'6',unit:'벌',note:'',photos:[]}];
  trash=[{id:9,name:'버린 물품',qty:'1',unit:'개',locker:'싱크대 아래',zone:'갤리',photos:[]}];
  maint=[{id:'m1',grp:'기관',name:'엔진 오일 교환',months:6,unit:'m',lastDate:'2026-01-26',history:[],photos:[]}];
  save&&save(); saveLocal&&saveLocal(); try{applyBoatName();}catch(_){}
  switchTab('boat'); setBoatSubTab('stow');
};
const CASES = [
  ['물품 목록',      ()=>openLocker(lockers[0].id)],
  ['내 배',          ()=>openBoat('info')],
  ['정비 기록',      ()=>openMR('maint','m1')],
  ['휴지통',         ()=>openTrash()],
  // ★ 덮개 — 사진·고르기·서랍. 발자국이 없으면 뒤로 가기가 이것을 건너뛴다.
  ['사진 크게 보기', ()=>pvOpen(['data:image/gif;base64,R0lGODlhAQABAAAAACw='], 0)],
  ['서랍',           ()=>openDrawer()],
  ['도면 고르기',    ()=>{ try{ dgPickSeed('plan'); }catch(e){ openDgPick('plan','시험','',[]); } }],
];
(async()=>{
  await new Promise(r=>server.listen(8763,r));
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  let pass=0, fail=0;
  for(const [name, open] of CASES){
    const p=await b.newPage({ locale:'ko-KR',viewport:{width:360,height:780}});
    await p.goto('http://localhost:8763/work.html'); await p.waitForTimeout(2200);
    await p.evaluate(seed); await p.waitForTimeout(500);
    const before = await p.evaluate(()=>history.length);
    await p.evaluate(open); await p.waitForTimeout(700);
    const opened = await p.evaluate(()=>({
      떠있나: (window.SCREEN_STACK||[]).length > 0 || (window.OVERLAY_STACK||[]).length > 0,
      발자국: history.length }));
    await p.goBack().catch(()=>{});
    await p.waitForTimeout(700);
    const after = await p.evaluate(()=>({
      떠있나: (window.SCREEN_STACK||[]).length > 0 || (window.OVERLAY_STACK||[]).length > 0,
      살아있나: !!document.getElementById('tabbar'),
      주소: location.pathname }));
    const ok = opened.떠있나 && opened.발자국 > before && !after.떠있나 && after.살아있나;
    if(ok){ pass++; console.log('통과: ' + name + ' — 열림(발자국 ' + before + '→' + opened.발자국 + ') → 뒤로가기로 닫힘'); }
    else { fail++; console.log('★ 실패: ' + name + ' — ' + JSON.stringify({before, opened, after})); }
    await p.close();
  }
  console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
  await b.close(); server.close();
  process.exit(fail?1:0);
})();
