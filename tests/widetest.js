// 좌우 스크롤 막대가 생기지 않는가 — 실물 창에서 잰다
//
// ★ 왜 이 검사가 있는가 (4.79, 사장님이 사진으로 잡아 주신 것)
//   글판만 좌우로 움직이는 막대가 생겼다. 까닭은 숫자 딱지 하나였다.
//   .tcnt 는 position:absolute · right:-4px 로, 사진 귀퉁이(.thumbWrap,
//   position:relative)에 붙으라고 만든 것이다. 그런데 글판·정박지·뉴스 줄에는
//   자리 잡은 어버이가 없어서, 그 딱지가 화면 오른쪽 끝 '밖' 으로 날아가
//   창을 4px 넓혔다. 4px 이라 눈에는 안 띄고 막대만 생긴다.
//
//   ★ 함수 검사로는 절대 안 잡힌다. 글도 숫자도 다 맞게 들어가 있었다.
//     그래서 「창보다 오른쪽으로 삐져나간 것이 있나」 를 실물에서 잰다.
const { chromium } = require('playwright');
const fs=require('fs'), http=require('http'), path=require('path');
const SRC = process.argv[2] && /\.html$/.test(process.argv[2]) ? process.argv[2] : 'work.html';
const srv = http.createServer((q,r)=>{
  let f=q.url.split('?')[0];
  // 인자가 절대경로면 그대로 쓴다. 나머지 딸린 파일은 검사 폴더에서 찾는다.
  const p = f==='/' ? (path.isAbsolute(SRC) ? SRC : path.join(process.cwd(), SRC))
                    : path.join(process.cwd(), f.replace(/^\//,''));
  if(!fs.existsSync(p)){ r.writeHead(404); r.end(''); return; }
  const e=path.extname(p);
  r.writeHead(200,{'content-type': e==='.js'?'text/javascript':'text/html; charset=utf-8'});
  r.end(fs.readFileSync(p));
});
let pass=0, fail=0;
const T=(n,ok,x)=>{ ok?(pass++,console.log('통과: '+n)):(fail++,console.log('★ 실패: '+n+(x===undefined?'':' — '+JSON.stringify(x).slice(0,300)))); };

// ★ 글 하나에 댓글·추천 숫자가 다 붙은 상태로 만든다. 숫자가 없으면 딱지도 없고,
//   딱지가 없으면 이 고장이 안 나타난다 — 그러면 검사가 아무것도 못 잡는다.
const 글 = [{ id:'t1', kind:'질문', title:'로프 스토퍼 어디서 구매해야할까요?',
  by:'u1', byName:'여수 SHUNSHINE', region:'전남', ts:'2026-08-24',
  text:'본문', comments:[{id:'c1'}], cmtN:2, likeN:1 }];

(async()=>{
  await new Promise(r=>srv.listen(0,r));
  const port=srv.address().port;
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  // ★ 넓은 창과 좁은 창을 다 본다. 폰에서만 보면 데스크탑 고장을 놓친다 (이번이 그랬다).
  for(const [w,h,창] of [[1276,1290,'넓은 창'], [430,930,'폰 창']]){
    const ctx = await b.newContext({viewport:{width:w,height:h}, locale:'ko-KR'});
    const p = await ctx.newPage();
    p.on('pageerror', e=>{ fail++; console.log('★ 실패: 터짐 —', e.message); });
    await p.route('**://tile.openstreetmap.org/**', r=>r.abort());
    await p.addInitScript(()=>{ try{ localStorage.setItem('bt_agree','1'); }catch(e){} });
    await p.goto(`http://127.0.0.1:${port}/`);
    await p.waitForTimeout(2000);
    await p.evaluate(()=>{ window.ask=()=>Promise.resolve(true); window.tell=()=>Promise.resolve(true);
      try{ skipWelcome(); }catch(_){}
      const o=document.getElementById('welcomeOv'); if(o) o.classList.remove('open'); });

    for(const [탭, 하위, 이름, 채우기] of [
        ['community','talk','글판', true], ['community','spots','정박지', false],
        ['community','market','중고 장터', false], ['community','explore','배 둘러보기', false],
        ['others','voyage','남의 배', false], ['home','today','오늘', false],
        ['boat','voyage','내 배', false]]){
      await p.evaluate(async ([tb, sb, fill, rows])=>{
        if(fill){
          window.__talk = { list: async ()=>({ rows, done:true }), one: async ()=>null };
        }
        switchTab(tb);
        if(tb==='community' && typeof setComSub === 'function') setComSub(sb);
        if(tb==='others' && typeof setOtherSub === 'function') setOtherSub(sb);
        if(tb==='home' && typeof setHomeSub === 'function') setHomeSub(sb);
        if(tb==='boat' && typeof setBoatSubTab === 'function') setBoatSubTab(sb);
        if(fill && typeof renderTalk === 'function'){ try{ await renderTalk(); }catch(_){} }
      }, [탭, 하위, 채우기, 글]);
      await p.waitForTimeout(700);
      const r = await p.evaluate(()=>{
        const vw = document.documentElement.clientWidth;
        const 삐져 = [];
        // ★ 제 줄 안에서 좌우로 미는 것(칩 줄 .tfilt 같은 것)은 고장이 아니다.
        //   그 안의 칩은 창보다 오른쪽에 있는 것이 당연하다 — 창을 넓히지 않는다.
        //   좌우로 미는 어버이를 가진 것은 세지 않는다.
        const 미는어버이 = el => {
          for(let a = el.parentElement; a; a = a.parentElement){
            const o = getComputedStyle(a).overflowX;
            if(o === 'auto' || o === 'scroll' || o === 'hidden') return true;
          }
          return false;
        };
        document.querySelectorAll('*').forEach(el=>{
          const st = getComputedStyle(el);
          if(st.display==='none' || st.visibility==='hidden') return;
          const rc = el.getBoundingClientRect();
          if(rc.height < 1 || rc.width < 1) return;
          if(미는어버이(el)) return;
          if(rc.right > vw + 0.5 || rc.left < -0.5){
            삐져.push((el.tagName.toLowerCase())
              + (el.id ? '#'+el.id : '')
              + (typeof el.className==='string' && el.className ? '.'+el.className.trim().split(/\s+/).join('.') : '')
              + ' [' + Math.round(rc.left) + '~' + Math.round(rc.right) + ']');
          }
        });
        return { vw, docW: document.documentElement.scrollWidth, 삐져: 삐져.slice(0,6) };
      });
      T('★★★ ' + 창 + ' · ' + 이름 + ' — 좌우 막대가 안 생긴다',
        r.docW <= r.vw && r.삐져.length === 0, r);
    }
    await ctx.close();
  }

  // ── 못을 박는다: 날아가는 딱지(.tcnt)는 자리 잡은 어버이 안에서만 쓴다
  const src = fs.readFileSync(SRC, 'utf8');
  const 쓴곳 = (src.match(/class="tcnt[^"]*"/g) || []).length;
  T('★★★ 날아가는 딱지(.tcnt)는 사진 귀퉁이 한 곳에서만 쓴다 (지금 ' + 쓴곳 + '곳)', 쓴곳 === 1, 쓴곳);
  T('★★ 줄 안에 서는 숫자 딱지(.tnum)가 있다', /\.tnum\{[^}]*flex:none/.test(src));
  T('★★ .tnum 은 자리를 옮기지 않는다 (position:absolute 가 아니다)',
    !/\.tnum\{[^}]*position:absolute/.test(src));

  console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
  await b.close(); srv.close();
  process.exit(fail ? 1 : 0);
})();
