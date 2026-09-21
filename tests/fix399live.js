// 3.99 — 도면 다섯 가지를 진짜 손가락 동작으로 확인한다.
// ★ 다섯 다 '눈으로 봐야만 아는' 흠이었다. 코드 검사로는 못 잡는다.
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
  else{bad++;console.log('★ 실패: '+n+(w!==undefined?' — '+JSON.stringify(w).slice(0,200):''));} };

let pg;
async function mapBox(){ return await pg.evaluate(()=>{
  const r=document.getElementById('map').getBoundingClientRect();
  return {l:r.left,t:r.top,w:r.width,h:r.height}; }); }
async function drag(x0,y0,x1,y1,steps=10){
  const b=await mapBox(); const P=(px,py)=>({x:b.l+b.w*px/100,y:b.t+b.h*py/100});
  const a=P(x0,y0), c=P(x1,y1);
  await pg.mouse.move(a.x,a.y); await pg.mouse.down();
  for(let i=1;i<=steps;i++) await pg.mouse.move(a.x+(c.x-a.x)*i/steps, a.y+(c.y-a.y)*i/steps);
  await pg.mouse.up(); await pg.waitForTimeout(350);
}
const formOpen = ()=>pg.evaluate(()=>{const F=document.getElementById('formOv');
  return !!(F&&getComputedStyle(F).display!=='none');});
const formTxt = ()=>pg.evaluate(()=>{const F=document.getElementById('formOv');
  return (F&&getComputedStyle(F).display!=='none')?F.innerText.replace(/\n{2,}/g,'\n'):'(창 안 뜸)';});
async function fillForm(vals, picks){
  return await pg.evaluate(([v,pk])=>{
    const F=document.getElementById('formOv');
    if(!F||getComputedStyle(F).display==='none') return '(창 안 뜸)';
    const ins=[...F.querySelectorAll('input,textarea')].filter(e=>e.getBoundingClientRect().width>0);
    ins.forEach((el,i)=>{ if(v[i]!==undefined){ el.value=v[i];
      el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})); } });
    (pk||[]).forEach(name=>{ const b=[...F.querySelectorAll('.fopt')]
      .find(x=>(x.innerText||'').indexOf(name)===0); if(b) b.click(); });
    const okb=[...F.querySelectorAll('button')].find(b=>/만들기|확인|저장/.test(b.innerText));
    if(!okb) return '(확인 없음)'; okb.click(); return 'ok';
  }, [vals, picks||[]]);
}
const LK = ()=>pg.evaluate(()=>lockers.map(l=>({id:l.id,n:l.label,x:l.x,y:l.y,w:l.w,h:l.h,deck2:!!l.deck2,wall:!!l.wall})));
const SEEN = ()=>pg.evaluate(()=>[...document.querySelectorAll('#map .box')]
  .map(e=>({id:e.dataset.id,left:e.style.left,top:e.style.top,cls:e.className})));
async function mk(x0,y0,x1,y1,n,z){ await drag(x0,y0,x1,y1); await fillForm([n,z]); await pg.waitForTimeout(350); }

(async()=>{
  await new Promise(r=>server.listen(0,r));
  const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const ctx=await br.newContext({ locale:'ko-KR',viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  pg=await ctx.newPage();
  const errs=[]; pg.on('pageerror',e=>errs.push(String(e).slice(0,150)));
  await pg.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'networkidle'});
  await pg.waitForTimeout(900);
  await pg.evaluate(()=>{ window.__al=[]; window.__yes=true;
    window.alert=m=>window.__al.push(String(m).replace(/\n+/g,' / '));
    window.confirm=m=>{window.__al.push('confirm: '+String(m).slice(0,70));return window.__yes;};
    try{skipWelcome();}catch(_){} unlocked=true; openBoatSetup(); });
  await pg.waitForTimeout(500);
  await pg.evaluate(()=>{document.getElementById('nbName').value='시험호'; createBoat();});
  await pg.waitForTimeout(1100);
  await pg.evaluate(()=>{ switchTab('boat'); setBoatSubTab('stow'); if(!lkEdit) toggleLkEdit(); });
  await pg.waitForTimeout(700);

  // ── ④ 붙기(스냅)
  await mk(10,10,40,35,'선수 창고','선수');
  await mk(40.4,10.6,68.7,34.2,'조리대','갤리');    // 손가락처럼 어중간하게
  const two = await LK();
  T('칸 두 개가 만들어졌다', two.length===2, two);
  if(two.length>=2){
    const a=two[0], b=two[1];
    T('★ 가로로 딱 붙는다 (틈 0)', Math.abs(b.x-(a.x+a.w))<0.05, [a.x+a.w, b.x]);
    T('★ 위가 나란하다', Math.abs(b.y-a.y)<0.05, [a.y, b.y]);
    T('★ 높이가 같아진다', Math.abs(b.h-a.h)<0.05, [a.h, b.h]);
  }
  // 멀리 떨어뜨려 그리면 안 붙는다 (아무 데나 끌어당기면 그것대로 못 쓴다)
  await mk(70,60,90,80,'멀리 칸','선미');
  const far = (await LK()).find(l=>l.n==='멀리 칸');
  T('멀리 그린 것은 안 끌려간다', far && far.x>=68 && far.x<=72, far);

  // ── ⑤ 옮기기가 거절되면 화면이 되돌아온다
  await pg.evaluate(()=>{ window.__yes=false; });
  const b0 = (await SEEN())[0];
  await drag(25,22, 55,22);                        // 첫 칸을 둘째 칸 위로
  const b1 = (await SEEN())[0];
  const d1 = (await LK())[0];
  T('겹침을 물어본다', (await pg.evaluate(()=>window.__al.some(x=>/이미/.test(x)))));
  T('★ 자료가 제자리다', d1.x===10, d1);
  T('★ 화면도 제자리로 돌아온다', b1.left===b0.left, [b0.left, b1.left]);
  await pg.evaluate(()=>{ window.__yes=true; window.__al=[]; });

  // ── ⑥ 도면 없이 그려도 안내가 칸 위에 안 겹친다
  const noplan = await pg.evaluate(()=>{
    const n=document.getElementById('fpNone'); const h=document.getElementById('hint');
    return { 안내: n?getComputedStyle(n).display:null,
             // 4.02 — 안내를 덮어쓰지 않고 뒤에 붙이도록 바꿨다. 40자만 보면 뒤가 잘린다.
             아랫줄: h?(getComputedStyle(h).display+' | '+h.innerText.replace(/\n/g,' / ').slice(0,200)):null,
             줄html: h?h.innerHTML:'',
             단추: h?[].map.call(h.querySelectorAll('button'), b=>b.textContent.trim()):[] }; });
  T('★ 칸을 그린 뒤에는 「평면도가 없습니다」 안내가 접힌다', noplan.안내==='none', noplan);
  // ★ 5.0 에서 말이 바뀌었다 — 「도면 고르기」 → 「도면 선택」
  //   (단추 이름도 「도면에서 고르기」 → 「도면에서 선택」 으로 한 짝이 되었다).
  //   옛말을 붙들고 있으면 옳게 고친 것을 틀렸다고 한다.
  T('도면 고르는 길은 아래 한 줄로 남는다', /도면 선택/.test(noplan.아랫줄||''), noplan.아랫줄);
  T('★ 그 자리가 진짜 누를 수 있는 단추다', noplan.단추.indexOf('도면 선택') >= 0, noplan.단추);
  T('★ 눌러서 가는 곳이 기본 도면 고르는 화면이다',
    /dgPickBuiltin\('plan'\)/.test(noplan.줄html||''), (noplan.줄html||'').slice(-160));
  T('★ 옛말(「도면 고르기」)은 안 쓴다', !/도면 고르기/.test(noplan.아랫줄||''), noplan.아랫줄);
  T('★ 그리기 안내(「빈 곳을 끌면…」)가 지워지지 않았다',
    /빈 곳을 끌면/.test(noplan.아랫줄||''), noplan.아랫줄);

  // ── ⑦ 2층 · 벽면 칸
  const id0 = (await LK())[0].id;
  await pg.evaluate(i=>lkMenu(i), id0);
  await pg.waitForTimeout(600);
  const menu = await formTxt();
  T('수납칸 메뉴에 「층」 이 있다', /층/.test(menu), menu.slice(0,200));
  // ★ 「갈래」 는 지어낸 말이라 「종류」 로 바꿨다 (사장님이 정하신 것 6번).
  //   검사가 옛말을 붙들고 있으면 옳게 고친 것을 틀렸다고 한다.
  T('수납칸 메뉴에 「종류」 가 있다', /종류/.test(menu), menu.slice(0,200));
  await fillForm(['선수 창고','선수'], ['2층 (갑판)','벽면·선반']);
  await pg.waitForTimeout(600);
  const after = (await LK())[0];
  T('★ 2층으로 바뀐다', after.deck2===true, after);
  T('★ 벽면·선반으로 바뀐다', after.wall===true, after);
  const cls = (await SEEN())[0].cls;
  T('화면에도 2층 표시(b-2)가 붙는다', /b-2/.test(cls), cls);
  T('화면에도 벽면 표시(b-w)가 붙는다', /b-w/.test(cls), cls);
  // 되돌릴 수 있어야 한다
  await pg.evaluate(i=>lkMenu(i), id0); await pg.waitForTimeout(500);
  await fillForm(['선수 창고','선수'], ['1층','물건 칸']);
  await pg.waitForTimeout(500);
  const back = (await LK())[0];
  T('다시 1층·물건 칸으로 되돌릴 수 있다', !back.deck2 && !back.wall, back);

  // ── ⑧ 도형을 톡 누르면 지우기가 아니라 메뉴
  await pg.evaluate(()=>{ setLkTool('rect'); window.__al=[]; });
  await drag(10,60, 45,80);
  await pg.waitForTimeout(400);
  const nSh = await pg.evaluate(()=>shapes.length);
  T('도형이 그려졌다', nSh>=1, nSh);
  await drag(25,70, 25,70, 1);                    // 톡
  await pg.waitForTimeout(600);
  T('★ 곧바로 「지울까요?」 를 묻지 않는다',
    !(await pg.evaluate(()=>window.__al.some(x=>/지울까요/.test(x)))),
    await pg.evaluate(()=>window.__al));
  const sm = await formTxt();
  // ★ 5.0 — 도형 메뉴는 창(제목 「도형 수정」)으로 뜬다. 지우기는 「도형 삭제」 다.
  //   옛말(「도형 고치기」·「도형 지우기」)을 못 박은 검사는 옳게 고친 것을 틀렸다고 한다.
  T('★ 도형 메뉴가 뜬다', await formOpen(), sm.slice(0,200));
  T('★ 창 제목이 보인다 (전에는 통째로 사라졌다)', sm.indexOf('도형 수정') === 0, sm.slice(0,60));
  T('★ 무엇이 안 바뀌는지 일러 준다 (물품·수납칸에는 영향이 없다)',
    /물품이나 수납칸에는 영향이 없습니다/.test(sm), sm.slice(0,200));
  T('색·굵기를 고를 수 있다', /벽/.test(sm) && /칸막이/.test(sm) && /점선/.test(sm), sm.slice(0,200));
  T('★ 고를 수 있는 다섯 가지가 다 있다', /주의/.test(sm) && /표시/.test(sm), sm.slice(0,200));
  T('지우기도 있다', /도형 삭제/.test(sm), sm.slice(0,200));
  T('★ 옛말(「도형 고치기」·「도형 지우기」)은 안 쓴다',
    sm.indexOf('도형 고치기') < 0 && sm.indexOf('도형 지우기') < 0, sm.slice(0,200));
  T('★ 저장·취소가 있다', /저장/.test(sm) && /취소/.test(sm), sm.slice(0,200));
  // 색을 바꿔 본다
  const st0 = await pg.evaluate(()=>shapes[shapes.length-1].s);
  await fillForm([], ['주의']);
  await pg.waitForTimeout(500);
  const st1 = await pg.evaluate(()=>shapes[shapes.length-1].s);
  T('★ 이미 그린 도형의 색이 바뀐다', st1==='warn' && st1!==st0, [st0, st1]);
  T('도형은 그대로 있다 (안 지워짐)', (await pg.evaluate(()=>shapes.length))===nSh);

  T('앱이 터지지 않았다', errs.length===0, errs.slice(0,2));
  console.log('\n합계: '+ok+'개 통과 / '+bad+'개 실패');
  await br.close(); server.close();
  process.exit(bad?1:0);
})();
