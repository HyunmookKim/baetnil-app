// 4.91 — 장비 교체 (사장님이 정하신 것)
//
// ★ 「기존에 있던 장비를 교체하는 경우도 있잖아. 그냥 삭제하는 게 아니라 교체 버튼」
// ★ 「과거 장비에 대한 수리 이력은 과거 장비 걸로, 현재 장비의 수리 이력은 현재 장비 걸로」
// ★ 「새 장비로 정기점검 따라오는 건 맞는데 이력은 과거 장비 껀 과거 장비에 있어야지」
const { chromium } = require('playwright');
const http=require('http'), fs=require('fs'), path=require('path');
const FILE = process.argv[2] || 'work.html';
// 넘겨받은 길이 절대경로면 그대로 쓴다 (__dirname 을 앞에 붙이면 엉뚱한 자리가 된다).
//   나머지(font.woff2 같은 것)는 지금까지처럼 검사 폴더에서 찾는다.
const APP = path.isAbsolute(FILE) ? FILE : path.join(__dirname, FILE);
const server = http.createServer((rq,rs)=>{
  const f = rq.url==='/' ? APP : path.join(__dirname, rq.url.split('?')[0]);
  fs.readFile(f,(e,d)=>{ if(e){rs.writeHead(404);rs.end();return;}
    if(f.endsWith('.woff2')) rs.setHeader('Content-Type','font/woff2');
    rs.writeHead(200); rs.end(d); });
});
let ok=0,bad=0;
const T=(n,c,w)=>{ if(c){ok++;console.log('통과: '+n);}
  else{bad++;console.log('★ 실패: '+n+(w!==undefined?' — '+JSON.stringify(w).slice(0,240):''));} };

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

  // ── 해수펌프 하나. 점검 하나(이력 셋) · 수리 둘 · 예비품 하나 ─────────
  await pg.evaluate(()=>{
    maint.length = 0; repair.length = 0; items.length = 0;
    maint.push({ id:1, typ:'gear', name:'해수펌프', sys:'추진', kind:'해수펌프',
                 maker:'Johnson', model:'F5B', sn:'AAA', since:'2012-05-01',
                 pin:{map:'plan',x:30,y:40}, photos:[] });
    maint.push({ id:2, name:'임펠러 교체', gearId:'1', months:12, unit:'m',
                 lastDate:'2025-06-01',
                 history:[{date:'2024-06-01'},{date:'2019-07-01'},{date:'2015-08-01'}] });
    repair.push({ id:3, title:'옛 펌프 누수', gearId:'1', status:'done' });
    repair.push({ id:4, title:'옛 펌프 소음', gearId:'1', status:'done' });
    items.push({ id:5, name:'예비 임펠러', gearId:'1', qty:1, lockerId:(lockers[0]||{}).id, photos:[] });
    saveMR(); save();
  });
  await pg.waitForTimeout(400);

  // ══ 교체한다 ══════════════════════════════════════════════════════
  const 결과 = await pg.evaluate(async ()=>{
    // ★ today() 는 const 라 밖에서 못 바꾼다. 앱이 쓰는 날짜를 그대로 받아 온다.
    const 오늘 = today();
    setBoatSubTab('gear'); setGearSub('gear');
    openMR('gear', 1);
    await gearReplace();
    const 새것 = gearRows().find(g => String(g.id) !== '1');
    const 옛것 = gearOf(1);
    return {
      새것있나: !!새것, 새id: 새것 && String(새것.id),
      옛것남았나: !!옛것,
      옛것이목록에: gearRows().some(g => String(g.id) === '1'),
      오늘: 오늘,
      옛것표: { retired: 옛것 && 옛것.retired, newId: 옛것 && 옛것.newId },
      새것표: { oldId: 새것 && 새것.oldId, since: 새것 && 새것.since },
      물려받음: 새것 && { sys:새것.sys, kind:새것.kind, 핀:!!새것.pin },
      안물려받음: 새것 && { maker:새것.maker, model:새것.model, sn:새것.sn },
      점검이간곳: (maint.find(x=>String(x.id)==='2')||{}).gearId,
      부품이간곳: (items.find(x=>String(x.id)==='5')||{}).gearId,
      수리가간곳: repair.map(r=>r.gearId)
    };
  });
  T('★★★ 새 장비가 생겼다', 결과.새것있나, 결과);
  T('★★★ 지난 장비를 지우지 않았다', 결과.옛것남았나, 결과);
  T('★★★ 지난 장비는 목록에 안 나온다', 결과.옛것이목록에 === false, 결과);
  T('★★ 지난 장비에 교체한 날이 찍혔다', 결과.옛것표.retired === 결과.오늘, 결과);
  T('★★ 새것과 지난것이 서로를 안다',
    결과.옛것표.newId === 결과.새id && 결과.새것표.oldId === '1', 결과);
  T('★★ 새 장비 설치일이 교체한 날이다', 결과.새것표.since === 결과.오늘, 결과);
  T('★★★ 자리는 물려받는다 (계통 · 종류 · 도면 핀)',
    결과.물려받음.sys === '추진' && 결과.물려받음.kind === '해수펌프' && 결과.물려받음.핀, 결과);
  T('★★★ 물건은 안 물려받는다 (제조사 · 모델 · 일련번호)',
    !결과.안물려받음.maker && !결과.안물려받음.model && !결과.안물려받음.sn, 결과);

  // ══ 사장님이 정하신 것 — 무엇이 따라가고 무엇이 남는가 ═════════════
  T('★★★ 정기점검은 새 장비로 따라간다', 결과.점검이간곳 === 결과.새id, 결과);
  T('★★★ 부품도 새 장비로 따라간다',   결과.부품이간곳 === 결과.새id, 결과);
  T('★★★ 수리는 지난 장비에 남는다 (따라가지 않는다)',
    결과.수리가간곳.every(x => String(x) === '1'), 결과);

  // ══ ★★★ 이력이 갈리는가 — 사장님이 두 번 말씀하신 것 ═══════════════
  const 이력 = await pg.evaluate(()=>{
    const 새것 = gearRows().find(g => String(g.id) !== '1');
    const 옛것 = gearOf(1);
    const 항목 = maint.find(x => String(x.id) === '2');
    return {
      새것몫: gearHist(새것, 항목),      // 2026-08-31 뒤
      옛것몫: gearHist(옛것, 항목),      // 2012-05-01 ~ 2026-08-31
      새것수리: gearRepair(새것.id).length,
      옛것수리: gearRepair(1).length,
      거슬러: gearPast(새것).map(g => String(g.id))
    };
  });
  console.log('  옛것 점검 이력: ' + 이력.옛것몫.join(', '));
  console.log('  새것 점검 이력: ' + (이력.새것몫.join(', ') || '(없음)'));
  T('★★★ 지나간 점검 날짜는 지난 장비 것이다 (넷 다)',
    이력.옛것몫.length === 4 && 이력.옛것몫.indexOf('2015-08-01') >= 0, 이력);
  T('★★★ 새 장비에는 지난 점검 날짜가 안 붙는다', 이력.새것몫.length === 0, 이력);
  T('★★★ 수리도 지난 장비 것으로만 센다',
    이력.옛것수리 === 2 && 이력.새것수리 === 0, 이력);
  T('★★ 새것에서 지난 것을 거슬러 찾을 수 있다', 이력.거슬러.join() === '1', 이력);

  // ══ 화면에 나오는가 ═══════════════════════════════════════════════
  const 화면 = await pg.evaluate(()=>{
    const 새것 = gearRows().find(g => String(g.id) !== '1');
    openMR('gear', 새것.id);
    const P = document.getElementById('mrPanel');
    const txt = P.textContent.replace(/\s+/g,' ');
    const heads = [...P.querySelectorAll('.ghead b')].map(b=>b.textContent.trim());
    // 점검 이력이 접혀 있어야 한다 — 날짜가 안 보여야 한다
    const 접힘 = !/2015-08-01/.test(txt);
    return { txt: txt.slice(0,400), heads, 접힘,
             교체단추: /교체/.test(txt) };
  });
  T('★★★ 새 장비 칸에 「교체 이력」 이 있다', 화면.heads.indexOf('교체 이력') >= 0, 화면.heads);
  T('★★ 「교체」 단추가 있다', 화면.교체단추, 화면);
  // ★ 새 장비에는 지나간 점검 날짜가 없다 — 그것이 이 기능의 핵심이다
  T('★★★ 새 장비에는 지난 점검 날짜가 화면에도 안 뜬다', 화면.접힘, 화면);

  // ── 지난 장비 쪽에 점검 이력이 있고, 접혀 있다 ──────────────────────
  const 옛것칸 = await pg.evaluate(()=>{
    openMR('gear', 1);
    const P = document.getElementById('mrPanel');
    return { heads: [...P.querySelectorAll('.ghead b')].map(b=>b.textContent.trim()),
             접힘: !/2015-08-01/.test(P.textContent) };
  });
  T('★★★ 지난 장비 칸에 「정기점검 이력」 이 있다',
    옛것칸.heads.indexOf('정기점검 이력') >= 0, 옛것칸.heads);
  T('★★★ 그것은 접혀 있다 (반복이라 화면만 잡아먹는다)', 옛것칸.접힘, 옛것칸);

  const 펼침 = await pg.evaluate(()=>{
    gearHistToggle(1);
    return document.getElementById('mrPanel').textContent.replace(/\s+/g,' ');
  });
  T('★★★ 단추를 누르면 지난 점검 날짜가 펼쳐진다', /2015-08-01/.test(펼침), 펼침.slice(0,300));
  T('★★★ 펼치면 넷이 다 나온다',
    ['2025-06-01','2024-06-01','2019-07-01','2015-08-01'].every(d => 펼침.includes(d)), 펼침.slice(0,300));

  // 지난 장비를 열면 제 수리가 나온다
  const 옛화면 = await pg.evaluate(()=>{
    openMR('gear', 1);
    const txt = document.getElementById('mrPanel').textContent.replace(/\s+/g,' ');
    return { txt: txt.slice(0,500), 수리보임: /옛 펌프 누수/.test(txt),
             기간: /2012-05-01/.test(txt) && txt.includes(today()),
             교체단추: /교체(?!\s*이력)/.test(txt) };
  });
  T('★★★ 지난 장비를 열면 그 장비의 수리가 나온다', 옛화면.수리보임, 옛화면);
  T('★★★ 지난 장비에 달려 있던 기간이 나온다', 옛화면.기간, 옛화면);

  // 두 번 교체해도 줄이 이어진다
  const 두번 = await pg.evaluate(async ()=>{
    const 새것 = gearRows().find(g => String(g.id) !== '1');
    openMR('gear', 새것.id);
    await gearReplace();
    const 최신 = gearRows().find(g => !g.retired && String(g.id) !== '1' && String(g.id) !== String(새것.id));
    return { 줄: gearPast(최신).map(g => String(g.id)), 목록수: gearRows().length };
  });
  T('★★★ 두 번 교체하면 이력이 둘로 이어진다', 두번.줄.length === 2, 두번);
  T('★★★ 목록에는 지금 것 하나만 남는다', 두번.목록수 === 1, 두번);

  T('★ 화면 오류가 없다', errs.length === 0, errs);
  console.log('\n통과 '+ok+' · 실패 '+bad);
  await br.close(); server.close(); process.exit(bad?1:0);
})();
