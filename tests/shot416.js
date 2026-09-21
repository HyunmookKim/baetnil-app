const { chromium } = require('playwright');
const http=require('http'), fs=require('fs'), path=require('path');
const FILE='work.html';
const server=http.createServer((rq,rs)=>{const f=path.join(__dirname,rq.url==='/'?FILE:rq.url.split('?')[0]);
  fs.readFile(f,(e,d)=>{if(e){rs.writeHead(404);rs.end();return;}
    if(f.endsWith('.woff2'))rs.setHeader('Content-Type','font/woff2');rs.writeHead(200);rs.end(d);});});
(async()=>{
  await new Promise(r=>server.listen(0,r));
  const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const ctx=await br.newContext({ locale:'ko-KR',viewport:{width:390,height:844},isMobile:true,hasTouch:true,
    permissions:['geolocation'],geolocation:{latitude:34.7404,longitude:127.7357}});
  const pg=await ctx.newPage();
  await pg.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'networkidle'});
  await pg.waitForTimeout(900);
  await pg.evaluate(()=>{try{skipWelcome();}catch(_){}});
  await pg.waitForTimeout(700);
  await pg.evaluate(()=>{openAgree(); agreeAll();});
  await pg.waitForTimeout(700);
  await pg.screenshot({path:'ag_on.png'});
  // 체크칸 크기
  console.log(JSON.stringify(await pg.evaluate(()=>{
    const b=[...document.querySelectorAll('.agchk')].map(e=>{const r=e.getBoundingClientRect();
      return {w:Math.round(r.width),h:Math.round(r.height),on:e.classList.contains('on')};});
    return {체크칸:b};
  })));
  // 다른 전체 화면에도 이름이 뜨나
  const names={};
  for(const [k,code] of [['약관',"openLegal('terms')"],['고객센터','openSupport()'],['내 배','openBoat()']]){
    await pg.evaluate(c=>{ (new Function(c))(); }, code);
    await pg.waitForTimeout(600);
    names[k]=await pg.evaluate(()=>{const n=document.getElementById('hNav');
      return {글:n?n.innerText.trim():'', 보임:n?getComputedStyle(n).display:''};});
  }
  console.log(JSON.stringify(names,null,1));
  await br.close(); server.close(); console.log('ok');
})();
