const { chromium } = require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const server=http.createServer((rq,rs)=>{const f=path.join(__dirname, rq.url==='/'?(process.env.SRC||'work.html'):rq.url.split('?')[0]);
 fs.readFile(f,(e,d)=>{if(e){rs.writeHead(404);rs.end();return;} if(f.endsWith('.woff2'))rs.setHeader('Content-Type','font/woff2'); rs.writeHead(200);rs.end(d);});});
(async()=>{
 await new Promise(r=>server.listen(8775,r));
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const p=await b.newPage({ locale:'ko-KR',viewport:{width:360,height:780},deviceScaleFactor:2});
 await p.goto('http://localhost:8775/work.html'); await p.waitForTimeout(2300);
 await p.evaluate(()=>{ try{skipWelcome();}catch(_){}
  window.__user={uid:'U1',email:'a@b.c',name:'김'}; me=window.__user;
  boats=[{id:'B1',name:'여수 Shunshine',type:'sail',port:'여수 원형 마리나'}]; seedRanks(boats[0]);
  boats[0].members={U1:ownerRank(boats[0]).id}; currentBoatId='B1'; window.currentBoatId='B1';
  unlocked=true; dgImgs={plan:DG_BUILTIN.sail.plan}; save&&save();
  try{applyBoatName();}catch(_){} try{setSync('동기화됨');}catch(_){} });
 await p.waitForTimeout(400);
 for(const [n,fn] of [['오늘',()=>switchTab('home')],['배',()=>{switchTab('boat');setBoatSubTab('maint');}],
                      ['항해일지',()=>switchTab('voyage')],['커뮤니티',()=>switchTab('community')]]){
   await p.evaluate(fn); await p.waitForTimeout(600);
   const r=await p.evaluate(()=>{
     const h=document.querySelector('header'), nav=document.getElementById('hNav');
     const subs=[...document.querySelectorAll('.hsub')];
     const w=nav.getBoundingClientRect().width;
     const last=subs.length?subs[subs.length-1].getBoundingClientRect():null;
     const wrap=nav.querySelector('.hsubs');
     return {머리줄:Math.round(h.getBoundingClientRect().height),
             둘째줄:Math.round(nav.getBoundingClientRect().height),
             탭수:subs.length,
             다보임: !wrap || wrap.scrollWidth <= wrap.clientWidth + 1,
             넘침: wrap? Math.round(wrap.scrollWidth - wrap.clientWidth):0};
   });
   console.log(n.padEnd(6)+JSON.stringify(r));
 }
 await p.screenshot({path:'hdr.png'});
 await b.close(); server.close();
})();
