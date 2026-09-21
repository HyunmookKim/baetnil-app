// 4.101 — 「바깥 누르기」 는 예전 그대로 둔다 (사장님이 「물려라」 하심)
//
// ★ 있었던 일
//   사장님: 「알림창 떴다가 다른 데 아무 데나 누르면 꺼지는 형식으로 바꿨냐?」
//   나는 이 말을 「그렇게 바꾸라」 로 알아듣고 **앱 안의 모든 겹침창**에
//   바깥 누르기를 붙였다. 그런데 사장님이 물으신 것은 바꿨느냐 **여부**였다.
//   사장님: 「지금 좋게 잘 만들어 놓은 거 네가 뭉개 버리는 거 같다」 → 「물려라」
//
// ★ 그래서 이 검사는 **되돌린 자리가 다시 안 뒤집히게** 지킨다.
//   내가 다음 판에서 또 「고쳐 주겠다」 며 붙이면 여기서 걸린다.
//     · 알림창(tellOv) — 바깥을 눌러도 **안 꺼진다**. 단추로만 닫는다.
//     · 서랍·줄 차림표·도움말 — 예전부터 바깥을 누르면 꺼졌다. 그대로 둔다.
//   그리고 그때 만들었던 OVERLAY_BGTAP·bgTapClose 는 **없어야 한다.**
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const FILE = process.argv[2] || 'work.html';
const server = http.createServer((rq, rs) => {
  const f = ((rq.url === '/' && path.isAbsolute(FILE)) ? FILE : path.join(__dirname, rq.url === '/' ? FILE : rq.url.split('?')[0]));
  fs.readFile(f, (e, d) => { if(e){ rs.writeHead(404); rs.end(); return; } rs.writeHead(200); rs.end(d); });
});
let ok = 0, bad = 0;
const T = (n, c, w) => { if(c){ ok++; console.log('통과: ' + n); }
  else { bad++; console.log('★ 실패: ' + n + (w !== undefined ? ' — ' + JSON.stringify(w).slice(0, 200) : '')); } };

(async () => {
  await new Promise(r => server.listen(0, r));
  const br = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const pg = await (await br.newContext({ locale:'ko-KR', viewport:{ width:390, height:844 },
                                          isMobile:true, hasTouch:true })).newPage();
  const errs = []; pg.on('pageerror', e => errs.push(String(e).slice(0, 140)));
  await pg.goto('http://127.0.0.1:' + server.address().port + '/', { waitUntil:'domcontentloaded' });
  await pg.waitForTimeout(1200);
  await pg.evaluate(() => { try{ skipWelcome(); }catch(_){} });
  await pg.waitForTimeout(300);

  const 바깥누르기 = async () => { await pg.mouse.click(4, 4); await pg.waitForTimeout(250); };
  const 열렸나 = id => pg.evaluate(x => {
    const e = document.getElementById(x);
    if(!e) return false;
    const st = getComputedStyle(e);
    return st.display !== 'none' && st.visibility !== 'hidden';
  }, id);

  // ── ① 알림창 — 바깥을 눌러도 **안 꺼진다** (사장님이 물리라 하신 자리)
  await pg.evaluate(() => { window.__r = 'none';
    tell('저장하지 못했습니다', { big:true }).then(v => { window.__r = v; }); });
  await pg.waitForTimeout(300);
  T('알림창이 떴다', await 열렸나('tellOv'));
  await 바깥누르기();
  T('★★★ 알림창은 바깥을 눌러도 안 꺼진다 (사장님이 물리라 하심)', await 열렸나('tellOv'));
  T('★★★ 그래서 아직 아무 답도 안 돌아왔다', await pg.evaluate(() => window.__r === 'none'));
  await pg.evaluate(() => document.querySelector('#tellBtns button').click());
  await pg.waitForTimeout(200);
  T('★★ 단추를 누르면 닫힌다', (await 열렸나('tellOv')) === false);

  // ── ② 물음창도 마찬가지다 — 지울지 물어보는 창이 손이 스쳤다고 닫히면 안 된다
  await pg.evaluate(() => { window.__a = 'none'; ask('지울까요?', { warn:true }).then(v => { window.__a = v; }); });
  await pg.waitForTimeout(300);
  await 바깥누르기();
  T('★★★ 물음창도 바깥을 눌러도 안 꺼진다', await 열렸나('tellOv'));
  T('★★ 아직 답이 안 돌아왔다', await pg.evaluate(() => window.__a === 'none'));
  await pg.evaluate(() => tellClose());
  await pg.waitForTimeout(200);

  // ── ③ 서랍은 **예전부터** 바깥을 누르면 꺼졌다. 그대로다.
  await pg.evaluate(() => openDrawer());
  await pg.waitForTimeout(300);
  T('서랍이 열렸다', await 열렸나('drawerOv'));
  await 바깥누르기();
  T('★★ 서랍은 예전대로 바깥을 누르면 꺼진다', (await 열렸나('drawerOv')) === false);

  // ── ④ 줄 차림표도 예전대로다
  await pg.evaluate(() => {
    const a = document.createElement('button');
    a.textContent = '기준';
    a.style.cssText = 'position:fixed;left:120px;top:400px;width:60px;height:30px';
    document.body.appendChild(a);
    pmOpen(a, [['a', '가나다순'], ['b', '추가순']], 'a', () => {});
  });
  await pg.waitForTimeout(250);
  T('줄 차림표가 열렸다', await 열렸나('pmOv'));
  await 바깥누르기();
  T('★★ 줄 차림표는 예전대로 바깥을 누르면 꺼진다',
    (await pg.evaluate(() => document.getElementById('pmOv').classList.contains('open'))) === false);

  // ── ⑤ 그때 만들었던 것이 남아 있지 않은가 (물린 것을 확실히 물렸는가)
  const 남은것 = await pg.evaluate(() => ({
    표: typeof OVERLAY_BGTAP !== 'undefined',
    함수: typeof bgTapClose !== 'undefined',
    묶기: typeof bindBgTaps !== 'undefined'
  }));
  T('★★★ OVERLAY_BGTAP 이 없다 (물렸다)', 남은것.표 === false, 남은것);
  T('★★★ bgTapClose 가 없다 (물렸다)', 남은것.함수 === false, 남은것);
  T('★★★ bindBgTaps 가 없다 (물렸다)', 남은것.묶기 === false, 남은것);

  // ── ⑥ 예전 방식(붙박이 onclick)이 그대로 붙어 있는가
  const 붙박이 = await pg.evaluate(() => ({
    서랍: (document.getElementById('drawerOv') || {}).getAttribute
          ? document.getElementById('drawerOv').getAttribute('onclick') : null,
    차림표: (document.getElementById('pmOv') || {}).getAttribute
          ? document.getElementById('pmOv').getAttribute('onclick') : null
  }));
  T('★★ 서랍은 예전 그대로 onclick="closeDrawer()" 다', /closeDrawer/.test(붙박이.서랍 || ''), 붙박이);
  T('★★ 줄 차림표는 예전 그대로 onclick="pmClose()" 다', /pmClose/.test(붙박이.차림표 || ''), 붙박이);

  T('앱이 안 터졌다', errs.length === 0, errs);
  await br.close(); server.close();
  console.log(`\n합계: ${ok}개 통과 / ${bad}개 실패`);
  process.exit(bad ? 1 : 0);
})().catch(e => { console.log('★ 실패: 검사가 터졌습니다 — ' + (e && e.message)); process.exit(1); });
