const { chromium } = require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const FILE='work.html';
const server=http.createServer((rq,rs)=>{const f=path.join(__dirname,rq.url==='/'?FILE:rq.url.split('?')[0]);
 fs.readFile(f,(e,d)=>{if(e){rs.writeHead(404);rs.end();return;}rs.writeHead(200);rs.end(d);});});
(async()=>{
 await new Promise(r=>server.listen(0,r));
 const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const pg=await(await br.newContext({ locale:'ko-KR' })).newPage();
 await pg.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'networkidle'});
 await pg.waitForTimeout(600);
 const r=await pg.evaluate(()=>{
   const blocks=[{t:'text',v:'첫줄'},{t:'photo',v:'https://firebasestorage.example/x.jpg'},{t:'text',v:'끝줄'},{t:'photo',v:'data:image/png;base64,iVBORw0KGgo='}];
   const d=document.createElement('div'); d.innerHTML=richHtml(blocks);
   return { html:d.innerHTML, back: richBlocks(d) };
 });
 console.log(JSON.stringify(r,null,1));
 await br.close(); server.close();
})();
