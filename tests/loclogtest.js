// 위치정보 이용·제공사실 확인자료 — 자동으로 남는가.
//
// ★ 왜 이 검사가 있나
//   위치정보법 제16조 제2항은 위치정보를 다루는 사업자에게
//   「수집·이용·제공사실 확인자료를 위치정보시스템에 자동으로 기록·보존」 하라고 한다.
//   안 하면 신고 자체가 거짓이 된다. 그리고 제24조는 본인이 그것을 열람할 수 있어야 한다고 한다.
//
//   여기서 제일 중요한 것은 「자동」 이다.
//   자리를 새로 만들 때마다 사람이 손으로 한 줄씩 붙이면 반드시 한 곳을 빠뜨린다.
//   그래서 앱 어디서도 navigator.geolocation 을 직접 부르지 못하게 하고
//   geoGet() 한 곳만 지나가게 했다. 이 검사가 그 담장을 지킨다.
//
//   그리고 ★ 좌표는 남기지 않는다. 법이 요구하는 것은 「썼다는 사실」 이지 위치가 아니다.
//   좌표까지 쌓으면 지켜야 할 위험한 자료가 하나 더 생길 뿐이다.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const FILE = process.argv[2] || 'work.html';
// ★ 4.102 — 검사 폴더 안의 **옛 work.html** 을 보고 있었다. runall 은 그 파일을 지우므로
//   여기서만 「파일이 없다」 로 죽었다. 다른 검사들처럼 넘겨받은 길을 그대로 쓴다.
const src = fs.readFileSync(fs.existsSync(FILE) ? FILE : path.join(__dirname, FILE), 'utf8');
const rules = (()=>{ try{ return fs.readFileSync(path.join(__dirname,'firestore_rules.txt'),'utf8'); }
                     catch(e){ return ''; } })();

let ok = 0, bad = 0;
const T = (n, c, w) => { if(c){ ok++; console.log('통과: ' + n); }
  else { bad++; console.log('★ 실패: ' + n + (w !== undefined ? ' — ' + JSON.stringify(w).slice(0,240) : '')); } };

function grab(name){
  const i = src.indexOf('function ' + name + '(');
  if(i < 0) return '';
  let d = 0, j = src.indexOf('{', i);
  for(; j < src.length; j++){ if(src[j]==='{') d++; else if(src[j]==='}'){ d--; if(!d){ j++; break; } } }
  return src.slice(i, j);
}

// ── ① ★ 담장 — 위치를 직접 읽는 곳이 geoGet 말고는 없다
{
  const all = (src.match(/navigator\.geolocation\.getCurrentPosition\s*\(/g) || []).length;
  const inWrap = /navigator\.geolocation\.getCurrentPosition\s*\(/.test(grab('geoGet'));
  T('위치를 읽는 문 geoGet() 이 있다', !!grab('geoGet'));
  T('★★ 앱 어디서도 위치를 직접 읽지 않는다 (geoGet 한 곳뿐)',
    all === 1 && inWrap, { 직접부른곳: all, 문안에있나: inWrap });
  // watchPosition 도 마찬가지다 — 항적이 붙으면 여기로 온다
  const w = (src.match(/navigator\.geolocation\.watchPosition\s*\(/g) || []).length;
  T('계속 받아보기(watchPosition)도 직접 부르는 곳이 없다', w === 0, w);
}

// ── ② 위치를 쓰는 여섯 자리가 다 문을 지나간다
{
  const SITES = [
    ['setupUseGPS', '배 등록 화면에서 홈포트 잡기'],
    ['portUseGPS',  '홈포트 위치 고치기'],
    ['spotUseGPS',  '정박지 위치 찍기'],
    ['posHere',     '항해일지의 지금 여기'],
    ['wxUseGPS',    '지금 있는 곳 날씨'],
    ['wxSpotGPS',   '날씨 지점 잡기'],
  ];
  SITES.forEach(([fn, name]) => {
    const body = grab(fn);
    T(name + ' (' + fn + ') 이 문을 지나간다', !!body && /geoGet\s*\(/.test(body),
      body ? body.slice(0,120) : '(함수가 없다)');
  });
}

// ── ③ ★ 좌표는 안 남긴다 — 다만 스위치로 켤 수 있어야 한다
//   (4.11 에서는 「lgAdd 가 lat·lon 을 아예 안 받는다」 로 검사했다.
//    4.12 에서 감독기관 답을 기다리는 동안 스위치를 달았으므로 전제를 바꿨다.
//    대신 스위치가 장식이 아닌지 — 꺼짐/켜짐 양쪽을 실제로 돌려서 본다.)
{
  const add = grab('lgAdd');
  T('기록 함수 lgAdd 가 있다', !!add);
  T('★ 좌표를 남길지 고르는 스위치가 있고, 기본은 꺼짐이다',
    /LG_KEEP_POS\s*=\s*false/.test(src), (src.match(/LG_KEEP_POS\s*=\s*\w+/) || [])[0]);
  const wrap = grab('geoGet');
  T('★ 문에서 좌표를 기록으로 넘기지 않는다',
    !!wrap && !/lgAdd\([^)]*coords/.test(wrap), wrap.slice(0,200));

  if(add){
    const run = keep => {
      const F = new Function('KEEP',
        'const LG_KEEP_POS = KEEP, LG_MAX = 3000;\n' +
        'let lgRows = [];\n' +
        'const newId = () => "t" + lgRows.length;\n' +
        'const lgLoad = () => lgRows;\n' +
        'const lgSave = () => {};\n' +
        'const lgSchedUp = () => {};\n' +
        'const lgPrune = (r) => r;\n' +
        // ★ 4.25 부터 lgAdd 가 수집요청인(lgWho)을 함께 남긴다 — 센터 회신에 맞춘 것.
        //   떼어 내 돌릴 때도 그 문이 있어야 한다.
        (grab('lgWho') || 'function lgWho(){ return "본인"; }') + '\n' +
        add + '\n' +
        'return lgAdd("수집", "시험", { lat: 34.7404, lon: 127.7357 });');
      return F(keep);
    };
    const off = run(false), on = run(true);
    T('★★ 스위치가 꺼져 있으면 좌표를 넘겨도 안 들어간다',
      JSON.stringify(off).indexOf('34.74') < 0 && JSON.stringify(off).indexOf('127.7') < 0, off);
    T('★★ 스위치를 켜면 좌표가 들어간다 (장식이 아니다)',
      JSON.stringify(on).indexOf('34.74') >= 0 && JSON.stringify(on).indexOf('127.7') >= 0, on);
  } else {
    T('★★ 스위치가 꺼져 있으면 좌표를 넘겨도 안 들어간다', false, 'lgAdd 가 없다');
    T('★★ 스위치를 켜면 좌표가 들어간다 (장식이 아니다)', false, 'lgAdd 가 없다');
  }
}

// ── ③-2 ★ 동의 없이는 위치를 안 읽는다 (법 제15조·제18조)
{
  const wrap = grab('geoGet');
  // ★ 문은 locMay 를 부르고, locMay 안에서 동의(locAsk)를 본다. 사슬이 끊기지 않았는지 본다.
  T('★★ 문이 동의를 먼저 확인한다',
    !!wrap && /locMay\s*\(/.test(wrap) && /locAsk\s*\(/.test(grab('locMay')),
    { 문: wrap.slice(0,200), locMay: grab('locMay').slice(0,200) });
  T('동의를 판정하는 곳이 한 군데다 (locOK)', !!grab('locOK'));
  T('동의를 켜고 끄는 곳이 있다 (locSet)', !!grab('locSet'));
  T('★ 동의를 거두는 것도 확인자료에 남는다',
    /lgAdd\('동의·철회'/.test(grab('locSet')), grab('locSet').slice(0,300));
  T('화면에서 동의를 거둘 수 있다 (법 제24조)', !!grab('lgToggleConsent'));
}

// ── ③-2b ★ 개인위치정보는 로그인한 회원에게만 받는다
//   로그인 안 한 사람의 위치를 아예 안 받으면, 그 사람의 확인자료를 보존할 의무도 생기지 않는다.
{
  const wrap = grab('geoGet');
  T('★★ 문이 로그인부터 확인한다', !!wrap && /locMay\s*\(/.test(wrap), wrap.slice(0,320));
  T('로그인 판정이 한 곳이다 (locSignedIn)', !!grab('locSignedIn'));
  T('로그인·동의를 함께 보는 곳이 있다 (locMay)', !!grab('locMay'));
  const may = grab('locMay');
  T('★ 로그인이 없으면 동의를 묻기 전에 막는다',
    !!may && may.indexOf('locSignedIn') < may.indexOf('locAsk'), may.slice(0,300));
  T('약관에도 「로그인한 회원에게만」 이 적혀 있다',
    /로그인한 회원이고/.test(src) && /signed in/i.test(src) && /вошли в учётную запись/.test(src));
  // 화면을 열자마자 저절로 부르는 자리는 캐묻지 않는다
  T('★ 저절로 부르는 자리는 조용히 넘어간다 (quiet)',
    (src.match(/quiet\s*:\s*(!!quiet|true)/g) || []).length >= 5,
    (src.match(/quiet\s*:\s*(!!quiet|true)/g) || []).length);
}

// ── ③-3 접근사실의 전자적 자동 기록 (시행령 제20조 제2항 제3호)
{
  T('★ 클라우드에서 좌표를 받아 가는 것도 기록한다',
    /lgAdd\('접근'/.test(src), (src.match(/.{0,60}lgAdd\('접근'.{0,80}/) || [''])[0]);
}

// ── ③-4 ★ 열람은 「요구하면 응한다」 다 (법 제24조). 화면을 만들 의무가 아니다.
//   4.11~4.14 에서 서랍에 「내 위치정보 이용내역」 탭을 만들었다가 4.15 에서 없앴다.
//   까닭 — 다른 앱들도 그런 탭을 두지 않는다. 잡코리아 약관은 「회사의 소정의 절차를
//   통해 요구할 수 있다」 하고 책임자 연락처만 적어 둔다.
//   확인자료는 사업자가 보관하는 기록이므로, 요구가 오면 꺼내 주면 된다.
{
  T('★★ 서랍에 「내 위치정보 이용내역」 탭이 없다',
    !/openLocLog/.test(src), (src.match(/.{0,60}openLocLog.{0,40}/) || [''])[0]);
  T('★ 목록 화면과 내려받기도 남아 있지 않다',
    !/function lgExport\(/.test(src) && !/function lgRowHtml\(/.test(src));
  T('★★ 그래도 기록은 그대로 남는다 (없앤 것은 화면뿐이다)',
    !!grab('lgAdd') && !!grab('lgPrune') && /window\.__loclog/.test(src));
  T('★ 약관에 열람을 어디로 요구하는지 적혀 있다',
    /위치정보관리책임자에게 연락하시면/.test(src) &&
    /Contact the location information manager/.test(src) &&
    /Обратитесь к ответственному/.test(src));
  T('★ 요구가 오면 사업자가 꺼낼 수 있다 (규칙에 최고 운영자 읽기)',
    /appOwner\(\)/.test(rules) &&
    /match \/loclog\/\{uid\}[\s\S]{0,600}?allow read:[^\n]*appOwner\(\)/.test(rules),
    (rules.match(/match \/loclog\/[\s\S]{0,500}/) || [''])[0].slice(0,400));
  // ★ loclog 블록 「안에서만」 본다. 뒤에 오는 support 블록에도 isStaff 가 있어서
  //   범위를 안 자르면 엉뚱하게 걸린다.
  const lgBlock = (rules.match(/match \/loclog\/\{uid\}\/rows\/\{rid\} \{[\s\S]*?\n    \}/) || [''])[0];
  T('★ 규칙에서 loclog 자리를 찾았다', !!lgBlock);
  T('★ 그래도 아무 운영자나 못 본다 (연재자·일반 운영자 제외)',
    !!lgBlock && !/isStaff\(\)/.test(lgBlock) && !/adminCan\(/.test(lgBlock), lgBlock.slice(0,300));
  T('★ 쓰기는 본인만 — 운영자도 남의 기록을 고칠 수 없다',
    !!lgBlock && /allow write:[^\n]*request\.auth\.uid == uid/.test(lgBlock) &&
    !/allow write:[^\n]*appOwner/.test(lgBlock), lgBlock.slice(0,300));
}

// ── ③-5 사업자 정보가 약관에 나간다
{
  T('★ 약관이 아직 「개인 자격」 으로 돼 있지 않다',
    /const LEGAL_BIZ = \{/.test(src), (src.match(/const LEGAL_BIZ = [^\n]*/) || [])[0]);
}

// ── ④ 보존기간 6개월
{
  T('보존기간이 180일(6개월)로 박혀 있다', /LG_KEEP_D\s*=\s*180\b/.test(src),
    (src.match(/LG_KEEP_D\s*=\s*\d+/) || [])[0]);
  T('오래된 것을 버리는 곳이 있다', !!grab('lgPrune'));
}

// ── ⑤ 셈을 진짜로 돌려 본다
const HAVE = !!grab('lgPrune') && !!grab('lgAdd');
if(HAVE){
  const F = new Function(
    'const LG_KEEP_D = 180;\n' + grab('lgPrune') + '\nreturn { lgPrune };');
  const { lgPrune } = F();
  const DAY = 864e5, now = Date.UTC(2026, 7, 21);
  const iso = d => new Date(now - d * DAY).toISOString();
  const rows = [
    { id:'a', ts: iso(1)   },   // 어제
    { id:'b', ts: iso(179) },   // 6개월에서 하루 모자람 — 남는다
    { id:'c', ts: iso(181) },   // 6개월 넘음 — 버린다
    { id:'d', ts: iso(900) },   // 한참 넘음
    { id:'e'               },   // 날짜가 없다 — 버린다 (언제 것인지 모르는 기록은 확인자료가 못 된다)
  ];
  const left = lgPrune(rows, now).map(x => x.id);
  T('★ 6개월 안의 것은 남는다', left.indexOf('a') >= 0 && left.indexOf('b') >= 0, left);
  T('★ 6개월 지난 것은 버린다', left.indexOf('c') < 0 && left.indexOf('d') < 0, left);
  T('날짜 없는 줄은 버린다', left.indexOf('e') < 0, left);
} else {
  T('★ 6개월 안의 것은 남는다', false, 'lgPrune 이 없다');
  T('★ 6개월 지난 것은 버린다', false, 'lgPrune 이 없다');
  T('날짜 없는 줄은 버린다', false, 'lgPrune 이 없다');
}

// ── ⑥ 클라우드에도 두되, 본인만 본다
{
  T('클라우드 창구 __loclog 가 있다', /window\.__loclog\s*=/.test(src));
  T('경로가 사람마다 갈린다 (loclog/{uid}/rows)',
    /'loclog'\s*,\s*[A-Za-z_$][\w$]*\s*,\s*'rows'/.test(src),
    (src.match(/.{0,40}'loclog'.{0,60}/) || [''])[0]);
  T('규칙 파일에 loclog 자리가 있다', /match \/loclog\//.test(rules));
  T('★ 규칙이 본인만 읽고 쓰게 한다',
    /match \/loclog\/\{uid\}[\s\S]{0,400}?request\.auth\.uid\s*==\s*uid/.test(rules),
    (rules.match(/match \/loclog\/[\s\S]{0,300}/) || [''])[0].slice(0,300));
}

// ── ⑦ 동의는 스스로 거둘 수 있어야 한다 — 다만 새 탭 없이 (법 제24조 제1항 제1호)
{
  const draw = (src.match(/id="drawerOv"[\s\S]*?<\/aside>/) || [''])[0];
  T('★★ 서랍이 늘어나지 않았다', !/위치정보 이용내역/.test(draw), draw.slice(0,80));
  T('★ 동의 거두기는 이미 있는 「약관·개인정보」 화면 안에 있다',
    /lgToggleConsent\(\)/.test(grab('openLegal')), grab('openLegal').slice(0,600));
  T('그 자리는 「위치정보」 약관을 볼 때만 나온다',
    /key === 'location'/.test(grab('openLegal')));
  T('되돌아갈 때도 같은 화면으로 간다', /openLegal\('location'\)/.test(grab('lgToggleConsent')));
}

// ── ⑧ 약관에 적혀 있는가 (안 적으면 그것도 위반이다)
{
  const ko = /확인자료/.test(src);
  T('약관(한국어)에 확인자료 이야기가 있다', ko);
  T('약관에 6개월 보존이 적혀 있다', /6개월/.test(src));
  T('약관(영어)에 있다', /confirmation data|record of when/i.test(src));
  T('약관(러시아어)에 있다', /подтвержда|записи об использовании/i.test(src));
  // ★ 4.99 — 판을 1.7 로 올렸다(정박지 책임 범위). 「딱 1.6」 을 못 박아 두면
  //   약관을 고칠 때마다 이 검사가 빨개진다. 「1.6 이상」 으로 본다.
  const LV = (src.match(/LEGAL_VER\s*=\s*'([^']*)'/) || [])[1] || '0';
  const 큼 = (a2, b2) => { const A = a2.split('.').map(Number), B = b2.split('.').map(Number);
    return (A[0] - B[0]) || ((A[1]||0) - (B[1]||0)) >= 0 ? (A[0] > B[0] || (A[0] === B[0] && (A[1]||0) >= (B[1]||0))) : false; };
  T('약관 판이 올라갔다 (다시 동의를 받는다) — ' + LV, 큼(LV, '1.6'), LV);
}

// ── ⑨ 항적은 묶어서 한 줄 (앞으로 붙을 자리)
{
  T('★ 항적을 한 묶음으로 남기는 자리가 있다 (lgTrack)', !!grab('lgTrack'));
  const tk = grab('lgTrack');
  T('그 줄에 켠 시각과 끈 시각이 들어간다',
    !!tk && /from/.test(tk) && /to/.test(tk), tk.slice(0,200));
}

// ── ⑩ 브라우저에서 진짜로 남는가
const server = http.createServer((rq, rs) => {
  // ★ 넘겨받은 길이 있으면 그것을 낸다 (검사 폴더의 옛 파일을 보지 않는다)
  const f = (rq.url === '/' && fs.existsSync(FILE))
    ? FILE : path.join(__dirname, rq.url === '/' ? FILE : rq.url.split('?')[0]);
  fs.readFile(f, (e, d) => { if(e){ rs.writeHead(404); rs.end(); return; }
    if(f.endsWith('.woff2')) rs.setHeader('Content-Type', 'font/woff2');
    rs.writeHead(200); rs.end(d); });
});

(async () => {
  await new Promise(r => server.listen(0, r));
  const br = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await br.newContext({ locale:'ko-KR',
    viewport:{ width:390, height:844 }, isMobile:true, hasTouch:true, timezoneId:'Asia/Seoul',
    permissions:['geolocation'], geolocation:{ latitude:34.7404, longitude:127.7357 } });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(String(e).slice(0,140)));
  await pg.goto('http://127.0.0.1:' + server.address().port + '/', { waitUntil:'networkidle' });
  await pg.waitForTimeout(900);
  await pg.evaluate(() => { window.__al = [];
    window.alert = m => window.__al.push(String(m).replace(/\n+/g,' / '));
    window.confirm = () => true;  // ★ 앱은 alert/confirm 을 안 쓴다 — 자기 창(tell/ask)
    window.tell = m => { window.__al.push(String(m).replace(/\n+/g,' / ')); return Promise.resolve(); };
    window.ask  = m => { window.__al.push(String(m).replace(/\n+/g,' / ')); return Promise.resolve(true); };
    // ★ 4.13 부터 위치는 로그인한 회원에게만 받는다. 시험도 로그인한 셈 쳐야 한다.
    window.__user = { uid:'testuid', email:'test@example.com', name:'시험' };
    try{ skipWelcome(); }catch(_){} unlocked = true; openBoatSetup(); });
  await pg.waitForTimeout(400);
  await pg.evaluate(() => { document.getElementById('nbName').value = '시험호'; createBoat(); });
  await pg.waitForTimeout(1500);

  const has = await pg.evaluate(() => typeof geoGet === 'function' && typeof lgList === 'function');
  if(!has){
    T('★★ 위치를 잡으면 기록이 한 줄 남는다', false, 'geoGet / lgList 가 없다');
    T('기록에 좌표가 안 들어 있다', false, '');
    T('★ 위치를 못 잡으면 기록도 안 남는다', false, '');
    T('화면에 그 기록이 보인다', false, '');
  } else {
    // 처음에는 비어 있다
    // ★ 동의를 먼저 켜 둔다. 안 켜면 locAsk 가 동의를 켜면서 「동의·철회」 줄이 하나 더 붙어
    //   「한 줄 늘었나」 를 재는 것이 어긋난다.
    const n0 = await pg.evaluate(() => { try{ localStorage.removeItem('bt_loclog'); }catch(e){}
      lgReset && lgReset(); locSet(true);
      try{ localStorage.removeItem('bt_loclog'); }catch(e){}
      lgReset && lgReset(); return lgList().length; });

    // 진짜로 위치를 잡아 본다 — 날씨 화면의 「현재 위치」
    await pg.evaluate(() => { wxUseGPS(); });
    await pg.waitForTimeout(1200);
    const r1 = await pg.evaluate(() => lgList());
    T('★★ 위치를 잡으면 기록이 한 줄 남는다', r1.length === n0 + 1, { 전:n0, 후:r1.length, 줄:r1[0] });
    const row = r1[0] || {};
    T('그 줄에 언제·무엇에 썼는지가 있다',
      !!row.ts && !!row.w && !!row.k, row);
    T('★ 기록에 좌표가 안 들어 있다',
      JSON.stringify(row).indexOf('34.74') < 0 && JSON.stringify(row).indexOf('127.7') < 0, row);

    // 위치를 못 잡을 때는 남기지 않는다 — 수집한 것이 없으니까.
    // ★ 실패를 진짜로 만든다. 브라우저 권한을 거두는 것으로는 확실히 막히지 않는다.
    const fail = await pg.evaluate(() => new Promise(res=>{
      const real = navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);
      navigator.geolocation.getCurrentPosition = (ok, err) => {
        setTimeout(()=>{ if(err) err({ code:1, message:'denied' }); }, 10);
      };
      const before = lgList().length;
      let called = false;
      geoGet('시험 — 못 잡는 자리', ()=>{}, ()=>{ called = true; });
      setTimeout(()=>{
        const after = lgList().length;
        navigator.geolocation.getCurrentPosition = real;
        res({ before: before, after: after, 실패콜백: called });
      }, 400);
    }));
    T('★ 위치를 못 잡으면 기록도 안 남는다 (수집한 것이 없다)',
      fail.after === fail.before, fail);
    T('그래도 못 잡았다는 것은 부르는 쪽에 알려 준다', fail.실패콜백 === true, fail);

    // ── ★ 서랍이 늘어나지 않았는지 진짜로 열어서 본다
    const dw = await pg.evaluate(()=>{
      openDrawer();
      const d = document.getElementById('drawer');
      const names = [...(d ? d.querySelectorAll('.ditem') : [])]
        .map(x => String(x.innerText || '').trim());
      closeDrawer();
      return { 항목: names };
    });
    await pg.waitForTimeout(300);
    T('★★ 서랍에 「이용내역」 같은 항목이 없다',
      !dw.항목.some(x => /이용내역|use history|записи о местопол/i.test(x)), dw.항목);

    // ── ★ 동의 거두기는 「약관·개인정보 → 위치정보」 화면에서 된다 (새 탭이 아니다)
    const inLegal = await pg.evaluate(()=>{
      locSet(true);
      openLegal('location');
      const el = document.getElementById('mrPanel');
      const b = [...el.querySelectorAll('button')]
        .find(x => /lgToggleConsent/.test(x.getAttribute('onclick') || ''));
      return { 열림: el.classList.contains('open'),
               단추: !!b, 단추글: b ? String(b.innerText || '').trim() : '',
               높이: b ? Math.round(b.getBoundingClientRect().height) : 0 };
    });
    await pg.waitForTimeout(400);
    T('★★ 위치정보 약관 화면에 동의 거두기 단추가 있다',
      inLegal.열림 && inLegal.단추 && inLegal.높이 >= 34, inLegal);
    // 4.132 말 전수점검에서 「거두기」 → 「철회」 로 바뀌었다 (앱 글: 「위치정보 수집 동의 철회」)
    T('동의 중이면 「철회」 로 나온다', /철회/.test(inLegal.단추글), inLegal.단추글);

    // 다른 약관 탭에는 안 나온다
    const other = await pg.evaluate(()=>{
      openLegal('terms');
      const el = document.getElementById('mrPanel');
      return [...el.querySelectorAll('button')]
        .some(x => /lgToggleConsent/.test(x.getAttribute('onclick') || ''));
    });
    await pg.waitForTimeout(300);
    T('★ 이용약관 탭에는 안 끼어든다', other === false, other);

    // 진짜로 눌러서 거둬 본다
    await pg.evaluate(()=>{ openLegal('location'); });
    await pg.waitForTimeout(400);
    const btn = await pg.$('#mrPanel button[onclick*="lgToggleConsent"]');
    T('그 단추를 화면에서 찾았다', !!btn);
    if(btn){
      await btn.click();
      await pg.waitForTimeout(700);
      const after = await pg.evaluate(()=>({ 동의: locOK(),
        단추글: (document.querySelector('#mrPanel button[onclick*="lgToggleConsent"]') || {}).innerText || '' }));
      T('★★ 눌러서 동의를 거둘 수 있다', after.동의 === false, after);
      T('거둔 뒤에는 단추가 「동의하기」 로 바뀐다', /동의하기|Agree|Согласиться/.test(after.단추글), after);
    }

    // ── ★★ 동의를 거절하면 위치를 아예 안 읽는다 (4.11 까지 이게 없었다)
    const no = await pg.evaluate(() => new Promise(res=>{
      // 동의를 지운다
      try{ localStorage.removeItem('bt_agree'); }catch(e){}
      let asked = false, read = false;
      window.confirm = () => { asked = true; return false; };   // 「아니오」
      window.ask = (...a) => Promise.resolve((() => { asked = true; return false; })(...a));
      const real = navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);
      navigator.geolocation.getCurrentPosition = (okf, ef, o) => { read = true; real(okf, ef, o); };
      const before = lgList().length;
      let errCalled = false;
      geoGet('시험 — 동의 거절', ()=>{}, ()=>{ errCalled = true; });
      setTimeout(()=>{
        navigator.geolocation.getCurrentPosition = real;
        window.confirm = () => true;
        window.ask = (...a) => Promise.resolve((() => true)(...a));
        res({ 물어봤나: asked, GPS읽었나: read, 기록늘었나: lgList().length > before,
              실패알렸나: errCalled, 동의상태: locOK() });
      }, 400);
    }));
    T('★★ 동의가 없으면 먼저 물어본다', no.물어봤나 === true, no);
    T('★★ 거절하면 GPS 를 아예 안 읽는다', no.GPS읽었나 === false, no);
    T('★★ 거절하면 기록도 안 남는다', no.기록늘었나 === false, no);
    T('거절했다는 것은 부르는 쪽에 알려 준다', no.실패알렸나 === true, no);
    T('거절했으면 동의 상태로 바뀌지 않는다', no.동의상태 === false, no);

    // ── 동의했다가 거두면 다시 막힌다 (법 제24조 철회)
    const back = await pg.evaluate(() => new Promise(res=>{
      locSet(true);
      const on = locOK();
      locSet(false);
      const off = locOK();
      // 거둔 것도 확인자료에 남았나
      const rows = lgList().slice(0, 4).map(r => r.k + ':' + r.w);
      let read = false;
      const real = navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);
      navigator.geolocation.getCurrentPosition = (okf, ef, o) => { read = true; real(okf, ef, o); };
      window.confirm = () => false;
      window.ask = (...a) => Promise.resolve((() => false)(...a));
      geoGet('시험 — 거둔 뒤', ()=>{}, ()=>{});
      setTimeout(()=>{
        navigator.geolocation.getCurrentPosition = real;
        window.confirm = () => true;
        window.ask = (...a) => Promise.resolve((() => true)(...a));
        res({ 켰을때: on, 껐을때: off, 거둔뒤읽었나: read, 남은줄: rows });
      }, 400);
    }));
    T('★ 동의를 켜고 끌 수 있다', back.켰을때 === true && back.껐을때 === false, back);
    T('★ 거둔 뒤에는 다시 안 읽는다', back.거둔뒤읽었나 === false, back);
    T('★ 동의와 철회가 확인자료에 남는다',
      back.남은줄.some(x => /동의·철회:.*거둠/.test(x)) &&
      back.남은줄.some(x => /동의·철회:.*동의$/.test(x)), back.남은줄);

    // ── ★★ 로그인 안 한 사람에게서는 아예 안 받는다
    const out = await pg.evaluate(() => new Promise(res=>{
      const me = window.__user;
      window.__user = null;              // 로그아웃한 셈 친다
      locSet(true);                      // 동의는 있는 상태로 둔다 — 로그인이 없어서 막혀야 한다
      let read = false, asked = false;
      const real = navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);
      navigator.geolocation.getCurrentPosition = (okf, ef, o) => { read = true; real(okf, ef, o); };
      window.confirm = () => { asked = true; return false; };
      window.ask = (...a) => Promise.resolve((() => { asked = true; return false; })(...a));
      const before = lgList().length;
      geoGet('시험 — 로그아웃', ()=>{}, ()=>{});
      // 저절로 부르는 자리(quiet)는 캐묻지도 않아야 한다
      let askedQuiet = false;
      window.confirm = () => { askedQuiet = true; return false; };
      window.ask = (...a) => Promise.resolve((() => { askedQuiet = true; return false; })(...a));
      geoGet('시험 — 로그아웃 조용히', ()=>{}, ()=>{}, { quiet:true });
      setTimeout(()=>{
        navigator.geolocation.getCurrentPosition = real;
        window.__user = me;
        window.confirm = () => true;
        window.ask = (...a) => Promise.resolve((() => true)(...a));
        res({ GPS읽었나: read, 물어봤나: asked, 조용히물어봤나: askedQuiet,
              기록늘었나: lgList().length > before });
      }, 400);
    }));
    T('★★ 로그인 안 했으면 동의가 있어도 GPS 를 안 읽는다', out.GPS읽었나 === false, out);
    T('★★ 로그인 안 했으면 기록도 안 남는다 (수집한 것이 없다)', out.기록늘었나 === false, out);
    T('사람이 누른 자리에서는 로그인하겠느냐고 물어본다', out.물어봤나 === true, out);
    T('★ 저절로 열리는 자리에서는 캐묻지 않는다', out.조용히물어봤나 === false, out);

    // 로그인을 되돌리면 다시 된다
    const on2 = await pg.evaluate(() => new Promise(res=>{
      locSet(true);
      let read = false;
      const real = navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);
      navigator.geolocation.getCurrentPosition = (okf, ef, o) => { read = true; real(okf, ef, o); };
      geoGet('시험 — 로그인 상태', ()=>{}, ()=>{});
      setTimeout(()=>{ navigator.geolocation.getCurrentPosition = real; res({ 읽었나: read }); }, 400);
    }));
    T('로그인·동의가 다 있으면 정상으로 읽는다', on2.읽었나 === true, on2);

    // ── ★★ (선택)이라 가입할 때 안 눌렀어도 막다른 길이 아니다.
    //   「지금 여기」 를 누르면 그 자리에서 묻고, 예 하면 바로 잡힌다.
    const jit = await pg.evaluate(() => new Promise(res=>{
      locSet(false);                       // 가입할 때 위치정보를 안 눌렀다고 치자
      let 물음 = '';
      window.confirm = m => { 물음 = String(m); return true; };   // 「예」
      window.ask = (...a) => Promise.resolve((m => { 물음 = String(m); return true; })(...a));
      let 읽었나 = false;
      const real = navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);
      navigator.geolocation.getCurrentPosition = (okf, ef, o) => { 읽었나 = true; real(okf, ef, o); };
      let 좌표들어옴 = false;
      geoGet('시험 — 그 자리에서 묻기', () => { 좌표들어옴 = true; }, ()=>{});
      setTimeout(()=>{
        navigator.geolocation.getCurrentPosition = real;
        window.confirm = () => true;
        window.ask = (...a) => Promise.resolve((() => true)(...a));
        res({ 물음: 물음.replace(/\n+/g,' / '), 읽었나: 읽었나,
              좌표들어옴: 좌표들어옴, 동의됨: locOK() });
      }, 600);
    }));
    T('★★ 동의를 안 했어도 누르면 그 자리에서 묻는다',
      /동의하시겠습니까/.test(jit.물음), jit);
    T('★★ 「예」 하면 바로 위치가 잡힌다 (막다른 길이 아니다)',
      jit.읽었나 === true && jit.좌표들어옴 === true, jit);
    T('★ 그때 동의도 함께 켜진다 (다음부터는 안 묻는다)', jit.동의됨 === true, jit);
    // ★ 4.102 — 「거두기」 뿐 아니라 **끄고 켜기(일시중지)** 도 알려 준다.
    //   위치정보법 제24조 제2항은 일시중지를 요구할 수 있게 하고 그 기술적 수단을 갖추라고 한다.
    //   (안 갖추면 과태료 2천만원 — 위치기반사업자에게 걸리는 최고액이다)
    T('★ 물음에 어디서 끄고 켤 수 있는지 적혀 있다',
      /끄고 켜실 수 있습니다|거두실 수 있습니다|switch it off|withdraw|выключить|отозвать/i.test(jit.물음), jit.물음);
    T('★★ 그 길이 실제로 있는 화면을 가리킨다 (없어진 「이용내역」 이 아니다)',
      !/이용내역|use history|записи о местоположении/i.test(jit.물음), jit.물음);

    // ── ★ 로그인은 했는데 동의만 없는 채로 화면이 저절로 열릴 때
    //   (사보타주에서 이 경우를 안 봐서 locAsk 의 quiet 를 빼도 안 잡혔다)
    const qz = await pg.evaluate(() => new Promise(res=>{
      locSet(false);                      // 동의만 거둔다. 로그인은 그대로.
      let asked = false, read = false;
      window.confirm = () => { asked = true; return true; };
      window.ask = (...a) => Promise.resolve((() => { asked = true; return true; })(...a));
      const real = navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);
      navigator.geolocation.getCurrentPosition = (okf, ef, o) => { read = true; real(okf, ef, o); };
      geoGet('시험 — 동의 없이 조용히', ()=>{}, ()=>{}, { quiet:true });
      setTimeout(()=>{
        navigator.geolocation.getCurrentPosition = real;
        window.confirm = () => true;
        window.ask = (...a) => Promise.resolve((() => true)(...a));
        res({ 물어봤나: asked, 읽었나: read, 동의됐나: locOK() });
      }, 400);
    }));
    T('★★ 동의가 없어도 저절로 열리는 자리에서는 캐묻지 않는다', qz.물어봤나 === false, qz);
    T('★ 그때 위치도 안 읽는다', qz.읽었나 === false, qz);
    T('★ 캐묻지 않았으니 동의가 저절로 켜지지도 않는다', qz.동의됐나 === false, qz);
  }

  T('앱이 터지지 않았다', errs.length === 0, errs.slice(0,2));
  console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
  await br.close(); server.close();
  process.exit(bad ? 1 : 0);
})();
