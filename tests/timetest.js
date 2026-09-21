// 시각 칸 — 숫자만 쳐서 넣을 수 있는가.
//
// ★ 왜 이 검사가 있나
//   시각 칸을 전부 <input type="time"> 으로 만들어 뒀다. 폰에서 이걸 열면 바늘시계가 뜬다.
//   흔들리는 배 위에서 바늘을 돌려 18:30 을 맞추는 것은 고역이다.
//   특히 항해일지의 도착 시각은 나중에 손으로 적어야 하는데 그때마다 이 짓을 해야 했다.
//
//   이제 숫자만 친다. 1830 → 18:30. 콜론은 앱이 넣는다.
//   폰에서는 inputmode=numeric 이라 숫자 자판이 바로 올라온다.
const { chromium } = require('playwright');
const http=require('http'), fs=require('fs'), path=require('path');
const FILE = process.argv[2] || 'work.html';
// 인자로 절대경로를 주면 그대로 쓴다 (전에는 __dirname 을 무조건 붙여 ENOENT 가 났다)
const ABS = path.isAbsolute(FILE) ? FILE : path.join(__dirname, FILE);
const src = fs.readFileSync(ABS, 'utf8');
const server = http.createServer((rq,rs)=>{
  const f = rq.url==='/' ? ABS : path.join(__dirname, rq.url.split('?')[0]);
  fs.readFile(f,(e,d)=>{ if(e){rs.writeHead(404);rs.end();return;}
    if(f.endsWith('.woff2')) rs.setHeader('Content-Type','font/woff2');
    rs.writeHead(200); rs.end(d); });
});
let ok=0,bad=0;
const T=(n,c,w)=>{ if(c){ok++;console.log('통과: '+n);}
  else{bad++;console.log('★ 실패: '+n+(w!==undefined?' — '+JSON.stringify(w).slice(0,220):''));} };

// ── ① 바늘시계가 남아 있지 않은가 (주석은 빼고 센다)
{
  const body = src.replace(/^\s*\/\/.*$/gm, '');
  T('★ 바늘시계(type="time") 가 한 곳도 안 남았다',
    !/type="time"/.test(body), (body.match(/.{0,60}type="time".{0,40}/)||[''])[0]);
  // ★ 개수를 박아 두면 시각 칸이 하나 늘 때마다 검사가 깨진다 (4.30 에서 밤 시간 칸 둘이 늘었다).
  //   보아야 할 것은 「시각을 받는 칸이 모두 같은 방식인가」다 —
  //   네 자리로 치고(hmType), 저장할 때 걸러 낸다(hmChange).
  // ★ 5.0 — 시각 칸을 하나하나 적어 두지 않고 hmField() 한 곳에서 찍어 낸다.
  //   그래서 여기서 볼 것은 「칸이 몇 개인가」가 아니라
  //   ① 시각 칸을 찍는 자리가 정말 그 한 곳뿐인가 (샛길로 만든 칸이 없는가)
  //   ② 그 한 곳이 네 자리 방식을 다 갖췄는가
  //   ③ 시각을 받는 자리가 네 곳 이상 그 한 곳을 쓰는가 — 이다.
  {
    const n = (src.match(/class="tin logtime"/g) || []).length;
    T('시각 칸을 찍는 자리가 한 곳뿐이다 (hmField) — ' + n, n === 1, n);
    T('그 한 곳이 hmField 안에 있다', /function hmField\(/.test(src)
      && (src.match(/function hmField\(/g) || []).length === 1);

    // hmField 안쪽만 떼어 본다
    const i = src.indexOf('function hmField(');
    const F = i < 0 ? '' : src.slice(i, i + 900);
    T('치는 대로 다듬는다 (hmType)', /oninput="hmType\(this\)/.test(F), F.slice(0,0));
    T('나갈 때 걸러 저장한다 (hmChange)', /onchange="hmChange\(this, \$\{set\}\)"/.test(F));
    T('숫자 자판이 올라오게 해 뒀다', /inputmode="numeric"/.test(F));
    T('다섯 자를 넘겨 못 치게 막았다', /maxlength="5"/.test(F));

    // 시각을 받는 자리가 몇 곳인가 — hmField / hmRow 를 부르는 곳을 센다 (선언은 뺀다)
    const calls = (src.match(/\bhmField\(/g) || []).length - 1
                + (src.match(/\bhmRow\(/g) || []).length - 1;
    T('시각을 받는 자리가 네 곳 이상이고 모두 그 한 곳을 쓴다 — ' + calls, calls >= 4, calls);
  }
}

(async()=>{
  await new Promise(r=>server.listen(0,r));
  const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const ctx=await br.newContext({ locale:'ko-KR',viewport:{width:390,height:844},isMobile:true,hasTouch:true,timezoneId:'Asia/Seoul'});
  const pg=await ctx.newPage();
  const errs=[]; pg.on('pageerror',e=>errs.push(String(e).slice(0,140)));
  await pg.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'networkidle'});
  await pg.waitForTimeout(900);
  await pg.evaluate(()=>{ window.__al=[];
    window.alert=m=>window.__al.push(String(m).replace(/\n+/g,' / '));
    window.confirm=()=>true;
    // ★ 앱은 alert/confirm 을 안 쓴다 — 자기 창(tell/ask). 안 가로채면 그 창이
    //   화면을 덮어(#tellOv) 뒤의 누르기가 전부 막힌다.
    window.tell=m=>{ window.__al.push(String(m).replace(/\n+/g,' / ')); return Promise.resolve(); };
    // ★ 4.101 — 칸이 잘못됐을 때는 칸 **바로 아래 빨간 한 줄**로 말한다 (알림창이 아니다)
    window.fieldErr=(el,m)=>{ window.__al.push(String(m).replace(/\n+/g,' / ')); return false; };
    window.formErr=(k,m)=>{ window.__al.push(String(m).replace(/\n+/g,' / ')); return false; };
    window.ask =m=>{ window.__al.push(String(m).replace(/\n+/g,' / ')); return Promise.resolve(true); };
    try{skipWelcome();}catch(_){} unlocked=true; openBoatSetup(); });
  await pg.waitForTimeout(400);
  await pg.evaluate(()=>{ document.getElementById('nbName').value='시험호'; createBoat(); });
  await pg.waitForTimeout(1500);

  // ── ② 읽는 셈 — 사람이 칠 법한 것을 다 넣어 본다
  const P = await pg.evaluate(()=>{
    const c = v => { try{ return hmParse(v); }catch(e){ return 'ERR'; } };
    return { 네자리:c('1830'), 콜론:c('18:30'), 세자리:c('830'), 두자리:c('18'),
             한자리:c('7'), 빈칸:c(''), 자정:c('0000'), 막차:c('2359'),
             시각넘침:c('2400'), 분넘침:c('1860'), 글자:c('abc') };
  });
  T('1830 → 18:30', P.네자리 === '18:30', P.네자리);
  T('18:30 은 그대로', P.콜론 === '18:30', P.콜론);
  T('830 → 08:30', P.세자리 === '08:30', P.세자리);
  T('18 → 18:00 (시만 쳐도 된다)', P.두자리 === '18:00', P.두자리);
  T('7 → 07:00', P.한자리 === '07:00', P.한자리);
  T('빈칸은 「지움」 이다 (흠이 아니다)', P.빈칸 === '', P.빈칸);
  T('0000 · 2359 는 들어간다', P.자정 === '00:00' && P.막차 === '23:59', [P.자정, P.막차]);
  T('★ 2400 은 안 받는다', P.시각넘침 === null, P.시각넘침);
  T('★ 1860 은 안 받는다', P.분넘침 === null, P.분넘침);
  T('글자만 치면 빈 것으로 본다', P.글자 === '', P.글자);

  // ── ③ 치는 동안 콜론이 저절로 들어가는가
  const T2 = await pg.evaluate(()=>{
    const el = { value:'' }; const out = [];
    ['1','18','183','1830','18305'].forEach(v=>{ el.value = v; hmType(el); out.push(el.value); });
    return out; });
  T('★ 치는 대로 콜론이 붙는다 (1 → 18 → 18:3 → 18:30)',
    T2[0]==='1' && T2[1]==='18' && T2[2]==='18:3' && T2[3]==='18:30', T2);
  T('다섯 자를 넘겨 쳐도 네 자만 받는다', T2[4] === '18:30', T2[4]);

  // ── ④ 진짜 화면에서 — 항해일지 도착 시각을 손으로 쳐 넣는다
  await pg.evaluate(()=>{
    voyage=[{id:'v1',date:'2026-08-19',title:'',from:'여수',to:'',
             timeOut:'13:36', timeIn:'', logs:[], pub:true}];
    saveMR(); switchTab('voyage'); renderVoyage(); openMR('voyage','v1'); });
  await pg.waitForTimeout(900);
  const box = await pg.evaluate(()=>{
    const ins = [...document.querySelectorAll('#mrPanel input.tin')];
    return { 개수: ins.length, 자판: ins[0] ? ins[0].getAttribute('inputmode') : null,
             바늘: ins.some(e => e.type === 'time'),
             출발: ins[0] ? ins[0].value : null, 도착: ins[1] ? ins[1].value : null }; });
  T('출발·도착 두 칸이 다 있다', box.개수 >= 2, box);
  T('★ 바늘시계가 아니다', box.바늘 === false, box);
  T('숫자 자판이 뜨게 돼 있다', box.자판 === 'numeric', box.자판);
  T('출발은 채워져 있고 도착은 비어 있다', box.출발 === '13:36' && box.도착 === '', box);

  // 도착 칸에 진짜로 「1804」 를 쳐 넣는다
  const el = await pg.$$('#mrPanel input.tin');
  if(el.length >= 2){
    await el[1].scrollIntoViewIfNeeded();
    await el[1].click();
    await el[1].type('1804', { delay: 40 });
    await pg.keyboard.press('Tab');
    await pg.waitForTimeout(900);
    const got = await pg.evaluate(()=>({ 저장:voyage[0].timeIn,
      항해시간: voyage[0].hours, 말: window.__al.slice() }));
    T('★★ 도착 칸에 1804 를 치면 18:04 로 저장된다', got.저장 === '18:04', got);
    // 시각 자체에 대한 군말이 없어야 한다.
    // (이 시험 배에는 날씨 지점이 없어서 날씨 안내가 뜨는데, 그건 원래 그런 것이다)
    T('시각에 대해서는 군말이 없다',
      !(got.말||[]).some(x=>/시각/.test(x)), got.말);
    T('출발·도착으로 항해 시간이 저절로 잡힌다 (4.5h)',
      Math.abs(Number(got.항해시간) - 4.5) < 0.01, got.항해시간);
  }

  // ── ⑤ 이상한 값을 치면 말해 준다
  await pg.evaluate(()=>{ window.__al=[]; voyage[0].timeIn=''; saveMR(); openMR('voyage','v1'); });
  await pg.waitForTimeout(700);
  const el2 = await pg.$$('#mrPanel input.tin');
  if(el2.length >= 2){
    await el2[1].scrollIntoViewIfNeeded();
    await el2[1].click();
    await el2[1].type('2570', { delay: 40 });
    await pg.keyboard.press('Tab');
    await pg.waitForTimeout(700);
    const bad2 = await pg.evaluate(()=>({ 저장:voyage[0].timeIn, 말:window.__al.slice(),
      칸:(document.querySelectorAll('#mrPanel input.tin')[1]||{}).value }));
    T('★ 2570 은 저장 안 한다', !bad2.저장, bad2);
    T('★ 왜 안 되는지 말해 준다 (칸 바로 아래 빨간 한 줄)',
    /0000~2359/.test((bad2.말||[]).join(' ')), bad2.말);
    T('그 칸을 비워 다시 치게 한다', bad2.칸 === '', bad2.칸);
  }

  // ── ⑥ 중간 기록 · 주유 · 엔진 가동에도 같은 칸이 들어갔는가
  const other = await pg.evaluate(()=>{
    const o = {};
    voyage[0].logs = [{id:'g1', time:'09:30', kind:'세일 올림', text:''}];
    saveMR(); openMR('voyage','v1');
    o.중간기록 = [...document.querySelectorAll('#mrPanel input.tin')].length;
    closeMR();
    fuel=[{id:'f1', date:'2026-08-19', time:'10:00', liters:'15', full:true}];
    runs=[{id:'u1', date:'2026-08-19', time:'11:00', hours:'2', purpose:'충전'}];
    saveMR(); switchTab('boat'); setBoatSubTab('fuel');
    openMR('fuel','f1');
    o.주유 = [...document.querySelectorAll('#mrPanel input.tin')].length;
    o.주유값 = (document.querySelector('#mrPanel input.tin')||{}).value;
    closeMR(); openMR('run','u1');
    o.엔진 = [...document.querySelectorAll('#mrPanel input.tin')].length;
    return o; });
  await pg.waitForTimeout(400);
  T('중간 기록에도 있다', other.중간기록 >= 3, other);
  T('주유 기록에도 있다', other.주유 >= 1 && other.주유값 === '10:00', other);
  T('엔진 가동 기록에도 있다', other.엔진 >= 1, other);

  T('앱이 터지지 않았다', errs.length===0, errs.slice(0,2));
  console.log('\n합계: '+ok+'개 통과 / '+bad+'개 실패');
  await br.close(); server.close();
  process.exit(bad?1:0);
})();
