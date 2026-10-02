// 5.31 — 도면이 흰색·노을·검정 어느 화면에서도 보인다 (사장님: 「다른 것도 다 그러고 앞으로 사람들이 자기 도면 넣으면 계속 문제」)
//   그림을 실제로 그려 갈래(dgline/dgdark/없음)와 뒤집기가 맞는지, 올릴 때 투명 바탕을 칠하는지 본다.
// 사용: node dgtonetest.js ../www/index.html
const { chromium } = require('playwright'); const http=require('http'),fs=require('fs'),path=require('path');
const FILE=path.resolve(process.argv[2]||'../www/index.html');
const server=http.createServer((rq,rs)=>{const u=rq.url.split('?')[0]; fs.readFile(u==='/'?FILE:path.join(path.dirname(FILE),u),(e,d)=>{if(e){rs.writeHead(404);rs.end();return;} rs.writeHead(200); rs.end(d);});});
let ok=0,bad=0; const T=(n,c,w)=>{ if(c){ok++;console.log('통과: '+n);} else {bad++;console.log('★ 실패: '+n+(w!==undefined?' — '+JSON.stringify(w).slice(0,300):''));} };
(async()=>{ await new Promise(r=>server.listen(0,r));
 const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 for(const th of ['light','sunset','black']){
  const ctx=await br.newContext({locale:'ko-KR',viewport:{width:390,height:800}});
  await ctx.route(/googleapis|gstatic|firebaseio|firestore|open-meteo|openstreetmap|openseamap/,r=>r.abort());
  await ctx.addInitScript(t=>{try{localStorage.setItem('bt_setup','done');localStorage.setItem('bt_welcome','done');localStorage.setItem('bt_theme',t);}catch(_){}},th);
  const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(String(e)));
  await pg.goto('http://127.0.0.1:'+server.address().port+'/'); await pg.waitForTimeout(1500);
  const r=await pg.evaluate(async()=>{
    const mk=(fn,type)=>{ const c=document.createElement('canvas'); c.width=200; c.height=300; const g=c.getContext('2d'); fn(g); return c.toDataURL(type||'image/png'); };
    const darkPng = mk(g=>{ g.strokeStyle='#111'; g.lineWidth=4; g.strokeRect(20,20,160,260); });
    const lightPng= mk(g=>{ g.strokeStyle='#eee'; g.lineWidth=4; g.strokeRect(20,20,160,260); });
    const photo   = mk(g=>{ g.fillStyle='#f5f0e6'; g.fillRect(0,0,200,300); g.strokeStyle='#222'; g.strokeRect(20,20,160,260); }, 'image/jpeg');
    const load = src => new Promise(res=>{ const host=document.createElement('div'); host.className='dgCard'; host.innerHTML='<div class="pv"><img></div>'; document.body.appendChild(host);
      const im=host.querySelector('img'); im.onload=()=>setTimeout(()=>res({cls:im.className, f:getComputedStyle(im).filter}),30); im.src=src; });
    const out={};
    out.builtinPlan = await load(DG_BUILTIN.first45.plan);
    out.builtinSide = await load(DG_BUILTIN.first45.side);
    out.svgPlan = await load(DG_BUILTIN.sail.plan);
    out.darkPng = await load(darkPng); out.lightPng = await load(lightPng); out.photo = await load(photo);
    // 올릴 때 — 짙은 선 투명 그림을 JPEG 로 굳히면 바탕이 흰색이어야 한다
    const im=new Image(); await new Promise(r=>{im.onload=r; im.src=darkPng;});
    out.flatDark = dgFlatBg(im);
    const im2=new Image(); await new Promise(r=>{im2.onload=r; im2.src=photo;}); out.flatPhoto = dgFlatBg(im2);
    out.small = await new Promise(r=>dgShrink(darkPng, r));
    const im3=new Image(); await new Promise(r=>{im3.onload=r; im3.src=out.small;});
    const c=document.createElement('canvas'); c.width=10; c.height=10; c.getContext('2d').drawImage(im3,0,0,10,10);
    out.smallCorner = Array.from(c.getContext('2d').getImageData(5,5,1,1).data).slice(0,3);
    delete out.small;
    return out;
  });
  const inv = x => /invert\(1\)/.test(x.f);
  const L = th==='light';
  T(th+' — 앱 기본 평면도는 밝은 선으로 읽힌다', r.builtinPlan.cls==='dgline', r.builtinPlan);
  T(th+' — 앱 기본 측면도도', r.builtinSide.cls==='dgline', r.builtinSide);
  T(th+' — 선종별 기본 도면(SVG)도', r.svgPlan.cls==='dgline', r.svgPlan);
  T(th+' — 기본 도면은 흰색 화면에서만 뒤집힌다', inv(r.builtinPlan)===L && inv(r.svgPlan)===L, [r.builtinPlan,r.svgPlan]);
  T(th+' — 짙은 선 투명 그림은 어두운 화면에서만 뒤집힌다', r.darkPng.cls==='dgdark' && inv(r.darkPng)===!L, r.darkPng);
  T(th+' — 밝은 선 투명 그림은 흰색 화면에서만 뒤집힌다', r.lightPng.cls==='dgline' && inv(r.lightPng)===L, r.lightPng);
  T(th+' — 사진·스캔(바탕이 꽉 찬 그림)은 건드리지 않는다', r.photo.cls==='' && !inv(r.photo), r.photo);
  T(th+' — 짙은 선 투명 그림을 굳힐 때 흰 바탕을 칠한다', r.flatDark==='#FFFFFF' && r.flatPhoto===null, [r.flatDark,r.flatPhoto]);
  T(th+' — 작은 사본도 검정 위 검정이 아니다', r.smallCorner.every(v=>v>200), r.smallCorner);
  T(th+' — 오류가 없다', errs.length===0, errs);
  await ctx.close(); }
 await br.close(); server.close();
 console.log('\n합계: '+ok+'개 통과 / '+bad+'개 실패'); process.exit(bad?1:0); })();
