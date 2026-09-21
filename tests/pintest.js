// 정비 탭 「핀 지정」 — 눌러서 도면을 찍으면 핀이 진짜 박히는가.
//
// ★ 왜 이 검사가 있나
//   「핀 지정」을 누르면 pinTarget 이 잡히는데, 1초쯤 뒤에 저절로 지워졌다.
//   사람은 아무것도 안 눌렀다. 까닭은 이랬다 —
//     pinStart → closeMR() 로 기록 창을 닫는다
//     → #mrPanel 의 class 가 바뀐다
//     → 그것을 지켜보던 MutationObserver 가 syncScreen 을 부른다
//     → screenPop('mrPanel') → 쌓인 화면이 없으니 switchTab(curTab)
//     → switchTab 안의 pinCancel() 이 pinTarget 을 지운다
//   그래서 도면을 아무리 눌러도 핀이 안 찍혔다. 3.82 판에서도 같았다 — 오래된 흠이다.
//
//   둘째 까닭도 있었다. 기본 도면 갈래가 '측면도'인데 측면도까지 올린 사람은 드물다.
//   평면도만 있는 배는 「핀 지정」을 누르면 「측면도가 아직 없습니다」 만 떴다.
const { chromium } = require('playwright');
const http=require('http'), fs=require('fs'), path=require('path');
const FILE = process.argv[2] || 'work.html';
const server = http.createServer((rq,rs)=>{
  const f = rq.url==='/' ? (path.isAbsolute(FILE)?FILE:path.join(__dirname,FILE))
                          : path.join(__dirname, rq.url.split('?')[0]);
  fs.readFile(f,(e,d)=>{ if(e){rs.writeHead(404);rs.end();return;}
    if(f.endsWith('.woff2')) rs.setHeader('Content-Type','font/woff2');
    rs.writeHead(200); rs.end(d); });
});
let ok=0,bad=0;
const T=(n,c,w)=>{ if(c){ok++;console.log('통과: '+n);}
  else{bad++;console.log('★ 실패: '+n+(w!==undefined?' — '+JSON.stringify(w).slice(0,240):''));} };

// 1×1 파란 점 — 진짜 <img> 가 있어야 좌표를 잰다
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

(async()=>{
  await new Promise(r=>server.listen(0,r));
  const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const ctx=await br.newContext({ locale:'ko-KR',viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const pg=await ctx.newPage();
  const errs=[]; pg.on('pageerror',e=>errs.push(String(e).slice(0,140)));
  await pg.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'networkidle'});
  await pg.waitForTimeout(900);
  // ★ 앱은 alert/confirm 을 안 쓴다. 자기 창(tell/ask)을 띄운다.
  //   가로채지 않으면 그 창(#tellOv)이 화면을 덮어 뒤의 누르기가 다 막힌다.
  await pg.evaluate(()=>{ window.__al=[];
    window.alert=m=>window.__al.push(String(m).replace(/\n+/g,' / '));
    window.confirm=()=>true;
    window.tell=m=>{ window.__al.push(String(m).replace(/\n+/g,' / ')); return Promise.resolve(); };
    window.ask=m=>{ window.__al.push(String(m).replace(/\n+/g,' / ')); return Promise.resolve(true); };
    try{skipWelcome();}catch(_){} unlocked=true; openBoatSetup(); });
  await pg.waitForTimeout(400);
  await pg.evaluate(()=>{ document.getElementById('nbName').value='시험호'; createBoat(); });
  await pg.waitForTimeout(1500);

  // ── ① 도면이 한 장도 없으면 빈 화면 대신 말해 준다
  await pg.evaluate(()=>{ switchTab('boat'); setMntSub('maint'); });
  await pg.waitForTimeout(800);
  const none = await pg.evaluate(()=>{
    dgImgs = { plan:null, side:null };
    if(typeof dgSmall !== 'undefined') dgSmall = { plan:null, side:null };
    window.__al = [];
    openMR('maint', maint[0].id);
    pinStart();
    return { 말: window.__al.slice(), 잡힘: !!pinTarget }; });
  T('★ 도면이 없으면 까닭을 말해 준다', /도면을 넣어/.test((none.말||[]).join(' ')), none.말);
  T('도면이 없으면 핀 지정으로 안 들어간다', none.잡힘 === false, none);

  // ── ② 평면도만 있는 배 — 기본값이 측면도라 빈 화면이 떴다
  await pg.evaluate(p=>{ dgImgs = { plan:p, side:null };
    if(typeof dgSmall !== 'undefined') dgSmall = { plan:p, side:null };
    mrMapKind = 'side'; }, PNG);
  await pg.evaluate(()=>{ openMR('maint', maint[0].id); });
  await pg.waitForTimeout(600);
  await pg.evaluate(()=>{ window.__al=[]; pinStart(); });
  await pg.waitForTimeout(400);
  const kind = await pg.evaluate(()=>({ 갈래:mrMapKind, 잡힘:!!pinTarget,
    그림: !!document.querySelector('#mrMap img') }));
  T('★ 평면도만 있으면 평면도로 넘어간다', kind.갈래 === 'plan', kind);
  T('도면 그림이 화면에 있다', kind.그림 === true, kind);

  // ── ③ 여기가 핵심 — 1.5초 기다려도 핀 지정이 살아 있는가
  T('핀 지정을 누른 직후 잡혀 있다', kind.잡힘 === true, kind);
  await pg.waitForTimeout(1600);
  const alive = await pg.evaluate(()=>({ 잡힘:!!pinTarget,
    띠:(document.getElementById('pinBanner')||{style:{}}).style.display,
    화면:curScreen() }));
  T('★ 1.6초 뒤에도 핀 지정이 살아 있다 (저절로 취소되지 않는다)', alive.잡힘 === true, alive);
  T('★ 안내 띠도 그대로 떠 있다', alive.띠 === 'block', alive);

  // ── ④ 진짜로 손가락으로 찍어 본다
  const box = await pg.evaluate(()=>{
    const img = document.querySelector('#mrMap img');
    if(!img) return null;
    img.scrollIntoView({block:'center'});
    const r = img.getBoundingClientRect();
    return { l:r.left, t:r.top, w:r.width, h:r.height }; });
  T('도면 그림의 자리를 잴 수 있다', !!box && box.w > 20 && box.h > 20, box);
  if(box){
    await pg.mouse.click(box.l + box.w*0.4, box.t + box.h*0.6);
    await pg.waitForTimeout(900);
    const pin = await pg.evaluate(()=>maint[0].pin || null);
    T('★ 도면을 누르면 핀이 박힌다', !!pin, pin);
    if(pin){
      T('핀이 누른 자리에 가깝다 (가로 40% 근처)', Math.abs(pin.x-40) <= 6, pin);
      T('핀이 누른 자리에 가깝다 (세로 60% 근처)', Math.abs(pin.y-60) <= 6, pin);
      T('핀이 지금 보던 도면(평면도)에 붙는다', pin.map === 'plan', pin);
    }
    const after = await pg.evaluate(()=>({ 잡힘:!!pinTarget,
      띠:(document.getElementById('pinBanner')||{style:{}}).style.display }));
    T('찍고 나면 핀 지정이 끝난다', after.잡힘 === false, after);
    T('찍고 나면 안내 띠도 접힌다', after.띠 === 'none', after);
  }

  // ── ⑤ 다른 탭으로 가면 취소된다 (원래 뜻은 지킨다)
  await pg.evaluate(()=>{ openMR('maint', maint[0].id); pinStart(); });
  await pg.waitForTimeout(500);
  const before = await pg.evaluate(()=>!!pinTarget);
  await pg.evaluate(()=>{ switchTab('voyage'); });
  await pg.waitForTimeout(700);
  const gone = await pg.evaluate(()=>({ 잡힘:!!pinTarget,
    띠:(document.getElementById('pinBanner')||{style:{}}).style.display }));
  T('탭을 옮기기 전에는 잡혀 있었다', before === true);
  T('다른 탭으로 가면 핀 지정이 취소된다', gone.잡힘 === false, gone);
  T('그때는 안내 띠도 접힌다', gone.띠 === 'none', gone);

  // ── ⑥ ★ 진짜 원인 — 「도면 그리기」 가 켜진 채로 남아 있으면 핀이 안 찍혔다
  //    정비 화면에서 그리기를 한 번 켜면 목록으로 돌아와도 켜진 채로 남는다.
  //    화면에는 아무 표시가 없다. 그 뒤로 도면을 누르면 그 누름이 '도형 그리기' 로 가서
  //    핀이 영영 안 찍혔다. 사람 눈에는 「잘되던 것이 갑자기 안 되는」 것으로 보인다.
  await pg.evaluate(p2=>{ dgImgs={plan:p2,side:p2};
    if(typeof dgSmall!=='undefined') dgSmall={plan:p2,side:p2};
    maint.forEach(m=>{ m.pin = null; });
    closeMR(); pinCancel();
    maintView = 'list';                      // 앞 시험에서 도면 보기로 가 있다
    switchTab('boat'); setMntSub('maint'); renderMR(); }, PNG);
  await pg.waitForTimeout(800);
  // 도면 보기 → 그리기 켜기 → 목록으로
  await pg.evaluate(()=>{ mrToggleView('maint'); });
  await pg.waitForTimeout(500);
  await pg.evaluate(()=>{ if(!mrDraw) toggleMrDraw(); });
  await pg.waitForTimeout(400);
  const drawOn = await pg.evaluate(()=>mrDraw);
  T('도면 그리기를 켤 수 있다', drawOn === true, drawOn);
  await pg.evaluate(()=>{ mrToggleView('maint'); });      // 목록으로 되돌아감
  await pg.waitForTimeout(600);
  T('★ 목록으로 돌아가면 그리기가 꺼진다 (안 보이는 모드를 안 남긴다)',
    (await pg.evaluate(()=>mrDraw)) === false);

  // 일부러 다시 켜 두고 — 옛 판에서 사람이 놓인 자리를 그대로 만든다
  await pg.evaluate(()=>{ mrDraw = true; });
  // 진짜로 줄을 누르고, 진짜로 「핀 지정」 단추를 누른다
  const rows = await pg.$$('#maintList .mr');
  T('정비 목록에 줄이 있다', rows.length > 0, rows.length);
  if(rows.length){
    await rows[0].scrollIntoViewIfNeeded();
    await rows[0].click();
    await pg.waitForTimeout(800);
    const pb = await pg.evaluateHandle(()=>[...document.querySelectorAll('#mrPanel button')]
      .find(b=>/핀 지정|핀 이동/.test(b.innerText)));
    const pel = pb.asElement();
    T('「핀 지정」 단추가 있다', !!pel);
    if(pel){
      await pel.scrollIntoViewIfNeeded();
      await pel.click();
      await pg.waitForTimeout(1200);
      T('★ 핀 지정을 누르면 그리기가 꺼진다', (await pg.evaluate(()=>mrDraw)) === false);
      const r2 = await pg.evaluate(()=>{
        const i = document.querySelector('#mrMap img');
        if(!i) return null;
        i.scrollIntoView({block:'center'});
        const b = i.getBoundingClientRect();
        return { l:b.left, t:b.top, w:b.width, h:b.height }; });
      T('도면 그림이 떠 있다', !!r2 && r2.w > 20, r2);
      if(r2){
        await pg.mouse.click(r2.l + r2.w*0.4, r2.t + r2.h*0.6);
        await pg.waitForTimeout(1000);
        const got = await pg.evaluate(()=>maint.filter(x=>x.pin).map(x=>({id:x.id, pin:x.pin})));
        T('★★ 그리기를 켜 뒀어도 도면을 누르면 핀이 박힌다', got.length === 1, got);
        if(got.length) T('핀이 누른 자리에 가깝다', Math.abs(got[0].pin.x-40)<=6 && Math.abs(got[0].pin.y-60)<=6, got);
        const shp = await pg.evaluate(()=>shapes.length);
        T('핀 대신 도형이 그려지지 않았다', shp === 0, shp);
      }
    }
  }

  // ── ⑦ 반대쪽 — 핀 지정 중에 그리기를 켜면 핀 지정을 그만둔다 (둘 다 도면을 누르는 일이다)
  await pg.evaluate(()=>{ openMR('maint', maint[0].id); pinStart(); });
  await pg.waitForTimeout(600);
  const both = await pg.evaluate(()=>{
    const a = !!pinTarget;
    if(!mrDraw) toggleMrDraw();
    return { 켜기전: a, 핀: !!pinTarget, 그리기: mrDraw }; });
  T('핀 지정 중이었다', both.켜기전 === true, both);
  T('★ 그리기를 켜면 핀 지정은 그만둔다', both.핀 === false && both.그리기 === true, both);
  await pg.evaluate(()=>{ if(mrDraw) toggleMrDraw(); });

  T('앱이 터지지 않았다', errs.length===0, errs.slice(0,2));
  console.log('\n합계: '+ok+'개 통과 / '+bad+'개 실패');
  await br.close(); server.close();
  process.exit(bad?1:0);
})();
