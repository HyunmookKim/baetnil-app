const { chromium } = require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const FILE=process.argv[2]||'work.html';
const server=http.createServer((rq,rs)=>{const f=path.join(__dirname,rq.url==='/'?FILE:rq.url.split('?')[0]);
  fs.readFile(f,(e,d)=>{if(e){rs.writeHead(404);rs.end();return;}rs.writeHead(200);rs.end(d);});});
const PIX='data:image/svg+xml;base64,'+Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="300"><rect width="600" height="300" fill="#2b4a63"/><text x="300" y="160" font-size="34" fill="#cfe4f5" text-anchor="middle">사진</text></svg>').toString('base64');
(async()=>{
  await new Promise(r=>server.listen(0,r));
  const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await (await br.newContext({ locale:'ko-KR',viewport:{width:390,height:844},isMobile:true,hasTouch:true})).newPage();
  await pg.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'networkidle'});
  await pg.waitForTimeout(900);
  await pg.evaluate(p=>{
    try{skipWelcome();}catch(_){}
    window.__user={uid:'U1',name:'나'};
    openForm({ title:'글 쓰기', okText:'올리기',
      fields:[{ key:'body', type:'rich', label:'내용', placeholder:'여기에 쓰세요',
        value:[
          {t:'text',h:1,v:'여수에서 <b>거문도</b>까지 다녀왔습니다.'},
          {t:'head',h:1,v:'가는 길'},
          {t:'list',ord:0,items:['새벽 5시 출항','바람 <i>남서 12노트</i>']},
          {t:'photo',v:p},
          {t:'text',h:1,v:'수심은 <u>4미터</u>, 바닥은 모래였습니다. <s>진흙</s>'}
        ]}], onOk:()=>{} });
  }, PIX);
  await pg.waitForTimeout(900);
  await pg.screenshot({path:'v_ql_form.png'});
  await br.close(); server.close();
})();
