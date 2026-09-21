// 방침 판이 올라가면 쓰던 분에게 다시 동의를 받는가 + 앱이 무거워지지 않았나
const { chromium } = require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
// ★ 넘겨받은 파일을 본다. 검사 폴더에 남은 옛 work.html 을 보면 안 된다.
//   실제로 4.44 에서 이 검사가 4.41 짜리 옛 파일을 보고 「다 지났다」고 했다.
const __ARG  = process.argv[2];
const __BASE = __ARG ? require('path').dirname(require('path').resolve(__ARG)) : __dirname;
const __MAIN = __ARG ? require('path').basename(__ARG) : 'work.html';
const FILE=process.argv[2]||'work.html';
const server=http.createServer((rq,rs)=>{const f=((rq.url === '/' && path.isAbsolute(__MAIN)) ? __MAIN : path.join(__BASE, rq.url === '/' ? __MAIN : rq.url.split('?')[0]));
  fs.readFile(f,(e,d)=>{if(e){rs.writeHead(404);rs.end();return;}rs.writeHead(200);rs.end(d);});});
let ok=0,bad=0;
const T=(n,c,w)=>{ if(c){ok++;console.log('통과: '+n);} else {bad++;console.log('★ 실패: '+n+(w!==undefined?' — '+JSON.stringify(w).slice(0,140):''));} };
(async()=>{
  await new Promise(r=>server.listen(0,r));
  const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const ctx=await br.newContext({ locale:'ko-KR',viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const pg=await ctx.newPage();
  const errs=[]; pg.on('pageerror',e=>errs.push(String(e)));
  const t0=Date.now();
  await pg.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'load'});
  await pg.waitForFunction(()=>typeof APP_VER!=='undefined');
  const boot=Date.now()-t0;
  console.log('  뜨는 데', boot, 'ms');
  T('앱이 3초 안에 뜬다', boot < 3000, boot);
  T('판 번호와 저장분 이름이 맞는다',
    (await pg.evaluate(()=>APP_VER)) === require('fs').readFileSync(require('path').join(__BASE,'sw.js'),'utf8').match(/baetnil-([0-9.]+)/)[1],
    await pg.evaluate(()=>APP_VER));
  // ★ 판 번호를 글자로 박아 두면 약관을 고칠 때마다 검사가 깨진다.
  //   보아야 할 것은 '옛 판에 동의한 사람에게 다시 묻는가' 이지 번호 자체가 아니다.
  const VER = await pg.evaluate(()=>LEGAL_VER);
  T('방침 판 번호가 있다', /^\d+\.\d+$/.test(String(VER)), VER);

  // 옛 판에 동의해 둔 사람
  const need = await pg.evaluate(()=>{
    localStorage.setItem('bt_agree', JSON.stringify({ ver:'0.9', at:'2026-08-12T00:00:00.000Z', loc:true }));
    return needAgree();
  });
  T('옛 판에 동의한 사람에게 다시 묻는다', need === true, need);
  const done = await pg.evaluate(v=>{
    localStorage.setItem('bt_agree', JSON.stringify({ ver:v, at:'2026-08-18T00:00:00.000Z', loc:true }));
    return needAgree();
  }, VER);
  T('지금 판에 동의하면 안 묻는다', done === false, done);

  // 방침 글에 새 대목이 들어 있나
  const pv = await pg.evaluate(()=>legalText('privacy'));
  T('이메일을 명부에 안 담는다고 적혀 있다', pv.indexOf('이용자 명부에는 담지 않습니다') >= 0);
  T('명부·참여 신청에 이메일이 없다고 적혀 있다', pv.indexOf('참여 신청에도 이메일이 나오지 않습니다') >= 0);
  T('참여 신청 한마디를 모은다고 적혀 있다', pv.indexOf('선주에게 남기는 한마디') >= 0);
  // 시행일도 마찬가지 — LEGAL_DATES 를 그대로 썼는지만 본다
  const D = await pg.evaluate(()=>LEGAL_DATES.ko);
  T('시행일이 방침 안에 그대로 적힌다', pv.indexOf(D) >= 0, D);
  T('시행일 자리표가 안 남았다', !/\{DATE\}|\{VER\}|\{LBS\}|\{BIZ\}/.test(pv));
  T('페이지 오류 없음', errs.length===0, errs.slice(0,2));
  console.log('\n합계: '+ok+'개 통과 / '+bad+'개 실패');
  await br.close(); server.close();
  process.exit(bad?1:0);
})();
