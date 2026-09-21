// 기록하는 동안 지도에 항적이 보이는가 — 브라우저 검사
//
// ★ 소스만 보는 검사로는 「화면에 실제로 나오는가」를 못 잡는다.
//   4.35 까지는 저장이 [멈추기] 때 한 번뿐이라, 21점을 모아 놓고도 지도가 비어 있었다.
//   사장님이 배 위에서 그것을 보시고 「이건 뭐지 도대체?」 하셨다.
const { chromium } = require('playwright');
const fs = require('fs'), http = require('http'), path = require('path');
const SRC = process.argv[2] || 'work.html';
const srv = http.createServer((req,res)=>{
  let f = req.url.split('?')[0];
  if(f === '/' || f === '/index.html') f = '/' + SRC;
  // ★ 앱 본체를 통째 경로(/home/claude/work.html)로 줘도 열려야 한다.
  //   여태는 앞 빗금만 떼고 지금 폴더에 붙여서, 통째 경로로 부르면 404 가 났다.
  const 통째 = f.replace(/^\//,'');
  const p = path.isAbsolute(통째) ? 통째
          : (path.isAbsolute(SRC) && f === '/' + SRC) ? SRC
          : path.join(process.cwd(), 통째);
  if(!fs.existsSync(p)){ res.writeHead(404); res.end(''); return; }
  const ext = path.extname(p);
  res.writeHead(200, { 'content-type': ext==='.html'?'text/html; charset=utf-8'
    : ext==='.js'?'text/javascript' : ext==='.json'?'application/json':'application/octet-stream' });
  res.end(fs.readFileSync(p));
});
(async ()=>{
  await new Promise(r => srv.listen(0, r));
  const port = srv.address().port;
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await (await b.newContext({ locale:'ko-KR', viewport:{width:411,height:900} })).newPage();
  let pass=0, fail=0;
  const T=(n,ok)=>{ok?pass++:(fail++,console.log('★ 실패:',n));};
  const errs=[]; page.on('pageerror', e=>errs.push(String(e.message).slice(0,140)));
  await page.route('**://tile.openstreetmap.org/**', r=>r.abort());
  await page.route('**://tiles.openseamap.org/**', r=>r.abort());

  // ★ 앱인 척한다 — 항적 줄은 앱에서만 그려진다
  await page.addInitScript(()=>{
    window.Capacitor = { isNativePlatform: ()=>true, getPlatform: ()=>'android', Plugins:{} };
    try{ localStorage.setItem('bt_agree','1'); }catch(e){}
  });
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil:'domcontentloaded' });
  await page.waitForTimeout(1500);

  // 아직 아무 점도 안 찍힌 항해를 열고 기록 중으로 만든다
  const made = await page.evaluate(()=>{
    try{
      const v = { id:'liveV', date:'2026-08-27', timeOut:'18:25',
                  posOut:{ lat:34.7387, lon:127.6789 }, logs:[], trk:[] };
      voyage.push(v);
      unlocked = true;
      trkNow = { vid:'liveV', from:new Date().toISOString(), pts:[], id:null, saved:0 };
      openMR('voyage','liveV');
      return 'ok';
    }catch(e){ return 'X ' + e.message; }
  });
  T('항해를 열었다', made === 'ok');
  await page.waitForTimeout(700);

  // ── 1. 켜자마자 「기록 중 · 0점」 자리가 있다
  const first = await page.evaluate(()=>{
    const el = document.getElementById('trkcnt');
    return el ? el.textContent.trim() : null;
  });
  T('기록 중 숫자 자리가 화면에 있다', first !== null);
  T('처음에는 0점이다', /0/.test(String(first)));

  // ★ 점에 accuracy·speed 를 넣어 준다. 4.78 부터 「흐리고 speed·bearing 도 없는 점」 은
  //   기지국 자리로 보고 버린다 — 실제 폰은 언제나 accuracy 를 준다(W3C Geolocation 규격).
  //   그것을 안 넣은 옛 검사가 「점이 안 쌓인다」 고 했었다.
  // ── 1-b. ★ 중간 저장이 일어나기 전에 이미 보여야 한다
  //   TRK_FLUSH 보다 적게 넣으면 항해 기록(it.trk)은 아직 비어 있다.
  //   그런데도 선이 보여야 「버퍼를 그린다」가 참이다.
  //   ── 이 계단이 없으면, 중간 저장 덕분에 선이 생겨서 사보타주가 안 잡힌다.
  //      실제로 처음에 안 잡혔다.
  const early = await page.evaluate(()=>{
    let la = 34.7387, lo = 127.6789;
    for(let i=0;i<5;i++){
      la += 0.0012; lo += 0.0009;
      trkPush({ latitude:la, longitude:lo, accuracy:8, speed:3.2, time:Date.now() + i*20000 });
    }
    return {
      saved:(voyage.find(v=>v.id==='liveV').trk||[]).length,
      line: (mapS && Array.isArray(mapS.line)) ? mapS.line.length : 0,
      cnt:  (document.getElementById('trkcnt')||{}).textContent
    };
  });
  T('아직 항해 기록에는 저장 전이다', early.saved === 0);
  T('★ 저장 전에도 지도에 선이 보인다', early.line > 1);
  T('★ 저장 전에도 숫자가 늘어 있다', /5/.test(String(early.cnt)));

  // ── 2. 점을 더 넣는다. 아무것도 안 누른다.
  const after = await page.evaluate(()=>{
    let la = 34.7387 + 5*0.0012, lo = 127.6789 + 5*0.0009;
    for(let i=0;i<16;i++){
      la += 0.0012; lo += 0.0009;
      trkPush({ latitude:la, longitude:lo, accuracy:8, speed:3.2, time:Date.now() + (5+i)*20000 });
    }
    const el = document.getElementById('trkcnt');
    return {
      cnt:  el ? el.textContent.trim() : null,
      pts:  (trkNow.pts||[]).length,
      line: (mapS && Array.isArray(mapS.line)) ? mapS.line.length : 0,
      saved:(voyage.find(v=>v.id==='liveV').trk||[]).length
    };
  });
  T('점이 쌓였다', after.pts === 21);
  T('★ 새로고침을 안 눌러도 숫자가 늘어 있다', /21/.test(String(after.cnt)));
  T('★ 새로고침을 안 눌러도 지도에 선이 생겼다', after.line > 1);
  T('★ 쌓이는 동안 항해 기록에도 저장됐다', after.saved > 1);

  // ── 3. 지도가 실제로 선을 그렸는가 (화면에 붙은 것으로 확인)
  const drawn = await page.evaluate(()=>{
    const el = document.getElementById('trkMap');
    if(!el) return { has:false };
    return { has:true, svg: el.querySelectorAll('svg polyline, svg path, canvas').length,
             html: el.innerHTML.length };
  });
  T('지도 자리가 있다', drawn.has === true);
  T('지도 위에 그려진 것이 있다', drawn.html > 200);

  // ── 4. 멈추면 저장되고, 버퍼가 아니라 저장된 것을 그린다
  const stopped = await page.evaluate(async ()=>{
    await trkStop();
    const v = voyage.find(x=>x.id==='liveV');
    return { now: trkNow, saved:(v.trk||[]).length, raw: trkRaw(v).length };
  });
  T('멈추면 기록이 끝난다', stopped.now === null);
  T('멈추면 항해에 저장된다', stopped.saved > 1);
  T('멈춘 뒤에는 저장된 것을 그린다', stopped.raw === stopped.saved);

  // ── 5. 화면에 오류가 없어야 한다
  T('브라우저 오류가 없다', errs.length === 0);
  if(errs.length) console.log('   ', errs.slice(0,3).join(' | '));

  console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
  await b.close(); srv.close();
  process.exit(fail ? 1 : 0);
})();
