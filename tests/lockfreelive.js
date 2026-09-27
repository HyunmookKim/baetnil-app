// 5.18 — 설정 안에서 하는 일은 보기 전용과 상관없이 된다 (사장님 2026-09-27)
//   「설정까지 들어갔다는 건 이미 사용자가 뭔가를 고칠 마음을 먹고 들어간 곳이라
//     거기는 보기 전용이든 뭐든 바꾸는 게 맞지 않냐」
// ★ 전에 있던 잘못
//   · 보기 전용이면 save() 가 아무것도 안 해서 휴지통 복원이 저장되지 않았다(껐다 켜면 도로 사라짐)
//   · 「클라우드에 올리기」 가 보기 전용이면 올리지도 않고 「올렸습니다」 라고 했다
//   · 휴지통의 복원·완전삭제 단추가 보기 전용이면 안 보였다
//   사용: node lockfreelive.js ../www/index.html
const { chromium } = require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const FILE=path.resolve(process.argv[2]||'../www/index.html'), ROOT=path.dirname(FILE), MAIN=path.basename(FILE);
const srv=http.createServer((q,r)=>{const u=q.url.split('?')[0];fs.readFile(path.join(ROOT,u==='/'?MAIN:u),(e,d)=>{if(e){r.writeHead(404);r.end();return;}r.writeHead(200,{'Content-Type':/\.js$/.test(u)?'text/javascript':'text/html'});r.end(d);});});
let ok=0,bad=0;
const T=(n,c,w)=>{ if(c){ok++;console.log('통과: '+n);} else {bad++;console.log('★ 실패: '+n+(w!==undefined?' — '+JSON.stringify(w).slice(0,300):''));} };
(async()=>{
  await new Promise(r=>srv.listen(0,r));
  const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const ctx=await br.newContext({locale:'ko-KR',viewport:{width:412,height:924},isMobile:true,hasTouch:true});
  await ctx.route(/googleapis|gstatic|firebaseio|open-meteo|firestore/,r=>r.abort());
  await ctx.addInitScript(()=>{ try{ localStorage.setItem('bt_setup','done'); localStorage.setItem('bt_welcome','done'); localStorage.setItem('bt_agree', JSON.stringify({v:'x'})); }catch(_){} });
  const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(String(e)));
  await pg.goto('http://127.0.0.1:'+srv.address().port+'/');
  await pg.waitForFunction(()=>typeof openTrash==='function'); await pg.waitForTimeout(800);
  await pg.evaluate(()=>{
    try{ skipWelcome(); }catch(_){}
    boats=[{id:'B1',name:'SUNSHINE',type:'sail'}]; currentBoatId='B1'; window.currentBoatId='B1';
    lockers=[{id:'L1',name:'선수 창고',x:10,y:10,w:50,h:30}];
    items=[]; trash=[{id:'i9',name:'예비 임펠러',qty:2,lockerId:'L1',photos:[],_delAt:Date.now()}];
    mrTrash=[{id:'mt1',kind:'fuel',delAt:new Date().toISOString(),data:{id:'f9',date:'2026-09-01',liters:50}}];
    fuel=[];
    // 저장·올리기를 센다
    window.__sv=0; const sl=saveLocal; window.saveLocal=function(){ window.__sv++; return sl.apply(this,arguments); };
    window.__push=[]; window.pushNow=async function(){ window.__push.push({free:pushFree, un:unlocked}); };
    cloud=true; pullDone=true;
    window.ask=async()=>true;
    unlocked=false; applyLock();
  });
  // 휴지통
  await pg.evaluate(()=>openTrash()); await pg.waitForTimeout(300);
  const vis=await pg.evaluate(()=>[...document.querySelectorAll('.trestore,.tdelp')].filter(b=>b.getClientRects().length).length);
  T('보기 전용 — 휴지통에 복원·완전삭제 단추가 보인다', vis>=4, vis);
  await pg.evaluate(()=>{ window.__sv=0; restoreItem('i9'); });
  await pg.waitForTimeout(1600);
  let r=await pg.evaluate(()=>({n:items.length, sv:window.__sv, push:window.__push.slice(-1)[0]}));
  T('보기 전용 — 휴지통 물품 복원이 된다', r.n===1, r);
  T('보기 전용 — 복원한 것을 기기에 저장한다', r.sv>=1, r);
  T('보기 전용 — 복원한 것을 클라우드로 올린다', r.push && r.push.free===true, r);
  await pg.evaluate(()=>{ window.__sv=0; mrRestore('mt1'); }); await pg.waitForTimeout(1600);
  r=await pg.evaluate(()=>({n:fuel.length, sv:window.__sv}));
  T('보기 전용 — 휴지통 기록(주유) 복원이 되고 저장된다', r.n===1 && r.sv>=1, r);
  // 클라우드에 올리기
  await pg.evaluate(()=>{ window.__push=[]; syncUp(); }); await pg.waitForTimeout(300);
  r=await pg.evaluate(()=>window.__push);
  T('보기 전용 — 설정의 「클라우드에 올리기」 가 실제로 올린다', r.length===1 && r[0].free===true, r);
  // 보기 전용 설정 끝난 뒤에는 다시 안 올린다 (한 번만)
  await pg.evaluate(()=>{ pushFree=false; window.__push=[]; schedulePush(); }); await pg.waitForTimeout(1500);
  r=await pg.evaluate(()=>window.__push.length);
  T('보기 전용 — 설정 밖에서는 여전히 올리지 않는다', r===0, r);
  // 파일에서 불러오기
  await pg.evaluate(()=>{ window.__clk=0; const f=document.getElementById('restoreFile'); f.click=()=>{ window.__clk++; }; drawerRestore(); });
  r=await pg.evaluate(()=>({clk:window.__clk, un:unlocked}));
  T('보기 전용 — 「파일에서 불러오기」 는 묻지 않고 파일 고르기로 간다', r.clk===1 && r.un===false, r);
  await pg.evaluate(async()=>{
    window.__sv=0;
    const data={items:[{id:'n1',name:'구명조끼',qty:6,lockerId:'L1'}],lockers:[{id:'L1',name:'선수 창고',x:10,y:10,w:50,h:30}]};
    const f=new File([JSON.stringify(data)],'b.json',{type:'application/json'});
    restoreData({target:{files:[f],value:''}});
  });
  await pg.waitForTimeout(1500);
  r=await pg.evaluate(()=>({names:items.map(i=>i.name), sv:window.__sv, un:unlocked}));
  T('보기 전용 — 파일에서 불러온 물품이 들어가고 저장된다', r.names.join()==='구명조끼' && r.sv>=1, r);
  T('보기 전용 — 불러온 뒤에도 보기 전용 그대로', r.un===false, r);
  T('오류 없음', errs.length===0, errs.slice(0,3));
  console.log('\n통과 '+ok+' · 실패 '+bad);
  await br.close(); srv.close(); process.exit(bad?1:0);
})();
