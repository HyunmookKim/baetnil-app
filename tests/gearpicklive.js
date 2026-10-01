// 5.27 — 정기점검·수리의 「계통」·「장비」, 장비의 「상태」 를 눌러서 목록에서 선택 (2026-09-30 사장님 지적)
// 사장님 말씀: 「정기점검 그 항목에서 보면은 거기에 계통도 있고 그리고 그 안에 이제 어떤 장비인지도 나오는데
//              그거 그 목록을 이제 내가 눌러 가지고 볼 수 있게 하면 되잖아요」
// 쓰는 법: node gearpicklive.js ../www/index.html [사진폴더]
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const FILE = path.resolve(process.argv[2] || '../www/index.html'); const SHOT = process.argv[3] || '';
const ROOT = path.dirname(FILE);
let pass = 0, fail = 0;
const T = (n, c) => { if(c){ pass++; console.log('통과: ' + n); } else { fail++; console.log('★ 실패: ' + n); } };
const server = http.createServer((rq, rs) => { const u = rq.url.split('?')[0];
  fs.readFile(u === '/' ? FILE : path.join(ROOT, u), (e, d) => { if(e){ rs.writeHead(404); rs.end(); return; } rs.writeHead(200); rs.end(d); }); });
(async () => {
  await new Promise(r => server.listen(0, r));
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await br.newContext({ locale: 'ko-KR', timezoneId: 'Asia/Seoul', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await ctx.route(/googleapis|gstatic|firebaseio|firestore|open-meteo|openstreetmap|openseamap/, r => r.abort());
  await ctx.addInitScript(() => { try{ localStorage.setItem('bt_setup', 'done'); localStorage.setItem('bt_welcome', 'done'); }catch(_){} });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await pg.goto('http://127.0.0.1:' + server.address().port + '/', { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(1800);
  await pg.evaluate(() => {
    try{ skipWelcome(); }catch(_){}
    window.tell = () => Promise.resolve(); window.ask = () => Promise.resolve(true);
    unlocked = true;
    const A = { id:'boatA', name:'견본 배', type:'sail', members:{}, ranks:{} };
    boats = [A]; currentBoatId = A.id; window.currentBoatId = A.id;
    maint = maintDefaults();
    maint.push({ id:'g1', typ:'gear', name:'엔진', sys:'추진' }, { id:'g2', typ:'gear', name:'빌지펌프', sys:'배관·위생' },
               { id:'g3', typ:'gear', name:'VHF 무선전화', sys:'안전장비' }, { id:'g4', typ:'gear', name:'연료탱크', sys:'연료' });
    saveMR();
    goCheck(); openMR('maint', 'm07');
  });
  await pg.waitForTimeout(600);
  // 계통 칸
  const grpBtn = pg.locator('#mrPanel .mrrow', { hasText: '계통' }).locator('button.mrpickb');
  T('계통 칸이 누르는 칸이다', await grpBtn.count() === 1);
  T('계통 칸에 지금 계통이 보인다', (await grpBtn.innerText()).includes('엔진'));
  await grpBtn.click(); await pg.waitForTimeout(400);
  const grpOpts = await pg.locator('#formOv .fopt b').allInnerTexts();
  T('누르면 계통 목록이 뜬다', grpOpts.includes('엔진') && grpOpts.includes('전기') && grpOpts.includes('안전장비'));
  T('목록에 없는 계통은 직접 입력', grpOpts.includes('직접 입력'));
  if(SHOT) await pg.screenshot({ path: path.join(SHOT, 'grp-list.png') });
  await pg.locator('#formOv .fopt', { hasText: '전기' }).first().click();
  await pg.locator('#formOv .fbtn.go').click(); await pg.waitForTimeout(500);
  T('계통을 선택하면 바뀐다', await pg.evaluate(() => maint.find(x => x.id === 'm07').grp) === '전기');
  await pg.evaluate(() => { maint.find(x => x.id === 'm07').grp = '엔진'; saveMR(); openMR('maint', 'm07'); });
  await pg.waitForTimeout(400);
  // 장비 칸
  const gearBtn = pg.locator('#mrPanel .mrrow', { hasText: '장비' }).locator('button.mrpickb');
  T('장비 칸이 누르는 칸이다', await gearBtn.count() === 1);
  await gearBtn.click(); await pg.waitForTimeout(400);
  const gearOpts = await pg.locator('#formOv .fopt b').allInnerTexts();
  console.log('장비 목록:', gearOpts.join(' / '));
  T('누르면 장비 목록이 뜬다', gearOpts.includes('엔진') && gearOpts.includes('빌지펌프'));
  T('엔진 계통 항목이면 엔진 쪽 장비(추진·연료)가 먼저 나온다', gearOpts[1] === '엔진' && gearOpts[2] === '연료탱크');
  T('맨 앞은 선택 안 함, 끝에 직접 입력·장비 추가', gearOpts[0] === '선택 안 함' && gearOpts[gearOpts.length - 2] === '직접 입력' && gearOpts[gearOpts.length - 1] === '장비 추가');
  if(SHOT) await pg.screenshot({ path: path.join(SHOT, 'gear-list.png') });
  await pg.locator('#formOv .fopt', { hasText: '엔진' }).first().click();
  await pg.locator('#formOv .fbtn.go').click(); await pg.waitForTimeout(500);
  T('장비를 선택하면 그 장비와 연결된다', await pg.evaluate(() => maint.find(x => x.id === 'm07').gearId) === 'g1');
  T('정기점검 창에 연결된 장비가 보인다', (await pg.locator('#mrPanel .mrrow', { hasText: '장비' }).first().innerText()).includes('엔진'));
  if(SHOT) await pg.screenshot({ path: path.join(SHOT, 'maint-linked.png') });
  T('엔진 장비 창에 이 정기점검이 나온다', await pg.evaluate(() => gearMaint('g1').some(m => m.id === 'm07')));
  // 선택 안 함으로 되돌리기
  await pg.locator('#mrPanel .mrrow', { hasText: '장비' }).locator('button.mrpickb').click(); await pg.waitForTimeout(300);
  await pg.locator('#formOv .fopt', { hasText: '선택 안 함' }).first().click();
  await pg.locator('#formOv .fbtn.go').click(); await pg.waitForTimeout(400);
  T('선택 안 함으로 연결을 끊을 수 있다', !(await pg.evaluate(() => maint.find(x => x.id === 'm07').gearId)));
  // 직접 입력 — 사장님: 「꼭 등록된 장비가 아닐수도 있으니가 자기가 칠수도 있게」
  await pg.evaluate(() => { window.askText = () => Promise.resolve('발전기(혼다 EU22i)'); });
  const nGear0 = await pg.evaluate(() => gearRows().length);
  await pg.locator('#mrPanel .mrrow', { hasText: '장비' }).locator('button.mrpickb').click(); await pg.waitForTimeout(300);
  await pg.locator('#formOv .fopt', { hasText: '직접 입력' }).first().click();
  await pg.locator('#formOv .fbtn.go').click(); await pg.waitForTimeout(700);
  const typed = await pg.evaluate(() => { const m = maint.find(x => x.id === 'm07'); return { n: m.gearName, id: m.gearId || '' }; });
  T('직접 입력 — 친 이름이 그 항목에 남는다', typed.n === '발전기(혼다 EU22i)' && !typed.id, typed);
  T('직접 입력 — 장비 목록에는 안 들어간다', await pg.evaluate(() => gearRows().length) === nGear0);
  T('직접 입력 — 칸에 친 이름이 보인다', (await pg.locator('#mrPanel .mrrow', { hasText: '장비' }).first().innerText()).includes('발전기(혼다 EU22i)'));
  // 장비 추가 — 친 이름이 있으면 그 이름으로 장비를 만든다
  await pg.locator('#mrPanel .mrrow', { hasText: '장비' }).locator('button.mrpickb').click(); await pg.waitForTimeout(300);
  await pg.locator('#formOv .fopt', { hasText: '장비 추가' }).first().click();
  await pg.locator('#formOv .fbtn.go').click(); await pg.waitForTimeout(600);
  const made = await pg.evaluate(() => { const m = maint.find(x => x.id === 'm07'); const g = gearOf(m.gearId); return g ? { name: g.name, sys: g.sys } : null; });
  T('장비 추가 — 새 장비를 만들어 연결한다 (계통은 추진)', made && made.sys === '추진');
  T('장비 추가 — 직접 입력해 둔 이름으로 만든다', made && made.name === '발전기(혼다 EU22i)', made);
  T('장비 추가 뒤 쳐 둔 이름은 비운다', !(await pg.evaluate(() => maint.find(x => x.id === 'm07').gearName)));
  // 보기 모드에서는 누르는 칸이 아니다
  await pg.evaluate(() => { unlocked = false; openMR('maint', 'm07'); }); await pg.waitForTimeout(300);
  T('편집 중이 아니면 누르는 칸이 안 나온다', await pg.locator('#mrPanel button.mrpickb').count() === 0);
  // 수리 창도 같은 방식
  await pg.evaluate(() => { unlocked = true; repair = [{ id:'r1', title:'빌지펌프 고장', status:'open', created:'2026-09-30' }]; saveMR(); goMaint('repair'); openMR('repair', 'r1'); });
  await pg.waitForTimeout(400);
  T('수리 창의 장비 칸도 누르는 칸이다', await pg.locator('#mrPanel .mrrow', { hasText: '장비' }).locator('button.mrpickb').count() === 1);
  // 수리 창 계통 — 사장님: 「내가 그렇게 바꾸라 했잖아」
  const rgBtn = pg.locator('#mrPanel .mrrow', { hasText: '계통' }).locator('button.mrpickb');
  T('수리 창의 계통 칸도 누르는 칸이다', await rgBtn.count() === 1);
  await rgBtn.click(); await pg.waitForTimeout(300);
  const rgOpts = await pg.locator('#formOv .fopt b').allInnerTexts();
  T('수리 계통 목록 — 맨 앞 선택 안 함, 계통들, 맨 끝 직접 입력', rgOpts[0] === '선택 안 함' && rgOpts.includes('엔진') && rgOpts[rgOpts.length - 1] === '직접 입력', rgOpts.join('/'));
  await pg.locator('#formOv .fopt', { hasText: '엔진' }).first().click();
  await pg.locator('#formOv .fbtn.go').click(); await pg.waitForTimeout(500);
  T('수리 계통을 선택하면 바뀐다', await pg.evaluate(() => repair[0].grp) === '엔진');
  await pg.locator('#mrPanel .mrrow', { hasText: '계통' }).locator('button.mrpickb').click(); await pg.waitForTimeout(300);
  await pg.locator('#formOv .fopt', { hasText: '선택 안 함' }).first().click();
  await pg.locator('#formOv .fbtn.go').click(); await pg.waitForTimeout(500);
  T('수리 계통은 비울 수 있다', !(await pg.evaluate(() => repair[0].grp)));
  // ── 장비 창 「상태」 — 사장님: 「이건또 이상이 없는지 있는지 못바꾸냐」 → 1번(누르면 목록, 고장이면 고장 기록)
  await pg.evaluate(() => { unlocked = true; repair = []; saveMR(); setBoatSubTab('gear'); openMR('gear', 'g2'); });
  await pg.waitForTimeout(400);
  const stBtn = pg.locator('#mrPanel .mrrow', { hasText: '상태' }).locator('button.mrpickb');
  T('장비 상태 칸이 누르는 칸이다', await stBtn.count() === 1);
  T('처음에는 이상 없음', (await stBtn.innerText()).includes('이상 없음'));
  await stBtn.click(); await pg.waitForTimeout(300);
  T('누르면 이상 없음 / 고장 목록', JSON.stringify(await pg.locator('#formOv .fopt b').allInnerTexts()) === JSON.stringify(['이상 없음', '고장']));
  await pg.locator('#formOv .fopt', { hasText: '고장' }).first().click();
  await pg.locator('#formOv .fbtn.go').click(); await pg.waitForTimeout(600);
  const rp = await pg.evaluate(() => ({ n: repair.length, g: repair[0] && repair[0].gearId, st: repair[0] && repair[0].status, open: typeof mrOpenType !== 'undefined' ? mrOpenType : '' }));
  T('고장을 선택하면 이 장비와 연결된 고장 기록이 생기고 그 창이 열린다', rp.n === 1 && rp.g === 'g2' && rp.st === 'open' && rp.open === 'repair');
  await pg.evaluate(() => openMR('gear', 'g2')); await pg.waitForTimeout(300);
  T('장비 상태가 고장 1 로 바뀐다', (await pg.locator('#mrPanel .mrrow', { hasText: '상태' }).innerText()).includes('고장 1'));
  if(SHOT) await pg.screenshot({ path: path.join(SHOT, 'gear-broken.png') });
  await pg.locator('#mrPanel .mrrow', { hasText: '상태' }).locator('button.mrpickb').click(); await pg.waitForTimeout(300);
  await pg.locator('#formOv .fopt', { hasText: '이상 없음' }).first().click();
  await pg.locator('#formOv .fbtn.go').click(); await pg.waitForTimeout(600);
  const done = await pg.evaluate(() => ({ st: repair[0].status, d: repair[0].doneDate, n: repair.length }));
  T('이상 없음을 선택하면 그 고장을 완료 처리한다 (기록은 남는다)', done.st === 'done' && !!done.d && done.n === 1);
  T('장비 상태가 이상 없음으로 돌아온다', (await pg.locator('#mrPanel .mrrow', { hasText: '상태' }).innerText()).includes('이상 없음'));
  await pg.evaluate(() => { unlocked = false; openMR('gear', 'g2'); }); await pg.waitForTimeout(300);
  T('편집 중이 아니면 상태는 보기만', await pg.locator('#mrPanel .mrrow', { hasText: '상태' }).locator('button.mrpickb').count() === 0);
  T('페이지 오류 없음', errs.length === 0);
  if(errs.length) console.log(errs.join('\n'));
  console.log(`\n${pass} 통과 · ${fail} 실패`);
  await br.close(); server.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('★ 멈춤 ' + e); process.exit(1); });
