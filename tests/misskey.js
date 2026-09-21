// 화면을 돌면서 t() 가 물어본 열쇠 가운데 사전에 없는 것을 모은다.
// ★ t('글자') 만 세면 t(변수) 로 부르는 자리를 놓친다. 실제로 놓쳤다.
const { chromium } = require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const SRC=process.argv[2]||'work.html';
const server=http.createServer((rq,rs)=>{const f=path.join(__dirname,rq.url==='/'?SRC:rq.url.split('?')[0]);
  fs.readFile(f,(e,d)=>{if(e){rs.writeHead(404);rs.end();return;}
    rs.writeHead(200,{'Content-Type':f.endsWith('.js')?'text/javascript':'text/html'});rs.end(d);});});
const STEPS = [
  `switchTab('home')`, `setHomeSub&&setHomeSub('weather')`, `setHomeSub&&setHomeSub('check')`,
  `switchTab('boat')`, `setBoatSubTab&&setBoatSubTab('stow')`, `setBoatSubTab&&setBoatSubTab('maint')`,
  `setBoatSubTab&&setBoatSubTab('repair')`, `setBoatSubTab&&setBoatSubTab('fuel')`,
  `setBoatSubTab&&setBoatSubTab('docs')`, `switchTab('voyage')`,
  `switchTab('community')`, `setComSub&&setComSub('spots')`, `setComSub&&setComSub('market')`,
  `setComSub&&setComSub('explore')`, `setComSub&&setComSub('news')`,
  `setNewsSub&&setNewsSub('ww')`, `setNewsSub&&setNewsSub('sr')`, `setNewsSub&&setNewsSub('kr')`,
  `openDrawer()`, `closeDrawer()`, `openAccount()`, `openLocLog&&openLocLog()`, `openLegal('terms')`, `openLegal('privacy')`,
  `openLegal('location')`, `openSupport()`, `closeForm&&closeForm()`, `openLang&&openLang()`,
  `openHelp&&openHelp('maintVsRepair')`, `openHelp&&openHelp('cycle')`, `openHelp&&openHelp('pin')`,
  `openHelp&&openHelp('seed')`, `openHelp&&openHelp('model')`, `openHelp&&openHelp('status')`,
  `openBoatSetup&&openBoatSetup()`, `closeForm&&closeForm()`, `openInstall&&openInstall()`,
  `openWipe&&openWipe()`, `openFleet&&openFleet()`, `openTrash&&openTrash()`, `closeTrash&&closeTrash()`,
  `toggleLock&&toggleLock()`, `switchTab('boat');setBoatSubTab&&setBoatSubTab('stow');toggleLkEdit&&toggleLkEdit()`,
  `setLkTool&&setLkTool('rect')`, `setLkTool&&setLkTool('locker')`,
  `switchTab('boat');setBoatSubTab&&setBoatSubTab('maint');mrToggleView&&mrToggleView('maint')`,
  `setMapKind&&setMapKind('plan')`, `setMapKind&&setMapKind('side')`,
];
(async()=>{
  await new Promise(r=>server.listen(0,r));
  const url='http://127.0.0.1:'+server.address().port+'/';
  const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  let bad=0;
  for(const lang of ['en','ru']){
    const p=await br.newPage({ locale:'ko-KR' }); p.on('dialog',d=>d.accept());
    await p.addInitScript(v=>{try{localStorage.setItem('bt_lang',v);localStorage.setItem('bt_agree','1');}catch(e){}},lang);
    await p.goto(url); await p.waitForTimeout(1200);
    await p.evaluate(v=>{
      window.__miss = new Set();
      const orig = window.t;
      window.t = function(s){
        const k = String(s == null ? '' : s);
        if(/[가-힣]/.test(k) && !(I18N[v]||{})[k]) window.__miss.add(k);
        return orig(k);
      };
    }, lang);
    for(const c of STEPS){ try{ await p.evaluate(x=>eval(x), c); }catch(e){} await p.waitForTimeout(120); }
    const miss=await p.evaluate(()=>[...window.__miss]);
    console.log('==== '+lang+' — 사전에 없는 열쇠 '+miss.length+'개');
    miss.forEach(x=>console.log('   '+JSON.stringify(x)));
    bad+=miss.length; await p.close();
  }
  await br.close(); server.close();
  process.exit(bad?1:0);
})();
