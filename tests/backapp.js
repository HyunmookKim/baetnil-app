// 앱의 뒤로가기 단추 — 눌러도 앱이 통째로 꺼지면 안 된다.
// ★ 사고 (4.22 까지)
//   웹에서는 브라우저가 popstate 를 보내 줘서 한 걸음씩 잘 물렸다.
//   그런데 앱(캐퍼시터)의 뒤로가기 단추는 그 길로 오지 않는다.
//   안드로이드가 앱에게 직접 알려 주는데 받는 데를 안 붙여 놔서,
//   「받는 사람이 없네」 하고 화면을 통째로 닫아 버렸다.
//   웹 검사(backlive.js)로는 절대 안 잡힌다 — 앱인 척해야 잡힌다.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const FILE = process.argv[2] || 'work.html';
const server = http.createServer((rq,rs)=>{
  const f = path.join(__dirname, rq.url === '/' ? FILE : rq.url.split('?')[0]);
  fs.readFile(f,(e,d)=>{ if(e){rs.writeHead(404);rs.end();return;}
    if(f.endsWith('.woff2')) rs.setHeader('Content-Type','font/woff2');
    rs.writeHead(200); rs.end(d); });
});
let ok=0,bad=0;
const T=(n,c,w)=>{ if(c){ok++;console.log('통과: '+n);} else {bad++;console.log('★ 실패: '+n+(w!==undefined?' — '+JSON.stringify(w).slice(0,220):''));} };

(async ()=>{
  await new Promise(r=>server.listen(0,r));
  const url = 'http://127.0.0.1:'+server.address().port+'/';
  const br = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await br.newContext({ locale:'ko-KR', viewport:{width:390,height:840}, isMobile:true, hasTouch:true });

  // 앱인 척한다 — 화면이 뜨기 전에 가짜 다리를 심는다 (캐퍼시터가 하는 것과 같다)
  await ctx.addInitScript(()=>{
    window.__BACK = [];      // 뒤로가기에 붙은 손
    window.__EXIT = 0;       // 앱을 닫으라고 부른 횟수
    window.Capacitor = {
      isNativePlatform: ()=>true,
      Plugins: { App: {
        addListener: (name, fn)=>{ if(name==='backButton') window.__BACK.push(fn);
                                   return Promise.resolve({ remove(){} }); },
        exitApp: ()=>{ window.__EXIT++; return Promise.resolve(); }
      } }
    };
  });
  const pg = await ctx.newPage();
  const errs=[]; pg.on('pageerror', e=>errs.push(String(e)));
  pg.on('dialog', d=>d.accept());
  await pg.goto(url, { waitUntil:'networkidle' });
  await pg.waitForTimeout(1600);
  await pg.evaluate(()=>{ try{ skipWelcome(); }catch(_){} });

  T('★ 앱이면 뒤로가기 단추에 손을 붙인다',
    await pg.evaluate(()=>window.__BACK.length > 0),
    await pg.evaluate(()=>window.__BACK.length));

  const back = () => pg.evaluate(async ()=>{
    window.__BACK.forEach(f=>f({ canGoBack:false }));
    await new Promise(r=>setTimeout(r,250));
    return { tab: curTab, screens: (window.SCREEN_STACK||[]).length,
             over: (typeof OVERLAY_STACK !== 'undefined' ? OVERLAY_STACK.length : -1),
             exit: window.__EXIT };
  });

  // ── ① 탭을 옮겨 놓고 뒤로가기 → 오늘로 돌아온다. 안 꺼진다.
  await pg.evaluate(()=>{ switchTab('community'); window.__EXIT = 0; });
  await pg.waitForTimeout(400);
  let r = await back();
  T('탭을 옮긴 뒤 뒤로가기 → 오늘로 돌아온다', r.tab === 'home', r);
  T('★ 그때 앱이 안 꺼진다', r.exit === 0, r);

  // ── ② 떠 있는 화면이 있으면 그것부터 닫는다
  const before = await pg.evaluate(async ()=>{
    switchTab('home');
    try{ openAccount(); }catch(_){}
    await new Promise(r=>setTimeout(r,300));
    return { screens: (window.SCREEN_STACK||[]).length };
  });
  T('떠 있는 화면을 하나 열었다', before.screens > 0, before);
  r = await back();
  T('떠 있는 화면부터 닫는다', r.screens < before.screens, { before, r });
  T('그때도 앱이 안 꺼진다', r.exit === 0, r);

  // ── ③ 오늘 화면에서 아무것도 없을 때 — 한 번에 안 꺼진다
  await pg.evaluate(()=>{ switchTab('home'); window.__EXIT = 0; navExitAt = 0; });
  await pg.waitForTimeout(300);
  r = await back();
  T('★ 뿌리에서 한 번 눌러도 안 꺼진다', r.exit === 0, r);
  const said = await pg.evaluate(()=>{
    const d = document.getElementById('errbar');
    return d ? (d.innerText || '') : '';
  });
  T('한 번 더 누르라고 알려 준다', /한 번 더/.test(said), said.slice(0,60));

  r = await back();
  T('★ 두 번 누르면 닫는다', r.exit === 1, r);

  // ── ④ 한참 뒤에 누르면 다시 한 번은 봐준다 (주머니 속에서 훅 꺼지지 않게)
  await pg.evaluate(()=>{ window.__EXIT = 0; navExitAt = Date.now() - 5000; });
  r = await back();
  T('한참 뒤에 누르면 다시 한 번은 봐준다', r.exit === 0, r);

  // ── ⑤ 판단하는 문이 하나인가 — 브라우저 뒤로가기도 같은 것을 쓴다
  const same = await pg.evaluate(async ()=>{
    switchTab('community');
    await new Promise(r=>setTimeout(r,250));
    const kind = navBackKind();
    history.pushState({}, '');
    history.back();                        // 브라우저 쪽 길
    await new Promise(r=>setTimeout(r,350));
    return { kind, tab: curTab };
  });
  T('브라우저 뒤로가기도 같은 문을 쓴다', same.kind === 'tab' && same.tab === 'home', same);

  // ── ⑥ 웹에서는 손을 안 붙인다 (브라우저가 알아서 한다)
  {
    const c2 = await br.newContext({ locale:'ko-KR', viewport:{width:390,height:840} });
    const p2 = await c2.newPage();
    await p2.goto(url, { waitUntil:'networkidle' });
    await p2.waitForTimeout(1200);
    T('웹에서는 앱 단추에 손을 안 붙인다',
      await p2.evaluate(()=> typeof window.Capacitor === 'undefined'
                             && navAttachNative() === false));
    await c2.close();
  }

  T('페이지 오류가 없다', errs.length === 0, errs.slice(0,3));

  console.log(`\n합계: ${ok}개 통과 / ${bad}개 실패`);
  await br.close(); server.close();
  process.exit(bad?1:0);
})();
