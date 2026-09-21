// 4.101 — 알림창 두 갈래: 큰 창과 잠깐 알림
//
// ★ 사장님 말씀
//   「휴지통이나 이런 것들은 확실하게 알람이 떠 가지고 거기에 이제 크게 뜨잖아…
//    「같은 물품이 없습니다」 이거는 좀 상황이 다르잖아. 이거는 화면 거기에 전체적으로
//    크게 뜨는 게 아니라 그냥 조그맣게 이렇게 올라오잖아. 그런 것들 같은 경우에는
//    다른 데 누르면 없어지던지 아니면 몇 초 뒤에 없어지는 게 일반적인데?
//    너는 그거를 아예 구분을 못 하는 거 같구나」
//
// ★ 그래서 정한 것 (사장님이 ①②③ 으로 정하심)
//   ① 다섯 갈래로 나눈다 — 입력칸 잘못 / 됐다 / 실패 / 규칙상 못 함 / 막힘
//   ② 바깥 누르기는 물린다 (알림창은 예전대로 단추로만 닫는다)
//   ③ 잠깐 알림은 3초, 단추가 붙은 것은 5초
//
// ★ 이 검사는 **진짜 브라우저에서 시계를 재 본다.** 코드를 읽어서는 이걸 못 잰다.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const FILE = process.argv[2] || 'work.html';
const server = http.createServer((rq, rs) => {
  const f = ((rq.url === '/' && path.isAbsolute(FILE)) ? FILE : path.join(__dirname, rq.url === '/' ? FILE : rq.url.split('?')[0]));
  fs.readFile(f, (e, d) => { if(e){ rs.writeHead(404); rs.end(); return; } rs.writeHead(200); rs.end(d); });
});
let ok = 0, bad = 0;
const T = (n, c, w) => { if(c){ ok++; console.log('통과: ' + n); }
  else { bad++; console.log('★ 실패: ' + n + (w !== undefined ? ' — ' + JSON.stringify(w).slice(0, 240) : '')); } };

(async () => {
  await new Promise(r => server.listen(0, r));
  const br = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const pg = await (await br.newContext({ locale:'ko-KR', viewport:{ width:390, height:844 },
                                          isMobile:true, hasTouch:true })).newPage();
  const errs = []; pg.on('pageerror', e => errs.push(String(e).slice(0, 160)));
  await pg.goto('http://127.0.0.1:' + server.address().port + '/', { waitUntil:'domcontentloaded' });
  await pg.waitForTimeout(1200);
  await pg.evaluate(() => { try{ skipWelcome(); }catch(_){} });
  await pg.waitForTimeout(300);

  const 떠있나 = () => pg.evaluate(() => {
    const e = document.getElementById('snack');
    return !!(e && e.classList.contains('on'));
  });
  const 큰창 = () => pg.evaluate(() => {
    const e = document.getElementById('tellOv');
    return !!e && getComputedStyle(e).display !== 'none' && e.classList.contains('open');
  });

  // ── ① 기본은 잠깐 알림이다. 큰 창이 아니다.
  await pg.evaluate(() => tell('같은 이름 없음'));
  await pg.waitForTimeout(120);
  T('★★★ tell() 은 화면 아래 잠깐 알림으로 뜬다', await 떠있나());
  T('★★★ 그때 큰 창은 안 뜬다 (손가락을 한 번 더 쓰지 않는다)', (await 큰창()) === false);

  // ★ 화면을 막지 않는다 — 알림이 떠 있어도 그 뒤를 누를 수 있어야 한다
  const 막나 = await pg.evaluate(() => {
    const e = document.getElementById('snack');
    const r = e.getBoundingClientRect();
    // 알림 바로 위 100px 자리에 무엇이 있나 — 알림이 화면을 덮으면 알림이 잡힌다
    const 위 = document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top) - 100);
    return !!(위 && (위.id === 'snack' || (위.closest && 위.closest('#snack'))));
  });
  T('★★★ 잠깐 알림은 화면을 안 막는다 (뒤를 그대로 누를 수 있다)', 막나 === false);

  // ── ② 저절로 꺼진다 — 3초
  T('★★ 3초 전에는 아직 떠 있다', await (async () => { await pg.waitForTimeout(2000); return 떠있나(); })());
  await pg.waitForTimeout(1500);
  T('★★★ 짧은 알림은 3초 뒤에 저절로 꺼진다', (await 떠있나()) === false);

  // ── ③ 톡 누르면 바로 꺼진다
  await pg.evaluate(() => tell('같은 이름 없음'));
  await pg.waitForTimeout(150);
  const r = await pg.evaluate(() => {
    const b = document.getElementById('snack').getBoundingClientRect();
    return { x: Math.round(b.left + b.width / 2), y: Math.round(b.top + b.height / 2) };
  });
  await pg.mouse.click(r.x, r.y);
  await pg.waitForTimeout(200);
  T('★★★ 톡 누르면 바로 꺼진다', (await 떠있나()) === false);

  // ── ④ 밀면 꺼진다 (머티리얼이 정한 두 번째 길)
  await pg.evaluate(() => tell('같은 이름 없음'));
  await pg.waitForTimeout(150);
  await pg.mouse.move(r.x, r.y);
  await pg.mouse.down();
  await pg.mouse.move(r.x + 90, r.y, { steps: 6 });
  await pg.mouse.up();
  await pg.waitForTimeout(200);
  T('★★★ 옆으로 밀면 꺼진다', (await 떠있나()) === false);

  // ── ⑤ 단추가 붙은 것은 5초를 준다 (3초로는 누를 겨를이 없다)
  await pg.evaluate(() => { window.__눌림 = 0;
    tell('{n}개를 옮겼습니다.', { kind:'good', act:{ name:'되돌리기', fn: () => { window.__눌림++; } } }); });
  await pg.waitForTimeout(3400);
  T('★★★ 단추가 붙은 알림은 3초에 안 꺼진다', await 떠있나());
  T('★★ 단추가 화면에 있다', await pg.evaluate(() => !!document.querySelector('#snack .skbtn')));
  await pg.evaluate(() => document.querySelector('#snack .skbtn').click());
  await pg.waitForTimeout(200);
  T('★★★ 단추를 누르면 그 일이 실제로 돈다', await pg.evaluate(() => window.__눌림 === 1));
  T('★★ 단추를 누르면 알림이 꺼진다', (await 떠있나()) === false);

  // ★ 5초는 채우고 꺼진다
  await pg.evaluate(() => tell('되돌릴 수 있습니다', { act:{ name:'되돌리기', fn: () => {} } }));
  await pg.waitForTimeout(5400);
  T('★★★ 단추가 붙은 알림도 5초 뒤에는 저절로 꺼진다', (await 떠있나()) === false);

  // ── ⑥ 글이 길면 3초로는 못 읽는다 — 5초를 준다
  await pg.evaluate(() => tell('사진이 너무 커서 저장할 수 없습니다. 더 단순한 도면 사진을 써 주세요. 아주 긴 글입니다.'));
  await pg.waitForTimeout(3400);
  T('★★★ 긴 글은 3초에 안 꺼진다 (읽을 겨를을 준다)', await 떠있나());
  await pg.evaluate(() => snackHide());

  // ── ⑦ 됐다/실패가 눈으로 구별된다
  await pg.evaluate(() => tell('저장했습니다.', { kind:'good' }));
  await pg.waitForTimeout(120);
  T('★★ 됐다는 초록으로 뜬다', await pg.evaluate(() => document.getElementById('snack').classList.contains('good')));
  await pg.evaluate(() => tell('올리지 못했습니다.', { kind:'bad' }));
  await pg.waitForTimeout(120);
  const 갈래 = await pg.evaluate(() => { const c = document.getElementById('snack').classList;
    return { bad: c.contains('bad'), good: c.contains('good') }; });
  T('★★★ 실패는 빨강으로 뜨고, 앞의 초록은 남지 않는다', 갈래.bad && !갈래.good, 갈래);
  await pg.evaluate(() => snackHide());

  // ── ⑧ 큰 창은 `{ big:true }` 로 밝힌 자리에서만 뜬다
  await pg.evaluate(() => { window.__b = null;
    tell('폰에서 이 앱의 알림이 막혀 있습니다.', { big:true }).then(v => { window.__b = v; }); });
  await pg.waitForTimeout(250);
  T('★★★ { big:true } 는 큰 창으로 뜬다', await 큰창());
  T('★★ 그때 잠깐 알림은 안 뜬다', (await 떠있나()) === false);

  // ★★★ ② 사장님이 「물려라」 하신 것 — 알림창은 바깥을 눌러도 안 꺼진다
  await pg.mouse.click(4, 4);
  await pg.waitForTimeout(250);
  T('★★★ 큰 창은 바깥을 눌러도 안 꺼진다 (사장님이 물리라 하심)', await 큰창());
  await pg.evaluate(() => document.querySelector('#tellBtns button').click());
  await pg.waitForTimeout(200);
  T('★★ 단추를 누르면 닫힌다', (await 큰창()) === false);

  // ── ⑨ 입력칸 잘못은 그 칸 아래 빨간 한 줄로 나온다 (잠깐 알림이 아니다)
  await pg.evaluate(() => openForm({
    title:'검사', okText:'저장',
    fields:[{ key:'name', label:'이름', value:'' }, { key:'zone', label:'구역', value:'' }],
    onOk: v => { if(!v.name) return formErr('name', '이름을 넣어 주세요'); return true; }
  }));
  await pg.waitForTimeout(300);
  await pg.evaluate(() => formOk());
  await pg.waitForTimeout(300);
  const 줄 = await pg.evaluate(() => {
    const e = document.querySelector('#formBody .ferr[data-k="name"]');
    const z = document.querySelector('#formBody .ferr[data-k="zone"]');
    return { 켜짐: !!(e && e.classList.contains('on')), 글: e ? e.textContent : '',
             딴칸: !!(z && z.classList.contains('on')),
             칸빨강: !!(e && e.closest('.frow') && e.closest('.frow').classList.contains('bad')) };
  });
  T('★★★ 잘못된 칸 **바로 아래**에 빨간 한 줄이 뜬다', 줄.켜짐 && /이름/.test(줄.글), 줄);
  T('★★ 다른 칸에는 안 뜬다', 줄.딴칸 === false, 줄);
  T('★★ 그 칸 테두리가 빨개진다', 줄.칸빨강, 줄);
  T('★★★ 그때 잠깐 알림은 안 뜬다 (같은 말을 두 군데서 하지 않는다)', (await 떠있나()) === false);
  T('★★ 입력창이 안 닫힌다 (고칠 자리를 그대로 둔다)',
    await pg.evaluate(() => getComputedStyle(document.getElementById('formOv')).display !== 'none'));

  // 고쳐 넣으면 빨간 줄이 사라진다
  await pg.evaluate(() => { const i = document.querySelector('#formBody .frow input'); i.value = '테스트'; });
  await pg.evaluate(() => formOk());
  await pg.waitForTimeout(300);
  T('★★★ 고쳐 넣으면 빨간 줄이 사라진다',
    await pg.evaluate(() => !document.querySelector('#formBody .ferr.on')));

  // ── ⑩ 입력창을 안 쓰는 화면의 칸에도 같은 빨간 줄이 붙는다
  const 밖 = await pg.evaluate(() => {
    const box = document.createElement('div');
    box.innerHTML = '<input id="__t1">';
    document.body.appendChild(box);
    fieldErr('__t1', '이름을 넣어 주세요');
    const ln = document.getElementById('__t1').nextElementSibling;
    const r = { 켜짐: !!(ln && ln.classList.contains('ferr') && ln.classList.contains('on')),
                글: ln ? ln.textContent : '',
                테두리: document.getElementById('__t1').classList.contains('badin') };
    return r;
  });
  T('★★★ 입력창 밖의 칸에도 바로 아래 빨간 줄이 붙는다', 밖.켜짐 && /이름/.test(밖.글), 밖);
  T('★★ 그 칸 테두리도 빨개진다', 밖.테두리, 밖);
  T('★★ 그때도 잠깐 알림은 안 뜬다', (await 떠있나()) === false);
  T('★★★ formErrClear() 가 입력창 밖의 줄도 끈다',
    await pg.evaluate(() => { formErrClear();
      const ln = document.getElementById('__t1').nextElementSibling;
      return !ln.classList.contains('on') && !document.getElementById('__t1').classList.contains('badin'); }));

  T('앱이 안 터졌다', errs.length === 0, errs);
  await br.close(); server.close();
  console.log(`\n합계: ${ok}개 통과 / ${bad}개 실패`);
  process.exit(bad ? 1 : 0);
})().catch(e => { console.log('★ 실패: 검사가 터졌습니다 — ' + (e && e.message)); process.exit(1); });
