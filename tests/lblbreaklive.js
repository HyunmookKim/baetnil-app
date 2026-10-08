// 5.45 — 기록 창(수정 화면)의 칸 이름이 낱말 가운데서 끊기지 않는지 (노을·검정·흰 × 글자 크기 셋 × 한·영·러)
//   일본어는 띄어쓰지 않아 글자 사이에서 줄이 바뀌는 것이 맞다 — 여기서 보지 않는다.
//   러시아어 「Публикаци / я」 처럼 낱말 하나가 칸보다 길면 글자 중간에서 끊긴다.
const { chromium } = require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const FILE=path.resolve(process.argv[2]||path.join(__dirname,'..','www','index.html'));
(async()=>{
 const s=http.createServer((q,r)=>{const u=q.url.split('?')[0];fs.readFile(u==='/'?FILE:path.join(path.dirname(FILE),u),(e,d)=>{if(e){r.writeHead(404);r.end();return;}r.writeHead(200);r.end(d);});});
 await new Promise(r=>s.listen(0,r));
 const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const all={};
 for(const [th,fsz] of [['sunset','big'],['black','normal'],['light','bigger']]) for(const L of ['ko','en','ru']){
  const ctx=await br.newContext({locale:'ko-KR',viewport:{width:390,height:844},isMobile:true,hasTouch:true}); await ctx.route(/googleapis|gstatic|firebaseio|firestore|open-meteo|openstreetmap|openseamap/,r=>r.abort());
  await ctx.addInitScript(({th,L,fsz})=>{try{if(sessionStorage.getItem('_p'))return;sessionStorage.setItem('_p','1');localStorage.setItem('bt_setup','done');localStorage.setItem('bt_welcome','done');localStorage.setItem('bt_theme',th);localStorage.setItem('bt_fs',fsz);if(L!=='ko')localStorage.setItem('bt_lang',L);}catch(_){}},{th,L,fsz});
  const pg=await ctx.newPage(); await pg.goto('http://127.0.0.1:'+s.address().port+'/'); await pg.waitForTimeout(1400);
  await pg.evaluate(()=>{window.ask=()=>Promise.resolve(true);try{skipWelcome()}catch(_){};unlocked=true;try{openBoatSetup()}catch(_){}});await pg.waitForTimeout(300);
  await pg.evaluate(()=>{const n=document.getElementById('nbName');if(n){n.value='Shunshine';createBoat();}});await pg.waitForTimeout(600);
  const kinds=await pg.evaluate(()=>{const add=(arr,o)=>{arr.push(o);return o.id;};const d='2026-10-08';
    const ids={voyage:add(voyage,{id:9901,date:d,title:'t'}),maint:add(maint,{id:9902,name:'t',date:d}),repair:add(repair,{id:9903,title:'t',created:d}),
      fuel:add(fuel,{id:9904,date:d}),run:add(runs,{id:9905,date:d}),review:add(reviews,{id:9906,title:'t'}),contact:add(contacts,{id:9907,name:'t'})};
    try{save();}catch(_){} return ids;});
  for(const [k,id] of Object.entries(kinds)){
    try{ await pg.evaluate(([k,id])=>openMR(k,id),[k,id]); }catch(_){ continue; }
    await pg.waitForTimeout(350);
    const bad=await pg.evaluate(()=>{const c=document.createElement('canvas').getContext('2d');const out=[];
      for(const el of document.querySelectorAll('.mrlbl, .mrpanel label, #mrPanel .lbl')){
        const cs=getComputedStyle(el); if(cs.display==='none'||!el.offsetParent) continue;
        const w=el.clientWidth-parseFloat(cs.paddingLeft)-parseFloat(cs.paddingRight); if(w<10) continue;
        c.font=cs.fontWeight+' '+cs.fontSize+' '+cs.fontFamily; const ls=parseFloat(cs.letterSpacing)||0;
        const txt=(el.textContent||'').trim(); if(!txt) continue;
        for(const word of txt.split(/\s+/)){ const ww=c.measureText(word).width+ls*word.length; if(ww>w+1){ out.push(txt.slice(0,40)+' ['+word+' '+Math.round(ww)+'>'+Math.round(w)+']'); break; } }
      } return out;});
    all[th+'/'+fsz+'|'+L+'|'+k]=bad;
  }
  await ctx.close();
 }
 await br.close(); s.close();
 let fail=0; for(const [k,v] of Object.entries(all)){ if(v.length){fail++;console.log('★ 실패: '+k+' — '+JSON.stringify(v));} else console.log('통과: '+k); }
 console.log('\n합계: '+(Object.keys(all).length-fail)+'개 통과 / '+fail+'개 실패'); process.exit(fail?1:0);
})();
