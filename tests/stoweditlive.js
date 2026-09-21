// 4.100 — 적재표 「수정」 이 실제로 열리는지 (사장님 지적)
//
// ★ 사장님 말씀: "수정이 도대체 머냐? 눌러도 아무것도 안되고"
//   "왜 중앙에 수정단추 있는데 더보기에 또있냐?"
//   "이름도 못바꾸고 사진 추가나 삭제도 못하게 해놨네?"
//
// ★ 무엇이었나 — 열어 둔 물품 카드를 안 닫고 그 **뒤에** 편집 칸을 열었다.
//   화면이 그대로라 사람 눈에는 아무 일도 안 일어난 것이다.
//   이름 칸도 사진 단추도 그 뒤에 멀쩡히 있었는데 닿을 수가 없었다.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const FILE = process.argv[2] || 'work.html';
const server = http.createServer((rq, rs) => {
  const f = ((rq.url === '/' && path.isAbsolute(FILE)) ? FILE : path.join(__dirname, rq.url === '/' ? FILE : rq.url.split('?')[0]));
  fs.readFile(f, (e, d) => { if(e){ rs.writeHead(404); rs.end(); return; }
    rs.writeHead(200); rs.end(d); });
});
let ok = 0, bad = 0;
const T = (n, c, w) => { if(c){ ok++; console.log('통과: ' + n); }
  else { bad++; console.log('★ 실패: ' + n + (w !== undefined ? ' — ' + JSON.stringify(w).slice(0,200) : '')); } };

(async () => {
  await new Promise(r => server.listen(0, r));
  const br = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const pg = await (await br.newContext({ locale:'ko-KR', viewport:{width:390,height:844}, isMobile:true, hasTouch:true })).newPage();
  const errs = []; pg.on('pageerror', e => errs.push(String(e).slice(0,140)));
  await pg.goto('http://127.0.0.1:' + server.address().port + '/', { waitUntil:'domcontentloaded' });
  await pg.waitForTimeout(1200);
  await pg.evaluate(() => { window.tell = () => Promise.resolve(); window.ask = () => Promise.resolve(true);
    try{ skipWelcome(); }catch(_){} unlocked = true; openBoatSetup(); });
  await pg.waitForTimeout(400);
  await pg.evaluate(() => { document.getElementById('nbName').value='시험호'; createBoat(); });
  await pg.waitForTimeout(1500);

  // 물품 하나를 넣고 그 카드를 연다
  await pg.evaluate(() => {
    switchTab('boat'); setBoatSubTab('stow');
  });
  await pg.waitForTimeout(600);
  const 넣음 = await pg.evaluate(() => {
    // ★ 새 배에는 수납칸이 하나도 없다 — 칸부터 만든다 (앱이 하는 것과 같은 길로)
    if(typeof lockers !== 'undefined' && !lockers.length && typeof lkAdd === 'function'){
      lkAdd({ x:10, y:10, w:20, h:10 }, '갤리', '싱크 아래1');
    }
    const lk = (typeof lockers !== 'undefined' && lockers[0]) ? lockers[0].id : null;
    items.push({ id: 9001, name:'배수관 유분 용해제', qty:'1', unit:'', note:'', photos:['data:image/gif;base64,R0lGODlhAQABAAAAACw='],
                 lockerId: lk, parentId:null, box:false });
    save(); selected = lk; renderPanelItems();
    openItemId = 9001; renderPanelItems();
    return { lk, n: items.length };
  });
  await pg.waitForTimeout(500);
  T('물품 카드가 열린다', await pg.evaluate(() => !!document.querySelector('.itcard')), 넣음);

  // ★★★ 「수정」 을 누른다
  await pg.evaluate(() => startEdit(9001));
  await pg.waitForTimeout(500);
  const 뒤 = await pg.evaluate(() => ({
    카드: !!document.querySelector('.itcard'),
    칸: (() => { const p = document.getElementById('panel'); return !!p && p.classList.contains('open'); })(),
    이름: (document.getElementById('fName') || {}).value,
    이름보임: (() => { const e = document.getElementById('fName'); if(!e) return false;
                      const r = e.getBoundingClientRect(); return r.width > 40 && r.height > 10; })(),
    제목: (document.getElementById('formTitle') || {}).textContent,
    사진수: document.querySelectorAll('#photoPreview .fp1, .fp1').length,
    사진지우기: document.querySelectorAll('.fp1 .rm, .fphotox').length
  }));
  // ★★★ 4.102 — 사장님이 뒤집으신 자리다.
  //   4.100 에서는 「수정」 을 누르면 카드를 **닫고** 목록 맨 위의 칸을 채웠다.
  //   그런데 그 칸은 화면 밖(재 보니 2,215px)이라 아무 일도 안 난 것으로 보였다.
  //   사장님: 「열려진 그 창에서 바로 수정할 수 있도록 해야 되는 거 아니냐?」
  //   ★ 이제 카드는 **열린 채로 있고**, 고치는 칸이 그 카드 안으로 들어온다.
  T('★★★ 수정을 누르면 카드가 열린 채로 있다 (사장님이 정하신 것)', 뒤.카드 === true, 뒤);
  T('★★★ 고치는 칸이 그 카드 **안에** 들어와 있다',
    await pg.evaluate(() => !!document.querySelector('.itcard .pform')));
  T('★★★ 편집 칸이 열린다', 뒤.칸 === true, 뒤);
  T('★★★ 이름을 고칠 수 있다 (칸이 보이고 값이 들어 있다)',
    뒤.이름 === '배수관 유분 용해제' && 뒤.이름보임 === true, 뒤);
  T('★★ 무엇을 하는 칸인지 적혀 있다', /수정/.test(뒤.제목 || ''), 뒤.제목);
  T('★★★ 사진이 실려 있고 지우는 단추가 있다', 뒤.사진수 >= 1 && 뒤.사진지우기 >= 1, 뒤);
  T('★★ 사진 추가 단추가 있다',
    await pg.evaluate(() => !!document.querySelector('#photoBtn, input[type=file]')));

  // 이름을 실제로 바꿔 본다
  await pg.evaluate(() => { document.getElementById('fName').value = '바꾼 이름'; addItem(); });
  await pg.waitForTimeout(500);
  T('★★★ 이름이 실제로 바뀐다',
    await pg.evaluate(() => (items.find(x=>x.id===9001)||{}).name === '바꾼 이름'),
    await pg.evaluate(() => (items.find(x=>x.id===9001)||{}).name));

  // 「더 보기」 에 수정이 또 있으면 안 된다
  const 차림표 = await pg.evaluate(() => {
    const src = String(itemMenu);
    return { edit: /v: *'edit'/.test(src), move: /v: *'move'/.test(src), del: /v: *'del'/.test(src) };
  });
  T('★★★ 더 보기에 수정이 또 있지 않다', 차림표.edit === false, 차림표);
  T('★★ 더 보기에 이동·지우기는 그대로 있다', 차림표.move && 차림표.del, 차림표);


  // ══════════════════════════════════════════════════════════════
  // ★★★ 시작한 것에서 빠져나올 길이 있는가 (사장님 지적 셋)
  // ══════════════════════════════════════════════════════════════

  // ① 「합치기」 — 합칠 것이 없으면 갇히는 띠가 떴다
  const 합침 = await pg.evaluate(() => {
    let 말한것 = '';
    const 옛tell = window.tell;
    window.tell = m => { 말한것 = String(m || ''); return Promise.resolve(); };
    toggleMerge(9001);
    const r = { 띠: !!document.querySelector('.mgp'), mergeId: (typeof mergeId !== 'undefined' ? mergeId : 'x'), 말한것 };
    window.tell = 옛tell;
    return r;
  });
  T('★★★ 합칠 것이 없으면 칸을 아예 안 연다', 합침.띠 === false && 합침.mergeId === null, 합침);
  T('★★ 합칠 것이 없다고 말해 준다', /없습니다/.test(합침.말한것), 합침.말한것);

  // 합칠 것이 있으면 열리고, 닫는 단추가 있어야 한다
  const 합침2 = await pg.evaluate(() => {
    items.push({ id:9002, name:'바꾼 이름', qty:'2', unit:'', note:'', photos:[],
                 lockerId: items[0].lockerId, parentId:null, box:false });
    save(); renderPanelItems();
    toggleMerge(9001);
    const p = document.querySelector('.mgp');
    return { 띠: !!p, 닫기: !!(p && [...p.querySelectorAll('button')].some(b => /닫기|Close|Закрыть|閉/.test(b.textContent))) };
  });
  T('★★ 합칠 것이 있으면 칸이 열린다', 합침2.띠 === true, 합침2);
  T('★★★ 그 칸에 닫는 단추가 있다', 합침2.닫기 === true, 합침2);
  const 합침닫힘 = await pg.evaluate(() => { toggleMerge(9001);
    return { 띠: !!document.querySelector('.mgp'), mergeId: mergeId }; });
  T('★★★ 한 번 더 누르면 사라진다', 합침닫힘.띠 === false && 합침닫힘.mergeId === null, 합침닫힘);

  // ② 「이동」 — 시작해 놓고 그만둘 길이 있는가
  const 이동 = await pg.evaluate(() => {
    mvFromMap(9001);
    const 띠 = document.getElementById('mvbar');
    const 보임 = !!(띠 && getComputedStyle(띠).display !== 'none');
    const 취소 = !!document.querySelector('[onclick*="mvCancel"]');
    return { moveId: (typeof moveId !== 'undefined' ? moveId : 'x'), mvPick: (typeof mvPick !== 'undefined' ? mvPick : 'x'), 띠보임: 보임, 취소 };
  });
  T('★★ 이동이 시작된다', 이동.mvPick === 9001, 이동);
  T('★★★ 이동을 그만둘 단추가 화면에 있다', 이동.취소 === true, 이동);
  const 이동취소 = await pg.evaluate(() => { mvCancel();
    return { moveId: moveId, mvPick: (typeof mvPick !== 'undefined' ? mvPick : 'x') }; });
  T('★★★ 취소하면 이동이 풀린다', 이동취소.moveId === null && 이동취소.mvPick === null, 이동취소);

  // ③ 「편집 중 → 보기 전용」 으로 바꾸면 하던 것이 다 취소되는가
  const 잠금 = await pg.evaluate(() => {
    unlocked = true;
    startEdit(9001);            // 물품 수정 켜기
    mvFromMap(9001);            // 이동 켜기
    mergeId = 9001;             // 합침 켜기
    if(typeof pickStart === 'function') pickStart(9001);   // 고르기 켜기
    const 켠뒤 = { editId, moveId, mergeId, pickOn, mvPick };
    toggleLock();               // 보기 전용으로
    return { 켠뒤, 뒤: { unlocked, editId, moveId, mergeId, pickOn, mvPick } };
  });
  T('★★ 켜 놓은 것이 실제로 켜졌다',
    잠금.켠뒤.moveId === 9001 && 잠금.켠뒤.mergeId === 9001, 잠금.켠뒤);
  T('★★★ 보기 전용으로 바꾸면 하던 수정이 다 취소된다',
    잠금.뒤.unlocked === false && 잠금.뒤.editId === null && 잠금.뒤.moveId === null
      && 잠금.뒤.mergeId === null && !잠금.뒤.pickOn && 잠금.뒤.mvPick === null, 잠금.뒤);

  // ④ 칸이 없는 물품(미배치)을 고쳐도 앱이 안 죽는다
  const 미배치 = await pg.evaluate(() => {
    unlocked = true;
    items.push({ id:9003, name:'칸 없는 물품', qty:'1', unit:'', note:'', photos:[],
                 lockerId: 999999, parentId:null, box:false });
    save();
    try{ startEdit(9003); return { 죽음:false, 값:(document.getElementById('fName')||{}).value }; }
    catch(e){ return { 죽음:true, 왜:String(e && e.message) }; }
  });
  T('★★★ 칸이 없는 물품을 고쳐도 앱이 안 죽는다',
    미배치.죽음 === false && 미배치.값 === '칸 없는 물품', 미배치);


  // ══════════════════════════════════════════════════════════════
  // ★★★ 4.101 — 누르기 **전에** 알려 준다 (사장님 지적)
  //   「합치기」 를 눌렀는데 알림창만 뜨면 사람은 단추가 고장난 줄 안다.
  //   차림표에 몇 개인지 미리 적어 두고, 없으면 「없음」 이라고 적는다.
  //   ★ 그래도 단추는 안 감춘다 — 감추면 기능이 없어진 줄 안다.
  // ══════════════════════════════════════════════════════════════
  const 차림표글 = await pg.evaluate(async () => {
    // 같은 이름이 하나도 없게 만든다
    items = items.filter(x => x.id === 9001);
    save(); renderPanelItems();
    let 글 = [];
    const 옛 = window.tellShow;
    window.tellShow = o => { 글 = (o.btns || []).map(b => String(b.name || '')); return Promise.resolve(null); };
    await itemMenu(9001);
    window.tellShow = 옛;
    return 글;
  });
  // ★ 4.132 — 「합침」 → 「합치기」 로 말이 바뀌었다. 줄은 「합치기 · 같은 이름 …」 꼴이다.
  T('★★★ 합칠 것이 없으면 차림표에 「없음」 이라고 미리 적는다',
    차림표글.indexOf('합치기 · 같은 이름 없음') >= 0, 차림표글);
  T('★★★ 그래도 「합치기」 단추는 그대로 있다 (감추지 않는다)',
    차림표글.some(x => /^합치기( ·|$)/.test(x)), 차림표글);
  T('★★ 옛말 「합침」 은 안 남아 있다', !차림표글.some(x => /합침/.test(x)), 차림표글);
  T('★★ 차림표에 이동 · 합치기 · 선택 · 삭제 · 닫기가 다 있다',
    차림표글.length === 5 && /^이동/.test(차림표글[0]) && /^합치기/.test(차림표글[1])
    && 차림표글[2] === '선택' && 차림표글[3] === '삭제' && 차림표글[4] === '닫기', 차림표글);

  const 차림표글2 = await pg.evaluate(async () => {
    items.push({ id:9004, name:(items.find(x=>x.id===9001)||{}).name, qty:'1', unit:'', note:'', photos:[],
                 lockerId: (items.find(x=>x.id===9001)||{}).lockerId, parentId:null, box:false });
    items.push({ id:9005, name:(items.find(x=>x.id===9001)||{}).name, qty:'1', unit:'', note:'', photos:[],
                 lockerId: (items.find(x=>x.id===9001)||{}).lockerId, parentId:null, box:false });
    save(); renderPanelItems();
    let 글 = [];
    const 옛 = window.tellShow;
    window.tellShow = o => { 글 = (o.btns || []).map(b => String(b.name || '')); return Promise.resolve(null); };
    await itemMenu(9001);
    window.tellShow = 옛;
    return 글;
  });
  T('★★★ 합칠 것이 있으면 몇 개인지 미리 적는다',
    차림표글2.indexOf('합치기 · 같은 이름 2개') >= 0, 차림표글2);

  const 차림표글3 = await pg.evaluate(async () => {
    const 옛칸 = lockers.slice();
    lockers = [];                       // 수납칸이 하나도 없는 배
    let 글 = [];
    const 옛 = window.tellShow;
    window.tellShow = o => { 글 = (o.btns || []).map(b => String(b.name || '')); return Promise.resolve(null); };
    await itemMenu(9001);
    window.tellShow = 옛;
    lockers = 옛칸;
    return 글;
  });
  T('★★★ 수납칸이 없으면 「이동」 에도 미리 적는다',
    차림표글3.indexOf('이동 · 수납칸 없음') >= 0, 차림표글3);

  T('앱이 안 터졌다', errs.length === 0, errs);
  await br.close(); server.close();
  console.log(`\n합계: ${ok}개 통과 / ${bad}개 실패`);
  process.exit(bad ? 1 : 0);
})().catch(e => { console.log('★ 실패: 검사가 터졌습니다 — ' + (e && e.message)); process.exit(1); });
