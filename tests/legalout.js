const { chromium } = require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const server=http.createServer((rq,rs)=>{const f=path.join(__dirname,rq.url==='/'?'work.html':rq.url.split('?')[0]);
 fs.readFile(f,(e,d)=>{if(e){rs.writeHead(404);rs.end();return;}rs.writeHead(200);rs.end(d);});});
(async()=>{
 await new Promise(r=>server.listen(0,r));
 const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const pg=await(await br.newContext({ locale:'ko-KR' })).newPage();
 await pg.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'networkidle'});
 await pg.waitForTimeout(700);
 // ★ 3.91 부터 말마다 판이 따로 있다. 웹 페이지도 말마다 찍어야 한다 —
 //   스토어에 영어·러시아어 페이지를 올리면 거기 걸 주소도 그 말이어야 한다.
 const out=await pg.evaluate(()=>{const o={langs:{}};
   ['ko','en','ru'].forEach(v=>{
     const one={};
     Object.keys(LEGAL_DOCS).forEach(k=>{
       const set=legalSet(v);
       one[k]={title:(set[k]||LEGAL_DOCS[k]).title, body:legalText(k,v)};
     });
     o.langs[v]=one;
   });
   // 예전 모양도 그대로 둔다 (한국어) — 옛 검사와 sitegen 이 쓴다
   Object.keys(LEGAL_DOCS).forEach(k=>o[k]=o.langs.ko[k]);
   o.__meta={ver:LEGAL_VER,date:LEGAL_DATE,dates:LEGAL_DATES,
             owner:LEGAL_OWNER.name,email:LEGAL_OWNER.email,
             biz: (typeof LEGAL_BIZ!=='undefined' && LEGAL_BIZ)?LEGAL_BIZ:null};
   return o;});
 fs.writeFileSync('legal.json', JSON.stringify(out,null,1));
 console.log('문서:', Object.keys(out).filter(k=>k[0]!=='_').join(', '));
 console.log('메타:', JSON.stringify(out.__meta));
 console.log('개인정보 글자수:', out.privacy.body.length);
 await br.close(); server.close();
})();
