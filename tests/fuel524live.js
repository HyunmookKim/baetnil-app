// 5.24 — 연료 화면·입항 단추·빈 항해 채우기·연료 게이지를 **실제 화면에서** 눌러 본다
// 사장님 백업(2026-09-30)과 같은 모양의 기록을 넣고 돌린다.
const { chromium } = require('playwright');
const http=require('http'), fs=require('fs'), path=require('path');
const FILE = path.resolve(process.argv[2] || 'work.html');
const ROOT = path.dirname(FILE);
const SHOT = process.env.SHOT_DIR || '';
const server = http.createServer((rq,rs)=>{ const u=rq.url.split('?')[0]; const f = u==='/'?FILE:path.join(ROOT,u);
  fs.readFile(f,(e,d)=>{ if(e){rs.writeHead(404);rs.end();return;} rs.writeHead(200); rs.end(d); }); });
let ok=0,bad=0;
const T=(n,c,w)=>{ if(c){ok++;console.log('통과: '+n);} else {bad++;console.log('★ 실패: '+n+(w!==undefined?' — '+JSON.stringify(w).slice(0,300):''));} };
(async()=>{
  await new Promise(r=>server.listen(0,r));
  const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const ctx=await br.newContext({ locale:'ko-KR', timezoneId:'Asia/Seoul', viewport:{width:411,height:960},isMobile:true,hasTouch:true});
  await ctx.route(/googleapis|gstatic|firebaseio|firestore|open-meteo/, r=>r.abort());
  const pg=await ctx.newPage();
  const errs=[]; pg.on('pageerror',e=>errs.push(String(e).slice(0,200)));
  const told=[];
  await pg.exposeFunction('__told', m => told.push(String(m)));
  await pg.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'domcontentloaded'});
  await pg.waitForTimeout(1500);
  await pg.evaluate(()=>{ window.tell=(m)=>{ try{ window.__told(m); }catch(_){} return Promise.resolve(); };
    window.ask=()=>Promise.resolve(true);
    try{skipWelcome();}catch(_){} unlocked=true; openBoatSetup(); });
  await pg.waitForTimeout(400);
  await pg.evaluate(()=>{ document.getElementById('nbName').value='시험호'; createBoat(); });
  await pg.waitForTimeout(1500);
  const how0 = await pg.evaluate(()=>{ goMaint('fuel'); renderFuel(); return { how: fuelHow(),
    st: [...document.querySelectorAll('#fuelList .stat')].map(x=>x.innerText.replace(/\s+/g,' ').trim()) }; });
  T('★★★ 5.25 — 새 배는 연료 게이지로 시작한다 (사장님: 「더 정확한 방식으로」)',
    how0.how === 'gauge' && how0.st.some(s=>/연료 게이지/.test(s)) && !how0.st.some(s=>/잔량 추정/.test(s)), how0);
  // ── 사장님 기록 모양
  await pg.evaluate(()=>{
    const b = curBoat(); b.spec = Object.assign({}, b.spec || {}, { fuelTank: 240 });
    b.fuelSet = { mark: { left: 0, hours: 43.846666666666664, date: '2026-09-30' } };
    fuel.length = 0; runs.length = 0; voyage.length = 0;
    fuel.push({ id:'1785662659211', date:'2026-08-02', liters:'10', full:false },
              { id:'1786090836207-1', date:'2026-08-07', liters:'10', full:true },
              { id:'1786324287852-1', date:'2026-08-10', liters:'8', full:true },
              { id:'1786939667985-1', date:'2026-08-17', liters:'15', full:true },
              { id:'1790750158432-9', date:'2026-09-30', time:'15:35', liters:'100', full:false });
    runs.push({ id:'r1', date:'2026-09-30', time:'15:30', endDate:'2026-09-30', endTime:'16:22', on:false, hours:0.87, purpose:'충전' });
    const V = (d, o, i, e, logs) => ({ id:'v'+d+o, date:d, timeOut:o, timeIn:i, engineH:e, hours:e === '' ? '' : e, logs: logs || [] });
    voyage.push(V('2026-08-09','06:44','11:30',2.9), V('2026-08-11','10:38','14:42',2), V('2026-08-13','10:55','15:50',1.7),
                V('2026-08-15','10:56','13:18',1), V('2026-08-17','13:36','18:04',1.9),
                V('2026-09-01','10:00','20:00',26.6),
                V('2026-09-12','10:35','12:47',''), V('2026-09-12','14:45','16:32',''),
                V('2026-09-26','15:51','17:33','', [ { id:'l1', time:'16:13', kind:'세일 올림' }, { id:'l2', time:'17:16', kind:'세일 내림' } ]),
                V('2026-09-29','12:30','14:32',''));
    saveMR();
  });
  // ── 받아온 뒤 고치는 문 (클라우드 받기와 같은 자리)
  const fx = await pg.evaluate(()=>{ const r = runFormatFixers();
    return { r, at: curBoat().fuelSet.mark.at, filled: voyage.filter(v=>v.engineH !== '' && v.date >= '2026-09-12').map(v=>v.engineH) }; });
  T('★★★ 받아온 뒤 옛 잔량의 때를 박는다 (9/30 15:34)', fx.at === new Date('2026-09-30T15:34:00+09:00').getTime(), fx);
  T('★★★ 엔진 시간이 빈 항해 넷을 채운다', fx.filled.length === 4 && fx.filled.join(',') === '2.2,1.8,0.7,2', fx);
  await pg.waitForTimeout(1000);
  T('★★★ 사람에게 몇 개를 채웠는지 말한다', told.some(m => /항해 4개를/.test(m)), told);
  // ── 연료 화면
  await pg.evaluate(()=>{ goMaint('fuel'); });
  await pg.waitForTimeout(500);
  const scr = await pg.evaluate(()=>{ const L=document.getElementById('fuelList'); renderFuel();
    const st=[...L.querySelectorAll('.stat')].map(x=>x.innerText.replace(/\s+/g,' ').trim());
    return { st, txt: L.innerText }; });
  const 잔량 = parseFloat((scr.st[0]||'').split(' ')[0]);
  T('★★★ 잔량이 9/30 확인(0L) + 100L − 그 뒤 충전분이다 (90~100)', 잔량 > 90 && 잔량 < 100, scr.st);
  const lph = parseFloat((scr.st[2]||'').split(' ')[0]);
  T('★★★ L/시간이 3.0 이 아니다 — 실제로 쓴 240L 가 들어갔다', lph > 4, scr.st);
  T('★★★ 앱이 보던 양과 실제가 달랐다고 말한다', /잔량 확인 때 앱은 \d+L 남았다고 봤는데 실제는 0L였습니다/.test(scr.txt), scr.txt.slice(0,600));
  T('★★★ 잔량 설명에 확인 뒤 넣은 100L 가 나온다', /0L에 그 뒤 넣은 100L를 더하고/.test(scr.txt), scr.txt.slice(0,900));
  T('★★ 잔량 확인 방법 줄이 있다', /잔량 확인 방법/.test(scr.txt) && /앱 추정/.test(scr.txt) && /연료 게이지/.test(scr.txt));
  if(SHOT) await pg.screenshot({ path: path.join(SHOT, 'fuel524-est.png'), fullPage: false });
  // ── 지금 잔량을 적는다 → 기록이 쌓이고 목록에 보인다
  await pg.evaluate(()=>{ fuelEditLeft(); });
  await pg.waitForTimeout(300);
  const sub = await pg.evaluate(()=> (document.getElementById('formSub')||{}).textContent || '');
  await pg.evaluate(()=>{ const i=document.getElementById('ff0'); if(i) i.value='80'; formOk(); });
  await pg.waitForTimeout(400);
  const lv = await pg.evaluate(()=>({ n: fuel.filter(f=>f.kind==='level').length, txt: document.getElementById('fuelList').innerText }));
  T('★★★ 지금 잔량이 「잔량 확인」 으로 쌓인다', lv.n === 1 && /잔량 80 L/.test(lv.txt) && /잔량 확인/.test(lv.txt), lv);
  T('★★ 적는 창이 뜬다', sub.length > 10, sub);
  // ── 입항 단추 — 항해·엔진 시간이 저절로
  const arr = await pg.evaluate(()=>{
    const p = n => String(n).padStart(2,'0'), d = new Date(Date.now() - 3 * 3600e3);
    const v = { id: 'arr1', date: today(), timeOut: p(d.getHours()) + ':' + p(d.getMinutes()), timeIn:'', engineH:'', hours:'',
      logs: [ { id:'x1', time: p(new Date(Date.now() - 2 * 3600e3).getHours()) + ':' + p(d.getMinutes()), kind:'세일 올림' } ] };
    voyage.push(v); saveMR(); openMR('voyage', 'arr1'); arriveNow();
    const it = voyage.find(x=>x.id==='arr1');
    return { hours: it.hours, engineH: it.engineH, dateIn: it.dateIn, today: today() }; });
  T('★★★ 「지금 도착」 하나로 항해 시간이 들어간다 (약 3시간)', Math.abs(arr.hours - 3) <= 0.1, arr);
  T('★★★ 엔진 시간도 들어간다 — 세일 올린 뒤는 뺀다 (약 1시간)', Math.abs(arr.engineH - 1) <= 0.1, arr);
  T('★★★ 도착 날짜가 오늘로 들어간다', arr.dateIn === arr.today, arr);
  await pg.waitForTimeout(500);
  const form = await pg.evaluate(()=>{ openMR('voyage','arr1'); return !!document.querySelector('input[type=date][onchange^="voyDateIn"]'); });
  T('★★★ 도착 칸에 날짜 칸이 있다', form);
  // ── 연료 게이지 배
  await pg.evaluate(()=>{ closeMR && closeMR(); fuelHowSet('gauge'); });
  await pg.waitForTimeout(300);
  const g = await pg.evaluate(()=>{ const L=document.getElementById('fuelList'); renderFuel();
    const st=[...L.querySelectorAll('.stat')].map(x=>x.innerText.replace(/\s+/g,' ').trim());
    openMR('voyage','arr1');
    const btns = [...document.querySelectorAll('button[onclick^="voyGauge("]')].map(b=>b.textContent.trim());
    return { st, btns }; });
  T('★★★ 게이지 배는 추정 칸 대신 게이지 칸을 보인다', g.st.some(s=>/연료 게이지/.test(s)) && !g.st.some(s=>/잔량 추정/.test(s)), g.st);
  T('★★★ 출항·입항 칸에 눈금 다섯이 두 번 있다', g.btns.join('') === 'E¼½¾FE¼½¾F', g.btns);
  const gg = await pg.evaluate(()=>{ voyGauge('in','1/2'); voyGauge('in','3/4');
    const r = fuel.filter(f=>f.kind==='level' && f.vid==='arr1');
    return r.map(x=>({ g: x.gauge, l: x.level, leg: x.leg })); });
  T('★★★ 눈금을 누르면 잔량 확인이 쌓이고, 다시 누르면 그것을 고친다 (¾ = 180L)',
    gg.length === 1 && gg[0].g === '3/4' && gg[0].l === 180 && gg[0].leg === 'in', gg);
  if(SHOT){ await pg.evaluate(()=>{ closeMR && closeMR(); goMaint('fuel'); }); await pg.waitForTimeout(300);
            await pg.screenshot({ path: path.join(SHOT, 'fuel524-gauge.png'), fullPage: false }); }
  // ── 영어·러시아어·일본어로도 한국어가 새지 않는다 (언어를 바꾸면 앱이 다시 켜진다)
  T('오류가 없다 (한국어)', errs.length === 0, errs.slice(0,3));
  for(const lg of ['en','ru','ja']){
    await pg.evaluate((lg)=>{ localStorage.setItem('bt_lang', lg); }, lg);
    await pg.reload({ waitUntil:'domcontentloaded' });
    await pg.waitForTimeout(1800);
    const leak = await pg.evaluate(()=>{ try{ skipWelcome(); }catch(_){} unlocked = true;
      fuelHowSet('est'); goMaint('fuel'); renderFuel();
      const s = document.getElementById('fuelList').innerText;
      return { w: (s.match(/[가-힣]+/g) || []).filter(w => !/시험호/.test(w)).slice(0, 8), head: s.slice(0, 200) }; });
    T(lg + ' 연료 화면에 한국어가 안 남는다', leak.w.length === 0 && leak.head.length > 20, leak);
    const v = await pg.evaluate(()=>{ fuelHowSet('gauge'); openMR('voyage','arr1');
      const s = (document.getElementById('mrBody') || document.body).innerText;
      const g = [...document.querySelectorAll('button[onclick^="voyGauge("]')].length;
      fuelHowSet('est'); return g; });
    T(lg + ' 항해 기록에 게이지 줄이 뜬다', v === 10, v);
  }
  await pg.evaluate(()=>{ localStorage.setItem('bt_lang', 'ko'); });
  T('오류가 없다', errs.length === 0, errs.slice(0,3));
  await br.close(); server.close();
  console.log(`\n통과 ${ok} · 실패 ${bad}`); process.exit(bad?1:0);
})().catch(e=>{ console.log('★ 실패: 검사가 멈춤 — '+e); process.exit(1); });
