// 4.93 — 내 배 기록에 찾기 칸
//
// ★ 여태 찾기는 적재표에만 있었다. 장비·정기점검·수리·정비수첩에는 없었다.
//   장비가 예순 개 넘어가면 눈으로 훑을 수가 없다.
// ★ 폰 안에서 찾는다. 서버에 안 묻는다 — 바다에서는 인터넷이 없다.
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
  const pg=await (await br.newContext({ locale:'ko-KR',viewport:{width:390,height:844},isMobile:true,hasTouch:true})).newPage();
  const errs=[]; pg.on('pageerror',e=>errs.push(String(e).slice(0,140)));
  await pg.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'networkidle'});
  await pg.waitForTimeout(900);
  await pg.evaluate(()=>{ window.tell=()=>Promise.resolve(); window.ask=()=>Promise.resolve(true);
    try{skipWelcome();}catch(_){} unlocked=true; openBoatSetup(); });
  await pg.waitForTimeout(400);
  await pg.evaluate(()=>{ document.getElementById('nbName').value='시험호'; createBoat(); });
  await pg.waitForTimeout(1500);

  await pg.evaluate(()=>{
    maint.length = 0; repair.length = 0;
    maint.push({ id:1, typ:'gear', name:'해수펌프', sys:'추진', maker:'Jabsco', model:'50840' });
    maint.push({ id:2, typ:'gear', name:'윈들러스', sys:'계류·묘박', maker:'Lewmar', model:'V700' });
    maint.push({ id:3, name:'임펠러 교체', grp:'추진', months:12, unit:'m', gearId:'1' });
    maint.push({ id:4, name:'아연 아노드 점검', grp:'선체', months:6, unit:'m' });
    maint.push({ id:5, typ:'log', date:'2026-05-01', title:'임펠러 갈았다', note:'Jabsco 순정' });
    maint.push({ id:6, typ:'log', date:'2026-04-01', title:'배터리 단자 청소' });
    repair.push({ id:7, title:'윈들러스 안 돎', status:'open', note:'모터 소리는 남' });
    repair.push({ id:8, title:'빌지 누수', status:'done', doneDate:'2026-03-01' });
    saveMR();
  });
  await pg.waitForTimeout(400);

  const 켜기 = async (sub) => { await pg.evaluate(s=>{
      setBoatSubTab(s === 'repair' ? 'repair' : s === 'mlog' ? 'maint' : 'gear');
      if(s === 'gear' || s === 'maint') setGearSub(s);
      else if(s === 'mlog') setMntSub('mlog');
    }, sub); await pg.waitForTimeout(500); };
  const 찾기 = (k, q) => pg.evaluate(a=>{ mrFindSet(a.k, a.q); }, {k, q});
  const 칸 = k => pg.evaluate(x=>!!document.getElementById('mrFind_' + x), k);
  const 줄수 = sel => pg.evaluate(s=>document.querySelectorAll(s).length, sel);
  const 글 = sel => pg.evaluate(s=>{ const e=document.querySelector(s); return e?e.textContent:''; }, sel);

  // ══ ① 네 곳에 다 찾기 칸이 있다 ═════════════════════════════════════
  for(const [sub, 이름] of [['gear','장비'],['maint','정기점검'],['repair','수리'],['mlog','정비수첩']]){
    await 켜기(sub);
    T('★★★ ' + 이름 + ' 에 찾기 칸이 있다', await 칸(sub));
  }

  // ══ ② 장비 — 이름·제조사·모델로 걸린다 ══════════════════════════════
  await 켜기('gear');
  const 장비전 = await 줄수('#gearList .mr');
  await 찾기('gear', '해수'); await pg.waitForTimeout(200);
  T('★★★ 장비를 이름으로 찾는다', (await 줄수('#gearList .mr')) === 1, await 줄수('#gearList .mr'));
  await 찾기('gear', 'lewmar'); await pg.waitForTimeout(200);
  T('★★★ 제조사로도 찾는다 (대소문자 상관없이)', (await 줄수('#gearList .mr')) === 1);
  await 찾기('gear', '50840'); await pg.waitForTimeout(200);
  T('★★★ 모델 번호로도 찾는다', (await 줄수('#gearList .mr')) === 1);
  await 찾기('gear', '없는것'); await pg.waitForTimeout(200);
  T('★★★ 없으면 「검색 결과 없음」', /검색 결과 없음/.test(await 글('#gearList')));
  await 찾기('gear', ''); await pg.waitForTimeout(200);
  T('★★ 비우면 다 돌아온다', (await 줄수('#gearList .mr')) === 장비전, [await 줄수('#gearList .mr'), 장비전]);

  // ══ ③ 정기점검 ══════════════════════════════════════════════════════
  await 켜기('maint');
  await 찾기('maint', '임펠러'); await pg.waitForTimeout(200);
  T('★★★ 정기점검을 찾는다', (await 줄수('#maintList .mr')) === 1, await 줄수('#maintList .mr'));
  await 찾기('maint', '아연'); await pg.waitForTimeout(200);
  T('★★ 다른 것도 찾는다', /아연/.test(await 글('#maintList')));
  await 찾기('maint', ''); await pg.waitForTimeout(200);

  // ══ ④ 수리 — 완료된 것도 함께 걸린다 ════════════════════════════════
  await 켜기('repair');
  await 찾기('repair', '윈들러스'); await pg.waitForTimeout(200);
  T('★★★ 수리를 제목으로 찾는다', /윈들러스/.test(await 글('#repairList')));
  await 찾기('repair', '모터'); await pg.waitForTimeout(200);
  T('★★★ 적어 둔 메모로도 찾는다', /윈들러스/.test(await 글('#repairList')));
  await 찾기('repair', '누수'); await pg.waitForTimeout(200);
  T('★★★ 완료된 수리도 걸린다', /누수/.test(await 글('#repairList')), await 글('#repairList'));
  await 찾기('repair', ''); await pg.waitForTimeout(200);

  // ══ ⑤ 정비수첩 ══════════════════════════════════════════════════════
  await 켜기('mlog');
  await 찾기('mlog', 'jabsco'); await pg.waitForTimeout(200);
  T('★★★ 정비수첩을 적어 둔 것으로 찾는다', /임펠러/.test(await 글('#mlogList')));
  await 찾기('mlog', '배터리'); await pg.waitForTimeout(200);
  T('★★ 제목으로도 찾는다', /배터리/.test(await 글('#mlogList')));
  await 찾기('mlog', ''); await pg.waitForTimeout(200);

  // ══ ⑥ 띄어쓰기로 좁힌다 ═════════════════════════════════════════════
  await 켜기('maint');
  await 찾기('maint', '임펠러 교체'); await pg.waitForTimeout(200);
  T('★★★ 두 낱말을 다 가진 것만 걸린다', (await 줄수('#maintList .mr')) === 1);
  await 찾기('maint', '임펠러 아연'); await pg.waitForTimeout(200);
  T('★★★ 둘 다 가진 것이 없으면 안 걸린다', /검색 결과 없음/.test(await 글('#maintList')));
  // ★ 차례가 뒤바뀌어도 걸려야 한다 — 사람은 적힌 순서대로 안 친다
  await 찾기('maint', '교체 임펠러'); await pg.waitForTimeout(200);
  T('★★★ 낱말 차례가 뒤바뀌어도 걸린다', (await 줄수('#maintList .mr')) === 1,
    await 글('#maintList'));
  await 찾기('maint', ''); await pg.waitForTimeout(200);

  // ══ ⑦ 매인 장비 이름으로도 걸린다 ═══════════════════════════════════
  await 켜기('maint');
  await 찾기('maint', '해수펌프'); await pg.waitForTimeout(200);
  T('★★★ 매인 장비 이름으로도 정기점검이 걸린다',
    /임펠러/.test(await 글('#maintList')), await 글('#maintList'));
  await 찾기('maint', ''); await pg.waitForTimeout(200);

  // ══ ⑦-2 접어 둔 계통도 찾는 중에는 펼친다 ══════════════════════════
  await 켜기('gear');
  const 접힘 = await pg.evaluate(async ()=>{
    // 「추진」 계통을 접어 둔다
    localStorage.setItem('bt_gfold_gear', JSON.stringify({ '추진': true }));
    renderGear();
    const 접은뒤 = /해수펌프/.test(document.getElementById('gearList').textContent);
    mrFindSet('gear', '해수');
    await new Promise(r=>setTimeout(r,150));
    const 찾은뒤 = /해수펌프/.test(document.getElementById('gearList').textContent);
    mrFindSet('gear', '');
    localStorage.removeItem('bt_gfold_gear'); renderGear();
    return { 접은뒤, 찾은뒤 };
  });
  T('★★ 접어 두면 안 보인다 (원래 그렇다)', 접힘.접은뒤 === false, 접힘);
  T('★★★ 찾는 중에는 접어 둔 계통도 펼쳐서 보여 준다', 접힘.찾은뒤 === true, 접힘);

  // ══ ⑧ 인터넷을 안 쓴다 ══════════════════════════════════════════════
  const 부름 = await pg.evaluate(async ()=>{
    let n = 0; const 원래 = window.fetch;
    window.fetch = (...a)=>{ n++; return 원래(...a); };
    mrFindSet('gear', '해수'); mrFindSet('gear', '');
    await new Promise(r=>setTimeout(r,200));
    window.fetch = 원래; return n;
  });
  T('★★★ 찾을 때 인터넷을 안 쓴다 (바다에서도 된다)', 부름 === 0, 부름);

  T('★ 화면 오류가 없다', errs.length === 0, errs);
  console.log('\n통과 '+ok+' · 실패 '+bad);
  await br.close(); server.close(); process.exit(bad?1:0);
})();
