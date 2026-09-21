// 4.102 — 뒤로 가기는 **바로 직전에 있던 자리**로 간다 (사장님이 정하신 것)
//
// ★ 사장님 말씀
//   「남의 배 항해일지에서 항해일지 읽고 나서 뒤로 가기 하면 그 배의 항해일지 목록으로
//    들어가 버리는 오류가 있거든? 그러고 나서 또 뒤로 해야 남의 배로 돌아오네.
//    모든 뒤로 가기는 반드시 자기가 바로 직전에 있었던 페이지로 가는 게 맞겠지」
//   「이동도 이렇게 들어갔다가 취소하고 싶으면 뒤로 가기 하면 바로 이전에
//    그 물품 선택했던 상태로 가야 되는데 완전히 왜 적재표 페이지가 꺼지냐?」
//
// ★ 뿌리는 하나였다 — 뒤로 가기가 **앱의 모드를 모른다.**
//   판단하는 곳(navBackKind)에 모드가 한 줄도 없어서, 이동 중에 뒤로 가면
//   「떠 있는 화면을 닫아라」 로 넘어가 적재표를 통째로 닫았다.
//   그리고 남의 배는 **안 들른 자리**를 만들어 냈다.
//
// ★ 그래서 자리마다 고치지 않고 표 하나(MODES)로 모았고, 여기서 **하나씩 눌러 본다.**
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const FILE = process.argv[2] || 'work.html';
const server = http.createServer((rq, rs) => {
  const f = ((rq.url === '/' && path.isAbsolute(FILE)) ? FILE : path.join(__dirname, rq.url === '/' ? FILE : rq.url.split('?')[0]));
  fs.readFile(f, (e, d) => { if(e){ rs.writeHead(404); rs.end(); return; } rs.writeHead(200); rs.end(d); });
});
let ok = 0, bad = 0;
const T = (n, c, w) => { if(c){ ok++; console.log('통과: ' + n); }
  else { bad++; console.log('★ 실패: ' + n + (w !== undefined ? ' — ' + JSON.stringify(w).slice(0, 260) : '')); } };

(async () => {
  await new Promise(r => server.listen(0, r));
  const br = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const pg = await (await br.newContext({ locale:'ko-KR', viewport:{ width:390, height:844 },
                                          isMobile:true, hasTouch:true })).newPage();
  const errs = []; pg.on('pageerror', e => errs.push(String(e).slice(0, 150)));
  await pg.goto('http://127.0.0.1:' + server.address().port + '/', { waitUntil:'domcontentloaded' });
  await pg.waitForTimeout(1300);
  await pg.evaluate(() => { try{ skipWelcome(); }catch(_){} });
  await pg.waitForTimeout(300);

  // ══ ① 남의 배 — 목록에서 항해일지 한 줄을 눌러 들어간다 (한 걸음)
  await pg.evaluate(() => {
    const BOAT = { id:'pb1', name:'여수 Shunshine', typeName:'세일링 요트', port:'여수 원형 마리나',
      intro:[{t:'text',v:'소개'}],
      voyage:[{id:'v1',title:'야간 항해 연습',date:'2026-09-03'},
              {id:'v2',title:'바람잡는 연습',date:'2026-08-15'}],
      mlog:[{id:'h1',title:'엔진오일 교체',date:'2026-08-18',how:[]}],
      maint:[], review:[], boatrv:[], gear:[], roster:[], posts:[] };
    window.__pub = { one: async () => BOAT, list: async () => [BOAT] };
    setOtherSub('voyage');
  });
  await pg.waitForTimeout(400);
  const 자리 = () => pg.evaluate(() => ({
    tab: curTab, 화면: SCREEN_STACK.slice(), 배탭: boatPageTab,
    항해: pubVoyId, 정비: pubHowId, 자국: pubTrail.length }));

  await pg.evaluate(() => expOpen('pb1','voyage','v1'));
  await pg.waitForTimeout(600);
  const 들어감 = await 자리();
  T('항해일지 하나가 펼쳐졌다', 들어감.항해 === 'v1' && 들어감.화면.indexOf('mrPanel') >= 0, 들어감);
  T('★★★ 들른 자리는 하나다 (안 들른 「그 배 항해일지 목록」 을 만들지 않는다)',
    들어감.자국 === 1, 들어감);
  await pg.evaluate(() => navDoBack());
  await pg.waitForTimeout(500);
  const 나옴 = await 자리();
  T('★★★ 뒤로 **한 번**에 남의 배 목록으로 돌아온다 (여태는 두 번이었다)',
    나옴.화면.length === 0 && 나옴.tab === 'others', 나옴);

  // ══ ② 남의 배 — 안에서 걸어 들어가면 한 걸음씩 물린다
  await pg.evaluate(() => openBoatPage('pb1'));
  await pg.waitForTimeout(600);
  await pg.evaluate(() => setBoatPageTab('voyage'));
  await pg.waitForTimeout(300);
  await pg.evaluate(() => pubVoyOpen('v1'));
  await pg.waitForTimeout(300);
  T('걸어 들어온 자국이 셋이다 (소개 · 항해일지 목록 · 그 항해)',
    (await 자리()).자국 === 3, await 자리());
  await pg.evaluate(() => navDoBack());
  await pg.waitForTimeout(300);
  const 한걸음 = await 자리();
  T('★★★ 뒤로 한 번 → 그 배의 항해일지 **목록** (여기는 실제로 들렀다)',
    한걸음.항해 === '' && 한걸음.배탭 === 'voyage', 한걸음);
  await pg.evaluate(() => navDoBack());
  await pg.waitForTimeout(300);
  T('★★ 뒤로 두 번 → 배 소개', (await 자리()).배탭 === 'intro', await 자리());
  await pg.evaluate(() => navDoBack());
  await pg.waitForTimeout(400);
  T('★★ 뒤로 세 번 → 남의 배 목록', (await 자리()).화면.length === 0);

  // ══ ③ 남의 배 정비수첩 — 여태 자국을 아예 안 남겨 화면이 통째로 닫혔다
  await pg.evaluate(() => openBoatPage('pb1'));
  await pg.waitForTimeout(600);
  await pg.evaluate(() => { setBoatPageTab('mlog'); });
  await pg.waitForTimeout(300);
  await pg.evaluate(() => pubHowOpen('h1'));
  await pg.waitForTimeout(300);
  T('정비수첩 하나가 펼쳐졌다', (await 자리()).정비 === 'h1');
  await pg.evaluate(() => navDoBack());
  await pg.waitForTimeout(400);
  const 정비뒤 = await 자리();
  T('★★★ 뒤로 → 정비수첩 **목록** 으로 간다 (화면이 안 닫힌다)',
    정비뒤.정비 === '' && 정비뒤.화면.indexOf('mrPanel') >= 0, 정비뒤);
  await pg.evaluate(() => { backToExplore(); });
  await pg.waitForTimeout(400);

  // ══ ④ 적재표 모드들 — 켜고 뒤로 가면 **그 모드만** 꺼진다
  await pg.evaluate(() => {
    switchTab('boat');
    if(!unlocked) toggleLock();
    lockers = [{ id:'L1', zone:'살롱 중앙', label:'의자 아래', x:10,y:10,w:20,h:20, deck2:false },
               { id:'L2', zone:'앞칸',     label:'선반',      x:40,y:10,w:20,h:20, deck2:false }];
    items = [{ id:1, name:'로프', qty:'1', unit:'', note:'', lockerId:'L1', zone:'살롱 중앙',
               locker:'의자 아래', photos:[], parentId:null },
             { id:2, name:'로프', qty:'1', unit:'', note:'', lockerId:'L2', zone:'앞칸',
               locker:'선반', photos:[], parentId:null },
             { id:3, name:'공구함', qty:'1', unit:'', note:'', box:true, lockerId:'L1',
               zone:'살롱 중앙', locker:'의자 아래', photos:[], parentId:null }];
    save(); refreshBoxes(); openLocker('L1');
  });
  await pg.waitForTimeout(400);

  const 적재표열림 = () => pg.evaluate(() =>
    document.getElementById('panel').classList.contains('open'));

  const 모드시험 = async (이름, 켜기, 켜졌나) => {
    await pg.evaluate(켜기);
    await pg.waitForTimeout(500);
    const on = await pg.evaluate(켜졌나);
    T(이름 + ' — 켜졌다', on === true, on);
    const 쌓임 = await pg.evaluate(() => navBackKind());
    T('★★ ' + 이름 + ' — 뒤로 가기가 이것을 먼저 본다', 쌓임 === 'mode', 쌓임);
    await pg.evaluate(() => navDoBack());
    await pg.waitForTimeout(400);
    const off = await pg.evaluate(켜졌나);
    T('★★★ ' + 이름 + ' — 뒤로 가면 이것만 꺼진다', off === false, off);
    T('★★★ ' + 이름 + ' — 그때 적재표는 안 꺼진다 (사장님 지적)', await 적재표열림());
  };

  await 모드시험('이동(목록)',   () => listMove(1),      () => moveId !== null);
  await pg.evaluate(() => openLocker('L1'));
  await 모드시험('합침',         () => toggleMerge(1),   () => mergeId !== null);
  await 모드시험('여러 개 고르기', () => pickStart(1),    () => pickOn === true);
  await 모드시험('물품 수정',     () => startEdit(1),     () => editId !== null);
  await 모드시험('상자 안',       () => openBox(3),       () => inBox !== null);

  // ★ 도면에서 고르기 — 이것이 사장님이 겪으신 그 자리다
  await pg.evaluate(() => openLocker('L1'));
  await pg.waitForTimeout(300);
  await pg.evaluate(() => mvFromMap(1));
  await pg.waitForTimeout(500);
  T('도면에서 고르기 — 켜졌다', await pg.evaluate(() => !!mvPick));
  T('★★ 뒤로 가기가 이것을 먼저 본다', (await pg.evaluate(() => navBackKind())) === 'mode');
  await pg.evaluate(() => navDoBack());
  await pg.waitForTimeout(500);
  T('★★★ 뒤로 가면 고르기가 꺼진다', (await pg.evaluate(() => !mvPick)));
  T('★★★ 그리고 **고르던 그 물품 자리로 돌아온다** (적재표가 안 꺼진다 — 사장님 지적)',
    await 적재표열림());
  T('★★ 목록 쪽 이동도 같이 꺼진다', await pg.evaluate(() => moveId === null));

  // ══ ⑤ 칸 그리기
  await pg.evaluate(() => { if(!lkEdit) toggleLkEdit(); });
  await pg.waitForTimeout(400);
  T('칸 그리기 — 켜졌다', await pg.evaluate(() => lkEdit === true));
  await pg.evaluate(() => navDoBack());
  await pg.waitForTimeout(400);
  T('★★★ 뒤로 가면 칸 그리기가 꺼진다', await pg.evaluate(() => lkEdit === false));

  // ══ ⑥ 표에 적힌 모드가 모두 실제로 있는 것인가 (죽은 줄이 없나)
  const 표 = await pg.evaluate(() => MODES.map(m => ({ k:m.k,
    켜짐: (()=>{ try{ return typeof m.on(); }catch(_){ return 'x'; } })(),
    끄기: typeof m.off === 'function', 자리: (()=>{ try{ return m.보임(); }catch(_){ return ''; } })() })));
  T('★★ 모드 표가 아홉 갈래다', 표.length === 9, 표.length);
  T('★★★ 표의 모든 줄이 실제로 도는 것이다',
    표.every(x => x.켜짐 === 'boolean' && x.끄기 && x.자리), 표);

  T('앱이 안 터졌다', errs.length === 0, errs);
  await br.close(); server.close();
  console.log(`\n합계: ${ok}개 통과 / ${bad}개 실패`);
  process.exit(bad ? 1 : 0);
})().catch(e => { console.log('★ 실패: 검사가 터졌습니다 — ' + (e && e.message)); process.exit(1); });
