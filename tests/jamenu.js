// 일본어로 켜고 화면마다 「눈에 보이는 짧은 글」(메뉴·단추·이름표)을 모아 준다.
const { chromium } = require('playwright');
const fs=require('fs'), http=require('http'), path=require('path');
const SRC = process.argv[2] || '../../work.html';
const srv = http.createServer((q,r)=>{
  let f=q.url.split('?')[0]; if(f==='/') f='/'+SRC;
  const p=path.join(process.cwd(), f.replace(/^\//,''));
  if(!fs.existsSync(p)){ r.writeHead(404); r.end(''); return; }
  r.writeHead(200,{'content-type': path.extname(p)==='.js'?'text/javascript':'text/html; charset=utf-8'});
  r.end(fs.readFileSync(p));
});
(async()=>{
  await new Promise(r=>srv.listen(0,r));
  const port=srv.address().port;
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const p=await(await b.newContext({viewport:{width:430,height:930}, locale:'ja-JP', isMobile:true, hasTouch:true})).newPage();
  await p.route('**tile.openstreetmap.org/**', r=>r.abort());
  p.on('dialog', d=>d.accept());
  await p.addInitScript(()=>{ try{ localStorage.setItem('bt_agree','1'); localStorage.setItem('bt_lang','ja'); }catch(e){} });
  await p.goto(`http://127.0.0.1:${port}/`);
  await p.waitForTimeout(2000);
  await p.evaluate(()=>{ window.ask=()=>Promise.resolve(true); window.tell=()=>Promise.resolve(true);
    window.alert=()=>{}; window.confirm=()=>true;
    try{ skipWelcome(); }catch(_){} unlocked=true;
    const o=document.getElementById('welcomeOv'); if(o) o.classList.remove('open'); });
  await p.waitForTimeout(500);
  await p.evaluate(()=>{ try{ openBoatSetup(); }catch(_){} });
  await p.waitForTimeout(400);
  await p.evaluate(()=>{ const n=document.getElementById('nbName'); if(n){ n.value='テスト号'; createBoat(); } });
  await p.waitForTimeout(1500);
  const steps = [
    ['오늘',       `switchTab('home')`],
    ['날씨',       `switchTab('home');setHomeSub('weather')`],
    ['출항전점검', `switchTab('home');setHomeSub('check')`],
    ['뉴스',       `switchTab('home');setHomeSub('news')`],
    ['달력',       `switchTab('home');setHomeSub('cal')`],
    ['적재표',     `setBoatSubTab('stow')`],
    ['정비수첩',   `goMaint('mlog')`],
    ['수리',       `goMaint('repair')`],
    ['연료',       `goMaint('fuel')`],
    ['장비',       `setBoatSubTab('gear')`],
    ['정기점검',   `setBoatSubTab('gear');typeof setGearSub==='function'&&setGearSub('maint')`],
    ['리뷰',       `setBoatSubTab('gear');typeof setGearSub==='function'&&setGearSub('review')`],
    ['도면',       `setBoatSubTab('gear');typeof setGearSub==='function'&&setGearSub('plan')`],
    ['항해일지',   `setBoatSubTab('voyage')`],
    ['문서',       `setBoatSubTab('docs')`],
    ['새 항해',    `setBoatSubTab('voyage');typeof addVoyage==='function'&&addVoyage()`],
    ['새 정비수첩',`goMaint('mlog');typeof addMlog==='function'&&addMlog()`],
    ['새 고장',    `goMaint('repair');typeof addRepair==='function'&&addRepair()`],
    ['새 급유',    `goMaint('fuel');typeof addFuel==='function'&&addFuel()`],
    ['새 엔진가동',`goMaint('fuel');typeof addRun==='function'&&addRun()`],
    ['새 장비',    `setBoatSubTab('gear');typeof addGear==='function'&&addGear()`],
    ['새 문서',    `setBoatSubTab('docs');typeof addVdoc==='function'&&addVdoc()`],
    ['글판',       `switchTab('community');setComSub('talk')`],
    ['정박지',     `switchTab('community');setComSub('spots')`],
    ['장터',       `switchTab('community');setComSub('market')`],
    ['배 둘러보기',`switchTab('community');setComSub('explore')`],
    ['남의 배',    `switchTab('others')`],
    ['배 설정',    `switchTab('boat');typeof openBoatInfo==='function'&&openBoatInfo()`],
    ['서랍',       `openDrawer()`],
    ['계정',       `typeof closeDrawer==='function'&&closeDrawer();openAccount()`],
    ['설정',       `typeof openSettings==='function'&&openSettings()`],
    ['고객센터',   `openSupport()`],
  ];
  const seen = new Set(); const out=[];
  for(const [name, code] of steps){
    try{ await p.evaluate(c=>eval(c), code); }catch(e){ out.push('### '+name+' — 못 열었습니다'); continue; }
    await p.waitForTimeout(800);
    const bits = await p.evaluate(()=>{
      const r=[];
      const push=(s)=>{ s=(s||'').replace(/\s+/g,' ').trim(); if(s && s.length<=26) r.push(s); };
      document.querySelectorAll('button, .tab, .sub, .subtab, .chip, .mrlbl, label, option, .ghead b, .cn, .st, h1,h2,h3,h4, .navb, .navlbl, .drawer a, .drawer div, summary, [onclick]').forEach(e=>{
        if(e.offsetParent===null && e.tagName!=='OPTION') return;
        // 자식이 또 잡히면 겹친다 — 잎사귀만
        if(e.querySelector('button,.chip,.mrlbl,label,option')) return;
        push(e.textContent);
      });
      return r;
    });
    const fresh = bits.filter(x=>{ if(seen.has(x)) return false; seen.add(x); return true; });
    if(fresh.length) out.push('### '+name+'\n'+fresh.join('\n'));
  }
  fs.writeFileSync('/tmp/jamenu.txt', out.join('\n\n'));
  console.log('썼습니다 /tmp/jamenu.txt — '+seen.size+'개');
  await b.close(); srv.close();
})().catch(e=>{ console.log('터졌습니다: '+e); process.exit(1); });
