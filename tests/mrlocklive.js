// 4.102 — 기록 창에서 「보기 전용 ↔ 편집 중」 을 바꾸면 **바로** 그 창이 바뀐다
//
// ★ 사장님 말씀
//   「방금 그 창에서 보기 전용에서 편집 중으로 바꾸니까 바로 편집 화면으로 안 바뀌고,
//    그 상태였다가 다른 창 다녀오니까 그제서야 편집 창으로 바뀌네.
//    이런 오류들도 어플 전체에서 다 훑어봐라」
//
// ★ 까닭 — 다시 그리는 문(repaintNow)이 「제일 나중에 불린 그림 함수」 를 다시 불렀다.
//   기록 창을 연 뒤에도 그 밑의 목록이 한 번 더 돌면 그 목록이 「마지막」 이 된다.
//   그러면 안 보이는 목록만 다시 그려지고, 보고 있는 창은 그대로 남는다.
//   ★ 이제 **지금 맨 위에 떠 있는 화면**을 보고 그것을 다시 그린다.
//
// 그리고 같이 본다 —
//   · 「저장 후 닫기」 는 **한 번만** 눌러도 닫힌다
//   · 무엇이 바뀌는 **그 순간** 「되돌리고 닫기」 가 뜬다
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

  // 정기점검 하나를 만들고 연다
  await pg.evaluate(() => {
    maint = [{ id:'m1', name:'엔진오일 및 필터 교체', grp:'엔진', months:1, unit:'개월',
               lastDate:'2026-08-18', note:'', on:true }];
    saveMR();
    switchTab('boat'); boatSubTab = 'maint';
    if(unlocked) toggleLock();               // 보기 전용에서 연다
    openMR('maint','m1');
  });
  await pg.waitForTimeout(600);

  const 칸수 = () => pg.evaluate(() =>
    document.querySelectorAll('#mrPanel input, #mrPanel textarea, #mrPanel select').length);
  const 단추 = () => pg.evaluate(() =>
    [...document.querySelectorAll('#mrPanel .mrtop .mrbtn')].map(b => b.textContent.trim()));

  T('보기 전용으로 창이 열렸다', await pg.evaluate(() => !unlocked && !!mrOpenId));
  const 잠김칸 = await 칸수();
  T('★★ 보기 전용에서는 고치는 칸이 없다', 잠김칸 === 0, 잠김칸);
  T('★★ 그때 단추는 「목록」 뿐이다', (await 단추()).join(',') === '목록', await 단추());

  // ★★★ 여기가 사장님이 겪으신 자리다 — 밑의 목록이 한 번 더 돌게 만든다
  await pg.evaluate(() => { try{ renderMaintList(); }catch(_){} });
  await pg.waitForTimeout(150);

  await pg.evaluate(() => toggleLock());
  await pg.waitForTimeout(500);
  const 푼칸 = await 칸수();
  T('★★★ 편집 중으로 바꾸면 **바로** 고치는 칸이 나온다 (다른 창 다녀올 것 없이)',
    푼칸 > 0, { 잠김칸, 푼칸 });
  const 푼단추 = await 단추();
  T('★★★ 「저장 후 닫기」 가 바로 나온다', 푼단추.indexOf('저장 후 닫기') >= 0, 푼단추);
  T('★★ 창이 그대로 그 기록이다', await pg.evaluate(() => mrOpenId === 'm1'));

  // ── 되돌리고 닫기 — 글자 하나 치는 순간 뜬다
  const 되돌림보임 = () => pg.evaluate(() => {
    const b = document.getElementById('mrRevertBtn');
    return !!b && getComputedStyle(b).display !== 'none';
  });
  T('★★ 아직 아무것도 안 고쳤으면 「되돌리고 닫기」 는 없다', (await 되돌림보임()) === false);
  await pg.evaluate(() => {
    const el = [...document.querySelectorAll('#mrPanel input')]
      .find(x => x.value === '엔진오일 및 필터 교체');
    el.id = '__nm0';
  });
  await pg.click('#__nm0');
  await pg.evaluate(() => { document.getElementById('__nm0').setSelectionRange(999,999); });
  await pg.keyboard.type('2', { delay: 40 });
  await pg.waitForTimeout(250);
  T('★★★ 글자를 고치는 **그 순간** 「되돌리고 닫기」 가 뜬다 (칸을 벗어나지 않아도)',
    await 되돌림보임());

  // ── 저장 후 닫기 — 한 번만 눌러도 닫힌다
  //    ★ 칸에 커서를 둔 채로 누른다. 여태 이때 두 번 눌러야 했다.
  // ★★★ 손으로 친 것과 똑같이 친다. 값을 코드로 넣으면 브라우저가 change 를 안 보내서
  //   여태 두 번 눌러야 했던 그 상황이 재현되지 않는다 (검사가 거짓말을 한다).
  await pg.evaluate(() => {
    const el = [...document.querySelectorAll('#mrPanel input')].find(x => /엔진오일/.test(x.value));
    el.id = '__nm';
  });
  await pg.click('#__nm');
  await pg.evaluate(() => { document.getElementById('__nm').setSelectionRange(999,999); });
  await pg.keyboard.type('2', { delay: 40 });
  await pg.waitForTimeout(150);
  T('★★ 지금 커서가 그 칸에 있다 (여태 이때 두 번 눌러야 했다)',
    await pg.evaluate(() => document.activeElement && document.activeElement.id === '__nm'));
  // ★ 딱 한 번 누른다 — 진짜 손가락처럼
  await pg.click('#mrPanel .mrtop .mrbtn.ok');
  await pg.waitForTimeout(800);
  const 닫힘 = await pg.evaluate(() => ({
    열림: !!mrOpenId,
    화면: SCREEN_STACK.indexOf('mrPanel') >= 0,
    이름: (maint.find(x=>x.id==='m1')||{}).name }));
  T('★★★ 「저장 후 닫기」 를 **한 번만** 눌러도 닫힌다 (사장님 지적)',
    닫힘.열림 === false && 닫힘.화면 === false, 닫힘);
  T('★★★ 그리고 고친 것이 실제로 저장된다 (첫 누르기가 허공에 안 떨어진다)',
    닫힘.이름 === '엔진오일 및 필터 교체22', 닫힘);

  T('앱이 안 터졌다', errs.length === 0, errs);
  await br.close(); server.close();
  console.log(`\n합계: ${ok}개 통과 / ${bad}개 실패`);
  process.exit(bad ? 1 : 0);
})().catch(e => { console.log('★ 실패: 검사가 터졌습니다 — ' + (e && e.message)); process.exit(1); });
