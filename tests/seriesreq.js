// 연재자 신청 — 신청하는 길이 실제로 나 있는가
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const FILE = process.argv[2] || 'work.html';
const server = http.createServer((rq,rs)=>{
  const f = path.join(__dirname, rq.url === '/' ? FILE : rq.url.split('?')[0]);
  fs.readFile(f,(e,d)=>{ if(e){rs.writeHead(404);rs.end();return;}
    if(f.endsWith('.woff2')) rs.setHeader('Content-Type','font/woff2');
    rs.writeHead(200); rs.end(d); });
});
let ok=0,bad=0;
const T=(n,c,w)=>{ if(c){ok++;console.log('통과: '+n);} else {bad++;console.log('★ 실패: '+n+(w!==undefined?' — '+JSON.stringify(w).slice(0,160):''));} };

(async ()=>{
  await new Promise(r=>server.listen(0,r));
  const br = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await br.newContext({ locale:'ko-KR', viewport:{width:390,height:800}, isMobile:true, hasTouch:true });
  const pg = await ctx.newPage();
  const errs=[]; pg.on('pageerror', e=>errs.push(String(e)));
  pg.on('dialog', d=>d.accept());
  await pg.goto('http://127.0.0.1:'+server.address().port+'/', { waitUntil:'networkidle' });
  await pg.waitForTimeout(900);

  // 로그인은 했지만 연재 권한이 없는 보통 사람
  await pg.evaluate(()=>{
    try{ skipWelcome(); }catch(_){}
    try{ localStorage.removeItem('bt_seriesreq'); }catch(_){}
    window.__user = { uid:'U9', email:'a@b.c', name:'김보통' };
    window.__sent = [];
    window.__support = { add: async(b)=>{ window.__sent.push(b); }, list: async()=>window.__sent,
                         edit: async()=>{} };
    window.__series = { list: async()=>[], put: async()=>{}, del: async()=>{} };
    adminMe = null;    // 운영자 아님
  });

  const noPerm = await pg.evaluate(()=>({ can: canSeries(), html: seriesApplyHtml() }));
  T('보통 사람은 연재 권한이 없다', noPerm.can === false, noPerm.can);
  T('연재 탭에 신청 길이 보인다', /applySeries/.test(noPerm.html), noPerm.html.slice(0,90));
  T('왜 허락제인지 알려 준다', /허락받은/.test(noPerm.html), noPerm.html.slice(0,90));

  // 연재 탭을 실제로 그려서 단추가 화면에 있는지
  await pg.evaluate(()=>{ switchTab('community'); setComSub('news'); newsSub='sr'; renderNews(); });
  await pg.waitForTimeout(700);
  T('연재 화면에 신청 단추가 실제로 뜬다',
    await pg.evaluate(()=>!!document.querySelector('#newsWrap button[onclick*="applySeries"]')));
  T('올리기 단추는 안 뜬다',
    await pg.evaluate(()=>!document.querySelector('#newsWrap button[onclick*="writeSeries()"]')));

  // 신청서를 채워 보낸다
  await pg.evaluate(()=>applySeries());
  await pg.waitForTimeout(300);
  T('신청 화면이 열린다',
    await pg.evaluate(()=>(document.getElementById('formOv').style.display||'')==='flex'));
  T('직접 쓴 글 / 옮긴 글을 고르게 한다',
    await pg.evaluate(()=>{
      const t=document.getElementById('formBody').innerText;
      return t.indexOf('직접 쓴 글')>=0 && t.indexOf('옮긴 글')>=0; }));

  // 내용을 비우고 보내면 막힌다
  const empty = await pg.evaluate(()=>{ window.__sent=[]; formOk(); return window.__sent.length; });
  T('내용을 안 적으면 안 보내진다', empty === 0, empty);

  const sent = await pg.evaluate(async ()=>{
    const box=[...document.querySelectorAll('#formBody textarea')][0];
    box.value = '여수 앞바다 항해기를 달마다 하나씩 쓰려고 합니다.';
    formOk();
    await new Promise(r=>setTimeout(r,400));
    return { rows: window.__sent, mark: localStorage.getItem('bt_seriesreq') || '' };
  });
  T('신청이 고객센터로 간다', sent.rows.length === 1, sent.rows.length);
  T('갈래가 series 다', sent.rows[0] && sent.rows[0].kind === 'series', sent.rows[0] && sent.rows[0].kind);
  T('누가 보냈는지 남는다', sent.rows[0] && sent.rows[0].by === 'U9', sent.rows[0] && sent.rows[0].by);
  T('적은 내용이 담긴다', sent.rows[0] && /항해기/.test(sent.rows[0].text||''), (sent.rows[0]||{}).text);
  T('직접 쓴 글인지 옮긴 글인지 적힌다',
    sent.rows[0] && /직접 쓴 글|옮긴 글/.test(sent.rows[0].text||''), (sent.rows[0]||{}).text);
  T('보낸 것을 기억한다', !!sent.mark, sent.mark);

  T('두 번째부터는 보냈다고 알려 준다',
    await pg.evaluate(()=>/신청을 보냈습니다/.test(seriesApplyHtml())));

  // 고객센터 화면에서는 이 갈래를 못 고른다 (전용 화면으로 받는다)
  await pg.evaluate(()=>{ closeForm(); openSupport(); });
  await pg.waitForTimeout(300);
  T('고객센터 갈래에는 연재 신청이 없다',
    await pg.evaluate(()=>document.getElementById('formBody').innerText.indexOf('연재자 신청') < 0));
  await pg.evaluate(()=>closeForm());

  // 운영자 접수함에서 알아볼 수 있나
  const inbox = await pg.evaluate(async ()=>{
    window.__admin = { one: async()=>({ owner:true, perms:{} }) };
    window.__people = { one: async()=>({ name:'김보통', email:'a@b.c' }) };
    return await adminSupport();
  });
  T('접수함에 연재자 신청으로 나온다', /연재자 신청/.test(inbox), inbox.slice(0,120));
  T('접수함에서 보낸 사람으로 갈 수 있다', /openPerson\('U9'\)/.test(inbox));
  T('켜 주는 방법을 알려 준다', /연재 글 올리기/.test(inbox));

  // 권한이 켜지면 신청 안내 대신 올리기 단추
  const on = await pg.evaluate(()=>{
    adminMe = { perms:{ series:true } };
    return { can: canSeries(), seriesOnly: amSeriesOnly() };
  });
  T('권한이 켜지면 연재를 올릴 수 있다', on.can === true, on);
  T('연재자는 운영자가 아니다', on.seriesOnly === true, on);

  T('앱이 터지지 않았다', errs.length===0, errs.slice(0,2));
  console.log('합계: '+ok+'개 통과 / '+bad+'개 실패');
  await br.close(); server.close();
  process.exit(bad ? 1 : 0);
})();
