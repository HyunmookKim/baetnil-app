// 애플 심사용 영상 안내서에 넣을 화면 사진을 실제로 그려서 찍는다.
// ★ 짐작한 그림이 아니라 5.3 판 앱을 그대로 띄워 찍는다.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const FILE = process.argv[2] || '../../work.html';
const OUT  = process.argv[3] || '/home/claude/guide';
fs.mkdirSync(OUT, { recursive:true });

const server = http.createServer((rq,rs)=>{
  const f = rq.url === '/' ? path.resolve(FILE) : path.join(path.dirname(path.resolve(FILE)), rq.url.split('?')[0]);
  fs.readFile(f,(e,d)=>{ if(e){ rs.writeHead(404); rs.end(); return; } rs.writeHead(200); rs.end(d); });
});

const SEED = () => {
  try{ skipWelcome(); }catch(_){}
  window.__user = { uid:'U1', name:'김종관' }; try{ me = window.__user; }catch(_){}
  boats = [{ id:'B1', name:'SHUNSHINE', type:'sail', lat:34.727, lon:127.68, port:'여수 원형 마리나',
             spec:{ loa:13.7, fuelTank:240 } }];
  try{ seedRanks(boats[0]); boats[0].members = { U1: ownerRank(boats[0]).id }; }catch(_){}
  currentBoatId='B1'; window.currentBoatId='B1'; unlocked = true;
  // 위치정보 동의 창이 화면을 가리지 않게 미리 동의해 둔다
  try{ locSet(true); }catch(_){}
  try{ pSet('bt_agree', JSON.stringify({ ver: LEGAL_VER, at: new Date().toISOString(),
        loc:true, locAt:new Date().toISOString() })); }catch(_){}
  maint = [
    { id:'k1', typ:'chk', name:'엔진오일 및 필터 교체', months:6, unit:'m', lastDate:'2026-03-01' },
    { id:'k2', typ:'chk', name:'임펠러 점검', hrs:250, lastH:100 },
    { id:'g1', typ:'gear', name:'야마하 4LHA-STP', maker:'Yanmar', model:'4LHA-STP', where:'기관실' }
  ];
  repair = [];
  fuel = [{ id:'f1', date:'2026-03-01', liters:180, full:true, cost:320000 }];
  runs = [{ id:'rn1', date:'2026-02-01', hours:60, purpose:'항해' }];
  voyage = [{ id:'v1', date:'2026-09-16', from:'여수 원형 마리나', to:'통영', dep:'2026-09-16T07:00',
              arr:'2026-09-16T13:20', nm:38, note:'바람 12kt 북동' }];
  items  = [{ id:'i1', name:'구명조끼', qty:6, locker:'L1' }];
  lockers = [{ id:'L1', name:'선수 창고' }];
  try{ save(); saveMR(); }catch(_){}
};

(async()=>{
  await new Promise(r=>server.listen(0,r));
  const url = 'http://127.0.0.1:'+server.address().port+'/';
  const br = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const mk = async () => {
    const ctx = await br.newContext({ locale:'ko-KR', viewport:{width:390,height:844},
      isMobile:true, hasTouch:true, deviceScaleFactor:2 });
    const pg = await ctx.newPage();
    await pg.goto(url, { waitUntil:'domcontentloaded' });
    await pg.waitForTimeout(1800);
    return { ctx, pg };
  };
  const shot = async (pg, name) => {
    await pg.waitForTimeout(900);
    await pg.screenshot({ path: path.join(OUT, name + '.png') });
    console.log('  ✓', name);
  };

  // ── ① 갓 깐 상태 (동생분 폰이 이럴 것이다)
  let { ctx, pg } = await mk();
  await shot(pg, '01-첫화면');

  await pg.evaluate(()=>{ try{ openWelcome(); }catch(e){ console.log(e.message); } });
  await shot(pg, '02-환영');

  await pg.evaluate(()=>{ try{ closePanel&&closePanel(); }catch(_){}; try{ skipWelcome(); }catch(_){} });
  await pg.waitForTimeout(700);
  await pg.evaluate(()=>{ try{ me = null; window.__user = null; }catch(_){}; try{ openAccount(); }catch(e){ console.log('openAccount: '+e.message); } });
  await pg.waitForTimeout(900);
  await pg.evaluate(()=>{ const el=document.getElementById('acEm'); if(el) el.scrollIntoView({block:'center'}); else console.log('acEm 없음'); });
  await shot(pg, '03-가입화면');

  await pg.evaluate(()=>{ try{ openBoatSetup(); }catch(e){ console.log(e.message); } });
  await shot(pg, '05-배등록');
  await ctx.close();

  // ── ② 배가 있고 로그인된 상태
  ({ ctx, pg } = await mk());
  await pg.evaluate(SEED);
  await pg.waitForTimeout(600);

  await pg.evaluate(()=>{ try{ switchTab('home'); setHomeSub('weather'); }catch(e){ console.log(e.message); } });
  await shot(pg, '06-날씨물때');

  await pg.evaluate(()=>{ try{ boatSubTab='maint'; mntSub='mlog'; switchTab('boat'); }catch(e){ console.log(e.message); } });
  await shot(pg, '07-정비수첩');

  await pg.evaluate(()=>{ try{ switchTab('voyage'); }catch(e){ console.log(e.message); } });
  await shot(pg, '08-항해일지');

  await pg.evaluate(()=>{ try{ boatSubTab='stow'; switchTab('boat'); }catch(e){ console.log(e.message); } });
  await shot(pg, '09-적재표');

  await pg.evaluate(()=>{
    try{ switchTab('community'); comSub='talk'; switchTab('community'); }catch(e){ console.log(e.message); }
  });
  await shot(pg, '10-커뮤니티');

  await pg.evaluate(()=>{ try{ writeTalk(); }catch(e){ console.log('writeTalk: '+e.message); } });
  await shot(pg, '10b-글쓰기');

  await pg.evaluate(async ()=>{
    try{
      talkList = [{ id:'P1', kind:'talk', title:'여수에서 통영까지 다녀왔습니다',
                    body:'바람이 좋아 리프 없이 갔습니다.', by:'U9', byName:'다른 사람',
                    ts:'2026-09-18T01:00:00.000Z', blocks:[{t:'p',v:'바람이 좋아 리프 없이 갔습니다.'}] }];
      await openTalk('P1');
    }catch(e){ console.log('openTalk: '+e.message); }
  });
  await shot(pg, '11-글보기');

  await pg.evaluate(()=>{ try{ actOpen(); }catch(e){ console.log('actOpen: '+e.message); } });
  await shot(pg, '12-신고와차단');

  await pg.evaluate(()=>{ try{ openWipe(); }catch(e){ console.log('openWipe: '+e.message); } });
  await shot(pg, '13-계정지우기');

  await ctx.close();
  await br.close(); server.close();
  console.log('끝');
})();
