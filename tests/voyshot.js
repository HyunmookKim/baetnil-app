// 4.99 — 항해일지 화면을 실제로 띄워서 눈으로 본다 (사장님 지적)
//   "세부사항들이 칸밖에 있어서 매번 뭐가 뭔지 찾기 어렵다"
// ★ 짐작으로 고치지 않는다 — 그려 놓고 본다 (사장님이 정하신 것 8번).
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const FILE = process.argv[2] || '../../work.html';
const server = http.createServer((rq,rs)=>{
  const f = rq.url === '/' ? path.resolve(FILE) : path.join(path.dirname(path.resolve(FILE)), rq.url.split('?')[0]);
  fs.readFile(f,(e,d)=>{ if(e){ rs.writeHead(404); rs.end(); return; } rs.writeHead(200); rs.end(d); });
});
(async()=>{
  await new Promise(r=>server.listen(0,r));
  const br = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await br.newContext({ locale:'ko-KR', viewport:{width:390,height:844}, isMobile:true, hasTouch:true, deviceScaleFactor:2 });
  const pg = await ctx.newPage();
  const errs=[]; pg.on('console', m=>{ if(m.type()==='error') errs.push(m.text().slice(0,140)); });
  await pg.goto('http://127.0.0.1:'+server.address().port+'/', { waitUntil:'domcontentloaded' });
  await pg.waitForTimeout(1500);
  await pg.evaluate(()=>{
    try{ skipWelcome(); }catch(_){}
    window.__user = { uid:'U1', name:'김명준' }; try{ me = window.__user; }catch(_){}
    boats = [{ id:'B1', name:'SHUNSHINE', type:'sail', lat:34.727, lon:127.68, port:'여수 원형 마리나' }];
    try{ seedRanks(boats[0]); boats[0].members = { U1: ownerRank(boats[0]).id }; }catch(_){}
    currentBoatId='B1'; window.currentBoatId='B1'; unlocked = true;
    voyage = [{ id:'V1', date:'2026-09-02', from:'여수 원형 마리나', to:'여수 원형 마리나',
      timeOut:'18:20', timeIn:'20:10', nm:6.2, hours:1.8, engineH:0.6,
      wxOut:{ text:'x', dir:180, kt:3, gust:7, wave:0.1, temp:27, at:'2026-09-02 18:20', pos:true },
      wxIn:{ text:'x', dir:200, kt:4, wave:0.2, temp:26, at:'2026-09-02 20:10', pos:true },
      posOut:{ lat:34.7440, lon:127.6789 }, posIn:{ lat:34.7440, lon:127.6789 },
      logs:[
        { id:'g1', time:'18:54', kind:'세일', text:'세일 올림. 남풍 3kt', eng:'off',
          pos:{ lat:34.7280, lon:127.6800 },
          wx:{ text:'x', dir:180, kt:3, wave:0.1, temp:27, at:'2026-09-02 18:54', pos:true } },
        { id:'g2', time:'19:37', kind:'세일', text:'세일 내림', eng:'on',
          pos:{ lat:34.7270, lon:127.6770 } }
      ] }];
    try{ save(); saveMR(); }catch(_){}
    try{ boatSubTab='voyage'; localStorage.setItem('bt_boatsub','voyage'); switchTab('boat'); }catch(_){}
  });
  await pg.waitForTimeout(600);
  await pg.evaluate(()=>{ try{ openMR('voyage','V1'); }catch(e){ console.error('E '+e.message); } });
  await pg.waitForTimeout(1200);
  const P = await pg.$('#mrPanel');
  await P.screenshot({ path: 'voy_new.png' });
  // ★ 아직 아무것도 안 적은 항해 — 「지금 출발/도착」 이 칸 안에 뜨는지 본다
  await pg.evaluate(()=>{
    voyage.push({ id:'V2', date:'2026-09-03', logs:[] });
    try{ save(); saveMR(); }catch(_){}
    try{ openMR('voyage','V2'); }catch(e){ console.error('E '+e.message); }
  });
  await pg.waitForTimeout(900);
  await (await pg.$('#mrPanel')).screenshot({ path: 'voy_empty.png' });
  console.log(JSON.stringify(await pg.evaluate(()=>({
    빈칸: document.querySelectorAll('#mrPanel .legc').length,
    한번에: [...document.querySelectorAll('#mrPanel .legc .mrbtn.big')].map(b=>b.innerText.trim())
  }))));
  // 칸이 실제로 그려졌나
  const 셈 = await pg.evaluate(()=>({
    칸: document.querySelectorAll('#mrPanel .legc').length,
    출발: document.querySelectorAll('#mrPanel .legc.out').length,
    중간: document.querySelectorAll('#mrPanel .legc.mid').length,
    도착: document.querySelectorAll('#mrPanel .legc.in').length,
    더하기: document.querySelectorAll('#mrPanel .legadd').length,
    제목크기: (()=>{ const h=document.querySelector('#mrPanel .legh'); return h?getComputedStyle(h).fontSize:''; })()
  }));
  console.log(JSON.stringify(셈));
  console.log('콘솔 오류:', errs.filter(x=>!/Failed to fetch|gstatic|firebase|openstreetmap|openseamap|favicon|ERR_/.test(x)).slice(0,3));
  await br.close(); server.close();
})();
