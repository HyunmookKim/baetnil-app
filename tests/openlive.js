// 로그인 없이 커뮤니티를 진짜로 열어 본다.
// ★ 규칙만 열어 놓고 앱이 계속 막고 있으면 아무 소용이 없다. 눌러서 확인한다.
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
const T=(n,c,w)=>{ if(c){ok++;console.log('통과: '+n);} else {bad++;console.log('★ 실패: '+n+(w!==undefined?' — '+JSON.stringify(w).slice(0,220):''));} };

(async ()=>{
  await new Promise(r=>server.listen(0,r));
  const br = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await br.newContext({ locale:'ko-KR', viewport:{width:390,height:820}, isMobile:true, hasTouch:true });
  const pg = await ctx.newPage();
  const errs=[]; pg.on('pageerror', e=>errs.push(String(e)));
  const said=[]; pg.on('dialog', d=>{ said.push(d.message()); d.accept(); });
  await pg.goto('http://127.0.0.1:'+server.address().port+'/', { waitUntil:'networkidle' });
  await pg.waitForTimeout(900);

  // 로그인 안 한 사람 + 서버에는 자료가 있다
  await pg.evaluate(()=>{
    try{ skipWelcome(); }catch(_){}
    window.__user = null; adminMe = null;
    const now = new Date().toISOString();
    window.__talk = {
      list: async()=>({ rows:[{ id:'p1', title:'첫 글입니다', body:'안녕하세요', kind:'chat',
        by:'U9', byName:'남', date:now, ts:now, cmtN:0, likeN:0 }], done:true }),
      add: async()=>{}, edit: async()=>{}, del: async()=>{} };
    window.__cmt   = { list: async()=>[], add: async()=>{}, del: async()=>{} };
    window.__like  = { mine: async()=>false, set: async()=>{} };
    window.__series = { list: async()=>[{ id:'s1', sname:'바다 이야기', no:1, mine:true,
      title:'연재 첫 편', author:'김', body:'글', blocks:[], by:'U9', date:now, ts:now }],
      put: async()=>{}, del: async()=>{} };
    window.__market = { list: async()=>({ rows:[{ id:'m1', title:'중고 닻 팝니다', price:50000,
      by:'U9', byName:'남', date:now, ts:now, photos:[] }], done:true }),
      put: async()=>{}, edit: async()=>{}, del: async()=>{} };
    window.__spots = { list: async()=>({ rows:[{ id:'t1', name:'여수 앞 정박지', lat:34.7, lon:127.7,
      by:'U9', byName:'남', date:now, ts:now, photos:[] }], done:true }),
      put: async()=>{}, edit: async()=>{}, del: async()=>{} };
    window.__pub = { list: async()=>[{ id:'b1', name:'테스트호', type:'sail', port:'여수' }] };
  });
  T('로그인 안 한 상태다', await pg.evaluate(()=>!window.__user));

  const openTab = async (sub)=>{
    await pg.evaluate(s=>{ switchTab('community'); setComSub(s); }, sub);
    await pg.waitForTimeout(900);
    return pg.evaluate(()=>document.querySelector('#comWrap, #tabWrap, main, body').innerText);
  };

  // ── 글판
  {
    const txt = await openTab('talk');
    T('글판이 로그인하라고 막지 않는다', !/글판은 로그인해야/.test(txt), txt.slice(0,140));
    T('글판에 글이 보인다', /첫 글입니다/.test(txt), txt.slice(0,200));
  }
  // ── 정박지
  {
    const txt = await openTab('spots');
    T('정박지가 막지 않는다', !/정박지는 로그인해야/.test(txt), txt.slice(0,140));
    T('정박지가 보인다', /여수 앞 정박지/.test(txt), txt.slice(0,200));
  }
  // ── 장터
  {
    const txt = await openTab('market');
    T('장터가 막지 않는다', !/장터는 로그인해야/.test(txt), txt.slice(0,140));
    T('장터 물건이 보인다', /중고 닻 팝니다/.test(txt), txt.slice(0,200));
  }
  // ── 배 둘러보기
  {
    const txt = await openTab('explore');
    T('배 둘러보기가 막지 않는다', !/둘러보려면 로그인이 필요합니다/.test(txt), txt.slice(0,140));
  }
  // ── 연재
  {
    await pg.evaluate(()=>{ switchTab('community'); setComSub('news'); newsSub='sr'; seriesList=null; renderNews(); });
    await pg.waitForTimeout(1000);
    const txt = await pg.evaluate(()=>document.getElementById('newsList').innerText);
    T('연재가 보인다', /연재 첫 편/.test(txt), txt.slice(0,200));
    T('연재 묶음 이름도 보인다', /바다 이야기/.test(txt), txt.slice(0,200));
  }

  // ── 쓰는 것은 여전히 막힌다. 그리고 말만 하지 않고 로그인 화면을 연다.
  const tryWrite = async fn => {
    said.length = 0;
    // ★ 앱은 브라우저 기본창을 안 쓴다 — 자기 창(tell/ask)으로 말한다.
    //   dialog 만 듣고 있으면 「아무 말도 안 했다」로 헛되이 실패한다.
    const r = await pg.evaluate(async f=>{
      let seen = false;
      const real = window.openAccount, t0 = window.tell, a0 = window.ask;
      const 말 = [];
      window.openAccount = function(){ seen = true; };
      window.tell = m => { 말.push(String(m)); return Promise.resolve(); };
      window.ask  = m => { 말.push(String(m)); return Promise.resolve(false); };
      try{ eval(f); }catch(e){}
      await new Promise(r=>setTimeout(r,150));
      window.openAccount = real; window.tell = t0; window.ask = a0;
      return { seen, 말 };
    }, fn);
    return { opened: r.seen, said: said.concat(r.말) };
  };
  const w1 = await tryWrite('writeTalk()');
  T('로그인 없이 글은 못 쓴다', w1.said.some(m=>/로그인/.test(m)), w1.said);
  T('그러면서 로그인 화면을 열어 준다', w1.opened === true, w1);

  const w2 = await tryWrite("writeTalkComment('p1')");
  T('로그인 없이 댓글도 못 쓴다', w2.said.some(m=>/로그인/.test(m)), w2.said);
  T('댓글도 로그인 화면을 열어 준다', w2.opened === true, w2);

  T('페이지 오류가 없다', errs.length===0, errs.slice(0,3));

  console.log(`\n합계: ${ok}개 통과 / ${bad}개 실패`);
  await br.close(); server.close();
  process.exit(bad?1:0);
})();
