// 4.105 — 「저장」을 누르면 **내가 고른 자리**가 저장되는가 (사장님 지적)
//
// ★ 사장님 말씀
//   「원래 내가 고른 자리가 처음엔 표기되는데 저장 누르니까 다른 자리로 바뀜.
//    아마 저장 스위치가 있는 자리에 같이 눌러지면서 그 자리가 저장되는 것 같은데?」
//
// ★ 무엇이 잘못이었나 — 4.104 에서 취소·저장을 지도 위로 내렸는데,
//   지도가 그 손가락을 같이 먹었다. 누르면 지도가 먼저 「거기를 골랐구나」 하고 핀을 옮기고,
//   그 다음 단추의 저장이 돌았다. 그래서 **단추 밑의 자리**가 저장됐다.
//   막는 줄이 `closest('.mzoom')` 라 이름을 하나하나 적어 둔 것이었고, 새 도구는 안 막혔다.
//
// ★ 이 검사는 코드를 읽지 않는다. **진짜로 지도를 찍고, 진짜로 저장을 누르고,
//   기록에 남은 좌표가 내가 찍은 그 좌표인지 본다.**
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
  else { bad++; console.log('★ 실패: ' + n + (w !== undefined ? ' — ' + JSON.stringify(w).slice(0,240) : '')); } };
const 같나 = (a, b) => a && b && Math.abs(a.lat - b.lat) < 1e-6 && Math.abs(a.lon - b.lon) < 1e-6;

(async () => {
  await new Promise(r => server.listen(0, r));
  const br = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const pg = await (await br.newContext({ locale:'ko-KR', viewport:{ width:390, height:844 },
                                          isMobile:true, hasTouch:true })).newPage();
  const errs = []; pg.on('pageerror', e => errs.push(String(e).slice(0,140)));
  await pg.route('**tile.openstreetmap.org/**', r => r.abort());
  await pg.route('**tiles.openseamap.org/**', r => r.abort());
  await pg.goto('http://127.0.0.1:' + server.address().port + '/', { waitUntil:'domcontentloaded' });
  await pg.waitForTimeout(1400);
  await pg.evaluate(() => { window.alert=()=>{}; window.confirm=()=>true;
    window.tell=()=>Promise.resolve(); window.ask=()=>Promise.resolve(true);
    try{ skipWelcome(); }catch(_){} unlocked = true; try{ openBoatSetup(); }catch(_){} });
  await pg.waitForTimeout(500);
  await pg.evaluate(() => { const n=document.getElementById('nbName'); if(n){ n.value='시험호'; createBoat(); } });
  await pg.waitForTimeout(1200);
  await pg.evaluate(() => {
    const p=n=>String(n).padStart(2,'0');
    const d=o=>{const x=new Date(Date.now()+o*864e5);
      return x.getFullYear()+'-'+p(x.getMonth()+1)+'-'+p(x.getDate());};
    // ★ 열쇠는 wxOut / wxIn, 좌표가 들어가는 자리는 posOut / posIn 이다 (posOf·posPut).
    voyage=[{ id:'v1', date:d(-1), title:'개도 한 바퀴', from:'여수', to:'여수',
              posOut:{lat:34.7400, lon:127.7300}, posIn:{lat:34.7500, lon:127.7400},
              logs:[], pub:true }];
    saveMR();
  });
  await pg.evaluate(() => { switchTab('boat'); setBoatSubTab('voyage'); });
  await pg.waitForTimeout(700);
  await pg.evaluate(() => { try{ openMR('voyage','v1'); }catch(e){} });
  await pg.waitForTimeout(1200);

  const 열림 = await pg.evaluate(() => {
    try{ posPick('wxOut'); }catch(e){ return 'err ' + e; }
    const b = document.querySelector('.mapbtm button.ok');
    if(b) b.scrollIntoView({ block:'center' });
    return !!b;
  });
  await pg.waitForTimeout(900);
  T('★ 위치 찍기가 열린다 (검사가 헛돌지 않게)', 열림 === true, 열림);
  if(열림 !== true){ console.log('\n합계: ' + ok + '개 통과 / ' + (bad+1) + '개 실패'); await br.close(); server.close(); process.exit(1); }

  // ── 지도의 **왼쪽 위**를 찍는다 (단추는 아래에 있으므로 확실히 다른 자리다)
  const 자리 = await pg.evaluate(() => {
    const m = document.querySelector('.mapbox').getBoundingClientRect();
    const b = document.querySelector('.mapbtm button.ok').getBoundingClientRect();
    return { 지도:{x:m.x,y:m.y,w:m.width,h:m.height}, 저장:{x:b.x+b.width/2, y:b.y+b.height/2} };
  });
  const 찍을곳 = { x: 자리.지도.x + 70, y: 자리.지도.y + 70 };
  await pg.mouse.click(찍을곳.x, 찍을곳.y);
  await pg.waitForTimeout(600);

  const 고른것 = await pg.evaluate(() => mapS && mapS.pick ? { lat:mapS.pick.lat, lon:mapS.pick.lon } : null);
  T('★★ 지도를 찍으면 그 자리가 잡힌다', !!고른것, 고른것);

  // ── 이제 「저장」을 **진짜로 누른다**
  await pg.mouse.click(자리.저장.x, 자리.저장.y);
  await pg.waitForTimeout(800);

  const 결과 = await pg.evaluate(() => {
    const it = voyage.find(x => String(x.id) === 'v1');
    const p = it && it.posOut ? { lat:it.posOut.lat, lon:it.posOut.lon } : null;
    return { 저장된것: p, 아직찍기중: !!(mapS && mapS.mode === 'pick'),
             핀: mapS && mapS.pick ? { lat:mapS.pick.lat, lon:mapS.pick.lon } : null };
  });

  T('★★★ 저장을 누르면 **내가 고른 자리**가 저장된다 (단추 밑 자리가 아니다)',
    같나(결과.저장된것, 고른것), { 고른것, 저장된것: 결과.저장된것 });
  T('★★★ 저장을 누를 때 핀이 안 움직인다', 같나(결과.핀 || 고른것, 고른것), { 고른것, 누른뒤핀: 결과.핀 });
  T('★★ 저장하면 찍기 모드가 닫힌다', 결과.아직찍기중 === false, 결과.아직찍기중);

  // ── 취소도 마찬가지다 — 눌러도 자리가 안 바뀌어야 한다
  await pg.evaluate(() => { try{ posPick('wxIn'); }catch(e){} });
  await pg.waitForTimeout(800);
  await pg.evaluate(() => { const b=document.querySelector('.mapbtm button.ok'); if(b) b.scrollIntoView({block:'center'}); });
  await pg.waitForTimeout(300);
  const 자리2 = await pg.evaluate(() => {
    const m = document.querySelector('.mapbox').getBoundingClientRect();
    const bs = [...document.querySelectorAll('.mapbtm button')];
    const c = bs[0].getBoundingClientRect();
    return { 지도:{x:m.x,y:m.y}, 취소:{x:c.x+c.width/2, y:c.y+c.height/2} };
  });
  await pg.mouse.click(자리2.지도.x + 90, 자리2.지도.y + 90);
  await pg.waitForTimeout(500);
  const 전 = await pg.evaluate(() => { const it=voyage.find(x=>String(x.id)==='v1');
    return it && it.posIn ? { lat:it.posIn.lat, lon:it.posIn.lon } : null; });
  await pg.mouse.click(자리2.취소.x, 자리2.취소.y);
  await pg.waitForTimeout(700);
  const 후 = await pg.evaluate(() => { const it=voyage.find(x=>String(x.id)==='v1');
    return { 값: it && it.posIn ? { lat:it.posIn.lat, lon:it.posIn.lon } : null,
             찍기중: !!(mapS && mapS.mode === 'pick') }; });
  T('★★ 취소를 눌러도 기록이 안 바뀐다', 같나(전, 후.값), { 전, 후: 후.값 });
  T('★★ 취소하면 찍기 모드가 닫힌다', 후.찍기중 === false, 후.찍기중);

  // ── 확대 단추를 눌러도 자리가 안 잡혀야 한다 (옛날부터 있던 규칙)
  await pg.evaluate(() => { try{ posPick('wxOut'); }catch(e){} });
  await pg.waitForTimeout(800);
  const 확대전 = await pg.evaluate(() => { const b=document.querySelector('.mzoom button');
    if(b) b.scrollIntoView({block:'center'});
    return mapS && mapS.pick ? { lat:mapS.pick.lat, lon:mapS.pick.lon } : null; });
  await pg.waitForTimeout(300);
  const zb = await pg.evaluate(() => { const b=document.querySelector('.mzoom button').getBoundingClientRect();
    return { x:b.x+b.width/2, y:b.y+b.height/2 }; });
  await pg.mouse.click(zb.x, zb.y);
  await pg.waitForTimeout(700);
  const 확대후 = await pg.evaluate(() => mapS && mapS.pick ? { lat:mapS.pick.lat, lon:mapS.pick.lon } : null);
  T('★★ 확대 단추를 눌러도 핀이 안 움직인다', 같나(확대전, 확대후), { 확대전, 확대후 });

  T('앱이 안 터졌다', errs.length === 0, errs.join(' | '));
  console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
  await br.close(); server.close();
  process.exit(bad ? 1 : 0);
})();
