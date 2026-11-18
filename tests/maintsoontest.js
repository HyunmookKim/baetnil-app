// 5.58 — 정기점검 「임박」 을 항목마다 정한다 (사장님 2026-11-17)
//   「이렇게 주기가 짧은건 맨날 임박인데 어케 해야하냐」 → 「1번고」 (항목마다 「며칠 전부터 임박」 칸)
//   근거: Fleetio 「Due Soon Threshold」 알림마다 · Maintenance Supporter warning_days 작업마다
//   처음 값은 지금과 같은 30일 — 업데이트로 사용자 화면이 바뀌지 않게.
// 사용: node maintsoontest.js ../www/index.html
const { chromium } = require('playwright'); const http=require('http'),fs=require('fs'),path=require('path');
const FILE=path.resolve(process.argv[2]||'../www/index.html');
const server=http.createServer((rq,rs)=>{const u=rq.url.split('?')[0]; fs.readFile(u==='/'?FILE:path.join(path.dirname(FILE),u),(e,d)=>{if(e){rs.writeHead(404);rs.end();return;} rs.writeHead(200); rs.end(d);});});
let ok=0,bad=0; const T=(n,c,w)=>{ if(c){ok++;console.log('통과: '+n);} else {bad++;console.log('★ 실패: '+n+(w!==undefined?' — '+JSON.stringify(w).slice(0,300):''));} };
(async()=>{ await new Promise(r=>server.listen(0,r));
 const br=await chromium.launch();
 for(const lang of ['ko-KR','ja-JP','en-US','ru-RU']){
 const ctx=await br.newContext({locale:lang,viewport:{width:390,height:844}});
 await ctx.route(/googleapis|gstatic|firebaseio|firestore|open-meteo|openstreetmap|openseamap/,r=>r.abort());
 const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(String(e)));
 await pg.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'domcontentloaded'}); await pg.waitForTimeout(3000);
 const r=await pg.evaluate(async()=>{
   const out={};
   if(!boats.length){ boats.push({ id:'b1', name:'시험', type:'sail', members:{}, pub:{} }); currentBoatId='b1'; }
   unlocked = true;
   const d0 = new Date(); d0.setDate(d0.getDate()-1);
   const iso = x => x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0');
   const g = { id:'g-gen', kind:'gear', name:'발전기', grp:'기타' };
   const A = { id:'m-water', name:'물탱크 물채움', grp:'기타', months:2, unit:'w', lastDate: iso(d0) };            // 13일쯤 남음
   const B = { id:'m-oil', name:'엔진오일', grp:'기타', months:6, unit:'m', lastDate: iso(d0) };                  // 반년 남음
   const C = { id:'m-gen', name:'발전기 시동', grp:'기타', months:3, unit:'w', lastDate: iso(d0), gearId:'g-gen' }; // 20일쯤 남음
   const H = { id:'m-hrs', name:'시간만', grp:'기타', hrs:100 };                                                  // 엔진 시간만
   maint.length = 0; maint.push(g, A, B, C, H);
   const st = it => mStatus(it).k;
   // ① 칸이 없는 옛 항목 — 예전과 같다 (30일)
   out.a0 = st(A); out.c0 = st(C); out.b0 = st(B);
   out.cnt0 = maintCounts().soon; out.flt0 = maintFilter('soon').map(x=>x.id).sort();
   out.tag0 = mntDueTag(); out.gear0 = gearState('g-gen').k;
   // ② 상세 화면에 「임박 [30] 일 전부터」 칸
   openMR('maint', 'm-water');
   const row = [...document.querySelectorAll('#mrPanel .mrrow')].find(x => (x.querySelector('.mrlbl')||{}).textContent === t('임박'));
   out.rowFound = !!row;
   out.rowVal = row && row.querySelector('input') ? row.querySelector('input').value : null;
   out.rowUnit = row ? row.textContent.includes(t('일 전부터')) : false;
   // ③ 사람이 칸에 3 을 넣는다 — 진짜 칸에 넣고 바꿈 사건을 일으킨다
   if(row){ const inp=row.querySelector('input'); inp.value='3'; inp.dispatchEvent(new Event('change',{bubbles:true})); }
   await new Promise(r=>setTimeout(r,100));
   out.aSaved = A.soonDays;
   out.a1 = st(A);
   // 발전기는 7일로
   C.soonDays = 7;
   out.c1 = st(C);
   out.cnt1 = maintCounts().soon; out.flt1 = maintFilter('soon').map(x=>x.id);
   out.tag1 = mntDueTag(); out.gear1 = gearState('g-gen').k;
   // 정기점검 목록의 갈래 머리 노란 점도 같은 기준
   try{ renderMaintList(); }catch(e){ out.rmErr = String(e); }
   const gs = document.querySelector('#maintList .ghead .gsum');
   out.grpYel = gs ? /E8B33C/i.test(gs.innerHTML) : null;
   // ④ 남은 날이 그 칸 안으로 들어오면 다시 임박
   const d2 = new Date(); d2.setDate(d2.getDate()-12); A.lastDate = iso(d2);   // 2일 남음
   out.a2 = st(A);
   // ⑤ 0·빈칸은 처음 값(30)
   A.soonDays = 0; out.a3 = st(A); out.def = (typeof mSoonDays==='function') ? mSoonDays(A) : null;
   A.soonDays = ''; out.a4 = (typeof mSoonDays==='function') ? mSoonDays(A) : null;
   // ⑥ 엔진 시간만 쓰는 항목에는 칸이 없다 (날로 세지 않으므로)
   openMR('maint', 'm-hrs');
   out.hRow = [...document.querySelectorAll('#mrPanel .mrrow')].some(x => (x.querySelector('.mrlbl')||{}).textContent === t('임박'));
   // ⑦ 보기 전용이면 칸 대신 글자 — 숫자와 단위 사이가 붙지 않는다(한국어 말고)
   unlocked = false; openMR('maint', 'm-gen');
   const r2 = [...document.querySelectorAll('#mrPanel .mrrow')].find(x => (x.querySelector('.mrlbl')||{}).textContent === t('임박'));
   out.lockTxt = r2 ? r2.querySelector('.mrv').textContent : '';
   out.lockInput = r2 ? !!r2.querySelector('input') : null;
   // ⑧ 도움말이 「30일 고정」 이라고만 말하지 않는다
   out.help = (HELP.cycle || [])[1] || '';
   out.L = langNow();
   return out;
 });
 const L=lang.slice(0,2);
 T(L+' 칸 없는 옛 항목은 예전과 같다 (2주짜리·3주짜리 임박, 6개월 정상)', r.a0==='soon' && r.c0==='soon' && r.b0==='ok', r);
 T(L+' 옛 항목 숫자: 임박 2 · 장비 임박 · 갈래 표시 노랑', r.cnt0===2 && JSON.stringify(r.flt0)==='["m-gen","m-water"]' && r.gear0==='soon' && /soon/.test(r.tag0), r);
 T(L+' 상세에 「임박」 칸, 처음 값 30, 「일 전부터」', r.rowFound && r.rowVal==='30' && r.rowUnit, r);
 T(L+' ★★★ 3 을 넣으면 저장되고 13일 남은 물탱크는 임박이 아니다', r.aSaved===3 && r.a1==='ok', r);
 T(L+' ★★★ 발전기 7일 — 20일 남은 발전기도 임박이 아니다', r.c1==='ok', r);
 T(L+' ★★★ 임박 숫자·거르기·갈래 표시·장비 표시가 같은 기준', r.cnt1===0 && r.flt1.length===0 && r.tag1==='' && r.gear1==='none', r);
 T(L+' 정기점검 목록 갈래 머리에 노란 점이 없다', r.grpYel===false, r);
 T(L+' 남은 날이 칸 안으로 들어오면 다시 임박', r.a2==='soon', r);
 T(L+' 0·빈칸은 처음 값 30', r.def===30 && r.a4===30 && r.a3==='soon', r);
 T(L+' 엔진 시간만 쓰는 항목에는 칸이 없다', r.hRow===false, r);
 T(L+' 보기 전용이면 글자로, 숫자와 단위가 붙지 않는다', r.lockInput===false && (L==='ko' ? r.lockTxt.startsWith('7일') : /^7 /.test(r.lockTxt)), r.lockTxt);
 T(L+' 도움말에 항목마다 바꿀 수 있다고 적혀 있다', r.help.includes(L==='ko' ? '「임박」' : (L==='en' ? 'Due soon' : (L==='ru' ? 'Скоро' : '期限間近'))), r.help.slice(-200));
 T(L+' 오류가 없다', errs.length===0, errs);
 await ctx.close();
 }
 await br.close(); server.close();
 console.log('\n합계: '+ok+'개 통과 / '+bad+'개 실패'); process.exit(bad?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
