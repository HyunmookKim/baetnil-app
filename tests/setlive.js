// 설정 화면 — 브라우저 검사
//
// ★ 소스만 보는 검사는 「글자가 적혀 있나」까지만 안다.
//   화면에 정말 뜨는가, 묶음이 갈라져 보이는가, 눌러서 일이 벌어지는가는
//   실제로 그려 봐야 안다. 4.41 에서 네 줄이 서랍에서 여기로 옮겨 왔다.
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
  const T=(n,ok,x)=>{ ok?pass++:(fail++,console.log('★ 실패:',n, x===undefined?'':JSON.stringify(x))); };
  const native=[]; page.on('dialog', d=>{ native.push(d.message().slice(0,60)); d.accept(); });
  await page.route('**://tile.openstreetmap.org/**', r=>r.abort());
  await page.route('**://tiles.openseamap.org/**', r=>r.abort());
  await page.addInitScript(()=>{ try{ localStorage.setItem('bt_agree','1'); }catch(e){} });
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil:'domcontentloaded' });
  await page.waitForTimeout(1500);

  // ── 설정을 연다
  const 화면 = await page.evaluate(()=>{
    openSettings();
    const P = document.getElementById('mrPanel');
    const 줄 = [...P.querySelectorAll('.setrow')].map(x=>({
      제목: (x.querySelector('.mrv')||{}).textContent || '',
      설명: (x.querySelector('.mrm')||{}).textContent || '',
      화살표: /›|›/.test(x.textContent),
      누르면: x.getAttribute('onclick') || ''
    }));
    const 이름표 = [...P.querySelectorAll('.notilbl')].map(x=>x.textContent);
    return { 줄, 이름표, 글: P.textContent };
  });
  const 제목들 = 화면.줄.map(x=>x.제목);
  T('설정이 그려진다', 화면.줄.length > 0, 제목들);
  // ★ 5.0 — 「클라우드에서 받아오기」 → 「클라우드에서 가져오기」 로 말이 바뀌었다.
  const 네줄 = ['클라우드에 올리기','클라우드에서 가져오기','파일로 저장','파일에서 불러오기'];
  for(const n of 네줄)
    T('화면에 「' + n + '」 이 있다', 제목들.indexOf(n) >= 0, 제목들);
  T('★ 옛말 「클라우드에서 받아오기」 는 안 남아 있다', 화면.글.indexOf('받아오기') < 0, 제목들);
  T('★ 클라우드와 파일이 이름표로 갈려 있다',
    화면.이름표.indexOf('클라우드') >= 0 && 화면.이름표.indexOf('파일') >= 0, 화면.이름표);
  T('★ 사람에게 보이는 곳에 「백업」이 없다', 화면.글.indexOf('백업') < 0);
  T('네 줄에 무엇을 하는지 한 줄 설명이 붙어 있다',
    네줄.every(n => (화면.줄.find(x=>x.제목===n)||{}).설명));
  // ★ 설명이 그냥 붙어 있기만 하면 안 된다 — 무엇을 하는 줄인지 제대로 말해야 한다.
  const 설명 = n => (화면.줄.find(x=>x.제목===n)||{}).설명 || '';
  T('★ 올리기 설명은 「이 기기 → 클라우드」 라고 말한다',
    설명('클라우드에 올리기') === '이 기기의 기록을 클라우드로 보냅니다', 설명('클라우드에 올리기'));
  T('★ 가져오기 설명은 「클라우드 → 이 기기」 라고 말한다',
    설명('클라우드에서 가져오기') === '클라우드 기록을 이 기기로 가져옵니다', 설명('클라우드에서 가져오기'));
  T('★ 파일로 저장 설명에 어디에 넣는지가 적혀 있다',
    /폴더/.test(설명('파일로 저장')), 설명('파일로 저장'));
  T('★ 불러오기 설명에 「갈아 끼운다」 는 경고가 들어 있다',
    /갈아 끼/.test(설명('파일에서 불러오기')), 설명('파일에서 불러오기'));
  // ★ 화살표(›)는 「다음 화면으로 간다」는 뜻이다. 그 자리에서 일이 벌어지는 줄에 붙이면 거짓말이다.
  T('★ 그 자리에서 일어나는 줄에는 화살표가 없다',
    ['클라우드에 올리기','클라우드에서 가져오기','파일로 저장','파일에서 불러오기']
      .every(n => (화면.줄.find(x=>x.제목===n)||{}).화살표 === false));
  // ★ 4.132 — 휴지통이 적재표 도구줄에서 설정으로 왔다.
  T('★ 휴지통이 설정에 있다', 제목들.indexOf('휴지통') >= 0, 제목들);
  T('휴지통은 다음 화면으로 가므로 화살표가 있다',
    (화면.줄.find(x=>x.제목==='휴지통')||{}).화살표 === true);
  T('★ 눌러서 하는 일이 줄마다 제대로 걸려 있다',
    (화면.줄.find(x=>x.제목==='클라우드에 올리기')||{}).누르면.indexOf('syncUp()') >= 0
    && (화면.줄.find(x=>x.제목==='클라우드에서 가져오기')||{}).누르면.indexOf('syncDown()') >= 0
    && (화면.줄.find(x=>x.제목==='파일로 저장')||{}).누르면.indexOf('backupData()') >= 0
    && (화면.줄.find(x=>x.제목==='파일에서 불러오기')||{}).누르면.indexOf('drawerRestore()') >= 0,
    화면.줄.map(x=>x.제목+':'+x.누르면));
  T('다음 화면으로 가는 줄에는 화살표가 있다',
    (화면.줄.find(x=>x.제목==='알림')||{}).화살표 === true);

  // ★ 4.43 — 약관이 서랍에서 여기로 왔다. 법이 「언제든 볼 수 있게」 하라는 것이라 감추면 안 된다.
  T('★ 약관 · 개인정보가 설정에 보인다', 제목들.indexOf('약관 · 개인정보') >= 0, 제목들);
  T('약관은 다음 화면으로 가므로 화살표가 있다',
    (화면.줄.find(x=>x.제목==='약관 · 개인정보')||{}).화살표 === true);
  T('약관은 맨 끝에 있다', 제목들[제목들.length-1] === '약관 · 개인정보', 제목들);

  // ── 눌러서 정말 일이 벌어지나 (파일에서 불러오기 → 잠겨 있으면 물어본다)
  const 눌림 = await page.evaluate(async ()=>{
    window.__click = null;
    const el = document.getElementById('restoreFile');
    if(el) el.click = ()=>{ window.__click = true; };
    const r = [...document.querySelectorAll('.setrow')].find(x=>/파일에서 불러오기/.test(x.textContent));
    r.click();
    await new Promise(r2=>setTimeout(r2,200));
    const ov = document.getElementById('tellOv');
    return { 물음: ov && ov.classList.contains('open'),
             글: (document.getElementById('tellMsg')||{}).textContent || '',
             바로: window.__click };
  });
  // 처음 켠 앱은 편집 중이라 바로 파일 고르기로 간다. 잠겨 있으면 먼저 물어본다.
  T('★ 눌렀더니 정말 일이 벌어진다', 눌림.바로 === true || 눌림.물음 === true, 눌림);
  T('★ 브라우저 창이 안 뜬다', native.length === 0, native);

  console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
  await b.close(); srv.close();
  if(fail) process.exit(1);
})();
