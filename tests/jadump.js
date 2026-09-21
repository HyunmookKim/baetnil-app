// 일본어로 켜서 화면마다 보이는 글자를 그대로 뽑는다 (검사가 아니라 눈으로 보기 위한 것)
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
  await p.addInitScript(()=>{ try{ localStorage.setItem('bt_agree','1'); localStorage.setItem('bt_lang','ja'); }catch(e){} });
  await p.goto(`http://127.0.0.1:${port}/`);
  await p.waitForTimeout(2200);
  await p.evaluate(()=>{ window.ask=()=>Promise.resolve(true); window.tell=()=>Promise.resolve(true);
    window.alert=()=>{}; window.confirm=()=>true;
    try{ setLang('ja'); }catch(_){}
    try{ skipWelcome(); }catch(_){}
    unlocked = true;
    const o=document.getElementById('welcomeOv'); if(o) o.classList.remove('open'); });
  await p.waitForTimeout(600);
  await p.evaluate(()=>{ try{ openBoatSetup(); }catch(_){} });
  await p.waitForTimeout(400);
  await p.evaluate(()=>{ const n=document.getElementById('nbName'); if(n){ n.value='テスト号'; createBoat(); } });
  await p.waitForTimeout(1500);
  const 화면 = [
    ['홈', ()=>switchTab('home')],
    ['내 배', ()=>switchTab('boat')],
    ['정비', ()=>{switchTab('boat'); goMaint('maint');}],
    ['정비수첩', ()=>{switchTab('boat'); goMaint('mlog');}],
    ['고장', ()=>{switchTab('boat'); goMaint('repair');}],
    ['연료', ()=>{switchTab('boat'); goMaint('fuel');}],
    ['장비', ()=>{switchTab('boat'); goMaint('gear');}],
    ['점검표', ()=>{switchTab('boat'); goMaint('check');}],
    ['문서', ()=>{switchTab('boat'); goMaint('vdoc');}],
    ['항해일지', ()=>switchTab('voyage')],
    ['달력', ()=>switchTab('cal')],
    ['커뮤니티', ()=>switchTab('community')],
    ['오늘', ()=>switchTab('today')]
  ];
  const out=[];
  for(const [이름, fn] of 화면){
    try{ await p.evaluate('(' + fn.toString() + ')()'); }catch(e){ out.push('=== '+이름+' — 못 열었습니다: '+e); continue; }
    await p.waitForTimeout(900);
    const t = await p.evaluate(()=>{
      const m=document.getElementById('main')||document.body;
      return (m.innerText||'').replace(/\n{2,}/g,'\n').trim();
    });
    out.push('===== '+이름+' =====\n'+t);
  }
  // 서랍
  try{ await p.evaluate(()=>{ try{ openDrawer(); }catch(_){ const d=document.getElementById('drawer'); if(d)d.classList.add('open'); } }); }catch(_){}
  await p.waitForTimeout(600);
  const dr = await p.evaluate(()=>{ const d=document.getElementById('drawer'); return d?(d.innerText||'').replace(/\n{2,}/g,'\n').trim():'(없음)'; });
  out.push('===== 서랍 =====\n'+dr);
  const nav = await p.evaluate(()=>{ const n=document.querySelector('.nav')||document.querySelector('nav'); return n?(n.innerText||'').replace(/\n+/g,' | '):'(없음)'; });
  out.push('===== 아래 단추줄 =====\n'+nav);
  fs.writeFileSync('/tmp/jadump.txt', out.join('\n\n'));
  console.log('썼습니다: /tmp/jadump.txt  ('+out.join('').length+'자)');
  await b.close(); srv.close();
})().catch(e=>{ console.log('터졌습니다: '+e); process.exit(1); });
