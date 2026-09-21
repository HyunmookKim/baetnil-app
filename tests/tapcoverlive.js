// 4.104 — 누를 수 있어야 하는 것이 **다른 것에 깔려 있지 않은가**
//
// ★ 사장님 말씀 (2026-09-05)
//   「저장 스위치가 기존에 지도 스위치랑 겹쳐 가지고 안 눌러진다」
//   「꼴랑 이것만 고치지 말고 … 인간 입장에서 생각 안 하고 니 멋대로 만든 거 싹 다 찾아내라」
//
// ★ 흠이 무엇인가 — 크기는 `tapsizetest` 가 이미 잰다. 그런데 **크기가 커도 위에 다른 것이
//   얹혀 있으면 안 눌린다.** 지도의 「저장」이 확대(+) 단추에 깔려 있었다.
//   눈으로는 보이는데 손가락은 딴 것을 누른다. 화면이 거짓말을 하는 것이다 (규칙 2).
//
// ★ 어떻게 재나 — 코드를 읽지 않는다. 진짜 브라우저에서 **그 자리를 찍어 본다.**
//   `document.elementFromPoint` 가 그 단추(또는 그 안의 것)를 돌려주지 않으면 깔린 것이다.
//   가운데 한 점만 보지 않고 **다섯 점**(가운데·네 모서리 안쪽)을 본다 —
//   다섯 다 막혔으면 아예 못 누르고, 가운데만 막혔으면 반쯤 막힌 것이다.
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
  else { bad++; console.log('★ 실패: ' + n + (w !== undefined ? '\n    ' + w : '')); } };

const PROBE = `(() => {
  const SEL = 'button,select,textarea,input,a[href],a[onclick],[onclick],[role=button],[data-tap]';
  const 보이나 = el => { const r = el.getBoundingClientRect();
    if(r.width < 6 || r.height < 6) return false;
    const st = getComputedStyle(el);
    if(st.display==='none' || st.visibility==='hidden' || +st.opacity < .05) return false;
    if(st.pointerEvents === 'none') return false;
    if(el.disabled) return false;
    if(el.closest('[hidden]')) return false;
    // ★ 서랍·모달이 열려 있으면 그 뒤의 것은 **가려지는 게 맞다.** 세면 검사가 거짓말을 한다.
    const 덮개 = document.querySelector('#drawerOv.open, #drawer.open, .lkwrap.open, .mask.on');
    if(덮개 && !덮개.contains(el) && !el.closest('#drawer,.lkwrap,.mrpanel,#mrPanel,.modal')) return false;
    return true;
  };
  const label = el => (el.innerText || el.value || el.getAttribute('aria-label') || el.title || '')
    .replace(/\\s+/g,' ').trim().slice(0,24);
  const 이름 = el => el ? (el.tagName.toLowerCase()+(el.id?'#'+el.id:'')+
        (el.className&&typeof el.className==='string'?'.'+el.className.trim().split(/\\s+/).slice(0,2).join('.'):'')) : '(없음)';
  const where = el => { let p=el,s=[];
    for(let i=0;p&&i<3;i++,p=p.parentElement) s.push(이름(p));
    return s.join(' < '); };

  // 한 자리에서 다섯 점 가운데 몇 점이나 닿는가
  // ★★★ 화면 밖으로 나간 점을 **버리지 않는다** (2026-09-05 — 이것 때문에 검사가 거짓말했다).
  //   버리면 「남은 점은 다 닿았으니 멀쩡하다」 가 되어, 오른쪽이 깔린 단추가 통과했다.
  //   밖으로 나간 점은 **못 잰 것**으로 따로 센다.
  const 재기 = el => {
    const r = el.getBoundingClientRect();
    const inx = Math.min(6, r.width/3), iny = Math.min(6, r.height/3);
    const pts = [
      [r.left + r.width/2, r.top + r.height/2],
      [r.left + inx, r.top + iny], [r.right - inx, r.top + iny],
      [r.left + inx, r.bottom - iny], [r.right - inx, r.bottom - iny]
    ];
    let 닿음 = 0, 밖 = 0, 덮개 = null;
    pts.forEach(([x,y]) => {
      if(!(x >= 0 && y >= 0 && x < innerWidth && y < innerHeight)){ 밖++; return; }
      const top = document.elementFromPoint(x, y);
      if(top && (top === el || el.contains(top) || top.contains(el))) 닿음++;
      else if(!덮개) 덮개 = top;
    });
    return { 닿음, 밖, 점: pts.length, 덮개 };
  };

  const out = [], 못잼 = [];
  const 것들 = [...document.querySelectorAll(SEL)].filter(보이나);
  것들.forEach(el => {
    // ★★★ 굴려서 **화면 한가운데로 데려온 뒤에** 잰다.
    //   그러지 않으면 위 머리띠·아래 탭바에 잠깐 들어간 것까지 흠으로 세게 된다.
    //   가운데로 데려와도 덮여 있으면 **그것은 어떻게 해도 못 누르는 것**이다.
    try{ el.scrollIntoView({ block:'center', inline:'nearest' }); }catch(_){}
    let m = 재기(el);
    // ★★★ 못 재는 것을 **조용히 건너뛰지 않는다** (2026-09-05 — 이 검사가 거짓말을 했다).
    //   가운데로 못 데려오면 잴 점이 하나도 안 남고, 그러면 「깔린 것 없음」 으로 지나갔다.
    //   실제로 지도의 「저장」이 확대 단추에 깔려 있는데도 통과했다.
    //   → 다른 방법으로 한 번 더 데려와 보고, 그래도 못 재면 **못 쟀다고 적는다.**
    if(m.점 === 0){
      try{ el.scrollIntoView({ block:'nearest', inline:'nearest' }); }catch(_){}
      m = 재기(el);
    }
    if(m.점 === 0){
      const 창 = el.closest('#mrPanel,.lkwrap,#drawer,.modal');
      if(창){ try{ 창.scrollTop = el.offsetTop - 창.clientHeight/2; }catch(_){} m = 재기(el); }
    }
    if(m.닿음 + m.밖 < m.점 || m.밖 === m.점){
      // 덮여 있다 — 밖으로 나간 점이 있어도 「덮인 점」이 하나라도 있으면 흠이다
    }
    if(m.밖 === m.점){ 못잼.push({ t: label(el), s: where(el), 왜:'다섯 점이 다 화면 밖' }); return; }
    if(m.닿음 + m.밖 === m.점){
      // 닿는 점만 있고 나머지는 화면 밖 — 다 못 쟀다
      if(m.밖 > 0) 못잼.push({ t: label(el), s: where(el), 왜: m.밖 + '점이 화면 밖' });
      return;
    }
    out.push({ t: label(el), s: where(el), 닿음: m.닿음, 밖: m.밖, 점: m.점,
               덮은것: 이름(m.덮개),
               w: Math.round(el.getBoundingClientRect().width),
               h: Math.round(el.getBoundingClientRect().height) });
  });
  // ★★★ 화면 전체 — **누르는 것들끼리 자리가 겹치지 않는가**
  //   찍어 보는 방식은 굴린 자리에 따라 놓칠 수 있다. 네모끼리 겹치는지는 굴려도 안 변한다.
  const 이름짧 = el => ((el.textContent||el.getAttribute('aria-label')||'').replace(/\\s+/g,' ').trim().slice(0,14))
     + '(' + (typeof el.className==='string' ? (el.className.trim().split(/\\s+/)[0]||el.tagName.toLowerCase()) : el.tagName.toLowerCase()) + ')';
  // ★ **같은 틀 안에 붙어 있는 것끼리만** 견준다.
  //   머리띠(고정)와 목록 줄은 굴리면 서로 비켜난다 — 그 순간 겹쳤다고 세면 검사가 거짓말한다.
  //   지도의 「저장」과 확대 단추처럼 **같은 상자에 못 박혀 있어 굴려도 안 비켜나는 것**만 본다.
  const 겹친것 = [];
  for(let i=0;i<것들.length;i++) for(let j=i+1;j<것들.length;j++){
    const a = 것들[i], b = 것들[j];
    if(a.contains(b) || b.contains(a)) continue;
    if(a.offsetParent !== b.offsetParent) continue;      // 틀이 다르면 굴리면 비켜난다
    if(!a.offsetParent) continue;
    const pa = getComputedStyle(a).position, pb = getComputedStyle(b).position;
    const 붙박이 = x => x === 'absolute' || x === 'fixed';
    if(!붙박이(pa) && !붙박이(pb)) continue;              // 둘 다 흐름 안이면 원래 안 겹친다
    const p = a.getBoundingClientRect(), q = b.getBoundingClientRect();
    if(p.width<4||p.height<4||q.width<4||q.height<4) continue;
    const w = Math.min(p.right,q.right) - Math.max(p.left,q.left);
    const h = Math.min(p.bottom,q.bottom) - Math.max(p.top,q.top);
    if(w > 2 && h > 2) 겹친것.push(이름짧(a) + ' ↔ ' + 이름짧(b)
      + '  겹친 넓이 ' + Math.round(w) + '×' + Math.round(h));
  }
  return { 깔림: out, 못잼, 겹침: 겹친것 };
})()`;

(async () => {
  await new Promise(r => server.listen(0, r));
  const br = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await br.newContext({ locale:'ko-KR', viewport:{ width:390, height:844 }, isMobile:true, hasTouch:true });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(String(e).slice(0,120)));
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
    maint=[{id:'m1',name:'엔진오일 교체',grp:'엔진',months:12,unit:'m',lastDate:d(-400)}];
    lockers=[{id:'L1',zone:'선수',label:'선수 창고',x:10,y:10,w:30,h:20}];
    items=[{id:'i1',name:'구명조끼',qty:6,unit:'개',lockerId:'L1',photos:[],note:''}];
    voyage=[{id:'v1',date:d(-1),title:'개도 한 바퀴',from:'여수',to:'여수',
             out:{lat:34.74,lon:127.73},in:{lat:34.75,lon:127.74},
             logs:[{id:'g1',t:Date.now(),kind:'note',memo:'좋다'}],pub:true}];
    runs=[{id:'u1',date:d(-3),hours:'3.5',purpose:'충전'}];
    fuel=[{id:'f1',date:d(-9),liters:'180',cost:'315000',full:true}];
    saveMR();
  });
  await pg.waitForTimeout(400);

  const 자리 = [
    ['홈 · 오늘',        () => { switchTab('home'); setHomeSub('today'); }],
    ['홈 · 점검',        () => { switchTab('home'); setHomeSub('check'); }],
    ['홈 · 날씨·물때',   () => { switchTab('home'); setHomeSub('weather'); }],
    ['배 · 정기점검',    () => { switchTab('boat'); setBoatSubTab('maint'); }],
    ['배 · 물품(도면)',  () => { switchTab('boat'); setBoatSubTab('stow'); }],
    ['배 · 물품(편집)',  () => { switchTab('boat'); setBoatSubTab('stow'); if(!lkEdit) toggleLkEdit(); }],
    ['배 · 기록',        () => { switchTab('boat'); setBoatSubTab('log'); }],
    ['배 · 항해일지',    () => { switchTab('boat'); setBoatSubTab('voyage'); }],
    ['커뮤니티 · 글판',  () => { setComSub('talk'); }],
    ['커뮤니티 · 정박지',() => { setComSub('spots'); }],
    ['커뮤니티 · 장터',  () => { setComSub('market'); }],
    ['남의 배',          () => { switchTab('others'); }],
    ['서랍',             () => { openDrawer(); }],
  ];

  const 모은것 = [], 못잰것 = [], 겹친것 = [];
  for(const [name, fn] of 자리){
    const e = await pg.evaluate(f => { try{ (new Function(f))(); return ''; }catch(err){ return String(err); } },
                                '(' + fn.toString() + ')()');
    await pg.waitForTimeout(700);
    const r = await pg.evaluate(PROBE);
    if(e) console.log('  ※ ' + name + ' 로 못 갔습니다 — ' + e.slice(0,80));
    r.깔림.forEach(o => 모은것.push(Object.assign({ 자리:name }, o)));
    r.못잼.forEach(o => 못잰것.push(Object.assign({ 자리:name }, o)));
    (r.겹침||[]).forEach(x => 겹친것.push('[' + name + '] ' + x));
    console.log('  ' + name.padEnd(16) + ' 깔린 것 ' + r.깔림.length + '개'
      + (r.못잼.length ? ' · 못 잰 것 ' + r.못잼.length + '개' : ''));
  }
  // 서랍은 닫아 둔다 — 다음 검사를 가린다
  await pg.evaluate(() => { try{ closeDrawer(); }catch(_){} });
  await pg.waitForTimeout(300);

  // ★ 이번에 사고 난 자리 — 항해일지의 「위치 찍기」
  await pg.evaluate(() => { switchTab('boat'); setBoatSubTab('voyage'); });
  await pg.waitForTimeout(700);
  await pg.evaluate(() => { try{ openMR('voyage','v1'); }catch(e){} });
  await pg.waitForTimeout(1200);
  const 찍기됨 = await pg.evaluate(() => {
    try{ posPick('out'); return !!document.querySelector('.mapbtm button, .mapbar button'); }
    catch(e){ return 'err ' + e; }
  });
  await pg.waitForTimeout(900);
  const 찍기 = await pg.evaluate(PROBE);
  찍기.깔림.forEach(o => 모은것.push(Object.assign({ 자리:'항해일지 · 위치 찍기' }, o)));
  찍기.못잼.forEach(o => 못잰것.push(Object.assign({ 자리:'항해일지 · 위치 찍기' }, o)));
  (찍기.겹침||[]).forEach(x => 겹친것.push('[항해일지 · 위치 찍기] ' + x));
  console.log('  ' + '항해일지 · 위치 찍기'.padEnd(16) + ' 깔린 것 ' + 찍기.깔림.length + '개'
    + (찍기.못잼.length ? ' · 못 잰 것 ' + 찍기.못잼.length + '개' : '') + '  (찍기모드=' + 찍기됨 + ')');

  console.log('');
  T('★★★ 위치 찍기 화면이 실제로 열린다 (검사가 헛돌지 않게)', 찍기됨 === true, String(찍기됨));

  // ★★★ 이 검사가 **정말로 깔린 것을 잡는가** — 일부러 하나 덮어 보고 확인한다.
  //   2026-09-05 에 이 검사는 지도의 「저장」이 확대 단추에 깔려 있는데도 통과했다.
  //   못 재는 것을 조용히 넘겼기 때문이다. 그 뒤로는 **검사 자신을 먼저 시험한다.**
  //   이것이 실패하면 위의 「깔린 것 없음」은 믿을 수 없는 말이다.
  const 자가시험 = await pg.evaluate(() => {
    const b = document.createElement('button');
    b.id = '__probeVictim'; b.textContent = '덮인 단추';
    b.style.cssText = 'position:fixed;left:40px;top:300px;width:160px;height:48px;z-index:5';
    document.body.appendChild(b);
    const c = document.createElement('div');
    c.id = '__probeCover';
    c.style.cssText = 'position:fixed;left:40px;top:300px;width:160px;height:48px;z-index:9999;background:#f00';
    document.body.appendChild(c);
    return true;
  });
  await pg.waitForTimeout(200);
  const 시험결과 = await pg.evaluate(PROBE);
  await pg.evaluate(() => { ['__probeVictim','__probeCover'].forEach(id => {
    const e = document.getElementById(id); if(e) e.remove(); }); });
  const 잡았나 = (시험결과.깔림 || []).some(o => (o.s || '').indexOf('__probeVictim') >= 0);
  T('★★★ 검사 자신이 깔린 단추를 실제로 잡는다 (일부러 덮어 보고 확인)', 잡았나,
    '덮어 놓은 단추를 못 잡았습니다 — 이 검사는 아무것도 못 지키고 있습니다');

  // ─────────────────────────────────────────────────────────────
  // ★★★ 지도 위의 **누르는 것들끼리 자리가 겹치지 않는가**
  //
  //   위의 「깔림」 검사는 찍어 보는 방식이라, 굴린 자리에 따라 점이 화면 밖으로 나가면
  //   못 잡을 수가 있다. 지도는 자리가 정해져 있으므로 **네모끼리 겹치는지 그냥 잰다.**
  //   이것이 2026-09-05 사고(「저장」이 확대 단추 밑)를 잡는 곧은 자다.
  const 지도겹침 = await pg.evaluate(() => {
    const 상자 = document.querySelector('.mapbox'); if(!상자) return { 없음:true };
    const 것들 = [...상자.querySelectorAll('button,[data-tap],[role=button],a[onclick]')]
      .filter(el => { const r = el.getBoundingClientRect();
        const st = getComputedStyle(el);
        return r.width > 4 && r.height > 4 && st.display !== 'none'
            && st.visibility !== 'hidden' && st.pointerEvents !== 'none'; });
    const 이름 = el => (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0,14)
       + '(' + el.className.trim().split(/\s+/)[0] + ')';
    const 겹친것 = [];
    for(let i=0;i<것들.length;i++) for(let j=i+1;j<것들.length;j++){
      const a = 것들[i], b = 것들[j];
      if(a.contains(b) || b.contains(a)) continue;
      const p = a.getBoundingClientRect(), q = b.getBoundingClientRect();
      const w = Math.min(p.right,q.right) - Math.max(p.left,q.left);
      const h = Math.min(p.bottom,q.bottom) - Math.max(p.top,q.top);
      if(w > 2 && h > 2) 겹친것.push(이름(a) + ' ↔ ' + 이름(b)
        + '  겹친 넓이 ' + Math.round(w) + '×' + Math.round(h));
    }
    return { 수: 것들.length, 겹친것 };
  });
  T('★★★ 지도 위의 누르는 것들이 서로 안 겹친다 (' + (지도겹침.수 || 0) + '개 잼)',
    !지도겹침.없음 && (지도겹침.겹친것 || []).length === 0,
    (지도겹침.겹친것 || []).join('\n    ') || (지도겹침.없음 ? '지도를 못 찾았습니다' : ''));

  // ── 다 막힌 것 = 아예 못 누른다
  const 완전 = 모은것.filter(o => o.닿음 === 0);
  const 반쯤 = 모은것.filter(o => o.닿음 > 0);
  const 적기 = a => a.map(o => `[${o.자리}] "${o.t||'(글자 없음)'}" ${o.w}×${o.h}`
      + ` — 다섯 점 가운데 ${o.닿음}점만 닿음(밖 ${o.밖||0}점) · 위에 있는 것: ${o.덮은것}\n      ${o.s}`).join('\n    ');

  T('★★★ 아예 못 누르는 단추가 없다 (' + 완전.length + '개)', 완전.length === 0, 적기(완전));
  T('★★ 반쯤 깔린 단추가 없다 (' + 반쯤.length + '개)', 반쯤.length === 0, 적기(반쯤));
  T('★★★ 못 잰 단추가 없다 (' + 못잰것.length + '개) — 못 잰 것을 조용히 넘기면 검사가 거짓말한다',
    못잰것.length === 0,
    못잰것.map(o => `[${o.자리}] "${o.t||'(글자 없음)'}" — ${o.왜||''}\n      ${o.s}`).join('\n    '));
  T('★★★ 앱 전체에서 누르는 것들이 서로 안 겹친다 (' + 겹친것.length + '군데)',
    겹친것.length === 0, 겹친것.slice(0,25).join('\n    '));
  T('앱이 안 터졌다', errs.length === 0, errs.join(' | '));

  fs.writeFileSync(path.join(__dirname, 'tapcover.json'), JSON.stringify(모은것, null, 1));
  console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
  await br.close(); server.close();
  process.exit(bad ? 1 : 0);
})();
