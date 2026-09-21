// 4.88 — 「가나다순」은 눌러서 돌리는 것이 아니라, 밑으로 펼쳐 고른다
//
// ★ 사장님 지적 — 「누를 때마다 자꾸 변경되는데 저렇게 하면 불편하다.
//   저걸 누르면 어떤 순서로 볼 수 있는지 다 볼 수 있게 해서 거기서 고르게 해라.
//   밑으로 쫙 나오는 메뉴, 디자인은 저대로.」
const { chromium } = require('playwright');
const http=require('http'), fs=require('fs'), path=require('path');
const FILE = process.argv[2] || 'work.html';
const server = http.createServer((rq,rs)=>{
  const f = ((rq.url === '/' && path.isAbsolute(FILE)) ? FILE : path.join(__dirname, rq.url === '/' ? FILE : rq.url.split('?')[0]));
  fs.readFile(f,(e,d)=>{ if(e){rs.writeHead(404);rs.end();return;}
    if(f.endsWith('.woff2')) rs.setHeader('Content-Type','font/woff2');
    rs.writeHead(200); rs.end(d); });
});
let ok=0,bad=0;
const T=(n,c,w)=>{ if(c){ok++;console.log('통과: '+n);}
  else{bad++;console.log('★ 실패: '+n+(w!==undefined?' — '+JSON.stringify(w).slice(0,220):''));} };

(async()=>{
  await new Promise(r=>server.listen(0,r));
  const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const ctx=await br.newContext({ locale:'ko-KR',viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const pg=await ctx.newPage();
  const errs=[]; pg.on('pageerror',e=>errs.push(String(e).slice(0,140)));
  await pg.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'networkidle'});
  await pg.waitForTimeout(900);
  await pg.evaluate(()=>{ window.tell=()=>Promise.resolve(); window.ask=()=>Promise.resolve(true);
    try{skipWelcome();}catch(_){} unlocked=true; openBoatSetup(); });
  await pg.waitForTimeout(400);
  await pg.evaluate(()=>{ document.getElementById('nbName').value='시험호'; createBoat(); });
  await pg.waitForTimeout(1500);
  await pg.evaluate(()=>{ setBoatSubTab('stow'); }); await pg.waitForTimeout(700);

  const 누르기 = async name => {
    const el = await pg.$('#sortTab');
    if(!el){ T('★ '+name+' — 「가나다순」 단추가 화면에 있다', false); return false; }
    await el.click(); await pg.waitForTimeout(350); return true;
  };
  const 글자 = () => pg.evaluate(()=>document.getElementById('sortTab').textContent.trim());
  const 열림 = () => pg.evaluate(()=>{
    const o=document.getElementById('pmOv');
    return !!(o && o.classList.contains('open'));
  });
  const 줄들 = () => pg.evaluate(()=>
    [...document.querySelectorAll('#pmBox button')].map(b=>b.textContent.trim()));

  // ── 1. 단추가 「펼쳐진다」 는 것을 스스로 말한다 ──────────────────────
  T('★ 단추에 지금 순서와 ▾ 가 함께 보인다', /가나다순/.test(await 글자()) && /▾/.test(await 글자()), await 글자());
  T('★ 열기 전에는 차림표가 닫혀 있다', (await 열림()) === false);

  // ── 2. 누르면 밑으로 펼쳐지고, 고를 수 있는 것이 전부 보인다 ──────────
  await 누르기('첫 번째');
  T('★★★ 누르면 차림표가 펼쳐진다 — 순서가 바로 바뀌지 않는다', await 열림());
  const 목 = await 줄들();
  T('★★★ 고를 수 있는 순서가 다섯 가지 다 보인다', 목.length === 5, 목);
  ['가나다순','추가순','사진순','상자순','수량순'].forEach(w =>
    T('★ 「'+w+'」 이(가) 차림표에 있다', 목.indexOf(w) >= 0, 목));
  T('★★ 지금 고른 것이 표시돼 있다',
    await pg.evaluate(()=>{ const e=document.querySelector('#pmBox button.on'); return e && e.textContent.trim(); }) === '가나다순');
  T('★ 한 번 눌렀다고 순서가 바뀌지는 않았다',
    await pg.evaluate(()=>sortMode) === 'name');

  // ── 3. 단추 「바로 밑」 에 붙는다 (떠 있는 딴 판이 아니다) ─────────────
  const 자리 = await pg.evaluate(()=>{
    const b=document.getElementById('sortTab').getBoundingClientRect();
    const m=document.getElementById('pmBox').getBoundingClientRect();
    return { 틈: Math.round(m.top - b.bottom), 왼쪽차: Math.round(Math.abs(m.left - b.left)),
             오른끝: Math.round(m.right), 화면폭: innerWidth };
  });
  T('★★★ 차림표가 단추 바로 밑에 붙는다 (0~14px)', 자리.틈 >= 0 && 자리.틈 <= 14, 자리);
  T('★★ 단추와 왼쪽이 맞는다', 자리.왼쪽차 <= 2, 자리);
  T('★★ 화면 밖으로 안 나간다', 자리.오른끝 <= 자리.화면폭, 자리);

  // ── 4. 골라야 바뀐다 ─────────────────────────────────────────────────
  const 골랐나 = await pg.evaluate(()=>{
    const b=[...document.querySelectorAll('#pmBox button')].find(x=>x.textContent.trim()==='수량순');
    if(!b) return false; b.click(); return true; });
  T('★ 「수량순」 을 누를 수 있다', 골랐나);
  await pg.waitForTimeout(400);
  T('★★★ 고른 뒤에야 순서가 바뀐다', await pg.evaluate(()=>sortMode) === 'qty');
  T('★★★ 고르면 차림표가 닫힌다', (await 열림()) === false);
  T('★★ 단추 글자가 고른 것으로 바뀐다', /수량순/.test(await 글자()) && /▾/.test(await 글자()), await 글자());

  // ── 5. 뒤로 가기가 차림표부터 걷는다 (화면을 나가면 안 된다) ──────────
  await 누르기('두 번째');
  T('★ 다시 펼쳤다', await 열림());
  const 전 = await pg.evaluate(()=>navSpot());
  await pg.evaluate(()=>{ try{ navDoBack(); }catch(_){} }); await pg.waitForTimeout(400);
  T('★★★ 뒤로 가면 차림표만 닫힌다', (await 열림()) === false);
  T('★★★ 화면은 그대로 있다 — 적재표를 나가지 않는다',
    await pg.evaluate(()=>navSpot()) === 전, [전, await pg.evaluate(()=>navSpot())]);

  // ── 6. 바깥을 눌러도 닫힌다 ──────────────────────────────────────────
  await 누르기('세 번째');
  await pg.evaluate(()=>document.getElementById('pmOv').click());
  await pg.waitForTimeout(300);
  T('★★ 바깥을 누르면 닫힌다', (await 열림()) === false);

  // ── 7. 말을 바꿔도 ▾ 가 안 사라진다 ──────────────────────────────────
  await pg.evaluate(()=>{ try{ setLang('en'); }catch(_){ } }); await pg.waitForTimeout(600);
  const 영 = await 글자();
  T('★★★ 영어로 바꿔도 ▾ 가 남는다 (사전이 덮어쓰지 않는다)', /▾/.test(영), 영);
  T('★★ 영어로 옮겨진다', !/[가-힣]/.test(영), 영);
  await pg.evaluate(()=>{ try{ setLang('ko'); }catch(_){ } }); await pg.waitForTimeout(500);

  T('★ 화면 오류가 없다', errs.length === 0, errs);
  console.log('\n통과 '+ok+' · 실패 '+bad);
  await br.close(); server.close(); process.exit(bad?1:0);
})();
