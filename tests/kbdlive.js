// 5.16 — 키보드가 뜨면 화면은 그대로, 누른 칸만 스크롤로 키보드 위에 (사장님 지적 2026-09-25)
//   「키보드 뜨면 그냥 화면 잘라지게 해야지. 밑에 화면을 위로 올리지 않는다. 화면을 줄이는 방식은 아예 없다. 거의 다 스크롤 방식」
//   5.15 는 웹뷰를 키보드만큼 줄여서 아래 탭 줄이 키보드 위로 따라 올라왔다.
//   안드로이드 껍데기(MainActivity)가 키보드 높이를 window.__kbd(기기 픽셀) 로 알려 주는 것을 흉내 낸다.
//   사용: node kbdlive.js ../www/index.html
const { chromium } = require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const FILE=path.resolve(process.argv[2]||'../www/index.html'), ROOT=path.dirname(FILE), MAIN=path.basename(FILE);
const srv=http.createServer((q,r)=>{const u=q.url.split('?')[0];fs.readFile(path.join(ROOT,u==='/'?MAIN:u),(e,d)=>{if(e){r.writeHead(404);r.end();return;}r.writeHead(200,{'Content-Type':/\.js$/.test(u)?'text/javascript':'text/html'});r.end(d);});});
let ok=0,bad=0;
const T=(n,c,w)=>{ if(c){ok++;console.log('통과: '+n);} else {bad++;console.log('★ 실패: '+n+(w!==undefined?' — '+JSON.stringify(w).slice(0,220):''));} };
(async()=>{
  await new Promise(r=>srv.listen(0,r));
  const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  // 에뮬레이터와 같은 화면: 412×924, 기기 픽셀 2.625
  const ctx=await br.newContext({locale:'ko-KR',viewport:{width:412,height:924},deviceScaleFactor:2.625,isMobile:true,hasTouch:true});
  await ctx.route(/googleapis|gstatic|firebaseio|open-meteo|firestore/,r=>r.abort());
  await ctx.addInitScript(()=>{ try{ localStorage.setItem('bt_setup','done'); localStorage.setItem('bt_welcome','done'); localStorage.setItem('bt_agree', JSON.stringify({v:'x'})); }catch(_){} });
  const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(String(e)));
  await pg.goto('http://127.0.0.1:'+srv.address().port+'/');
  await pg.waitForFunction(()=>typeof openAccount==='function');
  T('웹(껍데기 없음)에서는 스크롤용 여백을 안 만든다', await pg.evaluate(()=>!document.getElementById('kbdSpacer')));
  T('키보드 높이를 받는 곳(__kbd)이 있다', await pg.evaluate(()=>typeof window.__kbd==='function'));

  const KB=346;   // 에뮬레이터 키보드 높이(글씨 단위) 쯤
  async function check(name, id, mustHide){
    await pg.evaluate(id=>{ const e=document.getElementById(id); e.scrollIntoView({block:'end'}); }, id);
    await pg.waitForTimeout(200);
    const before=await pg.evaluate(id=>({h:innerHeight, tb:Math.round(document.getElementById('tabbar').getBoundingClientRect().bottom), fb:document.getElementById(id).getBoundingClientRect().bottom}), id);
    await pg.evaluate(id=>document.getElementById(id).focus(), id);
    await pg.evaluate(px=>window.__kbd(px), Math.round(KB*2.625));
    await pg.waitForTimeout(400);
    const a=await pg.evaluate(id=>{ const r=document.getElementById(id).getBoundingClientRect(); const hd=document.querySelector('header').getBoundingClientRect();
      return {h:innerHeight, kb:window.__kbdH, tb:Math.round(document.getElementById('tabbar').getBoundingClientRect().bottom), top:r.top, bot:r.bottom, hdb:hd.bottom,
        sp:(document.getElementById('kbdSpacer')||{style:{}}).style.height, act:document.activeElement&&document.activeElement.id}; }, id);
    if(mustHide) T(name+' — 칸을 누르기 전에는 키보드 자리에 있었다(검사가 뜻있는지)', before.fb > before.h - KB, before);
    else console.log('  참고: '+name+' 칸은 처음부터 키보드 위에 있음 (아래끝 '+Math.round(before.fb)+' / 키보드 윗줄 '+(before.h-KB)+')');
    T(name+' — 화면 높이 그대로(줄이지 않는다)', a.h===before.h, [before.h,a.h]);
    T(name+' — 아래 탭 줄이 제자리(키보드에 가려진다, 위로 안 올라온다)', a.tb===before.tb, [before.tb,a.tb]);
    T(name+' — 누른 칸이 키보드 위에 보인다', a.bot <= a.h - a.kb + 1, a);
    T(name+' — 누른 칸이 머리줄 밑으로 숨지 않는다', a.top >= a.hdb - 1, a);
    T(name+' — 누른 칸에 그대로 있다', a.act===id, a.act);
    await pg.evaluate(()=>window.__kbd(0)); await pg.waitForTimeout(200);
    T(name+' — 키보드를 내리면 덧붙인 여백을 걷는다', await pg.evaluate(()=>{const s=document.getElementById('kbdSpacer'); return !s || !(parseFloat(s.style.height)>0);}));
  }
  // 회원가입 화면 — 맨 아래 칸
  await pg.evaluate(()=>{ window.__auth={emailUp:async()=>{},emailIn:async()=>{},reset:async()=>{},google:async()=>{},out:async()=>{}}; openAccount(); });
  await pg.waitForTimeout(200);
  await pg.evaluate(()=>openSignup()); await pg.waitForTimeout(300);
  if(await pg.evaluate(()=>!document.getElementById('suPw2'))){ await pg.evaluate(()=>{ try{agreeAll();}catch(_){} const b=[...document.querySelectorAll('#mrPanel button')].find(b=>/동의하고 계속/.test(b.textContent)); b&&b.click(); }); await pg.waitForTimeout(300); }
  T('회원가입 화면이 열렸다', await pg.evaluate(()=>!!document.getElementById('suPw2')));
  await check('회원가입 · 비밀번호 확인', 'suPw2');
  // 칸에서 나가면(키보드는 그대로여도) 여백을 걷는다
  await pg.evaluate(()=>document.getElementById('suPw2').focus());
  await pg.evaluate(px=>window.__kbd(px), Math.round(KB*2.625)); await pg.waitForTimeout(300);
  T('키보드 떠 있는 동안 여백이 생긴다', await pg.evaluate(()=>parseFloat((document.getElementById('kbdSpacer')||{style:{}}).style.height)>0));
  await pg.evaluate(()=>document.getElementById('suPw2').blur()); await pg.waitForTimeout(200);
  T('칸에서 나가면 여백을 걷는다', await pg.evaluate(()=>!(parseFloat(document.getElementById('kbdSpacer').style.height)>0)));
  await pg.evaluate(()=>window.__kbd(0));
  // 작은 폰(360×640) — 회원가입 맨 아래 칸이 처음에 키보드 자리에 있는 경우
  await pg.setViewportSize({width:360,height:640}); await pg.waitForTimeout(200);
  await pg.evaluate(()=>openSignup()); await pg.waitForTimeout(300);
  if(await pg.evaluate(()=>!document.getElementById('suPw2'))){ await pg.evaluate(()=>{ try{agreeAll();}catch(_){} const b=[...document.querySelectorAll('#mrPanel button')].find(b=>/동의하고 계속/.test(b.textContent)); b&&b.click(); }); await pg.waitForTimeout(300); }
  await check('작은 폰 · 회원가입 · 비밀번호 확인', 'suPw2', true);
  await pg.setViewportSize({width:412,height:924}); await pg.waitForTimeout(200);
  // 로그인 화면 — 비밀번호 칸
  await pg.evaluate(()=>openAccount()); await pg.waitForTimeout(300);
  await check('로그인 · 비밀번호', 'acPw', true);
  // 이미 보이는 칸(맨 위 이메일)은 괜히 움직이지 않는다
  await pg.evaluate(()=>{ document.getElementById('acEm').scrollIntoView({block:'center'}); document.getElementById('acEm').focus(); });
  await pg.waitForTimeout(150);
  T('(검사 준비) 이메일 칸이 키보드 윗줄보다 넉넉히 위에 있다', await pg.evaluate(k=>document.getElementById('acEm').getBoundingClientRect().bottom < innerHeight-k-30, KB));
  const y0=await pg.evaluate(()=>document.getElementById('acEm').getBoundingClientRect().top);
  await pg.evaluate(px=>window.__kbd(px), Math.round(KB*2.625)); await pg.waitForTimeout(300);
  const y1=await pg.evaluate(()=>document.getElementById('acEm').getBoundingClientRect().top);
  T('이미 보이는 칸은 움직이지 않는다', Math.abs(y1-y0)<2, [y0,y1]);
  await pg.evaluate(()=>window.__kbd(0));
  T('페이지 오류 없음', errs.length===0, errs);
  await br.close(); srv.close();
  console.log(`\n합계: ${ok}개 통과 / ${bad}개 실패`);
  process.exit(bad?1:0);
})();
