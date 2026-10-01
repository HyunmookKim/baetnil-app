// 5.29 — 「탈퇴한 회원」 이 실제 화면에서 어떻게 보이나 (사장님 「2는 2로」)
//   글 목록·글 본문·댓글에서 이름 대신 「탈퇴한 회원」, 누를 수 없고, 「이 사람 차단」 이 없다.
//   계정 삭제 화면은 「남는 것」 에 글·댓글 수를 보여 주고, 지우려면 탈퇴 전에 지우라고 말한다.
//   네 나라 말 모두.
// 사용: node leavelive.js ../www/index.html
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const FILE = path.resolve(process.argv[2] || 'work.html');
const ROOT = path.dirname(FILE);
const server = http.createServer((rq,rs)=>{
  const u = rq.url.split('?')[0];
  const f = u === '/' ? FILE : path.join(ROOT, u);
  fs.readFile(f,(e,d)=>{ if(e){rs.writeHead(404);rs.end();return;} rs.writeHead(200); rs.end(d); });
});
let ok=0,bad=0;
const T=(n,c,w)=>{ if(c){ok++;console.log('통과: '+n);} else {bad++;console.log('★ 실패: '+n+(w!==undefined?' — '+JSON.stringify(w).slice(0,300):''));} };
const sleep = ms => new Promise(r=>setTimeout(r,ms));
const GONE = { ko:'탈퇴한 회원', en:'Deleted account', ru:'Удалённый аккаунт', ja:'退会したユーザー' };
const KEEP = { ko:/탈퇴하기 전에 직접 지워/, en:/delete them yourself before you leave/, ru:/удалите их сами до выхода/, ja:/退会する前にご自身で削除/ };

(async ()=>{
  await new Promise(r=>server.listen(0,r));
  const br = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  for(const L of ['ko','en','ru','ja']){
    const ctx = await br.newContext({ locale:'ko-KR', viewport:{width:390,height:844}, isMobile:true, hasTouch:true });
    await ctx.route(/googleapis|gstatic|firebaseio|firestore|open-meteo/, r=>r.abort());
    await ctx.addInitScript(l=>{ try{ localStorage.setItem('bt_setup','done'); localStorage.setItem('bt_welcome','done'); localStorage.setItem('bt_lang', l); }catch(_){} }, L);
    const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e=>errs.push(String(e)));
    await pg.goto('http://127.0.0.1:'+server.address().port+'/');
    await pg.waitForFunction(()=>typeof openTalk==='function' && typeof renderTalk==='function');
    await sleep(1500);
    await pg.evaluate(l=>{ try{ if(typeof setLang==='function') setLang(l); }catch(_){} }, L);
    await sleep(300);
    const lang = await pg.evaluate(()=>typeof lang!=='undefined' ? lang : (window.LANG||''));
    await pg.evaluate(()=>{
      closeBoat();
      window.__cmt = { list: async () => [
        { id:'c1', by:'U9', byName:'', gone:true, text:'수심 3m 였습니다', ts:'2026-09-28T10:00:00' },
        { id:'c2', by:'U3', byName:'박선장', text:'좋은 정보 감사합니다', ts:'2026-09-28T11:00:00' } ] };
      const rows = [{ id:'p1', kind:'free', title:'통영 수리소 추천', body:'어디가 좋을까요', by:'U9', byName:'', boatName:'', gone:true, ts:'2026-09-28T09:00:00' },
                    { id:'p2', kind:'free', title:'여수 물때', body:'?', by:'U2', byName:'이수리', ts:'2026-09-28T08:00:00' }];
      talkList = rows;
      window.__talk = Object.assign({}, window.__talk || {}, { list: async () => ({ rows, done:true }) });
      try{ comSub = 'talk'; switchTab('community'); }catch(_){}
    });
    await sleep(500);
    await pg.evaluate(async ()=>{ try{ await renderTalk(); }catch(e){ window.__rtErr = String(e); } });
    await sleep(300);
    const li = await pg.evaluate(()=>({ gone:[...document.querySelectorAll('.whogone')].map(e=>e.textContent.trim()), links:[...document.querySelectorAll('.whoa')].map(e=>e.textContent.trim()) }));
    T(L+' 글 목록 — 「'+GONE[L]+'」, 누를 수 없다', li.gone.includes(GONE[L]) && !li.links.includes(GONE[L]), li);
    T(L+' 글 목록 — 다른 사람 이름은 예전처럼 누를 수 있다', li.links.includes('이수리'), li);
    await pg.evaluate(()=>openTalk('p1')); await sleep(500);
    const pv = await pg.evaluate(()=>{ const P=document.getElementById('mrPanel');
      return { gone:[...P.querySelectorAll('.whogone')].map(e=>e.textContent.trim()), links:[...P.querySelectorAll('.whoa')].map(e=>e.textContent.trim()), txt:P.innerText }; });
    T(L+' 글 본문·댓글 — 글쓴이와 댓글 쓴 사람 둘 다 「'+GONE[L]+'」', pv.gone.filter(x=>x===GONE[L]).length === 2, pv.gone);
    T(L+' 글 본문 — 남은 댓글 내용은 그대로 보인다', /수심 3m 였습니다/.test(pv.txt) && /좋은 정보 감사합니다/.test(pv.txt));
    T(L+' 글 본문 — 살아 있는 사람은 누를 수 있다', pv.links.includes('박선장'), pv.links);
    // 「이 사람 차단」 — 할 일 목록에 없어야 한다
    const acts = await pg.evaluate(()=>ACT_LIST.map(a=>a.name));
    T(L+' 탈퇴한 회원의 글에는 「이 사람 차단」 이 없다', acts.length > 0 && !acts.includes('이 사람 차단'), acts);
    await pg.evaluate(()=>openTalk('p2')); await sleep(400);
    const acts2 = await pg.evaluate(()=>ACT_LIST.map(a=>a.name));
    T(L+' 살아 있는 사람의 글에는 「이 사람 차단」 이 그대로 있다', acts2.includes('이 사람 차단'), acts2);
    // 계정 삭제 화면
    await pg.evaluate(()=>{ window.__user = { uid:'me', email:'me@example.com' }; window.__account = { minePosts: async () => ({ del:2, keep:3, cmt:5 }) }; });
    await pg.evaluate(()=>openWipe()); await sleep(600);
    const w = await pg.evaluate(()=>({ txt:document.getElementById('mrPanel').innerText, keep:(document.getElementById('wipeKeep')||{}).textContent, n:(document.getElementById('wipeN')||{}).textContent }));
    T(L+' 계정 삭제 — 남는 글·댓글 수', /3/.test(w.keep||'') && /5/.test(w.keep||''), w.keep);
    T(L+' 계정 삭제 — 지워지는 것(정박지·장터) 수', /2/.test(w.n||''), w.n);
    T(L+' 계정 삭제 — 지우려면 탈퇴 전에 지우라고 말한다', KEEP[L].test(w.txt), w.txt.slice(0,400));
    T(L+' 계정 삭제 — 「남의 댓글도 사라진다」 는 옛말이 없다', !/남의 댓글|Other people's comments|Чужие комментарии|他の方のコメント/.test(w.txt));
    if(L !== 'ko') T(L+' 화면에 한국어가 새지 않는다', !/[가-힣]{2,}/.test(w.txt.replace(/me@example\.com/,'')), (w.txt.match(/[가-힣][가-힣 ·]+/g)||[]).slice(0,5));
    T(L+' 오류 없음', !errs.length, errs.slice(0,3));
    await ctx.close();
  }
  await br.close(); server.close();
  console.log('\n합계: '+ok+'개 통과 / '+bad+'개 실패');
  process.exit(bad?1:0);
})();
