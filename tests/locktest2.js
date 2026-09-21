// 보기 전용일 때 글이 써지면 안 된다 — 그런데 신고와 찜은 되어야 한다.
// ★ 왜 이 검사가 있나
//   단추에 '보기 전용' 이라고 써 놓고 커뮤니티 글이 그냥 써지고 있었다.
//   잠금을 보는 곳이 배 소개글 하나뿐이었다. 표시가 거짓말을 하고 있었다.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const FILE = process.argv[2] || 'work.html';
// 넘겨받은 길이 절대경로면 그대로 쓴다 (__dirname 을 앞에 붙이면 엉뚱한 자리가 된다).
//   나머지(font.woff2 같은 것)는 지금까지처럼 검사 폴더에서 찾는다.
const APP = path.isAbsolute(FILE) ? FILE : path.join(__dirname, FILE);
const server = http.createServer((rq,rs)=>{
  const f = rq.url === '/' ? APP : path.join(__dirname, rq.url.split('?')[0]);
  fs.readFile(f,(e,d)=>{ if(e){rs.writeHead(404);rs.end();return;}
    if(f.endsWith('.woff2')) rs.setHeader('Content-Type','font/woff2');
    rs.writeHead(200); rs.end(d); });
});
let ok=0,bad=0;
const T=(n,c,w)=>{ if(c){ok++;console.log('통과: '+n);} else {bad++;console.log('★ 실패: '+n+(w!==undefined?' — '+JSON.stringify(w).slice(0,140):''));} };

// 잠가야 하는 것 — [함수, 부르는 법]
const MUST_LOCK = [
  ['writeTalk',        "writeTalk()"],
  ['delTalk',          "delTalk('t1')"],
  ['writeTalkComment', "writeTalkComment('t1')"],
  ['delTalkComment',   "delTalkComment('t1','c1',false)"],
  ['writePost',        "writePost()"],
  ['writeComment',     "writeComment('p1')"],
  ['delCommentUI',     "delCommentUI('p1','c1')"],
  ['writeSpot',        "writeSpot()"],
  ['delSpot',          "delSpot('s1')"],
  ['writeSpotComment', "writeSpotComment('s1')"],
  ['delSpotComment',   "delSpotComment('s1','c1')"],
  ['writeItem',        "writeItem()"],
  ['delItem',          "delItem('m1')"],
  ['writeSeries',      "writeSeries()"],
  ['delSeries',        "delSeries('sr1')"]
];
// 잠가도 되어야 하는 것
const MUST_OPEN = ['toggleLike', 'openSupport', 'applySeries'];

(async ()=>{
  await new Promise(r=>server.listen(0,r));
  const br = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await br.newContext({ locale:'ko-KR', viewport:{width:390,height:800}, isMobile:true, hasTouch:true });
  const pg = await ctx.newPage();
  const errs=[]; pg.on('pageerror', e=>errs.push(String(e)));
  await pg.goto('http://127.0.0.1:'+server.address().port+'/', { waitUntil:'networkidle' });
  await pg.waitForTimeout(900);

  await pg.evaluate(()=>{
    try{ skipWelcome(); }catch(_){}
    window.__user = { uid:'U1', email:'a@b.c', name:'김선장' };
    boats=[{id:'B1',name:'테스트호',type:'sail',port:'여수'}];
    seedRanks(boats[0]); boats[0].members={U1:ownerRank(boats[0]).id};
    currentBoatId='B1'; window.currentBoatId='B1'; save&&save();
    adminMe = { owner:true, perms:{} };     // 연재까지 열어 두고 잠금만 본다
    myBan = null;
    // 손댈 대상이 있어야 지우기까지 가 본다
    talkList = [{ id:'t1', by:'U1', byName:'김선장', title:'글', blocks:[], comments:[] }];
    posts = [{ id:'p1', by:'U1', title:'배 글', body:'', comments:[{id:'c1',by:'U1',text:'ㅎ'}] }];
    spotList = [{ id:'s1', by:'U1', name:'어디항', kind:'port', lat:34.7, lon:127.7 }];
    marketList = [{ id:'m1', by:'U1', title:'닻', price:0 }];
    seriesList = [{ id:'sr1', by:'U1', title:'연재', author:'나', mine:true, body:'ㅎ' }];
    window.__talk={del:async()=>{}}; window.__spots={del:async()=>{},list:async()=>({rows:[],done:true})};
    window.__market={del:async()=>{}}; window.__series={del:async()=>{},list:async()=>[]};
    window.__cmt={del:async()=>{},list:async()=>[]}; window.__support={add:async()=>{}};
  });

  // 잠근다
  await pg.evaluate(()=>{ unlocked = true; toggleLock(); });
  T('보기 전용으로 바뀐다', await pg.evaluate(()=>unlocked===false));
  T('단추에도 보기 전용이라고 쓴다',
    await pg.evaluate(()=>(document.getElementById('lockBtn')||{}).textContent==='보기 전용'));

  // ── 1. 잠긴 채로 부르면 물어보고 멈춘다 (거절하면 아무 일도 안 일어난다)
  for(const [name, call] of MUST_LOCK){
    const r = await pg.evaluate(async (c)=>{
      let asked = null;
      // ★ 앱은 confirm/alert 를 안 쓴다 — 자기 창(ask/tell)을 띄운다.
      const c0 = window.confirm, a0 = window.alert, k0 = window.ask, t0 = window.tell;
      window.confirm = m => { asked = String(m); return false; };   // '아니오'
      window.alert = ()=>{};
      window.ask  = m => { asked = String(m); return Promise.resolve(false); };
      window.tell = ()=>Promise.resolve();
      let form = false, err = '';
      try{ eval(c); }catch(e){ err = String(e.message||e); }
      await new Promise(r=>setTimeout(r,120));
      form = (document.getElementById('formOv').style.display||'') === 'flex';
      window.confirm = c0; window.alert = a0; window.ask = k0; window.tell = t0;
      const st = unlocked;
      try{ closeForm(); }catch(_){}
      return { asked, form, err, unlocked: st };
    }, call);
    T(name + ' 은 잠기면 막힌다',
      !!r.asked && /보기 전용/.test(r.asked) && !r.form && r.unlocked === false, r);
  }

  // ── 2. 예 하면 그 자리에서 이어 간다
  const go = await pg.evaluate(async ()=>{
    const c0 = window.confirm, k0 = window.ask;
    window.confirm = ()=>true; window.ask = ()=>Promise.resolve(true);   // '예'
    writeTalk();
    await new Promise(r=>setTimeout(r,250));
    const form = (document.getElementById('formOv').style.display||'') === 'flex';
    window.confirm = c0; window.ask = k0;
    const st = unlocked;
    try{ closeForm(); }catch(_){}
    return { form, unlocked: st };
  });
  T('예 하면 편집 중으로 바뀌고 글쓰기가 열린다', go.form === true && go.unlocked === true, go);

  // ── 3. 다시 잠그고 — 신고·찜·고객센터는 열려 있어야 한다
  await pg.evaluate(()=>{ if(unlocked) toggleLock(); });
  T('다시 보기 전용이다', await pg.evaluate(()=>unlocked===false));

  const src = await pg.evaluate((names)=>{
    const o = {};
    names.forEach(n=>{ o[n] = (typeof window[n]==='function') ? String(window[n]).slice(0,400) : null; });
    return o;
  }, MUST_OPEN);
  MUST_OPEN.forEach(n=>{
    T(n + ' 은 잠겨도 열려 있다',
      src[n] === null || !/guardEdit|needEdit/.test(src[n]), (src[n]||'').slice(0,60));
  });

  // 신고는 잠겨도 실제로 열린다
  const rep = await pg.evaluate(async ()=>{
    const names = Object.getOwnPropertyNames(window)
      .filter(k=>/^report[A-Z]/.test(k) && typeof window[k]==='function');
    return names.map(n=>({ n, guarded: /guardEdit|needEdit/.test(String(window[n])) }));
  });
  T('신고는 어느 것도 잠금에 걸리지 않는다',
    rep.length === 0 || rep.every(x=>!x.guarded), rep);

  T('앱이 터지지 않았다', errs.length===0, errs.slice(0,2));
  console.log('합계: '+ok+'개 통과 / '+bad+'개 실패');
  await br.close(); server.close();
  process.exit(bad ? 1 : 0);
})();
