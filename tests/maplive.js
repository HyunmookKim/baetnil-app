// 항해일지 지도 브라우저 검사 — 지도가 정말 하나인가, 선을 누르면 정말 꽂히는가
const { chromium } = require('playwright');
const fs = require('fs'), http = require('http'), path = require('path');
const SRC = process.argv[2] || 'work.html';
// ★ 뿌리(/) 요청이 절대경로 파일이면 cwd 를 붙이지 말고 그대로 연다.
//   전에는 process.cwd() 를 무조건 앞에 붙여 절대경로를 못 받고
//   ERR_HTTP_RESPONSE_CODE_FAILURE 로 검사가 아예 돌지 못했다.
const __MAIN = path.isAbsolute(SRC) ? SRC : path.join(process.cwd(), SRC);
const __BASE = path.dirname(__MAIN);
const __pick = u => {
  const f = u.split('?')[0];
  if(f === '/' || f === '/index.html') return __MAIN;
  const rel = f.replace(/^\//,'');
  for(const d of [__BASE, __dirname, process.cwd()]){ const c = path.join(d, rel); if(fs.existsSync(c)) return c; }
  return path.join(__BASE, rel);
};
const srv = http.createServer((req,res)=>{
  const p = __pick(req.url);
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
  const t=(n,ok)=>{ok?pass++:(fail++,console.log('★ 실패:',n));};
  const errs=[]; page.on('pageerror', e=>errs.push(String(e.message).slice(0,140)));
  // 타일은 바깥에서 받아온다 — 검사에서는 막는다 (느리고, 없어도 지도 뼈대는 돈다)
  await page.route('**://tile.openstreetmap.org/**', r=>r.abort());
  await page.route('**://tiles.openseamap.org/**', r=>r.abort());

  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil:'domcontentloaded' });
  await page.waitForTimeout(1500);

  // 항적이 있는 항해 하나를 만들어 넣는다 (실제 자료 모양 그대로)
  const made = await page.evaluate(()=>{
    try{
      const base = Date.now() - 3600e3;
      const pts = [];
      for(let i=0;i<20;i++) pts.push({ la:+(34.740+i*0.0016).toFixed(5),
                                       lo:+(127.740+i*0.0021).toFixed(5),
                                       t:new Date(base+i*180e3).toISOString() });
      const v = { id:'testvoy1', date:'2026-08-26', timeOut:'08:00', timeIn:'10:00',
                  posOut:{lat:34.740, lon:127.740}, posIn:{lat:34.7704, lon:127.7799},
                  logs:[], trk:pts };
      voyage.push(v);
      unlocked = true;
      openMR('voyage','testvoy1');
      return 'ok';
    }catch(e){ return 'X ' + e.message; }
  });
  t('항해를 열었다 — ' + made, made === 'ok');
  await page.waitForTimeout(800);

  // ① 지도는 하나뿐이다
  const maps = await page.evaluate(()=> document.querySelectorAll('.mapbox').length);
  t('지도가 하나뿐이다 (' + maps + '개)', maps === 1);

  // ② 「지도에서」를 눌러도 하나뿐이다 — 여기가 원래 사고 자리다
  await page.evaluate(()=>{ try{ posPick('wxOut'); }catch(e){} });
  await page.waitForTimeout(500);
  const maps2 = await page.evaluate(()=> document.querySelectorAll('.mapbox').length);
  t('「지도에서」를 눌러도 지도가 하나 (' + maps2 + '개)', maps2 === 1);
  const bar = await page.evaluate(()=> !!document.querySelector('.mapbar'));
  t('고르는 중이라는 띠가 뜬다', bar);
  const mode1 = await page.evaluate(()=> mapS && mapS.mode);
  t('고르는 모드로 바뀐다', mode1 === 'pick');
  // 그만두면 되돌아온다
  await page.evaluate(()=>{ try{ posPickCancel(); }catch(e){} });
  await page.waitForTimeout(300);
  const after = await page.evaluate(()=> ({ mode: mapS && mapS.mode, bar: !!document.querySelector('.mapbar') }));
  t('그만두면 보기 모드로 돌아간다', after.mode === 'view');
  t('그만두면 띠가 걷힌다', after.bar === false);

  // ③ 항적 선을 눌러 중간 기록 꽂기
  const before = await page.evaluate(()=> (voyage.find(v=>v.id==='testvoy1').logs||[]).length);
  const hit = await page.evaluate(()=>{
    // 선 한가운데를 화면 좌표로 옮긴다
    const it = voyage.find(v=>v.id==='testvoy1');
    const mid = it.trk[Math.floor(it.trk.length/2)];
    const el = document.getElementById('trkMap');
    const W = el.clientWidth, H = el.clientHeight;
    const x = MERC.x(mid.lo, mapS.z) - (mapS.cx - W/2);
    const y = MERC.y(mid.la, mapS.z) - (mapS.cy - H/2);
    const r = trkNearOnLine('testvoy1', x, y, W, H);
    if(r) logAddAt('testvoy1', r);
    return r;
  });
  await page.waitForTimeout(600);
  t('선 위를 짚으면 그 자리를 찾아낸다', !!hit && isFinite(hit.lat) && isFinite(hit.lon));
  t('그 자리의 시각도 함께 나온다', !!hit && /^\d\d:\d\d$/.test(hit.time || ''));
  const nowN = await page.evaluate(()=> (voyage.find(v=>v.id==='testvoy1').logs||[]).length);
  t('중간 기록이 하나 늘었다', nowN === before + 1);
  const g = await page.evaluate(()=> {
    const L = voyage.find(v=>v.id==='testvoy1').logs; return L[L.length-1];
  });
  t('꽂힌 기록에 좌표가 들어 있다', g && g.pos && isFinite(g.pos.lat) && isFinite(g.pos.lon));
  t('꽂힌 기록에 시각이 들어 있다', g && /^\d\d:\d\d$/.test(g.time||''));

  // ④ 선에서 먼 곳은 안 꽂힌다
  const far = await page.evaluate(()=>{
    const el = document.getElementById('trkMap');
    return trkNearOnLine('testvoy1', 5, el.clientHeight - 5, el.clientWidth, el.clientHeight);
  });
  t('선에서 먼 곳을 누르면 안 꽂힌다', far === null);

  // ⑤ 깃발이 그려지고, 눌러도 새 기록이 안 생긴다
  await page.waitForTimeout(400);
  const flags = await page.evaluate(()=> document.querySelectorAll('#trkMap .mflag').length);
  t('중간 기록이 깃발로 보인다 (' + flags + '개)', flags >= 1);
  const beforeTap = await page.evaluate(()=> (voyage.find(v=>v.id==='testvoy1').logs||[]).length);
  await page.evaluate(()=>{ const f=document.querySelector('#trkMap .mflag'); if(f) f.click(); });
  await page.waitForTimeout(400);
  const afterTap = await page.evaluate(()=> (voyage.find(v=>v.id==='testvoy1').logs||[]).length);
  t('깃발을 눌러도 기록이 안 늘어난다', afterTap === beforeTap);

  // ⑥ 확대·축소 단추가 손가락 크기인가
  const zb = await page.evaluate(()=>
    [...document.querySelectorAll('#trkMap .mzoom button')].map(e=>{
      const r=e.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; }));
  t('확대·축소 단추가 38 이상 (' + JSON.stringify(zb) + ')', zb.length>0 && zb.every(s=>s[0]>=38 && s[1]>=38));

  t('앱이 터지지 않았다 — ' + (errs[0]||''), errs.length === 0);
  console.log(`\n${pass}/${pass+fail} 통과`);
  await b.close(); srv.close();
  process.exit(fail ? 1 : 0);
})().catch(e=>{ console.log('★ 검사가 돌지 못했다:', e.message); srv.close(); process.exit(1); });
