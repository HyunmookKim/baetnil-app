// 5.57 — 도착을 누른 뒤 도착 칸에 「다시 시작」 → 같은 항해를 이어서 기록한다 (사장님, 2026-11-10)
//   「그냥 도착칸에 도착 누른뒤 다시 시작 버튼 뜨도록 만들어놔」 — 알림 줄 단추는 없다
// 사용: node voyresumetest.js ../www/index.html
const { chromium } = require('playwright'); const http=require('http'),fs=require('fs'),path=require('path');
const FILE=path.resolve(process.argv[2]||'../www/index.html');
const server=http.createServer((rq,rs)=>{const u=rq.url.split('?')[0]; fs.readFile(u==='/'?FILE:path.join(path.dirname(FILE),u),(e,d)=>{if(e){rs.writeHead(404);rs.end();return;} rs.writeHead(200); rs.end(d);});});
let ok=0,bad=0; const T=(n,c,w)=>{ if(c){ok++;console.log('통과: '+n);} else {bad++;console.log('★ 실패: '+n+(w!==undefined?' — '+JSON.stringify(w).slice(0,300):''));} };
const EXE=['/opt/pw-browsers/chromium','/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(p=>{try{return fs.statSync(p).isFile();}catch(_){return false;}});
(async()=>{ await new Promise(r=>server.listen(0,r));
 const br=await chromium.launch({executablePath:EXE});
 for(const lang of ['ko-KR','ja-JP','en-US','ru-RU']){
 const ctx=await br.newContext({locale:lang,viewport:{width:390,height:844}});
 await ctx.route(/googleapis|gstatic|firebaseio|firestore|open-meteo|openstreetmap|openseamap/,r=>r.abort());
 const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(String(e)));
 await pg.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'domcontentloaded'}); await pg.waitForTimeout(3000);
 const r=await pg.evaluate(async()=>{
   const W=window, out={};
   // 배 하나와 오늘 항해 하나 (출항 10:00, 항적 3점)
   if(!boats.length){ boats.push({ id:'b1', name:'시험', type:'sail', members:{}, pub:{} }); currentBoatId='b1'; }
   unlocked = true;
   const now=Date.now(), iso=ms=>new Date(ms).toISOString();
   const v={ id:'v-res', date: today(), timeOut:'10:00', trk:[{la:34.70,lo:127.60,t:iso(now-30*60000)},{la:34.71,lo:127.61,t:iso(now-20*60000)},{la:34.72,lo:127.62,t:iso(now-10*60000)}], logs:[] };
   voyage.push(v); saveMR();
   // 항적 켜기를 흉내 낸다 (웹에는 위치 장치가 없다) — 켤 때 실린 점 수를 본다
   let started=null;
   W.isNative=()=>true; W.bgGeo=()=>({}); W.locMay=async()=>true; W.trkGuide=async()=>true; W.trkAskNoti=async()=>'granted';
   W.trkAttach=async()=>true; W.trkAwakeOn=async()=>{}; W.trkWatchStart=()=>{}; W.trkBatteryAsk=async()=>{};
   W.posHere=()=>{}; W.wxCapture=()=>{};
   openMR('voyage','v-res');
   arriveNow();
   await new Promise(r=>setTimeout(r,300));
   out.timeIn1 = v.timeIn;
   const sk=document.getElementById('snack');
   out.snackBtn = sk ? !!sk.querySelector('.skbtn') : false;
   out.resumeBtn = [...document.querySelectorAll('#mrPanel button')].map(b=>b.textContent.trim()).filter(x=>x===t('다시 시작')).length;
   // 도착 칸의 「다시 시작」
   [...document.querySelectorAll('#mrPanel button')].find(x=>x.textContent.trim()===t('다시 시작')).click();
   await new Promise(r=>setTimeout(r,400));
   out.timeIn2 = v.timeIn; out.dateIn2 = v.dateIn || '';
   out.trkNowPts = (trkNow && trkNow.pts) ? trkNow.pts.length : -1;
   out.trkNowVid = trkNow ? trkNow.vid : '';
   // 새 점 2개가 들어오고 다시 도착 → 앞 3점 + 새 2점이 남아야 한다
   trkNow.pts.push({la:34.73,lo:127.63,t:iso(now-5*60000)},{la:34.74,lo:127.64,t:iso(now-60000)});
   W.trkBufDrain=async()=>{}; W.trkBufStop=async()=>{}; W.trkAwakeOff=async()=>{};
   openMR('voyage','v-res'); arriveNow();
   await new Promise(r=>setTimeout(r,500));
   out.trkLen = v.trk.length; out.timeIn3 = v.timeIn;
   // 도착 칸 「다시 시작」 단추로도 이어진다
   openMR('voyage','v-res');
   const b=[...document.querySelectorAll('#mrPanel button')].find(x=>x.textContent.trim()===t('다시 시작'));
   out.btnFound=!!b; if(b) b.click();
   await new Promise(r=>setTimeout(r,400));
   out.timeIn4 = v.timeIn; out.trkNowPts2 = trkNow ? trkNow.pts.length : -1;
   // 지난날 도착한 항해에는 「다시 시작」 이 없다
   const old={ id:'v-old', date:'2026-01-02', dateIn:'2026-01-02', timeOut:'10:00', timeIn:'11:00', trk:[], logs:[] };
   voyage.push(old); openMR('voyage','v-old');
   out.oldBtn=[...document.querySelectorAll('#mrPanel button')].some(x=>x.textContent.trim()===t('다시 시작'));
   out.label=t('다시 시작');
   return out;
 });
 const L=lang.slice(0,2);
 T(L+' 「지금 도착」 하면 도착 시각이 들어간다', !!r.timeIn1, r);
 T(L+' 알림 줄에 단추가 없다', r.snackBtn===false, r.snackBtn);
 T(L+' 도착 칸에 「다시 시작」', r.resumeBtn===1, r);
 T(L+' 「다시 시작」 하면 도착 시각·날짜가 비워진다', r.timeIn2==='' && r.dateIn2==='', r);
 T(L+' ★★★ 항적을 같은 항해로 다시 켠다 (앞 점 3개를 싣고)', r.trkNowVid==='v-res' && r.trkNowPts===3, r);
 T(L+' ★★★ 다시 도착하면 앞 구간과 새 구간이 다 남는다', r.trkLen===5 && !!r.timeIn3, r);
 T(L+' 두 번째 도착 뒤 「다시 시작」 도 이어진다', r.btnFound && r.timeIn4==='' && r.trkNowPts2===5, r);
 T(L+' 지난날 항해에는 「다시 시작」 이 없다', r.oldBtn===false, r);
 T(L+' 단추 말이 그 나라 말', L==='ko' ? r.label==='다시 시작' : r.label!=='다시 시작', r.label);
 T(L+' 오류가 없다', errs.length===0, errs);
 await ctx.close();
 }
 await br.close(); server.close();
 console.log('\n합계: '+ok+'개 통과 / '+bad+'개 실패'); process.exit(bad?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
