// ══════════════════════════════════════════════════════════════════════
// 「아직 손으로 눌러 본 적 없는 것」 (2.5 인수인계 14-1) 을 실제로 눌러 본다
//   도면 창고 · 칸 그리기 · 되돌리기/다시 실행 · 배 삭제
//
// ★ 여기서 겪은 함정 (검사를 쓰는 사람에게)
//   `#dgPick` 은 position:fixed 다. fixed 요소는 **offsetParent 가 언제나 null** 이라
//   「안 열렸다」 고 잘못 읽는다. 열렸는지는 getComputedStyle().display 로 본다.
//   실제로 이것 때문에 멀쩡한 화면을 한 번 고장으로 오해했다.
// ══════════════════════════════════════════════════════════════════════
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const FILE = process.argv[2] || path.join(__dirname, '..', '..', 'work.html');
const SRC = path.isAbsolute(FILE) ? FILE : path.join(__dirname, FILE);
const ROOT = path.dirname(SRC);
const MIME = {'.html':'text/html','.js':'text/javascript','.json':'application/json','.woff2':'font/woff2','.png':'image/png'};
const srv = http.createServer((rq, rs) => { const u = rq.url.split('?')[0];
  const f = (u === '/') ? SRC : path.join(ROOT, u);
  fs.readFile(f, (e, d) => { if(e){ rs.writeHead(404); rs.end(); return; }
    rs.writeHead(200, {'content-type': MIME[path.extname(f)] || 'application/octet-stream'}); rs.end(d); }); });
let ok = 0, bad = 0;
const T = (n, c, x) => { if(c){ ok++; console.log('통과: ' + n); }
  else { bad++; console.log('★ 실패: ' + n + (x === undefined ? '' : ' — ' + JSON.stringify(x).slice(0,260))); } };

(async () => {
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const port = srv.address().port;
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport:{width:412,height:820}, hasTouch:true, isMobile:true });
  const pg = await ctx.newPage();
  const errs = [];
  pg.on('pageerror', e => errs.push(String(e.message).slice(0,140)));
  try{
    await pg.addInitScript(() => {
      try{ localStorage.setItem('bt_setup','done'); localStorage.setItem('bt_welcome','done');
           localStorage.setItem('bt_lang','ko'); localStorage.setItem('bt_cc','KR'); }catch(_){}
      window.__user = { uid:'U1', name:'김명준', email:'a@b.c' };
    });
    await pg.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'load' });
    await pg.waitForTimeout(3500);
    await pg.evaluate(() => { try{ me = { uid:'U1', name:'김명준' }; }catch(_){}
      try{ applyAccount && applyAccount(); }catch(_){} openBoatSetup(); });
    await pg.waitForTimeout(700);
    await pg.fill('#nbName', '선샤인');
    await pg.evaluate(() => createBoat());
    await pg.waitForTimeout(1200);
    await pg.evaluate(() => { boatSubTab='stow'; switchTab('boat'); });
    await pg.waitForTimeout(900);

    // ── ① 도면이 없을 때 세 가지 길을 다 보여 준다
    const 첫 = await pg.evaluate(() => {
      const W = document.getElementById('mapWrap');
      return { 글: (W.innerText||'').replace(/\s+/g,' ').trim(),
               단추: [...W.querySelectorAll('button')].map(x=>(x.innerText||'').trim()).filter(Boolean) };
    });
    T('★ 도면이 없으면 왜 비었는지 말한다', /평면도가 아직 없습니다/.test(첫.글), 첫.글.slice(0,100));
    ['기본 도면에서 선택','도면 사진 올리기','공개 도면에서 선택'].forEach(n =>
      T('길을 준다 — ' + n, 첫.단추.indexOf(n) >= 0, 첫.단추));

    // ── ② 도면 창고가 열린다 (fixed 요소라 display 로 본다)
    const 창고 = await pg.evaluate(async () => {
      dgPickBuiltin('plan');
      await new Promise(r=>setTimeout(r,1200));
      const el = document.getElementById('dgPick');
      return { 열림: !!(el && getComputedStyle(el).display !== 'none'),
               카드: el ? el.querySelectorAll('.dgCard').length : 0,
               내배선종: el ? /내 배 선종/.test(el.innerText||'') : false };
    });
    T('★★★ 「기본 도면에서 선택」이 도면 창고를 연다', 창고.열림, 창고);
    T('★ 고를 도면이 들어 있다', 창고.카드 >= 3, 창고);
    T('★ 내 배 선종을 맨 앞에 올려 준다', 창고.내배선종, 창고);

    // ── ③ 하나 고르면 도면이 깔린다
    const 깔림 = await pg.evaluate(async () => {
      const card = document.querySelectorAll('#dgPick .dgCard')[0];
      if(!card) return { 카드없음:true };
      card.click();
      await new Promise(r=>setTimeout(r,2200));
      const el = document.getElementById('dgPick');
      return { 창닫힘: !!(el && getComputedStyle(el).display === 'none'),
               지도글: (document.getElementById('mapWrap').innerText||'').replace(/\s+/g,' ').trim().slice(0,120) };
    });
    T('★★★ 도면을 고르면 창이 닫히고 도면이 깔린다',
      깔림.창닫힘 && /선수|선미|좌현|우현/.test(깔림.지도글||''), 깔림);

    // ── ④ 칸 그리기 → 네모 하나 → 「새 수납칸」 창
    await pg.evaluate(() => { const x=[...document.querySelectorAll('#stowTools button,#mapWrap button')]
      .find(e=>/칸 그리기/.test(e.innerText)); if(x) x.click(); });
    await pg.waitForTimeout(600);
    T('★ 「칸 그리기」가 그리기 모드를 켠다', await pg.evaluate(() => (typeof lkEdit!=='undefined') && lkEdit === true));

    await pg.evaluate(async () => {
      const m = document.getElementById('map');
      const r = m.getBoundingClientRect();
      const mk = (type, x, y) => new PointerEvent(type, { bubbles:true, cancelable:true,
        clientX:x, clientY:y, pointerId:1, pointerType:'touch', isPrimary:true, buttons:1 });
      const x0 = r.left + r.width*0.35, y0 = r.top + r.height*0.35;
      const x1 = r.left + r.width*0.60, y1 = r.top + r.height*0.60;
      m.dispatchEvent(mk('pointerdown', x0, y0));
      for(let k=1;k<=8;k++){
        m.dispatchEvent(mk('pointermove', x0+(x1-x0)*k/8, y0+(y1-y0)*k/8));
        await new Promise(r=>setTimeout(r,40));
      }
      m.dispatchEvent(mk('pointerup', x1, y1));
      await new Promise(r=>setTimeout(r,800));
    });
    await pg.waitForTimeout(700);
    const 폼 = await pg.evaluate(() => {
      const f = document.getElementById('formOv');
      return { 열림: !!(f && getComputedStyle(f).display !== 'none'),
               글: f ? (f.innerText||'').replace(/\s+/g,' ').trim().slice(0,140) : '' };
    });
    T('★★★ 네모를 그리면 「새 수납칸」 창이 뜬다', 폼.열림 && /새 수납칸/.test(폼.글), 폼);
    T('★ 이름을 안 넣고 만들 수는 없게 묻는다', /칸 이름/.test(폼.글) && /구역/.test(폼.글), 폼.글);

    const 만듦 = await pg.evaluate(async () => {
      const a = document.getElementById('ff0'), b2 = document.getElementById('ff1');
      if(a){ a.value = '싱크대 아래'; a.dispatchEvent(new Event('input',{bubbles:true})); }
      if(b2){ b2.value = '갤리'; b2.dispatchEvent(new Event('input',{bubbles:true})); }
      const go = document.querySelector('#formFoot .fbtn.go'); if(go) go.click();
      await new Promise(r=>setTimeout(r,1100));
      return { n: (typeof lockers!=='undefined') ? lockers.length : -1,
               이름: (typeof lockers!=='undefined' && lockers[0]) ? lockers[0].label : '' };
    });
    T('★★★ 수납칸이 실제로 생긴다', 만듦.n === 1 && 만듦.이름 === '싱크대 아래', 만듦);

    // ── ⑤ 되돌리기 · 다시 실행
    const undo = await pg.evaluate(async () => {
      const x=[...document.querySelectorAll('#stowTools button')].find(e=>/↶/.test(e.innerText));
      if(!x) return { 없음:true }; x.click(); await new Promise(r=>setTimeout(r,900));
      return { n:(typeof lockers!=='undefined')?lockers.length:-1 };
    });
    T('★★★ 되돌리기가 방금 만든 칸을 물린다', undo.n === 0, undo);
    const redo = await pg.evaluate(async () => {
      const x=[...document.querySelectorAll('#stowTools button')].find(e=>/↷/.test(e.innerText));
      if(!x) return { 없음:true }; x.click(); await new Promise(r=>setTimeout(r,900));
      return { n:(typeof lockers!=='undefined')?lockers.length:-1 };
    });
    T('★★★ 다시 실행이 도로 살린다', redo.n === 1, redo);

    // ── ⑥ 배 삭제 — 무엇이 사라지는지 먼저 말해 준다
    await pg.evaluate(() => openBoatSetup());
    await pg.waitForTimeout(700);
    await pg.fill('#nbName', '두번째배');
    await pg.evaluate(() => createBoat());
    await pg.waitForTimeout(1400);
    await pg.evaluate(() => { try{ items.push({ id:newId(), name:'시험물품', qty:1 }); saveLocal(); }catch(_){} });
    const 물음 = await pg.evaluate(async () => {
      openFleet(); await new Promise(r=>setTimeout(r,900));
      const row = [...document.querySelectorAll('#mrPanel .fleet')].find(r=>/두번째배/.test(r.innerText));
      if(!row) return { 줄없음:true };
      const del = [...row.querySelectorAll('button')].find(x=>/삭제/.test(x.innerText));
      if(!del) return { 단추없음: [...row.querySelectorAll('button')].map(x=>x.innerText.trim()) };
      del.click(); await new Promise(r=>setTimeout(r,1000));
      return { 글: (document.body.innerText||'').replace(/\s+/g,' ').slice(-320) };
    });
    T('★ 배 목록에 삭제 단추가 있다', !물음.단추없음 && !물음.줄없음, 물음);
    T('★★★ 무엇이 사라지는지 먼저 말한다',
      /물품 .*개/.test(물음.글||'') && /정비.*수리.*항해일지/.test(물음.글||''), (물음.글||'').slice(-200));
    T('★★★ 되돌릴 수 없다고 말한다', /되돌릴 수 없습니다/.test(물음.글||''));
    T('★★★ 먼저 파일로 저장하라고 권한다', /파일로 저장/.test(물음.글||''));

    T('여기까지 터진 곳이 없다', errs.length === 0, errs.slice(0,3));
  }catch(e){
    bad++; console.log('★ 실패: 검사가 도중에 멈췄습니다 — ' + (e && e.message));
  }
  await b.close(); srv.close();
  console.log(`\n${ok}/${ok+bad} 통과`);
  process.exit(bad ? 1 : 0);
})();
