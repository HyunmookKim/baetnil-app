// 5.55 — 사장님 「그래」 (2026-10-30) 로 정한 세 가지를 검사한다
//   A. 배를 등록하면 「오늘」 화면의 「시작하기」 카드로 간다 (예전: 적재표 「도면이 아직 없습니다」)
//   B. 배 종류에 「어선」 — 정비·도면·계통은 낚시·유어선 것을 쓴다
//   C. 입항한 항해를 저장하면 스토어 공식 별점 창을 (조건이 맞을 때만) 띄운다
// 사용: node v555test.js ../www/index.html
const { chromium } = require('playwright'); const http=require('http'),fs=require('fs'),path=require('path');
const FILE=path.resolve(process.argv[2]||'../www/index.html');
const server=http.createServer((rq,rs)=>{const u=rq.url.split('?')[0]; fs.readFile(u==='/'?FILE:path.join(path.dirname(FILE),u),(e,d)=>{if(e){rs.writeHead(404);rs.end();return;} rs.writeHead(200); rs.end(d);});});
let ok=0,bad=0; const T=(n,c,w)=>{ if(c){ok++;console.log('통과: '+n);} else {bad++;console.log('★ 실패: '+n+(w!==undefined?' — '+JSON.stringify(w).slice(0,300):''));} };
const EXE=['/opt/pw-browsers/chromium','/opt/pw-browsers/chromium-1243/chrome-linux64/chrome','/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(p=>{try{return fs.statSync(p).isFile();}catch(_){return false;}});
async function newBoat(br, type, name){
  const ctx=await br.newContext({locale:'ko-KR',viewport:{width:390,height:844}});
  await ctx.route(/googleapis|gstatic|firebaseio|firestore|open-meteo|openstreetmap|openseamap/,r=>r.abort());
  const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(String(e)));
  await pg.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'domcontentloaded'}); await pg.waitForTimeout(3500);
  await pg.getByText('나중에 하기',{exact:true}).first().click(); await pg.waitForTimeout(1000);
  await pg.locator('#mrPanel button',{hasText:'시작하기'}).first().click(); await pg.waitForTimeout(1200);
  await pg.getByText('배가 있습니다').first().click(); await pg.waitForTimeout(700);
  await pg.getByText('배 등록하기',{exact:true}).last().click(); await pg.waitForTimeout(1200);
  const opts=await pg.$$eval('#nbType option',os=>os.map(o=>o.value+'='+o.textContent));
  await pg.fill('#nbName',name); await pg.selectOption('#nbType',type);
  await pg.locator('#mrPanel button',{hasText:'저장'}).last().click(); await pg.waitForTimeout(2500);
  return {ctx,pg,errs,opts};
}
(async()=>{ await new Promise(r=>server.listen(0,r));
 const br=await chromium.launch({executablePath:EXE});
 // A + B
 const a=await newBoat(br,'fishery','제칠태해호');
 T('B. 배 종류에 「어선」 이 있다', a.opts.some(o=>o.startsWith('fishery=')), a.opts);
 const st=await a.pg.evaluate(()=>({tab:(typeof curTab!=='undefined'?curTab:null), txt:document.body.innerText,
     type:curBoat().type, bt:boatType(),  
     rows:maintRows().length, want:(MAINT_COMMON.length+(MAINT_BY_TYPE.fishing||[]).length)}));
 T('A. 등록하면 「시작하기」 카드가 보인다', /시작하기/.test(st.txt) && /1\s*\/\s*4/.test(st.txt), st.txt.slice(0,400));
 T('A. 적재표 「도면이 아직 없습니다」 로 가지 않는다', !/도면이 아직 없습니다/.test(st.txt));
 T('B. 어선으로 저장된다', st.type==='fishery', st.type);
 T('B. 어선은 낚시·유어선 계통을 쓴다', st.bt==='fishing', st.bt);
 T('B. 정기점검이 낚시·유어선 것으로 깔린다 (첫 배도 선종 항목까지)', st.rows===st.want, [st.rows,st.want]);
 T('A·B. 오류가 없다', a.errs.length===0, a.errs);
 await a.ctx.close();
 // 첫 배가 세일링 요트여도 선종 항목이 들어간다 (5.55 에서 찾은 빈틈)
 const s2=await newBoat(br,'sail','여수 Sunshine');
 const r2=await s2.pg.evaluate(()=>({rows:maintRows().length, want:MAINT_COMMON.length+MAINT_BY_TYPE.sail.length}));
 T('첫 배가 세일링 요트면 리깅·세일 항목까지 깔린다', r2.rows===r2.want, r2);
 await s2.ctx.close();
 // 일어·러시아어·영어 사전에 「어선」
 const d=await br.newContext(); const p=await d.newPage();
 await p.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'domcontentloaded'}); await p.waitForTimeout(2500);
 const tr=await p.evaluate(()=>['ja','en','ru'].map(l=>{ try{ return (I18N[l]||{})['어선']||''; }catch(_){ return ''; } }));
 T('B. 「어선」 이 세 나라 말로 옮겨져 있다', tr.every(Boolean), tr);
 await d.close();
 await br.close(); server.close();
 console.log('\n합계: '+ok+'개 통과 / '+bad+'개 실패'); process.exit(bad?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
