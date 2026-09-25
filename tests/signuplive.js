// 5.15 — 회원가입 화면 (사장님 지적 2026-09-25)
//   「가입 버튼 누르면 동의 나오고 동의 다하면 가입으로 넘어가는게 아니라 첫화면으로 돌아옴.
//    이메일·비밀번호 다시 쓰고 가입 누르면 가입이 됨. 회원가입은 이메일·비밀번호·비밀번호 확인까지,
//    다른 어플처럼 일반적인 절차로.」
//   다른 앱 방식: 약관 동의 먼저 → 이메일·비밀번호·비밀번호 확인 → 가입하기. 로그인과 회원가입은 다른 화면.
//   사용: node signuplive.js ../www/index.html
const { chromium } = require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const FILE=path.resolve(process.argv[2]||'../www/index.html'), ROOT=path.dirname(FILE), MAIN=path.basename(FILE);
const srv=http.createServer((q,r)=>{const u=q.url.split('?')[0];fs.readFile(path.join(ROOT,u==='/'?MAIN:u),(e,d)=>{if(e){r.writeHead(404);r.end();return;}r.writeHead(200,{'Content-Type':/\.js$/.test(u)?'text/javascript':'text/html'});r.end(d);});});
let ok=0,bad=0;
const T=(n,c,w)=>{ if(c){ok++;console.log('통과: '+n);} else {bad++;console.log('★ 실패: '+n+(w!==undefined?' — '+JSON.stringify(w).slice(0,200):''));} };
(async()=>{
  await new Promise(r=>srv.listen(0,r));
  const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  async function fresh(lang){
    const ctx=await br.newContext({locale:lang||'ko-KR',viewport:{width:390,height:844}});
    if(lang) await ctx.addInitScript(l=>{ try{ localStorage.setItem('bt_lang', l); }catch(_){} }, lang.slice(0,2));
    await ctx.route(/googleapis|gstatic|firebaseio|open-meteo|firestore/,r=>r.abort());
    await ctx.addInitScript(()=>{ try{ localStorage.setItem('bt_setup','done'); localStorage.setItem('bt_welcome','done'); }catch(_){} });
    const pg=await ctx.newPage(); pg.__errs=[]; pg.on('pageerror',e=>pg.__errs.push(String(e)));
    await pg.goto('http://127.0.0.1:'+srv.address().port+'/');
    await pg.waitForFunction(()=>typeof openAccount==='function');
    await pg.evaluate(()=>{ window.__calls=[];
      window.__auth={ emailUp:async(e,p)=>{ __calls.push(['up',e,p]); if(e==='dup@x.com'){ const er=new Error('x'); er.code='auth/email-already-in-use'; throw er; } },
        emailIn:async(e,p)=>{ __calls.push(['in',e,p]); if(p==='wrongpw'){ const er=new Error('x'); er.code='auth/invalid-credential'; throw er; } }, reset:async()=>{}, google:async()=>{}, out:async()=>{} };
      try{ localStorage.removeItem('bt_agree'); }catch(_){} });
    return pg;
  }
  const fill=(pg,id,v)=>pg.evaluate(([id,v])=>{const e=document.querySelector(id); if(!e) throw new Error('칸 없음 '+id); e.value=v; e.dispatchEvent(new Event('input',{bubbles:true}));},[id,v]);
  const panel=pg=>pg.evaluate(()=>document.getElementById('mrPanel').innerText);
  const errUnder=(pg,id)=>pg.evaluate(id=>{const e=document.getElementById(id); const n=e&&e.nextElementSibling; return n&&n.classList.contains('ferr')&&n.classList.contains('on')?n.textContent:'';},id);
  const tap=(pg,txt)=>pg.evaluate(txt=>{const b=[...document.querySelectorAll('#mrPanel button')].find(b=>b.textContent.trim()===txt); if(!b) return false; b.click(); return true;},txt);

  // ── 로그인 화면
  let pg=await fresh();
  await pg.evaluate(()=>openAccount()); await pg.waitForTimeout(200);
  T('로그인 화면에 이메일·비밀번호 칸', await pg.evaluate(()=>!!document.getElementById('acEm')&&!!document.getElementById('acPw')));
  T('로그인 화면에는 비밀번호 확인 칸이 없다', await pg.evaluate(()=>!document.getElementById('suPw2')));
  T('로그인 화면 비밀번호는 current-password', await pg.evaluate(()=>document.getElementById('acPw').getAttribute('autocomplete'))==='current-password');
  T('입력칸 글자 16px 이상 (아이폰 확대 방지)', await pg.evaluate(()=>['acEm','acPw'].every(i=>parseFloat(getComputedStyle(document.getElementById(i)).fontSize)>=16)),
    await pg.evaluate(()=>getComputedStyle(document.getElementById('acEm')).fontSize));
  T('「회원가입」 단추가 가입 화면을 연다(로그인 칸 값으로 바로 가입하지 않는다)', await tap(pg,'회원가입'));
  await pg.waitForTimeout(200);
  T('회원가입 누르면 먼저 약관 동의', /모두 동의/.test(await panel(pg)), (await panel(pg)).slice(0,80));
  T('가입 요청은 아직 안 갔다', (await pg.evaluate(()=>__calls.length))===0);
  await pg.evaluate(()=>{ agreeAll(); }); await tap(pg,'동의하고 계속'); await pg.waitForTimeout(200);
  const hasForm=await pg.evaluate(()=>['suEm','suPw','suPw2'].every(i=>!!document.getElementById(i)));
  T('동의 뒤 바로 가입 화면(이메일·비밀번호·비밀번호 확인)', hasForm, (await panel(pg)).slice(0,120));
  if(hasForm){
    T('가입 화면 제목이 「회원가입」', /회원가입/.test(await pg.evaluate(()=>(document.getElementById('hNav')||{}).textContent+' '+document.querySelector('#mrPanel .mrhead').textContent)));
    T('가입 비밀번호는 new-password', await pg.evaluate(()=>['suPw','suPw2'].every(i=>document.getElementById(i).getAttribute('autocomplete')==='new-password')));
    T('가입 이메일은 email', await pg.evaluate(()=>document.getElementById('suEm').getAttribute('autocomplete')==='email'));
    T('가입 칸 글자 16px 이상', await pg.evaluate(()=>['suEm','suPw','suPw2'].every(i=>parseFloat(getComputedStyle(document.getElementById(i)).fontSize)>=16)));
    // 이메일 형식
    await fill(pg,'#suEm','abc'); await fill(pg,'#suPw','secret12'); await fill(pg,'#suPw2','secret12');
    await tap(pg,'가입하기'); await pg.waitForTimeout(150);
    T('이메일 형식 오류는 이메일 칸 밑에', /이메일 형식/.test(await errUnder(pg,'suEm')), await errUnder(pg,'suEm'));
    // 짧은 비밀번호
    await fill(pg,'#suEm','a@b.com'); await fill(pg,'#suPw','123'); await fill(pg,'#suPw2','123');
    await tap(pg,'가입하기'); await pg.waitForTimeout(150);
    T('6자 미만은 비밀번호 칸 밑에', /6자 이상/.test(await errUnder(pg,'suPw')), await errUnder(pg,'suPw'));
    // 불일치
    await fill(pg,'#suPw','secret12'); await fill(pg,'#suPw2','secret13');
    await tap(pg,'가입하기'); await pg.waitForTimeout(150);
    T('비밀번호 불일치는 비밀번호 확인 칸 밑에', /일치하지 않습니다/.test(await errUnder(pg,'suPw2')), await errUnder(pg,'suPw2'));
    T('잘못된 동안에는 가입 요청이 안 갔다', (await pg.evaluate(()=>__calls.length))===0, await pg.evaluate(()=>__calls));
    // 이미 가입된 이메일
    await fill(pg,'#suEm','dup@x.com'); await fill(pg,'#suPw2','secret12');
    await tap(pg,'가입하기'); await pg.waitForTimeout(300);
    T('이미 가입된 이메일은 이메일 칸 밑에', /이미 가입된 이메일/.test(await errUnder(pg,'suEm')), await errUnder(pg,'suEm'));
    T('적은 값이 그대로 남는다', await pg.evaluate(()=>document.getElementById('suEm').value==='dup@x.com'&&document.getElementById('suPw').value==='secret12'));
    // 정상
    await fill(pg,'#suEm','new@x.com');
    await tap(pg,'가입하기'); await pg.waitForTimeout(300);
    const c=await pg.evaluate(()=>__calls.filter(x=>x[0]==='up').pop());
    T('가입하기 한 번에 가입 요청이 간다', c&&c[1]==='new@x.com'&&c[2]==='secret12', c);
    T('동의를 두 번 묻지 않는다', !/모두 동의/.test(await panel(pg)));
  }
  T('페이지 오류 없음 (가입)', pg.__errs.length===0, pg.__errs.slice(0,2));
  await pg.context().close();

  // ── 로그인 — 동의를 아직 안 한 사람: 동의 뒤 한 번에 로그인까지
  pg=await fresh();
  await pg.evaluate(()=>openAccount()); await pg.waitForTimeout(150);
  await fill(pg,'#acEm','old@x.com'); await fill(pg,'#acPw','secret12');
  await tap(pg,'로그인'); await pg.waitForTimeout(200);
  T('로그인도 동의를 먼저 받는다', /모두 동의/.test(await panel(pg)));
  await pg.evaluate(()=>agreeAll()); await tap(pg,'동의하고 계속'); await pg.waitForTimeout(400);
  const li=await pg.evaluate(()=>__calls.filter(x=>x[0]==='in').pop());
  T('동의 뒤 적어 둔 이메일·비밀번호로 바로 로그인 요청', li&&li[1]==='old@x.com'&&li[2]==='secret12', li);
  // 비밀번호가 틀린 경우 — 적은 값이 남아 있고, 이유가 보여야 한다
  await pg.evaluate(()=>{ doSignOut && 0; openAccount(); });
  await fill(pg,'#acEm','old@x.com'); await fill(pg,'#acPw','wrongpw');
  await tap(pg,'로그인'); await pg.waitForTimeout(300);
  T('틀리면 적은 값이 그대로 남는다', await pg.evaluate(()=>document.getElementById('acEm').value==='old@x.com'));
  T('틀린 이유가 보인다', /맞지 않습니다/.test(await pg.evaluate(()=>(document.getElementById('acMsg')||{}).innerText||'')));
  // 가입 화면 ↔ 로그인 화면 오가기
  await pg.evaluate(()=>{ openSignup(); }); await pg.waitForTimeout(150);
  T('가입 화면에서 로그인 화면으로 돌아가는 단추', await tap(pg,'로그인'));
  await pg.waitForTimeout(150);
  T('돌아가면 로그인 화면', await pg.evaluate(()=>!!document.getElementById('acEm') && !document.getElementById('suPw2')));
  T('페이지 오류 없음 (로그인)', pg.__errs.length===0, pg.__errs.slice(0,2));
  await pg.context().close();

  // ── 첫 화면의 「이메일로 시작하기」
  pg=await fresh();
  await pg.evaluate(()=>openWelcome()); await pg.waitForTimeout(150);
  await tap(pg,'이메일로 시작하기'); await pg.waitForTimeout(150);
  T('이메일로 시작하기 → 로그인 화면(회원가입 단추 있음)', await pg.evaluate(()=>!!document.getElementById('acEm') && [...document.querySelectorAll('#mrPanel button')].some(b=>b.textContent.trim()==='회원가입')));
  await pg.context().close();

  // ── 영어 화면에 한국어가 안 남는다
  pg=await fresh('en-US');
  await pg.evaluate(()=>{ try{ localStorage.setItem('bt_agree', JSON.stringify({ver:LEGAL_VER,at:new Date().toISOString(),loc:false})); }catch(_){} });
  await pg.evaluate(()=>{ if(typeof openSignup==='function') openSignup(); }); await pg.waitForTimeout(200);
  const en=await panel(pg);
  T('영어 가입 화면이 열렸다', await pg.evaluate(()=>!!document.getElementById('suPw2')));
  await pg.evaluate(()=>openAccount()); await pg.waitForTimeout(150);
  const en2=await panel(pg);
  T('영어 로그인 화면에 한글 없음', !/[가-힣]/.test(en2), en2.match(/[^\n]*[가-힣][^\n]*/g));
  T('영어 가입 화면에 한글 없음', !/[가-힣]/.test(en), en.match(/[^\n]*[가-힣][^\n]*/g));
  await pg.context().close();

  console.log('\n합계: '+ok+'개 통과 / '+bad+'개 실패');
  await br.close(); srv.close(); process.exit(bad?1:0);
})();
