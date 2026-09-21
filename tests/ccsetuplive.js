// 4.102 — 처음 켤 때 말·나라를 고르고, 그 나라 기본 정보가 들어간다 (사장님이 정하신 것)
//
// ★ 사장님 말씀
//   「처음 어플을 깔아 가지고 쓰는 사람들은 가장 처음에 어떤 언어로 할지를 정하게 해 줘야겠지?
//    그다음에 그 국가에 맞는 정보들이 기본적으로 들어가게 해 주는 게 맞겠다」
//   「웹 같은 경우에는 크롬이나 그런 인터넷 프로그램에 설정되는 언어를 기본적으로 따라가게
//    되어 있잖아. 웹은 또 그런 식으로 작동하게 만들어라」
//   「편집한다고 해서 한 명이 바꿨다고 해서 모든 어플 사용자가 다 바뀌게 만들면 안 된다.
//    각자 자기 거에서 자기 것만 바꾸도록 해 주고」
//   「나중에 언어를 도중에 바꿨다고 해서 기본 정보들이 따라서 다 바뀌게 만들면은 안 된다.
//    사용자가 지가 쓰던 정보가 만져져 가지고 바뀌었다는 느낌을 받기도 하고」
//
// ★ 진짜 브라우저에서 **브라우저 말을 바꿔 가며** 켜 본다.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const FILE = process.argv[2] || 'work.html';
const server = http.createServer((rq, rs) => {
  const f = ((rq.url === '/' && path.isAbsolute(FILE)) ? FILE : path.join(__dirname, rq.url === '/' ? FILE : rq.url.split('?')[0]));
  fs.readFile(f, (e, d) => { if(e){ rs.writeHead(404); rs.end(); return; } rs.writeHead(200); rs.end(d); });
});
let ok = 0, bad = 0;
const T = (n, c, w) => { if(c){ ok++; console.log('통과: ' + n); }
  else { bad++; console.log('★ 실패: ' + n + (w !== undefined ? ' — ' + JSON.stringify(w).slice(0, 300) : '')); } };

(async () => {
  await new Promise(r => server.listen(0, r));
  const br = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const PORT = server.address().port;
  const errs = [];

  // ── ① 브라우저 말이 일본어인 사람이 처음 켠다
  const ctxJa = await br.newContext({ locale:'ja-JP', viewport:{ width:390, height:844 },
                                      isMobile:true, hasTouch:true });
  const pj = await ctxJa.newPage();
  pj.on('pageerror', e => errs.push(String(e).slice(0, 140)));
  await pj.goto('http://127.0.0.1:' + PORT + '/', { waitUntil:'domcontentloaded' });
  await pj.waitForTimeout(1500);
  const 첫화면 = await pj.evaluate(async () => {
    // 앱이 1.2초 뒤에 스스로 연다. 여기서는 바로 불러 본다.
    if(!setupDone()) openSetup();
    await new Promise(r=>setTimeout(r,200));
    return { 열림: !!document.querySelector('#mrPanel .mrbtn.big.ok'),
             글: document.getElementById('mrPanel').innerText.slice(0, 400),
             미리고른말: setupLang, 미리고른나라: setupCc, 폰말: langFromDevice() };
  });
  T('★★★ 처음 켜면 말·나라 고르는 화면이 뜬다', 첫화면.열림, 첫화면);
  T('★★★ 브라우저 말(일본어)을 **미리 골라 둔다** — 사람은 확인만 하면 된다',
    첫화면.폰말 === 'ja' && 첫화면.미리고른말 === 'ja', 첫화면);
  T('★★★ 그 말의 나라(일본)도 미리 골라 둔다', 첫화면.미리고른나라 === 'jp', 첫화면);
  // ★ 4.102 — 「고르기/고름/고르지 않음」 을 앱이 이미 쓰던 「선택」 계열로 맞췄다.
  //   다른 앱(삼성·구글·MS·애플)이 목록에서 하나를 고를 때 쓰는 말이 「선택」 이고,
  //   이 앱 사전에도 「선택」·「선택 안 함」 이 이미 있었다. 두 말을 쓰면 사람이 헷갈린다.
  T('★★ 나라를 「선택 안 함」 으로 둘 수도 있다',
    // ★ 4.115 — 일본어를 「選択しない(고르지 않겠다)」 에서 「未選択(안 고름)」 으로 고쳤다.
    //   이 자리는 사람이 하는 말이 아니라 **지금 상태**를 적는 자리다.
    /선택 안 함|未選択|Not selected|Не выбрано/.test(첫화면.글), 첫화면.글);

  // 그대로 시작한다
  await pj.evaluate(() => { setupCc = 'jp'; setupLang = 'ja';
    try{ localStorage.setItem('bt_lang','ja'); }catch(_){}
    setCc('jp'); try{ localStorage.setItem('bt_setup','done'); }catch(_){}
    contacts = contactDefaults(); checkt = checkDefaults(); });
  const 일본것 = await pj.evaluate(() => ({
    번호: contacts.map(c=>c.phone).filter(Boolean),
    이름: contacts.map(c=>c.name),
    점검: checkt.filter(r=>r.label).map(r=>r.label),
    나라: boatCc(), 화폐: curNow() }));
  T('★★★ 일본 사람에게 **해상보안청 118** 이 들어간다', 일본것.번호.indexOf('118') >= 0, 일본것);
  T('★★★ 한국 해경 122 는 안 들어간다 (남의 나라 긴급번호를 주지 않는다)',
    일본것.번호.indexOf('122') < 0, 일본것);
  T('★★ VHF 16 은 어느 나라에나 들어간다 (전 세계 공통)',
    일본것.이름.join(' ').indexOf('VHF') >= 0 || 일본것.이름.join(' ').indexOf('16') >= 0, 일본것.이름);
  T('★★★ 한국 법 줄(원거리 수상레저 신고)은 안 들어간다',
    일본것.점검.join(' ').indexOf('수상레저') < 0
    && 일본것.점검.join(' ').indexOf('水上レジャー') < 0, 일본것.점검);
  T('★★★ 화폐 단위가 円 이다', 일본것.화폐 === '円', 일본것);

  // ── ② 나중에 말을 바꿔도 **기본 정보는 안 바뀐다** (사장님이 못 박으신 것)
  const 말바꾼뒤 = await pj.evaluate(() => {
    const 전 = JSON.stringify(contacts);
    try{ localStorage.setItem('bt_lang','ko'); }catch(_){}   // 말만 바꾼다
    applyLang();
    return { 같나: JSON.stringify(contacts) === 전,
             나라: boatCc(), 번호: contacts.map(c=>c.phone).filter(Boolean) };
  });
  T('★★★ 말을 바꿔도 연락처가 그대로다 (사장님: 정보가 갑자기 바뀌면 혼란이 온다)',
    말바꾼뒤.같나, 말바꾼뒤);
  T('★★★ 말을 바꿔도 나라는 그대로 일본이다', 말바꾼뒤.나라 === 'jp', 말바꾼뒤);
  T('★★ 그래서 118 이 그대로 있다', 말바꾼뒤.번호.indexOf('118') >= 0, 말바꾼뒤);

  // ── ③ 나라를 바꿔도 이미 적은 것은 안 건드린다. 「다시 깔기」 를 눌렀을 때만 바뀐다
  const 나라바꾼뒤 = await pj.evaluate(() => {
    contacts[0].name = '내가 고친 이름';
    setCc('kr');                                   // 나라만 바꾼다
    return { 그대로: contacts[0].name === '내가 고친 이름',
             번호: contacts.map(c=>c.phone).filter(Boolean) };
  });
  T('★★★ 나라를 바꿔도 이미 고친 것은 그대로다', 나라바꾼뒤.그대로, 나라바꾼뒤);
  T('★★★ 나라를 바꿔도 연락처가 저절로 안 바뀐다', 나라바꾼뒤.번호.indexOf('118') >= 0, 나라바꾼뒤);
  const 다시깐뒤 = await pj.evaluate(() => {
    contacts = contactDefaults();                  // 「다시 깔기」 를 누른 것과 같다
    return contacts.map(c=>c.phone).filter(Boolean);
  });
  // ★ 4.110 — 한국 긴급신고 번호를 122 에서 119 로 고쳤다 (2016년 119 로 합쳐졌다).
  T('★★★ 「다시 깔기」 를 눌렀을 때만 그 나라 것으로 바뀐다',
    다시깐뒤.indexOf('119') >= 0 && 다시깐뒤.indexOf('118') < 0, 다시깐뒤);

  // ── ④ 러시아 브라우저
  const ctxRu = await br.newContext({ locale:'ru-RU', viewport:{ width:390, height:844 },
                                      isMobile:true, hasTouch:true });
  const pr = await ctxRu.newPage();
  pr.on('pageerror', e => errs.push(String(e).slice(0, 140)));
  await pr.goto('http://127.0.0.1:' + PORT + '/', { waitUntil:'domcontentloaded' });
  await pr.waitForTimeout(1500);
  const 러 = await pr.evaluate(() => {
    if(!setupDone()) openSetup();
    setCc('ru');
    return { 폰말: langFromDevice(), 미리: setupCc,
             번호: contactDefaults().map(c=>c.phone).filter(Boolean), 화폐: curNow() };
  });
  T('★★ 브라우저 말이 러시아어면 러시아어를 미리 고른다', 러.폰말 === 'ru', 러);
  T('★★★ 러시아 사람에게 112 · 101 이 들어간다',
    러.번호.indexOf('112') >= 0 && 러.번호.indexOf('101') >= 0, 러);
  T('★★★ 화폐 단위가 ₽ 이다', 러.화폐 === '₽', 러);

  // ── ⑤ 나라를 안 고르면 **아무 나라 번호도 안 들이민다**
  const 안고름 = await pr.evaluate(() => { setCc(''); 
    return { 나라: boatCc(), 번호: contactDefaults().map(c=>c.phone).filter(Boolean),
             이름: contactDefaults().map(c=>c.name) }; });
  T('★★★ 나라를 모르면 어느 나라 긴급번호도 안 넣는다 (틀린 번호보다 빈 칸이 낫다)',
    안고름.번호.length === 0, 안고름);
  T('★★ 그래도 VHF 16 은 남는다 (전 세계 공통이라 틀릴 일이 없다)',
    안고름.이름.length === 1, 안고름);

  T('앱이 안 터졌다', errs.length === 0, errs);
  await br.close(); server.close();
  console.log(`\n합계: ${ok}개 통과 / ${bad}개 실패`);
  process.exit(bad ? 1 : 0);
})().catch(e => { console.log('★ 실패: 검사가 터졌습니다 — ' + (e && e.message)); process.exit(1); });
