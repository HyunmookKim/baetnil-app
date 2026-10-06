// 5.42 — 진짜 브라우저에서 눌러 본다
// 사장님 (2026-10-06)
//   ① 「무관은 또 뭐냐? 또 좆같은 단어쓰네」 — 항적 숨기기 「가림 반경」 의 빈 값
//   ② 「항해기록이랑 거리 엔진시간은 2026년도 것만 보는게 아니라 사용자가 월별 일별 1년 3년 5년 … 자율적으로 기간 선택」
//   ③ 「만탱크후 가동도 자기가 어느시점부터 가동했는지 보고 싶은 사람들도 있어서 알아서 볼수 있게 해라」
//   ④ 「이 두버튼은 왜 보기전용인데 안사라지냐?」 — 연료 「계산값으로 되돌리기」 (앱 전체는 lockhidelive 가 본다)
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const FILE = path.resolve(process.argv[2] || path.join(__dirname, '..', 'www', 'index.html'));
const ROOT = path.dirname(FILE);
const server = http.createServer((rq, rs) => {
  const u = rq.url.split('?')[0];
  fs.readFile(u === '/' ? FILE : path.join(ROOT, u), (e, d) => { if(e){ rs.writeHead(404); rs.end(); return; } rs.writeHead(200); rs.end(d); });
});
let ok = 0, bad = 0;
const T = (n, c, w) => { if(c){ ok++; console.log('통과: ' + n); } else { bad++; console.log('★ 실패: ' + n + (w !== undefined ? ' — ' + JSON.stringify(w).slice(0, 300) : '')); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SHOT = process.env.SHOT || '';

(async () => {
  await new Promise(r => server.listen(0, r));
  const url = 'http://127.0.0.1:' + server.address().port + '/';
  const br = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  async function open(theme, lang){
    const ctx = await br.newContext({ locale:'ko-KR', viewport:{ width:390, height:844 }, isMobile:true, hasTouch:true });
    await ctx.route(/googleapis|gstatic|firebaseio|firestore|open-meteo|openstreetmap|openseamap/, r => r.abort());
    await ctx.addInitScript(({ theme, lang }) => { try{ localStorage.setItem('bt_setup', 'done'); localStorage.setItem('bt_welcome', 'done');
      if(theme) localStorage.setItem('bt_theme', theme); if(lang && lang !== 'ko') localStorage.setItem('bt_lang', lang); }catch(_){} }, { theme, lang });
    const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(String(e).slice(0, 200)));
    await pg.goto(url, { waitUntil:'domcontentloaded' }); await sleep(1500);
    await pg.evaluate(() => { window.ask = () => Promise.resolve(true); try{ skipWelcome(); }catch(_){} unlocked = true; try{ openBoatSetup(); }catch(_){} });
    await sleep(400);
    await pg.evaluate(() => { const n = document.getElementById('nbName'); if(n){ n.value = '시험호'; createBoat(); } });
    await sleep(900);
    // 항해: 올해 5건, 작년 2건, 3년 전 1건, 예정 1건 / 연료: 만탱크 → 부분 주유 → 엔진
    await pg.evaluate(() => {
      const p = n => String(n).padStart(2, '0'), d0 = new Date(), Y = d0.getFullYear(), M = d0.getMonth() + 1, D = d0.getDate();
      const ago = (y, m, d) => { const x = new Date(Y - y, d0.getMonth() - m, D - d); return x.getFullYear() + '-' + p(x.getMonth() + 1) + '-' + p(x.getDate()); };
      const td = Y + '-' + p(M) + '-' + p(D);
      voyage = [
        { id:'a1', date: td, title:'오늘', nm:'10', engineH:'1', logs:[] },
        { id:'a2', date: Y + '-01-01', title:'설날', nm:'20', engineH:'2', logs:[] },
        { id:'a3', date: ago(1, 0, -10), title:'작년 늦게', nm:'30', engineH:'3', logs:[] },     // 1년 안
        { id:'a4', date: ago(2, 0, 0), title:'2년 전', nm:'40', engineH:'4', logs:[] },
        { id:'a5', date: ago(4, 0, 0), title:'4년 전', nm:'50', engineH:'5', logs:[] },
        { id:'a6', date: ago(0, 0, -20), plan:true, title:'예정', nm:'99', engineH:'9', logs:[] }
      ];
      window.__td = td; window.__Y = Y;
      fuel = [ { id:'f1', date: ago(0, 2, 0), liters:240, full:true }, { id:'f2', date: ago(0, 1, 0), liters:50 } ];
      runs = [ { id:'r1', date: ago(0, 1, -5), hours:3, purpose:'충전' }, { id:'r2', date: ago(0, 2, -3), hours:2, purpose:'충전' } ];
      saveMR();
    });
    return { ctx, pg, errs };
  }

  // ══ ① 「무관」 → 「없음」 ══
  let { ctx, pg, errs } = await open(null, 'ko');
  const 가림 = await pg.evaluate(() => { const b = curBoat(); b.pub = Object.assign({}, b.pub, { voyage:true }); return trkHideRows(b); });
  T('① 가림 반경에 「무관」 이 없고 「없음」 이 있다', !/무관/.test(가림) && />없음</.test(가림), 가림.slice(0, 300));
  T('① 사전(영·러·일)에도 「무관」 이 없다', !/'무관':/.test(fs.readFileSync(FILE, 'utf8')));

  // ══ ② 항해 기간 ══
  await pg.evaluate(() => { boatSubTab = 'voyage'; switchTab('boat'); });
  await sleep(600);
  const 숫자 = () => pg.evaluate(() => [...document.querySelectorAll('#voyageList .statrow .stat b')].map(b => b.textContent.trim()));
  const 칩 = await pg.evaluate(() => [...document.querySelectorAll('#voyageList .perrow .tab')].map(b => b.textContent.trim() + (b.classList.contains('on') ? '*' : '')));
  T('② 기간 칩: 이번 달 · 올해 · 1년 · 3년 · 5년 · 전체 · 직접 입력 (처음은 올해)',
    칩.join('|') === ['이번 달', (await pg.evaluate(() => __Y)) + '년*', '1년', '3년', '5년', '전체', '직접 입력'].join('|'), 칩);
  T('② 올해 — 예정은 빼고 올해 것만 (2건 · 30 · 3)', (await 숫자()).join() === '2,30,3', await 숫자());
  T('② 항해 이름표에 해가 박혀 있지 않다 (「항해」)', await pg.evaluate(() => document.querySelector('#voyageList .statrow .stat span').textContent.trim() === '항해'));
  const 누름 = async name => { await pg.locator('#voyageList .perrow .tab', { hasText: name }).first().click(); await sleep(350); return 숫자(); };
  T('② 1년 — 최근 1년 (오늘·설날·작년 늦게)', (await 누름('1년')).join() === '3,60,6', await 숫자());
  T('② 3년', (await 누름('3년')).join() === '4,100,10', await 숫자());
  T('② 5년', (await 누름('5년')).join() === '5,150,15', await 숫자());
  T('② 전체 — 예정은 빼고 다', (await 누름('전체')).join() === '5,150,15', await 숫자());
  T('② 이번 달', (await 누름('이번 달')).join().split(',')[0] >= '1', await 숫자());
  // 직접 입력 — 4년 전 그 날 하루만
  await pg.locator('#voyageList .perrow .tab', { hasText:'직접 입력' }).click();
  await sleep(400);
  const 폼 = await pg.evaluate(() => ({ t: document.getElementById('lkFormTitle').textContent, lbl: [...document.querySelectorAll('#formBody label')].map(x => x.textContent),
    ty: [...document.querySelectorAll('#formBody input')].map(x => x.type) }));
  T('② 직접 입력 — 시작일·종료일 날짜 칸', 폼.t === '직접 입력' && 폼.lbl.join() === '시작일,종료일' && 폼.ty.join() === 'date,date', 폼);
  const d4 = await pg.evaluate(() => voyage.find(v => v.id === 'a5').date);
  await pg.locator('#ff0').fill(d4); await pg.locator('#ff1').fill(d4);
  await pg.locator('#formFoot .fbtn.go').click(); await sleep(500);
  T('② 직접 입력 — 고른 날 하루만 (1 · 50 · 5)', (await 숫자()).join() === '1,50,5', await 숫자());
  const 칩2 = await pg.evaluate(() => { const b = document.querySelector('#voyageList .perrow .tab.on'); const R = b.parentElement.getBoundingClientRect(), r = b.getBoundingClientRect();
    return { txt: b.textContent.trim(), inView: r.left >= R.left - 1 && r.right <= R.right + 1 }; });
  T('② 직접 입력 칩에 고른 기간이 보이고, 화면 안으로 밀려 있다', 칩2.txt === d4.replace(/-/g, '.') + ' – ' + d4.replace(/-/g, '.') && 칩2.inView, 칩2);
  // 다시 켜도 기억
  await pg.reload({ waitUntil:'domcontentloaded' }); await sleep(1600);
  await pg.evaluate(() => { boatSubTab = 'voyage'; switchTab('boat'); }); await sleep(500);
  T('② 다시 켜도 고른 기간을 기억한다', (await 숫자()).join() === '1,50,5', await 숫자());
  // 시작일이 비면
  await pg.evaluate(() => voyPerPick()); await sleep(300);
  await pg.locator('#ff0').fill(''); await pg.locator('#formFoot .fbtn.go').click(); await sleep(300);
  T('② 시작일이 비면 칸 아래에 알리고 창은 그대로', await pg.evaluate(() => /시작일을 입력해 주세요/.test(document.getElementById('formBody').textContent) && getComputedStyle(document.getElementById('formOv')).display !== 'none'));
  await pg.evaluate(() => closeForm());
  // 보기 전용에서도 기간은 고른다 (보는 것이지 고치는 것이 아니다)
  await pg.evaluate(() => { unlocked = false; applyLock(); renderVoyage(); }); await sleep(300);
  T('② 보기 전용에서도 기간을 고를 수 있다', (await 누름('전체')).join() === '5,150,15', await 숫자());
  if(SHOT) await pg.screenshot({ path: SHOT + '-voyage.png' });

  // ══ ③ 가동 시간의 시작 시점 ══
  await pg.evaluate(() => { boatSubTab = 'maint'; mntSub = 'fuel'; switchTab('boat'); }); await sleep(600);
  const 칸 = () => pg.evaluate(() => { const s = document.querySelector('#fuelList .stat.pickstat'); return s ? { b: s.querySelector('b').textContent.replace(/\s+/g, ''), l: s.querySelector('span').textContent.trim() } : null; });
  let c = await 칸();
  const 만탱값 = await pg.evaluate(() => fuelSinceFull().h);
  T('③ 처음은 「만탱크 후 가동 ▾」 — 예전 칸과 같은 값', c && c.l === '만탱크 후 가동▾' && 만탱값 > 0 && c.b.startsWith(String(Math.floor(만탱값))), { c, 만탱값 });
  await pg.locator('#fuelList .stat.pickstat').click(); await sleep(400);
  const 고름 = await pg.evaluate(() => ({ t: document.getElementById('lkFormTitle').textContent, o: [...document.querySelectorAll('#formBody .fopt b')].map(x => x.textContent) }));
  T('③ 누르면 「시작 시점」 — 만탱크 후 · 주유 후 · 직접 입력 (보기 전용에서도)', 고름.t === '시작 시점' && 고름.o.join() === '만탱크 후,주유 후,직접 입력', 고름);
  await pg.locator('#formBody .fopt', { hasText:'주유 후' }).click(); await pg.locator('#formFoot .fbtn.go').click(); await sleep(400);
  c = await 칸();
  const 주유값 = await pg.evaluate(() => ehSince().h);
  T('③ 주유 후 — 마지막 주유(부분 주유) 뒤 엔진 시간: 만탱크 후보다 적다(그 사이 충전 2시간이 빠진다)', c && c.l === '주유 후 가동▾' && 주유값 > 0 && Math.abs((만탱값 - 주유값) - 2) < 0.01, { c, 만탱값, 주유값 });
  await pg.locator('#fuelList .stat.pickstat').click(); await sleep(300);
  await pg.locator('#formBody .fopt', { hasText:'직접 입력' }).click(); await pg.locator('#formFoot .fbtn.go').click(); await sleep(400);
  const 날폼 = await pg.evaluate(() => ({ t: document.getElementById('lkFormTitle').textContent, ty: [...document.querySelectorAll('#formBody input')].map(x => x.type), lbl: [...document.querySelectorAll('#formBody label')].map(x => x.textContent) }));
  T('③ 직접 입력 — 시작일 날짜 칸', 날폼.t === '직접 입력' && 날폼.ty.join() === 'date' && 날폼.lbl.join() === '시작일', 날폼);
  const 시작 = await pg.evaluate(() => fuel[0].date);
  await pg.locator('#ff0').fill(시작); await pg.locator('#formFoot .fbtn.go').click(); await sleep(400);
  c = await 칸();
  const 날값 = await pg.evaluate(() => ehSince().h);
  T('③ 직접 입력 — 「{날짜} 이후 가동」 · 만탱크 그날부터 = 만탱크 후와 같다', c && c.l === 시작 + ' 이후 가동▾' && Math.abs(날값 - 만탱값) < 0.01, { c, 날값, 만탱값 });
  T('③ 고른 기준은 기기에 남는다 (배마다)', await pg.evaluate(() => /"k":"date"/.test(localStorage.getItem('bt_ehfrom@' + currentBoatId) || '')));
  if(SHOT) await pg.screenshot({ path: SHOT + '-fuel.png' });

  // ══ ④ 보기 전용 — 「계산값으로 되돌리기」 ══
  await pg.evaluate(() => { unlocked = true; applyLock(); { const b = curBoat(); b.spec = Object.assign({}, b.spec, { fuelTank: 240 }); } fuelSetPut({ lph: 7.2, how: 'est' }); fuel.push({ id:'f3', date: today(), time:'09:00', kind:'level', level: 50 }); saveMR(); renderFuel(); });
  await sleep(300);
  const 편집 = await pg.evaluate(() => [...document.querySelectorAll('#fuelList button')].filter(b => b.getClientRects().length && /계산값으로 되돌리기/.test(b.textContent)).length);
  await pg.evaluate(() => { unlocked = false; applyLock(); renderFuel(); }); await sleep(300);
  const 보기 = await pg.evaluate(() => [...document.querySelectorAll('#fuelList button')].filter(b => b.getClientRects().length && /계산값으로 되돌리기/.test(b.textContent)).length);
  T('④ 편집 중에는 「계산값으로 되돌리기」 두 개가 보이고, 보기 전용이면 사라진다', 편집 === 2 && 보기 === 0, { 편집, 보기 });
  await pg.evaluate(() => { fuelClearLph(); fuelClearMark(); });
  T('④ 보기 전용이면 함수를 불러도 안 바뀐다', await pg.evaluate(() => fuelLphSet() === 7.2 && fuel.some(f => f.id === 'f3')));
  T('오류 없음 (노을·한국어)', errs.length === 0, errs);
  await ctx.close();

  // ══ 세 화면 × 네 언어 ══
  const 말 = { ko:['이번 달', '1년', '시작 시점'], en:['This month', '1 year', 'Count from'], ru:['Этот месяц', '1 год', 'Отсчёт с'], ja:['今月', '1年', '起点'] };
  for(const theme of ['sunset', 'black', 'light']){
    for(const lang of (theme === 'sunset' ? ['en', 'ru', 'ja'] : ['ko', 'en'])){
      const o = await open(theme, lang);
      await o.pg.evaluate(() => { boatSubTab = 'voyage'; switchTab('boat'); }); await sleep(500);
      const r = await o.pg.evaluate(() => [...document.querySelectorAll('#voyageList .perrow .tab')].map(b => b.textContent.trim()));
      if(SHOT) await o.pg.screenshot({ path: SHOT + '-' + theme + '-' + lang + '-voy.png' });
      await o.pg.evaluate(() => { boatSubTab = 'maint'; mntSub = 'fuel'; switchTab('boat'); }); await sleep(500);
      await o.pg.evaluate(() => ehFromPick()); await sleep(300);
      const ft = await o.pg.evaluate(() => document.getElementById('lkFormTitle').textContent);
      if(SHOT) await o.pg.screenshot({ path: SHOT + '-' + theme + '-' + lang + '-fuel.png' });
      T('⑤ ' + theme + '·' + lang + ' — 기간 칩·시작 시점 창이 번역돼 뜬다', r[0] === 말[lang][0] && r[2] === 말[lang][1] && ft === 말[lang][2], { r, ft });
      T('⑤ ' + theme + '·' + lang + ' — 오류 없음', o.errs.length === 0, o.errs);
      await o.ctx.close();
    }
  }
  console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
  await br.close(); server.close(); process.exit(bad ? 1 : 0);
})().catch(e => { console.log('★ 실패: 검사가 멈췄습니다 — ' + e); process.exit(1); });
