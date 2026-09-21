const { chromium } = require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const server=http.createServer((rq,rs)=>{const f=path.join(__dirname,'site',rq.url.split('?')[0]);
 fs.readFile(f,(e,d)=>{if(e){rs.writeHead(404);rs.end();return;}
  rs.setHeader('Content-Type','text/html; charset=utf-8');rs.writeHead(200);rs.end(d);});});
(async()=>{
 await new Promise(r=>server.listen(0,r));
 const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const ctx=await br.newContext({ locale:'ko-KR',viewport:{width:414,height:900},deviceScaleFactor:2});
 const pg=await ctx.newPage();
 await pg.goto('http://127.0.0.1:'+server.address().port+'/privacy.html',{waitUntil:'networkidle'});
 await pg.screenshot({path:'site_privacy.png'});
 console.log('제목:', await pg.title());
 console.log('첫 줄:', (await pg.evaluate(()=>document.querySelector('pre').textContent.slice(0,60))));
 await br.close(); server.close();
})();
