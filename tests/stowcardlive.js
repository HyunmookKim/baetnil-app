// 4.102 — 「수정」 은 그 물품 카드 **안에서** 한다 (사장님 지적)
//
// ★ 사장님 말씀
//   「수정 버튼 누르면 위에 뭐가 생기면서 수정하게 돼 있냐? 존나 어이가 없네.
//    열려진 그 창에서 바로 수정할 수 있도록 해야 되는 거 아니냐?
//    수정 누르면 이름이랑 사진 넣고 지우는 거 그리고 메모 등등 바로 그 창에서
//    활성화되게 해야지, 이상한 화면 위에 활성화시키는 게 아니라」
//
// ★ 왜 그래 보였나 — 실제로 재 봤다.
//   물품 칸(.pform)은 목록 **맨 위**에 있다. 목록을 한참 내려가서 「수정」 을 누르면
//   그 칸은 화면 위로 **2,215px 밖**에 있었다. 화면은 하나도 안 움직인다.
//   그러니 「눌러도 아무 일이 없다」 가 맞다.
//
// ★ 고친 방법 — 칸을 두 벌로 만들지 않는다. **있는 그 칸을 카드 안으로 옮긴다.**
//   두 벌이면 다음에 칸 하나를 더할 때 반드시 한쪽만 고쳐진다.
//
// ★ 이 검사는 진짜 브라우저에서 **눌러 본다.** 코드를 읽어서는 「보이나」 를 못 잰다.
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

  // ── 칸 하나에 물품 마흔. 사장님처럼 **한참 내려가서** 누른다.
  const 그림 = 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';
  await pg.evaluate(사진 => {
    if(!unlocked) toggleLock();
    lockers = [{ id:'L1', zone:'살롱 중앙', label:'의자 아래', x:10,y:10,w:20,h:20, deck2:false }];
    items = [];
    for(let i=1;i<=40;i++) items.push({ id:i, name:'물건'+i, qty:'1', unit:'', note:'',
      lockerId:'L1', zone:'살롱 중앙', locker:'의자 아래',
      photos: i===12 ? [사진, 사진] : [], parentId:null });
    items.push({ id:99, name:'공구함', qty:'1', unit:'', note:'', box:true,
                 lockerId:'L1', zone:'살롱 중앙', locker:'의자 아래', photos:[], parentId:null });
    save(); refreshBoxes(); openLocker('L1');
  }, 그림);
  await pg.waitForTimeout(400);

  const 재기 = (id) => pg.evaluate(x => {
    const card = document.querySelector('.it[data-id="' + x + '"]');
    const cr = card ? card.getBoundingClientRect() : null;
    const inCard = document.querySelector('.it[data-id="' + x + '"] .pform');
    const f = document.querySelector('#panel .pform');
    const fr = f ? f.getBoundingClientRect() : null;
    return {
      칸이카드안에: !!inCard,
      칸이보이나: !!fr && fr.bottom > 0 && fr.top < innerHeight,
      카드가보이나: !!cr && cr.bottom > 0 && cr.top < innerHeight,
      editId: (typeof editId === 'undefined') ? null : editId,
      이름칸: (document.getElementById('fName')||{}).value,
      사진수: document.querySelectorAll('#photoPrev .rm').length,
      단추: (document.getElementById('addBtn')||{}).textContent,
      취소보임: (document.getElementById('cancelBtn')||{}).style
                 ? document.getElementById('cancelBtn').style.display !== 'none' : null
    };
  }, id);

  // ── ① 아래로 한참 내려가서 카드를 열고 「수정」 을 누른다
  await pg.evaluate(() => { window.scrollTo(0, 99999); });
  await pg.waitForTimeout(250);
  await pg.evaluate(() => itemTap(12));
  await pg.waitForTimeout(300);
  await pg.evaluate(() => { const b = [...document.querySelectorAll('.it[data-id="12"] .pbtn')]
      .find(x => x.textContent.indexOf('수정') >= 0); b.click(); });
  await pg.waitForTimeout(1300);          // 스르르 굴러가는 것을 기다린다
  const A = await 재기(12);
  T('★★★ 고치는 칸이 그 물품 카드 **안에** 열린다', A.칸이카드안에, A);
  T('★★★ 그 칸이 화면 안에 보인다 (여태는 2,215px 밖이었다)', A.칸이보이나, A);
  T('★★ 카드도 화면 안에 있다', A.카드가보이나, A);
  T('★★ 이름이 그 물품 이름으로 차 있다', A.이름칸 === '물건12', A);
  T('★★★ 사진을 지우는 ✕ 가 사진마다 있다 — ' + A.사진수, A.사진수 === 2, A);
  T('★★ 사진을 넣는 [촬영]·[앨범] 이 그 카드 안에 있다',
    await pg.evaluate(() => [...document.querySelectorAll('.it[data-id="12"] .pform .pbtn')]
      .map(b => b.textContent).join(',').indexOf('촬영') >= 0));
  T('★★ 비고 칸도 그 카드 안에 있다',
    await pg.evaluate(() => !!document.querySelector('.it[data-id="12"] .pform #fNote')));
  T('★★ 단추가 「수정 완료」 로 바뀐다', /수정 완료/.test(A.단추 || ''), A);
  T('★★ 「취소」 가 나온다', A.취소보임 === true, A);

  // ── ② 위쪽에는 아무 칸도 안 남는다 (두 벌이 아니다 — 문 하나)
  T('★★★ 물품 칸은 앱 안에 딱 하나뿐이다',
    (await pg.evaluate(() => document.querySelectorAll('#panel .pform').length)) === 1);

  // ── ③ 사진 한 장을 지운다
  await pg.evaluate(() => document.querySelector('.it[data-id="12"] #photoPrev .rm').click());
  await pg.waitForTimeout(200);
  T('★★★ ✕ 를 누르면 사진이 한 장 줄어든다',
    (await pg.evaluate(() => document.querySelectorAll('#photoPrev .rm').length)) === 1);

  // ── ④ 이름·비고를 고치고 「수정 완료」
  await pg.evaluate(() => { document.getElementById('fName').value = '아크릴판';
                            document.getElementById('fNote').value = '뱃머리 쪽'; });
  await pg.evaluate(() => document.getElementById('addBtn').click());
  await pg.waitForTimeout(600);
  const 바뀐 = await pg.evaluate(() => { const it = items.find(x=>x.id===12);
    return { 이름: it.name, 비고: it.note, 사진: (it.photos||[]).length }; });
  T('★★★ 이름이 바뀐다', 바뀐.이름 === '아크릴판', 바뀐);
  T('★★★ 비고가 바뀐다', 바뀐.비고 === '뱃머리 쪽', 바뀐);
  T('★★★ 지운 사진이 실제로 빠진다', 바뀐.사진 === 1, 바뀐);
  const B = await 재기(12);
  T('★★★ 다 하면 칸이 제자리로 돌아간다 (새 물품 추가 자리)', B.칸이카드안에 === false, B);
  T('★★ 고치는 중이 아니다', B.editId === null, B);
  T('★★ 단추가 「+ 추가」 로 돌아온다', /추가/.test(B.단추 || ''), B);

  // ── ⑤ 「취소」 도 제자리로
  await pg.evaluate(() => startEdit(20));
  await pg.waitForTimeout(900);
  T('★★ 다시 고치기를 열면 또 카드 안이다', (await 재기(20)).칸이카드안에);
  await pg.evaluate(() => document.getElementById('cancelBtn').click());
  await pg.waitForTimeout(400);
  T('★★★ 취소하면 칸이 제자리로 돌아간다', (await 재기(20)).칸이카드안에 === false);

  // ── ⑥ ★ 뒤로 가기로도 빠져나온다 (사장님이 정하신 것 1 — 올리기를 만들면 내리기도)
  await pg.evaluate(() => startEdit(20));
  await pg.waitForTimeout(900);
  await pg.evaluate(() => navDoBack());
  await pg.waitForTimeout(400);
  const C = await 재기(20);
  T('★★★ 뒤로 가기가 고치기를 물린다', C.editId === null, C);
  T('★★★ 그때 적재표는 그대로 열려 있다 (통째로 안 꺼진다)',
    await pg.evaluate(() => document.getElementById('panel').classList.contains('open')));

  // ── ⑦ 상자도 같다
  await pg.evaluate(() => startEdit(99));
  await pg.waitForTimeout(900);
  T('★★★ 상자도 그 줄 안에서 고친다',
    await pg.evaluate(() => !!document.querySelector('.it[data-id="99"] .pform')));
  await pg.evaluate(() => cancelEdit());
  await pg.waitForTimeout(300);

  // ── ⑧ 보기 전용으로 바꾸면 고치던 것이 취소되고 칸도 제자리로
  await pg.evaluate(() => startEdit(5));
  await pg.waitForTimeout(700);
  await pg.evaluate(() => toggleLock());
  await pg.waitForTimeout(400);
  T('★★★ 보기 전용으로 바꾸면 고치기가 꺼진다',
    await pg.evaluate(() => editId === null));
  T('★★★ 그때 칸도 제자리로 간다 (카드 안에 남지 않는다)',
    await pg.evaluate(() => !document.querySelector('.it .pform')));

  T('앱이 안 터졌다', errs.length === 0, errs);
  await br.close(); server.close();
  console.log(`\n합계: ${ok}개 통과 / ${bad}개 실패`);
  process.exit(bad ? 1 : 0);
})().catch(e => { console.log('★ 실패: 검사가 터졌습니다 — ' + (e && e.message)); process.exit(1); });
