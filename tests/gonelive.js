// 4.89 — 휴지통을 비우면 「지웠다는 표」만 남는다 (진짜 화면에서)
//
// ★ 사장님 화면에서 실제로 일어나는 일을 그대로 밟는다.
//   물품을 지우고 → 휴지통을 비우고 → 휴지통이 비어 보이는지 →
//   그런데 「지운 것」 목록에는 남아 있는지.
const { chromium } = require('playwright');
const http=require('http'), fs=require('fs'), path=require('path');
const FILE = process.argv[2] || 'work.html';
const server = http.createServer((rq,rs)=>{
  const f = ((rq.url === '/' && path.isAbsolute(FILE)) ? FILE : path.join(__dirname, rq.url === '/' ? FILE : rq.url.split('?')[0]));
  fs.readFile(f,(e,d)=>{ if(e){rs.writeHead(404);rs.end();return;}
    if(f.endsWith('.woff2')) rs.setHeader('Content-Type','font/woff2');
    rs.writeHead(200); rs.end(d); });
});
let ok=0,bad=0;
const T=(n,c,w)=>{ if(c){ok++;console.log('통과: '+n);}
  else{bad++;console.log('★ 실패: '+n+(w!==undefined?' — '+JSON.stringify(w).slice(0,220):''));} };

(async()=>{
  await new Promise(r=>server.listen(0,r));
  const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const ctx=await br.newContext({ locale:'ko-KR',viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const pg=await ctx.newPage();
  const errs=[]; pg.on('pageerror',e=>errs.push(String(e).slice(0,140)));
  await pg.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'networkidle'});
  await pg.waitForTimeout(900);
  await pg.evaluate(()=>{ window.tell=()=>Promise.resolve(); window.ask=()=>Promise.resolve(true);
    try{skipWelcome();}catch(_){} unlocked=true; openBoatSetup(); });
  await pg.waitForTimeout(400);
  await pg.evaluate(()=>{ document.getElementById('nbName').value='시험호'; createBoat(); });
  await pg.waitForTimeout(1500);

  // ── 물품 두 개와 정기점검 하나를 만든다 ──────────────────────────────
  await pg.evaluate(()=>{
    if(!lockers.length){ try{ seedLockersIfNeeded(); }catch(_){} }
    const lk = (lockers[0] && lockers[0].id) != null ? lockers[0].id : 1;
    items.push({id:9001,name:'임펠러',qty:1,lockerId:lk,photos:[],box:false,parentId:null,unit:''});
    items.push({id:9002,name:'연료필터',qty:2,lockerId:lk,photos:[],box:false,parentId:null,unit:''});
    maint.push({id:9101,name:'엔진오일 교환',every:180});
    save(); saveMR();
  });
  await pg.waitForTimeout(400);

  // ── 지운다 → 휴지통으로 간다 ─────────────────────────────────────────
  await pg.evaluate(()=>{
    deleteItem(9001);
    // 정기점검을 휴지통으로 — 앱이 하는 것과 같은 모양으로 넣는다
    const it = maint.find(x=>x.id===9101);
    mrTrash.push({ id:'maint_'+it.id, kind:'maint', data:JSON.parse(JSON.stringify(it)),
                   delAt:new Date().toISOString() });
    maint = maint.filter(x=>x.id!==9101);
    saveMR();
  });
  await pg.waitForTimeout(500);
  const 담김 = await pg.evaluate(()=>({ 통:trashShown().length, 정:mrTrashShown().length }));
  T('★ 지우면 휴지통에 담긴다', 담김.통 === 1 && 담김.정 === 1, 담김);
  // ★ 4.132 — 휴지통 단추는 적재표 도구줄에서 없어지고 설정 「지운 기록」 줄로 갔다.
  //   그러니 옛 단추가 없는 것과, 새 자리에 개수가 뜨는 것을 둘 다 본다.
  T('★ 적재표 도구줄에 옛 휴지통 단추가 없다 (4.132)',
    await pg.evaluate(()=>!document.getElementById('trashTab')));
  const 설정담김 = await pg.evaluate(()=>{ openSettings(); updateTrashTab();
    const r=document.getElementById('setTrashRow');
    return r ? r.innerText.replace(/\s+/g,' ').trim() : '없음'; });
  T('★ 설정 「지운 기록」 줄이 있다', 설정담김 !== '없음' && /휴지통/.test(설정담김), 설정담김);
  T('★ 그 줄에 담긴 개수가 뜬다', /2개/.test(설정담김), 설정담김);
  await pg.evaluate(()=>{ try{ closePanel(); }catch(_){} });

  // ── 휴지통을 비운다 ──────────────────────────────────────────────────
  await pg.evaluate(()=>purgeAll());
  await pg.waitForTimeout(600);
  const 뒤 = await pg.evaluate(()=>({
    보이는통: trashShown().length, 보이는정: mrTrashShown().length,
    실제통: trash.length, 실제정: mrTrash.length,
    단추: (function(){ openSettings(); updateTrashTab();
            const r=document.getElementById('setTrashRow');
            const s=r&&r.querySelector('span.mrm');
            try{ closePanel(); }catch(_){}
            return s ? s.textContent.trim() : '없음'; })(),
    표: trash.concat(mrTrash).map(x=>({id:x.id, gone:!!x.gone, 속: Object.keys(x).length}))
  }));
  T('★★★ 비우면 휴지통이 비어 보인다', 뒤.보이는통 === 0 && 뒤.보이는정 === 0, 뒤);
  T('★★★ 그런데 「지웠다는 표」는 남아 있다', 뒤.실제통 === 1 && 뒤.실제정 === 1, 뒤);
  T('★★ 설정 줄에 개수가 안 뜬다 (「휴지통이 비어 있습니다」)',
    /비어 있습니다/.test(뒤.단추) && !/\d개/.test(뒤.단추), 뒤.단추);
  T('★★★ 표에는 속이 안 남는다 (가볍다)', 뒤.표.every(x=>x.gone && x.속 <= 5), 뒤.표);

  // ── 사장님이 겪으신 일: 꺼져 있던 폰이 옛 줄을 도로 올린다 ───────────
  const 되살아났나 = await pg.evaluate(()=>{
    const lk = (lockers[0] && lockers[0].id) != null ? lockers[0].id : 1;
    const 옛물품  = { id:9001, name:'임펠러', qty:1, lockerId:lk, photos:[], box:false, parentId:null, unit:'' };
    const 옛점검  = { id:9101, name:'엔진오일 교환', every:180 };
    const a = keepMine('items', [옛물품]).some(x=>String(x.id)==='9001');
    const b = keepMine('maint', [옛점검]).some(x=>String(x.id)==='9101');
    return { 물품: a, 점검: b };
  });
  T('★★★ 비운 물품이 클라우드에서 와도 안 되살아난다', 되살아났나.물품 === false, 되살아났나);
  T('★★★ 비운 정기점검도 안 되살아난다',    되살아났나.점검 === false, 되살아났나);

  // ── 휴지통 화면이 「비어 있습니다」 라고 말한다 ──────────────────────
  await pg.evaluate(()=>openTrash()); await pg.waitForTimeout(400);
  const 글 = await pg.evaluate(()=>document.querySelector('#trashBody').textContent.trim());
  T('★★★ 휴지통 화면에 「비어 있습니다」 라고 뜬다', /비어 있습니다/.test(글), 글);
  T('★★ 지운 물품 이름이 화면에 안 남는다', !/임펠러|엔진오일/.test(글), 글);
  await pg.evaluate(()=>closeTrash());

  // ── 안 지운 물품은 멀쩡하다 (사용자 자료는 안 건드린다) ─────────────
  T('★★★ 안 지운 물품은 그대로 있다',
    await pg.evaluate(()=>items.some(x=>String(x.id)==='9002')));

  // ── 표를 되살리기는 안 된다 ──────────────────────────────────────────
  const 전 = await pg.evaluate(()=>items.length);
  await pg.evaluate(()=>{ try{ restoreItem(9001); }catch(_){}
                          try{ mrRestore('maint_9101'); }catch(_){} });
  await pg.waitForTimeout(400);
  T('★★★ 표를 되살리려 해도 빈 줄이 안 생긴다',
    await pg.evaluate(()=>items.length) === 전 && await pg.evaluate(()=>!maint.some(x=>x&&x.id==null)));

  T('★ 화면 오류가 없다', errs.length === 0, errs);
  console.log('\n통과 '+ok+' · 실패 '+bad);
  await br.close(); server.close(); process.exit(bad?1:0);
})();
