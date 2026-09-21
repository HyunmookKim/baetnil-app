// 4.91 — 사장님이 두 번 말씀하신 것 두 가지
//
// ① 「장비 안에 들어간 정비는 도면에서 그냥 장비만 나오게 하라」
//    4.87 에서 제가 장비와 정기점검을 함께 그렸다. 잘못이다.
// ② 「장비 등록하는데 자꾸 자동으로 도면으로 돌아간다」
//    핀 지정이 화면을 도면으로 바꿔 놓고 되돌리지 않았다.
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

  // 장비 하나 · 정기점검 둘(하나는 그 장비에 매임) 을 만든다
  await pg.evaluate(()=>{
    // 도면이 없으면 「핀 지정」이 일찍 빠져나간다 — 가짜 도면을 넣는다
    const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    dgImgs.plan = PNG; dgImgs.side = PNG;
    if(typeof dgSmall !== 'undefined'){ dgSmall.plan = PNG; dgSmall.side = PNG; }
    mrMapKind = 'plan';
    maint.length = 0;
    maint.push({ id:701, typ:'gear', name:'빌지펌프', pin:{map:'plan',x:30,y:40} });
    maint.push({ id:702, name:'빌지펌프 작동 점검', gearId:701 });
    maint.push({ id:703, name:'따로 있는 점검', pin:{map:'plan',x:60,y:70} });
    saveMR();
  });
  await pg.waitForTimeout(400);

  // ══ ① 도면에 장비만 나온다 ═════════════════════════════════════════
  const 그린것 = await pg.evaluate(()=>{
    setBoatSubTab('gear'); setGearSub('gear');
    return mrPinRows().map(x=>({ id:x.id, name:x.name, 장비:!!(x.typ==='gear') }));
  });
  console.log('  도면에 그리는 것: ' + 그린것.map(x=>x.name).join(', '));
  T('★★★ 도면에 장비만 나온다', 그린것.length === 1 && 그린것[0].id === 701, 그린것);
  T('★★★ 장비에 매인 정기점검은 따로 안 나온다', !그린것.some(x=>x.id===702), 그린것);
  T('★★★ 장비에 안 매인 정기점검도 안 나온다 (사장님이 장비만 하라 하셨다)',
    !그린것.some(x=>x.id===703), 그린것);
  const 수리것 = await pg.evaluate(()=>{
    repair.length=0; repair.push({id:801,title:'수리 하나'});
    setBoatSubTab('gear'); goMaint('repair');
    return mrPinRows().map(x=>x.id);
  });
  T('★★ 수리 도면에는 수리가 나온다 (거기는 안 건드렸다)', 수리것.indexOf(801) >= 0, 수리것);

  // ══ ② 핀을 찍어도 장비 화면이 도면에 눌러앉지 않는다 ═══════════════
  const 흐름 = await pg.evaluate(async ()=>{
    setBoatSubTab('gear'); setGearSub('gear');
    mrViewSet('gear','list');                 // 사장님은 목록을 보고 계셨다
    const 전 = mrViewOf('gear');
    openMR('gear', 701);                       // 장비를 연다
    pinStart();                                // 「핀 지정」 을 누른다
    const 도중 = mrViewOf('gear');              // 이때는 도면이어야 한다
    // 도면에서 자리를 찍는다
    mrMapClick({ clientX:0, clientY:0 });       // img 가 없으면 아무 일도 안 한다
    if(pinTarget){                              // 진짜로 찍어 준다
      const it = getMR('gear',701); it.pin = {map:mrMapKind,x:10,y:10};
      const 돌 = pinTarget.온자리; pinCancel(); saveMR();
      if(돌 === 'map') setMapKind(mrMapKind, true);
    }
    return { 전, 도중, 후: mrViewOf('gear') };
  });
  T('★★ 핀 지정 중에는 도면이 뜬다', 흐름.도중 === 'map', 흐름);
  T('★★★ 핀을 찍고 나면 원래 보던 목록으로 돌아온다 (도면에 눌러앉지 않는다)',
    흐름.후 === 'list', 흐름);

  // ══ ③ 그만두어도 돌아온다 ═════════════════════════════════════════
  const 취소 = await pg.evaluate(()=>{
    mrViewSet('gear','list');
    openMR('gear', 701); pinStart();
    const 도중 = mrViewOf('gear');
    pinCancel();
    return { 도중, 후: mrViewOf('gear') };
  });
  T('★★★ 핀 지정을 그만두어도 목록으로 돌아온다', 취소.후 === 'list', 취소);

  // ══ ④ 도면에서 시작한 추가는 도면에 남는다 ════════════════════════
  const 도면추가 = await pg.evaluate(()=>{
    mrViewSet('gear','map');
    pinAddStart('gear');
    const 자리 = pinTarget ? pinTarget.온자리 : null;
    pinCancel();
    return { 자리, 후: mrViewOf('gear') };
  });
  T('★★★ 도면에서 시작하면 도면에 남는다 (거기서 계속 찍는다)',
    도면추가.후 === 'map', 도면추가);

  // ══ ⑤ 장비를 새로 넣어도 도면으로 안 튄다 ═════════════════════════
  const 새장비 = await pg.evaluate(()=>{
    mrViewSet('gear','list'); setGearSub('gear');
    const 전 = maint.filter(x=>x.typ==='gear').length;
    addGear();
    return { 늘었나: maint.filter(x=>x.typ==='gear').length === 전+1, 자리: mrViewOf('gear') };
  });
  T('★★ 장비가 하나 늘었다', 새장비.늘었나, 새장비);
  T('★★★ 목록에서 장비를 넣으면 목록에 그대로 있다', 새장비.자리 === 'list', 새장비);

  // ══ ⑥ ★ 사장님이 실제로 보신 것 — 컴퓨터 너비에서 도면이 위에 남는다 ══
  //    #mrPanel.full 자리 규칙이 @media(max-width:700px) 안에만 있어서
  //    넓은 화면에서는 기록 칸이 도면 아래로 밀렸다.
  for(const [w,h,이름] of [[1248,768,'컴퓨터'],[390,844,'폰']]){
    await pg.setViewportSize({ width:w, height:h });
    await pg.waitForTimeout(300);
    const r = await pg.evaluate(()=>{
      setBoatSubTab('gear'); setGearSub('gear');
      mrViewSet('gear','map'); renderGearWrap();
      pinAddStart('gear');
      // 도면에서 자리를 찍은 것과 같게 만든다
      const id = pinNewRec('gear');
      const it = getMR('gear', id); it.pin = { map:mrMapKind, x:20, y:30 };
      pinCancel(); saveMR(); setMapKind(mrMapKind, true);
      openMR('gear', id);
      const map = document.getElementById('mrMapWrap');
      const P = document.getElementById('mrPanel');
      const mv = map && getComputedStyle(map).display !== 'none'
                 && map.getBoundingClientRect().height > 0;
      return { 도면보임: !!mv, 칸열림: !!(P && P.classList.contains('open')),
               칸높이: P ? Math.round(P.getBoundingClientRect().height) : 0 };
    });
    T('★★★ ' + 이름 + '(' + w + 'px) — 기록 칸이 열린다', r.칸열림, r);
    T('★★★ ' + 이름 + ' — 기록을 보는 동안 도면이 위에 안 뜬다', r.도면보임 === false, r);
    T('★★ ' + 이름 + ' — 기록 칸이 화면을 제대로 쓴다', r.칸높이 > h * 0.4, r);
    // 닫으면 도면이 돌아온다
    // ★ 다시 그리지 않고 닫기만 한다 — 되돌리는 쪽이 제 일을 하는지 봐야 한다
    const back = await pg.evaluate(()=>{
      closeMR();
      const map = document.getElementById('mrMapWrap');
      return map && getComputedStyle(map).display !== 'none';
    });
    T('★★★ ' + 이름 + ' — 닫으면 도면이 돌아온다', back === true, back);
  }
  await pg.setViewportSize({ width:390, height:844 });

  // ══ ⑦ 상태 · 계통 그림 · 고장 그림 (4.91 — 사장님 지적 셋) ══════════
  const 그림 = await pg.evaluate(()=>{
    maint.length = 0; repair.length = 0;
    maint.push({ id:801, typ:'gear', name:'엔진',   sys:'추진',   pin:{map:'plan',x:10,y:10} });
    maint.push({ id:802, typ:'gear', name:'윈들러스', sys:'계류·묘박', pin:{map:'plan',x:20,y:20} });
    maint.push({ id:803, typ:'gear', name:'AIS',    sys:'항해장비', pin:{map:'plan',x:30,y:30} });
    maint.push({ id:804, typ:'gear', name:'빌지펌프', sys:'배관·위생', pin:{map:'plan',x:40,y:40} });
    // 804 는 고장 났다
    repair.push({ id:901, name:'빌지펌프 안 돎', gearId:804, status:'open' });
    repair.push({ id:902, name:'다 고침',        gearId:803, status:'done' });
    saveMR();
    return {
      엔진: gearIcon(getMR('gear',801)), 묘박: gearIcon(getMR('gear',802)),
      항해: gearIcon(getMR('gear',803)), 고장난것: gearIcon(getMR('gear',804)),
      고장색: pinColor(getMR('gear',804),'gear'),
      성한색: pinColor(getMR('gear',801),'gear'),
      고장인가: gearBroken(getMR('gear',804)),
      다고친것: gearBroken(getMR('gear',803)),
      // ★ 고장 난 것은 「제 계통 그림」이 아니어야 한다 — 그래야 눈에 띈다
      제계통그림: GEAR_ICON['배관·위생']
    };
  });
  console.log('  그림: 엔진 ' + 그림.엔진 + ' · 묘박 ' + 그림.묘박 + ' · 항해 ' + 그림.항해
              + ' · 고장 ' + 그림.고장난것);
  T('★★★ 계통마다 그림이 다르다',
    new Set([그림.엔진, 그림.묘박, 그림.항해]).size === 3, 그림);
  T('★★★ 고장 난 장비는 제 계통 그림이 아니라 고장 그림이 뜬다',
    그림.고장난것 !== 그림.제계통그림 && 그림.고장난것 !== 그림.엔진, 그림);
  T('★★★ 고장 난 장비는 색도 다르다', 그림.고장색 !== 그림.성한색, 그림);
  T('★★ 다 고친 수리는 고장으로 안 친다', 그림.다고친것 === false, 그림);
  T('★★ 안 고친 수리가 있으면 고장이다', 그림.고장인가 === true, 그림);

  const 상태칸 = await pg.evaluate(()=>{
    const 뽑 = id => { openMR('gear', id);
      const P = document.getElementById('mrPanel');
      const rows = [...P.querySelectorAll('.mrrow')]
        .filter(r => (r.querySelector('.mrlbl')||{}).textContent === '상태');
      return rows.length ? rows[0].textContent.replace(/\s+/g,' ').trim() : null; };
    return { 성한것: 뽑(801), 고장난것: 뽑(804) };
  });
  T('★★★ 장비 칸에 「상태」 줄이 있다', !!상태칸.성한것 && !!상태칸.고장난것, 상태칸);
  T('★★★ 성한 장비는 「이상 없음」', /이상 없음/.test(상태칸.성한것||''), 상태칸);
  T('★★★ 고장 난 장비는 「고장」 이라고 뜬다', /고장/.test(상태칸.고장난것||''), 상태칸);
  // ★ 4.93 — 상태는 「성한가」만 말한다. 정기점검 날짜는 아래 줄에 이미 있다.
  //   사장님 지적 —「상태 곧은 또 뭐냐. 정기점검 내용은 아래 다 표시되는데」
  const 날짜섞임 = await pg.evaluate(()=>{
    // 점검이 밀린 장비를 만든다 — 상태 줄에 그것이 새면 안 된다
    maint.push({ id:850, typ:'gear', name:'밀린것', sys:'전기', pin:{map:'plan',x:50,y:50} });
    maint.push({ id:851, name:'점검', gearId:'850', months:1, unit:'m', lastDate:'2020-01-01' });
    saveMR();
    openMR('gear', 850);
    const P = document.getElementById('mrPanel');
    const r = [...P.querySelectorAll('.mrrow')]
      .filter(x => (x.querySelector('.mrlbl')||{}).textContent === '상태');
    return r.length ? r[0].textContent.replace(/\s+/g,' ').trim() : null;
  });
  T('★★★ 상태 줄에 정기점검 날짜(밀림·곧)가 안 샌다',
    !!날짜섞임 && !/밀림|곧/.test(날짜섞임), 날짜섞임);
  T('★★★ 고장이 없으면 「이상 없음」 이다 (점검이 밀렸어도)',
    /이상 없음/.test(날짜섞임||''), 날짜섞임);
  await pg.evaluate(()=>closeMR());
  await pg.evaluate(()=>closeMR());

  T('★ 화면 오류가 없다', errs.length === 0, errs);
  console.log('\n통과 '+ok+' · 실패 '+bad);
  await br.close(); server.close(); process.exit(bad?1:0);
})();
