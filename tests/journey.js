// ★ 처음 오는 사람의 길 — 끝에서 끝까지 실제로 눌러 본다
//
// 왜 이 검사가 따로 필요한가
//   지금까지 이 앱은 만든 사람 혼자, 배 한 척으로만 돌았다.
//   앱을 처음 켠 사람이 밟는 길 — 열고 · 배 만들고 · 도면 고르고 · 칸 그리고 ·
//   물품 넣고 · 사진 찍고 — 이 전체가 한 번도 끝까지 검증된 적이 없다.
//   광고로 들어온 사람은 그 길만 밟는다.
//
// 다른 검사들과 다른 점: 함수를 불러 보는 것이 아니라 '화면에 있는 것을 누른다'.
// 단추가 없거나, 눌러도 아무 일이 없거나, 눌렀더니 터지는 것을 잡는다.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
// ★ 넘겨받은 파일을 본다. 검사 폴더에 남은 옛 work.html 을 보면 안 된다.
//   실제로 4.44 에서 이 검사가 4.41 짜리 옛 파일을 보고 「다 지났다」고 했다.
const __ARG  = process.argv[2];
const __BASE = __ARG ? require('path').dirname(require('path').resolve(__ARG)) : __dirname;
const __MAIN = __ARG ? require('path').basename(__ARG) : 'work.html';

const server = http.createServer((rq, rs) => {
  const f = path.join(__BASE, rq.url === '/' ? __MAIN : rq.url.split('?')[0]);
  fs.readFile(f, (e, d) => {
    if(e){ rs.writeHead(404); rs.end(); return; }
    const ct = f.endsWith('.js') ? 'text/javascript'
             : f.endsWith('.webmanifest') ? 'application/manifest+json'
             : f.endsWith('.png') ? 'image/png' : 'text/html';
    rs.writeHead(200, { 'Content-Type': ct });
    rs.end(d);
  });
});

const 결과 = [];
let 실패 = 0;
function 적기(단계, 결말, 메모){
  결과.push({ 단계, 결말, 메모: String(memoCut(메모)) });
  if(결말 === '★막힘') 실패++;
  console.log((결말 === '★막힘' ? '★막힘  ' : '지남   ') + 단계 + (메모 ? ' — ' + memoCut(메모) : ''));
}
function memoCut(m){ m = String(m == null ? '' : m); return m.length > 160 ? m.slice(0,160) + '…' : m; }

(async () => {
  await new Promise(r => server.listen(8720, r));
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ locale:'ko-KR', viewport: { width: 390, height: 844 },
    permissions: [], locale: 'ko-KR' });
  const p = await ctx.newPage();

  const 터짐 = [], 콘솔 = [];
  p.on('pageerror', e => 터짐.push(String(e.message)));
  p.on('console', m => { if(m.type() === 'error') 콘솔.push(m.text().slice(0,200)); });

  // 사람이 누를 만한 것을 글자로 찾는다.
  // ★ 판(mrPanel)이 열려 있으면 그 안에서만 찾는다.
  //   안 그러면 판 뒤에 남아 있는 옛 화면의 단추를 눌러 버린다 — 사람은 그럴 수 없다.
  const 누르기 = async (글자, 초 = 3, 딱맞게) => {
    const 판열림 = await p.evaluate(()=>{
      const P = document.getElementById('mrPanel');
      return !!(P && (P.classList.contains('open') || (P.offsetParent && P.innerHTML.length > 40)));
    });
    const 앞 = 판열림 ? '#mrPanel ' : '';
    const t = 딱맞게 ? `:text-is("${글자}")` : `:has-text("${글자}")`;
    // ★ 숨은 단추를 집어 놓고 '없다' 고 하면 안 된다. 보이는 것만 고른다.
    let el = p.locator(`${앞}button:visible${t}`).first();
    try{ await el.waitFor({ state:'visible', timeout: 초 * 1000 }); }
    catch(_){
      el = p.locator(`button:visible${t}, .ditem:visible${t}, .tab:visible${t}`).first();
      try{ await el.waitFor({ state:'visible', timeout: 1500 }); }catch(_){ return false; }
    }
    try{ await el.click({ timeout: 2500 }); await p.waitForTimeout(400); return true; }
    catch(_){ return false; }
  };
  const 보이나 = async (글자) => {
    try{ return await p.locator(`text=${글자}`).first().isVisible({ timeout: 1500 }); }
    catch(_){ return false; }
  };
  const 화면글 = async () => {
    try{ return (await p.locator('body').innerText()).replace(/\n+/g, ' / '); }catch(_){ return ''; }
  };

  // ── 1. 처음 열기
  await p.goto('http://localhost:8720/' + __MAIN + '');
  await p.waitForTimeout(3000);
  적기('앱이 열린다', (await 화면글()).length > 20 ? '지남' : '★막힘', (await 화면글()).slice(0,120));
  await p.screenshot({ path: 'j01_first.png' });

  적기('첫 화면에 이게 무슨 앱인지 나온다',
    (await 보이나('물품')) || (await 보이나('배')) ? '지남' : '★막힘', await 화면글());

  // ── 1.5 첫 설정 — 말과 나라를 고른다 (4.102, 사장님이 정하신 것 14)
  //   ★ 처음 깐 사람이 제일 먼저 만나는 화면이다. 여기서 막히면 아무 데도 못 간다.
  {
    const 설정보임 = await 보이나('처음 오셨습니다');
    적기('처음 오면 말·나라부터 고르게 한다', 설정보임 ? '지남' : '★막힘', (await 화면글()).slice(0,140));
    if(설정보임){
      // 브라우저 말이 한국어면 「한국어」 는 이미 [고름] 이다. 나라만 고르고 시작한다.
      const 나라 = await p.evaluate(() => {
        const b = [...document.querySelectorAll('#mrPanel .mrrow')]
          // ★ 5.6 — 나라 이름은 「대한민국」 이다. 「한국」 으로 찾고 있어 늘 못 찾았다.
          .find(r => /^대한민국$/.test((r.querySelector('.mrm')||{}).textContent||''));
        const btn = b && b.querySelector('button');
        if(btn){ btn.click(); return true; }
        return false;
      });
      적기('나라를 고를 수 있다', 나라 ? '지남' : '★막힘', await 화면글());
      await p.waitForTimeout(200);
      const 시작 = await 누르기('시작하기', 3, true);
      적기('★★★ [시작하기] 로 첫 설정을 마친다', 시작 ? '지남' : '★막힘', (await 화면글()).slice(0,140));
      await p.waitForTimeout(500);
    }
  }

  // ── 2. 로그인 없이 시작할 수 있나 (광고로 들어온 사람 대부분은 바로 가입 안 한다)
  const 나중 = await 누르기('나중에 하기');
  적기('로그인 없이 시작할 수 있다', 나중 ? '지남' : '★막힘',
    나중 ? '' : '[나중에 하기] 를 못 찾았다: ' + (await 화면글()).slice(0,140));
  await p.waitForTimeout(600);
  await p.screenshot({ path: 'j02_home.png' });

  // ── 3. 배 등록
  let 배등록 = await 누르기('등록하기');
  if(!배등록) 배등록 = await 누르기('배 등록하기');
  적기('배 등록으로 가는 길이 있다', 배등록 ? '지남' : '★막힘', await 화면글());

  if(배등록){
    try{
      await p.fill('#nbName', '테스트호');
      await p.selectOption('#nbType', 'sail');
      await p.fill('#nbPort', '여수 원형마리나');
      적기('배 정보를 적을 수 있다', '지남', '');
    }catch(e){ 적기('배 정보를 적을 수 있다', '★막힘', e.message); }
    // 4.03 — 단추 이름을 「등록」 → 「저장」 으로 맞췄다 (다른 화면과 같게)
    let 등록 = await 누르기('저장', 3, true);
    if(!등록) 등록 = await 누르기('등록', 3, true);
    적기('배가 등록된다', 등록 ? '지남' : '★막힘', '');
    await p.waitForTimeout(1500);
    await p.screenshot({ path: 'j03_boat.png' });
    const 이름 = await p.evaluate(()=>{
      const el = document.getElementById('boatSub'); return el ? el.textContent : ''; });
    적기('맨 윗줄에 배 이름이 뜬다', /테스트호/.test(이름) ? '지남' : '★막힘', 이름);
  }

  // ── 4. 도면 고르기 — 적재표는 도면이 있어야 시작된다
  await p.evaluate(()=>{ try{ switchTab('boat'); setBoatSubTab('stow'); }catch(_){} });
  await p.waitForTimeout(800);
  await p.screenshot({ path: 'j04_stow.png' });
  // ★ 5.6 — 단추 이름은 「기본 도면에서 선택」 이다. 옛 이름으로 찾고 있었다.
  const 도면고르기 = await 누르기('기본 도면에서 선택');
  적기('도면 고르는 길이 보인다', 도면고르기 ? '지남' : '★막힘', await 화면글());
  if(도면고르기){
    await p.waitForTimeout(600);
    await p.screenshot({ path: 'j05_dgpick.png' });
    const 고름 = await 누르기('세일링 요트');
    적기('선종에 맞는 기본 도면이 있다', 고름 ? '지남' : '★막힘', await 화면글());
    await p.waitForTimeout(1200);
    const 그려짐 = await p.evaluate(()=>{
      const fp = document.getElementById('fp');
      return !!(fp && fp.getAttribute('src') && fp.style.display !== 'none');
    });
    적기('고른 도면이 화면에 그려진다', 그려짐 ? '지남' : '★막힘', '');
    await p.screenshot({ path: 'j06_dgdone.png' });
  }

  // ── 5. 수납칸 그리기
  const 칸결과 = await p.evaluate(()=>{
    try{
      if(typeof lkAdd !== 'function') return '칸 만드는 길이 없다';
      const r = lkAdd({ x:20, y:30, w:25, h:15 }, '갤리', '싱크대 아래');
      return r ? 'ok:' + (r.label || r.name || '') : '만들어지지 않았다';
    }catch(e){ return '터짐: ' + e.message; }
  });
  적기('수납칸을 만들 수 있다', 칸결과.startsWith('ok') ? '지남' : '★막힘', 칸결과);

  // ── 6. 물품 넣기
  const 물품 = await p.evaluate(async ()=>{
    try{
      const lk = (lockers || [])[0];
      if(!lk) return '칸이 없다';
      selected = lk.id; inBox = null; editId = null;
      document.getElementById('panel').classList.add('open');
      document.getElementById('fName').value = '임펠러';
      document.getElementById('fQty').value = '2';
      addItem();
      await new Promise(r => setTimeout(r, 800));
      return 'ok:' + items.length + '개';
    }catch(e){ return '터짐: ' + e.message; }
  });
  적기('물품을 넣을 수 있다', 물품.startsWith('ok') ? '지남' : '★막힘', 물품);

  // ── 6-b. 물품에 사진 넣기 (배에서 제일 많이 하는 일)
  const 사진 = await p.evaluate(async ()=>{
    try{
      const c = document.createElement('canvas'); c.width = 900; c.height = 600;
      const g = c.getContext('2d'); g.fillStyle = '#268'; g.fillRect(0,0,900,600);
      const blob = await (await fetch(c.toDataURL('image/jpeg', 0.9))).blob();
      const f = new File([blob], 'x.jpg', { type:'image/jpeg' });
      formPhotos = [];
      pickPhoto({ target:{ files:[f], value:'' } });
      await new Promise(r => setTimeout(r, 1200));
      if(!formPhotos.length) return '사진이 안 들어갔다';
      const im = new Image(); im.src = formPhotos[0];
      await new Promise(r => { im.onload = r; im.onerror = r; });
      return 'ok:' + im.naturalWidth + '×' + im.naturalHeight
        + ' · ' + Math.round(formPhotos[0].length/1024) + 'KB';
    }catch(e){ return '터짐: ' + e.message; }
  });
  적기('물품 사진을 넣을 수 있다', 사진.startsWith('ok') ? '지남' : '★막힘', 사진);

  // ── 7. 정비 항목
  await p.evaluate(()=>{ try{ setBoatSubTab('maint'); }catch(_){} });
  await p.waitForTimeout(900);
  await p.screenshot({ path: 'j07_maint.png' });
  const 정비 = await p.evaluate(()=> (typeof maint !== 'undefined' && Array.isArray(maint)) ? maint.length : -1);
  적기('정기점검이 기본으로 깔려 있다', 정비 > 0 ? '지남' : '★막힘', 정비 + '개');

  // ── 8. 항해일지
  // ★★★ 4.99 — 항해일지는 「내 배」 안으로 들어갔다. switchTab('voyage') 는 이제 없는 길이다.
  //   옛 길로 눌러 놓고 「단추가 없다」 고 하면, 진짜로 없어진 날에도 못 알아본다.
  await p.evaluate(()=>{
    try{ boatSubTab = 'voyage'; localStorage.setItem('bt_boatsub','voyage'); switchTab('boat'); }
    catch(_){ try{ switchTab('voyage'); }catch(__){} }
  });
  await p.waitForTimeout(900);
  await p.screenshot({ path: 'j08_voyage.png' });
  // ★ 5.6 — 새 항해는 오른쪽 아래 동그란 단추(.fab)로 시작한다.
  //   글자가 '+' 하나뿐이라 이름으로는 못 찾는다. 사람이 하는 그대로 눌러 본다.
  const 항해 = await p.evaluate(async ()=>{
    const f = document.querySelector('.fab');
    if(!f) return false;
    f.click();
    await new Promise(r => setTimeout(r, 400));
    const it = document.querySelector('.fabitem');   // 할 일이 여럿이면 펼쳐진다
    if(it) it.click();
    return true;
  });
  await p.waitForTimeout(900);
  적기('항해일지를 시작할 수 있다', 항해 ? '지남' : '★막힘', await 화면글());
  await p.waitForTimeout(700);
  const 항해수 = await p.evaluate(()=> (typeof voyage !== 'undefined' ? voyage.length : -1));
  적기('항해 기록이 실제로 만들어진다', 항해수 > 0 ? '지남' : '★막힘', 항해수 + '건');
  await p.screenshot({ path: 'j08b_voyage.png' });

  // ── 8-b. 출항 전 점검 — 배 타는 사람이 매번 하는 것
  await p.evaluate(()=>{ try{ switchTab('home'); setHomeSub && setHomeSub('check'); }catch(_){} });
  await p.waitForTimeout(900);
  await p.screenshot({ path: 'j08c_check.png' });
  const 점검 = await 화면글();
  적기('출항 전 점검이 열린다', /점검|확인/.test(점검) ? '지남' : '★막힘', 점검.slice(0,140));

  // ── 8-c. 도면에 핀 찍기 — 정비 위치를 남기는 길
  const 핀 = await p.evaluate(async ()=>{
    try{
      const m = (maint || [])[0];
      if(!m) return '정비 항목이 없다';
      m.pin = { map:'plan', x:40, y:50 };
      const shot = await pinShot(m.pin);
      return shot ? 'ok:' + Math.round(shot.length/1024) + 'KB' : '핀 그림을 못 만들었다';
    }catch(e){ return '터짐: ' + e.message; }
  });
  적기('도면에 찍은 핀으로 그림을 만든다', 핀.startsWith('ok') ? '지남' : '★막힘', 핀);

  // ── 9. 커뮤니티 — 로그인 안 한 사람이 안을 볼 수 있나
  //   ★ 4.20 에서 뒤집혔다. 전에는 '로그인해야 볼 수 있습니다' 로 막았는데,
  //     처음 온 사람이 안을 하나도 못 보고 가입부터 하라고 하면 그냥 나간다.
  //     이제는 보이고, 쓰려고 할 때만 로그인으로 데려간다.
  //   ★ 이 컨테이너에서는 파이어베이스(gstatic)를 못 받는다.
  //     그래서 창구만 가짜로 붙여 '인터넷은 되는데 로그인은 안 한 사람' 을 만든다.
  await p.evaluate(()=>{
    window.__talk = { async list(){ return { rows:[], done:true }; }, async edit(){}, async add(){} };
    window.__spots = window.__talk; window.__market = window.__talk;
    window.__user = null;
  });
  await p.evaluate(()=>{ try{ switchTab('community'); }catch(_){} });
  await p.waitForTimeout(1200);
  await p.screenshot({ path: 'j09_com.png' });
  const 커뮤글 = await 화면글();
  적기('커뮤니티가 로그인 없이도 열린다',
    !/로그인해야 볼 수 있습니다/.test(커뮤글) ? '지남' : '★막힘', 커뮤글.slice(0,180));
  적기('글판 화면이 실제로 그려진다',
    /잡담|질문|전체/.test(커뮤글) ? '지남' : '★막힘', 커뮤글.slice(0,180));
  // 쓰려고 하면 그때 로그인으로 데려간다 — 말만 하고 끝나면 사람이 길을 못 찾는다
  const 쓰기 = await p.evaluate(async ()=>{
    let 열림 = false, 말 = '';
    // ★ 4.37 부터 브라우저 창이 아니라 앱 안의 창으로 말한다 (tell)
    const 참 = window.openAccount, 참알림 = window.tell;
    window.openAccount = ()=>{ 열림 = true; };
    window.tell = m => { 말 = String(m||''); return Promise.resolve(); };
    try{ writeTalk(); }catch(_){}
    await new Promise(r=>setTimeout(r,150));
    window.openAccount = 참; window.tell = 참알림;
    return { 열림, 말 };
  });
  적기('글을 쓰려 하면 로그인으로 데려간다',
    (쓰기.열림 && /로그인/.test(쓰기.말)) ? '지남' : '★막힘', JSON.stringify(쓰기));

  // ── 9-b. 뉴스 — 자료를 못 받았을 때 뭐라고 하나 (빈 화면이면 고장으로 본다)
  await p.evaluate(()=>{ try{ setComSub('news'); }catch(_){} });
  await p.waitForTimeout(1200);
  await p.screenshot({ path: 'j09b_news.png' });
  const 뉴스 = await 화면글();
  적기('뉴스를 못 받아도 까닭을 말한다',
    /못|없|나중|확인/.test(뉴스) ? '지남' : '★막힘', 뉴스.slice(0,140));

  // ── 10. 오늘 화면 — 날씨가 나오나
  await p.evaluate(()=>{ try{ switchTab('home'); }catch(_){} });
  await p.waitForTimeout(1500);
  await p.screenshot({ path: 'j10_today.png' });
  적기('오늘 화면이 그려진다', (await 화면글()).length > 60 ? '지남' : '★막힘',
    (await 화면글()).slice(0,160));

  // ── 11. 백업 → 복원 왕복 (사진이 주소로 바뀐 뒤 처음이다)
  const 백업 = await p.evaluate(async ()=>{
    try{
      let 담김 = null;
      const oc = URL.createObjectURL;
      URL.createObjectURL = blob => { 담김 = blob; return 'blob:가짜'; };
      const oa = document.createElement.bind(document);
      backupData();
      await new Promise(r => setTimeout(r, 900));
      URL.createObjectURL = oc;
      if(!담김) return '백업 파일이 안 만들어졌다';
      const txt = await 담김.text();
      const d = JSON.parse(txt);
      return 'ok:' + Object.keys(d).join(',').slice(0,120) + ' | 물품 ' + (d.items||[]).length;
    }catch(e){ return '터짐: ' + e.message; }
  });
  적기('백업 파일이 만들어진다', 백업.startsWith('ok') ? '지남' : '★막힘', 백업);

  // ── 11-b. ★ 복원 왕복 — 백업한 것을 도로 넣어 본다
  const 복원 = await p.evaluate(async ()=>{
    try{
      const 원래 = { 물품: items.length, 칸: lockers.length, 정비: maint.length,
                     도면: !!dgImgs.plan };
      const bk = JSON.stringify({ app:'뱃일', date:new Date().toISOString(),
        boat: curBoat(), boats, items, trash, maint, repair, voyage, fuel, runs,
        contacts, vdocs, checkt, mrtrash: mrTrash, lockers, shapes, posts, dgimgs: dgArr() });
      // 자료를 싹 비운 뒤 백업으로 되살린다
      items = []; lockers = []; maint = []; shapes = [];
      dgImgs = { plan:null, side:null }; dgSmall = { plan:null, side:null };
      // ★ 4.38 부터 물음도 앱 안의 창으로 뜬다(ask). 브라우저 창만 가로채면 답이 안 온다.
      const oc = window.confirm, oa = window.tell, ok2 = window.ask;
      let 알림 = '';
      window.confirm = ()=>true;
      window.ask = ()=>Promise.resolve(true);
      window.tell = m => { 알림 = m; return Promise.resolve(); };
      window.FileReader = class { readAsText(){ this.result = bk; this.onload(); } };
      restoreData({ target:{ files:[{}], value:'' } });
      await new Promise(r => setTimeout(r, 900));
      window.confirm = oc; window.tell = oa; window.ask = ok2;
      return { 원래, 되살림: { 물품: items.length, 칸: lockers.length,
                              정비: maint.length, 도면: !!dgImgs.plan }, 알림 };
    }catch(e){ return { 터짐: e.message }; }
  });
  적기('백업을 도로 넣으면 그대로 돌아온다',
    (복원 && 복원.되살림 && 복원.원래
      && 복원.되살림.물품 === 복원.원래.물품
      && 복원.되살림.칸 === 복원.원래.칸
      && 복원.되살림.정비 === 복원.원래.정비
      && 복원.되살림.도면 === 복원.원래.도면) ? '지남' : '★막힘',
    JSON.stringify(복원));

  // ── 11-c. ★ 인터넷을 끊고 배 자료가 보이나 (배 위에서 쓰는 그 상황)
  await ctx.setOffline(true);
  await p.evaluate(()=>{ try{ switchTab('boat'); setBoatSubTab('stow'); }catch(_){} });
  await p.waitForTimeout(1000);
  await p.screenshot({ path: 'j12_offline.png' });
  const 오프 = await p.evaluate(()=>({
    물품: (items||[]).length,
    칸: (lockers||[]).length,
    도면: !!(document.getElementById('fp') || {}).src,
    글: document.body.innerText.slice(0, 120)
  }));
  적기('인터넷이 없어도 적재표가 보인다',
    (오프.물품 > 0 && 오프.칸 > 0 && 오프.도면) ? '지남' : '★막힘', JSON.stringify(오프));
  await ctx.setOffline(false);

  // ── 11-d. 홈 화면에 추가 안내가 뜨나 (광고로 들어온 사람이 제일 먼저 봐야 하는 것)
  await p.evaluate(()=>{ try{ localStorage.removeItem('bt_inshide'); switchTab('home'); renderHome(); }catch(_){} });
  await p.waitForTimeout(700);
  const 설치 = await p.evaluate(()=>{
    const c = document.querySelector('.hcard.ins');
    return { 보임: !!c, 아이폰: (typeof isIOS === 'function') ? isIOS() : null,
             글: c ? c.innerText.replace(/\n+/g,' / ').slice(0,90) : '' };
  });
  // 이 브라우저(크롬 데스크톱)는 설치 물음을 안 던지므로 안 뜨는 것이 맞다
  적기('홈 화면 안내가 엉뚱하게 뜨지 않는다', 설치.보임 === false ? '지남' : '★막힘',
    JSON.stringify(설치));

  // ── 12. 서랍이 다 열리나
  await p.evaluate(()=>{ try{ openDrawer(); }catch(_){} });
  await p.waitForTimeout(500);
  await p.screenshot({ path: 'j11_drawer.png' });
  const 서랍 = await p.evaluate(()=>
    [...document.querySelectorAll('#drawer .ditem')]
      .filter(x => x.offsetParent !== null).map(x => x.textContent.trim()));
  // ★ 몇 줄인지 세면 4.41 처럼 줄을 옮길 때마다 깨진다. 무엇이 있는지를 본다.
  //   클라우드·파일 네 줄은 설정 안으로 들어갔다 — 서랍에 있으면 안 되는 것도 같이 본다.
  // ★★★ 4.99 — 「내 배」 는 아래 탭으로 나갔고, 서랍에는 「계류장」(배 등록)이 있다.
  //   옛 이름을 서랍에서 찾으면 영영 못 찾는다. 대신 **아래 탭에 있는지** 를 따로 본다.
  const 있어야 = ['계류장', '설정', '고객센터'];
  // 4.41 에서 클라우드·파일이, 4.43 에서 약관이 설정 안으로 들어갔다
  const 없어야 = ['클라우드', '파일로 저장', '데이터 백업', '백업 복원', '약관'];
  const 글 = 서랍.join(' | ');
  const 빠진 = 있어야.filter(x => 글.indexOf(x) < 0);
  const 남은 = 없어야.filter(x => 글.indexOf(x) >= 0);
  적기('서랍에 길이 다 있다', (빠진.length === 0 && 남은.length === 0) ? '지남' : '★막힘',
    서랍.join(' · ') + (빠진.length ? ' / 빠짐: ' + 빠진.join(',') : '')
                     + (남은.length ? ' / 여기 있으면 안 됨: ' + 남은.join(',') : ''));

  // ★★★ 「내 배」 로 가는 길이 어디엔가는 있어야 한다 — 이제 아래 탭이다
  const 아래탭 = await p.evaluate(()=>{
    try{ return [...document.querySelectorAll('#tabbar button, .tabbar button, nav button')]
           .map(b => (b.innerText||'').trim()).filter(Boolean).join(' · '); }catch(_){ return ''; }
  });
  적기('아래 탭으로 내 배에 간다', /내 배/.test(아래탭) ? '지남' : '★막힘', 아래탭);

  // ── 12-b. 설정 안에서 약관까지 닿나 (법 제30조 — 언제든 볼 수 있어야 한다)
  await p.evaluate(()=>{ try{ closeDrawer(); openSettings(); }catch(_){} });
  await p.waitForTimeout(500);
  const 설정글 = await p.evaluate(()=>{
    const P = document.getElementById('mrPanel');
    return [...P.querySelectorAll('.setrow')].map(x=>(x.querySelector('.mrv')||{}).textContent||'');
  });
  적기('설정에서 약관까지 닿는다', 설정글.some(x=>/약관/.test(x)) ? '지남' : '★막힘', 설정글.join(' · '));
  적기('설정에서 파일 저장·불러오기에 닿는다',
    설정글.some(x=>/파일로 저장/.test(x)) && 설정글.some(x=>/파일에서 불러오기/.test(x)) ? '지남' : '★막힘',
    설정글.join(' · '));

  // ── 13. 터진 것
  적기('앱이 터지지 않았다', 터짐.length === 0 ? '지남' : '★막힘', 터짐.join(' | '));
  // ★ 이 컨테이너는 gstatic(파이어베이스 파일)로 못 나간다. 그건 앱 잘못이 아니다.
  //   그 하나만 빼고 본다 — 다른 빨간 글은 진짜 문제다.
  const 진짜빨강 = 콘솔.filter(t =>
    // ★ 5.6 — 파이어베이스가 앱 파일 안으로 들어왔다. 이제 컨테이너에서도 켜지고, 대신 서버(Firestore)에 못 닿는다는 말이 뜬다.
    !/gstatic\.com|ERR_TUNNEL_CONNECTION_FAILED|cloud init failed|net::ERR_|404|504|blob:|Could not reach Cloud Firestore backend|firestore\.googleapis\.com|identitytoolkit|securetoken/.test(t));   // 504·blob 은 이 검사가 일부러 만든 것
  적기('콘솔에 빨간 글이 없다', 진짜빨강.length === 0 ? '지남' : '★막힘',
    진짜빨강.slice(0,4).join(' | ') || '(파이어베이스 못 받은 것만 있음 — 이 컨테이너 사정)');

  console.log('\n─── 막힌 곳 ' + 실패 + '개 ───');
  fs.writeFileSync('journey_result.json', JSON.stringify({ 결과, 터짐, 콘솔 }, null, 1));
  await b.close();
  server.close();
})();
