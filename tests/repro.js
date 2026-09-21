const { chromium } = require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const F=process.argv[2]||'work.html';
const server=http.createServer((rq,rs)=>{const f=path.join(__dirname,rq.url==='/'?F:rq.url.split('?')[0]);
 fs.readFile(f,(e,d)=>{if(e){rs.writeHead(404);rs.end();return;}
  const ct=f.endsWith('.js')?'text/javascript':'text/html'; rs.writeHead(200,{'Content-Type':ct}); rs.end(d);});});
const EXCL=['homeWrap','weatherWrap','checkWrap','maintWrap','repairWrap','fuelWrap',
            'contactsWrap','voyageWrap','talkWrap','spotWrap','marketWrap','exploreWrap','newsWrap',
            'mapWrap','listView','searchWrap','stowTools'];
(async()=>{
 await new Promise(r=>server.listen(0,r));
 const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const pg=await(await br.newContext({ locale:'ko-KR',viewport:{width:390,height:820},isMobile:true,hasTouch:true})).newPage();
 await pg.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'networkidle'});
 await pg.waitForTimeout(2500);
 await pg.evaluate(()=>{ try{skipWelcome();}catch(_){}
   boats=[{id:'B1',name:'S',type:'sail',port:'여수',lat:34.74,lon:127.74}];
   seedRanks(boats[0]); boats[0].members={U1:ownerRank(boats[0]).id};
   currentBoatId='B1'; unlocked=true; save&&save(); applyBoatName();
   try{ dgImgs={plan:DG_BUILTIN.sail.plan, side:DG_BUILTIN.sail.side}; }catch(_){}
   switchTab('boat'); setBoatSubTab('stow'); });
 await pg.waitForTimeout(900);
 const vis = async ()=> pg.evaluate(ids=>ids.filter(id=>{const e=document.getElementById(id);
   return e && getComputedStyle(e).display!=='none' && e.offsetHeight>0;}), EXCL);
 console.log('1) 적재표에서 보이는 칸:', (await vis()).join(', '));

 // 휴지통(화면)을 연다
 await pg.evaluate(()=>{ try{ openTrash(); }catch(e){ console.log('openTrash 없음'); } });
 await pg.waitForTimeout(700);
 console.log('2) 휴지통 연 뒤 :', (await vis()).join(', ') || '(없음 — 화면이 덮음)',
   ' 스택:', await pg.evaluate(()=>JSON.stringify(SCREEN_STACK)));

 // 화면이 열린 채로 커뮤니티 탭을 누른다 (사람이 실제로 할 수 있는 일)
 await pg.click('#tabCommunity'); await pg.waitForTimeout(700);
 console.log('3) 커뮤니티 누른 뒤:', (await vis()).join(', '),
   ' 스택:', await pg.evaluate(()=>JSON.stringify(SCREEN_STACK)));

 // 화면을 닫는다 (뒤로 가기)
 await pg.goBack().catch(()=>{}); await pg.waitForTimeout(900);
 const after = await vis();
 console.log('4) 뒤로 가기 뒤  :', after.join(', '),
   ' 스택:', await pg.evaluate(()=>JSON.stringify(SCREEN_STACK)),
   ' 탭:', await pg.evaluate(()=>curTab+'/'+comSub));
 const stow = after.filter(x=>['mapWrap','listView','searchWrap','stowTools'].includes(x));
 const com  = after.filter(x=>['talkWrap','spotWrap','marketWrap','exploreWrap','newsWrap'].includes(x));
 console.log(stow.length && com.length
   ? '★ 재현됨 — 커뮤니티 화면 위에 적재표 칸이 그대로 얹혀 있습니다: '+stow.join(', ')
   : (stow.length && !com.length ? '★ 재현됨 — 커뮤니티인데 적재표 칸만 보입니다: '+stow.join(', ')
   : '겹치지 않음'));
 await pg.screenshot({path:'repro.png'});
 await br.close(); server.close();
})();
