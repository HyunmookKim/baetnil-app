// 기록 창 「되돌리고 닫기」 — 진짜 브라우저에서 눌러 본다.
//
// ★ 왜 이 검사가 있나
//   이 창의 칸들은 글자를 넣고 칸을 벗어나는 순간 이미 저장된다(onchange → saveMR).
//   그래서 「저장 안 하고 닫기」 가 아예 없었다 — 안 저장할 것이 남아 있지 않다.
//   잘못 건드렸을 때 되돌릴 길이 없었다.
//
//   조심할 곳이 하나 있다. 칸 하나를 고치면 openMR 이 다시 도는데,
//   그때 또 찍어 두면 방금 고친 것이 '처음 모습' 이 되어 되돌릴 것이 없어진다.
//   여기서 그것을 본다.
const { chromium } = require('playwright');
const http=require('http'), fs=require('fs'), path=require('path');
const FILE = process.argv[2] || 'work.html';
const server = http.createServer((rq,rs)=>{
  const f = rq.url==='/' ? (path.isAbsolute(FILE)?FILE:path.join(__dirname,FILE))
                          : path.join(__dirname, rq.url.split('?')[0]);
  fs.readFile(f,(e,d)=>{ if(e){rs.writeHead(404);rs.end();return;}
    if(f.endsWith('.woff2')) rs.setHeader('Content-Type','font/woff2');
    rs.writeHead(200); rs.end(d); });
});
let ok=0,bad=0;
const T=(n,c,w)=>{ if(c){ok++;console.log('통과: '+n);}
  else{bad++;console.log('★ 실패: '+n+(w!==undefined?' — '+JSON.stringify(w).slice(0,240):''));} };

(async()=>{
  await new Promise(r=>server.listen(0,r));
  const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const ctx=await br.newContext({ locale:'ko-KR',viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const pg=await ctx.newPage();
  const errs=[]; pg.on('pageerror',e=>errs.push(String(e).slice(0,140)));
  await pg.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'networkidle'});
  await pg.waitForTimeout(900);
  // ★ 앱은 window.confirm 을 안 쓴다. 자기 창(ask)을 띄운다.
  //   예전 검사가 confirm 을 가로채고 있어서 「안 물어본다」고 헛되이 실패했다.
  await pg.evaluate(()=>{ window.__al=[]; window.__yes=true;
    window.alert=m=>window.__al.push(String(m).replace(/\n+/g,' / '));
    window.confirm=m=>{ window.__al.push('confirm: '+String(m).replace(/\n+/g,' / ')); return window.__yes; };
    window.ask=m=>{ window.__al.push('confirm: '+String(m).replace(/\n+/g,' / ')); return Promise.resolve(window.__yes); };
    window.tell=m=>{ window.__al.push(String(m).replace(/\n+/g,' / ')); return Promise.resolve(); };
    try{skipWelcome();}catch(_){} unlocked=true; openBoatSetup(); });
  await pg.waitForTimeout(400);
  await pg.evaluate(()=>{ document.getElementById('nbName').value='시험호'; createBoat(); });
  await pg.waitForTimeout(1500);

  // ★ 4.102 — 「되돌리고 닫기」 는 이제 늘 붙어 있고 **보였다 숨었다** 한다.
  //   글자 하나 고치는 순간 떠야 하는데(사장님 지적), 그러려면 창을 다시 그리지 않고
  //   보이기만 바꿔야 한다. 그래서 여기서도 **눈에 보이는 것**만 센다.
  const btns = ()=>pg.evaluate(()=>[...document.querySelectorAll('#mrPanel .mrtop button')]
    .filter(b => getComputedStyle(b).display !== 'none')
    .map(b=>b.innerText.trim()));

  // ── ① 안 건드렸으면 단추가 안 나온다
  await pg.evaluate(()=>{
    maint=[{id:'m1',name:'엔진오일 교체',grp:'엔진',months:12,unit:'m',lastDate:'2025-07-14',note:'처음 메모'}];
    saveMR(); switchTab('boat'); setBoatSubTab('maint'); });
  await pg.waitForTimeout(700);
  await pg.evaluate(()=>openMR('maint','m1'));
  await pg.waitForTimeout(600);
  const b0 = await btns();
  T('처음 열면 「되돌리고 닫기」 가 없다', !b0.some(x=>/되돌리고/.test(x)), b0);
  T('「저장 후 닫기」 는 있다', b0.some(x=>/저장 후 닫기/.test(x)), b0);

  // ── ② 한 칸 고치면 단추가 나온다
  await pg.evaluate(()=>mrField('name','바뀐 이름'));
  await pg.waitForTimeout(600);
  const b1 = await btns();
  T('★ 고치면 「되돌리고 닫기」 가 나온다', b1.some(x=>/되돌리고/.test(x)), b1);
  T('자료가 실제로 바뀌었다', (await pg.evaluate(()=>maint[0].name)) === '바뀐 이름');

  // ── ③ ★ 두 번 고쳐도 처음 모습이 안 흔들린다
  //    (칸을 고칠 때마다 openMR 이 다시 도는데, 그때 또 찍으면 되돌릴 것이 없어진다)
  await pg.evaluate(()=>mrField('note','두 번째 메모'));
  await pg.waitForTimeout(600);
  const snap = await pg.evaluate(()=>({ 이름:mrSnap.name, 메모:mrSnap.note, 지금이름:maint[0].name }));
  T('★ 찍어 둔 것이 창을 연 그때 모습 그대로다',
    snap.이름 === '엔진오일 교체' && snap.메모 === '처음 메모', snap);

  // ── ④ 되돌리면 둘 다 처음으로 돌아간다
  await pg.evaluate(()=>{ window.__al=[]; window.__yes=true; mrRevertClose(); });
  await pg.waitForTimeout(700);
  const after = await pg.evaluate(()=>({
    이름:maint[0].name, 메모:maint[0].note, 주기:maint[0].months,
    창열림:document.getElementById('mrPanel').classList.contains('open'),
    말:window.__al }));
  T('★ 되돌리면 이름이 처음으로 돌아간다', after.이름 === '엔진오일 교체', after);
  T('★ 메모도 함께 돌아간다', after.메모 === '처음 메모', after);
  T('안 건드린 칸은 그대로다', after.주기 === 12, after);
  T('버리기 전에 한 번 묻는다', (after.말||[]).some(x=>/confirm.*버리고 닫을까요/.test(x)), after.말);
  T('되돌린 뒤 창이 닫힌다', after.창열림 === false, after);

  // ── ⑤ 아니오를 누르면 아무 일도 없다
  await pg.evaluate(()=>{ openMR('maint','m1'); });
  await pg.waitForTimeout(500);
  await pg.evaluate(()=>mrField('name','또 바꿈'));
  await pg.waitForTimeout(500);
  await pg.evaluate(()=>{ window.__yes=false; mrRevertClose(); });
  await pg.waitForTimeout(500);
  const no = await pg.evaluate(()=>({ 이름:maint[0].name,
    창열림:document.getElementById('mrPanel').classList.contains('open') }));
  T('아니오면 안 되돌린다', no.이름 === '또 바꿈', no);
  T('아니오면 창도 안 닫힌다', no.창열림 === true, no);
  await pg.evaluate(()=>{ window.__yes=true; });

  // ── ⑥ 닫았다 다시 열면 그때 모습으로 새로 찍는다
  await pg.evaluate(()=>{ closeMR(); });
  await pg.waitForTimeout(400);
  T('닫으면 찍어 둔 것도 버린다', (await pg.evaluate(()=>mrSnap === null)));
  await pg.evaluate(()=>{ openMR('maint','m1'); });
  await pg.waitForTimeout(500);
  const b2 = await btns();
  T('★ 다시 열면 「되돌리고 닫기」 가 다시 사라진다 (지금이 처음 모습이다)',
    !b2.some(x=>/되돌리고/.test(x)), b2);
  T('찍어 둔 것이 지금 값이다', (await pg.evaluate(()=>mrSnap.name)) === '또 바꿈');

  // ── ⑦ 항해일지 — 중간 기록처럼 안에 든 것도 되돌아간다
  const voy = await pg.evaluate(()=>{
    closeMR();
    voyage=[{id:'v1',date:'2026-08-10',title:'개도 한 바퀴',from:'여수',to:'여수',
             logs:[{id:'g1',time:'09:30',kind:'세일 올림',text:'제노아 폄'}]}];
    saveMR(); switchTab('voyage'); renderVoyage(); openMR('voyage','v1');
    return true; });
  await pg.waitForTimeout(700);
  await pg.evaluate(()=>{ logField('g1','text','엉뚱하게 고침'); });
  await pg.waitForTimeout(700);
  const vDirty = await pg.evaluate(()=>({ 지금:voyage[0].logs[0].text, 더러움:mrDirty() }));
  T('중간 기록을 고치면 바뀐 것으로 센다', vDirty.더러움 === true && vDirty.지금 === '엉뚱하게 고침', vDirty);
  await pg.evaluate(()=>{ window.__yes=true; mrRevertClose(); });
  await pg.waitForTimeout(700);
  const vBack = await pg.evaluate(()=>voyage[0].logs[0].text);
  T('★ 중간 기록도 처음으로 돌아간다', vBack === '제노아 폄', vBack);

  // ── ⑧ 사진 글자를 통째로 베끼지 않는다 (한 장에 수백 KB 다)
  const big = await pg.evaluate(()=>{
    closeMR();
    const s = 'data:image/png;base64,' + 'A'.repeat(300000);
    maint[0].photos = [s];
    saveMR(); openMR('maint','m1');
    return { 같은글자: mrSnap.photos[0] === maint[0].photos[0],
             더러움: mrDirty() }; });
  await pg.waitForTimeout(400);
  T('★ 사진은 같은 글자를 가리킨다 (베끼지 않는다)', big.같은글자 === true, big);
  T('사진만 있고 안 건드렸으면 바뀐 것이 아니다', big.더러움 === false, big);

  T('앱이 터지지 않았다', errs.length===0, errs.slice(0,2));
  console.log('\n합계: '+ok+'개 통과 / '+bad+'개 실패');
  await br.close(); server.close();
  process.exit(bad?1:0);
})();
