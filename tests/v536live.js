// 5.36 — 실제 화면에서 (사장님 지적 다섯 가지, 2026-10-04)
//   ① 장비 「고장」 → 말 없이 제목 없는 수리 기록이 생기던 것  ② 머리 단추(저장 후 닫기·그냥 닫기·목록)  ③ 내리면 사라지던 줄
//   ④ 연락처 「직접 입력」 이름 자리  ⑤ 날씨 일출·일몰
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const FILE = process.argv[2] || 'work.html';
const SHOT = process.env.SHOT_DIR || '';
const server = http.createServer((rq, rs) => {
  const f = ((rq.url === '/' && path.isAbsolute(FILE)) ? FILE : path.join(__dirname, rq.url === '/' ? FILE : rq.url.split('?')[0]));
  fs.readFile(f, (e, d) => { if(e){ rs.writeHead(404); rs.end(); return; }
    if(f.endsWith('.woff2')) rs.setHeader('Content-Type', 'font/woff2');
    rs.writeHead(200); rs.end(d); });
});
let ok = 0, bad = 0;
const T = (n, c, w) => { if(c){ ok++; console.log('통과: ' + n); } else { bad++; console.log('★ 실패: ' + n + (w !== undefined ? ' — ' + JSON.stringify(w).slice(0, 300) : '')); } };

async function run(br, lang){
  const ctx = await br.newContext({ locale: lang === 'ko' ? 'ko-KR' : 'en-US', timezoneId: 'Asia/Seoul', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(l => { try{ localStorage.setItem('bt_lang', l); }catch(e){} }, lang);
  await ctx.route(/googleapis|gstatic|firebaseio|firestore|openstreetmap|openseamap/, r => r.abort());
  // 날씨는 가짜로 준다 — 일출 06:24 · 일몰 18:05 (서울 시각)
  await ctx.route(/open-meteo\.com/, r => {
    const u = r.request().url();
    const days = 5, H = days * 24, base = new Date(); base.setHours(0, 0, 0, 0);
    const p = n => String(n).padStart(2, '0');
    const iso = d => d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes());
    const time = [], arr = v => Array.from({ length: H }, () => v);
    for(let i = 0; i < H; i++) time.push(iso(new Date(base.getTime() + i * 3600e3)));
    const sr = [], ss = [], dt = [];
    for(let d = 0; d < days; d++){ const x = new Date(base.getTime() + d * 864e5);
      dt.push(iso(x).slice(0, 10)); sr.push(iso(x).slice(0, 10) + 'T06:24'); ss.push(iso(x).slice(0, 10) + 'T18:05'); }
    const body = /marine/.test(u)
      ? { latitude: 34.74, longitude: 127.74, utc_offset_seconds: 32400, timezone: 'Asia/Seoul', hourly: { time, wave_height: arr(0.6), wave_period: arr(5), wave_direction: arr(180), sea_level_height_msl: arr(0) } }
      : { latitude: 34.74, longitude: 127.74, utc_offset_seconds: 32400, timezone: 'Asia/Seoul',
          hourly: { time, temperature_2m: arr(21), apparent_temperature: arr(21), precipitation: arr(0), weather_code: arr(1),
                    wind_speed_10m: arr(9), wind_direction_10m: arr(200), wind_gusts_10m: arr(14), visibility: arr(20000) },
          daily: { time: dt, sunrise: sr, sunset: ss } };
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(String(e).slice(0, 160)));
  const shot = async n => { if(SHOT) await pg.screenshot({ path: path.join(SHOT, lang + '-' + n + '.png') }); };
  await pg.goto('http://127.0.0.1:' + server.address().port + '/', { waitUntil: 'networkidle' });
  await pg.waitForTimeout(900);
  await pg.evaluate(() => { window.__al = [];
    window.tell = m => { window.__al.push(String(m)); return Promise.resolve(); };
    window.__askAns = true;
    window.ask = m => { window.__al.push('ASK ' + String(m)); return Promise.resolve(window.__askAns); };
    try{ skipWelcome(); }catch(_){} unlocked = true; openBoatSetup(); });
  await pg.waitForTimeout(400);
  await pg.evaluate(() => { document.getElementById('nbName').value = '시험호'; createBoat(); });
  await pg.waitForTimeout(1500);
  const L = '[' + lang + '] ';

  // ── ① 장비 고장
  await pg.evaluate(() => { const g = gearNew(); g.name = '빌지펌프'; maint.push(g); saveMR(); setBoatSubTab('gear'); setGearSub('gear'); openMR('gear', g.id); window.__g = g.id; });
  await pg.waitForTimeout(500);
  const r0 = await pg.evaluate(() => repair.length);
  await pg.evaluate(() => gearStatePick(window.__g));
  await pg.waitForTimeout(300);
  const pickTxt = await pg.evaluate(() => document.getElementById('formOv').innerText);
  T(L + '상태 고르기에 「고장 → 수리목록에 추가됩니다」 가 보인다', /수리목록에 추가됩니다|Added to Repairs/.test(pickTxt), pickTxt.slice(0, 200));
  await pg.evaluate(() => { formPick.s = 'bad'; formOk(); });
  await pg.waitForTimeout(400);
  const f1 = await pg.evaluate(() => ({ title: document.getElementById('lkFormTitle').textContent, open: getComputedStyle(document.getElementById('formOv')).display !== 'none', n: repair.length }));
  T(L + '「고장」 을 골라도 수리 기록이 말 없이 생기지 않는다 — 내용을 묻는 창', f1.open && f1.n === r0, f1);
  await shot('1-gear-fault-ask');
  await pg.evaluate(() => formOk());   // 빈 내용으로
  await pg.waitForTimeout(200);
  const f2 = await pg.evaluate(() => ({ err: [...document.querySelectorAll('#formOv .ferr')].some(e => e.offsetParent && e.textContent.trim()), n: repair.length }));
  T(L + '내용 없이 추가하면 그 칸 아래 오류, 기록 안 생김', f2.err && f2.n === r0, f2);
  await pg.evaluate(() => { const i = document.querySelector('#formOv input'); i.value = '물이 안 빠짐'; i.dispatchEvent(new Event('input', { bubbles: true })); formOk(); });
  await pg.waitForTimeout(500);
  const f3 = await pg.evaluate(() => ({ n: repair.length, last: repair[repair.length - 1], screen: mrOpenType, snack: (document.getElementById('snack') || {}).innerText || '' }));
  T(L + '추가하면 내용·장비 연결된 수리 기록 하나', f3.n === r0 + 1 && f3.last.title === '물이 안 빠짐' && f3.last.gearId === String(await pg.evaluate(() => window.__g)), f3);
  T(L + '장비 화면에 그대로 있고 「수리목록에 추가했습니다」 알림', f3.screen === 'gear' && /수리목록에 추가했습니다|Added to Repairs/.test(f3.snack), f3);
  await shot('2-gear-fault-added');

  // ── ② 머리 단추: 왼쪽 취소 · 오른쪽 저장
  const hb = await pg.evaluate(() => { const b = document.querySelector('#mrPanel .mrtop'); const bs = [...b.querySelectorAll('button')].filter(x => x.offsetParent);
    const r = x => x.getBoundingClientRect(); return { txt: bs.map(x => x.textContent.trim()), firstLeft: r(bs[0]).left, lastRight: r(bs[bs.length - 1]).right,
      hback: !!document.querySelector('#hNav .hback') && getComputedStyle(document.querySelector('#hNav .hback')).display !== 'none' }; });
  T(L + '기록 창 머리: 맨 왼쪽 「취소」 · 맨 오른쪽 「저장」', /^(취소|Cancel)$/.test(hb.txt[0]) && /^(저장|Save)$/.test(hb.txt[hb.txt.length - 1]) && hb.firstLeft < 60, hb);
  T(L + '「저장 후 닫기」·「되돌리고 닫기」·「목록」 이 없다', !hb.txt.some(x => /저장 후 닫기|되돌리고 닫기|^목록$|Save and close|^List$/.test(x)), hb.txt);
  T(L + '고치는 화면에서는 머리줄 「←」 를 숨긴다(취소와 같이 두지 않는다)', !hb.hback, hb);
  await shot('3-record-head');
  // 새 수리 기록: 이름 없이 저장 → 오류, 취소 → 안 남음
  const n0 = await pg.evaluate(() => repair.length);
  await pg.evaluate(() => { closeMR(); setBoatSubTab('maint'); setMntSub('repair'); mrAdd('repair'); });
  await pg.waitForTimeout(400);
  await pg.evaluate(() => mrSaveClose());
  await pg.waitForTimeout(300);
  const s1 = await pg.evaluate(() => ({ open: mrOpenType, err: (document.querySelector('#mrPanel .mrerr') || {}).textContent || '' }));
  T(L + '내용 없는 수리 기록은 저장 안 됨 — 칸 아래 「내용을 입력해 주세요」', s1.open === 'repair' && /내용을 입력해 주세요|Please enter/i.test(s1.err), s1);
  await shot('4-record-need-title');
  await pg.evaluate(() => mrCancel());
  await pg.waitForTimeout(300);
  T(L + '새로 만든 기록을 「취소」 하면 목록에 남지 않는다', await pg.evaluate(n0 => repair.length === n0 && !mrOpenType, n0));
  // 기존 기록 고치고 취소 → 묻고 되돌림
  await pg.evaluate(() => { openMR('repair', repair[0].id); });
  await pg.waitForTimeout(300);
  const before = await pg.evaluate(() => repair[0].title);
  await pg.evaluate(() => { const i = document.querySelector(`#mrPanel input[onchange*="mrField('title'"]`); i.value = '바뀐 내용'; i.dispatchEvent(new Event('change', { bubbles: true })); });
  await pg.waitForTimeout(300);
  window_al_len = await pg.evaluate(() => window.__al.length);
  await pg.evaluate(() => mrCancel());
  await pg.waitForTimeout(300);
  const c1 = await pg.evaluate(n => ({ asked: window.__al.slice(n).some(x => /저장하지 않고 나갈까요|Leave without saving/.test(x)), title: repair[0].title }), window_al_len);
  T(L + '고친 뒤 「취소」 → 「수정한 내용을 저장하지 않고 나갈까요?」 묻고 원래대로', c1.asked && c1.title === before, c1);
  // 저장하면 남는다
  await pg.evaluate(() => { openMR('repair', repair[0].id); const i = document.querySelector(`#mrPanel input[onchange*="mrField('title'"]`); i.value = '고친 내용'; i.dispatchEvent(new Event('change', { bubbles: true })); });
  await pg.waitForTimeout(200);
  await pg.evaluate(() => mrSaveClose());
  await pg.waitForTimeout(300);
  T(L + '「저장」 을 누르면 고친 내용이 남고 닫힌다', await pg.evaluate(() => repair[0].title === '고친 내용' && !mrOpenType));

  // ── ③ 내려도 남는 줄 — 계류장 탭 줄
  await pg.evaluate(() => openBoat('info'));
  await pg.waitForTimeout(500);
  await pg.evaluate(() => window.scrollTo(0, 2000));
  await pg.waitForTimeout(300);
  const st = await pg.evaluate(() => { const b = document.querySelector('#mrPanel .bsubs'); const r = b.getBoundingClientRect();
    const h = document.querySelector('header').getBoundingClientRect().bottom; return { top: Math.round(r.top), hdr: Math.round(h), sy: Math.round(scrollY), inHead: !!b.closest('.mrhead') }; });
  T(L + '계류장 탭 줄(기본정보·제원·배소개…)이 내려도 머리줄 밑에 남는다', st.inHead && st.sy > 200 && st.top >= st.hdr - 2 && st.top < st.hdr + 120, st);
  T(L + '들어온 화면에는 머리줄 왼쪽 「←」', await pg.evaluate(() => { const b = document.querySelector('#hNav .hback'); return !!b && getComputedStyle(b).display !== 'none'; }));
  await shot('5-boat-scrolled');
  await pg.evaluate(() => window.scrollTo(0, 0));

  // ── ④ 연락처 직접 입력
  await pg.evaluate(() => { openCiEdit(); ciSet(0, 'v', '010-1234-5678', true); ciSet(0, 'lab', 'custom'); });
  await pg.waitForTimeout(300);
  const ce = await pg.evaluate(() => { const row = document.querySelector('#mrPanel .ciedit'); const cl = row.querySelector('.cicl'); const val = row.querySelector('.ciinput:not(.cicl)');
    const sels = row.querySelectorAll('select.cisel');
    return { has: !!cl, focus: document.activeElement === cl, clTop: cl && Math.round(cl.getBoundingClientRect().top), valTop: Math.round(val.getBoundingClientRect().top), sels: sels.length,
             extraBelow: [...row.querySelectorAll('input')].filter(x => x !== cl && x !== val).length }; });
  T(L + '「직접 입력」 은 용도 칸 그 자리(연락처 위)에 — 아래에 칸이 따로 안 생긴다', ce.has && ce.clTop < ce.valTop && ce.sels === 1 && ce.extraBelow === 0, ce);
  T(L + '고르자마자 그 칸에 커서', ce.focus, ce);
  await pg.evaluate(() => { const i = document.querySelector('#mrPanel .cicl'); i.value = '예약 문의'; i.dispatchEvent(new Event('input', { bubbles: true })); });
  await shot('6-contact-custom');
  await pg.evaluate(() => ciSave());
  await pg.waitForTimeout(400);
  const cv = await pg.evaluate(() => { const r = document.querySelector('#mrPanel .cirow'); if(!r) return null;
    const h = r.querySelector('.cihead'), v = r.querySelector('.cival'); return { head: h.innerText, headTop: h.getBoundingClientRect().top, valTop: v.getBoundingClientRect().top }; });
  T(L + '보기: 「전화 · 예약 문의」 가 번호 바로 위', cv && /예약 문의/.test(cv.head) && cv.headTop < cv.valTop, cv);
  await shot('7-contact-view');

  // ── ⑤ 날씨 일출·일몰
  await pg.evaluate(() => { wxSpots = [{ id:'t1', name:'여수', lat:34.74, lon:127.74 }]; wxCur = wxSpots[0]; wxData = null; setHomeSub('weather'); });
  await pg.waitForTimeout(2500);
  const wx = await pg.evaluate(() => ({ head: [...document.querySelectorAll('.wdate')].map(e => e.innerText).slice(0, 2), sel: (document.querySelector('.wsunsel') || {}).innerText || '',
    night: [...document.querySelectorAll('.wch')].slice(0, 24).map(e => e.classList.contains('wnight') ? 1 : 0).join('') }));
  T(L + '날짜 머리에 「일출 06:24 · 일몰 18:05」', wx.head.length && /(일출|Sunrise) 06:24 · (일몰|Sunset) 18:05/.test(wx.head[0]), wx);
  T(L + '고른 시각 줄에도 일출·일몰', /06:24/.test(wx.sel) && /18:05/.test(wx.sel), wx);
  T(L + '밤 칸이 실제 일출·일몰로 칠해진다 (0~5시·18~23시)', wx.night === '111111000000000000111111', wx.night);
  await shot('8-weather-sun');

  T(L + '오류 없음', errs.length === 0, errs);
  await ctx.close();
}
let window_al_len = 0;
(async () => {
  await new Promise(r => server.listen(0, r));
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  try{ await run(br, 'ko'); await run(br, 'en'); }
  catch(e){ bad++; console.log('★ 실패: 검사가 멈춤 — ' + e.message.slice(0, 300)); }
  await br.close(); server.close();
  console.log('\n' + ok + ' 통과 · ' + bad + ' 실패');
  process.exit(bad ? 1 : 0);
})();
