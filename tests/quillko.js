// Quill 에 한글이 제대로 들어가나 — 조합(IME)까지 흉내 내서 쳐 본다
const { chromium } = require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const server=http.createServer((rq,rs)=>{const f=path.join(__dirname,rq.url==='/'?'quilltest.html':rq.url.split('?')[0]);
 fs.readFile(f,(e,d)=>{if(e){rs.writeHead(404);rs.end();return;}rs.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});rs.end(d);});});
let ok=0,bad=0;
const T=(n,c,w)=>{ if(c){ok++;console.log('통과: '+n);} else {bad++;console.log('★ 실패: '+n+(w!==undefined?' — '+JSON.stringify(w).slice(0,160):''));} };
(async()=>{
 await new Promise(r=>server.listen(0,r));
 const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const ctx=await br.newContext({viewport:{width:390,height:820},isMobile:true,hasTouch:true,locale:'ko-KR'});
 const pg=await ctx.newPage();
 const errs=[]; pg.on('pageerror',e=>errs.push(String(e)));
 await pg.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'networkidle'});
 await pg.waitForTimeout(700);

 T('Quill 이 뜬다', await pg.evaluate(()=>!!window.q && !!document.querySelector('.ql-editor')));

 // ① 보통 입력 (조합 없이)
 await pg.click('.ql-editor');
 await pg.keyboard.type('hello');
 T('로마자가 그대로 들어간다',
   (await pg.evaluate(()=>q.getText().trim()))==='hello',
   await pg.evaluate(()=>q.getText()));

 // ② 한글 조합 — ★ 흉내가 아니라 브라우저의 진짜 IME 통로(CDP)로 넣는다.
 //    손으로 만든 composition 이벤트는 실제와 달라서 믿을 수 없다.
 const cdp = await ctx.newCDPSession(pg);
 await pg.evaluate(()=>{ q.setText(''); q.focus(); });
 const ime = async (steps, done) => {
   for(const t of steps){
     await cdp.send('Input.imeSetComposition',
       { text:t, selectionStart:t.length, selectionEnd:t.length });
     await pg.waitForTimeout(40);
   }
   await cdp.send('Input.insertText', { text: done });
   await pg.waitForTimeout(60);
 };
 // '안녕하세요' 를 자모가 모이는 대로
 await ime(['ㅇ','아','안'], '안');
 await ime(['ㄴ','녀','녕'], '녕');
 await ime(['ㅎ','하'], '하');
 await ime(['ㅅ','세'], '세');
 await ime(['ㅇ','요'], '요');
 await pg.waitForTimeout(300);
 const ko = await pg.evaluate(()=>q.getText().replace(/\n+$/,''));
 T('한글 조합이 깨지지 않는다', ko === '안녕하세요', ko);

 // 조합 중에 지우기 (한글에서 제일 잘 깨지는 자리)
 await pg.evaluate(()=>{ q.setText(''); q.focus(); });
 await ime(['ㄱ','가','간'], '간');
 await cdp.send('Input.dispatchKeyEvent', { type:'rawKeyDown', windowsVirtualKeyCode:8, code:'Backspace', key:'Backspace' });
 await cdp.send('Input.dispatchKeyEvent', { type:'keyUp', windowsVirtualKeyCode:8, code:'Backspace', key:'Backspace' });
 await pg.waitForTimeout(200);
 const del = await pg.evaluate(()=>q.getText().replace(/\n+$/,''));
 T('한글 뒤 백스페이스가 한 글자만 지운다', del === '', del);

 // ③ 서식
 const fmt = await pg.evaluate(()=>{
   q.setText('굵게기울임');
   q.formatText(0,2,'bold',true);
   q.formatText(2,3,'italic',true);
   return q.getContents().ops;
 });
 T('굵게·기울임이 걸린다',
   JSON.stringify(fmt).indexOf('"bold":true')>=0 && JSON.stringify(fmt).indexOf('"italic":true')>=0, fmt);

 // ④ 목록
 const li = await pg.evaluate(()=>{
   q.setText('하나\n둘\n');
   q.formatLine(0,1,'list','bullet');
   q.formatLine(3,1,'list','ordered');
   return q.getContents().ops;
 });
 T('글머리표·번호가 걸린다', JSON.stringify(li).indexOf('"list"')>=0, li);

 // ⑤ 사진 — 넣고 지우기
 const img = await pg.evaluate(()=>{
   q.setText('');
   q.insertEmbed(0,'image','data:image/png;base64,iVBORw0KGgo=');
   const has = document.querySelectorAll('.ql-editor img').length;
   q.deleteText(0,1);
   return { has, left: document.querySelectorAll('.ql-editor img').length };
 });
 T('사진이 들어간다', img.has===1, img);
 T('사진이 지워진다', img.left===0, img);

 // ⑥ 저장 모양 (Delta = JSON. HTML 이 아니라 훨씬 안전하다)
 const delta = await pg.evaluate(()=>{
   q.setText(''); q.insertText(0,'글','bold',true);
   return q.getContents().ops;
 });
 T('저장 모양이 JSON 이다 (HTML 아님)',
   Array.isArray(delta) && typeof delta[0].insert === 'string', delta);

 T('앱이 터지지 않았다', errs.length===0, errs.slice(0,2));
 await pg.screenshot({path:'v_quill.png'});
 console.log('합계: '+ok+'개 통과 / '+bad+'개 실패');
 await br.close(); server.close();
})();
