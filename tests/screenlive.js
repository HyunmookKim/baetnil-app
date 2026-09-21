// 화면이 비어 있지 않은가 — 탭과 하위탭을 하나씩 진짜로 열어 본다
//
// ★ 왜 이 검사가 필요한가 (2026-08-29, 사장님이 사진으로 잡아 주신 것)
//   「남의 배」 탭이 통째로 흰(빈) 화면이었다. 까닭은 아주 단순했다 —
//   exploreWrap 은 communityWrap '안에' 있는데, 부모(communityWrap)를
//   커뮤니티 탭에서만 켜고 있었다. 자식만 켜 봐야 부모가 꺼져 있으면 안 보인다.
//
//   ★ 함수 검사로는 절대 안 잡힌다. openExplore 는 멀쩡히 돌고 있었고
//     innerHTML 도 제대로 들어가 있었다. 다만 사람 눈에 안 보였을 뿐이다.
//     그래서 「눈에 보이는 넓이와 글자」 를 재는 검사를 따로 둔다.
const { chromium } = require('playwright');
const fs=require('fs'), http=require('http'), path=require('path');
const SRC = process.argv[2] && /\.html$/.test(process.argv[2]) ? process.argv[2] : 'work.html';
const DATA = [__dirname + '/sample-backup.json']
  .find(f => { try{ fs.accessSync(f); return true; }catch(e){ return false; } });
const srv = http.createServer((q,r)=>{
  let f=q.url.split('?')[0];
  const 뿌리 = (f==='/' || f==='/index.html');
  if(뿌리) f='/'+SRC;
  // ★ 절대경로로 건네받은 앱 파일은 cwd 를 앞에 붙이면 안 된다.
  const p = (뿌리 && path.isAbsolute(SRC)) ? SRC : path.join(process.cwd(), f.replace(/^\//,''));
  if(!fs.existsSync(p)){ r.writeHead(404); r.end(''); return; }
  const e=path.extname(p);
  r.writeHead(200,{'content-type': e==='.js'?'text/javascript':e==='.woff2'?'font/woff2':'text/html; charset=utf-8'});
  r.end(fs.readFileSync(p));
});
let pass=0, fail=0;
const T=(n,ok,x)=>{ ok?(pass++,console.log('통과: '+n)):(fail++,console.log('★ 실패: '+n+(x===undefined?'':' — '+JSON.stringify(x).slice(0,240)))); };

// 어느 화면이 무엇을 보여 줘야 하는가. 「비어 있어도 되는 화면」 은 없다 —
// 자료가 없으면 「없습니다」 라고 말해야 한다. 아무 말도 안 하는 것이 고장이다.
const 화면들 = [
  ['home','today','오늘'],      ['home','weather','날씨 · 물때'],
  ['home','check','체크리스트'],
  ['boat','stow','적재표'],     ['boat','maint','정비'],
  ['boat','gear','장비'],       ['boat','voyage','항해일지'],
  ['boat','docs','문서'],
  ['others','voyage','남의 배 › 항해일지'], ['others','maint','남의 배 › 정비수첩'],
  ['others','review','남의 배 › 제품리뷰'], ['others','boatrv','남의 배 › 배리뷰'],
  ['community','talk','커뮤니티 › 글판'],   ['community','spots','커뮤니티 › 정박지'],
  ['community','market','커뮤니티 › 중고 장터'], ['community','explore','커뮤니티 › 배 둘러보기'],
  ['community','news','커뮤니티 › 뉴스']
];

(async()=>{
  await new Promise(r=>srv.listen(0,r));
  const port=srv.address().port;
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const p=await(await b.newContext({viewport:{width:430,height:930}, locale:'ko-KR'})).newPage();
  p.on('pageerror', e=>{ fail++; console.log('★ 실패: 터짐 —', e.message); });
  await p.route('**://tile.openstreetmap.org/**', r=>r.abort());
  await p.addInitScript(()=>{ try{ localStorage.setItem('bt_agree','1'); }catch(e){} });
  await p.goto(`http://127.0.0.1:${port}/`);
  await p.waitForTimeout(2200);
  await p.evaluate(()=>{ window.ask=()=>Promise.resolve(true); window.tell=()=>Promise.resolve(true);
    try{ skipWelcome(); }catch(_){}
    const o=document.getElementById('welcomeOv'); if(o) o.classList.remove('open'); });

  if(DATA){
    await p.evaluate(async (body)=>{
      const f=new File([body],'m.json',{type:'application/json'});
      restoreData({ target:{ files:[f], value:'' } });
      for(let i=0;i<80;i++){ await new Promise(r=>setTimeout(r,150)); if(items.length>100) break; }
      const j=JSON.parse(body);
      if(j.boat){ boats=[j.boat]; currentBoatId=j.boat.id; window.currentBoatId=currentBoatId;
        applyBoatName(); saveLocal(); if(typeof sysSave==='function') sysSave(); }
      if(typeof saveMR==='function') saveMR();
      await new Promise(r2=>setTimeout(r2,1200));
    }, fs.readFileSync(DATA,'utf8'));
  }

  for(const [tab, sub, 이름] of 화면들){
    await p.evaluate(([tb, sb])=>{
      switchTab(tb);
      if(tb==='home'   && typeof setHomeSub  === 'function') setHomeSub(sb);
      if(tb==='boat'){
        if(typeof setBoatSubTab === 'function') setBoatSubTab(sb);
      }
      if(tb==='others' && typeof setOtherSub === 'function') setOtherSub(sb);
      if(tb==='community' && typeof setComSub === 'function') setComSub(sb);
    }, [tab, sub]);
    await p.waitForTimeout(900);

    // 사람 눈에 보이는 것만 잰다 — 아래 탭줄·머리줄을 뺀 알맹이 영역
    const r = await p.evaluate(()=>{
      const skip = new Set(['tabbar','hNav','drawer']);
      let 글='', 높이=0;
      document.querySelectorAll('body > div, body > section, body > main').forEach(el=>{
        if(skip.has(el.id)) return;
        const st = getComputedStyle(el);
        if(st.display === 'none' || st.visibility === 'hidden') return;
        const rc = el.getBoundingClientRect();
        if(rc.height < 2) return;
        높이 += rc.height;
        글 += ' ' + (el.innerText || '');
      });
      return { 글: 글.replace(/\s+/g,' ').trim(), 높이 };
    });
    T('★★ ' + 이름 + ' 화면이 비어 있지 않다 (글 ' + r.글.length + '자)',
      r.글.length >= 4, { 이름, 글: r.글.slice(0,120), 높이: Math.round(r.높이) });
  }

  // ── 리뷰는 쓰는 것이다 — 쓰러 가는 문이 있어야 한다 (4.66, 사장님 지적)
  for(const [sub, 이름] of [['review','제품리뷰'],['boatrv','배리뷰']]){
    const 있나 = await p.evaluate(async (sb)=>{
      switchTab('others'); setOtherSub(sb);
      await new Promise(r=>setTimeout(r,700));
      const W = document.getElementById('exploreWrap');
      return !!(W && /goWriteReview/.test(W.innerHTML));
    }, sub);
    T('★★ 남의 배 › ' + 이름 + ' 에 리뷰 쓰는 단추가 있다', 있나);
  }
  // 항해일지·정비수첩에는 안 붙는다 — 그건 제 기록에서 저절로 올라오는 것이다
  {
    const 없나 = await p.evaluate(async ()=>{
      switchTab('others'); setOtherSub('voyage');
      await new Promise(r=>setTimeout(r,700));
      const W = document.getElementById('exploreWrap');
      return !!(W && !/goWriteReview/.test(W.innerHTML));
    });
    T('★ 남의 배 › 항해일지에는 안 붙는다', 없나);
  }

  // ── 빈 목록 안내가 검은 판때기가 아니다 (D테마 — 물 위의 유리)
  {
    const 색 = await p.evaluate(async ()=>{
      switchTab('boat'); setBoatSubTab('maint');
      if(typeof setMntSub === 'function') setMntSub('mlog');
      await new Promise(r=>setTimeout(r,700));
      const e = document.querySelector('.emptybox');
      if(!e) return null;
      const st = getComputedStyle(e);
      return { bg: st.backgroundColor, blur: st.backdropFilter };
    });
    if(색){
      const m = String(색.bg).match(/rgba?\(([^)]+)\)/);
      const a = m ? Number((m[1].split(',')[3] || '1').trim()) : 1;
      T('★★ 빈 목록 안내가 반투명이다 (검은 판때기가 아니다)', a < 0.5, 색);
      T('★ 뒤가 비치게 흐림이 걸려 있다', /blur/.test(String(색.blur || '')), 색);
    } else {
      T('★ 빈 목록 안내를 찾았다', false, '.emptybox 없음');
    }
  }

  // ── 사람 빠짐 단추는 정박 중에는 없다
  {
    const 보임 = await p.evaluate(()=>{
      const e = document.getElementById('mobFab');
      return e ? getComputedStyle(e).display : '없음';
    });
    T('★★ 정박 중에는 사람 빠짐 단추가 안 보인다', 보임 === 'none', 보임);
  }

  console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
  await b.close(); srv.close();
  process.exit(fail ? 1 : 0);
})();
