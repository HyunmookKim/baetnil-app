const { chromium } = require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const server=http.createServer((rq,rs)=>{const f=path.join(__dirname, rq.url==='/'?'work.html':rq.url.split('?')[0]);
 fs.readFile(f,(e,d)=>{if(e){rs.writeHead(404);rs.end();return;} if(f.endsWith('.woff2'))rs.setHeader('Content-Type','font/woff2'); rs.writeHead(200);rs.end(d);});});
const D=JSON.parse(fs.readFileSync('real.json','utf8'));
D.items=(D.items||[]).map(x=>Object.assign({},x,{photos:[]}));
const load=(D)=>{ try{skipWelcome();}catch(_){}
  window.__user={uid:'U1',email:'a@b.c',name:'김선장'}; me=window.__user;
  const b=Object.assign({id:'B1'},D.boat||{}); boats=[b]; seedRanks(b);
  b.members={U1:ownerRank(b).id}; currentBoatId=b.id; window.currentBoatId=b.id;
  unlocked=true; lockers=D.lockers||[]; items=D.items||[];
  const g={}; (D.dgimgs||[]).forEach(x=>{ g[x.id]=(x.ref==='seed')?dgSeedUrl(x.id,'first45'):(x.url||x.img); });
  dgImgs=g; save&&save(); try{applyBoatName();}catch(_){}
  switchTab('boat'); setBoatSubTab('stow'); closeBoat(); };
(async()=>{
  await new Promise(r=>server.listen(8771,r));
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const CASES=[['등급설정', ()=>openRanks()],
               ['회원명부', ()=>openRoster && openRoster()],
               ['등급설정 → 권한', ()=>{ openRanks(); }],
               ['도움말',   ()=>{ const b2=document.querySelector('.helpb'); if(b2) b2.click(); }]];
  for(const [name,fn] of CASES){
    const p=await b.newPage({ locale:'ko-KR',viewport:{width:360,height:780},deviceScaleFactor:2});
    const errs=[]; p.on('pageerror',e=>errs.push(e.message));
    await p.goto('http://localhost:8771/work.html'); await p.waitForTimeout(2300);
    await p.evaluate(load,D); await p.waitForTimeout(700);
    try{ await p.evaluate(fn); }catch(e){ console.log('  ('+name+' 열기 실패: '+e.message+')'); }
    await p.waitForTimeout(900);
    const r=await p.evaluate(()=>{
      const st=window.SCREEN_STACK||[];
      const id=st[st.length-1];
      const el=id?document.getElementById(id):null;
      const left=(window.TAB_CONTENT||[]).filter(x=>{const e=document.getElementById(x);
        return e && getComputedStyle(e).display!=='none';});
      return {쌓임:st.slice(), 위치: el?el.getBoundingClientRect().top:null,
              높이: el?Math.round(el.getBoundingClientRect().height):null,
              뒤에남음:left, 스크롤:window.scrollY, 문서높이:document.body.scrollHeight};
    });
    console.log(name+': '+JSON.stringify(r));
    if(errs.length) console.log('   오류: '+errs.slice(0,2).join(' | '));
    await p.screenshot({path:'rk_'+name.replace(/[^가-힣]/g,'')+'.png'});
    await p.close();
  }
  await b.close(); server.close();
})();
