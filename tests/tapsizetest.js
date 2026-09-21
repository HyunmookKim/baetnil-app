// 손가락으로 누를 수 있는가 — 화면마다 누르는 것들의 크기를 잰다.
//
// ★ 왜 이 검사가 있나
//   흔들리는 배 위에서, 젖은 손이나 장갑 낀 손으로 누른다.
//   애플·구글이 권하는 가장 작은 크기는 44px 인데, 재 보니 이런 것들이 있었다.
//     중간 기록의 '종류' 칸        14 × 17
//     점검 줄의 맡기기·고치기·지우기   18 × 22
//     도면 되돌리기·다시하기        37 × 22
//     도움말 물음표                18 × 18
//     창 닫기 ×                   12 × 20
//     하위 탭('오늘')              29 × 29
//   14×17 은 손톱보다 작다. 열한 가지 중 하나를 고르는 칸이었다.
//
//   높이를 다 44px 로 밀면 한 화면에 들어가는 줄이 확 준다.
//   그래서 글씨를 넣는 칸만 44px 로 하고, 줄 안에 여럿 늘어선 그림 단추는
//   36 × 40 으로 뒀다. 여기서는 그 선을 지키는지 본다.
const { chromium } = require('playwright');
const http=require('http'), fs=require('fs'), path=require('path');
const FILE = process.argv[2] || 'work.html';
// 인자로 절대경로를 주면 그대로 쓴다 (전에는 __dirname 을 무조건 붙여 404 가 났다)
const ABS = path.isAbsolute(FILE) ? FILE : path.join(__dirname, FILE);
const server = http.createServer((rq,rs)=>{
  const f = rq.url==='/' ? ABS : path.join(__dirname, rq.url.split('?')[0]);
  fs.readFile(f,(e,d)=>{ if(e){rs.writeHead(404);rs.end();return;}
    if(f.endsWith('.woff2')) rs.setHeader('Content-Type','font/woff2');
    rs.writeHead(200); rs.end(d); });
});
let ok=0,bad=0;
const T=(n,c,w)=>{ if(c){ok++;console.log('통과: '+n);}
  else{bad++;console.log('★ 실패: '+n+(w!==undefined?' — '+JSON.stringify(w).slice(0,300):''));} };

const MIN_H = 38;   // 높이 — 이보다 낮으면 손가락이 미끄러진다
const MIN_W = 34;   // 가로 — 그림 단추 넷이 한 줄에 들어가야 해서 여기까지 봐 준다

const PROBE = `(() => {
  const out = [];
  const vis = el => { const r = el.getBoundingClientRect();
    if(r.width < 1 || r.height < 1) return false;
    const st = getComputedStyle(el);
    return st.display!=='none' && st.visibility!=='hidden' && +st.opacity > .05; };
  const label = el => (el.innerText || el.value || el.getAttribute('aria-label') || el.title || '')
    .replace(/\\s+/g,' ').trim().slice(0,24);
  const where = el => { let p=el,s=[];
    for(let i=0;p&&i<3;i++,p=p.parentElement)
      s.push(p.tagName.toLowerCase()+(p.id?'#'+p.id:'')+
        (p.className&&typeof p.className==='string'?'.'+p.className.trim().split(/\\s+/).slice(0,2).join('.'):''));
    return s.join(' < '); };
  document.querySelectorAll('button,.btn,.minib,.tab,select,[role=button],.fopt,.x,.ckdel,.helpb,.lkt,.hsub,.engb').forEach(el=>{
    if(!vis(el)) return;
    const r = el.getBoundingClientRect();
    if(r.height >= ${MIN_H} && r.width >= ${MIN_W}) return;
    out.push({ t: label(el)||'(글자 없음)', h: Math.round(r.height), w: Math.round(r.width), s: where(el) });
  });
  return out;
})()`;

(async()=>{
  await new Promise(r=>server.listen(0,r));
  const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const ctx=await br.newContext({ locale:'ko-KR',viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const pg=await ctx.newPage();
  const errs=[]; pg.on('pageerror',e=>errs.push(String(e).slice(0,140)));
  await pg.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'networkidle'});
  await pg.waitForTimeout(900);
  await pg.evaluate(()=>{ window.alert=()=>{}; window.confirm=()=>true;
    try{skipWelcome();}catch(_){} unlocked=true; openBoatSetup(); });
  await pg.waitForTimeout(400);
  await pg.evaluate(()=>{ document.getElementById('nbName').value='시험호'; createBoat(); });
  await pg.waitForTimeout(1200);
  await pg.evaluate(()=>{
    const p=n=>String(n).padStart(2,'0');
    const d=o=>{const x=new Date(Date.now()+o*864e5);
      return x.getFullYear()+'-'+p(x.getMonth()+1)+'-'+p(x.getDate());};
    maint=[{id:'m1',name:'엔진오일 교체',grp:'엔진',months:12,unit:'m',lastDate:d(-400)},
           {id:'m2',name:'아노드 교환',grp:'선체',months:1,unit:'m',lastDate:d(-20)}];
    lockers=[{id:'L1',zone:'선수',label:'선수 창고',x:10,y:10,w:30,h:20}];
    items=[{id:'i1',name:'구명조끼',qty:6,unit:'개',lockerId:'L1',photos:[],note:''}];
    voyage=[{id:'v1',date:d(-1),title:'개도 한 바퀴',from:'여수',to:'여수',
             logs:[{id:'g1',time:'09:30',kind:'세일 올림',text:'제노아 폄'}],pub:true}];
    runs=[{id:'u1',date:d(-3),hours:'3.5',purpose:'충전'}];
    fuel=[{id:'f1',date:d(-9),liters:'180',cost:'315000',full:true}];
    saveMR();
  });

  const SCREENS = [
    ['홈 · 오늘',        `switchTab('home'); setHomeSub('today');`],
    ['홈 · 출항 전 점검', `switchTab('home'); setHomeSub('check');`],
    ['배 · 정비수첩',     `switchTab('boat'); goMaint('mlog');`],
    ['배 · 정기점검',     `switchTab('boat'); goMaint('maint');`],
    ['배 · 수리',        `switchTab('boat'); goMaint('repair');`],
    ['배 · 연료',        `switchTab('boat'); goMaint('fuel');`],
    ['배 · 장비',        `switchTab('boat'); setBoatSubTab('gear');`],
    ['배 · 문서',        `switchTab('boat'); setBoatSubTab('docs');`],
    ['배 · 적재표(그리기)',`switchTab('boat'); setBoatSubTab('stow'); if(!lkEdit) toggleLkEdit();`],
    ['항해일지',         `switchTab('boat'); setBoatSubTab('voyage');`],
    ['남의 배',          `switchTab('others');`],
    ['커뮤니티',         `switchTab('community');`],
  ];
  for(const [name, code] of SCREENS){
    await pg.evaluate(c=>{ (new Function(c))(); }, code);
    await pg.waitForTimeout(750);
    const r = await pg.evaluate(PROBE);
    T(name + ' — 손가락보다 작은 것이 없다 (' + r.length + '개)', r.length === 0,
      r.slice(0,6).map(o=>o.w+'×'+o.h+' '+o.t));
  }

  // ── 항해 기록 창 — 여기 '종류' 칸이 14×17 이었다
  await pg.evaluate(()=>{ switchTab('voyage'); });
  await pg.waitForTimeout(500);
  await pg.evaluate(()=>{ openMR('voyage','v1'); });
  await pg.waitForTimeout(900);
  const vr = await pg.evaluate(PROBE);
  T('항해 기록 창 — 손가락보다 작은 것이 없다 (' + vr.length + '개)', vr.length === 0,
    vr.slice(0,6).map(o=>o.w+'×'+o.h+' '+o.t));

  const kind = await pg.evaluate(()=>{
    const el = document.querySelector('#mrPanel .logkind');
    if(!el) return null;
    const r = el.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height) }; });
  T('★ 중간 기록 「종류」 칸이 44×44 를 넘는다 (14×17 이었다)',
    !!kind && kind.w >= 44 && kind.h >= 44, kind);

  const time = await pg.evaluate(()=>{
    const el = document.querySelector('#mrPanel .logtime');
    if(!el) return null;
    // 오전/오후가 잘리지 않는가
    return { w: Math.round(el.getBoundingClientRect().width),
             sw: el.scrollWidth, cw: el.clientWidth }; });
  T('중간 기록 「시각」 칸이 안 잘린다', !!time && time.sw <= time.cw + 2, time);

  // ── 날짜 칸이 잘리지 않는가 — 「마지막 07/14/2」 처럼 해가 잘려 나왔다
  const dt = await pg.evaluate(()=>{
    closeMR && closeMR();
    switchTab('boat'); setBoatSubTab('maint');
    if(!maint.length) return null;
    openMR('maint', maint[0].id);
    const e = document.querySelector('#mrPanel input[type=date]');
    if(!e) return null;
    return { w: Math.round(e.getBoundingClientRect().width), sw: e.scrollWidth, cw: e.clientWidth };
  });
  await pg.waitForTimeout(500);
  T('★ 날짜 칸이 안 잘린다 (해까지 다 보인다)',
    !!dt && dt.w >= 130 && dt.sw <= dt.cw + 2, dt);
  await pg.evaluate(()=>{ closeMR && closeMR(); });

  // ── 체크칸이 보이는가
  // ★ 4.02 에서 크기만 주고 flex 를 안 풀어 폭이 0 이 됐다.
  //   「만탱크」 를 켰는지 껐는지 눈으로 알 수가 없었다 — 잔량 추정의 기준점인데.
  const cb = await pg.evaluate(()=>{
    closeMR && closeMR();
    switchTab('boat'); setBoatSubTab('fuel');
    if(!fuel.length) return null;
    openMR('fuel', fuel[0].id);
    const e = document.querySelector('#mrPanel input[type=checkbox]');
    if(!e) return null;
    const r = e.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height) };
  });
  await pg.waitForTimeout(500);
  T('★ 「만탱크」 체크칸이 눈에 보인다 (폭 0 이 아니다)',
    !!cb && cb.w >= 18 && cb.h >= 18, cb);
  await pg.evaluate(()=>{ closeMR && closeMR(); });

  // ── 열 때마다 안내가 쌓이지 않는가 (뒤에 붙이도록 바꿨다)
  const stack = await pg.evaluate(()=>{
    closeMR && closeMR();
    switchTab('boat'); setBoatSubTab('stow');
    for(let i=0;i<4;i++) refreshBoxes();
    return document.querySelectorAll('#fpNoLine').length; });
  T('도면 안내가 여러 번 쌓이지 않는다', stack <= 1, stack);

  // ── 적재표 밖에서는 도면 안내가 안 뜬다
  const leak = await pg.evaluate(()=>{
    switchTab('home'); setHomeSub('check');
    refreshBoxes();
    const h = document.getElementById('hint');
    return h ? getComputedStyle(h).display : '(없음)'; });
  T('★ 점검 화면에 도면 안내가 안 샌다', leak === 'none', leak);

  T('앱이 터지지 않았다', errs.length===0, errs.slice(0,2));
  console.log('\n합계: '+ok+'개 통과 / '+bad+'개 실패');
  await br.close(); server.close();
  process.exit(bad?1:0);
})();
