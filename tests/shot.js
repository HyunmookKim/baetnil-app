const { chromium } = require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const FILE=process.argv[2]||'work.html';
const server=http.createServer((rq,rs)=>{const f=path.join(__dirname,rq.url==='/'?FILE:rq.url.split('?')[0]);
 fs.readFile(f,(e,d)=>{if(e){rs.writeHead(404);rs.end();return;}
  if(f.endsWith('.woff2'))rs.setHeader('Content-Type','font/woff2');rs.writeHead(200);rs.end(d);});});
(async()=>{
 await new Promise(r=>server.listen(0,r));
 const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const ctx=await br.newContext({ locale:'ko-KR',viewport:{width:390,height:820},isMobile:true,hasTouch:true,deviceScaleFactor:2});
 const pg=await ctx.newPage();
 await pg.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'networkidle'});
 await pg.waitForTimeout(900);
 await pg.evaluate(()=>{try{skipWelcome();}catch(_){}}); 
 // 1) 편집기
 await pg.evaluate(()=>{
   openForm({ title:'연재 글 올리기', okText:'올리기',
     sub:'옮긴 글은 저자 · 매체 · 원문 링크가 반드시 있어야 합니다 (허락 조건).',
     fields:[{key:'body',type:'rich',label:'본문',value:[
       {t:'head',v:'1. 처음 바다로'},
       {t:'text',v:'출항은 새벽 다섯시였다. 바람은 **북동 12노트**, 파고는 0.5미터.'},
       {t:'head',v:'2. 첫 태킹'},
       {t:'text',v:'세일을 올리고 나서야 알았다 — 준비가 덜 됐다는 것을.'}]}],
     onOk:()=>{} });
 });
 await pg.waitForTimeout(300);
 await pg.screenshot({path:'shot_form.png'});
 await pg.evaluate(()=>closeForm());
 await pg.waitForTimeout(200);
 // 2) 읽는 화면
 await pg.evaluate(()=>{
   const P=document.getElementById('mrPanel');
   P.innerHTML=`<div class="mrhead"><b>먼바다로 · 1편</b><span style="flex:1"></span>
       <button class="tab">목록</button></div>
     <div class="postmeta"><span class="chip">1편</span> 김현묵 · Yacht Russia · 2026-08-15</div>
     <div class="wxbox"><b>원문</b><div>Навстречу открытому морю</div>
       <div class="wxfoot"><a href="#">https://yachtrussia.example/1</a></div>
       <div class="wxfoot">저작권자 허락을 받아 옮겼습니다. 무단 전재를 금합니다.</div></div>`
     + renderBlocks([
       {t:'head',v:'1. 처음 바다로'},
       {t:'text',v:'출항은 새벽 다섯시였다. 바람은 **북동 12노트**, 파고는 0.5미터.\n계기판은 아직 켜지 않았다.'},
       {t:'head',v:'2. 첫 태킹'},
       {t:'text',v:'세일을 올리고 나서야 알았다 — **준비가 덜 됐다**는 것을.'}], null);
   showPanel(P);
 });
 await pg.waitForTimeout(300);
 await pg.screenshot({path:'shot_read.png'});
 await br.close(); server.close();
})();
