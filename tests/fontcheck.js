const { chromium } = require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const server=http.createServer((rq,rs)=>{
  const f=path.join(__dirname, rq.url==='/'?'work.html':rq.url.split('?')[0]);
  fs.readFile(f,(e,d)=>{ if(e){rs.writeHead(404);rs.end();return;}
    if(f.endsWith('.woff2')) rs.setHeader('Content-Type','font/woff2');
    rs.writeHead(200); rs.end(d); });
});
(async()=>{
  await new Promise(r=>server.listen(8747,r));
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const p=await b.newPage({ locale:'ko-KR',viewport:{width:360,height:780}});
  const reqs=[]; p.on('response',r=>{ if(r.url().includes('.woff2')) reqs.push(r.status()+' '+r.url()); });
  await p.goto('http://localhost:8747/work.html');
  await p.waitForTimeout(2500);
  const r = await p.evaluate(async ()=>{
    await document.fonts.ready;
    const names = [];
    document.fonts.forEach(f=>names.push(f.family+' '+f.weight+' '+f.status));
    return { loaded: document.fonts.check('16px Pretendard'),
             list: names,
             bodyFont: getComputedStyle(document.body).fontFamily };
  });
  console.log('woff2 요청:', reqs.join(' | ') || '없음');
  console.log('Pretendard 쓸 수 있나:', r.loaded);
  console.log('등록된 것:', r.list.join(' / ') || '없음');
  console.log('body 글꼴:', r.bodyFont);
  await b.close(); server.close();
})();
