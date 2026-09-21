// 4.106 — 달력이 **진짜 브라우저에서** 제대로 그려지고 눌리는가
//
// ★ 왜 코드만 읽으면 안 되나
//   caltest 는 자료를 모으는 셈과 파일 규격을 본다. 그런데 사장님이 실제로 겪는 것은
//   「글자가 떡칠돼 보인다」·「눌러도 아무 일이 없다」 다. 그건 그려 봐야만 안다.
//   그래서 여기서는 진짜로 배를 만들고, 진짜 기록을 넣고, 진짜로 달력을 눌러 본다.
//
// ★ 검사가 헛돌지 않게 — 자기 점검을 먼저 한다.
//   달력이 아예 안 그려졌는데 「겹친 글자 없음」 이라고 통과해 버리면 최악이다.
//   그래서 ① 날짜 칸이 실제로 그 달의 날 수만큼 있는지 ② 넣은 기록이 실제로 칸에
//   글자로 보이는지를 먼저 확인하고, 못 하면 그 자리에서 실패로 끝낸다.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const FILE = process.argv[2] || 'work.html';
const server = http.createServer((rq, rs) => {
  const f = ((rq.url === '/' && path.isAbsolute(FILE)) ? FILE : path.join(__dirname, rq.url === '/' ? FILE : rq.url.split('?')[0]));
  fs.readFile(f, (e, d) => { if(e){ rs.writeHead(404); rs.end(); return; }
    if(f.endsWith('.woff2')) rs.setHeader('Content-Type', 'font/woff2');
    rs.writeHead(200); rs.end(d); });
});
let ok = 0, bad = 0;
const T = (n, c, w) => { if(c){ ok++; console.log('통과: ' + n); }
  else { bad++; console.log('★ 실패: ' + n + (w !== undefined ? ' — ' + JSON.stringify(w).slice(0, 260) : '')); } };
const 끝 = async (br) => { console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
  try{ await br.close(); }catch(_){} server.close(); process.exit(bad ? 1 : 0); };

(async () => {
  await new Promise(r => server.listen(0, r));
  const br = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const pg = await (await br.newContext({ locale:'ko-KR', viewport:{ width:390, height:844 },
                                          isMobile:true, hasTouch:true })).newPage();
  const errs = []; pg.on('pageerror', e => errs.push(String(e).slice(0, 160)));
  await pg.route('**tile.openstreetmap.org/**', r => r.abort());
  await pg.route('**tiles.openseamap.org/**', r => r.abort());
  await pg.goto('http://127.0.0.1:' + server.address().port + '/', { waitUntil:'domcontentloaded' });
  await pg.waitForTimeout(1400);
  await pg.evaluate(() => { window.alert = () => {}; window.confirm = () => true;
    window.tell = () => Promise.resolve(); window.ask = () => Promise.resolve(true);
    try{ skipWelcome(); }catch(_){} unlocked = true; try{ openBoatSetup(); }catch(_){} });
  await pg.waitForTimeout(500);
  await pg.evaluate(() => { const n = document.getElementById('nbName'); if(n){ n.value = '시험호'; createBoat(); } });
  await pg.waitForTimeout(1200);

  // ── 그 달 안에 여섯 갈래를 하나씩 심는다
  const 심음 = await pg.evaluate(() => {
    const p = n => String(n).padStart(2, '0');
    const now = new Date();
    const ym = now.getFullYear() + '-' + p(now.getMonth() + 1);
    const D = d => ym + '-' + p(d);
    voyage = [
      { id:'cv1', plan:true,  date:D(12), title:'광어 손님 여덟 분', pub:true, logs:[] },
      { id:'cv2', plan:false, date:D(3),  title:'개도 한 바퀴',     pub:true, logs:[] },
      // 같은 날 세 건 — 두 개만 보이고 「1건 더」 가 떠야 한다
      { id:'cv3', plan:true,  date:D(12), title:'오후 손님',        pub:true, logs:[] },
      { id:'cv4', plan:true,  date:D(12), title:'저녁 손님',        pub:true, logs:[] }
    ];
    // 정기점검은 「다음 할 날」 로 들어간다 — 이 달 8일이 되게 마지막 날을 잡는다
    const back = new Date(now.getFullYear(), now.getMonth() - 3, 8);
    maint = [
      { id:'cm1', name:'엔진오일', lastDate: back.getFullYear() + '-' + p(back.getMonth() + 1) + '-' + p(8),
        months:3, unit:'m', note:'', photos:[],
        // 지난 정비 — 이 달 안에 한 번 한 것으로 둔다
        history:[{ date: D(6) }] },
      { id:'cg1', typ:'log', date:D(4), title:'임펠러 교체', how:[], photos:[] }
    ];
    repair = [{ id:'cr1', title:'빌지 스위치 고장', status:'open', created:D(2), photos:[] },
               // 올린 날과 고친 날이 둘 다 이 달 안 — 두 줄이 나와야 한다
               { id:'cr2', title:'윈치 수리', status:'done', created:D(9), doneDate:D(19), photos:[] }];
    vdocs  = [{ id:'cd1', title:'선박검사증', expiry:D(25), photos:[] }];
    saveMR();
    return { ym, days:new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() };
  });

  await pg.evaluate(() => { switchTab('home'); setHomeSub('cal'); });
  await pg.waitForTimeout(900);

  // ══ 자기 점검 — 달력이 진짜로 그려졌나 ══
  const 뼈대 = await pg.evaluate(() => {
    const w = document.getElementById('calWrap');
    return {
      보임: !!w && getComputedStyle(w).display !== 'none',
      요일: document.querySelectorAll('.caldow .cdow').length,
      칸:   document.querySelectorAll('.ccell:not(.out)').length,
      칩:   document.querySelectorAll('.cchip').length,
      머리: (document.querySelector('.calym') || {}).textContent || ''
    };
  });
  T('①-1 달력 화면이 보인다', 뼈대.보임 === true, 뼈대);
  T('①-2 요일이 일곱 칸이다', 뼈대.요일 === 7, 뼈대.요일);
  T('①-3 ★ 그 달 날 수만큼 날짜 칸이 있다 (검사가 헛돌지 않게)',
    뼈대.칸 === 심음.days, { 그려진칸:뼈대.칸, 그달:심음.days });
  T('①-4 ★ 심은 기록이 칸에 글자로 보인다', 뼈대.칩 >= 5, 뼈대.칩);
  T('①-5 달과 해가 머리에 있다', /\d/.test(뼈대.머리), 뼈대.머리);
  if(!(뼈대.보임 && 뼈대.칸 === 심음.days && 뼈대.칩 >= 5)){
    console.log('★ 달력이 제대로 안 그려져서 아래 검사는 뜻이 없습니다. 여기서 멈춥니다.');
    bad++; return 끝(br);
  }

  // ══ 여섯 갈래가 다 올라왔나 ══
  const 갈래 = await pg.evaluate(() => {
    const p = n => String(n).padStart(2, '0');
    const now = new Date();
    const ym = now.getFullYear() + '-' + p(now.getMonth() + 1);
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const rows = calItems(ym + '-01', ym + '-' + p(last));
    const c = {};
    rows.forEach(r => { c[r.kind] = (c[r.kind] || 0) + 1; });
    return c;
  });
  ['plan', 'voyage', 'maint', 'maintDone', 'mlog', 'repair', 'repairDone', 'vdoc'].forEach(k =>
    T('②  ' + k + ' 가 달력에 올라온다', (갈래[k] || 0) >= 1, 갈래));

  // ══ ★ 한 기록에 날짜가 여럿이면 그 날짜마다 다 오르나 (4.107) ══
  const 두날 = await pg.evaluate(() => {
    const p = n => String(n).padStart(2, '0');
    const now = new Date();
    const ym = now.getFullYear() + '-' + p(now.getMonth() + 1);
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const rows = calItems(ym + '-01', ym + '-' + p(last));
    return rows.filter(r => r.id === 'cr2').map(r => r.kind + '@' + r.date);
  });
  T('②-9 ★ 한 고장이 올린 날과 고친 날 두 줄로 오른다', 두날.length === 2, 두날);

  // ══ 옆으로 밀면 달이 넘어가나 — 진짜 손짓으로 ══
  const 밀기 = await pg.evaluate(async () => {
    const el = document.getElementById('calList');
    if(!el) return 'no-el';
    const before = calYM;
    const touch = (type, x, y) => {
      const t = new Touch({ identifier:1, target:el, clientX:x, clientY:y });
      el.dispatchEvent(new TouchEvent(type, {
        bubbles:true, cancelable:true,
        touches: type === 'touchend' ? [] : [t],
        changedTouches: [t] }));
    };
    touch('touchstart', 300, 400);
    touch('touchend', 100, 408);        // 왼쪽으로 200px
    await new Promise(r => setTimeout(r, 120));
    const afterLeft = calYM;
    touch('touchstart', 100, 400);
    touch('touchend', 300, 408);        // 오른쪽으로 200px
    await new Promise(r => setTimeout(r, 120));
    const afterRight = calYM;
    // 세로로 굴린 것 — 달이 안 넘어가야 한다
    touch('touchstart', 200, 200);
    touch('touchend', 240, 600);
    await new Promise(r => setTimeout(r, 120));
    return { before, afterLeft, afterRight, afterScroll: calYM };
  });
  const 달옮김 = (ym, n) => { const [y, m] = String(ym).split('-').map(Number);
    const d = new Date(y, m - 1 + n, 1);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
  T('②-10 ★ 왼쪽으로 밀면 다음 달로 넘어간다',
    밀기 && 밀기.afterLeft === 달옮김(밀기.before, 1), 밀기);
  T('②-11 ★ 오른쪽으로 밀면 지난 달로 돌아온다',
    밀기 && 밀기.afterRight === 밀기.before, 밀기);
  T('②-12 ★ 세로로 굴린 것은 달을 안 넘긴다',
    밀기 && 밀기.afterScroll === 밀기.afterRight, 밀기);
  await pg.evaluate(() => { calToday(); calSel = ''; renderCal(); });
  await pg.waitForTimeout(300);

  // ══ 한 칸에 다 못 넣으면 「몇 건 더」 ══
  const 더 = await pg.evaluate(() => {
    const el = document.querySelector('.cmore');
    return el ? el.textContent.trim() : '';
  });
  T('③-1 ★ 한 칸에 세 건이면 두 건만 보이고 나머지는 「더」로 알려 준다', /\d/.test(더), 더);

  // ══ 물때가 날짜 밑에 붙나 ══
  const 물때 = await pg.evaluate(() =>
    [...document.querySelectorAll('.ccell:not(.out) .ctide')].map(e => e.textContent.trim()).filter(Boolean).length);
  T('③-2 ★ 날짜 밑에 물때가 붙는다', 물때 >= 25, 물때);

  // ══ 글자가 떡칠되지 않는가 — 칩이 자기 칸을 넘지 않아야 한다 ══
  const 넘침 = await pg.evaluate(() => {
    const out = [];
    document.querySelectorAll('.ccell:not(.out)').forEach(c => {
      const cr = c.getBoundingClientRect();
      c.querySelectorAll('.cchip,.cmore,.ctide,.cnum').forEach(x => {
        const r = x.getBoundingClientRect();
        if(r.right > cr.right + 1.5 || r.left < cr.left - 1.5 || r.bottom > cr.bottom + 1.5)
          out.push((x.className || '') + ':' + x.textContent.trim().slice(0, 12));
      });
    });
    return out;
  });
  T('③-3 ★ 칸 안의 글자가 칸 밖으로 삐져나오지 않는다', 넘침.length === 0, 넘침.slice(0, 6));

  const 가로 = await pg.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  T('③-4 화면이 옆으로 밀리지 않는다', 가로 <= 1, 가로);

  // ══ 날짜를 누르면 그 날이 펼쳐지나 ══
  const 열기 = await pg.evaluate(() => {
    const p = n => String(n).padStart(2, '0');
    const now = new Date();
    const ds = now.getFullYear() + '-' + p(now.getMonth() + 1) + '-12';
    const cells = [...document.querySelectorAll('.ccell:not(.out)')];
    const hit = cells.find(c => (c.getAttribute('onclick') || '').indexOf(ds) >= 0);
    if(!hit) return 'no-cell';
    hit.click();
    return 'clicked';
  });
  await pg.waitForTimeout(400);
  const 판 = await pg.evaluate(() => {
    const d = document.querySelector('.calday');
    return d ? { 줄:d.querySelectorAll('.cdrow').length,
                 만들기:d.querySelectorAll('.cdadd button').length,
                 제목:(d.querySelector('.cdtit b') || {}).textContent || '' } : null;
  });
  T('④-1 날짜를 누르면 그 날이 펼쳐진다', 열기 === 'clicked' && !!판, { 열기, 판 });
  T('④-2 ★ 그 날 것이 하나도 안 빠지고 다 보인다 (칸에서는 둘만 보였어도)',
    판 && 판.줄 === 3, 판);
  T('④-3 그 날짜로 새로 만드는 길이 있다', 판 && 판.만들기 === 3, 판);

  // ══ 줄을 누르면 그 기록 창이 열리나 ══
  const 창 = await pg.evaluate(() => {
    const row = document.querySelector('.calday .cdrow');
    if(!row) return 'no-row';
    row.click();
    return { type:(typeof mrOpenType !== 'undefined' ? mrOpenType : ''),
             id:(typeof mrOpenId !== 'undefined' ? mrOpenId : '') };
  });
  await pg.waitForTimeout(500);
  T('④-4 ★ 줄을 누르면 그 기록 창이 열린다',
    창 && 창.type === 'voyage' && /^cv/.test(String(창.id)), 창);

  // ══ 그 날짜로 새로 만들면 그 날로 잡히나 ══
  await pg.evaluate(() => { try{ closeMR(); }catch(_){} });
  await pg.waitForTimeout(300);
  const 새것 = await pg.evaluate(() => {
    const p = n => String(n).padStart(2, '0');
    const now = new Date();
    const ds = now.getFullYear() + '-' + p(now.getMonth() + 1) + '-12';
    const before = voyage.length;
    calSel = ds;
    calAdd('plan');
    const made = voyage[voyage.length - 1];
    return { 늘었나:voyage.length === before + 1, 날짜:made && made.date, 원한날:ds };
  });
  T('④-5 ★ 그 날짜로 만들면 정말 그 날로 잡힌다',
    새것.늘었나 && 새것.날짜 === 새것.원한날, 새것);

  const 새수리 = await pg.evaluate(() => {
    const p = n => String(n).padStart(2, '0');
    const now = new Date();
    const ds = now.getFullYear() + '-' + p(now.getMonth() + 1) + '-12';
    calSel = ds;
    calAdd('repair');
    const made = repair[repair.length - 1];
    return { 날짜:made && made.created, 원한날:ds };
  });
  T('④-6 ★ 고장도 그 날로 올라간다', 새수리.날짜 === 새수리.원한날, 새수리);

  // ══ 달 넘기기 ══
  await pg.evaluate(() => { calSel = ''; calMove(1); });
  await pg.waitForTimeout(400);
  const 다음달 = await pg.evaluate(() => ({
    머리:(document.querySelector('.calym') || {}).textContent || '',
    칸:document.querySelectorAll('.ccell:not(.out)').length,
    ym:(typeof calYM !== 'undefined' ? calYM : '')
  }));
  const 기대 = (() => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + 1);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); })();
  T('⑤-1 ★ 다음 달로 넘어간다', 다음달.ym === 기대, { 간곳:다음달.ym, 기대 });
  T('⑤-2 넘긴 달도 날 수가 맞다',
    다음달.칸 === new Date(Number(기대.slice(0, 4)), Number(기대.slice(5, 7)), 0).getDate(), 다음달);
  await pg.evaluate(() => calToday());
  await pg.waitForTimeout(300);
  const 되돌림 = await pg.evaluate(() => (typeof calYM !== 'undefined' ? calYM : ''));
  T('⑤-3 「오늘」을 누르면 이 달로 돌아온다',
    되돌림 === new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0'), 되돌림);

  // ══ 내보낸 파일이 실제로 만들어지나 ══
  const 파일 = await pg.evaluate(() => {
    const p = n => String(n).padStart(2, '0');
    const now = new Date();
    const ym = now.getFullYear() + '-' + p(now.getMonth() + 1);
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const s = calIcs(ym + '-01', ym + '-' + p(last));
    return { 길이:s.length, 시작:s.slice(0, 17),
             건수:(s.match(/BEGIN:VEVENT/g) || []).length,
             한글:/광어/.test(s.replace(/\r\n /g, '')) };
  });
  T('⑥-1 달력 파일이 만들어진다', 파일.시작 === 'BEGIN:VCALENDAR\r\n', 파일);
  T('⑥-2 일정이 담겨 있다', 파일.건수 >= 6, 파일);
  T('⑥-3 ★ 한글 제목이 안 깨지고 들어간다', 파일.한글 === true, 파일);

  // ══ 다른 화면으로 갔다 오면 달력이 사라지나 ══
  await pg.evaluate(() => { setHomeSub('today'); });
  await pg.waitForTimeout(300);
  const 숨김 = await pg.evaluate(() => {
    const w = document.getElementById('calWrap');
    return !!w && getComputedStyle(w).display === 'none';
  });
  T('⑦-1 다른 갈래로 가면 달력이 물러난다', 숨김 === true);
  await pg.evaluate(() => { setHomeSub('cal'); });
  await pg.waitForTimeout(400);
  const 다시 = await pg.evaluate(() => document.querySelectorAll('.ccell:not(.out)').length);
  T('⑦-2 돌아오면 다시 그려진다', 다시 === 심음.days, 다시);

  // ══ ★★ 4.111 — 「+ 예정」 을 누르면 **화면이 바뀌어야** 한다 (사장님 지적)
  //   「추가 이렇게 넣으면 화면이 바뀌는 게 아니라 그냥 달력에 아래로 나오잖아.
  //    그렇게 아래로 나오지 않고 그냥 그 화면이 그 해당 추가 화면으로 바뀌는 걸로 바꿔라.」
  //   ★ 까닭은 calWrap 이 TAB_CONTENT 에 빠져 있던 것이었다. 눈으로만 잡히는 흠이라
  //     여기서 **진짜로 눌러 보고** 달력이 자리에서 빠졌는지 잰다.
  await pg.evaluate(() => { setHomeSub('cal'); });
  await pg.waitForTimeout(400);
  await pg.evaluate(() => { calPick(today()); });
  await pg.waitForTimeout(300);
  await pg.evaluate(() => { calAdd('plan'); });
  await pg.waitForTimeout(700);
  const 바뀜 = await pg.evaluate(() => {
    const w = document.getElementById('calWrap');
    const P = document.getElementById('mrPanel');
    const r = P ? P.getBoundingClientRect() : null;
    return { 달력보임: !!w && getComputedStyle(w).display !== 'none',
             창열림: !!P && P.classList.contains('open'),
             창위: r ? Math.round(r.top) : -1,
             머리: (document.getElementById('hNav') || {}).textContent || '' };
  });
  T('⑧-1 ★★★ 달력이 자리에서 빠진다 (밑에 남지 않는다)', 바뀜.달력보임 === false, 바뀜);
  T('⑧-2 ★★ 그 자리에 기록 창이 들어온다', 바뀜.창열림 === true, 바뀜);
  T('⑧-3 ★★ 기록 창이 머리줄 바로 밑에서 시작한다 (달력만큼 밀리지 않는다)',
    바뀜.창위 >= 0 && 바뀜.창위 < 260, 바뀜);
  // 그 예정에 출항 시각 칸이 있는가
  const 시각칸 = await pg.evaluate(() =>
    [...document.querySelectorAll('#mrPanel .mrlbl')].map(x => (x.textContent || '').trim()));
  T('⑧-4 ★★★ 예정에 출항 시각 칸이 있다', 시각칸.indexOf('출항 시각') >= 0, 시각칸.slice(0, 12));
  // 적으면 달력에 그대로 보이는가
  const 달력에 = await pg.evaluate(() => {
    const v = voyage[voyage.length - 1];
    mrOpenType = 'voyage'; mrOpenId = v.id;
    mrField('timeOut', '09:30');
    closeMR(); setHomeSub('cal'); calPick(v.date); renderCal();
    return (document.querySelector('.calday') || {}).innerText || '';
  });
  T('⑧-5 ★★★ 적어 둔 출항 시각이 달력에 보인다', /09:30/.test(달력에), 달력에.slice(0, 200));

  T('⑨ 화면에서 터진 데가 없다', errs.length === 0, errs.slice(0, 4));
  return 끝(br);
})().catch(async e => { console.log('★ 실패: 검사가 터졌습니다 — ' + e);
  console.log('\n합계: ' + ok + '개 통과 / ' + (bad + 1) + '개 실패');
  server.close(); process.exit(1); });
