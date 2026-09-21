// 화면이 칙칙한가 — 지금 것과 손본 것을 나란히 찍어 본다 (앱은 안 고친다)
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
// ★ 넘겨받은 파일을 본다. 검사 폴더에 남은 옛 work.html 을 보면 안 된다.
const __ARG  = process.argv[2];
const __BASE = __ARG ? require('path').dirname(require('path').resolve(__ARG)) : __dirname;
const __MAIN = __ARG ? require('path').basename(__ARG) : 'work.html';
// 어떤 이름으로 부르든 본체를 달라는 것이면 본체를 준다
const __PICK = u => (u === '/' || u === '/work.html' || u === '/' + __MAIN) ? __MAIN : u.replace(/^\//,'');
const server = http.createServer((rq, rs) => {
  const f = path.join(__BASE, __PICK(rq.url.split('?')[0]));
  fs.readFile(f, (e, d) => { if(e){ rs.writeHead(404); rs.end(); return; } rs.writeHead(200); rs.end(d); });
});
const W = 360, H = 780, SCALE = 2;
const seed = () => {
  try{ skipWelcome(); }catch(_){}
  window.__user = { uid:'U1', email:'me@example.com', name:'김선장' };
  me = window.__user;
  boats = [{ id:'B1', name:'선샤인', type:'sail', port:'여수 원형마리나',
             maker:'Beneteau', model:'First 45f5', year:1993, lat:34.7404, lon:127.7457,
             spec:{ loa:13.7, beam:4.2, draft:2.2, fuel:200, water:400, engine:'Yanmar 4JH4E' } }];
  seedRanks(boats[0]); boats[0].members = { U1: ownerRank(boats[0]).id };
  currentBoatId = 'B1'; window.currentBoatId = 'B1';
  unlocked = true; dgLocked = false; lkLocked = false;
  const 오늘 = new Date();
  const 날 = d => { const x = new Date(오늘); x.setDate(x.getDate()+d);
    return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0'); };
  maint = [
    { id:'m1', grp:'기관', name:'엔진 오일 교환', months:6, unit:'m', lastDate:날(-200), history:[{date:날(-200)}], photos:[] },
    { id:'m2', grp:'기관', name:'임펠러 점검', months:12, unit:'m', lastDate:날(-330), history:[{date:날(-330)}], photos:[] },
    { id:'m3', grp:'선체', name:'선저 청소·방오도료', months:12, unit:'m', lastDate:날(-300), history:[{date:날(-300)}], photos:[] },
    { id:'m4', grp:'의장', name:'리깅 점검', months:24, unit:'m', lastDate:날(-500), history:[{date:날(-500)}], photos:[] },
    { id:'m5', grp:'안전', name:'구명뗏목 검사', months:12, unit:'m', lastDate:날(-40), history:[{date:날(-40)}], photos:[] },
    { id:'m6', grp:'전기', name:'배터리 비중 점검', months:3, unit:'m', lastDate:날(-20), history:[{date:날(-20)}], photos:[] }
  ];
  save && save(); saveLocal && saveLocal();
  try{ applyBoatName(); }catch(_){}
  try{ setSync('동기화됨'); }catch(_){}
  switchTab('boat'); setBoatSubTab('maint');
};
(async () => {
  await new Promise(r => server.listen(8741, r));
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const shot = async (name, tweak) => {
    const p = await b.newPage({ locale:'ko-KR', viewport:{width:W,height:H}, deviceScaleFactor:SCALE });
    await p.goto('http://localhost:8741/work.html');
    await p.waitForTimeout(2200);
    await p.evaluate(seed);
    if(tweak) await p.addStyleTag({ content: tweak });
    await p.waitForTimeout(900);
    await p.screenshot({ path: name });
    console.log(name);
    await p.close();
  };
  await shot('ui_now.png', null);
  // 손본 것 — 색은 그대로 두고 '단'만 벌린다
  await shot('ui_new.png', `:root{--bg:#0A0C0F !important;--sf:#191D22 !important;--sf2:#1F242A !important;--bd:#333A43 !important;--tx:#DEE1E5 !important;--tm:#8E959D !important}`);
  await b.close(); server.close();
})();
