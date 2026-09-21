// 엔진 켜고 끄기 — 진짜 브라우저에서 눌러 본다 (4.109)
//
// ★ runtest 는 셈을 본다. 여기서는 **사장님이 실제로 하는 짓**을 그대로 한다:
//   「+ 엔진가동」 을 누르고 → 화면에 「지금 껐습니다」 가 보이는지 → 그것을 누르고 →
//   가동시간이 정말 기록에 들어갔는지.
//   셈이 맞아도 단추가 안 보이거나 안 눌리면 사장님한테는 아무 쓸모가 없다.
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
  await pg.goto('http://127.0.0.1:' + server.address().port + '/', { waitUntil:'domcontentloaded' });
  await pg.waitForTimeout(1400);
  await pg.evaluate(() => { window.alert = () => {}; window.confirm = () => true;
    window.tell = () => Promise.resolve(); window.ask = () => Promise.resolve(true);
    try{ skipWelcome(); }catch(_){} unlocked = true; try{ openBoatSetup(); }catch(_){} });
  await pg.waitForTimeout(500);
  await pg.evaluate(() => { const n = document.getElementById('nbName'); if(n){ n.value = '시험호'; createBoat(); } });
  await pg.waitForTimeout(1200);

  // ── 연료 화면으로 가서 진짜로 「+ 엔진가동」 을 누른다
  //
  // ★ 4.134 에서 자리가 옮겨졌다 — 「+ 주유」·「+ 엔진가동」 은 #fuelWrap 안의 줄 단추가
  //   아니라 오른쪽 아래 플로팅(FAB)으로 갔다. 그리고 4.120 뒤로 그 짝 목록은
  //   fabActs() **한 곳에서만** 정해진다. 그래서 여기서도
  //   ① fabActs() 가 내놓는 짝 목록 ② 진짜로 떠 있는 플로팅 단추
  //   ③ 펼쳐서 진짜 손가락으로 누르기 — 셋을 다 본다.
  await pg.evaluate(() => { goMaint('fuel'); });
  await pg.waitForTimeout(700);

  const 할일 = await pg.evaluate(() => (typeof fabActs === 'function' ? fabActs() : []));
  const 이름들 = 할일.map(a => a[0]);
  T('①-0a ★ 새로 쓰기 짝 목록이 fabActs() 한 곳에서 나온다', 할일.length > 0, 이름들);
  T('①-0b ★ 그 목록에 「+ 엔진가동」 이 있고 addRun() 을 부른다',
    할일.some(a => a[0] === '+ 엔진가동' && /addRun\s*\(/.test(a[1] || '')), 할일);
  T('①-0c ★ 「+ 주유」 도 같이 있다 (둘이라 펼쳐지는 모양이다)',
    할일.some(a => a[0] === '+ 주유' && /addFuel\s*\(/.test(a[1] || '')), 할일);
  const 옛자리 = await pg.evaluate(() =>
    [...document.querySelectorAll('#fuelWrap button')].filter(x => /엔진가동|주유/.test(x.textContent || '')).length);
  T('①-0d ★ 옛 자리(연료 화면 안의 줄 단추)에는 두 번 안 그린다', 옛자리 === 0, 옛자리);

  const 플 = await pg.evaluate(() => {
    const f = document.querySelector('#fabHost .fab');
    if(!f) return null;
    const r = f.getBoundingClientRect();
    const el = document.elementFromPoint(r.left + r.width/2, r.top + r.height/2);
    return { 높이: Math.round(r.height), 너비: Math.round(r.width),
             탭줄위: Math.round(window.innerHeight - r.bottom),
             막힘: (el && (el === f || f.contains(el))) ? '' : (el ? (el.className || el.tagName) : '?') };
  });
  T('①-0e ★ 오른쪽 아래 플로팅 단추가 진짜로 떠 있다', !!플, 플);
  T('①-0f ★ 그 단추가 손가락에 넉넉하다 (48px 이상)', 플 && 플.높이 >= 48 && 플.너비 >= 48, 플);
  T('①-0g ★★ 그 단추가 다른 것에 안 깔려 있다', 플 && 플.막힘 === '', 플);

  // 진짜로 눌러서 펼친다 — 할 일이 둘이라 바로 안 돌고 펼쳐져야 한다
  let 켬 = 'no-btn';
  try{
    await pg.click('#fabHost .fab');
    await pg.waitForTimeout(350);
    const 펼친것 = await pg.evaluate(() =>
      [...document.querySelectorAll('#fabHost .fabitem')].map(x => (x.textContent || '').trim()));
    T('①-0h ★ 누르면 두 갈래가 펼쳐진다', 펼친것.length === 2 && 펼친것.some(x => /엔진가동/.test(x)), 펼친것);
    const 항 = pg.locator('#fabHost .fabitem', { hasText: '엔진가동' });
    if(await 항.count()){ await 항.first().click(); 켬 = 'clicked'; }
  }catch(e){ 켬 = 'no-btn:' + String(e).slice(0, 80); }
  await pg.waitForTimeout(900);
  T('①-1 ★ 「+ 엔진가동」 단추가 있고 눌린다', 켬 === 'clicked', 켬);
  if(켬 !== 'clicked'){ bad++; return 끝(br); }

  const 만든것 = await pg.evaluate(() => {
    const r = runs[runs.length - 1];
    return r ? { id:r.id, on:r.on, date:r.date, time:r.time, hours:r.hours,
                 endTime:r.endTime, 창:(typeof mrOpenType !== 'undefined' ? mrOpenType : '') } : null;
  });
  T('①-2 ★ 기록이 만들어지고 「돌고 있음」이다', 만든것 && 만든것.on === true, 만든것);
  T('①-3 켠 시각이 저절로 들어갔다', /^\d{2}:\d{2}$/.test((만든것 || {}).time || ''), 만든것);
  T('①-4 가동시간은 아직 비어 있다', (만든것 || {}).hours === '', 만든것);
  T('①-5 기록 창이 열렸다', (만든것 || {}).창 === 'run', 만든것);

  // ── 화면에 「지금 껐습니다」 가 진짜로 보이는가
  const 화면 = await pg.evaluate(() => {
    const box = document.querySelector('.runon');
    const btn = document.querySelector('.runstop');
    const r = btn ? btn.getBoundingClientRect() : null;
    return {
      틀: !!box,
      단추: btn ? (btn.textContent || '').trim() : null,
      크기: r ? Math.round(r.height) : 0,
      큰글: (document.querySelector('.runbig') || {}).textContent || '',
      // ★ 단추가 다른 것에 깔려 있지 않은가 (4.104 에서 겪은 흠)
      막힘: (() => {
        if(!r || !r.width) return 'no-btn';
        const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return (el && (el === btn || btn.contains(el))) ? '' : (el ? el.className || el.tagName : '?');
      })()
    };
  });
  T('②-1 ★ 「엔진이 돌고 있습니다」 틀이 보인다', 화면.틀 === true, 화면);
  T('②-2 ★ 「지금 껐습니다」 단추가 보인다', /껐습니다/.test(화면.단추 || ''), 화면);
  T('②-3 ★ 단추가 손가락에 넉넉하다 (48px 이상)', 화면.크기 >= 48, 화면.크기);
  T('②-4 ★★ 단추가 다른 것에 안 깔려 있다', 화면.막힘 === '', 화면.막힘);
  T('②-5 지금까지 얼마나 돌았는지 크게 보인다', /분|시간/.test(화면.큰글), 화면.큰글);
  // ★ 목적 칸이 돌고 있을 때도 보여야 한다 — 한 번 빠뜨렸던 자리다
  const 도는칸 = await pg.evaluate(() =>
    [...document.querySelectorAll('#mrPanel .mrlbl')].map(x => (x.textContent || '').trim()));
  T('②-6 ★ 돌고 있을 때도 목적 칸이 있다', 도는칸.indexOf('목적') >= 0, 도는칸);
  T('②-7 ★ 돌고 있을 때는 가동시간 칸을 안 보여 준다 (손으로 적으려 들면 안 된다)',
    도는칸.indexOf('가동시간') < 0, 도는칸);

  // ── 켠 시각을 90분 전으로 돌려놓고, 진짜로 단추를 눌러 끈다
  await pg.evaluate(() => {
    const p = n => String(n).padStart(2, '0');
    const a = new Date(Date.now() - 90 * 60000);
    const r = runs[runs.length - 1];
    r.date = a.getFullYear() + '-' + p(a.getMonth() + 1) + '-' + p(a.getDate());
    r.time = p(a.getHours()) + ':' + p(a.getMinutes());
    saveMR(); openMR('run', r.id);
  });
  await pg.waitForTimeout(600);
  const 껌 = await pg.evaluate(() => {
    const btn = document.querySelector('.runstop');
    if(!btn) return 'no-btn';
    btn.click();
    return 'clicked';
  });
  await pg.waitForTimeout(900);
  T('③-1 ★ 단추를 눌렀다', 껌 === 'clicked', 껌);

  const 끈뒤 = await pg.evaluate(() => {
    const r = runs[runs.length - 1];
    return r ? { on:r.on, hours:r.hours, endTime:r.endTime, endDate:r.endDate } : null;
  });
  T('③-2 ★★ 껐다 (돌고 있음이 내려갔다)', 끈뒤 && 끈뒤.on === false, 끈뒤);
  T('③-3 ★★ 끈 시각이 찍혔다', /^\d{2}:\d{2}$/.test((끈뒤 || {}).endTime || ''), 끈뒤);
  T('③-4 ★★ 끈 날짜도 찍혔다', /^\d{4}-\d{2}-\d{2}$/.test((끈뒤 || {}).endDate || ''), 끈뒤);
  T('③-5 ★★★ 가동시간이 저절로 들어갔다 (90분 → 1.5시간)',
    끈뒤 && Math.abs(Number(끈뒤.hours) - 1.5) < 0.03, 끈뒤);

  // ── 총 가동시간에 반영됐는가 (정기점검 주기의 근거다)
  const 총 = await pg.evaluate(() => engineHours().total);
  T('③-6 ★ 총 가동시간에 들어갔다', Math.abs(총 - 1.5) < 0.05, 총);

  // ── 껐으니 이제 「켠 시각 · 끈 시각」 두 칸이 보여야 한다
  const 끝화면 = await pg.evaluate(() => {
    const lbl = [...document.querySelectorAll('#mrPanel .mrlbl')].map(x => (x.textContent || '').trim());
    return { 이름표:lbl, 도는틀:!!document.querySelector('.runon') };
  });
  T('④-1 ★ 끄고 나면 「돌고 있습니다」 틀이 사라진다', 끝화면.도는틀 === false, 끝화면);
  T('④-2 켠 시각 칸이 있다', 끝화면.이름표.indexOf('켠 시각') >= 0, 끝화면.이름표);
  T('④-3 끈 시각 칸이 있다', 끝화면.이름표.indexOf('끈 시각') >= 0, 끝화면.이름표);
  T('④-4 가동시간 칸이 있다', 끝화면.이름표.indexOf('가동시간') >= 0, 끝화면.이름표);

  // ── 끈 시각을 손으로 고치면 다시 셈하는가
  // ★★ 이 검사는 밤 9시 넘어 돌리면 늘 실패했다 — **검사가 틀린 것이었다.**
  //   켠 때로부터 3시간 뒤가 다음 날 새벽이면 끈 날짜도 다음 날이어야 한다.
  //   끈 날짜를 켠 날로 박아 두고 시각만 00:55 로 적으면 「끝이 시작보다 앞」 이 된다.
  //   ★ 앱은 그때 셈을 안 한다(옛값을 그대로 둔다). 그것이 맞다 —
  //     거꾸로 된 값을 억지로 셈하면 가동시간이 음수가 되어 총 시간이 줄어든다.
  //   그래서 날짜도 함께 옳게 넣고, 「거꾸로 넣으면 안 셈한다」 는 것은 따로 잰다.
  const 고침 = await pg.evaluate(() => {
    const r = runs[runs.length - 1];
    const p = n => String(n).padStart(2, '0');
    const a = new Date(r.date + 'T' + r.time + ':00');
    const b = new Date(a.getTime() + 3 * 3600000);      // 켠 때로부터 3시간
    mrOpenId = r.id; mrOpenType = 'run';
    runTimeSet('endDate', b.getFullYear() + '-' + p(b.getMonth() + 1) + '-' + p(b.getDate()));
    runTimeSet('endTime', p(b.getHours()) + ':' + p(b.getMinutes()));
    return runs[runs.length - 1].hours;
  });
  await pg.waitForTimeout(500);
  T('⑤-1 ★★ 끈 시각을 고치면 가동시간이 다시 셈된다 (3시간)',
    Math.abs(Number(고침) - 3) < 0.03, 고침);

  // ── 끝을 시작보다 앞으로 적으면 셈하지 않는다 (총 가동시간이 줄어들면 안 된다)
  const 거꾸로 = await pg.evaluate(() => {
    const r = runs[runs.length - 1];
    const 전 = r.hours;
    mrOpenId = r.id; mrOpenType = 'run';
    runTimeSet('endDate', r.date);
    runTimeSet('endTime', '00:01');                 // 켠 시각보다 앞
    const 뒤 = runs[runs.length - 1].hours;
    return { 전, 뒤, 총: engineHours().total };
  });
  T('⑤-2 ★★ 끝이 시작보다 앞이면 셈하지 않는다 (옛값을 지킨다)',
    Number(거꾸로.뒤) === Number(거꾸로.전), 거꾸로);
  T('⑤-3 ★★★ 총 가동시간이 음수로 내려가지 않는다', 거꾸로.총 >= 0, 거꾸로);

  // ── 목록에서 돌고 있는 것이 눈에 띄는가
  await pg.evaluate(() => {
    const p = n => String(n).padStart(2, '0');
    const a = new Date(Date.now() - 40 * 60000);
    runs.push({ id:'zz', date:a.getFullYear()+'-'+p(a.getMonth()+1)+'-'+p(a.getDate()),
                time:p(a.getHours())+':'+p(a.getMinutes()),
                endDate:'', endTime:'', on:true, hours:'', purpose:'충전', note:'' });
    saveMR(); try{ closeMR(); }catch(_){} goMaint('fuel');
  });
  await pg.waitForTimeout(800);
  const 목록 = await pg.evaluate(() => {
    const txt = (document.getElementById('fuelList') || {}).textContent || '';
    return { 돌고:/돌고 있음/.test(txt), 분:/40분|39분|41분/.test(txt) };
  });
  T('⑥-1 ★ 목록에서 「돌고 있음」이 보인다', 목록.돌고 === true, 목록);
  T('⑥-2 ★ 돌고 있는 것도 지금까지 얼마인지 보인다', 목록.분 === true, 목록);

  T('⑦ 화면에서 터진 데가 없다', errs.length === 0, errs.slice(0, 4));
  return 끝(br);
})().catch(async e => { console.log('★ 실패: 검사가 터졌습니다 — ' + e);
  console.log('\n합계: ' + ok + '개 통과 / ' + (bad + 1) + '개 실패');
  server.close(); process.exit(1); });
