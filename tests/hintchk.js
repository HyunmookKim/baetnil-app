const { chromium } = require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const server=http.createServer((rq,rs)=>{const f=path.join(__dirname, rq.url==='/'?'work.html':rq.url.split('?')[0]);
 fs.readFile(f,(e,d)=>{if(e){rs.writeHead(404);rs.end();return;} if(f.endsWith('.woff2'))rs.setHeader('Content-Type','font/woff2'); rs.writeHead(200);rs.end(d);});});
(async()=>{
 await new Promise(r=>server.listen(8767,r));
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const p=await b.newPage({ locale:'ko-KR',viewport:{width:360,height:780}});
 await p.goto('http://localhost:8767/work.html'); await p.waitForTimeout(2300);
 await p.evaluate(()=>{ try{skipWelcome();}catch(_){}
  window.__user={uid:'U1',email:'a@b.c',name:'김'}; me=window.__user;
  boats=[{id:'B1',name:'선샤인',type:'sail',port:'여수'}]; seedRanks(boats[0]);
  boats[0].members={U1:ownerRank(boats[0]).id}; currentBoatId='B1'; window.currentBoatId='B1';
  unlocked=true; dgImgs={plan:DG_BUILTIN.sail.plan,side:DG_BUILTIN.sail.side};
  save&&save(); try{applyBoatName();}catch(_){} });
 await p.waitForTimeout(400);
 for(const [name,fn] of [['적재표',()=>{switchTab('boat');setBoatSubTab('stow');closeBoat();}],
                          ['정기점검',()=>{switchTab('boat');setBoatSubTab('maint');}],
                          ['수리',()=>{switchTab('boat');setBoatSubTab('repair');}],
                          ['연료',()=>{switchTab('boat');setBoatSubTab('fuel');}],
                          ['커뮤니티',()=>{switchTab('community');}],
                          ['항해일지',()=>{switchTab('voyage');}],
                          ['오늘',()=>{switchTab('home');}]]){
   await p.evaluate(fn); await p.waitForTimeout(600);
   const r = await p.evaluate(()=>{ const h=document.getElementById('hint');
     const c=h?getComputedStyle(h):null;
     return {보임: !!(h && c.display!=='none' && h.offsetHeight>0), 인라인: h?h.style.display:'?' }; });
   console.log((r.보임?'★ 보임 ':'  안 보임')+'  '+name+'  (inline display="'+r.인라인+'")');
 }
 await b.close(); server.close();
})();
