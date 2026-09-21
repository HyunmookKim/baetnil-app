// 진짜로 눌러 본다 — 정기점검 「완료 처리」 를 눌렀을 때 정비수첩이 안 생기는가 (4.112)
//
// ★ 글자만 봐서는 못 잡는다. 사장님이 겪으신 것은 「눌렀더니 쌓였다」 였다.
//   그러니 눌러 보고 개수를 세야 한다.
const { chromium } = require('playwright');
const fs = require('fs'), http = require('http'), path = require('path');
const SRC = process.argv[2] || '../../work.html';
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0];
  // 뿌리(/) 요청이고 인자가 절대경로면 그대로 연다. 딸린 파일은 검사 폴더에서 찾는다.
  const p = (f === '/' && path.isAbsolute(SRC)) ? SRC
          : path.join(__dirname, (f === '/' ? SRC : f).replace(/^\//, ''));
  if(!fs.existsSync(p)){ r.writeHead(404); r.end(''); return; }
  r.writeHead(200, { 'content-type': path.extname(p) === '.js' ? 'text/javascript' : 'text/html; charset=utf-8' });
  r.end(fs.readFileSync(p));
});
let ok = 0, bad = 0;
const T = (n, c, w) => { if(c){ ok++; console.log('통과: ' + n); }
  else { bad++; console.log('★ 실패: ' + n + (w !== undefined ? ' — ' + String(JSON.stringify(w)).slice(0, 300) : '')); } };
const 끝 = async (br) => { console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
  try{ await br.close(); }catch(_){} srv.close(); process.exit(bad ? 1 : 0); };

(async () => {
  await new Promise(r => srv.listen(0, r));
  const br = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const pg = await (await br.newContext({ viewport:{ width:430, height:930 }, isMobile:true, hasTouch:true,
                                          locale:'ko-KR' })).newPage();
  const errs = []; pg.on('pageerror', e => errs.push(String(e).slice(0, 160)));
  pg.on('dialog', d => d.accept());
  await pg.route('**tile.openstreetmap.org/**', r => r.abort());
  await pg.addInitScript(() => { try{ localStorage.setItem('bt_agree','1'); }catch(e){} });
  await pg.goto('http://127.0.0.1:' + srv.address().port + '/');
  await pg.waitForTimeout(1800);
  // ★ ask 는 「예」 를 누른 것으로 둔다 — 제일 나쁜 쪽이다.
  //   4.111 에서는 「아니오」 를 눌러도 만들어졌으니, 「예」 여도 안 만들어져야 확실하다.
  await pg.evaluate(() => { window.ask = () => Promise.resolve(true); window.tell = () => Promise.resolve(true);
    window.alert = () => {}; window.confirm = () => true;
    try{ skipWelcome(); }catch(_){} unlocked = true;
    const o = document.getElementById('welcomeOv'); if(o) o.classList.remove('open'); });
  await pg.waitForTimeout(400);
  await pg.evaluate(() => { try{ openBoatSetup(); }catch(_){} });
  await pg.waitForTimeout(400);
  await pg.evaluate(() => { const n = document.getElementById('nbName'); if(n){ n.value = '시험호'; createBoat(); } });
  await pg.waitForTimeout(1400);

  const 처음 = await pg.evaluate(() => ({ 정기점검: maintRows().length, 정비수첩: mlogRows().length }));
  T('①-1 배를 만들면 정기점검 초안이 깔린다', 처음.정기점검 > 5, 처음);
  T('①-2 ★★ 그때 정비수첩은 하나도 안 생긴다', 처음.정비수첩 === 0, 처음);

  // ── 정기점검 다섯 개를 실제로 「완료 처리」 한다
  const 다섯 = await pg.evaluate(async () => {
    const rows = maintRows().slice(0, 5);
    for(const m of rows){
      mrOpenType = 'maint'; mrOpenId = String(m.id);
      await mrComplete();
    }
    return { 완료한것: rows.length,
             한날: rows.map(m => (maintRows().find(x => String(x.id) === String(m.id)) || {}).lastDate),
             정비수첩: mlogRows().length };
  });
  T('②-1 다섯 개를 완료 처리했다', 다섯.완료한것 === 5, 다섯);
  T('②-2 ★ 마지막 한 날이 오늘로 찍혔다',
    다섯.한날.every(d => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ''))), 다섯.한날);
  T('②-3 ★★★ 정비수첩이 하나도 안 생겼다 (사장님이 겪으신 그 자리)',
    다섯.정비수첩 === 0, 다섯);

  // ── 수리를 만들고 「완료」 로 바꾼다
  const 수리 = await pg.evaluate(async () => {
    mrAdd('repair');
    const r = repair[repair.length - 1];
    mrOpenType = 'repair'; mrOpenId = String(r.id);
    await mrStatus('done');
    return { 상태: repair[repair.length - 1].status,
             고친날: repair[repair.length - 1].doneDate,
             정비수첩: mlogRows().length };
  });
  T('③-1 ★ 수리가 완료로 바뀌었다', 수리.상태 === 'done', 수리);
  T('③-2 ★ 고친 날이 찍혔다', /^\d{4}-\d{2}-\d{2}$/.test(수리.고친날 || ''), 수리);
  T('③-3 ★★★ 수리를 완료해도 정비수첩이 안 생긴다', 수리.정비수첩 === 0, 수리);

  // ── 사람이 「+ 정비수첩」 을 누르면 그때는 생겨야 한다 (기능을 죽인 게 아니다)
  const 눌렀을때 = await pg.evaluate(() => {
    const m = maintRows()[0];
    addMlogForItem(String(m.id));
    const rows = mlogRows();
    const 새것 = rows[rows.length - 1] || {};
    return { 개수: rows.length, 붙은항목: String(새것.maintId || ''), 제목: 새것.title || '',
             기대항목: String(m.id) };
  });
  T('④-1 ★★★ 「+ 정비수첩」 을 누르면 그때는 생긴다', 눌렀을때.개수 === 1, 눌렀을때);
  T('④-2 ★★ 그 정기점검에 붙은 채로 생긴다', 눌렀을때.붙은항목 === 눌렀을때.기대항목, 눌렀을때);
  T('④-3 ★ 항목 이름이 미리 채워진다', !!눌렀을때.제목, 눌렀을때);

  // ── 수리 쪽 「+ 정비수첩」 도 살아 있는가
  const 수리에서 = await pg.evaluate(() => {
    const r = repair[repair.length - 1];
    addMlogForRepair(String(r.id));
    const rows = mlogRows();
    const 새것 = rows[rows.length - 1] || {};
    return { 개수: rows.length, 붙은수리: String(새것.repairId || ''), 기대: String(r.id) };
  });
  T('④-4 ★★ 수리에서도 「+ 정비수첩」 이 된다',
    수리에서.개수 === 2 && 수리에서.붙은수리 === 수리에서.기대, 수리에서);

  T('⑤ 화면에서 터진 데가 없다', errs.length === 0, errs.slice(0, 4));
  return 끝(br);
})().catch(async e => { console.log('★ 실패: 검사가 터졌습니다 — ' + e);
  console.log('\n합계: ' + ok + '개 통과 / ' + (bad + 1) + '개 실패');
  srv.close(); process.exit(1); });
