// 4.03 — 눈으로 봐야 아는 것들을 진짜 브라우저에서 확인한다.
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
  await pg.evaluate(()=>{ window.__al=[];
    window.alert=m=>window.__al.push(String(m).replace(/\n+/g,' / '));
    window.confirm=()=>true;
    try{skipWelcome();}catch(_){} unlocked=true; openBoatSetup(); });
  await pg.waitForTimeout(500);

  // ── ① 홈포트 이름만 적어도 날씨 지점이 생긴다
  await pg.evaluate(()=>{
    document.getElementById('nbName').value='시험호';
    const p=document.getElementById('nbPort'); if(p) p.value='소호 마리나';
    createBoat(); });
  await pg.waitForTimeout(1300);
  const port = await pg.evaluate(()=>{
    const b=curBoat();
    // 지도를 안 찍은 것으로 만든다 — 이름만 적은 사람의 자리
    b.lat=null; b.lon=null; b.port='소호 마리나';
    wxSpots=(wxSpots||[]).filter(s=>s.id!=='port@'+b.id);
    syncPortSpot(b);
    const s=(wxSpots||[]).find(x=>x.id==='port@'+b.id);
    return { lat:b.lat, lon:b.lon, spot: s?{n:s.name,la:s.lat,lo:s.lon}:null }; });
  T('★ 홈포트 이름만 적어도 좌표를 찾아 준다',
    !!port.lat && Math.abs(port.lat-34.73768)<0.01, port);
  T('★ 그래서 날씨 지점이 생긴다', !!port.spot, port.spot);
  const noport = await pg.evaluate(()=>{
    const b=curBoat(); const keep=[b.lat,b.lon];
    b.lat=null; b.lon=null; b.port='없는이름항구';
    syncPortSpot(b);
    const r = { lat:b.lat };
    b.lat=keep[0]; b.lon=keep[1]; b.port='소호 마리나';
    return r; });
  T('모르는 이름이면 억지로 안 찍는다', noport.lat == null, noport);

  // ── ② 항해일지 목록 — 「04:53 → 04:53」
  const vt = await pg.evaluate(()=>{
    voyage=[{id:'v1',date:'2026-08-10',title:'',from:'',to:'',timeOut:'04:53',timeIn:'04:53',logs:[]},
            {id:'v2',date:'2026-08-09',title:'',from:'',to:'',timeOut:'06:10',timeIn:'11:40',logs:[]},
            {id:'v3',date:'2026-08-08',title:'',from:'여수',to:'',timeOut:'',timeIn:'',logs:[]},
            {id:'v4',date:'2026-08-07',title:'',from:'',to:'',timeOut:'',timeIn:'',logs:[]}];
    saveMR(); switchTab('voyage'); renderVoyage();
    return document.getElementById('voyageList').innerText; });
  T('★ 「04:53 → 04:53」 이 사라졌다', !/04:53 → 04:53/.test(vt), vt.slice(0,160));
  // 출발 시각 하나만 남았으면 그것이라도 뜻이 있다 — 「04:53 출항」
  T('대신 뜻이 있는 제목이 나온다', /04:53 출항/.test(vt), vt.slice(0,160));
  T('출발·도착 시각이 다르면 그대로 쓴다', /06:10 → 11:40/.test(vt), vt.slice(0,200));
  // ★ 4.115 — 한쪽만 적으셨으면 화살표를 안 그린다 (사장님 지적).
  //   「여수 → —」 는 어디로 갔는지 안 알려 주면서 빈칸만 보여 준다.
  T('항 이름이 한쪽만 있으면 화살표를 안 그린다',
    /여수/.test(vt) && !/여수 →/.test(vt) && !/→ —/.test(vt), vt.slice(0,220));
  T('아무것도 없으면 「제목 없는 항해」', /제목 없는 항해/.test(vt), vt.slice(0,260));

  // ── ③ 오늘 화면에 「고쳐야 할 곳」
  const home = await pg.evaluate(()=>{
    repair=[{id:'r1',name:'윈치 손잡이 헐거움',status:'open',created:'2026-08-01'},
            {id:'r2',name:'조타등 불량',status:'progress',created:'2026-07-20'},
            {id:'r3',name:'다 고친 것',status:'done',created:'2026-06-01'}];
    saveMR(); switchTab('home'); setHomeSub('today'); renderHome();
    return document.getElementById('homeList').innerText; });
  T('★ 오늘 화면에 「고쳐야 할 곳」 이 뜬다', /고쳐야 할 곳/.test(home), home.slice(0,300));
  T('고장 난 것이 이름째 보인다', /윈치 손잡이 헐거움/.test(home));
  T('진행중인 것도 보인다', /조타등 불량/.test(home));
  T('다 고친 것은 안 나온다', !/다 고친 것/.test(home));

  // ── ④ 저장된 날씨 글이 언어를 따라온다
  const wx = await pg.evaluate(()=>{
    const w = { text:'남서 12kt(돌풍 18) · 파고 0.8m · 조위 130cm · 24℃',
                at:'2026-08-10 09:00', spot:'', dir:225, kt:12, gust:18, wave:0.8, tide:130, temp:24 };
    const d=document.createElement('div'); d.innerHTML = wxLine(w, '');
    return d.innerText; });
  T('한국어에서는 그대로 보인다', /12kt/.test(wx) && /0\.8m/.test(wx), wx);
  await pg.evaluate(()=>localStorage.setItem('bt_lang','en'));
  await pg.reload({waitUntil:'networkidle'});
  await pg.waitForTimeout(1200);
  const wxEn = await pg.evaluate(()=>{
    const w = { text:'남서 12kt(돌풍 18) · 파고 0.8m · 조위 130cm · 24℃',
                at:'2026-08-10 09:00', spot:'', dir:225, kt:12, gust:18, wave:0.8, tide:130, temp:24 };
    const d=document.createElement('div'); d.innerHTML = wxLine(w, '');
    return d.innerText; });
  T('★ 영어로 바꾸면 저장된 날씨 글도 영어가 된다',
    !/[가-힣]/.test(wxEn) && /12kt/.test(wxEn), wxEn);
  T('숫자는 그대로다', /0\.8/.test(wxEn) && /130/.test(wxEn) && /24\u2103/.test(wxEn), wxEn);
  // 옛 기록(숫자 없이 글만)은 그대로 남는다
  const wxOld = await pg.evaluate(()=>{
    const d=document.createElement('div');
    d.innerHTML = wxLine({ text:'받는 중…', at:'', spot:'' }, '');
    return d.innerText; });
  T('숫자가 없는 옛 기록도 사전을 거친다', !/받는 중/.test(wxOld), wxOld);

  T('앱이 터지지 않았다', errs.length===0, errs.slice(0,2));
  console.log('\n합계: '+ok+'개 통과 / '+bad+'개 실패');
  await br.close(); server.close();
  process.exit(bad?1:0);
})();
