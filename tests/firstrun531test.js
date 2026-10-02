// 5.31 — 처음 켜면 로그인 화면부터 (사장님: 「어플깔면 가장 먼저 로그인 화면부터 나오는게 좋을듯」)
//        새 배는 공개로 시작하되 홈포트·연락처·회원 명부·영업용은 꺼 둔다 (사장님: 「기본을 공개로」 · 홈포트 「꺼짐」)
// 사용: node firstrun531test.js ../www/index.html
const { chromium } = require('playwright'); const http=require('http'),fs=require('fs'),path=require('path');
const FILE=path.resolve(process.argv[2]||'../www/index.html');
const server=http.createServer((rq,rs)=>{const u=rq.url.split('?')[0]; fs.readFile(u==='/'?FILE:path.join(path.dirname(FILE),u),(e,d)=>{if(e){rs.writeHead(404);rs.end();return;} rs.writeHead(200); rs.end(d);});});
let ok=0,bad=0; const T=(n,c,w)=>{ if(c){ok++;console.log('통과: '+n);} else {bad++;console.log('★ 실패: '+n+(w!==undefined?' — '+JSON.stringify(w).slice(0,300):''));} };
(async()=>{ await new Promise(r=>server.listen(0,r));
 const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const ctx=await br.newContext({locale:'ko-KR',viewport:{width:390,height:800}});
 await ctx.route(/googleapis|gstatic|firebaseio|firestore|open-meteo|openstreetmap|openseamap/,r=>r.abort());
 const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(String(e)));
 const url='http://127.0.0.1:'+server.address().port+'/';
 await pg.goto(url); await pg.waitForTimeout(2500);
 const txt=()=>pg.evaluate(()=>document.getElementById('mrPanel').innerText);
 let s=await txt();
 T('처음 켜면 로그인 화면이 먼저 나온다', /먼저 로그인해 주세요/.test(s) && !/두 가지만 선택해 주세요/.test(s), s.slice(0,120));
 T('로그인 없이 쓰는 길(나중에 하기)이 있다', /나중에 하기/.test(s));
 await pg.evaluate(()=>skipWelcome()); await pg.waitForTimeout(500);
 s=await txt();
 T('나중에 하기 → 말·나라 고르기가 이어서 나온다', /두 가지만 선택해 주세요/.test(s), s.slice(0,120));
 await pg.evaluate(()=>setupSave()); await pg.waitForTimeout(3500);
 s=await pg.evaluate(()=>{ const P=document.getElementById('mrPanel'); return P && P.classList.contains('open') ? P.innerText : ''; });
 T('다 고르고 나면 다시 안 묻는다', !/먼저 로그인해 주세요|두 가지만 선택해 주세요/.test(s), s.slice(0,120));
 T('로그인 안 하고 시작하면 연락처·점검표가 깔린다', await pg.evaluate(()=>contacts.length>0 && checkt.length>0));
 // 로그인부터 한 분 — 말·나라 고르기가 이어진다
 const ctx2=await br.newContext({locale:'ko-KR',viewport:{width:390,height:800}});
 await ctx2.route(/googleapis|gstatic|firebaseio|firestore|open-meteo|openstreetmap|openseamap/,r=>r.abort());
 const p2=await ctx2.newPage(); await p2.goto(url); await p2.waitForTimeout(2500);
 await p2.evaluate(()=>window.__onAuth({uid:'U1',email:'a@b.c',name:''})); await p2.waitForTimeout(800);
 s=await p2.evaluate(()=>document.getElementById('mrPanel').innerText);
 T('로그인하면 말·나라 고르기가 이어서 나온다', /두 가지만 선택해 주세요/.test(s), s.slice(0,120));
 // 이미 쓰던 분(배가 있음)은 로그인 화면이 안 나온다
 const ctx3=await br.newContext({locale:'ko-KR',viewport:{width:390,height:800}});
 await ctx3.route(/googleapis|gstatic|firebaseio|firestore|open-meteo|openstreetmap|openseamap/,r=>r.abort());
 await ctx3.addInitScript(()=>{try{localStorage.setItem('bt_setup','done');localStorage.setItem('bt_welcome','done');}catch(_){}});
 const p3=await ctx3.newPage(); await p3.goto(url); await p3.waitForTimeout(2500);
 s=await p3.evaluate(()=>{ const P=document.getElementById('mrPanel'); return P && P.classList.contains('open') ? P.innerText : ''; });
 T('이미 쓰던 분에게는 로그인·고르기가 다시 안 나온다', !/먼저 로그인해 주세요|두 가지만 선택해 주세요/.test(s));
 // 새 배 — 공개 기본값
 const r = await p3.evaluate(()=>{
   unlocked=true; openBoatSetup();
   const note=document.getElementById('mrPanel').innerText;
   document.getElementById('nbName').value='시험배'; createBoat();
   const b=curBoat(); return { note, pub:b.pub, isPub:isPublic(b) };
 });
 T('등록 화면에 공개 안내가 있다', /배를 둘러보기에 공개합니다/.test(r.note||''), (r.note||r.err||'').slice(-200));
 const P=r.pub||{};
 T('새 배는 공개로 시작한다', r.isPub===true && ['spec','intro','board','voyage','maint','gear','review'].every(k=>P[k]===true), P);
 T('홈포트·연락처·회원 명부·영업용은 꺼져 있다', ['port','phone','roster','biz'].every(k=>!P[k]), P);
 T('오류가 없다', errs.length===0, errs);
 await br.close(); server.close(); console.log('\n합계: '+ok+'개 통과 / '+bad+'개 실패'); process.exit(bad?1:0); })();
