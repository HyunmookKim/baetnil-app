// 진짜 브라우저에서 세 단어가 나오는가 — 한국어·일본어·영어·러시아어
const { chromium } = require('playwright');
const fs=require('fs'), http=require('http'), path=require('path');
const SRC = process.argv[2] || 'work.html';
const srv = http.createServer((q,r)=>{
  let f=q.url.split('?')[0];
  const 뿌리 = (f==='/' || f==='/index.html');
  if(뿌리) f='/'+SRC;
  // ★ 절대경로로 건네받은 앱 파일은 cwd 를 앞에 붙이면 안 된다.
  const p = (뿌리 && path.isAbsolute(SRC)) ? SRC : path.join(process.cwd(), f.replace(/^\//,''));
  if(!fs.existsSync(p)){ r.writeHead(404); r.end(''); return; }
  const e=path.extname(p);
  r.writeHead(200,{'content-type': e==='.js'?'text/javascript':'text/html; charset=utf-8'});
  r.end(fs.readFileSync(p));
});
let pass=0, fail=0;
const T=(n,ok,x)=>{ ok?(pass++,console.log('통과: '+n)):(fail++,console.log('★ 실패: '+n+(x===undefined?'':' — '+JSON.stringify(x)))); };
(async()=>{
  await new Promise(r=>srv.listen(0,r));
  const url='http://127.0.0.1:'+srv.address().port+'/';
  const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await br.newPage({ locale:'ko-KR' });
  const errs=[]; pg.on('pageerror',e=>errs.push(String(e)));
  await pg.goto(url,{waitUntil:'load'}); await pg.waitForTimeout(2500);
  for(const L of ['ko','ja','en','ru']){
    const got = await pg.evaluate(l=>{
      const D = (l==='ko') ? null : (I18N && I18N[l]);
      const tr = s => (l==='ko') ? s : ((D && D[s] != null && D[s] !== '') ? D[s] : s);
      return PUB_LEVELS.map(x=>({k:x.k, name:tr(x.name), sub:tr(x.sub)}));
    }, L);
    T(L+' 세 단계가 다 나온다', got.length===3 && got.every(g=>g.name && g.sub), got);
    if(L!=='ko') T(L+' 는 한국어가 안 남아 있다',
      !got.some(g=>/[가-힣]/.test(g.name)) && !got.some(g=>/[가-힣]/.test(g.sub)), got);
    else T('ko 단어가 공개·일부 공개·비공개 다',
      got.map(g=>g.name).join('/')==='공개/일부 공개/비공개', got.map(g=>g.name));
  }
  T('브라우저에서 터진 곳이 없다', errs.length===0, errs.slice(0,2));
  await br.close(); srv.close();
  console.log('\n합계: '+pass+'개 통과 / '+fail+'개 실패');
  process.exit(fail?1:0);
})();
