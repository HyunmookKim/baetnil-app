// 배가 늦게 올 때 — 진짜 브라우저에서.
// ★ 사고 (4.21)
//   로그인하면 클라우드에서 배가 몇 초 뒤에 온다. 그때 항해일지가 터졌다:
//   「Cannot set properties of null (setting 'innerHTML') at renderVoyage」
//   배가 없을 때 넣은 안내가 화면 속살을 통째로 지웠고, 그릴 칸이 사라졌기 때문이다.
//   탭을 나갔다 들어오면 저절로 멀쩡해져서 「가끔 되고 가끔 안 되는」 것으로 보였다.
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
  const ctx = await br.newContext({ locale:'ko-KR', viewport:{width:390,height:840}, isMobile:true, hasTouch:true });
  const pg = await ctx.newPage();
  const errs=[]; pg.on('pageerror', e=>errs.push(String(e)));
  pg.on('dialog', d=>d.accept());
  await pg.goto('http://127.0.0.1:'+server.address().port+'/', { waitUntil:'networkidle' });
  await pg.waitForTimeout(900);

  // 배가 하나도 없는 사람
  await pg.evaluate(()=>{ try{ skipWelcome(); }catch(_){} boats = []; currentBoatId = null; });

  // 배가 필요한 화면 넷을 차례로 연다 — 전부 안내가 떠야 한다
  const SCREENS = [
    { go:()=>{ switchTab('boat'); setBoatSubTab('voyage'); }, box:'voyageWrap', inner:'voyageList', name:'항해일지' },
    { go:()=>{ switchTab('home'); setHomeSub('check'); }, box:'checkWrap',    inner:null,           name:'출항 전 점검' },
    { go:()=>{ switchTab('boat'); goMaint('fuel'); },        box:'fuelWrap',     inner:null,           name:'연료 기록' },
    { go:()=>{ switchTab('boat'); setBoatSubTab('stow'); },  box:'listView',     inner:null,           name:'적재표' }
  ];
  for(const s of SCREENS){
    const r = await pg.evaluate(o=>{
      eval('(' + o.go + ')()');
      const el = document.getElementById(o.box);
      return { txt: el ? el.innerText : '(없다)' };
    }, { go: s.go.toString(), box: s.box });
    T(s.name + ' 은 배가 없으면 안내가 뜬다', /배를 등록해야/.test(r.txt), r.txt.slice(0,80));
    await pg.waitForTimeout(120);
  }

  // ── ★ 이제 배가 온다 (로그인해서 클라우드에서 늦게 받은 것과 같다)
  errs.length = 0;
  const after = await pg.evaluate(()=>{
    boats = [{ id:'b1', name:'테스트호', type:'sail', port:'여수', members:{}, ranks:{} }];
    currentBoatId = 'b1';
    const out = {};
    ['voyage','check','fuel','stow'].forEach(k=>{
      try{
        if(k === 'voyage'){ switchTab('boat'); setBoatSubTab('voyage'); }
        else if(k === 'check'){ switchTab('home'); setHomeSub('check'); }
        else if(k === 'fuel'){ switchTab('boat'); goMaint('fuel'); }
        else { switchTab('boat'); setBoatSubTab(k); }
        out[k] = 'ok';
      }catch(e){ out[k] = String(e && e.message || e); }
    });
    return out;
  });
  await pg.waitForTimeout(600);
  T('배가 오면 항해일지가 안 터진다', after.voyage === 'ok', after);
  T('배가 오면 출항 전 점검도 안 터진다', after.check === 'ok', after);
  T('배가 오면 연료 기록도 안 터진다', after.fuel === 'ok', after);
  T('배가 오면 적재표도 안 터진다', after.stow === 'ok', after);

  // 지웠던 칸이 도로 있는가 — 이것이 진짜 확인이다
  const back = await pg.evaluate(()=>({
    voyageList: !!document.getElementById('voyageList'),
    guard: /배를 등록해야/.test((document.getElementById('voyageWrap')||{}).innerText || ''),
    map: (document.getElementById('mapWrap')||{}).style ? document.getElementById('mapWrap').style.display : '?'
  }));
  T('★ 지웠던 칸(#voyageList)이 도로 있다', back.voyageList === true, back);
  T('안내가 걷혔다', back.guard === false, back);
  T('적재표 지도도 도로 보인다', back.map !== 'none', back.map);

  // 배가 온 뒤에 항해일지를 그려도 안 터진다 (사고가 난 바로 그 자리)
  const draw = await pg.evaluate(()=>{
    try{ switchTab('boat'); setBoatSubTab('voyage'); renderVoyage(); return 'ok'; }
    catch(e){ return String(e && e.message || e); }
  });
  T('★ renderVoyage 를 바로 불러도 안 터진다', draw === 'ok', draw);
  T('페이지에 잡히지 않은 오류가 없다',
    !errs.some(e=>/innerHTML|null/.test(e)), errs.slice(0,3));

  // ── 벗기는 함수 하나만 따로 불러 본다.
  // ★ 화면을 다시 그리면 그 그리는 함수가 지도·도구줄을 스스로 되살린다.
  //   그래서 「탭을 옮겨서」 보면 벗기기가 고장나도 멀쩡해 보인다 (부수기 검사가 잡았다).
  //   벗기는 일만 딱 시켜 놓고 본다.
  const only = await pg.evaluate(()=>{
    boats = []; currentBoatId = null;
    switchTab('boat'); setBoatSubTab('stow');          // 안내가 덮이고 지도가 감춰진다
    const hidden = document.getElementById('mapWrap').style.display;
    boats = [{ id:'b1', name:'테스트호', type:'sail', port:'여수', members:{}, ranks:{} }];
    currentBoatId = 'b1';
    boatGuardOff();                                     // 벗기는 일만 시킨다
    return {
      hidden,
      map: document.getElementById('mapWrap').style.display,
      list: !!document.getElementById('listView'),
      guard: /배를 등록해야/.test(document.getElementById('listView').innerText),
      left: Object.keys(needBoatSaved).length + Object.keys(needBoatHid).length
    };
  });
  T('덮을 때 지도를 감춘다', only.hidden === 'none', only);
  T('★ 벗기면 지도가 도로 보인다', only.map !== 'none', only);
  T('★ 벗기면 안내가 걷힌다', only.guard === false, only);
  T('★ 벗기고 나면 기억을 안 들고 있는다', only.left === 0, only);

  // 배를 다시 뺐다가 넣어도 같다 (기억을 한 번 쓰고 버리므로)
  const again = await pg.evaluate(()=>{
    boats = []; currentBoatId = null;
    switchTab('boat'); setBoatSubTab('voyage');
    const gone = /배를 등록해야/.test(document.getElementById('voyageWrap').innerText);
    boats = [{ id:'b1', name:'테스트호', type:'sail', port:'여수', members:{}, ranks:{} }];
    currentBoatId = 'b1';
    let err = '';
    try{ switchTab('boat'); setBoatSubTab('voyage'); }catch(e){ err = String(e && e.message || e); }
    return { gone, err, list: !!document.getElementById('voyageList') };
  });
  T('두 번째로 배가 빠졌다 들어와도 같다', again.gone === true && !again.err && again.list === true, again);

  console.log(`\n합계: ${ok}개 통과 / ${bad}개 실패`);
  await br.close(); server.close();
  process.exit(bad?1:0);
})();
