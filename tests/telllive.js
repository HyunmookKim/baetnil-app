// 앱 안의 알림창 — 브라우저 검사
//
// ★ 소스만 보는 검사로는 「화면에 실제로 뜨는가」와 「단추에 무슨 글자가 박히는가」를 못 잡는다.
//   4.36 까지는 브라우저 창이라 단추가 CANCEL·OK 로 영어였다.
const { chromium } = require('playwright');
const fs = require('fs'), http = require('http'), path = require('path');
const SRC = process.argv[2] || 'work.html';
const srv = http.createServer((req,res)=>{
  let f = req.url.split('?')[0];
  const 뿌리 = (f === '/' || f === '/index.html');
  if(뿌리) f = '/' + SRC;
  // ★ 절대경로로 건네받은 앱 파일은 cwd 를 앞에 붙이면 안 된다.
  const p = (뿌리 && path.isAbsolute(SRC)) ? SRC : path.join(process.cwd(), f.replace(/^\//,''));
  if(!fs.existsSync(p)){ res.writeHead(404); res.end(''); return; }
  const ext = path.extname(p);
  res.writeHead(200, { 'content-type': ext==='.html'?'text/html; charset=utf-8'
    : ext==='.js'?'text/javascript' : ext==='.json'?'application/json':'application/octet-stream' });
  res.end(fs.readFileSync(p));
});
(async ()=>{
  await new Promise(r => srv.listen(0, r));
  const port = srv.address().port;
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await (await b.newContext({ locale:'ko-KR', viewport:{width:411,height:900} })).newPage();
  let pass=0, fail=0;
  const T=(n,ok)=>{ok?pass++:(fail++,console.log('★ 실패:',n));};
  const errs=[]; page.on('pageerror', e=>errs.push(String(e.message).slice(0,140)));
  // ★ 브라우저 창이 뜨면 그것 자체가 실패다. 뜨는지 지켜본다.
  const native=[]; page.on('dialog', d=>{ native.push(d.message().slice(0,60)); d.accept(); });
  await page.route('**://tile.openstreetmap.org/**', r=>r.abort());
  await page.route('**://tiles.openseamap.org/**', r=>r.abort());
  await page.addInitScript(()=>{ try{ localStorage.setItem('bt_agree','1'); }catch(e){} });
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil:'domcontentloaded' });
  await page.waitForTimeout(1500);

  // ── 0. ★★★ 4.101 — tell 의 **기본은 잠깐 알림**이다 (사장님이 정하신 것)
  //   여태 354곳이 전부 큰 창이었다. 「제원 3칸을 저장했습니다」 에도 확인을 누르게 했다.
  const 잠깐 = await page.evaluate(async ()=>{
    tell('짐을 실었습니다.');
    await new Promise(r=>setTimeout(r,60));
    const sk = document.getElementById('snack');
    const out = { 알림: !!(sk && sk.classList.contains('on')),
                  글: sk ? sk.textContent : '',
                  큰창: document.getElementById('tellOv').classList.contains('open') };
    snackHide();
    return out;
  });
  T('★★★ tell 은 기본이 잠깐 알림이다', 잠깐.알림 === true);
  T('★★★ 그때 큰 창은 안 뜬다', 잠깐.큰창 === false);
  T('★★ 잠깐 알림에도 글이 그대로 나온다', 잠깐.글.indexOf('짐을 실었습니다.') >= 0);

  // ── 1. tell({big:true}) — 단추 하나, 한국어
  const one = await page.evaluate(()=>{
    window.__r = null;
    tell('짐을 실었습니다.', { big:true }).then(v => { window.__r = v; });
    const ov = document.getElementById('tellOv');
    const bs = [...document.querySelectorAll('#tellBtns button')].map(x=>x.textContent);
    return { open: ov.classList.contains('open'),
             msg: document.getElementById('tellMsg').textContent,
             btns: bs };
  });
  T('우리 창이 뜬다', one.open === true);
  T('글이 그대로 나온다', one.msg === '짐을 실었습니다.');
  T('단추가 하나다', one.btns.length === 1);
  T('★ 단추가 OK 가 아니다', !/^ok$/i.test(String(one.btns[0]).trim()));
  T('★ 단추가 한국어다', /[가-힣]/.test(String(one.btns[0])));

  // 눌러서 닫는다
  const closed = await page.evaluate(async ()=>{
    document.querySelectorAll('#tellBtns button')[0].click();
    await new Promise(r=>setTimeout(r,30));
    return { open: document.getElementById('tellOv').classList.contains('open'), r: window.__r };
  });
  T('누르면 닫힌다', closed.open === false);
  T('누른 값이 돌아온다', closed.r === true);

  // ── 2. 줄 세우기 — 연달아 와도 하나가 다른 하나를 덮지 않는다
  const q = await page.evaluate(async ()=>{
    window.__got = [];
    tell('첫째', { big:true }).then(()=>window.__got.push(1));
    tell('둘째', { big:true }).then(()=>window.__got.push(2));
    const first = document.getElementById('tellMsg').textContent;
    document.querySelectorAll('#tellBtns button')[0].click();
    await new Promise(r=>setTimeout(r,30));
    const second = document.getElementById('tellMsg').textContent;
    const stillOpen = document.getElementById('tellOv').classList.contains('open');
    document.querySelectorAll('#tellBtns button')[0].click();
    await new Promise(r=>setTimeout(r,30));
    return { first, second, stillOpen, got: window.__got,
             end: document.getElementById('tellOv').classList.contains('open') };
  });
  T('첫째가 먼저 보인다', q.first === '첫째');
  T('★ 둘째가 묻히지 않는다', q.second === '둘째' && q.stillOpen === true);
  T('둘 다 답을 받았다', q.got.length === 2);
  T('다 보여 주면 닫힌다', q.end === false);

  // ── 3. ask — 단추 둘. 취소 쪽은 「취소」가 아니라 「닫기」
  const two = await page.evaluate(()=>{
    window.__a = null;
    ask('이 기록을 지울까요?', { ok:'지우기', warn:true }).then(v => { window.__a = v; });
    return [...document.querySelectorAll('#tellBtns button')].map(x=>({
      name:x.textContent, cls:x.className }));
  });
  T('단추가 둘이다', two.length === 2);
  T('★ 왼쪽이 「닫기」다', two[0].name === '닫기');
  T('오른쪽은 시킨 대로 「지우기」다', two[1].name === '지우기');
  T('지우는 단추는 붉게 나온다', two[1].cls === 'warn');

  const no = await page.evaluate(async ()=>{
    document.querySelectorAll('#tellBtns button')[0].click();
    await new Promise(r=>setTimeout(r,30));
    return window.__a;
  });
  T('「닫기」는 아니오다', no === false);

  const yes = await page.evaluate(async ()=>{
    window.__a = null;
    ask('지울까요?', { ok:'지우기' }).then(v => { window.__a = v; });
    await new Promise(r=>setTimeout(r,10));
    document.querySelectorAll('#tellBtns button')[1].click();
    await new Promise(r=>setTimeout(r,30));
    return window.__a;
  });
  T('오른쪽은 예다', yes === true);

  // ── 4. 뒤로 가기로 닫으면 아니오로 친다
  const back = await page.evaluate(async ()=>{
    window.__a = null;
    ask('나갈까요?').then(v => { window.__a = v; });
    await new Promise(r=>setTimeout(r,10));
    const inStack = (window.OVERLAY_STACK||[]).indexOf('tellOv') >= 0;
    navDoBack();
    await new Promise(r=>setTimeout(r,40));
    return { inStack, a: window.__a,
             open: document.getElementById('tellOv').classList.contains('open') };
  });
  T('★ 덮개 목록에 들어간다', back.inStack === true);
  T('★ 뒤로 가기가 창을 닫는다', back.open === false);
  T('뒤로 가기는 아니오다', back.a === false);

  // ── 5. 배 위에서 누를 수 있는 크기인가
  const size = await page.evaluate(async ()=>{
    tell('크기 재기', { big:true });
    const el = document.querySelector('#tellBtns button');
    const r = el.getBoundingClientRect();
    const out = { w:r.width, h:r.height };
    el.click();
    return out;
  });
  T('★ 단추 높이가 34 이상', size.h >= 34);
  T('★ 단추 너비가 38 이상', size.w >= 38);

  // ── 5-b. ★ 남이 쓴 글이 코드로 돌면 안 된다
  const raw = await page.evaluate(async ()=>{
    tell('<b>굵게</b> & <img src=x onerror="window.__hacked=1">', { big:true });
    await new Promise(r=>setTimeout(r,30));
    const box = document.getElementById('tellMsg');
    const out = { text: box.textContent, tags: box.querySelectorAll('b,img').length,
                  hacked: !!window.__hacked };
    document.querySelectorAll('#tellBtns button')[0].click();
    return out;
  });
  T('★ 글이 글자 그대로 보인다', raw.text.indexOf('<b>굵게</b>') === 0);
  T('★ 글이 코드가 되지 않았다', raw.tags === 0 && raw.hacked === false);

  // ── 6. 브라우저 창은 한 번도 안 떴어야 한다
  T('★ 브라우저 창이 안 떴다', native.length === 0);
  if(native.length) console.log('    떴다:', native.slice(0,3).join(' | '));
  T('브라우저 오류가 없다', errs.length === 0);
  if(errs.length) console.log('    ', errs.slice(0,3).join(' | '));

  console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
  await b.close(); srv.close();
  process.exit(fail ? 1 : 0);
})();
