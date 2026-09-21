// 5.00 — 지도에서 정박지 핀을 실제로 눌러 본다 (사장님 지적 두 번째)
//
// ★ 사장님 말씀: "여전히 지도에서 마리나 위치 누르면 클릭 안되는구만"
//   4.99 에서 pointer-events 를 되살렸는데도 안 눌린다고 하신다.
//   그러니 눈으로 코드를 보지 말고 **진짜 브라우저에서 손가락으로 눌러 본다.**
//   (사장님이 정하신 것 8번 — 짐작으로 고치지 않는다. 재고 고친다.)
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
  else { bad++; console.log('★ 실패: ' + n + (w !== undefined ? ' — ' + JSON.stringify(w).slice(0, 220) : '')); } };

(async () => {
  await new Promise(r => server.listen(0, r));
  const br = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const pg = await (await br.newContext({ locale:'ko-KR', viewport:{ width:390, height:844 },
                                          isMobile:true, hasTouch:true })).newPage();
  const errs = []; pg.on('pageerror', e => errs.push(String(e).slice(0, 140)));
  await pg.goto('http://127.0.0.1:' + server.address().port + '/', { waitUntil:'domcontentloaded' });
  await pg.waitForTimeout(1200);
  await pg.evaluate(() => { window.tell = () => Promise.resolve(); window.ask = () => Promise.resolve(true);
    try{ skipWelcome(); }catch(_){} unlocked = true; });
  await pg.waitForTimeout(300);

  // 지도만 따로 띄운다 — 화면 흐름을 타면 무엇 때문에 안 눌리는지 못 가린다.
  await pg.evaluate(() => {
    // ★★★ 실제 화면과 똑같이 만든다 — mapBox() 가 내놓는 그 모양 그대로.
    //   class="mapbox" 를 빼먹으면 .mapbox .mlbl 규칙이 아예 안 걸려서
    //   이름표가 제자리에 안 붙는다. 그런 채로 검사가 통과하면 검사가 거짓말을 한다.
    //   (실제로 그렇게 만들었다가 사보타주가 안 잡혀서 드러났다.)
    document.body.insertAdjacentHTML('beforeend', mapBox('penTest', '360px'));
    const d = document.getElementById('penTest');
    d.style.cssText += ';position:fixed;left:0;top:0;width:360px;height:360px;z-index:99999';
    window.__tapped = [];
    window.mapSpotTap = k => { window.__tapped.push(k); };
    mapInit('penTest', [
      { lat:34.3500, lon:134.0500, label:'다카마쓰항',  key:'spot:1' },
      { lat:34.3000, lon:134.2000, label:'쇼도시마',    key:'spot:2' }
    ], { mode:'view' });
  });
  await pg.waitForTimeout(900);

  const 틀 = await pg.evaluate(() => {
    const d = document.getElementById('penTest');
    const l = d.querySelector('.mlbl');
    return { cls: d.className,
             lab: l ? (() => { const r = l.getBoundingClientRect();
                               return { w:Math.round(r.width), pos:getComputedStyle(l).position }; })() : null };
  });
  T('★★★ 실제 지도 틀(mapbox)로 그린다', 틀.cls.indexOf('mapbox') >= 0, 틀);
  T('★★★ 이름표가 제자리에 붙어 있다 (검사가 거짓말하지 않게)',
    !!틀.lab && 틀.lab.pos === 'absolute' && 틀.lab.w < 200, 틀.lab);
  const 핀수 = await pg.evaluate(() => document.querySelectorAll('#penTest .mpin').length);
  T('지도에 정박지 핀이 그려진다', 핀수 === 2, 핀수);

  const 상자 = await pg.evaluate(() => {
    const p = document.querySelector('#penTest .mpin');
    if(!p) return null;
    const r = p.getBoundingClientRect();
    return { x:r.left + r.width/2, y:r.top + r.height/2, w:r.width, h:r.height };
  });
  T('핀에 누를 만한 크기가 있다', !!상자 && 상자.w >= 20 && 상자.h >= 20, 상자);

  // ★ 손가락 위에 무엇이 있나 — 이름표가 핀을 덮고 있으면 여기서 드러난다
  const 위엣것 = await pg.evaluate(({x, y}) => {
    const el = document.elementFromPoint(x, y);
    return el ? (el.className || el.tagName) : null;
  }, 상자);
  T('★★★ 핀 위에 다른 것이 덮여 있지 않다', String(위엣것 || '').indexOf('mpin') >= 0, 위엣것);

  // ★★★ 진짜로 손가락을 댄다
  await pg.touchscreen.tap(상자.x, 상자.y);
  await pg.waitForTimeout(400);
  let 눌림 = await pg.evaluate(() => window.__tapped.slice());
  T('★★★ 손가락으로 누르면 그 자리가 열린다', 눌림.length === 1 && 눌림[0] === 'spot:1', 눌림);

  // 마우스로도 (컴퓨터에서 여는 사람)
  await pg.evaluate(() => { window.__tapped = []; });
  await pg.mouse.click(상자.x, 상자.y);
  await pg.waitForTimeout(400);
  눌림 = await pg.evaluate(() => window.__tapped.slice());
  T('★★★ 마우스로 눌러도 열린다', 눌림.length === 1 && 눌림[0] === 'spot:1', 눌림);

  // 끌면 열리면 안 된다 — 지도를 옮기려던 것이지 자리를 연 것이 아니다
  await pg.evaluate(() => { window.__tapped = []; });
  await pg.mouse.move(상자.x, 상자.y);
  await pg.mouse.down();
  await pg.mouse.move(상자.x + 60, 상자.y + 40, { steps: 6 });
  await pg.mouse.up();
  await pg.waitForTimeout(300);
  눌림 = await pg.evaluate(() => window.__tapped.slice());
  T('★★ 지도를 끌었을 때는 안 열린다', 눌림.length === 0, 눌림);

  // ★★★ 이름표를 눌러도 열려야 한다 — 핀은 26px 인데 이름은 그 몇 배다.
  //   사람은 작은 동그라미보다 이름을 누른다.
  await pg.evaluate(() => { window.__tapped = []; });
  const 이름 = await pg.evaluate(() => {
    const l = document.querySelector('#penTest .mlbl');
    if(!l) return null;
    const r = l.getBoundingClientRect();
    return { x:r.left + r.width/2, y:r.top + r.height/2, txt:l.textContent, w:r.width };
  });
  T('이름표가 그려진다', !!이름 && 이름.w > 20, 이름);
  if(이름){
    await pg.mouse.click(이름.x, 이름.y);
    await pg.waitForTimeout(300);
    눌림 = await pg.evaluate(() => window.__tapped.slice());
    T('★★★ 이름을 눌러도 그 자리가 열린다', 눌림.length === 1, [이름.txt, 눌림]);
  }

  // 중간 기록 깃발도 같은 길로 열린다
  await pg.evaluate(() => {
    window.__flag = [];
    window.mapFlagTap = k => { window.__flag.push(k); };
    mapInit('penTest', [
      { lat:34.35, lon:134.05, label:'출발', key:'a' },
      { lat:34.33, lon:134.10, label:'점심', time:'12:00', key:'log:7' },
      { lat:34.30, lon:134.20, label:'도착', key:'b' }
    ], { mode:'view' });
  });
  await pg.waitForTimeout(700);
  const 깃 = await pg.evaluate(() => {
    const f = document.querySelector('#penTest .mflag');
    if(!f) return null;
    const r = f.getBoundingClientRect();
    return { x:r.left + r.width/2, y:r.top + r.height/2 };
  });
  T('중간 기록 깃발이 그려진다', !!깃, 깃);
  if(깃){
    await pg.mouse.click(깃.x, 깃.y);
    await pg.waitForTimeout(300);
    const f = await pg.evaluate(() => window.__flag.slice());
    T('★★★ 깃발도 마우스로 눌린다', f.length === 1 && f[0] === 'log:7', f);
  }

  // ══ 지도에서 길을 잃지 않게 (사장님 지적) ═════════════════════
  await pg.evaluate(() => {
    window.__tapped = [];
    mapInit('penTest', [
      { lat:34.3500, lon:134.0500, label:'다카마쓰항', key:'spot:1' },
      { lat:34.3000, lon:134.2000, label:'쇼도시마',   key:'spot:2' }
    ], { mode:'view' });
  });
  await pg.waitForTimeout(700);
  const 단추 = await pg.evaluate(() =>
    [...document.querySelectorAll('#penTest .mzoom button')]
      .map(b => ({ t:b.textContent.trim(), lab:b.getAttribute('aria-label') })));
  T('★★★ 지도 단추가 넷 (확대·축소·현재 위치·전체 보기)', 단추.length === 4, 단추);
  T('★★★ 현재 위치 단추가 있다', 단추.some(b => b.lab === '현재 위치' && b.t === '◎'), 단추);
  T('★★★ 전체 보기 단추가 있다', 단추.some(b => b.lab === '전체 보기' && b.t === '⤢'), 단추);
  T('★★ 단추가 44px (배 위에서 누른다)', await pg.evaluate(() => {
    const b = document.querySelector('#penTest .mzoom button');
    const r = b.getBoundingClientRect(); return r.width >= 44 && r.height >= 44;
  }));

  // 막 끌어 놓고 「전체 보기」 를 누르면 처음 자리로 돌아온다
  const 처음 = await pg.evaluate(() => ({ z:mapS.z, cx:Math.round(mapS.cx), cy:Math.round(mapS.cy) }));
  // ★ 배율까지 바꿔 놓고 눌러야 「처음 자리」 가 배율까지 되돌아오는지 알 수 있다
  await pg.evaluate(() => { mapZoom(2); });
  await pg.waitForTimeout(400);
  T('확대하면 배율이 바뀐다', await pg.evaluate(() => mapS.z) !== 처음.z);
  await pg.mouse.move(180, 180); await pg.mouse.down();
  await pg.mouse.move(40, 40, { steps:8 }); await pg.mouse.up();
  await pg.waitForTimeout(400);
  const 밀린뒤 = await pg.evaluate(() => ({ cx:Math.round(mapS.cx), cy:Math.round(mapS.cy) }));
  T('끌면 지도가 움직인다', 밀린뒤.cx !== 처음.cx || 밀린뒤.cy !== 처음.cy, [처음, 밀린뒤]);
  await pg.evaluate(() => mapFit());
  await pg.waitForTimeout(400);
  const 돌아온 = await pg.evaluate(() => ({ z:mapS.z, cx:Math.round(mapS.cx), cy:Math.round(mapS.cy) }));
  T('★★★ 전체 보기를 누르면 처음 자리로 돌아온다',
    돌아온.z === 처음.z && Math.abs(돌아온.cx - 처음.cx) <= 1 && Math.abs(돌아온.cy - 처음.cy) <= 1,
    [처음, 돌아온]);

  // 고른 자리로 돌아가는 띠 — 고르기 전에는 없다
  T('★★ 고르기 전에는 띠가 없다',
    await pg.evaluate(() => !document.querySelector('#penTest .mhot')));
  await pg.evaluate(() => { mapHot('spot:2'); });
  await pg.waitForTimeout(300);
  const 띠 = await pg.evaluate(() => {
    const b = document.querySelector('#penTest .mhot');
    return b ? { txt:b.textContent.trim(), h:Math.round(b.getBoundingClientRect().height) } : null;
  });
  T('★★★ 고르면 그 자리 이름이 띠로 뜬다', !!띠 && 띠.txt.indexOf('쇼도시마') >= 0, 띠);
  T('★★ 띠도 누를 만한 크기다', !!띠 && 띠.h >= 38, 띠);
  await pg.mouse.move(180, 180); await pg.mouse.down();
  await pg.mouse.move(60, 300, { steps:8 }); await pg.mouse.up();
  await pg.waitForTimeout(400);
  await pg.evaluate(() => mapBackToHot());
  await pg.waitForTimeout(400);
  const 되돌림 = await pg.evaluate(() => {
    const p = mapS.pts.find(x => x.key === 'spot:2');
    return { dx: Math.abs(mapS.cx - MERC.x(p.lon, mapS.z)), dy: Math.abs(mapS.cy - MERC.y(p.lat, mapS.z)) };
  });
  T('★★★ 띠를 누르면 그 자리로 돌아간다', 되돌림.dx < 1 && 되돌림.dy < 1, 되돌림);

  T('앱이 안 터졌다', errs.length === 0, errs);
  await br.close(); server.close();
  console.log(`\n합계: ${ok}개 통과 / ${bad}개 실패`);
  process.exit(bad ? 1 : 0);
})().catch(e => { console.log('★ 실패: 검사가 터졌습니다 — ' + (e && e.message)); process.exit(1); });
