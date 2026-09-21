// 물품 → 도면 확대 — 진짜 브라우저에서 눌러 본다
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const FILE = process.argv[2] || 'work.html';
const server = http.createServer((rq,rs)=>{
  const f = ((rq.url === '/' && path.isAbsolute(FILE)) ? FILE : path.join(__dirname, rq.url === '/' ? FILE : rq.url.split('?')[0]));
  fs.readFile(f,(e,d)=>{ if(e){rs.writeHead(404);rs.end();return;}
    if(f.endsWith('.woff2')) rs.setHeader('Content-Type','font/woff2');
    rs.writeHead(200); rs.end(d); });
});
let ok=0,bad=0;
const T=(n,c,w)=>{ if(c){ok++;console.log('통과: '+n);} else {bad++;console.log('★ 실패: '+n+(w?' — '+w:''));} };
(async ()=>{
  await new Promise(r=>server.listen(0,r));
  const br = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await br.newContext({ locale:'ko-KR', viewport:{width:390,height:780}, isMobile:true, hasTouch:true });
  const pg = await ctx.newPage();
  const errs=[]; pg.on('pageerror', e=>errs.push(String(e)));
  await pg.goto('http://127.0.0.1:'+server.address().port+'/', { waitUntil:'networkidle' });
  await pg.waitForTimeout(900);
  await pg.evaluate(()=>{
    try{ skipWelcome(); }catch(_){}
    window.__user={uid:'U1',email:'a@b.c',name:'김선장'}; me=window.__user;
    boats=[{id:'B1',name:'테스트호',type:'sail',port:'여수'}]; seedRanks(boats[0]);
    boats[0].members={U1:ownerRank(boats[0]).id}; currentBoatId='B1'; window.currentBoatId='B1';
    unlocked=true; dgLocked=false; lkLocked=false;
    dgImgs={plan:DG_BUILTIN.sail.plan, side:DG_BUILTIN.sail.side};
    lockers=[];
    const a=lkAdd({x:10,y:10,w:12,h:8},'갤리','싱크대 아래');
    const b=lkAdd({x:70,y:72,w:10,h:7},'선미','선미 창고');
    items=[{id:1,lockerId:a.id,locker:a.label,zone:a.zone,name:'구명조끼',qty:'6',unit:'벌',note:'',photos:[]},
           {id:2,lockerId:b.id,locker:b.label,zone:b.zone,name:'예비 앵커',qty:'1',unit:'개',note:'',photos:[]}];
    save&&save(); switchTab('boat'); setBoatSubTab('stow');
  });
  await pg.waitForTimeout(500);

  // 검색 → 물품 누르면 칸이 열린다 (원래 있던 기능)
  const opened = await pg.evaluate(()=>{
    doSearch('앵커');
    const n = document.querySelectorAll('#searchResults .sr').length;
    goToItem(2);
    return { n, open: document.getElementById('panel').classList.contains('open'),
             label: (document.getElementById('pl')||{}).textContent };
  });
  T('검색 결과가 나온다', opened.n === 1, String(opened.n));
  T('누르면 그 칸이 열린다', opened.open && /선미 창고/.test(opened.label||''), JSON.stringify(opened));

  // 물품을 한 번 더 누르면 도면이 확대된다
  const zoomed = await pg.evaluate(async ()=>{
    showItemOnMap(2);
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    const m = document.getElementById('map');
    const btn = document.getElementById('mapZBack');
    return { panel: document.getElementById('panel').classList.contains('open'),
             tf: m.style.transform, z: mapZ ? {s:+mapZ.s.toFixed(2)} : null,
             btn: btn ? getComputedStyle(btn).display : 'x',
             clipped: document.getElementById('mapWrap').classList.contains('zoomed'),
             flash: !!document.querySelector('.box.zflash') };
  });
  T('물품을 누르면 칸 목록이 닫힌다', zoomed.panel === false);
  T('도면이 확대된다', !!zoomed.z && zoomed.z.s > 1.3 && /scale\(/.test(zoomed.tf), JSON.stringify(zoomed));
  T('[원래대로] 단추가 보인다', zoomed.btn === 'block', zoomed.btn);
  T('넘치는 부분을 잘라낸다', zoomed.clipped);
  T('그 칸이 깜빡인다', zoomed.flash);

  // 찾아간 칸이 진짜 화면 가운데로 오는가
  const centered = await pg.evaluate(()=>{
    const w = document.getElementById('mapWrap').getBoundingClientRect();
    const b = document.querySelector('.box.zflash') || document.querySelector('.box[data-id]');
    const r = b.getBoundingClientRect();
    return { dx: Math.abs((r.left+r.right)/2 - (w.left+w.right)/2),
             dy: Math.abs((r.top+r.bottom)/2 - (w.top+w.bottom)/2), ww: w.width, wh: w.height };
  });
  T('찾아간 칸이 화면 가운데로 온다',
    centered.dx < centered.ww*0.25 && centered.dy < centered.wh*0.35, JSON.stringify(centered));

  // 원래대로
  const back = await pg.evaluate(()=>{ mapZReset();
    return { tf: document.getElementById('map').style.transform,
             btn: getComputedStyle(document.getElementById('mapZBack')).display,
             clipped: document.getElementById('mapWrap').classList.contains('zoomed') }; });
  T('[원래대로]를 누르면 돌아온다',
    /scale\(1\)/.test(back.tf) && back.btn === 'none' && !back.clipped, JSON.stringify(back));

  // 칸 그리기를 켜면 확대가 풀린다
  const draw = await pg.evaluate(()=>{
    mapZReset();
    mapFocusLocker(lockers[0].id);
    const before = mapTouched;
    toggleLkEdit();                 // 켜면 원래 크기로
    const after = mapTouched;
    toggleLkEdit();                 // 끄면 그대로 둔다
    return { before, after };
  });
  T('그리기를 켜면 확대가 풀린다', draw.before === true && draw.after === false, JSON.stringify(draw));

  // 수납칸에 안 넣은 물품
  const orphan = await pg.evaluate(()=>{
    let msg=''; window.tell = t => { msg = t; return Promise.resolve(); };
    items.push({id:9,lockerId:null,name:'미배치',qty:'1',unit:'개',note:'',photos:[]});
    showItemOnMap(9);
    return msg;
  });
  T('수납칸에 없는 물품은 까닭을 말한다', /수납칸에 넣지 않았습니다/.test(orphan), orphan);

  // 확대해도 좌표 계산이 어긋나지 않는가 (칸 그리기가 이 계산을 쓴다)
  const pct = await pg.evaluate(()=>{
    mapZReset();
    const m = document.getElementById('map');
    const r0 = m.getBoundingClientRect();
    const p0 = lkPct({ clientX: r0.left + r0.width*0.25, clientY: r0.top + r0.height*0.25 });
    mapFocusLocker(lockers[0].id);
    const r1 = m.getBoundingClientRect();
    const p1 = lkPct({ clientX: r1.left + r1.width*0.25, clientY: r1.top + r1.height*0.25 });
    mapZReset();
    return { p0, p1 };
  });
  T('확대해도 좌표 계산이 그대로다',
    Math.abs(pct.p0.x - pct.p1.x) < 0.6 && Math.abs(pct.p0.y - pct.p1.y) < 0.6, JSON.stringify(pct));


  // ── 확대한 뒤에도 자유롭게 옮길 수 있는가
  const pan = await pg.evaluate(()=>{
    mapZReset(); stowZoomBind();
    stowZoom(2.5);                              // [+] 두 번쯤 누른 셈
    const before = { x: mapZ.x, y: mapZ.y, s: +mapZ.s.toFixed(2) };
    const f = document.getElementById('mapWrap');
    const r = f.getBoundingClientRect();
    const send = (t, x, y) => f.dispatchEvent(new PointerEvent(t, {
      clientX:r.left+x, clientY:r.top+y, bubbles:true, pointerId:1 }));
    send('pointerdown', 200, 200);
    send('pointermove', 160, 150);
    send('pointermove', 120, 110);
    send('pointerup',   120, 110);
    return { before, after:{ x:mapZ.x, y:mapZ.y }, panned: mapPanned };
  });
  T('확대한 뒤 끌어서 옮길 수 있다',
    Math.abs(pan.after.x - pan.before.x) > 20 || Math.abs(pan.after.y - pan.before.y) > 20,
    JSON.stringify(pan));
  T('끌었다는 것을 기억한다 (칸이 안 열리게)', pan.panned > 6, String(pan.panned));

  // 끌고 나면 칸이 안 열린다
  const noOpen = await pg.evaluate(()=>{
    closePanel();
    mapPanned = 50;
    document.querySelector('.box[data-id]').onclick();
    const a = document.getElementById('panel').classList.contains('open');
    document.querySelector('.box[data-id]').onclick();   // 두 번째는 열려야 한다
    const b = document.getElementById('panel').classList.contains('open');
    return { a, b };
  });
  T('끌고 난 뒤에는 칸이 안 열린다', noOpen.a === false, JSON.stringify(noOpen));
  T('그 다음 누르면 칸이 열린다', noOpen.b === true, JSON.stringify(noOpen));

  // [+] [−] [원래대로] 단추
  const btns = await pg.evaluate(()=>{
    closePanel(); mapZReset();
    const bs = [...document.querySelectorAll('.mapzoom button')];
    const back = document.getElementById('mapZBack');
    const hid0 = getComputedStyle(back).display;
    bs[0].click();                                  // +
    const s1 = +mapZ.s.toFixed(2);
    const hid1 = getComputedStyle(back).display;
    bs[1].click();                                  // −
    const s2 = +mapZ.s.toFixed(2);
    bs[0].click(); bs[0].click();
    back.click();                                   // 원래대로
    return { n:bs.length, hid0, s1, hid1, s2, s3:+mapZ.s.toFixed(2), touched: mapTouched };
  });
  T('확대·축소·원래대로 단추가 있다', btns.n === 3, JSON.stringify(btns));
  T('평소에는 [원래대로]가 숨어 있다', btns.hid0 === 'none', btns.hid0);
  T('[+] 로 커진다', btns.s1 > 1.4, String(btns.s1));
  T('확대하면 [원래대로]가 나온다', btns.hid1 === 'block', btns.hid1);
  T('[−] 로 작아진다', btns.s2 < btns.s1, JSON.stringify([btns.s1, btns.s2]));
  T('[원래대로]로 돌아온다', btns.s3 === 1 && btns.touched === false, JSON.stringify(btns));

  // 두 손가락 확대
  const pinch = await pg.evaluate(()=>{
    mapZReset();
    const f = document.getElementById('mapWrap');
    const r = f.getBoundingClientRect();
    const T2 = (x1,y1,x2,y2) => [
      { clientX:r.left+x1, clientY:r.top+y1, identifier:1 },
      { clientX:r.left+x2, clientY:r.top+y2, identifier:2 }];
    const ev = (t, touches) => { const e = new Event(t, {bubbles:true, cancelable:true});
      e.touches = touches; f.dispatchEvent(e); };
    ev('touchstart', T2(150,300, 200,300));
    ev('touchmove',  T2(100,300, 280,300));         // 벌린다
    const s = +mapZ.s.toFixed(2);
    ev('touchend', []);
    return s;
  });
  T('두 손가락으로 벌리면 커진다', pinch > 1.2, String(pinch));

  // 그리기 중에는 이동·확대가 꺼진다
  const inEdit = await pg.evaluate(()=>{
    mapZReset(); stowZoom(2.5);
    const wasS = +mapZ.s.toFixed(2);
    toggleLkEdit();                                  // 켜면 원래대로 돌아간다
    const afterOn = +mapZ.s.toFixed(2);
    const f = document.getElementById('mapWrap');
    const r = f.getBoundingClientRect();
    const send = (t,x,y)=>f.dispatchEvent(new PointerEvent(t,{clientX:r.left+x,clientY:r.top+y,bubbles:true,pointerId:1}));
    send('pointerdown',200,200); send('pointermove',100,100); send('pointerup',100,100);
    const moved = +mapZ.x.toFixed(1);
    toggleLkEdit();
    return { wasS, afterOn, moved };
  });
  T('그리기를 켜면 원래 크기로 돌아간다', inEdit.wasS > 2 && inEdit.afterOn === 1, JSON.stringify(inEdit));
  T('그리는 중에는 도면이 안 밀린다', inEdit.moved === 0, JSON.stringify(inEdit));

  T('앱이 터지지 않았다', errs.length===0, errs.join(' / ').slice(0,200));
  console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
  await br.close(); server.close();
  process.exit(bad?1:0);
})();
