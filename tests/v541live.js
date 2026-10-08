// 5.41 — 달력 「+ 일정」 을 **진짜 브라우저에서** 눌러 본다
// 사장님 (2026-10-06): 「정비 수첩이나 뭐 이런 거밖에 달력에 추가를 못 하네. 내가 조만간에 청소하려고 그랬는데 …
//   내가 멋대로 추가하고 싶은 거는 아예 추가를 못 하게 되어 있네」 → 「그냥 일정이라고 해라. 일정.」 → 「완료표시는 없이해라」
// 구글 캘린더 「일정」 과 같은 칸: 제목 · 날짜 · 시각 · 반복 · (메모). 완료 표시는 없다.
//
// 보는 것: ① 날짜를 누르면 「+ 일정」 이 있다 ② 누르면 일정 창이 그 날짜로 열린다 ③ 제목 없이 저장하면 칸 아래에 알린다
//   ④ 제목을 넣고 저장하면 그 날 칸에 보인다 ⑤ 「매주」 로 바꾸면 다음 주에도 보인다 ⑥ 「취소」 하면 남지 않는다
//   ⑦ 지우면 휴지통 「달력」 갈래로 가고, 되돌리면 돌아온다 ⑧ 백업에 들어간다 ⑨ 완료 표시 단추가 없다
//   ⑩ 세 화면(노을·검정·흰=light) · 네 언어에서 단추·창이 뜨고 오류가 없다
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const FILE = path.resolve(process.argv[2] || path.join(__dirname, '..', 'www', 'index.html'));
const ROOT = path.dirname(FILE);
const server = http.createServer((rq, rs) => {
  const u = rq.url.split('?')[0];
  const f = u === '/' ? FILE : path.join(ROOT, u);
  fs.readFile(f, (e, d) => { if(e){ rs.writeHead(404); rs.end(); return; } rs.writeHead(200); rs.end(d); });
});
let ok = 0, bad = 0;
const T = (n, c, w) => { if(c){ ok++; console.log('통과: ' + n); }
  else { bad++; console.log('★ 실패: ' + n + (w !== undefined ? ' — ' + JSON.stringify(w).slice(0, 300) : '')); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SHOT = process.env.SHOT || '';

(async () => {
  await new Promise(r => server.listen(0, r));
  const url = 'http://127.0.0.1:' + server.address().port + '/';
  const br = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

  async function open(theme, lang){
    const ctx = await br.newContext({ locale: lang === 'ko' ? 'ko-KR' : lang, viewport:{ width:390, height:844 }, isMobile:true, hasTouch:true });
    await ctx.route(/googleapis|gstatic|firebaseio|firestore|open-meteo|openstreetmap|openseamap/, r => r.abort());
    await ctx.addInitScript(({ theme, lang }) => {
      try{ localStorage.setItem('bt_setup', 'done'); localStorage.setItem('bt_welcome', 'done');
           if(theme) localStorage.setItem('bt_theme', theme);
           if(lang && lang !== 'ko') localStorage.setItem('bt_lang', lang); }catch(_){}
    }, { theme, lang });
    const pg = await ctx.newPage();
    const errs = []; pg.on('pageerror', e => errs.push(String(e).slice(0, 200)));
    await pg.goto(url, { waitUntil:'domcontentloaded' });
    await sleep(1600);
    await pg.evaluate(() => { window.alert = () => {}; window.confirm = () => true;
      window.ask = () => Promise.resolve(true);
      try{ skipWelcome(); }catch(_){} unlocked = true; try{ openBoatSetup(); }catch(_){} });
    await sleep(400);
    await pg.evaluate(() => { const n = document.getElementById('nbName'); if(n){ n.value = '시험호'; createBoat(); } });
    await sleep(1000);
    await pg.evaluate(() => { unlocked = true; try{ document.body.classList.remove('locked'); }catch(_){}
      switchTab('home'); setHomeSub('cal'); });
    await sleep(700);
    return { ctx, pg, errs };
  }
  const p2 = n => String(n).padStart(2, '0');
  const now = new Date();
  const ym = now.getFullYear() + '-' + p2(now.getMonth() + 1);
  const D10 = ym + '-10', D17 = ym + '-17';

  // ══ 노을 · 한국어 — 처음부터 끝까지 ══
  let { ctx, pg, errs } = await open(null, 'ko');
  await pg.evaluate(d => calPick(d), D10);
  await sleep(400);
  const 단추 = await pg.evaluate(() => [...document.querySelectorAll('#calWrap button')].map(b => b.textContent.trim()));
  T('① 날짜를 누르면 「+ 일정」 단추가 있다 (「+ 예정 · + 정비수첩 · + 고장」 옆)',
    단추.indexOf('+ 일정') >= 0 && 단추.indexOf('+ 고장') >= 0 && 단추.indexOf('+ 일정') === 단추.indexOf('+ 고장') + 1, 단추);
  // 진짜로 누른다
  await pg.locator('#calWrap button', { hasText:'+ 일정' }).click();
  await sleep(500);
  const 창 = await pg.evaluate(() => {
    const P = document.getElementById('mrPanel');
    return { shown: P && getComputedStyle(P).display !== 'none', title: (P.querySelector('.mrtop b') || {}).textContent,
             date: (P.querySelector('input[type=date]') || {}).value, lbls: [...P.querySelectorAll('.mrlbl')].map(x => x.textContent.trim()),
             reps: [...P.querySelectorAll('select option')].map(o => o.textContent.trim()),
             btns: [...P.querySelectorAll('button')].map(b => b.textContent.trim()), n: scheds.length, type: mrOpenType };
  });
  T('② 일정 창이 그 날짜로 열린다', 창.shown && 창.title === '일정' && 창.date === D10 && 창.type === 'sched', 창);
  T('② 칸은 구글 캘린더 일정과 같다 — 제목·날짜·시각·반복·메모',
    ['제목', '날짜', '시각', '반복', '메모'].every(x => 창.lbls.indexOf(x) >= 0), 창.lbls);
  T('② 반복은 반복 안 함·매일·매주·매월·매년', 창.reps.join() === '반복 안 함,매일,매주,매월,매년', 창.reps);
  T('⑨ 완료 표시 단추가 없다 (사장님 「완료표시는 없이해라」)', !창.btns.some(b => /완료/.test(b)), 창.btns);
  T('왼쪽 「취소」 · 오른쪽 「저장」 (5.36 기록 창과 같다)', 창.btns[0] === '취소' && 창.btns.indexOf('저장') > 0, 창.btns);
  if(SHOT) await pg.screenshot({ path: SHOT + '-sunset-form.png' });

  // ③ 제목 없이 저장
  await pg.locator('#mrPanel .mrtop button', { hasText:'저장' }).click();
  await sleep(400);
  const 알림 = await pg.evaluate(() => ({ err: (document.querySelector('#mrPanel .mrerr') || {}).textContent || '',
    open: getComputedStyle(document.getElementById('mrPanel')).display !== 'none' }));
  T('③ 제목 없이 저장하면 칸 아래에 「제목을 입력해 주세요」 · 창은 그대로', 알림.err === '제목을 입력해 주세요' && 알림.open, 알림);

  // ④ 제목·시각을 넣고 저장 (진짜로 타자)
  await pg.locator('#mrPanel input[onchange*="mrField(\'title\'"]').fill('선저 청소');
  await pg.locator('#mrPanel input[onchange*="mrField(\'title\'"]').press('Tab');
  await sleep(300);
  const 시각칸 = pg.locator('#mrPanel .mrrow', { hasText:'시각' }).locator('input').first();
  await 시각칸.fill('0900'); await 시각칸.press('Tab');
  await sleep(300);
  await pg.locator('#mrPanel .mrtop button', { hasText:'저장' }).click();
  await sleep(600);
  const 저장 = await pg.evaluate(d => ({ s: JSON.parse(JSON.stringify(scheds)),
    cell: [...document.querySelectorAll('#calWrap .ccell')].map(c => c.textContent).join('|'),
    rows: calItems(d, d).filter(r => r.kind === 'sched').map(r => r.title + '@' + r.time),
    closed: getComputedStyle(document.getElementById('mrPanel')).display === 'none' || !document.getElementById('mrPanel').classList.contains('show') }), D10);
  T('④ 저장된다 — 제목·날짜·시각', 저장.s.length === 1 && 저장.s[0].title === '선저 청소' && 저장.s[0].date === D10 && 저장.s[0].time === '09:00', 저장.s);
  T('④ 그 날 달력에 「선저 청소」 가 보인다', /선저 청소/.test(저장.cell) && 저장.rows.join() === '선저 청소@09:00', 저장);
  T('④ 일정은 완료 칸을 갖지 않는다', 저장.s.length && !('done' in 저장.s[0]) && !('status' in 저장.s[0]), 저장.s);

  // ⑤ 매주로 바꾼다 — 그 줄을 눌러 창을 다시 열고 반복을 고른다
  await pg.evaluate(d => calPick(d), D10);
  await sleep(300);
  await pg.evaluate(() => calGo('sched', scheds[0].id));
  await sleep(400);
  await pg.locator('#mrPanel select').selectOption('w');
  await sleep(300);
  await pg.locator('#mrPanel .mrtop button', { hasText:'저장' }).click();
  await sleep(500);
  const 매주 = await pg.evaluate(d => calItems(d, d).filter(r => r.kind === 'sched').map(r => r.title), D17);
  T('⑤ 「매주」 로 바꾸면 다음 주 같은 요일에도 나온다', 매주.join() === '선저 청소', { 매주, rep: await pg.evaluate(() => scheds[0].rep) });

  // ⑥ 새로 만들고 「취소」 하면 남지 않는다
  await pg.evaluate(d => calPick(d), D17);
  await sleep(300);
  await pg.locator('#calWrap button', { hasText:'+ 일정' }).click();
  await sleep(400);
  await pg.locator('#mrPanel .mrtop button', { hasText:'취소' }).click();
  await sleep(500);
  T('⑥ 새 일정을 만들다 「취소」 하면 남지 않는다', await pg.evaluate(() => scheds.length) === 1, await pg.evaluate(() => scheds.length));

  // ⑧ 백업에 들어간다
  const 백업 = await pg.evaluate(() => {
    let got = null;
    const sv = window.saveFile; window.saveFile = (n, ty, txt) => { got = txt; return Promise.resolve(null); };
    return Promise.resolve(backupData()).then(() => { window.saveFile = sv;
      try{ return (JSON.parse(got || '{}').scheds || []).length; }catch(_){ return -1; } });
  });
  T('⑧ 백업 파일에 일정이 들어간다', 백업 === 1, 백업);

  // ⑦ 지우면 휴지통 「달력」 갈래 → 되돌리면 돌아온다
  await pg.evaluate(() => calGo('sched', scheds[0].id));
  await sleep(300);
  await pg.evaluate(() => mrDelete());
  await sleep(500);
  const 휴 = await pg.evaluate(() => ({ n: scheds.length, rows: trashRows().map(r => r.g + ':' + r.tag + ':' + r.name) }));
  T('⑦ 지우면 휴지통 「달력」 갈래에 「일정」 으로 들어간다', 휴.n === 0 && 휴.rows.some(x => x === 'cal:일정:선저 청소'), 휴);
  await pg.evaluate(() => { const e = mrTrash.find(x => x.kind === 'sched'); if(e) mrRestore(e.id); });
  await sleep(400);
  T('⑦ 되돌리면 돌아온다', await pg.evaluate(() => scheds.length === 1 && scheds[0].rep === 'w'), await pg.evaluate(() => scheds));

  // 기기에 남는다 (다시 켜도)
  await pg.reload({ waitUntil:'domcontentloaded' });
  await sleep(1800);
  T('다시 켜도 일정이 남아 있다 (기기 저장)', await pg.evaluate(() => Array.isArray(scheds) && scheds.length === 1 && scheds[0].title === '선저 청소'),
    await pg.evaluate(() => typeof scheds !== 'undefined' ? scheds : null));
  T('오류가 없다 (노을·한국어)', errs.length === 0, errs);
  await ctx.close();

  // ══ 세 화면 × 네 언어 — 단추와 창이 뜨고 글자가 번역되며 오류가 없다 ══
  const 말 = { ko:['+ 일정', '일정', '반복'], en:['+ Event', 'Event', 'Repeat'], ru:['+ Событие', 'Событие', 'Повтор'], ja:['+ イベント', 'イベント', '繰り返し'] };
  for(const theme of ['sunset', 'black', 'light']){
    for(const lang of (theme === 'sunset' ? ['en', 'ru', 'ja'] : ['ko', 'en'])){
      const o = await open(theme, lang);
      await o.pg.evaluate(d => calPick(d), D10);
      await sleep(300);
      const r = await o.pg.evaluate(w => {
        const b = [...document.querySelectorAll('#calWrap button')].find(x => x.textContent.trim() === w[0]);
        if(!b) return { btn:false, all:[...document.querySelectorAll('#calWrap button')].map(x => x.textContent.trim()) };
        b.click();
        const P = document.getElementById('mrPanel');
        return { btn:true, title:(P.querySelector('.mrtop b') || {}).textContent, lbls:[...P.querySelectorAll('.mrlbl')].map(x => x.textContent.trim()),
                 bg: getComputedStyle(P).backgroundColor, theme: window.btLook ? window.btLook.theme() : '' };
      }, 말[lang]);
      await sleep(300);
      if(SHOT) await o.pg.screenshot({ path: SHOT + '-' + theme + '-' + lang + '.png' });
      T('⑩ ' + theme + '·' + lang + ' — 「' + 말[lang][0] + '」 단추가 있고 「' + 말[lang][1] + '」 창이 열린다',
        r.btn && r.title === 말[lang][1] && r.lbls.indexOf(말[lang][2]) >= 0, r);
      T('⑩ ' + theme + '·' + lang + ' — 오류 없음', o.errs.length === 0, o.errs);
      await o.ctx.close();
    }
  }

  console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
  await br.close(); server.close(); process.exit(bad ? 1 : 0);
})().catch(e => { console.log('★ 실패: 검사가 멈췄습니다 — ' + e); process.exit(1); });
