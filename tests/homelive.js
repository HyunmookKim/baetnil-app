// 오늘 화면 — 사장님 실제 자료로 진짜 그려 본다
//
// ★ 왜 필요한가 (2026-08-27, 사장님이 폰 사진으로 잡아 주신 것)
//   ① 출항 전 점검이 늘 0 / 0 이었다.
//      점검 화면은 ckItems() 라는 문을 쓰는데 오늘 화면만 스스로 걸렀고,
//      list 값이 없는 항목(옛 자료에 많다)이 통째로 빠졌다.
//   ② 날씨 칸이 늘 「어디 날씨를 볼지 아직 정하지 않았습니다」 였다.
//      배 홈포트가 있는데도 앱을 다시 켜면 안 잡혔다.
//   둘 다 「앱은 안 터지는데 첫 화면이 비어 있는」 종류다. 함수 검사로는 절대 안 잡힌다.
const { chromium } = require('playwright');
const fs=require('fs'), http=require('http'), path=require('path');
const SRC = process.argv[2] || 'work.html';
// ★ 사장님 진짜 백업. 어디서 부르든 찾도록 후보를 둔다.
const DATA = [process.argv[3], __dirname + '/sample-backup.json']
  .filter(Boolean).find(f => { try{ require('fs').accessSync(f); return true; }catch(e){ return false; } });
if(!DATA){ console.log('★ 실패: 견본 백업(sample-backup.json)을 못 찾았습니다'); process.exit(1); }
const srv = http.createServer((q,r)=>{
  let f=q.url.split('?')[0];
  const p = (f === '/' && path.isAbsolute(SRC)) ? SRC
          : path.join(__dirname, (f === '/' ? SRC : f).replace(/^\//,''));
  if(!fs.existsSync(p)){ r.writeHead(404); r.end(''); return; }
  const e=path.extname(p);
  r.writeHead(200,{'content-type': e==='.js'?'text/javascript':'text/html; charset=utf-8'});
  r.end(fs.readFileSync(p));
});
let pass=0, fail=0;
const T=(n,ok,x)=>{ ok?pass++:(fail++,console.log('★ 실패:',n, x===undefined?'':JSON.stringify(x).slice(0,200))); };
(async()=>{
  await new Promise(r=>srv.listen(0,r));
  const port=srv.address().port;
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const p=await(await b.newContext({ locale:'ko-KR',viewport:{width:430,height:930}})).newPage();
  p.on('pageerror', e=>{ fail++; console.log('★ 실패: 터짐 —', e.message); });
  p.on('console', m=>{ if(m.type()==='error') console.log('   콘솔:', m.text().slice(0,160)); });
  await p.route('**://tile.openstreetmap.org/**', r=>r.abort());
  await p.addInitScript(()=>{ try{ localStorage.setItem('bt_agree','1'); }catch(e){} });
  await p.goto(`http://127.0.0.1:${port}/`);
  await p.waitForTimeout(2200);
  await p.evaluate(()=>{ window.ask=()=>Promise.resolve(true); window.tell=()=>Promise.resolve(true);
    try{ skipWelcome(); }catch(_){}
    const o=document.getElementById('welcomeOv'); if(o) o.classList.remove('open'); });

  // 사장님 자료를 넣는다
  const 넣음 = await p.evaluate(async (body)=>{
    const f=new File([body],'m.json',{type:'application/json'});
    restoreData({ target:{ files:[f], value:'' } });
    for(let i=0;i<80;i++){ await new Promise(r=>setTimeout(r,150)); if(items.length>100) break; }
    const j=JSON.parse(body);
    if(j.boat){ boats=[j.boat]; currentBoatId=j.boat.id; window.currentBoatId=currentBoatId;
      applyBoatName(); saveLocal(); if(typeof sysSave==='function') sysSave(); }
    if(Array.isArray(j.checkt)) checkt=j.checkt;
    if(typeof saveMR==='function') saveMR();
    // ★ 날씨 지점을 지운다. 이 검사가 대신 잡아 주면 안 된다 —
    //   「앱을 다시 켰을 때 스스로 잡는가」가 물음이므로, 아래에서 진짜로 다시 켠다.
    try{ localStorage.removeItem('bt_wxcur'); localStorage.removeItem('bt_spots'); }catch(_){}
    // ★ 저장은 기기 창고(IndexedDB)로 들어가는 데 시간이 걸린다.
    //   기다리지 않고 다시 켜면 배가 없는 채로 켜진다 — 검사가 헛돌았다.
    await new Promise(r2=>setTimeout(r2,1500));
    return { 칸: lockers.length, 점검: (checkt||[]).length, 배: boats.length };
  }, fs.readFileSync(DATA,'utf8'));
  console.log('   자료 —', JSON.stringify(넣음));

  // ★ 진짜로 앱을 다시 켠다. 사장님이 겪은 것이 바로 이것이다 —
  //   배는 이미 있는데 다시 켜면 첫 화면 날씨 칸이 비어 있었다.
  await p.reload({ waitUntil:'domcontentloaded' });
  await p.waitForTimeout(3000);
  await p.evaluate(()=>{ window.ask=()=>Promise.resolve(true); window.tell=()=>Promise.resolve(true);
    try{ skipWelcome(); }catch(_){}
    const o=document.getElementById('welcomeOv'); if(o) o.classList.remove('open');
    switchTab('home'); });
  await p.waitForTimeout(1200);

  const 짚어보기 = await p.evaluate(()=>({
    배: (typeof boats!=='undefined') ? boats.length : '없음',
    현재배: (typeof currentBoatId!=='undefined') ? String(currentBoatId) : '없음',
    점검수: (typeof checkt!=='undefined') ? checkt.length : '없음',
    탭: (typeof curTab!=='undefined') ? curTab : '없음',
    홈있나: !!document.getElementById('homeList'),
    홈글: (document.getElementById('homeList')||{}).innerText ? (document.getElementById('homeList').innerText.slice(0,120)) : ''
  }));
  console.log('   짚어보기 —', JSON.stringify(짚어보기));

  const 화면 = await p.evaluate(()=>{
    const L=document.getElementById('homeList');
    const 글 = L ? L.innerText : '';
    // ★ 4.122 에서 「첫걸음」 카드(3/4)가 맨 위에 생겼다. 글 전체에서 첫 숫자짝을 집으면
    //   점검 카드가 아니라 첫걸음 카드를 세게 된다. 점검 카드는 곁말이 「n개 목록 중」 이다.
    const 카드 = [...document.querySelectorAll('#homeList .hcard')]
      .find(c => /개 목록 중/.test(c.innerText || ''));
    const 큰 = 카드 ? ((카드.querySelector('.hbig')||{}).innerText || '') : '';
    const 점검 = (큰.match(/(\d+)\s*\/\s*(\d+)/) || []);
    return { 글, 점검: 점검.slice(1,3), 점검카드: 카드 ? 카드.innerText.replace(/\s+/g,' ').slice(0,80) : '없음',
             날씨미정: 글.indexOf('아직 정하지 않았습니다') >= 0,
             지점: (typeof wxCur !== 'undefined' && wxCur) ? (wxCur.name || wxCur.id) : null };
  });

  // ── ① 출항 전 점검
  T('★ 점검 카드가 오늘 화면에 있다 — ' + 화면.점검카드, 화면.점검카드 !== '없음', 화면.점검카드);
  T('★ 출항 전 점검이 0 / 0 이 아니다 — ' + (화면.점검.join(' / ') || '숫자 없음'),
    화면.점검.length === 2 && Number(화면.점검[1]) > 0, 화면.점검);
  T('점검 항목 수가 점검 화면과 같다', await p.evaluate(()=>{
      const cur = ckCurId();
      return ckItems(cur).length;
    }) === Number(화면.점검[1] || 0),
    { 오늘: 화면.점검[1], 점검화면: await p.evaluate(()=>ckItems(ckCurId()).length) });

  // ── ② 날씨 지점
  T('★ 켜자마자 날씨 지점이 잡혀 있다 — ' + (화면.지점 || '없음'), !!화면.지점, 화면.지점);
  T('★ 「아직 정하지 않았습니다」가 안 뜬다', 화면.날씨미정 === false);
  T('그 지점이 배 홈포트다',
    await p.evaluate(()=>{ const b0=curBoat();
      return !!(wxCur && b0 && Math.abs(wxCur.lat-b0.lat)<0.001 && Math.abs(wxCur.lon-b0.lon)<0.001); }));

  // ── ★ 탭 이름이 목록 하나의 이름이면 안 된다
  //    그 탭에는 목록이 여럿이다 (출항 전 · 입항 후 · 정박 중 …).
  //    첫 목록 이름을 탭 이름으로 붙여 두면 나머지가 없는 것처럼 보인다. 사장님이 잡아 주셨다.
  {
    const src2 = require('fs').readFileSync(
      require('path').isAbsolute(SRC) ? SRC : require('path').join(__dirname, SRC), 'utf8');
    const seen = src2.replace(/^\s*\/\/[^\n]*$/gm, '');
    T('★ 탭 이름이 「출항 전 점검」이 아니다',
      !/check:\s*t\('출항 전 점검'\)/.test(seen) && !/'home:check':\s*\['checkWrap',\s*'출항 전 점검'\]/.test(seen));
    // ★ 배 탭에 이미 「정기점검」이 있다. 이쪽을 「점검」이라 부르면 둘이 헷갈린다.
    T('★ 「점검」이 아니라 「체크리스트」다',
      /check:\s*t\('체크리스트'\)/.test(seen) && !/check:\s*t\('점검'\)/.test(seen));
    const 탭 = await p.evaluate(()=>{
      const el = [...document.querySelectorAll('.tab, .sub, button')]
        .map(x=>x.textContent.trim()).filter(Boolean);
      return el;
    });
    T('화면 위 탭에 「출항 전 점검」이라 안 적혀 있다',
      !탭.some(x => x === '출항 전 점검'), 탭.slice(0,10));
  }
  // ── 오늘 카드가 어느 목록을 세는지 이름으로 말해 준다
  T('★ 오늘 카드 이름이 지금 세는 목록 이름이다',
    /출항 전/.test(화면.글) || /입항 후/.test(화면.글) || /정박 중/.test(화면.글), 화면.글.slice(0,120));

  // ── 그 밖에 오늘 화면이 비어 있지 않은가
  T('곧 해야 할 정비가 나온다', /정비/.test(화면.글));
  T('고쳐야 할 곳이 나온다', /고쳐야 할 곳/.test(화면.글));

  await p.screenshot({ path:'shots/01_today.png' });
  console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
  await b.close(); srv.close();
  if(fail) process.exit(1);
})();
