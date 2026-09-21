// 기본 정박지 — 진짜 브라우저에서 본다
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const FILE = process.argv[2] || 'work.html';
const server = http.createServer((rq,rs)=>{
  const f = ((rq.url === '/' && path.isAbsolute(FILE)) ? FILE : path.join(__dirname, rq.url === '/' ? FILE : rq.url.split('?')[0]));
  fs.readFile(f,(e,d)=>{ if(e){ rs.writeHead(404); rs.end(); return; }
    if(f.endsWith('.woff2')) rs.setHeader('Content-Type','font/woff2');
    rs.writeHead(200); rs.end(d); });
});
let ok=0,bad=0;
const T=(n,c,w)=>{ if(c){ok++;console.log('통과: '+n);} else {bad++;console.log('★ 실패: '+n+(w?' — '+w:''));} };
(async ()=>{
  await new Promise(r=>server.listen(0,r));
  const br = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await br.newContext({ locale:'ko-KR', viewport:{width:390,height:780}, isMobile:true, hasTouch:true });
  const pg = await ctx.newPage();
  const errs=[]; pg.on('pageerror', e=>errs.push(String(e)));
  await pg.goto('http://127.0.0.1:'+server.address().port+'/', { waitUntil:'networkidle' });
  await pg.waitForTimeout(900);
  try{ await pg.evaluate(()=>skipWelcome()); }catch(_){}

  const n = await pg.evaluate(()=>({
    seed: SPOT_SEED.length,
    marina: SPOT_SEED.filter(x=>x.k==='marina').length,
    port: SPOT_SEED.filter(x=>x.k==='port').length,
    all: spotsAll().length
  }));
  T('마리나 39 · 어항 113 · 모두 152', n.marina===39 && n.port===113 && n.all===152, JSON.stringify(n));

  const row = await pg.evaluate(()=>seedSpotRow(SPOT_SEED.find(x=>x.n==='수영만 마리나')));
  T('수영만 마리나 자리가 맞다',
    Math.abs(row.lat-35.16)<0.02 && Math.abs(row.lon-129.14)<0.02, JSON.stringify([row.lat,row.lon]));
  T('시설이 풀린다', row.fac && (row.fac.fuel || row.fac.water), JSON.stringify(row.fac));
  T('관 자료 표시가 붙는다', row.seed === true && row.byName === '해양수산부 자료');

  // 가까운 순 — 여수 앞바다에 배를 두면 여수 것이 위로
  const near = await pg.evaluate(()=>{
    boats=[{id:'b1',name:'테스트호',type:'sail',homeport:'여수',lat:34.74,lon:127.74,spec:{}}];
    currentBoatId='b1'; window.currentBoatId='b1';
    spotList=[]; spotKind='';
    const rows = spotsAll()
      .sort((a,b)=>{ const x=spotNm(a),y=spotNm(b); return (x==null?1e9:x)-(y==null?1e9:y); })
      .slice(0,5).map(s=>s.name+' '+Math.round(spotNm(s))+'NM');
    return rows;
  });
  T('여수에 배를 두면 가까운 곳이 위로 온다',
    /여수|국동|신월|돌산|여천/.test(near[0]||''), near.join(' / '));

  // 낚시배면 항·부두로 시작
  const filt = await pg.evaluate(()=>{
    try{ localStorage.removeItem('bt_spotkind'); }catch(_){}
    spotKind = null;
    boats[0].type='fishing';
    const a = spotKindNow();
    boats[0].type='sail';
    const b = spotKindNow();
    return { fishing:a, sail:b };
  });
  T('낚시배는 항·부두로 시작한다', filt.fishing === 'port', JSON.stringify(filt));
  T('요트는 전체로 시작한다', filt.sail === '', JSON.stringify(filt));

  // 관 자료를 채우면 seed 표시가 떨어진다
  const fill = await pg.evaluate(()=>{
    const s = spotsAll().find(x=>x.seed);
    return { canEditLoggedOut: canEditSpot(s) };
  });
  T('로그인 안 하면 못 채운다', fill.canEditLoggedOut === false);

  T('앱이 터지지 않았다', errs.length===0, errs.join(' / ').slice(0,200));
  console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
  await br.close(); server.close();
  process.exit(bad?1:0);
})();
