// 수에 따라 낱말이 바뀌는 것을 **진짜 브라우저에서** 확인한다
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const FILE = process.argv[2] || '/home/claude/work.html';
const server = http.createServer((rq,rs)=>{
  const f = rq.url === '/' ? path.resolve(FILE) : path.join(path.dirname(path.resolve(FILE)), rq.url.split('?')[0]);
  fs.readFile(f,(e,d)=>{ if(e){ rs.writeHead(404); rs.end(); return; } rs.writeHead(200); rs.end(d); });
});
let ok=0,bad=0;
const T=(n,c,w)=>{ if(c){ok++;console.log('통과: '+n);} else {bad++;console.log('★ 실패: '+n+' — '+JSON.stringify(w));} };
(async()=>{
  await new Promise(r=>server.listen(0,r));
  const br = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  for(const L of ['en','ru','ja','ko']){
    const ctx = await br.newContext({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true, locale:'ko-KR' });
    const pg = await ctx.newPage();
    await pg.addInitScript(l=>{ try{ localStorage.setItem('bt_lang',l); localStorage.setItem('bt_agree','1'); }catch(e){} }, L);
    await pg.goto('http://127.0.0.1:'+server.address().port+'/', { waitUntil:'domcontentloaded' });
    await pg.waitForTimeout(1500);
    const 봄 = await pg.evaluate(()=>({
      d1: tsub('{n}일 남음',{n:1}), d2: tsub('{n}일 남음',{n:2}), d5: tsub('{n}일 남음',{n:5}),
      d11: tsub('{n}일 남음',{n:11}), d21: tsub('{n}일 남음',{n:21}),
      del1: tsub('{n}개 지울까요?',{n:1}), del3: tsub('{n}개 지울까요?',{n:3}),
      plain: tsub('{n}개 목록 중',{n:3})
    }));
    console.log('── ' + L + ' ' + JSON.stringify(봄));
    T(L+' 갈래 표시가 화면에 글자로 안 나온다',
      !Object.values(봄).some(v=>/\[\[|\]\]/.test(v)), 봄);
    if(L==='en'){ T('en 1 day / 5 days', 봄.d1==='1 day left' && 봄.d5==='5 days left', 봄); }
    if(L==='ru'){ T('ru 1 день / 2 дня / 5 дней / 11 дней / 21 день',
      /1 день$/.test(봄.d1)&&/2 дня$/.test(봄.d2)&&/5 дней$/.test(봄.d5)&&/11 дней$/.test(봄.d11)&&/21 день$/.test(봄.d21), 봄); }
    if(L==='ko'){ T('ko 는 그대로', 봄.d1==='1일 남음', 봄); }
    await ctx.close();
  }
  console.log('\n합계: '+ok+'개 통과 / '+bad+'개 실패');
  await br.close(); server.close(); process.exit(bad?1:0);
})();
