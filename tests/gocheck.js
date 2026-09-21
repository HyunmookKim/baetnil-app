// 4.98 — 오늘 화면의 단추가 진짜 그 자리로 가는가 (라이브)
//
// ★ 사장님 지적 — 「곧 해야 할 정비」 의 「정비 탭」 을 누르면 수리 쪽이 열린다
//
// ★ 까닭 — 4.84 에 정기점검이 「정비」 통에서 「장비」 통으로 옮겨 갔는데
//   단추는 여태 goMaint('maint') 를 부르고 있었다. MNT_SUBS 에 'maint' 가 없으니
//   조용히 다른 갈래로 떨어졌다.
//   ★ 조용히 떨어지는 것이 제일 나쁘다 — 누른 사람은 앱이 이상하다고만 생각한다.
//
// ★ 그래서 이 검사는 글자를 안 본다. **눌러 보고 어디가 열렸는지 본다.**
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const FILE = process.argv[2] || '../../work.html';
const server = http.createServer((rq,rs)=>{
  const f = rq.url === '/' ? path.resolve(FILE) : path.join(path.dirname(path.resolve(FILE)), rq.url.split('?')[0]);
  fs.readFile(f,(e,d)=>{ if(e){ rs.writeHead(404); rs.end(); return; } rs.writeHead(200); rs.end(d); });
});
let ok = 0, bad = 0;
const T = (n,c,w)=>{ if(c){ ok++; console.log('통과: '+n); } else { bad++; console.log('★ 실패: '+n+(w!==undefined?' — '+JSON.stringify(w).slice(0,200):'')); } };

(async()=>{
  await new Promise(r=>server.listen(0,r));
  const br = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await br.newContext({ locale:'ko-KR', viewport:{width:390,height:844}, isMobile:true, hasTouch:true });
  const pg = await ctx.newPage();
  const errs = []; pg.on('console', m=>{ if(m.type()==='error') errs.push(m.text().slice(0,120)); });
  await pg.goto('http://127.0.0.1:'+server.address().port+'/', { waitUntil:'networkidle' });
  await pg.waitForTimeout(1200);

  await pg.evaluate(()=>{
    try{ skipWelcome(); }catch(_){}
    window.__user = { uid:'U1', name:'김명준' }; try{ me = window.__user; }catch(_){}
    boats = [{ id:'B1', name:'현묵호', type:'sail', lat:34.76, lon:127.66 }];
    try{ seedRanks(boats[0]); boats[0].members = { U1: ownerRank(boats[0]).id }; }catch(_){}
    currentBoatId = 'B1'; window.currentBoatId = 'B1'; unlocked = true;
    // 밀린 정기점검 하나 · 고장 하나
    maint = [{ id:'k1', typ:'chk', name:'엔진오일 및 필터 교채', months:6, unit:'m', lastDate:'2025-01-01' }];
    repair = [{ id:'r1', typ:'repair', title:'빌지펌프 고장', status:'open', created:'2026-08-01' }];
    try{ save(); saveMR(); }catch(_){}
    // 어디에 있는지 늘 다른 데서 시작한다 (그래야 진짜 옮겨 갔는지 보인다)
    try{ boatSubTab = 'stow'; gearView = 'gear'; mntSub = 'fuel'; }catch(_){}
    try{ switchTab('home'); renderHome(); }catch(e){ console.error('E '+e.message); }
  });
  await pg.waitForTimeout(700);

  const 어디 = () => pg.evaluate(()=>({
    tab: (typeof curTab !== 'undefined') ? curTab : '',
    boat: (typeof boatSubTab !== 'undefined') ? boatSubTab : '',
    gear: (typeof gearView !== 'undefined') ? gearView : '',
    mnt:  (typeof mntSub !== 'undefined') ? mntSub : ''
  }));

  // ── ① 「곧 해야 할 정비」 카드가 실제로 떠 있는가
  const 카드 = await pg.evaluate(()=>{
    const el = document.getElementById('homeList');
    return el ? el.innerText : '';
  });
  T('오늘 화면에 「곧 해야 할 정비」 카드가 뜬다', 카드.indexOf('곧 해야 할 정비') >= 0, 카드.slice(0,200));
  T('밀린 항목 이름이 보인다', 카드.indexOf('엔진오일') >= 0, 카드.slice(0,300));

  // ── ② ★★★ 단추를 진짜 눌러 본다
  const 눌림 = await pg.evaluate(()=>{
    const bs = [...document.querySelectorAll('#homeList button, #homeList .hbtn, #homeList a')];
    const b = bs.find(x => /정기점검|정비 탭/.test(x.textContent || ''));
    if(!b) return { ok:false, names: bs.map(x=>x.textContent.trim()).slice(0,8) };
    b.click();
    return { ok:true, label: b.textContent.trim() };
  });
  T('그 카드에 눌러서 갈 단추가 있다 — ' + (눌림.label || ''), 눌림.ok, 눌림.names);
  await pg.waitForTimeout(700);
  const 간곳 = await 어디();
  T('★★★ 「내 배」 로 간다', 간곳.tab === 'boat', 간곳);
  T('★★★ 「장비」 통으로 간다', 간곳.boat === 'gear', 간곳);
  T('★★★ 「정기점검」 이 열린다 (수리·정비수첩이 아니다)', 간곳.gear === 'maint', 간곳);

  // ── ③ 화면에도 정기점검이 보이는가 (값만 바꾸고 안 그리면 소용없다)
  const 화면 = await pg.evaluate(()=> document.body.innerText.slice(0, 1200));
  T('★★ 화면에 그 항목이 실제로 보인다', 화면.indexOf('엔진오일') >= 0, 화면.slice(0,300));

  // ── ④ 「고쳐야 할 곳」 단추는 수리로 간다 (이건 원래 맞았다 — 고치다 깨뜨리지 않았는지)
  await pg.evaluate(()=>{ try{ switchTab('home'); renderHome(); }catch(_){} });
  await pg.waitForTimeout(600);
  const 눌림2 = await pg.evaluate(()=>{
    const b = [...document.querySelectorAll('#homeList button, #homeList .hbtn, #homeList a')]
      // ★ 4.99 — 단추 이름이 「수리 탭」 → 「수리」 로 바뀌었다 (「탭」 은 앱 만드는 사람 말이다).
      //   옛 이름으로만 찾으면, 이름이 바뀐 것을 「단추가 없어졌다」 고 한다.
      .find(x => /^수리( 탭)?$/.test((x.textContent || '').trim()));
    if(!b) return false; b.click(); return true;
  });
  T('「고쳐야 할 곳」 에 수리로 가는 단추가 있다', 눌림2);
  await pg.waitForTimeout(700);
  const 간곳2 = await 어디();
  T('★★ 수리 단추는 「정비」 통의 수리로 간다', 간곳2.boat === 'maint' && 간곳2.mnt === 'repair', 간곳2);

  // ★ 인터넷이 막힌 방이라 파이어베이스·아이콘 받기가 실패한다. 그건 앱 잘못이 아니다.
  //   진짜 터짐(이름을 못 찾음 · 함수가 아님)만 본다.
  // ★ 이 통(컨테이너)은 바깥 인터넷이 막혀 있다. 파이어베이스·글꼴·지도 타일을 못 받는다.
  //   그때 나는 「Failed to fetch dynamically imported module」 은 앱 잘못이 아니다.
  //   그것까지 실패로 세면 진짜 사고를 못 본다 — 빨간 것이 늘 빨가면 안 보게 된다.
  const 바깥탓 = /Failed to fetch|gstatic\.com|firebasejs|openstreetmap|openseamap|favicon|ERR_/;
  const 진짜 = errs.filter(x => /ReferenceError|TypeError|is not a function|is not defined/.test(x))
                  .filter(x => !바깥탓.test(x));
  T('★ 누르는 동안 앱이 안 터졌다', 진짜.length === 0, 진짜.slice(0,3));

  console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
  await br.close(); server.close();
  process.exit(bad ? 1 : 0);
})();
