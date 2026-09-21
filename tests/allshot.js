// 화면들을 실제로 그려 놓고 눈으로 본다 (사장님: 「전반적으로 인간이 쓰기에 최악」)
// ★ 짐작으로 고치지 않는다 — 그려 놓고 본다.
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
  await pg.goto('http://127.0.0.1:'+server.address().port+'/', { waitUntil:'domcontentloaded' });
  await pg.waitForTimeout(1500);
  await pg.evaluate(()=>{
    try{ skipWelcome(); }catch(_){}
    window.__user = { uid:'U1', name:'김명준' }; try{ me = window.__user; }catch(_){}
    boats = [{ id:'B1', name:'SHUNSHINE', type:'sail', lat:34.727, lon:127.68, port:'여수 원형 마리나',
               spec:{ loa:13.7, fuelTank:240 } }];
    try{ seedRanks(boats[0]); boats[0].members = { U1: ownerRank(boats[0]).id }; }catch(_){}
    currentBoatId='B1'; window.currentBoatId='B1'; unlocked = true;
    maint = [
      { id:'k1', typ:'chk', name:'엔진오일 및 필터 교체', months:6, unit:'m', lastDate:'2025-01-01' },
      { id:'k2', typ:'chk', name:'임펠러 점검', hrs:250, lastH:100 },
      { id:'k3', typ:'chk', name:'선저 청소', months:12, unit:'m', lastDate:'2026-06-01' },
      { id:'g1', typ:'gear', name:'야마하 4LHA-STP', maker:'Yanmar', model:'4LHA-STP', where:'기관실' }
    ];
    repair = [{ id:'r1', typ:'repair', title:'빌지펌프 고장', status:'open', created:'2026-08-01',
                note:'수동으로만 돕니다' }];
    fuel = [{ id:'f1', date:'2026-03-01', liters:180, full:true, cost:320000 },
            { id:'f2', date:'2026-01-01', liters:100, full:true, cost:180000 }];
    runs = [{ id:'rn1', date:'2026-02-01', hours:60, purpose:'항해' }];
    items = [{ id:'i1', name:'구명조끼', qty:6, locker:'L1' },
             { id:'i2', name:'조명탄', qty:4, locker:'L1', exp:'2027-05-01' },
             { id:'i3', name:'예비 임펠러', qty:2, locker:'L2' }];
    lockers = [{ id:'L1', name:'선수 창고' }, { id:'L2', name:'기관실 선반' }];
    try{ save(); saveMR(); }catch(_){}
  });
  const 찍기 = async (이름, 열기) => {
    await pg.evaluate(열기);
    await pg.waitForTimeout(900);
    await pg.screenshot({ path: 'sh_' + 이름 + '.png' });
  };
  await 찍기('today', ()=>{ try{ switchTab('home'); homeSub='today'; switchTab('home'); renderHome(); }catch(e){} });
  await 찍기('maint', ()=>{ try{ boatSubTab='maint'; mntSub='mlog'; switchTab('boat'); }catch(e){} });
  await 찍기('repair',()=>{ try{ boatSubTab='maint'; mntSub='repair'; switchTab('boat'); }catch(e){} });
  await 찍기('fuel',  ()=>{ try{ boatSubTab='maint'; mntSub='fuel'; switchTab('boat'); }catch(e){} });
  await 찍기('gear',  ()=>{ try{ boatSubTab='gear'; gearView='maint'; switchTab('boat'); }catch(e){} });
  await 찍기('stow',  ()=>{ try{ boatSubTab='stow'; switchTab('boat'); }catch(e){} });
  await 찍기('check', ()=>{ try{ switchTab('home'); homeSub='check'; switchTab('home'); }catch(e){} });
  console.log('찍었습니다');
  await br.close(); server.close();
})();
