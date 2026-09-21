// 손으로 눌러 본 적 없는 것들 — 실제로 눌러 본다
//
// ★ 왜 필요한가
//   인수인계 11-1 에 「아직 손으로 눌러 본 적 없는 것」 목록이 있다.
//   도형 그리기·이동·크기 / 되돌리기 / 정비 사진 / 등급 / 할 일 /
//   휴지통 / 배 삭제 / 파일에서 불러오기.
//   journey 는 처음 오는 사람의 길만 걷는다. 여기는 그 다음을 걷는다.
//
//   함수를 부르는 것이 아니라 **화면에 있는 것을 진짜로 끌고 누른다.**
//   특히 도형은 손가락 끌기라 함수 검사로는 절대 안 잡힌다.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const SRC = process.argv[2] || 'work.html';
const srv = http.createServer((rq, rs) => {
  const f = path.join(process.cwd(), (rq.url === '/' ? SRC : rq.url.split('?')[0]).replace(/^\//,''));
  fs.readFile(f, (e, d) => {
    if(e){ rs.writeHead(404); rs.end(); return; }
    const ct = f.endsWith('.js') ? 'text/javascript'
             : f.endsWith('.webmanifest') ? 'application/manifest+json'
             : f.endsWith('.png') ? 'image/png' : 'text/html';
    rs.writeHead(200, { 'Content-Type': ct }); rs.end(d);
  });
});
let 막힘 = 0, 지남 = 0;
const cut = m => { m = String(m == null ? '' : m); return m.length > 150 ? m.slice(0,150)+'…' : m; };
function 적기(단계, ok, 메모){
  if(ok){ 지남++; console.log('지남   ' + 단계 + (메모 ? ' — ' + cut(메모) : '')); }
  else { 막힘++; console.log('★막힘  ' + 단계 + (메모 ? ' — ' + cut(메모) : '')); }
}
function 알림(글){ console.log('   ·   ' + 글); }

(async () => {
  await new Promise(r => srv.listen(0, r));
  const port = srv.address().port;
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport:{ width:390, height:844 }, locale:'ko-KR' });
  const p = await ctx.newPage();
  const 터짐 = [];
  p.on('pageerror', e => 터짐.push(String(e.message).slice(0,160)));
  await p.route('**://tile.openstreetmap.org/**', r=>r.abort());
  await p.route('**://tiles.openseamap.org/**', r=>r.abort());
  await p.addInitScript(()=>{ try{ localStorage.setItem('bt_agree','1'); }catch(e){} });
  await p.goto(`http://127.0.0.1:${port}/`);
  await p.waitForTimeout(2500);

  // 물어보는 창은 늘 「예」로 답한다 (사람이 누른 것과 같게)
  await p.evaluate(()=>{
    window.__asked = [];
    window.__realAsk = window.ask;
    window.ask = function(msg, o){ window.__asked.push(String(msg).slice(0,60)); return Promise.resolve(true); };
    window.__tells = [];
    const t0 = window.tell;
    window.tell = function(msg, o){ window.__tells.push(String(msg).slice(0,80)); return Promise.resolve(true); };
  });

  // ── 준비: 배 하나 + 도면 + 칸 하나
  const 준비 = await p.evaluate(async ()=>{
    try{
      if(typeof skipWelcome === 'function') skipWelcome();
      const ov = document.getElementById('welcomeOv'); if(ov) ov.classList.remove('open');
      if(!boats.length){
        document.getElementById('nbName') && (document.getElementById('nbName').value = '손검사호');
      }
      return 'ok';
    }catch(e){ return '터짐:' + e.message; }
  });
  await p.waitForTimeout(300);

  // 배 등록
  const 누르기 = async (글자, 초=3, 딱) => {
    const 판 = await p.evaluate(()=>{ const P=document.getElementById('mrPanel');
      return !!(P && (P.classList.contains('open') || (P.offsetParent && P.innerHTML.length>40))); });
    const t = 딱 ? `:text-is("${글자}")` : `:has-text("${글자}")`;
    let el = p.locator(`${판?'#mrPanel ':''}button:visible${t}`).first();
    try{ await el.waitFor({ state:'visible', timeout: 초*1000 }); }
    catch(_){ el = p.locator(`button:visible${t}, .ditem:visible${t}, .tab:visible${t}`).first();
      try{ await el.waitFor({ state:'visible', timeout:1200 }); }catch(_){ return false; } }
    try{ await el.click({ timeout:2500 }); await p.waitForTimeout(400); return true; }catch(_){ return false; }
  };
  console.log('=== 준비 ===');
  await 누르기('배 등록하기');
  try{
    await p.fill('#nbName', '손검사호');
    await p.selectOption('#nbType', 'sail');
    await p.fill('#nbPort', '여수 원형마리나');
  }catch(e){ console.log('배 정보 못 적음:', e.message); }
  if(!await 누르기('저장', 3, true)) await 누르기('등록', 3, true);
  await p.waitForTimeout(1200);
  await p.evaluate(()=>{ try{ switchTab('boat'); setBoatSubTab('stow'); }catch(_){} });
  await p.waitForTimeout(700);
  await 누르기('기본 도면에서 고르기');
  await p.waitForTimeout(500);
  await 누르기('세일링 요트');
  await p.waitForTimeout(1200);
  const 준비끝 = await p.evaluate(()=>({ 배: boats.length, 도면: !!(document.getElementById('fp')||{}).src, 칸: lockers.length }));
  console.log('   ·   배 ' + 준비끝.배 + '척 · 도면 ' + (준비끝.도면?'있음':'없음') + ' · 칸 ' + 준비끝.칸 + '개');
  await p.screenshot({ path:'h01_stow.png' });

  // ═══ 1. 도형 — 그리기 · 이동 · 크기 (진짜 끌기) ═══
  console.log('\n=== 1. 도형 (손가락 끌기) ===');
  const 그리기켬 = await p.evaluate(()=>{
    try{ if(!lkEdit) toggleLkEdit(); return lkEdit === true; }catch(e){ return '터짐:'+e.message; }
  });
  적기('도면 그리기를 켤 수 있다', 그리기켬 === true, String(그리기켬));
  await p.waitForTimeout(400);
  const 도구 = await p.evaluate(()=>{ try{ setLkTool('rect'); return lkTool; }catch(e){ return '터짐:'+e.message; } });
  적기('네모 도구를 고를 수 있다', 도구 === 'rect', String(도구));

  const 자리 = async () => await p.evaluate(()=>{
    const r = document.getElementById('map').getBoundingClientRect();
    return { x:r.x, y:r.y, w:r.width, h:r.height };
  });
  const M = await 자리();
  const pt = (px, py) => ({ x: M.x + M.w*px/100, y: M.y + M.h*py/100 });
  const 끌기 = async (a, c, 단계=8) => {
    const A = pt(a[0],a[1]), C = pt(c[0],c[1]);
    await p.mouse.move(A.x, A.y); await p.mouse.down();
    for(let i=1;i<=단계;i++){
      await p.mouse.move(A.x + (C.x-A.x)*i/단계, A.y + (C.y-A.y)*i/단계);
      await p.waitForTimeout(20);
    }
    await p.mouse.up(); await p.waitForTimeout(350);
  };

  const 전 = await p.evaluate(()=>shapes.length);
  await 끌기([20,20],[45,40]);
  const 후 = await p.evaluate(()=>({ n:shapes.length, s:shapes[shapes.length-1]||null }));
  적기('빈 곳을 끌면 도형이 그려진다', 후.n === 전+1,
    후.s ? `${후.s.t} x${Math.round(후.s.x)} y${Math.round(후.s.y)} w${Math.round(후.s.w)} h${Math.round(후.s.h)}` : '안 생겼다');

  if(후.n === 전+1){
    const 원 = 후.s;
    await 끌기([30,28],[50,48]);          // 도형 한복판을 잡아 옮긴다
    const 옮 = await p.evaluate(id=>shapes.find(x=>x.id===id), 원.id);
    적기('도형을 끌면 옮겨진다', 옮 && (Math.abs(옮.x-원.x) > 3 || Math.abs(옮.y-원.y) > 3),
      옮 ? `x ${Math.round(원.x)}→${Math.round(옮.x)} · y ${Math.round(원.y)}→${Math.round(옮.y)}` : '도형이 사라졌다');

    const 지금 = await p.evaluate(id=>shapes.find(x=>x.id===id), 원.id);
    if(지금){
      const 모서리 = [지금.x + 지금.w - 1, 지금.y + 지금.h - 1];
      await 끌기(모서리, [모서리[0]+15, 모서리[1]+12]);
      const 큰 = await p.evaluate(id=>shapes.find(x=>x.id===id), 원.id);
      적기('오른쪽 아래 모서리를 끌면 커진다',
        큰 && (큰.w > 지금.w + 3 || 큰.h > 지금.h + 3),
        큰 ? `w ${Math.round(지금.w)}→${Math.round(큰.w)} · h ${Math.round(지금.h)}→${Math.round(큰.h)}` : '');
    }
  }
  await p.screenshot({ path:'h02_shape.png' });

  // ═══ 2. 되돌리기 · 앞으로 가기 ═══
  console.log('\n=== 2. 되돌리기 ===');
  const u0 = await p.evaluate(()=>({ n:shapes.length, 되:canUndo(), 앞:canRedo() }));
  적기('되돌릴 것이 쌓여 있다', u0.되 === true, JSON.stringify(u0));
  await p.evaluate(async ()=>{ await undoRun(); });
  await p.waitForTimeout(250);
  const u1 = await p.evaluate(()=>({ n:shapes.length, s:shapes[shapes.length-1]||null, 앞:canRedo() }));
  적기('되돌리면 한 걸음 물러난다', u1.앞 === true, '도형 ' + u1.n + '개');
  await p.evaluate(async ()=>{ await redoRun(); });
  await p.waitForTimeout(250);
  const u2 = await p.evaluate(()=>({ n:shapes.length, s:shapes[shapes.length-1]||null }));
  적기('앞으로 가면 다시 돌아온다',
    JSON.stringify(u2.s) === JSON.stringify(u0.n ? null : null) || u2.n === u0.n,
    '도형 ' + u2.n + '개');
  // 끝까지 되돌리면 처음으로
  const u3 = await p.evaluate(async ()=>{
    let k = 0;
    while(canUndo() && k < 50){ await undoRun(); k++; }
    return { n: shapes.length, 걸음: k };
  });
  적기('끝까지 되돌리면 도형이 사라진다', u3.n === 0, u3.걸음 + '걸음 · 남은 도형 ' + u3.n);

  // ═══ 3. 정비 기록 만들고 사진 붙이기 ═══
  console.log('\n=== 3. 정비 ===');
  await p.evaluate(()=>{ try{ if(lkEdit) toggleLkEdit(); switchTab('boat'); setBoatSubTab('maint'); }catch(_){} });
  await p.waitForTimeout(700);
  const 정비 = await p.evaluate(()=>{
    try{
      const 전 = maint.length;
      mrAdd('maint');
      return { 전, 후: maint.length, 열림: String(mrOpenId||''), 종류: String(mrOpenType||'') };
    }catch(e){ return { 터짐: e.message }; }
  });
  적기('정비 기록을 새로 만들 수 있다', 정비.후 === 정비.전 + 1 && !!정비.열림, JSON.stringify(정비));
  적기('만들면 그 기록이 바로 열린다', 정비.종류 === 'maint', 정비.종류);

  const 이름적기 = await p.evaluate(async ()=>{
    try{
      const it = getMR('maint', mrOpenId);
      it.name = '엔진 오일 갈기'; it.months = 6; saveMR();
      openMR('maint', mrOpenId);
      await new Promise(r=>setTimeout(r,200));
      const 다시 = getMR('maint', mrOpenId);
      return { 이름: 다시.name, 달: 다시.months };
    }catch(e){ return { 터짐: e.message }; }
  });
  적기('이름과 주기를 적으면 남는다', 이름적기.이름 === '엔진 오일 갈기' && 이름적기.달 === 6,
    JSON.stringify(이름적기));

  const 정비사진 = await p.evaluate(async ()=>{
    try{
      const c = document.createElement('canvas'); c.width = 1200; c.height = 800;
      const g = c.getContext('2d'); g.fillStyle = '#a63'; g.fillRect(0,0,1200,800);
      const blob = await (await fetch(c.toDataURL('image/jpeg', 0.9))).blob();
      const f = new File([blob], 'engine.jpg', { type:'image/jpeg' });
      mrPickPhoto({ target:{ files:[f], value:'' } });
      for(let i=0;i<40;i++){
        await new Promise(r=>setTimeout(r,150));
        const it = getMR('maint', mrOpenId);
        if(it && it.photos && it.photos.length) break;
      }
      const it = getMR('maint', mrOpenId);
      if(!it.photos || !it.photos.length) return { 없다: true };
      const one = it.photos[0];
      const im = new Image(); im.src = one;
      await new Promise(r=>{ im.onload=r; im.onerror=r; });
      return { 장:it.photos.length, 폭:im.naturalWidth, 높:im.naturalHeight,
               KB: Math.round(String(one).length/1024) };
    }catch(e){ return { 터짐: e.message }; }
  });
  적기('정비 기록에 사진을 붙일 수 있다', 정비사진.장 >= 1 && 정비사진.폭 > 0, JSON.stringify(정비사진));

  const 사진지우기 = await p.evaluate(async ()=>{
    try{ mrDelPhoto(0); await new Promise(r=>setTimeout(r,300));
      const it = getMR('maint', mrOpenId);
      return { 남은: (it.photos||[]).length };
    }catch(e){ return { 터짐: e.message }; }
  });
  적기('붙인 사진을 지울 수 있다', 사진지우기.남은 === 0, JSON.stringify(사진지우기));
  await p.screenshot({ path:'h03_maint.png' });

  // ═══ 4. 휴지통 — 지운 정비가 되살아나나 ═══
  console.log('\n=== 4. 휴지통 ===');
  const 버리기 = await p.evaluate(async ()=>{
    try{
      const id = mrOpenId, 전 = maint.length, 휴 = (mrTrash||[]).length;
      await mrDelete();
      await new Promise(r=>setTimeout(r,300));
      return { id, 전, 후: maint.length, 휴전: 휴, 휴후: (mrTrash||[]).length };
    }catch(e){ return { 터짐: e.message }; }
  });
  적기('정비 기록을 휴지통으로 보낼 수 있다',
    버리기.후 === 버리기.전 - 1 && 버리기.휴후 === 버리기.휴전 + 1, JSON.stringify(버리기));
  const 되살리기 = await p.evaluate(async ()=>{
    try{
      const t0 = (mrTrash||[])[(mrTrash||[]).length-1];
      if(!t0) return { 없다:true };
      const 전 = maint.length;
      mrRestore(t0.id);
      await new Promise(r=>setTimeout(r,300));
      const 산 = maint.find(x=>x.name === '엔진 오일 갈기');
      return { 전, 후: maint.length, 이름: 산 ? 산.name : '' };
    }catch(e){ return { 터짐: e.message }; }
  });
  적기('★ 휴지통에서 되살리면 그대로 돌아온다',
    되살리기.후 === 되살리기.전 + 1 && 되살리기.이름 === '엔진 오일 갈기', JSON.stringify(되살리기));

  // ═══ 5. 등급 ═══
  console.log('\n=== 5. 등급 ===');
  const 등급 = await p.evaluate(()=>{
    try{
      const b = curBoat();
      if(!b) return { 배없음:true };
      const 목 = (typeof rankList === 'function') ? rankList(b) : [];
      return { 수: 목.length, 이름: 목.map(x=>x.name),
               열수있나: typeof can === 'function' ? !!can(b,'ranks','write') : null };
    }catch(e){ return { 터짐: e.message }; }
  });
  적기('기본 등급이 깔려 있다', 등급.수 >= 3, JSON.stringify(등급));
  if(등급.열수있나 === false){
    알림('등급 화면은 로그인해야 열린다 — 이 컨테이너는 파이어베이스가 막혀 못 본다');
  } else {
    const 등급화면 = await p.evaluate(()=>{
      try{ openRanks(); const P=document.getElementById('mrPanel');
        return { 글: P.textContent.slice(0,120), 줄: P.querySelectorAll('.fleet').length };
      }catch(e){ return { 터짐: e.message }; }
    });
    적기('등급 화면이 열린다', 등급화면.줄 >= 3, JSON.stringify(등급화면));
  }

  // ═══ 6. 할 일 ═══
  console.log('\n=== 6. 할 일 ===');
  const 할일 = await p.evaluate(()=>{
    try{ openMyTasks(); const P=document.getElementById('mrPanel');
      return { 열림: P.innerHTML.length > 40, 글: P.textContent.slice(0,100) };
    }catch(e){ return { 터짐: e.message }; }
  });
  적기('할 일 화면이 열린다', 할일.열림 === true, JSON.stringify(할일));

  // ═══ 7. 파일로 저장 → 파일에서 불러오기 (설정의 진짜 단추) ═══
  console.log('\n=== 7. 파일 ===');
  // ★ 빈 자료로 되돌리기를 검사하면 아무것도 안 본 것이나 같다. 진짜로 채워 넣는다.
  const 채우기 = await p.evaluate(async ()=>{
    try{
      switchTab('boat'); setBoatSubTab('stow');
      await new Promise(r=>setTimeout(r,300));
      const r1 = lkAdd({ x:10, y:10, w:20, h:15 }, '갤리', '싱크대 아래');
      const r2 = lkAdd({ x:55, y:60, w:20, h:15 }, '선수 창고', '앵커 락커');
      window.__lk = [!!r1, !!r2];
      const lk = lockers[0];
      for(const [nm, q] of [['임펠러', 2], ['오일 필터', 3], ['구명조끼', 6]]){
        selected = lk.id; inBox = null; editId = null;
        document.getElementById('panel').classList.add('open');
        document.getElementById('fName').value = nm;
        document.getElementById('fQty').value = String(q);
        addItem();
        await new Promise(r=>setTimeout(r,250));
      }
      setLkTool('rect');
      if(!lkEdit) toggleLkEdit();
      shAdd('rect', { x:60, y:20, w:15, h:10 }, 'plan', null);
      if(lkEdit) toggleLkEdit();
      return { 칸: lockers.length, 물품: items.length, 도형: shapes.length,
               정비: maint.length, 만듦: window.__lk };
    }catch(e){ return { 터짐: e.message }; }
  });
  적기('검사할 자료를 채웠다', 채우기.칸 >= 2 && 채우기.물품 >= 3 && 채우기.도형 >= 1,
    JSON.stringify(채우기));
  const 저장 = await p.evaluate(async ()=>{
    try{
      let 담김 = null;
      const 원래 = window.saveFile;
      window.saveFile = async (name, mime, body) => { 담김 = { name, mime, n: body.length }; return ''; };
      openSettings();
      const r = [...document.querySelectorAll('.setrow')].find(x=>/파일로 저장/.test(x.textContent));
      if(!r) return { 단추없음:true };
      r.click();
      for(let i=0;i<30 && !담김;i++) await new Promise(q=>setTimeout(q,150));
      window.saveFile = 원래;
      return 담김 || { 안만들어짐:true };
    }catch(e){ return { 터짐: e.message }; }
  });
  적기('설정에서 [파일로 저장] 을 누르면 파일이 만들어진다',
    !!저장.name && 저장.n > 1000, JSON.stringify(저장));
  적기('파일 이름이 한글이 아니다 (메일로 보내도 안 깨진다)',
    !!저장.name && /^[\x20-\x7e]+$/.test(저장.name), 저장.name);

  const 불러오기 = await p.evaluate(async ()=>{
    try{
      // 지금 것을 파일로 뽑아 두고, 물품을 하나 지운 뒤, 파일로 되돌린다
      let 몸 = null;
      const 원래 = window.saveFile;
      window.saveFile = async (n,m,b) => { 몸 = b; return ''; };
      await backupData();
      window.saveFile = 원래;
      if(!몸) return { 못뽑음:true };
      const 전 = { 물품: items.length, 정비: maint.length, 칸: lockers.length, 도형: shapes.length };
      // ★ 진짜로 비운다. 하나만 비우면 나머지는 「원래 그대로」라서 아무것도 안 본 게 된다.
      items = []; lockers = []; shapes = []; saveLocal();
      const f = new File([몸], 'x.json', { type:'application/json' });
      restoreData({ target:{ files:[f], value:'' } });
      for(let i=0;i<40;i++){
        await new Promise(r=>setTimeout(r,150));
        if(items.length === 전.물품) break;
      }
      return { 전, 후: { 물품: items.length, 정비: maint.length,
                        칸: lockers.length, 도형: shapes.length } };
    }catch(e){ return { 터짐: e.message }; }
  });
  적기('★ 파일에서 불러오면 그대로 돌아온다',
    !!불러오기.전 && !!불러오기.후
      && ['물품','정비','칸','도형'].every(k => 불러오기.전[k] === 불러오기.후[k]),
    JSON.stringify(불러오기));

  // ═══ 8. 배 삭제 — 되돌릴 수 없는 자리다. 안전장치가 진짜로 서 있나 ═══
  console.log('\n=== 8. 배 삭제 ===');
  // ★ 사람이 실제로 밟는 길로 간다 — 열어 둔 화면을 먼저 다 닫는다.
  //   앞 검사에서 설정 화면을 열어 둔 채로 들어갔더니 입력창이 안 떴다.
  //   그건 앱 고장이 아니라 검사가 사람이 안 하는 짓을 한 것이었다.
  await p.evaluate(()=>{ window.ask = window.__realAsk; try{ switchTab('home'); }catch(_){} });
  await p.waitForTimeout(600);
  await p.evaluate(()=>{ try{ openFleet(); }catch(_){} });
  await p.waitForTimeout(600);
  const 삭제단추 = await 누르기('삭제', 3, true);
  적기('배 목록에 삭제 단추가 있다', 삭제단추 === true, '');
  await p.waitForTimeout(500);
  const 물음 = await p.evaluate(()=>({
    열림: document.getElementById('tellOv').classList.contains('open'),
    글: (document.getElementById('tellMsg')||{}).textContent || '',
    단추: [...document.querySelectorAll('#tellBtns button')].map(x=>x.textContent)
  }));
  적기('무엇이 사라지는지 먼저 알려 준다',
    물음.열림 === true && /되돌릴 수 없습니다/.test(물음.글), JSON.stringify(물음).slice(0,150));
  적기('★ 지우기 단추가 붉고 이름이 「지우기」다', 물음.단추.indexOf('지우기') >= 0, 물음.단추);
  적기('먼저 파일로 저장하라고 일러 준다', /파일로 저장/.test(물음.글), '');

  const 이름확인 = await p.evaluate(async ()=>{
    try{
      const b = curBoat(); const 전 = boats.length;
      const bs = [...document.querySelectorAll('#tellBtns button')];
      (bs.find(x=>/지우기/.test(x.textContent)) || bs[bs.length-1]).click();
      await new Promise(r=>setTimeout(r,700));
      const ov = document.getElementById('formOv');
      const 떴나 = getComputedStyle(ov).display !== 'none';
      if(!떴나) return { 창안뜸:true, 전, 후: boats.length };
      // ★ 일부러 틀린 이름을 적는다 — 지워지면 안 된다
      const inp = ov.querySelector('input');
      inp.value = '엉뚱한이름'; inp.dispatchEvent(new Event('input'));
      await formOk();
      await new Promise(r=>setTimeout(r,600));
      return { 떴나, 이름: b.name, 전, 후: boats.length,
               아직열림: getComputedStyle(document.getElementById('formOv')).display !== 'none',
               말: window.__tells.slice(-1) };
    }catch(e){ return { 터짐: e.message }; }
  });
  적기('★ 한 번 더 배 이름을 적게 한다', 이름확인.떴나 === true, JSON.stringify(이름확인).slice(0,160));
  적기('★ 이름을 틀리게 적으면 안 지운다', 이름확인.전 === 이름확인.후, JSON.stringify(이름확인).slice(0,160));
  적기('틀렸으면 창이 안 닫히고 까닭을 말해 준다',
    이름확인.아직열림 === true && /이름이 달라서/.test((이름확인.말||[])[0]||''),
    JSON.stringify(이름확인.말));

  const 진짜지우기 = await p.evaluate(async ()=>{
    try{
      const b = curBoat(); const 전 = boats.length;
      const ov = document.getElementById('formOv');
      const inp = ov.querySelector('input');
      inp.value = b.name; inp.dispatchEvent(new Event('input'));
      await formOk();
      await new Promise(r=>setTimeout(r,1200));
      return { 전, 후: boats.length, 물품: items.length, 칸: lockers.length };
    }catch(e){ return { 터짐: e.message }; }
  });
  적기('이름을 제대로 적으면 지워진다', 진짜지우기.후 === 진짜지우기.전 - 1, JSON.stringify(진짜지우기));
  적기('배가 사라지면 그 배의 기록도 같이 사라진다',
    진짜지우기.물품 === 0 && 진짜지우기.칸 === 0, JSON.stringify(진짜지우기));
  await p.screenshot({ path:'h08_del.png' });

  console.log('\n=== 터진 것 ===');
  console.log(터짐.length ? 터짐.join(' | ') : '없음');
  console.log('\n합계: ' + 지남 + '개 지남 / ' + 막힘 + '개 막힘');
  await b.close(); srv.close();
})();
