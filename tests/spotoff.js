// 정박지 — 인터넷이 없어도 관 자료가 보이는가.
// ★ 왜 이 검사가 있나
//   정박지 152곳은 클라우드가 아니라 앱 안에 들어 있다. 그렇게 만든 까닭이
//   '배 위에서는 신호가 끊기는데 그때 필요한 자료라서' 였다.
//   그런데 renderSpots 가 클라우드 손잡이부터 확인하고 없으면 그냥 끝내고 있었다.
//   앱 안에 자료를 넣어 둔 뜻이 통째로 날아간 셈이다.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const FILE = process.argv[2] || 'work.html';
const server = http.createServer((rq,rs)=>{
  const f = path.join(__dirname, rq.url === '/' ? FILE : rq.url.split('?')[0]);
  fs.readFile(f,(e,d)=>{ if(e){rs.writeHead(404);rs.end();return;}
    if(f.endsWith('.woff2')) rs.setHeader('Content-Type','font/woff2');
    rs.writeHead(200); rs.end(d); });
});
let ok=0,bad=0;
const T=(n,c,w)=>{ if(c){ok++;console.log('통과: '+n);} else {bad++;console.log('★ 실패: '+n+(w!==undefined?' — '+JSON.stringify(w).slice(0,140):''));} };

(async ()=>{
  await new Promise(r=>server.listen(0,r));
  const br = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await br.newContext({ locale:'ko-KR', viewport:{width:390,height:800}, isMobile:true, hasTouch:true });
  const pg = await ctx.newPage();
  const errs=[]; pg.on('pageerror', e=>errs.push(String(e)));
  await pg.goto('http://127.0.0.1:'+server.address().port+'/', { waitUntil:'networkidle' });
  await pg.waitForTimeout(900);

  // 배 한 척 — 홈포트가 있어야 '가까운 순'을 잴 수 있다
  await pg.evaluate(()=>{
    try{ skipWelcome(); }catch(_){}
    boats=[{id:'B1',name:'테스트호',type:'sail',port:'여수',lat:34.7404,lon:127.7454}];
    seedRanks(boats[0]); boats[0].members={U1:ownerRank(boats[0]).id};
    currentBoatId='B1'; window.currentBoatId='B1';
    save&&save();
  });

  // ── 1. 인터넷 없음 · 로그인 안 됨 (배 위에서 실제로 이 꼴이 된다)
  await pg.evaluate(()=>{
    window.__spots = null; window.__user = null;
    spotQ = ''; try{ setSpotKind(''); }catch(_){}
    switchTab('community'); setComSub('spots');
  });
  await pg.waitForTimeout(700);

  const off = await pg.evaluate(()=>{
    const W = document.getElementById('spotWrap');
    return { html: W ? W.innerHTML : '',
             text: W ? W.innerText : '',
             rows: document.querySelectorAll('#spotWrap .fleet').length,
             upload: !!document.querySelector('#spotWrap button[onclick*="writeSpot"]'),
             seedN: (typeof SPOT_SEED !== 'undefined') ? SPOT_SEED.length : 0 };
  });
  T('관 자료가 앱 안에 있다', off.seedN >= 150, off.seedN);
  T('인터넷이 없어도 정박지가 보인다', off.rows > 0, {rows:off.rows, text:off.text.slice(0,80)});
  T('「인터넷에 연결된 상태에서만」 이 안 뜬다',
    off.text.indexOf('인터넷에 연결된 상태에서만') < 0, off.text.slice(0,80));
  T('로그인하라고 막지 않는다',
    off.text.indexOf('로그인해야 볼 수 있습니다') < 0, off.text.slice(0,80));
  T('사람이 올린 것은 안 보인다고 알려 준다',
    /관|공공|인터넷/.test(off.text.split('\n')[0] || ''), off.text.split('\n')[0]);
  T('올리기 단추는 감춘다 (눌러도 못 올린다)', !off.upload);

  // ── 2. 가까운 순 · 찾기 · 거르기가 오프라인에서도 된다
  const near = await pg.evaluate(()=>{
    const ns = [...document.querySelectorAll('#spotWrap .fleet .fsub')]
      .slice(0,6).map(e=>parseFloat((e.textContent.match(/([\d.]+)\s*NM/)||[])[1]));
    return ns.filter(n=>!isNaN(n));
  });
  T('가까운 순으로 놓인다',
    near.length >= 3 && near.every((v,i)=> i===0 || v >= near[i-1]), near);

  const found = await pg.evaluate(()=>{
    spotFilter('여수');
    return document.querySelectorAll('#spotWrap .fleet').length;
  });
  T('오프라인에서도 찾기가 된다', found > 0, found);

  const kinded = await pg.evaluate(()=>{
    spotFilter(''); setSpotKind('port');
    const n = document.querySelectorAll('#spotWrap .fleet').length;
    setSpotKind('');
    return n;
  });
  T('오프라인에서도 배 종류로 거를 수 있다', kinded > 0, kinded);

  // ── 3. 눌러서 자세히 본다
  const opened = await pg.evaluate(async ()=>{
    const el = document.querySelector('#spotWrap .fleet');
    if(!el) return { no:true };
    el.click();
    await new Promise(r=>setTimeout(r,400));
    const P = document.getElementById('mrPanel');
    return { text:(P && P.innerText || '').slice(0,120) };
  });
  T('관 정박지를 눌러 자세히 볼 수 있다',
    !opened.no && opened.text.length > 5, opened);

  // ── 4. 인터넷은 되는데 로그인만 안 한 경우는 예전대로
  await pg.evaluate(()=>{
    closeBoat && closeBoat();
    window.__spots = { list: async()=>({rows:[],done:true}) };
    window.__user = null;
    switchTab('community'); setComSub('spots');
  });
  await pg.waitForTimeout(600);
  T('온라인인데 로그인 안 하면 예전처럼 안내한다',
    await pg.evaluate(()=>(document.getElementById('spotWrap').innerText||'')
      .indexOf('로그인해야 볼 수 있습니다') >= 0));

  // ── 5. 장터는 그대로 (앱 안에 자료가 없으니 보여 줄 것이 없다)
  await pg.evaluate(()=>{
    window.__market = null; window.__user = null;
    switchTab('community'); setComSub('market');
  });
  await pg.waitForTimeout(600);
  T('장터는 예전처럼 인터넷 안내를 낸다',
    await pg.evaluate(()=>(document.getElementById('marketWrap').innerText||'')
      .indexOf('인터넷에 연결된 상태에서만') >= 0));

  T('앱이 터지지 않았다', errs.length===0, errs.slice(0,2));
  console.log('합계: '+ok+'개 통과 / '+bad+'개 실패');
  await br.close(); server.close();
  process.exit(bad ? 1 : 0);
})();
