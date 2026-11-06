// 뉴스·글 「원문 보기」 뒤에 「번역 보기」 로 돌아갈 수 있는가 (2026-11-03)
//   사장님: 「이건 왜 원문보기 누르면 다시 번역보는 버튼은 없냐」
// 사용: node newstrbacktest.js ../www/index.html
const { chromium } = require('playwright'); const http=require('http'),fs=require('fs'),path=require('path');
const FILE=path.resolve(process.argv[2]||'../www/index.html');
const server=http.createServer((rq,rs)=>{const u=rq.url.split('?')[0]; fs.readFile(u==='/'?FILE:path.join(path.dirname(FILE),u),(e,d)=>{if(e){rs.writeHead(404);rs.end();return;} rs.writeHead(200); rs.end(d);});});
let ok=0,bad=0; const T=(n,c,w)=>{ if(c){ok++;console.log('통과: '+n);} else {bad++;console.log('★ 실패: '+n+(w!==undefined?' — '+JSON.stringify(w).slice(0,300):''));} };
const EXE=['/opt/pw-browsers/chromium','/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(p=>{try{return fs.statSync(p).isFile();}catch(_){return false;}});
(async()=>{ await new Promise(r=>server.listen(0,r));
 const br=await chromium.launch({executablePath:EXE});
 const ctx=await br.newContext({locale:'ko-KR'});
 await ctx.route(/googleapis|gstatic|firebaseio|firestore|open-meteo|openstreetmap|openseamap/,r=>r.abort());
 const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(String(e)));
 await pg.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'domcontentloaded'}); await pg.waitForTimeout(3000);
 const r=await pg.evaluate(()=>{
   const rows=[{ title:'Collision after the race start', t_ko:'Collision after the race start', lang:'en', source:'Yachting World', date:'2026-11-01' }];
   TR_NEWS[langNow()] = { 'Collision after the race start':'출발 직후 충돌 사고' };
   trNewsOn = true; newsTrSkip = false;
   const a = newsTrBar(rows), aShow = newsShow(rows[0].title);
   try{ newsTrOff(); }catch(_){ trNewsOn=false; newsTrSkip=true; }
   const b = newsTrBar(rows), bShow = newsShow(rows[0].title);
   // 인터넷이 없어도 옮겨 둔 것이 있으면 돌아갈 수 있다
   const off = Object.getOwnPropertyDescriptor(Navigator.prototype,'onLine');
   Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>false});
   const bOff = newsTrBar(rows);
   Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>true});
   try{ newsTrBack(); }catch(_){}
   const c = newsTrBar(rows), cShow = newsShow(rows[0].title);
   // 커뮤니티 글 — 옮겨 둔 것이 있고 원문을 골랐으면, 인터넷이 없어도 「번역 보기」
   const key = trKey('posts','p1'); TR_SKIP[key] = true; TR_ON[key] = false; TR_GOT[key + ':' + langNow()] = { x:1 };
   Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>false});
   const d = trBar('posts','p1','Hello sailors','');
   Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>true});
   return { a, aShow, b, bShow, bOff, c, cShow, d, trNewsOn, newsTrSkip };
 });
 T('번역해서 보는 중에는 「원문 보기」', /원문 보기/.test(r.a) && r.aShow==='출발 직후 충돌 사고', r.a);
 T('원문 보기를 누르면 원문이 보인다', r.bShow==='Collision after the race start', r.bShow);
 T('★★ 원문을 보는 중에는 「번역 보기」 단추가 있다', /번역 보기/.test(r.b) && /newsTrBack\(\)/.test(r.b), r.b);
 T('★ 인터넷이 없어도 옮겨 둔 것이 있으면 「번역 보기」', /번역 보기/.test(r.bOff), r.bOff);
 T('★★ 「번역 보기」 를 누르면 다시 번역이 보인다', r.cShow==='출발 직후 충돌 사고' && /원문 보기/.test(r.c) && r.trNewsOn && !r.newsTrSkip, r);
 T('★ 커뮤니티 글도 인터넷 없이 「번역 보기」 로 돌아갈 수 있다', /번역 보기/.test(r.d) && /trGo\(/.test(r.d), r.d);
 T('오류가 없다', errs.length===0, errs);
 await br.close(); server.close();
 console.log('\n합계: '+ok+'개 통과 / '+bad+'개 실패'); process.exit(bad?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
