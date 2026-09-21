// 화면을 닫았을 때 옛 칸이 지금 화면 밑에 얹히지 않는가.
// ★ 왜 이 검사가 있나
//   screenPop 이 '화면을 열 때 찍어 둔 사진' 을 그대로 되살리고 있었다.
//   화면이 열려 있는 사이에 탭을 바꾸면, 되살린 옛 칸이 지금 화면 밑에 붙었다.
//   사용자가 "원래 나와야 할 창 마지막에 이전 창이 이어져서 나온다" 고 알려 준 것이 이것이다.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const FILE = process.argv[2] || 'work.html';
const server = http.createServer((rq,rs)=>{
  const f = path.join(__dirname, rq.url === '/' ? FILE : rq.url.split('?')[0]);
  fs.readFile(f,(e,d)=>{ if(e){rs.writeHead(404);rs.end();return;}
    const ct = f.endsWith('.js') ? 'text/javascript'
             : f.endsWith('.webmanifest') ? 'application/manifest+json' : 'text/html';
    rs.writeHead(200,{'Content-Type':ct}); rs.end(d); });
});
let ok=0,bad=0;
const T=(n,c,w)=>{ if(c){ok++;console.log('통과: '+n);} else {bad++;console.log('★ 실패: '+n+(w!==undefined?' — '+JSON.stringify(w).slice(0,150):''));} };

// 탭마다 '그 탭 것' 이라고 볼 칸
const OWN = {
  'boat:stow':   ['mapWrap','listView','searchWrap','stowTools'],
  'boat:maint':  ['maintWrap'],
  'boat:fuel':   ['fuelWrap'],
  'voyage:':     ['voyageWrap'],
  'community:talk':  ['talkWrap'],
  'community:spots': ['spotWrap'],
  'home:today':  ['homeWrap'],
  'home:check':  ['checkWrap']
};
const ALL = [...new Set(Object.values(OWN).flat())];

(async ()=>{
  await new Promise(r=>server.listen(0,r));
  const br = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await br.newContext({ locale:'ko-KR', viewport:{width:390,height:820}, isMobile:true, hasTouch:true });
  const pg = await ctx.newPage();
  const errs=[]; pg.on('pageerror', e=>errs.push(String(e)));
  pg.on('dialog', d=>d.accept());
  await pg.goto('http://127.0.0.1:'+server.address().port+'/', { waitUntil:'networkidle' });
  await pg.waitForTimeout(2500);          // 앱 시작이 다 끝나기를 기다린다

  await pg.evaluate(()=>{
    try{ skipWelcome(); }catch(_){}
    window.__user = { uid:'U1', email:'a@b.c', name:'김선장' };
    boats=[{id:'B1',name:'테스트호',type:'sail',port:'여수',lat:34.7404,lon:127.7454}];
    seedRanks(boats[0]); boats[0].members={U1:ownerRank(boats[0]).id};
    currentBoatId='B1'; window.currentBoatId='B1'; unlocked=true; save&&save(); applyBoatName();
    try{ dgImgs={plan:DG_BUILTIN.sail.plan, side:DG_BUILTIN.sail.side}; }catch(_){}
  });

  const shown = () => pg.evaluate(ids=>ids.filter(id=>{
    const e=document.getElementById(id);
    return e && getComputedStyle(e).display!=='none' && e.offsetHeight>0;
  }), ALL);
  const goto_ = async (tab, sub) => {
    await pg.evaluate(([t,s])=>{
      switchTab(t);
      if(t==='boat') setBoatSubTab(s); else if(t==='home') setHomeSub(s);
      else if(t==='community') setComSub(s);
    }, [tab, sub]);
    await pg.waitForTimeout(700);
  };

  // ── 0. 켜자마자 '오늘' 칸이 다른 탭에 껴 있지 않은가
  await goto_('boat','stow');
  {
    const v = await shown();
    T('적재표에 오늘 칸이 껴 있지 않다', v.indexOf('homeWrap') < 0, v);
  }

  // ── 1. 화면을 연 채 탭을 바꾸고 닫아 본다 (여러 조합)
  const SCREENS = [
    ['휴지통',   "openTrash()",              'trashView'],
    ['내 배',    "openBoat()",               'mrPanel'],
    ['도움말',   "typeof openHelp==='function' && openHelp()", 'helpOv']
  ];
  const FROM = [['boat','stow'], ['boat','maint'], ['voyage','']];
  const TO   = [['community','talk'], ['home','today'], ['voyage','']];

  for(const [sname, call, sid] of SCREENS){
    for(const [ft, fs_] of FROM){
      for(const [tt, ts] of TO){
        if(ft===tt) continue;
        await goto_(ft, fs_);
        const opened = await pg.evaluate(async (c)=>{
          try{ eval(c); }catch(e){ return false; }
          await new Promise(r=>setTimeout(r,400));
          return SCREEN_STACK.length > 0;
        }, call);
        if(!opened){ await pg.evaluate(()=>{ try{ closeTopScreen(); }catch(_){} }); continue; }
        await goto_(tt, ts);                       // 화면이 열린 채 탭 바꾸기
        await pg.evaluate(()=>{ try{ closeTopScreen(); }catch(_){} });
        await pg.waitForTimeout(700);
        const v = await shown();
        const mine  = OWN[tt+':'+ts] || [];
        const alien = v.filter(x=>mine.indexOf(x) < 0);
        T(`${ft}/${fs_} → ${sname} → ${tt}/${ts} → 닫기`, alien.length === 0,
          { seen:v, tab_own:mine, alien:alien });
      }
    }
  }

  // ── 1-2. ★ 탭을 안 바꾸고 그냥 닫으면, 있던 내용이 그대로 돌아와야 한다
  //   (안 돌아오면 빈 화면이 된다. 위 검사만으로는 이걸 못 잡는다)
  for(const [ft, fs_] of [['boat','stow'], ['boat','maint'], ['community','talk'], ['home','today']]){
    await goto_(ft, fs_);
    const before = await shown();
    await pg.evaluate(async ()=>{ try{ openTrash(); }catch(_){}
      await new Promise(r=>setTimeout(r,400)); });
    await pg.evaluate(()=>{ try{ closeTopScreen(); }catch(_){} });
    await pg.waitForTimeout(700);
    const after = await shown();
    T(`${ft}/${fs_} → 휴지통 → 그냥 닫기 (내용이 돌아온다)`,
      before.length > 0 && before.every(x=>after.indexOf(x) >= 0)
        && after.every(x=>before.indexOf(x) >= 0),
      { before, after });
  }

  // ── 2. 화면 위에 화면을 쌓았다 닫으면 밑의 화면이 되살아나야 한다
  const nest = await pg.evaluate(async ()=>{
    switchTab('boat'); setBoatSubTab('stow');
    await new Promise(r=>setTimeout(r,300));
    openBoat();                                   // 내 배 (mrPanel)
    await new Promise(r=>setTimeout(r,400));
    const a = SCREEN_STACK.slice();
    openForm({ title:'검사', fields:[{key:'x',label:'ㅎ',value:''}], onOk:()=>{} });
    await new Promise(r=>setTimeout(r,400));
    const b = SCREEN_STACK.slice();
    closeForm();
    await new Promise(r=>setTimeout(r,500));
    const P = document.getElementById('mrPanel');
    return { a, b, stack:SCREEN_STACK.slice(),
             panelOpen: !!(P && P.classList.contains('open')),
             panelShown: !!(P && getComputedStyle(P).display !== 'none') };
  });
  // ★ 스택에 두 개가 쌓이지는 않는다 — 입력 화면이 열리면서 내 배가 가려지고,
  //   그것을 지켜보던 syncScreen 이 내 배를 스택에서 빼기 때문이다 (3.74 도 같다).
  //   중요한 것은 스택 모양이 아니라 '닫았을 때 내 배로 돌아오는가' 다. 아래에서 본다.
  T('입력 화면이 맨 위 화면이 된다', nest.b.indexOf('formOv') >= 0, nest);
  T('위 것을 닫으면 밑의 화면이 그대로 남는다',
    nest.stack.length === 1 && nest.panelOpen && nest.panelShown, nest);

  // ── 3. 뒤로 가기로 앱이 닫히지 않는다 (★ 여기가 제일 위험한 곳)
  await goto_('boat','stow');
  for(let i=0;i<6;i++){ await pg.goBack().catch(()=>{}); await pg.waitForTimeout(400); }
  const alive = await pg.evaluate(()=>{
    try{ return typeof SCREEN_STACK !== 'undefined' && !!document.getElementById('tabbar'); }
    catch(_){ return false; }
  }).catch(()=>false);
  T('뒤로 가기를 여러 번 눌러도 앱이 안 닫힌다', alive === true);

  T('앱이 터지지 않았다', errs.length===0, errs.slice(0,2));
  console.log('합계: '+ok+'개 통과 / '+bad+'개 실패');
  await br.close(); server.close();
  process.exit(bad ? 1 : 0);
})();
