// ══════════════════════════════════════════════════════════════════════
// F2 — 정비·연료·문서·항해일지·날씨 화면을 실제로 열고 눌러 본다
//
// ★ 여기서 찾아낸 고장 (2026-09-16, 5.0)
//   날씨 화면의 「왜 위치를 못 잡았나」 가 **둘로만 갈려 있었다.**
//   앱 안에서 위치정보 동의를 거절한 사람에게도
//   「설정에서 위치 권한을 허용하시거나」 라고 말했다.
//   폰 설정은 멀쩡한데 설정에 들어가 보라는 것이라, 아무리 찾아도 고칠 것이 없어
//   사람은 앱이 고장난 줄 안다. 까닭이 셋이면 말도 셋이어야 한다.
// ══════════════════════════════════════════════════════════════════════
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const FILE = process.argv[2] || path.join(__dirname, '..', '..', 'work.html');
const SRC = path.isAbsolute(FILE) ? FILE : path.join(__dirname, FILE);
const ROOT = path.dirname(SRC);
const MIME = {'.html':'text/html','.js':'text/javascript','.json':'application/json','.woff2':'font/woff2','.png':'image/png'};
const srv = http.createServer((rq, rs) => { const u = rq.url.split('?')[0];
  const f = (u === '/') ? SRC : path.join(ROOT, u);
  fs.readFile(f, (e, d) => { if(e){ rs.writeHead(404); rs.end(); return; }
    rs.writeHead(200, {'content-type': MIME[path.extname(f)] || 'application/octet-stream'}); rs.end(d); }); });
let ok = 0, bad = 0;
const T = (n, c, x) => { if(c){ ok++; console.log('통과: ' + n); }
  else { bad++; console.log('★ 실패: ' + n + (x === undefined ? '' : ' — ' + JSON.stringify(x).slice(0,260))); } };

const 준비 = async (pg, port) => {
  await pg.addInitScript(() => {
    try{ localStorage.setItem('bt_setup','done'); localStorage.setItem('bt_welcome','done');
         localStorage.setItem('bt_lang','ko'); localStorage.setItem('bt_cc','KR'); }catch(_){}
    window.__user = { uid:'U1', name:'김명준', email:'a@b.c' };
  });
  await pg.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'load' });
  await pg.waitForTimeout(3500);
  await pg.evaluate(() => { try{ me = { uid:'U1', name:'김명준' }; }catch(_){}
    try{ applyAccount && applyAccount(); }catch(_){} });
};

(async () => {
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const port = srv.address().port;
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

  // ── 1. 날씨 : 위치를 못 잡은 까닭이 셋으로 갈리는가
  for(const [누를것, 있어야할말, 있어야할단추, 이름] of [
      ['닫기',     /동의하지 않으셨습니다/, '동의하기',        '앱에서 동의를 거절했을 때'],
      ['동의하기', /설정에서 위치 권한/,    '현재 위치 다시 시도', '동의는 했는데 폰이 막을 때']]){
    const ctx = await b.newContext({ viewport:{width:412,height:820}, hasTouch:true, isMobile:true, permissions:[] });
    const pg = await ctx.newPage();
    await 준비(pg, port);
    await pg.evaluate(() => { switchTab('home'); homeSub='weather'; switchTab('home'); });
    await pg.waitForTimeout(2200);
    const 떴나 = await pg.evaluate(() => /위치정보 이용에 동의하셔야/.test(document.body.innerText||''));
    T('★ 날씨를 열면 위치정보 동의를 묻는다', 떴나);
    await pg.evaluate(라벨 => { const x=[...document.querySelectorAll('button')]
      .filter(b=>b.offsetParent!==null && b.innerText.trim()===라벨)[0]; if(x) x.click(); }, 누를것);
    await pg.waitForTimeout(2500);
    const r = await pg.evaluate(() => { const L=document.getElementById('weatherList');
      return { 글: L?(L.innerText||'').replace(/\s+/g,' ').trim():'',
               단추: L?[...L.querySelectorAll('button')].map(x=>x.innerText.trim()):[] }; });
    T('★★★ ' + 이름 + ' — 맞는 말을 한다', 있어야할말.test(r.글), r.글.slice(0,140));
    T('★★★ ' + 이름 + ' — 맞는 단추를 준다', r.단추.indexOf(있어야할단추) >= 0, r.단추);
    T(이름 + ' — 「확인하는 중」에 머물지 않는다', !/확인하는 중/.test(r.글), r.글.slice(0,80));
    T(이름 + ' — 지점을 직접 넣는 길도 남는다', r.단추.indexOf('지점 직접 추가') >= 0, r.단추);
    await ctx.close();
  }

  // ── 2. 정비·연료·문서·항해일지 : 「+」가 기록 창을 여는가
  {
    const ctx = await b.newContext({ viewport:{width:412,height:820}, hasTouch:true, isMobile:true });
    const pg = await ctx.newPage();
    const errs = [];
    pg.on('pageerror', e => errs.push(String(e.message).slice(0,140)));
    await 준비(pg, port);
    await pg.evaluate(() => openBoatSetup());
    await pg.waitForTimeout(700);
    await pg.fill('#nbName', '선샤인');
    await pg.evaluate(() => createBoat());
    await pg.waitForTimeout(1200);

    const 눌러본다 = async (이름, 탭, 부름) => {
      await pg.evaluate(() => { try{ closeMR && closeMR(); }catch(_){} });
      await pg.evaluate(src => eval('(' + src + ')')(), 탭.toString());
      await pg.waitForTimeout(600);
      const r = await pg.evaluate(async (src) => {
        let threw = '';
        try{ const v = eval('(' + src + ')')(); if(v && v.then) await v; }catch(e){ threw = String(e.message).slice(0,140); }
        await new Promise(r=>setTimeout(r,700));
        const P = document.getElementById('mrPanel');
        return { threw, 열림: !!(P && P.offsetParent !== null),
                 칸: P ? P.querySelectorAll('input,textarea,select').length : 0,
                 글: P ? (P.innerText||'').replace(/\s+/g,' ').trim().slice(0,120) : '' };
      }, 부름.toString());
      T('★ ' + 이름 + ' 가 기록 창을 연다', r.열림 && r.칸 >= 3 && !r.threw, r);
    };
    await 눌러본다('+ 장비',     () => { boatSubTab='gear';  gearView='list'; switchTab('boat'); }, () => addGear());
    await 눌러본다('+ 정기점검', () => { boatSubTab='gear';  gearView='maint'; switchTab('boat'); }, () => mrAdd('maint'));
    await 눌러본다('+ 정비수첩', () => { boatSubTab='maint'; mntSub='mlog';   switchTab('boat'); }, () => addMlog());
    await 눌러본다('+ 고장',     () => { boatSubTab='maint'; mntSub='repair'; switchTab('boat'); }, () => repairAdd());
    await 눌러본다('+ 주유',     () => { boatSubTab='maint'; mntSub='fuel';   switchTab('boat'); }, () => addFuel());
    await 눌러본다('+ 엔진가동', () => { boatSubTab='maint'; mntSub='fuel';   switchTab('boat'); }, () => addRun());
    await 눌러본다('+ 문서',     () => { boatSubTab='docs';  switchTab('boat'); }, () => addVdoc());
    await 눌러본다('+ 연락처',   () => { boatSubTab='docs';  switchTab('boat'); }, () => addContact());
    await 눌러본다('+ 기록',     () => { boatSubTab='voyage'; switchTab('boat'); }, () => addVoyage());
    await 눌러본다('+ 예정',     () => { boatSubTab='voyage'; switchTab('boat'); }, () => addPlan());

    // ── 3. 주유를 실제로 저장하면 목록에 나타나는가
    await pg.evaluate(() => { try{ closeMR && closeMR(); }catch(_){}
      boatSubTab='maint'; mntSub='fuel'; switchTab('boat'); });
    await pg.waitForTimeout(700);
    const 전 = await pg.evaluate(() => (typeof fuel !== 'undefined' ? fuel.length : -1));
    await pg.evaluate(() => addFuel());
    await pg.waitForTimeout(800);
    const 후 = await pg.evaluate(() => {
      const 줄 = (typeof fuel !== 'undefined') ? fuel[fuel.length-1] : null;
      return { n: (typeof fuel !== 'undefined') ? fuel.length : -1,
               날짜: 줄 ? !!줄.date : false, 시각: 줄 ? !!줄.time : false };
    });
    T('★ 주유 한 줄이 실제로 생긴다', 후.n === 전 + 1, { 전, 후 });
    T('★ 날짜와 시각을 앱이 미리 채워 준다 (숫자를 치게 하지 않는다)', 후.날짜 && 후.시각, 후);

    T('여기까지 터진 곳이 없다', errs.length === 0, errs.slice(0,3));
    await ctx.close();
  }

  await b.close(); srv.close();
  console.log(`\n${ok}/${ok+bad} 통과`);
  process.exit(bad ? 1 : 0);
})();
