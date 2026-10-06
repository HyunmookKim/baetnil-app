// 5.18 — 보기 전용이면 손대는 단추가 화면에 없어야 한다 (사장님 지적 2026-09-27)
//   「이거 보기전용인데 버튼 왜 다 살아있냐」 — 회원명부에 기록·등급·내보내기가 그대로 있었다.
//   화면마다 따로 막다 보니 몇 곳은 감추고 몇 곳은 눌러야 막혔다.
// ★ 이 검사가 하는 일
//   ① 소스에서 '보기 전용이면 막히는 함수' 를 다 모은다 (guardEdit/needEdit, if(!unlocked) return …)
//   ② 보기 전용으로 두고 화면을 하나씩 연다
//   ③ 눈에 보이는 단추·칸이 그 함수를 부르면 실패
//   ④ 글을 쓰는 칸(입력칸)이 보이면 실패 — 보내는 단추가 없어도 칸이 있으면 쓰는 줄 안다
//   사용: node lockhidelive.js ../www/index.html [사진폴더]
const { chromium } = require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const FILE=path.resolve(process.argv[2]||'../www/index.html'), ROOT=path.dirname(FILE), MAIN=path.basename(FILE);
const SHOTS=process.argv[3]||'';
const SRC=fs.readFileSync(FILE,'utf8');
const srv=http.createServer((q,r)=>{const u=q.url.split('?')[0];fs.readFile(path.join(ROOT,u==='/'?MAIN:u),(e,d)=>{if(e){r.writeHead(404);r.end();return;}r.writeHead(200,{'Content-Type':/\.js$/.test(u)?'text/javascript':'text/html'});r.end(d);});});
let ok=0,bad=0;
const T=(n,c,w)=>{ if(c){ok++;console.log('통과: '+n);} else {bad++;console.log('★ 실패: '+n+(w!==undefined?' — '+JSON.stringify(w).slice(0,600):''));} };

// ① 막히는 함수 모으기 — 함수 첫 여덟 줄 안에서 보기 전용을 막는 것
function blockedFns(){
  const L=SRC.split('\n'); const out=new Set();
  for(let i=0;i<L.length;i++){
    const m=L[i].match(/^\s*(?:async\s+)?function\s+(\w+)\s*\(/); if(!m) continue;
    let j=i+1; while(j<L.length && j<i+8 && !/^\s*(?:async\s+)?function\s+\w+\s*\(/.test(L[j])) j++;
    const head=L.slice(i,j).join('\n');
    if(/\bguardEdit\(|\bneedEdit\(|!\s*unlocked\s*\)\s*(?:\{|return)|\|\|\s*!unlocked\)\s*return|lkCanEdit\(|shCanEdit\(/.test(head)
       && !/^\s*(?:async\s+)?function\s+(guardEdit|needEdit|lkCanEdit|shCanEdit|save|schedulePush|pushNow|cloudSeedCheck|cloudPull|toggleLock|applyLock)\b/.test(L[i]))
      out.add(m[1]);
  }
  return [...out];
}
const BLOCKED=blockedFns();
// 보기 전용이어도 되는 것 — 까닭을 적어 둔다
//   (설정 안 일은 보기 전용과 상관없다 — 사장님 2026-09-27 「설정까지 들어갔다는 건 이미 고칠 마음을 먹은 것」)
const ALLOW=new Set(['drawerRestore','restoreData','editGo','startGoCheck']);
// ★★ 5.42 — 막는 줄이 아예 없는데 기록을 저장하는 함수도 모은다 (사장님 지적 2026-10-06 「이 두버튼은 왜 보기전용인데 안사라지냐?」
//   — 연료 「계산값으로 되돌리기」 두 개). 위 BLOCKED 는 막는 줄이 있는 함수만 봐서, 막는 줄을 빠뜨린 함수는 이 검사를 그냥 지났다.
//   함수 몸 전체에서 save()·saveMR()·saveLocal()·fuelSetPut()·saveBoatCloud() 를 부르는데 막는 줄이 없으면 「저장하는 함수」 로 본다.
function saverFns(){
  const L=SRC.split('\n'); const out=new Set();
  for(let i=0;i<L.length;i++){
    const m=L[i].match(/^(?:async\s+)?function\s+(\w+)\s*\(/); if(!m) continue;
    let j=i+1; while(j<L.length && !/^(?:async\s+)?function\s+\w+\s*\(|^\}/.test(L[j])) j++;
    const body=L.slice(i,j+1).join('\n');
    if(/\b(?:saveMR|saveLocal|fuelSetPut|saveBoatCloud)\(|\bsave\(\)/.test(body)
       && !/\bguardEdit\(|\bneedEdit\(|!\s*unlocked\b|lkCanEdit\(|shCanEdit\(|pushFree|saveFree|saveMRFree/.test(body))
      out.add(m[1]);
  }
  return [...out];
}
// 보기 전용이어도 저장해도 되는 것 — 형식 고치기·기기 설정 따위(기록 내용을 안 바꾼다). 까닭을 적는다.
const SAVE_OK=new Set(['save','saveMR','saveLocal','fuelSetPut','saveBoatCloud','sysSave','migrateVoyage','skipWelcome','setLang','setTheme','setFontSize',
  'calPick','calMove','calToday','setHomeSub','switchTab','toggleLock','applyLock','renderFuel','renderVoyage','openMR','closeMR',
  'toggleLike']);   // 「도움됐어요」 는 읽는 사람의 반응이다 — 배 기록을 안 바꾼다
const SAVERS=saverFns().filter(f=>!SAVE_OK.has(f));

(async()=>{
  await new Promise(r=>srv.listen(0,r));
  const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const ctx=await br.newContext({locale:'ko-KR',viewport:{width:412,height:924},deviceScaleFactor:1,isMobile:true,hasTouch:true});
  await ctx.route(/googleapis|gstatic|firebaseio|open-meteo|firestore|youtube|khoa|kma/,r=>r.abort());
  await ctx.addInitScript(()=>{ try{ localStorage.setItem('bt_setup','done'); localStorage.setItem('bt_welcome','done'); localStorage.setItem('bt_agree', JSON.stringify({v:'x'})); }catch(_){} });
  const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(String(e)));
  pg.on('dialog',d=>d.dismiss().catch(()=>{}));
  await pg.goto('http://127.0.0.1:'+srv.address().port+'/');
  await pg.waitForFunction(()=>typeof openRoster==='function');
  await pg.waitForTimeout(800);
  T('막히는 함수를 모았다 (40개 넘게)', BLOCKED.length>40, BLOCKED.length);

  // ② 배 하나에 사람 셋 — 나는 선주
  await pg.evaluate(()=>{
    try{ skipWelcome(); }catch(_){}
    window.__user={uid:'U1',name:'현묵',email:'a@b.c'}; try{ me=window.__user; }catch(_){}
    boats=[{ id:'B1', name:'SUNSHINE', type:'sail', lat:34.72, lon:127.68, port:'여수 원형 마리나', spec:{loa:13.7,fuelTank:240},
             intro:[{k:'text',v:'소개글'}], openJoin:true }];
    const b=boats[0]; seedRanks(b);
    const own=ownerRank(b).id, oth=(rankList(b).find(r=>r.id!==own)||{}).id||own;
    b.members={U1:own,U2:oth,U3:oth}; b.memberNames={U1:'현묵',U2:'김재운',U3:'문정희'};
    window.__invites=Object.assign({},window.__invites||{},{ pending: async()=>[{id:'j1',uid:'U9',name:'신청자',boatId:'B1',at:Date.now(),status:'pending'}] });
    currentBoatId='B1'; window.currentBoatId='B1';
    maint=[{id:'k1',typ:'chk',name:'엔진오일 교체',months:6,unit:'m',lastDate:'2025-01-01'},
           {id:'g1',typ:'gear',name:'얀마 엔진',maker:'Yanmar',model:'4JH',where:'기관실'},
           {id:'m1',typ:'mlog',title:'임펠러 교체',date:'2026-08-01',how:[{k:'text',v:'1단계'}]}];
    repair=[{id:'r1',typ:'repair',title:'빌지펌프 고장',status:'open',created:'2026-08-01'}];
    voyage=[{id:'v1',title:'여수→거문도',date:'2026-08-02',from:'여수',to:'거문도',crew:['U1','U2']}];
    fuel=[{id:'f1',date:'2026-03-01',liters:180,full:true,cost:320000}];
    runs=[{id:'rn1',date:'2026-02-01',hours:6,purpose:'항해'},{id:'rn2',date:new Date().toISOString().slice(0,10),on:true,start:'00:10',purpose:'항해'}];
    talkList=[{id:'t1',title:'질문',body:'엔진 소리',by:'U1',byName:'현묵',ts:'2026-09-01',kind:'chat'}];
    window.__cmt={list:async()=>[{id:'c1',by:'U1',byName:'현묵',text:'댓글',ts:'2026-09-02'}],add:async()=>{},del:async()=>{}};
    contacts=[{id:'c1',name:'정비소',phone:'010'}]; vdocs=[{id:'d1',title:'선박검사증'}];
    // 5.42 — 연료 안내 글의 「계산값으로 되돌리기」 두 개가 뜨게: L/시간을 직접 입력 + 잔량 확인 기록
    fuel.push({id:'f2',date:'2026-09-30',time:'10:00',kind:'level',level:0});
    scheds=[{id:'s1',title:'선저 청소',date:'2026-10-10',time:'09:00',rep:'w',note:''}];   // 5.41 일정
    try{ fuelSetPut({ lph: 7.2 }); }catch(_){}
    items=[{id:'i1',name:'구명조끼',qty:6,lockerId:'L1',photos:[]}];
    lockers=[{id:'L1',name:'선수 창고',x:10,y:10,w:50,h:30}];
    posts=[{id:'p1',title:'공지',body:'내일 출항',author:'U2',authorName:'김재운',at:Date.now(),comments:[{id:'cm1',uid:'U2',name:'김재운',text:'네',at:Date.now()}]}];
    try{ saveLocal(); }catch(_){}
    unlocked=false; try{ localStorage.setItem('bt_unlocked','0'); }catch(_){} applyLock();
  });

  const SCREENS=[
    ['계류장 기본정보', ()=>openBoat('info')],
    ['계류장 제원', ()=>openBoat('spec')],
    ['계류장 배소개', ()=>openBoat('intro')],
    ['회원명부', ()=>openRoster()],
    ['등급 설정', ()=>openRanks()],
    ['게시판', ()=>openBoard()],
    ['게시판 글', ()=>openPost('p1')],
    ['할일', ()=>openMyTasks()],
    ['참여신청', ()=>openJoinReqs()],
    ['공개설정', ()=>openPublish()],
    ['소개 페이지', ()=>openIntro()],
    ['배 목록', ()=>openFleet()],
    ['오늘', ()=>{ homeSub='today'; switchTab('home'); }],
    ['달력', ()=>{ homeSub='cal'; switchTab('home'); }],
    ['점검표', ()=>{ homeSub='check'; switchTab('home'); }],
    ['날씨', ()=>{ homeSub='weather'; switchTab('home'); }],
    ['적재', ()=>{ boatSubTab='stow'; switchTab('boat'); }],
    ['정비수첩', ()=>{ boatSubTab='maint'; mntSub='mlog'; switchTab('boat'); }],
    ['수리', ()=>{ boatSubTab='maint'; mntSub='repair'; switchTab('boat'); }],
    ['연료', ()=>{ boatSubTab='maint'; mntSub='fuel'; switchTab('boat'); }],
    ['장비', ()=>{ boatSubTab='gear'; gearView='maint'; switchTab('boat'); }],
    ['장비 리뷰', ()=>{ boatSubTab='gear'; gearView='review'; switchTab('boat'); }],
    ['항해', ()=>{ boatSubTab='voyage'; switchTab('boat'); }],
    ['문서', ()=>{ boatSubTab='docs'; switchTab('boat'); }],
    ['정기점검 기록', ()=>openMR('maint','k1')],
    ['장비 기록', ()=>openMR('gear','g1')],
    ['정비수첩 기록', ()=>openMR('mlog','m1')],
    ['수리 기록', ()=>openMR('repair','r1')],
    ['항해 기록', ()=>openMR('voyage','v1')],
    ['주유 기록', ()=>openMR('fuel','f1')],
    ['엔진 가동 기록', ()=>openMR('run','rn1')],
    ['연락처 기록', ()=>openMR('contact','c1')],
    ['문서 기록', ()=>openMR('vdoc','d1')],
    ['일정 기록 (5.41)', ()=>openMR('sched','s1')],
    ['칸 열기', ()=>openLocker('L1')],
    ['물품 열기', ()=>openItem('i1')],
    ['휴지통', ()=>openTrash()],
    ['엔진 가동 중 기록', ()=>openMR('run','rn2')],
    ['등급 고치기', ()=>{ const b=curBoat(); editRankUI(rankList(b).find(r=>!r.owner).id); }],
    ['커뮤니티 글', ()=>openTalk('t1')],
    ['정박지', ()=>openSpot(spotsAll()[0].id)],
    ['설정', ()=>openSettings()],
  ];
  const found=[];
  for(const [name,fn] of SCREENS){
    let err=null;
    // 앞 화면이 띄운 물음창(위치 동의 따위)은 닫고 간다
    await pg.evaluate(()=>{ const o=document.getElementById('tellOv'); if(o && o.classList.contains('open')){ const b=[...o.querySelectorAll('button')].find(x=>/닫기|취소|아니/.test(x.textContent)); if(b) b.click(); } });
    try{ await pg.evaluate(fn); }catch(e){ err=String(e).slice(0,160); }
    await pg.waitForTimeout(350);
    if(err){ console.log('  (열지 못함) '+name+' — '+err); continue; }
    const r=await pg.evaluate(([BL,AL,SV])=>{
      const bl=new Set(BL), al=new Set(AL), sv=new Set(SV);
      const vis=e=>{ if(!e.getClientRects().length) return false; const s=getComputedStyle(e); return s.visibility!=='hidden' && s.display!=='none' && s.pointerEvents!=='none' && parseFloat(s.opacity||'1')>0.05; };
      const hits=[];
      document.querySelectorAll('[onclick],[onchange],[oninput]').forEach(e=>{
        if(!vis(e)) return;
        if(e.closest('#drawer, #tabbar, .modal, #askOv, #formOv')) return;
        const code=(e.getAttribute('onclick')||'')+' '+(e.getAttribute('onchange')||'')+' '+(e.getAttribute('oninput')||'');
        const fns=(code.match(/[A-Za-z_$][\w$]*(?=\s*\()/g)||[]);
        const bad=fns.filter(f=>(bl.has(f)||sv.has(f)||f==='needEdit'||f==='guardEdit') && !al.has(f));
        if(bad.length) hits.push((e.textContent||e.value||e.placeholder||e.tagName).trim().slice(0,24)+' → '+bad.join(','));
      });
      // 쓰는 칸
      document.querySelectorAll('#mrPanel input, #mrPanel textarea, #mrPanel select, main input, main textarea, main select').forEach(e=>{
        if(!vis(e) || e.disabled || e.readOnly || e.type==='hidden' || e.type==='file' || e.type==='search') return;
        if(/검색|찾기|search/i.test((e.placeholder||'')+' '+(e.id||'')+' '+(e.className||''))) return;
        if(e.closest('.filt, .srch, .search, .setrow')) return;
        hits.push('입력칸 '+(e.id||e.placeholder||e.name||e.tagName).toString().slice(0,24));
      });
      // 머리줄 할 일 묶음(actSet) — 보기 전용인데 막히는 일을 부르는 것이 남아 있으면 실패
      try{ (typeof ACT_LIST!=='undefined' ? ACT_LIST : []).forEach(a=>{
        const code=String(a.run);
        const fns=(code.match(/[A-Za-z_$][\w$]*(?=\s*\()/g)||[]);
        const bad=fns.filter(f=>(bl.has(f)||f==='needEdit'||f==='guardEdit') && !al.has(f));
        if(bad.length && document.querySelector('.acthead') && document.querySelector('.acthead').getClientRects().length) hits.push('머리줄 「'+a.name+'」 → '+bad.join(','));
      }); }catch(_){}
      return [...new Set(hits)];
    },[BLOCKED,[...ALLOW],SAVERS]);
    if(SHOTS) await pg.screenshot({path:path.join(SHOTS,'lk_'+name.replace(/\s/g,'_')+'.png')});
    T(name+' — 보기 전용인데 손대는 단추·칸이 없다', r.length===0, r);
  }
  // ③ 거꾸로 — 편집 중이면 단추가 다 있어야 한다 (감추다 못해 아예 없애 버리면 안 된다)
  await pg.evaluate(()=>{ toggleLock(); });
  const cnt=async(fn,re)=>{ await pg.evaluate(fn); await pg.waitForTimeout(300);
    return pg.evaluate(re=>[...document.querySelectorAll('#mrPanel button')].filter(b=>b.getClientRects().length && new RegExp(re).test(b.textContent)).length, re); };
  T('편집 중 — 회원명부에 기록·등급·내보내기가 있다', await cnt(()=>openRoster(),'^(기록|등급|내보내기)$')>=6);
  T('편집 중 — 공개설정에 켜기·끄기가 다 있다', await cnt(()=>openPublish(),'^(켜기|끄기)$')>=4);
  T('편집 중 — 게시판에 글쓰기가 있다', await cnt(()=>openBoard(),'글쓰기')>=1);
  T('편집 중 — 기본정보에 영업 배·신청 받기 단추가 있다', await cnt(()=>openBoat('info'),'^(영업용으로 전환|개인용으로 전환|닫기|열기)$')>=2);
  // ④ 보기 전용에서 배 등록하기는 보이고, 누르면 편집 중으로 넘어간다
  await pg.evaluate(()=>{ if(unlocked) toggleLock(); openBoat('info'); window.__ab=0; window.addBoat=function(){ window.__ab++; }; });
  await pg.waitForTimeout(300);
  const ab=await pg.evaluate(()=>{ const b=[...document.querySelectorAll('#mrPanel button')].find(x=>/배 등록하기/.test(x.textContent)); if(!b||!b.getClientRects().length) return 'no-btn'; b.click(); return {n:window.__ab, un:unlocked}; });
  T('보기 전용 — 배 등록하기는 보이고 누르면 바로 편집 중으로 넘어가 등록을 시작한다', ab && ab.n===1 && ab.un===true, ab);
  T('화면 여는 동안 오류 없음', errs.length===0, errs.slice(0,3));
  console.log('\n통과 '+ok+' · 실패 '+bad);
  await br.close(); srv.close(); process.exit(bad?1:0);
})();
