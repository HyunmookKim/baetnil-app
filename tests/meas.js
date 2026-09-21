const { chromium } = require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const dir='/root/baetnil/t';
const server=http.createServer((rq,rs)=>{const f=path.join(dir,rq.url==='/'?'work.html':rq.url.split('?')[0]);
 fs.readFile(f,(e,d)=>{if(e){rs.writeHead(404);rs.end();return;}rs.writeHead(200);rs.end(d);});});
const L=(r,g,b)=>{const f=v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)};
 return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b);};
const CR=(a,b)=>{const l1=L(...a),l2=L(...b);return ((Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05));};
const hex=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
(async()=>{
 await new Promise(r=>server.listen(0,r));
 const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const ctx=await br.newContext({ locale:'ko-KR',viewport:{width:390,height:820},isMobile:true,hasTouch:true});
 const pg=await ctx.newPage();
 await pg.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'networkidle'});
 await pg.waitForTimeout(800);
 await pg.evaluate(()=>{try{skipWelcome();}catch(_){}
   document.querySelectorAll('header,#hNav,nav,.nav,footer').forEach(e=>e.style.visibility='hidden');
   const P=document.getElementById('mrPanel'); if(P){P.innerHTML='';}
 });
 await pg.screenshot({path:'/tmp/bg.png'});
 await br.close(); server.close();
 const {PNG}=require('pngjs');
 const png=PNG.sync.read(fs.readFileSync('/tmp/bg.png'));
 const W=png.width,H=png.height, sx=Math.round(W*0.5);
 const cols={'postmeta #8a97a8':'#8a97a8','--tm #6E8497':'#6E8497','--td #4A5F72':'#4A5F72','--tx #D6E2EC':'#D6E2EC','--ac #9CC6E8':'#9CC6E8'};
 console.log('화면 높이 '+H+'px (실제 픽셀)');
 console.log('y(%)   배경색       ' + Object.keys(cols).map(k=>k.padEnd(9)).join(''));
 let worst={};
 for(let p=0;p<=40;p++){
   const y=Math.round(H*p/100); if(y>=H) break;
   const i=(W*y+sx)<<2; const bg=[png.data[i],png.data[i+1],png.data[i+2]];
   const row=Object.entries(cols).map(([k,v])=>{const r=CR(hex(v),bg);
     if(!worst[k]||r<worst[k].r) worst[k]={r,p}; return r.toFixed(2).padEnd(9);});
   if(p>=10&&p<=22) console.log(String(p).padStart(3)+'%   rgb('+bg.join(',')+')'.padEnd(6)+'  '+row.join(''));
 }
 console.log('\n가장 나쁜 자리:');
 Object.entries(worst).forEach(([k,v])=>console.log('  '+k.padEnd(18)+v.r.toFixed(2)+'  (y '+v.p+'%)'));
})();
