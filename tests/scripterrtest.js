// 5.6 — 「오류: Script error.」 (사장님 동생분 아이폰, 2026-09-21)
//
// ★ 무슨 일이었나
//   브라우저는 **다른 데서 받아 온 파일**(우리는 파이어베이스)에서 난 오류의 내용을
//   페이지에 알려 주지 않는다. 메시지가 'Script error.' 한 줄로 뭉개지고
//   파일·줄·스택이 전부 빈다. 규칙이 그렇다.
//   그래서 화면에는 아무 뜻 없는 「오류: Script error.」 만 떴고,
//   보내기를 눌러도 **로그인 전이라 서버 규칙에 막혀** 「보내지 못했습니다」 로 끝났다.
//   ★ 켜자마자 나는 오류를 만나는 사람은 대개 아직 로그인 안 한 사람이다.
//     보내라고 단추를 내놓고 못 보내게 하는 것은 앱이 거짓말을 하는 것이다.
//
// ★ 이 검사가 지키는 것
//   ① 뭉개진 오류를 사람 말로 바꿔 보여 준다
//   ② 내용을 못 읽는 대신 **어디까지 갔는지**(window.__boot)를 함께 보낸다
//   ③ 로그인 안 했어도 보낼 길(메일)이 있다
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const SRC = process.argv[2] || path.join(__dirname, 'work.html');
const DIR = path.dirname(SRC);
const NAME = path.basename(SRC);
let pass=0, fail=0;
const T=(n,c,x)=>{ if(c){pass++;console.log('통과: '+n);} else {fail++;console.log('★ 실패: '+n+(x===undefined?'':'\n   '+String(x).slice(0,300)));} };
(async()=>{
  const srv = http.createServer((q,r)=>{
    const u = q.url.split('?')[0];
    const f = (u === '/' || u === '/app.html') ? SRC : path.join(DIR, u);
    fs.readFile(f,(e,d)=>{ if(e){r.writeHead(404);r.end();} else {r.writeHead(200,{'content-type':f.endsWith('.js')?'text/javascript':'text/html'});r.end(d);} });
  }).listen(8731);
  const b = await chromium.launch();
  const ctx = await b.newContext();
  // ★ 화면 말은 고른 나라 말로 나온다. 검사가 말에 흔들리지 않게 한국어로 못 박는다.
  await ctx.addInitScript(()=>{ try{ localStorage.setItem('bt_lang','ko'); }catch(_){} });
  const p = await ctx.newPage();
  await p.goto('http://localhost:8731/app.html');
  await p.waitForTimeout(2500);

  // ① 뭉개진 오류를 흉내 낸다 (바깥 파일에서 난 것)
  await p.evaluate(()=>{ window.__boot='불러옴: firebase-auth';
    window.dispatchEvent(new ErrorEvent('error',{message:'Script error.',filename:'',lineno:0,colno:0})); });
  await p.waitForTimeout(400);
  const bar = await p.evaluate(()=>{ const d=document.getElementById('errbar');
    return d ? { on:d.style.display!=='none', text:d.innerText, btn:!!d.querySelector('.errsend') } : null; });
  T('오류줄이 뜬다', !!(bar && bar.on), JSON.stringify(bar));
  T('★★ 「Script error.」 가 그대로 안 보인다', !!(bar && !/Script error/.test(bar.text)), bar && bar.text);
  T('★★ 사람 말로 바뀐다', !!(bar && /바깥에서 받아 온 파일/.test(bar.text)), bar && bar.text);
  T('★★ 로그인 안 했어도 보낼 단추가 있다', !!(bar && bar.btn), JSON.stringify(bar));
  T('★ 단추가 「메일로 보내기」 다', !!(bar && /메일로 보내기/.test(bar.text)), bar && bar.text);

  // ② 보낼 내용에 자국이 들어가나
  const body = await p.evaluate(()=>errBody('Script error.'));
  T('★★★ 보낼 내용에 어디까지 갔는지가 있다', /붙는 데까지 — 불러옴: firebase-auth/.test(body), body);
  T('★★ 로그인 여부가 들어간다', /로그인 안 함/.test(body), body);
  T('★ 판 번호가 들어간다', /앱 \d+\.\d+/.test(body), body);
  T('★ 못 읽는 오류라는 설명이 들어간다', /브라우저가 내용을 안 알려/.test(body), body);

  // ③ 보통 오류는 그대로 보인다
  await p.evaluate(()=>{ window.dispatchEvent(new ErrorEvent('error',
    {message:'TypeError: x is not a function',filename:'work.html',lineno:12,colno:3})); });
  await p.waitForTimeout(300);
  const bar2 = await p.evaluate(()=>document.getElementById('errbar').innerText);
  T('★ 보통 오류는 내용이 그대로 보인다', /x is not a function/.test(bar2), bar2);

  // ④ 메일 길 — 단추를 누르면 mailto 를 연다
  let mailto = '';
  p.on('popup', ()=>{});
  await p.evaluate(()=>{ window.__mailto=''; const o=window.open; window.open=(u)=>{window.__mailto=String(u||'');return null;};
    document.querySelector('#errbar .errsend') && document.querySelector('#errbar .errsend').click(); });
  await p.waitForTimeout(600);
  mailto = await p.evaluate(()=>window.__mailto || (document.getElementById('errbar')||{}).innerText || '');
  T('★★ 눌러도 「보내지 못했습니다」 로 끝나지 않는다', !/보내지 못했습니다/.test(mailto), mailto);

  await b.close(); srv.close();
  console.log(`\n합계: ${pass}개 통과 / ${fail}개 실패`);
  process.exit(fail?1:0);
})();
