// 4.90 — 사진 자리 (진짜 화면에서)
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

  // ── 폰 자리를 재는 것이 도는가 ───────────────────────────────────────
  const 잰것 = await pg.evaluate(()=>storeUse());
  T('★★ 폰 자리를 잴 수 있다', typeof 잰것.quota === 'number' && 잰것.quota > 0, 잰것);
  const 한도 = await pg.evaluate(()=>photoKeepN());
  T('★★★ 한도가 폰 여유를 보고 정해진다 (400장 이상)', 한도 >= 400, 한도);
  T('★★ 아무리 넉넉해도 4000장을 안 넘는다', 한도 <= 4000, 한도);

  // ── 지워지지 않게 표시하는 것이 터지지 않는가 ────────────────────────
  const p = await pg.evaluate(()=>askPersist());
  T('★★ persist() 가 터지지 않는다 (승인/거절 둘 다 정상)',
    p === true || p === false || p === null, p);

  // ── ★ 덜 중요한 것부터 버린다 (진짜 저장분에 넣고 확인) ──────────────
  const 결과 = await pg.evaluate(async ()=>{
    const U = k => 'http://127.0.0.1:1/'+k+'.jpg';
    // 기록을 만든다 — 도면 · 장비 · 적재표 · 항해
    dgImgs.plan = U('도면');
    maint.push({ id:901, typ:'gear', photos:[U('장비')] });
    items.push({ id:902, photos:[U('적재표')], lockerId:(lockers[0]||{}).id, qty:1, name:'x' });
    voyage.push({ id:903, photos:[U('항해')] });
    // 저장분에 네 장을 넣는다 + 이제 기록에 없는 사진 한 장도 넣는다
    const c = await caches.open(PHOTO_CACHE);
    for(const k of ['도면','장비','적재표','항해','지운것'])
      await c.put(U(k), new Response('x'));
    const 전 = (await c.keys()).map(r=>decodeURIComponent(r.url).split('/').pop());
    // 두 장만 남기게 한도를 좁힌다
    const 원래 = photoKeepN;
    window.photoKeepN = async () => 2;
    await trimBoatPhotos();
    window.photoKeepN = 원래;
    const 후 = (await c.keys()).map(r=>decodeURIComponent(r.url).split('/').pop());
    return { 전, 후 };
  });
  console.log('  넣은 것: ' + 결과.전.join(', '));
  console.log('  남은 것: ' + 결과.후.join(', '));
  T('★★★ 기록에 없는 사진은 버린다', !결과.후.some(x=>x.includes('지운것')), 결과.후);
  T('★★★ 도면은 남는다 (제일 중요)', 결과.후.some(x=>x.includes('도면')), 결과.후);
  T('★★★ 장비는 남는다', 결과.후.some(x=>x.includes('장비')), 결과.후);
  T('★★★ 항해일지가 먼저 버려진다', !결과.후.some(x=>x.includes('항해')), 결과.후);
  T('★★★ 적재표도 한도 밖이면 버려진다 (항해보다는 뒤에 버려짐)',
    !결과.후.some(x=>x.includes('적재표')), 결과.후);

  // ── 남의 사진 자리는 안 건드린다 ─────────────────────────────────────
  const 남 = await pg.evaluate(async ()=>{
    const c = await caches.open(SEEN_CACHE);
    await c.put('http://127.0.0.1:1/남의사진.jpg', new Response('x'));
    await trimBoatPhotos();
    return (await c.keys()).length;
  });
  T('★★ 내 배 정리가 남의 사진 자리를 안 건드린다', 남 === 1, 남);

  // ── 설정 화면에 줄이 뜨는가 ──────────────────────────────────────────
  await pg.evaluate(()=>openSettings()); await pg.waitForTimeout(700);
  const 줄 = await pg.evaluate(()=>{
    const e=document.getElementById('photoRow');
    return e ? e.textContent.replace(/\s+/g,' ').trim() : null; });
  T('★★★ 설정에 「이 기기에 저장한 사진」 줄이 있다', !!줄 && /이 기기에 저장한 사진/.test(줄), 줄);
  T('★★★ 몇 장인지 숫자가 나온다', !!줄 && /\d+장/.test(줄), 줄);
  T('★★ 「세는 중」 에서 안 멈춘다', !!줄 && !/세는 중/.test(줄), 줄);

  // ── 영어로 바꿔도 한국어가 안 남는가 ─────────────────────────────────
  await pg.evaluate(()=>{ try{ setLang('en'); }catch(_){} }); await pg.waitForTimeout(500);
  await pg.evaluate(()=>openSettings()); await pg.waitForTimeout(700);
  const 영 = await pg.evaluate(()=>{
    const e=document.getElementById('photoRow'); return e?e.textContent.trim():''; });
  T('★★★ 영어로 옮겨진다', !!영 && !/[가-힣]/.test(영), 영);
  await pg.evaluate(()=>{ try{ setLang('ko'); }catch(_){} }); await pg.waitForTimeout(400);

  T('★ 화면 오류가 없다', errs.length === 0, errs);
  console.log('\n통과 '+ok+' · 실패 '+bad);
  await br.close(); server.close(); process.exit(bad?1:0);
})();
