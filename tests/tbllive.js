// 진짜 브라우저에서 표를 만들어 보고 · 붙여넣어 보고 · 저장해 본다 (4.113)
//
// ★ 글자만 봐서는 못 잡는다. 사장님이 겪으신 것은 「붙여넣었더니 숫자만 줄줄이 늘어섰다」 였다.
//   그러니 진짜로 붙여넣어 보고, 표가 표로 남는지 세어 봐야 한다.
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

// ★ 사장님이 실제로 붙여넣으신 것과 같은 모양 — 러시아 요트 기사의 견줌표.
//   여태는 이것이 「46/50 · 22/50 · 23/50 · 10/10 …」 로 풀려 버렸다.
const 기사 = `<p>Сравнение моделей</p>
<table>
 <thead><tr><th>Критерий</th><th>ChatGPT</th><th>DeepSeek</th><th>GigaChat</th></tr></thead>
 <tbody>
  <tr><td>Проверка 5 вариантов</td><td>46/50</td><td>22/50</td><td>23/50</td></tr>
  <tr><td>Выполнение задания</td><td>10/10</td><td>8/10</td><td>8/10</td></tr>
  <tr><td>Источники</td><td>9/10</td><td>4/10</td><td>3/10</td></tr>
  <tr><td><b>Предварительный результат</b></td><td>94/100</td><td>45/100</td><td>46/100</td></tr>
 </tbody>
</table>
<p>Как идёт поиск лодки.</p>`;

(async () => {
  await new Promise(r => server.listen(0, r));
  const br = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await br.newContext({ viewport:{ width:390, height:820 }, isMobile:true, hasTouch:true, locale:'ko-KR' });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  pg.on('dialog', d => d.dismiss().catch(() => {}));
  await pg.goto('http://127.0.0.1:' + server.address().port + '/', { waitUntil:'networkidle' });
  await pg.waitForTimeout(900);
  await pg.evaluate(() => { try{ skipWelcome(); }catch(_){} window.__user = { uid:'U1', name:'나' };
    window.ask = () => Promise.resolve(true); window.tell = () => Promise.resolve(true); });

  // ★ 편집기가 아예 못 열리는 것도 「실패」 로 적어 둔다 — 터져 버리면 무엇이 깨졌는지 안 남는다
  const openEd = (blocks) => pg.evaluate(b => {
    window.__saved = null;
    openForm({ title:'검사', okText:'저장',
      fields:[{ key:'body', type:'rich', label:'내용', value:b, placeholder:'여기에 쓰세요' }],
      onOk: v => { window.__saved = v.body; } });
  }, blocks).catch(e => { errs.push('편집기를 못 열었다: ' + String(e).slice(0, 140)); });
  // ★★★ 5.0 — 예전에는 여기서 표 밖을 한 번 눌러 피해 갔다. 칸에 커서를 둔 채로
  //   곧바로 [저장] 을 누르면 단추줄이 접히면서 화면이 위로 뛰어 단추를 빗나갔기 때문이다.
  //   그 흠을 앱에서 고쳤으므로(접는 때를 mousedown → click 으로 옮김) **피해 가지 않는다.**
  //   피해 가면 그 흠이 되살아나도 여기서는 안 걸린다.
  const save = async () => { await pg.click('#formFoot .fbtn.go'); await pg.waitForTimeout(250);
                             return await pg.evaluate(() => window.__saved); };
  // 지금 문서에 표 고치는 '따로 창' 이 떠 있는가 — 4.118 뒤로는 언제나 '없다' 여야 한다
  const 창없나 = () => pg.evaluate(() => ({
    표창: !!document.getElementById('tblOv'),
    뜬덮개: [].filter.call(document.querySelectorAll('[id$="Ov"],[id$="Pick"],.ov'),
      e => { try{ const st = getComputedStyle(e); return st.display !== 'none' && st.visibility !== 'hidden'; }
             catch(_){ return false; } }).map(e => e.id || e.className) }));

  const 표 = { t:'table', head:1, rows:[['이름','값'],['출처','9/10'],['쓸모','10/10']] };
  try{

  // ── ① 저장돼 있던 표가 편집기에 표로 열리는가
  await openEd([{ t:'text', h:1, v:'앞 글' }, 표, { t:'text', h:1, v:'뒤 글' }]);
  await pg.waitForTimeout(500);
  const 열린것 = await pg.evaluate(() => {
    const e = document.querySelector('#ff0 .ql-editor');
    const tb = e.querySelector('.qltbl table');
    return { 편집기: !!e, 표: !!tb,
             th: tb ? tb.querySelectorAll('th').length : 0,
             td: tb ? tb.querySelectorAll('td').length : 0,
             첫칸: tb ? (tb.querySelector('th') || {}).textContent : '' };
  });
  T('①-1 편집기가 세워졌다', 열린것.편집기, 열린것);
  T('①-2 ★★★ 저장돼 있던 표가 진짜 <table> 로 열린다', 열린것.표, 열린것);
  T('①-3 ★★ 제목줄 두 칸이 <th> 다', 열린것.th === 2, 열린것);
  T('①-4 ★★ 나머지 네 칸이 <td> 다', 열린것.td === 4, 열린것);
  T('①-5 ★ 칸에 적힌 글자가 그대로다', 열린것.첫칸 === '이름', 열린것);

  // ── ② 그대로 저장하면 표가 그대로 나오는가 (제일 중요한 것 — 남의 글을 망가뜨리면 안 된다)
  const 돌아온것 = await save();
  T('②-1 ★★★ 덩이 셋이 그대로다', (돌아온것 || []).length === 3, (돌아온것 || []).map(b => b.t));
  T('②-2 ★★★ 가운데가 표다', 돌아온것 && 돌아온것[1] && 돌아온것[1].t === 'table', 돌아온것);
  T('②-3 ★★★ 줄과 칸이 하나도 안 바뀌었다',
    !!돌아온것 && JSON.stringify((돌아온것[1] || {}).rows) === JSON.stringify(표.rows), (돌아온것 || [])[1]);
  T('②-4 ★★ 제목줄 표시도 남았다', !!돌아온것 && (돌아온것[1] || {}).head === 1, (돌아온것 || [])[1]);
  T('②-5 ★ 앞뒤 글도 자리를 지켰다',
    !!돌아온것 && 돌아온것[0].t === 'text' && 돌아온것[2].t === 'text', (돌아온것 || []).map(b => b.t));

  // ── ③ 남의 기사를 붙여넣으면 표가 살아남는가 ★★★ 사장님이 겪으신 바로 그 자리
  await openEd([]);
  await pg.waitForTimeout(400);
  const 붙인뒤 = await pg.evaluate(html => {
    const q = QL['ff0'];
    q.setSelection(0, 0);
    const dt = new DataTransfer();
    dt.setData('text/html', html);
    dt.setData('text/plain', 'Сравнение моделей');
    q.root.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    return null;
  }, 기사);
  await pg.waitForTimeout(600);
  const 붙은것 = await pg.evaluate(() => {
    const e = document.querySelector('#ff0 .ql-editor');
    const tb = e.querySelector('.qltbl table');
    return { 표: !!tb, 줄: tb ? tb.querySelectorAll('tr').length : 0,
             칸: tb ? (tb.querySelector('tr') ? tb.querySelector('tr').children.length : 0) : 0,
             제목: tb ? [].map.call(tb.querySelectorAll('th'), z => z.textContent).join('|') : '',
             글: e.textContent.slice(0, 40) };
  });
  T('③-1 ★★★ 붙여넣은 표가 표로 남는다 (여태는 숫자만 줄줄이 늘어섰다)', 붙은것.표, 붙은것);
  T('③-2 ★★★ 다섯 줄이 다 왔다 (제목줄 + 네 줄)', 붙은것.줄 === 5, 붙은것);
  T('③-3 ★★★ 네 칸이 다 왔다', 붙은것.칸 === 4, 붙은것);
  T('③-4 ★★ 제목줄을 제목줄로 알아봤다',
    붙은것.제목 === 'Критерий|ChatGPT|DeepSeek|GigaChat', 붙은것);
  const 붙여저장 = await save();
  const 표덩이 = (붙여저장 || []).filter(b => b.t === 'table');
  T('③-5 ★★★ 저장해도 표 한 개가 남는다', 표덩이.length === 1, (붙여저장 || []).map(b => b.t));
  T('③-6 ★★ 표 앞뒤의 글도 살아 있다',
    (붙여저장 || []).some(b => b.t === 'text' && /Сравнение/.test(b.v))
    && (붙여저장 || []).some(b => b.t === 'text' && /лодки/.test(b.v)), (붙여저장 || []).map(b => b.t));
  T('③-7 ★★ 굵은 글씨가 칸 안에 살아 있다',
    표덩이.length === 1 && JSON.stringify(표덩이[0].rows).indexOf('<b>') >= 0, 표덩이[0] && 표덩이[0].rows[4]);

  // ── ④ 도구줄의 [표] 단추 — ★★★ 4.118 부터 **창이 뜨지 않는다**
  //   사장님 지적, 2026-09-09 — 「그냥 표 누르면 이상한 창 따로 뜨게 하지말고
  //   바로 글쓰는데에 표 그려지게 못하냐? 워드페드도 표그릴때 따로 창이나오냐?」
  //   그래서 여기서 볼 것이 뒤집혔다. 「창이 뜬다」 가 아니라 **「창이 없다 · 제자리에서 고쳐진다」** 다.
  await openEd([{ t:'text', h:1, v:'글 한 줄' }]);
  await pg.waitForTimeout(400);
  const 단추 = await pg.evaluate(() => !!document.querySelector('.rtool .rtb[onclick*="richTable"]'));
  T('④-1 ★★★ 도구줄에 표 단추가 보인다', 단추);
  await pg.evaluate(() => { QL['ff0'].setSelection(QL['ff0'].getLength() - 1, 0); richTable('ff0'); });
  await pg.waitForTimeout(400);
  const 창 = await 창없나();
  T('④-2 ★★★ 표를 넣어도 따로 창이 뜨지 않는다 (표 창 자체가 없다)', 창.표창 === false, 창);
  T('④-3 ★★★ 새로 뜬 덮개도 없다 — 글 쓰던 창 하나뿐이다',
    창.뜬덮개.length === 1 && 창.뜬덮개[0] === 'formOv', 창);
  const 놓인표 = await pg.evaluate(() => {
    const el = document.querySelector('#ff0 .ql-editor .qltbl');
    const tb = el ? el.querySelector('table') : null;
    return { 표: !!tb, 줄: tb ? tb.rows.length : 0,
             칸: tb && tb.rows[0] ? tb.rows[0].cells.length : 0,
             th: tb ? tb.querySelectorAll('th').length : 0,
             칸마다고침: tb ? [].every.call(tb.querySelectorAll('td,th'),
                            c => c.getAttribute('contenteditable') === 'true') : false,
             덩이: el ? el.getAttribute('contenteditable') : null,
             바: el ? el.querySelectorAll('.qltblbar .rtb').length : 0,
             바글: el ? [].map.call(el.querySelectorAll('.qltblbar .rtb'), z => z.textContent) : [],
             앞글: (document.querySelector('#ff0 .ql-editor').textContent || '').indexOf('글 한 줄') >= 0 };
  });
  T('④-4 ★★★ 글 쓰던 자리에 표가 바로 놓인다', 놓인표.표, 놓인표);
  T('④-5 ★ 빈 표 3줄 × 2칸으로 시작한다', 놓인표.줄 === 3 && 놓인표.칸 === 2, 놓인표);
  T('④-6 ★★ 첫 줄이 제목줄(th 두 칸)이다', 놓인표.th === 2, 놓인표);
  T('④-7 ★★★ 칸마다 그 자리에서 글을 쓸 수 있다 (칸이 다 contenteditable)', 놓인표.칸마다고침, 놓인표);
  T('④-8 ★★ 표 덩이 자체는 못 고치게 둔다 — 그래야 글자 한 개로 남아 통째로 지워진다',
    놓인표.덩이 === 'false', 놓인표);
  T('④-9 ★★★ 줄·칸 단추 여섯이 표 바로 밑에 붙어 나온다 (창이 아니라)', 놓인표.바 === 6, 놓인표);
  T('④-10 ★★ 단추 여섯이 「+ 줄 · + 칸 · 줄 삭제 · 칸 삭제 · 제목줄 · 표 삭제」 다',
    놓인표.바글.join('|') === '+ 줄|+ 칸|줄 삭제|칸 삭제|제목줄|표 삭제', 놓인표.바글);
  T('④-11 ★ 표를 넣어도 먼저 쓰던 글이 그대로다', 놓인표.앞글, 놓인표);

  // ★ 진짜로 칸을 누르고 타자를 친다 — 「그 자리에서 고친다」 는 이렇게만 확인된다
  await pg.click('#ff0 .qltbl th');
  await pg.waitForTimeout(200);
  await pg.keyboard.type('항목');
  await pg.waitForTimeout(300);
  const 친뒤 = await pg.evaluate(() => {
    const el = document.querySelector('#ff0 .qltbl');
    return { 커서칸: (document.activeElement || {}).tagName,
             화면: (el.querySelector('th') || {}).textContent,
             적힘: el.getAttribute('data-tbl'),
             창: !!document.getElementById('tblOv') };
  });
  T('④-12 ★★★ 칸을 누르면 그 칸에 곧바로 커서가 간다', 친뒤.커서칸 === 'TH', 친뒤);
  T('④-13 ★★★ 친 글자가 표 칸에 바로 들어간다', 친뒤.화면 === '항목', 친뒤);
  T('④-14 ★★★ 저장 단추 없이 곧바로 data-tbl 에 적힌다 (두 벌이 아니라 한 벌)',
    (친뒤.적힘 || '').indexOf('항목') >= 0, 친뒤);
  T('④-15 ★★ 글자를 쳐도 창은 여전히 안 뜬다', 친뒤.창 === false, 친뒤);

  // 줄 더하기 단추 — 창이 아니라 표 밑 단추를 누른다
  await pg.click('#ff0 .qltbl .qltblbar .rtb[data-tb="row+"]');
  await pg.waitForTimeout(300);
  const 더한뒤 = await pg.evaluate(() => {
    const el = document.querySelector('#ff0 .qltbl'), tb = el.querySelector('table');
    return { 줄: tb.rows.length, 칸: tb.rows[0].cells.length,
             첫칸: (tb.querySelector('th') || {}).textContent,
             적힘: el.getAttribute('data-tbl') };
  });
  T('④-16 ★★ [+ 줄] 을 누르면 줄이 하나 는다 (4줄 × 2칸)',
    더한뒤.줄 === 4 && 더한뒤.칸 === 2, 더한뒤);
  T('④-17 ★★ 줄을 더해도 적던 글을 잃지 않는다', 더한뒤.첫칸 === '항목', 더한뒤);
  T('④-18 ★ 늘어난 줄도 곧바로 적힌다',
    JSON.parse(더한뒤.적힘 || '{}').rows && JSON.parse(더한뒤.적힘).rows.length === 4, 더한뒤);

  const 새표 = await save();
  T('④-19 ★★★ 저장하면 표 덩이로 담긴다',
    (새표 || []).some(b => b.t === 'table' && b.rows[0][0] === '항목'), (새표 || []).map(b => b.t));
  T('④-20 ★★ 먼저 쓰던 글도 함께 담긴다',
    (새표 || []).some(b => b.t === 'text' && /글 한 줄/.test(b.v)), 새표);

  // ── ⑤ 저장돼 있던 표를 눌러 **그 자리에서** 고치고 지운다
  await openEd([표]);
  await pg.waitForTimeout(400);
  const 누르기전 = await pg.evaluate(() => {
    const el = document.querySelector('#ff0 .qltbl');
    return { cls: el.className, 바: getComputedStyle(el.querySelector('.qltblbar')).display };
  });
  T('⑤-1 ★★ 누르기 전에는 줄·칸 단추가 안 보인다 (글만 읽을 때 성가시지 않게)',
    누르기전.바 === 'none' && !/\bon\b/.test(누르기전.cls), 누르기전);

  await pg.click('#ff0 .qltbl tr:nth-child(2) td:nth-child(2)');   // ★ 손가락으로 누르는 길 그대로
  await pg.waitForTimeout(300);
  const 누른뒤 = await pg.evaluate(() => {
    const el = document.querySelector('#ff0 .qltbl'), a = document.activeElement || {};
    return { 표창: !!document.getElementById('tblOv'),
             커서칸: a.tagName + ':' + (a.textContent || ''),
             바: getComputedStyle(el.querySelector('.qltblbar')).display,
             cls: el.className,
             제목줄: el.querySelectorAll('th').length };
  });
  T('⑤-2 ★★★ 표를 눌러도 따로 창이 안 뜬다 (전에는 여기서 창이 떴다)', 누른뒤.표창 === false, 누른뒤);
  T('⑤-3 ★★★ 누른 바로 그 칸에 커서가 간다', 누른뒤.커서칸 === 'TD:9/10', 누른뒤);
  T('⑤-4 ★★ 누르면 줄·칸 단추가 표 밑에 펼쳐진다', 누른뒤.바 === 'flex', 누른뒤);
  T('⑤-5 ★ 제목줄이 제목줄(th 두 칸)로 보인다', 누른뒤.제목줄 === 2, 누른뒤);

  await pg.keyboard.press('End');
  await pg.keyboard.type('짜리');
  await pg.waitForTimeout(300);
  const 고친뒤 = await save();
  T('⑤-6 ★★★ 그 자리에서 고친 글자가 저장된다',
    (고친뒤 || []).length === 1 && 고친뒤[0].t === 'table' && 고친뒤[0].rows[1][1] === '9/10짜리', 고친뒤);
  T('⑤-7 ★★ 건드리지 않은 칸은 그대로다',
    !!고친뒤 && 고친뒤[0].rows[0].join('|') === '이름|값' && 고친뒤[0].rows[2].join('|') === '쓸모|10/10', 고친뒤);

  // 제목줄 껐다 켜기 · 칸 지우기 — 모두 표 밑 단추로
  await openEd([표]);
  await pg.waitForTimeout(400);
  await pg.click('#ff0 .qltbl th'); await pg.waitForTimeout(200);
  await pg.click('#ff0 .qltbl .qltblbar .rtb[data-tb="head"]'); await pg.waitForTimeout(350);
  const 제목끈뒤 = await pg.evaluate(() => {
    const el = document.querySelector('#ff0 .qltbl');
    return { th: el.querySelectorAll('th').length, 바: el.querySelectorAll('.qltblbar .rtb').length,
             적힘: el.getAttribute('data-tbl'), 표창: !!document.getElementById('tblOv') };
  });
  T('⑤-8 ★★ [제목줄] 을 누르면 제목줄이 풀린다', 제목끈뒤.th === 0, 제목끈뒤);
  T('⑤-9 ★★ 풀린 것도 곧바로 적힌다', JSON.parse(제목끈뒤.적힘 || '{}').head === 0, 제목끈뒤);
  T('⑤-10 ★ 다시 그려도 줄·칸 단추가 그대로 붙어 있다', 제목끈뒤.바 === 6, 제목끈뒤);
  T('⑤-11 ★★ 여기서도 창은 안 뜬다', 제목끈뒤.표창 === false, 제목끈뒤);

  await pg.click('#ff0 .qltbl tr:nth-child(1) td:nth-child(1)'); await pg.waitForTimeout(200);
  await pg.click('#ff0 .qltbl .qltblbar .rtb[data-tb="col-"]'); await pg.waitForTimeout(350);
  const 칸지운뒤 = await pg.evaluate(() => {
    const tb = document.querySelector('#ff0 .qltbl table');
    return { 칸: tb.rows[0].cells.length, 줄: tb.rows.length,
             남은글: [].map.call(tb.rows, r => r.cells[0].textContent).join('|') };
  });
  T('⑤-12 ★★ [칸 삭제] 로 누르고 있던 칸이 지워진다', 칸지운뒤.칸 === 1, 칸지운뒤);
  T('⑤-13 ★★ 지운 것은 그 칸뿐 — 나머지 줄은 다 남는다',
    칸지운뒤.줄 === 3 && 칸지운뒤.남은글 === '값|9/10|10/10', 칸지운뒤);

  // 표 지우기
  await openEd([{ t:'text', h:1, v:'글' }, 표]);
  await pg.waitForTimeout(400);
  await pg.click('#ff0 .qltbl th');
  await pg.waitForTimeout(250);
  await pg.click('#ff0 .qltbl .qltblbar .rtb[data-tb="kill"]');
  await pg.waitForTimeout(600);
  const 지운화면 = await pg.evaluate(() => ({
    표: !!document.querySelector('#ff0 .qltbl'),
    글: (document.querySelector('#ff0 .ql-editor').textContent || '').indexOf('글') >= 0 }));
  T('⑤-14 ★★★ [표 삭제] 를 누르면 표가 화면에서 사라진다', 지운화면.표 === false, 지운화면);
  T('⑤-15 ★★ 표 옆의 글은 남는다', 지운화면.글, 지운화면);
  const 지운뒤 = await save();
  T('⑤-16 ★★★ 저장해도 표만 사라진다',
    (지운뒤 || []).every(b => b.t !== 'table') && (지운뒤 || []).some(b => b.t === 'text'),
    (지운뒤 || []).map(b => b.t));

  // ── ⑥ 읽는 화면에도 표로 나오는가
  const 읽기 = await pg.evaluate(t => renderBlocks([t]), 표);
  T('⑥-1 ★★★ 글을 읽는 화면이 표를 표로 그린다',
    /<table/.test(읽기) && /<th>이름<\/th>/.test(읽기), 읽기.slice(0, 160));
  T('⑥-2 ★★ 넓은 표는 표만 옆으로 밀린다', /class="pbtwrap"/.test(읽기));
  const 본문 = await pg.evaluate(t => blocksText([{ t:'text', v:'앞' }, t]), 표);
  T('⑥-3 ★★ 본문 글자에 표가 담긴다', /이름 \| 값/.test(본문), 본문);
  T('⑥-4 ★★★ 덩이 하나 안에 빈 줄이 안 생긴다', 본문.split('\n\n').length === 2, JSON.stringify(본문));

  // ── ⑦ 일본어·러시아어로 켜도 표 창의 말이 그 나라 말인가
  await pg.evaluate(() => { try{ localStorage.setItem('bt_lang', 'ja'); }catch(_){} });
  await pg.reload({ waitUntil:'networkidle' });
  await pg.waitForTimeout(1000);
  await pg.evaluate(() => { try{ skipWelcome(); }catch(_){} window.__user = { uid:'U1', name:'나' }; });
  await openEd([표]);
  await pg.waitForTimeout(500);
  await pg.evaluate(() => richTable('ff0'));
  await pg.waitForTimeout(400);
  const 일본 = await pg.evaluate(() => {
    const bars = [].map.call(document.querySelectorAll('#ff0 .qltbl .qltblbar'), b => b.textContent);
    const 첫 = document.querySelector('#ff0 .qltbl .qltblbar');
    return { 말: bars.join(''),
             낱개: 첫 ? [].map.call(첫.querySelectorAll('.rtb'), z => z.textContent) : [],
             단추: (document.querySelector('.rtool .rtb[onclick*="richTable"]') || {}).textContent,
             표창: !!document.getElementById('tblOv') };
  });
  T('⑦-1 ★★★ 일본어로 켜면 표 밑 단추줄에 한글이 없다', 일본.말 !== '' && !/[가-힣]/.test(일본.말), 일본);
  T('⑦-2 ★★ 도구줄 표 단추도 일본어다', 일본.단추 === '表', 일본);
  T('⑦-3 ★★ 단추 여섯이 다 일본어 말을 얻었다 (빈 것이 없다)',
    일본.낱개.length === 6 && 일본.낱개.every(z => z && z.trim() && !/[가-힣]/.test(z)), 일본.낱개);
  T('⑦-4 ★★★ 일본어로 켜도 따로 창은 없다', 일본.표창 === false, 일본);

  }catch(e){
    // ★ 여기로 오면 검사가 끝까지 못 갔다는 뜻이다. 조용히 죽으면 무엇이 깨졌는지 안 남는다.
    T('치명 ★★★ 검사가 끝까지 돌았다', false, String(e && e.message || e).slice(0, 240));
  }
  T('⑧-1 ★★★ 처음부터 끝까지 오류가 하나도 없다', errs.length === 0, errs);

  console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
  await br.close(); server.close(); process.exit(bad ? 1 : 0);
})();
