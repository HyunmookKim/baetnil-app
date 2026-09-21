// 연재 글 올리기 — 진짜 브라우저에서 눌러 본다.
// ★ 사고: "올리기를 눌렀는데 목록에 안 나온다" (4.16).
//   소스만 보는 검사 27개는 다 통과했다. 실제로 눌러 봐야 잡힌다.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const FILE = process.argv[2] || 'work.html';
const server = http.createServer((rq,rs)=>{
  const f = ((rq.url === '/' && path.isAbsolute(FILE)) ? FILE : path.join(__dirname, rq.url === '/' ? FILE : rq.url.split('?')[0]));
  fs.readFile(f,(e,d)=>{ if(e){rs.writeHead(404);rs.end();return;}
    if(f.endsWith('.woff2')) rs.setHeader('Content-Type','font/woff2');
    rs.writeHead(200); rs.end(d); });
});
let ok=0,bad=0;
const T=(n,c,w)=>{ if(c){ok++;console.log('통과: '+n);} else {bad++;console.log('★ 실패: '+n+(w!==undefined?' — '+JSON.stringify(w).slice(0,200):''));} };

(async ()=>{
  await new Promise(r=>server.listen(0,r));
  const br = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await br.newContext({ locale:'ko-KR', viewport:{width:390,height:800}, isMobile:true, hasTouch:true });
  const pg = await ctx.newPage();
  const errs=[]; pg.on('pageerror', e=>errs.push(String(e)));
  const said=[]; pg.on('dialog', d=>{ said.push(d.message()); d.accept(); });
  // ★ 4.37 부터 앱은 브라우저 창이 아니라 자기 창으로 말한다(tell).
  //   page.on('dialog') 로는 안 잡히므로, 앱의 tell 을 감싸 밖으로 넘긴다.
  await pg.exposeFunction('__toldTest', m => { said.push(String(m)); });
  await pg.addInitScript(()=>{
    const iv = setInterval(()=>{
      if(typeof window.tell === 'function' && !window.tell.__wrapped){
        const orig = window.tell;
        const w = function(m, o){ try{ window.__toldTest(String(m)); }catch(e){} return orig(m, o); };
        w.__wrapped = true; window.tell = w; clearInterval(iv);
      }
    }, 20);
  });

  await pg.goto('http://127.0.0.1:'+server.address().port+'/', { waitUntil:'networkidle' });
  await pg.waitForTimeout(900);

  // 연재 권한이 있는 사람 + 가짜 창고
  await pg.evaluate(()=>{
    try{ skipWelcome(); }catch(_){}
    window.__user = { uid:'U1', email:'a@b.c', name:'김명준' };
    adminMe = { uid:'U1', owner:true, perms:{ series:true } };
    window.__store = { db: [], put: async()=>({ ok:false }) };
    window.__DB = [];                       // 서버에 실제로 들어간 것
    window.__ERR = 0;                       // list 를 몇 번 실패시킬까
    window.__series = {
      list: async()=>{ if(window.__ERR>0){ window.__ERR--; throw new Error('가짜 끊김'); }
                       return window.__DB.map(x=>Object.assign({},x)); },
      put:  async(b)=>{ window.__DB = window.__DB.filter(x=>x.id!==b.id).concat([b]); },
      del:  async(id)=>{ window.__DB = window.__DB.filter(x=>String(x.id)!==String(id)); }
    };
    seriesList = null;
  });
  T('연재 권한이 켜졌다', await pg.evaluate(()=>canSeries()===true));

  // ── 연재 탭을 연다
  //   ★ 4.134 — 「새로 쓰기」 단추가 화면 안에서 오른쪽 아래 한 자리(FAB)로 모였다.
  //     연재 올리기도 #newsWrap 안이 아니라 #fabHost 의 둥근 단추가 되었다.
  await pg.evaluate(()=>{ unlocked = true; setComSub('news'); setNewsSub('sr'); paintFab(); });
  await pg.waitForTimeout(700);
  const 팹 = await pg.evaluate(()=>({
    할일: (typeof fabActs==='function' ? fabActs() : []),
    단추: !!document.querySelector('#fabHost button.fab'),
    이름: (document.querySelector('#fabHost button.fab')||{}).getAttribute
          ? document.querySelector('#fabHost button.fab').getAttribute('aria-label') : '',
    안쪽: !!document.querySelector('#newsWrap button[onclick*="writeSeries()"]')
  }));
  T('올리기 단추가 화면에 있다', 팹.단추 === true, 팹);
  T('★ 이 화면에서 새로 쓰는 것은 「연재 글 올리기」 하나다',
    팹.할일.length === 1 && 팹.할일[0][1] === 'writeSeries()', 팹.할일);
  T('★ 단추에 무엇을 하는 것인지 이름이 붙어 있다', 팹.이름 === '+ 연재 글 올리기', 팹.이름);
  T('★ 옛 자리(목록 안)에는 단추가 남아 있지 않다', 팹.안쪽 === false, 팹);

  // ── 진짜로 눌러서 글쓰기 창을 연다
  await pg.click('#fabHost button.fab');
  await pg.waitForTimeout(500);
  T('글쓰기 창이 열린다',
    await pg.evaluate(()=>(document.getElementById('formOv').style.display||'')==='flex'));

  // ── 직접 쓴 글로 채운다 (기본값이 '직접 쓴 글')
  // 칸 차례: 0 어떤 글 · 1 연재 이름 · 2 몇 편 · 3 제목 · 4 저자 · 5 원제 · 6 매체 · 7 링크 · 8 본문
  T('연재 이름 칸이 화면에 있다',
    await pg.evaluate(()=>/연재 이름/.test(document.getElementById('formBody').innerText)));
  const fill = await pg.evaluate(()=>{
    const set = (i,v)=>{ const el=document.getElementById('ff'+i);
      if(!el) return 'no:ff'+i; el.value=v; el.dispatchEvent(new Event('input',{bubbles:true})); return 'ok'; };
    return { sname:set(1,'바다 이야기'), no:set(2,'1'),
             title:set(3,'첫 번째 이야기'), author:set(4,'김명준') };
  });
  T('칸을 채울 수 있다', Object.values(fill).every(v=>v==='ok'), fill);

  // 본문 — 편집기에 직접 넣는다
  const body = await pg.evaluate(()=>{
    const q = (typeof QL!=='undefined' ? QL : {})['ff8'];
    if(q && q.setText){ q.setText('본문입니다.\n'); return 'quill'; }
    const e=document.querySelector('#ff8 .ql-editor'); if(e){ e.innerHTML='<p>본문입니다.</p>'; return 'dom'; }
    return 'none';
  });
  T('본문을 넣을 수 있다', body!=='none', body);
  await pg.waitForTimeout(200);

  // ── 올리기를 진짜로 누른다
  said.length = 0;
  const okBtn = await pg.$('#formOv button.ok, #formOv .formfoot button:last-child');
  if(okBtn) await okBtn.click(); else await pg.evaluate(()=>formOk());
  await pg.waitForTimeout(1200);

  const st1 = await pg.evaluate(()=>({
    db: window.__DB.length,
    cache: (seriesList||[]).length,
    shown: (document.getElementById('newsList')||{}).innerText || '',
    panel: (document.getElementById('mrPanel')||{}).innerText || ''
  }));
  T('서버에 글이 들어갔다', st1.db===1, st1.db);
  T('아무 말썽 없이 넘어갔다', said.length===0, said);
  T('목록 딸림칸에 글이 담겼다', st1.cache===1, st1.cache);
  T('화면 목록에 제목이 보인다',
    /첫 번째 이야기/.test(st1.shown) || /첫 번째 이야기/.test(st1.panel), {l:st1.shown.slice(0,120), p:st1.panel.slice(0,120)});
  T('연재 이름이 같이 저장됐다',
    await pg.evaluate(()=>window.__DB[0].sname==='바다 이야기'),
    await pg.evaluate(()=>window.__DB[0].sname));

  // ── 묶음 — 두 연재 · 다섯 편 · 이름 없는 옛 글까지
  await pg.evaluate(()=>{
    const mk = (id, sname, no, title, ts) => ({ id, sname, no, title, mine:true,
      author:'김명준', body:'글', blocks:[], photos:[], thumbs:[], by:'U1', date:ts, ts });
    window.__DB = [
      mk('a3','바다 이야기',3,'셋째 편','2026-08-20T00:00:00Z'),
      mk('a1','바다 이야기',1,'첫째 편','2026-08-10T00:00:00Z'),
      mk('a2','바다 이야기',2,'둘째 편','2026-08-15T00:00:00Z'),
      mk('b2','돛 다루기',   2,'돛 둘',  '2026-08-24T00:00:00Z'),
      mk('b1','돛 다루기',   1,'돛 하나','2026-08-22T00:00:00Z'),
      Object.assign(mk('z1','',0,'옛날 글','2026-07-01T00:00:00Z'), { sname: undefined })
    ];
    seriesList = null;
  });
  const G = await pg.evaluate(async ()=>{
    await loadSeries(true);
    return seriesGroups().map(g=>({ name:g.name, items:g.items.map(x=>x.id) }));
  });
  T('연재 이름으로 묶인다', G.length===3, G);
  T('묶음 안은 편 번호 차례다',
    JSON.stringify((G.find(g=>g.name==='바다 이야기')||{}).items)===JSON.stringify(['a1','a2','a3']), G);
  T('최근에 글이 올라온 연재가 위다', G[0] && G[0].name==='돛 다루기', G.map(g=>g.name));
  T('이름 없는 옛 글은 맨 아래 한 묶음이다',
    G[G.length-1] && G[G.length-1].name==='' && G[G.length-1].items.length===1, G);

  await pg.evaluate(()=>{ newsSub='sr'; renderNews(); });
  await pg.waitForTimeout(600);
  const lst = await pg.evaluate(()=>document.getElementById('newsList').innerText);
  T('화면에 연재 이름 머리줄이 뜬다', /돛 다루기/.test(lst) && /바다 이야기/.test(lst), lst.slice(0,200));
  T('묶지 않은 글 자리가 있다', /묶지 않은 글/.test(lst), lst.slice(0,300));
  T('화면에서도 첫째 편이 셋째 편보다 위다',
    lst.indexOf('첫째 편') < lst.indexOf('셋째 편') && lst.indexOf('첫째 편')>=0,
    { a:lst.indexOf('첫째 편'), c:lst.indexOf('셋째 편') });

  // ── 글을 열면 같은 연재의 다른 편이 아래에 붙는다
  await pg.evaluate(()=>openSeries('a2'));
  await pg.waitForTimeout(500);
  const pan = await pg.evaluate(()=>document.getElementById('mrPanel').innerText);
  T('글 아래에 같은 연재의 다른 편이 나온다',
    /첫째 편/.test(pan) && /셋째 편/.test(pan), pan.slice(-220));
  T('다른 연재의 편은 안 섞인다', !/돛 하나/.test(pan) && !/옛날 글/.test(pan), pan.slice(-220));
  T('지금 보는 편은 눌러도 안 넘어간다',
    await pg.evaluate(()=>{
      const r=[...document.querySelectorAll('#mrPanel .srrow')];
      const now=r.filter(x=>x.classList.contains('srnow'));
      return now.length===1 && !now[0].getAttribute('onclick') && /둘째 편/.test(now[0].innerText); }));
  T('다른 편을 누르면 그 글로 넘어간다',
    await pg.evaluate(async ()=>{
      const r=[...document.querySelectorAll('#mrPanel .srrow')].find(x=>/셋째 편/.test(x.innerText));
      if(!r) return false; r.click(); await new Promise(z=>setTimeout(z,400));
      return /셋째 편/.test(document.querySelector('#mrPanel .mrhead b').innerText); }));

  // 혼자인 연재에는 안 붙인다 — 아무 쓸모 없는 목록이 붙으면 지저분하다
  T('혼자인 연재에는 다른 편 목록이 안 붙는다',
    await pg.evaluate(()=>seriesAlso({ id:'z1', sname:'' })==='' ? false : true) === false
    || await pg.evaluate(()=>seriesAlso({ id:'z1' })===''));

  // ── 이미 있는 연재 이름을 단추로 준다
  T('연재 이름 단추가 이미 있는 이름을 준다',
    await pg.evaluate(()=>{ const n=seriesNames();
      return n.indexOf('바다 이야기')>=0 && n.indexOf('돛 다루기')>=0 && n.indexOf('')<0; }),
    await pg.evaluate(()=>seriesNames()));

  // ── ★ 사고 재현: 올린 직후 목록 다시 받기가 한 번 끊긴다
  await pg.evaluate(()=>{ window.__DB=[]; seriesList=null; window.__ERR=0; });
  await pg.evaluate(()=>{ newsSub='sr'; renderNews(); });
  await pg.waitForTimeout(500);

  await pg.evaluate(()=>{ window.__ERR = 1; });     // 다음 list 한 번만 실패
  said.length = 0;
  await pg.evaluate(async ()=>{
    await window.__series.put({ id:'sr_x', no:2, mine:true, title:'둘째 이야기',
      author:'김명준', body:'글', blocks:[], photos:[], thumbs:[], by:'U1',
      date:new Date().toISOString(), ts:new Date().toISOString() });
  });
  const after = await pg.evaluate(async ()=>{
    window.__ERR = 1;                  // 다시 받기가 끊긴다
    const rows = await loadSeries(true);
    const again = await loadSeries();  // 인터넷이 돌아온 뒤 다시 본다
    return { first: rows.length, again: again.length };
  });
  T('★ 한 번 끊겨도 다음에는 다시 받아 온다', after.again===1, after);

  // ── ★ 사고 재현 ②: 저장이 매달린다 (사진 올리다 멈춰 글을 통째로 잃었다)
  const nw = await pg.evaluate(async ()=>{
    const out = {};
    out.pass = await netWait(Promise.resolve(7), 5);
    const t0 = Date.now();
    try{ await netWait(new Promise(()=>{}), 0.4); out.hung = 'NO ERROR'; }
    catch(e){ out.hung = String(e.message||e); }
    out.ms = Date.now() - t0;
    return out;
  });
  T('멀쩡한 저장은 그대로 통과한다', nw.pass===7, nw.pass);
  T('매달리면 끝을 두고 오류를 던진다', /인터넷/.test(nw.hung), nw.hung);
  T('기다리는 시간 안에 끝난다', nw.ms >= 350 && nw.ms < 2500, nw.ms);

  // 저장이 실패하면 — 말해 주고, 쓰던 창을 그대로 도로 연다
  await pg.evaluate(()=>{
    window.__series.put = async()=>{ throw new Error('인터넷이 느려 끝내지 못했습니다.'); };
    seriesList = null; window.__DB = [];
  });
  await pg.evaluate(()=>{ closeBoat(); unlocked = true; setNewsSub('sr'); paintFab(); });
  await pg.waitForTimeout(500);
  T('★ 글을 보고 돌아와도 올리기 단추가 제자리에 있다',
    await pg.evaluate(()=>!!document.querySelector('#fabHost button.fab')));
  await pg.click('#fabHost button.fab');
  await pg.waitForTimeout(500);
  await pg.evaluate(()=>{
    const set=(i,v)=>{ const e=document.getElementById('ff'+i);
      if(e){ e.value=v; e.dispatchEvent(new Event('input',{bubbles:true})); } };
    set(1,'바다 이야기'); set(2,'4'); set(3,'넷째 편'); set(4,'김명준');
    const q=(typeof QL!=='undefined' ? QL : {})['ff8'];
    if(q&&q.setText) q.setText('안 날아가야 한다\n');
    else { const e=document.querySelector('#ff8 .ql-editor'); if(e) e.innerHTML='<p>안 날아가야 한다</p>'; }
  });
  await pg.waitForTimeout(400);
  T('본문이 편집기에 들어갔다',
    await pg.evaluate(()=>JSON.stringify(qlRead('ff8')||[]).indexOf('안 날아가야 한다')>=0),
    await pg.evaluate(()=>JSON.stringify(qlRead('ff8')||[])));
  said.length = 0;
  await pg.evaluate(()=>formOk());
  await pg.waitForTimeout(900);
  T('실패하면 사람에게 말한다', said.some(m=>/올리지 못했습니다/.test(m)), said);
  const back = await pg.evaluate(()=>({
    open: (document.getElementById('formOv').style.display||'')==='flex',
    title: (document.getElementById('ff3')||{}).value,
    sname: (document.getElementById('ff1')||{}).value,
    body: JSON.stringify(qlRead('ff8')||[])
  }));
  T('★ 실패해도 쓰던 창이 도로 열린다', back.open===true, back);
  T('★ 쓴 글이 안 날아간다',
    back.title==='넷째 편' && back.sname==='바다 이야기' && /안 날아가야 한다/.test(back.body), back);

  T('페이지 오류가 없다', errs.length===0, errs.slice(0,3));

  console.log(`\n합계: ${ok}개 통과 / ${bad}개 실패`);
  await br.close(); server.close();
  process.exit(bad?1:0);
})();
