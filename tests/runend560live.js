// 5.60 — 진짜 브라우저: 끄는 것을 잊은 엔진 가동에 정지 시각을 넣어 끝내기 · 세 테마 사진
// ★ 사장님 (2026-11-27): 「이건 내가 나중에 3시간 돌렸다고 쓰고 싶어도 못쓰게 되있네」
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const FILE = path.resolve(process.argv[2] || '../www/index.html');
const SHOT = process.argv[3] || '';
const ROOT = path.dirname(FILE);
const server = http.createServer((rq, rs) => { const u = rq.url.split('?')[0];
  fs.readFile(u === '/' ? FILE : path.join(ROOT, u), (e, d) => { if(e){ rs.writeHead(404); rs.end(); return; } rs.writeHead(200); rs.end(d); }); });
let ok = 0, bad = 0;
const T = (n, c, w) => { if(c){ ok++; console.log('통과: ' + n); }
  else { bad++; console.log('★ 실패: ' + n + (w !== undefined ? ' — ' + JSON.stringify(w).slice(0, 260) : '')); } };
(async () => {
  await new Promise(r => server.listen(0, r));
  const br = await chromium.launch(fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? { executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' } : {});
  const errs = [];
  for(const theme of ['sunset', 'black', 'light']){
    const ctx = await br.newContext({ locale:'ko-KR', timezoneId:'Asia/Seoul', viewport:{ width:390, height:844 }, isMobile:true, hasTouch:true, deviceScaleFactor: SHOT ? 2 : 1 });
    await ctx.route(/googleapis|gstatic|firebaseio|firestore|open-meteo|openstreetmap|openseamap/, r => r.abort());
    const pg = await ctx.newPage();
    pg.on('pageerror', e => errs.push(theme + ' ' + String(e).slice(0, 160)));
    await pg.goto('http://127.0.0.1:' + server.address().port + '/', { waitUntil:'domcontentloaded' });
    await pg.waitForTimeout(1400);
    await pg.evaluate((th) => { window.alert = () => {}; window.confirm = () => true;
      window.ask = () => Promise.resolve(true);
      try{ skipWelcome(); }catch(_){} unlocked = true;
      try{ window.btLook.set ? window.btLook.set('theme', th) : lookPick('theme', th); }catch(_){ try{ lookPick('theme', th); }catch(__){} }
      try{ openBoatSetup(); }catch(_){} }, theme);
    await pg.waitForTimeout(500);
    await pg.evaluate(() => { const n = document.getElementById('nbName'); if(n){ n.value = '시험호'; createBoat(); } });
    await pg.waitForTimeout(1200);
    // 사장님 화면 그대로: 어제 21:47 에 켜 놓고 끄는 것을 잊음
    const id = await pg.evaluate(() => {
      unlocked = true; goMaint('fuel'); addRun();
      const it = runs[runs.length - 1];
      const d = new Date(Date.now() - 864e5); const p = n => String(n).padStart(2,'0');
      it.date = d.getFullYear() + '-' + p(d.getMonth()+1) + '-' + p(d.getDate()); it.time = '21:47'; it.on = true;
      saveMR(); renderFuel(); openMR('run', it.id); return it.id;
    });
    await pg.waitForTimeout(600);
    const 칸 = await pg.evaluate(() => {
      const rows = [...document.querySelectorAll('#mrPanel .mrrow')];
      const r = rows.find(x => /정지 시각/.test(x.querySelector('.mrlbl') ? x.querySelector('.mrlbl').textContent : ''));
      const inp = r && r.querySelector('input.logtime');
      return { 있음: !!inp, 지금껐: !!document.querySelector('#mrPanel .runstop'),
               가동칸: rows.some(x => /가동시간/.test(x.querySelector('.mrlbl') ? x.querySelector('.mrlbl').textContent : '')) };
    });
    T(theme + ' ①-1 돌고 있을 때 정지 시각 칸이 보인다', 칸.있음, 칸);
    T(theme + ' ①-2 「지금 껐습니다」 도 그대로 있다', 칸.지금껐, 칸);
    T(theme + ' ①-3 가동시간 칸은 안 보인다', !칸.가동칸, 칸);
    if(SHOT) await pg.screenshot({ path: path.join(SHOT, theme + '-1-running.png') });
    // 진짜로 손가락으로 적는다
    const inp = pg.locator('#mrPanel .mrrow', { hasText:'정지 시각' }).locator('input.logtime');
    await inp.click(); await inp.fill(''); await pg.keyboard.type('0047'); await inp.press('Enter'); await inp.blur();
    await pg.waitForTimeout(800);
    const 뒤 = await pg.evaluate((id) => { const it = runs.find(x => String(x.id) === String(id));
      return { on: it.on, endTime: it.endTime, endDate: it.endDate, date: it.date, hours: it.hours,
               종료일칸: [...document.querySelectorAll('#mrPanel .mrrow .mrlbl')].some(x => /종료일/.test(x.textContent)) }; }, id);
    T(theme + ' ②-1 ★ 00:47 을 넣으니 끝났다 · 가동시간 3시간', 뒤.on === false && 뒤.endTime === '00:47' && Number(뒤.hours) === 3, 뒤);
    T(theme + ' ②-2 끈 날짜가 다음 날로 들어갔다 · 종료일 칸이 보인다', 뒤.endDate > 뒤.date && 뒤.종료일칸, 뒤);
    if(SHOT) await pg.screenshot({ path: path.join(SHOT, theme + '-2-stopped.png') });
    await ctx.close();
  }
  T('③ 화면 오류 없음', errs.length === 0, errs);
  console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
  await br.close(); server.close(); process.exit(bad ? 1 : 0);
})();
