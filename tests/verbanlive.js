// 4.93 · 4.107 — 「옛 앱 파일이 남아 있습니다」 띠가 안 없어지던 것
//
// ★ 사장님이 **두 번** 겪으셨다.
//   4.93  — 「새로 받기 눌렀는데도 계속 반복해서 뜬다」
//           까닭: 저장분이 여럿일 수 있는데 맨 먼저 만들어진 것 하나만 보고 있었다.
//   4.107 — 「이미 106버전인데도 또 계속 새로받기 버튼 뜨는 웹 오류 생겼다.
//            이거 이전에도 이랬는데 왜 또 동일한 오류를 만드냐?」
//
// ★★ 4.107 에서 이 검사의 ③번을 **뒤집었다.** 여기 적혀 있던 「옛 판만 있으면 띠가 뜬다」 가
//   바로 사장님이 겪으신 그 흠이었다. 담긴 것이 옛것이라는 말은
//   **「서비스워커가 아직 새 파일을 못 받았다」** 는 뜻이지 「옛 앱이 돈다」 가 아니다.
//   화면에 도는 코드는 이미 새것이므로(APP_VER 이 새것이다) 눌러도 바뀔 것이 없고,
//   그래서 띠가 영영 안 사라졌다. 「새로 받기」 를 누른 직후가 정확히 그 상태다 —
//   저장분을 다 지우고 다시 켜면 새로 담기까지 몇 초 걸린다.
//   ★ 참인 것만 말한다: 담긴 것이 **지금 도는 것보다 새것일 때만** 옛 화면이다.
const { chromium } = require('playwright');
const http=require('http'), fs=require('fs'), path=require('path');
const FILE = process.argv[2] || 'work.html';
const server = http.createServer((rq,rs)=>{
  const f = ((rq.url === '/' && path.isAbsolute(FILE)) ? FILE : path.join(__dirname, rq.url === '/' ? FILE : rq.url.split('?')[0]));
  fs.readFile(f,(e,d)=>{ if(e){rs.writeHead(404);rs.end();return;} rs.writeHead(200); rs.end(d); });
});
let ok=0,bad=0;
const T=(n,c,w)=>{ if(c){ok++;console.log('통과: '+n);}
  else{bad++;console.log('★ 실패: '+n+(w!==undefined?' — '+JSON.stringify(w).slice(0,220):''));} };

(async()=>{
  await new Promise(r=>server.listen(0,r));
  const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await (await br.newContext({ locale:'ko-KR',viewport:{width:390,height:844},isMobile:true,hasTouch:true})).newPage();
  const errs=[]; pg.on('pageerror',e=>errs.push(String(e).slice(0,140)));
  await pg.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'networkidle'});
  await pg.waitForTimeout(900);
  await pg.evaluate(()=>{ window.tell=()=>Promise.resolve(); window.ask=()=>Promise.resolve(true);
    try{skipWelcome();}catch(_){} });
  await pg.waitForTimeout(300);
  const APP_VER = await pg.evaluate(()=>APP_VER);
  console.log('  지금 판: ' + APP_VER);

  const 띠 = () => pg.evaluate(()=>{
    const d = document.getElementById('verbar');
    return d ? d.textContent.replace(/\s+/g,' ').trim() : null; });
  const 줄 = () => pg.evaluate(()=>{
    const e = document.getElementById('dVer');
    return e ? { 글: e.textContent.trim(), 경고: e.classList.contains('warn') } : null; });
  const 저장분 = () => pg.evaluate(()=>caches.keys());

  // ══ ① 지금 판이 담겨 있으면 아무 말도 안 한다 ═══════════════════════
  await pg.evaluate(async ()=>{
    for(const k of await caches.keys()) await caches.delete(k);
    await caches.open('baetnil-' + APP_VER);
    paintVer();
  });
  await pg.waitForTimeout(500);
  T('★★★ 지금 판이 담겨 있으면 띠가 안 뜬다', (await 띠()) === null, await 띠());
  T('★★ 서랍 줄에도 경고가 없다', (await 줄()).경고 === false, await 줄());

  // ══ ② ★ 사장님이 겪으신 것 — 옛것과 새것이 함께 있을 때 ═══════════
  await pg.evaluate(async ()=>{
    for(const k of await caches.keys()) await caches.delete(k);
    await caches.open('baetnil-4.90');          // 옛것이 먼저 만들어졌다
    await caches.open('baetnil-' + APP_VER);    // 새것도 있다
    paintVer();
  });
  await pg.waitForTimeout(600);
  T('★★★ 옛것이 함께 있어도 띠가 안 뜬다 (지금 판이 담겨 있으니까)',
    (await 띠()) === null, await 띠());
  T('★★★ 서랍 줄이 「새로고침 필요」라고 안 한다',
    !/새로고침 필요/.test((await 줄()).글), await 줄());
  const 남은것 = (await 저장분()).filter(k=>/^baetnil-\d/.test(k));
  T('★★★ 옛 껍데기를 조용히 치운다', 남은것.length === 1 && 남은것[0].includes(APP_VER), 남은것);

  // ══ ③ ★★ 옛 판만 담겨 있다 — 말하지 않는다 (4.107 에서 뒤집은 자리) ═════
  //   서비스워커가 아직 새 파일을 못 받았을 뿐이다. 도는 코드는 이미 새것이다.
  await pg.evaluate(async ()=>{
    for(const k of await caches.keys()) await caches.delete(k);
    await caches.open('baetnil-4.90');
    paintVer();
  });
  await pg.waitForTimeout(600);
  T('★★★ 옛 판만 담겨 있으면 띠가 **안** 뜬다 (사장님이 두 번 겪으신 자리)',
    (await 띠()) === null, await 띠());
  T('★★★ 서랍 줄도 「새로고침 필요」라고 **안** 한다',
    !/새로고침 필요/.test((await 줄()).글), await 줄());
  // ★ 그리고 옛 저장분을 지우지 않는다 — 지우면 인터넷 없는 바다에서 앱이 아예 안 열린다.
  T('★★★ 지금 판이 안 담겼는데 옛 저장분을 지우지 않는다',
    (await 저장분()).includes('baetnil-4.90'), await 저장분());

  // ══ ③' 저장분이 아예 없다 — 「새로 받기」 누른 직후의 그 순간 ═══════════
  await pg.evaluate(async ()=>{
    for(const k of await caches.keys()) await caches.delete(k);
    paintVer();
  });
  await pg.waitForTimeout(600);
  T('★★★ 저장분이 하나도 없으면 띠가 안 뜬다 (무한 되풀이의 시작점)',
    (await 띠()) === null, await 띠());

  // ══ ③'' 담긴 것이 지금 도는 것보다 **새것**이다 — 그때는 말한다 ════════
  //   이것이 띠의 본래 몫이다: 서비스워커는 새 판을 담았는데 화면은 옛 것이 돌고 있다.
  await pg.evaluate(async ()=>{
    for(const k of await caches.keys()) await caches.delete(k);
    await caches.open('baetnil-99.0');
    paintVer();
  });
  await pg.waitForTimeout(600);
  T('★★★ 담긴 것이 더 새것이면 그때는 띠가 뜬다', /99\.0/.test((await 띠()) || ''), await 띠());
  T('★★ 서랍 줄도 「새로고침 필요」라고 한다',
    /새로고침 필요/.test((await 줄()).글), await 줄());
  // ★ 4.106 까지 {old}/{now} 가 뒤집혀 「지금 (새 파일) 이 돌고 있습니다」 로 나왔다.
  T('★★★ 띠가 「지금 도는 판」을 바르게 말한다',
    new RegExp('지금 ' + APP_VER.replace('.', '\\.')).test((await 띠()) || ''), await 띠());

  // ══ ④ 사진·지도 저장분을 앱 파일로 착각하지 않는다 ═══════════════
  await pg.evaluate(async ()=>{
    for(const k of await caches.keys()) await caches.delete(k);
    await caches.open('baetnil-photos'); await caches.open('baetnil-tiles');
    await caches.open('baetnil-' + APP_VER);
    paintVer();
  });
  await pg.waitForTimeout(600);
  T('★★★ 사진·지도 저장분은 앱 파일로 안 센다', (await 띠()) === null, await 띠());
  const 사진남았나 = (await 저장분());
  T('★★★ 옛것 치우면서 사진·지도를 안 지운다',
    사진남았나.includes('baetnil-photos') && 사진남았나.includes('baetnil-tiles'), 사진남았나);

  // ══ ⑤ 새로 받기가 주소에 표를 붙여 확실히 새로 받게 한다 ══════════
  const 새로 = await pg.evaluate(()=>String(forceReload));
  T('★★★ 새로 받기가 주소에 표를 붙인다', /searchParams\.set\('nv'/.test(새로));
  T('★★ 사진·지도는 지우지 않는다',
    /baetnil-tiles/.test(새로) && /baetnil-photos/.test(새로));

  T('★ 화면 오류가 없다', errs.length === 0, errs);
  console.log('\n통과 '+ok+' · 실패 '+bad);
  await br.close(); server.close(); process.exit(bad?1:0);
})();
