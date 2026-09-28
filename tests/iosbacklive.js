// 아이폰: 왼쪽 끝에서 쓸어 뒤로 가기 (5.19)
// ★ 사고 (5.18 까지) — 사장님 지적 「항해일지 옆으로 쓸면 뒤로가기 되야하는데 안된다」
//   아이폰 앱에는 쓸어 뒤로 가기가 아예 없었다. 안드로이드는 폰이 「뒤로」 를 보내 주지만
//   아이폰은 앱이 스스로 쓸기를 받아야 한다. MainViewController.swift 가 쓸기를 받고,
//   무엇을 물릴지는 window.__iosBack 이 안드로이드와 같은 문(navDoBack)으로 정한다.
// ★ 여기서는 웹 쪽 문을 아이폰인 척하고 두드려 본다. 손가락으로 미는 그림은 폰에서만 볼 수 있다.
// ★ 같이 고친 것 — 아이폰 백업 파일이 파일 앱 어디에도 안 보였다 (Info.plist 두 줄이 없었다).
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const FILE = path.resolve(process.argv[2] || 'work.html');
const ROOT = path.dirname(FILE);
const server = http.createServer((rq,rs)=>{
  const u = rq.url.split('?')[0];
  const f = u === '/' ? FILE : path.join(ROOT, u);
  fs.readFile(f,(e,d)=>{ if(e){rs.writeHead(404);rs.end();return;}
    if(f.endsWith('.woff2')) rs.setHeader('Content-Type','font/woff2');
    if(f.endsWith('.js')) rs.setHeader('Content-Type','text/javascript');
    rs.writeHead(200); rs.end(d); });
});
let ok=0,bad=0;
const T=(n,c,w)=>{ if(c){ok++;console.log('통과: '+n);} else {bad++;console.log('★ 실패: '+n+(w!==undefined?' — '+JSON.stringify(w).slice(0,260):''));} };

// 아이폰 쪽 파일도 본다 — 쓸기를 받는 곳과 파일 앱 공개
const IOS = path.resolve(__dirname, '../ios/App/App');
const swift = fs.existsSync(path.join(IOS,'MainViewController.swift')) ? fs.readFileSync(path.join(IOS,'MainViewController.swift'),'utf8') : '';
const plist = fs.existsSync(path.join(IOS,'Info.plist')) ? fs.readFileSync(path.join(IOS,'Info.plist'),'utf8') : '';

async function open(br, platform){
  const ctx = await br.newContext({ locale:'ko-KR', viewport:{width:390,height:844}, isMobile:true, hasTouch:true,
    userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148' });
  await ctx.route(/googleapis|gstatic|firebaseio|firestore|open-meteo|kakao|naver/, r=>r.abort());
  await ctx.addInitScript((platform)=>{
    try{ localStorage.setItem('bt_setup','done'); localStorage.setItem('bt_welcome','done'); }catch(_){}
    window.__BACK = []; window.__EXIT = 0; window.__FS = [];
    window.Capacitor = {
      isNativePlatform: ()=>true,
      getPlatform: ()=>platform,
      Plugins: {
        App: { addListener:(n,fn)=>{ if(n==='backButton') window.__BACK.push(fn); return Promise.resolve({remove(){}}); },
               exitApp:()=>{ window.__EXIT++; return Promise.resolve(); } },
        Filesystem: { writeFile:(o)=>{ window.__FS.push(o); return Promise.resolve({ uri:'file:///x/'+o.path }); },
                      getUri:(o)=>Promise.resolve({ uri:'file:///x/'+o.path }) }
      }
    };
  }, platform);
  const pg = await ctx.newPage();
  const errs=[]; pg.on('pageerror', e=>errs.push(String(e)));
  pg.on('dialog', d=>d.accept());
  await pg.goto('http://127.0.0.1:'+server.address().port+'/', { waitUntil:'domcontentloaded' });
  await pg.waitForTimeout(2200);
  await pg.evaluate(()=>{ try{ skipWelcome(); }catch(_){} });
  return { ctx, pg, errs };
}

(async ()=>{
  await new Promise(r=>server.listen(0,r));
  const br = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

  // ── 아이폰 쪽 파일
  T('★ 아이폰 화면틀이 왼쪽 끝 쓸기를 받는다 (UIScreenEdgePanGestureRecognizer, 왼쪽)',
    /UIScreenEdgePanGestureRecognizer/.test(swift) && /edges\s*=\s*\.left/.test(swift));
  T('★ 쓸기는 웹 쪽 문(window.__iosBack)에 묻고 그 문으로 물린다',
    /__iosBack\.can\(\)/.test(swift) && /__iosBack\.go\(\)/.test(swift));
  T('★ 물릴 것이 없으면 쓸기가 시작되지 않는다 (gestureRecognizerShouldBegin 이 웹 대답을 본다)',
    /gestureRecognizerShouldBegin[\s\S]{0,120}canBack/.test(swift));
  T('★ 캐퍼시터 부품 등록(BaetnilTrack)은 그대로다', /registerPluginInstance\(BaetnilTrack\(\)\)/.test(swift));
  T('★ 파일 앱에 앱 폴더가 보인다 (UIFileSharingEnabled · LSSupportsOpeningDocumentsInPlace)',
    /<key>UIFileSharingEnabled<\/key>\s*<true\/>/.test(plist) && /<key>LSSupportsOpeningDocumentsInPlace<\/key>\s*<true\/>/.test(plist));

  // ── 아이폰인 척
  const I = await open(br, 'ios');
  const pg = I.pg;
  const st = () => pg.evaluate(()=>({ tab:curTab, sub:(typeof boatSubTab!=='undefined'?boatSubTab:''),
    screens:(window.SCREEN_STACK||[]).slice(), over:(window.OVERLAY_STACK||[]).slice(), kind:navBackKind(),
    can:window.__iosBack && window.__iosBack.can() }));

  T('★ 웹 쪽 문이 있다 (window.__iosBack)', await pg.evaluate(()=>!!(window.__iosBack && window.__iosBack.can && window.__iosBack.go)));
  let s = await st();
  T('★ 오늘 첫 자리에서는 물릴 것이 없다 → 쓸기가 안 시작된다', s.tab==='home' && s.can && s.can.ok===false, s);
  T('★ 바탕색을 알려 준다 (밀린 화면 뒤에 같은 색을 깐다)', s.can && /rgb/.test(s.can.bg||''), s.can);
  T('★ 물릴 것이 없을 때 go() 는 아무것도 안 하고 false', await pg.evaluate(()=>window.__iosBack.go()===false && curTab==='home' && window.__EXIT===0));

  // 항해일지 — 사장님이 짚으신 자리
  await pg.evaluate(()=>{
    boats=[{id:'B1',name:'SUN',type:'sail'}]; currentBoatId='B1';
    voyage=[{id:'v1',title:'여수→거문도',date:'2026-09-01',from:'여수',to:'거문도'}];
    boatSubTab='stow'; switchTab('boat');
  });
  await pg.waitForTimeout(300);
  await pg.evaluate(()=>setBoatSubTab('voyage'));
  await pg.waitForTimeout(300);
  s = await st();
  T('항해일지 목록에서는 물릴 것이 있다', s.sub==='voyage' && s.can.ok===true, s);
  await pg.evaluate(()=>openMR('voyage','v1'));
  await pg.waitForTimeout(400);
  s = await st();
  T('항해일지 기록 하나를 열었다', s.screens.indexOf('mrPanel')>=0 && s.can.ok===true, s);

  let r = await pg.evaluate(async()=>{ const g = window.__iosBack.go(); await new Promise(r=>setTimeout(r,350)); return g; });
  s = await st();
  T('★ 쓸기 ① — 기록 → 항해일지 목록', r===true && s.screens.length===0 && s.tab==='boat' && s.sub==='voyage', {r,s});
  r = await pg.evaluate(async()=>{ const g = window.__iosBack.go(); await new Promise(r=>setTimeout(r,350)); return g; });
  s = await st();
  T('★ 쓸기 ② — 항해일지 목록 → 적재표', r===true && s.tab==='boat' && s.sub==='stow', {r,s});
  r = await pg.evaluate(async()=>{ const g = window.__iosBack.go(); await new Promise(r=>setTimeout(r,350)); return g; });
  s = await st();
  T('★ 쓸기 ③ — 적재표 → 오늘', r===true && s.tab==='home', {r,s});
  s = await st();
  T('★ 오늘 첫 자리로 오면 쓸기가 다시 안 시작된다 (앱이 닫히지 않는다)',
    s.can.ok===false && await pg.evaluate(()=>window.__iosBack.go()===false && window.__EXIT===0), s);

  // 덮개(알림 창)도 쓸어서 걷힌다 — 안드로이드 뒤로가기와 같다
  await pg.evaluate(()=>{ tell('검사용 알림', { big:true }); });
  await pg.waitForTimeout(300);
  s = await st();
  T('알림 창이 떠 있으면 물릴 것이 있다', s.over.indexOf('tellOv')>=0 && s.can.ok===true, s);
  r = await pg.evaluate(async()=>{ const g = window.__iosBack.go(); await new Promise(r=>setTimeout(r,350)); return g; });
  s = await st();
  T('★ 쓸기로 알림 창이 걷힌다', r===true && s.over.indexOf('tellOv')<0, {r,s});

  // 입력칸에 글자를 넣던 중이면 자판을 내리고 물린다
  await pg.evaluate(()=>{ switchTab('boat'); setBoatSubTab('voyage'); openMR('voyage','v1'); });
  await pg.waitForTimeout(400);
  const blur = await pg.evaluate(async()=>{
    const i = document.createElement('input'); i.id='__kb'; document.body.appendChild(i); i.focus();
    const was = document.activeElement === i;
    window.__iosBack.go(); await new Promise(r=>setTimeout(r,300));
    const now = document.activeElement !== i; i.remove(); return was && now;
  });
  T('쓸면 입력칸에서 손을 뗀다 (자판이 내려간다)', blur);

  // 도면에 그리는 중에는 쓸기를 끈다
  const draw = await pg.evaluate(()=>{
    const a = [];
    if(typeof lkEdit !== 'undefined'){ const o = lkEdit; lkEdit = true; a.push(window.__iosBack.can().ok===false); lkEdit = o; }
    if(typeof mrDraw !== 'undefined'){ const o = mrDraw; mrDraw = true; a.push(window.__iosBack.can().ok===false && window.__iosBack.go()===false); mrDraw = o; }
    return a;
  });
  T('★ 도면에 그리는 중에는 쓸기를 끈다 (왼쪽 끝에서 선을 긋다가 뒤로 가지 않게)', draw.length===2 && draw.every(Boolean), draw);

  // 백업 파일 자리 — 아이폰은 파일 앱 › 나의 iPhone › 뱃일
  const sv = await pg.evaluate(async()=>{
    window.__FS.length = 0;
    const r = await saveHere('backup', 'baetnil-test.json', 'application/json', '{}');
    let msg = '';
    const old = window.tell; window.tell = (m)=>{ msg = String(m); return Promise.resolve(true); };
    try{ saveHereTell(r, 'baetnil-test.json'); } finally { window.tell = old; }
    return { r, msg, fs: window.__FS.map(o=>({ path:o.path, directory:o.directory })) };
  });
  T('★ 아이폰 백업은 앱 문서 폴더에 쓴다', sv.fs.length===1 && sv.fs[0].directory==='DOCUMENTS' && sv.fs[0].path==='Baetnil/backup/baetnil-test.json', sv);
  T('★ 아이폰 백업 자리를 파일 앱에서 찾는 길로 알려 준다',
    sv.r.where==='파일 앱 › 나의 iPhone › 뱃일 › Baetnil › backup' && !sv.r.why, sv.r);
  T('★ 알림 말에 파일 이름까지 같은 꺾쇠로 이어진다',
    sv.msg.indexOf('파일 앱 › 나의 iPhone › 뱃일 › Baetnil › backup › baetnil-test.json') >= 0, sv.msg);
  T('아이폰에서도 오류가 없다', I.errs.length===0, I.errs.slice(0,3));
  await I.ctx.close();

  // ── 안드로이드는 그대로
  const A = await open(br, 'android');
  const sa = await A.pg.evaluate(async()=>{
    const r = await saveHere('backup', 'baetnil-test.json', 'application/json', '{}');
    return { r, back: window.__BACK.length };
  });
  T('★ 안드로이드 백업 자리 말은 그대로 (문서/Baetnil/backup)', sa.r.where==='문서/Baetnil/backup', sa.r);
  T('★ 안드로이드 뒤로가기 단추는 그대로 붙는다', sa.back > 0, sa);
  T('안드로이드에서도 오류가 없다', A.errs.length===0, A.errs.slice(0,3));
  await A.ctx.close();

  await br.close(); server.close();
  console.log(`\n통과 ${ok} · 실패 ${bad}`);
  process.exit(bad ? 1 : 0);
})().catch(e=>{ console.log('★ 실패: 검사가 멈춤 — '+e); process.exit(1); });
